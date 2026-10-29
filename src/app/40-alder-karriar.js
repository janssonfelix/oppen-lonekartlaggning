// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson

// ---- Löneutveckling (Kön) ----
// Kohortförbehållet: lön mot ålder och livscykelkurvorna bygger på ett tvärsnitt av lönerna i dag. De visar
// skillnader mellan åldersgrupper nu, inte hur en persons lön utvecklas — åldersgrupperna skiljer sig också i
// utbildning, yrkesval och anställningstid (kohorteffekter). Står under kurvorna, i Om verktyget och i metodbilagan.
const KOHORT_FORBEHALL = 'Kurvorna bygger på ett tvärsnitt av lönerna i dag: de visar skillnader mellan åldersgrupper just nu, inte hur en persons lön utvecklas över karriären. Åldersgrupperna skiljer sig också i utbildning, yrkesval och anställningstid (kohorteffekter), så en skillnad mellan 30- och 60-åringar är inte en förväntad löneutveckling.';
// Raden under nyckeltalen, i klartext: stiger lönen lika mycket per levnadsår för kvinnor och män, och hur mycket av
// skillnaden förklarar åldersfördelningen? Ren funktion. lutKv/lutMa är trendlinjernas lutning i kronor per år;
// ra och vidSammaAlder är kvinnors lön i procent av mäns, utan justering respektive avläst vid medelåldern.
function _akInsiktText(lutKv, lutMa, ra, vidSammaAlder) {
    const kr = v => `${v >= 0 ? '+' : '−'}${svTal(Math.abs(Math.round(v)), 0)} kr`;
    const medel = (Math.abs(lutKv) + Math.abs(lutMa)) / 2;
    const likaLutning = medel === 0 || Math.abs(lutKv - lutMa) / medel <= 0.25;
    const lutning = likaLutning
        ? `Lönen stiger ungefär lika mycket per levnadsår för kvinnor (${kr(lutKv)}) och män (${kr(lutMa)}).`
        : lutKv < lutMa
            ? `Lönen stiger långsammare med åldern för kvinnor (${kr(lutKv)} per år) än för män (${kr(lutMa)}).`
            : `Lönen stiger snabbare med åldern för kvinnor (${kr(lutKv)} per år) än för män (${kr(lutMa)}).`;
    const skillnad = vidSammaAlder - ra;
    const justering = Math.abs(skillnad) < 1
        ? `Vid samma ålder är kvinnors lön ${svPct(vidSammaAlder, 1)} av mäns, nästan som utan justering (${svPct(ra, 1)}): åldersfördelningen förklarar lite av skillnaden.`
        : skillnad > 0
            ? `Vid samma ålder är kvinnors lön ${svPct(vidSammaAlder, 1)} av mäns, mot ${svPct(ra, 1)} utan justering: åldersfördelningen förklarar en del av skillnaden${vidSammaAlder < 95 ? ', men inte hela' : ''}.`
            : `Vid samma ålder är kvinnors lön ${svPct(vidSammaAlder, 1)} av mäns, mot ${svPct(ra, 1)} utan justering: skillnaden blir större när åldern räknas bort, eftersom kvinnorna i urvalet i genomsnitt är äldre.`;
    return `${lutning} ${justering} Vad BAS-intervall och yrkesgrupp förklarar står i Lika arbete.`;
}
function renderKon(bas) {
    const isAll = bas === "__ALLA__";
    const df = getData().filter(d => (isAll || d.bas === bas) && d.alder && d.alder > 0 && d.kon);
    if (df.length < 2) return;
    const dataKv = df.filter(d => d.kon.includes("kvinna"));
    const dataMa = df.filter(d => d.kon === "man" || d.kon === "män");
    const regKv  = Stat.linearRegression(dataKv.map(d => [d.alder, d.lon]));
    const regMa  = Stat.linearRegression(dataMa.map(d => [d.alder, d.lon]));
    const allAges  = df.map(d => d.alder);
    const minAlder = Math.min(...allAges), maxAlder = Math.max(...allAges);
    const avgAlder = allAges.reduce((a,b)=>a+b,0) / allAges.length;
    const rawLonKv = dataKv.map(d => d.lon);
    const rawLonMa = dataMa.map(d => d.lon);
    // Könsuppdelade lönemått följer tröskeln (ADR-12): gapen kräver den för båda könen; ett köns
    // trendlinje, konfidensband och låda kräver den för det könet. En enskild punkt i
    // spridningsdiagrammet ritas bara för en person vars grupp och kön i gruppen når tröskeln.
    const kvOk = !isKMasked(dataKv.length), maOk = !isKMasked(dataMa.length);
    const konOk = kvOk && maOk;
    const medKv = Stat.median(rawLonKv) || 0, medMa = Stat.median(rawLonMa) || 0;
    const unadjGap = !konOk ? "–" : medMa > 0 ? svPct((medKv/medMa)*100, 1) : "–";
    const expKv = regKv.m * avgAlder + regKv.b, expMa = regMa.m * avgAlder + regMa.b;
    const ageAdjGap = !konOk ? "–" : expMa > 0 ? svPct((expKv/expMa)*100, 1) : "–";
    // Urvalsraden och avsnittens nyckeltal (ADR-41).
    const urvalText = document.getElementById('ak-urval-text');
    if (urvalText) urvalText.textContent = `${svTal(df.length, 0)} personer · minsta gruppstorlek ${kInstalld()}`;
    _laNyckel('nyckel-ak-fordelning', konOk && medMa > 0 ? `Kvinnors median ${unadjGap} av mäns` : '');
    _laNyckel('nyckel-ak-alla', `${getBasIntervals().length} BAS-intervall`);
    /** @type {HTMLElement} */ (document.getElementById("kon-kpi-n")).textContent = svTal(df.length, 0);
    { const u = document.getElementById("kon-kpi-n-under"); if (u) u.textContent = `${svTal(dataKv.length, 0)} kvinnor · ${svTal(dataMa.length, 0)} män`; }
    /** @type {HTMLElement} */ (document.getElementById("kon-kpi-gap")).textContent = unadjGap;
    const ageGapEl = /** @type {HTMLElement} */ (document.getElementById("kon-kpi-agegap"));
    ageGapEl.textContent = ageAdjGap;
    // Över 5 % skillnad sägs i ord under talet (inte med röd siffra utan förklaring).
    { const u = document.getElementById("kon-kpi-agegap-under"), over = konOk && expMa > 0 && Math.abs((expKv/expMa)*100 - 100) > 5;
      if (u) { u.textContent = over ? "skillnad över 5 %" : "kvinnors lön i % av mäns"; u.classList.toggle("ar-kritisk", over); } }
    const lutning = (ok, reg) => (ok ? `${reg.m >= 0 ? '+' : '−'}${svTal(Math.abs(Math.round(reg.m)), 0)}` : '–');
    /** @type {HTMLElement} */ (document.getElementById("kon-kpi-slope")).textContent = `${lutning(kvOk, regKv)} / ${lutning(maOk, regMa)} kr`;
    const insightEl = document.getElementById("p-value-insight");
    if (insightEl) {
        const scope = isAll ? "Hela urvalet" : `BAS ${bas}`;
        insightEl.innerHTML = konOk && medMa > 0 && expMa > 0
            ? `<strong>${scope}:</strong> ${_akInsiktText(regKv.m, regMa.m, (medKv / medMa) * 100, (expKv / expMa) * 100)}`
            : `<strong>${scope}:</strong> ${esc(_konUtelamnatNot())}`;
    }
    { const not = document.getElementById('kon-kohort-not'); if (not) not.textContent = KOHORT_FORBEHALL; }
    const colorBy = /** @type {HTMLInputElement} */ (document.getElementById('kon-color-by'))?.value || 'kon';
    // Trendlinjen för hela urvalet är ett valbart lager. Den är ett lönemått för urvalet och visas bara när
    // urvalet (alla BAS eller det valda) når tröskeln (beslut av produktägaren 2026-10-16).
    const trendAllaVald = !!(/** @type {HTMLInputElement|null} */ (document.getElementById('kon-trend-alla'))?.checked);
    const trendAllaOk = df.length >= kTroskel();
    const trendAlla = trendAllaVald && trendAllaOk ? Stat.linearRegression(df.map(d => [d.alder, d.lon])) : null;
    // Trendlinjer per kön med 95 % KI-band — bara för ett kön som når tröskeln.
    const ciKv = kvOk ? linearRegressionCI(dataKv.map(d => [d.alder, d.lon]), minAlder, maxAlder, 25) : null;
    const ciMa = maOk ? linearRegressionCI(dataMa.map(d => [d.alder, d.lon]), minAlder, maxAlder, 25) : null;
    /** @type {number|null} */ let statMedian = null;
    if (state.statistik.length > 0) {
        const localAIDs = [...new Set(df.map(d => { const m = d.yrke.match(/^(\d+)/); return m?m[1]:d.yrke; }))];
        const subStats = [];
        localAIDs.forEach(aid => {
            const sr = isAll ? state.statistik.find(s=>s.aid===aid) : (state.statistik.find(s=>s.aid===aid&&s.bas===bas)||state.statistik.find(s=>s.aid===aid&&!s.bas));
            if (sr && sr.median > 0) subStats.push(sr.median);
        });
        if (subStats.length) statMedian = Stat.median(subStats);
    }
    const scope2 = isAll ? 'hela urvalet' : `BAS-intervall ${bas}`;
    // Noter under diagrammen om det som utelämnats, och samma sak i diagrammens beskrivningar.
    const utan = [kvOk ? null : 'kvinnor', maOk ? null : 'män'].filter(Boolean).join(' och ');
    const skal = `färre än ${kTroskel()} personer av ${kvOk || maOk ? 'könet' : 'vartdera könet'} finns i urvalet`;
    // En punkt per person: punkten för en person i en grupp under tröskeln ritas och exporteras inte.
    const liten = individLitenFor(getData());
    const dolda = df.filter(liten).length;
    ritaFigur('chart-kon-scatter', _konScatterFigur({
        df, dataKv, dataMa, isAll, colorBy, minAlder, maxAlder, statMedian, liten, trendAlla,
        trendKv: kvOk ? regKv : null, trendMa: maOk ? regMa : null, ciKv, ciMa, pol: isAll ? null : policyFor(null, bas),
        beskrivning: `Spridningsdiagram lön mot ålder för ${scope2}. ${dataKv.length} kvinnor och ${dataMa.length} män. ` +
            (konOk ? `Kvinnors trend ökar med ${Math.round(regKv.m)} kr per år, mäns med ${Math.round(regMa.m)} kr per år. `
                   : `${kvOk ? `Kvinnors trend ökar med ${Math.round(regKv.m)} kr per år. ` : ''}${maOk ? `Mäns trend ökar med ${Math.round(regMa.m)} kr per år. ` : ''}Trendlinje visas inte för ${utan}: ${skal}. `) +
            `Ojusterat lönegap: ${unadjGap}. Åldersjusterat: ${ageAdjGap}.` +
            (trendAlla ? ` Trend för hela urvalet: ${trendAlla.m >= 0 ? '+' : '−'}${svTal(Math.abs(Math.round(trendAlla.m)), 0)} kr per år.` : '') }), { hojd: 420 });
    // En låda är könets kvartiler: den ritas bara för ett kön som når tröskeln.
    const boxEl = document.getElementById('chart-kon-boxplot');
    if (kvOk || maOk) {
        ritaFigur(boxEl, _konLadFigur({ lonKv: kvOk ? rawLonKv : null, lonMa: maOk ? rawLonMa : null,
            beskrivning: `Lådagram av lönefördelning per kön för ${scope2}. ${rawLonKv.length} kvinnor, ${rawLonMa.length} män.`
                + (utan ? ` Lådan visas inte för ${utan}: ${skal}.` : '') }), { hojd: 420 });
    } else if (boxEl) rensaFigur(boxEl);
    _setDiagramKNot('chart-kon-scatter', [utan ? `Trendlinje och konfidensband visas inte för ${utan}: ${skal}.` : '',
        trendAllaVald && !trendAllaOk ? _demoTrendNot(df.length) : '', _individNot(dolda)].filter(Boolean).join(' '));
    _setDiagramKNot('chart-kon-boxplot', utan ? `Lådan visas inte för ${utan}: ${skal}.` : '');
    renderKonMultiplar();
    renderKonHistogram(dataKv, dataMa, scope2);
    renderKonAlderGap(dataKv, dataMa, scope2);
}

// ---- Lönefördelningen per BAS-intervall (lådmärket: lådor, täthetskurvor eller kvantilpunkter) ----
// En figur per BAS-intervall — eller per kön i varje intervall — över alla i urvalet. Ritas som lådor i Lika arbete
// (*Lönespridning per BAS-intervall och kön*); täthetskurvorna i Ålder & karriär är borttagna (översynen 2026-10-29),
// formerna finns kvar för andra anropare. En figur är ett aggregat som lådan: en individ är `liten` när intervallet,
// eller könet i intervallet, är under tröskeln, och ritas då inte.
function _konTathetFigur(rader, perKon, k = kTroskel(), form = 'fiol') {
    const kon = r => (r.kon && r.kon.includes('kvinna') ? 'Kvinna' : (r.kon === 'man' || r.kon === 'män') ? 'Man' : null);
    const giltiga = rader.filter(r => r.lon > 0 && r.bas != null && r.bas !== '' && (!perKon || kon(r)));
    const antal = new Map();
    const cell = r => (perKon ? `${r.bas}\u0000${kon(r)}` : String(r.bas));
    for (const r of giltiga) antal.set(cell(r), (antal.get(cell(r)) || 0) + 1);
    const serier = perKon ? [['Kvinna', PALETTE.kon.kvinna], ['Man', PALETTE.kon.man]] : [['Alla', PALETTE.serie[0]]];
    const lager = serier.map(([namn, farg]) => ({
        marke: 'lada', ...(form === 'fiol' ? { form: 'fiol' } : form === 'kvantiler' ? { form: 'kvantiler', antal: 20 } : { avvikare: false }), serie: namn, farg,
        data: giltiga.filter(r => !perKon || kon(r) === namn).map(r => ({ x: 'BAS ' + r.bas, y: r.lon, markering: markeringFor(r.bas), ...(antal.get(cell(r)) < k ? { liten: true } : {}) })),
        tips: (d, s) => (s ? [[d.x], ..._kvantilTipsRader(s), [perKon ? `${namn}, median` : 'Median', _figTalformat(s.median, 'kr')],
                               ['Kvartiler', `${_figTalformat(s.q1, 'kr', { enhet: false })}–${_figTalformat(s.q3, 'kr')}`], ['Antal', String(s.n)]] : [[d.x]])
    })).filter(l => l.data.length);
    const utelamnade = [...antal].filter(([, n]) => n < k).map(([c]) => { const [bas, kn] = c.split('\u0000'); return kn ? `BAS ${bas} (${kn === 'Kvinna' ? 'kvinnor' : 'män'})` : `BAS ${bas}`; })
        .sort((a, b) => a.localeCompare(b, 'sv', { numeric: true }));
    const ordning = [...new Set(giltiga.map(r => r.bas))].sort().map(b => 'BAS ' + b);
    if (form === 'kvantiler') return { utelamnade, figur: { beskrivning: `Lönefördelningen per BAS-intervall${perKon ? ' och kön' : ''} som kvantilpunkter: varje prick är en tjugondel av gruppen (i små grupper en större andel, aldrig färre än två personer), lagd vid den lönen. Räkna prickarna under en lön för att se hur stor andel som tjänar mindre. Inga enskilda löner visas.`,
        legend: perKon ? undefined : false, x: { skala: 'band', ordning }, y: { skala: 'linjar', titel: 'Månadslön', format: 'kr' }, hojd: 420, lager } };
    if (form !== 'fiol') return { utelamnade, figur: { beskrivning: `Lönespridningen per BAS-intervall och kön som lådagram: lådan är mittersta hälften av lönerna (första till tredje kvartilen), strecket i lådan medianen. Enstaka löner utanför morrhåren visas inte. Överlappar kvinnors och mäns lådor i ett intervall ligger könen på samma nivå där. BAS-intervall där ett kön har färre än ${k} personer visas inte för det könet.`,
        x: { skala: 'band', ordning }, y: { skala: 'linjar', titel: 'Månadslön', format: 'kr' }, hojd: 380, lager } };
    return { utelamnade, figur: { beskrivning: `Lönefördelningen per BAS-intervall${perKon ? ' och kön' : ''} som täthetskurvor: kurvan är bredast där flest löner ligger. Strecken är median och kvartiler. Kurvan slutar vid morrhårens ändar; enstaka löner långt utanför visas inte.`,
        legend: perKon ? undefined : false, x: { skala: 'band', ordning }, y: { skala: 'linjar', titel: 'Månadslön', format: 'kr' }, hojd: 420, lager } };
}
document.getElementById('kon-trend-alla')?.addEventListener('change', () => { const s = /** @type {HTMLInputElement|null} */ (document.getElementById('bas-select-kon')); if (s) renderKon(s.value); });

// ---- Löneklasser: indelningen för histogrammet ----
// Klassbredden väljs bland jämna steg så att spannet ger ungefär `mal` klasser. Spannet mäts mellan 5:e och 95:e
// percentilen, så att enstaka löner långt ut inte gör klasserna för breda.
function _konLonesteg(loner, mal = 12) {
    const v = loner.slice().sort((a, b) => a - b), vid = p => v[Math.min(v.length - 1, Math.max(0, Math.round(p * (v.length - 1))))];
    const spann = vid(0.95) - vid(0.05);
    return [500, 1000, 2000, 2500, 5000, 10000, 20000].find(s => spann / s <= mal) || 50000;
}
const _konTkr = v => _figTalformat(v / 1000, Number.isInteger(v / 1000) ? 'antal' : undefined);

// ---- Histogram: lönefördelningen för kvinnor och män, klass för klass ----
// Andel av respektive kön per löneklass. Visas bara när båda könen når tröskeln. Ingen stapel får gälla en klass
// med färre än tröskeln personer: klasserna i ändarna slås ihop inåt tills ändklassen når tröskeln ("under X",
// "X eller mer"), och finns en gles klass i mitten fördubblas klassbredden och indelningen görs om. Går det inte
// att få minst tre klasser ritas inget.
function _konHistogramKlasser(kv, ma, k) {
    const alla = [...kv, ...ma];
    if (kv.length < k || ma.length < k) return null;
    let steg = _konLonesteg(alla);
    for (let varv = 0; varv < 6; varv++, steg *= 2) {
        const golv = Math.floor(Math.min(...alla) / steg) * steg, antal = Math.floor((Math.max(...alla) - golv) / steg) + 1;
        /** @type {Array<{fran: number, till: number, nKv: number, nMa: number, oppenNed?: boolean, oppenUpp?: boolean}>} */
        let klasser = Array.from({ length: antal }, (_, i) => ({ fran: golv + i * steg, till: golv + (i + 1) * steg, nKv: 0, nMa: 0 }));
        const plats = v => Math.min(antal - 1, Math.floor((v - golv) / steg));
        for (const v of kv) klasser[plats(v)].nKv++;
        for (const v of ma) klasser[plats(v)].nMa++;
        const n = c => c.nKv + c.nMa;
        const slaIhop = (a, b) => ({ fran: a.fran, till: b.till, nKv: a.nKv + b.nKv, nMa: a.nMa + b.nMa, ...(a.oppenNed ? { oppenNed: true } : {}), ...(b.oppenUpp ? { oppenUpp: true } : {}) });
        while (klasser.length > 1 && n(klasser[0]) < k) klasser = [{ ...slaIhop(klasser[0], klasser[1]), oppenNed: true }, ...klasser.slice(2)];
        while (klasser.length > 1 && n(klasser[klasser.length - 1]) < k) klasser = [...klasser.slice(0, -2), { ...slaIhop(klasser[klasser.length - 2], klasser[klasser.length - 1]), oppenUpp: true }];
        if (klasser.length >= 3 && klasser.every(c => n(c) >= k)) return klasser;
    }
    return null;
}
function _konHistogramFigur(klasser, nKv, nMa, scope) {
    const namn = c => (c.oppenNed ? `under ${_konTkr(c.till)}` : c.oppenUpp ? `${_konTkr(c.fran)} eller mer` : `${_konTkr(c.fran)}–${_konTkr(c.till)}`);
    // De två fördelningarna ligger på samma plats, halvgenomskinliga: formen på vardera syns, och där de täcker
    // varandra blandas färgerna (i parvisa staplar går formen inte att se). En stapel som gäller färre än
    // litetUnderlag() personer är märkt `fa` och förklaras i noten och tipset — inget mönster, som inte går att läsa
    // i två lager.
    const serie = (s, farg, falt, tot) => ({ marke: 'stapel', lage: 'overlagrad', serie: s, farg, opacitet: 0.55,
        data: klasser.map(c => ({ x: namn(c), y: +(100 * c[falt] / tot).toFixed(1), n: c.nKv + c.nMa, ...(c[falt] > 0 && c[falt] < litetUnderlag() ? { fa: true } : {}) })),
        tips: d => [[`${d.x} tkr`], [s, _figTalformat(d.y, 'pct')], ['Personer i klassen', String(d.n)], ...(d.fa ? [['Litet underlag', `färre än ${litetUnderlag()} ${s.toLowerCase()}`]] : [])] });
    return { beskrivning: `Lönefördelningen för kvinnor och män i ${scope}: andel av respektive kön per löneklass. Varje klass rymmer minst ${kTroskel()} personer; klasserna i ändarna är hopslagna.`,
        x: { skala: 'band', titel: 'Månadslön (tusen kronor)', ordning: klasser.map(namn) }, y: { skala: 'linjar', titel: 'Andel av könet (%)' }, hojd: 340,
        lager: [serie('Kvinnor', PALETTE.kon.kvinna, 'nKv', nKv), serie('Män', PALETTE.kon.man, 'nMa', nMa)] };
}
// ---- Lönegap per åldersgrupp ----
// Kvinnors medianlön i procent av mäns i varje åldersgrupp, med samma bootstrap-intervall som översikten i Lika arbete
// (_laBootstrapGapCI). Visar VAR i karriären skillnaden finns — inte varför: det är den råa skillnaden mellan alla
// kvinnor och män i åldersgruppen, oavsett yrke och nivå. En åldersgrupp där ett kön har färre än tröskeln visas inte.
const KON_ALDERSGRUPPER = [[0, 29, 'Under 30 år'], [30, 39, '30–39 år'], [40, 49, '40–49 år'], [50, 59, '50–59 år'], [60, 200, '60 år och äldre']];
function _konAlderGapRader(dataKv, dataMa, k = kTroskel()) {
    const visade = [], dolda = [];
    for (const [fran, till, namn] of KON_ALDERSGRUPPER) {
        const i = r => r.alder >= fran && r.alder <= till && r.lon > 0;
        const kv = dataKv.filter(i).map(r => r.lon), ma = dataMa.filter(i).map(r => r.lon);
        if (!kv.length && !ma.length) continue;
        if (kv.length < k || ma.length < k) { dolda.push(namn); continue; }
        const medKv = Stat.median(kv), medMa = Stat.median(ma);
        if (!(medMa > 0)) continue;
        visade.push({ namn, nKv: kv.length, nMa: ma.length, medKv, medMa, gap: medKv / medMa * 100, ci: _laBootstrapGapCI(kv, ma) });
    }
    return { visade, dolda };
}
function _konAlderGapFigur(rader, scope) {
    const status = o => _SKEVHET_STATUS.find(s => s.galler(Math.abs(100 - o.gap)));
    const pkt = o => ({ y: o.namn, x: +o.gap.toFixed(1), etikett: _figTalformat(o.gap, 'pct'), o, ...(o.ci ? { fel: { lag: o.ci.lo, hog: o.ci.hi } } : {}), ..._kronorFalt(o.medKv, o.medMa) });
    const kr = v => _figTalformat(Math.round(v), 'kr');
    const tips = d => [[d.y], ['Kvinnors median', `${_figTalformat(d.x, 'pct')} av männens`], ..._figKronorTipsRad(d.skillnadKr),
        ['95 % KI', d.fel ? `${_figTalformat(d.fel.lag, 'pct', { enhet: false })}–${_figTalformat(d.fel.hog, 'pct')}` : '–'],
        ['Median kvinnor / män', `${kr(d.o.medKv)} / ${kr(d.o.medMa)}`], ['Antal kvinnor / män', `${d.o.nKv} / ${d.o.nMa}`]];
    const alla = rader.flatMap(o => [o.gap, ...(o.ci ? [o.ci.lo, o.ci.hi] : [])]);
    return { beskrivning: `Kvinnors medianlön i procent av mäns per åldersgrupp i ${scope}, som en punkt med 95 % konfidensintervall mot linjen för lika lön (100 %). Skillnaden är rå: alla kvinnor mot alla män i åldersgruppen, oavsett yrke och nivå.`,
        y: { skala: 'band', ordning: rader.map(o => o.namn) },
        x: { skala: 'linjar', titel: 'Kvinnors median i % av mäns — 100 = lika lön', doman: [Math.floor(Math.min(90, ...alla) - 2), Math.ceil(Math.max(105, ...alla) + 2)] },
        hojd: Math.max(180, 110 + rader.length * 34),
        referens: [{ typ: 'zon', x0: 95, x1: 105, farg: PALETTE.semantic.ok, opacitet: 0.08, etikett: '±5 %' }, { x: 100, farg: PALETTE.semantic.mork, tjocklek: 1.5 }],
        lager: _SKEVHET_STATUS.map(s => ({ marke: 'punkt', riktning: 'liggande', symbol: s.symbol, storlek: 6, serie: s.serie, farg: PALETTE.semantic[s.farg],
            data: rader.filter(o => status(o) === s).map(pkt), tips })).filter(l => l.data.length) };
}
function renderKonAlderGap(dataKv, dataMa, scope) {
    const el = document.getElementById('chart-kon-aldergap');
    if (!el) return;
    const { visade, dolda } = _konAlderGapRader(dataKv, dataMa), not = document.getElementById('kon-aldergap-not'), k = kTroskel();
    if (not) { not.hidden = !dolda.length; not.textContent = dolda.length ? `Visas inte, ett kön har färre än ${k} personer: ${dolda.join(', ')}.` : ''; }
    if (!visade.length) {
        rensaFigur(el);
        el.innerHTML = `<p class="text-dampad-sm marg-8-0">Ingen åldersgrupp har minst ${k} kvinnor och ${k} män.</p>`;
        return;
    }
    ritaFigur(el, _konAlderGapFigur(visade, scope));
}

function renderKonHistogram(dataKv, dataMa, scope) {
    const el = document.getElementById('chart-kon-histogram');
    if (!el) return;
    const kv = dataKv.map(d => d.lon).filter(v => v > 0), ma = dataMa.map(d => d.lon).filter(v => v > 0), k = kTroskel();
    const klasser = _konHistogramKlasser(kv, ma, k);
    if (!klasser) {
        rensaFigur(el);
        el.innerHTML = `<p class="text-dampad-sm marg-8-0">${kv.length < k || ma.length < k ? esc(_konUtelamnatNot()) : `Lönerna går inte att dela in i klasser med minst ${k} personer i varje.`}</p>`;
        const n0 = document.getElementById('kon-histogram-not'); if (n0) { n0.hidden = true; n0.textContent = ''; }
        return;
    }
    const figur = _konHistogramFigur(klasser, kv.length, ma.length, scope);
    ritaFigur(el, figur);
    const not = document.getElementById('kon-histogram-not');
    const fa = figur.lager.some(l => l.data.some(d => d.fa));
    if (not) { not.hidden = !fa; not.textContent = fa ? `Några staplar gäller färre än ${litetUnderlag()} personer av könet i klassen (se verktygstipset på stapeln). Det är ett litet underlag — läs dem som enstaka personer, inte som ett mönster.` : ''; }
}

// ---- Små multiplar: lön mot ålder, en panel per BAS-intervall ----
// Samma punkter och samma regel som i punktdiagrammet överst: en person ritas bara när gruppen och könet i gruppen
// når tröskeln (individLitenFor). Trendlinjen i en panel räknas ur alla i intervallet och ritas bara när
// intervallet når tröskeln. Högst KON_MULTIPLAR_MAX paneler, de största intervallen, i BAS-ordning.
const KON_MULTIPLAR_MAX = 8;
// Högst så här många punkter ritas per panel: fler går ändå inte att urskilja i ett litet diagram, och i en stor
// organisation blev det annars över hundra tusen cirklar. Urvalet är var n:te person i filens ordning — samma
// varje gång. Trendlinjen räknas alltid ur alla.
const KON_MULTIPLAR_PUNKTER = 1500;
function _konMultiplarFigur(rader, liten, k = kTroskel()) {
    const giltiga = rader.filter(r => r.lon > 0 && r.alder > 0 && r.kon && r.bas != null && r.bas !== '');
    const perBas = new Map();
    for (const r of giltiga) { if (!perBas.has(r.bas)) perBas.set(r.bas, []); perBas.get(r.bas).push(r); }
    const stora = [...perBas].filter(([, g]) => g.length >= k).sort((a, b) => b[1].length - a[1].length);
    const valda = stora.slice(0, KON_MULTIPLAR_MAX).map(([b]) => b).sort();
    const utanfor = [...perBas.keys()].filter(b => !valda.includes(b)).sort().map(b => 'BAS ' + b);
    const lager = [], nedsamplade = [];
    for (const b of valda) {
        const g = perBas.get(b), panel = 'BAS ' + b;
        const ritbara = g.filter(r => !liten(r)), steg = Math.max(1, Math.ceil(ritbara.length / KON_MULTIPLAR_PUNKTER));
        const urval = steg > 1 ? new Set(ritbara.filter((_, i) => i % steg === 0)) : null;
        if (urval) nedsamplade.push(panel);
        for (const [namn, farg, ar] of [['Kvinna', PALETTE.kon.kvinna, r => r.kon.includes('kvinna')], ['Man', PALETTE.kon.man, r => r.kon === 'man' || r.kon === 'män']]) {
            const data = g.filter(ar).filter(r => !urval || liten(r) || urval.has(r)).map(r => ({ x: r.alder, y: r.lon, yrke: r.yrke, bas: r.bas, kon: namn, ...(liten(r) ? { liten: true } : {}), markering: markeringFor(r.bas, r.yrke) }));
            if (data.length) lager.push({ marke: 'punkt', serie: namn, farg, storlek: 2.5, opacitet: 0.6, panel, data, tips: _punktTips });
        }
        const reg = Stat.linearRegression(g.map(r => [r.alder, r.lon])), aldrar = g.map(r => r.alder), a0 = Math.min(...aldrar), a1 = Math.max(...aldrar);
        if (a1 > a0) lager.push({ marke: 'linje', serie: 'Trend (alla i intervallet)', farg: PALETTE.semantic.mork, tjocklek: 1.5, panel, data: [{ x: a0, y: reg.m * a0 + reg.b }, { x: a1, y: reg.m * a1 + reg.b }] });
    }
    return { utanfor, nedsamplade, figur: { beskrivning: `Lön mot ålder i ${valda.length} BAS-intervall, ett litet diagram per intervall med gemensamma axlar. Trendlinjen i varje panel räknas ur alla i intervallet.`,
        individer: true, paneler: valda.map(b => 'BAS ' + b), x: { skala: 'linjar', titel: 'Ålder' }, y: { skala: 'linjar', titel: 'Månadslön', format: 'kr' }, hojd: 340, lager } };
}
function renderKonMultiplar() {
    const el = document.getElementById('chart-kon-multiplar');
    if (!el) return;
    const d = getData();
    const { figur, utanfor, nedsamplade } = _konMultiplarFigur(d, individLitenFor(d));
    if (figur.paneler.length) ritaFigur(el, figur); else rensaFigur(el);
    const not = document.getElementById('kon-multiplar-not');
    const delar = [utanfor.length ? `Visas inte här (färre än ${kTroskel()} personer, eller fler intervall än ${KON_MULTIPLAR_MAX}): ${utanfor.join(', ')}.` : '',
                   nedsamplade.length ? `I ${nedsamplade.join(', ')} visas ett urval av punkterna (högst ${KON_MULTIPLAR_PUNKTER} per intervall); trendlinjen räknas ur alla.` : ''].filter(Boolean);
    if (not) { not.hidden = !delar.length; not.textContent = delar.join(' '); }
}

// ---- Figurer för diagramkärnan (ADR-39, steg 2) ----
// Noten under ett spridningsdiagram om de punkter som inte visas.
// `medTrend` är falskt när diagrammet saknar trendlinje (urvalet under tröskeln): då sägs inget om den.
const _individNot = (n, medTrend = true) => (n ? `${n} ${n === 1 ? 'person visas' : 'personer visas'} inte som punkt: gruppen (yrke inom BAS), eller personens kön i gruppen, har färre än ${kTroskel()} personer.${medTrend ? ' Trendlinjen bygger på alla.' : ''}` : '');
const _punktTips = d => [[d.yrke], ...(d.bas != null ? [['BAS', String(d.bas)]] : []), ...(d.kon ? [['Kön', d.kon]] : []),
                         ['Ålder', `${d.x} år`], ['Lön', _figTalformat(d.y, 'kr')]];
// En vågrät linje över hela åldersspannet (referensens P10, median, P90; jämförelsestatistikens median).
const _vagratLinje = (serie, farg, y, a0, a1, val = {}) => ({ marke: 'linje', serie, farg, data: [{ x: a0, y }, { x: a1, y }], ...val });

// Spridningsdiagrammet lön mot ålder. En persons punkt är `liten` — ritas och exporteras inte — när personens grupp
// eller kön i gruppen är under tröskeln (individLitenFor); trendlinje och konfidensband bygger på alla och finns
// bara för ett kön som når tröskeln — anroparen lämnar annars null. Zoom: pensla ett område och välj "Zooma hit".
/** @param {{[k: string]: any, liten?: (rad: any) => boolean}} val */
function _konScatterFigur({ df, dataKv, dataMa, isAll, colorBy, minAlder, maxAlder, statMedian, trendKv, trendMa, trendAlla = null, ciKv, ciMa, pol, beskrivning, liten = () => false }) {
    const punkt = (d, medKon) => ({ x: d.alder, y: d.lon, yrke: d.yrke, ...(isAll || medKon ? { bas: d.bas } : {}),
                                    ...(medKon ? { kon: d.kon.includes('kvinna') ? 'Kvinna' : 'Man' } : {}), ...(liten(d) ? { liten: true } : {}),
                                    markering: markeringFor(d.bas, d.yrke) });
    const punktlager = (serie, farg, rader, medKon) => ({ marke: 'punkt', serie, farg, storlek: 4, opacitet: 0.7, data: rader.map(d => punkt(d, medKon)), tips: _punktTips });
    const lager = [];
    const band = (serie, farg, ci) => { if (ci) lager.push({ marke: 'band', serie, farg, opacitet: 0.15, legend: false, data: ci.map(p => ({ x: p.x, lag: p.lo, hog: p.hi })) }); };
    band('Kvinna 95 % KI', PALETTE.kon.kvinna, ciKv);
    band('Man 95 % KI', PALETTE.kon.man, ciMa);
    if (colorBy === 'kon') {
        lager.push(punktlager('Kvinna', PALETTE.kon.kvinna, dataKv, false), punktlager('Man', PALETTE.kon.man, dataMa, false));
    } else {
        // Färglägg efter BAS eller yrkesgrupp (AID): vid 'aid' de åtta största, övriga som "Övrigt".
        const nyckel = d => (colorBy === 'bas' ? d.bas : d.yrke);
        const antal = {};
        df.forEach(d => { antal[nyckel(d)] = (antal[nyckel(d)] || 0) + 1; });
        const sorterade = Object.keys(antal).sort((a, b) => antal[b] - antal[a]);
        const topp = colorBy === 'aid' ? new Set(sorterade.slice(0, 8)) : new Set(sorterade);
        const grupper = new Map();
        df.forEach(d => { const k = topp.has(String(nyckel(d))) ? String(nyckel(d)) : 'Övrigt'; if (!grupper.has(k)) grupper.set(k, []); grupper.get(k).push(d); });
        [...grupper].forEach(([namn, rader], i) => lager.push(
            punktlager(colorBy === 'bas' ? `BAS-${namn}` : namn, PALETTE.serie[i % PALETTE.serie.length], rader, true)));
    }
    const trend = (serie, farg, reg) => { if (reg) lager.push(_vagratLinje(serie, farg, 0, minAlder, maxAlder, { tjocklek: 3, streck: colorBy === 'kon' ? 'hel' : 'streckad',
        data: [{ x: minAlder, y: reg.m * minAlder + reg.b }, { x: maxAlder, y: reg.m * maxAlder + reg.b }] })); };
    trend('Kvinna (trend)', PALETTE.kon.kvinna, trendKv);
    trend('Man (trend)', PALETTE.kon.man, trendMa);
    if (trendAlla) lager.push(_vagratLinje(`Hela urvalet (trend, R² = ${svTal(trendAlla.r2, 2)})`, PALETTE.semantic.trend, 0, minAlder, maxAlder, { tjocklek: 2, streck: 'streckad',
        data: [{ x: minAlder, y: trendAlla.m * minAlder + trendAlla.b }, { x: maxAlder, y: trendAlla.m * maxAlder + trendAlla.b }] }));
    if (statMedian != null) lager.push(_vagratLinje(`Median i ${plotNamn(jmfNamn('jämförelsestatistiken'))}`, PALETTE.serie[10], statMedian, minAlder, maxAlder, { streck: 'streckad' }));
    return { beskrivning, individer: true, x: { skala: 'linjar', titel: 'Ålder' }, y: { skala: 'linjar', titel: 'Månadslön', format: 'kr' }, lager,
        referens: pol ? [{ typ: 'zon', y0: pol.p10, y1: pol.p90, farg: PALETTE.semantic.neutral, opacitet: 0.15 },
                         { y: pol.med, streck: 'streckad', farg: PALETTE.semantic.neutral, tjocklek: 2 }] : [] };
}

// Lådagrammet per kön: ett lager, en kategori per kön som når tröskeln (null = könet redovisas inte).
function _konLadFigur({ lonKv, lonMa, beskrivning }) {
    const data = [...(lonKv || []).map(y => ({ x: 'Kvinna', y, farg: PALETTE.kon.kvinna })), ...(lonMa || []).map(y => ({ x: 'Man', y, farg: PALETTE.kon.man }))];
    return { beskrivning, legend: false, x: { skala: 'band', ordning: ['Kvinna', 'Man'] }, y: { skala: 'linjar', titel: 'Månadslön', format: 'kr' },
        lager: [{ marke: 'lada', serie: 'Lön', data,
                  tips: (d, s) => (s ? [[d.x], ['Median', _figTalformat(s.median, 'kr')], ['Kvartiler', `${_figTalformat(s.q1, 'kr', { enhet: false })}–${_figTalformat(s.q3, 'kr')}`], ['Antal', String(s.n)]]
                                     : [[d.x], ['Lön', _figTalformat(d.y, 'kr')]]) }] };
}

const konSel  = document.getElementById("bas-select-kon");
const demoSel = document.getElementById("bas-select-demo");
// Ett urval för hela fliken (ADR-41): väljaren i urvalsraden styr både lönedelen och
// åldersstrukturen. Väljaren i åldersdelen (bas-select-demo) är dold och finns för länkar som hoppar dit med ett BAS-intervall;
// de två hålls lika.
function _akValj(varde, kalla) {
    for (const sel of [konSel, demoSel]) {
        if (sel && sel !== kalla && [.../** @type {HTMLSelectElement} */ (sel).options].some(o => o.value === varde)) /** @type {HTMLInputElement} */ (sel).value = varde;
    }
    if (konSel) renderKon(/** @type {HTMLInputElement} */ (konSel).value);
    if (demoSel) renderDemografi(/** @type {HTMLInputElement} */ (demoSel).value);
}
if (konSel)  konSel.addEventListener("change",  e => _akValj(/** @type {HTMLInputElement} */ (e.target).value, konSel));
document.getElementById('kon-color-by')?.addEventListener('change', () => {
    const s = document.getElementById('bas-select-kon');
    if (s) renderKon(/** @type {HTMLInputElement} */ (s).value);
});
if (demoSel) demoSel.addEventListener("change", e => _akValj(/** @type {HTMLInputElement} */ (e.target).value, demoSel));

// ---- Demografi ----
const AGE_BRACKETS    = ['20–24','25–29','30–34','35–39','40–44','45–49','50–54','55–59','60–64','65+'];
const AGE_BRACKET_MIN = [20,25,30,35,40,45,50,55,60,65];
const AGE_BRACKET_MAX = [24,29,34,39,44,49,54,59,64,120];

// Sveriges sysselsatta befolkning per 5-årsåldersgrupp (procent av total).
// Källa: SCB Arbetskraftsundersökningen (AKU), genomsnitt 2023.
// Värdena är avrundade och ska tolkas som ungefärlig referens, inte exakta tal.
const SWEDISH_WORKING_POP_PCT = [
    9,   // 20–24
    12,  // 25–29
    13,  // 30–34
    13,  // 35–39
    12,  // 40–44
    12,  // 45–49
    11,  // 50–54
    10,  // 55–59
    6,   // 60–64
    2    // 65+
];

function countByBracket(data) {
    return AGE_BRACKET_MIN.map((lo, i) => data.filter(d => d.alder >= lo && d.alder <= AGE_BRACKET_MAX[i]).length);
}

// Åldersfördelning som kurva: andel av egen grupp per ålder, utjämnad med ett
// centrerat glidande medel (win = halva fönsterbredden). k-anonymitets-vänligt
// (inga 1-personstoppar). Returnerar { ages, share }.
function _ageShareCurve(rows, lo, hi, win) {
    const total = rows.length;
    const cnt = {};
    rows.forEach(r => { const a = Math.round(r.alder); cnt[a] = (cnt[a] || 0) + 1; });
    const ages = [], share = [];
    for (let a = lo; a <= hi; a++) {
        let s = 0, k = 0;
        for (let x = a - win; x <= a + win; x++) { s += (cnt[x] || 0); k++; }
        ages.push(a);
        share.push(total ? +((s / k) / total * 100).toFixed(2) : 0);
    }
    return { ages, share };
}
function renderDemografi(bas) {
    const isAll = bas === '__ALLA__' || !bas;
    const df = isAll
        ? getData().filter(d => d.alder > 0)
        : getData().filter(d => d.bas === bas && d.alder > 0);
    if (df.length < 2) return;
    const scopeShort = isAll ? 'urvalet' : `BAS-intervallet`;
    const basKv = df.filter(d => d.kon.includes('kvinna'));
    const basMa = df.filter(d => d.kon === 'man' || d.kon === 'män');
    const cntKv = countByBracket(basKv), cntMa = countByBracket(basMa);
    const n = df.length;
    // Referenslinjen visar Sveriges sysselsatta befolkning (SCB AKU)
    const refPct = SWEDISH_WORKING_POP_PCT.slice();
    // Organisationens egen åldersmedian som internt jämförelsemått (relevant endast för enskilt BAS)
    const orgAll = state.data.filter(d => d.alder > 0);
    const pctKv = cntKv.map(c => +(c/n*100).toFixed(1));
    const pctMa = cntMa.map(c => +(c/n*100).toFixed(1));
    // KPIs
    const ages = df.map(d => d.alder);
    const medianAge = Stat.median(ages);
    const orgMedian = Stat.median(orgAll.map(d => d.alder));
    // Successionszonen är 60+ (motsvarar riktålder 60–67); trösklarna följer den.
    const pct60p = +(df.filter(d => d.alder >= 60).length / n * 100).toFixed(1);
    const pctU40 = +(df.filter(d => d.alder < 40).length / n * 100).toFixed(1);
    const q25 = Math.round(Stat.quantile(ages, 0.25)), q75 = Math.round(Stat.quantile(ages, 0.75));
    const ageDiff = +(medianAge - orgMedian).toFixed(1);
    const ageEl = document.getElementById('demo-kpi-age');
    if (ageEl) {
        ageEl.textContent = `${svTal(medianAge, 0)} år`;
        ageEl.style.color = (!isAll && Math.abs(ageDiff) > 5) ? 'var(--danger)' : 'var(--text-main)';
    }
    const ageSubEl = document.getElementById('demo-kpi-age-sub');
    if (ageSubEl) {
        ageSubEl.textContent = isAll
            ? `${n} personer i organisationen`
            : `${ageDiff>=0?'+':''}${svTal(ageDiff, 1)} år mot organisationen (${svTal(orgMedian, 0)} år)`;
    }
    const senEl = document.getElementById('demo-kpi-senior');
    _laNyckel('nyckel-ak-struktur', `${svPct(pct60p, 1)} är 60 år eller äldre`, pct60p > 25);
    if (senEl) { senEl.textContent = svPct(pct60p, 1); senEl.style.color = pct60p>25?'var(--danger)':pct60p>15?FARG.varning:FARG.ok; }
    const junEl = document.getElementById('demo-kpi-junior');
    if (junEl) { junEl.textContent = svPct(pctU40, 1); junEl.style.color = pctU40<15?FARG.varning:'var(--text-main)'; }
    const iqrEl = document.getElementById('demo-kpi-iqr');
    if (iqrEl) iqrEl.textContent = `${q25}–${q75} år`;
    // Risk text
    const risks = [];
    if (pct60p > 25) risks.push(`<strong>Hög successionsrisk:</strong> ${svPct(pct60p, 1)} av ${scopeShort} är 60+ år. Aktiv planering för kompetensöverföring rekommenderas — riktålder 60–67 betyder att en betydande del kan avgå inom 0–7 år.`);
    else if (pct60p > 15) risks.push(`<strong>Bevakas – 60+:</strong> ${svPct(pct60p, 1)} i successionszon.`);
    if (pctU40 < 15) risks.push(`<strong>Brist på återväxt:</strong> Endast ${svPct(pctU40, 1)} är under 40 år.`);
    if (!isAll) {
        if (ageDiff > 5) risks.push(`Medelåldern är ${svTal(ageDiff, 1)} år <em>högre</em> än organisationssnittet.`);
        else if (ageDiff < -5) risks.push(`Medelåldern är ${svTal(Math.abs(ageDiff), 1)} år <em>lägre</em> än organisationssnittet.`);
    }
    const riskEl = document.getElementById('demo-risk-insight');
    if (riskEl) {
        if (risks.length === 0) { riskEl.style.display='none'; }
        else { riskEl.style.display='block'; riskEl.innerHTML=risks.join('<br>') + '<br><span class="text-dampad-sm">Hör till personalplaneringen, inte till lönekartläggningen.</span>'; riskEl.className=pct60p>25?'insight-box warning':'insight-box'; }
    }
    // Histogram
    ritaFigur('chart-demo-hist', _demoHistFigur({ pctKv, pctMa, refPct, isAll }), { hojd: 340 });
    if (document.getElementById('chart-demo-pyramid')) ritaFigur('chart-demo-pyramid', _demoPyramidFigur({ pctKv, pctMa, isAll }));
    // Åldersfördelning per kön och lönespridning över ålder. (Spridningsdiagrammet lön mot ålder ligger överst
    // i fliken; hela urvalets trend är ett valbart lager där.)
    const minA = Math.min(...ages), maxA = Math.max(...ages);
    const pol = isAll ? null : policyFor(null, bas);
    // Andel av eget kön per ålder, 5-årigt glidande medel (win=2)
    const aLo = Math.max(18, Math.floor(minA)), aHi = Math.min(67, Math.ceil(maxA));
    ritaFigur('chart-demo-agecurve', _demoAgecurveFigur(_ageShareCurve(basKv, aLo, aHi, 2), _ageShareCurve(basMa, aLo, aHi, 2), aHi), { hojd: 300 });
    // P10/median/P90 per femårsgrupp (en åldersgrupp under tröskeln ritas inte). Avsnittets nyckeltal är antalet grupper.
    { const f = _demoBandFigur(df, kTroskel(), pol, aLo, aHi);
      if (f) ritaFigur('chart-demo-spread', f, { hojd: 320 }); else rensaFigur('chart-demo-spread');
      _laNyckel('nyckel-ak-lon', f ? `${f.lager[2].data.length} femårsgrupper` : ''); }
}
// Noten när urvalet är under tröskeln: hela urvalets trendlinje utelämnas (punkterna per person följer sin egen regel).
function _demoTrendNot(n) { return `Trendlinje för hela urvalet visas inte: urvalet har ${n} personer, färre än ${kTroskel()}.`; }

// Åldershistogrammets figur (diagramkärnan, ADR-39): andel per åldersgrupp, staplad per kön, mot Sveriges sysselsatta.
// Raka etiketter, inte lutade; zonen markerar 60 år och äldre
// (successionszonen). Zonen har ingen etikett i bilden: kortets text förklarar den, och en etikett hamnar under exportknappen.
function _demoHistFigur({ pctKv, pctMa, refPct, isAll }) {
    const serie = (namn, farg, varden) => ({
        marke: 'stapel', lage: 'staplad', serie: namn, farg, opacitet: 0.85,
        data: AGE_BRACKETS.map((x, i) => ({ x, y: varden[i] })),
        tips: d => [[d.x], [namn, _figTalformat(d.y, 'pct')]]
    });
    const aldre = AGE_BRACKETS.filter(a => parseInt(a, 10) >= 60);
    return { beskrivning: 'Åldersfördelning i valt BAS-intervall jämfört med Sveriges sysselsatta befolkning. Nyckeltal i rutorna ovan.',
        x: { skala: 'band', titel: 'Åldersgrupp', ordning: AGE_BRACKETS.slice() },
        y: { skala: 'linjar', titel: isAll ? 'Andel av organisationen (%)' : 'Andel av BAS-intervall (%)' },
        referens: aldre.length ? [{ typ: 'zon', x0: aldre[0], x1: aldre[aldre.length - 1], farg: PALETTE.semantic.kritisk, opacitet: 0.07 }] : [],
        lager: [serie('Kvinna', PALETTE.kon.kvinna, pctKv), serie('Man', PALETTE.kon.man, pctMa),
            { marke: 'linje', serie: 'Sveriges sysselsatta (SCB AKU)', farg: PALETTE.semantic.referens, streck: 'prickad', punkter: true,
              data: AGE_BRACKETS.map((x, i) => ({ x, y: refPct[i] })),
              tips: d => [[d.x], ['Sveriges sysselsatta', _figTalformat(d.y, 'pct')]] }] };
}

// Ålderspyramiden: samma andelar som histogrammet ovanför, med kvinnor åt vänster och män åt höger och den äldsta
// åldersgruppen överst. Kvinnornas lager har negativa värden för att hamna till vänster och är märkt `absolut`.
function _demoPyramidFigur({ pctKv, pctMa, isAll }) {
    const grupper = AGE_BRACKETS.slice().reverse();
    const serie = (namn, farg, varden, tecken) => ({
        marke: 'stapel', lage: 'staplad', riktning: 'liggande', serie: namn, farg, opacitet: 0.85, ...(tecken < 0 ? { absolut: true } : {}),
        data: AGE_BRACKETS.map((y, i) => ({ y, x: tecken * varden[i] || 0, andel: varden[i] })),
        tips: d => [[d.y], [namn, _figTalformat(d.andel, 'pct')]]
    });
    const storst = Math.max(5, ...pctKv, ...pctMa);
    const grans = Math.ceil(storst * 1.1 / 5) * 5;
    return { beskrivning: `Ålderspyramid: andel av ${isAll ? 'organisationen' : 'BAS-intervallet'} per åldersgrupp, kvinnor åt vänster och män åt höger. Samma andelar som i diagrammet ovanför.`,
        y: { skala: 'band', titel: 'Åldersgrupp', ordning: grupper },
        x: { skala: 'linjar', titel: `Kvinnor åt vänster · andel av ${isAll ? 'organisationen' : 'BAS-intervallet'} (%) · Män åt höger`, format: 'pctAbs', doman: [-grans, grans], nollinje: true },
        hojd: Math.max(300, 70 + grupper.length * 24),
        lager: [serie('Kvinna', PALETTE.kon.kvinna, pctKv, -1), serie('Man', PALETTE.kon.man, pctMa, 1)] };
}

// Utjämnade kurvor ritas monotont: de går aldrig utanför värdena.
function _demoAgecurveFigur(kv, ma, aHi) {
    const kurva = (serie, farg, c, vilka) => ({ marke: 'linje', serie, farg, kurva: 'monoton', tjocklek: 2.5,
        data: c.ages.map((x, i) => ({ x, y: c.share[i] })), tips: d => [[`${d.x} år`], [serie, `${_figTalformat(d.y, 'pct')} av ${vilka}`]] });
    return { beskrivning: 'Åldersfördelning som kurva per kön: andel av det egna könet per ålder, 5-årigt glidande medel.',
        x: { skala: 'linjar', titel: 'Ålder' }, y: { skala: 'linjar', titel: 'Andel av könet (%)' },
        referens: aHi > 60 ? [{ typ: 'zon', x0: 60, x1: aHi, farg: PALETTE.semantic.kritisk, opacitet: 0.06 }] : [],
        lager: [kurva('Kvinna', PALETTE.kon.kvinna, kv, 'kvinnorna'), kurva('Man', PALETTE.kon.man, ma, 'männen')] };
}

// Lönespridning över ålder: lönen per femårsgrupp som median med två band —
// mittersta hälften (P25–P75) och P10–P90. En åldersgrupp under tröskeln ritas inte; bandet bryts där.
function _demoBandFigur(df, k, pol, aLo, aHi) {
    const grupper = new Map();
    for (const r of df) { const a = Number(r.alder), l = Number(r.lon); if (!isFinite(a) || !(l > 0)) continue; const g = Math.floor(a / 5) * 5; if (!grupper.has(g)) grupper.set(g, []); grupper.get(g).push(l); }
    const rader = [...grupper.entries()].sort((x, y) => x[0] - y[0]).filter(([, v]) => v.length >= k).map(([g, v]) => {
        const s = v.slice().sort((x, y) => x - y), q = p => Math.round(_libQuantile(s, p));
        return { x: g + 2.5, namn: `${g}–${g + 4} år`, n: s.length, p10: q(0.1), p25: q(0.25), p50: q(0.5), p75: q(0.75), p90: q(0.9) };
    });
    if (rader.length < 2) return null;
    const kr = v => `${_figTalformat(v, 'kr')}/mån`;
    const tips = d => [[d.namn], ['P90', kr(d.r.p90)], ['P75', kr(d.r.p75)], ['Median', kr(d.r.p50)], ['P25', kr(d.r.p25)], ['P10', kr(d.r.p10)], ['Antal', String(d.r.n)]];
    const band = (serie, lag, hog, opacitet) => ({ marke: 'band', serie, farg: PALETTE.serie[0], opacitet, data: rader.map(r => ({ x: r.x, lag: r[lag], hog: r[hog], namn: r.namn, r })), tips });
    return { beskrivning: `Lönespridning över ålder: medianlön per femårsgrupp, med band för mittersta hälften (P25–P75) och för P10–P90. Åldersgrupper med färre än ${k} personer visas inte.`,
        x: { skala: 'linjar', titel: 'Ålder (femårsgrupper)' }, y: { skala: 'linjar', titel: 'Kronor/månad', format: 'kr' },
        lager: [band('P10–P90', 'p10', 'p90', 0.16), band('Mittersta hälften (P25–P75)', 'p25', 'p75', 0.3),
                { marke: 'linje', serie: 'Median', farg: PALETTE.serie[0], tjocklek: 2.5, punkter: true, data: rader.map(r => ({ x: r.x, y: r.p50, namn: r.namn, r })), tips },
            ...(pol ? [_vagratLinje('Ställn. P10', colors.policy, pol.p10, aLo, aHi, { streck: 'streckad', tjocklek: 1 }),
                       _vagratLinje('Ställn. Median', colors.policy, pol.med, aLo, aHi, { streck: 'streckad', tjocklek: 1.5 }),
                       _vagratLinje('Ställn. P90', colors.policy, pol.p90, aLo, aHi, { streck: 'streckad', tjocklek: 1 })] : [])] };
}


// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson

/**
 * Huvudregression för "oförklarad löneskillnad" (EU 2023/970, Medlingsinstitutet).
 *
 * Modell: log(lön) ~ kön + ålder (centrerad) + BAS-intervall (indikatorvariabler).
 * Returnerar koefficienter med HC3-robusta standardfel + p-värden, R², och
 * en steg-för-steg dekomposition (gap utan kontroll → +BAS → +ålder) som
 * vattenfallsdiagrammet bygger på. Konverterar log-koefficienten till
 * approximativ kr-procentskillnad: gapPct = (exp(β) − 1) · 100.
 *
 * BAS kodas som en indikator per BAS-intervall utom det första (alfabetiskt lägsta) som är
 * referens: varje intervall får sin egen lönenivå, utan antagandet att varje bokstavssteg
 * är värt lika mycket. Ordningen A–J är ändå fast (se §5 i teknisk-plan.md) och styr
 * vilket intervall som blir referens.
 * @returns {{error?: string, errorCode?: string, [k: string]: any}} vid fel { error, errorCode } (ev. triedSteps, diagnostics);
 *   annars beta, se, p, R2, n, k, gapPct, decomposition m.fl. — se return-satsen.
 */
function runOLSRegression() {
    const raw = getData().filter(d => d.lon > 0 && d.alder > 0 && (d.kon.includes('kvinna') || d.kon === 'man' || d.kon === 'män'));
    if (raw.length < 30) return { error: 'För få observationer (n < 30) för meningsfull regressionsanalys.', errorCode: 'low_n' };

    const kvN = raw.filter(d => d.kon.includes('kvinna')).length;
    const maN = raw.filter(d => d.kon === 'man' || d.kon === 'män').length;
    if (kvN < 5 || maN < 5)
        return { error: `Otillräcklig könsbalans i urvalet: ${kvN} kvinnor, ${maN} män. Minst 5 av varje kön krävs.`, errorCode: 'imbalance' };

    const basList = [...new Set(raw.map(d => d.bas))].sort();
    // Indikatorvariabler: en kolumn per BAS-intervall utom det första, som är referens.
    const basRef = basList[0];
    const basInd = _basIndikatorer(basList);

    const ageMean = raw.reduce((s,d) => s + d.alder, 0) / raw.length;

    const y    = raw.map(d => Math.log(d.lon));
    const isKv = raw.map(d => d.kon.includes('kvinna') ? 1 : 0);
    const ageC = raw.map(d => d.alder - ageMean);
    const basD = raw.map(d => basInd.map(b => (d.bas === b ? 1 : 0)));

    const buildX = (incBas) => raw.map((d,i) => {
        const r = [1, isKv[i], ageC[i]];
        if (incBas) r.push(...basD[i]);
        return r;
    });

    const ladder = [
        { name:'full',    desc:'kön + ålder + BAS-intervall (indikatorer)', X: buildX(true)  },
        { name:'minimal', desc:'kön + ålder',                                X: buildX(false) }
    ];

    const triedSteps = [];
    /** @type {any} */
    let chosen = null;
    for (const step of ladder) {
        if (raw.length < step.X[0].length + 5) {
            triedSteps.push({ name: step.name, desc: step.desc, status: 'too_few', k: step.X[0].length });
            continue;
        }
        const fit = _fitOLS(step.X, y);
        if (!fit) {
            triedSteps.push({ name: step.name, desc: step.desc, status: 'singular', k: step.X[0].length });
            continue;
        }
        triedSteps.push({ name: step.name, desc: step.desc, status: 'ok', k: step.X[0].length });
        chosen = { ...fit, modelName: step.name, modelDesc: step.desc };
        break;
    }

    if (!chosen)
        return {
            error: 'Modellen kunde inte estimeras.',
            errorCode: 'all_failed',
            triedSteps,
            diagnostics: _diagnoseCollinearity(raw, basList)
        };

    // Kön-koefficient (index 1) – HC3 robusta standardfel
    const betaKon  = chosen.beta[1];
    const seKonR   = Math.sqrt(chosen.vcovHC3[1][1]);
    const seKonC   = Math.sqrt(chosen.vcovClassic[1][1]);
    const tStat    = betaKon / seKonR;
    const pValue   = _pValue2Sided(tStat, chosen.n, chosen.k);
    const pct      = (Math.exp(betaKon) - 1) * 100;
    // Halvbredden för 95 % KI: t-fördelningens kvantil vid df = n − k (1,96 först vid df ≥ 100)
    const tq       = _tQuantile(0.975, chosen.n - chosen.k);
    const pctLow   = (Math.exp(betaKon - tq*seKonR) - 1) * 100;
    const pctHigh  = (Math.exp(betaKon + tq*seKonR) - 1) * 100;
    const pctLowC  = (Math.exp(betaKon - tq*seKonC) - 1) * 100;
    const pctHighC = (Math.exp(betaKon + tq*seKonC) - 1) * 100;

    // Ålders-koefficient (index 2): % per år
    const betaAge   = chosen.beta[2];
    const seAge     = Math.sqrt(chosen.vcovHC3[2][2]);
    const ageEffect = (Math.exp(betaAge) - 1) * 100;
    const ageP      = _pValue2Sided(betaAge/seAge, chosen.n, chosen.k);

    // BAS-koefficienter (index 3..): lönenivå per BAS-intervall i procent mot referensintervallet
    // (om fullmodell). null när modellen föll tillbaka till kön + ålder.
    let basEffekter = null;
    if (chosen.modelName === 'full') {
        basEffekter = basInd.map((b, j) => {
            const idx = 3 + j;
            const beta = chosen.beta[idx];
            const se   = Math.sqrt(chosen.vcovHC3[idx][idx]);
            return {
                bas: b,
                pct: (Math.exp(beta) - 1) * 100,
                low: (Math.exp(beta - tq*se) - 1) * 100,
                high: (Math.exp(beta + tq*se) - 1) * 100,
                p: _pValue2Sided(beta/se, chosen.n, chosen.k)
            };
        });
    }

    // Sekventiell dekomponering
    // Ansvarssteget lyfts ut: det redovisas på en egen rad och påverkar inte huvudtalet.
    const allaSteg = _computeSequentialGap(raw, ageMean, basList);
    const ansvarSteg = allaSteg.find(s => s.name === '+ Ansvar') ?? null;
    // Yrkesgruppssteget (ADR-46) står sist i sequential och visas i kortet och budgeten, men
    // huvudtalet och den förklarade andelen räknas till och med + Ålder — samma modell som konPct.
    const yrkesSteg = allaSteg.find(s => s.name === '+ Yrkesgrupp') ?? null;
    const sequential = allaSteg.filter(s => s.name !== '+ Ansvar');
    const seqOk = sequential.filter(s => s.status === 'ok' && s.name !== '+ Yrkesgrupp');
    /** @type {number|null} */ let explainedShare = null;
    if (seqOk.length >= 2) {
        const first = Number(seqOk[0].gapPct);
        const last  = Number(seqOk[seqOk.length - 1].gapPct);
        if (Math.abs(first) > 0.1) {
            explainedShare = ((Math.abs(first) - Math.abs(last)) / Math.abs(first)) * 100;
        }
    }

    // Per-BAS conditional gap (separata regressioner inom varje BAS)
    const perBas = _computePerBasGap(raw, basList);

    const fellBackFromFull = chosen.modelName !== 'full';
    const diagnostics = fellBackFromFull ? _diagnoseCollinearity(raw, basList) : [];

    // Rått gap (median)
    const kv = raw.filter(d => d.kon.includes('kvinna'));
    const ma = raw.filter(d => d.kon === 'man' || d.kon === 'män');
    const medianKv = Stat.median(kv.map(d=>d.lon));
    const medianMa = Stat.median(ma.map(d=>d.lon));
    const rawGapPct = (medianKv / medianMa - 1) * 100;

    return {
        modelName: chosen.modelName,
        modelDesc: chosen.modelDesc,
        fellBackFromFull,
        triedSteps,
        diagnostics,
        n: chosen.n, k: chosen.k, ageMean,
        konPct: pct, konPctLow: pctLow, konPctHigh: pctHigh,
        konPctLowClassical: pctLowC, konPctHighClassical: pctHighC,
        seKonR, seKonC,
        tStat, pValue, tKvantil: tq,          // halvbredden för 95 % KI i enheter av SE
        ageEffect, ageP,
        basEffekter,                          // per BAS-intervall utom referensen: nivå mot referensen (null vid reservmodell)
        basRef,                               // referensintervallet (alfabetiskt första)
        basList,                              // alfabetiskt sorterad lista, för referens i UI
        R2: chosen.R2, adjR2: chosen.adjR2,
        rawGapPct,
        medianKv, medianMa,                   // underlag för kronor-omräkningen i UI
        sequential,
        ansvarSteg,
        yrkesSteg,
        explainedShare,
        perBas,
        nBas: basList.length,
        nKvAnalysed: kvN, nMaAnalysed: maN
    };
}

function _formatPValue(p) {
    if (p < 0.001) return 'p < 0,001';
    if (p < 0.01)  return 'p < 0,01';
    if (p < 0.05)  return 'p < 0,05';
    return 'p = ' + svTal(p, 3);
}

// Plain-text tolkning av p-värdet, används som tooltip
function _sigPlainText(p) {
    // p = sannolikheten att få en minst så stor skillnad OM det inte fanns någon
    // verklig skillnad — inte sannolikheten att resultatet "beror på slump".
    if (p < 0.001) return 'Extremt signifikant: om det inte fanns någon verklig skillnad skulle en så stor skillnad uppstå av slump i färre än 1 av 1 000 fall. Mycket starkt stöd för en verklig löneskillnad.';
    if (p < 0.01)  return 'Mycket signifikant: om det inte fanns någon verklig skillnad skulle en så stor skillnad uppstå av slump i färre än 1 av 100 fall. Starkt stöd för en verklig skillnad.';
    if (p < 0.05)  return 'Signifikant: om det inte fanns någon verklig skillnad skulle en så stor skillnad uppstå av slump i färre än 5 av 100 fall. Den vanliga tröskeln för en "statistiskt säkerställd" skillnad.';
    return `Ej signifikant (p=${svTal(p, 3)}): datat är förenligt med att ingen verklig skillnad finns. Observerad skillnad kan vara slumpvariation.`;
}

// ---- Pedagogik-hjälpare för den multivariata analysen -----------------------
// Rena funktioner (testbara) som översätter regressionens procenttal till något
// en läsare utan statistikbakgrund kan förhålla sig till.

/**
 * Översätter den oförklarade kön-effekten till kronor.
 *
 * Modellen är multiplikativ på log-skalan: kvinnas lön = mans lön × (1 + konPct/100).
 * Vi använder männens medianlön som referens och räknar ut vad modellen förutsäger
 * för en kvinna med SAMMA ålder och SAMMA BAS-placering. Skillnaden är den
 * oförklarade delen uttryckt i kronor.
 *
 * OBS: en storleksordning för att göra procenten begriplig — INTE en
 * åtgärdskostnad (den beräknas mot faktiska individlöner i Löneöversyn).
 * @returns {null|{refMan:number, refKvinna:number, krMonth:number, krYear:number, krTotalYear:number}}
 */
function _regressionKronor(r) {
    if (!r || typeof r.konPct !== 'number' || !isFinite(r.konPct) || !(r.medianMa > 0)) return null;
    const refMan = r.medianMa;
    const refKvinna = refMan * (1 + r.konPct / 100);
    const krMonth = refMan - refKvinna;          // > 0 när kvinnor ligger under
    return {
        refMan, refKvinna, krMonth,
        krYear: krMonth * 12,
        krTotalYear: krMonth * 12 * (r.nKvAnalysed || 0)
    };
}

/**
 * Ansvarsradens mening under förklaringsbudgeten, med tecken: fore = oförklarad skillnad efter
 * ålder och BAS, efter = med ansvaret inräknat (båda i procent, kvinnor mot män).
 */
function _ansvarRadText(fore, efter) {
    const sv = v => v.toFixed(2).replace('.', ',');
    const tkn = v => `${v >= 0 ? '+' : '−'}${sv(Math.abs(v))} %`;
    const namn = 'Ansvar (ledningsansvar, särskilt uppdrag)';
    if (fore !== 0 && efter !== 0 && Math.sign(fore) !== Math.sign(efter)) {
        return `<strong>${namn}: med ansvaret inräknat byter skillnaden riktning, från ${tkn(fore)} till ${tkn(efter)}.</strong>`;
    }
    const forklarat = Math.abs(fore) - Math.abs(efter);
    return forklarat >= 0
        ? `<strong>${namn} förklarar ytterligare ${sv(forklarat)} procentenheter</strong>; med ansvaret inräknat är den oförklarade skillnaden ${tkn(efter)} (före ${tkn(fore)}).`
        : `<strong>${namn} förklarar inget av skillnaden</strong> — med ansvaret inräknat blir den större, ${tkn(efter)} (före ${tkn(fore)}).`;
}

/**
 * Meningen under yrkesgruppssteget (ADR-46): vad talet är och vad det bygger på. Ren funktion, delas med
 * rapportmodellen.
 */
function _yrkesStegText(s) {
    const sv = v => v.toFixed(1).replace('.', ',');
    const tkn = v => `${v >= 0 ? '+' : '−'}${sv(Math.abs(v))} %`;
    return `<strong>${tkn(s.gapPct)}</strong> är löneskillnaden mellan kvinnor och män med samma yrkesgrupp, BAS-intervall och ålder `
        + `(fasta effekter för yrkesgrupp inom BAS). Bygger på ${s.nPersoner} personer i ${s.nGrupperBada} yrkesgrupper där båda könen finns`
        + (s.nEnkonade ? `; ${s.nEnkonade} enkönade grupper bidrar inte` : '')
        + `. Huvudtalet ovan räknar inte bort yrkesgruppen.`;
}

/**
 * Bygger "förklaringsbudgeten": hur många procentenheter av det ursprungliga
 * gapet som varje kontrollvariabel åt upp, och hur mycket som blir kvar.
 *
 * En kontroll kan göra gapet STÖRRE (negativt bidrag) — det betyder att den
 * strukturella faktorn dolde en del av skillnaden. Det flaggas separat i stället
 * för att ritas som en stapel.
 * @param {Array} seqOk - sequential-stegen med status 'ok'.
 * @returns {null|{g0:number, remaining:number, parts:Array, denom:number, anyNegative:boolean, remainingShare:number}}
 */
function _explanationBudget(seqOk) {
    if (!Array.isArray(seqOk) || seqOk.length < 2) return null;
    const by = {};
    seqOk.forEach(s => { if (typeof s.gapPct === 'number') by[s.name] = Math.abs(s.gapPct); });
    const g0 = by['Endast kön'];
    if (!(g0 > 0)) return null;
    const gBas = by['+ BAS-intervall'];
    const gAge = by['+ Ålder'];
    const gYrke = by['+ Yrkesgrupp'];
    const last = gYrke != null && gAge != null ? gYrke : gAge != null ? gAge : gBas;
    if (last == null) return null;

    const parts = [];
    if (gBas != null) parts.push({ key: 'bas', label: 'Förklaras av BAS-placering', val: g0 - gBas });
    if (gAge != null && gBas != null) parts.push({ key: 'alder', label: 'Förklaras av ålder', val: gBas - gAge });
    if (gYrke != null && gAge != null) parts.push({ key: 'yrke', label: 'Förklaras av yrkesgrupp inom BAS', val: gAge - gYrke });

    const anyNegative = parts.some(p => p.val < -0.005);
    const posSum = parts.reduce((s, p) => s + Math.max(0, p.val), 0);
    const denom = Math.max(0.01, posSum + last);
    parts.forEach(p => { p.share = (Math.max(0, p.val) / denom) * 100; });
    return { g0, remaining: last, parts, denom, anyNegative, remainingShare: (last / denom) * 100 };
}

/**
 * Per-BAS-diagram: det justerade (åldersrensade) gapet per BAS-intervall som
 * punkter med 95 % KI mot nollinjen. Tabellen finns kvar som a11y-alternativ.
 */
function _renderPerBasGapChart(perBas, bhQByBas) {
    const el = document.getElementById('chart-perbas-gap');
    if (!el) return;
    const ok = (perBas || []).filter(p => p.status === 'ok' && isFinite(p.gapPct));
    if (ok.length < 2) {
        rensaFigur(el);
        el.innerHTML = '<p class="text-dampad-sm marg-8-0">För få BAS-intervall med tillräcklig könsbalans för ett diagram — se tabellen nedan.</p>';
        return;
    }
    ritaFigur(el, _perBasFigur(ok.slice().sort((a, b) => a.gapPct - b.gapPct), bhQByBas));
}

// Figuren (diagramkärnan, ADR-39): en punkt med 95 % konfidensintervall mot nollinjen (inget oförklarat gap). Det som
// ska läsas är om intervallet når noll, och det syns direkt. Statusen är en serie med egen symbol — färgen bär den
// inte ensam (förbättring 7).
// `sorted` är bara BAS med status 'ok' (tillräcklig könsbalans); inga andra når figuren.
const _PERBAS_STATUS = [
    { serie: 'Säkerställt, över 5 %', farg: 'kritisk', symbol: 'romb' },
    { serie: 'Säkerställt', farg: 'varning', symbol: 'kvadrat' },
    { serie: 'Inte säkerställt', farg: 'neutral', symbol: 'cirkel' }
];
function _perBasDoman(sorted) {
    const lag = Math.min(0, ...sorted.map(p => Math.min(p.ciLow, p.gapPct))), hog = Math.max(0, ...sorted.map(p => Math.max(p.ciHigh, p.gapPct)));
    const luft = Math.max(0.5, (hog - lag) * 0.06);
    return [Math.floor((lag - luft) * 2) / 2, Math.ceil((hog + luft) * 2) / 2];
}
function _perBasFigur(sorted, bhQByBas) {
    const status = p => {
        const q = (bhQByBas || {})[p.bas];
        const sig = p.pValue < 0.05 && (q == null || q < 0.05);
        return _PERBAS_STATUS[sig && Math.abs(p.gapPct) > 5 ? 0 : sig ? 1 : 2];
    };
    const pkt = p => ({ y: 'BAS ' + p.bas, x: +p.gapPct.toFixed(2), fel: { lag: Math.min(p.ciLow, p.gapPct), hog: Math.max(p.ciHigh, p.gapPct) },
                        n: p.n, kvN: p.kvN, maN: p.maN, markering: markeringFor(p.bas) });
    const tips = d => [[d.y], ['Oförklarat gap', `${_figTalformat(d.x, 'tal2')} %`],
        ['95 % KI', `${_figTalformat(d.fel.lag, 'pct', { enhet: false })} – ${_figTalformat(d.fel.hog, 'pct')}`],
        ['Antal', `${d.n} (${d.kvN} kv / ${d.maN} mä)`]];
    return { beskrivning: 'Oförklarat lönegap per BAS-intervall med 95 % konfidensintervall. Samma siffror finns i tabellen under diagrammet.',
        // Noll ska ligga INOM axeln med luft på båda sidor, så att nollinjen syns också när alla gap har samma tecken.
        x: { skala: 'linjar', titel: 'Oförklarat gap (%) — negativt = kvinnor lägre', nollinje: true, doman: _perBasDoman(sorted) },
        y: { skala: 'band', ordning: sorted.map(p => 'BAS ' + p.bas) },
        hojd: Math.max(170, 104 + sorted.length * 30),
        lager: _PERBAS_STATUS.map(s => ({ marke: 'punkt', riktning: 'liggande', symbol: s.symbol, storlek: 6, serie: s.serie, farg: PALETTE.semantic[s.farg],
            data: sorted.filter(p => status(p) === s).map(pkt), tips }))
            .filter(l => l.data.length) };
}

// ---- Trappan: hur lönegapet förklaras steg för steg ----
// Visas bara när ALLA steg får visas. När det ojusterade steget utelämnas (ett kön under tröskeln, ADR-38 R1) ritas
// ingen trappa alls — en trappa som börjar på steg två skulle låta det utelämnade räknas fram.
function _regTrappaVisas(stegUt) {
    return !!stegUt && !stegUt.utelamnat && stegUt.steg.filter(s => s.status === 'ok').length >= 2 && stegUt.steg[0].status === 'ok';
}
const _REG_TRAPPSTEG = { '+ BAS-intervall': 'BAS-intervall', '+ Ålder': 'Ålder' };
/** @param {any[]} seqOk @param {any} [yrkesSteg] */
function _regTrappaFigur(seqOk, yrkesSteg = null) {
    const forst = seqOk[0], sist = seqOk[seqOk.length - 1];
    const yrke = yrkesSteg && yrkesSteg.status === 'ok' && typeof yrkesSteg.gapPct === 'number' ? yrkesSteg : null;
    const pct = v => `${v >= 0 ? '+' : '−'}${Math.abs(v).toFixed(1).replace('.', ',')} %`;
    const pp = v => `${v >= 0 ? '+' : '−'}${Math.abs(v).toFixed(1).replace('.', ',')} procentenheter`;
    const kategorier = ['Ojusterat gap', ...seqOk.slice(1).map(s => _REG_TRAPPSTEG[s.name] || s.name.replace(/^\+ /, '')), 'Oförklarat gap', ...(yrke ? ['Yrkesgrupp inom BAS'] : [])];
    // Varje förklaringssteg: från gapet före steget till gapet efter. Seriens blå när gapet krymper mot noll, orange när
    // det växer — inte grönt och gult: att ett gap FÖRKLARAS av ålder eller nivå är ingen bedömning av att det är bra.
    const steg = seqOk.slice(1).map((s, i) => {
        const fore = seqOk[i].gapPct, efter = s.gapPct;
        return { x: kategorier[i + 1], lag: Math.min(fore, efter), hog: Math.max(fore, efter), fore, efter, andring: efter - fore,
                 farg: Math.abs(efter) <= Math.abs(fore) ? PALETTE.serie[0] : PALETTE.serie[1] };
    });
    const niva = (x, v) => ({ x, y: +v.toFixed(2), etikett: pct(v) });
    return { beskrivning: `Hur lönegapet förklaras steg för steg: från det ojusterade gapet ${pct(forst.gapPct)} till det oförklarade ${pct(sist.gapPct)} när BAS-intervall och ålder räknas in.${yrke ? ` Räknas också yrkesgrupp inom BAS bort blir ${pct(yrke.gapPct)} kvar; det steget ingår inte i huvudtalet.` : ''} Negativt gap betyder att kvinnor har lägre lön. Samma tal står i förklaringsbudgeten.`,
        legend: false, hojd: 300,
        x: { skala: 'band', ordning: kategorier }, y: { skala: 'linjar', titel: 'Lönegap (%)', nollinje: true },
        lager: [
            { marke: 'stapel', lage: 'overlagrad', serie: 'Gap', farg: PALETTE.semantic.neutral, opacitet: 0.4,   // ljus, så att nivåns etikett går att läsa
              data: [{ x: 'Ojusterat gap', y: +forst.gapPct.toFixed(2) }, { x: 'Oförklarat gap', y: +sist.gapPct.toFixed(2) }],
              tips: d => [[d.x], ['Lönegap', pct(d.y)]] },
            { marke: 'intervall', serie: 'Förklaras av', tjocklek: 44, data: steg,
              tips: d => [[d.x], ['Ändrar gapet med', pp(d.andring)], ['Gap före', pct(d.fore)], ['Gap efter', pct(d.efter)]] },
            // Yrkesgruppssteget (ADR-46) efter huvudtalet, ljusare: det ingår inte i huvudtalet.
            ...(yrke ? [{ marke: 'intervall', serie: 'Yrkesgrupp inom BAS (ingår inte i huvudtalet)', tjocklek: 44, opacitet: 0.45,
              data: [{ x: 'Yrkesgrupp inom BAS', lag: Math.min(sist.gapPct, yrke.gapPct), hog: Math.max(sist.gapPct, yrke.gapPct), fore: sist.gapPct, efter: yrke.gapPct, andring: yrke.gapPct - sist.gapPct,
                       farg: Math.abs(yrke.gapPct) <= Math.abs(sist.gapPct) ? PALETTE.serie[0] : PALETTE.serie[1] }],
              tips: d => [[d.x], ['Ändrar gapet med', pp(d.andring)], ['Gap före', pct(d.fore)], ['Kvar efter yrkesgrupp', pct(d.efter)], ['Ingår inte i huvudtalet', '']] }] : []),
            // Nivån efter varje steg, med sitt värde: ett streck och en etikett.
            { marke: 'punkt', symbol: 'streck', serie: 'Gap efter steget', farg: PALETTE.semantic.mork, storlek: 11,
              data: [niva('Ojusterat gap', forst.gapPct), ...seqOk.slice(1).map((s, i) => niva(kategorier[i + 1], s.gapPct)), niva('Oförklarat gap', sist.gapPct),
                     ...(yrke ? [niva('Yrkesgrupp inom BAS', yrke.gapPct)] : [])] }
        ] };
}

// ---- Gapet längs lönefördelningen ----
// Kvantilregressionens tre skattningar (P10, median, P90): är strecket längst i toppen är gapet störst bland de
// högst betalda (glastak), längst i botten bland de lägst betalda (klistergolv). Samma tal som tabellen under.
/** @type {any[]|null} */
let _regKvantilSenast = null;
// Bootstrap-KI på könskoefficienten: B omsamplingar av raderna, percentilintervall, seedat ur datat (_rngFor) så
// att intervallet är detsamma varje gång. Över REG_KVANTIL_KI_MAX_N personer räknas inget intervall (tiden), och
// tabellen säger det. IRLS-skattningen (_quantileRegression) är en approximation av kvantillösningen; intervallet
// bootstrappar den approximationen, inte den exakta LP-lösningen.
const REG_KVANTIL_KI_B = 200, REG_KVANTIL_KI_MAX_N = 2000;
// Minne för senaste beräkning: kortet ritas om vid varje flikbyte, och bootstrappen är det dyra (uppmätt ~0,5 s
// på demodatat, ~11 s på 5 000 rader, därav gränsen 2 000 ≈ 4 s). Nyckeln är datats eget frö (antal och lönesummor per kön) plus ålderssumman.
/** @type {{nyckel: string, ut: any}|null} */
let _regKvantilMinne = null;
/**
 * Kvantilregressionens tre skattningar (runQuantileRegressionAtAllTau) med ett percentil-bootstrap-KI per τ.
 * Designmatrisen byggs som i runQuantileRegressionAtAllTau (kön, centrerad ålder, centrerad BAS-rang); raderna
 * omsamplas parvis (X-rad, y), och könskoefficienten är oberoende av centreringen, så omsamplingen centreras inte om.
 * @returns {null | {results: Array<{tau:number, konPct?:number, error?:boolean, ki?:{lag:number, hog:number}|null}>, n:number, kiB:number, kiUtelamnad:string}}
 */
function _regKvantilBerakna() {
    const qr = runQuantileRegressionAtAllTau();
    if (!qr) return null;
    const results = qr.results.map(r => ({ ...r, ki: null }));
    if (qr.n > REG_KVANTIL_KI_MAX_N) {
        return { results, n: qr.n, kiB: 0, kiUtelamnad: `Konfidensintervallet räknas inte vid fler än ${svTal(REG_KVANTIL_KI_MAX_N, 0)} personer (tiden för ${REG_KVANTIL_KI_B} omsamplingar).` };
    }
    const arKv = d => d.kon.includes('kvinna');
    const raw = getData().filter(d => d.lon > 0 && d.alder > 0 && (arKv(d) || d.kon === 'man' || d.kon === 'män'));
    const nyckel = `${_rngSeedFrom(raw.filter(arKv).map(d => d.lon), raw.filter(d => !arKv(d)).map(d => d.lon), raw.map(d => d.alder))}|${raw.length}|${results.map(r => r.konPct).join(',')}`;
    if (_regKvantilMinne && _regKvantilMinne.nyckel === nyckel) return _regKvantilMinne.ut;
    const ut = _regKvantilBootstrap(raw, results, arKv);
    _regKvantilMinne = { nyckel, ut: { ...ut, n: qr.n } };
    return _regKvantilMinne.ut;
}
function _regKvantilBootstrap(raw, results, arKv) {
    const basList = [...new Set(raw.map(d => d.bas))].sort();
    const rang = _lvBasRangFn(basList), basRank = {};
    basList.forEach(b => { basRank[b] = rang(b); });
    const basMean = basList.reduce((s, b) => s + basRank[b], 0) / basList.length;
    const ageMean = raw.reduce((s, d) => s + d.alder, 0) / raw.length;
    const X = raw.map(d => [1, arKv(d) ? 1 : 0, d.alder - ageMean, basRank[d.bas] - basMean]);
    const y = raw.map(d => Math.log(d.lon));
    const rnd = _rngFor(raw.filter(arKv).map(d => d.lon), raw.filter(d => !arKv(d)).map(d => d.lon));   // seedad ur datat → reproducerbart KI
    const n = raw.length, B = REG_KVANTIL_KI_B;
    const prov = results.map(() => []);
    for (let b = 0; b < B; b++) {
        const Xb = new Array(n), yb = new Array(n);
        for (let i = 0; i < n; i++) { const j = Math.floor(rnd() * n); Xb[i] = X[j]; yb[i] = y[j]; }
        results.forEach((r, k) => {
            if (r.error) return;
            const fit = _quantileRegression(Xb, yb, r.tau);
            if (fit) prov[k].push((Math.exp(fit.beta[1]) - 1) * 100);
        });
    }
    results.forEach((r, k) => {
        const v = prov[k].sort((a, c) => a - c);
        if (r.error || v.length < B / 2) return;
        r.ki = { lag: v[Math.floor(v.length * 0.025)], hog: v[Math.min(v.length - 1, Math.floor(v.length * 0.975))] };
    });
    return { results, kiB: B, kiUtelamnad: '' };
}
// Tre skattningar är ingen trend: en rad per del av lönefördelningen, med gapet som ett streck från
// nollinjen (inget gap) till värdet — axeln börjar i noll, så avstånden går att jämföra.
function _regKvantilFigur(resultat) {
    const namn = { 0.1: 'P10 (lägst betalda)', 0.5: 'Median', 0.9: 'P90 (högst betalda)' };
    const pct = v => `${v >= 0 ? '+' : '−'}${Math.abs(v).toFixed(1).replace('.', ',')} %`;
    const data = resultat.map(r => ({ y: namn[r.tau] || `P${Math.round(r.tau * 100)}`, x: +r.konPct.toFixed(2),
        ...(r.ki ? { fel: { lag: +r.ki.lag.toFixed(2), hog: +r.ki.hog.toFixed(2) } } : {}) }));
    const kanter = data.flatMap(d => d.fel ? [d.x, d.fel.lag, d.fel.hog] : [d.x]);
    const lag = Math.min(0, ...kanter), hog = Math.max(0, ...kanter), luft = Math.max(0.5, (hog - lag) * 0.12);
    const medKi = data.some(d => d.fel);
    return { beskrivning: 'Lönegapet i olika delar av lönefördelningen: vid P10, medianen och P90, efter kontroll för ålder och BAS-intervall, som avstånd från nollinjen. Negativt gap betyder att kvinnor har lägre lön.'
            + (medKi ? ' Strecket genom punkten är ett 95-procentigt bootstrap-konfidensintervall.' : ''),
        legend: false, y: { skala: 'band', ordning: data.map(d => d.y) }, x: { skala: 'linjar', titel: 'Lönegap (%) — negativt = kvinnor lägre', nollinje: true, doman: [lag - luft, hog + luft] },
        hojd: 200,
        lager: [{ marke: 'intervall', riktning: 'liggande', serie: 'Avstånd från noll', farg: PALETTE.serie[0], opacitet: 0.5, tjocklek: 3, data: data.map(d => ({ y: d.y, lag: Math.min(0, d.x), hog: Math.max(0, d.x) })) },
                { marke: 'punkt', serie: 'Lönegap', farg: PALETTE.serie[0], storlek: 6, etikettLage: 'vanster', data: data.map(d => ({ ...d, etikett: pct(d.x) })),
                  tips: d => [[d.y], ['Lönegap', pct(d.x)], ...(d.fel ? [['95 % KI (bootstrap)', `${pct(d.fel.lag)} till ${pct(d.fel.hog)}`]] : [])] }] };
}

function renderRegressionCard() {
    const wrap = document.getElementById('regression-card');
    if (!wrap) return;
    const r = runOLSRegression();

    // ----- Felfall: kunde inte estimeras alls -----
    if (r.error) {
        const tried = (r.triedSteps || []).map(s => {
            const sym = s.status === 'ok' ? ikon('bock', 14) : ikon('kryss', 14);
            const note = s.status === 'singular' ? 'multikollinearitet' : s.status === 'too_few' ? `för få obs (k=${s.k})` : '';
            return `<li><span class="typsnitt-mono">${sym}</span> <code>${esc(s.desc || s.name)}</code> <span class="text-dampad-sm">${note}</span></li>`;
        }).join('');
        const diag = (r.diagnostics || []).map(d => `<li>${d}</li>`).join('');
        wrap.innerHTML = `
            <div class="card ram-v-4-danger" role="region" aria-label="Regressionsanalys misslyckades">
                <h3 class="marg-0-0-8">Regressionen kunde inte genomföras</h3>
                <p class="marg-0-0-12">${esc(r.error)}</p>
                ${tried ? `<div class="mt-14"><div class="text-dampad-xs versal fw-600 marg-b-6">Försökta modellspecifikationer</div><ul class="lh-1_8 utan-punkter marg-0 pad-0">${tried}</ul></div>` : ''}
                ${diag ? `<div class="bak-varning-bg-gammal ram-v-3-danger rund-4 marg-t-14 pad-12-14"><strong>Identifierade orsaker:</strong><ul class="lh-1_6 marg-6-0-0-18">${diag}</ul></div>` : ''}
                <p class="text-dampad-sm marg-t-14">Tips: komplettera med fler observationer per yrkesgrupp.</p>
            </div>
        `;
        return;
    }

    // ----- Lyckad estimering -----
    const sig    = _formatPValue(r.pValue);
    const isSig  = r.pValue < 0.05;
    const sign   = r.konPct >= 0 ? '+' : '';

    // Verdikt – plain language slutsats
    let verdict;
    if (!isSig) {
        verdict = { cls:'ok',   icon: ikon('bock', 28), title:'Inget kvarstående gap',
                    sub:'När ålder och nivå räknats bort finns ingen skillnad som går att säkerställa. Det betyder inte att allt är perfekt — men datat ger inget stöd för ett generellt gap.' };
    } else if (Math.abs(r.konPct) > 5) {
        verdict = { cls:'crit', icon:ikon('nal', 28),  title:'Här bör ni titta närmare',
                    sub:'Skillnaden är större än 5 procent och finns kvar även när ålder och nivå räknats bort. Gå igenom grupperna nedan, väg varje skillnad mot sakliga skäl och ta upp frågan med facket.' };
    } else {
        verdict = { cls:'warn', icon:ikon('oga', 28),  title:'Skriv ner varför',
                    sub:'Det finns en skillnad som inte är slump, men den är mindre än 5 procent. Dokumentera vad den beror på så att ni kan visa det vid nästa kartläggning.' };
    }
    const verdictFarg = verdict.cls === 'crit' ? 'kritisk' : verdict.cls === 'warn' ? 'varning' : 'ok';

    // Modell-banner (om fallback)
    const modelBanner = r.fellBackFromFull
        ? `<div class="bak-varning-bg ram-v-3-varning rund-4 fs-sm marg-b-12 pad-10-14">
              <strong>Notering:</strong> Fullmodellen kunde inte estimeras (multikollinearitet). Föll tillbaka till <code>${esc(r.modelDesc)}</code>.
              ${r.diagnostics.length ? `<details class="marg-t-6" open><summary class="pekare">Visa orsak</summary><ul class="lh-1_6 marg-6-0-0-18">${r.diagnostics.map(d => `<li>${d}</li>`).join('')}</ul></details>` : ''}
           </div>`
        : '';

    // Bidragsuppdelning (visuell waterfall) — visar hur gapet krymper när kontroller läggs till
    // Första steget ("Endast kön") och det som räknas ur det följer tröskeln (ADR-12); se _regStegForRedovisning.
    const stegUt = _regStegForRedovisning(r);
    // Trappan, budgetens "kvarstår" och ansvarsraden utgår från stegen till och med + Ålder (huvudtalet);
    // yrkesgruppssteget läggs till där det visas (ADR-46).
    const seqOk = stegUt.steg.filter(s => s.status === 'ok' && s.name !== '+ Yrkesgrupp');
    const stepDescription = {
        'Endast kön':       'Endast kön (utan strukturell kontroll)',
        '+ BAS-intervall':  'Efter kontroll för BAS-intervall',
        '+ Ålder':          'Efter kontroll för BAS-intervall och ålder (full modell)',
        '+ Yrkesgrupp':     'Efter kontroll även för yrkesgrupp inom BAS'
    };
    const stepTransition = {
        '+ BAS-intervall':  'rensar bort effekten av att kvinnor och män är olika fördelade över BAS-intervallen',
        '+ Ålder':          'rensar dessutom bort effekten av att kvinnor och män har olika åldersfördelning',
        '+ Yrkesgrupp':     'rensar dessutom bort löneskillnader mellan yrkesgrupper inom samma BAS-intervall'
    };
    let waterfallHtml = '';
    // Staplarnas bredd räknas mot de steg som visas: annars kunde ett utelämnat steg räknas fram ur bredden.
    // Yrkesgruppssteget (ADR-46) ritas efter huvudtalet, som en rad till — huvudtalet är steget + Ålder.
    const yrkeVisas = r.yrkesSteg?.status === 'ok' && seqOk.some(s => s.name === '+ Ålder');
    const stegIKortet = yrkeVisas ? [...seqOk, r.yrkesSteg] : seqOk;
    if (seqOk.length >= (stegUt.utelamnat ? 1 : 2)) {
        const maxAbs = Math.max(...stegIKortet.map(s => Math.abs(s.gapPct)), 0.01);
        stegIKortet.forEach((s, idx) => {
            const isLast = idx === seqOk.length - 1;
            const isYrke = s.name === '+ Yrkesgrupp';
            const desc = stepDescription[s.name] || s.name;
            const trans = stepTransition[s.name];
            const widthPct = (Math.abs(s.gapPct) / maxAbs) * 100;
            const sgnW = s.gapPct >= 0 ? '+' : '−';
            const absVal = svTal(Math.abs(s.gapPct), 2);
            const stepClass = isLast ? `step-final ${verdict.cls}` : isYrke ? 'step-intermediate step-yrke' : 'step-intermediate';
            if (idx > 0 && trans) {
                waterfallHtml += `<div class="reg-waterfall-arrow">${ikon('pilNed', 14)} ${esc(trans)}</div>`;
            }
            waterfallHtml += `
                <div class="reg-waterfall-step ${stepClass}">
                    <div class="step-name">${esc(desc)}${isLast ? ' <strong>kvarstår oförklarat</strong>' : ''}</div>
                    <div class="step-bar-row">
                        <div class="step-bar-bg"><div class="step-bar-fill" data-stil-bredd="${widthPct.toFixed(1)}%"></div></div>
                        <div class="step-value">${sgnW}${absVal}%</div>
                    </div>
                    ${isYrke ? `<p class="step-note">${_yrkesStegText(s)}</p>` : ''}
                </div>
            `;
        });
    }
    // Slutsatsen räknar till och med + Ålder (huvudtalet). Har budgeten ett yrkesgruppssteg sägs också vad som blir
    // kvar med det inräknat — annars står två olika "kvarstår" i samma block (30 % här, 15 % i budgeten).
    const explainedRowHtml = budget => stegUt.explainedShare !== null
        ? `<div class="bak-info-bg ram-v-3-info rund-4 fs-sm lh-1_55 marg-t-10 pad-10-14">
            <strong>Slutsats:</strong> ${svPct(stegUt.explainedShare, 0)} av det råa lönegapet förklaras av åldersfördelning och BAS-placering; <strong>${svPct((100-stegUt.explainedShare), 0)}</strong> blir kvar som huvudtalets oförklarade skillnad.${budget && budget.parts.some(p => p.key === 'yrke') ? ` Räknas också yrkesgrupp inom BAS bort blir ${svPct(budget.remainingShare, 0)} kvar (steget + Yrkesgrupp, som inte ingår i huvudtalet).` : ''} Det oförklarade är det som <em>inte</em> kan tillskrivas dessa faktorer och som lönekartläggningen ska granska närmare.
           </div>`
        : '';

    // ---- Pedagogik: kronor, konkret exempel, stående reservation, budget ----
    const krFmt = v => Math.round(v).toLocaleString('sv-SE') + ' kr';
    // Kronexemplet utgår från männens medianlön — ett könsuppdelat mått som följer tröskeln (ADR-12),
    // även när regressionen själv får köras (fast golv, ADR-38).
    const konOk = _konFarRedovisas(r.nKvAnalysed, r.nMaAnalysed);
    const kr = konOk ? _regressionKronor(r) : null;
    // Budgeten utgår från första steget och visar skillnaderna mellan stegen: utelämnas med det.
    const budget = stegUt.utelamnat ? null : _explanationBudget(yrkeVisas ? stegIKortet : seqOk);

    // Stående reservation. Den farligaste feltolkningen av "oförklarat" är att
    // läsa det som "osakligt"/diskriminering — därför står den intill siffran,
    // inte bara i ordlistan.
    const caveatInline = `
        <p class="reg-caveat-inline" role="note"><strong>Kom ihåg:</strong> <em>oförklarat</em> betyder att skillnaden
        inte fångas upp av ålder och BAS-placering — <strong>inte</strong> att den beror på kön eller är osaklig.
        Det är en signal om var ni bör titta närmare, inte ett bevis.</p>`;

    // Så fungerar regressionen: tre steg i vardagsspråk, vad som räknas bort och inte, och vilket tal som används
    // till vad. Hjälptext (data-hjalptext), så att vakttestet för fackuttryck inte läser den som gränssnitt.
    const harAnsvar = r.ansvarSteg?.status === 'ok';
    const saFunkarHtml = `
        <details class="reg-sa-funkar marg-b-12" data-hjalptext open>
            <summary class="pekare fw-600 pad-8-0 ej-markerbar">Så fungerar regressionen — i tre steg</summary>
            <div class="bak-yta rund-6 fs-sm lh-1_6 marg-t-8 pad-14-16">
                <ol class="marg-0-0-10-22 pad-0">
                    <li><strong>Lönen räknas i procent, inte i kronor.</strong> Modellen arbetar med logaritmen av månadslönen, så att en skillnad betyder samma sak i BAS A som i BAS E: fem procent är fem procent.</li>
                    <li><strong>Varje person jämförs med dem som liknar personen.</strong> Modellen söker den lönenivå som bäst beskriver alla ${svTal(r.n, 0)} personer utifrån tre saker på en gång: kön, ålder och BAS-intervall. Den svarar på frågan: hur mycket skiljer lönen mellan en kvinna och en man <em>i samma BAS-intervall och samma ålder</em>?</li>
                    <li><strong>Svaret är ett tal med ett spann.</strong> Huvudtalet (${sign}${svPct(r.konPct, 1)}) är den skillnaden i genomsnitt över hela underlaget. Spannet säger hur säker skattningen är, och p-värdet om skillnaden går att skilja från slumpen.</li>
                </ol>
                <p class="marg-0-0-6"><strong>Räknas bort:</strong> ålder och BAS-intervall${r.yrkesSteg?.status === 'ok' ? ', och yrkesgrupp inom BAS i ett eget steg nedan' : ''}. <strong>Räknas inte bort:</strong> ${harAnsvar ? 'ansvar (står på en egen rad), ' : ''}anställningstid, utbildning, deltid, prestation och marknadsläge — sådant som kan vara sakliga skäl men som lönefilen inte innehåller.</p>
                <p class="marg-0-0-6"><strong>Så läser du kortet:</strong> huvudtalet överst är det som går in i rapporten. <em>Steg för steg</em> visar vad ålder och nivå förklarar, <em>per BAS-intervall</em> var skillnaden finns, och <em>lönefördelningen</em> om den är störst bland lågt eller högt betalda. Ordlistan förklarar begreppen.</p>
                <p class="marg-0 text-dampad-sm"><strong>Två råa gap:</strong> rutan överst räknar det råa gapet på medianlönen, som direktivets tröskel gör; trappans första steg räknar det i modellens procentskala (genomsnitt av logaritmerad lön). Talen skiljer sig något när lönefördelningen är skev. Båda är riktiga: medianen för direktivet, modellens för uppdelningen.</p>
            </div>
        </details>`;

    const kronorHtml = !konOk ? `<p class="k-mask-note">Skillnaden räknas inte om till kronor: exemplet utgår från männens medianlön, och ett av könen har färre än ${kTroskel()} personer i modellen.</p>` : kr ? `
        <div class="reg-kronor" role="region" aria-label="Lönegapet uttryckt i kronor">
            <div class="reg-kronor-head">Vad betyder ${svPct(Math.abs(r.konPct), 1)} i kronor?
                ${isSig && kr.krMonth < 0 ? '<span class="farg-dampad fw-400">(här ligger kvinnorna över männen)</span>' : ''}</div>
            ${isSig ? `
            <div class="reg-kronor-grid">
                <div class="rk-tile"><div class="rk-val">${krFmt(Math.abs(kr.krMonth))}</div><div class="rk-lbl">per kvinna och månad</div></div>
                <div class="rk-tile"><div class="rk-val">${krFmt(Math.abs(kr.krYear))}</div><div class="rk-lbl">per kvinna och år</div></div>
                <div class="rk-tile"><div class="rk-val">${krFmt(Math.abs(kr.krTotalYear))}</div><div class="rk-lbl">för alla ${r.nKvAnalysed} kvinnor i underlaget, per år</div></div>
            </div>
            <p class="rk-example"><strong>Konkret:</strong> en man med medianlön tjänar <strong>${krFmt(kr.refMan)}</strong>/mån.
            En kvinna <em>i samma ålder och samma BAS-intervall</em> förutsägs enligt modellen tjäna
            <strong>${krFmt(kr.refKvinna)}</strong>/mån — alltså <strong>${krFmt(Math.abs(kr.krMonth))}</strong>
            ${kr.krMonth >= 0 ? 'mindre' : 'mer'} i månaden.</p>
            <p class="rk-caveat">Räknat med medianlönen som referens. Detta är en <strong>storleksordning</strong> för att göra
            procenttalet begripligt — inte en åtgärdskostnad. Faktisk kostnad räknas mot individlöner i fliken <em>Löneöversyn</em>.</p>
            ` : `
            <p class="rk-example">Skillnaden är <strong>inte statistiskt säkerställd</strong>. En kronsiffra skulle vara
            missvisande här — det observerade gapet är förenligt med slumpmässig variation.</p>`}
        </div>` : '';

    // Ansvaret (ansvarskod) redovisas på en egen rad under budgeten, inte i den: budgetens
    // "kvarstår" är huvudtalet, som inte räknar bort ansvaret (ADR-33).
    let ansvarHtml = '';
    const sistaSteg = seqOk[seqOk.length - 1];
    if (r.ansvarSteg?.status === 'ok' && sistaSteg?.name === '+ Ålder') {
        ansvarHtml = `<p class="reg-ansvar">${_ansvarRadText(sistaSteg.gapPct, r.ansvarSteg.gapPct)}
            Ansvar är ett tänkbart sakligt skäl — om det är det avgör ni. Huvudtalet ovan räknar inte bort ansvaret.</p>`;
    }

    let budgetHtml = '';
    if (budget) {
        const segs = budget.parts
            .filter(p => p.share > 0.05)
            .map(p => `<div class="rb-seg rb-${p.key}" data-stil-bredd="${p.share.toFixed(1)}%" title="${esc(p.label)}: ${svTal(p.val, 2)} procentenheter"></div>`)
            .join('');
        const legend = budget.parts.map(p => `
            <li><span class="rb-key rb-${p.key}"></span>${esc(p.label)}:
                <strong>${p.val < 0 ? '−' : ''}${svTal(Math.abs(p.val), 2)} procentenheter</strong>
                <span class="f-dampad">(${svPct((Math.max(0, p.val) / budget.denom * 100), 0)} av gapet)</span></li>`).join('');
        budgetHtml = `
            <div class="reg-budget">
                <div class="reg-budget-title">Av det ursprungliga gapet på <strong>${svTal(budget.g0, 2)} procentenheter</strong> —
                    vad "åt upp" varje förklaring?</div>
                <div class="reg-budget-bar" role="img" aria-label="Staplad fördelning: hur stor del av lönegapet som förklaras av BAS-placering, ålder och yrkesgrupp inom BAS, och hur mycket som kvarstår. Samma siffror står i listan under.">
                    ${segs}<div class="rb-seg rb-kvar" data-stil-bredd="${budget.remainingShare.toFixed(1)}%" title="Kvarstår oförklarat"></div>
                </div>
                <ul class="reg-budget-legend">
                    ${legend}
                    <li><span class="rb-key rb-kvar"></span><strong>Kvarstår oförklarat: ${svTal(budget.remaining, 2)} procentenheter</strong>
                        <span class="f-dampad">(${svPct(budget.remainingShare, 0)} av gapet)</span></li>
                </ul>
                ${budget.parts.some(p => p.key === 'yrke') ? `<p class="rb-note">Yrkesgrupp inom BAS räknas in i budgeten, inte i huvudtalet ovan: det som kvarstår här är skillnaden mellan kvinnor och män med samma yrkesgrupp, BAS-intervall och ålder.</p>` : ''}
                ${budget.anyNegative ? `<p class="rb-note">${ikon('statusVarning')} En kontrollvariabel <em>ökade</em> gapet i stället för att förklara det.
                    Det betyder att den strukturella faktorn <strong>dolde</strong> en del av skillnaden — utan den kontrollen
                    såg läget bättre ut än det är.</p>` : ''}
            </div>`;
    }

    // Per-BAS conditional gap-tabell
    // Multipel jämförelse-korrigering (Benjamini-Hochberg FDR)
    // Vid 20+ per-BAS-tester förväntas ~1 falskt positivt per α=0.05-batch
    // av ren slump. BH-FDR skyddar mot detta utan att vara så strikt som
    // Bonferroni. Logik:
    //   1. Samla alla p-värden från OK-tester
    //   2. Sortera stigande
    //   3. q[i] = min(1, p[i] * m / rank)
    //   4. Tvinga monotonicitet bakifrån: q[i] = min(q[i], q[i+1], ...)
    const okTests = (r.perBas || []).filter(p => p.status === 'ok' && isFinite(p.pValue));
    const bhQByBas = {};
    if (okTests.length > 1) {
        const sorted = [...okTests].sort((a, b) => a.pValue - b.pValue);
        const m = sorted.length;
        // Steg 1: rå BH-justering
        const qRaw = sorted.map((t, i) => Math.min(1, t.pValue * m / (i + 1)));
        // Steg 2: tvinga monotonicitet (q ska inte minska med stigande rank)
        for (let i = m - 2; i >= 0; i--) {
            qRaw[i] = Math.min(qRaw[i], qRaw[i + 1]);
        }
        sorted.forEach((t, i) => { bhQByBas[t.bas] = qRaw[i]; });
    }

    // Bevis-knapp per BAS-rad. Bevis-payload
    // beräknas vid klick (inte i förväg) för att minska minne — pekar bara
    // på bas-namnet och slår upp i r.perBas + bhQByBas vid behov.
    const allM = (r.perBas || []).filter(p => p.status === 'ok' && isFinite(p.pValue)).length;
    const perBasRows = (r.perBas || []).map(p => {
        if (p.status !== 'ok') {
            const note = p.status === 'too_few' ? `För få: ${p.kvN} kvinnor, ${p.maN} män (kräver minst ${statGolv()} av varje kön)` : 'Singulär';
            return `<tr><td>${esc(p.bas)}</td><td class="t-hoger">${p.n}</td><td class="t-mitt">${p.kvN}/${p.maN}</td>`
                + `<td class="farg-dampad kursiv">${note}</td>`
                + `<td class="t-mitt f-dampad">Går ej att bedöma</td>`
                + `<td class="col-stat t-mitt f-dampad">—</td>`
                + `<td class="col-stat t-mitt f-dampad">—</td>`
                + `<td class="t-mitt"><button class="btn-evidence" data-bas-evidence="${esc(p.bas)}" type="button" title="Visa varför denna BAS inte kunde analyseras" aria-label="Visa bevis för BAS ${esc(p.bas)}">${ikon('sok')}</button></td></tr>`;
        }
        const sgn = p.gapPct >= 0 ? '+' : '';
        const q = bhQByBas[p.bas];  // undefined om bara 1 test → ingen korrigering
        // Flagga: kräver att BÅDE rå p OCH justerat q < 0.05. Skyddar mot falska positiv.
        const sigAfterCorrection = p.pValue < 0.05 && (q == null || q < 0.05);
        const flag = sigAfterCorrection && Math.abs(p.gapPct) > 5 ? ikon('nal')
                   : sigAfterCorrection                          ? ikon('oga')
                   : p.pValue < 0.05 && q >= 0.05                ? ikon('statusVarning') + ' <span class="text-dampad-xs">(ej efter korr.)</span>'
                   : '';
        const cellKlass = sigAfterCorrection && Math.abs(p.gapPct) > 5 ? ' f-kritisk fet' : '';
        const qCell = q != null ? _formatPValue(q) : '<span class="f-dampad">—</span>';
        // Klarspråkssignal — samma logik som flaggorna, men i ord i stället för p/q.
        const signal = sigAfterCorrection && Math.abs(p.gapPct) > 5
                ? { txt: ikon('statusKritisk') + ' Titta närmare', title: 'Statistiskt säkerställd även efter korrigering OCH över 5 % — här aktualiseras EU-direktivets utredningssteg.' }
            : sigAfterCorrection
                ? { txt: ikon('statusVarning') + ' Dokumentera',  title: 'Statistiskt säkerställd efter korrigering, men under 5 %. Dokumentera sakliga skäl och följ upp.' }
            : (p.pValue < 0.05)
                ? { txt: ikon('statusOsaker') + ' Osäkert utslag', title: 'Ser signifikant ut i råa p-värdet men håller inte efter korrigering för multipel jämförelse. Presentera inte som säkerställt.' }
                : { txt: ikon('statusIngen') + ' Inget utslag',  title: 'Ingen statistiskt säkerställd oförklarad skillnad i detta BAS-intervall.' };
        return `<tr><td>${esc(p.bas)}</td><td class="t-hoger">${p.n}</td><td class="t-mitt">${p.kvN}/${p.maN}</td>`
            + `<td class="t-tal${cellKlass}" data-sort-value="${p.gapPct}">${sgn}${svPct(p.gapPct, 1)}</td>`
            + `<td class="ta-mitt ingen-radbrytning" title="${esc(signal.title)}">${signal.txt}</td>`
            + `<td class="col-stat tabelltal ta-mitt">${_formatPValue(p.pValue)}</td>`
            + `<td class="col-stat tabelltal ta-mitt">${qCell} ${flag}</td>`
            + `<td class="t-mitt"><button class="btn-evidence" data-bas-evidence="${esc(p.bas)}" type="button" title="Visa beräkningen bakom denna BAS-rad" aria-label="Visa bevis för BAS ${esc(p.bas)}">${ikon('sok')}</button></td></tr>`;
    }).join('');

    // Försökta steg (för teknisk spec)
    const triedRow = r.triedSteps.map(s => {
        const sym = s.status === 'ok' ? `<span class="farg-ok">${ikon('bock', 14)}</span>` : `<span class="f-dampad">${ikon('kryss', 14)}</span>`;
        const note = s.status === 'singular' ? ' (multikollinearitet)' : s.status === 'too_few' ? ' (för få obs)' : '';
        return `${sym} <code class="fs-xs">${esc(s.desc)}</code><span class="text-dampad-xs">${note}</span>`;
    }).join(' &nbsp;|&nbsp; ');

    // Tolkning – plain language sammanfattning
    // #10 Lägg till bootstrap-CI på det råa lönegapet där det nämns
    const rawCIsuffix = state.bootstrapCI ? fmtCI(state.bootstrapCI.gapPct) : '';
    const tolkning = isSig
        ? (Math.abs(r.konPct) > 5
            ? `Enligt modellen tjänar kvinnor <strong class="f-kritisk">${svPct(Math.abs(r.konPct), 1)} mindre</strong> än män med samma ålder och samma BAS-intervall, alltså även efter att skillnader i ålder och BAS-placering räknats bort. Detta är <em>oförklarad</em> löneskillnad — den kan <strong>inte</strong> motiveras med att kvinnor är yngre eller arbetar i andra BAS-intervall. Eftersom skillnaden överstiger 5 % och är statistiskt säkerställd aktualiseras EU-direktivets (2023/970) utredningssteg — väg skillnaden mot sakliga skäl.`
            : `Det finns en statistiskt säkerställd oförklarad löneskillnad på ${svPct(Math.abs(r.konPct), 1)}, men den är under 5%-tröskeln. Bör dokumenteras med sakliga skäl och följas upp över tid.`)
        : `<strong>Det råa lönegapet (${_raGapText(r, v => svPct(v, 1) + rawCIsuffix)})</strong> försvinner när vi kontrollerar för att kvinnor och män har olika åldersfördelning och olika BAS-placering. Återstående skillnad (${sign}${svPct(r.konPct, 1)}) är statistiskt obetydlig — datat är förenligt med att ingen verklig oförklarad skillnad finns.`;

    // #5 Statistisk transparens: flagga när underlaget gör skattningen
    // osäker — så HR inte övertolkar ett punktvärde som bygger på tunt data.
    // Tröskelvärdena är vedertagna tumregler (ej lagstadgade): n<50 = litet
    // urval; <15 obs/parameter = överanpassningsrisk; KI-bredd >10 p.e. =
    // instabil punktskattning; <10 av ena könet = svag könskontrast.
    const _obsPerParam = r.n / Math.max(1, r.k);
    const _ciWidth = (r.konPctHigh != null && r.konPctLow != null) ? (r.konPctHigh - r.konPctLow) : null;
    const _minKon = Math.min(r.nKvAnalysed, r.nMaAnalysed);
    const _relFlags = [];
    if (r.n < 50)
        _relFlags.push(`<strong>Litet urval (n=${r.n}).</strong> Skattningen har låg statistisk styrka — även en reell skillnad kan bli "ej signifikant", och punktvärdet svänger lätt med enstaka individer.`);
    if (_obsPerParam < 15)
        _relFlags.push(`<strong>Få observationer per modellparameter (${svTal(_obsPerParam, 0)} st på ${r.k} parametrar).</strong> Med många BAS-intervall relativt urvalet blir koefficienterna instabila (överanpassningsrisk). Överväg att slå ihop sällan förekommande BAS eller analysera en delmängd.`);
    if (_ciWidth != null && _ciWidth > 10)
        _relFlags.push(`<strong>Brett konfidensintervall (${svTal(r.konPctLow, 1)}–${svPct(r.konPctHigh, 1)}, bredd ${svTal(_ciWidth, 1)} p.e.).</strong> Det "verkliga" oförklarade gapet kan ligga var som helst i ett brett spann — låt inte punktvärdet ensamt avgöra en åtgärd.`);
    if (_minKon < 10)
        _relFlags.push(`<strong>Svag könskontrast (${r.nKvAnalysed} kvinnor / ${r.nMaAnalysed} män i modellen).</strong> När det ena könet är fåtaligt blir kön-koefficienten känslig för enskilda löner.`);
    const reliabilityHtml = _relFlags.length ? `
        <div class="notis-varning fs-sm lh-1_55 marg-b-12 pad-10-14" role="note">
            <strong>Tolka resultatet med försiktighet — underlaget är begränsat</strong>
            <ul class="marg-6-0-0-18 pad-0">${_relFlags.map(f => `<li class="marg-b-4">${f}</li>`).join('')}</ul>
            <p class="farg-dampad marg-8-0-0">Resultatet kan fortfarande användas som underlag, men väg in osäkerheten i bedömningen och komplettera med den deskriptiva per-BAS-analysen och en kvalitativ granskning av sakliga skäl.</p>
        </div>` : '';

    wrap.innerHTML = `
        <div class="card bl4-${verdictFarg}" role="region" aria-label="Multivariat regressionsresultat">
            <div class="reg-intro">
                <p><span class="info-tip" data-tooltip="En statistisk metod (OLS-regression) som &quot;rensar bort&quot; effekten av att kvinnor och män har olika ålder och arbetar i olika BAS-intervall. Det som kvarstår är den OFÖRKLARADE löneskillnaden — det som inte kan tillskrivas dessa strukturella skillnader. Standardmetod inom svensk lönekartläggning (Medlingsinstitutet) och motsvarar EU-direktivets 'unexplained gender pay gap'.">${ikon('info', 14)}</span> Det <strong>råa lönegapet</strong> mellan kvinnor och män kan delvis förklaras av att grupperna har olika åldersstruktur och är olika fördelade över BAS-intervallen. Vi använder en statistisk metod som "rensar bort" dessa strukturella skillnader. Det som <strong>kvarstår</strong> är den <em>oförklarade</em> löneskillnaden — den del som inte beror på att kvinnor är yngre, jobbar i annat BAS osv.</p>
            </div>

            ${saFunkarHtml}
            ${modelBanner}
            ${reliabilityHtml}

            <div class="reg-hero">
                <div>
                    <div class="hero-label">Oförklarad löneskillnad, kvinnor mot män</div>
                    <div class="hero-number fg-${verdictFarg}" aria-live="polite">${sign}${svPct(r.konPct, 1)}</div>
                    <div class="hero-meta">
                        <strong>Troligt spann (95 % konfidensintervall):</strong> ${svPct(r.konPctLow, 1)} till ${svPct(r.konPctHigh, 1)}
                        <span class="info-tip" data-tooltip="95% konfidensintervall (HC3 robust). Det &quot;verkliga&quot; värdet ligger med 95% sannolikhet inom detta intervall. Smalt intervall = säker estimering, brett = osäker. Klassisk KI för jämförelse: ${svPct(r.konPctLowClassical, 1)} till ${svPct(r.konPctHighClassical, 1)}.">${ikon('info', 14)}</span><br>
                        <strong>Statistiskt säkerställd:</strong>
                        <span title="${esc(_sigPlainText(r.pValue))}" class="ram-b-1-prickad-dampad hjalpmarke hjalp-markor">${isSig ? 'Ja' : 'Nej'} (${sig})</span>
                    </div>
                </div>
                <div class="reg-verdict ${verdict.cls}">
                    <div class="verdict-icon">${verdict.icon}</div>
                    <div>
                        <div class="verdict-title">${verdict.title}</div>
                        <div class="verdict-sub">${verdict.sub}</div>
                    </div>
                </div>
            </div>

            ${caveatInline}

            ${kronorHtml}

            <div class="bak-botten rund-6 fs-md lh-1_6 marg-t-14 pad-14-16">
                <strong>Tolkning:</strong> ${tolkning}
            </div>

            ${_regTrappaVisas(stegUt) ? '<div class="chart-container mt-14"><div id="chart-reg-trappa"></div></div>' : ''}
            ${waterfallHtml ? `
            <details class="marg-t-18" open>
                <summary class="pekare fw-600 pad-8-0 ej-markerbar">Hur kommer vi fram till siffran? (steg-för-steg)
                    <span class="info-tip" data-tooltip="Vi börjar med det råa lönegapet och visar hur stor del som förklaras av varje strukturell variabel. Det som blir kvar i sista steget är den oförklarade löneskillnaden.">${ikon('info', 14)}</span>
                </summary>
                <p class="text-dampad-sm lh-1_55 marg-8-0-6">
                    Modellen skattas i flera steg, med en kontrollvariabel till i varje. Trappan visar lönegapet efter varje steg, och förklaringsbudgeten under den hur många procentenheter varje steg tar. Det som blir kvar i sista steget är den oförklarade skillnaden.
                </p>
                ${stegUt.utelamnat ? `<p class="k-mask-note">${esc(stegUt.not)}</p>` : ''}
                ${budgetHtml}
                ${ansvarHtml}
                <div class="reg-waterfall${_regTrappaVisas(stegUt) ? ' sr-only' : ''}"${_regTrappaVisas(stegUt) ? ' aria-label="Stegen som lista"' : ''}>${waterfallHtml}</div>
                ${explainedRowHtml(budget)}
            </details>
            ` : ''}

            <details class="mt-14" open>
                <summary class="pekare fw-600 pad-8-0 ej-markerbar">Var inom organisationen finns den oförklarade skillnaden? (per BAS-intervall)
                    <span class="info-tip" data-tooltip="För varje BAS-intervall körs en egen analys. Visar vilka delar av organisationen som driver det oförklarade gapet, snarare än ett genomsnitt för hela organisationen.">${ikon('info', 14)}</span>
                </summary>
                <p class="text-dampad-sm lh-1_55 marg-8-0-6">
                    Inom varje BAS-intervall körs en separat analys (som rensar bort åldersskillnaden). Visar var i organisationen den oförklarade skillnaden ligger — inte alla BAS bidrar lika mycket till totalbilden.
                </p>
                ${caveatInline}
                <div class="chart-container"><div id="chart-perbas-gap"></div></div>
                <label class="perbas-stats-toggle">
                    <input type="checkbox" id="perbas-show-stats"> Visa statistiska detaljer (p- och q-värden)
                </label>
                <div class="rulla-x">
                    <table id="perbas-table" class="data-table hide-stats fs-sm marg-t-8">
                        <thead><tr>
                            <th>BAS</th>
                            <th class="t-hoger">N</th>
                            <th class="t-mitt">Kv/Mä</th>
                            <th class="t-hoger">Oförklarat gap</th>
                            <th class="t-mitt">Signal <span class="info-tip" data-tooltip="Klarspråkstolkning av statistiken. Titta närmare = säkerställd även efter korrigering OCH över 5 % (EU-direktivets utredningssteg aktualiseras). Dokumentera = säkerställd men under 5 %. Osäkert utslag = ser signifikant ut i råa p-värdet men håller inte efter korrigering för multipel jämförelse. Inget utslag = ingen säkerställd oförklarad skillnad.">${ikon('info', 14)}</span></th>
                            <th class="col-stat t-mitt">p-värde (rå) <span class="info-tip" data-tooltip="Råa p-värdet från regressionen. p<0,05 = statistiskt säkerställd ifall enstaka test. Vid många samtidiga tester (multipel jämförelse) bör det justerade q-värdet användas istället.">${ikon('info', 14)}</span></th>
                            <th class="col-stat t-mitt">q-värde (BH-justerat) <span class="info-tip" data-tooltip="Benjamini-Hochberg FDR-justerat p-värde. Korrigerar för multipel jämförelse — vid 20+ samtidiga tester förväntas falska positiv av ren slump om man bara använder rå p<0.05. q<0.05 betyder att signifikansen håller även efter korrektion. Symboler: nålen = säkerställt efter korrigering och över 5 % (här aktualiseras EU-direktivets utredningssteg, 2023/970), ögat = säkerställt efter korrigering men under 5 %, varningstriangeln = säkerställt i det råa p-värdet men inte efter korrigering.">${ikon('info', 14)}</span></th>
                            <th class="t-mitt" title="Öppnar bevis-popup som visar exakt formel, ingångsdata och BH-FDR-context för denna rad.">Bevis</th>
                        </tr></thead>
                        <tbody>${perBasRows || '<tr><td class="t-mitt f-dampad" colspan="8">Inga BAS-intervall har tillräcklig könsbalans (≥' + statGolv() + ' av varje kön).</td></tr>'}</tbody>
                    </table>
                </div>
                <p class="text-dampad-xs lh-1_5 marg-t-8">
                    <strong>Multipel jämförelse-korrigering:</strong> Vid många samtidiga tester (20+) förväntas 1 falskt positivt resultat per ren slump om enbart rå p&lt;0,05 används. Benjamini-Hochberg FDR-justering reducerar denna risk genom att kräva strikare bevis för grupper som testas tillsammans. Varningstriangeln markerar grupper som ser signifikanta ut i råa p men inte överlever korrektionen — dessa bör inte presenteras som "säkerställda" vid förhandling.
                </p>
            </details>

            ${(() => {
                const qr = _regKvantilBerakna();
                _regKvantilSenast = null;
                if (!qr) return '';
                const validResults = qr.results.filter(x => !x.error);
                if (validResults.length < 2) return '';
                _regKvantilSenast = validResults;   // diagrammet ritas när kortet står i sidan
                const p10 = qr.results.find(x => x.tau === 0.1);
                const p50 = qr.results.find(x => x.tau === 0.5);
                const p90 = qr.results.find(x => x.tau === 0.9);
                const pctTecken = v => `${v >= 0 ? '+' : '−'}${svPct(Math.abs(v), 1)}`;
                const fmtRow = (label, helper, x) => {
                    if (!x || x.error) return `<tr><td>${label}</td><td><em class="f-dampad">Kunde ej estimeras</em></td><td>–</td><td>${helper}</td></tr>`;
                    const color = Math.abs(x.konPct) > 5 ? 'f-kritisk' : Math.abs(x.konPct) > 2 ? 'fg-varning' : '';
                    const ki = x.ki ? `${pctTecken(x.ki.lag)} till ${pctTecken(x.ki.hog)}` : '<span class="f-dampad">–</span>';
                    return `<tr><td>${label}</td><td class="halvfet tabelltal ${color}">${pctTecken(x.konPct)}</td><td class="tabelltal">${ki}</td><td class="text-dampad-sm">${helper}</td></tr>`;
                };
                let tolkning = '';
                if (p10 && p50 && p90 && !p10.error && !p50.error && !p90.error) {
                    const diff_10_90 = Math.abs(Number(p10.konPct)) - Math.abs(Number(p90.konPct));
                    if (diff_10_90 > 1) {
                        tolkning = `<strong>Klistergolvet är värre än glasstaket</strong> — kvinnor i den lägre delen av löneskalan halkar efter mer än kvinnor i toppen.`;
                    } else if (diff_10_90 < -1) {
                        tolkning = `<strong>Glasstaket är värre än klistergolvet</strong> — kvinnor i den högre delen av löneskalan halkar efter mer än kvinnor i botten.`;
                    } else {
                        tolkning = `Lönegapet är ungefär lika stort i alla delar av lönefördelningen.`;
                    }
                }
                return `
                <details class="mt-14" open>
                    <summary class="pekare fw-600 pad-8-0 ej-markerbar">Lönegap i olika delar av lönefördelningen
                        <span class="info-tip" data-tooltip="Huvudmodellen skattar lönegapet i medelvärdet. Kvantilregression skattar gapet i olika delar av fördelningen var för sig. P10 = botten av lönefördelningen ('klistergolvet'), P50 = median, P90 = toppen ('glasstaket'). Visar om skillnaden är större i vissa lönenivåer.">${ikon('info', 14)}</span>
                    </summary>
                    <p data-hjalptext class="text-dampad-sm lh-1_55 marg-8-0-6">
                        Huvudmodellen ovan skattar lönegapet vid <em>medelvärdet</em>. Kvantilregression visar gapet i olika delar av lönefördelningen — viktigt om gapet är ojämnt fördelat (t.ex. värre för låginkomsttagare än för höginkomsttagare).
                    </p>
                    <div class="rulla-x">
                        <div class="chart-container"><div id="chart-reg-kvantil"></div></div>
                        <table class="data-table fs-sm marg-t-8">
                            <thead><tr><th>Position i lönefördelningen</th><th class="t-hoger">Oförklarat gap</th><th>95 % KI (bootstrap)</th><th>Tolkning</th></tr></thead>
                            <tbody>
                                ${fmtRow('<strong>P10 — Klistergolvet</strong>', 'Lönegapet bland de lägst betalda', p10)}
                                ${fmtRow('<strong>P50 — Medianen</strong>',     'Lönegapet i mittersta delen av lönefördelningen', p50)}
                                ${fmtRow('<strong>P90 — Glasstaket</strong>',   'Lönegapet bland de högst betalda', p90)}
                            </tbody>
                        </table>
                    </div>
                    ${tolkning ? `<div class="bak-info-yta ram-v-3-info rund-4 fs-sm marg-t-10 pad-10-14">${tolkning}</div>` : ''}
                    <p class="text-dampad-xs lh-1_5 marg-t-8">
                        <em>Metod: IRLS (Iteratively Reweighted Least Squares) på samma modellspecifikation som huvudregressionen — en approximation av kvantillösningen, inte den exakta minimeringen. Kräver minst 50 observationer för stabilt resultat.
                        ${qr.kiUtelamnad ? esc(qr.kiUtelamnad) : `Konfidensintervallet är ett percentil-bootstrap med ${qr.kiB} omsamplingar av raderna, seedat ur datat så att det blir detsamma varje gång.`}</em>
                    </p>
                </details>`;
            })()}

            <details class="mt-14" open>
                <summary class="farg-primary pekare fw-600 pad-8-0 ej-markerbar">Hur tolkas signifikansvärdena?</summary>
                <div class="bak-yta rund-6 fs-sm lh-1_6 marg-t-8 pad-14-16">
                    <p class="marg-0-0-10"><strong>p-värdet</strong> svarar på frågan: <em>"Hur sannolikt är det att vi skulle se denna löneskillnad mellan könen om det i verkligheten inte fanns någon?"</em> Lågt p-värde betyder att skillnaden är svår att förklara med enbart slumpmässig variation och bör tas på allvar.</p>
                    <table class="tabell-samman fs-sm marg-8-0">
                        <tr><td class="pad-3-12-3-0 lodrat-topp"><strong class="farg-kritisk">p &lt; 0,001</strong></td><td>Extremt signifikant — utan verklig skillnad skulle en så stor skillnad uppstå i färre än 1 av 1 000 fall. Mycket starkt stöd för verklig löneskillnad.</td></tr>
                        <tr><td class="pad-3-12-3-0 lodrat-topp"><strong class="farg-kritisk">p &lt; 0,01</strong></td><td>Mycket signifikant — färre än 1 av 100 fall. Starkt stöd för verklig skillnad.</td></tr>
                        <tr><td class="pad-3-12-3-0 lodrat-topp"><strong class="farg-varning">p &lt; 0,05</strong></td><td>Signifikant — färre än 5 av 100 fall. Den vanliga tröskeln för "statistiskt säkerställd" skillnad.</td></tr>
                        <tr><td class="pad-3-12-3-0 lodrat-topp"><strong class="f-dampad">p ≥ 0,05</strong></td><td>Ej signifikant — datat är förenligt med att ingen verklig skillnad finns. Observerad skillnad kan vara slump.</td></tr>
                    </table>
                    <p class="marg-10-0-6"><strong>Symbolerna i per-BAS-tabellen:</strong></p>
                    <ul class="marg-0-0-10-22">
                        <li>${ikon('nal')} = signifikant <strong>och</strong> överstiger 5 %-tröskeln i lönetransparensdirektivet — här aktualiseras EU-direktivets utredningssteg (väg mot sakliga skäl, överväg gemensam lönebedömning)</li>
                        <li>${ikon('oga')} = signifikant men under 5 % — värt att dokumentera med sakliga skäl och följa upp</li>
                        <li><span class="f-dampad">Inget märke</span> = inte signifikant, eller signifikant men praktiskt obetydlig storlek</li>
                    </ul>
                    <p class="notis-varning fs-sm marg-10-0-0 pad-8-12">
                        <strong>Viktig nyans – statistisk och praktisk signifikans:</strong>
                        Vid stora urval kan även mycket små skillnader bli "statistiskt signifikanta". Ett gap på 0,3% kan ha p &lt; 0,001 utan att vara åtgärdsvärt i praktiken.
                        Bedöm <em>båda</em> dimensionerna: är skillnaden <strong>statistiskt</strong> säkerställd (p &lt; 0,05) <em>och</em> <strong>praktiskt</strong> betydande (vanligen ≥ 5% enligt EU-direktivet)?
                    </p>
                </div>
            </details>

            <details class="mt-14" open>
                <summary class="text-dampad-sm pekare fw-600 pad-8-0 ej-markerbar">Teknisk specifikation (för statistiker)</summary>
                <div class="reg-tech mt-8">
                    <p>Denna sektion innehåller modellens fullständiga tekniska specifikation och är inte nödvändig för att tolka resultaten ovan. Avsedd för användare med statistisk bakgrund som vill granska metoden.</p>
                    <h3>Modellspecifikation</h3>
                    <table class="reg-tech-table">
                        <tr><th>Modellnotation</th><td><code>log(lön) ~ ${esc(r.modelDesc)}</code></td></tr>
                        <tr><th>Estimationsmetod</th><td>OLS (Ordinary Least Squares)</td></tr>
                        <tr><th>Standardfel</th><td>HC3 robust (Long &amp; Ervin 2000)</td></tr>
                        <tr><th>Antal observationer (n)</th><td>${r.n} (Kvinnor: ${r.nKvAnalysed}, Män: ${r.nMaAnalysed})</td></tr>
                        <tr><th>Antal parametrar (k)</th><td>${r.k}</td></tr>
                        <tr><th>Förklaringsgrad (R²)</th><td>${svPct((r.R2*100), 1)}</td></tr>
                        <tr><th>Justerad R²</th><td>${svPct((r.adjR2*100), 1)}</td></tr>
                    </table>
                    <h3>Kön-koefficient (oförklarad löneskillnad)</h3>
                    <table class="reg-tech-table">
                        <tr><th>Effekt (exp(β)−1)</th><td>${sign}${svPct(r.konPct, 4)}</td></tr>
                        <tr><th>SE (HC3 robust)</th><td>${svTal(r.seKonR, 5)}</td></tr>
                        <tr><th>SE (klassisk)</th><td>${svTal(r.seKonC, 5)}</td></tr>
                        <tr><th>t-statistika</th><td>${svTal(r.tStat, 3)}</td></tr>
                        <tr><th>p-värde</th><td>${sig}</td></tr>
                        <tr><th>95% KI (HC3 robust)</th><td>${svPct(r.konPctLow, 4)} till ${svPct(r.konPctHigh, 4)}</td></tr>
                        <tr><th>95% KI (klassisk)</th><td>${svPct(r.konPctLowClassical, 4)} till ${svPct(r.konPctHighClassical, 4)}</td></tr>
                    </table>
                    <h3>Ålderseffekt</h3>
                    <table class="reg-tech-table">
                        <tr><th>Procentuell löneförändring per levnadsår</th><td>${r.ageEffect >= 0 ? '+' : ''}${svPct(r.ageEffect, 3)}</td></tr>
                        <tr><th>p-värde</th><td>${_formatPValue(r.ageP)}</td></tr>
                    </table>
                    ${r.basEffekter ? `
                    <h3>BAS-effekter (indikatorvariabler)</h3>
                    <p>Varje BAS-intervall har en egen indikator; det alfabetiskt första intervallet, <code>${esc(r.basRef)}</code>, är referens. Koefficienten är intervallets lönenivå i procent mot referensen, efter kontroll för kön och ålder — inget antagande om lika stora steg mellan bokstäverna.</p>
                    <table class="reg-tech-table">
                        <tr><th>BAS</th><th>Nivå mot ${esc(r.basRef)}</th><th>95% KI</th><th>p-värde</th></tr>
                        ${r.basEffekter.map(e => `<tr><td>${esc(e.bas)}</td><td>${e.pct >= 0 ? '+' : ''}${svPct(e.pct, 1)}</td><td>${svPct(e.low, 1)} till ${svPct(e.high, 1)}</td><td>${_formatPValue(e.p)}</td></tr>`).join('')}
                    </table>
                    ` : ''}
                    <h3>Modellspecifikationer som testades (kaskadval)</h3>
                    <p class="lh-1_7">${triedRow}</p>
                </div>
            </details>
        </div>
    `; tillampaDataStil(wrap);

    // #lifecycle: rendera sekundäranalys efter att placeholder finns i DOM
    renderLifecycleAnalysis();

    // Per-BAS-diagram + växel för statistiska detaljer (pedagogik-omgången).
    // Diagrammet ritas efter innerHTML så containern finns; tabellen är kvar
    // som tillgänglighetsalternativ och p/q ligger bakom växeln.
    _renderPerBasGapChart(r.perBas, bhQByBas);
    // Trappan och kvantilkurvan: bilder av tal som kortet redan visar i tabell.
    const trappa = document.getElementById('chart-reg-trappa');
    if (trappa) ritaFigur(trappa, _regTrappaFigur(stegUt.steg.filter(s => s.status === 'ok' && s.name !== '+ Yrkesgrupp'), yrkeVisas ? r.yrkesSteg : null));
    const kvantil = document.getElementById('chart-reg-kvantil');
    if (kvantil && _regKvantilSenast) ritaFigur(kvantil, _regKvantilFigur(_regKvantilSenast));
    const statsToggle = document.getElementById('perbas-show-stats');
    const perBasTable = document.getElementById('perbas-table');
    if (statsToggle && perBasTable) {
        statsToggle.addEventListener('change', () => {
            perBasTable.classList.toggle('hide-stats', !/** @type {HTMLInputElement} */ (statsToggle).checked);
        });
    }

    // Bevis-popup för per-BAS-rader
    // Bind handlers efter att tabellen renderats. Vi söker rätt på BAS-
    // namnet i r.perBas + slår upp BH-FDR-q. allM är totala antal OK-tester
    // (för BH-FDR-context i bevis-modalen).
    wrap.querySelectorAll('.btn-evidence[data-bas-evidence]').forEach(btn => {
        btn.addEventListener('click', () => {
            const basName = /** @type {HTMLElement} */ (btn).dataset.basEvidence;
            const p = (r.perBas || []).find(x => x.bas === basName);
            if (!p) return;
            const q = bhQByBas[basName];
            _openEvidenceModal(_evidenceForPerBasRow(p, { q, allM }));
        });
    });
}

/**
 * Renderar Blinder-Oaxaca-kortet i EU-matris-fliken (efter
 * renderRegressionCard).
 */
function renderBlinderOaxacaCard() {
    const wrap = document.getElementById('blinder-oaxaca-card');
    if (!wrap) return;
    const r = runBlinderOaxaca();
    if (!r) {
        wrap.innerHTML = `<div class="card ram-v-4-dampad">
            <h3 class="marg-0-0-8">Förklarad och oförklarad löneskillnad</h3>
            <p class="farg-dampad fs-md marg-0">
                För få observationer (kräver minst 50 personer totalt och ${statGolv()} av varje kön).
            </p>
        </div>`;
        return;
    }
    const fmtPct = v => (v >= 0 ? '+' : '') + svPct(v, 1);
    // Metoden räknar män mot kvinnor i log-rummet; kortet visar talen kvinnor mot män, som resten av verktyget.
    // Komponenterna är additiva på log-skalan, så tecknet byts där och räknas sedan om till procent.
    const pctKv = c => (Math.exp(-c) - 1) * 100;
    const ragap = pctKv(r._raw.rawGapLog), forklarat = pctKv(r._raw.q), oforklarat = pctKv(r._raw.u + r._raw.i);

    // Andelar: rågap = förklarat + oförklarat (i log-rummet, additivt)
    const explainedShare = r._raw.q / r._raw.rawGapLog;
    const unexplainedShare = (r._raw.u + r._raw.i) / r._raw.rawGapLog;
    // Visa som positiva andelar oavsett tecken
    const explainedPctOfGap = Math.abs(explainedShare * 100);
    const unexplainedPctOfGap = Math.abs(unexplainedShare * 100);

    // Per-variabel-tabell
    const compLabel = { intercept: 'Konstant (grundnivå)', age: 'Ålder', bas: 'BAS-rangordning' };
    const compRows = Object.entries(r.components).map(([k, v]) => `
        <tr>
            <td><strong>${compLabel[k]}</strong></td>
            <td class="t-tal">${fmtPct(pctKv(v.q))}</td>
            <td class="t-tal">${fmtPct(pctKv(v.u))}</td>
            <td class="farg-dampad tabelltal ta-hoger">${fmtPct(pctKv(v.i))}</td>
        </tr>`).join('');

    wrap.innerHTML = `
        <div class="card ram-v-4-granska-ljus">
            <h3 class="marg-0-0-6">Förklarad och oförklarad löneskillnad
                <span class="info-tip" data-tooltip="Standardmetod inom arbetsmarknadsekonomi (Blinder 1973, Oaxaca 1973). Bryter ned rågapet i tre delar: hur mycket beror på att kvinnor och män har olika karakteristika (förklarat), och hur mycket beror på att samma egenskaper betalas olika (oförklarat — det statistiken inte kan förklara, inte ett mått på diskriminering). Används av Medlingsinstitutet.">${ikon('info', 14)}</span>
            </h3>
            <p class="text-dampad-sm lh-1_55 marg-0-0-14">
                Rågapet i månadslön delas upp i den del som <em>förklaras</em> av strukturella skillnader
                (ålder, BAS) och den del som är <em>oförklarad</em> — det som <strong>inte</strong> kan
                tillskrivas att kvinnor och män i organisationen har olika åldrar eller arbetar i olika
                BAS-intervall. Den oförklarade delen är det lönekartläggningen ska adressera.
            </p>

            <div class="rutnat gap-14 kolumner-3-lika marg-b-18">
                <div class="bak-accent-yta rund-8 pad-14 ta-mitt">
                    <div class="etikett-versal">Rågap, kvinnor mot män</div>
                    <div class="farg-accent-mork fs-nyckeltal fw-700 marg-t-4">${fmtPct(ragap)}</div>
                    <div class="finstilt">n = ${r.nKv} kvinnor + ${r.nMa} män</div>
                </div>
                <div class="bak-ok-bg rund-8 pad-14 ta-mitt">
                    <div class="etikett-versal">Förklarat (struktur)</div>
                    <div class="farg-ok fs-nyckeltal fw-700 marg-t-4">${fmtPct(forklarat)}</div>
                    <div class="finstilt">≈ ${svPct(explainedPctOfGap, 0)} av rågapet</div>
                </div>
                <div class="bak-varning-bg rund-8 pad-14 ta-mitt">
                    <div class="etikett-versal">Oförklarat (koef + samspel)</div>
                    <div class="farg-varning fs-nyckeltal fw-700 marg-t-4">${fmtPct(oforklarat)}</div>
                    <div class="finstilt">≈ ${svPct(unexplainedPctOfGap, 0)} av rågapet</div>
                </div>
            </div>

            <p class="text-dampad-sm lh-1_55 marg-0-0-14">Samma håll som i kortet ovan: kvinnors lön mot mäns, negativt när kvinnor ligger lägre. Den oförklarade delen här och huvudtalet ovan mäter samma skillnad; de skiljer sig något eftersom uppdelningen använder BAS som rangordning och skattar kvinnors och mäns lönesättning var för sig. (Metoden räknar internt mäns lön mot kvinnors; talen är omräknade.)</p>

            <details open>
                <summary class="farg-text pekare fw-600">Visa uppdelning per variabel</summary>
                <div class="marg-t-10">
                    <table class="data-table st-09">
                        <thead>
                            <tr>
                                <th>Variabel</th>
                                <th class="t-hoger" title="Hur mycket av rågapet förklaras av att kvinnor och män har olika fördelning på just denna variabel">Förklarat (Q)</th>
                                <th class="t-hoger" title="Hur mycket beror på att män och kvinnor får olika lön för samma värde på denna variabel">Koefficient-effekt (U)</th>
                                <th class="t-hoger" title="Samspel: skillnad i fördelning × skillnad i avkastning. Räknas som oförklarat.">Samspel (I)</th>
                            </tr>
                        </thead>
                        <tbody>${compRows}</tbody>
                    </table>
                    <p data-hjalptext class="text-dampad-xs lh-1_5 marg-10-0-0">
                        <strong>Tolkning:</strong> Klassisk Blinder-Oaxaca-uppdelning. Q = skillnader i egenskaper (ålder, BAS) värderade
                        med kvinnornas lönesättning. U = skillnad i hur samma egenskaper betalas. I = samspel mellan de två.
                        Förklarat = Q. Oförklarat = U + I.
                    </p>
                </div>
            </details>

            <div class="bak-varning-bg ram-v-3-varning rund-4 fs-sm lh-1_55 marg-t-14 pad-10-12">
                <strong>Vad betyder detta i samverkan?</strong><br>
                Den <em>förklarade</em> delen (${fmtPct(forklarat)}) beror på att kvinnor och män
                i organisationen har olika ålder och arbetar i olika BAS-intervall. Den hänsyn man rimligt
                kan ta är dessa strukturella skillnader. Den <em>oförklarade</em> delen (${fmtPct(oforklarat)})
                är vad lönekartläggningen ska <strong>analysera djupare</strong> — sakliga skäl
                måste finnas dokumenterade för att motivera den.
            </div>
        </div>
    `;
}

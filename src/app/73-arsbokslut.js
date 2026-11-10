// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
// ---- Årsbokslut och jämförelse med förra året (ADR-54) ----
// Konfigurationsfilen bär ett k-skyddat årsbokslut (src/lib/arsbokslut.js). Läses förra årets fil in ligger dess
// bokslut i state.forraArsbokslut, och panelen i Spara och jämför år visar skillnaden mot årets. Allt byggs i
// exportläget (ADR-51): bokslutet lämnar verktyget i filen.

/** Årets bokslut ur det inlästa underlaget, eller null utan underlag. */
function byggArsbokslutNu() {
    if (!state.data.length || typeof _abBygg !== 'function') return null;
    return medExportLage(() => {
        const d = getData();
        const k = kTroskel();
        const bild = buildAnalysisSnapshot();
        const lika = typeof laLikaGrupper === 'function' ? laLikaGrupper(d, k) : { grupper: [] };   // flaggad = Värt att granska (ADR-59)
        /** @type {any} */ let lv = null;
        try { lv = typeof likvardighetResultat === 'function' ? likvardighetResultat() : null; } catch (_e) { lv = null; }
        const { par, utelamnade } = _parForRedovisning(lv && lv.pairs);
        // Lönerna per yrkesgrupp (kvinnor och män, som Lika arbete räknar dem) för lönespridningen.
        /** @type {Map<string, number[]>} */ const lonPerYrke = new Map();
        for (const r of d) if (r.lon > 0 && r.kon && (r.kon.includes('kvinna') || r.kon === 'man' || r.kon === 'män')) {
            if (!lonPerYrke.has(r.yrke)) lonPerYrke.set(r.yrke, []);
            /** @type {number[]} */ (lonPerYrke.get(r.yrke)).push(r.lon);
        }
        const klara = state._actionChecklistDone || new Set();
        const punkter = typeof buildActionChecklist === 'function' ? buildActionChecklist() : [];
        return _abBygg({
            ar: new Date().getFullYear(), skapat: new Date().toISOString().slice(0, 10), k, verktyg: `v${APP_VERSION}`,
            nyckeltal: { n: bild.n, nKv: bild.nKv, nMa: bild.nMa, medKv: bild.medianKv, medMa: bild.medianMa,
                kvotPct: bild.rawGapPct == null ? null : 100 + bild.rawGapPct, oforklaratPct: bild.unexplainedGapPct,
                antalFlaggade: lika.grupper.filter(g => g.flaggad).length, antalKandidatpar: par.length, utelamnadePar: utelamnade },
            grupper: lika.grupper.filter(g => !g.samladMedian).map(g => ({ yrke: g.yrke, nKv: g.nKv, nMa: g.nMa, medKv: g.medKv, medMa: g.medMa, gapPct: g.kvot * 100 - 100, flaggad: g.flaggad,
                spridning: _abSpridning(lonPerYrke.get(g.yrke) || [], k) })),
            punkter: punkter.map(p => ({ id: p.id, titel: p.titel, kategori: p.kategori, klar: klara.has(p.id) })),
            basIntervall: getBasIntervals().map(b => _abBasRad(d, b, k)).filter(Boolean),
            bedomningar: _abBedomningarNu(),
        });
    });
}

/**
 * Handlingsplanens sakliga skäl per grupp för bokslutet: de förifyllda raderna (prioriteringen och kandidatparen) med
 * skäl, med antal, den minsta gruppen bakom skillnaden, skillnaden och skälen. Kommentarerna följer inte med (lib-
 * valideringen tar bort dem). En egen rad följer inte med: den har inget antal att pröva mot minsta gruppstorlek.
 * Anropas i exportläget, så en rad under tröskeln finns inte i förifyllningen.
 */
function _abBedomningarNu() {
    if (typeof _hpSkalUnderlag !== 'function') return [];
    return _hpSkalUnderlag().grupper.filter(g => !_hpArEgen(g.nyckel))
        .map(g => ({ nyckel: g.nyckel, grupp: g.grupp, n: g.antal, nMin: g.nMin, skillnadKr: g.skillnadKr,
            // Ett kön under minsta gruppstorlek: bara kategorierna (lib-valideringen gör samma sak vid inläsning).
            skal: g.utanBelopp ? g.sammanstallning.skal.map(s => ({ kategori: s.kategori })) : g.sammanstallning.skal }));
}

/**
 * Bokslutets rad för ett BAS-intervall: antal, P10, median, P90 och lönespridningen när intervallet har minst k
 * personer, och kvinnors och mäns median bara när båda könen når k (samma regel som Lönestruktur). null under k.
 * @param {any[]} d
 * @param {string} bas
 * @param {number} k
 */
function _abBasRad(d, bas, k) {
    const df = d.filter(r => r.bas === bas && r.lon > 0);
    if (df.length < k) return null;
    const kv = df.filter(r => r.kon && r.kon.includes('kvinna')), ma = df.filter(r => r.kon === 'man' || r.kon === 'män');
    const lon = df.map(r => r.lon), konOk = kv.length >= k && ma.length >= k;
    return { bas, n: df.length, nKv: kv.length, nMa: ma.length, p10: Stat.quantile(lon, 0.10), med: Stat.median(lon), p90: Stat.quantile(lon, 0.90),
        medKv: konOk ? Stat.median(kv.map(r => r.lon)) : null, medMa: konOk ? Stat.median(ma.map(r => r.lon)) : null,
        spridning: _abSpridning(lon, k) };
}

/** Jämförelsen mellan förra årets bokslut och årets, eller null utan bokslut eller underlag. Byggs i exportläget. */
function arsjamforelse() {
    const forra = state.forraArsbokslut;
    if (!forra || !state.data.length || typeof _abJamfor !== 'function') return null;
    const nu = byggArsbokslutNu();
    const j = nu ? _abJamfor(forra, nu) : null;
    return nu && j ? { forra, nu, j } : null;
}
/**
 * Hanteln: kvinnors medianlön i procent av mäns per yrkesgrupp, förra året (strecket) och i år (punkten), färgad
 * efter om kvoten närmat sig lika lön (ok-nyansen) eller fjärmat sig (varningsnyansen) — en riktning, inte en
 * bedömning. Diagramdatan bär båda årens värden.
 */
// Filtren: BAS-intervall, yrkesgrupp och antal (kvinnor och män i tabellens kolumn). Bokslutet sparar inte gruppens BAS:
// det läses ur årets lönefil och sätts bara när yrket finns i ett enda BAS-intervall (`basFor`); en rad utan BAS påverkas
// inte av det filtret.
function _abHantelFigur(j, forraAr, nuAr, basFor = _abYrketsBas()) {
    const { rader } = _abHantelRader(j);
    if (!rader.length) return null;
    const farg = { mot: PALETTE.semantic.ok, fran: PALETTE.semantic.varning, lika: PALETTE.semantic.neutral };
    const antal = new Map([...j.grupper.kvar, ...j.grupper.nya, ...j.grupper.borta].map(g => [g.yrke, g.nKv != null && g.nMa != null ? g.nKv + g.nMa : null]));
    const fig = foreEfterFigur({ rader: rader.map(r => ({ namn: r.namn, yrke: r.namn, ...(basFor(r.namn) != null ? { bas: basFor(r.namn) } : {}),
            ...(antal.get(r.namn) != null ? { n: antal.get(r.namn) } : {}), fore: +r.fore.toFixed(1), efter: +r.efter.toFixed(1), farg: farg[r.riktning] })),
        kolumner: [String(forraAr), String(nuAr)], titel: 'Kvinnors medianlön i procent av mäns', format: 'pct',
        beskrivning: `Kvinnors medianlön i procent av mäns per yrkesgrupp, ${forraAr} (strecket) och ${nuAr} (punkten), sorterade efter förändringens storlek. Grön när kvoten närmat sig lika lön, orange när den fjärmat sig; linjen vid 100 % är lika lön.` });
    return { ..._abEtiketterBortFranStrecket(fig), urval: [URVAL.bas, URVAL.yrkesgrupp, URVAL.antal] };
}
/** Yrkets BAS-intervall i årets lönefil, eller null när yrket saknas eller finns i flera intervall. */
function _abYrketsBas(d = state.data || []) {
    const perYrke = new Map();
    for (const r of d) {
        if (r.yrke == null || r.bas == null || r.bas === '') continue;
        if (!perYrke.has(r.yrke)) perYrke.set(r.yrke, new Set());
        perYrke.get(r.yrke).add(String(r.bas));
    }
    return yrke => { const s = perYrke.get(yrke); return s && s.size === 1 ? [...s][0] : null; };
}

/** Årets värde skrivs på den sida av punkten där strecket inte är: till höger när värdet stigit, till vänster när det sjunkit. */
function _abEtiketterBortFranStrecket(fig) {
    const punkt = /** @type {any} */ (fig.lager[2]);
    const hoger = punkt.data.filter(d => d.r.efter >= d.r.fore), vanster = punkt.data.filter(d => d.r.efter < d.r.fore);
    fig.lager = /** @type {any} */ ([fig.lager[0], fig.lager[1], { ...punkt, data: hoger }, ...(vanster.length ? [{ ...punkt, data: vanster, etikettLage: 'vanster', legend: false }] : [])]);
    return fig;
}

/**
 * Hanteln för löneutvecklingen per BAS-intervall: medianlönen förra året (strecket) och i år (punkten). En färg för
 * alla rader: en högre median är en förändring, ingen bedömning. Markeringen följer BAS-intervallet.
 */
function _abBasHantelFigur(j, forraAr, nuAr) {
    const { rader } = _abBasHantelRader(j);
    if (!rader.length) return null;
    const fig = foreEfterFigur({ rader: rader.map(r => ({ namn: r.namn, bas: r.bas, fore: r.fore, efter: r.efter, farg: PALETTE.semantic.linje, markering: markeringFor(r.bas) })),
        kolumner: [String(forraAr), String(nuAr)], titel: 'Medianlön per BAS-intervall', format: 'kr',
        beskrivning: `Medianlönen per BAS-intervall, ${forraAr} (strecket) och ${nuAr} (punkten). Bara intervall med minst ${j.kGrans} ${personOrd(j.kGrans)} båda åren.` });
    return { ..._abEtiketterBortFranStrecket(fig), urval: URVAL.bas };
}

/**
 * Löneutvecklingen per BAS-intervall som text för skärm och rapport: ett mått förra året och i år, och förändringen
 * i kronor och procent. Tecknen som i nyckeltalen (+, − och ± för oförändrat).
 */
function _abKr(v) { return v == null ? '–' : `${svTal(Math.round(v), 0)} kr`; }
function _abForandringText(f, { kr = true } = {}) {
    if (!f || f.diff == null) return '–';
    const t = v => (v > 0 ? '+' : v < 0 ? '−' : '±');
    const belopp = kr ? `${t(f.diff)}${_abKr(Math.abs(f.diff))}` : `${t(f.diff)}${svTal(Math.abs(f.diff), 0)}`;
    return f.pct == null ? belopp : `${belopp} (${t(f.pct)}${svPct(Math.abs(f.pct), 1)})`;
}

/** Lönespridningen ((P90 − P10) / median) i procent av medianen, eller streck när värdet saknas (en äldre fil). */
function _abSpridningText(v) { return typeof v === 'number' ? svPct(v * 100, 0) : '–'; }
const AB_SPRIDNING_NOT = 'Lönespridning: (P90 − P10) / median, i procent av medianen; streck när förra årets fil saknar måttet (en äldre version av verktyget).';

/** Tabellen Löneutveckling per BAS-intervall i panelen, eller raden om att förra årets bokslut saknar fältet. */
function _abBasTabellHtml(j, forraAr, nuAr) {
    const rubrik = '<h4 class="fs-sm marg-12-0-2">Löneutveckling per BAS-intervall</h4>';
    if (!Array.isArray(j.basIntervall)) {
        return rubrik + '<p class="text-dampad-sm marg-0">Löneutvecklingen per BAS-intervall saknas i förra årets fil: bokslutet sparades med en äldre version av verktyget. Årets bokslut har den, så nästa års jämförelse får den.</p>';
    }
    if (!j.basIntervall.length) return rubrik + `<p class="text-dampad-sm marg-0">Inget BAS-intervall har minst ${j.kGrans} ${personOrd(j.kGrans)}.</p>`;
    const matt = [['p10', 'P10'], ['med', 'Median'], ['p90', 'P90']];
    const huvud = `<thead><tr><th scope="col" rowspan="2">BAS-intervall</th><th scope="colgroup" colspan="2" class="t-mitt">Antal</th>`
        + matt.map(([, e]) => `<th scope="colgroup" colspan="3" class="t-mitt">${e}</th>`).join('')
        + '<th scope="colgroup" colspan="2" class="t-mitt">Lönespridning</th></tr><tr>'
        + `<th scope="col" class="t-hoger">${forraAr}</th><th scope="col" class="t-hoger">${nuAr}</th>`
        + matt.map(() => `<th scope="col" class="t-hoger">${forraAr}</th><th scope="col" class="t-hoger">${nuAr}</th><th scope="col" class="t-hoger">Förändring</th>`).join('')
        + `<th scope="col" class="t-hoger">${forraAr}</th><th scope="col" class="t-hoger">${nuAr}</th>`
        + '</tr></thead>';
    const antal = v => (v == null ? '–' : svTal(v, 0));
    const rad = r => `<tr><th scope="row">BAS ${esc(r.bas)}</th><td class="t-tal">${antal(r.n.forra)}</td><td class="t-tal">${antal(r.n.nu)}</td>`
        + matt.map(([m]) => `<td class="t-tal">${_abKr(r[m].forra)}</td><td class="t-tal">${_abKr(r[m].nu)}</td><td class="t-tal halvfet">${_abForandringText(r[m])}</td>`).join('')
        + `<td class="t-tal">${_abSpridningText(r.spridning?.forra)}</td><td class="t-tal">${_abSpridningText(r.spridning?.nu)}</td></tr>`;
    const h = _abBasHantelRader(j);
    return rubrik + `<div class="table-container"><table class="data-table st-088" id="arsjamforelse-bas">${huvud}<tbody>${j.basIntervall.map(rad).join('')}</tbody></table></div>`
        + (h.rader.length ? `<h4 class="fs-sm marg-10-0-4">Medianlön per BAS-intervall, ${forraAr} och ${nuAr}</h4><div class="chart-container"><div id="chart-arsjamforelse-bas"></div></div>` : '')
        + (h.utelamnade ? `<p class="k-mask-note">${h.utelamnade} BAS-intervall har median bara ett av åren (färre än minsta gruppstorlek, eller fanns inte) och visas inte i diagrammet.</p>` : '')
        + `<p class="text-dampad-xs marg-4-0-0">Bara intervall med minst ${j.kGrans} ${personOrd(j.kGrans)} båda åren (den högre av årens minsta gruppstorlek). Förändringen i kronor och i procent av förra årets värde. Medianen rör sig också när sammansättningen ändras: nyanställda och avgångar påverkar den lika mycket som löneökningar. ${AB_SPRIDNING_NOT}</p>`;
}

/** Ett skäls eller en kategoris värde: beloppet och andelen av skillnaden när den finns, "900 kr (50 %)". */
function _abSkalVarde(v) {
    if (!v) return '–';
    return `${_abKr(v.summa ?? v.belopp)}${typeof v.andel === 'number' ? ` (${svPct(v.andel * 100, 0)})` : ''}`;
}
/** Ett års skäl i en mening: "Marknad 50 %, Erfarenhet 20 %", med belopp där andelen saknas. */
function _abSkalLista(skal) {
    return skal.map(s => (typeof s.andel === 'number' ? `${s.namn} ${svPct(s.andel * 100, 0)}` : s.belopp != null ? `${s.namn} ${_abKr(s.belopp)}` : s.namn)).join(', ');
}
/** Hur gruppens skillnad ändrades: " Skillnaden minskade från 1 800 till 1 200 kr/mån.", eller tomt när ett år saknar den. */
function _abSkillnadText(f, n) {
    if (typeof f !== 'number' || typeof n !== 'number') return '';
    const tal = v => svTal(Math.round(v), 0);
    if (f === n) return ` Skillnaden är oförändrad, ${tal(n)} kr/mån.`;
    return ` Skillnaden ${n < f ? 'minskade' : 'ökade'} från ${tal(f)} till ${tal(n)} kr/mån.`;
}
/** Gruppens namn i panelen; ett kandidatpar märks, så att det skiljs från prioriteringens rad för samma grupp. */
function _abSkalGrupp(g) { return `${g.grupp || g.nyckel}${String(g.nyckel).startsWith('par|') ? ' (kandidatpar)' : ''}`; }

/**
 * Avsnittet Sakliga skäl i panelen: tabellen per kategori båda åren, en mening per grupp som hade skäl båda åren och
 * de grupper som hade skäl förra året men inte i år. En rad om att skälen saknas när förra årets fil är från en äldre
 * version av verktyget.
 */
function _abSkalHtml(j, forraAr, nuAr) {
    const rubrik = '<h4 class="fs-sm marg-12-0-2">Sakliga skäl per kategori</h4>';
    const b = j.bedomningar;
    if (!b) return rubrik + '<p class="text-dampad-sm marg-0">De sakliga skälen saknas i förra årets fil: bokslutet sparades med en äldre version av verktyget. Årets bokslut har dem, så nästa års jämförelse får dem.</p>';
    if (!b.kategorier.length && !b.saknasIAr.length) return rubrik + '<p class="text-dampad-sm marg-0">Ingen grupp har sakliga skäl i handlingsplanen något av åren.</p>';
    const forandring = d => (d == null ? '–' : `${d > 0 ? '+' : d < 0 ? '−' : '±'}${_abKr(Math.abs(d))}`);
    const totDiff = b.totalt.forra.antalGrupper && b.totalt.nu.antalGrupper ? b.totalt.nu.summa - b.totalt.forra.summa : null;
    const rad = (namn, f, n, d, fet = false) => `<tr${fet ? ' class="halvfet"' : ''}><th scope="row">${esc(namn)}</th><td class="t-tal">${_abSkalVarde(f)}</td><td class="t-tal">${_abSkalVarde(n)}</td><td class="t-tal">${forandring(d)}</td></tr>`;
    const tabell = `<div class="table-container"><table class="data-table st-088" id="arsjamforelse-skal"><thead><tr><th scope="col">Kategori</th>`
        + `<th scope="col" class="t-hoger">Förra året (${forraAr})</th><th scope="col" class="t-hoger">I år (${nuAr})</th><th scope="col" class="t-hoger">Förändring</th></tr></thead><tbody>`
        + b.kategorier.map(k => rad(k.namn, k.forra, k.nu, k.diff)).join('')
        + rad('Totalt', b.totalt.forra.antalGrupper ? b.totalt.forra : null, b.totalt.nu.antalGrupper ? b.totalt.nu : null, totDiff, true)
        + '</tbody></table></div>';
    const grupper = b.grupper.length
        ? `<ul class="fs-sm marg-6-0-4" id="arsjamforelse-skal-grupper">${b.grupper.map(g => `<li><strong>${esc(_abSkalGrupp(g))}</strong>: förra året ${esc(_abSkalLista(g.forra.skal))}, i år ${esc(_abSkalLista(g.nu.skal))}.${_abSkillnadText(g.forra.skillnadKr, g.nu.skillnadKr)}</li>`).join('')}</ul>`
        : '';
    const saknas = b.saknasIAr.length
        ? `<p class="text-dampad-sm marg-6-0-2">Hade sakliga skäl förra året men inte i år (${b.saknasIAr.length}). Gruppen kan sakna skäl eller inte längre finnas i handlingsplanen:</p><ul class="fs-sm marg-0-0-4">${b.saknasIAr.map(g => `<li>${esc(_abSkalGrupp(g))}</li>`).join('')}</ul>`
        : '';
    return rubrik + tabell + grupper + saknas
        + `<p class="text-dampad-xs marg-4-0-0">Beloppen är summan av skälen i kronor per månad; andelen är av skillnaden i de grupper som hade skäl det året. Kategorierna och beloppen är organisationens bedömning. Verktyget räknar bara om beloppen till andelar av skillnaden. Bara grupper med minst ${j.kGrans} ${personOrd(j.kGrans)}. En grupp där ett kön hade färre personer än minsta gruppstorlek har bara kategorierna i bokslutet och räknas inte med i beloppen.</p>`;
}

/**
 * Antalet kvinnor och män i en flaggad yrkesgrupp i årsjämförelsen: årets antal, eller förra årets märkt med året när
 * gruppen inte finns i år (kolumnen heter "Kvinnor / män {år}"). null utan antal.
 */
function _abGruppAntal(g, nuAr) {
    if (g.nKv == null || g.nMa == null) return null;
    return `${g.nKv} / ${g.nMa}${g.antalAr != null && g.antalAr !== nuAr ? ` (${g.antalAr})` : ''}`;
}

/** Panelen Jämförelse med förra året i Spara och jämför år. */
function renderArsjamforelse() {
    const host = document.getElementById('arsjamforelse');
    if (!host) return;
    const forra = state.forraArsbokslut;
    if (!forra) {
        host.innerHTML = '<p class="text-dampad-sm">Inget årsbokslut inläst. Läs in förra årets konfigurationsfil (<em>Ladda konfiguration</em> ovan), så visas skillnaden här. Årets bokslut följer med när du sparar konfigurationen.</p>';
        return;
    }
    const huvud = `<p class="text-dampad-sm marg-0-0-8">Förra årets bokslut: ${esc(String(forra.ar))}, sparat ${esc(forra.skapat)}${forra.verktyg ? ` (${esc(forra.verktyg)})` : ''}, minsta gruppstorlek ${forra.k}.</p>`;
    if (!state.data.length) { host.innerHTML = huvud + '<p class="text-dampad-sm">Läs in årets lönefil för att se skillnaden.</p>'; return; }
    const jf = arsjamforelse();
    const j = jf ? jf.j : null, nu = jf ? jf.nu : null;
    if (!j || !nu) { host.innerHTML = huvud; return; }
    const kr = v => Math.round(v).toLocaleString('sv-SE') + ' kr';
    const skriv = (v, typ) => v == null ? '–' : typ === 'kr' ? kr(v) : typ === 'pct' ? svPct(v, 1) : String(Math.round(v)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    const diff = (v, typ) => {
        if (v == null) return '<span class="f-dampad">–</span>';
        const tkn = v > 0 ? '+' : v < 0 ? '−' : '±';
        return `<span class="halvfet">${tkn}${skriv(Math.abs(v), typ === 'pct' ? 'pct' : typ)}${typ === 'pct' ? '-enheter' : ''}</span>`;
    };
    const nyckeltal = `<table class="data-table st-088"><thead><tr><th>Mått</th><th class="t-hoger">${forra.ar}</th><th class="t-hoger">${nu.ar}</th><th class="t-hoger">Skillnad</th></tr></thead><tbody>`
        + j.nyckeltal.map(r => `<tr><td>${esc(r.etikett)}</td><td class="t-tal">${skriv(r.forra, r.typ)}</td><td class="t-tal">${skriv(r.nu, r.typ)}</td><td class="t-tal">${diff(r.diff, r.typ)}</td></tr>`).join('')
        + '</tbody></table>';
    const antal = g => _abGruppAntal(g, nu.ar) ?? '–';
    const gruppRad = g => `<tr><td>${esc(g.yrke)}</td><td class="t-tal">${antal(g)}</td><td class="t-tal">${g.gapForra == null ? '–' : svPct(g.gapForra, 1)}</td><td class="t-tal">${g.gapNu == null ? '–' : svPct(g.gapNu, 1)}</td>`
        + `<td class="t-tal">${_abSpridningText(g.spridningForra)}</td><td class="t-tal">${_abSpridningText(g.spridningNu)}</td></tr>`;
    const grupptabell = (rubrik, lista, tom) => `<h4 class="fs-sm marg-10-0-4">${esc(rubrik)} (${lista.length})</h4>` + (lista.length
        ? `<table class="data-table st-088"><thead><tr><th>Yrkesgrupp</th><th class="t-hoger">Kvinnor / män ${nu.ar}</th><th class="t-hoger">Skillnad ${forra.ar}</th><th class="t-hoger">Skillnad ${nu.ar}</th><th class="t-hoger">Lönespridning ${forra.ar}</th><th class="t-hoger">Lönespridning ${nu.ar}</th></tr></thead><tbody>${lista.map(gruppRad).join('')}</tbody></table>`
        : `<p class="text-dampad-sm marg-0">${esc(tom)}</p>`);
    const g = j.grupper;
    const hantel = _abHantelRader(j);
    const grupper = grupptabell('Flaggade båda åren', g.kvar, 'Ingen yrkesgrupp är flaggad båda åren.')
        + grupptabell('Nya flaggade', g.nya, 'Inga nya flaggade yrkesgrupper.')
        + grupptabell('Inte längre flaggade', g.borta, 'Ingen yrkesgrupp har slutat vara flaggad.')
        + (hantel.rader.length ? `<h4 class="fs-sm marg-10-0-4">Förändring per yrkesgrupp</h4><div class="chart-container"><div id="chart-arsjamforelse"></div></div>` : '')
        + (hantel.utelamnade ? `<p class="k-mask-note">${hantel.utelamnade} ${hantel.utelamnade === 1 ? 'yrkesgrupp' : 'yrkesgrupper'} har en löneskillnad bara ett av åren (under tröskeln eller fanns inte) och visas inte i diagrammet.</p>` : '');
    const p = j.punkter;
    const kvar = p.kvarFranForra;
    const punkter = `<p class="text-dampad-sm marg-8-0-4">Förra året var ${p.klaraForra} av ${p.totaltForra} punkter i Att göra avbockade; i år ${p.klaraNu} av ${p.totaltNu}.</p>`
        + (kvar.length ? `<p class="text-dampad-sm marg-0-0-4">Förra årets öppna punkter (${kvar.length}):</p><ul class="fs-sm marg-0-0-8">${kvar.map(q => `<li>${esc(q.titel || q.id)}${q.klarNu ? ' — <strong>klar i år</strong>' : q.finnsNu ? ' — fortfarande öppen' : ' — finns inte längre i listan'}</li>`).join('')}</ul>` : '<p class="text-dampad-sm marg-0">Förra året hade inga öppna punkter.</p>');
    host.innerHTML = huvud + (j.samma_k ? '' : `<p class="k-mask-note">Bokslutet sparades med minsta gruppstorlek ${forra.k}; i år gäller ${nu.k}. Yrkesgrupper och BAS-intervall jämförs bara där de, och för könsuppdelade mått båda könen, når den högre av årens gränser, ${j.kGrans} ${personOrd(j.kGrans)}. En yrkesgrupp som var flaggad förra året men då hade ett kön under ${j.kGrans} ${personOrd(j.kGrans)} räknas därför som ny i år om den är flaggad nu, och förra årets löneskillnad för den visas inte.</p>`)
        + `<h4 class="fs-sm marg-6-0-4">Nyckeltal</h4>${nyckeltal}${_abBasTabellHtml(j, forra.ar, nu.ar)}<h4 class="fs-sm marg-12-0-2">Lika arbete</h4>${grupper}${_abSkalHtml(j, forra.ar, nu.ar)}<h4 class="fs-sm marg-12-0-2">Att göra</h4>${punkter}`
        + `<p class="text-dampad-xs marg-8-0-0">Lönemått bara för yrkesgrupper där båda könen når minsta gruppstorlek; skillnaden är kvinnors medianlön mot mäns, negativt när kvinnor ligger lägre. ${AB_SPRIDNING_NOT}</p>`;
    const el = document.getElementById('chart-arsjamforelse');
    if (el) { const fig = _abHantelFigur(j, forra.ar, nu.ar); if (fig) ritaFigur(el, fig); }
    const elBas = document.getElementById('chart-arsjamforelse-bas');
    if (elBas) { const fig = _abBasHantelFigur(j, forra.ar, nu.ar); if (fig) ritaFigur(elBas, fig); }
}

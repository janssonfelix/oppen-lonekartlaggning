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
        const lika = typeof _ruLikaArbeteGrupper === 'function' ? _ruLikaArbeteGrupper(d, { k, troskel: 5 }) : { grupper: [] };
        /** @type {any} */ let lv = null;
        try { lv = typeof likvardighetResultat === 'function' ? likvardighetResultat() : null; } catch (_e) { lv = null; }
        const { par, utelamnade } = _parForRedovisning(lv && lv.pairs);
        const klara = state._actionChecklistDone || new Set();
        const punkter = typeof buildActionChecklist === 'function' ? buildActionChecklist() : [];
        return _abBygg({
            ar: new Date().getFullYear(), skapat: new Date().toISOString().slice(0, 10), k, verktyg: `v${APP_VERSION}`,
            nyckeltal: { n: bild.n, nKv: bild.nKv, nMa: bild.nMa, medKv: bild.medianKv, medMa: bild.medianMa,
                kvotPct: bild.rawGapPct == null ? null : 100 + bild.rawGapPct, oforklaratPct: bild.unexplainedGapPct,
                antalFlaggade: lika.grupper.filter(g => g.flaggad).length, antalKandidatpar: par.length, utelamnadePar: utelamnade },
            grupper: lika.grupper.filter(g => !g.samladMedian).map(g => ({ yrke: g.yrke, nKv: g.nKv, nMa: g.nMa, medKv: g.medKv, medMa: g.medMa, gapPct: g.kvot * 100 - 100, flaggad: g.flaggad })),
            punkter: punkter.map(p => ({ id: p.id, titel: p.titel, kategori: p.kategori, klar: klara.has(p.id) })),
            basIntervall: getBasIntervals().map(b => _abBasRad(d, b, k)).filter(Boolean),
        });
    });
}

/**
 * Bokslutets rad för ett BAS-intervall: antal, P10, median och P90 när intervallet har minst k personer, och
 * kvinnors och mäns median bara när båda könen når k (samma regel som Lönestruktur). null under k.
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
        medKv: konOk ? Stat.median(kv.map(r => r.lon)) : null, medMa: konOk ? Stat.median(ma.map(r => r.lon)) : null };
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
function _abHantelFigur(j, forraAr, nuAr) {
    const { rader } = _abHantelRader(j);
    if (!rader.length) return null;
    const farg = { mot: PALETTE.semantic.ok, fran: PALETTE.semantic.varning, lika: PALETTE.semantic.neutral };
    const fig = foreEfterFigur({ rader: rader.map(r => ({ namn: r.namn, fore: +r.fore.toFixed(1), efter: +r.efter.toFixed(1), farg: farg[r.riktning] })),
        kolumner: [String(forraAr), String(nuAr)], titel: 'Kvinnors medianlön i procent av mäns', format: 'pct',
        beskrivning: `Kvinnors medianlön i procent av mäns per yrkesgrupp, ${forraAr} (strecket) och ${nuAr} (punkten), sorterade efter förändringens storlek. Grön när kvoten närmat sig lika lön, orange när den fjärmat sig; linjen vid 100 % är lika lön.` });
    return _abEtiketterBortFranStrecket(fig);
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
    const fig = foreEfterFigur({ rader: rader.map(r => ({ namn: r.namn, fore: r.fore, efter: r.efter, farg: PALETTE.semantic.linje, markering: markeringFor(r.bas) })),
        kolumner: [String(forraAr), String(nuAr)], titel: 'Medianlön per BAS-intervall', format: 'kr',
        beskrivning: `Medianlönen per BAS-intervall, ${forraAr} (strecket) och ${nuAr} (punkten). Bara intervall med minst ${j.kGrans} personer båda åren.` });
    return _abEtiketterBortFranStrecket(fig);
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

/** Tabellen Löneutveckling per BAS-intervall i panelen, eller raden om att förra årets bokslut saknar fältet. */
function _abBasTabellHtml(j, forraAr, nuAr) {
    const rubrik = '<h4 class="fs-sm marg-12-0-2">Löneutveckling per BAS-intervall</h4>';
    if (!Array.isArray(j.basIntervall)) {
        return rubrik + '<p class="text-dampad-sm marg-0">Löneutvecklingen per BAS-intervall saknas i förra årets fil: bokslutet sparades med en äldre version av verktyget. Årets bokslut har den, så nästa års jämförelse får den.</p>';
    }
    if (!j.basIntervall.length) return rubrik + `<p class="text-dampad-sm marg-0">Inget BAS-intervall har minst ${j.kGrans} personer.</p>`;
    const matt = [['p10', 'P10'], ['med', 'Median'], ['p90', 'P90']];
    const huvud = `<thead><tr><th scope="col" rowspan="2">BAS-intervall</th><th scope="colgroup" colspan="2" class="t-mitt">Antal</th>`
        + matt.map(([, e]) => `<th scope="colgroup" colspan="3" class="t-mitt">${e}</th>`).join('') + '</tr><tr>'
        + `<th scope="col" class="t-hoger">${forraAr}</th><th scope="col" class="t-hoger">${nuAr}</th>`
        + matt.map(() => `<th scope="col" class="t-hoger">${forraAr}</th><th scope="col" class="t-hoger">${nuAr}</th><th scope="col" class="t-hoger">Förändring</th>`).join('')
        + '</tr></thead>';
    const antal = v => (v == null ? '–' : svTal(v, 0));
    const rad = r => `<tr><th scope="row">BAS ${esc(r.bas)}</th><td class="t-tal">${antal(r.n.forra)}</td><td class="t-tal">${antal(r.n.nu)}</td>`
        + matt.map(([m]) => `<td class="t-tal">${_abKr(r[m].forra)}</td><td class="t-tal">${_abKr(r[m].nu)}</td><td class="t-tal halvfet">${_abForandringText(r[m])}</td>`).join('') + '</tr>';
    const h = _abBasHantelRader(j);
    return rubrik + `<div class="table-container"><table class="data-table st-088" id="arsjamforelse-bas">${huvud}<tbody>${j.basIntervall.map(rad).join('')}</tbody></table></div>`
        + (h.rader.length ? `<h4 class="fs-sm marg-10-0-4">Medianlön per BAS-intervall, ${forraAr} och ${nuAr}</h4><div class="chart-container"><div id="chart-arsjamforelse-bas"></div></div>` : '')
        + (h.utelamnade ? `<p class="k-mask-note">${h.utelamnade} BAS-intervall har median bara ett av åren (färre än minsta gruppstorlek, eller fanns inte) och visas inte i diagrammet.</p>` : '')
        + `<p class="text-dampad-xs marg-4-0-0">Bara intervall med minst ${j.kGrans} personer båda åren (den högre av årens minsta gruppstorlek). Förändringen i kronor och i procent av förra årets värde. Medianen rör sig också när sammansättningen ändras: nyanställda och avgångar påverkar den lika mycket som löneökningar.</p>`;
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
    const gruppRad = g => `<tr><td>${esc(g.yrke)}</td><td class="t-tal">${antal(g)}</td><td class="t-tal">${g.gapForra == null ? '–' : svPct(g.gapForra, 1)}</td><td class="t-tal">${g.gapNu == null ? '–' : svPct(g.gapNu, 1)}</td></tr>`;
    const grupptabell = (rubrik, lista, tom) => `<h4 class="fs-sm marg-10-0-4">${esc(rubrik)} (${lista.length})</h4>` + (lista.length
        ? `<table class="data-table st-088"><thead><tr><th>Yrkesgrupp</th><th class="t-hoger">Kvinnor / män ${nu.ar}</th><th class="t-hoger">Gap ${forra.ar}</th><th class="t-hoger">Gap ${nu.ar}</th></tr></thead><tbody>${lista.map(gruppRad).join('')}</tbody></table>`
        : `<p class="text-dampad-sm marg-0">${esc(tom)}</p>`);
    const g = j.grupper;
    const hantel = _abHantelRader(j);
    const grupper = grupptabell('Flaggade båda åren', g.kvar, 'Ingen yrkesgrupp är flaggad båda åren.')
        + grupptabell('Nya flaggade', g.nya, 'Inga nya flaggade yrkesgrupper.')
        + grupptabell('Inte längre flaggade', g.borta, 'Ingen yrkesgrupp har slutat vara flaggad.')
        + (hantel.rader.length ? `<h4 class="fs-sm marg-10-0-4">Förändring per yrkesgrupp</h4><div class="chart-container"><div id="chart-arsjamforelse"></div></div>` : '')
        + (hantel.utelamnade ? `<p class="k-mask-note">${hantel.utelamnade} ${hantel.utelamnade === 1 ? 'yrkesgrupp' : 'yrkesgrupper'} har gap bara ett av åren (under tröskeln eller fanns inte) och visas inte i diagrammet.</p>` : '');
    const p = j.punkter;
    const kvar = p.kvarFranForra;
    const punkter = `<p class="text-dampad-sm marg-8-0-4">Förra året var ${p.klaraForra} av ${p.totaltForra} punkter i Att göra avbockade; i år ${p.klaraNu} av ${p.totaltNu}.</p>`
        + (kvar.length ? `<p class="text-dampad-sm marg-0-0-4">Förra årets öppna punkter (${kvar.length}):</p><ul class="fs-sm marg-0-0-8">${kvar.map(q => `<li>${esc(q.titel || q.id)}${q.klarNu ? ' — <strong>klar i år</strong>' : q.finnsNu ? ' — fortfarande öppen' : ' — finns inte längre i listan'}</li>`).join('')}</ul>` : '<p class="text-dampad-sm marg-0">Förra året hade inga öppna punkter.</p>');
    host.innerHTML = huvud + (j.samma_k ? '' : `<p class="k-mask-note">Bokslutet sparades med minsta gruppstorlek ${forra.k}; i år gäller ${nu.k}. Yrkesgrupper och BAS-intervall jämförs bara där de, och för könsuppdelade mått båda könen, når den högre av årens gränser, ${j.kGrans} personer. En yrkesgrupp som var flaggad förra året men då hade ett kön under ${j.kGrans} personer räknas därför som ny i år om den är flaggad nu, och förra årets gap för den visas inte.</p>`)
        + `<h4 class="fs-sm marg-6-0-4">Nyckeltal</h4>${nyckeltal}${_abBasTabellHtml(j, forra.ar, nu.ar)}<h4 class="fs-sm marg-12-0-2">Lika arbete</h4>${grupper}<h4 class="fs-sm marg-12-0-2">Att göra</h4>${punkter}`
        + `<p class="text-dampad-xs marg-8-0-0">Lönemått bara för yrkesgrupper där båda könen når minsta gruppstorlek; gapet är kvinnors medianlön mot mäns, negativt när kvinnor ligger lägre.</p>`;
    const el = document.getElementById('chart-arsjamforelse');
    if (el) { const fig = _abHantelFigur(j, forra.ar, nu.ar); if (fig) ritaFigur(el, fig); }
    const elBas = document.getElementById('chart-arsjamforelse-bas');
    if (elBas) { const fig = _abBasHantelFigur(j, forra.ar, nu.ar); if (fig) ritaFigur(elBas, fig); }
}

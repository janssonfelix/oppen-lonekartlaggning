// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
// ---- Årsbokslut och jämförelse med förra året (ADR-54) ----
// Konfigurationsfilen bär ett k-skyddat årsbokslut (src/lib/arsbokslut.js). Läses förra årets fil in ligger dess
// bokslut i state.forraArsbokslut, och panelen i Dokumentera & exportera visar skillnaden mot årets. Allt byggs i
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
        });
    });
}

/** Panelen Jämförelse med förra året i Dokumentera & exportera. */
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
    const nu = byggArsbokslutNu();
    const j = nu && typeof _abJamfor === 'function' ? _abJamfor(forra, nu) : null;
    if (!j) { host.innerHTML = huvud; return; }
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
    const gruppRad = g => `<tr><td>${esc(g.yrke)}</td><td class="t-tal">${g.gapForra == null ? '–' : svPct(g.gapForra, 1)}</td><td class="t-tal">${g.gapNu == null ? '–' : svPct(g.gapNu, 1)}</td></tr>`;
    const grupptabell = (rubrik, lista, tom) => `<h4 class="fs-sm marg-10-0-4">${esc(rubrik)} (${lista.length})</h4>` + (lista.length
        ? `<table class="data-table st-088"><thead><tr><th>Yrkesgrupp</th><th class="t-hoger">Gap ${forra.ar}</th><th class="t-hoger">Gap ${nu.ar}</th></tr></thead><tbody>${lista.map(gruppRad).join('')}</tbody></table>`
        : `<p class="text-dampad-sm marg-0">${esc(tom)}</p>`);
    const g = j.grupper;
    const grupper = grupptabell('Flaggade båda åren', g.kvar, 'Ingen yrkesgrupp är flaggad båda åren.')
        + grupptabell('Nya flaggade', g.nya, 'Inga nya flaggade yrkesgrupper.')
        + grupptabell('Inte längre flaggade', g.borta, 'Ingen yrkesgrupp har slutat vara flaggad.');
    const p = j.punkter;
    const kvar = p.kvarFranForra;
    const punkter = `<p class="text-dampad-sm marg-8-0-4">Förra året var ${p.klaraForra} av ${p.totaltForra} punkter i Att göra avbockade; i år ${p.klaraNu} av ${p.totaltNu}.</p>`
        + (kvar.length ? `<p class="text-dampad-sm marg-0-0-4">Förra årets öppna punkter (${kvar.length}):</p><ul class="fs-sm marg-0-0-8">${kvar.map(q => `<li>${esc(q.titel || q.id)}${q.klarNu ? ' — <strong>klar i år</strong>' : q.finnsNu ? ' — fortfarande öppen' : ' — finns inte längre i listan'}</li>`).join('')}</ul>` : '<p class="text-dampad-sm marg-0">Förra året hade inga öppna punkter.</p>');
    host.innerHTML = huvud + (j.samma_k ? '' : `<p class="k-mask-note">Bokslutet sparades med minsta gruppstorlek ${forra.k}; i år gäller ${nu.k}. Yrkesgrupper jämförs bara där båda könen når respektive års gräns.</p>`)
        + `<h4 class="fs-sm marg-6-0-4">Nyckeltal</h4>${nyckeltal}<h4 class="fs-sm marg-12-0-2">Lika arbete</h4>${grupper}<h4 class="fs-sm marg-12-0-2">Att göra</h4>${punkter}`
        + `<p class="text-dampad-xs marg-8-0-0">Lönemått bara för yrkesgrupper där båda könen når minsta gruppstorlek; gapet är kvinnors medianlön mot mäns, negativt när kvinnor ligger lägre.</p>`;
}

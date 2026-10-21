// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson

// ---- § 8-ställning: bedömning per granskningsområde (in-memory) ----
// § 8 del 1 (bestämmelser & praxis) är kvalitativ. Fliken ger vägledning per
// område; här renderas en bedömnings-kontroll (status + anteckning) i varje
// område. Värdena lever i DOM (som struktur-narrativet) — inget lagras på disk —
// och plockas in i Word-utkastet och utskriften. Fälten injiceras i de statiska
// `.bes8-assess`-platshållarna så HTML-källan hålls torr.
const BES8_STATUS = [
    ['', '— Ej bedömt ännu —'],
    ['Ingen risk identifierad', 'Ingen risk identifierad'],
    ['Möjlig risk – utreds vidare', 'Möjlig risk – utreds vidare'],
    ['Åtgärd krävs', 'Åtgärd krävs'],
    ['Ej tillämplig', 'Ej tillämplig']
];
/** Områdets rubrik: avsnittets titel, utan statusmärket som står bredvid den. */
function _bes8Titel(det, n) {
    const t = det && (det.querySelector('summary .avsnitt-titel') || det.querySelector('summary'));
    return t ? t.textContent.trim() : ('Område ' + n);
}
function _setupBes8Assessment() {
    document.querySelectorAll('.bes8-assess').forEach((host, i) => {
        if (/** @type {HTMLElement} */ (host).dataset.ready) return;
        const n = i + 1;
        const det = host.closest('details');
        const label = _bes8Titel(det, n);
        host.innerHTML =
            `<h4 class="marg-t-12">Din bedömning</h4>`
            + `<p class="text-dampad-xs marg-0-0-4">Sparas i minnet och följer med i Word-utkastet och utskriften.</p>`
            + `<select id="bes8-status-${n}" class="form-select bes8-field" aria-label="Bedömning: ${esc(label)}">`
            + BES8_STATUS.map(([v, l]) => `<option value="${esc(v)}">${esc(l)}</option>`).join('')
            + `</select>`
            + `<textarea id="bes8-note-${n}" class="bes8-field ram-1-kant rund-4 ruta-border typsnitt-arv fs-sm marg-t-6 pad-6-8 bredd-100p" rows="2" autocomplete="off" placeholder="Iakttagelser och eventuell åtgärd — skriv på gruppnivå, inga namn eller personnummer …" aria-label="Anteckning: ${esc(label)}"></textarea>`;
        /** @type {HTMLElement} */ (host).dataset.ready = '1';
    });
}
_setupBes8Assessment();

/** Läser § 8-områdenas titel + bedömning + anteckning från DOM (sorterat). */
function _bes8Areas() {
    const out = [];
    document.querySelectorAll('[id^="bes8-status-"]').forEach(sel => {
        const n = sel.id.replace('bes8-status-', '');
        const note = document.getElementById('bes8-note-' + n);
        out.push({ n: Number(n), title: _bes8Titel(sel.closest('details'), n), status: /** @type {HTMLInputElement} */ (sel).value, note: note ? /** @type {HTMLInputElement} */ (note).value.trim() : '' });
    });
    return out.sort((a, b) => a.n - b.n);
}

// ---- Flikens topp: hur många områden som är bedömda, och statusen i varje områdes rubrik ----
// Utan den syns det först i Dokumentera att inget är ifyllt. Uppdateras när en bedömning ändras, när fliken visas,
// när en konfigurationsfil lästs in och när allt rensats.
const BES8_IKON = { 'Ingen risk identifierad': 'bock', 'Möjlig risk – utreds vidare': 'statusVarning', 'Åtgärd krävs': 'statusKritisk', 'Ej tillämplig': 'streck' };
function bes8Uppdatera() {
    const omraden = _bes8Areas();
    const antal = s => omraden.filter(a => a.status === s).length;
    const bedomda = omraden.filter(a => a.status).length, atgard = antal('Åtgärd krävs'), risk = antal('Möjlig risk – utreds vidare');
    const topp = document.getElementById('rp-slutsatser');
    if (topp) {
        topp.innerHTML = _laSlutsats('Bedömda områden', `${bedomda} av ${omraden.length}`, bedomda === omraden.length ? 'alla områden är bedömda' : `${omraden.length - bedomda} återstår`)
            + _laSlutsats('Åtgärd krävs', svTal(atgard, 0), atgard ? 'för in åtgärden i handlingsplanen' : 'inget område', atgard > 0)
            + _laSlutsats('Möjlig risk', svTal(risk, 0), risk ? 'utreds vidare' : 'inget område');
    }
    for (const a of omraden) {
        const marke = document.getElementById('nyckel-rp-' + a.n);
        if (!marke) continue;
        marke.innerHTML = a.status ? `${ikon(BES8_IKON[a.status] || 'streck')} ${esc(a.status)}` : 'Ej bedömt';
        marke.classList.toggle('ar-kritisk', a.status === 'Åtgärd krävs');
        marke.classList.toggle('ar-bedomd', !!a.status);
    }
}
document.addEventListener('change', e => { if (/** @type {HTMLElement} */ (e.target).closest && /** @type {HTMLElement} */ (e.target).closest('[id^="bes8-status-"]')) bes8Uppdatera(); });
bes8Uppdatera();

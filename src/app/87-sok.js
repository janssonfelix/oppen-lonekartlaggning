// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
// ---- Sök och hoppa ----
/**
 * Ett fält i sidhuvudet: skriv ett yrke eller ett BAS-intervall, välj en träff, och gruppen markeras i alla diagram
 * och tabeller (11-markering.js). Raden om markeringen bär länken till gruppdossiern.
 *
 * Dataskydd: bara grupper som får visas går att söka fram — BAS-intervall och yrkesgrupper med minst tröskeln
 * personer, samma urval som gruppdossiern och det som går att klicka på i diagrammen. En sökning som inte ger någon
 * träff säger inte om en mindre grupp finns. Söktexten sparas inte och lämnar inte sidan.
 */
const SOK_MAX_TRAFFAR = 8;
let _sokTraffar = [], _sokAktiv = -1;

/** Jämförelseform: gemener utan accenter och prickar, så att "skoterska" hittar "sköterska" (också utan svenskt tangentbord). */
function _sokNorm(s) {
    return String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim();
}

/** Allt som går att söka fram: BAS-intervall och yrkesgrupper som når tröskeln. */
function sokKandidater() {
    const d = getData();
    if (!d.length) return [];
    const perBas = new Map();
    for (const r of d) if (r.bas != null && r.bas !== '') perBas.set(r.bas, (perBas.get(r.bas) || 0) + 1);
    const ut = [...perBas].filter(([, n]) => !isKMasked(n)).sort((a, b) => String(a[0]).localeCompare(String(b[0]), 'sv'))
        .map(([bas, n]) => ({ nyckel: `bas:${bas}`, namn: `BAS ${bas}`, under: 'BAS-intervall', n, sok: _sokNorm(`bas ${bas} bas-intervall ${bas}`) }));
    for (const g of gruppdossierCandidates()) {
        ut.push({ nyckel: `grupp:${g.key}`, namn: String(g.yrke || g.aid), under: `Yrkesgrupp · BAS ${g.bas}`, n: g.rows.length, sok: _sokNorm(`${g.yrke} ${g.aid} bas ${g.bas}`) });
    }
    return ut;
}

/** Träffarna för en söktext: varje ord i texten ska finnas i gruppens namn, kod eller BAS. Träffar i början av ett ord i namnet först (namnen börjar med AID-koden). */
function sokTraffar(text) {
    const ord = _sokNorm(text).split(' ').filter(Boolean);
    if (!ord.length) return [];
    return sokKandidater().filter(k => ord.every(o => k.sok.includes(o)))
        .map(k => ({ ...k, rang: _sokNorm(k.namn).split(' ').some(o => o.startsWith(ord[0])) ? 0 : 1 }))
        .sort((a, b) => a.rang - b.rang || b.n - a.n).slice(0, SOK_MAX_TRAFFAR);
}

function _sokRita() {
    const falt = document.getElementById('sok-grupp'), lista = document.getElementById('sok-grupp-lista');
    if (!falt || !lista) return;
    const text = /** @type {HTMLInputElement} */ (falt).value.trim();
    _sokTraffar = sokTraffar(text);
    _sokAktiv = _sokTraffar.length ? 0 : -1;
    if (!text) { lista.hidden = true; lista.innerHTML = ''; falt.setAttribute('aria-expanded', 'false'); falt.removeAttribute('aria-activedescendant'); return; }
    lista.innerHTML = _sokTraffar.length
        ? _sokTraffar.map((t, i) => `<li role="option" id="sok-traff-${i}" data-sok-index="${i}" aria-selected="${i === _sokAktiv}"><span class="sok-namn">${esc(t.namn)}</span><span class="sok-under">${esc(t.under)} · ${svTal(t.n, 0)} personer</span></li>`).join('')
        : `<li class="sok-ingen" role="presentation">Ingen grupp matchar. Grupper med färre än ${kTroskel()} personer går inte att söka fram.</li>`;
    lista.hidden = false;
    falt.setAttribute('aria-expanded', 'true');
    _sokMarkeraAktiv();
}
function _sokMarkeraAktiv() {
    const falt = /** @type {HTMLElement} */ (document.getElementById('sok-grupp'));
    document.querySelectorAll('#sok-grupp-lista [role="option"]').forEach((li, i) => li.setAttribute('aria-selected', String(i === _sokAktiv)));
    if (_sokAktiv >= 0) falt.setAttribute('aria-activedescendant', `sok-traff-${_sokAktiv}`); else falt.removeAttribute('aria-activedescendant');
}
function _sokStang({ tom = true } = {}) {
    const falt = document.getElementById('sok-grupp'), lista = document.getElementById('sok-grupp-lista');
    if (!falt || !lista) return;
    if (tom) /** @type {HTMLInputElement} */ (falt).value = '';
    lista.hidden = true; lista.innerHTML = '';
    falt.setAttribute('aria-expanded', 'false'); falt.removeAttribute('aria-activedescendant');
    _sokTraffar = []; _sokAktiv = -1;
}
/** Markerar träffen i alla diagram och tabeller. En grupp som redan är den enda markerade står kvar markerad. */
function sokValj(i) {
    const t = _sokTraffar[i];
    if (!t) return;
    const nu = diagramMarkering();
    if (!(nu && nu.length === 1 && nu[0] === t.nyckel)) sattDiagramMarkering(t.nyckel);
    _sokStang();
}
/** Fältet visas bara när det finns något att söka i. Anropas när data läses in, rensas eller tröskeln ändras. */
function sokUppdatera() {
    const ruta = document.getElementById('sok-ruta');
    if (!ruta) return;
    const har = (() => { try { return getData().length > 0; } catch (_e) { return false; } })();
    ruta.hidden = !har;
    if (!har) _sokStang();
}

document.getElementById('sok-grupp')?.addEventListener('input', _sokRita);
document.getElementById('sok-grupp')?.addEventListener('focus', () => { if (/** @type {HTMLInputElement} */ (document.getElementById('sok-grupp')).value.trim()) _sokRita(); });
document.getElementById('sok-grupp')?.addEventListener('keydown', e => {
    const oppen = !/** @type {HTMLElement} */ (document.getElementById('sok-grupp-lista')).hidden;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        if (!_sokTraffar.length) return;
        e.preventDefault();
        _sokAktiv = (_sokAktiv + (e.key === 'ArrowDown' ? 1 : -1) + _sokTraffar.length) % _sokTraffar.length;
        _sokMarkeraAktiv();
    } else if (e.key === 'Enter') {
        if (_sokAktiv >= 0) { e.preventDefault(); sokValj(_sokAktiv); }
    } else if (e.key === 'Escape' && (oppen || /** @type {HTMLInputElement} */ (e.target).value)) {
        // Escape i fältet stänger listan; markeringen (som Escape annars tar bort) rörs inte.
        e.stopPropagation();
        _sokStang();
    }
});
document.getElementById('sok-grupp-lista')?.addEventListener('mousedown', e => e.preventDefault());   // fältet behåller fokus vid klick i listan
document.getElementById('sok-grupp-lista')?.addEventListener('click', e => {
    const li = /** @type {HTMLElement} */ (e.target).closest('[data-sok-index]');
    if (li) sokValj(Number(li.getAttribute('data-sok-index')));
});
document.getElementById('sok-grupp')?.addEventListener('blur', () => _sokStang({ tom: false }));
// Kortkommandon: "/" (utanför textfält) och Ctrl/Cmd+K sätter fokus i sökfältet.
document.addEventListener('keydown', e => {
    const falt = document.getElementById('sok-grupp'), ruta = document.getElementById('sok-ruta');
    if (!falt || !ruta || ruta.hidden) return;
    const iFalt = e.target && /** @type {HTMLElement} */ (e.target).matches && /** @type {HTMLElement} */ (e.target).matches('input, textarea, select, [contenteditable="true"]');
    const snabb = (e.key === '/' && !iFalt && !e.ctrlKey && !e.metaKey && !e.altKey) || ((e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === 'k');
    if (!snabb || document.querySelector('[role="dialog"][style*="flex"]')) return;
    e.preventDefault();
    falt.focus(); /** @type {HTMLInputElement} */ (falt).select();
});

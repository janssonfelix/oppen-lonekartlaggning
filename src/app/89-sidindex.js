// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
// ---- Sidindex ("På den här sidan") ----
/**
 * En lista över flikens avsnitt som följer med när sidan rullas: rubriken i varje utfällbart avsnitt
 * (details.avsnitt > summary h2|h3) och varje kort (.card-header > h2) som syns. Ett avsnitt som är dolt (hidden,
 * .dold, display: none, eller utan ruta i webbläsaren) står inte i listan, och färre än tre poster ger inget index.
 * Listan byggs när fliken ritas (renderTabContent i 31-navigering.js), alltså också efter en inläsning. Ett klick
 * fäller ut avsnittet, rullar fram det och ger dess summary fokus. Posten för avsnittet som står överst i fönstret
 * är markerad (IntersectionObserver; utan den den första). Kompakt läge ändrar ingenting här.
 * Från 1920 punkter står listan i en spalt i marginalen till höger om innehållet, smalare än så som en utfällbar rad
 * överst som också följer med och säger vilket avsnitt läsaren är i (style.css, klassen har-sidindex på .content-body;
 * där står varför spalten börjar först vid 1920).
 */
const SIDINDEX_MINST = 3;
const SIDINDEX_BRED = '(min-width: 1920px)';   // samma brytpunkt som style.css
/** @type {IntersectionObserver|null} */
let _sidindexBevakare = null;
/** @type {ResizeObserver|null} */
let _sidindexStorlek = null;
/** Rubrikerna som följs, i sidans ordning: { el: summary eller kortrubrik, id: avsnittets id }. */
let _sidindexOrdning = /** @type {{el: Element, id: string}[]} */ ([]);
/** Markerar avsnittet som läslinjen står i. */
function _sidindexFolj() {
    if (!_sidindexOrdning.length) return;
    const linje = window.innerHeight * 0.4;
    let aktiv = _sidindexOrdning[0];
    for (const o of _sidindexOrdning) { if (o.el.getBoundingClientRect().top <= linje) aktiv = o; else break; }
    _sidindexMarkera(aktiv.id);
}

/** Elementet eller något ovanför det fram till `stopp` är dolt i markeringen. `.dold` döljer bara när ingen
 *  inline-stil visar elementet (panelerna och exportkortet visas med style.display = 'block'). */
function _sidindexDoltIMarkering(el, stopp) {
    for (let n = el; n && n !== stopp; n = n.parentElement) {
        if (n.hidden || n.style.display === 'none' || (n.classList.contains('dold') && !n.style.display)) return true;
    }
    return false;
}
/** Webbläsaren har ritat sidan (jsdom har ingen layout: där avgör markeringen ensam). */
function _sidindexHarLayout() {
    return document.documentElement.getBoundingClientRect().width > 0;
}
function _sidindexBred() {
    return typeof window.matchMedia === 'function' && window.matchMedia(SIDINDEX_BRED).matches === true;
}
/** Flikens synliga avsnittsrubriker i sidans ordning: { rubrik, mal } där mal är avsnittet eller kortet. */
function _sidindexRubriker(flik) {
    const ut = [], layout = _sidindexHarLayout();
    for (const p of (PANEL_GROUPS[flik] || [flik])) {
        const panel = document.getElementById('view-' + p);
        if (!panel || _sidindexDoltIMarkering(panel, panel.parentElement)) continue;
        panel.querySelectorAll('details.avsnitt > summary h2, details.avsnitt > summary h3, .card-header > h2').forEach(h => {
            const mal = h.closest('details, section, .card');
            if (!mal || !panel.contains(mal)) return;
            if (_sidindexDoltIMarkering(h, panel) || (layout && /** @type {HTMLElement} */ (h).offsetParent === null)) return;
            const rubrik = (h.textContent || '').replace(/\s+/g, ' ').trim();
            if (rubrik) ut.push({ rubrik, mal: /** @type {HTMLElement} */ (mal) });
        });
    }
    return ut;
}
/** Elementet som får fokus för ett avsnitt: summaryn, för ett kort dess rubrik. */
function _sidindexFokusmal(mal) {
    return mal.querySelector(':scope > summary') || mal.querySelector('.card-header > h2') || mal;
}
/** Markerar posten för avsnittet `id` och skriver dess rubrik i raden (På den här sidan: …), så att den hopfällda
 *  raden på smala skärmar säger var läsaren är. */
function _sidindexMarkera(id) {
    let rubrik = '';
    document.querySelectorAll('#sidindex a[data-sidindex]').forEach(a => {
        const aktiv = /** @type {HTMLElement} */ (a).dataset.sidindex === id;
        a.classList.toggle('ar-aktiv', aktiv);
        if (aktiv) { a.setAttribute('aria-current', 'location'); rubrik = (a.textContent || '').trim(); } else a.removeAttribute('aria-current');
    });
    const nu = document.querySelector('#sidindex .sidindex-nu');
    if (nu && rubrik) nu.textContent = rubrik;
}
/** Radens höjd som --sidindex-hojd på .content-body: raden med det markerade och avsnitten som rullas fram lägger
 *  sig under den (style.css). */
function _sidindexHojd(nav) {
    const satt = () => nav.parentElement?.style.setProperty('--sidindex-hojd', Math.ceil(nav.getBoundingClientRect().height) + 'px');
    satt();
    if (typeof window.ResizeObserver === 'function' && !_sidindexStorlek) { _sidindexStorlek = new ResizeObserver(satt); _sidindexStorlek.observe(nav); }
}

/** Fyller #sidindex med flikens synliga avsnitt, eller döljer det när de är färre än tre. */
function sidindexBygg(flik) {
    const nav = document.getElementById('sidindex');
    if (!nav) return;
    if (_sidindexBevakare) { _sidindexBevakare.disconnect(); _sidindexBevakare = null; }
    _sidindexOrdning = [];
    const poster = _sidindexRubriker(flik);
    const visas = poster.length >= SIDINDEX_MINST;
    nav.hidden = !visas;
    nav.parentElement?.classList.toggle('har-sidindex', visas);
    if (!visas) { nav.innerHTML = ''; return; }
    poster.forEach(({ mal }, i) => {
        if (mal.id) return;
        let n = i + 1;
        while (document.getElementById(`avsnitt-${flik}-${n}`)) n++;
        mal.id = `avsnitt-${flik}-${n}`;
    });
    // I spalten är listan alltid utfälld; på smal skärm behåller en ombyggd lista läsarens val (först hopfälld).
    const oppen = _sidindexBred() || /** @type {HTMLDetailsElement|null} */ (nav.querySelector('.sidindex-ram'))?.open === true;
    nav.innerHTML = `<span class="sidindex-etikett" aria-hidden="true">På den här sidan</span>`
        + `<details class="sidindex-ram"${oppen ? ' open' : ''}><summary>På den här sidan<span class="sidindex-kolon">: </span><span class="sidindex-nu"></span></summary><ul class="sidindex-lista">`
        + poster.map(({ rubrik, mal }) => `<li><a href="#" data-sidindex="${esc(mal.id)}">${esc(rubrik)}</a></li>`).join('')
        + '</ul></details>';
    _sidindexMarkera(poster[0].mal.id);
    _sidindexHojd(nav);
    if (typeof window.IntersectionObserver !== 'function') return;
    // Aktivt är avsnittet som läslinjen (40 % ned i fönstret) står i: den sista rubriken ovanför linjen. Observatören
    // säger till när en rubrik passerar fönstrets övre del; ett hopp förbi en rubrik (ett långt rullsteg) fångas av
    // rullningen nedan, som räknar om samma sak.
    _sidindexOrdning = poster.map(({ mal }) => ({ el: _sidindexFokusmal(mal), id: mal.id }));
    const bevakare = new IntersectionObserver(_sidindexFolj, { rootMargin: '0px 0px -60% 0px' });
    _sidindexOrdning.forEach(o => bevakare.observe(o.el));
    _sidindexBevakare = bevakare;
}

/** Leder till ett avsnitt: fäller ut det (och det det ligger i), rullar fram det och ger summaryn fokus. */
function sidindexGaTill(id) {
    const mal = document.getElementById(id);
    if (!mal) return;
    oppnaHopfallda(mal);
    // På smal skärm är listan en utfälld rad överst som följer med: den fälls ihop först, så att den inte täcker
    // avsnittet och rullningen (scroll-margin, radens höjd) räknas på den hopfällda raden.
    const ram = /** @type {HTMLDetailsElement|null} */ (document.querySelector('#sidindex .sidindex-ram'));
    if (ram && !_sidindexBred() && ram.open) { ram.open = false; _sidindexHojd(/** @type {HTMLElement} */ (document.getElementById('sidindex'))); }
    const reducerad = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches === true;
    if (typeof mal.scrollIntoView === 'function') mal.scrollIntoView({ block: 'start', behavior: reducerad ? 'auto' : 'smooth' });
    const fokus = _sidindexFokusmal(mal);
    // En summary går redan att fokusera; en rubrik får tabindex="-1" så att den kan få fokus utan att hamna i tabbordningen.
    if (fokus.tagName !== 'SUMMARY' && !fokus.hasAttribute('tabindex')) fokus.setAttribute('tabindex', '-1');
    fokus.focus({ preventScroll: true });
    _sidindexMarkera(id);
}

// Delegerad klick, som hopplänkarna i 33-sidans-innehall.js: adressen ändras inte.
document.addEventListener('click', e => {
    const a = /** @type {HTMLElement} */ (e.target).closest('[data-sidindex]');
    if (!a) return;
    e.preventDefault();
    sidindexGaTill(/** @type {HTMLElement} */ (a).dataset.sidindex || '');
});
let _sidindexRam = 0;
window.addEventListener('scroll', () => {
    if (!_sidindexBevakare || _sidindexRam) return;
    _sidindexRam = requestAnimationFrame(() => { _sidindexRam = 0; _sidindexFolj(); });
}, { passive: true });
// Breddas fönstret förbi brytpunkten står listan i spalten och är alltid utfälld; smalnas det av blir den den
// hopfällda raden överst, som annars skulle täcka innehållet när den följer med.
if (typeof window.matchMedia === 'function') {
    const bred = window.matchMedia(SIDINDEX_BRED);
    bred.addEventListener?.('change', () => {
        const ram = /** @type {HTMLDetailsElement|null} */ (document.querySelector('#sidindex .sidindex-ram'));
        if (ram) ram.open = bred.matches;
    });
}

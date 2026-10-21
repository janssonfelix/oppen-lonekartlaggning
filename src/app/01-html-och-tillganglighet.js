// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson

// ---- Utilities ----
/**
 * HTML-eskapera en sträng för säker interpolering i innerHTML.
 * Escapear även citattecken (" ') så strängen är säker även i ATTRIBUT-kontext
 * (t.ex. `title="${esc(x)}"`, `data-bas="${esc(b)}"`). Webbläsaren avkodar
 * entiteterna vid läsning av attribut/`.value`, så round-trips (dataset, option-
 * value) fungerar oförändrat. Utan citattecknen kunde ett osanerat fält (t.ex. BAS)
 * bryta sig ut ur attributet.
 * @param {*} s - Värde att eskapera (null/undefined → tom sträng).
 * @returns {string} HTML-säker sträng (text- och attributkontext).
 */
const esc = s => String(s ?? "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;");


// GDPR: stäng av webbläsarens autofyllning på alla input/select/textarea så att organisationsnamn, sökord,
// anteckningar m.m. inte sparas i webbläsarens autofyll-historik (som kan synkas till leverantörens moln vid
// Chrome Sync/Edge Sync etc.). Gäller sidans fasta fält och alla fält som skapas medan användaren arbetar
// (anteckningarna i Regler & praxis, Löneöversyns riktade rader, Utforska …): en observatör sätter attributet
// på varje fält som läggs till i dokumentet, och flikritningen (renderTabContent) gör det en gång till
// synkront. Vaktas av tests/troskelbeslut.test.js.
/**
 * Sätter autocomplete="off" på varje fält under `rot` (och på `rot` självt) som saknar attributet.
 * @param {Document|Element} [rot]
 */
function stangAutofyll(rot = document) {
    if (!rot || typeof rot.querySelectorAll !== 'function') return;
    const satt = el => { if (/** @type {HTMLInputElement} */ (el).type !== 'file' && !el.hasAttribute('autocomplete')) el.setAttribute('autocomplete', 'off'); };
    if (rot instanceof Element && rot.matches('input, select, textarea')) satt(rot);
    rot.querySelectorAll('input, select, textarea').forEach(satt);
}
stangAutofyll(document);
if (typeof MutationObserver === 'function') {
    // Bara HTML-element prövas: diagrammens tusentals SVG-noder kan inte bära fält.
    const HTML_NS = 'http://www.w3.org/1999/xhtml';
    new MutationObserver(poster => {
        for (const m of poster) for (const n of m.addedNodes) if (n instanceof Element && n.namespaceURI === HTML_NS) stangAutofyll(n);
    }).observe(document.documentElement, { childList: true, subtree: true });
}

// ---- WCAG 2.1 AA: Tillgänglighetshelpers ----

// Focus trap för modaler: håller tabbning kvar inom modalen och
// återställer fokus till öppnande element vid stängning.
const _focusTraps = new Map();
/**
 * Aktiverar focus trap i en modal: Tab/Shift+Tab cyklar mellan första/sista
 * fokuserbara element. Sparar referens till opener-elementet så fokus kan
 * återställas vid stängning. WCAG 2.1 AA / 2.4.3 Focus Order.
 * @param {HTMLElement} modalEl - Modalens rotelement.
 * @param {Element|null} [openerEl] - Element att fokusera vid stängning (default: aktivt element).
 */
function trapFocus(modalEl, openerEl) {
    if (!modalEl) return;
    const focusables = modalEl.querySelectorAll(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]), summary'
    );
    if (focusables.length === 0) return;
    const first = focusables[0];
    const last  = focusables[focusables.length - 1];

    const handler = e => {
        if (e.key !== 'Tab') return;
        if (e.shiftKey && document.activeElement === first) {
            e.preventDefault(); /** @type {HTMLInputElement} */ (last).focus();
        } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault(); /** @type {HTMLInputElement} */ (first).focus();
        }
    };
    modalEl.addEventListener('keydown', handler);
    _focusTraps.set(modalEl, { handler, opener: openerEl || document.activeElement });
    setTimeout(() => /** @type {HTMLInputElement} */ (first).focus(), 50);
}
/**
 * Lossar focus trap från modal och återställer fokus till opener-elementet.
 * @param {HTMLElement} modalEl
 */
function releaseFocus(modalEl) {
    const trap = _focusTraps.get(modalEl);
    if (trap) {
        modalEl.removeEventListener('keydown', trap.handler);
        if (trap.opener && trap.opener.focus) trap.opener.focus();
        _focusTraps.delete(modalEl);
    }
}

// Aria-live announcer för skärmläsare. Läser upp dynamiska statusändringar.
/** @type {HTMLElement|null} */
let _liveRegion = null;
function _ensureLiveRegion() {
    if (_liveRegion) return _liveRegion;
    _liveRegion = document.createElement('div');
    _liveRegion.id = 'aria-live-announcer';
    _liveRegion.setAttribute('aria-live', 'polite');
    _liveRegion.setAttribute('aria-atomic', 'true');
    _liveRegion.className = 'sr-only';
    document.body.appendChild(_liveRegion);
    return _liveRegion;
}
/**
 * Annonserar dynamisk statusändring till skärmläsare via aria-live="polite".
 * Tömmer regionen först (50ms-paus) för att tvinga om-annoncering även när
 * samma text annonceras igen. WCAG 4.1.3 Status Messages.
 * @param {string} message
 */
function announceToScreenReader(message) {
    const region = _ensureLiveRegion();
    region.textContent = '';
    setTimeout(() => { region.textContent = message; }, 50);
}

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
export const esc = s => String(s ?? "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;");

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
export function stangAutofyll(rot = document) {
    if (!rot || typeof rot.querySelectorAll !== 'function') return;
    const satt = el => { if (/** @type {HTMLInputElement} */ (el).type !== 'file' && !el.hasAttribute('autocomplete')) el.setAttribute('autocomplete', 'off'); };
    if (rot instanceof Element && rot.matches('input, select, textarea')) satt(rot);
    rot.querySelectorAll('input, select, textarea').forEach(satt);
}

// ---- WCAG 2.1 AA: Tillgänglighetshelpers ----

// Focus trap för modaler: håller tabbning kvar inom modalen och
// återställer fokus till öppnande element vid stängning.
export const _fokusfallor = new Map();
/**
 * Aktiverar focus trap i en modal: Tab/Shift+Tab cyklar mellan första/sista
 * fokuserbara element. Sparar referens till opener-elementet så fokus kan
 * återställas vid stängning. WCAG 2.1 AA / 2.4.3 Focus Order.
 * @param {HTMLElement} modalEl - Modalens rotelement.
 * @param {Element|null} [openerEl] - Element att fokusera vid stängning (default: aktivt element).
 * @param {{flyttaFokus?: boolean}} [val] - flyttaFokus: false när fällan läggs om i en dialog som redan är öppen.
 *   Fokus står då kvar där det är; annars flyttas det till det första elementet en kort stund senare, och text som
 *   användaren hunnit börja skriva i ett annat fält hamnar där i stället.
 */
export function fangaFokus(modalEl, openerEl, { flyttaFokus = true } = {}) {
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
    _fokusfallor.set(modalEl, { handler, opener: openerEl || document.activeElement });
    if (flyttaFokus) setTimeout(() => /** @type {HTMLInputElement} */ (first).focus(), 50);
}
/**
 * Lossar focus trap från modal och återställer fokus till opener-elementet.
 * @param {HTMLElement} modalEl
 */
export function slappFokus(modalEl) {
    const trap = _fokusfallor.get(modalEl);
    if (trap) {
        modalEl.removeEventListener('keydown', trap.handler);
        if (trap.opener && trap.opener.focus) trap.opener.focus();
        _fokusfallor.delete(modalEl);
    }
}

// Aria-live announcer för skärmläsare. Läser upp dynamiska statusändringar.
/** @type {HTMLElement|null} */
let _skarmlasarRegion = null;
function _hamtaSkarmlasarRegion() {
    if (_skarmlasarRegion) return _skarmlasarRegion;
    _skarmlasarRegion = document.createElement('div');
    _skarmlasarRegion.id = 'aria-live-announcer';
    _skarmlasarRegion.setAttribute('aria-live', 'polite');
    _skarmlasarRegion.setAttribute('aria-atomic', 'true');
    _skarmlasarRegion.className = 'sr-only';
    document.body.appendChild(_skarmlasarRegion);
    return _skarmlasarRegion;
}
/**
 * Annonserar dynamisk statusändring till skärmläsare via aria-live="polite".
 * Tömmer regionen först (50ms-paus) för att tvinga om-annoncering även när
 * samma text annonceras igen. WCAG 4.1.3 Status Messages.
 * @param {string} message
 */
export function meddelaSkarmlasare(message) {
    const region = _hamtaSkarmlasarRegion();
    region.textContent = '';
    setTimeout(() => { region.textContent = message; }, 50);
}

/** Det som körs vid laddning, i filens ordning; src/app/index.js anropar delarnas uppstart i sifferordning. */
export function uppstartHtmlOchTillganglighet() {
    stangAutofyll(document);
    if (typeof MutationObserver === 'function') {
        // Bara HTML-element prövas: diagrammens tusentals SVG-noder kan inte bära fält.
        const HTML_NS = 'http://www.w3.org/1999/xhtml';
        new MutationObserver(poster => {
            for (const m of poster) for (const n of m.addedNodes) if (n instanceof Element && n.namespaceURI === HTML_NS) stangAutofyll(n);
        }).observe(document.documentElement, { childList: true, subtree: true });
    }
}

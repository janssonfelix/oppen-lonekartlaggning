// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson

// esc står i src/lib/htmltext.js, så att lib och app escapar på samma sätt.
import { esc } from '../lib/htmltext.js';
export { esc };

// GDPR: stäng av webbläsarens autofyllning på alla input/select/textarea så att organisationsnamn, sökord,
// anteckningar m.m. inte sparas i webbläsarens autofyll-historik (som kan synkas till leverantörens moln vid
// Chrome Sync/Edge Sync etc.). Gäller sidans fasta fält och alla fält som skapas medan användaren arbetar
// (anteckningarna i Regler & praxis, Löneöversyns riktade rader, Utforska …): en observatör sätter attributet
// på varje fält som läggs till i dokumentet, och flikritningen (ritaFlik) gör det en gång till
// synkront. Vaktas av tests/dataskydd-app.test.js.
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

const _FOKUSERBARA = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]), summary';
/** De element under `rot` som Tab stannar på, i dokumentets ordning; det som står i något dolt (`hidden`) räknas inte. */
function _fokuserbara(rot) {
    return /** @type {HTMLElement[]} */ ([...rot.querySelectorAll(_FOKUSERBARA)]).filter(el => !el.closest('[hidden]'));
}

// Focus trap för modaler: håller tabbning kvar inom modalen och
// återställer fokus till öppnande element vid stängning.
export const _fokusfallor = new Map();
/**
 * Aktiverar focus trap i en modal: Tab/Shift+Tab cyklar mellan första/sista
 * fokuserbara element. Sparar referens till opener-elementet så fokus kan
 * återställas vid stängning. WCAG 2.1 AA / 2.4.3 Focus Order.
 * Elementen räknas när Tab trycks, så att fällan håller också när dialogen ritar om sitt innehåll (ordlistans sökning,
 * dossierns väljare). En dialog som redan har en fälla behåller sin öppnare.
 * @param {HTMLElement} modalEl - Modalens rotelement.
 * @param {Element|null} [openerEl] - Element att fokusera vid stängning (default: aktivt element).
 * @param {{flyttaFokus?: boolean}} [val] - flyttaFokus: false när den som öppnar sätter fokus själv; annars flyttas
 *   det till det första elementet en kort stund senare.
 */
export function fangaFokus(modalEl, openerEl, { flyttaFokus = true } = {}) {
    if (!modalEl) return;
    const forra = _fokusfallor.get(modalEl);
    if (forra) modalEl.removeEventListener('keydown', forra.handler);
    const handler = e => {
        if (e.key !== 'Tab') return;
        const f = _fokuserbara(modalEl);
        if (!f.length) return;
        const forsta = f[0], sista = f[f.length - 1], nu = document.activeElement;
        if (e.shiftKey ? nu === forsta || !f.includes(/** @type {HTMLElement} */ (nu)) : nu === sista) {
            e.preventDefault();
            (e.shiftKey ? sista : forsta).focus();
        }
    };
    modalEl.addEventListener('keydown', handler);
    _fokusfallor.set(modalEl, { handler, opener: forra ? forra.opener : openerEl || document.activeElement });
    if (flyttaFokus) setTimeout(() => _fokuserbara(modalEl)[0]?.focus(), 50);
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
/** Stänger en dialog: släpper fällan, så att fokus går tillbaka till det som öppnade den, och döljer den. */
export function stangDialog(modalEl) {
    if (!modalEl) return;
    slappFokus(modalEl);
    modalEl.style.display = 'none';
}

/**
 * Bygger om en yta utan att tappa fokus (WCAG 2.4.3). Stod fokus i ytan och elementet är borta efter `bygg`, sätts
 * fokus på motsvarande element: samma id, eller samma data-attribut närmast samma plats (en ny rad efter en borttagen
 * har samma knapp). Finns inget sådant går fokus till närmaste kontroll före, och annars till ytan själv. Utan det
 * hamnar fokus på sidans början, och nästa Tab börjar om överst.
 * @template T
 * @param {HTMLElement|null} yta
 * @param {() => T} bygg
 * @returns {T}
 */
export function behallFokus(yta, bygg) {
    const fore = /** @type {HTMLElement|null} */ (document.activeElement);
    if (!yta || !fore || fore === yta || !yta.contains(fore)) return bygg();
    const foreLista = _fokuserbara(document), pos = foreLista.indexOf(fore), nyckel = _fokusNyckel(fore);
    const svar = bygg();
    const nu = document.activeElement;
    if (nu && nu !== document.body && nu.isConnected) return svar;
    const efter = _fokuserbara(document);
    const avstand = el => Math.abs(efter.indexOf(el) - pos);
    const mal = (nyckel ? efter.filter(el => _fokusNyckel(el) === nyckel).sort((a, b) => avstand(a) - avstand(b))[0] : null)
        || foreLista.slice(0, Math.max(pos, 0)).reverse().find(el => el.isConnected && efter.includes(el))
        || (yta.isConnected ? yta : null);
    if (mal === yta && !yta.hasAttribute('tabindex')) yta.setAttribute('tabindex', '-1');
    mal?.focus({ preventScroll: true });
    return svar;
}
/** Det som känner igen ett element efter en omritning: id, eller taggen med data-attributen; null när inget finns.
 *  Verktygstipsets id och attribut räknas inte: tipset sätter dem på elementet som har fokus (02-verktygstips.js). */
function _fokusNyckel(el) {
    if (el.id && !el.id.startsWith('tip-host-')) return '#' + el.id;
    const data = [...el.attributes].filter(a => a.name.startsWith('data-') && !/^data-(tooltip|stolen-title)/.test(a.name))
        .map(a => `[${a.name}="${a.value}"]`).join('');
    return data ? el.tagName + data : null;
}

// Aria-live announcer för skärmläsare. Läser upp dynamiska statusändringar.
/** @type {HTMLElement|null} */
let _skarmlasarRegion = null;
function _hamtaSkarmlasarRegion() {
    if (_skarmlasarRegion?.isConnected) return _skarmlasarRegion;   // Rensa all data tar bort den med det som ritats efter starten
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

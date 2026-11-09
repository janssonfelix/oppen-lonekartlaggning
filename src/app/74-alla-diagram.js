// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
// ====================================================================
// 74-alla-diagram.js — Tabeller och egna vyer: underflikarna Egna vyer och Alla diagram
//
// Överst i #view-utforska står två underflikar i samma mönster som Om verktygets sektioner (role="tablist", pilarna
// flyttar mellan dem): Egna vyer (förvald) och Alla diagram. Valet minns så länge sidan är öppen.
//
// Alla diagram (#ut-alla-diagram) samlar diagrammen från de andra flikarna, en grupp per upplåst flik i menyns
// ordning (<details class="avsnitt">, stängd från början). När en grupp öppnas ritas fliken (renderTabContent) om
// den inte är ritad eller är inaktuell, och varje diagram i den som är ritat, har något att visa, får lämna verktyget
// (diagramUrval, samma urval som ZIP-filen) och inte är dolt i sin flik får en kopia:
//   ritaFigur(kopia, källa._figur, källa._figurVal)  i en egen behållare  ut-diagram-<källans id>.
// Kopian visar exakt källans figur, men har egna filter (minnet nycklas på kopians id), egen exportmeny och egen
// förklaring och zoom. Den följer inte källans filter. Kopiorna ritas om varje gång gruppen öppnas och när
// underfliken eller fliken visas (utom under en export).
//
// Ingen ny utdata: kopiorna följer inte med i ZIP-filen (diagramUrval hoppar över dem), och rapporten, utskriften och
// rapportunderlaget hämtar sina diagram med namn. Exporteras en kopia från sin egen meny går exportgrinden till källan
// (_exportSakraKopia): källans flik ritas i det läge som gäller, och kopian får källans figur på nytt innan något
// läses, så att kopian lämnar verktyget med exakt det som källan skulle lämna det med. Stämpeln om ett undantag
// (Likvärdigt arbete) och filnamnet följer källan.
// ====================================================================

const UT_KOPIA_PREFIX = 'ut-diagram-';
// Flikar som inte får någon grupp: fliken själv; dokumentationsflikarna (Rapporttext, Exportera, Spara och jämför år),
// som ritas i exportläget (ADR-51) och som ZIP-filen inte heller hämtar diagram ur; och flikarna utan diagram ritade
// med diagramkärnan (tests/alla-diagram.test.js vaktar att de förblir utan).
const _UT_ALLA_UTAN = new Set(['utforska', 'dokumentera', 'rapporttext', 'arbetet', 'info', 'dashboard', 'filer', 'bestammelser', 'handlingsplan']);

/** @type {'egna'|'alla'} */
let _utUnderflik = 'egna';
// Flikarna vars kopior har fått källans figur ur exportläget under en export: de grupperna ritas om på skärmen när
// exporten är klar (utAllaDiagramEfterExport). Övriga kopior bär redan skärmens figur.
const _utKopiaExporterad = new Set();

/** Är behållaren en kopia i Alla diagram? */
function arDiagramKopia(el) { return !!el && typeof el.id === 'string' && el.id.startsWith(UT_KOPIA_PREFIX); }
/** Källdiagrammet till en kopia (elementet med källans id), eller null. */
function diagramKopiaKalla(el) {
    if (!arDiagramKopia(el)) return null;
    const k = document.getElementById(el.id.slice(UT_KOPIA_PREFIX.length));
    return k && k !== el ? k : null;
}

/**
 * Diagrammen som har något att visa och får lämna verktyget, i den ordning de kom: ZIP-filen (med diagramRitat, som
 * räknar i exportläget) och Alla diagram (med en kontroll på skärmen) väljer med samma regel. Kopiorna i Alla diagram
 * är aldrig med. `ritat` avgör om diagrammet är ritat.
 * @param {any[]} behallare
 * @param {(el: any) => boolean} ritat
 */
function diagramUrval(behallare, ritat) {
    return behallare.filter(el => el && el.id && el.isConnected && !arDiagramKopia(el) && exportTillaten(el) && ritat(el))
        .filter(el => { const u = typeof _rfExportFigur === 'function' ? _rfExportFigur(el) : null; return !u || !u.tom; });
}

/** Är elementet dolt i sin flik (hidden, display: none eller .dold utan inline-stil), fram till panelen? Ett diagram i
 *  ett kort som fliken döljer för att underlaget saknas visas inte i Alla diagram. */
function _utDoltIFliken(el) {
    for (let n = el; n && !n.classList.contains('view-panel'); n = n.parentElement) {
        if (n.hidden || n.style.display === 'none' || (n.classList.contains('dold') && !n.style.display)) return true;
    }
    return false;
}

/** Fliken Tabeller och egna vyer visas just nu. */
function _utFlikVisas() { return document.querySelector('.nav-item.active[data-tab]')?.getAttribute('data-tab') === 'utforska'; }
/** Alla diagram visas just nu (fliken och underfliken). */
function _utAllaVisas() { return _utUnderflik === 'alla' && _utFlikVisas(); }

// ---- Underflikarna ----
/**
 * Visar underfliken `namn` ('egna' eller 'alla'). Alla diagram ritar då om sina öppna grupper; sidindexet byggs om
 * när fliken visas.
 * @param {string} namn
 */
function utValjUnderflik(namn) {
    _utUnderflik = namn === 'alla' ? 'alla' : 'egna';
    for (const b of document.querySelectorAll('[data-ut-underflik]')) {
        const aktiv = /** @type {HTMLElement} */ (b).dataset.utUnderflik === _utUnderflik;
        b.classList.toggle('active', aktiv);
        b.setAttribute('aria-selected', String(aktiv));
        /** @type {HTMLElement} */ (b).tabIndex = aktiv ? 0 : -1;
    }
    const egna = document.getElementById('ut-egna'), alla = document.getElementById('ut-alla-diagram');
    if (egna) egna.hidden = _utUnderflik !== 'egna';
    if (alla) alla.hidden = _utUnderflik !== 'alla';
    if (_utUnderflik === 'alla') utAllaDiagramRita();
    if (_utFlikVisas() && typeof sidindexBygg === 'function') sidindexBygg('utforska');
}
/** Visar underfliken som elementet ligger i, om den är dold (sökningen och länkar till ett avsnitt i fliken). */
function utVisaUnderflikFor(el) {
    const panel = el && el.closest ? el.closest('[data-ut-underflik-panel]') : null;
    if (panel && panel.hidden) utValjUnderflik(panel.getAttribute('data-ut-underflik-panel') || 'egna');
}

// ---- Grupperna ----
/** Flikarna som får en grupp, i menyns ordning: upplåsta och synliga, utom _UT_ALLA_UTAN. */
function _utAllaFlikar() {
    const ut = [];
    for (const knapp of document.querySelectorAll('.nav-item[data-tab]')) {
        const flik = knapp.getAttribute('data-tab');
        if (!flik || _UT_ALLA_UTAN.has(flik) || /** @type {HTMLInputElement} */ (knapp).disabled || /** @type {HTMLElement} */ (knapp).hidden) continue;
        const namn = (knapp.querySelector('.nav-etikett')?.textContent || knapp.textContent || flik).replace(/\s+/g, ' ').trim();
        ut.push({ flik, namn });
    }
    return ut;
}
/** Källdiagrammen i fliken som får en kopia, i sidans ordning. */
function _utKallor(flik) {
    const alla = typeof _rfBehallare !== 'undefined' ? [..._rfBehallare] : [];
    return diagramUrval(alla.filter(el => _egFlikFor(el) === flik), el => !!el._figur && !_utDoltIFliken(el))
        .sort((a, b) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1));
}
/** Raden under gruppens namn: antalet diagram när det är känt (gruppen har ritats, eller fliken är ritad och aktuell). */
function _utAllaAntalText(flik, antal) {
    if (antal == null && typeof _ritadVid !== 'undefined' && _ritadVid.has(flik) && !flikInaktuell(flik)) antal = _utKallor(flik).length;
    if (antal == null) return 'Diagrammen ritas när du öppnar gruppen';
    return antal ? `${antal} diagram` : 'Inga diagram med det här underlaget';
}
function _utAllaNyGrupp(flik, namn) {
    const g = document.createElement('details');
    g.className = 'avsnitt ut-alla-grupp';
    g.id = `ut-alla-${flik}`;
    g.setAttribute('data-ut-flik', flik);
    const s = document.createElement('summary');
    const titel = document.createElement('span');
    titel.className = 'avsnitt-titel';
    const h = document.createElement('h3');
    h.textContent = namn;
    const under = document.createElement('span');
    under.className = 'avsnitt-under';
    titel.append(h, under);
    s.appendChild(titel);
    const yta = document.createElement('div');
    yta.className = 'ut-alla-innehall';
    g.append(s, yta);
    return g;
}

/**
 * Bygger grupperna (en per flik som har en) och ritar om de öppna. Grupper som redan finns står kvar med sitt läge
 * (öppen eller stängd); en flik som har låsts eller dolts tar sin grupp med sig. Gör ingenting under en export.
 */
function utAllaDiagramRita() {
    if (typeof _exportDjup !== 'undefined' && _exportDjup > 0) return;
    const behallare = document.getElementById('ut-alla-grupper');
    if (!behallare) return;
    const tom = document.getElementById('ut-alla-tom');
    if (!getData().length) {
        _utAllaRensa(behallare);
        if (tom) tom.hidden = false;
        return;
    }
    if (tom) tom.hidden = true;
    const flikar = _utAllaFlikar();
    const fanns = new Map([...behallare.querySelectorAll(':scope > details[data-ut-flik]')].map(g => [g.getAttribute('data-ut-flik'), g]));
    for (const [flik, g] of fanns) if (!flikar.some(f => f.flik === flik)) { _utAllaRensa(g); g.remove(); fanns.delete(flik); }
    for (const { flik, namn } of flikar) {
        const g = fanns.get(flik) || _utAllaNyGrupp(flik, namn);
        /** @type {HTMLElement} */ (g.querySelector('summary h3')).textContent = namn;
        behallare.appendChild(g);   // i menyns ordning
    }
    for (const g of /** @type {NodeListOf<HTMLDetailsElement>} */ (behallare.querySelectorAll(':scope > details[data-ut-flik]'))) {
        if (g.open) utAllaGruppRita(g);
        else /** @type {HTMLElement} */ (g.querySelector('.avsnitt-under')).textContent = _utAllaAntalText(g.getAttribute('data-ut-flik'), null);
    }
}

/** Tar bort kopiorna i elementet (en grupp eller hela samlingen) med allt ritaFigur kopplade. */
function _utAllaRensa(el) {
    for (const k of el.querySelectorAll(`[id^="${UT_KOPIA_PREFIX}"]`)) rensaFigur(k);
    if (el.id === 'ut-alla-grupper') el.textContent = '';
}

/**
 * Ritar gruppens kopior: fliken ritas först om den inte är ritad eller är inaktuell, utan att användaren flyttas
 * (fokus och rullning står kvar). En kopia som redan finns ritas om i samma behållare (filtren, menyn och fokus i dem
 * står kvar); en kopia vars källa inte längre visas tas bort.
 * @param {HTMLDetailsElement} grupp
 * @returns {number} antalet kopior
 */
function utAllaGruppRita(grupp) {
    const flik = grupp.getAttribute('data-ut-flik') || '';
    const yta = /** @type {HTMLElement} */ (grupp.querySelector('.ut-alla-innehall'));
    if (!flik || !yta || (typeof _exportDjup !== 'undefined' && _exportDjup > 0)) return 0;
    if (!_ritadVid.has(flik) || flikInaktuell(flik)) {
        const fokus = /** @type {HTMLElement|null} */ (document.activeElement), x = window.scrollX, y = window.scrollY;
        try { renderTabContent(flik); } catch (e) { rapporteraFel(`Alla diagram: ${flik}`, e); }
        if (fokus && fokus !== document.activeElement && fokus.isConnected && typeof fokus.focus === 'function') fokus.focus({ preventScroll: true });
        if (window.scrollX !== x || window.scrollY !== y) window.scrollTo(x, y);
    }
    const kallor = _utKallor(flik);
    const fanns = new Map([...yta.querySelectorAll(':scope > .ut-kopia')].map(k => [k.getAttribute('data-ut-kalla'), k]));
    for (const [id, kort] of fanns) {
        if (kallor.some(k => k.id === id)) continue;
        const kopia = kort.querySelector(`[id^="${UT_KOPIA_PREFIX}"]`);
        if (kopia) rensaFigur(kopia);
        kort.remove();
        fanns.delete(id);
    }
    for (const kalla of kallor) {
        const kort = fanns.get(kalla.id) || _utNyKopia(kalla, flik);
        /** @type {HTMLElement} */ (kort.querySelector('.ut-kopia-rubrik')).textContent = chartExportTitle(kalla);
        yta.appendChild(kort);   // i flikens ordning
        const kopia = /** @type {HTMLElement} */ (kort.querySelector(`[id^="${UT_KOPIA_PREFIX}"]`));
        try { ritaFigur(kopia, kalla._figur, { ...kalla._figurVal }); } catch (e) { rapporteraFel(`Alla diagram: ${kalla.id}`, e); }
    }
    let tom = yta.querySelector(':scope > .ut-alla-inga');
    if (!kallor.length && !tom) {
        tom = document.createElement('p');
        tom.className = 'ut-alla-inga farg-dampad fs-sm';
        tom.textContent = 'Fliken har inga diagram med det här underlaget.';
        yta.appendChild(tom);
    } else if (kallor.length && tom) tom.remove();
    /** @type {HTMLElement} */ (grupp.querySelector('.avsnitt-under')).textContent = _utAllaAntalText(flik, kallor.length);
    return kallor.length;
}

/** Ett tomt kort för en kopia: rubriken, raden Från fliken med länken till källan, och behållaren. */
function _utNyKopia(kalla, flik) {
    const kort = document.createElement('div');
    kort.className = 'ut-kopia';
    kort.setAttribute('data-ut-kalla', kalla.id);
    const h = document.createElement('h4');
    h.className = 'ut-kopia-rubrik';
    const fran = document.createElement('p');
    fran.className = 'ut-kopia-fran';
    const namn = _utAllaFlikar().find(f => f.flik === flik)?.namn || flik;
    const a = document.createElement('a');
    a.href = '#';
    a.setAttribute('data-go-to-tab', flik);
    a.setAttribute('data-go-to-anchor', kalla.id);
    a.textContent = namn;
    a.title = 'Öppnar fliken vid diagrammet';
    fran.append('Från fliken ', a);
    const omrade = document.createElement('div');
    omrade.className = 'ut-kopia-yta';
    const kopia = document.createElement('div');
    kopia.id = UT_KOPIA_PREFIX + kalla.id;
    kopia.className = 'ut-kopia-diagram';
    omrade.appendChild(kopia);
    kort.append(h, fran, omrade);
    return kort;
}

/** Fliken Tabeller och egna vyer har ritats (renderTabContent): Alla diagram ritas om när den visas. */
function utAllaDiagramVidRitning() {
    if (_utUnderflik === 'alla' && _utFlikVisas()) utAllaDiagramRita();
}

/**
 * Exportgrinden för en kopia (exportSakra): källans flik säkras (ritas i det läge som gäller nu) och kopian får
 * källans figur på nytt, så att en export ur kopian läser exakt det som en export ur källan skulle läsa. Svarar
 * falskt när källan saknas, inte får lämna verktyget, är dold i sin flik eller inte har något ritat.
 */
function _exportSakraKopia(kopia) {
    if (!kopia.isConnected) return false;
    const id = kopia.id.slice(UT_KOPIA_PREFIX.length);
    const kalla = document.getElementById(id);
    if (!kalla || kalla === kopia || !exportSakra(kalla)) {
        const ny = document.getElementById(id);
        if (!ny || ny === kalla || !exportSakra(ny)) return false;
    }
    const nu = document.getElementById(id);
    if (!nu || !nu._figur || !exportTillaten(nu) || _utDoltIFliken(nu)) return false;
    if (kopia._figur !== nu._figur) {
        ritaFigur(kopia, nu._figur, { ...nu._figurVal });
        const flik = kopia.closest('[data-ut-flik]')?.getAttribute('data-ut-flik');
        if (flik && iExportLage() && !iForhandsvisning()) _utKopiaExporterad.add(flik);
    }
    return kopia.isConnected && !!kopia._figur;
}

/** Efter en export (_ritaOmEfterExport): en grupp vars kopia fick källans figur i exportläget ritas om på skärmen
 *  (källans flik ritas då om i skärmläget). De andra grupperna rörs inte. */
function utAllaDiagramEfterExport() {
    const flikar = [..._utKopiaExporterad];
    _utKopiaExporterad.clear();
    for (const flik of flikar) {
        const g = /** @type {HTMLDetailsElement|null} */ (document.getElementById(`ut-alla-${flik}`));
        if (g && g.open && g.isConnected) utAllaGruppRita(g);
    }
}

// ---- Kopplingar ----
document.querySelectorAll('[data-ut-underflik]').forEach(b => {
    b.addEventListener('click', () => utValjUnderflik(/** @type {HTMLElement} */ (b).dataset.utUnderflik || 'egna'));
});
_wireTablistKeys(/** @type {HTMLElement[]} */ ([...document.querySelectorAll('[data-ut-underflik]')]));
// En grupp som öppnas ritar sina kopior. toggle bubblar inte: lyssnaren fångar den på vägen ned. En grupp som öppnas
// medan samlingen inte visas ritas när den visas.
document.getElementById('ut-alla-grupper')?.addEventListener('toggle', e => {
    const g = /** @type {HTMLDetailsElement} */ (e.target);
    if (g && g.matches && g.matches('details[data-ut-flik]') && g.open && _utAllaVisas()) utAllaGruppRita(g);
}, true);

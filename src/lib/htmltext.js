// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
/**
 * Öppen lönekartläggning — text till och från HTML: esc för text som ska in, och vanlig text ur HTML (taggarna
 * bort och tecknen avkodade).
 *
 * Verktygets egna texter (metodbilagans regler, förslagen i gruppdossiern) är skrivna som HTML. I Excel, utskriftens
 * listor och textkopior ska de stå som vanlig text. Taggarna tas bort tills inga finns kvar (en ersättning i ett svep
 * lämnar `<scr<b>ipt>` som `<script>`), och ett ensamt `<` som blir kvar tas bort. Avkodningen tar &amp; sist, så att
 * `&amp;lt;` blir `&lt;` och inte `<`. Här står också regeln för en cell som är ett tal (`arTal`).
 */

/**
 * Text som ska in i HTML (innerHTML): & < > " ' blir entiteter, så att texten är säker både som text och i ett
 * citerat attribut (`title="${esc(x)}"`). Webbläsaren avkodar entiteterna när attributet eller `.value` läses, så
 * värdet kommer tillbaka oförändrat. Utan citattecknen kunde ett fält ur filen (till exempel BAS) bryta sig ut ur
 * attributet. Hela verktyget escapar med den här funktionen (appen genom 01-html-och-tillganglighet.js).
 * @param {*} s - värdet (null och undefined ger en tom sträng)
 * @returns {string}
 */
export const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

/** Texten utan HTML-taggar (entiteterna står kvar). */
export function utanTaggar(text) {
    let s = String(text ?? ''), forra;
    do { forra = s; s = s.replace(/<[^<>]*>/g, ''); } while (s !== forra);
    return s.replace(/</g, '');
}

/** Texten utan HTML-taggar och med &lt; &gt; &quot; &#39; &amp; avkodade: vanlig text, ska escapas igen i HTML. */
export function htmlTillText(text) {
    return utanTaggar(text).replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
}

/**
 * Cellens text är ett tal med ev. enhet ("33 932 kr", "93,6 %", "46 (28/18)", "1 427 679 kr/år", "20 / 45"), eller ett
 * intervall av två sådana ("0,9–3,8 %", och "−0,8 till 1,7 %" när ett av talen är negativt). Word-utkastet (docx.js),
 * utskriften (60-utskrift.js) och Rapporttext (67-rapportunderlag.js) håller en sådan cell på en rad.
 */
const _TAL = String.raw`[−+\-–]?[\d\s\u00a0,.%/()−–+]*\d[\d\s\u00a0,.%/()−–+]*`;
const _AR_TAL = new RegExp(String.raw`^${_TAL}(?:\still\s+${_TAL})?(kr\/år|kr\/mån|kr|mnkr|Mkr|%)?$`);
export function arTal(text) {
    return _AR_TAL.test(String(text ?? '').trim());
}


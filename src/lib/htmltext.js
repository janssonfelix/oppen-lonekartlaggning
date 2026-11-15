// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
/**
 * Öppen lönekartläggning — HTML-text som vanlig text: taggarna bort och tecknen avkodade.
 *
 * Verktygets egna texter (metodbilagans regler, förslagen i gruppdossiern) är skrivna som HTML. I Excel, utskriftens
 * listor och textkopior ska de stå som vanlig text. Taggarna tas bort tills inga finns kvar (en ersättning i ett svep
 * lämnar `<scr<b>ipt>` som `<script>`), och ett ensamt `<` som blir kvar tas bort. Avkodningen tar &amp; sist, så att
 * `&amp;lt;` blir `&lt;` och inte `<`. Här står också regeln för en cell som är ett tal (`arTal`).
 *
 * Webbläsarbygget får en AUTO-GENERERAD spegel i src/app/09-lib-speglar.js.
 */

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
 * Cellens text är ett tal med ev. enhet ("33 932 kr", "93,6 %", "46 (28/18)", "1 427 679 kr/år", "20 / 45"). Word-utkastet
 * (docx.js) och utskriften (60-utskrift.js) håller en sådan cell på en rad.
 */
export function arTal(text) {
    return /^[−+\-–]?[\d\s\u00a0,.%/()−–+]*\d[\d\s\u00a0,.%/()−–+]*(kr\/år|kr\/mån|kr|mnkr|Mkr|%)?$/.test(String(text ?? '').trim());
}


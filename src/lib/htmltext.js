// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
/**
 * Öppen lönekartläggning — HTML-text som vanlig text: taggarna bort och tecknen avkodade.
 *
 * Verktygets egna texter (metodbilagans regler, förslagen i gruppdossiern) är skrivna som HTML. I Excel, utskriftens
 * listor och textkopior ska de stå som vanlig text. Taggarna tas bort tills inga finns kvar (en ersättning i ett svep
 * lämnar `<scr<b>ipt>` som `<script>`), och ett ensamt `<` som blir kvar tas bort. Avkodningen tar &amp; sist, så att
 * `&amp;lt;` blir `&lt;` och inte `<`.
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

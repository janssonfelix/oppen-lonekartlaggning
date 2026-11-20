// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
/**
 * Öppen lönekartläggning — Könet på en lönerad.
 *
 * Två predikat som prövar radens normaliserade kön: arKvinna och arMan. Inläsningen (inlasning.js) har redan satt
 * fältet kon till 'kvinna' eller 'man', och rader med annat kön utesluts där; predikaten är det enda ställe i
 * verktyget där villkoren skrivs. Modulen importerar ingenting, så att alla lib-moduler kan använda den (också
 * falt.js, som står sent i speglingsordningen).
 *
 * Webbläsarbygget får en AUTO-GENERERAD spegel i src/app/09-lib-speglar.js.
 */

/** Sant när radens kön är 'kvinna' (ett kön som innehåller 'kvinna'). Saknas raden eller könet: falskt. */
export function arKvinna(r) {
    return !!r && typeof r.kon === 'string' && r.kon.includes('kvinna');
}

/** Sant när radens kön är 'man' eller 'män'. Saknas raden eller könet: falskt. */
export function arMan(r) {
    return !!r && (r.kon === 'man' || r.kon === 'män');
}

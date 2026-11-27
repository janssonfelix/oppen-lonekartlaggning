// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
/**
 * Öppen lönekartläggning — Könet på en lönerad.
 *
 * Två predikat som prövar radens normaliserade kön: arKvinna och arMan. Inläsningen (inlasning.js) har redan satt
 * fältet kon till 'kvinna' eller 'man', och rader med annat kön utesluts där; predikaten är det enda ställe i
 * verktyget där villkoren skrivs. Modulen importerar ingenting, så att alla lib-moduler kan använda den (också
 * falt.js, som står sent i speglingsordningen).
 */

/** Sant när radens kön är 'kvinna'. Saknas raden eller könet: falskt. */
export function arKvinna(r) {
    return !!r && r.kon === 'kvinna';
}

/** Sant när radens kön är 'man'. Saknas raden eller könet: falskt. */
export function arMan(r) {
    return !!r && r.kon === 'man';
}

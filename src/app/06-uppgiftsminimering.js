// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
// ---- GDPR uppgiftsminimering (Art. 5(1)(c)) ----
// Vitlistan över tillåtna datafält (TILLATNA_FALT), uppslaget av rubrikerna, bedömningen av ansvarskolumnen och
// tolkningen av en rad bor i src/lib/inlasning.js. Här står de tunna adaptrarna som läser tillståndet: kolumnmappningen
// och importprofilen (_kolumnvalIState i 03-hjalpfunktioner.js), den godkända ansvarskolumnen och innevarande år.
// _faltIRad och _bedomAnsvarKolumn når appen under samma namn genom spegeln.
import { hittaAnsvarKolumn, lonefilensRubriker, minimeraRad } from '../lib/inlasning.js';
import { _kolumnvalIState } from './03-hjalpfunktioner.js';
import { state } from './12-tillstand.js';

/**
 * Kolumnen med AID:s ansvarskod: manuell mappning först, annars importprofilen och sist första rubrik som
 * _anArRubrik känner igen. Aldrig kolumnen "Ansvar".
 * @param {string[]} rubriker
 * @returns {string|null}
 */
export function _hittaAnsvarKolumn(rubriker) {
    return hittaAnsvarKolumn(rubriker, _kolumnvalIState());
}

/**
 * Rubriken för varje fält i TILLATNA_FALT bland lönefilens rubriker (kolumnmappningen, importprofilen, namnet).
 * Slås upp en gång per fil; en ändrad mappning läser in filen på nytt.
 */
export function _lonefilensRubriker(headers) {
    return lonefilensRubriker(headers, _kolumnvalIState());
}

/**
 * Extraherar ENBART vitlistade fält ur en CSV-rad — GDPR Art. 5(1)(c) uppgiftsminimering (minimeraRad i
 * src/lib/inlasning.js), med den godkända ansvarskolumnen och innevarande år som referensår för födelseår i
 * ålderskolumnen. Ansvar läses inte in (se avgränsningen i docs/utveckling/mal.md).
 * @param {Object<string,*>} row - Rå CSV-rad (PapaParse-objekt).
 * @param {Object<string,string|undefined>} [rubriker] - Uppslaget för filen; utan det slås det upp på radens nycklar.
 */
export function extractMinimalRecord(row, rubriker = _lonefilensRubriker(Object.keys(row))) {
    return minimeraRad(row, rubriker, state.ansvarKolumn, new Date().getFullYear());
}

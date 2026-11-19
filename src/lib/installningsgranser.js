// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
/**
 * Öppen lönekartläggning — gränserna för inställningarna, på ett ställe.
 *
 * Samma gräns gäller på tre ställen: fältet i Inställningar (appen), konfigurationsfilen (appen, applyConfigSnapshot)
 * och organisationspaketet (src/lib/organisationspaket.js). Här står siffrorna, och de tre läser dem härifrån. Gränserna
 * är de som fälten redan använder (min/max i index.html och fältens tak i koden); en ny gräns hör inte hit utan till
 * fältet först.
 *
 * Appen når gränserna genom installningsGrans(nyckel): spegelns alias måste vara funktioner (tests/drift.test.js).
 *
 * Webbläsarbygget får en AUTO-GENERERAD spegel i src/app/09-lib-speglar.js.
 */

/** Påslaget för PO (arbetsgivaravgifter och pension) i procent: fältet i Inställningar och konfigurationen. */
export const PO_PCT_GRANS = Object.freeze({ min: 0, max: 100 });

/** Beräkningsperioden i månader (fältet i Inställningar tar värdena 3, 6, 9 och 12; gränsen gäller konfigurationen). */
export const MANADER_GRANS = Object.freeze({ min: 1, max: 60 });

/** Prioriteringens trösklar, per fältnamn i prioConfig (fälten prio-cfg-* i Inställningar). */
export const PRIO_TROSKEL_GRANS = Object.freeze({
    atgardThreshold:    Object.freeze({ min: -50, max: 0 }),
    akutMinN:           Object.freeze({ min: 1, max: 500 }),
    bevakaThreshold:    Object.freeze({ min: -50, max: 0 }),
    analyseraThreshold: Object.freeze({ min: 0, max: 50 })
});

/** Prioriteringens viktning, per fältnamn i prioWeights (fälten prio-w-* i Inställningar). */
export const PRIO_VIKT_GRANS = Object.freeze({
    avvikelse:    Object.freeze({ min: 0, max: 100 }),
    volym:        Object.freeze({ min: 0, max: 100 }),
    jamstalldhet: Object.freeze({ min: 0, max: 100 })
});

/** @typedef {{min:number, max:number}} Grans */
/** @type {Readonly<{poPct: Grans, manader: Grans, prioTroskel: Readonly<Record<string, Grans>>, prioVikt: Readonly<Record<string, Grans>>}>} */
const _GRANSER = Object.freeze({
    poPct: PO_PCT_GRANS,
    manader: MANADER_GRANS,
    prioTroskel: PRIO_TROSKEL_GRANS,
    prioVikt: PRIO_VIKT_GRANS
});

/**
 * Gränsen (eller gränserna per fältnamn) för en inställning: 'poPct', 'manader', 'prioTroskel' eller 'prioVikt'.
 * @template {keyof typeof _GRANSER} K
 * @param {K} nyckel
 * @returns {(typeof _GRANSER)[K]}
 */
export function installningsGrans(nyckel) {
    if (!Object.prototype.hasOwnProperty.call(_GRANSER, nyckel)) throw new Error(`Okänd inställning: ${nyckel}`);
    return _GRANSER[nyckel];
}

/**
 * Ligger ett värde inom sin gräns? Ett värde som inte är ett ändligt tal ligger utanför.
 * @param {unknown} varde
 * @param {{min:number, max:number}} grans
 * @returns {boolean}
 */
export function arInomGrans(varde, grans) {
    return typeof varde === 'number' && Number.isFinite(varde) && varde >= grans.min && varde <= grans.max;
}

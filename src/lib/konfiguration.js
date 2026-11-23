// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
/**
 * Öppen lönekartläggning — konfigurationsfilens format: versionen och namnbytena (ADR-96).
 *
 * Konfigurationsfilen skrivs med svenska fältnamn från version 3. Filer sparade i version 2 bär de äldre, engelska
 * eller blandade namnen. Tabellen nedan är det enda stället där de gamla namnen står: konfigurationMedNyaNamn() byter
 * dem mot de nya när filen läses in, före den vanliga valideringen, så att valideringen bara känner de nya namnen.
 * Byggandet och valideringen av filen står i appen (src/app/19-konfiguration.js).
 *
 * Webbläsarbygget får en AUTO-GENERERAD spegel i src/app/09-lib-speglar.js.
 */

/** Versionen som skrivs. */
export const KONFIGURATION_VERSION = 3;
/** Versionen som skrivs, för appen (spegelns alias är funktioner). */
export function konfigurationVersion() { return KONFIGURATION_VERSION; }
/** Versionerna som läses: 2 med de gamla namnen, 3 med de nya. */
export const KONFIGURATION_LASBARA = Object.freeze([2, 3]);

/**
 * Gamla namn → nya, per nivå i filen. Nyckeln är vägen dit med de nya namnen ('' är filens översta nivå), och `[]`
 * står för varje post i en lista. Ett fält utan rad här heter detsamma i båda versionerna.
 * @type {Readonly<Record<string, Readonly<Record<string, string>>>>}
 */
export const KONFIGURATION_NAMNBYTEN = Object.freeze({
    '': Object.freeze({
        timestamp: 'sparad', prioConfig: 'prioTrosklar', prioWeights: 'prioVikter', costSettings: 'kostnad',
        forecast: 'loneoversyn', ui: 'visning', actionChecklistDone: 'attGoraKlara', orgName: 'orgNamn',
        strukturNarrative: 'strukturNarrativ'
    }),
    prioTrosklar: Object.freeze({
        atgardThreshold: 'atgardTroskel', akutMinN: 'akutMinstN', bevakaThreshold: 'bevakaTroskel', analyseraThreshold: 'analyseraTroskel'
    }),
    kostnad: Object.freeze({ months: 'manader' }),
    likvardighet: Object.freeze({ kvinnoTrosholdPct: 'kvinnoTroskelPct', minGapPct: 'minstaGapPct', topN: 'antalPar' }),
    loneoversyn: Object.freeze({ targets: 'mal', minGroupN: 'minstaGruppN', roundStep: 'avrundning', years: 'ar' }),
    'loneoversyn.budget': Object.freeze({ mode: 'enhet', value: 'varde' }),
    'loneoversyn.generell': Object.freeze({ mode: 'enhet', value: 'varde' }),
    'loneoversyn.mal[]': Object.freeze({ mode: 'enhet', value: 'varde', dist: 'fordelning', targetLevel: 'malniva', pool: 'pott' }),
    visning: Object.freeze({ prioRef: 'prioReferens', prioLabelMode: 'prioEtiketter', konColorBy: 'konFargning', orgTyp: 'organisationstyp' }),
    'bes8[]': Object.freeze({ note: 'anteckning' })
});

/**
 * Felet för en version som inte läses, annars null.
 * @param {unknown} version
 * @returns {string|null}
 */
export function konfigurationVersionFel(version) {
    if (KONFIGURATION_LASBARA.includes(/** @type {number} */ (version))) return null;
    return `Konfigurationsfilen är från en annan version av verktyget (version ${version}; den här läser version `
        + `${KONFIGURATION_LASBARA.join(' och ')}). Spara en ny konfigurationsfil i den här versionen.`;
}

/**
 * En kopia av filen där varje gammalt namn i tabellen har bytts mot det nya. Står båda namnen i filen gäller det nya.
 * Allt annat (värden, okända fält, ordningen) är orört; valideringen görs efteråt.
 * @param {any} cfg
 * @returns {any}
 */
export function konfigurationMedNyaNamn(cfg) {
    return _byt(cfg, '');
}

/** @param {any} v @param {string} vag @returns {any} */
function _byt(v, vag) {
    if (Array.isArray(v)) return v.map(x => _byt(x, `${vag}[]`));
    if (!v || typeof v !== 'object') return v;
    const byten = KONFIGURATION_NAMNBYTEN[vag] || {};
    /** @type {Record<string, any>} */ const ut = {};
    for (const [k, x] of Object.entries(v)) {
        const ny = Object.hasOwn(byten, k) ? byten[k] : k;
        if (ny !== k && Object.hasOwn(v, ny)) continue;   // det nya namnet går före
        // defineProperty: ett fält som heter __proto__ blir ett vanligt fält, som i JSON.parse.
        Object.defineProperty(ut, ny, { value: _byt(x, vag ? `${vag}.${ny}` : ny), enumerable: true, writable: true, configurable: true });
    }
    return ut;
}

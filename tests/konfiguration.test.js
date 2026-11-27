// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
/**
 * Konfigurationsfilens format (src/lib/konfiguration.js, ADR-96): versionen och bytet av de gamla fältnamnen mot de
 * svenska. Appens sida (att en gammal fil ger samma tillstånd som en ny) prövas i tests/konfigurationsfil-app.test.js.
 */
import { describe, it, expect } from 'vitest';
import { KONFIGURATION_VERSION, KONFIGURATION_NAMNBYTEN, konfigurationVersionFel, konfigurationMedNyaNamn } from '../src/lib/konfiguration.js';

// En fil i version 2 med varje gammalt namn i tabellen (påhittade värden).
const GAMMAL = {
    version: 2, timestamp: '2026-01-01T00:00:00.000Z',
    prioConfig: { atgardThreshold: -6, akutMinN: 12, bevakaThreshold: -3, analyseraThreshold: 4 },
    prioWeights: { avvikelse: 40, volym: 40, jamstalldhet: 20 },
    costSettings: { months: 6, poPct: 35 },
    likvardighet: { kvinnoTrosholdPct: 65, kvDomDefinition: 'scb', jamforelse: 'alla', minGapPct: 3, topN: 30 },
    forecast: {
        budget: { mode: 'pct', value: 2.5 }, generell: { mode: 'kr', value: 500 },
        targets: [{ bas: 'C', aid: '123', mode: 'kr', value: 900, dist: 'flat', targetLevel: 'p25', pool: 'marknad', kalla: 'par' }],
        minGroupN: 8, roundStep: 10, years: 2
    },
    ui: { prioRef: 'statistik', prioLabelMode: 'kort', konColorBy: 'kon', orgTyp: 'kommun', jamforelse: { bas: 'C', sektor: '' } },
    bes8: [{ n: 1, status: 'Klar', note: 'Anteckning på gruppnivå.' }],
    actionChecklistDone: ['punkt-a'], orgName: 'Exempelorganisationen', strukturNarrative: 'Egen text.'
};
const NY = {
    version: 2, sparad: '2026-01-01T00:00:00.000Z',
    prioTrosklar: { atgardTroskel: -6, akutMinstN: 12, bevakaTroskel: -3, analyseraTroskel: 4 },
    prioVikter: { avvikelse: 40, volym: 40, jamstalldhet: 20 },
    kostnad: { manader: 6, poPct: 35 },
    likvardighet: { kvinnoTroskelPct: 65, kvDomDefinition: 'scb', jamforelse: 'alla', minstaGapPct: 3, antalPar: 30 },
    loneoversyn: {
        budget: { enhet: 'pct', varde: 2.5 }, generell: { enhet: 'kr', varde: 500 },
        mal: [{ bas: 'C', aid: '123', enhet: 'kr', varde: 900, fordelning: 'flat', malniva: 'p25', pott: 'marknad', kalla: 'par' }],
        minstaGruppN: 8, avrundning: 10, ar: 2
    },
    visning: { prioReferens: 'statistik', prioEtiketter: 'kort', konFargning: 'kon', organisationstyp: 'kommun', jamforelse: { bas: 'C', sektor: '' } },
    bes8: [{ n: 1, status: 'Klar', anteckning: 'Anteckning på gruppnivå.' }],
    attGoraKlara: ['punkt-a'], orgNamn: 'Exempelorganisationen', strukturNarrativ: 'Egen text.'
};

describe('konfigurationsfilens version', () => {
    it('skriver version 3 och läser 2 och 3', () => {
        expect(KONFIGURATION_VERSION).toBe(3);
        expect(konfigurationVersionFel(2)).toBeNull();
        expect(konfigurationVersionFel(3)).toBeNull();
        for (const v of [1, 4, '3', undefined]) expect(konfigurationVersionFel(v)).toMatch(/version 2 och 3/);
    });
});

describe('konfigurationMedNyaNamn: de gamla namnen byts mot de nya', () => {
    it('en fil med alla gamla namn får de nya, på varje nivå', () => {
        expect(konfigurationMedNyaNamn(GAMMAL)).toEqual(NY);
    });
    it('en fil med de nya namnen är oförändrad', () => {
        expect(konfigurationMedNyaNamn(NY)).toEqual(NY);
    });
    it('tabellen täcker varje gammalt namn i provfilen: inget gammalt namn står kvar efter bytet', () => {
        const gamla = new Set(Object.values(KONFIGURATION_NAMNBYTEN).flatMap(t => Object.keys(t)));
        const nycklar = o => (Array.isArray(o) ? o.flatMap(nycklar) : o && typeof o === 'object' ? Object.entries(o).flatMap(([k, v]) => [k, ...nycklar(v)]) : []);
        // mode och value är gamla bara under löneöversynen; ingen annan del av provfilen bär dem.
        expect(nycklar(konfigurationMedNyaNamn(GAMMAL)).filter(k => gamla.has(k))).toEqual([]);
    });
    it('står båda namnen i filen gäller det nya', () => {
        const ut = konfigurationMedNyaNamn({ version: 3, orgName: 'Gammalt', orgNamn: 'Nytt', likvardighet: { topN: 5, antalPar: 50 } });
        expect(ut).toEqual({ version: 3, orgNamn: 'Nytt', likvardighet: { antalPar: 50 } });
    });
    it('namn utanför tabellens väg byts inte: mode under rapportUrval och note under handlingsplanen står kvar', () => {
        const ut = konfigurationMedNyaNamn({ rapportUrval: { mode: 'x' }, handlingsplan: [{ note: 'y' }], months: 1 });
        expect(ut).toEqual({ rapportUrval: { mode: 'x' }, handlingsplan: [{ note: 'y' }], months: 1 });
    });
    it('värdena prövas inte här: ett felaktigt värde går vidare till valideringen under det nya namnet', () => {
        expect(konfigurationMedNyaNamn({ likvardighet: { kvinnoTrosholdPct: 90 } })).toEqual({ likvardighet: { kvinnoTroskelPct: 90 } });
        expect(konfigurationMedNyaNamn({ forecast: 'x', ui: null })).toEqual({ loneoversyn: 'x', visning: null });
    });
    it('ett djupt nästlat värde utanför tabellens vägar lämnas som det är, utan att anropsstacken tar slut', () => {
        const djup = JSON.parse(`${'{"a":'.repeat(20000)}1${'}'.repeat(20000)}`);
        const ut = konfigurationMedNyaNamn({ ...GAMMAL, rapportUrval: djup });
        expect(ut.rapportUrval).toBe(djup);
        expect(ut.prioTrosklar.atgardTroskel).toBe(-6);
    });
    it('ett fält som heter __proto__ blir ett vanligt fält och ändrar inte objektets prototyp', () => {
        const ut = konfigurationMedNyaNamn(JSON.parse('{"__proto__": {"x": 1}, "orgName": "A"}'));
        expect(Object.getPrototypeOf(ut)).toBe(Object.prototype);
        expect(Object.hasOwn(ut, '__proto__')).toBe(true);
        expect(ut.x).toBeUndefined();
        expect(ut.orgNamn).toBe('A');
    });
    it('filen som skickades in ändras inte', () => {
        const kopia = JSON.parse(JSON.stringify(GAMMAL));
        konfigurationMedNyaNamn(kopia);
        expect(kopia).toEqual(GAMMAL);
    });
});

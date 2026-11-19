// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
/**
 * Gränserna för inställningarna (src/lib/installningsgranser.js): siffrorna som fälten i Inställningar redan använder,
 * och den rena prövningen av ett värde mot sin gräns.
 */
import { describe, it, expect } from 'vitest';
import { PO_PCT_GRANS, MANADER_GRANS, PRIO_TROSKEL_GRANS, PRIO_VIKT_GRANS, installningsGrans, arInomGrans } from '../src/lib/installningsgranser.js';

describe('gränsernas siffror: de som fälten i Inställningar redan använder', () => {
    it('PO-påslaget är 0–100 procent och månaderna 1–60', () => {
        expect(PO_PCT_GRANS).toEqual({ min: 0, max: 100 });
        expect(MANADER_GRANS).toEqual({ min: 1, max: 60 });
    });
    it('prioriteringens trösklar och viktning har samma intervall som fälten', () => {
        expect(PRIO_TROSKEL_GRANS.atgardThreshold).toEqual({ min: -50, max: 0 });
        expect(PRIO_TROSKEL_GRANS.akutMinN).toEqual({ min: 1, max: 500 });
        expect(PRIO_TROSKEL_GRANS.bevakaThreshold).toEqual({ min: -50, max: 0 });
        expect(PRIO_TROSKEL_GRANS.analyseraThreshold).toEqual({ min: 0, max: 50 });
        for (const k of ['avvikelse', 'volym', 'jamstalldhet']) expect(PRIO_VIKT_GRANS[k]).toEqual({ min: 0, max: 100 });
    });
});

describe('installningsGrans', () => {
    it('ger gränsen för varje inställning, och en okänd nyckel är ett fel', () => {
        expect(installningsGrans('poPct')).toBe(PO_PCT_GRANS);
        expect(installningsGrans('manader')).toBe(MANADER_GRANS);
        expect(installningsGrans('prioTroskel')).toBe(PRIO_TROSKEL_GRANS);
        expect(installningsGrans('prioVikt')).toBe(PRIO_VIKT_GRANS);
        expect(() => installningsGrans('toString')).toThrow(/Okänd inställning/);
    });
});

describe('arInomGrans', () => {
    it('gränsvärdena räknas med', () => {
        expect(arInomGrans(0, PO_PCT_GRANS)).toBe(true);
        expect(arInomGrans(100, PO_PCT_GRANS)).toBe(true);
        expect(arInomGrans(39.15, PO_PCT_GRANS)).toBe(true);
    });
    it('värden utanför, och värden som inte är ändliga tal, ligger utanför', () => {
        expect(arInomGrans(100.01, PO_PCT_GRANS)).toBe(false);
        expect(arInomGrans(-0.5, PO_PCT_GRANS)).toBe(false);
        expect(arInomGrans(NaN, PO_PCT_GRANS)).toBe(false);
        expect(arInomGrans(Infinity, PO_PCT_GRANS)).toBe(false);
        expect(arInomGrans('50', PO_PCT_GRANS)).toBe(false);
        expect(arInomGrans(undefined, PO_PCT_GRANS)).toBe(false);
    });
});

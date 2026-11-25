// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
/**
 * Tester för kostnadsräkningen: kostnadsformeln i src/lib/kostnad.js (kostnadsfaktor, periodkostnad och
 * kostnadPerAr, åtgärdskostnad per år med beräkningsperiod och PO-påslag) och arsbeloppMening i src/lib/prioritering.js
 * (räkneexemplet om könsskillnaden i kronor per år).
 *
 * Förväntade tal är handräknade ur formeln |belopp| × månader × (1 + PO) × antal.
 */
import { describe, it, expect } from 'vitest';
import { kostnadsfaktor, periodkostnad, kostnadPerAr, periodOrd } from '../src/lib/kostnad.js';
import { arsbeloppMening } from '../src/lib/prioritering.js';

const KOST = { months: 12, poPct: 39.15 };
const kr = v => `${v} kr`;

describe('kostnadsfaktor och periodkostnad: inställningarna med standardvärden', () => {
    it('månader och PO ur inställningarna, PO-faktorn 1 + PO / 100', () => {
        expect(kostnadsfaktor({ months: 6, poPct: 10.5 })).toEqual({ months: 6, poPct: 10.5, poFaktor: 1.105 });
    });
    it('null, saknade fält och months 0 ger 12 månader och 0 % PO', () => {
        const standard = { months: 12, poPct: 0, poFaktor: 1 };
        expect(kostnadsfaktor(null)).toEqual(standard);
        expect(kostnadsfaktor(undefined)).toEqual(standard);
        expect(kostnadsfaktor({})).toEqual(standard);
        expect(kostnadsfaktor({ months: 0, poPct: null })).toEqual(standard);
    });
    it('periodkostnad: en summerad månadskostnad × månader × PO-faktor, i den ordningen och med tecknet kvar', () => {
        expect(periodkostnad(10000, KOST)).toBe(10000 * 12 * (1 + 39.15 / 100));
        expect(periodkostnad(-1000, { months: 12, poPct: 0 })).toBe(-12000);
        expect(periodkostnad(1000, null)).toBe(12000);
    });
    it('kostnadPerAr är periodkostnaden för absolutbeloppet gånger antalet', () => {
        expect(kostnadPerAr(-1234, 7, KOST)).toBe(periodkostnad(1234, KOST) * 7);
    });
});

describe('[B7.1] kostnadPerAr: formeln |belopp| × månader × (1 + PO) × antal', () => {
    it('1 000 kr × 12 mån × PO 39,15 % × 10 personer = 166 980', () => {
        expect(kostnadPerAr(1000, 10, KOST)).toBeCloseTo(166980, 6);
    });
    it('PO 0 % ger belopp × månader × antal', () => {
        expect(kostnadPerAr(1000, 10, { months: 12, poPct: 0 })).toBe(120000);
    });
    it('decimalt PO-påslag: 2 000 kr × 6 mån × 10,5 % × 3 personer = 39 780', () => {
        expect(kostnadPerAr(2000, 3, { months: 6, poPct: 10.5 })).toBeCloseTo(39780, 6);
    });
    it('negativt belopp räknas med absolutbeloppet', () => {
        expect(kostnadPerAr(-1500, 2, { months: 12, poPct: 0 })).toBe(36000);
        expect(kostnadPerAr(-1500, 2, KOST)).toBe(kostnadPerAr(1500, 2, KOST));
    });
    it('antal 0 ger 0 oavsett belopp och PO', () => {
        expect(kostnadPerAr(1000, 0, KOST)).toBe(0);
    });
    it('costSettings null eller undefined ger 12 månader och 0 % PO', () => {
        expect(kostnadPerAr(1000, 10, null)).toBe(120000);
        expect(kostnadPerAr(1000, 10, undefined)).toBe(120000);
    });
    it('PO som saknas eller är null räknas som 0 %', () => {
        expect(kostnadPerAr(1000, 1, { months: 12 })).toBe(12000);
        expect(kostnadPerAr(1000, 1, { months: 12, poPct: null })).toBe(12000);
    });
    it('månader som saknas ger 12', () => {
        expect(kostnadPerAr(1000, 1, { poPct: 0 })).toBe(12000);
    });
    it('months 0 ger standardvärdet 12: perioden är 1–60 månader i Inställningar, konfigurationsfilen och paketet', () => {
        expect(kostnadPerAr(1000, 1, { months: 0, poPct: 0 })).toBe(12000);
    });
    it('kostnaden är linjär i antal personer', () => {
        expect(kostnadPerAr(500, 4, KOST)).toBeCloseTo(2 * kostnadPerAr(500, 2, KOST), 6);
    });
});

describe('[B7.11] arsbeloppMening: räkneexemplet om könsskillnaden', () => {
    it('full mening: 6 000 kr per månad under, 10 kvinnor, 12 mån, PO 39,15 % ger 1 002 000 kr per år', () => {
        const g = { medKv: 30000, medMa: 36000, nKv: 10 };
        expect(arsbeloppMening(g, KOST, kr)).toBe(
            'Räkneexempel: kvinnornas medianlön ligger 6000 kr per månad under männens. För gruppens 10 kvinnor motsvarar '
            + 'det omkring 1002000 kr per år (12 månader, PO-påslag 39,15\u00a0%). Det är ett räkneexempel, '
            + 'inte en kostnadsbedömning: om skillnaden har sakliga skäl bedömer HR.'
        );
    });
    it('beloppet avrundas till tusental: 500 kr per månad, 3 kvinnor, PO 39,15 % ger 25 000 kr', () => {
        const g = { medKv: 30000, medMa: 30500, nKv: 3 };
        const text = arsbeloppMening(g, KOST, kr);
        expect(text).toContain('ligger 500 kr per månad under');
        expect(text).toContain('omkring 25000 kr per år');
    });
    it('PO 0 %: texten visar 0 och beloppet räknas utan påslag', () => {
        const g = { medKv: 30000, medMa: 31000, nKv: 1 };
        const text = arsbeloppMening(g, { months: 12, poPct: 0 }, kr);
        expect(text).toContain('PO-påslag 0\u00a0%');
        expect(text).toContain('omkring 12000 kr per år');
    });
    it('skillnaden avrundas till hundratal: 550 kr blir 600 kr (Math.round, halvtal uppåt)', () => {
        const g = { medKv: 30000, medMa: 30550, nKv: 1 };
        expect(arsbeloppMening(g, { months: 12, poPct: 0 }, kr)).toContain('ligger 600 kr per månad under');
    });
    it('skillnad under 100 kr efter avrundning ger null (49 kr rundas till 0)', () => {
        expect(arsbeloppMening({ medKv: 30000, medMa: 30049, nKv: 5 }, KOST, kr)).toBeNull();
    });
    it('skillnad exakt 100 kr ger en mening med 1 000 kr per år (1 200 avrundas till tusental)', () => {
        const text = arsbeloppMening({ medKv: 30000, medMa: 30100, nKv: 1 }, { months: 12, poPct: 0 }, kr);
        expect(text).toContain('ligger 100 kr per månad under');
        expect(text).toContain('omkring 1000 kr per år');
    });
    it('gränsen gäller den avrundade skillnaden som texten visar: 50 kr blir 100 kr och ger en mening', () => {
        const text = arsbeloppMening({ medKv: 30000, medMa: 30050, nKv: 1 }, { months: 12, poPct: 0 }, kr);
        expect(text).toContain('ligger 100 kr per månad under');
    });
    it('kvinnornas median över männens (negativ skillnad) ger null', () => {
        expect(arsbeloppMening({ medKv: 36000, medMa: 30000, nKv: 5 }, KOST, kr)).toBeNull();
    });
    it('saknad median (null, undefined eller 0) ger null', () => {
        expect(arsbeloppMening({ medKv: null, medMa: 36000, nKv: 5 }, KOST, kr)).toBeNull();
        expect(arsbeloppMening({ medKv: 30000, nKv: 5 }, KOST, kr)).toBeNull();
        expect(arsbeloppMening({ medKv: 0, medMa: 36000, nKv: 5 }, KOST, kr)).toBeNull();
    });
    it('nKv 0 ger null, och g null ger null', () => {
        expect(arsbeloppMening({ medKv: 30000, medMa: 36000, nKv: 0 }, KOST, kr)).toBeNull();
        expect(arsbeloppMening(null, KOST, kr)).toBeNull();
    });
});

describe('periodOrd: kostnaden gäller beräkningsperioden, inte ett år', () => {
    it('«år» vid tolv månader och utan inställning, annars antalet månader', () => {
        expect(periodOrd({ months: 12, poPct: 40 })).toBe('år');
        expect(periodOrd(null)).toBe('år');
        expect(periodOrd({ months: 6 })).toBe('6 mån');
        expect(periodOrd({ months: 24 })).toBe('24 mån');
    });
    it('räkneexemplet säger perioden när den inte är tolv månader', () => {
        const text = arsbeloppMening({ medKv: 30000, medMa: 31000, nKv: 10 }, { months: 6, poPct: 0 }, kr);
        expect(text).toContain('omkring 60000 kr för 6 månader (PO-påslag');
        expect(text).not.toContain('per år');
    });
});

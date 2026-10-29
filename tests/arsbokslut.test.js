// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
// Årsbokslutet (ADR-54): validering, k-skydd och jämförelsen mellan två år — den rena modulen.
import { describe, it, expect } from 'vitest';
import { byggArsbokslut, valideraArsbokslut, jamforArsbokslut, ARSBOKSLUT_NYCKELTAL } from '../src/lib/arsbokslut.js';

const bokslut = (ar, over = {}) => byggArsbokslut({
    ar, skapat: `${ar}-11-01`, k: 10, verktyg: 'v2026.10.19',
    nyckeltal: { n: 120, nKv: 80, nMa: 40, medKv: 30000, medMa: 32000, kvotPct: 93.75, oforklaratPct: -2.1, antalFlaggade: 2, antalKandidatpar: 3, utelamnadePar: 1 },
    grupper: [
        { yrke: 'Undersköterska (BAS C)', nKv: 40, nMa: 12, medKv: 29000, medMa: 31000, gapPct: -6.5, flaggad: true },
        { yrke: 'Kock (BAS B)', nKv: 12, nMa: 15, medKv: 27000, medMa: 27500, gapPct: -1.8, flaggad: false },
        { yrke: 'Vaktmästare (BAS B)', nKv: 11, nMa: 20, medKv: 26000, medMa: 28000, gapPct: -7.1, flaggad: true },
    ],
    punkter: [{ id: 'p1', titel: 'Granska undersköterskorna', kategori: 'Lika arbete', klar: false }, { id: 'p2', titel: 'Underlag', kategori: 'Underlagets kvalitet', klar: true }],
    ...over,
});

describe('årsbokslut: validering och k-skydd', () => {
    it('ett giltigt bokslut kommer tillbaka normaliserat; ogiltiga faller', () => {
        const b = bokslut(2025);
        expect(b).toMatchObject({ version: 1, ar: 2025, skapat: '2025-11-01', k: 10 });
        expect(b.grupper).toHaveLength(3);
        expect(b.punkter).toHaveLength(2);
        expect(valideraArsbokslut(null)).toBeNull();
        expect(valideraArsbokslut({ ar: 1999, skapat: '1999-01-01', k: 10 })).toBeNull();
        expect(valideraArsbokslut({ ar: 2025, skapat: 'igår', k: 10 })).toBeNull();
        expect(valideraArsbokslut({ ar: 2025, skapat: '2025-01-01', k: 10 })).toMatchObject({ nyckeltal: { n: 0, medKv: null }, grupper: [], punkter: [] });
    });
    it('en yrkesgrupp där ett kön har färre än k personer faller bort, och könsuppdelade nyckeltal nollas när ett kön är under k', () => {
        const b = bokslut(2025, { grupper: [{ yrke: 'Liten (BAS A)', nKv: 9, nMa: 30, medKv: 31417, medMa: 30000, gapPct: 4.7, flaggad: true }] });
        expect(b.grupper).toEqual([]);
        expect(JSON.stringify(b)).not.toContain('31417');
        const c = bokslut(2025, { nyckeltal: { n: 50, nKv: 45, nMa: 5, medKv: 30000, medMa: 35291, kvotPct: 85, oforklaratPct: -3 } });
        expect(c.nyckeltal.medMa).toBeNull();
        expect(c.nyckeltal.kvotPct).toBeNull();
        expect(JSON.stringify(c)).not.toContain('35291');
    });
    it('texter kortas och tal som inte är ändliga blir null', () => {
        const b = bokslut(2025, { grupper: [{ yrke: 'x'.repeat(500), nKv: 10, nMa: 10, medKv: NaN, medMa: Infinity, gapPct: 'tre', flaggad: 'ja' }] });
        expect(b.grupper[0].yrke).toHaveLength(200);
        expect(b.grupper[0]).toMatchObject({ medKv: null, medMa: null, gapPct: null, flaggad: false });
    });
});

describe('årsbokslut: jämförelsen mellan två år', () => {
    it('nyckeltal rad för rad, flaggade grupper som kvar, nya och borta, och förra årets öppna punkter', () => {
        const forra = bokslut(2025);
        const nu = bokslut(2026, {
            nyckeltal: { n: 130, nKv: 85, nMa: 45, medKv: 31000, medMa: 32500, kvotPct: 95.4, oforklaratPct: -1.4, antalFlaggade: 2, antalKandidatpar: 2, utelamnadePar: 0 },
            grupper: [
                { yrke: 'Undersköterska (BAS C)', nKv: 42, nMa: 12, medKv: 30500, medMa: 31500, gapPct: -3.2, flaggad: false },
                { yrke: 'Kock (BAS B)', nKv: 12, nMa: 15, medKv: 27000, medMa: 29000, gapPct: -6.9, flaggad: true },
                { yrke: 'Vaktmästare (BAS B)', nKv: 11, nMa: 20, medKv: 26500, medMa: 28000, gapPct: -5.4, flaggad: true },
            ],
            punkter: [{ id: 'p1', titel: 'Granska undersköterskorna', kategori: 'Lika arbete', klar: true }, { id: 'p3', titel: 'Ny punkt', kategori: 'Lika arbete', klar: false }],
        });
        const j = jamforArsbokslut(forra, nu);
        expect(j.nyckeltal.map(r => r.nyckel)).toEqual(ARSBOKSLUT_NYCKELTAL.map(([k]) => k));
        expect(j.nyckeltal.find(r => r.nyckel === 'medKv')).toMatchObject({ forra: 30000, nu: 31000, diff: 1000, typ: 'kr' });
        expect(j.nyckeltal.find(r => r.nyckel === 'oforklaratPct').diff).toBeCloseTo(0.7, 5);
        expect(j.grupper.kvar.map(g => g.yrke)).toEqual(['Vaktmästare (BAS B)']);
        expect(j.grupper.nya.map(g => g.yrke)).toEqual(['Kock (BAS B)']);
        expect(j.grupper.nya[0]).toMatchObject({ gapForra: -1.8, gapNu: -6.9 });
        expect(j.grupper.borta.map(g => g.yrke)).toEqual(['Undersköterska (BAS C)']);
        expect(j.grupper.borta[0]).toMatchObject({ gapForra: -6.5, gapNu: -3.2 });
        expect(j.punkter).toMatchObject({ totaltForra: 2, klaraForra: 1, totaltNu: 2, klaraNu: 1 });
        expect(j.punkter.kvarFranForra).toEqual([{ id: 'p1', titel: 'Granska undersköterskorna', kategori: 'Lika arbete', klar: false, finnsNu: true, klarNu: true }]);
        expect(j.samma_k).toBe(true);
        expect(jamforArsbokslut(null, nu)).toBeNull();
    });
    it('en grupp som saknas ena året får null för det årets gap; ett annat k märks', () => {
        const forra = bokslut(2025, { k: 12, grupper: [{ yrke: 'Bara förra (BAS A)', nKv: 20, nMa: 20, medKv: 1, medMa: 1, gapPct: -8, flaggad: true }] });
        const nu = bokslut(2026, { grupper: [{ yrke: 'Bara nu (BAS A)', nKv: 20, nMa: 20, medKv: 1, medMa: 1, gapPct: -9, flaggad: true }] });
        const j = jamforArsbokslut(forra, nu);
        expect(j.grupper.borta).toEqual([{ yrke: 'Bara förra (BAS A)', gapForra: -8, gapNu: null, nKv: 20, nMa: 20 }]);
        expect(j.grupper.nya).toEqual([{ yrke: 'Bara nu (BAS A)', gapForra: null, gapNu: -9, nKv: 20, nMa: 20 }]);
        expect(j.samma_k).toBe(false);
    });
});

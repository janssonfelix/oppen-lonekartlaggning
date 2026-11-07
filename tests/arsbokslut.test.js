// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
// Årsbokslutet (ADR-54): validering, k-skydd och jämförelsen mellan två år — den rena modulen.
import { describe, it, expect } from 'vitest';
import { byggArsbokslut, valideraArsbokslut, jamforArsbokslut, hantelRader, basHantelRader, ARSBOKSLUT_NYCKELTAL } from '../src/lib/arsbokslut.js';
import { arsjamforelseBlock, tillWordHtml } from '../src/lib/rapportunderlag.js';

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
        // Antalet är årets när gruppen finns i år, annars förra årets; antalAr säger vilket år det gäller.
        expect(j.grupper.borta).toEqual([{ yrke: 'Bara förra (BAS A)', gapForra: -8, gapNu: null, nKv: 20, nMa: 20, antalAr: 2025 }]);
        expect(j.grupper.nya).toEqual([{ yrke: 'Bara nu (BAS A)', gapForra: null, gapNu: -9, nKv: 20, nMa: 20, antalAr: 2026 }]);
        expect(j.samma_k).toBe(false);
    });
});

describe('årsbokslut: hanteln och blocket i rapportunderlaget', () => {
    const forra = bokslut(2025), nu = bokslut(2026, {
        grupper: [
            { yrke: 'Undersköterska (BAS C)', nKv: 42, nMa: 12, medKv: 30500, medMa: 31500, gapPct: -3.2, flaggad: false },
            { yrke: 'Kock (BAS B)', nKv: 12, nMa: 15, medKv: 27000, medMa: 29000, gapPct: -6.9, flaggad: true },
            { yrke: 'Ny (BAS A)', nKv: 12, nMa: 15, medKv: 27000, medMa: 29000, gapPct: -5.5, flaggad: true },
        ],
    });
    it('hanteln har en rad per yrkesgrupp med gap båda åren, kvoten i procent, riktningen och sortering efter förändring', () => {
        const h = hantelRader(jamforArsbokslut(forra, nu));
        expect(h.rader.map(r => r.namn)).toEqual(['Kock (BAS B)', 'Undersköterska (BAS C)']);   // Vaktmästare är inte flaggad i år och Ny saknar förra året
        expect(h.rader[0]).toMatchObject({ fore: 98.2, efter: 93.1, riktning: 'fran' });
        expect(h.rader[1]).toMatchObject({ fore: 93.5, efter: 96.8, riktning: 'mot' });
        expect(h.utelamnade).toBe(2);   // Ny (bara i år) och Vaktmästare (flaggad bara förra året, gap båda åren? nej: borta med gapNu null)
        expect(hantelRader(null)).toEqual({ rader: [], utelamnade: 0 });
    });
    it('blocket bär nyckeltalen sida vid sida, flaggade grupper med namn och Att göra, och blir Word-HTML', () => {
        const b = arsjamforelseBlock(jamforArsbokslut(forra, nu), { forraAr: 2025, nuAr: 2026, urval: 'Hela organisationen' });
        expect(b.id).toBe('arsjamforelse');
        expect(b.tabell.rubriker).toEqual(['Mått', '2025', '2026', 'Skillnad']);
        expect(b.tabell.rader.find(r => r[0] === 'Medianlön kvinnor')).toEqual(['Medianlön kvinnor', '30\u00a0000 kr', '30\u00a0000 kr', '±0 kr']);
        expect(b.stycken.join(' ')).toMatch(/2 nya \(Kock \(BAS B\), Ny \(BAS A\)\)/);
        expect(b.stycken.join(' ')).toMatch(/2 inte längre flaggade \(Vaktmästare \(BAS B\), Undersköterska \(BAS C\)\)/);
        expect(b.stycken.join(' ')).toMatch(/Att göra: 2025 var 1 av 2 punkter avbockade, 2026 1 av 2/);
        expect(b.stycken.at(-1)).toBe('Urval: Hela organisationen.');
        expect(tillWordHtml(b)).toContain('<h3>Jämförelse med förra året</h3>');
    });
});

describe('årsbokslut: löneutveckling per BAS-intervall (basIntervall)', () => {
    const bas = [
        { bas: 'A', n: 40, nKv: 25, nMa: 15, p10: 24000, med: 26000, p90: 29000, medKv: 25800, medMa: 26400 },
        { bas: 'C', n: 30, nKv: 9, nMa: 21, p10: 27000, med: 29000, p90: 33000, medKv: 31417, medMa: 29500 },   // 9 kvinnor: inga könsmedianer
        { bas: 'E', n: 8, nKv: 4, nMa: 4, p10: 35291, med: 36107, p90: 37000 },                                     // under k: ingen rad alls
    ];
    it('fältet följer med när det finns; ett intervall under k faller bort och könsmedianerna nollas när ett kön är under k', () => {
        const b = bokslut(2025, { basIntervall: bas });
        expect(b.basIntervall.map(r => r.bas)).toEqual(['A', 'C']);
        expect(b.basIntervall[0]).toEqual({ bas: 'A', n: 40, nKv: 25, nMa: 15, p10: 24000, med: 26000, p90: 29000, medKv: 25800, medMa: 26400 });
        expect(b.basIntervall[1]).toMatchObject({ bas: 'C', n: 30, nKv: 9, nMa: 21, med: 29000, medKv: null, medMa: null });
        const text = JSON.stringify(b);
        for (const s of [31417, 35291, 36107]) expect(text).not.toContain(String(s));
    });
    it('ett äldre bokslut utan fältet går att läsa och har basIntervall null; trasiga rader faller', () => {
        expect(bokslut(2025).basIntervall).toBeNull();
        expect(valideraArsbokslut({ ar: 2025, skapat: '2025-01-01', k: 10 }).basIntervall).toBeNull();
        const b = bokslut(2025, { basIntervall: [null, { bas: '', n: 20 }, { bas: 'B', n: 'tjugo' }, { bas: 'D', n: 20, nKv: 10, nMa: 10, med: NaN }] });
        expect(b.basIntervall).toEqual([{ bas: 'D', n: 20, nKv: 10, nMa: 10, p10: null, med: null, p90: null, medKv: null, medMa: null }]);
        expect(bokslut(2025, { basIntervall: 'inte en lista' }).basIntervall).toBeNull();
    });
    it('jämförelsen ger förra året, i år och förändringen i kronor och procent per mått och intervall', () => {
        const forra = bokslut(2025, { basIntervall: bas });
        const nu = bokslut(2026, { basIntervall: [
            { bas: 'A', n: 42, nKv: 26, nMa: 16, p10: 24480, med: 26780, p90: 29870, medKv: 26600, medMa: 27000 },
            { bas: 'C', n: 31, nKv: 10, nMa: 21, p10: 27500, med: 29870, p90: 33500, medKv: 29000, medMa: 30000 },
            { bas: 'K', n: 12, nKv: 6, nMa: 6, p10: 50000, med: 52000, p90: 56000 },
        ] });
        const j = jamforArsbokslut(forra, nu);
        expect(j.basIntervall.map(r => r.bas)).toEqual(['A', 'C', 'K']);
        const a = j.basIntervall[0];
        expect(a.n).toEqual({ forra: 40, nu: 42, diff: 2, pct: 5 });
        expect(a.med).toMatchObject({ forra: 26000, nu: 26780, diff: 780 });
        expect(a.med.pct).toBeCloseTo(3, 5);
        expect(a.p10.pct).toBeCloseTo(2, 5);
        const c = j.basIntervall[1];
        expect(c.medKv).toEqual({ forra: null, nu: 29000, diff: null, pct: null });   // förra året maskerat
        expect(j.basIntervall[2].med).toEqual({ forra: null, nu: 52000, diff: null, pct: null });   // nytt intervall
        expect(j.basIntervall[2].finnsForra).toBe(false);
        expect(a.finnsForra && a.finnsNu).toBe(true);
    });
    it('utan fältet ett av åren är basIntervall null i jämförelsen; hanteln har en rad per intervall med median båda åren', () => {
        expect(jamforArsbokslut(bokslut(2025), bokslut(2026, { basIntervall: bas })).basIntervall).toBeNull();
        const forra = bokslut(2025, { basIntervall: bas });
        const nu = bokslut(2026, { basIntervall: [{ bas: 'A', n: 42, nKv: 26, nMa: 16, med: 26780 }, { bas: 'C', n: 31, nKv: 10, nMa: 21, med: 28500 }, { bas: 'K', n: 12, nKv: 6, nMa: 6, med: 52000 }] });
        const h = basHantelRader(jamforArsbokslut(forra, nu));
        expect(h.rader).toEqual([
            { namn: 'BAS A', bas: 'A', fore: 26000, efter: 26780, andring: 780, riktning: 'upp' },
            { namn: 'BAS C', bas: 'C', fore: 29000, efter: 28500, andring: -500, riktning: 'ned' },
        ]);
        expect(h.utelamnade).toBe(1);
        expect(basHantelRader(null)).toEqual({ rader: [], utelamnade: 0 });
    });
});

describe('årsbokslut: förra årets fil kan ha sparats med en lägre tröskel', () => {
    it('k under 2 i filen höjs till 2, och jämförelsen tillämpar den högre av årens gränser på förra årets rader', () => {
        expect(valideraArsbokslut({ ar: 2025, skapat: '2025-01-01', k: 1 }).k).toBe(2);
        const forra = bokslut(2025, { k: 5,
            grupper: [{ yrke: 'Liten (BAS A)', nKv: 6, nMa: 7, medKv: 66661, medMa: 66663, gapPct: -3, flaggad: true }],
            basIntervall: [
                { bas: 'A', n: 7, nKv: 4, nMa: 3, p10: 77771, med: 77777, p90: 77779 },
                { bas: 'B', n: 150, nKv: 6, nMa: 144, p10: 24000, med: 25000, p90: 27000, medKv: 66661, medMa: 25100 },
            ] });
        const nu = bokslut(2026, { basIntervall: [{ bas: 'B', n: 150, nKv: 75, nMa: 75, p10: 24500, med: 25500, p90: 27500, medKv: 25400, medMa: 25600 }] });
        expect(forra.basIntervall).toHaveLength(2);   // giltiga med filens k = 5
        const j = jamforArsbokslut(forra, nu);
        expect(j.kGrans).toBe(10);
        expect(j.basIntervall.map(r => r.bas)).toEqual(['B']);
        expect(j.basIntervall[0].medKv).toEqual({ forra: null, nu: 25400, diff: null, pct: null });
        expect(j.basIntervall[0].med.forra).toBe(25000);
        const text = JSON.stringify(j);
        for (const s of [77771, 77777, 77779, 66661, 66663]) expect(text).not.toContain(String(s));
        expect(j.grupper.borta).toEqual([]);   // Liten (BAS A) hade 6 kvinnor: under årets gräns
        expect(hantelRader(j).rader.map(r => r.namn)).not.toContain('Liten (BAS A)');
    });
    it('en grupp som var flaggad förra året med ett kön under den högre gränsen räknas som ny i år, inte som kvar (avsiktligt)', () => {
        // Förra året (k = 5): 6 kvinnor och 30 män, flaggad. I år (k = 10): 12 kvinnor, flaggad. Båda åren läses med
        // gränsen 10, så förra årets rad faller bort och gruppen står bland de nya — förra årets gap lämnar aldrig verktyget.
        const forra = bokslut(2025, { k: 5, grupper: [{ yrke: 'Tekniker (BAS D)', nKv: 6, nMa: 30, medKv: 31117, medMa: 34000, gapPct: -8.5, flaggad: true }] });
        const nu = bokslut(2026, { grupper: [{ yrke: 'Tekniker (BAS D)', nKv: 12, nMa: 30, medKv: 31500, medMa: 34000, gapPct: -7.4, flaggad: true }] });
        expect(forra.grupper).toHaveLength(1);   // giltig med filens k = 5
        const j = jamforArsbokslut(forra, nu);
        expect(j.samma_k).toBe(false);
        expect(j.grupper.kvar).toEqual([]);
        expect(j.grupper.nya).toEqual([{ yrke: 'Tekniker (BAS D)', gapForra: null, gapNu: -7.4, nKv: 12, nMa: 30, antalAr: 2026 }]);
        expect(JSON.stringify(j)).not.toContain('-8.5');
        // Med samma gräns båda åren är gruppen kvar.
        const sammaK = jamforArsbokslut(bokslut(2025, { grupper: [{ ...forra.grupper[0], nKv: 10 }] }), nu);
        expect(sammaK.grupper.kvar.map(g => g.yrke)).toEqual(['Tekniker (BAS D)']);
        expect(sammaK.grupper.nya).toEqual([]);
    });
});

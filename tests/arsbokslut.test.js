// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
// Årsbokslutet (ADR-54): validering, k-skydd och jämförelsen mellan två år — den rena modulen.
import { describe, it, expect } from 'vitest';
import { byggArsbokslut, valideraArsbokslut, jamforArsbokslut, hantelRader, basHantelRader, lonespridning, ARSBOKSLUT_NYCKELTAL } from '../src/lib/arsbokslut.js';
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
        expect(b).toMatchObject({ version: 2, ar: 2025, skapat: '2025-11-01', k: 10 });
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
        expect(j.grupper.borta).toEqual([{ yrke: 'Bara förra (BAS A)', gapForra: -8, gapNu: null, nKv: 20, nMa: 20, antalAr: 2025, spridningForra: null, spridningNu: null }]);
        expect(j.grupper.nya).toEqual([{ yrke: 'Bara nu (BAS A)', gapForra: null, gapNu: -9, nKv: 20, nMa: 20, antalAr: 2026, spridningForra: null, spridningNu: null }]);
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
        expect(b.basIntervall[0]).toEqual({ bas: 'A', n: 40, nKv: 25, nMa: 15, p10: 24000, med: 26000, p90: 29000, medKv: 25800, medMa: 26400, spridning: null });
        expect(b.basIntervall[1]).toMatchObject({ bas: 'C', n: 30, nKv: 9, nMa: 21, med: 29000, medKv: null, medMa: null });
        const text = JSON.stringify(b);
        for (const s of [31417, 35291, 36107]) expect(text).not.toContain(String(s));
    });
    it('ett äldre bokslut utan fältet går att läsa och har basIntervall null; trasiga rader faller', () => {
        expect(bokslut(2025).basIntervall).toBeNull();
        expect(valideraArsbokslut({ ar: 2025, skapat: '2025-01-01', k: 10 }).basIntervall).toBeNull();
        const b = bokslut(2025, { basIntervall: [null, { bas: '', n: 20 }, { bas: 'B', n: 'tjugo' }, { bas: 'D', n: 20, nKv: 10, nMa: 10, med: NaN }] });
        expect(b.basIntervall).toEqual([{ bas: 'D', n: 20, nKv: 10, nMa: 10, p10: null, med: null, p90: null, medKv: null, medMa: null, spridning: null }]);
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
        expect(j.grupper.nya).toEqual([{ yrke: 'Tekniker (BAS D)', gapForra: null, gapNu: -7.4, nKv: 12, nMa: 30, antalAr: 2026, spridningForra: null, spridningNu: null }]);
        expect(JSON.stringify(j)).not.toContain('-8.5');
        // Med samma gräns båda åren är gruppen kvar.
        const sammaK = jamforArsbokslut(bokslut(2025, { grupper: [{ ...forra.grupper[0], nKv: 10 }] }), nu);
        expect(sammaK.grupper.kvar.map(g => g.yrke)).toEqual(['Tekniker (BAS D)']);
        expect(sammaK.grupper.nya).toEqual([]);
    });
});

describe('årsbokslut: lönespridningen (P90 − P10) / median', () => {
    it('räknas för en lönelista med minst k personer, avrundad till fyra decimaler; under k, tom eller median 0 ger null', () => {
        const lon = [20000, 22000, 24000, 26000, 28000, 30000, 32000, 34000, 36000, 38000];
        // P10 = 21 800, P90 = 36 200 (linjär interpolation), median 29 000.
        expect(lonespridning(lon, 10)).toBe(Math.round((36200 - 21800) / 29000 * 1e4) / 1e4);
        expect(lonespridning(lon, 11)).toBeNull();
        expect(lonespridning([], 2)).toBeNull();
        expect(lonespridning([0, 0, 0], 2)).toBeNull();
        expect(lonespridning(Array(12).fill(31417), 10)).toBe(0);
    });
    it('följer med på yrkesgruppernas och BAS-intervallens rader; ett trasigt eller negativt värde och en äldre fil utan fältet ger null', () => {
        const b = bokslut(2025, {
            grupper: [{ yrke: 'Kock (BAS B)', nKv: 12, nMa: 15, medKv: 27000, medMa: 27500, gapPct: -1.8, flaggad: false, spridning: 0.3125 },
                      { yrke: 'Bagare (BAS B)', nKv: 12, nMa: 15, medKv: 27000, medMa: 27500, gapPct: -1.8, flaggad: false, spridning: -1 },
                      { yrke: 'Gammal (BAS B)', nKv: 12, nMa: 15, medKv: 27000, medMa: 27500, gapPct: -1.8, flaggad: false }],
            basIntervall: [{ bas: 'A', n: 40, nKv: 25, nMa: 15, p10: 24000, med: 26000, p90: 29000, spridning: 0.1923 },
                           { bas: 'B', n: 40, nKv: 25, nMa: 15, med: 26000, spridning: 'mycket' }],
        });
        expect(b.grupper.map(g => g.spridning)).toEqual([0.3125, null, null]);
        expect(b.basIntervall.map(r => r.spridning)).toEqual([0.1923, null]);
    });
    it('jämförelsen har spridningen förra året och i år per yrkesgrupp och per BAS-intervall, med skillnaden', () => {
        const g = (yrke, spridning, gapPct) => ({ yrke, nKv: 12, nMa: 15, medKv: 27000, medMa: 29000, gapPct, flaggad: true, ...(spridning === null ? {} : { spridning }) });
        const forra = bokslut(2025, { grupper: [g('Kock (BAS B)', 0.30, -6.9), g('Gammal (BAS B)', null, -7)],
            basIntervall: [{ bas: 'A', n: 40, nKv: 25, nMa: 15, med: 26000, spridning: 0.25 }, { bas: 'C', n: 30, nKv: 15, nMa: 15, med: 29000 }] });
        const nu = bokslut(2026, { grupper: [g('Kock (BAS B)', 0.28, -6.0), g('Gammal (BAS B)', 0.4, -8)],
            basIntervall: [{ bas: 'A', n: 42, nKv: 26, nMa: 16, med: 26780, spridning: 0.22 }, { bas: 'C', n: 31, nKv: 15, nMa: 16, med: 29500, spridning: 0.31 }] });
        const j = jamforArsbokslut(forra, nu);
        expect(j.grupper.kvar.find(r => r.yrke === 'Kock (BAS B)')).toMatchObject({ spridningForra: 0.30, spridningNu: 0.28 });
        expect(j.grupper.kvar.find(r => r.yrke === 'Gammal (BAS B)')).toMatchObject({ spridningForra: null, spridningNu: 0.4 });
        expect(j.basIntervall[0].spridning.forra).toBe(0.25);
        expect(j.basIntervall[0].spridning.nu).toBe(0.22);
        expect(j.basIntervall[0].spridning.diff).toBeCloseTo(-0.03, 10);
        expect(j.basIntervall[1].spridning).toEqual({ forra: null, nu: 0.31, diff: null });   // äldre fil: inget värde förra året
    });
});

describe('årsbokslut version 2: de sakliga skälen (bedomningar)', () => {
    const bed = (nyckel, skillnadKr, skal, over = {}) => ({ nyckel, grupp: `Grupp ${nyckel}`, n: 20, nMin: 12, skillnadKr, skal, ...over });
    const med = (ar, bedomningar) => bokslut(ar, { bedomningar });
    it('version 2; skälen sparas utan kommentar, per grupp med nyckel, antal och skillnad', () => {
        const b = med(2026, [bed('prio|5301|C', 1800, [{ kategori: 'marknad', belopp: 900, kommentar: 'Svårrekryterat 12345' }])]);
        expect(b.version).toBe(2);
        expect(b.bedomningar).toEqual([{ nyckel: 'prio|5301|C', grupp: 'Grupp prio|5301|C', n: 20, nMin: 12, skillnadKr: 1800, skal: [{ kategori: 'marknad', belopp: 900 }] }]);
        expect(JSON.stringify(b)).not.toContain('12345');
    });
    it('ett bokslut från version 1 läses utan skäl: bedomningar är null (fältet saknades), inte en tom lista', () => {
        const v1 = { ...bokslut(2025), version: 1 };
        delete v1.bedomningar;
        const b = valideraArsbokslut(v1);
        expect(b).not.toBeNull();
        expect(b.bedomningar).toBeNull();
        expect(b.grupper).toHaveLength(3);
        expect(med(2026, []).bedomningar).toEqual([]);
    });
    it('k: en grupp med färre än k personer faller bort; under k i den minsta gruppen stryks skillnaden och beloppen', () => {
        const b = med(2026, [bed('a', 1500, [{ kategori: 'marknad', belopp: 500 }], { n: 9 }),
            bed('b', 2345, [{ kategori: 'marknad', belopp: 13579 }, { kategori: 'okand', belopp: 1 }, { kategori: 'marknad', belopp: 2 }], { nMin: 7 })]);
        expect(b.bedomningar).toEqual([{ nyckel: 'b', grupp: 'Grupp b', n: 20, nMin: 7, skillnadKr: null, skal: [{ kategori: 'marknad' }] }]);
        expect(JSON.stringify(b)).not.toContain('2345');
        expect(JSON.stringify(b)).not.toContain('13579');
    });
    it('en nyckel som står två gånger: den första gäller', () => {
        const b = med(2026, [bed('a', 1000, [{ kategori: 'marknad', belopp: 100 }]), bed('a', 2000, [{ kategori: 'annat', belopp: 200 }])]);
        expect(b.bedomningar.map(x => [x.nyckel, x.skillnadKr, x.skal])).toEqual([['a', 1000, [{ kategori: 'marknad', belopp: 100 }]]]);
    });
    it('ogiltiga skäl och poster utan skäl faller bort; en nyckel som inte är text faller bort', () => {
        const b = med(2026, [bed('a', 1000, [{ kategori: 'okand', belopp: 5 }]), bed('b', 1000, []), { ...bed('c', 1000, [{ kategori: 'annat', belopp: 5 }]), nyckel: 7 }, null,
            bed('d', 1000, [{ kategori: 'annat', belopp: 5 }, { kategori: 'marknad', belopp: -1 }])]);
        expect(b.bedomningar.map(x => [x.nyckel, x.skal])).toEqual([['d', [{ kategori: 'annat', belopp: 5 }]]]);
    });
    it('bokslutMedGrans: en högre gräns i år tar bort grupper och skillnader under den', () => {
        const forra = med(2025, [bed('a', 1500, [{ kategori: 'marknad', belopp: 500 }], { n: 11, nMin: 11 }), bed('b', 1500, [{ kategori: 'marknad', belopp: 500 }], { n: 30, nMin: 11 })]);
        const nu = bokslut(2026, { k: 12, bedomningar: [] });
        const j = jamforArsbokslut(forra, nu);
        expect(j.bedomningar.saknasIAr.map(g => g.nyckel)).toEqual(['b']);
        // Med årets högre gräns är den minsta gruppen bakom b under k: beloppet stryks, och kategorin räknas inte i summorna.
        expect(j.bedomningar.kategorier).toEqual([]);
    });
    it('jämförelsen: en grupp med bara kategorier (ett kön under k) visas med kategorinamnen och ger inga belopp', () => {
        const forra = med(2025, [bed('a', 1000, [{ kategori: 'marknad', belopp: 400 }]), bed('b', null, [{ kategori: 'utbildning', belopp: 300 }], { nMin: 5 })]);
        const nu = med(2026, [bed('a', 1000, [{ kategori: 'marknad', belopp: 500 }]), bed('b', null, [{ kategori: 'utbildning', belopp: 200 }], { nMin: 5 })]);
        const j = jamforArsbokslut(forra, nu).bedomningar;
        expect(j.kategorier).toEqual([{ kategori: 'marknad', namn: 'Marknad', forra: { summa: 400, andel: 0.4 }, nu: { summa: 500, andel: 0.5 }, diff: 100 }]);
        expect(j.grupper.find(g => g.nyckel === 'b')).toEqual({ nyckel: 'b', grupp: 'Grupp b',
            forra: { skillnadKr: null, skal: [{ kategori: 'utbildning', namn: 'Utbildning', belopp: null, andel: null }] },
            nu: { skillnadKr: null, skal: [{ kategori: 'utbildning', namn: 'Utbildning', belopp: null, andel: null }] } });
        expect(JSON.stringify(j)).not.toMatch(/NaN/);
    });
});

describe('årsbokslut: jämförelsen av de sakliga skälen', () => {
    const bed = (nyckel, skillnadKr, skal) => ({ nyckel, grupp: `Grupp ${nyckel}`, n: 20, nMin: 12, skillnadKr, skal });
    const forra = () => bokslut(2025, { bedomningar: [
        bed('prio|1|C', 1800, [{ kategori: 'marknad', belopp: 900 }, { kategori: 'erfarenhet', belopp: 360 }]),
        bed('par|2|C|3|C', 1000, [{ kategori: 'overgang', belopp: 500 }]),
    ] });
    const nu = () => bokslut(2026, { bedomningar: [
        bed('prio|1|C', 1200, [{ kategori: 'marknad', belopp: 360 }]),
        bed('prio|9|B', 2000, [{ kategori: 'utbildning', belopp: 1000 }]),
    ] });
    it('per kategori båda åren: belopp och andel av skillnaden i bedömda grupper, och förändringen i kronor', () => {
        const j = jamforArsbokslut(forra(), nu()).bedomningar;
        expect(j.kategorier).toEqual([
            { kategori: 'marknad', namn: 'Marknad', forra: { summa: 900, andel: 900 / 2800 }, nu: { summa: 360, andel: 360 / 3200 }, diff: -540 },
            { kategori: 'utbildning', namn: 'Utbildning', forra: null, nu: { summa: 1000, andel: 1000 / 3200 }, diff: null },
            { kategori: 'erfarenhet', namn: 'Erfarenhet', forra: { summa: 360, andel: 360 / 2800 }, nu: null, diff: null },
            { kategori: 'overgang', namn: 'Övergång', forra: { summa: 500, andel: 500 / 2800 }, nu: null, diff: null },
        ]);
        expect(j.totalt).toEqual({ forra: { summa: 1760, andel: 1760 / 2800, antalGrupper: 2 }, nu: { summa: 1360, andel: 1360 / 3200, antalGrupper: 2 } });
    });
    it('per grupp som bedömdes båda åren: skälen och skillnaden förra året och i år', () => {
        const j = jamforArsbokslut(forra(), nu()).bedomningar;
        expect(j.grupper).toEqual([{ nyckel: 'prio|1|C', grupp: 'Grupp prio|1|C',
            forra: { skillnadKr: 1800, skal: [{ kategori: 'marknad', namn: 'Marknad', belopp: 900, andel: 0.5 }, { kategori: 'erfarenhet', namn: 'Erfarenhet', belopp: 360, andel: 0.2 }] },
            nu: { skillnadKr: 1200, skal: [{ kategori: 'marknad', namn: 'Marknad', belopp: 360, andel: 0.3 }] } }]);
    });
    it('grupper som bedömdes förra året men saknar skäl i år: Bedömning saknas i år', () => {
        const j = jamforArsbokslut(forra(), nu()).bedomningar;
        expect(j.saknasIAr).toEqual([{ nyckel: 'par|2|C|3|C', grupp: 'Grupp par|2|C|3|C' }]);
    });
    it('null när ett av åren saknar fältet (ett bokslut från version 1)', () => {
        const v1 = { ...forra(), version: 1 }; delete v1.bedomningar;
        expect(jamforArsbokslut(valideraArsbokslut(v1), nu()).bedomningar).toBeNull();
    });
});

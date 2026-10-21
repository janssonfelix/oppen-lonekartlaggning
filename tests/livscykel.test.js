/**
 * Lib-tester för src/lib/livscykel.js, direkt mot modulen (utan jsdom och utan appen).
 *
 * Fixturen är deterministisk (LCG) och har ett känt kön-effekt-mönster. Könskoefficienten
 * jämförs mot fitOLS på samma designmatris, skriven här för hand, så att modellen inte
 * bara "ser rimlig ut" utan faktiskt skattar det den säger att den skattar.
 */
import { describe, it, expect } from 'vitest';
import { livscykelRegression } from '../src/lib/livscykel.js';
import { fitOLS } from '../src/lib/stat.js';

function lcg(seed) {
    return () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
}

// n personer, tre BAS, kvinnor får ≈ 10 % lägre lön (log-skala -0,1), med lite brus.
function fixtur(n = 240, seed = 7) {
    const rnd = lcg(seed);
    const bas = ['A', 'B', 'C'];
    return Array.from({ length: n }, (_, i) => {
        const kv = i % 2 === 0;
        const alder = 25 + Math.floor(rnd() * 41);
        const b = bas[Math.floor(rnd() * 3)];
        const brus = (rnd() - 0.5) * 0.05;
        const log = 10 + (kv ? -0.1 : 0) + 0.01 * (alder - 25) + (b === 'B' ? 0.1 : b === 'C' ? 0.2 : 0) + brus;
        return { kon: kv ? 'kvinna' : 'man', alder, bas: b, lon: Math.exp(log) };
    });
}

// Designmatrisen, skriven om här så att testet inte delar kod med modellen.
function designMatris(rader, basList) {
    const ageMean = rader.reduce((s, d) => s + d.alder, 0) / rader.length;
    const dummies = basList.slice(1);
    const X = rader.map(d => {
        const kv = d.kon.includes('kvinna') ? 1 : 0;
        const ac = d.alder - ageMean;
        return [1, kv, ac, ac * ac, kv * ac, kv * ac * ac, ...dummies.map(b => (d.bas === b ? 1 : 0))];
    });
    const y = rader.map(d => Math.log(d.lon));
    return { X, y, ageMean, dummies };
}

describe('livscykelRegression: felvägar', () => {
    it('färre än 50 observationer ger felkod low_n', () => {
        const res = livscykelRegression(fixtur(40), { golv: 10 });
        expect(res.error).toMatch(/n < 50/);
        expect(res.errorCode).toBe('low_n');
    });

    it('för få av ett kön ger felkod imbalance med golvet i texten', () => {
        const rader = fixtur(240).map((d, i) => (i < 230 ? { ...d, kon: 'man' } : d));
        const res = livscykelRegression(rader, { golv: 10 });
        expect(res.errorCode).toBe('imbalance');
        expect(res.error).toMatch(/Minst 10 av varje/);
    });

    it('bara ett BAS-intervall ger felkod single_bas', () => {
        const rader = fixtur(240).map(d => ({ ...d, bas: 'A' }));
        expect(livscykelRegression(rader, { golv: 10 }).errorCode).toBe('single_bas');
    });

    it('tom indata ger felet för få observationer', () => {
        expect(livscykelRegression([], { golv: 10 }).errorCode).toBe('low_n');
    });
});

describe('livscykelRegression: skattning', () => {
    const rader = fixtur(240);
    const res = livscykelRegression(rader, { golv: 10 });

    it('returnerar ett ok-resultat med de förväntade fälten', () => {
        expect(res.ok).toBe(true);
        expect(res.n).toBe(240);
        expect(res.k).toBe(8);   // 6 kolumner + 2 BAS-dummies
        expect(res.basList).toEqual(['A', 'B', 'C']);
        expect(res.refBas).toBe('A');
        expect(res.predKvinna.length).toBe(41);
        expect(res.predMan.length).toBe(41);
        expect(res.gapPerAge.length).toBe(41);
        expect(res.predKvinna[0].age).toBe(25);
        expect(res.predKvinna[40].age).toBe(65);
    });

    it('könskoefficienten är exakt den som fitOLS ger på samma designmatris', () => {
        const basList = ['A', 'B', 'C'];
        const { X, y } = designMatris(rader, basList);
        const fit = fitOLS(X, y);
        expect(res.kvCoef).toBeCloseTo(fit.beta[1], 12);
        expect(res.kvSE).toBeCloseTo(Math.sqrt(fit.vcovHC3[1][1]), 12);
        expect(res.kvAgeCoef).toBeCloseTo(fit.beta[4], 12);
        expect(res.kvAge2Coef).toBeCloseTo(fit.beta[5], 12);
        expect(res.R2).toBeCloseTo(fit.R2, 12);
    });

    it('könseffekten ligger nära den inbyggda -0,1 på log-skala', () => {
        expect(Math.abs(res.kvCoef - (-0.1))).toBeLessThan(0.02);
    });

    it('gapet vid 25 år följer prediktionerna: 1 − kvinna/man', () => {
        const kvinna = res.predKvinna[0].lon;
        const man = res.predMan[0].lon;
        expect(res.gapAt25).toBeCloseTo((man / kvinna - 1) * 100, 6);
        expect(res.gapAt65).toBeCloseTo((res.predMan[40].lon / res.predKvinna[40].lon - 1) * 100, 6);
        expect(res.gapDelta).toBeCloseTo(res.gapAt65 - res.gapAt25, 10);
    });

    it('prediktionerna har ett KI som ligger runt punktskattningen', () => {
        for (const p of res.predKvinna) {
            expect(p.lo).toBeLessThanOrEqual(p.lon);
            expect(p.hi).toBeGreaterThanOrEqual(p.lon);
        }
    });

    it('AIC och justerat R² är ändliga och justerat R² ligger under R²', () => {
        expect(Number.isFinite(res.aic)).toBe(true);
        expect(res.adjR2).toBeLessThanOrEqual(res.R2);
    });
});

describe('livscykelRegression: fixBas', () => {
    it('default är den mest folkrika BAS-gruppen', () => {
        const rader = fixtur(240);
        // Räknas här för hand i stället för att läsas ur modellen.
        const antal = { A: 0, B: 0, C: 0 };
        rader.forEach(d => { antal[d.bas]++; });
        const mest = Object.keys(antal).reduce((a, b) => (antal[b] > antal[a] ? b : a));
        expect(livscykelRegression(rader, { golv: 10 }).fixBas).toBe(mest);
    });

    it('en angiven fixBas som finns i data används', () => {
        const res = livscykelRegression(fixtur(240), { fixBas: 'C', golv: 10 });
        expect(res.fixBas).toBe('C');
    });

    it('en okänd fixBas ersätts av den mest folkrika', () => {
        const rader = fixtur(240);
        const utan = livscykelRegression(rader, { golv: 10 });
        const res = livscykelRegression(rader, { fixBas: 'Z', golv: 10 });
        expect(res.fixBas).toBe(utan.fixBas);
    });

    it('prediktionerna för olika fixBas skiljer sig åt på nivån, inte i gapet', () => {
        const rader = fixtur(240);
        const a = livscykelRegression(rader, { fixBas: 'A', golv: 10 });
        const c = livscykelRegression(rader, { fixBas: 'C', golv: 10 });
        expect(c.predMan[0].lon).toBeGreaterThan(a.predMan[0].lon);
        expect(c.gapAt25).toBeCloseTo(a.gapAt25, 10);
    });
});

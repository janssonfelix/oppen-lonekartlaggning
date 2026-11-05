/**
 * Lib-tester för src/lib/regression.js, direkt mot modulen (utan jsdom och utan appen).
 *
 * Prövar samma referensvärden som tests/stat-referens.test.js, men på den rena modellen:
 *   - "Endast kön"-steget i den sekventiella dekomponeringen mot statsmodels-värdet
 *   - kvantilregressionen (τ = 0,1 / 0,5 / 0,9) mot den exakta LP-lösningen (≡ quantreg::rq)
 * Fixturerna och referensvärdena beskrivs i filhuvudet till tests/stat-referens.test.js.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { computeSequentialGap, quantileRegression, FORKLARINGSMODELL_STANDARD, TILLFOR_GRANS_PP,
    normaliseraForklaringsmodell, forklaringsmodellArStandard, modellFras, modellBeskrivning, modellVariabler } from '../src/lib/regression.js';

const here = dirname(fileURLToPath(import.meta.url));
const las = f => JSON.parse(readFileSync(join(here, 'fixtures', f), 'utf8'));
const fx = las('stat-referens.json');
const ref = las('stat-referens-varden.json');

const pct = b => (Math.exp(b) - 1) * 100;
const X = fx.design.map(d => [1, d.kv, d.alderC, d.basC]);
const y = fx.design.map(d => d.y);

describe('computeSequentialGap: steget "Endast kön"', () => {
    it('könsgapet i procent matchar statsmodels-referensen', () => {
        const basList = [...new Set(fx.rows.map(r => r.bas))].sort();
        const steg = computeSequentialGap(fx.rows.map(r => ({ ...r })), fx.ageMean, basList, { golv: 10 });
        expect(steg[0].name).toBe('Endast kön');
        expect(steg[0].status).toBe('ok');
        expect(steg[0].gapPct).toBeCloseTo(pct(ref.sekventiell.endastKon[1]), 8);
    });
});

describe('quantileRegression mot exakt LP-lösning (≡ quantreg::rq)', () => {
    // Samma toleranser som tests/stat-referens.test.js: IRLS är en approximation.
    const tolBeta = 3e-3, tolKonPp = 0.3;
    for (const tau of [0.1, 0.5, 0.9]) {
        it(`τ = ${tau}: alla β inom ${tolBeta}, könskoefficienten inom ${tolKonPp} procentenheter`, () => {
            const fit = quantileRegression(X, y, tau);
            expect(fit).not.toBeNull();
            const rb = ref.quantreg[String(tau)].beta;
            rb.forEach((b, i) => expect(Math.abs(fit.beta[i] - b)).toBeLessThan(tolBeta));
            expect(Math.abs(pct(fit.beta[1]) - pct(rb[1]))).toBeLessThan(tolKonPp);
            // Check-förlusten ska ligga nära LP-optimum (per definition ≥ optimum).
            const forlust = y.reduce((s, yi, i) => {
                const r = yi - X[i].reduce((a, v, j) => a + v * fit.beta[j], 0);
                return s + (r >= 0 ? tau * r : (tau - 1) * r);
            }, 0);
            expect(forlust).toBeGreaterThanOrEqual(ref.quantreg[String(tau)].loss - 1e-9);
            expect(forlust / ref.quantreg[String(tau)].loss - 1).toBeLessThan(1e-3);
        });
    }
});

describe('förklaringsmodellen som värde (ADR-56)', () => {
    const m = (bas, alder, yrkesgrupp = false, skal = '') => ({ bas, alder, yrkesgrupp, skal });
    it('standard: null och undefined ger fullmodellen utan yrkesgrupp, utan varningar', () => {
        expect(FORKLARINGSMODELL_STANDARD).toEqual(m(true, true));
        expect(TILLFOR_GRANS_PP).toBe(0.5);
        for (const v of [null, undefined]) {
            const r = normaliseraForklaringsmodell(v);
            expect(r.modell).toEqual(m(true, true));
            expect(r.varningar).toEqual([]);
        }
        expect(forklaringsmodellArStandard(m(true, true))).toBe(true);
        expect(forklaringsmodellArStandard(m(true, false))).toBe(false);
        expect(forklaringsmodellArStandard(m(true, true, false, 'skäl'))).toBe(false);
    });
    it('booleska fält tvingas: ett annat värde än true räknas som falskt', () => {
        const r = normaliseraForklaringsmodell({ alder: 'ja', bas: true });
        expect(r.modell.alder).toBe(false);
        expect(r.modell.bas).toBe(true);
        expect(r.modell.yrkesgrupp).toBe(false);
    });
    it('yrkesgrupp kräver BAS: BAS kryssas i med en varning', () => {
        const r = normaliseraForklaringsmodell({ yrkesgrupp: true, bas: false, alder: true });
        expect(r.modell).toEqual(m(true, true, true));
        expect(r.varningar.join(' ')).toMatch(/BAS/);
    });
    it('yrkesgrupp utan yrke i datat: stängs av med en varning', () => {
        const r = normaliseraForklaringsmodell({ yrkesgrupp: true, bas: true, alder: true }, { harYrke: false });
        expect(r.modell.yrkesgrupp).toBe(false);
        expect(r.varningar.length).toBe(1);
    });
    it('skälet klipps till 300 tecken och blir tomt när det inte är en sträng; fel typ ger standard med varning', () => {
        expect(normaliseraForklaringsmodell({ bas: true, alder: true, skal: 'x'.repeat(400) }).modell.skal).toHaveLength(300);
        expect(normaliseraForklaringsmodell({ bas: true, alder: true, skal: 42 }).modell.skal).toBe('');
        const r = normaliseraForklaringsmodell('full');
        expect(r.modell).toEqual(m(true, true));
        expect(r.varningar.length).toBe(1);
    });
    it('frasen för de sex kombinationerna', () => {
        expect(modellFras(m(true, true))).toBe('ålder och nivå');
        expect(modellFras(m(true, false))).toBe('nivå');
        expect(modellFras(m(false, true))).toBe('ålder');
        expect(modellFras(m(true, false, true))).toBe('nivå och yrkesgrupp');
        expect(modellFras(m(true, true, true))).toBe('ålder, nivå och yrkesgrupp');
        expect(modellFras(m(false, false))).toBe('');
    });
    it('beskrivningen för modelDesc och variablerna i fast ordning', () => {
        expect(modellBeskrivning(m(true, true))).toBe('kön + ålder + BAS-intervall (indikatorer)');
        expect(modellBeskrivning(m(true, false))).toBe('kön + BAS-intervall (indikatorer)');
        expect(modellBeskrivning(m(false, true))).toBe('kön + ålder');
        expect(modellBeskrivning(m(false, false))).toBe('kön');
        expect(modellBeskrivning(m(true, false, true))).toBe('kön + BAS-intervall (indikatorer) + yrkesgrupp inom BAS (fasta effekter)');
        expect(modellVariabler(m(true, true, true))).toEqual(['bas', 'alder', 'yrkesgrupp']);
        expect(modellVariabler(m(false, true))).toEqual(['alder']);
        expect(modellVariabler(m(false, false))).toEqual([]);
    });
});

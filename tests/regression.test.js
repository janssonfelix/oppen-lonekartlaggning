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
import { computeSequentialGap, quantileRegression } from '../src/lib/regression.js';

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

/**
 * Vitest-tester för statistiska kärnfunktionerna i src/lib/stat.js.
 *
 * Körs med: npm test
 *
 * Täcker:
 *   - median / quantile (kanttillstånd, jämn/udda längd, P10/P50/P90)
 *   - linearRegression (perfekt linje, brusig data)
 *   - normalCdf (Φ vid kända punkter ±1σ ±2σ)
 *   - matMul / transpose / invert (identitet, singulär)
 *   - fitOLS (kända koefficienter, HC3 vs klassisk vcov, n<k+2)
 */

import { describe, it, expect } from 'vitest';
import {
    median,
    quantile,
    linearRegression,
    normalCdf,
    tDistCdf,
    tQuantile,
    pValue2Sided,
    matMul,
    transpose,
    invert,
    fitOLS
} from '../src/lib/stat.js';

const close = (a, b, tol = 1e-9) => Math.abs(a - b) < tol;

describe('median', () => {
    it('returnerar 0 för tom array', () => {
        expect(median([])).toBe(0);
    });
    it('udda längd: mittersta värdet', () => {
        expect(median([1, 2, 3, 4, 5])).toBe(3);
    });
    it('jämn längd: snitt av två mittersta', () => {
        expect(median([1, 2, 3, 4])).toBe(2.5);
    });
    it('osorterad input fungerar', () => {
        expect(median([5, 1, 4, 2, 3])).toBe(3);
    });
    it('muterar inte input-arrayen', () => {
        const arr = [3, 1, 2];
        median(arr);
        expect(arr).toEqual([3, 1, 2]);
    });
});

describe('quantile', () => {
    const arr = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    it('q=0 → minimum', () => {
        expect(quantile(arr, 0)).toBe(1);
    });
    it('q=1 → maximum', () => {
        expect(quantile(arr, 1)).toBe(10);
    });
    it('q=0.5 → median', () => {
        expect(quantile(arr, 0.5)).toBe(5.5);
    });
    it('linjär interpolation vid q=0.1', () => {
        // pos = 9 * 0.1 = 0.9 → mellan arr[0]=1 och arr[1]=2 → 1.9
        expect(close(quantile(arr, 0.1), 1.9)).toBe(true);
    });
    it('linjär interpolation vid q=0.9', () => {
        // pos = 9 * 0.9 = 8.1 → mellan arr[8]=9 och arr[9]=10 → 9.1
        expect(close(quantile(arr, 0.9), 9.1)).toBe(true);
    });
    it('returnerar 0 för tom array', () => {
        expect(quantile([], 0.5)).toBe(0);
    });
});

describe('linearRegression', () => {
    it('perfekt linje y = 2x + 1', () => {
        const data = [
            [0, 1],
            [1, 3],
            [2, 5],
            [3, 7],
            [4, 9]
        ];
        const r = linearRegression(data);
        expect(close(r.m, 2)).toBe(true);
        expect(close(r.b, 1)).toBe(true);
        expect(close(r.r2, 1)).toBe(true);
    });
    it('horisontell linje (m=0)', () => {
        const data = [
            [1, 5],
            [2, 5],
            [3, 5]
        ];
        const r = linearRegression(data);
        expect(close(r.m, 0)).toBe(true);
        expect(close(r.b, 5)).toBe(true);
        // ssTot = 0 → R² returneras som 0
        expect(r.r2).toBe(0);
    });
    it('tom array returnerar nollor', () => {
        expect(linearRegression([])).toEqual({ m: 0, b: 0, r2: 0 });
    });
});

describe('normalCdf', () => {
    it('Φ(0) ≈ 0.5', () => {
        expect(close(normalCdf(0), 0.5, 1e-6)).toBe(true);
    });
    it('Φ(1.96) ≈ 0.975 (95%-konfidens)', () => {
        expect(close(normalCdf(1.96), 0.975, 1e-3)).toBe(true);
    });
    it('Φ(-1.96) ≈ 0.025', () => {
        expect(close(normalCdf(-1.96), 0.025, 1e-3)).toBe(true);
    });
    it('symmetri Φ(-x) = 1 - Φ(x)', () => {
        for (const x of [0.5, 1, 1.5, 2.5]) {
            expect(close(normalCdf(-x) + normalCdf(x), 1, 1e-6)).toBe(true);
        }
    });
});

describe('matMul / transpose / invert', () => {
    it('matMul: 2×3 · 3×2', () => {
        const A = [
            [1, 2, 3],
            [4, 5, 6]
        ];
        const B = [
            [7, 8],
            [9, 10],
            [11, 12]
        ];
        expect(matMul(A, B)).toEqual([
            [58, 64],
            [139, 154]
        ]);
    });
    it('transpose 2×3 → 3×2', () => {
        expect(
            transpose([
                [1, 2, 3],
                [4, 5, 6]
            ])
        ).toEqual([
            [1, 4],
            [2, 5],
            [3, 6]
        ]);
    });
    it('invert(I) = I', () => {
        const I = [
            [1, 0, 0],
            [0, 1, 0],
            [0, 0, 1]
        ];
        const inv = invert(I);
        for (let i = 0; i < 3; i++) {
            for (let j = 0; j < 3; j++) {
                expect(close(inv[i][j], I[i][j])).toBe(true);
            }
        }
    });
    it('invert · A = I', () => {
        const A = [
            [4, 7],
            [2, 6]
        ];
        const inv = invert(A);
        const I = matMul(A, inv);
        expect(close(I[0][0], 1, 1e-9)).toBe(true);
        expect(close(I[0][1], 0, 1e-9)).toBe(true);
        expect(close(I[1][0], 0, 1e-9)).toBe(true);
        expect(close(I[1][1], 1, 1e-9)).toBe(true);
    });
    it('invert returnerar null för singulär matris', () => {
        // Rad 2 = 2 · rad 1
        const sing = [
            [1, 2],
            [2, 4]
        ];
        expect(invert(sing)).toBeNull();
    });
});

describe('fitOLS', () => {
    it('återskapar kända koefficienter på brusfri data: y = 3 + 2·x1 - 1·x2', () => {
        const X = [];
        const y = [];
        for (let i = 0; i < 50; i++) {
            const x1 = i;
            const x2 = (i * 7) % 11;
            X.push([1, x1, x2]);
            y.push(3 + 2 * x1 - 1 * x2);
        }
        const fit = fitOLS(X, y);
        expect(fit).not.toBeNull();
        expect(close(fit.beta[0], 3, 1e-6)).toBe(true);
        expect(close(fit.beta[1], 2, 1e-6)).toBe(true);
        expect(close(fit.beta[2], -1, 1e-6)).toBe(true);
        expect(close(fit.R2, 1, 1e-6)).toBe(true);
    });
    it('returnerar null när n < k + 2', () => {
        const X = [
            [1, 1, 2],
            [1, 2, 4]
        ];
        const y = [3, 5];
        expect(fitOLS(X, y)).toBeNull();
    });
    it('returnerar null när X singulär (perfekt kolinearitet)', () => {
        const X = [];
        const y = [];
        for (let i = 0; i < 30; i++) {
            X.push([1, i, 2 * i]); // kolumn 2 = 2 · kolumn 1 → singulär
            y.push(i + Math.random());
        }
        expect(fitOLS(X, y)).toBeNull();
    });
    it('HC3 vcov är symmetrisk + skiljer sig från klassisk vid heteroskedastik', () => {
        // Variansen i residualerna växer med x → klassisk SE undervärderar.
        const X = [];
        const y = [];
        let seed = 1;
        const rand = () => {
            // deterministisk pseudoslump för reproducerbarhet
            seed = (seed * 9301 + 49297) % 233280;
            return seed / 233280;
        };
        for (let i = 0; i < 100; i++) {
            const x = i / 10;
            X.push([1, x]);
            const noise = (rand() - 0.5) * 2 * x; // växande varians
            y.push(2 + 3 * x + noise);
        }
        const fit = fitOLS(X, y);
        expect(fit).not.toBeNull();
        // Symmetri
        expect(close(fit.vcovHC3[0][1], fit.vcovHC3[1][0], 1e-12)).toBe(true);
        expect(close(fit.vcovClassic[0][1], fit.vcovClassic[1][0], 1e-12)).toBe(true);
        // Båda diagonalelement positiva
        expect(fit.vcovHC3[0][0]).toBeGreaterThan(0);
        expect(fit.vcovHC3[1][1]).toBeGreaterThan(0);
    });
});

describe('tDistCdf', () => {
    // Kända t-fördelningsvärden från standardtabeller (R: pt(q, df))
    // df=1 (Cauchy): pt(0, 1) = 0.5; pt(1, 1) ≈ 0.75; pt(-1, 1) ≈ 0.25
    it('returnerar 0,5 vid t=0', () => {
        expect(close(tDistCdf(0, 10), 0.5, 1e-3)).toBe(true);
        expect(close(tDistCdf(0, 30), 0.5, 1e-3)).toBe(true);
    });
    it('är symmetrisk runt 0', () => {
        for (const df of [5, 20, 50]) {
            const a = tDistCdf(2.0, df);
            const b = tDistCdf(-2.0, df);
            expect(close(a + b, 1, 1e-3)).toBe(true);
        }
    });
    it('approximerar normalfördelningen vid stora df', () => {
        // df=10000 → praktiskt taget identisk med N(0,1)
        expect(close(tDistCdf(1.96, 10000), normalCdf(1.96), 1e-3)).toBe(true);
        expect(close(tDistCdf(-1.0, 10000), normalCdf(-1.0), 1e-3)).toBe(true);
    });
    it('ger bredare svansar än normalfördelningen vid små df', () => {
        // Vid t=1,96 och df=10 ska CDF vara LÄGRE än normalens 0,975
        // (eftersom t har tjockare svansar — mer sannolikhet i extremerna)
        const tProb = tDistCdf(1.96, 10);
        const nProb = normalCdf(1.96);  // ≈ 0,975
        expect(tProb).toBeLessThan(nProb);
        // Men inte orimligt mycket lägre — t(10) 0,975-tröskel är 2,228
        // så pt(1.96, 10) ≈ 0,961
        expect(tProb).toBeGreaterThan(0.95);
        expect(tProb).toBeLessThan(0.97);
    });
    it('matchar kända t-tabellsvärden inom ~0,005', () => {
        // R: pt(2.0, 20) = 0.9703, pt(2.5, 20) = 0.9893
        expect(close(tDistCdf(2.0, 20), 0.9703, 0.005)).toBe(true);
        expect(close(tDistCdf(2.5, 20), 0.9893, 0.005)).toBe(true);
        // R: pt(1.96, 50) = 0.9722
        expect(close(tDistCdf(1.96, 50), 0.9722, 0.005)).toBe(true);
    });
    it('returnerar NaN för ogiltig df', () => {
        expect(Number.isNaN(tDistCdf(1, 0))).toBe(true);
        expect(Number.isNaN(tDistCdf(1, -1))).toBe(true);
    });
});

describe('tQuantile', () => {
    it('matchar t-tabellens 0,975-kvantiler', () => {
        // Tabellvärden (R: qt(0.975, df))
        expect(tQuantile(0.975, 5)).toBeCloseTo(2.571, 3);
        expect(tQuantile(0.975, 10)).toBeCloseTo(2.228, 3);
        expect(tQuantile(0.975, 26)).toBeCloseTo(2.056, 3);
        expect(tQuantile(0.975, 60)).toBeCloseTo(2.000, 3);
    });
    it('faller tillbaka på normalfördelningens 1,96 vid df ≥ 100', () => {
        expect(tQuantile(0.975, 100)).toBeCloseTo(1.96, 3);
        expect(tQuantile(0.975, 5000)).toBeCloseTo(1.96, 3);
        expect(tQuantile(0.975, 99)).toBeGreaterThan(1.96);
    });
    it('inverterar tDistCdf och är symmetrisk', () => {
        for (const df of [3, 12, 40]) {
            const q = tQuantile(0.9, df);
            expect(tDistCdf(q, df)).toBeCloseTo(0.9, 6);
            expect(tQuantile(0.1, df)).toBeCloseTo(-q, 6);
        }
        expect(tQuantile(0.5, 7)).toBeCloseTo(0, 6);
    });
    it('returnerar NaN för ogiltiga argument', () => {
        expect(Number.isNaN(tQuantile(0, 5))).toBe(true);
        expect(Number.isNaN(tQuantile(1, 5))).toBe(true);
        expect(Number.isNaN(tQuantile(0.975, 0))).toBe(true);
    });
});

describe('pValue2Sided', () => {
    it('är 1 när teststatistikan är 0', () => {
        const p = pValue2Sided(0, 50, 3);
        expect(close(p, 1, 1e-3)).toBe(true);
    });
    it('är symmetriskt för positivt/negativt t', () => {
        const pPos = pValue2Sided(2.5, 30, 3);
        const pNeg = pValue2Sided(-2.5, 30, 3);
        expect(close(pPos, pNeg, 1e-9)).toBe(true);
    });
    it('ger högre p-värde med t-fördelning än normal vid små df', () => {
        // Liten df → t-fördelning → större p-värde än ren z-approximation
        const pSmall = pValue2Sided(1.96, 15, 3);  // df=12 → t
        const pLarge = pValue2Sided(1.96, 200, 3); // df=197 → normal
        expect(pSmall).toBeGreaterThan(pLarge);
    });
    it('växlar till normalfördelning vid df ≥ 100', () => {
        // df=100 ska använda normal, df=99 ska använda t
        const pNormal = pValue2Sided(2.0, 103, 3);
        const expected = 2 * (1 - normalCdf(2.0));
        expect(close(pNormal, expected, 1e-9)).toBe(true);
    });
    it('returnerar NaN för df ≤ 0', () => {
        expect(Number.isNaN(pValue2Sided(1, 3, 3))).toBe(true);
        expect(Number.isNaN(pValue2Sided(1, 2, 3))).toBe(true);
    });
});

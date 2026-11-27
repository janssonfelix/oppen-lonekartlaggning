/**
 * Vitest-tester för statistiska kärnfunktionerna i src/lib/stat.js.
 *
 * Körs med: npm test
 *
 * Täcker:
 *   - median / kvantil (kanttillstånd, jämn/udda längd, P10/P50/P90)
 *   - linjarRegression (perfekt linje, brusig data)
 *   - normalCdf (Φ vid kända punkter ±1σ ±2σ)
 *   - matrisprodukt / invertera (identitet, singulär)
 *   - anpassaOLS (kända koefficienter, HC3 vs klassisk vcov, n<k+2, exakt samma tal som fulla matrisprodukter)
 *   - bhJustera (Benjamini–Hochberg: ordning, m = 1, tom lista, lika p-värden, tak 1, monotonicitet)
 *   - avrundaSymmetriskt (visningens avrundning: halvorna bort från noll, ingen −0)
 */

import { describe, it, expect } from 'vitest';
import {
    median,
    kvantil,
    linjarRegression,
    normalCdf,
    tFordelningCdf,
    tKvantil,
    pVardeTvasidigt,
    avrundaSymmetriskt,
    matrisprodukt,
    invertera,
    anpassaOLS,
    bhJustera
} from '../src/lib/stat.js';
import { ickeTom } from './helpers/paastaende.js';

const close = (a, b, tol = 1e-9) => Math.abs(a - b) < tol;

describe('[B1.1] median', () => {
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

describe('[B1.2] kvantil', () => {
    const arr = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    it('q=0 → minimum', () => {
        expect(kvantil(arr, 0)).toBe(1);
    });
    it('q=1 → maximum', () => {
        expect(kvantil(arr, 1)).toBe(10);
    });
    it('q=0.5 → median', () => {
        expect(kvantil(arr, 0.5)).toBe(5.5);
    });
    it('linjär interpolation vid q=0.1', () => {
        // pos = 9 * 0.1 = 0.9 → mellan arr[0]=1 och arr[1]=2 → 1.9
        expect(close(kvantil(arr, 0.1), 1.9)).toBe(true);
    });
    it('linjär interpolation vid q=0.9', () => {
        // pos = 9 * 0.9 = 8.1 → mellan arr[8]=9 och arr[9]=10 → 9.1
        expect(close(kvantil(arr, 0.9), 9.1)).toBe(true);
    });
    it('returnerar 0 för tom array', () => {
        expect(kvantil([], 0.5)).toBe(0);
    });
});

describe('linjarRegression', () => {
    it('perfekt linje y = 2x + 1', () => {
        const data = [
            [0, 1],
            [1, 3],
            [2, 5],
            [3, 7],
            [4, 9]
        ];
        const r = linjarRegression(data);
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
        const r = linjarRegression(data);
        expect(close(r.m, 0)).toBe(true);
        expect(close(r.b, 5)).toBe(true);
        // ssTot = 0 → R² returneras som 0
        expect(r.r2).toBe(0);
    });
    it('null utan lutning att räkna: tom, en punkt, eller alla x lika', () => {
        expect(linjarRegression([])).toBeNull();
        expect(linjarRegression([[40, 30000]])).toBeNull();
        expect(linjarRegression([[40, 30000], [40, 32000], [40, 35000]])).toBeNull();
        expect(linjarRegression([[0.1, 1], [0.1, 2], [0.1, 3]])).toBeNull();
    });
});

describe('[B1.5] normalCdf', () => {
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

describe('matrisprodukt / invertera', () => {
    it('matrisprodukt: 2×3 · 3×2', () => {
        const A = [
            [1, 2, 3],
            [4, 5, 6]
        ];
        const B = [
            [7, 8],
            [9, 10],
            [11, 12]
        ];
        expect(matrisprodukt(A, B)).toEqual([
            [58, 64],
            [139, 154]
        ]);
    });
    it('invertera(I) = I', () => {
        const I = [
            [1, 0, 0],
            [0, 1, 0],
            [0, 0, 1]
        ];
        const inv = invertera(I);
        for (let i = 0; i < 3; i++) {
            for (let j = 0; j < 3; j++) {
                expect(close(inv[i][j], I[i][j])).toBe(true);
            }
        }
    });
    it('invertera · A = I', () => {
        const A = [
            [4, 7],
            [2, 6]
        ];
        const inv = invertera(A);
        const I = matrisprodukt(A, inv);
        expect(close(I[0][0], 1, 1e-9)).toBe(true);
        expect(close(I[0][1], 0, 1e-9)).toBe(true);
        expect(close(I[1][0], 0, 1e-9)).toBe(true);
        expect(close(I[1][1], 1, 1e-9)).toBe(true);
    });
    it('invertera returnerar null för singulär matris', () => {
        // Rad 2 = 2 · rad 1
        const sing = [
            [1, 2],
            [2, 4]
        ];
        expect(invertera(sing)).toBeNull();
    });
});

describe('[B1.3] anpassaOLS', () => {
    it('återskapar kända koefficienter på brusfri data: y = 3 + 2·x1 - 1·x2', () => {
        const X = [];
        const y = [];
        for (let i = 0; i < 50; i++) {
            const x1 = i;
            const x2 = (i * 7) % 11;
            X.push([1, x1, x2]);
            y.push(3 + 2 * x1 - 1 * x2);
        }
        const fit = anpassaOLS(X, y);
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
        expect(anpassaOLS(X, y)).toBeNull();
    });
    it('returnerar null när X singulär (perfekt kolinearitet)', () => {
        const X = [];
        const y = [];
        for (let i = 0; i < 30; i++) {
            X.push([1, i, 2 * i]); // kolumn 2 = 2 · kolumn 1 → singulär
            y.push(i + Math.random());
        }
        expect(anpassaOLS(X, y)).toBeNull();
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
        const fit = anpassaOLS(X, y);
        expect(fit).not.toBeNull();
        // Symmetri
        expect(close(fit.vcovHC3[0][1], fit.vcovHC3[1][0], 1e-12)).toBe(true);
        expect(close(fit.vcovClassic[0][1], fit.vcovClassic[1][0], 1e-12)).toBe(true);
        // Båda diagonalelement positiva
        expect(fit.vcovHC3[0][0]).toBeGreaterThan(0);
        expect(fit.vcovHC3[1][1]).toBeGreaterThan(0);
    });
    // B4: en observation som ensam bär en indikator har hävstång h = 1 och bidrar inte till HC3; antalet med h > 0,99
    // redovisas i regressionskortets tekniska specifikation.
    it('hHoga räknar observationer med hävstång > 0,99 (en singelindikator ger minst en)', () => {
        const X = [], y = [];
        for (let i = 0; i < 40; i++) { X.push([1, i % 7, i === 13 ? 1 : 0]); y.push(1 + 0.1 * (i % 7) + ((i * 37) % 11) / 100); }
        const fit = anpassaOLS(X, y);
        expect(fit.hHoga).toBeGreaterThanOrEqual(1);
        const utan = anpassaOLS(X.map(r => r.slice(0, 2)), y);
        expect(utan.hHoga).toBe(0);
    });

    // anpassaOLS summerar bara över de nollskilda kolumnerna i varje rad, i samma ordning som en full matrisprodukt.
    // Referensen är den tidigare algoritmen med fulla produkter; talen ska vara exakt desamma, inte bara nära.
    it('ger exakt samma tal som de fulla matrisprodukterna (indikatorer, ålder, en ensam person i en grupp)', () => {
        let seed = 7;
        const rand = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
        const X = [], y = [];
        for (let i = 0; i < 400; i++) {
            const bas = i === 17 ? 5 : i % 5;          // BAS-indikator 5 har bara en person
            const aid = (i * 7) % 6, kvinna = (i * 11) % 7 < 3 ? 1 : 0, alder = 22 + ((i * 13) % 43);
            const rad = [1, kvinna, alder, alder * alder / 100];
            for (let b = 1; b <= 5; b++) rad.push(bas === b ? 1 : 0);
            for (let a = 1; a < 6; a++) rad.push(aid === a ? 1 : 0);
            X.push(rad);
            y.push(Math.log(26000 + 900 * bas + 400 * aid + 60 * alder - 700 * kvinna + 3000 * rand()));
        }
        const hTillagg = X.map((_, i) => 1 / (2 + (i % 9)));
        for (const h of [null, hTillagg]) {
            const ny = anpassaOLS(X, y, h), ref = fitOLSFull(X, y, h);
            expect(ny).not.toBeNull();
            expect(ny.hHoga).toBe(ref.hHoga);
            expect(ny.hHoga).toBeGreaterThanOrEqual(1);
            for (const nyckel of Object.keys(ref)) {
                const a = [ny[nyckel]].flat(2), b = [ref[nyckel]].flat(2);
                expect(a.length, nyckel).toBe(b.length);
                a.forEach((v, i) => expect(v, `${nyckel}[${i}]`).toBe(b[i]));
            }
        }
    });
});

// Den tidigare anpassaOLS, med fulla matrisprodukter över alla kolumner: referensen för testet ovan.
function fitOLSFull(X, y, hTillagg = null) {
    const n = X.length, k = X[0].length;
    if (n < k + 2) return null;
    const Xt = X[0].map((_, i) => X.map(r => r[i]));
    const XtX = matrisprodukt(Xt, X);
    const XtXinv = invertera(XtX);
    if (!XtXinv) return null;
    const Xty = matrisprodukt(Xt, y.map(v => [v])).map(r => r[0]);
    const beta = matrisprodukt(XtXinv, Xty.map(v => [v])).map(r => r[0]);
    const yhat = X.map(row => row.reduce((s, v, i) => s + v * beta[i], 0));
    const resid = y.map((yi, i) => yi - yhat[i]);
    const ymean = y.reduce((s, v) => s + v, 0) / n;
    let rss = 0, tss = 0;
    for (let i = 0; i < n; i++) {
        rss += resid[i] * resid[i];
        tss += (y[i] - ymean) ** 2;
    }
    const R2 = tss > 0 ? 1 - rss / tss : 0;
    const sigma2 = n - k > 0 ? rss / (n - k) : 0;
    const vcovClassic = XtXinv.map(row => row.map(v => v * sigma2));
    const h = X.map((xi, i) => {
        let s = hTillagg ? hTillagg[i] : 0;
        for (let a = 0; a < k; a++) {
            let sa = 0;
            for (let b = 0; b < k; b++) sa += XtXinv[a][b] * xi[b];
            s += xi[a] * sa;
        }
        return s;
    });
    const hHoga = h.filter(hi => hi > 0.99).length;
    const meat = Array.from({ length: k }, () => new Array(k).fill(0));
    for (let i = 0; i < n; i++) {
        const denom = (1 - h[i]) ** 2;
        const w = denom > 1e-12 ? (resid[i] * resid[i]) / denom : 0;
        for (let a = 0; a < k; a++) {
            for (let b = 0; b < k; b++) {
                meat[a][b] += w * X[i][a] * X[i][b];
            }
        }
    }
    const breadMeat = matrisprodukt(XtXinv, meat);
    const vcovHC3 = matrisprodukt(breadMeat, XtXinv);
    const adjR2 = (n - k) > 0 ? 1 - (1 - R2) * (n - 1) / (n - k) : 0;
    return { beta, R2, n, k, vcovHC3, vcovClassic, rss, adjR2, sigma2, XtXinv, hHoga };
}

describe('[B1.4] tFordelningCdf', () => {
    // Kända t-fördelningsvärden från standardtabeller (R: pt(q, df))
    // df=1 (Cauchy): pt(0, 1) = 0.5; pt(1, 1) ≈ 0.75; pt(-1, 1) ≈ 0.25
    it('returnerar 0,5 vid t=0', () => {
        expect(close(tFordelningCdf(0, 10), 0.5, 1e-3)).toBe(true);
        expect(close(tFordelningCdf(0, 30), 0.5, 1e-3)).toBe(true);
    });
    it('är symmetrisk runt 0', () => {
        for (const df of [5, 20, 50]) {
            const a = tFordelningCdf(2.0, df);
            const b = tFordelningCdf(-2.0, df);
            expect(close(a + b, 1, 1e-3)).toBe(true);
        }
    });
    it('approximerar normalfördelningen vid stora df', () => {
        // df=10000 → praktiskt taget identisk med N(0,1)
        expect(close(tFordelningCdf(1.96, 10000), normalCdf(1.96), 1e-3)).toBe(true);
        expect(close(tFordelningCdf(-1.0, 10000), normalCdf(-1.0), 1e-3)).toBe(true);
    });
    it('ger bredare svansar än normalfördelningen vid små df', () => {
        // Vid t=1,96 och df=10 ska CDF vara LÄGRE än normalens 0,975
        // (eftersom t har tjockare svansar — mer sannolikhet i extremerna)
        const tProb = tFordelningCdf(1.96, 10);
        const nProb = normalCdf(1.96);  // ≈ 0,975
        expect(tProb).toBeLessThan(nProb);
        // Men inte orimligt mycket lägre — t(10) 0,975-tröskel är 2,228
        // så pt(1.96, 10) ≈ 0,961
        expect(tProb).toBeGreaterThan(0.95);
        expect(tProb).toBeLessThan(0.97);
    });
    it('matchar kända t-tabellsvärden inom ~0,005', () => {
        // R: pt(2.0, 20) = 0.9703, pt(2.5, 20) = 0.9893
        expect(close(tFordelningCdf(2.0, 20), 0.9703, 0.005)).toBe(true);
        expect(close(tFordelningCdf(2.5, 20), 0.9893, 0.005)).toBe(true);
        // R: pt(1.96, 50) = 0.9722
        expect(close(tFordelningCdf(1.96, 50), 0.9722, 0.005)).toBe(true);
    });
    it('returnerar NaN för ogiltig df', () => {
        expect(Number.isNaN(tFordelningCdf(1, 0))).toBe(true);
        expect(Number.isNaN(tFordelningCdf(1, -1))).toBe(true);
    });
});

describe('tKvantil', () => {
    it('matchar t-tabellens 0,975-kvantiler', () => {
        // Tabellvärden (R: qt(0.975, df))
        expect(tKvantil(0.975, 5)).toBeCloseTo(2.571, 3);
        expect(tKvantil(0.975, 10)).toBeCloseTo(2.228, 3);
        expect(tKvantil(0.975, 26)).toBeCloseTo(2.056, 3);
        expect(tKvantil(0.975, 60)).toBeCloseTo(2.000, 3);
    });
    it('är t-fördelningens också vid df ≥ 100 (ADR-105)', () => {
        // R: qt(0.975, df)
        expect(tKvantil(0.975, 100)).toBeCloseTo(1.983972, 5);
        expect(tKvantil(0.975, 200)).toBeCloseTo(1.971896, 5);
        expect(tKvantil(0.975, 1000)).toBeCloseTo(1.962339, 5);
        expect(tKvantil(0.975, 10000)).toBeCloseTo(1.960201, 5);
    });
    it('inverterar tFordelningCdf och är symmetrisk', () => {
        for (const df of [3, 12, 40]) {
            const q = tKvantil(0.9, df);
            expect(tFordelningCdf(q, df)).toBeCloseTo(0.9, 6);
            expect(tKvantil(0.1, df)).toBeCloseTo(-q, 6);
        }
        expect(tKvantil(0.5, 7)).toBeCloseTo(0, 6);
    });
    it('returnerar NaN för ogiltiga argument', () => {
        expect(Number.isNaN(tKvantil(0, 5))).toBe(true);
        expect(Number.isNaN(tKvantil(1, 5))).toBe(true);
        expect(Number.isNaN(tKvantil(0.975, 0))).toBe(true);
    });
});

describe('pVardeTvasidigt', () => {
    it('är 1 när teststatistikan är 0', () => {
        const p = pVardeTvasidigt(0, 50, 3);
        expect(close(p, 1, 1e-3)).toBe(true);
    });
    it('är symmetriskt för positivt/negativt t', () => {
        const pPos = pVardeTvasidigt(2.5, 30, 3);
        const pNeg = pVardeTvasidigt(-2.5, 30, 3);
        expect(close(pPos, pNeg, 1e-9)).toBe(true);
    });
    it('ger högre p-värde med t-fördelning än normal vid små df', () => {
        // Liten df → t-fördelning → större p-värde än ren z-approximation
        const pSmall = pVardeTvasidigt(1.96, 15, 3);  // df=12 → t
        const pLarge = pVardeTvasidigt(1.96, 200, 3); // df=197
        expect(pSmall).toBeGreaterThan(pLarge);
    });
    it('använder t-fördelningen också vid df ≥ 100 (ADR-105)', () => {
        // df = 100: R 2 * pt(-2, 100) = 0,048212; normalfördelningen ger 0,045500
        expect(pVardeTvasidigt(2.0, 103, 3)).toBeCloseTo(2 * (1 - tFordelningCdf(2.0, 100)), 12);
        expect(pVardeTvasidigt(2.0, 103, 3)).toBeCloseTo(0.048212, 5);
        expect(pVardeTvasidigt(2.0, 103, 3)).toBeGreaterThan(2 * (1 - normalCdf(2.0)));
    });
    it('returnerar NaN för df ≤ 0', () => {
        expect(Number.isNaN(pVardeTvasidigt(1, 3, 3))).toBe(true);
        expect(Number.isNaN(pVardeTvasidigt(1, 2, 3))).toBe(true);
    });
});

describe('[B1.6] bhJustera', () => {
    // Handräknat (m = 4): sorterat 0,005 · 0,01 · 0,03 · 0,04 ger p·m/rang = 0,02 · 0,02 · 0,04 · 0,04, redan monotont.
    it('ger q i indatans ordning', () => {
        const q = bhJustera([0.01, 0.04, 0.03, 0.005]);
        [0.02, 0.04, 0.04, 0.02].forEach((v, i) => expect(q[i]).toBeCloseTo(v, 15));
    });
    it('ger p oförändrat för ett enda test och en tom lista för inga', () => {
        expect(bhJustera([0.03])).toEqual([0.03]);
        expect(bhJustera([])).toEqual([]);
    });
    it('ger lika q för lika p-värden', () => {
        const q = bhJustera([0.03, 0.2, 0.03, 0.03]);
        expect(q[0]).toBe(q[2]);
        expect(q[0]).toBe(q[3]);
    });
    // Handräknat (m = 6): sorterat 0 · 0,01 · 0,04 · 0,04 · 0,5 · 1 ger p·m/rang = 0 · 0,03 · 0,08 · 0,06 · 0,6 · 1;
    // bakifrån blir rang 3 min(0,08; 0,06) = 0,06.
    it('gör q monotont bakifrån, med p = 0 och p = 1', () => {
        const q = bhJustera([1, 0.04, 0, 0.5, 0.01, 0.04]);
        [1, 0.06, 0, 0.6, 0.03, 0.06].forEach((v, i) => expect(q[i]).toBeCloseTo(v, 15));
    });
    it('ger inget q över 1 och inget q under p', () => {
        const p = [0.9, 0.95, 0.99, 0.2, 0.6, 0.8, 1];
        const q = bhJustera(p);
        ickeTom(q).forEach((v, i) => { expect(v).toBeLessThanOrEqual(1); expect(v).toBeGreaterThanOrEqual(p[i]); });
        // q ordnat som p
        const ord = p.map((v, i) => i).sort((a, b) => p[a] - p[b]);
        for (let i = 1; i < ord.length; i++) expect(q[ord[i]]).toBeGreaterThanOrEqual(q[ord[i - 1]]);
    });
    it('ändrar inte indatan', () => {
        const p = [0.04, 0.01];
        bhJustera(p);
        expect(p).toEqual([0.04, 0.01]);
    });
});

describe('median och kvantil: kanttillstånd', () => {
    it('median: ett värde är medianen', () => {
        expect(median([7])).toBe(7);
    });
    it('median: två värden ger snittet, oavsett ordning', () => {
        expect(median([9, 2])).toBe(5.5);
        expect(median([2, 9])).toBe(5.5);
    });
    it('kvantil: tom lista ger 0 även för q = 0 och q = 1', () => {
        expect(kvantil([], 0)).toBe(0);
        expect(kvantil([], 1)).toBe(0);
    });
    it('kvantil: ett värde ger det värdet för alla q', () => {
        expect(kvantil([7], 0)).toBe(7);
        expect(kvantil([7], 0.5)).toBe(7);
        expect(kvantil([7], 1)).toBe(7);
    });
    it('kvantil: två värden interpoleras linjärt (q = 0 → minst, q = 1 → störst, q = 0,25 → 3,5)', () => {
        expect(kvantil([8, 2], 0)).toBe(2);
        expect(kvantil([8, 2], 1)).toBe(8);
        expect(kvantil([8, 2], 0.5)).toBe(5);
        expect(kvantil([8, 2], 0.25)).toBe(3.5);
    });
    it('kvantil vid q = 0 och q = 1 på osorterad lista ger min och max', () => {
        expect(kvantil([5, 1, 4], 0)).toBe(1);
        expect(kvantil([5, 1, 4], 1)).toBe(5);
    });
});

describe('avrundaSymmetriskt', () => {
    it('halvorna avrundas bort från noll, så att ett tal och dess motsatta tal får samma siffror', () => {
        expect(avrundaSymmetriskt(1600.5)).toBe(1601);
        expect(avrundaSymmetriskt(-1600.5)).toBe(-1601);
        expect(avrundaSymmetriskt(-4.25, 1)).toBe(-4.3);
        expect(avrundaSymmetriskt(4.25, 1)).toBe(4.3);
        for (const [x, dec] of [[0.5, 0], [2.5, 0], [0.25, 1], [12.75, 1], [0.125, 2]]) expect(avrundaSymmetriskt(-x, dec)).toBe(-avrundaSymmetriskt(x, dec));
    });
    it('utanför halvorna som Math.round, och noll blir 0, aldrig −0', () => {
        for (const x of [1600.49, 1600.51, -1600.49, -1600.51, 7, -7]) expect(avrundaSymmetriskt(x)).toBe(Math.round(x));
        expect(Object.is(avrundaSymmetriskt(-0.4), 0)).toBe(true);
        expect(Object.is(avrundaSymmetriskt(-0.04, 1), 0)).toBe(true);
        expect(Object.is(avrundaSymmetriskt(-0), 0)).toBe(true);
    });
});

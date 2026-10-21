// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
/**
 * Öppen lönekartläggning — Pure statistical kernel
 *
 * Denna modul är ENDA KÄLLAN (single source of truth) för den matematiska
 * kärnan och kan testas via Vitest utan att ladda DOM/CSP. Webbläsarbygget
 * (app.js) får en AUTO-GENERERAD spegel av modulen i src/app/09-lib-speglar.js
 * (tools/gen-mirrors.mjs inlinar verbatim). Ändra därför ALDRIG spegeln — ändra
 * här och kör `npm run build:app`. tests/stat.test.js verifierar de numeriska
 * resultaten; tests/drift.test.js vaktar att spegeln är i synk med src/lib/.
 *
 * Funktioner exporterade:
 *   - median, quantile, linearRegression  (Stat-objektet i app.js)
 *   - matMul, transpose, invert            (matrisalgebra)
 *   - fitOLS                                (OLS + HC3-robusta SE)
 *   - normalCdf                             (Φ för p-värden)
 */

/**
 * Beräknar median (P50) av en talsekvens.
 * @param {number[]} arr
 * @returns {number} 0 om tom, annars mittenelementet i sorterad lista.
 */
export function median(arr) {
    if (!arr.length) return 0;
    const s = [...arr].sort((a, b) => a - b);
    const m = Math.floor(s.length / 2);
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/**
 * Kvantil via linjär interpolation (typ 7, samma som R's default).
 * @param {number[]} arr
 * @param {number} q ∈ [0,1]
 * @returns {number}
 */
export function quantile(arr, q) {
    if (!arr.length) return 0;
    const s = [...arr].sort((a, b) => a - b);
    const pos = (s.length - 1) * q;
    const lo = Math.floor(pos);
    const hi = Math.ceil(pos);
    return lo === hi ? s[lo] : s[lo] + (s[hi] - s[lo]) * (pos - lo);
}

/**
 * Enkel linjär regression y = m·x + b via OLS minsta kvadrat.
 * @param {Array<[number, number]>} data
 * @returns {{m:number, b:number, r2:number}}
 */
export function linearRegression(data) {
    const n = data.length;
    if (n === 0) return { m: 0, b: 0, r2: 0 };
    let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
    for (let i = 0; i < n; i++) {
        sumX += data[i][0]; sumY += data[i][1];
        sumXY += data[i][0] * data[i][1]; sumXX += data[i][0] * data[i][0];
    }
    const m = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const b = (sumY - m * sumX) / n;
    const meanY = sumY / n;
    let ssTot = 0, ssRes = 0;
    for (let i = 0; i < n; i++) {
        ssTot += (data[i][1] - meanY) ** 2;
        ssRes += (data[i][1] - (m * data[i][0] + b)) ** 2;
    }
    return { m, b, r2: ssTot > 0 ? 1 - ssRes / ssTot : 0 };
}

/**
 * Standardnormal CDF Φ(x) — Abramowitz & Stegun 26.2.17 (abs.fel < 7.5e-8).
 * @param {number} x
 * @returns {number}
 */
export function normalCdf(x) {
    const t = 1 / (1 + 0.2316419 * Math.abs(x));
    const d = 0.3989423 * Math.exp((-x * x) / 2);
    const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
    return x > 0 ? 1 - p : p;
}

/** ln Γ(x) (Lanczos, g = 7, 9 koefficienter; relativt fel < 1e-13 för x > 0). */
function _lnGamma(x) {
    const c = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313,
        -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
    if (x < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * x)) - _lnGamma(1 - x);
    x -= 1;
    let a = c[0];
    const t = x + 7.5;
    for (let i = 1; i < 9; i++) a += c[i] / (x + i);
    return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a);
}

/**
 * Regulariserad ofullständig betafunktion I_x(a, b) via Lentz kedjebråk
 * (Numerical Recipes, betacf). Konvergerar snabbt för x < (a+1)/(a+b+2);
 * annars används symmetrin I_x(a,b) = 1 − I_{1−x}(b,a).
 */
function _regIncBeta(x, a, b) {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    if (x > (a + 1) / (a + b + 2)) return 1 - _regIncBeta(1 - x, b, a);
    const lnFront = _lnGamma(a + b) - _lnGamma(a) - _lnGamma(b) + a * Math.log(x) + b * Math.log(1 - x);
    const tiny = 1e-300;
    let c = 1, d = 1 - (a + b) * x / (a + 1);
    if (Math.abs(d) < tiny) d = tiny;
    d = 1 / d;
    let h = d;
    for (let m = 1; m <= 300; m++) {
        const m2 = 2 * m;
        let aa = m * (b - m) * x / ((a + m2 - 1) * (a + m2));
        d = 1 + aa * d; if (Math.abs(d) < tiny) d = tiny;
        c = 1 + aa / c; if (Math.abs(c) < tiny) c = tiny;
        d = 1 / d; h *= d * c;
        aa = -(a + m) * (a + b + m) * x / ((a + m2) * (a + m2 + 1));
        d = 1 + aa * d; if (Math.abs(d) < tiny) d = tiny;
        c = 1 + aa / c; if (Math.abs(c) < tiny) c = tiny;
        d = 1 / d;
        const del = d * c;
        h *= del;
        if (Math.abs(del - 1) < 3e-14) break;
    }
    return Math.exp(lnFront) * h / a;
}

/**
 * t-fördelningens CDF P(T ≤ t | df), exakt via den regulariserade ofullständiga
 * betafunktionen: P(|T| > t) = I_x(df/2, 1/2) med x = df / (df + t²).
 * Konvergerar mot normalfördelningen när df → ∞. (Tidigare Hills approximation,
 * som vid df = 5 gav kvantilen 2,62 i stället för 2,57; ADR-45.)
 * @param {number} t  - teststatistika
 * @param {number} df - frihetsgrader (n − k)
 * @returns {number} P(T ≤ t)
 */
export function tDistCdf(t, df) {
    if (!isFinite(t) || !(df > 0)) return NaN;
    if (df > 1e6) return normalCdf(t);
    const x = df / (df + t * t);
    const twoSided = _regIncBeta(x, df / 2, 0.5);   // P(|T| > |t|)
    return t >= 0 ? 1 - twoSided / 2 : twoSided / 2;
}

/**
 * t-fördelningens kvantil: det t för vilket P(T ≤ t | df) = p. Används för
 * konfidensintervall (p = 0,975 ger halvbredden för 95 %). Inverterar tDistCdf
 * med bisektion; vid df ≥ 100 används normalfördelningen (1,96 för 95 %), samma
 * gräns som pValue2Sided.
 * @param {number} p  - sannolikhet i (0, 1)
 * @param {number} df - frihetsgrader (n − k)
 * @returns {number} kvantilen, NaN vid ogiltiga argument
 */
export function tQuantile(p, df) {
    if (!(p > 0 && p < 1) || !(df > 0)) return NaN;
    const cdf = df >= 100 ? normalCdf : t => tDistCdf(t, df);
    let lo = -1, hi = 1;
    while (cdf(lo) > p) lo *= 2;
    while (cdf(hi) < p) hi *= 2;
    for (let i = 0; i < 100 && hi - lo > 1e-9; i++) {
        const mid = (lo + hi) / 2;
        if (cdf(mid) < p) lo = mid; else hi = mid;
    }
    return (lo + hi) / 2;
}

/**
 * Tvåsidigt p-värde för en regressionskoefficient. Använder t-fördelning
 * vid små df (< 100), annars normalfördelning.
 * @param {number} stat - β / SE
 * @param {number} n    - antal observationer
 * @param {number} k    - antal regressorer
 * @returns {number} 2-sidigt p-värde
 */
export function pValue2Sided(stat, n, k) {
    const df = n - k;
    if (!isFinite(stat) || !(df > 0)) return NaN;
    const absT = Math.abs(stat);
    if (df >= 100) return 2 * (1 - normalCdf(absT));
    return 2 * (1 - tDistCdf(absT, df));
}

/** Matrisprodukt C = A·B. */
export function matMul(A, B) {
    const m = A.length, n = B[0].length, p = B.length;
    const C = Array.from({ length: m }, () => new Array(n).fill(0));
    for (let i = 0; i < m; i++) {
        for (let k = 0; k < p; k++) {
            const a = A[i][k];
            if (a === 0) continue;
            for (let j = 0; j < n; j++) C[i][j] += a * B[k][j];
        }
    }
    return C;
}

/** Transpose Aᵀ. */
export function transpose(A) {
    return A[0].map((_, i) => A.map(r => r[i]));
}

/**
 * Matrisinvers via Gauss-Jordan med partial pivoting.
 * @param {number[][]} A
 * @returns {number[][]|null} null om singulär (pivotelement < 1e-10).
 */
export function invert(A) {
    const n = A.length;
    const M = A.map((r, i) => [...r, ...Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))]);
    for (let i = 0; i < n; i++) {
        let max = Math.abs(M[i][i]), mr = i;
        for (let k = i + 1; k < n; k++) if (Math.abs(M[k][i]) > max) { max = Math.abs(M[k][i]); mr = k; }
        if (max < 1e-10) return null;
        if (mr !== i) [M[i], M[mr]] = [M[mr], M[i]];
        const piv = M[i][i];
        for (let j = 0; j < 2 * n; j++) M[i][j] /= piv;
        for (let k = 0; k < n; k++) {
            if (k === i) continue;
            const f = M[k][i];
            if (f === 0) continue;
            for (let j = 0; j < 2 * n; j++) M[k][j] -= f * M[i][j];
        }
    }
    return M.map(r => r.slice(n));
}

/**
 * OLS-estimat med klassisk + HC3-robusta vcov (Long & Ervin 2000).
 *
 * Returnerar identiskt fältnamn-gränssnitt som app.js _fitOLS:
 *   { beta, R2, n, k, vcovHC3, vcovClassic, rss, adjR2, sigma2, XtXinv }
 * Detta är "single source of truth" — app.js mirrar denna implementation.
 *
 * @param {number[][]} X - n×k designmatris.
 * @param {number[]} y    - n-vektor.
 * @returns {null | {beta:number[], R2:number, n:number, k:number, vcovHC3:number[][], vcovClassic:number[][], rss:number, adjR2:number, sigma2:number, XtXinv:number[][]}}
 */
export function fitOLS(X, y) {
    const n = X.length, k = X[0].length;
    if (n < k + 2) return null;
    const Xt = transpose(X);
    const XtX = matMul(Xt, X);
    const XtXinv = invert(XtX);
    if (!XtXinv) return null;
    const Xty = matMul(Xt, y.map(v => [v])).map(r => r[0]);
    const beta = matMul(XtXinv, Xty.map(v => [v])).map(r => r[0]);

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

    // HC3: leverages h_i = x_i' (X'X)^-1 x_i
    const h = X.map(xi => {
        let s = 0;
        for (let a = 0; a < k; a++) {
            let sa = 0;
            for (let b = 0; b < k; b++) sa += XtXinv[a][b] * xi[b];
            s += xi[a] * sa;
        }
        return s;
    });
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
    const breadMeat = matMul(XtXinv, meat);
    const vcovHC3 = matMul(breadMeat, XtXinv);
    const adjR2 = (n - k) > 0 ? 1 - (1 - R2) * (n - 1) / (n - k) : 0;

    return { beta, R2, n, k, vcovHC3, vcovClassic, rss, adjR2, sigma2, XtXinv };
}

// ====================================================================
// AUTO-GENERERAD FIL — RÖR INTE.
//
// Speglar de rena kärnmodulerna i src/lib/ (stat, forecast, structure, rng,
// likvardighet, lonepolitik, falt, urval, utforska, chartdata)
// för webbläsarbygget. Varje modul inlinas verbatim i en IIFE (endast
// `export` strippas) och de namn app.js anropar exponeras som const-alias.
// src/lib/ är enda källa — ändra där och kör `npm run build:app` (eller
// npm run bundle). Genererad av tools/gen-mirrors.mjs; vaktas av
// tests/drift.test.js.
// ====================================================================
/* eslint-disable */
// ---- speglar src/lib/stat.js ----
const __mirrorStat = (() => {
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
function median(arr) {
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
function quantile(arr, q) {
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
function linearRegression(data) {
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
function normalCdf(x) {
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
function tDistCdf(t, df) {
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
function tQuantile(p, df) {
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
function pValue2Sided(stat, n, k) {
    const df = n - k;
    if (!isFinite(stat) || !(df > 0)) return NaN;
    const absT = Math.abs(stat);
    if (df >= 100) return 2 * (1 - normalCdf(absT));
    return 2 * (1 - tDistCdf(absT, df));
}

/** Matrisprodukt C = A·B. */
function matMul(A, B) {
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
function transpose(A) {
    return A[0].map((_, i) => A.map(r => r[i]));
}

/**
 * Matrisinvers via Gauss-Jordan med partial pivoting.
 * @param {number[][]} A
 * @returns {number[][]|null} null om singulär (pivotelement < 1e-10).
 */
function invert(A) {
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
function fitOLS(X, y) {
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

    return { tQuantile, pValue2Sided, fitOLS, quantile, matMul, invert, median };
})();
const _tQuantile = __mirrorStat.tQuantile;
const _pValue2Sided = __mirrorStat.pValue2Sided;
const _fitOLS = __mirrorStat.fitOLS;
const _libQuantile = __mirrorStat.quantile;

// ---- speglar src/lib/loneoversyn.js ----
const __mirrorForecast = (() => {
// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
/**
 * Öppen lönekartläggning — Pure löneöversyns-/prognosfunktioner
 *
 * Budget-först-modell: en pott (kr eller % av lönesumman) fördelas GENERELLT
 * (till alla) + RIKTAT (till valda BAS→AID-grupper), och utfallet (nya löner,
 * budgetutnyttjande, råa lönegapet före/efter) beräknas.
 *
 * Separat från app.js för att kunna testas via Vitest utan DOM/state.
 * app.js får en AUTO-GENERERAD spegel (`_fc*` i src/app/09-lib-speglar.js via
 * tools/gen-mirrors.mjs) — ändra här och kör `npm run build:app`, rör ej spegeln
 * (vaktas av tests/drift.test.js). Det oförklarade gapet (OLS) beräknas INTE
 * här — det körs i app.js mot simulerad data via data-swap, eftersom det kräver
 * regressionsmotorn. Här beräknas bara det rena (median-baserade) gapet.
 *
 * All matematik sker på ursprungslönerna: generellt och riktat summeras additivt
 * per individ, så fördelningen är ordningsoberoende och transparent.
 */

function _median(arr) {
    if (!arr || !arr.length) return 0;
    const s = arr.slice().sort((a, b) => a - b);
    const m = s.length >> 1;
    return (s.length & 1) ? s[m] : (s[m - 1] + s[m]) / 2;
}

function _quantile(arr, q) {
    if (!arr || !arr.length) return 0;
    const s = arr.slice().sort((a, b) => a - b);
    const pos = (s.length - 1) * q;
    const lo = Math.floor(pos), hi = Math.ceil(pos);
    return lo === hi ? s[lo] : s[lo] + (s[hi] - s[lo]) * (pos - lo);
}

/**
 * "Water-filling": höj de lägst betalda först. Hittar en gemensam nivå L (≤ cap)
 * och lyfter alla under L upp till L så långt potten räcker. Pengar som inte
 * får plats under cap lämnas oanvända (returneras implicit via summan av deltan).
 * @returns {number[]} delta per individ (samma ordning som lons)
 */
function _waterLevelDeltas(lons, pott, cap) {
    const n = lons.length;
    if (!n || pott <= 0) return new Array(n).fill(0);
    const c = (cap == null) ? Infinity : cap;
    const sorted = lons.slice().sort((a, b) => a - b);
    let L = sorted[0], used = 0;
    if (c <= L) return new Array(n).fill(0);   // taket ligger under lägsta lönen
    for (let i = 1; i <= n; i++) {
        const nextBreak = i < n ? sorted[i] : Infinity;
        const ceiling = Math.min(nextBreak, c);
        const k = i;                            // antal individer på/under L
        const seg = k * (ceiling - L);
        if (used + seg >= pott) { L += (pott - used) / k; used = pott; break; }
        used += seg; L = ceiling;
        if (c !== Infinity && L >= c) { L = c; break; }
    }
    return lons.map(x => (x < L ? L - x : 0));
}

/** Total månadslönesumma. */
function totalLonSum(rows) {
    return (rows || []).reduce((s, r) => s + (r.lon > 0 ? r.lon : 0), 0);
}

/**
 * Potten i kr/månad utifrån budgeten.
 * @param {Array} rows
 * @param {{mode:string, value:number|null}} budget
 */
function computePott(rows, budget) {
    if (!budget || budget.value == null || !isFinite(budget.value)) return 0;
    if (budget.mode === 'kr') return Math.max(0, budget.value);
    return Math.max(0, totalLonSum(rows) * budget.value / 100);  // % av lönesumman
}

/**
 * Det råa (median-baserade) lönegapet kvinnor vs män, i procent.
 * @param {Array} rows
 * @param {(r:Object)=>number} getLon - väljer lönefältet (lon eller nyLon)
 * @returns {number|null}
 */
function rawGenderGap(rows, getLon) {
    const kv = [], ma = [];
    (rows || []).forEach(r => {
        const L = getLon(r);
        if (!(L > 0)) return;
        if (r.kon && r.kon.includes('kvinna')) kv.push(L);
        else if (r.kon === 'man' || r.kon === 'män') ma.push(L);
    });
    if (!kv.length || !ma.length) return null;
    return (_median(kv) / _median(ma) - 1) * 100;
}

/**
 * Raderna en riktad pott gäller: gruppen (BAS, eller BAS och AID), begränsad till ett kön (`kon`:
 * 'kvinna' | 'man', annars alla) och till löner under en gräns (`lonCap`, kr/mån, annars alla).
 * Samma urval som allocate() räknar på, så att gränssnittet kan visa hur många raden berör.
 * @param {Array} rows - individrader {bas, aid, kon, lon}
 * @param {{bas:string, aid:string, kon?:string, lonCap?:number|null}} t
 * @returns {number[]} index i rows
 */
function targetRows(rows, t) {
    const kon = t.kon === 'kvinna' || t.kon === 'man' ? t.kon : 'alla';
    const cap = t.lonCap != null && isFinite(t.lonCap) && t.lonCap > 0 ? t.lonCap : null;
    const konOk = r => kon === 'alla' || (kon === 'kvinna' ? String(r.kon || '').includes('kvinna') : (r.kon === 'man' || r.kon === 'män'));
    const ut = [];
    (rows || []).forEach((r, i) => {
        if (r.bas !== t.bas) return;
        if (t.aid !== '*' && r.aid !== t.aid) return;
        if (!konOk(r) || (cap != null && !(r.lon < cap))) return;
        ut.push(i);
    });
    return ut;
}

/**
 * Fördelar generellt + riktat påslag och returnerar nya löner per individ,
 * sammanställning per grupp och totaler.
 * @param {Array} rows - individrader {bas, aid, kon, lon}
 * @param {{mode:string, value:number|null}} generell - generellt påslag till alla (value null = 0)
 * @param {Array<{bas,aid,mode:'pct'|'kr'|'till',value,dist:'flat'|'lowest'|'target',targetLevel?:'median'|'p25',kon?:string,lonCap?:number|null}>} targets
 *   mode 'till' lyfter var och en i urvalet som ligger under beloppet upp till det (ingen pott att fördela).
 * @param {number} [roundStep=0] - avrunda nya löner till närmaste steg (kr), 0 = ingen avrundning
 */
function allocate(rows, generell, targets, roundStep) {
    const n = (rows || []).length;
    const genDeltas = new Array(n).fill(0);
    const g = generell || { mode: 'pct', value: 0 };
    const gVal = g.value != null && isFinite(g.value) ? g.value : 0;
    for (let i = 0; i < n; i++) {
        if (rows[i].lon <= 0) continue;
        genDeltas[i] = g.mode === 'kr' ? gVal : rows[i].lon * gVal / 100;
    }

    const tgtDeltas = new Array(n).fill(0);
    (targets || []).forEach(t => {
        // aid === '*' → hela BAS-intervallet (alla yrken i BAS:et); kön och lönegräns snävar in raden.
        const idxs = targetRows(rows, t);
        if (!idxs.length) return;
        const lons = idxs.map(i => rows[i].lon);
        if (t.mode === 'till') {
            const mal = isFinite(t.value) ? t.value : 0;
            idxs.forEach((i, j) => { if (lons[j] > 0 && lons[j] < mal) tgtDeltas[i] += mal - lons[j]; });
            return;
        }
        const groupSum = lons.reduce((s, x) => s + (x > 0 ? x : 0), 0);
        const pott = t.mode === 'kr' ? (isFinite(t.value) ? t.value : 0)
                                     : groupSum * (isFinite(t.value) ? t.value : 0) / 100;
        if (pott <= 0 || groupSum <= 0) return;
        let gd;
        if (t.dist === 'flat') {
            const frac = pott / groupSum;
            gd = lons.map(x => (x > 0 ? x * frac : 0));
        } else {
            const cap = t.dist === 'target'
                ? (t.targetLevel === 'p25' ? _quantile(lons, 0.25) : _median(lons))
                : Infinity;
            gd = _waterLevelDeltas(lons, pott, cap);
        }
        idxs.forEach((i, j) => { tgtDeltas[i] += gd[j]; });
    });

    // Avrundning till lönetrappa: bara för individer som faktiskt får påslag
    // (delta > 0), och aldrig under ursprungslönen.
    const step = (roundStep && roundStep > 0) ? roundStep : 0;
    const perPerson = rows.map((r, i) => {
        let delta = genDeltas[i] + tgtDeltas[i];
        if (step > 0 && delta > 0) {
            const rounded = Math.round((r.lon + delta) / step) * step;
            delta = Math.max(0, rounded - r.lon);
        }
        return { bas: r.bas, aid: r.aid, kon: r.kon, lon: r.lon, nyLon: r.lon + delta, delta };
    });

    // Sammanställning per grupp
    const groups = new Map();
    perPerson.forEach(p => {
        const k = p.bas + '|' + p.aid;
        let gr = groups.get(k);
        if (!gr) { gr = { bas: p.bas, aid: p.aid, oldL: [], newL: [], kvN: 0, n: 0, cost: 0 }; groups.set(k, gr); }
        gr.oldL.push(p.lon); gr.newL.push(p.nyLon);
        gr.cost += p.delta; gr.n++;
        if (p.kon && p.kon.includes('kvinna')) gr.kvN++;
    });
    const perGroup = [...groups.values()].map(gr => ({
        bas: gr.bas, aid: gr.aid, n: gr.n, kvN: gr.kvN,
        andelKv: gr.n ? 100 * gr.kvN / gr.n : 0,
        gammalMedian: _median(gr.oldL), nyMedian: _median(gr.newL),
        kostnad: gr.cost
    }));

    // generell/riktad-split speglar avsikten (oavrundat); totalRaise speglar
    // det faktiska, ev. avrundade, utfallet (summan av perPerson-deltan).
    const generellCost = genDeltas.reduce((s, x) => s + x, 0);
    const riktadCost = tgtDeltas.reduce((s, x) => s + x, 0);
    const totalRaise = perPerson.reduce((s, p) => s + p.delta, 0);
    return { perPerson, perGroup, totals: { generellCost, riktadCost, totalRaise } };
}

/**
 * Föreslår en riktad fördelning som minskar de osakliga gapen först. Fördelar
 * riktadPott proportionellt mot påverkansindex (gapKr × n), kapat vid kostnaden
 * att helt stänga respektive grupps gap.
 * @param {Array<{bas,aid,gapKr:number,n:number}>} candidates - gapKr > 0 = under referens (kr/mån/person)
 * @param {number} riktadPott
 * @param {number} [minN=0] - rikta endast mot grupper med minst minN personer
 */
function suggestTargets(candidates, riktadPott, minN = 0) {
    const valid = (candidates || []).filter(c => c.gapKr > 0 && c.n > 0 && c.n >= (minN || 0));
    if (!valid.length || riktadPott <= 0) return [];
    const totalIndex = valid.reduce((s, c) => s + c.gapKr * c.n, 0);
    if (totalIndex <= 0) return [];
    return valid.map(c => {
        const share = (c.gapKr * c.n) / totalIndex;
        const want = c.gapKr * c.n;                  // kostnad att helt stänga (kr/mån)
        const alloc = Math.min(want, riktadPott * share);
        return { bas: c.bas, aid: c.aid, mode: 'kr', value: Math.round(alloc), dist: 'lowest' };
    }).filter(t => t.value > 0);
}

/**
 * Mål-läge: bygg riktade rader som stänger en andel (fraction) av de osakliga
 * gapen. Kostnaden för att helt stänga en grupps gap är gapKr × n; för andelen
 * f blir det f × gapKr × n. Fördelas lägst-först inom gruppen.
 * @param {Array<{bas,aid,gapKr:number,n:number}>} candidates
 * @param {number} fraction - 0..1
 * @param {number} [minN=0]
 */
function closureTargets(candidates, fraction, minN = 0) {
    const f = Math.max(0, Math.min(1, fraction));
    if (f <= 0) return [];
    return (candidates || [])
        .filter(c => c.gapKr > 0 && c.n > 0 && c.n >= (minN || 0))
        .map(c => ({ bas: c.bas, aid: c.aid, mode: /** @type {'kr'} */ ('kr'), value: Math.round(f * c.gapKr * c.n), dist: /** @type {'lowest'} */ ('lowest') }))
        .filter(t => t.value > 0);
}

/**
 * Stegvis plan: rampa fördelningen linjärt över N år (1/N per år) och beräkna
 * ackumulerad kostnad och råa lönegapet vid varje år. Stödjer DiskrL 3:11
 * ("senast inom tre år"). perPerson kommer från allocate (har delta + lon + kon).
 * @returns {Array<{year,andelPct,kumRaise,kumKostnad,rawGap}>}
 */
function stagedPlan(rows, perPerson, years, costOpts) {
    const N = Math.max(1, Math.min(5, Math.round(years) || 1));
    const months = (costOpts && costOpts.months) || 12;
    const poFactor = 1 + ((costOpts && costOpts.poPct) || 0) / 100;
    const out = [];
    for (let k = 1; k <= N; k++) {
        const frac = k / N;
        const simRows = perPerson.map((p, i) => ({ kon: rows[i].kon, lon: rows[i].lon + p.delta * frac }));
        const kumRaise = perPerson.reduce((s, p) => s + p.delta * frac, 0);
        out.push({
            year: k, andelPct: 100 * frac, kumRaise,
            kumKostnad: kumRaise * months * poFactor,
            rawGap: rawGenderGap(simRows, r => r.lon)
        });
    }
    return out;
}

/**
 * Sammanställning per BAS→AID-grupp (för kriteriebaserad riktning).
 * @returns {Array<{bas,aid,n,kvN,andelKv,median}>}
 */
function summarizeGroups(rows) {
    const m = new Map();
    (rows || []).forEach(r => {
        const k = r.bas + '|' + r.aid;
        let g = m.get(k);
        if (!g) { g = { bas: r.bas, aid: r.aid, lons: [], kvN: 0, n: 0 }; m.set(k, g); }
        g.lons.push(r.lon); g.n++;
        if (r.kon && r.kon.includes('kvinna')) g.kvN++;
    });
    return [...m.values()].map(g => ({
        bas: g.bas, aid: g.aid, n: g.n, kvN: g.kvN,
        andelKv: g.n ? 100 * g.kvN / g.n : 0, median: _median(g.lons)
    }));
}

/**
 * Leapfrog-/spillover-detektering: hittar grupper som efter påslaget passerar
 * (går om) en grupp som tidigare hade högre median — vilket kan skapa ny
 * skevhet. Jämför på gruppmedianer (perGroup från allocate).
 * @returns {Array<{bas:string, aid:string, overBas:string, overAid:string, gammalA:number, nyA:number, gammalB:number, nyB:number}>}
 */
function detectLeapfrog(perGroup) {
    const g = (perGroup || []).filter(x => x.n > 0);
    const out = [];
    for (let i = 0; i < g.length; i++) {
        for (let j = 0; j < g.length; j++) {
            if (i === j) continue;
            if (g[i].gammalMedian < g[j].gammalMedian - 1e-6 && g[i].nyMedian > g[j].nyMedian + 1e-6) {
                out.push({
                    bas: g[i].bas, aid: g[i].aid, overBas: g[j].bas, overAid: g[j].aid,
                    gammalA: g[i].gammalMedian, nyA: g[i].nyMedian,
                    gammalB: g[j].gammalMedian, nyB: g[j].nyMedian
                });
            }
        }
    }
    return out;
}

/**
 * Hela prognosutfallet: pott, budgetutnyttjande, total kostnad (inkl. PO + period)
 * och råa lönegapet före/efter. Det OFÖRKLARADE gapet (OLS) beräknas i app.js.
 * @param {Array} rows
 * @param {{mode:string, value:number|null}} budget
 * @param {{mode:string, value:number|null}} generell
 * @param {Array} targets
 * @param {{months?:number, poPct?:number, roundStep?:number, kvThreshold?:number}} [costOpts]
 */
function forecastOutcome(rows, budget, generell, targets, costOpts) {
    const pott = computePott(rows, budget);
    const alloc = allocate(rows, generell, targets, costOpts && costOpts.roundStep);
    const totalRaise = alloc.totals.totalRaise;
    const months = (costOpts && costOpts.months) || 12;
    const poFactor = 1 + ((costOpts && costOpts.poPct) || 0) / 100;
    const kvThreshold = (costOpts && costOpts.kvThreshold) || 60;
    const lonsummaFore = totalLonSum(rows);
    // Hur mycket av påslaget går till kvinnodominerade grupper (jämställdhetsandel)
    const equityCost = alloc.perGroup.reduce((s, g) => s + (g.andelKv >= kvThreshold ? g.kostnad : 0), 0);
    return {
        pott,
        använt: totalRaise,
        kvar: pott - totalRaise,
        overBudget: totalRaise > pott + 1e-6,
        totalKostnad: totalRaise * months * poFactor,
        lonsummaFore,
        lonsummaEfter: lonsummaFore + totalRaise,
        rawGapFore: rawGenderGap(rows, r => r.lon),
        rawGapEfter: rawGenderGap(alloc.perPerson, p => p.nyLon),
        generellCost: alloc.totals.generellCost,
        riktadCost: alloc.totals.riktadCost,
        equityCost,
        leapfrog: detectLeapfrog(alloc.perGroup),
        alloc
    };
}

// ===================================================================
// Lönespann/compa-ratio, individnivå-remediation,
// marknadspositionering, budgetkänslighet.
// ===================================================================

/**
 * (A) Lönespann per BAS: P25 / median / P75. compa-ratio och range-penetration
 * beräknas mot detta i UI.
 * @returns {Array<{bas,n,p25,median,p75}>}
 */
function bandStats(rows) {
    const m = new Map();
    (rows || []).forEach(r => {
        if (!(r.lon > 0)) return;
        if (!m.has(r.bas)) m.set(r.bas, []);
        m.get(r.bas).push(r.lon);
    });
    return [...m.entries()].map(([bas, lons]) => ({
        bas, n: lons.length,
        p25: _quantile(lons, 0.25), median: _median(lons), p75: _quantile(lons, 0.75)
    })).sort((a, b) => (a.bas < b.bas ? -1 : a.bas > b.bas ? 1 : 0));
}

/**
 * (B) Individnivå-remediation (DiskrL 3:9 — lika arbete): flaggar kvinnor som
 * är betalda mer än `gapPct` % under sitt likalöne-benchmark (mäns median i
 * samma BAS×AID, fallback mäns median i BAS) och beräknar kostnaden att lyfta
 * dem till benchmark. Endast aggregat returneras för visning; `flagged` används
 * internt för seeding och summeras per grupp.
 *
 * `minMen` är minsta antal män bakom ett benchmark. Appen skickar alltid gällande k-tröskel:
 * mot en enda mans lön vore "kostnaden att lyfta" en kvinna hans lön minus hennes.
 * Standardvärdet 1 finns för enhetstesterna.
 * @param {Array} rows
 * @param {{gapPct?:number, minMen?:number}} opts
 */
function individualRemediation(rows, opts) {
    const o = opts || {};
    const trigger = (o.gapPct != null ? o.gapPct : 5) / 100;
    const minMen = o.minMen || 1;
    const menByGroup = new Map(), menByBas = new Map();
    (rows || []).forEach(r => {
        if (!(r.lon > 0)) return;
        if (!(r.kon === 'man' || r.kon === 'män')) return;
        const gk = r.bas + '|' + r.aid;
        if (!menByGroup.has(gk)) menByGroup.set(gk, []);
        menByGroup.get(gk).push(r.lon);
        if (!menByBas.has(r.bas)) menByBas.set(r.bas, []);
        menByBas.get(r.bas).push(r.lon);
    });
    const benchFor = (bas, aid) => {
        const g = menByGroup.get(bas + '|' + aid);
        if (g && g.length >= minMen) return { v: _median(g), kalla: 'yrke' };
        const b = menByBas.get(bas);
        if (b && b.length >= minMen) return { v: _median(b), kalla: 'bas' };
        return null;
    };
    const flagged = [];
    (rows || []).forEach(r => {
        if (!(r.lon > 0)) return;
        if (!(r.kon && r.kon.includes('kvinna'))) return;
        const bench = benchFor(r.bas, r.aid);
        if (!bench) return;
        if (r.lon < bench.v * (1 - trigger)) {
            flagged.push({ bas: r.bas, aid: r.aid, lon: r.lon, benchmark: bench.v, kalla: bench.kalla, shortfall: bench.v - r.lon });
        }
    });
    const byGroup = new Map();
    flagged.forEach(f => {
        const k = f.bas + '|' + f.aid;
        let g = byGroup.get(k);
        if (!g) { g = { bas: f.bas, aid: f.aid, count: 0, cost: 0 }; byGroup.set(k, g); }
        g.count++; g.cost += f.shortfall;
    });
    return {
        flagged, count: flagged.length,
        totalCost: flagged.reduce((s, f) => s + f.shortfall, 0),
        perGroup: [...byGroup.values()].sort((a, b) => b.cost - a.cost)
    };
}

/**
 * (E) Marknadspositionering: bygg riktade rader som lyfter grupper vars median
 * ligger under marknad × factor, mot den nivån.
 * @param {Array<{bas,aid,n,median}>} groups - från summarizeGroups
 * @param {Map<string,number>} marketByKey - nyckel "aid|bas" eller "aid" → marknadsmedian
 * @param {number} factor - andel av marknadsmedian att nå (t.ex. 0.95)
 * @param {number} [minN=0]
 */
function marketTargets(groups, marketByKey, factor, minN) {
    const f = factor > 0 ? factor : 1;
    const out = [];
    (groups || []).forEach(g => {
        if (g.n < (minN || 0)) return;
        let mk = marketByKey.get(g.aid + '|' + g.bas);
        if (mk == null) mk = marketByKey.get(g.aid);
        if (mk == null || !(mk > 0)) return;
        const target = mk * f;
        if (g.median < target) {
            out.push({ bas: g.bas, aid: g.aid, mode: 'kr', value: Math.round((target - g.median) * g.n), dist: 'lowest', pool: 'marknad' });
        }
    });
    return out;
}

/**
 * (F) Budgetkänslighet: svep §3:10-stängning 0→100 % och returnera kostnad +
 * råa lönegapet för varje steg (avtagande avkastning).
 * @returns {Array<{fraction,kostnad,rawGap}>}
 */
function sensitivityCurve(rows, candidates, costOpts, steps) {
    const S = steps || 10;
    const months = (costOpts && costOpts.months) || 12;
    const poFactor = 1 + ((costOpts && costOpts.poPct) || 0) / 100;
    const out = [];
    for (let i = 0; i <= S; i++) {
        const frac = i / S;
        const targets = closureTargets(candidates, frac, 0);
        const alloc = allocate(rows, { mode: 'pct', value: 0 }, targets, costOpts && costOpts.roundStep);
        out.push({
            fraction: frac,
            kostnad: alloc.totals.totalRaise * months * poFactor,
            rawGap: rawGenderGap(alloc.perPerson, p => p.nyLon)
        });
    }
    return out;
}

    return { computePott, allocate, targetRows, suggestTargets, closureTargets, stagedPlan, summarizeGroups, detectLeapfrog, forecastOutcome, bandStats, individualRemediation, marketTargets, sensitivityCurve, _median };
})();
const _fcComputePott = __mirrorForecast.computePott;
const _fcAllocate = __mirrorForecast.allocate;
const _fcTargetRows = __mirrorForecast.targetRows;
const _fcSuggestTargets = __mirrorForecast.suggestTargets;
const _fcClosureTargets = __mirrorForecast.closureTargets;
const _fcStagedPlan = __mirrorForecast.stagedPlan;
const _fcSummarizeGroups = __mirrorForecast.summarizeGroups;
const _fcDetectLeapfrog = __mirrorForecast.detectLeapfrog;
const _fcForecastOutcome = __mirrorForecast.forecastOutcome;
const _fcBandStats = __mirrorForecast.bandStats;
const _fcIndividualRemediation = __mirrorForecast.individualRemediation;
const _fcMarketTargets = __mirrorForecast.marketTargets;
const _fcSensitivityCurve = __mirrorForecast.sensitivityCurve;
const _fcMedian = __mirrorForecast._median;

// ---- speglar src/lib/struktur.js ----
const __mirrorStructure = (() => {
// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
/**
 * Öppen lönekartläggning — Strukturanalys & EU-rapportmått
 *
 * Rena funktioner för representation/segregation, kvartilfördelning (EU
 * 2023/970 Art. 9), distributionellt gap (sticky floor vs glass ceiling),
 * mediangap och direktivets tecken på gapet (tillDirektivtecken). Separat från app.js för Vitest; app.js får en AUTO-GENERERAD
 * spegel (`_st*` i src/app/09-lib-speglar.js via tools/gen-mirrors.mjs) — ändra
 * här och kör `npm run build:app`, rör ej spegeln. Inga DOM-/state-beroenden.
 */

function _median(arr) {
    if (!arr || !arr.length) return 0;
    const s = arr.slice().sort((a, b) => a - b);
    const m = s.length >> 1;
    return (s.length & 1) ? s[m] : (s[m - 1] + s[m]) / 2;
}
function _quantile(arr, q) {
    if (!arr || !arr.length) return 0;
    const s = arr.slice().sort((a, b) => a - b);
    const pos = (s.length - 1) * q;
    const lo = Math.floor(pos), hi = Math.ceil(pos);
    return lo === hi ? s[lo] : s[lo] + (s[hi] - s[lo]) * (pos - lo);
}
function _isKv(r) { return r.kon && r.kon.includes('kvinna'); }
function _isMa(r) { return r.kon === 'man' || r.kon === 'män'; }

/**
 * Mediangapet kvinnor vs män (%), null om något kön saknas — eller har färre än `k` personer
 * (k-anonymitet: gapet pekar annars ut de få i det mindre könet). Anroparen i appen skickar
 * alltid gällande tröskel; standardvärdet 1 finns för enhetstesterna.
 */
function medianGapPct(rows, { k = 1 } = {}) {
    const kv = [], ma = [];
    (rows || []).forEach(r => { if (!(r.lon > 0)) return; if (_isKv(r)) kv.push(r.lon); else if (_isMa(r)) ma.push(r.lon); });
    if (kv.length < Math.max(1, k) || ma.length < Math.max(1, k)) return null;
    return (_median(kv) / _median(ma) - 1) * 100;
}

/**
 * Representation/segregation per BAS-nivå. Sorteras BAS A–Ö (lägst värderad nivå
 * först) — om andelen kvinnor sjunker mot högre BAS finns vertikal segregering.
 *
 * `k` är minsta antal per kön för att könsuppdelade mått ska lämnas ut (k-anonymitet): har
 * ett kön färre, blir medianKv, medianMa och gapPct null och `konLitet` sant. BAS:ets samlade
 * median och antalen står kvar — om BAS:et som helhet får redovisas avgör anroparen på `n`.
 * @returns {Array<{bas,n,nKv,nMa,andelKv,median,medianKv,medianMa,gapPct,konLitet}>}
 */
function representationByBas(rows, { k = 1 } = {}) {
    const minst = Math.max(1, k);
    const m = new Map();
    (rows || []).forEach(r => {
        if (!(r.lon > 0)) return;
        let g = m.get(r.bas);
        if (!g) { g = { bas: r.bas, lons: [], kvLons: [], maLons: [], nKv: 0, nMa: 0, n: 0 }; m.set(r.bas, g); }
        g.lons.push(r.lon); g.n++;
        if (_isKv(r)) { g.kvLons.push(r.lon); g.nKv++; }
        else if (_isMa(r)) { g.maLons.push(r.lon); g.nMa++; }
    });
    return [...m.values()].map(g => {
        // Båda könen finns, men minst ett är för litet för en könsjämförelse.
        const konLitet = g.kvLons.length > 0 && g.maLons.length > 0 && (g.kvLons.length < minst || g.maLons.length < minst);
        const visaKv = g.kvLons.length >= minst && !konLitet, visaMa = g.maLons.length >= minst && !konLitet;
        return {
            bas: g.bas, n: g.n, nKv: g.nKv, nMa: g.nMa,
            andelKv: g.n ? 100 * g.nKv / g.n : 0,
            median: _median(g.lons),
            medianKv: visaKv ? _median(g.kvLons) : null,
            medianMa: visaMa ? _median(g.maLons) : null,
            gapPct: (visaKv && visaMa) ? (_median(g.kvLons) / _median(g.maLons) - 1) * 100 : null,
            konLitet
        };
    }).sort((a, b) => String(a.bas).localeCompare(String(b.bas), 'sv'));   // BAS A–Ö, som i övriga verktyget
}

/**
 * Kvartilfördelning (EU 2023/970 Art. 9f): dela arbetsstyrkan i fyra lika stora
 * lönekvartiler (Q1 = lägst) och redovisa andel kvinnor/män i varje.
 *
 * Gränserna mellan kvartilerna är mittpunkten mellan högsta lönen i den lägre och
 * lägsta i den högre kvartilen. Kvartilernas yttre löner redovisas inte: Q1:s lägsta
 * och Q4:s högsta är organisationens lägsta och högsta enskilda lön. Q1 har ingen undre gräns, Q4 ingen övre.
 *
 * `k`: har ett kön färre än k personer i hela urvalet lämnas könsfördelningen per kvartil
 * inte ut (nKv, nMa och andelKv blir null, `konDolt` sant) — tre män i Q4 säger var just de
 * tjänar. Antal per kvartil och gränserna står kvar.
 * @returns {Array<{q:number, n:number, nKv:number|null, nMa:number|null, andelKv:number|null, undre:number|null, ovre:number|null, konDolt:boolean}>}
 */
function quartileDistribution(rows, { k = 1 } = {}) {
    const all = (rows || []).filter(r => r.lon > 0).slice().sort((a, b) => a.lon - b.lon);
    const n = all.length;
    if (n < 4) return [];
    /** @type {Array<{q:number, n:number, nKv:number, nMa:number, undre:number|null, ovre:number|null}>} */
    const out = [1, 2, 3, 4].map(q => ({ q, n: 0, nKv: 0, nMa: 0, undre: null, ovre: null }));
    /** @type {Array<number|null>} */ const lo = [null, null, null, null];
    /** @type {Array<number|null>} */ const hi = [null, null, null, null];
    all.forEach((r, i) => {
        const q = Math.min(3, Math.floor(i * 4 / n));
        const o = out[q];
        o.n++; if (_isKv(r)) o.nKv++; else if (_isMa(r)) o.nMa++;
        if (lo[q] == null) lo[q] = r.lon;
        hi[q] = r.lon;
    });
    for (let q = 0; q < 3; q++) {
        const grans = ((hi[q] ?? 0) + (lo[q + 1] ?? 0)) / 2;   // n ≥ 4: varje kvartil har minst en person
        out[q].ovre = grans; out[q + 1].undre = grans;
    }
    const totKv = out.reduce((s, o) => s + o.nKv, 0), totMa = out.reduce((s, o) => s + o.nMa, 0);
    const konDolt = k > 1 && (totKv < k || totMa < k);
    return out.map(o => ({
        q: o.q, n: o.n,
        nKv: konDolt ? null : o.nKv, nMa: konDolt ? null : o.nMa,
        andelKv: konDolt ? null : (o.n ? 100 * o.nKv / o.n : 0),
        undre: o.undre, ovre: o.ovre, konDolt
    }));
}

/**
 * Distributionellt gap: lönegapet vid olika percentiler. Större gap i toppen =
 * glastak; större i botten = sticky floor.
 *
 * `k` är minsta antal per kön (k-anonymitet); under det returneras en tom lista. Golvet är
 * aldrig lägre än 2, eftersom en percentil av en enda lön inte är ett mått.
 * @returns {Array<{p,kv,ma,gapPct}>}
 */
function distributionalGap(rows, percentiles, { k = 2 } = {}) {
    const ps = percentiles || [10, 25, 50, 75, 90];
    const kv = [], ma = [];
    (rows || []).forEach(r => { if (!(r.lon > 0)) return; if (_isKv(r)) kv.push(r.lon); else if (_isMa(r)) ma.push(r.lon); });
    const minst = Math.max(2, k);
    if (kv.length < minst || ma.length < minst) return [];
    return ps.map(p => {
        const kvP = _quantile(kv, p / 100), maP = _quantile(ma, p / 100);
        return { p, kv: kvP, ma: maP, gapPct: maP > 0 ? (kvP / maP - 1) * 100 : null };
    });
}

/**
 * Lönegapet med direktivets tecken (EU 2023/970 art. 9). Verktyget räknar skillnaden som (kvinnor − män) / män,
 * negativ när kvinnor ligger lägre; direktivet uttrycker gapet som skillnaden i procent av mäns lön,
 * (män − kvinnor) / män, positiv när kvinnor ligger lägre. Beloppet är detsamma — bara tecknet vänds. Används
 * enbart av EU-lönerapporten och rapportens avsnitt om lönetransparens; övriga flikar och blad behåller verktygets
 * konvention (kvinnors lön i procent av mäns). null och icke-tal lämnas som null; −0 blir 0.
 * @param {number|null|undefined} gapPct (kvinnor − män) / män i procent
 * @returns {number|null}
 */
function tillDirektivtecken(gapPct) {
    if (typeof gapPct !== 'number' || !isFinite(gapPct)) return null;
    return gapPct === 0 ? 0 : -gapPct;
}

    return { medianGapPct, representationByBas, quartileDistribution, distributionalGap, tillDirektivtecken };
})();
const _stMedianGapPct = __mirrorStructure.medianGapPct;
const _stRepresentationByBas = __mirrorStructure.representationByBas;
const _stQuartileDistribution = __mirrorStructure.quartileDistribution;
const _stDistributionalGap = __mirrorStructure.distributionalGap;
const _stTillDirektivtecken = __mirrorStructure.tillDirektivtecken;

// ---- speglar src/lib/rng.js ----
const __mirrorRng = (() => {
// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
/**
 * Öppen lönekartläggning — Deterministisk slumpgenerator för bootstrap
 *
 * Med `Math.random()` skulle SAMMA fil ge OLIKA bootstrap-intervall vid varje
 * körning. Intervallen hamnar i utskrifter som går till ledning och fack, så två
 * personer med samma underlag ska få samma siffror — och projektet i övrigt är
 * byggt på reproducerbarhet (golden-lås, determinismtester, mulberry32 i
 * testdatageneratorn).
 *
 * Därför seedas generatorn från datat självt. Samma indata → samma seed →
 * samma intervall, varje gång, i varje webbläsare. Statistiskt likvärdigt —
 * bootstrap kräver bara att draget är pseudoslumpmässigt, inte oförutsägbart.
 *
 * Separat från app.js för Vitest; app.js får en AUTO-GENERERAD spegel (`_rng*`
 * i src/app/09-lib-speglar.js via tools/gen-mirrors.mjs) — ändra här och kör
 * `npm run build:app`, rör ej spegeln (vaktas av tests/drift.test.js).
 */

/**
 * FNV-1a, 32 bitar. Snabb och stabil sträng→heltal-hash.
 * @param {string} str
 * @returns {number} osignerat 32-bitars heltal
 */
function hashSeed(str) {
    let h = 2166136261;
    const s = String(str);
    for (let i = 0; i < s.length; i++) {
        h ^= s.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    return h >>> 0;
}

/**
 * mulberry32 — samma generator som testdatageneratorn använder. Liten, snabb
 * och tillräckligt bra för bootstrap-återsampling.
 * @param {number} seed
 * @returns {() => number} funktion som ger tal i [0, 1)
 */
function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
        a = (a + 0x6D2B79F5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

/**
 * Härleder en stabil seed ur själva talserierna. Använder längd + summa per
 * serie, vilket är billigt och ändras så fort underlaget ändras (ny fil, annat
 * urval → nytt men reproducerbart intervall).
 * @param {...Array<number>} arrays
 * @returns {number}
 */
function seedFromNumbers(...arrays) {
    let s = '';
    for (const arr of arrays) {
        if (!Array.isArray(arr)) { s += 'x|'; continue; }
        let sum = 0;
        for (let i = 0; i < arr.length; i++) {
            const v = Number(arr[i]);
            if (isFinite(v)) sum += v;
        }
        s += arr.length + ':' + Math.round(sum) + '|';
    }
    return hashSeed(s);
}

/**
 * Bekvämlighet: seedad generator direkt ur talserierna.
 * @param {...Array<number>} arrays
 * @returns {() => number}
 */
function rngFor(...arrays) {
    return mulberry32(seedFromNumbers(...arrays));
}

    return { hashSeed, seedFromNumbers, rngFor };
})();
const _rngHashSeed = __mirrorRng.hashSeed;
const _rngSeedFrom = __mirrorRng.seedFromNumbers;
const _rngFor = __mirrorRng.rngFor;

// ---- speglar src/lib/likvardighet.js ----
const __mirrorLikvardighet = (() => {
    // importer ur tidigare speglade lib-moduler
    const _median = __mirrorStat.median;
    const rngFor = __mirrorRng.rngFor;

// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
/**
 * Öppen lönekartläggning — Likvärdighetsanalys (DiskrL 3:10 §)
 *
 * Ren, testbar kärna för § 3:10-analysen. Appen får den genom lib-speglarna
 * (ADR-8); computeLikvardighetPairs() i 34-likvardigt-arbete.js är adaptern
 * runt den. Vitest verifierar *algoritmen* deterministiskt.
 *
 * Modellen:
 *   Steg 1 — Organisationens AID×BAS-grupper delas i:
 *            • kvinnodominerade (kvinnoPct > kvinnoThr, mer än 60 %) — analysens subjekt
 *            • icke-kvinnodominerade (kvinnoPct < 100−kvinnoThr, mindre än 40 %) — interna
 *              jämförelsekandidater (PRIMÄR jämförelsekälla; § 3:10 är en
 *              inom-arbetsgivare-analys). K-anonymitet tillämpas EJ.
 *   Steg 2 — jämförelsestatistikens AID×BAS klassificeras som
 *            icke-kvinnodominerade (kvAndel ≤ 40 %). Lokal könsdata primär,
 *            SCB-prefix-fallback (injicerad `scbKlass`-funktion) annars.
 *            Används som EXTERN fallback per BAS.
 *   Steg 3 — Jämför INOM samma BAS-intervall (= likvärdiga krav). Per BAS
 *            väljs internt jämförelseyrke om sådant finns, annars jämförelsestatistiken.
 *            Flagga par där jämförelseyrkets median > organisationens median,
 *            gap ≥ minGapPct. Varje par får ett bootstrap-95 %-CI på
 *            medianskillnaden (intern: bägge urvalen; extern: org-löner mot
 *            jämförelsestatistikens median som konstant). Interna par får
 *            dessutom en ÅLDERSJUSTERAD skillnad (aldersjusteradSkillnad):
 *            jämförelseyrkets lön standardiserad till den kvinnodominerade
 *            gruppens åldersfördelning. Den råa skillnaden är huvudmåttet —
 *            lagen prövar lönenivån som sådan — den justerade visar hur
 *            mycket av skillnaden som kan bero på åldersstruktur.
 *
 * @see 34-likvardigt-arbete.js computeLikvardighetPairs
 */



const KVINNO_TROSKEL_DEFAULT = 60;   // > → kvinnodominerat (mer än 60 % kvinnor; jurist 2026-10-19, A5)
const ICKE_KV_TAK = 40;              // < → icke-kvinnodominerat (mindre än 40 % kvinnor; jämförelsestatistiken)
const KV_DOM_STAT = 60;               // > → kvinnodominerat (jämförelsestatistiken, skippas)

function _sortedMedian(arr) {
    if (!arr || !arr.length) return 0;
    const s = arr.slice().sort((a, b) => a - b);
    const m = s.length >> 1;
    return s.length & 1 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/**
 * Bootstrap-CI för MEDIAN-SKILLNAD i kronor (m_ma − m_kv), percentil [2.5,97.5].
 * Används för INTERNA par (bägge sidor har individdata).
 * @param {number[]} kvLons
 * @param {number[]} maLons
 * @param {number} [B=1000]
 * @param {() => number} [rng=Math.random] - injicerbar RNG för deterministiska tester
 * @returns {{lo:number, hi:number}|null}
 */
function bootstrapMedianDiffKr(kvLons, maLons, B = 1000, rng = Math.random) {
    if (!Array.isArray(kvLons) || !Array.isArray(maLons)) return null;
    if (kvLons.length < 3 || maLons.length < 3) return null;
    const diffs = new Array(B);
    const kvN = kvLons.length, maN = maLons.length;
    for (let b = 0; b < B; b++) {
        const sKv = new Array(kvN), sMa = new Array(maN);
        for (let i = 0; i < kvN; i++) sKv[i] = kvLons[(rng() * kvN) | 0];
        for (let i = 0; i < maN; i++) sMa[i] = maLons[(rng() * maN) | 0];
        diffs[b] = _sortedMedian(sMa) - _sortedMedian(sKv);
    }
    diffs.sort((a, b) => a - b);
    return { lo: diffs[Math.floor(B * 0.025)], hi: diffs[Math.floor(B * 0.975)] };
}

/**
 * Bootstrap-CI mot ett KONSTANT referensvärde (constMedian − m_sample).
 * Används för EXTERNA par (jämförelsestatistikens median är ett aggregat utan individdata).
 * @param {number[]} orgLons
 * @param {number} constMedian
 * @param {number} [B=1000]
 * @param {() => number} [rng=Math.random]
 * @returns {{lo:number, hi:number}|null}
 */
function bootstrapMedianVsConstantKr(orgLons, constMedian, B = 1000, rng = Math.random) {
    if (!Array.isArray(orgLons) || orgLons.length < 3) return null;
    if (!(constMedian > 0)) return null;
    const n = orgLons.length;
    const diffs = new Array(B);
    for (let b = 0; b < B; b++) {
        const sample = new Array(n);
        for (let i = 0; i < n; i++) sample[i] = orgLons[(rng() * n) | 0];
        diffs[b] = constMedian - _sortedMedian(sample);
    }
    diffs.sort((a, b) => a - b);
    return { lo: diffs[Math.floor(B * 0.025)], hi: diffs[Math.floor(B * 0.975)] };
}

const ALDERS_GOLV_DEFAULT = 10;      // minsta antal personer i jämförelseyrket för åldersjustering
const ALDERS_SPRIDNING_MIN = 5;      // minsta åldersspridning (år) i jämförelseyrket

function _medel(arr) {
    const v = (arr || []).filter(x => typeof x === 'number' && isFinite(x));
    return v.length ? v.reduce((s, x) => s + x, 0) / v.length : null;
}

/**
 * Åldersjusterad skillnad för ett internt par: jämförelseyrkets lön standardiseras
 * till den kvinnodominerade gruppens åldersfördelning.
 *
 * I jämförelseyrket skattas log(lön) = a + b·ålder (OLS). Kravet är minst `golv`
 * personer med ålder och minst 5 års åldersspridning — annars null. Lönen
 * prediceras sedan vid varje person i den kvinnodominerade gruppen med dennes
 * ålder; medianen av prediktionerna är den åldersjusterade jämförelsemedianen.
 * Skillnaden räknas i kronor och procent mot den kvinnodominerade gruppens
 * (råa) median, så att den är jämförbar med parets råa skillnad.
 *
 * @param {Array<{lon:number, alder?:number}>} kvRader - den kvinnodominerade gruppen
 * @param {Array<{lon:number, alder?:number}>} jmfRader - jämförelseyrket (individlöner)
 * @param {{golv?:number}} [opts]
 * @returns {{medianJusterad:number, gapKr:number, gapPct:number, metod:'alder'}|null}
 */
function aldersjusteradSkillnad(kvRader, jmfRader, { golv = ALDERS_GOLV_DEFAULT } = {}) {
    /** @returns {r is {lon:number, alder:number}} */
    const ok = r => !!r && r.lon > 0 && typeof r.alder === 'number' && isFinite(r.alder);
    const jmf = (jmfRader || []).filter(ok);
    if (jmf.length < Math.max(golv, 3)) return null;
    let lagst = Infinity, hogst = -Infinity;
    for (const r of jmf) { if (r.alder < lagst) lagst = r.alder; if (r.alder > hogst) hogst = r.alder; }
    if (hogst - lagst < ALDERS_SPRIDNING_MIN) return null;
    const n = jmf.length;
    const mx = jmf.reduce((s, r) => s + r.alder, 0) / n;
    let Sxx = 0, Sxy = 0, Sy = 0;
    for (const r of jmf) { const x = r.alder - mx, y = Math.log(r.lon); Sxx += x * x; Sxy += x * y; Sy += y; }
    if (!(Sxx > 1e-9)) return null;
    const b = Sxy / Sxx, a = Sy / n - b * mx;
    const kvAlla = (kvRader || []).filter(r => r && r.lon > 0);
    const kvMedAlder = kvAlla.filter(ok);
    if (!kvAlla.length || !kvMedAlder.length) return null;
    const pred = kvMedAlder.map(r => Math.exp(a + b * r.alder));
    const medianJusterad = _median(pred);
    const kvMedian = _median(kvAlla.map(r => r.lon));
    if (!(medianJusterad > 0) || !(kvMedian > 0)) return null;
    const gapKr = medianJusterad - kvMedian;
    return { medianJusterad, gapKr, gapPct: gapKr / kvMedian * 100, metod: 'alder' };
}

/** Individrader {lon, alder} ur en aggregerad grupp (lons och aldrar är parallella). */
function _gruppRader(g) {
    if (!g || !Array.isArray(g.lons)) return [];
    const aldrar = Array.isArray(g.aldrar) ? g.aldrar : [];
    return g.lons.map((lon, i) => ({ lon, alder: aldrar[i] }));
}

/** Åldersfälten för ett par: medelålder per sida och den justerade skillnaden (bara interna par). */
function _aldersFalt(f, g, ärIntern, golv) {
    /** @type {ReturnType<typeof aldersjusteradSkillnad>} */
    let aldersJusterad = null;
    if (ärIntern) {
        try { aldersJusterad = aldersjusteradSkillnad(_gruppRader(f), _gruppRader(g), { golv }); } catch (_) { aldersJusterad = null; }
    }
    return {
        kvMedelAlder: _medel(f.aldrar),
        maMedelAlder: ärIntern ? _medel(g.aldrar) : null,
        aldersJusterad
    };
}

/**
 * Steg 1 — aggregera organisationens individdata per AID×BAS och dela upp i
 * kvinnodominerade grupper (analysens subjekt) och icke-kvinnodominerade
 * grupper (interna jämförelsekandidater).
 *
 * @param {Array<{aid:string, bas:string, lon:number, kon:string, yrkeLabel?:string, yrke?:string, alder?:number}>} data
 * @param {number} kvinnoThr - kvinnotröskel i procent (> → kvinnodominerat)
 * @param {number} [K=10]
 * @returns {{orgKvDom:Array, orgIckeKv:Array, antalAidxBas:number, kvDomMedNLessThanK:number}}
 */
function aggregeraOrgKvDom(data, kvinnoThr = KVINNO_TROSKEL_DEFAULT, K = 10) {
    const ickeKvTak = 100 - kvinnoThr;
    const map = new Map();   // nyckel: aid|bas
    for (const r of (data || [])) {
        const aid = String(r?.aid || '').trim();
        if (!aid || !(r.lon > 0) || !r.bas) continue;
        const key = aid + '|' + r.bas;
        if (!map.has(key)) {
            map.set(key, { aid, bas: r.bas, label: r.yrkeLabel || r.yrke || aid, n: 0, nKv: 0, lons: [], aldrar: [] });
        }
        const g = map.get(key);
        g.n++;
        if (typeof r.kon === 'string' && r.kon.includes('kvinna')) g.nKv++;
        g.lons.push(r.lon);
        // Åldern bärs parallellt med lönen (null när den saknas) för åldersjusteringen i steg 3.
        g.aldrar.push(typeof r.alder === 'number' && isFinite(r.alder) ? r.alder : null);
    }
    const orgKvDom = [];
    const orgIckeKv = [];
    let kvDomMedNLessThanK = 0;
    for (const g of map.values()) {
        const kvinnoPct = (g.nKv / g.n) * 100;
        const obj = {
            aid: g.aid, bas: g.bas, label: g.label,
            n: g.n, nKv: g.nKv, kvinnoPct,
            median: _median(g.lons), lons: g.lons.slice(), aldrar: g.aldrar.slice()
        };
        if (kvinnoPct > kvinnoThr) {
            orgKvDom.push(obj);
            if (g.n < K) kvDomMedNLessThanK++;
        } else if (kvinnoPct < ickeKvTak) {
            orgIckeKv.push(obj);
        }
    }
    orgKvDom.sort((a, b) => b.n - a.n);
    orgIckeKv.sort((a, b) => b.n - a.n);
    return { orgKvDom, orgIckeKv, antalAidxBas: map.size, kvDomMedNLessThanK };
}

/**
 * Steg 2 — klassificera jämförelsestatistiken per AID×BAS. Returnerar de
 * icke-kvinnodominerade raderna grupperade per BAS.
 *
 * @param {Array<{aid:string, bas:string, median:number, andelKv?:number, aidFull?:string, nKv?:number, nMa?:number}>} statistik
 * @param {((aid:string) => ({kvAndel:number}|null))|null} [scbKlass] - SCB-prefix-fallback
 * @returns {{statIckeKv:Array, statByBas:Map, klass:Object, klassKalla:Object}}
 */
function klassificeraStatistik(statistik, scbKlass) {
    const statByBas = new Map();
    const statIckeKv = [];
    const klass = { kvDom: 0, blandat: 0, ickeKv: 0, oklassificerad: 0 };
    const klassKalla = { lokal: 0, scb: 0 };

    for (const s of (statistik || [])) {
        if (!s || !s.aid || !s.bas || !(s.median > 0)) continue;
        if (!/^\d+$/.test(String(s.aid))) continue;   // hoppa över yrkesfamiljerubriker

        /** @type {number|null} */ let kvAndel = null;
        /** @type {'lokal'|'scb'|null} */ let källa = null;
        if (s.andelKv != null && s.andelKv >= 0 && s.andelKv <= 100) {
            kvAndel = s.andelKv; källa = 'lokal';
        } else if (typeof scbKlass === 'function') {
            const scb = scbKlass(s.aid);
            if (scb && scb.kvAndel != null) { kvAndel = scb.kvAndel; källa = 'scb'; }
        }
        if (kvAndel == null) { klass.oklassificerad++; continue; }
        if (källa === 'lokal') klassKalla.lokal++; else klassKalla.scb++;

        if (kvAndel > KV_DOM_STAT) { klass.kvDom++; continue; }
        if (kvAndel >= ICKE_KV_TAK) { klass.blandat++; continue; }
        klass.ickeKv++;

        const rawLabel = s.aidFull || s.aid;
        const aidStr = String(s.aid);
        const cleanLabel = String(rawLabel).startsWith(aidStr)
            ? String(rawLabel).slice(aidStr.length).replace(/^\s*[—\-:.\s]*/, '').trim() || aidStr
            : rawLabel;
        const obj = {
            aid: s.aid, label: cleanLabel, bas: s.bas,
            median: s.median, kvAndel, källa, nKv: s.nKv, nMa: s.nMa
        };
        if (!statByBas.has(s.bas)) statByBas.set(s.bas, []);
        statByBas.get(s.bas).push(obj);
        statIckeKv.push(obj);
    }
    statIckeKv.sort((a, b) => a.kvAndel - b.kvAndel);
    return { statIckeKv, statByBas, klass, klassKalla };
}

/**
 * Bygg en Map per BAS av organisationens interna jämförelseyrken.
 * @param {Array} orgIckeKv
 * @returns {Map<string, Array>}
 */
function orgIckeKvByBas(orgIckeKv) {
    const m = new Map();
    for (const g of (orgIckeKv || [])) {
        if (!m.has(g.bas)) m.set(g.bas, []);
        m.get(g.bas).push(g);
    }
    return m;
}

/**
 * Steg 3 — bygg kandidatpar inom samma BAS. Per BAS väljs organisationens
 * egna icke-kv-dom yrken (intern, primärt); saknas sådant används jämförelsestatistiken
 * (extern fallback). Flagga par där jämförelseyrkets median > org-median.
 *
 * @param {Array} orgKvDom
 * @param {Map} internByBas - från orgIckeKvByBas()
 * @param {Map} externByBas - statByBas från klassificeraStatistik()
 * @param {Object} [opts] - { minGap, topN, B, rng, golv }
 * @returns {{pairs:Array, jämförelse:Object}}
 */
function byggPar(orgKvDom, internByBas, externByBas, opts = {}) {
    const minGap = opts.minGap ?? 0;
    const topN = opts.topN ?? 100;
    const B = opts.B ?? 1000;
    const golv = opts.golv ?? ALDERS_GOLV_DEFAULT;
    // Utan explicit rng seedas bootstrappen PER PAR ur parets egna löner
    // (rngFor). Då blir konfidensintervallen reproducerbara mellan körningar —
    // ett Math.random-default gav nya KI varje gång och gjorde ett exporterat
    // underlag omöjligt att återskapa. Tester injicerar sin egen rng.
    const rngOpt = opts.rng ?? null;
    const prngFor = (a, b) => rngOpt || rngFor(a, b);
    const jämförelse = {
        gemensammaBas: 0, möjligaPar: 0, statHögre: 0, statLägreEllerLika: 0,
        internaPar: 0, externaPar: 0, basMedExternFallback: 0,
        kravProxy: 'bas', kvUtanPoang: 0
    };
    const pairs = [];
    internByBas = internByBas || new Map();
    externByBas = externByBas || new Map();
    if (!orgKvDom?.length || (!internByBas.size && !externByBas.size)) return { pairs, jämförelse };

    const orgBasSet = new Set(orgKvDom.map(f => f.bas));
    const jämförBasSet = new Set([...internByBas.keys(), ...externByBas.keys()]);
    jämförelse.gemensammaBas = [...orgBasSet].filter(b => jämförBasSet.has(b)).length;

    const candidates = [];
    for (const f of orgKvDom) {
        const internaRows = internByBas.get(f.bas) || [];
        const externaRows = externByBas.get(f.bas) || [];
        let jämförRader, källa;
        if (internaRows.length) {
            jämförRader = internaRows; källa = 'intern';
        } else if (externaRows.length) {
            jämförRader = externaRows; källa = 'extern';
            jämförelse.basMedExternFallback++;
        } else {
            continue;
        }
        for (const g of jämförRader) {
            jämförelse.möjligaPar++;
            if (g.median <= f.median) { jämförelse.statLägreEllerLika++; continue; }
            jämförelse.statHögre++;
            const gapKr = g.median - f.median;
            const gapPct = (gapKr / f.median) * 100;
            if (gapPct < minGap) continue;

            const ärIntern = källa === 'intern';
            /** @type {{lo:number, hi:number}|null} */
            let gapCI = null;
            try {
                gapCI = (ärIntern && Array.isArray(g.lons))
                    ? bootstrapMedianDiffKr(f.lons, g.lons, B, prngFor(f.lons, g.lons))
                    : bootstrapMedianVsConstantKr(f.lons, g.median, B, prngFor(f.lons, [g.median]));
            } catch (_) { gapCI = null; }

            if (ärIntern) jämförelse.internaPar++; else jämförelse.externaPar++;

            candidates.push({
                kvAid: f.aid, kvLabel: f.label, kvBas: f.bas,
                kvN: f.n, kvNKv: f.nKv, kvMedian: f.median, kvKvinnoPct: f.kvinnoPct,
                maAid: g.aid, maLabel: g.label, maBas: f.bas,
                maMedian: g.median,
                maKvAndel: ärIntern ? g.kvinnoPct : g.kvAndel,
                maN: ärIntern ? g.n : null,
                maNKv: g.nKv, maNMa: g.nMa,
                jamforKalla: källa,                       // 'intern' | 'extern'
                maKlassKort: ärIntern ? 'intern' : (g.källa === 'lokal' ? 'lokal' : 'SCB'),
                maScbKvAndel: ärIntern ? g.kvinnoPct : g.kvAndel,
                maScbPrefix: (!ärIntern && g.källa === 'scb') ? String(g.aid).slice(0, 3) : null,
                gapKr, gapPct, gapCI,
                ..._aldersFalt(f, g, ärIntern, golv),
                allvarsindex: Math.abs(gapKr) * f.n
            });
        }
    }
    candidates.sort((a, b) => b.gapPct - a.gapPct);
    return { pairs: candidates.slice(0, topN), jämförelse };
}

/**
 * Steg 3 (#5) — bygg kandidatpar med ARBETSVÄRDERINGSPOÄNG som krav-proxy
 * istället för BAS. Parar över BAS-gränser: ett jämförelseyrke kvalificerar om
 * dess poäng ≤ det kvinnodominerade yrkets poäng × (1 + band) — dvs likvärdiga
 * eller lägre krav (DiskrL 3:10). Intern jämförelse är primär; saknas internt
 * kvalificerande yrke används jämförelsestatistiken (extern fallback).
 *
 * @param {Array} orgKvDom
 * @param {Array} internAll - organisationens icke-kv-dom yrken (flat)
 * @param {Array} externAll - jämförelsestatistikens icke-kv-dom yrken (flat)
 * @param {Map<string,number>} poangByKey - 'AID|BAS' eller 'AID' → poäng
 * @param {Object} [opts] - { minGap, topN, B, rng, bandPct, golv }
 * @returns {{pairs:Array, jämförelse:Object}}
 */
function byggParPoäng(orgKvDom, internAll, externAll, poangByKey, opts = {}) {
    const minGap = opts.minGap ?? 0;
    const topN = opts.topN ?? 100;
    const B = opts.B ?? 1000;
    const golv = opts.golv ?? ALDERS_GOLV_DEFAULT;
    // Utan explicit rng seedas bootstrappen PER PAR ur parets egna löner
    // (rngFor). Då blir konfidensintervallen reproducerbara mellan körningar —
    // ett Math.random-default gav nya KI varje gång och gjorde ett exporterat
    // underlag omöjligt att återskapa. Tester injicerar sin egen rng.
    const rngOpt = opts.rng ?? null;
    const prngFor = (a, b) => rngOpt || rngFor(a, b);
    const bandPct = opts.bandPct ?? 5;
    const jämförelse = {
        gemensammaBas: 0, möjligaPar: 0, statHögre: 0, statLägreEllerLika: 0,
        internaPar: 0, externaPar: 0, basMedExternFallback: 0,
        kravProxy: 'poäng', kvUtanPoang: 0
    };
    const pairs = [];
    orgKvDom = orgKvDom || [];
    internAll = internAll || [];
    externAll = externAll || [];
    poangByKey = poangByKey || new Map();
    if (!orgKvDom.length || !poangByKey.size) return { pairs, jämförelse };

    const poangFor = g => poangByKey.get(g.aid + '|' + g.bas) ?? poangByKey.get(String(g.aid)) ?? null;
    const candidates = [];
    for (const f of orgKvDom) {
        const fP = poangFor(f);
        if (fP == null) { jämförelse.kvUtanPoang++; continue; }
        const tak = fP * (1 + bandPct / 100);
        let jämförRader = internAll.filter(g => { const p = poangFor(g); return p != null && p <= tak; });
        let källa = 'intern';
        if (!jämförRader.length) {
            jämförRader = externAll.filter(g => { const p = poangFor(g); return p != null && p <= tak; });
            källa = 'extern';
            if (jämförRader.length) jämförelse.basMedExternFallback++;
        }
        for (const g of jämförRader) {
            jämförelse.möjligaPar++;
            if (g.median <= f.median) { jämförelse.statLägreEllerLika++; continue; }
            jämförelse.statHögre++;
            const gapKr = g.median - f.median;
            const gapPct = (gapKr / f.median) * 100;
            if (gapPct < minGap) continue;
            const ärIntern = källa === 'intern';
            /** @type {{lo:number, hi:number}|null} */
            let gapCI = null;
            try {
                gapCI = (ärIntern && Array.isArray(g.lons))
                    ? bootstrapMedianDiffKr(f.lons, g.lons, B, prngFor(f.lons, g.lons))
                    : bootstrapMedianVsConstantKr(f.lons, g.median, B, prngFor(f.lons, [g.median]));
            } catch (_) { gapCI = null; }
            if (ärIntern) jämförelse.internaPar++; else jämförelse.externaPar++;
            candidates.push({
                kvAid: f.aid, kvLabel: f.label, kvBas: f.bas,
                kvN: f.n, kvNKv: f.nKv, kvMedian: f.median, kvKvinnoPct: f.kvinnoPct,
                maAid: g.aid, maLabel: g.label, maBas: g.bas,
                maMedian: g.median,
                maKvAndel: ärIntern ? g.kvinnoPct : g.kvAndel,
                maN: ärIntern ? g.n : null,
                maNKv: g.nKv, maNMa: g.nMa,
                jamforKalla: källa,
                maKlassKort: ärIntern ? 'intern' : (g.källa === 'lokal' ? 'lokal' : 'SCB'),
                maScbKvAndel: ärIntern ? g.kvinnoPct : g.kvAndel,
                maScbPrefix: (!ärIntern && g.källa === 'scb') ? String(g.aid).slice(0, 3) : null,
                gapKr, gapPct, gapCI,
                ..._aldersFalt(f, g, ärIntern, golv),
                kvPoang: fP, maPoang: poangFor(g),
                allvarsindex: Math.abs(gapKr) * f.n
            });
        }
    }
    candidates.sort((a, b) => b.gapPct - a.gapPct);
    return { pairs: candidates.slice(0, topN), jämförelse };
}

/**
 * Lägre krav, högre lön (ADR-25): par där ett kvinnodominerat
 * yrke har lägre medianlön än ett av ORGANISATIONENS icke-kvinnodominerade yrken i
 * strikt LÄGRE BAS. BAS som krav-proxy — används bara när poäng saknas.
 *
 * @param {Array} orgKvDom
 * @param {Array} orgIckeKv
 * @param {Object} opts - { rang: bas → tal, minGap, topN, B, rng }
 * @returns {Array} par med samma fält som interna kandidatpar plus basSteg
 */
function byggParLagreKrav(orgKvDom, orgIckeKv, opts = {}) {
    const { rang } = opts;
    const minGap = opts.minGap ?? 0, topN = opts.topN ?? 100, B = opts.B ?? 1000;
    const rngOpt = opts.rng ?? null;
    const ut = [];
    for (const f of orgKvDom || []) {
        const rf = rang(f.bas);
        for (const g of orgIckeKv || []) {
            const rg = rang(g.bas);
            if (!(rg < rf) || !(g.median > f.median)) continue;
            const gapKr = g.median - f.median;
            const gapPct = gapKr / f.median * 100;
            if (gapPct < minGap) continue;
            ut.push({ _f: f, _g: g,
                kvAid: f.aid, kvLabel: f.label, kvBas: f.bas, kvN: f.n, kvNKv: f.nKv, kvMedian: f.median, kvKvinnoPct: f.kvinnoPct,
                maAid: g.aid, maLabel: g.label, maBas: g.bas, maMedian: g.median, maKvAndel: g.kvinnoPct,
                maN: g.n, maNKv: g.nKv, maNMa: g.n - g.nKv,
                jamforKalla: 'intern', gapKr, gapPct, gapCI: null, basSteg: rf - rg,
            });
        }
    }
    ut.sort((a, b) => b.gapPct - a.gapPct || b.basSteg - a.basSteg);
    // Konfidensintervall bara för paren som behålls — sorteringen beror inte på dem, och
    // bootstrappen seedas per par, så resultatet blir detsamma som om alla räknats.
    return ut.slice(0, topN).map(({ _f, _g, ...p }) => {
        try { p.gapCI = bootstrapMedianDiffKr(_f.lons, _g.lons, B, rngOpt || rngFor(_f.lons, _g.lons)); } catch (_) { p.gapCI = null; }
        return p;
    });
}

/**
 * BAS-rang (BAS-ordningen är fast, se §5 i teknisk-plan.md): bokstavens plats i alfabetet, A=1, B=2 … Varje bokstav är ett lika brett
 * poängintervall i BAS-systemet, så ett BAS-steg är alltid ett intervall — B → D är två steg
 * även när C saknas i underlaget. Samma rang används av regressionerna och Lägre krav.
 * Något som inte är en bokstav läggs alfabetiskt efter bokstäverna.
 * @param {string[]} allaBas - BAS-värdena i underlaget (behövs bara för det som inte är bokstäver)
 * @returns {(bas:string) => number}
 */
function basRangFn(allaBas) {
    const alfa = [...new Set(allaBas)].sort((a, b) => String(a).localeCompare(String(b), 'sv'));
    return b => { const i = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.indexOf(String(b).toUpperCase()); return String(b).length === 1 && i >= 0 ? i + 1 : 100 + alfa.indexOf(b); };
}

/**
 * Orkestrator — speglar app.js `computeLikvardighetPairs()` (utan state).
 *
 * @param {Object} [input]
 * @param {Array} [input.data] - organisationens individdata
 * @param {Array} [input.statistik] - jämförelsestatistiken
 * @param {((aid:string)=>({kvAndel:number}|null))|null} [input.scbKlass]
 * @param {Object} [input.opts] - { kvinnoTrosholdPct, minGapPct, topN, B, rng, k, aldersGolv }
 * @returns {{orgKvDom:Array, orgIckeKv:Array, statIckeKv:Array, pairs:Array, lagreKrav:Array, diagnostik:Object, opts:Object}}
 */
function computeLikvardighetPairs({ data = [], statistik = [], scbKlass = null, opts = {} } = {}) {
    const kvinnoThr = opts.kvinnoTrosholdPct ?? KVINNO_TROSKEL_DEFAULT;
    const minGap = opts.minGapPct ?? 0;
    const topN = opts.topN ?? 100;
    const B = opts.B ?? 1000;
    // Skickas vidare ORÖRT: byggPar seedar per par ur parets egna löner när
    // ingen rng anges. Ett `?? Math.random` här hade satt opts.rng i varje
    // anrop och tyst slagit ut den seedningen — konfidensintervallen blev då
    // nya vid varje körning, vilket gör ett exporterat underlag omöjligt att
    // återskapa. Bara tester injicerar en egen rng.
    const rng = opts.rng;

    const poangByKey = opts.poangByKey || null;   // #5: arbetsvärdering som krav-proxy
    const bandPct = opts.poangBandPct ?? 5;
    const golv = opts.aldersGolv ?? ALDERS_GOLV_DEFAULT;   // minsta jämförelseyrke för åldersjusteringen

    // k-tröskeln används bara för att RÄKNA små kvinnodominerade grupper i diagnostiken (de ingår ändå).
    const s1 = aggregeraOrgKvDom(data, kvinnoThr, opts.k ?? 10);
    const s2 = klassificeraStatistik(statistik, scbKlass);
    const internByBas = orgIckeKvByBas(s1.orgIckeKv);
    const s3 = (poangByKey && poangByKey.size)
        ? byggParPoäng(s1.orgKvDom, s1.orgIckeKv, s2.statIckeKv, poangByKey, { minGap, topN, B, rng, bandPct, golv })
        : byggPar(s1.orgKvDom, internByBas, s2.statByBas, { minGap, topN, B, rng, golv });
    const lagreKrav = (poangByKey && poangByKey.size) ? [] : byggParLagreKrav(s1.orgKvDom, s1.orgIckeKv, {
        rang: basRangFn([...s1.orgKvDom, ...s1.orgIckeKv].map(g => g.bas)),
        minGap, topN, B, rng });

    return {
        orgKvDom: s1.orgKvDom,
        orgIckeKv: s1.orgIckeKv,
        statIckeKv: s2.statIckeKv,
        pairs: s3.pairs,
        lagreKrav,
        diagnostik: {
            organisation: {
                totalRader: data.length,
                antalAidxBas: s1.antalAidxBas,
                kvDomFunna: s1.orgKvDom.length,
                kvDomMedNLessThanK: s1.kvDomMedNLessThanK,
                ickeKvFunna: s1.orgIckeKv.length
            },
            statistik: {
                totalRader: statistik.length,
                klass: s2.klass,
                klassKalla: s2.klassKalla
            },
            jämförelse: s3.jämförelse,
            fel: []
        },
        opts: { kvinnoTrosholdPct: kvinnoThr, minGapPct: minGap, topN }
    };
}

    return { computeLikvardighetPairs, basRangFn };
})();
const _lvComputePairs = __mirrorLikvardighet.computeLikvardighetPairs;
const _lvBasRangFn = __mirrorLikvardighet.basRangFn;

// ---- speglar src/lib/regression.js ----
const __mirrorRegression = (() => {
    // importer ur tidigare speglade lib-moduler
    const fitOLS = __mirrorStat.fitOLS;
    const invert = __mirrorStat.invert;
    const matMul = __mirrorStat.matMul;
    const pValue2Sided = __mirrorStat.pValue2Sided;
    const tQuantile = __mirrorStat.tQuantile;
    const basRangFn = __mirrorLikvardighet.basRangFn;

// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
/**
 * Öppen lönekartläggning — Regressionsmodeller för lika arbete
 *
 * Rena, testbara modeller: OLS-baserad kollinearitetsdiagnos, gap per BAS
 * (betingade regressioner), sekventiell dekomponering med BAS-indikatorer och
 * yrkesgrupp inom BAS, kvantilregression (IRLS) samt Blinder-Oaxaca-
 * dekomposition. Modellerna tar allt de behöver som parametrar (rader, listor,
 * statGolv-värdet och BAS-rangfunktionen) och läser inget globalt tillstånd.
 *
 * Appen får dem genom lib-speglarna (ADR-8); src/app/50-regressionsmodeller.js
 * är den tunna adaptern som läser getData() och statGolv(). OLS-kärnan
 * (fitOLS, invert, matMul, pValue2Sided, tQuantile) ligger i stat.js och
 * BAS-rangen (basRangFn) i likvardighet.js.
 *
 * @see 50-regressionsmodeller.js (adaptern i appen)
 */



// Diagnostiserar varför modellen misslyckas
function diagnoseCollinearity(rows, basList) {
    const issues = [];
    // Helt enkönade BAS
    let singleSexBas = 0;
    basList.forEach(b => {
        const sub = rows.filter(d => d.bas === b);
        if (sub.length < 3) return;
        const hasKv = sub.some(d => d.kon.includes('kvinna'));
        const hasMa = sub.some(d => d.kon === 'man' || d.kon === 'män');
        if (!hasKv || !hasMa) singleSexBas++;
    });
    if (singleSexBas > 0) issues.push(`<strong>${singleSexBas}</strong> BAS-intervall är helt enkönade – könseffekten kan inte estimeras inom dessa.`);
    if (basList.length < 2) issues.push(`Endast <strong>${basList.length}</strong> BAS-intervall i urvalet – ingen variation att estimera BAS-effekten med.`);
    if (rows.length < 50)  issues.push(`Litet urval (n=${rows.length}) – kan ge instabila estimat.`);
    return issues;
}

// Per-BAS conditional regressions: gap inom varje BAS efter ålderskontroll.
// golv = statGolv(): minsta antal per kön i en BAS för att en regression ska köras.
function computePerBasGap(rows, basList, { golv }) {
    // Modellen tar log(lön) och kodar kön binärt. Rader utan positiv lön ger
    // -Infinity, rader utan ålder skevar centreringen, och rader med okänt kön
    // skulle räknas som MÄN av `kon.includes('kvinna') ? 1 : 0`. Filtret hör
    // därför hemma här i stället för hos anroparen — av tre anropare skickade
    // två in ofiltrerad getData() (JPA-exporten och gruppdossiern).
    const giltiga = (rows || []).filter(d => d && d.lon > 0 && d.alder > 0
        && typeof d.kon === 'string'
        && (d.kon.includes('kvinna') || d.kon === 'man' || d.kon === 'män'));
    const out = [];
    basList.forEach(b => {
        const sub = giltiga.filter(d => d.bas === b);
        const kv  = sub.filter(d => d.kon.includes('kvinna'));
        const ma  = sub.filter(d => d.kon === 'man' || d.kon === 'män');
        if (kv.length < golv || ma.length < golv) {
            out.push({ bas: b, n: sub.length, kvN: kv.length, maN: ma.length, status: 'too_few' });
            return;
        }
        const aMean = sub.reduce((s,d)=>s+d.alder,0)/sub.length;
        const X = sub.map(d => [1, d.kon.includes('kvinna')?1:0, d.alder - aMean]);
        const y = sub.map(d => Math.log(d.lon));
        const fit = fitOLS(X, y);
        if (!fit) { out.push({ bas: b, n: sub.length, kvN: kv.length, maN: ma.length, status: 'singular' }); return; }
        const beta = fit.beta[1];
        const se   = Math.sqrt(fit.vcovHC3[1][1]); // HC3 robust SE
        const p    = pValue2Sided(beta/se, fit.n, fit.k);
        const tq   = tQuantile(0.975, fit.n - fit.k);   // t-kvantil för 95 % KI (1,96 vid df ≥ 100)
        const ciLo = (Math.exp(beta - tq*se) - 1) * 100;
        const ciHi = (Math.exp(beta + tq*se) - 1) * 100;
        out.push({ bas: b, n: sub.length, kvN: kv.length, maN: ma.length, gapPct: (Math.exp(beta)-1)*100, ciLow: ciLo, ciHigh: ciHi, pValue: p, R2: fit.R2, status: 'ok' });
    });
    return out;
}

// Sekventiell dekomponering: visa hur gapet krymper när kontroller läggs till
// BAS kodas som indikatorvariabler (en kolumn per BAS-intervall utom det första, som är referens),
// så att varje intervall får sin egen nivå — ingen antagen lika stor löneskillnad per bokstav.
function basIndikatorer(basList) {
    return basList.slice(1);
}

// golv = statGolv(): minsta antal per kön för att ett ansvarssteg ska redovisas.
function computeSequentialGap(rows, ageMean, basList, { golv }) {
    const N = rows.length;
    const y    = rows.map(d => Math.log(d.lon));
    const isKv = rows.map(d => d.kon.includes('kvinna') ? 1 : 0);
    const ageC = rows.map(d => d.alder - ageMean);
    const basInd = basIndikatorer(basList);
    const basD = rows.map(d => basInd.map(b => (d.bas === b ? 1 : 0)));

    const buildX = (incAge, incBas) => rows.map((d,i) => {
        const r = [1, isKv[i]];
        if (incAge) r.push(ageC[i]);
        if (incBas) r.push(...basD[i]);
        return r;
    });

    // Ordning: först rensa BAS-effekten (strukturell placering), sedan ålder.
    // Detta speglar att BAS är den primära strukturella förklaringen — först ser vi
    // hur mycket av gapet som beror på olika BAS-fördelning, sedan vad som kvarstår
    // när även ålder rensas bort.
    const steps = [
        { name: 'Endast kön',         X: buildX(false, false) },
        { name: '+ BAS-intervall',    X: buildX(false, true)  },
        { name: '+ Ålder',            X: buildX(true,  true)  }
    ];
    // Ansvar (ansvarskod) som eget sista steg: en indikator per ansvarsgrupp med minst k personer;
    // mindre grupper räknas med "inget". Redovisas separat, inte i huvudtalet (ADR-33).
    const grupper = ['ledning', 'uppdrag'].filter(g => rows.filter(r => r.ansvarsgrupp === g).length >= golv);
    if (rows.some(r => r.ansvarsgrupp) && grupper.length) {
        steps.push({ name: '+ Ansvar', X: rows.map((d, i) => [1, isKv[i], ageC[i], ...basD[i],
            ...grupper.map(g => (d.ansvarsgrupp === g ? 1 : 0))]) });
    }

    /** @type {Array<{name:string, status:string, gapPct?:number, R2?:number, k?:number, nGrupper?:number, nGrupperBada?:number, nPersoner?:number, nEnkonade?:number}>} */
    const ut = steps.map(s => {
        if (N < s.X[0].length + 5) return { name: s.name, status: 'too_few' };
        const fit = fitOLS(s.X, y);
        if (!fit) return { name: s.name, status: 'singular' };
        return {
            name: s.name,
            status: 'ok',
            gapPct: (Math.exp(fit.beta[1]) - 1) * 100,
            R2: fit.R2,
            k: fit.k
        };
    });
    // Yrkesgrupp inom BAS som sista steg (ADR-46): läggs efter + Ålder, före + Ansvar.
    const ansvarIdx = ut.findIndex(s => s.name === '+ Ansvar');
    ut.splice(ansvarIdx < 0 ? ut.length : ansvarIdx, 0, computeYrkesgruppGap(rows, y, isKv, ageC));
    return ut;
}

/**
 * Steget "+ Yrkesgrupp": könsgapet efter fasta effekter för yrkesgrupp inom BAS (AID×BAS),
 * utöver ålder — löneskillnaden mellan kvinnor och män med samma yrkesgrupp, BAS och ålder.
 *
 * Skattas med inomtransformation (within-estimator): gruppmedelvärdet dras av från log-lön,
 * kön och ålder inom varje AID×BAS-grupp, och OLS körs utan intercept på de transformerade
 * variablerna. Det ger exakt samma könskoefficient som en indikator per grupp skulle ge
 * (Frisch–Waugh–Lovell), men går på 55 000 rader utan en designmatris med hundratals
 * kolumner. R² räknas mot den otransformerade lönens totala variation, så att den är
 * jämförbar med stegen före.
 *
 * Grupper med färre än statGolv() av något kön ingår i skattningen — gruppmedelvärdet är
 * ett mellanled, inte ett redovisat värde — men bara grupper med båda könen bidrar till
 * könskoefficienten (i en enkönad grupp är det transformerade könet noll). Antalet grupper
 * och personer steget bygger på följer med i resultatet.
 * Gruppnyckeln är AID-koden (eller yrket när AID saknas) inom BAS, samma som § 3:10-motorn.
 * Modellen läser ingen golv-gräns, så den tar inte emot golv (statGolv används bara i ansvarssteget).
 * @returns {{name:string, status:string, gapPct?:number, R2?:number, k?:number,
 *           nGrupper?:number, nGrupperBada?:number, nPersoner?:number, nEnkonade?:number}}
 */
function computeYrkesgruppGap(rows, y, isKv, ageC) {
    const name = '+ Yrkesgrupp';
    const N = rows.length;
    if (!rows.some(d => d.aid || d.yrke)) return { name, status: 'too_few', nGrupper: 0, nGrupperBada: 0, nPersoner: 0, nEnkonade: 0 };
    const nyckel = d => `${(d.aid || d.yrke || '').toString().trim()}|${d.bas ?? ''}`;
    const grupper = new Map();   // nyckel → { n, sy, sk, sa, kv, ma }
    const key = new Array(N);
    for (let i = 0; i < N; i++) {
        const k = nyckel(rows[i]); key[i] = k;
        let g = grupper.get(k);
        if (!g) { g = { n: 0, sy: 0, sk: 0, sa: 0, kv: 0, ma: 0 }; grupper.set(k, g); }
        g.n++; g.sy += y[i]; g.sk += isKv[i]; g.sa += ageC[i];
        if (isKv[i]) g.kv++; else g.ma++;
    }
    let nGrupperBada = 0, nPersoner = 0;
    grupper.forEach(g => { if (g.kv > 0 && g.ma > 0) { nGrupperBada++; nPersoner += g.n; } });
    const meta = { nGrupper: grupper.size, nGrupperBada, nPersoner, nEnkonade: grupper.size - nGrupperBada };
    // Frihetsgrader: två lutningar plus en nivå per grupp
    if (N < grupper.size + 2 + 5 || nGrupperBada === 0) return { name, status: 'too_few', ...meta };
    const X = new Array(N), yW = new Array(N);
    for (let i = 0; i < N; i++) {
        const g = grupper.get(key[i]);
        X[i] = [isKv[i] - g.sk / g.n, ageC[i] - g.sa / g.n];
        yW[i] = y[i] - g.sy / g.n;
    }
    const fit = fitOLS(X, yW);
    if (!fit) return { name, status: 'singular', ...meta };
    const yMedel = y.reduce((s, v) => s + v, 0) / N;
    let tss = 0; for (let i = 0; i < N; i++) tss += (y[i] - yMedel) ** 2;
    return {
        name, status: 'ok',
        gapPct: (Math.exp(fit.beta[0]) - 1) * 100,
        R2: tss > 0 ? 1 - fit.rss / tss : 0,
        k: 2 + grupper.size,
        ...meta
    };
}

/**
 * Kvantilregression via IRLS (Iteratively Reweighted Least Squares).
 * Estimerar τ:te kvantilen istället för medelvärdet. Ger insyn i hur lönegapet
 * beter sig i olika delar av lönefördelningen ("glasstaket" vs "klistergolvet").
 * Startvärde tas från OLS för snabb konvergens. eps = 1e-6 hindrar division-med-noll
 * när residual ≈ 0.
 * @param {number[][]} X - n×k designmatris.
 * @param {number[]} y - n-vektor (typiskt log(lön)).
 * @param {number} tau - Kvantil ∈ (0,1), t.ex. 0.5 för median, 0.9 för P90.
 * @param {number} [maxIter=60]
 * @param {number} [tol=1e-5]
 * @returns {null | {beta:number[]}} null om n < k+5 eller XtWX singulär.
 */
function quantileRegression(X, y, tau, maxIter = 60, tol = 1e-5) {
    const n = X.length, k = X[0].length;
    if (n < k + 5) return null;
    // Starta från OLS för snabb konvergens
    const olsFit = fitOLS(X, y);
    if (!olsFit) return null;
    let beta = olsFit.beta.slice();
    const eps = 1e-6;
    for (let iter = 0; iter < maxIter; iter++) {
        const yhat = X.map(row => row.reduce((s, v, i) => s + v * beta[i], 0));
        const w = new Array(n);
        for (let i = 0; i < n; i++) {
            const r = y[i] - yhat[i];
            const wTau = r >= 0 ? tau : (1 - tau);
            w[i] = wTau / Math.max(Math.abs(r), eps);
        }
        // Lös WLS: β = (X' W X)^-1 X' W y
        const XtWX = Array.from({ length: k }, () => new Array(k).fill(0));
        const XtWy = new Array(k).fill(0);
        for (let i = 0; i < n; i++) {
            const wi = w[i], xi = X[i], yi = y[i];
            for (let a = 0; a < k; a++) {
                XtWy[a] += wi * xi[a] * yi;
                for (let b = 0; b < k; b++) XtWX[a][b] += wi * xi[a] * xi[b];
            }
        }
        const inv = invert(XtWX);
        if (!inv) return null;
        const newBeta = matMul(inv, XtWy.map(v => [v])).map(r => r[0]);
        // Konvergens-check
        let delta = 0;
        for (let i = 0; i < k; i++) delta += Math.abs(newBeta[i] - beta[i]);
        beta = newBeta;
        if (delta < tol) break;
    }
    return { beta };
}

/**
 * Blinder-Oaxaca-dekomposition (Blinder 1973, Oaxaca 1973).
 *
 * Bryter ned rågapet i ln(lön) mellan män och kvinnor i tre komponenter:
 *
 *   ΔÄ = (X̄_M − X̄_F) · β_F   +   X̄_F · (β_M − β_F)   +   (X̄_M − X̄_F) · (β_M − β_F)
 *        ──────── Endowment ────   ──── Coefficient ────   ────── Interaction ──────
 *
 * "Endowment" = skillnaden förklaras av att män och kvinnor har olika
 *    karakteristika (ålder, BAS-fördelning) värderade till kvinnornas
 *    avkastning. Detta är den "förklarade" delen.
 * "Coefficient" = män får olika avkastning på samma karakteristika.
 *    Detta är den klassiskt "diskrimineringsindikerande" delen.
 * "Interaction" = samspel mellan skillnader i karakteristika och
 *    skillnader i avkastning. Mindre lätt att tolka — räknas vanligen
 *    som "oförklarat" i en tredelad uppdelning.
 *
 * Klassisk presentation:
 *   Förklarat   = Endowment
 *   Oförklarat  = Coefficient + Interaction
 *
 * Standardpresentation i akademiska och
 * offentliga utredningar (Medlingsinstitutet använder denna form).
 *
 * Modell: ln(lön) ~ ålder (centrerad) + BAS-rang (centrerad)
 * — körs separat för kvinnor respektive män.
 *
 * BAS behålls här som linjär rang (bokstavens plats), till skillnad från huvudregressionen
 * och den sekventiella dekomponeringen som använder indikatorvariabler: med en indikator
 * per BAS skulle uppdelningen per komponent (endowment/coefficient/interaction) spridas
 * över ett dussin kolumner och bli otydlig att redovisa. Avsiktligt orört.
 *
 * @param {any[]} rows - råradernas poster; filtreras här på lön, ålder och kön.
 * @param {{golv:number, rang?:(basList:string[]) => (bas:string) => number}} opts
 *   golv = statGolv(); rang = BAS-rangfunktionen (standard basRangFn ur likvardighet.js).
 * @returns {null | {
 *   rawGapPct:number, explainedPct:number, unexplainedPct:number,
 *   endowmentPct:number, coefficientPct:number, interactionPct:number,
 *   components:{age:{q,u,i}, bas:{q,u,i}, intercept:{q,u,i}},
 *   n:number, nKv:number, nMa:number,
 *   _raw:{rawGapLog:number, q:number, u:number, i:number}
 * }}
 */
function blinderOaxaca(rows, { golv, rang = basRangFn }) {
    const raw = rows.filter(d => d.lon > 0 && d.alder > 0 &&
        (d.kon.includes('kvinna') || d.kon === 'man' || d.kon === 'män'));
    if (raw.length < 50) return null;
    const kv = raw.filter(d => d.kon.includes('kvinna'));
    const ma = raw.filter(d => d.kon === 'man' || d.kon === 'män');
    if (kv.length < golv || ma.length < golv) return null;

    // Bygg basRank på poolad data (samma som huvudregression).
    const basList = [...new Set(raw.map(d => d.bas))].sort();
    const basRank = {};
    // BAS-rang = bokstavens plats (A=1); ett steg är alltid ett BAS-intervall (se §5 i teknisk-plan.md).
    const rangFn = rang(basList);
    basList.forEach(b => { basRank[b] = rangFn(b); });
    const ranks = basList.map(b => basRank[b]);
    const basMean = ranks.reduce((s, r) => s + r, 0) / ranks.length;
    const ageMean = raw.reduce((s, d) => s + d.alder, 0) / raw.length;

    // Designmatris för en grupp G: X = [1, ålder − ageMean, basRank − basMean]
    const buildXy = group => {
        const X = group.map(d => [1, d.alder - ageMean, (basRank[d.bas] || basMean) - basMean]);
        const y = group.map(d => Math.log(d.lon));
        return { X, y };
    };
    const xyKv = buildXy(kv), xyMa = buildXy(ma);
    const fitKv = fitOLS(xyKv.X, xyKv.y);
    const fitMa = fitOLS(xyMa.X, xyMa.y);
    if (!fitKv || !fitMa) return null;

    // Gruppmedelvärden för X (X̄)
    const meanX = group => {
        const k = 3;
        const out = new Array(k).fill(0);
        for (const d of group) {
            out[0] += 1;
            out[1] += d.alder - ageMean;
            out[2] += (basRank[d.bas] || basMean) - basMean;
        }
        return out.map(v => v / group.length);
    };
    const xKv = meanX(kv), xMa = meanX(ma);

    // Predikterad ln(lön) per grupp = X̄ · β
    const dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0);
    const lnKv = dot(xKv, fitKv.beta);
    const lnMa = dot(xMa, fitMa.beta);
    const rawGapLog = lnMa - lnKv;

    // Dekomposition per komponent (intercept, ålder, BAS-rank)
    const labels = /** @type {const} */ (['intercept', 'age', 'bas']);
    /** @type {{intercept:{q:number,u:number,i:number}, age:{q:number,u:number,i:number}, bas:{q:number,u:number,i:number}}} */
    const components = { intercept: { q: 0, u: 0, i: 0 }, age: { q: 0, u: 0, i: 0 }, bas: { q: 0, u: 0, i: 0 } };
    let qSum = 0, uSum = 0, iSum = 0;
    for (let k = 0; k < 3; k++) {
        const dx = xMa[k] - xKv[k];          // skillnad i karakteristika
        const db = fitMa.beta[k] - fitKv.beta[k];  // skillnad i koefficient
        const q = dx * fitKv.beta[k];        // endowment
        const u = xKv[k] * db;               // coefficient
        const i = dx * db;                   // interaction
        components[labels[k]] = { q, u, i };
        qSum += q; uSum += u; iSum += i;
    }
    // Kontroll: qSum + uSum + iSum ≈ rawGapLog
    // (avvikelse ~1e-10 förväntas pga floating point)

    // Konvertera log-komponenter till %-skillnad: (exp(c) − 1) × 100
    const pct = c => (Math.exp(c) - 1) * 100;

    return {
        rawGapPct: pct(rawGapLog),
        endowmentPct: pct(qSum),
        coefficientPct: pct(uSum),
        interactionPct: pct(iSum),
        explainedPct: pct(qSum),
        unexplainedPct: pct(uSum + iSum),
        components,
        n: raw.length, nKv: kv.length, nMa: ma.length,
        // Råa log-värden för exakt summa-verifiering i tester
        _raw: { rawGapLog, q: qSum, u: uSum, i: iSum }
    };
}

/**
 * Kör kvantilregression vid τ ∈ {.10, .50, .90} på samma kontrollvariabler
 * (kön + ålder + BAS-rank) och returnerar löneskillnaden i kr-procent vid varje kvantil.
 * Används för glasstak-/klistergolvsanalys i UI:t.
 * @param {any[]} rows - råradernas poster; filtreras här på lön, ålder och kön.
 * @param {{rang?:(basList:string[]) => (bas:string) => number}} [opts] rang = BAS-rangfunktionen
 *   (standard basRangFn ur likvardighet.js).
 * @returns {null | {results:Array<{tau:number, konPct?:number, error?:true}>, n:number}}
 *   null om N<50 eller för få BAS-intervall.
 */
function quantileRegressionAtAllTau(rows, { rang = basRangFn } = {}) {
    const raw = rows.filter(d => d.lon > 0 && d.alder > 0 && (d.kon.includes('kvinna') || d.kon === 'man' || d.kon === 'män'));
    if (raw.length < 50) return null; // för litet urval för stabil quantile regression
    const basList = [...new Set(raw.map(d => d.bas))].sort();
    if (basList.length < 1) return null;
    const basRank = {};
    // BAS-rang = bokstavens plats (A=1); ett steg är alltid ett BAS-intervall (se §5 i teknisk-plan.md).
    const rangFn = rang(basList);
    basList.forEach(b => { basRank[b] = rangFn(b); });
    const ranks = basList.map(b => basRank[b]);
    const basMean = ranks.reduce((s, r) => s + r, 0) / ranks.length;
    const ageMean = raw.reduce((s, d) => s + d.alder, 0) / raw.length;
    const X = raw.map(d => [1, d.kon.includes('kvinna') ? 1 : 0, d.alder - ageMean, basRank[d.bas] - basMean]);
    const y = raw.map(d => Math.log(d.lon));
    const taus = [0.1, 0.5, 0.9];
    const results = [];
    for (const tau of taus) {
        const fit = quantileRegression(X, y, tau);
        if (!fit) { results.push({ tau, error: true }); continue; }
        const betaKon = fit.beta[1];
        const pct = (Math.exp(betaKon) - 1) * 100;
        results.push({ tau, konPct: pct });
    }
    return { results, n: raw.length };
}

    return { diagnoseCollinearity, computePerBasGap, basIndikatorer, computeSequentialGap, quantileRegression, blinderOaxaca, quantileRegressionAtAllTau };
})();
const _rgDiagnoseCollinearity = __mirrorRegression.diagnoseCollinearity;
const _rgComputePerBasGap = __mirrorRegression.computePerBasGap;
const _rgBasIndikatorer = __mirrorRegression.basIndikatorer;
const _rgComputeSequentialGap = __mirrorRegression.computeSequentialGap;
const _rgQuantileRegression = __mirrorRegression.quantileRegression;
const _rgBlinderOaxaca = __mirrorRegression.blinderOaxaca;
const _rgQuantileRegressionAtAllTau = __mirrorRegression.quantileRegressionAtAllTau;

// ---- speglar src/lib/lonepolitik.js ----
const __mirrorLonepolitik = (() => {
// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
/**
 * Öppen lönekartläggning — Lönepolitiskt ställningstagande (ren kärna)
 *
 * Rena funktioner för att analysera organisationens löneläge mot det EGNA
 * lönepolitiska ställningstagandet (P10/Median/P90 per BAS och/eller AID).
 * Separat från app.js för att kunna testas via Vitest utan DOM/state; app.js
 * får en AUTO-GENERERAD spegel (`_lp*` i src/app/09-lib-speglar.js via
 * tools/gen-mirrors.mjs) — ändra här och kör `npm run build:app`, rör ej
 * spegeln (vaktas av tests/drift.test.js).
 *
 * Själva uppslaget (vilken policyrad som gäller för en grupp) görs av
 * policyFor() i app.js, eftersom det läser state. Här hanteras bara matematiken
 * när bandet väl är känt.
 *
 * Maskeringstrappan (tre steg, se `src/app/75-lonepolitik.js`) tillämpas av anroparen; de här
 * funktionerna räknar på det de får och rapporterar n så att anroparen kan
 * maskera.
 */

function _lpMedian(arr) {
    if (!arr || !arr.length) return 0;
    const s = arr.slice().sort((a, b) => a - b);
    const m = Math.floor(s.length / 2);
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

// Linjär interpolation mellan närmaste rangvärden (samma definition som stat.quantile).
function _lpQuantile(sorted, q) {
    const pos = (sorted.length - 1) * q;
    const lo = Math.floor(pos), hi = Math.ceil(pos);
    return lo === hi ? sorted[lo] : sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

/**
 * Organisationens faktiska lönespann i en grupp (P10, median, P90) — jämförs med
 * referensens band i bandkartan. Percentiler kräver minst k personer; annars null.
 * @returns {null|{n:number, p10:number, med:number, p90:number}}
 */
function organisationsBand(rows, k) {
    const lons = (rows || []).map(r => r.lon).filter(v => v > 0).sort((a, b) => a - b);
    if (lons.length < k) return null;
    return { n: lons.length, p10: _lpQuantile(lons, 0.1), med: _lpMedian(lons), p90: _lpQuantile(lons, 0.9) };
}

function _lpIsKvinna(r) {
    return typeof r.kon === 'string' && r.kon.includes('kvinna');
}
function _lpIsMan(r) {
    return r.kon === 'man' || r.kon === 'män';
}

/**
 * Var i sitt eget lönespann ligger en lön?
 *
 * 0 = exakt på P10, 1 = exakt på P90. Värdet klämms INTE till [0,1] — ett
 * resultat < 0 betyder "under policyns golv" och > 1 "över policyns tak", och
 * det är just den informationen analysen finns till för. Anroparen klämmer vid
 * behov för ritning.
 *
 * Returnerar null när bandet inte är användbart (saknade eller icke-positiva
 * gränser, eller P90 ≤ P10 — då är positionsmåttet odefinierat/instabilt).
 *
 * @param {number} lon
 * @param {number} p10
 * @param {number} p90
 * @returns {number|null}
 */
function bandPosition(lon, p10, p90) {
    if (!(lon > 0) || !(p10 > 0) || !(p90 > 0)) return null;
    if (p90 <= p10) return null;
    return (lon - p10) / (p90 - p10);
}

/**
 * Sammanfattar en grupp mot sitt band.
 * @param {Array<{lon:number, kon?:string}>} rows
 * @param {{p10:number, med:number, p90:number}} pol
 * @returns {null|{n:number, median:number, position:number|null, medianVsPolicyPct:number|null, p10:number, med:number, p90:number}}
 */
function groupBandStats(rows, pol) {
    if (!Array.isArray(rows) || !rows.length || !pol) return null;
    const lons = rows.map(r => r.lon).filter(v => v > 0);
    if (!lons.length) return null;
    const median = _lpMedian(lons);
    return {
        n: lons.length,
        median,
        position: bandPosition(median, pol.p10, pol.p90),
        medianVsPolicyPct: pol.med > 0 ? ((median / pol.med) - 1) * 100 : null,
        p10: pol.p10, med: pol.med, p90: pol.p90
    };
}

/**
 * Hur många individer ligger under golvet, inom bandet respektive över taket?
 * Kräver positiva P10/P90; annars null.
 * @returns {null|{n:number, under:number, within:number, over:number, underPct:number, overPct:number}}
 */
function complianceCounts(rows, pol) {
    if (!Array.isArray(rows) || !rows.length || !pol) return null;
    if (!(pol.p10 > 0) || !(pol.p90 > 0)) return null;
    // Samma kontroll som bandPosition: ett inverterat band (P10 >= P90) är
    // malformerad policydata. Utan den skulle varje individ hamna i "under"
    // eller "över" och "inom spann" alltid bli 0 — ett tyst, trovärdigt fel.
    if (pol.p90 <= pol.p10) return null;
    let under = 0, over = 0, n = 0;
    for (const r of rows) {
        if (!(r.lon > 0)) continue;
        n++;
        if (r.lon < pol.p10) under++;
        else if (r.lon > pol.p90) over++;
    }
    if (!n) return null;
    return {
        n, under, over, within: n - under - over,
        underPct: (under / n) * 100,
        overPct: (over / n) * 100
    };
}

/**
 * Könsskillnad i bandposition — analysens kärnfråga: placeras kvinnor lägre i
 * SAMMA lönespann än män?
 *
 * Kräver minst `minPerKon` av varje kön (k-anonymitet + meningsfullhet).
 * diff > 0 betyder att kvinnor i snitt ligger HÖGRE i bandet än män;
 * diff < 0 att de ligger lägre.
 *
 * @param {Array<{lon:number, kon:string}>} rows
 * @param {{p10:number, p90:number}} pol
 * @param {number} [minPerKon=10]
 * @returns {null|{nKv:number, nMa:number, kvPos:number, maPos:number, diff:number}}
 */
function genderBandGap(rows, pol, minPerKon = 10) {
    if (!Array.isArray(rows) || !pol) return null;
    const posOf = r => bandPosition(r.lon, pol.p10, pol.p90);
    const kv = rows.filter(_lpIsKvinna).map(posOf).filter(v => v != null);
    const ma = rows.filter(_lpIsMan).map(posOf).filter(v => v != null);
    if (kv.length < minPerKon || ma.length < minPerKon) return null;
    const mean = a => a.reduce((s, v) => s + v, 0) / a.length;
    const kvPos = mean(kv), maPos = mean(ma);
    return { nKv: kv.length, nMa: ma.length, kvPos, maPos, diff: kvPos - maPos };
}

/**
 * Kostnad för att lyfta alla under golvet upp till policyns P10.
 * Returnerar månadsbelopp (exkl. PO) — anroparen lägger på PO-påslag och
 * beräkningsperiod från state.costSettings, som i Löneöversyn.
 * @returns {null|{nAffected:number, totalMonth:number}}
 */
function costToFloor(rows, pol) {
    if (!Array.isArray(rows) || !pol || !(pol.p10 > 0)) return null;
    // Golvet ensamt är meningsfullt även utan tak, men ett ANGIVET tak under
    // golvet betyder att bandet är felvänt — räkna då inte på det.
    if (pol.p90 > 0 && pol.p90 <= pol.p10) return null;
    let nAffected = 0, totalMonth = 0;
    for (const r of rows) {
        if (!(r.lon > 0)) continue;
        if (r.lon < pol.p10) { nAffected++; totalMonth += pol.p10 - r.lon; }
    }
    return { nAffected, totalMonth };
}

/**
 * Täckningsgrad: hur stor del av personalen omfattas över huvud taget av en
 * policyrad? En ofullständig policyfil får inte se ut som ett gott resultat —
 * "inga avvikelser" kan betyda "ingen referens".
 *
 * @param {Array<{n:number, hasPolicy:boolean}>} groups
 * @returns {{groupsTotal:number, groupsCovered:number, personsTotal:number, personsCovered:number, personsPct:number}}
 */
function policyCoverage(groups) {
    const g = Array.isArray(groups) ? groups : [];
    let personsTotal = 0, personsCovered = 0, groupsCovered = 0;
    for (const x of g) {
        const n = x && x.n > 0 ? x.n : 0;
        personsTotal += n;
        if (x && x.hasPolicy) { groupsCovered++; personsCovered += n; }
    }
    return {
        groupsTotal: g.length,
        groupsCovered,
        personsTotal,
        personsCovered,
        personsPct: personsTotal ? (personsCovered / personsTotal) * 100 : 0
    };
}

    return { bandPosition, groupBandStats, complianceCounts, genderBandGap, costToFloor, policyCoverage, organisationsBand };
})();
const _lpBandPosition = __mirrorLonepolitik.bandPosition;
const _lpGroupBandStats = __mirrorLonepolitik.groupBandStats;
const _lpComplianceCounts = __mirrorLonepolitik.complianceCounts;
const _lpGenderBandGap = __mirrorLonepolitik.genderBandGap;
const _lpCostToFloor = __mirrorLonepolitik.costToFloor;
const _lpPolicyCoverage = __mirrorLonepolitik.policyCoverage;
const _lpOrganisationsBand = __mirrorLonepolitik.organisationsBand;

// ---- speglar src/lib/prioritering.js ----
const __mirrorPrioritering = (() => {
    // importer ur tidigare speglade lib-moduler
    const median = __mirrorStat.median;

// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
/**
 * Öppen lönekartläggning — Prioriteringsanalys (ren modell)
 *
 * Grupperar raderna per yrke × BAS, beräknar median, könsmedianer (med k-regeln, ADR-12),
 * avvikelse mot en referens, åtgärdskostnad (inkl. PO-påslag och beräkningsperiod),
 * status mot trösklar, snabbvinst, bristyrke och det sammanvägda prioriteringsindexet.
 *
 * Modellen tar allt den behöver som parametrar och läser inget globalt tillstånd.
 * Referensen kommer utifrån som funktionen referensFor(aid, bas), så samma modell
 * används för både ställningstagandet och jämförelsestatistiken.
 *
 * Appen får modellen genom lib-speglarna (ADR-8); computePrioritization() i
 * src/app/55-prioritering.js är den tunna adaptern som läser state.
 */

/**
 * Ett månadsbelopp per person som belopp per år för `antal` personer, med beräkningsperiod och PO-påslag ur
 * kostnadsinställningarna: |belopp| × månader × (1 + PO) × antal. Prioriteringens åtgärdskostnad och
 * gruppdossierns räkneexempel räknar med samma formel.
 * @param {number} kronorPerManad
 * @param {number} antal
 * @param {{months?: number, poPct?: number}|null|undefined} costSettings
 */
function kostnadPerAr(kronorPerManad, antal, costSettings) {
    const months = (costSettings && costSettings.months) || 12;
    const poFactor = 1 + ((costSettings && costSettings.poPct) || 0) / 100;
    return Math.abs(kronorPerManad) * months * poFactor * antal;
}

/**
 * Räkneexemplet om könsskillnaden i en grupp: vad skillnaden i medianlön motsvarar per år
 * för gruppens kvinnor, eller null när kvinnornas median inte ligger minst 100 kr lägre (skillnaden avrundas till
 * hundratal, som i diagrammens verktygstips) eller en median saknas. Anroparen skickar bara medianer som får
 * redovisas (båda könen når tröskeln).
 * @param {{medKv: number, medMa: number, nKv: number}} g
 * @param {{months?: number, poPct?: number}|null|undefined} costSettings
 * @param {(v: number) => string} kr  beloppsformat
 * @returns {string|null}
 */
function arsbeloppMening(g, costSettings, kr) {
    if (!g || !(g.medKv > 0) || !(g.medMa > 0) || !(g.nKv > 0)) return null;
    const diff = Math.round((g.medMa - g.medKv) / 100) * 100;
    if (diff < 100) return null;
    const months = (costSettings && costSettings.months) || 12, po = (costSettings && costSettings.poPct) || 0;
    const belopp = Math.round(kostnadPerAr(diff, g.nKv, costSettings) / 1000) * 1000;
    return `Räkneexempel: kvinnornas medianlön ligger ${kr(diff)} per månad under männens. För gruppens ${g.nKv} kvinnor motsvarar `
        + `det omkring ${kr(belopp)} per år (${months} månader, PO-påslag ${String(po).replace('.', ',')} %). Det är ett räkneexempel, `
        + 'inte en kostnadsbedömning: om skillnaden har sakliga skäl bedömer HR.';
}

/**
 * Prioriteringsindexet för en grupp: riktningsvikt × (avvikelse·vikt + volym·vikt + jämställdhet·vikt),
 * multiplicerat med bristmultiplikatorn. Vikterna normaliseras till summan 100 %.
 * Skala 0–100 (före bristmultiplikatorn).
 *
 * @param {{sevScore:number, volScore:number, gapScore:number, riktningsvikt:number,
 *          bristMultiplier:number, vikter:{avvikelse:number, volym:number, jamstalldhet:number}}} delar
 * @returns {number}
 */
function prioIndex(delar) {
    const { sevScore, volScore, gapScore, riktningsvikt, bristMultiplier, vikter: w } = delar;
    const wTotal = Math.max(1, w.avvikelse + w.volym + w.jamstalldhet);
    return bristMultiplier * riktningsvikt * (
        sevScore * (w.avvikelse    / wTotal) +
        volScore * (w.volym        / wTotal) +
        gapScore * (w.jamstalldhet / wTotal)
    );
}

/**
 * Bygger prioriteringslistan (sorterad på priorityIndex, störst först).
 *
 * @param {Array<{yrke:string, bas:string, kon:string, lon:number}>} rader
 * @param {Object} opt
 * @param {(aid:string, bas:string) => ({median:number, kalla:string}|null)} opt.referensFor
 *        Referensmedian för gruppen, eller null om gruppen saknar referens.
 * @param {number} opt.kTroskel - minsta antal personer per grupp och per kön (ADR-12)
 * @param {{atgardThreshold:number, akutMinN:number, bevakaThreshold:number, analyseraThreshold:number}} opt.prioConfig
 * @param {{avvikelse:number, volym:number, jamstalldhet:number}} opt.prioWeights
 * @param {{months?:number, poPct?:number}} [opt.costSettings]
 * @param {Set<string>} [opt.bristAids] - AID-koder som markerats som bristyrke
 * @returns {Array<Object>}
 */
function prioritera(rader, { referensFor, kTroskel, prioConfig, prioWeights, costSettings, bristAids }) {
    const d = rader || [];
    if (!d.length) return [];

    const groups = {};
    d.forEach(r => {
        const aidM = r.yrke.match(/^(\d+)/);
        const aid  = aidM ? aidM[1] : r.yrke;
        const key  = `${r.yrke}|${r.bas}`;
        if (!groups[key]) groups[key] = { yrke: r.yrke, aid, bas: r.bas, rows: [] };
        groups[key].rows.push(r);
    });

    const items = [];
    Object.values(groups).forEach(g => {
        // GDPR k-anonymitet: kräver minst kTroskel personer per grupp
        if (g.rows.length < kTroskel) return;

        const lons     = g.rows.map(r => r.lon);
        const med      = median(lons);
        const kvLons   = g.rows.filter(r => r.kon.includes('kvinna')).map(r => r.lon);
        const maLons   = g.rows.filter(r => r.kon === 'man' || r.kon === 'män').map(r => r.lon);
        // ADR-12: könsjämförelsen kräver kTroskel personer av vartdera könet; annars bara gruppens samlade median.
        const medKv    = kvLons.length >= kTroskel ? median(kvLons) : null;
        const medMa    = maLons.length >= kTroskel ? median(maLons) : null;
        const gapPct   = (medKv && medMa) ? (medKv/medMa - 1) * 100 : null;

        // Referensvärde (levereras av anroparen)
        const ref = referensFor(g.aid, g.bas);
        const refMedian = ref ? ref.median : null;
        const refSource = ref ? ref.kalla : null;
        if (!refMedian) return; // ingen referens för denna grupp – hoppa över

        const diffPct = ((med / refMedian) - 1) * 100;
        const diffKr  = med - refMedian;
        // Beräkningsperiod + PO-påslag (sociala avgifter + pensioner)
        // Total kostnad för att lyfta gruppen TILL referensen (endast om under), inklusive PO
        const annualGapTotal = diffKr < 0 ? kostnadPerAr(diffKr, g.rows.length, costSettings) : 0;
        // Total överlönekostnad (för "över"-grupper)
        const annualOverTotal = diffKr > 0 ? kostnadPerAr(diffKr, g.rows.length, costSettings) : 0;

        // Prioriteringsindex med konfigurerbara viktningar
        const sevScore  = Math.min(30, Math.abs(diffPct)) / 30 * 100;
        const volScore  = Math.min(50, g.rows.length) / 50 * 100;
        const gapScore  = gapPct !== null ? Math.min(15, Math.abs(gapPct)) / 15 * 100 : 0;
        const directionWeight = diffPct < 0 ? 1.0 : 0.5;
        // E: Bristyrke ger en bonus-multiplikator (1.2x) i prioriteringen
        const isBrist = bristAids && bristAids.has(g.aid);
        const bristMultiplier = isBrist ? 1.2 : 1.0;
        const priorityIndex = prioIndex({
            sevScore, volScore, gapScore, riktningsvikt: directionWeight,
            bristMultiplier, vikter: prioWeights
        });
        // C: Genomsnittlig revision per anställd (kr/månad) — för snabbavläsning
        const costPerPerson = diffKr < 0 ? Math.abs(diffKr) : 0;
        // B: "Snabb vinst"-flagga — liten kostnad/person men signifikant procentuellt lyft
        const isQuickWin = costPerPerson > 0 && costPerPerson < 1500 && Math.abs(diffPct) > 3 && g.rows.length >= 5;

        // Status-kategori (med konfigurerbara tröskelvärden)
        const cfg = prioConfig;
        let status = 'ok';
        if (diffPct < cfg.atgardThreshold && g.rows.length >= cfg.akutMinN) status = 'akut';
        else if (diffPct < cfg.atgardThreshold)                              status = 'atgard';
        else if (diffPct < cfg.bevakaThreshold)                              status = 'bevaka';
        else if (diffPct > cfg.analyseraThreshold)                           status = 'analysera';

        items.push({
            yrke: g.yrke, aid: g.aid, bas: g.bas,
            n: g.rows.length, kvN: kvLons.length, maN: maLons.length,
            median: med, refMedian, refSource,
            diffPct, diffKr, annualGapTotal, annualOverTotal,
            costPerPerson, isQuickWin, isBrist,
            gapPct, medKv, medMa,
            priorityIndex,
            status,
            // #13 Behåll referens till rader för motivation-suggestion-engine.
            // Lättviktig kostnad — rader är samma minimerade objekt som finns i state.data.
            _rows: g.rows
        });
    });

    items.sort((a, b) => b.priorityIndex - a.priorityIndex);
    return items;
}

    return { prioritera, arsbeloppMening };
})();
const _prPrioritera = __mirrorPrioritering.prioritera;
const _prArsbeloppMening = __mirrorPrioritering.arsbeloppMening;

// ---- speglar src/lib/livscykel.js ----
const __mirrorLivscykel = (() => {
    // importer ur tidigare speglade lib-moduler
    const fitOLS = __mirrorStat.fitOLS;
    const pValue2Sided = __mirrorStat.pValue2Sided;
    const tQuantile = __mirrorStat.tQuantile;

// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
/**
 * Öppen lönekartläggning — Livscykelanalys (sekundär regression, ren modell)
 *
 *   log(lön) ~ kön + ålder + ålder² + kön×ålder + kön×ålder² + C(BAS)
 *
 * Designmatrisen, OLS-skattningen med HC3-robusta standardfel, testen på kön-
 * relaterade koefficienter, prediktionerna 25–65 år med 95 % KI, gapet per ålder
 * och AIC. Modellen tar raderna och golvet som parametrar och läser inget globalt
 * tillstånd. Tolkningstexten och presentationen ligger kvar i appen.
 *
 * Appen får modellen genom lib-speglarna (ADR-8); runLifecycleRegression() i
 * src/app/52-livscykel.js är den tunna adaptern som läser getData() och statGolv().
 */


/**
 * @param {Array<{lon:number, alder:number, kon:string, bas:string}>} rader
 * @param {{fixBas?:string|null, golv:number}} opt
 *        fixBas: BAS-intervall att fixera vid i prediktionerna (default = mest folkrika).
 *        golv: minsta antal personer per kön (statGolv() i appen).
 * @returns {Object} { error, errorCode } eller resultat med koefficienter, prediktioner och gap per ålder.
 */
function livscykelRegression(rader, { fixBas, golv }) {
    const raw = (rader || []).filter(d => d.lon > 0 && d.alder > 0 && (d.kon.includes('kvinna') || d.kon === 'man' || d.kon === 'män'));
    if (raw.length < 50) return { error: 'För få observationer (n < 50) för meningsfull livscykelanalys.', errorCode: 'low_n' };

    const kvN = raw.filter(d => d.kon.includes('kvinna')).length;
    const maN = raw.filter(d => d.kon === 'man' || d.kon === 'män').length;
    if (kvN < golv || maN < golv) return { error: `Otillräcklig könsbalans (${kvN} kvinnor, ${maN} män). Minst ${golv} av varje krävs för interaktions-modell.`, errorCode: 'imbalance' };

    const basList = [...new Set(raw.map(d => d.bas))].sort();
    if (basList.length < 2) return { error: 'Minst 2 BAS-intervall krävs för kategorisk kodning.', errorCode: 'single_bas' };

    // Välj default fixBas = mest folkrika BAS i organisationen om inte angivet
    if (!fixBas || !basList.includes(fixBas)) {
        const counts = {};
        raw.forEach(d => { counts[d.bas] = (counts[d.bas] || 0) + 1; });
        fixBas = basList.reduce((a, b) => (counts[b] || 0) > (counts[a] || 0) ? b : a, basList[0]);
    }

    // Centrera ålder för numerisk stabilitet (annars korrelerar ålder och ålder²)
    const ageMean = raw.reduce((s, d) => s + d.alder, 0) / raw.length;
    const ageVals = raw.map(d => d.alder - ageMean);

    // Designmatris kolumner:
    //   [0] intercept
    //   [1] isKvinna  (1 = kvinna, 0 = man)
    //   [2] age_c     (centrerad ålder)
    //   [3] age_c²
    //   [4] isKvinna × age_c   (interaktion)
    //   [5] isKvinna × age_c²  (interaktion)
    //   [6..k] BAS-dummies (k-1 st, första BAS = referens)
    const refBas = basList[0];
    const dummyBas = basList.slice(1);

    const X = [];
    const y = [];
    raw.forEach((d, i) => {
        const isKv = d.kon.includes('kvinna') ? 1 : 0;
        const ac  = ageVals[i];
        const ac2 = ac * ac;
        const row = [1, isKv, ac, ac2, isKv * ac, isKv * ac2];
        dummyBas.forEach(b => row.push(d.bas === b ? 1 : 0));
        X.push(row);
        y.push(Math.log(d.lon));
    });

    const fit = fitOLS(X, y);
    if (!fit) return { error: 'Modellen kunde inte estimeras — möjlig multikollinearitet bland BAS-dummies.', errorCode: 'singular' };

    // Adj-R² och AIC för modelljämförelse
    const n = fit.n;
    const k = fit.k;
    const adjR2 = 1 - (1 - fit.R2) * (n - 1) / (n - k);
    // AIC ≈ n*ln(RSS/n) + 2k (additiv konstant utelämnad — vi använder bara för relativ jämförelse)
    // Medelvärdet räknas EN gång, utanför summeringen: inne i den blir det
    // O(n²) — på 55 000 rader tre miljarder additioner, och process-trackern
    // kör livscykelregressionen direkt efter uppladdning.
    const yMedel = y.reduce((a, b) => a + b, 0) / n;
    const rss = (1 - fit.R2) * y.reduce((s, v) => s + (v - yMedel) * (v - yMedel), 0);
    const aic = n * Math.log(rss / n) + 2 * k;

    // Tester på kön-relaterade koefficienter (huvudeffekt + interaktioner)
    const Z = tQuantile(0.975, fit.n - fit.k);   // t-kvantil för 95 % KI (1,96 vid df ≥ 100)
    const idxKv      = 1;
    const idxKvAge   = 4;
    const idxKvAge2  = 5;
    const kvCoef     = fit.beta[idxKv];
    const kvSE       = Math.sqrt(fit.vcovHC3[idxKv][idxKv]);
    const kvT        = kvSE > 0 ? kvCoef / kvSE : 0;
    const kvPValue   = pValue2Sided(kvT, fit.n, fit.k);
    const kvAgeSE    = Math.sqrt(fit.vcovHC3[idxKvAge][idxKvAge]);
    const kvAgeT     = kvAgeSE > 0 ? fit.beta[idxKvAge] / kvAgeSE : 0;
    const kvAgePVal  = pValue2Sided(kvAgeT, fit.n, fit.k);
    const kvAge2SE   = Math.sqrt(fit.vcovHC3[idxKvAge2][idxKvAge2]);
    const kvAge2T    = kvAge2SE > 0 ? fit.beta[idxKvAge2] / kvAge2SE : 0;
    const kvAge2PVal = pValue2Sided(kvAge2T, fit.n, fit.k);

    // Prediktioner för ålder 25..65 vid fixerad BAS, för båda könen
    // SE för prediktion: x' · vcovHC3 · x  → 95 % KI = exp(logLon ± Z · SE)
    const ages = [];
    for (let a = 25; a <= 65; a++) ages.push(a);

    const predict = (isKv) => ages.map(a => {
        const ac = a - ageMean;
        const ac2 = ac * ac;
        const xRow = [1, isKv, ac, ac2, isKv * ac, isKv * ac2];
        dummyBas.forEach(b => xRow.push(b === fixBas ? 1 : 0));

        // log-skala punktprediktion
        let logLon = 0;
        for (let i = 0; i < xRow.length; i++) logLon += xRow[i] * fit.beta[i];

        // Variance: x' · V · x
        let variance = 0;
        for (let i = 0; i < xRow.length; i++) {
            let inner = 0;
            for (let j = 0; j < xRow.length; j++) inner += fit.vcovHC3[i][j] * xRow[j];
            variance += xRow[i] * inner;
        }
        const se = Math.sqrt(Math.max(0, variance));

        return {
            age: a,
            lon: Math.exp(logLon),
            lo:  Math.exp(logLon - Z * se),
            hi:  Math.exp(logLon + Z * se)
        };
    });

    const predKvinna = predict(1);
    const predMan    = predict(0);

    // Nivåfaktor per BAS ur modellens egna koefficienter: exp(β_BAS − β_visat), med referensintervallets β = 0.
    // Multiplicerat med kurvan för det visade intervallet ger den modellens lönenivå i varje annat intervall.
    const idxBas = b => 6 + dummyBas.indexOf(b);
    const betaBas = b => (b === refBas ? 0 : fit.beta[idxBas(b)]);
    const basFaktor = Object.fromEntries(basList.map(b => [b, Math.exp(betaBas(b) - betaBas(fixBas))]));

    // Gap per ålder, kvinnor mot män som i huvudmodellen: log(kvinna) − log(man) = β_kv + β_kv×age·ac + β_kv×age²·ac²
    // (negativt när kvinnor ligger lägre).
    // Procentskillnad: (exp(logGap) - 1) × 100
    const gapPerAge = ages.map(a => {
        const ac = a - ageMean;
        const ac2 = ac * ac;
        const logGap = fit.beta[idxKv] + fit.beta[idxKvAge] * ac + fit.beta[idxKvAge2] * ac2;
        // SE av logGap-uttrycket (linjär kombination av tre koefficienter)
        // Var(c1·β1 + c2·β2 + c3·β3) = c'·V·c där c = [1, ac, ac²] över relevanta dimensioner
        const c = [1, ac, ac2];
        const idxs = [idxKv, idxKvAge, idxKvAge2];
        let v = 0;
        for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
            v += c[i] * c[j] * fit.vcovHC3[idxs[i]][idxs[j]];
        }
        const se = Math.sqrt(Math.max(0, v));
        const gapPct = (Math.exp(logGap) - 1) * 100;
        const gapLoPct = (Math.exp(logGap - Z * se) - 1) * 100;
        const gapHiPct = (Math.exp(logGap + Z * se) - 1) * 100;
        return { age: a, gapPct, gapLoPct, gapHiPct };
    });

    // Tolkning: nyckeltal för gapet vid 25 och 65 år och förändringen däremellan (kvinnor mot män:
    // en negativ förändring betyder att kvinnorna halkar efter med åldern)
    const gapAt25 = gapPerAge[0].gapPct;
    const gapAt65 = gapPerAge[gapPerAge.length - 1].gapPct;
    const gapDelta = gapAt65 - gapAt25;

    return {
        ok: true,
        n, k, R2: fit.R2, adjR2, aic,
        ageMean,
        basList, fixBas, refBas, basFaktor,
        predKvinna, predMan, gapPerAge,
        kvCoef, kvSE, kvPValue,
        kvAgeCoef: fit.beta[idxKvAge], kvAgePVal,
        kvAge2Coef: fit.beta[idxKvAge2], kvAge2PVal,
        gapAt25, gapAt65, gapDelta
    };
}

    return { livscykelRegression };
})();
const _lcLivscykelRegression = __mirrorLivscykel.livscykelRegression;

// ---- speglar src/lib/organisationsfil.js ----
const __mirrorOrganisationsfil = (() => {
// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
/**
 * Öppen lönekartläggning — Organisationsfil: verktyget med organisationspaketet inbakat
 * (docs/utveckling/organisationsfil-design.md).
 *
 * Paketet läggs som en inaktiv datablock sist i HTML-filen, efter sista skriptet:
 *   <template id="(mallens id, MALL_ID)" data-skapad="…" data-organisation="…"
 *             data-verktygsversion="…" data-verktygssha="…">{ …JSON… }</template>
 * Ett <template> tolkas inte och exekveras inte; skriptens kontrollsummor i CSP:n är orörda eftersom
 * inget skript ändras. JSON-texten skrivs med `<` som \u003c och `&` som \u0026, så att den varken kan
 * avsluta elementet eller tolkas som en teckenreferens när appen läser den med textContent.
 *
 * Ren modul: bara strängar in och ut. Appen (29-organisationspaket.js) läser filen med FileReader,
 * laddar ner resultatet som Blob och läser vid start blocket ur DOM:en.
 *
 * Webbläsarbygget får en AUTO-GENERERAD spegel i src/app/09-lib-speglar.js.
 */

const MALL_ID = 'inbakat-organisationspaket';
// Mallens öppningstagg byggs ihop av delar, så att den exakta strängen inte står i källkoden (som
// följer med i den byggda filen): en sökning efter blocket får bara träffa det riktiga blocket.
const MALL_START = '<' + 'template id="' + MALL_ID + '"';
const MALL_RE = new RegExp(MALL_START.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '([^>]*)>([\\s\\S]*?)<\\/template>');
// Blocket ligger alltid efter sista skriptet; bara den delen av filen söks och ändras, så att ett skript som
// råkar innehålla liknande text aldrig rörs.
const _delad = html => { const s = String(html ?? ''); const i = s.lastIndexOf('</script>'); return i < 0 ? ['', s] : [s.slice(0, i + 9), s.slice(i + 9)]; };
const VERSION_RE = /const APP_VERSION = '([0-9]{4}\.[0-9]{2}\.[0-9]{2})'/;
const CSP_RE = /<meta http-equiv="Content-Security-Policy"/;

const _attr = v => String(v ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const _avattr = v => String(v ?? '').replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

/** Filnamnsförslag ur organisationens namn: oppen-lonekartlaggning-<slug>.html. */
function filnamnForslag(organisation) {
    const slug = String(organisation ?? '').toLowerCase().replace(/[åä]/g, 'a').replace(/ö/g, 'o')
        .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    return `oppen-lonekartlaggning-${slug || 'organisation'}.html`;
}

/** Ett filnamn som systemägaren skrivit: trimmat, utan sökvägstecken, med ändelsen .html. */
function normaliseraFilnamn(namn, organisation) {
    let n = String(namn ?? '').trim().replace(/[\\/:*?"<>|]/g, '-');
    if (!n) return filnamnForslag(organisation);
    if (!/\.html?$/i.test(n)) n += '.html';
    return n;
}

/**
 * Är texten verktyget? Kräver CSP-metataggen och verktygets eget skript. Versionen läses ur
 * skriptet när den finns (den byggda filen); källans index.html saknar den.
 * @returns {{ok:boolean, version:string|null, fel?:string}}
 */
function kannIgenVerktyget(html) {
    const s = String(html ?? '');
    if (!CSP_RE.test(s)) return { ok: false, version: null, fel: 'Filen är inte verktyget: innehållssäkerhetspolicyn saknas.' };
    if (s.lastIndexOf('</body>') < 0) return { ok: false, version: null, fel: 'Filen är inte verktyget: dokumentet är ofullständigt.' };
    const m = VERSION_RE.exec(s);
    return { ok: true, version: m ? m[1] : null };
}

/**
 * Läser det inbakade blocket ur en HTML-text.
 * @returns {null | {json:string, meta:{skapad:string, organisation:string, verktygsversion:string, verktygssha:string}}}
 */
function lasUt(html) {
    const m = MALL_RE.exec(_delad(html)[1]);
    if (!m) return null;
    const attrs = {};
    for (const a of m[1].matchAll(/data-([a-z]+)="([^"]*)"/g)) attrs[a[1]] = _avattr(a[2]);
    return { json: m[2], meta: { skapad: attrs.skapad || '', organisation: attrs.organisation || '', verktygsversion: attrs.verktygsversion || '', verktygssha: attrs.verktygssha || '' } };
}

/**
 * Bakar in paketet i verktygsfilen. Ett tidigare inbakat paket ersätts. Inget skript rörs: blocket
 * läggs före sista </body> (biblioteken innehåller strängen '</body>' i sin kod, därför det sista).
 * @param {string} html - verktygsfilen som text
 * @param {string} paketJson - paketet som JSON-text (redan validerat av anroparen)
 * @param {{skapad?:string, organisation?:string, verktygssha?:string}} [meta]
 * @returns {{ok:true, html:string, version:string|null} | {ok:false, fel:string}}
 */
function bakaIn(html, paketJson, meta = {}) {
    const k = kannIgenVerktyget(html);
    if (!k.ok) return { ok: false, fel: k.fel || 'Filen är inte verktyget.' };
    let obj;
    try { obj = JSON.parse(String(paketJson)); } catch (_e) { return { ok: false, fel: 'Paketet är inte giltig JSON.' }; }
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return { ok: false, fel: 'Paketet är inte ett objekt.' };
    const text = JSON.stringify(obj).replace(/</g, '\\u003c').replace(/&/g, '\\u0026');
    const [huvud, svans0] = _delad(html);
    let svans = svans0.replace(MALL_RE, '');
    const slut = svans.lastIndexOf('</body>');
    if (slut < 0) return { ok: false, fel: 'Filen är inte verktyget: dokumentet är ofullständigt.' };
    const block = `${MALL_START} data-skapad="${_attr(meta.skapad)}" data-organisation="${_attr(meta.organisation)}"`
        + ` data-verktygsversion="${_attr(k.version || '')}" data-verktygssha="${_attr(meta.verktygssha)}">${text}</template>`;
    svans = svans.slice(0, slut) + block + svans.slice(slut);
    return { ok: true, html: huvud + svans, version: k.version };
}

/** Skriptblocken i en HTML-text, för tester som hävdar att inbakningen inte rör något skript. */
function skriptBlock(html) {
    return [...String(html ?? '').matchAll(/<script\b[^>]*>[\s\S]*?<\/script>/g)].map(m => m[0]);
}

    return { bakaIn, filnamnForslag, normaliseraFilnamn };
})();
const _ofBakaIn = __mirrorOrganisationsfil.bakaIn;
const _ofFilnamnForslag = __mirrorOrganisationsfil.filnamnForslag;
const _ofNormaliseraFilnamn = __mirrorOrganisationsfil.normaliseraFilnamn;

// ---- speglar src/lib/aid-etiketter.js ----
const __mirrorAidEtiketter = (() => {
// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
// AUTO-GENERERAD av tools/gen-aid-etiketter.mjs ur SKR, Etikettlista AID 2018 (reviderad 2026-09-23). Ändra inte för hand.
// Innehåller bara kod, etikettnamn och möjliga ansvarskoder per etikett.
//
// Webbläsarbygget får en AUTO-GENERERAD spegel i src/app/09-lib-speglar.js.

const LISTA = Object.freeze({
    version: '2026-09-23',
    kalla: 'SKR, Etikettlista AID 2018 (reviderad 2026-09-23)',
    etiketter: Object.freeze([
        ["101010","Ledning, övergripande","A"],
        ["101011","Ledning, ekonomi","A,B,C,L"],
        ["101012","Ledning, personal/HR","A,B,C,L"],
        ["101013","Ledning, information/kommunikation","A,B,C,L"],
        ["101014","Ledning, IT","A,B,C,L"],
        ["101015","Ledning, administration","A,B,C,L"],
        ["102010","Ledning, hälso- och sjukvård","A,B,C,L"],
        ["102510","Ledning, tandvård","A,B,C,L"],
        ["103010","Ledning, rehabilitering och förebyggande arbete","A,B,C,L"],
        ["103510","Ledning, individ- och familjeomsorg","A,B,C,L"],
        ["103511","Ledning, äldreomsorg","A,B,C,L"],
        ["103512","Ledning, omsorg om personer med funktionsnedsättning samt socialpsykiatriområdet","A,B,C,L"],
        ["104010","Ledning, skola","A,B,C,L,1001,1002"],
        ["104011","Rektor (skola)","B,C,L,1001,1002"],
        ["104012","Ledning, förskola, pedagogisk omsorg och fritidsverksamhet","A,B,C,L,1001,1002"],
        ["104510","Ledning, kultur, turism, rekreation och friluftsfrågor","A,B,C,L"],
        ["105010","Ledning, teknik, hantverk, miljö och samhällsbyggnad","A,B,C,L"],
        ["105510","Ledning, räddningstjänst och säkerhet","A,B,C,L"],
        ["106010","Ledning, köks- och måltidsarbete","A,B,C,L"],
        ["106510","Ledning, städ, tvätt och renhållning","A,B,C,L"],
        ["109090","Ledning, annan","A,B,C,L"],
        ["151010","Handläggare, övergripande verksamhet","B,C,L,F"],
        ["151011","Handläggare, ekonomi","B,C,L,F"],
        ["151012","Handläggare, personal/HR","B,C,L,F"],
        ["151013","Handläggare, information/kommunikation","B,C,L,F"],
        ["151014","Handläggare, IT","B,C,L,F"],
        ["151015","Handläggare, upphandling/inköp","B,C,L,F"],
        ["151016","Handläggare, konsument-, medborgar- och samhällsservice","B,C,L,F"],
        ["151017","Handläggare, miljöfrågor","B,C,L,F"],
        ["151018","Jurist","B,C,L,F"],
        ["151019","Arkivarie","B,C,L,F"],
        ["151020","Handläggare, nämnder","B,C,L,F"],
        ["151021","Handläggare, samhällsutveckling och säkerhetsfrågor","B,C,L,F"],
        ["151022","Handläggare, hälso- och sjukvård, tandvård, rehabilitering samt psykiatri","B,C,L,F"],
        ["151023","Handläggare, individ- och familjeomsorg, äldreomsorg, funktionsnedsättning, socialpsykiatri och integrationsarbete","B,C,L,F"],
        ["151024","Handläggare, förskole-, skol-, fritids- och annan pedagogisk verksamhet","B,C,L,F"],
        ["151025","Handläggare, infrastruktur, trafik och kollektivtrafikfrågor","B,C,L,F"],
        ["151026","Handläggare, teknik och lokal/fastighetsfrågor","B,C,L,F"],
        ["151090","Handläggare, annan","B,C,L,F"],
        ["152010","Administratör, övergripande verksamhet","B,C,L,F"],
        ["152011","Administratör, ekonomi","B,C,L,F"],
        ["152012","Administratör, personal/HR/löner","B,C,L,F"],
        ["152013","Administratör, information/kommunikation, medborgar- och samhällsservice","B,C,L,F"],
        ["152014","Administratör, IT","B,C,L,F"],
        ["152015","Administratör, individ- och familjeomsorg, äldreomsorg, funktionsnedsättning, socialpsykiatri och integrationsarbete","B,C,L,F"],
        ["152016","Administratör, förskole-, skol-, fritids-, och annan pedagogisk verksamhet","B,C,L,F"],
        ["152017","Receptionist, telefonist","B,C,L,F"],
        ["152018","Administratör, vård","B,C,L,F"],
        ["152019","Administratör, kultur, turism och friluftsområdet","B,C,L,F"],
        ["152020","Administratör, teknik- och fastighetsfrågor samt samhällsbyggnad","B,C,L,F"],
        ["152021","Administratör, trafik- och kollektivtrafikfrågor","B,C,L,F"],
        ["152090","Administratör, annan","B,C,L,F"],
        ["201010","Överläkare","B,C,L,F,M"],
        ["201011","Distriktsläkare/Specialist allmänmedicin","B,C,L,F,M"],
        ["201012","Skolläkare","B,C,L,F"],
        ["201013","Företagsläkare","B,C,L,F"],
        ["202010","Specialistläkare","B,C,L,F,M"],
        ["203010","Läkare legitimerad, specialiseringstjänstgöring","B,C,L,F,M"],
        ["203020","Läkare legitimerad, bastjänstgöring","B,C,L,F"],
        ["203090","Läkare legitimerad, annan","B,C,L,F,M"],
        ["204010","Läkare ej legitimerad, allmäntjänstgöring","B,C,L,F"],
        ["204090","Läkare ej legitimerad, annan","B,C,L,F"],
        ["204510","Psykolog","B,C,L,F"],
        ["204511","PTP-psykolog","B,C,L,F"],
        ["204610","Psykoterapeut","B,C,L,F"],
        ["205010","Barnmorska, vårdavdelning","B,C,L,F"],
        ["205011","Barnmorska, mottagning/rådgivning","B,C,L,F"],
        ["206010","Anestesisjuksköterska","B,C,L,F"],
        ["206011","Distriktssköterska","B,C,L,F"],
        ["206012","Psykiatrisjuksköterska","B,C,L,F"],
        ["206013","Ambulanssjuksköterska","B,C,L,F"],
        ["206014","Sjuksköterska, funktionsnedsättning och äldreomsorg/geriatrik","B,C,L,F"],
        ["206015","Intensivvårdssjuksköterska","B,C,L,F"],
        ["206016","Operationssjuksköterska","B,C,L,F"],
        ["206017","Sjuksköterska, medicin/kirurgi","B,C,L,F"],
        ["206018","Sjuksköterska, barn och ungdom","B,C,L,F"],
        ["206019","Skolsköterska","B,C,L,F"],
        ["206020","Företagssköterska","B,C,L,F"],
        ["206021","Sjuksköterska, annan specialistinriktning","B,C,L,F"],
        ["206022","Medicinskt ansvarig sjuksköterska (MAS)","B,C,L,F"],
        ["206023","Sjuksköterska, specialfunktion","B,C,L,F"],
        ["206090","Sjuksköterska, allmän","B,C,L,F"],
        ["206510","Röntgensjuksköterska","B,C,L,F"],
        ["207008","Undersköterska med specialistinriktning","B,C,L,F"],
        ["207009","Undersköterska, hemtjänst","B,C,L,F"],
        ["207010","Undersköterska, hemvård/hemsjukvård","B,C,L,F"],
        ["207011","Undersköterska, särskilt boende","B,C,L,F"],
        ["207013","Undersköterska, vård-/specialavdelning hälso- och sjukvård","B,C,L,F"],
        ["207014","Undersköterska, mottagning hälso- och sjukvård","B,C,L,F"],
        ["207015","Barnsköterska, hälso- och sjukvård","B,C,L,F"],
        ["207016","Ambulanssjukvårdare","B,C,L,F"],
        ["207017","Medicinsk fotterapeut","B,C,L,F"],
        ["207018","Skötare, mottagning psykiatri","B,C,L,F"],
        ["207019","Skötare, vårdavdelning psykiatri","B,C,L,F"],
        ["207023","Vårdbiträde, hemvård/hemsjukvård","B,C,L,F"],
        ["207024","Vårdbiträde, särskilt boende","B,C,L,F"],
        ["207026","Röntgenbiträde","B,C,L,F"],
        ["207029","Vårdbiträde, hemtjänst","B,C,L,F"],
        ["207090","Biträdesarbete, annat","B,C,L,F"],
        ["208010","Sjukhusfysiker","B,C,L,F"],
        ["208011","Sjukhuskemist","B,C,L,F"],
        ["208012","Obduktionstekniker","B,C,L,F"],
        ["208013","Biomedicinsk analytiker","B,C,L,F"],
        ["208014","Cytodiagnostiker","B,C,L,F"],
        ["208015","Andra specialiteter inom hälso- och sjukvård","B,C,L,F"],
        ["208016","Laboratoriebiträde","B,C,L,F"],
        ["208017","Farmaceut","B,C,L,F"],
        ["208018","Sjukhusbiolog","B,C,L,F"],
        ["208090","Laboratoriearbete, annat","B,C,L,F"],
        ["251010","Tandläkare, allmäntandvård","B,C,L,F"],
        ["251011","Specialisttandläkare","B,C,L,F"],
        ["251013","Tandläkare under specialiseringstjänstgöring","B,C,L,F"],
        ["252009","Tandsköterska med specialistinriktning","B,C,L,F"],
        ["252010","Tandsköterska","B,C,L,F"],
        ["252011","Tandhygienist","B,C,L,F"],
        ["252012","Tandtekniker","B,C,L,F"],
        ["252090","Tandvårdsarbete, annat","B,C,L,F"],
        ["301009","Medicinskt ansvarig för rehabilitering (MAR)","B,C,L,F"],
        ["301010","Arbetsterapeut","B,C,L,F"],
        ["301011","Fysioterapeut","B,C,L,F"],
        ["301012","Arbetsterapibiträde","B,C,L,F"],
        ["301013","Fysioterapiassistent","B,C,L,F"],
        ["301014","Logoped","B,C,L,F"],
        ["301015","Audionom","B,C,L,F"],
        ["301016","Syn-, hörsel- och talpedagog","B,C,L,F"],
        ["301017","Dövtolk/Teckenspråkstolk","B,C,L,F"],
        ["301018","Dietist","B,C,L,F"],
        ["301020","Hjälpmedelskonsulent","B,C,L,F"],
        ["301021","Hälsovetare","B,C,L,F"],
        ["301090","Rehabiliterings- och förebyggande arbete, annat","B,C,L,F"],
        ["351008","Socialsekreterare, barn och unga, myndighetsutövning","B,C,L,F"],
        ["351009","Socialsekreterare, ekonomiskt bistånd","B,C,L,F"],
        ["351010","Socialsekreterare, utan myndighetsutövning","B,C,L,F"],
        ["351011","Fältsekreterare","B,C,L,F"],
        ["351012","Socialsekreterare, vuxna och LSS, myndighetsutövning","B,C,L,F"],
        ["351013","Familjerådgivare","B,C,L,F"],
        ["351014","Integrationshandläggare","B,C,L,F"],
        ["351015","Behandlingsassistent/Socialpedagog","B,C,L,F"],
        ["351016","Arbetsmarknadskonsulent","B,C,L,F"],
        ["351030","Stödpedagog, funktionsnedsättning","B,C,L,F"],
        ["351031","Stödassistent/Vårdare, gruppboende, funktionsnedsättning","B,C,L,F"],
        ["351032","Stödassistent/Vårdare, dagverksamhet, funktionsnedsättning","B,C,L,F"],
        ["351033","Vårdbiträde/Stödbiträde, funktionsnedsättning","B,C,L,F"],
        ["351034","Boendestödjare, i hemmiljö, inom funktionsnedsättning","B,C,L,F"],
        ["351035","Skötare/Boendestödjare, behandlingsarbete i hemmiljö, inom socialpsykiatri","B,C,L,F"],
        ["351040","Personlig assistent","B,C,L,F"],
        ["351041","Anhörigvårdare","B,C,L,F"],
        ["351090","Socialt arbete, annat","B,C,L,F"],
        ["352010","Kurator","B,C,L,F"],
        ["352090","Kurativt arbete, annat","B,C,L,F"],
        ["401009","Lärare grundskola, årskurs F-3","B,C,L,F,1001,1002"],
        ["401010","Lärare grundskola, årskurs 4-6","B,C,L,F,1001,1002"],
        ["401011","Lärare grundskola, årskurs 7-9","B,C,L,F,1001,1002"],
        ["401012","Lärare gymnasieskola, allmänna ämnen","B,C,L,F,1001,1002"],
        ["401013","Lärare gymnasieskola, yrkesämnen","B,C,L,F,1001,1002"],
        ["401015","Lärare, folkhögskola","B,C,L,F"],
        ["401016","Speciallärare","B,C,L,F,1001,1002"],
        ["401017","Specialpedagog","B,C,L,F,1001,1002"],
        ["401018","SFI-lärare","B,C,L,F,1001,1002"],
        ["401019","Lärare, modersmål","B,C,L,F,1001,1002"],
        ["401020","Lärare, praktiska/estetiska ämnen, grundskola","B,C,L,F,1001,1002"],
        ["401021","Lärare, praktiska/estetiska ämnen, gymnasieskola","B,C,L,F,1001,1002"],
        ["401022","Lärare, vuxenutbildning, allmänna ämnen","B,C,L,F,1001,1002"],
        ["401023","Lärare, vuxenutbildning, yrkesämnen","B,C,L,F,1001,1002"],
        ["402010","Förskollärare","B,C,L,F,1001,1002"],
        ["402011","Lärare i fritidshem","B,C,L,F,1001,1002"],
        ["402090","Lärar-, förskollärararbete, annat","B,C,L,F,1001,1002"],
        ["403010","Barnskötare","B,C,L,F"],
        ["403011","Dagbarnvårdare","B,C,L,F"],
        ["403012","Modersmålstränare, förskola","B,C,L,F,1001,1002"],
        ["403013","Instruktör/Handledare","B,C,L,F,1001,1002"],
        ["403014","Studie- och yrkesvägledare","B,C,L,F"],
        ["403015","Lärarassistent","B,C,L,F"],
        ["403016","Elevassistent","B,C,L,F"],
        ["403090","Skolarbete, annat","B,C,L,F"],
        ["451010","Kultursekreterare/kulturhandläggare","B,C,L,F"],
        ["451011","Lärare, kulturskola","B,C,L,F"],
        ["451012","Kulturarbete","B,C,L,F"],
        ["451013","Antikvarie","B,C,L,F"],
        ["451014","Museiarbete","B,C,L,F"],
        ["451015","Bibliotekarie","B,C,L,F"],
        ["451016","Biblioteksassistent","B,C,L,F"],
        ["451090","Kulturarbete, annat","B,C,L,F"],
        ["452010","Turism, rekreation och friluftskonsulent","B,C,L,F"],
        ["452011","Fritidsledare","B,C,L,F"],
        ["452012","Turismarbete","B,C,L,F"],
        ["452013","Badmästare","B,C,L,F"],
        ["452014","Friskvårdsarbete, badpersonal","B,C,L,F"],
        ["452090","Turism, rekreation och friluftsarbete, annat","B,C,L,F"],
        ["501010","Fysisk samhällsplanerare","B,C,L,F"],
        ["501011","Bygglovshandläggare","B,C,L,F"],
        ["501012","Byggnadsinspektör","B,C,L,F"],
        ["501013","Miljö- och hälsoskyddsinspektör","B,C,L,F"],
        ["502010","Systemutvecklare","B,C,L,F"],
        ["502011","Ingenjör, mätning, kartering, GIS","B,C,L,F"],
        ["502012","Ingenjör, park/gator, trafik","B,C,L,F"],
        ["502013","Ingenjör, mark, fastigheter","B,C,L,F"],
        ["502014","Ingenjör, drift, VA-ingenjör","B,C,L,F"],
        ["502016","Ingenjör, hälso- och sjukvård","B,C,L,F"],
        ["502090","Ingenjör, annan","B,C,L,F"],
        ["503010","Tekniker, IT","B,C,L,F"],
        ["503011","Tekniker, lantmäteri","B,C,L,F"],
        ["503012","Tekniker, drift","B,C,L,F"],
        ["503013","Tekniker, allmänteknisk","B,C,L,F"],
        ["503014","Tekniker, hälso- och sjukvård","B,C,L,F"],
        ["503015","Steriltekniker","B,C,L,F"],
        ["503090","Tekniker, annan","B,C,L,F"],
        ["509090","Teknikarbete, annat","B,C,L,F"],
        ["521010","Elektriker/elmontör","B,C,L,F"],
        ["521011","Fastighetsskötare","B,C,L,F"],
        ["521012","Anläggningsarbete","B,C,L,F"],
        ["521013","Hantverkare","B,C,L,F"],
        ["521014","Fordonsförare","B,C,L,F"],
        ["521015","Vaktmästare","B,C,L,F"],
        ["521016","Kontorsvaktmästare","B,C,L,F"],
        ["521017","Parkeringsvakt/trafikövervakare","B,C,L,F"],
        ["521018","Park-/trädgårdsarbete","B,C,L,F"],
        ["521019","Lantbruksarbete","B,C,L,F"],
        ["529090","Hantverkararbete, annat","B,C,L,F"],
        ["551010","Brandingenjör","B,C,L,F"],
        ["551011","Brandinspektör","B,C,L,F"],
        ["551012","Brandmästare","B,C,L,F"],
        ["551013","Brandman","B,C,L,F"],
        ["601010","Kock","B,C,L,F"],
        ["601011","Kostekonom","B,C,L,F"],
        ["601012","Måltidspersonal","B,C,L,F"],
        ["609090","Köks- och måltidsarbete, annat","B,C,L,F"],
        ["651010","Lokalvårdare/städare","B,C,L,F"],
        ["651011","Tvätteriarbete","B,C,L,F"],
        ["651012","Renhållningsarbete","B,C,L,F"],
        ["651013","Förrådsarbete","B,C,L,F"],
        ["659090","Städ-, tvätt- och renhållningsarbete, annat","B,C,L,F"]
    ])
});

/** Etikettlistan: { version, kalla, etiketter: [kod, namn, 'A,B,…'][] }. */
function aidEtikettlista() {
    return LISTA;
}

    return { aidEtikettlista };
})();

// ---- speglar src/lib/aid.js ----
const __mirrorAid = (() => {
    // importer ur tidigare speglade lib-moduler
    const aidEtikettlista = __mirrorAidEtiketter.aidEtikettlista;

// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
/**
 * Öppen lönekartläggning — AID-hierarkin (ADR-33).
 *
 * AID (SKR:s arbetsidentifikation) har en sexsiffrig etikett; de två första siffrorna anger ett
 * av 13 huvudområden ("sektorer"), de fyra första en mellannivå utan namn. Restkoder ("annan")
 * har 090 som de tre sista siffrorna. Etikettnamn och möjliga ansvarskoder kommer ur SKR:s
 * etikettlista (aid-etiketter.js, genererad).
 *
 * Webbläsarbygget får en AUTO-GENERERAD spegel i src/app/09-lib-speglar.js.
 */

const HUVUDOMRADEN = Object.freeze([
    { prefix: '10', namn: 'Ledningsarbete' },
    { prefix: '15', namn: 'Handläggar- och administratörsarbete' },
    { prefix: '20', namn: 'Vård- och omsorgsarbete med mera' },
    { prefix: '25', namn: 'Tandvårdsarbete' },
    { prefix: '30', namn: 'Rehabilitering och förebyggande arbete' },
    { prefix: '35', namn: 'Individ- och familjeomsorg, äldreomsorg, funktionsnedsättning, socialpsykiatri och integration' },
    { prefix: '40', namn: 'Förskole-, skol-, fritids- och annan pedagogisk verksamhet' },
    { prefix: '45', namn: 'Kultur-, turism- och friluftsarbete' },
    { prefix: '50', namn: 'Teknikarbete' },
    { prefix: '52', namn: 'Vaktmästeri, trädgård, anläggning med mera' },
    { prefix: '55', namn: 'Räddningstjänstarbete' },
    { prefix: '60', namn: 'Köks- och måltidsarbete' },
    { prefix: '65', namn: 'Städ, tvätt och renhållningsarbete' },
]);
const OKANT_HUVUDOMRADE = 'Okänt huvudområde';

const _PER_PREFIX = new Map(HUVUDOMRADEN.map(h => [h.prefix, h]));
const _ORDNING = new Map(HUVUDOMRADEN.map((h, i) => [h.namn, i]));
/** @type {Map<string, {kod:string, namn:string, ansvarskoder:string[]}>|null} */
let _index = null;

function _etiketter() {
    if (!_index) {
        _index = new Map(aidEtikettlista().etiketter.map(([kod, namn, a]) =>
            [kod, { kod, namn, ansvarskoder: a ? a.split(',') : [] }]));
    }
    return _index;
}

/** Sex siffror först i fältet (som AID-koden läses i dag), annars null. */
function normaliseraAid(aid) {
    const m = String(aid ?? '').trim().match(/^(\d{6})(?!\d)/);
    return m ? m[1] : null;
}

/** Huvudområdet för en AID-kod, eller null. */
function huvudomrade(aid) {
    const k = normaliseraAid(aid);
    return k ? (_PER_PREFIX.get(k.slice(0, 2)) || null) : null;
}

/** Sektorns namn — huvudområdet, eller "Okänt huvudområde". */
function sektorsnamn(aid) {
    const h = huvudomrade(aid);
    return h ? h.namn : OKANT_HUVUDOMRADE;
}

/** De fyra första siffrorna, eller null. */
function mellanniva(aid) {
    const k = normaliseraAid(aid);
    return k ? k.slice(0, 4) : null;
}

/** "AID 2070xx", eller null. */
function mellannivaEtikett(aid) {
    const m = mellanniva(aid);
    return m ? `AID ${m}xx` : null;
}

/** Etiketten ur SKR:s lista: { kod, namn, ansvarskoder }, eller null. */
function etikett(aid) {
    const k = normaliseraAid(aid);
    return k ? (_etiketter().get(k) || null) : null;
}

/** Restkod ("annan"/"annat"): de tre sista siffrorna är 090. */
function arRestkod(aid) {
    const k = normaliseraAid(aid);
    return !!k && k.endsWith('090');
}

/** Etikett under huvudområdet Ledningsarbete (10xxxx). */
function arLedningsetikett(aid) {
    const k = normaliseraAid(aid);
    return !!k && k.startsWith('10');
}

/** Sorterar sektorsnamn i prefixordning; okänt huvudområde sist. */
function jamforSektor(a, b) {
    const i = n => _ORDNING.get(n) ?? HUVUDOMRADEN.length;
    return i(a) - i(b);
}

/** Version, källa och antal etiketter i den inbyggda etikettlistan. */
function etikettlistaInfo() {
    const l = aidEtikettlista();
    return { version: l.version, kalla: l.kalla, antal: l.etiketter.length };
}

    return { normaliseraAid, huvudomrade, sektorsnamn, mellannivaEtikett, etikett, arRestkod, arLedningsetikett, jamforSektor, etikettlistaInfo };
})();
const _aidSektorsnamn = __mirrorAid.sektorsnamn;
const _aidJamforSektor = __mirrorAid.jamforSektor;
const _aidEtikettlistaInfo = __mirrorAid.etikettlistaInfo;

// ---- speglar src/lib/namn.js ----
const __mirrorNamn = (() => {
// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
/**
 * Öppen lönekartläggning — namnformer för organisationen och jämförelsestatistiken
 * (ADR-36).
 *
 * Webbläsarbygget får en AUTO-GENERERAD spegel i src/app/09-lib-speglar.js.
 */
const MAX = 100;

/** Genitiv: namnet + "s", utom när det slutar på s, x eller z. */
function namnGenitiv(namn) {
    const n = String(namn ?? '').trim();
    if (!n) return '';
    return /[sxz]$/i.test(n) ? n : n + 's';
}

/** Trimmar, slår ihop blanksteg och kortar till högst 100 tecken. */
function normaliseraNamn(text) {
    return String(text ?? '').replace(/\s+/g, ' ').trim().slice(0, MAX);
}

    return { namnGenitiv, normaliseraNamn };
})();
const _namnGenitiv = __mirrorNamn.namnGenitiv;
const _namnNormalisera = __mirrorNamn.normaliseraNamn;

// ---- speglar src/lib/skr-personal.js ----
const __mirrorSkrPersonal = (() => {
// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
// AUTO-GENERERAD av tools/gen-skr-personal.mjs ur SKR, personalstatistik november 2025 (Tabell 4 KP, Tabell 5 RP). Ändra inte för hand.
// Per AID-etikett: antal anställningar och andel kvinnor (%) i kommuner respektive regioner.
// null = SKR redovisar inte andelen (små tal).
//
// Webbläsarbygget får en AUTO-GENERERAD spegel i src/app/09-lib-speglar.js.

const STATISTIK = Object.freeze({
    period: '2025-11',
    kalla: 'SKR, personalstatistik november 2025 (Tabell 4 KP, Tabell 5 RP)',
    etiketter: Object.freeze([
        ["101010",340,48.5,30,46.7],
        ["101011",851,61.7,281,58.4],
        ["101012",799,80.5,250,84.4],
        ["101013",417,78.2,109,85.3],
        ["101014",556,36.2,345,42.3],
        ["101015",1514,74.6,639,65.3],
        ["102010",626,87.9,9146,79.7],
        ["102510",0,null,496,84.7],
        ["103010",153,69.3,224,83],
        ["103510",3238,82.6,4,100],
        ["103511",6335,87,56,78.6],
        ["103512",3577,81.7,43,81.4],
        ["104010",1576,68,64,62.5],
        ["104011",8481,75.1,98,61.2],
        ["104012",2982,95.1,0,null],
        ["104510",1832,60.4,71,67.6],
        ["105010",3728,43.3,280,30.4],
        ["105510",637,17.1,13,30.8],
        ["106010",1241,65.8,66,60.6],
        ["106510",447,75.6,176,67],
        ["109090",2558,63.1,1148,59.1],
        ["151010",8299,73.3,2908,70],
        ["151011",4693,73.2,1682,69],
        ["151012",4145,87.4,1715,86.2],
        ["151013",2895,74.9,1117,77.7],
        ["151014",4058,46.5,3466,49.7],
        ["151015",1649,69.3,749,66.8],
        ["151016",1141,77.9,6,83.3],
        ["151017",1364,67.2,196,77],
        ["151018",731,71.3,168,73.2],
        ["151019",572,67.8,169,75.1],
        ["151020",1667,80.1,285,64.6],
        ["151021",2233,59.1,1004,60.9],
        ["151022",102,91.2,2322,82.9],
        ["151023",2730,85.4,79,87.3],
        ["151024",2556,78.8,8,75],
        ["151025",745,56.1,858,47.8],
        ["151026",1216,55.3,319,54.2],
        ["151090",5036,70.5,3105,75.2],
        ["152010",3244,85.7,502,92.6],
        ["152011",1915,91.2,755,87],
        ["152012",3445,92.3,904,92.9],
        ["152013",2050,80.6,503,73.2],
        ["152014",821,50.2,357,70.6],
        ["152015",5605,91.3,0,null],
        ["152016",4947,92.8,60,86.7],
        ["152017",1021,84.3,1357,89.9],
        ["152018",416,93,15339,97.6],
        ["152019",475,77.3,22,90.9],
        ["152020",1092,85.8,63,81],
        ["152021",56,62.5,520,69.2],
        ["152090",3372,83.1,5155,87],
        ["201010",0,null,13875,46.9],
        ["201011",0,null,3648,56.3],
        ["201012",208,85.6,7,71.4],
        ["201013",4,null,33,60.6],
        ["202010",0,null,7443,54.8],
        ["203010",0,null,9997,59.5],
        ["203020",0,null,313,60.7],
        ["203090",0,null,1624,55.9],
        ["204010",0,null,2947,62],
        ["204090",0,null,1309,58.2],
        ["204510",1366,73,5469,75.3],
        ["204511",14,85.7,535,71.8],
        ["204610",0,null,436,84.6],
        ["205010",0,null,4117,99.7],
        ["205011",0,null,1943,99.8],
        ["206010",0,null,3613,70.7],
        ["206011",1874,95.4,4532,97.8],
        ["206012",106,82.1,3221,80.7],
        ["206013",7,85.7,3234,52.5],
        ["206014",8434,89.6,148,91.9],
        ["206015",0,null,3767,85.6],
        ["206016",0,null,2846,93.3],
        ["206017",0,null,501,92.2],
        ["206018",0,null,3561,97.8],
        ["206019",3591,98.9,10,100],
        ["206020",25,92,79,96.2],
        ["206021",178,88.2,2763,88.6],
        ["206022",384,92.2,0,null],
        ["206023",137,92,4850,92.1],
        ["206090",5275,88.6,41577,87.8],
        ["206510",0,null,3120,77.1],
        ["207008",1550,95.1,779,94.1],
        ["207009",36648,81.1,83,84.3],
        ["207010",1972,84.8,37,86.5],
        ["207011",73316,89,264,92.4],
        ["207013",0,null,38022,88.7],
        ["207014",43,90.7,5919,95.5],
        ["207015",0,null,793,98.6],
        ["207016",4,null,1053,42.4],
        ["207017",26,100,309,98.1],
        ["207018",17,88.2,728,73.6],
        ["207019",52,69.2,6282,54.4],
        ["207023",714,68.5,0,null],
        ["207024",43044,73.2,428,68.2],
        ["207026",0,null,36,83.3],
        ["207029",25573,60.1,0,null],
        ["207090",8825,69.8,10028,70.8],
        ["208010",0,null,454,49.6],
        ["208011",0,null,381,63],
        ["208012",0,null,68,51.5],
        ["208013",0,null,6226,85.3],
        ["208014",0,null,112,80.4],
        ["208015",0,null,935,74.4],
        ["208016",0,null,373,70.2],
        ["208017",38,92.1,1230,88.9],
        ["208018",0,null,342,72.8],
        ["208090",6,66.7,675,73.5],
        ["251010",0,null,3075,71.5],
        ["251011",0,null,828,66.2],
        ["251013",0,null,256,64.8],
        ["252009",0,null,66,100],
        ["252010",0,null,6640,98.1],
        ["252011",0,null,1896,93.9],
        ["252012",0,null,75,70.7],
        ["252090",0,null,190,81.1],
        ["301010",3489,91.5,3717,93.6],
        ["301011",2640,76.1,5973,77.9],
        ["301012",678,88.3,34,85.3],
        ["301013",137,91.2,106,82.1],
        ["301014",370,93.8,1510,95.1],
        ["301015",7,100,767,81.6],
        ["301016",49,95.9,186,93.5],
        ["301017",34,79.4,251,90.8],
        ["301018",69,95.7,1196,94],
        ["301020",77,85.7,326,87.1],
        ["301021",367,84.5,207,90.3],
        ["301090",269,84.4,287,77],
        ["351008",8699,91.4,0,null],
        ["351009",4029,86.2,0,null],
        ["351010",11563,85.7,12,100],
        ["351011",1007,63.1,0,null],
        ["351012",6777,90.5,0,null],
        ["351013",809,81.1,6,83.3],
        ["351014",295,67.8,0,null],
        ["351015",7229,67.2,412,70.9],
        ["351016",3668,70.3,0,null],
        ["351030",4725,82,22,63.6],
        ["351031",42624,75.4,379,76.5],
        ["351032",9301,78.5,102,81.4],
        ["351033",13319,61.8,0,null],
        ["351034",2967,69.7,0,null],
        ["351035",5556,68.7,68,89.7],
        ["351040",13422,75.1,60,90],
        ["351041",14,71.4,0,null],
        ["351090",2366,72.9,11,72.7],
        ["352010",4517,86.9,4543,88.4],
        ["352090",351,67.2,226,77.4],
        ["401009",23117,92.7,0,null],
        ["401010",30452,78.3,0,null],
        ["401011",28219,65.2,0,null],
        ["401012",18827,60.3,164,64.6],
        ["401013",7940,43.9,247,55.1],
        ["401014",12168,55.8,0,null],
        ["401015",43,62.8,1064,63.6],
        ["401016",6233,91.3,28,92.9],
        ["401017",6028,93.6,461,94.6],
        ["401018",2559,85.8,0,null],
        ["401019",5534,73.9,0,null],
        ["402010",52842,96.5,48,91.7],
        ["402011",16513,69.2,21,61.9],
        ["402090",5026,72.8,123,81.3],
        ["403010",63190,91.3,0,null],
        ["403011",312,100,0,null],
        ["403012",77,84.4,0,null],
        ["403013",2388,52.3,116,51.7],
        ["403014",2915,85.1,16,93.8],
        ["403015",5228,64.5,11,72.7],
        ["403016",27697,66.4,168,70.8],
        ["403090",3949,71,33,81.8],
        ["451010",731,75.6,293,76.8],
        ["451011",5314,55.4,0,null],
        ["451012",420,67.9,85,62.4],
        ["451013",213,79.3,72,65.3],
        ["451014",664,70.5,114,65.8],
        ["451015",4763,83.1,134,83.6],
        ["451016",2006,80.5,10,100],
        ["451090",805,65.1,25,68],
        ["452010",487,61,9,55.6],
        ["452011",8643,53.8,37,67.6],
        ["452012",309,77.3,0,null],
        ["452013",836,54.4,0,null],
        ["452014",2902,59.5,8,100],
        ["452090",301,55.5,4,null],
        ["501010",3254,64.2,15,60],
        ["501011",1134,62.8,0,null],
        ["501012",726,37.1,0,null],
        ["501013",3213,72.1,0,null],
        ["502010",820,27.6,940,23],
        ["502011",1315,40.8,0,null],
        ["502012",1710,44.1,0,null],
        ["502013",2795,41.7,566,33],
        ["502014",1533,37.6,171,15.2],
        ["502016",0,null,1659,35.3],
        ["502090",467,41.1,76,31.6],
        ["503010",2893,13.7,1562,22.3],
        ["503011",97,40.2,0,null],
        ["503012",3302,8.7,1012,6.7],
        ["503013",258,10.9,95,6.3],
        ["503014",188,15.4,1651,41],
        ["503015",0,null,280,82.1],
        ["503090",880,18.3,180,14.4],
        ["509090",177,22,59,28.8],
        ["521010",292,null,15,null],
        ["521011",1569,9.2,18,null],
        ["521012",2267,8.4,0,null],
        ["521013",895,6.9,70,18.6],
        ["521014",1616,14.9,469,16.8],
        ["521015",5897,8.5,2539,23.4],
        ["521016",298,33.9,20,25],
        ["521017",210,48.6,0,null],
        ["521018",3587,31.3,88,53.4],
        ["521019",289,63,78,73.1],
        ["529090",590,27.5,139,21.6],
        ["551010",310,34.2,0,null],
        ["551011",458,15.9,0,null],
        ["551012",1066,2.9,0,null],
        ["551013",4435,8.8,0,null],
        ["601010",15919,74.7,701,61.2],
        ["601011",93,82.8,18,88.9],
        ["601012",11357,86.9,1822,78.2],
        ["609090",693,85.3,183,85.8],
        ["651010",13698,84.6,4457,77.4],
        ["651011",94,67,435,55.4],
        ["651012",1580,20.5,0,null],
        ["651013",204,29.4,655,39.4],
        ["659090",275,61.1,207,87]
    ])
});

/** SKR:s personalstatistik: { period, kalla, etiketter: [kod, nKommun, pctKommun|null, nRegion, pctRegion|null][] }. */
function skrPersonalstatistik() {
    return STATISTIK;
}

    return { skrPersonalstatistik };
})();

// ---- speglar src/lib/skrreferens.js ----
const __mirrorSkrReferens = (() => {
    // importer ur tidigare speglade lib-moduler
    const skrPersonalstatistik = __mirrorSkrPersonal.skrPersonalstatistik;
    const normaliseraAid = __mirrorAid.normaliseraAid;
    const sektorsnamn = __mirrorAid.sektorsnamn;

// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
/**
 * Öppen lönekartläggning — SKR:s personalstatistik som referens för kvinnoandel.
 *
 * Kvinnoandel per AID-etikett i kommuner, regioner eller båda tillsammans (organisationstypen),
 * vägd med antal anställningar.
 * Där SKR döljer andelen (små tal) räknas bara den del som redovisas; saknas etiketten helt
 * används prefixet (tre första siffrorna). Används som reserv i Likvärdigt arbete och som
 * referensvärde att jämföra organisationens egen könsfördelning mot.
 *
 * Webbläsarbygget får en AUTO-GENERERAD spegel i src/app/09-lib-speglar.js.
 */


const DELAR = ['alla', 'kommun', 'region'];
const _del = del => (DELAR.includes(del) ? del : 'alla');

function _vag(rader, del = 'alla') {
    let n = 0, kv = 0;
    for (const [, nK, pK, nR, pR] of rader) {
        if (pK != null && del !== 'region') { n += nK; kv += nK * pK / 100; }
        if (pR != null && del !== 'kommun') { n += nR; kv += nR * pR / 100; }
    }
    return n > 0 ? { pct: kv / n * 100, n, del } : null;
}

/** "kommuner", "regioner" eller "kommuner och regioner". */
function skrDelText(del) {
    return { kommun: 'kommuner', region: 'regioner' }[del] || 'kommuner och regioner';
}

/**
 * Kvinnoandel (%) för ett AID-prefix (tre siffror), eller null.
 * @param {string|number} prefix
 * @param {{del?: 'alla'|'kommun'|'region'}} [opt] - vilken del av statistiken (organisationstypen)
 */
function skrKvinnoandelPrefix(prefix, { del = 'alla' } = {}) {
    const rader = skrPersonalstatistik().etiketter.filter(e => String(e[0]).startsWith(String(prefix)));
    const v = _vag(rader, _del(del)) || (_del(del) !== 'alla' ? _vag(rader) : null);
    return v ? { ...v, niva: 'prefix', prefix: String(prefix) } : null;
}

/**
 * Kvinnoandel (%) för en AID-kod i den valda delen: etiketten, annars prefixet; finns yrket inte
 * alls i delen används kommuner och regioner tillsammans. null för okänd kod.
 */
function skrKvinnoandel(aid, { del = 'alla' } = {}) {
    const kod = normaliseraAid(aid);
    if (!kod) return null;
    const d = _del(del);
    const alla = skrPersonalstatistik().etiketter;
    const etikett = alla.filter(e => e[0] === kod), prefix = alla.filter(e => String(e[0]).startsWith(kod.slice(0, 3)));
    const forsok = [[etikett, d, 'etikett'], [prefix, d, 'prefix'], [etikett, 'alla', 'etikett'], [prefix, 'alla', 'prefix']];
    for (const [rader, del2, niva] of forsok) {
        const v = _vag(rader, del2);
        if (v) return { ...v, niva, prefix: kod.slice(0, 3) };
    }
    return null;
}

/** Kvinnoandel (%) för en sektor (AID-huvudområdets namn) i den valda delen, eller null. */
function skrKvinnoandelSektor(namn, { del = 'alla' } = {}) {
    const rader = skrPersonalstatistik().etiketter.filter(e => sektorsnamn(e[0]) === namn);
    const v = _vag(rader, _del(del)) || (_del(del) !== 'alla' ? _vag(rader) : null);
    return v ? { ...v, niva: 'sektor' } : null;
}

/** Källa och period för referensvärdena. */
function skrReferensInfo() {
    const s = skrPersonalstatistik();
    return { period: s.period, kalla: s.kalla };
}

    return { skrKvinnoandel, skrKvinnoandelPrefix, skrKvinnoandelSektor, skrReferensInfo, skrDelText };
})();
const _skrKvinnoandel = __mirrorSkrReferens.skrKvinnoandel;
const _skrKvinnoandelPrefix = __mirrorSkrReferens.skrKvinnoandelPrefix;
const _skrReferensInfo = __mirrorSkrReferens.skrReferensInfo;
const _skrDelText = __mirrorSkrReferens.skrDelText;

// ---- speglar src/lib/falt.js ----
const __mirrorFalt = (() => {
    // importer ur tidigare speglade lib-moduler
    const sektorsnamn = __mirrorAid.sektorsnamn;
    const mellannivaEtikett = __mirrorAid.mellannivaEtikett;

// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
/**
 * Öppen lönekartläggning — Fältåtkomst för lönerader
 *
 * Gemensamma nycklar för hur en rad grupperas och jämförs: åldersgrupp,
 * normaliserat kön och gruppnyckel per dimension. Används av src/lib/utforska.js
 * (gruppering) och src/lib/urval.js (villkor), som inte får importera varandra.
 *
 * Webbläsarbygget får en AUTO-GENERERAD spegel i src/app/09-lib-speglar.js.
 */

const AGE_ORDER = ['<20', '20–24', '25–29', '30–34', '35–39', '40–44', '45–49',
                   '50–54', '55–59', '60–64', '65+'];

/** Ålder → 5-årsgrupp. Under 20 och från 65 får egna grupper. */
function ageBucket(alder) {
    const n = Number(alder);
    if (alder == null || !isFinite(n) || n <= 0) return null;
    if (n >= 65) return '65+';
    if (n < 20) return '<20';
    const lo = 20 + Math.floor((n - 20) / 5) * 5;
    return `${lo}–${lo + 4}`;
}

/** Sorteringsfunktion för åldersgrupper: yngst först. */
function jamforAldersgrupp(a, b) {
    return AGE_ORDER.indexOf(a) - AGE_ORDER.indexOf(b);
}

// Lönespann: 5 000 kr breda intervall, t.ex. "30 000–34 999 kr".
const LONESPANN_BREDD = 5000;
function _lonespann(lon) {
    const n = Number(lon);
    if (!(n > 0) || !isFinite(n)) return null;
    const lo = Math.floor(n / LONESPANN_BREDD) * LONESPANN_BREDD;
    return `${lo.toLocaleString('sv-SE')}–${(lo + LONESPANN_BREDD - 1).toLocaleString('sv-SE')} kr`;
}

/** Sorteringsfunktion för lönespann: lägst först. */
function jamforLonespann(a, b) {
    const lagsta = s => Number(String(s).split('–')[0].replace(/\D/g, ''));
    return lagsta(a) - lagsta(b);
}

/** Normaliserat kön för gruppering och uppdelning. */
function konOf(row) {
    if (typeof row.kon === 'string' && row.kon.includes('kvinna')) return 'Kvinna';
    if (row.kon === 'man' || row.kon === 'män') return 'Man';
    return 'Övrig/okänd';
}

/** Mellannivån för rader utan giltig sexsiffrig AID-kod (Utforska tappar dem annars). */
const OKAND_AID_KOD = 'Okänd AID-kod';

/** Gruppnyckel för en rad i en dimension. null = raden saknar värde där. */
function groupKey(row, dim) {
    if (dim === 'bas') return row.bas || '—';
    if (dim === 'aid') {
        if (!row.aid) return row.yrke || '—';
        return row.yrkeLabel && row.yrkeLabel !== row.aid ? `${row.aid} ${row.yrkeLabel}` : String(row.aid);
    }
    if (dim === 'alder') return ageBucket(row.alder);
    if (dim === 'kon') return konOf(row);
    if (dim === 'alla') return 'Hela urvalet';
    // Samma grupper som gruppdossiern och lönekartläggningen arbetar med.
    if (dim === 'aidbas') return `${groupKey(row, 'aid')} · BAS ${row.bas || '—'}`;
    if (dim === 'lonespann') return _lonespann(row.lon);
    // AID-hierarkin (ADR-33): sektor = huvudområde, aidniva = fyra första siffrorna.
    if (dim === 'sektor') return sektorsnamn(row.aid);
    if (dim === 'aidniva') return mellannivaEtikett(row.aid) ?? OKAND_AID_KOD;
    return null;
}

    return { groupKey, konOf, jamforAldersgrupp, jamforLonespann };
})();
const _utGroupKey = __mirrorFalt.groupKey;
const _utKonOf = __mirrorFalt.konOf;
const _faltJamforAlder = __mirrorFalt.jamforAldersgrupp;

// ---- speglar src/lib/urval.js ----
const __mirrorUrval = (() => {
    // importer ur tidigare speglade lib-moduler
    const groupKey = __mirrorFalt.groupKey;

// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
/**
 * Öppen lönekartläggning — Urval: villkor i Utforska
 *
 * Personvillkor ({ lage: 'alla'|'nagot', villkor: [{ falt, op, varde, inte }] })
 * avgör vilka personer som ingår innan grupperna räknas. Gruppvillkor
 * ([{ matt, op, varde }], alla måste gälla) avgör vilka grupper som visas efter
 * att måtten räknats (src/lib/utforska.js gör själva uträkningen).
 *
 * Regler: ofullständiga villkor ignoreras; ett
 * saknat värde uppfyller aldrig ett villkor, inte heller när det är vänt med
 * `inte`; `mellan` är inklusive och tål omvända gränser.
 *
 * Webbläsarbygget får en AUTO-GENERERAD spegel i src/app/09-lib-speglar.js.
 */

const FALT = {
    bas:         { typ: 'kategori', etikett: 'BAS', dim: 'bas' },
    aid:         { typ: 'kategori', etikett: 'Yrkesgrupp', dim: 'aid' },
    sektor:      { typ: 'kategori', etikett: 'Sektor', dim: 'sektor' },
    aldersgrupp: { typ: 'kategori', etikett: 'Åldersgrupp', dim: 'alder' },
    kon:         { typ: 'kategori', etikett: 'Kön', dim: 'kon' },
    lon:         { typ: 'tal', etikett: 'Lön', enhet: 'kr' },
    alder:       { typ: 'tal', etikett: 'Ålder', enhet: 'år' }
};
const GRUPP_MATT = {
    median:    { etikett: 'median', enhet: 'kr' },
    medel:     { etikett: 'medellön', enhet: 'kr' },
    n:         { etikett: 'n', enhet: 'st' },
    p10:       { etikett: 'P10', enhet: 'kr' },
    p25:       { etikett: 'P25', enhet: 'kr' },
    p75:       { etikett: 'P75', enhet: 'kr' },
    p90:       { etikett: 'P90', enhet: 'kr' },
    spridning: { etikett: 'spridning (P90/P10)', enhet: '' },
    andelKv:   { etikett: 'andel kvinnor', enhet: '%' },
    gap:       { etikett: 'gap', enhet: '%' }
};
const TAL_OP = ['storre', 'minst', 'mindre', 'hogst', 'mellan'];
const OP_TEXT = { storre: 'större än', minst: 'minst', mindre: 'mindre än', hogst: 'högst', mellan: 'mellan' };

function faltInfo() { return FALT; }
function gruppMattInfo() { return GRUPP_MATT; }

const _tal = x => typeof x === 'number' && isFinite(x);
// Gränsen för en taljämförelse, eller null om villkoret är ofullständigt.
function _grans(op, varde) {
    if (op === 'mellan') {
        if (!Array.isArray(varde) || varde.length !== 2 || !_tal(varde[0]) || !_tal(varde[1])) return null;
        return varde[0] <= varde[1] ? [varde[0], varde[1]] : [varde[1], varde[0]];
    }
    return _tal(varde) ? varde : null;
}
function _jamfor(x, op, g) {
    if (op === 'storre') return x > g;
    if (op === 'minst') return x >= g;
    if (op === 'mindre') return x < g;
    if (op === 'hogst') return x <= g;
    if (op === 'mellan') return x >= g[0] && x <= g[1];
    return false;
}

function villkorAktivt(v) {
    const f = v && FALT[v.falt];
    if (!f) return false;
    if (f.typ === 'kategori') return v.op === 'enAv' && Array.isArray(v.varde) && v.varde.length > 0;
    return TAL_OP.includes(v.op) && _grans(v.op, v.varde) !== null;
}

// Radens värde i fältet, eller null om det saknas.
function _radVarde(rad, falt) {
    const f = FALT[falt];
    if (f.typ === 'kategori') return groupKey(rad, f.dim);
    const x = Number(rad[falt]);
    return (rad[falt] == null || !isFinite(x) || x <= 0) ? null : x;
}
function _uppfyller(rad, v) {
    const x = _radVarde(rad, v.falt);
    if (x == null) return false;
    const traff = FALT[v.falt].typ === 'kategori' ? v.varde.includes(x) : _jamfor(x, v.op, _grans(v.op, v.varde));
    return v.inte ? !traff : traff;
}

function personFilter(urval) {
    const aktiva = ((urval && urval.villkor) || []).filter(villkorAktivt);
    if (!aktiva.length) return () => true;
    if (urval.lage === 'nagot') return rad => aktiva.some(v => _uppfyller(rad, v));
    return rad => aktiva.every(v => _uppfyller(rad, v));
}

function gruppVillkorAktivt(g) {
    return !!g && Object.prototype.hasOwnProperty.call(GRUPP_MATT, g.matt)
        && TAL_OP.includes(g.op) && _grans(g.op, g.varde) !== null;
}

function uppfyllerGrupp(varden, gruppVillkor) {
    return (gruppVillkor || []).filter(gruppVillkorAktivt).every(g => {
        const x = varden ? varden[g.matt] : null;
        return _tal(x) && _jamfor(x, g.op, _grans(g.op, g.varde));
    });
}

const _fmt = (x, enhet) => {
    const s = x.toLocaleString('sv-SE', { maximumFractionDigits: 2 });
    return enhet ? `${s} ${enhet}` : s;
};
function _beskrivVillkor(v) {
    const f = FALT[v.falt];
    if (f.typ === 'kategori') return `${f.etikett} ${v.inte ? 'är inte en av' : 'är en av'} ${v.varde.join(', ')}`;
    const g = _grans(v.op, v.varde);
    const inte = v.inte ? 'inte ' : '';
    if (v.op === 'mellan') return `${f.etikett} ${inte}mellan ${_fmt(g[0], '')} och ${_fmt(g[1], f.enhet)}`;
    return `${f.etikett} ${inte}${OP_TEXT[v.op]} ${_fmt(g, f.enhet)}`;
}
function _beskrivGrupp(g) {
    const m = GRUPP_MATT[g.matt];
    const gr = _grans(g.op, g.varde);
    if (g.op === 'mellan') return `${m.etikett} mellan ${_fmt(gr[0], '')} och ${_fmt(gr[1], m.enhet)}`;
    return `${m.etikett} ${OP_TEXT[g.op]} ${_fmt(gr, m.enhet)}`;
}

/** Klartext för etiketter och export. Tom sträng när inget villkor är aktivt. */
function beskrivUrval(urval, gruppVillkor) {
    const aktiva = ((urval && urval.villkor) || []).filter(villkorAktivt);
    const grupp = (gruppVillkor || []).filter(gruppVillkorAktivt);
    const delar = [];
    if (aktiva.length) delar.push(`${urval.lage === 'nagot' ? 'Något av' : 'Alla av'}: ${aktiva.map(_beskrivVillkor).join(' · ')}`);
    if (grupp.length) delar.push(`Grupper: ${grupp.map(_beskrivGrupp).join(' · ')}`);
    return delar.join('. ');
}

    return { villkorAktivt, personFilter, gruppVillkorAktivt, uppfyllerGrupp, beskrivUrval, faltInfo, gruppMattInfo };
})();
const _urVillkorAktivt = __mirrorUrval.villkorAktivt;
const _urPersonFilter = __mirrorUrval.personFilter;
const _urGruppVillkorAktivt = __mirrorUrval.gruppVillkorAktivt;
const _urBeskrivUrval = __mirrorUrval.beskrivUrval;
const _urFaltInfo = __mirrorUrval.faltInfo;
const _urGruppMattInfo = __mirrorUrval.gruppMattInfo;

// ---- speglar src/lib/referens.js ----
const __mirrorReferens = (() => {
// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
/**
 * Öppen lönekartläggning — referensen (ställningstagandet).
 *
 * Det finns ingen inbyggd referens (ADR-28): ställningstagandet läses in som fil eller ur
 * ett organisationspaket. Modulen namnger en uppladdad fil.
 */

/** Förslag på namn för en uppladdad referensfil: filnamnet utan ändelse. */
function namnFranFil(filnamn) {
    const s = String(filnamn ?? '').trim().replace(/\.[^.]*$/, '').trim();
    return s || 'Egen referens';
}

    return { namnFranFil };
})();
const _refNamnFranFil = __mirrorReferens.namnFranFil;

// ---- speglar src/lib/datakvalitet.js ----
const __mirrorDatakvalitet = (() => {
    // importer ur tidigare speglade lib-moduler
    const konOf = __mirrorFalt.konOf;

// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
/**
 * Öppen lönekartläggning — underlagets kvalitet (ADR-19).
 *
 * Inget viktat index: fem kriterier får status
 * OK / Varning / Kritisk; helheten är det sämsta kriteriet, så en allvarlig brist
 * kan inte spädas ut av andra delar. Könsfördelningen i organisationen är inget
 * kvalitetskriterium — den är ett fynd (könsskevhet).
 */

const RANG = { ok: 0, varning: 1, kritisk: 2 };
const FTE_GOLV = 20000;

function _stat(v, okGrans, varnGrans, hogreArBattre) {
    if (v == null || !isFinite(v)) return 'kritisk';
    if (hogreArBattre) return v >= okGrans ? 'ok' : v >= varnGrans ? 'varning' : 'kritisk';
    return v <= okGrans ? 'ok' : v <= varnGrans ? 'varning' : 'kritisk';
}
const _pct = v => (v == null || !isFinite(v)) ? '–' : `${(Math.round(v * 10) / 10).toLocaleString('sv-SE')} %`;

/** BAS där båda könen har minst k personer (samma regel som maskeringen). */
function jamforbaraBas(rader, k) {
    const perBas = new Map();
    for (const r of rader || []) {
        const kon = konOf(r);
        if (kon === 'Övrig/okänd' || !r.bas) continue;
        const g = perBas.get(r.bas) || { kv: 0, ma: 0 };
        if (kon === 'Kvinna') g.kv++; else g.ma++;
        perBas.set(r.bas, g);
    }
    const jamforbara = [], maskerade = [];
    let iJamforbara = 0, totalt = 0;
    for (const bas of [...perBas.keys()].sort((a, b) => a.localeCompare(b, 'sv'))) {
        const g = perBas.get(bas);
        totalt += g.kv + g.ma;
        if (g.kv >= k && g.ma >= k) { jamforbara.push(bas); iJamforbara += g.kv + g.ma; }
        else maskerade.push(bas);
    }
    return { jamforbara, maskerade, andelPersoner: totalt ? iJamforbara / totalt : null };
}

/** Minsta upptäckbara skillnad i % (80 % styrka, α = 0,05) ur könskoefficientens SE (log-skala). */
function mdeFranSe(se) {
    if (typeof se !== 'number' || !isFinite(se) || se <= 0) return null;
    return (Math.exp(2.802 * se) - 1) * 100;
}

/**
 * @param {any[]} rader
 * @param {{k?:number, audit?:any, mde?:number|null, modell?:any}} [opts]
 */
function bedomUnderlag(rader, { k, audit, mde, modell } = {}) {
    const d = rader || [];
    const kriterier = [];

    const j = jamforbaraBas(d, k);
    const jPct = j.andelPersoner == null ? null : j.andelPersoner * 100;
    kriterier.push({
        id: 'jamforbarhet', namn: 'Jämförbarhet', status: _stat(jPct, 80, 50, true), varde: jPct,
        text: jPct == null
            ? 'Inga personer med känt kön att jämföra.'
            : `${_pct(jPct)} av personalen finns i BAS-intervall där båda könen har minst ${k} personer`
              + (j.maskerade.length ? ` (${j.maskerade.length} BAS-intervall maskeras: ${j.maskerade.join(', ')}).` : '.'),
    });

    kriterier.push({
        id: 'styrka', namn: 'Statistisk styrka', status: _stat(mde, 2, 5, false), varde: mde,
        text: mde == null
            ? 'Styrkan kunde inte beräknas eftersom regressionen inte gick att skatta.'
            : `Den minsta könsskillnad analysen säkert kan upptäcka är ${_pct(mde)}.`
              + (mde > 5 ? ' Skillnader kring 5 % kan alltså passera oupptäckta.' : ''),
    });

    const bort = audit && audit.totalRaw > 0
        ? ((audit.excludedNoBas || 0) + (audit.excludedZeroLon || 0) + (audit.excludedMissingKon || 0)
           + Math.max(0, (audit.invalidAlder || 0) - (audit.invalidAlderUtesluten || 0))) / audit.totalRaw * 100
        : null;
    kriterier.push({
        id: 'fullstandighet', namn: 'Fullständighet', status: bort == null ? 'varning' : _stat(bort, 2, 10, false), varde: bort,
        text: bort == null
            ? 'Inläsningens räknare saknas; bortfallet är okänt.'
            : `${_pct(bort)} av filens rader föll bort eller saknar giltig ålder.`
    });

    const orimliga = d.filter(r => !(r.lon >= FTE_GOLV && r.lon <= 250000)
        || !(r.alder >= 18 && r.alder <= 70) || !/^[A-ZÅÄÖ]$/i.test(r.bas || '')).length;
    const orimPct = d.length ? orimliga / d.length * 100 : null;
    kriterier.push({
        id: 'rimlighet', namn: 'Rimlighet', status: _stat(orimPct, 1, 5, false), varde: orimPct,
        text: orimPct == null ? 'Inga rader att kontrollera.'
            : `${orimliga} rader (${_pct(orimPct)}) har lön under ${FTE_GOLV.toLocaleString('sv-SE')} eller över 250 000 kr, ålder utanför 18–70 eller BAS som inte är en bokstav.`,
    });

    const mStatus = modell === 'full' ? 'ok' : modell === 'minimal' ? 'varning' : 'kritisk';
    kriterier.push({
        id: 'modell', namn: 'Modell', status: mStatus, varde: modell ?? null,
        text: modell === 'full' ? 'Regressionen tar hänsyn till både ålder och BAS-intervall.'
            : modell === 'minimal' ? 'Regressionen kunde bara ta hänsyn till ålder, inte BAS-intervall.'
            : 'Regressionen gick inte att skatta.',
    });

    const status = kriterier.reduce((s, c) => RANG[c.status] > RANG[s] ? c.status : s, 'ok');
    return { status, kriterier };
}

    return { jamforbaraBas, mdeFranSe, bedomUnderlag };
})();
const _dqJamforbaraBas = __mirrorDatakvalitet.jamforbaraBas;
const _dqMdeFranSe = __mirrorDatakvalitet.mdeFranSe;
const _dqBedomUnderlag = __mirrorDatakvalitet.bedomUnderlag;

// ---- speglar src/lib/rapportunderlag.js ----
const __mirrorRapportunderlag = (() => {
    // importer ur tidigare speglade lib-moduler
    const median = __mirrorStat.median;
    const quantile = __mirrorStat.quantile;
    const fitOLS = __mirrorStat.fitOLS;
    const skrDelText = __mirrorSkrReferens.skrDelText;

// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
/**
 * Öppen lönekartläggning — rapportunderlag (ADR-20).
 *
 * Ren logik bakom panelen Rapportunderlag: vilka yrkesgrupper Lika arbete flaggar
 * (samma regel som EU-tabellen, som använder den här funktionen), justerat gap inom
 * ett yrke, och block med faktastycke, tabell och frågor som kopieras in i en egen
 * Word-mall. Bedömningen (sakliga skäl) skrivs inte här — den kräver kunskap som
 * bara verksamheten har.
 *
 * Webbläsarbygget får en AUTO-GENERERAD spegel i src/app/09-lib-speglar.js.
 */


const _arKvinna = r => typeof r.kon === 'string' && r.kon.includes('kvinna');
const _arMan = r => typeof r.kon === 'string' && !r.kon.includes('kvinna') && (r.kon.includes('man') || r.kon.includes('män'));

/**
 * Yrkesgrupperna i Lika arbete (samma jämförelseenhet och k-regler som EU-tabellen).
 * @param {any[]} rader
 * @param {{k:number, troskel?:number}} opts
 * @returns {{grupper: any[], utelamnade: string[], ejJamforbara: string[]}}
 */
function likaArbeteGrupper(rader, { k, troskel = 5 }) {
    const perYrke = new Map();
    for (const r of rader || []) {
        if (!perYrke.has(r.yrke)) perYrke.set(r.yrke, { kv: [], ma: [] });
        if (_arKvinna(r)) perYrke.get(r.yrke).kv.push(r.lon);
        else if (_arMan(r)) perYrke.get(r.yrke).ma.push(r.lon);
    }
    const grupper = [], utelamnade = [], ejJamforbara = [];
    for (const [yrke, { kv, ma }] of perYrke) {
        if (kv.length < 2 || ma.length < 2) { ejJamforbara.push(yrke); continue; }
        const tot = kv.length + ma.length;
        const nagotLitet = kv.length < k || ma.length < k;
        if (nagotLitet && tot < k) { utelamnade.push(yrke); continue; }
        if (nagotLitet) {
            grupper.push({ yrke, nKv: kv.length, nMa: ma.length, tot, samladMedian: true, flaggad: false,
                gapPct: 0, medTot: median(kv.concat(ma)) });
            continue;
        }
        const medKv = median(kv), medMa = median(ma);
        const kvot = medKv / medMa;
        const gapPct = Math.abs(kvot * 100 - 100);
        const g = { yrke, nKv: kv.length, nMa: ma.length, tot, samladMedian: false,
            medKv, medMa, kvot, gapPct, flaggad: gapPct > troskel,
            p10Kv: quantile(kv, 0.1), p90Kv: quantile(kv, 0.9), p10Ma: quantile(ma, 0.1), p90Ma: quantile(ma, 0.9) };
        if (g.flaggad) g.stabilitet = _stabilitet(kv, ma, { k, troskel });
        grupper.push(g);
    }
    grupper.sort((a, b) => b.gapPct - a.gapPct);
    return { grupper, utelamnade, ejJamforbara };
}

/**
 * Könsgap inom ett yrke efter hänsyn till ålder (och BAS när yrket finns i flera BAS):
 * OLS på log(lön). Kräver båda könen ≥ k och n ≥ antal parametrar + 5.
 * @param {any[]} rader
 * @param {{k:number}} opts
 * @returns {{gapPct: number, n: number} | {forFa: true} | {ejSkattbar: true}}
 */
function justeratGapInomYrke(rader, { k }) {
    const d = (rader || []).filter(r => r.lon > 0 && r.alder > 0 && (_arKvinna(r) || _arMan(r)));
    const nKv = d.filter(_arKvinna).length, nMa = d.length - nKv;
    if (nKv < k || nMa < k) return { forFa: true };
    const basLista = [...new Set(d.map(r => r.bas))].sort();
    const dummies = basLista.slice(1);
    const p = 3 + dummies.length;
    if (d.length < p + 5) return { forFa: true };
    const X = d.map(r => [1, _arKvinna(r) ? 1 : 0, r.alder, ...dummies.map(b => (r.bas === b ? 1 : 0))]);
    const y = d.map(r => Math.log(r.lon));
    const fit = fitOLS(X, y);
    // Singulär modell: kön och BAS sammanfaller inom yrket (t.ex. alla kvinnor i ett BAS).
    if (!fit || !isFinite(fit.beta[1])) return { ejSkattbar: true };
    return { gapPct: (Math.exp(fit.beta[1]) - 1) * 100, n: d.length };
}

// ---- Block: faktastycke, tabell, redan prövat, frågor ----

const FRAGOR_YRKE = Object.freeze([
    'Har kvinnor och män i gruppen olika uppdrag, ansvar eller arbetsinnehåll?',
    'Finns individuella lönetillägg eller särskilda uppdrag (marknad, bristyrke, specialistroll)?',
    'Hur har lönen satts vid nyanställning under de senaste åren, och skiljer det sig mellan könen?',
    'Finns skillnader i erfarenhet, kompetens eller utbildning som påverkar lönesättningen?',
    'Hur har lönekriterierna tillämpats vid den senaste lönerevisionen?',
    'Finns tidsbegränsade eller personliga lösningar (t.ex. garantilön, lönetrappa) i gruppen?',
]);
const FRAGOR_PAR = Object.freeze([
    'Ställer yrkena likvärdiga krav på kunskap och färdigheter, ansvar, ansträngning och arbetsförhållanden?',
    'Stämmer BAS-placeringen med befattningsbeskrivningarna?',
    'Finns marknadsfaktorer eller rekryteringsläge som påverkar jämförelseyrket?',
    'Finns skillnader i arbetstid, arbetsmiljö eller ansvar som inte syns i BAS?',
]);

/** Svenskt talformat (decimalkomma, hårt mellanslag som tusentalsavgränsare). */
function formatTal(v, dec = 0) {
    if (v == null || !isFinite(v)) return '–';
    const t = new Intl.NumberFormat('sv-SE', { minimumFractionDigits: dec, maximumFractionDigits: dec }).format(v);
    // Ett negativt tal som avrundas till noll ska inte bli "−0" (samma avrundning som övriga tabeller).
    return /^[-−]0(,0+)?$/.test(t) ? t.slice(1) : t;
}
const _st = (n, en, flera) => `${formatTal(n)} ${n === 1 ? en : flera}`;
const _kr = v => (v == null || !isFinite(v)) ? '–' : `${formatTal(v, 0)} kr`;
const _pct = (v, dec = 1) => (v == null || !isFinite(v)) ? '–' : `${formatTal(v, dec)} %`;
const _ki = (lo, hi) => (lo < 0 || hi < 0) ? `${formatTal(lo, 1)} till ${formatTal(hi, 1)}` : `${formatTal(lo, 1)}–${formatTal(hi, 1)}`;
// Beräkningen tar bara fram de topN största paren. Nåddes gränsen (räknat före k-filtret)
// kan fler finnas, och antalet i texten är då ett tak, inte hela antalet.
const _kapad = u => !!u.topN && (u.par || []).length + (u.exkluderade || 0) >= u.topN;
const _kapadText = u => `Fler kan finnas: beräkningen tar fram de ${u.topN} största paren, och maxantalet ändras i Likvärdigt arbete.`;
const _inled = ({ demo, urval, troskelNot }) => ({
    fore: demo ? ['DEMODATA — inte verkliga löner.'] : [],
    efter: [...(urval ? [`Urval: ${urval}.`] : []), ...(troskelNot ? [troskelNot] : [])],
});

// ---- Stabilitet för flaggor (ADR-24) ----
// Median av en sorterad lista utan positionerna i `bort` (stigande, unika).
function _medianUtanPos(s, bort) {
    const n = s.length - bort.length;
    const vid = p => { let q = p; for (const b of bort) { if (b <= q) q++; else break; } return s[q]; };
    return n % 2 ? vid((n - 1) / 2) : (vid(n / 2 - 1) + vid(n / 2)) / 2;
}
// Ytterlägen och positioner inom 2 från medianen — övriga borttagningar ger samma median
// som något av ytterlägena.
function _kandidater(n) {
    const set = new Set([0, n - 1]);
    for (let i = Math.floor((n - 1) / 2) - 2; i <= Math.ceil((n - 1) / 2) + 2; i++) if (i >= 0 && i < n) set.add(i);
    return [...set].sort((a, b) => a - b);
}
function _stabilitet(kv, ma, { k, troskel }) {
    const sKv = [...kv].sort((a, b) => a - b), sMa = [...ma].sort((a, b) => a - b);
    const cKv = _kandidater(sKv.length), cMa = _kandidater(sMa.length);
    const gap = (bKv, bMa) => Math.abs(_medianUtanPos(sKv, bKv) / _medianUtanPos(sMa, bMa) * 100 - 100);
    const par = c => c.flatMap((a, i) => c.slice(i + 1).map(b => [a, b]));
    const kanKv = m => sKv.length - m >= k, kanMa = m => sMa.length - m >= k;
    let min1 = Infinity, min2 = Infinity;
    if (kanKv(1)) for (const i of cKv) min1 = Math.min(min1, gap([i], []));
    if (kanMa(1)) for (const j of cMa) min1 = Math.min(min1, gap([], [j]));
    if (kanKv(2)) for (const p of par(cKv)) min2 = Math.min(min2, gap(p, []));
    if (kanMa(2)) for (const p of par(cMa)) min2 = Math.min(min2, gap([], p));
    if (kanKv(1) && kanMa(1)) for (const i of cKv) for (const j of cMa) min2 = Math.min(min2, gap([i], [j]));
    const begransad = !kanKv(1) && !kanMa(1) ? 'bada' : !kanKv(1) ? 'kvinnor' : !kanMa(1) ? 'man' : null;
    if (begransad === 'bada') return { niva: 'stabil', lagstaGapPct: null, begransad, provadeMax: 0 };
    const niva = min1 <= troskel ? 'skor1' : min2 <= troskel ? 'skor2' : 'stabil';
    const lagstaGapPct = niva === 'skor1' ? min1 : (Number.isFinite(min2) ? min2 : min1);
    // provadeMax: flest borttagna som faktiskt kunde prövas (k-gränsen kan stoppa två).
    return { niva, lagstaGapPct, begransad, provadeMax: Number.isFinite(min2) ? 2 : 1 };
}
const _tillagg = st => st.begransad === 'kvinnor' ? ' (prövat bara på män)' : st.begransad === 'man' ? ' (prövat bara på kvinnor)' : '';

/** Kort märkning för tabellen i Lika arbete. */
function stabilitetKort(st, k) {
    if (!st) return '';
    if (st.begransad === 'bada') return `Kan inte prövas: båda könen har exakt ${k} personer`;
    const t = _tillagg(st);
    if (st.niva === 'skor1') return `Skör: kan bli ${formatTal(st.lagstaGapPct, 1)} % om 1 person tas bort${t}`;
    if (st.niva === 'skor2') return `Skör: kan bli ${formatTal(st.lagstaGapPct, 1)} % om 2 personer tas bort${t}`;
    if (st.provadeMax === 1) return `Stabil: över 5 % även utan 1 person, fler kunde inte prövas${t}`;
    return `Stabil: över 5 % även utan 2 personer${t}`;
}
function _kanslighet(st, k) {
    if (st.begransad === 'bada') return `Känslighet: kunde inte prövas eftersom båda könen har exakt ${k} personer.`;
    const t = _tillagg(st);
    if (st.niva === 'skor1') return `Känslighet: skillnaden kan sjunka till ${_pct(st.lagstaGapPct)} om en person tas bort${t}.`;
    if (st.niva === 'skor2') return `Känslighet: skillnaden kan sjunka till ${_pct(st.lagstaGapPct)} om två personer tas bort${t}.`;
    if (st.provadeMax === 1) return `Känslighet: skillnaden ligger kvar över 5 % även om en person tas bort; fler kunde inte prövas${t}.`;
    return `Känslighet: skillnaden ligger kvar över 5 % även om två personer tas bort${t}.`;
}

/**
 * Block för en flaggad yrkesgrupp i Lika arbete.
 * @param {any} g
 * @param {{id?:string, justerat?:any, ki?:any, urval?:any, demo?:boolean, k?:number, troskelNot?:string|null, arsbelopp?:string|null}} [opts]
 */
function gruppBlock(g, { id, justerat, ki, urval, demo, k = 10, troskelNot, arsbelopp } = {}) {
    const { fore, efter } = _inled({ demo, urval, troskelNot });
    let fakta = `Inom ${g.yrke} (n = ${g.tot}, varav ${g.nKv} kvinnor och ${g.nMa} män) är kvinnornas medianlön `
        + `${_pct(g.kvot * 100)} av männens` + (ki ? ` (95 % KI ${_ki(ki.lo, ki.hi)})` : '') + '.';
    let provat;
    if (justerat && justerat.ejSkattbar) {
        provat = ['Ålder och BAS kunde inte prövas eftersom kön och BAS sammanfaller i yrket (kvinnor och män finns i olika BAS).'];
    } else if (justerat && !justerat.forFa) {
        fakta += ` Efter hänsyn till ålder och BAS inom yrket återstår en skillnad på ${_pct(justerat.gapPct)}.`;
        const ra = (g.kvot - 1) * 100, ju = justerat.gapPct;
        const siffror = `(${_pct(ra)} före justering, ${_pct(ju)} efter)`;
        if (ra !== 0 && ju !== 0 && Math.sign(ra) !== Math.sign(ju)) {
            provat = [`Efter hänsyn till ålder och BAS inom yrket byter skillnaden tecken ${siffror}. Råskillnaden och den justerade skillnaden mäter olika saker (median respektive genomsnitt i en modell) och bör läsas var för sig.`];
        } else if (Math.abs(ju) < Math.abs(ra)) {
            provat = [`Ålder och BAS inom yrket förklarar ${formatTal(Math.abs(ra) - Math.abs(ju), 1)} procentenheter av skillnaden ${siffror}.`];
        } else {
            provat = [`Ålder och BAS inom yrket förklarar inte skillnaden ${siffror}.`];
        }
    } else {
        provat = ['För få personer för att justera för ålder och BAS.'];
    }
    if (g.stabilitet) provat = [...provat, _kanslighet(g.stabilitet, k)];
    return {
        id, rubrik: g.yrke,
        // arsbelopp: räkneexemplet i kronor per år, byggt av anroparen.
        stycken: [...fore, fakta, ...(arsbelopp ? [arsbelopp] : []), ...efter],
        tabell: { rubriker: ['', 'Antal', 'P10', 'Median', 'P90'], rader: [
            ['Kvinnor', String(g.nKv), _kr(g.p10Kv), _kr(g.medKv), _kr(g.p90Kv)],
            ['Män', String(g.nMa), _kr(g.p10Ma), _kr(g.medMa), _kr(g.p90Ma)]] },
        provat, fragor: [...FRAGOR_YRKE],
    };
}

/**
 * Block för ett kandidatpar i Likvärdigt arbete.
 * @param {any} p
 * @param {{id?:string, kravProxy?:any, urval?:any, demo?:boolean, troskelNot?:string|null}} [opts]
 */
function parBlock(p, { id, kravProxy, urval, demo, troskelNot } = {}) {
    const { fore, efter } = _inled({ demo, urval, troskelNot });
    const kiPct = p.gapCI && p.kvMedian > 0 ? { lo: p.gapCI.lo / p.kvMedian * 100, hi: p.gapCI.hi / p.kvMedian * 100 } : null;
    const fakta = `${p.kvLabel} (BAS ${p.kvBas}, ${formatTal(p.kvKvinnoPct, 0)} % kvinnor, median ${_kr(p.kvMedian)}) har `
        + `${_kr(p.gapKr)} lägre medianlön än ${p.maLabel} (BAS ${p.maBas}, median ${_kr(p.maMedian)}). `
        + `Jämförelseyrkets median ligger ${_pct(p.gapPct)} högre` + (kiPct ? ` (95 % KI ${_ki(kiPct.lo, kiPct.hi)} %)` : '') + '.'
        // Den råa skillnaden är det lagen prövar; den åldersjusterade (bara interna par) visar vad som kan bero på åldersstruktur.
        + (p.aldersJusterad && isFinite(p.aldersJusterad.gapPct) ? ` Justerat för ålder: ${_pct(p.aldersJusterad.gapPct)}.` : '');
    const proxy = kravProxy === 'poäng'
        ? 'Jämförelsen bygger på arbetsvärderingspoäng som mått på krav.'
        : 'Jämförelsen bygger på BAS-intervall som mått på krav.';
    const kalla = p.jamforKalla === 'extern' ? ' Jämförelseyrket kommer från jämförelsestatistiken.' : '';
    return {
        id, rubrik: `${p.kvLabel} — ${p.maLabel}`,
        stycken: [...fore, fakta, proxy + kalla, ...efter],
        tabell: { rubriker: ['Yrke', 'BAS', 'Andel kvinnor', 'Antal', 'Median'], rader: [
            [p.kvLabel, p.kvBas, _pct(p.kvKvinnoPct, 0), String(p.kvN), _kr(p.kvMedian)],
            [p.maLabel, p.maBas, _pct(p.maKvAndel, 0), p.maN == null ? '–' : String(p.maN), _kr(p.maMedian)]] },
        provat: null, fragor: [...FRAGOR_PAR],
    };
}

/** Avsnittsblock per lagsteg: 'sammanfattning' | 'uppdelning' | 'lika' | 'likvardigt' | 'lagreKrav' | 'struktur' | 'handlingsplan'. */
/**
 * @param {string} typ
 * @param {any} u
 * @param {{k:number, urval?:any, demo?:boolean, troskelNot?:string|null}} opts
 */
function avsnittBlock(typ, u, { k, urval, demo, troskelNot }) {
    const { fore, efter } = _inled({ demo, urval, troskelNot });
    const blk = (rubrik, stycken, tabell) => ({ id: typ, rubrik, stycken: [...fore, ...stycken, ...efter], tabell, provat: null, fragor: null });
    if (typ === 'sammanfattning') {
        // k-anonymitet: med ett kön under k i urvalet redovisas inga könsuppdelade lönemått.
        const litet = u.nKv < k || u.nMa < k;
        const kvot = !litet && u.medMa > 0 ? u.medKv / u.medMa * 100 : null;
        const st = [`Underlaget omfattar ${formatTal(u.n)} anställda, varav ${formatTal(u.nKv)} kvinnor och ${formatTal(u.nMa)} män.`
            + (litet ? ` Könsuppdelade lönemått redovisas inte eftersom ett kön har färre än ${k} personer i urvalet.`
                     : ` Kvinnornas medianlön är ${_kr(u.medKv)} och männens ${_kr(u.medMa)}, vilket motsvarar ${_pct(kvot)} av männens.`)];
        if (u.oforklarat && !litet) {
            st.push(u.oforklarat.medBas === false
                ? `Efter hänsyn till ålder är det oförklarade lönegapet ${_pct(u.oforklarat.pct)} (95 % KI ${_ki(u.oforklarat.lo, u.oforklarat.hi)} %). BAS-intervall kunde inte tas med i modellen.`
                : `Efter hänsyn till ålder och BAS är det oförklarade lönegapet ${_pct(u.oforklarat.pct)} (95 % KI ${_ki(u.oforklarat.lo, u.oforklarat.hi)} %).`);
        }
        if (u.kvalitet) {
            const etikett = { ok: 'OK', varning: 'Varning', kritisk: 'Kritisk' }[u.kvalitet.status];
            st.push(`Underlagets kvalitet: ${etikett}` + (u.kvalitet.brister.length ? ` (${u.kvalitet.brister.join(', ')}).` : '.'));
        }
        const rader = [['Antal anställda', formatTal(u.n)], ['Kvinnor', formatTal(u.nKv)], ['Män', formatTal(u.nMa)]];
        if (!litet) {
            rader.push(['Medianlön kvinnor', _kr(u.medKv)], ['Medianlön män', _kr(u.medMa)], ['Kvinnors lön i % av mäns', _pct(kvot)]);
            if (u.oforklarat) rader.push([u.oforklarat.medBas === false ? 'Oförklarat lönegap (ålder)' : 'Oförklarat lönegap (ålder och BAS)', _pct(u.oforklarat.pct)]);
        }
        return blk('Sammanfattning', st, { rubriker: ['Nyckeltal', 'Värde'], rader });
    }
    if (typ === 'uppdelning') {
        const R = 'Var uppstår löneskillnaden?';
        if (!u) return blk(R, [`För få personer för att dela upp skillnaden: ett kön har färre än ${k} personer i urvalet.`], null);
        const inledning = `Kvinnornas medellön är ${_kr(u.medel.kv)} och männens ${_kr(u.medel.ma)}, en skillnad på ${_kr(u.gap)} (${_pct(u.gapPct)} av männens).`;
        if (u.skyddad === false) return blk(R, [inledning, `Skillnaden delas inte upp här: en grupp med färre än ${k} personer står för så stor del av en av delarna att dess bidrag annars skulle kunna räknas fram.`], null);
        const { A, B, C } = u.delar;
        const st = [`${inledning} Beloppen är kvinnor mot män: negativa belopp betyder att kvinnornas medellön är lägre.`,
            `Av skillnaden beror ${_kr(A)} på att kvinnor och män är olika fördelade över BAS, ${_kr(B)} på olika AID inom samma BAS och ${_kr(C)} på löneskillnader inom samma AID och BAS.`];
        if (u.litetGap) st.push('Skillnaden är mindre än 1 % av männens medellön. Delarna kan då peka åt olika håll och vara större än själva skillnaden.');
        const andel = v => u.litetGap ? '—' : _pct(v / u.gap * 100, 0);
        // Samma poster som kortet: listan är redan kortad efter skyddsregeln, och en kortare
        // lista här kunde bryta den (gapuppdelning.js).
        const storst = d => u.topp[d].map(p => `${p.namn} (${_kr(p.kr)})`).join('; ') || '—';
        return blk(R, st, { rubriker: ['Del', 'Bidrag (kr)', 'Andel av skillnaden', 'Störst bidrag'], rader: [
            ['BAS-fördelning', _kr(A), andel(A), storst('A')],
            ['AID inom BAS', _kr(B), andel(B), storst('B')],
            ['Inom AID och BAS', _kr(C), andel(C), storst('C')],
            ['Totalt', _kr(u.gap), u.litetGap ? '—' : '100 %', ''],
        ] });
    }
    if (typ === 'lika') {
        const g = u.grupper || [];
        const flagg = g.filter(x => x.flaggad), samlade = g.filter(x => x.samladMedian);
        const jamforda = g.length + (u.utelamnade || []).length;
        const st = [`${_st(jamforda, 'yrkesgrupp', 'yrkesgrupper')} jämfördes. ${flagg.length} har en skillnad över 5 % mellan kvinnors och mäns medianlön. `
            + `${samlade.length} redovisas med samlad median eftersom ett kön har färre än ${k} personer, och ${(u.utelamnade || []).length} utelämnas helt.`];
        if (!flagg.length) return blk('Lika arbete', [...st, 'Ingen yrkesgrupp har en skillnad över 5 %.'], null);
        return blk('Lika arbete', st, { rubriker: ['Yrkesgrupp', 'Kvinnor', 'Män', 'Median kvinnor', 'Median män', 'Kvinnors lön i % av mäns'],
            rader: flagg.map(x => [x.yrke, String(x.nKv), String(x.nMa), _kr(x.medKv), _kr(x.medMa), _pct(x.kvot * 100)]) });
    }
    if (typ === 'likvardigt') {
        const par = u.par || [];
        const proxy = u.kravProxy === 'poäng' ? 'arbetsvärderingspoäng' : 'BAS-intervall';
        const st = [(_kapad(u) ? `De ${u.topN} största kandidatparen` : `${par.length} kandidatpar`)
            + ` där ett kvinnodominerat yrke har lägre medianlön än ett yrke med lika eller lägre krav. Kraven mäts med ${proxy}.`
            + (u.kvinnoTroskel != null ? ` Ett yrke räknas som kvinnodominerat vid minst ${formatTal(u.kvinnoTroskel)} % kvinnor.` : '')];
        if (_kapad(u)) st.push(_kapadText(u));
        if (u.exkluderade) st.push(`${u.exkluderade} par med en grupp under ${k} personer redovisas inte här.`);
        if (!par.length) return blk('Likvärdigt arbete', [...st, 'Inga kandidatpar att redovisa.'], null);
        const kiText = p => (p.gapCI && p.kvMedian > 0) ? `${_ki(p.gapCI.lo / p.kvMedian * 100, p.gapCI.hi / p.kvMedian * 100)} %` : '–';
        return blk('Likvärdigt arbete', st, { rubriker: ['Kvinnodominerat yrke', 'Jämförelseyrke', 'Skillnad (kr)', 'Skillnad (%)', '95 % KI'],
            rader: par.map(p => [`${p.kvLabel} (BAS ${p.kvBas})`, `${p.maLabel} (BAS ${p.maBas})`, _kr(p.gapKr), _pct(p.gapPct), kiText(p)]) });
    }
    if (typ === 'lagreKrav') {
        const R = 'Lägre krav, högre lön';
        if (u.kravProxy === 'poäng') return blk(R, ['Med arbetsvärderingspoäng jämförs yrken över BAS-gränserna redan i Likvärdigt arbete.'], null);
        const par = u.par || [];
        const st = [(_kapad(u) ? `De ${u.topN} största paren` : `${par.length} par`)
            + ' där ett kvinnodominerat yrke har lägre medianlön än ett av organisationens yrken i lägre BAS. Kraven mäts med BAS-intervall, ett grovt mått som bör prövas mot befattningsbeskrivningarna.'];
        if (_kapad(u)) st.push(_kapadText(u));
        if (u.exkluderade) st.push(`${u.exkluderade} par med en grupp under ${k} personer redovisas inte här.`);
        if (!par.length) return blk(R, [...st, 'Inget kvinnodominerat yrke har lägre medianlön än ett yrke i lägre BAS.'], null);
        const kiText = p => (p.gapCI && p.kvMedian > 0) ? `${_ki(p.gapCI.lo / p.kvMedian * 100, p.gapCI.hi / p.kvMedian * 100)} %` : '–';
        const b = blk(R, st, { rubriker: ['Kvinnodominerat yrke', 'Jämförelseyrke', 'BAS-steg', 'Skillnad (kr)', 'Skillnad (%)', '95 % KI'],
            rader: par.map(p => [`${p.kvLabel} (BAS ${p.kvBas})`, `${p.maLabel} (BAS ${p.maBas})`, String(p.basSteg), _kr(p.gapKr), _pct(p.gapPct), kiText(p)]) });
        return { ...b, fragor: [...FRAGOR_PAR] };
    }
    if (typ === 'struktur') {
        const kv = u.kvartiler || [];
        const st = ['Könsfördelning och medianlön per BAS-intervall.'];
        const kvartilOk = !(u.nKv < k || u.nMa < k);   // k: kvartilandelar röjer annars ett litet kön
        if (kv.length && kvartilOk) st.push('Andel kvinnor per lönekvartil: ' + kv.map(q => `kvartil ${q.q} ${_pct(q.andelKv, 0)}`).join(', ') + '.');
        const rep = u.representation || [];
        const utelamnade = rep.filter(r => r.n < k).length;
        if (utelamnade) st.push(`${_st(utelamnade, 'BAS-intervall', 'BAS-intervall')} med färre än ${k} personer redovisas inte.`);
        return blk('Struktur och lönetransparens', st, { rubriker: ['BAS', 'Antal', 'Andel kvinnor', 'Median', 'Kvinnors lön jämfört med mäns'],
            rader: rep.filter(r => r.n >= k).map(r => [r.bas, String(r.n), _pct(r.andelKv),
                _kr(r.median),
                (r.nKv >= k && r.nMa >= k && r.gapPct != null) ? _pct(r.gapPct) : '–']) });
    }
    if (typ === 'sektorer') {
        // Sektorsöversikten (ADR-33): samma k-regler som vyn.
        const alla = u.sektorer || [];
        const visas = alla.filter(r => !r.maskerad);
        const st = ['Kvinnors lön i procent av mäns per sektor (AID-huvudområde), rå och justerad för ålder och BAS-intervall.'];
        const a = u.andel;
        if (a && a.andel != null) st.push(Math.abs(a.andel) < 0.01
            ? `Skillnaden i medellön för hela organisationen (${_kr(a.gapKr)} per månad) beror nästan inte alls på att kvinnor och män arbetar i olika sektorer (under 1 %).`
            : `Av skillnaden i medellön för hela organisationen (${_kr(a.gapKr)} per månad) beror ${_kr(a.sektorKr)} (${_pct(a.andel * 100)}) på att kvinnor och män arbetar i olika sektorer.`);
        const dolda = alla.length - visas.length;
        if (dolda) st.push(`${_st(dolda, 'sektor', 'sektorer')} med färre än ${k} personer redovisas inte.`);
        const skr = visas.find(r => r.skrAndelKv != null);
        if (skr) st.push(`Andel kvinnor i samma sektor i ${skrDelText(skr.skrDel)} enligt SKR:s personalstatistik står som referens.`);
        return blk('Per sektor (AID-huvudområde)', st, { rubriker: ['Sektor', 'Antal', 'Andel kvinnor', 'Andel kvinnor, SKR', 'Kvinnors lön i % av mäns', 'Justerad (ålder, BAS)'],
            rader: visas.map(r => [r.namn, String(r.n), _pct(r.andelKv), r.skrAndelKv != null ? _pct(r.skrAndelKv) : '–',
                !r.samladMedian && r.kvot != null ? _pct(r.kvot) : '–',
                !r.samladMedian && r.justerat ? _pct(100 + r.justerat.pct) : '–']) });
    }
    if (typ === 'handlingsplan') {
        const rader = u.rader || [];
        const st = [`${_st(rader.length, 'förifylld åtgärd', 'förifyllda åtgärder')}` + (u.summa ? ` med en uppskattad kostnad på ${_kr(u.summa)} per år.` : '.')];
        if (!rader.length) return blk('Handlingsplan', st, null);
        return blk('Handlingsplan', st, { rubriker: ['Åtgärd', 'Grupp', 'Underlag', 'Uppskattad kostnad per år'],
            rader: rader.map(r => [r.atgard, r.grupp, r.underlag, _kr(r.kostnad)]) });
    }
    throw new Error(`Okänd avsnittstyp: ${typ}`);
}

const _esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Ren HTML för urklipp: inga typsnitt, färger eller klasser — mallen formaterar. */
function tillWordHtml(b) {
    let h = `<h3>${_esc(b.rubrik)}</h3>`;
    for (const s of b.stycken) h += `<p>${_esc(s)}</p>`;
    if (b.tabell) {
        h += '<table border="1" cellpadding="4"><thead><tr>' + b.tabell.rubriker.map(r => `<th>${_esc(r)}</th>`).join('') + '</tr></thead><tbody>'
            + b.tabell.rader.map(r => '<tr>' + r.map(c => `<td>${_esc(c)}</td>`).join('') + '</tr>').join('') + '</tbody></table>';
    }
    if (b.provat) h += '<p><strong>Redan prövat</strong></p><ul>' + b.provat.map(p => `<li>${_esc(p)}</li>`).join('') + '</ul>';
    if (b.fragor) h += '<p><strong>Frågor till verksamheten</strong></p><ol>' + b.fragor.map(f => `<li>${_esc(f)}</li>`).join('') + '</ol>';
    return h;
}

/**
 * Ett block för en egen tabell ur Utforska (ADR-52): tabellen som receptet gav (receptTillTabeller), med talen
 * skrivna efter kolumnens typ, och tabellens not som stycke.
 * @param {{rubrik: string, kolumner: {rubrik: string, typ: string}[], rader: any[][], not?: string}} t
 * @param {{id: string, k?: number, urval?: string, demo?: boolean, troskelNot?: string}} val
 */
function egenTabellBlock(t, { id, urval, demo, troskelNot }) {
    const { fore, efter } = _inled({ demo, urval, troskelNot });
    const skriv = (v, typ) => {
        if (v == null || v === '') return '–';
        if (typeof v !== 'number') return String(v);
        if (!isFinite(v)) return '–';
        return typ === 'kr' ? _kr(v) : typ === 'pct1' ? _pct(v, 1) : typ === 'antal' ? formatTal(v, 0) : formatTal(v, 2);
    };
    return { id, rubrik: t.rubrik, stycken: [...fore, ...(t.not ? [t.not] : []), ...efter], provat: null, fragor: null,
        tabell: { rubriker: t.kolumner.map(c => c.rubrik), rader: t.rader.map(r => r.map((v, j) => skriv(v, (t.kolumner[j] || {}).typ))) } };
}

/** Ren text för urklipp (reserv): tabbar mellan kolumner, numrerade frågor. */
function tillText(b) {
    const delar = [b.rubrik, ...b.stycken];
    if (b.tabell) delar.push([b.tabell.rubriker, ...b.tabell.rader].map(r => r.join('\t')).join('\n'));
    if (b.provat) delar.push('Redan prövat:\n' + b.provat.map(p => `- ${p}`).join('\n'));
    if (b.fragor) delar.push('Frågor till verksamheten:\n' + b.fragor.map((f, i) => `${i + 1}. ${f}`).join('\n'));
    return delar.join('\n\n');
}

    return { likaArbeteGrupper, justeratGapInomYrke, gruppBlock, parBlock, avsnittBlock, tillWordHtml, tillText, stabilitetKort, egenTabellBlock };
})();
const _ruLikaArbeteGrupper = __mirrorRapportunderlag.likaArbeteGrupper;
const _ruJusteratGap = __mirrorRapportunderlag.justeratGapInomYrke;
const _ruGruppBlock = __mirrorRapportunderlag.gruppBlock;
const _ruParBlock = __mirrorRapportunderlag.parBlock;
const _ruAvsnittBlock = __mirrorRapportunderlag.avsnittBlock;
const _ruTillWordHtml = __mirrorRapportunderlag.tillWordHtml;
const _ruTillText = __mirrorRapportunderlag.tillText;
const _ruStabilitetKort = __mirrorRapportunderlag.stabilitetKort;
const _ruEgenTabellBlock = __mirrorRapportunderlag.egenTabellBlock;

// ---- speglar src/lib/gapuppdelning.js ----
const __mirrorGapuppdelning = (() => {
    // importer ur tidigare speglade lib-moduler
    const groupKey = __mirrorFalt.groupKey;
    const konOf = __mirrorFalt.konOf;

// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
/**
 * Öppen lönekartläggning — Var uppstår löneskillnaden? (ADR-22)
 *
 * Delar gapet i medellön (kvinnor − män, kr/mån; negativt när kvinnor ligger lägre) i tre delar som summerar exakt:
 *   A  BAS-fördelning       Σ_b Δs_b · (W̄_b − W̄)
 *   B  AID inom BAS         Σ_b s̄_b · Σ_a Δs_a|b · (W̄_ab − W̄_b)
 *   C  inom AID och BAS     Σ_b s̄_b · Σ_a s̄_a|b · ΔW_ab
 * Δx = x_kvinnor − x_män, x̄ = (x_män + x_kvinnor) / 2 (symmetriskt, inget referenskön).
 * Saknas ett kön i en grupp sätts dess medellön lika med det andra könets; gruppen
 * bidrar då bara till fördelningsdelen. Centreringen (− W̄, − W̄_b) ändrar inga summor
 * eftersom Σ Δs = 0, men gör varje grupps post tolkbar.
 *
 * Webbläsarbygget får en AUTO-GENERERAD spegel i src/app/09-lib-speglar.js.
 */


const _medel = rader => rader.reduce((s, r) => s + r.lon, 0) / rader.length;

function _grupper(kv, ma, nyckel) {
    const m = new Map();
    const lagg = (r, g) => {
        const key = nyckel(r);
        if (!m.has(key)) m.set(key, { kv: [], ma: [] });
        m.get(key)[g].push(r);
    };
    kv.forEach(r => lagg(r, 'kv'));
    ma.forEach(r => lagg(r, 'ma'));
    return m;
}

// Andelar och medellöner för en grupp; saknat kön får det andra könets medellön.
function _cell(g, totKv, totMa, k) {
    const wKv0 = g.kv.length ? _medel(g.kv) : null, wMa0 = g.ma.length ? _medel(g.ma) : null;
    // Grupperna kommer ur _grupper och har alltid minst en person, så båda blir tal; ?? 0 för typkontrollen.
    const wKv = wKv0 ?? wMa0 ?? 0, wMa = wMa0 ?? wKv0 ?? 0;
    return {
        sKv: g.kv.length / totKv, sMa: g.ma.length / totMa, wKv, wMa, w: (wKv + wMa) / 2,
        bada: g.kv.length > 0 && g.ma.length > 0,
        synlig: (g.kv.length === 0 || g.kv.length >= k) && (g.ma.length === 0 || g.ma.length >= k),
    };
}

/** @typedef {{namn:string, kr:number, synlig:boolean}} Post */

// Alla poster per del, med synlig = båda könen i gruppen (och för B/C även BAS:en) har 0 eller
// minst k personer. null när ett kön har färre än k i hela urvalet.
function _beraknaPoster(rader, k) {
    const kv = [], ma = [];
    for (const r of rader || []) {
        if (!(r.lon > 0)) continue;
        const g = konOf(r);
        if (g === 'Kvinna') kv.push(r);
        else if (g === 'Man') ma.push(r);
    }
    if (kv.length < k || ma.length < k) return null;

    const medel = { kv: _medel(kv), ma: _medel(ma) };
    const wTot = (medel.ma + medel.kv) / 2;
    /** @type {{A: Post[], B: Post[], C: Post[]}} */
    const poster = { A: [], B: [], C: [] };

    for (const [bas, gb] of _grupper(kv, ma, r => r.bas || '—')) {
        const b = _cell(gb, kv.length, ma.length, k);
        poster.A.push({ namn: `BAS ${bas}`, kr: (b.sKv - b.sMa) * (b.w - wTot), synlig: b.synlig });
        if (!b.bada) continue;   // ΔW_b = 0 — BAS:en bidrar varken till B eller C
        const sb = (b.sKv + b.sMa) / 2;
        for (const [aid, ga] of _grupper(gb.kv, gb.ma, r => groupKey(r, 'aid'))) {
            const a = _cell(ga, gb.kv.length, gb.ma.length, k);
            const namn = `${aid}, BAS ${bas}`;
            // BAS-medellönen (båda könens) ingår i B-posten, så även BAS:en måste klara k.
            const synlig = a.synlig && b.synlig;
            poster.B.push({ namn, kr: sb * (a.sKv - a.sMa) * (a.w - b.w), synlig });
            poster.C.push({ namn, kr: sb * ((a.sKv + a.sMa) / 2) * (a.wKv - a.wMa), synlig });
        }
    }
    return { kv, ma, medel, poster };
}

/** Samtliga poster, även dolda — bara för tester av skyddsregeln; redovisas aldrig. */
/**
 * @param {any[]} rader
 * @param {{k?:number}} [opts]
 */
function gapPoster(rader, { k } = {}) {
    const r = _beraknaPoster(rader, k);
    return r ? r.poster : null;
}

// Skyddsregel för topplistan. Det som inte visas i en del är delens summa minus de visade
// posterna. Den som läser vet inte beloppen eller tecknen på de enskilda posterna i resten,
// så osäkerheten om en dold grupps bidrag h är summan av |belopp| för ALLA ANDRA poster i
// resten (dolda och ej visade synliga). Den ska vara minst SKYDD · |h| för varje dold post med
// |h| ≥ 0,5 kr. Håller det inte tas den minsta visade posten bort ur listan (den går in i
// resten) tills regeln håller. De dolda gruppernas summa redovisas aldrig.
// Håller regeln inte ens med tom lista består delen i praktiken av den dolda gruppen; då
// redovisas inga delar alls (skyddad: false) — A + B + C = hela skillnaden, så en enskild del
// kan inte döljas medan de andra visas.
const SKYDD = 0.5;
function _skyddad(poster, visade) {
    const vis = new Set(visade);
    const rest = poster.filter(p => !vis.has(p));
    const brus = rest.reduce((s, p) => s + Math.abs(p.kr), 0);
    return rest.filter(p => !p.synlig && Math.abs(p.kr) >= 0.5)
        .every(h => brus - Math.abs(h.kr) >= SKYDD * Math.abs(h.kr));
}

/**
 * @param {any[]} rader
 * @param {{k?:number}} [opts]
 */
function gapUppdelning(rader, { k } = {}) {
    const r = _beraknaPoster(rader, k);
    if (!r) return null;
    const { kv, ma, medel, poster } = r;
    const gap = medel.kv - medel.ma;   // kvinnor mot män, som i resten av verktyget

    const delar = {}, topp = {}, ovrigaAntal = {};
    let skyddad = true;
    for (const d of ['A', 'B', 'C']) {
        delar[d] = poster[d].reduce((s, p) => s + p.kr, 0);
        ovrigaAntal[d] = poster[d].filter(p => !p.synlig).length;
        // Poster som avrundas till 0 kr säger inget och visas inte (de ingår i delen).
        const visade = poster[d].filter(p => p.synlig && Math.abs(p.kr) >= 0.5)
            .sort((x, y) => Math.abs(y.kr) - Math.abs(x.kr) || x.namn.localeCompare(y.namn, 'sv'))
            .slice(0, 3);
        while (visade.length && !_skyddad(poster[d], visade)) visade.pop();
        if (!_skyddad(poster[d], visade)) skyddad = false;
        topp[d] = visade.map(({ namn, kr }) => ({ namn, kr }));
    }
    const gapPct = gap / medel.ma * 100;
    const bas = { n: { kv: kv.length, ma: ma.length }, medel, gap, gapPct, litetGap: Math.abs(gapPct) < 1 };
    if (!skyddad) return { ...bas, skyddad: false, delar: null, topp: null, ovrigaAntal: null };
    return { ...bas, skyddad: true, delar, topp, ovrigaAntal };
}

    return { gapUppdelning };
})();
const _guGapUppdelning = __mirrorGapuppdelning.gapUppdelning;

// ---- speglar src/lib/individflaggor.js ----
const __mirrorIndivid = (() => {
    // importer ur tidigare speglade lib-moduler
    const groupKey = __mirrorFalt.groupKey;
    const konOf = __mirrorFalt.konOf;

// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
/**
 * Öppen lönekartläggning — Personer att granska (ADR-23)
 *
 * För varje person i en grupp med samma AID och BAS (minst minGrupp personer) räknas en
 * förväntad lön från KOLLEGORNA (utan personen själv): ln(lön) = a + b·ålder när
 * kollegornas åldersspridning är minst 5 år, annars kollegornas medianlön. Personen
 * flaggas när lönen ligger minst `grans` procent under den förväntade. Allt i O(n log n)
 * per grupp: summorna för regressionen och den sorterade lönelistan räknas en gång och
 * personen dras bort.
 *
 * Webbläsarbygget får en AUTO-GENERERAD spegel i src/app/09-lib-speglar.js.
 */


// Median av en sorterad lista där ett exemplar av värdet v tas bort.
function _medianUtan(sorterad, v) {
    let lo = 0, hi = sorterad.length;
    while (lo < hi) { const m = (lo + hi) >> 1; if (sorterad[m] < v) lo = m + 1; else hi = m; }
    const bort = lo, n = sorterad.length - 1;
    const vid = p => sorterad[p < bort ? p : p + 1];
    return n % 2 ? vid((n - 1) / 2) : (vid(n / 2 - 1) + vid(n / 2)) / 2;
}

function _grupp(g, grans) {
    const n = g.length, m = n - 1;
    const medelAlder = g.reduce((s, r) => s + r.alder, 0) / n;
    const x = g.map(r => r.alder - medelAlder), y = g.map(r => Math.log(r.lon));
    let Sx = 0, Sy = 0, Sxx = 0, Sxy = 0;
    for (let i = 0; i < n; i++) { Sx += x[i]; Sy += y[i]; Sxx += x[i] * x[i]; Sxy += x[i] * y[i]; }
    const aldrar = g.map(r => r.alder).sort((a, b) => a - b);
    const loner = g.map(r => r.lon).sort((a, b) => a - b);
    const ut = [];
    for (let i = 0; i < n; i++) {
        const r = g[i];
        const lagst = r.alder === aldrar[0] ? aldrar[1] : aldrar[0];
        const hogst = r.alder === aldrar[n - 1] ? aldrar[n - 2] : aldrar[n - 1];
        const sx = Sx - x[i], sy = Sy - y[i], sxx = Sxx - x[i] * x[i], sxy = Sxy - x[i] * y[i];
        const vxx = sxx - sx * sx / m;
        let forvantad, metod;
        if (hogst - lagst >= 5 && vxx > 1e-9) {
            const b = (sxy - sx * sy / m) / vxx, a = (sy - b * sx) / m;
            forvantad = Math.exp(a + b * x[i]); metod = 'alder';
        } else {
            forvantad = _medianUtan(loner, r.lon); metod = 'median';
        }
        const avvikelsePct = (r.lon - forvantad) / forvantad * 100;
        if (avvikelsePct <= -grans) {
            ut.push({ radnr: r.radnr ?? null, kon: konOf(r), alder: r.alder, aid: groupKey(r, 'aid'), bas: r.bas,
                      lon: r.lon, forvantad, avvikelsePct, kollegor: m, metod, ansvarsgrupp: r.ansvarsgrupp ?? null });
        }
    }
    return ut;
}

function flaggaIndivider(rader, { minGrupp = 10, grans = 10 } = {}) {
    const grupper = new Map();
    for (const r of rader || []) {
        if (!(r.lon > 0) || !(r.alder > 0)) continue;
        const kon = konOf(r);
        if (kon !== 'Kvinna' && kon !== 'Man') continue;
        const nyckel = `${groupKey(r, 'aid')}\u0000${r.bas}`;
        if (!grupper.has(nyckel)) grupper.set(nyckel, []);
        grupper.get(nyckel).push(r);
    }
    const provade = { kv: 0, ma: 0 };
    let ejProvade = 0;
    const flaggade = [];
    for (const g of grupper.values()) {
        if (g.length < minGrupp) { ejProvade += g.length; continue; }
        for (const r of g) konOf(r) === 'Kvinna' ? provade.kv++ : provade.ma++;
        flaggade.push(..._grupp(g, grans));
    }
    flaggade.sort((a, b) => a.avvikelsePct - b.avvikelsePct || (a.radnr ?? Infinity) - (b.radnr ?? Infinity));
    const tot = provade.kv + provade.ma;
    const kvFlagg = flaggade.filter(f => f.kon === 'Kvinna').length;
    return { provade, ejProvade, flaggade, andelKv: {
        provade: tot ? provade.kv / tot * 100 : null,
        flaggade: flaggade.length ? kvFlagg / flaggade.length * 100 : null,
    } };
}

    return { flaggaIndivider };
})();
const _ifFlaggaIndivider = __mirrorIndivid.flaggaIndivider;

// ---- speglar src/lib/utforska.js ----
const __mirrorUtforska = (() => {
    // importer ur tidigare speglade lib-moduler
    const median = __mirrorStat.median;
    const quantile = __mirrorStat.quantile;
    const groupKey = __mirrorFalt.groupKey;
    const konOf = __mirrorFalt.konOf;
    const jamforAldersgrupp = __mirrorFalt.jamforAldersgrupp;
    const jamforLonespann = __mirrorFalt.jamforLonespann;
    const jamforSektor = __mirrorAid.jamforSektor;
    const mellannivaEtikett = __mirrorAid.mellannivaEtikett;
    const huvudomrade = __mirrorAid.huvudomrade;
    const personFilter = __mirrorUrval.personFilter;
    const uppfyllerGrupp = __mirrorUrval.uppfyllerGrupp;
    const gruppVillkorAktivt = __mirrorUrval.gruppVillkorAktivt;

// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
/**
 * Öppen lönekartläggning — Utforska: pivot över lönerader
 *
 * Ren kärna bakom Utforska-fliken: urval (src/lib/urval.js), gruppering på en eller två
 * dimensioner, mått och k-markering. Vet ingenting om DOM, ritaren eller state.
 *
 * DÖLJER INGENTING. Små grupper (n < k) räknas och markeras med `liten`, och
 * grupper där ena könet är under k med `konLiten`. Vyn tonar dem och exporten
 * utelämnar dem som standard (ADR-14). Regeln bor här, på ett ställe.
 *
 * Webbläsarbygget får en AUTO-GENERERAD spegel i src/app/09-lib-speglar.js
 * (tools/gen-mirrors.mjs). Ändra här och kör `npm run build:app`.
 */




const DIMENSIONER = ['bas', 'aid', 'alder', 'kon', 'alla', 'aidbas', 'lonespann', 'sektor', 'aidniva'];
const MATT = ['median', 'medel', 'n', 'p10', 'p25', 'p75', 'p90', 'spridning', 'andelKv', 'gap'];
// Mått som inte går att dela upp per kön (de ÄR en jämförelse mellan könen).
const UTAN_KONSUPPDELNING = new Set(['andelKv', 'gap']);

function _hink() { return { lons: [], kv: [], ma: [] }; }
function _lagg(h, r) {
    h.lons.push(r.lon);
    const k = konOf(r);
    if (k === 'Kvinna') h.kv.push(r.lon);
    else if (k === 'Man') h.ma.push(r.lon);
}
// Mått på en lönelista. Används både för gruppen och för varje kön.
function _matt(lons, matt) {
    if (!lons.length) return null;
    switch (matt) {
        case 'n': return lons.length;
        case 'medel': return lons.reduce((s, v) => s + v, 0) / lons.length;
        case 'p10': return quantile(lons, 0.10);
        case 'p25': return quantile(lons, 0.25);
        case 'p75': return quantile(lons, 0.75);
        case 'p90': return quantile(lons, 0.90);
        case 'spridning': {
            const p10 = quantile(lons, 0.10);
            return p10 > 0 ? quantile(lons, 0.90) / p10 : null;
        }
        default: return median(lons);
    }
}
function _varde(h, matt) {
    if (matt === 'andelKv') {
        const t = h.kv.length + h.ma.length;
        return t ? (h.kv.length / t) * 100 : null;
    }
    if (matt === 'gap') {
        if (!h.kv.length || !h.ma.length) return null;
        const mm = median(h.ma);
        return mm > 0 ? (median(h.kv) / mm) * 100 : null;
    }
    return _matt(h.lons, matt);
}
function _sortera(dim, etiketter, varden, matt) {
    if (dim === 'bas') return etiketter.sort((a, b) => a.localeCompare(b, 'sv'));
    if (dim === 'alder') return etiketter.sort(jamforAldersgrupp);
    if (dim === 'lonespann') return etiketter.sort(jamforLonespann);
    if (dim === 'sektor') return etiketter.sort(jamforSektor);
    if (dim === 'aidniva') return etiketter.sort((a, b) => (a.startsWith('AID ') ? 0 : 1) - (b.startsWith('AID ') ? 0 : 1) || a.localeCompare(b, 'sv'));   // okänd kod sist
    const v = l => varden.get(l);
    if (matt === 'gap') return etiketter.sort((a, b) => (v(a) ?? Infinity) - (v(b) ?? Infinity));
    return etiketter.sort((a, b) => (v(b) ?? -Infinity) - (v(a) ?? -Infinity));
}

/**
 * Hopslagning av små AID-grupper (bara i Utforska, ADR-33): grupper under k slås
 * ihop per AID-mellannivå; räcker inte summan, per sektor. Grupper som fortfarande är under k
 * behåller sin nyckel (och visas som små). Nyckel = groupKey(r, 'aid').
 * @returns {Map<string, string>} aid-nyckel → ersättningsnyckel ("Övriga i AID 2070xx (2 yrken)")
 */
function slaIhopSmaAid(rows, k) {
    const n = new Map(), aidAv = new Map();
    for (const r of rows || []) {
        const key = groupKey(r, 'aid');
        n.set(key, (n.get(key) || 0) + 1);
        aidAv.set(key, r.aid);
    }
    const sma = [...n.keys()].filter(key => n.get(key) < k);
    const ut = new Map();
    const slaIhop = nivaAv => {
        const grupper = new Map();
        for (const key of sma.filter(x => !ut.has(x))) {
            const niva = nivaAv(aidAv.get(key));
            if (!niva) continue;
            if (!grupper.has(niva)) grupper.set(niva, []);
            grupper.get(niva).push(key);
        }
        for (const [niva, keys] of grupper) {
            if (keys.length < 2) continue;
            if (keys.reduce((s, key) => s + n.get(key), 0) < k) continue;
            const namn = `Övriga i ${niva} (${keys.length} yrken)`;
            keys.forEach(key => ut.set(key, namn));
        }
    };
    slaIhop(aid => mellannivaEtikett(aid));
    slaIhop(aid => huvudomrade(aid)?.namn ?? null);   // okänd sektor slås inte ihop
    return ut;
}

/**
 * Pivot över lönerader.
 * @param {any[]} rows - lönerader ({ bas, aid, yrke, yrkeLabel, lon, alder, kon })
 * @param {{rad:string, kolumn?:string|null, matt?:string, delaKon?:boolean, urval?:any, gruppVillkor?:any[], slaIhop?:boolean}} spec
 * @param {{k?:number}} [opts]
 */
function computePivot(rows, spec, { k = 10 } = {}) {
    const rad = spec.rad;
    const kol = spec.kolumn && spec.kolumn !== rad ? spec.kolumn : null;
    const matt = spec.matt && MATT.includes(spec.matt) ? spec.matt : 'median';
    const delaKon = !!spec.delaKon && rad !== 'kon' && kol !== 'kon' && !UTAN_KONSUPPDELNING.has(matt);
    const urvalSpec = spec.urval || { lage: 'alla', villkor: [] };
    const gruppVillkor = spec.gruppVillkor || [];
    const aktivaGrupp = gruppVillkor.filter(g => gruppVillkorAktivt(g) && MATT.includes(g.matt));
    const person = personFilter(urvalSpec);

    const urvalRader = (rows || []).filter(r => r.lon > 0 && person(r));
    // Hopslagning av små AID-grupper, bara när raderna är AID (ADR-33).
    const ersatt = spec.slaIhop && rad === 'aid' ? slaIhopSmaAid(urvalRader, k) : null;
    const urval = { n: urvalRader.length, nKv: 0, nMa: 0 };
    const cellHinkar = new Map(), radHinkar = new Map(), kolHinkar = new Map();
    for (const r of urvalRader) {
        const ko = konOf(r);
        if (ko === 'Kvinna') urval.nKv++;
        else if (ko === 'Man') urval.nMa++;
        const rk0 = groupKey(r, rad);
        const rk = ersatt && ersatt.has(rk0) ? ersatt.get(rk0) : rk0;
        if (rk == null) continue;
        let kk = null;
        if (kol) {
            kk = groupKey(r, kol);
            if (kk == null) continue;
        }
        const nyckel = kol ? rk + '\u0000' + kk : rk;
        if (!cellHinkar.has(nyckel)) cellHinkar.set(nyckel, { rad: rk, kol: kk, h: _hink() });
        _lagg(cellHinkar.get(nyckel).h, r);
        if (kol) {
            if (!radHinkar.has(rk)) radHinkar.set(rk, _hink());
            _lagg(radHinkar.get(rk), r);
            if (!kolHinkar.has(kk)) kolHinkar.set(kk, _hink());
            _lagg(kolHinkar.get(kk), r);
        }
    }

    // Gruppvillkor prövas per cell, på cellens egna löner.
    let dolda = 0;
    const kvar = [...cellHinkar.values()].filter(({ h }) => {
        if (!aktivaGrupp.length) return true;
        // Gap räknat på ett kön under k får inte avgöra om gruppen visas — då
        // skulle gruppens närvaro i exporten röja det (ADR-12/14).
        const varden = Object.fromEntries(aktivaGrupp.map(g => [g.matt,
            (g.matt === 'gap' && (h.kv.length < k || h.ma.length < k)) ? null : _varde(h, g.matt)]));
        if (uppfyllerGrupp(varden, aktivaGrupp)) return true;
        dolda++;
        return false;
    });
    const celler = kvar.map(({ rad: rk, kol: kk, h }) => ({
        rad: rk, kol: kk,
        n: h.lons.length, nKv: h.kv.length, nMa: h.ma.length,
        value: _varde(h, matt),
        valueKv: delaKon ? _matt(h.kv, matt) : null,
        valueMa: delaKon ? _matt(h.ma, matt) : null,
        liten: h.lons.length < k,
        konLiten: h.kv.length < k || h.ma.length < k
    }));

    /** @type {string[]} */ let radEtiketter;
    /** @type {string[]|null} */ let kolumnEtiketter = null;
    if (kol) {
        const totalvarden = hinkar => new Map([...hinkar].map(([l, h]) => [l, _varde(h, matt)]));
        const radMed = new Set(celler.map(c => c.rad)), kolMed = new Set(celler.map(c => c.kol));
        radEtiketter = _sortera(rad, [...radHinkar.keys()].filter(l => radMed.has(l)), totalvarden(radHinkar), matt);
        kolumnEtiketter = _sortera(kol, [...kolHinkar.keys()].filter(l => kolMed.has(l)), totalvarden(kolHinkar), matt);
    } else {
        radEtiketter = _sortera(rad, celler.map(c => c.rad), new Map(celler.map(c => [c.rad, c.value])), matt);
    }
    const ri = new Map(radEtiketter.map((l, i) => [l, i]));
    const ki = kol && kolumnEtiketter ? new Map(kolumnEtiketter.map((l, i) => [l, i])) : null;
    celler.sort((a, b) => ((ri.get(a.rad) ?? 0) - (ri.get(b.rad) ?? 0)) || (ki ? (ki.get(a.kol) ?? 0) - (ki.get(b.kol) ?? 0) : 0));

    return { spec: { rad, kolumn: kol, matt, delaKon, urval: urvalSpec, gruppVillkor, slaIhop: !!ersatt },
             radEtiketter, kolumnEtiketter, celler, urval, dolda };
}

    return { computePivot };
})();
const _utComputePivot = __mirrorUtforska.computePivot;

// ---- speglar src/lib/attgora.js ----
const __mirrorAttgora = (() => {
// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
/**
 * Öppen lönekartläggning — regler för Att göra och processöversikten (ADR-29).
 *
 * Ren logik utan DOM och state: vilka punkter som visas under Börja här och när ett
 * analyssteg i processöversikten räknas som klart. Appen (18-atgardslista.js,
 * 13-oversikt.js) bygger punkterna och skickar in dem.
 *
 * Webbläsarbygget får en AUTO-GENERERAD spegel i src/app/09-lib-speglar.js.
 */

/** Kategorier för fynd som gäller skillnader mellan kvinnor och män (lagkravet). */
const KONSRELATERADE = ['Lika arbete', 'EU 2023/970', 'Likvärdigt arbete'];

const PRIORITET = { 'hög': 0, medel: 1, 'låg': 2 };

/**
 * Rang inom samma prioritet: underlaget först (fel i data påverkar allt), sedan de
 * könsrelaterade fynden, sist avvikelser mot lönepolitiken och övriga iakttagelser.
 */
function attGoraRang(punkt) {
    if (/^(Underlag|Datakvalitet)/.test(punkt.kategori)) return 0;
    return KONSRELATERADE.includes(punkt.kategori) ? 1 : 2;
}

/**
 * Börja här: de första ej avbockade punkterna, i ordningen prioritet → rang → ursprunglig.
 * @param {Array<{id:string, kategori:string, prioritet:string, [k:string]:any}>} punkter
 * @param {Set<string>} klar  id för avbockade punkter
 */
function borjaHar(punkter, klar, antal = 3) {
    return punkter.map((punkt, i) => ({ punkt, i })).filter(x => !klar.has(x.punkt.id))
        .sort((a, b) => (PRIORITET[a.punkt.prioritet] ?? 3) - (PRIORITET[b.punkt.prioritet] ?? 3)
            || attGoraRang(a.punkt) - attGoraRang(b.punkt) || a.i - b.i)
        .slice(0, antal).map(x => x.punkt);
}

/** Antal punkter (t) och antal avbockade (d) inom kategorierna. */
function hanterade(punkter, klar, kategorier) {
    const egna = punkter.filter(punkt => kategorier.includes(punkt.kategori));
    return { t: egna.length, d: egna.filter(punkt => klar.has(punkt.id)).length };
}

/** Steg 3, Lika arbete: klart när regressionen gått att köra och alla punkter är hanterade. */
function stegLikaArbete({ regressionOk, t, d }) {
    if (!regressionOk) return { status: 'delvis', detail: 'Underlaget räcker ännu inte för en tillförlitlig regression.' };
    return {
        status: d >= t ? 'klar' : 'delvis',
        detail: t ? `Oförklarat gap beräknat · ${d} av ${t} punkter hanterade i Att göra.`
                  : 'Oförklarat gap beräknat — inga punkter att förklara eller åtgärda.',
    };
}

/**
 * Steg 4, Likvärdigt arbete: klart när analysen inte hittar par, eller när alla par är hanterade. Finns bara par
 * med en grupp under minsta gruppstorlek (`utelamnade`, de redovisas bara i fliken Likvärdigt arbete) finns inget
 * att hantera i Att göra — men steget är inte klart: tillståndet `inget` pekar till fliken (beslut av
 * produktägaren 2026-10-16).
 */
function stegLikvardigt({ analys, antalPar, utelamnade = 0, k, t, d }) {
    if (!analys) return { status: 'ej', detail: 'Granska likvärdiga arbeten på fliken.' };
    if (antalPar === 0 && utelamnade > 0) {
        return { status: 'inget', detail: `Inget att hantera i Att göra: ${utelamnade} par har en grupp under ${k != null ? `${k} personer` : 'minsta gruppstorlek'} och redovisas bara i fliken Likvärdigt arbete — gå till steget för att granska dem.` };
    }
    if (antalPar === 0) return { status: 'klar', detail: 'Analysen körd — inga kandidatpar utifrån nuvarande trösklar.' };
    return {
        status: t > 0 && d >= t ? 'klar' : 'delvis',
        detail: `${antalPar} kandidatpar (kvinnodominerade mot likvärdiga yrken) · ${d} av ${t} kandidatpar hanterade i Att göra.`,
    };
}

    return { borjaHar, hanterade, stegLikaArbete, stegLikvardigt };
})();
const _agBorjaHar = __mirrorAttgora.borjaHar;
const _agHanterade = __mirrorAttgora.hanterade;
const _agStegLikaArbete = __mirrorAttgora.stegLikaArbete;
const _agStegLikvardigt = __mirrorAttgora.stegLikvardigt;

// ---- speglar src/lib/sektor.js ----
const __mirrorSektor = (() => {
    // importer ur tidigare speglade lib-moduler
    const fitOLS = __mirrorStat.fitOLS;
    const median = __mirrorStat.median;
    const basRangFn = __mirrorLikvardighet.basRangFn;
    const sektorsnamn = __mirrorAid.sektorsnamn;
    const jamforSektor = __mirrorAid.jamforSektor;
    const konOf = __mirrorFalt.konOf;
    const skrKvinnoandelSektor = __mirrorSkrReferens.skrKvinnoandelSektor;

// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
/**
 * Öppen lönekartläggning — sektorsöversikten (ADR-33).
 *
 * En sektor är ett AID-huvudområde. Per sektor: antal, andel kvinnor, medianer och kvot med samma
 * k-regler som Lika arbete (ett kön under k → samlad median; gruppen under k → maskerad), justerad
 * skillnad (OLS: log lön ~ kön + ålder + BAS-rang) när sektorn har ≥ 30 personer och ≥ k av varje
 * kön, och sektorernas andel av gapet i medellön (samma symmetriska formel som del A i
 * gapuppdelning.js, med sektor i stället för BAS).
 *
 * Webbläsarbygget får en AUTO-GENERERAD spegel i src/app/09-lib-speglar.js.
 */





const MIN_REGRESSION = 30;

function _justerat(rader, k) {
    const giltiga = rader.filter(r => r.lon > 0 && r.alder > 0 && konOf(r) !== 'Övrig/okänd');
    const nKv = giltiga.filter(r => konOf(r) === 'Kvinna').length;
    if (giltiga.length < MIN_REGRESSION || nKv < k || giltiga.length - nKv < k) return null;
    const basLista = [...new Set(giltiga.map(r => r.bas))];
    const rang = basRangFn(basLista);
    const alderMedel = giltiga.reduce((s, r) => s + r.alder, 0) / giltiga.length;
    const basMedel = giltiga.reduce((s, r) => s + rang(r.bas), 0) / giltiga.length;
    const X = giltiga.map(r => [1, konOf(r) === 'Kvinna' ? 1 : 0, r.alder - alderMedel, rang(r.bas) - basMedel]);
    const y = giltiga.map(r => Math.log(r.lon));
    let fit = fitOLS(X, y);
    if (!fit) fit = fitOLS(X.map(x => x.slice(0, 3)), y);   // en enda BAS i sektorn
    if (!fit) return null;
    const se = Math.sqrt(fit.vcovHC3[1][1]);
    const b = fit.beta[1];
    return { pct: (Math.exp(b) - 1) * 100, low: (Math.exp(b - 1.96 * se) - 1) * 100, high: (Math.exp(b + 1.96 * se) - 1) * 100 };
}

/**
 * @param {any[]} rader - lönerader ({ aid, kon, lon, alder, bas, ansvarsgrupp? })
 * @param {{k:number, punkter?:Object<string, number>, skrDel?:string}} opts - punkter i Att göra per sektorsnamn;
 *        skrDel = organisationstypen ('alla' | 'kommun' | 'region') för SKR-referensen
 */
function sektorsTabell(rader, { k, punkter = {}, skrDel = 'alla' }) {
    const per = new Map();
    for (const r of rader || []) {
        if (!(r.lon > 0)) continue;
        const namn = sektorsnamn(r.aid);
        if (!per.has(namn)) per.set(namn, []);
        per.get(namn).push(r);
    }
    const harAnsvar = (rader || []).some(r => r.ansvarsgrupp);
    return [...per.keys()].sort(jamforSektor).map(namn => {
        const g = per.get(namn);
        const kv = g.filter(r => konOf(r) === 'Kvinna'), ma = g.filter(r => konOf(r) === 'Man');
        const n = g.length, maskerad = n < k;
        const bada = kv.length >= k && ma.length >= k;
        const medKv = !maskerad && bada ? median(kv.map(r => r.lon)) : null;
        const medMa = !maskerad && bada ? median(ma.map(r => r.lon)) : null;
        const just = maskerad ? null : _justerat(g, k);
        const andelLedning = grupp => (grupp.length ? grupp.filter(r => r.ansvarsgrupp === 'ledning').length / grupp.length * 100 : null);
        return {
            namn, n, nKv: kv.length, nMa: ma.length,
            andelKv: n ? kv.length / n * 100 : null,
            skrAndelKv: skrKvinnoandelSektor(namn, { del: skrDel })?.pct ?? null,   // referens: SKR:s personalstatistik
            skrDel: skrKvinnoandelSektor(namn, { del: skrDel })?.del ?? null,
            maskerad, samladMedian: !maskerad && !bada,
            medTot: maskerad ? null : median(g.map(r => r.lon)),
            medKv, medMa, kvot: medKv != null && medMa != null && medMa > 0 ? medKv / medMa * 100 : null,
            justerat: just, justeratSkal: maskerad ? null : (just ? 'ok' : 'fa'),
            antalAid: new Set(g.map(r => r.aid)).size,
            punkter: punkter[namn] || 0,
            ledningKv: harAnsvar && !maskerad && kv.length >= k ? andelLedning(kv) : null,
            ledningMa: harAnsvar && !maskerad && ma.length >= k ? andelLedning(ma) : null,
        };
    });
}

/**
 * Sektorernas andel av gapet i medellön (män − kvinnor): Σ_s Δs_s · (W̄_s − W̄).
 * Null när ett kön har färre än k personer: gapet i kronor tillsammans med gapet i procent
 * (Struktur) ger annars det lilla könets medellön — samma regel som gapuppdelning.js.
 */
function sektorernasAndel(rader, { k = 10 } = {}) {
    const kv = (rader || []).filter(r => r.lon > 0 && konOf(r) === 'Kvinna');
    const ma = (rader || []).filter(r => r.lon > 0 && konOf(r) === 'Man');
    if (!kv.length || !ma.length || kv.length < k || ma.length < k) return null;
    const medel = a => a.reduce((s, r) => s + r.lon, 0) / a.length;
    const gapKr = medel(ma) - medel(kv);
    const namn = [...new Set([...kv, ...ma].map(r => sektorsnamn(r.aid)))];
    const cell = s => {
        const k = kv.filter(r => sektorsnamn(r.aid) === s), m = ma.filter(r => sektorsnamn(r.aid) === s);
        const wK = k.length ? medel(k) : medel(m), wM = m.length ? medel(m) : medel(k);
        return { dS: m.length / ma.length - k.length / kv.length, w: (wK + wM) / 2, sBar: (m.length / ma.length + k.length / kv.length) / 2 };
    };
    const celler = namn.map(cell);
    const wBar = celler.reduce((s, c) => s + c.sBar * c.w, 0);
    const sektorKr = celler.reduce((s, c) => s + c.dS * (c.w - wBar), 0);
    return { gapKr, sektorKr, andel: Math.abs(gapKr) > 1e-9 ? sektorKr / gapKr : null };
}

    return { sektorsTabell, sektorernasAndel };
})();
const _skSektorsTabell = __mirrorSektor.sektorsTabell;
const _skSektorernasAndel = __mirrorSektor.sektorernasAndel;

// ---- speglar src/lib/ansvar.js ----
const __mirrorAnsvar = (() => {
    // importer ur tidigare speglade lib-moduler
    const median = __mirrorStat.median;
    const konOf = __mirrorFalt.konOf;

// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
/**
 * Öppen lönekartläggning — AID:s ansvarskod (ADR-33; AID-handboken s. 9–13).
 *
 * Koder: A, B, C (chef), L (annan ledningspersonal), F (funktionsansvar), M (läkare med bakjour
 * eller medicinskt ansvarsområde), 1001 (lektor), 1002 (förstelärare). En sista position kan
 * användas lokalt (C1, 10013) och ignoreras. Flera koder per person tillåts. Analyserna använder
 * bara tre ansvarsgrupper. Kolumnen "Ansvar" är oftast ett kostnadsställe och läses aldrig.
 *
 * Webbläsarbygget får en AUTO-GENERERAD spegel i src/app/09-lib-speglar.js.
 */


const ANSVARSGRUPP_NAMN = Object.freeze({ ledning: 'Ledningsansvar', uppdrag: 'Särskilt uppdrag', inget: 'Inget särskilt ansvar' });
const LEDNING = new Set(['A', 'B', 'C', 'L']);
const EN_KOD = /^(?:([ABCLFM])[0-9A-Z]?|(100[12])[0-9A-Z]?)$/;

/** Ett cellvärde → lista med koder; [] för tomt; null om något ingående värde är ogiltigt. */
function tolkaAnsvarskod(v) {
    const s = String(v ?? '').trim().toUpperCase();
    if (!s) return [];
    const delar = s.split(/[\s,;]+/).filter(Boolean);
    const ut = [];
    for (const d of delar) {
        const m = EN_KOD.exec(d);
        if (!m) return null;
        const kod = m[1] || m[2];
        if (!ut.includes(kod)) ut.push(kod);
    }
    return ut;
}

/** 'ledning' om någon kod är A, B, C eller L; annars 'uppdrag' om F, M, 1001 eller 1002; annars 'inget'. */
function ansvarsgrupp(koder) {
    const k = koder || [];
    if (k.some(x => LEDNING.has(x))) return 'ledning';
    return k.length ? 'uppdrag' : 'inget';
}

/** Andelen giltiga av de ifyllda värdena, eller null om inga är ifyllda. */
function andelGiltiga(varden) {
    const ifyllda = (varden || []).filter(v => String(v ?? '').trim());
    if (!ifyllda.length) return null;
    return ifyllda.filter(v => tolkaAnsvarskod(v) !== null).length / ifyllda.length;
}

/** Kolumnrubrik som anger AID:s ansvarskod — aldrig bara "Ansvar". */
function arAnsvarskodRubrik(rubrik) {
    const r = String(rubrik ?? '').toLowerCase().replace(/å/g, 'a').replace(/ä/g, 'a').replace(/ö/g, 'o').replace(/[^a-z0-9]/g, '');
    return /ansvarskod|aidansvar|ansvarsniva/.test(r);
}

const ORDNING = ['ledning', 'uppdrag', 'inget'];

/**
 * Underrader per ansvarsgrupp inom en grupp (Lika arbete), med samma k-regler som yrkesraden:
 * gruppen under k → inga lönemått; ett kön under k → samlad median utan könsjämförelse.
 * @param {any[]} rader
 * @param {{k:number}} opts
 * @returns {any[]}
 */
function ansvarsUnderrader(rader, { k }) {
    return ORDNING.map(grupp => {
        const g = (rader || []).filter(r => r.ansvarsgrupp === grupp && r.lon > 0);
        if (!g.length) return null;
        const kv = g.filter(r => konOf(r) === 'Kvinna'), ma = g.filter(r => konOf(r) === 'Man');
        const liten = g.length < k, bada = kv.length >= k && ma.length >= k;
        const medKv = !liten && bada ? median(kv.map(r => r.lon)) : null;
        const medMa = !liten && bada ? median(ma.map(r => r.lon)) : null;
        return { grupp, namn: ANSVARSGRUPP_NAMN[grupp], n: g.length, nKv: kv.length, nMa: ma.length, liten,
            samladMedian: !liten && !bada, medTot: liten ? null : median(g.map(r => r.lon)),
            medKv, medMa, kvot: medKv != null && medMa != null && medMa > 0 ? medKv / medMa * 100 : null };
    }).filter(Boolean);
}

    return { tolkaAnsvarskod, ansvarsgrupp, andelGiltiga, arAnsvarskodRubrik, ansvarsUnderrader };
})();
const _anTolka = __mirrorAnsvar.tolkaAnsvarskod;
const _anGrupp = __mirrorAnsvar.ansvarsgrupp;
const _anAndelGiltiga = __mirrorAnsvar.andelGiltiga;
const _anArRubrik = __mirrorAnsvar.arAnsvarskodRubrik;
const _anUnderrader = __mirrorAnsvar.ansvarsUnderrader;

// ---- speglar src/lib/aidkontroll.js ----
const __mirrorAidkontroll = (() => {
    // importer ur tidigare speglade lib-moduler
    const etikett = __mirrorAid.etikett;
    const huvudomrade = __mirrorAid.huvudomrade;
    const arRestkod = __mirrorAid.arRestkod;
    const arLedningsetikett = __mirrorAid.arLedningsetikett;
    const normaliseraAid = __mirrorAid.normaliseraAid;
    const quantile = __mirrorStat.quantile;

// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
/**
 * Öppen lönekartläggning — kontroll av AID-kodningen (ADR-33).
 * Kriterierna har samma form som i datakvalitet.js och läggs till i Underlagets kvalitet.
 * Texterna redovisar antal och koder, aldrig enskilda personer eller löner.
 *
 * Webbläsarbygget får en AUTO-GENERERAD spegel i src/app/09-lib-speglar.js.
 */


const RESTKOD_GRANS = 10;      // % av personerna
const SPRIDNING_GRANS = 1.6;   // P90/P10

const pers = n => `${n} ${n === 1 ? 'person' : 'personer'}`;

/**
 * @param {any[]} rader
 * @param {{k:number, harAnsvar?:boolean}} opts
 */
function aidKriterier(rader, { k, harAnsvar = false }) {
    const alla = (rader || []).filter(Boolean);
    // En yrkeskolumn utan sexsiffriga koder (t.ex. befattningar i klartext) har ingen AID-kodning att pröva.
    const d = alla.filter(r => normaliseraAid(r.aid));
    if (!d.length) return [];
    const utanKod = alla.length - d.length;
    const ut = [];

    const okanda = d.filter(r => !etikett(r.aid) || !huvudomrade(r.aid));
    const okandaKoder = [...new Set(okanda.map(r => normaliseraAid(r.aid)))].slice(0, 5);
    const delar = [];
    if (okanda.length) delar.push(`${pers(okanda.length)} har en AID-kod som inte finns i SKR:s etikettlista (t.ex. ${okandaKoder.join(', ')}).`);
    if (utanKod) delar.push(`${pers(utanKod)} saknar en sexsiffrig AID-kod.`);
    ut.push({ id: 'aid-okanda', namn: 'AID-koder', status: delar.length ? 'varning' : 'ok', varde: okanda.length + utanKod,
        text: delar.length
            ? `${delar.join(' ')} De ingår i analyserna men får ingen sektor.`
            : 'Alla AID-koder finns i SKR:s etikettlista.' });

    const rest = d.filter(r => arRestkod(r.aid)).length;
    const restPct = d.length ? rest / d.length * 100 : 0;
    ut.push({ id: 'aid-restkoder', namn: 'Restkoder (annan/annat)', status: restPct > RESTKOD_GRANS ? 'varning' : 'ok', varde: restPct,
        text: !rest ? 'Ingen har en restkod (…090).'
            : `${pers(rest)} (${restPct.toFixed(1).replace('.', ',')} %) har en restkod (…090).`
            + (restPct > RESTKOD_GRANS ? ' Jämförelserna inom dessa grupper blir grövre — granska om en annan etikett passar bättre.' : '') });

    const per = new Map();
    d.forEach(r => { const key = normaliseraAid(r.aid); if (!per.has(key)) per.set(key, []); per.get(key).push(r.lon); });
    const breda = [...per].filter(([, l]) => l.length >= k).map(([aid, l]) => {
        const p10 = quantile(l, 0.1), p90 = quantile(l, 0.9);
        return { aid, kvot: p10 > 0 ? p90 / p10 : null };
    }).filter(x => x.kvot != null && x.kvot > SPRIDNING_GRANS);
    ut.push({ id: 'aid-spridning', namn: 'Lönespridning inom AID', status: breda.length ? 'varning' : 'ok', varde: breda.length,
        text: breda.length
            ? `${breda.length} AID-grupper har ovanligt stor lönespridning (P90/P10 över ${String(SPRIDNING_GRANS).replace('.', ',')}): ${breda.slice(0, 5).map(x => x.aid).join(', ')}. Värt att granska — det kan tyda på att olika arbeten har samma kod.`
            : 'Ingen AID-grupp har ovanligt stor lönespridning.' });

    if (harAnsvar) {
        const utanKod = d.filter(r => arLedningsetikett(r.aid) && !(r.ansvarskoder || []).some(x => 'ABCL'.includes(x) && x.length === 1)).length;
        ut.push({ id: 'aid-ledning-utan-ansvar', namn: 'Ledningsetikett utan ansvarskod', status: utanKod ? 'varning' : 'ok', varde: utanKod,
            text: utanKod ? `${pers(utanKod)} har en ledningsetikett (10xxxx) utan ansvarskod A, B, C eller L, som etikettlistan kräver.`
                : 'Alla med ledningsetikett har ansvarskod.' });
        const otillatna = d.filter(r => {
            const e = etikett(r.aid);
            return e && (r.ansvarskoder || []).some(x => !e.ansvarskoder.includes(x));
        }).length;
        ut.push({ id: 'aid-otillaten-ansvarskod', namn: 'Ansvarskod och etikett', status: otillatna ? 'varning' : 'ok', varde: otillatna,
            text: otillatna ? `${pers(otillatna)} har en ansvarskod som etikettlistan inte tillåter för etiketten (t.ex. A utanför ledningsarbete, F på en ledningsetikett, M för någon som inte är läkare).`
                : 'Alla ansvarskoder är tillåtna för sina etiketter.' });
    }
    return ut;
}

    return { aidKriterier };
})();
const _akAidKriterier = __mirrorAidkontroll.aidKriterier;

// ---- speglar src/lib/jamforelse.js ----
const __mirrorJamforelse = (() => {
    // importer ur tidigare speglade lib-moduler
    const median = __mirrorStat.median;
    const quantile = __mirrorStat.quantile;
    const sektorsnamn = __mirrorAid.sektorsnamn;

// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
/**
 * Öppen lönekartläggning — Jämförelsestatistik (ADR-35).
 *
 * Per yrke (AID-kodens siffror i början av yrket) och BAS-intervall: organisationens P10, median och P90,
 * jämförelsestatistikens och ställningstagandets värden och skillnaderna. Grupper med färre än k personer
 * tas inte med. Tabellen, diagrammen och den samlade Excelexporten läser samma rader.
 *
 * Webbläsarbygget får en AUTO-GENERERAD spegel i src/app/09-lib-speglar.js.
 */


const _pos = v => (typeof v === 'number' && v > 0 ? v : null);
const _tre = (p10, med, p90) => ({ p10: _pos(p10), median: _pos(med), p90: _pos(p90) });
const _diff = (org, ref) => (org != null && ref != null ? { kr: org - ref, pct: (org / ref - 1) * 100 } : null);
const _diffar = (org, ref) => ({ p10: _diff(org.p10, ref.p10), median: _diff(org.median, ref.median), p90: _diff(org.p90, ref.p90) });

/** AID-kodens inledande siffror, annars hela yrkessträngen. */
function aidAvYrke(yrke) {
    const m = String(yrke ?? '').match(/^(\d+)/);
    return m ? m[1] : String(yrke ?? '');
}

/**
 * @param {Array<{yrke:string, bas:string, lon:number}>} rader
 * @param {{statistik:Array, policyFor:(aid:string, bas:string)=>({p10?:number, med?:number, p90?:number}|null), k:number}} opt
 */
function jamforelseRader(rader, { statistik = [], policyFor = () => null, k }) {
    const perAid = new Map();   // aid → Map(bas → { yrke, lons })
    for (const r of rader || []) {
        const aid = aidAvYrke(r.yrke);
        if (!perAid.has(aid)) perAid.set(aid, new Map());
        const perBas = perAid.get(aid);
        if (!perBas.has(r.bas)) perBas.set(r.bas, { yrke: r.yrke, lons: [] });
        perBas.get(r.bas).lons.push(r.lon);
    }
    const ut = [], utelamnade = [];
    for (const [aid, perBas] of perAid) {
        for (const bas of [...perBas.keys()].sort()) {
            const { yrke, lons } = perBas.get(bas);
            if (lons.length < k) { utelamnade.push(`${aid} (BAS ${bas})`); continue; }
            const org = _tre(quantile(lons, 0.1), median(lons), quantile(lons, 0.9));
            const s = statistik.find(x => x.aid === aid && x.bas === bas) || statistik.find(x => x.aid === aid && !x.bas);
            const p = policyFor(aid, bas);
            const stat = _tre(s?.p10, s?.median, s?.p90), pol = _tre(p?.p10, p?.med, p?.p90);
            ut.push({ aid, yrke, bas, sektor: sektorsnamn(aid), n: lons.length, org, statistik: stat, stallningstagande: pol,
                diff: { statistik: _diffar(org, stat), stallningstagande: _diffar(org, pol) } });
        }
    }
    ut.sort((a, b) => (a.bas !== b.bas ? (a.bas < b.bas ? -1 : 1) : a.yrke < b.yrke ? -1 : a.yrke > b.yrke ? 1 : 0));
    return { rader: ut, utelamnade };
}

/** Underlaget till diagram 2: raderna med median i båda, mest negativ skillnad först. */
function avvikelseRangordning(rader, kalla) {
    return (rader || []).filter(r => r.diff[kalla] && r.diff[kalla].median)
        .sort((a, b) => a.diff[kalla].median.pct - b.diff[kalla].median.pct);
}

    return { jamforelseRader, avvikelseRangordning };
})();
const _jfRader = __mirrorJamforelse.jamforelseRader;
const _jfRangordning = __mirrorJamforelse.avvikelseRangordning;

// ---- speglar src/lib/docx.js ----
const __mirrorDocx = (() => {
// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
/**
 * Öppen lönekartläggning — Word-utkastet som .docx (ADR-37).
 *
 * Skriver en enkel blocklista (rubriker, stycken, tabeller, bilder) som Office Open XML-filer. Ingen DOM och
 * ingen zip här: appen packar filerna med JSZip. En bild är ett block `{ typ: 'bild', base64, bredd, hojd, alt,
 * text }` (PNG; mått i bildpunkter). Saknar blocket bilddata skrivs bara bildtexten, inom hakparentes.
 *
 * Webbläsarbygget får en AUTO-GENERERAD spegel i src/app/09-lib-speglar.js.
 */
const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
const TEXTBREDD = 9070;   // A4 11906 − 2 × 1418 twips
const WP = 'http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing';
const A = 'http://schemas.openxmlformats.org/drawingml/2006/main';
const PIC = 'http://schemas.openxmlformats.org/drawingml/2006/picture';
const EMU_PER_TWIP = 635, EMU_PER_PX = 9525;

/** Text för XML: escapad, utan tecken som är ogiltiga i XML 1.0. */
function xmlText(s) {
    return String(s ?? '')
        .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g, '')
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

const _kor = d => `<w:r>${d.fet || d.kursiv ? `<w:rPr>${d.fet ? '<w:b/>' : ''}${d.kursiv ? '<w:i/>' : ''}</w:rPr>` : ''}<w:t xml:space="preserve">${xmlText(d.text)}</w:t></w:r>`;
const _stycke = (delar, stil) => `<w:p>${stil ? `<w:pPr><w:pStyle w:val="${stil}"/></w:pPr>` : ''}${(delar || []).map(_kor).join('')}</w:p>`;
const STIL = { dampad: 'Dampad', fyllIn: 'FyllIn', utkastruta: 'Utkastruta' };

function _tabell(b) {
    const alla = [...(b.rubrikrad ? [b.rubrikrad] : []), ...(b.rader || [])];
    const kolumner = Math.max(1, ...alla.map(r => r.length));
    const bredd = Math.floor(TEXTBREDD / kolumner);
    const rad = (celler, rubrik) => {
        const fyllda = [...celler, ...Array(kolumner - celler.length).fill({ delar: [] })];
        return `<w:tr><w:trPr><w:cantSplit/>${rubrik ? '<w:tblHeader/>' : ''}</w:trPr>${fyllda.map(c =>
            `<w:tc><w:tcPr><w:tcW w:w="${bredd}" w:type="dxa"/>${rubrik ? '<w:shd w:val="clear" w:color="auto" w:fill="F0F0F0"/>' : ''}</w:tcPr>`
            + _stycke((c.delar || []).map(d => (rubrik ? { ...d, fet: true } : d))) + '</w:tc>').join('')}</w:tr>`;
    };
    return `<w:tbl><w:tblPr><w:tblStyle w:val="Tabell"/><w:tblW w:w="5000" w:type="pct"/></w:tblPr>`
        + `<w:tblGrid>${Array(kolumner).fill(`<w:gridCol w:w="${bredd}"/>`).join('')}</w:tblGrid>`
        + (b.rubrikrad ? rad(b.rubrikrad, true) : '') + (b.rader || []).map(r => rad(r, false)).join('') + '</w:tbl>';
}

const _harBild = b => b && b.typ === 'bild' && typeof b.base64 === 'string' && b.base64.length > 0 && b.bredd > 0 && b.hojd > 0;

/** En bild som eget, centrerat stycke, högst så bred som textytan, följd av bildtexten. `nr` börjar på 1. */
function _bild(b, nr) {
    const text = b.text ? _stycke([{ text: b.text }], STIL.dampad) : '';
    if (!_harBild(b)) return _stycke([{ text: `[Diagram: ${b.text || b.alt || 'utan rubrik'} — bilden kunde inte skapas]` }], STIL.dampad);
    const maxCx = TEXTBREDD * EMU_PER_TWIP;
    const cx = Math.min(maxCx, Math.round(b.bredd * EMU_PER_PX)), cy = Math.round(cx * b.hojd / b.bredd);
    const besk = xmlText(b.alt || b.text || `Diagram ${nr}`);
    return '<w:p><w:pPr><w:keepNext/><w:jc w:val="center"/></w:pPr><w:r><w:drawing>'
        + `<wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${cx}" cy="${cy}"/><wp:effectExtent l="0" t="0" r="0" b="0"/>`
        + `<wp:docPr id="${nr}" name="Bild ${nr}" descr="${besk}"/><wp:cNvGraphicFramePr><a:graphicFrameLocks noChangeAspect="1"/></wp:cNvGraphicFramePr>`
        + `<a:graphic><a:graphicData uri="${PIC}"><pic:pic><pic:nvPicPr><pic:cNvPr id="${nr}" name="bild${nr}.png" descr="${besk}"/><pic:cNvPicPr/></pic:nvPicPr>`
        + `<pic:blipFill><a:blip r:embed="rIdBild${nr}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>`
        + `<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr>`
        + '</pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>' + text;
}

function _dokument(block) {
    let nr = 0;
    const delar = block.map(b => (b.typ === 'rubrik' ? _stycke(b.delar, `Heading${b.niva}`)
        : b.typ === 'tabell' ? _tabell(b)
        : b.typ === 'bild' ? _bild(b, _harBild(b) ? ++nr : 0) : _stycke(b.delar, STIL[b.stil])));
    if (!block.length || block[block.length - 1].typ === 'tabell') delar.push('<w:p/>');   // stycke före sectPr
    return `${XML}<w:document xmlns:w="${W}" xmlns:r="${R}" xmlns:wp="${WP}" xmlns:a="${A}" xmlns:pic="${PIC}"><w:body>${delar.join('')}`
        + `<w:sectPr><w:footerReference w:type="default" r:id="rIdSidfot"/><w:pgSz w:w="11906" w:h="16838"/>`
        + `<w:pgMar w:top="1418" w:right="1418" w:bottom="1418" w:left="1418" w:header="709" w:footer="709" w:gutter="0"/></w:sectPr>`
        + '</w:body></w:document>';
}

function _stilar() {
    const ram = (typ, sz, farg) => ['top', 'left', 'bottom', 'right'].map(s => `<w:${s} w:val="${typ}" w:sz="${sz}" w:space="4" w:color="${farg}"/>`).join('');
    const rubrik = (id, namn, niva, sz, extra = '') => `<w:style w:type="paragraph" w:styleId="${id}"><w:name w:val="${namn}"/>`
        + `<w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:uiPriority w:val="9"/><w:qFormat/>`
        + `<w:pPr><w:keepNext/>${extra}<w:outlineLvl w:val="${niva}"/></w:pPr><w:rPr><w:b/><w:sz w:val="${sz}"/><w:szCs w:val="${sz}"/></w:rPr></w:style>`;
    return `${XML}<w:styles xmlns:w="${W}">`
        + '<w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:eastAsia="Calibri" w:cs="Calibri"/>'
        + '<w:sz w:val="22"/><w:szCs w:val="22"/><w:lang w:val="sv-SE"/></w:rPr></w:rPrDefault>'
        + '<w:pPrDefault><w:pPr><w:spacing w:after="120" w:line="264" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>'
        + '<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style>'
        + rubrik('Heading1', 'heading 1', 0, 40, '<w:spacing w:before="0" w:after="60"/>')
        + rubrik('Heading2', 'heading 2', 1, 28, '<w:pBdr><w:bottom w:val="single" w:sz="4" w:space="1" w:color="999999"/></w:pBdr><w:spacing w:before="360" w:after="120"/>')
        + rubrik('Heading3', 'heading 3', 2, 24, '<w:spacing w:before="240" w:after="80"/>')
        + '<w:style w:type="paragraph" w:customStyle="1" w:styleId="Dampad"><w:name w:val="Dämpad"/><w:basedOn w:val="Normal"/><w:qFormat/>'
        + '<w:rPr><w:color w:val="555555"/><w:sz w:val="19"/><w:szCs w:val="19"/></w:rPr></w:style>'
        + `<w:style w:type="paragraph" w:customStyle="1" w:styleId="FyllIn"><w:name w:val="Fyll i"/><w:basedOn w:val="Normal"/><w:qFormat/>`
        + `<w:pPr><w:pBdr>${ram('dashed', 4, 'B45309')}</w:pBdr><w:shd w:val="clear" w:color="auto" w:fill="FFF7D6"/><w:spacing w:before="120" w:after="120"/></w:pPr>`
        + '<w:rPr><w:sz w:val="21"/><w:szCs w:val="21"/></w:rPr></w:style>'
        + `<w:style w:type="paragraph" w:customStyle="1" w:styleId="Utkastruta"><w:name w:val="Utkastruta"/><w:basedOn w:val="Normal"/><w:qFormat/>`
        + `<w:pPr><w:pBdr>${ram('single', 12, 'B45309')}</w:pBdr><w:shd w:val="clear" w:color="auto" w:fill="FFF7ED"/><w:spacing w:after="240"/></w:pPr></w:style>`
        + '<w:style w:type="table" w:customStyle="1" w:styleId="Tabell"><w:name w:val="Tabell"/>'
        + '<w:rPr><w:sz w:val="20"/><w:szCs w:val="20"/></w:rPr><w:tblPr><w:tblBorders>'
        + ['top', 'left', 'bottom', 'right', 'insideH', 'insideV'].map(s => `<w:${s} w:val="single" w:sz="4" w:space="0" w:color="999999"/>`).join('')
        + '</w:tblBorders><w:tblCellMar><w:top w:w="57" w:type="dxa"/><w:left w:w="85" w:type="dxa"/><w:bottom w:w="57" w:type="dxa"/><w:right w:w="85" w:type="dxa"/></w:tblCellMar></w:tblPr></w:style>'
        + '</w:styles>';
}

function _sidfot(text) {
    const falt = namn => `<w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText xml:space="preserve"> ${namn} </w:instrText></w:r>`
        + '<w:r><w:fldChar w:fldCharType="separate"/></w:r><w:r><w:t>1</w:t></w:r><w:r><w:fldChar w:fldCharType="end"/></w:r>';
    return `${XML}<w:ftr xmlns:w="${W}" xmlns:r="${R}"><w:p><w:pPr><w:tabs><w:tab w:val="right" w:pos="${TEXTBREDD}"/></w:tabs>`
        + '<w:rPr><w:sz w:val="16"/></w:rPr></w:pPr>'
        + `<w:r><w:t xml:space="preserve">${xmlText(text)}</w:t></w:r><w:r><w:tab/></w:r><w:r><w:t xml:space="preserve">Sida </w:t></w:r>`
        + `${falt('PAGE')}<w:r><w:t xml:space="preserve"> av </w:t></w:r>${falt('NUMPAGES')}</w:p></w:ftr>`;
}

/**
 * @param {Array} block
 * @param {{titel:string, sidfot:string, skapad:string}} opt - skapad i ISO 8601 (UTC)
 * @returns {Object<string,string|{base64:string}>} sökväg i zip:en → XML, eller `{ base64 }` för en bildfil
 */
function docxDelar(block, { titel, sidfot, skapad }) {
    const bilder = (block || []).filter(_harBild);
    const PKG = 'http://schemas.openxmlformats.org/package/2006';
    const OFF = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
    const typ = t => `application/vnd.openxmlformats-officedocument.${t}`;
    return {
        '[Content_Types].xml': `${XML}<Types xmlns="${PKG}/content-types">`
            + `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>`
            + '<Default Extension="xml" ContentType="application/xml"/>'
            + (bilder.length ? '<Default Extension="png" ContentType="image/png"/>' : '')
            + `<Override PartName="/word/document.xml" ContentType="${typ('wordprocessingml.document.main+xml')}"/>`
            + `<Override PartName="/word/styles.xml" ContentType="${typ('wordprocessingml.styles+xml')}"/>`
            + `<Override PartName="/word/settings.xml" ContentType="${typ('wordprocessingml.settings+xml')}"/>`
            + `<Override PartName="/word/footer1.xml" ContentType="${typ('wordprocessingml.footer+xml')}"/>`
            + '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>'
            + `<Override PartName="/docProps/app.xml" ContentType="${typ('extended-properties+xml')}"/></Types>`,
        '_rels/.rels': `${XML}<Relationships xmlns="${PKG}/relationships">`
            + `<Relationship Id="rId1" Type="${OFF}/officeDocument" Target="word/document.xml"/>`
            + `<Relationship Id="rId2" Type="${PKG}/relationships/metadata/core-properties" Target="docProps/core.xml"/>`
            + `<Relationship Id="rId3" Type="${OFF}/extended-properties" Target="docProps/app.xml"/></Relationships>`,
        'word/_rels/document.xml.rels': `${XML}<Relationships xmlns="${PKG}/relationships">`
            + `<Relationship Id="rId1" Type="${OFF}/styles" Target="styles.xml"/>`
            + `<Relationship Id="rId2" Type="${OFF}/settings" Target="settings.xml"/>`
            + `<Relationship Id="rIdSidfot" Type="${OFF}/footer" Target="footer1.xml"/>`
            + bilder.map((_b, i) => `<Relationship Id="rIdBild${i + 1}" Type="${OFF}/image" Target="media/bild${i + 1}.png"/>`).join('')
            + '</Relationships>',
        ...Object.fromEntries(bilder.map((b, i) => [`word/media/bild${i + 1}.png`, { base64: b.base64 }])),
        'word/document.xml': _dokument(block || []),
        'word/styles.xml': _stilar(),
        'word/settings.xml': `${XML}<w:settings xmlns:w="${W}"><w:defaultTabStop w:val="709"/>`
            + '<w:characterSpacingControl w:val="doNotCompress"/><w:compat>'
            + '<w:compatSetting w:name="compatibilityMode" w:uri="http://schemas.microsoft.com/office/word" w:val="15"/></w:compat></w:settings>',
        'word/footer1.xml': _sidfot(sidfot),
        'docProps/core.xml': `${XML}<cp:coreProperties xmlns:cp="${PKG}/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/"`
            + ' xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">'
            + `<dc:title>${xmlText(titel)}</dc:title><dc:creator>Öppen lönekartläggning</dc:creator>`
            + `<dcterms:created xsi:type="dcterms:W3CDTF">${xmlText(skapad)}</dcterms:created>`
            + `<dcterms:modified xsi:type="dcterms:W3CDTF">${xmlText(skapad)}</dcterms:modified></cp:coreProperties>`,
        'docProps/app.xml': `${XML}<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties">`
            + '<Application>Öppen lönekartläggning</Application></Properties>',
    };
}

    return { docxDelar };
})();
const _docxDelar = __mirrorDocx.docxDelar;

// ---- speglar src/lib/perbas.js ----
const __mirrorPerBas = (() => {
    // importer ur tidigare speglade lib-moduler
    const median = __mirrorStat.median;
    const quantile = __mirrorStat.quantile;
    const sektorsnamn = __mirrorAid.sektorsnamn;

// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
/**
 * Öppen lönekartläggning — tabellerna per BAS-intervall, i den form en skriven lönekartläggning brukar ha.
 *
 * Tre tabeller, byggda efter arbetsgivarnas egna utkast:
 *  1. Per BAS-intervall: referensen (ställningstagandet), organisationen, varje yrkesgrupp med jämförelse-
 *     statistikens rad under, och sist kvinnor och män — P10, median, P90 och antal.
 *  2. Löneskillnader inom likvärdigt arbete: per BAS medellön för alla, män och kvinnor, kvinnors
 *     medellön i procent av mäns, andel kvinnor och medelålder.
 *  3. Löneskillnader i åldersgrupper: per BAS medellön i tre åldersgrupper.
 *
 * Minsta gruppstorlek (k) tillämpas här: en yrkesgrupp, ett BAS-intervall eller en åldersgrupp med färre än
 * k personer får ingen lönerad, och könsuppdelade mått visas bara när båda könen når k. De utelämnade
 * räknas upp så att rapporten säger vad den inte redovisar.
 *
 * Webbläsarbygget får en AUTO-GENERERAD spegel i src/app/09-lib-speglar.js.
 */


// ---- Receptet (ADR-52): vad avsnittet ska innehålla. Standardvärdet är tabellerna som de står i arbetsgivarnas utkast. ----
const PERBAS_DIMENSIONER = ['bas', 'sektor'];
const PERBAS_MATT = ['p10', 'p25', 'med', 'p75', 'p90', 'medel'];
const PERBAS_MATT_ETIKETT = Object.freeze({ p10: 'P10', p25: 'P25', med: 'Median', p75: 'P75', p90: 'P90', medel: 'Medellön' });
const PERBAS_RADER = ['referens', 'organisation', 'yrken', 'statistik', 'kvinnor', 'man'];
const PERBAS_RAD_ETIKETT = Object.freeze({ referens: 'Referensen (ställningstagandet)', organisation: 'Organisationen', yrken: 'Yrkesgrupperna',
    statistik: 'Jämförelsestatistikens rad under varje yrke', kvinnor: 'Kvinnor', man: 'Män' });
function perBasStandard() {
    return { dim: 'bas', rader: [...PERBAS_RADER], matt: ['p10', 'med', 'p90'], konsgap: true, aldersgrupper: true, aldersgranser: [35, 50] };
}
/** Receptet i giltig form; okända värden faller tillbaka på standard. Null in ger standardreceptet. */
function valideraPerBasRecept(r) {
    const std = perBasStandard();
    if (!r || typeof r !== 'object') return std;
    const granser = Array.isArray(r.aldersgranser) ? [...new Set(r.aldersgranser.map(Number).filter(x => Number.isInteger(x) && x > 16 && x < 80))].sort((a, b) => a - b) : [];
    const matt = Array.isArray(r.matt) ? PERBAS_MATT.filter(m => r.matt.includes(m)) : [];
    return {
        dim: PERBAS_DIMENSIONER.includes(r.dim) ? r.dim : 'bas',
        rader: Array.isArray(r.rader) ? PERBAS_RADER.filter(x => r.rader.includes(x)) : std.rader,
        matt: matt.length ? matt : std.matt,
        konsgap: r.konsgap !== false, aldersgrupper: r.aldersgrupper !== false,
        aldersgranser: granser.length ? granser : std.aldersgranser
    };
}
function perBasReceptArStandard(r) { return JSON.stringify(valideraPerBasRecept(r)) === JSON.stringify(perBasStandard()); }

const _arKv = r => String(r.kon || '').includes('kvinna');
const _arMa = r => r.kon === 'man' || r.kon === 'män';
const _medel = arr => (arr.length ? arr.reduce((s, x) => s + x, 0) / arr.length : null);
const _loner = rader => rader.map(r => r.lon).filter(x => typeof x === 'number' && isFinite(x) && x > 0);
const _aldrar = rader => rader.map(r => r.alder).filter(x => typeof x === 'number' && isFinite(x) && x > 0);
const _matt = rader => { const l = _loner(rader); return l.length ? { n: rader.length, p10: quantile(l, 0.1), p25: quantile(l, 0.25), med: median(l), p75: quantile(l, 0.75), p90: quantile(l, 0.9), medel: _medel(l) } : null; };

/** Yrkesgruppens namn: AID-koden och etiketten. */
function yrkesnamn(r) {
    const aid = r.aid != null ? String(r.aid).trim() : '';
    const etikett = r.yrkeLabel ? String(r.yrkeLabel).trim() : '';
    if (aid && etikett && etikett !== aid) return `${aid} ${etikett}`;
    return aid || etikett || String(r.yrke || '').trim() || '(okänt yrke)';
}

/**
 * Åldersgrupperna ur gränserna: [35, 50] → ['–34', '35–49', '50–'].
 * @param {number[]} granser
 */
function aldersgruppNamn(granser) {
    const g = [...granser].sort((a, b) => a - b);
    const ut = [`–${g[0] - 1}`];
    for (let i = 0; i < g.length - 1; i++) ut.push(`${g[i]}–${g[i + 1] - 1}`);
    ut.push(`${g[g.length - 1]}–`);
    return ut;
}
const _aldersgrupp = (alder, granser) => { let i = 0; while (i < granser.length && alder >= granser[i]) i++; return i; };

/**
 * @param {Array<{bas:string, aid?:string, yrke?:string, yrkeLabel?:string, kon:string, lon:number, alder?:number}>} rader
 * @param {{k?: number, referens?: ((aid: string|null, bas: string) => ({p10?:number, med?:number, p90?:number}|null))|null,
 *          statistik?: Array<{aid:string, bas?:string, median:number, p10?:number, p90?:number}>|null,
 *          referensNamn?: string, statistikNamn?: string, aldersgranser?: number[], recept?: any}} [opt]
 *   `recept` (ADR-52): dimensionen som upprepas ('bas' eller 'sektor'), vilka rader och mått, och om summeringstabellerna
 *   ska med; utelämnat ger standardreceptet. Med sektor som dimension finns ingen referensrad (ställningstagandet
 *   gäller BAS-intervall).
 */
function perBasTabeller(rader, opt = {}) {
    const k = opt.k ?? 10;
    const recept = valideraPerBasRecept(opt.recept);
    const visa = new Set(recept.rader);
    const dimAv = recept.dim === 'sektor' ? (r => sektorsnamn(r.aid) || '') : (r => String(r.bas ?? ''));
    const referens = typeof opt.referens === 'function' ? opt.referens : () => null;
    const statistik = Array.isArray(opt.statistik) ? opt.statistik : [];
    const referensNamn = opt.referensNamn || 'Referens';
    const statistikNamn = opt.statistikNamn || 'Jämförelsestatistik';
    const granser = (opt.aldersgranser && opt.aldersgranser.length ? opt.aldersgranser : recept.aldersgranser).slice().sort((a, b) => a - b);
    const d = (rader || []).filter(r => r && r.bas && dimAv(r));
    const basar = [...new Set(d.map(dimAv))].sort((a, b) => a.localeCompare(b, 'sv'));
    const statFor = (aid, bas) => statistik.find(s => String(s.aid) === String(aid) && String(s.bas || '') === String(bas))
        || statistik.find(s => String(s.aid) === String(aid) && !s.bas) || null;

    const intervall = [];
    const basUtelamnade = [];
    for (const bas of basar) {
        const df = d.filter(r => dimAv(r) === bas);
        if (df.length < k) { basUtelamnade.push(bas); continue; }
        const rad = [];
        const utelamnade = [];
        const ref = recept.dim === 'bas' && visa.has('referens') ? referens(null, bas) : null;
        if (ref && (ref.p10 != null || ref.med != null || ref.p90 != null)) rad.push({ typ: 'referens', namn: referensNamn, n: null, p10: ref.p10 ?? null, med: ref.med ?? null, p90: ref.p90 ?? null });
        const org = visa.has('organisation') ? _matt(df) : null;
        if (org) rad.push({ typ: 'organisation', namn: 'Organisationen', ...org });
        // Yrkesgrupperna, största först; under varje yrke dess rad i jämförelsestatistiken.
        const perYrke = new Map();
        df.forEach(r => { const key = String(r.aid ?? r.yrke ?? ''); if (!perYrke.has(key)) perYrke.set(key, []); perYrke.get(key).push(r); });
        const yrken = [...perYrke.entries()].sort((a, b) => b[1].length - a[1].length || yrkesnamn(a[1][0]).localeCompare(yrkesnamn(b[1][0]), 'sv'));
        for (const [key, rows] of yrken) {
            if (!visa.has('yrken')) break;
            const namn = yrkesnamn(rows[0]);
            if (rows.length < k) { utelamnade.push(namn); continue; }
            const m = _matt(rows);
            if (!m) continue;
            rad.push({ typ: 'yrke', namn, aid: key, ...m });
            const s = visa.has('statistik') && rows[0].aid != null && recept.dim === 'bas' ? statFor(rows[0].aid, bas) : null;
            if (s && s.median > 0) rad.push({ typ: 'statistik', namn: `${statistikNamn}: ${namn}`, aid: key, n: null, p10: s.p10 ?? null, med: s.median, p90: s.p90 ?? null });
        }
        const kv = df.filter(_arKv), ma = df.filter(_arMa);
        const konVisas = kv.length >= k && ma.length >= k;
        if (konVisas) {
            const mk = visa.has('kvinnor') ? _matt(kv) : null, mm = visa.has('man') ? _matt(ma) : null;
            if (mk) rad.push({ typ: 'kvinnor', namn: 'Kvinnor', ...mk });
            if (mm) rad.push({ typ: 'man', namn: 'Män', ...mm });
        }
        intervall.push({ bas, n: df.length, nKv: kv.length, nMa: ma.length, rader: rad, utelamnade, konVisas, antalYrken: perYrke.size });
    }

    // Könsgap och ålder per BAS, med raden Alla först.
    const konsgapRad = (namn, rows) => {
        const kv = rows.filter(_arKv), ma = rows.filter(_arMa);
        const konVisas = kv.length >= k && ma.length >= k;
        const medel = _medel(_loner(rows)), medelKv = konVisas ? _medel(_loner(kv)) : null, medelMa = konVisas ? _medel(_loner(ma)) : null;
        return {
            bas: namn, n: rows.length, medel, medelMa, medelKv,
            kvot: konVisas && medelMa != null && medelMa > 0 && medelKv != null ? medelKv / medelMa * 100 : null,
            andelKv: rows.length ? kv.length / rows.length * 100 : null,
            alder: _medel(_aldrar(rows)), alderMa: konVisas ? _medel(_aldrar(ma)) : null, alderKv: konVisas ? _medel(_aldrar(kv)) : null,
            konVisas
        };
    };
    const visadeBas = basar.filter(b => !basUtelamnade.includes(b));
    const konsgap = { rader: [konsgapRad('Alla', d), ...visadeBas.map(b => konsgapRad(b, d.filter(r => dimAv(r) === b)))] };

    const grupper = aldersgruppNamn(granser);
    const aldersRad = (namn, rows) => {
        /** @type {any[][]} */
        const per = grupper.map(() => []);
        rows.forEach(r => { if (typeof r.alder === 'number' && isFinite(r.alder) && r.alder > 0) per[_aldersgrupp(r.alder, granser)].push(r); });
        return { bas: namn, n: rows.length, alder: _medel(_aldrar(rows)), medel: _medel(_loner(rows)),
            perGrupp: per.map(g => (g.length >= k ? _medel(_loner(g)) : null)), antalPerGrupp: per.map(g => g.length) };
    };
    const aldersgrupper = { grupper, rader: [aldersRad('Alla', d), ...visadeBas.map(b => aldersRad(b, d.filter(r => dimAv(r) === b)))] };

    return { k, recept, dim: recept.dim, dimEtikett: recept.dim === 'sektor' ? 'Sektor' : 'BAS-intervall', intervall, basUtelamnade,
             konsgap: recept.konsgap ? konsgap : null, aldersgrupper: recept.aldersgrupper ? aldersgrupper : null };
}

    return { perBasTabeller, aldersgruppNamn, yrkesnamn, perBasStandard, valideraPerBasRecept, perBasReceptArStandard };
})();
const _pbTabeller = __mirrorPerBas.perBasTabeller;
const _pbStandard = __mirrorPerBas.perBasStandard;
const _pbValideraRecept = __mirrorPerBas.valideraPerBasRecept;
const _pbReceptArStandard = __mirrorPerBas.perBasReceptArStandard;

// ---- speglar src/lib/tabellrecept.js ----
const __mirrorTabellrecept = (() => {
    // importer ur tidigare speglade lib-moduler
    const computePivot = __mirrorUtforska.computePivot;

// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
/**
 * Öppen lönekartläggning — egna tabeller i rapporten (ADR-52).
 *
 * En tabell som användaren byggt i Utforska sparas som ett RECEPT — rader, kolumner, mått, urval och om tabellen ska
 * upprepas per BAS-intervall — aldrig som tal. Recepten ritas om i exportläget när Word-utkastet, PDF-rapporten och
 * Excel-filen byggs, med samma pivot som fliken (computePivot) och samma regler för minsta gruppstorlek som Utforskas
 * export: en cell under tröskeln blir tom, och rader och kolumner som bara har tomma celler utelämnas och räknas.
 *
 * Webbläsarbygget får en AUTO-GENERERAD spegel i src/app/09-lib-speglar.js.
 */

// Samma listor som i src/lib/utforska.js (DIMENSIONER, MATT); tests/tabellrecept.test.js vaktar att de är lika.
const DIMENSIONER = ['bas', 'aid', 'alder', 'kon', 'alla', 'aidbas', 'lonespann', 'sektor', 'aidniva'];
const MATT = ['median', 'medel', 'n', 'p10', 'p25', 'p75', 'p90', 'spridning', 'andelKv', 'gap'];
const RECEPT_DIMENSIONER = DIMENSIONER, RECEPT_MATT = MATT;

const DIM_ETIKETT = Object.freeze({
    bas: 'BAS-intervall', aid: 'Yrkesgrupp (AID)', alder: 'Åldersgrupp', kon: 'Kön',
    aidbas: 'Yrkesgrupp inom BAS', lonespann: 'Lönespann', alla: 'Hela urvalet',
    sektor: 'Sektor (AID-huvudområde)', aidniva: 'AID-mellannivå'
});
const MATT_ETIKETT = Object.freeze({
    median: 'Median månadslön', medel: 'Medellön', n: 'Antal (n)',
    p10: 'P10', p25: 'P25', p75: 'P75', p90: 'P90',
    spridning: 'Spridning (P90/P10)', andelKv: 'Andel kvinnor (%)', gap: 'Kvinnors median i % av mäns'
});
/** Kolumntyp i rapportmodellen per mått (58-rapportmodell.js: rmCell). */
const MATT_TYP = Object.freeze({
    median: 'kr', medel: 'kr', n: 'antal', p10: 'kr', p25: 'kr', p75: 'kr', p90: 'kr', spridning: 'tal2', andelKv: 'pct1', gap: 'pct1'
});
const UPPREPNING = ['bas'];
const MAX_NAMN = 80;

let _nr = 0;
/** Ett nytt recept ur Utforskas spec. Namnet kortas till 80 tecken; utan namn får tabellen en beskrivning som namn.
 * @param {any} spec
 * @param {{namn?: string, upprepa?: string|null}} [val] */
function nyttRecept(spec, { namn = '', upprepa = null } = {}) {
    const r = valideraRecept({ id: `t${Date.now().toString(36)}${(++_nr).toString(36)}`, namn: String(namn || '').trim().slice(0, MAX_NAMN), spec, upprepa });
    if (r && !r.namn) r.namn = receptBeskrivning(r);
    return r;
}

/** Receptet i giltig form, eller null när det inte går att använda (okänd dimension eller okänt mått). */
function valideraRecept(r) {
    if (!r || typeof r !== 'object' || !r.spec || typeof r.spec !== 'object') return null;
    const s = r.spec;
    if (!DIMENSIONER.includes(s.rad)) return null;
    const kolumn = s.kolumn && s.kolumn !== s.rad && DIMENSIONER.includes(s.kolumn) ? s.kolumn : null;
    const matt = MATT.includes(s.matt) ? s.matt : 'median';
    const urval = s.urval && typeof s.urval === 'object' && Array.isArray(s.urval.villkor)
        ? { lage: s.urval.lage === 'nagot' ? 'nagot' : 'alla', villkor: s.urval.villkor.filter(v => v && typeof v === 'object').map(v => ({ ...v })) }
        : { lage: 'alla', villkor: [] };
    const gruppVillkor = Array.isArray(s.gruppVillkor) ? s.gruppVillkor.filter(g => g && typeof g === 'object').map(g => ({ ...g })) : [];
    return {
        id: typeof r.id === 'string' && r.id ? r.id.slice(0, 40) : `t${Date.now().toString(36)}`,
        namn: String(r.namn || '').trim().slice(0, MAX_NAMN),
        spec: { rad: s.rad, kolumn, matt, delaKon: !!s.delaKon, slaIhop: !!s.slaIhop, urval, gruppVillkor },
        upprepa: UPPREPNING.includes(r.upprepa) && r.upprepa !== s.rad && r.upprepa !== kolumn ? r.upprepa : null
    };
}

/** En rad som beskriver receptet: "Median månadslön per Yrkesgrupp (AID) och Kön, kvinnor och män var för sig, en tabell per BAS-intervall". */
function receptBeskrivning(r) {
    const s = r.spec;
    const delar = [`${MATT_ETIKETT[s.matt]} per ${DIM_ETIKETT[s.rad]}${s.kolumn ? ` och ${DIM_ETIKETT[s.kolumn]}` : ''}`];
    if (s.delaKon) delar.push('kvinnor och män var för sig');
    if (s.urval.villkor.length) delar.push(`${s.urval.villkor.length} ${s.urval.villkor.length === 1 ? 'villkor' : 'villkor'} i urvalet`);
    if (s.gruppVillkor.length) delar.push('gruppvillkor');
    if (r.upprepa) delar.push(`en tabell per ${DIM_ETIKETT[r.upprepa]}`);
    return delar.join(', ');
}

const _bas = rows => [...new Set(rows.map(r => String(r.bas ?? '')).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'sv'));
const _nText = c => `${c.n} (${c.nKv}/${c.nMa})`;

/**
 * Tabellerna ur ett recept, i rapportmodellens form: { rubrik, kolumner: [{rubrik, typ}], rader: [[...]], utelamnade, not }.
 * Flera tabeller när receptet upprepas per BAS-intervall. Tröskeln k tillämpas här.
 * @param {any[]} rows
 * @param {any} recept
 * @param {{k?: number}} [opt]
 * @returns {Array<{rubrik: string, kolumner: {rubrik: string, typ: string}[], rader: any[][], utelamnade: number, not: string}>}
 */
function receptTillTabeller(rows, recept, { k = 10 } = {}) {
    const r = valideraRecept(recept);
    if (!r) return [];
    const bygg = (rader, rubrik) => _tabell(computePivot(rader, r.spec, { k }), r.spec, k, rubrik);
    if (r.upprepa === 'bas') {
        return /** @type {any[]} */ (_bas(rows).map(b => bygg(rows.filter(x => String(x.bas) === b), `${r.namn} — BAS ${b}`)).filter(t => t && t.rader.length));
    }
    const t = bygg(rows, r.namn);
    return t && t.rader.length ? [t] : [];   // en tabell där ingen grupp når tröskeln utelämnas (anroparen anger det)
}

function _tabell(model, spec, k, rubrik) {
    if (!model || !model.celler.length) return null;
    const dim = DIM_ETIKETT[spec.rad], typ = MATT_TYP[spec.matt] || 'kr';
    let kolumner, rader, utelamnade = 0;
    if (spec.kolumn) {
        const byKey = new Map(model.celler.map(c => [c.rad + '\u0000' + c.kol, c]));
        const kol = (model.kolumnEtiketter || []).flatMap(kl => spec.delaKon
            ? [{ kl, rubrik: `${kl} · Kvinnor`, v: c => c.valueKv, n: c => c.nKv }, { kl, rubrik: `${kl} · Män`, v: c => c.valueMa, n: c => c.nMa }]
            : [{ kl, rubrik: kl, v: c => c.value, n: c => c.n }]);
        const liten = (c, d) => c.liten || d.n(c) < k;
        const varde = (c, d) => {
            if (!c) return null;
            if (spec.matt === 'n' && !c.liten) return d.n(c);                      // antal är inte ett lönemått
            if (liten(c, d) || (spec.matt === 'gap' && c.konLiten)) return null;
            return d.v(c);
        };
        const matris = model.radEtiketter.map(rk => kol.map(d => varde(byKey.get(rk + '\u0000' + d.kl), d)));
        const kolMed = kol.map((_, j) => matris.some(rad => rad[j] != null));
        const radMed = matris.map(rad => rad.some(v => v != null));
        utelamnade = radMed.filter(x => !x).length;
        kolumner = [{ rubrik: `${dim} \\ ${DIM_ETIKETT[spec.kolumn]}`, typ: 'text' }, ...kol.filter((_, j) => kolMed[j]).map(d => ({ rubrik: d.rubrik, typ }))];
        rader = model.radEtiketter.map((rk, i) => [rk, ...matris[i].filter((_, j) => kolMed[j])]).filter((_, i) => radMed[i]);
    } else if (spec.delaKon) {
        const synliga = model.celler.filter(c => !c.liten);
        utelamnade = model.celler.length - synliga.length;
        kolumner = [{ rubrik: dim, typ: 'text' }, { rubrik: 'Kvinnor', typ }, { rubrik: 'Män', typ }, { rubrik: 'n (K/M)', typ: 'text' }];
        const v = (c, n, x) => (spec.matt === 'n' || n >= k ? x : null);
        rader = synliga.map(c => [c.rad, v(c, c.nKv, c.valueKv), v(c, c.nMa, c.valueMa), _nText(c)]);
    } else {
        const synliga = model.celler.filter(c => !c.liten);
        utelamnade = model.celler.length - synliga.length;
        kolumner = [{ rubrik: dim, typ: 'text' }, { rubrik: MATT_ETIKETT[spec.matt], typ }, { rubrik: 'n (K/M)', typ: 'text' }];
        rader = synliga.map(c => [c.rad, spec.matt === 'gap' && c.konLiten ? null : c.value, _nText(c)]);
    }
    const noter = [];
    if (utelamnade) noter.push(`${utelamnade} ${utelamnade === 1 ? 'grupp' : 'grupper'} med färre än ${k} personer redovisas inte.`);
    if (model.dolda) noter.push(`${model.dolda} ${model.dolda === 1 ? 'grupp' : 'grupper'} döljs av gruppvillkoren.`);
    return { rubrik, kolumner, rader, utelamnade, not: noter.join(' ') };
}

    return { nyttRecept, valideraRecept, receptBeskrivning, receptTillTabeller };
})();
const _trNytt = __mirrorTabellrecept.nyttRecept;
const _trValidera = __mirrorTabellrecept.valideraRecept;
const _trBeskrivning = __mirrorTabellrecept.receptBeskrivning;
const _trTabeller = __mirrorTabellrecept.receptTillTabeller;

// ---- speglar src/lib/organisationspaket.js ----
const __mirrorOrganisationspaket = (() => {
    // importer ur tidigare speglade lib-moduler
    const valideraRecept = __mirrorTabellrecept.valideraRecept;
    const valideraPerBasRecept = __mirrorPerBas.valideraPerBasRecept;
    const perBasReceptArStandard = __mirrorPerBas.perBasReceptArStandard;

// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
/**
 * Öppen lönekartläggning — organisationspaket (ADR-28).
 *
 * En systemägare samlar organisationens namn och benämningar, grundinställningar,
 * lönepolitiska ställningstagande och jämförelsestatistik i en JSON-fil som handläggarna
 * läser in i ett steg. Modulen bygger paketet ur appens delar och tolkar ett paket
 * tillbaka till dem. Bara vitlistade fält följer med; allt annat ignoreras, så att en
 * manipulerad fil inte kan föra in något annat än aggregat i verktyget.
 *
 * Webbläsarbygget får en AUTO-GENERERAD spegel i src/app/09-lib-speglar.js.
 */



const PAKET_FORMAT = 'lonekartlaggning-organisationspaket';
const PAKET_VERSION = 1;
const PAKET_MAX_BYTE = 5 * 1024 * 1024;

const MAX_TEXT = 200;
const PNR = /\b(19|20)?\d{6}[-+]?\d{4}\b/;
const EPOST = /\S+@\S+\.\S+/;

/** Liknar texten ett personnummer eller en e-postadress? (Samma mönster som paketkontrollen.) */
function liknarPersonuppgift(text) {
    const t = String(text ?? '');
    return PNR.test(t) || EPOST.test(t);
}

// Textfält saneras vid inläsning: HTML-metatecken (< > " ' &) tas bort, texten trimmas och kortas
// till 200 tecken. Fälten är benämningar och koder som aldrig legitimt innehåller tecknen; esc() vid
// rendering är det egentliga skyddet, detta är ett extra lager på samma sätt som för lönefilen.
const _text = v => {
    if (typeof v !== 'string') return undefined;
    const t = v.replace(/[<>"'&]/g, '').trim();
    return t ? t.substring(0, MAX_TEXT) : undefined;
};
const _tal = (v, min, max) => (typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max ? v : undefined);
const _talEllerNull = v => (v == null ? null : (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : NaN));
const _utanTomma = o => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined));
// Minsta gruppstorlek för redovisning (ADR-38): heltal 2–1000, annars utelämnat.
const _kTroskel = v => (Number.isInteger(v) && v >= 2 && v <= 1000 ? v : undefined);
// Beräkningsperioden väljs bland verktygets värden (Prioriteringens rullista).
const PERIODER = [3, 6, 9, 12];
const _period = v => (PERIODER.includes(v) ? v : undefined);
// Låsningar som systemägaren kan sätta (ADR-47). Rensning vid inaktivitet: 0 (av) eller 5–120 minuter.
const INAKTIVITET_MIN = 5;
const INAKTIVITET_MAX = 120;
const _inaktivitet = v => (v === 0 || (Number.isInteger(v) && v >= INAKTIVITET_MIN && v <= INAKTIVITET_MAX) ? v : undefined);

// ---- Rader ----

function _referensRad(r) {
    if (!r || typeof r !== 'object') return null;
    const bas = _text(r.bas)?.toUpperCase() ?? null;
    const aid = _text(r.aid) ?? null;
    if (!bas && !aid) return null;
    const p10 = _talEllerNull(r.p10), med = _talEllerNull(r.med), p90 = _talEllerNull(r.p90);
    if ([p10, med, p90].some(Number.isNaN)) return null;
    return { aid, bas, p10, med, p90 };
}

function _statistikRad(r) {
    if (!r || typeof r !== 'object') return null;
    const aid = _text(r.aid);
    const median = _tal(r.median, Number.MIN_VALUE, Infinity);
    if (!aid || median === undefined) return null;
    const p10 = r.p10 == null ? 0 : _tal(r.p10, 0, Infinity);
    const p90 = r.p90 == null ? 0 : _tal(r.p90, 0, Infinity);
    const nKv = _talEllerNull(r.nKv), nMa = _talEllerNull(r.nMa);
    const andelKv = r.andelKv == null ? null : _tal(r.andelKv, 0, 100);
    if (p10 === undefined || p90 === undefined || Number.isNaN(nKv) || Number.isNaN(nMa) || andelKv === undefined) return null;
    return { aid, aidFull: _text(r.aidFull) ?? aid, bas: typeof r.bas === 'string' ? r.bas.trim().toUpperCase().substring(0, 10) : '',
             median, p10, p90, nKv, nMa, andelKv };
}

// Organisationstypen styr vilken del av SKR:s personalstatistik som är referens (ADR-34).
function _orgTyp(v) {
    return v === 'kommun' || v === 'region' ? v : undefined;
}

// ---- Bygga ----

/**
 * Bygger ett paket ur appens delar. Tomma delar utelämnas.
 * @param {{organisation:string, utgivare?:string, skapat:string, avserAr?:number,
 *          profil?:Object, installningar?:Object, referens?:Object|null, statistik?:Object|null, rapport?:Object|null}} u
 * @returns {Object} JSON-säkert paket
 */
function byggPaket(u) {
    const p = u.profil || {}, inst = u.installningar || {};
    /** @type {{[k:string]:any}} */
    const paket = {
        format: PAKET_FORMAT,
        version: PAKET_VERSION,
        organisation: { namn: _text(u.organisation) },
        ..._utanTomma({ utgivare: _text(u.utgivare), skapat: _text(u.skapat), avserAr: _tal(u.avserAr, 2000, 2100) }),
        profil: _utanTomma({
            jamforelseNamn: _text(p.benchmarkLabel), jamforelseGenitiv: _text(p.benchmarkLabelGenitive),
            jamforelseKort: _text(p.benchmarkShort), basSystem: _text(p.basSystem), aidSystem: _text(p.aidSystem),
            organisationstyp: _orgTyp(p.orgTyp),
        }),
        installningar: _utanTomma({
            poPct: _tal(inst.poPct, 0, 100), poNot: _text(inst.poNot), manader: _period(inst.months), kTroskel: _kTroskel(inst.kTroskel),
            // Låsningarna (ADR-47): bara giltiga värden följer med; en låsning av rensningstiden kräver ett värde över 0.
            kTroskelLagst: _kTroskel(inst.kTroskelLagst),
            inaktivitetMin: _inaktivitet(inst.inaktivitetMin),
            inaktivitetLast: inst.inaktivitetLast === true && _inaktivitet(inst.inaktivitetMin) > 0 ? true : undefined,
            smaGrupperIExport: inst.smaGrupperIExport === false ? false : undefined,
        }),
    };
    // Rapportens recept (ADR-52): egna tabeller ur Utforska och receptet för avsnittet per BAS-intervall. Bara
    // giltiga recept följer med, och standardreceptet per BAS utelämnas (det gäller ändå).
    const rapport = _rapport(u.rapport, null);
    if (rapport) paket.rapport = rapport;
    const refRader = (u.referens?.rader || []).map(_referensRad).filter(Boolean);
    if (refRader.length) paket.referens = { ..._utanTomma({ namn: _text(u.referens.namn), kortnamn: _text(u.referens.kortnamn) }), rader: refRader };
    const statRader = (u.statistik?.rader || []).map(_statistikRad).filter(Boolean);
    if (statRader.length) paket.statistik = { ..._utanTomma({ namn: _text(u.statistik.namn) }), rader: statRader };
    return paket;
}

/**
 * Rapportens recept i giltig form, eller null när inget finns. Ogiltiga tabellrecept faller bort (med en varning
 * när `varningar` ges); receptet per BAS normaliseras, och standardreceptet blir null.
 * @param {any} rp
 * @param {string[]|null} varningar
 */
function _rapport(rp, varningar) {
    if (!rp || typeof rp !== 'object') return null;
    const in_ = Array.isArray(rp.tabeller) ? rp.tabeller : [];
    const tabeller = in_.map(t => valideraRecept(t)).filter(Boolean);
    if (varningar && tabeller.length < in_.length) {
        const n = in_.length - tabeller.length;
        varningar.push(`${n} ${n === 1 ? 'egen tabell' : 'egna tabeller'} i paketet gick inte att läsa och hoppas över.`);
    }
    let perBasRecept = rp.perBasRecept && typeof rp.perBasRecept === 'object' ? valideraPerBasRecept(rp.perBasRecept) : null;
    if (perBasRecept && perBasReceptArStandard(perBasRecept)) perBasRecept = null;
    if (!tabeller.length && !perBasRecept) return null;
    return { tabeller, ...(perBasRecept ? { perBasRecept } : {}) };
}

// ---- Tolka ----

// Alla textvärden i paketet, för kontrollen av personuppgifter.
function _allaTexter(v, ut = []) {
    if (typeof v === 'string') ut.push(v);
    else if (Array.isArray(v)) v.forEach(x => _allaTexter(x, ut));
    else if (v && typeof v === 'object') Object.keys(v).forEach(k => _allaTexter(v[k], ut));
    return ut;
}

/**
 * Låsningarna i installningar (ADR-47), normaliserade. Ett ogiltigt värde utelämnas med en varning, så att ett
 * paket aldrig tyst låser något annat än det systemägaren skrev. Rensningstiden kan inte låsas i läget Av (0).
 */
function _lasningar(inst, varningar) {
    const ut = {};
    if (inst.kTroskelLagst != null) {
        const n = _kTroskel(inst.kTroskelLagst);
        if (n === undefined) varningar.push('Paketets lägsta tillåtna minsta gruppstorlek är ogiltig och används inte.');
        else ut.kTroskelLagst = n;
    }
    if (inst.inaktivitetMin != null) {
        const n = _inaktivitet(inst.inaktivitetMin);
        if (n === undefined) varningar.push(`Paketets tid för rensning vid inaktivitet är ogiltig (0 eller ${INAKTIVITET_MIN}–${INAKTIVITET_MAX} minuter) och används inte.`);
        else ut.inaktivitetMin = n;
    }
    if (inst.inaktivitetLast != null) {
        if (typeof inst.inaktivitetLast !== 'boolean') varningar.push('Paketets låsning av rensning vid inaktivitet är ogiltig och används inte.');
        else if (inst.inaktivitetLast) {
            if (ut.inaktivitetMin === undefined) varningar.push('Paketet låser rensning vid inaktivitet utan ett giltigt värde; låsningen används inte.');
            else if (ut.inaktivitetMin === 0) varningar.push('Rensning vid inaktivitet kan inte låsas i läget Av; låsningen används inte.');
            else ut.inaktivitetLast = true;
        }
    }
    if (inst.smaGrupperIExport != null) {
        if (typeof inst.smaGrupperIExport !== 'boolean') varningar.push('Paketets fält om små grupper i exporten är ogiltigt och används inte.');
        else ut.smaGrupperIExport = inst.smaGrupperIExport;
    }
    return ut;
}

function _rader(del, radFn, benamning, varningar) {
    if (!del || typeof del !== 'object' || !Array.isArray(del.rader)) return null;
    const rader = del.rader.map(radFn).filter(Boolean);
    const bort = del.rader.length - rader.length;
    if (bort) varningar.push(`${bort} ${bort === 1 ? 'rad' : 'rader'} i ${benamning} hoppades över (saknade eller ogiltiga värden).`);
    return rader.length ? rader : null;
}

/**
 * Tolkar ett paket (filens text) till appens delar.
 * @param {string} text
 * @returns {{ok:true, paket:Object, delar:Object, varningar:string[]} | {ok:false, fel:string}}
 */
function tolkaPaket(text) {
    if (typeof text !== 'string') return { ok: false, fel: 'Filen kunde inte läsas.' };
    if (text.length > PAKET_MAX_BYTE) return { ok: false, fel: 'Filen är för stor för att vara ett organisationspaket (högst 5 MB).' };
    let o;
    try { o = JSON.parse(text); } catch (_e) { return { ok: false, fel: 'Filen är inte giltig JSON.' }; }
    if (!o || typeof o !== 'object' || Array.isArray(o)) return { ok: false, fel: 'Filen är inte ett organisationspaket.' };

    if (o.format !== PAKET_FORMAT) return { ok: false, fel: 'Filen är inte ett organisationspaket för lönekartläggning.' };
    if (typeof o.version !== 'number' || o.version > PAKET_VERSION) {
        return { ok: false, fel: `Paketet har version ${o.version}; verktyget läser version ${PAKET_VERSION}. Uppdatera verktyget.` };
    }
    const organisation = _text(o.organisation?.namn);
    if (!organisation) return { ok: false, fel: 'Paketet saknar organisationens namn (organisation.namn).' };
    const skapat = _text(o.skapat);
    if (!skapat || !/^\d{4}-\d{2}-\d{2}$/.test(skapat)) return { ok: false, fel: 'Paketet saknar datum (skapat, ÅÅÅÅ-MM-DD).' };
    if (_allaTexter(o).some(t => PNR.test(t) || EPOST.test(t))) {
        return { ok: false, fel: 'Paketet innehåller något som liknar personnummer eller e-post och läses inte in.' };
    }

    const varningar = [];
    const refRader = _rader(o.referens, _referensRad, 'ställningstagandet', varningar);
    const statRader = _rader(o.statistik, _statistikRad, 'jämförelsestatistiken', varningar);
    if (!refRader && !statRader) return { ok: false, fel: 'Paketet innehåller varken ett lönepolitiskt ställningstagande eller jämförelsestatistik.' };
    if (!refRader) varningar.push('Paketet innehåller inget lönepolitiskt ställningstagande.');
    if (!statRader) varningar.push('Paketet innehåller ingen jämförelsestatistik.');

    const p = o.profil && typeof o.profil === 'object' ? o.profil : {};
    const inst = o.installningar && typeof o.installningar === 'object' ? o.installningar : {};
    if (inst.kTroskel != null && _kTroskel(inst.kTroskel) === undefined) varningar.push('Paketets minsta gruppstorlek är ogiltig och används inte.');
    const las = _lasningar(inst, varningar);
    // Paketets egen tröskel får inte ligga under paketets golv: den höjs till golvet, med en varning.
    let kTroskel = _kTroskel(inst.kTroskel);
    if (kTroskel !== undefined && las.kTroskelLagst !== undefined && kTroskel < las.kTroskelLagst) {
        varningar.push(`Paketets minsta gruppstorlek ${kTroskel} är lägre än dess lägsta tillåtna ${las.kTroskelLagst} och höjs till ${las.kTroskelLagst}.`);
        kTroskel = las.kTroskelLagst;
    }
    return {
        ok: true,
        paket: _utanTomma({ organisation, utgivare: _text(o.utgivare), skapat, avserAr: _tal(o.avserAr, 2000, 2100) }),
        delar: {
            profil: _utanTomma({ name: organisation, benchmarkLabel: _text(p.jamforelseNamn),
                benchmarkLabelGenitive: _text(p.jamforelseGenitiv), benchmarkShort: _text(p.jamforelseKort),
                basSystem: _text(p.basSystem), aidSystem: _text(p.aidSystem), orgTyp: _orgTyp(p.organisationstyp) }),
            installningar: _utanTomma({ poPct: _tal(inst.poPct, 0, 100), poNot: _text(inst.poNot), months: _period(inst.manader), kTroskel, ...las }),
            referens: refRader ? { ..._utanTomma({ namn: _text(o.referens.namn), kortnamn: _text(o.referens.kortnamn) }), rader: refRader } : null,
            statistik: statRader ? { ..._utanTomma({ namn: _text(o.statistik.namn) }), rader: statRader } : null,
            rapport: _rapport(o.rapport, varningar),
        },
        varningar,
    };
}

    return { byggPaket, tolkaPaket, liknarPersonuppgift };
})();
const _opByggPaket = __mirrorOrganisationspaket.byggPaket;
const _opTolkaPaket = __mirrorOrganisationspaket.tolkaPaket;
const _opLiknarPersonuppgift = __mirrorOrganisationspaket.liknarPersonuppgift;

// ---- speglar src/lib/figur.js ----
const __mirrorFigur = (() => {
    // importer ur tidigare speglade lib-moduler
    const quantile = __mirrorStat.quantile;

// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
/**
 * Öppen lönekartläggning — Figurformatet (ADR-39; se docs/utveckling/diagramkarnan.md)
 *
 * En figur är ren data som beskriver ett diagram: axlar, lager av märken och referenser.
 * Vyerna bygger figurer; ritaren (src/app/10-diagramlayout.js, 10-diagrammarken.js, 10-diagramritare.js) gör SVG av dem. Här ligger
 * allt som går att avgöra utan DOM och utan D3: validering, små grupper, domäner,
 * lådstatistik och talformat. Modulen vet ingenting om state, flikar eller k-tröskelns värde.
 *
 * Läge anges alltid i skärmens axlar: x är vågrät, y lodrät. En liggande stapel har alltså
 * kategorin i y och värdet i x. Kategorier på en bandskala jämförs som strängar.
 *
 * Formatet som det är byggt — alla val, vad vyn själv måste göra för att små grupper ska vara skyddade, och
 * kända luckor — står i docs/utveckling/diagramkarnan.md.
 *
 * Webbläsarbygget får en AUTO-GENERERAD spegel i src/app/09-lib-speglar.js.
 */

const MARKEN = ['stapel', 'intervall', 'punkt', 'linje', 'band', 'lada', 'ruta', 'yta'];
const SKALOR = ['band', 'linjar', 'log'];

const _nf = new Map();
function _tal(dec) {
    if (!_nf.has(dec)) _nf.set(dec, new Intl.NumberFormat('sv-SE', { minimumFractionDigits: dec, maximumFractionDigits: dec }));
    return _nf.get(dec);
}

/**
 * Tal som text med svensk lokal. Namngivna format i stället för formatsträngar i vyerna.
 * @param {number|null|undefined} v  annat än ett ändligt tal ger '–'
 * @param {'kr'|'pct'|'pctAbs'|'antal'|'tal2'|'ar'|undefined} namn  pctAbs: procent utan tecken (axeln i en
 *   divergerande stapel, där vänster och höger båda är andelar)
 * @param {{enhet?: boolean}} [val] enhet: false utelämnar " kr" och " %" (axelmarkeringar)
 */
function talformat(v, namn, val) {
    const enhet = !val || val.enhet !== false;
    if (typeof v !== 'number' || !isFinite(v)) return '–';
    // Avrunda först och normalisera sedan: ett värde som blir noll i formatet får inget minustecken.
    const rund = (x, dec) => { const f = 10 ** dec, r = Math.round(x * f) / f; return r === 0 ? 0 : r; };
    if (namn === 'kr') return _tal(0).format(rund(v, 0)) + (enhet ? ' kr' : '');
    if (namn === 'pct') return _tal(1).format(rund(v, 1)) + (enhet ? ' %' : '');
    if (namn === 'pctAbs') { const a = Math.abs(rund(v, 1)); return _tal(Number.isInteger(a) ? 0 : 1).format(a) + (enhet ? ' %' : ''); }
    if (namn === 'tal2') return _tal(2).format(rund(v, 2));
    if (namn === 'antal' || namn === 'ar') return _tal(0).format(rund(v, 0));
    return _tal(Number.isInteger(v) ? 0 : 1).format(rund(v, Number.isInteger(v) ? 0 : 1));
}

/**
 * Kvantilpunkterna i ett kvantilpunktdiagram (lada med form: 'kvantiler'): `antal` lika
 * stora andelar av gruppen, var och en företrädd av kvantilen i sin mitt, (i + 0,5) / antal, med samma
 * interpolation som stat.quantile. Antalet är högst `antalMax` och högst halva gruppen, så att en prick aldrig
 * står för färre än två personer. null när gruppen har färre än två värden.
 * @param {number[]} varden
 * @param {number} [antalMax]
 * @returns {{antal: number, varden: number[]}|null}
 */
function kvantilpunkter(varden, antalMax = 20) {
    const v = (varden || []).filter(x => typeof x === 'number' && isFinite(x)).sort((a, b) => a - b);
    const antal = Math.min(antalMax, Math.floor(v.length / 2));
    if (antal < 1) return null;
    const q = p => { const pos = (v.length - 1) * p, lo = Math.floor(pos), hi = Math.ceil(pos); return lo === hi ? v[lo] : v[lo] + (v[hi] - v[lo]) * (pos - lo); };
    return { antal, varden: Array.from({ length: antal }, (_, i) => q((i + 0.5) / antal)) };
}

/**
 * Skillnaden mellan kvinnors och mäns medianlön i kronor per månad, avrundad till närmaste hundratal: negativ när
 * kvinnorna ligger lägre (verktygets tecken). Ett lönegap förstås bättre i pengar än bara i procent.
 * null när någon median saknas. Anroparen skickar bara medianer som får redovisas (båda könen når tröskeln).
 * @param {number|null|undefined} medKv
 * @param {number|null|undefined} medMa
 * @returns {number|null}
 */
function kronorSkillnad(medKv, medMa) {
    if (typeof medKv !== 'number' || typeof medMa !== 'number' || !isFinite(medKv) || !isFinite(medMa) || !(medMa > 0) || !(medKv > 0)) return null;
    const r = Math.round((medKv - medMa) / 100) * 100;
    return r === 0 ? 0 : r;
}

/** Verktygstipsets rad för skillnaden i kronor, eller ingen rad när beloppet saknas. */
function kronorTipsRad(skillnadKr) {
    if (typeof skillnadKr !== 'number' || !isFinite(skillnadKr)) return [];
    const t = talformat(Math.abs(skillnadKr), 'kr', { enhet: false });
    return [['Skillnad', `${skillnadKr < 0 ? '−' : skillnadKr > 0 ? '+' : ''}${t} kr/mån`]];
}

// Vilka fält i en datapunkt som ligger på skärmaxeln a ('x' | 'y') för lagret l.
function _falt(l, a) {
    const liggande = l.riktning === 'liggande';
    if (l.marke === 'band') return a === 'x' ? ['x'] : ['lag', 'hog'];
    if (l.marke === 'yta') return a === 'x' ? ['x0', 'x1'] : ['y0', 'y1'];   // fria ytor (trädkarta): två hörn på talaxlar
    if (l.marke === 'intervall') return (a === 'x') === liggande ? ['lag', 'hog'] : [a];
    return [a];
}
// Skärmaxeln ett lager lägger sina VÄRDEN längs (den andra bär kategorin eller x-värdet).
function _vardeaxel(l) { return l.riktning === 'liggande' ? 'x' : 'y'; }
// Vilken skärmaxel figurens axel a ('x' | 'y' | 'y2') motsvarar för lagret, eller null.
function _skarmaxel(l, a) {
    if (a === 'x') return 'x';
    return (l.axel || 'y') === a ? 'y' : null;
}

/** Alla värden som lagren lägger på en axel ('x' | 'y' | 'y2'), i dataordning. */
function axelVarden(figur, axel) {
    const ut = [];
    for (const l of figur.lager) {
        const a = _skarmaxel(l, axel);
        if (!a) continue;
        const falt = _falt(l, a);
        const medFel = (l.marke === 'stapel' || l.marke === 'punkt') && _vardeaxel(l) === a;
        for (const d of l.data) {
            for (const f of falt) if (d[f] != null) ut.push(d[f]);
            if (medFel && d.fel) ut.push(d.fel.lag, d.fel.hog);
        }
    }
    return ut;
}

// Staplade staplar staplar positiva värden uppåt och negativa nedåt, var för sig, per kategori och panel.
// Ger { min, max } (största positiva summan, mest negativa summan; null om ingen) eller null.
function _staplatSpann(figur, axel) {
    const plus = new Map(), minus = new Map();
    for (const l of figur.lager) {
        if (l.marke !== 'stapel' || l.lage !== 'staplad') continue;
        const a = _skarmaxel(l, axel);
        if (!a || _vardeaxel(l) !== a) continue;
        const kat = a === 'x' ? 'y' : 'x';
        const panel = l.panel == null ? '' : String(l.panel);
        for (const d of l.data) {
            if (!d) continue;
            const v = d[a];
            if (typeof v !== 'number' || !isFinite(v) || v === 0) continue;
            const m = v > 0 ? plus : minus;
            const k = panel + '\u0000' + String(d[kat]);
            m.set(k, (m.get(k) || 0) + v);
        }
    }
    let min = null, max = null;
    for (const v of plus.values()) if (max == null || v > max) max = v;
    for (const v of minus.values()) if (min == null || v < min) min = v;
    return min == null && max == null ? null : { min, max };
}

/**
 * Domänen för en axel. Bandskala: kategorierna som FINNS i lagrens data (som strängar), med
 * axelns `ordning` först — en etikett utan datapunkt ritas aldrig, så små grupper som tagits
 * bort lämnar inget spår på axeln (ADR-14). Talskala: [min, max]; staplar tar med noll.
 */
function skalDoman(figur, axel) {
    const a = figur[axel];
    const varden = axelVarden(figur, axel);
    if (a.skala === 'band') {
        const finns = [];
        const sedda = new Set();
        for (const v of varden) { const k = String(v); if (!sedda.has(k)) { sedda.add(k); finns.push(k); } }
        const forst = (a.ordning || []).map(String).filter(k => sedda.has(k));
        const forstSet = new Set(forst);
        return [...forst, ...finns.filter(k => !forstSet.has(k))];
    }
    if (Array.isArray(a.doman) && a.doman.length === 2) return [a.doman[0], a.doman[1]];
    /** @type {number|null} */ let min = null;
    /** @type {number|null} */ let max = null;
    for (const v of varden) {
        if (typeof v !== 'number' || !isFinite(v)) continue;
        if (min == null || v < min) min = v;
        if (max == null || v > max) max = v;
    }
    if (min == null || max == null) return a.skala === 'log' ? [1, 10] : [0, 1];
    const spann = _staplatSpann(figur, axel);
    if (spann) {
        if (spann.max != null && spann.max > max) max = spann.max;
        if (spann.min != null && spann.min < min) min = spann.min;
    }
    if (a.skala !== 'log') {
        const harStapel = figur.lager.some(l => l.marke === 'stapel' && _skarmaxel(l, axel) === _vardeaxel(l));
        if (harStapel) { if (min > 0) min = 0; if (max < 0) max = 0; }
    }
    if (min === max) { min -= 1; max += 1; }
    return [min, max];
}

/**
 * De paneler som har minst ett av lagren, i panelernas ordning. Ett lager utan `panel` hör till varje
 * panel. Regeln finns bara här: utanSmaGrupper och ritaren (_rfSynligt) använder den båda, så figuren
 * och bilden namnger aldrig olika paneler.
 */
function panelerMedLager(paneler, lager) {
    return paneler.filter(p => lager.some(l => l.panel == null || l.panel === p));
}

/**
 * Figuren utan datapunkter märkta `liten`, utan lager som blev tomma och utan null-poster i data.
 * Originalet rörs inte. Bandaxlarna får originalets kategoriordning som `ordning`, begränsad till
 * kategorier som finns kvar, och `paneler` bara de paneler som har något lager kvar — figuren bär
 * alltså inga namn på borttagna grupper.
 */
function utanSmaGrupper(figur) {
    const rent = l => ({ ...l, data: l.data.filter(d => d && typeof d === 'object') });
    const lager = figur.lager.map(l => ({ ...rent(l), data: rent(l).data.filter(d => !d.liten) })).filter(l => l.data.length);
    const ut = { ...figur, lager };
    if (Array.isArray(figur.paneler)) ut.paneler = panelerMedLager(figur.paneler, lager);
    const original = { ...figur, lager: figur.lager.map(rent) };
    for (const a of ['x', 'y']) {
        if (!figur[a] || figur[a].skala !== 'band') continue;
        // Originalets ordning (uttrycklig `ordning` först, sedan första förekomst), därefter bara det som finns kvar.
        const full = skalDoman(original, a);
        ut[a] = { ...figur[a], ordning: skalDoman({ ...ut, [a]: { ...figur[a], ordning: full } }, a) };
    }
    return ut;
}

/** Antal datapunkter i figuren. */
function antalPunkter(figur) {
    let n = 0;
    for (const l of figur.lager) n += l.data.length;
    return n;
}

/**
 * Lådans mått: kvartiler med samma metod som verktygets tabeller (stat.js quantile), morrhår
 * till yttersta värdet inom 1,5 kvartilavstånd, övriga som avvikare.
 * @returns {{q1:number, median:number, q3:number, lag:number, hog:number, avvikare:number[]} | null}
 */
function ladstatistik(varden) {
    const v = (varden || []).filter(x => typeof x === 'number' && isFinite(x)).sort((a, b) => a - b);
    if (!v.length) return null;
    const q1 = quantile(v, 0.25), median = quantile(v, 0.5), q3 = quantile(v, 0.75);
    const kant = 1.5 * (q3 - q1);
    const inom = v.filter(x => x >= q1 - kant && x <= q3 + kant);
    return { q1, median, q3, lag: inom[0], hog: inom[inom.length - 1], avvikare: v.filter(x => x < q1 - kant || x > q3 + kant) };
}

// Färgskalans domän: ett objekt med `doman` = två ändliga tal.
function _fargdomanOk(fs) {
    return !!fs && typeof fs === 'object' && Array.isArray(fs.doman) && fs.doman.length === 2
        && fs.doman.every(n => typeof n === 'number' && isFinite(n));
}

// Prövar lagrets datapunkter i ett enda varv: objekt, och på talaxlar ändliga tal (eller null/undefined).
function _provaData(l, i, figur, fel) {
    const talFalt = [];
    for (const a of ['x', 'y']) {
        const ax = a === 'y' && l.axel === 'y2' ? figur.y2 : figur[a];
        if (!ax || ax.skala === 'band') continue;
        for (const f of _falt(l, a)) talFalt.push(f);
        if ((l.marke === 'stapel' || l.marke === 'punkt') && _vardeaxel(l) === a) talFalt.push('fel.lag', 'fel.hog');
    }
    for (const f of ['varde', 'fargvarde', 'storlek', 'skillnadKr']) if (!talFalt.includes(f)) talFalt.push(f);
    const ok = v => v == null || (typeof v === 'number' && isFinite(v));
    for (let n = 0; n < l.data.length; n++) {
        const d = l.data[n];
        if (d === null || typeof d !== 'object') fel(`lager ${i}: datapunkt ${n} är inte ett objekt`);
        for (const f of talFalt) {
            const v = f.startsWith('fel.') ? (d.fel ? d.fel[f.slice(4)] : undefined) : d[f];
            if (!ok(v)) fel(`lager ${i}: datapunkt ${n}: fältet "${f}" måste vara ett ändligt tal (fick ${typeof v === 'string' ? `"${v}"` : String(v)})`);
        }
    }
}

/**
 * Kastar ett fel med diagrammets id och orsaken om figuren inte går att rita.
 * @returns figuren, oförändrad
 */
function valideraFigur(figur, id = 'diagram') {
    const fel = m => { throw new Error(`Ogiltig figur (${id}): ${m}`); };
    if (!figur || typeof figur !== 'object') fel('figuren saknas');
    if (typeof figur.beskrivning !== 'string' || !figur.beskrivning.trim()) fel('beskrivning saknas');
    for (const a of ['x', 'y']) {
        if (!figur[a] || !SKALOR.includes(figur[a].skala)) fel(`axeln ${a} saknar giltig skala`);
    }
    for (const a of ['x', 'y', 'y2']) {
        const ax = figur[a];
        if (!ax || ax.skala === 'band' || ax.doman == null) continue;
        const d = ax.doman;
        const ok = Array.isArray(d) && d.length === 2 && d.every(n => typeof n === 'number' && isFinite(n)) && d[0] !== d[1]
            && (ax.skala !== 'log' || (d[0] > 0 && d[1] > 0));
        if (!ok) fel(`axeln ${a}: doman måste vara två olika ändliga tal${ax.skala === 'log' ? ' större än noll' : ''}`);
    }
    if (figur.y2 && figur.y2.skala !== 'linjar') fel('y2 måste ha skalan linjar');
    if (!Array.isArray(figur.lager) || !figur.lager.length) fel('lager saknas');
    // paneler: 'auto' — radpaneler för många kategorier: bara för en liggande figur med
    // kategorier på y, och lagren får då ingen egen panel.
    if (figur.paneler != null && !Array.isArray(figur.paneler) && figur.paneler !== 'auto') fel('paneler måste vara en lista eller "auto"');
    if (figur.paneler === 'auto') {
        if (!figur.y || figur.y.skala !== 'band') fel('paneler "auto" kräver bandskala på y');
        if (figur.lager.some(l => !(l.riktning === 'liggande' || l.marke === 'punkt') || l.panel != null)) fel('paneler "auto" kräver liggande lager (eller punkter) utan egen panel');
    }
    const paneler = Array.isArray(figur.paneler) ? figur.paneler : [];
    figur.lager.forEach((l, i) => {
        if (!l || !MARKEN.includes(l.marke)) fel(`lager ${i}: okänt märke "${l && l.marke}"`);
        if (!Array.isArray(l.data)) fel(`lager ${i}: data saknas`);
        if (l.axel === 'y2' && !figur.y2) fel(`lager ${i}: axeln y2 finns inte i figuren`);
        if (l.panel != null && !paneler.includes(l.panel)) fel(`lager ${i}: panelen "${l.panel}" finns inte`);
        if (l.tips != null && typeof l.tips !== 'function') fel(`lager ${i}: tips måste vara en funktion`);
        const behoverFarg = l.marke === 'ruta' || (l.marke === 'punkt' && l.data.some(d => d && d.fargvarde != null));
        if (behoverFarg && !figur.fargskala) fel(`lager ${i}: ${l.marke} med färgvärde kräver fargskala`);
        // Utan användbar domän kan ritaren inte färga något, och diagrammet skulle bli tomt utan fel. Lika tal är
        // tillåtna (ritaren vidgar domänen, som skalDoman gör för min === max); omvänd domän ger omvänd skala.
        if (behoverFarg && !_fargdomanOk(figur.fargskala)) fel('fargskala: doman måste vara två ändliga tal');
        // Lådor ritas bara stående (kategorin på x, värdet på y): en liggande låda skulle annars godkännas men aldrig ritas.
        if (l.monster != null && !(l.marke === 'stapel' && (l.monster === 'linjer' || l.monster === 'prickar'))) fel(`lager ${i}: monster måste vara "linjer" eller "prickar" och gäller bara stapel`);
        if (l.marke === 'lada' && l.riktning === 'liggande') fel(`lager ${i}: lada stöder bara stående riktning`);
        if (l.marke === 'lada' && l.form != null && !['fiol', 'regnmoln', 'kvantiler'].includes(l.form)) fel(`lager ${i}: form måste vara "fiol", "regnmoln" eller "kvantiler"`);
        if (l.antal != null && !(l.marke === 'lada' && l.form === 'kvantiler' && (l.antal === 20 || l.antal === 50))) fel(`lager ${i}: antal måste vara 20 eller 50 och gäller bara lada med form "kvantiler"`);
        // Staplar och lådor ritas per kategori och ruta i ett rutnät: kategorierna måste ligga på en bandskala.
        const kategori = l.riktning === 'liggande' ? 'y' : 'x';
        if ((l.marke === 'stapel' || l.marke === 'lada') && figur[kategori].skala !== 'band') fel(`lager ${i}: ${l.marke} kräver bandskala på kategoriaxeln (${kategori})`);
        if (l.marke === 'ruta' && (figur.x.skala !== 'band' || figur.y.skala !== 'band')) fel(`lager ${i}: ruta kräver bandskala på både x och y`);
        if (l.marke === 'yta' && (figur.x.skala === 'band' || figur.y.skala === 'band')) fel(`lager ${i}: yta kräver talaxlar på både x och y`);
        _provaData(l, i, figur, fel);
    });
    for (const a of ['x', 'y']) {
        if (figur[a].skala !== 'log') continue;
        if (axelVarden(figur, a).some(v => typeof v === 'number' && v <= 0)) fel(`axeln ${a} är logaritmisk och kräver värden större än noll`);
    }
    return figur;
}

const _cell = v => (v == null || (typeof v === 'number' && !isFinite(v))) ? '' : v;
function _serienamn(figur, l, i) {
    let namn = l.serie ? String(l.serie) : `Serie ${i + 1}`;
    // Ett lager på högra axeln skulle annars läsas under vänsteraxelns rubrik.
    if (l.axel === 'y2') namn += figur.y2 && figur.y2.titel ? ` (höger axel: ${figur.y2.titel})` : ' (höger axel)';
    return l.panel != null ? `${namn} · ${l.panel}` : namn;
}

/**
 * Figuren som rad-matris för CSV och urklipp. `ruta` blir en korstabell per lager; övriga
 * märken långt format (Serie | x | y, och Undre | Övre när figuren har band, intervall,
 * felstaplar eller lådor). En `lada` skrivs ALDRIG som individer (dataminimering): en rad per
 * kategori med lådans statistik — median under y, första kvartilen under Undre och tredje
 * under Övre — i axelns ordning, för båda `punkter`-lägena. Anroparen ansvarar för små
 * grupper (utanSmaGrupper; statistiken räknas då bara ur det som finns kvar) och spårbarhetsraden.
 * @returns {Array<Array<string|number>>}
 */
function figurTillTabell(figur) {
    const block = [];
    // En null-post i data hoppas över (ovaliderad indata ska inte kasta).
    figur = { ...figur, lager: figur.lager.map(l => ({ ...l, data: (l.data || []).filter(d => d != null) })) };
    figur.lager.forEach((l, i) => {
        if (l.marke !== 'ruta' || !l.data.length) return;
        const en = { ...figur, lager: [l] };
        const xs = skalDoman({ ...en, x: { ...figur.x, skala: 'band' } }, 'x');
        const ys = skalDoman({ ...en, y: { ...figur.y, skala: 'band' } }, 'y');
        const cell = new Map(l.data.map(d => [String(d.x) + '\u0000' + String(d.y), d.varde]));
        const b = [[_serienamn(figur, l, i), ...xs]];
        for (const y of ys) b.push([y, ...xs.map(x => _cell(cell.get(x + '\u0000' + y)))]);
        block.push(b);
    });

    // Ett lager märkt `utanData` bär bara etiketter till värden som redan står i ett annat lager, och får inga rader.
    const ovriga = figur.lager.map((l, i) => [l, i]).filter(([l]) => l.marke !== 'ruta' && l.data.length && !l.utanData);
    if (ovriga.length) {
        const spann = ovriga.some(([l]) => l.marke === 'band' || l.marke === 'intervall' || l.marke === 'lada' || l.data.some(d => d.fel));
        const xOrdning = ovriga.some(([l]) => l.marke === 'lada') ? skalDoman({ ...figur, x: { ...figur.x, skala: 'band' } }, 'x') : [];
        const rubrik = ['Serie', (figur.x && figur.x.titel) || 'x', (figur.y && figur.y.titel) || 'y'];
        if (spann) rubrik.push('Undre', 'Övre');
        // Skillnaden i kronor (kronorSkillnad) får en egen kolumn när någon punkt bär den.
        const kronor = ovriga.some(([l]) => l.data.some(d => typeof d.skillnadKr === 'number'));
        if (kronor) rubrik.push('Skillnad (kr/mån)');
        const b = [rubrik];
        for (const [l, i] of ovriga) {
            const harSpann = l.marke === 'band' || l.marke === 'intervall';
            const liggande = l.riktning === 'liggande';
            if (l.marke === 'yta') {
                // En yta bär ett namn och ett värde, inte ett läge: raden är Serie | namn | värde.
                for (const d of l.data) { const rad = [_serienamn(figur, l, i), _cell(d.namn != null ? d.namn : d.etikett), _cell(d.varde)]; if (spann) rad.push('', ''); if (kronor) rad.push(''); b.push(rad); }
                continue;
            }
            if (l.marke === 'lada') {
                const grupper = new Map();
                for (const d of l.data) {
                    const k = String(d.x);
                    if (!grupper.has(k)) grupper.set(k, []);
                    grupper.get(k).push(d.y);
                }
                if (l.form === 'kvantiler') {
                    // Kvantilpunkter: en rad per prick med kvantilens värde — aldrig individer.
                    for (const k of xOrdning) {
                        const kp = grupper.has(k) ? kvantilpunkter(grupper.get(k), l.antal || 20) : null;
                        if (kp) kp.varden.forEach((v, j) => b.push([_serienamn(figur, l, i), `${k} · ${j + 1}/${kp.antal}`, v, '', '', ...(kronor ? [''] : [])]));
                    }
                    continue;
                }
                for (const k of xOrdning) {
                    const st = grupper.has(k) ? ladstatistik(grupper.get(k)) : null;
                    if (st) b.push([_serienamn(figur, l, i), k, st.median, st.q1, st.q3, ...(kronor ? [''] : [])]);
                }
                continue;
            }
            for (const d of l.data) {
                // Ett spann ligger längs värdeaxeln; den cellen lämnas tom och gränserna står i Undre/Övre.
                // Ett lager märkt `absolut` ritas åt det negativa hållet (divergerande stapel) men bär en storlek:
                // värdet skrivs utan tecken.
                const abs = (v, varde) => (l.absolut && varde && typeof v === 'number' ? Math.abs(v) : v);
                const x = harSpann && l.marke === 'intervall' && liggande ? '' : _cell(abs(d.x, liggande));
                const y = harSpann && !(l.marke === 'intervall' && liggande) ? '' : _cell(abs(d.y, !liggande));
                const rad = [_serienamn(figur, l, i), x, y];
                if (spann) {
                    const g = harSpann ? d : (d.fel || {});
                    rad.push(_cell(g.lag), _cell(g.hog));
                }
                if (kronor) rad.push(_cell(d.skillnadKr));
                b.push(rad);
            }
        }
        block.push(b);
    }

    const ut = [];
    block.forEach((b, i) => { if (i) ut.push([]); ut.push(...b); });
    return ut;
}

    return { talformat, valideraFigur, utanSmaGrupper, skalDoman, ladstatistik, antalPunkter, figurTillTabell, panelerMedLager, kronorSkillnad, kronorTipsRad, kvantilpunkter };
})();
const _figTalformat = __mirrorFigur.talformat;
const _figValidera = __mirrorFigur.valideraFigur;
const _figUtanSma = __mirrorFigur.utanSmaGrupper;
const _figSkalDoman = __mirrorFigur.skalDoman;
const _figLadstatistik = __mirrorFigur.ladstatistik;
const _figAntalPunkter = __mirrorFigur.antalPunkter;
const _figTillTabell = __mirrorFigur.figurTillTabell;
const _figPanelerMedLager = __mirrorFigur.panelerMedLager;
const _figKronorSkillnad = __mirrorFigur.kronorSkillnad;
const _figKronorTipsRad = __mirrorFigur.kronorTipsRad;
const _figKvantilpunkter = __mirrorFigur.kvantilpunkter;
/* eslint-enable */

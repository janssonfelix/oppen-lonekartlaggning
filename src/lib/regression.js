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

import { fitOLS, invert, matMul, pValue2Sided, tQuantile } from './stat.js';
import { basRangFn } from './likvardighet.js';

// Diagnostiserar varför modellen misslyckas
export function diagnoseCollinearity(rows, basList) {
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
export function computePerBasGap(rows, basList, { golv }) {
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
export function basIndikatorer(basList) {
    return basList.slice(1);
}

// golv = statGolv(): minsta antal per kön för att ett ansvarssteg ska redovisas.
export function computeSequentialGap(rows, ageMean, basList, { golv }) {
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
export function computeYrkesgruppGap(rows, y, isKv, ageC) {
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
export function quantileRegression(X, y, tau, maxIter = 60, tol = 1e-5) {
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
 * "Interaction" = samspel mellan skillnader i karakteristika och
 *    skillnader i avkastning. Räknas som "oförklarat" i en tredelad uppdelning.
 *
 * Klassisk presentation (Medlingsinstitutet använder denna form):
 *   Förklarat   = Endowment
 *   Oförklarat  = Coefficient + Interaction
 *
 * Modell: ln(lön) ~ ålder (centrerad) + en indikator per BAS-intervall — samma kodning som huvudregressionen
 * (ADR-44, ADR-53) — körd separat för kvinnor respektive män. Referensintervallet är det alfabetiskt första
 * som finns hos BÅDA könen; ett intervall som bara finns hos ett kön får en indikator bara i det könets modell
 * (det andra könets koefficient är 0), så dess bidrag hamnar i samspelet. Komponenterna redovisas per
 * variabel som intercept, ålder och BAS, där BAS är summan över indikatorerna.
 *
 * @param {any[]} rows - råradernas poster; filtreras här på lön, ålder och kön.
 * @param {{golv:number}} opts golv = statGolv().
 * @returns {null | {
 *   rawGapPct:number, explainedPct:number, unexplainedPct:number,
 *   endowmentPct:number, coefficientPct:number, interactionPct:number,
 *   components:{age:{q,u,i}, bas:{q,u,i}, intercept:{q,u,i}},
 *   basRef:string, basIndikatorer:string[],
 *   n:number, nKv:number, nMa:number,
 *   _raw:{rawGapLog:number, q:number, u:number, i:number}
 * }}
 */
export function blinderOaxaca(rows, { golv }) {
    const raw = rows.filter(d => d.lon > 0 && d.alder > 0 &&
        (d.kon.includes('kvinna') || d.kon === 'man' || d.kon === 'män'));
    if (raw.length < 50) return null;
    const kv = raw.filter(d => d.kon.includes('kvinna'));
    const ma = raw.filter(d => d.kon === 'man' || d.kon === 'män');
    if (kv.length < golv || ma.length < golv) return null;

    const ageMean = raw.reduce((s, d) => s + d.alder, 0) / raw.length;
    const basList = [...new Set(raw.map(d => d.bas))].sort();
    const harKv = new Set(kv.map(d => d.bas)), harMa = new Set(ma.map(d => d.bas));
    const basRef = basList.find(b => harKv.has(b) && harMa.has(b));
    if (basRef == null) return null;
    const indikatorer = basList.filter(b => b !== basRef);

    // Designmatris för en grupp: [1, ålder − ageMean, indikator per BAS utom referensen]. En indikator som är noll
    // för alla i gruppen (intervallet saknas hos könet) lämnas utanför gruppens skattning och får β = 0.
    const kolumner = group => indikatorer.map(b => group.some(d => d.bas === b));
    const design = (group, med) => ({
        X: group.map(d => [1, d.alder - ageMean, ...indikatorer.filter((_, j) => med[j]).map(b => (d.bas === b ? 1 : 0))]),
        y: group.map(d => Math.log(d.lon)) });
    const medKv = kolumner(kv), medMa = kolumner(ma);
    const fitK = fitOLS(design(kv, medKv).X, design(kv, medKv).y);
    const fitM = fitOLS(design(ma, medMa).X, design(ma, medMa).y);
    if (!fitK || !fitM) return null;
    // Koefficienter i full längd (2 + antal indikatorer), 0 där intervallet saknas hos könet.
    const fullBeta = (fit, med) => { const b = [fit.beta[0], fit.beta[1]]; let j = 2; for (const m of med) b.push(m ? fit.beta[j++] : 0); return b; };
    const betaKv = fullBeta(fitK, medKv), betaMa = fullBeta(fitM, medMa);
    const p = betaKv.length;

    // Gruppmedelvärden för X̄ i full längd.
    const meanX = group => {
        const out = new Array(p).fill(0);
        for (const d of group) { out[0] += 1; out[1] += d.alder - ageMean; indikatorer.forEach((b, j) => { if (d.bas === b) out[2 + j] += 1; }); }
        return out.map(v => v / group.length);
    };
    const xKv = meanX(kv), xMa = meanX(ma);

    const dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0);
    const lnKv = dot(xKv, betaKv);
    const lnMa = dot(xMa, betaMa);
    const rawGapLog = lnMa - lnKv;

    // Dekomposition per kolumn; BAS-indikatorerna summeras till en komponent.
    /** @type {{intercept:{q:number,u:number,i:number}, age:{q:number,u:number,i:number}, bas:{q:number,u:number,i:number}}} */
    const components = { intercept: { q: 0, u: 0, i: 0 }, age: { q: 0, u: 0, i: 0 }, bas: { q: 0, u: 0, i: 0 } };
    let qSum = 0, uSum = 0, iSum = 0;
    for (let k = 0; k < p; k++) {
        const dx = xMa[k] - xKv[k];          // skillnad i karakteristika
        const db = betaMa[k] - betaKv[k];    // skillnad i koefficient
        const q = dx * betaKv[k];            // endowment
        const u = xKv[k] * db;               // coefficient
        const i = dx * db;                   // interaction
        const c = components[k === 0 ? 'intercept' : k === 1 ? 'age' : 'bas'];
        c.q += q; c.u += u; c.i += i;
        qSum += q; uSum += u; iSum += i;
    }
    // Kontroll: qSum + uSum + iSum ≈ rawGapLog (avvikelse ~1e-10 förväntas pga floating point)

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
        basRef, basIndikatorer: indikatorer,
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
export function quantileRegressionAtAllTau(rows, { rang = basRangFn } = {}) {
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

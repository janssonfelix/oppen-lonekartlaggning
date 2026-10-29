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

import { fitOLS, pValue2Sided, tQuantile } from './stat.js';

/**
 * @param {Array<{lon:number, alder:number, kon:string, bas:string}>} rader
 * @param {{fixBas?:string|null, golv:number}} opt
 *        fixBas: BAS-intervall att fixera vid i prediktionerna (default = mest folkrika).
 *        golv: minsta antal personer per kön (statGolv() i appen).
 * @returns {Object} { error, errorCode } eller resultat med koefficienter, prediktioner och gap per ålder.
 */
export function livscykelRegression(rader, { fixBas, golv }) {
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

    // Gap per ålder: log(man) - log(kvinna) = -[β_kv + β_kv×age·ac + β_kv×age²·ac²]
    // Procentskillnad: (exp(logGap) - 1) × 100
    const gapPerAge = ages.map(a => {
        const ac = a - ageMean;
        const ac2 = ac * ac;
        const logGap = -(fit.beta[idxKv] + fit.beta[idxKvAge] * ac + fit.beta[idxKvAge2] * ac2);
        // SE av logGap-uttrycket (linjär kombination av tre koefficienter)
        // Var(c1·β1 + c2·β2 + c3·β3) = c'·V·c där c = [-1, -ac, -ac²] över relevanta dimensioner
        const c = [-1, -ac, -ac2];
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

    // Tolkning: nyckeltal för gapet vid 25 och 65 år och förändringen däremellan
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

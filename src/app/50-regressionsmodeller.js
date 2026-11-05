// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
// Regressionsmodeller för lika arbete — app-adaptern
// ============================================================
// De rena modellerna (kollinearitet, gap per BAS, sekventiell dekomponering med
// yrkesgrupp, kvantilregression, Blinder-Oaxaca) ligger i src/lib/regression.js och
// speglas in i 09-lib-speglar.js (ADR-8). Här finns bara de tunna adaptrarna som
// läser appens tillstånd (getData(), statGolv()) och skickar det som parametrar.
//
// OLS-kärnan (_fitOLS m.fl.) och BAS-rangen (_lvBasRangFn) är också speglade.
// runOLSRegression ligger kvar i 51-lika-arbete-regressionskort.js och flyttas inte (ADR-17).

// Diagnostiserar varför modellen misslyckas
function _diagnoseCollinearity(rows, basList) {
    return _rgDiagnoseCollinearity(rows, basList);
}

// Per-BAS conditional regressions: gap inom varje BAS efter ålderskontroll
function _computePerBasGap(rows, basList) {
    return _rgComputePerBasGap(rows, basList, { golv: statGolv() });
}

// BAS kodas som indikatorvariabler (en kolumn per BAS-intervall utom det första, som är referens)
function _basIndikatorer(basList) {
    return _rgBasIndikatorer(basList);
}

// Sekventiell dekomponering: visa hur gapet krymper när kontroller läggs till. modell = förklaringsmodellen (ADR-56).
function _computeSequentialGap(rows, ageMean, basList, modell) {
    return _rgComputeSequentialGap(rows, ageMean, basList, { golv: statGolv(), modell });
}

// Vad varje variabel tillför (ADR-56), alltid mot fullmodellen; yrkesgrupp bara när lönefilen har AID eller yrke.
function _computeVariabelTillfor(rows, ageMean, basList) {
    return _rgComputeVariabelTillfor(rows, ageMean, basList, { golv: statGolv(), harYrke: rows.some(d => d.aid || d.yrke) });
}

// Kvantilregression via IRLS; standardvärdena för maxIter och tol ligger i src/lib/regression.js.
function _quantileRegression(X, y, tau, maxIter, tol) {
    return _rgQuantileRegression(X, y, tau, maxIter, tol);
}

// ---- Förklaringsmodellen (ADR-56) ----
/** Den gällande modellen, normaliserad mot datat (yrkesgrupp kan bara väljas när lönefilen har AID eller yrke). */
function forklaringsmodell() {
    return _rgNormaliseraForklaringsmodell(state.forklaringsmodell, { harYrke: getData().some(d => d.aid || d.yrke) }).modell;
}

/**
 * Sätter förklaringsmodellen. Standard lagras som null. Allt som är ritat bär den gamla modellen (huvudtalet
 * används i Översikt, Lika arbete, Struktur, Att göra och rapporten) och ritas om på samma väg som när tröskeln
 * ändras (sattKTroskel utan stegvis).
 * @param {any} v
 * @param {{rita?: boolean}} [opts]
 * @returns {{ok: true, modell: {bas:boolean, alder:boolean, yrkesgrupp:boolean, skal:string}, varningar: string[], andrad: boolean}}
 */
function sattForklaringsmodell(v, { rita = true } = {}) {
    const { modell, varningar } = _rgNormaliseraForklaringsmodell(v, { harYrke: getData().some(d => d.aid || d.yrke) });
    const ny = _rgForklaringsmodellArStandard(modell) ? null : modell;
    const andrad = JSON.stringify(ny) !== JSON.stringify(state.forklaringsmodell);
    state.forklaringsmodell = ny;
    if (andrad && rita) {
        if (typeof ritGenerationNy === 'function') ritGenerationNy();
        if (typeof _renderaOmAllaFlikar === 'function') _renderaOmAllaFlikar();
    }
    return { ok: true, modell, varningar, andrad };
}

// Blinder-Oaxaca-dekomposition på appens data (getData()).
function runBlinderOaxaca() {
    // Samma variabler som huvudmodellen (ADR-53): förklaringsmodellen ur tillståndet (ADR-56).
    return _rgBlinderOaxaca(getData(), { golv: statGolv(), modell: forklaringsmodell() });
}

// Kvantilregression vid τ ∈ {.10, .50, .90} på appens data (getData()).
function runQuantileRegressionAtAllTau() {
    return _rgQuantileRegressionAtAllTau(getData(), { rang: _lvBasRangFn });
}

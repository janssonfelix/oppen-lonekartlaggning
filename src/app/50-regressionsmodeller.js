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

// Sekventiell dekomponering: visa hur gapet krymper när kontroller läggs till
function _computeSequentialGap(rows, ageMean, basList) {
    return _rgComputeSequentialGap(rows, ageMean, basList, { golv: statGolv() });
}

// Kvantilregression via IRLS; standardvärdena för maxIter och tol ligger i src/lib/regression.js.
function _quantileRegression(X, y, tau, maxIter, tol) {
    return _rgQuantileRegression(X, y, tau, maxIter, tol);
}

// Blinder-Oaxaca-dekomposition på appens data (getData()).
function runBlinderOaxaca() {
    return _rgBlinderOaxaca(getData(), { golv: statGolv(), rang: _lvBasRangFn });
}

// Kvantilregression vid τ ∈ {.10, .50, .90} på appens data (getData()).
function runQuantileRegressionAtAllTau() {
    return _rgQuantileRegressionAtAllTau(getData(), { rang: _lvBasRangFn });
}

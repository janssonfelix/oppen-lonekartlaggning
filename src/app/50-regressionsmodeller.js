// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
// Regressionsmodeller för lika arbete — app-adaptern
// ============================================================
// De rena modellerna (kollinearitet, gap per BAS, sekventiell dekomponering med
// yrkesgrupp, kvantilregression, Blinder-Oaxaca) ligger i src/lib/regression.js och
// speglas in i 09-lib-speglar.js (ADR-8). Här finns bara de tunna adaptrarna som
// läser appens tillstånd (getData(), statGolv()) och skickar det som parametrar.
//
// OLS-kärnan (_fitOLS m.fl.) är också speglad.
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
function _quantileRegression(X, y, tau, maxIter, tol, start) {
    return _rgQuantileRegression(X, y, tau, maxIter, tol, start);
}

// ---- Ålder i lönefilen (ADR-64) ----
// Ålderskolumnen är valfri. Utan den läser inläsningen ålder 0 på varje rad: modellerna räknas då utan ålder,
// fliken Ålder & karriär låses och exporterna hoppar åldersavsnitten. Svaret sparas per inläst underlag.
let _harAlderFor = /** @type {{data: any[]|null, n: number, varde: boolean}} */ ({ data: null, n: -1, varde: false });
/** Har den inlästa lönefilen ålder (minst en rad med ålder över 0)? */
function harAlder() {
    const d = getData();
    if (_harAlderFor.data !== d || _harAlderFor.n !== d.length) _harAlderFor = { data: d, n: d.length, varde: _rgHarAlderIRader(d) };
    return _harAlderFor.varde;
}

/** Metodreservationen om ålder (S7, ADR-64): vid nyckeltalet i Lika arbete, i regressionskortet och i rapportens metodtext. */
const ALDER_METODVAL_TEXT = 'Att ålder räknas bort är ett metodval för att skilja ut strukturella skillnader, inte ett ställningstagande om att ålder är ett sakligt skäl; det avgör ni.';
/** Meningen när lönefilen saknar ålder (ADR-64). */
const ALDER_SAKNAS_TEXT = 'Lönefilen saknar ålder: analysen körs utan åldersjustering, och Ålder & karriär visas inte.';

// ---- Förklaringsmodellen (ADR-56) ----
/** Den gällande modellen, normaliserad mot datat (yrkesgrupp kan bara väljas när lönefilen har AID eller yrke, ålder
 *  bara när lönefilen har ålder, ADR-64). */
function forklaringsmodell() {
    return _rgNormaliseraForklaringsmodell(state.forklaringsmodell, { harYrke: getData().some(d => d.aid || d.yrke), harAlder: harAlder() }).modell;
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
    const harYrke = getData().some(d => d.aid || d.yrke);
    const { modell, varningar } = _rgNormaliseraForklaringsmodell(v, { harYrke, harAlder: harAlder() });
    // Det som lagras prövas inte mot åldern (ADR-64): en lönefil utan ålder ändrar inte valet för nästa fil.
    const lagras = _rgNormaliseraForklaringsmodell(v, { harYrke }).modell;
    const ny = _rgForklaringsmodellArStandard(lagras) ? null : lagras;
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

// Kvantilregression vid τ ∈ {.10, .50, .90} på appens data (getData()), på huvudmodellens variabler enligt
// förklaringsmodellen utan yrkesgrupp (ADR-63).
function runQuantileRegressionAtAllTau() {
    return _rgQuantileRegressionAtAllTau(getData(), { modell: forklaringsmodell() });
}

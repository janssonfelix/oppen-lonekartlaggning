// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
// Regressionsmodeller för lika arbete — app-adaptern
// ============================================================
// De rena modellerna (huvudregressionen, kollinearitet, gap per BAS, sekventiell dekomponering med
// yrkesgrupp, kvantilregression, Blinder-Oaxaca) ligger i src/lib/regression.js, som
// appen importerar (ADR-98). Här finns bara de tunna adaptrarna som
// läser appens tillstånd (hamtaData(), statGolv()) och skickar det som parametrar.
//
// OLS-kärnan (anpassaOLS m.fl.) står i src/lib/stat.js.
// Huvudregressionens adapter, korOLSRegression, står i 51-lika-arbete-regressionskort.js; den cachas aldrig (ADR-17).
import { blinderOaxaca, forklaringsmodellArStandard, gapPerBas, harAlderIRader, kvantilregressionAllaTau, normaliseraForklaringsmodell, stegNamn } from '../lib/regression.js';
import { _ritaOmAllaFlikar, statGolv } from './06-k-troskel.js';
import { hamtaData, state } from './12-tillstand.js';
import { ritGenerationNy } from './23-exportgrind.js';

// Stegens nycklar i den sekventiella dekomponeringen (ADR-74): kortet, rapporten och exporten slår upp stegen på dem.
// Det som visas för ett steg kommer ur _rgStegEtikett.
export const _RG_STEG_BAS = stegNamn('bas');
export const _RG_STEG_YRKE = stegNamn('yrkesgrupp');

// Per-BAS conditional regressions: gap inom varje BAS efter ålderskontroll
export function _raknaPerBasGap(rows, basList) {
    return gapPerBas(rows, basList, { golv: statGolv() });
}

// ---- Ålder i lönefilen (ADR-64) ----
// Ålderskolumnen är valfri. Utan den läser inläsningen ålder 0 på varje rad: modellerna räknas då utan ålder,
// fliken Ålder & karriär låses och exporterna hoppar åldersavsnitten. Svaret sparas per inläst underlag.
let _harAlderFor = /** @type {{data: any[]|null, n: number, varde: boolean}} */ ({ data: null, n: -1, varde: false });
/** Har den inlästa lönefilen ålder (minst en rad med ålder över 0)? */
export function harAlder() {
    const d = hamtaData();
    if (_harAlderFor.data !== d || _harAlderFor.n !== d.length) _harAlderFor = { data: d, n: d.length, varde: harAlderIRader(d) };
    return _harAlderFor.varde;
}

/** Metodreservationen om ålder (S7, ADR-64): vid nyckeltalet i Lika arbete, i regressionskortet och i rapportens metodtext. */
export const ALDER_METODVAL_TEXT = 'Att ålder räknas bort är ett metodval för att skilja ut strukturella skillnader, inte ett ställningstagande om att ålder är ett sakligt skäl; det avgör ni.';
/** Meningen när lönefilen saknar ålder (ADR-64). */
export const ALDER_SAKNAS_TEXT = 'Lönefilen saknar ålder: analysen körs utan åldersjustering, och Ålder & karriär visas inte.';

// ---- Förklaringsmodellen (ADR-56) ----
/** Den gällande modellen, normaliserad mot datat (yrkesgrupp kan bara väljas när lönefilen har AID eller yrke, ålder
 *  bara när lönefilen har ålder, ADR-64). */
export function forklaringsmodell() {
    return normaliseraForklaringsmodell(state.forklaringsmodell, { harYrke: hamtaData().some(d => d.aid || d.yrke), harAlder: harAlder() }).modell;
}

/**
 * Sätter förklaringsmodellen. Standard lagras som null. Allt som är ritat bär den gamla modellen (huvudtalet
 * används i Översikt, Lika arbete, Struktur, Att göra och rapporten) och ritas om på samma väg som när tröskeln
 * ändras (sattKTroskel utan stegvis).
 * @param {any} v
 * @param {{rita?: boolean}} [opts]
 * @returns {{ok: true, modell: {bas:boolean, alder:boolean, yrkesgrupp:boolean, skal:string}, varningar: string[], andrad: boolean}}
 */
export function sattForklaringsmodell(v, { rita = true } = {}) {
    const harYrke = hamtaData().some(d => d.aid || d.yrke);
    const { modell, varningar } = normaliseraForklaringsmodell(v, { harYrke, harAlder: harAlder() });
    // Det som lagras prövas inte mot åldern (ADR-64): en lönefil utan ålder ändrar inte valet för nästa fil.
    const lagras = normaliseraForklaringsmodell(v, { harYrke }).modell;
    const ny = forklaringsmodellArStandard(lagras) ? null : lagras;
    const andrad = JSON.stringify(ny) !== JSON.stringify(state.forklaringsmodell);
    state.forklaringsmodell = ny;
    if (andrad && rita) {
        ritGenerationNy();
        _ritaOmAllaFlikar();
    }
    return { ok: true, modell, varningar, andrad };
}

// Blinder-Oaxaca-dekomposition på appens data (hamtaData()).
export function korBlinderOaxaca() {
    // Samma variabler som huvudmodellen (ADR-53): förklaringsmodellen ur tillståndet (ADR-56).
    return blinderOaxaca(hamtaData(), { golv: statGolv(), modell: forklaringsmodell() });
}

// Kvantilregression vid τ ∈ {.10, .50, .90} på appens data (hamtaData()), på huvudmodellens variabler enligt
// förklaringsmodellen utan yrkesgrupp (ADR-63).
export function korKvantilregressionAllaTau() {
    return kvantilregressionAllaTau(hamtaData(), { modell: forklaringsmodell() });
}

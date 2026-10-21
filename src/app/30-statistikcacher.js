// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
// ---- Statistiska cacher ----
/**
 * Ogiltigförklarar härledda statistiska cacher när
 * underliggande dataset ändras (ny inläsning, konfiguration, rensning).
 * Återskapar dem direkt — billigt nog att göra synkront, undviker att
 * UI:t visar inaktuella CI/MDE-värden för felaktigt urval.
 */
function invalidateStatCaches({ recompute = true } = {}) {
    if (typeof ritGenerationNy === 'function') ritGenerationNy();   // det som är ritat bygger på det som nu räknas om (exportgrinden)
    state.bootstrapCI = null;
    state.powerAnalysis = null;
    if (typeof laMinneSlapp === 'function') laMinneSlapp();   // översiktens och trattdiagrammets minne följer underlaget
    // Rensa även § 3:10-cachen så att JPA-export
    // inte plockar resultat beräknat på ett tidigare dataset.
    // Recompute sker lat — nästa render eller export gör en fresh compute.
    if (state.likvardighet) state.likvardighet.result = null;
    if (recompute && state.data && state.data.length) {
        // MEDVETEN DEGRADERING (inte bug-gömning):
        //
        // computeBootstrapCI() och computePowerAnalysis() är sekundära beräkningar
        // av icke-kritiska sekundära aggregat (CI-suffix på rågap, MDE-kort på
        // dashboarden). Om de misslyckas pga ett edge-case (n=0,
        // saknad sigma, DOM-element ej tillgängligt vid race-condition) ska
        // huvudanalysen fortsätta fungera utan att UI:t spårar ur.
        //
        // Vi använder INTE console.error eftersom verktyget har en
        // dokumenterad 0-console.log-policy (GDPR Art. 25 + transparens —
        // ingen risk att data hamnar i devtools-historik). Felindikering
        // sker istället implicit: CI-suffixet visas inte, MDE-kortet är dolt.
        // Dessa är cosmetiska — det skadar inte HR:s arbete om de saknas.
        try { computeBootstrapCI(); } catch (_e) {
            state.bootstrapCI = null;  // säkra att stale cache inte används
        }
        // Styrkeberäkningen (MDE) används av Prioriteringens detektionsvarning och
        // gruppstyrkan; Översikt visar Underlagets kvalitet (ADR-19).
        try { state.powerAnalysis = computePowerAnalysis(); } catch (_e) { state.powerAnalysis = null; }
    }
}

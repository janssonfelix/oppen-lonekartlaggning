// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
// Behållare som fylls av JavaScript med innehåll som kan bära lönedata. Exportgrinden (23-exportgrind.js) tömmer dem i
// flikar som inte längre är ritade med gällande tröskel. Varje id finns i sidan (tests/ktroskel.test.js). Rensa all data
// använder inga listor: den ställer tillbaka hela sidan (26-rensning.js).
export const RENSA_BEHALLARE = ['struktur-representation', 'struktur-distribution', 'struktur-eu', 'struktur-sektorer', 'forecast-outcome', 'explore-table',
    'outliers-table-wrap', 'print-report'];
export const RENSA_TABELLER = ['rapport-table', 'matrix-table', 'la-oversikt', 'pag-avvikelse-tabell', 'paygap-table', 'skevhet-table', 'benchmark-table', 'prio-table'];
export const RENSA_OVRIGT = ['action-checklist-container', 'data-validation-report', 'snapshot-comparison', 'consistency-banner-container', 'process-tracker', 'likvardighet-content', 'forklaringsmodell-panel', 'regression-card', 'blinder-oaxaca-card', 'handlingsplan-tbody', 'livscykel-content', 'lonepolitik-content', 'ref-overblick', 'jmf-slutsatser', 'robusthet-body', 'fardigcheck-body', 'rapportunderlag-innehall', 'gap-uppdelning-innehall', 'pag-innehall', 'att-gora-borja', 'aidbas-lika', 'aidbas-individ', 'aidbas-likvardigt', 'aidbas-hierarki', 'ut-alla-grupper',
    'forecast-threshold-result', 'forecast-sensitivity', 'forecast-rem-result',   // Löneöversyns knappresultat
    'dossier-body', 'basdossier-body', 'evidence-modal-content', 'skal-body'];   // dialogerna med gruppens tal

// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson

// ---- Stort demo: 5 000 påhittade personer i 100 yrken ----
// Generatorerna (genereraStortDemo, genereraStortDemoStatistik, _sdStallningstagande) och deras konstanter står i
// src/lib/demodata.js; appen når dem genom spegeln. Här står inläsningen och namnet på den påhittade statistiken.

const STORT_DEMO_STATISTIKNAMN = 'Påhittad jämförelsestatistik (demo)';

// Som det lilla demot (_lasInDemounderlag), men utan självdiagnostik: den hör till det lilla demots kända egenskaper.
function loadStortDemo() {
    if (!_lasInDemounderlag(genereraStortDemo, { stort: true })) return;
    /** @type {HTMLElement} */ (document.getElementById('diagnostic-results')).style.display = 'none';   // ett tidigare litet demos diagnostik gäller inte här
    _renderDemoBanner();
    announceToScreenReader(`Stort demo inläst: ${svTal(state.data.length)} påhittade personer i ${getBasIntervals().length} ${termForAntal(getBasIntervals().length, T.niva)}.`);
}
['first-run-stort-demo', 'upload-demo-stort'].forEach(id =>
    document.getElementById(id)?.addEventListener('click', loadStortDemo));

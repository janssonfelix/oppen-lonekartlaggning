// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
import { genereraStortDemo } from '../lib/demodata.js';
import { svTal } from '../lib/talformat.js';
import { ordForAntal } from '../lib/termer.js';
import { meddelaSkarmlasare } from './01-html-och-tillganglighet.js';
import { T } from './09-termer.js';
import { hamtaBasIntervall, state } from './12-tillstand.js';
import { _lasInDemounderlag, _ritaDemoruta } from './20-demodata-diagnostik.js';

// ---- Stort demo: 5 000 påhittade personer i 100 yrken ----
// Generatorerna (genereraStortDemo, genereraStortDemoStatistik, _sdStallningstagande) och deras konstanter står i
// src/lib/demodata.js; appen importerar dem. Här står inläsningen och namnet på den påhittade statistiken.

export const STORT_DEMO_STATISTIKNAMN = 'Påhittad jämförelsestatistik (demo)';

// Som det lilla demot (_lasInDemounderlag), men utan självdiagnostik: den hör till det lilla demots kända egenskaper.
export function loadStortDemo() {
    if (!_lasInDemounderlag(genereraStortDemo, { stort: true })) return;
    /** @type {HTMLElement} */ (document.getElementById('diagnostic-results')).style.display = 'none';   // ett tidigare litet demos diagnostik gäller inte här
    _ritaDemoruta();
    meddelaSkarmlasare(`Stort demo inläst: ${svTal(state.data.length)} påhittade personer i ${hamtaBasIntervall().length} ${ordForAntal(hamtaBasIntervall().length, T.niva)}.`);
}

/** Det som körs vid laddning, i filens ordning; src/app/index.js anropar delarnas uppstart i sifferordning. */
export function uppstartStortDemo() {
    ['first-run-stort-demo', 'upload-demo-stort'].forEach(id =>
        document.getElementById(id)?.addEventListener('click', loadStortDemo));
}

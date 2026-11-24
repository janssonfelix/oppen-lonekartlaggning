// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
/**
 * Appens adapter för huvudtalet: korOLSRegression (51-lika-arbete-regressionskort.js) ska ge exakt samma returvärde
 * som huvudregression i src/lib/regression.js, anropad i Node med samma rader och med argument som testet räknar
 * fram självt (den valda modellen, den inställda tröskeln och golvet max(k, standard)). Jämförelsen är djup och
 * bitvis: varje tal med Object.is, varje nyckel i samma ordning. Så vaktas att adaptern skickar rätt argument.
 * Prövas på demodatan, på den utan ålder, på modellerna med och utan AID-etikett inom BAS, med spärren för
 * Endast kön och med reservsteget.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { createAppWindow } from './helpers/app-harness.js';
import { forstaSkillnad } from './helpers/forsta-skillnad.js';
import { huvudregression, FORKLARINGSMODELL_STANDARD } from '../src/lib/regression.js';

const STD = { ...FORKLARINGSMODELL_STANDARD };
const FALL = [
    ['standardmodellen', STD, 10],
    ['AID-etikett inom BAS', { ...STD, yrkesgrupp: true }, 10],
    ['bara BAS, med skäl', { bas: true, alder: false, yrkesgrupp: false, skal: 'Ett påhittat skäl' }, 10],
    ['endast kön', { bas: false, alder: false, yrkesgrupp: false, skal: '' }, 10],
    ['endast kön med spärren', { bas: false, alder: false, yrkesgrupp: false, skal: '' }, 400],
    ['standardmodellen, sänkt tröskel', STD, 3],
    ['standardmodellen, höjd tröskel', STD, 60],
];

describe('[B3.1] korOLSRegression är en tunn adapter till huvudregression', () => {
    const w = createAppWindow();
    let demo;
    beforeAll(() => { w.__lasInDemodata(); demo = w.__state.data.map(r => ({ ...r })); });

    const underlag = {
        demodatan: () => demo,
        'demodatan utan ålder': () => demo.map(r => ({ ...r, alder: 0 })),
        'BAS sammanfaller med kön (reservsteget)': () => demo.map(r => ({ ...r, bas: r.kon.includes('kvinna') ? 'A' : 'B' })),
    };

    for (const [namn, data] of Object.entries(underlag)) {
        for (const [fall, modell, k] of FALL) {
            it(`${namn}: ${fall} (k = ${k})`, () => {
                w.__state.data = data().map(r => ({ ...r }));
                w.__state.kTroskel = k;
                w.eval(`sattForklaringsmodell(${JSON.stringify(modell)}, { rita: false })`);
                const app = w.__runOLS();
                const lib = huvudregression(w.__state.data, { modell, kInstalld: k, golv: w.__K });   // på skärmen är golvet 10 (ADR-103)
                expect(forstaSkillnad(app, lib)).toBeNull();
            });
        }
    }
});

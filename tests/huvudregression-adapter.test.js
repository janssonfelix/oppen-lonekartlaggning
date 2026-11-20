// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
/**
 * Appens adapter för huvudtalet: runOLSRegression (51-lika-arbete-regressionskort.js) ska ge exakt samma returvärde
 * som huvudregression i src/lib/regression.js, anropad i Node med samma rader och med argument som testet räknar
 * fram självt (den valda modellen, den inställda tröskeln och golvet max(k, standard)). Jämförelsen är djup och
 * bitvis: varje tal med Object.is, varje nyckel i samma ordning. Så vaktas att adaptern skickar rätt argument.
 * Prövas på demodatan, på den utan ålder, på modellerna med och utan AID-etikett inom BAS, med spärren för
 * Endast kön och med reservsteget.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { createAppWindow } from './helpers/app-harness.js';
import { huvudregression, FORKLARINGSMODELL_STANDARD } from '../src/lib/regression.js';

/** Första skillnaden mellan två värden som sökväg, eller null när de är lika (tal med Object.is, nycklar i ordning). */
function forstaSkillnad(a, b, vag = '') {
    if (typeof a === 'number' || typeof b === 'number') return Object.is(a, b) ? null : `${vag}: ${a} ≠ ${b}`;
    if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') return a === b ? null : `${vag}: ${a} ≠ ${b}`;
    if (Array.isArray(a) !== Array.isArray(b)) return `${vag}: lista mot objekt`;
    const ka = Object.keys(a), kb = Object.keys(b);
    if (ka.join('|') !== kb.join('|')) return `${vag}: nycklarna ${ka.join(',')} ≠ ${kb.join(',')}`;
    for (const k of ka) {
        const s = forstaSkillnad(a[k], b[k], `${vag}.${k}`);
        if (s) return s;
    }
    return null;
}

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

describe('runOLSRegression är en tunn adapter till huvudregression', () => {
    const w = createAppWindow();
    let demo;
    beforeAll(() => { w.__loadDemoData(); demo = w.__state.data.map(r => ({ ...r })); });

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
                const lib = huvudregression(w.__state.data, { modell, kInstalld: k, golv: Math.max(k, w.__K) });
                expect(forstaSkillnad(app, lib)).toBeNull();
            });
        }
    }
});

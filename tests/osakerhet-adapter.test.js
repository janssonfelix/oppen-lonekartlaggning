// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
/**
 * Appens adaptrar för osäkerheten kring skattningarna ska ge exakt samma returvärden som funktionerna i
 * src/lib/osakerhet.js, anropade i Node med samma rader och med argument som testet räknar fram självt (golvet
 * max(k, standard), tröskeln, förklaringsmodellen). Jämförelsen är djup och bitvis: varje tal med Object.is, varje nyckel
 * i samma ordning. Så vaktas att adaptrarna skickar rätt argument. Prövas på demodatan och på den utan ålder, vid
 * tröskeln 3, 10 och 25.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { createAppWindow } from './helpers/app-harness.js';
import { forstaSkillnad } from './helpers/forsta-skillnad.js';
import { kvantilDesign, kvantilregressionAllaTau } from '../src/lib/regression.js';
import {
    organisationensKvotKI, styrkeanalys, gruppMde, regressionslinjensBand, extremvarden, medianKvotKI, medianKvotKIGiltiga,
    trattUnderlag, kvantilBootstrap
} from '../src/lib/osakerhet.js';

const lika = (app, lib) => expect(forstaSkillnad(app, lib)).toBeNull();

/** Trattens underlag utan funktionen för fältets bredd, som i stället prövas i några punkter. */
const utanHalv = u => (u ? { sigma: u.sigma, punkter: u.punkter, halvar: [[3, 3], [5, 8], [10, 10], [40, 60]].map(([a, b]) => u.halv(a, b)) } : u);
const arKv = r => r.kon.includes('kvinna'), arMa = r => r.kon === 'man' || r.kon === 'män';

describe('[B4.1] osäkerhetens adaptrar i appen ger samma tal som src/lib/osakerhet.js', () => {
    const w = createAppWindow();
    let demo;
    beforeAll(() => { w.__loadDemoData(); demo = w.__state.data.map(r => ({ ...r })); });

    const underlag = {
        demodatan: () => demo,
        'demodatan utan ålder': () => demo.map(r => ({ ...r, alder: 0 })),
    };

    for (const [namn, data] of Object.entries(underlag)) {
        // Golvet är K_STANDARD på skärmen och följer den inställda tröskeln i exportläget (ADR-103).
        for (const [k, lage] of [[3, 'skarm'], [10, 'skarm'], [25, 'skarm'], [25, 'export']]) {
            describe(`${namn}, k = ${k}${lage === 'export' ? ' i exportläget' : ''}`, () => {
                let d, golv;
                beforeAll(() => {
                    w.__state.data = data().map(r => ({ ...r }));
                    w.__state.kTroskel = k;
                    w.__state.kLage = lage;
                    d = w.__state.data;
                    golv = lage === 'export' ? Math.max(k, w.__K) : w.__K;
                });

                it('computeBootstrapCI', () => {
                    w.eval('computeBootstrapCI()');
                    const { elapsed: _tid, ...app } = w.__state.bootstrapCI;
                    lika(app, organisationensKvotKI(d, golv));
                });
                it('computePowerAnalysis och computeGroupMDE', () => {
                    const app = w.eval('computePowerAnalysis()');
                    const lib = styrkeanalys(d, golv);
                    lika(app, lib);
                    w.__state.powerAnalysis = app;
                    for (const [nKv, nMa] of [[1, 5], [4, 9], [10, 10], [37, 12]]) {
                        lika(w.eval(`computeGroupMDE(${nKv}, ${nMa})`), gruppMde(nKv, nMa, lib.sigma));
                        lika(w.eval(`computeGroupMDE(${nKv}, ${nMa}, 0.08)`), gruppMde(nKv, nMa, 0.08));
                    }
                });
                it('detectOutliers', () => {
                    lika(w.eval('detectOutliers()'), extremvarden(d, golv, 3));
                    lika(w.eval('detectOutliers(2)'), extremvarden(d, golv, 2));
                });
                it('linearRegressionCI', () => {
                    const par = d.filter(r => r.alder > 0 && arKv(r)).map(r => [r.alder, r.lon]);
                    w.__par = par;
                    lika(w.eval('linearRegressionCI(window.__par, 20, 65, 25)'), regressionslinjensBand(par, 20, 65, 25));
                    lika(w.eval('linearRegressionCI(window.__par, 20, 65)'), regressionslinjensBand(par, 20, 65));
                    delete w.__par;
                });
                it('_laBootstrapGapCI och _gdBootstrapGapCI per BAS-intervall', () => {
                    for (const bas of [...new Set(d.map(r => r.bas))].sort()) {
                        const kv = d.filter(r => r.bas === bas && arKv(r)).map(r => r.lon), ma = d.filter(r => r.bas === bas && arMa(r)).map(r => r.lon);
                        lika(w._laBootstrapGapCI(kv, ma), medianKvotKI(kv, ma));
                        lika(w._laBootstrapGapCI(kv, ma, 300), medianKvotKI(kv, ma, { B: 300 }));
                        lika(w._gdBootstrapGapCI(kv, ma), medianKvotKIGiltiga(kv, ma));
                    }
                });
                it('_laTrattUnderlagRakna', () => {
                    lika(utanHalv(w.eval(`_laTrattUnderlagRakna(getData(), ${k})`)), utanHalv(trattUnderlag(d, k)));
                });
                if (k === 10) {
                    it('_regKvantilBootstrap', () => {
                        const modell = w.eval('forklaringsmodell()');
                        const raw = kvantilDesign(d, modell).rader;
                        const results = kvantilregressionAllaTau(d, { modell }).results;
                        w.__arg = { raw, modell, results: results.map(r => ({ ...r, ki: null })) };
                        const app = w.eval(`_regKvantilBootstrap(window.__arg.raw, window.__arg.modell, window.__arg.results, d => d.kon.includes('kvinna'))`);
                        delete w.__arg;
                        lika(app, kvantilBootstrap(raw, modell, results.map(r => ({ ...r, ki: null })), arKv));
                    });
                }
            });
        }
    }
});

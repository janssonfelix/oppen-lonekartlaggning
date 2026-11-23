// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
/**
 * Slumpintervallen i verktyget beror inte på radordningen (ADR-86): demodatan inläst i två fönster, i det ena med
 * raderna omkastade, ger identiska intervall (Object.is) och identisk status i Översiktens intervall
 * (state.bootstrapCI), i Lika arbetes översikt per BAS-intervall, i yrkesgrupperna (uppmärksamhetstrappan), i
 * trattdiagrammet per AID-kod och BAS-intervall, i gruppdossierns intervall och i kvantilregressionens intervall.
 * Den rena räkningen prövas i tests/slumpintervall-ordning.test.js.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { createAppWindow } from './helpers/app-harness.js';

/** Seedad Fisher–Yates (linjär kongruensgenerator), så att omkastningen är densamma varje gång. */
function omkastad(lista, seed) {
    let s = seed >>> 0;
    const rnd = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
    const ut = lista.slice();
    for (let i = ut.length - 1; i > 0; i--) { const j = (rnd() * (i + 1)) | 0, t = ut[i]; ut[i] = ut[j]; ut[j] = t; }
    return ut;
}

/** Varje tal i a och b är identiskt (Object.is), också i nästlade objekt och listor. */
function identiska(a, b, vag = '') {
    if (a && typeof a === 'object') {
        expect(b && typeof b, vag).toBe('object');
        expect(Object.keys(b).sort(), vag).toEqual(Object.keys(a).sort());
        for (const k of Object.keys(a)) if (typeof a[k] !== 'function') identiska(a[k], b[k], `${vag}.${k}`);
        return;
    }
    expect(Object.is(a, b), `${vag}: ${a} mot ${b}`).toBe(true);
}

/** Intervallen och statusarna i ett fönster med demodatan, med raderna i filens ordning eller omkastade. */
function intervall(omkasta) {
    const w = createAppWindow();
    w.__lasInDemodata();
    if (omkasta) {
        const fore = w.__state.data;
        w.__state.data = omkastad(fore, 4711);
        expect(w.__state.data.map(r => r.lon)).not.toEqual(fore.map(r => r.lon));
        // Översiktens intervall, Lika arbetes minne och likvärdighetens par följer underlaget.
        w.eval('tomStatistikcacher({ recompute: false })');
    }
    w.raknaBootstrapKI();
    const { elapsed: _tid, ...bootstrapCI } = w.__state.bootstrapCI;
    const d = w.hamtaData();
    const oversikt = Object.fromEntries(w._laOversiktRader(d).map(o => [o.bas, { gap: o.gap, ci: o.ci, status: w.gapStatusKI(o).niva }]));
    const lika = Object.fromEntries(w.laLikaGrupper(d).grupper.map(g => [g.yrke, { niva: g.niva, sakerstalld: g.sakerstalld, flaggad: g.flaggad }]));
    const tratt = Object.fromEntries(w._laTrattUnderlag(d).punkter.map(p => [p.nyckel, { kvot: p.kvot, gransLag: p.gransLag, gransHog: p.gransHog, utanfor: p.utanfor }]));
    const dossier = Object.fromEntries(w.gruppdossierCandidates().map(g => {
        const { kv, ma } = w._gdKon(g.rows);
        return [g.key, w._gdBootstrapGapCI(kv.map(r => r.lon), ma.map(r => r.lon))];
    }));
    const kv = w._regKvantilBerakna({ direkt: true });
    // Kvantilregressionens punktskattningar räknas med IRLS och kan skilja i sista decimalerna med radordningen; här
    // jämförs bara intervallen.
    const kvantil = { ki: kv.results.map(r => r.ki), diffKi: kv.diff.ki };
    return { bootstrapCI, oversikt, lika, tratt, dossier, kvantil };
}

describe('demodatan i två radordningar', () => {
    let a, b;
    beforeAll(() => { a = intervall(false); b = intervall(true); });

    it('Översiktens intervall (state.bootstrapCI) är identiskt', () => {
        identiska(a.bootstrapCI, b.bootstrapCI, 'bootstrapCI');
    });
    it('Lika arbetes översikt: samma intervall och status för varje BAS-intervall', () => {
        expect(Object.keys(a.oversikt).length).toBeGreaterThan(0);
        identiska(a.oversikt, b.oversikt, 'översikt');
    });
    it('yrkesgrupperna: samma nivå i trappan för varje grupp', () => {
        expect(Object.keys(a.lika).length).toBeGreaterThan(0);
        identiska(a.lika, b.lika, 'yrkesgrupper');
    });
    it('trattdiagrammet: samma gränser och markering för varje AID-kod och BAS-intervall', () => {
        expect(Object.keys(a.tratt).length).toBeGreaterThan(0);
        identiska(a.tratt, b.tratt, 'tratt');
    });
    it('gruppdossierns intervall är identiska', () => {
        expect(Object.values(a.dossier).some(Boolean)).toBe(true);
        identiska(a.dossier, b.dossier, 'dossier');
    });
    it('kvantilregressionens intervall är identiska', () => {
        expect(a.kvantil.ki.every(Boolean)).toBe(true);
        identiska(a.kvantil, b.kvantil, 'kvantil');
    });
});

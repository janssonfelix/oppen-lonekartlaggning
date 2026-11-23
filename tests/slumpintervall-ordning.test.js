// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
/**
 * Slumpintervallen är en funktion av lönerna, inte av radordningen (ADR-86). Samma underlag i två olika ordningar ska
 * ge identiska gränser (Object.is) i varje intervall som verktyget drar med en seedad generator: bootstrapintervallen
 * på mediankvoten och medianskillnaden, omkastningens gränser (slumpens gränser och trappans nivå), trattens underlag
 * och kvantilregressionens intervall. Underlagen har lika löner hos kvinnor och män, så att också knytningarna prövas.
 * Påhittade, uppenbart syntetiska löner.
 */
import { describe, it, expect } from 'vitest';
import { mulberry32, slumpFor } from '../src/lib/rng.js';
import { omkastningsGranser, slumpensGranser, bedomSkillnad } from '../src/lib/status.js';
import { bootstrapMedianer, bootstrapMedianskillnadKr, bootstrapMedianMotKonstantKr } from '../src/lib/likvardighet.js';
import { organisationensKvotKI, medianKvotKI, medianKvotKIGiltiga, trattUnderlag, kvantilBootstrap } from '../src/lib/osakerhet.js';
import { kvantilregressionAllaTau, kvantilDesign, FORKLARINGSMODELL_STANDARD } from '../src/lib/regression.js';

// Påhittade löner i steg om 250 kr, så att många löner är lika, också mellan könen. Kvinnornas ligger lite lägre.
const loner = (n, s, forskjutning = 0) => Array.from({ length: n }, (_, i) => 30000 + forskjutning + 250 * ((i * 7919 + s) % 23));

/** En omkastad kopia: seedad Fisher–Yates, så att testet är detsamma varje gång. */
function omkastad(lista, seed) {
    const ut = lista.slice(), rnd = mulberry32(seed);
    for (let i = ut.length - 1; i > 0; i--) { const j = (rnd() * (i + 1)) | 0, t = ut[i]; ut[i] = ut[j]; ut[j] = t; }
    return ut;
}

/** Varje tal i a och b är identiskt (Object.is), också i nästlade objekt och listor. */
function identiska(a, b, vag = '') {
    if (a && typeof a === 'object') {
        expect(typeof b, vag).toBe('object');
        expect(Object.keys(b).sort(), vag).toEqual(Object.keys(a).sort());
        for (const k of Object.keys(a)) if (typeof a[k] !== 'function') identiska(a[k], b[k], `${vag}.${k}`);
        return;
    }
    expect(Object.is(a, b), `${vag}: ${a} mot ${b}`).toBe(true);
}

const STORLEKAR = [[12, 12], [30, 20], [300, 200]];

describe.each(STORLEKAR)('[B4.3] %i kvinnor och %i män i två ordningar', (nKv, nMa) => {
    const kv = loner(nKv, 3, -500), ma = loner(nMa, 11);
    const kv2 = omkastad(kv, 101), ma2 = omkastad(ma, 202);

    it('underlaget har lika löner hos kvinnor och män, och ordningen skiljer sig', () => {
        expect(kv.some(v => ma.includes(v))).toBe(true);
        expect(kv2).not.toEqual(kv);
        expect([...kv2].sort()).toEqual([...kv].sort());
    });
    it('bootstrapens medianer per dragning', () => {
        identiska(bootstrapMedianer(kv, ma, 200, slumpFor(kv, ma)), bootstrapMedianer(kv2, ma2, 200, slumpFor(kv2, ma2)));
    });
    it('[B1.7] mediankvotens intervall (organisationen, per grupp, giltiga dragningar)', () => {
        const rader = l => [...l.kv.map(lon => ({ kon: 'kvinna', lon })), ...l.ma.map(lon => ({ kon: 'man', lon }))];
        // Raderna blandas också mellan könen: en kvinna och en man byter plats i filen.
        identiska(organisationensKvotKI(rader({ kv, ma }), 3), organisationensKvotKI(omkastad(rader({ kv: kv2, ma: ma2 }), 7), 3));
        identiska(medianKvotKI(kv, ma), medianKvotKI(kv2, ma2));
        identiska(medianKvotKIGiltiga(kv, ma), medianKvotKIGiltiga(kv2, ma2));
    });
    it('medianskillnadens intervall i kronor, mot en annan grupp och mot en konstant', () => {
        identiska(bootstrapMedianskillnadKr(kv, ma, 1000, slumpFor(kv, ma)), bootstrapMedianskillnadKr(kv2, ma2, 1000, slumpFor(kv2, ma2)));
        identiska(bootstrapMedianMotKonstantKr(kv, 32000, 1000, slumpFor(kv, [32000])),
            bootstrapMedianMotKonstantKr(kv2, 32000, 1000, slumpFor(kv2, [32000])));
    });
    it('[B4.9] omkastningens gränser, slumpens gränser och trappans nivå', () => {
        identiska(omkastningsGranser(kv, ma), omkastningsGranser(kv2, ma2));
        identiska(slumpensGranser(kv, ma), slumpensGranser(kv2, ma2));
        identiska(bedomSkillnad(kv, ma), bedomSkillnad(kv2, ma2));
    });
});

describe('omkastningen när kvinnor och män har exakt samma löner', () => {
    // Varje lön finns hos både en kvinna och en man: knytningarna mellan könen får inte göra gränserna
    // ordningsberoende. Både ordningen inom könen och vilken av de lika lönerna som står först prövas.
    const kv = loner(25, 5), ma = loner(25, 5);
    it('ger samma gränser i alla ordningar', () => {
        const ref = omkastningsGranser(kv, ma);
        for (const s of [1, 2, 3, 4, 5]) identiska(omkastningsGranser(omkastad(kv, s), omkastad(ma, s + 50)), ref);
        identiska(omkastningsGranser([...kv].sort((a, b) => b - a), [...ma].sort((a, b) => a - b)), ref);
    });
});

describe('trattens underlag i två ordningar', () => {
    const rader = [];
    for (const [aid, bas, nKv, nMa] of [['111111', 'B', 12, 14], ['222222', 'C', 30, 20], ['333333', 'D', 15, 15]]) {
        for (const lon of loner(nKv, aid.length + nKv, -400)) rader.push({ kon: 'kvinna', lon, bas, aid, yrke: aid });
        for (const lon of loner(nMa, aid.length + nMa)) rader.push({ kon: 'man', lon, bas, aid, yrke: aid });
    }
    it('ger samma gränser och samma markering för varje grupp', () => {
        const a = trattUnderlag(rader, 10), b = trattUnderlag(omkastad(rader, 9), 10);
        const perNyckel = u => Object.fromEntries(u.punkter.map(p => [p.nyckel, p]));
        identiska(perNyckel(a), perNyckel(b));
        identiska(a.sigma, b.sigma);
    });
});

describe('kvantilregressionens intervall i två ordningar', () => {
    // 120 påhittade personer i tre BAS-intervall, med dubbletter: samma lön, kön och ålder i samma BAS-intervall.
    const rader = Array.from({ length: 120 }, (_, i) => {
        const kv = i % 2 === 0, bas = ['A', 'B', 'C'][i % 3], alder = 25 + (i * 7) % 40;
        const lon = Math.round((28000 + 2000 * (i % 3) + 120 * alder + ((i * 7919) % 50) * 60) * (kv ? 0.95 : 1));
        return { kon: kv ? 'kvinna' : 'man', lon, bas, alder, aid: String(100000 + (i % 4)), yrke: 'Påhittat yrke ' + (i % 4) };
    });
    const modell = FORKLARINGSMODELL_STANDARD;
    const arKv = d => d.kon.includes('kvinna');
    const kor = rr => {
        const qr = kvantilregressionAllaTau(rr, { modell });
        return kvantilBootstrap(kvantilDesign(rr, modell).rader, modell, qr.results.map(r => ({ ...r, ki: null })), arKv, { B: 40 });
    };
    it('ger samma intervall per τ och för P90 − P10', () => {
        const a = kor(rader), b = kor(omkastad(rader, 31));
        expect(a.results.every(r => r.ki)).toBe(true);
        identiska(a.results.map(r => r.ki), b.results.map(r => r.ki));
        identiska(a.diffKi, b.diffKi);
    });
});

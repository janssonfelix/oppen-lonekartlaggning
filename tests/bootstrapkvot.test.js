/**
 * Bootstrapintervallen på mediankvoten (kvinnors median i % av mäns) tar dragningarnas medianer ur rangräkning
 * (`bootstrapMedianer` i src/lib/likvardighet.js). Referensen här är de tidigare algoritmerna, där varje dragning
 * sorterades eller gick genom quickselect, med dragningarna ur de stigande sorterade lönerna (ADR-86) och symmetriska
 * percentilindex: med samma slumpföljd ska intervallen vara exakt desamma.
 *
 * Täcker kärnan i lib och de tre anroparna i appen: översikten per BAS-intervall och lönegapet per åldersgrupp
 * (`_laBootstrapGapCI`), gruppdossiern och rapportunderlaget (`_gdBootstrapGapCI`) och Översiktens intervall
 * för hela organisationen (`computeBootstrapCI`).
 */
import { describe, it, expect } from 'vitest';
import { bootstrapMedianer } from '../src/lib/likvardighet.js';
import { rngFor } from '../src/lib/rng.js';
import { createAppWindow } from './helpers/app-harness.js';

function refMedian(arr) {
    const s = arr.slice().sort((a, b) => a - b), m = s.length >> 1;
    return s.length & 1 ? s[m] : (s[m - 1] + s[m]) / 2;
}
/** Medianerna per dragning: först kvN löner ur kv, sedan maN ur ma (båda stigande sorterade), varje dragning sorterad. */
function refDragningar(kv0, ma0, B, rnd) {
    const kv = [...kv0].sort((a, b) => a - b), ma = [...ma0].sort((a, b) => a - b);
    const ut = [];
    for (let b = 0; b < B; b++) {
        const sKv = kv.map(() => kv[(rnd() * kv.length) | 0]);
        const sMa = ma.map(() => ma[(rnd() * ma.length) | 0]);
        ut.push([refMedian(sKv), refMedian(sMa)]);
    }
    return ut;
}
// Den tidigare _laBootstrapGapCI (B = 1000, 100 när männens median inte är positiv).
function refLa(kv, ma, B = 1000) {
    if (kv.length < 3 || ma.length < 3) return null;
    const ratios = refDragningar(kv, ma, B, rngFor(kv, ma)).map(([mKv, mMa]) => (mMa > 0 ? (mKv / mMa) * 100 : 100));
    ratios.sort((a, b) => a - b);
    const svans = Math.floor(B * 0.025);
    return { lo: ratios[svans], hi: ratios[B - 1 - svans] };
}
// Den tidigare _gdBootstrapGapCI (B = 2000, dragningar med männens median 0 räknas inte).
function refGd(kv, ma, B = 2000) {
    if (kv.length < 3 || ma.length < 3) return null;
    const ratios = refDragningar(kv, ma, B, rngFor(kv, ma)).map(([mKv, mMa]) => (mMa > 0 ? (mKv / mMa) * 100 : NaN));
    const ok = ratios.filter(v => isFinite(v)).sort((a, b) => a - b);
    if (ok.length < 20) return null;
    const svans = Math.floor(ok.length * 0.025);
    return { lo: ok[svans], hi: ok[ok.length - 1 - svans] };
}

// Syntetiska löner: deterministiska, osorterade, med en del lika värden.
const loner = (n, s) => Array.from({ length: n }, (_, i) => 25000 + Math.round(((i * 7919 + s) % 1000) * 15 + (i % 13) * 3));
const fall = [
    ['3 mot 3', loner(3, 1), loner(3, 2)],
    ['udda mot jämnt n', loner(11, 1), loner(4, 2)],
    ['jämnt mot udda n', loner(10, 3), loner(7, 4)],
    ['många lika löner', [30000, 30000, 30000, 31000, 31000, 29000, 30000, 30000], [33000, 33000, 34000, 33000, 33000, 33000]],
    ['alla lika', Array(9).fill(30000), Array(6).fill(35000)],
    ['decimaler', [30000.5, 29999.25, 30001.75, 30000.5, 30002], [33000.1, 32999.9, 33000.3, 33000.1]],
    ['stora grupper', loner(860, 5), loner(401, 6)]
];

describe('bootstrapMedianer: samma medianer som en sortering per dragning', () => {
    for (const [namn, kv, ma] of fall) {
        it(namn, () => {
            const m = bootstrapMedianer(kv, ma, 300, rngFor(kv, ma));
            const ref = refDragningar(kv, ma, 300, rngFor(kv, ma));
            ref.forEach(([mKv, mMa], b) => {
                expect(m.kv[b], `kv, dragning ${b}`).toBe(mKv);
                expect(m.ma[b], `ma, dragning ${b}`).toBe(mMa);
            });
        });
    }
});

describe('appens intervall på mediankvoten är desamma som med sortering per dragning', () => {
    const w = createAppWindow();
    for (const [namn, kv, ma] of fall) {
        it(`_laBootstrapGapCI och _gdBootstrapGapCI: ${namn}`, () => {
            expect(w._laBootstrapGapCI(kv, ma)).toEqual(refLa(kv, ma));
            expect(w._gdBootstrapGapCI(kv, ma)).toEqual(refGd(kv, ma));
        });
    }
    it('för få personer ger inget intervall', () => {
        expect(w._laBootstrapGapCI([1, 2], [1, 2, 3])).toBeNull();
        expect(w._gdBootstrapGapCI([1, 2, 3], [1, 2])).toBeNull();
    });
    it('computeBootstrapCI på demodatan', () => {
        w.__loadDemoData();
        w.eval('computeBootstrapCI()');
        const d = w.__state.data.filter(r => r.lon > 0);
        const kv = d.filter(r => r.kon.includes('kvinna')).map(r => r.lon);
        const ma = d.filter(r => r.kon === 'man' || r.kon === 'män').map(r => r.lon);
        const B = 2000;
        const ratios = refDragningar(kv, ma, B, rngFor(kv, ma)).map(([mKv, mMa]) => (mMa > 0 ? mKv / mMa : 1)).sort((a, b) => a - b);
        const ci = w.__state.bootstrapCI;
        expect(ci.B).toBe(B);
        expect(ci.ratio.lo).toBe(ratios[Math.floor(B * 0.025)]);
        expect(ci.ratio.hi).toBe(ratios[B - 1 - Math.floor(B * 0.025)]);
    });
});

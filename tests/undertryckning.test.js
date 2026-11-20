// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
/**
 * Kompletterande undertryckning (ADR-83) och sammanslagning (ADR-87) i src/lib/undertryckning.js. Hur reglerna
 * tillämpas prövas i tests/perbas.test.js, tests/gapuppdelning.test.js och tests/sektor.test.js, och mot
 * härledningarna i tests/ktroskel-differens.test.js.
 */
import { describe, it, expect } from 'vitest';
import { kompletterandeUndertryckning, sammanslagning, kompletterandeUndertryckningPerNyckel } from '../src/lib/undertryckning.js';
import { mulberry32 } from '../src/lib/rng.js';

describe('kompletterandeUndertryckning', () => {
    const del = (namn, n, dold = false) => ({ namn, n, dold });
    it('inga dolda delar: ingenting undertrycks', () => {
        expect(kompletterandeUndertryckning([del('A', 12), del('B', 30)], 10)).toEqual([]);
        expect(kompletterandeUndertryckning([], 10)).toEqual([]);
        expect(kompletterandeUndertryckning([del('A', 12), del('B', 0, true)], 10)).toEqual([]);
    });
    it('de dolda omfattar minst k personer: ingenting undertrycks', () => {
        expect(kompletterandeUndertryckning([del('A', 12), del('B', 6, true), del('C', 4, true)], 10)).toEqual([]);
        expect(kompletterandeUndertryckning([del('A', 12), del('B', 10, true)], 10)).toEqual([]);
    });
    it('en dold med en person: den minsta visade delen undertrycks', () => {
        expect(kompletterandeUndertryckning([del('A', 30), del('B', 12), del('C', 1, true), del('D', 20)], 10)).toEqual([1]);
    });
    it('vid lika antal väljs delen först efter namn, sedan efter ordningen i listan', () => {
        expect(kompletterandeUndertryckning([del('C', 12), del('A', 12), del('X', 1, true)], 10)).toEqual([1]);
        expect(kompletterandeUndertryckning([del('', 12), del('', 12), del('', 1, true)], 10)).toEqual([0]);
    });
    it('flera steg: delar undertrycks tills de dolda tillsammans når k', () => {
        // k = 25: 1 dold + 10 + 11 = 22 räcker inte, + 12 = 34.
        expect(kompletterandeUndertryckning([del('A', 12), del('B', 10), del('C', 11), del('D', 40), del('E', 1, true)], 25)).toEqual([1, 2, 0]);
    });
    it('räcker inte alla delar undertrycks alla, och bara totalen har ett medelvärde', () => {
        expect(kompletterandeUndertryckning([del('A', 3), del('B', 2), del('C', 1, true)], 10)).toEqual([1, 0]);
    });
    it('en visad del utan personer väljs aldrig', () => {
        expect(kompletterandeUndertryckning([del('A', 0), del('B', 15), del('C', 2, true)], 10)).toEqual([1]);
    });
});

describe('sammanslagning', () => {
    const del = (namn, nKv, nMa) => ({ namn, nKv, nMa });
    it('varje del har 0 eller minst k av varje kön: ingenting slås samman', () => {
        expect(sammanslagning([del('A', 12, 0), del('B', 0, 30), del('C', 10, 10)], 10)).toEqual([]);
        expect(sammanslagning([], 10)).toEqual([]);
    });
    it('två delar med få av samma kön som tillsammans når k slås samman med varandra', () => {
        expect(sammanslagning([del('A', 30, 30), del('B', 6, 0), del('C', 5, 0)], 10)).toEqual([1, 2]);
    });
    it('en ensam liten del slås samman med den visade del som har färst av det könet', () => {
        // B har en man; bland de visade har D färst män (12), A har 30 och C inga.
        expect(sammanslagning([del('A', 30, 30), del('B', 20, 1), del('C', 15, 0), del('D', 40, 12)], 10)).toEqual([1, 3]);
    });
    it('när kvinnorna och männen behöver olika delar slås alla de delarna samman', () => {
        // B: tre kvinnor, C: två män. Kvinnorna når k med D (10 kvinnor), männen med E (11 män).
        expect(sammanslagning([del('A', 40, 40), del('B', 3, 0), del('C', 0, 2), del('D', 10, 0), del('E', 0, 11)], 10)).toEqual([1, 2, 3, 4]);
    });
    it('en del som läggs till för det ena könet räcker också för det andra när den har minst k av det', () => {
        // B: tre kvinnor och två män; C har 12 kvinnor och 14 män och är minst för båda könen.
        expect(sammanslagning([del('A', 40, 40), del('B', 3, 2), del('C', 12, 14)], 10)).toEqual([1, 2]);
    });
    it('räcker inte de visade slås alla samman', () => {
        expect(sammanslagning([del('A', 9, 12), del('B', 2, 0)], 10)).toEqual([0, 1]);
    });
    it('på slumpade uppdelningar har varje del efteråt 0 eller minst k av varje kön, och den sammanslagna minst två delar', () => {
        const rnd = mulberry32(17);
        for (let t = 0; t < 500; t++) {
            const k = 2 + Math.floor(rnd() * 24);
            const delar = Array.from({ length: 1 + Math.floor(rnd() * 8) }, (_, i) => {
                const n = () => (rnd() < 0.3 ? 0 : rnd() < 0.5 ? Math.floor(rnd() * k) : k + Math.floor(rnd() * 40));
                return del(String.fromCharCode(65 + i), n(), n());
            });
            const nKv = delar.reduce((s, d) => s + d.nKv, 0), nMa = delar.reduce((s, d) => s + d.nMa, 0);
            if ((nKv > 0 && nKv < k) || (nMa > 0 && nMa < k)) continue;   // helheten ska själv klara k
            const s = new Set(sammanslagning(delar, k));
            const ok = n => n === 0 || n >= k;
            for (const [i, d] of delar.entries()) if (!s.has(i)) expect(ok(d.nKv) && ok(d.nMa), JSON.stringify(delar)).toBe(true);
            const sKv = [...s].reduce((a, i) => a + delar[i].nKv, 0), sMa = [...s].reduce((a, i) => a + delar[i].nMa, 0);
            expect(ok(sKv) && ok(sMa), JSON.stringify(delar)).toBe(true);
            expect(s.size === 0 || s.size >= 2, JSON.stringify(delar)).toBe(true);
        }
    });
});

describe('kompletterandeUndertryckningPerNyckel (ADR-91: JPA-protokollets blad 2 mot blad 3)', () => {
    const total = (nyckel, nKv, nMa) => ({ nyckel, nKv, nMa });
    const del = (nyckel, nKv, nMa, namn, dold = false) => ({ nyckel, nKv, nMa, namn, dold });
    for (const k of [10, 25]) {
        it(`k = ${k}: en rest på 1 till k − 1 av ett kön döljer den minsta visade gruppen, och resten blir minst k`, () => {
            // Intervallet J har 30 + 3 kvinnor och 60 män; blad 2 visar gruppen med 30 kvinnor och 30 män.
            expect(kompletterandeUndertryckningPerNyckel([total('J', 33, 60)], [del('J', 30, 30, 'a')], k)).toEqual([0]);
            // Två visade grupper: den minsta (färst kvinnor) döljs, och det räcker.
            expect(kompletterandeUndertryckningPerNyckel([total('J', 3 + 30 + 40, 120)], [del('J', 40, 60, 'stor'), del('J', 30, 60, 'liten')], k)).toEqual([1]);
        });
        it(`k = ${k}: en rest på 0 eller minst k ändrar ingenting; delar med en annan nyckel räknas inte`, () => {
            expect(kompletterandeUndertryckningPerNyckel([total('J', 30, 30)], [del('J', 30, 30, 'a')], k)).toEqual([]);
            expect(kompletterandeUndertryckningPerNyckel([total('J', 30 + k, 30)], [del('J', 30, 30, 'a')], k)).toEqual([]);
            expect(kompletterandeUndertryckningPerNyckel([total('J', 33, 60)], [del('K', 30, 30, 'a')], k)).toEqual([]);
            expect(kompletterandeUndertryckningPerNyckel([], [del('J', 30, 30, 'a')], k)).toEqual([]);
        });
        it(`k = ${k}: en dold grupp räknas till resten för båda könen, så att döljandet för det ena könet kan kräva mer för det andra`, () => {
            // Kvinnorna: resten 2 döljer b (30 kvinnor). Männen: b:s 2 män blir då rest, och a (k + 5 män) döljs också.
            const ut = kompletterandeUndertryckningPerNyckel([total('J', 2 + 30 + 40, k + 5 + 2)], [del('J', 40, k + 5, 'a'), del('J', 30, 2, 'b')], k);
            expect(ut).toEqual([0, 1]);
            // En grupp vars medelvärden redan inte står räknas till resten men väljs inte igen.
            expect(kompletterandeUndertryckningPerNyckel([total('J', 32, 60)], [del('J', 30, 30, 'a'), del('J', 2, 30, 'redan', true)], k)).toEqual([0]);
        });
    }
});

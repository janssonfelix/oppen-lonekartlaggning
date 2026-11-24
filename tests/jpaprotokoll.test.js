// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
/**
 * JPA-protokollets urval och lönenivåer (src/lib/jpaprotokoll.js): vilka grupper och intervall som står i blad 2 och 3,
 * hur många som utelämnats, och att lönenivåerna per kön bara står när båda könen når tröskeln (S4). Att protokollet i
 * verktyget bär urvalet prövas i tests/ktroskel-utdata.test.js och invarianten (I4).
 */
import { describe, it, expect } from 'vitest';
import { jpaNivaCeller, jpaUrval, JPA_DOLD } from '../src/lib/jpaprotokoll.js';

const grupp = (yrke, bas, niva, nKv, nMa, medKv, medMa, extra = {}) =>
    ({ yrke, bas, niva, nKv, nMa, tot: nKv + nMa, medKv, medMa, medelKv: medKv + 100, medelMa: medMa + 100, direktiv: false, ...extra });
const lika = (grupper, { utelamnade = [], ejJamforbara = [] } = {}) => ({ grupper, utelamnade, ejJamforbara });
const intervall = (bas, status, pValue, gapPct, kvN = 40, maN = 40) =>
    ({ bas, status, pValue, gapPct, kvN, maN, medKv: 30000, medMa: 32000, medelKv: 30100, medelMa: 32100 });

describe('[B6.8] [S4] jpaNivaCeller: lönenivåerna per kön bara när båda könen når tröskeln', () => {
    for (const k of [10, 25]) {
        it(`k = ${k}: under tröskeln för ett kön står fyra tankstreck, vid tröskeln talen`, () => {
            expect(jpaNivaCeller(30000, 32000, k - 1, 40, k)).toEqual(JPA_DOLD);
            expect(jpaNivaCeller(30000, 32000, 40, k - 1, k)).toEqual(JPA_DOLD);
            expect(jpaNivaCeller(30000, 32000, k, k, k)).toEqual([30000, 32000, -2000, 93.8]);
        });
    }
    it('ett tal som saknas eller mäns nivå noll ger tankstreck; procenten avrundas en gång', () => {
        expect(jpaNivaCeller(NaN, 32000, 40, 40, 10)).toEqual(JPA_DOLD);
        expect(jpaNivaCeller(30000, 0, 40, 40, 10)).toEqual(JPA_DOLD);
        expect(jpaNivaCeller(34059, 40000, 40, 40, 10)[3]).toBe(85.1);
    });
});

describe('[B6.8] jpaUrval: blad 2 är Lika arbetes grupper med statusen Värt att granska', () => {
    it('bara granska, mest negativa skillnaden först, och de utelämnade räknas per skäl', () => {
        const u = jpaUrval(lika([
            grupp('a', 'C', 'granska', 20, 20, 30000, 32000),
            grupp('b', 'D', 'granska', 20, 20, 30000, 36000),
            grupp('c', 'C', 'folj', 20, 20, 30000, 30500),
            grupp('d', 'C', 'balanserat', 20, 20, 30000, 30000),
            grupp('e', 'D', 'ejbedomd', 20, 20, 30000, 33000),
            grupp('f', 'D', 'granska', 3, 20, 30000, 33000, { samladMedian: true })
        ], { utelamnade: [{}], ejJamforbara: [{}, {}] }), [], { k: 10 });
        expect(u.yrken.map(j => j.yrke)).toEqual(['b', 'a']);
        expect(u.yrken[0]).toMatchObject({ medKv: 30000, medMa: 36000, diffKr: -6000, medel: [30100, 36100, -6000, 83.4] });
        expect(u.exkluderade).toMatchObject({ yrkenMaskerade: 1 + 1 + 2, yrkenEjBedomda: 1, yrkenOjamn: 2 });
    });
});

describe('[B6.8] jpaUrval: blad 3 är intervallen som är säkerställda efter Benjamini–Hochberg och minst 3 %', () => {
    it('q < 0,05 och minst 3 % kommer med; för få, singulära och resten räknas', () => {
        const u = jpaUrval(lika([]), [
            intervall('A', 'ok', 0.001, -4),     // q 0,003: med
            intervall('B', 'ok', 0.04, -6),      // q min(0,06; 0,045) = 0,045: med
            intervall('C', 'ok', 0.045, -2),     // q 0,045 men under 3 %: dokumentera, inte med
            intervall('D', 'too_few', NaN, -9),
            intervall('E', 'singular', NaN, -9),
            intervall('F', 'ok', NaN, -9)        // inget ändligt p-värde: inget q, inte med
        ], { k: 10 });
        expect(u.bas.map(b => b.bas)).toEqual(['B', 'A']);
        expect(u.bas.find(b => b.bas === 'B').q).toBeCloseTo(0.045, 10);
        expect(u.exkluderade).toMatchObject({ basMaskerade: 1, basSingular: 1, basUnderTroskel: 2 });
    });
    it('korrigeringen kan ta bort ett intervall som är säkerställt utan den', () => {
        const u = jpaUrval(lika([]), [intervall('A', 'ok', 0.04, -8), intervall('B', 'ok', 0.5, -8)], { k: 10 });
        expect(u.bas).toEqual([]);   // q för A är min(0,08; 0,5) = 0,08
        expect(u.exkluderade.basUnderTroskel).toBe(2);
    });
});

describe('[B6.8] [S4] jpaUrval: kompletterande undertryckning mellan blad 2 och 3 (ADR-91)', () => {
    const perBas = (kvN, maN) => [intervall('J', 'ok', 0.001, -10, kvN, maN)];
    for (const k of [10, 25]) {
        it(`k = ${k}: en rest på 1 till k − 1 kvinnor i intervallet döljer gruppens medelvärden, inte medianerna`, () => {
            const u = jpaUrval(lika([grupp('a', 'J', 'granska', 30, 30, 30000, 33000)]), perBas(33, 60), { k });
            expect(u.undertryckta.map(j => j.yrke)).toEqual(['a']);
            expect(u.yrken[0].medel).toEqual(JPA_DOLD);
            expect(u.yrken[0]).toMatchObject({ medKv: 30000, medMa: 33000 });
            expect(u.bas.map(b => b.bas)).toEqual(['J']);
        });
        it(`k = ${k}: en rest på 0 eller minst k ändrar ingenting`, () => {
            for (const kvN of [30, 30 + k]) {
                const u = jpaUrval(lika([grupp('a', 'J', 'granska', 30, 30, 30000, 33000)]), perBas(kvN, 30), { k });
                expect(u.undertryckta, String(kvN)).toEqual([]);
                expect(u.yrken[0].medel[0], String(kvN)).toBe(30100);
            }
        });
    }
    it('ett intervall där ett kön är under tröskeln är ingen total att dra ifrån', () => {
        const u = jpaUrval(lika([grupp('a', 'J', 'granska', 30, 30, 30000, 33000)]), perBas(33, 9), { k: 10 });
        expect(u.undertryckta).toEqual([]);
    });
});

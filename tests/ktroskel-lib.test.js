// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
/**
 * Reglerna för vad som får redovisas vid k i src/lib/ktroskel.js, med tröskeln som argument: gränsfallen precis vid k
 * (k − 1, k och k + 1), ett kön under k och det andra över, och k som en inställning (5 och 10). Att appen skickar
 * rätt tröskel (kTroskel() eller kInstalld()) prövas genom adaptrarna i tests/ktroskel-utdata.test.js och k-riggen.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
    statGolv, kTolka, konFarRedovisas, konAntal, konFarRedovisasFor, konUtelamnatNot, raGapText, regStegForRedovisning,
    basEffekterForRedovisning, parNarK, parForRedovisning, kStampel, kStampelFor, kSanktNot, kSidfot, csvMedStampel,
    tsvMedStampel, kText, individLitenFor
} from '../src/lib/ktroskel.js';

const STAMPEL_10 = 'Minsta gruppstorlek för redovisning: 10.';
const STAMPEL_9 = 'Minsta gruppstorlek för redovisning: 9. Tröskeln är sänkt från standardvärdet 10.';

describe.each([5, 10])('k = %i', k => {
    it('konFarRedovisas: varje kön ska nå k', () => {
        expect(konFarRedovisas(k, k, k)).toBe(true);
        expect(konFarRedovisas(k + 1, k + 1, k)).toBe(true);
        expect(konFarRedovisas(k - 1, k + 1, k)).toBe(false);
        expect(konFarRedovisas(k + 1, k - 1, k)).toBe(false);
        expect(konFarRedovisas(100, k - 1, k)).toBe(false);
    });
    it('konFarRedovisasFor räknar könen i radmängden; rader utan kön räknas inte', () => {
        const rader = (nKv, nMa) => [...Array(nKv).fill({ kon: 'kvinna' }), ...Array(nMa).fill({ kon: 'man' }), { kon: '' }];
        expect(konAntal(rader(k - 1, k + 1))).toEqual({ nKv: k - 1, nMa: k + 1 });
        expect(konFarRedovisasFor(rader(k, k), k)).toBe(true);
        expect(konFarRedovisasFor(rader(k - 1, k + 1), k)).toBe(false);
        expect(konFarRedovisasFor(undefined, k)).toBe(false);
    });
    it('raGapText och regStegForRedovisning: det råa gapet och steget Endast kön följer k', () => {
        const reg = (nKv, nMa) => ({ rawGapPct: 4.2, nKvAnalysed: nKv, nMaAnalysed: nMa, explainedShare: 0.5,
            sequential: [{ name: 'Endast kön' }, { name: 'BAS' }] });
        const fmt = v => `${v} %`;
        expect(raGapText(reg(k, k), fmt, k)).toBe('4.2 %');
        expect(raGapText(reg(k - 1, k + 1), fmt, k)).toBe(`– (ett kön har färre än ${k} personer)`);
        expect(regStegForRedovisning(reg(k, k + 1), k)).toEqual({ steg: reg(0, 0).sequential, explainedShare: 0.5, utelamnat: false, not: '' });
        const ut = regStegForRedovisning(reg(k + 1, k - 1), k);
        expect(ut.steg.map(s => s.name)).toEqual(['BAS']);
        expect(ut.explainedShare).toBeNull();
        expect(ut.not).toBe(`Det ojusterade steget (endast kön) och den förklarade andelen visas inte eftersom ett kön har färre än ${k} personer i modellen.`);
    });
    it('basEffekterForRedovisning: intervall under k utelämnas och namnges; en referens under k döljer alla', () => {
        const effekter = [{ bas: '2' }, { bas: '3' }, { bas: '4' }];
        const not = u => `NOT ${u.join(',')}`;
        const reg = { basEffekter: effekter, basRef: '1', basN: { 1: k, 2: k - 1, 3: k, 4: k + 1 } };
        expect(basEffekterForRedovisning(reg, k, not)).toEqual({ effekter: [effekter[1], effekter[2]], utelamnade: ['2'], referensUtelamnad: false, not: 'NOT 2' });
        const refLiten = basEffekterForRedovisning({ ...reg, basN: { ...reg.basN, 1: k - 1 } }, k, not);
        expect(refLiten.effekter).toEqual([]);
        expect(refLiten.utelamnade).toEqual(['2', '3', '4']);
        expect(refLiten.referensUtelamnad).toBe(true);
        expect(refLiten.not).toContain(`BAS 1, har färre än ${k} personer`);
        expect(basEffekterForRedovisning({ ...reg, basN: { 1: k, 2: k, 3: k, 4: k } }, k, not).not).toBe('');
        expect(basEffekterForRedovisning({}, k, not)).toEqual({ effekter: null, utelamnade: [], referensUtelamnad: false, not: '' });
    });
    it('parForRedovisning: båda grupperna ska nå k; ett jämförelseyrke utan maN prövas inte', () => {
        const par = [{ kvN: k, maN: k }, { kvN: k - 1, maN: k + 1 }, { kvN: k + 1, maN: k - 1 }, { kvN: k, maN: null }, { kvN: k - 1 }];
        expect(par.map(p => parNarK(p, k))).toEqual([true, false, false, true, false]);
        const r = parForRedovisning(par, k);
        expect(r.par).toEqual([par[0], par[3]]);
        expect(r.par[0]).toBe(par[0]);
        expect(r.utelamnade).toBe(3);
        expect(r.not).toBe(`3 par med en grupp under ${k} personer redovisas inte här.`);
        expect(parForRedovisning(undefined, k)).toEqual({ par: [], utelamnade: 0, not: '' });
    });
    it('individLitenFor: liten när gruppen eller personens kön i gruppen är under k', () => {
        const rad = (yrke, kon, lon = 30000) => ({ yrke, bas: 'A', kon, lon });
        const grupp = (yrke, nKv, nMa) => [...Array.from({ length: nKv }, () => rad(yrke, 'kvinna')), ...Array.from({ length: nMa }, () => rad(yrke, 'man'))];
        const rader = [...grupp('101 X', k, k), ...grupp('102 Y', k - 1, 0), ...grupp('103 Z', k + 1, k - 1), rad('104 Q', 'kvinna', 0)];
        const liten = individLitenFor(rader, k);
        const sma = rader.filter(liten);
        expect(sma.filter(r => r.yrke === '101 X')).toHaveLength(0);
        expect(sma.filter(r => r.yrke === '102 Y')).toHaveLength(k - 1);
        expect(sma.filter(r => r.yrke === '103 Z').map(r => r.kon)).toEqual(Array(k - 1).fill('man'));
        expect(liten(rader.at(-1))).toBe(true);   // en rad utan lön räknas inte och är därmed i en grupp med 0
        // Gruppen är AID-koden inom BAS-intervallet: två stavningar av samma kod är en grupp.
        const tva = [...grupp('201 A', k, k).slice(0, k), ...Array.from({ length: k }, () => rad('201 B', 'man'))];
        expect(tva.filter(individLitenFor(tva, k))).toHaveLength(0);
    });
});

describe('texterna om tröskeln', () => {
    it('k = 1 (skärmen): noterna säger att ett kön saknas', () => {
        expect(konUtelamnatNot(1)).toBe('Könsuppdelade lönemått redovisas inte eftersom ett av könen saknas i urvalet.');
        expect(raGapText({ rawGapPct: 3, nKvAnalysed: 0, nMaAnalysed: 4 }, String, 1)).toBe('– (ett av könen saknas)');
        expect(konUtelamnatNot(5)).toBe('Könsuppdelade lönemått redovisas inte eftersom ett kön har färre än 5 personer i urvalet.');
        expect(raGapText(null, String, 5)).toBe('–');
    });
    it('stämpeln och sidfoten nämner sänkningen bara under standard (9, 10, 11)', () => {
        expect(kStampel(10)).toBe(STAMPEL_10);
        expect(kStampel(11)).toBe('Minsta gruppstorlek för redovisning: 11.');
        expect(kStampel(9)).toBe(STAMPEL_9);
        expect(kSanktNot(10)).toBe('');
        expect(kSanktNot(9)).toBe(STAMPEL_9);
        expect(kSidfot('x', 10)).toBe('x');
        expect(kSidfot('x', 9)).toBe('x · minsta gruppstorlek 9 (standard 10)');
        expect(kStampelFor('Likvärdigt arbete', 10)).toBe(`${STAMPEL_10} Den här filen kan även innehålla grupper under tröskeln (undantag: Likvärdigt arbete).`);
        expect(kStampelFor('', 10)).toBe(STAMPEL_10);
    });
    it('CSV får alltid stämpeln, urklipp bara vid sänkt tröskel eller undantag, och aldrig två gånger', () => {
        const rader = [['a'], [1]];
        expect(csvMedStampel(rader, '', 10)).toEqual([['a'], [1], [], [STAMPEL_10]]);
        expect(tsvMedStampel(rader, '', 10)).toBe(rader);
        expect(tsvMedStampel(rader, '', 9)).toEqual([['a'], [1], [], [STAMPEL_9]]);
        expect(tsvMedStampel(rader, 'X', 10)).toEqual([['a'], [1], [], [kStampelFor('X', 10)]]);
        const medStampel = [[STAMPEL_9], ['a']];
        expect(csvMedStampel(medStampel, '', 9)).toBe(medStampel);
        expect(tsvMedStampel(medStampel, '', 9)).toBe(medStampel);
    });
    it('kText och statGolv: golvet går aldrig under standard', () => {
        expect(statGolv(5)).toBe(10);
        expect(statGolv(12)).toBe(12);
        expect(kText('färre än {k}, minst {golv}', 5)).toBe('färre än 5, minst 10');
        expect(kText('{k} {golv}', 12)).toBe('12 12');
        expect(kText(null, 5)).toBe('');
    });
    it('kTolka: bara rena heltal 2–1000', () => {
        expect([1, 2, '10', ' 1000 ', 1001, '2.5', '-3', 'x', null, 7.5].map(kTolka)).toEqual([null, 2, 10, 1000, null, null, null, null, null, null]);
    });
    it('gränserna är desamma som appens K_STANDARD, K_MIN och K_MAX', () => {
        const app = readFileSync(join(import.meta.dirname, '..', 'src', 'app', '06-k-troskel.js'), 'utf8');
        const varde = namn => Number(app.match(new RegExp(`const ${namn} = (\\d+);`))[1]);
        expect(kTolka(varde('K_MIN'))).toBe(varde('K_MIN'));
        expect(kTolka(varde('K_MIN') - 1)).toBeNull();
        expect(kTolka(varde('K_MAX'))).toBe(varde('K_MAX'));
        expect(kTolka(varde('K_MAX') + 1)).toBeNull();
        expect(kSanktNot(varde('K_STANDARD'))).toBe('');
        expect(kSanktNot(varde('K_STANDARD') - 1)).not.toBe('');
    });
});

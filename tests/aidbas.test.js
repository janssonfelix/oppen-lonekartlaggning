// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
// Tabellerna per AID-kod och BAS-intervall (src/lib/aidbas.js): lika arbete, likvärdigt arbete, hierarkisk
// jämförelse och arbetslistan för analys på individnivå. Underlaget är helt påhittat: 58 personer.
import { describe, it, expect } from 'vitest';
import { grupperaAidBas, dominans, likaArbeteTabell, likvardigtTabell, hierarkiskaPar, individnivaTabell, arJamforelseKlass, KV_DEFINITIONER, kvDefinitionText, kvDefinitionNamn, klassNamn, ingaParText } from '../src/lib/aidbas.js';

const rad = (bas, aid, kon, lon, yrkeLabel = `Yrke ${aid}`) => ({ bas, aid, yrke: `${aid} ${yrkeLabel}`, yrkeLabel, kon, lon, alder: 40 });
const grupp = (bas, aid, kon, n, lon0, steg = 100) => Array.from({ length: n }, (_, i) => rad(bas, aid, kon, lon0 + i * steg));
/**
 * 58 personer:
 *  - AID 1001 finns i två BAS-intervall: A (10 personer, mansdominerad, hög lön) och C (4 personer, under golvet)
 *  - AID 2002 i BAS E: 30 kvinnor och 9 män → Analyseras på individnivå; kvinnodominerad (76,9 %)
 *  - AID 3003 i BAS B: exakt 60 % kvinnor (3 av 5): olika klassning med *Mer än 60 %* och *60 % eller mer*
 *  - hierarkiskt par: 1001 i BAS A (ej kvinnodominerad, lägre BAS, högre median) mot 2002 i BAS E
 */
const underlag = () => [
    ...grupp('C', '1001', 'kvinna', 2, 30000), ...grupp('C', '1001', 'man', 2, 30500),            // 4 personer: under golvet 5
    ...grupp('A', '1001', 'man', 9, 46000), ...grupp('A', '1001', 'kvinna', 1, 46500),            // 10 personer, mansdominerad, hög lön i lågt BAS
    ...grupp('E', '2002', 'kvinna', 30, 38000), ...grupp('E', '2002', 'man', 9, 39000),            // 39 personer: 9 män → individnivå
    ...grupp('B', '3003', 'kvinna', 3, 32000), ...grupp('B', '3003', 'man', 2, 32000),             // 5 personer, exakt 60 % kvinnor
];
const INST = { k: 10, golv: 5 };

describe('aidbas: gruppering och dominans', () => {
    it('grupperar per AID + BAS ur varje persons egen rad: 1001 får två grupper', () => {
        const g = grupperaAidBas(underlag());
        expect(g.map(x => `${x.aid}|${x.bas}`).sort()).toEqual(['1001|A', '1001|C', '2002|E', '3003|B']);
        const c = g.find(x => x.aid === '1001' && x.bas === 'C');
        expect(c).toMatchObject({ n: 4, nKv: 2, nMa: 2, yrke: 'Yrke 1001' });
        expect(g.reduce((s, x) => s + x.n, 0)).toBe(58);
    });
    it('Mer än 60 %: kvinnodominerad över 60 %; 60 % eller mer: från 60 %. Mansdominerad speglat, övriga könsblandade', () => {
        expect(dominans(60, 'do')).toBe('Könsblandad');
        expect(dominans(60, 'scb')).toBe('Kvinnodominerad');
        expect(dominans(60.1, 'do')).toBe('Kvinnodominerad');
        expect(dominans(40, 'do')).toBe('Könsblandad');
        expect(dominans(40, 'scb')).toBe('Mansdominerad');
        expect(dominans(39.9, 'do')).toBe('Mansdominerad');
        expect(dominans(null, 'do')).toBe('');
        expect(Object.keys(KV_DEFINITIONER)).toEqual(['do', 'scb']);
        expect(kvDefinitionText('do')).toBe('mer än 60 % kvinnor');
        expect(kvDefinitionText('scb', 55)).toBe('55 % kvinnor eller mer');
        expect(kvDefinitionNamn('do')).toBe('Mer än 60 %');
        expect(kvDefinitionNamn('scb', 55)).toBe('55 % eller mer');
        expect(klassNamn().kv).toBe('Kvinnodominerad');
        expect(ingaParText()).toMatch(/^Inga fall där/);
    });
    it('vakt: definitionerna heter efter lydelsen, inte efter en avsändare (ADR-72)', () => {
        // Varken förarbetena eller SCB säger "X % eller mer"; propositionen är källa för båda lydelserna (lagrum.md).
        for (const def of Object.keys(KV_DEFINITIONER)) {
            for (const t of [kvDefinitionNamn(def), kvDefinitionNamn(def, 65), kvDefinitionText(def), KV_DEFINITIONER[def].namn, KV_DEFINITIONER[def].text]) {
                expect(t, def).not.toMatch(/SCB|Statistiska centralbyrån|förarbete|\bDO\b/i);
            }
        }
    });
});

describe('aidbas: Tabell 1 — Lika arbete AID x BAS', () => {
    const granser = () => ({ lag: 95, hog: 105 });
    it('en rad per AID + BAS med minst 5 personer, sorterad BAS stigande och antal fallande; små grupper i noten', () => {
        const t = likaArbeteTabell(underlag(), { ...INST, granser });
        expect(t.rader.map(r => [r.bas, r.aid, r.n])).toEqual([['A', '1001', 10], ['B', '3003', 5], ['E', '2002', 39]]);
        expect(t.sma).toEqual([{ bas: 'C', aid: '1001', yrke: 'Yrke 1001', n: 4, nKv: 2, nMa: 2 }]);
        // Summan av kvinnor och män i raderna och noten är underlaget.
        const summa = [...t.rader, ...t.sma].reduce((s, r) => s + r.nKv + r.nMa, 0);
        expect(summa).toBe(58);
    });
    it('ett kön under 10 ger inga medianer, ingen kvot, inga gränser och bedömningen Analyseras på individnivå', () => {
        const t = likaArbeteTabell(underlag(), { ...INST, granser });
        const e = t.rader.find(r => r.aid === '2002');
        expect(e).toMatchObject({ nKv: 30, nMa: 9, medKv: null, medMa: null, kvot: null, lag: null, hog: null, bedomning: 'Analyseras på individnivå' });
        expect(t.rader.every(r => r.bedomning === 'Analyseras på individnivå')).toBe(true);   // ingen grupp har 10 av varje kön
    });
    it('med 10 av varje kön: medianer, kvot och bedömning mot gränserna', () => {
        const d = [...grupp('F', '5005', 'kvinna', 12, 30000), ...grupp('F', '5005', 'man', 12, 31000), ...grupp('F', '6006', 'kvinna', 10, 40000), ...grupp('F', '6006', 'man', 10, 30000)];
        const t = likaArbeteTabell(d, { ...INST, granser: () => ({ lag: 95, hog: 105 }) });
        const inom = t.rader.find(r => r.aid === '5005'), utanfor = t.rader.find(r => r.aid === '6006');
        expect(inom.medKv).toBe(30550); expect(inom.medMa).toBe(31550);
        expect(inom.kvot).toBeCloseTo(30550 / 31550 * 100, 6);
        expect(inom).toMatchObject({ lag: 95, hog: 105, bedomning: 'Inom gränserna' });
        expect(utanfor.kvot).toBeCloseTo(40450 / 30450 * 100, 6);
        expect(utanfor.bedomning).toBe('Utanför gränserna');
        expect(t.rader.map(r => r.aid)).toEqual(['5005', '6006']);   // samma BAS: störst först
    });
    it('golvet 1 visar alla grupper som rader (skärmen), golvet 5 flyttar små till noten', () => {
        expect(likaArbeteTabell(underlag(), { ...INST, golv: 1, granser }).rader).toHaveLength(4);
    });
});

describe('aidbas: Tabell 2 — Likvärdigt arbete', () => {
    const nationell = aid => ({ '1001': 20, '2002': 85, '3003': null }[aid] ?? null);
    it('andel kvinnor, klassning, nationell andel och "brukar anses kvinnodominerad"; medianen och spridningen bara från 10 personer', () => {
        const t = likvardigtTabell(underlag(), { ...INST, definition: 'do', nationell });
        expect(t.rader.map(r => [r.bas, r.aid])).toEqual([['A', '1001'], ['B', '3003'], ['E', '2002']]);
        const e = t.rader.find(r => r.aid === '2002');
        expect(e.andelKv).toBeCloseTo(30 / 39 * 100, 6);
        expect(e).toMatchObject({ klass: 'Kvinnodominerad', andelKvNat: 85, brukar: 'Ja', n: 39 });
        expect(e.median).toBe(39400);   // hela gruppen: 30 kvinnor 38 000–40 900 och 9 män 39 000–39 800, det 20:e värdet
        expect(e.spridning).toBeCloseTo((e.p90 - e.p10) / e.median, 6);
        const a = t.rader.find(r => r.aid === '1001');
        expect(a).toMatchObject({ klass: 'Mansdominerad', brukar: 'Nej', n: 10 });
        expect(a.median).toBe(46450);
        const b = t.rader.find(r => r.aid === '3003');
        expect(b).toMatchObject({ klass: 'Könsblandad', andelKvNat: null, brukar: '', median: null, spridning: null });
        expect(t.sma.map(s => s.aid)).toEqual(['1001']);
    });
    it('en grupp med exakt 60 % kvinnor klassas olika med *Mer än 60 %* och *60 % eller mer*', () => {
        const kl = def => likvardigtTabell(underlag(), { ...INST, definition: def, nationell }).rader.find(r => r.aid === '3003').klass;
        expect(kl('do')).toBe('Könsblandad');
        expect(kl('scb')).toBe('Kvinnodominerad');
        // Nationellt: 60 % brukar anses kvinnodominerat bara med *60 % eller mer*.
        const brukar = def => likvardigtTabell(underlag(), { ...INST, definition: def, nationell: () => 60 }).rader[0].brukar;
        expect(brukar('do')).toBe('Nej');
        expect(brukar('scb')).toBe('Ja');
    });
    it('sammanfattning per BAS: bara intervall med både kvinnodominerade och andra grupper som har median', () => {
        const d = [...grupp('D', '7007', 'kvinna', 12, 30000), ...grupp('D', '8008', 'man', 12, 36000), ...grupp('D', '9009', 'kvinna', 11, 28000),
                   ...grupp('E', '2002', 'kvinna', 12, 38000)];
        const t = likvardigtTabell(d, { ...INST, definition: 'do', nationell: () => null });
        expect(t.sammanfattning).toHaveLength(1);
        const s = t.sammanfattning[0];
        expect(s).toMatchObject({ bas: 'D', kvDom: { hogst: 30550, lagst: 28500 }, ovriga: { hogst: 36550, lagst: 36550 } });
        expect(s.skillnadKr).toBe(36550 - 30550);
        expect(s.skillnadPct).toBeCloseTo((36550 / 30550 - 1) * 100, 6);
    });
});

describe('aidbas: Tabell 3 — Hierarkisk jämförelse', () => {
    it('par där ett lägre BAS som inte är kvinnodominerat har högre median än ett kvinnodominerat i högre BAS; båda minst 10', () => {
        const par = hierarkiskaPar(underlag(), { ...INST, definition: 'do' });
        expect(par).toHaveLength(1);
        expect(par[0]).toMatchObject({ a: { aid: '1001', bas: 'A', median: 46450, klass: 'Mansdominerad' }, b: { aid: '2002', bas: 'E', median: 39400 }, skillnadKr: 46450 - 39400 });
        expect(par[0].skillnadPct).toBeCloseTo((46450 / 39400 - 1) * 100, 6);
    });
    it('inga par när det kvinnodominerade arbetet ligger i samma eller lägre BAS, eller när gruppen är under 10', () => {
        const d = [...grupp('E', '1001', 'man', 12, 46000), ...grupp('E', '2002', 'kvinna', 12, 38000)];   // samma BAS
        expect(hierarkiskaPar(d, { ...INST, definition: 'do' })).toEqual([]);
        const d2 = [...grupp('A', '1001', 'man', 9, 46000), ...grupp('E', '2002', 'kvinna', 12, 38000)];   // 9 personer
        expect(hierarkiskaPar(d2, { ...INST, definition: 'do' })).toEqual([]);
    });
    it('BAS-ordningen är bokstavsordningen: J är lägre än M, och I är lägre än J', () => {
        const d = [...grupp('I', '1001', 'man', 12, 46000), ...grupp('J', '2002', 'kvinna', 12, 38000), ...grupp('M', '3003', 'kvinna', 12, 37000)];
        expect(hierarkiskaPar(d, { ...INST, definition: 'do' }).map(p => `${p.a.bas}→${p.b.bas}`)).toEqual(['I→M', 'I→J']);   // störst skillnad först
    });
    it('en blandad grupp är jämförelseyrke; filtret mansdominerade tar bort den (ADR-60)', () => {
        const d = [...grupp('A', '1001', 'man', 6, 46000), ...grupp('A', '1001', 'kvinna', 6, 46000), ...grupp('E', '2002', 'kvinna', 12, 38000)];   // 50 %
        expect(hierarkiskaPar(d, { ...INST, definition: 'do' })).toHaveLength(1);
        expect(hierarkiskaPar(d, { ...INST, definition: 'do', jamforelse: 'mansdominerade' })).toEqual([]);
        expect(likvardigtTabell([...d, ...grupp('E', '1001', 'man', 6, 46000), ...grupp('E', '1001', 'kvinna', 6, 46000)], { ...INST, jamforelse: 'mansdominerade' }).sammanfattning).toEqual([]);
        expect(arJamforelseKlass('Könsblandad')).toBe(true);
        expect(arJamforelseKlass('Könsblandad', 'mansdominerade')).toBe(false);
        expect(arJamforelseKlass('Mansdominerad', 'mansdominerade')).toBe(true);
        expect(arJamforelseKlass('Kvinnodominerad')).toBe(false);
    });
});

describe('aidbas: Tabell 4 — Analys på individnivå', () => {
    it('en rad per AID + BAS där något kön är under 10, utan löner; grupper under golvet i noten', () => {
        const t = individnivaTabell(underlag(), INST);
        expect(t.rader.map(r => [r.bas, r.aid, r.nKv, r.nMa])).toEqual([['A', '1001', 1, 9], ['B', '3003', 3, 2], ['E', '2002', 30, 9]]);
        expect(Object.keys(t.rader[0]).sort()).toEqual(['aid', 'bas', 'n', 'nKv', 'nMa', 'yrke']);
        expect(t.sma.map(s => `${s.aid}|${s.bas}`)).toEqual(['1001|C']);
        expect(JSON.stringify(t)).not.toMatch(/\b(3[0-9]|4[0-9])\d{3}\b/);   // inga löner
    });
    it('grupper med minst 10 av varje kön finns inte med', () => {
        const d = [...grupp('F', '5005', 'kvinna', 12, 30000), ...grupp('F', '5005', 'man', 12, 31000)];
        expect(individnivaTabell(d, INST).rader).toEqual([]);
    });
});

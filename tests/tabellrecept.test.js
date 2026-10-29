// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
// Egna tabeller i rapporten (src/lib/tabellrecept.js): recept, validering och tabeller med minsta gruppstorlek.
import { describe, it, expect } from 'vitest';
import { nyttRecept, valideraRecept, receptBeskrivning, receptTillTabeller, RECEPT_DIMENSIONER, RECEPT_MATT } from '../src/lib/tabellrecept.js';
import { DIMENSIONER, MATT } from '../src/lib/utforska.js';

const rad = (bas, aid, kon, lon, alder = 40) => ({ bas, aid, yrke: `${aid} Yrke${aid}`, yrkeLabel: `Yrke${aid}`, kon, lon, alder });
const grupp = (bas, aid, kon, n, lon0) => Array.from({ length: n }, (_, i) => rad(bas, aid, kon, lon0 + i * 100, 25 + (i % 30)));
const underlag = () => [...grupp('A', '1000', 'kvinna', 12, 30000), ...grupp('A', '1000', 'man', 12, 31000),
    ...grupp('A', '2000', 'kvinna', 4, 77777), ...grupp('B', '3000', 'kvinna', 15, 40000), ...grupp('B', '3000', 'man', 3, 88888)];

describe('tabellrecept: recept', () => {
    it('dimensionerna och måtten är Utforskas', () => {
        expect(RECEPT_DIMENSIONER).toEqual(DIMENSIONER);
        expect(RECEPT_MATT).toEqual(MATT);
    });
    it('nyttRecept tar Utforskas spec, kortar namnet och ger en beskrivning som namn när inget anges', () => {
        const r = nyttRecept({ rad: 'aid', kolumn: 'kon', matt: 'median', delaKon: false, slaIhop: false, urval: { lage: 'alla', villkor: [] }, gruppVillkor: [] }, { namn: '' });
        expect(r.id).toMatch(/^t/);
        expect(r.namn).toBe('Median månadslön per Yrkesgrupp (AID) och Kön');
        expect(nyttRecept({ rad: 'bas', matt: 'p90' }, { namn: 'x'.repeat(100) }).namn).toHaveLength(80);
    });
    it('valideraRecept avvisar okänd dimension och rättar okänt mått, kolumn lika med rad och upprepning på radens dimension', () => {
        expect(valideraRecept({ spec: { rad: 'hemlig' } })).toBeNull();
        expect(valideraRecept(null)).toBeNull();
        const r = valideraRecept({ spec: { rad: 'bas', kolumn: 'bas', matt: 'fel', delaKon: 1 }, upprepa: 'bas' });
        expect(r.spec).toMatchObject({ rad: 'bas', kolumn: null, matt: 'median', delaKon: true, urval: { lage: 'alla', villkor: [] }, gruppVillkor: [] });
        expect(r.upprepa).toBeNull();
        expect(valideraRecept({ spec: { rad: 'aid', matt: 'n' }, upprepa: 'bas' }).upprepa).toBe('bas');
    });
    it('beskrivningen nämner kön, villkor och upprepning', () => {
        const r = valideraRecept({ spec: { rad: 'aid', matt: 'gap', delaKon: true, urval: { lage: 'alla', villkor: [{ falt: 'lon', op: 'minst', varde: 30000 }] } }, upprepa: 'bas' });
        expect(receptBeskrivning(r)).toBe('Kvinnors median i % av mäns per Yrkesgrupp (AID), kvinnor och män var för sig, 1 villkor i urvalet, en tabell per BAS-intervall');
    });
});

describe('tabellrecept: tabeller med minsta gruppstorlek', () => {
    it('en enkel tabell: grupper under k utelämnas och räknas; n står som text', () => {
        const [t] = receptTillTabeller(underlag(), nyttRecept({ rad: 'aid', matt: 'median' }, { namn: 'Yrken' }), { k: 10 });
        expect(t.rubrik).toBe('Yrken');
        expect(t.kolumner.map(c => c.rubrik)).toEqual(['Yrkesgrupp (AID)', 'Median månadslön', 'n (K/M)']);
        expect(t.rader.map(r => r[0]).sort()).toEqual(['1000 Yrke1000', '3000 Yrke3000']);   // pivoten sorterar efter värde
        expect(t.rader.find(r => r[0] === '3000 Yrke3000')[2]).toBe('18 (15/3)');
        expect(t.utelamnade).toBe(1);
        expect(t.not).toBe('1 grupp med färre än 10 personer redovisas inte.');
        expect(JSON.stringify(t)).not.toContain('77777');
    });
    it('kvinnor och män var för sig: ett kön under k blir tomt, antal följer alltid med', () => {
        const [t] = receptTillTabeller(underlag(), nyttRecept({ rad: 'bas', matt: 'median', delaKon: true }, { namn: 'Per kön' }), { k: 10 });
        expect(t.kolumner.map(c => c.rubrik)).toEqual(['BAS-intervall', 'Kvinnor', 'Män', 'n (K/M)']);
        const b = t.rader.find(r => r[0] === 'B');
        expect(b[1]).toBeGreaterThan(0);
        expect(b[2]).toBeNull();
        expect(b[3]).toBe('18 (15/3)');
        const [n] = receptTillTabeller(underlag(), nyttRecept({ rad: 'bas', matt: 'n', delaKon: true }, { namn: 'Antal' }), { k: 10 });
        expect(n.rader.find(r => r[0] === 'B')[2]).toBe(3);
    });
    it('korstabell: kolumner och rader med bara tomma celler utelämnas', () => {
        const [t] = receptTillTabeller(underlag(), nyttRecept({ rad: 'bas', kolumn: 'aid', matt: 'median' }, { namn: 'Kors' }), { k: 10 });
        expect(t.kolumner[0].rubrik).toBe('BAS-intervall \\ Yrkesgrupp (AID)');
        expect(t.kolumner.map(c => c.rubrik)).not.toContain('2000 Yrke2000');
        expect(JSON.stringify(t)).not.toContain('77777');
        expect(t.rader.map(r => r[0]).sort()).toEqual(['A', 'B']);
    });
    it('upprepad per BAS: en tabell per intervall, med intervallet i rubriken; ett intervall utan rader utelämnas', () => {
        const tabeller = receptTillTabeller(underlag(), nyttRecept({ rad: 'aid', matt: 'p10' }, { namn: 'Yrken', upprepa: 'bas' }), { k: 10 });
        expect(tabeller.map(t => t.rubrik)).toEqual(['Yrken — BAS A', 'Yrken — BAS B']);
        expect(tabeller[0].rader).toHaveLength(1);
        expect(tabeller[0].kolumner[1].typ).toBe('kr');
    });
    it('ett ogiltigt recept ger inga tabeller; vid k = 1 visas allt', () => {
        expect(receptTillTabeller(underlag(), { spec: { rad: 'x' } })).toEqual([]);
        const [t] = receptTillTabeller(underlag(), nyttRecept({ rad: 'aid', matt: 'median' }, { namn: 'Allt' }), { k: 1 });
        expect(t.rader).toHaveLength(3);
        expect(t.not).toBe('');
    });
});

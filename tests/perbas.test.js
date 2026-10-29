// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
// Tabellerna per BAS-intervall (src/lib/perbas.js): formen ur arbetsgivarnas utkast och minsta gruppstorlek.
import { describe, it, expect } from 'vitest';
import { perBasTabeller, aldersgruppNamn, yrkesnamn } from '../src/lib/perbas.js';

const rad = (bas, aid, kon, lon, alder, yrkeLabel = `Yrke ${aid}`) => ({ bas, aid, yrke: `${aid} ${yrkeLabel}`, yrkeLabel, kon, lon, alder });
const grupp = (bas, aid, kon, n, lon0, alder0 = 30) => Array.from({ length: n }, (_, i) => rad(bas, aid, kon, lon0 + i * 100, alder0 + (i % 25)));
const underlag = () => [
    ...grupp('D', '2071', 'kvinna', 20, 31000, 25), ...grupp('D', '2071', 'man', 12, 31500, 40),   // undersköterskor: båda könen ≥ 10
    ...grupp('D', '1010', 'kvinna', 6, 33000, 45),                                                  // administratörer: < 10
    ...grupp('G', '3510', 'kvinna', 30, 40000, 28), ...grupp('G', '3510', 'man', 4, 41000, 50),     // män < 10
    ...grupp('K', '1030', 'man', 3, 60000, 55),                                                      // BAS K: 3 personer
];
const referens = (aid, bas) => (bas === 'D' ? { p10: 33000, med: 33900, p90: 37800 } : null);
const statistik = [{ aid: '2071', bas: 'D', median: 34700, p10: 31000, p90: 38950 }, { aid: '3510', median: 43000 }];

describe('perbas: tabellen per BAS-intervall', () => {
    it('raderna kommer i utkastets ordning: referens, organisationen, yrken med statistik under, kvinnor, män', () => {
        const t = perBasTabeller(underlag(), { k: 10, referens, statistik, referensNamn: 'Ställningstagande 2026', statistikNamn: 'Lönestatistik' });
        const D = t.intervall.find(i => i.bas === 'D');
        expect(D.rader.map(r => r.typ)).toEqual(['referens', 'organisation', 'yrke', 'statistik', 'kvinnor', 'man']);
        expect(D.rader[0]).toMatchObject({ namn: 'Ställningstagande 2026', n: null, p10: 33000, med: 33900, p90: 37800 });
        expect(D.rader[1]).toMatchObject({ namn: 'Organisationen', n: 38 });
        expect(D.rader[2]).toMatchObject({ namn: '2071 Yrke 2071', n: 32 });
        expect(D.rader[3]).toMatchObject({ namn: 'Lönestatistik: 2071 Yrke 2071', n: null, med: 34700, p10: 31000, p90: 38950 });
        expect(D.rader[4]).toMatchObject({ namn: 'Kvinnor', n: 26 });
        expect(D.rader[5]).toMatchObject({ namn: 'Män', n: 12 });
        expect(D.utelamnade).toEqual(['1010 Yrke 1010']);
    });
    it('könsraderna utelämnas när ett kön har färre än k; statistik utan BAS matchar yrket', () => {
        const t = perBasTabeller(underlag(), { k: 10, referens, statistik });
        const G = t.intervall.find(i => i.bas === 'G');
        expect(G.konVisas).toBe(false);
        expect(G.rader.map(r => r.typ)).toEqual(['organisation', 'yrke', 'statistik']);
        expect(G.rader[2].med).toBe(43000);
    });
    it('ett BAS-intervall under k får inget block men räknas upp', () => {
        const t = perBasTabeller(underlag(), { k: 10 });
        expect(t.intervall.map(i => i.bas)).toEqual(['D', 'G']);
        expect(t.basUtelamnade).toEqual(['K']);
        expect(perBasTabeller(underlag(), { k: 2 }).intervall.map(i => i.bas)).toEqual(['D', 'G', 'K']);
    });
    it('P10, median och P90 är kvantiler ur gruppens löner', () => {
        const t = perBasTabeller(grupp('A', '1', 'kvinna', 11, 20000).concat(grupp('A', '1', 'man', 11, 20000)), { k: 10 });
        const org = t.intervall[0].rader.find(r => r.typ === 'organisation');
        expect(org.med).toBe(20500);
        expect(org.p10).toBeLessThan(org.med);
        expect(org.p90).toBeGreaterThan(org.med);
    });
});

describe('perbas: löneskillnader inom likvärdigt arbete och i åldersgrupper', () => {
    it('könsgapstabellen: Alla först, medellön per kön bara när båda könen når k', () => {
        const t = perBasTabeller(underlag(), { k: 10 });
        expect(t.konsgap.rader.map(r => r.bas)).toEqual(['Alla', 'D', 'G']);
        const alla = t.konsgap.rader[0];
        expect(alla.n).toBe(75);
        expect(alla.konVisas).toBe(true);
        expect(alla.kvot).toBeCloseTo(alla.medelKv / alla.medelMa * 100, 6);
        expect(alla.andelKv).toBeCloseTo(56 / 75 * 100, 6);
        const G = t.konsgap.rader[2];
        expect(G.konVisas).toBe(false);
        expect(G.medelKv).toBeNull(); expect(G.medelMa).toBeNull(); expect(G.kvot).toBeNull();
        expect(G.medel).toBeGreaterThan(0);
        expect(G.alder).toBeGreaterThan(0);
    });
    it('åldersgrupperna: –34, 35–49, 50– som standard; en grupp under k får ingen medellön', () => {
        expect(aldersgruppNamn([35, 50])).toEqual(['–34', '35–49', '50–']);
        expect(aldersgruppNamn([30, 40, 55])).toEqual(['–29', '30–39', '40–54', '55–']);
        const t = perBasTabeller(underlag(), { k: 10 });
        expect(t.aldersgrupper.grupper).toEqual(['–34', '35–49', '50–']);
        const D = t.aldersgrupper.rader.find(r => r.bas === 'D');
        expect(D.antalPerGrupp.reduce((s, x) => s + x, 0)).toBe(38);
        D.perGrupp.forEach((m, i) => { if (D.antalPerGrupp[i] < 10) expect(m).toBeNull(); else expect(m).toBeGreaterThan(0); });
    });
    it('yrkesnamn: AID och etikett, annars det som finns', () => {
        expect(yrkesnamn({ aid: '2071', yrkeLabel: 'Undersköterska' })).toBe('2071 Undersköterska');
        expect(yrkesnamn({ aid: '2071', yrkeLabel: '2071' })).toBe('2071');
        expect(yrkesnamn({ yrke: 'Fritext' })).toBe('Fritext');
        expect(yrkesnamn({})).toBe('(okänt yrke)');
    });
});

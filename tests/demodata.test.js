// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
/**
 * Demodatans generatorer (src/lib/demodata.js) utan webbläsare: det lilla demot (testdatan och demodatan) och det stora
 * demots underlag, med storlek, determinism (samma rader vid ett andra anrop), fälten, BAS A–K, yrkesgrupperna, de små
 * grupperna, AID-kodningen och de inlagda gapen. Inläsningen i demoläget prövas i tests/stort-demo.test.js och
 * självdiagnostiken i appens tester.
 */
import { describe, it, expect } from 'vitest';
import { generateTestData, generateDemoData, generateStortDemo, generateStortDemoStatistik, _sdStallningstagande,
    _SD_GAP, _SD_LIKVARDIGT } from '../src/lib/demodata.js';
import { aidKriterier } from '../src/lib/aidkontroll.js';
import { arKvinna, arMan } from '../src/lib/kon.js';

const BAS_AK = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K'];
const median = l => { const s = [...l].sort((a, b) => a - b); return (s[(s.length - 1) >> 1] + s[s.length >> 1]) / 2; };

describe('det lilla demot', () => {
    it('testdatan har 200 rader och demodatan 260, samma vid ett andra anrop', () => {
        expect(generateTestData()).toHaveLength(200);
        expect(generateDemoData()).toHaveLength(260);
        expect(JSON.stringify(generateTestData())).toBe(JSON.stringify(generateTestData()));
        expect(JSON.stringify(generateDemoData())).toBe(JSON.stringify(generateDemoData()));
    });
});

describe('stort demo: statistiken och ställningstagandet', () => {
    it('samma statistik och samma ställningstagande vid ett andra anrop', () => {
        expect(JSON.stringify(generateStortDemoStatistik())).toBe(JSON.stringify(generateStortDemoStatistik()));
        const data = generateStortDemo();
        expect(_sdStallningstagande(data, 10).map(r => r.bas)).toEqual(BAS_AK);
        expect(_sdStallningstagande(data, 10)).toEqual(_sdStallningstagande(generateStortDemo(), 10));
    });
});

describe('stort demo: generatorn', () => {
    const data = generateStortDemo();

    it('5 000 rader, och samma rader vid ett andra anrop', () => {
        expect(data).toHaveLength(5000);
        const igen = generateStortDemo();
        expect(igen[0]).toEqual(data[0]);
        expect(JSON.stringify(igen)).toBe(JSON.stringify(data));
    });

    it('varje rad har samma fält som det lilla demot, alla satta', () => {
        const fel = [];
        data.forEach((r, i) => {
            const ok = BAS_AK.includes(r.bas) && /^\d{6} \S/.test(r.yrke) && r.aid === r.yrke.slice(0, 6)
                && r.yrkeLabel === r.yrke.slice(7) && Number.isInteger(r.lon) && r.lon > 15000 && r.lon < 150000
                && Number.isInteger(r.alder) && r.alder >= 18 && r.alder <= 67 && (r.kon === 'kvinna' || r.kon === 'man')
                && Array.isArray(r.ansvarskoder) && ['inget', 'uppdrag', 'ledning'].includes(r.ansvarsgrupp) && r.radnr === i + 2;
            if (!ok) fel.push(i);
        });
        expect(fel.slice(0, 5)).toEqual([]);
        const falt = Object.keys(generateDemoData()[0]).concat('radnr').sort();
        expect(Object.keys(data[0]).sort()).toEqual(falt);
    });

    it('BAS A–K finns alla, flest i B–G', () => {
        const per = Object.fromEntries(BAS_AK.map(b => [b, data.filter(r => r.bas === b).length]));
        for (const b of BAS_AK) expect(per[b], b).toBeGreaterThan(0);
        expect(per.B + per.C + per.D + per.E + per.F + per.G).toBeGreaterThan(0.7 * data.length);
        expect(per.J + per.K).toBeLessThan(0.08 * data.length);
    });

    it('100 yrkesgrupper, några under tio personer och några där ett kön är färre än tio', () => {
        const per = new Map();
        for (const r of data) { const g = per.get(r.aid) || { n: 0, kv: 0 }; g.n++; if (arKvinna(r)) g.kv++; per.set(r.aid, g); }
        expect(per.size).toBe(100);
        const sma = [...per.values()].filter(g => g.n < 10);
        expect(sma.length).toBeGreaterThanOrEqual(3);
        const ettKonFa = [...per.values()].filter(g => g.n >= 10 && (g.kv < 10 || g.n - g.kv < 10));
        expect(ettKonFa.length).toBeGreaterThanOrEqual(2);
        expect(Math.max(...[...per.values()].map(g => g.n))).toBeLessThanOrEqual(900);
    });

    it('kontrollen av AID-kodningen är grön: koderna finns i etikettlistan och ansvarskoderna är tillåtna', () => {
        const kriterier = aidKriterier(generateStortDemo(), { k: 10, harAnsvar: true });
        expect(kriterier.filter(k => k.status !== 'ok').map(k => `${k.id}: ${k.text}`)).toEqual([]);
    });

    it('likvärdigt arbete: ett mansdominerat tekniskt yrke har högre lön än ett kvinnodominerat vårdyrke i samma intervall', () => {
        const { hog, lag, bas } = _SD_LIKVARDIGT;
        const grupp = aid => data.filter(r => r.bas === bas && r.aid === aid);
        const tekniker = grupp(hog), vard = grupp(lag);
        expect(tekniker.filter(arKvinna).length / tekniker.length).toBeLessThan(0.25);
        expect(vard.filter(arKvinna).length / vard.length).toBeGreaterThan(0.8);
        expect(median(tekniker.map(r => r.lon))).toBeGreaterThan(median(vard.map(r => r.lon)) * 1.05);
    });

    it('gapet för kvinnor finns i yrkena i _SD_GAP och inte i övriga', () => {
        const gap = _SD_GAP;
        const grupper = new Map();   // yrke inom BAS-intervall
        for (const r of data) {
            const nyckel = `${r.aid} ${r.bas}`;
            const g = grupper.get(nyckel) || { aid: r.aid, kv: [], ma: [] };
            if (arKvinna(r)) g.kv.push(r.lon); else if (arMan(r)) g.ma.push(r.lon);
            grupper.set(nyckel, g);
        }
        const alla = [...grupper.values()];
        expect(Object.keys(gap)).toHaveLength(4);
        for (const aid of Object.keys(gap)) {
            const iYrket = alla.filter(g => g.aid === aid);
            expect(iYrket.length, aid).toBeGreaterThan(0);
            for (const g of iYrket) expect(median(g.kv), aid).toBeLessThan(median(g.ma));
        }
        const utanGap = alla.filter(g => !(g.aid in gap) && g.kv.length >= 10 && g.ma.length >= 10);
        expect(utanGap.some(g => median(g.kv) >= 0.99 * median(g.ma))).toBe(true);
    });
});

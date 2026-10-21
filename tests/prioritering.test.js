/**
 * Lib-tester för src/lib/prioritering.js, direkt mot modulen (utan jsdom och utan appen).
 *
 * Fixturerna är små och handgjorda, så varje förväntat tal går att räkna för hand.
 * Att adaptern i 55-prioritering.js delegerar hit vaktas i drift.test.js.
 */
import { describe, it, expect } from 'vitest';
import { prioritera, prioIndex } from '../src/lib/prioritering.js';

const VIKTER = { avvikelse: 50, volym: 30, jamstalldhet: 20 };
const CONFIG = { atgardThreshold: -5, akutMinN: 10, bevakaThreshold: -2, analyseraThreshold: 5 };
const KOST = { months: 12, poPct: 39.15 };

// n personer i en grupp: kvinnor och män med angiven lön.
const grupp = (yrke, bas, kvLon, kvN, maLon, maN) => [
    ...Array.from({ length: kvN }, () => ({ yrke, bas, kon: 'kvinna', lon: kvLon })),
    ...Array.from({ length: maN }, () => ({ yrke, bas, kon: 'man', lon: maLon }))
];
const ref = (medianPerAid) => (aid) => (medianPerAid[aid] !== undefined ?{ median: medianPerAid[aid], kalla: 'testref' } : null);

function kör(rader, extra = {}) {
    return prioritera(rader, {
        referensFor: ref({ '5301': 35000, '2000': 30000 }),
        kTroskel: 10,
        prioConfig: CONFIG,
        prioWeights: VIKTER,
        costSettings: KOST,
        bristAids: new Set(),
        ...extra
    });
}

describe('prioIndex: själva indexformeln', () => {
    const delar = { sevScore: 100, volScore: 0, gapScore: 0, riktningsvikt: 1, bristMultiplier: 1, vikter: VIKTER };

    it('avvikelsen ensam ger sin vikt andel av 100 (vikterna normaliseras)', () => {
        expect(prioIndex(delar)).toBeCloseTo(50, 10);
    });

    it('vikterna normaliseras även när de inte summerar till 100', () => {
        expect(prioIndex({ ...delar, vikter: { avvikelse: 1, volym: 1, jamstalldhet: 2 } })).toBeCloseTo(25, 10);
    });

    it('riktningsvikt 0,5 halverar och bristmultiplikatorn 1,2 höjer med 20 %', () => {
        expect(prioIndex({ ...delar, riktningsvikt: 0.5 })).toBeCloseTo(25, 10);
        expect(prioIndex({ ...delar, bristMultiplier: 1.2 })).toBeCloseTo(60, 10);
    });

    it('en nollvikt-summa ger inte division med noll (wTotal ≥ 1)', () => {
        const noll = { avvikelse: 0, volym: 0, jamstalldhet: 0 };
        expect(prioIndex({ ...delar, vikter: noll })).toBe(0);
    });
});

describe('prioritera: gruppering och k-regel', () => {
    it('tom indata ger en tom lista', () => {
        expect(kör([])).toEqual([]);
    });

    it('grupper under kTroskel tas inte med (n = 18 < 20)', () => {
        const rader = grupp('5301 Undersköterska', 'B', 30000, 9, 31000, 9);
        expect(kör(rader, { kTroskel: 20 })).toEqual([]);
    });

    it('grupper utan referens hoppas över', () => {
        const rader = grupp('9999 Okänt', 'B', 30000, 12, 31000, 12);
        expect(kör(rader)).toEqual([]);
    });

    it('yrke utan AID-siffror används som AID', () => {
        const rader = grupp('Ingen kod', 'B', 30000, 12, 31000, 12);
        const res = kör(rader, { referensFor: () => ({ median: 35000, kalla: 'x' }) });
        expect(res[0].aid).toBe('Ingen kod');
    });
});

describe('prioritera: avvikelse, kostnad och status', () => {
    // 12 kvinnor och 12 män à 30 000 kr; referens 35 000 kr → avvikelse -14,29 %, -5 000 kr/mån.
    const rader = grupp('5301 Undersköterska', 'B', 30000, 12, 30000, 12);
    const [item] = kör(rader);

    it('median, avvikelse i procent och kronor', () => {
        expect(item.median).toBe(30000);
        expect(item.refMedian).toBe(35000);
        expect(item.refSource).toBe('testref');
        expect(item.diffPct).toBeCloseTo((30000 / 35000 - 1) * 100, 10);
        expect(item.diffKr).toBe(-5000);
    });

    it('åtgärdskostnad = |avvikelse| × månader × (1 + PO) × antal personer', () => {
        const forvantad = 5000 * 12 * (1 + 39.15 / 100) * 24;
        expect(item.annualGapTotal).toBeCloseTo(forvantad, 6);
        expect(item.annualOverTotal).toBe(0);
    });

    it('status akut när avvikelsen är under gränsen och n är tillräckligt stort', () => {
        expect(item.status).toBe('akut');
        expect(item.n).toBe(24);
    });

    it('över referens: riktningsvikt 0,5 och överlönekostnad i stället för åtgärdskostnad', () => {
        const over = grupp('5301 Undersköterska', 'B', 40000, 12, 40000, 12);
        const [o] = kör(over);
        expect(o.diffKr).toBe(5000);
        expect(o.annualGapTotal).toBe(0);
        expect(o.annualOverTotal).toBeCloseTo(5000 * 12 * (1 + 39.15 / 100) * 24, 6);
        expect(o.status).toBe('analysera');
        expect(o.priorityIndex).toBeCloseTo(prioIndex({
            sevScore: Math.min(30, Math.abs(o.diffPct)) / 30 * 100,
            volScore: 24 / 50 * 100,
            gapScore: 0,
            riktningsvikt: 0.5,
            bristMultiplier: 1,
            vikter: VIKTER
        }), 10);
    });

    it('bevaka och ok efter tröskelvärdena', () => {
        // -3 % ligger mellan atgard (-5) och bevaka (-2)
        const r = grupp('5301 Undersköterska', 'B', 33950, 12, 33950, 12);
        const [b] = kör(r, { referensFor: () => ({ median: 35000, kalla: 'x' }) });
        expect(b.status).toBe('bevaka');
        const [ok] = kör(grupp('5301 Undersköterska', 'B', 35000, 12, 35000, 12), { referensFor: () => ({ median: 35000, kalla: 'x' }) });
        expect(ok.status).toBe('ok');
    });
});

describe('prioritera: könsmedianer och lönegap (ADR-12)', () => {
    const rader = grupp('5301 Undersköterska', 'B', 30000, 10, 33000, 10);

    it('gapet mellan könens medianer räknas när båda könen har minst kTroskel personer', () => {
        const [item] = kör(rader, { kTroskel: 10 });
        expect(item.medKv).toBe(30000);
        expect(item.medMa).toBe(33000);
        expect(item.gapPct).toBeCloseTo((30000 / 33000 - 1) * 100, 10);
        expect(item.kvN).toBe(10);
        expect(item.maN).toBe(10);
    });

    it('under kTroskel för ett kön blir könsmedianen och gapet null, gruppen finns kvar', () => {
        // Gruppen har 20 personer (≥ 11) men bara 10 av vardera könet, så ingen könsjämförelse görs.
        const [item] = kör(rader, { kTroskel: 11, referensFor: () => ({ median: 35000, kalla: 'x' }) });
        expect(item.medKv).toBeNull();
        expect(item.medMa).toBeNull();
        expect(item.gapPct).toBeNull();
        expect(item.median).toBe(31500);
    });

    it('ett kön med färre än kTroskel personer ger null för just det könets median', () => {
        const enkönat = grupp('5301 Undersköterska', 'B', 30000, 12, 33000, 3);
        const [e] = kör(enkönat, { kTroskel: 5, referensFor: () => ({ median: 35000, kalla: 'x' }) });
        expect(e.medMa).toBeNull();
        expect(e.gapPct).toBeNull();
        expect(e.medKv).toBe(30000);
    });

    it('gapScore tar bara hänsyn till gapet upp till 15 %', () => {
        const stort = grupp('5301 Undersköterska', 'B', 20000, 12, 40000, 12);
        const [item] = kör(stort, { referensFor: () => ({ median: 30000, kalla: 'x' }) });
        expect(item.gapPct).toBeCloseTo((20000 / 40000 - 1) * 100, 10);
        // gapScore = min(15, |gap|)/15*100 = 100 vid gap -50 %
        const forvantat = prioIndex({
            sevScore: Math.min(30, Math.abs(item.diffPct)) / 30 * 100,
            volScore: 24 / 50 * 100,
            gapScore: 100,
            riktningsvikt: item.diffPct < 0 ? 1 : 0.5,
            bristMultiplier: 1,
            vikter: VIKTER
        });
        expect(item.priorityIndex).toBeCloseTo(forvantat, 10);
    });
});

describe('prioritera: snabbvinst, bristyrke och sortering', () => {
    it('snabbvinst: få kronor per person och >3 % avvikelse med minst 5 personer', () => {
        // -1 000 kr/mån (≈ -2,9 %) är för litet; -1 200 kr/mån mot 30 000 ger -4 % → snabbvinst
        const r = grupp('5301 Undersköterska', 'B', 28800, 6, 28800, 6);
        const [item] = kör(r, { referensFor: () => ({ median: 30000, kalla: 'x' }) });
        expect(item.costPerPerson).toBeCloseTo(1200, 10);
        expect(Math.abs(item.diffPct)).toBeGreaterThan(3);
        expect(item.isQuickWin).toBe(true);
    });

    it('bristyrke ger multiplikatorn 1,2 på indexet och flaggas', () => {
        const r = grupp('5301 Undersköterska', 'B', 30000, 12, 30000, 12);
        const [vanlig] = kör(r);
        const [brist] = kör(r, { bristAids: new Set(['5301']) });
        expect(brist.isBrist).toBe(true);
        expect(vanlig.isBrist).toBe(false);
        expect(brist.priorityIndex).toBeCloseTo(vanlig.priorityIndex * 1.2, 10);
    });

    it('listan sorteras på prioritetsindex, störst först, och raderna behålls som _rows', () => {
        const rader = [
            ...grupp('5301 Undersköterska', 'B', 30000, 12, 30000, 12),
            ...grupp('2000 Ingenjör', 'C', 29000, 12, 29000, 12)
        ];
        const res = kör(rader);
        expect(res.length).toBe(2);
        expect(res[0].priorityIndex).toBeGreaterThanOrEqual(res[1].priorityIndex);
        for (const it of res) {
            expect(it._rows.every(r => r.yrke === it.yrke && r.bas === it.bas)).toBe(true);
            expect(it._rows.length).toBe(24);
        }
    });
});

/**
 * Enhetstester för den rena löneöversyns-/prognosmodulen (src/lib/loneoversyn.js).
 * Verifierar pott-beräkning, de tre inom-grupp-metoderna (flat/lowest/target),
 * budgetutnyttjande, råa gapet före/efter och optimeringsheuristiken.
 */
import { describe, it, expect } from 'vitest';
import {
    totalLonSum, computePott, allocate, targetRows, rawGenderGap, suggestTargets, forecastOutcome,
    summarizeGroups, detectLeapfrog, closureTargets, stagedPlan,
    bandStats, individualRemediation, marketTargets, sensitivityCurve
} from '../src/lib/loneoversyn.js';

const rows = () => [
    { bas: 'A', aid: '5301', kon: 'kvinna', lon: 30000 },
    { bas: 'A', aid: '5301', kon: 'kvinna', lon: 32000 },
    { bas: 'A', aid: '5301', kon: 'man',    lon: 34000 },
    { bas: 'B', aid: '2000', kon: 'man',    lon: 40000 },
    { bas: 'B', aid: '2000', kon: 'kvinna', lon: 38000 }
];

describe('forecast: pott & lönesumma', () => {
    it('totalLonSum summerar månadslöner', () => {
        expect(totalLonSum(rows())).toBe(174000);
    });
    it('computePott i krontal returnerar beloppet', () => {
        expect(computePott(rows(), { mode: 'kr', value: 5000 })).toBe(5000);
    });
    it('computePott i procent = andel av lönesumman', () => {
        expect(computePott(rows(), { mode: 'pct', value: 2 })).toBeCloseTo(3480, 6);
    });
    it('negativ/saknad budget ger 0', () => {
        expect(computePott(rows(), { mode: 'kr', value: -100 })).toBe(0);
        expect(computePott(rows(), null)).toBe(0);
    });
});

describe('forecast: generellt påslag', () => {
    it('generellt procentpåslag till alla', () => {
        const a = allocate(rows(), { mode: 'pct', value: 2 }, []);
        expect(a.totals.generellCost).toBeCloseTo(3480, 6);
        expect(a.totals.riktadCost).toBe(0);
        expect(a.perPerson[0].nyLon).toBeCloseTo(30600, 6);
    });
    it('generellt krontal (flat) till varje individ', () => {
        const a = allocate(rows(), { mode: 'kr', value: 1000 }, []);
        expect(a.totals.generellCost).toBe(5000);   // 5 individer × 1000
        expect(a.perPerson[3].nyLon).toBe(41000);
    });
});

describe('forecast: riktat — kön, lönegräns och höj till', () => {
    const t = over => ({ bas: 'A', aid: '5301', mode: 'kr', value: 3000, dist: 'flat', ...over });
    it('targetRows: gruppen, snävad till kön och löner under gränsen', () => {
        expect(targetRows(rows(), t())).toEqual([0, 1, 2]);
        expect(targetRows(rows(), t({ kon: 'kvinna' }))).toEqual([0, 1]);
        expect(targetRows(rows(), t({ kon: 'man' }))).toEqual([2]);
        expect(targetRows(rows(), t({ lonCap: 32000 }))).toEqual([0]);
        expect(targetRows(rows(), t({ aid: '*', kon: 'alla', lonCap: null }))).toEqual([0, 1, 2]);
        expect(targetRows(rows(), t({ bas: 'B', aid: '*', kon: 'kvinna' }))).toEqual([4]);
    });
    it('bara kvinnor: potten fördelas bland kvinnorna, mannen får inget', () => {
        const a = allocate(rows(), { mode: 'pct', value: 0 }, [t({ kon: 'kvinna' })]);
        expect(a.perPerson[2].delta).toBe(0);
        expect(a.perPerson[0].delta + a.perPerson[1].delta).toBeCloseTo(3000, 6);
    });
    it('lönegräns: bara den under gränsen får påslaget', () => {
        const a = allocate(rows(), { mode: 'pct', value: 0 }, [t({ lonCap: 31000 })]);
        expect(a.perPerson.map(p => p.delta)).toEqual([3000, 0, 0, 0, 0]);
    });
    it('höj till: var och en under beloppet lyfts dit, de över rörs inte; fördelningen spelar ingen roll', () => {
        const a = allocate(rows(), { mode: 'pct', value: 0 }, [t({ mode: 'till', value: 31000, dist: 'lowest' })]);
        expect(a.perPerson.map(p => p.nyLon)).toEqual([31000, 32000, 34000, 40000, 38000]);
        expect(a.totals.riktadCost).toBe(1000);
    });
    it('en rad utan träff (kön som inte finns i gruppen) kostar inget', () => {
        const a = allocate(rows(), { mode: 'pct', value: 0 }, [t({ bas: 'B', aid: '2000', kon: 'kvinna', lonCap: 30000 })]);
        expect(a.totals.riktadCost).toBe(0);
    });
});

describe('forecast: riktat — inom-grupp-metoder', () => {
    const tgt = (over) => [{ bas: 'A', aid: '5301', mode: 'kr', value: 3000, ...over }];

    it('flat: lika procent, hela potten används', () => {
        const a = allocate(rows(), { mode: 'pct', value: 0 }, tgt({ dist: 'flat' }));
        expect(a.totals.riktadCost).toBeCloseTo(3000, 6);
        // frac = 3000/96000 = 0.03125
        expect(a.perPerson[0].delta).toBeCloseTo(937.5, 6);
        expect(a.perPerson[2].delta).toBeCloseTo(1062.5, 6);
    });

    it('lowest: water-filling lyfter de lägst betalda först', () => {
        const a = allocate(rows(), { mode: 'pct', value: 0 }, tgt({ dist: 'lowest' }));
        expect(a.totals.riktadCost).toBeCloseTo(3000, 6);
        expect(a.perPerson[0].delta).toBeCloseTo(2500, 6);  // 30000 -> 32500
        expect(a.perPerson[1].delta).toBeCloseTo(500, 6);   // 32000 -> 32500
        expect(a.perPerson[2].delta).toBe(0);               // 34000 oförändrad
    });

    it('target (median): kapar vid målnivån, leftover används ej', () => {
        const a = allocate(rows(), { mode: 'pct', value: 0 },
            tgt({ dist: 'target', targetLevel: 'median', value: 5000 }));
        // median(A) = 32000; bara den lägsta lyfts till 32000 = 2000 kr, resten oanvänt
        expect(a.perPerson[0].delta).toBeCloseTo(2000, 6);
        expect(a.perPerson[1].delta).toBe(0);
        expect(a.totals.riktadCost).toBeCloseTo(2000, 6);
    });
});

describe('forecast: råa gapet före/efter', () => {
    it('riktat lyft mot kvinnor minskar gapet', () => {
        const before = rawGenderGap(rows(), r => r.lon);     // median kv 31000 / median ma ~37000
        const a = allocate(rows(), { mode: 'pct', value: 0 },
            [{ bas: 'A', aid: '5301', mode: 'kr', value: 6000, dist: 'flat' }]);
        const after = rawGenderGap(a.perPerson, p => p.nyLon);
        expect(before).toBeLessThan(0);                       // kvinnor under män
        expect(after).toBeGreaterThan(before);                // gapet krymper (mindre negativt)
    });
});

describe('forecast: optimeringsförslag', () => {
    it('fördelar proportionellt mot påverkansindex, kapat vid full stängning', () => {
        const cand = [
            { bas: 'A', aid: '5301', gapKr: 1000, n: 3 },   // index 3000
            { bas: 'B', aid: '2000', gapKr: 500,  n: 2 }    // index 1000
        ];
        const t = suggestTargets(cand, 2000);
        expect(t).toHaveLength(2);
        const a = t.find(x => x.bas === 'A'), b = t.find(x => x.bas === 'B');
        expect(a.value).toBe(1500);   // min(3000, 2000*0.75)
        expect(b.value).toBe(500);    // min(1000, 2000*0.25)
        expect(a.dist).toBe('lowest');
    });
    it('ignorerar grupper utan gap och tom pott', () => {
        expect(suggestTargets([{ bas: 'A', aid: '1', gapKr: 0, n: 5 }], 1000)).toEqual([]);
        expect(suggestTargets([{ bas: 'A', aid: '1', gapKr: 100, n: 5 }], 0)).toEqual([]);
    });
});

describe('forecast: riktning mot hela BAS (wildcard) + min-storlek', () => {
    const rowsW = () => [
        { bas: 'A', aid: '1', kon: 'man',    lon: 30000 },
        { bas: 'A', aid: '2', kon: 'kvinna', lon: 32000 },
        { bas: 'B', aid: '3', kon: 'man',    lon: 40000 }
    ];
    it('aid="*" fördelar på hela BAS, inte bara ett yrke', () => {
        const a = allocate(rowsW(), { mode: 'pct', value: 0 },
            [{ bas: 'A', aid: '*', mode: 'kr', value: 2000, dist: 'flat' }]);
        expect(a.totals.riktadCost).toBeCloseTo(2000, 6);
        expect(a.perPerson[0].delta).toBeGreaterThan(0);  // A/1
        expect(a.perPerson[1].delta).toBeGreaterThan(0);  // A/2
        expect(a.perPerson[2].delta).toBe(0);             // B/3 orörd
    });
    it('suggestTargets respekterar minN', () => {
        const cand = [
            { bas: 'A', aid: '1', gapKr: 1000, n: 4 },   // för liten
            { bas: 'A', aid: '2', gapKr: 1000, n: 20 }   // ok
        ];
        const t = suggestTargets(cand, 50000, 10);
        expect(t).toHaveLength(1);
        expect(t[0].aid).toBe('2');
    });
});

describe('forecast: summarizeGroups & detectLeapfrog', () => {
    it('summarizeGroups ger n, andel kvinnor och median per grupp', () => {
        const g = summarizeGroups(rows());
        const a = g.find(x => x.bas === 'A' && x.aid === '5301');
        expect(a.n).toBe(3);
        expect(a.kvN).toBe(2);
        expect(a.andelKv).toBeCloseTo(66.67, 1);
        expect(a.median).toBe(32000);
    });
    it('detectLeapfrog hittar grupp som går om en tidigare högre grupp', () => {
        const pg = [
            { bas: 'A', aid: '1', n: 5, gammalMedian: 30000, nyMedian: 36000, andelKv: 0, kostnad: 1 },
            { bas: 'A', aid: '2', n: 5, gammalMedian: 34000, nyMedian: 34000, andelKv: 0, kostnad: 0 }
        ];
        const l = detectLeapfrog(pg);
        expect(l).toHaveLength(1);
        expect(l[0].aid).toBe('1');
        expect(l[0].overAid).toBe('2');
    });
    it('ingen leapfrog när ordningen bevaras', () => {
        const pg = [
            { bas: 'A', aid: '1', n: 5, gammalMedian: 30000, nyMedian: 31000, andelKv: 0, kostnad: 1 },
            { bas: 'A', aid: '2', n: 5, gammalMedian: 34000, nyMedian: 34000, andelKv: 0, kostnad: 0 }
        ];
        expect(detectLeapfrog(pg)).toHaveLength(0);
    });
});

describe('forecast: jämställdhetsandel (equityCost)', () => {
    it('riktat lyft mot kvinnodominerad grupp räknas som equity', () => {
        const out = forecastOutcome(rows(), { mode: 'kr', value: 100000 }, { mode: 'pct', value: 0 },
            [{ bas: 'A', aid: '5301', mode: 'kr', value: 3000, dist: 'flat' }], { months: 12, poPct: 0 });
        // A/5301 = 2 kvinnor / 3 = 66,7 % ≥ 60 → hela riktade potten är equity
        expect(out.equityCost).toBeCloseTo(3000, 6);
        expect(out.riktadCost).toBeCloseTo(3000, 6);
    });
    it('lyft mot mansdominerad grupp räknas inte som equity', () => {
        const out = forecastOutcome(rows(), { mode: 'kr', value: 100000 }, { mode: 'pct', value: 0 },
            [{ bas: 'B', aid: '2000', mode: 'kr', value: 3000, dist: 'flat' }], { months: 12, poPct: 0 });
        // B/2000 = 1 kvinna / 2 = 50 % < 60 → ingen equity
        expect(out.equityCost).toBeCloseTo(0, 6);
    });
});

describe('forecast: avrundning till lönetrappa', () => {
    it('avrundar nya löner till närmaste steg, aldrig under ursprungslön', () => {
        const data = [{ bas: 'A', aid: '1', kon: 'man', lon: 30000 }];
        const a = allocate(data, { mode: 'kr', value: 1230 }, [], 100);
        expect(a.perPerson[0].nyLon).toBe(31200);   // 31230 → 31200
        expect(a.totals.totalRaise).toBe(1200);
    });
    it('rör inte individer utan påslag (delta = 0)', () => {
        const data = [{ bas: 'A', aid: '1', kon: 'man', lon: 30150 }];
        const a = allocate(data, { mode: 'pct', value: 0 }, [], 100);
        expect(a.perPerson[0].nyLon).toBe(30150);
        expect(a.totals.totalRaise).toBe(0);
    });
});

describe('forecast: mål-läge (closureTargets)', () => {
    it('stänger en andel av gapet → kostnad = andel × gapKr × n', () => {
        const cand = [{ bas: 'A', aid: '1', gapKr: 1000, n: 10 }];
        const t = closureTargets(cand, 0.5);
        expect(t).toHaveLength(1);
        expect(t[0].value).toBe(5000);   // 0,5 × 1000 × 10
        expect(t[0].dist).toBe('lowest');
    });
    it('respekterar minN och fraction=0', () => {
        const cand = [{ bas: 'A', aid: '1', gapKr: 1000, n: 4 }];
        expect(closureTargets(cand, 0.5, 10)).toEqual([]);
        expect(closureTargets([{ bas: 'A', aid: '1', gapKr: 1000, n: 20 }], 0)).toEqual([]);
    });
});

describe('forecast: stegvis plan (stagedPlan)', () => {
    it('rampar linjärt över N år med ackumulerad kostnad', () => {
        const data = rows();
        const a = allocate(data, { mode: 'pct', value: 0 },
            [{ bas: 'A', aid: '5301', mode: 'kr', value: 6000, dist: 'flat' }]);
        const plan = stagedPlan(data, a.perPerson, 3, { months: 12, poPct: 0 });
        expect(plan).toHaveLength(3);
        expect(plan[0].andelPct).toBeCloseTo(33.33, 1);
        expect(plan[2].andelPct).toBe(100);
        // år 3 kostar 3× år 1
        expect(plan[2].kumKostnad).toBeCloseTo(plan[0].kumKostnad * 3, 4);
    });
});

describe('forecast: lönespann (bandStats)', () => {
    it('P25/median/P75 per BAS', () => {
        const data = [
            { bas: 'A', aid: '1', kon: 'man', lon: 30000 },
            { bas: 'A', aid: '1', kon: 'man', lon: 32000 },
            { bas: 'A', aid: '1', kon: 'man', lon: 34000 }
        ];
        const b = bandStats(data);
        expect(b).toHaveLength(1);
        expect(b[0].p25).toBe(31000);
        expect(b[0].median).toBe(32000);
        expect(b[0].p75).toBe(33000);
    });
});

describe('forecast: individnivå-remediation (B)', () => {
    const data = () => [
        { bas: 'A', aid: '1', kon: 'man',    lon: 34000 },
        { bas: 'A', aid: '1', kon: 'man',    lon: 36000 },   // mäns median = 35000
        { bas: 'A', aid: '1', kon: 'kvinna', lon: 30000 },   // > 5% under 35000 → flaggas
        { bas: 'A', aid: '1', kon: 'kvinna', lon: 34000 }    // < 5% under → ej flaggad
    ];
    it('flaggar kvinnor under likalöne-benchmark och kostar lyftet', () => {
        const r = individualRemediation(data(), { gapPct: 5 });
        expect(r.count).toBe(1);
        expect(r.totalCost).toBe(5000);     // 35000 - 30000
        expect(r.perGroup[0]).toMatchObject({ bas: 'A', aid: '1', count: 1, cost: 5000 });
    });
    it('faller tillbaka till BAS-benchmark när yrket saknar män', () => {
        const rows = [
            { bas: 'A', aid: '1', kon: 'man', lon: 40000 },          // män finns i BAS men annat AID
            { bas: 'A', aid: '2', kon: 'kvinna', lon: 30000 }
        ];
        const r = individualRemediation(rows, { gapPct: 5 });
        expect(r.count).toBe(1);
        expect(r.flagged[0].kalla).toBe('bas');
        expect(r.flagged[0].benchmark).toBe(40000);
    });
});

describe('forecast: marknadspositionering (E)', () => {
    it('lyfter grupp under marknad × factor mot marknad', () => {
        const groups = [{ bas: 'A', aid: '1', n: 5, median: 30000 }];
        const market = new Map([['1', 35000]]);
        const t = marketTargets(groups, market, 1, 0);
        expect(t).toHaveLength(1);
        expect(t[0].value).toBe(25000);   // (35000-30000) × 5
        expect(t[0].pool).toBe('marknad');
    });
    it('hoppar över grupper över marknad eller under minN', () => {
        const groups = [{ bas: 'A', aid: '1', n: 2, median: 30000 }];
        expect(marketTargets(groups, new Map([['1', 35000]]), 1, 10)).toEqual([]);   // n<minN
        expect(marketTargets([{ bas: 'A', aid: '1', n: 5, median: 40000 }], new Map([['1', 35000]]), 1, 0)).toEqual([]);
    });
});

describe('forecast: budgetkänslighet (F)', () => {
    it('svep ger monotont ökande kostnad från 0', () => {
        const data = rows();
        const cand = [{ bas: 'A', aid: '5301', gapKr: 2000, n: 3 }];
        const curve = sensitivityCurve(data, cand, { months: 12, poPct: 0 }, 4);
        expect(curve).toHaveLength(5);
        expect(curve[0].kostnad).toBe(0);
        for (let i = 1; i < curve.length; i++) expect(curve[i].kostnad).toBeGreaterThanOrEqual(curve[i - 1].kostnad);
    });
});

describe('forecast: forecastOutcome', () => {
    it('budgetutnyttjande och total kostnad inkl. PO + period', () => {
        const out = forecastOutcome(rows(),
            { mode: 'pct', value: 2 }, { mode: 'pct', value: 2 }, [],
            { months: 12, poPct: 39.15 });
        expect(out.pott).toBeCloseTo(3480, 6);
        expect(out.använt).toBeCloseTo(3480, 6);
        expect(out.kvar).toBeCloseTo(0, 6);
        expect(out.overBudget).toBe(false);
        expect(out.totalKostnad).toBeCloseTo(3480 * 12 * 1.3915, 4);
        expect(out.lonsummaEfter).toBeCloseTo(177480, 6);
    });
    it('flaggar överbudget', () => {
        const out = forecastOutcome(rows(),
            { mode: 'kr', value: 1000 }, { mode: 'kr', value: 1000 }, [],
            { months: 12, poPct: 0 });
        expect(out.pott).toBe(1000);
        expect(out.använt).toBe(5000);     // 5 individer × 1000
        expect(out.kvar).toBe(-4000);
        expect(out.overBudget).toBe(true);
    });
});

// k-anonymitet: appen skickar gällande tröskel som minMen.
describe('forecast: individualRemediation — minsta antal män bakom ett benchmark', () => {
    const rader = () => [
        { bas: 'S3', aid: '7300', kon: 'kvinna', lon: 29417 }, { bas: 'S3', aid: '7300', kon: 'man', lon: 38963 },
        ...Array.from({ length: 12 }, (_, i) => ({ bas: 'A', aid: '6000', kon: 'man', lon: 40000 + i })),
        ...Array.from({ length: 12 }, (_, i) => ({ bas: 'A', aid: '6000', kon: 'kvinna', lon: i < 3 ? 31117 : 40000 + i })),
    ];
    it('standard (en man räcker): kostnaden för paret är hans lön minus hennes', () => {
        const r = individualRemediation(rader(), { gapPct: 5 });
        expect(r.perGroup.find(g => g.aid === '7300')).toMatchObject({ count: 1, cost: 38963 - 29417 });
    });
    it('minMen = 10: gruppen med en man jämförs inte alls; gruppen med 12 män gör det', () => {
        const r = individualRemediation(rader(), { gapPct: 5, minMen: 10 });
        expect(r.perGroup.map(g => g.aid)).toEqual(['6000']);
        expect(r.count).toBe(3);
        expect(r.totalCost).toBeCloseTo(3 * (40005.5 - 31117), 6);
    });
    it('minMen gäller också reservnivån (mäns median i BAS)', () => {
        const rows = [
            ...Array.from({ length: 5 }, (_, i) => ({ bas: 'B', aid: '1', kon: 'man', lon: 50000 + i })),
            ...Array.from({ length: 5 }, (_, i) => ({ bas: 'B', aid: '2', kon: 'man', lon: 50000 + i })),
            { bas: 'B', aid: '1', kon: 'kvinna', lon: 30000 },
        ];
        expect(individualRemediation(rows, { gapPct: 5, minMen: 10 }).perGroup[0]).toMatchObject({ aid: '1', count: 1 });   // 10 män i BAS
        expect(individualRemediation(rows, { gapPct: 5, minMen: 11 }).count).toBe(0);
    });
});

/**
 * Enhetstester för den rena löneöversyns-/prognosmodulen (src/lib/loneoversyn.js).
 * Verifierar pott-beräkning, de tre inom-grupp-metoderna (flat/lowest/target),
 * budgetutnyttjande, råa gapet före/efter och optimeringsheuristiken.
 */
import { describe, it, expect } from 'vitest';
import {
    lonesumma, beraknaPott, fordela, riktadeRader, raLonegap, foreslaRiktning, prognosutfall,
    sammanstallGrupper, hittaOmkorningar, stangningsriktning, stegvisPlan,
    lonespannPerBas, individlyft, marknadsriktning, kanslighetskurva, ettParPerYrke, pottArAngiven
} from '../src/lib/loneoversyn.js';
import { KVINNO_TROSKEL_STANDARD } from '../src/lib/likvardighet.js';

const rows = () => [
    { bas: 'A', aid: '5301', kon: 'kvinna', lon: 30000 },
    { bas: 'A', aid: '5301', kon: 'kvinna', lon: 32000 },
    { bas: 'A', aid: '5301', kon: 'man',    lon: 34000 },
    { bas: 'B', aid: '2000', kon: 'man',    lon: 40000 },
    { bas: 'B', aid: '2000', kon: 'kvinna', lon: 38000 }
];

describe('[B7.2] forecast: pott & lönesumma', () => {
    it('lonesumma summerar månadslöner', () => {
        expect(lonesumma(rows())).toBe(174000);
    });
    it('beraknaPott i krontal returnerar beloppet', () => {
        expect(beraknaPott(rows(), { mode: 'kr', value: 5000 })).toBe(5000);
    });
    it('beraknaPott i procent = andel av lönesumman', () => {
        expect(beraknaPott(rows(), { mode: 'pct', value: 2 })).toBeCloseTo(3480, 6);
    });
    it('negativ/saknad budget ger 0', () => {
        expect(beraknaPott(rows(), { mode: 'kr', value: -100 })).toBe(0);
        expect(beraknaPott(rows(), null)).toBe(0);
    });
});

describe('forecast: generellt påslag', () => {
    it('generellt procentpåslag till alla', () => {
        const a = fordela(rows(), { mode: 'pct', value: 2 }, []);
        expect(a.totals.generellCost).toBeCloseTo(3480, 6);
        expect(a.totals.riktadCost).toBe(0);
        expect(a.perPerson[0].nyLon).toBeCloseTo(30600, 6);
    });
    it('generellt krontal (flat) till varje individ', () => {
        const a = fordela(rows(), { mode: 'kr', value: 1000 }, []);
        expect(a.totals.generellCost).toBe(5000);   // 5 individer × 1000
        expect(a.perPerson[3].nyLon).toBe(41000);
    });
});

describe('forecast: riktat — kön, lönegräns och höj till', () => {
    const t = over => ({ bas: 'A', aid: '5301', mode: 'kr', value: 3000, dist: 'flat', ...over });
    it('riktadeRader: gruppen, snävad till kön och löner under gränsen', () => {
        expect(riktadeRader(rows(), t())).toEqual([0, 1, 2]);
        expect(riktadeRader(rows(), t({ kon: 'kvinna' }))).toEqual([0, 1]);
        expect(riktadeRader(rows(), t({ kon: 'man' }))).toEqual([2]);
        expect(riktadeRader(rows(), t({ lonCap: 32000 }))).toEqual([0]);
        expect(riktadeRader(rows(), t({ aid: '*', kon: 'alla', lonCap: null }))).toEqual([0, 1, 2]);
        expect(riktadeRader(rows(), t({ bas: 'B', aid: '*', kon: 'kvinna' }))).toEqual([4]);
    });
    it('bara kvinnor: potten fördelas bland kvinnorna, mannen får inget', () => {
        const a = fordela(rows(), { mode: 'pct', value: 0 }, [t({ kon: 'kvinna' })]);
        expect(a.perPerson[2].delta).toBe(0);
        expect(a.perPerson[0].delta + a.perPerson[1].delta).toBeCloseTo(3000, 6);
    });
    it('lönegräns: bara den under gränsen får påslaget', () => {
        const a = fordela(rows(), { mode: 'pct', value: 0 }, [t({ lonCap: 31000 })]);
        expect(a.perPerson.map(p => p.delta)).toEqual([3000, 0, 0, 0, 0]);
    });
    it('höj till: var och en under beloppet lyfts dit, de över rörs inte; fördelningen spelar ingen roll', () => {
        const a = fordela(rows(), { mode: 'pct', value: 0 }, [t({ mode: 'till', value: 31000, dist: 'lowest' })]);
        expect(a.perPerson.map(p => p.nyLon)).toEqual([31000, 32000, 34000, 40000, 38000]);
        expect(a.totals.riktadCost).toBe(1000);
    });
    it('en rad utan träff (kön som inte finns i gruppen) kostar inget', () => {
        const a = fordela(rows(), { mode: 'pct', value: 0 }, [t({ bas: 'B', aid: '2000', kon: 'kvinna', lonCap: 30000 })]);
        expect(a.totals.riktadCost).toBe(0);
    });
});

describe('forecast: riktat — inom-grupp-metoder', () => {
    const tgt = (over) => [{ bas: 'A', aid: '5301', mode: 'kr', value: 3000, ...over }];

    it('flat: lika procent, hela potten används', () => {
        const a = fordela(rows(), { mode: 'pct', value: 0 }, tgt({ dist: 'flat' }));
        expect(a.totals.riktadCost).toBeCloseTo(3000, 6);
        // frac = 3000/96000 = 0.03125
        expect(a.perPerson[0].delta).toBeCloseTo(937.5, 6);
        expect(a.perPerson[2].delta).toBeCloseTo(1062.5, 6);
    });

    it('lowest: water-filling lyfter de lägst betalda först', () => {
        const a = fordela(rows(), { mode: 'pct', value: 0 }, tgt({ dist: 'lowest' }));
        expect(a.totals.riktadCost).toBeCloseTo(3000, 6);
        expect(a.perPerson[0].delta).toBeCloseTo(2500, 6);  // 30000 -> 32500
        expect(a.perPerson[1].delta).toBeCloseTo(500, 6);   // 32000 -> 32500
        expect(a.perPerson[2].delta).toBe(0);               // 34000 oförändrad
    });

    it('target (median): kapar vid målnivån, leftover används ej', () => {
        const a = fordela(rows(), { mode: 'pct', value: 0 },
            tgt({ dist: 'target', targetLevel: 'median', value: 5000 }));
        // median(A) = 32000; bara den lägsta lyfts till 32000 = 2000 kr, resten oanvänt
        expect(a.perPerson[0].delta).toBeCloseTo(2000, 6);
        expect(a.perPerson[1].delta).toBe(0);
        expect(a.totals.riktadCost).toBeCloseTo(2000, 6);
    });
});

describe('forecast: råa gapet före/efter', () => {
    it('riktat lyft mot kvinnor minskar gapet', () => {
        const before = raLonegap(rows(), r => r.lon);     // median kv 31000 / median ma ~37000
        const a = fordela(rows(), { mode: 'pct', value: 0 },
            [{ bas: 'A', aid: '5301', mode: 'kr', value: 6000, dist: 'flat' }]);
        const after = raLonegap(a.perPerson, p => p.nyLon);
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
        const t = foreslaRiktning(cand, 2000);
        expect(t).toHaveLength(2);
        const a = t.find(x => x.bas === 'A'), b = t.find(x => x.bas === 'B');
        expect(a.value).toBe(1500);   // min(3000, 2000*0.75)
        expect(b.value).toBe(500);    // min(1000, 2000*0.25)
        expect(a.dist).toBe('lowest');
    });
    it('ignorerar grupper utan gap och tom pott', () => {
        expect(foreslaRiktning([{ bas: 'A', aid: '1', gapKr: 0, n: 5 }], 1000)).toEqual([]);
        expect(foreslaRiktning([{ bas: 'A', aid: '1', gapKr: 100, n: 5 }], 0)).toEqual([]);
    });
});

describe('forecast: riktning mot hela BAS (wildcard) + min-storlek', () => {
    const rowsW = () => [
        { bas: 'A', aid: '1', kon: 'man',    lon: 30000 },
        { bas: 'A', aid: '2', kon: 'kvinna', lon: 32000 },
        { bas: 'B', aid: '3', kon: 'man',    lon: 40000 }
    ];
    it('aid="*" fördelar på hela BAS, inte bara ett yrke', () => {
        const a = fordela(rowsW(), { mode: 'pct', value: 0 },
            [{ bas: 'A', aid: '*', mode: 'kr', value: 2000, dist: 'flat' }]);
        expect(a.totals.riktadCost).toBeCloseTo(2000, 6);
        expect(a.perPerson[0].delta).toBeGreaterThan(0);  // A/1
        expect(a.perPerson[1].delta).toBeGreaterThan(0);  // A/2
        expect(a.perPerson[2].delta).toBe(0);             // B/3 orörd
    });
    it('foreslaRiktning respekterar minN', () => {
        const cand = [
            { bas: 'A', aid: '1', gapKr: 1000, n: 4 },   // för liten
            { bas: 'A', aid: '2', gapKr: 1000, n: 20 }   // ok
        ];
        const t = foreslaRiktning(cand, 50000, 10);
        expect(t).toHaveLength(1);
        expect(t[0].aid).toBe('2');
    });
});

describe('forecast: sammanstallGrupper & hittaOmkorningar', () => {
    it('sammanstallGrupper ger n, andel kvinnor och median per grupp', () => {
        const g = sammanstallGrupper(rows());
        const a = g.find(x => x.bas === 'A' && x.aid === '5301');
        expect(a.n).toBe(3);
        expect(a.kvN).toBe(2);
        expect(a.andelKv).toBeCloseTo(66.67, 1);
        expect(a.median).toBe(32000);
    });
    it('hittaOmkorningar hittar grupp som går om en tidigare högre grupp', () => {
        const pg = [
            { bas: 'A', aid: '1', n: 5, gammalMedian: 30000, nyMedian: 36000, andelKv: 0, kostnad: 1 },
            { bas: 'A', aid: '2', n: 5, gammalMedian: 34000, nyMedian: 34000, andelKv: 0, kostnad: 0 }
        ];
        const l = hittaOmkorningar(pg);
        expect(l).toHaveLength(1);
        expect(l[0].aid).toBe('1');
        expect(l[0].overAid).toBe('2');
    });
    it('ingen leapfrog när ordningen bevaras', () => {
        const pg = [
            { bas: 'A', aid: '1', n: 5, gammalMedian: 30000, nyMedian: 31000, andelKv: 0, kostnad: 1 },
            { bas: 'A', aid: '2', n: 5, gammalMedian: 34000, nyMedian: 34000, andelKv: 0, kostnad: 0 }
        ];
        expect(hittaOmkorningar(pg)).toHaveLength(0);
    });
});

describe('forecast: jämställdhetsandel (equityCost)', () => {
    it('riktat lyft mot kvinnodominerad grupp räknas som equity', () => {
        const out = prognosutfall(rows(), { mode: 'kr', value: 100000 }, { mode: 'pct', value: 0 },
            [{ bas: 'A', aid: '5301', mode: 'kr', value: 3000, dist: 'flat' }], { months: 12, poPct: 0 });
        // A/5301 = 2 kvinnor / 3 = 66,7 % ≥ 60 → hela riktade potten är equity
        expect(out.equityCost).toBeCloseTo(3000, 6);
        expect(out.riktadCost).toBeCloseTo(3000, 6);
    });
    it('lyft mot mansdominerad grupp räknas inte som equity', () => {
        const out = prognosutfall(rows(), { mode: 'kr', value: 100000 }, { mode: 'pct', value: 0 },
            [{ bas: 'B', aid: '2000', mode: 'kr', value: 3000, dist: 'flat' }], { months: 12, poPct: 0 });
        // B/2000 = 1 kvinna / 2 = 50 % < 60 → ingen equity
        expect(out.equityCost).toBeCloseTo(0, 6);
    });
    it('följer definitionen av kvinnodominerat (ADR-60): 50 % med gränsen 50 är kvinnodominerat bara med *50 % eller mer*', () => {
        const mal = [{ bas: 'B', aid: '2000', mode: 'kr', value: 3000, dist: 'flat' }];
        const scb = prognosutfall(rows(), { mode: 'kr', value: 100000 }, { mode: 'pct', value: 0 }, mal, { months: 12, poPct: 0, kvThreshold: 50, kvDefinition: 'scb' });
        expect(scb.equityCost).toBeCloseTo(3000, 6);
        const dO = prognosutfall(rows(), { mode: 'kr', value: 100000 }, { mode: 'pct', value: 0 }, mal, { months: 12, poPct: 0, kvThreshold: 50, kvDefinition: 'do' });
        expect(dO.equityCost).toBeCloseTo(0, 6);
    });
});

describe('forecast: avrundning till lönetrappa', () => {
    it('avrundar nya löner till närmaste steg, aldrig under ursprungslön', () => {
        const data = [{ bas: 'A', aid: '1', kon: 'man', lon: 30000 }];
        const a = fordela(data, { mode: 'kr', value: 1230 }, [], 100);
        expect(a.perPerson[0].nyLon).toBe(31200);   // 31230 → 31200
        expect(a.totals.totalRaise).toBe(1200);
    });
    it('rör inte individer utan påslag (delta = 0)', () => {
        const data = [{ bas: 'A', aid: '1', kon: 'man', lon: 30150 }];
        const a = fordela(data, { mode: 'pct', value: 0 }, [], 100);
        expect(a.perPerson[0].nyLon).toBe(30150);
        expect(a.totals.totalRaise).toBe(0);
    });
});

describe('forecast: mål-läge (stangningsriktning)', () => {
    it('stänger en andel av gapet → kostnad = andel × gapKr × n', () => {
        const cand = [{ bas: 'A', aid: '1', gapKr: 1000, n: 10 }];
        const t = stangningsriktning(cand, 0.5);
        expect(t).toHaveLength(1);
        expect(t[0].value).toBe(5000);   // 0,5 × 1000 × 10
        expect(t[0].dist).toBe('lowest');
    });
    it('respekterar minN och fraction=0', () => {
        const cand = [{ bas: 'A', aid: '1', gapKr: 1000, n: 4 }];
        expect(stangningsriktning(cand, 0.5, 10)).toEqual([]);
        expect(stangningsriktning([{ bas: 'A', aid: '1', gapKr: 1000, n: 20 }], 0)).toEqual([]);
    });
});

describe('[B7.7] forecast: stegvis plan (stegvisPlan)', () => {
    it('rampar linjärt över N år med ackumulerad kostnad', () => {
        const data = rows();
        const a = fordela(data, { mode: 'pct', value: 0 },
            [{ bas: 'A', aid: '5301', mode: 'kr', value: 6000, dist: 'flat' }]);
        const plan = stegvisPlan(data, a.perPerson, 3, { months: 12, poPct: 0 });
        expect(plan).toHaveLength(3);
        expect(plan[0].andelPct).toBeCloseTo(33.33, 1);
        expect(plan[2].andelPct).toBe(100);
        // år 3 kostar 3× år 1
        expect(plan[2].kumKostnad).toBeCloseTo(plan[0].kumKostnad * 3, 4);
    });
});

describe('forecast: lönespann (lonespannPerBas)', () => {
    it('P25/median/P75 per BAS', () => {
        const data = [
            { bas: 'A', aid: '1', kon: 'man', lon: 30000 },
            { bas: 'A', aid: '1', kon: 'man', lon: 32000 },
            { bas: 'A', aid: '1', kon: 'man', lon: 34000 }
        ];
        const b = lonespannPerBas(data);
        expect(b).toHaveLength(1);
        expect(b[0].p25).toBe(31000);
        expect(b[0].median).toBe(32000);
        expect(b[0].p75).toBe(33000);
    });
});

describe('forecast: lyft på individnivå mot likalönejämförelsen', () => {
    const data = () => [
        { bas: 'A', aid: '1', kon: 'man',    lon: 34000 },
        { bas: 'A', aid: '1', kon: 'man',    lon: 36000 },   // mäns median = 35000
        { bas: 'A', aid: '1', kon: 'kvinna', lon: 30000 },   // > 5% under 35000 → flaggas
        { bas: 'A', aid: '1', kon: 'kvinna', lon: 34000 }    // < 5% under → ej flaggad
    ];
    it('flaggar kvinnor under likalöne-benchmark och kostar lyftet', () => {
        const r = individlyft(data(), { gapPct: 5 });
        expect(r.count).toBe(1);
        expect(r.totalCost).toBe(5000);     // 35000 - 30000
        expect(r.perGroup[0]).toMatchObject({ bas: 'A', aid: '1', count: 1, cost: 5000 });
    });
    it('faller tillbaka till BAS-benchmark när yrket saknar män', () => {
        const rows = [
            { bas: 'A', aid: '1', kon: 'man', lon: 40000 },          // män finns i BAS men annat AID
            { bas: 'A', aid: '2', kon: 'kvinna', lon: 30000 }
        ];
        const r = individlyft(rows, { gapPct: 5 });
        expect(r.count).toBe(1);
        expect(r.flagged[0].kalla).toBe('bas');
        expect(r.flagged[0].benchmark).toBe(40000);
    });
});

describe('forecast: marknadspositionering', () => {
    it('lyfter grupp under marknad × factor mot marknad', () => {
        const groups = [{ bas: 'A', aid: '1', n: 5, median: 30000 }];
        const market = new Map([['1', 35000]]);
        const t = marknadsriktning(groups, market, 1, 0);
        expect(t).toHaveLength(1);
        expect(t[0].value).toBe(25000);   // (35000-30000) × 5
        expect(t[0].pool).toBe('marknad');
    });
    it('hoppar över grupper över marknad eller under minN', () => {
        const groups = [{ bas: 'A', aid: '1', n: 2, median: 30000 }];
        expect(marknadsriktning(groups, new Map([['1', 35000]]), 1, 10)).toEqual([]);   // n<minN
        expect(marknadsriktning([{ bas: 'A', aid: '1', n: 5, median: 40000 }], new Map([['1', 35000]]), 1, 0)).toEqual([]);
    });
});

// ADR-69: ett kandidatpar per kvinnodominerat yrke (BAS-intervall och AID), det med störst skillnad, så att ett yrke
// med flera jämförelseyrken får en rad och en pott, inte en per jämförelseyrke.
describe('[B7.6] forecast: ett par per yrke i förslagen (ADR-69)', () => {
    const cand = [
        { bas: 'C', aid: '5300', gapKr: 14952, n: 12, maN: 24 },
        { bas: 'C', aid: '5300', gapKr: 21690, n: 12, maN: 12 },
        { bas: 'D', aid: '5400', gapKr: 500, n: 20, maN: 30 },
    ];
    it('ettParPerYrke behåller paret med störst skillnad per yrke, i ursprunglig ordning', () => {
        expect(ettParPerYrke(cand)).toEqual([cand[1], cand[2]]);
        expect(ettParPerYrke([])).toEqual([]);
        expect(ettParPerYrke(undefined)).toEqual([]);
    });
    it('foreslaRiktning ger en rad per yrke, räknad ur paret med störst skillnad', () => {
        const t = foreslaRiktning(cand, 10000000);
        expect(t.map(x => [x.aid, x.value])).toEqual([['5300', 21690 * 12], ['5400', 500 * 20]]);
    });
    it('stangningsriktning och känslighetskurvan räknar också ett par per yrke', () => {
        expect(stangningsriktning(cand, 1).map(x => [x.aid, x.value])).toEqual([['5300', 21690 * 12], ['5400', 500 * 20]]);
        const data = [];
        for (let i = 0; i < 12; i++) data.push({ bas: 'C', aid: '5300', kon: 'kvinna', lon: 36421 });
        for (let i = 0; i < 20; i++) data.push({ bas: 'D', aid: '5400', kon: 'kvinna', lon: 30000 });
        const kurva = kanslighetskurva(data, cand, { months: 1, poPct: 0 }, 1);
        expect(kurva[1].kostnad).toBe(21690 * 12 + 500 * 20);
        // Minsta antal personer i gruppen gäller som i knappen: yrket med 12 personer faller bort vid 15.
        expect(kanslighetskurva(data, cand, { months: 1, poPct: 0 }, 1, 15)[1].kostnad).toBe(500 * 20);
        expect(stangningsriktning(cand, 1, 15).map(x => x.aid)).toEqual(['5400']);
    });
});

describe('forecast: budgetkänslighet', () => {
    it('svep ger monotont ökande kostnad från 0', () => {
        const data = rows();
        const cand = [{ bas: 'A', aid: '5301', gapKr: 2000, n: 3 }];
        const curve = kanslighetskurva(data, cand, { months: 12, poPct: 0 }, 4);
        expect(curve).toHaveLength(5);
        expect(curve[0].kostnad).toBe(0);
        for (let i = 1; i < curve.length; i++) expect(curve[i].kostnad).toBeGreaterThanOrEqual(curve[i - 1].kostnad);
    });
});

describe('[B7.4] forecast: prognosutfall', () => {
    it('budgetutnyttjande och total kostnad inkl. PO + period', () => {
        const out = prognosutfall(rows(),
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
        const out = prognosutfall(rows(),
            { mode: 'kr', value: 1000 }, { mode: 'kr', value: 1000 }, [],
            { months: 12, poPct: 0 });
        expect(out.pott).toBe(1000);
        expect(out.använt).toBe(5000);     // 5 individer × 1000
        expect(out.kvar).toBe(-4000);
        expect(out.overBudget).toBe(true);
        expect(out.pottAngiven).toBe(true);
    });
    // Ingen budget angiven är ett eget läge: ingen pott att överskrida och inget kvar att räkna.
    it('utan angiven pott: pottAngiven falskt, kvar null och ingen överskridning, fast något fördelas', () => {
        for (const budget of [{ mode: 'kr', value: null }, { mode: 'pct', value: null }, null]) {
            const out = prognosutfall(rows(), budget, { mode: 'kr', value: 1000 }, [], { months: 12, poPct: 0 });
            expect(out.pottAngiven).toBe(false);
            expect(out.pott).toBe(0);
            expect(out.använt).toBe(5000);
            expect(out.kvar).toBeNull();
            expect(out.overBudget).toBe(false);
        }
    });
    it('en angiven pott på 0 kr flaggas när något fördelas, men inte när inget fördelas', () => {
        const med = prognosutfall(rows(), { mode: 'kr', value: 0 }, { mode: 'kr', value: 1000 }, [], { months: 12, poPct: 0 });
        expect(med).toMatchObject({ pottAngiven: true, pott: 0, kvar: -5000, overBudget: true });
        const utan = prognosutfall(rows(), { mode: 'pct', value: 0 }, { mode: 'kr', value: 0 }, [], { months: 12, poPct: 0 });
        expect(utan).toMatchObject({ pottAngiven: true, pott: 0, kvar: 0, overBudget: false });
    });
    it('pottArAngiven: ett tal, också 0, är en angiven pott; null, NaN och ingen budget är det inte', () => {
        expect(pottArAngiven({ mode: 'kr', value: 0 })).toBe(true);
        expect(pottArAngiven({ mode: 'pct', value: 2.5 })).toBe(true);
        expect(pottArAngiven({ mode: 'kr', value: null })).toBe(false);
        expect(pottArAngiven({ mode: 'kr', value: NaN })).toBe(false);
        expect(pottArAngiven(null)).toBe(false);
    });
    // Gränsen för kvinnodominerat: saknas den gäller standardgränsen ur likvardighet.js; 0 är en gräns som alla
    // grupper med någon kvinna går över.
    it('kvThreshold: saknad gräns ger standardgränsen, gränsen 0 är 0', () => {
        const gen = { mode: 'kr', value: 1000 };
        const utan = prognosutfall(rows(), null, gen, [], { months: 12, poPct: 0 });
        const standard = prognosutfall(rows(), null, gen, [], { months: 12, poPct: 0, kvThreshold: KVINNO_TROSKEL_STANDARD });
        expect(utan.equityCost).toBe(standard.equityCost);
        expect(utan.equityCost).toBe(3000);   // 5301 (2 av 3 kvinnor, 67 %); 2000 har 50 %
        const noll = prognosutfall(rows(), null, gen, [], { months: 12, poPct: 0, kvThreshold: 0 });
        expect(noll.equityCost).toBe(5000);   // båda grupperna har mer än 0 % kvinnor
    });
});

// k-anonymitet: appen skickar gällande tröskel som minMen.
describe('[B7.8] forecast: individlyft — minsta antal män bakom ett benchmark', () => {
    const rader = () => [
        { bas: 'S3', aid: '7300', kon: 'kvinna', lon: 29417 }, { bas: 'S3', aid: '7300', kon: 'man', lon: 38963 },
        ...Array.from({ length: 12 }, (_, i) => ({ bas: 'A', aid: '6000', kon: 'man', lon: 40000 + i })),
        ...Array.from({ length: 12 }, (_, i) => ({ bas: 'A', aid: '6000', kon: 'kvinna', lon: i < 3 ? 31117 : 40000 + i })),
    ];
    it('standard (en man räcker): kostnaden för paret är hans lön minus hennes', () => {
        const r = individlyft(rader(), { gapPct: 5 });
        expect(r.perGroup.find(g => g.aid === '7300')).toMatchObject({ count: 1, cost: 38963 - 29417 });
    });
    it('minMen = 10: gruppen med en man jämförs inte alls; gruppen med 12 män gör det', () => {
        const r = individlyft(rader(), { gapPct: 5, minMen: 10 });
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
        expect(individlyft(rows, { gapPct: 5, minMen: 10 }).perGroup[0]).toMatchObject({ aid: '1', count: 1 });   // 10 män i BAS
        expect(individlyft(rows, { gapPct: 5, minMen: 11 }).count).toBe(0);
    });
});

describe('[B7.3] fordela: lägst först (water-filling) med fem löner', () => {
    // Löner 10 000, 12 000, 14 000, 16 000, 20 000. Vattenytan stiger från den lägsta lönen upp till nästa brytpunkt.
    const femLoner = () => [10000, 12000, 14000, 16000, 20000].map(lon => ({ bas: 'A', aid: '1', kon: 'man', lon }));
    const riktat = (value) => [{ bas: 'A', aid: '1', mode: 'kr', value, dist: 'lowest' }];

    it('pott 5 000: vattenytan når 13 500; de två lägsta lyfts, resten rörs inte', () => {
        // Brytpunkt 12 000 kostar 2 000 (en person); sedan 2 × (14 000 − 12 000) = 4 000 → totalt 6 000 > 5 000.
        // Kvar 3 000 fördelas på två personer: 1 500 var → L = 12 000 + 1 500 = 13 500.
        const a = fordela(femLoner(), { mode: 'pct', value: 0 }, riktat(5000));
        expect(a.perPerson.map(p => p.delta)).toEqual([3500, 1500, 0, 0, 0]);
        expect(a.totals.riktadCost).toBeCloseTo(5000, 6);
    });
    it('pott 2 000 tar slut exakt på brytpunkten 12 000: bara den lägsta lyfts', () => {
        const a = fordela(femLoner(), { mode: 'pct', value: 0 }, riktat(2000));
        expect(a.perPerson.map(p => p.delta)).toEqual([2000, 0, 0, 0, 0]);
        expect(a.perPerson[0].nyLon).toBe(12000);
    });
    it('pott 6 000 tar slut exakt på brytpunkten 14 000: de två lägsta når 14 000', () => {
        const a = fordela(femLoner(), { mode: 'pct', value: 0 }, riktat(6000));
        expect(a.perPerson.map(p => p.delta)).toEqual([4000, 2000, 0, 0, 0]);
        expect(a.perPerson[1].nyLon).toBe(14000);
    });
});

describe('fordela: tak vid median eller P25', () => {
    const femLoner = () => [10000, 12000, 14000, 16000, 20000].map(lon => ({ bas: 'A', aid: '1', kon: 'man', lon }));
    const tak = value => [{ bas: 'A', aid: '1', mode: 'kr', value, dist: 'target', targetLevel: 'median' }];

    it('pott 10 000 kapas vid medianen 14 000: de två lägsta lyfts dit (6 000), resten av potten används inte', () => {
        const a = fordela(femLoner(), { mode: 'pct', value: 0 }, tak(10000));
        expect(a.perPerson.map(p => p.delta)).toEqual([4000, 2000, 0, 0, 0]);
        expect(a.totals.riktadCost).toBeCloseTo(6000, 6);
    });
    it('pott 3 000 under taket: vattenytan 12 500 utan att nå medianen', () => {
        const a = fordela(femLoner(), { mode: 'pct', value: 0 }, tak(3000));
        expect(a.perPerson.map(p => p.delta)).toEqual([2500, 500, 0, 0, 0]);
    });
    it('tak vid BAS P25 (12 000): bara den lägsta lyfts dit (2 000), resten av potten används inte', () => {
        const a = fordela(femLoner(), { mode: 'pct', value: 0 }, [{ ...tak(10000)[0], targetLevel: 'p25' }]);
        expect(a.perPerson.map(p => p.delta)).toEqual([2000, 0, 0, 0, 0]);
        expect(a.totals.riktadCost).toBeCloseTo(2000, 6);
    });
});

describe('fordela: avrundning till lönesteg (roundStep 100)', () => {
    it('påslaget 40 kr på 30 000 rundas nedåt till 0: ingen höjning alls', () => {
        const data = [{ bas: 'A', aid: '1', kon: 'man', lon: 30000 }];
        const a = fordela(data, { mode: 'kr', value: 40 }, [], 100);
        expect(a.perPerson[0].nyLon).toBe(30000);
        expect(a.perPerson[0].delta).toBe(0);
        expect(a.totals.totalRaise).toBe(0);
        expect(a.totals.generellCost).toBe(40);
    });
    it('påslaget 50 kr på 30 000 rundas uppåt till 100 kr: summan (200) överstiger den generella potten (100)', () => {
        const data = [{ bas: 'A', aid: '1', kon: 'man', lon: 30000 }, { bas: 'A', aid: '1', kon: 'kvinna', lon: 30000 }];
        const a = fordela(data, { mode: 'kr', value: 50 }, [], 100);
        expect(a.perPerson.map(p => p.nyLon)).toEqual([30100, 30100]);
        expect(a.totals.generellCost).toBe(100);
        expect(a.totals.totalRaise).toBe(200);
    });
    it('riktat påslag avrundas men riktadCost visar det oavrundade: 950 kr på 30 000 blir 1 000 kr', () => {
        const data = [{ bas: 'A', aid: '1', kon: 'man', lon: 30000 }];
        const a = fordela(data, { mode: 'pct', value: 0 }, [{ bas: 'A', aid: '1', mode: 'till', value: 30950 }], 100);
        expect(a.perPerson[0].nyLon).toBe(31000);
        expect(a.totals.riktadCost).toBe(950);
        expect(a.totals.totalRaise).toBe(1000);
    });
});

describe('fordela: höj till', () => {
    const data = () => [
        { bas: 'A', aid: '1', kon: 'man', lon: 30000 },
        { bas: 'A', aid: '1', kon: 'kvinna', lon: 31000 },
        { bas: 'A', aid: '1', kon: 'kvinna', lon: 32000 }
    ];
    it('lön exakt lika med målet får ingen höjning (jämförelsen är strikt <)', () => {
        const a = fordela(data(), { mode: 'pct', value: 0 }, [{ bas: 'A', aid: '1', mode: 'till', value: 31000 }]);
        expect(a.perPerson.map(p => p.delta)).toEqual([1000, 0, 0]);
    });
    it('varje individ under målet lyfts till målet, ingen pott att fördela: kostnaden är summan av skillnaderna', () => {
        const a = fordela(data(), { mode: 'pct', value: 0 }, [{ bas: 'A', aid: '1', mode: 'till', value: 33000 }]);
        expect(a.perPerson.map(p => p.nyLon)).toEqual([33000, 33000, 33000]);
        expect(a.totals.riktadCost).toBe(3000 + 2000 + 1000);
    });
    it('mål 0 eller lägre lyfter ingen', () => {
        const a = fordela(data(), { mode: 'pct', value: 0 }, [{ bas: 'A', aid: '1', mode: 'till', value: 0 }]);
        expect(a.totals.riktadCost).toBe(0);
    });
});

/**
 * Lib-tester för src/lib/prioritering.js, direkt mot modulen (utan jsdom och utan appen).
 *
 * Fixturerna är små och handgjorda, så varje förväntat tal går att räkna för hand.
 * Att adaptern i 55-prioritering.js delegerar hit vaktas i drift.test.js.
 */
import { describe, it, expect } from 'vitest';
import { prioritera, prioIndex, prioKonstanter, motiveringsgrunder, prioNyckeltal, kostnadskurva } from '../src/lib/prioritering.js';
import { jamforelseRader } from '../src/lib/jamforelse.js';

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

describe('[B7.10] prioritera: gruppering och k-regel', () => {
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

// Gruppen är AID-koden och BAS-intervallet, som i jämförelsen och gruppdossiern, inte hela texten i fältet för
// AID-etikett: två stavningar av samma etikett är en grupp.
describe('prioritera: gruppen är AID-koden och BAS-intervallet', () => {
    // 207011 i BAS C med två texter: 4 kvinnor och 4 män (30 000 och 32 000), och 4 kvinnor och 3 män (31 000 och 33 000).
    const forsta = grupp('207011 Handläggare', 'C', 30000, 4, 32000, 4);
    const andra = grupp('207011 Handläggare, natt', 'C', 31000, 4, 33000, 3);
    const opt = { referensFor: ref({ '207011': 35000 }) };
    it('var för sig är delgrupperna under tröskeln (8 och 7 personer) och ger ingen post', () => {
        expect(kör(forsta, opt)).toEqual([]);
        expect(kör(andra, opt)).toEqual([]);
    });
    it('tillsammans en grupp på 15 med medianen, namnet och avvikelsen för hela koden', () => {
        const res = kör([...forsta, ...andra], opt);
        expect(res).toHaveLength(1);
        const [g] = res;
        expect([g.aid, g.bas, g.n, g.kvN, g.maN]).toEqual(['207011', 'C', 15, 8, 7]);
        expect(g.yrke).toBe('207011 Handläggare');   // texten på flest av gruppens rader (8 mot 7)
        // De 15 lönerna sorterade: 30 000 ×4, 31 000 ×4, 32 000 ×4, 33 000 ×3; den åttonde är 31 000.
        expect(g.median).toBe(31000);
        expect(g.diffKr).toBe(-4000);
        expect(g.diffPct).toBe(-4000 * 100 / 35000);
        expect([g.medKv, g.medMa, g.gapPct]).toEqual([null, null, null]);   // ett kön under tröskeln
        expect(g._rows).toHaveLength(15);
    });
    it('med den andra texten först heter gruppen ändå efter texten på flest rader; talen är desamma', () => {
        const [a] = kör([...forsta, ...andra], opt), [b] = kör([...andra, ...forsta], opt);
        expect(b.yrke).toBe('207011 Handläggare');
        expect({ ...b, _rows: null }).toEqual({ ...a, _rows: null });
    });
    it('samma grupper och namn som jamforelseRader', () => {
        const rader = [...forsta, ...andra, ...grupp('207011 Handläggare', 'D', 36000, 6, 36000, 6)];
        const prio = kör(rader, { referensFor: () => ({ median: 35000, kalla: 'x' }) });
        const jmf = jamforelseRader(rader, { k: 10 }).rader;
        const nycklar = l => l.map(g => `${g.aid}|${g.bas}|${g.yrke}|${g.n}`).sort();
        expect(nycklar(prio)).toEqual(nycklar(jmf));
    });
    it('rader utan kod grupperas på hela texten, som förut', () => {
        const rader = [...grupp('Ingen kod', 'B', 30000, 6, 31000, 6), ...grupp('Ingen kod, natt', 'B', 30000, 6, 31000, 6)];
        const res = kör(rader, { referensFor: () => ({ median: 35000, kalla: 'x' }) });
        expect(res.map(g => g.aid).sort()).toEqual(['Ingen kod', 'Ingen kod, natt']);
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

describe('prioritera: statusgränser och tröskelvärden (characterization)', () => {
    const REF = 40000;
    const referens = () => ({ median: REF, kalla: 'testref' });
    // Alla i gruppen har samma lön, så gruppmedianen är lönen och avvikelsen = (lön / 40 000 − 1) × 100.
    const enGrupp = (lon, n = 12, kTroskel = 10) => {
        const rader = grupp('5301 Undersköterska', 'B', lon, Math.ceil(n / 2), lon, Math.floor(n / 2));
        return prioritera(rader, { referensFor: referens, kTroskel, prioConfig: CONFIG, prioWeights: VIKTER, costSettings: KOST, bristAids: new Set() });
    };

    it('−5,1 % (under atgard) med n = 12 blir akut', () => {
        expect(enGrupp(37960)[0].status).toBe('akut');
    });
    it('−4,9 % (över atgard, under bevaka) blir bevaka', () => {
        expect(enGrupp(38040)[0].status).toBe('bevaka');
    });
    it('−1,9 % (över bevaka) blir ok', () => {
        expect(enGrupp(39240)[0].status).toBe('ok');
    });
    it('0 % blir ok', () => {
        expect(enGrupp(REF)[0].status).toBe('ok');
    });
    it('+4,9 % (under analysera) blir ok', () => {
        expect(enGrupp(41960)[0].status).toBe('ok');
    });
    it('+5,1 % (över analysera) blir analysera', () => {
        expect(enGrupp(42040)[0].status).toBe('analysera');
    });
    it('akut kräver n ≥ akutMinN: −6 % med n = 9 blir atgard, med n = 10 blir akut', () => {
        expect(enGrupp(37600, 9, 9)[0].status).toBe('atgard');
        expect(enGrupp(37600, 10, 10)[0].status).toBe('akut');
    });
    it('exakt −5 % (38 000 mot 40 000) är inte under gränsen −5 och blir bevaka', () => {
        const [item] = enGrupp(38000);
        expect(item.diffPct).toBe(-5);
        expect(item.status).toBe('bevaka');
    });
    it('exakt −2 % (39 200 mot 40 000) är inte under gränsen −2 och blir ok', () => {
        const [item] = enGrupp(39200);
        expect(item.diffPct).toBe(-2);
        expect(item.status).toBe('ok');
    });
    it('exakt +5 % (42 000 mot 40 000) är inte över gränsen 5 och blir ok', () => {
        const [item] = enGrupp(42000);
        expect(item.diffPct).toBe(5);
        expect(item.status).toBe('ok');
    });
    it('en gruppmedian exakt på en gräns klassas aldrig bortom den (referens 20 000–80 000 i steg om 100)', () => {
        // −7 och +7 är med för att (median / referens − 1) × 100 och (median − referens) / referens × 100 ger
        // 7,000000000000001 där; formen med en enda division håller för alla gränser.
        const forvantad = { '-5': 'bevaka', '-2': 'ok', '5': 'ok', '-7': 'akut', '7': 'analysera' };
        const fel = [];
        for (const t of [-5, -2, 5, -7, 7]) {
            for (let refMedian = 20000; refMedian <= 80000; refMedian += 100) {
                const lon = refMedian * (100 + t) / 100;
                if (!Number.isInteger(lon)) continue;
                const rader = grupp('5301 Undersköterska', 'B', lon, 6, lon, 6);
                const [item] = prioritera(rader, { referensFor: () => ({ median: refMedian, kalla: 'testref' }), kTroskel: 10,
                    prioConfig: CONFIG, prioWeights: VIKTER, costSettings: KOST, bristAids: new Set() });
                if (item.diffPct !== t) fel.push(`${lon} mot ${refMedian}: ${item.diffPct}`);
                // ±7 ligger bortom gränserna och visar bara att talet blir exakt; ±5 och −2 ligger på dem.
                if (item.status !== forvantad[String(t)]) fel.push(`${lon} mot ${refMedian}: ${item.status}`);
            }
        }
        expect(fel).toEqual([]);
    });
    it('gruppen med n = kTroskel tas med, n = kTroskel − 1 hoppas över', () => {
        expect(enGrupp(37960, 10, 10)).toHaveLength(1);
        expect(enGrupp(37960, 9, 10)).toHaveLength(0);
    });
});

describe('prioIndex: viktsumma 0 (characterization)', () => {
    it('alla vikter 0 ger index 0 (wTotal sätts till 1, så ingen division med noll och inget NaN)', () => {
        const delar = { sevScore: 100, volScore: 100, gapScore: 100, riktningsvikt: 1, bristMultiplier: 1,
            vikter: { avvikelse: 0, volym: 0, jamstalldhet: 0 } };
        expect(prioIndex(delar)).toBe(0);
    });
});

describe('prioritera: delpoängen ligger på posten och konstanterna har sina värden', () => {
    it('prioKonstanter har modellens dagens värden och är frusen', () => {
        expect(prioKonstanter()).toEqual({ AVVIKELSE_TAK: 30, VOLYM_TAK: 50, GAP_TAK: 15, RIKTNING_UNDER: 1, RIKTNING_OVER: 0.5,
            BRIST_MULTIPLIKATOR: 1.2, SNABB_VINST_KR: 1500, SNABB_VINST_AVVIKELSE: 3, SNABB_VINST_MIN_N: 5 });
        expect(Object.isFrozen(prioKonstanter())).toBe(true);
    });

    it('priorityIndex är prioIndex av postens egna delpoäng och vikterna', () => {
        const rader = grupp('5301 Undersköterska', 'B', 30000, 12, 33000, 12);
        const [item] = kör(rader, { bristAids: new Set(['5301']) });
        expect(item.bristMultiplier).toBe(1.2);
        expect(item.riktningsvikt).toBe(1.0);
        const delar = { sevScore: item.sevScore, volScore: item.volScore, gapScore: item.gapScore,
            riktningsvikt: item.riktningsvikt, bristMultiplier: item.bristMultiplier, vikter: VIKTER };
        expect(item.priorityIndex).toBeCloseTo(prioIndex(delar), 10);
    });

    it('delpoängen tas upp till taken: avvikelse −50 % och 60 personer ger 100 på sev och vol', () => {
        const rader = grupp('5301 Undersköterska', 'B', 30000, 30, 30000, 30);
        const [item] = kör(rader, { referensFor: () => ({ median: 60000, kalla: 'x' }) });
        expect(item.sevScore).toBe(100);
        expect(item.volScore).toBe(100);
        expect(item.gapScore).toBe(0);
        expect(item.riktningsvikt).toBe(1.0);
    });

    it('över referens: riktningsvikten på posten är 0,5 och bristmultiplikatorn 1 utan bristmarkering', () => {
        const rader = grupp('5301 Undersköterska', 'B', 30000, 12, 30000, 12);
        const [item] = kör(rader, { referensFor: () => ({ median: 20000, kalla: 'x' }) });
        expect(item.riktningsvikt).toBe(0.5);
        expect(item.bristMultiplier).toBe(1.0);
    });
});

describe('[B7.12] motiveringsgrunder: reglerna bakom motiveringsförslagen', () => {
    // En post med kvinnor och män (lön, ålder per person); diffPct −20 slår inte till på någon regel om läget.
    const rad = (kon, lon, alder = 0) => ({ kon, lon, alder });
    const post = (kv, ma, falt = {}) => ({ _rows: [...kv.map(([l, a]) => rad('kvinna', l, a)), ...ma.map(([l, a]) => rad('man', l, a))],
        kvN: kv.length, maN: ma.length, n: kv.length + ma.length, diffPct: -20, ...falt });
    const lika = (n, lon = 30000, alder = 0) => Array.from({ length: n }, () => [lon, alder]);
    const OPT = { kInstalld: 10, kTroskel: 10, mdePct: null, naraGrans: -2 };
    const koder = (item, opt = {}) => motiveringsgrunder(item, { ...OPT, ...opt }).map(g => g.kod);
    // a kvinnor och b män av tio vardera på 20 000 kr, resten på 30 000 kr
    const kvintil = (a, b, nKv = 10) => post([...lika(a, 20000), ...lika(nKv - a)], [...lika(b, 20000), ...lika(10 - b)]);

    it('utan rader blir det inga grunder', () => {
        expect(motiveringsgrunder({ kvN: 0, maN: 0, n: 0, diffPct: 0 }, OPT)).toEqual([]);
    });

    it('underlag: ett kön under den inställda minsta gruppstorleken, men inte vid den', () => {
        expect(motiveringsgrunder(post(lika(9), lika(10)), OPT)[0]).toEqual({ kod: 'underlag', type: 'warn', kvN: 9, maN: 10, k: 10 });
        expect(koder(post(lika(10), lika(10)))).not.toContain('underlag');
    });

    it('styrka: skillnaden under detektionströskeln i en grupp under 30, inte vid tröskeln, vid 30 eller utan tröskel', () => {
        const p = post(lika(10), lika(19), { diffPct: -1.9 });
        expect(motiveringsgrunder(p, { ...OPT, mdePct: 2 })).toContainEqual({ kod: 'styrka', type: 'info', diffPct: -1.9, mdePct: 2 });
        expect(koder({ ...p, diffPct: 2 }, { mdePct: 2 })).not.toContain('styrka');
        expect(koder(post(lika(10), lika(20), { diffPct: -1.9 }), { mdePct: 2 })).not.toContain('styrka');
        expect(koder(p)).not.toContain('styrka');
    });

    it('alder: könens medelålder skiljer minst 3 år, med minst tre åldrar per kön', () => {
        expect(motiveringsgrunder(post(lika(10, 30000, 40), lika(10, 30000, 43)), OPT))
            .toContainEqual({ kod: 'alder', type: 'info', medelKv: 40, medelMa: 43 });
        expect(koder(post(lika(10, 30000, 40), lika(10, 30000, 42)))).not.toContain('alder');
        expect(koder(post(lika(10, 30000, 40), [...lika(2, 30000, 50), ...lika(8)]))).not.toContain('alder');
    });

    it('kvintil: 40 % av kvinnorna i lägsta kvintilen och 20 procentenheter fler än männen slår till, precis vid gränserna', () => {
        expect(motiveringsgrunder(kvintil(4, 2), OPT)).toContainEqual({ kod: 'kvintil', type: 'flag', andelKv: 0.4, andelMa: 0.2 });
        expect(koder(kvintil(3, 1))).not.toContain('kvintil');   // 30 % av kvinnorna
        expect(koder(kvintil(4, 3))).not.toContain('kvintil');   // 10 procentenheter
    });

    it('kvintil: prövas inte när ett kön är under tröskeln (ADR-12)', () => {
        expect(koder(kvintil(4, 0, 9), { kInstalld: 9, kTroskel: 9 })).toContain('kvintil');
        expect(koder(kvintil(4, 0, 9))).not.toContain('kvintil');
    });

    it('brist och snabbVinst följer postens markeringar', () => {
        const g = motiveringsgrunder(post(lika(10), lika(10), { isBrist: true, isQuickWin: true }), OPT);
        expect(g).toContainEqual({ kod: 'brist', type: 'info' });
        expect(g).toContainEqual({ kod: 'snabbVinst', type: 'ok', n: 20 });
    });

    it('over: mer än 5 % över referensen, inte vid 5', () => {
        expect(motiveringsgrunder(post(lika(10), lika(10), { diffPct: 5.1 }), OPT)).toContainEqual({ kod: 'over', type: 'info', diffPct: 5.1 });
        expect(koder(post(lika(10), lika(10), { diffPct: 5 }))).not.toContain('over');
    });

    it('nara: inom uppföljningsgränsen åt båda hållen med minst 10 personer, inte vid gränsen', () => {
        expect(motiveringsgrunder(post(lika(5), lika(5), { diffPct: 1.9 }), OPT)).toContainEqual({ kod: 'nara', type: 'ok', nara: 2 });
        expect(koder(post(lika(5), lika(5), { diffPct: -1.9 }))).toContain('nara');
        expect(koder(post(lika(5), lika(5), { diffPct: 2 }))).not.toContain('nara');
        expect(koder(post(lika(4), lika(5), { diffPct: 1.9 }))).not.toContain('nara');
    });

    it('grunderna kommer i reglernas ordning', () => {
        const p = { ...kvintil(4, 2, 9), isBrist: true, isQuickWin: true, diffPct: 1.5 };
        p._rows.forEach(r => { r.alder = r.kon === 'man' ? 50 : 40; });
        expect(koder(p, { kTroskel: 9, mdePct: 2 })).toEqual(['underlag', 'styrka', 'alder', 'kvintil', 'brist', 'snabbVinst', 'nara']);
    });
});

describe('[B7.14] prioriteringens nyckeltal och kostnadskurvan', () => {
    const g = (status, kostnad) => ({ status, annualGapTotal: kostnad });
    it('prioNyckeltal: antalet per status och den sammanlagda kostnaden', () => {
        expect(prioNyckeltal([g('akut', 100), g('atgard', 50), g('atgard', 0), g('analysera', 0), g('ok', 25)]))
            .toEqual({ akut: 1, atgard: 2, analysera: 1, totalKostnad: 175 });
        expect(prioNyckeltal([])).toEqual({ akut: 0, atgard: 0, analysera: 0, totalKostnad: 0 });
    });
    it('kostnadskurva: störst först, kumulativ andel och antalet grupper till 50 % och 80 %', () => {
        // 40 + 30 + 20 + 10 = 100: 50 % nås av två grupper, 80 % av tre.
        const k = kostnadskurva([g('a', 10), g('a', 0), g('a', 40), g('a', 30), g('a', 20)], { max: 40, visas: 2 });
        expect(k.grupper.map(i => i.annualGapTotal)).toEqual([40, 30, 20, 10]);
        expect(k.total).toBe(100);
        expect(k.kumPct).toEqual([40, 70, 90, 100]);
        expect([k.n50, k.n80]).toEqual([2, 3]);
        expect([k.ovriga, k.ovrigaSumma]).toEqual([2, 30]);
    });
    it('kostnadskurva: når de max första inte gränsen är svaret alla grupper', () => {
        const k = kostnadskurva(Array.from({ length: 10 }, () => g('a', 10)), { max: 3, visas: 3 });
        expect(k.visade).toHaveLength(3);
        expect([k.n50, k.n80]).toEqual([10, 10]);
        expect(kostnadskurva([g('a', 0)], { max: 40, visas: 15 })).toMatchObject({ grupper: [], total: 0, kumPct: [], n50: 0, n80: 0, ovriga: 0 });
    });
});

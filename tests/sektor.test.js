/**
 * Sektorsöversikten: src/lib/sektor.js.
 */
import { describe, it, expect } from 'vitest';
import { sektorsTabell, sektorernasAndel, sektorJusteradText, sektorAndelNot } from '../src/lib/sektor.js';
import { computeSequentialGap } from '../src/lib/regression.js';
import { fitOLS, tQuantile } from '../src/lib/stat.js';
import { createAppWindow } from './helpers/app-harness.js';

const rad = (aid, kon, lon, alder = 40, bas = 'C', extra = {}) => ({ aid, kon, lon, alder, bas, ...extra });
const flera = (n, f) => Array.from({ length: n }, (_, i) => f(i));

describe('sektor: tabellen', () => {
    // Vård: 20 kvinnor à 30 000 och 12 män à 33 000 (jämna åldrar/BAS) → kvot 90,9 %.
    const vard = [...flera(20, i => rad('207011', 'kvinna', 30000, 30 + i, i % 2 ? 'C' : 'B')),
                  ...flera(12, i => rad('207011', 'man', 33000, 30 + i, i % 2 ? 'C' : 'B'))];
    // Teknik: 3 kvinnor och 15 män — ett kön under k.
    const teknik = [...flera(3, i => rad('502010', 'kvinna', 44000 + i)), ...flera(15, i => rad('503012', 'man', 42000 + i))];
    // Okänd kod: 4 personer — under k.
    const okand = flera(4, i => rad('5301', i % 2 ? 'man' : 'kvinna', 29000));
    const t = sektorsTabell([...vard, ...teknik, ...okand], { k: 10, punkter: { 'Vård- och omsorgsarbete med mera': 3 } });

    it('en rad per sektor i prefixordning, okänt sist', () => {
        expect(t.map(r => r.namn)).toEqual(['Vård- och omsorgsarbete med mera', 'Teknikarbete', 'Okänt huvudområde']);
    });
    it('båda könen ≥ k: könsuppdelade medianer och kvot', () => {
        const v = t[0];
        expect([v.n, v.nKv, v.nMa]).toEqual([32, 20, 12]);
        expect(v.medKv).toBe(30000);
        expect(v.medMa).toBe(33000);
        expect(v.kvot).toBeCloseTo(30000 / 33000 * 100, 6);
        expect(v.antalAid).toBe(1);
        expect(v.punkter).toBe(3);
        expect(v.samladMedian).toBe(false);
    });
    it('justerad skillnad bara med ≥ 30 personer och ≥ k av varje kön', () => {
        expect(t[0].justeratSkal).toBe('ok');
        expect(t[0].justerat.pct).toBeCloseTo((30000 / 33000 - 1) * 100, 0);
        expect(t[1].justerat).toBeNull();
        expect(t[1].justeratSkal).toBe('fa');
    });
    it('ett kön under k: samlad median, ingen könsjämförelse', () => {
        const tk = t[1];
        expect(tk.samladMedian).toBe(true);
        expect(tk.medKv).toBeNull();
        expect(tk.medMa).toBeNull();
        expect(tk.kvot).toBeNull();
        expect(tk.medTot).toBe(42008.5);   // 18 värden: medel av 42 008 och 42 009
    });
    it('sektor under k: maskerad, inga lönemått', () => {
        const o = t[2];
        expect(o.maskerad).toBe(true);
        expect([o.medTot, o.medKv, o.medMa, o.kvot, o.justerat]).toEqual([null, null, null, null, null]);
        expect(o.n).toBe(4);
    });
    it('andel med ledningsansvar per kön när ansvarsgruppen finns', () => {
        const med = vard.map((r, i) => ({ ...r, ansvarsgrupp: i < 4 ? 'ledning' : 'inget' }));
        const v = sektorsTabell(med, { k: 10 })[0];
        expect(v.ledningKv).toBeCloseTo(4 / 20 * 100, 6);
        expect(v.ledningMa).toBe(0);
        expect(sektorsTabell(vard, { k: 10 })[0].ledningKv).toBeNull();
    });
});

describe('sektor: justerad skillnad med huvudregressionens kodning (ADR-78)', () => {
    // Vård, 40 personer i tre BAS-intervall där lönestegen inte är lika stora (A 28 000, C 29 000, D 36 000):
    // BAS som rang lägger då en del av BAS-skillnaden på kön, BAS som indikatorer gör det inte.
    const LON = { A: 28000, C: 29000, D: 36000 };
    const BAS_KV = ['A', 'A', 'C', 'C', 'C', 'D'], BAS_MA = ['A', 'C', 'D', 'D'];
    const vard = (medAlder = true) => [
        ...flera(24, i => rad('207011', 'kvinna', LON[BAS_KV[i % 6]] * (0.97 + (i % 5) * 0.01) + (medAlder ? i * 40 : 0), medAlder ? 25 + i : 0, BAS_KV[i % 6])),
        ...flera(16, i => rad('207011', 'man', LON[BAS_MA[i % 4]] * (0.99 + (i % 3) * 0.01) + (medAlder ? i * 60 : 0), medAlder ? 28 + i : 0, BAS_MA[i % 4])),
    ];

    it('utan ålder i lönefilen: ett justerat tal (kön + BAS), inte För få', () => {
        const v = sektorsTabell(vard(false), { k: 10 })[0];
        expect(v.justeratSkal).toBe('ok');
        expect(v.justerat).not.toBeNull();
        expect(v.justeratMedAlder).toBe(false);
        const steg = computeSequentialGap(vard(false), 0, ['A', 'C', 'D'], { golv: 10, modell: { bas: true, alder: false, yrkesgrupp: false, skal: '' } });
        expect(v.justerat.pct).toBeCloseTo(steg.find(s => s.name === '+ BAS-intervall').gapPct, 10);
    });
    it('med ålder: samma koefficient för kön som huvudregressionen (kön + ålder + BAS som indikatorer) på samma urval', () => {
        const rader = vard();
        const v = sektorsTabell(rader, { k: 10 })[0];
        expect(v.justeratMedAlder).toBe(true);
        const ageMean = rader.reduce((s, r) => s + r.alder, 0) / rader.length;
        const steg = computeSequentialGap(rader, ageMean, ['A', 'C', 'D'], { golv: 10 });
        expect(v.justerat.pct).toBeCloseTo(steg.find(s => s.name === '+ Ålder').gapPct, 10);
    });
    it('intervallet: HC3 och t-kvantilen vid n − k frihetsgrader, som huvudtalet', () => {
        const rader = vard();
        const ageMean = rader.reduce((s, r) => s + r.alder, 0) / rader.length;
        const X = rader.map(r => [1, r.kon === 'kvinna' ? 1 : 0, r.alder - ageMean, r.bas === 'C' ? 1 : 0, r.bas === 'D' ? 1 : 0]);
        const fit = fitOLS(X, rader.map(r => Math.log(r.lon)));
        const se = Math.sqrt(fit.vcovHC3[1][1]), tq = tQuantile(0.975, fit.n - fit.k);
        expect(tq).toBeGreaterThan(2);   // 35 frihetsgrader: inte 1,96
        const j = sektorsTabell(rader, { k: 10 })[0].justerat;
        expect(j.low).toBeCloseTo((Math.exp(fit.beta[1] - tq * se) - 1) * 100, 10);
        expect(j.high).toBeCloseTo((Math.exp(fit.beta[1] + tq * se) - 1) * 100, 10);
    });
    it('ålder följer lönefilen, inte huvudområdet: en rad utan ålder i en fil med ålder räknas inte', () => {
        const rader = [...vard(), rad('207011', 'kvinna', 30000, 0, 'C')];
        const v = sektorsTabell(rader, { k: 10 })[0];
        expect(v.justeratMedAlder).toBe(true);
        expect(v.justerat.pct).toBeCloseTo(sektorsTabell(vard(), { k: 10 })[0].justerat.pct, 10);
    });
    it('k-tröskeln gäller som förut, också utan ålder: ett kön under k eller färre än 30 ger inget tal', () => {
        const fa = [...flera(25, i => rad('207011', 'kvinna', 30000 + i * 10, 0, i % 2 ? 'C' : 'B')),
                    ...flera(9, i => rad('207011', 'man', 32000 + i * 10, 0, i % 2 ? 'C' : 'B'))];
        const v = sektorsTabell(fa, { k: 10 })[0];
        expect([v.justerat, v.justeratSkal]).toEqual([null, 'fa']);
        const smal = sektorsTabell(fa.slice(0, 20).concat(fa.slice(25)), { k: 5 })[0];   // 29 personer
        expect([smal.justerat, smal.justeratSkal]).toEqual([null, 'fa']);
        const under = sektorsTabell(fa.slice(0, 6), { k: 10 })[0];
        expect([under.maskerad, under.justerat]).toEqual([true, null]);
    });
});

describe('sektor: översikten och huvudregressionen ger samma tal på samma urval (två kopior av modellen)', () => {
    // justeradSkillnad (regression.js) och runOLSRegression (regressionskortet) räknar samma modell var för sig. På ett
    // urval med ett enda huvudområde ska översikten ge huvudtalet: koefficienten, gränserna, n och k.
    const LON = { A: 28000, C: 29000, D: 36000 };
    const BAS_KV = ['A', 'A', 'C', 'C', 'C', 'D'], BAS_MA = ['A', 'C', 'D', 'D'];
    const urval = medAlder => [
        ...flera(30, i => rad('207011', 'kvinna', Math.round(LON[BAS_KV[i % 6]] * (0.96 + (i % 7) * 0.01) + (medAlder ? i * 35 : 0)), medAlder ? 24 + i : 0, BAS_KV[i % 6])),
        ...flera(20, i => rad('207011', 'man', Math.round(LON[BAS_MA[i % 4]] * (0.98 + (i % 5) * 0.01) + (medAlder ? i * 55 : 0)), medAlder ? 27 + i : 0, BAS_MA[i % 4])),
    ];
    for (const medAlder of [true, false]) {
        it(medAlder ? 'med ålder' : 'utan ålder', () => {
            const rader = urval(medAlder);
            const w = createAppWindow();
            w.__state.data = rader.map(r => ({ ...r }));
            const huvud = w.eval('runOLSRegression()');
            expect(huvud.error).toBeUndefined();
            expect(huvud.fellBackFromFull).toBeFalsy();
            const v = sektorsTabell(rader, { k: 10 })[0];
            expect(v.justeratSkal).toBe('ok');
            expect(v.justeratMedAlder).toBe(medAlder);
            expect([v.justerat.n, v.justerat.k]).toEqual([huvud.n, huvud.k]);
            expect(v.justerat.pct).toBeCloseTo(huvud.konPct, 10);
            expect(v.justerat.low).toBeCloseTo(huvud.konPctLow, 10);
            expect(v.justerat.high).toBeCloseTo(huvud.konPctHigh, 10);
        });
    }
});

describe('sektor: kön och BAS går inte att skilja åt', () => {
    // Varje BAS-intervall har bara ett kön (16 kvinnor i B, 16 män i C): modellen med BAS är singulär, och utan BAS
    // blir talet den råa skillnaden (utan ålder) eller bara åldersjusterat. Inget av dem är justerat för BAS.
    const seg = (medAlder) => [
        ...flera(16, i => rad('207011', 'kvinna', 28000 + i * 50, medAlder ? 25 + i : 0, 'B')),
        ...flera(16, i => rad('207011', 'man', 33000 + i * 60, medAlder ? 27 + i : 0, 'C')),
    ];
    it('utan ålder: inget justerat tal, orsaken är att BAS inte går att justera för', () => {
        const v = sektorsTabell(seg(false), { k: 10 })[0];
        expect([v.justerat, v.justeratSkal]).toEqual([null, 'ejBas']);
    });
    it('med ålder: inget tal heller, det vore bara justerat för ålder', () => {
        const v = sektorsTabell(seg(true), { k: 10 })[0];
        expect([v.justerat, v.justeratSkal]).toEqual([null, 'ejBas']);
    });
    it('ett enda BAS-intervall: inget att justera för, talet visas som förut', () => {
        const ett = seg(false).map(r => ({ ...r, bas: 'C' }));
        const v = sektorsTabell(ett, { k: 10 })[0];
        expect(v.justeratSkal).toBe('ok');
        expect(v.justerat).not.toBeNull();
    });
});

describe('sektor: rubriken och bisatsen för den justerade skillnaden (en regel för vyn och rapportunderlaget)', () => {
    it('med ålder i lönefilen', () => {
        expect(sektorJusteradText([{ justeratMedAlder: true }])).toEqual({ medAlder: true, rubrik: 'Justerad (ålder, BAS)', justeradFor: 'ålder och BAS-intervall' });
    });
    it('utan ålder', () => {
        expect(sektorJusteradText([{ justeratMedAlder: false }])).toEqual({ medAlder: false, rubrik: 'Justerad (BAS)', justeradFor: 'BAS-intervall' });
    });
    it('en tom tabell räknas som med ålder, som förut', () => {
        expect(sektorJusteradText([]).medAlder).toBe(true);
    });
});

describe('sektor: sektorernas andel av gapet', () => {
    it('hela gapet beror på sektorsfördelningen när lönerna är lika inom sektorerna', () => {
        // Vård 30 000 för alla, teknik 40 000 för alla; kvinnor mest i vård, män mest i teknik.
        const rader = [...flera(8, () => rad('207011', 'kvinna', 30000)), ...flera(2, () => rad('502010', 'kvinna', 40000)),
                       ...flera(2, () => rad('207011', 'man', 30000)), ...flera(8, () => rad('502010', 'man', 40000))];
        const a = sektorernasAndel(rader, { k: 2 });
        expect(a.gapKr).toBeCloseTo(6000, 6);
        expect(a.sektorKr).toBeCloseTo(6000, 6);
        expect(a.andel).toBeCloseTo(1, 6);
    });
    it('ingen del när fördelningen är lika', () => {
        const rader = [...flera(5, () => rad('207011', 'kvinna', 30000)), ...flera(5, () => rad('207011', 'man', 33000))];
        const a = sektorernasAndel(rader, { k: 5 });
        expect(a.gapKr).toBeCloseTo(3000, 6);
        expect(a.sektorKr).toBeCloseTo(0, 6);
    });
    it('null när ett kön har färre än k i hela underlaget (annars röjs medellönen via gapet i procent)', () => {
        const rader = [...flera(40, () => rad('207011', 'kvinna', 30000)), rad('502010', 'man', 47123)];
        expect(sektorernasAndel(rader, { k: 10 })).toBeNull();
        expect(sektorernasAndel(rader)).toBeNull();   // k = 10 som standard
    });
    it('null utan båda könen', () => {
        expect(sektorernasAndel([rad('207011', 'kvinna', 30000)])).toBeNull();
    });
});

// ADR-87: ett huvudområde där ett kön har 1 till k − 1 personer räknas samman med andra, så att beloppet tillsammans
// med medellönerna och antalen inte ger dess medellön (härledningarna står i tests/ktroskel-differens.test.js).
describe('sektor: sammanräknade huvudområden (ADR-87)', () => {
    // Vård: 30 kvinnor och 20 män; teknik: 12 kvinnor och 25 män; städ: 3 män.
    const tre = () => [...flera(30, () => rad('207011', 'kvinna', 30000)), ...flera(20, () => rad('207011', 'man', 31000)),
        ...flera(12, () => rad('502010', 'kvinna', 39000)), ...flera(25, () => rad('502010', 'man', 41000)),
        ...flera(3, () => rad('651010', 'man', 52000))];
    it('utan små grupper räknas inget samman, och beloppet är detsamma som förut', () => {
        const a = sektorernasAndel(tre().filter(r => r.aid !== '651010'), { k: 10 });
        expect(a.sammanslagna).toEqual([]);
        expect(sektorAndelNot(a, 10)).toBe('');
        expect(a.sektorKr).toBeCloseTo(sektorernasAndel(tre().filter(r => r.aid !== '651010'), { k: 1 }).sektorKr, 9);
    });
    it('ett litet område räknas samman med det område som har färst av samma kön, och båda namnges i noten', () => {
        const a = sektorernasAndel(tre(), { k: 10 });
        // Städ har tre män; vård har 20 och teknik 25, så städ och vård räknas samman.
        expect(a.sammanslagna).toEqual(['Vård- och omsorgsarbete med mera', 'Städ, tvätt och renhållningsarbete']);
        expect(a.sma).toEqual(['Städ, tvätt och renhållningsarbete']);
        expect(a.sektorKr).not.toBeNull();
        // Samma belopp som när städ och vård har samma huvudområde från början.
        const somEtt = sektorernasAndel(tre().map(r => (r.aid === '651010' ? { ...r, aid: '207012' } : r)), { k: 10 });
        expect(a.sektorKr).toBeCloseTo(somEtt.sektorKr, 9);
        expect(sektorAndelNot(a, 10)).toBe('Huvudområdena Vård- och omsorgsarbete med mera och Städ, tvätt och renhållningsarbete räknas här samman, '
            + 'eftersom ett kön har färre än 10 personer i Städ, tvätt och renhållningsarbete. Annars skulle medellönen för färre än 10 kvinnor eller män gå att räkna fram ur beloppet.');
    });
    it('blir bara ett område kvar redovisas inget belopp, och noten säger varför', () => {
        const rader = [...flera(40, () => rad('207011', 'kvinna', 30000)), ...flera(30, () => rad('207011', 'man', 31000)), ...flera(2, () => rad('651010', 'man', 52000))];
        const a = sektorernasAndel(rader, { k: 10 });
        expect(a).toMatchObject({ sektorKr: null, andel: null });
        expect(a.gapKr).toBeGreaterThan(0);
        expect(sektorAndelNot(a, 10)).toMatch(/^Hur mycket av skillnaden som beror på att kvinnor och män arbetar i olika huvudområden redovisas inte, eftersom ett kön har färre än 10 personer i Städ, tvätt och renhållningsarbete\./);
    });
    it('på skärmen (tröskeln 1) räknas inget samman', () => {
        expect(sektorernasAndel(tre(), { k: 1 }).sammanslagna).toEqual([]);
    });
    it('ett enda huvudområde: beloppet är noll, som förut', () => {
        const a = sektorernasAndel([...flera(12, () => rad('207011', 'kvinna', 30000)), ...flera(12, () => rad('207011', 'man', 33000))], { k: 10 });
        expect(a.sektorKr).toBeCloseTo(0, 9);
        expect(a.sammanslagna).toEqual([]);
    });
});

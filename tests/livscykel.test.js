/**
 * Lib-tester för src/lib/livscykel.js, direkt mot modulen (utan jsdom och utan appen).
 *
 * Fixturen är deterministisk (LCG) och har ett känt kön-effekt-mönster. Könskoefficienten
 * jämförs mot anpassaOLS på samma designmatris, skriven här för hand, så att modellen inte
 * bara "ser rimlig ut" utan faktiskt skattar det den säger att den skattar.
 */
import { describe, it, expect } from 'vitest';
import { livscykelRegression, livscykelNiva, samspelSakerstallt, SAMSPEL_GRANS } from '../src/lib/livscykel.js';
import { anpassaOLS } from '../src/lib/stat.js';
import { readFileSync } from 'node:fs';
import { ickeTom } from './helpers/paastaende.js';

function lcg(seed) {
    return () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
}

// n personer, tre BAS, kvinnor får ≈ 10 % lägre lön (log-skala -0,1), med lite brus.
function fixtur(n = 240, seed = 7) {
    const rnd = lcg(seed);
    const bas = ['A', 'B', 'C'];
    return Array.from({ length: n }, (_, i) => {
        const kv = i % 2 === 0;
        const alder = 25 + Math.floor(rnd() * 41);
        const b = bas[Math.floor(rnd() * 3)];
        const brus = (rnd() - 0.5) * 0.05;
        const log = 10 + (kv ? -0.1 : 0) + 0.01 * (alder - 25) + (b === 'B' ? 0.1 : b === 'C' ? 0.2 : 0) + brus;
        return { kon: kv ? 'kvinna' : 'man', alder, bas: b, lon: Math.exp(log) };
    });
}

// Designmatrisen, skriven om här så att testet inte delar kod med modellen.
function designMatris(rader, basList) {
    const ageMean = rader.reduce((s, d) => s + d.alder, 0) / rader.length;
    const dummies = basList.slice(1);
    const X = rader.map(d => {
        const kv = d.kon.includes('kvinna') ? 1 : 0;
        const ac = d.alder - ageMean;
        return [1, kv, ac, ac * ac, kv * ac, kv * ac * ac, ...dummies.map(b => (d.bas === b ? 1 : 0))];
    });
    const y = rader.map(d => Math.log(d.lon));
    return { X, y, ageMean, dummies };
}

describe('livscykelRegression: felvägar', () => {
    it('färre än 50 observationer ger felkod low_n', () => {
        const res = livscykelRegression(fixtur(40), { golv: 10 });
        expect(res.error).toMatch(/n < 50/);
        expect(res.errorCode).toBe('low_n');
    });

    it('för få av ett kön ger felkod imbalance med golvet i texten', () => {
        const rader = fixtur(240).map((d, i) => (i < 230 ? { ...d, kon: 'man' } : d));
        const res = livscykelRegression(rader, { golv: 10 });
        expect(res.errorCode).toBe('imbalance');
        expect(res.error).toMatch(/Minst 10 av varje/);
    });

    it('bara ett BAS-intervall ger felkod single_bas', () => {
        const rader = fixtur(240).map(d => ({ ...d, bas: 'A' }));
        expect(livscykelRegression(rader, { golv: 10 }).errorCode).toBe('single_bas');
    });

    it('tom indata ger felet för få observationer', () => {
        expect(livscykelRegression([], { golv: 10 }).errorCode).toBe('low_n');
    });
});

describe('[B3.10] livscykelRegression: skattning', () => {
    const rader = fixtur(240);
    const res = livscykelRegression(rader, { golv: 10 });

    it('returnerar ett ok-resultat med de förväntade fälten', () => {
        expect(res.ok).toBe(true);
        expect(res.n).toBe(240);
        expect(res.k).toBe(8);   // 6 kolumner + 2 BAS-dummies
        expect(res.basList).toEqual(['A', 'B', 'C']);
        expect(res.refBas).toBe('A');
        expect(res.predKvinna.length).toBe(41);
        expect(res.predMan.length).toBe(41);
        expect(res.gapPerAge.length).toBe(41);
        expect(res.predKvinna[0].age).toBe(25);
        expect(res.predKvinna[40].age).toBe(65);
    });

    it('könskoefficienten är exakt den som anpassaOLS ger på samma designmatris', () => {
        const basList = ['A', 'B', 'C'];
        const { X, y } = designMatris(rader, basList);
        const fit = anpassaOLS(X, y);
        expect(res.kvCoef).toBeCloseTo(fit.beta[1], 12);
        expect(res.kvSE).toBeCloseTo(Math.sqrt(fit.vcovHC3[1][1]), 12);
        expect(res.kvAgeCoef).toBeCloseTo(fit.beta[4], 12);
        expect(res.kvAge2Coef).toBeCloseTo(fit.beta[5], 12);
        expect(res.R2).toBeCloseTo(fit.R2, 12);
    });

    it('könseffekten ligger nära den inbyggda -0,1 på log-skala', () => {
        expect(Math.abs(res.kvCoef - (-0.1))).toBeLessThan(0.02);
    });

    it('gapet vid 25 år följer prediktionerna, kvinnor mot män: kvinna/man − 1', () => {
        const kvinna = res.predKvinna[0].lon;
        const man = res.predMan[0].lon;
        expect(res.gapFran).toBeCloseTo((kvinna / man - 1) * 100, 6);
        expect(res.gapFran).toBeLessThan(0);                                       // kvinnorna ligger lägre i fixturen
        expect(res.gapTill).toBeCloseTo((res.predKvinna[40].lon / res.predMan[40].lon - 1) * 100, 6);
        expect(res.gapDelta).toBeCloseTo(res.gapTill - res.gapFran, 10);
    });

    it('prediktionerna har ett KI som ligger runt punktskattningen', () => {
        for (const p of ickeTom(res.predKvinna)) {
            expect(p.lo).toBeLessThanOrEqual(p.lon);
            expect(p.hi).toBeGreaterThanOrEqual(p.lon);
        }
    });

    it('AIC och justerat R² är ändliga och justerat R² ligger under R²', () => {
        expect(Number.isFinite(res.aic)).toBe(true);
        expect(res.adjR2).toBeLessThanOrEqual(res.R2);
    });
});

describe('livscykelRegression: fixBas', () => {
    it('default är den mest folkrika BAS-gruppen', () => {
        const rader = fixtur(240);
        // Räknas här för hand i stället för att läsas ur modellen.
        const antal = { A: 0, B: 0, C: 0 };
        rader.forEach(d => { antal[d.bas]++; });
        const mest = Object.keys(antal).reduce((a, b) => (antal[b] > antal[a] ? b : a));
        expect(livscykelRegression(rader, { golv: 10 }).fixBas).toBe(mest);
    });

    it('en angiven fixBas som finns i data används', () => {
        const res = livscykelRegression(fixtur(240), { fixBas: 'C', golv: 10 });
        expect(res.fixBas).toBe('C');
    });

    it('en okänd fixBas ersätts av den mest folkrika', () => {
        const rader = fixtur(240);
        const utan = livscykelRegression(rader, { golv: 10 });
        const res = livscykelRegression(rader, { fixBas: 'Z', golv: 10 });
        expect(res.fixBas).toBe(utan.fixBas);
    });

    it('nivåfaktorn per BAS kommer ur modellens koefficienter: 1 för det visade intervallet, och kurvan för ett annat intervall är kurvan gånger faktorn', () => {
        const rader = fixtur(240);
        const a = livscykelRegression(rader, { fixBas: 'A', golv: 10 });
        const c = livscykelRegression(rader, { fixBas: 'C', golv: 10 });
        expect(Object.keys(a.basFaktor)).toEqual(['A', 'B', 'C']);
        expect(a.basFaktor.A).toBe(1);
        expect(a.basFaktor.C).toBeCloseTo(Math.exp(0.2), 1);                        // fixturens nivåskillnad A→C är 0,2 på log-skalan
        expect(c.predMan[0].lon).toBeCloseTo(a.predMan[0].lon * a.basFaktor.C, 6);   // samma sak som att räkna kurvan för C
        expect(c.basFaktor.A).toBeCloseTo(1 / a.basFaktor.C, 10);
    });

    it('prediktionerna för olika fixBas skiljer sig åt på nivån, inte i gapet', () => {
        const rader = fixtur(240);
        const a = livscykelRegression(rader, { fixBas: 'A', golv: 10 });
        const c = livscykelRegression(rader, { fixBas: 'C', golv: 10 });
        expect(c.predMan[0].lon).toBeGreaterThan(a.predMan[0].lon);
        expect(c.gapFran).toBeCloseTo(a.gapFran, 10);
    });
});

// Kvinnor får `effekt` lägre log-lön i alla åldrar. Varje cell (kön, ålder, BAS) har två personer med bruset +e och
// −e, så att residualerna summerar till noll i varje cell: alla designkolumner är konstanta inom cellen, så OLS ger
// exakt den inbyggda effekten, och bruset styr bara intervallets bredd.
function trappFixtur(skillnadPct, brus) {
    const effekt = Math.log(1 + skillnadPct / 100), rader = [];
    for (let alder = 25; alder <= 65; alder += 5)
        for (const bas of ['A', 'B'])
            for (const kon of ['kvinna', 'man'])
                for (const e of [brus, -brus]) {
                    const log = 10 + (kon === 'kvinna' ? effekt : 0) + 0.01 * (alder - 25) + (bas === 'B' ? 0.1 : 0) + e;
                    rader.push({ kon, alder, bas, lon: Math.exp(log) });
                }
    return rader;
}

describe('livscykelRegression: kurvan och nyckeltalen stannar inom underlagets åldrar', () => {
    // Åldrarna 40–45 och ingen könsskillnad: utanför spannet skulle kvadraten i ålder ge vilka tal som helst.
    const smal = () => fixtur(240).map((d, i) => ({ ...d, alder: 40 + ((i >> 1) % 6), lon: Math.exp(10 + 0.01 * ((i >> 1) % 6) + 0.02 * ((i * 7) % 5)) }));
    it('nyckeltalen räknas vid underlagets lägsta och högsta ålder, inte vid 25 och 65', () => {
        const res = livscykelRegression(smal(), { golv: 10 });
        expect([res.alderFran, res.alderTill]).toEqual([40, 45]);
        expect(res.gapPerAge.map(g => g.age)).toEqual([40, 41, 42, 43, 44, 45]);
        expect(res.gapFran).toBe(res.gapPerAge[0].gapPct);
        expect(res.gapTill).toBe(res.gapPerAge[5].gapPct);
        expect(Math.abs(res.gapTill)).toBeLessThan(5);
    });
    it('varje köns kurva går över det egna könets åldrar', () => {
        // Kvinnorna 30–40, männen 35–50: kurvorna följer var sitt spann, skillnaden det gemensamma 35–40.
        const rader = fixtur(240).map((d, i) => ({ ...d, alder: d.kon === 'kvinna' ? 30 + ((i >> 1) % 11) : 35 + ((i >> 1) % 16) }));
        const res = livscykelRegression(rader, { golv: 10 });
        const spann = p => [p[0].age, p[p.length - 1].age];
        expect(spann(res.predKvinna)).toEqual([30, 40]);
        expect(spann(res.predMan)).toEqual([35, 50]);
        expect(spann(res.gapPerAge)).toEqual([35, 40]);
        expect([res.alderFran, res.alderTill]).toEqual([35, 40]);
    });
    it('utan någon gemensam ålder bedöms ingen skillnad, och felet säger varför', () => {
        const rader = fixtur(240).map((d, i) => ({ ...d, alder: d.kon === 'kvinna' ? 25 + ((i >> 1) % 10) : 40 + ((i >> 1) % 10) }));
        const res = livscykelRegression(rader, { golv: 10 });
        expect(res.errorCode).toBe('inget_gemensamt_spann');
        expect(res.error).toMatch(/samma ålder/);
    });
});

describe('livscykelRegression: nyckeltalen vid spannets ändar följer trappan (ADR-71)', () => {
    it('en tydlig skillnad (−8 %) med ett intervall som utesluter lika lön är värd att granska', () => {
        const res = livscykelRegression(trappFixtur(-8, 0.01), { golv: 10 });
        expect(res.gapFran).toBeCloseTo(-8, 6);
        expect(res.gapPerAge[0].gapHiPct).toBeLessThan(0);
        expect(res.nivaFran).toBe('granska');
        expect(res.nivaTill).toBe('granska');
    });

    it('en skillnad på −4 % med ett intervall som täcker lika lön är följ upp, inte granska', () => {
        const res = livscykelRegression(trappFixtur(-4, 0.4), { golv: 10 });
        expect(res.gapFran).toBeCloseTo(-4, 6);
        expect(res.gapPerAge[0].gapLoPct).toBeLessThan(0);
        expect(res.gapPerAge[0].gapHiPct).toBeGreaterThan(0);
        expect(res.nivaFran).toBe('folj');
    });

    it('under 3 % med ett intervall som täcker lika lön är balanserat', () => {
        const res = livscykelRegression(trappFixtur(-2, 0.4), { golv: 10 });
        expect(res.gapFran).toBeCloseTo(-2, 6);
        expect(res.gapPerAge[0].gapLoPct).toBeLessThan(0);
        expect(res.gapPerAge[0].gapHiPct).toBeGreaterThan(0);
        expect(res.nivaFran).toBe('balanserat');
    });

    it('storleken ensam ger ingen status: −6 % med ett intervall som täcker lika lön är följ upp', () => {
        const res = livscykelRegression(trappFixtur(-6, 0.6), { golv: 10 });
        expect(res.gapPerAge[0].gapHiPct).toBeGreaterThan(0);
        expect(res.nivaFran).toBe('folj');
    });

    it('ett intervall som saknas eller inte är ändligt går ej att bedöma, inte balanserat', () => {
        expect(livscykelNiva({ gapPct: -8, gapLoPct: NaN, gapHiPct: -6 })).toBe('ejbedomd');
        expect(livscykelNiva({ gapPct: -1, gapLoPct: -Infinity, gapHiPct: Infinity })).toBe('ejbedomd');
        expect(livscykelNiva({ gapPct: NaN, gapLoPct: -2, gapHiPct: 1 })).toBe('ejbedomd');
        expect(livscykelNiva(undefined)).toBe('ejbedomd');
        expect(livscykelNiva({ gapPct: -8, gapLoPct: -10, gapHiPct: -6 })).toBe('granska');
    });
});

describe('livscykelRegression: lönefil utan ålder (ADR-64)', () => {
    it('ger felkod no_age när ingen rad har ålder', () => {
        const res = livscykelRegression(fixtur(240).map(d => ({ ...d, alder: 0 })), { golv: 10 });
        expect(res.errorCode).toBe('no_age');
        expect(res.error).toMatch(/ålder/i);
    });
});

describe('samspelSakerstallt: en gräns för samspelet kön × ålder (ADR-71)', () => {
    it('gränsen är p < 0,10', () => {
        expect(SAMSPEL_GRANS).toBe(0.10);
    });
    it('säkerställt när något av p-värdena är under 0,10', () => {
        expect(samspelSakerstallt(0.09, 0.5)).toBe(true);
        expect(samspelSakerstallt(0.5, 0.0999)).toBe(true);
        expect(samspelSakerstallt(0.001)).toBe(true);
    });
    it('exakt 0,10 är inte säkerställt, för ett p-värde och för båda', () => {
        expect(samspelSakerstallt(0.10)).toBe(false);
        expect(samspelSakerstallt(0.10, 0.10)).toBe(false);
        expect(samspelSakerstallt(0.10, 0.5)).toBe(false);
    });
    it('ett p-värde som saknas eller inte är ett tal säkerställer inget', () => {
        expect(samspelSakerstallt(NaN, 0.5)).toBe(false);
        expect(samspelSakerstallt(undefined, null)).toBe(false);
        expect(samspelSakerstallt()).toBe(false);
    });
    it('appens livscykel och dess vymodell har ingen egen gräns: nyckeltalet, Att utforska och tolkningen använder funktionen', () => {
        const kalla = ['../src/app/52-livscykel.js', '../src/lib/vymodell-livscykel.js'].map(f => readFileSync(new URL(f, import.meta.url), 'utf8')).join('\n');
        expect(kalla).not.toMatch(/(?:PVal|\bp)\s*[<>]=?\s*0?\.10?\b/);
        expect((kalla.match(/samspelSakerstallt\(/g) || []).length).toBeGreaterThanOrEqual(3);
    });
});

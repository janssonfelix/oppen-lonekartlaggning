/**
 * Enhetstester för strukturanalys (src/lib/struktur.js): representation/segregation,
 * kvartilfördelning (EU 2023/970), distributionellt gap, mediangap.
 */
import { describe, it, expect } from 'vitest';
import {
    histogramKlasser, omfang,
    konsMedianer, konsMedianerUrLoner, medianGapPct, representationPerBas, kvartilfordelning, fordelningsgap, tillDirektivtecken
} from '../src/lib/struktur.js';

const rows = () => [
    { bas: 'A', kon: 'kvinna', lon: 28000 },
    { bas: 'A', kon: 'kvinna', lon: 30000 },
    { bas: 'A', kon: 'man',    lon: 31000 },
    { bas: 'B', kon: 'kvinna', lon: 38000 },
    { bas: 'B', kon: 'man',    lon: 40000 },
    { bas: 'B', kon: 'man',    lon: 42000 },
    { bas: 'C', kon: 'kvinna', lon: 50000 },
    { bas: 'C', kon: 'man',    lon: 52000 }
];

describe('structure: mediangap', () => {
    it('mediankvinnor / medianmän − 1', () => {
        expect(medianGapPct(rows())).toBeCloseTo((34000 / 41000 - 1) * 100, 6);
    });
    it('null när ett kön saknas', () => {
        expect(medianGapPct([{ bas: 'A', kon: 'man', lon: 30000 }])).toBeNull();
    });
});

describe('[B2.1] structure: konsMedianer', () => {
    const tom = { nKv: 0, nMa: 0, medKv: null, medMa: null, kvotPct: null, gapPct: null, konOk: false };
    it('tom lista och saknad lista: inga tal', () => {
        expect(konsMedianer([])).toEqual(tom);
        expect(konsMedianer(undefined)).toEqual(tom);
    });
    it('ett kön saknas: antalen står kvar, inga medianer', () => {
        expect(konsMedianer([{ kon: 'man', lon: 30000 }])).toEqual({ ...tom, nMa: 1 });
    });
    it('under k: konOk falskt och inga medianer; precis vid k räknas de', () => {
        const r = [{ kon: 'kvinna', lon: 30000 }, { kon: 'kvinna', lon: 32000 }, { kon: 'man', lon: 40000 }, { kon: 'man', lon: 42000 }, { kon: 'man', lon: 44000 }];
        expect(konsMedianer(r, { k: 3 })).toEqual({ ...tom, nKv: 2, nMa: 3 });
        expect(konsMedianer(r, { k: 2 })).toMatchObject({ konOk: true, medKv: 31000, medMa: 42000 });
    });
    it('lön 0 eller lägre och rader utan kön räknas inte', () => {
        const r = [{ kon: 'kvinna', lon: 0 }, { kon: 'kvinna', lon: -5 }, { kon: 'kvinna', lon: 30000 }, { kon: 'man', lon: 40000 }, { kon: 'annat', lon: 1 }];
        expect(konsMedianer(r)).toMatchObject({ nKv: 1, nMa: 1, medKv: 30000, medMa: 40000 });
    });
    it('jämnt antal: medianen är medelvärdet av de två mittersta; kvot och gap', () => {
        const m = konsMedianer(rows());
        expect(m).toMatchObject({ nKv: 4, nMa: 4, medKv: 34000, medMa: 41000, konOk: true });
        expect(m.kvotPct).toBeCloseTo(34000 / 41000 * 100, 9);
        expect(m.gapPct).toBeCloseTo(m.kvotPct - 100, 9);
        expect(medianGapPct(rows())).toBe(m.gapPct);
    });
    it('konsMedianerUrLoner: samma tal ur lönerna delade efter kön, med samma regel för lön och k', () => {
        expect(konsMedianerUrLoner([0, -5, 30000], [40000])).toEqual(konsMedianer([{ kon: 'kvinna', lon: 0 }, { kon: 'kvinna', lon: -5 }, { kon: 'kvinna', lon: 30000 }, { kon: 'man', lon: 40000 }]));
        const kv = rows().filter(r => r.kon === 'kvinna').map(r => r.lon), ma = rows().filter(r => r.kon === 'man').map(r => r.lon);
        expect(konsMedianerUrLoner(kv, ma)).toEqual(konsMedianer(rows()));
        expect(konsMedianerUrLoner(kv, ma, { k: 5 })).toEqual(konsMedianer(rows(), { k: 5 }));
        expect(konsMedianerUrLoner(undefined, null).konOk).toBe(false);
    });
});

describe('[B2.2] structure: direktivets tecken (EU 2023/970 art. 9)', () => {
    it('verktygets −8 % (kvinnor lägre) blir +8 %; beloppet är detsamma', () => {
        expect(tillDirektivtecken(-8)).toBe(8);
        expect(tillDirektivtecken(3.25)).toBe(-3.25);
        expect(medianGapPct([{ kon: 'kvinna', lon: 46000 }, { kon: 'man', lon: 50000 }])).toBeCloseTo(-8, 9);
        expect(tillDirektivtecken(medianGapPct([{ kon: 'kvinna', lon: 46000 }, { kon: 'man', lon: 50000 }]))).toBeCloseTo(8, 9);
    });
    it('null förblir null, noll blir 0 (inte −0)', () => {
        expect(tillDirektivtecken(null)).toBeNull();
        expect(tillDirektivtecken(undefined)).toBeNull();
        expect(tillDirektivtecken(NaN)).toBeNull();
        expect(Object.is(tillDirektivtecken(0), 0)).toBe(true);
    });
});

describe('[B2.3] structure: representation per BAS (pyramid)', () => {
    it('sorterar BAS A–Ö med andel kvinnor', () => {
        const r = representationPerBas(rows());
        expect(r.map(x => x.bas)).toEqual(['A', 'B', 'C']);
        expect(r.find(x => x.bas === 'A').andelKv).toBeCloseTo(66.67, 1);
        expect(r.find(x => x.bas === 'B').andelKv).toBeCloseTo(33.33, 1);
        expect(r.find(x => x.bas === 'A').gapPct).toBeCloseTo((29000 / 31000 - 1) * 100, 4);
    });
});

describe('[B2.4] structure: kvartilfördelning (EU 2023/970)', () => {
    it('fyra lika stora lönekvartiler med andel kvinnor', () => {
        const q = kvartilfordelning(rows());
        expect(q).toHaveLength(4);
        expect(q.map(x => x.n)).toEqual([2, 2, 2, 2]);
        expect(q[0]).toMatchObject({ q: 1, nKv: 2, nMa: 0, andelKv: 100, undre: null, ovre: 30500 });
        expect(q[1]).toMatchObject({ undre: 30500, ovre: 39000 });
        expect(q[3]).toMatchObject({ undre: 46000, ovre: null });
        expect(q[2]).toMatchObject({ q: 3, nKv: 0, nMa: 2 });    // 40000,42000 = män
    });
    it('redovisar inga enskilda löner: varken lägsta, högsta eller kvartilens ytterlöner', () => {
        const q = kvartilfordelning(rows());
        const tal = q.flatMap(x => [x.undre, x.ovre]).filter(v => v !== null);
        for (const v of tal) expect(rows().map(r => r.lon)).not.toContain(v);
        for (const x of q) { expect(x).not.toHaveProperty('loLon'); expect(x).not.toHaveProperty('hiLon'); }
    });
    it('tom vid < 4 individer', () => {
        expect(kvartilfordelning(rows().slice(0, 3))).toEqual([]);
    });
});

describe('[B2.5] structure: distributionellt gap (sticky floor vs glastak)', () => {
    it('gap per percentil', () => {
        const d = fordelningsgap(rows());
        expect(d.map(x => x.p)).toEqual([10, 25, 50, 75, 90]);
        const p10 = d.find(x => x.p === 10).gapPct;
        const p90 = d.find(x => x.p === 90).gapPct;
        // gapet är mer negativt i botten än i toppen → sticky floor
        expect(p10).toBeLessThan(p90);
        expect(d.find(x => x.p === 50).gapPct).toBeCloseTo((34000 / 41000 - 1) * 100, 4);
    });
});

// k-anonymitet: könsuppdelade mått kräver tröskeln
// för VARJE kön. Anroparen i appen skickar alltid gällande tröskel.
describe('structure: k per kön', () => {
    const skev = () => [
        ...Array.from({ length: 20 }, (_, i) => ({ bas: 'Y', kon: 'kvinna', lon: 30000 + i })),
        { bas: 'Y', kon: 'man', lon: 45000 },
        ...Array.from({ length: 12 }, (_, i) => ({ bas: 'Z', kon: i % 2 ? 'man' : 'kvinna', lon: 40000 + i * 10 })),
        ...Array.from({ length: 12 }, (_, i) => ({ bas: 'E', kon: 'kvinna', lon: 35000 + i })),
    ];
    it('representationPerBas: gap och könsmedianer blir null när ett kön är under k; samlad median står kvar', () => {
        const r = representationPerBas(skev(), { k: 10 });
        const y = r.find(g => g.bas === 'Y');
        expect(y).toMatchObject({ n: 21, nKv: 20, nMa: 1, gapPct: null, medianKv: null, medianMa: null, konLitet: true });
        expect(y.median).toBe(30010);
        // 6 av varje kön i ett BAS om 12: också under 10 per kön
        expect(r.find(g => g.bas === 'Z')).toMatchObject({ gapPct: null, konLitet: true });
        // Enkönat BAS: ingen jämförelse att utelämna, och könets median är BAS:ets egen
        expect(r.find(g => g.bas === 'E')).toMatchObject({ gapPct: null, konLitet: false, medianMa: null });
        expect(r.find(g => g.bas === 'E').medianKv).toBe(35005.5);
    });
    it('representationPerBas: vid k = 6 redovisas Z men inte Y', () => {
        const r = representationPerBas(skev(), { k: 6 });
        expect(r.find(g => g.bas === 'Z').gapPct).not.toBeNull();
        expect(r.find(g => g.bas === 'Y').gapPct).toBeNull();
    });
    it('utan k får varje grupp ett gap så snart båda könen finns', () => {
        const y = representationPerBas(skev()).find(g => g.bas === 'Y');
        expect(y.gapPct).toBeCloseTo((30009.5 / 45000 - 1) * 100, 6);
        expect(y.konLitet).toBe(false);
    });
    const treMan = () => [
        ...Array.from({ length: 60 }, (_, i) => ({ bas: 'A', kon: 'kvinna', lon: 25000 + i * 10 })),
        ...[41417, 43719, 47827].map(lon => ({ bas: 'A', kon: 'man', lon })),
    ];
    it('medianGapPct och fordelningsgap: null respektive tom lista när ett kön är under k', () => {
        expect(medianGapPct(treMan(), { k: 10 })).toBeNull();
        expect(fordelningsgap(treMan(), undefined, { k: 10 })).toEqual([]);
        expect(medianGapPct(treMan(), { k: 3 })).toBeCloseTo((25295 / 43719 - 1) * 100, 6);
        expect(fordelningsgap(treMan(), undefined, { k: 3 })).toHaveLength(5);
        expect(fordelningsgap(treMan())).toHaveLength(5);   // standardgolvet 2
        expect(fordelningsgap(treMan(), undefined, { k: 1 })).toHaveLength(5);
        expect(fordelningsgap([{ kon: 'kvinna', lon: 1 }, { kon: 'kvinna', lon: 2 }, { kon: 'man', lon: 3 }], undefined, { k: 1 })).toEqual([]);   // aldrig under 2
    });
    it('kvartilfordelning: könsfördelningen per kvartil lämnas inte ut när ett kön är under k', () => {
        const q = kvartilfordelning(treMan(), { k: 10 });
        expect(q.map(x => x.n)).toEqual([16, 16, 16, 15]);
        for (const x of q) expect(x).toMatchObject({ nKv: null, nMa: null, andelKv: null, konDolt: true });
        expect(q[1].undre).not.toBeNull();
        const oppen = kvartilfordelning(treMan(), { k: 3 });
        expect(oppen[3]).toMatchObject({ nMa: 3, konDolt: false });
        expect(kvartilfordelning(treMan())[3]).toMatchObject({ nMa: 3, konDolt: false });
    });
});

describe('histogramKlasser: lönefördelningens klasser (k-tröskeln)', () => {
    const loner = (fran, steg, n) => Array.from({ length: n }, (_, i) => fran + i * steg);
    it('varje klass har minst k personer, och de glesa ändklasserna slås ihop inåt', () => {
        const kv = loner(25000, 250, 60), ma = loner(28000, 250, 60);
        const kl = histogramKlasser(kv, ma, 10);
        expect(kl.length).toBeGreaterThanOrEqual(3);
        for (const c of kl) expect(c.nKv + c.nMa).toBeGreaterThanOrEqual(10);
        expect(kl.reduce((s, c) => s + c.nKv, 0)).toBe(60);
        expect(kl.reduce((s, c) => s + c.nMa, 0)).toBe(60);
        for (let i = 1; i < kl.length; i++) expect(kl[i].fran).toBe(kl[i - 1].till);
    });
    it('inget histogram när ett kön är under tröskeln', () => {
        expect(histogramKlasser(loner(25000, 100, 9), loner(25000, 100, 50), 10)).toBeNull();
    });
    it('omfang klarar fler värden än Math.min tar som argument', () => {
        expect(omfang(loner(1, 1, 300000))).toEqual([1, 300000]);
    });
});

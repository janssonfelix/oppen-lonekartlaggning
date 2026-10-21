/**
 * Sektorsöversikten: src/lib/sektor.js.
 */
import { describe, it, expect } from 'vitest';
import { sektorsTabell, sektorernasAndel } from '../src/lib/sektor.js';

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

describe('sektor: sektorernas andel av gapet', () => {
    it('hela gapet beror på sektorsfördelningen när lönerna är lika inom sektorerna', () => {
        // Vård 30 000 för alla, teknik 40 000 för alla; kvinnor mest i vård, män mest i teknik.
        const rader = [...flera(8, () => rad('207011', 'kvinna', 30000)), ...flera(2, () => rad('502010', 'kvinna', 40000)),
                       ...flera(2, () => rad('207011', 'man', 30000)), ...flera(8, () => rad('502010', 'man', 40000))];
        const a = sektorernasAndel(rader);
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

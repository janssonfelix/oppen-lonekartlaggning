/**
 * Ren kärna för analys mot lönepolitiskt ställningstagande (src/lib/lonepolitik.js).
 * Testar matematiken utan DOM/state. Uppslaget (policyFor) ligger i app.js och
 * testas via smoke-testet.
 */
import { describe, it, expect } from 'vitest';
import {
    bandPosition, groupBandStats, complianceCounts,
    genderBandGap, costToFloor, policyCoverage, organisationsBand
} from '../src/lib/lonepolitik.js';

const pol = { p10: 30000, med: 35000, p90: 40000 };

describe('bandPosition', () => {
    it('0 på golvet, 1 i taket, 0.5 mitt i', () => {
        expect(bandPosition(30000, 30000, 40000)).toBe(0);
        expect(bandPosition(40000, 30000, 40000)).toBe(1);
        expect(bandPosition(35000, 30000, 40000)).toBe(0.5);
    });

    it('klämmer INTE — utanför bandet ger <0 respektive >1 (det är signalen)', () => {
        expect(bandPosition(28000, 30000, 40000)).toBeCloseTo(-0.2, 10);
        expect(bandPosition(42000, 30000, 40000)).toBeCloseTo(1.2, 10);
    });

    it('null när bandet är oanvändbart', () => {
        expect(bandPosition(35000, 0, 40000)).toBeNull();
        expect(bandPosition(35000, 30000, 0)).toBeNull();
        expect(bandPosition(0, 30000, 40000)).toBeNull();
        expect(bandPosition(35000, 40000, 40000)).toBeNull();   // P90 = P10
        expect(bandPosition(35000, 45000, 40000)).toBeNull();   // P90 < P10
    });
});

describe('groupBandStats', () => {
    it('räknar median, position och avvikelse mot policymedian', () => {
        const rows = [{ lon: 30000 }, { lon: 35000 }, { lon: 40000 }];
        const s = groupBandStats(rows, pol);
        expect(s.n).toBe(3);
        expect(s.median).toBe(35000);
        expect(s.position).toBe(0.5);
        expect(s.medianVsPolicyPct).toBeCloseTo(0, 10);
    });

    it('medianVsPolicyPct är negativ när gruppen ligger under policymedianen', () => {
        const s = groupBandStats([{ lon: 31500 }], pol);
        expect(s.medianVsPolicyPct).toBeCloseTo(-10, 10);
    });

    it('null för tomt underlag', () => {
        expect(groupBandStats([], pol)).toBeNull();
        expect(groupBandStats([{ lon: 0 }], pol)).toBeNull();
        expect(groupBandStats([{ lon: 35000 }], null)).toBeNull();
    });
});

describe('complianceCounts', () => {
    it('delar upp under/inom/över bandet', () => {
        const rows = [{ lon: 25000 }, { lon: 29999 }, { lon: 30000 }, { lon: 40000 }, { lon: 41000 }];
        const c = complianceCounts(rows, pol);
        expect(c.n).toBe(5);
        expect(c.under).toBe(2);      // 25000, 29999
        expect(c.within).toBe(2);     // 30000 och 40000 = på gränsen, räknas som inom
        expect(c.over).toBe(1);       // 41000
        expect(c.underPct).toBeCloseTo(40, 10);
    });

    it('null utan användbara bandgränser', () => {
        expect(complianceCounts([{ lon: 35000 }], { p10: 0, p90: 40000 })).toBeNull();
    });
});

describe('genderBandGap', () => {
    const mk = (n, lon, kon) => Array.from({ length: n }, () => ({ lon, kon }));

    it('negativ diff när kvinnor ligger lägre i samma band', () => {
        const rows = [...mk(10, 32000, 'kvinna'), ...mk(10, 38000, 'man')];
        const g = genderBandGap(rows, pol);
        expect(g.nKv).toBe(10);
        expect(g.nMa).toBe(10);
        expect(g.kvPos).toBeCloseTo(0.2, 10);
        expect(g.maPos).toBeCloseTo(0.8, 10);
        expect(g.diff).toBeCloseTo(-0.6, 10);
    });

    it('null när något kön är under tröskeln (k-anonymitet)', () => {
        const rows = [...mk(9, 32000, 'kvinna'), ...mk(20, 38000, 'man')];
        expect(genderBandGap(rows, pol)).toBeNull();
        // men med lägre tröskel går det
        expect(genderBandGap(rows, pol, 5)).not.toBeNull();
    });
});

describe('costToFloor', () => {
    it('summerar bara underskottet upp till P10', () => {
        const rows = [{ lon: 28000 }, { lon: 29000 }, { lon: 35000 }];
        const c = costToFloor(rows, pol);
        expect(c.nAffected).toBe(2);
        expect(c.totalMonth).toBe(3000);   // 2000 + 1000
    });

    it('noll när alla ligger på eller över golvet', () => {
        const c = costToFloor([{ lon: 30000 }, { lon: 45000 }], pol);
        expect(c.nAffected).toBe(0);
        expect(c.totalMonth).toBe(0);
    });
});

describe('policyCoverage', () => {
    it('räknar täckning i både grupper och personer', () => {
        const c = policyCoverage([
            { n: 10, hasPolicy: true },
            { n: 30, hasPolicy: true },
            { n: 60, hasPolicy: false }
        ]);
        expect(c.groupsTotal).toBe(3);
        expect(c.groupsCovered).toBe(2);
        expect(c.personsTotal).toBe(100);
        expect(c.personsCovered).toBe(40);
        expect(c.personsPct).toBeCloseTo(40, 10);
    });

    it('tål tom lista utan att dividera med noll', () => {
        expect(policyCoverage([]).personsPct).toBe(0);
    });
});

describe('inverterat band (P10 >= P90) — malformerad policydata', () => {
    const inv = { p10: 40000, med: 35000, p90: 30000 };
    it('complianceCounts returnerar null i stället för att räkna på felvänt band', () => {
        expect(complianceCounts([{ lon: 35000 }, { lon: 45000 }], inv)).toBeNull();
        expect(complianceCounts([{ lon: 35000 }], { p10: 30000, p90: 30000 })).toBeNull();
    });
    it('costToFloor avvisar felvänt band men räknar när taket saknas', () => {
        expect(costToFloor([{ lon: 35000 }], inv)).toBeNull();
        const utanTak = costToFloor([{ lon: 28000 }], { p10: 30000, med: 0, p90: 0 });
        expect(utanTak.nAffected).toBe(1);
        expect(utanTak.totalMonth).toBe(2000);
    });
    it('bandPosition hade redan kontrollen — nu är de tre samstämmiga', () => {
        expect(bandPosition(35000, inv.p10, inv.p90)).toBeNull();
    });
});

describe('organisationsBand', () => {
    const rader = n => Array.from({ length: n }, (_, i) => ({ lon: 30000 + i * 1000 }));
    it('ger organisationens P10, median och P90 när gruppen har minst k personer', () => {
        const b = organisationsBand(rader(11), 10);
        expect(b).toEqual({ n: 11, p10: 31000, med: 35000, p90: 39000 });
    });
    it('under k redovisas inget band', () => {
        expect(organisationsBand(rader(9), 10)).toBeNull();
    });
    it('räknar bara positiva löner', () => {
        expect(organisationsBand([...rader(10), { lon: 0 }], 10).n).toBe(10);
    });
});

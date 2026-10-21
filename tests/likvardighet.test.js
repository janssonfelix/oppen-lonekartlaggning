/**
 * Vitest-tester för Likvärdighetsanalysen (DiskrL 3:10 §) — v4-modellen.
 *
 * Testar den GÄLLANDE modellen: organisationens kvinnodominerade AID×BAS-grupper
 * jämförs INOM samma BAS-intervall, primärt mot organisationens egna
 * icke-kvinnodominerade yrken (intern), annars mot jämförelsestatistikens
 * icke-kvinnodominerade yrken (extern fallback). SCB-klassificeraren injiceras
 * som stub. Varje par får ett bootstrap-CI på medianskillnaden.
 *
 * Speglar app.js `computeLikvardighetPairs()` — håll dessa i synk.
 */

import { describe, it, expect } from 'vitest';
import {
    KVINNO_TROSKEL_DEFAULT,
    ICKE_KV_TAK,
    bootstrapMedianDiffKr,
    bootstrapMedianVsConstantKr,
    aggregeraOrgKvDom,
    klassificeraStatistik,
    orgIckeKvByBas,
    byggPar,
    byggParPoäng,
    byggParLagreKrav,
    aldersjusteradSkillnad,
    computeLikvardighetPairs
} from '../src/lib/likvardighet.js';

// ---- Helpers ----
function orgRows({ aid, bas, label, kvLons = [], maLons = [] }) {
    const rows = [];
    kvLons.forEach(lon => rows.push({ aid, bas, lon, kon: 'kvinna', yrkeLabel: label }));
    maLons.forEach(lon => rows.push({ aid, bas, lon, kon: 'man', yrkeLabel: label }));
    return rows;
}
function statRow({ aid, bas, median, andelKv, aidFull, nKv, nMa }) {
    return { aid, bas, median, andelKv, aidFull, nKv, nMa };
}
// SCB-stub: prefix "20" → mansdominerat (20% kvinnor), prefix "90" → kvinnodominerat
const scbStub = (aid) => {
    const p = String(aid).slice(0, 2);
    if (p === '20') return { kvAndel: 20 };
    if (p === '90') return { kvAndel: 85 };
    return null;
};
// Deterministisk RNG-fabrik för bootstrap-determinism
function makeRng() {
    let seed = 0;
    return () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
}
// Bygg en extern BAS-map (jämförelsestatistik) från enkla rader
function statMap(rows) {
    const m = new Map();
    rows.forEach(r => { if (!m.has(r.bas)) m.set(r.bas, []); m.get(r.bas).push(r); });
    return m;
}

// ===================================================================
describe('aggregeraOrgKvDom — Steg 1 klassificering', () => {
    it('klassar grupp med mer än 60 % kvinnor som kvinnodominerad', () => {
        const data = orgRows({ aid: '5301', bas: 'B', label: 'Undersköterska',
            kvLons: [28000, 29000, 30000, 31000, 32000, 33000, 34000],   // 7 kv
            maLons: [30000, 31000, 32000] });                            // 3 ma → 70% kv
        const { orgKvDom } = aggregeraOrgKvDom(data, KVINNO_TROSKEL_DEFAULT);
        expect(orgKvDom).toHaveLength(1);
        expect(orgKvDom[0].aid).toBe('5301');
        expect(orgKvDom[0].kvinnoPct).toBeCloseTo(70, 5);
        expect(orgKvDom[0].median).toBe(31000);
    });

    it('placerar grupp under (100−tröskel) bland interna jämförelseyrken', () => {
        const data = orgRows({ aid: '4000', bas: 'C',
            kvLons: [30000, 31000], maLons: [30000, 31000, 32000, 33000] }); // 33% kv ≤ 40
        const { orgKvDom, orgIckeKv } = aggregeraOrgKvDom(data, 60);
        expect(orgKvDom).toHaveLength(0);
        expect(orgIckeKv).toHaveLength(1);
        expect(orgIckeKv[0].aid).toBe('4000');
    });

    it('blandad grupp (mellan trösklarna) hamnar i varken kv-dom eller intern', () => {
        const data = orgRows({ aid: '3000', bas: 'C',
            kvLons: [30000, 31000, 32000, 33000, 34000],          // 5 kv
            maLons: [30000, 31000, 32000, 33000, 34000] });        // 5 ma → 50%
        const { orgKvDom, orgIckeKv } = aggregeraOrgKvDom(data, 60);
        expect(orgKvDom).toHaveLength(0);
        expect(orgIckeKv).toHaveLength(0);
    });

    it('separerar samma AID i olika BAS', () => {
        const data = [
            ...orgRows({ aid: '5301', bas: 'A', kvLons: [25000, 26000, 27000], maLons: [] }),
            ...orgRows({ aid: '5301', bas: 'B', kvLons: [31000, 32000, 33000], maLons: [] })
        ];
        const { orgKvDom, antalAidxBas } = aggregeraOrgKvDom(data, 60);
        expect(antalAidxBas).toBe(2);
        expect(orgKvDom.map(g => g.bas).sort()).toEqual(['A', 'B']);
    });

    it('räknar grupper med n < K i diagnostiken (men inkluderar dem)', () => {
        const data = orgRows({ aid: '5301', bas: 'B', kvLons: [30000, 31000, 32000], maLons: [] }); // n=3 < 10
        const { orgKvDom, kvDomMedNLessThanK } = aggregeraOrgKvDom(data, 60, 10);
        expect(orgKvDom).toHaveLength(1);            // INTE maskerad
        expect(kvDomMedNLessThanK).toBe(1);
    });

    it('ignorerar rader utan lön eller bas', () => {
        const data = [
            { aid: '5301', bas: 'B', lon: 0, kon: 'kvinna' },
            { aid: '5301', bas: '', lon: 30000, kon: 'kvinna' },
            { aid: '', bas: 'B', lon: 30000, kon: 'kvinna' }
        ];
        const { orgKvDom, antalAidxBas } = aggregeraOrgKvDom(data, 60);
        expect(antalAidxBas).toBe(0);
        expect(orgKvDom).toHaveLength(0);
    });
});

// ===================================================================
describe('klassificeraStatistik — Steg 2 klassificering', () => {
    it('använder lokal könsdata före SCB-fallback', () => {
        const stat = [statRow({ aid: '2051', bas: 'B', median: 38000, andelKv: 30, aidFull: '2051 Ingenjör' })];
        const { statIckeKv, klassKalla } = klassificeraStatistik(stat, scbStub);
        expect(statIckeKv).toHaveLength(1);
        expect(statIckeKv[0].källa).toBe('lokal');
        expect(klassKalla.lokal).toBe(1);
        expect(klassKalla.scb).toBe(0);
    });

    it('faller tillbaka på SCB när lokal könsdata saknas', () => {
        const stat = [statRow({ aid: '2051', bas: 'B', median: 38000, andelKv: null, aidFull: '2051 Ingenjör' })];
        const { statIckeKv, klassKalla } = klassificeraStatistik(stat, scbStub);
        expect(statIckeKv).toHaveLength(1);                 // prefix 20 → 20% kv → icke-kv
        expect(statIckeKv[0].källa).toBe('scb');
        expect(klassKalla.scb).toBe(1);
    });

    it('klassar >40% och <60% som blandat (skippas)', () => {
        const stat = [statRow({ aid: '3000', bas: 'B', median: 35000, andelKv: 50 })];
        const { statIckeKv, klass } = klassificeraStatistik(stat, scbStub);
        expect(statIckeKv).toHaveLength(0);
        expect(klass.blandat).toBe(1);
    });

    it('klassar mer än 60 % som kvinnodominerat (skippas)', () => {
        const stat = [statRow({ aid: '5301', bas: 'B', median: 31000, andelKv: 80 })];
        const { statIckeKv, klass } = klassificeraStatistik(stat, scbStub);
        expect(statIckeKv).toHaveLength(0);
        expect(klass.kvDom).toBe(1);
    });

    it('räknar oklassificerade när varken lokal eller SCB ger svar', () => {
        const stat = [statRow({ aid: '4444', bas: 'B', median: 35000, andelKv: null })];
        const { statIckeKv, klass } = klassificeraStatistik(stat, scbStub);   // prefix 44 → null
        expect(statIckeKv).toHaveLength(0);
        expect(klass.oklassificerad).toBe(1);
    });

    it('hoppar över yrkesfamiljerubriker (icke-numeriskt AID) och median ≤ 0', () => {
        const stat = [
            statRow({ aid: '5 Vård', bas: 'B', median: 30000, andelKv: 20 }),
            statRow({ aid: '2051', bas: 'B', median: 0, andelKv: 20 })
        ];
        const { statIckeKv } = klassificeraStatistik(stat, scbStub);
        expect(statIckeKv).toHaveLength(0);
    });
});

// ===================================================================
describe('byggPar — Steg 3 parbygge (v4 intern/extern)', () => {
    const orgKvDom = [
        { aid: '5301', bas: 'B', label: 'Undersköterska', n: 20, nKv: 16, kvinnoPct: 80, median: 30000, lons: Array(20).fill(30000) }
    ];
    const tomMap = () => new Map();

    it('flaggar externt par där statistikens median > org-median inom samma BAS', () => {
        const ext = statMap([{ aid: '2051', bas: 'B', label: 'Ingenjör', median: 38000, kvAndel: 25, källa: 'lokal' }]);
        const { pairs, jämförelse } = byggPar(orgKvDom, tomMap(), ext, { minGap: 0, topN: 100, rng: makeRng() });
        expect(pairs).toHaveLength(1);
        expect(pairs[0].gapKr).toBe(8000);
        expect(pairs[0].gapPct).toBeCloseTo(26.6667, 3);
        expect(pairs[0].jamforKalla).toBe('extern');
        expect(jämförelse.statHögre).toBe(1);
        expect(jämförelse.externaPar).toBe(1);
        expect(jämförelse.basMedExternFallback).toBe(1);
    });

    it('prioriterar internt jämförelseyrke framför statistiken i samma BAS', () => {
        const intern = orgIckeKvByBas([
            { aid: '7001', bas: 'B', label: 'Tekniker', n: 12, nKv: 2, kvinnoPct: 16.7, median: 35000, lons: Array(12).fill(35000) }
        ]);
        const ext = statMap([{ aid: '2051', bas: 'B', median: 38000, kvAndel: 25, källa: 'lokal' }]);
        const { pairs, jämförelse } = byggPar(orgKvDom, intern, ext, { minGap: 0, topN: 100, rng: makeRng() });
        expect(pairs).toHaveLength(1);
        expect(pairs[0].jamforKalla).toBe('intern');
        expect(pairs[0].maAid).toBe('7001');
        expect(pairs[0].maN).toBe(12);
        expect(jämförelse.internaPar).toBe(1);
        expect(jämförelse.externaPar).toBe(0);
        expect(jämförelse.basMedExternFallback).toBe(0);
    });

    it('faller tillbaka på statistiken i BAS som saknar internt jämförelseyrke', () => {
        const org2 = [
            { aid: '5301', bas: 'B', label: 'Usk', n: 20, nKv: 16, kvinnoPct: 80, median: 30000, lons: Array(20).fill(30000) },
            { aid: '5302', bas: 'C', label: 'Vårdbiträde', n: 10, nKv: 9, kvinnoPct: 90, median: 28000, lons: Array(10).fill(28000) }
        ];
        const intern = orgIckeKvByBas([
            { aid: '7001', bas: 'B', label: 'Tekniker', n: 12, nKv: 2, kvinnoPct: 16.7, median: 35000, lons: Array(12).fill(35000) }
        ]); // bara BAS B
        const ext = statMap([{ aid: '2051', bas: 'C', median: 40000, kvAndel: 25, källa: 'lokal' }]); // bara BAS C
        const { pairs, jämförelse } = byggPar(org2, intern, ext, { minGap: 0, topN: 100, rng: makeRng() });
        expect(pairs).toHaveLength(2);
        const internt = pairs.find(p => p.kvBas === 'B');
        const externt = pairs.find(p => p.kvBas === 'C');
        expect(internt.jamforKalla).toBe('intern');
        expect(externt.jamforKalla).toBe('extern');
        expect(jämförelse.internaPar).toBe(1);
        expect(jämförelse.externaPar).toBe(1);
        expect(jämförelse.basMedExternFallback).toBe(1);
    });

    it('utesluter par där jämförelseyrket ≤ organisationens', () => {
        const ext = statMap([{ aid: '2051', bas: 'B', median: 29000, kvAndel: 25, källa: 'lokal' }]);
        const { pairs, jämförelse } = byggPar(orgKvDom, tomMap(), ext, { minGap: 0, topN: 100, rng: makeRng() });
        expect(pairs).toHaveLength(0);
        expect(jämförelse.statLägreEllerLika).toBe(1);
    });

    it('utesluter par i andra BAS-intervall', () => {
        const ext = statMap([{ aid: '2051', bas: 'C', median: 45000, kvAndel: 25, källa: 'lokal' }]);
        const { pairs, jämförelse } = byggPar(orgKvDom, tomMap(), ext, { minGap: 0, topN: 100, rng: makeRng() });
        expect(pairs).toHaveLength(0);
        expect(jämförelse.gemensammaBas).toBe(0);
    });

    it('filtrerar bort par under min-gap-tröskeln', () => {
        const ext = statMap([{ aid: '2051', bas: 'B', median: 30600, kvAndel: 25, källa: 'lokal' }]); // 2% gap
        const { pairs } = byggPar(orgKvDom, tomMap(), ext, { minGap: 5, topN: 100, rng: makeRng() });
        expect(pairs).toHaveLength(0);
    });

    it('sorterar fallande på gapPct och respekterar topN', () => {
        const ext = statMap([
            { aid: '2051', bas: 'B', median: 33000, kvAndel: 25, källa: 'lokal' }, // 10%
            { aid: '2052', bas: 'B', median: 39000, kvAndel: 25, källa: 'lokal' }, // 30%
            { aid: '2053', bas: 'B', median: 36000, kvAndel: 25, källa: 'lokal' }  // 20%
        ]);
        const { pairs } = byggPar(orgKvDom, tomMap(), ext, { minGap: 0, topN: 2, rng: makeRng() });
        expect(pairs).toHaveLength(2);
        expect(pairs[0].maAid).toBe('2052');   // störst gap först
        expect(pairs[1].maAid).toBe('2053');
    });

    it('sätter påverkansindex = |gap| × n_organisation', () => {
        const ext = statMap([{ aid: '2051', bas: 'B', median: 38000, kvAndel: 25, källa: 'lokal' }]);
        const { pairs } = byggPar(orgKvDom, tomMap(), ext, { minGap: 0, topN: 100, rng: makeRng() });
        expect(pairs[0].allvarsindex).toBe(8000 * 20);
    });

    it('beräknar gapCI på varje par (intern → diff-bootstrap, extern → konstant-bootstrap)', () => {
        const intern = orgIckeKvByBas([
            { aid: '7001', bas: 'B', label: 'Tekniker', n: 12, nKv: 2, kvinnoPct: 16.7, median: 35000, lons: Array(12).fill(35000) }
        ]);
        const { pairs } = byggPar(orgKvDom, intern, new Map(), { minGap: 0, topN: 100, rng: makeRng() });
        expect(pairs).toHaveLength(1);
        expect(pairs[0].gapCI).not.toBeNull();
        expect(pairs[0].gapCI.lo).toBeLessThanOrEqual(pairs[0].gapCI.hi);
    });
});

// ===================================================================
describe('computeLikvardighetPairs — full pipeline (v4)', () => {
    it('end-to-end: internt jämförelseyrke är primärt över jämförelsestatistiken', () => {
        const rng = makeRng();
        const data = [
            ...orgRows({ aid: '5301', bas: 'B', label: 'Undersköterska',
                kvLons: Array(16).fill(30000), maLons: Array(4).fill(30000) }),   // 80% kv, n=20
            ...orgRows({ aid: '7001', bas: 'B', label: 'Tekniker',
                kvLons: Array(2).fill(36000), maLons: Array(10).fill(36000) })     // 16.7% kv → intern jämf
        ];
        const statistik = [
            statRow({ aid: '2051', bas: 'B', median: 99000, andelKv: 25, aidFull: '2051 Ingenjör' })
        ];
        const res = computeLikvardighetPairs({ data, statistik, scbKlass: scbStub,
            opts: { kvinnoTrosholdPct: 60, minGapPct: 5, topN: 100, rng } });
        expect(res.orgKvDom).toHaveLength(1);
        expect(res.orgIckeKv).toHaveLength(1);
        expect(res.pairs).toHaveLength(1);
        expect(res.pairs[0].jamforKalla).toBe('intern');     // intern vinner, INTE 2051
        expect(res.pairs[0].maAid).toBe('7001');
        expect(res.diagnostik.organisation.ickeKvFunna).toBe(1);
        expect(res.diagnostik.jämförelse.internaPar).toBe(1);
    });

    it('använder statistiken som reserv när organisationen saknar internt jämförelseyrke', () => {
        const rng = makeRng();
        const data = orgRows({ aid: '5301', bas: 'B', label: 'Undersköterska',
            kvLons: Array(16).fill(30000), maLons: Array(4).fill(30000) });   // bara kv-dom, inga interna
        const statistik = [
            statRow({ aid: '2051', bas: 'B', median: 38000, andelKv: 25, aidFull: '2051 Ingenjör' }),
            statRow({ aid: '7000', bas: 'B', median: 41000, andelKv: 75, aidFull: '7000 Chef' })  // kv-dom → skippas
        ];
        const res = computeLikvardighetPairs({ data, statistik, scbKlass: scbStub,
            opts: { kvinnoTrosholdPct: 60, minGapPct: 5, topN: 100, rng } });
        expect(res.orgIckeKv).toHaveLength(0);
        expect(res.statIckeKv).toHaveLength(1);
        expect(res.pairs).toHaveLength(1);
        expect(res.pairs[0].jamforKalla).toBe('extern');
        expect(res.pairs[0].maAid).toBe('2051');
        expect(res.diagnostik.jämförelse.externaPar).toBe(1);
        expect(res.diagnostik.jämförelse.basMedExternFallback).toBe(1);
    });

    it('ger tomt resultat utan jämförbara BAS-intervall', () => {
        const data = orgRows({ aid: '5301', bas: 'A', kvLons: Array(12).fill(28000), maLons: [] });
        const statistik = [statRow({ aid: '2051', bas: 'C', median: 40000, andelKv: 20 })];
        const res = computeLikvardighetPairs({ data, statistik, scbKlass: scbStub });
        expect(res.pairs).toHaveLength(0);
        expect(res.diagnostik.jämförelse.gemensammaBas).toBe(0);
    });
});

// ===================================================================
describe('bootstrapMedianDiffKr', () => {
    it('returnerar null vid för få observationer', () => {
        expect(bootstrapMedianDiffKr([1, 2], [1, 2, 3], 100)).toBeNull();
    });

    it('ger ett intervall som omsluter den sanna medianskillnaden', () => {
        const kv = Array.from({ length: 50 }, (_, i) => 28000 + i * 50);
        const ma = Array.from({ length: 50 }, (_, i) => 33000 + i * 50);
        const ci = bootstrapMedianDiffKr(kv, ma, 500);
        expect(ci).not.toBeNull();
        expect(ci.lo).toBeLessThanOrEqual(ci.hi);
        expect(ci.hi).toBeGreaterThan(0);   // ma tjänar mer
    });

    it('är deterministisk med injicerad RNG', () => {
        const kv = [10, 20, 30, 40, 50], ma = [60, 70, 80, 90, 100];
        const a = bootstrapMedianDiffKr(kv, ma, 200, makeRng());
        const b = bootstrapMedianDiffKr(kv, ma, 200, makeRng());
        expect(a).toEqual(b);
    });
});

describe('bootstrapMedianVsConstantKr', () => {
    it('returnerar null vid för få observationer eller ogiltig konstant', () => {
        expect(bootstrapMedianVsConstantKr([1, 2], 30000, 100)).toBeNull();
        expect(bootstrapMedianVsConstantKr([1, 2, 3], 0, 100)).toBeNull();
    });

    it('positiv differens när konstanten ligger över urvalets median', () => {
        const org = Array.from({ length: 30 }, () => 30000);
        const ci = bootstrapMedianVsConstantKr(org, 38000, 300, makeRng());
        expect(ci).not.toBeNull();
        expect(ci.lo).toBe(8000);   // konstant 38000 − median 30000
        expect(ci.hi).toBe(8000);
    });
});

describe('konstanter', () => {
    it('exponerar trösklar', () => {
        expect(KVINNO_TROSKEL_DEFAULT).toBe(60);
        expect(ICKE_KV_TAK).toBe(40);
    });
});

// ===================================================================
describe('byggParPoäng — #5: arbetsvärdering som krav-proxy', () => {
    // Kvinnodominerat yrke med LÄGRE lön, jämförelseyrke i ANNAN BAS men
    // likvärdiga krav enligt poäng → ska paras (BAS-läge skulle missa det).
    const kv = [{ aid: '5301', bas: 'B', label: 'Undersköterska', n: 10, nKv: 8,
        kvinnoPct: 80, median: 30000, lons: [29000, 30000, 31000] }];
    const internIckeKv = [{ aid: '4100', bas: 'D', label: 'Tekniker', n: 9, nKv: 1,
        kvinnoPct: 11, median: 34000, lons: [33000, 34000, 35000] }];

    it('parar kvinnodominerat mot likvärdigt (poäng inom band) i annan BAS', () => {
        const poang = new Map([['5301|B', 100], ['4100|D', 100]]);   // lika poäng
        const { pairs, jämförelse } = byggParPoäng(kv, internIckeKv, [], poang,
            { rng: makeRng(), bandPct: 5 });
        expect(pairs).toHaveLength(1);
        expect(pairs[0].maAid).toBe('4100');
        expect(pairs[0].maBas).toBe('D');           // korsar BAS-gräns
        expect(pairs[0].kvPoang).toBe(100);
        expect(pairs[0].maPoang).toBe(100);
        expect(jämförelse.kravProxy).toBe('poäng');
        expect(jämförelse.internaPar).toBe(1);
    });

    it('exkluderar jämförelseyrke med HÖGRE krav (poäng över bandet)', () => {
        const poang = new Map([['5301|B', 100], ['4100|D', 130]]);  // 130 > 100*1.05
        const { pairs } = byggParPoäng(kv, internIckeKv, [], poang, { rng: makeRng(), bandPct: 5 });
        expect(pairs).toHaveLength(0);
    });

    it('inkluderar jämförelseyrke med LÄGRE krav (lägre poäng) och högre lön', () => {
        const poang = new Map([['5301|B', 100], ['4100|D', 70]]);   // lägre krav, högre lön
        const { pairs } = byggParPoäng(kv, internIckeKv, [], poang, { rng: makeRng(), bandPct: 5 });
        expect(pairs).toHaveLength(1);
    });

    it('räknar kv-dom yrken utan poäng som kvUtanPoang', () => {
        const poang = new Map([['4100|D', 100]]);   // saknar 5301
        const { pairs, jämförelse } = byggParPoäng(kv, internIckeKv, [], poang, { rng: makeRng() });
        expect(pairs).toHaveLength(0);
        expect(jämförelse.kvUtanPoang).toBe(1);
    });

    it('computeLikvardighetPairs väljer poäng-läge när poangByKey finns', () => {
        const data = [
            ...orgRows({ aid: '5301', bas: 'B', label: 'Undersköterska',
                kvLons: [29000, 30000, 31000, 30000, 30000, 30000, 30000, 30000], maLons: [30000, 30000] }),
            ...orgRows({ aid: '4100', bas: 'D', label: 'Tekniker',
                kvLons: [34000], maLons: [33000, 34000, 35000, 34000, 34000, 34000, 34000, 34000, 34000] })
        ];
        const poangByKey = new Map([['5301|B', 100], ['4100|D', 100]]);
        const res = computeLikvardighetPairs({ data, statistik: [], scbKlass: scbStub,
            opts: { poangByKey, poangBandPct: 5, rng: makeRng() } });
        expect(res.diagnostik.jämförelse.kravProxy).toBe('poäng');
        expect(res.pairs.length).toBe(1);
        expect(res.pairs[0].maAid).toBe('4100');
    });

    it('faller tillbaka på BAS-läge utan poangByKey (oförändrat)', () => {
        const data = orgRows({ aid: '5301', bas: 'B', label: 'Undersköterska',
            kvLons: [29000, 30000, 31000], maLons: [30000] });
        const res = computeLikvardighetPairs({ data, statistik: [], scbKlass: scbStub,
            opts: { rng: makeRng() } });
        expect(res.diagnostik.jämförelse.kravProxy).toBe('bas');
    });
});

describe('lägre krav, högre lön', () => {
    const grupp = (aid, bas, kv, ma, lon) => [
        ...Array.from({ length: kv }, (_, i) => ({ aid, bas, lon: lon + i, kon: 'kvinna', yrkeLabel: `Yrke ${aid}` })),
        ...Array.from({ length: ma }, (_, i) => ({ aid, bas, lon: lon + i, kon: 'man', yrkeLabel: `Yrke ${aid}` })),
    ];
    const rng = () => 0.5;
    const kor = (data, opts = {}) => computeLikvardighetPairs({ data, opts: { rng, B: 50, ...opts } });

    it('par mot icke-kvinnodominerat yrke i lägre BAS med högre median', () => {
        const r = kor([...grupp('100', 'E', 18, 2, 30000), ...grupp('200', 'C', 2, 18, 34000)]);
        expect(r.lagreKrav).toHaveLength(1);
        const p = r.lagreKrav[0];
        expect(p).toMatchObject({ kvAid: '100', kvBas: 'E', maAid: '200', maBas: 'C', basSteg: 2, jamforKalla: 'intern' });
        expect(p.gapKr).toBeGreaterThan(0);
        expect(p.gapCI).not.toBeNull();
    });
    it('samma BAS, högre BAS och lägre eller lika median ger inget par', () => {
        expect(kor([...grupp('100', 'E', 18, 2, 30000), ...grupp('200', 'E', 2, 18, 34000)]).lagreKrav).toEqual([]);
        expect(kor([...grupp('100', 'C', 18, 2, 30000), ...grupp('200', 'E', 2, 18, 34000)]).lagreKrav).toEqual([]);
        expect(kor([...grupp('100', 'E', 18, 2, 34000), ...grupp('200', 'C', 2, 18, 30000)]).lagreKrav).toEqual([]);
        expect(kor([...grupp('100', 'E', 18, 2, 30000), ...grupp('200', 'C', 2, 18, 30000)]).lagreKrav).toEqual([]);
    });
    it('minGapPct gäller', () => {
        const d = [...grupp('100', 'E', 18, 2, 30000), ...grupp('200', 'C', 2, 18, 31000)];   // ~3,3 %
        expect(kor(d, { minGapPct: 5 }).lagreKrav).toEqual([]);
        expect(kor(d, { minGapPct: 3 }).lagreKrav).toHaveLength(1);
    });
    it('BAS-ordningen är fast: ett basRang i opts ignoreras (se §5 i teknisk-plan.md)', () => {
        const d = [...grupp('100', 'E', 18, 2, 30000), ...grupp('200', 'C', 2, 18, 34000)];
        expect(kor(d, { basRang: { C: 5, E: 3 } }).lagreKrav[0].basSteg).toBe(2);
    });
    it('sortering: störst skillnad först, sedan fler BAS-steg', () => {
        const d = [...grupp('100', 'F', 18, 2, 30000), ...grupp('200', 'D', 2, 18, 33000), ...grupp('300', 'B', 2, 18, 36000)];
        expect(kor(d).lagreKrav.map(p => p.maAid)).toEqual(['300', '200']);
    });
    it('poängläget: lagreKrav är tom', () => {
        const d = [...grupp('100', 'E', 18, 2, 30000), ...grupp('200', 'C', 2, 18, 34000)];
        const poangByKey = new Map([['100', 50], ['200', 40]]);
        expect(kor(d, { poangByKey }).lagreKrav).toEqual([]);
    });
    it('dagens pairs är oförändrade', () => {
        const d = [...grupp('100', 'E', 18, 2, 30000), ...grupp('200', 'E', 2, 18, 33000), ...grupp('300', 'C', 2, 18, 36000)];
        const r = kor(d);
        expect(r.pairs.map(p => [p.kvAid, p.maAid])).toEqual([['100', '200']]);
        expect(r.lagreKrav.map(p => [p.kvAid, p.maAid])).toEqual([['100', '300']]);
    });
    it('byggParLagreKrav direkt: kvinnodominerat yrke i lägsta BAS ger inga par', () => {
        const f = [{ aid: '1', bas: 'A', label: 'x', n: 20, nKv: 18, kvinnoPct: 90, median: 30000, lons: [30000] }];
        const g = [{ aid: '2', bas: 'A', label: 'y', n: 20, nKv: 2, kvinnoPct: 10, median: 40000, lons: [40000] }];
        expect(byggParLagreKrav(f, g, { rang: b => b.charCodeAt(0), rng })).toEqual([]);
    });
});

describe('lägre krav: konfidensintervall bara för de par som behålls', () => {
    it('topN = 1 kostar lika många slumptal som en enda kandidat', () => {
        const g = (aid, bas, median, n = 12) => ({ aid, bas, label: aid, n, nKv: bas === 'E' ? n : 0, kvinnoPct: bas === 'E' ? 100 : 0, median, lons: Array.from({ length: n }, (_, i) => median + i) });
        const kv = [g('K', 'E', 30000)];
        const ma = [g('M1', 'C', 40000), g('M2', 'B', 38000), g('M3', 'A', 36000)];
        let anrop = 0; const rng = () => { anrop++; return 0.5; };
        byggParLagreKrav(kv, ma, { rang: b => b.charCodeAt(0), topN: 1, B: 20, rng });
        const medTopp1 = anrop; anrop = 0;
        byggParLagreKrav(kv, [ma[0]], { rang: b => b.charCodeAt(0), topN: 1, B: 20, rng });
        expect(medTopp1).toBe(anrop);
    });
});

describe('basRangFn: BAS-steg i bokstäver (se §5 i teknisk-plan.md)', () => {
    it('A=1 och B → D är två steg även när C saknas', async () => {
        const { basRangFn } = await import('../src/lib/likvardighet.js');
        const rang = basRangFn(['A', 'B', 'D', 'E']);
        expect(rang('A')).toBe(1);
        expect(rang('D') - rang('B')).toBe(2);
        expect(rang('j')).toBe(10);
    });
});

// ===================================================================
describe('aldersjusteradSkillnad — jämförelseyrkets lön omräknad till den kvinnodominerade gruppens åldrar', () => {
    // Samma lönekurva i båda yrkena: lön = 20 000 × exp(0,02 × ålder). Skillnaden i rå median
    // beror då helt på att yrkena har olika åldrar.
    const kurva = alder => 20000 * Math.exp(0.02 * alder);
    const yrke = (aldrar, lonFn = kurva) => aldrar.map(alder => ({ lon: lonFn(alder), alder }));
    const unga = [24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35];
    const aldre = [45, 46, 47, 48, 49, 50, 51, 52, 53, 54, 55, 56];
    const råPct = (kv, ma) => { const m = a => { const x = a.map(r => r.lon).sort((p, q) => p - q); return (x[x.length / 2 - 1] + x[x.length / 2]) / 2; }; return (m(ma) - m(kv)) / m(kv) * 100; };

    it('ung kvinnodominerad grupp mot äldre jämförelseyrke med samma lönekurva: rå skillnad > 0 men justerad ≈ 0', () => {
        const kv = yrke(unga), ma = yrke(aldre);
        expect(råPct(kv, ma)).toBeGreaterThan(30);
        const j = aldersjusteradSkillnad(kv, ma, { golv: 10 });
        expect(j).not.toBeNull();
        expect(j.metod).toBe('alder');
        expect(Math.abs(j.gapPct)).toBeLessThan(0.01);
        expect(Math.abs(j.gapKr)).toBeLessThan(5);
        expect(Math.abs(j.medianJusterad - kurva(29.5))).toBeLessThan(5);   // medianen av två prediktioner, inte kurvan mitt emellan
    });

    it('samma åldersfördelning: justerad ≈ rå', () => {
        const kv = yrke(unga), ma = yrke(unga, a => kurva(a) * 1.1);   // 10 % högre vid varje ålder
        const j = aldersjusteradSkillnad(kv, ma, { golv: 10 });
        expect(j).not.toBeNull();
        expect(j.gapPct).toBeCloseTo(råPct(kv, ma), 3);
        expect(j.gapPct).toBeCloseTo(10, 3);
    });

    it('för litet jämförelseyrke (under golvet) ger null; för liten åldersspridning ger null', () => {
        const kv = yrke(unga);
        expect(aldersjusteradSkillnad(kv, yrke(aldre.slice(0, 9)), { golv: 10 })).toBeNull();
        expect(aldersjusteradSkillnad(kv, yrke(aldre.slice(0, 9)), { golv: 9 })).not.toBeNull();
        expect(aldersjusteradSkillnad(kv, yrke([40, 41, 42, 43, 44, 40, 41, 42, 43, 44, 40, 41]), { golv: 10 })).toBeNull();
        expect(aldersjusteradSkillnad(kv, yrke(aldre).map(r => ({ lon: r.lon })), { golv: 10 })).toBeNull();   // åldrar saknas
        expect(aldersjusteradSkillnad([], yrke(aldre), { golv: 10 })).toBeNull();
    });

    it('byggPar fyller fältet på interna par och sätter null på externa; medelåldrar följer med', () => {
        const rows = [];
        unga.forEach(alder => rows.push({ aid: '5301', bas: 'B', lon: kurva(alder), alder, kon: 'kvinna', yrkeLabel: 'Undersköterska' }));
        aldre.forEach(alder => rows.push({ aid: '4100', bas: 'B', lon: kurva(alder), alder, kon: 'man', yrkeLabel: 'Tekniker' }));
        unga.forEach(alder => rows.push({ aid: '5302', bas: 'C', lon: kurva(alder), alder, kon: 'kvinna', yrkeLabel: 'Barnskötare' }));
        const { orgKvDom, orgIckeKv } = aggregeraOrgKvDom(rows, 60);
        expect(orgKvDom[0].aldrar).toHaveLength(12);
        const extern = statMap([statRow({ aid: '2051', bas: 'C', median: 60000, andelKv: 20 })]);
        const { pairs } = byggPar(orgKvDom, orgIckeKvByBas(orgIckeKv), extern, { B: 20, rng: makeRng() });
        const intern = pairs.find(p => p.jamforKalla === 'intern');
        const ext = pairs.find(p => p.jamforKalla === 'extern');
        expect(intern.gapPct).toBeGreaterThan(30);
        expect(Math.abs(intern.aldersJusterad.gapPct)).toBeLessThan(0.01);
        expect(intern.kvMedelAlder).toBeCloseTo(29.5, 5);
        expect(intern.maMedelAlder).toBeCloseTo(50.5, 5);
        expect(ext.aldersJusterad).toBeNull();
        expect(ext.maMedelAlder).toBeNull();
        expect(ext.kvMedelAlder).toBeCloseTo(29.5, 5);
    });

    it('byggParPoäng fyller fältet på samma sätt', () => {
        const rows = [];
        unga.forEach(alder => rows.push({ aid: '5301', bas: 'B', lon: kurva(alder), alder, kon: 'kvinna', yrkeLabel: 'Undersköterska' }));
        aldre.forEach(alder => rows.push({ aid: '4100', bas: 'C', lon: kurva(alder), alder, kon: 'man', yrkeLabel: 'Tekniker' }));
        const { orgKvDom, orgIckeKv } = aggregeraOrgKvDom(rows, 60);
        const poang = new Map([['5301', 300], ['4100', 300]]);
        const { pairs } = byggParPoäng(orgKvDom, orgIckeKv, [], poang, { B: 20, rng: makeRng() });
        expect(pairs).toHaveLength(1);
        expect(Math.abs(pairs[0].aldersJusterad.gapPct)).toBeLessThan(0.01);
        expect(pairs[0].kvMedelAlder).toBeCloseTo(29.5, 5);
    });

    it('rader utan ålder ger null på paret men paret finns kvar', () => {
        const rows = [];
        unga.forEach(alder => rows.push({ aid: '5301', bas: 'B', lon: kurva(alder), kon: 'kvinna' }));
        aldre.forEach(alder => rows.push({ aid: '4100', bas: 'B', lon: kurva(alder), kon: 'man' }));
        const { pairs } = computeLikvardighetPairs({ data: rows, opts: { B: 20, rng: makeRng() } });
        expect(pairs).toHaveLength(1);
        expect(pairs[0].aldersJusterad).toBeNull();
        expect(pairs[0].kvMedelAlder).toBeNull();
    });
});

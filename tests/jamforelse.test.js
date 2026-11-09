/**
 * Jämförelsestatistik: organisationens P10/median/P90 mot jämförelsestatistiken och ställningstagandet.
 */
import { describe, it, expect } from 'vitest';
import { jamforelseRader, avvikelseRangordning, aidAvYrke, statistikFor, matchningEtikett, matchningAntal, matchningSammanfattning,
    statistikMarknad, statistikensMedianFor } from '../src/lib/jamforelse.js';
import { marketTargets } from '../src/lib/loneoversyn.js';

const grupp = (yrke, bas, loner) => loner.map(lon => ({ yrke, bas, lon }));
const tio = (_bas = 'C', start = 30000) => Array.from({ length: 10 }, (_, i) => start + i * 1000);   // 30 000 … 39 000

describe('jamforelse: organisationens percentiler och skillnader', () => {
    it('räknar P10, median och P90 som quantile och skillnaden mot statistiken', () => {
        const { rader } = jamforelseRader(grupp('402010 Förskollärare', 'C', tio()),
            { statistik: [{ aid: '402010', bas: 'C', p10: 31000, median: 35000, p90: 40000 }], policyFor: () => null, k: 10 });
        expect(rader).toHaveLength(1);
        const r = rader[0];
        expect(r).toMatchObject({ aid: '402010', yrke: '402010 Förskollärare', bas: 'C', n: 10,
            sektor: 'Förskole-, skol-, fritids- och annan pedagogisk verksamhet' });
        expect(r.org).toEqual({ p10: 30900, median: 34500, p90: 38100 });
        expect(r.statistik).toEqual({ p10: 31000, median: 35000, p90: 40000 });
        expect(r.diff.statistik.median.kr).toBeCloseTo(-500, 9);
        expect(r.diff.statistik.median.pct).toBeCloseTo((34500 / 35000 - 1) * 100, 9);
        expect(r.diff.statistik.p90.pct).toBeCloseTo((38100 / 40000 - 1) * 100, 9);
        expect(r.stallningstagande).toEqual({ p10: null, median: null, p90: null });
        expect(r.diff.stallningstagande).toEqual({ p10: null, median: null, p90: null });
    });
    it('ställningstagandet via injicerad policyFor(aid, bas) med fälten p10/med/p90', () => {
        const anrop = [];
        const policyFor = (aid, bas) => { anrop.push([aid, bas]); return { p10: 30000, med: 34000, p90: 39000 }; };
        const r = jamforelseRader(grupp('402010 Förskollärare', 'C', tio()), { statistik: [], policyFor, k: 10 }).rader[0];
        expect(anrop).toEqual([['402010', 'C']]);
        expect(r.stallningstagande).toEqual({ p10: 30000, median: 34000, p90: 39000 });
        expect(r.diff.stallningstagande.median.kr).toBeCloseTo(500, 9);
    });
});

describe('jamforelse: matchning mot jämförelsestatistiken', () => {
    const data = [...grupp('207011 Undersköterska', 'B', tio('B', 28000)), ...grupp('207011 Undersköterska', 'C', tio('C', 30000))];
    it('AID + BAS först, annars AID utan BAS', () => {
        const statistik = [{ aid: '207011', bas: '', median: 33000 }, { aid: '207011', bas: 'C', median: 36000 }];
        const { rader } = jamforelseRader(data, { statistik, policyFor: () => null, k: 10 });
        expect(rader.map(r => [r.bas, r.statistik.median])).toEqual([['B', 33000], ['C', 36000]]);
    });
    it('värden som saknas eller är ≤ 0 blir null och ger ingen skillnad', () => {
        const { rader } = jamforelseRader(data, { statistik: [{ aid: '207011', bas: 'B', median: 33000, p10: 0 }], policyFor: () => null, k: 10 });
        expect(rader[0].statistik).toEqual({ p10: null, median: 33000, p90: null });
        expect(rader[0].diff.statistik.p10).toBeNull();
        expect(rader[1].statistik).toEqual({ p10: null, median: null, p90: null });
    });
    it('varje rad bär matchningsnivån: aid-bas, aid eller null', () => {
        const statistik = [{ aid: '207011', bas: '', median: 33000 }, { aid: '207011', bas: 'C', median: 36000 }];
        const { rader } = jamforelseRader(data, { statistik, policyFor: () => null, k: 10 });
        expect(rader.map(r => [r.bas, r.statistikMatchning])).toEqual([['B', 'aid'], ['C', 'aid-bas']]);
        const utan = jamforelseRader(data, { statistik: [], policyFor: () => null, k: 10 }).rader;
        expect(utan.map(r => r.statistikMatchning)).toEqual([null, null]);
    });
    it('en rad för ett annat BAS-intervall används aldrig', () => {
        const { rader } = jamforelseRader(data, { statistik: [{ aid: '207011', bas: 'C', median: 36000 }], policyFor: () => null, k: 10 });
        expect(rader.map(r => [r.bas, r.statistik.median, r.statistikMatchning])).toEqual([['B', null, null], ['C', 36000, 'aid-bas']]);
    });
});

describe('jamforelse: statistikFor, det gemensamma uppslaget', () => {
    const utanBas = { aid: '207011', bas: '', median: 33000 }, medC = { aid: '207011', bas: 'C', median: 36000 };
    it('samma AID och BAS först', () => {
        expect(statistikFor([utanBas, medC], '207011', 'C')).toEqual({ rad: medC, matchning: 'aid-bas' });
    });
    it('annars en rad för samma AID utan BAS', () => {
        expect(statistikFor([medC, utanBas], '207011', 'B')).toEqual({ rad: utanBas, matchning: 'aid' });
        expect(statistikFor([{ aid: '207011', median: 1 }], '207011', 'B')).toMatchObject({ matchning: 'aid' });   // fältet saknas helt
    });
    it('aldrig en rad med ett annat BAS, och null utan träff', () => {
        expect(statistikFor([medC], '207011', 'B')).toBeNull();
        expect(statistikFor([medC], '999999', 'C')).toBeNull();
        expect(statistikFor([], '207011', 'C')).toBeNull();
        expect(statistikFor(undefined, '207011', 'C')).toBeNull();
        expect(statistikFor([medC], '', 'C')).toBeNull();
    });
    it('jämför AID och BAS som text', () => {
        expect(statistikFor([{ aid: 207011, bas: 'C', median: 1 }], '207011', 'C')).toMatchObject({ matchning: 'aid-bas' });
        expect(statistikFor([{ aid: '6000', bas: '3', median: 1 }], 6000, 3)).toMatchObject({ matchning: 'aid-bas' });
    });
});

describe('jamforelse: märkningen och antalen per matchningsnivå', () => {
    it('samma ord som ställningstagandets nivåer, "–" utan statistik', () => {
        expect(matchningEtikett('aid-bas')).toBe('AID + BAS');
        expect(matchningEtikett('aid')).toBe('Endast AID');
        expect(matchningEtikett(null)).toBe('–');
        expect(matchningEtikett(undefined)).toBe('–');
    });
    it('räknar raderna per nivå och säger det i en mening', () => {
        const rader = [{ statistikMatchning: 'aid-bas' }, { statistikMatchning: 'aid-bas' }, { statistikMatchning: 'aid' }, { statistikMatchning: null }];
        expect(matchningAntal(rader)).toEqual({ aidBas: 2, aid: 1, utan: 1 });
        expect(matchningSammanfattning(rader)).toBe('Statistiken: 2 yrkesgrupper matchade på AID och BAS, 1 på endast AID, 1 utan statistik.');
        expect(matchningSammanfattning([{ statistikMatchning: 'aid-bas' }])).toBe('Statistiken: 1 yrkesgrupp matchad på AID och BAS, 0 på endast AID, 0 utan statistik.');
        expect(matchningSammanfattning([])).toBe('');
    });
});

// Rättelse (Löneöversyn, marknadspositionering): fallbacken på AID kom från första raden för AID oavsett BAS.
describe('jamforelse: statistikMarknad (Löneöversyns marknadspositionering)', () => {
    it('en grupp får bara sitt eget BAS eller en rad utan BAS, aldrig ett annat BAS', () => {
        const statistik = [{ aid: '1', bas: '5', median: 50000 }, { aid: '2', bas: '', median: 35000 }, { aid: '2', bas: '4', median: 41000 }];
        const grupper = [{ aid: '1', bas: '3', n: 5, median: 30000 }, { aid: '2', bas: '3', n: 5, median: 30000 }, { aid: '2', bas: '4', n: 5, median: 30000 }];
        const marknad = statistikMarknad(statistik, grupper);
        expect([...marknad.entries()]).toEqual([['2|3', 35000], ['2|4', 41000]]);
        // AID 1 har bara en rad för BAS 5: gruppen i BAS 3 får ingen marknadsnivå och inget lyft.
        const t = marketTargets(grupper, marknad, 1, 0);
        expect(t.map(x => [x.aid, x.bas, x.value])).toEqual([['2', '3', 25000], ['2', '4', 55000]]);
    });
    it('rader utan positiv median räknas inte', () => {
        expect(statistikMarknad([{ aid: '1', bas: '3', median: 0 }], [{ aid: '1', bas: '3' }]).size).toBe(0);
    });
});

// Rättelse (Ålder & karriär, hela urvalet): tog första raden per AID oavsett BAS.
describe('jamforelse: statistikensMedianFor (Ålder & karriär)', () => {
    it('slår upp varje AID×BAS-grupp för sig och tar medianen av de matchade medianerna', () => {
        const statistik = [{ aid: '1', bas: '5', median: 50000 }, { aid: '2', bas: '', median: 30000 }, { aid: '3', bas: '3', median: 40000 }];
        // AID 1 har bara en rad för BAS 5: gruppen i BAS 3 får ingen statistik. AID 2 har en rad utan BAS: används.
        expect(statistikensMedianFor(statistik, [{ aid: '1', bas: '3' }, { aid: '2', bas: '3' }, { aid: '3', bas: '3' }])).toBe(35000);
        expect(statistikensMedianFor(statistik, [{ aid: '1', bas: '3' }])).toBeNull();
        expect(statistikensMedianFor(statistik, [{ aid: '1', bas: '5' }, { aid: '1', bas: '3' }])).toBe(50000);
    });
    it('samma grupp räknas en gång', () => {
        const statistik = [{ aid: '1', bas: '3', median: 30000 }, { aid: '2', bas: '3', median: 40000 }];
        expect(statistikensMedianFor(statistik, [{ aid: '1', bas: '3' }, { aid: '1', bas: '3' }, { aid: '1', bas: '3' }, { aid: '2', bas: '3' }])).toBe(35000);
    });
});

describe('jamforelse: små grupper, yrken utan kod och sortering', () => {
    it('grupper under k tas inte med och namnges i AID-ordning med BAS sorterade', () => {
        const data = [...grupp('502010 Systemutvecklare', 'D', [40000, 41000]), ...grupp('207011 Usk', 'C', tio()),
                      ...grupp('502010 Systemutvecklare', 'B', [38000])];
        const { rader, utelamnade } = jamforelseRader(data, { statistik: [], policyFor: () => null, k: 10 });
        expect(rader.map(r => r.aid)).toEqual(['207011']);
        expect(utelamnade).toEqual(['502010 (BAS B)', '502010 (BAS D)']);
    });
    it('yrke utan sifferkod: hela strängen som AID och okänd sektor', () => {
        expect(aidAvYrke('Kock')).toBe('Kock');
        expect(aidAvYrke('5301 Undersköterska')).toBe('5301');
        const r = jamforelseRader(grupp('Kock', 'B', tio('B')), { statistik: [], policyFor: () => null, k: 10 }).rader[0];
        expect(r).toMatchObject({ aid: 'Kock', sektor: 'Okänt huvudområde' });
    });
    it('sorteras på BAS och sedan yrke', () => {
        const data = [...grupp('502010 Sysutv', 'D', tio()), ...grupp('403010 Barnskötare', 'B', tio()), ...grupp('207011 Usk', 'B', tio())];
        const { rader } = jamforelseRader(data, { statistik: [], policyFor: () => null, k: 10 });
        expect(rader.map(r => `${r.bas} ${r.aid}`)).toEqual(['B 207011', 'B 403010', 'D 502010']);
    });
});

describe('jamforelse: avvikelseRangordning', () => {
    it('bara rader med median i båda, mest negativ först', () => {
        const data = [...grupp('100001 A', 'C', tio('C', 30000)), ...grupp('100002 B', 'C', tio('C', 30000)), ...grupp('100003 C', 'C', tio('C', 30000))];
        const statistik = [{ aid: '100001', bas: 'C', median: 30000 }, { aid: '100002', bas: 'C', median: 40000 }];
        const { rader } = jamforelseRader(data, { statistik, policyFor: () => null, k: 10 });
        expect(avvikelseRangordning(rader, 'statistik').map(r => r.aid)).toEqual(['100002', '100001']);
        expect(avvikelseRangordning(rader, 'stallningstagande')).toEqual([]);
    });
});

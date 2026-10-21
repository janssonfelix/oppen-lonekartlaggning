/**
 * Vitest-tester för src/lib/utforska.js — pivotkärnan bakom Utforska-fliken.
 *
 * Täcker: åldersindelning, könsnormalisering, gruppnycklar, filter,
 * mått (median/medel/n/percentiler/spridning/andelKv/gap), k-markering
 * (liten/konLiten — ingenting döljs), uppdelning per kön, två dimensioner
 * och sorteringsreglerna (BAS A→Z, ålder yngst→äldst, övrigt efter värde).
 */
import { describe, it, expect } from 'vitest';
import { computePivot, DIMENSIONER, slaIhopSmaAid } from '../src/lib/utforska.js';
import { groupKey, ageBucket, konOf, jamforAldersgrupp } from '../src/lib/falt.js';
import { median, quantile } from '../src/lib/stat.js';

const rad = (bas, kon, lon, extra = {}) => ({
    bas, kon, lon, alder: 40, aid: '100', yrkeLabel: 'Yrke 100', yrke: '100 Yrke 100', ...extra
});
// nKv kvinnor och nMa män i ett BAS, löner från basLon i steg om 100.
function grupp(bas, nKv, nMa, basLon, extra = {}) {
    const ut = [];
    for (let i = 0; i < nKv; i++) ut.push(rad(bas, 'kvinna', basLon + i * 100, extra));
    for (let i = 0; i < nMa; i++) ut.push(rad(bas, 'man', basLon + 50 + i * 100, extra));
    return ut;
}
const spec = over => ({ rad: 'bas', kolumn: null, matt: 'median', delaKon: false, urval: { lage: 'alla', villkor: [] }, gruppVillkor: [], ...over });

describe('ageBucket', () => {
    it('jamforAldersgrupp sorterar yngst först', () => {
        expect(['65+', '<20', '30–34'].sort(jamforAldersgrupp)).toEqual(['<20', '30–34', '65+']);
    });
    it('delar in i 5-årsgrupper med egna grupper under 20 och från 65', () => {
        expect(ageBucket(19)).toBe('<20');
        expect(ageBucket(20)).toBe('20–24');
        expect(ageBucket(24)).toBe('20–24');
        expect(ageBucket(64)).toBe('60–64');
        expect(ageBucket(65)).toBe('65+');
        expect(ageBucket(80)).toBe('65+');
    });
    it('ger null för saknad eller ogiltig ålder', () => {
        expect(ageBucket(0)).toBeNull();
        expect(ageBucket(null)).toBeNull();
        expect(ageBucket('x')).toBeNull();
    });
});

describe('konOf och groupKey', () => {
    it('normaliserar kön', () => {
        expect(konOf({ kon: 'kvinna' })).toBe('Kvinna');
        expect(konOf({ kon: 'man' })).toBe('Man');
        expect(konOf({ kon: 'män' })).toBe('Man');
        expect(konOf({ kon: '' })).toBe('Övrig/okänd');
    });
    it('bygger nycklar per dimension', () => {
        const r = rad('B', 'kvinna', 30000, { alder: 33 });
        expect(groupKey(r, 'bas')).toBe('B');
        expect(groupKey(r, 'aid')).toBe('100 Yrke 100');
        expect(groupKey(r, 'alder')).toBe('30–34');
        expect(groupKey(r, 'kon')).toBe('Kvinna');
        expect(groupKey({ ...r, bas: '' }, 'bas')).toBe('—');
        expect(groupKey({ ...r, aid: '', yrke: 'Okänt yrke' }, 'aid')).toBe('Okänt yrke');
        expect(groupKey(r, 'finns-inte')).toBeNull();
    });
});

describe('computePivot — en dimension', () => {
    it('sorterar BAS A → Z oavsett värde', () => {
        const rows = [...grupp('C', 6, 6, 20000), ...grupp('A', 6, 6, 40000), ...grupp('B', 6, 6, 30000)];
        expect(computePivot(rows, spec()).radEtiketter).toEqual(['A', 'B', 'C']);
    });
    it('sorterar åldersgrupper från yngst till äldst', () => {
        const rows = [
            ...grupp('A', 6, 6, 40000, { alder: 50 }),
            ...grupp('A', 6, 6, 20000, { alder: 18 }),
            ...grupp('A', 6, 6, 30000, { alder: 66 })
        ];
        expect(computePivot(rows, spec({ rad: 'alder' })).radEtiketter).toEqual(['<20', '50–54', '65+']);
    });
    it('sorterar övriga dimensioner efter värde, fallande — gap stigande', () => {
        const rows = [
            ...grupp('A', 6, 6, 20000, { aid: '1', yrkeLabel: 'Låg', yrke: '1 Låg' }),
            ...grupp('A', 6, 6, 40000, { aid: '2', yrkeLabel: 'Hög', yrke: '2 Hög' })
        ];
        expect(computePivot(rows, spec({ rad: 'aid' })).radEtiketter).toEqual(['2 Hög', '1 Låg']);
        // Gör "Hög" mer ojämställd: kvinnorna i aid 2 tjänar mindre.
        const skev = rows.map(r => (r.aid === '2' && r.kon === 'kvinna') ? { ...r, lon: r.lon - 8000 } : r);
        expect(computePivot(skev, spec({ rad: 'aid', matt: 'gap' })).radEtiketter).toEqual(['2 Hög', '1 Låg']);
    });
    it('döljer ingenting: små grupper räknas och markeras', () => {
        const rows = [...grupp('A', 3, 3, 30000), ...grupp('B', 10, 10, 30000)];
        const m = computePivot(rows, spec());
        const a = m.celler.find(c => c.rad === 'A');
        const b = m.celler.find(c => c.rad === 'B');
        expect(a.n).toBe(6);
        expect(a.liten).toBe(true);
        expect(a.value).toBe(median(rows.filter(r => r.bas === 'A').map(r => r.lon)));
        expect(b.liten).toBe(false);
        expect(b.konLiten).toBe(false);
    });
    it('konLiten när bara ena könet är under k', () => {
        const m = computePivot(grupp('A', 3, 12, 30000), spec());
        expect(m.celler[0].liten).toBe(false);
        expect(m.celler[0].konLiten).toBe(true);
    });
    it('respekterar k', () => {
        const m = computePivot(grupp('A', 3, 3, 30000), spec(), { k: 5 });
        expect(m.celler[0].liten).toBe(false);
    });
    it('räknar alla mått', () => {
        const rows = grupp('A', 10, 10, 25000);
        const lons = rows.map(r => r.lon);
        const v = matt => computePivot(rows, spec({ matt })).celler[0].value;
        expect(v('median')).toBe(median(lons));
        expect(v('medel')).toBeCloseTo(lons.reduce((s, x) => s + x, 0) / lons.length, 9);
        expect(v('n')).toBe(20);
        expect(v('p10')).toBe(quantile(lons, 0.10));
        expect(v('p25')).toBe(quantile(lons, 0.25));
        expect(v('p75')).toBe(quantile(lons, 0.75));
        expect(v('p90')).toBe(quantile(lons, 0.90));
        expect(v('spridning')).toBeCloseTo(quantile(lons, 0.9) / quantile(lons, 0.1), 12);
        expect(v('andelKv')).toBe(50);
        const kv = rows.filter(r => r.kon === 'kvinna').map(r => r.lon);
        const ma = rows.filter(r => r.kon === 'man').map(r => r.lon);
        expect(v('gap')).toBeCloseTo(median(kv) / median(ma) * 100, 12);
    });
    it('okänt mått faller tillbaka på median', () => {
        const rows = grupp('A', 5, 5, 25000);
        expect(computePivot(rows, spec({ matt: 'hittepå' })).spec.matt).toBe('median');
    });
    it('delaKon ger värden per kön', () => {
        const rows = grupp('A', 10, 10, 25000);
        const c = computePivot(rows, spec({ delaKon: true })).celler[0];
        expect(c.valueKv).toBe(median(rows.filter(r => r.kon === 'kvinna').map(r => r.lon)));
        expect(c.valueMa).toBe(median(rows.filter(r => r.kon === 'man').map(r => r.lon)));
    });
    it('delaKon ignoreras för andelKv och gap och när raderna är kön', () => {
        const rows = grupp('A', 10, 10, 25000);
        for (const matt of ['andelKv', 'gap']) {
            expect(computePivot(rows, spec({ matt, delaKon: true })).spec.delaKon).toBe(false);
        }
        expect(computePivot(rows, spec({ rad: 'kon', delaKon: true })).spec.delaKon).toBe(false);
    });
    it('rader utan lön räknas inte; rader utan värde i dimensionen ingår i urvalet men inte i grupperna', () => {
        const rows = [...grupp('A', 5, 5, 25000), rad('A', 'kvinna', 0), rad('A', 'man', 30000, { alder: null })];
        const m = computePivot(rows, spec({ rad: 'alder' }));
        expect(m.urval).toEqual({ n: 11, nKv: 5, nMa: 6 });
        expect(m.celler.reduce((s, c) => s + c.n, 0)).toBe(10);
    });
    it('filtret tillämpas före grupperingen', () => {
        const rows = [...grupp('A', 5, 5, 25000), ...grupp('B', 5, 5, 35000)];
        const m = computePivot(rows, spec({ urval: { lage: 'alla', villkor: [{ falt: 'bas', op: 'enAv', varde: ['B'] }] } }));
        expect(m.radEtiketter).toEqual(['B']);
        expect(m.urval.n).toBe(10);
    });
});

describe('computePivot — två dimensioner', () => {
    const rows = [
        ...grupp('B', 6, 6, 20000, { aid: '1', yrkeLabel: 'Låg', yrke: '1 Låg' }),
        ...grupp('A', 6, 6, 21000, { aid: '1', yrkeLabel: 'Låg', yrke: '1 Låg' }),
        ...grupp('A', 6, 6, 40000, { aid: '2', yrkeLabel: 'Hög', yrke: '2 Hög' })
    ];
    const m = computePivot(rows, spec({ rad: 'aid', kolumn: 'bas' }));
    it('ger en cell per kombination som finns', () => {
        expect(m.celler).toHaveLength(3);
        expect(m.celler.every(c => c.kol !== null)).toBe(true);
    });
    it('sorterar kolumner (BAS) A → Z och rader efter radens totalvärde', () => {
        expect(m.kolumnEtiketter).toEqual(['A', 'B']);
        expect(m.radEtiketter).toEqual(['2 Hög', '1 Låg']);
    });
    it('cellerna ligger i rad- och kolumnordning', () => {
        expect(m.celler.map(c => [c.rad, c.kol])).toEqual([['2 Hög', 'A'], ['1 Låg', 'A'], ['1 Låg', 'B']]);
    });
    it('kolumn lika med rad räknas som en dimension', () => {
        expect(computePivot(rows, spec({ rad: 'bas', kolumn: 'bas' })).kolumnEtiketter).toBeNull();
    });
});

describe('computePivot — urval och gruppvillkor', () => {
    const rows = [...grupp('A', 10, 10, 20000), ...grupp('B', 10, 10, 30000), ...grupp('C', 3, 3, 40000)];
    it('personvillkor på lön körs före grupperingen', () => {
        const m = computePivot(rows, spec({ urval: { lage: 'alla', villkor: [{ falt: 'lon', op: 'minst', varde: 30000 }] } }));
        expect(m.radEtiketter).toEqual(['B', 'C']);
        expect(m.urval.n).toBe(26);
    });
    it('gruppvillkor tar bort celler och räknar dolda', () => {
        const m = computePivot(rows, spec({ gruppVillkor: [{ matt: 'n', op: 'minst', varde: 20 }] }));
        expect(m.radEtiketter).toEqual(['A', 'B']);
        expect(m.dolda).toBe(1);
    });
    it('gruppvillkor på ett annat mått än det visade', () => {
        const m = computePivot(rows, spec({ matt: 'n', gruppVillkor: [{ matt: 'median', op: 'storre', varde: 25000 }] }));
        expect(m.radEtiketter).toEqual(['B', 'C']);
        expect(m.celler.every(c => Number.isInteger(c.value))).toBe(true);
    });
    it('ofullständiga gruppvillkor ignoreras', () => {
        expect(computePivot(rows, spec({ gruppVillkor: [{ matt: 'n', op: 'minst', varde: null }] })).dolda).toBe(0);
    });
    it('vid två dimensioner försvinner rader och kolumner utan kvarvarande celler', () => {
        const m = computePivot(rows, spec({ rad: 'bas', kolumn: 'kon', matt: 'n', gruppVillkor: [{ matt: 'n', op: 'minst', varde: 5 }] }));
        expect(m.radEtiketter).toEqual(['A', 'B']);
        expect(m.dolda).toBe(2);
    });
    it('liten räknas på det som finns kvar efter urvalet', () => {
        const m = computePivot(rows, spec({ urval: { lage: 'alla', villkor: [{ falt: 'kon', op: 'enAv', varde: ['Kvinna'] }] } }));
        expect(m.celler.find(c => c.rad === 'A').n).toBe(10);
        expect(m.celler.find(c => c.rad === 'A').liten).toBe(false);
        expect(m.celler.find(c => c.rad === 'C').liten).toBe(true);
    });
    it('utan urval och gruppvillkor i spec gäller alla', () => {
        const m = computePivot(rows, { rad: 'bas', matt: 'median' });
        expect(m.radEtiketter).toEqual(['A', 'B', 'C']);
        expect(m.dolda).toBe(0);
        expect(m.spec.urval).toEqual({ lage: 'alla', villkor: [] });
        expect(m.spec.gruppVillkor).toEqual([]);
    });
});

describe('computePivot — gruppvillkor och k-regeln', () => {
    it('gap-villkor kräver att båda könen har minst k personer', () => {
        const rows = [
            ...grupp('A', 0, 12, 30000),                                   // 12 män …
            ...[0, 1].map(() => ({ bas: 'A', kon: 'kvinna', lon: 25000, alder: 40, aid: '100', yrkeLabel: 'Yrke 100', yrke: '100 Yrke 100', enhet: '1000' })),
            ...grupp('B', 10, 10, 30000).map(r => r.kon === 'kvinna' ? { ...r, lon: r.lon - 3000 } : r)
        ];
        const m = computePivot(rows, spec({ matt: 'median', gruppVillkor: [{ matt: 'gap', op: 'mindre', varde: 95 }] }));
        // A har gap ≈ 83 %, men räknat på två kvinnor — det får inte avgöra om A visas.
        expect(m.radEtiketter).toEqual(['B']);
        expect(m.dolda).toBe(1);
    });
});

describe('nya dimensioner och uppdelning per kön', () => {
    it('groupKey: hela urvalet, yrkesgrupp inom BAS och lönespann', () => {
        const r = { bas: 'E', aid: '207', yrkeLabel: 'Förskollärare', yrke: '207 Förskollärare', lon: 32499, alder: 40, kon: 'kvinna', enhet: '' };
        expect(groupKey(r, 'alla')).toBe('Hela urvalet');
        expect(groupKey(r, 'aidbas')).toBe('207 Förskollärare · BAS E');
        expect(groupKey(r, 'lonespann').replace(/ /g, ' ')).toBe('30 000–34 999 kr');
        expect(groupKey({ ...r, lon: 35000 }, 'lonespann').replace(/ /g, ' ')).toBe('35 000–39 999 kr');
        expect(groupKey({ ...r, lon: 0 }, 'lonespann')).toBeNull();
    });
    it('lönespann sorteras från lägst till högst oavsett mått', () => {
        const rows = [...grupp('A', 6, 6, 42000), ...grupp('A', 6, 6, 21000), ...grupp('A', 6, 6, 30000)];
        const m = computePivot(rows, spec({ rad: 'lonespann', matt: 'n' }));
        expect(m.radEtiketter.map(l => l.replace(/ /g, ' '))).toEqual(['20 000–24 999 kr', '30 000–34 999 kr', '40 000–44 999 kr']);
    });
    it('hela urvalet ger en enda grupp', () => {
        const rows = [...grupp('A', 5, 5, 20000), ...grupp('B', 5, 5, 30000)];
        const m = computePivot(rows, spec({ rad: 'alla' }));
        expect(m.radEtiketter).toEqual(['Hela urvalet']);
        expect(m.celler[0].n).toBe(20);
    });
    it('uppdelning per kön fungerar för antal och med två dimensioner', () => {
        const rows = [...grupp('A', 4, 6, 20000), ...grupp('B', 7, 3, 30000)];
        const n = computePivot(rows, spec({ matt: 'n', delaKon: true }));
        expect(n.spec.delaKon).toBe(true);
        expect(n.celler.map(c => [c.valueKv, c.valueMa])).toEqual([[4, 6], [7, 3]]);
        const tva = computePivot(rows, spec({ rad: 'bas', kolumn: 'aid', delaKon: true }));
        expect(tva.spec.delaKon).toBe(true);
        expect(tva.celler[0].valueKv).not.toBeNull();
    });
    it('uppdelning per kön gäller inte gap, andel kvinnor eller när kön redan är en dimension', () => {
        const rows = grupp('A', 10, 10, 20000);
        for (const matt of ['gap', 'andelKv']) expect(computePivot(rows, spec({ matt, delaKon: true })).spec.delaKon).toBe(false);
        expect(computePivot(rows, spec({ rad: 'bas', kolumn: 'kon', delaKon: true })).spec.delaKon).toBe(false);
    });
});

import { basOvanforGrans } from '../src/lib/falt.js';
describe('basOvanforGrans (BAS A–J analyseras, resten manuellt)', () => {
    it('K och senare bokstäver ligger ovanför J', () => {
        for (const b of ['K', 'L', 'Z', 'Å', 'Ä', 'Ö', 'k']) expect(basOvanforGrans(b, 'J'), b).toBe(true);
    });
    it('A–J och värden som inte är en bokstav ligger inte ovanför', () => {
        for (const b of ['A', 'E', 'J', 'j', '1', '12', '', 'AB', null]) expect(basOvanforGrans(b, 'J'), String(b)).toBe(false);
    });
});

describe('utforska: dimensionerna', () => {
    it('enhet är ingen dimension (se §2 i teknisk-plan.md)', () => expect(DIMENSIONER).not.toContain('enhet'));
});

describe('utforska: sektor och AID-mellannivå', () => {
    const rader = [
        { aid: '207011', yrkeLabel: 'Undersköterska', bas: 'C', kon: 'kvinna', lon: 30000, alder: 40 },
        { aid: '207024', yrkeLabel: 'Vårdbiträde', bas: 'B', kon: 'man', lon: 28000, alder: 30 },
        { aid: '502010', yrkeLabel: 'Systemutvecklare', bas: 'D', kon: 'man', lon: 45000, alder: 35 },
        { aid: '5301', yrkeLabel: 'X', bas: 'B', kon: 'kvinna', lon: 29000, alder: 50 },
    ];
    it('groupKey', async () => {
        const { groupKey } = await import('../src/lib/falt.js');
        expect(groupKey(rader[0], 'sektor')).toBe('Vård- och omsorgsarbete med mera');
        expect(groupKey(rader[3], 'sektor')).toBe('Okänt huvudområde');
        expect(groupKey(rader[0], 'aidniva')).toBe('AID 2070xx');
        expect(groupKey(rader[3], 'aidniva')).toBe('Okänd AID-kod');
    });
    it('pivot per mellannivå tappar inga rader: okänd kod får en egen grupp sist', () => {
        const p = computePivot(rader, { rad: 'aidniva', matt: 'n' }, { k: 1 });
        expect(p.radEtiketter).toEqual(['AID 2070xx', 'AID 5020xx', 'Okänd AID-kod']);
        expect(p.celler.reduce((s, c) => s + c.n, 0)).toBe(4);
    });
    it('pivot per sektor sorteras i prefixordning, okänt sist', () => {
        const p = computePivot(rader, { rad: 'sektor', matt: 'n' }, { k: 1 });
        expect(p.radEtiketter).toEqual(['Vård- och omsorgsarbete med mera', 'Teknikarbete', 'Okänt huvudområde']);
        expect(p.celler.find(c => c.rad === 'Vård- och omsorgsarbete med mera').n).toBe(2);
    });
    it('sektor som personvillkor i urvalet', () => {
        const p = computePivot(rader, { rad: 'aid', matt: 'n',
            urval: { lage: 'alla', villkor: [{ falt: 'sektor', op: 'enAv', varde: ['Teknikarbete'] }] } }, { k: 1 });
        expect(p.urval.n).toBe(1);
    });
});

describe('utforska: slå ihop små AID-grupper', () => {
    const p = (aid, label, n) => Array.from({ length: n }, (_, i) => ({ aid, yrkeLabel: label, bas: 'C', kon: i % 2 ? 'man' : 'kvinna', lon: 30000 + i, alder: 40 }));
    const rader = [...p('207011', 'Usk', 12), ...p('207024', 'Vb', 4), ...p('207009', 'Usk hemtj', 7),
                   ...p('206017', 'Ssk', 3), ...p('502010', 'Sysutv', 2)];
    it('små grupper i samma mellannivå slås ihop när summan når k', () => {
        const m = slaIhopSmaAid(rader, 10);
        expect(m.get('207024 Vb')).toBe('Övriga i AID 2070xx (2 yrken)');
        expect(m.get('207009 Usk hemtj')).toBe('Övriga i AID 2070xx (2 yrken)');
        expect(m.has('207011 Usk')).toBe(false);
    });
    it('räcker inte mellannivån: sektorn; räcker inte heller den: oförändrad (fortsatt liten)', () => {
        const m = slaIhopSmaAid(rader, 10);
        // 206017 (3) ensam i 2060 → sektor Vård; övriga små i Vård är redan hopslagna i 2070 → 3 < 10 → oförändrad
        expect(m.has('206017 Ssk')).toBe(false);
        expect(m.has('502010 Sysutv')).toBe(false);
    });
    it('pivoten använder ersättningen bara med slaIhop och rad = aid', () => {
        const med = computePivot(rader, { rad: 'aid', matt: 'n', slaIhop: true }, { k: 10 });
        expect(med.radEtiketter).toContain('Övriga i AID 2070xx (2 yrken)');
        expect(med.celler.find(c => c.rad === 'Övriga i AID 2070xx (2 yrken)').n).toBe(11);
        const utan = computePivot(rader, { rad: 'aid', matt: 'n' }, { k: 10 });
        expect(utan.radEtiketter).not.toContain('Övriga i AID 2070xx (2 yrken)');
        const bas = computePivot(rader, { rad: 'bas', matt: 'n', slaIhop: true }, { k: 10 });
        expect(bas.radEtiketter).toEqual(['C']);
    });
});

describe('slaIhopSmaAid: rader utan känd sektor slås inte ihop på sektorsnivå', () => {
    it('små textyrken och okända koder blir kvar som egna grupper', async () => {
        const { slaIhopSmaAid } = await import('../src/lib/utforska.js');
        const p = (aid, yrke, n) => Array.from({ length: n }, () => ({ aid, yrke, yrkeLabel: yrke, kon: 'kvinna', lon: 30000 }));
        const m = slaIhopSmaAid([...p('', 'Kock', 6), ...p('', 'Vaktis', 6), ...p('751010', '751010 A', 6), ...p('762020', '762020 B', 6)], 10);
        expect([...m.values()].filter(v => /Okänt/.test(v))).toEqual([]);
    });
});

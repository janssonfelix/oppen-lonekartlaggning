import { describe, it, expect, beforeAll, vi } from 'vitest';
import { gapUppdelning, gapPoster, normaliseraGapVariabler, gapVariablerArStandard, gapDelar, GAP_VARIABLER_STANDARD } from '../src/lib/gapuppdelning.js';
import * as fore from './helpers/gapuppdelning-fore-adr65.js';
import { createAppWindow } from './helpers/app-harness.js';
import { mulberry32 } from '../src/lib/rng.js';
import { groupKey, konOf } from '../src/lib/falt.js';

// Demot och det stora demot läses in i ett appfönster; det stora tar några sekunder under full last.
vi.setConfig({ testTimeout: 60000 });

const K = 10;
const flera = (n, kon, lon, bas, aid) => Array.from({ length: n }, () => ({ kon, lon, bas, aid, alder: 40 }));
const summa = u => u.delar.A + u.delar.B + u.delar.C;
const slumpa = (seed = 42, n = 600) => {
    const rnd = mulberry32(seed), basar = 'ABCDEFGHIJ', rader = [];
    for (let i = 0; i < n; i++) {
        const kon = rnd() < 0.6 ? 'kvinna' : 'man';
        const bi = Math.floor(rnd() * 10), bas = basar[bi];
        rader.push({ kon, bas, aid: `${bas}${Math.floor(rnd() * 4)}`, alder: 40,
            lon: Math.round(25000 + bi * 3000 + rnd() * 8000 + (kon === 'man' ? 1000 : 0)) });
    }
    return rader;
};

// Synliga bakgrundsgrupper med olika könsfördelning och löneskillnad, så att delarna inte
// domineras av en enda liten grupp (då slår skyddsreserven till och inga delar visas).
const bakgrund = () => [
    ...flera(30, 'kvinna', 28000, 'E', 'E1'), ...flera(12, 'man', 29500, 'E', 'E1'),
    ...flera(12, 'kvinna', 33000, 'F', 'F1'), ...flera(30, 'man', 35500, 'F', 'F1'),
    ...flera(25, 'kvinna', 38000, 'G', 'G1'), ...flera(15, 'man', 41000, 'G', 'G1'),
    ...flera(15, 'kvinna', 42000, 'G', 'G2'), ...flera(25, 'man', 42500, 'G', 'G2')];

describe('gapUppdelning', () => {
    it('A + B + C = gap på slumpad data', () => {
        const u = gapUppdelning(slumpa(), { k: K });
        expect(summa(u)).toBeCloseTo(u.gap, 6);
        expect(u.gap).toBeCloseTo(u.medel.kv - u.medel.ma, 9);   // kvinnor mot män
        expect(u.gapPct).toBeCloseTo(u.gap / u.medel.ma * 100, 9);
    });
    it('byte av kön ger delar med omvänt tecken', () => {
        const r = slumpa(7);
        const u = gapUppdelning(r, { k: K });
        const v = gapUppdelning(r.map(x => ({ ...x, kon: x.kon === 'man' ? 'kvinna' : 'man' })), { k: K });
        for (const d of ['A', 'B', 'C']) expect(v.delar[d]).toBeCloseTo(-u.delar[d], 6);
        expect(v.gap).toBeCloseTo(-u.gap, 6);
    });
    it('ren BAS-segregation: allt i A, B = C = 0', () => {
        const r = [...flera(30, 'kvinna', 30000, 'A', 'A1'), ...flera(10, 'man', 30000, 'A', 'A1'),
                   ...flera(10, 'kvinna', 40000, 'B', 'B1'), ...flera(30, 'man', 40000, 'B', 'B1')];
        const u = gapUppdelning(r, { k: K });
        expect(u.gap).toBeLessThan(0);                            // kvinnorna ligger lägre: negativt
        expect(u.delar.A).toBeCloseTo(u.gap, 6);
        expect(u.delar.B).toBeCloseTo(0, 6);
        expect(u.delar.C).toBeCloseTo(0, 6);
    });
    it('ren skillnad inom AID: allt i C, A = B = 0', () => {
        const r = [...flera(20, 'kvinna', 30000, 'A', 'A1'), ...flera(20, 'man', 33000, 'A', 'A1')];
        const u = gapUppdelning(r, { k: K });
        expect(u.delar.A).toBeCloseTo(0, 6);
        expect(u.delar.B).toBeCloseTo(0, 6);
        expect(u.delar.C).toBeCloseTo(-3000, 6);
    });
    it('AID med bara ett kön: inget C-bidrag, allt i B, summan håller', () => {
        const r = [...flera(20, 'kvinna', 30000, 'A', 'A1'), ...flera(20, 'man', 36000, 'A', 'A2'),
                   ...flera(10, 'kvinna', 32000, 'A', 'A3'), ...flera(10, 'man', 32000, 'A', 'A3')];
        const u = gapUppdelning(r, { k: K });
        expect(u.delar.C).toBeCloseTo(0, 6);
        expect(u.delar.B).toBeCloseTo(u.gap, 6);
        expect(summa(u)).toBeCloseTo(u.gap, 6);
    });
    it('BAS med bara ett kön bidrar bara till A och namnges (0 personer är tillåtet)', () => {
        const r = [...flera(20, 'kvinna', 30000, 'A', 'A1'), ...flera(20, 'man', 40000, 'B', 'B1'),
                   ...flera(10, 'kvinna', 35000, 'C', 'C1'), ...flera(10, 'man', 35000, 'C', 'C1')];
        const u = gapUppdelning(r, { k: K });
        expect(u.delar.A).toBeCloseTo(u.gap, 6);
        expect(u.delar.B).toBeCloseTo(0, 6);
        expect(u.delar.C).toBeCloseTo(0, 6);
        expect(u.topp.A.map(p => p.namn)).toEqual(expect.arrayContaining(['BAS A', 'BAS B']));
    });
    it('poster som avrundas till 0 kr visas inte i topplistan', () => {
        const r = [...flera(20, 'kvinna', 30000, 'A', 'A1'), ...flera(20, 'man', 40000, 'B', 'B1'),
                   ...flera(10, 'kvinna', 35000, 'C', 'C1'), ...flera(10, 'man', 35000, 'C', 'C1')];
        const u = gapUppdelning(r, { k: K });
        expect(u.topp.B).toEqual([]);
        expect(u.topp.C).toEqual([]);
    });
    it('grupp där ett kön har 1..k−1 personer räknas som dold, inte i topp, och får inget eget belopp', () => {
        const r = [...flera(20, 'kvinna', 30000, 'A', 'A1'), ...flera(20, 'man', 31000, 'A', 'A1'),
                   ...flera(5, 'kvinna', 50000, 'B', 'B1'), ...flera(3, 'man', 60000, 'B', 'B1'), ...bakgrund()];
        const u = gapUppdelning(r, { k: K });
        expect(u.skyddad).toBe(true);
        const alla = ['A', 'B', 'C'].flatMap(d => u.topp[d].map(p => p.namn));
        expect(alla.some(n => n.includes('BAS B'))).toBe(false);
        expect(u.ovrigaAntal.A).toBe(1);
        expect(u.ovrigaAntal.C).toBe(1);
        expect(u.ovriga).toBeUndefined();   // de dolda gruppernas summa redovisas aldrig
    });
    it('AID-poster namnges inte när ett kön i deras BAS har 1..k−1 personer (BAS-medellönen ingår i posten)', () => {
        const r = [...flera(20, 'kvinna', 30000, 'A', 'A1'), ...flera(20, 'man', 31000, 'A', 'A1'),
                   ...flera(3, 'kvinna', 35000, 'D', 'Q'), ...flera(10, 'man', 36000, 'D', 'Q'),
                   ...flera(20, 'man', 40000, 'D', 'P'), ...bakgrund()];
        const u = gapUppdelning(r, { k: K });
        expect(u.skyddad).toBe(true);
        const alla = ['B', 'C'].flatMap(d => u.topp[d].map(p => p.namn));
        expect(alla.filter(n => n.endsWith('BAS D'))).toEqual([]);
        expect(u.ovrigaAntal.B).toBe(2);
    });
    // Skyddsregeln: det som inte visas är delens summa minus de visade posterna. Läsaren vet inte
    // beloppen eller tecknen på posterna i den resten, så osäkerheten om en dold post h är summan
    // av |belopp| för de ANDRA posterna i resten. Den ska vara minst hälften av |h| (|h| ≥ 0,5 kr).
    // Resten får aldrig vara h själv, och de dolda posternas summa redovisas inte.
    const skyddad = (rader) => {
        const u = gapUppdelning(rader, { k: K }), p = gapPoster(rader, { k: K });
        if (!u.skyddad) {                        // reserven: inga delar, inga poster redovisas
            expect(u.delar).toBeNull();
            expect(u.topp).toBeNull();
            return 'reserv';
        }
        expect(u.ovriga).toBeUndefined();
        for (const d of ['A', 'B', 'C']) {
            const visade = new Set(u.topp[d].map(x => x.namn));
            const rest = p[d].filter(x => !visade.has(x.namn));
            const brus = rest.reduce((s, x) => s + Math.abs(x.kr), 0);
            for (const h of rest.filter(x => !x.synlig && Math.abs(x.kr) >= 0.5)) {
                expect(brus - Math.abs(h.kr), `${d}: ${h.namn}`).toBeGreaterThanOrEqual(0.5 * Math.abs(h.kr) - 1e-9);
            }
        }
    };
    it('en ensam dold grupp kan inte räknas fram, även när en annan dold grupp bidrar med 0 kr', () => {
        const r = [];
        const lägg = (bas, aid, kon, n, lon) => { for (let i = 0; i < n; i++) r.push({ bas, aid, kon, lon: lon + i * 10, alder: 40 }); };
        lägg('C', '100', 'kvinna', 1, 30000); lägg('C', '100', 'man', 12, 45000);
        lägg('C', '200', 'man', 3, 40000);                                           // ett kön, C-post 0
        lägg('C', '300', 'kvinna', 25, 38000); lägg('C', '300', 'man', 15, 39000);
        lägg('C', '400', 'kvinna', 15, 41000); lägg('C', '400', 'man', 25, 43000);
        lägg('C', '500', 'kvinna', 12, 36000); lägg('C', '500', 'man', 12, 36500);
        lägg('C', '600', 'kvinna', 20, 37000); lägg('C', '600', 'man', 10, 37200);
        skyddad(r);
    });
    it('reserven: en del som i praktiken är en enda dold grupp redovisas inte, och då inga delar alls', () => {
        const r = [...flera(20, 'kvinna', 30000, 'A', 'A1'), ...flera(20, 'man', 31000, 'A', 'A1'),
                   ...flera(5, 'kvinna', 50000, 'B', 'B1'), ...flera(3, 'man', 60000, 'B', 'B1')];
        const u = gapUppdelning(r, { k: K });
        expect(u.skyddad).toBe(false);
        expect(u.delar).toBeNull();
        expect(u.gap).toBeCloseTo(u.medel.kv - u.medel.ma, 9);   // hela skillnaden redovisas ändå
    });
    it('en liten synlig post räcker inte som skydd för en stor dold', () => {
        const r = [];
        const lägg = (bas, aid, kon, n, lon) => { for (let i = 0; i < n; i++) r.push({ bas, aid, kon, lon: lon + i * 10, alder: 40 }); };
        ['A', 'B', 'C', 'D', 'E'].forEach((b, i) => { lägg(b, 'X' + b, 'kvinna', 20 + i * 3, 30000 + i * 2000); lägg(b, 'X' + b, 'man', 20 - i * 2, 30200 + i * 2000); });
        lägg('H', 'XH', 'kvinna', 1, 40000); lägg('H', 'XH', 'man', 15, 52000);
        skyddad(r);
    });
    it('skyddsregeln håller på slumpade underlag med många små grupper', () => {
        const rnd = mulberry32(99);
        let provade = 0, reserv = 0;
        for (let t = 0; t < 150; t++) {
            const r = [];
            const nGrupper = 3 + Math.floor(rnd() * 8);
            for (let g = 0; g < nGrupper; g++) {
                const bas = 'ABCDEFGHIJ'[Math.floor(rnd() * 6)], aid = String(100 + Math.floor(rnd() * 4));
                const liten = rnd() < 0.4;
                const nKv = liten ? Math.floor(rnd() * 9) : 10 + Math.floor(rnd() * 20);
                const nMa = liten ? Math.floor(rnd() * 12) : 10 + Math.floor(rnd() * 20);
                const niva = 28000 + rnd() * 20000;
                for (let i = 0; i < nKv; i++) r.push({ bas, aid, kon: 'kvinna', lon: niva + rnd() * 3000, alder: 40 });
                for (let i = 0; i < nMa; i++) r.push({ bas, aid, kon: 'man', lon: niva + 500 + rnd() * 3000, alder: 40 });
            }
            if (!gapUppdelning(r, { k: K })) continue;
            provade++;
            if (skyddad(r) === 'reserv') reserv++;
        }
        expect(provade).toBeGreaterThan(100);
        expect(reserv).toBeLessThan(provade);   // reserven är undantaget, inte regeln
    });
    it('topplistan har högst tre poster, fallande på |kr|', () => {
        const u = gapUppdelning(slumpa(3), { k: K });
        for (const d of ['A', 'B', 'C']) {
            expect(u.topp[d].length).toBeLessThanOrEqual(3);
            const abs = u.topp[d].map(p => Math.abs(p.kr));
            expect(abs).toEqual([...abs].sort((a, b) => b - a));
        }
    });
    it('centrering: grupposterna ändras inte när alla löner höjs lika mycket', () => {
        const r = slumpa(11);
        const u = gapUppdelning(r, { k: K });
        const v = gapUppdelning(r.map(x => ({ ...x, lon: x.lon + 10000 })), { k: K });
        for (const d of ['A', 'B', 'C']) {
            u.topp[d].forEach((p, i) => { expect(v.topp[d][i].namn).toBe(p.namn); expect(v.topp[d][i].kr).toBeCloseTo(p.kr, 6); });
        }
    });
    it('namn: "BAS X" för A och "<AID>, BAS X" för B och C; yrke när aid saknas', () => {
        const r = [...flera(20, 'kvinna', 30000, 'A', undefined).map(x => ({ ...x, yrke: 'Undersköterska' })),
                   ...flera(20, 'man', 33000, 'A', undefined).map(x => ({ ...x, yrke: 'Undersköterska' }))];
        const u = gapUppdelning(r, { k: K });
        expect(u.topp.C[0].namn).toBe('Undersköterska, BAS A');
    });
    it('null när ett kön har färre än k', () => {
        expect(gapUppdelning([...flera(20, 'kvinna', 30000, 'A', 'A1'), ...flera(9, 'man', 30000, 'A', 'A1')], { k: K })).toBeNull();
    });
    it('räknar bara lön > 0 och kön kvinna/man', () => {
        const bas = [...flera(20, 'kvinna', 30000, 'A', 'A1'), ...flera(20, 'man', 31000, 'A', 'A1')];
        const u = gapUppdelning([...bas, ...flera(5, 'kvinna', 0, 'A', 'A1'), ...flera(5, 'okänd', 99999, 'A', 'A1')], { k: K });
        expect(u.n).toEqual({ kv: 20, ma: 20 });
    });
    it('litetGap när |gapPct| < 1', () => {
        const mk = lonMa => gapUppdelning([...flera(20, 'kvinna', 30000, 'A', 'A1'), ...flera(20, 'man', lonMa, 'A', 'A1')], { k: K });
        expect(mk(30200).litetGap).toBe(true);
        expect(mk(30400).litetGap).toBe(false);
    });
});

// ===================================================================================
// ADR-65: valbara förklaringsvariabler. Standardvalet ['bas', 'aid'] ska ge byte-lika resultat med implementationen
// före ADR-65 (frusen kopia i tests/helpers/gapuppdelning-fore-adr65.js), och delarna ska summera till hela
// skillnaden för varje val.
// ===================================================================================
const GAMLA_NYCKLAR = ['n', 'medel', 'gap', 'gapPct', 'litetGap', 'skyddad', 'delar', 'topp', 'ovrigaAntal'];
const somForut = u => u && Object.fromEntries(GAMLA_NYCKLAR.map(n => [n, u[n]]));
// JSON skriver varje tal med kortaste exakta form, så lika strängar betyder bitlika tal (och samma nyckelordning).
const bytelika = (rader, k) => {
    for (const opts of [{ k }, { k, variabler: ['bas', 'aid'] }, { k, variabler: null }]) {
        expect(JSON.stringify(somForut(gapUppdelning(rader, opts)))).toBe(JSON.stringify(fore.gapUppdelning(rader, { k })));
        expect(JSON.stringify(gapPoster(rader, opts))).toBe(JSON.stringify(fore.gapPoster(rader, { k })));
    }
};
const delsumma = u => Object.values(u.delar).reduce((s, v) => s + v, 0);
// Alla poster per del, för att pröva summan också när delarna inte redovisas (skyddad: false).
const postsumma = p => Object.values(p).reduce((s, l) => s + l.reduce((t, x) => t + x.kr, 0), 0);

describe('ADR-65: standardvalet är byte-likt med implementationen före', () => {
    let demo, stort;
    beforeAll(() => {
        const w = createAppWindow();
        w.__loadDemoData();
        demo = JSON.parse(JSON.stringify(w.__state.data));
        w.eval('loadStortDemo()');
        stort = JSON.parse(JSON.stringify(w.__state.data));
    }, 120000);
    it('demot vid k 5, 10 och 25', () => {
        expect(demo.length).toBeGreaterThan(100);
        for (const k of [5, 10, 25]) bytelika(demo, k);
    });
    it('det stora demot vid k 10 och 25', () => {
        expect(stort.length).toBe(7000);
        for (const k of [10, 25]) bytelika(stort, k);
    });
    it('de slumpade underlagen och fixturerna i testerna ovan', () => {
        for (const seed of [3, 7, 11, 42]) bytelika(slumpa(seed), K);
        bytelika([...flera(20, 'kvinna', 30000, 'A', 'A1'), ...flera(20, 'man', 31000, 'A', 'A1'),
            ...flera(5, 'kvinna', 50000, 'B', 'B1'), ...flera(3, 'man', 60000, 'B', 'B1'), ...bakgrund()], K);
        bytelika([...flera(20, 'kvinna', 30000, 'A', 'A1'), ...flera(20, 'man', 31000, 'A', 'A1'),
            ...flera(3, 'kvinna', 35000, 'D', 'Q'), ...flera(10, 'man', 36000, 'D', 'Q'), ...flera(20, 'man', 40000, 'D', 'P'), ...bakgrund()], K);
        bytelika([...flera(20, 'kvinna', 30000, 'A', 'A1'), ...flera(20, 'man', 31000, 'A', 'A1'),
            ...flera(5, 'kvinna', 50000, 'B', 'B1'), ...flera(3, 'man', 60000, 'B', 'B1')], K);
        bytelika([...flera(20, 'kvinna', 30000, 'A', undefined).map(x => ({ ...x, yrke: 'Undersköterska' })),
            ...flera(20, 'man', 33000, 'A', undefined).map(x => ({ ...x, yrke: 'Undersköterska' }))], K);
        bytelika([...flera(20, 'kvinna', 30000, 'A', 'A1'), ...flera(9, 'man', 30000, 'A', 'A1')], K);   // null
    });
    it('de slumpade underlagen med många små grupper (skyddsregelns test)', () => {
        const rnd = mulberry32(99);
        for (let t = 0; t < 150; t++) {
            const r = [];
            const nGrupper = 3 + Math.floor(rnd() * 8);
            for (let g = 0; g < nGrupper; g++) {
                const bas = 'ABCDEFGHIJ'[Math.floor(rnd() * 6)], aid = String(100 + Math.floor(rnd() * 4));
                const liten = rnd() < 0.4;
                const nKv = liten ? Math.floor(rnd() * 9) : 10 + Math.floor(rnd() * 20);
                const nMa = liten ? Math.floor(rnd() * 12) : 10 + Math.floor(rnd() * 20);
                const niva = 28000 + rnd() * 20000;
                for (let i = 0; i < nKv; i++) r.push({ bas, aid, kon: 'kvinna', lon: niva + rnd() * 3000, alder: 40 });
                for (let i = 0; i < nMa; i++) r.push({ bas, aid, kon: 'man', lon: niva + 500 + rnd() * 3000, alder: 40 });
            }
            bytelika(r, K);
        }
    });
    it('resultatet bär de normaliserade variablerna', () => {
        expect(gapUppdelning(slumpa(), { k: K }).variabler).toEqual(['bas', 'aid']);
        expect(GAP_VARIABLER_STANDARD).toEqual(['bas', 'aid']);
    });
});

// Ålder i grupper, sektorer och mellannivåer: AID-koder ur två huvudområden och flera mellannivåer.
const slumpaRik = (seed = 5, n = 900) => {
    const rnd = mulberry32(seed), basar = 'ABCDEF', aider = ['201010', '201020', '201110', '151010', '151020', '101010'], rader = [];
    for (let i = 0; i < n; i++) {
        const kon = rnd() < 0.55 ? 'kvinna' : 'man';
        const bi = Math.floor(rnd() * basar.length);
        rader.push({ kon, bas: basar[bi], aid: aider[Math.floor(rnd() * aider.length)], alder: 22 + Math.floor(rnd() * 44),
            lon: Math.round(25000 + bi * 2500 + rnd() * 9000 + (kon === 'man' ? 900 : 0)) });
    }
    return rader;
};

describe('ADR-65: valbara förklaringsvariabler', () => {
    const VAL = [['bas'], ['aid'], ['alder'], ['sektor'], ['bas', 'alder'], ['alder', 'bas'], ['bas', 'alder', 'aid'],
        ['sektor', 'bas', 'aid'], ['bas', 'sektor', 'aidniva', 'aid'], ['alder', 'bas', 'sektor', 'aid'], ['bas', 'aid', 'alder']];
    it('summan av delarna är exakt hela skillnaden för varje val (1e-6 kr)', () => {
        for (const seed of [1, 5, 9]) {
            const r = slumpaRik(seed);
            for (const variabler of VAL) {
                const u = gapUppdelning(r, { k: 1, variabler });   // k = 1: inget döljs, delarna redovisas alltid
                expect(u.skyddad, variabler.join()).toBe(true);
                expect(Object.keys(u.delar)).toEqual(['A', 'B', 'C', 'D', 'E'].slice(0, variabler.length + 1));
                expect(Math.abs(delsumma(u) - u.gap), variabler.join()).toBeLessThan(1e-6);
                // Också postsumman vid k = 10, där delarna kan vara dolda.
                const p = gapPoster(r, { k: K, variabler });
                expect(Math.abs(postsumma(p) - gapUppdelning(r, { k: K, variabler }).gap), variabler.join()).toBeLessThan(1e-6);
            }
        }
    });
    it('en variabel: fördelningen och resten inom', () => {
        // Ren åldersskillnad: kvinnorna yngre, samma lön inom varje åldersgrupp.
        const r = [];
        for (let i = 0; i < 30; i++) r.push({ kon: 'kvinna', bas: 'A', aid: '1', alder: 30, lon: 30000 }, { kon: 'man', bas: 'A', aid: '1', alder: 50, lon: 36000 });
        for (let i = 0; i < 10; i++) r.push({ kon: 'man', bas: 'A', aid: '1', alder: 30, lon: 30000 }, { kon: 'kvinna', bas: 'A', aid: '1', alder: 50, lon: 36000 });
        const u = gapUppdelning(r, { k: K, variabler: ['alder'] });
        expect(u.delar.A).toBeCloseTo(u.gap, 6);
        expect(u.delar.B).toBeCloseTo(0, 6);
        expect(u.topp.A.map(p => p.namn).sort()).toEqual(['30–34 år', '50–54 år']);
        // BAS ensam förklarar inget här: allt hamnar inom BAS.
        const v = gapUppdelning(r, { k: K, variabler: ['bas'] });
        expect(v.delar.A).toBeCloseTo(0, 6);
        expect(v.delar.B).toBeCloseTo(v.gap, 6);
    });
    it('tre och fyra variabler: den nästlade formeln, räknad för hand', () => {
        const r = slumpaRik(3, 700), variabler = ['bas', 'alder', 'aid'];
        const u = gapUppdelning(r, { k: 1, variabler });
        // Oberoende räkning: steg i = Σ_c ω_c Σ_barn Δs_barn|c (W̄_barn − W̄_c), sist Σ_löv ω_löv ΔW_löv.
        const facit = handrakning(r, variabler);
        ['A', 'B', 'C', 'D'].forEach((id, i) => expect(u.delar[id], id).toBeCloseTo(facit[i], 6));
        const fyra = gapUppdelning(r, { k: 1, variabler: ['bas', 'sektor', 'alder', 'aid'] });
        const facit4 = handrakning(r, ['bas', 'sektor', 'alder', 'aid']);
        ['A', 'B', 'C', 'D', 'E'].forEach((id, i) => expect(fyra.delar[id], id).toBeCloseTo(facit4[i], 6));
        expect(Math.abs(delsumma(fyra) - fyra.gap)).toBeLessThan(1e-6);
    });
    it('namn på posterna: finast först, "år" efter åldersgruppen och "BAS" före intervallet', () => {
        const r = slumpaRik(2);
        const p = gapPoster(r, { k: 1, variabler: ['bas', 'alder', 'aid'] });
        expect(p.A[0].namn).toMatch(/^BAS [A-F]$/);
        expect(p.B[0].namn).toMatch(/^\d{2}–\d{2} år, BAS [A-F]$|^(<20|65\+) år, BAS [A-F]$/);
        expect(p.C[0].namn).toMatch(/^\d{6}, \S+ år, BAS [A-F]$/);
        expect(p.D.map(x => x.namn)).toEqual(p.C.map(x => x.namn));
    });
    it('ålder saknas i lönefilen: åldersgruppen tas bort med en varning; ensam blir den standard', () => {
        const r = slumpa().map(x => ({ ...x, alder: 0 }));
        expect(normaliseraGapVariabler(['bas', 'alder', 'aid'], { harAlder: false })).toEqual({ variabler: ['bas', 'aid'],
            varningar: ['Åldersgrupp kan inte väljas: lönefilen saknar ålder.'] });
        expect(gapUppdelning(r, { k: K, variabler: ['bas', 'alder', 'aid'] }).variabler).toEqual(['bas', 'aid']);
        expect(gapUppdelning(r, { k: K, variabler: ['alder'] }).variabler).toEqual(['bas', 'aid']);
        expect(JSON.stringify(somForut(gapUppdelning(r, { k: K, variabler: ['bas', 'alder', 'aid'] })))).toBe(JSON.stringify(fore.gapUppdelning(r, { k: K })));
    });
    it('AID-nivåerna ordnas grovt till fint, på sina platser', () => {
        const n = v => normaliseraGapVariabler(v).variabler;
        expect(n(['aid', 'sektor'])).toEqual(['sektor', 'aid']);
        expect(n(['aid', 'bas', 'aidniva', 'sektor'])).toEqual(['sektor', 'bas', 'aidniva', 'aid']);
        expect(n(['aidniva', 'alder', 'sektor'])).toEqual(['sektor', 'alder', 'aidniva']);
        expect(n(['bas', 'aid'])).toEqual(['bas', 'aid']);
        // Utan ordningen vore delen för den grövre nivån tom: sektor inom AID förklarar inget.
        const r = slumpaRik(4);
        const u = gapUppdelning(r, { k: 1, variabler: ['aid', 'sektor'] });
        expect(u.variabler).toEqual(['sektor', 'aid']);
        expect(Math.abs(u.delar.B)).toBeGreaterThan(0);
    });
    it('normaliseringen: okända och dubbla tas bort, 1–4 variabler, ogiltigt ger standard med varning', () => {
        expect(normaliseraGapVariabler(null)).toEqual({ variabler: ['bas', 'aid'], varningar: [] });
        expect(normaliseraGapVariabler(undefined).variabler).toEqual(['bas', 'aid']);
        expect(normaliseraGapVariabler([]).variabler).toEqual(['bas', 'aid']);
        expect(normaliseraGapVariabler([]).varningar).toHaveLength(1);
        expect(normaliseraGapVariabler('bas').variabler).toEqual(['bas', 'aid']);
        expect(normaliseraGapVariabler('bas').varningar).toHaveLength(1);
        expect(normaliseraGapVariabler(['bas', 'bas', 'kon', 7, 'alder']).variabler).toEqual(['bas', 'alder']);
        const fem = normaliseraGapVariabler(['bas', 'sektor', 'aidniva', 'aid', 'alder']);
        expect(fem.variabler).toEqual(['bas', 'sektor', 'aidniva', 'aid']);
        expect(fem.varningar).toEqual(['Högst fyra variabler kan väljas; de första fyra används.']);
        expect(gapVariablerArStandard(['bas', 'aid'])).toBe(true);
        expect(gapVariablerArStandard(null)).toBe(true);
        expect(gapVariablerArStandard(['aid', 'bas'])).toBe(false);
        expect(gapVariablerArStandard(['bas'])).toBe(false);
    });
    it('delarnas namn och texter byggs ur variablerna; standardvalet ger dagens', () => {
        const std = gapDelar(['bas', 'aid']);
        expect(std.map(d => `${d.id}. ${d.namn}`)).toEqual(['A. BAS-fördelning', 'B. AID inom BAS', 'C. Inom AID och BAS']);
        expect(std.map(d => d.betyder)).toEqual(['Kvinnor och män är olika fördelade över BAS-intervallen.',
            'Kvinnor och män har olika AID inom samma BAS.', 'Kvinnor och män har olika lön i samma AID och BAS.']);
        expect(std.map(d => d.variabel)).toEqual(['bas', 'aid', null]);
        expect(gapDelar(['bas', 'alder', 'aid']).map(d => d.namn)).toEqual(['BAS-fördelning', 'Åldersgrupp inom BAS',
            'AID inom åldersgrupp och BAS', 'Inom AID, åldersgrupp och BAS']);
        expect(gapDelar(['alder']).map(d => d.namn)).toEqual(['Åldersfördelning', 'Inom åldersgrupp']);
        expect(gapDelar(['sektor', 'aidniva']).map(d => d.namn)).toEqual(['Sektorsfördelning', 'AID-mellannivå inom sektor', 'Inom AID-mellannivå och sektor']);
    });
});

// En oberoende räkning av den nästlade uppdelningen (utan centrering och utan skyddsregeln), för testet ovan.
function handrakning(rader, variabler) {
    const kv = rader.filter(r => konOf(r) === 'Kvinna'), ma = rader.filter(r => konOf(r) === 'Man');
    const medel = a => a.reduce((s, r) => s + r.lon, 0) / a.length;
    const delar = new Array(variabler.length + 1).fill(0);
    const steg = (kvC, maC, vikt, niva) => {
        const wKv = medel(kvC), wMa = medel(maC);
        if (niva === variabler.length) { delar[niva] += vikt * (wKv - wMa); return; }
        const nyckel = r => String(groupKey(r, variabler[niva]));
        const grupper = new Map();
        for (const r of kvC) { const g = nyckel(r); if (!grupper.has(g)) grupper.set(g, { kv: [], ma: [] }); grupper.get(g).kv.push(r); }
        for (const r of maC) { const g = nyckel(r); if (!grupper.has(g)) grupper.set(g, { kv: [], ma: [] }); grupper.get(g).ma.push(r); }
        for (const g of grupper.values()) {
            const sKv = g.kv.length / kvC.length, sMa = g.ma.length / maC.length;
            const gKv = g.kv.length ? medel(g.kv) : medel(g.ma), gMa = g.ma.length ? medel(g.ma) : medel(g.kv);
            delar[niva] += vikt * (sKv - sMa) * (gKv + gMa) / 2;
            if (g.kv.length && g.ma.length) steg(g.kv, g.ma, vikt * (sKv + sMa) / 2, niva + 1);
        }
    };
    steg(kv, ma, 1, 0);
    return delar;
}

describe('ADR-65: skyddsregeln per del, djupt ner', () => {
    it('en liten cell på tredje nivån namnges inte, och inte heller dess barn', () => {
        // BAS A har gott om båda könen; i åldersgruppen 60–64 år finns bara 3 män. Med k = 10 får varken
        // åldersgruppen eller AID-cellerna under den namnges, men summan håller.
        const r = [];
        const lagg = (n, kon, alder, aid, lon) => { for (let i = 0; i < n; i++) r.push({ kon, bas: 'A', aid, alder, lon: lon + i * 7 }); };
        lagg(40, 'kvinna', 30, '1', 30000); lagg(30, 'man', 30, '1', 31000);
        lagg(25, 'kvinna', 40, '2', 34000); lagg(35, 'man', 40, '2', 36000);
        lagg(20, 'kvinna', 62, '3', 38000); lagg(3, 'man', 62, '3', 47000);
        r.push(...bakgrund());
        const variabler = ['bas', 'alder', 'aid'];
        const p = gapPoster(r, { k: K, variabler });
        const dolda = [...p.B, ...p.C, ...p.D].filter(x => x.namn.includes('60–64 år'));
        expect(dolda.length).toBeGreaterThan(0);
        expect(dolda.every(x => !x.synlig)).toBe(true);
        const u = gapUppdelning(r, { k: K, variabler });
        if (u.skyddad) {
            const namn = Object.values(u.topp).flat().map(x => x.namn);
            expect(namn.some(n => n.includes('60–64 år'))).toBe(false);
            expect(Math.abs(delsumma(u) - u.gap)).toBeLessThan(1e-6);
        } else expect(u.delar).toBeNull();
    });
    it('en cell är synlig bara om den själv och alla överceller klarar k', () => {
        const r = slumpaRik(8, 500);
        const variabler = ['bas', 'alder', 'aid'];
        const p = gapPoster(r, { k: K, variabler });
        // Räkna om synligheten ur rådata: varje nivå i namnet (finast först) ska ha 0 eller ≥ k av varje kön.
        const nyckel = (x, v) => v === 'alder' ? `${groupKey(x, 'alder')} år` : v === 'bas' ? `BAS ${groupKey(x, 'bas')}` : String(groupKey(x, v));
        for (const [i, lista] of Object.values(p).entries()) {
            const djup = Math.min(i + 1, variabler.length);
            for (const post of lista) {
                let ok = true;
                for (let d = 1; d <= djup; d++) {
                    const sokt = post.namn.split(', ').slice(-d).reverse();
                    const cell = r.filter(x => variabler.slice(0, d).every((v, j) => nyckel(x, v) === sokt[j]));
                    const nKv = cell.filter(x => x.kon === 'kvinna').length, nMa = cell.filter(x => x.kon === 'man').length;
                    if ((nKv > 0 && nKv < K) || (nMa > 0 && nMa < K)) ok = false;
                }
                expect(post.synlig, post.namn).toBe(ok);
            }
        }
    });
    it('reserven gäller hela uppdelningen: kan en del inte redovisas visas ingen del', () => {
        const r = [...flera(20, 'kvinna', 30000, 'A', 'A1'), ...flera(20, 'man', 31000, 'A', 'A1'),
            ...flera(5, 'kvinna', 50000, 'B', 'B1'), ...flera(3, 'man', 60000, 'B', 'B1')];
        for (const variabler of [['bas'], ['bas', 'alder', 'aid'], ['aid', 'bas']]) {
            const u = gapUppdelning(r, { k: K, variabler });
            expect(u.skyddad, variabler.join()).toBe(false);
            expect(u.delar).toBeNull();
            expect(u.topp).toBeNull();
        }
    });
});

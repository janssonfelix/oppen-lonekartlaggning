import { describe, it, expect } from 'vitest';
import { gapUppdelning, gapPoster } from '../src/lib/gapuppdelning.js';
import { mulberry32 } from '../src/lib/rng.js';

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

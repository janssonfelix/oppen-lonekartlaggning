import { describe, it, expect } from 'vitest';
import { flaggaIndivider } from '../src/lib/individflaggor.js';

let nr = 2;
const p = (kon, lon, alder, aid = '5301', bas = 'B') => ({ kon, lon, alder, aid, bas, radnr: nr++ });
const flera = (n, kon, lon, alder, aid, bas) => Array.from({ length: n }, () => p(kon, lon, alder, aid, bas));
const kurva = alder => 25000 + 400 * (alder - 25);

describe('flaggaIndivider', () => {
    it('förväntan räknas utan personen själv (median)', () => {
        const r = [...flera(9, 'kvinna', 30000, 40), p('man', 15000, 40)];
        const f = flaggaIndivider(r, {}).flaggade;
        expect(f).toHaveLength(1);
        expect(f[0].forvantad).toBe(30000);
        expect(f[0].avvikelsePct).toBeCloseTo(-50, 9);
        expect(f[0].metod).toBe('median');
        expect(f[0].kollegor).toBe(9);
        expect(f[0].kon).toBe('Man');
    });
    it('ålderskurva: ung på kurvan flaggas inte, person under kurvan flaggas', () => {
        const r = [];
        for (let a = 25; a <= 63; a += 2) r.push(p(a % 4 ? 'kvinna' : 'man', kurva(a), a));
        const under = p('kvinna', Math.round(kurva(50) * 0.8), 50);
        r.push(under);
        const f = flaggaIndivider(r, {}).flaggade;
        expect(f.map(x => x.radnr)).toEqual([under.radnr]);
        expect(f[0].metod).toBe('alder');
        expect(f[0].avvikelsePct).toBeLessThan(-15);
    });
    it('median när kollegornas åldersspridning är under 5 år', () => {
        const r = [...Array.from({ length: 10 }, (_, i) => p('kvinna', 30000, 40 + (i % 5))), p('man', 20000, 42)];
        expect(flaggaIndivider(r, {}).flaggade[0].metod).toBe('median');
    });
    it('gränsen: −10,0 % flaggas, −9,9 % inte', () => {
        const r = [...flera(9, 'kvinna', 30000, 40), p('man', 27000, 40), p('man', 27030, 40)];
        const f = flaggaIndivider(r, { grans: 10 }).flaggade;
        expect(f.map(x => x.lon)).toEqual([27000]);
    });
    it('grupper under minGrupp prövas inte och räknas i ejProvade', () => {
        const r = [...flera(9, 'kvinna', 30000, 40, '5301', 'B'), ...flera(10, 'man', 30000, 40, '4100', 'C')];
        const u = flaggaIndivider(r, {});
        expect(u.ejProvade).toBe(9);
        expect(u.provade).toEqual({ kv: 0, ma: 10 });
    });
    it('båda könen flaggas; andelKv räknas; sorterat på avvikelse', () => {
        const r = [...flera(6, 'kvinna', 30000, 40), ...flera(4, 'man', 30000, 40), p('kvinna', 21000, 40), p('man', 24000, 40)];
        const u = flaggaIndivider(r, {});
        expect(u.flaggade.map(x => x.kon)).toEqual(['Kvinna', 'Man']);
        expect(u.andelKv.provade).toBeCloseTo(7 / 12 * 100, 9);
        expect(u.andelKv.flaggade).toBeCloseTo(50, 9);
    });
    it('andelKv.flaggade är null utan flaggade', () => {
        expect(flaggaIndivider(flera(10, 'kvinna', 30000, 40), {}).andelKv.flaggade).toBeNull();
    });
    it('yrke används som grupp när AID saknas', () => {
        const r = [...flera(9, 'kvinna', 30000, 40, null), p('man', 15000, 40, null)].map(x => ({ ...x, yrke: 'Barnskötare' }));
        expect(flaggaIndivider(r, {}).flaggade[0].aid).toBe('Barnskötare');
    });
    it('räknar bara lön > 0, ålder > 0 och kön kvinna/man', () => {
        const r = [...flera(10, 'kvinna', 30000, 40), p('kvinna', 0, 40), p('man', 30000, 0), p('okänd', 30000, 40)];
        const u = flaggaIndivider(r, {});
        expect(u.provade).toEqual({ kv: 10, ma: 0 });
        expect(u.ejProvade).toBe(0);
    });
    it('alla utom en har samma ålder: ingen division med noll', () => {
        const r = [...flera(10, 'kvinna', 30000, 40), p('man', 20000, 55)];
        const f = flaggaIndivider(r, {}).flaggade;
        expect(f).toHaveLength(1);
        expect(Number.isFinite(f[0].forvantad)).toBe(true);
    });
    it('stor grupp (5 000) räknas snabbt', () => {
        const r = Array.from({ length: 5000 }, (_, i) => p(i % 2 ? 'man' : 'kvinna', 30000 + (i % 97) * 50, 25 + (i % 40)));
        const t0 = performance.now();
        flaggaIndivider(r, {});
        expect(performance.now() - t0).toBeLessThan(500);
    });
});

describe('flaggaIndivider och ansvarskoden', () => {
    it('skickar med ansvarsgruppen när raderna har den, annars null', () => {
        const r = [...flera(9, 'kvinna', 30000, 40), { ...p('man', 15000, 40), ansvarsgrupp: 'uppdrag' }];
        expect(flaggaIndivider(r, {}).flaggade[0].ansvarsgrupp).toBe('uppdrag');
        const utan = [...flera(9, 'kvinna', 30000, 40), p('man', 15000, 40)];
        expect(flaggaIndivider(utan, {}).flaggade[0].ansvarsgrupp).toBeNull();
    });
});

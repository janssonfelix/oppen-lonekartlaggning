/**
 * Vitest-tester för src/lib/urval.js — villkor i Utforska.
 */
import { describe, it, expect } from 'vitest';
import { villkorAktivt, personFilter, gruppVillkorAktivt, uppfyllerGrupp, beskrivUrval, faltInfo, gruppMattInfo }
    from '../src/lib/urval.js';

const rad = over => ({ bas: 'B', aid: '207', yrkeLabel: 'Förskollärare', yrke: '207 Förskollärare',
    lon: 32000, alder: 45, kon: 'kvinna', ...over });
const v = (falt, op, varde, inte = false) => ({ falt, op, varde, inte });
const filt = (villkor, lage = 'alla') => personFilter({ lage, villkor });
const nbsp = s => s.replace(/ /g, ' ');

describe('villkorAktivt', () => {
    it('kategori kräver minst ett värde', () => {
        expect(villkorAktivt(v('bas', 'enAv', ['B']))).toBe(true);
        expect(villkorAktivt(v('bas', 'enAv', []))).toBe(false);
    });
    it('tal kräver ändliga tal; mellan kräver båda gränserna', () => {
        expect(villkorAktivt(v('lon', 'minst', 30000))).toBe(true);
        expect(villkorAktivt(v('lon', 'minst', null))).toBe(false);
        expect(villkorAktivt(v('lon', 'minst', NaN))).toBe(false);
        expect(villkorAktivt(v('lon', 'mellan', [1, 2]))).toBe(true);
        expect(villkorAktivt(v('lon', 'mellan', [1, null]))).toBe(false);
    });
    it('okänt fält eller jämförelse är ofullständigt', () => {
        expect(villkorAktivt(v('hittepa', 'enAv', ['x']))).toBe(false);
        expect(villkorAktivt(v('lon', 'enAv', [1]))).toBe(false);
        expect(villkorAktivt(v('bas', 'minst', 3))).toBe(false);
    });
});

describe('personFilter', () => {
    it('tom lista släpper igenom alla, oavsett läge', () => {
        expect(filt([])(rad())).toBe(true);
        expect(filt([], 'nagot')(rad())).toBe(true);
        expect(personFilter(undefined)(rad())).toBe(true);
    });
    it('kategorifält jämförs mot gruppnycklarna', () => {
        expect(filt([v('aid', 'enAv', ['207 Förskollärare'])])(rad())).toBe(true);
        expect(filt([v('aldersgrupp', 'enAv', ['45–49'])])(rad())).toBe(true);
        expect(filt([v('kon', 'enAv', ['Man'])])(rad())).toBe(false);
        expect(filt([v('bas', 'enAv', ['B'], true)])(rad())).toBe(false);
    });
    it('talfältens jämförelser, mellan inklusive gränserna', () => {
        expect(filt([v('lon', 'storre', 32000)])(rad())).toBe(false);
        expect(filt([v('lon', 'minst', 32000)])(rad())).toBe(true);
        expect(filt([v('lon', 'mindre', 32000)])(rad())).toBe(false);
        expect(filt([v('lon', 'hogst', 32000)])(rad())).toBe(true);
        expect(filt([v('lon', 'mellan', [32000, 33000])])(rad())).toBe(true);
        expect(filt([v('lon', 'mellan', [33000, 32000])])(rad())).toBe(true);   // omvända gränser
        expect(filt([v('lon', 'mellan', [30000, 31000], true)])(rad())).toBe(true);
    });
    it('alla kräver varje villkor, något kräver minst ett', () => {
        const vs = [v('bas', 'enAv', ['B']), v('lon', 'minst', 40000)];
        expect(filt(vs, 'alla')(rad())).toBe(false);
        expect(filt(vs, 'nagot')(rad())).toBe(true);
    });
    it('ofullständiga villkor ignoreras', () => {
        expect(filt([v('bas', 'enAv', []), v('lon', 'minst', 30000)])(rad())).toBe(true);
        expect(filt([v('bas', 'enAv', [])], 'nagot')(rad())).toBe(true);
    });
    it('saknat värde uppfyller aldrig villkoret, inte heller med inte', () => {
        const utan = rad({ alder: null });
        expect(filt([v('alder', 'storre', 50)])(utan)).toBe(false);
        expect(filt([v('alder', 'storre', 50, true)])(utan)).toBe(false);
        expect(filt([v('alder', 'mellan', [30, 40], true)])(utan)).toBe(false);
        expect(filt([v('aldersgrupp', 'enAv', ['45–49'], true)])(utan)).toBe(false);
        expect(filt([v('alder', 'storre', 50, true)])(rad({ alder: 0 }))).toBe(false);
    });
});

describe('gruppvillkor', () => {
    it('aktivt kräver känt mått, giltig jämförelse och tal', () => {
        expect(gruppVillkorAktivt({ matt: 'gap', op: 'mindre', varde: 95 })).toBe(true);
        expect(gruppVillkorAktivt({ matt: 'hittepa', op: 'mindre', varde: 95 })).toBe(false);
        expect(gruppVillkorAktivt({ matt: 'gap', op: 'enAv', varde: 95 })).toBe(false);
        expect(gruppVillkorAktivt({ matt: 'gap', op: 'mindre', varde: null })).toBe(false);
    });
    it('alla aktiva villkor måste gälla; null uppfyller aldrig', () => {
        const g = [{ matt: 'gap', op: 'mindre', varde: 95 }, { matt: 'n', op: 'minst', varde: 20 }];
        expect(uppfyllerGrupp({ gap: 90, n: 25 }, g)).toBe(true);
        expect(uppfyllerGrupp({ gap: 90, n: 10 }, g)).toBe(false);
        expect(uppfyllerGrupp({ gap: null, n: 25 }, g)).toBe(false);
        expect(uppfyllerGrupp({}, [])).toBe(true);
        expect(uppfyllerGrupp({ gap: 99 }, [{ matt: 'gap', op: 'mindre', varde: null }])).toBe(true);
    });
});

describe('beskrivUrval', () => {
    it('tomt ger tom sträng', () => {
        expect(beskrivUrval({ lage: 'alla', villkor: [] }, [])).toBe('');
        expect(beskrivUrval({ lage: 'alla', villkor: [v('bas', 'enAv', [])] }, [])).toBe('');
    });
    it('beskriver person- och gruppvillkor i klartext', () => {
        const t = nbsp(beskrivUrval(
            { lage: 'alla', villkor: [v('bas', 'enAv', ['E', 'F']), v('lon', 'minst', 30000), v('alder', 'mellan', [30, 40], true)] },
            [{ matt: 'gap', op: 'mindre', varde: 95 }]));
        expect(t).toBe('Alla av: BAS är en av E, F · Lön minst 30 000 kr · Ålder inte mellan 30 och 40 år. '
            + 'Grupper: gap mindre än 95 %');
        expect(nbsp(beskrivUrval({ lage: 'nagot', villkor: [v('bas', 'enAv', ['B'], true)] }, [])))
            .toBe('Något av: BAS är inte en av B');
    });
    it('enhet är inget urvalsfält (se §2 i teknisk-plan.md)', () => {
        expect(faltInfo()).not.toHaveProperty('enhet');
    });
    it('getters ger fält- och måttinfo', () => {
        expect(faltInfo().lon).toEqual({ typ: 'tal', etikett: 'Lön', enhet: 'kr' });
        expect(Object.keys(gruppMattInfo())).toEqual(['median', 'medel', 'n', 'p10', 'p25', 'p75', 'p90', 'spridning', 'andelKv', 'gap']);
    });
});

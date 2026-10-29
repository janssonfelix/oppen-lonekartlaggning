import { describe, it, expect } from 'vitest';
import { jamforbaraBas, mdeFranSe, bedomUnderlag } from '../src/lib/datakvalitet.js';

const rad = (bas, kon, lon = 35000, alder = 40) => ({ bas, kon, lon, alder });
const grupp = (bas, nKv, nMa, extra = {}) => [
    ...Array.from({ length: nKv }, () => ({ ...rad(bas, 'kvinna'), ...extra })),
    ...Array.from({ length: nMa }, () => ({ ...rad(bas, 'man'), ...extra })),
];
const audit = (totalRaw, bort = 0) => ({ totalRaw, excludedNoBas: bort, excludedZeroLon: 0, excludedMissingKon: 0, invalidAlder: 0 });

describe('jamforbaraBas', () => {
    it('BAS är jämförbar först när båda könen har minst k', () => {
        const r = [...grupp('B', 10, 10), ...grupp('A', 10, 9), ...grupp('C', 30, 10)];
        const j = jamforbaraBas(r, 10);
        expect(j.jamforbara).toEqual(['B', 'C']);
        expect(j.maskerade).toEqual(['A']);
        expect(j.andelPersoner).toBeCloseTo(60 / 79, 10);
    });
    it('räknar inte okänt kön och ger null utan rader', () => {
        expect(jamforbaraBas([], 10).andelPersoner).toBeNull();
        const r = [...grupp('A', 10, 10), { bas: 'A', kon: 'annat', lon: 1, alder: 1 }];
        expect(jamforbaraBas(r, 10).andelPersoner).toBe(1);
    });
});

describe('mdeFranSe', () => {
    it('räknar (exp(2,802·se) − 1)·100 och avvisar ogiltigt se', () => {
        expect(mdeFranSe(0.01)).toBeCloseTo((Math.exp(0.02802) - 1) * 100, 10);
        expect(mdeFranSe(0)).toBeNull();
        expect(mdeFranSe(NaN)).toBeNull();
        expect(mdeFranSe(undefined)).toBeNull();
    });
});

describe('bedomUnderlag', () => {
    const bra = [...grupp('A', 10, 10), ...grupp('B', 10, 10)];
    const ok = { k: 10, audit: audit(40), mde: 1.5, modell: 'full' };
    const status = (res, id) => res.kriterier.find(c => c.id === id).status;

    it('allt bra ger OK och fem kriterier i fast ordning', () => {
        const res = bedomUnderlag(bra, ok);
        expect(res.status).toBe('ok');
        expect(res.kriterier.map(c => c.id)).toEqual(['jamforbarhet', 'styrka', 'fullstandighet', 'rimlighet', 'modell']);
        res.kriterier.forEach(c => { expect(typeof c.namn).toBe('string'); expect(typeof c.text).toBe('string'); });
    });
    it('jämförbarhet: exakt 80 % OK, exakt 50 % Varning, under 50 % Kritisk', () => {
        const r80 = [...grupp('A', 40, 40), ...grupp('B', 19, 1)];          // 80/100
        expect(status(bedomUnderlag(r80, ok), 'jamforbarhet')).toBe('ok');
        const r50 = [...grupp('A', 25, 25), ...grupp('B', 49, 1)];          // 50/100
        expect(status(bedomUnderlag(r50, ok), 'jamforbarhet')).toBe('varning');
        const r49 = [...grupp('A', 24, 25), ...grupp('B', 50, 1)];          // 49/100
        expect(status(bedomUnderlag(r49, ok), 'jamforbarhet')).toBe('kritisk');
    });
    it('styrka: 2 % OK, 5 % Varning, över 5 % Kritisk, saknas = Kritisk', () => {
        expect(status(bedomUnderlag(bra, { ...ok, mde: 2 }), 'styrka')).toBe('ok');
        expect(status(bedomUnderlag(bra, { ...ok, mde: 5 }), 'styrka')).toBe('varning');
        expect(status(bedomUnderlag(bra, { ...ok, mde: 5.01 }), 'styrka')).toBe('kritisk');
        expect(status(bedomUnderlag(bra, { ...ok, mde: null }), 'styrka')).toBe('kritisk');
    });
    it('fullständighet: bortfall 2 % OK, 10 % Varning, över Kritisk; saknad audit = Varning', () => {
        expect(status(bedomUnderlag(bra, { ...ok, audit: audit(100, 2) }), 'fullstandighet')).toBe('ok');
        expect(status(bedomUnderlag(bra, { ...ok, audit: audit(100, 10) }), 'fullstandighet')).toBe('varning');
        expect(status(bedomUnderlag(bra, { ...ok, audit: audit(100, 11) }), 'fullstandighet')).toBe('kritisk');
        expect(status(bedomUnderlag(bra, { ...ok, audit: null }), 'fullstandighet')).toBe('varning');
    });
    it('fullständighet räknar alla fyra bortfallsorsaker', () => {
        const a = { totalRaw: 100, excludedNoBas: 1, excludedZeroLon: 1, excludedMissingKon: 1, invalidAlder: 1 };
        const c = bedomUnderlag(bra, { ...ok, audit: a }).kriterier.find(x => x.id === 'fullstandighet');
        expect(c.varde).toBeCloseTo(4, 10);
        expect(c.status).toBe('varning');
    });
    it('rimlighet: lön under 20 000 eller över 250 000, ålder utanför 18–70, BAS som inte är en bokstav', () => {
        const r = [...grupp('A', 50, 49), rad('A', 'man', 19999)];         // 1/100 = 1 %
        expect(status(bedomUnderlag(r, ok), 'rimlighet')).toBe('ok');
        const r2 = [...grupp('A', 48, 47), rad('A', 'man', 250001), rad('A', 'man', 30000, 17),
            rad('A', 'man', 30000, 71), rad('7', 'man'), rad('A', 'kvinna', 30000, 70)];  // 4/100
        expect(status(bedomUnderlag(r2, ok), 'rimlighet')).toBe('varning');
        const r3 = [...grupp('A', 47, 47), ...Array.from({ length: 6 }, () => rad('A', 'man', 12000))];
        expect(status(bedomUnderlag(r3, ok), 'rimlighet')).toBe('kritisk');
    });
    it('modell: full OK, minimal Varning, fel Kritisk', () => {
        expect(status(bedomUnderlag(bra, { ...ok, modell: 'full' }), 'modell')).toBe('ok');
        expect(status(bedomUnderlag(bra, { ...ok, modell: 'minimal' }), 'modell')).toBe('varning');
        expect(status(bedomUnderlag(bra, { ...ok, modell: 'fel' }), 'modell')).toBe('kritisk');
    });
    it('helheten är det sämsta kriteriet', () => {
        expect(bedomUnderlag(bra, { ...ok, modell: 'minimal' }).status).toBe('varning');
        expect(bedomUnderlag(bra, { ...ok, mde: 9, modell: 'minimal' }).status).toBe('kritisk');
    });
    it('könsfördelningen i organisationen påverkar inte bedömningen', () => {
        const skev = [...grupp('A', 60, 10), ...grupp('B', 60, 10)];
        expect(bedomUnderlag(skev, ok).status).toBe('ok');
    });
    it('tomt underlag ger Kritisk jämförbarhet utan kast', () => {
        const res = bedomUnderlag([], ok);
        expect(status(res, 'jamforbarhet')).toBe('kritisk');
    });
});

describe('fullständighet', () => {
    const bra = Array.from({ length: 20 }, (_, i) => ({ bas: 'A', kon: i % 2 ? 'man' : 'kvinna', lon: 35000, alder: 40 }));
    it('en rad med ogiltig ålder som också uteslöts räknas en gång', () => {
        const a = { totalRaw: 100, excludedNoBas: 1, excludedZeroLon: 0, excludedMissingKon: 0, invalidAlder: 2, invalidAlderUtesluten: 1 };
        expect(bedomUnderlag(bra, { k: 10, audit: a, mde: 1, modell: 'full' }).kriterier.find(c => c.id === 'fullstandighet').varde).toBeCloseTo(2, 10);
    });
});

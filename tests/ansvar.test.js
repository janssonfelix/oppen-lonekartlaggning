/**
 * AID:s ansvarskod: src/lib/ansvar.js.
 */
import { describe, it, expect } from 'vitest';
import { tolkaAnsvarskod, ansvarsgrupp, andelGiltiga, arAnsvarskodRubrik } from '../src/lib/ansvar.js';

describe('ansvar: tolkning (AID-handboken s. 9–13)', () => {
    it('giltiga koder, med och utan lokal position', () => {
        expect(tolkaAnsvarskod('C')).toEqual(['C']);
        expect(tolkaAnsvarskod('c1')).toEqual(['C']);
        expect(tolkaAnsvarskod('1002')).toEqual(['1002']);
        expect(tolkaAnsvarskod('10013')).toEqual(['1001']);
        expect(tolkaAnsvarskod('L F')).toEqual(['L', 'F']);
        expect(tolkaAnsvarskod('L;F')).toEqual(['L', 'F']);
        expect(tolkaAnsvarskod('M')).toEqual(['M']);
        expect(tolkaAnsvarskod('')).toEqual([]);
        expect(tolkaAnsvarskod(null)).toEqual([]);
    });
    it('ogiltiga värden', () => {
        for (const v of ['X', '10000123', 'Chef', 'C12', '1003', 'A B X']) expect(tolkaAnsvarskod(v), v).toBeNull();
    });
    it('ansvarsgrupp', () => {
        expect(ansvarsgrupp(['C'])).toBe('ledning');
        expect(ansvarsgrupp(['L', 'F'])).toBe('ledning');
        expect(ansvarsgrupp(['F'])).toBe('uppdrag');
        expect(ansvarsgrupp(['1002'])).toBe('uppdrag');
        expect(ansvarsgrupp(['M'])).toBe('uppdrag');
        expect(ansvarsgrupp([])).toBe('inget');
    });
    it('andel giltiga av ifyllda värden', () => {
        expect(andelGiltiga(['C', '', 'F', 'X'])).toBeCloseTo(2 / 3, 6);
        expect(andelGiltiga(['', ''])).toBeNull();
    });
    it('rubriker: Ansvarskod, AID-ansvar, Ansvarsnivå — aldrig bara Ansvar', () => {
        for (const r of ['Ansvarskod', 'AID-ansvar', 'AID ansvar', 'Ansvarsnivå', 'ANSVARSKOD AID']) expect(arAnsvarskodRubrik(r), r).toBe(true);
        for (const r of ['Ansvar', 'Ansvarsnummer', 'AID', 'Kostnadsställe']) expect(arAnsvarskodRubrik(r), r).toBe(false);
    });
});

describe('ansvar: underrader i Lika arbete', () => {
    const p = (grupp, kon, lon, n) => Array.from({ length: n }, (_, i) => ({ ansvarsgrupp: grupp, kon, lon: lon + i, alder: 40 }));
    it('en underrad per förekommande ansvarsgrupp, med samma k-regler som yrkesraden', async () => {
        const { ansvarsUnderrader } = await import('../src/lib/ansvar.js');
        const u = ansvarsUnderrader([...p('inget', 'kvinna', 30000, 12), ...p('inget', 'man', 30500, 12), ...p('ledning', 'man', 36000, 11), ...p('uppdrag', 'kvinna', 33000, 4)], { k: 10 });
        expect(u.map(x => x.grupp)).toEqual(['ledning', 'uppdrag', 'inget']);
        const [ledning, uppdrag, inget] = u;
        expect(ledning).toMatchObject({ namn: 'Ledningsansvar', n: 11, nKv: 0, nMa: 11, liten: false, samladMedian: true, medKv: null, kvot: null });
        expect(ledning.medTot).toBe(36005);
        expect(uppdrag).toMatchObject({ liten: true, medTot: null, medKv: null, medMa: null, kvot: null });
        expect(inget.kvot).toBeCloseTo(30005.5 / 30505.5 * 100, 6);
    });
});

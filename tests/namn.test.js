import { describe, it, expect } from 'vitest';
import { namnGenitiv, normaliseraNamn, personOrd } from '../src/lib/namn.js';
import { skalSammanstallningNot, stabilitetKort } from '../src/lib/rapportunderlag.js';

describe('namn: genitiv och normalisering', () => {
    it('genitiv: +s, utom efter s, x och z', () => {
        expect(namnGenitiv('Exempelkommunen')).toBe('Exempelkommunens');
        expect(namnGenitiv('Region Västerås')).toBe('Region Västerås');
        expect(namnGenitiv('SKR:s statistik')).toBe('SKR:s statistiks');
        expect(namnGenitiv('Box')).toBe('Box');
        expect(namnGenitiv('Kranz')).toBe('Kranz');
        expect(namnGenitiv('  ')).toBe('');
    });
    it('normalisering: trimmar, slår ihop blanksteg, högst 100 tecken', () => {
        expect(normaliseraNamn('  Hallsbergs   kommun ')).toBe('Hallsbergs kommun');
        expect(normaliseraNamn(null)).toBe('');
        expect(normaliseraNamn('x'.repeat(150))).toHaveLength(100);
    });
});

describe('namn: ordformen för ett antal personer', () => {
    it('"person" vid 1, annars "personer"', () => {
        expect(personOrd(1)).toBe('person');
        expect(personOrd('1')).toBe('person');
        for (const n of [0, 2, 5, 10, undefined]) expect(personOrd(n)).toBe('personer');
    });
    it('texter med tröskeln böjs efter den (minst 1 person, minst 5 personer)', () => {
        expect(skalSammanstallningNot(1)).toContain('färre än 1 person ingår inte');
        expect(skalSammanstallningNot(5)).toContain('färre än 5 personer ingår inte');
        expect(stabilitetKort({ begransad: 'bada' }, 1)).toBe('Kan inte prövas: båda könen har exakt 1 person');
        expect(stabilitetKort({ begransad: 'bada' }, 5)).toBe('Kan inte prövas: båda könen har exakt 5 personer');
    });
});

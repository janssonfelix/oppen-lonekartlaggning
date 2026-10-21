import { describe, it, expect } from 'vitest';
import { namnGenitiv, normaliseraNamn } from '../src/lib/namn.js';

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

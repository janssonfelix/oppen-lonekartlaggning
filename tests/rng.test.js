/**
 * Deterministisk bootstrap (src/lib/rng.js).
 *
 * Samma fil ger samma konfidensintervall vid varje körning: generatorn seedas
 * ur datat självt, inte ur Math.random().
 */
import { describe, it, expect } from 'vitest';
import { hashSeed, mulberry32, seedFromNumbers, rngFor } from '../src/lib/rng.js';

describe('hashSeed', () => {
    it('är stabil och ger osignerat 32-bitars heltal', () => {
        const a = hashSeed('abc');
        expect(a).toBe(hashSeed('abc'));
        expect(Number.isInteger(a)).toBe(true);
        expect(a).toBeGreaterThanOrEqual(0);
        expect(a).toBeLessThan(2 ** 32);
    });
    it('skiljer på olika indata', () => {
        expect(hashSeed('abc')).not.toBe(hashSeed('abd'));
    });
});

describe('mulberry32', () => {
    it('ger identisk sekvens för samma seed', () => {
        const a = mulberry32(42), b = mulberry32(42);
        for (let i = 0; i < 50; i++) expect(a()).toBe(b());
    });
    it('ger olika sekvens för olika seed', () => {
        const a = mulberry32(1), b = mulberry32(2);
        expect(a()).not.toBe(b());
    });
    it('håller sig inom [0, 1)', () => {
        const r = mulberry32(7);
        for (let i = 0; i < 500; i++) {
            const v = r();
            expect(v).toBeGreaterThanOrEqual(0);
            expect(v).toBeLessThan(1);
        }
    });
});

describe('seedFromNumbers', () => {
    it('samma serier → samma seed', () => {
        expect(seedFromNumbers([1, 2, 3], [4, 5])).toBe(seedFromNumbers([1, 2, 3], [4, 5]));
    });
    it('ändrat underlag → ny seed', () => {
        expect(seedFromNumbers([1, 2, 3])).not.toBe(seedFromNumbers([1, 2, 4]));
        expect(seedFromNumbers([1, 2, 3])).not.toBe(seedFromNumbers([1, 2, 3, 0]));
    });
    it('tål icke-arrayer och icke-tal utan att kasta', () => {
        expect(() => seedFromNumbers(null, [NaN, 1], undefined)).not.toThrow();
    });
});

describe('rngFor — reproducerbar bootstrap', () => {
    // Samma bootstrap som analyserna gör: återsampla och ta medianen.
    const boot = (arr, B = 200) => {
        const rnd = rngFor(arr);
        const med = a => { const s = a.slice().sort((x, y) => x - y), m = s.length >> 1;
            return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
        const out = [];
        for (let b = 0; b < B; b++) out.push(med(arr.map(() => arr[(rnd() * arr.length) | 0])));
        return out;
    };
    it('två körningar på samma data ger EXAKT samma intervall', () => {
        const data = [30000, 31000, 32500, 33000, 35000, 36000, 38000, 41000];
        expect(boot(data)).toEqual(boot(data));
    });
    it('ändrad data ger ett annat resultat', () => {
        expect(boot([1, 2, 3, 4, 5])).not.toEqual(boot([1, 2, 3, 4, 6]));
    });
});

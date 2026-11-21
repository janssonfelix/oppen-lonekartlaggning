// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
// Linten (tools/lint.mjs) översätter rader och rättningar i den hopslagna appen till källfilerna. Påhittade delar
// med LF, CRLF, BOM och en sista rad utan radbrytning.
import { describe, it, expect } from 'vitest';
import { appKarta } from '../tools/lint.mjs';

const BOM = '\uFEFF';

describe('appKarta: från den hopslagna texten till delarna', () => {
    // Hopslaget, som ESLint räknar: "a1\na2\n" + BOM "b1\r\nb2\r\nb3\r\n" + "c1\nc2"
    const delar = [
        { fil: 'a.js', text: 'a1\na2\n' },
        { fil: 'b.js', text: BOM + 'b1\r\nb2\r\nb3\r\n' },
        { fil: 'c.js', text: 'c1\nc2' }
    ];
    const karta = appKarta(delar);

    it('första och sista raden i en del, och en rad i mitten', () => {
        expect(karta.plats(1, 1)).toEqual({ fil: 'a.js', rad: 1, kolumn: 1 });
        expect(karta.plats(2, 2)).toEqual({ fil: 'a.js', rad: 2, kolumn: 2 });
        expect(karta.plats(3, 2)).toEqual({ fil: 'b.js', rad: 1, kolumn: 1 });   // efter delens BOM
        expect(karta.plats(4, 2)).toEqual({ fil: 'b.js', rad: 2, kolumn: 2 });
        expect(karta.plats(5, 1)).toEqual({ fil: 'b.js', rad: 3, kolumn: 1 });
        expect(karta.plats(6, 1)).toEqual({ fil: 'c.js', rad: 1, kolumn: 1 });
        expect(karta.plats(7, 2)).toEqual({ fil: 'c.js', rad: 2, kolumn: 2 });
    });

    it('ett intervall hamnar i rätt fil och träffar samma text där', () => {
        const hela = delar.map(d => d.text).join('');
        for (const ord of ['a2', 'b2', 'b3', 'c1', 'c2']) {
            const fran = hela.indexOf(ord);
            const { fil, intervall } = karta.intervall([fran, fran + 2]);
            expect(delar.find(d => d.fil === fil).text.slice(...intervall)).toBe(ord);
        }
    });

    it('ett intervall som korsar en filgräns ger null', () => {
        expect(karta.intervall([5, 8])).toBeNull();
    });
});

describe('appKarta: en BOM först i den första delen', () => {
    // ESLint räknar utan den inledande BOM:en: "x1\r\nx2\r\ny1\n"
    const delar = [{ fil: 'x.js', text: BOM + 'x1\r\nx2\r\n' }, { fil: 'y.js', text: 'y1\n' }];
    const karta = appKarta(delar);

    it('rader och intervall räknas efter BOM:en', () => {
        expect(karta.plats(1, 1)).toEqual({ fil: 'x.js', rad: 1, kolumn: 1 });
        expect(karta.plats(2, 2)).toEqual({ fil: 'x.js', rad: 2, kolumn: 2 });
        expect(karta.plats(3, 2)).toEqual({ fil: 'y.js', rad: 1, kolumn: 2 });
        const { fil, intervall } = karta.intervall([4, 6]);   // "x2"
        expect(delar.find(d => d.fil === fil).text.slice(...intervall)).toBe('x2');
        expect(karta.intervall([6, 9])).toBeNull();          // "\r\ny" korsar gränsen
    });
});

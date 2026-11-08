/**
 * Sakliga skäl som strukturerad post: ren logik i src/lib/sakligaskal.js. Kategorierna, valideringen av en lista
 * med skäl, sammanställningen för en rad och summan per kategori över raderna. Konstruerade indata.
 */
import { describe, it, expect } from 'vitest';
import { SKAL_KATEGORIER, skalKategorier, valideraSkal, skalSammanstallning, skalPerKategori, SKAL_GRANSER } from '../src/lib/sakligaskal.js';

const s = (kategori, belopp, kommentar = '') => ({ kategori, belopp, kommentar });

describe('sakliga skäl: kategorierna', () => {
    it('sex kategorier i fast ordning med namn och förklaring', () => {
        expect(SKAL_KATEGORIER.map(k => k.id)).toEqual(['marknad', 'utbildning', 'erfarenhet', 'prestation', 'overgang', 'annat']);
        expect(SKAL_KATEGORIER.map(k => k.namn)).toEqual(['Marknad', 'Utbildning', 'Erfarenhet', 'Prestation och resultat', 'Övergång', 'Annat sakligt skäl']);
        for (const k of SKAL_KATEGORIER) expect(k.forklaring).toMatch(/^[A-ZÅÄÖ].*\.$/);
        const f = Object.fromEntries(SKAL_KATEGORIER.map(k => [k.id, k.forklaring]));
        expect(f.utbildning).toBe('Formell utbildning som har betydelse för arbetet, utöver den som krävs.');
        expect(f.annat).toBe('Till exempel ansvar eller arbetsuppgifternas svårighet. Beskriv i kommentaren.');
        expect(f.marknad).toMatch(/som organisationen kan visa\.$/);
        expect(f.erfarenhet).toBe('Dokumenterad yrkeserfarenhet som har betydelse för arbetet, eller tid i arbetet.');
        expect(Object.isFrozen(SKAL_KATEGORIER)).toBe(true);
    });
    it('skalKategorier ger en kopia som inte kan ändra listan', () => {
        const l = skalKategorier();
        expect(l).toEqual(SKAL_KATEGORIER);
        l[0].namn = 'X'; l.pop();
        expect(SKAL_KATEGORIER[0].namn).toBe('Marknad');
        expect(SKAL_KATEGORIER).toHaveLength(6);
    });
    it('gränserna: belopp 0–200 000, kommentar 200 tecken, högst 8 skäl', () => {
        expect(SKAL_GRANSER).toEqual({ maxBelopp: 200000, maxKommentar: 200, maxAntal: 8 });
    });
});

describe('sakliga skäl: valideraSkal', () => {
    it('giltiga skäl går igenom oförändrade; kommentaren är valfri', () => {
        expect(valideraSkal([s('marknad', 800, 'Svårrekryterat'), { kategori: 'erfarenhet', belopp: 400 }]))
            .toEqual({ skal: [s('marknad', 800, 'Svårrekryterat'), s('erfarenhet', 400, '')], bort: 0 });
    });
    it('gränserna för beloppet: 0 och 200 000 går, −1, 200 001, decimaltal och text faller bort', () => {
        const r = valideraSkal([s('marknad', 0), s('marknad', 200000), s('marknad', -1), s('marknad', 200001), s('marknad', 1.5), s('marknad', '800'), s('marknad', NaN)]);
        expect(r.skal.map(x => x.belopp)).toEqual([0, 200000]);
        expect(r.bort).toBe(5);
    });
    it('okänd kategori faller bort', () => {
        const r = valideraSkal([s('lojalitet', 500), s('Marknad', 500), s('annat', 500)]);
        expect(r.skal.map(x => x.kategori)).toEqual(['annat']);
        expect(r.bort).toBe(2);
    });
    it('kommentaren: 200 tecken går, 201 faller bort, en kommentar som inte är text faller bort', () => {
        const r = valideraSkal([s('annat', 1, 'a'.repeat(200)), s('annat', 2, 'a'.repeat(201)), { kategori: 'annat', belopp: 3, kommentar: 5 }]);
        expect(r.skal.map(x => x.belopp)).toEqual([1]);
        expect(r.bort).toBe(2);
    });
    it('fler än 8 skäl: de första åtta står kvar, resten faller bort', () => {
        const r = valideraSkal(Array.from({ length: 10 }, (_, i) => s('marknad', i)));
        expect(r.skal.map(x => x.belopp)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
        expect(r.bort).toBe(2);
    });
    it('tom lista och saknat fält ger inga skäl och inget bortfall; annat än en lista räknas som ett bortfall', () => {
        expect(valideraSkal([])).toEqual({ skal: [], bort: 0 });
        expect(valideraSkal(undefined)).toEqual({ skal: [], bort: 0 });
        expect(valideraSkal(null)).toEqual({ skal: [], bort: 0 });
        expect(valideraSkal('marknad')).toEqual({ skal: [], bort: 1 });
        expect(valideraSkal([null, 5, 'x'])).toEqual({ skal: [], bort: 3 });
    });
    it('posten är en ny kopia utan andra fält', () => {
        const in1 = { kategori: 'marknad', belopp: 5, kommentar: 'k', namn: 'Spion', extra: 1 };
        const r = valideraSkal([in1]);
        expect(r.skal[0]).toEqual({ kategori: 'marknad', belopp: 5, kommentar: 'k' });
        expect(r.skal[0]).not.toBe(in1);
    });
});

describe('sakliga skäl: skalSammanstallning för en rad', () => {
    it('andel per skäl, summa, förklarad andel och återstår', () => {
        const r = skalSammanstallning([s('marknad', 800), s('erfarenhet', 400)], 1800);
        expect(r.skal.map(x => [x.namn, x.andel])).toEqual([['Marknad', 800 / 1800], ['Erfarenhet', 400 / 1800]]);
        expect(r).toMatchObject({ antal: 2, summa: 1200, skillnadKr: 1800, forklaradAndel: 1200 / 1800, aterstar: 600, aterstarAndel: 600 / 1800, overstiger: false });
    });
    it('summan lika med skillnaden: allt förklarat, inget återstår, ingen varning', () => {
        expect(skalSammanstallning([s('marknad', 1000)], 1000)).toMatchObject({ forklaradAndel: 1, aterstar: 0, aterstarAndel: 0, overstiger: false });
    });
    it('summan över skillnaden: varningen, återstår aldrig under 0', () => {
        const r = skalSammanstallning([s('marknad', 1500), s('annat', 600)], 1800);
        expect(r).toMatchObject({ summa: 2100, forklaradAndel: 2100 / 1800, aterstar: 0, aterstarAndel: 0, overstiger: true });
    });
    it('skillnadKr null (en egen rad): bara belopp, ingen andel', () => {
        const r = skalSammanstallning([s('marknad', 800)], null);
        expect(r.skal[0].andel).toBeNull();
        expect(r).toMatchObject({ summa: 800, skillnadKr: null, forklaradAndel: null, aterstar: null, aterstarAndel: null, overstiger: false });
    });
    it('en skillnad som är 0 eller negativ (kvinnor högre) ger ingen andel men står kvar', () => {
        for (const v of [0, -500]) {
            const r = skalSammanstallning([s('marknad', 100)], v);
            expect(r.skillnadKr).toBe(v);
            expect(r.forklaradAndel).toBeNull();
            expect(r.skal[0].andel).toBeNull();
            expect(r.overstiger).toBe(false);
        }
        expect(skalSammanstallning([s('marknad', 100)], NaN).skillnadKr).toBeNull();
    });
    it('tom lista: summa 0 och hela skillnaden återstår', () => {
        expect(skalSammanstallning([], 1800)).toMatchObject({ antal: 0, summa: 0, forklaradAndel: 0, aterstar: 1800, aterstarAndel: 1, overstiger: false });
        expect(skalSammanstallning(undefined, null)).toMatchObject({ antal: 0, summa: 0, forklaradAndel: null, aterstar: null });
    });
});

describe('sakliga skäl: skalPerKategori över raderna', () => {
    it('summa per kategori, andel av den totala skillnaden i raderna med skäl och antal grupper', () => {
        const r = skalPerKategori([
            { skal: [s('marknad', 800), s('erfarenhet', 400)], skillnadKr: 1800 },
            { skal: [s('marknad', 200)], skillnadKr: 1200 },
            { skal: [], skillnadKr: 5000 },   // utan skäl: räknas inte i den totala skillnaden
        ]);
        expect(r.kategorier).toEqual([
            { kategori: 'marknad', namn: 'Marknad', summa: 1000, andel: 1000 / 3000, antalGrupper: 2 },
            { kategori: 'erfarenhet', namn: 'Erfarenhet', summa: 400, andel: 400 / 3000, antalGrupper: 1 },
        ]);
        expect(r).toMatchObject({ antalGrupper: 2, skillnadKr: 3000, summa: 1400, andel: 1400 / 3000 });
    });
    it('kategorierna i listans ordning, oavsett ordningen i raderna; två skäl i samma kategori är en grupp', () => {
        const r = skalPerKategori([{ skal: [s('annat', 10), s('overgang', 20), s('overgang', 5)], skillnadKr: 100 }]);
        expect(r.kategorier.map(k => [k.kategori, k.summa, k.antalGrupper])).toEqual([['overgang', 25, 1], ['annat', 10, 1]]);
    });
    it('en rad utan skillnad (skillnadKr null) räknas i summan men inte i andelen', () => {
        const r = skalPerKategori([
            { skal: [s('marknad', 500)], skillnadKr: null },
            { skal: [s('marknad', 300)], skillnadKr: 1000 },
        ]);
        expect(r.kategorier[0]).toEqual({ kategori: 'marknad', namn: 'Marknad', summa: 800, andel: 0.3, antalGrupper: 2 });
        expect(r).toMatchObject({ antalGrupper: 2, skillnadKr: 1000, summa: 800, andel: 0.3 });
    });
    it('en kategori som bara finns i rader utan skillnad får ingen andel (inte 0 %)', () => {
        const r = skalPerKategori([
            { skal: [s('utbildning', 700)], skillnadKr: null },
            { skal: [s('marknad', 300)], skillnadKr: 1000 },
        ]);
        expect(r.kategorier.map(k => [k.kategori, k.andel])).toEqual([['marknad', 0.3], ['utbildning', null]]);
    });
    it('bara rader utan skillnad: ingen andel', () => {
        const r = skalPerKategori([{ skal: [s('marknad', 500)], skillnadKr: null }]);
        expect(r.kategorier[0].andel).toBeNull();
        expect(r).toMatchObject({ skillnadKr: 0, andel: null });
    });
    it('summan över skillnaden ger en andel över 1 (visningen säger det)', () => {
        expect(skalPerKategori([{ skal: [s('marknad', 1500)], skillnadKr: 1000 }]).andel).toBe(1.5);
    });
    it('tomma listor och felaktiga rader ger en tom sammanställning', () => {
        const tom = { kategorier: [], antalGrupper: 0, skillnadKr: 0, summa: 0, andel: null };
        expect(skalPerKategori([])).toEqual(tom);
        expect(skalPerKategori(undefined)).toEqual(tom);
        expect(skalPerKategori([null, { skal: null, skillnadKr: 100 }, { skillnadKr: 100 }])).toEqual(tom);
    });
});

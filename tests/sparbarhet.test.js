/**
 * Vakt: spårbarhetsmatrisen (docs/utveckling/sparbarhet.md) och testsviten pekar på varandra.
 *
 * Matrisen har en rad per påstående med ett ID först; testerna bär ID:t först i sitt namn, inom hakparentes
 * (`describe('[B2.3] …')`). Vakten prövar
 *   (a) att varje ID står en gång i matrisen,
 *   (b) att varje testfil i kolumnen Tester har ett test vars namn bär radens ID,
 *   (c) att varje ID i ett testnamn finns i matrisen,
 *   (d) att filerna och funktionerna i kolumnen Funktion och fil finns.
 * Att testet prövar det raden säger prövas inte; det granskas.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { regexEscape } from './helpers/regex.js';
import { lasMatris } from '../tools/valideringsrapport.mjs';

const ROOT = join(import.meta.dirname, '..');
const läs = f => readFileSync(join(ROOT, f), 'utf8');
const kod = cell => [...cell.matchAll(/`([^`]+)`/g)].map(m => m[1]);

// Matrisens rader: varje tabell vars första kolumn heter ID (samma läsning som valideringsrapporten).
const matris = lasMatris(läs('docs/utveckling/sparbarhet.md'));
const ider = matris.map(r => r.ID);

// Testnamnen: en sträng som börjar med ett eller flera [ID] direkt efter describe(, it( eller test( (också .each).
const ID_I_NAMN = /\b(?:describe|it|test)\b(?:\.\w+)*(?:\([^'"`\n]*?\))?\(\s*['"`]((?:\[[^\]\s]+\] ?)+)/g;
const idIFil = text => [...text.matchAll(ID_I_NAMN)].flatMap(m => [...m[1].matchAll(/\[([^\]]+)\]/g)].map(x => x[1]));
const testfiler = [
    ...readdirSync(join(ROOT, 'tests')).filter(f => f.endsWith('.test.js')).map(f => `tests/${f}`),
    ...readdirSync(join(ROOT, 'tests/helpers')).filter(f => f.endsWith('.js')).map(f => `tests/helpers/${f}`),
];
const idPerFil = new Map(testfiler.map(f => [f, idIFil(läs(f))]));

describe('spårbarhetsmatrisen', () => {
    it('matrisen har rader i alla serier (annars prövar vakten inget)', () => {
        for (const serie of ['B', 'I', 'C', 'R', 'S']) expect(ider.some(id => id.startsWith(serie)), serie).toBe(true);
        expect(idIFil("describe('[B1.1] [S4] x', () => {}); it.each([[1]])(`[I4] y`, () => {})")).toEqual(['B1.1', 'S4', 'I4']);
    });

    it('(a) varje ID står en gång', () => {
        const dubbla = ider.filter((id, i) => ider.indexOf(id) !== i);
        expect(dubbla, `ID som står mer än en gång i sparbarhet.md: ${dubbla.join(', ')}`).toEqual([]);
    });

    it('(b) varje testfil i kolumnen Tester har ett test som bär radens ID', () => {
        const fel = [];
        for (const r of matris) {
            const filer = kod(r.Tester).filter(f => f.startsWith('tests/'));
            if (!filer.length) fel.push(`${r.ID}: ingen testfil i kolumnen Tester`);
            for (const f of filer) {
                if (!idPerFil.has(f)) fel.push(`${r.ID}: ${f} finns inte`);
                else if (!idPerFil.get(f).includes(r.ID)) fel.push(`${r.ID}: inget test i ${f} bär [${r.ID}] i namnet`);
            }
        }
        expect(fel).toEqual([]);
    });

    it('(c) varje ID i ett testnamn finns i matrisen', () => {
        const fel = [...idPerFil].flatMap(([f, lista]) => lista.filter(id => !ider.includes(id)).map(id => `[${id}] i ${f}`));
        expect(fel, 'ID i testnamn som inte finns i sparbarhet.md').toEqual([]);
    });

    // En funktion står före sin fil (`median`, `stat.js`); ett filnamn utan katalog ligger i src/lib/.
    it('(d) filerna och funktionerna i kolumnen Funktion och fil finns', () => {
        const fel = [];
        for (const r of matris) {
            let väntande = [];
            for (const t of kod(r['Funktion och fil'])) {
                if (/^[\w$]+$/.test(t)) { väntande.push(t); continue; }
                const fil = t.includes('/') ? t : `src/lib/${t}`;
                if (!existsSync(join(ROOT, fil))) { fel.push(`${r.ID}: ${fil} finns inte`); väntande = []; continue; }
                const text = läs(fil);
                for (const fn of väntande) {
                    if (!new RegExp(`(?:function\\*?\\s+|\\b(?:const|let|var)\\s+)${regexEscape(fn)}\\b`).test(text)) {
                        fel.push(`${r.ID}: ${fn} finns inte i ${fil}`);
                    }
                }
                väntande = [];
            }
            if (väntande.length) fel.push(`${r.ID}: ${väntande.join(', ')} saknar fil`);
        }
        expect(fel).toEqual([]);
    });
});

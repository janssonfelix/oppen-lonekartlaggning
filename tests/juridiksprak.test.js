/**
 * Vakt: ansvarsförbehållet och förbehållet om verklig data står där de ska (beslut 8c, ingen juristgranskning före
 * lansering). De juridiska formuleringar som inte får stå (utredningskrav, lagstadgat, vad direktivet kräver i detalj)
 * är avförda ord i tests/dokumentation-sprak.test.js, tillsammans med paragrafer och artiklar.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const läs = f => readFileSync(join(root, f), 'utf8');

const ANSVAR = 'Verktyget är ett stöd för arbetsgivarens egen lönekartläggning. Användaren ansvarar för hur verktyget används, för tolkningen av resultaten och för den juridiska bedömningen. Verktyget är inte juridiskt granskat.';
const VERKLIG_DATA = 'Verktyget är ännu inte prövat med verklig lönedata hos en arbetsgivare; checklistan för skarp data finns för den som gör det först.';
const WORD = 'Word-utkastet är prövat i LibreOffice, ännu inte i Microsoft Word.';
const enRad = s => s.replace(/\s*\n[\s>]*/g, ' ');

describe('juridikspråk: ansvarsförbehållet står på alla åtta ställen', () => {
    it('samma lydelse finns en gång i appen, som konstant i 03-hjalpfunktioner.js', () => {
        expect(läs('dist/app.js').split(ANSVAR).length - 1).toBe(1);
        expect(läs('src/app/03-hjalpfunktioner.js')).toContain('const ANSVARSFORBEHALL');
    });
    for (const fil of ['src/app/65-om-verktyget.js', 'src/app/58-rapportmodell.js', 'src/app/22-exporthjalpare.js', 'src/app/67-rapportunderlag.js']) {
        it(`${fil} använder förbehållet`, () => expect(läs(fil)).toContain('ANSVARSFORBEHALL'));
    }
    for (const fil of ['README.md', 'docs/anvandare/sammanfattning-hr-chefer.md', 'docs/anvandare/korguide.md']) {
        it(`${fil} har förbehållet`, () => expect(enRad(läs(fil))).toContain(ANSVAR));
    }
    it('informationsmallen säger att den inte är juridiskt granskad', () => {
        expect(enRad(läs('docs/anvandare/information-till-anstallda.md'))).toMatch(/inte juridiskt granskad/u);
    });
});

describe('juridikspråk: förbehållet om verklig data står kvar, Word-förbehållet är struket', () => {
    // Word-utkastet är prövat i Microsoft Word 365 och 2019 (B6); förbehållet får inte komma tillbaka.
    for (const fil of ['README.md', 'docs/anvandare/sammanfattning-hr-chefer.md']) {
        it(fil, () => {
            const text = enRad(läs(fil));
            expect(text).toContain(VERKLIG_DATA);
            expect(text).not.toContain(WORD);
        });
    }
});

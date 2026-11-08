/**
 * Vakt: juridiska formuleringar hålls övergripande (beslut 8c, ingen juristgranskning före lansering).
 *
 * Verktyget påstår inte vad direktivet kräver i detalj och använder inte orden "utredningskrav",
 * "lagstadgat" eller "unexplained gender pay gap". Formen "Diskrimineringslagen kräver att du … (3 kap.)"
 * är vald i språkgenomgången och får stå; paragrafer och artiklar vaktas i dokumentation.test.js.
 *
 * Testet läser det byggda dist/app.js (det användaren kör, utan kodkommentarer), src/index.html (utan
 * HTML-kommentarer), README och dokumenten för användare och dataskydd. Ordet "direktivet" i sig är
 * tillåtet. Vakten kontrollerar också att ansvarsförbehållet och förbehållet om verklig data står där de ska.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const läs = f => readFileSync(join(root, f), 'utf8');
const mdI = dir => readdirSync(join(root, dir)).filter(f => f.endsWith('.md')).map(f => `${dir}/${f}`);

const FILER = ['dist/app.js', 'src/index.html', 'README.md', ...mdI('docs/anvandare'), ...mdI('docs/dataskydd')];

// Skiftlägesokänsligt. "ingen anmälningsplikt" får stå; "anmälningspliktig" inte.
const FORBJUDET = [
    /lagstadga/iu,
    /utrednings(krav|tröskel|steg|gräns)/iu,
    /obligatorisk utredning/iu,
    /enligt (eu-?)?direktivet (bör|ska|säger)/iu,
    /direktiv\S* (bör|ska|säger|kräver)\b/iu,
    /(bör|ska|måste) utredas/iu,
    /anmälningspliktig/iu,
    /unexplained gender pay gap/iu,
    /diskrimineringsindikerande/iu,
];

/** Tömmer HTML-kommentarer och, i .js, kodkommentarer (hela rader och avslutande //-kommentarer); radnumren står kvar. */
function utanKommentarer(fil, text) {
    const utanHtml = text.replace(/<!--[\s\S]*?-->/g, m => m.replace(/[^\n]/g, ''));
    if (!fil.endsWith('.js')) return utanHtml;
    return utanHtml
        .split(/\r?\n/)
        .map(rad => (/^\s*(\/\/|\/\*|\*)/.test(rad) ? '' : rad.replace(/\s\/\/\s.*$/, '')))
        .join('\n');
}

function traffar(fil, text) {
    const ut = [];
    text.split(/\r?\n/).forEach((rad, i) => {
        for (const re of FORBJUDET) {
            const m = rad.match(re);
            if (!m) continue;
            const s = Math.max(0, (m.index ?? 0) - 50);
            ut.push(`${fil}:${i + 1}: ${re} … ${rad.slice(s, (m.index ?? 0) + m[0].length + 40).trim()}`);
        }
    });
    return ut;
}

describe('juridikspråk: inga detaljpåståenden om vad direktivet kräver', () => {
    it('mönstren fångar de avförda formerna men inte de tillåtna', () => {
        const fangar = t => FORBJUDET.some(re => re.test(t));
        for (const t of ['Lagstadgat tröskelvärde', 'utredningskrav', 'EU-direktivets utredningströskel', 'enligt EU-direktivet bör',
            'Lönetransparensdirektivet kräver att', 'gap över 5 % bör utredas', 'anmälningspliktiga', 'Unexplained gender pay gap'])
            expect(fangar(t), t).toBe(true);
        for (const t of ['ingen anmälningsplikt', 'direktivets regler om gemensam lönebedömning',
            'Diskrimineringslagen kräver att du prövar det (3 kap.).', 'Direktivet skulle vara infört'])
            expect(fangar(t), t).toBe(false);
    });
    for (const fil of FILER) {
        it(fil, () => expect(traffar(fil, utanKommentarer(fil, läs(fil)))).toEqual([]));
    }
    it('lagrum.md ligger utanför vakten', () => {
        expect(FILER).not.toContain('docs/utveckling/lagrum.md');
    });
});

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

describe('juridikspråk: förbehållet om verklig data och Word', () => {
    for (const fil of ['README.md', 'docs/anvandare/sammanfattning-hr-chefer.md']) {
        it(fil, () => {
            const text = enRad(läs(fil));
            expect(text).toContain(VERKLIG_DATA);
            expect(text).toContain(WORD);
        });
    }
});

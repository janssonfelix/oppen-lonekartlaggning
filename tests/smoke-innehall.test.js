/**
 * Röktest (jsdom): Organisatorisk enhet, filrutor, språk, Att göra, BAS-ordning och regressionens steg.
 *
 * Utbrutet ur smoke.test.js så att Vitest fördelar röktesterna över flera arbetare; varje describe-block
 * skapar sina egna fönster via createAppWindow (tests/helpers/app-harness.js).
 */
import { describe, it, expect } from 'vitest';
import { createAppWindow, delatFonster } from './helpers/app-harness.js';

// Testerna som söker igenom flikarna ritar dem inte var för sig: ett delat fönster med demodatan klickar fram varje flik
// en gång och sparar en kopia av det som då syns (flikens paneler och sidhuvudet), och testerna läser kopiorna.
// Vakten i delatFonster fäller det test som ändrar fönstret.
const FLIKAR = ['dashboard', 'bestammelser', 'matrix', 'likvardighet', 'struktur', 'prioritering', 'loneoversyn',
                'handlingsplan', 'dokumentera', 'rapporttext', 'arbetet', 'kon', 'benchmark', 'utforska'];
/** @type {Map<string, {paneler: any[], titel: string}>} flik → kopior av panelerna som syns (eller är aktiva) och sidhuvudet */
const ritade = new Map();
const flikfonster = delatFonster(w => {
    w.__loadDemoData();
    for (const flik of FLIKAR) {
        w.document.querySelector(`.nav-item[data-tab="${flik}"]`).click();
        ritade.set(flik, {
            paneler: [...w.document.querySelectorAll('.view-panel')].filter(p => p.style.display === 'block' || p.classList.contains('active')).map(p => p.cloneNode(true)),
            titel: w.document.getElementById('page-title').textContent,
        });
    }
});

describe('innehåll på sidan och i rapportunderlaget', () => {
    const oppna = (w, flik) => w.document.querySelector(`.nav-item[data-tab="${flik}"]`).click();
    it('de långa flikarna har avsnitt, och deras rubriker är innehållsförteckningen', () => {
        // Flikarna klickas fram i samma ordning som här, med fler flikar emellan (prövat: samma paneler).
        const w = flikfonster();
        for (const [flik, minst] of [['dashboard', 2], ['matrix', 4], ['likvardighet', 4], ['struktur', 5], ['prioritering', 4], ['loneoversyn', 4], ['dokumentera', 2], ['rapporttext', 2], ['arbetet', 4], ['kon', 5], ['benchmark', 4]]) {
            const synliga = ritade.get(flik).paneler;
            const rubriker = synliga.flatMap(p => [...p.querySelectorAll('details.avsnitt > summary h2')]);
            expect(rubriker.length, flik).toBeGreaterThanOrEqual(minst);
            for (const h of rubriker) expect(h.textContent.trim().length, flik).toBeGreaterThan(3);
        }
        expect(w.eval('typeof renderSidansInnehall')).toBe('undefined');
    });
    it('rapportunderlaget: förteckning med en länk per block', () => {
        const w = createAppWindow();
        w.__loadDemoData();
        oppna(w, 'rapporttext');
        const block = w.document.querySelectorAll('#rapportunderlag-innehall .ru-block[data-block-id]');
        expect(block.length).toBeGreaterThan(0);
        const lankar = w.document.querySelectorAll('#rapportunderlag-innehall .ru-toc [data-hoppa-till]');
        expect(lankar.length).toBe(block.length);
        for (const a of lankar) expect(w.document.getElementById(a.dataset.hoppaTill)?.classList.contains('ru-block')).toBe(true);
    });
    it('Kopiera alla avsnitt lägger avsnittens rubriker i ordning på urklipp; reserv utan urklipp', async () => {
        const w = createAppWindow();
        w.__loadDemoData();
        oppna(w, 'rapporttext');
        const fångat = [];
        w.ClipboardItem = class { constructor(o) { this.o = o; } };
        Object.defineProperty(w.navigator, 'clipboard', { configurable: true, value: { write: async items => { fångat.push(...items); } } });
        expect(await w.kopieraRapportAvsnitt()).toBe('urklipp');
        const html = await fångat[0].o['text/html'].text();
        const rubriker = [...html.matchAll(/<h3>([^<]+)<\/h3>/g)].map(m => m[1]);
        const avsnitt = w.__rapportunderlagBlock().filter(b => !b.id.includes(':')).map(b => b.rubrik);
        expect(rubriker).toEqual(avsnitt);
        expect(await fångat[0].o['text/plain'].text()).toContain(avsnitt[1]);
        Object.defineProperty(w.navigator, 'clipboard', { configurable: true, value: undefined });
        w.document.execCommand = () => false;
        expect(await w.kopieraRapportAvsnitt()).toBe('markerat');
        expect(w.getSelection().toString()).toContain(avsnitt[0]);
    });
});

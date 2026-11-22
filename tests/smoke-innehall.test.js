/**
 * Röktest (jsdom): Organisatorisk enhet, filrutor, språk, Att göra, BAS-ordning och regressionens steg.
 *
 * Utbrutet ur smoke.test.js så att Vitest fördelar röktesterna över flera arbetare; varje describe-block
 * skapar sina egna fönster via createAppWindow (tests/helpers/app-harness.js).
 */
import { describe, it, expect } from 'vitest';
import { createAppWindow, delatFonster } from './helpers/app-harness.js';
import { borjaHar } from '../src/lib/attgora.js';

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

describe('Att göra', () => {
    it('Om verktyget beskriver Översikt med Att göra', async () => {
        const { readFileSync } = await import('node:fs');
        const { join, dirname } = await import('node:path');
        const { fileURLToPath } = await import('node:url');
        const src = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'app', '65-om-verktyget.js'), 'utf8');
        expect(src).toMatch(/Att göra/);
    });
    const rader = (kvLon, maLon) => {
        const r = [];
        for (let i = 0; i < 60; i++) r.push({ bas: 'ABC'[i % 3], kon: i % 2 ? 'man' : 'kvinna', alder: 25 + (i % 30),
            lon: (i % 2 ? maLon : kvLon) + (i % 7) * 50 + 'ABC'.indexOf('ABC'[i % 3]) * 2000, yrke: '100 Y', aid: '100', yrkeLabel: 'Y' });
        return r;
    };
    const med = (data) => { const w = createAppWindow(); w.__state.data = data; w.eval('populateSelects(); unlockTabs();'); return w; };
    it('punkten om oförklarat gap: hög vid signifikant gap på minst 3 %, ingen när gapet inte är signifikant', () => {
        const hog = med(rader(30000, 33000)).eval('buildActionChecklist()').find(i => i.id === 'reg-oforklarat');
        expect(hog).toMatchObject({ kategori: 'Lika arbete', prioritet: 'hög', tab: 'struktur' });
        expect(hog.titel).toMatch(/Oförklarad löneskillnad i hela organisationen/);
        expect(med(rader(30000, 30000)).eval('buildActionChecklist()').some(i => i.id === 'reg-oforklarat')).toBe(false);
    });
    it('ett kort: statusrad, Börja här och hela listan; inget iakttagelseblock', () => {
        const w = createAppWindow();
        w.__loadDemoData();
        const d = w.document;
        const kort = d.getElementById('att-gora');
        expect(kort.hidden).toBe(false);
        for (const id of ['compliance-overview', 'att-gora-borja', 'action-checklist-container']) expect(kort.querySelector('#' + id)).not.toBeNull();
        expect(d.getElementById('insight-feed-container')).toBeNull();
        expect(d.getElementById('comp-gap-val').textContent).toMatch(/av \d+ jämförbara BAS-intervall|Inga jämförbara/);
        expect(kort.querySelector('#compliance-overview h2')).toBeNull();
        expect(kort.querySelector('#comp-gap a[data-go-to-tab="struktur"]')).not.toBeNull();
    });
    it('Börja här: högst tre ej avbockade punkter, hög prioritet först, därefter underlag och könsrelaterade fynd; avbockning byter punkt', () => {
        const w = createAppWindow();
        w.__loadDemoData();
        const d = w.document;
        const titlar = () => [...d.querySelectorAll('#att-gora-borja [data-borja-id]')].map(li => li.dataset.borjaId);
        const items = w.eval('buildActionChecklist()');
        const vantat = borjaHar(items, new Set()).map(it => it.id);   // regeln: src/lib/attgora.js
        expect(titlar()).toEqual(vantat);
        const cb = d.querySelector(`.act-cb[data-id="${vantat[0]}"]`);
        cb.checked = true; cb.dispatchEvent(new w.Event('change'));
        expect(titlar()).not.toContain(vantat[0]);
        expect(titlar().length).toBe(Math.min(3, items.length - 1));
    });
    it('allt avbockat: "Alla punkter är hanterade."; Rensa döljer kortet', () => {
        const w = createAppWindow();
        w.__loadDemoData();
        w.__state._actionChecklistDone = new Set(w.eval('buildActionChecklist()').map(i => i.id));
        w.eval('renderActionChecklist()');
        expect(w.document.getElementById('att-gora-borja').textContent).toContain('Alla punkter är hanterade.');
        w.__clearAllData();
        expect(w.document.getElementById('att-gora').hidden).toBe(true);
        expect(w.document.getElementById('att-gora-borja').textContent.trim()).toBe('');
    });

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

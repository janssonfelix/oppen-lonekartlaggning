/**
 * Diagrammens urval på sidan (figur.urval): knappraden ovanför diagrammet, minnet per diagram under sessionen,
 * noten under diagrammet och exporten. Urvalet döljer bara märken; rapportens bildväg (diagramTillBild) är
 * alltid fullständig.
 */
import { describe, it, expect } from 'vitest';
import { createAppWindow } from './helpers/app-harness.js';

const w = createAppWindow();
const URVAL = { falt: 'bas', namn: 'BAS-intervall', etikett: 'BAS {v}' };
const basFigur = (varden = ['A', 'B', 'C', 'D'], over = {}) => ({
    beskrivning: 'Medianlön per BAS', urval: URVAL, x: { skala: 'band', titel: 'BAS' }, y: { skala: 'linjar', titel: 'Kr' },
    lager: [{ marke: 'stapel', serie: 'Alla', farg: '#2563eb', data: varden.map((b, i) => ({ x: `BAS ${b}`, y: i + 1, bas: b })) }],
    ...over,
});
const behallare = (id = 't-urval', bredd = 600) => {
    const d = w.document;
    d.getElementById(id)?.parentElement.remove();
    const kort = d.createElement('div'); kort.className = 'card';
    const h = d.createElement('h3'); h.textContent = 'Urvalsdiagrammet';
    const el = d.createElement('div'); el.id = id;
    Object.defineProperty(el, 'clientWidth', { value: bredd, configurable: true });
    kort.append(h, el); d.body.appendChild(kort);
    return el;
};
const ritaI = (el, figur, val = {}) => { w.__f = figur; w.__val = val; w.__el = el; return w.eval('ritaFigur(window.__el, window.__f, window.__val)'); };
const rad = el => el.parentElement.querySelector('.diagram-urval');
const knappar = el => [...rad(el).querySelectorAll('button[aria-pressed]')];
const knapp = (el, text) => [...rad(el).querySelectorAll('button')].find(b => b.textContent === text);
const visaAlla = el => knapp(el, 'Visa alla');
const klicka = b => b.dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
const xEt = el => [...el.querySelectorAll(':scope > svg [data-axel="x"]')].map(t => t.textContent);
const not = el => el.parentElement.querySelector('[data-rf="urval"]');
const rensa = el => { w.__el = el; w.eval('rensaFigur(window.__el)'); };

describe('knappraden', () => {
    it('står direkt före behållaren med en knapp per värde, alla intryckta, och Visa alla dold', () => {
        w.eval('_rfUrvalGlom()');
        const el = behallare();
        const f = basFigur();
        f.lager[0].data.push({ x: 'BAS E', y: 9, bas: 'E', liten: true });   // bara i en liten grupp: ingen knapp
        ritaI(el, f);
        const r = rad(el);
        expect(r).not.toBeNull();
        expect(el.previousElementSibling).toBe(r);
        expect(r.tagName).toBe('DIV');
        expect(r.getAttribute('role')).toBe('group');
        expect(r.getAttribute('aria-label')).toBe('Visa BAS-intervall');
        expect(knappar(el).map(b => b.textContent)).toEqual(['BAS A', 'BAS B', 'BAS C', 'BAS D']);
        expect(knappar(el).every(b => b.getAttribute('type') === 'button' && b.getAttribute('aria-pressed') === 'true')).toBe(true);
        expect(knappar(el).some(b => b.hasAttribute('aria-disabled'))).toBe(false);
        const alla = visaAlla(el);
        expect(alla).toBeTruthy();
        expect(alla.getAttribute('type')).toBe('button');
        expect(alla.hasAttribute('aria-pressed')).toBe(false);
        expect(alla.hidden).toBe(true);
        expect([...r.querySelectorAll('button')].at(-1)).toBe(alla);
        expect(not(el)).toBeNull();
        rensa(el);
        expect(rad(el)).toBeNull();
    });
    it('ingen rad för en figur utan urval, med ett enda värde eller i en behållare utan id', () => {
        w.eval('_rfUrvalGlom()');
        const el = behallare();
        ritaI(el, basFigur(['A', 'B'], { urval: undefined }));
        expect(rad(el)).toBeNull();
        ritaI(el, basFigur(['A']));
        expect(rad(el)).toBeNull();
        const f = basFigur(['A', 'B']);
        f.lager[0].data.push({ x: 'BAS C', y: 3, bas: 'C', liten: true });
        ritaI(el, f);
        expect(knappar(el).map(b => b.textContent)).toEqual(['BAS A', 'BAS B']);
        rensa(el);
        const utanId = behallare('t-urval-utan-id');
        utanId.removeAttribute('id');
        ritaI(utanId, basFigur());
        expect(rad(utanId)).toBeNull();
        rensa(utanId);
        utanId.parentElement.remove();
    });
    it('en ny figur utan urval tar bort raden och noten', () => {
        w.eval('_rfUrvalGlom()');
        const el = behallare();
        ritaI(el, basFigur());
        klicka(knapp(el, 'BAS A'));
        expect(not(el)).not.toBeNull();
        ritaI(el, basFigur(['A', 'B', 'C', 'D'], { urval: undefined }));
        expect(rad(el)).toBeNull();
        expect(not(el)).toBeNull();
        expect(xEt(el)).toEqual(['BAS A', 'BAS B', 'BAS C', 'BAS D']);
        rensa(el);
    });
});

describe('klick, noten och Visa alla', () => {
    it('en knapp döljer sitt värde, noten säger det, Visa alla återställer', () => {
        w.eval('_rfUrvalGlom()');
        const el = behallare();
        ritaI(el, basFigur());
        klicka(knapp(el, 'BAS A'));
        expect(knapp(el, 'BAS A').getAttribute('aria-pressed')).toBe('false');
        expect(xEt(el)).toEqual(['BAS B', 'BAS C', 'BAS D']);
        expect(el.querySelector(':scope > svg').outerHTML).not.toContain('BAS A');
        const n = not(el);
        expect(n.textContent).toBe('Diagrammet visar ett urval: BAS A är dolt. Talen i texten och tabellerna gäller hela underlaget.');
        expect(n.tagName).toBe('P');
        expect(n.className).toBe('k-mask-note');
        expect(n.getAttribute('role')).toBe('status');
        expect(el.nextElementSibling).toBe(n);
        expect(visaAlla(el).hidden).toBe(false);
        klicka(knapp(el, 'BAS B'));
        expect(not(el).textContent).toBe('Diagrammet visar ett urval: BAS A och BAS B är dolda. Talen i texten och tabellerna gäller hela underlaget.');
        expect(xEt(el)).toEqual(['BAS C', 'BAS D']);
        klicka(visaAlla(el));
        expect(knappar(el).every(b => b.getAttribute('aria-pressed') === 'true')).toBe(true);
        expect(not(el)).toBeNull();
        expect(visaAlla(el).hidden).toBe(true);
        expect(xEt(el)).toEqual(['BAS A', 'BAS B', 'BAS C', 'BAS D']);
        rensa(el);
    });
    it('tre dolda: noten räknar upp dem med komma och och', () => {
        w.eval('_rfUrvalGlom()');
        const el = behallare();
        ritaI(el, basFigur(['A', 'B', 'C', 'D', 'N']));
        for (const v of ['BAS N', 'BAS A', 'BAS B']) klicka(knapp(el, v));
        expect(not(el).textContent).toBe('Diagrammet visar ett urval: BAS A, BAS B och BAS N är dolda. Talen i texten och tabellerna gäller hela underlaget.');
        rensa(el);
        expect(not(el)).toBeNull();
    });
    it('ett klick på en knapp igen visar värdet', () => {
        w.eval('_rfUrvalGlom()');
        const el = behallare();
        ritaI(el, basFigur());
        klicka(knapp(el, 'BAS C'));
        klicka(knapp(el, 'BAS C'));
        expect(knapp(el, 'BAS C').getAttribute('aria-pressed')).toBe('true');
        expect(not(el)).toBeNull();
        expect(xEt(el)).toEqual(['BAS A', 'BAS B', 'BAS C', 'BAS D']);
        rensa(el);
    });
    it('den sista valda kan inte väljas bort (aria-disabled), och knapparna behåller fokus', () => {
        w.eval('_rfUrvalGlom()');
        const el = behallare();
        ritaI(el, basFigur());
        for (const v of ['BAS A', 'BAS B', 'BAS C']) klicka(knapp(el, v));
        const d = knapp(el, 'BAS D');
        expect(d.getAttribute('aria-disabled')).toBe('true');
        expect(knappar(el).filter(b => b.hasAttribute('aria-disabled'))).toEqual([d]);
        const fore = el.querySelector(':scope > svg').outerHTML;
        klicka(d);
        expect(d.getAttribute('aria-pressed')).toBe('true');
        expect(el.querySelector(':scope > svg').outerHTML).toBe(fore);
        expect(xEt(el)).toEqual(['BAS D']);
        // Knappen sitter kvar (raden byggs inte om av ett klick): fokus stannar där det var.
        const a = knapp(el, 'BAS A');
        a.focus();
        klicka(a);
        expect(w.document.activeElement).toBe(a);
        expect(d.hasAttribute('aria-disabled')).toBe(false);
        rensa(el);
    });
});

describe('minnet', () => {
    it('överlever rensaFigur; bortvalda värden som saknas ignoreras; bara bortvalda kvar ger allt', () => {
        w.eval('_rfUrvalGlom()');
        const el = behallare();
        ritaI(el, basFigur());
        klicka(knapp(el, 'BAS A'));
        rensa(el);
        ritaI(el, basFigur());
        expect(knapp(el, 'BAS A').getAttribute('aria-pressed')).toBe('false');
        expect(xEt(el)).toEqual(['BAS B', 'BAS C', 'BAS D']);
        expect([...el._figurBortvalda]).toEqual(['A']);
        klicka(knapp(el, 'BAS B'));
        // Vyn byter underlag: A finns inte längre. B är fortfarande bortvald.
        ritaI(el, basFigur(['B', 'C', 'D']));
        expect([...el._figurBortvalda]).toEqual(['B']);
        expect(xEt(el)).toEqual(['BAS C', 'BAS D']);
        expect(not(el).textContent).toBe('Diagrammet visar ett urval: BAS B är dolt. Talen i texten och tabellerna gäller hela underlaget.');
        // Bara bortvalda värden kvar: inget bortvalt, aldrig en tom bild.
        ritaI(el, basFigur(['A', 'B']));
        expect([...el._figurBortvalda]).toEqual([]);
        expect(xEt(el)).toEqual(['BAS A', 'BAS B']);
        expect(knappar(el).every(b => b.getAttribute('aria-pressed') === 'true')).toBe(true);
        expect(not(el)).toBeNull();
        // A finns igen: minnet gäller igen.
        ritaI(el, basFigur());
        expect(xEt(el)).toEqual(['BAS C', 'BAS D']);
        rensa(el);
    });
    it('gäller per diagram: ett annat id har sitt eget urval', () => {
        w.eval('_rfUrvalGlom()');
        const a = behallare('t-urval-a'), b = behallare('t-urval-b');
        ritaI(a, basFigur());
        ritaI(b, basFigur());
        klicka(knapp(a, 'BAS A'));
        expect(xEt(b)).toEqual(['BAS A', 'BAS B', 'BAS C', 'BAS D']);
        rensa(a); rensa(b);
        a.parentElement.remove(); b.parentElement.remove();
    });
    it('_rfUrvalGlom tömmer minnet: nästa ritaFigur visar allt', () => {
        const el = behallare();
        ritaI(el, basFigur());
        klicka(knapp(el, 'BAS A'));
        w.eval('_rfUrvalGlom()');
        ritaI(el, basFigur());
        expect(xEt(el)).toEqual(['BAS A', 'BAS B', 'BAS C', 'BAS D']);
        expect(not(el)).toBeNull();
        rensa(el);
    });
    it('Rensa all data (_rfRensaAlla) glömmer urvalet', () => {
        const el = behallare();
        ritaI(el, basFigur());
        klicka(knapp(el, 'BAS A'));
        w.eval('_rfRensaAlla()');
        expect(rad(el)).toBeNull();
        expect(not(el)).toBeNull();
        ritaI(el, basFigur());
        expect(xEt(el)).toEqual(['BAS A', 'BAS B', 'BAS C', 'BAS D']);
        rensa(el);
    });
    it('Visa alla glömmer valet också efter rensaFigur', () => {
        w.eval('_rfUrvalGlom()');
        const el = behallare();
        ritaI(el, basFigur());
        klicka(knapp(el, 'BAS A'));
        klicka(visaAlla(el));
        rensa(el);
        ritaI(el, basFigur());
        expect(xEt(el)).toEqual(['BAS A', 'BAS B', 'BAS C', 'BAS D']);
        rensa(el);
    });
    it('lönefilens inläsning anropar _rfUrvalGlom', async () => {
        const { readFileSync } = await import('node:fs');
        const kalla = readFileSync('src/app/32-filinlasning.js', 'utf8');
        const lasIn = kalla.slice(kalla.indexOf('const lasIn = () => {'), kalla.indexOf('_afterDataLoaded();', kalla.indexOf('const lasIn = () => {')));
        expect(lasIn).toContain('_rfUrvalGlom()');
    });
    it('demot (litet och stort) glömmer urvalet: den gemensamma inläsningen anropar _rfUrvalGlom', () => {
        const w2 = createAppWindow();
        const el = w2.document.createElement('div'); el.id = 't-urval-demo';
        Object.defineProperty(el, 'clientWidth', { value: 600, configurable: true });
        w2.document.body.appendChild(el);
        w2.__el = el; w2.__f = basFigur();
        w2.eval('ritaFigur(window.__el, window.__f, {})');
        el.previousElementSibling.querySelector('[data-urval="A"]').dispatchEvent(new w2.MouseEvent('click', { bubbles: true }));
        expect(el._figurBortvalda.has('A')).toBe(true);
        w2.__loadDemoData();
        w2.eval('ritaFigur(window.__el, window.__f, {})');
        expect(el._figurBortvalda.size).toBe(0);
        // Det stora demot går samma väg (_lasInDemounderlag), före underlaget byts.
        const kalla = w2.eval('_lasInDemounderlag.toString()');
        expect(kalla.indexOf('_rfUrvalGlom()')).toBeGreaterThan(-1);
        expect(kalla.indexOf('_rfUrvalGlom()')).toBeLessThan(kalla.indexOf('state.data = skapa()'));
        expect(w2.eval('loadStortDemo.toString()')).toContain('_lasInDemounderlag(');
    });
});

describe('exporten', () => {
    const fanga = async (fn) => {
        const org = w.figurTillBild, sedda = [];
        w.figurTillBild = (figur, format, b, h, val) => { sedda.push({ figur, format, val }); return Promise.resolve('data:image/png;base64,AAAA'); };
        const dl = w._downloadCSV, kop = w._copyMatrixToClipboard;
        try { await fn(); } finally { w.figurTillBild = org; w._downloadCSV = dl; w._copyMatrixToClipboard = kop; }
        return sedda;
    };
    it('_rfExportFigur bär bortvalda; diagramdatan har raden Dolt i diagrammet och alla datarader', () => {
        w.eval('_rfUrvalGlom()');
        const el = behallare();
        ritaI(el, basFigur(['A', 'B', 'C', 'D', 'N']));
        w.__el = el;
        const utan = w.eval('chartExportRows(window.__el)');
        expect(utan.some(r => String(r[0]).startsWith('Dolt i diagrammet'))).toBe(false);
        expect([...w.eval('_rfExportFigur(window.__el)').bortvalda]).toEqual([]);
        klicka(knapp(el, 'BAS N'));
        klicka(knapp(el, 'BAS A'));
        expect([...w.eval('_rfExportFigur(window.__el)').bortvalda].sort()).toEqual(['A', 'N']);
        const med = w.eval('chartExportRows(window.__el)');
        expect(med).toHaveLength(utan.length + 1);
        expect(med[1]).toEqual(['Dolt i diagrammet: BAS A, BAS N']);
        expect(med.slice(2)).toEqual(utan.slice(1));
        rensa(el);
    });
    it('raden står efter Urval-raden', () => {
        w.eval('_rfUrvalGlom()');
        const el = behallare();
        ritaI(el, basFigur(), { exportBeskrivning: 'Kvinnor' });
        klicka(knapp(el, 'BAS A'));
        w.__el = el;
        const rader = w.eval('chartExportRows(window.__el)');
        expect(rader[1]).toEqual(['Urval: Kvinnor']);
        expect(rader[2]).toEqual(['Dolt i diagrammet: BAS A']);
        rensa(el);
    });
    it('exportmenyns PNG och SVG får bortvalda och fotraden; utan urval ingen sådan fotrad', async () => {
        w.eval('_rfUrvalGlom()');
        const el = behallare();
        ritaI(el, basFigur(['A', 'B', 'C', 'D', 'N']));
        w.__el = el;
        const fore = await fanga(() => w.eval('chartExportRun(window.__el, "svg")'));
        expect(fore[0].val.fot).not.toContain('Dolt');
        klicka(knapp(el, 'BAS N'));
        klicka(knapp(el, 'BAS A'));
        const sedda = await fanga(async () => {
            await w.eval('chartExportRun(window.__el, "png-presentation")');
            await w.eval('chartExportRun(window.__el, "svg")');
        });
        expect(sedda.map(s => s.format)).toEqual(['png', 'svg']);
        for (const s of sedda) {
            expect([...s.val.bortvalda].sort()).toEqual(['A', 'N']);
            expect(s.val.fot).toMatch(/^Lönekartläggning \d{4}-\d{2}-\d{2} · Dolt i diagrammet: BAS A, BAS N$/);
        }
        rensa(el);
    });
    it('diagramTillBild (rapport, utskrift, ZIP, rapportunderlag) är alltid fullständig', async () => {
        w.eval('_rfUrvalGlom()');
        const el = behallare();
        ritaI(el, basFigur());
        klicka(knapp(el, 'BAS A'));
        w.__el = el;
        const sedda = await fanga(async () => {
            await w.eval('diagramTillBild(window.__el, { bredd: 1600, hojd: 900 })');
            await w.eval('diagramTillBild(window.__el, { bredd: 1400, hojd: 600, utanRubrik: true })');
        });
        expect(sedda).toHaveLength(2);
        for (const s of sedda) {
            expect('bortvalda' in s.val).toBe(false);
            expect(String(s.val.fot || '')).not.toContain('Dolt');
            const svg = w.figurTillSvg(s.figur, 1600, 900, s.val);
            expect(svg).toContain('BAS A');
        }
        // Skärmen visar fortfarande urvalet.
        expect(xEt(el)).toEqual(['BAS B', 'BAS C', 'BAS D']);
        rensa(el);
    });
});

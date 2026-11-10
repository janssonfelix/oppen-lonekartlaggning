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
const visaAlla = el => el.parentElement.querySelector('.diagram-urval [data-urval-alla]');
const klicka = b => b.dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
const xEt = el => [...el.querySelectorAll(':scope > svg [data-axel="x"]')].map(t => t.textContent);
const not = el => el.parentElement.querySelector('[data-rf="urval"]');
const rensa = el => { w.__el = el; w.eval('rensaFigur(window.__el)'); };
const bortvalda = el => [...(el._figurFilter.kategori.get('bas') || [])];

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
        expect(n.textContent).toBe('Diagrammet visar ett urval: utan BAS A. Talen i texten och tabellerna gäller hela underlaget.');
        expect(n.tagName).toBe('P');
        expect(n.className).toBe('k-mask-note');
        expect(n.getAttribute('role')).toBe('status');
        expect(el.nextElementSibling).toBe(n);
        expect(visaAlla(el).hidden).toBe(false);
        klicka(knapp(el, 'BAS B'));
        expect(not(el).textContent).toBe('Diagrammet visar ett urval: utan BAS A, BAS B. Talen i texten och tabellerna gäller hela underlaget.');
        expect(xEt(el)).toEqual(['BAS C', 'BAS D']);
        klicka(visaAlla(el));
        expect(knappar(el).every(b => b.getAttribute('aria-pressed') === 'true')).toBe(true);
        expect(not(el)).toBeNull();
        expect(visaAlla(el).hidden).toBe(true);
        expect(xEt(el)).toEqual(['BAS A', 'BAS B', 'BAS C', 'BAS D']);
        rensa(el);
    });
    it('tre dolda: noten räknar upp dem med komma i knapparnas ordning', () => {
        w.eval('_rfUrvalGlom()');
        const el = behallare();
        ritaI(el, basFigur(['A', 'B', 'C', 'D', 'N']));
        for (const v of ['BAS N', 'BAS A', 'BAS B']) klicka(knapp(el, v));
        expect(not(el).textContent).toBe('Diagrammet visar ett urval: utan BAS A, BAS B, BAS N. Talen i texten och tabellerna gäller hela underlaget.');
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
        expect(bortvalda(el)).toEqual(['A']);
        klicka(knapp(el, 'BAS B'));
        // Vyn byter underlag: A finns inte längre. B är fortfarande bortvald.
        ritaI(el, basFigur(['B', 'C', 'D']));
        expect(bortvalda(el)).toEqual(['B']);
        expect(xEt(el)).toEqual(['BAS C', 'BAS D']);
        expect(not(el).textContent).toBe('Diagrammet visar ett urval: utan BAS B. Talen i texten och tabellerna gäller hela underlaget.');
        // Bara bortvalda värden kvar: inget bortvalt, aldrig en tom bild.
        ritaI(el, basFigur(['A', 'B']));
        expect(bortvalda(el)).toEqual([]);
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
        expect(el._figurFilter.kategori.get('bas').has('A')).toBe(true);
        w2.__loadDemoData();
        w2.eval('ritaFigur(window.__el, window.__f, {})');
        expect(el._figurFilter.kategori.get('bas').size).toBe(0);
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
    it('_rfExportFigur bär filtret; diagramdatan har raden Urval i diagrammet och alla datarader', () => {
        w.eval('_rfUrvalGlom()');
        const el = behallare();
        ritaI(el, basFigur(['A', 'B', 'C', 'D', 'N']));
        w.__el = el;
        const utan = w.eval('chartExportRows(window.__el)');
        expect(utan.some(r => String(r[0]).startsWith('Urval i diagrammet'))).toBe(false);
        expect([...w.eval('_rfExportFigur(window.__el)').filter.kategori.get('bas')]).toEqual([]);
        klicka(knapp(el, 'BAS N'));
        klicka(knapp(el, 'BAS A'));
        expect([...w.eval('_rfExportFigur(window.__el)').filter.kategori.get('bas')].sort()).toEqual(['A', 'N']);
        const med = w.eval('chartExportRows(window.__el)');
        expect(med).toHaveLength(utan.length + 1);
        expect(med[1]).toEqual(['Urval i diagrammet: utan BAS A, BAS N']);
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
        expect(rader[2]).toEqual(['Urval i diagrammet: utan BAS A']);
        rensa(el);
    });
    it('exportmenyns PNG och SVG får filtret och fotraden; utan urval ingen sådan fotrad', async () => {
        w.eval('_rfUrvalGlom()');
        const el = behallare();
        ritaI(el, basFigur(['A', 'B', 'C', 'D', 'N']));
        w.__el = el;
        const fore = await fanga(() => w.eval('chartExportRun(window.__el, "svg")'));
        expect(fore[0].val.fot).not.toContain('Urval i diagrammet');
        klicka(knapp(el, 'BAS N'));
        klicka(knapp(el, 'BAS A'));
        const sedda = await fanga(async () => {
            await w.eval('chartExportRun(window.__el, "png-presentation")');
            await w.eval('chartExportRun(window.__el, "svg")');
        });
        expect(sedda.map(s => s.format)).toEqual(['png', 'svg']);
        for (const s of sedda) {
            expect([...s.val.filter.kategori.get('bas')].sort()).toEqual(['A', 'N']);
            expect(s.val.fot).toMatch(/^Lönekartläggning \d{4}-\d{2}-\d{2} · Urval i diagrammet: utan BAS A, BAS N$/);
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
            expect('filter' in s.val).toBe(false);
            expect(String(s.val.fot || '')).not.toContain('Urval i diagrammet');
            const svg = w.figurTillSvg(s.figur, 1600, 900, s.val);
            expect(svg).toContain('BAS A');
        }
        // Skärmen visar fortfarande urvalet.
        expect(xEt(el)).toEqual(['BAS B', 'BAS C', 'BAS D']);
        rensa(el);
    });
});

// ---- Diagramfilter v2: flera dimensioner per diagram, kategori och intervall ----
describe('intervall och flera dimensioner', () => {
    const ANTAL = { typ: 'intervall', falt: 'n', namn: 'Antal personer i gruppen', format: 'antal', etikett: '{v} personer i gruppen' };
    // Sex grupper (punkter) med BAS och antal, en liten grupp och en referenspunkt utan fälten.
    const GRUPPER = [['A', 5], ['A', 10], ['B', 30], ['B', 50], ['C', 51], ['C', 1500]];
    const gruppFigur = (urval = [URVAL, ANTAL], over = {}) => ({
        beskrivning: 'Grupper', urval, x: { skala: 'linjar', titel: 'Antal' }, y: { skala: 'linjar', titel: 'Kr' },
        lager: [
            { marke: 'punkt', serie: 'Grupper', farg: '#2563eb', data: [...GRUPPER.map(([bas, n], i) => ({ x: n, y: 30000 + i * 100, bas, n })), { x: 20, y: 31000, bas: 'A', n: 2, liten: true }] },
            { marke: 'punkt', serie: 'Referens', farg: '#111111', data: [{ x: 25, y: 32000 }] },
        ],
        ...over,
    });
    const rader = el => [...el.parentElement.querySelectorAll('.diagram-urval')];
    const intervallRad = el => rader(el).find(r => r.getAttribute('data-urval-falt') === 'n');
    const falt = (el, grans) => intervallRad(el).querySelector(`input[data-urval-grans="${grans}"]`);
    const satt = (el, grans, text) => { const f = falt(el, grans); f.value = text; f.dispatchEvent(new w.Event('change', { bubbles: true })); return f; };
    const ritadeIndex = el => [...el.querySelectorAll(':scope > svg circle[data-l="0"]')].map(c => Number(c.getAttribute('data-i'))).sort((a, b) => a - b);
    const svgText = el => el.querySelector(':scope > svg').outerHTML;

    it('en rad per dimension i figurens ordning före behållaren; intervallet har Minst och Högst med etiketter och platshållare', () => {
        w.eval('_rfUrvalGlom()');
        const el = behallare();
        ritaI(el, gruppFigur());
        const r = rader(el);
        expect(r.map(x => x.getAttribute('data-urval-falt'))).toEqual(['bas', 'n']);
        expect(el.previousElementSibling).toBe(r[1]);
        expect(r[1].previousElementSibling).toBe(r[0]);
        const ir = intervallRad(el);
        expect(ir.getAttribute('role')).toBe('group');
        expect(ir.getAttribute('aria-label')).toBe('Antal personer i gruppen');
        const [min, max] = [falt(el, 'min'), falt(el, 'max')];
        expect([min.type, max.type]).toEqual(['text', 'text']);
        expect([min.inputMode, max.inputMode]).toEqual(['decimal', 'decimal']);
        expect(min.getAttribute('aria-label')).toBe('Antal personer i gruppen, minst');
        expect(max.getAttribute('aria-label')).toBe('Antal personer i gruppen, högst');
        expect(min.closest('label').textContent.trim()).toBe('Minst');
        expect(max.closest('label').textContent.trim()).toBe('Högst');
        // Platshållarna är figurens minsta och största antal (den lilla gruppen räknas inte).
        expect(min.placeholder).toBe('5');
        expect(max.placeholder).toBe('1 500');
        expect([min.value, max.value]).toEqual(['', '']);
        // Visa alla står sist i den sista raden och är dold utan filter.
        expect([...ir.querySelectorAll('button')].at(-1)).toBe(visaAlla(el));
        expect(r[0].querySelector('[data-urval-alla]')).toBeNull();
        expect(visaAlla(el).hidden).toBe(true);
        expect(not(el)).toBeNull();
        rensa(el);
        expect(rader(el)).toEqual([]);
    });
    it('ingen intervallrad under två olika tal; det gamla objektformatet ger bara knappraden', () => {
        w.eval('_rfUrvalGlom()');
        const el = behallare();
        const f = gruppFigur();
        f.lager[0].data.forEach(d => { d.n = 7; });
        ritaI(el, f);
        expect(rader(el).map(x => x.getAttribute('data-urval-falt'))).toEqual(['bas']);
        ritaI(el, gruppFigur(URVAL));
        expect(rader(el).map(x => x.getAttribute('data-urval-falt'))).toEqual(['bas']);
        expect(knappar(el).map(b => b.textContent)).toEqual(['BAS A', 'BAS B', 'BAS C']);
        rensa(el);
    });
    it('Minst och Högst döljer punkter utanför (gränserna ingår), index är oförändrade och referensen ritas alltid', () => {
        w.eval('_rfUrvalGlom()');
        const el = behallare();
        ritaI(el, gruppFigur());
        expect(ritadeIndex(el)).toEqual([0, 1, 2, 3, 4, 5]);
        satt(el, 'min', '10');
        expect(ritadeIndex(el)).toEqual([1, 2, 3, 4, 5]);
        satt(el, 'max', '50');
        expect(ritadeIndex(el)).toEqual([1, 2, 3]);                     // 10 och 50 ingår
        expect(el.querySelector(':scope > svg circle[data-l="1"][data-i="0"]')).not.toBeNull();   // referensen utan fältet
        expect(not(el).textContent).toBe('Diagrammet visar ett urval: 10–50 personer i gruppen. Talen i texten och tabellerna gäller hela underlaget.');
        expect(visaAlla(el).hidden).toBe(false);
        // Ett tomt fält är ingen gräns.
        satt(el, 'min', '');
        expect(ritadeIndex(el)).toEqual([0, 1, 2, 3]);
        expect(not(el).textContent).toContain('högst 50 personer i gruppen');
        rensa(el);
    });
    it('talen läses med verktygets talinläsning: decimalkomma, mellanslag och minustecken', () => {
        w.eval('_rfUrvalGlom()');
        const el = behallare();
        ritaI(el, gruppFigur());
        satt(el, 'min', '9,5');
        expect(ritadeIndex(el)).toEqual([1, 2, 3, 4, 5]);
        expect(not(el).textContent).toContain('minst 9,5 personer i gruppen');
        satt(el, 'min', '1 500');
        expect(ritadeIndex(el)).toEqual([5]);
        satt(el, 'min', '− 5');
        expect(ritadeIndex(el)).toEqual([0, 1, 2, 3, 4, 5]);
        expect(el._figurFilter.intervall.get('n')).toEqual({ min: -5, max: null });
        rensa(el);
    });
    it('ett tal som inte går att läsa och Minst större än Högst markerar fältet (aria-invalid) och ändrar inget', () => {
        w.eval('_rfUrvalGlom()');
        const el = behallare();
        ritaI(el, gruppFigur());
        satt(el, 'max', '50');
        const fore = svgText(el);
        const min = satt(el, 'min', '60');
        expect(min.getAttribute('aria-invalid')).toBe('true');
        expect(falt(el, 'max').hasAttribute('aria-invalid')).toBe(false);
        expect(svgText(el)).toBe(fore);
        expect(el._figurFilter.intervall.get('n')).toEqual({ min: null, max: 50 });
        expect(not(el).textContent).toBe('Antal personer i gruppen: Minst är större än högst. Filtret är oförändrat. Diagrammet visar ett urval: högst 50 personer i gruppen. Talen i texten och tabellerna gäller hela underlaget.');
        // Rättat i det andra fältet: båda läses, markeringen försvinner och filtret gäller.
        satt(el, 'max', '1500');
        expect(min.hasAttribute('aria-invalid')).toBe(false);
        expect(ritadeIndex(el)).toEqual([5]);
        expect(not(el).textContent).toBe('Diagrammet visar ett urval: 60–1\u00a0500 personer i gruppen. Talen i texten och tabellerna gäller hela underlaget.');
        const fore2 = svgText(el);
        const max = satt(el, 'max', 'många');
        expect(max.getAttribute('aria-invalid')).toBe('true');
        expect(svgText(el)).toBe(fore2);
        expect(not(el).textContent).toMatch(/^Antal personer i gruppen: Högst är inget tal\. Filtret är oförändrat\./);
        rensa(el);
    });
    it('två dimensioner verkar tillsammans och noten listar båda', () => {
        w.eval('_rfUrvalGlom()');
        const el = behallare();
        ritaI(el, gruppFigur());
        klicka(knapp(el, 'BAS A'));
        satt(el, 'max', '50');
        expect(ritadeIndex(el)).toEqual([2, 3]);
        expect(not(el).textContent).toBe('Diagrammet visar ett urval: utan BAS A; högst 50 personer i gruppen. Talen i texten och tabellerna gäller hela underlaget.');
        klicka(knapp(el, 'BAS A'));
        expect(ritadeIndex(el)).toEqual([0, 1, 2, 3]);
        rensa(el);
    });
    it('ett intervall som döljer allt är tillåtet: diagrammet säger Inga grupper i urvalet, raderna och noten står kvar', () => {
        w.eval('_rfUrvalGlom()');
        const el = behallare();
        const f = gruppFigur();
        f.lager.pop();   // utan referensen: annars står den kvar som ett märke
        ritaI(el, f);
        satt(el, 'min', '5000');
        expect(el.querySelector(':scope > svg')).toBeNull();
        expect(el.querySelector('[data-rf="tom"]').textContent).toBe('Inga grupper i urvalet');
        expect(rader(el)).toHaveLength(2);
        expect(not(el).textContent).toContain('minst 5 000 personer i gruppen');
        satt(el, 'min', '');
        expect(ritadeIndex(el)).toEqual([0, 1, 2, 3, 4, 5]);
        rensa(el);
    });
    it('Visa alla nollställer alla dimensioner, tömmer fälten och glömmer minnet', () => {
        w.eval('_rfUrvalGlom()');
        const el = behallare();
        ritaI(el, gruppFigur());
        klicka(knapp(el, 'BAS C'));
        satt(el, 'min', '10');
        satt(el, 'max', 'x');
        klicka(visaAlla(el));
        expect(ritadeIndex(el)).toEqual([0, 1, 2, 3, 4, 5]);
        expect([falt(el, 'min').value, falt(el, 'max').value]).toEqual(['', '']);
        expect(falt(el, 'max').hasAttribute('aria-invalid')).toBe(false);
        expect(not(el)).toBeNull();
        expect(visaAlla(el).hidden).toBe(true);
        rensa(el);
        ritaI(el, gruppFigur());
        expect(ritadeIndex(el)).toEqual([0, 1, 2, 3, 4, 5]);
        rensa(el);
    });
    it('minnet per dimension överlever en omritning (fälten visar det) och glöms av _rfUrvalGlom', () => {
        w.eval('_rfUrvalGlom()');
        const el = behallare();
        ritaI(el, gruppFigur());
        klicka(knapp(el, 'BAS B'));
        satt(el, 'min', '7,5');
        rensa(el);
        ritaI(el, gruppFigur());
        expect(falt(el, 'min').value).toBe('7,5');
        expect(knapp(el, 'BAS B').getAttribute('aria-pressed')).toBe('false');
        expect(ritadeIndex(el)).toEqual([1, 4, 5]);
        // Ett annat diagram (id) har sitt eget minne.
        const annat = behallare('t-urval-annat');
        ritaI(annat, gruppFigur());
        expect(ritadeIndex(annat)).toEqual([0, 1, 2, 3, 4, 5]);
        rensa(annat); annat.parentElement.remove();
        // Färre grupper, alla utanför det minda intervallet: inget göms tyst — noten säger vad som gäller.
        const f = gruppFigur();
        f.lager = [{ ...f.lager[0], data: [{ x: 1, y: 1, bas: 'A', n: 2 }, { x: 3, y: 3, bas: 'A', n: 3 }] }];
        ritaI(el, f);
        expect(el.querySelector('[data-rf="tom"]').textContent).toBe('Inga grupper i urvalet');
        expect(not(el).textContent).toContain('minst 7,5 personer i gruppen');
        w.eval('_rfUrvalGlom()');
        ritaI(el, gruppFigur());
        expect(falt(el, 'min').value).toBe('');
        expect(ritadeIndex(el)).toEqual([0, 1, 2, 3, 4, 5]);
        expect(not(el)).toBeNull();
        rensa(el);
    });
    it('fokus i ett intervallfält följer med när raderna byggs om', () => {
        w.eval('_rfUrvalGlom()');
        const el = behallare();
        ritaI(el, gruppFigur());
        falt(el, 'max').focus();
        ritaI(el, gruppFigur());
        expect(w.document.activeElement).toBe(falt(el, 'max'));
        knapp(el, 'BAS B').focus();
        ritaI(el, gruppFigur());
        expect(w.document.activeElement).toBe(knapp(el, 'BAS B'));
        rensa(el);
    });
    it('exportmenyns bild följer filtret och fotraden listar det; diagramdatan har alla rader; diagramTillBild ritar allt', async () => {
        w.eval('_rfUrvalGlom()');
        const el = behallare();
        ritaI(el, gruppFigur());
        w.__el = el;
        const utan = w.eval('chartExportRows(window.__el)');
        klicka(knapp(el, 'BAS A'));
        satt(el, 'min', '10');
        satt(el, 'max', '50');
        const med = w.eval('chartExportRows(window.__el)');
        expect(med[1]).toEqual(['Urval i diagrammet: utan BAS A; 10–50 personer i gruppen']);
        expect(med.slice(2)).toEqual(utan.slice(1));
        const org = w.figurTillBild, sedda = [];
        w.figurTillBild = (figur, format, b, h, val) => { sedda.push({ figur, val }); return Promise.resolve('data:image/png;base64,AAAA'); };
        try {
            await w.eval('chartExportRun(window.__el, "svg")');
            await w.eval('diagramTillBild(window.__el, { bredd: 1600, hojd: 900 })');
        } finally { w.figurTillBild = org; }
        const [meny, rapport] = sedda;
        expect(meny.val.fot).toMatch(/ · Urval i diagrammet: utan BAS A; 10–50 personer i gruppen$/);
        expect(meny.val.filter.intervall.get('n')).toEqual({ min: 10, max: 50 });
        const menySvg = w.figurTillSvg(meny.figur, 1600, 900, meny.val);
        const punkter = t => (t.match(/data-marke="punkt"/g) || []).length;
        expect(punkter(menySvg)).toBe(3);                               // B 30, B 50 och referensen
        expect('filter' in rapport.val).toBe(false);
        const rapportSvg = w.figurTillSvg(rapport.figur, 1600, 900, rapport.val);
        expect(punkter(rapportSvg)).toBe(7);
        // Filtret i exporten är en kopia: ett klick efteråt ändrar den inte.
        satt(el, 'max', '');
        expect(meny.val.filter.intervall.get('n')).toEqual({ min: 10, max: 50 });
        rensa(el);
    });
});

// ---- Diagramfilter v3: kategori som lista (många värden) ----
describe('kategori som lista', () => {
    const yrken = n => Array.from({ length: n }, (_, i) => `Yrke ${String(i + 1).padStart(2, '0')}`);
    const yrkesFigur = (n = 40, urval) => ({
        beskrivning: 'Yrkesgrupper', urval: urval || [w.eval('URVAL.yrkesgrupp')], x: { skala: 'linjar', titel: 'Antal' }, y: { skala: 'linjar', titel: 'Kr' },
        lager: [{ marke: 'punkt', serie: 'Grupper', farg: '#2563eb', data: yrken(n).map((yrke, i) => ({ x: i + 1, y: 30000 + i * 10, yrke })) }],
    });
    const lrad = el => el.parentElement.querySelector('.diagram-urval');
    const det = el => lrad(el).querySelector('details[data-urval-lista]');
    const summering = el => lrad(el).querySelector('summary[data-urval-summering]');
    const sokf = el => lrad(el).querySelector('input[data-urval-sok]');
    const rutor = el => [...lrad(el).querySelectorAll('input[type="checkbox"][data-urval]')];
    const ruta = (el, v) => rutor(el).find(r => r.getAttribute('data-urval') === v);
    const markera = (el, vad) => lrad(el).querySelector(`[data-urval-markera="${vad}"]`);
    const synligaPoster = el => [...lrad(el).querySelectorAll('.diagram-urval-poster > li')].filter(li => !li.hidden).map(li => li.textContent);
    const punkter = el => el.querySelectorAll(':scope > svg circle[data-marke="punkt"]').length;
    const vaxla = r => { r.checked = !r.checked; r.dispatchEvent(new w.Event('change', { bubbles: true })); };
    const sok = (el, text) => { const s = sokf(el); s.value = text; s.dispatchEvent(new w.Event('input', { bubbles: true })); };

    it('URVAL.yrkesgrupp och URVAL.sektor läser yrke och sektor och visas som lista', () => {
        expect(w.eval('JSON.stringify(URVAL.yrkesgrupp)')).toBe(JSON.stringify({ typ: 'kategori', falt: 'yrke', namn: 'Yrkesgrupp', etikett: '{v}', visning: 'lista' }));
        expect(w.eval('JSON.stringify(URVAL.sektor)')).toBe(JSON.stringify({ typ: 'kategori', falt: 'sektor', namn: 'Sektor', etikett: '{v}', visning: 'lista' }));
        expect(w.eval('Object.isFrozen(URVAL.yrkesgrupp) && Object.isFrozen(URVAL.sektor)')).toBe(true);
    });
    it('en hopfälld lista med summering, sökfält, Markera alla och Avmarkera alla och en ikryssad ruta per värde (ARIA)', () => {
        w.eval('_rfUrvalGlom()');
        const el = behallare();
        ritaI(el, yrkesFigur());
        const r = lrad(el);
        expect(el.previousElementSibling).toBe(r);
        expect(r.getAttribute('role')).toBe('group');
        expect(r.getAttribute('aria-label')).toBe('Visa Yrkesgrupp');
        expect(r.getAttribute('data-urval-falt')).toBe('yrke');
        expect(det(el).open).toBe(false);
        expect(summering(el).textContent).toBe('Yrkesgrupp: alla 40');
        expect(sokf(el).type).toBe('search');
        expect(sokf(el).getAttribute('aria-label')).toBe('Sök yrkesgrupp');
        expect(markera(el, 'alla').textContent).toBe('Markera alla');
        expect(markera(el, 'inga').textContent).toBe('Avmarkera alla');
        expect([markera(el, 'alla').type, markera(el, 'inga').type]).toEqual(['button', 'button']);
        expect(rutor(el)).toHaveLength(40);
        expect(rutor(el).every(x => x.checked && x.closest('label') && x.closest('li'))).toBe(true);
        expect(ruta(el, 'Yrke 07').closest('label').textContent).toBe('Yrke 07');
        expect(r.querySelectorAll('[aria-pressed]')).toHaveLength(0);   // inga knappar per värde
        expect(visaAlla(el).hidden).toBe(true);
        expect([...r.children].at(-1)).toBe(visaAlla(el));
        rensa(el);
    });
    it('fler än tolv värden ger en lista också utan visning; tolv ger knappar', () => {
        w.eval('_rfUrvalGlom()');
        const el = behallare();
        const dim = { typ: 'kategori', falt: 'yrke', namn: 'Yrkesgrupp' };
        ritaI(el, yrkesFigur(13, [dim]));
        expect(det(el)).not.toBeNull();
        expect(rutor(el)).toHaveLength(13);
        ritaI(el, yrkesFigur(12, [dim]));
        expect(det(el)).toBeNull();
        expect(knappar(el)).toHaveLength(12);
        rensa(el);
    });
    it('en kryssruta döljer sitt värde; summeringen och noten följer; alla får väljas bort', () => {
        w.eval('_rfUrvalGlom()');
        const el = behallare();
        ritaI(el, yrkesFigur());
        vaxla(ruta(el, 'Yrke 01'));
        expect(punkter(el)).toBe(39);
        expect(ruta(el, 'Yrke 01').checked).toBe(false);
        expect(summering(el).textContent).toBe('Yrkesgrupp: 39 av 40');
        expect(not(el).textContent).toBe('Diagrammet visar ett urval: utan Yrke 01. Talen i texten och tabellerna gäller hela underlaget.');
        expect(visaAlla(el).hidden).toBe(false);
        vaxla(ruta(el, 'Yrke 01'));
        expect(punkter(el)).toBe(40);
        expect(not(el)).toBeNull();
        markera(el, 'inga').click();
        expect(rutor(el).some(x => x.checked)).toBe(false);
        expect(summering(el).textContent).toBe('Yrkesgrupp: 0 av 40');
        expect(el.textContent).toBe('Inga grupper i urvalet');
        expect(not(el).textContent).toContain('Diagrammet visar ett urval: Yrkesgrupp 0 av 40.');
        vaxla(ruta(el, 'Yrke 05'));
        expect(punkter(el)).toBe(1);
        expect(not(el).textContent).toContain('urval: bara Yrke 05.');
        markera(el, 'alla').click();
        expect(punkter(el)).toBe(40);
        expect(summering(el).textContent).toBe('Yrkesgrupp: alla 40');
        expect(not(el)).toBeNull();
        rensa(el);
    });
    it('sökningen döljer poster som inte matchar, och knapparna gäller då träffarna', () => {
        w.eval('_rfUrvalGlom()');
        const el = behallare();
        ritaI(el, yrkesFigur());
        const traffar = () => lrad(el).querySelector('.diagram-urval-traffar');
        expect(traffar().getAttribute('aria-live')).toBe('polite');
        expect(traffar().textContent).toBe('');
        sok(el, '  YRKE   1');
        expect(synligaPoster(el)).toEqual(yrken(40).filter(y => y.startsWith('Yrke 1')));
        expect(traffar().textContent).toBe('10 av 40 träffar');
        expect(markera(el, 'alla').textContent).toBe('Markera träffarna');
        expect(markera(el, 'inga').textContent).toBe('Avmarkera träffarna');
        markera(el, 'inga').click();
        expect(punkter(el)).toBe(30);
        expect(summering(el).textContent).toBe('Yrkesgrupp: 30 av 40');
        expect(not(el).textContent).toContain('urval: Yrkesgrupp 30 av 40.');
        sok(el, 'finns inte');
        expect(synligaPoster(el)).toEqual([]);
        expect(traffar().textContent).toBe('0 av 40 träffar');
        expect(markera(el, 'alla').disabled).toBe(true);
        sok(el, '');
        expect(synligaPoster(el)).toHaveLength(40);
        expect(markera(el, 'alla').textContent).toBe('Markera alla');
        expect(markera(el, 'alla').disabled).toBe(false);
        // Visa alla nollställer valet (sökningen står kvar som den är).
        klicka(visaAlla(el));
        expect(punkter(el)).toBe(40);
        expect(rutor(el).every(x => x.checked)).toBe(true);
        rensa(el);
    });
    it('minnet: valet överlever rensaFigur och en ny figur; Rensa all data glömmer det', () => {
        w.eval('_rfUrvalGlom()');
        const el = behallare();
        ritaI(el, yrkesFigur());
        sok(el, 'yrke 2');
        markera(el, 'inga').click();
        rensa(el);
        ritaI(el, yrkesFigur());
        expect(summering(el).textContent).toBe('Yrkesgrupp: 30 av 40');
        expect(punkter(el)).toBe(30);
        expect(ruta(el, 'Yrke 21').checked).toBe(false);
        // En figur där alla bortvalda saknas: allt visas, och valet gäller igen när de finns.
        ritaI(el, yrkesFigur(19));
        expect(summering(el).textContent).toBe('Yrkesgrupp: alla 19');
        ritaI(el, yrkesFigur());
        expect(summering(el).textContent).toBe('Yrkesgrupp: 30 av 40');
        w.eval('_rfRensaAlla()');
        ritaI(el, yrkesFigur());
        expect(summering(el).textContent).toBe('Yrkesgrupp: alla 40');
        rensa(el);
    });
    it('öppet läge, sökningen och fokus (sökfält, kryssruta, knapp, summering) följer med när raderna byggs om', () => {
        w.eval('_rfUrvalGlom()');
        const el = behallare();
        ritaI(el, yrkesFigur());
        det(el).open = true;
        sok(el, 'yrke 3');
        sokf(el).focus();
        ritaI(el, yrkesFigur());
        expect(det(el).open).toBe(true);
        expect(sokf(el).value).toBe('yrke 3');
        expect(synligaPoster(el)).toHaveLength(10);
        expect(markera(el, 'inga').textContent).toBe('Avmarkera träffarna');
        expect(w.document.activeElement).toBe(sokf(el));
        ruta(el, 'Yrke 33').focus();
        ritaI(el, yrkesFigur());
        expect(w.document.activeElement).toBe(ruta(el, 'Yrke 33'));
        markera(el, 'inga').focus();
        ritaI(el, yrkesFigur());
        expect(w.document.activeElement).toBe(markera(el, 'inga'));
        summering(el).focus();
        ritaI(el, yrkesFigur());
        expect(w.document.activeElement).toBe(summering(el));
        // En kryssruta behåller fokus när den växlas (raderna byggs inte om).
        const r = ruta(el, 'Yrke 31');
        r.focus();
        vaxla(r);
        expect(w.document.activeElement).toBe(r);
        expect(r.checked).toBe(false);
        rensa(el);
    });
    it('kopian i Alla diagram har en egen lista: valet där ändrar inte källan, och tvärtom', () => {
        w.eval('_rfUrvalGlom()');
        const kalla = behallare('t-lista'), kopia = behallare('ut-diagram-t-lista');
        ritaI(kalla, yrkesFigur());
        w.__k = kalla; w.__kop = kopia;
        w.eval('ritaFigur(window.__kop, window.__k._figur, { ...window.__k._figurVal })');
        vaxla(ruta(kopia, 'Yrke 02'));
        expect(punkter(kopia)).toBe(39);
        expect(punkter(kalla)).toBe(40);
        expect(summering(kalla).textContent).toBe('Yrkesgrupp: alla 40');
        markera(kalla, 'inga').click();
        expect(kalla.textContent).toBe('Inga grupper i urvalet');
        expect(summering(kopia).textContent).toBe('Yrkesgrupp: 39 av 40');
        rensa(kalla); rensa(kopia);
        kalla.parentElement.remove(); kopia.parentElement.remove();
    });
    it('exporten: fotraden och diagramdatan säger urvalet; diagramTillBild ritar allt', async () => {
        w.eval('_rfUrvalGlom()');
        const el = behallare();
        ritaI(el, yrkesFigur());
        sok(el, 'yrke 1');
        markera(el, 'inga').click();
        w.__el = el;
        expect(w.eval('chartExportRows(window.__el)')[1]).toEqual(['Urval i diagrammet: Yrkesgrupp 30 av 40']);
        const org = w.figurTillBild, sedda = [];
        w.figurTillBild = (figur, format, b, h, val) => { sedda.push({ figur, val }); return Promise.resolve('data:image/png;base64,AAAA'); };
        try {
            await w.eval('chartExportRun(window.__el, "svg")');
            await w.eval('diagramTillBild(window.__el, { bredd: 1600, hojd: 900 })');
        } finally { w.figurTillBild = org; }
        expect(sedda[0].val.fot).toMatch(/ · Urval i diagrammet: Yrkesgrupp 30 av 40$/);
        expect('filter' in sedda[1].val).toBe(false);
        expect((w.figurTillSvg(sedda[1].figur, 1600, 900, sedda[1].val).match(/data-marke="punkt"/g) || []).length).toBe(40);
        rensa(el);
    });
});

// ---- Diagramfilter v3: härledda lager (harleddAv) ----
describe('härledda lager', () => {
    const medel = p => Math.round(p.reduce((s, d) => s + d.y, 0) / p.length);
    // Punkter per kön med BAS, och en "trend" per kön (medelvärdet som vågrät linje) räknad ur punkterna.
    const trend = (serie, namn) => ({ marke: 'linje', serie: `${serie} (trend)`, farg: '#111111', tips: d => [['Trend', String(d.y)]],
        data: [{ x: 20, y: 1 }, { x: 60, y: 1 }],
        harleddAv: { lager: [serie], minN: 2, ...(namn ? { namn } : {}), berakna: p => [{ x: 20, y: medel(p) }, { x: 60, y: medel(p) }] } });
    const trendFigur = (harledd = true) => {
        const f = {
            beskrivning: 'Lön mot ålder', urval: URVAL, x: { skala: 'linjar', titel: 'Ålder' }, y: { skala: 'linjar', titel: 'Lön' },
            lager: [
                { marke: 'punkt', serie: 'Kvinna', farg: '#aa0000', data: [{ x: 25, y: 30000, bas: 'A' }, { x: 35, y: 34000, bas: 'B' }, { x: 45, y: 38000, bas: 'B' }, { x: 50, y: 90000, bas: 'B', liten: true }] },
                { marke: 'punkt', serie: 'Man', farg: '#0000aa', data: [{ x: 30, y: 33000, bas: 'A' }, { x: 40, y: 36000, bas: 'B' }, { x: 55, y: 41000, bas: 'C' }] },
                trend('Kvinna', 'trendlinjen för kvinnor'), trend('Man', 'trendlinjen för män'),
            ],
        };
        if (!harledd) f.lager.forEach(l => { delete l.harleddAv; });
        return f;
    };
    const svg = el => el.querySelector(':scope > svg').outerHTML;
    const trendY = (el, li) => [...el.querySelectorAll(`:scope > svg circle[data-marke="linjepunkt"][data-l="${li}"]`)]
        .map(c => { w.__el = el; w.__c = c; return w.eval('_rfTraff(window.__el, window.__c)').d.y; });
    const linjeRitad = (el, li) => !!el.querySelector(`:scope > svg [data-l="${li}"]`);

    it('utan filter: bilden är byte för byte densamma som utan harleddAv, och lagrets egna data ritas', () => {
        w.eval('_rfUrvalGlom()');
        const a = behallare('t-harlett-a'), b = behallare('t-harlett-b');
        ritaI(a, trendFigur());
        ritaI(b, trendFigur(false));
        expect(svg(a)).toBe(svg(b));
        expect(trendY(a, 2)).toEqual([1, 1]);
        expect('_rfVisadFigur' in a || '_rfHarlett' in a).toBe(false);
        expect(w.figurTillSvg(trendFigur(), 1600, 900, {})).toBe(w.figurTillSvg(trendFigur(false), 1600, 900, {}));
        // Ett tomt filter räknas inte om.
        const tomt = { kategori: new Map([['bas', new Set()]]), intervall: new Map() };
        expect(w.figurTillSvg(trendFigur(), 1600, 900, { filter: tomt })).toBe(w.figurTillSvg(trendFigur(false), 1600, 900, {}));
        rensa(a); rensa(b);
        a.parentElement.remove(); b.parentElement.remove();
    });
    it('ett filter räknar om lagret ur de synliga punkterna (inte de små); uppslag och tips går mot den omräknade datan', () => {
        w.eval('_rfUrvalGlom()');
        const el = behallare();
        const f = trendFigur();
        ritaI(el, f);
        const fore = svg(el);
        klicka(knapp(el, 'BAS A'));
        expect(trendY(el, 2)).toEqual([36000, 36000]);                  // (34 000 + 38 000) / 2; den lilla punkten räknas inte
        expect(trendY(el, 3)).toEqual([38500, 38500]);
        expect(el._figur).toBe(f);                                       // originalet är orört
        expect(f.lager[2].data).toEqual([{ x: 20, y: 1 }, { x: 60, y: 1 }]);
        expect(not(el).textContent).toBe('Diagrammet visar ett urval: utan BAS A. Talen i texten och tabellerna gäller hela underlaget. '
            + 'Trendlinjen för kvinnor gäller urvalet. Trendlinjen för män gäller urvalet.');
        // Med visaSma räknas den lilla punkten.
        ritaI(el, f, { visaSma: true });
        expect(trendY(el, 2)).toEqual([54000, 54000]);
        ritaI(el, f);
        // Visa alla: lagrets egna data igen, samma bild som före filtret.
        klicka(visaAlla(el));
        expect(svg(el)).toBe(fore);
        expect(not(el)).toBeNull();
        rensa(el);
    });
    it('färre än minN synliga punkter: lagret ritas inte och noten säger det', () => {
        w.eval('_rfUrvalGlom()');
        const el = behallare();
        ritaI(el, trendFigur());
        klicka(knapp(el, 'BAS B'));
        // Kvinnor: bara A 30 000 synlig (den lilla räknas inte) — under minN 2. Män: A och C.
        expect(linjeRitad(el, 2)).toBe(false);
        expect(trendY(el, 3)).toEqual([37000, 37000]);
        expect(not(el).textContent).toBe('Diagrammet visar ett urval: utan BAS B. Talen i texten och tabellerna gäller hela underlaget. '
            + 'Trendlinjen för män gäller urvalet. Trendlinjen för kvinnor visas inte: färre än 2 synliga punkter.');
        // Förklaringen namnger inte ett lager som inte ritas.
        expect(el.querySelector(':scope > svg [data-serie="Kvinna (trend)"]')).toBeNull();
        klicka(knapp(el, 'BAS B'));
        expect(linjeRitad(el, 2)).toBe(true);
        rensa(el);
    });
    it('exportmenyns bild räknas om och fotraden nämner lagret som inte ritas; diagramTillBild använder originalet', async () => {
        w.eval('_rfUrvalGlom()');
        const el = behallare();
        const f = trendFigur();
        ritaI(el, f);
        klicka(knapp(el, 'BAS B'));
        w.__el = el;
        const org = w.figurTillBild, sedda = [];
        w.figurTillBild = (figur, format, b, h, val) => { sedda.push({ figur, val }); return Promise.resolve('data:image/png;base64,AAAA'); };
        try {
            await w.eval('chartExportRun(window.__el, "svg")');
            await w.eval('diagramTillBild(window.__el, { bredd: 1600, hojd: 900 })');
        } finally { w.figurTillBild = org; }
        const [meny, rapport] = sedda;
        expect(meny.figur).toBe(f);                                      // exporten får originalet och räknar själv
        expect(meny.val.fot).toMatch(/ · Urval i diagrammet: utan BAS B · Trendlinjen för kvinnor visas inte: färre än 2 synliga punkter$/);
        const menySvg = w.figurTillSvg(meny.figur, 1600, 900, meny.val);
        expect(menySvg).not.toContain('Kvinna (trend)');
        expect(rapport.figur).toBe(f);
        expect('filter' in rapport.val).toBe(false);
        expect(String(rapport.val.fot)).not.toContain('visas inte');
        // Rapportens bild är byte för byte bilden av en figur utan härledda lager.
        expect(w.figurTillSvg(rapport.figur, 1600, 900, rapport.val)).toBe(w.figurTillSvg(trendFigur(false), 1600, 900, rapport.val));
        // Diagramdatan har originalets rader.
        const rader = w.eval('chartExportRows(window.__el)');
        expect(rader.filter(r => r[0] === 'Kvinna (trend)').map(r => r[2])).toEqual([1, 1]);
        rensa(el);
    });
    it('kopian i Alla diagram (samma figur i en annan behållare) räknar om för sitt eget filter, och källan rörs inte', () => {
        w.eval('_rfUrvalGlom()');
        const kalla = behallare('t-harlett'), kopia = behallare('ut-diagram-t-harlett');
        const f = trendFigur();
        ritaI(kalla, f);
        const fore = svg(kalla);
        w.__k = kalla; w.__kop = kopia;
        w.eval('ritaFigur(window.__kop, window.__k._figur, { ...window.__k._figurVal })');
        klicka(knapp(kopia, 'BAS A'));
        expect(trendY(kopia, 2)).toEqual([36000, 36000]);
        expect(svg(kalla)).toBe(fore);
        expect(trendY(kalla, 2)).toEqual([1, 1]);
        expect(not(kalla)).toBeNull();
        // Och tvärtom: källans filter ändrar inte kopian.
        klicka(knapp(kalla, 'BAS C'));
        expect(trendY(kalla, 3)).toEqual([34500, 34500]);
        expect(trendY(kopia, 3)).toEqual([38500, 38500]);
        expect(f.lager[3].data).toEqual([{ x: 20, y: 1 }, { x: 60, y: 1 }]);
        rensa(kalla); rensa(kopia);
        kalla.parentElement.remove(); kopia.parentElement.remove();
    });
    it('rensaFigur tar bort de härledda egenskaperna', () => {
        w.eval('_rfUrvalGlom()');
        const el = behallare();
        ritaI(el, trendFigur());
        klicka(knapp(el, 'BAS A'));
        expect('_rfVisadFigur' in el && '_rfHarlett' in el && '_rfRitadVisad' in el).toBe(true);
        rensa(el);
        expect(['_rfVisadFigur', '_rfHarlett', '_rfRitadVisad'].some(k => k in el)).toBe(false);
    });
});

// ---- Diagramfilter v3: underlaget (figur.underlag) — diagrammet räknat för en del av personerna ----
describe('underlag: Räkna för', () => {
    // Personer i fyra sektorer. Stor, Mellan och Bara kv går att välja vid k = 5; Liten (2 kvinnor, 5 män) gör det
    // inte och hamnar därför alltid i resten. Åldersgruppen är Udda eller Jämn efter lönen.
    const personer = (sektor, kv, ma, lon) => [...Array.from({ length: kv }, (_, i) => ({ sektor, kon: 'kvinna', lon: lon + i })),
                                               ...Array.from({ length: ma }, (_, i) => ({ sektor, kon: 'man', lon: lon + 500 + i }))];
    const RADER = [...personer('Stor', 20, 20, 30000), ...personer('Mellan', 6, 6, 40000), ...personer('Bara kv', 6, 0, 50000), ...personer('Liten', 2, 5, 60000)];
    const SEKTOR = { typ: 'kategori', falt: 'sektor', namn: 'Sektor' };
    const ALDER = { typ: 'kategori', falt: 'aldersgrupp', namn: 'Åldersgrupp', varde: r => (r.lon % 2 ? 'Udda' : 'Jämn') };
    // Figuren: antalet kvinnor och män som staplar, räknad ur raderna (vyns "beräkning"). rita räknar anropen.
    let anrop = [];
    const figurFor = (rader, text = 'hela') => ({ beskrivning: `Antal per kön, ${text}`, x: { skala: 'band', ordning: ['Kvinna', 'Man'] }, y: { skala: 'linjar', titel: 'Antal' },
        lager: [{ marke: 'stapel', serie: 'Antal', farg: '#2563eb', data: [['Kvinna', 'kvinna'], ['Man', 'man']]
            .map(([x, k]) => ({ x, y: rader.filter(r => r.kon === k).length })).filter(d => d.y > 0) }] });
    const underlagFigur = (over = {}) => ({ ...figurFor(RADER), underlag: { dimensioner: [SEKTOR, ALDER], rader: RADER, k: 5,
        rita: (rader, { beskrivning }) => { anrop.push({ n: rader.length, beskrivning }); return figurFor(rader, beskrivning); }, ...over } });
    const urad = (el, falt = 'sektor') => el.parentElement.querySelector(`.diagram-urval[data-underlag="${falt}"]`);
    const uknapp = (el, v, falt = 'sektor') => [...urad(el, falt).querySelectorAll('[data-urval]')].find(b => b.getAttribute('data-urval') === v);
    const staplar = el => [...el.querySelectorAll(':scope > svg rect[data-marke="stapel"]')].length;
    const etiketter = el => xEt(el);
    const raknaAlla = el => el.parentElement.querySelector('[data-underlag-alla]');

    it('raden Räkna för står först, med en knapp per valbart värde; ett värde med för få kvinnor eller män går inte att välja', () => {
        w.eval('_rfUrvalGlom()');
        anrop = [];
        const el = behallare();
        ritaI(el, underlagFigur());
        const r = urad(el);
        expect(r).not.toBeNull();
        expect(r.getAttribute('role')).toBe('group');
        expect(r.getAttribute('aria-label')).toBe('Räkna för sektor');
        expect(r.getAttribute('data-urval-falt')).toBe('underlag:sektor');
        expect(r.querySelector('.diagram-urval-namn').textContent).toBe('Räkna för sektor');
        expect([...r.querySelectorAll('[data-urval]')].map(b => b.textContent)).toEqual(['Bara kv', 'Mellan', 'Stor']);
        expect([...r.querySelectorAll('[data-urval]')].every(b => b.getAttribute('aria-pressed') === 'true')).toBe(true);
        expect(r.querySelector('[data-underlag-utelamnade]').textContent).toBe('1 till går inte att välja för sig: färre än 5 kvinnor eller män');
        expect(r.textContent).not.toContain('Liten');
        // Raderna i ordning: sektorn, åldersgruppen, sedan behållaren; Räkna för alla sist i den sista underlagsraden, dold.
        expect(el.previousElementSibling).toBe(urad(el, 'aldersgrupp'));
        expect(urad(el, 'aldersgrupp').previousElementSibling).toBe(r);
        expect(raknaAlla(el).hidden).toBe(true);
        expect(urad(el, 'aldersgrupp').lastElementChild).toBe(raknaAlla(el));
        expect(anrop).toEqual([]);   // utan val ritas vyns egen figur
        expect(not(el)).toBeNull();
        rensa(el);
        expect(urad(el)).toBeNull();
    });
    it('ett val räknar om diagrammet med vyns rita för de valda personerna, och noten säger vad det är räknat för', () => {
        w.eval('_rfUrvalGlom()');
        anrop = [];
        const el = behallare();
        ritaI(el, underlagFigur());
        klicka(uknapp(el, 'Bara kv'));
        klicka(uknapp(el, 'Mellan'));   // bara Stor: urvalet 20/20, resten 14 kvinnor och 11 män
        expect(anrop.at(-1)).toEqual({ n: 40, beskrivning: 'sektor Stor' });
        expect(el._rfUnderlagFigur.beskrivning).toBe('Antal per kön, sektor Stor');
        expect(el.querySelector(':scope > svg').getAttribute('aria-label')).toBe('Antal per kön, sektor Stor');
        expect(not(el).textContent).toBe('Diagrammet är räknat för: sektor Stor (40 personer). Talen i texten och tabellerna gäller hela underlaget.');
        expect(raknaAlla(el).hidden).toBe(false);
        expect(uknapp(el, 'Stor').getAttribute('aria-pressed')).toBe('true');
        expect(uknapp(el, 'Stor').getAttribute('aria-disabled')).toBe('true');   // den sista valda knappen
        // Originalet är orört; uppslagen går mot den ritade figuren.
        expect(el._figur.lager[0].data.map(d => d.y)).toEqual([34, 31]);
        w.__el = el;
        expect(w.eval('_rfVisad(window.__el).lager[0].data.map(d => d.y)')).toEqual([20, 20]);
        // Räkna för alla: hela underlaget igen, noten borta och minnet glömt.
        klicka(raknaAlla(el));
        expect(el._rfUnderlagFigur).toBeUndefined();
        expect(not(el)).toBeNull();
        expect(raknaAlla(el).hidden).toBe(true);
        ritaI(el, underlagFigur());
        expect(el._rfUnderlagText).toBeUndefined();
        rensa(el);
    });
    it('skyddsregeln: ett val där resten får för få kvinnor eller män görs inte, valet markeras och noten säger varför', () => {
        w.eval('_rfUrvalGlom()');
        anrop = [];
        const el = behallare();
        // Liten har 2 kvinnor och 3 män; med Bara kv (6 kvinnor, inga män) i resten blir resten 8 kvinnor och 3 män.
        const rader = [...personer('Stor', 20, 20, 30000), ...personer('Bara kv', 6, 0, 50000), ...personer('Liten', 2, 3, 60000)];
        ritaI(el, underlagFigur({ rader }));
        const fore = el.innerHTML;
        klicka(uknapp(el, 'Bara kv'));
        expect(anrop).toEqual([]);
        expect(el.innerHTML).toBe(fore);
        expect(el._rfUnderlagText).toBeUndefined();
        expect(uknapp(el, 'Bara kv').getAttribute('aria-pressed')).toBe('true');
        expect(uknapp(el, 'Bara kv').getAttribute('aria-invalid')).toBe('true');
        expect(not(el).textContent).toBe('Urvalet eller resten har färre än 5 kvinnor eller män. Valet är inte gjort, och diagrammet är oförändrat.');
        // Precis över regeln: med 5 män i Liten godtas samma val.
        const over = [...personer('Stor', 20, 20, 30000), ...personer('Bara kv', 6, 0, 50000), ...personer('Liten', 2, 5, 60000)];
        ritaI(el, underlagFigur({ rader: over }));
        klicka(uknapp(el, 'Bara kv'));
        expect(anrop.at(-1)).toEqual({ n: 40, beskrivning: 'sektor Stor' });
        expect(uknapp(el, 'Bara kv').hasAttribute('aria-invalid')).toBe(false);
        expect(not(el).textContent).toMatch(/^Diagrammet är räknat för: sektor Stor \(40 personer\)\./);
        rensa(el);
    });
    it('en dimension i taget: ett val i åldersgruppen tar bort valet i sektorn, och noten säger det', () => {
        w.eval('_rfUrvalGlom()');
        anrop = [];
        const el = behallare();
        ritaI(el, underlagFigur());
        klicka(uknapp(el, 'Bara kv'));
        expect(el._rfUnderlagText).toMatch(/^sektor Mellan, Stor/);
        klicka(uknapp(el, 'Udda', 'aldersgrupp'));
        expect(el._rfUnderlagText).toMatch(/^åldersgrupp Jämn \(\d+ personer\)$/);
        expect(uknapp(el, 'Bara kv').getAttribute('aria-pressed')).toBe('true');
        expect(not(el).textContent).toContain('Valet för sektor togs bort: diagrammet räknas för en sak i taget.');
        // Minnet har bara åldersgruppen.
        ritaI(el, underlagFigur());
        expect(el._rfUnderlagText).toMatch(/^åldersgrupp Jämn/);
        expect(not(el).textContent).not.toContain('togs bort');
        rensa(el);
    });
    it('minnet: valet överlever rensaFigur och en ny figur; ett minne som inte klarar regeln längre gäller inte; _rfUrvalGlom glömmer', () => {
        w.eval('_rfUrvalGlom()');
        const el = behallare();
        ritaI(el, underlagFigur());
        klicka(uknapp(el, 'Bara kv'));
        rensa(el);
        ritaI(el, underlagFigur());
        expect(el._rfUnderlagText).toBe('sektor Mellan, Stor (52 personer)');
        expect(uknapp(el, 'Bara kv').getAttribute('aria-pressed')).toBe('false');
        // Ny fil: Liten har nu 3 män och Bara kv har inga — samma val ger en rest med för få män.
        const rader = [...personer('Stor', 20, 20, 30000), ...personer('Mellan', 6, 6, 40000), ...personer('Bara kv', 6, 0, 50000), ...personer('Liten', 0, 3, 60000)];
        ritaI(el, underlagFigur({ rader }));
        expect(el._rfUnderlagText).toBeUndefined();
        expect(not(el).textContent).toBe('Urvalet eller resten har färre än 5 kvinnor eller män. Det tidigare valet för sektor gäller inte, och diagrammet visar hela underlaget.');
        ritaI(el, underlagFigur());
        expect(el._rfUnderlagText).toBe('sektor Mellan, Stor (52 personer)');   // minnet står kvar för när valet går igen
        w.eval('_rfUrvalGlom()');
        ritaI(el, underlagFigur());
        expect(el._rfUnderlagText).toBeUndefined();
        rensa(el);
    });
    it('rita som ger en text: texten står i diagrammet, raderna och noten står kvar, och exportmenyn har inget att exportera', async () => {
        w.eval('_rfUrvalGlom()');
        const el = behallare();
        ritaI(el, underlagFigur({ rita: () => 'Ett kön har färre än 5 personer i urvalet.' }));
        klicka(uknapp(el, 'Stor'));
        expect(el.textContent).toBe('Ett kön har färre än 5 personer i urvalet.');
        expect(el.querySelector('[data-rf="tom"]')).not.toBeNull();
        expect(urad(el)).not.toBeNull();
        expect(not(el).textContent).toMatch(/^Diagrammet är räknat för: sektor Bara kv, Mellan \(18 personer\)/);
        w.__el = el;
        await expect(w.eval('chartExportRun(window.__el, "svg")')).rejects.toThrow(/inget att exportera/);
        expect(w.eval('chartExportRows(window.__el)')).toEqual([]);
        // Rapportens bild (hela underlaget) går fortfarande.
        expect(w.eval('diagramRitat(window.__el)')).toBe(true);
        rensa(el);
    });
    it('exporten: exportmenyns bild och diagramdata följer underlaget och säger det; diagramTillBild ritar hela underlaget', async () => {
        w.eval('_rfUrvalGlom()');
        const el = behallare();
        const f = underlagFigur();
        ritaI(el, f, { exportAnteckning: 'Andel kvinnor 52 %' });
        w.__el = el;
        const hel = w.eval('chartExportRows(window.__el)');
        klicka(uknapp(el, 'Bara kv'));
        klicka(uknapp(el, 'Mellan'));
        const rader = w.eval('chartExportRows(window.__el)');
        expect(rader[1]).toEqual(['Räknat för: sektor Stor (40 personer)']);
        expect(rader.slice(2).filter(r => r[0] === 'Antal').map(r => r[2])).toEqual([20, 20]);
        expect(hel.slice(1).filter(r => r[0] === 'Antal').map(r => r[2])).toEqual([34, 31]);
        const org = w.figurTillBild, sedda = [];
        w.figurTillBild = (figur, format, b, h, val) => { sedda.push({ figur, val }); return Promise.resolve('data:image/png;base64,AAAA'); };
        try {
            await w.eval('chartExportRun(window.__el, "svg")');
            await w.eval('diagramTillBild(window.__el, { bredd: 1600, hojd: 900 })');
        } finally { w.figurTillBild = org; }
        const [meny, rapport] = sedda;
        expect(meny.figur).toBe(el._rfUnderlagFigur);
        expect(meny.val.fot).toMatch(/^Lönekartläggning \d{4}-\d{2}-\d{2} · Räknat för: sektor Stor \(40 personer\)$/);   // utan vyns anteckning
        expect(rapport.figur).toBe(f);
        expect(rapport.val.fot).toMatch(/^Andel kvinnor 52 % · Lönekartläggning \d{4}-\d{2}-\d{2}$/);
        expect(w.figurTillSvg(rapport.figur, 1600, 900, rapport.val)).toBe(w.figurTillSvg(figurFor(RADER), 1600, 900, rapport.val));
        rensa(el);
    });
    it('kopian i Alla diagram har sitt eget underlag: valet där ändrar inte källan, och tvärtom', () => {
        w.eval('_rfUrvalGlom()');
        const kalla = behallare('t-underlag'), kopia = behallare('ut-diagram-t-underlag');
        ritaI(kalla, underlagFigur());
        w.__k = kalla; w.__kop = kopia;
        w.eval('ritaFigur(window.__kop, window.__k._figur, { ...window.__k._figurVal })');
        klicka(uknapp(kopia, 'Bara kv'));
        expect(kopia._rfUnderlagText).toBe('sektor Mellan, Stor (52 personer)');
        expect(kalla._rfUnderlagText).toBeUndefined();
        expect(etiketter(kalla)).toEqual(['Kvinna', 'Man']);
        klicka(uknapp(kalla, 'Stor'));
        expect(kalla._rfUnderlagText).toBe('sektor Bara kv, Mellan (18 personer)');
        expect(kopia._rfUnderlagText).toBe('sektor Mellan, Stor (52 personer)');
        rensa(kalla); rensa(kopia);
        kalla.parentElement.remove(); kopia.parentElement.remove();
    });
    it('en lista: kryssrutorna, Avmarkera alla (inga personer) och summeringen', () => {
        w.eval('_rfUrvalGlom()');
        const el = behallare();
        ritaI(el, underlagFigur({ dimensioner: [{ ...SEKTOR, visning: 'lista' }] }));
        const r = urad(el);
        expect(r.querySelector('[data-urval-summering]').textContent).toBe('Räkna för sektor: alla 3');
        const ruta = r.querySelector('input[data-urval="Mellan"]');
        ruta.checked = false; ruta.dispatchEvent(new w.Event('change', { bubbles: true }));
        expect(r.querySelector('[data-urval-summering]').textContent).toBe('Räkna för sektor: 2 av 3');
        expect(el._rfUnderlagText).toBe('sektor Bara kv, Stor (46 personer)');
        r.querySelector('[data-urval-markera="inga"]').click();
        expect(el.textContent).toBe('Inga personer i urvalet');
        expect(not(el).textContent).toMatch(/^Diagrammet är räknat för: sektor: inga \(0 personer\)/);
        expect(staplar(el)).toBe(0);
        rensa(el);
    });
    it('rensaFigur tar bort underlagets egenskaper; minnet står kvar', () => {
        w.eval('_rfUrvalGlom()');
        const el = behallare();
        ritaI(el, underlagFigur());
        klicka(uknapp(el, 'Bara kv'));
        expect(['_rfUnderlagFigur', '_rfUnderlagText', '_rfUnderlagFilter', '_rfUnderlagDim'].every(k => k in el)).toBe(true);
        rensa(el);
        expect(Object.keys(el).some(k => k.startsWith('_rfUnderlag'))).toBe(false);
        ritaI(el, underlagFigur());
        expect(el._rfUnderlagText).toBe('sektor Mellan, Stor (52 personer)');
        rensa(el);
    });
});

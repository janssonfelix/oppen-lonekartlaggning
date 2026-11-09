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

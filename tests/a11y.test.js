/**
 * Tillgänglighets-röktest (axe-core i jsdom).
 *
 * Bootar index.html + app.js i jsdom (samma stubbar som smoke.test.js), laddar
 * demodata, renderar varje flik och kör axe-core mot DOM:en. Detta automatiserar
 * den strukturella WCAG-granskningen (etiketter, roller, ARIA-giltighet, namn på
 * knappar/länkar, dubbletter av id, tabellrelationer) i CI.
 *
 * BEGRÄNSNING: jsdom saknar layout-motor, så geometriberoende regler — främst
 * `color-contrast` — kan inte utvärderas här och är avstängda. Färgkontrast och
 * fokus-synlighet verifieras i stället manuellt i riktig webbläsare (axe-körning
 * i preview, KVALDOK §8). Detta test fångar den maskinellt verifierbara delen och
 * larmar vid regressioner i markup-tillgänglighet.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createRequire } from 'node:module';
import { JSDOM } from 'jsdom';

const require = createRequire(import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const html = readFileSync(join(root, 'src', 'index.html'), 'utf8');
const appSrc = readFileSync(join(root, 'dist', 'app.js'), 'utf8').replace(/^﻿/, '');
const axeSrc = readFileSync(require.resolve('axe-core'), 'utf8');

let win, axeResults;

// Regler som kräver layout/geometri och därför inte är meningsfulla i jsdom.
const DISABLED_RULES = {
    'color-contrast': { enabled: false },
    'color-contrast-enhanced': { enabled: false }
};

beforeAll(async () => {
    const dom = new JSDOM(html, { runScripts: 'outside-only', pretendToBeVisual: true, url: 'http://localhost/' });
    win = dom.window;
    const noop = () => {};
    win.alert = noop; win.confirm = () => true; win.print = noop; win.scrollTo = noop;
    if (!win.requestAnimationFrame) win.requestAnimationFrame = cb => setTimeout(cb, 0);
    if (!win.matchMedia) win.matchMedia = () => ({ matches: false, media: '', addEventListener: noop, removeEventListener: noop, addListener: noop, removeListener: noop, dispatchEvent: () => false });
    win.URL.createObjectURL = () => 'blob:stub';
    win.URL.revokeObjectURL = noop;
    win.Papa = { parse: () => ({ data: [], meta: { fields: [] }, errors: [] }), unparse: () => '' };
    win.XLSX = {
        utils: {
            book_new: () => ({ SheetNames: [], Sheets: {} }), aoa_to_sheet: () => ({ '!ref': 'A1' }),
            json_to_sheet: () => ({ '!ref': 'A1' }), sheet_to_json: () => [],
            book_append_sheet: (wb, ws, name) => { wb.SheetNames.push(name); wb.Sheets[name] = ws; },
            decode_range: () => ({ s: { r: 0, c: 0 }, e: { r: 0, c: 0 } }), encode_cell: () => 'A1', encode_range: () => 'A1'
        },
        writeFile: noop, write: () => new Uint8Array()
    };
    win.JSZip = function JSZip() { return { file: noop, folder: () => ({ file: noop }), generateAsync: () => Promise.resolve(new Uint8Array()) }; };

    const shim = `
;try {
    Object.assign(window, {
        __loadDemoData: loadDemoData,
        __renderTabContent: renderTabContent,
        __navTabs: [...document.querySelectorAll('.nav-item')].map(b => b.getAttribute('data-tab'))
    });
} catch (e) { window.__bootErr = e; }`;
    win.eval(appSrc + shim);
    win.eval(axeSrc);   // exponerar window.axe

    // Boot-splashen tas bort av appen efter init (00-sakerhet-och-uppstart.js,
    // splash.remove()); dess setTimeout hinner inte alltid köra i jsdom, så vi
    // speglar det stabila körläget och tar bort den innan granskningen.
    win.document.getElementById('boot-splash')?.remove();

    // Demodata + rendera alla flikar så panelernas innehåll finns i DOM:en.
    win.__loadDemoData();
    (win.__navTabs || []).forEach(t => { if (t) { try { win.__renderTabContent(t); } catch (_e) { /* ignoreras */ } } });

    // Utforskas urvalspanel med villkor av alla slag och en öppen värdelista.
    const d = win.document;
    const change = (sel, v) => { const el = d.querySelector(sel); el.value = v; el.dispatchEvent(new win.Event('change', { bubbles: true })); };
    d.querySelector('[data-urval-lagg-till="person"]').click();
    d.querySelector('[data-urval-lagg-till="person"]').click();
    change('[data-urval-falt="1"]', 'lon');
    change('[data-urval-op="1"]', 'inteMellan');
    d.querySelector('[data-urval-lagg-till="grupp"]').click();
    d.querySelector('#explore-urval-villkor .explore-urval-val').open = true;
    const radAntal = d.querySelectorAll('#explore-urval .explore-urval-rad').length;
    if (radAntal !== 3) throw new Error(`urvalspanelen fick ${radAntal} rader, väntade 3`);

    axeResults = await win.axe.run(win.document, {
        rules: DISABLED_RULES,
        resultTypes: ['violations']
    });
}, 60000);

describe('a11y: axe-core strukturell granskning (jsdom)', () => {
    it('appen bootade och axe kördes', () => {
        expect(win.__bootErr).toBeUndefined();
        expect(axeResults).toBeTruthy();
        expect(Array.isArray(axeResults.violations)).toBe(true);
    });

    it('inga allvarliga (serious/critical) WCAG-överträdelser i markup', () => {
        const serious = axeResults.violations.filter(v => v.impact === 'serious' || v.impact === 'critical');
        if (serious.length) {
            const report = serious.map(v =>
                `  [${v.impact}] ${v.id}: ${v.help} (${v.nodes.length} st)\n` +
                v.nodes.slice(0, 4).map(n => `      ${n.target.join(' ')} — ${n.html.slice(0, 120)}`).join('\n')
            ).join('\n');
            throw new Error(`axe hittade ${serious.length} allvarliga regelöverträdelser:\n${report}`);
        }
        expect(serious.length).toBe(0);
    });

    it('inga moderate WCAG-överträdelser i markup', () => {
        const moderate = axeResults.violations.filter(v => v.impact === 'moderate');
        if (moderate.length) {
            const report = moderate.map(v => `  [moderate] ${v.id}: ${v.help} (${v.nodes.length} st)\n` + v.nodes.slice(0, 4).map(n => `      ${n.target.join(' ')} — ${n.html.slice(0, 120)}`).join('\n')).join('\n');
            throw new Error(`axe hittade ${moderate.length} moderata regelöverträdelser:\n${report}`);
        }
        expect(moderate.length).toBe(0);
    });
});

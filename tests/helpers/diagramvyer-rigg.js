// Gemensam rigg för vyerna som ritas med diagramkärnan (tests/diagramvyer*.test.js, ADR-39).
import { readFileSync, readdirSync } from 'node:fs';
import { createAppWindow } from './app-harness.js';

// talformat skriver hårda mellanslag i belopp; jämför med vanliga.
export const vanliga = rader => rader.map(r => r.map(c => String(c).replace(/[\u00a0\u202f]/g, ' ')));

export const KALLA = readdirSync('src/app').filter(f => /^\d\d-.*\.js$/.test(f)).map(f => [f, readFileSync(`src/app/${f}`, 'utf8')]);
export const figurMedLiten = () => ({ beskrivning: 'B', x: { skala: 'band' }, y: { skala: 'linjar' },
    lager: [{ marke: 'stapel', serie: 'S', farg: '#2563eb', data: [{ x: 'A', y: 30000 }, { x: 'HEMLIG', y: 77777, liten: true }] }] });
export const person = (bas, kon, lon, extra = {}) => ({ bas, kon, lon, alder: 40, yrke: '5301 Test', aid: '5301', yrkeLabel: 'Test', enhet: '', ...extra });

// Ett fönster med de hjälpfunktioner som är bundna till det: varje testfil skapar sitt eget.
export function skapaRigg() {
    const w = createAppWindow();
    const behallare = id => {
        let el = w.document.getElementById(id);
        if (!el) { el = w.document.createElement('div'); el.id = id; w.document.body.appendChild(el); }
        return el;
    };
    // Utdata som kan lämna verktyget ur ett kärnritat diagram: skärmens SVG, exportbildens SVG och diagramdatan.
    const utdata = el => {
        w.__kel = el;
        return [el.outerHTML,
            w.eval('(() => { const u = _rfExportFigur(window.__kel); return u && !u.tom ? figurTillSvg(u.figur, 1600, 900, { visaSma: u.visaSma, dolda: u.dolda }) : ""; })()'),
            JSON.stringify(w.eval('chartExportRows(window.__kel)'))].join(' ');
    };
    const medData = (data, policy, fn) => {
        const s = { data: w.__state.data, policy: w.__state.policy };
        try { w.__state.data = data; w.__state.policy = policy; return fn(); }
        finally { w.__state.data = s.data; w.__state.policy = s.policy; w.eval('sattKTroskel(10, { fraga: false })'); }
    };
    return { w, behallare, utdata, medData };
}

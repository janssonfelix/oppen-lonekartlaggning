// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
/**
 * Statusfärgerna står på ETT ställe: FARG i src/app/01-farger.js, speglad som --status-* i stilmallens :root.
 * Hexkoderna står inte utskrivna i vyernas mallar eller i stilmallen, så att en status får samma färg i alla flikar.
 * De här testerna håller koderna borta från resten.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname, '..');
const läs = f => readFileSync(join(ROOT, f), 'utf8');
const FARG = Object.fromEntries([...läs('src/app/01-farger.js').matchAll(/(\w+): '(#[0-9a-f]{6})'/g)].map(m => [m[1], m[2]]));
const KODER = new RegExp(Object.values(FARG).join('|'), 'gi');
const utanKommentarer = js => js.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\s\/\/ .*$/gm, '');

// Tabellens namn → stilmallens variabel, där namnet inte följer mönstret --status-<namn>.
const CSSNAMN = { vit: '--vit', text: '--text-main', dampad: '--text-muted', kant: '--border', svag: '--text-svag', blek: '--text-blek', kantStark: '--border-stark',
    yta: '--yta', ytaStark: '--yta-stark', accent: '--accent', accentMork: '--accent-mork', accentYta: '--accent-yta', accentKant: '--accent-kant' };
const cssNamn = k => CSSNAMN[k] || '--status-' + k.replace(/[A-Z]/g, b => '-' + b.toLowerCase());
const lum = hex => { const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(v => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const kontrast = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
const cssRot = () => { const css = läs('src/style.css'), a = css.indexOf(':root {'), b = css.indexOf('}', a); return { rot: css.slice(a, b), rest: css.slice(0, a) + css.slice(b) }; };

describe('gränssnittets färger har en källa', () => {
    it('tabellen har statusarna (text, botten, yta, kant), de neutrala och den blå accenten', () => {
        expect(Object.keys(FARG).sort()).toEqual(['accent', 'accentKant', 'accentMork', 'accentYta', 'blek', 'dampad', 'granska', 'granskaBg', 'granskaKant', 'granskaLjus',
            'info', 'infoBg', 'infoMork', 'infoYta', 'kant', 'kantStark', 'kritisk', 'kritiskBg', 'kritiskKant', 'kritiskYta', 'ok', 'okBg', 'okKant', 'okYta', 'svag', 'text',
            'varning', 'varningBg', 'varningKant', 'varningYta', 'vit', 'yta', 'ytaStark']);
    });
    it('statustexten har minst 4,5:1 mot vitt, mot sin botten och mot sin yta (info: den mörka nyansen), och den neutrala texten mot ytorna', () => {
        for (const [text, ...ytor] of [['kritisk', 'kritiskBg', 'kritiskYta'], ['varning', 'varningBg', 'varningYta'], ['ok', 'okBg', 'okYta'], ['granska', 'granskaBg'], ['infoMork', 'infoBg', 'infoYta'],
            ['text', 'yta', 'ytaStark'], ['dampad', 'yta', 'ytaStark'], ['accentMork', 'accentYta']]) {
            for (const yta of ['#ffffff', ...ytor.map(y => FARG[y])]) expect(kontrast(FARG[text], yta), `${text} mot ${yta}`).toBeGreaterThanOrEqual(4.5);
        }
    });
    it('ingen annan del av appen skriver ut en av tabellens färger som hexkod (paletten i 10-diagramtema.js har diagrammens egna)', () => {
        const fynd = [];
        for (const f of readdirSync(join(ROOT, 'src/app')).filter(f => f.endsWith('.js') && !['01-farger.js', '09-lib-speglar.js'].includes(f))) {
            utanKommentarer(läs(`src/app/${f}`)).split('\n').forEach(rad => { if (KODER.test(rad)) fynd.push(`${f}: ${rad.trim().slice(0, 90)}`); KODER.lastIndex = 0; });
        }
        expect(fynd).toEqual([]);
    });
    it('stilmallens variabler har samma värden som tabellen', () => {
        const { rot } = cssRot();
        for (const [k, v] of Object.entries(FARG)) expect(rot, cssNamn(k)).toMatch(new RegExp(`${cssNamn(k)}:\\s*${v};`, 'i'));
    });
    it('utanför :root står tabellens färger bara som variabler (hexkoden får stå som reservvärde i var())', () => {
        const rest = cssRot().rest.replace(/\/\*[\s\S]*?\*\//g, '').replace(/var\(\s*--[\w-]+\s*,\s*#[0-9a-f]{6}\s*\)/gi, '');
        expect(rest.match(KODER) || []).toEqual([]);
    });
    it('sidans skal: bara tabellhuvud som kopieras till urklipp bär en av tabellens färger som hexkod', () => {
        const rader = läs('src/index.html').replace(/var\(\s*--[\w-]+\s*,\s*#[0-9a-f]{6}\s*\)/gi, '').split('\n').filter(r => { const t = KODER.test(r); KODER.lastIndex = 0; return t; });
        for (const r of rader) expect(r, r.trim().slice(0, 80)).toMatch(/<th [^>]*data-export-label/);
    });
    it('nära dubbletter av tabellens färger står inte i vyerna, sidan eller stilmallen (ADR-43)', () => {
        const NARA_DUBBLETTER = /#(991b1b|7f1d1d|8f1616|fde8e8|92400e|9a3412|7c2d12|78350f|7a4a04|fdf0d8|fef9c3|fff7d6|fff7ed|047857|065f46|0a544e|166534|064e3b|d1fae5|dcfce7|dff3ef|4f46e5|3730a3|e0e7ff|0c4a6e|fefefe|1e293b|0f172a|334155|374151|e2e8f0|cfd5df|fafbfc|f6f7f9|eef2f6|eef2f7|3b82f6|1e40af|1e3a5f|fca5a5|f87171|fbbf24|fef08a|fdba74|bbf7d0|34d399|a9b9ff|fffbf9)\b/gi;
        const fynd = [];
        for (const f of [...readdirSync(join(ROOT, 'src/app')).filter(f => f.endsWith('.js') && f !== '09-lib-speglar.js').map(f => `src/app/${f}`), 'src/style.css', 'src/index.html']) {
            const text = f.endsWith('.css') ? läs(f).replace(/var\(\s*--[\w-]+\s*,\s*#[0-9a-f]{6}\s*\)/gi, '') : läs(f);
            const n = (text.match(NARA_DUBBLETTER) || []).length; if (n) fynd.push(`${f}: ${n}`);
        }
        expect(fynd).toEqual([]);
    });
});

describe('hjälpklasserna', () => {
    const klasser = text => [...new Set([...text.matchAll(/\.([a-z][a-z0-9-]*)\s*\{/g)].map(m => m[1]))].sort();
    it('utskriftsfönstret har samma hjälpklasser som stilmallen', () => {
        const css = läs('src/style.css'), block = css.slice(css.indexOf('/* ---- Hjälpklasser ----'));
        const js = läs('src/app/60-utskrift.js'), konst = js.slice(js.indexOf('const HJALPKLASSER_CSS'), js.indexOf('\n\n', js.indexOf('const HJALPKLASSER_CSS')));
        expect(klasser(block).length).toBeGreaterThanOrEqual(20);
        expect(klasser(konst)).toEqual(klasser(block));
    });
    it('biblioteket som ersatte style-attributen har namn, inte hashar, och stilmallen har en regel för varje klass mallarna använder ur det', () => {
        const css = läs('src/style.css');
        const block = css.slice(css.indexOf('/* ==== Hjälpklasser som ersätter style-attributen'), css.indexOf('/* Telefonbredd:'));
        const bibliotek = new Set([...block.matchAll(/^\.([a-z][a-z0-9_-]*)\.\1\.\1 \{/gm)].map(m => m[1]));
        expect(bibliotek.size).toBeGreaterThan(100);
        expect([...bibliotek].filter(k => /^u-[0-9a-z]{4}$/.test(k))).toEqual([]);
        for (const f of [...readdirSync(join(ROOT, 'src/app')).filter(f => f.endsWith('.js')).map(f => `src/app/${f}`), 'src/index.html'])
            expect(läs(f).match(/\bu-[0-9a-z]{4}\b/g) || [], f).toEqual([]);
    });
    it('utskriftsfönstret får biblioteket ur den körande stilmallen och lägger in det som byggt stilark (inte som <style>, som CSP:n blockerar)', () => {
        const js = läs('src/app/60-utskrift.js');
        expect(js).toContain('adoptedStyleSheets');
        expect(js).toMatch(/bibliotekCssForUtskrift\(\)/);
        expect(js).toContain("'.dold.dold.dold'");
    });
    it('högerjusteringen står sällan direkt på elementen i flikarnas mallar', () => {
        const EXPORT = /^(22|23|24|27|58|59|60|62|64|66|67)-/;   // exporternas mallar bär stilen i markeringen: den ska följa med till Word och urklipp
        let n = 0;
        for (const f of readdirSync(join(ROOT, 'src/app')).filter(f => f.endsWith('.js') && !EXPORT.test(f) && f !== '09-lib-speglar.js')) n += (läs(`src/app/${f}`).match(/style="text-align:\s*right;?"/g) || []).length;
        expect(n).toBeLessThanOrEqual(8);   // de som står direkt på elementen sitter i taggar med uttryck, där en hjälpklass inte går att sätta säkert
    });
});

describe('könsfärgerna', () => {
    const tema = läs('src/app/10-diagramtema.js');
    const [, kvinna, man] = /kon: \{ kvinna: '(#[0-9a-f]{6})', man: '(#[0-9a-f]{6})' \}/.exec(tema);
    const serie = [...tema.slice(tema.indexOf('serie: ['), tema.indexOf('],', tema.indexOf('serie: ['))).matchAll(/'(#[0-9a-f]{6})'/g)].map(m => m[1]);
    // Avstånd i CIE Lab (ΔE76) efter simulerad färgblindhet (Machado m.fl. 2009, full grad).
    const lin = v => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
    const gam = v => { const c = Math.min(1, Math.max(0, v)); return c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055; };
    const rgb = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255);
    const M = { protan: [[0.152286, 1.052583, -0.204868], [0.114503, 0.786281, 0.099216], [-0.003882, -0.048116, 1.051998]],
                deutan: [[0.367322, 0.860646, -0.227968], [0.280085, 0.672501, 0.047413], [-0.011820, 0.042940, 0.968881]] };
    const sim = (hex, t) => { const l = rgb(hex).map(lin); return t ? M[t].map(r => gam(r[0] * l[0] + r[1] * l[1] + r[2] * l[2])) : rgb(hex); };
    const lab = c => { const [r, g, b] = c.map(lin); const f = v => (v > 0.008856 ? Math.cbrt(v) : 7.787 * v + 16 / 116);
        const X = f((0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047), Y = f(0.2126 * r + 0.7152 * g + 0.0722 * b), Z = f((0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883);
        return [116 * Y - 16, 500 * (X - Y), 200 * (Y - Z)]; };
    const dE = (a, b, t) => Math.hypot(...lab(sim(a, t)).map((v, i) => v - lab(sim(b, t))[i]));

    it('båda har minst 4,5:1 mot vitt (de bär text i legender och etiketter)', () => {
        expect(kontrast(kvinna, '#ffffff')).toBeGreaterThanOrEqual(4.5);
        expect(kontrast(man, '#ffffff')).toBeGreaterThanOrEqual(4.5);
    });
    it('skiljer sig minst lika mycket som det tidigare paret (rosa #c8457f, blå #2a78d6) vid protanopi och deuteranopi', () => {
        for (const t of ['protan', 'deutan']) expect(dE(kvinna, man, t), t).toBeGreaterThanOrEqual(dE('#c8457f', '#2a78d6', t));
    });
    it('ligger ifrån statusfärgerna och seriefärgerna (ΔE minst 20)', () => {
        for (const k of [kvinna, man]) {
            for (const s of [FARG.kritisk, FARG.varning, FARG.ok, FARG.granska, FARG.granskaLjus, FARG.info, ...serie]) expect(dE(k, s), `${k} mot ${s}`).toBeGreaterThanOrEqual(20);
        }
    });
    it('hexkoderna står bara i paletten; vyerna läser PALETTE.kon eller colors', () => {
        const koder = new RegExp(`${kvinna}|${man}`, 'i'), fynd = [];
        for (const f of readdirSync(join(ROOT, 'src/app')).filter(f => f.endsWith('.js') && !['10-diagramtema.js', '09-lib-speglar.js'].includes(f))) {
            if (koder.test(utanKommentarer(läs(`src/app/${f}`)))) fynd.push(f);
        }
        for (const f of ['src/style.css', 'src/index.html']) if (koder.test(läs(f))) fynd.push(f);
        expect(fynd).toEqual([]);
    });
});


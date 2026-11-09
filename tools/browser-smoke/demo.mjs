// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
// Webbläsar-röktestet, del: Stort demo.
// Körs av tools/browser-smoke.mjs i samma ordning som kontrollerna alltid har körts.
import { FIL, ok, browser } from './rigg.mjs';
/* global state, _ritadVid, flikInaktuell -- används i page.evaluate, där de finns i sidan */

// Stort demo (7 000 personer): tider.
export async function stortDemo() {
    console.log('\n── Stort demo (7 000 personer): tider ──');
    // Från klick på "stort demo" i Kom igång tills Översikt är ritad, och sedan varje tung flik tills den är ritad och
    // sidindexet byggt, och sökningen tills träfflistan visas. Budget 5 s per steg (maskinberoende, som perf-smoke.mjs).
    {
        const BUDGET = 5000;
        const s = await browser.newPage({ viewport: { width: 1440, height: 900 } });
        const sFel = [], sInterna = [];
        s.on('pageerror', e => sFel.push(String(e && e.message || e)));
        s.on('console', m => { if (m.type() === 'warning' && /Internt fel i/.test(m.text())) sInterna.push(m.text()); });
        await s.goto('file://' + FIL);
        const tider = [];
        const mat = async (namn, fn) => { const t = await fn(); tider.push(`${namn} ${t} ms`); ok(t <= BUDGET, `stort demo: ${namn} på ${t} ms (budget ${BUDGET} ms)`); };
        // Klicket och väntan mäts i sidan, så att Playwrights egen tur inte räknas med.
        await mat('Översikt ritad', () => s.evaluate(async () => {
            const t0 = performance.now();
            document.getElementById('first-run-stort-demo').click();
            while (!(/stort demo/.test(document.getElementById('data-status').textContent) && document.querySelector('#view-dashboard svg'))) { if (performance.now() - t0 > 30000) return 99999; await new Promise(r => setTimeout(r, 10)); }
            await new Promise(r => requestAnimationFrame(() => r()));
            return Math.round(performance.now() - t0);
        }));
        ok(await s.evaluate(() => state.data.length === 7000 && state.isDemo && document.getElementById('demo-mode-banner').style.display === 'flex'),
            'stort demo: 7 000 personer inlästa, demobannern synlig');
        for (const [flik, namn] of [['matrix', 'Lika arbete'], ['struktur', 'Lönestruktur'], ['prioritering', 'Prioritering'], ['utforska', 'Tabeller och egna vyer']]) {
            await mat(`${namn} ritad med sidindex`, () => s.evaluate(async f => {
                const t0 = performance.now();
                document.querySelector(`.nav-item[data-tab="${f}"]`).click();
                const ritad = () => {
                    const synliga = [...document.querySelectorAll('.view-panel')].filter(p => p.offsetParent !== null);
                    // Sidindexet är byggt: en post per synlig avsnittsrubrik, eller inget alls under tre (89-sidindex.js).
                    const rubriker = synliga.flatMap(p => [...p.querySelectorAll('details.avsnitt > summary h2, details.avsnitt > summary h3, .card-header > h2')])
                        .filter(h => h.offsetParent !== null).length;
                    const nav = document.getElementById('sidindex'), poster = nav.querySelectorAll('a').length;
                    const index = rubriker >= 3 ? poster === rubriker && !nav.hidden : poster === 0 && nav.hidden;
                    return synliga.length && synliga.some(p => p.querySelector('[id^="chart-"] svg, tbody tr')) && index;   // ett diagram eller en tabellrad, inte en ikon
                };
                while (!ritad()) { if (performance.now() - t0 > 30000) return 99999; await new Promise(r => setTimeout(r, 10)); }
                await new Promise(r => requestAnimationFrame(() => r()));
                return Math.round(performance.now() - t0);
            }, flik));
        }
        // Alla diagram (74-alla-diagram.js): varje grupp öppnas för sig, tills dess kopior är ritade. Budget 2 s per grupp,
        // också för en flik som ritas först när gruppen öppnas.
        await s.evaluate(() => document.getElementById('ut-flik-alla').click());
        const grupper = await s.evaluate(() => [...document.querySelectorAll('#ut-alla-grupper > details')].map(g => g.dataset.utFlik));
        const gruppTider = [];
        for (const flik of grupper) {
            const [t, antal, forut] = await s.evaluate(async f => {
                const g = document.getElementById(`ut-alla-${f}`), forut = _ritadVid.has(f) && !flikInaktuell(f);
                const t0 = performance.now();
                g.querySelector('summary').click();
                while (!/diagram/.test(g.querySelector('.avsnitt-under').textContent) || !g.open || /ritas när/.test(g.querySelector('.avsnitt-under').textContent)) { if (performance.now() - t0 > 30000) return [99999, 0, forut]; await new Promise(r => setTimeout(r, 10)); }
                await new Promise(r => requestAnimationFrame(() => r()));
                return [Math.round(performance.now() - t0), g.querySelectorAll('[id^="ut-diagram-"]').length, forut];
            }, flik);
            gruppTider.push(`${flik} ${t} ms (${antal} diagram${forut ? '' : ', fliken ritades'})`);
            ok(t <= 2000, `stort demo: Alla diagram, gruppen ${flik} öppnad på ${t} ms (budget 2000 ms)`);
        }
        console.log(`  Alla diagram: ${gruppTider.join(' · ')}`);
        await mat('sökningen visar träffar', () => s.evaluate(async () => {
            const f = document.getElementById('sok-grupp'), t0 = performance.now();
            f.value = 'Undersköterska';
            f.dispatchEvent(new Event('input', { bubbles: true }));
            while (!document.querySelector('#sok-grupp-lista [role="option"]')) { if (performance.now() - t0 > 30000) return 99999; await new Promise(r => setTimeout(r, 10)); }
            return Math.round(performance.now() - t0);
        }));
        console.log(`  Tider: ${tider.join(' · ')}`);
        ok(sFel.length === 0 && sInterna.length === 0, `stort demo: inga sidfel eller interna fel${sFel.length || sInterna.length ? ': ' + [...sFel, ...sInterna].slice(0, 3).join(' | ') : ''}`);
        await s.close();
    }
}

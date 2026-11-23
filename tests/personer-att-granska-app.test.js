// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
// Personer att granska i appen: tabellen, texterna och vad som lämnar verktyget.
import { describe, it, expect } from 'vitest';
import { createAppWindow, delatFonster } from './helpers/app-harness.js';

const demo = delatFonster(w => w.__loadDemoData());

describe('Personer att granska', () => {
    const oppna = w => { w.__loadDemoData(); w.document.querySelector('.nav-item[data-tab="matrix"]').click(); };
    const sankEn = w => {
        // Sänk en person i största AID/BAS-gruppen till 60 % av gruppens median → flaggas.
        const d = w.__state.data, grupper = {};
        d.forEach((r, i) => { const k = `${r.aid}|${r.bas}`; (grupper[k] = grupper[k] || []).push(i); });
        const idx = Object.values(grupper).sort((a, b) => b.length - a.length)[0];
        const loner = idx.map(i => d[i].lon).sort((a, b) => a - b);
        const i = idx[0];
        d[i].lon = Math.floor(loner[loner.length >> 1] * 0.6 / 1000) * 1000 + 437;
        return d[i];
    };
    it('panelen ritas i Lika arbete med demodata, utan §, utan exportknappar', () => {
        const w = createAppWindow();
        oppna(w);
        const host = w.document.getElementById('personer-att-granska');
        expect(host.closest('#view-lika-yrken')).not.toBeNull();
        expect(host.hidden).toBe(false);
        expect(host.textContent).toContain('DEMODATA');
        expect(host.textContent).toContain('En avvikelse är inte i sig osaklig');
        expect(host.textContent).not.toMatch(/§|3 kap\./);
        expect(host.querySelector('[data-csv-table], .table-export-tools, button')).toBeNull();
    });
    it('en sänkt person flaggas med filens radnummer; gränsen ritar om', () => {
        const w = createAppWindow();
        w.__loadDemoData();
        const p = sankEn(w);
        w.document.querySelector('.nav-item[data-tab="matrix"]').click();
        const celler = [...w.document.querySelectorAll('#pag-tabell tbody tr')].map(tr => tr.cells[0].textContent.trim());
        expect(celler).toContain(String(p.radnr));
        const grans = w.document.getElementById('pag-grans');
        grans.value = '30';
        grans.dispatchEvent(new w.Event('input'));
        expect(w.document.getElementById('pag-innehall').textContent).toContain('30 %');
    });
    it('gränsfältet kläms: tomt → 10, 100 → 30, "abc" → 10', () => {
        const w = createAppWindow();
        oppna(w);
        const grans = w.document.getElementById('pag-grans');
        for (const [in_, ut] of [['', '10'], ['100', '30'], ['abc', '10']]) {
            grans.value = in_;
            grans.dispatchEvent(new w.Event('input'));
            expect(w.document.getElementById('pag-innehall').textContent).toContain(`${ut} %`);
        }
    });
    it('Rensa all data tömmer och döljer panelen', () => {
        const w = createAppWindow();
        oppna(w);
        w.__clearAllData();
        expect(w.document.getElementById('personer-att-granska').hidden).toBe(true);
        expect(w.document.getElementById('pag-innehall').textContent.trim()).toBe('');
    });
    it('del C i "Var uppstår löneskillnaden?" länkar till panelen och skrollar fram den', () => {
        const w = createAppWindow();
        w.__loadDemoData(); w.__renderTabContent('struktur');
        const lank = w.document.querySelector('#gap-uppdelning [data-gu-del="C"] [data-go-to-anchor="personer-att-granska"]');
        expect(lank).not.toBeNull();
        let skrollad = false;
        w.document.getElementById('personer-att-granska').scrollIntoView = () => { skrollad = true; };
        lank.click();
        expect(w.document.querySelector('.nav-item.active').dataset.tab).toBe('matrix');
        expect(skrollad).toBe(true);
    });
    it('listan lämnar inte verktyget: den sänkta lönen finns inte i rapportunderlag eller Word-utkast', () => {
        const w = createAppWindow();
        w.__loadDemoData();
        const p = sankEn(w);
        w.document.querySelector('.nav-item[data-tab="matrix"]').click();
        expect(w.__ifFlaggaIndivider(w.__hamtaData(), { minGrupp: w.__K }).flaggade.some(f => f.radnr === p.radnr)).toBe(true);
        const norm = s => String(s).replace(/[\s  ]/g, '');
        const kanaler = {
            rapportunderlag: w.__rapportunderlagBlock().map(b => w.__ruTillText(b)).join('\n'),
            word: w.__docDraftHtml(),   // utskriften ritas ur samma modell
        };
        for (const [namn, text] of Object.entries(kanaler)) expect(norm(text), namn).not.toContain(String(p.lon));
    });
    it('över 200 flaggade: de 200 största visas, "Visa alla" ritar resten', () => {
        const w = createAppWindow();
        const rader = [];
        for (let i = 0; i < 400; i++) rader.push({ bas: 'B', kon: i % 2 ? 'man' : 'kvinna', lon: 30000, alder: 40, aid: '5301', yrke: '5301 Undersköterska', enhet: '', radnr: i + 2 });
        for (let i = 0; i < 250; i++) rader.push({ bas: 'B', kon: i % 2 ? 'man' : 'kvinna', lon: 20000 + i, alder: 40, aid: '5301', yrke: '5301 Undersköterska', enhet: '', radnr: 500 + i });
        w.__state.data = rader;
        w.eval('populateSelects(); unlockTabs();');
        w.__renderTabContent('matrix');
        expect(w.document.querySelectorAll('#pag-tabell tbody tr')).toHaveLength(200);
        const knapp = w.document.getElementById('pag-visa-alla');
        expect(knapp.textContent).toContain('250');
        knapp.click();
        expect(w.document.querySelectorAll('#pag-tabell tbody tr')).toHaveLength(250);
    });
    it('"Vad lagras?" redovisar fältet radnr', () => {
        const w = createAppWindow();
        w.__loadDemoData();
        w.eval('openDataResidency()');
        const t = w.document.getElementById('data-residency-content').textContent;
        expect(t).toContain('radnr');
        expect(t).toContain('radnummer i lönefilen');
    });
    it('#pag-tabell nämns bara av panelens modul, index.html och stilmallen', async () => {
        const { readFileSync, readdirSync } = await import('node:fs');
        const { join, dirname } = await import('node:path');
        const { fileURLToPath } = await import('node:url');
        const app = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'app');
        const traffar = readdirSync(app).filter(f => f.endsWith('.js') && readFileSync(join(app, f), 'utf8').includes('pag-tabell'));
        expect(traffar).toEqual(['43-personer-att-granska.js']);
    });
});

describe('Personer att granska', () => {
    it('tabellens rullande ruta nås med tangentbordet och har ett namn', () => {
        const w = demo();
        w.eval('renderPersonerAttGranska(true)');
        const ruta = w.document.querySelector('.pag-tabell-wrap');
        expect(ruta.getAttribute('tabindex')).toBe('0');
        expect(ruta.getAttribute('aria-label')).toBe('Personer att granska, rullar i sidled');
    });
    it('metoden står i en not under tabellen, och ansvarsetiketten är kort med hela namnet i verktygstipset', () => {
        const w = demo();
        w.eval('renderPersonerAttGranska(true)');
        const d = w.document;
        const rubriker = [...d.querySelectorAll('#pag-tabell thead th')].map(th => th.textContent);
        expect(rubriker).not.toContain('Metod');
        expect(rubriker[rubriker.length - 1]).toBe('Ansvar');
        expect([...d.querySelectorAll('#pag-tabell tbody tr')].every(tr => tr.children.length === rubriker.length)).toBe(true);
        expect(d.querySelector('.pag-metod').textContent).toContain('Förväntad lön är räknad ur åldern');
        const ansvar = [...d.querySelectorAll('#pag-tabell tbody tr')].map(tr => tr.lastElementChild);
        const utan = ansvar.filter(td => td.textContent === 'Inget särskilt');
        expect(utan.length).toBeGreaterThan(0);
        expect(utan.every(td => td.title === 'Inget särskilt ansvar')).toBe(true);
        expect(ansvar.some(td => td.textContent === 'Inget särskilt ansvar')).toBe(false);
    });
    it('en förväntad lön som är gruppens median märks med en asterisk som noten förklarar', () => {
        const w = createAppWindow();
        w.__loadDemoData();
        // Alla lika gamla: ingen åldersspridning att räkna med, så den förväntade lönen blir gruppens median.
        w.__state.data.forEach(r => { r.alder = 40; });
        w.eval('renderPersonerAttGranska(true)');
        const rader = w.document.querySelectorAll('#pag-tabell tbody tr').length;
        expect(rader).toBeGreaterThan(0);
        expect(w.document.querySelectorAll('#pag-tabell .pag-median').length).toBe(rader);
        expect(w.document.querySelector('.pag-metod').textContent).toContain('Gruppens median');
    });
});

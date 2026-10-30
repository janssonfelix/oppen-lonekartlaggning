// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
// Vakttester för gränssnittets beteende: det som ser lyckat ut ska vara lyckat, tal skrivs på ett sätt, och
// bildspråket är linjeikoner. Varje test faller om felet det vaktar kommer tillbaka. Delen här: inläsning, flikar utan underlag, utskrift,
// dossiern, talen och exportknapparna; resten i granssnitt-vyer.test.js (riggen i helpers/granssnitt-rigg.js).
import { describe, it, expect } from 'vitest';
import { createAppWindow, delatFonster, utgangslage } from './helpers/app-harness.js';
import { las, papa, vanta, csvFil, braRader, okandaRader, medDecimalpunkt } from './helpers/granssnitt-rigg.js';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const demo = delatFonster(w => w.__loadDemoData());
it('det delade fönstret står i utgångsläget', () => {
    expect(utgangslage(demo())).toEqual({ troskel: 10, dialoger: 0, flik: 'dashboard' });
});

describe('lönefil vars kolumner inte känns igen', () => {
    const lasIn = async rader => {
        const w = createAppWindow();
        papa(w);
        w.loadStructureFile(csvFil(w, rader));
        await vanta(() => w.document.getElementById('column-map-panel')?.innerHTML);
        return w;
    };
    it('märks inte som inläst, och flikarna förblir låsta', async () => {
        const w = await lasIn(okandaRader());
        const d = w.document;
        expect(w.__state.data.length).toBe(0);
        expect(d.getElementById('tab-matrix').disabled).toBe(true);
        const marke = d.querySelector('#upload-cell-data .upload-badge');
        expect(marke.textContent).toContain('Kolumnmappning');
        expect(marke.textContent).not.toContain('Inläst');
        expect(marke.classList.contains('loaded')).toBe(false);
        expect(d.getElementById('upload-cell-data').classList.contains('loaded')).toBe(false);
        expect(d.getElementById('data-status').className).toBe('status-msg warning');
        expect(d.getElementById('dashboard-summary').style.display).not.toBe('grid');
    });
    it('panelen säger vilka rubriker filen hade, och fokus hamnar i första fältet som saknar kolumn', async () => {
        const w = await lasIn(okandaRader());
        const panel = w.document.getElementById('column-map-panel');
        expect(panel.textContent).toContain('Kolumnmappning behövs');
        for (const r of ['Avd', 'Befattning', 'Grundlon', 'Fodd', 'Sex']) expect(panel.querySelector('.colmap-rubriker').textContent).toContain(r);
        expect(w.document.activeElement.getAttribute('data-colmap-role')).toBe('bas');
    });
    it('efter mappningen läses filen in och flikarna låses upp', async () => {
        const w = await lasIn(okandaRader().map((r, i) => i ? r.replace(/^X;/, 'C;').replace(/;K$/, ';Kvinna').replace(/;M$/, ';Man').replace('Handläggare', '207011') : r));
        const satt = (roll, v) => { w.document.querySelector(`[data-colmap-role="${roll}"]`).value = v; };
        satt('bas', 'Avd'); satt('yrke', 'Befattning'); satt('lon', 'Grundlon'); satt('alder', 'Fodd'); satt('kon', 'Sex');
        w.document.getElementById('colmap-apply').click();
        await vanta(() => w.__state.data.length);
        expect(w.__state.data.length).toBe(30);
        expect(w.document.getElementById('tab-matrix').disabled).toBe(false);
        expect(w.document.querySelector('#upload-cell-data .upload-badge').textContent).toContain('Inläst');
    });
    it('ett tidigare inläst underlag ligger kvar när nästa fil inte går att läsa', async () => {
        const w = await lasIn(braRader());
        await vanta(() => w.__state.data.length);
        w.loadStructureFile(csvFil(w, okandaRader(), 'okand.csv'));
        await vanta(() => /Kolumnmappning behövs/.test(w.document.getElementById('column-map-panel').textContent));
        expect(w.__state.data.length).toBe(30);
        expect(w.document.getElementById('tab-matrix').disabled).toBe(false);
        expect(w.document.getElementById('data-status').textContent).toContain('ligger kvar');
    });
    it('en fil med igenkända kolumner men utan användbara rader märks inte som inläst', async () => {
        const w = await lasIn(['BAS;Månadslön;Ålder;Kön;AID', 'C;0;40;Kvinna;207011', 'C;0;41;Man;207011']);
        await vanta(() => w.document.getElementById('data-status').textContent);
        expect(w.document.getElementById('tab-matrix').disabled).toBe(true);
        expect(w.document.querySelector('#upload-cell-data .upload-badge').textContent).toContain('Inga rader');
        expect(w.document.getElementById('data-status').textContent).toContain('2 rader utan lön');
    });
});

describe('menyns ordning', () => {
    it('Dokumentera & exportera är sista steget i menyn, efter Fördjupa', () => {
        const w = createAppWindow();
        const grupper = [...w.document.querySelectorAll('#sidomeny .nav-group')].map(g => g.textContent.trim());
        expect(grupper).toEqual(['1 · Underlag', '2 · Kartlägg & analysera', '3 · Åtgärda', '4 · Fördjupa (ej lagkrav)', '5 · Dokumentera', 'Hjälp']);
        const knappar = [...w.document.querySelectorAll('#sidomeny .nav-item[data-tab]')].map(b => b.dataset.tab);
        expect(knappar.indexOf('dokumentera')).toBeGreaterThan(knappar.indexOf('utforska'));
        expect(knappar.indexOf('dokumentera')).toBeLessThan(knappar.indexOf('info'));
    });
});

describe('flik utan underlag', () => {
    it('säger att inget underlag är inläst och länkar till Översikt; raden försvinner när underlaget finns', () => {
        const w = createAppWindow();
        w.eval("renderTabContent('matrix')");
        const rad = () => w.document.querySelector('#view-lika-yrken > .inget-underlag');
        expect(rad().textContent).toContain('Inget underlag inläst');
        expect(rad().querySelector('[data-go-to-tab="dashboard"]')).toBeTruthy();
        w.eval("renderTabContent('matrix')");
        expect(w.document.querySelectorAll('#view-lika-yrken > .inget-underlag').length).toBe(1);
        w.__loadDemoData();
        w.eval("renderTabContent('matrix')");
        expect(rad()).toBeNull();
    });
    it('flikar som inte kräver lönefilen får ingen sådan rad', () => {
        const w = createAppWindow();
        w.eval("renderTabContent('handlingsplan'); renderTabContent('info')");
        expect(w.document.querySelector('.inget-underlag')).toBeNull();
    });
});

describe('utskrift av den aktiva fliken (Ctrl+P)', () => {
    it('regeln som döljer allt utom PDF-rapporten gäller bara när PDF-knappen satt body.print-mode', () => {
        const css = las('src/style.css');
        expect(css).not.toMatch(/^\s*body \* \{ visibility: hidden; \}/m);
        expect(css).toContain('body.print-mode * { visibility: hidden; }');
    });
    it('hopfällda avsnitt i den synliga fliken fälls ut före utskriften och tillbaka efteråt', () => {
        const w = createAppWindow();
        w.__loadDemoData();
        w.document.querySelector('.nav-item[data-tab="matrix"]').click();
        const avsnitt = [...w.document.querySelectorAll('#view-lika-yrken details.avsnitt')];
        expect(avsnitt.length).toBeGreaterThan(0);
        avsnitt.forEach((d, i) => { d.open = i === 0; });
        w.dispatchEvent(new w.Event('beforeprint'));
        expect(avsnitt.every(d => d.open)).toBe(true);
        w.dispatchEvent(new w.Event('afterprint'));
        expect(avsnitt.map(d => d.open)).toEqual(avsnitt.map((_, i) => i === 0));
    });
    it('PDF-rapportens utskrift rör inte avsnitten', () => {
        const w = createAppWindow();
        w.__loadDemoData();
        w.document.querySelector('.nav-item[data-tab="matrix"]').click();
        const avsnitt = [...w.document.querySelectorAll('#view-lika-yrken details.avsnitt')];
        avsnitt.forEach(d => { d.open = false; });
        w.document.body.classList.add('print-mode');
        w.dispatchEvent(new w.Event('beforeprint'));
        expect(avsnitt.some(d => d.open)).toBe(false);
        w.dispatchEvent(new w.Event('afterprint'));
        expect(w.document.body.classList.contains('print-mode')).toBe(false);
    });
});


describe('gruppdossiern', () => {
    it('gruppNamn skriver koden en gång', () => {
        const w = createAppWindow();
        const namn = g => w.eval(`gruppNamn(${JSON.stringify(g)})`);
        expect(namn({ aid: '207024', yrke: '207024 Vårdbiträde' })).toBe('207024 Vårdbiträde');
        expect(namn({ aid: '207024', yrke: 'Vårdbiträde' })).toBe('207024 Vårdbiträde');
        expect(namn({ aid: '207024', yrke: '207024' })).toBe('207024');
        expect(namn({ aid: '207024', yrke: '' })).toBe('207024');
        expect(namn({ aid: '207024', yrke: '207024 (3 yrkesbenämningar)' })).toBe('207024 (3 yrkesbenämningar)');
    });
    it('rubriken, väljaren och textkopian dubblerar inte AID-koden, och inget tal har decimalpunkt', () => {
        const w = createAppWindow();
        w.__loadDemoData();
        const kandidater = w.eval('gruppdossierCandidates().map(g => ({ key: g.key, aid: g.aid }))');
        expect(kandidater.length).toBeGreaterThan(3);
        const fel = [];
        for (const k of kandidater) {
            w.eval(`openGruppdossier(${JSON.stringify(k.key)})`);
            const modal = w.document.getElementById('dossier-modal');
            const rubrik = modal.querySelector('.gd-head h3').textContent;
            const val = modal.querySelector('select').selectedOptions[0].textContent;
            const text = w.eval(`gruppdossierAsText(buildGruppdossier(${JSON.stringify(k.key)}))`);
            for (const t of [rubrik, val, text.split('\n')[0]]) if (t.includes(`${k.aid} ${k.aid}`)) fel.push(t);
            fel.push(...medDecimalpunkt(modal));
            if (/\d\.\d/.test(text)) fel.push(text.split('\n').find(r => /\d\.\d/.test(r)));
        }
        expect(fel).toEqual([]);
    }, 30000);
});

describe('modalerna skriver tal på svenska', () => {
    it('Inställningar och «Vad lagras?» har inget tal med decimalpunkt', () => {
        const w = createAppWindow();
        w.__loadDemoData();
        w.eval('oppnaInstallningar()');
        expect(medDecimalpunkt(w.document.getElementById('installningar-modal'))).toEqual([]);
        w.eval('openDataResidency()');
        expect(medDecimalpunkt(w.document.getElementById('data-residency-modal'))).toEqual([]);
    });
    it('beräkningsbevisen har inget tal med decimalpunkt', () => {
        const w = createAppWindow();
        w.__loadDemoData();
        const fel = {};
        let oppnade = 0;
        for (const flik of ['matrix', 'prioritering', 'likvardighet', 'utforska', 'kon']) {
            w.__renderTabContent(flik);
            const knappar = [...w.document.querySelectorAll('.evidence-btn, [data-evidence], .btn-evidence, button[class*="evidence"], button[class*="bevis"], [data-bevis]')];
            for (const b of knappar.slice(0, 400)) {
                b.click();
                const m = w.document.getElementById('evidence-modal');
                if (m.style.display !== 'flex') continue;
                oppnade++;
                const t = medDecimalpunkt(m);
                if (t.length) (fel[flik] = fel[flik] || new Set()).add(t[0]);
                w.eval('_closeEvidenceModal()');
            }
        }
        expect(oppnade).toBeGreaterThan(10);
        expect(Object.fromEntries(Object.entries(fel).map(([k, v]) => [k, [...v].slice(0, 8)]))).toEqual({});
    }, 60000);
});

describe('samma tal i samma precision på sidan', () => {
    it('regressionskortet skriver den oförklarade skillnaden med en decimal, som flikens nyckeltal', () => {
        const w = demo();
        w.__renderTabContent('matrix');
        const tal = w.document.querySelector('.reg-hero .hero-number').textContent.trim();
        expect(tal).toMatch(/^[+\u2212-]?\d+,\d\s%$/);
        expect(w.document.querySelector('.reg-hero .hero-label').textContent).toBe('Oförklarad löneskillnad, kvinnor mot män');
        expect(w.document.querySelector('.reg-hero .hero-meta').textContent).not.toMatch(/\d,\d\d\s%/);
    });
    it('Prioriteringens tabell skriver avvikelsen med en decimal', () => {
        const w = demo();
        w.__renderTabContent('prioritering');
        const tal = [...w.document.querySelectorAll('#prio-table .cell-bar-value')].map(e => e.textContent.trim()).filter(t => t !== '–');
        expect(tal.length).toBeGreaterThan(4);
        expect(tal.filter(t => !/^[+\u2212-]?\d+,\d\s%$/.test(t))).toEqual([]);
    });
});

describe('Löneöversyn utan påslag', () => {
    it('ett tal som inte ändras sägs vara oförändrat, inte med en ensam pil', () => {
        const w = createAppWindow();
        w.__loadDemoData();
        // En pott men inget påslag: utfallet visas, och inget tal har ändrats.
        w.__state.forecast.budget = { mode: 'pct', value: 2 };
        w.__renderTabContent('loneoversyn');
        const text = w.document.getElementById('forecast-outcome').textContent.replace(/\s+/g, ' ');
        expect(text).toMatch(/Kvinnors medianlön i % av mäns: [\d,]+ % till [\d,]+ % oförändrat/);
        expect(text).toMatch(/Oförklarat gap \(regressionen\): \S+ % till \S+ % oförändrat/);
        expect(text).not.toMatch(/[\u2190-\u21FF]/);
    });
});

describe('en exportknapp per kort', () => {
    const FLIKAR = ['dashboard', 'matrix', 'likvardighet', 'struktur', 'prioritering', 'loneoversyn', 'kon', 'benchmark', 'utforska'];
    it('varje diagram har en exportmeny, ingen behållare har två, och ingen fristående exportknapp står bredvid', () => {
        const w = demo();
        for (const flik of FLIKAR) w.__renderTabContent(flik);
        const d = w.document;
        const namn = el => (el.closest('.card, .diagramkort')?.querySelector('h2, h3, h4')?.textContent || el.id || '').trim().slice(0, 40);
        const varder = [...d.querySelectorAll('.view-panel .chart-export-host')];
        expect(varder.length).toBeGreaterThan(20);
        // Två menyer i samma behållare, eller en behållare inuti en annan, ger två knappar över varandra.
        expect(varder.filter(v => v.querySelectorAll(':scope > .chart-export').length !== 1).map(namn)).toEqual([]);
        expect(varder.filter(v => v.parentElement.closest('.chart-export-host')).map(namn)).toEqual([]);
        // Diagrammets meny är enda vägen till en bild: ingen knapp «Exportera PNG» eller «Exportera (CSV)» utanför menyerna.
        const aldre = [...d.querySelectorAll('.view-panel button')].filter(b => !b.closest('.chart-export-meny')
            && /^Exportera (PNG|\(CSV\))$/.test(b.textContent.trim()));
        expect(aldre.map(b => b.id || b.textContent)).toEqual([]);
    }, 30000);
    it('kandidatparens tabell har en meny Exportera med CSV och Excel', () => {
        const w = createAppWindow();
        w.__loadDemoData();
        w.__renderTabContent('likvardighet');
        const meny = w.document.getElementById('lv-export-meny');
        const knapp = meny.parentElement.querySelector('.chart-export-btn');
        expect(knapp.textContent.trim()).toBe('Exportera');
        expect(meny.hidden).toBe(true);
        knapp.click();
        expect(meny.hidden).toBe(false);
        expect([...meny.querySelectorAll('button')].map(b => b.id)).toEqual(['btn-export-likvardighet-csv', 'btn-export-likvardighet']);
        let csv = 0;
        w.eval('_downloadCSV = () => { window.__csv = (window.__csv || 0) + 1; }');
        w.document.getElementById('btn-export-likvardighet-csv').click();
        csv = w.__csv;
        expect(csv).toBe(1);
        expect(meny.hidden).toBe(true);
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

describe('Handlingsplanens tabell', () => {
    it('de tomma raderna visas bara på utskriften, och en rad säger var de tomma kolumnerna fylls i', () => {
        const css = las('src/style.css');
        expect(css).toMatch(/#handlingsplan-tbody \.handlingsplan-empty \{ display: none; \}/);
        expect(css).toMatch(/@media print \{ #handlingsplan-tbody \.handlingsplan-empty \{ display: table-row; \} \}/);
        const w = demo();
        w.__renderTabContent('handlingsplan');
        expect(w.document.querySelectorAll('#handlingsplan-tbody tr.handlingsplan-empty').length).toBeGreaterThanOrEqual(5);   // finns kvar för utskriften
        expect(w.document.querySelector('#view-handlingsplan .handlingsplan-not').textContent).toContain('fylls i Excel-filen eller på utskriften');
    });
});

describe('Rensa all data står i Inställningar', () => {
    it('sidhuvudet har bara «Vad lagras?»; knappen ligger under rubriken Rensa i panelen', () => {
        const w = createAppWindow();
        const d = w.document;
        expect([...d.querySelectorAll('.top-header .gdpr-banner button')].map(b => b.textContent.trim())).toEqual(['Vad lagras?']);
        const knapp = d.getElementById('btn-clear-all-data');
        expect(knapp.closest('#installningar-modal')).toBeTruthy();
        expect(knapp.closest('section').querySelector('h3').textContent).toBe('Rensa');
        expect(knapp.classList.contains('btn-fara')).toBe(true);
    });
    it('knappen frågar först, rensar och stänger panelen; ett nej lämnar allt orört', () => {
        const w = createAppWindow();
        w.__loadDemoData();
        w.eval('oppnaInstallningar()');
        w.confirm = () => false;
        w.document.getElementById('btn-clear-all-data').click();
        expect(w.__state.data.length).toBeGreaterThan(0);
        expect(w.eval('installningarOppna()')).toBe(true);
        let fragor = 0;
        w.confirm = () => { fragor++; return true; };
        w.document.getElementById('btn-clear-all-data').click();
        expect(fragor).toBe(1);
        expect(w.__state.data.length).toBe(0);
        expect(w.eval('installningarOppna()')).toBe(false);
    });
    it('demoknappen har vit text på den mörka varningsfärgen', () => {
        const regel = /\.demo-mode-exit \{[^}]*\}/.exec(las('src/style.css'))[0];
        expect(regel).toContain('background: var(--status-varning);');
        expect(regel).toContain('color: var(--vit);');
    });
});

describe('raden om det markerade', () => {
    it('står överst i innehållet på samma plats i alla flikar, och urvalsraden säger inte samma sak en gång till', () => {
        const w = createAppWindow();
        w.__loadDemoData();
        const d = w.document;
        d.querySelector('.nav-item[data-tab="matrix"]').click();
        w.eval("sattDiagramMarkering('grupp:207024|B')");
        const rad = () => d.getElementById('markering-rad');
        expect(rad().parentElement.classList.contains('content-body')).toBe(true);
        expect(rad().parentElement.firstElementChild).toBe(rad());
        expect(rad().getAttribute('role')).toBe('status');
        expect([...rad().querySelectorAll('button')].map(b => b.textContent)).toEqual(['Öppna gruppdossier', 'Ta bort markeringen']);
        expect(rad().title).toContain('Ctrl-klicka');
        expect(d.querySelector('.markering-tips')).toBeNull();
        expect(d.getElementById('la-urval').textContent).not.toContain('Markerat');
        d.querySelector('.nav-item[data-tab="handlingsplan"]').click();
        expect(d.querySelectorAll('#markering-rad').length).toBe(1);
        rad().querySelector('[data-markering="rensa"]').click();
        expect(rad()).toBeNull();
    });
    it('stilmallen lägger inte raden fast över sidan', () => {
        const regel = /\.markering-rad \{[^}]*\}/.exec(las('src/style.css'))[0];
        expect(regel).not.toContain('position: fixed');
        expect(regel).toContain('position: sticky');
    });
});

describe('samma skillnad sägs på ett sätt', () => {
    it('Att göra skriver den råa skillnaden per BAS som kvinnors lön i procent av mäns, som Lika arbete', () => {
        const w = demo();
        const punkter = w.eval('buildActionChecklist()').filter(p => p.id.startsWith('gap-bas-'));
        expect(punkter.length).toBeGreaterThan(0);
        for (const p of punkter) {
            expect(p.titel).toMatch(/^BAS \S+: kvinnors medianlön \d+,\d % av mäns$/);
            expect(p.titel).not.toMatch(/lägre|högre/);
        }
        w.__renderTabContent('matrix');
        const kvoter = [...w.document.querySelectorAll('#la-oversikt tbody tr')].map(tr => tr.textContent);
        const b = punkter[0].titel.match(/^BAS (\S+): kvinnors medianlön (\d+,\d) %/);
        expect(kvoter.some(t => t.includes(`BAS ${b[1]}`) && t.includes(`${b[2]} %`))).toBe(true);
    });
    it('där skillnaden står kvar heter den skillnad, och den oförklarade skillnaden har en decimal där den står som huvudtal', () => {
        const w = demo();
        w.__renderTabContent('matrix');
        w.__renderTabContent('loneoversyn');
        const d = w.document;
        const tvaDec = el => /[+\u2212-]?\d+,\d\d\s%/.test(el.textContent);
        const ytor = ['.reg-hero', '.reg-kronor-head', '#la-slutsatser', '#lo-slutsatser', '#forecast-outcome'];
        for (const sel of ytor) {
            const el = d.querySelector(sel);
            expect(el, sel).toBeTruthy();
            const blad = [...el.querySelectorAll('*')].filter(e => !e.children.length && !e.closest('.info-tip') && !/PO\b/.test(e.textContent));
            expect(blad.filter(tvaDec).map(e => e.textContent.trim().slice(0, 50)), sel).toEqual([]);
        }
        const kort = [...d.querySelectorAll('#la-slutsatser .slutsats')].find(k => k.textContent.includes('Efter ålder och nivå'));
        expect(kort.textContent).toContain('kvinnors lön i % av mäns när ålder och nivå räknats bort');
    }, 30000);
});

describe('Regler & praxis visar vad som är bedömt', () => {
    const satt = (w, n, status) => { const s = w.document.getElementById('bes8-status-' + n); s.value = status; s.dispatchEvent(new w.Event('change', { bubbles: true })); };
    const tal = w => [...w.document.querySelectorAll('#rp-slutsatser .slutsats')].map(k => [k.querySelector('.slutsats-etikett').textContent, k.querySelector('.slutsats-varde').textContent]);
    it('nyckeltalen överst räknar bedömda områden, åtgärder och möjliga risker', () => {
        const w = createAppWindow();
        expect(tal(w)).toEqual([['Bedömda områden', '0 av 6'], ['Åtgärd krävs', '0'], ['Möjlig risk', '0']]);
        satt(w, 1, 'Åtgärd krävs');
        satt(w, 3, 'Möjlig risk – utreds vidare');
        satt(w, 4, 'Ingen risk identifierad');
        expect(tal(w)).toEqual([['Bedömda områden', '3 av 6'], ['Åtgärd krävs', '1'], ['Möjlig risk', '1']]);
    });
    it('varje område är ett avsnitt med statusen i rubrikraden, och rubriken i Word-utkastet är oförändrad', () => {
        const w = createAppWindow();
        const d = w.document;
        const omraden = [...d.querySelectorAll('#view-bestammelser details.bes8-omrade')];
        expect(omraden.length).toBe(6);
        expect(omraden.every(o => o.classList.contains('avsnitt') && o.querySelector('summary .avsnitt-titel h3') && o.querySelector('summary .avsnitt-nyckel'))).toBe(true);
        expect(d.getElementById('nyckel-rp-2').textContent).toBe('Ej bedömt');
        satt(w, 2, 'Åtgärd krävs');
        const marke = d.getElementById('nyckel-rp-2');
        expect(marke.textContent.trim()).toBe('Åtgärd krävs');
        expect(marke.querySelector('svg.ikon')).toBeTruthy();
        expect(marke.classList.contains('ar-kritisk')).toBe(true);
        expect(w.eval('_bes8Areas()')[1].title).toBe('2. Lönerevisionsprocessen (löneöversyn)');
        satt(w, 2, '');
        expect(d.getElementById('nyckel-rp-2').textContent).toBe('Ej bedömt');
    });
    it('statusen följer med när allt rensas och när en konfigurationsfil läses in', () => {
        const w = createAppWindow();
        w.__loadDemoData();
        satt(w, 5, 'Ej tillämplig');
        const cfg = w.eval('JSON.stringify(buildConfigSnapshot())');
        w.confirm = () => true;
        w.eval('clearAllData()');
        expect(w.document.getElementById('nyckel-rp-5').textContent).toBe('Ej bedömt');
        expect(tal(w)[0][1]).toBe('0 av 6');
        w.__loadDemoData();
        w.eval(`applyConfigSnapshot(${cfg})`);
        expect(w.document.getElementById('nyckel-rp-5').textContent.trim()).toBe('Ej tillämplig');
        expect(tal(w)[0][1]).toBe('1 av 6');
    });
    it('fliken påstår inte att svaren inte sparas', () => {
        expect(las('src/index.html')).not.toContain('Verktyget sparar inga svar');
    });
});

describe('ett statusordförråd och ett mått i nyckeltalen', () => {
    const fil = namn => readFileSync(fileURLToPath(new URL('../' + namn, import.meta.url)), 'utf8');
    it('de gamla statusorden finns inte kvar i bygget eller sidan', () => {
        for (const namn of ['dist/app.js', 'src/index.html']) {
            const text = fil(namn);
            for (const gammalt of ['Inom 3 %', 'Avviker mer än 5', 'Avviker 3–5', 'Värt att följa upp', 'rå skillnad, hela organisationen']) {
                expect(text.includes(gammalt), `${gammalt} i ${namn}`).toBe(false);
            }
        }
    });
    it('Förklaringen nämner varje statusord en gång, med färgen bunden till ordet', () => {
        const d = demo().document;
        const ord = [...d.querySelectorAll('#symbols-modal strong')].map(e => [e.textContent.trim(), e.className]);
        for (const [namn, klass] of [['Balanserat', 'farg-ok'], ['Följ upp', 'farg-varning'], ['Värt att granska', 'farg-granska'], ['Börja här', 'farg-granska'], ['Över referens', 'farg-info']]) {
            expect(ord.filter(o => o[0] === namn), namn).toEqual([[namn, klass]]);
        }
        // Ingen separat färgtabell som upprepar orden.
        expect([...d.querySelectorAll('#symbols-modal h3')].map(h => h.textContent)).not.toContain('Färger för avvikelser och status');
    });
    it('Lika arbete och Prioritering säger samma ord med samma färg', () => {
        const w = demo();
        w.__renderTabContent('matrix');
        const d = w.document;
        const farg = { 'Balanserat': 'ok', 'Följ upp': 'varning', 'Värt att granska': 'granska' };
        const bas = [...d.querySelectorAll('#la-oversikt tbody .la-status')];
        expect(bas.length).toBeGreaterThan(0);
        for (const el of bas) expect(el.classList.contains('ar-' + farg[el.textContent.trim()]), el.textContent).toBe(true);
        const yrke = [...d.querySelectorAll('#matrix-table tbody .la-status:not(.la-status-liten)')];
        for (const el of yrke) {
            const namn = Object.keys(farg).find(k => el.textContent.includes(k));
            expect(namn, el.textContent).toBeTruthy();
            expect(el.classList.contains('farg-' + farg[namn])).toBe(true);
        }
        const prio = w.eval('Object.values(PRIO_STATUS_INFO)');
        expect(prio.map(p => p.label)).toEqual(['Börja här', 'Värt att granska', 'Följ upp', 'Balanserat', 'Över referens']);
    });
    it('livscykelns nyckeltal är kvinnors lön i % av mäns, och modellens skillnad står bredvid', () => {
        const w = demo();
        w.__renderTabContent('kon');
        w.eval('renderLifecycleAnalysis()');
        const d = w.document, r = w.eval('runLifecycleRegression(_lifecycleFixBas)');
        const pct = v => v.toFixed(1).replace('.', ',') + ' %';
        const rutor = [...d.querySelectorAll('#livscykel-content .stat-box')].map(b => [b.querySelector('.stat-etikett').textContent, b.querySelector('.fs-xl')?.textContent.trim()]);
        expect(rutor[0]).toEqual(['Kvinnors lön i % av mäns, 25 år', pct(100 + r.gapAt25)]);
        expect(rutor[1]).toEqual(['Kvinnors lön i % av mäns, 65 år', pct(100 + r.gapAt65)]);
        expect(d.querySelector('#livscykel-content .livscykel-kvot-not').textContent).toContain('Modellen ger skillnaden i procent');
    });
});

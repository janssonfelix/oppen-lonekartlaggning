// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
// Vakttester för gränssnittets beteende: det som ser lyckat ut ska vara lyckat, tal skrivs på ett sätt, och
// bildspråket är linjeikoner. Varje test faller om felet det vaktar kommer tillbaka. Delen här: tomma lägen, tabellerna, formulären,
// ikonerna, språket och rubrikerna; resten i granssnitt.test.js (riggen i helpers/granssnitt-rigg.js).
import { describe, it, expect } from 'vitest';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { createAppWindow } from './helpers/app-harness.js';
import { rot, las, papa, vanta, csvFil, okandaRader } from './helpers/granssnitt-rigg.js';

describe('tomma lägen som inte låter som fel', () => {
    it('Löneöversyn utan pott visar en rad om vad som behövs, inte en tom mätare och tabeller där före är lika med efter', () => {
        const w = createAppWindow();
        w.__loadDemoData();
        w.__renderTabContent('loneoversyn');
        const d = w.document, vy = d.getElementById('view-loneoversyn');
        expect(vy.classList.contains('lo-tomt')).toBe(true);
        expect(d.getElementById('forecast-outcome').textContent.trim()).toBe('Ange en pott ovan så visas utfallet här.');
        expect(d.getElementById('forecast-outcome').querySelector('table')).toBeNull();
        expect(d.getElementById('forecast-meter').closest('.card').classList.contains('lo-med-utfall')).toBe(true);
        expect(las('src/style.css')).toContain('.lo-tomt .lo-med-utfall { display: none; }');
        // Med en pott visas utfallet igen.
        w.__state.forecast.budget = { mode: 'pct', value: 2 };
        w.__state.forecast.generell = { mode: 'pct', value: 1 };
        w.__renderTabContent('loneoversyn');
        expect(vy.classList.contains('lo-tomt')).toBe(false);
        expect(d.getElementById('forecast-outcome').querySelector('table')).toBeTruthy();
    });
    it('Likvärdigt arbete utan jämförelsestatistik säger att den är valfri', () => {
        const w = createAppWindow();
        w.__loadDemoData();
        w.__renderTabContent('likvardighet');
        const text = w.document.getElementById('view-likvardighet').textContent;
        expect(text).not.toContain('kontrollera att Excel-filen är uppladdad');
        expect(text).toContain('Ingen jämförelsestatistik inläst (valfri)');
    });
});

describe('yrkesgruppstabellen i Lika arbete', () => {
    const rita = () => { const w = createAppWindow(); w.__loadDemoData(); w.__renderTabContent('matrix'); return w; };
    const synlig = el => { const k = el.cloneNode(true); k.querySelectorAll('.bara-export').forEach(e => e.remove()); return k.textContent.replace(/\s+/g, ' ').trim(); };
    it('statusmärket står på en rad utan tröskeln, som finns i verktygstipset; cellens text för exporten är oförändrad', () => {
        const w = rita();
        const marken = [...w.document.querySelectorAll('#matrix-table .la-status')];
        expect(marken.length).toBeGreaterThan(3);
        for (const m of marken) {
            expect(synlig(m)).toMatch(/^(Värt att granska|Följ upp|Balanserat|ett kön n < \d+)$/);
            expect(m.title).toMatch(/Skillnaden är|Könsuppdelningen/);
        }
        const granska = marken.find(m => synlig(m) === 'Värt att granska');
        expect(granska.textContent.replace(/\s+/g, ' ').trim()).toBe('Värt att granska (> 5%)');
    });
    it('raden om stabilitet är kort på skärmen, och hela meningen står i verktygstipset och i cellens text', () => {
        const w = rita();
        const rader = [...w.document.querySelectorAll('#matrix-table .la-stabilitet')];
        expect(rader.length).toBeGreaterThan(0);
        for (const r of rader) {
            expect(synlig(r).length).toBeLessThanOrEqual(36);
            expect(r.textContent).toBe(r.title);
        }
        const f = t => { const el = w.document.createElement('span'); el.innerHTML = w.eval(`_laStabilitetRad(${JSON.stringify(t)})`); return [synlig(el), el.textContent]; };
        expect(f('Stabil: över 5 % även utan 2 personer')).toEqual(['Stabil även utan 2 personer', 'Stabil: över 5 % även utan 2 personer']);
        expect(f('Skör: kan bli 4,6 % om 1 person tas bort (prövat bara på män)')).toEqual(['Skör: 4,6 % om 1 person tas bort', 'Skör: kan bli 4,6 % om 1 person tas bort (prövat bara på män)']);
        expect(f('Stabil: över 5 % även utan 1 person, fler kunde inte prövas')).toEqual(['Stabil även utan 1 person', 'Stabil: över 5 % även utan 1 person, fler kunde inte prövas']);
        expect(f('Kan inte prövas: båda könen har exakt 10 personer')).toEqual(['Kan inte prövas', 'Kan inte prövas: båda könen har exakt 10 personer']);
    });
    it('ansvarsraderna är hopfällda tills pilen på yrkesraden fäller ut dem; raden med ett tal står kvar', () => {
        const w = rita();
        const d = w.document;
        const ansvar = [...d.querySelectorAll('#matrix-table tr.la-underrad-ansvar')];
        expect(ansvar.length).toBeGreaterThan(2);
        expect(ansvar.every(tr => tr.hidden)).toBe(true);
        const utan = [...d.querySelectorAll('#matrix-table tr.la-underrad:not(.la-underrad-ansvar)')];
        expect(utan.length).toBeGreaterThan(0);
        expect(utan.every(tr => !tr.hidden && /Utan ledningsansvar/.test(tr.textContent))).toBe(true);
        const pil = d.querySelector('#matrix-table .la-falla');
        expect(pil.getAttribute('aria-expanded')).toBe('false');
        const egna = []; for (let tr = pil.closest('tr').nextElementSibling; tr && tr.classList.contains('la-underrad'); tr = tr.nextElementSibling) if (tr.classList.contains('la-underrad-ansvar')) egna.push(tr);
        pil.click();
        expect(pil.getAttribute('aria-expanded')).toBe('true');
        expect(egna.length).toBeGreaterThan(0);
        expect(egna.every(tr => !tr.hidden)).toBe(true);
        expect(w.eval('diagramMarkering()')).toBeNull();   // pilen markerar inte raden
        pil.click();
        expect(egna.every(tr => tr.hidden)).toBe(true);
    });
});

describe('kandidatparens tabell', () => {
    it('intervallet står som ett spann på en rad med omdömet som märke, och exporten bär formen med klamrar', () => {
        const w = createAppWindow();
        w.__loadDemoData();
        w.__renderTabContent('likvardighet');
        const d = w.document;
        const ki = [...d.querySelectorAll('#likvardighet-table .lv-ki')];
        expect(ki.length).toBeGreaterThan(0);
        for (const k of ki) {
            expect(k.textContent).toMatch(/^[\d\s\u00a0\u2212-]+–[\d\s\u00a0\u2212-]+ kr$/);
            expect(k.closest('td').querySelector('.lv-ki-marke').textContent).toMatch(/^(säker skillnad|inom slumpfel)$/);
            expect(w.eval('_tableCellText')(k.closest('td'))).toMatch(/^\[[^\]]+ kr, [^\]]+ kr\]\s?(säker skillnad|inom slumpfel)$/);
        }
        const rubriker = [...d.querySelectorAll('#likvardighet-table thead th')].map(th => th.textContent);
        expect(rubriker).toContain('Påverkan (kr/mån)');
        // Den nationella andelen står i verktygstipset, med källa och period, inte i raden (men följer med i cellens text för exporten).
        const under = d.querySelector('#likvardighet-table .lv-under');
        const synlig = under.cloneNode(true); synlig.querySelectorAll('.bara-export').forEach(e => e.remove());
        expect(synlig.textContent).not.toContain('nationellt');
        expect(under.title).toMatch(/nationellt \(SKR:s personalstatistik, [a-z]+ \d{4}\)/);
        expect(las('src/style.css')).toMatch(/#likvardighet-table td\.t-hoger[^{]*\{ white-space: nowrap; \}/);
    });
});

describe('Löneöversikten i Utforska', () => {
    const rita = () => { const w = createAppWindow(); w.__loadDemoData(); w.__renderTabContent('utforska'); return w; };
    it('heter Löneöversikt, och sökfältet säger vad man söker på', () => {
        const html = las('src/index.html');
        expect(html).not.toMatch(/Hierarkisk Rapport/i);
        expect(html).toContain('<h2>Löneöversikt — alla BAS-intervall</h2>');
        const w = createAppWindow();
        expect(w.document.getElementById('search-rapport').placeholder).toBe('Sök yrke eller BAS');
    });
    it('jämförelsestatistikens kolumner visas bara när en statistik är inläst', () => {
        const w = rita();
        const t = w.document.getElementById('rapport-table');
        expect(w.__state.statistik.length).toBe(0);
        expect(t.classList.contains('utan-jamforelse')).toBe(true);
        expect(t.querySelectorAll('thead th').length).toBe(8);   // kolumnerna står kvar för exporten
        expect(las('src/style.css')).toContain('#rapport-table.utan-jamforelse :is(th, td):nth-child(n+7) { display: none; }');
        w.__state.statistik = [{ aid: '207011', bas: 'C', median: 30000 }];
        w.__renderTabContent('utforska');
        expect(t.classList.contains('utan-jamforelse')).toBe(false);
    });
    it('lönespridningen skrivs med decimalkomma och bär talet för sortering och export', () => {
        const w = rita();
        const celler = [...w.document.querySelectorAll('#rapport-table tbody tr:not(.group-header)')].map(tr => tr.cells[5]).filter(Boolean);
        const tal = celler.filter(td => /\d/.test(td.textContent));
        expect(tal.length).toBeGreaterThan(5);
        for (const td of tal) {
            expect(td.textContent).toMatch(/^\d,\d\d$/);
            expect(td.getAttribute('data-sort-value')).toBe(td.textContent.replace(',', '.'));
        }
    });
    it('BAS-grupperna är hopfällda utom den första; valet står kvar när tabellen ritas om, och en sökning visar träffar i alla', async () => {
        const w = rita();
        const d = w.document;
        const rubriker = () => [...d.querySelectorAll('#rapport-table tbody tr.group-header')];
        const synliga = tr => { const ut = []; for (let n = tr.nextElementSibling; n && !n.classList.contains('group-header'); n = n.nextElementSibling) ut.push(n.style.display !== 'none'); return ut; };
        expect(rubriker().length).toBeGreaterThan(2);
        expect(rubriker().map(tr => tr.classList.contains('collapsed'))).toEqual(rubriker().map((_, i) => i > 0));
        expect(synliga(rubriker()[0]).every(Boolean)).toBe(true);
        expect(synliga(rubriker()[1]).some(Boolean)).toBe(false);
        rubriker()[1].firstElementChild.click();
        await new Promise(r => setTimeout(r, 10));
        w.__renderTabContent('utforska');
        expect(rubriker()[1].classList.contains('collapsed')).toBe(false);
        expect(synliga(rubriker()[1]).every(Boolean)).toBe(true);
        const sok = d.getElementById('search-rapport');
        sok.value = 'kvinna'; sok.dispatchEvent(new w.Event('input', { bubbles: true }));
        expect(rubriker().some(tr => tr.classList.contains('collapsed'))).toBe(false);
        expect(rubriker().every(tr => synliga(tr).some(Boolean))).toBe(true);
        sok.value = ''; sok.dispatchEvent(new w.Event('input', { bubbles: true }));
        expect(rubriker()[2].classList.contains('collapsed')).toBe(true);
    });
    it('PDF-rapportens kopia av en tabell har alla rader synliga, också hopfällda grupper och ansvarsrader', () => {
        const w = rita();
        w.__renderTabContent('matrix');
        for (const id of ['rapport-table', 'matrix-table']) {
            const klon = w.eval(`_exportVisaAllaRader(document.getElementById('${id}').cloneNode(true))`);
            expect([...klon.querySelectorAll('tbody tr')].filter(tr => tr.hidden || tr.style.display === 'none' || tr.classList.contains('collapsed')).length, id).toBe(0);
        }
        expect(w.document.querySelectorAll('#matrix-table tr.la-underrad-ansvar[hidden]').length).toBeGreaterThan(0);   // skärmens tabell är orörd
        expect(las('src/app/60-utskrift.js')).toContain('_exportVisaAllaRader(t.cloneNode(true)).outerHTML');
    });
    it('i arbetsboken är också de hopfällda raderna synliga', () => {
        const w = rita();
        const klon = w.eval("_cloneAndCleanTableForExport('rapport-table')");
        expect([...klon.querySelectorAll('tbody tr')].filter(tr => tr.style.display === 'none').length).toBe(0);
        expect(w.document.querySelectorAll('#rapport-table tbody tr[style*="display: none"]').length).toBeGreaterThan(0);
    });
});

describe('formulären i Löneöversyn', () => {
    const FALT = ['forecast-budget-value', 'forecast-generell-value', 'forecast-min-n', 'forecast-rule-value', 'forecast-closure-pct', 'forecast-market-factor', 'forecast-threshold-pct', 'forecast-rem-pct'];
    it('varje talfält har en etikett ovanför och sin enhet som suffix i samma ruta', () => {
        const w = createAppWindow();
        const d = w.document;
        for (const id of FALT) {
            const falt = d.getElementById(id), rad = falt.closest('.falt-rad'), yttre = falt.closest('.falt');
            expect(rad, id).toBeTruthy();
            expect(yttre.querySelector(`label.falt-etikett[for="${id}"]`), id).toBeTruthy();
            const enhet = rad.querySelector('.falt-enhet, select');
            expect(enhet, id).toBeTruthy();
            expect(falt.getAttribute('style') || '', id).not.toContain('width');   // en bredd för alla, ur stilmallen
        }
    });
    it('också väljarna har sin etikett ovanför, i samma fältkomponent', () => {
        const w = createAppWindow();
        for (const id of ['forecast-round', 'forecast-years', 'forecast-rule-match', 'forecast-rule-dist']) {
            const falt = w.document.getElementById(id).parentElement;
            expect(falt.classList.contains('falt'), id).toBe(true);
            expect(falt.firstElementChild.matches(`label.falt-etikett[for="${id}"]`), id).toBe(true);
            expect(falt.children.length, id).toBe(2);
        }
    });
    it('massregeln går i ordningen vilka, hur mycket, lägg till', () => {
        const w = createAppWindow();
        const grupp = w.document.getElementById('forecast-rule-match').closest('fieldset.falt-grupp');
        const ordning = [...grupp.querySelectorAll('select, input, button')].map(e => e.id);
        expect(ordning).toEqual(['forecast-rule-match', 'forecast-min-n', 'forecast-rule-value', 'forecast-rule-mode', 'forecast-rule-dist', 'forecast-add-criteria']);
    });
    it('målen står i klartext, utan matematiska tecken eller jargong', () => {
        const w = createAppWindow();
        const text = w.document.getElementById('view-loneoversyn').textContent;
        expect(text).toContain('Mål: oförklarat gap högst');
        expect(text).not.toContain('≥ −');
        expect(text).not.toContain('grön-cirklade');
        expect(text).not.toContain('benchmark');
    });
    it('fälten styr prognosens värden', () => {
        const w = createAppWindow();
        w.__loadDemoData();
        w.__renderTabContent('loneoversyn');
        const d = w.document;
        const satt = (id, v) => { const el = d.getElementById(id); el.value = v; el.dispatchEvent(new w.Event('input', { bubbles: true })); el.dispatchEvent(new w.Event('change', { bubbles: true })); };
        satt('forecast-budget-mode', 'kr'); satt('forecast-budget-value', '50000'); satt('forecast-generell-value', '1'); satt('forecast-min-n', '12');
        expect(w.__state.forecast.budget).toEqual({ mode: 'kr', value: 50000 });
        expect(w.__state.forecast.generell).toEqual({ mode: 'pct', value: 1 });
        expect(w.__state.forecast.minGroupN).toBe(12);
    });
});

describe('informationsikonen har ett utförande', () => {
    const FLIKAR = ['dashboard', 'matrix', 'likvardighet', 'struktur', 'prioritering', 'loneoversyn', 'kon', 'lonepolitik', 'utforska', 'dokumentera', 'info'];
    it('varje .info-tip bär linjeikonen «info» och ingen text, också de som ritas av flikarna', () => {
        const w = createAppWindow();
        w.__loadDemoData();
        for (const f of FLIKAR) w.__renderTabContent(f);
        const tips = [...w.document.querySelectorAll('.info-tip')];
        expect(tips.length).toBeGreaterThan(40);
        const fel = tips.filter(t => t.querySelectorAll('svg.ikon-info').length !== 1 || t.textContent.trim() !== '');
        expect(fel.map(t => (t.getAttribute('data-tooltip') || t.outerHTML).slice(0, 50))).toEqual([]);
        expect(w.document.body.innerHTML).not.toContain('ⓘ');
    });
    it('nyckeltalens etiketter har ingen ikon: förklaringen står på hela rutan', () => {
        const w = createAppWindow();
        w.__loadDemoData();
        for (const f of FLIKAR) w.__renderTabContent(f);
        const d = w.document;
        expect([...d.querySelectorAll('.stat-box h3 .info-tip, .slutsats-etikett .info-tip')].length).toBe(0);
        const medTips = [...d.querySelectorAll('.stat-box[data-tooltip]')];
        expect(medTips.length).toBeGreaterThanOrEqual(11);
        expect(medTips.every(r => r.getAttribute('data-tooltip').length > 20)).toBe(true);
        // Texten med tröskeln {k} är ifylld.
        expect(d.getElementById('prio-stat-akut').closest('.stat-box').getAttribute('data-tooltip')).toMatch(/minst 10 personer/);
    });
});

describe('ett bildspråk: linjeikoner, inga bildtecken', () => {
    // Trianglar, dingbats (bock, kryss, varningstecken, stjärna), emoji och pilar.
    const BILDTECKEN = /[\u25B2-\u25BE\u2600-\u27BF\u{1F300}-\u{1FAFF}\u2913\u29C9\u2B06\u2B07\u21BA\u21BB\u2197\u2198\u21C5\u21D2\u24D8\u2139\u2300-\u23FF\u25CB\uFE0F]/u;
    const PIL_SIST = /[\u2190-\u21FF]/;   // inga pilar alls: riktning och följd skrivs med ord
    // Text som går ut i exporterna oförändrad (Excel-celler, rapportens utkastruta, demomärkningen).
    const UNDANTAG = [['22-exporthjalpare.js', 'DEMODATA — syntetisk'], ['41-lika-arbete.js', "bara('✓')"], ['58-rapportmodell.js', 'UTKAST att färdigställa']];
    const filer = [...readdirSync(join(rot, 'src/app')).filter(f => f.endsWith('.js') && f !== '09-lib-speglar.js').map(f => 'src/app/' + f), 'src/index.html', 'src/style.css'];
    it('källan har inga bildtecken utanför kommentarer', () => {
        const fynd = [];
        for (const fil of filer) {
            las(fil).split('\n').forEach((rad, i) => {
                const t = rad.trim();
                if (t.startsWith('//') || t.startsWith('*') || t.startsWith('/*') || t.startsWith('<!--')) return;
                const kod = rad.replace(/\s\/\/ .*$/, '').replace(/\/\*.*?\*\//g, '');
                const m = BILDTECKEN.exec(kod) || PIL_SIST.exec(kod);
                if (!m) return;
                if (UNDANTAG.some(([f, text]) => fil.endsWith(f) && rad.includes(text))) return;
                fynd.push(`${fil}:${i + 1}: ${kod.slice(Math.max(0, m.index - 30), m.index + 20).trim()}`);
            });
        }
        expect(fynd).toEqual([]);
    });
    it('det ritade gränssnittet har inga bildtecken', () => {
        const w = createAppWindow();
        w.__loadDemoData();
        for (const f of ['dashboard', 'bestammelser', 'matrix', 'likvardighet', 'struktur', 'prioritering', 'loneoversyn', 'handlingsplan', 'dokumentera', 'kon', 'lonepolitik', 'utforska', 'info']) w.__renderTabContent(f);
        const fynd = new Set();
        // Varje textnod prövas, också text som står bredvid ett element (en ikon framför en fetstilt mening).
        const gang = w.document.createTreeWalker(w.document.body, w.NodeFilter.SHOW_TEXT);
        for (let n = gang.nextNode(); n; n = gang.nextNode()) {
            if (n.parentElement.closest('script, style, template, .bara-export')) continue;
            if (BILDTECKEN.test(n.nodeValue) || /[\u2190-\u21FF]/.test(n.nodeValue)) fynd.add(n.nodeValue.trim().slice(0, 50));
        }
        w.eval('_autoClearOnInactivity()');
        expect(BILDTECKEN.test(w.document.body.textContent.replace(/\s+/g, ' ').slice(-4000))).toBe(false);
        expect([...fynd]).toEqual([]);
    }, 30000);
    it('filkortets märke och filnamnsraden bär bocken som linjeikon', () => {
        const w = createAppWindow();
        w.__loadDemoData();
        const marke = w.document.querySelector('#upload-cell-data .upload-badge');
        expect(marke.textContent.trim()).toBe('Testdata');   // demots märke; en egen fil märks «Inläst»
        expect(marke.querySelector('svg.ikon-bock')).toBeTruthy();
        const namn = w.document.querySelector('#upload-cell-data .upload-filnamn');
        expect(namn.textContent.trim()).toBe('Demodata');
        expect(namn.querySelector('svg.ikon-bock')).toBeTruthy();
    });
});

describe('svenska ord i vyerna', () => {
    it('rubriker, etiketter, knappar, tabellhuvuden och nyckeltal säger inte «vs», «OLS», «sd» eller «Compa-ratio»', () => {
        const w = createAppWindow();
        w.__loadDemoData();
        w.__state.forecast.budget = { mode: 'pct', value: 2 };
        w.__state.forecast.generell = { mode: 'pct', value: 1 };
        for (const f of ['dashboard', 'matrix', 'likvardighet', 'struktur', 'prioritering', 'loneoversyn', 'kon', 'lonepolitik', 'utforska', 'dokumentera']) w.__renderTabContent(f);
        const synligt = [...w.document.querySelectorAll('h1, h2, h3, h4, option, summary, label, button, th, .slutsats, .stat-box, .insight-box, .dvr-row')].map(el => el.textContent.replace(/\s+/g, ' ').trim());
        const rester = synligt.filter(t => /(^|[\s(])vs\.?([\s)]|$)|\bOLS\b|[\s(]sd[\s):]|Compa-ratio|grön-cirkl|Z ≥/i.test(t));
        expect(rester.map(t => t.slice(0, 80))).toEqual([]);
    }, 30000);
    it('Att göra förklarar korrigeringen i ord', () => {
        const kalla = las('src/app/18-atgardslista.js');
        expect(kalla).not.toContain('BH-FDR');
        expect(kalla).toContain('korrigering för många samtidiga tester');
    });
});

describe('rubriknivåerna hoppar inte', () => {
    const FLIKAR = ['dashboard', 'bestammelser', 'matrix', 'likvardighet', 'struktur', 'prioritering', 'loneoversyn', 'handlingsplan', 'dokumentera', 'kon', 'lonepolitik', 'utforska', 'benchmark', 'info'];
    it('i varje vy följer rubrikerna på varandra utan att hoppa över en nivå (h1 är sidans rubrik)', () => {
        const w = createAppWindow();
        w.__loadDemoData();
        for (const f of FLIKAR) w.__renderTabContent(f);
        const hopp = [];
        for (const vy of w.document.querySelectorAll('.view-panel')) {
            let forra = 1;
            for (const h of vy.querySelectorAll('h1, h2, h3, h4, h5, h6')) {
                const n = Number(h.tagName[1]);
                if (n > forra + 1) hopp.push(`${vy.id}: h${forra} → h${n} «${h.textContent.trim().slice(0, 40)}»`);
                forra = n;
            }
        }
        expect(hopp).toEqual([]);
    }, 30000);
    it('nyckeltalens etiketter är inga rubriker, och ett avsnitts rubrik står inte en gång till i avsnittet', () => {
        const w = createAppWindow();
        w.__loadDemoData();
        for (const f of FLIKAR) w.__renderTabContent(f);
        const d = w.document;
        expect(d.querySelectorAll('.stat-box h1, .stat-box h2, .stat-box h3, .stat-box h4').length).toBe(0);
        expect(d.querySelectorAll('.stat-box .stat-etikett').length).toBeGreaterThanOrEqual(16);
        const dubbla = [];
        for (const a of d.querySelectorAll('details.avsnitt')) {
            const titel = a.querySelector(':scope > summary h2, :scope > summary h3')?.textContent.trim();
            for (const h of a.querySelectorAll('h2:not([hidden]), h3:not([hidden]), h4:not([hidden])')) if (!h.closest('summary') && h.textContent.trim() === titel) dubbla.push(titel);   // en dold rubrik är bara ett namn åt aria-labelledby
        }
        expect(dubbla).toEqual([]);
    }, 30000);
});

describe('«Vad lagras?»', () => {
    it('öppnas som övriga modaler (centrerad) och säger minne, inte RAM', () => {
        const w = createAppWindow();
        w.__loadDemoData();
        w.eval('openDataResidency()');
        expect(w.document.getElementById('data-residency-modal').style.display).toBe('flex');
        expect(w.document.getElementById('data-residency-modal').textContent).not.toMatch(/\bRAM\b/);
    });
});

describe('Om verktyget följer flikmallen', () => {
    it('inledningen är en .flik-intro som på övriga flikar, och fliklisten har bara text', () => {
        const w = createAppWindow();
        const vy = w.document.getElementById('view-info');
        const intro = vy.querySelector('.flik-intro'), kort = vy.querySelector('.card');
        expect(intro.textContent).toContain('Vad gör verktyget');
        expect(intro.compareDocumentPosition(kort) & w.Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();   // inledningen står före kortet
        expect(vy.querySelector('.card-header')).toBeNull();
        const flikar = [...vy.querySelectorAll('.info-section-btn')];
        expect(flikar.length).toBe(6);
        expect(flikar.filter(b => b.querySelector('svg')).length).toBe(0);
        expect(flikar.map(b => b.textContent.trim()).every(t => t.length > 2)).toBe(true);
    });
});

describe('Att göra: en stil på status', () => {
    it('prioriteten bär statusmärket med egen form, och grupperna har den ritade pilen', () => {
        const w = createAppWindow();
        w.__loadDemoData();
        w.eval('renderActionChecklist()');
        const d = w.document;
        const prio = [...d.querySelectorAll('#action-checklist-container .ag-prio')];
        expect(prio.length).toBeGreaterThan(3);
        for (const p of prio) {
            const text = p.textContent.trim();
            expect(text).toMatch(/^(Hög|Medel|Låg)$/);
            expect(p.querySelector(text === 'Hög' ? 'svg.ikon-statusKritisk' : text === 'Medel' ? 'svg.ikon-statusVarning' : 'svg.ikon-bock')).toBeTruthy();
        }
        const grupper = [...d.querySelectorAll('#action-checklist-container details.ag-grupp')];
        expect(grupper.length).toBeGreaterThan(1);
        expect(grupper.every(g => !g.getAttribute('style') && !g.querySelector(':scope > summary').getAttribute('style'))).toBe(true);
        expect(las('src/style.css')).toContain('.ag-grupp > summary::-webkit-details-marker { display: none; }');
    });
});

describe('en låst flik svarar', () => {
    it('är aria-disabled, inte disabled, så att den går att nå och skärmläsaren hör skälet', () => {
        const w = createAppWindow();
        const flik = w.document.getElementById('tab-matrix');
        expect(flik.hasAttribute('disabled')).toBe(false);
        expect(flik.getAttribute('aria-disabled')).toBe('true');
        expect(flik.disabled).toBe(true);                      // egenskapen läser aria-disabled
        expect(flik.title).toMatch(/Ladda upp/);
        expect(las('src/index.html')).not.toMatch(/<button class="nav-item"[^>]*\sdisabled[\s>]/);
    });
    it('ett klick går till Översikt, ger filväljaren fokus och markerar lönefilskortet', () => {
        const w = createAppWindow();
        const d = w.document;
        d.querySelector('.nav-item[data-tab="info"]').click();
        expect(d.querySelector('.nav-item.active').getAttribute('data-tab')).toBe('info');
        d.getElementById('tab-matrix').click();
        expect(d.querySelector('.nav-item.active').getAttribute('data-tab')).toBe('dashboard');
        expect(d.getElementById('view-matrix').style.display).toBe('none');
        expect(d.getElementById('upload-cell-data').classList.contains('visas-nu')).toBe(true);
        expect(d.activeElement.id).toBe('file-input-data');
    });
    it('upplåsning och låsning går genom egenskapen disabled', () => {
        const w = createAppWindow();
        w.__loadDemoData();
        const flik = w.document.getElementById('tab-matrix');
        expect(flik.disabled).toBe(false);
        expect(flik.hasAttribute('aria-disabled')).toBe(false);
        flik.click();
        expect(w.document.querySelector('.nav-item.active').getAttribute('data-tab')).toBe('matrix');
        w.confirm = () => true;
        w.eval('clearAllData()');
        expect(flik.getAttribute('aria-disabled')).toBe('true');
    });
});

describe('typografisk skala', () => {
    const css = las('src/style.css');
    const varden = [...css.matchAll(/font-size:\s*([^;}\s!]+)/g)].map(m => m[1]);
    it('stilmallen har sex steg som variabler', () => {
        const rot = css.slice(css.indexOf(':root {'), css.indexOf('}', css.indexOf(':root {')));
        for (const [namn, v] of [['--fs-xs', '0.78rem'], ['--fs-sm', '0.86rem'], ['--fs-md', '0.95rem'], ['--fs-lg', '1.1rem'], ['--fs-xl', '1.4rem'], ['--fs-nyckeltal', '1.6rem']]) expect(rot).toContain(`${namn}: ${v};`);
    });
    it('de utskrivna storlekarna blir inte fler: nya regler tar ett steg ur skalan', () => {
        const utskrivna = new Set(varden.filter(v => !v.startsWith('var(')));
        // Utanför skalan står bara det som ligger långt från ett steg: de minsta versala etiketterna, de stora talen,
        // utskriftens punktstorlekar och storlekar i em.
        expect(utskrivna.size).toBeLessThanOrEqual(26);   // 26: bilagans rubrik i PDF-rapporten (16pt) bar tidigare ett style-attribut
        expect(varden.filter(v => v.startsWith('var(--fs-')).length).toBeGreaterThanOrEqual(230);
        // Inget utskrivet värde ligger inom 0,05 rem från ett steg: det ska då vara steget.
        const steg = [0.78, 0.86, 0.95, 1.1, 1.4, 1.6];
        const nara = [...utskrivna].filter(v => /rem$/.test(v) && steg.some(s => Math.abs(parseFloat(v) - s) <= 0.0501));
        expect(nara).toEqual([]);
        // Sidans egna style-attribut följer samma regel.
        const iSidan = new Set([...las('src/index.html').matchAll(/font-size:\s*([^;"\s]+)/g)].map(m => m[1]).filter(v => !v.startsWith('var(')));
        expect(iSidan.size).toBeLessThanOrEqual(4);
        expect([...iSidan].filter(v => /rem$/.test(v) && steg.some(s => Math.abs(parseFloat(v) - s) <= 0.0501))).toEqual([]);
    });
});

describe('slutgranskningens fynd', () => {
    const lasIn = async (w, rader) => { papa(w); w.loadStructureFile(csvFil(w, rader)); await vanta(() => w.document.getElementById('data-status').textContent && !/läser|Läser/.test(w.document.getElementById('data-status').textContent)); };
    it('en fil som saknar en obligatorisk kolumn men har läsbara rader läses in, och kolumnmappningen säger vad som saknas', async () => {
        const w = createAppWindow();
        const rader = ['BAS;Månadslön;Kön;AID'];
        for (let i = 0; i < 30; i++) rader.push(`C;${30000 + i * 10};${i % 2 ? 'Man' : 'Kvinna'};207011`);
        await lasIn(w, rader);
        await vanta(() => w.__state.data.length);
        expect(w.__state.data.length).toBe(30);
        expect(w.document.getElementById('tab-matrix').disabled).toBe(false);
        expect(w.document.getElementById('column-map-panel').textContent).toContain('Kolumnmappning behövs');
    });
    it('en mappning som pekar på en rubrik som inte finns i den nya filen räknas inte som funnen', async () => {
        const w = createAppWindow();
        w.__state.columnMap = { bas: 'Finns inte', yrke: 'Finns inte', lon: 'Finns inte', alder: 'Finns inte', kon: 'Finns inte' };
        await lasIn(w, okandaRader());
        const panel = w.document.getElementById('column-map-panel');
        expect(panel.textContent).toContain('Kolumnmappning behövs');
        expect(panel.querySelectorAll('select.colmap-saknas').length).toBeGreaterThanOrEqual(3);   // två rubriker känns igen av sig själva
        expect(w.document.querySelector('#upload-cell-data .upload-badge').textContent).toContain('Kolumnmappning');
    });
    it('en CSV med bara rubrikrad sägs sakna rader, inte kolumner', async () => {
        const w = createAppWindow();
        await lasIn(w, ['BAS;Månadslön;Ålder;Kön;AID']);
        expect(w.document.getElementById('data-status').textContent).toContain('filen har inga rader');
        expect(w.document.querySelector('#upload-cell-data .upload-badge').textContent).toContain('Inga rader');
    });
    it('regressionskortets tolkning har samma precision som huvudtalet', () => {
        const w = createAppWindow();
        w.__loadDemoData();
        w.__renderTabContent('matrix');
        expect(w.document.getElementById('regression-card').querySelector('.reg-verdict')?.closest('.card').textContent.match(/\d,\d\d\s% (mindre|mer)|skillnad på \d+,\d\d\s%/)).toBeNull();
    });
    it('piltangent på en låst flik går till närmaste upplåsta flik i den riktningen, inte runt hela menyn', () => {
        const w = createAppWindow();
        const d = w.document, last = d.getElementById('tab-matrix');
        const flikar = [...d.querySelectorAll('.nav-item')].filter(t => !t.hidden);
        const upplasta = flikar.filter(t => !t.disabled);
        last.focus();
        last.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
        const fore = flikar.slice(0, flikar.indexOf(last)).filter(t => !t.disabled).pop();
        expect(d.querySelector('.nav-item.active')).toBe(fore || upplasta[upplasta.length - 1]);
    });
    it('Löneöversyns individanalys säger jämförelsevärde, inte benchmark, och utskriften visar ansvarsraderna', () => {
        expect(las('src/app/36-loneoversyn.js').replace(/^\s*\/\/.*$/gm, '')).not.toMatch(/benchmark/i);
        expect(las('src/style.css')).toContain('.la-underrad-ansvar[hidden] { display: table-row !important; }');
    });
});

describe('procenttal i flikarna har en decimal', () => {
    it('ingen flik ritar ett procenttal med två decimaler (PO-påslaget och självdiagnostiken undantagna)', () => {
        const w = createAppWindow();
        w.__loadDemoData();
        w.__state.forecast.budget = { mode: 'pct', value: 2 };
        w.__state.forecast.generell = { mode: 'pct', value: 1 };
        for (const f of ['dashboard', 'matrix', 'likvardighet', 'struktur', 'prioritering', 'loneoversyn', 'kon', 'lonepolitik', 'utforska']) w.__renderTabContent(f);
        const fynd = new Set();
        for (const el of w.document.querySelectorAll('[id^="view-"] *')) {
            if (el.children.length || el.closest('script, style, svg, code, pre, .info-tip, .bara-export, [data-export-text], #diagnostic-results')) continue;
            if (/PO\b/.test(el.textContent)) continue;
            if (/[+\u2212-]?\d+,\d\d\s%/.test(el.textContent)) fynd.add(el.textContent.trim().slice(0, 50));
        }
        expect([...fynd]).toEqual([]);
    }, 30000);
});

describe('Krav mot lön med många yrkesgrupper', () => {
    it('grupper i samma BAS-intervall med nästan samma median flyttas isär i sidled; ensamma grupper står i mitten', () => {
        const w = createAppWindow();
        const rader = [];
        const grupp = (aid, bas, median, kvAndel) => { for (let i = 0; i < 30; i++) rader.push({ bas, yrke: `${aid} Yrke ${aid}`, aid: String(aid), kon: i < 30 * kvAndel ? 'kvinna' : 'man', lon: median + (i % 5 - 2) * 100, alder: 30 + i }); };
        grupp(100001, 'B', 30000, 0.8); grupp(100002, 'B', 30050, 0.5); grupp(100003, 'B', 30100, 0.2); grupp(100004, 'B', 36000, 0.5);
        grupp(100005, 'C', 34000, 0.5); grupp(100006, 'D', 42000, 0.5);
        w.__d = rader;
        const f = w.eval('_lvKravFigur(_lvKravGrupper(window.__d, { kvinnoThr: 60, k: 10 }))');
        const punkter = f.lager.filter(l => l.marke === 'punkt').flatMap(l => l.data);
        const iB = punkter.filter(p => p.bas === 'B' && p.y < 31000).map(p => p.forskjutning || 0).sort((a, b) => a - b);
        expect(new Set(iB).size).toBe(3);                                   // tre nära varandra: tre filer
        expect(iB.every(v => Math.abs(v) <= 0.36)).toBe(true);              // inom intervallets bredd
        for (const p of punkter.filter(q => q.bas !== 'B' || q.y > 31000)) expect(p.forskjutning).toBeUndefined();
    });
});

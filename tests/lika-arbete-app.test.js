// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
// Lika arbete i appen: flikens ordning, Var uppstår löneskillnaden, stabiliteten, kvartilerna, ansvarskoden och
// yrkesgruppstabellen.
import { describe, it, expect } from 'vitest';
import { createAppWindow } from './helpers/app-harness.js';

describe('Lika arbete och filrutorna: ordning och kompakta rutor — Lika arbete', () => {
    const efter = (a, b) => !!(a.compareDocumentPosition(b) & 4);   // b ligger efter a
    it('Lika arbete visar slutsatser och yrkesgrupperna först, sedan personer att granska, per BAS, könsfördelningen och sist regressionen', () => {
        const w = createAppWindow();
        w.__loadDemoData();
        w.document.querySelector('.nav-item[data-tab="matrix"]').click();
        const d = w.document;
        // Slutsatserna och yrkesgrupperna (trattdiagrammet och sedan tabellen) står överst; personer att granska och metoden sist.
        const [slut, tratt, yrken, pag, metod] = ['la-slutsatser', 'chart-la-tratt', 'matrix-table', 'personer-att-granska', 'avsnitt-la-metod'].map(id => d.getElementById(id));
        expect(efter(slut, tratt)).toBe(true);
        expect(efter(tratt, yrken)).toBe(true);
        expect(efter(yrken, pag)).toBe(true);
        expect(efter(pag, metod)).toBe(true);
        expect(d.getElementById('la-topp').nextElementSibling.id).toBe('avsnitt-la-yrkesgrupper');   // huvudbilden direkt under nyckeltalen
        for (const el of [yrken, metod]) expect(el.closest('.view-panel').style.display).toBe('block');
        expect(pag.hidden).toBe(false);
        // BAS-skevheten, könsfördelningen och regressionen står i Lönestruktur, i den ordningen efter strukturavsnitten.
        w.document.querySelector('.nav-item[data-tab="struktur"]').click();
        const [perBas, kon, reg] = ['la-oversikt', 'avsnitt-ls-kon', 'regression-card'].map(id => d.getElementById(id));
        expect(efter(perBas, kon) && efter(kon, reg)).toBe(true);
        expect(d.getElementById('avsnitt-ls-bas').contains(perBas)).toBe(true);
        for (const el of [perBas, reg]) expect(el.closest('.view-panel').style.display).toBe('block');
        // Skillnaden per BAS-intervall visas en gång: tabellen och bilden i exporten är dolda på skärmen.
        expect(d.getElementById('la-bas-exportkopia').hidden).toBe(true);
        expect(d.getElementById('la-bas-exportkopia').contains(d.getElementById('paygap-table'))).toBe(true);
        w.document.querySelector('.nav-item[data-tab="matrix"]').click();
        expect(d.querySelector('.view-panel[style*="block"] .flik-intro').textContent).toContain('Samma jobb, olika lön');
    });
    it('Lika arbete, yrkesgrupperna: förklaringen, sedan överblicksdiagrammet och sist tabellen', () => {
        const w = createAppWindow();
        w.__loadDemoData();
        w.document.querySelector('.nav-item[data-tab="matrix"]').click();
        const d = w.document, avsnitt = d.getElementById('avsnitt-la-yrkesgrupper');
        const kort = d.getElementById('la-tratt-kort'), tabell = d.getElementById('matrix-table');
        // Diagramkortet står direkt efter förklaringstexten och direkt före tabellens verktygsrad och behållare, i samma avsnitt.
        expect(avsnitt.contains(kort) && avsnitt.contains(tabell)).toBe(true);
        expect(kort.previousElementSibling.classList.contains('card-header')).toBe(true);
        expect(kort.nextElementSibling).toBe(tabell._verktygsrad);
        expect(tabell._verktygsrad.nextElementSibling).toBe(tabell.closest('.table-container'));
        // Diagrammet och tabellen är ritade: ordningen påverkar inte vad som visas.
        expect(kort.hidden).toBe(false);
        expect(d.getElementById('chart-la-tratt')._figur).toBeTruthy();
        expect(tabell.querySelectorAll('tbody tr').length).toBeGreaterThan(0);
    });
});

describe('Var uppstår löneskillnaden?', () => {
    it('ritas med demodata: tre delar, demomärkning, noten om rangordning', () => {
        const w = createAppWindow();
        w.__loadDemoData(); w.__renderTabContent('struktur');
        const host = w.document.getElementById('gap-uppdelning');
        expect(host.hidden).toBe(false);
        expect(host.querySelectorAll('[data-gu-del]').length).toBe(3);
        expect(host.textContent).toContain('DEMODATA');
        expect(host.textContent).toContain('kan därför skilja sig från de flaggade AID-etiketterna i Lika arbete');
        expect(host.querySelector('[data-go-to-tab="struktur"]')).not.toBeNull();
        expect(host.textContent).not.toMatch(/§|3 kap\./);
    });
    it('Rensa all data döljer och tömmer kortet', () => {
        const w = createAppWindow();
        w.__loadDemoData();
        w.__clearAllData();
        const host = w.document.getElementById('gap-uppdelning');
        expect(host.hidden).toBe(true);
        expect(w.document.getElementById('gap-uppdelning-innehall').textContent.trim()).toBe('');
    });
    it('ett kön under k i urvalet (i exportläget): "För få personer", inga belopp', () => {
        const w = createAppWindow();
        w.__loadDemoData();
        w.__state.data = w.__state.data.filter((r, i) => r.kon.includes('kvinna') || i % 50 === 0).slice(0, 200);
        w.__state.kLage = 'export';
        w.eval('ritaGapUppdelning()');
        const t = w.document.getElementById('gap-uppdelning-innehall').textContent;
        expect(t).toContain('För få personer för att dela upp skillnaden');
        expect(w.document.querySelectorAll('#gap-uppdelning [data-gu-del]').length).toBe(0);
    });
    it('noten om små grupper står bara när tröskeln är större än 1 (skärmen har tröskeln 1, ADR-51)', () => {
        const w = createAppWindow();
        w.__loadDemoData();
        const not = () => w.document.getElementById('gap-uppdelning-innehall').textContent.replace(/\s+/g, ' ');
        w.__state.kLage = 'skarm';
        w.eval('ritaGapUppdelning()');
        expect(w.eval('kTroskel()')).toBe(1);
        expect(not()).not.toMatch(/färre än 1 person/);
        expect(not()).not.toMatch(/namnges inte/);
        w.__state.kLage = 'export';
        w.eval('ritaGapUppdelning()');
        expect(not()).toMatch(new RegExp(`Grupper där ett kön har färre än ${w.eval('kTroskel()')} personer räknas samman med andra grupper och namnges inte\\.`));
    });
    it('AID-namn kodas', () => {
        const w = createAppWindow();
        w.__loadDemoData();
        w.__state.data = w.__state.data.map(r => ({ ...r, aid: '<b>&"x' }));
        w.eval('ritaGapUppdelning()');
        expect(w.document.querySelector('#gap-uppdelning b')).toBeNull();
    });
});

describe('stabilitet i Lika arbete', () => {
    it('varje flaggad rad har märkningen, noten förklarar, ingen §', () => {
        const w = createAppWindow();
        w.__loadDemoData();
        w.document.querySelector('.nav-item[data-tab="matrix"]').click();
        const tabell = w.document.getElementById('matrix-table');
        const flaggade = [...tabell.querySelectorAll('tbody tr')].filter(tr => tr.textContent.includes('Värt att granska'));
        expect(flaggade.length).toBeGreaterThan(0);
        for (const tr of flaggade) expect(tr.querySelector('.la-stabilitet')?.textContent).toMatch(/^(Skör|Stabil|Kan inte prövas)/);
        expect(tabell.textContent).toContain('Skör betyder att skillnaden kan hamna under 3 % (statusens storleksgräns)');
        expect(tabell.textContent).toContain('Den är inte en bedömning.');
        // Exporten läser cellens text: status och märkning ska inte flyta ihop.
        for (const tr of flaggade) expect(w._tableCellText ? w._tableCellText(tr.cells[tr.cells.length - 1]) : tr.textContent).not.toMatch(/\)(Skör|Stabil|Kan)/);
        expect(JSON.stringify(w.__tableToMatrix('matrix-table'))).not.toMatch(/%\)(Skör|Stabil|Kan)/);
        expect(tabell.textContent).not.toMatch(/§|3 kap\./);
    });
});

describe('kvartiler utan enskilda löner', () => {
    it('Struktur visar inte organisationens lägsta eller högsta lön', () => {
        const w = createAppWindow();
        const rader = [];
        for (let i = 0; i < 40; i++) rader.push({ bas: 'ABCD'[i % 4], kon: i % 2 ? 'man' : 'kvinna', lon: 30000 + i * 100, alder: 40, yrke: '100 Yrke', aid: '100', yrkeLabel: 'Yrke', enhet: '' });
        rader.push({ bas: 'A', kon: 'kvinna', lon: 11111, alder: 30, yrke: '100 Yrke', aid: '100', yrkeLabel: 'Yrke', enhet: '' });
        rader.push({ bas: 'D', kon: 'man', lon: 99999, alder: 60, yrke: '100 Yrke', aid: '100', yrkeLabel: 'Yrke', enhet: '' });
        w.__state.data = rader;
        w.eval('populateSelects(); unlockTabs();');
        w.__renderTabContent('struktur');
        const t = w.document.getElementById('struktur-eu').textContent.replace(/(\d)[\s\u00a0\u202f](?=\d)/g, '$1');
        expect(t).toContain('upp till');
        expect(t).not.toContain('11111');
        expect(t).not.toContain('99999');
    });
});

// ===================================================================================
// ADR-65: Var uppstår löneskillnaden med valbara förklaringsvariabler. Valet, tangentbordet och ARIA, texterna,
// konfigurationsfilen, Rensa all data, rapportunderlaget och metodbilagan.
// ===================================================================================
describe('Var uppstår löneskillnaden: valbara förklaringsvariabler (ADR-65)', () => {
    const demo = () => { const w = createAppWindow(); w.__loadDemoData(); w.document.querySelector('.nav-item[data-tab="struktur"]').click(); return w; };
    const kort = w => w.document.getElementById('gap-uppdelning');
    const rutor = w => [...kort(w).querySelectorAll('.gu-val input[data-gu-var]')];
    const valda = w => rutor(w).filter(r => r.checked).map(r => r.getAttribute('data-gu-var'));
    const kryssa = (w, v) => { const r = kort(w).querySelector(`input[data-gu-var="${v}"]`); r.checked = !r.checked; r.dispatchEvent(new w.Event('change', { bubbles: true })); };
    const delnamn = w => [...kort(w).querySelectorAll('[data-gu-del] .gu-rubrik strong')].map(e => e.textContent);
    const u = w => w.eval('gapUppdelning(getData(), { k: kTroskel(), variabler: gapVariabler() })');
    const bevaka = w => { w.eval(`window.__fel = []; { const rf = rapporteraFel; rapporteraFel = function (plats, e) { window.__fel.push(plats + ': ' + (e && e.message)); return rf(plats, e); }; }
        { const ce = console.error; console.error = function (...a) { window.__fel.push(a.join(' ')); return ce.apply(console, a); }; }`); return w; };

    it('standardvalet: BAS och AID i den ordningen, dagens delar och texter, ingen återställning', () => {
        const w = demo();
        expect(kort(w).querySelector('.gu-val legend').textContent).toBe('Förklara med:');
        expect(valda(w)).toEqual(['bas', 'aid']);
        expect(rutor(w).map(r => r.getAttribute('data-gu-var'))).toEqual(['bas', 'aid', 'sektor', 'aidniva', 'alder']);
        expect(delnamn(w)).toEqual(['A. BAS-fördelning', 'B. AID inom BAS', 'C. Oförklarat: lön inom samma AID och BAS']);
        const text = [...kort(w).querySelectorAll('.gu-text')].map(p => p.textContent);
        expect(text[0]).toContain('Kvinnor och män är olika fördelade över BAS-intervallen. Hör till karriärvägar och rekrytering');
        expect(text[1]).toContain('Kvinnor och män har olika AID inom samma BAS. Kan kräva en lönesatsning på AID-etiketten');
        expect(text[2]).toContain('räknas i stället till delarna ovan. Pröva lika arbete');
        expect(kort(w).querySelector('[data-gu-standard]')).toBeNull();
        expect(kort(w).textContent).toContain('Ordningen påverkar delarna: den första variabeln får det den förklarar ensam');
        expect(w.__state.gapUppdelning).toBeNull();
    });
    it('valet är hopfällt bakom Ändra uppdelning, och står kvar utfällt när kortet ritas om', async () => {
        const w = demo();
        expect(w.document.getElementById('avsnitt-ov-gap').open).toBe(true);
        const andra = () => kort(w).querySelector('.gu-andra');
        expect(andra().open).toBe(false);
        andra().open = true;
        await new Promise(r => setTimeout(r, 0));   // toggle-händelsen köas
        kryssa(w, 'alder');
        expect(valda(w)).toEqual(['bas', 'aid', 'alder']);
        expect(andra().open).toBe(true);
    });
    it('röktest: AID bort och åldersgrupp till; delarna summerar till hela skillnaden, inga fel', () => {
        const w = bevaka(demo());
        kryssa(w, 'aid');
        expect(valda(w)).toEqual(['bas']);
        expect(delnamn(w)).toEqual(['A. BAS-fördelning', 'B. Oförklarat: lön inom samma BAS']);
        kryssa(w, 'alder');
        expect(valda(w)).toEqual(['bas', 'alder']);
        expect(JSON.parse(JSON.stringify(w.__state.gapUppdelning))).toEqual({ variabler: ['bas', 'alder'] });
        expect(delnamn(w)).toEqual(['A. BAS-fördelning', 'B. Åldersgrupp inom BAS', 'C. Oförklarat: lön inom samma åldersgrupp och BAS']);
        const r = u(w);
        expect(Math.abs(r.delar.A + r.delar.B + r.delar.C - r.gap)).toBeLessThan(1e-6);
        // Trappan har lika många staplar som delar, och fokus står kvar på rutan.
        const f = w.document.getElementById('chart-gap-uppdelning')._figur;
        expect(f.x.ordning).toEqual(['Hela skillnaden', 'A. BAS-fördelning', 'B. Åldersgrupp inom BAS', 'C. Oförklarat: lön inom samma åldersgrupp och BAS']);
        expect(f.beskrivning).toContain('sedan tre delar som tillsammans blir hela skillnaden, en i taget från hela skillnaden mot noll: BAS-fördelning, åldersgrupp inom BAS och lön inom samma åldersgrupp och BAS.');
        expect(w.document.activeElement.getAttribute('data-gu-var')).toBe('alder');
        // Länken för åldersgruppens del går till Ålder & karriär.
        expect(kort(w).querySelector('[data-gu-del="B"] [data-go-to-tab="kon"]')).not.toBeNull();
        expect(w.eval('window.__fel')).toEqual([]);
    });
    it('upp och ner: knapparna har namn, är avstängda i ändarna och behåller fokus', () => {
        const w = demo();
        kryssa(w, 'alder');
        expect(valda(w)).toEqual(['bas', 'aid', 'alder']);
        const knapp = (v, s) => kort(w).querySelector(`[data-gu-rad="${v}"] [data-gu-flytta="${s}"]`);
        expect(knapp('bas', -1).disabled).toBe(true);
        expect(knapp('alder', 1).disabled).toBe(true);
        expect(knapp('alder', -1).getAttribute('aria-label')).toBe('Flytta upp: Åldersgrupp');
        expect(knapp('aid', 1).getAttribute('aria-label')).toBe('Flytta ned: AID');
        knapp('alder', -1).click();
        expect(valda(w)).toEqual(['bas', 'alder', 'aid']);
        expect(w.document.activeElement).toBe(knapp('alder', -1));
        knapp('alder', -1).click();
        expect(valda(w)).toEqual(['alder', 'bas', 'aid']);
        // Knappen är nu avstängd: fokus går till rutan för samma variabel.
        expect(w.document.activeElement.getAttribute('data-gu-var')).toBe('alder');
        expect(delnamn(w)).toEqual(['A. Åldersfördelning', 'B. BAS inom åldersgrupp', 'C. AID inom BAS och åldersgrupp', 'D. Oförklarat: lön inom samma AID, BAS och åldersgrupp']);
        expect(kort(w).querySelector('.gu-val-lista').getAttribute('aria-describedby')).toBe('gu-val-hjalp');
        // Återställ standard.
        kort(w).querySelector('[data-gu-standard]').click();
        expect(valda(w)).toEqual(['bas', 'aid']);
        expect(w.__state.gapUppdelning).toBeNull();
    });
    it('1–4 variabler: den sista valda kan inte kryssas ur, och vid fyra kan ingen fler kryssas i', () => {
        const w = demo();
        kryssa(w, 'aid');
        expect(kort(w).querySelector('input[data-gu-var="bas"]').disabled).toBe(true);
        kryssa(w, 'sektor'); kryssa(w, 'aidniva'); kryssa(w, 'alder');
        expect(valda(w)).toEqual(['bas', 'sektor', 'aidniva', 'alder']);
        expect(kort(w).querySelector('input[data-gu-var="aid"]').disabled).toBe(true);
        expect(kort(w).querySelectorAll('[data-gu-del]')).toHaveLength(5);
    });
    it('AID-nivåerna: en flytt som skulle ställa en finare nivå före en grövre är avstängd', () => {
        const w = demo();
        kryssa(w, 'sektor');
        expect(valda(w)).toEqual(['bas', 'sektor', 'aid']);
        expect(kort(w).querySelector('[data-gu-rad="aid"] [data-gu-flytta="-1"]').disabled).toBe(true);
        expect(kort(w).querySelector('[data-gu-rad="sektor"] [data-gu-flytta="1"]').disabled).toBe(true);
        expect(kort(w).querySelector('[data-gu-rad="sektor"] [data-gu-flytta="-1"]').disabled).toBe(false);
    });
    it('utan ålder i lönefilen erbjuds inte åldersgrupp, och ett sparat val med åldersgrupp räknas utan den', () => {
        const w = createAppWindow();
        w.__loadDemoData();
        w.__state.data = w.__state.data.map(r => ({ ...r, alder: 0 }));
        w.__state.gapUppdelning = { variabler: ['bas', 'alder', 'aid'] };
        w.eval('invalidateStatCaches(); ritaGapUppdelning()');
        expect(rutor(w).map(r => r.getAttribute('data-gu-var'))).not.toContain('alder');
        expect(valda(w)).toEqual(['bas', 'aid']);
        expect(delnamn(w)).toEqual(['A. BAS-fördelning', 'B. AID inom BAS', 'C. Oförklarat: lön inom samma AID och BAS']);
    });
    it('konfigurationsfilen fram och tillbaka; en äldre fil utan fältet ger standard; ogiltigt ger varning', () => {
        const w = demo();
        kryssa(w, 'alder');
        const cfg = JSON.parse(JSON.stringify(w.__buildConfigSnapshot()));
        expect(cfg.gapUppdelning).toEqual({ variabler: ['bas', 'aid', 'alder'] });
        const w2 = createAppWindow(); w2.__loadDemoData();
        w2.__cfg = cfg; w2.eval('window.__svar = applyConfigSnapshot(window.__cfg)');
        expect(JSON.parse(JSON.stringify(w2.__state.gapUppdelning))).toEqual({ variabler: ['bas', 'aid', 'alder'] });
        // Standardvalet sparas som null.
        expect(JSON.parse(JSON.stringify(demo().__buildConfigSnapshot())).gapUppdelning).toBeNull();
        // En fil från v2 (utan fältet) ger standard, också när ett val var gjort.
        const aldre = { ...cfg }; delete aldre.gapUppdelning;
        w2.__cfg = aldre; w2.eval('window.__svar = applyConfigSnapshot(window.__cfg)');
        expect(w2.__state.gapUppdelning).toBeNull();
        expect(w2.eval('window.__svar.varningar').join(' ')).not.toMatch(/Uppdelningen/);
        w2.__cfg = { ...cfg, gapUppdelning: { variabler: 'fel' } }; w2.eval('window.__svar = applyConfigSnapshot(window.__cfg)');
        expect(w2.__state.gapUppdelning).toBeNull();
        expect(w2.eval('window.__svar.varningar').join(' ')).toContain('Uppdelningens variabler gick inte att läsa');
    });
    it('Rensa all data nollställer valet', () => {
        const w = demo();
        kryssa(w, 'alder');
        expect(w.__state.gapUppdelning).not.toBeNull();
        w.__clearAllData();
        expect(w.__state.gapUppdelning).toBeNull();
    });
    it('rapportunderlaget och metodbilagan följer valet och nämner variablerna; standardvalet ger dagens text', () => {
        const w = demo();
        const block = () => w.__rapportunderlagBlock().find(b => b.id === 'uppdelning');
        const metod = () => w.__methodAppendixData().map(r => r.join(': ')).join('\n');
        const std = block();
        expect(std.stycken.join(' ')).toMatch(/på att kvinnor och män är olika fördelade över BAS, .* på olika AID inom samma BAS och .* på löneskillnader inom samma AID och BAS\./);
        expect(std.stycken.join(' ')).not.toContain('Uppdelningen förklarar med');
        expect(metod()).not.toContain('Var uppstår löneskillnaden');
        kryssa(w, 'aid'); kryssa(w, 'alder');
        const b = block();
        expect(b.stycken.join(' ')).toContain('Uppdelningen förklarar med variablerna BAS och åldersgrupp, i den ordningen.');
        expect(b.stycken.join(' ')).toMatch(/på att kvinnor och män är olika fördelade över BAS, .* på olika ålder inom samma BAS och .* på löneskillnader inom samma åldersgrupp och BAS\./);
        expect(b.tabell.rader.map(r => r[0])).toEqual(['BAS-fördelning', 'Åldersgrupp inom BAS', 'Oförklarat: lön inom samma åldersgrupp och BAS', 'Totalt']);
        expect(metod()).toContain('Var uppstår löneskillnaden (variabler): Skillnaden i medellön delas med BAS och åldersgrupp, i den ordningen');
        // Word-utkastet (rapportmodellen) bär metodbilagan.
        expect(w.__docDraftHtml()).toContain('Skillnaden i medellön delas med BAS och åldersgrupp');
    });
    it('fungerar vid 375 punkter: listan bryter rader och har inga fasta bredder', async () => {
        // jsdom ritar ingen layout; här prövas att reglerna finns (det riktiga måttet tas i webbläsarröktestet).
        const { readFileSync } = await import('node:fs');
        const css = readFileSync(new URL('../src/style.css', import.meta.url), 'utf8');
        expect(css).toMatch(/\.gu-val-lista \.urval-rad\s*\{[^}]*flex-wrap:\s*wrap/);
        expect(css).toMatch(/\.gu-val\s*\{[^}]*min-width:\s*0/);
    });
});

describe('ansvarskod i Lika arbete', () => {
    // Ett yrke där männen oftare har ledningsansvar och högre lön, och ett yrke utan ansvarskoder.
    const bygg = (medAnsvar = true) => {
        const rader = [];
        const rad = (aid, kon, lon, alder, grupp, koder) => ({ aid, yrke: aid + ' Förskollärare', yrkeLabel: 'Förskollärare', bas: alder % 2 ? 'B' : 'C',
            kon, lon, alder, ...(medAnsvar ? { ansvarskoder: koder, ansvarsgrupp: grupp } : {}) });
        for (let i = 0; i < 14; i++) rader.push(rad('402010', 'kvinna', 30000 + i * 40, 30 + i, 'inget', []));
        for (let i = 0; i < 12; i++) rader.push(rad('402010', 'man', 30400 + i * 40, 31 + i, 'inget', []));
        for (let i = 0; i < 11; i++) rader.push(rad('402010', 'man', 36000 + i * 40, 35 + i, 'ledning', ['C']));
        for (let i = 0; i < 20; i++) rader.push(rad('207011', i % 2 ? 'man' : 'kvinna', 28000 + i * 30, 25 + i, 'inget', []));
        return rader;
    };
    const oppna = (medAnsvar = true) => {
        const w = createAppWindow();
        w.__state.data = bygg(medAnsvar);
        w.eval('populateSelects(); unlockTabs();');
        w.__renderTabContent('matrix'); w.__renderTabContent('struktur');
        return w;
    };
    it('yrket får en underrad per ansvarsgrupp och raden Utan ledningsansvar', () => {
        const w = oppna();
        const rader = [...w.document.querySelectorAll('#matrix-table tbody tr')];
        const i = rader.findIndex(tr => /402010/.test(tr.textContent) && !tr.classList.contains('la-underrad'));
        const under = rader.slice(i + 1).filter((tr, j, a) => a.slice(0, j + 1).every(t => t.classList.contains('la-underrad')));
        expect(under.map(tr => tr.textContent)).toEqual([expect.stringMatching(/Ledningsansvar/), expect.stringMatching(/Inget särskilt ansvar|Utan ansvar/),
            expect.stringMatching(/Utan ledningsansvar/)]);
        expect(under[0].textContent).toMatch(/Gruppens median/);
        expect(under[2].textContent).toMatch(/9[89],\d\s%/);
        // yrket utan ledningsansvar hos någon får inga underrader
        const j = rader.findIndex(tr => /207011/.test(tr.textContent));
        expect(rader[j + 1]?.classList.contains('la-underrad') ?? false).toBe(false);
    });
    it('underraderna följer sitt yrke när tabellen sorteras', () => {
        const w = oppna();
        const th = w.document.querySelectorAll('#matrix-table thead th');
        for (const klick of [0, 0, 1]) {
            th[klick].click();
            const rader = [...w.document.querySelectorAll('#matrix-table tbody tr')];
            rader.forEach((tr, i) => {
                if (tr.classList.contains('la-underrad')) expect(rader[i - 1].classList.contains('la-underrad') || /402010/.test(rader[i - 1].textContent)).toBe(true);
            });
        }
    });
    it('utan ansvarskolumn syns inga underrader', () => {
        const w = oppna(false);
        expect(w.document.querySelectorAll('#matrix-table .la-underrad').length).toBe(0);
    });
    it('regressionen: ansvarssteget redovisas separat och huvudtalet är oförändrat', () => {
        const med = oppna(true).eval('runOLSRegression()');
        const utan = oppna(false).eval('runOLSRegression()');
        expect(med.konPct).toBeCloseTo(utan.konPct, 10);
        expect(med.explainedShare).toBeCloseTo(utan.explainedShare, 10);
        expect(med.sequential.map(s => s.name)).toEqual(utan.sequential.map(s => s.name));
        expect(utan.ansvarSteg).toBeNull();
        expect(med.ansvarSteg).toMatchObject({ status: 'ok', name: '+ Ansvar' });
        expect(Math.abs(med.ansvarSteg.gapPct)).toBeLessThan(Math.abs(med.sequential.at(-1).gapPct));
    });
    it('den sekventiella dekomponeringen får steget + Ansvar sist när raderna har ansvarsgrupp', () => {
        const w = oppna(true);
        const steg = w.eval(`(() => { const d = getData(); return stegvisGap(d, 40, ['B', 'C'], { golv: statGolv() }).map(s => s.name); })()`);
        expect(steg).toEqual(['Endast kön', '+ BAS-intervall', '+ Ålder', '+ Yrkesgrupp', '+ Ansvar']);
    });
    it('kortet visar ansvaret på en egen rad under budgeten, inte i den', () => {
        const w = oppna(true);
        const kort = w.document.getElementById('regression-card').textContent.replace(/\s+/g, ' ');
        expect(kort).toMatch(/Ansvar \(ledningsansvar, särskilt uppdrag\) förklarar ytterligare [\d,]+ procentenheter/);
        expect(kort).toMatch(/Huvudtalet ovan räknar inte bort ansvaret/);
        expect(w.document.querySelector('#regression-card .reg-budget-legend').textContent).not.toMatch(/ansvar/i);
        const utan = oppna(false).document.getElementById('regression-card').textContent;
        expect(utan).not.toMatch(/förklarar ytterligare/);
    });
});

describe('Lika arbete och rapportunderlaget flaggar samma yrken', () => {
    it('EU-tabellens "Värt att granska" är exakt likaArbeteGrupper(...).flaggad vid k = 1 (skärmen maskerar inget, ADR-51)', () => {
        const w = createAppWindow();
        w.__loadDemoData();
        w.document.querySelector('.nav-item[data-tab="matrix"]').click();
        const iTabell = [...w.document.querySelectorAll('#matrix-table tbody tr')]
            .filter(tr => tr.textContent.includes('Värt att granska'))
            .map(tr => tr._euRow.yrke).sort();
        const iLib = w.__ruLikaArbeteGrupper(w.__getData(), { k: 1 }).grupper
            .filter(g => g.flaggad).map(g => g.yrke).sort();
        expect(iLib.length).toBeGreaterThan(0);
        expect(iTabell).toEqual(iLib);
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
            expect(synlig(m)).toMatch(/^(Värt att granska|Följ upp|Balanserat|Går ej att bedöma|ett kön n < \d+)$/);
            expect(m.title).toMatch(/Skillnaden är|Könsuppdelningen|Går ej att bedöma: ett kön har färre än/);
        }
        const granska = marken.find(m => synlig(m) === 'Värt att granska');
        expect(granska.textContent.replace(/\s+/g, ' ').trim()).toBe('Värt att granska (säkerställd skillnad på minst 3 %)');
        expect(granska.title).toMatch(/statistiskt säkerställd.*minst 3 %/);
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
        expect(f('Stabil: minst 3 % även utan 2 personer')).toEqual(['Stabil även utan 2 personer', 'Stabil: minst 3 % även utan 2 personer']);
        expect(f('Skör: kan bli 4,6 % om 1 person tas bort (prövat bara på män)')).toEqual(['Skör: 4,6 % om 1 person tas bort', 'Skör: kan bli 4,6 % om 1 person tas bort (prövat bara på män)']);
        expect(f('Stabil: minst 3 % även utan 1 person, fler kunde inte prövas')).toEqual(['Stabil även utan 1 person', 'Stabil: minst 3 % även utan 1 person, fler kunde inte prövas']);
        expect(f('Kan inte prövas: båda könen har exakt 10 personer')).toEqual(['Kan inte prövas', 'Kan inte prövas: båda könen har exakt 10 personer']);
    });
    it('ansvarsraderna och raden Utan ledningsansvar är hopfällda tills pilen på yrkesraden fäller ut dem', () => {
        const w = rita();
        const d = w.document;
        const ansvar = [...d.querySelectorAll('#matrix-table tr.la-underrad-ansvar')];
        expect(ansvar.length).toBeGreaterThan(2);
        expect(ansvar.every(tr => tr.hidden)).toBe(true);
        const utan = [...d.querySelectorAll('#matrix-table tr.la-underrad:not(.la-underrad-ansvar)')];
        expect(utan.length).toBeGreaterThan(0);
        expect(utan.every(tr => tr.hidden && /Utan ledningsansvar/.test(tr.textContent))).toBe(true);
        // Pilen på ett yrke med raden Utan ledningsansvar: den fälls ut och ihop med ansvarsgrupperna.
        let yrkesrad = utan[0]; while (yrkesrad.classList.contains('la-underrad')) yrkesrad = yrkesrad.previousElementSibling;
        const pil = yrkesrad.querySelector('.la-falla');
        expect(pil.getAttribute('aria-expanded')).toBe('false');
        const egna = []; for (let tr = yrkesrad.nextElementSibling; tr && tr.classList.contains('la-underrad'); tr = tr.nextElementSibling) egna.push(tr);
        expect(egna.some(tr => tr.classList.contains('la-underrad-ansvar'))).toBe(true);
        expect(egna).toContain(utan[0]);
        pil.click();
        expect(pil.getAttribute('aria-expanded')).toBe('true');
        expect(egna.every(tr => !tr.hidden)).toBe(true);
        expect(w.eval('diagramMarkering()')).toBeNull();   // pilen markerar inte raden
        pil.click();
        expect(egna.every(tr => tr.hidden)).toBe(true);
    });
});

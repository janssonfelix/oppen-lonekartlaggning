/**
 * Röktest (jsdom): Rensning, demoläget, referensen, Översikt, menyn och rapportunderlaget.
 *
 * Utbrutet ur smoke.test.js så att Vitest fördelar röktesterna över flera arbetare; varje describe-block
 * skapar sina egna fönster via createAppWindow (tests/helpers/app-harness.js).
 */
import { describe, it, expect } from 'vitest';
import { createAppWindow } from './helpers/app-harness.js';

describe('rapportunderlag', () => {
    const stubbaUrklipp = w => {
        const fångat = [];
        w.ClipboardItem = class { constructor(o) { this.o = o; } };
        Object.defineProperty(w.navigator, 'clipboard', { configurable: true, value: { write: async items => { fångat.push(...items); } } });
        return fångat;
    };
    it('utan data visar panelen hur man kommer igång', () => {
        const w = createAppWindow();
        w.__renderTabContent('rapporttext');   // fliken är låst utan lönefil; en direktlänk ritar den ändå
        expect(w.document.getElementById('rapportunderlag-innehall').textContent).toContain('Läs in underlag');
    });
    it('med demodata: fem avsnitt, ett block per flaggat yrke och godkänt par, tre diagram', () => {
        const w = createAppWindow();
        w.__loadDemoData();
        w.document.querySelector('.nav-item[data-tab="rapporttext"]').click();
        const block = w.__rapportunderlagBlock();
        const flaggade = w.__ruLikaArbeteGrupper(w.__getData(), { k: w.__K }).grupper.filter(g => g.flaggad).length;   // rapportunderlaget lämnar verktyget: inställd tröskel
        const typer = block.map(b => b.id.split(':')[0]);
        expect(typer.filter(t => ['sammanfattning', 'lika', 'likvardigt', 'struktur', 'handlingsplan'].includes(t)).length).toBe(5);
        expect(typer.filter(t => t === 'yrke').length).toBe(flaggade);
        expect(w.document.querySelectorAll('#rapportunderlag-innehall [data-rapport-kopiera]').length).toBe(block.length);
        const harPar = typer.includes('par');
        expect(w.document.querySelectorAll('#rapportunderlag-innehall [data-rapport-diagram]').length).toBe(harPar ? 3 : 2);
        expect(w.document.getElementById('rapportunderlag-innehall').textContent).toContain('DEMODATA');
    });
    it('tal och intervall i blockens tabeller står på en rad på skärmen (95 % KI); urklippet är fortfarande utan klasser', () => {
        const w = createAppWindow();
        w.__loadDemoData();
        w.document.querySelector('.nav-item[data-tab="rapporttext"]').click();
        const celler = [...w.document.querySelectorAll('#rapportunderlag-innehall .ru-innehall td')];
        const tal = celler.filter(td => w.eval('_cellArTal')(td.textContent));
        const intervall = tal.filter(td => /\d\s*(–|till)\s*[−+]?\d/.test(td.textContent));
        expect(intervall.length).toBeGreaterThan(0);
        expect(tal.every(td => td.classList.contains('ru-tal'))).toBe(true);
        expect(celler.filter(td => td.classList.contains('ru-tal')).length).toBe(tal.length);
    });
    it('Kopiera lägger ren HTML och text på urklipp', async () => {
        const w = createAppWindow();
        w.__loadDemoData();
        w.document.querySelector('.nav-item[data-tab="rapporttext"]').click();
        const fångat = stubbaUrklipp(w);
        expect(await w.__kopieraRapportBlock('sammanfattning')).toBe('urklipp');
        const html = await fångat[0].o['text/html'].text();
        const text = await fångat[0].o['text/plain'].text();
        expect(html).toContain('<h3>Sammanfattning</h3>');
        expect(html).not.toMatch(/style=|class=/);
        expect(text).toMatch(/^Sammanfattning/);
    });
    it('utan urklipps-API används reserven och blocket markeras', async () => {
        const w = createAppWindow();
        w.__loadDemoData();
        w.document.querySelector('.nav-item[data-tab="rapporttext"]').click();
        Object.defineProperty(w.navigator, 'clipboard', { configurable: true, value: undefined });
        w.document.execCommand = () => false;
        expect(await w.__kopieraRapportBlock('lika')).toBe('markerat');
        expect(w.getSelection().toString()).toContain('Lika arbete');
    });
    it('uppdelningsblocket ligger direkt efter Sammanfattning', () => {
        const w = createAppWindow();
        w.__loadDemoData();
        const ids = w.__rapportunderlagBlock().map(b => b.id);
        expect(ids.slice(0, 2)).toEqual(['sammanfattning', 'uppdelning']);
    });
    it('Rensa all data tömmer panelen', () => {
        const w = createAppWindow();
        w.__loadDemoData();
        w.document.querySelector('.nav-item[data-tab="rapporttext"]').click();
        w.__clearAllData();
        expect(w.document.getElementById('rapportunderlag-innehall').textContent).not.toContain('Sammanfattning');
    });
});

describe('rapportunderlag: kopiera diagram', () => {
    it('data-URL blir en PNG-blob utan fetch (CSP)', async () => {
        const w = createAppWindow();
        const b = w.__dataUrlTillBlob('data:image/png;base64,iVBORw0KGgo=');
        expect(b.type).toBe('image/png');
        expect(b.size).toBe(8);
    });
    it('ritar diagrammet först om fliken inte öppnats, och lägger PNG på urklipp', async () => {
        const w = createAppWindow();
        w.__loadDemoData();
        const fångat = [];
        w.ClipboardItem = class { constructor(o) { this.o = o; } };
        Object.defineProperty(w.navigator, 'clipboard', { configurable: true, value: { write: async items => { fångat.push(...items); } } });
        expect(w.document.getElementById('chart-perbas-gap')?._figur).toBeUndefined();
        expect(await w.__kopieraRapportDiagram('chart-perbas-gap')).toBe('urklipp');
        expect(w.document.getElementById('chart-perbas-gap')._figur.lager.length).toBeGreaterThan(0);   // ritat av diagramkärnan
        expect(Object.keys(fångat[0].o)).toEqual(['image/png']);
    });
    it('diagram som inte finns för underlaget (inga kandidatpar i demodatan) ger saknas', async () => {
        const w = createAppWindow();
        w.__loadDemoData();
        expect(await w.__kopieraRapportDiagram('chart-likvardighet-heatmap')).toBe('saknas');
    });
    it('utan urklippsstöd för bilder laddas diagrammet ner', async () => {
        const w = createAppWindow();
        w.__loadDemoData();
        w.document.querySelector('.nav-item[data-tab="matrix"]').click();
        w.figurTillBild = () => Promise.resolve('data:image/png;base64,AAAA');   // diagramkärnans bild: jsdom har ingen canvas
        Object.defineProperty(w.navigator, 'clipboard', { configurable: true, value: undefined });
        expect(await w.__kopieraRapportDiagram('chart-skevhet-overview')).toBe('nedladdat');
    });
});

describe('rapportunderlag: diagram, kopiering och nedladdning', () => {
    it('I2: kandidatparens diagram erbjuds bara när inga par uteslutits', () => {
        const w = createAppWindow();
        const ids = (harPar, exkl) => w._rapportDiagramLista(harPar, exkl).map(g => g.id);
        expect(ids(true, 0)).toContain('chart-likvardighet-heatmap');
        expect(ids(true, 1)).not.toContain('chart-likvardighet-heatmap');
        expect(ids(false, 0)).not.toContain('chart-likvardighet-heatmap');
    });
    it('I4: diagrammet ritas alltid om före kopiering (aktuellt urval)', async () => {
        const w = createAppWindow();
        w.__loadDemoData();
        w.document.querySelector('.nav-item[data-tab="matrix"]').click();
        const anrop = [];
        const orig = w.renderTabContent;
        w.renderTabContent = t => { anrop.push(t); return orig(t); };
        w.figurTillBild = () => Promise.resolve('data:image/png;base64,AAAA');   // diagramkärnans bild: jsdom har ingen canvas
        Object.defineProperty(w.navigator, 'clipboard', { configurable: true, value: undefined });
        await w.__kopieraRapportDiagram('chart-skevhet-overview');
        expect(anrop).toContain('struktur');
    });
    it('I5: misslyckad nedladdning ger "fel" utan att kasta', async () => {
        const w = createAppWindow();
        w.__loadDemoData();
        w.document.querySelector('.nav-item[data-tab="matrix"]').click();
        Object.defineProperty(w.navigator, 'clipboard', { configurable: true, value: undefined });
        w.figurTillBild = () => Promise.reject(new Error('nej'));   // diagrammet ritas av diagramkärnan (ADR-39)
        await expect(w.__kopieraRapportDiagram('chart-skevhet-overview')).resolves.toBe('fel');
    });
});

describe('Struktur: representation i BAS-ordning', () => {
    it('tabellen listar BAS A–Ö', () => {
        const w = createAppWindow();
        w.__loadDemoData();
        w.document.querySelector('.nav-item[data-tab="struktur"]').click();
        const bas = [...w.document.querySelectorAll('#struktur-representation tbody tr td:first-child')].map(td => td.textContent.trim());
        expect(bas.length).toBeGreaterThan(1);
        expect(bas).toEqual([...bas].sort((a, b) => a.localeCompare(b, 'sv')));
    });
});

// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
// Egna tabeller i rapporten (ADR-52): från Utforska till Word, PDF, Excel och konfigurationsfilen, och receptet för
// avsnittet per BAS-intervall.
import { describe, it, expect, vi } from 'vitest';
import { createAppWindow } from './helpers/app-harness.js';

vi.setConfig({ testTimeout: 30000 });

const fonster = () => {
    const w = createAppWindow();
    w.__loadDemoData();
    w.__renderTabContent('utforska');
    return w;
};
const laggTill = (w, namn, perBas = false) => {
    const d = w.document;
    d.getElementById('explore-rapport-namn').value = namn;
    d.getElementById('explore-rapport-perbas').checked = perBas;
    d.getElementById('btn-explore-till-rapport').click();
    return d.getElementById('explore-rapport-status').textContent;
};

describe('egna tabeller: från Utforska till rapporten', () => {
    it('Lägg till i rapporten sparar ett recept, inte tal, och säger att tabellen är tillagd', () => {
        const w = fonster();
        const d = w.document;
        d.getElementById('explore-rad').value = 'aid'; d.getElementById('explore-measure').value = 'median'; w.__renderExplorer();
        expect(laggTill(w, 'Median per yrke')).toMatch(/Tillagd: Median per yrke \(1 egen tabell\)/);
        expect(d.getElementById('explore-rapport-namn').value).toBe('');
        const [r] = w.__state.rapportTabeller;
        expect(r).toMatchObject({ namn: 'Median per yrke', spec: { rad: 'aid', kolumn: null, matt: 'median' }, upprepa: null });
        expect(JSON.stringify(r)).not.toMatch(/\d{5}/);
        // Utan namn får tabellen sin beskrivning som namn; per BAS kräver att raderna inte redan är BAS.
        expect(laggTill(w, '', true)).toMatch(/Tillagd: Median månadslön per Yrkesgrupp \(AID\), en tabell per BAS-intervall/);
        d.getElementById('explore-rad').value = 'bas'; w.__renderExplorer();
        expect(laggTill(w, 'Fel', true)).toMatch(/går inte när raderna/);
        expect(w.__state.rapportTabeller).toHaveLength(2);
    });
    it('rapportmodellen får avsnittet Egna tabeller efter avsnittet per BAS, med tröskeln tillämpad; ett tomt recept utelämnas och anges', () => {
        const w = fonster();
        const d = w.document;
        d.getElementById('explore-rad').value = 'aid'; d.getElementById('explore-measure').value = 'median'; w.__renderExplorer();
        laggTill(w, 'Median per yrke');
        laggTill(w, 'Yrken per BAS', true);
        const m = w.eval('rapportModell()');
        const ids = m.avsnitt.map(a => a.id);
        expect(ids.indexOf('egna')).toBe(ids.indexOf('perbas') + 1);
        const egna = m.avsnitt.find(a => a.id === 'egna');
        expect(egna.rubrik).toMatch(/^\d+\. Egna tabeller$/);
        const rubriker = egna.delar.filter(p => p.typ === 'rubrik').map(p => p.text);
        expect(rubriker[0]).toBe('Median per yrke');
        expect(rubriker.some(t => /^Yrken per BAS — BAS /.test(t))).toBe(true);
        const tabell = egna.delar.find(p => p.typ === 'tabell');
        expect(tabell.kolumner.map(c => c.rubrik)).toEqual(['Yrkesgrupp (AID)', 'Median månadslön', 'n (K/M)']);
        expect(tabell.rader.length).toBeGreaterThan(3);
        // Tröskeln: samma grupper som Utforskas export, inga grupper under 10.
        const k = w.eval('kInstalld()');
        for (const rad of tabell.rader) expect(Number(rad[2].split(' ')[0])).toBeGreaterThanOrEqual(k);
        expect(w.__docDraftHtml()).toContain('Egna tabeller');
        // Ledningsbriefen har inte avsnittet per BAS och därför inte heller egna tabeller; hela dokumentationen har båda.
        w.eval("sattRapportUrval('ledning')");
        expect(w.eval('rapportModell()').avsnitt.map(a => a.id)).not.toContain('egna');
        w.eval("sattRapportUrval('hela')");
        expect(w.eval('rapportUrval()').namn).toBe('Hela dokumentationen');
        // Ett recept vars grupper alla är under tröskeln ger inga tabeller men anges i utelämnat.
        w.eval('sattKTroskel(900, { fraga: false })');
        expect(w.eval('rapportModell()').avsnitt.map(a => a.id)).not.toContain('egna');
    });
    it('Excel-filen får bladet Egna tabeller med tal som tal, och beskedet listar bladet', async () => {
        const { readFileSync } = await import('node:fs');
        const w = fonster();
        w.eval(readFileSync(new URL('../vendor/xlsx.mini.min.js', import.meta.url), 'utf8'));
        w.document.getElementById('explore-rad').value = 'bas'; w.document.getElementById('explore-visa').value = 'kon'; w.__renderExplorer();
        laggTill(w, 'Per kön');
        expect(w.eval('excelAlltBlad()')).toContain('Egna tabeller');
        let wb = null;
        w.XLSX.writeFile = b => { wb = b; };
        w.alert = () => {};
        w.eval('exportAllToExcel()');
        expect(wb.SheetNames).toContain('Egna tabeller');
        const rader = w.XLSX.utils.sheet_to_json(wb.Sheets['Egna tabeller'], { header: 1, raw: true });
        expect(rader[2][0]).toBe('Per kön');
        expect(rader[3]).toEqual(['BAS-intervall', 'Kvinnor (kr/mån)', 'Män (kr/mån)', 'n (K/M)']);
        expect(typeof rader[4][1]).toBe('number');
    });
    it('Dokumentera listar egna tabeller med flytt och borttagning, och konfigurationsfilen bär dem', () => {
        const w = fonster();
        const d = w.document;
        laggTill(w, 'Första'); laggTill(w, 'Andra');
        d.querySelector('.nav-item[data-tab="dokumentera"]').click();
        const namn = () => [...d.querySelectorAll('#rapport-egna [data-egen-id] strong')].map(e => e.textContent);
        expect(namn()).toEqual(['Första', 'Andra']);
        d.querySelector('#rapport-egna [data-egen-id] [data-egen-flytta="1"]').click();
        expect(namn()).toEqual(['Andra', 'Första']);
        const cfg = w.eval('JSON.parse(JSON.stringify(buildConfigSnapshot()))');
        expect(cfg.rapportTabeller.map(t => t.namn)).toEqual(['Andra', 'Första']);
        d.querySelector('#rapport-egna [data-egen-id] [data-egen-bort]').click();
        expect(namn()).toEqual(['Första']);
        w.__cfg = cfg;
        w.eval('applyConfigSnapshot(window.__cfg)');
        expect(w.__state.rapportTabeller.map(t => t.namn)).toEqual(['Andra', 'Första']);
        // En ogiltig tabell i filen hoppas över med en varning; resten läses.
        w.__cfg = { ...cfg, rapportTabeller: [cfg.rapportTabeller[0], { spec: { rad: 'hemlig' } }] };
        expect(w.eval('applyConfigSnapshot(window.__cfg)').varningar.join(' ')).toMatch(/1 egna tabeller i filen gick inte att läsa/);
        expect(w.__state.rapportTabeller.map(t => t.namn)).toEqual(['Andra']);
        w.eval('_rensaAllData()');
        expect(w.__state.rapportTabeller).toEqual([]);
    });
});

describe('egna tabeller: receptet för avsnittet per BAS-intervall', () => {
    it('formuläret ändrar avsnittets mått, rader och summeringstabeller; återställ ger standard; receptet följer med i konfigurationsfilen', () => {
        const w = fonster();
        const d = w.document;
        d.querySelector('.nav-item[data-tab="dokumentera"]').click();
        expect(d.getElementById('pb-recept-status').textContent).toBe('Standardreceptet.');
        expect(d.getElementById('pb-aterstall').hidden).toBe(true);
        const andra = (id, varde) => { const el = d.getElementById(id); if (typeof varde === 'boolean') el.checked = varde; else el.value = varde; el.dispatchEvent(new w.Event('change', { bubbles: true })); };
        andra('pb-matt-p25', true); andra('pb-matt-p10', false); andra('pb-rad-statistik', false); andra('pb-konsgap', false); andra('pb-aldersgranser', '30, 40, 55');
        expect(w.__state.perBasRecept).toEqual({ dim: 'bas', rader: ['referens', 'organisation', 'yrken', 'kvinnor', 'man'], matt: ['p25', 'med', 'p90'], konsgap: false, aldersgrupper: true, aldersgranser: [30, 40, 55] });
        expect(d.getElementById('pb-aterstall').hidden).toBe(false);
        const perbas = w.eval('rapportModell()').avsnitt.find(a => a.id === 'perbas');
        const tabell = perbas.delar.find(p => p.typ === 'tabell');
        expect(tabell.kolumner.map(c => c.rubrik)).toEqual(['Grupp', 'Antal', 'P25', 'Median', 'P90']);
        expect(perbas.delar.filter(p => p.typ === 'rubrik').map(p => p.text)).not.toContain('Löneskillnader inom likvärdigt arbete, per BAS-intervall');
        expect(perbas.delar.some(p => p.typ === 'stycke' && /–29, 30–39, 40–54, 55–/.test(p.text))).toBe(true);
        const cfg = w.eval('JSON.parse(JSON.stringify(buildConfigSnapshot()))');
        expect(cfg.perBasRecept.matt).toEqual(['p25', 'med', 'p90']);
        d.getElementById('pb-aterstall').click();
        expect(w.__state.perBasRecept).toBeNull();
        expect(d.getElementById('pb-recept-status').textContent).toBe('Standardreceptet.');
        w.__cfg = cfg;
        w.eval('applyConfigSnapshot(window.__cfg)');
        expect(w.__state.perBasRecept.aldersgranser).toEqual([30, 40, 55]);
    });
    it('per sektor: avsnittet heter Lönestruktur per sektor och tabellerna saknar referensrad', () => {
        const w = fonster();
        w.__state.perBasRecept = w.eval("_pbValideraRecept({ dim: 'sektor' })");
        const perbas = w.eval('rapportModell()').avsnitt.find(a => a.id === 'perbas');
        expect(perbas.rubrik).toMatch(/Lönestruktur per sektor$/);
        expect(perbas.delar.filter(p => p.typ === 'rubrik').map(p => p.text)[0]).toMatch(/^Sektor /);
        expect(perbas.delar.filter(p => p.typ === 'tabell').some(t => t.rader.some(r => /ställningstagande/i.test(String(r[0]))))).toBe(false);
    });
});

describe('exportläget kostar inte mer än det måste (ADR-51)', () => {
    it('rapportModellBada ger samma modell som rapportModell() och rapportModell({ alla: true }) ur ett bygge', () => {
        const w = fonster();
        // Metodbilagans exporttidpunkt har sekunder: två modeller byggda på var sin sida om ett sekundskifte (som på
        // en långsam CI-maskin) är ändå samma modell, så tidpunkten jämförs inte.
        const utanTid = m => JSON.stringify(m).replace(/"Exporttidpunkt","[^"]*"/g, '"Exporttidpunkt","<TID>"');
        const bada = w.eval('rapportModellBada()');
        expect(utanTid(bada.urval)).toBe(utanTid(w.eval('rapportModell()')));
        expect(utanTid(bada.alla)).toBe(utanTid(w.eval('rapportModell({ alla: true })')));
        expect(bada.alla.avsnitt.length).toBeGreaterThanOrEqual(bada.urval.avsnitt.length);
    });
    it('Lika arbetes minne har ett rum per tröskel: ett lägesbyte räknar inte om översiktens rader', () => {
        const w = fonster();
        expect(w.eval('const a = _laOversiktRader(getData()); medExportLage(() => _laOversiktRader(getData())); _laOversiktRader(getData()) === a')).toBe(true);
        expect(w.eval('medExportLage(() => _laOversiktRader(getData())) === _laOversiktRader(getData())')).toBe(false);
    });
    it('efter en export ritas Översikt tillbaka bara när exporten ritade den', () => {
        const w = fonster();
        w.__renderTabContent('dashboard');
        let antal = 0;
        w.updateDashboardStats = () => { antal++; };
        w.__renderTabContent('dokumentera');                       // ritar inga andra flikar
        expect(antal).toBe(0);
        w.eval("medExportLage(() => renderTabContent('dashboard'))");   // som ZIP-exporten
        expect(antal).toBe(2);                                     // en gång i exportläget, en gång tillbaka
        expect(w.__state.kLage).toBe('skarm');
    });
});

describe('egna tabeller i rapportunderlaget (ADR-20, ADR-52)', () => {
    it('varje egen tabell blir ett block med formaterade tal, under en egen rubrik, och går att kopiera', () => {
        const w = fonster();
        const d = w.document;
        d.getElementById('explore-rad').value = 'aid'; d.getElementById('explore-measure').value = 'median'; w.__renderExplorer();
        laggTill(w, 'Median per yrke');
        const block = w.eval('rapportunderlagBlock()').filter(b => b.id.startsWith('egen:'));
        expect(block).toHaveLength(1);
        expect(block[0]).toMatchObject({ id: 'egen:0:0', rubrik: 'Median per yrke' });
        expect(block[0].tabell.rubriker[0]).toMatch(/Yrkesgrupp/);
        expect(block[0].tabell.rader.length).toBeGreaterThan(0);
        expect(block[0].tabell.rader[0][1]).toMatch(/^\d[\d\s ]* kr$/);
        expect(block[0].stycken.join(' ')).toMatch(/Urval: Hela organisationen/);
        w.__renderTabContent('dokumentera');
        const host = d.getElementById('rapportunderlag-innehall');
        expect(host.textContent).toContain('Egna tabeller från Utforska');
        expect(host.querySelector('[data-rapport-kopiera="egen:0:0"]')).not.toBeNull();
        expect(host.querySelector('.ru-toc').textContent).toContain('Median per yrke');
        // Utan recept finns varken rubrik eller block.
        w.__state.rapportTabeller = [];
        w.__renderTabContent('dokumentera');
        expect(host.textContent).not.toContain('Egna tabeller från Utforska');
    });
});

describe('egna tabeller i organisationspaketet (ADR-52)', () => {
    const paket = rapport => ({ format: 'lonekartlaggning-organisationspaket', version: 1, organisation: { namn: 'Exempelorganisationen' }, skapat: '2026-10-29',
        referens: { rader: [{ bas: 'A', p10: 22000, med: 30000, p90: 52000 }] }, ...(rapport ? { rapport } : {}) });
    it('ett paket med recept ersätter de egna tabellerna och receptet per BAS; ett paket utan rör dem inte', () => {
        const w = fonster();
        const d = w.document;
        d.getElementById('explore-rad').value = 'aid'; d.getElementById('explore-measure').value = 'median'; w.__renderExplorer();
        laggTill(w, 'Min egen');
        const recept = w.eval("_trNytt({ rad: 'bas', matt: 'p90' }, { namn: 'Paketets tabell' })");
        const r = w.eval(`lasInPaket(${JSON.stringify(JSON.stringify(paket({ tabeller: [recept], perBasRecept: { dim: 'sektor' } })))}, 'x.lonepaket.json')`);
        expect(r.ok).toBe(true);
        expect(w.__state.rapportTabeller.map(t => t.namn)).toEqual(['Paketets tabell']);
        expect(w.__state.perBasRecept).toMatchObject({ dim: 'sektor' });
        expect(w.eval("lasInPaket(" + JSON.stringify(JSON.stringify(paket(null))) + ", 'y.lonepaket.json')").ok).toBe(true);
        expect(w.__state.rapportTabeller.map(t => t.namn)).toEqual(['Paketets tabell']);
        // Formuläret: rutan är förkryssad när recept finns, och paketet som skapas bär dem.
        w.eval('_fyllPaketFormular()');
        expect(d.getElementById('paket-rapport').checked).toBe(true);
        const p = w.eval('skapaPaket()');
        expect(p.rapport.tabeller.map(t => t.namn)).toEqual(['Paketets tabell']);
        expect(p.rapport.perBasRecept).toMatchObject({ dim: 'sektor' });
        d.getElementById('paket-rapport').checked = false;
        expect('rapport' in w.eval('skapaPaket()')).toBe(false);
        // Utan recept är rutan avstängd.
        w.__state.rapportTabeller = []; w.__state.perBasRecept = null;
        w.eval('_fyllPaketFormular()');
        expect(d.getElementById('paket-rapport').disabled).toBe(true);
    });
});

/**
 * K-tröskeln som inställning: flikarna i menyn (I4), exporter som hör till ett undantag (I2), ZIP-filens Excel-fil och utskriftens urval (I3), paketformuläret och omritningen efter konfigurationsfil och paket (I5).
 *
 * Riggen (fixturer, fönster och sökfunktioner) ligger i tests/helpers/ktroskel-rigg.js; sviten är delad i
 * åtta filer så att Vitest fördelar den över flera arbetare.
 */
import { describe, it, expect, vi } from 'vitest';
import { createAppWindow } from './helpers/app-harness.js';
import { STORA, MELLAN, SMA, FLIKAR, synliga, fonster, ritaAlla, fonsterKon, laddaXlsx, fangaBocker, utskriftAv, TOPP, SENT_MELLAN, SENT_SMA, iExport } from './helpers/ktroskel-rigg.js';

// Sviten ritar om hela verktyget i varje test. Under full last tar ett test 4–6 s, så standardgränsen 5 s
// fäller olika tester från körning till körning.
vi.setConfig({ testTimeout: 30000 });

describe('I4: listan över flikar är menyns flikar', () => {
    it('FLIKAR täcker varje flik i menyn (utom Utforska, som är undantagen på skärmen)', () => {
        const w = createAppWindow();
        const meny = [...w.document.querySelectorAll('.nav-item[data-tab]')].map(e => e.getAttribute('data-tab'));
        const tackta = new Set(FLIKAR.map(f => w.eval(`tabMal(${JSON.stringify(f)})`)));
        expect(meny.filter(f => f !== 'utforska' && !tackta.has(f))).toEqual([]);
        expect([...tackta].filter(f => !meny.includes(f))).toEqual([]);
    });
});

describe('I2: exporter som hör till ett undantag säger det, och notisen utlovar ingen aggregering', () => {
    const UNDANTAG_LV = 'Den här filen kan även innehålla grupper under tröskeln (undantag: Likvärdigt arbete).';
    const UNDANTAG_UT = 'Den här filen kan även innehålla grupper under tröskeln (undantag: valt i Utforska).';
    const fangaCsv = w => { w.eval('window.__csv = []; _toCsv = (rows => { window.__csv.push(rows); return ""; })'); return () => w.__csv.at(-1).map(r => r.join(' | ')); };
    it('Likvärdigt arbete: CSV-filens stämpel och Excel-filens metodblad', async () => {
        // Ett par där den kvinnodominerade gruppen har 6 personer: det står i den här exporten (undantaget).
        const w = createAppWindow();
        const data = [];
        const lagg = (n, kon, lon, bas, aid) => { for (let i = 0; i < n; i++) data.push({ bas, kon, lon: lon + (i % 3) * 10,
            alder: 30 + (i * 7) % 30, yrke: `${aid} Yrke ${aid}`, aid, yrkeLabel: `Yrke ${aid}`, enhet: '' }); };
        lagg(30, 'kvinna', 25000, 'A', '6000'); lagg(30, 'man', 25500, 'A', '6000');
        lagg(20, 'man', 50000, 'C', '6100'); lagg(4, 'kvinna', 50000, 'C', '6100'); lagg(6, 'kvinna', 36421, 'C', '5300');
        w.__state.data = data;
        w.eval('populateSelects(); unlockTabs();');
        w.__renderTabContent('likvardighet');
        const rader = fangaCsv(w);
        w.eval('exportLikvardighetCSV()');
        expect(rader().some(r => r.includes('Yrke 5300'))).toBe(true);
        expect(rader().at(-1)).toBe(`Minsta gruppstorlek för redovisning: 10. ${UNDANTAG_LV}`);
        await laddaXlsx(w);
        const bok = Object.values(fangaBocker(w, () => w.eval('exportLikvardighet()')))[0];
        expect(bok.split('[Metod & parametrar]')[1]).toContain(`Undantag från minsta gruppstorlek | ${UNDANTAG_LV}`);
        // Övriga Excelfiler har inte raden
        const eu = Object.values(fangaBocker(w, () => w.eval('exportEuReport()')))[0];
        expect(eu).not.toContain('Undantag från minsta gruppstorlek');
    });
    it('Utforska: stämpeln säger det bara när rutan är ikryssad — tabell-CSV, urklipp och diagramdata', async () => {
        const w = fonsterKon(null);
        const d = w.document;
        w.__renderTabContent('utforska');
        await new Promise(r => setTimeout(r, 0));
        const rader = fangaCsv(w);
        let kopierat = null;
        Object.defineProperty(w.navigator, 'clipboard', { configurable: true, value: { writeText: t => { kopierat = t; return Promise.resolve(); } } });
        const kryss = pa => { d.getElementById('explore-inkludera-sma').checked = pa; w.__renderExplorer(); };
        const csvKnapp = d.querySelector('[data-csv-table="explore-table"]'), kopieraKnapp = d.querySelector('[data-copy-table="explore-table"]');
        expect(csvKnapp).not.toBeNull();
        kryss(false);
        csvKnapp.click();
        expect(rader().at(-1)).toBe('Minsta gruppstorlek för redovisning: 10.');
        kopieraKnapp.click();
        expect(kopierat).not.toContain('Minsta gruppstorlek');           // vid standard: en kopierad tabell klistras in som den är
        expect(w.__chartExportRows(d.getElementById('chart-explore'))[0][0]).not.toContain('undantag');
        kryss(true);
        csvKnapp.click();
        expect(rader().at(-1)).toBe(`Minsta gruppstorlek för redovisning: 10. ${UNDANTAG_UT}`);
        kopieraKnapp.click();
        expect(kopierat.split('\n').at(-1)).toBe(`Minsta gruppstorlek för redovisning: 10. ${UNDANTAG_UT}`);
        expect(w.__chartExportRows(d.getElementById('chart-explore'))[0][0]).toContain(UNDANTAG_UT);
        // Löneöversikten ligger i samma flik men följer inte rutan
        expect(w.eval("_kUndantagFor(document.getElementById('rapport-table'))")).toBe('');
    });
    it('diagram i fliken Likvärdigt arbete bär tillägget; andra diagram inte', () => {
        const w = fonsterKon(null);
        const gd = (id, vy) => {
            const el = w.document.createElement('div'); el.id = id; w.document.getElementById(vy).appendChild(el);
            w.__el = el; w.__f = { beskrivning: 'T', x: { skala: 'band' }, y: { skala: 'linjar' }, lager: [{ marke: 'stapel', serie: 'A', farg: '#2563eb', data: [{ x: 'a', y: 1 }] }] };
            w.eval('ritaFigur(window.__el, window.__f, {})');
            return el;
        };
        const lv = gd('chart-lv-test', 'view-likvardighet');
        const annan = gd('chart-annan-test', 'view-struktur');
        expect(w.__chartExportRows(lv)[0][0]).toContain(UNDANTAG_LV);
        expect(w.__chartExportRows(annan)[0][0]).not.toContain('undantag');
    });
    it('notisen efter export nämner varken aggregering eller gruppstorlek', () => {
        const w = fonsterKon(null);
        w.eval('_showExportSensitivityToast()');
        const t = w.document.getElementById('export-sensitivity-toast').textContent;
        expect(t).toMatch(/Filen innehåller lönedata/);
        expect(t).not.toMatch(/aggregera|gruppstorlek|anonym/i);
    });
});

describe('I3: tröskeln står i ZIP-filens Excel-fil och i utskriftens korta urval', () => {
    it('ZIP-filens Excel-fil har bladet Metod & parametrar med raden om minsta gruppstorlek', async () => {
        const w = fonsterKon(null);
        await laddaXlsx(w);
        w.__renderTabContent('utforska');
        const bocker = [];
        const skriv = w.XLSX.write;
        w.XLSX.write = (wb, opt) => { bocker.push(wb); return skriv(wb, opt); };
        w.JSZip = class { file() {} generateAsync() { return Promise.resolve(new w.Blob(['x'])); } };
        w.URL.createObjectURL = () => 'blob:x';
        w.HTMLAnchorElement.prototype.click = () => {};
        w.document.getElementById('btn-export-zip').click();
        await new Promise(r => setTimeout(r, 50));
        expect(bocker).toHaveLength(1);
        expect(bocker[0].SheetNames).toContain('Metod & parametrar');
        const rader = w.XLSX.utils.sheet_to_json(bocker[0].Sheets['Metod & parametrar'], { header: 1, raw: true });
        expect(rader.find(r => r[0] === 'Minsta gruppstorlek för redovisning')[1]).toMatch(/^10 personer\./);
    });
    it('utskriften med ett urval som har metodbilagan (facklig dialog) bär tröskeln där', async () => {
        const el = await utskriftAv(fonsterKon(null), 'facklig');
        expect(el.querySelector('.k-stampel')).toBeNull();
        const metod = el.querySelector('section[data-rm-avsnitt="metod"]');
        expect(metod.textContent).toMatch(/Minsta gruppstorlek för redovisning\s*10 personer/);
    });
    it.each(['ledning'])('urvalet %s (utan metodbilaga) slutar med stämpeln, också vid standardvärdet', async mall => {
        const el = await utskriftAv(fonsterKon(null), mall);
        expect(el.querySelector('.k-stampel').textContent).toBe('Minsta gruppstorlek för redovisning: 10.');
        expect(el.lastElementChild.classList.contains('k-stampel')).toBe(true);
        const sankt = await utskriftAv(fonsterKon(6), mall);
        expect(sankt.querySelector('.k-stampel').textContent).toBe('Minsta gruppstorlek för redovisning: 6. Tröskeln är sänkt från standardvärdet 10.');
    });
});

describe('paketformuläret, Rensa, Struktur och Likvärdigt arbete med ändrad tröskel', () => {
    const paket = { format: 'lonekartlaggning-organisationspaket', version: 1, organisation: { namn: 'Exempelorganisationen' }, skapat: '2026-10-08',
        installningar: {}, referens: { rader: [{ bas: 'A', p10: 20000, med: 25000, p90: 30000 }] } };
    const medPaket = () => { const w = createAppWindow(); w.eval(`lasInPaket(${JSON.stringify(JSON.stringify(paket))}, 'x.lonepaket.json')`); w.document.getElementById('paket-org').value = 'Exempelorganisationen'; return w; };
    it('paketformuläret: ett ogiltigt värde sparar inget paket och ger fältets felmeddelande', () => {
        const w = medPaket();
        let sparat = 0;
        w.URL.createObjectURL = () => { sparat++; return 'blob:x'; };
        w.HTMLAnchorElement.prototype.click = () => {};
        const d = w.document;
        d.getElementById('paket-k').value = '1';
        w.eval('uppdateraPaketKnapp()');
        d.getElementById('btn-paket-spara').click();
        expect(sparat).toBe(0);
        expect(d.getElementById('paket-status').textContent).toMatch(/Paketet sparades inte. Minsta gruppstorlek: Ange ett heltal mellan 2 och 1000\./);
        expect(d.getElementById('paket-sammanfattning').textContent).toMatch(/Minsta gruppstorlek: Ange ett heltal mellan 2 och 1000\./);
        d.getElementById('paket-k').value = '12';
        w.eval('uppdateraPaketKnapp()');
        expect(d.getElementById('paket-sammanfattning').textContent).toMatch(/Minsta gruppstorlek för redovisning: 12\./);
        d.getElementById('btn-paket-spara').click();
        expect(sparat).toBe(1);
    });
    it('paketformuläret: ett tomt fält ger ett paket utan tröskel, och sammanfattningen säger det', () => {
        const w = medPaket();
        w.document.getElementById('paket-k').value = '';
        w.eval('uppdateraPaketKnapp()');
        expect(w.document.getElementById('paket-sammanfattning').textContent).toMatch(/Paketet anger ingen minsta gruppstorlek\./);
        expect(w.eval('skapaPaket()').installningar.kTroskel).toBeUndefined();
    });
    it('Rensa all data tar bort felmeddelandet vid fältet', () => {
        const w = createAppWindow();
        const f = w.document.getElementById('k-troskel');
        f.value = '1';
        f.dispatchEvent(new w.Event('change', { bubbles: true }));
        expect(w.document.getElementById('k-troskel-fel').hidden).toBe(false);
        w.eval('_rensaAllData()');
        expect(w.document.getElementById('k-troskel-fel').hidden).toBe(true);
        expect(w.document.getElementById('k-troskel-fel').textContent).toBe('');
    });
    it('Strukturs sammanfattning: stämpeln under 10, och bara BAS som tabellen visar namnges', () => {
        const text = k => { const w = iExport(fonster(k)); w.__renderTabContent('struktur'); return w.document.getElementById('struktur-narrative').value; };
        expect(text(6).trimEnd().endsWith('Minsta gruppstorlek för redovisning: 6. Tröskeln är sänkt från standardvärdet 10.')).toBe(true);
        expect(text(null)).not.toContain('Minsta gruppstorlek');
        // Segregeringsmeningen jämför första och sista BAS i tabellen: vid 10 får E och F (6 personer) inte namnges.
        const w = createAppWindow();
        const rad = (bas, kon, lon) => ({ bas, kon, lon, alder: 40, yrke: '6000 Yrke', aid: '6000', yrkeLabel: 'Yrke', enhet: '' });
        const r = [];
        for (let i = 0; i < 4; i++) r.push(rad('A', 'kvinna', 30000 + i));                              // 4 personer, 100 % kvinnor
        for (let i = 0; i < 40; i++) r.push(rad('B', i < 30 ? 'kvinna' : 'man', 31000 + i));            // 75 % kvinnor (lägst namngivna BAS)
        for (let i = 0; i < 40; i++) r.push(rad('C', i < 10 ? 'kvinna' : 'man', 32000 + i));            // 25 % kvinnor (högst namngivna BAS)
        for (let i = 0; i < 4; i++) r.push(rad('D', 'man', 33000 + i));                                 // 4 personer, 0 % kvinnor
        w.__state.data = r;
        w.eval('populateSelects(); unlockTabs();');
        iExport(w);
        w.__renderTabContent('struktur');
        const seg = w.document.getElementById('struktur-narrative').value.split('\n').find(l => l.startsWith('Vertikal könssegregering'));
        expect(seg).toMatch(/lägre betalda BAS \(B: 75 %\)/);
        expect(seg).toMatch(/högre betalda \(C: 25 %\)/);
        expect(seg).not.toMatch(/\((A|D): /);
    });
    it('Likvärdigt arbete: antalet små kvinnodominerade grupper räknas med gällande tröskel', () => {
        const antal = k => {
            const w = createAppWindow();
            if (k !== null) w.eval(`sattKTroskel(${k}, { fraga: false })`);
            const rader = [];
            const lagg = (n, kon, lon, bas, aid) => { for (let i = 0; i < n; i++) rader.push({ bas, kon, lon: lon + i, alder: 30 + i % 30, yrke: `${aid} Yrke ${aid}`, aid, yrkeLabel: `Yrke ${aid}`, enhet: '' }); };
            lagg(20, 'man', 50000, 'C', '6100'); lagg(6, 'kvinna', 36421, 'C', '5300'); lagg(15, 'kvinna', 37000, 'C', '5301');
            w.__state.data = rader;
            w.eval('populateSelects(); unlockTabs();');
            return w.eval('medExportLage(() => likvardighetResultat().diagnostik.organisation.kvDomMedNLessThanK)');
        };
        expect(antal(5)).toBe(0);
        expect(antal(null)).toBe(1);
        expect(antal(25)).toBe(2);
    });
});

describe('I5: konfigurationsfil och organisationspaket: det som syns ritas om en gång när tröskeln ändras, resten töms', () => {
    const rakna = w => w.eval('window.__antal = {}; const __orig = renderTabContent; renderTabContent = function (f) { window.__antal[f] = (window.__antal[f] || 0) + 1; return __orig(f); };');
    it('konfigurationsfil med annan tröskel: Översikts delar ritas av stegen (ingen flik genom renderTabContent), övriga töms, och Att göra följer den nya tröskeln', () => {
        const a = createAppWindow();
        a.eval('sattKTroskel(25, { fraga: false })');
        const cfg = JSON.parse(JSON.stringify(a.__buildConfigSnapshot()));
        const w = fonster(null);
        w.eval('renderActionChecklist(); renderProcessTracker(); renderDataValidationReport(); refreshCurrentTab();');
        ritaAlla(w);
        expect(synliga(w, SENT_MELLAN).length).toBeGreaterThan(0);
        rakna(w);
        w.__cfg = cfg;
        w.eval('applyConfigSnapshot(window.__cfg)');
        expect(w.eval('kInstalld()')).toBe(25);
        expect(Object.entries(w.__antal).filter(([, n]) => n !== 1)).toEqual([]);
        expect(Object.keys(w.__antal).length).toBe(0);                              // den öppna fliken är Översikt, vars delar stegen ritar själva
        expect(synliga(w, [...SENT_MELLAN, ...SENT_SMA])).toEqual([]);              // övriga är tömda
        expect(w.document.getElementById('data-validation-report').textContent).toMatch(/BAS under minsta gruppstorlek \(n<25, redovisas inte i exporterna\):\s*6/);
    });
    it('konfigurationsfil med samma tröskel: bara den öppna fliken ritas', () => {
        const a = createAppWindow();
        const cfg = JSON.parse(JSON.stringify(a.__buildConfigSnapshot()));
        const w = fonster(null);
        rakna(w);
        w.__cfg = cfg;
        w.eval('applyConfigSnapshot(window.__cfg)');
        expect(Object.keys(w.__antal).length).toBe(1);
    });
    it('organisationspaket med annan tröskel: ingen flik ritas mer än en gång, och ingen mellangrupp står kvar', () => {
        const w = fonster(null);
        ritaAlla(w);
        rakna(w);
        const paket = { format: 'lonekartlaggning-organisationspaket', version: 1, organisation: { namn: 'Exempelorganisationen' }, skapat: '2026-10-08',
            installningar: { kTroskel: 25 }, referens: { rader: [...STORA, TOPP, ...MELLAN, ...SMA].map(b => ({ bas: b, p10: 22000, med: 30000, p90: 52000 })) } };
        expect(w.eval(`lasInPaket(${JSON.stringify(JSON.stringify(paket))}, 'x.lonepaket.json')`).ok).toBe(true);
        expect(Object.entries(w.__antal).filter(([, n]) => n !== 1)).toEqual([]);
        expect(synliga(w, [...SENT_MELLAN, ...SENT_SMA])).toEqual([]);
    });
});

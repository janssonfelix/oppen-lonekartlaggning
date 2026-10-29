/**
 * K-tröskeln som inställning: ett kön under tröskeln inuti en grupp över den (fixturen, C2–C5).
 *
 * Riggen (fixturer, fönster och sökfunktioner) ligger i tests/helpers/ktroskel-rigg.js; sviten är delad i
 * åtta filer så att Vitest fördelar den över flera arbetare.
 */
import { describe, it, expect, vi } from 'vitest';
import { createAppWindow } from './helpers/app-harness.js';
import { STORA, MELLAN, SMA, normalisera, oppnaFlik, KON_BAS, KON_KV, KON_MA, KON_GAP, KON_DOLDA, byggKonDataset, fonsterKon, harNagon, laddaXlsx, fangaBocker, utskriftAv, SENT_MELLAN, SENT_SMA, iExport } from './helpers/ktroskel-rigg.js';

// Sviten ritar om hela verktyget i varje test. Under full last tar ett test 4–6 s, så standardgränsen 5 s
// fäller olika tester från körning till körning.
vi.setConfig({ testTimeout: 30000 });

describe('fixturen för kön under tröskeln', () => {
    it('inget dolt värde kan uppstå ur organisationens egna percentiler eller ytterkanter', () => {
        const data = byggKonDataset();
        const dolda = new Set([...KON_DOLDA, ...SENT_SMA, ...SENT_MELLAN]);
        for (const kon of ['kvinna', 'man', null]) {
            const loner = data.filter(r => !kon || r.kon === kon).map(r => r.lon).sort((a, b) => a - b);
            for (const p of [10, 25, 50, 75, 90]) {
                const pos = (p / 100) * (loner.length - 1);
                for (const v of [loner[Math.floor(pos)], loner[Math.ceil(pos)]]) expect(dolda.has(v), `P${p} ${kon || 'alla'} = ${v}`).toBe(false);
            }
        }
        const alla = data.map(r => r.lon);
        expect(dolda.has(Math.min(...alla))).toBe(false);
        expect(dolda.has(Math.max(...alla))).toBe(false);
        expect(new Set(KON_DOLDA).size).toBe(KON_DOLDA.length);
        const forekomster = v => data.filter(r => r.lon === v).length;
        for (const v of KON_DOLDA) expect(forekomster(v), String(v)).toBeLessThanOrEqual(3);   // bara i sin egen lilla grupp
    });
});

describe('C2: Struktur per BAS visar inget könsgap när ett kön är under tröskeln', () => {
    const radFor = (html, bas) => { const m = html.match(new RegExp(`<tr><td>(?:<strong>)?${bas}(?:</strong>)?</td>.*?</tr>`, 's')); return m ? normalisera(m[0].replace(/&nbsp;/g, ' ').replace(/<[^>]+>/g, ' | ')) : null; };
    it('fliken Struktur på skärmen: gapet visas också mot en, två och tre män (ADR-51)', () => {
        const w = fonsterKon(null);
        w.__renderTabContent('struktur');
        const el = w.document.getElementById('struktur-representation');
        for (const bas of KON_BAS) expect(radFor(el.innerHTML, bas), bas).not.toMatch(/–[\s|]*$/);   // gapcellen är ifylld
        expect(el.textContent).not.toMatch(/ett av könen har färre än 10 personer/);
    });
    it('fliken Struktur i exportläget: raden finns kvar med samlad median, utan gap, och noten förklarar', () => {
        const w = iExport(fonsterKon(null));
        w.__renderTabContent('struktur');
        const el = w.document.getElementById('struktur-representation');
        for (const [i, bas] of KON_BAS.entries()) {
            const rad = radFor(el.innerHTML, bas);
            expect(rad, bas).toContain(String(KON_KV[i]));        // gruppens samlade median (30 kvinnor av 31–33)
            expect(harNagon(rad, KON_GAP), bas).toEqual([]);
            expect(rad, bas).toMatch(/–[\s|]*$/);
        }
        expect(el.textContent).toMatch(/ett av könen har färre än 10 personer/);
    });
    it('Word-utkastet, utskriften och EU-lönerapporten', async () => {
        const w = fonsterKon(null);
        const ord = w.__docDraftHtml();
        // Utskriften har flera tabeller med en rad per BAS: prövningen gäller avsnittet om struktur.
        const tryck = (await utskriftAv(w, 'komplett')).innerHTML.split('Struktur och lönetransparens')[1];
        for (const [namn, html] of [['Word', ord], ['utskrift', tryck]]) {
            for (const bas of KON_BAS) {
                const rad = radFor(html, bas);
                expect(rad, `${namn} ${bas}`).not.toBeNull();
                expect(rad, `${namn} ${bas}`).toMatch(/—[\s|]*$/);
            }
            expect(html, namn).toMatch(/ett av könen har färre än 10 personer/);
        }
        await laddaXlsx(w);
        const eu = Object.values(fangaBocker(w, () => w.eval('exportEuReport()')))[0];
        const rep = eu.split('[Representation]')[1].split('[')[0];
        for (const bas of KON_BAS) expect(rep.split('\n').find(r => r.startsWith(bas + ' |')), bas).toMatch(/\|\s*$/);
        expect(rep).toMatch(/Y1, Y2, Y3/);   // namnges i slutraden om könsgap
        expect(harNagon(eu, KON_GAP)).toEqual([]);
    });
    it('i exportläget vid 2 visas gapet för Y2 och Y3 (2 och 3 män)', () => {
        const w = iExport(fonsterKon(2));
        w.__renderTabContent('struktur');
        const t = w.document.getElementById('struktur-representation').innerHTML;
        expect(radFor(t, 'Y2')).toContain((KON_KV[1] / KON_MA[1] * 100).toFixed(1).replace('.', ','));   // kvinnors median i % av mäns
        expect(radFor(t, 'Y1')).toMatch(/–[\s|]*$/);   // en enda man: under tröskeln 2
    });
});

describe('C3: könsuppdelade mått för hela organisationen kräver tröskeln för varje kön', () => {
    // 60 kvinnor och 3 män: männens median är en enskild mans lön.
    const MAN = [41417, 43719, 47827];
    const fonster3 = k => {
        const w = createAppWindow();
        if (k !== null) w.eval(`sattKTroskel(${k}, { fraga: false })`);
        const rad = (bas, kon, lon, alder) => ({ bas, kon, lon, alder, yrke: '6000 Yrke', aid: '6000', yrkeLabel: 'Yrke', enhet: '' });
        const r = [];
        for (let i = 0; i < 60; i++) r.push(rad(i < 30 ? 'S1' : 'S2', 'kvinna', 25000 + i * 10, 30 + i % 20));
        MAN.forEach((l, i) => r.push(rad('S1', 'man', l, 40 + i)));
        w.__state.data = r;
        iExport(w);   // måtten prövas så som de lämnar verktyget; skärmen maskerar inget (ADR-51)
        w.eval('populateSelects(); unlockTabs(); refreshCurrentTab();');
        return w;
    };
    const kvMed = 25295, gap = [(kvMed / MAN[1] - 1) * 100, kvMed / MAN[1] * 100].flatMap(v => [v.toFixed(1), v.toFixed(2)]).map(s => s.replace('-', ''));
    const NOT = /Könsuppdelade lönemått redovisas inte eftersom ett kön har färre än 10 personer/;
    it('Word-utkastet', () => {
        const t = normalisera(fonster3(null).__docDraftHtml());
        expect(harNagon(t, MAN)).toEqual([]);
        expect(t).toMatch(NOT);
    });
    it.each(['komplett', 'ledning', 'facklig'])('utskriften (%s)', async mall => {
        const w = fonster3(null);
        const t = normalisera((await utskriftAv(w, mall)).textContent);
        expect(harNagon(t, MAN)).toEqual([]);
        expect(harNagon(t, gap)).toEqual([]);
        expect(t).toMatch(NOT);
    });
    it('Översikt: nyckeltalet för löneskillnad visar inget värde', () => {
        const w = fonster3(null);
        const el = w.document.getElementById('stat-paygap');
        expect(harNagon(el.textContent, gap)).toEqual([]);
        expect(el.textContent).toMatch(/–/);
        expect(el.textContent).toMatch(/färre än 10/);
    });
    it('Struktur: percentiltabellen, EU-nyckeltalen och kvartilernas könsfördelning', () => {
        const w = fonster3(null);
        w.__renderTabContent('struktur');
        const d = w.document;
        expect(harNagon(normalisera(d.getElementById('view-struktur').textContent + d.getElementById('struktur-narrative').value), [...MAN, ...gap])).toEqual([]);
        expect(d.getElementById('struktur-distribution').textContent).toMatch(NOT);
        expect(d.getElementById('struktur-eu').textContent).toMatch(NOT);
        // Kvartilerna: antal per kvartil står kvar, könsfördelningen inte (tre män i Q4 säger var de tjänar).
        const q4 = [...d.querySelectorAll('#struktur-eu tbody tr')].find(tr => /Q4/.test(tr.textContent));
        expect([...q4.children].slice(3).map(td => td.textContent.trim())).toEqual(['–', '–', '–']);
    });
    it('EU-lönerapporten', async () => {
        const w = fonster3(null);
        await laddaXlsx(w);
        const eu = Object.values(fangaBocker(w, () => w.eval('exportEuReport()')))[0];
        expect(harNagon(eu, [...MAN, ...gap])).toEqual([]);
        expect(eu).toMatch(NOT);
        expect(eu.split('[Kvartilfördelning]')[1].split('[')[0]).not.toMatch(/Q4 \|[^\n]*\| 3 \|/);
    });
    it('A/B-ögonblicksbilden bär inga könsuppdelade medianer', () => {
        const s = fonster3(null).eval('buildAnalysisSnapshot()');
        expect(s.medianKv).toBeNull();
        expect(s.medianMa).toBeNull();
        expect(s.rawGapPct).toBeNull();
        expect(s.nMa).toBe(3);
    });
    it('Löneöversyn: råa lönegapet före och efter visas inte', () => {
        const w = fonster3(null);
        Object.assign(w.__state.forecast, { generell: { mode: 'pct', value: 2 } });
        w.__renderTabContent('loneoversyn');
        const t = w.document.getElementById('forecast-outcome').textContent;
        expect(harNagon(t, gap)).toEqual([]);
        expect(t).toMatch(NOT);
    });
    it('löneöversyn: en riktad rad till kvinnorna i S1 visar utfallet, men inte medianlönen i % av mäns', () => {
        const w = fonster3(null);
        w.__state.forecast.targets = [{ bas: 'S1', aid: '6000', kon: 'kvinna', lonCap: null, mode: 'kr', value: 500, dist: 'flat', targetLevel: 'median', pool: 'övrigt' }];
        w.__renderTabContent('loneoversyn');
        const t = normalisera(w.document.getElementById('forecast-outcome').textContent);
        expect(t).toMatch(/S1/);
        expect(harNagon(t, [...MAN, ...gap])).toEqual([]);
        expect(t).toMatch(NOT);
    });
    it('på skärmen redovisas måtten också med 3 män (ADR-51)', () => {
        const w = fonster3(null);
        w.__state.kLage = 'skarm';
        w.__renderTabContent('struktur');
        expect(normalisera(w.document.getElementById('struktur-distribution').textContent)).toContain(String(MAN[1]));
    });
    it('vid 3 (männens antal) redovisas måtten', async () => {
        const w = fonster3(3);
        expect(normalisera(w.__docDraftHtml())).toContain(String(MAN[1]));
        expect(w.eval('buildAnalysisSnapshot()').medianMa).toBe(MAN[1]);
        w.__renderTabContent('struktur');
        expect(normalisera(w.document.getElementById('struktur-distribution').textContent)).toContain(String(MAN[1]));
    });
});

// Bladet Lönepolitik i "Excel (alla flikar)": samma regler som fliken. Underlaget är könsfixturen (ställningstagande
// för varje BAS): Y1–Y3 har 1–3 män, X har 4 personer, E–F 6, A–D 20, S1–S7 150.
describe('C5: bladet Lönepolitik i Excel (alla flikar) följer tröskeln som fliken', () => {
    const bladet = async k => {
        const w = fonsterKon(k);
        await laddaXlsx(w);
        const bok = Object.values(fangaBocker(w, () => w.eval('exportAllToExcel()')))[0];
        expect(bok).toContain('[Lönepolitik]');
        const text = bok.split('[Lönepolitik]')[1].split('\n[')[0];
        const del = (fran, till) => text.split(fran)[1].split(till)[0];
        return { text, yrken: del('Yrkesgrupper mot sitt spann', 'Läget i spannet per kön'),
            kon: del('Läget i spannet per kön', 'Fördelningen i spannets tredjedelar'),
            tredjedelar: del('Fördelningen i spannets tredjedelar', 'Efterlevnad per BAS-intervall'), efterlevnad: text.split('Efterlevnad per BAS-intervall')[1] };
    };
    const rader = (del, bas) => del.split('\n').filter(r => r.startsWith(bas + ' |'));
    it('vid 10: läget per kön bara där varje kön når tröskeln; X, E, F utan efterlevnad; små yrkesgrupper utan lönemått', async () => {
        const b = await bladet(null);
        for (const bas of STORA) expect(rader(b.kon, bas), bas).toHaveLength(1);
        for (const bas of [...KON_BAS, 'X', ...SMA]) expect(rader(b.kon, bas), bas).toHaveLength(0);
        expect(b.kon).toMatch(/Visas inte \(ett kön har färre än 10 personer.*Y1, Y2, Y3/);
        expect(b.tredjedelar).toMatch(/Kvinnor \| \d+ \|/);
        for (const bas of ['X', ...SMA]) expect(rader(b.efterlevnad, bas), bas).toHaveLength(0);
        for (const bas of [...STORA, ...MELLAN]) expect(rader(b.efterlevnad, bas), bas).toHaveLength(1);
        expect(b.efterlevnad).toMatch(/Visas inte \(färre än 10 personer\): .*X/);
        // Småyrke (6 personer): antal och "under P10", men ingen median; Litet (4 personer) utelämnas och namnges.
        const sma = b.yrken.split('\n').find(r => /Småyrke 0/.test(r));
        expect(sma).toMatch(/^E \| 5400 \| Småyrke 0 \| 6 \| {2}\| {2}\| {2}\| {2}\| \d+ \|/);
        expect(b.yrken).not.toMatch(/Litet \| 4/);
        expect(b.yrken).toMatch(/Visas inte \(färre än 5 personer\): .*7002 Litet/);
        // Ett stort yrke har alla mått.
        expect(b.yrken.split('\n').find(r => /Säkeryrke 0/.test(r))).toMatch(/^S1 \| 6000 \| Säkeryrke 0 \| 15\d \| \d+ \| 22000 \| 52000 \| -?\d+(\.\d+)? \| \d+ \| BAS-nivå$/);
        for (const v of harNagon(b.text, [...KON_DOLDA, ...SENT_SMA])) expect.fail(`dolt värde i bladet: ${v}`);
    });
    it('vid 25: A–D (20 personer) mister efterlevnad och lönemått men behåller antal', async () => {
        const b = await bladet(25);
        for (const bas of MELLAN) expect(rader(b.efterlevnad, bas), bas).toHaveLength(0);
        expect(b.efterlevnad).toMatch(/Visas inte \(färre än 25 personer\): .*A, B, C, D/);
        expect(b.yrken.split('\n').find(r => /Mellanyrke 0/.test(r))).toMatch(/^A \| 5300 \| Mellanyrke 0 \| 20 \| {2}\| {2}\| {2}\| {2}\| \d+ \| BAS-nivå$/);
        for (const v of harNagon(b.text, [...KON_DOLDA, ...SENT_SMA, ...SENT_MELLAN])) expect.fail(`dolt värde i bladet: ${v}`);
        expect(b.tredjedelar).toMatch(/Kvinnor \| \d+ \|/);   // hela urvalet har hundratals av varje kön
    });
    it('utan ställningstagande finns inget blad', async () => {
        const w = fonsterKon(null);
        w.__state.policy = [];
        await laddaXlsx(w);
        const bok = Object.values(fangaBocker(w, () => w.eval('exportAllToExcel()')))[0];
        expect(bok).not.toContain('[Lönepolitik]');
        expect(bok).not.toContain('Bladet Lönepolitik');
    });
});

describe('C4: allt som visar gruppmått följer tröskeln när den ändras (den öppna fliken direkt, övriga när de öppnas)', () => {
    const fonsterPar = () => {
        const w = createAppWindow();
        w.eval('sattKTroskel(5, { fraga: false })');
        const rader = [];
        const lagg = (n, kon, lon, bas, aid) => { for (let i = 0; i < n; i++) rader.push({ bas, kon, lon: lon + (i % 3) * 10,
            alder: 30 + (i * 7) % 30, yrke: `${aid} Yrke ${aid}`, aid, yrkeLabel: `Yrke ${aid}`, enhet: '' }); };
        lagg(30, 'kvinna', 25000, 'A', '6000'); lagg(30, 'man', 25500, 'A', '6000');
        lagg(20, 'man', 50000, 'C', '6100'); lagg(4, 'kvinna', 50000, 'C', '6100');
        lagg(6, 'kvinna', 36421, 'C', '5300');
        // BAS D: 19 personer nära varandra och en långt över — ett extremvärde så länge BAS:et når det statistiska golvet.
        for (let i = 0; i < 19; i++) rader.push({ bas: 'D', kon: i % 2 ? 'man' : 'kvinna', lon: 30000 + i * 20, alder: 30 + i, yrke: '6200 Yrke 6200', aid: '6200', yrkeLabel: 'Yrke 6200', enhet: '' });
        rader.push({ bas: 'D', kon: 'man', lon: 91357, alder: 50, yrke: '6200 Yrke 6200', aid: '6200', yrkeLabel: 'Yrke 6200', enhet: '' });
        w.__state.data = rader;
        w.eval('populateSelects(); unlockTabs(); invalidateStatCaches();');
        // Som efter en vanlig inläsning (32-filinlasning.js): allt på Översikt är ritat.
        w.eval('renderActionChecklist(); renderProcessTracker(); renderDataValidationReport(); renderOutliers(); refreshCurrentTab();');
        return w;
    };
    const kort = w => normalisera(w.document.getElementById('action-checklist-container').textContent + w.document.getElementById('att-gora-borja').textContent);
    const csv = w => {
        w.eval('window.__csv = null; _downloadCSV = rows => { window.__csv = rows; }');
        w.document.getElementById('btn-export-checklist').click();
        return normalisera((w.__csv || []).map(r => r.join(' | ')).join('\n'));
    };
    it('5 → 10: Att göra på skärmen visar paret vid båda; CSV-filen (lämnar verktyget) utelämnar det vid 10 och anger antalet', () => {
        const w = fonsterPar();
        expect(kort(w)).toContain('Yrke 5300');
        expect(w.document.getElementById('process-tracker').textContent).not.toMatch(/par med en grupp under/);
        w.eval('sattKTroskel(10, { fraga: false })');
        expect(kort(w)).toContain('Yrke 5300');   // skärmen maskerar inget (ADR-51)
        const fil = csv(w);
        expect(fil).not.toContain('Yrke 5300');
        expect(fil).toMatch(/1 par med en grupp under 10 personer redovisas inte här/);
        // I exportläget är steg 4 "inget att hantera": paret redovisas bara i fliken (tests/troskelbeslut.test.js).
        w.__state.kLage = 'export'; w.eval('renderProcessTracker()');
        expect(w.document.getElementById('process-tracker').textContent).toMatch(/Inget att hantera i Att göra: 1 par har en grupp under 10 personer/);
    });
    it('10 → 25: inläsningsrapportens antal och extremvärdeslistan', () => {
        const w = fonsterPar();
        w.eval('sattKTroskel(10, { fraga: false })');
        const d = w.document;
        const maskerade = () => (d.getElementById('data-validation-report').textContent.match(/BAS under minsta gruppstorlek \(n<(\d+), redovisas inte i exporterna\):\s*(\d+)/) || []).slice(1).map(Number);
        expect(maskerade()).toEqual([]);                      // A 60, C 30, D 20: raden visas bara när något BAS är under tröskeln
        expect(normalisera(d.getElementById('outliers-table-wrap').textContent)).toContain('91357');
        w.eval('sattKTroskel(25, { fraga: false })');
        expect(maskerade()).toEqual([25, 1]);                 // D (20) är nu under den inställda tröskeln
        // Extremvärdeslistan följer det statistiska golvet, max(inställd tröskel, 10) — samma i båda lägena (ADR-51).
        expect(normalisera(d.getElementById('outliers-table-wrap').textContent)).not.toContain('91357');
        expect(d.getElementById('data-validation-report').textContent).toMatch(/Inga extremvärden/);
    });
    it('vid en ändring ritas bara den öppna fliken om, en gång; de övriga är inaktuella tills de öppnas', () => {
        const w = fonsterPar();
        for (const f of ['matrix', 'struktur', 'prioritering']) w.__renderTabContent(f);
        oppnaFlik(w, 'struktur');
        w.eval('window.__antal = {}; const __orig = renderTabContent; renderTabContent = function (f) { window.__antal[f] = (window.__antal[f] || 0) + 1; return __orig(f); };');
        w.eval('sattKTroskel(10, { fraga: false })');
        expect(w.__antal).toEqual({ struktur: 1 });
        expect(w.eval("flikInaktuell('struktur')")).toBe(false);
        expect(w.eval("flikInaktuell('matrix') && flikInaktuell('prioritering')")).toBe(true);
        // De flikar som inte syns bär inget från den gamla tröskeln: diagrammen är tömda. (Tabellerna i Lika arbete
        // ritas om av Översikts statusrutor, med den nya tröskeln — att inget gammalt står kvar prövas med
        // kontrollvärden i "höjning 10 → 25" ovan och i invarianten I4.)
        expect(w.document.querySelectorAll('#view-prioritering [id^="chart-"] svg').length).toBe(0);
        // Navigeringen ritar fliken när den öppnas.
        oppnaFlik(w, 'matrix');
        expect(w.eval("flikInaktuell('matrix')")).toBe(false);
        expect(w.document.querySelectorAll('#paygap-table tbody tr').length).toBeGreaterThan(0);
    });
});

describe('C6: räkneexemplet i kronor per år bara när båda könen når tröskeln', () => {
    // G: 12 kvinnor och 12 män, kvinnorna omkring 3 000 kr lägre. H: 12 kvinnor och 4 män (under tröskeln).
    const fonster = () => {
        const w = createAppWindow();
        const rad = (yrke, aid, kon, lon, i) => ({ bas: 'C', kon, lon, alder: 30 + i, yrke: `${aid} ${yrke}`, aid: String(aid), yrkeLabel: yrke, enhet: '' });
        w.__state.data = [...Array.from({ length: 12 }, (_, i) => rad('Gyrke', 8101, 'kvinna', 30000 + i * 37, i)), ...Array.from({ length: 12 }, (_, i) => rad('Gyrke', 8101, 'man', 33000 + i * 41, i)),
                          ...Array.from({ length: 12 }, (_, i) => rad('Hyrke', 8102, 'kvinna', 30000 + i * 29, i)), ...Array.from({ length: 4 }, (_, i) => rad('Hyrke', 8102, 'man', 88123 + i, i))];
        w.eval('populateSelects(); unlockTabs();');
        w.__state.kLage = 'export';   // dossierns text lämnar verktyget (ADR-51)
        return w;
    };
    it('dossiern och textkopian: kronsumman med prioriteringens formel för G, ingen för H', () => {
        const w = fonster(), cs = w.__state.costSettings;
        const g = w.eval('buildGruppdossier(gruppdossierCandidates().find(c => c.key.startsWith("8101")).key)');
        const h = w.eval('buildGruppdossier(gruppdossierCandidates().find(c => c.key.startsWith("8102")).key)');
        const diff = Math.round((g.gap.medMa - g.gap.medKv) / 100) * 100;
        const vantat = Math.round(diff * cs.months * (1 + cs.poPct / 100) * 12 / 1000) * 1000;
        expect(Number(/omkring ([\d\s\u00a0]+) kr per år/.exec(g.gap.arsbelopp)[1].replace(/\D/g, ''))).toBe(vantat);
        expect(w.eval('gruppdossierAsText')(g)).toContain(g.gap.arsbelopp);
        expect(h.gap).toBeNull();
        const hText = w.eval('gruppdossierAsText')(h);
        expect(hText).not.toMatch(/Räkneexempel|kr per år/);
        expect(hText).not.toMatch(/8812\d/);
    });
    it('rapportunderlaget: meningen i gruppblocket för en flaggad grupp, aldrig för H', () => {
        const w = fonster();
        const block = w.eval('rapportunderlagBlock()').filter(b => String(b.id).startsWith('yrke:'));
        for (const b of block) {
            expect(b.rubrik).not.toMatch(/Hyrke/);
            expect(b.stycken.join(' ')).toMatch(/Räkneexempel: kvinnornas medianlön ligger [\d\s\u00a0]+ kr per månad under männens/);
        }
        expect(block.map(b => b.rubrik)).toEqual([expect.stringMatching(/Gyrke/)]);
        expect(JSON.stringify(block)).not.toMatch(/8812\d/);
    });
    it('ingen mening när skillnaden är under 100 kr eller kvinnorna ligger högre', () => {
        const w = fonster(), f = w.eval('_prArsbeloppMening'), kr = v => `${v} kr`;
        expect(f({ medKv: 30000, medMa: 30040, nKv: 10 }, { months: 12, poPct: 0 }, kr)).toBeNull();
        expect(f({ medKv: 31000, medMa: 30000, nKv: 10 }, { months: 12, poPct: 0 }, kr)).toBeNull();
        expect(f({ medKv: 30000, medMa: 31000, nKv: 10 }, { months: 12, poPct: 0 }, kr)).toMatch(/omkring 120000 kr per år/);
    });
});

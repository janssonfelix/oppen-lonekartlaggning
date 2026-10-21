/**
 * Röktest (jsdom): Word-utkastet som .docx och minsta gruppstorlek (ADR-38).
 *
 * Utbrutet ur smoke.test.js så att Vitest fördelar röktesterna över flera arbetare; varje describe-block
 * skapar sina egna fönster via createAppWindow (tests/helpers/app-harness.js).
 */
import { describe, it, expect } from 'vitest';
import { createAppWindow } from './helpers/app-harness.js';

describe('Word-utkastet som .docx', () => {
    const jszip = async w => {
        const { readFileSync } = await import('node:fs');
        const { join, dirname } = await import('node:path');
        const { fileURLToPath } = await import('node:url');
        // jsdom saknar setImmediate; JSZip:s schemaläggare väntar annars förgäves (webbläsare använder postMessage).
        w.setImmediate = (fn, ...a) => setTimeout(() => fn(...a), 0);
        w.eval(readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'vendor', 'jszip.min.js'), 'utf8'));
    };
    const text = s => String(s).replace(/\s+/g, '');
    it('HTML → block: rubriker, fyll i-rutor, tabeller och all text följer med', () => {
        const w = createAppWindow();
        w.__loadDemoData();
        const html = w.eval('_buildDocumentationDraftHtml()');
        const block = w.eval(`_utkastTillBlock(${JSON.stringify(html)})`);
        const rubriker = block.filter(b => b.typ === 'rubrik').map(b => b.delar.map(d => d.text).join(''));
        for (const n of [1, 2, 3, 4, 6, 7, 8]) expect(rubriker.some(r => r.startsWith(`${n}. `)), `avsnitt ${n}`).toBe(true);
        expect(rubriker.some(r => /^Bilaga/.test(r))).toBe(true);
        expect(block.filter(b => b.stil === 'fyllIn').length).toBeGreaterThanOrEqual(4);
        expect(block.some(b => b.stil === 'utkastruta')).toBe(true);
        const dom = new w.DOMParser().parseFromString(`<div>${html}</div>`, 'text/html');
        expect(block.filter(b => b.typ === 'tabell').map(b => b.rader.length + (b.rubrikrad ? 1 : 0)))
            .toEqual([...dom.querySelectorAll('table')].map(t => t.querySelectorAll('tr').length));
        // Ett diagram är ett bildblock som bär sin bildtext (bilden själv fylls i vid exporten).
        const bText = block.map(b => b.typ === 'tabell'
            ? [b.rubrikrad || [], ...b.rader].flat().map(c => c.delar.map(d => d.text).join('')).join('')
            : b.typ === 'bild' ? b.text : b.delar.map(d => d.text).join('')).join('');
        expect(block.filter(b => b.typ === 'bild').map(b => b.id)).toEqual([...dom.querySelectorAll('figure[data-rm-bild]')].map(f => f.getAttribute('data-rm-bild')));
        expect(text(bText)).toBe(text(dom.body.textContent));
    });
    it('avsnittet om struktur bär översikten per BAS-intervall — samma rader och tal som fliken Lika arbete öppnar med', () => {
        const w = createAppWindow();
        w.__loadDemoData();
        w.__renderTabContent('matrix');
        const ren = t => t.replace(/[\u00a0\u202f]/g, ' ');
        const skarm = [...w.document.querySelectorAll('#la-oversikt tbody tr')].map(tr => [...tr.children].map(c => ren(c.textContent)));
        expect(skarm.length).toBeGreaterThan(0);
        const struktur = w.eval('rapportModell()').avsnitt.find(a => a.id === 'struktur');
        const ri = struktur.delar.findIndex(d => d.typ === 'rubrik' && d.text === 'Kvinnors och mäns lön per BAS-intervall');
        const tabell = struktur.delar[ri + 1];
        expect(tabell.kolumner.map(k => k.rubrik)).toEqual(['BAS', 'Kvinnor / män', 'Median kvinnor', 'Median män', 'Skillnad', 'Kvinnors lön i % av mäns', '95 % konfidensintervall', 'Status']);
        const celler = tabell.rader.map(r => r.map((v, i) => ren(w.rmCell ? w.rmCell(v, tabell.kolumner[i].typ) : w.eval('rmCell')(v, tabell.kolumner[i].typ))));
        expect(celler.map(c => 'BAS ' + c[0])).toEqual(skarm.map(c => c[0]));                       // samma BAS-intervall, samma ordning
        celler.forEach((c, n) => {
            expect([c[1], c[2], c[3], c[4]]).toEqual([skarm[n][1], skarm[n][2], skarm[n][3], skarm[n][4]]);   // antal, medianer, skillnad
            expect(skarm[n][6]).toBe(c[5] + c[6]);                                                    // kvoten följd av intervallet, som i skärmens cell
            expect(c[7]).toBe(skarm[n][7]);                                                           // status i ord
        });
        // Tabellen står före bilden av samma kvot, och finns i både Word-utkastet och utskriften.
        expect(struktur.delar.findIndex(d => d.typ === 'diagram' && d.id === 'chart-skevhet-overview')).toBeGreaterThan(ri);
        expect(ren(w.eval('rmTillHtml(rapportModell())'))).toContain('Kvinnors och mäns lön per BAS-intervall');
        expect(ren(w.__docDraftHtml())).toContain(celler[0][6]);
        // Höjd tröskel: inget BAS har båda könen över den — tabellen följer inte med, och inget tal ur den står kvar.
        w.eval('sattKTroskel(200, { fraga: false })');
        const s2 = (w.eval('rapportModell()').avsnitt.find(a => a.id === 'struktur') || { delar: [] });
        expect(s2.delar.some(d => d.typ === 'rubrik' && d.text === 'Kvinnors och mäns lön per BAS-intervall')).toBe(false);
    });
    it('rapportmodellen: tio avsnitt, tabeller med tal som tal, och lönegapet som kvinnors lön i procent av mäns', () => {
        const w = createAppWindow();
        w.__loadDemoData();
        const m = w.eval('rapportModell()');
        expect(m.avsnitt.map(a => a.id)).toEqual(['sammanfattning', 'regler', 'lika', 'likvardigt', 'struktur', 'atgarder', 'samverkan', 'beslut', 'regression', 'metod']);
        expect(m.demo).toBe(true);
        const delar = id => m.avsnitt.find(a => a.id === id).delar;
        const tabeller = id => delar(id).filter(p => p.typ === 'tabell');
        // Tal står som tal i modellen; formen sätts av den som ritar. Modellen bär verktygets gap, (kvinnor − män) / män;
        // kolumntypen `direktiv` låter ritaren vända tecknet (EU 2023/970 art. 9).
        const struktur = tabeller('struktur')[0];
        expect(struktur.kolumner.map(c => c.typ)).toEqual(['text', 'antal', 'pct0', 'kr', 'direktiv']);
        for (const r of struktur.rader) { expect(typeof r[1]).toBe('number'); expect(typeof r[3]).toBe('number'); expect(r[4] === null || typeof r[4] === 'number').toBe(true); }
        expect(struktur.rader.every(r => r[1] >= 10)).toBe(true);                // bara BAS-intervall som når tröskeln
        const html = w.eval('rmTillHtml(rapportModell())');
        const dok = new w.DOMParser().parseFromString(`<div>${html}</div>`, 'text/html');
        // Avsnittet om lönetransparens: direktivets tecken, utskrivet, positivt när kvinnor ligger lägre.
        const direktiv = [...dok.querySelectorAll('table')].find(t => /Andel kvinnor/.test(t.textContent) && /Lönegap enligt art\. 9/.test(t.textContent));
        const dVarden = [...direktiv.querySelectorAll('tbody tr')].map(tr => tr.lastElementChild.textContent);
        expect(dVarden.length).toBeGreaterThan(0);
        for (const v of dVarden) expect(v).toMatch(/^([+−]\d{1,2},\d %|0,0 %|—)$/);
        const gapB = struktur.rader.find(r => r[4] !== null);
        expect(dVarden[struktur.rader.indexOf(gapB)]).toBe(`${gapB[4] < 0 ? '+' : '−'}${Math.abs(gapB[4]).toFixed(1).replace('.', ',')} %`);
        // Lönegapets form i övrigt: kvinnors lön i procent av mäns — inget minustecken i de kolumnerna.
        const kolumn = [...dok.querySelectorAll('table')].find(t => /Kvinnors lön i % av mäns/.test(t.textContent) && /Median kvinnor/.test(t.textContent));
        const varden = [...kolumn.querySelectorAll('tbody tr')].map(tr => tr.children[5].textContent);
        expect(varden.length).toBeGreaterThan(0);
        for (const v of varden) expect(v).toMatch(/^(\d{2,3},\d %|—)$/);
        expect(html).toMatch(/<th>Kvinnors medianlön i procent av mäns<\/th><td>\d{2,3},\d %<\/td>/);
        expect(html).not.toMatch(/Ojusterat lönegap|Gap \(Kv vs Mä\)/);
        // Regressionens gap behåller sin form, och det sägs i klartext.
        expect(html).toMatch(/Löneskillnad som står kvar efter ålder och nivå<\/th><td><strong>[+−]\d+,\d\d %/);
        expect(html).toContain('negativ när kvinnor ligger lägre');
        // Diagrammen hör till ett avsnitt och pekar ut fliken som ritar dem.
        const diagram = m.avsnitt.flatMap(a => a.delar.filter(p => p.typ === 'diagram').map(p => `${a.id}:${p.id}:${p.flik}`));
        expect(diagram).toEqual(expect.arrayContaining(['struktur:chart-skevhet-overview:matrix', 'struktur:chart-skevhet-andel:matrix', 'struktur:chart-struktur-kvartiler:struktur', 'lika:chart-perbas-gap:matrix']));
        // Fälten att fylla i finns kvar i varje avsnitt som hade dem.
        for (const id of ['sammanfattning', 'lika', 'likvardigt', 'atgarder', 'samverkan', 'beslut']) expect(delar(id).some(p => p.typ === 'fyllIn'), id).toBe(true);
        // Metodbilagan har en rubrik, inte två.
        expect((html.match(/Metod (och|&amp;) parametrar/g) || []).length).toBe(1);
    });
    it('rapportmodellen: tröskeln tillämpas när modellen byggs, och varje avsnitt säger vad det utelämnar', () => {
        const w = createAppWindow();
        w.__loadDemoData();
        const vid = k => { w.eval(`sattKTroskel(${k}, { fraga: false })`); return w.eval('rapportModell()'); };
        const m25 = vid(25), s25 = m25.avsnitt.find(a => a.id === 'struktur');
        const tabell = s25.delar.find(p => p.typ === 'tabell');
        expect(tabell.rader.every(r => r[1] >= 25)).toBe(true);
        expect(s25.utelamnat.join(' ')).toMatch(/BAS .*färre än 25 personer/);
        expect(s25.delar.some(p => p.typ === 'stycke' && p.stil === 'not')).toBe(true);
        // Kandidatparens diagram följer bara med när inget par är utelämnat (samma regel som rapportunderlaget).
        const lv = m25.avsnitt.find(a => a.id === 'likvardigt');
        const harDiagram = lv.delar.some(p => p.typ === 'diagram'), utelamnar = lv.utelamnat.some(t => /kandidatpar/.test(t));
        expect(harDiagram && utelamnar).toBe(false);
        // Ett kön under tröskeln: inga könsuppdelade lönemått i sammanfattningen.
        const m150 = vid(150), sam = m150.avsnitt.find(a => a.id === 'sammanfattning');
        const rader = sam.delar.find(p => p.typ === 'tabell').rader;
        expect(rader.find(r => r[0] === 'Medianlön kvinnor / män')[1]).toMatch(/redovisas inte/);
        expect(rader.some(r => r[0] === 'Kvinnors medianlön i procent av mäns')).toBe(false);
        expect(sam.utelamnat.length).toBe(1);
    });
    it('rmCell: varje kolumntyp i svenskt talformat, och streck för det som inte redovisas', () => {
        const w = createAppWindow();
        const c = (v, typ) => w.eval(`rmCell(${JSON.stringify(v)}, ${JSON.stringify(typ)})`).replace(/[  ]/g, ' ');
        expect(c(36725.4, 'kr')).toBe('36 725 kr');
        expect(c(1427679, 'krAr')).toBe('1 427 679 kr/år');
        expect(c(53.4, 'pct0')).toBe('53 %');
        expect(c(16.34, 'pct1')).toBe('16,3 %');
        expect(c(-4.437, 'tecken2')).toBe('−4,44 %');
        expect(c(2.5, 'tecken2')).toBe('+2,50 %');
        expect(c(-6.4, 'andelAvMan')).toBe('93,6 %');
        expect(c(null, 'andelAvMan')).toBe('—');
        expect(c(1234, 'antal')).toBe('1 234');
        expect(c('', 'fyllIn')).toBe('');
        expect(c({ text: 'Färdig text' }, 'kr')).toBe('Färdig text');
    });
    it('urvalet styr vilka avsnitt som följer med och i vilken ordning, och numreringen följer urvalet', () => {
        const w = createAppWindow();
        w.__loadDemoData();
        const rubriker = () => w.eval('rapportModell()').avsnitt.map(a => a.rubrik);
        expect(w.eval('rapportUrval()').namn).toBe('Hela dokumentationen');
        expect(rubriker().map(r => r.slice(0, 2))).toEqual(['1.', '2.', '3.', '4.', '5.', '6.', '7.', '8.', 'Bi', 'Bi']);
        w.eval("sattRapportUrval('ledning')");
        expect(w.eval('rapportUrval()').namn).toBe('Ledningsbrief');
        expect(w.eval('rapportModell()').avsnitt.map(a => a.id)).toEqual(['sammanfattning', 'lika', 'likvardigt', 'atgarder']);
        expect(rubriker().map(r => r.slice(0, 2))).toEqual(['1.', '2.', '3.', '4.']);               // numrerade om, utan luckor
        expect(rubriker()[3]).toMatch(/^4\. Åtgärder och tidsplan/);
        // Eget urval: annan ordning, ett avsnitt bort; okända namn hoppas över.
        w.eval("sattRapportUrval({ ordning: ['struktur', 'sammanfattning', 'finns-inte', 'lika'], med: ['struktur', 'lika', 'metod', 'finns-inte'] })");
        expect(w.eval('rapportModell()').avsnitt.map(a => a.id)).toEqual(['struktur', 'lika', 'metod']);
        expect(w.eval('rapportUrval()').namn).toBe('Eget urval (3 av 10 avsnitt)');
        expect(rubriker()[0]).toMatch(/^1\. Struktur/);
        // Utkastet följer urvalet; listan med alla avsnitt gör det inte.
        const html = w.eval('_buildDocumentationDraftHtml()');
        expect(html).not.toMatch(/Samverkan med arbetstagarna/);
        expect(w.eval('rapportModell({ alla: true })').avsnitt).toHaveLength(10);
        // Rensning återställer urvalet.
        w.eval('_rensaAllData()');
        expect(w.__state.rapportUrval).toBeNull();
    });
    it('urvalet följer med i konfigurationsfilen, och en fil med fel form avvisas utan att något ändras', () => {
        const w = createAppWindow();
        w.__loadDemoData();
        w.eval("sattRapportUrval('facklig')");
        const cfg = w.eval('JSON.parse(JSON.stringify(buildConfigSnapshot()))');
        expect(cfg.rapportUrval.med).toEqual(['sammanfattning', 'regler', 'lika', 'likvardigt', 'struktur', 'samverkan', 'regression', 'metod']);
        w.eval("sattRapportUrval('hela')");
        expect(w.eval('buildConfigSnapshot().rapportUrval')).toBeNull();
        w.__cfg = cfg;
        w.eval('applyConfigSnapshot(window.__cfg)');
        expect(w.eval('rapportUrval()').namn).toBe('Facklig dialog');
        w.__cfg = { ...cfg, rapportUrval: { ordning: 'lika', med: [] } };
        expect(() => w.eval('applyConfigSnapshot(window.__cfg)')).toThrow(/rapportUrval/);
        expect(w.eval('rapportUrval()').namn).toBe('Facklig dialog');
        // En fil utan fältet ger hela dokumentationen.
        const { rapportUrval: _bort, ...utanUrval } = cfg;
        w.__cfg = utanUrval;
        w.eval('applyConfigSnapshot(window.__cfg)');
        expect(w.eval('rapportUrval()').namn).toBe('Hela dokumentationen');
    });
    it('förhandsbeskedet säger vad filen innehåller och utelämnar, och räknas ur samma källa som filen', async () => {
        const w = createAppWindow();
        await jszip(w);
        w.__loadDemoData();
        const d = w.document;
        d.querySelector('.nav-item[data-tab="dokumentera"]').click();
        const word = () => d.getElementById('besked-word').textContent;
        const m = w.eval('rmBesked(rapportModell())');
        expect(word()).toContain(`Hela dokumentationen · 10 avsnitt · ${m.tabeller} tabeller · ${m.diagram} diagram · ${m.fyllIn} fält att fylla i`);
        expect(d.getElementById('nyckel-ex-urval').textContent).toBe('Hela dokumentationen');
        // Excel: bladen i beskedet är bladen i filen.
        // Excel: beskedet listar bladen (att listan är filens blad prövas mot en riktig arbetsbok i exports.golden.test.js).
        const blad = w.eval('excelAlltBlad()');
        expect(d.getElementById('besked-excel').textContent).toContain(`${blad.length} blad — ${blad.join(', ')}`);
        expect(d.getElementById('besked-excel').textContent).toContain('färre än 10 personer');
        expect(d.getElementById('besked-zip').textContent).toContain(`Word-utkastet, Excel-filen (${blad.length} blad) och diagrammen i alla flikar`);
        // PDF-rapporten är samma modell: med hela dokumentationen följer bilagorna med, med ett kortare urval inte.
        expect(d.getElementById('besked-pdf').textContent).toContain('Hela dokumentationen · 10 avsnitt');
        expect(d.getElementById('besked-pdf').textContent).toContain('bilagor med flikarnas tabeller och diagram');
        // Urvalslistan: en rad per avsnitt, utan paragrafhänvisningar; ett färdigt urval ändrar beskedet.
        const rader = () => [...d.querySelectorAll('#rapport-urval .urval-rad')];
        expect(rader()).toHaveLength(10);
        expect(d.getElementById('rapport-urval').textContent).not.toMatch(/§|2023\/970/);
        d.querySelector('[data-urval-fast="ledning"]').click();
        expect(word()).toContain('Ledningsbrief · 4 avsnitt');
        expect(d.getElementById('besked-pdf').textContent).toMatch(/Ledningsbrief · 4 avsnitt.*inga bilagor/);
        expect(d.querySelector('[data-urval-fast="ledning"]').getAttribute('aria-pressed')).toBe('true');
        expect(rader().filter(r => r.querySelector('input').checked).map(r => r.dataset.urvalId)).toEqual(['sammanfattning', 'lika', 'likvardigt', 'atgarder']);
        // En ruta och en flytt ger ett eget urval; första raden kan inte flyttas upp.
        const ruta = d.querySelector('[data-urval-med="metod"]');
        ruta.checked = true; ruta.dispatchEvent(new w.Event('change', { bubbles: true }));
        expect(word()).toContain('Eget urval (5 av 10 avsnitt)');
        expect(rader()[0].querySelector('[data-urval-flytta="-1"]').disabled).toBe(true);
        rader()[2].querySelector('[data-urval-flytta="-1"]').click();
        expect(rader().map(r => r.dataset.urvalId).slice(0, 3)).toEqual(['sammanfattning', 'lika', 'regler']);
        expect(w.eval('rapportModell()').avsnitt.map(a => a.id)).toEqual(['sammanfattning', 'lika', 'likvardigt', 'atgarder', 'metod']);
        // Med höjd tröskel säger beskedet vad som utelämnas, och Word-filen följer urvalet.
        w.eval('sattKTroskel(25, { fraga: false })');
        d.querySelector('.nav-item[data-tab="dokumentera"]').click();
        d.querySelector('[data-urval-fast="hela"]').click();
        expect(word()).toMatch(/Utelämnar: .*BAS .*färre än 25 personer/);
        d.querySelector('[data-urval-fast="ledning"]').click();
        let fangad = null;
        w._laddaNerBlob = (blob, namn) => { fangad = { blob, namn }; };
        expect(await w.eval('exportDocumentationDraft()')).toBe(true);
        const doc = await (await w.JSZip.loadAsync(await fangad.blob.arrayBuffer())).file('word/document.xml').async('string');
        expect(doc).toContain('4. Åtgärder och tidsplan');
        expect(doc).not.toContain('Samverkan med arbetstagarna');
    });
    it('nyckel/värde-tabeller utan thead: ingen rubrikrad, th-celler feta', () => {
        const w = createAppWindow();
        const b = w.eval(`_utkastTillBlock('<table><tr><th>Antal</th><td>12</td></tr><tr><th>Urval</th><td>Alla</td></tr></table>')`)[0];
        expect(b.rubrikrad).toBeNull();
        expect(b.rader[0][0].delar[0]).toMatchObject({ text: 'Antal', fet: true });
        expect(b.rader[0][1].delar[0].fet).toBeFalsy();
    });
    it('exporten ger en .docx med rätt typ; zip:en innehåller utkastet med organisationens namn', async () => {
        const w = createAppWindow();
        await jszip(w);
        w.__loadDemoData();
        let fangad = null;
        w._laddaNerBlob = (blob, namn) => { fangad = { blob, namn }; };
        expect(await w.eval('exportDocumentationDraft()')).toBe(true);
        expect(fangad.namn).toMatch(/^Lonekartlaggning_\d{4}_dokumentation_UTKAST_DEMODATA_\d{4}-\d{2}-\d{2}\.docx$/);
        expect(fangad.blob.type).toBe('application/vnd.openxmlformats-officedocument.wordprocessingml.document');
        const zip = await w.JSZip.loadAsync(await fangad.blob.arrayBuffer());
        const doc = await zip.file('word/document.xml').async('string');
        expect(doc).toContain('Exempelkommunen');
        expect(await zip.file('word/footer1.xml').async('string')).toContain('DEMODATA, UTKAST');
        expect(new w.DOMParser().parseFromString(doc, 'application/xml').getElementsByTagName('parsererror').length).toBe(0);
    });
    it('en anteckning med styrtecken och < & ger fortfarande välformad XML', async () => {
        const w = createAppWindow();
        await jszip(w);
        w.__loadDemoData();
        w.eval("_bes8Areas = () => [{ title: 'Löneregler', status: 'Möjlig risk', note: 'Rad 1\\u0007 <b> & rad 2' }]");
        let fangad = null;
        w._laddaNerBlob = (blob, namn) => { fangad = { blob, namn }; };
        await w.eval('exportDocumentationDraft()');
        const zip = await w.JSZip.loadAsync(await fangad.blob.arrayBuffer());
        const doc = await zip.file('word/document.xml').async('string');
        expect(new w.DOMParser().parseFromString(doc, 'application/xml').getElementsByTagName('parsererror').length).toBe(0);
        expect(doc).toContain('&lt;b&gt; &amp; rad 2');
    });
    it('utan JSZip: felmeddelande, ingen nedladdning', async () => {
        const w = createAppWindow();
        w.__loadDemoData();
        delete w.JSZip;
        let meddelande = '', nerladdad = false;
        w.alert = m => { meddelande = m; };
        w._laddaNerBlob = () => { nerladdad = true; };
        expect(await w.eval('exportDocumentationDraft()')).toBe(false);
        expect(meddelande).toMatch(/Word-utkastet kunde inte skapas/);
        expect(nerladdad).toBe(false);
    });
});

describe('lönerevisionssimulatorn följer minsta gruppstorlek (ADR-38)', () => {
    // 30 kvinnor och 30 män i A, 6 kvinnor i C: urvalet "kvinnor i C" är under tröskeln 10.
    const fonster = () => {
        const w = createAppWindow();
        const rader = [];
        const lagg = (n, kon, lon, bas, aid) => { for (let i = 0; i < n; i++) rader.push({ bas, kon, lon: lon + i * 100,
            alder: 30 + (i * 7) % 30, yrke: `${aid} Yrke ${aid}`, aid, yrkeLabel: `Yrke ${aid}`, enhet: '' }); };
        lagg(30, 'kvinna', 25000, 'A', '6000'); lagg(30, 'man', 25500, 'A', '6000'); lagg(6, 'kvinna', 36000, 'C', '5300');
        w.__state.data = rader;
        w.eval('populateSelects(); unlockTabs();');
        return w;
    };
    const valj = (w, kon, bas) => {
        const d = w.document;
        d.getElementById('sim-kon').value = kon;
        d.getElementById('sim-bas').value = bas;
        d.getElementById('sim-bas').dispatchEvent(new w.Event('change'));
    };
    it('urval under tröskeln: knappen är inaktiv och meningen står där utfallet annars visas; vidgat urval tar bort den', () => {
        const w = fonster();
        const d = w.document;
        valj(w, 'kvinna', 'C');
        expect(d.getElementById('sim-run').disabled).toBe(true);
        expect(d.getElementById('sim-results').style.display).toBe('block');
        expect(d.getElementById('sim-results').textContent).toMatch(/urvalet \(kön, BAS-intervall och lönegräns\) 6 personer, färre än 10 \(minsta gruppstorlek för redovisning\)/);
        expect(d.getElementById('sim-results').textContent).not.toMatch(/\d{5}/);
        valj(w, 'kvinna', 'A');
        expect(d.getElementById('sim-run').disabled).toBe(false);
        expect(d.getElementById('sim-results').style.display).toBe('none');
        d.getElementById('sim-run').click();
        expect(d.getElementById('sim-results').textContent).toMatch(/Berörda personer\s*30/);
    });
    it('åtgärd som berör färre än tröskeln: utfallet ersätts av meningen, också i min/max-spannet', () => {
        const w = fonster();
        const d = w.document;
        valj(w, 'kvinna', 'A');
        d.getElementById('sim-action').value = 'raise_to';
        d.getElementById('sim-amount').value = '25150';         // två kvinnor ligger under
        d.getElementById('sim-run').click();
        const t = d.getElementById('sim-results').textContent;
        expect(t).toMatch(/åtgärden berör 2 personer, färre än 10/);
        expect(t).not.toMatch(/kr/);
        d.getElementById('sim-amount-max').value = '30000';      // max-scenariot berör alla 30, min-scenariot 2
        d.getElementById('sim-run').click();
        expect(d.getElementById('sim-results').textContent).toMatch(/åtgärden berör 2 personer/);
        expect(d.getElementById('sim-results').textContent).not.toMatch(/min\/max/);
    });
    it('höjd tröskel efter ett visat utfall: fliken ritas om och knappen blir inaktiv', () => {
        const w = fonster();
        const d = w.document;
        valj(w, 'kvinna', 'A');
        d.getElementById('sim-run').click();
        expect(d.getElementById('sim-results').textContent).toMatch(/Berörda personer/);
        w.eval('sattKTroskel(50, { fraga: false })');
        w.__renderTabContent('prioritering');
        expect(d.getElementById('sim-run').disabled).toBe(true);
        expect(d.getElementById('sim-results').textContent).toMatch(/30 personer, färre än 50/);
    });
});

describe('robusthetspanelen följer minsta gruppstorlek (ADR-38)', () => {
    // Ett kandidatpar: 6 kvinnor i yrke 5300 (BAS C) mot 20 män i yrke 6100 — den lilla gruppen är under tröskeln 10.
    const fonster = () => {
        const w = createAppWindow();
        const rader = [];
        const lagg = (n, kon, lon, bas, aid) => { for (let i = 0; i < n; i++) rader.push({ bas, kon, lon: lon + (i % 3) * 10,
            alder: 30 + (i * 7) % 30, yrke: `${aid} Yrke ${aid}`, aid, yrkeLabel: `Yrke ${aid}`, enhet: '' }); };
        lagg(30, 'kvinna', 25000, 'A', '6000'); lagg(30, 'man', 25500, 'A', '6000');
        lagg(20, 'man', 50000, 'C', '6100'); lagg(4, 'kvinna', 50000, 'C', '6100');
        lagg(6, 'kvinna', 36421, 'C', '5300');
        w.__state.data = rader;
        w.eval('populateSelects(); unlockTabs();');
        return w;
    };
    it('paret med en grupp under tröskeln namnges inte; antalet utelämnade par står i panelen och i resultatet', () => {
        const w = fonster();
        const r = w.__robusthetLikvardighet([55, 60, 65]);
        expect(r.utelamnade).toBe(1);
        expect(r.rows).toEqual([]);
        expect(r.not).toBe('1 par med en grupp under 10 personer redovisas inte här.');
        w.eval("_renderRobusthetResult(document.getElementById('robusthet-body'))");
        const t = w.document.getElementById('robusthet-body').textContent;
        expect(t).not.toContain('5300');
        expect(t).toContain('1 par med en grupp under 10 personer redovisas inte här.');
        expect(t).toContain('Inga kandidatpar att namnge');
        // Slutsatsraden räknar bara de namngivna paren som prövade slutsatser.
        expect(w.document.getElementById('nyckel-dk-robusthet').textContent).toBe('Står sig');
    });
    it('vid 5 namnges paret och ingen mening om utelämnade står kvar', () => {
        const w = fonster();
        w.eval('sattKTroskel(5, { fraga: false })');
        const r = w.__robusthetLikvardighet([55, 60, 65]);
        expect(r.utelamnade).toBe(0);
        expect(r.not).toBe('');
        expect(r.rows.some(x => x.label.includes('5300'))).toBe(true);
        w.eval("_renderRobusthetResult(document.getElementById('robusthet-body'))");
        const t = w.document.getElementById('robusthet-body').textContent;
        expect(t).toContain('5300');
        expect(t).not.toMatch(/redovisas inte här/);
    });
});

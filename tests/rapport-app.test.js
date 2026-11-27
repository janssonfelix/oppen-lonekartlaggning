// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
// Rapporten i appen: metodbilagan, Word-utkastet och .docx-filen, bilagan med gruppdossierer, rapportunderlaget med
// diagrammen och kopieringen, innehållsförteckningen på sidan och vad exportläget kostar (ADR-51).
import { describe, it, expect, beforeAll } from 'vitest';
import { createAppWindow, delatFlikfonster } from './helpers/app-harness.js';

// Testerna som söker igenom flikarna läser kopior av varje flik ur ett delat fönster (delatFlikfonster).
const { flikfonster, ritade } = delatFlikfonster();

let win;

beforeAll(() => {
    win = createAppWindow();
    win.__lasInDemodata();   // blocken nedan läser demodatan
});

describe('röktest: metod-appendix + rapportbyggare', () => {
    it('metod-appendix byggs och innehåller demo-flagga + modellspec', () => {
        const data = JSON.stringify(win.__metodbilaga());
        expect(data).toContain('DEMODATA');          // demoläge syns
        expect(data).toContain('HC3');                // modellspec finns
    });
});

describe('#export röktest: BAS-grupperade tabeller blir Word-block', () => {
    it('rapport-tabellen exporteras som block: titel + upprepade rubriker + tomrad per BAS', () => {
        // ritaLoneoversikt har körts av demodata-pipelinen → rapport-table har group-headers
        const clone = win.__tabellkopia('rapport-table');
        expect(clone).toBeTruthy();
        const g = win.__groupedAoa(clone);
        const headers = g.aoa[g.firstHeaderRowIdx];
        expect(headers.length).toBeGreaterThan(3);
        // Varje BAS-block: titelrad ("BAS X") direkt följd av kolumnrubriksrad
        const titleRows = g.aoa.map((r, i) => ({ r, i })).filter(x => x.r.length === 1 && /^BAS /.test(String(x.r[0])));
        expect(titleRows.length).toBeGreaterThan(1);                  // flera BAS-block
        titleRows.forEach(({ i }) => expect(g.aoa[i + 1]).toEqual(headers));   // rubriker upprepas
        // Tomrad mellan blocken (Word-markering): raden före varje titel utom första är tom
        titleRows.slice(1).forEach(({ i }) => expect(g.aoa[i - 1]).toEqual([]));
        // Merge-info för titelraderna finns (snygg titel över hela bredden i Excel)
        expect(g.merges.length).toBe(titleRows.length);
    });
});

describe('Word-utkast: dokumentationsskelett (§§ 8–14) på demodata', () => {
    const draft = () => win.__docDraftHtml();

    it('innehåller alla lagstegens rubriker i ordning', () => {
        const html = draft();
        // Rubrikerna är klarspråk utan paragraf (lagrummen står i docs/utveckling/lagrum.md) — men varje
        // lagsteg måste fortfarande finnas, i rätt ordning.
        const idxs = ['Regler och praxis kring lön', 'Lika arbete — kvinnor och män i samma AID-etikett och BAS-intervall', 'Likvärdigt arbete — kvinnodominerade AID-etiketter',
            'Åtgärder och tidsplan', 'Samverkan med arbetstagarna', 'Beslut och underskrift', 'Bilaga: Metod']
            .map(h => html.indexOf(h));
        idxs.forEach(i => expect(i).toBeGreaterThan(-1));        // alla finns
        const sorted = [...idxs].sort((a, b) => a - b);
        expect(idxs).toEqual(sorted);                            // i rätt ordning
    });

    it('har gula [HR fyller i]-block för de kvalitativa bedömningarna', () => {
        const html = draft();
        const count = (html.match(/\[HR fyller i\]/g) || []).length;
        expect(count).toBeGreaterThanOrEqual(6);                 // regler, lika, likvärdigt, åtgärder, samverkan, beslut, summering
        expect(html).toContain('class="fillin"');
    });

    it('fyller i verktygets fynd (antal anställda + metodbilaga)', () => {
        const html = draft();
        expect(html).toContain(String(win.__state.data.length));  // 200 demo-rader
        expect(html).toContain('HC3');                            // metodbilagan med
        expect(html).toContain('UTKAST');                         // tydlig utkast-märkning
    });

    it('märker demodata tydligt (exporten får aldrig förväxlas med verklig analys)', () => {
        expect(win.__state.isDemo).toBe(true);
        expect(draft()).toContain('DEMODATA');
    });
});

describe('§ 8-ställning: bedömning per område + flöde till Word-utkastet', () => {
    it('injicerar status + anteckning i alla 6 granskningsområden vid boot', () => {
        expect(win.document.querySelectorAll('[id^="bes8-status-"]').length).toBe(6);
        expect(win.document.querySelectorAll('[id^="bes8-note-"]').length).toBe(6);
        expect(win.document.querySelectorAll('.bes8-field').length).toBe(12);
    });

    it('Word-utkastets § 8-sektion listar områdena och får [HR fyller i] när tomt', () => {
        const html = win.__docDraftHtml();
        expect(html).toContain('Granskningsområde');                 // § 8-tabellrubrik
        expect(html).toContain('Lönesättningsprinciper');            // område 1-titel
        expect(html).toContain('Granskningsområde'); // (tabell, ej generisk fillin)
    });

    it('ifylld bedömning + anteckning följer med till Word-utkastet', () => {
        win.document.getElementById('bes8-status-1').value = 'Åtgärd krävs';
        win.document.getElementById('bes8-note-1').value = 'Kriterierna är inte dokumenterade.';
        const html = win.__docDraftHtml();
        expect(html).toContain('Åtgärd krävs');
        expect(html).toContain('Kriterierna är inte dokumenterade.');
        // städa upp så andra tester inte påverkas
        win.document.getElementById('bes8-status-1').value = '';
        win.document.getElementById('bes8-note-1').value = '';
    });
});

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
        w.__lasInDemodata();
        const html = w.eval('_byggWordUtkastHtml()');
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
    it('avsnittet om struktur bär översikten per BAS-intervall — samma rader och tal som fliken Lönestruktur visar (i exportläget)', () => {
        const w = createAppWindow();
        w.__lasInDemodata();
        w.__state.kLage = 'export';
        w.__ritaFlik('struktur');
        const ren = t => t.replace(/[\u00a0\u202f]/g, ' ');
        const skarm = [...w.document.querySelectorAll('#la-oversikt tbody tr')].map(tr => [...tr.children].map(c => ren(c.textContent)));
        expect(skarm.length).toBeGreaterThan(0);
        const struktur = w.eval('rapportModell()').avsnitt.find(a => a.id === 'struktur');
        const ri = struktur.delar.findIndex(d => d.typ === 'rubrik' && d.text === 'Kvinnors och mäns lön per BAS-intervall');
        const tabell = struktur.delar[ri + 1];
        expect(tabell.kolumner.map(k => k.rubrik)).toEqual(['BAS', 'Kvinnor / män', 'Median kvinnor', 'Median män', 'Skillnad', 'Kvinnors lön i % av mäns', '95 % konfidensintervall', 'Status', 'Ojusterad löneskillnad ≥ 5 %']);
        const celler = tabell.rader.map(r => r.map((v, i) => ren(w.rmCell ? w.rmCell(v, tabell.kolumner[i].typ) : w.eval('rmCell')(v, tabell.kolumner[i].typ))));
        expect(celler.map(c => 'BAS ' + c[0])).toEqual(skarm.map(c => c[0]));                       // samma BAS-intervall, samma ordning
        celler.forEach((c, n) => {
            expect([c[1], c[2], c[3], c[4]]).toEqual([skarm[n][1], skarm[n][2], skarm[n][3], skarm[n][4]]);   // antal, medianer, skillnad
            expect(skarm[n][6]).toBe(c[5] + c[6]);                                                    // kvoten följd av intervallet, som i skärmens cell
            expect(c[7]).toBe(skarm[n][7]);                                                           // status i ord
            expect(c[8]).toBe(skarm[n][8]);                                                           // direktivmarkeringen (ADR-59)
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
    it('rapportmodellen: tretton avsnitt, tabeller med tal som tal, och lönegapet som kvinnors lön i procent av mäns', () => {
        const w = createAppWindow();
        w.__lasInDemodata();
        const m = w.eval('rapportModell()');
        expect(m.avsnitt.map(a => a.id)).toEqual(['sammanfattning', 'regler', 'lika', 'likvardigt', 'basintervall', 'struktur', 'referenser', 'perbas', 'atgarder', 'samverkan', 'beslut', 'regression', 'metod']);
        expect(m.demo).toBe(true);
        const delar = id => m.avsnitt.find(a => a.id === id).delar;
        const tabeller = id => delar(id).filter(p => p.typ === 'tabell');
        // Tal står som tal i modellen; formen sätts av den som ritar. Modellen bär verktygets gap, (kvinnor − män) / män;
        // kolumntypen `direktiv` låter ritaren vända tecknet (EU 2023/970 art. 9).
        const struktur = tabeller('struktur')[0];
        expect(struktur.kolumner.map(c => c.typ)).toEqual(['text', 'antal', 'pct0', 'kr', 'direktiv', 'text']);
        for (const r of struktur.rader) { expect(typeof r[1]).toBe('number'); expect(typeof r[3]).toBe('number'); expect(r[4] === null || typeof r[4] === 'number').toBe(true); }
        expect(struktur.rader.every(r => r[1] >= 10)).toBe(true);                // bara BAS-intervall som når tröskeln
        const html = w.eval('rmTillHtml(rapportModell())');
        const dok = new w.DOMParser().parseFromString(`<div>${html}</div>`, 'text/html');
        // Avsnittet om lönetransparens: direktivets tecken, utskrivet, positivt när kvinnor ligger lägre.
        const direktiv = [...dok.querySelectorAll('table')].find(t => /Andel kvinnor/.test(t.textContent) && /Löneskillnad enligt direktivet/.test(t.textContent));
        const dVarden = [...direktiv.querySelectorAll('tbody tr')].map(tr => tr.children[4].textContent);   // sist står direktivmarkeringen
        expect(dVarden.length).toBeGreaterThan(0);
        for (const v of dVarden) expect(v).toMatch(/^([+−]\d{1,2},\d\s%|0,0\s%|—)$/);
        const gapB = struktur.rader.find(r => r[4] !== null);
        expect(dVarden[struktur.rader.indexOf(gapB)]).toBe(`${gapB[4] < 0 ? '+' : '−'}${Math.abs(gapB[4]).toFixed(1).replace('.', ',')}\u00a0%`);
        // Lönegapets form i övrigt: kvinnors lön i procent av mäns — inget minustecken i de kolumnerna.
        const kolumn = [...dok.querySelectorAll('table')].find(t => /Kvinnors lön i % av mäns/.test(t.textContent) && /Median kvinnor/.test(t.textContent));
        const varden = [...kolumn.querySelectorAll('tbody tr')].map(tr => tr.children[5].textContent);
        expect(varden.length).toBeGreaterThan(0);
        for (const v of varden) expect(v).toMatch(/^(\d{2,3},\d\s%|—)$/);
        expect(html).toMatch(/<th>Kvinnors medianlön i procent av mäns<\/th><td>\d{2,3},\d(?:\s|&nbsp;)%<\/td>/);
        expect(html).not.toMatch(/Ojusterat lönegap|Ojusterad löneskillnad(?! ≥ 5 %)|Gap \(Kv vs Mä\)/);
        // Regressionens gap behåller sin form, och det sägs i klartext.
        expect(html).toMatch(/Löneskillnad som står kvar efter ålder och BAS-intervall<\/th><td><strong>[+−]\d+,\d\d(?:\s|&nbsp;)%/);
        expect(html).toContain('negativ när kvinnor ligger lägre');
        // Diagrammen hör till ett avsnitt och pekar ut fliken som ritar dem.
        const diagram = m.avsnitt.flatMap(a => a.delar.filter(p => p.typ === 'diagram').map(p => `${a.id}:${p.id}:${p.flik}`));
        expect(diagram).toEqual(expect.arrayContaining(['struktur:chart-skevhet-overview:struktur', 'struktur:chart-skevhet-andel:struktur', 'struktur:chart-struktur-kvartiler:struktur', 'lika:chart-perbas-gap:struktur']));
        // Fälten att fylla i finns kvar i varje avsnitt som hade dem.
        for (const id of ['sammanfattning', 'lika', 'likvardigt', 'atgarder', 'samverkan', 'beslut']) expect(delar(id).some(p => p.typ === 'fyllIn'), id).toBe(true);
        // Metodbilagan har en rubrik, inte två.
        expect((html.match(/Metod (och|&amp;) parametrar/g) || []).length).toBe(1);
    });
    it('rapportmodellen: tröskeln tillämpas när modellen byggs, och varje avsnitt säger vad det utelämnar', () => {
        const w = createAppWindow();
        w.__lasInDemodata();
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
    it('samma etikett ger samma tal i hela rapporten, också när rader saknar ålder', () => {
        const w = createAppWindow();
        w.__lasInDemodata();
        // Var femte rad utan ålder: regressionens urval blir mindre än hela underlaget.
        w.__state.data.forEach((r, i) => { if (i % 5 === 0) r.alder = 0; });
        const m = w.eval('rapportModell()');
        const rader = m.avsnitt.flatMap(a => a.delar.filter(p => p.typ === 'tabell').flatMap(t => t.rader));
        const varden = etikett => rader.filter(r => r[0] === etikett).map(r => (typeof r[1] === 'object' ? r[1].text : r[1]));
        const medianKvot = varden('Kvinnors medianlön i procent av mäns');
        expect(medianKvot.length).toBeGreaterThan(0);
        expect(new Set(medianKvot).size).toBe(1);
        const iModellen = rader.filter(r => /^Kvinnors medianlön i procent av mäns, i modellens urval \(n = \d+\)$/.test(r[0]));
        expect(iModellen.length).toBeGreaterThan(0);
        for (const r of iModellen) expect(r[1]).not.toBe(medianKvot[0]);
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
        w.__lasInDemodata();
        const rubriker = () => w.eval('rapportModell()').avsnitt.map(a => a.rubrik);
        expect(w.eval('rapportUrval()').namn).toBe('Hela dokumentationen');
        expect(rubriker().map(r => r.slice(0, 2))).toEqual(['1.', '2.', '3.', '4.', '5.', '6.', '7.', '8.', '9.', '10', '11', 'Bi', 'Bi']);
        w.eval("sattRapportUrval('ledning')");
        expect(w.eval('rapportUrval()').namn).toBe('Ledningsbrief');
        expect(w.eval('rapportModell()').avsnitt.map(a => a.id)).toEqual(['sammanfattning', 'lika', 'likvardigt', 'atgarder']);
        expect(rubriker().map(r => r.slice(0, 2))).toEqual(['1.', '2.', '3.', '4.']);               // numrerade om, utan luckor
        expect(rubriker()[3]).toMatch(/^4\. Åtgärder och tidsplan/);
        // Eget urval: annan ordning, ett avsnitt bort; okända namn hoppas över.
        w.eval("sattRapportUrval({ ordning: ['struktur', 'sammanfattning', 'finns-inte', 'lika'], med: ['struktur', 'lika', 'metod', 'finns-inte'] })");
        expect(w.eval('rapportModell()').avsnitt.map(a => a.id)).toEqual(['struktur', 'lika', 'metod']);
        expect(w.eval('rapportUrval()').namn).toBe('Eget urval (3 av 14 avsnitt)');
        expect(rubriker()[0]).toMatch(/^1\. Struktur/);
        // Utkastet följer urvalet; listan med alla avsnitt gör det inte.
        const html = w.eval('_byggWordUtkastHtml()');
        expect(html).not.toMatch(/Samverkan med arbetstagarna/);
        expect(w.eval('rapportModell({ alla: true })').avsnitt).toHaveLength(14);   // med bilagan med gruppdossierer, som är förvald av
        // Rensning återställer urvalet.
        w.eval('_rensaAllData()');
        expect(w.__state.rapportUrval).toBeNull();
    });
    it('urvalet följer med i konfigurationsfilen, och en fil med fel form avvisas utan att något ändras', () => {
        const w = createAppWindow();
        w.__lasInDemodata();
        w.eval("sattRapportUrval('facklig')");
        const cfg = w.eval('JSON.parse(JSON.stringify(byggKonfiguration()))');
        expect(cfg.rapportUrval.med).toEqual(['sammanfattning', 'regler', 'lika', 'likvardigt', 'basintervall', 'struktur', 'referenser', 'perbas', 'samverkan', 'regression', 'metod']);
        w.eval("sattRapportUrval('hela')");
        expect(w.eval('byggKonfiguration().rapportUrval')).toBeNull();
        w.__cfg = cfg;
        w.eval('tillampaKonfiguration(window.__cfg)');
        expect(w.eval('rapportUrval()').namn).toBe('Facklig dialog');
        w.__cfg = { ...cfg, rapportUrval: { ordning: 'lika', med: [] } };
        expect(() => w.eval('tillampaKonfiguration(window.__cfg)')).toThrow(/rapportUrval/);
        expect(w.eval('rapportUrval()').namn).toBe('Facklig dialog');
        // En fil utan fältet ger hela dokumentationen.
        const { rapportUrval: _bort, ...utanUrval } = cfg;
        w.__cfg = utanUrval;
        w.eval('tillampaKonfiguration(window.__cfg)');
        expect(w.eval('rapportUrval()').namn).toBe('Hela dokumentationen');
    });
    it('förhandsbeskedet för Word och PDF säger högst så många diagram som urvalet har, och ritar ingen flik', async () => {
        const w = createAppWindow();
        w.__lasInDemodata();
        w.eval('sattKTroskel(60, { fraga: false })');                    // flera diagram har då inget att visa
        w.document.querySelector('.nav-item[data-tab="dokumentera"]').click();
        // Beskedet ritar ingen flik.
        w.eval('window.__antal = 0; const __orig = ritaFlik; ritaFlik = function (f) { window.__antal++; return __orig(f); };');
        w.eval('ritaExportBesked()');
        expect(w.__antal).toBe(0);
        // Diagrammen som filen får: varje diagramdel vars flik ritats i exportläget och vars diagram då är ritat.
        const { delar, ritade } = w.eval(`medExportLage(() => {
            const delar = rapportModell().avsnitt.flatMap(a => a.delar).filter(p => p.typ === 'diagram');
            for (const f of new Set(delar.map(p => p.flik))) ritaFlik(f);
            return { delar: delar.length, ritade: delar.filter(p => diagramRitat(document.getElementById(p.id))).length };
        })`);
        expect(ritade).toBeLessThan(delar);                                // annars prövar testet inget
        for (const id of ['besked-word', 'besked-pdf']) expect(w.document.getElementById(id).textContent).toContain(`högst ${delar} diagram`);
        // Ett urval utan diagram säger 0 diagram, utan «högst».
        w.eval("sattRapportUrval({ ordning: [...RM_AVSNITT], med: ['metod'] })");
        w.eval('ritaExportBesked()');
        expect(w.document.getElementById('besked-word').textContent).toMatch(/ · 0 diagram · /);
    });
    it('förhandsbeskedet säger vad filen innehåller och utelämnar, och räknas ur samma källa som filen', async () => {
        const w = createAppWindow();
        await jszip(w);
        w.__lasInDemodata();
        const d = w.document;
        d.querySelector('.nav-item[data-tab="dokumentera"]').click();
        const word = () => d.getElementById('besked-word').textContent;
        const m = w.eval('rmBesked(rapportModell())');
        expect(word()).toContain(`Hela dokumentationen · 13 avsnitt · ${m.tabeller} tabeller · högst ${m.diagram} diagram · ${m.fyllIn} fält att fylla i`);
        expect(d.getElementById('nyckel-ex-urval').textContent).toBe('Hela dokumentationen');
        // Excel: bladen i beskedet är bladen i filen.
        // Excel: beskedet listar bladen (att listan är filens blad prövas mot en riktig arbetsbok i exports.golden.test.js).
        const blad = w.eval('excelAlltBlad()');
        expect(d.getElementById('besked-excel').textContent).toContain(`${blad.length} blad — ${blad.join(', ')}`);
        expect(d.getElementById('besked-excel').textContent).toContain('färre än 10 personer');
        expect(d.getElementById('besked-zip').textContent).toContain(`Word-utkastet, Excel-filen (${blad.length} blad) och diagrammen i alla flikar`);
        // PDF-rapporten är samma modell: med hela dokumentationen följer bilagorna med, med ett kortare urval inte.
        expect(d.getElementById('besked-pdf').textContent).toContain('Hela dokumentationen · 13 avsnitt');
        expect(d.getElementById('besked-pdf').textContent).toContain('bilagor med flikarnas tabeller och diagram');
        // Urvalslistan: en rad per avsnitt, utan paragrafhänvisningar; ett färdigt urval ändrar beskedet.
        const rader = () => [...d.querySelectorAll('#rapport-urval .urval-rad')];
        expect(rader()).toHaveLength(14);
        expect(d.getElementById('rapport-urval').textContent).not.toMatch(/§|2023\/970/);
        d.querySelector('[data-urval-fast="ledning"]').click();
        expect(word()).toContain('Ledningsbrief · 4 avsnitt');
        expect(d.getElementById('besked-pdf').textContent).toMatch(/Ledningsbrief · 4 avsnitt.*inga bilagor/);
        expect(d.querySelector('[data-urval-fast="ledning"]').getAttribute('aria-pressed')).toBe('true');
        expect(rader().filter(r => r.querySelector('input').checked).map(r => r.dataset.urvalId)).toEqual(['sammanfattning', 'lika', 'likvardigt', 'atgarder']);
        // En ruta och en flytt ger ett eget urval; första raden kan inte flyttas upp.
        const ruta = d.querySelector('[data-urval-med="metod"]');
        ruta.checked = true; ruta.dispatchEvent(new w.Event('change', { bubbles: true }));
        expect(word()).toContain('Eget urval (5 av 14 avsnitt)');
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
        w.laddaNer = (blob, namn) => { fangad = { blob, namn }; return namn; };
        expect(await w.eval('exportWordUtkast()')).toBe(true);
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
        w.__lasInDemodata();
        let fangad = null;
        w.laddaNer = (blob, namn) => { fangad = { blob, namn }; return namn; };
        expect(await w.eval('exportWordUtkast()')).toBe(true);
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
        w.__lasInDemodata();
        w.eval("_bes8Omraden = () => [{ title: 'Löneregler', status: 'Möjlig risk', note: 'Rad 1\\u0007 <b> & rad 2' }]");
        let fangad = null;
        w.laddaNer = (blob, namn) => { fangad = { blob, namn }; return namn; };
        await w.eval('exportWordUtkast()');
        const zip = await w.JSZip.loadAsync(await fangad.blob.arrayBuffer());
        const doc = await zip.file('word/document.xml').async('string');
        expect(new w.DOMParser().parseFromString(doc, 'application/xml').getElementsByTagName('parsererror').length).toBe(0);
        expect(doc).toContain('&lt;b&gt; &amp; rad 2');
    });
    it('utan JSZip: felmeddelande, ingen nedladdning', async () => {
        const w = createAppWindow();
        w.__lasInDemodata();
        delete w.JSZip;
        let meddelande = '', nerladdad = false;
        w.alert = m => { meddelande = m; };
        w.laddaNer = () => { nerladdad = true; };
        expect(await w.eval('exportWordUtkast()')).toBe(false);
        expect(meddelande).toMatch(/Word-utkastet kunde inte skapas/);
        expect(nerladdad).toBe(false);
    });
});

describe('Bilaga: gruppdossierer i Word-utkastet och PDF-rapporten', () => {
    const MED_DOSSIERER = w => w.eval("sattRapportUrval({ ordning: rapportUrval().ordning, med: [...RM_URVAL.hela.med, 'dossierer'] })");
    const bilaga = w => w.eval('rapportModell()').avsnitt.find(a => a.id === 'dossierer');
    it('är förvald av: hela dokumentationen, facklig dialog och ledningsbriefen saknar den; den står sist i ordningen och i urvalslistan, okryssad', () => {
        const w = createAppWindow(); w.__lasInDemodata();
        expect(w.eval('rapportUrval()').ordning.at(-1)).toBe('dossierer');
        for (const u of ['hela', 'facklig', 'ledning']) {
            w.eval(`sattRapportUrval('${u}')`);
            expect(bilaga(w), u).toBeUndefined();
            expect(w.eval('_byggWordUtkastHtml()'), u).not.toContain('Bilaga: gruppdossierer');
        }
        w.eval("sattRapportUrval('hela')");
        expect(w.eval('rapportUrval()').namn).toBe('Hela dokumentationen');
        w.document.querySelector('.nav-item[data-tab="dokumentera"]').click();
        const ruta = w.document.querySelector('[data-urval-med="dossierer"]');
        expect(ruta).not.toBeNull();
        expect(ruta.checked).toBe(false);
        expect(ruta.closest('label').textContent.trim()).toBe('Bilaga: gruppdossierer');
        // Hela dokumentationen utan bilagan räknas fortfarande som hela: PDF-rapporten får flikarnas bilagor.
        expect(w.document.getElementById('besked-pdf').textContent).toContain('bilagor med flikarnas tabeller och diagram');
        // Rutan i listan tar med bilagan.
        ruta.checked = true; ruta.dispatchEvent(new w.Event('change', { bubbles: true }));
        expect(bilaga(w)).toBeTruthy();
    });
    it('bilagan hänvisar till avsnittet per BAS-intervall bara när det avsnittet är med', () => {
        const w = createAppWindow(); w.__lasInDemodata();
        const hanvisning = () => bilaga(w).delar[0].text.includes('står i avsnittet Lönekartläggning per');
        MED_DOSSIERER(w);
        expect(hanvisning()).toBe(true);
        w.eval("sattRapportUrval({ ordning: rapportUrval().ordning, med: [...RM_URVAL.ledning.med, 'dossierer'] })");
        expect(hanvisning()).toBe(false);
    });
    it('vald: en dossier per yrkesgrupp där båda könen når k, med samma text som gruppdossierns kopia, byggd i exportläget', () => {
        const w = createAppWindow(); w.__lasInDemodata();
        MED_DOSSIERER(w);
        const a = bilaga(w);
        expect(a.rubrik).toBe('Bilaga: gruppdossierer');
        const k = w.eval('kInstalld()');
        const nycklar = w.eval('medExportLage(() => gruppdossierKandidater().map(g => byggGruppdossier(g.key)).filter(d => d.nKv >= kTroskel() && d.nMa >= kTroskel()).map(d => d.key))');
        expect(nycklar.length).toBeGreaterThan(1);
        const rubriker = a.delar.filter(p => p.typ === 'rubrik');
        expect(rubriker).toHaveLength(nycklar.length);
        // Varje dossier: rubriken är textens första rad och styckena resten, rad för rad.
        const forsta = w.medExportLage(() => w.gruppdossierSomText(w.byggGruppdossier(nycklar[0]))).split('\n');
        const i = a.delar.findIndex(p => p.typ === 'rubrik' && p.text === forsta[0]);
        expect(i).toBeGreaterThan(-1);
        const resten = forsta.slice(1).map(t => t.trim()).filter(Boolean);
        expect(a.delar.slice(i + 1, i + 1 + resten.length).map(p => p.text)).toEqual(resten);
        // Word-utkastet och PDF-rapporten har avsnittet.
        expect(w.eval('_byggWordUtkastHtml()')).toContain('<h2>Bilaga: gruppdossierer</h2>');
        expect(k).toBe(10);
    });
    it('ingen grupp under k: vid k = 25 faller grupperna där ett kön har färre än 25, och de räknas i utelämnat', () => {
        const w = createAppWindow(); w.__lasInDemodata();
        w.eval('sattKTroskel(25, { fraga: false })');
        MED_DOSSIERER(w);
        const a = bilaga(w);
        const alla = w.eval('medExportLage(() => gruppdossierKandidater().map(g => byggGruppdossier(g.key)))');
        const med = alla.filter(d => d.nKv >= 25 && d.nMa >= 25);
        expect(alla.length).toBeGreaterThan(med.length);
        // Exakt grupperna där båda könen når 25, i kandidaternas ordning.
        const forvantat = med.map(d => w.medExportLage(() => w.gruppdossierSomText(w.byggGruppdossier(d.key))).split('\n')[0]);
        expect(a.delar.filter(p => p.typ === 'rubrik').map(p => p.text)).toEqual(forvantat);
        expect(a.utelamnat.join(' ')).toMatch(/AID-etikett(er)? där ett kön har färre än 25 personer/);
    });
    it('texten är svenska med å, ä och ö, och stämpeln om sänkt tröskel står en gång, överst i bilagan', () => {
        const w = createAppWindow(); w.__lasInDemodata();
        w.eval('sattKTroskel(5, { fraga: false })');
        MED_DOSSIERER(w);
        const a = bilaga(w);
        const text = a.delar.map(p => p.text).join('\n');
        expect(text).toContain('sakliga skäl');
        expect(text).toMatch(/\d+ män\b/);
        expect(text).toMatch(/^Gruppdossier: /m);
        for (const fel of [/sakliga skal\b/, /\b(?!1 )\d+ man\b/, /Sarskilt/, /Aldersrensat/, /undersoka/, /kr\/ar\b/, /GRUPPDOSSIER/, /bedomningen gors/]) expect(text).not.toMatch(fel);
        // Stämpeln en gång, före första dossiern — inte en gång per grupp.
        const stampel = w.eval('kStampel()');
        expect(stampel).toBeTruthy();
        expect(text.split(stampel).length - 1).toBe(1);
        const iStampel = a.delar.findIndex(p => p.text === stampel), iRubrik = a.delar.findIndex(p => p.typ === 'rubrik');
        expect(iStampel).toBeGreaterThan(-1);
        expect(iStampel).toBeLessThan(iRubrik);
        // Kopian ur gruppdossiern bär fortfarande stämpeln, eftersom den kan spridas för sig.
        const key = w.eval('gruppdossierKandidater()[0].key');
        expect(w.medExportLage(() => w.gruppdossierSomText(w.byggGruppdossier(key)))).toContain(stampel);
    });
    it('förhandsbeskedet bygger inga dossierer men räknar utelämnat som exporten, och bilagan räknar kandidaterna en gång', () => {
        const w = createAppWindow(); w.__lasInDemodata();
        w.eval('sattKTroskel(25, { fraga: false })');
        MED_DOSSIERER(w);
        const utelamnat = bilaga(w).utelamnat;
        expect(utelamnat.length).toBe(1);
        const rakna = namn => { const orig = w[namn]; const r = { n: 0 }; w[namn] = (...x) => { r.n++; return orig(...x); }; return r; };
        // Intervallet räknas i lib (medianKvotKIGiltiga), som i bygget är ett namn på toppnivån och går att räkna.
        expect(typeof w.medianKvotKIGiltiga).toBe('function');
        const byggda = rakna('byggGruppdossier'), kandidater = rakna('gruppdossierKandidater'), prio = rakna('raknaPrioritering'), ki = rakna('medianKvotKIGiltiga');
        // Räkningen fångar anropen: en dossier på skärmen visar intervallet.
        w.byggGruppdossier(w.eval('gruppdossierKandidater()[0].key'));
        expect(ki.n).toBeGreaterThan(0);
        byggda.n = 0; kandidater.n = 0; ki.n = 0;
        w.eval('ritaExportBesked()');
        expect(byggda.n).toBe(0);
        expect(w.document.getElementById('besked-word').textContent).toContain(utelamnat[0]);
        // Vid k = 10 kommer flera grupper med i bilagan.
        w.eval('sattKTroskel(10, { fraga: false })');
        // Vad bilagan kostar utöver resten av modellen: kandidaterna en gång, prioriteringen högst en gång, inga bootstrap-intervall.
        const kor = () => { byggda.n = 0; kandidater.n = 0; prio.n = 0; ki.n = 0; w.eval('rapportModell()'); return { byggda: byggda.n, kandidater: kandidater.n, prio: prio.n, ki: ki.n }; };
        w.eval("sattRapportUrval('hela')");
        const utan = kor();
        MED_DOSSIERER(w);
        const med = kor();
        expect(utan.byggda).toBe(0);
        expect(med.byggda).toBeGreaterThan(1);
        expect(med.kandidater - utan.kandidater).toBe(1);
        expect(med.prio - utan.prio).toBeLessThanOrEqual(1);
        // Textversionen visar inte bootstrap-intervallet, så bilagan räknar det inte (det var nästan hela kostnaden).
        expect(med.ki).toBe(0);
    });
});

// Beslut 7a: EU-rapportmåtten är räknade på fast heltidsmånadslön och direktivets lönebegrepp är vidare. Reservationen
// står vid måtten i fliken, i rapportens avsnitt om lönetransparens (Word, PDF), i rapportunderlaget och i Om verktyget.
describe('reservationen om lönebegreppet vid EU-rapportmåtten', () => {
    const MENING = 'Måtten är räknade på fast heltidsmånadslön. Direktivets lönebegrepp är vidare (total ersättning, inklusive rörliga delar och förmåner); komplettera ur lönesystemet om ni rapporterar.';
    const ren = t => String(t).replace(/[  ]/g, ' ').replace(/\s+/g, ' ');
    it('konstanten har meningen och inga artikelnummer', () => {
        const w = createAppWindow();
        expect(w.eval('EU_LONEBEGREPP_RESERVATION')).toBe(MENING);
        expect(MENING).not.toMatch(/art(ikel|\.)\s*\d/i);
    });
    it('står i Lönestrukturs kort, i rapportmodellens avsnitt, i Word-utkastet, i utskriften, i rapportunderlaget och i Om verktyget', () => {
        const w = createAppWindow();
        w.__lasInDemodata();
        w.__ritaFlik('struktur');
        expect(ren(w.document.getElementById('struktur-eu').textContent)).toContain(MENING);
        const struktur = w.eval('rapportModell()').avsnitt.find(a => a.id === 'struktur');
        expect(ren(JSON.stringify(struktur.delar))).toContain(MENING);
        expect(ren(w.eval('rmTillHtml(rapportModell())'))).toContain(MENING);
        expect(ren(w.__docDraftHtml())).toContain(MENING);
        const block = w.eval('rapportunderlagBlock()');
        expect(ren(JSON.stringify(block.find(b => b.rubrik === 'Struktur och lönetransparens')))).toContain(MENING);
        expect(ren(w.eval('OM_AVSNITT.overview()'))).toContain(MENING);
    });
});

// Exportläget (ADR-51) i ett eget fönster med demodatan och Utforska ritad.
const demoMedUtforska = () => {
    const w = createAppWindow();
    w.__lasInDemodata();
    w.__ritaFlik('utforska');
    return w;
};
describe('exportläget kostar inte mer än det måste (ADR-51)', () => {
    it('rapportModellBada ger samma modell som rapportModell() och rapportModell({ alla: true }) ur ett bygge', () => {
        const w = demoMedUtforska();
        // Metodbilagans exporttidpunkt har sekunder: två modeller byggda på var sin sida om ett sekundskifte (som på
        // en långsam CI-maskin) är ändå samma modell, så tidpunkten jämförs inte.
        const utanTid = m => JSON.stringify(m).replace(/"Exporttidpunkt","[^"]*"/g, '"Exporttidpunkt","<TID>"');
        const bada = w.eval('rapportModellBada()');
        expect(utanTid(bada.urval)).toBe(utanTid(w.eval('rapportModell()')));
        expect(utanTid(bada.alla)).toBe(utanTid(w.eval('rapportModell({ alla: true })')));
        expect(bada.alla.avsnitt.length).toBeGreaterThanOrEqual(bada.urval.avsnitt.length);
    });
    it('Lika arbetes minne har ett rum per tröskel: ett lägesbyte räknar inte om översiktens rader', () => {
        const w = demoMedUtforska();
        expect(w.eval('const a = _laOversiktRader(hamtaData()); medExportLage(() => _laOversiktRader(hamtaData())); _laOversiktRader(hamtaData()) === a')).toBe(true);
        expect(w.eval('medExportLage(() => _laOversiktRader(hamtaData())) === _laOversiktRader(hamtaData())')).toBe(false);
    });
    it('efter en export ritas Översikt tillbaka bara när exporten ritade den', () => {
        const w = demoMedUtforska();
        w.__ritaFlik('dashboard');
        let antal = 0;
        w.ritaNyckeltal = () => { antal++; };
        w.__ritaFlik('dokumentera');                       // ritar inga andra flikar
        expect(antal).toBe(0);
        w.eval("medExportLage(() => ritaFlik('dashboard'))");   // som ZIP-exporten
        expect(antal).toBe(2);                                     // en gång i exportläget, en gång tillbaka
        expect(w.__state.kLage).toBe('skarm');
    });
});

describe('rapportunderlag', () => {
    const stubbaUrklipp = w => {
        const fångat = [];
        w.ClipboardItem = class { constructor(o) { this.o = o; } };
        Object.defineProperty(w.navigator, 'clipboard', { configurable: true, value: { write: async items => { fångat.push(...items); } } });
        return fångat;
    };
    it('utan data visar panelen hur man kommer igång', () => {
        const w = createAppWindow();
        w.__ritaFlik('rapporttext');   // fliken är låst utan lönefil; en direktlänk ritar den ändå
        expect(w.document.getElementById('rapportunderlag-innehall').textContent).toContain('Läs in underlag');
    });
    it('med demodata: fem avsnitt, ett block per flaggat yrke och godkänt par, tre diagram', () => {
        const w = createAppWindow();
        w.__lasInDemodata();
        w.document.querySelector('.nav-item[data-tab="rapporttext"]').click();
        const block = w.__rapportunderlagBlock();
        const flaggade = w.__ruLikaArbeteGrupper(w.__hamtaData(), { k: w.__K }).grupper.filter(g => g.flaggad).length;   // rapportunderlaget lämnar verktyget: inställd tröskel
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
        w.__lasInDemodata();
        w.document.querySelector('.nav-item[data-tab="rapporttext"]').click();
        const celler = [...w.document.querySelectorAll('#rapportunderlag-innehall .ru-innehall td')];
        const tal = celler.filter(td => w.eval('arTal')(td.textContent));
        const intervall = tal.filter(td => /\d\s*(–|till)\s*[−+]?\d/.test(td.textContent));
        expect(intervall.length).toBeGreaterThan(0);
        expect(tal.every(td => td.classList.contains('ru-tal'))).toBe(true);
        expect(celler.filter(td => td.classList.contains('ru-tal')).length).toBe(tal.length);
    });
    it('Kopiera lägger ren HTML och text på urklipp', async () => {
        const w = createAppWindow();
        w.__lasInDemodata();
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
        w.__lasInDemodata();
        w.document.querySelector('.nav-item[data-tab="rapporttext"]').click();
        Object.defineProperty(w.navigator, 'clipboard', { configurable: true, value: undefined });
        w.document.execCommand = () => false;
        expect(await w.__kopieraRapportBlock('lika')).toBe('markerat');
        expect(w.getSelection().toString()).toContain('Lika arbete');
    });
    it('uppdelningsblocket ligger direkt efter Sammanfattning', () => {
        const w = createAppWindow();
        w.__lasInDemodata();
        const ids = w.__rapportunderlagBlock().map(b => b.id);
        expect(ids.slice(0, 2)).toEqual(['sammanfattning', 'uppdelning']);
    });
    it('Rensa all data tömmer panelen', () => {
        const w = createAppWindow();
        w.__lasInDemodata();
        w.document.querySelector('.nav-item[data-tab="rapporttext"]').click();
        w.__rensaAllData();
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
        w.__lasInDemodata();
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
        w.__lasInDemodata();
        expect(await w.__kopieraRapportDiagram('chart-likvardighet-heatmap')).toBe('saknas');
    });
    it('utan urklippsstöd för bilder laddas diagrammet ner', async () => {
        const w = createAppWindow();
        w.__lasInDemodata();
        w.document.querySelector('.nav-item[data-tab="matrix"]').click();
        w.figurTillBild = () => Promise.resolve('data:image/png;base64,AAAA');   // diagramkärnans bild: jsdom har ingen canvas
        Object.defineProperty(w.navigator, 'clipboard', { configurable: true, value: undefined });
        expect(await w.__kopieraRapportDiagram('chart-skevhet-overview')).toBe('nedladdat');
    });
});

describe('rapportunderlag: diagram, kopiering och nedladdning', () => {
    it('kandidatparens diagram erbjuds bara när inga par uteslutits', () => {
        const w = createAppWindow();
        const ids = (harPar, exkl) => w._rapportDiagramLista(harPar, exkl).map(g => g.id);
        expect(ids(true, 0)).toContain('chart-likvardighet-heatmap');
        expect(ids(true, 1)).not.toContain('chart-likvardighet-heatmap');
        expect(ids(false, 0)).not.toContain('chart-likvardighet-heatmap');
    });
    it('diagrammet ritas alltid om före kopiering (aktuellt urval)', async () => {
        const w = createAppWindow();
        w.__lasInDemodata();
        w.document.querySelector('.nav-item[data-tab="matrix"]').click();
        const anrop = [];
        const orig = w.ritaFlik;
        w.ritaFlik = t => { anrop.push(t); return orig(t); };
        w.figurTillBild = () => Promise.resolve('data:image/png;base64,AAAA');   // diagramkärnans bild: jsdom har ingen canvas
        Object.defineProperty(w.navigator, 'clipboard', { configurable: true, value: undefined });
        await w.__kopieraRapportDiagram('chart-skevhet-overview');
        expect(anrop).toContain('struktur');
    });
    it('misslyckad nedladdning ger "fel" utan att kasta', async () => {
        const w = createAppWindow();
        w.__lasInDemodata();
        w.document.querySelector('.nav-item[data-tab="matrix"]').click();
        Object.defineProperty(w.navigator, 'clipboard', { configurable: true, value: undefined });
        w.figurTillBild = () => Promise.reject(new Error('nej'));   // diagrammet ritas av diagramkärnan (ADR-39)
        await expect(w.__kopieraRapportDiagram('chart-skevhet-overview')).resolves.toBe('fel');
    });
});

describe('innehåll på sidan och i rapportunderlaget', () => {
    const oppna = (w, flik) => w.document.querySelector(`.nav-item[data-tab="${flik}"]`).click();
    it('de långa flikarna har avsnitt, och deras rubriker är innehållsförteckningen', () => {
        // Flikarna klickas fram i samma ordning som här, med fler flikar emellan (prövat: samma paneler).
        const w = flikfonster();
        for (const [flik, minst] of [['dashboard', 2], ['matrix', 4], ['likvardighet', 4], ['struktur', 5], ['prioritering', 4], ['loneoversyn', 4], ['dokumentera', 2], ['rapporttext', 2], ['arbetet', 4], ['kon', 5], ['benchmark', 4]]) {
            const synliga = ritade.get(flik).paneler;
            const rubriker = synliga.flatMap(p => [...p.querySelectorAll('details.avsnitt > summary h2')]);
            expect(rubriker.length, flik).toBeGreaterThanOrEqual(minst);
            for (const h of rubriker) expect(h.textContent.trim().length, flik).toBeGreaterThan(3);
        }
        expect(w.eval('typeof renderSidansInnehall')).toBe('undefined');
    });
    it('rapportunderlaget: förteckning med en länk per block', () => {
        const w = createAppWindow();
        w.__lasInDemodata();
        oppna(w, 'rapporttext');
        const block = w.document.querySelectorAll('#rapportunderlag-innehall .ru-block[data-block-id]');
        expect(block.length).toBeGreaterThan(0);
        const lankar = w.document.querySelectorAll('#rapportunderlag-innehall .ru-toc [data-hoppa-till]');
        expect(lankar.length).toBe(block.length);
        for (const a of lankar) expect(w.document.getElementById(a.dataset.hoppaTill)?.classList.contains('ru-block')).toBe(true);
    });
    it('Kopiera alla avsnitt lägger avsnittens rubriker i ordning på urklipp; reserv utan urklipp', async () => {
        const w = createAppWindow();
        w.__lasInDemodata();
        oppna(w, 'rapporttext');
        const fångat = [];
        w.ClipboardItem = class { constructor(o) { this.o = o; } };
        Object.defineProperty(w.navigator, 'clipboard', { configurable: true, value: { write: async items => { fångat.push(...items); } } });
        expect(await w.kopieraRapportAvsnitt()).toBe('urklipp');
        const html = await fångat[0].o['text/html'].text();
        const rubriker = [...html.matchAll(/<h3>([^<]+)<\/h3>/g)].map(m => m[1]);
        const avsnitt = w.__rapportunderlagBlock().filter(b => !b.id.includes(':')).map(b => b.rubrik);
        expect(rubriker).toEqual(avsnitt);
        expect(await fångat[0].o['text/plain'].text()).toContain(avsnitt[1]);
        Object.defineProperty(w.navigator, 'clipboard', { configurable: true, value: undefined });
        w.document.execCommand = () => false;
        expect(await w.kopieraRapportAvsnitt()).toBe('markerat');
        expect(w.getSelection().toString()).toContain(avsnitt[0]);
    });
});

describe('kopiera diagram', () => {
    it('att rita en annan flik (t.ex. för att kopiera ett diagram) flyttar inte sidans navigering', () => {
        const w = createAppWindow();
        w.__lasInDemodata();
        const d = w.document;
        d.querySelector('.nav-item[data-tab="dashboard"]').click();
        w.__ritaFlik('matrix');
        expect(d.querySelectorAll('#view-regression .flow-next-bar, #view-lika-yrken .flow-next-bar, #view-skevhet .flow-next-bar').length).toBe(0);
        expect(d.getElementById('view-dashboard').classList.contains('active') || d.getElementById('view-dashboard').style.display === 'block').toBe(true);
    });
    it('kopiera diagram: urklippet begärs direkt i klicket (Safari), bilden levereras som ett löfte', async () => {
        const w = createAppWindow();
        w.__lasInDemodata();
        const fångat = [];
        w.ClipboardItem = class { constructor(o) { this.o = o; } };
        Object.defineProperty(w.navigator, 'clipboard', { configurable: true, value: { write: async items => { fångat.push(...items); } } });
        w.figurTillBild = () => Promise.resolve('data:image/png;base64,AAAA');   // diagramkärnans bild: jsdom har ingen canvas
        const p = w.__kopieraRapportDiagram('chart-perbas-gap');
        expect(fångat).toHaveLength(1);                      // före första await
        expect(typeof fångat[0].o['image/png'].then).toBe('function');
        expect(await p).toBe('urklipp');
        expect((await fångat[0].o['image/png']).type).toBe('image/png');
    });
});

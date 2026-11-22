/**
 * Röktest (jsdom): Rensning, demoläget, referensen, Översikt, menyn och rapportunderlaget.
 *
 * Utbrutet ur smoke.test.js så att Vitest fördelar röktesterna över flera arbetare; varje describe-block
 * skapar sina egna fönster via createAppWindow (tests/helpers/app-harness.js).
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { createAppWindow } from './helpers/app-harness.js';

describe('Rensa all data tömmer även Utforska', () => {
    it('inga individrader finns kvar i Utforskas minne efter rensning', () => {
        const w = createAppWindow();
        w.__loadDemoData();
        w.__renderTabContent('utforska');
        expect(w.__explorerMinne().rows).toBeGreaterThan(0);
        w.__clearAllData();
        expect(w.__state.data).toHaveLength(0);
        expect(w.__explorerMinne()).toEqual({ rows: 0, urval: 0, exportFigur: 'undefined' });
    });
});

describe('referensen: demoläget, egen fil och rensning (ADR-28)', () => {
    let w;
    beforeAll(() => { w = createAppWindow(); w.__loadDemoData(); });
    const klicka = tab => w.document.querySelector(`.nav-item[data-tab="${tab}"]`).click();

    it('demoläget använder Exempelkommunens påhittade ställningstagande, märkt som påhittat', () => {
        expect(w.__state.policy.length).toBe(10);
        expect(w.__referensNamn()).toBe('Exempelkommunens lönepolitik');
        expect(w.document.getElementById('referens-status').textContent).toContain('påhittad, demoläge');
    });
    it('Prioritering och Lönepolitik fungerar med referensen och visar namnet', () => {
        klicka('prioritering');
        expect(w.document.querySelectorAll('#prio-table tbody tr').length).toBeGreaterThan(0);
        expect(w.document.getElementById('view-prioritering').textContent).toContain('Exempelkommunens lönepolitik');
        klicka('benchmark');
        expect(w.document.getElementById('view-benchmark').textContent).toContain('Exempelkommunens lönepolitik');
    });
    it('egen fil med namn ersätter referensen i gränssnitt och export', () => {
        w.__lasInReferens([{ bas: 'A', p10: 20000, med: 25000, p90: 30000 }, { bas: 'B', p10: 21000, med: 26000, p90: 31000 }], 'Min referens.csv');
        expect(w.__referensNamn()).toBe('Min referens');
        expect(w.document.getElementById('referens-namn').value).toBe('Min referens');
        w.__sattReferensNamn('Förskolans LPS');
        expect(w.__referensKortnamn()).toBe('Förskolans LPS');
        klicka('prioritering'); klicka('benchmark'); klicka('dashboard');
        const ytor = ['view-prioritering', 'view-benchmark', 'compliance-overview', 'referens-status']
            .map(id => w.document.getElementById(id).textContent).join(' ');
        expect(ytor).toContain('Förskolans LPS');
        expect(ytor).not.toContain('Exempelkommunens lönepolitik');
        expect(w.__docDraftHtml()).toContain('Förskolans LPS');
        expect(w.__docDraftHtml()).toContain('(egen fil)');
    });
    it('"Ta bort referensen" och "Rensa all data" lämnar ingen referens', () => {
        w.document.getElementById('btn-referens-aterga').click();
        expect(w.__referensNamn()).toBe('Ingen referens inläst');
        w.__lasInReferens([{ bas: 'A', p10: 1, med: 2, p90: 3 }], 'x.csv');
        w.__clearAllData();
        expect(w.__state.policy).toEqual([]);
        w.__loadDemoData();
        w.__lasInReferens([{ bas: 'A', p10: 1, med: 2, p90: 3 }], 'y.csv');
        w.__autoClearOnInactivity();
        expect(w.__state.policy).toEqual([]);
    });
    it('en ren AID-policy med eget namn ger "saknar rader per BAS-intervall" i kompliansrutan', () => {
        w.__loadDemoData();
        w.__lasInReferens([{ aid: '123456', p10: 1, med: 2, p90: 3 }], 'AID-policy.csv');
        w.__updateCompliance();
        expect(w.document.getElementById('comp-pol-val').textContent).toContain('saknar rader per BAS-intervall');
        expect(w.document.getElementById('compliance-overview').textContent).toContain('AID-policy');
        w.__aterstallReferens();
    });
});

describe('underlagets kvalitet (ADR-19)', () => {
    let w;
    beforeAll(() => { w = createAppWindow(); w.__loadDemoData(); });

    it('panelen visar datakvalitetens fem kriterier, AID-kontrollen och en helhetsstatus, ingen 0–100-siffra', () => {
        const p = w.document.getElementById('underlagets-kvalitet');
        expect(p).toBeTruthy();
        expect(p.querySelector('#uk-fallbar')).not.toBeNull();   // sammanfattad, utfälld vid varning (ADR-36)
        expect([...p.querySelectorAll('.uk-rad')].map(r => r.dataset.id))
            .toEqual(['jamforbarhet', 'styrka', 'fullstandighet', 'rimlighet', 'modell',
                'aid-okanda', 'aid-restkoder', 'aid-spridning', 'aid-ledning-utan-ansvar', 'aid-otillaten-ansvarskod']);
        expect(['ok', 'varning', 'kritisk']).toContain(p.dataset.status);
        expect(p.textContent).not.toMatch(/\/100/);
    });
    it('helheten är det sämsta kriteriet', () => {
        const b = w.__bedomningUnderlag();
        const rang = { ok: 0, varning: 1, kritisk: 2 };
        const samsta = b.kriterier.reduce((s, c) => rang[c.status] > rang[s] ? c.status : s, 'ok');
        expect(b.status).toBe(samsta);
    });
    it('demodatan: 2 av 5 BAS maskeras → jämförbarheten är inte OK', () => {
        const j = w.__bedomningUnderlag().kriterier.find(c => c.id === 'jamforbarhet');
        expect(j.status).not.toBe('ok');
        expect(j.text).toContain('maskeras');
    });
    it('datakvalitetsindexet, styrkekortet och guiden finns inte kvar', () => {
        expect(w.document.getElementById('data-quality-card')).toBeNull();
        expect(w.document.getElementById('power-analysis-card')).toBeNull();
        expect(w.document.body.textContent).not.toContain('Datakvalitetsindex');
        expect(typeof w.computeDataQualityIndex).toBe('undefined');
    });
    it('Word-utkastet redovisar inget 0–100-index', () => {
        expect(w.__docDraftHtml()).not.toContain('/100');
    });
});

describe('samma bild på Översikt', () => {
    let w;
    beforeAll(() => { w = createAppWindow(); w.__loadDemoData(); });

    it('kompliansen räknar bara jämförbara BAS och säger hur många intervall exporten inte redovisar', () => {
        w.__updateCompliance();
        const t = w.document.getElementById('comp-gap').textContent;
        expect(t).toMatch(/av \d+ jämförbara BAS-intervall/);
        expect(t).toMatch(/\d+ intervall redovisas inte i exporten \(ett kön under \d+\)/);
        expect(t).not.toMatch(/maskeras/);
    });
    it('referensens P10 skrivs "P10 i {referens}", utan genitiv-s efter kolon', () => {
        w.__updateCompliance();
        const t = w.document.getElementById('comp-pol-label').textContent;
        expect(t).not.toMatch(/:s\b/);
        if (w.eval('harReferens()')) expect(t).toBe(`Under P10 i ${w.eval('referensKortnamn()')}`);
    });
    it('Lika arbete AID x BAS: nyckeltalet är detsamma som tabellen per AID-etikett, i båda lägena (ADR-90)', () => {
        for (const lage of ['export', 'skarm']) {
            w.__state.kLage = lage;
            w.__renderTabContent('matrix');
            const nyckel = w.document.getElementById('nyckel-la-aidbas').textContent;
            expect(nyckel, lage).toMatch(/^\d+ att granska/);
            expect(nyckel, lage).toBe(w.document.getElementById('nyckel-la-yrkesgrupper').textContent);
            // Trattens not ger ingen egen status.
            expect(w.document.getElementById('la-tratt-not').textContent).not.toMatch(/bedömda grupper/);
        }
        w.__state.kLage = 'skarm';
    });
    it('en röd gap-ruta står aldrig bredvid en tom åtgärdslista', () => {
        w.__updateCompliance();
        w.eval('renderActionChecklist()');
        const kort = w.document.getElementById('comp-gap');
        const rod = /crit|warn/.test(kort.className);
        const lista = w.document.getElementById('action-checklist-container').textContent;
        if (rod) expect(lista).not.toContain('inga öppna punkter');
    });
    it('varje jämförbart BAS med statusen Värt att granska (säkerställd, minst 3 %) blir en punkt i åtgärdslistan, och inga andra', () => {
        const ids = w.eval('buildActionChecklist()').map(i => i.id);
        const d = w.__getData();
        const jb = new Set(w.__dqJamforbaraBas(d, w.__K).jamforbara);
        const rader = w.eval('_laOversiktRader(getData())').filter(o => jb.has(o.bas));
        const flaggade = rader.filter(o => w.eval(`_laOversiktStatus(${JSON.stringify(o)}).niva`) === 'granska').map(o => o.bas);
        expect(flaggade.length, 'demodatan ska ha minst ett BAS att granska').toBeGreaterThan(0);
        flaggade.forEach(b => expect(ids).toContain('gap-bas-' + b));
        expect(ids.filter(i => i.startsWith('gap-bas-')).sort()).toEqual(flaggade.map(b => 'gap-bas-' + b).sort());
        // Rutan på Översikt räknar samma intervall.
        w.eval('updateCompliance()');
        expect(w.document.getElementById('comp-gap-val').textContent).toMatch(new RegExp(`^${flaggade.length} `));
    });
    it('nyckeltalet hänvisar inte till EU-gränsen för hela organisationen', () => {
        w.eval('updateDashboardStats()');
        const t = w.document.getElementById('dashboard-summary').textContent;
        expect(t).not.toContain('bör utredas enligt EU');
        // Under talet står bara vad det är; förklaringen ligger i verktygstipset (nyckeltalsraden är en rad hög).
        expect(t).toContain('rå skillnad, innan AID-etikett och BAS-intervall räknats bort');
        const tip = w.document.querySelector('#stat-paygap .stat-tip');
        expect(tip.getAttribute('title')).toContain('före hänsyn till AID-etikett, BAS-intervall och ålder');
        // Rågapet är en utgångspunkt, inget fynd: neutral färg också när det är långt från 100 %.
        expect(tip.classList.contains('crit')).toBe(false);
        expect(tip.classList.contains('ok')).toBe(false);
    });
    it('inledningen står på en rad med «Visa mer», och fliken upprepar inte sitt namn', () => {
        const d = w.document;
        const rader = [...d.querySelectorAll('.flik-intro-rad')];
        expect(rader.length).toBe(d.querySelectorAll('.flik-intro').length);                 // varje inledning ligger i en rad
        expect(rader.every(r => r.querySelectorAll('.flik-intro').length === 1 && r.querySelectorAll('button.flik-intro-mer').length === 1)).toBe(true);
        const rad = d.querySelector('#view-regression .flik-intro-rad, #view-lika-yrken .flik-intro-rad') || rader[0], knapp = rad.querySelector('.flik-intro-mer');
        expect([rad.classList.contains('ar-utfalld'), knapp.getAttribute('aria-expanded'), knapp.textContent]).toEqual([false, 'false', 'Visa mer']);
        knapp.click();
        expect([rad.classList.contains('ar-utfalld'), knapp.getAttribute('aria-expanded'), knapp.textContent]).toEqual([true, 'true', 'Visa mindre']);
        knapp.click();
        expect(rad.classList.contains('ar-utfalld')).toBe(false);
        w.eval('introRader()');                                                               // ett anrop till ger inga dubbla knappar
        expect(d.querySelectorAll('.flik-intro-mer').length).toBe(rader.length);
        // Sidhuvudet bär flikens namn; inledningens fetstil bär frågan, inte namnet en gång till.
        const titlar = Object.values(w.eval('typeof FLIKTITLAR !== "undefined" ? FLIKTITLAR : {}'));
        for (const st of d.querySelectorAll('.flik-intro > strong:first-child')) expect(st.textContent, st.textContent).not.toMatch(/^(Lika arbete|Likvärdigt arbete|Löneöversyn|Handlingsplan|Regler & praxis|Lönestruktur|Exportera|Löneläget|Tabeller och egna vyer|Löneöversikt) —|^(Lönestruktur|Exportera|Löneläget|Tabeller och egna vyer)$/);
        expect(titlar).toBeDefined();
    });
    it('Löneöversyn och Översikt följer flikmallen: inledning, nyckeltal i toppen, sedan innehållet', () => {
        w.__loadDemoData();
        const d = w.document, ren = t => t.replace(/[\u00a0\u202f]/g, ' ');
        d.querySelector('.nav-item[data-tab="loneoversyn"]').click();
        d.getElementById('forecast-budget-value').value = '2';
        d.getElementById('forecast-budget-value').dispatchEvent(new w.Event('input', { bubbles: true }));
        const kort = [...d.querySelectorAll('#lo-slutsatser .slutsats')].map(k => [k.querySelector('.slutsats-etikett').textContent, ren(k.querySelector('.slutsats-varde').textContent), ren(k.querySelector('.slutsats-under').textContent)]);
        expect(kort.map(k => k[0])).toEqual(['Pott', 'Använt', 'Kvar att fördela', 'Lönesumma per månad', 'Total kostnad']);
        expect(kort[0][1]).toMatch(/^[\d ]+ kr$/);                                           // 2 % av lönesumman
        expect(kort[1][2]).toMatch(/^\d+ % av potten$/);
        expect(kort[4][2]).toMatch(/^\d+ mån, PO /);
        const fore = (a, b) => !!(d.getElementById(a).compareDocumentPosition(d.getElementById(b)) & 4);
        expect(fore('lo-slutsatser', 'forecast-budget-value') && fore('forecast-budget-value', 'forecast-meter')).toBe(true);
        // Talen står en gång: mätaren visar bara förloppet, och utfallet upprepar inte lönesumman och kostnaden.
        expect(d.getElementById('forecast-meter').textContent).not.toMatch(/Kvar att fördela|Pott \(kr\/mån\)/);
        expect(d.getElementById('forecast-meter').querySelector('[role="img"]')).not.toBeNull();
        expect(d.getElementById('forecast-outcome').textContent).not.toMatch(/Lönesumma\/mån/);
        // Översikt: inledningen står före filraden och nyckeltalen.
        expect(fore('ov-intro', 'ov-filrad') && fore('ov-filrad', 'dashboard-summary')).toBe(true);
        expect(d.getElementById('ov-intro').closest('.flik-intro-rad')).not.toBeNull();
    });
    it('rapporten bär de tre nya diagrammen, och åldersdiagrammet bara när Ålder & karriär visar hela urvalet', () => {
        w.__loadDemoData();
        const diagram = () => w.eval('rapportModell()').avsnitt.flatMap(a => a.delar.filter(x => x.typ === 'diagram').map(x => `${a.id}:${x.id}`));
        expect(diagram()).toEqual(expect.arrayContaining(['lika:chart-la-tratt', 'struktur:chart-kon-aldergap', 'struktur:chart-lp-konlagen']));
        w.__renderTabContent('kon');
        const val = w.document.getElementById('bas-select-kon'), ettBas = [...val.options].map(o => o.value).find(v => v && v !== '__ALLA__');
        val.value = ettBas;
        expect(diagram()).not.toContain('struktur:chart-kon-aldergap');                      // fliken visar ett enda BAS-intervall
        val.value = '__ALLA__';
        expect(diagram()).toContain('struktur:chart-kon-aldergap');
    });
    it('nyckeltalen är korta tal med en förklarande rad, och Prioritering följer flikarnas form', () => {
        w.__loadDemoData();
        w.__renderTabContent('kon');
        const d = w.document, ren = t => t.replace(/[\u00a0\u202f]/g, ' ');
        expect(ren(d.getElementById('kon-kpi-n').textContent)).toMatch(/^\d[\d ]*$/);              // bara antalet …
        expect(ren(d.getElementById('kon-kpi-n-under').textContent)).toMatch(/^\d+ kvinnor · \d+ män$/);   // … könen på raden under
        expect(ren(d.getElementById('kon-kpi-slope').textContent)).toMatch(/^[+−][\d ]+ \/ [+−][\d ]+ kr$/);
        expect(d.getElementById('kon-kpi-agegap').style.color).toBe('');                       // ingen röd siffra utan förklaring
        expect(d.getElementById('kon-kpi-agegap-under').textContent).toMatch(/^(skillnad över 5 %|kvinnors lön i % av mäns)$/);
        const pr = d.getElementById('view-prioritering');
        expect(pr.querySelector('.flik-intro strong').textContent).toBe('Vilka AID-etiketter bör prioriteras utifrån löneläget?');
        expect(pr.querySelectorAll('.valrad input[name="prio-ref"]').length).toBe(2);
        expect(pr.querySelector(':scope > .card')).toBeNull();                                 // inget kort runt hela fliken
        expect(pr.querySelectorAll('#prio-summary .stat-box[style]').length).toBe(0);          // inga egna färger på nyckeltalen
    });
});

describe('referensbyte ritar om allt som namnger referensen', () => {
    let w;
    const hog = [...'ABCDEFGHIJK'].map(b => ({ bas: b, p10: 90000, med: 95000, p90: 99000 }));
    const lista = () => w.document.getElementById('action-checklist-container').textContent;
    beforeAll(() => { w = createAppWindow(); w.__loadDemoData(); });

    it('namnbyte syns direkt i åtgärdslistan', () => {
        w.__lasInReferens(hog, 'Egen A.csv');
        w.eval('renderActionChecklist()');
        expect(lista()).toContain('Egen A');
        w.__sattReferensNamn('Egen B');
        expect(lista()).toContain('Egen B');
        expect(lista()).not.toContain('Egen A');
    });
    it('"Återgå" rensar åtgärdslistan, uppladdningsmärket och filfältet', () => {
        w.eval("markUploadLoaded('upload-cell-policy', 'Inläst')");
        w.document.getElementById('btn-referens-aterga').click();
        expect(lista()).not.toContain('Egen B');
        expect(w.document.getElementById('upload-cell-policy').textContent).not.toContain('Inläst');
        expect(w.document.getElementById('file-input-policy').value).toBe('');
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

describe('Lönepolitik: organisationens band i bandkartan', () => {
    it('ett band per BAS med minst k personer, bredvid LPS-bandet', () => {
        const w = createAppWindow();
        w.__loadDemoData();
        w.document.querySelector('.nav-item[data-tab="benchmark"]').click();
        const lager = w.document.getElementById('chart-lp-bandmap')._figur.lager;   // ritat av diagramkärnan (ADR-39)
        const orgLager = lager.find(l => l.serie === `${w.eval('orgNamn()')} (P10–P90)`);   // demot heter Exempelkommunen (ADR-36)
        expect(orgLager).toBeTruthy();
        expect(orgLager.marke).toBe('intervall');
        const d = w.__getData();
        const basMedK = [...new Set(d.map(r => r.bas))].filter(b => d.filter(r => r.bas === b && r.lon > 0).length >= w.__K);
        expect(orgLager.data.length).toBe(basMedK.length);
        expect(orgLager.data.every(p => p.hog >= p.med && p.med >= p.lag)).toBe(true);
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

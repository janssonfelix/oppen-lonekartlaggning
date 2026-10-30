/**
 * Röktest (jsdom): Rensning, demoläget, referensen, Översikt, menyn och rapportunderlaget.
 *
 * Utbrutet ur smoke.test.js så att Vitest fördelar röktesterna över flera arbetare; varje describe-block
 * skapar sina egna fönster via createAppWindow (tests/helpers/app-harness.js).
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { createAppWindow } from './helpers/app-harness.js';
import { attributtext } from './helpers/attributtext.js';

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

describe('demoläget märker även tabellernas CSV', () => {
    it('filnamnet får DEMO_ i demoläget, men bara en gång', () => {
        const w = createAppWindow();
        expect(w.__csvFilnamn('utforska')).toBe('utforska');
        w.__loadDemoData();
        expect(w.__csvFilnamn('utforska')).toBe('DEMO_utforska');
        expect(w.__csvFilnamn('DEMO_Utforska_Median_2026-09-25')).toBe('DEMO_Utforska_Median_2026-09-25');
    });
});

// Invariant för "Rensa all data" (Art. 17-affordansen, riskanalys.md §6.3):
// efter rensning får ingen lönedata finnas kvar någonstans i dokumentet — inte
// heller i dolda flikar eller attribut. Alla löner ligger i 87 600–87 699, så
// varje gruppmått (median, percentil, kvartilgräns) hamnar i samma intervall och
// syns som "876xx" när mellanslag mellan siffror tas bort.
describe('Rensa all data: ingen lönedata kvar i dokumentet (invariant)', () => {
    for (const [namn, rensa] of [['knappen Rensa all data', w => w.__clearAllData()],
                                 ['automatisk rensning vid inaktivitet', w => w.__autoClearOnInactivity()]]) {
    it(`${namn}: inget lönevärde kvar i någon flik`, async () => {
        const w = createAppWindow();
        const rader = [];
        for (let i = 0; i < 60; i++) {
            rader.push({ bas: ['A', 'B', 'C'][i % 3], kon: i % 2 ? 'man' : 'kvinna', lon: 87600 + i, alder: 25 + (i % 40),
                yrke: `${100 + (i % 2)} Yrke`, aid: String(100 + (i % 2)), yrkeLabel: 'Yrke', enhet: '1000' });
        }
        // En tydlig extremlön (187 6xx innehåller "876xx"), så att extremvärdesdetektorn
        // har något att visa.
        rader.push({ bas: 'A', kon: 'man', lon: 187650, alder: 50, yrke: '100 Yrke', aid: '100', yrkeLabel: 'Yrke', enhet: '1000' });
        w.__state.data = rader;
        w.eval('populateSelects(); unlockTabs();');
        for (const flik of ['dashboard', 'bestammelser', 'matrix', 'likvardighet', 'struktur', 'prioritering', 'loneoversyn',
                            'kon', 'demografi', 'benchmark', 'utforska', 'kvalitet', 'rapport', 'handlingsplan']) {
            try { w.__renderTabContent(flik); } catch (_e) { /* en flik utan data får kasta — det som ritats räknas */ }
        }
        w.eval('renderOutliers()');
        // Utskriftsrapporten byggs i dokumentet (window.print stubbas) — även den ska rensas.
        w.print = () => {};
        await w.eval('buildPrintReport()');
        await new Promise(r => setTimeout(r, 0));
        const kvar = () => {
            const ut = [];
            for (const el of w.document.body.querySelectorAll('*')) {
                if (el.children.length) continue;
                const t = `${el.textContent} ${attributtext(el)}`.replace(/(\d)[\s  ](?=\d)/g, '$1');
                if (/876\d\d/.test(t)) ut.push((el.closest('[id]') || el).id || el.tagName);
            }
            return [...new Set(ut)];
        };
        // Diagram ritade med diagramkärnan (ritaFigur, ADR-39) bär sin figur som egenskap på behållaren och visar
        // lönevärden i SVG-text och i verktygstipsets portal. Rensningen måste nå dem alla: ett vars id inte börjar
        // med "chart-", ett utan id, ett i tomt läge (figuren finns kvar fast inget ritas) och ett som har lämnat
        // dokumentet medan dess tips visas.
        const figur = (over = {}) => ({ beskrivning: 'Medianlön per BAS', x: { skala: 'band', titel: 'BAS' }, y: { skala: 'linjar', titel: 'Kronor/månad', format: 'kr' },
            lager: [{ marke: 'stapel', serie: 'Alla', tips: d => [['Lön', `${d.y} kr`]], data: [{ x: 'A', y: 87611, etikett: '87 611 kr' }, { x: 'B', y: 87622, etikett: '87 622 kr', ...over }] }] });
        const ny = id => { const el = w.document.createElement('div'); if (id) el.id = id; w.document.getElementById('view-dashboard').appendChild(el); return el; };
        const karnan = {
            'id utan chart-': ny('figur-utan-chart-id'), 'utan id': ny(''), 'vanligt id': ny('chart-karnan-test'),
            'tomt läge': ny('figur-tomt-lage'), 'bortkopplad med tips': ny('figur-bortkopplad'),
        };
        for (const [vad, el] of Object.entries(karnan)) {
            if (vad === 'tomt läge') w.__ritaFigur(el, { ...figur(), lager: [{ marke: 'stapel', serie: 'Alla', data: [{ x: 'A', y: 87633, liten: true }] }] });
            else w.__ritaFigur(el, figur());
            expect(el._figur, vad).toBeDefined();
        }
        expect(karnan['tomt läge'].querySelector('[data-rf="tom"]')).not.toBeNull();
        expect(karnan['utan id'].textContent.replace(/\s/g, '')).toContain('87611kr');
        karnan['bortkopplad med tips'].querySelector('[data-marke="stapel"]').dispatchEvent(new w.MouseEvent('pointermove', { bubbles: true, clientX: 5, clientY: 5 }));
        const portal = w.document.querySelector('.chart-tip-portal');
        expect(portal.textContent).toContain('87611 kr');
        karnan['bortkopplad med tips'].remove();
        expect(w.__rfTipsAgare()).toBe(karnan['bortkopplad med tips']);
        expect(kvar().length, 'testet måste först se lönedata i dokumentet').toBeGreaterThan(0);
        expect(kvar()).toContain('figur-utan-chart-id');
        rensa(w);
        expect(kvar()).toEqual([]);
        expect(w.__explorerMinne().rows).toBe(0);
        // Inget av diagramkärnans minne finns kvar: ingen figur på någon behållare (inte heller den bortkopplade),
        // inga lyssnare eller storleksbevakning, tomt register, tom portal, ingen ägare.
        for (const [vad, el] of Object.entries(karnan)) {
            expect(Object.keys(el).filter(k => k.startsWith('_') && k !== '_chartExportAttached'), vad).toEqual([]);
            expect(el.textContent, vad).toBe('');
        }
        expect(w.__rfBehallare()).toEqual([]);
        expect(portal.textContent).toBe('');
        expect(portal.classList.contains('visible')).toBe(false);
        expect(w.__rfTipsAgare()).toBeNull();
    });
    }
});

// Paragrafhänvisningar ("§ 9", "DiskrL 3:8", "3 kap.", "art. 9") hör till hjälptexten
// — fliken Om verktyget, ordlistan, tooltips, "Hur används denna flik", förklarings-
// rutor och hjälpmodaler — inte till menyer, rubriker och löptext i gränssnittet.
// Exporterna (Excel/Word/PDF/JPA) omfattas inte.
describe('gränssnittet har inga paragrafhänvisningar utanför hjälptexten', () => {
    it('ingen synlig text i flikarna hänvisar till paragrafer eller artiklar', async () => {
        const w = createAppWindow();
        w.__loadDemoData();
        for (const flik of ['dashboard', 'bestammelser', 'matrix', 'likvardighet', 'rapport', 'struktur', 'prioritering',
                            'loneoversyn', 'handlingsplan', 'kon', 'demografi', 'benchmark', 'kvalitet', 'utforska']) {
            try { w.__renderTabContent(flik); } catch (_e) { /* en flik utan underlag får kasta */ }
        }
        await new Promise(r => setTimeout(r, 0));
        const hjalp = '#view-info, .flik-usage, .bakgrund-panel, .lv-hjalp, #gdpr-info-modal, #glossary-modal, #symbols-modal, '
            + '#data-residency-modal, #evidence-modal, script, style, noscript';
        const traffar = [];
        const walker = w.document.createTreeWalker(w.document.body, 4 /* NodeFilter.SHOW_TEXT */);
        for (let n = walker.nextNode(); n; n = walker.nextNode()) {
            if (n.parentElement && n.parentElement.closest(hjalp)) continue;
            if (/§|DiskrL|kap\. ?3|3 kap\.|\b[Aa]rt\. ?\d|[Ll]agen \d+:\d+/.test(n.textContent)) {
                traffar.push(`${(n.parentElement.closest('[id]') || {}).id}: ${n.textContent.trim().slice(0, 70)}`);
            }
        }
        expect(traffar).toEqual([]);
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
    it('en ren AID-policy med eget namn ger "saknar BAS-nivårader" i kompliansrutan', () => {
        w.__loadDemoData();
        w.__lasInReferens([{ aid: '123456', p10: 1, med: 2, p90: 3 }], 'AID-policy.csv');
        w.__updateCompliance();
        expect(w.document.getElementById('comp-pol-val').textContent).toContain('saknar BAS-nivårader');
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

    it('kompliansen räknar bara jämförbara BAS och säger hur många som maskeras', () => {
        w.__updateCompliance();
        const t = w.document.getElementById('comp-gap').textContent;
        expect(t).toMatch(/av \d+ jämförbara BAS-intervall/);
        expect(t).toMatch(/\d+ maskeras/);
    });
    it('en röd gap-ruta står aldrig bredvid en tom åtgärdslista', () => {
        w.__updateCompliance();
        w.eval('renderActionChecklist()');
        const kort = w.document.getElementById('comp-gap');
        const rod = /crit|warn/.test(kort.className);
        const lista = w.document.getElementById('action-checklist-container').textContent;
        if (rod) expect(lista).not.toContain('inga öppna punkter');
    });
    it('varje jämförbart BAS med gap över 5 % blir en punkt i åtgärdslistan', () => {
        const ids = w.eval('buildActionChecklist()').map(i => i.id);
        const med = v => { const a = [...v].sort((x, y) => x - y), m = a.length >> 1; return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2; };
        const d = w.__getData();
        const flaggade = w.__dqJamforbaraBas(d, w.__K).jamforbara.filter(b => {
            const kv = d.filter(r => r.bas === b && r.kon.includes('kvinna')).map(r => r.lon);
            const ma = d.filter(r => r.bas === b && (r.kon === 'man' || r.kon === 'män')).map(r => r.lon);
            return Math.abs(med(kv) / med(ma) * 100 - 100) > 5;
        });
        expect(flaggade.length, 'demodatan ska ha minst ett flaggat BAS').toBeGreaterThan(0);
        flaggade.forEach(b => expect(ids).toContain('gap-bas-' + b));
    });
    it('nyckeltalet hänvisar inte till EU-gränsen för hela organisationen', () => {
        w.eval('updateDashboardStats()');
        const t = w.document.getElementById('dashboard-summary').textContent;
        expect(t).not.toContain('bör utredas enligt EU');
        // Under talet står bara vad det är; förklaringen ligger i verktygstipset (nyckeltalsraden är en rad hög).
        expect(t).toContain('rå skillnad, innan yrke och nivå räknats bort');
        const tip = w.document.querySelector('#stat-paygap .stat-tip');
        expect(tip.getAttribute('title')).toContain('före hänsyn till yrke, nivå och ålder');
        // Rågapet är en utgångspunkt, inget fynd: neutral färg också när det är långt från 100 %.
        expect(tip.classList.contains('crit')).toBe(false);
        expect(tip.classList.contains('ok')).toBe(false);
    });
    it('inledningen står på en rad med «Visa mer», och fliken upprepar inte sitt namn', () => {
        const d = w.document;
        const rader = [...d.querySelectorAll('.flik-intro-rad')];
        expect(rader.length).toBe(d.querySelectorAll('.flik-intro').length);                 // varje inledning ligger i en rad
        expect(rader.every(r => r.querySelectorAll('.flik-intro').length === 1 && r.querySelectorAll('button.flik-intro-mer').length === 1)).toBe(true);
        const rad = d.querySelector('#view-matrix .flik-intro-rad, #view-lika-yrken .flik-intro-rad') || rader[0], knapp = rad.querySelector('.flik-intro-mer');
        expect([rad.classList.contains('ar-utfalld'), knapp.getAttribute('aria-expanded'), knapp.textContent]).toEqual([false, 'false', 'Visa mer']);
        knapp.click();
        expect([rad.classList.contains('ar-utfalld'), knapp.getAttribute('aria-expanded'), knapp.textContent]).toEqual([true, 'true', 'Visa mindre']);
        knapp.click();
        expect(rad.classList.contains('ar-utfalld')).toBe(false);
        w.eval('introRader()');                                                               // ett anrop till ger inga dubbla knappar
        expect(d.querySelectorAll('.flik-intro-mer').length).toBe(rader.length);
        // Sidhuvudet bär flikens namn; inledningens fetstil bär frågan, inte namnet en gång till.
        const titlar = Object.values(w.eval('typeof FLIKTITLAR !== "undefined" ? FLIKTITLAR : {}'));
        for (const st of d.querySelectorAll('.flik-intro > strong:first-child')) expect(st.textContent, st.textContent).not.toMatch(/^(Lika arbete|Likvärdigt arbete|Löneöversyn|Handlingsplan|Regler & praxis|Struktur & rapportmått|Dokumentera & exportera|Löneöversikt) —|^(Struktur & rapportmått|Dokumentera & exportera)$/);
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
        expect(pr.querySelector('.flik-intro strong').textContent).toBe('Vilka yrkesgrupper bör prioriteras utifrån löneläget?');
        expect(pr.querySelectorAll('.valrad input[name="prio-ref"]').length).toBe(2);
        expect(pr.querySelector(':scope > .card')).toBeNull();                                 // inget kort runt hela fliken
        expect(pr.querySelectorAll('#prio-summary .stat-box[style]').length).toBe(0);          // inga egna färger på nyckeltalen
    });
});

describe('menystruktur', () => {
    let w;
    beforeAll(() => { w = createAppWindow(); w.__loadDemoData(); });
    const flikar = () => [...w.document.querySelectorAll('.nav-item[data-tab]')].filter(b => !b.hidden).map(b => b.dataset.tab);
    const klicka = tab => w.document.querySelector(`.nav-item[data-tab="${tab}"]`).click();
    const synlig = id => w.document.getElementById(id).style.display === 'block';

    it('menyn har exakt flikarna i ordning; Jämförelse syns med ställningstagandet', () => {
        expect(flikar()).toEqual(['dashboard', 'bestammelser', 'matrix', 'likvardighet', 'struktur',
            'prioritering', 'loneoversyn', 'handlingsplan', 'kon', 'benchmark', 'utforska', 'dokumentera', 'info']);
        expect(w.document.querySelector('.nav-item[data-tab="benchmark"]').hidden).toBe(false);
        expect(w.document.querySelector('.nav-menu').textContent).toContain('5 · Dokumentera');
        expect(w.document.querySelector('.nav-menu').textContent).toContain('4 · Fördjupa');
    });
    it('Ålder & karriär: kohortförbehållet står under livscykelkurvorna, i Om verktygets metodtext och i metodbilagan', () => {
        klicka('kon');
        expect(w.document.getElementById('lifecycle-chart')).not.toBeNull();
        expect(w.document.querySelector('#livscykel-content .livscykel-kohort-not').textContent).toMatch(/tvärsnitt.*inte hur en persons lön utvecklas/);
        expect(w.document.getElementById('kon-kohort-not').textContent).toMatch(/tvärsnitt/);
        w.eval("renderInfoTab('metodik')");
        expect(w.document.getElementById('view-info').textContent).toMatch(/tvärsnitt.*kohorteffekter/);
        expect(w.eval('_methodAppendixData()').find(r => r[0] === 'Ålder & karriär (tvärsnitt)')[1]).toMatch(/tvärsnitt.*kohorteffekter/);
    });
    it('flikar med flera paneler visar alla sina paneler', () => {
        klicka('kon');
        ['view-kon', 'view-demografi', 'view-livscykel'].forEach(id => expect(synlig(id)).toBe(true));
        klicka('utforska');
        ['view-rapport', 'view-utforska'].forEach(id => expect(synlig(id)).toBe(true));
        klicka('dokumentera');
        ['view-kvalitet', 'view-dokumentera'].forEach(id => expect(synlig(id)).toBe(true));
    });
    it('Dokumentera innehåller export, JPA, färdigcheck och inställningar; Översikt inte', () => {
        const dok = w.document.getElementById('view-dokumentera');
        ['export-hub', 'btn-hub-jpa', 'btn-config-save']
            .forEach(id => expect(dok.contains(w.document.getElementById(id)), id).toBe(true));
        const oversikt = w.document.getElementById('view-dashboard');
        expect(oversikt.contains(w.document.getElementById('export-hub'))).toBe(false);
    });
    it('flikmålen rapport, demografi och kvalitet leds till sina flikar', () => {
        w.eval("navigateTo('rapport')");     expect(synlig('view-rapport') && synlig('view-utforska')).toBe(true);
        w.eval("navigateTo('demografi')");   expect(synlig('view-demografi')).toBe(true);
        w.eval("navigateTo('kvalitet')");    expect(synlig('view-dokumentera')).toBe(true);
        const a = w.document.createElement('button'); a.setAttribute('data-goto-tab', 'kvalitet');
        w.document.body.appendChild(a); a.click(); a.remove();
        expect(synlig('view-dokumentera')).toBe(true);
    });
    it('alla länkmål i processkarta, åtgärdslista och iakttagelser pekar på en flik som finns', () => {
        klicka('dashboard');
        const mal = [...w.document.querySelectorAll('[data-goto-tab],[data-go-to-tab],[data-flow-tab]')]
            .map(e => e.getAttribute('data-goto-tab') || e.getAttribute('data-go-to-tab') || e.getAttribute('data-flow-tab'));
        const finns = new Set(flikar().concat(['benchmark']));
        mal.forEach(m => expect(finns.has(w.eval(`tabMal(${JSON.stringify(m)})`)), m).toBe(true));
    });
    it('processkartan har 8 steg grupperade under menyns faser; steg 6–8 leder till Dokumentera', () => {
        w.__renderProcessTracker();
        const host = w.document.getElementById('process-tracker');
        expect(host.querySelectorAll('.ptrack-row').length).toBe(8);
        expect([...host.querySelectorAll('.ptrack-fas')].map(e => e.textContent.trim()))
            .toEqual(['1 · Underlag', '2 · Kartlägg & analysera', '3 · Åtgärda', '5 · Dokumentera']);
        const rows = host.querySelectorAll('.ptrack-row');
        [5, 6, 7].forEach(i => expect(rows[i].querySelector('[data-goto-tab]').getAttribute('data-goto-tab')).toBe('dokumentera'));
    });
    it('"Nästa steg" från Handlingsplan leder in i fördjupningen', () => {
        klicka('handlingsplan');
        expect(w.document.querySelector('.flow-next-bar [data-flow-tab]').getAttribute('data-flow-tab')).toBe('kon');
    });
    it('Jämförelse syns efter statistikuppladdning och låses vid rensning', () => {
        w.__state.statistik = [{ aid: '1', bas: 'A', median: 30000 }];
        w.eval('_visaJamforelseFlik(true)');
        expect(w.document.querySelector('.nav-item[data-tab="benchmark"]').hidden).toBe(false);
        w.__clearAllData();
        expect(w.document.querySelector('.nav-item[data-tab="benchmark"]').getAttribute('aria-disabled')).toBe('true');
    });
});

describe('utfällt som standard', () => {
    // Hjälppaneler förblir infällda; explore-urval-val är Utforskas rullgardin för värdeval (en kontroll, inte en gruppering).
    const HJALP = ['flik-usage', 'audit-panel', 'bakgrund-panel', 'explore-urval-val'];
    // ADR-36: organisationspaketets rad är ihopfälld på Översikt, och Underlagets kvalitet är
    // ihopfälld när allt är OK (utfälld vid varning).
    const UNDANTAG_ID = ['organisationspaket', 'uk-fallbar'];
    it('varje <details> är utfälld utom hjälppanelerna — i markup och efter rendering av alla flikar', () => {
        const w = createAppWindow();
        w.__loadDemoData();
        [...w.document.querySelectorAll('.nav-item[data-tab]')].forEach(b => { if (!b.disabled && !b.hidden) b.click(); });
        const infallda = [...w.document.querySelectorAll('details:not([open])')]
            // Flikens avsnitt (details.avsnitt): slutsatserna och det FÖRSTA avsnittet är öppna, resten fälls
            // ut av användaren.
            .filter(d => !HJALP.some(k => d.classList.contains(k)) && !UNDANTAG_ID.includes(d.id) && !d.classList.contains('avsnitt'))
            .map(d => (d.id || d.className || '') + ' :: ' + (d.querySelector('summary')?.textContent || '').trim().slice(0, 50));
        expect(infallda).toEqual([]);
    });
    it('flikens avsnitt: det första är öppet, och ett hopfällt avsnitt är ändå ritat (exporterna läser tabellerna)', () => {
        const w = createAppWindow();
        w.__loadDemoData();
        w.document.querySelector('.nav-item[data-tab="matrix"]').click();
        // Per flik i den nya formen: det första avsnittet öppet, övriga hopfällda.
        for (const [prefix, forsta] of [['avsnitt-la-', 'avsnitt-la-yrkesgrupper'], ['avsnitt-ak-', 'avsnitt-ak-karriar'], ['avsnitt-dk-', 'avsnitt-dk-robusthet'],
                ['avsnitt-st-', 'avsnitt-st-representation'], ['avsnitt-lo-', 'avsnitt-lo-riktade']]) {
            const flikens = [...w.document.querySelectorAll(`details.avsnitt[id^="${prefix}"]`)];
            expect(flikens.length, prefix).toBeGreaterThanOrEqual(4);
            expect(flikens[0].id).toBe(forsta);
            expect(flikens.map(a => a.open), prefix).toEqual([true, ...flikens.slice(1).map(() => false)]);
        }
        const avsnitt = [...w.document.querySelectorAll('details.avsnitt')];
        // Hopfällda, men ritade: tabellerna har rader och regressionskortet har innehåll.
        expect(w.document.querySelectorAll('#paygap-table tbody tr').length).toBeGreaterThan(0);
        expect(w.document.querySelectorAll('#skevhet-table tbody tr').length).toBeGreaterThan(0);
        expect(w.document.getElementById('regression-card').textContent.length).toBeGreaterThan(100);
        // Varje avsnitt har en rubrik i sin sammanfattning.
        for (const a of avsnitt) expect(a.querySelector(':scope > summary h2, :scope > summary h3'), a.id).not.toBeNull();   // h3 för avsnitt inne i ett kort (Regler & praxis)
    });
});

describe('Rensa all data tömmer Dokumentera', () => {
    it('färdigcheck och robusthet är tomma efter rensning', () => {
        const w = createAppWindow();
        w.__loadDemoData();
        w.document.querySelector('.nav-item[data-tab="dokumentera"]').click();
        w.__runRobusthet?.();
        expect(w.document.getElementById('fardigcheck-body').textContent.trim().length, 'färdigchecken ska ha ritats').toBeGreaterThan(0);
        w.__clearAllData();
        expect(w.document.getElementById('fardigcheck-body').textContent.trim()).toBe('');
        expect(w.document.getElementById('robusthet-body').textContent.trim()).toBe('');
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

describe('rapportunderlag', () => {
    const stubbaUrklipp = w => {
        const fångat = [];
        w.ClipboardItem = class { constructor(o) { this.o = o; } };
        Object.defineProperty(w.navigator, 'clipboard', { configurable: true, value: { write: async items => { fångat.push(...items); } } });
        return fångat;
    };
    it('utan data visar panelen hur man kommer igång', () => {
        const w = createAppWindow();
        w.document.querySelector('.nav-item[data-tab="dokumentera"]').click();
        expect(w.document.getElementById('rapportunderlag-innehall').textContent).toContain('Läs in underlag');
    });
    it('med demodata: fem avsnitt, ett block per flaggat yrke och godkänt par, tre diagram', () => {
        const w = createAppWindow();
        w.__loadDemoData();
        w.document.querySelector('.nav-item[data-tab="dokumentera"]').click();
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
    it('Kopiera lägger ren HTML och text på urklipp', async () => {
        const w = createAppWindow();
        w.__loadDemoData();
        w.document.querySelector('.nav-item[data-tab="dokumentera"]').click();
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
        w.document.querySelector('.nav-item[data-tab="dokumentera"]').click();
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
        w.document.querySelector('.nav-item[data-tab="dokumentera"]').click();
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
        expect(anrop).toContain('matrix');
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

describe('inläsning: alla BAS-intervall ingår', () => {
    it('personer i BAS K och senare läses in som alla andra, utan särskild räkning', async () => {
        const { readFileSync } = await import('node:fs');
        const { join, dirname } = await import('node:path');
        const { fileURLToPath } = await import('node:url');
        const root = join(dirname(fileURLToPath(import.meta.url)), '..');
        const w = createAppWindow();
        w.eval(readFileSync(join(root, 'vendor', 'papaparse.min.js'), 'utf8'));
        const rader = ['BAS;Månadslön;Ålder;Kön;AID'];
        for (let i = 0; i < 40; i++) rader.push(`${['A', 'B', 'J'][i % 3]};${30000 + i * 10};${30 + (i % 20)};${i % 2 ? 'Man' : 'Kvinna'};5301`);
        for (let i = 0; i < 5; i++) rader.push(`K;88888;50;Man;7101`);
        for (let i = 0; i < 2; i++) rader.push(`L;99999;55;Kvinna;7102`);
        const fil = new w.File([rader.join('\n')], 'personal.csv', { type: 'text/csv' });
        w.loadStructureFile(fil);
        for (let i = 0; i < 100 && !w.__state.data.length; i++) await new Promise(r => setTimeout(r, 20));
        expect(w.__state.data.length).toBe(47);
        expect(w.__state.data.filter(r => r.bas === 'K').length).toBe(5);
        expect(w.__state.data.filter(r => r.bas === 'L').length).toBe(2);
        expect(w.__state.dataAudit.excludedOverBas).toBeUndefined();
        const status = w.document.getElementById('data-status').textContent;
        expect(status).toContain('47 rader · 5 BAS');
        expect(status).not.toContain('analyseras manuellt');
        expect(w.eval('buildActionChecklist()').some(i => i.id === 'bas-ovanfor-grans')).toBe(false);
    });
});

describe('demodata med kandidatpar', () => {
    it('demodatan ger minst ett kandidatpar där båda grupperna har minst k personer', () => {
        const w = createAppWindow();
        w.__loadDemoData();
        const par = w.__computeLikvardighetPairs().pairs || [];
        const godkanda = par.filter(p => p.kvN >= w.__K && (p.maN === null || p.maN === undefined || p.maN >= w.__K));
        expect(godkanda.length).toBeGreaterThan(0);
    });
    it('rapportunderlaget får parblock och diagrammet över kandidatpar', () => {
        const w = createAppWindow();
        w.__loadDemoData();
        w.document.querySelector('.nav-item[data-tab="dokumentera"]').click();
        expect(w.__rapportunderlagBlock().some(b => b.id.startsWith('par:'))).toBe(true);
        expect(w.document.querySelector('[data-rapport-diagram="chart-likvardighet-heatmap"]')).not.toBeNull();
    });
    it('självdiagnostikens testdata är oförändrad (200 personer, BAS A–E)', () => {
        const w = createAppWindow();
        const d = w.eval('generateTestData()');
        expect(d.length).toBe(200);
        expect([...new Set(d.map(r => r.bas))].sort()).toEqual(['A', 'B', 'C', 'D', 'E']);
    });
});

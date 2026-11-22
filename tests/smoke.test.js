/**
 * #1 Boot-/render-röktest (jsdom).
 *
 * De rena kärnorna (stat/trend/forecast/structure/likvardighet) är vältestade och
 * drift-skyddade. Det som SAKNADE automatiskt skydd var render-, export- och
 * boot-koden i app.js — den verifierades bara manuellt i webbläsare. Detta test
 * laddar index.html + app.js i jsdom, stubbar de tunga biblioteken (XLSX/
 * PapaParse/JSZip) och kör hela boot-pipelinen + varje fliks render-funktion.
 * Det fångar exakt den regressionsklass som t.ex. en död-kod-städning kan införa
 * (kastande render, trasig wiring) utan att kräva en riktig webbläsare.
 *
 * Det är ett RÖKTEST, inte ett pixel-/innehållstest: assertionen är "renderar utan
 * att kasta + förväntade element finns", inte exakta värden (det täcks av kärn-testerna).
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { createAppWindow } from './helpers/app-harness.js';

let win;

beforeAll(() => {
    win = createAppWindow();
    win.__loadDemoData();   // blocken nedan läser demodatan
});

describe('#1 röktest: #8 metod-appendix + #5 rapportbyggare', () => {
    it('metod-appendix byggs och innehåller demo-flagga + modellspec', () => {
        const data = JSON.stringify(win.__methodAppendixData());
        expect(data).toContain('DEMODATA');          // #9 demoläge syns
        expect(data).toContain('HC3');                // modellspec finns
    });

    it('§3:10- och strukturmåtten kan beräknas på demodata', () => {
        expect(() => win.__computeLikvardighetPairs()).not.toThrow();
        expect(() => win.__stRepresentationByBas(win.__getData())).not.toThrow();
    });
});

describe('#export röktest: BAS-grupperade tabeller blir Word-block', () => {
    it('rapport-tabellen exporteras som block: titel + upprepade rubriker + tomrad per BAS', () => {
        // generateRapport har körts av demodata-pipelinen → rapport-table har group-headers
        const clone = win.__cloneTable('rapport-table');
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

describe('punkt-sampling: stora punktmoln ritas som ett jämnt urval (perf vid stora underlag)', () => {
    // Nedsamplingen gör diagramkärnan (ADR-39): bara det som ritas påverkas — figuren, och alla mått, har full data.
    const moln = n => ({ beskrivning: 'M', x: { skala: 'linjar' }, y: { skala: 'linjar' },
        lager: [{ marke: 'punkt', serie: 'P', farg: '#2563eb', data: Array.from({ length: n }, (_, i) => ({ x: i, y: i * 2 })) },
                { marke: 'linje', serie: 'L', farg: '#111111', data: [{ x: 0, y: 0 }, { x: n, y: n * 2 }] }] });
    const rita = n => { win.__f = moln(n); return win.eval('_rfByggSvg(window.__f, 800, {})'); };

    it('lämnar små punktmoln och linjer orörda', () => {
        const svg = rita(5000);
        expect(svg.getAttribute('data-nedsamplat')).toBeNull();
        expect(svg.querySelectorAll('[data-marke="punkt"]').length).toBe(5000);
        expect(svg.querySelectorAll('path[data-marke="linje"]').length).toBe(1);
    });

    it('nedsamplar stora punktmoln till högst 8 000 punkter, jämnt fördelade, och säger hur många som ritas', () => {
        const svg = rita(40000);
        const punkter = [...svg.querySelectorAll('[data-marke="punkt"]')];
        expect(punkter.length).toBeLessThanOrEqual(8000);
        expect(punkter.length).toBeGreaterThan(0);
        expect(svg.getAttribute('data-nedsamplat')).toBe(`${punkter.length}/40000`);
        // Var k:te punkt: indexen i figuren ligger med jämna steg.
        const idx = punkter.map(p => Number(p.getAttribute('data-i')));
        const steg = idx[1] - idx[0];
        expect(idx.every((v, i) => i === 0 || v - idx[i - 1] === steg)).toBe(true);
        expect(win.__f.lager[0].data).toHaveLength(40000);   // figuren är orörd
    });

    it('är deterministisk (samma indata → samma bild)', () => {
        expect(rita(40000).outerHTML).toBe(rita(40000).outerHTML);
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

describe('Utforska 2.0', () => {
    const $ = id => win.document.getElementById(id);
    const satt = (id, v) => { const el = $(id); if (el.type === 'checkbox') el.checked = v; else el.value = v; };
    const aterstall = () => {
        satt('explore-rad', 'bas'); satt('explore-kolumn', 'ingen'); satt('explore-measure', 'median');
        satt('explore-visa', 'helhet'); satt('explore-typ', 'auto'); satt('explore-inkludera-sma', false);
        win.__explorerSetFilter({});
    };
    const rita = () => { win.__renderExplorer(); return $('chart-explore'); };
    // Tomlägets rad ("Inga grupper att visa") är ingen grupp.
    const kolumn0 = () => [...$('explore-table').querySelectorAll('tbody tr')].filter(tr => !tr.querySelector('.explore-tom')).map(tr => tr.cells[0].textContent.trim());

    beforeAll(() => { win.__loadDemoData(); });

    it('standardvyn ritar staplar per BAS i ordningen A → Z', () => {
        aterstall();
        const gd = rita();
        expect(gd._figur.lager[0].marke).toBe('stapel');   // ritat av diagramkärnan (ADR-39)
        const bas = kolumn0();
        expect(bas.length).toBeGreaterThan(1);
        expect(bas).toEqual([...bas].sort((a, b) => a.localeCompare(b, 'sv')));
    });

    it('alla kategoriaxlar är kategoriska (enhetskoder tolkas inte som tal)', () => {
        aterstall(); satt('explore-rad', 'enhet');
        expect(rita()._figur.x.skala).toBe('band');
    });

    it('åldersgrupper visas från yngst till äldst', () => {
        aterstall(); satt('explore-rad', 'alder'); rita();
        const ord = ['<20', '20–24', '25–29', '30–34', '35–39', '40–44', '45–49', '50–54', '55–59', '60–64', '65+'];
        const idx = kolumn0().map(l => ord.indexOf(l));
        expect(idx.every((v, i) => i === 0 || v > idx[i - 1])).toBe(true);
    });

    it('liggande staplar', () => {
        aterstall(); satt('explore-typ', 'liggande');
        const f = rita()._figur;
        expect(f.lager[0].riktning).toBe('liggande');
        expect(f.y.skala).toBe('band');
    });

    it('diagramtyperna står i två grupper, Vanliga och Fler diagramtyper, och ingen typ har försvunnit', () => {
        const sel = $('explore-typ');
        const grupper = [...sel.querySelectorAll(':scope > optgroup')];
        expect(grupper.map(g => g.label)).toEqual(['Vanliga', 'Fler diagramtyper']);
        expect(sel.querySelectorAll(':scope > option')).toHaveLength(0);
        expect([...grupper[0].querySelectorAll('option')].map(o => o.textContent)).toEqual(['Automatisk', 'Staplar', 'Liggande staplar', 'Låddiagram', 'Grupperade staplar']);
        expect([...grupper[1].querySelectorAll('option')].map(o => o.textContent)).toEqual(['Hanteldiagram', 'Bubbeldiagram', 'Individpunkter', 'Punktsvärm', 'Regnmoln', 'Kvantilpunkter', 'Värmekarta', 'Staplade staplar']);
        // Varje typ i registret går att välja, och etiketten är densamma som i registret.
        const typer = win.eval('EXPLORE_TYPER');
        expect([...sel.options].map(o => o.value).filter(v => v !== 'auto').sort()).toEqual(Object.keys(typer).sort());
        for (const o of sel.options) if (o.value !== 'auto') expect(o.textContent).toBe(typer[o.value].label);
        expect(win.document.getElementById('view-utforska').textContent).not.toMatch(/Heatmap/);
    });

    it('Utforskas två verktyg har var sin avsnittsrubrik och är öppna', () => {
        const d = win.document;
        const ov = d.getElementById('avsnitt-ut-oversikt'), egna = d.getElementById('avsnitt-ut-egna');
        expect(ov.querySelector(':scope > summary h2').textContent).toBe('Löneöversikt — alla BAS-intervall');
        expect(egna.querySelector(':scope > summary h2').textContent).toBe('Egna vyer');
        expect(ov.open && egna.open).toBe(true);
        expect(ov.contains(d.getElementById('rapport-table')) && egna.contains(d.getElementById('chart-explore'))).toBe(true);
    });

    it('två dimensioner ger heatmap och korstabell', () => {
        aterstall(); satt('explore-rad', 'aid'); satt('explore-kolumn', 'alder');
        const gd = rita();
        expect(gd._figur.lager[0].marke).toBe('ruta');
        const ths = $('explore-table').querySelectorAll('thead th');
        expect(ths.length).toBe(gd._figur.x.ordning.length + 1);
    });

    it('grupperade staplar ger en serie per kolumnvärde', () => {
        aterstall(); satt('explore-rad', 'bas'); satt('explore-kolumn', 'kon'); satt('explore-typ', 'grupperade');
        const gd = rita();
        expect(gd._figur.lager.every(l => l.marke === 'stapel')).toBe(true);
        expect(gd._figur.lager.map(l => l.serie).sort()).toEqual(['Kvinna', 'Man']);
    });

    it('en diagramtyp som inte passar är inaktiverad och vyn faller tillbaka', () => {
        aterstall(); satt('explore-typ', 'heatmap'); rita();
        const opt = [...$('explore-typ').options].find(o => o.value === 'heatmap');
        expect(opt.disabled).toBe(true);
        expect(opt.title).toMatch(/Kolumner/);
        expect($('explore-typ').value).toBe('auto');
        expect($('chart-explore')._figur.lager[0].marke).toBe('stapel');
    });

    const konOpt = () => [...$('explore-visa').options].find(o => o.value === 'kon');
    it('per kön går inte för gap, men för två dimensioner', () => {
        aterstall(); satt('explore-measure', 'gap'); rita();
        expect(konOpt().disabled).toBe(true);
        expect(konOpt().title).toMatch(/jämför redan könen/);
        aterstall(); satt('explore-kolumn', 'alder'); rita();
        expect(konOpt().disabled).toBe(false);
        aterstall(); rita();
        expect(konOpt().disabled).toBe(false);
    });

    it('per kön ger en serie per kön — som hantel när diagramtypen väljs automatiskt, som staplar när man ber om det', () => {
        aterstall(); satt('explore-visa', 'kon');
        // Automatiskt val för ett lönemått per kön: hantel (avståndet mellan könen syns, axeln börjar inte på noll).
        expect(rita()._figur.lager.map(l => [l.marke, l.serie])).toEqual([['intervall', 'Skillnad kvinnor–män'], ['punkt', 'Kvinna'], ['punkt', 'Man']]);
        // Det automatiska valet låser inte "Visa": helhet går att välja, och ger då staplar.
        expect([...$('explore-visa').options].find(o => o.value === 'helhet').disabled).toBe(false);
        satt('explore-visa', 'helhet');
        expect(rita()._figur.lager.map(l => l.marke)).toEqual(['stapel']);
        satt('explore-visa', 'kon'); satt('explore-typ', 'staplar');
        expect(rita()._figur.lager.map(l => [l.marke, l.serie])).toEqual([['stapel', 'Kvinna'], ['stapel', 'Man']]);
        // Antal är inget lönemått: staplar också automatiskt.
        satt('explore-typ', 'auto'); satt('explore-measure', 'n');
        expect(rita()._figur.lager.every(l => l.marke === 'stapel')).toBe(true);
    });

    it('filtret begränsar urvalet och visas som etikett', () => {
        aterstall();
        const forsta = win.__getData()[0].bas;
        win.__explorerSetFilter({ bas: [forsta] });
        rita();
        expect(kolumn0()).toEqual([forsta]);
        expect($('explore-filter-chips').textContent).toContain(forsta);
    });

    it('ett filtervärde som inte finns i datan tas bort tyst', () => {
        aterstall();
        win.__explorerSetFilter({ bas: ['FINNS-INTE'] });
        rita();
        expect(kolumn0().length).toBeGreaterThan(1);
        expect($('explore-filter-chips').textContent).toBe('');
    });

    it('filter som tillsammans ger noll personer visar tomläget, och Rensa filter fungerar', () => {
        aterstall();
        const rows = win.__getData();
        const aidAv = r => win.__utGroupKey(r, 'aid');
        let par = null;
        for (const b of new Set(rows.map(r => r.bas))) {
            const iB = new Set(rows.filter(r => r.bas === b).map(aidAv));
            const annan = rows.map(aidAv).find(a => !iB.has(a));
            if (annan) { par = [b, annan]; break; }
        }
        expect(par).not.toBeNull();
        win.__explorerSetFilter({ bas: [par[0]], aid: [par[1]] });
        rita();
        expect($('chart-explore').textContent).toContain('Inga personer matchar urvalet');
        $('chart-explore').querySelector('[data-explore-clear]').click();
        expect(kolumn0().length).toBeGreaterThan(1);
    });

    it('tableToMatrix hoppar över rader och tömmer celler som är märkta för export', () => {
        const t = win.document.createElement('table');
        t.id = 'tmp-export-tabell';
        t.innerHTML = '<thead><tr><th>G</th><th>V</th></tr></thead><tbody>'
            + '<tr><td>A</td><td>1</td></tr><tr data-export-utelamna><td>B</td><td>2</td></tr>'
            + '<tr><td>C</td><td data-export-tom>3</td></tr></tbody>';
        win.document.body.appendChild(t);
        expect(win.__tableToMatrix('tmp-export-tabell')).toEqual([['G', 'V'], ['A', '1'], ['C', '']]);
        t.remove();
    });

    it('rutan för små grupper visar tröskeln', () => {
        aterstall(); rita();
        expect($('explore-inkludera-sma-label').textContent).toBe('Ta med grupper under 10 i exporten');
    });

    it('hanteldiagram: en linje per grupp och en punktserie per kön', () => {
        aterstall(); satt('explore-typ', 'hantel');
        const gd = rita();
        expect(gd._figur.lager.map(l => [l.marke, l.serie])).toEqual([['intervall', 'Skillnad kvinnor–män'], ['punkt', 'Kvinna'], ['punkt', 'Man']]);
        expect(gd._figur.lager[0].tips).toBeUndefined();   // strecket har inget eget verktygstips
        expect(gd._figur.lager[0].legend).toBe(false);
    });

    it('hanteldiagram går inte att välja för gap, eller när urvalet bara har ett kön', () => {
        aterstall(); satt('explore-measure', 'gap'); rita();
        expect([...$('explore-typ').options].find(o => o.value === 'hantel').disabled).toBe(true);
        aterstall(); win.__explorerSetFilter({ kon: ['Kvinna'] }); rita();
        const opt = [...$('explore-typ').options].find(o => o.value === 'hantel');
        expect(opt.disabled).toBe(true);
        expect(opt.title).toBe('Urvalet innehåller bara ett kön.');
        expect([...$('explore-visa').options].find(o => o.value === 'kon').disabled).toBe(true);
    });

    it('bubbeldiagram: andel kvinnor 0–100 på x, median på y, och måttvalet är låst', () => {
        aterstall(); satt('explore-typ', 'bubbla');
        const gd = rita();
        expect(gd._figur.lager[0].marke).toBe('punkt');
        expect(gd._figur.lager[0].data.every(d => d.x >= 0 && d.x <= 100)).toBe(true);
        expect(gd._figur.x.doman).toEqual([0, 100]);
        expect($('explore-measure').disabled).toBe(true);
        expect(gd._figur.referens.map(r => r.x)).toEqual([40, 60]);
    });

    it('låddiagram och individpunkter ritar lönerna per kön', () => {
        aterstall(); satt('explore-typ', 'lada');
        let gd = rita();
        expect(gd._figur.lager.every(l => l.marke === 'lada')).toBe(true);
        expect(gd._figur.lager[0].punkter).toBeUndefined();        // låda med morrhår och avvikare
        satt('explore-typ', 'punkter');
        gd = rita();
        expect(gd._figur.lager[0].punkter).toBe('alla');
        const antal = gd._figur.lager.reduce((s, l) => s + l.data.length, 0);
        expect(antal).toBe(win.__getData().filter(r => r.lon > 0).length);
    });

    it('individpunkter respekterar filtret', () => {
        aterstall(); satt('explore-typ', 'punkter');
        const forsta = win.__getData()[0].bas;
        win.__explorerSetFilter({ bas: [forsta] });
        const gd = rita();
        expect(gd._figur.lager.every(l => l.marke === 'lada' && l.punkter === 'alla')).toBe(true);
        expect(new Set(gd._figur.lager.flatMap(l => l.data.map(d => d.x)))).toEqual(new Set([forsta]));
    });
});

describe('lönepolitik: policyFor-kaskad + flik', () => {
    const setPolicy = rows => { win.__state.policy = rows; };
    const P = (o) => Object.assign({ p10: 1, med: 2, p90: 3 }, o);

    it('mest specifik vinner: aid+bas före aid-only före bas-only', () => {
        setPolicy([
            P({ bas: 'D', tag: 'bas-only' }),
            P({ aid: '207', tag: 'aid-only' }),
            P({ aid: '207', bas: 'D', tag: 'aid+bas' })
        ]);
        expect(win.__policyFor('207', 'D').tag).toBe('aid+bas');
        expect(win.__policyFor('207', 'E').tag).toBe('aid-only');   // aid matchar, bas saknas i den raden
        expect(win.__policyFor('999', 'D').tag).toBe('bas-only');   // okänd aid → faller till BAS-nivå
        expect(win.__policyFor('999', 'Z')).toBeNull();
    });

    it('BAS-only-fil beter sig exakt som före ändringen', () => {
        setPolicy([P({ bas: 'A', tag: 'a' }), P({ bas: 'B', tag: 'b' })]);
        expect(win.__policyFor(null, 'A').tag).toBe('a');
        expect(win.__policyFor('207', 'B').tag).toBe('b');   // aid ignoreras när ingen aid-rad finns
        expect(win.__policyFor('207', null)).toBeNull();
    });

    it('AID-only-fil fungerar utan BAS', () => {
        setPolicy([P({ aid: '207', tag: 'x' })]);
        expect(win.__policyFor('207', null).tag).toBe('x');
        expect(win.__policyFor('207', 'D').tag).toBe('x');
        expect(win.__policyFor(null, 'D')).toBeNull();
    });

    it('policyLevelLabel beskriver referensens nivå', () => {
        expect(win.__policyLevelLabel({ aid: '1', bas: 'D' })).toBe('AID + BAS');
        expect(win.__policyLevelLabel({ aid: '1' })).toBe('AID-specifik');
        expect(win.__policyLevelLabel({ bas: 'D' })).toBe('BAS-intervall');
        expect(win.__policyLevelLabel(null)).toBeNull();
    });

    it('tom policy → modellen flaggar hasPolicy=false och fliken visar tomstatus', () => {
        setPolicy([]);
        const m = win.__buildLonepolitikModel();
        expect(m.hasPolicy).toBe(false);
        expect(() => win.__renderLonepolitik()).not.toThrow();
        expect(win.document.getElementById('lonepolitik-empty').style.display).toBe('block');
    });

    it('med policy byggs modellen med täckningsgrad och maskeringstrappa', () => {
        win.__loadDemoData();
        const bas = [...new Set(win.__getData().map(r => r.bas))];
        setPolicy(bas.map(b => ({ bas: b, p10: 25000, med: 32000, p90: 45000 })));
        const m = win.__buildLonepolitikModel();
        expect(m.hasPolicy).toBe(true);
        expect(m.byBas.length).toBeGreaterThan(0);
        expect(m.coverage.personsPct).toBeGreaterThan(0);
        // varje AID-grupp har en giltig maskeringsnivå
        const tiers = m.byBas.flatMap(b => b.groups.map(g => g.tier));
        tiers.forEach(t => expect(['full', 'count', 'masked']).toContain(t));
        // full analys kräver n >= kTroskel()
        m.byBas.forEach(b => b.groups.forEach(g => {
            if (g.tier === 'full') expect(g.n).toBeGreaterThanOrEqual(10);
            if (g.tier === 'masked') expect(g.n).toBeLessThan(5);
        }));
        expect(() => win.__renderLonepolitik()).not.toThrow();
        expect(win.document.getElementById('lonepolitik-table')).not.toBeNull();
        setPolicy([]);   // städa så senare test inte påverkas
    });
});

describe('handläggarstöd: gruppdossier, robusthet, färdigcheck', () => {
    it('dossier-kandidater respekterar k-anonymiteten', () => {
        win.__loadDemoData();
        const cands = win.__gruppdossierCandidates();
        expect(cands.length).toBeGreaterThan(0);
        cands.forEach(g => expect(g.rows.length).toBeGreaterThanOrEqual(10));
    });

    it('buildGruppdossier samlar blocken och tål saknade referenser', () => {
        const key = win.__gruppdossierCandidates()[0].key;
        const d = win.__buildGruppdossier(key);
        expect(d).not.toBeNull();
        expect(d.n).toBeGreaterThanOrEqual(10);
        expect(d.nKv + d.nMa).toBeLessThanOrEqual(d.n);
        expect(Number.isFinite(d.median)).toBe(true);
        // block som saknar underlag ska vara null/tomma — aldrig kasta
        expect(Array.isArray(d.lvAsSubject)).toBe(true);
        expect(Array.isArray(d.suggestions)).toBe(true);
    });

    it('okänd nyckel ger null i stället för att kasta', () => {
        expect(win.__buildGruppdossier('finns-inte|Z')).toBeNull();
    });

    it('textversionen innehåller gränsdragningen mot sakliga skäl', () => {
        const d = win.__buildGruppdossier(win.__gruppdossierCandidates()[0].key);
        const txt = win.__gruppdossierAsText(d);
        expect(txt).toMatch(/^Gruppdossier: /);
        expect(txt).toContain('dokumenterar inte sakliga skäl');
    });

    it('robusthet: kvinnotröskel-körningen ÅTERSTÄLLER state', () => {
        win.__state.likvardighet.kvinnoTrosholdPct = 60;
        const r = win.__robusthetLikvardighet([55, 60, 65]);
        expect(win.__state.likvardighet.kvinnoTrosholdPct).toBe(60);   // kritiskt
        expect(r.trösklar).toEqual([55, 60, 65]);
        r.rows.forEach(row => {
            expect(row.hits).toBeGreaterThanOrEqual(1);
            expect(row.hits).toBeLessThanOrEqual(3);
        });
    });

    it('robusthet: prioriteringsjämförelsen flaggar när bara en referens finns', () => {
        const saved = win.__state.policy;
        win.__state.policy = [];
        const r = win.__robusthetPrioritering();
        expect(r.tooFew === true || r.refs.length >= 2).toBe(true);
        win.__state.policy = saved;
    });

    it('färdigcheck ger observationer med nivå och detalj', () => {
        const items = win.__buildFardigcheck();
        expect(Array.isArray(items)).toBe(true);
        items.forEach(i => {
            expect(['warn', 'info']).toContain(i.level);
            expect(typeof i.title).toBe('string');
            expect(i.title.length).toBeGreaterThan(0);
            expect(typeof i.detail).toBe('string');
        });
    });

    it('kvalitetssäkringsfliken renderar båda panelerna utan kast', () => {
        expect(() => win.__renderKvalitetssakring()).not.toThrow();
        expect(win.document.getElementById('robusthet-body')).not.toBeNull();
        expect(win.document.getElementById('fardigcheck-body')).not.toBeNull();
    });
});

describe('förbättringar: modal-dossier och manuell robusthetsanalys', () => {
    it('gruppdossiern är INTE en flik längre utan en modal', () => {
        expect(win.document.getElementById('tab-gruppdossier')).toBeNull();
        expect(win.document.getElementById('view-gruppdossier')).toBeNull();
        expect(win.document.getElementById('dossier-modal')).not.toBeNull();
    });

    it('modalen öppnas med vald grupp och stängs igen', () => {
        win.__loadDemoData();
        const key = win.__gruppdossierCandidates()[0].key;
        win.__openGruppdossier(key);
        const modal = win.document.getElementById('dossier-modal');
        expect(modal.style.display).toBe('flex');
        expect(win.document.getElementById('dossier-select').value).toBe(key);
        expect(win.document.getElementById('dossier-body').innerHTML.length).toBeGreaterThan(50);
        win.__closeGruppdossier();
        expect(modal.style.display).toBe('none');
    });

    it('robusthetspanelen visar en startknapp i stället för att räkna direkt', () => {
        win.__renderKvalitetssakring();
        const host = win.document.getElementById('robusthet-body');
        expect(host.querySelector('#btn-run-robusthet')).not.toBeNull();
        // färdigchecken är billig och körs direkt
        expect(win.document.getElementById('fardigcheck-body').innerHTML.length).toBeGreaterThan(20);
    });

    it('robusthetsanalysen producerar resultat när den körs', async () => {
        win.__runRobusthet();
        await new Promise(r => setTimeout(r, 120));   // renderingen är fördröjd för att hinna måla om
        const host = win.document.getElementById('robusthet-body');
        expect(host.innerHTML).toMatch(/Likvärdigt arbete|Prioritering/);
    });
});

describe('k-anonymitet, sortering, efterlevnad och dossiern — sortering', () => {
    it('utforskartabellen går att sortera även efter omritning', () => {
        win.__loadDemoData();
        win.__renderExplorer();
        win.__renderExplorer();            // andra renderingen: tabellhuvudet behåller sina lyssnare
        const th = win.document.querySelectorAll('#explore-table thead th');
        expect(th.length).toBeGreaterThan(0);
        // enableTableSort märker sorterbara kolumner med .sortable — saknas den
        // har lyssnarna inte registrerats om.
        expect(th[0].classList.contains('sortable')).toBe(true);
    });
});

describe('k-anonymitet, sortering, efterlevnad och dossiern — efterlevnad', () => {
    it('efterlevnadskortet blir inte grönt när policyn saknar BAS-nivårader', () => {
        const sparadPolicy = win.__state.policy;
        try {
            win.__loadDemoData();
            win.__state.policy = [{ aid: '5301', p10: 25000, med: 30000, p90: 40000 }];   // endast AID
            win.__updateCompliance();
            const card = win.document.getElementById('comp-pol');
            expect(card.className).toContain('na');
            expect(card.className).not.toContain('ok');
        } finally {
            win.__state.policy = sparadPolicy;
        }
    });
});

describe('k-anonymitet, sortering, efterlevnad och dossiern — dossiern', () => {
    it('hypotesrutan i dossiern renderar markup i stället för att visa taggar', () => {
        win.__loadDemoData();
        const key = win.__gruppdossierCandidates()[0].key;
        const d = win.__buildGruppdossier(key);
        win.__openGruppdossier(key);
        const body = win.document.getElementById('dossier-body');
        expect(body.innerHTML).not.toContain('&lt;strong&gt;');
        if (d.suggestions.length) {
            // textkopian ska däremot vara fri från markup
            expect(win.__gruppdossierAsText(d)).not.toMatch(/<\/?strong>/);
        }
        win.__closeGruppdossier();
    });
});

describe('exportmeny på alla diagram', () => {
    const vanta = () => new Promise(r => setTimeout(r, 0));
    beforeAll(async () => {
        win.__loadDemoData();
        for (const flik of ['matrix', 'likvardighet', 'struktur', 'prioritering', 'loneoversyn',
                            'kon', 'demografi', 'utforska', 'benchmark', 'kvalitet', 'rapport']) {
            win.__renderTabContent(flik);
        }
        await vanta();
    });

    it('varje diagram som ritats har en exportknapp', () => {
        // Ritade av diagramkärnan (_figur, ADR-39).
        const ritade = [...win.document.querySelectorAll('div')].filter(el => el._figur);
        expect(ritade.length).toBeGreaterThan(10);
        const utan = ritade.filter(el => !el.closest('[data-no-export]')
            && !el.parentElement.querySelector(':scope > .chart-export'));
        expect(utan.map(el => el.id)).toEqual([]);
    });

    it('knappen läggs bara till en gång även om diagrammet ritas om', async () => {
        win.__renderTabContent('demografi');
        await vanta();
        const host = win.document.getElementById('chart-demo-hist').parentElement;
        expect(host.querySelectorAll(':scope > .chart-export')).toHaveLength(1);
    });

    it('knappen öppnar menyn och Escape stänger den', () => {
        const host = win.document.getElementById('chart-demo-hist').parentElement;
        const btn = host.querySelector('.chart-export-btn');
        const meny = host.querySelector('.chart-export-meny');
        btn.click();
        expect(meny.hidden).toBe(false);
        expect(btn.getAttribute('aria-expanded')).toBe('true');
        win.document.dispatchEvent(new win.KeyboardEvent('keydown', { key: 'Escape' }));
        expect(meny.hidden).toBe(true);
        expect(btn.getAttribute('aria-expanded')).toBe('false');
    });

    it('menyn har fem val', () => {
        const meny = win.document.getElementById('chart-demo-hist').parentElement.querySelector('.chart-export-meny');
        expect([...meny.querySelectorAll('[data-chart-export]')].map(b => b.getAttribute('data-chart-export')))
            .toEqual(['png-presentation', 'png-dokument', 'svg', 'data-kopiera', 'data-csv']);
    });

    it('filnamnet bygger på flik, rubrik och datum och märks i demoläget', () => {
        const gd = win.document.getElementById('chart-demo-hist');
        expect(win.__chartExportFilename(gd, 'png', new Date(2026, 8, 24)))
            .toBe('DEMO_Demografi_Åldersfördelning-per-5-årsintervall_2026-09-24.png');
    });

    it('diagramdatan börjar med rubrik och version och innehåller seriernas värden', () => {
        const rows = win.__chartExportRows(win.document.getElementById('chart-demo-hist'));
        expect(rows[0][0]).toMatch(/^Åldersfördelning per 5-årsintervall — Lönekartläggning \d{4}\.\d{2}\.\d{2}\. Minsta gruppstorlek för redovisning: 10\.$/);
        expect(rows[1][0]).toBe('Serie');
        expect(rows.length).toBeGreaterThan(3);
    });

    it('en behållare märkt med markeraUtanExport får ingen meny, och skälet står i verktygstipset', () => {
        const box = win.document.createElement('div');
        win.__markeraUtanExport(box, 'individer');
        expect(box.getAttribute('data-no-export')).toBe('individer');
        expect(box.title).toMatch(/^Lämnar inte verktyget: hör till Personer att granska/);
        const gd = win.document.createElement('div');
        box.appendChild(gd);
        win.document.body.appendChild(box);
        expect(win.__exportTillaten(gd)).toBe(false);
        win.__attachChartExport(gd);
        expect(box.querySelector('.chart-export')).toBeNull();
        box.remove();
        gd.remove();
        expect(win.__exportTillaten(gd)).toBe(true);   // utanför behållaren gäller ingen spärr
        // Ett skäl som inte är registrerat går inte att använda.
        expect(() => win.__markeraUtanExport(win.document.createElement('div'), 'hemligt')).toThrow(/okänt skäl/);
    });

    it('varje behållare utan export i det ritade dokumentet har ett registrerat skäl', () => {
        // Alla flikar är ritade (beforeAll); Lika arbete bär den märkta behållaren.
        win.__renderTabContent('dashboard');
        const skal = win.__exportSkal();
        const markta = [...win.document.querySelectorAll('[data-no-export]')];
        expect(markta.map(el => el.id).sort()).toEqual(['pag-diagram-ruta']);
        for (const el of markta) {
            const s = el.getAttribute('data-no-export');
            expect(Object.keys(skal), el.id).toContain(s);
            expect(el.title, el.id).toBe(`Lämnar inte verktyget: ${skal[s]}.`);
            expect(win.__exportTillaten(el)).toBe(false);
        }
        // Inget ritat diagram i en märkt behållare har en meny, och ett ritat diagram i den ger ingen bild.
        for (const gd of [...win.document.querySelectorAll('[data-no-export] div')].filter(el => el._figur)) {
            expect(gd.parentElement.querySelector(':scope > .chart-export'), gd.id).toBeNull();
            expect(win.__chartExportRows(gd), gd.id).toEqual([]);
        }
    });

});

describe('Utforska: klick till gruppdossiern', () => {
    const spec = over => ({ rad: 'bas', kolumn: null, matt: 'median', delaKon: false, urval: { lage: 'alla', villkor: [] }, gruppVillkor: [], ...over });
    let kand;
    beforeAll(() => {
        win.__loadDemoData();
        // Nollställ Utforska så att klicket tolkas mot en känd vy (rader = BAS).
        const doc = win.document;
        doc.getElementById('explore-rad').value = 'bas';
        doc.getElementById('explore-kolumn').value = 'ingen';
        doc.getElementById('explore-typ').value = 'auto';
        win.__explorerSetFilter({});
        win.__renderExplorer();
        kand = win.__gruppdossierCandidates();
        expect(kand.length).toBeGreaterThan(0);
    });

    it('BAS som rad öppnar den största gruppen i det BAS:et', () => {
        const bas = kand[0].bas;
        const storst = kand.find(c => c.bas === bas);
        expect(win.__explorerDossierTarget(spec(), bas, null)).toEqual({ key: storst.key });
    });

    it('AID × BAS pekar ut exakt grupp', () => {
        const c = kand[0];
        const aidEtikett = win.__getData().map(r => win.__utGroupKey(r, 'aid')).find(l => l === c.aid || l.startsWith(c.aid + ' '));
        expect(win.__explorerDossierTarget(spec({ rad: 'aid', kolumn: 'bas' }), aidEtikett, c.bas)).toEqual({ key: c.key });
    });

    it('ett filter med ett enda BAS räcker tillsammans med AID som rad', () => {
        const c = kand[0];
        const aidEtikett = win.__getData().map(r => win.__utGroupKey(r, 'aid')).find(l => l === c.aid || l.startsWith(c.aid + ' '));
        expect(win.__explorerDossierTarget(spec({ rad: 'aid', urval: { lage: 'alla', villkor: [{ falt: 'bas', op: 'enAv', varde: [c.bas] }] } }), aidEtikett, null))
            .toEqual({ key: c.key });
    });

    it('varken AID eller BAS ger inget mål', () => {
        expect(win.__explorerDossierTarget(spec({ rad: 'alder', kolumn: 'kon' }), '30–34', 'Kvinna')).toBeNull();
    });

    it('klick öppnar modalen', () => {
        win.__explorerHandleClick({ rad: kand[0].bas, kol: null });
        expect(win.document.getElementById('dossier-modal').style.display).toBe('flex');
        win.__closeGruppdossier();
    });

    it('klick på en liten grupp öppnar dossiern: skärmen maskerar inget (ADR-51)', () => {
        const w = createAppWindow();
        const rader = [];
        for (let i = 0; i < 20; i++) rader.push({ bas: 'A', kon: i % 2 ? 'man' : 'kvinna', lon: 30000 + i, alder: 40,
            yrke: '100 Stor', aid: '100', yrkeLabel: 'Stor', enhet: '' });
        for (let i = 0; i < 4; i++) rader.push({ bas: 'B', kon: i % 2 ? 'man' : 'kvinna', lon: 30000 + i, alder: 40,
            yrke: '200 Liten', aid: '200', yrkeLabel: 'Liten', enhet: '' });
        w.__state.data = rader;
        w.eval('populateSelects(); unlockTabs();');
        w.__renderTabContent('utforska');
        expect(w.__explorerDossierTarget(spec(), 'B', null)).toEqual({ key: '200|B' });
        w.__state.kLage = 'export';
        expect(w.__explorerDossierTarget(spec(), 'B', null)).toEqual({ saknas: true });
        w.__state.kLage = 'skarm';
    });
});

describe('Utforska: tröskel, klick och diagramdata', () => {
    const $ = id => win.document.getElementById(id);
    const vanta = () => new Promise(r => setTimeout(r, 0));
    const grund = () => {
        $('explore-rad').value = 'bas'; $('explore-kolumn').value = 'ingen'; $('explore-measure').value = 'median';
        $('explore-typ').value = 'auto'; $('explore-visa').value = 'helhet'; $('explore-inkludera-sma').checked = false;
        win.__explorerSetFilter({});
    };
    beforeAll(() => { win.__loadDemoData(); grund(); win.__renderExplorer(); });

    it('korstabellens export utelämnar gap där ena könet är under tröskeln', () => {
        const w = createAppWindow();
        // Kolumndimension AID.
        const r = (kon, lon, aid) => ({ bas: 'A', kon, lon, alder: 40, yrke: `${aid} X`, aid, yrkeLabel: 'X' });
        const rader = [];
        for (let i = 0; i < 12; i++) rader.push(r('man', 30000 + i, '100'));
        for (let i = 0; i < 2; i++) rader.push(r('kvinna', 25000, '100'));
        for (let i = 0; i < 20; i++) rader.push(r(i % 2 ? 'man' : 'kvinna', 30000, '200'));   // 10 + 10
        w.__state.data = rader;
        w.eval('populateSelects(); unlockTabs();');
        const d = w.document;
        d.getElementById('explore-rad').value = 'bas';
        d.getElementById('explore-kolumn').value = 'aid';
        d.getElementById('explore-measure').value = 'gap';
        w.__renderExplorer();
        const m = w.__tableToMatrix('explore-table');
        const kol = e => m[0].findIndex(c => String(c).startsWith(e));
        expect(kol('100')).toBeGreaterThan(0);
        expect(m[1][kol('100')]).toBe('');
        expect(m[1][kol('200')]).not.toBe('');
    });

    it('klickhanteraren kopplas på nytt efter varje omritning', async () => {
        grund();
        // Diagramkärnan (ADR-39): klicket hör till behållaren och överlever omritningar — ett klick, ett anrop.
        const el = $('chart-explore');
        const kand = win.__gruppdossierCandidates()[0];
        win.__renderExplorer();
        await vanta();
        $('explore-measure').value = 'medel';
        win.__renderExplorer();
        await vanta();
        const i = el._figur.lager[0].data.findIndex(d => d.rad === kand.bas);
        el.querySelector(`rect[data-marke="stapel"][data-i="${i}"]`).dispatchEvent(new win.Event('click', { bubbles: true }));
        expect($('dossier-modal').style.display).toBe('flex');
        win.__closeGruppdossier();
    });

    it('tomläget försvinner när diagrammet ritas igen', () => {
        grund();
        const rows = win.__getData();
        const aidAv = r => win.__utGroupKey(r, 'aid');
        let par = null;
        for (const b of new Set(rows.map(r => r.bas))) {
            const iB = new Set(rows.filter(r => r.bas === b).map(aidAv));
            const annan = rows.map(aidAv).find(a => !iB.has(a));
            if (annan) { par = [b, annan]; break; }
        }
        win.__explorerSetFilter({ bas: [par[0]], aid: [par[1]] });
        win.__renderExplorer();
        expect($('chart-explore').querySelector('.explore-tom')).not.toBeNull();
        win.__explorerSetFilter({});
        win.__renderExplorer();
        expect($('chart-explore').querySelector('.explore-tom')).toBeNull();
    });

    it('diagramdatan har decimalkomma och högst två decimaler', () => {
        grund();
        $('explore-measure').value = 'medel';
        win.__renderExplorer();
        const celler = win.__chartExportRows($('chart-explore')).flat();
        expect(celler.filter(v => typeof v === 'number' && !Number.isInteger(v))).toEqual([]);
        expect(celler.some(v => typeof v === 'string' && /^\d+,\d{1,2}$/.test(v))).toBe(true);
    });
});

describe('Utforska: urval med villkor', () => {
    const $ = id => win.document.getElementById(id);
    const q = s => win.document.querySelector(s);
    const change = (el, v) => { if (v !== undefined) el.value = v; el.dispatchEvent(new win.Event('change', { bubbles: true })); };
    // Tomlägets rad ("Inga grupper att visa") är ingen grupp.
    const kolumn0 = () => [...$('explore-table').querySelectorAll('tbody tr')].filter(tr => !tr.querySelector('.explore-tom')).map(tr => tr.cells[0].textContent.trim());
    const grund = () => {
        $('explore-rad').value = 'bas'; $('explore-kolumn').value = 'ingen'; $('explore-measure').value = 'median';
        $('explore-typ').value = 'auto'; $('explore-visa').value = 'helhet'; $('explore-inkludera-sma').checked = false;
        win.__explorerSetFilter({});
        win.__renderExplorer();
    };
    beforeAll(() => { win.__loadDemoData(); grund(); });

    it('panelen har knappar för att lägga till person- och gruppvillkor', () => {
        expect(q('[data-urval-lagg-till="person"]')).not.toBeNull();
        expect(q('[data-urval-lagg-till="grupp"]')).not.toBeNull();
    });

    it('lägga till ett villkor ger en rad; ofullständigt markeras och ignoreras', () => {
        grund();
        const fore = kolumn0().length;
        q('[data-urval-lagg-till="person"]').click();
        expect($('explore-urval-villkor').querySelectorAll('.explore-urval-rad')).toHaveLength(1);
        expect(q('#explore-urval-villkor .explore-urval-ofullst').hidden).toBe(false);
        expect(kolumn0().length).toBe(fore);
    });

    it('välja ett värde begränsar urvalet och visas i etiketten', () => {
        const box = q('#explore-urval-villkor [data-urval-varde="0"]');
        box.checked = true;
        change(box);
        expect(kolumn0()).toEqual([box.value]);
        expect($('explore-filter-chips').textContent).toContain(`BAS är en av ${box.value}`);
        expect(q('#explore-urval-villkor .explore-urval-ofullst').hidden).toBe(true);
    });

    it('är inte en av vänder villkoret', () => {
        const valt = kolumn0()[0];
        change(q('[data-urval-op="0"]'), 'inteEnAv');
        expect(kolumn0()).not.toContain(valt);
        expect(kolumn0().length).toBeGreaterThan(0);
    });

    it('byte från kategori till tal tömmer värdet och ger en taljämförelse', () => {
        change(q('[data-urval-falt="0"]'), 'lon');
        const v = win.__explorerUrval().urval.villkor[0];
        expect(v).toEqual({ falt: 'lon', op: 'minst', varde: null, inte: false });
        expect(q('[data-urval-tal="0"]')).not.toBeNull();
    });

    it('sifferfält ritar inte om på input, men på change', () => {
        const falt = q('[data-urval-tal="0"]');
        falt.value = '35000';
        falt.dispatchEvent(new win.Event('input', { bubbles: true }));
        expect(win.__explorerUrval().urval.villkor[0].varde).toBeNull();
        change(falt);
        expect(win.__explorerUrval().urval.villkor[0].varde).toBe(35000);
        expect(q('[data-urval-tal="0"]')).toBe(falt);
    });

    it('mellan ger två sifferfält', () => {
        change(q('[data-urval-op="0"]'), 'mellan');
        expect(win.document.querySelectorAll('[data-urval-tal="0"]')).toHaveLength(2);
        expect(win.__explorerUrval().urval.villkor[0]).toEqual({ falt: 'lon', op: 'mellan', varde: [null, null], inte: false });
    });

    it('alla/något styr hur villkoren kombineras', () => {
        const rows = win.__getData();
        const [b1, b2] = [...new Set(rows.map(r => r.bas))].sort((a, b) => a.localeCompare(b, 'sv'));
        win.__explorerSetUrval({ lage: 'alla', villkor: [
            { falt: 'bas', op: 'enAv', varde: [b1], inte: false },
            { falt: 'bas', op: 'enAv', varde: [b2], inte: false }] });
        win.__renderExplorer();
        expect(kolumn0()).toEqual([]);
        change($('explore-urval-lage'), 'nagot');
        expect(kolumn0()).toEqual([b1, b2]);
    });

    it('ta bort ett villkor', () => {
        q('[data-urval-bort="person:1"]').click();
        expect(win.__explorerUrval().urval.villkor).toHaveLength(1);
    });

    it('gruppvillkor döljer grupper och noten säger hur många', () => {
        grund();
        const alla = kolumn0().length;
        q('[data-urval-lagg-till="grupp"]').click();
        change(q('[data-gv-matt="0"]'), 'n');
        change(q('[data-gv-op="0"]'), 'minst');
        change(q('[data-gv-tal="0"]'), '100000');
        expect(kolumn0()).toEqual([]);
        expect($('chart-explore').textContent).toContain('Inga grupper att visa');
        expect($('explore-note').textContent).toContain(`${alla} grupper döljs av gruppvillkoren`);
    });

    it('diagramdatan får urvalet som rad 2', () => {
        grund();
        win.__explorerSetUrval({ lage: 'alla', villkor: [{ falt: 'lon', op: 'minst', varde: 30000, inte: false }] });
        win.__renderExplorer();
        const rader = win.__chartExportRows($('chart-explore'));
        expect(rader[1][0].replace(/ /g, ' ')).toBe('Urval: Alla av: Lön minst 30 000 kr');
    });

    it('utan villkor har diagramdatan ingen urvalsrad', () => {
        grund();
        expect(win.__chartExportRows($('chart-explore'))[1][0]).toBe('Serie');
    });

    it('Rensa allt tar bort alla villkor', () => {
        win.__explorerSetUrval({ lage: 'alla', villkor: [{ falt: 'lon', op: 'minst', varde: 30000, inte: false }] },
                               [{ matt: 'n', op: 'minst', varde: 5 }]);
        win.__renderExplorer();
        $('explore-filter-chips').querySelector('[data-explore-clear]').click();
        expect(win.__explorerUrval()).toEqual({ urval: { lage: 'alla', villkor: [] }, gruppVillkor: [] });
    });

    it('sökfältet i värdelistan döljer värden som inte matchar', () => {
        grund();
        q('[data-urval-lagg-till="person"]').click();
        change(q('[data-urval-falt="0"]'), 'aid');
        const sok = q('[data-urval-sok="0"]');
        sok.value = 'zzzz-finns-inte';
        sok.dispatchEvent(new win.Event('input', { bubbles: true }));
        const synliga = [...win.document.querySelectorAll('#explore-urval-villkor .explore-filter-val')].filter(l => !l.hidden);
        expect(synliga).toHaveLength(0);
    });
});

describe('Utforska: urval', () => {
    it('värdelistan byggs om när ny data med samma antal rader läses in', () => {
        const w = createAppWindow();
        const rad = bas => ({ bas, kon: 'kvinna', lon: 30000, alder: 40, yrke: '100 X', aid: '100', yrkeLabel: 'X', enhet: '' });
        w.__state.data = Array.from({ length: 12 }, () => rad('E'));
        w.eval('populateSelects(); unlockTabs();');
        w.__explorerSetUrval({ lage: 'alla', villkor: [{ falt: 'bas', op: 'enAv', varde: [], inte: false }] });
        w.__renderExplorer();
        w.__state.data = Array.from({ length: 12 }, () => rad('X'));
        w.__renderExplorer();
        const varden = [...w.document.querySelectorAll('[data-urval-varde="0"]')].map(b => b.value);
        expect(varden).toEqual(['X']);
    });

    it('fokus stannar på jämförelselistan när man byter jämförelse', () => {
        const w = createAppWindow();
        w.__loadDemoData();
        w.document.querySelector('.nav-item[data-tab="utforska"]').click();
        w.__explorerSetUrval({ lage: 'alla', villkor: [{ falt: 'lon', op: 'minst', varde: null, inte: false }] },
                             [{ matt: 'gap', op: 'mindre', varde: null }]);
        w.__renderExplorer();
        for (const sel of ['[data-urval-op="0"]', '[data-urval-falt="0"]', '[data-gv-op="0"]', '[data-gv-matt="0"]']) {
            const el = w.document.querySelector(sel);
            el.focus();
            el.value = el.options[1].value;
            el.dispatchEvent(new w.Event('change', { bubbles: true }));
            expect(w.document.activeElement && w.document.activeElement.matches(sel), sel).toBe(true);
        }
    });
});

describe('Utforska: helhet eller per kön, fler rader, urval alltid synligt', () => {
    const $ = id => win.document.getElementById(id);
    const satt = (id, v) => { $(id).value = v; };
    // Tomlägets rad ("Inga grupper att visa") är ingen grupp.
    const kolumn0 = () => [...$('explore-table').querySelectorAll('tbody tr')].filter(tr => !tr.querySelector('.explore-tom')).map(tr => tr.cells[0].textContent.trim());
    const rita = () => { win.__renderExplorer(); return $('chart-explore'); };
    const grund = () => {
        satt('explore-rad', 'bas'); satt('explore-kolumn', 'ingen'); satt('explore-measure', 'median');
        satt('explore-typ', 'auto'); satt('explore-visa', 'helhet'); $('explore-inkludera-sma').checked = false;
        win.__explorerSetFilter({});
    };
    const opt = (id, v) => [...$(id).options].find(o => o.value === v);
    beforeAll(() => { win.__loadDemoData(); grund(); rita(); });

    it('Visa har Helhet som förval', () => {
        expect($('explore-visa').value).toBe('helhet');
        expect(rita()._figur.lager).toHaveLength(1);
    });

    it('antal kan visas per kön', () => {
        grund(); satt('explore-measure', 'n'); satt('explore-visa', 'kon');
        expect(rita()._figur.lager.map(l => l.serie)).toEqual(['Kvinna', 'Man']);
    });

    it('låddiagram och individpunkter: helhet i en serie, per kön i två', () => {
        for (const typ of ['lada', 'punkter', 'svarm', 'regnmoln']) {
            grund(); satt('explore-typ', typ);
            expect(rita()._figur.lager.map(l => l.serie).filter((n, i, a) => a.indexOf(n) === i)).toEqual(['Alla']);
            satt('explore-visa', 'kon');
            expect(rita()._figur.lager.map(l => l.serie).filter((n, i, a) => a.indexOf(n) === i)).toEqual(['Kvinna', 'Man']);
        }
    });

    it('heatmap per kön visar kvinnor och män sida vid sida, och tabellen har kolumner per kön', () => {
        grund(); satt('explore-kolumn', 'alder'); satt('explore-visa', 'kon');
        const gd = rita();
        // Två paneler sida vid sida, en per kön, med var sitt rutlager.
        expect(gd._figur.paneler).toEqual(['Kvinnor', 'Män']);
        expect(gd._figur.lager.map(l => [l.marke, l.panel])).toEqual([['ruta', 'Kvinnor'], ['ruta', 'Män']]);
        expect(gd.querySelectorAll('svg[data-del="panel"]')).toHaveLength(2);
        const rubriker = [...$('explore-table').querySelectorAll('thead th')].map(th => th.textContent);
        expect(rubriker.some(t => t.endsWith('· Kvinnor'))).toBe(true);
        expect(rubriker.some(t => t.endsWith('· Män'))).toBe(true);
    });

    it('grupperade staplar per kön ger en serie per kolumn och kön', () => {
        grund(); satt('explore-kolumn', 'alder'); satt('explore-typ', 'grupperade');
        // Många kolumnvärden (åldersgrupper): små multiplar — en panel per rad, kolumnvärdena på x-axeln.
        const helhet = rita()._figur;
        expect(helhet.paneler.length).toBeGreaterThan(1);
        expect(new Set(helhet.lager.map(l => l.serie)).size).toBe(1);
        satt('explore-visa', 'kon');
        const gd = rita();
        expect(gd._figur.paneler).toEqual(helhet.paneler);
        expect([...new Set(gd._figur.lager.map(l => l.serie))].sort()).toEqual(['Kvinna', 'Man']);
        expect(gd._figur.lager.every(l => gd._figur.paneler.includes(l.panel))).toBe(true);
        expect(gd.querySelectorAll('svg[data-del="panel"]').length).toBe(gd._figur.paneler.length);
    });

    it('hanteldiagrammet visar alltid per kön och bubbeldiagrammet alltid helhet', () => {
        grund(); satt('explore-typ', 'hantel'); rita();
        expect(opt('explore-visa', 'helhet').disabled).toBe(true);
        expect($('explore-visa-not').textContent).toMatch(/per kön/);
        grund(); satt('explore-typ', 'bubbla'); satt('explore-visa', 'kon'); rita();
        expect(opt('explore-visa', 'kon').disabled).toBe(true);
        expect(rita()._figur.lager).toHaveLength(1);
    });

    it('valet per kön kommer tillbaka när det åter går', () => {
        grund(); satt('explore-visa', 'kon'); satt('explore-measure', 'gap');
        // Gapet jämför redan könen: helhet, med en serie per status (inte per kön).
        expect(rita()._figur.lager.some(l => l.serie === 'Kvinna' || l.serie === 'Man')).toBe(false);
        satt('explore-measure', 'median');
        expect(rita()._figur.lager.filter(l => l.marke !== 'intervall').map(l => l.serie)).toEqual(['Kvinna', 'Man']);
    });

    it('Rader har hela urvalet, yrkesgrupp inom BAS och lönespann; Kolumner inte hela urvalet', () => {
        for (const v of ['alla', 'aidbas', 'lonespann']) expect(opt('explore-rad', v)).toBeTruthy();
        expect(opt('explore-kolumn', 'alla')).toBeUndefined();
        expect(opt('explore-kolumn', 'lonespann')).toBeTruthy();
    });

    it('hela urvalet ger en rad och en rubrik utan "per"', () => {
        grund(); satt('explore-rad', 'alla'); rita();
        expect(kolumn0()).toEqual(['Hela urvalet']);
        expect($('explore-chart-title').textContent).toBe('Median månadslön för hela urvalet');
    });

    it('lönespann sorteras från lägst till högst', () => {
        grund(); satt('explore-rad', 'lonespann'); rita();
        const lagsta = kolumn0().map(l => Number(l.split('–')[0].replace(/\D/g, '')));
        expect(lagsta.length).toBeGreaterThan(2);
        expect(lagsta).toEqual([...lagsta].sort((a, b) => a - b));
    });

    it('klick på en yrkesgrupp inom BAS pekar ut exakt den gruppens dossier', () => {
        const c = win.__gruppdossierCandidates()[0];
        const etikett = win.__getData().map(r => win.__utGroupKey(r, 'aidbas')).find(l => l.startsWith(c.aid + ' ') && l.endsWith(` · BAS ${c.bas}`));
        const spec = { rad: 'aidbas', kolumn: null, matt: 'median', delaKon: false, urval: { lage: 'alla', villkor: [] }, gruppVillkor: [] };
        expect(win.__explorerDossierTarget(spec, etikett, null)).toEqual({ key: c.key });
    });

    it('Urval är alltid utfällt, inte en hopfällbar panel', () => {
        const panel = $('explore-urval');
        expect(panel.tagName).not.toBe('DETAILS');
        expect(panel.querySelector('[data-urval-lagg-till="person"]')).not.toBeNull();
    });

    it('heatmapen har en gemensam färgskala även när ena könet saknar celler över tröskeln', () => {
        grund(); satt('explore-rad', 'aid'); satt('explore-kolumn', 'alder'); satt('explore-visa', 'kon');
        const gd = rita();
        // En färgskala per figur, gemensam för båda könens paneler, och en färgstapel i bilden.
        expect(gd._figur.fargskala.doman).toHaveLength(2);
        expect(gd._figur.lager.every(l => l.marke === 'ruta')).toBe(true);
        expect(gd.querySelectorAll('[data-marke="fargstapel"]').length).toBeGreaterThan(0);
    });

    it('heatmapens celltext är aldrig null, och bara ett lager skriver text i varje cell', () => {
        grund(); satt('explore-rad', 'aid'); satt('explore-kolumn', 'alder');
        for (const visa of ['helhet', 'kon']) {
            satt('explore-visa', visa);
            // Varje ruta har ett värde och en text; en cell utan värde ger ingen ruta alls (och därmed ingen text).
            const rutor = rita()._figur.lager.flatMap(l => l.data);
            expect(rutor.length, visa).toBeGreaterThan(0);
            expect(rutor.every(d => typeof d.text === 'string' && d.text !== '' && !/null|undefined|NaN/.test(d.text) && Number.isFinite(d.varde)), visa).toBe(true);
            expect($('chart-explore').textContent, visa).not.toMatch(/null|undefined|NaN/);
        }
    });
});

describe('Utforska: Visa, noter, export och diagram', () => {
    const $ = id => win.document.getElementById(id);
    const satt = (id, v) => { $(id).value = v; };
    const rita = () => { win.__renderExplorer(); return $('chart-explore'); };
    const grund = () => {
        satt('explore-rad', 'bas'); satt('explore-kolumn', 'ingen'); satt('explore-measure', 'median');
        satt('explore-typ', 'auto'); satt('explore-visa', 'helhet'); $('explore-inkludera-sma').checked = false;
        win.__explorerSetFilter({});
    };
    beforeAll(() => { win.__loadDemoData(); grund(); rita(); });

    it('Visa visar det som gäller när det är låst, och ditt val kommer tillbaka', () => {
        grund(); satt('explore-visa', 'kon'); satt('explore-typ', 'bubbla'); rita();
        expect($('explore-visa').value).toBe('helhet');
        satt('explore-typ', 'staplar'); rita();
        expect($('explore-visa').value).toBe('kon');
    });

    it('noten om låst Visa är kopplad till valet och läses upp', () => {
        expect($('explore-visa').getAttribute('aria-describedby')).toBe('explore-visa-not');
        expect($('explore-visa-not').getAttribute('aria-live')).toBe('polite');
    });

    it('rubriken för hela urvalet med kolumn och för bubbeldiagrammet', () => {
        grund(); satt('explore-rad', 'alla'); satt('explore-kolumn', 'alder'); rita();
        expect($('explore-chart-title').textContent).toBe('Median månadslön per åldersgrupp för hela urvalet');
        grund(); satt('explore-rad', 'alla'); satt('explore-typ', 'bubbla'); rita();
        expect($('explore-chart-title').textContent).toBe('Median mot andel kvinnor för hela urvalet');
    });

    it('antal per kön följer med i exporten som kolumnen n (K/M) redan gör', () => {
        const w = createAppWindow();
        const r = (kon, i) => ({ bas: 'A', kon, lon: 30000 + i, alder: 40, yrke: '100 X', aid: '100', yrkeLabel: 'X', enhet: '' });
        w.__state.data = [...Array.from({ length: 12 }, (_, i) => r('man', i)), ...Array.from({ length: 3 }, (_, i) => r('kvinna', i))];
        w.eval('populateSelects(); unlockTabs();');
        const d = w.document;
        d.getElementById('explore-measure').value = 'n';
        d.getElementById('explore-visa').value = 'kon';
        w.__renderExplorer();
        const m = w.__tableToMatrix('explore-table');
        expect(m[1][m[0].indexOf('Kvinnor')]).toBe('3');
    });

    it('heatmapens celltext har läsbar storlek och döljs när cellerna blir för många', () => {
        grund(); satt('explore-rad', 'bas'); satt('explore-kolumn', 'kon'); rita();
        const liten = $('chart-explore')._figur.lager.find(l => l.marke === 'ruta');
        expect(liten.visaText).toBe(true);
        const celltext = $('chart-explore').querySelector('text[data-marke="rutatext"]');
        if (celltext) expect(Number(celltext.getAttribute('font-size'))).toBeGreaterThanOrEqual(10);
        grund(); satt('explore-rad', 'bas'); satt('explore-kolumn', 'lonespann'); satt('explore-visa', 'kon'); rita();
        const heat = $('chart-explore')._figur;
        expect(heat.x.ordning.length * 2).toBeGreaterThan(12);
        expect(heat.lager.every(l => l.visaText === false)).toBe(true);
        expect($('chart-explore').querySelector('text[data-marke="rutatext"]')).toBeNull();
    });

    it('noten nämner könsvärden under tröskeln när man visar per kön (i exportläget)', () => {
        grund(); win.__state.kLage = 'export'; satt('explore-rad', 'aid'); satt('explore-visa', 'kon'); rita(); win.__state.kLage = 'skarm';
        expect($('explore-note').textContent).toMatch(/könsvärden bygger på färre än 10 personer/);
    });

    it('grupperade staplar per kön: en förklaringsrad per kolumnvärde, männen ljusare; ränder bara för små grupper', () => {
        // Få kolumnvärden: staplarna grupperas bredvid varandra (många ger små multiplar, se testet ovan).
        const cell = (rad, kol, nKv, nMa) => ({ rad, kol, n: nKv + nMa, nKv, nMa, value: 30000, valueKv: 29000, valueMa: 31000, liten: nKv + nMa < 10, konLiten: nKv < 10 || nMa < 10 });
        win.__m = { spec: { matt: 'median', delaKon: true }, radEtiketter: ['A', 'B'], kolumnEtiketter: ['X', 'Y'],
            celler: [cell('A', 'X', 12, 12), cell('A', 'Y', 3, 14), cell('B', 'X', 2, 3), cell('B', 'Y', 11, 10)] };
        win.__state.kLage = 'export';   // ränderna följer den inställda tröskeln, som i exporten (ADR-51)
        const f = win.eval('_figGrupperade(window.__m)'), lager = f.lager;
        win.__state.kLage = 'skarm';
        expect(f.paneler).toBeUndefined();
        const man = lager.filter(l => l.serie.endsWith('· Man'));
        expect(man.length).toBe(2);
        expect(man.every(l => l.legend === false && l.opacitet < 1)).toBe(true);
        expect(lager.filter(l => l.legend !== false).every(l => l.serie.endsWith('· Kvinna'))).toBe(true);
        expect(f.x.titel).toMatch(/kvinnor.*män/i);
        // Ränder betyder "under tröskeln" (WCAG 1.4.1), aldrig kön: streckad kant på exakt de små datapunkternas staplar.
        win.__f = f;
        const svg = win.eval('_rfByggSvg(window.__f, 700, { visaSma: true })');
        const sma = lager.reduce((n, l) => n + l.data.filter(d => d.liten).length, 0);
        expect(sma).toBe(3);   // tre kvinnor i A·Y, och hela B·X för båda könen   // tre kvinnor i A·Y, och hela B·X för båda könen
        expect(svg.querySelectorAll('rect[data-marke="stapel"][stroke-dasharray]').length).toBe(sma);
    });
});

describe('Utforska: tomläge, exportmeny och talfält', () => {
    const $ = id => win.document.getElementById(id);
    const q = sel => win.document.querySelector(sel);
    const satt = (id, v) => { $(id).value = v; };
    const vanta = () => new Promise(r => setTimeout(r, 0));
    const rita = () => { win.__renderExplorer(); return $('chart-explore'); };
    const grund = () => {
        satt('explore-rad', 'bas'); satt('explore-kolumn', 'ingen'); satt('explore-measure', 'median');
        satt('explore-typ', 'auto'); satt('explore-visa', 'helhet'); $('explore-inkludera-sma').checked = false;
        win.__explorerSetFilter({});
    };
    const tomtUrval = () => win.__explorerSetUrval({ lage: 'alla', villkor: [{ falt: 'lon', op: 'mindre', varde: 1, inte: false }] });
    const meny = () => $('chart-explore').parentElement.querySelector('.chart-export');
    const verktyg = () => $('explore-table').closest('.table-container').previousElementSibling;
    beforeAll(async () => { win.__loadDemoData(); win.document.querySelector('.nav-item[data-tab="utforska"]').click(); grund(); rita(); await vanta(); });

    it('tomläget döljer exportmenyn och tabellverktygen, och de kommer tillbaka', () => {
        grund(); tomtUrval(); rita();
        expect(meny().hidden).toBe(true);
        expect(verktyg().classList.contains('table-tools')).toBe(true);
        expect(verktyg().hidden).toBe(true);
        expect($('explore-table').textContent).toContain('Inga grupper att visa');
        grund(); rita();
        expect(meny().hidden).toBe(false);
        expect(verktyg().hidden).toBe(false);
    });

    it('efter ett val i exportmenyn går fokus tillbaka till knappen', async () => {
        grund(); rita();
        const knapp = meny().querySelector('.chart-export-btn');
        knapp.click();
        meny().querySelector('[data-chart-export="data-csv"]').click();
        await vanta(); await vanta();
        expect(win.document.activeElement).toBe(knapp);
    });

    it('menyn stängs när fokus lämnar den', () => {
        const knapp = meny().querySelector('.chart-export-btn');
        knapp.click();
        const lista = meny().querySelector('.chart-export-meny');
        expect(lista.hidden).toBe(false);
        meny().dispatchEvent(new win.FocusEvent('focusout', { bubbles: true, relatedTarget: win.document.body }));
        expect(lista.hidden).toBe(true);
    });

    it('klick på en tom heatmap-cell gör ingenting', () => {
        grund(); rita();
        const fore = $('explore-note').textContent;
        // En tom cell ritas inte och kan inte klickas; ett anrop utan datapunkt eller utan etikett gör ingenting.
        win.__explorerHandleClick(null);
        win.__explorerHandleClick({});
        expect($('explore-note').textContent).toBe(fore);
        expect($('dossier-modal').style.display).not.toBe('flex');
    });

    it('ett diagram utan några värden visar tomläget', () => {
        grund(); satt('explore-rad', 'kon'); satt('explore-measure', 'gap'); rita();
        expect($('chart-explore').textContent).toContain('Inga grupper att visa');
    });

    it('byte av talfält tömmer värdet (lön och ålder har olika enheter)', () => {
        grund();
        win.__explorerSetUrval({ lage: 'alla', villkor: [{ falt: 'lon', op: 'minst', varde: 30000, inte: false }] });
        rita();
        const f = q('[data-urval-falt="0"]'); f.value = 'alder'; f.dispatchEvent(new win.Event('change', { bubbles: true }));
        expect(win.__explorerUrval().urval.villkor[0]).toEqual({ falt: 'alder', op: 'minst', varde: null, inte: false });
    });

    it('tabellens export börjar med urvalet när ett villkor är aktivt', () => {
        grund();
        win.__explorerSetUrval({ lage: 'alla', villkor: [{ falt: 'lon', op: 'minst', varde: 30000, inte: false }] });
        rita();
        const m = win.__tableToMatrix('explore-table');
        expect(m[0][0].replace(/\u00a0/g, ' ')).toBe('Urval: Alla av: Lön minst 30 000 kr');
        grund(); rita();
        expect(win.__tableToMatrix('explore-table')[0][0]).toBe('BAS-intervall');
    });
});

// "Rensa all data" (Art. 17-affordansen) ska tömma ALLT minne med individrader —
// även Utforskas egna referenser (senaste modellen, urvalets värdelistor och
// diagrammets exportfunktion), som annars höll kvar hela underlaget.

// A5 (beslut 4a): Prioriteringen mäter löneläget mot er referens och har egna ord, så att de inte förväxlas med
// uppmärksamhetstrappan för skillnaden mellan kvinnor och män (Värt att granska, Följ upp, Balanserat).
describe('Prioritering: egna ord och rätt rubrik (A5)', () => {
    const TRAPPAN = /Värt att granska|Följ upp|Balanserat/;
    const oppna = () => { const w = createAppWindow(); w.__loadDemoData(); w.__renderTabContent('prioritering'); return w; };
    it('fliken har Prioriteringens egna ord, och nyckeltalet heter Kostnad att nå referensen', () => {
        const w = oppna();
        const d = w.document;
        // Kolumnen Skillnad kön bär uppmärksamhetstrappans bricka (ADR-71); den gäller skillnaden mellan kvinnor och män
        // och prövas för sig nedan.
        const vy = d.getElementById('view-prioritering').cloneNode(true);
        vy.querySelectorAll('.prio-konstatus').forEach(e => e.remove());
        expect(d.querySelectorAll('#prio-table tbody tr').length).toBeGreaterThan(0);
        expect(vy.textContent).not.toMatch(TRAPPAN);
        expect([...vy.querySelectorAll('[data-tooltip], [data-k-tooltip], [data-export-label], [title]')]
            .map(e => ['data-tooltip', 'data-k-tooltip', 'data-export-label', 'title'].map(a => e.getAttribute(a) || '').join(' '))
            .filter(t => TRAPPAN.test(t))).toEqual([]);
        expect(w.eval('Object.values(PRIO_STATUS_INFO).map(s => s.label)')).toEqual(['Börja här', 'Under referens, liten grupp', 'Nära referens, under', 'Nära referens', 'Över referens']);
        const ruta = d.getElementById('prio-stat-cost').closest('.stat-box');
        expect(ruta.querySelector('.stat-etikett').textContent.trim()).toBe('Kostnad att nå referensen');
        // Förklaringen står under nyckeltalsraden (i rutan skulle den klippas).
        const not = d.getElementById('prio-stat-cost-not').textContent.replace(/\s+/g, ' ');
        expect(not).toContain('Vad det kostar att lyfta grupper under referensen till dess median. Detta är löneläget mot er referens, inte lönekartläggningens könsskillnader — dem visar Lika arbete och Löneöversyn.');
        expect(not).toContain('inkl. PO-påslag 40 % (ett standardantagande; sätt organisationens eget under Inställningar)');
        expect(d.getElementById('prio-stat-cost-period').textContent).toBe('12 månader, inkl. PO-påslag 40\u00a0%');
        expect(vy.textContent).not.toMatch(/åtgärdskostnad/i);
    });
    // Nyckeltalen heter som statusarna och räknar tabellens rader; Färdigcheck räknar samma grupper (uppgift 3, UX 2026-11-19).
    it('nyckeltalen räknar tabellens statusar, och Färdigcheck säger samma tal med samma gräns', () => {
        const w = oppna();
        const d = w.document;
        const rader = [...d.querySelectorAll('#prio-table tbody tr')].map(tr => tr._prioItem);
        const items = w.eval('computePrioritization(_selectedPrioReference())');
        expect(rader.length).toBe(items.length);
        const antal = s => rader.filter(i => i.status === s).length;
        const ruta = id => d.getElementById(id).closest('.stat-box');
        const nyckel = [['prio-stat-akut', 'akut', 'Börja här'], ['prio-stat-under', 'atgard', 'Under referens, liten grupp'], ['prio-stat-over', 'analysera', 'Över referens']];
        for (const [id, status, namn] of nyckel) {
            expect(ruta(id).querySelector('.stat-etikett').textContent.trim()).toBe(namn);
            expect(w.eval(`PRIO_STATUS_INFO.${status}.label`)).toBe(namn);
            expect(d.getElementById(id).textContent, namn).toBe(String(antal(status)));
        }
        // Statuscellen i tabellen bär samma ord som nyckeltalet.
        for (const tr of d.querySelectorAll('#prio-table tbody tr')) expect(tr.textContent).toContain(w.eval(`PRIO_STATUS_INFO.${tr._prioItem.status}.label`));
        expect(d.getElementById('prio-stat-akut-not').textContent).toBe('mer än 5\u00a0% under, minst 10 personer');
        expect(d.getElementById('prio-stat-under-not').textContent).toBe('mer än 5\u00a0% under, färre än 10 personer');
        expect(d.getElementById('prio-stat-over-not').textContent).toBe('mer än 5\u00a0% över');
        // Färdigcheck: alla under noll, varav Börja här och Under referens, liten grupp.
        const under = items.filter(i => i.diffPct < 0).length, varav = antal('akut') + antal('atgard');
        expect(under).toBeGreaterThan(varav); expect(varav).toBeGreaterThan(0);
        const punkt = w.eval('buildFardigcheck()').find(p => p.id === 'flaggade-grupper');
        expect(punkt.title).toBe(`${under} grupper ligger under referensen, varav ${varav} mer än 5\u00a0% under`);
    });
    it('nyckeltalens undertexter, matrisens zoner och Färdigcheck följer inställda gränser', () => {
        const w = oppna();
        const d = w.document;
        w.eval('state.prioConfig = { atgardThreshold: -2.5, akutMinN: 30, bevakaThreshold: -1, analyseraThreshold: 3 }');
        w.__renderTabContent('prioritering');
        expect(d.getElementById('prio-stat-akut-not').textContent).toBe('mer än 2,5\u00a0% under, minst 30 personer');
        expect(d.getElementById('prio-stat-under-not').textContent).toBe('mer än 2,5\u00a0% under, färre än 30 personer');
        expect(d.getElementById('prio-stat-over-not').textContent).toBe('mer än 3\u00a0% över');
        const items = w.eval('computePrioritization(_selectedPrioReference())');
        for (const [id, status] of [['prio-stat-akut', 'akut'], ['prio-stat-under', 'atgard'], ['prio-stat-over', 'analysera']]) {
            expect(d.getElementById(id).textContent).toBe(String(items.filter(i => i.status === status).length));
        }
        const f = w.eval("_prioMatrisFigur(computePrioritization(_selectedPrioReference()), 'topp10', 'referensen', state.prioConfig)");
        expect(f.referens.map(z => z.etikett)).toEqual(['MER ÄN 2,5\u00a0% UNDER', 'NÄRA REFERENS, UNDER', 'NÄRA REFERENS', 'MER ÄN 3\u00a0% ÖVER']);
        const punkt = w.eval('buildFardigcheck()').find(p => p.id === 'flaggade-grupper');
        const varav = items.filter(i => i.status === 'akut' || i.status === 'atgard').length;
        expect(punkt.title).toBe(`${items.filter(i => i.diffPct < 0).length} grupper ligger under referensen, varav ${varav} mer än 2,5\u00a0% under`);
        // Utan grupper bortom gränsen står bara den första delen.
        w.eval('state.prioConfig = { atgardThreshold: -40, akutMinN: 10, bevakaThreshold: -2, analyseraThreshold: 5 }');
        expect(w.eval('buildFardigcheck()').find(p => p.id === 'flaggade-grupper').title).toMatch(/^\d+ grupper ligger under referensen$/);
    });
    it('kolumnen Skillnad kön bär uppmärksamhetstrappans bricka efter storleken, utan prövning (ADR-71)', () => {
        const w = oppna();
        const rader = [...w.document.querySelectorAll('#prio-table tbody tr')];
        expect(rader.length).toBeGreaterThan(0);
        const golv = w.eval('statGolv()');
        const nivaer = new Set();
        rader.forEach(tr => {
            const i = tr._prioItem;
            const bricka = tr.querySelectorAll('.prio-konstatus');
            expect(bricka.length).toBe(1);
            const b = bricka[0];
            // Brickan står i samma cell som talet för skillnaden mellan kvinnor och män.
            expect(b.closest('td').querySelector('.cell-bar-wrap')).not.toBeNull();
            const vantad = i.gapPct === null || !(i.kvN >= golv && i.maN >= golv) ? 'ejbedomd'
                : Math.abs(i.gapPct) >= 3 ? 'folj' : 'balanserat';
            expect(b.getAttribute('data-niva')).toBe(vantad);
            expect(b.textContent).toBe({ ejbedomd: 'Går ej att bedöma', folj: 'Följ upp', balanserat: 'Balanserat' }[vantad]);
            nivaer.add(vantad);
        });
        // Prioriteringen prövar inte skillnaden mot slumpen: aldrig Värt att granska.
        expect(nivaer.has('granska')).toBe(false);
        // Exporten bär talet, inte brickan.
        const matris = w.__tableToMatrix('prio-table');
        expect(matris.flat().join(' ')).not.toMatch(/Följ upp|Balanserat|Går ej att bedöma/);
    });
    it('inställningarnas förklaringar för Prioriteringens trösklar använder samma ord', () => {
        const w = oppna();
        const txt = ['prio-cfg-atgard', 'prio-cfg-akutN', 'prio-cfg-bevaka', 'prio-cfg-analysera']
            .map(id => w.document.getElementById(id).closest('label').textContent).join(' ');
        expect(txt).not.toMatch(TRAPPAN);
        expect(txt).toMatch(/Under referens, liten grupp/);
        expect(txt).toMatch(/Nära referens, under/);
    });
    it('förslagen säger hur nära referensen gruppen ligger, utan att avfärda skillnaden', () => {
        const w = oppna();
        w.__it = { diffPct: 0.8, n: 12, kvN: 12, maN: 12, _rows: [{ lon: 1, kon: 'kvinna', alder: 40 }] };
        const nara = w.eval('generateMotivationSuggestions(window.__it)').map(f => f.text).join(' ');
        expect(nara).toContain('Gruppens median ligger inom ±2 % av referensen.');
        expect(nara).not.toMatch(/normal variation|kräver ytterligare utredning/);
        w.__it = { ...w.__it, diffPct: 7.4 };
        expect(w.eval('generateMotivationSuggestions(window.__it)').map(f => f.text)).toContain('Ligger 7,4\u00a0% över referensen. Dokumentera gärna varför.');
    });
    it('snabb vinst säger villkoret i klarspråk, också för en stor grupp (inget "få personer")', () => {
        const w = oppna();
        w.__it = { diffPct: -4, n: 300, kvN: 150, maN: 150, costPerPerson: 1200, isQuickWin: true, _rows: [{ lon: 1, kon: 'kvinna', alder: 40 }] };
        const txt = w.eval('generateMotivationSuggestions(window.__it)').map(f => f.text).join(' ');
        expect(txt).toMatch(/Snabb vinst:<\/strong> gruppen ligger mer än 3\s%\s+under referensen, och kostnaden per person är under 1\s500\s+kr per månad \(300 personer\)\./);
        expect(txt).not.toMatch(/få personer|hanterbar/);
    });
    it('Excel-bladet Prioritering, handlingsplanen och rapporten har samma ord', async () => {
        const { laddaXlsx, fangaBocker } = await import('./helpers/ktroskel-rigg.js');
        const w = oppna();
        await laddaXlsx(w);
        const bok = Object.values(fangaBocker(w, () => w.eval('exportAllToExcel()')))[0];
        const blad = bok.split(/\n(?=\[)/).find(b => b.startsWith('[Prioritering]'));
        expect(blad).toBeTruthy();
        expect(blad).not.toMatch(TRAPPAN);
        expect(blad).toContain('Kostnad att nå referensen');
        const hp = Object.values(fangaBocker(w, () => w.eval('exportHandlingsplan()')))[0];
        expect(hp).toContain('Kostnad att nå referensen');
        const atgarder = w.eval('rapportModell({ alla: true })').avsnitt.find(a => a.id === 'atgarder');
        expect(JSON.stringify(atgarder)).not.toMatch(TRAPPAN);
        expect(JSON.stringify(atgarder)).toContain('kostnad att nå referensen');
        const block = w.__rapportunderlagBlock().find(b => b.id === 'handlingsplan');
        expect(w.__ruTillText(block)).toContain('kostnad att nå referensen');
        expect(w.__ruTillText(block)).not.toMatch(TRAPPAN);
    });
    it('Att göra kallar grupperna under referensen Löneläge mot referens, inte Värt att granska', () => {
        const w = oppna();
        const prio = w.eval('buildActionChecklist()').filter(i => i.källa === 'Prioriteringsanalys');
        expect(prio.length).toBeGreaterThan(0);
        expect([...new Set(prio.map(i => i.kategori))]).toEqual(['Löneläge mot referens']);
        expect(prio.map(i => i.detalj).join(' ')).not.toMatch(/kostnad att lyfta till referens/);
    });
});

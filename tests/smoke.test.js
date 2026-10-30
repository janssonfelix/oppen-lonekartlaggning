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
});

describe('#1 röktest: boot', () => {
    it('app.js bootar utan kast och exponerar nyckel-API', () => {
        expect(win.__bootErr).toBeUndefined();
        expect(typeof win.__renderTabContent).toBe('function');
        expect(typeof win.__state).toBe('object');
        expect(typeof win.__loadDemoData).toBe('function');
        expect(typeof win.__methodAppendixData).toBe('function');
    });

    it('storage-tripwire är aktiv (kastar vid icke-tillåten skrivning)', () => {
        expect(() => win.eval("localStorage.setItem('x','y')")).toThrow();
    });

    it('process-tracker renderas redan vid boot (utan data) med steg 1 ej klart', () => {
        // Boot-koden i 61-regler-och-praxis.js kör renderProcessTracker() — kortet ska
        // finnas ÄVEN innan data laddats (demo laddas i ett senare describe-block).
        const host = win.document.getElementById('process-tracker');
        expect(host).toBeTruthy();
        expect(host.innerHTML).toContain('Lönekartläggningsprocessen');
        const rows = host.querySelectorAll('.ptrack-row');
        expect(rows.length).toBe(8);                       // åtta lagsteg
        expect(rows[0].querySelector('.ptrack-status').dataset.status).toBe('ej'); // steg 1 ej klart utan data
        expect(host.innerHTML).toContain('data-goto-tab');  // klickbara länkar (CSP-säkra)
        expect(host.innerHTML).not.toContain('onclick');    // inga inline-handlers (hash-CSP)
    });
});

describe('#1 röktest: demodata + full pipeline', () => {
    it('loadDemoData kör hela pipelinen utan kast', () => {
        expect(() => win.__loadDemoData()).not.toThrow();
        expect(win.__state.data.length).toBe(260);   // självdiagnostikens 200 + tre yrken i BAS C (kandidatpar)
        expect(win.__state.isDemo).toBe(true);
    });

    it('#9 demo-banner blir synlig', () => {
        expect(win.document.getElementById('demo-mode-banner').style.display).toBe('flex');
    });
});

describe('process-tracker: statusar härleds ur inläst data', () => {
    it('steg 1 blir klart (✅) och likvärdighetsraden visar kandidatpar-antal efter demodata', () => {
        win.__renderProcessTracker();
        const host = win.document.getElementById('process-tracker');
        const rows = host.querySelectorAll('.ptrack-row');
        expect(rows.length).toBe(8);
        expect(rows[0].querySelector('.ptrack-status').dataset.status).toBe('klar');   // underlag inläst
        expect(rows[0].textContent).toContain('260');                              // 260 demo-rader
        // Steg 4 (likvärdigt arbete) visar antal kandidatpar. Rubriken är på
        // klarspråk sedan copy-översynen — lagrum ligger i tooltip/detaljtext.
        expect(rows[3].textContent).toMatch(/Likvärdigt arbete/);
        expect(rows[3].textContent).toMatch(/kandidatpar/);
    });

    it('regler & praxis-raden speglar antal ifyllda bedömningar (0/6 → 1/6)', () => {
        // nollställ, rendera → 0/6
        for (let i = 1; i <= 6; i++) { const s = win.document.getElementById('bes8-status-' + i); if (s) s.value = ''; }
        win.__renderProcessTracker();
        let bes8Row = [...win.document.querySelectorAll('#process-tracker .ptrack-row')].find(r => /Regler & praxis/.test(r.textContent));
        expect(bes8Row.textContent).toContain('0/6');

        // fyll ett område → 1/6
        win.document.getElementById('bes8-status-1').value = 'Åtgärd krävs';
        win.__renderProcessTracker();
        bes8Row = [...win.document.querySelectorAll('#process-tracker .ptrack-row')].find(r => /Regler & praxis/.test(r.textContent));
        expect(bes8Row.textContent).toContain('1/6');
        expect(bes8Row.querySelector('.ptrack-status').dataset.status).toBe('delvis');   // delvis
        win.document.getElementById('bes8-status-1').value = '';                    // städa
    });

    it('steg 6 (samverkan) och 7 (dokumentation) är manuella (➖)', () => {
        win.__renderProcessTracker();
        const rows = [...win.document.querySelectorAll('#process-tracker .ptrack-row')];
        const samverkan = rows.find(r => /Samverkan/.test(r.textContent));
        const dok = rows.find(r => /Dokumentation/.test(r.textContent));
        expect(samverkan.querySelector('.ptrack-status').dataset.status).toBe('manuell');
        expect(dok.querySelector('.ptrack-status').dataset.status).toBe('manuell');
    });
});

describe('#1 röktest: varje flik renderar utan kast', () => {
    const tabs = ['rapport', 'kon', 'demografi', 'benchmark', 'matrix',
        'prioritering', 'struktur', 'loneoversyn', 'likvardighet', 'utforska', 'benchmark', 'kvalitet', 'info'];
    it.each(tabs)('renderTabContent("%s")', (t) => {
        expect(() => win.__renderTabContent(t)).not.toThrow();
    });

    // CSP:n har style-src-attr 'none' (ADR-30): ett element får bara bära de stilar som skript sätter via CSSOM —
    // synlighet, läge och uträknade mått — aldrig en layoutstil ur en mall. (Den statiska vakten, tests/sakerhet.test.js,
    // håller mallarna rena; här kontrolleras det som faktiskt ritats på demodata i alla flikar.)
    it('inget element i dokumentet bär en stil som en mall skrivit (bara display, bredd, läge, synlighet, färg som skript sätter)', () => {
        const TILLATNA = new Set(['display', 'width', 'left', 'top', 'bottom', 'margin-left', 'margin-top', 'visibility', 'opacity', 'position', 'color', 'transition']);
        const d = win.document;
        const fynd = [];
        for (const t of tabs) {
            win.__renderTabContent(t);
            for (const el of d.querySelectorAll('[style]')) {
                if (el.closest('svg')) continue;
                for (let i = 0; i < el.style.length; i++) {
                    const egenskap = el.style[i];
                    if (!TILLATNA.has(egenskap)) fynd.push(`${t}: <${el.tagName.toLowerCase()} class="${el.className}"> ${egenskap}`);
                }
            }
        }
        expect([...new Set(fynd)]).toEqual([]);
    });
    it('staplar med data-stil-* har fått sitt mått via CSSOM efter ritning', () => {
        const d = win.document;
        const saknas = [];
        for (const t of tabs) {
            win.__renderTabContent(t);
            for (const el of d.querySelectorAll('[data-stil-bredd]')) if (parseFloat(el.style.width) !== parseFloat(el.getAttribute('data-stil-bredd'))) saknas.push(`${t}: ${el.className}`);
            for (const el of d.querySelectorAll('[data-stil-vanster]')) if (parseFloat(el.style.left) !== parseFloat(el.getAttribute('data-stil-vanster'))) saknas.push(`${t}: ${el.className}`);
            for (const el of d.querySelectorAll('[data-stil-mvanster]')) if (parseFloat(el.style.marginLeft) !== parseFloat(el.getAttribute('data-stil-mvanster'))) saknas.push(`${t}: ${el.className}`);
        }
        expect(saknas).toEqual([]);
    });
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
        const idxs = ['Regler och praxis kring lön', 'Lika arbete — kvinnor och män i samma yrke', 'Likvärdigt arbete — kvinnodominerade yrken',
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

describe('konfig-snapshot v2: HR:s manuella arbete round-trips', () => {
    // Testdata på gruppnivå — ALDRIG personnamn/personnummer (repot är publikt).
    const NOTE = 'Fast testanteckning på gruppnivå.';
    const STATUS = 'Åtgärd krävs';

    // Nollställ de fält testerna rör, så ordningsberoende undviks.
    const resetFields = () => {
        for (let i = 1; i <= 6; i++) {
            const s = win.document.getElementById('bes8-status-' + i);
            const t = win.document.getElementById('bes8-note-' + i);
            if (s) s.value = '';
            if (t) t.value = '';
        }
        win.__state._actionChecklistDone = new Set();
        const org = win.document.getElementById('kl-org-name');
        if (org) org.value = '';
    };

    it('snapshoten är version 2 och bär bes8/actionChecklistDone/orgName', () => {
        resetFields();
        const snap = win.__buildConfigSnapshot();
        expect(snap.version).toBe(2);
        expect(Array.isArray(snap.bes8)).toBe(true);
        expect(snap.bes8.length).toBe(6);
        expect(snap.bes8[0]).toHaveProperty('n');
        expect(snap.bes8[0]).toHaveProperty('status');
        expect(snap.bes8[0]).toHaveProperty('note');
        expect(snap.bes8[0]).not.toHaveProperty('title');   // UI-text sparas ej
        expect(Array.isArray(snap.actionChecklistDone)).toBe(true);
        expect(typeof snap.orgName).toBe('string');
    });

    it('round-trip återställer § 8-bedömning, avbockningar och org-namn', () => {
        resetFields();
        win.document.getElementById('bes8-status-2').value = STATUS;
        win.document.getElementById('bes8-note-2').value = NOTE;
        win.__state._actionChecklistDone = new Set(['prio-row-x', 'jpa-signed']);
        const orgFalt = win.document.getElementById('kl-org-name');
        orgFalt.value = 'Exempelorganisationen';
        orgFalt.dispatchEvent(new win.Event('change'));   // fältet är kopplat till profilen (ADR-36)

        const snap = win.__buildConfigSnapshot();
        expect(snap.actionChecklistDone).toContain('prio-row-x');

        resetFields();   // simulera "rensa all data" + omladdning
        expect(win.document.getElementById('bes8-note-2').value).toBe('');

        win.__applyConfigSnapshot(snap);
        expect(win.document.getElementById('bes8-status-2').value).toBe(STATUS);
        expect(win.document.getElementById('bes8-note-2').value).toBe(NOTE);
        expect(win.__state._actionChecklistDone.has('prio-row-x')).toBe(true);
        expect(win.__state._actionChecklistDone.has('jpa-signed')).toBe(true);
        expect(win.document.getElementById('kl-org-name').value).toBe('Exempelorganisationen');
        resetFields();
    });

    it('en konfigurationsfil med annat formatnummer än 2 avvisas', () => {
        const snap = win.__buildConfigSnapshot();
        expect(() => win.__applyConfigSnapshot({ ...snap, version: 1 })).toThrow(/version 2/);
        expect(() => win.__applyConfigSnapshot({ ...snap, version: 3 })).toThrow(/version 2/);
    });
    it('ui.prioRef i en konfigurationsfil väljer motsvarande referens; värden utanför vitlistan lämnar valet orört', () => {
        const snap = win.__buildConfigSnapshot();
        const vald = () => win.document.querySelector('input[name="prio-ref"]:checked')?.value;
        win.__applyConfigSnapshot({ ...snap, ui: { ...snap.ui, prioRef: 'statistik' } });
        expect(vald()).toBe('statistik');
        win.__applyConfigSnapshot({ ...snap, ui: { ...snap.ui, prioRef: 'stallningstagande' } });
        expect(vald()).toBe('stallningstagande');
        expect(() => win.__applyConfigSnapshot({ ...snap, ui: { ...snap.ui, prioRef: 'x"]' } })).not.toThrow();
        expect(vald()).toBe('stallningstagande');
        resetFields();
    });
    it('okända fält i en konfigurationsfil ignoreras utan att kasta och hamnar inte i tillståndet', () => {
        const snap = win.__buildConfigSnapshot();
        win.__applyConfigSnapshot({ ...snap, okantFalt: [1, 2, 3] });
        expect('okantFalt' in win.__state).toBe(false);
        resetFields();
    });

    it('ogiltigt bes8-fält (n utanför 1–6) kastar och muterar inte state', () => {
        const snap = win.__buildConfigSnapshot();
        snap.bes8 = [{ n: 9, status: '', note: '' }];
        expect(() => win.__applyConfigSnapshot(snap)).toThrow(/bes8/);
        resetFields();
    });

    it('odirtyat struktur-narrativ sparas som null (auto-genereras vid inläsning)', () => {
        const nb = win.document.getElementById('struktur-narrative');
        if (nb) { nb.value = 'auto text'; delete nb.dataset.dirty; }
        const snap = win.__buildConfigSnapshot();
        expect(snap.strukturNarrative).toBeNull();
    });
});

describe('visualisering: § 3:10 — kandidatparen som bild + tabellexport', () => {
    it('kandidatparen ritas som ett par per rad med båda medianerna', () => {
        win.__loadDemoData();
        const pairs = (win.__computeLikvardighetPairs() || {}).pairs || [];
        if (!pairs.length) return;
        win.__pairs = pairs;
        const f = win.eval('_lvParFigur(window.__pairs)');
        expect(f.lager.map(l => l.marke)).toEqual(['intervall', 'punkt', 'punkt']);
        expect(f.y.ordning.length).toBeGreaterThan(0);
        expect(f.y.ordning.length).toBeLessThanOrEqual(Math.min(14, pairs.length));
        for (const d of f.lager[0].data) { expect(Number.isFinite(d.lag) && Number.isFinite(d.hog) && d.hog >= d.lag).toBe(true); }
        expect(f.lager[2].data.every(d => /%$/.test(d.etikett))).toBe(true);      // gapet står vid jämförelseyrket
    });

    it('likvärdighetsfliken ritar kandidatparen i sin behållare', () => {
        win.__loadDemoData();
        win.__renderTabContent('likvardighet');
        const pairs = (win.__computeLikvardighetPairs() || {}).pairs || [];
        const el = win.document.getElementById('chart-likvardighet-heatmap');
        if (pairs.length) expect(el).not.toBeNull();
    });

    it('tableToMatrix läser rubrik + rader och rensar knappar/ikoner', () => {
        win.__renderTabContent('matrix');   // fyller matrix-table
        const m = win.__tableToMatrix('matrix-table');
        expect(Array.isArray(m)).toBe(true);
        if (m.length) {
            const cols = m[0].length;
            m.forEach(row => expect(row.length).toBe(cols));   // rektangulär
            // ingen cell innehåller kvarvarande knapptext/emoji-lupp
            expect(m.flat().some(c => c.includes('🔍'))).toBe(false);
        }
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

describe('multivariat analys: pedagogik (kronor, budget, per-BAS-diagram)', () => {
    it('_regressionKronor översätter kön-effekten till kronor konsekvent', () => {
        // Modellen är multiplikativ: kvinna = man × (1 + konPct/100).
        const kr = win.__regressionKronor({ konPct: -5, medianMa: 40000, nKvAnalysed: 10 });
        expect(kr.refMan).toBe(40000);
        expect(kr.refKvinna).toBeCloseTo(38000, 6);      // 40000 × 0,95
        expect(kr.krMonth).toBeCloseTo(2000, 6);
        expect(kr.krYear).toBeCloseTo(24000, 6);
        expect(kr.krTotalYear).toBeCloseTo(240000, 6);   // × 10 kvinnor
    });

    it('_regressionKronor returnerar null utan användbart underlag', () => {
        expect(win.__regressionKronor(null)).toBeNull();
        expect(win.__regressionKronor({ konPct: -5, medianMa: 0 })).toBeNull();
        expect(win.__regressionKronor({ konPct: NaN, medianMa: 40000 })).toBeNull();
    });

    it('_explanationBudget delar upp gapet i förklarat + kvarstående', () => {
        const b = win.__explanationBudget([
            { name: 'Endast kön', gapPct: -10, status: 'ok' },
            { name: '+ BAS-intervall', gapPct: -6, status: 'ok' },
            { name: '+ Ålder', gapPct: -4, status: 'ok' }
        ]);
        expect(b.g0).toBe(10);
        expect(b.remaining).toBe(4);
        expect(b.parts.map(p => p.key)).toEqual(['bas', 'alder']);
        expect(b.parts[0].val).toBeCloseTo(4, 6);   // 10 → 6
        expect(b.parts[1].val).toBeCloseTo(2, 6);   // 6 → 4
        expect(b.anyNegative).toBe(false);
        // andelarna summerar till 100 % av det ursprungliga gapet
        const sum = b.parts.reduce((s, p) => s + p.share, 0) + b.remainingShare;
        expect(sum).toBeCloseTo(100, 6);
    });

    it('_explanationBudget flaggar när en kontroll ÖKAR gapet', () => {
        const b = win.__explanationBudget([
            { name: 'Endast kön', gapPct: -4, status: 'ok' },
            { name: '+ BAS-intervall', gapPct: -7, status: 'ok' },
            { name: '+ Ålder', gapPct: -6, status: 'ok' }
        ]);
        expect(b.anyNegative).toBe(true);
        expect(b.parts[0].val).toBeLessThan(0);   // BAS dolde en del av gapet
        expect(b.parts[0].share).toBe(0);         // negativa bidrag ritas inte som stapel
    });

    it('regressionskortet renderar kronor, signalkolumn och per-BAS-container', () => {
        win.__loadDemoData();
        expect(() => win.__renderRegressionCard()).not.toThrow();
        const card = win.document.getElementById('regression-card');
        const r = win.__runOLS();
        if (r.error) return;                       // demodata gav ingen modell — hoppa
        expect(card.querySelector('#chart-perbas-gap')).not.toBeNull();
        expect(card.querySelector('#perbas-table')).not.toBeNull();
        // p/q är dolda som standard (klarspråk först)
        expect(card.querySelector('#perbas-table').classList.contains('hide-stats')).toBe(true);
        expect(card.querySelectorAll('#perbas-table th.col-stat').length).toBe(2);
        // stående reservation mot övertolkning finns intill siffrorna
        expect(card.querySelectorAll('.reg-caveat-inline').length).toBeGreaterThanOrEqual(2);
        expect(card.textContent).toContain('inte att den beror på kön eller är osaklig');
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
        expect(win.__policyLevelLabel({ bas: 'D' })).toBe('BAS-nivå');
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

describe('process-trackern och § 3:10', () => {
    it('process-trackern har åtta steg och steg 8 är manuellt (➖)', () => {
        win.__renderProcessTracker();
        const rows = [...win.document.querySelectorAll('#process-tracker .ptrack-row')];
        expect(rows.length).toBe(8);
        const step8 = rows[7];
        expect(step8.querySelector('.ptrack-status').dataset.status).toBe('manuell');
        expect(step8.textContent).toMatch(/Uppföljning/);
    });

    it('§ 3:10 och A/B-scenariojämförelsen ritas utan fel', () => {
        win.__loadDemoData();
        expect(() => win.__renderTabContent('likvardighet')).not.toThrow();
        expect(typeof win.__computeLikvardighetPairs).toBe('function');
        expect(typeof win.eval('_lvParFigur')).toBe('function');
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
        expect(txt).toContain('GRUPPDOSSIER');
        expect(txt).toMatch(/dokumenterar inte sakliga sk/i);
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

describe('k-anonymitet, sortering, efterlevnad och dossiern', () => {
    const rad = (bas, kon, lon) => ({ bas, kon, lon, alder: 40, yrke: '5301 Test', aid: '5301', yrkeLabel: 'Test', enhet: '' });

    it('k-anonymitet: efterlevnadsdiagrammet redovisar inte BAS under tröskeln', () => {
        const sparad = win.__state.data, sparadPolicy = win.__state.policy;
        try {
            // 6 personer i BAS A — under K_STANDARD (10)
            win.__state.data = Array.from({ length: 6 }, (_, i) => rad('A', i % 2 ? 'kvinna' : 'man', 26000 + i * 500));
            win.__state.policy = [{ bas: 'A', p10: 25000, med: 30000, p90: 40000 }];
            win.__state.kLage = 'export';   // så som diagrammet lämnar verktyget (ADR-51)
            win.__renderLonepolitik();
            const el = win.document.getElementById('chart-lp-compliance');
            expect(el).not.toBeNull();
            // Inget aggregat får ritas — i stället en förklaring om tröskeln
            expect(el.textContent).toMatch(/färre än 10 personer/);
        } finally {
            win.__state.data = sparad; win.__state.policy = sparadPolicy; win.__state.kLage = 'skarm';
        }
    });

    it('k-anonymitet: BAS över tröskeln redovisas fortfarande', () => {
        const sparad = win.__state.data, sparadPolicy = win.__state.policy;
        try {
            win.__state.data = Array.from({ length: 14 }, (_, i) => rad('A', i % 2 ? 'kvinna' : 'man', 26000 + i * 500));
            win.__state.policy = [{ bas: 'A', p10: 25000, med: 30000, p90: 40000 }];
            win.__renderLonepolitik();
            const el = win.document.getElementById('chart-lp-compliance');
            expect(el.textContent).not.toMatch(/färre än 10 personer/);
        } finally {
            win.__state.data = sparad; win.__state.policy = sparadPolicy;
        }
    });

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

describe('a11y: ARIA APG-tangentbord i den in-page-tablisten', () => {
    // Sidopanelen är navigation (ADR-10) och omfattas INTE — den har alla knappar
    // i Tab-ordningen med flit. Det här gäller info-sektionerna, som är äkta tablists.
    const listor = [
        ['info-sektionerna', '.info-section-btn', () => win]
    ];

    for (const [namn, sel, fonster] of listor) {
        it(`${namn}: exakt en knapp ligger i Tab-ordningen (roving tabindex)`, () => {
            const btns = [...fonster().document.querySelectorAll(sel)];
            expect(btns.length).toBeGreaterThan(1);
            expect(btns.filter(b => b.tabIndex === 0).length).toBe(1);
            expect(btns.every(b => b.tabIndex === 0 || b.tabIndex === -1)).toBe(true);
        });

        it(`${namn}: högerpil flyttar aktiv flik, fokus och tabindex`, () => {
            const btns = [...fonster().document.querySelectorAll(sel)];
            const från = btns.findIndex(b => b.tabIndex === 0);
            const till = (från + 1) % btns.length;
            btns[från].dispatchEvent(new (fonster().KeyboardEvent)('keydown', { key: 'ArrowRight', bubbles: true }));
            expect(btns[till].classList.contains('active'), 'nästa flik ska bli aktiv').toBe(true);
            expect(btns[till].getAttribute('aria-selected')).toBe('true');
            expect(btns[från].getAttribute('aria-selected')).toBe('false');
            expect(btns[till].tabIndex).toBe(0);
            expect(btns[från].tabIndex).toBe(-1);
            expect(fonster().document.activeElement).toBe(btns[till]);
        });

        it(`${namn}: vänsterpil wrappar runt till sista fliken`, () => {
            const btns = [...fonster().document.querySelectorAll(sel)];
            const första = btns[0];
            första.click();
            expect(första.tabIndex).toBe(0);
            första.dispatchEvent(new (fonster().KeyboardEvent)('keydown', { key: 'ArrowLeft', bubbles: true }));
            expect(btns[btns.length - 1].classList.contains('active')).toBe(true);
        });

        it(`${namn}: End går till sista, Home till första`, () => {
            const btns = [...fonster().document.querySelectorAll(sel)];
            const aktiv = () => btns.findIndex(b => b.tabIndex === 0);
            btns[aktiv()].dispatchEvent(new (fonster().KeyboardEvent)('keydown', { key: 'End', bubbles: true }));
            expect(aktiv()).toBe(btns.length - 1);
            btns[aktiv()].dispatchEvent(new (fonster().KeyboardEvent)('keydown', { key: 'Home', bubbles: true }));
            expect(aktiv()).toBe(0);
        });
    }

    it('sidopanelens navigationsknappar är kvar i Tab-ordningen (ADR-10)', () => {
        // Regressionsskydd: roving tabindex togs BORT ur sidopanelen med flit.
        const nav = [...win.document.querySelectorAll('.nav-item')];
        expect(nav.length).toBeGreaterThan(1);
        expect(nav.some(b => b.tabIndex === -1), 'ingen nav-knapp ska tas ur Tab-ordningen').toBe(false);
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
        // Alla flikar är ritade (beforeAll); Översikt och Lika arbete bär de märkta behållarna.
        win.__renderTabContent('dashboard');
        const skal = win.__exportSkal();
        const markta = [...win.document.querySelectorAll('[data-no-export]')];
        expect(markta.map(el => el.id).sort()).toEqual(['ov-lage', 'pag-diagram-ruta']);
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
        expect(win.document.getElementById('chart-ov-tradkarta')._figur).toBeTruthy();   // och minst ett sådant finns
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

// CSV- och urklippsexport: en cell som börjar med = + - @ (eller tabb/radbrytning)
// tolkas som formel när filen öppnas eller klistras in i Excel. Yrkes- och
// enhetsnamn kommer ur lönefilen, så en fientlig fil kunde annars smyga in en
// formel i HR:s export ("CSV-injektion", OWASP).
describe('export: formler i celler neutraliseras', () => {
    const rad = celler => win.__toCsv([celler]);
    it('formelstart får ett inledande apostrof-tecken', () => {
        expect(rad(['=HYPERLINK("http://x","klick")'])).toBe(`"'=HYPERLINK(""http://x"",""klick"")"`);
        expect(rad(['+1+1'])).toBe("'+1+1");
        expect(rad(['@SUM(A1)'])).toBe("'@SUM(A1)");
        expect(rad(['-2+3'])).toBe("'-2+3");
        expect(rad(['\t=1'])).toBe("'\t=1");
    });
    it('vanliga tal och formaterade värden lämnas orörda', () => {
        expect(rad([-5, 3.25, '-3,2 %', '+12', '−', '31 417 kr', '-1 250 kr', 'Förskollärare'])).toBe("-5;3.25;-3,2 %;+12;−;31 417 kr;-1 250 kr;Förskollärare");
    });
    it('urklippet neutraliseras på samma sätt', () => {
        expect(win.__tillTsv([['=1+1', 'a'], ['-7', '@x']])).toBe("'=1+1\ta\n-7\t'@x");
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
    beforeAll(async () => { win.__loadDemoData(); grund(); rita(); await vanta(); });

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

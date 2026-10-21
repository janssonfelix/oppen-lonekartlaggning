/**
 * Röktest (jsdom): Sortering, organisationsneutralt läge, organisationspaket, licens och demosidan.
 *
 * Utbrutet ur smoke.test.js så att Vitest fördelar röktesterna över flera arbetare; varje describe-block
 * skapar sina egna fönster via createAppWindow (tests/helpers/app-harness.js).
 */
import { describe, it, expect } from 'vitest';
import { createAppWindow } from './helpers/app-harness.js';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { bakaIn, lasUt } from '../src/lib/organisationsfil.js';

describe('sortering, Att göra, kopiering och Likvärdigt arbete', () => {
    it('sortering: en notrad (colspan, utan värde) stannar sist i sin grupp åt båda håll', () => {
        const w = createAppWindow();
        const d = w.document;
        const t = d.createElement('table'); t.id = 'sorttest';
        t.innerHTML = '<thead><tr><th>Namn</th><th>Värde</th></tr></thead><tbody>'
            + '<tr class="group-header"><td colspan="2">BAS A</td></tr>'
            + '<tr><td>x</td><td data-sort-value="1">1</td></tr><tr><td>y</td><td data-sort-value="2">2</td></tr>'
            + '<tr><td colspan="2">not</td></tr></tbody>';
        d.body.appendChild(t);
        w.enableTableSort('sorttest');
        const th = t.querySelectorAll('th')[1];
        for (let i = 0; i < 2; i++) {
            th.click();
            const rader = [...t.querySelectorAll('tbody tr')].map(r => r.textContent);
            expect(rader[rader.length - 1]).toBe('not');
        }
    });
    it('Att göra: länkarna går att skilja åt för skärmläsare; datakvalitet leder till Underlagets kvalitet', () => {
        const w = createAppWindow();
        w.__loadDemoData();
        const d = w.document;
        const lankar = [...d.querySelectorAll('#att-gora a[data-go-to-tab]')];
        expect(lankar.length).toBeGreaterThan(4);
        // Samma namn får bara förekomma för samma mål (Börja här och hela listan pekar på samma punkt).
        const mal = new Map();
        for (const a of lankar) {
            const namn = a.getAttribute('aria-label') || a.textContent.trim();
            const dit = a.dataset.goToTab + '#' + (a.dataset.goToAnchor || '');
            expect(mal.get(namn) ?? dit, namn).toBe(dit);
            mal.set(namn, dit);
        }
        expect([...mal.keys()].filter(n => /^(Visa|Gå dit|öppna fliken) →$/.test(n))).toEqual([]);
        for (const a of lankar.filter(a => a.dataset.goToTab === 'dashboard')) expect(a.dataset.goToAnchor).toBe('underlagets-kvalitet');
        const cb = [...d.querySelectorAll('#att-gora .act-cb')].map(c => c.getAttribute('aria-label'));
        expect(new Set(cb).size).toBe(cb.length);
    });
    it('att rita en annan flik (t.ex. för att kopiera ett diagram) flyttar inte sidans navigering', () => {
        const w = createAppWindow();
        w.__loadDemoData();
        const d = w.document;
        d.querySelector('.nav-item[data-tab="dashboard"]').click();
        w.__renderTabContent('matrix');
        expect(d.querySelectorAll('#view-matrix .flow-next-bar, #view-lika-yrken .flow-next-bar, #view-skevhet .flow-next-bar').length).toBe(0);
        expect(d.getElementById('view-dashboard').classList.contains('active') || d.getElementById('view-dashboard').style.display === 'block').toBe(true);
    });
    it('Att göra: oförklarat gap skrivs med riktningsord, inte med minustecken', () => {
        const w = createAppWindow();
        w.__loadDemoData();
        const it = w.eval('buildActionChecklist()').find(x => x.id === 'reg-oforklarat');
        expect(it).toBeTruthy();
        expect(it.titel).not.toMatch(/: [−-]/);
        expect(it.titel).toMatch(/kvinnor .* (lägre|högre) lön än män/i);
    });
    it('Dokumentera räknar likvärdighetsparen en gång och sparar resultatet', () => {
        const w = createAppWindow();
        w.__loadDemoData();
        w.__state.likvardighet.result = null;
        const orig = w.computeLikvardighetPairs;
        let n = 0;
        w.computeLikvardighetPairs = (...a) => { n++; return orig(...a); };
        w.document.querySelector('.nav-item[data-tab="dokumentera"]').click();
        w.__rapportunderlagBlock();
        w.eval('_handlingsplanSeedRows()');
        expect(n).toBe(1);
        expect(w.__state.likvardighet.result).toBeTruthy();
    });
    it('ny jämförelsestatistik nollställer det sparade likvärdighetsresultatet', async () => {
        const w = createAppWindow();
        w.__loadDemoData();
        const { readFileSync } = await import('node:fs');
        const { join, dirname } = await import('node:path');
        const { fileURLToPath } = await import('node:url');
        w.eval(readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'vendor', 'papaparse.min.js'), 'utf8'));
        const sentinel = { pairs: [], sentinel: true };
        w.__state.likvardighet.result = sentinel;
        const input = w.document.getElementById('file-input-stat');
        const fil = new w.File(['AID;BAS;Median\n5301;C;30000\n'], 'statistik.csv', { type: 'text/csv' });
        Object.defineProperty(input, 'files', { configurable: true, value: [fil] });
        input.dispatchEvent(new w.Event('change'));
        for (let i = 0; i < 50 && !/inlästa|Fel/.test(w.document.getElementById('stat-status').textContent); i++) await new Promise(r => setTimeout(r, 20));
        expect(w.document.getElementById('stat-status').textContent).toMatch(/inlästa/);
        expect(w.__state.likvardighet.result).not.toBe(sentinel);
    });
    it('kopiera diagram: urklippet begärs direkt i klicket (Safari), bilden levereras som ett löfte', async () => {
        const w = createAppWindow();
        w.__loadDemoData();
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
    it('Likvärdigt arbete i poängläget: fliken säger att kraven mäts med poäng och Lägre krav förklarar varför den är tom', () => {
        const w = createAppWindow();
        w.__loadDemoData();
        w.__state.arbetsvardering = { byKey: new Map(w.__getData().map(r => [`${r.aid}|${r.bas}`, 100 + 'ABCDEFGHIJ'.indexOf(r.bas) * 50])) };
        w.__state.likvardighet.result = null;
        w.document.querySelector('.nav-item[data-tab="likvardighet"]').click();
        const t = w.document.getElementById('view-likvardighet').textContent;
        expect(t).toMatch(/Krav-proxy: arbetsvärdering \(poäng\)/);
        expect(t).toMatch(/Med arbetsvärderingspoäng jämförs yrken redan över BAS-gränserna/);
    });
    it('Att göra: rubrikordning h2 → h3, och länken till Jämförelse döljs utan jämförelsestatistik', () => {
        const w = createAppWindow();
        w.__loadDemoData();
        const d = w.document;
        const rubriker = [...d.querySelectorAll('#att-gora h1, #att-gora h2, #att-gora h3, #att-gora h4')].map(h => Number(h.tagName[1]));
        expect(rubriker[0]).toBe(2);
        for (let i = 1; i < rubriker.length; i++) expect(rubriker[i] - rubriker[i - 1], `rubrik ${i}`).toBeLessThanOrEqual(1);
        w.__state.statistik = [];
        w.eval('updateCompliance()');
        const lank = d.querySelector('#comp-bm .comp-lank');
        expect(lank.hidden || lank.closest('[hidden]') !== null).toBe(true);
    });
    it('CSV med bara CR som radslut och en försättsrad: rubriken hittas och radnumren stämmer', async () => {
        const { readFileSync } = await import('node:fs');
        const { join, dirname } = await import('node:path');
        const { fileURLToPath } = await import('node:url');
        const w = createAppWindow();
        w.eval(readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'vendor', 'papaparse.min.js'), 'utf8'));
        const rader = ['Lönerapport september', 'BAS;Månadslön;Ålder;Kön;AID', 'A;30000;40;Kvinna;5301', 'A;31000;41;Man;5301'];
        w.loadStructureFile(new w.File([rader.join('\r')], 'p.csv', { type: 'text/csv' }));
        for (let i = 0; i < 100 && !w.__state.data.length; i++) await new Promise(r => setTimeout(r, 20));
        expect(w.__state.data.map(r => r.radnr)).toEqual([3, 4]);
    });
    it('Att göra: procenttal med decimalkomma och riktningsord, inga bindestreck som minus', () => {
        const w = createAppWindow();
        w.__loadDemoData();
        const texter = w.eval('buildActionChecklist()').flatMap(it => [it.titel, it.detalj]);
        expect(texter.length).toBeGreaterThan(3);
        for (const t of texter) {
            expect(t, t).not.toMatch(/\d\.\d/);
            expect(t, t).not.toMatch(/(^|[\s(])[-−]\d/);
        }
    });
    it('Om verktyget visar licenstexterna från den inbyggda mallen', () => {
        const w = createAppWindow();
        const t = w.document.createElement('template'); t.id = 'licenstexter';
        t.innerHTML = '<pre>Permission is hereby granted — testtext</pre>';
        w.document.body.appendChild(t);
        w.document.querySelector('.nav-item[data-tab="info"]').click();
        w.eval("renderInfoTab('references')");
        expect(w.document.getElementById('om-licenstexter').textContent).toContain('Permission is hereby granted');
        expect(w.document.getElementById('view-info').textContent).toContain('riskanalys.md');
    });
});

describe('organisationsneutralt standardläge', () => {
    const rader = () => {
        const r = [];
        for (let i = 0; i < 60; i++) r.push({ bas: 'ABC'[i % 3], kon: i % 2 ? 'man' : 'kvinna', lon: 30000 + i * 150, alder: 30 + (i % 30),
            yrke: `${100 + (i % 4)} Yrke`, aid: String(100 + (i % 4)), yrkeLabel: 'Yrke', radnr: i + 2 });
        return r;
    };
    const utanReferens = () => {
        const w = createAppWindow();
        w.__state.data = rader();
        w.eval('populateSelects(); unlockTabs(); updateCompliance();');
        return w;
    };
    it('ingen inbyggd referens och neutral profil', () => {
        const w = createAppWindow();
        expect(w.__state.policy).toEqual([]);
        expect(w.eval('referensNamn()')).toBe('Ingen referens inläst');
        expect(w.document.getElementById('referens-status').textContent).toContain('Ingen referens inläst');
        expect(w.__state.profile.name).toBe('Er organisation');
        expect(w.__state.profile.benchmarkLabel).toBe('jämförelsestatistiken');
        expect(w.document.getElementById('profile-preset-select')).toBeNull();
    });
    it('Prioritering och Lönepolitik visar vad som behöver läsas in', () => {
        const w = utanReferens();
        w.document.querySelector('.nav-item[data-tab="prioritering"]').click();
        expect(w.document.getElementById('view-prioritering').textContent).toMatch(/Ladda upp ert lönepolitiska ställningstagande/);
        w.document.querySelector('.nav-item[data-tab="lonepolitik"]').click();
        expect(w.document.getElementById('view-lonepolitik').textContent).toMatch(/Ladda upp ert lönepolitiska ställningstagande/);
        expect(w.document.getElementById('comp-pol-val').textContent).toMatch(/Kräver lönepolitiskt ställningstagande/);
    });
    it('Word-utkastet och rapportunderlaget skriver inte null eller undefined utan referens', () => {
        const w = utanReferens();
        const texter = [w.__docDraftHtml(), ...w.__rapportunderlagBlock().map(b => w.__ruTillText(b))].join('\n');
        expect(texter).not.toMatch(/\bnull\b|\bundefined\b/);
    });
    it('demoläget använder Exempelkommunen och försvinner med rensningen', () => {
        const w = createAppWindow();
        w.__loadDemoData();
        expect(w.eval('referensNamn()')).toBe('Exempelkommunens lönepolitik');
        expect(w.__state.policy.length).toBeGreaterThan(0);
        expect(w.__state.profile.name).toBe('Exempelkommunen');
        w.__clearAllData();
        expect(w.__state.policy).toEqual([]);
        expect(w.__state.profile.name).toBe('Er organisation');
        expect(w.eval('referensNamn()')).toBe('Ingen referens inläst');
    });
});


describe('organisationspaket: läs in och skapa', () => {
    const paket = (over = {}) => ({
        format: 'lonekartlaggning-organisationspaket', version: 1,
        organisation: { namn: 'Exempelregionen' }, utgivare: 'HR', skapat: '2026-10-01', avserAr: 2026,
        profil: { jamforelseNamn: 'Regionens lönestatistik', jamforelseGenitiv: 'Regionens lönestatistiks', jamforelseKort: 'statistiken' },
        installningar: { poPct: 41.5, poNot: 'Egen', manader: 6 },
        referens: { namn: 'Regionens lönepolicy 2026', kortnamn: 'Lönepolicy 2026',
                    rader: ['A', 'B', 'C'].map((bas, i) => ({ bas, aid: null, p10: 25000 + i * 2000, med: 28000 + i * 2000, p90: 31000 + i * 2000 })) },
        statistik: { namn: 'Lönestatistik 2025',
                     rader: [{ aid: '100', aidFull: '100 Yrke', bas: 'A', median: 30000, p10: 27000, p90: 33000, nKv: 20, nMa: 20, andelKv: 50 }] },
        ...over,
    });
    const rader = () => Array.from({ length: 40 }, (_, i) => ({ bas: 'ABC'[i % 3], kon: i % 2 ? 'man' : 'kvinna', lon: 30000 + i * 100, alder: 40,
        yrke: '100 Yrke', aid: '100', yrkeLabel: 'Yrke', radnr: i + 2 }));
    const las = (w, obj) => w.eval(`lasInPaket(${JSON.stringify(JSON.stringify(obj))}, 'x.lonepaket.json')`);

    it('ett fullständigt paket sätter profil, inställningar, referens och statistik', () => {
        const w = createAppWindow();
        const r = las(w, paket());
        expect(r.ok).toBe(true);
        const s = w.__state;
        expect(s.profile.name).toBe('Exempelregionen');
        expect(s.profile.benchmarkLabel).toBe('Regionens lönestatistik');
        expect(s.costSettings.poPct).toBe(41.5);
        expect(s.costSettings.months).toBe(6);
        expect(s.policy).toHaveLength(3);
        expect(w.eval('referensNamn()')).toBe('Regionens lönepolicy 2026');
        expect(s.statistik).toHaveLength(1);
        expect(s.statistikNamn).toBe('Lönestatistik 2025');
        expect(s.paket).toEqual({ organisation: 'Exempelregionen', utgivare: 'HR', skapat: '2026-10-01', avserAr: 2026, kalla: 'fil' });
        const d = w.document;
        expect(d.getElementById('upload-cell-policy').textContent).toContain('Från organisationspaketet');
        expect(d.getElementById('upload-cell-stat').textContent).toContain('Från organisationspaketet');
        expect(d.getElementById('referens-status').textContent).toContain('organisationspaket från Exempelregionen, 2026-10-01');
        expect(d.getElementById('paket-info').hidden).toBe(false);
        expect(d.getElementById('paket-info').textContent).toContain('Exempelregionen');
        expect(w.__docDraftHtml()).toContain('Lönestatistik 2025 (organisationspaket från Exempelregionen, 2026-10-01)');
        expect(w.__docDraftHtml()).toContain('Regionens lönepolicy 2026 (organisationspaket från Exempelregionen, 2026-10-01)');
    });
    it('ett paket utan statistik skriver inte över en egen statistikfil', () => {
        const w = createAppWindow();
        w.__state.statistik = [{ aid: '999', aidFull: '999 Eget', bas: 'A', median: 1, p10: 0, p90: 0, nKv: null, nMa: null, andelKv: null }];
        const p = paket(); delete p.statistik;
        expect(las(w, p).ok).toBe(true);
        expect(w.__state.statistik[0].aid).toBe('999');
    });
    it('ett felaktigt paket ändrar ingenting', () => {
        const w = createAppWindow();
        const fore = JSON.stringify({ p: w.__state.profile, c: w.__state.costSettings, pol: w.__state.policy });
        const r = las(w, paket({ format: 'annat' }));
        expect(r.ok).toBe(false);
        expect(JSON.stringify({ p: w.__state.profile, c: w.__state.costSettings, pol: w.__state.policy })).toBe(fore);
        expect(w.document.getElementById('paket-status').textContent).toMatch(/inte ett organisationspaket/);
    });
    it('skapa → läs in i ett nytt fönster ger samma delar', () => {
        const w = createAppWindow();
        las(w, paket());
        const d = w.document;
        const satt = (id, v) => { const el = d.getElementById(id); el.value = v; el.dispatchEvent(new w.Event('input', { bubbles: true })); };
        satt('paket-org', 'Nya regionen'); satt('paket-utgivare', 'Lön'); satt('paket-ar', '2027');
        satt('paket-jamf-namn', 'Nya statistiken'); satt('paket-jamf-genitiv', 'Nya statistikens'); satt('paket-po', '40'); satt('paket-manader', '12');
        expect(d.getElementById('btn-paket-spara').disabled).toBe(false);
        const skapat = w.eval('skapaPaket()');
        const w2 = createAppWindow();
        expect(las(w2, skapat).ok).toBe(true);
        expect(w2.__state.profile.name).toBe('Nya regionen');
        expect(w2.__state.profile.benchmarkLabel).toBe('Nya statistiken');
        expect(w2.__state.costSettings.poPct).toBe(40);
        expect(w2.__state.policy).toEqual(w.__state.policy);
        expect(w2.__state.statistik).toEqual(w.__state.statistik);
        expect(w2.__state.paket.avserAr).toBe(2027);
    });
    it('ställningstagandets namn följer formuläret, inte filnamnet, och går att byta efter inläst paket', () => {
        const w = createAppWindow();
        const d = w.document;
        const satt = (id, v) => { const el = d.getElementById(id); el.value = v; el.dispatchEvent(new w.Event('input', { bubbles: true })); };
        w.__lasInReferens([{ bas: 'A', p10: 25000, med: 30000, p90: 35000 }], '2026 lonepol.csv');
        expect(w.eval('referensNamn()')).toBe('2026 lonepol');
        w.eval('_fyllPaketFormular()');
        expect(d.getElementById('paket-ref-namn').value).toBe('2026 lonepol');   // förifyllt, synligt att byta
        satt('paket-org', 'Nya regionen'); satt('paket-ref-namn', 'Lönepolitiskt ställningstagande 2026'); satt('paket-ref-kortnamn', 'ställningstagandet');
        const skapat = w.eval('skapaPaket()');
        expect(skapat.referens.namn).toBe('Lönepolitiskt ställningstagande 2026');
        expect(skapat.referens.kortnamn).toBe('ställningstagandet');
        const w2 = createAppWindow();
        // Lönedata så att fliken ritas (demoläget lämnas när ett riktigt paket läses in, så inte demodata).
        w2.__state.data = Array.from({ length: 40 }, (_, i) => ({ bas: 'AB'[i % 2], kon: i % 2 ? 'man' : 'kvinna', alder: 25 + (i % 30),
            lon: 28000 + 500 * (i % 7) + (i % 2 ? 1500 : 0), aid: '100', yrke: '100 Y', yrkeLabel: 'Y' }));
        expect(las(w2, skapat).ok).toBe(true);
        expect(w2.eval('referensNamn()')).toBe('Lönepolitiskt ställningstagande 2026');
        expect(w2.eval('referensKortnamn()')).toBe('ställningstagandet');
        expect(w2.eval('getData().length')).toBeGreaterThan(0);
        w2.__renderLonepolitik();
        expect(w2.document.getElementById('lonepolitik-rubrik').textContent).toBe('Lönerna mot Lönepolitiskt ställningstagande 2026');
        // Namnfältet på Översikt är synligt för ett paket och byter namnet
        expect(w2.document.getElementById('referens-namn-rad').hidden).toBe(false);
        expect(w2.eval("sattReferensNamn('Vårt ställningstagande').ok")).toBe(true);
        w2.__renderLonepolitik();
        expect(w2.document.getElementById('lonepolitik-rubrik').textContent).toBe('Lönerna mot Vårt ställningstagande');
        expect(w2.document.getElementById('btn-referens-aterga').hidden).toBe(true);   // borttagning bara för egen fil
    });
    // ---- Organisationsfil: verktyget med paketet inbakat (docs/utveckling/organisationsfil-design.md) ----
    const INDEX = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'index.html'), 'utf8');
    const organisationsfil = (p = paket(), meta = { skapad: '2026-10-19', organisation: 'Exempelregionen', verktygssha: 'f00' }) => {
        const r = bakaIn(INDEX, JSON.stringify(p), meta);
        if (!r.ok) throw new Error(r.fel);
        return r.html;
    };
    it('en organisationsfil läser in sitt paket vid start, visar källan och går att granska och ladda ner', () => {
        const w = createAppWindow({ html: organisationsfil() });
        const s = w.__state;
        expect(s.paket).toMatchObject({ organisation: 'Exempelregionen', kalla: 'inbakat' });
        expect(s.paketInbakat).toMatchObject({ skapad: '2026-10-19', organisation: 'Exempelregionen', verktygssha: 'f00' });
        expect(s.policy).toHaveLength(3);
        expect(w.eval('referensNamn()')).toBe('Regionens lönepolicy 2026');
        expect(w.eval('referensKalla()')).toMatch(/inbakat i den här filen/);
        expect(w.eval('statistikBeskrivning()')).toMatch(/inbakat i den här filen/);
        expect(s.profile.name).toBe('Exempelregionen');
        expect(s.costSettings.poPct).toBe(41.5);
        const d = w.document;
        expect(d.getElementById('paket-info').textContent).toMatch(/Inbakat i den här filen \(skapad 2026-10-19\)/);
        expect(d.getElementById('upload-cell-policy').textContent).toContain('Från organisationspaketet');
        // Visa paketet: modalen ritar tabellerna och råtexten
        d.getElementById('btn-paket-visa').click();
        const m = d.getElementById('paket-modal');
        expect(m.style.display).toBe('flex');
        const txt = d.getElementById('paket-modal-content').textContent;
        expect(txt).toContain('Exempelregionen');
        expect(txt).toContain('Regionens lönepolicy 2026');
        expect(txt).toContain('Lönestatistik 2025');
        expect(txt).toContain('"format"');
        d.getElementById('paket-modal-close').click();
        expect(m.style.display).toBe('none');
        // Ladda ner paketet: en Blob med samma paket
        let fangad = null;
        w.URL.createObjectURL = b => { fangad = b; return 'blob:x'; };
        d.getElementById('btn-paket-ladda-ner').click();
        expect(fangad).not.toBeNull();
        // Om verktyget nämner organisationsfilen (avsnittet med versionen)
        w.eval("renderInfoTab('releases')");
        expect(d.getElementById('view-info').textContent).toMatch(/Den här filen är en organisationsfil/);
    });
    it('en inläst paketfil ersätter det inbakade för sessionen, och Rensa all data tar det inbakade tillbaka', () => {
        const w = createAppWindow({ html: organisationsfil() });
        expect(las(w, paket({ organisation: { namn: 'Annan organisation' } })).ok).toBe(true);
        expect(w.__state.paket).toMatchObject({ organisation: 'Annan organisation', kalla: 'fil' });
        expect(w.document.getElementById('paket-info').textContent).toMatch(/ersätter det inbakade paketet/);
        w.__clearAllData();
        expect(w.__state.paket).toMatchObject({ organisation: 'Exempelregionen', kalla: 'inbakat' });
        expect(w.__state.policy).toHaveLength(3);
    });
    it('demoläget går före det inbakade paketet', () => {
        const w = createAppWindow({ html: organisationsfil(), url: 'http://localhost/?demo=1' });
        expect(w.__state.isDemo).toBe(true);
        expect(w.__state.paket).toBeNull();
        expect(w.document.getElementById('paket-status').textContent).toMatch(/används inte i demoläget/);
    });
    it('ett trasigt inbakat paket stoppar inte starten och ger ett fel i filrutan', () => {
        const html = INDEX.replace('</body>', '<template id="inbakat-organisationspaket" data-skapad="2026-10-19">{inte json</template></body>');
        const w = createAppWindow({ html });
        expect(w.__state.paket).toBeNull();
        expect(w.document.getElementById('paket-status').textContent).toMatch(/inbakade paketet kunde inte läsas/);
        expect(w.document.getElementById('tab-bestammelser')).not.toBeNull();   // appen startade
    });
    it('systemägaren bakar in paketet i den utpekade verktygsfilen och får en organisationsfil', async () => {
        const w = createAppWindow();
        las(w, paket());
        // Inläst lönedata med igenkännbara värden: inget av dem får följa med in i organisationsfilen.
        w.__state.data = Array.from({ length: 12 }, (_, i) => ({ bas: 'AB'[i % 2], kon: i % 2 ? 'man' : 'kvinna', alder: 30 + i,
            lon: 87654 + i, aid: '100', yrke: '100 Lönefältsyrke', yrkeLabel: 'Lönefältsyrke' }));
        const d = w.document;
        const satt = (id, v) => { const el = d.getElementById(id); el.value = v; el.dispatchEvent(new w.Event('input', { bubbles: true })); };
        satt('paket-org', 'Exempelregionen'); satt('organisationsfil-namn', 'lonekartlaggning 2026');
        const knapp = d.getElementById('btn-organisationsfil-spara');
        expect(knapp.disabled).toBe(true);                     // ingen verktygsfil utpekad än
        w.eval(`_verktygsfil = new File([${JSON.stringify(INDEX)}], 'oppen-lonekartlaggning.html', { type: 'text/html' }); uppdateraOrganisationsfilKnapp();`);
        expect(knapp.disabled).toBe(false);
        let fangad = null, namn = null;
        w.URL.createObjectURL = b => { fangad = b; return 'blob:x'; };
        const origClick = w.HTMLAnchorElement.prototype.click;
        w.HTMLAnchorElement.prototype.click = function () { namn = this.download; };
        const r = await w.eval('skapaOrganisationsfil()');
        w.HTMLAnchorElement.prototype.click = origClick;
        expect(r.ok).toBe(true);
        expect(namn).toBe('lonekartlaggning 2026.html');
        expect(r.meddelande).toMatch(/Ingen lönedata ingår/);
        const ut = await fangad.text();
        const block = lasUt(ut);
        expect(block).not.toBeNull();
        expect(block.meta.organisation).toBe('Exempelregionen');
        expect(JSON.parse(block.json).referens.rader).toHaveLength(3);
        expect(ut).not.toContain('"lon"');                     // ingen lönedata
        expect(ut).not.toMatch(/8765\d/);                      // inga löner ur den inlästa filen
        expect(ut).not.toContain('Lönefältsyrke');
        // Resultatet startar som organisationsfil
        const w2 = createAppWindow({ html: ut });
        expect(w2.__state.paket).toMatchObject({ organisation: 'Exempelregionen', kalla: 'inbakat' });
    });
    it('spara-knappen är avstängd utan namn eller utan data', () => {
        const w = createAppWindow();
        const d = w.document;
        const knapp = d.getElementById('btn-paket-spara');
        d.getElementById('paket-org').value = 'X';
        d.getElementById('paket-org').dispatchEvent(new w.Event('input', { bubbles: true }));
        expect(knapp.disabled).toBe(true);           // ingen referens och ingen statistik
        w.__lasInReferens([{ bas: 'A', p10: 1, med: 2, p90: 3 }], 'r.csv');
        d.getElementById('paket-org').dispatchEvent(new w.Event('input', { bubbles: true }));
        expect(knapp.disabled).toBe(false);
        d.getElementById('paket-org').value = '';
        d.getElementById('paket-org').dispatchEvent(new w.Event('input', { bubbles: true }));
        expect(knapp.disabled).toBe(true);
    });
    it('Rensa all data tar bort paketet och återställer neutralt läge', () => {
        const w = createAppWindow();
        las(w, paket());
        w.__clearAllData();
        const s = w.__state;
        expect(s.paket).toBeNull();
        expect(s.profile.name).toBe('Er organisation');
        expect(s.costSettings.poPct).toBe(39.15);
        expect(s.policy).toEqual([]);
        expect(s.statistik).toEqual([]);
        expect(s.statistikNamn).toBeNull();
        expect(w.document.getElementById('paket-info').hidden).toBe(true);
    });
    it('konfigurationsfilen noterar paketet men bär inga paketrader', () => {
        const w = createAppWindow();
        w.__state.data = rader();
        las(w, paket());
        const cfg = w.__buildConfigSnapshot();
        expect(cfg.organisationspaket).toEqual({ organisation: 'Exempelregionen', skapat: '2026-10-01' });
        expect(JSON.stringify(cfg)).not.toContain('Regionens lönepolicy');
        expect(JSON.stringify(cfg)).not.toContain('100 Yrke');
    });
    it('paket inläst efter lönefilen nollställer sparade likvärdighetspar', () => {
        const w = createAppWindow();
        w.__state.data = rader();
        w.__state.likvardighet.result = { pairs: [], sentinel: true };
        las(w, paket());
        expect(w.__state.likvardighet.result?.sentinel).toBeUndefined();   // det gamla resultatet är borta
    });
    it('paket i demoläget avslutar demot först', () => {
        const w = createAppWindow();
        w.__loadDemoData();
        las(w, paket());
        expect(w.__state.isDemo).toBe(false);
        expect(w.__state.data).toEqual([]);
        expect(w.eval('referensNamn()')).toBe('Regionens lönepolicy 2026');
    });
    it('filknappen: för stor fil avvisas innan den läses', async () => {
        const w = createAppWindow();
        const input = w.document.getElementById('file-input-paket');
        const skicka = async (innehall, namn) => {
            const fil = new w.File([innehall], namn, { type: 'application/json' });
            Object.defineProperty(input, 'files', { configurable: true, value: [fil] });
            input.dispatchEvent(new w.Event('change'));
            for (let i = 0; i < 50 && !w.document.getElementById('paket-status').textContent; i++) await new Promise(r => setTimeout(r, 20));
        };
        await skicka('x'.repeat(5 * 1024 * 1024 + 1), 'stor.json');
        expect(w.document.getElementById('paket-status').textContent).toMatch(/för stor/);
    });
});

describe('organisationspaket: escapning, byten mellan paket och demot', () => {
    const XSS = 'K<img src=x onerror="window.__xss=1">';
    const paket = (over = {}) => ({
        format: 'lonekartlaggning-organisationspaket', version: 1,
        organisation: { namn: 'Org A' }, skapat: '2026-10-01',
        installningar: { poPct: 30, manader: 6 },
        referens: { namn: 'Ref A', kortnamn: 'Ref A', rader: ['A', 'B', 'C'].map((bas, i) => ({ bas, aid: null, p10: 25000 + i * 2000, med: 28000 + i * 2000, p90: 31000 + i * 2000 })) },
        statistik: { namn: 'Stat A', rader: [{ aid: '100', aidFull: '100 Yrke', bas: 'A', median: 30000, p10: 27000, p90: 33000, nKv: 20, nMa: 20, andelKv: 50 }] },
        ...over,
    });
    const rader = () => Array.from({ length: 60 }, (_, i) => ({ bas: 'ABC'[i % 3], kon: i % 2 ? 'man' : 'kvinna', lon: 26000 + (i % 3) * 3000 + i * 10, alder: 40,
        yrke: '100 Yrke', aid: '100', yrkeLabel: 'Yrke', radnr: i + 2 }));
    const las = (w, obj) => w.eval(`lasInPaket(${JSON.stringify(JSON.stringify(obj))}, 'x')`);

    it('referensens namn ur ett paket escapas i beräkningsbeviset och utskriften', async () => {
        const w = createAppWindow();
        w.__state.data = rader();
        w.eval('populateSelects(); unlockTabs();');
        las(w, paket({ referens: { ...paket().referens, namn: XSS, kortnamn: XSS } }));
        const it0 = w.eval("computePrioritization('stallningstagande')")[0];
        const bevis = w.eval('_evidenceForPrioItem')(it0, 'stallningstagande');
        expect(bevis.intro).not.toContain('<img');
        w.print = () => {};
        await w.eval('buildPrintReport()');
        await new Promise(r => setTimeout(r, 0));
        // Inget element skapas ur namnet (inuti ett citerat attributvärde är "<" ofarligt).
        expect(w.document.querySelectorAll('#print-report img[onerror], #print-report [onerror]')).toHaveLength(0);
        expect(w.__xss).toBeUndefined();
    });
    it('paketets PO-påslag och period syns i Prioritering och skrivs inte tillbaka', () => {
        const w = createAppWindow();
        las(w, paket());
        expect(w.document.getElementById('prio-po-pct').value).toBe('30');
        expect(w.document.getElementById('prio-cost-months').value).toBe('6');
        w.eval('_readCostSettings()');
        expect(w.__state.costSettings.poPct).toBe(30);
        expect(w.__state.costSettings.months).toBe(6);
    });
    it('paket B efter paket A: A:s delar tillskrivs inte B', () => {
        const w = createAppWindow();
        las(w, paket());
        const b = paket({ organisation: { namn: 'Org B' }, installningar: {}, referens: { ...paket().referens, namn: 'Ref B', kortnamn: 'Ref B' } });
        delete b.statistik;
        las(w, b);
        expect(w.__state.statistik).toEqual([]);
        expect(w.eval('statistikBeskrivning()')).toBe('Ingen jämförelsestatistik inläst');
        expect(w.__state.costSettings.poPct).toBe(39.15);
        expect(w.document.getElementById('paket-info').textContent).not.toMatch(/jämförelsestatistik/);
    });
    it('en egen statistikfil står kvar när ett nytt paket saknar statistik', () => {
        const w = createAppWindow();
        w.__state.statistik = [{ aid: '999', aidFull: '999 Eget', bas: 'A', median: 1, p10: 0, p90: 0, nKv: null, nMa: null, andelKv: null }];
        w.__state.statistikKalla = 'fil';
        const b = paket(); delete b.statistik;
        las(w, b);
        expect(w.__state.statistik[0].aid).toBe('999');
    });
    it('demot efter ett paket blandar inte in paketets verkliga delar', () => {
        const w = createAppWindow();
        las(w, paket());
        w.__loadDemoData();
        expect(w.__state.paket).toBeNull();
        expect(w.__state.statistik).toEqual([]);
        expect(w.eval('referensNamn()')).toBe('Exempelkommunens lönepolitik');
        expect(w.__state.costSettings.poPct).toBe(39.15);
    });
    it('faktarutan följer med när en egen fil ersätter paketets ställningstagande', () => {
        const w = createAppWindow();
        las(w, paket());
        w.__lasInReferens([{ bas: 'A', p10: 1, med: 2, p90: 3 }], 'egen.csv');
        expect(w.document.getElementById('paket-info').textContent).not.toMatch(/ställningstagande 3 rader/);
    });
    it('ett paket som inte skulle gå att läsa in sparas inte', () => {
        const w = createAppWindow();
        w.__state.statistik = [{ aid: '5321012345', aidFull: '5321012345 X', bas: 'A', median: 30000, p10: 0, p90: 0, nKv: null, nMa: null, andelKv: null }];
        const d = w.document;
        d.getElementById('paket-org').value = 'Org';
        d.getElementById('paket-org').dispatchEvent(new w.Event('input', { bubbles: true }));
        let nedladdad = false;
        w.URL.createObjectURL = () => { nedladdad = true; return 'blob:x'; };
        d.getElementById('btn-paket-spara').click();
        expect(nedladdad).toBe(false);
        expect(d.getElementById('paket-status').textContent).toMatch(/personnummer/);
    });
});

describe('Om verktyget: licens', () => {
    it('avsnittet Referenser anger MIT-licensen och upphovspersonen', () => {
        const w = createAppWindow();
        w.document.querySelector('.nav-item[data-tab="info"]').click();
        w.eval("renderInfoTab('references')");
        const t = w.document.getElementById('view-info').textContent;
        expect(t).toMatch(/MIT-licensen/);
        expect(t).toContain('Felix Jansson');
    });
    it('Om verktyget berättar om nuläget, inte om tidigare versioner', () => {
        const w = createAppWindow();
        w.document.querySelector('.nav-item[data-tab="info"]').click();
        const sektioner = [...w.document.querySelectorAll('.info-section-btn')].map(b => b.dataset.section);
        expect(sektioner.length).toBeGreaterThan(0);
        let text = '';
        for (const s of sektioner) {
            w.eval(`renderInfoTab(${JSON.stringify(s)})`);
            text += w.document.getElementById('info-tab-content').textContent + '\n';
        }
        expect(text).not.toMatch(/Versionshistorik/);
        expect(text).not.toMatch(/Tidigare visades/);
        expect(text).not.toMatch(/äldre profile\.json/);
        expect(text).not.toMatch(/SKL/);
    });
});


describe('demosidan: adressparametern ?demo=1', () => {
    it('?demo=1 startar demoläget direkt vid laddning', () => {
        const w = createAppWindow({ url: 'http://localhost/oppen-lonekartlaggning.html?demo=1' });
        expect(w.__bootErr).toBeUndefined();
        expect(w.__state.isDemo).toBe(true);
        expect(w.__state.data.length).toBe(260);
    });
    it('utan parametern, eller med ett annat värde, laddas ingen data', () => {
        for (const url of ['http://localhost/', 'http://localhost/?demo=0', 'http://localhost/?demo=ja', 'http://localhost/?data=1']) {
            const w = createAppWindow({ url });
            expect(w.__state.data.length, url).toBe(0);
            expect(w.__state.isDemo, url).toBeFalsy();
        }
    });
});

describe('demot: ställningstagandet följer demolönerna', () => {
    it('några grupper ligger under ställningstagandet, så att Prioritering har något att visa', () => {
        const w = createAppWindow();
        w.__loadDemoData();
        w.__renderTabContent('prioritering');
        expect(w.document.getElementById('view-prioritering').textContent).not.toMatch(/Inga grupper under referensen/);
    });
});

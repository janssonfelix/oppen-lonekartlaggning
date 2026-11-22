/**
 * Röktest (jsdom): Säkerhet, interna fel, AID, ansvarskod, sektorsöversikt och SKR-referensen.
 *
 * Utbrutet ur smoke.test.js så att Vitest fördelar röktesterna över flera arbetare; varje describe-block
 * skapar sina egna fönster via createAppWindow (tests/helpers/app-harness.js).
 */
import { describe, it, expect } from 'vitest';
import { createAppWindow } from './helpers/app-harness.js';

describe('sektorsöversikten', () => {
    it('kortet visar en rad per sektor med demot, i prefixordning', () => {
        const w = createAppWindow();
        w.__loadDemoData();
        w.__renderTabContent('struktur');
        const rader = [...w.document.querySelectorAll('#sektor-table tbody tr')].map(tr => tr.querySelector('.sektor-namn').textContent.trim());
        expect(rader).toEqual(['Vård- och omsorgsarbete med mera', 'Förskole-, skol-, fritids- och annan pedagogisk verksamhet', 'Teknikarbete']);
        expect(w.document.getElementById('struktur-sektorer').textContent).toMatch(/på att kvinnor och män arbetar i olika huvudområden/);
        expect(w.document.getElementById('chart-sektorer')._figur.lager.map(l => l.serie)).toEqual(['Förklaras av ålder och BAS', 'Rå', 'Justerad (ålder, BAS)']);
    });
    it('lönefil utan ålder: ett justerat tal per huvudområde, rubriken säger BAS (ADR-78)', () => {
        const w = createAppWindow();
        w.__loadDemoData();
        w.__state.data = w.__state.data.map(r => ({ ...r, alder: 0 }));
        w.eval('invalidateStatCaches(); populateSelects(); unlockTabs();');
        w.__renderTabContent('struktur');
        const rubriker = [...w.document.querySelectorAll('#sektor-table thead th')].map(th => th.textContent.trim());
        expect(rubriker).toContain('Justerad (BAS)');
        expect(rubriker).not.toContain('Justerad (ålder, BAS)');
        expect(w.document.getElementById('sektor-table').textContent).not.toMatch(/För få/);
        expect(w.document.getElementById('chart-sektorer')._figur.lager.map(l => l.serie)).toEqual(['Förklaras av BAS', 'Rå', 'Justerad (BAS)']);
    });
    it('klick på en sektor öppnar Utforska med sektorn som villkor', () => {
        const w = createAppWindow();
        w.__loadDemoData();
        w.__renderTabContent('struktur');
        w.document.querySelector('#sektor-table [data-sektor="Teknikarbete"]').click();
        const u = w.eval('explorerUrval()').urval;
        expect(u.villkor).toEqual([expect.objectContaining({ falt: 'sektor', op: 'enAv', varde: ['Teknikarbete'] })]);
        expect(w.document.getElementById('explore-rad').value).toBe('aid');
    });
});

describe('Utforska: slå ihop små yrkesgrupper', () => {
    const w = createAppWindow();
    const p = (aid, label, n) => Array.from({ length: n }, (_, i) => ({ aid, yrke: `${aid} ${label}`, yrkeLabel: label, bas: 'C',
        kon: i % 2 ? 'man' : 'kvinna', lon: 30000 + i * 37, alder: 30 + i, radnr: i + 2 }));
    w.__state.data = [...p('207011', 'Usk', 24), ...p('207024', 'Vb', 5), ...p('207009', 'Usk hemtj', 7), ...p('502010', 'Sysutv', 22)];
    w.eval('populateSelects(); unlockTabs();');
    const d = w.document;
    const satt = (id, v) => { d.getElementById(id).value = v; };
    it('rutan syns bara när raderna är yrkesgrupper', () => {
        w.__renderTabContent('utforska');
        satt('explore-rad', 'bas'); w.__renderExplorer();
        expect(d.getElementById('explore-sla-ihop-rad').hidden).toBe(true);
        satt('explore-rad', 'aid'); w.__renderExplorer();
        expect(d.getElementById('explore-sla-ihop-rad').hidden).toBe(false);
    });
    it('ikryssad: små yrken i samma AID-mellannivå visas som en grupp (i exportläget; på skärmen är inga grupper små, ADR-51)', () => {
        satt('explore-rad', 'aid'); satt('explore-kolumn', 'ingen');
        d.getElementById('explore-sla-ihop').checked = true;
        w.__state.kLage = 'export';
        w.__renderExplorer();
        expect(d.getElementById('explore-table').textContent).toMatch(/Övriga i AID 2070xx \(2 AID-etiketter\)/);
        d.getElementById('explore-sla-ihop').checked = false;
        w.__renderExplorer();
        expect(d.getElementById('explore-table').textContent).not.toMatch(/Övriga i/);
        w.__state.kLage = 'skarm';
    });
    it('klick på en hopslagen grupp förklarar sammanslagningen, inte "under 10"', () => {
        satt('explore-rad', 'aid'); satt('explore-kolumn', 'ingen');
        d.getElementById('explore-sla-ihop').checked = true;
        w.__renderExplorer();
        w.eval(`explorerHandleClick({ rad: 'Övriga i AID 2070xx (2 AID-etiketter)', kol: null })`);
        const not = d.getElementById('explore-note').textContent;
        expect(not).toMatch(/slagits ihop av flera små AID-etiketter/);
        expect(not).not.toMatch(/minst 10 personer/);
        d.getElementById('explore-sla-ihop').checked = false;
    });
    it('Lika arbete påverkas aldrig av hopslagningen', () => {
        d.getElementById('explore-sla-ihop').checked = true;
        w.__renderExplorer();
        w.__renderTabContent('matrix');
        expect(d.getElementById('matrix-table').textContent).not.toMatch(/Övriga i/);
    });
});

describe('ansvarskod i dossiern, Personer att granska och demot', () => {
    it('demot har ansvarskoder och en ansvarskolumn', () => {
        const w = createAppWindow();
        w.__loadDemoData();
        expect(w.__state.ansvarKolumn).toMatchObject({ namn: 'Ansvarskod (demo)' });
        const grupper = new Set(w.__state.data.map(r => r.ansvarsgrupp));
        expect([...grupper].sort()).toEqual(['inget', 'ledning', 'uppdrag']);
        expect(w.__state.data.filter(r => r.ansvarsgrupp === 'ledning').length).toBeGreaterThanOrEqual(10);
    });
    it('demots huvudtal i regressionen är detsamma med och utan ansvaret', () => {
        const w = createAppWindow();
        w.__loadDemoData();
        const med = w.eval('runOLSRegression()');
        w.__state.data.forEach(r => { r.ansvarsgrupp = null; r.ansvarskoder = null; });
        const utan = w.eval('runOLSRegression()');
        expect(med.konPct).toBeCloseTo(utan.konPct, 10);
        expect(med.ansvarSteg).toMatchObject({ status: 'ok' });
        expect(utan.ansvarSteg).toBeNull();
    });
    it('dossiern visar antal per ansvarsgrupp och kön, aldrig lön per ansvarsgrupp', () => {
        const w = createAppWindow();
        w.__loadDemoData();
        const kand = w.__gruppdossierCandidates().find(c => c.rows.some(r => r.ansvarsgrupp === 'ledning'));
        const d = w.__buildGruppdossier(kand.key);
        const nLed = kand.rows.filter(r => r.ansvarsgrupp === 'ledning');
        expect(d.ansvar).toMatchObject({ ledning: { kv: nLed.filter(r => r.kon === 'kvinna').length, ma: nLed.filter(r => r.kon === 'man').length } });
        const html = w.eval(`_gdRenderBody(__buildGruppdossier(${JSON.stringify(kand.key)}))`);
        expect(html).toMatch(/Ledningsansvar \d+ kv \/ \d+ män/);
        expect(w.__gruppdossierAsText(d)).toMatch(/Ansvar: ledningsansvar \d+ kvinnor \/ \d+ män · särskilt uppdrag \d+ kvinnor \/ \d+ män/);
    });
    it('dossiern utan ansvarskolumn har ingen ansvarsrad', () => {
        const w = createAppWindow();
        w.__loadDemoData();
        w.__state.data.forEach(r => { r.ansvarsgrupp = null; r.ansvarskoder = null; });
        w.__state.ansvarKolumn = null;
        const key = w.__gruppdossierCandidates()[0].key;
        expect(w.__buildGruppdossier(key).ansvar).toBeNull();
        expect(w.eval(`_gdRenderBody(__buildGruppdossier(${JSON.stringify(key)}))`)).not.toMatch(/Ledningsansvar/);
    });
    it('Personer att granska har kolumnen Ansvar bara när ansvarskolumnen finns', () => {
        const w = createAppWindow();
        w.__loadDemoData();
        w.eval('renderPersonerAttGranska(true)');
        const rubriker = () => [...w.document.querySelectorAll('#pag-tabell thead th')].map(th => th.textContent);
        expect(rubriker()).toContain('Ansvar');
        expect([...w.document.querySelectorAll('#pag-tabell tbody tr')].every(tr => tr.children.length === rubriker().length)).toBe(true);
        w.__state.ansvarKolumn = null;
        w.eval('renderPersonerAttGranska(true)');
        expect(rubriker()).not.toContain('Ansvar');
    });
});

describe('Underlagets kvalitet: AID-kodningen', () => {
    it('demot ger OK på alla AID-kriterier och de finns med i bedömningen', () => {
        const w = createAppWindow();
        w.__loadDemoData();
        const b = w.eval('bedomningUnderlag()');
        const aid = b.kriterier.filter(c => c.id.startsWith('aid-'));
        expect(aid.map(c => c.id)).toEqual(['aid-okanda', 'aid-restkoder', 'aid-spridning', 'aid-ledning-utan-ansvar', 'aid-otillaten-ansvarskod']);
        expect(aid.filter(c => c.status !== 'ok').map(c => c.text)).toEqual([]);
    });
    it('okända koder ger varning i bedömningen', () => {
        const w = createAppWindow();
        w.__state.data = Array.from({ length: 30 }, (_, i) => ({ aid: i < 3 ? '751010' : '207011', yrke: 'x', bas: 'C', kon: i % 2 ? 'man' : 'kvinna', lon: 30000 + i * 10, alder: 30 + i }));
        const b = w.eval('bedomningUnderlag()');
        expect(b.kriterier.find(c => c.id === 'aid-okanda').status).toBe('varning');
        expect(b.status).not.toBe('ok');
    });
});

describe('AID: metodtext enligt handboken', () => {
    it('Om verktyget förklarar AID, sektorerna och etikettlistans version och källa, utan §', () => {
        const w = createAppWindow();
        w.document.querySelector('.nav-item[data-tab="info"]').click();
        w.eval("renderInfoTab('metodik')");
        const avsnitt = w.document.getElementById('om-aid');
        expect(avsnitt).not.toBeNull();
        const t = avsnitt.textContent.replace(/\s+/g, ' ');
        expect(t).toMatch(/inte ett arbetsvärderingssystem/);
        expect(t).toMatch(/2026-09-23/);
        expect(t).toMatch(/SKR/);
        expect(t).toMatch(/232 etiketter/);
        expect(t).toMatch(/Ledningsansvar.*Särskilt uppdrag/);
        expect(t).not.toMatch(/§/);
    });
    it('Lika arbete har en not om AID-grupperna som utgångspunkt', () => {
        const w = createAppWindow();
        const p = w.document.getElementById('la-aid-bakgrund');
        expect(p?.textContent).toMatch(/utgångspunkt/);
        expect(p.textContent).toMatch(/inte ett arbetsvärderingssystem/);
    });
    it('Word-utkastets avsnitt Lika arbete innehåller metodtexten', () => {
        const w = createAppWindow();
        w.__loadDemoData();
        const html = w.__docDraftHtml();
        const lika = html.slice(html.indexOf('Lika arbete — kvinnor och män i samma AID-etikett och BAS-intervall'), html.indexOf('Likvärdigt arbete — kvinnodominerade AID-etiketter'));
        expect(lika).toMatch(/AID är inte ett arbetsvärderingssystem/);
    });
});

describe('sektorsöversiktens punkter i Att göra', () => {
    it('räknas ur samma punkter som hela listan, också likvärdighetsparen, utan att bygga hela listan', async () => {
        const { sektorsnamn } = await import('../src/lib/aid.js');
        const w = createAppWindow();
        w.__loadDemoData();
        const alla = w.eval('buildActionChecklist()');
        const grupp = w.eval('buildActionChecklist({ endastGrupper: true })');
        const medAid = alla.filter(it => it.aid);
        expect(medAid.some(it => it.id.startsWith('lv-'))).toBe(true);
        expect(grupp.map(it => it.id).sort()).toEqual(medAid.map(it => it.id).sort());
        const vantat = {};
        for (const it of medAid) { const s = sektorsnamn(it.aid); vantat[s] = (vantat[s] || 0) + 1; }
        expect(w.eval('_sektorPunkter()')).toEqual(vantat);
    });
});

describe('SKR:s kvinnoandel som referensvärde bredvid organisationens egen fördelning', () => {
    const w = createAppWindow();
    w.__loadDemoData();
    const rubriker = id => [...w.document.querySelectorAll(`#${id} thead th`)].map(th => th.textContent.trim());
    const kol = (id, namn) => rubriker(id).indexOf(namn);
    it('Lika arbete: kolumnen "Kvinnor nationellt" per yrke, och underraderna följer kolumnantalet', async () => {
        const { skrKvinnoandel } = await import('../src/lib/skrreferens.js');
        w.__renderTabContent('matrix');
        const i = kol('matrix-table', 'Kvinnor nationellt');
        expect(i).toBeGreaterThan(-1);
        const tr = [...w.document.querySelectorAll('#matrix-table tbody tr')].find(t => /^207011/.test(t.children[0].textContent.trim()));
        expect(tr.children[i].textContent.trim()).toBe(`${skrKvinnoandel('207011', { del: 'kommun' }).pct.toFixed(0)}\u00a0%`);   // demot är en kommun
        const antal = rubriker('matrix-table').length;
        // Hela bredden räknas med data-hel-colspan; i grundvyn (Fler kolumner av) täcker de synliga cellerna de synliga kolumnerna.
        const synligaRubriker = [...w.document.querySelectorAll('#matrix-table thead th')].filter(th => !th.hidden).length;
        expect(synligaRubriker).toBeLessThan(antal);
        for (const u of w.document.querySelectorAll('#matrix-table tr.la-underrad')) {
            const bredd = [...u.children].reduce((s, td) => s + (+(td.getAttribute('data-hel-colspan') || td.getAttribute('colspan')) || 1), 0);
            expect(bredd).toBe(antal);
            const synlig = [...u.children].filter(td => !td.hidden).reduce((s, td) => s + (+td.getAttribute('colspan') || 1), 0);
            expect(synlig).toBe(synligaRubriker);
        }
    });
    it('sektorsöversikten: kolumnen "Kvinnor nationellt" per sektor', async () => {
        const { skrKvinnoandelSektor } = await import('../src/lib/skrreferens.js');
        w.__renderTabContent('struktur');
        const i = kol('sektor-table', 'Kvinnor nationellt');
        expect(i).toBeGreaterThan(-1);
        const tr = [...w.document.querySelectorAll('#sektor-table tbody tr')].find(t => /Teknikarbete/.test(t.textContent));
        expect(tr.children[i].textContent.trim()).toBe(`${skrKvinnoandelSektor('Teknikarbete', { del: 'kommun' }).pct.toFixed(1).replace('.', ',')}\u00a0%`);
    });
    it('Likvärdigt arbete: organisationens yrkeslistor har "% kvinnor, SKR"', () => {
        w.__renderTabContent('likvardighet');
        const th = [...w.document.querySelectorAll('#likvardighet-content thead th')].map(t => t.textContent.trim());
        expect(th.filter(t => t === '% kvinnor, SKR').length).toBeGreaterThanOrEqual(1);
    });
    it('gruppdossiern visar SKR:s kvinnoandel för AID-etiketten', () => {
        const key = w.__gruppdossierCandidates().find(c => c.aid === '207011').key;
        const d = w.__buildGruppdossier(key);
        expect(d.skr).toMatchObject({ niva: 'etikett' });
        expect(w.eval(`_gdRenderBody(__buildGruppdossier(${JSON.stringify(key)}))`)).toMatch(/nationellt: \d+\s% kvinnor i kommuner</);
        expect(w.__gruppdossierAsText(d)).toMatch(/Nationell referens: \d+\s% kvinnor/);
    });
    it('Om verktyget anger SKR:s personalstatistik som källa', () => {
        w.document.querySelector('.nav-item[data-tab="info"]').click();
        w.eval("renderInfoTab('references')");
        expect(w.document.getElementById('view-info').textContent).toMatch(/SKR, personalstatistik november 2025/);
    });
});

describe('organisationstyp: kommun eller region styr SKR-referensen (ADR-34)', () => {
    const skr = async () => (await import('../src/lib/skrreferens.js'));
    const matrisCell = w => {
        w.__renderTabContent('matrix');
        const i = [...w.document.querySelectorAll('#matrix-table thead th')].map(t => t.textContent.trim()).indexOf('Kvinnor nationellt');
        const tr = [...w.document.querySelectorAll('#matrix-table tbody tr')].find(t => /^207011/.test(t.children[0].textContent.trim()));
        return tr.children[i].textContent.trim();
    };
    it('valet finns i organisationspaketets panel; demot är en kommun', async () => {
        const { skrKvinnoandel } = await skr();
        const w = createAppWindow();
        const sel = w.document.getElementById('org-typ');
        expect([...sel.options].map(o => o.value)).toEqual(['alla', 'kommun', 'region']);
        expect(sel.value).toBe('alla');
        w.__loadDemoData();
        expect(sel.value).toBe('kommun');
        expect(matrisCell(w)).toBe(`${skrKvinnoandel('207011', { del: 'kommun' }).pct.toFixed(0)}\u00a0%`);
    });
    it('byte till region ritar om med regionernas andel och rätt text', async () => {
        const { skrKvinnoandel } = await skr();
        const w = createAppWindow();
        w.__loadDemoData();
        const sel = w.document.getElementById('org-typ');
        sel.value = 'region';
        sel.dispatchEvent(new w.Event('change'));
        expect(w.__state.profile.orgTyp).toBe('region');
        expect(matrisCell(w)).toBe(`${skrKvinnoandel('207011', { del: 'region' }).pct.toFixed(0)}\u00a0%`);
        const key = w.__gruppdossierCandidates().find(c => c.aid === '207011').key;
        expect(w.__gruppdossierAsText(w.__buildGruppdossier(key))).toMatch(/Nationell referens: \d+\s% kvinnor i regioner/);
    });
    it('konfigurationsfilen bär organisationstypen', () => {
        const w = createAppWindow();
        w.__loadDemoData();
        const cfg = w.__buildConfigSnapshot();
        expect(cfg.ui.orgTyp).toBe('kommun');
        const w2 = createAppWindow();
        w2.__applyConfigSnapshot({ ...cfg, ui: { ...cfg.ui, orgTyp: 'region' } });
        expect(w2.__state.profile.orgTyp).toBe('region');
        expect(w2.document.getElementById('org-typ').value).toBe('region');
        w2.__applyConfigSnapshot({ ...cfg, ui: { ...cfg.ui, orgTyp: 'stat' } });
        expect(w2.__state.profile.orgTyp).toBe('region');   // okänt värde ignoreras
    });
    it('Rensa all data återställer till båda', () => {
        const w = createAppWindow();
        w.__loadDemoData();
        w.eval('_rensaAllData()');
        expect(w.document.getElementById('org-typ').value).toBe('alla');
    });
});

describe('samlad jämförelseexport: ställningstagandet per AID och BAS som i tabellen', () => {
    it('en AID-specifik rad i ställningstagandet används i exporten', async () => {
        const { readFileSync } = await import('node:fs');
        const { join, dirname } = await import('node:path');
        const { fileURLToPath } = await import('node:url');
        const w = createAppWindow();
        w.eval(readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'vendor', 'xlsx.mini.min.js'), 'utf8'));
        w.__state.data = Array.from({ length: 12 }, (_, i) => ({ aid: '207011', yrke: '207011 Usk', yrkeLabel: 'Usk', bas: 'C', kon: i % 2 ? 'man' : 'kvinna', lon: 30000 + i * 100, alder: 40 }));
        w.__state.policy = [{ aid: null, bas: 'C', p10: 28000, med: 31000, p90: 35000 }, { aid: '207011', bas: 'C', p10: 29000, med: 32222, p90: 36000 }];
        w.eval('populateSelects(); unlockTabs();');
        const fangat = {};
        w.XLSX.writeFile = (wb, namn) => { fangat[namn] = wb; };
        w.eval('exportBenchmarkExcel()');
        const wb = Object.values(fangat)[0];
        const rad = w.XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: true })[2];
        expect(rad[20]).toBe(32222);   // ställningstagandets median (efter kolumnen Matchning)
    });
});

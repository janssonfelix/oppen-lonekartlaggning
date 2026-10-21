/**
 * Röktest (jsdom): Jämförelsestatistik, organisationens namn och Översikt.
 *
 * Utbrutet ur smoke.test.js så att Vitest fördelar röktesterna över flera arbetare; varje describe-block
 * skapar sina egna fönster via createAppWindow (tests/helpers/app-harness.js).
 */
import { describe, it, expect } from 'vitest';
import { createAppWindow } from './helpers/app-harness.js';

describe('Jämförelsestatistik: tre block, källa och filter', () => {
    const oppna = () => { const w = createAppWindow(); w.__loadDemoData(); w.__renderTabContent('benchmark'); return w; };
    const rubriker = w => [...w.document.querySelectorAll('#benchmark-table thead th')].map(t => t.textContent.trim());
    const rad = (w, aid, bas) => w.document.querySelector(`#benchmark-table tbody tr[data-rad="${aid}|${bas}"]`);
    it('rubrikerna har P10, median och P90 med Org, Jmf och Diff', () => {
        const w = oppna();
        const org = w.eval("orgNamn('org')");   // demot heter Exempelkommunen (ADR-36)
        expect(rubriker(w)).toEqual(['Yrke', 'BAS', 'N', `P10 ${org}`, 'P10 jmf', 'P10 diff', `Median ${org}`, 'Median jmf', 'Median diff',
            `P90 ${org}`, 'P90 jmf', 'P90 diff']);
        expect(w.document.querySelectorAll('.benchmark-metric-btn[data-metric]').length).toBe(0);
    });
    it('värdena stämmer med modulen för ett demoyrke, och reglaget byter källa', () => {
        const w = oppna();
        const u = w.eval('jamforelseUnderlag()').rader.find(r => r.stallningstagande.median !== null);
        const tr = rad(w, u.aid, u.bas);
        const kr = v => new Intl.NumberFormat('sv-SE', { style: 'currency', currency: 'SEK', maximumFractionDigits: 0 }).format(Math.round(v));
        expect(tr.children[6].textContent.trim()).toBe(kr(u.org.median));
        w.document.querySelector('.benchmark-metric-btn[data-kalla="stallningstagande"]').click();
        expect(w.eval('jamforelseVal()').kalla).toBe('stallningstagande');
        expect(rad(w, u.aid, u.bas).children[7].textContent.trim()).toBe(kr(u.stallningstagande.median));
        expect(w.document.getElementById('benchmark-metric-info').textContent).toMatch(/Jmf = /);
    });
    it('filtren avgränsar tabellen; okänt val faller tillbaka till Alla', () => {
        const w = oppna();
        const bas = w.document.getElementById('jmf-bas');
        const valt = [...bas.options].map(o => o.value).find(v => v);
        bas.value = valt; bas.dispatchEvent(new w.Event('change'));
        const synliga = [...w.document.querySelectorAll('#benchmark-table tbody tr[data-rad]')];
        expect(synliga.length).toBeGreaterThan(0);
        expect(synliga.every(t => t.dataset.rad.endsWith('|' + valt))).toBe(true);
        w.eval("jamforelseSattVal({ bas: 'Z', sektor: 'Finns inte' }); generateBenchmark();");
        expect(w.eval('jamforelseVal()')).toMatchObject({ bas: '', sektor: '' });
    });
    it('sektorfiltret avgränsar; en sektor som försvinner ur datan faller tillbaka till Alla', () => {
        const w = oppna();
        w.eval("jamforelseSattVal({ sektor: 'Teknikarbete' }); generateBenchmark();");
        const rader = w.eval('jamforelseUnderlag()').rader.filter(r => r.sektor === 'Teknikarbete');
        expect(w.document.querySelectorAll('#benchmark-table tbody tr[data-rad]').length).toBe(rader.length);
        w.__state.data = w.__state.data.filter(r => !/^50/.test(r.aid));
        w.eval('generateBenchmark()');
        expect(w.eval('jamforelseVal()').sektor).toBe('');
    });
    it('"Inga yrken i urvalet" när BAS och sektor inte har något gemensamt yrke', () => {
        const w = oppna();
        const alla = w.eval('jamforelseUnderlag()').rader;
        const baser = [...new Set(alla.map(r => r.bas))], sektorer = [...new Set(alla.map(r => r.sektor))];
        const par = baser.flatMap(b => sektorer.map(s => [b, s])).find(([b, s]) => !alla.some(r => r.bas === b && r.sektor === s));
        expect(par).toBeTruthy();
        w.eval(`jamforelseSattVal({ bas: ${JSON.stringify(par[0])}, sektor: ${JSON.stringify(par[1])} }); generateBenchmark();`);
        expect(w.document.getElementById('benchmark-table').textContent).toMatch(/Inga yrken i urvalet/);
    });
    it('bara ställningstagandet inläst: statistikknappen är gråmarkerad och ställningstagandet valt', () => {
        const w = createAppWindow();
        w.__loadDemoData();
        w.__state.statistik = [];
        w.__renderTabContent('benchmark');
        const btn = w.document.querySelector('.benchmark-metric-btn[data-kalla="statistik"]');
        expect(btn.getAttribute('aria-disabled')).toBe('true');
        expect(btn.title).toMatch(/Inte inläst/);
        btn.click();
        expect(w.eval('jamforelseAktivKalla()')).toBe('stallningstagande');
        expect(w.eval('jamforelseAktivKalla()')).toBe('stallningstagande');
        expect(w.document.querySelectorAll('#benchmark-table tbody tr[data-rad]').length).toBeGreaterThan(0);
    });
    it('jamforelseMarkeraRad markerar raden', () => {
        const w = oppna();
        const u = w.eval('jamforelseUnderlag()').rader[0];
        expect(w.eval(`jamforelseMarkeraRad(${JSON.stringify(u.aid)}, ${JSON.stringify(u.bas)})`)).toBe(true);
        expect(rad(w, u.aid, u.bas).classList.contains('row-highlighted')).toBe(true);
        expect(w.eval("jamforelseMarkeraRad('999999', 'Q')")).toBe(false);
    });
    it('valen följer med konfigurationsfilen; okänd källa ignoreras; Rensa återställer', () => {
        const w = oppna();
        w.eval("jamforelseSattVal({ kalla: 'stallningstagande', bas: 'C', sektor: 'Teknikarbete' })");
        const cfg = w.__buildConfigSnapshot();
        expect(cfg.ui.jamforelse).toEqual({ kalla: 'stallningstagande', bas: 'C', sektor: 'Teknikarbete' });
        const w2 = oppna();
        w2.__applyConfigSnapshot({ ...cfg, ui: { ...cfg.ui, jamforelse: { kalla: 'hack', bas: 'C', sektor: '' } } });
        expect(w2.eval('jamforelseVal()')).toMatchObject({ kalla: 'statistik', bas: 'C' });
        w2.eval('_rensaAllData()');
        expect(w2.eval('jamforelseVal()')).toEqual({ kalla: 'statistik', bas: '', sektor: '' });
    });
});

describe('Jämförelsestatistik: diagrammen', () => {
    const oppna = () => { const w = createAppWindow(); w.__loadDemoData(); w.__renderTabContent('benchmark'); return w; };
    it('båda diagrammen har data, rubrik och aria-label', () => {
        const w = oppna();
        for (const id of ['chart-jamforelse-spann', 'chart-jamforelse-avvikelse']) {
            const el = w.document.getElementById(id);
            const svg = el.querySelector(':scope > svg[role="group"]');
            expect(svg.querySelector('[role="img"]')).not.toBeNull();
            expect(svg.getAttribute('aria-label').length).toBeGreaterThan(40);
            expect(el._figur.lager.length).toBeGreaterThan(0);
        }
        expect(w.document.getElementById('jmf-diagram').textContent).toMatch(/Var ligger vi i marknadens spann\?/);
        expect(w.document.getElementById('jmf-diagram').textContent).toMatch(/Vilka yrken avviker mest\?/);
    });
    it('spannet: organisationens band och median per yrke i urvalet', () => {
        const w = oppna();
        const rader = w.eval('jamforelseUnderlag()').rader;
        const el = w.document.getElementById('chart-jamforelse-spann');
        const org = el._figur.lager.find(l => l.serie === `${w.eval('orgNamn()')} P10–P90`);
        expect(org.marke).toBe('intervall');
        expect(org.data.length).toBe(Math.min(25, rader.length));
        const r = rader.find(x => org.data.some(p => p.y === `${x.yrke} · BAS ${x.bas}`));
        const p = org.data.find(q => q.y === `${r.yrke} · BAS ${r.bas}`);
        expect(p.lag).toBeCloseTo(r.org.p10, 6);
        expect(p.hog).toBeCloseTo(r.org.p90, 6);
    });
    it('avvikelsen: rangordnad, etikett med tecken, customdata och klick markerar raden', () => {
        const w = oppna();
        const el = w.document.getElementById('chart-jamforelse-avvikelse');
        const li = el._figur.lager.findIndex(l => l.serie === 'Skillnad i median'), median = el._figur.lager[li];
        const x = median.data.map(p => p.x);
        expect([...x].sort((a, b) => a - b)).toEqual([...x]);
        expect(el._figur.lager.find(l => l.serie === 'Medianens värde').data.every(p => /^[+−]\d+,\d %$/.test(p.etikett))).toBe(true);
        const { aid, bas } = median.data[0];
        // Klick på första medianpunkten (ritad i samma ordning som datan) markerar yrkets rad.
        el.querySelector(`[data-marke="punkt"][data-l="${li}"][data-i="0"]`).dispatchEvent(new w.Event('click', { bubbles: true }));
        expect(w.document.querySelector(`#benchmark-table tr[data-rad="${aid}|${bas}"]`).classList.contains('row-highlighted')).toBe(true);
    });
    it('fler än 25 yrken: 25 i diagrammen och en not', () => {
        const w = createAppWindow();
        const data = [];
        for (let y = 0; y < 30; y++) for (let i = 0; i < 10; i++)
            data.push({ aid: String(207000 + y), yrke: `${207000 + y} Yrke ${y}`, yrkeLabel: 'Y', bas: 'C', kon: i % 2 ? 'man' : 'kvinna', lon: 30000 + y * 100 + i * 50, alder: 40 });
        w.__state.data = data;
        w.__state.statistik = Array.from({ length: 30 }, (_, y) => ({ aid: String(207000 + y), bas: 'C', median: 31000, p10: 29000, p90: 34000 }));
        w.eval('populateSelects(); unlockTabs();');
        w.__renderTabContent('benchmark');
        expect(w.document.getElementById('chart-jamforelse-spann')._figur.y.ordning.length).toBe(25);
        expect(w.document.getElementById('jmf-spann-not').textContent).toMatch(/de 25 största yrkena av 30/);
        expect(w.document.querySelectorAll('#benchmark-table tbody tr[data-rad]').length).toBe(30);
    });
    it('bara ställningstagandet: diagrammen ritas mot ställningstagandet', () => {
        const w = createAppWindow();
        w.__loadDemoData();
        w.__state.statistik = [];
        w.__renderTabContent('benchmark');
        expect(w.document.getElementById('chart-jamforelse-avvikelse')._figur.lager.length).toBeGreaterThan(0);
    });
});

describe('Jämförelsestatistik: exporten säger vilken källa jmf-kolumnerna är', () => {
    it('Excel-rubrikerna för jmf-kolumnerna namnger den valda källan', () => {
        const w = createAppWindow();
        w.__loadDemoData();
        w.__state.statistik = w.__state.data.slice(0, 1).map(r => ({ aid: r.aid, bas: r.bas, median: 30000 }));
        w.__renderTabContent('benchmark');
        // Excelexporten läser rubrikerna ur den rensade klonen (data-export-label).
        const rubriker = () => [...w.eval("_cloneAndCleanTableForExport('benchmark-table')").querySelectorAll('thead th')].map(t => t.textContent.trim()).join(' | ');
        expect(rubriker()).toMatch(/P10 jämförelsestatistiken \(kr\/mån\).*Median jämförelsestatistiken \(kr\/mån\).*P90 jämförelsestatistiken \(kr\/mån\)/);
        w.document.querySelector('.benchmark-metric-btn[data-kalla="stallningstagande"]').click();
        const namn = w.eval('referensKortnamn()');
        expect(rubriker()).toContain(`Median ${namn} (kr/mån)`);
        expect(rubriker()).toContain(`Median skillnad mot ${namn} (%)`);
        expect(rubriker()).not.toMatch(/jämförelsestatistiken/);
    });
});

describe('namn på organisationen och jämförelsestatistiken', () => {
    it('standard utan namn; namn sätts, genitiv räknas fram, tomt återställer', () => {
        const w = createAppWindow();
        expect(w.eval("orgNamn()")).toBe('Organisationen');
        expect(w.eval("orgNamn('org.')")).toBe('org.');
        expect(w.eval("jmfNamn('jämförelsestatistiken')")).toBe('jämförelsestatistiken');
        expect(w.eval("sattOrgNamn('  Hallsbergs kommun ')").ok).toBe(true);
        expect(w.eval("orgNamn('org.')")).toBe('Hallsbergs kommun');
        expect(w.eval("sattJmfNamn('SKR:s statistik')").ok).toBe(true);
        expect(w.__state.profile).toMatchObject({ benchmarkLabel: 'SKR:s statistik', benchmarkLabelGenitive: 'SKR:s statistiks', benchmarkShort: 'SKR:s statistik' });
        w.eval("sattOrgNamn(''); sattJmfNamn('')");
        expect(w.eval("orgNamn()")).toBe('Organisationen');
        expect(w.__state.profile.benchmarkLabel).toBe('jämförelsestatistiken');
    });
    it('personnummer eller e-post avvisas i alla tre namnen', () => {
        const w = createAppWindow();
        w.eval("sattOrgNamn('Kommunen')");
        const r = w.eval("sattOrgNamn('Anna 19800101-1234')");
        expect(r.ok).toBe(false);
        expect(r.fel).toMatch(/personnummer/);
        expect(w.eval("orgNamn()")).toBe('Kommunen');
        expect(w.eval("sattJmfNamn('a@b.se')").ok).toBe(false);
        w.__state.policy = [{ bas: 'C', p10: 1, med: 2, p90: 3 }];
        w.__state.policyNamn = 'Min referens';
        expect(w.eval("sattReferensNamn('19800101-1234')").ok).toBe(false);
        expect(w.__state.policyNamn).toBe('Min referens');
    });
    it('Dokumentera-fältet och profilen följer varandra; konfigurationsfilen bär namnen', () => {
        const w = createAppWindow();
        w.eval("sattOrgNamn('Exempelregionen'); sattJmfNamn('Regionstatistiken')");
        expect(w.document.getElementById('kl-org-name').value).toBe('Exempelregionen');
        const kl = w.document.getElementById('kl-org-name');
        kl.value = 'Ny region'; kl.dispatchEvent(new w.Event('change'));
        expect(w.eval("orgNamn()")).toBe('Ny region');
        const cfg = w.__buildConfigSnapshot();
        expect(cfg.orgName).toBe('Ny region');
        expect(cfg.jmfNamn).toBe('Regionstatistiken');
        const w2 = createAppWindow();
        w2.__applyConfigSnapshot(cfg);
        expect(w2.eval("orgNamn()")).toBe('Ny region');
        expect(w2.eval("jmfNamn()")).toBe('Regionstatistiken');
    });
    it('demot sätter Exempelkommunen; Rensa och ett paket ersätter', () => {
        const w = createAppWindow();
        w.__loadDemoData();
        expect(w.eval("orgNamn()")).toBe('Exempelkommunen');
        w.eval('_rensaAllData()');
        expect(w.eval("orgNamn()")).toBe('Organisationen');
        expect(w.eval("jmfNamn()")).toBe('Jämförelsestatistiken');
        w.eval("sattOrgNamn('Mitt namn')");
        const paket = JSON.stringify({ format: 'lonekartlaggning-organisationspaket', version: 1, organisation: { namn: 'Paketkommunen' }, skapat: '2026-09-28',
            profil: { jamforelseNamn: 'Paketstatistiken' }, referens: { rader: [{ bas: 'C', p10: 1, med: 2, p90: 3 }] } });
        w.eval(`lasInPaket(${JSON.stringify(paket)}, 'p.json')`);
        expect(w.eval("orgNamn()")).toBe('Paketkommunen');
        expect(w.eval("jmfNamn()")).toBe('Paketstatistiken');
    });
});

describe('Översikt: ordning, kvalitet och nyckeltal', () => {
    it('nyckeltal → Att göra → processen → kvaliteten → löneskillnaden', () => {
        const w = createAppWindow();
        w.__loadDemoData();
        const d = w.document;
        const ids = ['dashboard-summary', 'att-gora', 'process-tracker', 'underlagets-kvalitet', 'gap-uppdelning'];
        const pos = ids.map(id => d.getElementById(id));
        for (let i = 1; i < pos.length; i++) {
            expect(pos[i - 1].compareDocumentPosition(pos[i]) & w.Node.DOCUMENT_POSITION_FOLLOWING, `${ids[i - 1]} före ${ids[i]}`).toBeTruthy();
        }
    });
    it('kvaliteten sammanfattad; ihopfälld när allt är OK, utfälld vid varning; konsistensen inuti', () => {
        const w = createAppWindow();
        w.__loadDemoData();   // demot har en varning (jämförbarhet)
        const d = w.document;
        const fall = d.getElementById('uk-fallbar');
        expect(fall.tagName).toBe('DETAILS');
        expect(fall.open).toBe(true);
        expect(d.getElementById('uk-sammanfattning').textContent).toMatch(/\d+ av \d+ kriterier OK/);
        expect(d.getElementById('uk-sammanfattning').textContent).toMatch(/Jämförbarhet/);
        expect(fall.contains(d.getElementById('consistency-banner-container'))).toBe(true);
        w.eval("bedomningUnderlag = () => ({ status: 'ok', kriterier: [{ id: 'a', namn: 'A', status: 'ok', text: 'x' }] }); renderUnderlagetsKvalitet();");
        expect(fall.open).toBe(false);
        expect(d.getElementById('uk-sammanfattning').textContent).toMatch(/1 av 1 kriterier OK/);
    });
    it('nyckeltalen visar kvinnor och män i stället för antal BAS-intervall', () => {
        const w = createAppWindow();
        w.__loadDemoData();
        const d = w.document;
        expect(d.getElementById('stat-bas')).toBeNull();
        const kv = w.__state.data.filter(r => r.kon === 'kvinna').length, ma = w.__state.data.filter(r => r.kon === 'man').length;
        expect(d.getElementById('stat-kon').textContent.replace(/\s/g, '')).toBe(`${kv}/${ma}`);
        expect(d.getElementById('dashboard-summary').textContent).toMatch(/Kvinnor \/ män/);
    });
});

describe('namnen i etiketterna', () => {
    const oppna = () => {
        const w = createAppWindow();
        w.__loadDemoData();
        w.__state.statistik = w.__state.data.slice(0, 40).map(r => ({ aid: r.aid, bas: r.bas, median: 35000, p10: 31000, p90: 40000 }));
        w.__state.statistikHasP10 = w.__state.statistikHasP90 = true;
        w.eval("sattOrgNamn('Testkommunen'); sattJmfNamn('Teststatistiken')");
        return w;
    };
    const serier = (w, id) => ((w.document.getElementById(id)._figur || {}).lager || []).map(l => l.serie);
    it('diagramserier: Jämförelsestatistik, Lönepolitik, Ålder & karriär', () => {
        const w = oppna();
        w.__renderTabContent('benchmark');
        expect(serier(w, 'chart-jamforelse-spann')).toEqual(expect.arrayContaining(['Testkommunen P10–P90', 'Testkommunen median', 'Teststatistiken P10–P90']));
        w.__renderTabContent('lonepolitik');
        expect(serier(w, 'chart-lp-bandmap')).toContain('Testkommunen (P10–P90)');
    });
    it('tabellrubriker: Likvärdigt arbete och Jämförelsestatistik', () => {
        const w = oppna();
        w.__renderTabContent('likvardighet');
        const lv = w.document.getElementById('likvardighet-content').textContent;
        expect(lv).toMatch(/Median Testkommunen/);
        expect(lv).toMatch(/Kvinnodom\. yrke \(Testkommunen\)/);
        w.__renderTabContent('benchmark');
        const th = [...w.document.querySelectorAll('#benchmark-table thead th')].map(t => t.textContent.trim());
        expect(th).toContain('P10 Testkommunen');
        expect(th).toContain('Median Testkommunen');
    });
    it('utan namn: etiketterna som i dag', () => {
        const w = createAppWindow();
        w.__loadDemoData();
        w.eval("sattOrgNamn('')");   // demot heter Exempelkommunen
        w.__renderTabContent('likvardighet');
        expect(w.document.getElementById('likvardighet-content').textContent).toMatch(/Median org\./);
        w.__renderTabContent('lonepolitik');
        expect(serier(w, 'chart-lp-bandmap')).toContain('Organisationen (P10–P90)');
    });
    it('namn med <, & och %{x} visas som text', () => {
        const w = oppna();
        w.eval("sattOrgNamn('A<b>&%{x}')");
        w.__renderTabContent('likvardighet');
        expect(w.document.getElementById('likvardighet-content').innerHTML).not.toMatch(/<b>&/);
        expect(w.document.getElementById('likvardighet-content').textContent).toMatch(/Median A<b>&%\{x\}/);
    });
});

describe('Översikt och namn: namnfälten och kvalitetsdelen', () => {
    it('statistikens och referensens namn sätts alltid som text i diagrammets verktygstips', () => {
        const w = createAppWindow();
        w.__loadDemoData();
        w.__state.statistik = w.__state.data.slice(0, 40).map(r => ({ aid: r.aid, bas: r.bas, median: 35000, p10: 31000, p90: 40000 }));
        w.eval("sattJmfNamn('<img src=x onerror=alert(1)>')");
        for (const kalla of ['statistik', 'stallningstagande']) {
            w.eval(`jamforelseSattVal({ kalla: '${kalla}' })`);
            w.__renderTabContent('benchmark');
            // Diagramkärnan (ADR-39): namnet står i serien och i verktygstipset, och sätts alltid som text.
            const el = w.document.getElementById('chart-jamforelse-spann');
            expect(el.querySelector('img')).toBeNull();
            w.__el = el;
            const tips = el._figur.lager.map(l => w.eval('_rfTipsHtml')(l.tips(l.data[0]))).join('');
            expect(tips).not.toMatch(/<img/);
        }
    });
    it('ett avvisat namn visar felet vid fältet, i alla namnfält', () => {
        const w = createAppWindow();
        for (const id of ['org-namn', 'jmf-namn', 'kl-org-name']) {
            const el = w.document.getElementById(id);
            el.value = 'Anna 19800101-1234';
            el.dispatchEvent(new w.Event('change'));
            const fel = el.closest('.upload-cell, .ref-namn-rad, .namn-falt')?.querySelector('.upload-namn-fel');
            expect(fel, id).toBeTruthy();
            expect(fel.hidden, id).toBe(false);
            expect(fel.textContent, id).toMatch(/personnummer/);
        }
    });
    it('en konfigurationsfil utan namn raderar inte paketets namn', () => {
        const w = createAppWindow();
        const cfg = w.__buildConfigSnapshot();   // utan namn
        w.eval("sattOrgNamn('Paketkommunen'); sattJmfNamn('SKR-statistik')");
        w.__applyConfigSnapshot(cfg);
        expect(w.eval('orgNamn()')).toBe('Paketkommunen');
        expect(w.eval('jmfNamn()')).toBe('SKR-statistik');
    });
    it('en riktig lönefil efter demot bär inte demots namn eller ställningstagande', async () => {
        const { readFileSync } = await import('node:fs');
        const { join, dirname } = await import('node:path');
        const { fileURLToPath } = await import('node:url');
        const w = createAppWindow();
        w.eval(readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'vendor', 'papaparse.min.js'), 'utf8'));
        w.__loadDemoData();
        const rader = ['BAS;Månadslön;Ålder;Kön;AID'];
        for (let i = 0; i < 20; i++) rader.push(`A;${30000 + i};40;${i % 2 ? 'Man' : 'Kvinna'};5301`);
        w.__state.data = [];
        w.loadStructureFile(new w.File([rader.join('\n')], 'riktig.csv', { type: 'text/csv' }));
        for (let i = 0; i < 100 && w.__state.data.length !== 20; i++) await new Promise(r => setTimeout(r, 20));
        expect(w.__state.isDemo).toBe(false);
        expect(w.eval("orgNamn('')")).toBe('');
        expect(w.__state.policyKalla).not.toBe('demo');
        expect(w.document.getElementById('upload-cell-policy').classList.contains('loaded')).toBe(false);
    });
    it('en konsistensvarning fäller ut kvalitetsdelen även när kriterierna är OK', () => {
        const w = createAppWindow();
        w.__loadDemoData();
        w.eval("bedomningUnderlag = () => ({ status: 'ok', kriterier: [{ id: 'a', namn: 'A', status: 'ok', text: 'x' }] })");
        w.document.getElementById('consistency-banner-container').innerHTML = '<div class="consistency-banner warn">Filerna matchar inte</div>';
        w.eval('renderUnderlagetsKvalitet()');
        expect(w.document.getElementById('uk-fallbar').open).toBe(true);
    });
});

describe('Jämförelsestatistik, Översikt och namn: detaljer', () => {
    const vendor = async (w, fil) => {
        const { readFileSync } = await import('node:fs');
        const { join, dirname } = await import('node:path');
        const { fileURLToPath } = await import('node:url');
        w.eval(readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'vendor', fil), 'utf8'));
    };
    const medStatistik = () => {
        const w = createAppWindow();
        w.__loadDemoData();
        w.__state.statistik = w.__state.data.map(r => ({ aid: r.aid, bas: r.bas, median: 35000, p10: 31000, p90: 40000 }))
            .filter((s, i, a) => a.findIndex(x => x.aid === s.aid && x.bas === s.bas) === i);
        w.__state.statistikHasP10 = w.__state.statistikHasP90 = true;
        return w;
    };
    const audit = w => w.document.querySelector('[data-audit-id="benchmark"]').textContent.replace(/\s+/g, ' ');
    it('beräkningspanelen beskriver ställningstagandets matchning rätt', () => {
        const w = medStatistik();
        w.__renderTabContent('benchmark');
        expect(audit(w)).toMatch(/AID \+ BAS, annars AID, annars BAS/);
    });
    it('automatiskt källbyte flyttar tabbstoppet men skriver inte över det sparade valet', () => {
        const w = medStatistik();
        w.__state.policy = [];
        w.eval("jamforelseSattVal({ kalla: 'stallningstagande' })");
        w.__renderTabContent('benchmark');
        expect(w.eval('jamforelseVal()').kalla).toBe('stallningstagande');
        expect(w.eval('jamforelseAktivKalla()')).toBe('statistik');
        const btn = k => w.document.querySelector(`.benchmark-metric-btn[data-kalla="${k}"]`);
        expect(btn('statistik').tabIndex).toBe(0);
        expect(btn('stallningstagande').tabIndex).toBe(-1);
    });
    it('filtrerat urval syns i beräkningspanelen, Excel (alla flikar) och utskriftens rubrik', async () => {
        const w = medStatistik();
        await vendor(w, 'xlsx.mini.min.js');
        w.eval("jamforelseSattVal({ bas: 'C' })");
        w.__renderTabContent('benchmark');
        expect(w.eval('jamforelseUrvalText()')).toBe('Urval: BAS C');
        expect(audit(w)).toMatch(/Urval: BAS C/);
        const fangat = {};
        w.XLSX.writeFile = (wb, namn) => { fangat[namn] = wb; };
        w.alert = () => {};
        w.eval('exportAllToExcel()');
        const wb = Object.values(fangat)[0];
        const rader = w.XLSX.utils.sheet_to_json(wb.Sheets.Jamforelsestatistik, { header: 1 }).flat();
        expect(rader).toContain('Urval: BAS C');
        w.eval("jamforelseSattVal({ bas: '' })");
        expect(w.eval('jamforelseUrvalText()')).toBe('');
    });
    it('klick i diagrammet fäller ut en hopfälld BAS-grupp', () => {
        const w = medStatistik();
        w.__renderTabContent('benchmark');
        const u = w.eval('jamforelseUnderlag()').rader[0];
        const header = w.document.querySelector('#benchmark-table tbody tr.group-header');
        header.click();
        expect(header.classList.contains('collapsed')).toBe(true);
        w.eval(`jamforelseMarkeraRad(${JSON.stringify(u.aid)}, ${JSON.stringify(u.bas)})`);
        const rad = w.document.querySelector(`#benchmark-table tr[data-rad="${u.aid}|${u.bas}"]`);
        expect(rad.style.display).not.toBe('none');
        expect(header.classList.contains('collapsed')).toBe(false);
    });
    it('namn med < och > tolkas inte i diagrammens förklaringar', () => {
        const w = medStatistik();
        w.eval("sattOrgNamn('A<b>B</b>'); sattJmfNamn('<br>X')");
        w.__renderTabContent('benchmark');
        const namn = w.document.getElementById('chart-jamforelse-spann')._figur.lager.map(l => l.serie).join('|');
        expect(namn).not.toMatch(/[<>]/);
        expect(namn).toMatch(/A‹b›B‹\/b› P10–P90/);
        expect(w.document.getElementById('chart-jamforelse-spann').querySelector('b, br')).toBeNull();
        w.__renderTabContent('lonepolitik');
        expect(w.document.getElementById('chart-lp-bandmap')._figur.lager.map(l => l.serie).join('|')).not.toMatch(/[<>]/);
    });
    it('namn ur ett paket kortas till 100 tecken', () => {
        const w = createAppWindow();
        const lang = 'K'.repeat(150);
        const paket = JSON.stringify({ format: 'lonekartlaggning-organisationspaket', version: 1, organisation: { namn: lang }, skapat: '2026-09-28',
            profil: { jamforelseNamn: 'S'.repeat(150) }, referens: { rader: [{ bas: 'C', p10: 30000, med: 34000, p90: 39000 }] } });
        w.eval(`lasInPaket(${JSON.stringify(paket)}, 'p.json')`);
        expect(w.eval('orgNamn()')).toHaveLength(100);
        expect(w.eval('jmfNamn()')).toHaveLength(100);
    });
    it('ställningstagandets namn normaliseras; ett avvisat namn står inte kvar i fältet', () => {
        const w = createAppWindow();
        w.__loadDemoData();
        w.eval("_lasInReferens([{ bas: 'C', p10: 30000, med: 34000, p90: 39000 }], 'min.csv')");
        w.eval("sattReferensNamn('  Min   referens ')");
        expect(w.__state.policyNamn).toBe('Min referens');
        const f = w.document.getElementById('referens-namn');
        expect(f.maxLength).toBe(100);
        f.value = '19800101-1234'; f.dispatchEvent(new w.Event('change'));
        expect(f.value).toBe('Min referens');
    });
    it('kvalitetsdelen fälls inte ut igen vid omritning när statusen är densamma', () => {
        const w = createAppWindow();
        w.__loadDemoData();   // varning → utfälld
        const fall = w.document.getElementById('uk-fallbar');
        expect(fall.open).toBe(true);
        fall.open = false;
        w.eval('renderUnderlagetsKvalitet()');
        expect(fall.open).toBe(false);
        w.eval("bedomningUnderlag = () => ({ status: 'kritisk', kriterier: [{ id: 'a', namn: 'A', status: 'kritisk', text: 'x' }] }); renderUnderlagetsKvalitet();");
        expect(fall.open).toBe(true);
    });
    it('namnfälten har var sitt tillgängligt namn', () => {
        const w = createAppWindow();
        expect(w.document.getElementById('org-namn').getAttribute('aria-label')).toBe('Organisationens namn');
        expect(w.document.getElementById('jmf-namn').getAttribute('aria-label')).toBe('Jämförelsestatistikens namn');
    });
    it('ett misslyckat Byt fil pekar inte om kolumnmappningen till den avvisade filen', async () => {
        const w = createAppWindow();
        await vendor(w, 'papaparse.min.js');
        const rader = ['BAS;Månadslön;Ålder;Kön;AID'];
        for (let i = 0; i < 20; i++) rader.push(`A;${30000 + i};40;${i % 2 ? 'Man' : 'Kvinna'};5301`);
        w.loadStructureFile(new w.File([rader.join('\n')], 'bra.csv', { type: 'text/csv' }));
        for (let i = 0; i < 100 && !w.__state.data.length; i++) await new Promise(r => setTimeout(r, 20));
        w.loadStructureFile(new w.File([new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])], 'arbetsbok.xls'));
        await new Promise(r => setTimeout(r, 100));
        expect(w.__state._lastStructureFile.name).toBe('bra.csv');
    });
});

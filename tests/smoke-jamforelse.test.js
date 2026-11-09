/**
 * Röktest (jsdom): Jämförelsestatistik, organisationens namn och Översikt.
 *
 * Utbrutet ur smoke.test.js så att Vitest fördelar röktesterna över flera arbetare; varje describe-block
 * skapar sina egna fönster via createAppWindow (tests/helpers/app-harness.js).
 */
import { describe, it, expect } from 'vitest';
import { createAppWindow } from './helpers/app-harness.js';

// Statistik per yrke och BAS i demodata: avsnittet mot statistiken ritas bara när den finns (ADR-55).
const medPersonalStatistik = () => {
    const w = createAppWindow(); w.__loadDemoData();
    w.__state.statistik = [...new Set(w.__getData().map(r => `${r.aid}|${r.bas}`))].map(k => { const [aid, bas] = k.split('|'); return { aid, bas, median: 34000, p10: 30000, p90: 39000 }; });
    w.__state.statistikHasP10 = true; w.__state.statistikHasP90 = true;
    return w;
};

describe('Jämförelsestatistik: tre block och filter', () => {
    const oppna = () => { const w = medPersonalStatistik(); w.__renderTabContent('benchmark'); return w; };
    const rubriker = w => [...w.document.querySelectorAll('#benchmark-table thead th')].map(t => t.textContent.trim());
    const rad = (w, aid, bas) => w.document.querySelector(`#benchmark-table tbody tr[data-rad="${aid}|${bas}"]`);
    it('rubrikerna har P10, median och P90 med Org, Jmf och Diff', () => {
        const w = oppna();
        const org = w.eval("orgNamn('org')");   // demot heter Exempelkommunen (ADR-36)
        expect(rubriker(w)).toEqual(['Yrke', 'BAS', 'Matchning', 'N', `P10 ${org}`, 'P10 statistik', 'P10 skillnad', `Median ${org}`, 'Median statistik', 'Median skillnad',
            `P90 ${org}`, 'P90 statistik', 'P90 skillnad']);
        expect(w.document.querySelectorAll('.benchmark-metric-btn[data-metric]').length).toBe(0);
    });
    it('värdena stämmer med modulen för ett demoyrke', () => {
        const w = oppna();
        const u = w.eval('jamforelseUnderlag()').rader[0];
        const tr = rad(w, u.aid, u.bas);
        const kr = v => new Intl.NumberFormat('sv-SE', { style: 'currency', currency: 'SEK', maximumFractionDigits: 0 }).format(Math.round(v));
        expect(tr.children[7].textContent.trim()).toBe(kr(u.org.median));
        expect(rad(w, u.aid, u.bas).children[8].textContent.trim()).toBe(kr(u.statistik.median));
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
    it('bara ställningstagandet inläst: avsnittet säger att statistiken saknas och ritar inga rader', () => {
        const w = createAppWindow();
        w.__loadDemoData();
        w.__renderTabContent('benchmark');
        expect(w.document.querySelectorAll('#benchmark-table tbody tr[data-rad]').length).toBe(0);
        expect(w.document.getElementById('benchmark-table').textContent).toMatch(/Jämförelsestatistik saknas/);
        expect(w.document.querySelector('#jmf-diagram svg')).toBeNull();
    });
    it('jamforelseMarkeraRad markerar raden', () => {
        const w = oppna();
        const u = w.eval('jamforelseUnderlag()').rader[0];
        expect(w.eval(`jamforelseMarkeraRad(${JSON.stringify(u.aid)}, ${JSON.stringify(u.bas)})`)).toBe(true);
        expect(rad(w, u.aid, u.bas).classList.contains('row-highlighted')).toBe(true);
        expect(w.eval("jamforelseMarkeraRad('999999', 'Q')")).toBe(false);
    });
    it('valen följer med konfigurationsfilen; en källa i en äldre fil ignoreras; Rensa återställer', () => {
        const w = oppna();
        w.eval("jamforelseSattVal({ bas: 'C', sektor: 'Teknikarbete' })");
        const cfg = w.__buildConfigSnapshot();
        expect(cfg.ui.jamforelse).toEqual({ bas: 'C', sektor: 'Teknikarbete' });
        const w2 = oppna();
        w2.__applyConfigSnapshot({ ...cfg, ui: { ...cfg.ui, jamforelse: { kalla: 'stallningstagande', bas: 'C', sektor: '' } } });
        expect(w2.eval('jamforelseVal()')).toEqual({ bas: 'C', sektor: '' });
        w2.eval('_rensaAllData()');
        expect(w2.eval('jamforelseVal()')).toEqual({ bas: '', sektor: '' });
    });
});

describe('Jämförelsestatistik: diagrammen', () => {
    const oppna = () => { const w = medPersonalStatistik(); w.__renderTabContent('benchmark'); return w; };
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
});

describe('Jämförelsestatistik: exporten namnger statistiken', () => {
    it('Excel-rubrikerna för jmf-kolumnerna namnger statistiken', () => {
        const w = createAppWindow();
        w.__loadDemoData();
        w.__state.statistik = w.__state.data.slice(0, 1).map(r => ({ aid: r.aid, bas: r.bas, median: 30000 }));
        w.__renderTabContent('benchmark');
        // Excelexporten läser rubrikerna ur den rensade klonen (data-export-label).
        const rubriker = () => [...w.eval("_cloneAndCleanTableForExport('benchmark-table')").querySelectorAll('thead th')].map(t => t.textContent.trim()).join(' | ');
        expect(rubriker()).toMatch(/P10 jämförelsestatistiken \(kr\/mån\).*Median jämförelsestatistiken \(kr\/mån\).*P90 jämförelsestatistiken \(kr\/mån\)/);
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
    it('nyckeltal → Att göra → processen → löneskillnaden; kvaliteten står i Filer och kvalitet', () => {
        const w = createAppWindow();
        w.__loadDemoData();
        const d = w.document;
        expect(d.getElementById('view-filer').contains(d.getElementById('underlagets-kvalitet'))).toBe(true);
        const ids = ['dashboard-summary', 'att-gora', 'process-tracker', 'gap-uppdelning'];
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
        w.__renderTabContent('benchmark');
        // Diagramkärnan (ADR-39): namnet står i serien och i verktygstipset, och sätts alltid som text.
        const el = w.document.getElementById('chart-jamforelse-spann');
        expect(el.querySelector('img')).toBeNull();
        w.__el = el;
        const tips = el._figur.lager.map(l => w.eval('_rfTipsHtml')(l.tips(l.data[0]))).join('');
        expect(tips).not.toMatch(/<img/);
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
        const rader = w.XLSX.utils.sheet_to_json(wb.Sheets['Jämförelsestatistik'], { header: 1 }).flat();
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

// ---- Statistikens matchning (ett uppslag i src/lib/jamforelse.js) ----
// Demot har åtta yrkesgrupper, en per AID. Statistiken här: 402010 på sitt eget BAS (AID + BAS), 207024 utan BAS
// (Endast AID), 207011 bara för ett annat BAS-intervall (ingen match, aldrig BAS E:s median för BAS C).
describe('Statistikens matchning: märkning per rad, sammanfattning och rättelser', () => {
    const STATISTIK = [{ aid: '402010', bas: 'A', median: 34000, p10: 30000, p90: 39000 },
        { aid: '207024', bas: '', median: 33000, p10: 29000, p90: 38000 },
        { aid: '207011', bas: 'E', median: 99999, p10: 90000, p90: 120000 }];
    const medMatchning = () => {
        const w = createAppWindow(); w.__loadDemoData();
        w.__state.statistik = STATISTIK.map(s => ({ ...s }));
        w.__state.statistikHasP10 = true; w.__state.statistikHasP90 = true;
        w.__renderTabContent('benchmark');
        return w;
    };
    const cellPa = (w, tabell, rubrik, radTest) => {
        const th = [...w.document.querySelectorAll(`#${tabell} thead th`)];
        const i = th.findIndex(t => t.textContent.trim() === rubrik);
        const tr = [...w.document.querySelectorAll(`#${tabell} tbody tr`)].find(radTest);
        return tr?.children[i]?.textContent.trim();
    };
    it('tabellen mot statistiken har kolumnen Matchning efter BAS, med regeln i rubriken', () => {
        const w = medMatchning();
        const th = [...w.document.querySelectorAll('#benchmark-table thead th')];
        expect(th.map(t => t.textContent.trim()).slice(0, 4)).toEqual(['Yrke', 'BAS', 'Matchning', 'N']);
        expect(th[2].getAttribute('data-export-label')).toBe('Matchning mot jämförelsestatistiken');
        expect(th[2].title).toMatch(/samma AID och samma BAS.*samma AID som saknar BAS.*annat BAS-intervall används aldrig/);
        const rad = (aid, bas) => w.document.querySelector(`#benchmark-table tbody tr[data-rad="${aid}|${bas}"]`).children[2];
        expect(rad('402010', 'A').textContent).toBe('AID + BAS');
        expect(rad('207024', 'B').textContent).toBe('Endast AID');
        expect(rad('207011', 'C').textContent).toBe('–');
        // Sorterbar: nivån som sorteringsvärde (AID + BAS före Endast AID före ingen).
        expect([rad('402010', 'A'), rad('207024', 'B'), rad('207011', 'C')].map(td => td.getAttribute('data-sort-value'))).toEqual(['1', '2', '3']);
        // Ingen grupp fick statistik från ett annat BAS-intervall.
        expect(w.eval('jamforelseUnderlag()').rader.find(r => r.aid === '207011').statistik.median).toBeNull();
    });
    it('sammanfattningen ovanför tabellen räknar samma urval som tabellen', () => {
        const w = medMatchning();
        const info = () => w.document.getElementById('benchmark-matchning-info').textContent;
        expect(info()).toBe('Statistiken: 1 yrkesgrupp matchad på AID och BAS, 1 på endast AID, 6 utan statistik.');
        w.eval("jamforelseSattVal({ bas: 'C' }); generateBenchmark();");
        expect(info()).toBe('Statistiken: 0 yrkesgrupper matchade på AID och BAS, 0 på endast AID, 4 utan statistik.');
        w.eval("jamforelseSattVal({ bas: 'B' }); generateBenchmark();");
        expect(info()).toBe('Statistiken: 0 yrkesgrupper matchade på AID och BAS, 1 på endast AID, 0 utan statistik.');
    });
    it('Beräkning & urval anger antalet per matchningsnivå', () => {
        const w = medMatchning();
        const panel = w.document.querySelector('details.audit-panel[data-audit-id="benchmark"] .audit-content').textContent;
        expect(panel).toMatch(/I urvalet: 1 yrkesgrupp på AID \+ BAS, 1 på endast AID, 6 utan statistik/);
    });
    it('utan statistik: ingen sammanfattning', () => {
        const w = createAppWindow(); w.__loadDemoData();
        w.__renderTabContent('benchmark');
        expect(w.document.getElementById('benchmark-matchning-info').textContent).toBe('');
    });
    it('detaljlistan (ref-tabell) har samma kolumn med samma ord', () => {
        const w = medMatchning();
        const yrke = aid => tr => tr.children[0].textContent.startsWith(aid);
        expect(cellPa(w, 'ref-tabell', 'Matchning', yrke('402010'))).toBe('AID + BAS');
        expect(cellPa(w, 'ref-tabell', 'Matchning', yrke('207024'))).toBe('Endast AID');
        expect(cellPa(w, 'ref-tabell', 'Matchning', yrke('207011'))).toBe('–');
        const th = [...w.document.querySelectorAll('#ref-tabell thead th')].map(t => t.textContent.trim());
        expect(th.indexOf('Matchning')).toBe(1);
    });
    it('detaljlistan utan statistik har ingen kolumn Matchning', () => {
        const w = createAppWindow(); w.__loadDemoData();
        w.__renderTabContent('benchmark');
        expect([...w.document.querySelectorAll('#ref-tabell thead th')].map(t => t.textContent.trim())).not.toContain('Matchning');
    });
    it('rapportens tabell och den samlade jämförelseexporten bär samma märkning', async () => {
        const w = medMatchning();
        const avsnitt = w.eval('rapportModell()').avsnitt.find(a => a.id === 'referenser');
        const tabell = avsnitt.delar.find(d => d.typ === 'tabell' && d.kolumner.some(k => k.rubrik === 'Yrkesgrupp'));
        const i = tabell.kolumner.findIndex(k => k.rubrik === 'Matchning');
        expect(i).toBe(1);
        const per = Object.fromEntries(tabell.rader.map(r => [String(r[0]).split(' ')[0], r[i]]));
        expect(per).toMatchObject({ 402010: 'AID + BAS', 207024: 'Endast AID', 207011: '–' });
        const { laddaXlsx, fangaBocker } = await import('./helpers/ktroskel-rigg.js');
        await laddaXlsx(w);
        const bok = Object.values(fangaBocker(w, () => w.eval('exportBenchmarkExcel()')))[0];
        // fangaBocker slår ihop siffror över radbrytningar (tusentalsavgränsaren): sök i hela texten.
        expect(bok).toMatch(/AID \/ Yrkesgrupp \| BAS \| Matchning \| N \(organisationen\) \| /);
        expect(bok).toMatch(/402010 Förskollärare \| A \| AID \+ BAS \| 33 \| /);
        expect(bok).toMatch(/207024 Vårdbiträde \| B \| Endast AID \| 46 \| /);
        expect(bok).toMatch(/207011 Undersköterska \| C \| – \| 20 \| /);
    });
    it('Excel (alla flikar) och utskriften följer tabellen', () => {
        const w = medMatchning();
        const klon = w.eval("_cloneAndCleanTableForExport('benchmark-table')");
        expect([...klon.querySelectorAll('thead th')].map(t => t.textContent.trim())[2]).toBe('Matchning mot jämförelsestatistiken');
        expect(klon.querySelector('tbody tr[data-rad="207024|B"]').children[2].textContent).toBe('Endast AID');
    });
    it('rättelse, Löneöversyn: marknadspositioneringen tar aldrig ett annat BAS-intervalls median', () => {
        const w = medMatchning();
        // Medianerna ligger över varje grupps median, så att varje matchad grupp får ett lyft.
        w.__state.statistik = [{ aid: '207024', bas: '', median: 99999 }, { aid: '207011', bas: 'E', median: 99999 }];
        w.__renderTabContent('loneoversyn');
        w.__state.forecast.targets = [];
        w.document.getElementById('forecast-market-factor').value = '100';
        w.eval('_forecastMarket()');
        const mal = w.__state.forecast.targets.map(t => `${t.aid}|${t.bas}`);
        expect(mal).not.toContain('207011|C');   // bara en rad för BAS E: ingen marknadsnivå
        expect(mal).toEqual(['207024|B']);       // en rad utan BAS: används
    });
    it('rättelse, Ålder & karriär i hela urvalet: ett uppslag per AID×BAS och medianen av de matchade', () => {
        const w = medMatchning();
        w.__state.statistik = [{ aid: '402010', bas: 'Z', median: 99999 }, { aid: '207024', bas: '', median: 40000 }, { aid: '502010', bas: 'C', median: 50000 }];
        w.eval("populateSelects(); renderKon('__ALLA__')");
        const linje = w.document.getElementById('chart-kon-scatter')._figur.lager.find(l => /^Median i /.test(l.serie));
        expect(linje.data.map(p => p.y)).toEqual([45000, 45000]);   // inte 50000 (med BAS Z:s 99999)
    });
});

// ---- Löneläget: överblicken överst (bandkartan och statistikens spann) ----
// Ordningen: Överblick (avsnitt-jmf-bandkartor, öppen) → Mot ställningstagandet → Mot jämförelsestatistiken →
// Yrkesgrupp för yrkesgrupp (avsnitt-jmf-overblick, stängd). Statistikens spann läser samma rader som tabellen mot
// statistiken (jamforelseUnderlag: inga grupper under tröskeln), utan tabellens filter.
describe('Löneläget: överblicken med bandkartan och statistikens spann', () => {
    const avsnitt = w => [...w.document.querySelectorAll('#view-benchmark > details.avsnitt')];
    const el = (w, id) => w.document.getElementById(id);
    const punkter = f => f.lager.filter(l => l.marke === 'punkt').flatMap(l => l.data.map(p => ({ ...p, lager: l })));
    // Demots åtta grupper: var tredje utan P10 och P90 (ingen punkt), annars AID + BAS eller en rad utan BAS (Endast AID),
    // och spann som lägger medianen över respektive under statistikens spann.
    const medBlandad = () => {
        const w = createAppWindow(); w.__loadDemoData();
        const rader = w.eval('jamforelseUnderlag()').rader;
        w.__state.statistik = rader.map((r, i) => {
            const m = r.org.median;
            if (i % 3 === 2) return { aid: r.aid, bas: r.bas, median: m };
            const [p10, p90] = i % 2 ? [m * 1.05, m * 1.3] : [m * 0.7, m * 0.95];
            return { aid: r.aid, bas: i % 3 === 1 ? '' : r.bas, p10, median: (p10 + p90) / 2, p90 };
        });
        w.__state.statistikHasP10 = true; w.__state.statistikHasP90 = true;
        w.__renderTabContent('benchmark');
        return w;
    };
    it('ordningen: Överblick, Mot ställningstagandet, Mot jämförelsestatistiken, Yrkesgrupp för yrkesgrupp; bara överblicken öppen', () => {
        const w = medBlandad();
        expect(avsnitt(w).map(a => a.id)).toEqual(['avsnitt-jmf-bandkartor', 'avsnitt-jmf-stallningstagande', 'avsnitt-jmf-statistik', 'avsnitt-jmf-overblick']);
        expect(avsnitt(w).filter(a => a.open).map(a => a.id)).toEqual(['avsnitt-jmf-bandkartor']);
        expect(el(w, 'avsnitt-jmf-overblick').querySelector('h2').textContent).toMatch(/^Yrkesgrupp för yrkesgrupp/);
        expect(el(w, 'avsnitt-jmf-bandkartor').querySelector('h2').textContent).toMatch(/^Överblick/);
        // Bandkartan står i överblicken, före statistikens spann, och inte längre i avsnittet mot ställningstagandet.
        const fore = (a, b) => !!(el(w, a).compareDocumentPosition(el(w, b)) & 4);
        expect(el(w, 'avsnitt-jmf-bandkartor').contains(el(w, 'chart-lp-bandmap'))).toBe(true);
        expect(el(w, 'avsnitt-jmf-bandkartor').contains(el(w, 'chart-jmf-statlage'))).toBe(true);
        expect(fore('chart-lp-bandmap', 'chart-jmf-statlage')).toBe(true);
        expect(el(w, 'avsnitt-jmf-stallningstagande').querySelector('#chart-lp-bandmap')).toBeNull();
        expect(el(w, 'lp-bandkarta-kort').hidden).toBe(false);
        expect(el(w, 'jmf-statlage-kort').hidden).toBe(false);
        expect(el(w, 'chart-lp-bandmap')._figur).toBeTruthy();
        // Sökregistret pekar på båda avsnitten.
        const sok = w.eval('SOK_FUNKTIONER').filter(s => s.flik === 'benchmark').map(s => s.avsnitt);
        expect(sok).toEqual(expect.arrayContaining(['avsnitt-jmf-bandkartor', 'avsnitt-jmf-overblick']));
    });
    it('en punkt per yrkesgrupp med P10 och P90: läget 0 = P10, 100 = P90; fylld = AID + BAS, ofylld = Endast AID', () => {
        const w = medBlandad();
        const rader = w.eval('jamforelseUnderlag()').rader, f = el(w, 'chart-jmf-statlage')._figur;
        expect(() => w.eval('_figValidera')(f, 't')).not.toThrow();
        const pts = punkter(f);
        const medSpann = rader.filter(r => r.statistik.p10 !== null && r.statistik.p90 !== null);
        expect(pts).toHaveLength(medSpann.length);
        expect(pts.length).toBe(6);
        for (const r of medSpann) {
            const p = pts.find(q => q.aid === r.aid && q.bas === r.bas);
            expect(p.y).toBeCloseTo((r.org.median - r.statistik.p10) / (r.statistik.p90 - r.statistik.p10) * 100, 9);
            expect(p.x).toBe('BAS ' + r.bas);
            expect(p.matchning).toBe(r.statistikMatchning);
            expect(!!p.lager.ofylld).toBe(r.statistikMatchning === 'aid');
            expect(p.lager.serie).toMatch(r.statistikMatchning === 'aid' ? / · Endast AID$/ : / · AID \+ BAS$/);
            expect(p.n).toBe(r.n);
        }
        expect(pts.some(p => p.y < 0) && pts.some(p => p.y > 100)).toBe(true);   // axeln rymmer lägen utanför spannet
        expect(pts.some(p => p.lager.ofylld) && pts.some(p => !p.lager.ofylld)).toBe(true);
        // Statistikens spann som ett grått band 0–100 per BAS, och linjer vid 0 och 100.
        const band = f.lager.find(l => l.marke === 'intervall');
        expect(band.data.every(d => d.lag === 0 && d.hog === 100)).toBe(true);
        expect(new Set(band.data.map(d => d.x))).toEqual(new Set(pts.map(p => p.x)));
        expect(f.referens.map(r => r.y)).toEqual([0, 100]);
        // I bilden: de ofyllda är ringar utan fyllning, de fyllda har lagrets färg.
        const svgPunkter = [...el(w, 'chart-jmf-statlage').querySelectorAll('svg[data-del="panel"] [data-marke="punkt"]')];
        expect(svgPunkter.filter(m => m.getAttribute('fill') === 'none')).toHaveLength(pts.filter(p => p.lager.ofylld).length);
        // Beskrivningen säger vad fylld och ofylld betyder och att filtren inte gäller.
        expect(f.beskrivning).toMatch(/[Ff]ylld/);
        expect(f.beskrivning).toMatch(/[Oo]fylld/);
        expect(el(w, 'jmf-statlage-kort').textContent).toMatch(/Fylld punkt[^]*AID \+ BAS[^]*Ofylld punkt[^]*Endast AID/);
        // Tipset: yrke, BAS, läget, organisationens median, statistikens spann, matchning och antal.
        const p = pts[0], tips = p.lager.tips(p).map(r => r.join(' ')).join('\n');
        for (const ord of [p.yrke, `BAS ${p.bas}`, 'Läget i spannet', 'Organisationens median', 'P10', 'P90', 'Matchning', 'Antal']) expect(tips).toContain(ord);
    });
    it('samma färger för könsdominans och samma förskjutning som bandkartan', () => {
        const w = medBlandad();
        const band = el(w, 'chart-lp-bandmap')._figur, stat = el(w, 'chart-jmf-statlage')._figur;
        for (const l of stat.lager.filter(x => x.marke === 'punkt')) {
            const klass = l.serie.split(' · ')[0];
            const motsv = band.lager.find(b => b.serie === `${klass} yrkesgrupp`);
            if (motsv) expect(l.farg).toBe(motsv.farg);
            for (const p of l.data) expect(/^Kvinno/.test(klass) ? p.kvAndel >= 60 : /^Mans/.test(klass) ? p.kvAndel <= 40 : p.kvAndel > 40 && p.kvAndel < 60).toBe(true);
        }
        const bandPts = band.lager.filter(l => /yrkesgrupp$/.test(l.serie)).flatMap(l => l.data);
        for (const p of punkter(stat)) {
            const b = bandPts.find(q => q.yrke === p.yrke && q.bas === p.bas);
            if (b) expect(p.forskjutning).toBe(b.forskjutning);
            expect(Math.abs(p.forskjutning)).toBeLessThanOrEqual(0.18);
        }
    });
    it('filtren i Mot jämförelsestatistiken påverkar inte överblicken', () => {
        const w = medBlandad();
        const fore = punkter(el(w, 'chart-jmf-statlage')._figur).length;
        const bas = el(w, 'jmf-bas');
        bas.value = [...bas.options].map(o => o.value).find(v => v);
        bas.dispatchEvent(new w.Event('change'));
        expect(w.document.querySelectorAll('#benchmark-table tbody tr[data-rad]').length).toBeLessThan(8);
        expect(punkter(el(w, 'chart-jmf-statlage')._figur)).toHaveLength(fore);
    });
    it('bara grupper som når tröskeln: i exportläget med tröskeln 25 finns bara de större grupperna', () => {
        const w = medBlandad();
        w.eval('sattKTroskel(25, { fraga: false })');
        const { pts, rader } = w.eval("medExportLage(() => { renderStatistikLage(); return { pts: document.getElementById('chart-jmf-statlage')._figur, rader: jamforelseUnderlag() }; })");
        const alla = w.eval('jamforelseUnderlag()').rader;
        expect(rader.utelamnade.length).toBeGreaterThan(0);
        const visade = punkter(pts);
        expect(visade.every(p => p.n >= 25)).toBe(true);
        expect(visade.length).toBeLessThan(punkter(el(w, 'chart-jmf-statlage')._figur).length + 1);
        expect(visade.length).toBe(rader.rader.filter(r => r.statistik.p10 !== null && r.statistik.p90 !== null).length);
        expect(alla.some(r => r.n < 25)).toBe(true);
    });
    it('utan P10 och P90 i statistiken: ett meddelande i kortet i stället för diagrammet', () => {
        const w = createAppWindow(); w.__loadDemoData();
        w.__state.statistik = w.eval('jamforelseUnderlag()').rader.map(r => ({ aid: r.aid, bas: r.bas, median: 34000 }));
        w.__state.statistikHasP10 = false; w.__state.statistikHasP90 = false;
        w.__renderTabContent('benchmark');
        expect(el(w, 'jmf-statlage-kort').hidden).toBe(false);
        expect(el(w, 'chart-jmf-statlage')._figur).toBeUndefined();
        expect(el(w, 'chart-jmf-statlage').textContent).toMatch(/P10 och P90/);
    });
    it('utan statistik bara bandkartan; utan ställningstagande bara statistikens spann', () => {
        const w = createAppWindow(); w.__loadDemoData();
        w.__renderTabContent('benchmark');
        expect(el(w, 'lp-bandkarta-kort').hidden).toBe(false);
        expect(el(w, 'jmf-statlage-kort').hidden).toBe(true);
        expect(el(w, 'chart-jmf-statlage')._figur).toBeUndefined();
        const w2 = medBlandad();
        w2.__state.policy = [];
        w2.__renderTabContent('benchmark');
        expect(el(w2, 'lp-bandkarta-kort').hidden).toBe(true);
        expect(el(w2, 'chart-lp-bandmap')._figur).toBeUndefined();
        expect(el(w2, 'jmf-statlage-kort').hidden).toBe(false);
        expect(el(w2, 'chart-jmf-statlage')._figur).toBeTruthy();
    });
});

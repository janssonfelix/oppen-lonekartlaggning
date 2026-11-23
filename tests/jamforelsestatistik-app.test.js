// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
// Jämförelsestatistik i appen: de tre blocken och filtren, diagrammen, exporten, beräkningspanelen, statistikens
// matchning per rad och den samlade jämförelseexporten.
import { describe, it, expect } from 'vitest';
import { createAppWindow } from './helpers/app-harness.js';

// Statistik per yrke och BAS i demodata: avsnittet mot statistiken ritas bara när den finns (ADR-55).
const medPersonalStatistik = () => {
    const w = createAppWindow(); w.__lasInDemodata();
    w.__state.statistik = [...new Set(w.__hamtaData().map(r => `${r.aid}|${r.bas}`))].map(k => { const [aid, bas] = k.split('|'); return { aid, bas, median: 34000, p10: 30000, p90: 39000 }; });
    w.__state.statistikHasP10 = true; w.__state.statistikHasP90 = true;
    return w;
};

describe('Jämförelsestatistik: tre block och filter', () => {
    const oppna = () => { const w = medPersonalStatistik(); w.__ritaFlik('benchmark'); return w; };
    const rubriker = w => [...w.document.querySelectorAll('#benchmark-table thead th')].map(t => t.textContent.trim());
    const rad = (w, aid, bas) => w.document.querySelector(`#benchmark-table tbody tr[data-rad="${aid}|${bas}"]`);
    it('rubrikerna har P10, median och P90 med Org, Jmf och Diff', () => {
        const w = oppna();
        const org = w.eval("orgNamn('org')");   // demot heter Exempelkommunen (ADR-36)
        expect(rubriker(w)).toEqual(['AID', 'BAS', 'Matchning', 'N', `P10 ${org}`, 'P10 statistik', 'P10 skillnad', `Median ${org}`, 'Median statistik', 'Median skillnad',
            `P90 ${org}`, 'P90 statistik', 'P90 skillnad']);
        expect(w.document.querySelectorAll('.benchmark-metric-btn[data-metric]').length).toBe(0);
    });
    it('[B6.5] värdena stämmer med modulen för ett demoyrke', () => {
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
        expect(w.document.getElementById('benchmark-table').textContent).toMatch(/Inga AID-etiketter i urvalet/);
    });
    it('bara ställningstagandet inläst: avsnittet säger att statistiken saknas och ritar inga rader', () => {
        const w = createAppWindow();
        w.__lasInDemodata();
        w.__ritaFlik('benchmark');
        expect(w.document.querySelectorAll('#benchmark-table tbody tr[data-rad]').length).toBe(0);
        expect(w.document.getElementById('benchmark-table').textContent).toMatch(/Jämförelsestatistik saknas/);
        expect(w.document.querySelector('#jmf-diagram svg')).toBeNull();
    });
    it('utan statistik gömmer tabellen P10 och P90 som när statistik finns (Fler kolumner)', () => {
        const w = createAppWindow();
        w.__lasInDemodata();
        w.__ritaFlik('benchmark');
        const rubrik = kol => /** @type {HTMLElement} */ (w.document.querySelector(`#benchmark-thead th[data-kol="${kol}"]`));
        for (const kol of ['p10org', 'p10jmf', 'p10diff', 'p90org', 'p90jmf', 'p90diff']) expect(rubrik(kol).hidden).toBe(true);
        expect(w.document.querySelector('[data-fler-kolumner="benchmark-table"]')).not.toBeNull();
        // Den tomma raden spänner över de synliga kolumnerna.
        expect(w.document.querySelector('#benchmark-table tbody td').getAttribute('colspan')).toBe('7');
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
        const cfg = w.__byggKonfiguration();
        expect(cfg.visning.jamforelse).toEqual({ bas: 'C', sektor: 'Teknikarbete' });
        const w2 = oppna();
        w2.__tillampaKonfiguration({ ...cfg, visning: { ...cfg.visning, jamforelse: { kalla: 'stallningstagande', bas: 'C', sektor: '' } } });
        expect(w2.eval('jamforelseVal()')).toEqual({ bas: 'C', sektor: '' });
        w2.eval('_rensaAllData()');
        expect(w2.eval('jamforelseVal()')).toEqual({ bas: '', sektor: '' });
    });
});

describe('Jämförelsestatistik: diagrammen', () => {
    const oppna = () => { const w = medPersonalStatistik(); w.__ritaFlik('benchmark'); return w; };
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
        expect(w.document.getElementById('jmf-diagram').textContent).toMatch(/Vilka AID-etiketter avviker mest\?/);
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
        expect(el._figur.lager.find(l => l.serie === 'Medianens värde').data.every(p => /^[+−]\d+,\d\s%$/.test(p.etikett))).toBe(true);
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
        w.eval('fyllValjare(); lasUppFlikar();');
        w.__ritaFlik('benchmark');
        expect(w.document.getElementById('chart-jamforelse-spann')._figur.y.ordning.length).toBe(25);
        expect(w.document.getElementById('jmf-spann-not').textContent).toMatch(/de 25 största AID-etiketterna av 30/);
        expect(w.document.querySelectorAll('#benchmark-table tbody tr[data-rad]').length).toBe(30);
    });
});

describe('Jämförelsestatistik: exporten namnger statistiken', () => {
    it('Excel-rubrikerna för jmf-kolumnerna namnger statistiken', () => {
        const w = createAppWindow();
        w.__lasInDemodata();
        w.__state.statistik = w.__state.data.slice(0, 1).map(r => ({ aid: r.aid, bas: r.bas, median: 30000 }));
        w.__ritaFlik('benchmark');
        // Excelexporten läser rubrikerna ur den rensade klonen (data-export-label).
        const rubriker = () => [...w.eval("_tabellkopiaForExport('benchmark-table')").querySelectorAll('thead th')].map(t => t.textContent.trim()).join(' | ');
        expect(rubriker()).toMatch(/P10 jämförelsestatistiken \(kr\/mån\).*Median jämförelsestatistiken \(kr\/mån\).*P90 jämförelsestatistiken \(kr\/mån\)/);
    });
});

describe('Jämförelsestatistik, Översikt och namn: detaljer — Jämförelsestatistik', () => {
    const vendor = async (w, fil) => {
        const { readFileSync } = await import('node:fs');
        const { join, dirname } = await import('node:path');
        const { fileURLToPath } = await import('node:url');
        w.eval(readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'vendor', fil), 'utf8'));
    };
    const medStatistik = () => {
        const w = createAppWindow();
        w.__lasInDemodata();
        w.__state.statistik = w.__state.data.map(r => ({ aid: r.aid, bas: r.bas, median: 35000, p10: 31000, p90: 40000 }))
            .filter((s, i, a) => a.findIndex(x => x.aid === s.aid && x.bas === s.bas) === i);
        w.__state.statistikHasP10 = w.__state.statistikHasP90 = true;
        return w;
    };
    const audit = w => w.document.querySelector('[data-audit-id="benchmark"]').textContent.replace(/\s+/g, ' ');
    it('beräkningspanelen beskriver ställningstagandets matchning rätt', () => {
        const w = medStatistik();
        w.__ritaFlik('benchmark');
        expect(audit(w)).toMatch(/AID \+ BAS, annars AID, annars BAS/);
    });
    it('filtrerat urval syns i beräkningspanelen, Excel (alla flikar) och utskriftens rubrik', async () => {
        const w = medStatistik();
        await vendor(w, 'xlsx.mini.min.js');
        w.eval("jamforelseSattVal({ bas: 'C' })");
        w.__ritaFlik('benchmark');
        expect(w.eval('jamforelseUrvalText()')).toBe('Urval: BAS C');
        expect(audit(w)).toMatch(/Urval: BAS C/);
        const fangat = {};
        w.XLSX.writeFile = (wb, namn) => { fangat[namn] = wb; };
        w.alert = () => {};
        w.eval('exportAlltTillExcel()');
        const wb = Object.values(fangat)[0];
        const rader = w.XLSX.utils.sheet_to_json(wb.Sheets['Jämförelsestatistik'], { header: 1 }).flat();
        expect(rader).toContain('Urval: BAS C');
        w.eval("jamforelseSattVal({ bas: '' })");
        expect(w.eval('jamforelseUrvalText()')).toBe('');
    });
    it('klick i diagrammet fäller ut en hopfälld BAS-grupp', () => {
        const w = medStatistik();
        w.__ritaFlik('benchmark');
        const u = w.eval('jamforelseUnderlag()').rader[0];
        const header = w.document.querySelector('#benchmark-table tbody tr.group-header');
        header.click();
        expect(header.classList.contains('collapsed')).toBe(true);
        w.eval(`jamforelseMarkeraRad(${JSON.stringify(u.aid)}, ${JSON.stringify(u.bas)})`);
        const rad = w.document.querySelector(`#benchmark-table tr[data-rad="${u.aid}|${u.bas}"]`);
        expect(rad.style.display).not.toBe('none');
        expect(header.classList.contains('collapsed')).toBe(false);
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
        const w = createAppWindow(); w.__lasInDemodata();
        w.__state.statistik = STATISTIK.map(s => ({ ...s }));
        w.__state.statistikHasP10 = true; w.__state.statistikHasP90 = true;
        w.__ritaFlik('benchmark');
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
        expect(th.map(t => t.textContent.trim()).slice(0, 4)).toEqual(['AID', 'BAS', 'Matchning', 'N']);
        expect(th[0].getAttribute('data-export-label')).toBe('AID-etikett');
        expect(th[2].getAttribute('data-export-label')).toBe('Matchning mot jämförelsestatistiken');
        expect(th[2].title).toMatch(/samma AID och samma BAS.*samma AID som saknar BAS.*andra BAS-intervall används aldrig/);
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
        expect(info()).toBe('Statistiken: 1 AID-etikett i BAS-intervall matchad på AID och BAS, 1 på endast AID, 6 utan statistik.');
        w.eval("jamforelseSattVal({ bas: 'C' }); generateBenchmark();");
        expect(info()).toBe('Statistiken: 0 AID-etiketter i BAS-intervall matchade på AID och BAS, 0 på endast AID, 4 utan statistik.');
        w.eval("jamforelseSattVal({ bas: 'B' }); generateBenchmark();");
        expect(info()).toBe('Statistiken: 0 AID-etiketter i BAS-intervall matchade på AID och BAS, 1 på endast AID, 0 utan statistik.');
    });
    it('Beräkning & urval anger antalet per matchningsnivå', () => {
        const w = medMatchning();
        const panel = w.document.querySelector('details.audit-panel[data-audit-id="benchmark"] .audit-content').textContent;
        expect(panel).toMatch(/I urvalet: 1 AID-etikett i BAS-intervall på AID \+ BAS, 1 på endast AID, 6 utan statistik/);
    });
    it('utan statistik: ingen sammanfattning', () => {
        const w = createAppWindow(); w.__lasInDemodata();
        w.__ritaFlik('benchmark');
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
        const w = createAppWindow(); w.__lasInDemodata();
        w.__ritaFlik('benchmark');
        expect([...w.document.querySelectorAll('#ref-tabell thead th')].map(t => t.textContent.trim())).not.toContain('Matchning');
    });
    it('rapportens tabell och den samlade jämförelseexporten bär samma märkning', async () => {
        const w = medMatchning();
        const avsnitt = w.eval('rapportModell()').avsnitt.find(a => a.id === 'referenser');
        const tabell = avsnitt.delar.find(d => d.typ === 'tabell' && d.kolumner.some(k => k.rubrik === 'AID-etikett'));
        const i = tabell.kolumner.findIndex(k => k.rubrik === 'Matchning');
        expect(i).toBe(1);
        const per = Object.fromEntries(tabell.rader.map(r => [String(r[0]).split(' ')[0], r[i]]));
        expect(per).toMatchObject({ 402010: 'AID + BAS', 207024: 'Endast AID', 207011: '–' });
        const { laddaXlsx, fangaBocker } = await import('./helpers/ktroskel-rigg.js');
        await laddaXlsx(w);
        const bok = Object.values(fangaBocker(w, () => w.eval('exportBenchmarkExcel()')))[0];
        // fangaBocker slår ihop siffror över radbrytningar (tusentalsavgränsaren): sök i hela texten.
        expect(bok).toMatch(/AID-etikett \| BAS \| Matchning \| N \(organisationen\) \| /);
        expect(bok).toMatch(/402010 Förskollärare \| A \| AID \+ BAS \| 33 \| /);
        expect(bok).toMatch(/207024 Vårdbiträde \| B \| Endast AID \| 46 \| /);
        expect(bok).toMatch(/207011 Undersköterska \| C \| – \| 20 \| /);
    });
    it('Excel (alla flikar) och utskriften följer tabellen', () => {
        const w = medMatchning();
        const klon = w.eval("_tabellkopiaForExport('benchmark-table')");
        expect([...klon.querySelectorAll('thead th')].map(t => t.textContent.trim())[2]).toBe('Matchning mot jämförelsestatistiken');
        expect(klon.querySelector('tbody tr[data-rad="207024|B"]').children[2].textContent).toBe('Endast AID');
    });
    it('rättelse, Löneöversyn: marknadspositioneringen tar aldrig ett annat BAS-intervalls median', () => {
        const w = medMatchning();
        // Medianerna ligger över varje grupps median, så att varje matchad grupp får ett lyft.
        w.__state.statistik = [{ aid: '207024', bas: '', median: 99999 }, { aid: '207011', bas: 'E', median: 99999 }];
        w.__ritaFlik('loneoversyn');
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
        w.eval("fyllValjare(); ritaAlderOchLon('__ALLA__')");
        const linje = w.document.getElementById('chart-kon-scatter')._figur.lager.find(l => /^Median i /.test(l.serie));
        expect(linje.data.map(p => p.y)).toEqual([45000, 45000]);   // inte 50000 (med BAS Z:s 99999)
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
        w.eval('fyllValjare(); lasUppFlikar();');
        const fangat = {};
        w.XLSX.writeFile = (wb, namn) => { fangat[namn] = wb; };
        w.eval('exportBenchmarkExcel()');
        const wb = Object.values(fangat)[0];
        const rad = w.XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: true })[2];
        expect(rad[20]).toBe(32222);   // ställningstagandets median (efter kolumnen Matchning)
    });
});

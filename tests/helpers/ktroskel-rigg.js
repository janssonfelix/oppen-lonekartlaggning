/**
 * Gemensam rigg för k-tröskel-testerna (tests/ktroskel*.test.js).
 *
 * Samma idé som kanonymitet.test.js: grupper där alla har samma "omöjliga" lön, så att
 * varje gruppaggregat är lika med det värdet. Här finns två storlekar: MELLAN (20 personer)
 * ska synas vid tröskeln 10 och saknas vid 25; SMÅ (6 personer) ska synas först vid 5.
 *
 * Utbruten ur ktroskel.test.js när sviten delades i åtta filer, så att Vitest fördelar dem över arbetare.
 */
import { createAppWindow } from './app-harness.js';
import { attributtext } from './attributtext.js';

export const STORA = ['S1', 'S2', 'S3', 'S4', 'S5', 'S6'], TOPP = 'S7';
export const MELLAN = ['A', 'B', 'C', 'D'], SENT_MELLAN = [31417, 32719, 33827, 34513];
export const SMA = ['E', 'F'], SENT_SMA = [35291, 36107];
export const FLIKAR = ['dashboard', 'bestammelser', 'matrix', 'likvardighet', 'struktur', 'prioritering', 'loneoversyn',
                'kon', 'demografi', 'benchmark', 'lonepolitik', 'kvalitet', 'rapport', 'handlingsplan', 'info'];

export function byggDataset() {
    const rader = [];
    const rad = (bas, i, lon, aid, namn) => ({ bas, kon: i % 2 === 0 ? 'kvinna' : 'man', lon,
        alder: 25 + ((i * 7) % 40), yrke: `${aid} ${namn}`, aid: String(aid), yrkeLabel: namn, enhet: '' });
    STORA.forEach((bas, b) => { for (let i = 0; i < 150; i++) rader.push(rad(bas, i, 24000 + b * 800 + ((i * 37) % 900), 6000 + b, `Säkeryrke ${b}`)); });
    for (let i = 0; i < 150; i++) rader.push(rad(TOPP, i, 50000 + ((i * 37) % 900), 6900, 'Toppyrke'));
    MELLAN.forEach((bas, g) => { for (let i = 0; i < 20; i++) rader.push(rad(bas, i, SENT_MELLAN[g], 5300 + g, `Mellanyrke ${g}`)); });
    SMA.forEach((bas, g) => { for (let i = 0; i < 6; i++) rader.push(rad(bas, i, SENT_SMA[g], 5400 + g, `Småyrke ${g}`)); });
    return rader;
}
export const normalisera = t => t.replace(/(\d)[\s  ](?=\d)/g, '$1');

// Sentinelvärden som syns utanför de vyer som är undantagna (Utforska, ADR-14; Personer att granska, ADR-23).
export function synliga(win, varden) {
    const ut = new Set();
    for (const el of win.document.body.querySelectorAll('*')) {
        if (el.closest('#view-utforska') || el.closest('#personer-att-granska') || el.children.length) continue;
        const text = normalisera(`${el.textContent} ${attributtext(el)}`);
        for (const v of varden) if (text.includes(String(v))) ut.add(v);
    }
    return [...ut].sort();
}
export function fonster(k) {
    const win = createAppWindow();
    if (k !== null) win.eval(`sattKTroskel(${k}, { fraga: false })`);
    win.__state.data = byggDataset();
    win.__state.policy = [...STORA, TOPP, ...MELLAN, ...SMA].map(b => ({ bas: b, p10: 22000, med: 30000, p90: 52000 }));
    win.eval('populateSelects(); unlockTabs();');
    return win;
}
export const ritaAlla = win => { for (const f of FLIKAR) win.__renderTabContent(f); };
// Öppnar fliken som användaren gör, genom menyn. Bara den öppna fliken ritas om
// när tröskeln ändras; övriga töms och ritas när de öppnas eller när en export behöver dem (23-exportgrind.js).
export const oppnaFlik = (win, flik) => { const n = win.document.querySelector(`.nav-item[data-tab="${flik}"]`); n.disabled = false; n.click(); };

// ===================================================================================
// Kön under tröskeln inuti en grupp över den.
//
// Fixturerna ovan ser inte de här läckorna: varje liten grupp har EN lön och jämn
// könsfördelning, så ett könsuppdelat mått går inte att skilja från gruppens eget. Här har
// grupperna olika lön per kön, och varje värde som inte får synas är unikt:
//
//  Y1–Y3  30 kvinnor på en lön och 1, 2 respektive 3 män på en annan (KON_MA). Gruppen ligger
//         över tröskeln vid både 10 och 25; männens lön, gapet och kostnaden får aldrig synas.
//         Kvinnornas löner ligger UNDER den säkra befolkningen, så att ingen percentil för
//         hela organisationen kan hamna på ett värde som ska vara dolt.
//  X      2 kvinnor och 2 män med var sin lön (ett 2-mot-2-gap).
//  7001   en ensam person i ett stort BAS, med rad i jämförelsestatistiken.
//  7300   en kvinna och en man i ett stort BAS (kostnaden att lyfta henne = hans lön minus hennes).
//
// Jämförelsestatistik finns för varje AID och ställningstagande för varje BAS.
// ===================================================================================
export const KON_BAS = ['Y1', 'Y2', 'Y3'];
export const KON_KV = [22157, 22391, 22613];
export const KON_MA = [44519, 45613, 46817];
export const ENSAM = 31973, X_KV = 33211, X_MA = 41077, PAR_KV = 29417, PAR_MA = 38963;
export const KON_GAP = KON_BAS.flatMap((_, i) => {
    const pct = (KON_KV[i] / KON_MA[i] - 1) * 100, kvot = KON_KV[i] / KON_MA[i] * 100;
    return [pct.toFixed(2), kvot.toFixed(2)].flatMap(s => [s.replace('-', ''), s.replace('-', '').replace('.', ',')]);
});
// Samma gap med en decimal, som Word-utkastet och utskriften skriver det. Bara med tecken: "50.2" ensamt
// är för kort för en textsökning. Plustecknet är direktivets form (EU-lönerapporten, rapportens avsnitt om
// lönetransparens), där kvinnor lägre är ett positivt tal.
export const KON_GAP_1 = KON_BAS.map((_, i) => new RegExp('[-−+]' + ((1 - KON_KV[i] / KON_MA[i]) * 100).toFixed(1).replace('.', '[.,]') + '(?!\\d)'));
// Kostnaden att lyfta de 30 kvinnorna i Y1–Y3 till männens median: 30 × (männens lön − kvinnornas).
export const KON_KOSTNAD = KON_BAS.map((_, i) => 30 * (KON_MA[i] - KON_KV[i]));
// Får aldrig synas utanför undantagen vid 10 eller högre: enskildas och små gruppers löner, männens i Y1–Y3
// och kostnader som räknats ur dem.
export const KON_DOLDA = [...KON_MA, ENSAM, X_KV, X_MA, PAR_KV, PAR_MA, ...KON_KOSTNAD];

export function byggKonDataset() {
    const rader = byggDataset();
    const rad = (bas, kon, lon, aid, namn, alder = 40) => ({ bas, kon, lon, alder, yrke: `${aid} ${namn}`, aid: String(aid), yrkeLabel: namn, enhet: '' });
    KON_BAS.forEach((bas, g) => {
        for (let i = 0; i < 30; i++) rader.push(rad(bas, 'kvinna', KON_KV[g], 7101 + g, `Kvdom ${g + 1}`, 28 + i));
        for (let i = 0; i <= g; i++) rader.push(rad(bas, 'man', KON_MA[g], 7101 + g, `Kvdom ${g + 1}`, 41 + i));
    });
    rader.push(rad('X', 'kvinna', X_KV, 7002, 'Litet'), rad('X', 'kvinna', X_KV, 7002, 'Litet'), rad('X', 'man', X_MA, 7002, 'Litet'), rad('X', 'man', X_MA, 7002, 'Litet'));
    rader.push(rad('S1', 'kvinna', ENSAM, 7001, 'Ensamyrke'));
    rader.push(rad('S3', 'kvinna', PAR_KV, 7300, 'Parjobb'), rad('S3', 'man', PAR_MA, 7300, 'Parjobb'));
    return rader;
}
export const KON_ALLA_BAS = [...STORA, TOPP, ...MELLAN, ...SMA, ...KON_BAS, 'X'];
export function fonsterKon(k) {
    const win = createAppWindow();
    if (k !== null) win.eval(`sattKTroskel(${k}, { fraga: false })`);
    const data = byggKonDataset();
    win.__state.data = data;
    win.__state.policy = KON_ALLA_BAS.map(b => ({ bas: b, p10: 22000, med: 30000, p90: 52000 }));
    // En rad per AID×BAS; medianen ligger över varje lön i underlaget, så att varje grupp hamnar "under jämförelsen".
    const sedda = new Set();
    win.__state.statistik = data.filter(r => !sedda.has(r.aid + '|' + r.bas) && sedda.add(r.aid + '|' + r.bas))
        .map(r => ({ aid: r.aid, bas: r.bas, median: 60000, p10: 55000, p90: 71000 }));
    win.eval('populateSelects(); unlockTabs();');
    return win;
}
export const harNagon = (text, varden) => varden.filter(v => text.includes(String(v)));
export async function laddaXlsx(w) {
    const { readFileSync } = await import('node:fs');
    w.eval(readFileSync(new URL('../../vendor/xlsx.mini.min.js', import.meta.url), 'utf8'));
    w.alert = () => {};
}
// Varje arbetsbok som en export skriver, som { filnamn: text } (ett blad per stycke, celler åtskilda med " | ").
export function fangaBocker(w, kor) {
    const ut = {};
    w.XLSX.writeFile = (wb, namn) => {
        ut[namn] = normalisera(wb.SheetNames.map(b => `[${b}]\n` + w.XLSX.utils.sheet_to_json(wb.Sheets[b], { header: 1, raw: true })
            .map(r => r.map(c => String(c ?? '')).join(' | ')).join('\n')).join('\n'));
    };
    kor();
    return ut;
}
export const utskriftAv = async (w, mall) => {
    // Urvalet ur rapportmodellen: 'komplett' betyder hela dokumentationen.
    w.eval(`sattRapportUrval(${JSON.stringify(mall === 'komplett' ? 'hela' : mall)})`);
    await w.eval('buildPrintReport()');
    return w.document.getElementById('print-report');
};


// Hjälpfunktioner för invarianten I4 och R1: skärmtexten utanför undantagen och varje utdataväg (se
// ktroskel-invarianter.test.js för vad som prövas och inte).
// Låddiagrammet per kön (avvikarna är enskilda löner).
export const INDIVIDDIAGRAM = new Set(['chart-kon-boxplot']);
export const UNDANTAGNA_VYER = '#view-utforska, #view-likvardighet, #personer-att-granska, #outliers-container';

export function skarmtext(w) {
    const ut = [];
    for (const el of w.document.body.querySelectorAll('*')) {
        if (el.closest(UNDANTAGNA_VYER) || el.closest('#print-report') || el.children.length) continue;
        ut.push(`${el.textContent} ${attributtext(el)}`);
    }
    return ut.map(normalisera).join('\n');   // var för sig: annars läses två celler "26 833" och "27 198" som ett tal
}

export async function samlaUtdata(w) {
    const d = w.document;
    const ut = [];
    const lagg = (namn, text) => ut.push([namn, String(text ?? '').split('\n').map(normalisera).join('\n')]);
    await laddaXlsx(w);
    w.URL.createObjectURL = () => 'blob:x';
    // Översikt som efter en inläsning, och en prognos i Löneöversyn så att utfallstabellen finns.
    w.eval('invalidateStatCaches(); renderActionChecklist(); renderProcessTracker(); renderOutliers(); renderDataValidationReport(); refreshCurrentTab();');
    // Påslaget är 100 %: då är varje grupps kostnad lika med gruppens lönesumma, och kostnaden för en
    // ensam person hennes lön — så att en omaskerad kostnad syns i textsökningen.
    Object.assign(w.__state.forecast, { generell: { mode: 'pct', value: 100 }, years: 3 });
    const flikar = [...d.querySelectorAll('.nav-item[data-tab]')].map(e => e.getAttribute('data-tab'));
    for (const f of flikar) { w.__renderTabContent(f); await new Promise(r => setTimeout(r, 0)); }
    w.eval('_forecastRemediation(); _forecastSensitivity();');
    d.getElementById('explore-inkludera-sma').checked = false;
    w.__renderExplorer();
    // Robusthetspanelen (Dokumentera & exportera) räknas bara på knapptryck; här körs den direkt.
    w.eval("_renderRobusthetResult(document.getElementById('robusthet-body'))");
    lagg('robusthetspanelen', d.getElementById('robusthet-body').textContent);
    ut.push(['skärm: alla flikar', skarmtext(w)]);

    lagg('Word-utkastet', w.__docDraftHtml());
    for (const b of w.__rapportunderlagBlock()) lagg(`rapportunderlag: ${b.id}`, w.__ruTillWordHtml(b) + '\n' + w.__ruTillText(b));
    lagg('Att göra-punkter', JSON.stringify(w.eval('buildActionChecklist()')));
    w.eval('window.__csv = null; window.__csvOrig = _downloadCSV; _downloadCSV = rows => { window.__csv = rows; }');
    d.getElementById('btn-export-checklist')?.click();
    lagg('Att göra-CSV', (w.__csv || []).map(r => r.join(' | ')).join('\n'));
    w.eval('_downloadCSV = window.__csvOrig');

    for (const [namn, kor] of [
        ['Excel alla flikar', () => w.eval('exportAllToExcel()')], ['protokollet', () => w.eval('exportJPAProtocol()')],
        ['EU-lönerapporten', () => w.eval('exportEuReport()')], ['handlingsplanen', () => w.eval('exportHandlingsplan()')],
        ['jämförelseexporten', () => w.eval('exportBenchmarkExcel()')], ['Löneöversyn', () => w.eval('exportForecast()')],
        ['Löneöversikten', () => d.getElementById('btn-export-excel').click()],
        ['prioriteringslistan', () => d.getElementById('btn-export-prio-excel').click()],
    ]) {
        const bocker = fangaBocker(w, kor);
        if (!Object.keys(bocker).length) throw new Error(`${namn}: ingen arbetsbok skrevs`);
        for (const [fil, text] of Object.entries(bocker)) lagg(`${namn} (${fil})`, text);
    }
    // ZIP-filens Excel-fil (alla flikar): arbetsboken fångas när den skrivs till zip-filen.
    const zipBocker = [];
    const skriv = w.XLSX.write;
    w.XLSX.write = (wb, opt) => { zipBocker.push(wb); return skriv(wb, opt); };
    w.JSZip = class { file() {} generateAsync() { return Promise.resolve(new w.Blob(['x'])); } };
    w.HTMLAnchorElement.prototype.click = () => {};
    d.getElementById('btn-export-zip').click();
    await new Promise(r => setTimeout(r, 50));
    w.XLSX.write = skriv;
    if (!zipBocker.length) throw new Error('ZIP: Excel-filen skrevs inte');
    for (const wb of zipBocker) lagg('ZIP Excel-filen', wb.SheetNames.map(b => `[${b}]\n` + w.XLSX.utils.sheet_to_json(wb.Sheets[b], { header: 1, raw: true }).map(r => r.join(' | ')).join('\n')).join('\n'));

    // Varje tabell med CSV-knapp och varje ritat diagram, utom de undantagna vyerna (Utforska prövas med rutan av).
    const undantagen = el => !!el.closest('#view-likvardighet, #personer-att-granska, #outliers-container');
    let tabeller = 0, diagram = 0;
    for (const knapp of d.querySelectorAll('[data-csv-table]')) {
        const id = knapp.getAttribute('data-csv-table');
        const t = d.getElementById(id);
        if (!t || undantagen(t)) continue;
        tabeller++;
        lagg(`tabell-CSV: ${id}`, w.__tableToMatrix(id).map(r => r.join(' | ')).join('\n'));
    }
    // Ritade av diagramkärnan (el._figur, ADR-39) — också de utan "chart-" i id:t. Ett diagram som inte får lämna
    // verktyget (markeraUtanExport: Översiktens kopior, Personer att granska) ger ingen diagramdata alls och
    // räknas därför inte som en väg; att det förblir så prövar tests/smoke.test.js.
    for (const el of d.querySelectorAll('[id^="chart-"], #lifecycle-chart')) {
        if (!el._figur || undantagen(el) || INDIVIDDIAGRAM.has(el.id) || !w.__exportTillaten(el)) continue;
        diagram++;
        lagg(`diagramdata: ${el.id}`, w.__chartExportRows(el).map(r => r.join(' | ')).join('\n'));
    }
    if (tabeller < 5 || diagram < 5) throw new Error(`för få tabeller (${tabeller}) eller diagram (${diagram}) prövades`);

    for (const g of w.__gruppdossierCandidates()) {
        w.__renderGruppdossier(g.key);
        lagg(`gruppdossier ${g.key}`, d.getElementById('dossier-body').textContent + '\n' + w.__gruppdossierAsText(w.__buildGruppdossier(g.key)));
    }
    for (const mall of ['komplett', 'ledning', 'facklig']) lagg(`utskrift: ${mall}`, (await utskriftAv(w, mall)).innerHTML.replace(/src="data:[^"]*"/g, ''));
    return ut;
}

// Texten närmast ett funnet värde, för ett felmeddelande som går att följa.
export const sammanhang = (text, v) => { const i = text.indexOf(String(v)); return text.slice(Math.max(0, i - 70), i + 30).replace(/\s+/g, ' '); };

// ===================================================================================
// Ett litet kön i regressionen, Löneöversyn, egna riktade rader och Ålder & karriär.
// ===================================================================================
// 60 kvinnor i två BAS och ett valfritt antal män med olika löner: organisationen är stor nog för
// regressionen (fast golv 5 per kön), men männen kan ligga under redovisningströskeln.
export const SJU_MAN = [41417, 42313, 43719, 44621, 45827, 46933, 47119];
export function fonsterMan(k, manLoner) {
    const w = createAppWindow();
    if (k !== null) w.eval(`sattKTroskel(${k}, { fraga: false })`);
    const rad = (bas, kon, lon, alder) => ({ bas, kon, lon, alder, yrke: '6000 Yrke', aid: '6000', yrkeLabel: 'Yrke', enhet: '' });
    const r = [];
    for (let i = 0; i < 60; i++) r.push(rad(i < 30 ? 'S1' : 'S2', 'kvinna', 25000 + i * 10 + (i % 7) * 130, 30 + (i * 3) % 25));
    manLoner.forEach((l, i) => r.push(rad(i % 2 ? 'S2' : 'S1', 'man', l, 38 + i * 3)));
    w.__state.data = r;
    w.eval('populateSelects(); unlockTabs(); refreshCurrentTab();');
    return w;
}
// Ett tal som det skrivs med två decimaler, med punkt och med komma, utan tecken.
// Ett dolt lönegap får inte synas i någon av de former verktyget skriver det i: som skillnad (två decimaler) och,
// som kvinnors lön i procent av mäns (100 + skillnaden, en eller två decimaler) — med punkt
// eller komma.
export const tvaDec = v => { const s = Math.abs(v).toFixed(2), a1 = (100 + v).toFixed(1), a2 = (100 + v).toFixed(2); return [...new Set([s, a1, a2].flatMap(t => [t, t.replace('.', ',')]))]; };
export const somTal = v => new RegExp(String(v).replace('-', '[-\u2212]').replace('.', '[.,]'));
export const andelText = v => (100 + v).toFixed(1).replace('.', ',');

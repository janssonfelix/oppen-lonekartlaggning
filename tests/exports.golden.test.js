/**
 * Golden-file-tester för Excel-exporterna.
 *
 * Verktygets exporter (JPA-protokoll, "Excel alla flikar", handlingsplans-
 * underlag, EU-rapport, § 3:10) är de juridiskt relevanta leveranserna. Här körs varje
 * export på ett FAST deterministiskt dataset i jsdom (riktiga SheetJS/PapaParse,
 * seedad Math.random för bootstrap), arbetsboken fångas i stället för att
 * skrivas till disk, och hela innehållet normaliseras (datum/klockslag/version
 * → platshållare, tal avrundade) och låses som Vitest-snapshot.
 *
 * Facit = snapshotfilen (tests/__snapshots__/). Vid AVSIKTLIG exportändring:
 * granska diffen och uppdatera med `npx vitest run -u` — snapshot-diffen blir
 * dokumentationen av vad som ändrades i exporten.
 */
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { JSDOM } from 'jsdom';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const html = readFileSync(join(root, 'src', 'index.html'), 'utf8');
const appSrc = readFileSync(join(root, 'dist', 'app.js'), 'utf8').replace(/^﻿/, '');
const xlsxSrc = readFileSync(join(root, 'vendor', 'xlsx.mini.min.js'), 'utf8');
const papaSrc = readFileSync(join(root, 'vendor', 'papaparse.min.js'), 'utf8');

let win, appVersion;

beforeAll(() => {
    const dom = new JSDOM(html, { runScripts: 'outside-only', pretendToBeVisual: true, url: 'http://localhost/' });
    win = dom.window;
    const noop = () => {};
    // alert spelas in i stället för att tystas — flera exporter rapporterar fel
    // via alert, och de meddelandena är diagnostiken vid testfall.
    win.__alerts = [];
    win.alert = msg => { win.__alerts.push(String(msg)); };
    win.confirm = () => true; win.print = noop; win.scrollTo = noop;
    if (!win.requestAnimationFrame) win.requestAnimationFrame = cb => setTimeout(cb, 0);
    if (!win.matchMedia) win.matchMedia = () => ({ matches: false, media: '', addEventListener: noop, removeEventListener: noop, addListener: noop, removeListener: noop, dispatchEvent: () => false });
    win.URL.createObjectURL = () => 'blob:stub';
    win.URL.revokeObjectURL = noop;
    win.JSZip = function JSZip() { return { file: noop, generateAsync: () => Promise.resolve(new Uint8Array()) }; };

    // Riktiga bibliotek (UMD → window): XLSX behövs för att bygga/läsa
    // arbetsböcker, Papa för CSV-vägen (används ej här men app.js wirar den).
    win.eval(papaSrc);
    win.eval(xlsxSrc);

    // Deterministisk slump i realmen — bootstrap-CI:erna blir reproducerbara.
    // __resetSeed() anropas i början av varje fixture-laddning så att två hela
    // körvarv (fixture + exporter) konsumerar identiska slumpströmmar.
    win.eval(`(function(){ let seed = 424242; Math.random = function(){
        seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
        window.__resetSeed = function(){ seed = 424242; }; })();`);

    // Fånga exporterna i stället för att skriva fil.
    win.eval(`window.__captured = {}; `);

    const shim = `
;try {
    XLSX.writeFile = function(wb, name) { window.__captured[name] = wb; };
    Object.assign(window, {
        __state: state,
        __appVersion: (typeof APP_VERSION !== 'undefined' ? APP_VERSION : ''),
        __XLSX: XLSX,
        __docDraftHtml: _buildDocumentationDraftHtml,
        __docxDocumentXml: () => _docxDelar(_utkastTillBlock(_buildDocumentationDraftHtml()), { titel: 'T', sidfot: 'S', skapad: '2026-01-01T00:00:00Z' })['word/document.xml'],
        __buildPrintReport: buildPrintReport,
        __excelBlad: () => ({ besked: excelAlltBlad(), bok: _excelAlltBok().SheetNames }),
        __loadFixture: function() {
            window.__resetSeed();
            // FAST dataset: 2 BAS × 2 yrken — kvinnodominerat + icke-kvinnodominerat
            // i varje BAS (ger § 3:10-par i BAS-läge), formelbaserade löner (ingen
            // slump), åldrar 30–59, n ≥ tröskeln där maskning inte önskas.
            const rows = [];
            const add = (n, bas, aid, label, kon, lon0, step) => {
                for (let i = 0; i < n; i++) rows.push({
                    bas, yrke: aid + ' ' + label, aid, yrkeLabel: label,
                    lon: lon0 + i * step, alder: 30 + (i % 30), kon,
                    poang: null, enhet: '1234'
                });
            };
            add(14, 'B', '5301', 'Undersköterska', 'kvinna', 28000, 100);
            add(3,  'B', '5301', 'Undersköterska', 'man',    29000, 100);
            add(3,  'B', '4100', 'Tekniker',       'kvinna', 32500, 100);
            add(14, 'B', '4100', 'Tekniker',       'man',    33000, 100);
            add(12, 'C', '5500', 'Sjuksköterska',  'kvinna', 31000, 150);
            add(2,  'C', '5500', 'Sjuksköterska',  'man',    32000, 150);
            add(2,  'C', '2000', 'Ingenjör',       'kvinna', 35500, 150);
            add(12, 'C', '2000', 'Ingenjör',       'man',    36000, 150);
            state.data = rows;
            state.dataAudit = { totalRaw: rows.length, excludedNoBas: 0, excludedZeroLon: 0 };
            state.policy = [
                { bas: 'B', p10: 27000, med: 30000, p90: 35000 },
                { bas: 'C', p10: 30000, med: 33500, p90: 39000 }
            ];
            state.statistik = [
                { aid: '5301', bas: 'B', median: 29500, andelKv: 85, aidFull: '5301 Undersköterska' },
                { aid: '4100', bas: 'B', median: 33800, andelKv: 18, aidFull: '4100 Tekniker' },
                { aid: '2000', bas: 'C', median: 36500, andelKv: 15, aidFull: '2000 Ingenjör' }
            ];
            if (state.likvardighet) state.likvardighet.result = null;
            _deriveArbetsvarderingFromData();
            // Rendera vyerna som exporterna plockar tabeller ur
            generateRapport();
            generateSkevhet();
            generateEUDirectiveMatrix();
            renderPrioritering();
            generateBenchmark();
            renderStructure();
            return rows.length;
        },
        __runExports: function() {
            window.__captured = {};
            window.__exportErrors = [];
            window.__alerts.length = 0;
            const safe = (name, fn) => { try { fn(); } catch (e) { window.__exportErrors.push(name + ': ' + (e && e.message || e)); } };
            safe('jpa', exportJPAProtocol);
            safe('alla-flikar', exportAllToExcel);
            safe('handlingsplan', exportHandlingsplan);
            safe('eu-rapport', exportEuReport);
            safe('likvardighet', exportLikvardighet);
            safe('jamforelse', exportBenchmarkExcel);
            // Exporternas interna felhantering rapporterar via alert — lyft in dem.
            for (const a of window.__alerts) window.__exportErrors.push('alert: ' + a);
            return Object.keys(window.__captured);
        }
    });
} catch (e) { window.__bootErr = String(e && e.stack || e); }`;
    win.eval(appSrc + shim);
    if (win.__bootErr) throw new Error('Harness-boot misslyckades: ' + win.__bootErr);
    appVersion = win.__appVersion;
});

/** Normaliserar ett cellvärde: datum/klockslag/version → platshållare, tal avrundas. */
function normCell(v) {
    if (typeof v === 'number') return Math.round(v * 10000) / 10000;
    if (typeof v === 'string') {
        let s = v
            .replace(/\d{4}-\d{2}-\d{2}/g, '<DATUM>')
            .replace(/\d{1,2}:\d{2}(:\d{2})?/g, '<TID>')
            .replace(/<TID>\.\d+Z/g, '<TID>Z')   // ISO-tidsstämpelns millisekunder
            .replace(/\b\d{1,2} \w+ \d{4}\b/g, '<DATUM>');
        if (appVersion) s = s.split(appVersion).join('<VERSION>');
        return s;
    }
    return v;
}

/** Arbetsbok → normaliserad struktur för snapshot-jämförelse. */
function snapshotWorkbook(filename) {
    const wb = win.__captured[filename];
    expect(wb, `exporten "${filename}" fångades inte`).toBeTruthy();
    const X = win.__XLSX;
    const out = {};
    for (const name of wb.SheetNames) {
        const aoa = X.utils.sheet_to_json(wb.Sheets[name], { header: 1, raw: true, defval: null });
        out[name] = aoa.map(row => row.map(normCell));
    }
    return out;
}

describe('golden: Excel-exporterna på fast dataset', () => {
    let filenames;
    beforeAll(() => {
        const n = win.__loadFixture();
        expect(n).toBe(62);
        filenames = win.__runExports();
    });

    it('alla sex exporter producerar arbetsböcker utan fel', () => {
        expect(win.__exportErrors, 'exportfel: ' + JSON.stringify(win.__exportErrors)).toEqual([]);
        expect(filenames.length).toBe(6);
    });

    it('den samlade jämförelseexporten matchar facit', () => {
        const name = filenames.find(f => /lonekartlaggning_jamforelse/i.test(f));
        expect(snapshotWorkbook(name)).toMatchSnapshot();
    });

    it('JPA-protokollet matchar facit', () => {
        const name = filenames.find(f => /jpa|protokoll|lonebedomning/i.test(f));
        expect(snapshotWorkbook(name)).toMatchSnapshot();
    });

    it('"Excel (alla flikar)" matchar facit', () => {
        const name = filenames.find(f => /lonekartlaggning_analys|alla|export/i.test(f)) ||
                     filenames.find(f => !/jpa|protokoll|lonebedomning|handlingsplan|eu_lonerapport|likvardighet/i.test(f));
        expect(snapshotWorkbook(name)).toMatchSnapshot();
    });

    it('handlingsplansunderlaget matchar facit', () => {
        const name = filenames.find(f => /handlingsplan/i.test(f));
        expect(snapshotWorkbook(name)).toMatchSnapshot();
    });

    it('EU-rapporten matchar facit', () => {
        const name = filenames.find(f => /eu_lonerapport/i.test(f));
        expect(snapshotWorkbook(name)).toMatchSnapshot();
    });

    it('§ 3:10-exporten matchar facit', () => {
        const name = filenames.find(f => /likvardighet/i.test(f));
        expect(snapshotWorkbook(name)).toMatchSnapshot();
    });

    it('determinism: en andra körning ger identiska arbetsböcker', () => {
        const first = {};
        for (const f of filenames) first[f] = snapshotWorkbook(f);
        win.__loadFixture();
        const again = win.__runExports();
        expect(again.sort()).toEqual([...filenames].sort());
        for (const f of filenames) expect(snapshotWorkbook(f)).toEqual(first[f]);
    });
});

/**
 * Bladen som byggs ur flikarnas HTML-tabeller, cell för cell med typ och talformat. Tabellstädningen bestämde
 * tidigare inte celltypen själv utan lät kalkylbladsläsaren gissa, och skrev data-sort-value rakt över texten:
 *   - "86 %" tolkades som andelen 0.86 under en rubrik som säger procent (Lonegap, Konsskevhet, Prioritering);
 *   - "17/17", "14/3" och "15/8" i antalskolumnerna tolkades som datum (15 aug 2001 = 37117.9);
 *   - data-sort-value togs i stället för celltexten: gapet (6,4) under rubriken "kvinnors median i % av männens",
 *     andelen −0,0445 under "Avvikelse mot referens (%)", prioriteringsindexet under "Prioriteringsstatus",
 *     gruppens samlade median som "Median Kvinnor" när cellen spänner båda medianerna;
 *   - kolumnformatet valdes på första nyckelordet i rubriken ('median' före '%'), så kvoter fick kronformat.
 * Facit här: ett tal i cellens text blir ett tal med enheten som talformat, allt annat blir text.
 */
describe('golden: bladen ur HTML-tabellerna bär cellerna som vyn visar dem (typ, värde, talformat)', () => {
    const PCT1 = '0.0\\ "%"', PCT2 = '0.00\\ "%"', KR = '#,##0\\ "kr"';
    let X, wb;
    const cell = (blad, adr) => { const c = wb.Sheets[blad][adr]; expect(c, `${blad}!${adr}`).toBeTruthy(); return c; }
    const rad = (blad, r) => X.utils.sheet_to_json(wb.Sheets[blad], { header: 1, raw: true, defval: null })[r];
    beforeAll(() => {
        X = win.__XLSX;
        expect(win.__loadFixture()).toBe(62);
        const filenames = win.__runExports();
        wb = win.__captured[filenames.find(f => /lonekartlaggning_komplett/.test(f))];
        expect(wb).toBeTruthy();
    });
    it('Lonegap: kvoten som procenttal med procentformat, antalen som text, medianerna i kronor', () => {
        expect(rad('Lonegap', 0)).toEqual(['BAS-intervall', 'Antal personer (kvinnor/män)', 'Kvinnors median i % av männens (100% = lika lön)', 'Median Kvinna (kr/mån)', 'Median Man (kr/mån)']);
        expect(cell('Lonegap', 'B2')).toMatchObject({ t: 's', v: '17/17' });      // inte datumet 17 (ogiltigt) eller ett tal
        expect(cell('Lonegap', 'C2')).toMatchObject({ t: 'n', v: 86, z: PCT1 });  // inte 0.86
        expect(cell('Lonegap', 'C3')).toMatchObject({ t: 'n', v: 87.2, z: PCT1 });
        expect(cell('Lonegap', 'D2')).toMatchObject({ t: 'n', v: 28800, z: KR });
        expect(cell('Lonegap', 'E2')).toMatchObject({ t: 'n', v: 33500, z: KR });
        expect(wb.Sheets.Lonegap['!ref']).toBe('A1:E3');                           // bevis-kolumnen följer inte med
    });
    it('Konsskevhet: andelarna i procent, inte som andel av 1', () => {
        expect(cell('Konsskevhet', 'C2')).toMatchObject({ t: 'n', v: 50, z: PCT1 });
        expect(cell('Konsskevhet', 'D2')).toMatchObject({ t: 'n', v: 50, z: PCT1 });
        expect(cell('Konsskevhet', 'B2')).toMatchObject({ t: 'n', v: 34 });
    });
    it('EU-Lonekartlaggning: antalet med könsuppdelningen som text, den samlade medianen som text över båda mediankolumnerna, "–" i stället för 0', () => {
        expect(rad('EU-Lonekartlaggning', 0)[6]).toBe('Lönegap kvinnor/män (kvinnors median i % av männens)');
        expect(cell('EU-Lonekartlaggning', 'B2')).toMatchObject({ t: 's', v: '17 (14/3)' });
        expect(cell('EU-Lonekartlaggning', 'E2')).toMatchObject({ t: 's', v: 'Gruppens median 28 800 kr' });
        expect(wb.Sheets['EU-Lonekartlaggning']['!merges']).toContainEqual({ s: { r: 1, c: 4 }, e: { r: 1, c: 5 } });
        expect(wb.Sheets['EU-Lonekartlaggning'].F2).toBeUndefined();
        expect(cell('EU-Lonekartlaggning', 'G2')).toMatchObject({ t: 's', v: '–' });   // data-sort-value="0" är ett sorteringsvärde, inte ett gap
        expect(cell('EU-Lonekartlaggning', 'H2').v).toMatch(/^Könsuppdelningen är för liten/);
        expect(wb.Sheets['EU-Lonekartlaggning']['!ref']).toBe('A1:H6');            // detaljkolumnen följer inte med
    });
    it('Prioritering: avvikelsen i procent, kronor i kronor, antal kvinnor/män som text, statusen som text', () => {
        const r0 = rad('Prioritering', 0);
        expect(r0[9]).toBe('Lönegap kvinnor/män (%), negativt tal = kvinnor lägre');
        expect(cell('Prioritering', 'E2')).toMatchObject({ t: 's', v: '14/3' });     // inte 14 mars
        expect(cell('Prioritering', 'H2')).toMatchObject({ t: 'n', v: -4, z: PCT2 }); // inte −0.04
        expect(cell('Prioritering', 'I2')).toMatchObject({ t: 'n', v: -1200, z: KR });
        expect(cell('Prioritering', 'M2')).toMatchObject({ t: 's', v: 'Följ upp' });  // inte prioriteringsindexet
        expect(cell('Prioritering', 'A2').z).toBe('0');
        expect(cell('Prioritering', 'A2').v).toBeCloseTo(16.87, 2);                   // sorteringsvärdet förfinar "17"
    });
    it('Löneöversikt och Jamforelsestatistik: kvoten som kvot och skillnaden i procent, inte i kronor', () => {
        expect(rad('Löneöversikt', 1)[5]).toBe('Lönespridning P90/P10 (kvot)');
        expect(cell('Löneöversikt', 'F4')).toMatchObject({ t: 'n', v: 1.2, z: '0.00' });
        expect(cell('Löneöversikt', 'B4')).toMatchObject({ t: 'n', v: 28330, z: KR });
        expect(rad('Jamforelsestatistik', 1)[8]).toBe('Median skillnad mot jämförelsestatistiken (%)');
        expect(cell('Jamforelsestatistik', 'I3')).toMatchObject({ t: 'n', v: -0.89, z: PCT1 });
    });
    it('cellvärdet: talet i texten, sorteringsvärdet bara när det är samma storhet med fler decimaler', () => {
        const v = (html) => win.eval(`(function(){ const tr = document.createElement('tr'); tr.innerHTML = ${JSON.stringify(html)}; return _exportCellVarde(tr.firstElementChild); })()`);
        expect(v('<td data-sort-value="33931.5">33 932 kr</td>')).toEqual({ t: 'n', v: 33931.5, z: KR });
        expect(v('<td data-sort-value="6.4">93,6 %</td>')).toEqual({ t: 'n', v: 93.6, z: PCT1 });       // gapet bakom kvoten
        expect(v('<td data-sort-value="-0.0445">−4,45 %</td>')).toEqual({ t: 'n', v: -4.45, z: PCT2 });  // andelen bakom procenten
        expect(v('<td data-sort-value="43.6">Utred</td>')).toEqual({ t: 's', v: 'Utred' });
        expect(v('<td data-sort-value="46">46 (28/18)</td>')).toEqual({ t: 's', v: '46 (28/18)' });
        expect(v('<td data-sort-value="0">–</td>')).toEqual({ t: 's', v: '–' });
        expect(v('<td>15/8</td>')).toEqual({ t: 's', v: '15/8' });
        expect(v('<td>1,30</td>')).toEqual({ t: 'n', v: 1.3, z: '0.00' });
        expect(v('<td>17</td>')).toEqual({ t: 'n', v: 17 });
        expect(v('<td> </td>')).toBeNull();
    });
});

/**
 * Tecknet i direktivets rapportmått (teknisk-plan § 4). Verktyget räknar (kvinnor − män) / män och visar kvinnors
 * lön i procent av mäns i alla flikar och blad; bara EU-lönerapporten (och rapportens avsnitt om lönetransparens)
 * skriver direktivets lönegap, (män − kvinnor) / män, positivt när kvinnor ligger lägre.
 */
describe('tecknet i EU-lönerapporten (EU 2023/970 art. 9)', () => {
    const blad = (wb, namn) => win.__XLSX.utils.sheet_to_json(wb.Sheets[namn], { header: 1, raw: true, defval: null });
    const text = wb => wb.SheetNames.map(n => `[${n}]\n` + blad(wb, n).map(r => r.join(' | ')).join('\n')).join('\n');
    let eu, alla;
    beforeAll(() => {
        win.__resetSeed();
        // Ett BAS, ett yrke: 12 kvinnor på 46 000 och 12 män på 50 000 — verktygets gap är exakt −8 %.
        const rows = [];
        for (let i = 0; i < 12; i++) for (const [kon, lon] of [['kvinna', 46000], ['man', 50000]])
            rows.push({ bas: 'B', yrke: '5301 Undersköterska', aid: '5301', yrkeLabel: 'Undersköterska', lon, alder: 30 + i * 2, kon, poang: null, enhet: '1234' });
        win.__state.data = rows;
        win.__state.dataAudit = { totalRaw: rows.length, excludedNoBas: 0, excludedZeroLon: 0 };
        win.eval('_deriveArbetsvarderingFromData(); generateRapport(); generateSkevhet(); generateEUDirectiveMatrix(); renderStructure(); window.__captured = {}; exportEuReport(); exportAllToExcel();');
        eu = win.__captured[Object.keys(win.__captured).find(f => /eu_lonerapport/.test(f))];
        alla = win.__captured[Object.keys(win.__captured).find(f => /lonekartlaggning_komplett/.test(f))];
        expect(eu && alla).toBeTruthy();
    });
    it('EU-bladen skriver +8 med direktivets rubrik, i sammanfattningen, per BAS och per percentil', () => {
        const samman = blad(eu, 'Sammanfattning');
        expect(samman.find(r => /medianlön enligt art\. 9/.test(r[0]))).toEqual(['Lönegap i medianlön enligt art. 9 (%), positivt tal = kvinnor lägre', 8]);
        expect(samman.find(r => /medellön enligt art\. 9/.test(r[0]))[1]).toBe(8);
        expect(samman.find(r => r[0] === 'Tecken')[1]).toMatch(/positivt tal = kvinnor lägre/);
        const rep = blad(eu, 'Representation');
        expect(rep[0][4]).toBe('Lönegap enligt art. 9 (%), positivt tal = kvinnor lägre');
        expect(rep.find(r => r[0] === 'B')[4]).toBe(8);
        const dist = blad(eu, 'Distributionellt gap');
        expect(dist[0][3]).toMatch(/^Lönegap enligt art\. 9/);
        for (const r of dist.slice(1)) expect(r[3]).toBe(8);
        // Metodbladet säger vad tecknet betyder, i den här filen och i den allmänna raden.
        const metod = text(eu).split('[Metod & parametrar]')[1];
        expect(metod).toMatch(/Lönegapets tecken i den här filen \| .*positivt tal = kvinnor lägre/);
        expect(metod).toMatch(/Lönegapets tecken \| Verktyget räknar/);
        expect(text(eu)).not.toMatch(/\| -8(\.\d+)? \||\| 92(\.\d+)? \|/);
    });
    it('övriga blad är oförändrade: kvinnors lön i procent av mäns (92), ingen direktivkolumn', () => {
        const t = text(alla);
        expect(t).not.toMatch(/art\. 9 \(%\)/);
        expect(blad(alla, 'Lika arbete per BAS')[2]).toContain('Kvinnors median i % av mäns');
        expect(blad(alla, 'Lika arbete per BAS').find(r => r[0] === 'B')[6]).toBe(92);
        // EU-Lonekartlaggning byggs ur fliktabellen: rubrik och värde hör ihop (kvoten 92, inte gapet 8 ur data-sort-value).
        expect(blad(alla, 'EU-Lonekartlaggning')[0][6]).toBe('Lönegap kvinnor/män (kvinnors median i % av männens)');
        expect(blad(alla, 'EU-Lonekartlaggning')[1][6]).toBe(92);
        expect(t).not.toMatch(/positivt tal = kvinnor lägre \|/);   // ingen kolumn med direktivets tecken
    });
});

/**
 * Golden-lås för Word-utkastet (§§ 8–14) — verktygets mest centrala juridiska
 * leverans. En formatregression (borttappad §-sektion, trasig tabell, försvunnen
 * [HR fyller i]) får inte passera CI, så här snapshot-låses hela `_buildDocumentationDraftHtml()`-utdatan
 * på det fasta 62-raders-datasetet, normaliserad för datum/tid/version/år.
 */
describe('golden: Word-utkastet (§§ 8–14) på fast dataset', () => {
    // Fasta manuella inmatningar så § 8-flödet + org-namnet låses deterministiskt.
    // ALDRIG personnamn/personnummer i testdata — gruppnivåtext.
    const setManual = () => {
        { const f = win.document.getElementById('kl-org-name'); f.value = 'Testorganisationen'; f.dispatchEvent(new win.Event('change')); }
        win.document.getElementById('bes8-status-1').value = 'Åtgärd krävs';
        win.document.getElementById('bes8-note-1').value = 'Fast testanteckning.';
    };

    // Normalisera volatila delar. OBS: tid endast som HH:MM:SS (toLocaleString) —
    // ett bredare \d:\d\d hade träffat §-referenserna "3:10"/"3:11"/"3:13".
    const normalizeDraft = html => {
        let s = html
            .replace(/\d{4}-\d{2}-\d{2}/g, '<DATUM>')          // ISO-datum (today, Exporttidpunkt)
            .replace(/\d{2}:\d{2}:\d{2}/g, '<TID>')            // klockslag (Exporttidpunkt) — ej §-refs
            .replace(/Lönekartläggning \d{4}/g, 'Lönekartläggning <ÅR>');
        if (appVersion) s = s.split(appVersion).join('<VERSION>');
        return s;
    };

    beforeEach(() => {
        // __loadFixture nollställer seed + § 3:10-cachen och renderar om vyerna,
        // så varje test startar från identiskt, reproducerbart tillstånd.
        win.__loadFixture();
        setManual();
    });

    it('matchar facit (snapshot) — inga kvarvarande datum/tid/version', () => {
        const draft = normalizeDraft(win.__docDraftHtml());
        // Facitet ska vara fritt från flyktiga värden innan det låses.
        expect(draft).not.toMatch(/\d{4}-\d{2}-\d{2}/);       // inga ISO-datum
        expect(draft).not.toMatch(/\d{2}:\d{2}:\d{2}/);       // inga klockslag
        expect(appVersion && draft.includes(appVersion)).toBeFalsy();
        expect(draft).toMatchSnapshot();
    });

    it('word/document.xml matchar facit', () => {
        expect(normalizeDraft(win.__docxDocumentXml())).toMatchSnapshot();
    });

    it('determinism: två utkast i rad är identiska (bortsett från exporttidsstämpel)', () => {
        // Reset per anrop: draften konsumerar Math.random via bootstrap-CI:t i
        // computeLikvardighetPairs, och cachar INTE resultatet tillbaka.
        // Jämför NORMALISERAT: metodbilagans "Exporttidpunkt" är väggklockstid (sekund-
        // upplöst) och får skilja om anropen råkar korsa en sekundgräns — det är inte en
        // determinismbrist. Allt annat (inkl. slumpberoende CI) måste vara identiskt.
        win.__loadFixture(); setManual();
        const a = normalizeDraft(win.__docDraftHtml());
        win.__loadFixture(); setManual();
        const b = normalizeDraft(win.__docDraftHtml());
        expect(a).toBe(b);
    });

    it('strukturell sanity: alla lagsteg, [HR fyller i]-block och manuellt innehåll', () => {
        const draft = win.__docDraftHtml();
        ['Regler och praxis kring lön', 'Lika arbete — kvinnor och män i samma yrke', 'Likvärdigt arbete — kvinnodominerade yrken', 'Åtgärder och tidsplan', 'Samverkan med arbetstagarna', 'Beslut och underskrift', 'Bilaga: Metod']
            .forEach(h => expect(draft, `saknar rubrik "${h}"`).toContain(h));
        expect((draft.match(/class="fillin"/g) || []).length).toBeGreaterThanOrEqual(5);
        expect(draft).toContain('Åtgärd krävs');              // § 8-status flödar in
        expect(draft).toContain('Fast testanteckning.');       // § 8-anteckning flödar in
        expect(draft).toContain('Testorganisationen');          // org-namnet flödar in
    });
    it('förhandsbeskedet för Excel listar exakt de blad arbetsboken får', () => {
        win.__loadFixture();
        const { besked, bok } = win.__excelBlad();
        expect(besked.length).toBeGreaterThanOrEqual(7);
        expect(besked).toEqual(bok);
    });
    it('talen bakom översiktstabellen och diagrammen följer med som egna blad', () => {
        win.__loadFixture();
        const { bok } = win.__excelBlad();
        // Testunderlaget har inget yrke med båda könen över tröskeln, så trattdiagrammets blad saknas — som i vyn.
        for (const blad of ['Lika arbete per BAS', 'Lonegap per alder', 'Lönepolitik']) expect(bok, blad).toContain(blad);
        expect(bok).not.toContain('Slumpens granser');
    });
    it('bladet Lönepolitik finns bara med ett ställningstagande, och metodbladet säger då vad det bär', () => {
        win.__loadFixture();
        const X = win.__XLSX, text = wb => wb.SheetNames.map(n => X.utils.sheet_to_json(wb.Sheets[n], { header: 1, raw: true }).map(r => r.join(' | ')).join('\n')).join('\n');
        win.eval('window.__captured = {}; exportAllToExcel();');
        const med = Object.values(win.__captured)[0];
        expect(med.SheetNames).toContain('Lönepolitik');
        expect(text(med)).toMatch(/Bladet Lönepolitik \| Läget i referensens lönespann/);
        win.__state.policy = [];
        win.eval('window.__captured = {}; exportAllToExcel();');
        const utan = Object.values(win.__captured)[0];
        expect(utan.SheetNames).not.toContain('Lönepolitik');
        expect(text(utan)).not.toContain('Bladet Lönepolitik');
    });
});

/**
 * Golden-lås för PDF-/print-rapporten (`buildPrintReport`) — den sista oskyddade
 * HTML-leveransen. Det var här (i struktur-sektionen) andelKv-buggen "5000 %" också
 * satt, sida vid sida med Word-utkastet. Vi kör hela den asynkrona funktionen på det
 * fasta datasetet (window.print är stubbad), fångar det den skriver
 * till `#print-report` och låser innehållet per mall, normaliserat för datum/tid/version.
 */
describe('golden: PDF/print-rapporten (buildPrintReport) på fast dataset', () => {
    const normalize = html => {
        let s = html
            .replace(/\d{4}-\d{2}-\d{2}/g, '<DATUM>')
            .replace(/\d{2}:\d{2}:\d{2}/g, '<TID>')
            .replace(/Lönekartläggning \d{4}/g, 'Lönekartläggning <ÅR>')
            .replace(/data:image\/png;base64,[A-Za-z0-9+/=]+/g, '<PNG>');   // ev. stubbade grafer
        if (appVersion) s = s.split(appVersion).join('<VERSION>');
        return s;
    };

    // Ren start per anrop: __loadFixture nollställer seed + § 3:10-cachen och renderar
    // om vyerna. buildPrintReport konsumerar Math.random (regression, bootstrap-CI).
    const renderPrint = async (template) => {
        win.__loadFixture();
        { const f = win.document.getElementById('kl-org-name'); f.value = 'Testorganisationen'; f.dispatchEvent(new win.Event('change')); }
        win.eval(`sattRapportUrval(${JSON.stringify(template === 'komplett' ? 'hela' : template)})`);   // mallarna är urval ur rapportmodellen
        await win.__buildPrintReport();
        expect(win.__bootErr, 'boot-fel: ' + win.__bootErr).toBeUndefined();
        return win.document.getElementById('print-report').innerHTML;
    };

    it.each(['komplett', 'ledning', 'facklig'])('urvalet "%s" matchar facit', async (template) => {
        const html = normalize(await renderPrint(template));
        expect(html.length, `mallen "${template}" gav tom rapport`).toBeGreaterThan(200);
        expect(html).not.toMatch(/\d{4}-\d{2}-\d{2}/);     // inga ISO-datum kvar
        expect(html).not.toMatch(/\d{2}:\d{2}:\d{2}/);     // inga klockslag kvar
        expect(appVersion && html.includes(appVersion)).toBeFalsy();
        expect(html).toMatchSnapshot();
    });

    it('determinism: komplett-rapporten är identisk två gånger (bortsett från exporttidsstämpel)', async () => {
        // Se Word-utkastets determinismtest: metodbilagans väggklockstidsstämpel
        // normaliseras bort, allt annat (regression, bootstrap-CI) måste vara identiskt.
        const a = normalize(await renderPrint('komplett'));
        const b = normalize(await renderPrint('komplett'));
        expect(a).toBe(b);
    });

    it('struktur-tabellen visar rimlig "Andel kvinnor" (regressionsvakt för 5000 %-buggen)', async () => {
        await renderPrint('komplett');
        const strukturTable = [...win.document.querySelectorAll('#print-report table')]
            .find(t => /Andel kvinnor/.test(t.querySelector('thead')?.textContent || ''));
        expect(strukturTable, 'struktur-tabellen saknas i komplett-rapporten').toBeTruthy();
        const andelCells = [...strukturTable.querySelectorAll('tbody tr')]
            .map(tr => parseFloat(tr.children[2].textContent));
        expect(andelCells.length).toBeGreaterThan(0);
        expect(andelCells.every(n => n >= 0 && n <= 100), `orimlig andel: ${andelCells.join(', ')}`).toBe(true);
    });
});

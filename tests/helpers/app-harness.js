/**
 * Delad jsdom-rigg för de tester som kör hela app.js i ett fönster.
 *
 * Utbruten ur smoke.test.js när kanonymitet.test.js behövde samma rigg:
 * index.html + app.js laddas i jsdom, de tunga biblioteken (XLSX/
 * PapaParse/JSZip) stubbas, och en shim i SAMMA eval exponerar de top-level
 * `const`-bindningar (state m.fl.) som annars inte läcker till window.
 *
 * Varje anrop ger ett FÄRSKT fönster — testfiler delar inte state.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';
import { JSDOM } from 'jsdom';
import { afterAll, afterEach, beforeEach } from 'vitest';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..', '..');
const html = readFileSync(join(root, 'src', 'index.html'), 'utf8');
const d3Src = readFileSync(join(root, 'vendor', 'd3.min.js'), 'utf8');
const appSrc = readFileSync(join(root, 'dist', 'app.js'), 'utf8').replace(/^\uFEFF/, '');

// ---- Minne och kompilering ----
// Sviterna skapar hundratals fönster per fil. Att tolka d3 och app.js (1,3 MB källkod) på nytt i varje fönster och
// låta fönstren leva får arbetaren att bära hundratals levande sidor, och Node-processen kan då krascha i
// skräpsamlaren (SIGSEGV i V8). Därför:
//   1. Skripten kompileras EN gång per arbetare (vm.Script) och körs i varje fönsters sammanhang.
//   2. Fönster stängs när de inte behövs: de som skapas i ett test efter testet, övriga när filen är klar.
const _d3Skript = new vm.Script(d3Src, { filename: 'd3.min.js' });
let _appSkript = null;
const _fonster = new Set();
let _iTest = false;
const _dettaTest = [];
// Ett fönster som testkoden fortfarande pekar på (en variabel i en describe) släpps inte av att stängas: det kostar
// 25 MB tills filen är klar. Verktygets egen rensning tar bort data, diagram och ritat innehåll först, och då
// återstår 15 MB. Ett fönster som ingen pekar på släpps helt.
function _stang(w) {
    _fonster.delete(w);
    // Inget får schemaläggas under nedmonteringen: en uppskjuten omritning (requestAnimationFrame, setTimeout) som
    // hinner köras efter close() hittar inget d3 och skriver "d3 is not defined" i loggen — det enda bruset i CI.
    try { w.requestAnimationFrame = () => 0; w.setTimeout = () => 0; } catch (_e) { /* fönstret är redan stängt */ }
    try { w.eval('typeof _rensaAllData === "function" && _rensaAllData()'); } catch (_e) { /* fönstret är redan stängt eller trasigt */ }
    try { w.close(); } catch (_e) { /* redan stängt */ }
}
beforeEach(() => { _iTest = true; });
afterEach(() => { _iTest = false; for (const w of _dettaTest.splice(0)) _stang(w); });
afterAll(() => { for (const w of [..._fonster]) _stang(w); });

/** @param {{url?: string, html?: string}} [opts] - `html`: en annan sida än src/index.html, t.ex. en organisationsfil (bakaIn på index.html) */
export function createAppWindow({ url = 'http://localhost/', html: sida = html } = {}) {
    const dom = new JSDOM(sida, {
        runScripts: 'outside-only',   // vi kör app.js själva, inte sidans <script src>
        pretendToBeVisual: true,
        url
    });
    const win = dom.window;
    const noop = () => {};

    // --- Stubba browser-API:er jsdom saknar eller som blockerar headless ---
    win.alert = noop;
    win.confirm = () => true;
    win.print = noop;
    win.scrollTo = noop;
    if (!win.requestAnimationFrame) win.requestAnimationFrame = cb => setTimeout(cb, 0);
    if (!win.matchMedia) win.matchMedia = () => ({ matches: false, media: '', addEventListener: noop, removeEventListener: noop, addListener: noop, removeListener: noop, dispatchEvent: () => false });
    win.URL.createObjectURL = () => 'blob:stub';
    win.URL.revokeObjectURL = noop;

    // --- Stubba de tunga biblioteken (rendering/export ska inte krascha) ---
    // Diagramkärnans PNG (figurTillBild, ADR-39) går genom Image och canvas, som jsdom saknar: en bild som "laddas"
    // genast och en canvas som ger en liten PNG. Tester som prövar
    // själva bildvägen sätter egna.
    win.Image = class { set src(u) { this._src = u; setTimeout(() => { if (this.onload) this.onload(); }, 0); } get src() { return this._src; } };
    win.HTMLCanvasElement.prototype.getContext = () => ({ fillRect: noop, drawImage: noop, set fillStyle(_v) {} });
    win.HTMLCanvasElement.prototype.toDataURL = () => 'data:image/png;base64,AAAA';
    win.Papa = { parse: () => ({ data: [], meta: { fields: [] }, errors: [] }), unparse: () => '' };
    win.XLSX = {
        utils: {
            book_new: () => ({ SheetNames: [], Sheets: {} }),
            aoa_to_sheet: () => ({ '!ref': 'A1' }),
            json_to_sheet: () => ({ '!ref': 'A1' }),
            sheet_to_json: () => [],
            book_append_sheet: (wb, ws, name) => { wb.SheetNames.push(name); wb.Sheets[name] = ws; },
            decode_range: () => ({ s: { r: 0, c: 0 }, e: { r: 0, c: 0 } }),
            encode_cell: () => 'A1', encode_range: () => 'A1'
        },
        writeFile: noop, write: () => new Uint8Array()
    };
    win.JSZip = function JSZip() { return { file: noop, folder: () => ({ file: noop }), generateAsync: () => Promise.resolve(new Uint8Array()) }; };

    // --- Kör app.js i fönstrets realm ---
    // Funktionsdeklarationer läcker till globala objektet, men top-level `const`
    // (t.ex. `state`) gör det inte mellan separata eval-anrop. Vi bifogar därför en
    // shim i SAMMA eval som exponerar det vi behöver på window (där är `state` m.fl.
    // lexikalt synliga).
    const shim = `
;try {
    Object.assign(window, {
        __state: (typeof state !== 'undefined' ? state : null),
        __renderTabContent: renderTabContent,
        __loadDemoData: loadDemoData,
        __computeLikvardighetPairs: computeLikvardighetPairs,
        __methodAppendixData: _methodAppendixData,
        __stRepresentationByBas: _stRepresentationByBas,
        __getData: getData,
        __cloneTable: _cloneAndCleanTableForExport,
        __groupedAoa: _groupedCloneToAoa,
        __docDraftHtml: _buildDocumentationDraftHtml,
        __buildConfigSnapshot: buildConfigSnapshot,
        __applyConfigSnapshot: applyConfigSnapshot,
        __bes8Areas: _bes8Areas,
        __renderProcessTracker: renderProcessTracker,
        __tableToMatrix: tableToMatrix,
        __toCsv: _toCsv,
        __clearAllData: clearAllData,
        __autoClearOnInactivity: _autoClearOnInactivity,
        __explorerMinne: () => ({
            rows: _explorerState ? _explorerState.rows.length : 0,
            urval: _urvalDataRef ? _urvalDataRef.length : 0,
            exportFigur: typeof document.getElementById('chart-explore')?._exportFigure
        }),
        __csvFilnamn: namn => _csvFilnamn(namn),
        __tillTsv: _tillTsv,
        __utGroupKey: _utGroupKey,
        __explorerFigure: explorerFigure,
        __explorerTypSkal: explorerTypSkal,
        __explorerDossierTarget: explorerDossierTarget,
        __explorerHandleClick: explorerHandleClick,
        // Kortform för testerna: dimension → värden, uttryckt som urval.
        __explorerSetFilter: f => explorerSattUrval({ lage: 'alla', villkor: Object.entries(f).map(([d, v]) =>
            ({ falt: d === 'alder' ? 'aldersgrupp' : d, op: 'enAv', varde: [...v], inte: false })) }, []),
        __explorerSetUrval: (u, g) => explorerSattUrval(u, g || []),
        __explorerUrval: () => explorerUrval(),
        __renderExplorer: renderExplorer,
        __policyFor: policyFor,
        __bedomningUnderlag: bedomningUnderlag, __ruLikaArbeteGrupper: _ruLikaArbeteGrupper,
        __rapportunderlagBlock: () => rapportunderlagBlock(), __renderRapportunderlag: renderRapportunderlag,
        __kopieraRapportBlock: id => kopieraRapportBlock(id), __kopieraRapportDiagram: id => kopieraRapportDiagram(id), __dataUrlTillBlob: u => _dataUrlTillBlob(u),
        __ruTillWordHtml: _ruTillWordHtml, __guGapUppdelning: _guGapUppdelning, __ifFlaggaIndivider: _ifFlaggaIndivider, __ruTillText: _ruTillText, __dqJamforbaraBas: _dqJamforbaraBas, __K: K_STANDARD,
        __referensNamn: referensNamn, __referensKortnamn: referensKortnamn, __referensKalla: referensKalla,
        __aterstallReferens: aterstallReferens, __sattReferensNamn: sattReferensNamn, __lasInReferens: _lasInReferens,
        __policyLevelLabel: policyLevelLabel,
        __buildLonepolitikModel: buildLonepolitikModel,
        __renderLonepolitik: renderLonepolitik,
        __gruppdossierCandidates: gruppdossierCandidates,
        __buildGruppdossier: buildGruppdossier,
        __renderGruppdossier: renderGruppdossier,
        __openGruppdossier: openGruppdossier,
        __closeGruppdossier: closeGruppdossier,
        __runRobusthet: runRobusthet,
        __gruppdossierAsText: gruppdossierAsText,
        __robusthetLikvardighet: robusthetLikvardighet,
        __robusthetPrioritering: robusthetPrioritering,
        __buildFardigcheck: buildFardigcheck,
        __renderKvalitetssakring: renderKvalitetssakring,
        __updateCompliance: updateCompliance,
        __regressionKronor: _regressionKronor,
        __explanationBudget: _explanationBudget,
        __runOLS: runOLSRegression,
        __renderRegressionCard: renderRegressionCard,
        __chartExportFilename: chartExportFilename,
        __chartExportRows: chartExportRows,
        __attachChartExport: _attachChartExport,
        __exportSkal: () => ({ ...EXPORT_SKAL }), __exportTillaten: exportTillaten, __markeraUtanExport: markeraUtanExport,
        SCATTER_MAX_POINTS,
        __rfMarken: () => Object.keys(_RF_MARKEN),
        __ritaFigur: ritaFigur, __rensaFigur: rensaFigur, __rfTipsAgare: () => _rfTipsAgare, __rfBehallare: () => [..._rfBehallare]
    });
} catch (e) { window.__bootErr = e; }`;
    // Äkta D3 (inte en stubb): diagramkärnan ritar riktig SVG i jsdom.
    const sammanhang = dom.getInternalVMContext();
    _d3Skript.runInContext(sammanhang);
    if (!_appSkript) _appSkript = new vm.Script(appSrc + shim, { filename: 'app.js' });
    _appSkript.runInContext(sammanhang);
    _fonster.add(win);
    if (_iTest) _dettaTest.push(win);
    return win;
}

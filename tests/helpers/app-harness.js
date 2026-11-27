/**
 * Delad jsdom-rigg för de tester som kör hela app.js i ett fönster.
 *
 * index.html + app.js laddas i jsdom, de tunga biblioteken (XLSX/
 * PapaParse/JSZip) stubbas, och en shim i SAMMA eval exponerar de top-level
 * `const`-bindningar (state m.fl.) som annars inte läcker till window.
 *
 * Varje anrop ger ett FÄRSKT fönster — testfiler delar inte state. Tester som bara läser kan dela ett fönster
 * med delatFonster(), som fäller det test som lämnar tillståndet ändrat.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';
import { JSDOM } from 'jsdom';
import * as espree from 'espree';
import { afterAll, afterEach, beforeAll, beforeEach } from 'vitest';
import { byggdText } from '../../tools/build-app.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..', '..');
const html = readFileSync(join(root, 'src', 'index.html'), 'utf8');
const d3Src = readFileSync(join(root, 'vendor', 'd3.min.js'), 'utf8');
const appSrc = readFileSync(join(root, 'dist', 'app.js'), 'utf8').replace(/^\uFEFF/, '');
// Sviten prövar dist/app.js: är bygget inte detsamma som källan ger, prövas en gammal app. Jämförelsen gör samma
// esbuild-steg som bygget (tools/build-app.mjs), så den ser varje fil bygget läser, och den beror inte på filernas tider.
if (byggdText() !== appSrc) throw new Error('dist/app.js är inte byggd ur källan som den ser ut nu: kör `npm run build:app` först.');

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
    // Lyssnarna på medieförfrågningar sparas i __mediaLyssnare, så att ett test kan spela upp ett byte över en brytpunkt.
    win.__mediaLyssnare = [];
    if (!win.matchMedia) win.matchMedia = q => ({ matches: false, media: q, addEventListener: (typ, fn) => win.__mediaLyssnare.push({ media: q, typ, fn }), removeEventListener: noop, addListener: noop, removeListener: noop, dispatchEvent: () => false });
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
        __ritaFlik: ritaFlik,
        __lasInDemodata: lasInDemodata,
        __likvardighetspar: likvardighetspar,
        __metodbilaga: _metodbilaga,
        __hamtaData: hamtaData,
        __tabellkopia: _tabellkopiaForExport,
        __groupedAoa: _grupperadKopiaTillAoa,
        __docDraftHtml: _byggWordUtkastHtml,
        __byggKonfiguration: byggKonfiguration,
        __tillampaKonfiguration: tillampaKonfiguration,
        __bes8Omraden: _bes8Omraden,
        __ritaKartlaggningensSteg: ritaKartlaggningensSteg,
        __tabellTillMatris: tabellTillMatris,
        __tillCsv: tillCsv,
        __rensaAllData: rensaAllData,
        __rensaVidInaktivitet: _rensaVidInaktivitet,
        __utforskaMinne: () => ({
            rows: _utforskaTillstand ? _utforskaTillstand.rows.length : 0,
            urval: _urvalData ? _urvalData.length : 0,
            exportFigur: typeof document.getElementById('chart-explore')?._exportFigure
        }),
        __csvFilnamn: namn => _csvFilnamn(namn),
        __tillTsv: tillTsv,
        __utGruppnyckel: gruppnyckel,
        __utforskaFigur: utforskaFigur,
        __utforskaTypSkal: utforskaTypSkal,
        __utforskaDossiermal: utforskaDossiermal,
        __utforskaVidKlick: utforskaVidKlick,
        // Kortform för testerna: dimension → värden, uttryckt som urval.
        __utforskaSattFilter: f => utforskaSattUrval({ lage: 'alla', villkor: Object.entries(f).map(([d, v]) =>
            ({ falt: d === 'alder' ? 'aldersgrupp' : d, op: 'enAv', varde: [...v], inte: false })) }, []),
        __utforskaSattUrval: (u, g) => utforskaSattUrval(u, g || []),
        __utforskaUrval: () => utforskaUrval(),
        __ritaUtforska: ritaUtforska,
        __policyFor: policyFor,
        __bedomningUnderlag: bedomningUnderlag, __ruLikaArbeteGrupper: likaArbeteGrupper,
        __rapportunderlagBlock: () => rapportunderlagBlock(), __ritaRapportunderlag: ritaRapportunderlag,
        __kopieraRapportBlock: id => kopieraRapportBlock(id), __kopieraRapportDiagram: id => kopieraRapportDiagram(id), __dataUrlTillBlob: u => _dataUrlTillBlob(u),
        __ruTillWordHtml: tillWordHtml, __guGapUppdelning: gapUppdelning, __ifFlaggaIndivider: flaggaIndivider, __ruTillText: tillText, __dqJamforbaraBas: jamforbaraBas, __K: K_STANDARD,
        __referensNamn: referensNamn, __referensKortnamn: referensKortnamn, __referensKalla: referensKalla,
        __aterstallReferens: aterstallReferens, __sattReferensNamn: sattReferensNamn, __lasInReferens: _lasInReferens,
        __policyNivaEtikett: policyNivaEtikett,
        __lonepolitikVymodell: lonepolitikVymodell,
        __ritaLonepolitik: ritaLonepolitik,
        __gruppdossierKandidater: gruppdossierKandidater,
        __byggGruppdossier: byggGruppdossier,
        __ritaGruppdossier: ritaGruppdossier,
        __oppnaGruppdossier: oppnaGruppdossier,
        __stangGruppdossier: stangGruppdossier,
        __korRobusthet: korRobusthet,
        __gruppdossierSomText: gruppdossierSomText,
        __robusthetLikvardighet: robusthetLikvardighet,
        __robusthetPrioritering: robusthetPrioritering,
        __byggFardigcheck: byggFardigcheck,
        __ritaKvalitetssakring: ritaKvalitetssakring,
        __ritaKravstatus: ritaKravstatus,
        __runOLS: korOLSRegression,
        __ritaRegressionskort: ritaRegressionskort,
        __diagramexportFilnamn: diagramexportFilnamn,
        __diagramexportRader: diagramexportRader,
        __laggTillDiagramexport: _laggTillDiagramexport,
        __exportSkal: () => ({ ...EXPORT_SKAL }), __exportTillaten: exportTillaten, __markeraUtanExport: markeraUtanExport,
        PUNKTMOLN_MAX_PUNKTER,
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

/** Vakten för delade fönster: tröskeln, antalet öppna dialoger och den aktiva fliken. */
export function utgangslage(w) {
    const d = w.document;
    return {
        troskel: w.eval('kInstalld()'),
        dialoger: d.querySelectorAll('.glossary-modal[style*="flex"], .yrke-modal[style*="flex"], dialog[open]').length,
        flik: d.querySelector('.nav-item.active')?.getAttribute('data-tab'),
    };
}

// Det som ett delat fönster inte får lämna ändrat: hela state utom beräkningscacharna, urvalet i Utforska, den markerade gruppen och öppna
// dialoger. Fliken räknas inte: att byta flik är att läsa.
const _CACHAR = new Set(['bootstrapCI', 'powerAnalysis', 'result']);
const _somLista = (k, v) => (_CACHAR.has(k) || /cache/i.test(k) ? undefined : v?.constructor?.name === 'Set' || v?.constructor?.name === 'Map' ? [...v] : v);
export function tillstandsavtryck(w) {
    const ut = { urval: JSON.stringify(w.__utforskaUrval()), markering: JSON.stringify(w.eval('diagramMarkering()')), dialoger: utgangslage(w).dialoger };
    for (const k of Object.keys(w.__state)) if (!/cache/i.test(k)) ut[k] = JSON.stringify(w.__state[k], _somLista);
    return ut;
}

// Appens toppnivåminnen: dist/app.js är ett klassiskt skript, så det som deklareras med let, const eller var på
// toppnivån är globalt i fönstret och nås med eval.
let _toppnamn = null;
const toppnivanamn = () => (_toppnamn ??= espree.parse(appSrc, { ecmaVersion: 'latest' }).body
    .filter(s => s.type === 'VariableDeclaration').flatMap(s => s.declarations.map(d => d.id.name)));

/** Ett värde som jämförbar text: Set och Map som listor, ett element som sin tagg och sitt id, en funktion som sin text. */
function _somText(w, v) {
    const sedda = new WeakSet();
    return JSON.stringify(v, (_k, x) => {
        if (typeof x === 'function') return `[funktion ${String(x).length}]`;
        if (!x || typeof x !== 'object') return x;
        if (x instanceof w.Node) return `[${x.nodeName}${x.id ? '#' + x.id : ''}${x.isConnected ? '' : ' utanför dokumentet'}]`;
        if (sedda.has(x)) return '[sedd]';
        sedda.add(x);
        return x instanceof w.Set ? [...x] : x instanceof w.Map ? { Map: [...x] } : x;
    }) ?? String(v);
}

/**
 * Allt i ett fönster som en rensning ska återställa, nycklat så att två fönster kan jämföras post för post:
 * (a) dokumentet: varje element med id (och body) med sina attribut och sitt innehåll, där ett inre element med id står
 * som en hänvisning och jämförs för sig; (b) formulärfältens värden; (c) `state`, hela; (d) toppnivåminnena.
 */
export function fonsteravtryck(w) {
    const d = w.document, ut = {};
    const satt = (nyckel, varde) => { let k = nyckel, i = 1; while (k in ut) k = `${nyckel} (${++i})`; ut[k] = varde; };
    const rita = (n, rot = false) => {
        if (n.nodeType === 3) return n.data;
        if (n.nodeType !== 1) return '';
        const attr = [...n.attributes].map(a => `${a.name}="${a.value}"`).sort().join(' ');
        const text = `<${n.nodeName} ${attr}>${[...n.childNodes].map(c => rita(c)).join('')}</${n.nodeName}>`;
        if (rot || !n.id) return text;
        satt(`dokument #${n.id}`, text);
        return `[#${n.id}]`;
    };
    satt('dokument body', rita(d.body, true));
    satt('dokument title', d.title);
    for (const f of d.querySelectorAll('input, select, textarea')) {
        const namn = f.id || (f.name ? `${f.name}${f.type === 'radio' ? '=' + f.value : ''}` : `i #${f.closest('[id]')?.id}`);
        satt(`fält ${namn}`, f.type === 'checkbox' || f.type === 'radio' ? String(f.checked) : f.value);
    }
    for (const k of Object.keys(w.__state)) satt(`state ${k}`, _somText(w, w.__state[k]));
    for (const n of toppnivanamn()) satt(`toppnivå ${n}`, _somText(w, w.eval(n)));
    return ut;
}

/**
 * Ett fönster som testerna i gruppen delar (hela filen på toppnivå, annars en describe): skapas i beforeAll, stängs i
 * afterAll. Bara för tester som läser; afterEach fäller det test som lämnar tillståndet ändrat, så att nästa test
 * inte passerar eller faller av fel skäl. Håll dem få: varje levande fönster väger 25 MB (se _stang).
 * @param {((w: any) => any)|null} [forbered] - t.ex. `w => w.__lasInDemodata()`
 * @param {() => any} [skapa] - en annan rigg än createAppWindow, t.ex. `() => fonster(25)`
 * @returns {() => any} fönstret
 */
export function delatFonster(forbered, skapa = createAppWindow) {
    let w, avtryck;
    beforeAll(async () => { w = skapa(); await forbered?.(w); avtryck = tillstandsavtryck(w); });
    afterEach(() => {
        const nu = tillstandsavtryck(w), andrat = Object.keys(nu).filter(k => nu[k] !== avtryck[k]);
        if (andrat.length) throw new Error(`Testet ändrade det delade fönstret (${andrat.join(', ')}): det behöver ett eget fönster.`);
    });
    afterAll(() => { if (w) _stang(w); });
    return () => w;
}

// Flikarna som delatFlikfonster klickar fram, i menyns ordning.
export const MENYFLIKAR = ['dashboard', 'bestammelser', 'matrix', 'likvardighet', 'struktur', 'prioritering', 'loneoversyn',
                           'handlingsplan', 'dokumentera', 'rapporttext', 'arbetet', 'kon', 'benchmark', 'utforska'];

/**
 * Ett delat fönster med demodatan som klickar fram varje flik i MENYFLIKAR en gång och sparar en kopia av det som då
 * syns (flikens paneler och sidhuvudet), för tester som söker igenom flikarna: att rita dem är det dyra. Testerna läser
 * kopiorna. Anropas på filens toppnivå, som delatFonster.
 * @param {(w: any) => any} [lasIn] - underlaget; standard är demodatan
 * @param {string[]} [flikar]
 * @returns {{ flikfonster: () => any, ritade: Map<string, {paneler: any[], titel: string}> }}
 */
export function delatFlikfonster(lasIn = w => w.__lasInDemodata(), flikar = MENYFLIKAR) {
    const ritade = new Map();
    const flikfonster = delatFonster(w => {
        lasIn(w);
        for (const flik of flikar) {
            const knapp = w.document.querySelector(`.nav-item[data-tab="${flik}"]`);
            knapp.disabled = false; knapp.click();
            ritade.set(flik, {
                paneler: [...w.document.querySelectorAll('.view-panel')].filter(p => p.style.display === 'block' || p.classList.contains('active')).map(p => p.cloneNode(true)),
                titel: w.document.getElementById('page-title').textContent,
            });
        }
    });
    return { flikfonster, ritade };
}

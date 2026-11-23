// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
import { tillTsv } from '../lib/csv.js';
import { K_STANDARD } from '../lib/ktroskel.js';
import { normaliseraNamn } from '../lib/namn.js';
import { liknarPersonuppgift } from '../lib/organisationspaket.js';
import { regressionslinjensBand } from '../lib/osakerhet.js';
import { namnFranFil } from '../lib/referens.js';
import { kvantil, linjarRegression, median } from '../lib/stat.js';
import { stor } from '../lib/termer.js';
import { meddelaSkarmlasare, esc } from './01-html-och-tillganglighet.js';
import { rapporteraFel } from './03-hjalpfunktioner.js';
import { ikon } from './03-ikoner.js';
import { _cellSpann, aktiveraSortering, kopplaHopfallbaraGrupper } from './05-tabeller-och-lankar.js';
import { _kUndantagFor, _tsvMedStampel } from './06-k-troskel.js';
import { COST_DEFAULTS, DEFAULT_PROFILE, INAKTIVITET_STANDARD_MIN, PRIO_CONFIG_DEFAULTS, PRIO_WEIGHTS_DEFAULTS } from './07-standardinstallningar.js';
import { T } from './09-termer.js';
import { PALETTE } from './10-diagramtema.js';
import { renderProcessTracker, ritaKravstatus } from './13-oversikt.js';
import { renderConsistencyBanner } from './16-inlasningskontroll.js';
import { renderActionChecklist } from './18-atgardslista.js';
import { _laddaNedCSV } from './22-exporthjalpare.js';
import { exportElement, medExportLage } from './23-exportgrind.js';
import { refreshCurrentTab } from './31-navigering.js';
import { renderReferensKort } from './38-referensfiler.js';
/**
 * Appens tillstånd. Fälten som bär inlästa eller beräknade data är löst typade (`any`): deras form
 * beskrivs i respektive modul, och typkontrollen (tsconfig.app.json) vaktar i första hand null-hantering,
 * fältnamn på de fasta delarna och argument till src/lib.
 * @type {{
 *   data: any[], policy: any[], policyNamn: string|null, policyKortnamn: string|null, policyKalla: 'fil'|'paket'|'demo'|null,
 *   statistik: any[], statistikNamn: string|null, statistikKalla: 'fil'|'paket'|'demo'|null,
 *   paket: any, paketInbakat: null|{skapad:string, organisation:string, verktygsversion:string, verktygssha:string, text:string}, isDemo: boolean, demoStort: boolean,
 *   prioConfig: {atgardThreshold: number, akutMinN: number, bevakaThreshold: number, analyseraThreshold: number, [k: string]: any},
 *   prioWeights: {avvikelse: number, volym: number, jamstalldhet: number, [k: string]: any}, costSettings: {[k: string]: any},
 *   utkastPerBas: boolean,
 *   rapportUrval: {ordning: string[], med: string[], fast?: string}|null, rapportTabeller: any[], perBasRecept: any, forraArsbokslut: any,
 *   forklaringsmodell: null|{bas:boolean, alder:boolean, yrkesgrupp:boolean, skal:string},
 *   gapUppdelning: null|{variabler: string[]},
 *   bristAids: Set<string>, scenarios: any[], snapshot: any, profile: {[k: string]: any},
 *   filnamn: {data: string|null, policy: string|null, statistik: string|null}, kTroskel: number,
 *   paketLas: {kTroskelLagst: number|null, inaktivitetMin: number|null, smaGrupperIExport: boolean},
 *   bootstrapCI: any, powerAnalysis: any,
 *   forecast: {
 *     budget: {mode: string, value: number|null}, generell: {mode: string, value: number|null},
 *     targets: any[], minGroupN: number, roundStep: number, years: number,
 *     scenarios: {A: any, B: any}, result: any, _remediation?: any
 *   },
 *   inactivityTimeoutMin: number, kLage: 'skarm'|'export',
 *   likvardighet: {kvinnoTrosholdPct: number, kvDomDefinition: 'do'|'scb', jamforelse: 'alla'|'mansdominerade', minGapPct: number, topN: number, poangBandPct: number, result: any},
 *   lonemanad: string,
 *   arbetsvardering: {byKey: Map<string, number>, [k: string]: any}|null,
 *   columnMap: {[roll: string]: string}|null,
 *   importprofiler: Array<{id: string, namn: string, kalla: string, rubriker: {[roll: string]: string[]}, kannetecken: string[]}>,
 *   importprofil: null|{id: string, namn: string, kalla: string, mappning: {[roll: string]: string}},
 *   ansvarKolumn: {namn: string, giltiga?: any, godkand?: boolean}|null,
 *   forhandskontroll: any, forhandskontrollStopp: boolean,
 *   _dataHeaders: string[],
 *   dataAudit?: any, statistikHasP10?: boolean, statistikHasP90?: boolean, statistikHasKon?: boolean, _interntFel?: any[],
 *   _actionChecklistDone?: Set<string>, _lastStructureFile?: File|null, _lifecycleCache?: any
 *   flerKolumner: {[tabell: string]: boolean},
 *   handlingsplan: {[nyckel: string]: {sakligt: string, ansvarig: string, tidsplan: string, status: string, egen?: boolean, atgard?: string, grupp?: string, skal?: {kategori: string, belopp: number, kommentar: string}[]}},
 * }} Fälten med `?` sätts först vid inläsning (32-filinlasning.js, 29-organisationspaket.js m.fl.) och nollas av 26-rensning.js.
 */
export const state = {
    data: [],        // full dataset, never filtered
    // Referensen (ADR-28): ingen inbyggd — ställningstagandet läses in som fil eller ur ett
    // organisationspaket. policyKalla: null | 'fil' | 'paket' | 'demo'.
    policy: [], policyNamn: null, policyKortnamn: null, policyKalla: null,
    statistik: [], statistikNamn: null, statistikKalla: null,   // statistikKalla: null | 'fil' | 'paket' | 'demo'
    paket: null,     // inläst organisationspaket: { organisation, utgivare, skapat, avserAr, kalla: 'fil'|'inbakat', delar } (ADR-28); delar = paketets validerade delar
    paketInbakat: null,   // paketet som ligger inbakat i den här filen (organisationsfil); läses vid start och efter Rensa all data
    isDemo: false,   // #9: true när syntetisk demodata är inläst (aldrig verklig analys)
    demoStort: false,   // true i det stora demot (5 000 personer, 21-stort-demo.js); bara bannern och filraden läser det
    prioConfig: { ...PRIO_CONFIG_DEFAULTS },
    prioWeights: { ...PRIO_WEIGHTS_DEFAULTS },
    costSettings: { ...COST_DEFAULTS },
    kLage: 'skarm',                    // 'export' medan något som lämnar verktyget ritas eller räknas (ADR-51, 23-exportgrind.js)
    utkastPerBas: true,        // Rapporttextens utkast med ett stycke per BAS-intervall (37-struktur.js); i minnet, inte i filen
    rapportUrval: null,        // rapportens avsnitt: null = hela dokumentationen, annars { ordning, med, fast? } (58-rapportmodell.js)
    rapportTabeller: [],       // egna tabeller i rapporten: recept ur Utforska (src/lib/tabellrecept.js, ADR-52)
    perBasRecept: null,        // receptet för avsnittet per BAS-intervall: null = standard (src/lib/perbas.js, ADR-52)
    forklaringsmodell: null,   // vilka variabler regressionen räknar bort: null = standard (kön + BAS + ålder), ADR-56
    gapUppdelning: null,       // Var uppstår löneskillnaden: { variabler } i ordning; null = standard (BAS, AID), ADR-65
    bristAids: new Set(),         // E: AID-koder markerade som bristyrke
    scenarios: [],                // I: sparade scenarion (max 5)
    snapshot: null,         // för A/B-jämförelse
    forraArsbokslut: null,  // förra årets bokslut ur en inläst konfigurationsfil (ADR-54, src/lib/arsbokslut.js)
    profile: { ...DEFAULT_PROFILE },
    filnamn: { data: null, policy: null, statistik: null },   // filrutornas status (ADR-36)  // #14 lokalkalibrering
    kTroskel: K_STANDARD,             // minsta gruppstorlek för redovisning (ADR-38); ändras bara av sattKTroskel()
    // Organisationspaketets låsningar (ADR-47): golv för tröskeln, låst rensningstid (minuter) och om små grupper
    // får tas med i Utforskas export. Sätts bara av lasInPaket(); Rensa all data återställer dem.
    paketLas: { kTroskelLagst: null, inaktivitetMin: null, smaGrupperIExport: true },
    bootstrapCI: null,                // #10 cache av 95 % KI för mediankvot
    powerAnalysis: null,              // #9 cache av MDE-beräkning

    // Löneöversyn/prognos: budget-först-fördelning (pott → generellt + riktat).
    // Simuleringen rör aldrig state.data — allt räknas på en kopia.
    forecast: {
        budget:   { mode: 'pct', value: null },   // pott: % av lönesumman ELLER krontal/mån
        generell: { mode: 'pct', value: null },   // generellt påslag till alla
        targets:  [],                             // riktade potter per BAS→AID
        minGroupN: 10,                            // rikta endast mot grupper med minst n personer
        roundStep: 0,                             // avrunda nya löner till närmaste steg (0 = av)
        years: 1,                                 // stegvis plan över N år (DiskrL 3:11)
        scenarios: { A: null, B: null },          // sparade scenarier för A/B-jämförelse (ej persisterat)
        result:   null
    },

    // Inaktivitetstimer
    inactivityTimeoutMin: INAKTIVITET_STANDARD_MIN,   // 0 = av, annars antal minuter; på som standard (GDPR art. 25.2)
    // § 3:10 Likvärdighetsanalys — kvinnodom. yrken vs icke-kvinnodom. yrken
    // med ≤ samma BAS-rank (krav-proxy) och högre lön. Båda källor (data,
    // statistik) är giltig arbetsgivardata.
    likvardighet: {
        kvinnoTrosholdPct: 60,
        kvDomDefinition: 'do',     // 'do' (*Mer än X %*) | 'scb' (*X % eller mer*): den enda definitionen i verktyget (ADR-60); nycklarna är historiska och står kvar för sparade konfigurationsfiler (ADR-72)
        jamforelse: 'alla',        // 'alla' som inte är kvinnodominerade | 'mansdominerade' (filtret i Inställningar, ADR-60)
        minGapPct: 0,              // 0 = alla par där jämförelseyrket ligger högre; 5 % är ett valbart filter (ADR-61)
        topN: 20,
        poangBandPct: 5,           // #5: ekvivalensband för arbetsvärderingspoäng (±%)
        result: null               // senaste beräkning för render-tabell + JPA
    },
    // #5: valfri arbetsvärderingstabell (poäng per yrke) som krav-proxy i § 3:10.
    // null = använd BAS-rank. byKey: Map<'AID|BAS' eller 'AID', poäng>.
    arbetsvardering: null,
    // Lönemånaden underlaget gäller (fritext, t.ex. "2026-10"): står på bladen per AID och BAS. Ingen uppgift i
    // lönefilen säger det, så användaren anger den; tomt skrivs ut som "inte angiven".
    lonemanad: '',
    // #11: manuell kolumnmappning (roll → exakt CSV-rubrik) när auto-matchning
    // missar. null = enbart auto-matchning. Sätts via kolumnmappnings-guiden.
    columnMap: null,
    // Importprofiler (src/lib/importprofiler.js): sparade kolumnmappningar som bara bär rubriknamn, med källan
    // 'konfiguration' (konfigurationsfilen eller sparade i sessionen) eller 'organisationspaket'. De inbyggda ligger i
    // lib och står inte här. importprofil: den profil som gällde för den senast inlästa lönefilen, eller null.
    importprofiler: [],
    importprofil: null,
    // Förhandskontrollen av lönefilen (src/lib/forhandskontroll.js, 17-forhandskontroll.js): hur den senast inlästa
    // filen tolkades, med de tio första raderna, eller null. Bara i minnet: ingår inte i konfigurationsfilen eller
    // någon export. vantar: true medan filen väntar på Läs in (forhandskontrollStopp, en inställning, standard av).
    forhandskontroll: null,
    forhandskontrollStopp: false,
    ansvarKolumn: null,   // AID:s ansvarskod: { namn, giltiga } när kolumnen godkänts (ADR-33)
    _dataHeaders: [],   // rubriker från senast inlästa strukturfil (för guiden)
    // Breda tabeller: true när användaren valt Fler kolumner (05-tabeller-och-lankar.js). Bara i minnet, grundvyn som standard.
    flerKolumner: {},
    // Handlingsplanens ifyllda fält per förifylld rad (56-handlingsplan.js): { [nyckel]: { sakligt, ansvarig, tidsplan, status, skal? } }; skal: de sakliga skälen (57-sakliga-skal.js).
    // Bara i minnet; följer med i konfigurationsfilen och exporterna, nollas av Rensa all data.
    handlingsplan: {}
};

/**
 * Returnerar hela datasetet; det finns inget enhetsfilter (se avgränsningen i docs/utveckling/mal.md).
 * @returns {Array<{bas:string, yrke:string, lon:number, alder:number, kon:string, aid?:string, yrkeLabel?:string, ansvarsgrupp?:string, [k:string]:any}>}
 */
export function getData() {
    return state.data;
}
/**
 * Lista av unika BAS-intervall (sorterade alfabetiskt) i aktivt dataset.
 * @returns {string[]}
 */
export function getBasIntervals() {
    return [...new Set(getData().map(d => d.bas))].sort();
}

/**
 * Slår upp lönepolitiskt ställningstagande för en grupp.
 *
 * Policyfilen får blanda tre radtyper: endast BAS (ambition för hela
 * arbetsvärderingsnivån), endast AID (yrkesspecifik ambition oavsett BAS) och
 * AID+BAS (mest specifik). Uppslaget följer specificitetsordning — mest
 * specifik vinner:
 *   1. aid + bas matchar exakt
 *   2. aid matchar, raden saknar bas
 *   3. bas matchar, raden saknar aid
 *   4. ingen träff → null
 *
 * I en fil med enbart BAS-rader saknar alla rader `aid`, så steg 3 ger
 * den första raden med samma BAS.
 *
 * @param {string|null} aid - AID-kod (sifferdel), eller null när den saknas.
 * @param {string|null} bas - BAS-intervall, eller null.
 * @returns {null|{aid?:string, bas?:string, p10:number, med:number, p90:number}}
 */
export function policyFor(aid, bas) {
    const pol = state.policy || [];
    if (!pol.length) return null;
    const a = (aid == null || aid === '') ? null : String(aid).trim();
    const b = (bas == null || bas === '') ? null : String(bas).trim();
    let hit = null;
    if (a && b) { hit = pol.find(p => p.aid === a && p.bas === b); if (hit) return hit; }
    if (a)      { hit = pol.find(p => p.aid === a && !p.bas);      if (hit) return hit; }
    if (b)      { hit = pol.find(p => p.bas === b && !p.aid);      if (hit) return hit; }
    return null;
}

/** Vilken nivå en policyträff kom ifrån — måste visas i UI för att en avvikelse ska gå att tolka. */
export function policyLevelLabel(pol) {
    if (!pol) return null;
    if (pol.aid && pol.bas) return 'AID + BAS';
    if (pol.aid) return 'AID-specifik';
    return stor(T.niva.en);
}

// ---- Referens (ADR-28): egen fil, organisationspaket eller demoläget — ingen inbyggd ----
export function harReferens()      { return state.policy.length > 0; }
export function referensNamn()     { return harReferens() ? (state.policyNamn || 'Eget ställningstagande') : 'Ingen referens inläst'; }
export function referensKortnamn() { return harReferens() ? (state.policyKortnamn || state.policyNamn || 'ställningstagandet') : 'ingen referens'; }
/** Varifrån referensen kommer, som ett tillägg till namnet: " (egen fil)" m.fl.; tomt utan referens. */
export function referensKalla() {
    if (!harReferens()) return '';
    if (state.policyKalla === 'demo') return ' (påhittad, demoläge)';
    if (state.policyKalla === 'paket' && state.paket) return state.paket.kalla === 'inbakat'
        ? ` (organisationspaket inbakat i den här filen: ${state.paket.organisation}, ${state.paket.skapat})`
        : ` (organisationspaket från ${state.paket.organisation}, ${state.paket.skapat})`;
    return ' (egen fil)';
}
/** Jämförelsestatistikens namn och källa, t.ex. "Lönestatistik 2025 (organisationspaket från X, 2026-10-01)". */
export function statistikBeskrivning() {
    if (!state.statistik.length) return 'Ingen jämförelsestatistik inläst';
    const namn = state.statistikNamn || 'Jämförelsestatistik';
    if (state.statistikKalla === 'demo') return `${namn} (påhittad, demoläge)`;
    if (state.statistikKalla === 'paket' && state.paket) return state.paket.kalla === 'inbakat'
        ? `${namn} (organisationspaket inbakat i den här filen: ${state.paket.organisation}, ${state.paket.skapat})`
        : `${namn} (organisationspaket från ${state.paket.organisation}, ${state.paket.skapat})`;
    return `${namn} (egen fil)`;
}
export function aterstallReferens() {
    state.policy = [];
    state.policyNamn = null;
    state.policyKortnamn = null;
    state.policyKalla = null;
}
export function sattReferensNamn(namn) {
    const t = normaliseraNamn(namn);
    if (t && liknarPersonuppgift(t)) return { ok: false, fel: 'Namnet liknar ett personnummer eller en e-postadress och sparades inte.' };
    const n = t || namnFranFil('');
    state.policyNamn = n;
    state.policyKortnamn = n;
    ritaOmReferens();
    return { ok: true };
}
// Allt som namnger eller räknar mot referensen ritas om när den byts eller döps om.
export function ritaOmReferens() {
    for (const fn of [renderReferensKort, refreshCurrentTab, ritaKravstatus, renderConsistencyBanner,
                      renderActionChecklist, renderProcessTracker]) {
        if (typeof fn === 'function') { try { fn(); } catch (e) { rapporteraFel(`Omritning (${fn.name})`, e); } }   // en vy får inte stoppa de andra
    }
}

// ---- Colors & Stats ----
// Härleds ur PALETTE (10-diagramtema.js) så könsfärgerna har EN källa.
export const colors = { kvinna: PALETTE.kon.kvinna, man: PALETTE.kon.man, policy: PALETTE.semantic.policy };

// Statistiska helpers för vyerna; en källa: src/lib/stat.js (tests/stat.test.js prövar den).
export const Stat = { median, kvantil, linjarRegression };

// Talen i indata (_normaliseraTaltext, tolkaTal, tolkaTalStrikt) tolkas i src/lib/inlasning.js och importeras
// under samma namn.

/**
 * 95-procentigt konfidensband för en enkel linjär regressionslinje (regressionslinjensBand i src/lib/osakerhet.js):
 * punkter {x, y, lo, hi} jämnt spridda över [minX, maxX].
 * @param {Array<[number,number]>} data - [x,y]-par
 * @param {number} minX
 * @param {number} maxX
 * @param {number} [steps=30] - antal punkter att returnera
 * @returns {null | Array<{x:number, y:number, lo:number, hi:number}>}
 */
export function linearRegressionCI(data, minX, maxX, steps) {
    return regressionslinjensBand(data, minX, maxX, steps);
}

// ---- Aktivera sortering, kollaps & export på alla huvudtabeller (en gång) ----
// Huvudtabeller som får sortering + kopiera/CSV. Filnamn används vid CSV-export.
const ENHANCED_TABLES = [
    { id: 'rapport-table',      file: 'loneoversikt' },
    { id: 'matrix-table',       file: 'lika-arbete-eu' },
    { id: 'paygap-table',       file: 'lonegap-per-bas' },
    { id: 'la-oversikt',        file: 'lonegap-per-bas-intervall' },
    { id: 'skevhet-table',      file: 'skevhet-per-bas' },
    { id: 'benchmark-table',    file: 'benchmark' },
    { id: 'prio-table',         file: 'prioritering' },
    { id: 'likvardighet-table', file: 'likvardighet' }
];
function initTableEnhancements() {
    ENHANCED_TABLES.forEach(t => { aktiveraSortering(t.id); addTableExportTools(t.id, t.file); });
    kopplaHopfallbaraGrupper('rapport-table');
    kopplaHopfallbaraGrupper('benchmark-table');
}

// ---- Kopiera/CSV per tabell (visualiserings-Steg 3-komplettering) ------------
// Sortering fanns redan (aktiveraSortering); det som saknades var att få UT en
// enskild tabell. En diskret verktygsrad placeras EN gång framför tabellens
// container (utanför det som ritas om vid re-render), och klicken hanteras
// delegerat så att tabellen läses LIVE — sorterad ordning och omritad tbody
// följer med. CSV återanvänder _laddaNedCSV; kopiering ger TAB-separerat så
// att inklistring i Excel hamnar i kolumner.
export function addTableExportTools(tableId, fileBase) {
    const table = document.getElementById(tableId);
    if (!table || table._exportToolsInit) return;
    const anchor = table.closest('.table-container') || table;
    if (!anchor.parentNode) return;
    table._exportToolsInit = true;
    const bar = document.createElement('div');
    bar.className = 'table-tools';
    bar.innerHTML =
        `<button type="button" class="btn-table-tool" data-copy-table="${esc(tableId)}" `
        + `title="Kopiera tabellen (klistras in i Excel som kolumner)" aria-label="Kopiera tabellen till urklipp">${ikon('kopiera', 14)} Kopiera</button>`
        + `<button type="button" class="btn-table-tool" data-csv-table="${esc(tableId)}" data-csv-file="${esc(fileBase)}" `
        + `title="Ladda ner tabellen som CSV" aria-label="Ladda ner tabellen som CSV">${ikon('laddaNed', 14)} CSV</button>`;
    anchor.parentNode.insertBefore(bar, anchor);
    /** @type {any} */ (table)._verktygsrad = bar;   // växeln Fler kolumner (05-tabeller-och-lankar.js) läggs i samma rad
}

// Ren text ur en cell: knappar/ikoner bort, whitespace normaliserad.
function _tableCellText(cell) {
    const clone = cell.cloneNode(true);
    clone.querySelectorAll('button, svg').forEach(e => e.remove());
    _exportText(clone);
    return (clone.textContent || '').replace(/\s+/g, ' ').trim();
}
// Skärmen skriver procenttal med en decimal; exporterna bär talet med två. Ett element med data-export-text får den
// texten i exporten (kopian av tabellen, CSV och Excel), så att avrundningen på skärmen inte följer med ut.
export function _exportText(rot) {
    rot.querySelectorAll('[data-export-text]').forEach(el => { el.textContent = el.getAttribute('data-export-text'); });
}
// Tabell → rad-matris (thead + tbody), i nuvarande (ev. sorterade) DOM-ordning.
// Går alltid genom exportläget (ADR-51): djupräknaren håller skärmen i exportläget tills den sista pågående exporten är klar.
function tableToMatrix(...a) { return medExportLage(() => _tableToMatrixExport.apply(null, /** @type {any} */ (a))); }
function _tableToMatrixExport(tableId) {
    // Raderna lämnar verktyget (CSV, urklipp): exportläget, och tabellens flik ritad med det som gäller nu (ADR-51).
    const table = typeof exportElement === 'function' ? exportElement(tableId) : document.getElementById(tableId);
    if (!table) return [];
    const rows = [];
    // En beskrivning av urvalet (Utforska) blir exportens första rad.
    const beskrivning = table.getAttribute('data-export-beskrivning');
    if (beskrivning) rows.push([`Urval: ${beskrivning}`]);
    const ths = table.querySelectorAll('thead th');
    if (ths.length) rows.push(Array.from(ths).filter(th => !th.hasAttribute('data-export-utelamna')).map(_tableCellText));
    table.querySelectorAll('tbody tr').forEach(tr => {
        // Utforska märker grupper under tröskeln så att exporten utelämnar dem (ADR-14).
        if (tr.hasAttribute('data-export-utelamna')) return;
        const cells = tr.querySelectorAll('th, td');
        if (!cells.length) return;
        // colspan expanderas till tomma celler så matrisen förblir rektangulär.
        // Gruppubriker och noter om minsta gruppstorlek spänner över hela bredden; utan
        // detta blev raden ett enda fält och CSV-/klippbordsexporten hamnade
        // ur fas med rubrikraden.
        const rad = [];
        cells.forEach(c => {
            if (c.hasAttribute('data-export-utelamna')) return;   // hel kolumn utelämnad (ADR-14)
            const span = _cellSpann(c);   // hela bredden, också när växeln Fler kolumner har minskat den på skärmen
            rad.push(c.hasAttribute('data-export-tom') ? '' : _tableCellText(c));
            for (let i = 1; i < span; i++) rad.push('');
        });
        rows.push(rad);
    });
    return rows;
}
// Går alltid genom exportläget (ADR-51): djupräknaren håller skärmen i exportläget tills den sista pågående exporten är klar.
function _copyTableToClipboard(...a) { return medExportLage(() => __copyTableToClipboardExport.apply(null, /** @type {any} */ (a))); }
function __copyTableToClipboardExport(tableId, btn) {
    const rows = tableToMatrix(tableId);
    if (!rows.length) { alert('Tabellen är tom, så det finns inget att kopiera.'); return; }
    _copyMatrixToClipboard(rows, btn, { undantag: _kUndantagFor(document.getElementById(tableId)) });
}
// Rad-matris → TSV i urklipp (_tillTsv, src/lib/csv.js). Delas av tabellverktygen och diagrammens exportmeny.
export function _copyMatrixToClipboard(rows, btn, { undantag = '' } = {}) {
    const tsv = tillTsv(_tsvMedStampel(rows, undantag));
    const done = () => {
        if (typeof meddelaSkarmlasare === 'function') meddelaSkarmlasare('Kopierat: ' + (rows.length - 1) + ' rader.');
        // Knappens innehåll (ikonen och texten) läggs tillbaka som det var.
        if (btn) { const o = btn.innerHTML; btn.textContent = 'Kopierad'; setTimeout(() => { btn.innerHTML = o; }, 1500); }
    };
    const fallback = () => {
        try {
            const ta = document.createElement('textarea');
            ta.value = tsv; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
            document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta); done();
        } catch (_e) { alert('Webbläsaren tillät inte kopieringen. Använd knappen CSV i stället.'); }
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(tsv).then(done).catch(fallback);
    } else { fallback(); }
}

/** Det som körs vid laddning, i filens ordning; src/app/index.js anropar delarnas uppstart i sifferordning. */
export function uppstartTillstand() {
    // Körs när DOM är klar (app.js ligger sist i body)
    initTableEnhancements();
    document.addEventListener('click', e => {
        const copyBtn = /** @type {HTMLElement} */ (e.target).closest('[data-copy-table]');
        if (copyBtn) { _copyTableToClipboard(copyBtn.getAttribute('data-copy-table'), copyBtn); return; }
        const csvBtn = /** @type {HTMLElement} */ (e.target).closest('[data-csv-table]');
        if (csvBtn) {
            const rows = tableToMatrix(csvBtn.getAttribute('data-csv-table'));
            if (rows.length) _laddaNedCSV(rows, csvBtn.getAttribute('data-csv-file') || 'tabell',
                { undantag: _kUndantagFor(document.getElementById(csvBtn.getAttribute('data-csv-table') || '')) });
            else alert('Tabellen är tom, så det finns inget att exportera.');
        }
    });
}

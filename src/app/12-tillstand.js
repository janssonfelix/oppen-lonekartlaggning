// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
/**
 * Appens tillstånd. Fälten som bär inlästa eller beräknade data är löst typade (`any`): deras form
 * beskrivs i respektive modul, och typkontrollen (tsconfig.app.json) vaktar i första hand null-hantering,
 * fältnamn på de fasta delarna och argument till src/lib.
 * @type {{
 *   data: any[], policy: any[], policyNamn: string|null, policyKortnamn: string|null, policyKalla: 'fil'|'paket'|'demo'|null,
 *   statistik: any[], statistikNamn: string|null, statistikKalla: 'fil'|'paket'|null,
 *   paket: any, paketInbakat: null|{skapad:string, organisation:string, verktygsversion:string, verktygssha:string, text:string}, isDemo: boolean,
 *   prioConfig: {atgardThreshold: number, akutMinN: number, bevakaThreshold: number, analyseraThreshold: number, [k: string]: any},
 *   prioWeights: {avvikelse: number, volym: number, jamstalldhet: number, [k: string]: any}, costSettings: {[k: string]: any},
 *   rapportUrval: {ordning: string[], med: string[]}|null, rapportTabeller: any[], perBasRecept: any,
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
 *   likvardighet: {source: string, kvinnoTrosholdPct: number, minGapPct: number, topN: number, poangBandPct: number, result: any},
 *   arbetsvardering: {byKey: Map<string, number>, [k: string]: any}|null,
 *   columnMap: {[roll: string]: string}|null,
 *   ansvarKolumn: {namn: string, giltiga?: any, godkand?: boolean}|null,
 *   _dataHeaders: string[],
 *   dataAudit?: any, statistikHasP10?: boolean, statistikHasP90?: boolean, statistikHasKon?: boolean, _interntFel?: any[],
 *   _actionChecklistDone?: Set<string>, _lastStructureFile?: File|null, _lifecycleCache?: any
 * }} Fälten med `?` sätts först vid inläsning (32-filinlasning.js, 29-organisationspaket.js m.fl.) och nollas av 26-rensning.js.
 */
const state = {
    data: [],        // full dataset, never filtered
    // Referensen (ADR-28): ingen inbyggd — ställningstagandet läses in som fil eller ur ett
    // organisationspaket. policyKalla: null | 'fil' | 'paket' | 'demo'.
    policy: [], policyNamn: null, policyKortnamn: null, policyKalla: null,
    statistik: [], statistikNamn: null, statistikKalla: null,   // statistikKalla: null | 'fil' | 'paket'
    paket: null,     // inläst organisationspaket: { organisation, utgivare, skapat, avserAr, kalla: 'fil'|'inbakat' } (ADR-28)
    paketInbakat: null,   // paketet som ligger inbakat i den här filen (organisationsfil); läses vid start och efter Rensa all data
    isDemo: false,   // #9: true när syntetisk demodata är inläst (aldrig verklig analys)
    prioConfig: { ...PRIO_CONFIG_DEFAULTS },
    prioWeights: { ...PRIO_WEIGHTS_DEFAULTS },
    costSettings: { ...COST_DEFAULTS },
    kLage: 'skarm',                    // 'export' medan något som lämnar verktyget ritas eller räknas (ADR-51, 23-exportgrind.js)
    rapportUrval: null,        // rapportens avsnitt: null = hela dokumentationen, annars { ordning, med } (58-rapportmodell.js)
    rapportTabeller: [],       // egna tabeller i rapporten: recept ur Utforska (src/lib/tabellrecept.js, ADR-52)
    perBasRecept: null,        // receptet för avsnittet per BAS-intervall: null = standard (src/lib/perbas.js, ADR-52)
    bristAids: new Set(),         // E: AID-koder markerade som bristyrke
    scenarios: [],                // I: sparade scenarion (max 5)
    snapshot: null,         // för A/B-jämförelse
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
        source: 'organisation',    // 'organisation' | 'statistik'
        kvinnoTrosholdPct: 60,
        minGapPct: 5,
        topN: 20,
        poangBandPct: 5,           // #5: ekvivalensband för arbetsvärderingspoäng (±%)
        result: null               // senaste beräkning för render-tabell + JPA
    },
    // #5: valfri arbetsvärderingstabell (poäng per yrke) som krav-proxy i § 3:10.
    // null = använd BAS-rank. byKey: Map<'AID|BAS' eller 'AID', poäng>.
    arbetsvardering: null,
    // #11: manuell kolumnmappning (roll → exakt CSV-rubrik) när auto-matchning
    // missar. null = enbart auto-matchning. Sätts via kolumnmappnings-guiden.
    columnMap: null,
    ansvarKolumn: null,   // AID:s ansvarskod: { namn, giltiga } när kolumnen godkänts (ADR-33)
    _dataHeaders: []   // rubriker från senast inlästa strukturfil (för guiden)
};

/**
 * Returnerar hela datasetet; det finns inget enhetsfilter (se §2 i teknisk-plan.md).
 * @returns {Array<{bas:string, yrke:string, lon:number, alder:number, kon:string, aid?:string, yrkeLabel?:string, ansvarsgrupp?:string, [k:string]:any}>}
 */
function getData() {
    return state.data;
}
/**
 * Lista av unika BAS-intervall (sorterade alfabetiskt) i aktivt dataset.
 * @returns {string[]}
 */
function getBasIntervals() {
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
function policyFor(aid, bas) {
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
function policyLevelLabel(pol) {
    if (!pol) return null;
    if (pol.aid && pol.bas) return 'AID + BAS';
    if (pol.aid) return 'AID-specifik';
    return 'BAS-nivå';
}

// ---- Referens (ADR-28): egen fil, organisationspaket eller demoläget — ingen inbyggd ----
function harReferens()      { return state.policy.length > 0; }
function referensNamn()     { return harReferens() ? (state.policyNamn || 'Eget ställningstagande') : 'Ingen referens inläst'; }
function referensKortnamn() { return harReferens() ? (state.policyKortnamn || state.policyNamn || 'ställningstagandet') : 'ingen referens'; }
/** Varifrån referensen kommer, som ett tillägg till namnet: " (egen fil)" m.fl.; tomt utan referens. */
function referensKalla() {
    if (!harReferens()) return '';
    if (state.policyKalla === 'demo') return ' (påhittad, demoläge)';
    if (state.policyKalla === 'paket' && state.paket) return state.paket.kalla === 'inbakat'
        ? ` (organisationspaket inbakat i den här filen: ${state.paket.organisation}, ${state.paket.skapat})`
        : ` (organisationspaket från ${state.paket.organisation}, ${state.paket.skapat})`;
    return ' (egen fil)';
}
/** Jämförelsestatistikens namn och källa, t.ex. "Lönestatistik 2025 (organisationspaket från X, 2026-10-01)". */
function statistikBeskrivning() {
    if (!state.statistik.length) return 'Ingen jämförelsestatistik inläst';
    const namn = state.statistikNamn || 'Jämförelsestatistik';
    if (state.statistikKalla === 'paket' && state.paket) return state.paket.kalla === 'inbakat'
        ? `${namn} (organisationspaket inbakat i den här filen: ${state.paket.organisation}, ${state.paket.skapat})`
        : `${namn} (organisationspaket från ${state.paket.organisation}, ${state.paket.skapat})`;
    return `${namn} (egen fil)`;
}
function aterstallReferens() {
    state.policy = [];
    state.policyNamn = null;
    state.policyKortnamn = null;
    state.policyKalla = null;
}
function sattReferensNamn(namn) {
    const t = _namnNormalisera(namn);
    if (t && _opLiknarPersonuppgift(t)) return { ok: false, fel: 'Namnet liknar ett personnummer eller en e-postadress och sparades inte.' };
    const n = t || _refNamnFranFil('');
    state.policyNamn = n;
    state.policyKortnamn = n;
    ritaOmReferens();
    return { ok: true };
}
// Allt som namnger eller räknar mot referensen ritas om när den byts eller döps om.
function ritaOmReferens() {
    for (const fn of [renderReferensKort, refreshCurrentTab, updateCompliance, renderConsistencyBanner,
                      renderActionChecklist, renderProcessTracker]) {
        if (typeof fn === 'function') { try { fn(); } catch (e) { rapporteraFel(`Omritning (${fn.name})`, e); } }   // en vy får inte stoppa de andra
    }
}

// ---- Colors & Stats ----
// Härleds ur PALETTE (10-diagramtema.js) så könsfärgerna har EN källa.
const colors = { kvinna: PALETTE.kon.kvinna, man: PALETTE.kon.man, policy: PALETTE.semantic.policy };

/**
 * Statistiska helpers: median, kvantiler, linjär regression (OLS).
 *
 * MIRROR: dessa implementationer dubbleras i `src/lib/stat.js` för enhetstest
 * via Vitest (tests/stat.test.js). Vid ändring av en funktion här ska
 * motsvarande funktion i src/lib/stat.js uppdateras — annars går testerna
 * sönder, vilket är en avsiktlig "tripwire" mot tysta regressioner.
 * Used for descriptive statistics throughout the tool.
 */
const Stat = {
    /**
     * Beräknar median (P50) av en talsekvens.
     * @param {number[]} arr - Talvärden (ej tomt).
     * @returns {number} Mittersta värdet i sorterad lista (0 om tom).
     */
    median: arr => {
        if (!arr.length) return 0;
        const s = [...arr].sort((a,b) => a - b);
        const m = Math.floor(s.length / 2);
        return s.length % 2 ? s[m] : (s[m-1] + s[m]) / 2;
    },
    /**
     * Beräknar kvantil via linjär interpolation.
     * @param {number[]} arr - Talvärden.
     * @param {number} q - Kvantil 0..1 (t.ex. 0.1 = P10, 0.5 = median, 0.9 = P90).
     * @returns {number} Kvantilvärdet.
     */
    quantile: (arr, q) => {
        if (!arr.length) return 0;
        const s = [...arr].sort((a,b) => a - b);
        const pos = (s.length - 1) * q;
        const lo = Math.floor(pos), hi = Math.ceil(pos);
        return lo === hi ? s[lo] : s[lo] + (s[hi] - s[lo]) * (pos - lo);
    },
    /**
     * Enkel linjär regression y = m·x + b via minsta kvadrat.
     * @param {Array<[number, number]>} data - Lista av [x, y]-par.
     * @returns {{m: number, b: number, r2: number}} Lutning, intercept, R².
     */
    linearRegression: data => {
        const n = data.length;
        if (n === 0) return { m: 0, b: 0, r2: 0 };
        let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
        for (let i = 0; i < n; i++) {
            sumX += data[i][0]; sumY += data[i][1];
            sumXY += data[i][0] * data[i][1]; sumXX += data[i][0] * data[i][0];
        }
        const m = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
        const b = (sumY - m * sumX) / n;
        const meanY = sumY / n;
        let ssTot = 0, ssRes = 0;
        for (let i = 0; i < n; i++) {
            ssTot += (data[i][1] - meanY) ** 2;
            ssRes += (data[i][1] - (m * data[i][0] + b)) ** 2;
        }
        return { m, b, r2: ssTot > 0 ? 1 - ssRes / ssTot : 0 };
    }
};

/**
 * Normaliserar en talsträng med svensk/engelsk/tysk formatering till en
 * parseFloat-bar sträng. Hanterar tusentalsavgränsare korrekt:
 *   "32 500,50" → "32500.50"   (svensk: mellanslag-tusental, komma-decimal)
 *   "32.500,50" → "32500.50"   (tysk/Excel: punkt-tusental, komma-decimal)
 *   "1,234,567.89" → "1234567.89" (engelsk: komma-tusental, punkt-decimal)
 *   "32,500" → "32500"          (ensam separator + exakt 3 siffror = tusental;
 *                                 löner skrivs inte med tre decimaler)
 *   "32,5" / "32.5" → "32.5"    (decimal)
 *
 * Att bara byta FÖRSTA kommat mot punkt och stryka övriga tecken skulle tyst
 * göra "32.500,50" → 32.5 — tusenfalt fel som inte fångas eftersom 32,5 > 0. Regel: när både . och , förekommer är den SISTA
 * decimaltecken; ensam separator följd av exakt 3-siffergrupper (och
 * heltalsdel ≠ "0") tolkas som tusental.
 *
 * @param {*} raw - Råvärde från CSV-/Excel-cell.
 * @returns {string} parseFloat-bar sträng ("" om inget numeriskt innehåll).
 */
function _normalizeNumberString(raw) {
    let s = raw.toString().trim()
        .replace(/[\s  ']/g, '')       // mellanslag, NBSP, smal NBSP, apostrof-tusental
        .replace(/(kr|sek|:-)\.?$/i, '');         // valutasuffix
    s = s.replace(/[^\d.,\-]/g, '');
    const lastDot = s.lastIndexOf('.'), lastComma = s.lastIndexOf(',');
    if (lastDot !== -1 && lastComma !== -1) {
        // Båda förekommer: den sista är decimaltecknet, den andra tusental.
        if (lastComma > lastDot) s = s.replace(/\./g, '').replace(/,/g, '.');
        else                     s = s.replace(/,/g, '');
    } else if (lastComma !== -1) {
        // Endast komma: flera kommatecken = tusental; ensamt komma med exakt
        // 3-siffergrupper (t.ex. "32,500" / "1,234,567") = tusental; annars decimal.
        if (/^-?[1-9]\d{0,2}(,\d{3})+$/.test(s)) s = s.replace(/,/g, '');
        else                                      s = s.replace(/,/g, '.');
    } else if (lastDot !== -1) {
        // Endast punkt: spegelvänd regel — "32.500" är tusental, "32.5" decimal.
        if (/^-?[1-9]\d{0,2}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
        // annars: punkt är redan decimaltecken
    }
    return s;
}

function parseNumber(v) {
    if (v == null) return 0;
    const n = parseFloat(_normalizeNumberString(v));
    return isNaN(n) ? 0 : n;
}

/**
 * Graderad version av parseNumber som spårar varför
 * en parse misslyckas. Distinguerar tre fall:
 *   - 'empty'   — null/undefined/tom sträng (legitim avsaknad)
 *   - 'invalid' — icke-tomt värde som inte kan tolkas (t.ex. "saknas")
 *   - 'ok'      — giltigt nummer returneras som number
 *
 * Anroparen kan räkna varje kategori separat och visa "icke-tom men ogiltig"-
 * antalet i audit-panelen så användaren ser dataspecifika kvalitetsproblem
 * som annars maskerats av tysta 0-konverteringar.
 *
 * @param {*} v
 * @returns {{status:'ok'|'empty'|'invalid', value:number, raw:*}}
 */
function parseNumberStrict(v) {
    if (v == null) return { status: 'empty', value: 0, raw: v };
    const raw = v.toString();
    if (raw.trim() === '') return { status: 'empty', value: 0, raw };
    const n = parseFloat(_normalizeNumberString(raw));
    if (isNaN(n)) return { status: 'invalid', value: 0, raw };
    return { status: 'ok', value: n, raw };
}

/**
 * Beräknar 95% konfidensband för en enkel linjär regressionslinje.
 * SE av MEDELPREDIKTION vid x: σ × √(1/n + (x−x̄)²/Σ(xi−x̄)²)
 * där σ² = RSS/(n−2). Returnerar punkter med {x, y, lo, hi} jämnt
 * spridda över [minX, maxX].
 *
 * @param {Array<[number,number]>} data - [x,y]-par
 * @param {number} minX
 * @param {number} maxX
 * @param {number} [steps=30] - antal punkter att returnera
 * @returns {null | Array<{x:number, y:number, lo:number, hi:number}>}
 */
function linearRegressionCI(data, minX, maxX, steps = 30) {
    const n = data.length;
    if (n < 3) return null;
    const reg = Stat.linearRegression(data);
    const meanX = data.reduce((s, p) => s + p[0], 0) / n;
    let ssX = 0, rss = 0;
    for (let i = 0; i < n; i++) {
        ssX += (data[i][0] - meanX) ** 2;
        const yhat = reg.m * data[i][0] + reg.b;
        rss += (data[i][1] - yhat) ** 2;
    }
    if (ssX <= 0) return null;
    const sigma2 = rss / Math.max(1, n - 2);
    const Z = 1.96;
    const out = [];
    for (let i = 0; i < steps; i++) {
        const x = minX + (maxX - minX) * (i / (steps - 1));
        const y = reg.m * x + reg.b;
        const se = Math.sqrt(Math.max(0, sigma2 * (1 / n + (x - meanX) ** 2 / ssX)));
        out.push({ x, y, lo: y - Z * se, hi: y + Z * se });
    }
    return out;
}

// ---- Aktivera sortering, kollaps & export på alla huvudtabeller (en gång) ----
// Huvudtabeller som får sortering + kopiera/CSV. Filnamn används vid CSV-export.
const ENHANCED_TABLES = [
    { id: 'rapport-table',      file: 'loneoversikt' },
    { id: 'matrix-table',       file: 'lika-arbete-eu' },
    { id: 'paygap-table',       file: 'lonegap-per-bas' },
    { id: 'skevhet-table',      file: 'skevhet-per-bas' },
    { id: 'benchmark-table',    file: 'benchmark' },
    { id: 'prio-table',         file: 'prioritering' },
    { id: 'likvardighet-table', file: 'likvardighet' }
];
function initTableEnhancements() {
    ENHANCED_TABLES.forEach(t => { enableTableSort(t.id); addTableExportTools(t.id, t.file); });
    setupCollapsibleGroups('rapport-table');
    setupCollapsibleGroups('benchmark-table');
}
// Körs när DOM är klar (app.js ligger sist i body)
initTableEnhancements();

// ---- Kopiera/CSV per tabell (visualiserings-Steg 3-komplettering) ------------
// Sortering fanns redan (enableTableSort); det som saknades var att få UT en
// enskild tabell. En diskret verktygsrad placeras EN gång framför tabellens
// container (utanför det som ritas om vid re-render), och klicken hanteras
// delegerat så att tabellen läses LIVE — sorterad ordning och omritad tbody
// följer med. CSV återanvänder _downloadCSV; kopiering ger TAB-separerat så
// att inklistring i Excel hamnar i kolumner.
function addTableExportTools(tableId, fileBase) {
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
function _exportText(rot) {
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
        // Gruppubriker och k-anonymitetsnoter spänner över hela bredden; utan
        // detta blev raden ett enda fält och CSV-/klippbordsexporten hamnade
        // ur fas med rubrikraden.
        const rad = [];
        cells.forEach(c => {
            if (c.hasAttribute('data-export-utelamna')) return;   // hel kolumn utelämnad (ADR-14)
            const span = Math.max(1, parseInt(c.getAttribute('colspan') || '', 10) || 1);
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
    if (!rows.length) { alert('Ingen tabelldata att kopiera.'); return; }
    _copyMatrixToClipboard(rows, btn, { undantag: _kUndantagFor(document.getElementById(tableId)) });
}
// Rad-matris → TSV i urklipp. Delas av tabellverktygen och diagrammens exportmeny.
// Rad-matris → TSV för urklipp, med samma formelskydd som CSV-exporten.
function _tillTsv(rows) {
    return rows.map(r => r.map(c => (c == null ? '' : _neutraliseraCell(c))).join('\t')).join('\n');
}
function _copyMatrixToClipboard(rows, btn, { undantag = '' } = {}) {
    const tsv = _tillTsv(_tsvMedStampel(rows, undantag));
    const done = () => {
        if (typeof announceToScreenReader === 'function') announceToScreenReader('Kopierat: ' + (rows.length - 1) + ' rader.');
        // Knappens innehåll (ikonen och texten) läggs tillbaka som det var.
        if (btn) { const o = btn.innerHTML; btn.textContent = 'Kopierad'; setTimeout(() => { btn.innerHTML = o; }, 1500); }
    };
    const fallback = () => {
        try {
            const ta = document.createElement('textarea');
            ta.value = tsv; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
            document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta); done();
        } catch (_e) { alert('Kunde inte kopiera automatiskt. Använd CSV-knappen i stället.'); }
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(tsv).then(done).catch(fallback);
    } else { fallback(); }
}
document.addEventListener('click', e => {
    const copyBtn = /** @type {HTMLElement} */ (e.target).closest('[data-copy-table]');
    if (copyBtn) { _copyTableToClipboard(copyBtn.getAttribute('data-copy-table'), copyBtn); return; }
    const csvBtn = /** @type {HTMLElement} */ (e.target).closest('[data-csv-table]');
    if (csvBtn) {
        const rows = tableToMatrix(csvBtn.getAttribute('data-csv-table'));
        if (rows.length) _downloadCSV(rows, csvBtn.getAttribute('data-csv-file') || 'tabell',
            { undantag: _kUndantagFor(document.getElementById(csvBtn.getAttribute('data-csv-table') || '')) });
        else alert('Ingen tabelldata att exportera.');
    }
});


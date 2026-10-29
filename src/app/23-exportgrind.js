// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
// ====================================================================
// 23-exportgrind.js — Exportgrinden (ADR-40)
//
// Flera exporter läser tabeller och diagram ur sidan. När minsta gruppstorlek ändras ritas en flik om först när
// den öppnas, och grinden här ser till att ingen export kan läsa ur en flik som inte är ritad med det som gäller nu.
//
// Två saker tillsammans:
//  1. När tröskeln ändras TÖMS varje flik som inte syns (tomFlikarUtom): tabellkroppar, diagram och flikens topp.
//     En flik som inte syns bär alltså aldrig tal från en tröskel som inte längre gäller, hur den än ritades.
//  2. En räknare (generationen) ökar vid samma tillfälle, och varje flik minns vid vilken generation
//     renderTabContent senast ritade den. De två funktioner som ALL export av tabeller respektive diagram går genom
//     (_cloneAndCleanTableForExport och _chartExportUnderlag) frågar grinden först: en flik som ritades före
//     ändringen ritas om innan något läses ur den. Går det inte, exporteras ingenting ur den — hellre en utebliven
//     export än en med fel tröskel.
// tests/ktroskel.test.js prövar varje exportväg mot detta.
// ====================================================================
// ---- Exportläget (ADR-51) ----
// På skärmen maskeras inget (kTroskel() är 1). Allt som lämnar verktyget ritas och räknas i exportläget, där
// kTroskel() är den inställda tröskeln. Ett byte av läge är som en ändrad tröskel: generationen ökar, så att
// grinden ritar om varje flik som läses, och efteråt ritas skärmen tillbaka. De två funktioner all export av
// tabeller och diagram går genom (_cloneAndCleanTableForExport, _chartExportUnderlag) går själva in i
// exportläget om anroparen inte redan gjort det, så ingen väg kan läsa skärmens omaskade tal.
function iExportLage() { return state.kLage === 'export'; }
function _bytKLage(lage) {
    state.kLage = lage;
    ritGenerationNy();                                                      // allt som är ritat bär det andra läget
    // Inget räknat släpps: Lika arbetes minne har ett rum per tröskel (skärmens och exportens), och skattningarna
    // (statGolv, bootstrap, styrka, § 3:10-paren) är desamma i båda lägena. Livscykelns bevisunderlag hör till det
    // som är ritat.
    state._lifecycleCache = null;
}
/**
 * Ritar skärmen tillbaka efter en export: Översikts delar och den öppna fliken, när grinden ritade dem i exportläget
 * (`ritade`: flikarna som ritades under exporten), utom Dokumentera & exportera, som alltid ritas i exportläget. Det
 * som inte ritades under exporten visar fortfarande skärmens tal och rörs inte — Dokumentera-fliken i sig ritar inga
 * andra flikar, och att rita om Översikt kostar sekunder på stora underlag. Flikar som inte syns töms inte: det de
 * bär är ritat med den inställda tröskeln (försiktigare än skärmen), och de ritas om när de öppnas.
 * @param {Set<string>} ritade
 */
const _OVERSIKT_STEG = new Set(['nyckeltal', 'kompliansöversikt', 'underlagets kvalitet', 'Att göra', 'processöversikten', 'extremvärden', 'inläsningsrapporten', 'A/B-jämförelsen']);
function _ritaOmEfterExport(ritade) {
    if (!state.data.length || typeof _omritningssteg !== 'function') return;
    for (const [namn, fn] of _omritningssteg()) {
        if (namn === 'dokumentera' || namn === 'flikar som inte syns') continue;
        const ska = namn === 'gruppdossiern' || (_OVERSIKT_STEG.has(namn) ? ritade.has('dashboard') : ritade.has(namn));
        if (ska) _omritningForsok(namn, fn);
    }
}
/** Flikarna som är ritade i den generation som gäller nu (under en export: de som ritades i exportläget). */
function _ritadeNu() { return new Set([..._ritadVid].filter(([, g]) => g === _ritGeneration).map(([f]) => f)); }
/**
 * Kör fn i exportläget och går tillbaka till skärmläget efteråt (också när fn ger ett löfte eller kastar).
 * Nästlade anrop byter inte läge. Fn:s värde returneras.
 * @template T
 * @param {() => T} fn
 * @returns {T}
 */
let _exportDjup = 0;   // pågående exporter (nästlade eller överlappande i tid): skärmen ritas tillbaka när den sista är klar
function medExportLage(fn) {
    // Den yttersta exporten byter läge och ritar tillbaka; ett läge som satts utifrån (state.kLage = 'export') rörs inte.
    const yttre = _exportDjup === 0 && !iExportLage();
    if (yttre) _bytKLage('export');
    _exportDjup++;
    let synk = true;
    const tillbaka = () => { _exportDjup = Math.max(0, _exportDjup - 1); if (_exportDjup === 0 && yttre) { const ritade = _ritadeNu(); _bytKLage('skarm'); _ritaOmEfterExport(ritade); } };
    try {
        const r = fn();
        if (r && typeof /** @type {any} */ (r).then === 'function') { synk = false; return /** @type {any} */ (r).finally(tillbaka); }
        return r;
    } finally { if (synk) tillbaka(); }
}

let _ritGeneration = 1;
const _ritadVid = new Map();     // flik → generationen då den senast ritades klart
const _ritasNu = new Set();      // flikar som ritas just nu (ritningen får läsa sina egna diagram)

/** Något som styr vad som får visas har ändrats: allt som är ritat hittills är inaktuellt. */
function ritGenerationNy() { _ritGeneration++; }
function ritGeneration() { return _ritGeneration; }
/** Ritades fliken före den senaste ändringen, utan att ha ritats om sedan dess? */
function flikInaktuell(flik) { return _ritadVid.has(flik) && _ritadVid.get(flik) !== _ritGeneration; }

/** Fliken som äger ett element, eller null för det som ligger utanför flikarna (dialoger, sidhuvud). */
function _egFlikFor(el) {
    const panel = el && el.closest ? el.closest('.view-panel') : null;
    if (!panel) return null;
    const id = panel.id.replace(/^view-/, '');
    for (const [flik, paneler] of Object.entries(PANEL_GROUPS)) if (paneler.includes(id)) return flik;
    return id;
}

/**
 * Ser till att fliken som äger elementet är ritad med det som gäller nu. Svarar sant när elementet får läsas:
 * fliken är aktuell (eller ritas just nu) och elementet sitter kvar i sidan. En omritning kan ha ersatt
 * elementet — då är det gamla inte längre i sidan, och svaret är falskt.
 */
function exportSakra(el) {
    if (!el) return false;
    const flik = _egFlikFor(el);
    if (!flik) return el.isConnected !== false;   // utanför flikarna (en dialog) — eller ett element som inte sitter kvar i sidan
    // En flik som aldrig ritats genom navigeringen (eller är inaktuell) ritas i det läge som gäller nu — i exportläget
    // också en flik som ritats direkt av en vy, så att skärmens tal aldrig läses som export (ADR-51).
    if (!_ritasNu.has(flik) && (flikInaktuell(flik) || (iExportLage() && !_ritadVid.has(flik)))) {
        try { renderTabContent(flik); } catch (e) { rapporteraFel(`exportgrinden (${flik})`, e); }
        if (flikInaktuell(flik)) return false;                      // fliken gick inte att rita om: ingenting exporteras ur den
    }
    return el.isConnected !== false;
}

/** Elementet med det id:t, efter att dess flik har säkrats. Null om det saknas eller inte får läsas. */
function exportElement(id) {
    const el = document.getElementById(id);
    if (!el) return null;
    if (!exportSakra(el)) { const ny = document.getElementById(id); return ny && ny !== el && exportSakra(ny) ? ny : null; }
    return document.getElementById(id);
}

/** Ritar om varje flik som har ritats någon gång men inte är aktuell — före en export som tar "allt som är ritat" (ZIP). */
function exportSakraAlla() {
    for (const flik of [..._ritadVid.keys()]) {
        if (!flikInaktuell(flik) || _ritasNu.has(flik)) continue;
        try { renderTabContent(flik); } catch (e) { rapporteraFel(`exportgrinden (${flik})`, e); }
    }
}

/**
 * Tömmer det ritade innehållet i varje flik utom dem i `utom` (den öppna fliken och Översikt, som ritas om direkt).
 * Anropas när tröskeln ändras: en flik som inte syns ska inte bära tal från en tröskel som inte längre gäller —
 * varken i tabeller, i diagrammens figurer eller i flikens topp. Fliken ritas på nytt när den öppnas eller när en
 * export behöver den. Samma behållare som "Rensa all data" tömmer (26-rensning.js); sidans fasta texter rörs inte.
 */
function tomFlikarUtom(utom = new Set()) {
    const ska = el => { const flik = _egFlikFor(el); return !!flik && !utom.has(flik); };
    for (const id of [...RENSA_BEHALLARE, ...RENSA_OVRIGT]) { const el = document.getElementById(id); if (el && ska(el)) el.innerHTML = ''; }
    for (const id of RENSA_TABELLER) { const tb = document.querySelector(`#${id} tbody`); if (tb && ska(tb)) tb.innerHTML = ''; }
    if (typeof _rfBehallare !== 'undefined') for (const el of [..._rfBehallare]) if (!el.isConnected || ska(el)) { rensaFigur(el); el.innerHTML = ''; }
    document.querySelectorAll('.view-panel [id^="chart-"]:not(.chart-export-meny)').forEach(el => { if (ska(el)) el.innerHTML = ''; });
    document.querySelectorAll('.view-panel .slutsatser, .view-panel .urvalsrad:not(#ak-urval)').forEach(el => { if (ska(el)) el.innerHTML = ''; });
    { const t = document.getElementById('ak-urval-text'); if (t && ska(t)) t.textContent = ''; }   // väljaren i samma rad hör till sidan
    document.querySelectorAll('.view-panel .avsnitt-nyckel').forEach(el => { if (ska(el)) { el.textContent = ''; el.classList.remove('ar-kritisk'); } });
    const tryck = document.getElementById('print-report');
    if (tryck) tryck.innerHTML = '';     // en färdig utskrift bär kopior av tabellerna
}

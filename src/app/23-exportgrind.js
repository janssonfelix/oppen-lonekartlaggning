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
    if (!_ritasNu.has(flik) && flikInaktuell(flik)) {
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

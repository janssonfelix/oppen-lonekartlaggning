// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
// ---- Uppstart: körs sist, när alla delar är definierade ----
// Här samlas anrop som ska köras en gång vid laddning och som inte hör till en enskild flik.
// Rendera process-trackern på Översikt redan vid boot (utan data) — den ska greeta
// användaren med steg 1 "börja här". Därefter uppdateras den vid
// varje datahändelse. Vaktad: funktionen finns (13-oversikt.js) och gör inget om
// dess container saknas.
if (typeof renderProcessTracker === 'function') {
    try { renderProcessTracker(); } catch (_e) { /* icke-kritisk vid boot */ }
}
setupTabA11y();
applyProfileLabels();  // Tillämpa default-profil vid uppstart
_synkaKTroskel();      // ADR-38: fyll texter som nämner minsta gruppstorlek
renderReferensKort();  // ADR-28: visa vilken referens som används redan före uppladdning

// Demosidan: adressen ?demo=1 startar demoläget direkt, så att
// en länk från webbplatsen öppnar verktyget med påhittad data. Ingen annan parameter och
// inget annat värde läses — adressen kan aldrig föra in data eller inställningar.
try {
    const demo = new URLSearchParams(window.location.search).get('demo') === '1';
    if (demo && !state.data.length) loadDemoData();
    // Organisationsfil: paketet som ligger inbakat i den här filen läses in vid start — utom i demoläget,
    // som går före (organisationsfil-design.md §3).
    // Blocket ligger sist i filen, efter skriptet: när skriptet körs medan sidan ännu laddas finns det inte i
    // DOM:en förrän dokumentet är klart (i jsdom-riggen körs skriptet efter hela dokumentet).
    const inbakat = () => {
        if (!demo && typeof lasInInbakatPaket === 'function') lasInInbakatPaket();
        else if (demo && document.getElementById('inbakat-organisationspaket') && typeof _paketStatus === 'function') _paketStatus('Det inbakade paketet används inte i demoläget.', false);
    };
    // Finns blocket redan (dokumentet färdigtolkat, t.ex. i testriggen) läses det direkt; annars när dokumentet är klart.
    if (document.getElementById('inbakat-organisationspaket') || document.readyState !== 'loading') inbakat();
    else document.addEventListener('DOMContentLoaded', inbakat, { once: true });
} catch (_e) { /* icke-kritisk vid boot */ }

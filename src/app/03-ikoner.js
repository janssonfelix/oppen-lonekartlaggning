// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
// ====================================================================
// 03-ikoner.js — Ett bildspråk: linjeikoner i stället för bildtecken
//
// Statusmärken och dekoration ritas med samma linjeikoner som menyn, inte med bildtecken (emoji): en form i textens färg, alltid tillsammans med ord. En ikon är dekoration
// (aria-hidden) — betydelsen står i texten bredvid, så skärmläsare och exporter får ren text. Exporterna läser
// tabellernas text och får därför statusens namn utan märke ("Värt att granska"), inte ett bildtecken.
//
// Ikonerna är inline-SVG (inga filer, inget typsnitt): 24 × 24, linjer i currentColor.
// ====================================================================
const _IKON = {
    nal:       '<path d="M12 22s7-6.2 7-12a7 7 0 1 0-14 0c0 5.8 7 12 7 12z"/><circle cx="12" cy="10" r="2.5"/>',
    oga:       '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    sok:       '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
    las:       '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
    lasOppen:  '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 7.5-2"/>',
    kolv:      '<path d="M9 3h6"/><path d="M10 3v6l-5 9a2 2 0 0 0 1.8 3h10.4a2 2 0 0 0 1.8-3l-5-9V3"/><path d="M7.5 15h9"/>',
    bock:      '<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>',
    ruta:      '<rect x="4" y="4" width="16" height="16" rx="2"/>',
    delvis:    '<circle cx="12" cy="12" r="9"/><path d="M12 3a9 9 0 0 1 0 18z" fill="currentColor"/>',
    streck:    '<path d="M6 12h12"/>',
    lampa:     '<path d="M9 18h6"/><path d="M10 21h4"/><path d="M12 3a6 6 0 0 0-4 10.5c.8.8 1 1.5 1 2.5h6c0-1 .2-1.7 1-2.5A6 6 0 0 0 12 3z"/>',
    dokument:  '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/>',
    tomLada:   '<path d="M3 13h5l1.5 3h5L16 13h5"/><path d="M5 5h14l2 8v6H3v-6z"/>',
    blixt:     '<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>',
    stopp:     '<circle cx="12" cy="12" r="9"/><path d="M6 6l12 12"/>',
    kugghjul:  '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1"/>',
    klocka:    '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    info:      '<circle cx="12" cy="12" r="9"/><path d="M12 16v-4"/><path d="M12 8h.01"/>',
    pilUpp:    '<path d="M12 19V5"/><path d="m6 11 6-6 6 6"/>',
    pilNed:    '<path d="M12 5v14"/><path d="m6 13 6 6 6-6"/>',
    kryss:     '<path d="M6 6l12 12"/><path d="M18 6 6 18"/>',
    laddaNed:  '<path d="M12 4v11"/><path d="m7 11 5 5 5-5"/><path d="M5 20h14"/>',
    kopiera:   '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 0 1 2-2h9"/>',
    pilUt:     '<path d="M7 17 17 7"/><path d="M9 7h8v8"/>',
    ater:      '<path d="M4 12a8 8 0 1 0 2.6-5.9"/><path d="M4 4v5h5"/>',
    // Statusmärken: fyra FORMER, så att statusen inte bärs av färgen ensam.
    statusKritisk: '<circle cx="12" cy="12" r="8" fill="currentColor"/>',
    statusVarning: '<path d="M12 4 21 20H3z" fill="currentColor"/>',
    statusOsaker:  '<circle cx="12" cy="12" r="8"/><path d="M12 4a8 8 0 0 1 0 16z" fill="currentColor"/>',
    statusIngen:   '<circle cx="12" cy="12" r="8"/>'
};
/** En linjeikon som HTML-text. Dekoration: aria-hidden, och betydelsen ska stå i texten bredvid. */
function ikon(namn, storlek = 16) {
    const inre = _IKON[namn];
    if (!inre) return '';
    return `<svg class="ikon ikon-${namn}" width="${storlek}" height="${storlek}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${inre}</svg>`;
}

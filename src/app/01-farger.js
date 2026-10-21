// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
// ====================================================================
// 01-farger.js — statusfärgerna, på ETT ställe
//
// Vyernas mallar skriver färgen som hexkod i markeringen (det som kopieras till urklipp och Word bär inte med sig
// stilmallens variabler). Mallarna, paletten (10-diagramtema.js) och stilmallen (--status-* i src/style.css)
// hämtar samma värden härifrån, så att en status har samma färg i alla flikar (ADR-43); tests/farger.test.js
// håller hexkoderna borta från resten.
// Diagrammens egna färger (kön, serier, färgskalor) står i paletten i 10-diagramtema.js och hör inte hit.
//
// Varje status har tre nyanser: texten, brickans botten (Bg) och en ljusare yta för hela rutor (Yta). Texten har
// minst 4,5:1 mot vitt, mot sin Bg och mot sin Yta (WCAG 1.4.3) — utom info, som därför har en mörkare textnyans
// (infoMork) för text på färgad botten. Varje betydelse har en enda nyans.
// ====================================================================
const FARG = Object.freeze({
    kritisk: '#b91c1c', kritiskBg: '#fee2e2', kritiskYta: '#fef2f2',     // avvikelse över gränsen, fel
    varning: '#b45309', varningBg: '#fef3c7', varningYta: '#fffbeb',     // håll uppsikt
    ok: '#0f766e', okBg: '#ecfdf5', okYta: '#f0fdf4',                    // inom gränsen, klart
    // «Titta här först» utan att påstå att något är fel: Värt att granska, Börja här.
    granska: '#4338ca', granskaLjus: '#6366f1', granskaBg: '#eef2ff',
    info: '#0284c7', infoMork: '#0369a1', infoBg: '#e0f2fe', infoYta: '#f0f9ff',   // upplysning, «analysera»
    // Kanten runt en färgad ruta, en per status.
    kritiskKant: '#fecaca', varningKant: '#fde68a', okKant: '#a7f3d0', granskaKant: '#c7d2fe',
    // Neutrala: text i tre styrkor plus en blek för det minst viktiga, kanter och ytor. Samma värden som stilmallens
    // --text-main, --text-muted, --border och --bg-card.
    vit: '#ffffff', text: '#161a22', dampad: '#475569', svag: '#64748b', blek: '#94a3b8',
    kant: '#e1e5ec', kantStark: '#cbd5e1', yta: '#f8fafc', ytaStark: '#f1f5f9',
    // Blå accent för länkar, rubriker i faktarutor och upplysande ytor (inte verktygets knappfärg, --primary).
    accent: '#2563eb', accentMork: '#1e3a8a', accentYta: '#eff6ff', accentKant: '#bfdbfe',
});

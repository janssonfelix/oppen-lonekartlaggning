// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
// ====================================================================
// 10-diagramtema.js — Delat diagram-tema (visualiserings-Steg 1)
//
// ENDA KÄLLA för diagrammens färger och typografi: paletten (kön, status, serier, färgskalor) och diagrammens
// teckensnitt. Diagramkärnan (10-diagramritare.js, ADR-39) och vyernas figurer läser härifrån — ingen vy har en
// egen hexkod.
// ====================================================================

// Kanonisk färgpalett. All könsfärgning och alla semantiska färger härleds
// härifrån (se `const colors` i 12-tillstand.js, som speglar PALETTE.kon).
const PALETTE = {
    // Kön — genomgående i hela verktyget. Plommon för kvinnor och olivgrönt för män (beslut 2026-10-17):
    // inte rosa och blått, som kopplar färgen till en stereotyp. Båda har minst 4,5:1 mot vit yta (7,1 och
    // 4,6), skiljer sig mer än det tidigare paret vid simulerad protanopi och deuteranopi, och ligger tydligt ifrån
    // statusfärgerna (granska, ok, varning) och seriefärgerna. Kön står alltid också med ord i legenden.
    // Prövas i tests/farger.test.js.
    kon: { kvinna: '#833a8f', man: '#5f7f16' },
    // Semantiska statusfärger (avvikelse/varning/ok m.m.).
    semantic: {
        policy:   '#d24723',
        // Statusfärgerna har minst 3:1 i kontrast mot vit bakgrund (WCAG 1.4.11) och skiljer sig i ljushet och
        // ton också för den som har svårt att skilja rött från grönt: mörkt rött, mellanljus bärnsten, blågrönt.
        kritisk:  FARG.kritisk,
        varning:  '#d97706',
        ok:       FARG.ok,
        neutral:  FARG.svag,
        referens: FARG.svag,
        linje:    FARG.dampad,   // mörk neutral linje (P90, felstaplar)
        trend:    '#1c5cab',   // trendlinje över punkter i seriens första färg
        spann:    '#d5dae3',   // referensens spann (P10–P90) bakom organisationens
        mork:     FARG.text    // markörer som ska synas mot både röd och grön stapel
    },
    // Kvalitativ serie-palett för diagram med många kategorier (t.ex. AID).
    // De åtta första i den här ordningen klarar kontrollen för färgblindhet mellan grannar. De fyra sista är mörkare
    // steg av de fyra första, för de få vyer som har fler än åtta serier (Utforska tillåter tolv segment).
    serie: ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#4a3aa7', '#e34948',
            '#184f95', '#a84418', '#0f7a55', '#8a6a00'],
    // Divergerande skala för heatmaps, centrerad på neutral mitt.
    // Låg (rött) = kvinnors median klart under männens; hög (blått) = över.
    // Två kulörer och en neutral mitt: varmt åt ena hållet, kallt åt det andra (fler kulörer läses som regnbåge).
    divergerande: [
        [0.0, '#a5371a'], [0.25, '#e59a7b'], [0.5, '#eeeeec'],
        [0.75, '#86b6ef'], [1.0, '#1c5cab']
    ],
    // Sekventiell (enkelriktad) skala: ljus → varm/röd. Används där måttet bara
    // går åt ett håll, t.ex. § 3:10-gapet (jämförelseyrket tjänar mer → rödare).
    // En kulör från ljus till mörk.
    sekventiell: [[0.0, '#fbe3d6'], [0.5, '#e8703c'], [1.0, '#8a2f10']],
    // Neutral sekventiell skala för mått där högt varken är bra eller dåligt (lön, antal).
    sekventiellNeutral: [[0, '#dce9fb'], [0.5, '#5598e7'], [1, '#0d366b']],
    // Prioriteringsmatrisens statusar (samma nyanser som statusbrickorna i fliken).
    // Prioriteringens statusar. «Börja här» och «Värt att granska» är lila — samma färg som statusen «Värt att granska»
    // i Lika arbetes yrkesgruppstabell (lila överallt, inte rött). Lila säger «titta
    // här först» utan att påstå att något är fel; rött är förbehållet avvikelser över 5 %.
    prio: { akut: FARG.granska, atgard: FARG.granskaLjus, bevaka: '#d97706', ok: FARG.ok, analysera: FARG.info }
};

// Gemensamt teckensnitt/typografi för diagram (matchar appens sans-stack).
const CHART_FONT = {
    family: 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    size: 12,
    color: '#1f2430',
    dampad: '#5b6472'      // axlarnas siffror och rubriker: ett steg lugnare än diagrammets egna etiketter
};

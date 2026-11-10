// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
// Webbläsar-röktest av den BYGGDA single-file-artefakten.
//
// Varför detta behövs: Vitest-testerna kör i jsdom, som saknar canvas och inte tillämpar
// CSP:n. De ritar diagrammen med äkta D3, men bevisar inte att bygget fungerar i en riktig
// webbläsare från file://, eller att PNG-exporten gör det. Det här testet öppnar
// oppen-lonekartlaggning.html i riktig Chromium via file:// — samma väg som
// användaren — och kontrollerar att biblioteken laddas under den hårdade CSP:n,
// att diagrammen får en <svg>, att modalen fungerar och att inget skrivs till
// localStorage.
//
//   npm run bundle && npm run test:browser                 (Chromium)
//   npm run test:browser:firefox / npm run test:browser:webkit
// eller: node tools/browser-smoke.mjs --browser=firefox
// Med --bilder=<katalog> sparas diagramkärnans exporterade PNG och SVG där, för granskning med ögat.
//
// Kontrollerna ligger per område i tools/browser-smoke/ med en gemensam rigg (rigg.mjs: webbläsaren, sidan,
// ok() och hjälparna). Den här filen kör dem i samma ordning som de alltid har körts och skriver sammanfattningen.
import { browser, NAMN, antalFel } from './browser-smoke/rigg.mjs';
import { laddningOchDemo, startsidan, organisationsfilen } from './browser-smoke/laddning.mjs';
import { flikarOchDiagram, oversiktEfterInlasning } from './browser-smoke/flikar-och-diagram.mjs';
import { diagramkarnan } from './browser-smoke/diagramkarnan.mjs';
import { wordUtkast, rapportunderlag, beskedPdfZip, checklistor } from './browser-smoke/exporter.mjs';
import { utseende, smalaSkarmar } from './browser-smoke/layout.mjs';
import { gruppdossier, kTroskel, sokOchBasdossier } from './browser-smoke/dialoger.mjs';
import { ingenLagring, ingenTrafik, felUnderKorningen } from './browser-smoke/sakerhet.mjs';
import { stortDemo } from './browser-smoke/demo.mjs';
import { importprofiler } from './browser-smoke/importprofiler.mjs';
import { forhandskontroll } from './browser-smoke/forhandskontroll.mjs';
import { sakligaSkal } from './browser-smoke/sakliga-skal.mjs';
import { uppdelningensVariabler } from './browser-smoke/gapuppdelning.mjs';

await laddningOchDemo();
await flikarOchDiagram();
await diagramkarnan();
await wordUtkast();
await utseende();
await gruppdossier();
await rapportunderlag();
await kTroskel();
await ingenLagring();
await oversiktEfterInlasning();
await beskedPdfZip();
await sokOchBasdossier();
await startsidan();
await smalaSkarmar();
await checklistor();
await organisationsfilen();
await importprofiler();
await forhandskontroll();
await sakligaSkal();
await uppdelningensVariabler();
await ingenTrafik();
await stortDemo();
await felUnderKorningen();

await browser.close();
console.log(antalFel() ? `\n✗ ${antalFel()} kontroll(er) misslyckades (${NAMN})\n` : `\n✓ Alla kontroller gröna (${NAMN})\n`);
process.exit(antalFel() ? 1 : 0);

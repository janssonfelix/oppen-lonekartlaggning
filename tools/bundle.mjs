// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
// Single-file build av Oppen lonekartlaggning — enda byggvagen.
//
// Kors med:  node tools/bundle.mjs   (eller: npm run bundle)
// Output:
//   oppen-lonekartlaggning.html  (single-file build)
//   RELEASE.txt                 (version + SHA-256 + sources)
//
// Bygget ar reproducerbart: bannern innehaller ingen wall-clock-tidsstampel,
// sa samma kallkod ger alltid samma SHA-256. Byggtidpunkten loggas endast i
// RELEASE.txt.

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { buildAppBuffer } from './build-app.mjs';
import { writeMirrors } from './gen-mirrors.mjs';
import { writeVersionModule } from './gen-version.mjs';
import { minifyCss } from './lib/minify-css.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

// Motsvarar Get-Content -Raw -Encoding UTF8: laser hela filen som UTF-8 och
// strippar en eventuell inledande BOM (app.js har BOM; index.html/style.css ej).
function readText(name) {
    const text = readFileSync(join(root, name), 'utf8');
    return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

function formatSize(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

// CSP source-hash (base64 SHA-256) av ett inline-scripts (eller <style>-blocks) textinnehall. Browsern
// beraknar samma hash over UTF-8-byten mellan <script> och </script> nar
// 'unsafe-inline' saknas i script-src. Innehallet hashas EXAKT som det inlineas.
function getCspScriptHash(content) {
    const hash = createHash('sha256').update(content, 'utf8').digest('base64');
    return `'sha256-${hash}'`;
}

// Teckenkodningsgrind: vagrar bygga om en egen kallfil innehaller U+FFFD
// (replacement character) - symptomet pa mojibake-korruption. Galler ENDAST
// egna filer, inte de minifierade tredjepartslibsen.
function assertNoMojibake(text, name) {
    const idx = text.indexOf('�');
    if (idx >= 0) {
        const start = Math.max(0, idx - 30);
        const ctx = text.substring(start, start + 60).replace(/[\r\n]/g, ' ');
        throw new Error(
            `Teckenkodningsfel: U+FFFD (mojibake) hittad i ${name} vid position ${idx}. Bygget avbryts. Kontext: ...${ctx}...`
        );
    }
}

// Valfri syntaxkontroll av app.js via Node.
function testAppJsSyntax(path) {
    try {
        execFileSync(process.execPath, ['--check', path], { stdio: 'ignore' });
        console.log('  + app.js node --check OK');
    } catch {
        throw new Error('app.js: node --check misslyckades (syntaxfel). Bygget avbryts.');
    }
}

// --- Build-time minifiers ---

// minifyCss finns i tools/lib/minify-css.mjs (egen fil, med egna tester i tests/byggminify.test.js).

function minifyHtml(html) {
    const protectedBlocks = new Map();
    let protIdx = 0;
    const patterns = [
        /<pre\b[^>]*>[\s\S]*?<\/pre>/gis,
        /<script\b[^>]*>[\s\S]*?<\/script>/gis,
        /<style\b[^>]*>[\s\S]*?<\/style>/gis,
        /<textarea\b[^>]*>[\s\S]*?<\/textarea>/gis
    ];
    for (const p of patterns) {
        html = html.replace(p, m => {
            const key = `__BUNDLE_PROTECTED_${protIdx}__`;
            protectedBlocks.set(key, m);
            protIdx++;
            return key;
        });
    }
    // HTML-kommentarer (utom villkorskommentarer <!--[if ...)
    html = html.replace(/<!--(?!\[if)[\s\S]*?-->/g, '');
    // Kollapsa whitespace mellan taggar
    html = html.replace(/>\s+</g, '><');
    // Kollapsa flera whitespace till ett mellanslag inom textnoder
    html = html.replace(/[ \t]+/g, ' ');
    html = html.replace(/\r?\n\s*/g, '\n');
    html = html.replace(/\n+/g, '\n');
    // Aterstall skyddade block
    for (const [key, value] of protectedBlocks) {
        html = html.split(key).join(value);
    }
    return html.trim();
}

// --- Releasestrategi: las VERSION + valj biblioteksvarianter ---
// VERSION ar byggdatumet i CalVer (AAAA.MM.DD) och enda kalla for bade
// APP_VERSION i appen och Build-raden i RELEASE.txt.
const versionFile = join(root, 'VERSION');
const version = existsSync(versionFile) ? readFileSync(versionFile, 'utf8').trim() : 'dev';

// Build-datumet harleds ur versionen, inte ur systemklockan, sa att en ombyggnad
// av samma version ger samma fil.
const buildDate = /^\d{4}\.\d{2}\.\d{2}$/.test(version)
    ? version.replace(/\./g, '-')
    : '(okant - VERSION saknas eller foljer inte CalVer)';

// Icke-fatal paminnelse: versionen SKA vara dagens datum nar en release byggs.
// Den far inte vara ett fel, for CI bygger om aldre commits vilken dag som helst.
const idag = new Date().toISOString().slice(0, 10);
if (buildDate !== idag && version !== 'dev') {
    console.log(`  ! VERSION (${version}) ar inte dagens datum (${idag}).`);
    console.log('    Skriv dagens datum i VERSION innan du klipper en release.');
}

// Verktyget anvander den slimmade biblioteksvarianten xlsx.mini.
const xlsxFile = 'vendor/xlsx.mini.min.js';

console.log(`Bundling Oppen lonekartlaggning v${version}...`);
console.log(`  xlsx   variant: ${xlsxFile}`);

// #6 app.js ar ett genererat hopslaget bygge av src/app/-modulerna. Regenerera
// det har sa att bygget alltid speglar kallan.
// Regenerera app.js fran src/app/ sa bygget alltid speglar kallan. Kan hoppas
// over med BUNDLE_SKIP_APP_BUILD=1 (t.ex. for reproducerbar verifiering mot en
// befintlig app.js).
if (process.env.BUNDLE_SKIP_APP_BUILD) {
    console.log('  (BUNDLE_SKIP_APP_BUILD - anvander befintlig app.js)');
} else {
    writeVersionModule(); // src/app/08-version.js fran VERSION (single source of truth)
    writeMirrors();       // src/app/09-lib-speglar.js fran src/lib/ (single source of truth)
    writeFileSync(join(root, 'dist', 'app.js'), buildAppBuffer().buffer);
    console.log('  + app.js regenererad fran src/app/');
}

let html = readText('src/index.html');
assertNoMojibake(html, 'index.html');
testAppJsSyntax(join(root, 'dist', 'app.js'));
const sources = [];

// 1. CSS - minify och inlinea
const css = readText('src/style.css');
assertNoMojibake(css, 'style.css');
const cssBefore = css.length;
const cssMin = minifyCss(css);
console.log(`  + style.css                ${formatSize(cssBefore)} -> ${formatSize(cssMin.length)} (minify)`);
sources.push({ name: 'style.css (minified)', bytes: cssMin.length });

const cssTagPattern = /<link\s+rel="stylesheet"\s+href="style\.css"\s*\/?>/;
const cssMatch = html.match(cssTagPattern);
if (!cssMatch || cssMatch.index == null) throw new Error('Hittade ej style.css link-tagg');
html =
    html.substring(0, cssMatch.index) +
    `<style>${cssMin}</style>` +
    html.substring(cssMatch.index + cssMatch[0].length);

// 2. HTML - minify body whitespace (skyddar script/style/pre/textarea)
const htmlBefore = html.length;
html = minifyHtml(html);
console.log(`  * index.html               ${formatSize(htmlBefore)} -> ${formatSize(html.length)} (minify)`);

// 2b. CSP for stilar: <style>-element kraver kontrollsumma (style-src-elem) och stilattribut
// i markeringen ar helt forbjudna (style-src-attr 'none'): verktyget har inga style="..." kvar
// (ADR-30, ADR-43), utraknade matt satts via CSSOM (el.style.x), som CSP:n inte ror. En injicerad
// <style> eller ett injicerat style-attribut blockeras alltsa. Direktivet maste skrivas ut:
// utan style-src-attr faller webblasaren tillbaka pa style-src 'unsafe-inline'. Kontrollsummorna
// tas over de statiska <style>-blocken INNAN skripten inlineas. Inget bibliotek skapar egna
// stilmallar.
// Webblasare utan stod for -elem/-attr faller tillbaka pa style-src.
const styleHashes = [...new Set([...html.matchAll(/<style>([\s\S]*?)<\/style>/g)].map(m => m[1]))]
    .map(getCspScriptHash);
if (!html.includes("style-src 'unsafe-inline';")) throw new Error("Hittade ej style-src 'unsafe-inline' i CSP-metan. Bygget avbryts.");
html = html.replace("style-src 'unsafe-inline';",
    `style-src 'unsafe-inline'; style-src-elem ${styleHashes.join(' ')}; style-src-attr 'none';`);
console.log(`  + CSP style-src-elem: ${styleHashes.length} kontrollsummor; style-src-attr 'none'`);

// 3. JS - inlinea libs (oroda) + app.js (light minify => orord)
const scripts = ['vendor/papaparse.min.js', xlsxFile, 'vendor/d3.min.js', 'vendor/jszip.min.js', 'dist/app.js'];
const scriptHashes = [];
for (const s of scripts) {
    const code = readText(s);
    if (s === 'dist/app.js') assertNoMojibake(code, 'dist/app.js');
    console.log(`  + ${s.padEnd(26)}${formatSize(code.length)}`);
    const safe = code.replace(/<\/script>/gi, '<\\/script>');
    // CSP: SHA-256 (base64) av scriptets EXAKTA textinnehall (safe).
    scriptHashes.push(getCspScriptHash(safe));
    // index.html (i src/) pekar på ../vendor/… och ../dist/app.js.
    const tag = `<script src="../${s}"></script>`;
    if (!html.includes(tag)) throw new Error(`Hittade ej '${tag}' i index.html`);
    html = html.split(tag).join(`<script>${safe}</script>`);
    sources.push({ name: s, bytes: code.length });
}

// 4. Licenstexterna (src/licenser.txt) - MIT och Apache 2.0 kraver att texten foljer med
//    varje kopia. De laggs i en inaktiv <template> (inget skript => CSP-hasharna paverkas
//    inte) som fliken Om verktyget visar.
{
    const lic = readText('src/licenser.txt');
    assertNoMojibake(lic, 'licenser.txt');
    const escLic = lic.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    // SISTA </body>: biblioteken (t.ex. SheetJS) innehaller strangen '</body>' i sin kod,
    // och en andring dar skulle bryta skriptets CSP-hash.
    const slut = html.lastIndexOf('</body>');
    if (slut < 0) throw new Error('Hittade ej </body> i index.html');
    html = html.slice(0, slut) + `<template id="licenstexter"><pre>${escLic}</pre></template>` + html.slice(slut);
    console.log(`  + src/licenser.txt           ${formatSize(lic.length)}`);
    sources.push({ name: 'src/licenser.txt', bytes: lic.length });
}

// CSP-hardning (ADR-9): byt ut script-src 'unsafe-inline' mot per-script-hashar.
const scriptSrc = 'script-src ' + scriptHashes.join(' ');
if (!html.includes("script-src 'unsafe-inline'")) {
    throw new Error(
        "Hittade ej script-src 'unsafe-inline' i CSP-metan - kan inte harda CSP. Bygget avbryts."
    );
}
html = html.replace("script-src 'unsafe-inline'", scriptSrc);
console.log(`  + CSP script-src hardad: ${scriptHashes.length} per-script-hashar (ingen 'unsafe-inline')`);

// Banner - ingen wall-clock-tidsstampel => reproducerbart bygge.
const banner =
    `<!--\n  Oppen lonekartlaggning - Single-file Build\n  Version: ${version}\n` +
    `  Lokalt korbar. All bearbetning sker i webblasaren. Ingen data lamnar enheten.\n-->\n`;
html = banner + html;

const out = join(root, 'dist', 'oppen-lonekartlaggning.html');
writeFileSync(out, html, 'utf8');

// --- Releasestrategi: SHA-256 + RELEASE.txt ---
const outBytes = Buffer.from(html, 'utf8');
const size = outBytes.length;
const sha = createHash('sha256').update(outBytes).digest('hex');

const releaseLines = [
    'Oppen lonekartlaggning - Release report',
    '======================================',
    '',
    `Version:    ${version}`,
    `Build:      ${buildDate}`,
    'Output:     oppen-lonekartlaggning.html',
    `Size:       ${formatSize(size)} (${size} bytes)`,
    `SHA-256:    ${sha}`,
    '',
    'Sources (storlek post-minify):',
    ...sources.map(src => `  - ${src.name.padEnd(30)}${formatSize(src.bytes)}`),
    '',
    'Verifiering:',
    '  PowerShell : (Get-FileHash -Algorithm SHA256 oppen-lonekartlaggning.html).Hash',
    '  Linux/mac  : sha256sum oppen-lonekartlaggning.html'
];
writeFileSync(join(root, 'dist', 'RELEASE.txt'), releaseLines.join('\n') + '\n', 'utf8');

console.log('');
console.log(`  Klar: oppen-lonekartlaggning.html  (${formatSize(size)})`);
console.log(`  Version: ${version}`);
console.log(`  SHA-256: ${sha}`);

// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
// Bygger verktyget som en enda HTML-fil; det enda sättet att bygga det.
//
// Körs med `npm run bundle` (node tools/bundle.mjs) och skriver i dist/:
//   oppen-lonekartlaggning.html  verktyget, med stilmallen, biblioteken och dist/app.js inbäddade;
//   RELEASE.txt                  version, storlek, SHA-256 och källorna.
//
// Bygget är reproducerbart: byggdatumet härleds ur VERSION och ingen klocka läses, så samma källa ger alltid
// samma SHA-256.

import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { skrivApp } from './build-app.mjs';
import { readVersion, buildDateFor } from './gen-version.mjs';
import { minifyCss } from './lib/minify-css.mjs';
import { minifyHtml } from './lib/minify-html.mjs';
import { VERIFIERING } from './release.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

// Läser filen som UTF-8 och tar bort ett inledande BOM, om en redigerare har lagt dit ett.
function readText(name) {
    const text = readFileSync(join(root, name), 'utf8');
    return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

function formatSize(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

// CSP:ns kontrollsumma (SHA-256 i base64) för ett inbäddat skript eller <style>-block. Webbläsaren räknar samma
// summa över UTF-8-byten mellan taggarna, så innehållet summeras exakt som det bäddas in.
function getCspScriptHash(content) {
    const hash = createHash('sha256').update(content, 'utf8').digest('base64');
    return `'sha256-${hash}'`;
}

// Skyddet mot trasig teckenkodning: bygget avbryts om en egen källfil innehåller U+FFFD (ersättningstecknet), som
// blir kvar när en fil lästs med fel kodning. Gäller bara egna filer, inte biblioteken.
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

// Syntaxkontrollen av dist/app.js (riskanalysen, Bundle-integritet).
function testAppJsSyntax(path) {
    try {
        execFileSync(process.execPath, ['--check', path], { stdio: 'ignore' });
        console.log('  + app.js node --check OK');
    } catch {
        throw new Error('app.js: node --check misslyckades (syntaxfel). Bygget avbryts.');
    }
}

// VERSION (CalVer ÅÅÅÅ.MM.DD) är enda källan till versionen i appen och i RELEASE.txt (tools/gen-version.mjs).
const version = readVersion();
const buildDate = buildDateFor(version);

// En påminnelse, inget fel: CI bygger om äldre commits vilken dag som helst.
const idag = new Date().toISOString().slice(0, 10);
if (buildDate !== idag) {
    console.log(`  ! VERSION (${version}) är inte dagens datum (${idag}).`);
    console.log('    Skriv dagens datum i VERSION innan en version släpps.');
}

// Den mindre varianten av SheetJS räcker för verktyget.
const xlsxFile = 'vendor/xlsx.mini.min.js';

console.log(`Bygger Öppen lönekartläggning ${version} …`);

// dist/app.js byggs alltid ur src/app/ (tools/build-app.mjs), så att filen motsvarar källan.
skrivApp();
console.log('  + dist/app.js byggd ur src/app/');

let html = readText('src/index.html');
assertNoMojibake(html, 'index.html');
testAppJsSyntax(join(root, 'dist', 'app.js'));
const sources = [];

// 1. Stilmallen förminskas och bäddas in.
const css = readText('src/style.css');
assertNoMojibake(css, 'style.css');
const cssBefore = css.length;
const cssMin = minifyCss(css);
console.log(`  + style.css                ${formatSize(cssBefore)} -> ${formatSize(cssMin.length)} (minify)`);
sources.push({ name: 'style.css (minified)', bytes: cssMin.length });

const cssTagPattern = /<link\s+rel="stylesheet"\s+href="style\.css"\s*\/?>/;
const cssMatch = html.match(cssTagPattern);
if (!cssMatch || cssMatch.index == null) throw new Error('Hittade inte länken till style.css i index.html');
html =
    html.substring(0, cssMatch.index) +
    `<style>${cssMin}</style>` +
    html.substring(cssMatch.index + cssMatch[0].length);

// 2. Blanksteg i markeringen tas bort (script, style, pre och textarea rörs inte).
const htmlBefore = html.length;
html = minifyHtml(html);
console.log(`  * index.html               ${formatSize(htmlBefore)} -> ${formatSize(html.length)} (minify)`);

// 3. CSP:n för stilar: ett <style>-element kräver sin kontrollsumma (style-src-elem), och stilattribut i markeringen
// är förbjudna (style-src-attr 'none'). Verktyget har inga style="…" (ADR-30, ADR-43); uträknade mått sätts genom
// CSSOM (el.style.x), som CSP:n inte rör. Ett injicerat <style> eller stilattribut stoppas alltså. Direktivet måste
// skrivas ut, annars faller webbläsaren tillbaka på style-src 'unsafe-inline'. Summorna tas över de statiska
// <style>-blocken innan skripten bäddas in. Inget bibliotek skapar egna stilmallar.
const styleHashes = [...new Set([...html.matchAll(/<style>([\s\S]*?)<\/style>/g)].map(m => m[1]))]
    .map(getCspScriptHash);
if (!html.includes("style-src 'unsafe-inline';")) throw new Error("Hittade inte style-src 'unsafe-inline' i CSP:n. Bygget avbryts.");
html = html.replace("style-src 'unsafe-inline';",
    `style-src 'unsafe-inline'; style-src-elem ${styleHashes.join(' ')}; style-src-attr 'none';`);
console.log(`  + CSP style-src-elem: ${styleHashes.length} kontrollsummor; style-src-attr 'none'`);

// 4. Biblioteken och dist/app.js bäddas in oförändrade.
const scripts = ['vendor/papaparse.min.js', xlsxFile, 'vendor/d3.min.js', 'vendor/jszip.min.js', 'dist/app.js'];
const scriptHashes = [];
for (const s of scripts) {
    const code = readText(s);
    if (s === 'dist/app.js') assertNoMojibake(code, 'dist/app.js');
    console.log(`  + ${s.padEnd(26)}${formatSize(code.length)}`);
    const safe = code.replace(/<\/script>/gi, '<\\/script>');
    // CSP:n: kontrollsumman över exakt den text som bäddas in.
    scriptHashes.push(getCspScriptHash(safe));
    // index.html (i src/) pekar på ../vendor/… och ../dist/app.js.
    const tag = `<script src="../${s}"></script>`;
    if (!html.includes(tag)) throw new Error(`Hittade inte '${tag}' i index.html`);
    html = html.split(tag).join(`<script>${safe}</script>`);
    sources.push({ name: s, bytes: code.length });
}

// 5. Licenstexterna (src/licenser.txt): MIT och Apache 2.0 kräver att texten följer med varje kopia. De läggs i en
//    inaktiv <template> (inget skript, så CSP:ns summor påverkas inte) som fliken Om verktyget visar.
{
    const lic = readText('src/licenser.txt');
    assertNoMojibake(lic, 'licenser.txt');
    const escLic = lic.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    // Sista </body>: biblioteken (till exempel SheetJS) har strängen '</body>' i sin kod, och en ändring där skulle
    // bryta skriptets kontrollsumma.
    const slut = html.lastIndexOf('</body>');
    if (slut < 0) throw new Error('Hittade inte </body> i index.html');
    html = html.slice(0, slut) + `<template id="licenstexter"><pre>${escLic}</pre></template>` + html.slice(slut);
    console.log(`  + src/licenser.txt           ${formatSize(lic.length)}`);
    sources.push({ name: 'src/licenser.txt', bytes: lic.length });
}

// 6. CSP:n för skript (ADR-9): script-src 'unsafe-inline' byts mot en kontrollsumma per skript.
const scriptSrc = 'script-src ' + scriptHashes.join(' ');
if (!html.includes("script-src 'unsafe-inline'")) {
    throw new Error(
        "Hittade inte script-src 'unsafe-inline' i CSP:n. Bygget avbryts."
    );
}
html = html.replace("script-src 'unsafe-inline'", scriptSrc);
console.log(`  + CSP script-src: ${scriptHashes.length} kontrollsummor (ingen 'unsafe-inline')`);

// Inledningen i filen, utan tidpunkt så att bygget är reproducerbart.
const banner =
    `<!--\n  Öppen lönekartläggning\n  Version: ${version}\n` +
    `  Körs i webbläsaren utan server. All bearbetning sker lokalt; ingen data lämnar datorn.\n-->\n`;
html = banner + html;

const out = join(root, 'dist', 'oppen-lonekartlaggning.html');
writeFileSync(out, html, 'utf8');

// RELEASE.txt: raderna Version, Size och SHA-256 läses av tools/release.mjs, tools/site.mjs och
// tools/valideringsrapport.mjs.
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
    // Samma kommandon som SECURITY.md och körguiden §0 (tools/release.mjs, VERIFIERING).
    `  PowerShell : ${VERIFIERING.powershell}`,
    `  Linux/mac  : ${VERIFIERING.linux}`
];
writeFileSync(join(root, 'dist', 'RELEASE.txt'), releaseLines.join('\n') + '\n', 'utf8');

console.log('');
console.log(`  Klar: dist/oppen-lonekartlaggning.html (${formatSize(size)})`);
console.log(`  Version: ${version}`);
console.log(`  SHA-256: ${sha}`);

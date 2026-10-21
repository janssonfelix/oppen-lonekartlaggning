// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
// Genererar src/app/08-version.js från VERSION-filen.
//
// BAKGRUND: APP_VERSION och APP_BUILD_DATE var hårdkodade i 60-print-init.js (nu uppdelad i 60–66)
// och hade glidit isär från VERSION (app:en stämplade 2026.07.22 medan bygget
// var 2026.10.04). Eftersom APP_VERSION är det användaren ser i rapportens
// sidfot och i Excel-/Word-metadata innebar det att varje exporterad rapport
// pekade tillbaka på fel beräkningsversion — och rapporten är ett underlag i
// en lagstadgad process, där spårbarhet är hela poängen med stämpeln.
//
// VERSION är nu enda källa. Build-datumet HÄRLEDS ur versionen (CalVer
// ÅÅÅÅ.MM.DD) i stället för att läsas från systemklockan: bygget måste förbli
// byte-reproducerbart, och ett `new Date()` här hade gjort SHA-256:an olika
// vid varje körning och slagit sönder artefaktgrinden i CI.
//
// Körs av tools/build-app.mjs före hopslagningen, precis som gen-mirrors.
// Vaktas av tests/version.test.js.

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const versionFile = join(root, 'VERSION');
const outFile = join(root, 'src', 'app', '08-version.js');

// CalVer: ÅÅÅÅ.MM.DD. Strikt — hellre ett tydligt byggfel än en tyst felstämpel
// i ett juridiskt underlag.
const CALVER = /^(\d{4})\.(\d{2})\.(\d{2})$/;

export function readVersion() {
    let raw;
    try {
        raw = readFileSync(versionFile, 'utf8');
    } catch {
        throw new Error('gen-version: VERSION-filen saknas i projektroten.');
    }
    const version = raw.replace(/^﻿/, '').trim();
    if (!CALVER.test(version)) {
        throw new Error(`gen-version: VERSION ("${version}") följer inte CalVer ÅÅÅÅ.MM.DD.`);
    }
    return version;
}

// 2026.10.04 -> 2026-10-04
export function buildDateFor(version) {
    const m = CALVER.exec(version);
    if (!m) throw new Error(`gen-version: kan inte härleda build-datum ur "${version}".`);
    return `${m[1]}-${m[2]}-${m[3]}`;
}

export function generateVersionSource() {
    const version = readVersion();
    return [
        '// SPDX-License-Identifier: MIT',
        '// Copyright 2026 Felix Jansson',
        '// ====================================================================',
        '// AUTO-GENERERAD FIL — RÖR INTE.',
        '//',
        '// Versionsstämpeln som visas för användaren (rapportsidfot, Excel-/Word-',
        '// metadata, panelen "Om verktyget"). Enda källa är VERSION-filen i',
        '// projektroten; build-datumet härleds ur versionen (CalVer ÅÅÅÅ.MM.DD)',
        '// så att bygget förblir byte-reproducerbart.',
        '//',
        '// Ändra VERSION och kör `npm run build:app` (eller npm run bundle).',
        '// Genererad av tools/gen-version.mjs; vaktas av tests/version.test.js.',
        '// ====================================================================',
        '',
        `const APP_VERSION = '${version}';`,
        `const APP_BUILD_DATE = '${buildDateFor(version)}';`,
        ''
    ].join('\n');
}

export function writeVersionModule() {
    const text = generateVersionSource();
    writeFileSync(outFile, text);
    return text;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
    writeVersionModule();
    console.log('gen-version: skrev src/app/08-version.js');
}

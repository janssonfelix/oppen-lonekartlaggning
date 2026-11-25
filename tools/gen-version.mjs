// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
// Genererar src/app/08-version.js ur VERSION, och läser versionen åt bygget och programvaruförteckningen.
//
// VERSION är enda källan till versionen som exporterna stämplas med (rapportens sidfot, Excel- och Word-filernas
// egenskaper): en stämpel som glidit isär pekar varje rapport på fel beräkningsversion. Byggdatumet härleds ur
// versionen (CalVer ÅÅÅÅ.MM.DD) och läses aldrig ur klockan, så att bygget är reproducerbart.
//
// Körs av tools/build-app.mjs före bygget. Vaktas av tests/version.test.js.

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
        `export const APP_VERSION = '${version}';`,
        `export const APP_BYGGDATUM = '${buildDateFor(version)}';`,
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

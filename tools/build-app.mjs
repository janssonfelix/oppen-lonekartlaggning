// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
// #6 Bygg app.js från källmodulerna i src/app/.
//
// app.js är ett GENERERAT hopslaget bygge av de numrerade delarna i src/app/.
// Redigera ALDRIG app.js direkt — ändra rätt src/app/NN-*.js och kör:
//     node tools/build-app.mjs      (eller: npm run build:app)
//
// Delarna slås ihop byte för byte (BOM + CRLF bevaras). tests/appsource.test.js
// vaktar att src/app/ och app.js aldrig glider isär.
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { writeMirrors } from './gen-mirrors.mjs';
import { writeVersionModule } from './gen-version.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const srcDir = join(root, 'src', 'app');

export function buildAppBuffer() {
    const files = readdirSync(srcDir).filter(f => /^\d\d-.*\.js$/.test(f)).sort();
    if (!files.length) throw new Error('Inga src/app/NN-*.js-delar hittades.');
    return { files, buffer: Buffer.concat(files.map(f => readFileSync(join(srcDir, f)))) };
}

// Kör direkt (inte importerad): regenerera lib-speglarna, slå ihop app.js
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
    writeVersionModule();   // src/app/08-version.js från VERSION (single source of truth)
    console.log('build-app: regenererade src/app/08-version.js från VERSION');
    writeMirrors();   // src/app/09-lib-speglar.js från src/lib/ (single source of truth)
    console.log('build-app: regenererade src/app/09-lib-speglar.js från src/lib/');
    const { files, buffer } = buildAppBuffer();
    writeFileSync(join(root, 'dist', 'app.js'), buffer);
    console.log(`build-app: slog ihop ${files.length} delar -> app.js (${buffer.length} bytes)`);
    console.log('  ' + files.join('\n  '));
}

// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
// Kör hela kedjan i Definition of Done (.github/CONTRIBUTING.md, punkt 3): `npm run kontroll`.
//
// Stegen körs i ordning som `npm run <steg>` och kedjan stannar på första fel, med stegets slutkod. Efter `bundle`
// prövas artefaktgrinden: bygget ändrade inga genererade filer, de spårade filerna under dist/ (artefakten och
// RELEASE.txt inräknade) och GENERERADE. Filerna jämförs som de låg när kedjan började och efter bygget; i CI, som
// börjar i en ren utcheckning, är det en jämförelse med det incheckade. En ändring betyder att de inte motsvarade
// källan: de ombyggda filerna ska checkas in.
// Grinden är den enda kontrollen av de genererade filerna; testsviten prövar dem inte en gång till. Teckenkodningen
// (ingen U+FFFD) prövar bygget självt (tools/bundle.mjs), som stoppar.
//
// `--artefakt` kör bara `bundle` och grinden. Det är artefaktgrinden i .github/workflows/ci.yml och release.yml, så
// att regeln för vilka filer som jämförs står här och ingen annanstans.
//
// `--snabb` är körningen under arbetet: `test` (enhetsprojektet) i stället för `test:full`, och inget röktest i
// webbläsaren. Utan flagga körs allt, som före en pull request.
//
// CI kör sviten delad på fyra jobb (--shard); här körs den i ett stycke, och det är samma tester.
//
// STEG och SNABBA_STEG exporteras, så att tests/dokumentation-struktur.test.js kan pröva dem mot CI utan att köra något.
import { spawnSync, execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

/** Hela kedjan, i ordning. */
export const STEG = ['build:app', 'lint', 'typecheck', 'test:full', 'bundle', 'test:browser'];

/** Kedjan under arbetet (`--snabb`): den snabba testkörningen och inget röktest i webbläsaren. */
export const SNABBA_STEG = ['build:app', 'lint', 'typecheck', 'test', 'bundle'];

/** Steget efter vilket artefakten prövas. */
const BYGGSTEG = 'bundle';

/** Den genererade filen i src/app/ (tools/build-app.mjs skriver den ur VERSION). */
const GENERERADE = ['src/app/08-version.js'];

/**
 * Kontrollsumman för varje genererad fil: de spårade filerna under dist/ och GENERERADE.
 * @returns {Map<string, string>}
 */
function distAvtryck() {
    const filer = execFileSync('git', ['ls-files', 'dist'], { cwd: root, encoding: 'utf8' }).split('\n').filter(Boolean)
        .concat(GENERERADE);
    return new Map(filer.map(f => [f, existsSync(join(root, f))
        ? createHash('sha256').update(readFileSync(join(root, f))).digest('hex')
        : '(saknas)']));
}

/**
 * Filerna vars innehåll skiljer sig mellan två avtryck.
 * @param {Map<string, string>} fore
 * @param {Map<string, string>} efter
 * @returns {string[]}
 */
function andrade(fore, efter) {
    return [...new Set([...fore.keys(), ...efter.keys()])].filter(f => fore.get(f) !== efter.get(f)).sort();
}

/**
 * Grindarna efter bygget. Returnerar felen som text; tom lista när allt stämmer.
 * @param {Map<string, string>} fore avtrycket av de genererade filerna när kedjan började
 * @returns {string[]}
 */
function grindar(fore) {
    const fel = [];
    const byggda = andrade(fore, distAvtryck());
    if (byggda.length) {
        fel.push('Bygget ändrade genererade filer; de motsvarade inte källan:\n'
            + byggda.map(f => `    ${f}`).join('\n')
            + '\n  Checka in de ombyggda filerna och kör kontrollen igen.');
    }
    return fel;
}

/** @param {number} ms */
const tid = ms => ms < 60_000 ? `${(ms / 1000).toFixed(1)} s` : `${Math.floor(ms / 60_000)} min ${Math.round((ms % 60_000) / 1000)} s`;

/**
 * Kör kedjan och returnerar slutkoden.
 * @param {string[]} steg
 * @returns {number}
 */
function kor(steg) {
    /** @type {{ namn: string, ms: number, kod: number }[]} */
    const resultat = [];
    const fore = distAvtryck();
    const sammanfatta = () => {
        console.log('\n[kontroll] Sammanfattning:');
        for (const r of resultat) console.log(`  ${r.kod === 0 ? 'ok ' : 'FEL'}  ${r.namn.padEnd(14)} ${tid(r.ms)}`);
        const hoppade = steg.slice(resultat.filter(r => !r.namn.startsWith('(')).length);
        for (const n of hoppade) console.log(`  –    ${n.padEnd(14)} kördes inte`);
        console.log(`  Totalt ${tid(resultat.reduce((s, r) => s + r.ms, 0))}.`);
    };
    for (const [i, namn] of steg.entries()) {
        console.log(`\n[kontroll] Steg ${i + 1} av ${steg.length}: npm run ${namn}`);
        const start = Date.now();
        const r = spawnSync('npm', ['run', namn], { cwd: root, stdio: 'inherit' });
        const kod = r.status ?? 1;
        resultat.push({ namn, ms: Date.now() - start, kod });
        if (kod !== 0) {
            console.error(`\n[kontroll] npm run ${namn} föll (slutkod ${kod}).`);
            sammanfatta();
            return kod;
        }
        if (namn === BYGGSTEG) {
            const gStart = Date.now();
            const fel = grindar(fore);
            resultat.push({ namn: '(grindarna)', ms: Date.now() - gStart, kod: fel.length ? 1 : 0 });
            if (fel.length) {
                for (const f of fel) console.error(`\n[kontroll] ${f}`);
                sammanfatta();
                return 1;
            }
            console.log('\n[kontroll] Artefakten motsvarar källan.');
        }
    }
    sammanfatta();
    console.log('[kontroll] Allt grönt.');
    return 0;
}

// Kör bara när skriptet startas direkt (inte när ett test importerar STEG).
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
    const okanda = process.argv.slice(2).filter(a => a !== '--snabb' && a !== '--artefakt');
    if (okanda.length) {
        console.error(`[kontroll] Okänt argument: ${okanda.join(' ')}. Flaggorna är --snabb och --artefakt.`);
        process.exitCode = 2;
    } else {
        process.exitCode = kor(process.argv.includes('--artefakt') ? [BYGGSTEG]
            : process.argv.includes('--snabb') ? SNABBA_STEG : STEG);
    }
}

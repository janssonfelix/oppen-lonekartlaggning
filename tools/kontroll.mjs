// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
// Kör hela kedjan i Definition of Done (.github/CONTRIBUTING.md, punkt 3): `npm run kontroll`.
//
// Stegen körs i ordning som `npm run <steg>` och kedjan stannar på första fel, med stegets slutkod. Efter `bundle`
// prövas samma två grindar som CI-jobbet grindar kör utöver npm-skripten (.github/workflows/ci.yml):
//   artefakten   — bygget ändrade inga spårade filer under dist/. CI bygger om och kräver att hela dist/, artefakten
//                  och RELEASE.txt, blir byte-identisk med det incheckade; här jämförs dist/ som den låg när kedjan
//                  började med dist/ efter bygget. En ändring betyder att dist/ inte motsvarade källan: de ombyggda
//                  filerna ska checkas in.
//   teckenkodningen — ingen U+FFFD (mojibake) i dist/app.js, src/index.html och src/style.css.
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

/** Steget efter vilket artefakten och teckenkodningen prövas. */
const BYGGSTEG = 'bundle';

const TECKENKODNING = ['dist/app.js', 'src/index.html', 'src/style.css'];

/**
 * Kontrollsumman för varje spårad fil under dist/.
 * @returns {Map<string, string>}
 */
function distAvtryck() {
    const filer = execFileSync('git', ['ls-files', 'dist'], { cwd: root, encoding: 'utf8' }).split('\n').filter(Boolean);
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
 * @param {Map<string, string>} fore avtrycket av dist/ när kedjan började
 * @returns {string[]}
 */
function grindar(fore) {
    const fel = [];
    const byggda = andrade(fore, distAvtryck());
    if (byggda.length) {
        fel.push('Bygget ändrade spårade filer under dist/; de motsvarade inte källan:\n'
            + byggda.map(f => `    ${f}`).join('\n')
            + '\n  Checka in de ombyggda filerna (som CI:s artefaktgrind kräver) och kör kontrollen igen.');
    }
    const mojibake = TECKENKODNING.filter(f => readFileSync(join(root, f), 'utf8').includes('�'));
    if (mojibake.length) fel.push(`U+FFFD (mojibake) i ${mojibake.join(', ')}.`);
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
            console.log('\n[kontroll] Artefakten motsvarar källan och teckenkodningen är ren.');
        }
    }
    sammanfatta();
    console.log('[kontroll] Allt grönt.');
    return 0;
}

// Kör bara när skriptet startas direkt (inte när ett test importerar STEG).
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
    const okanda = process.argv.slice(2).filter(a => a !== '--snabb');
    if (okanda.length) {
        console.error(`[kontroll] Okänt argument: ${okanda.join(' ')}. Enda flaggan är --snabb.`);
        process.exitCode = 2;
    } else {
        process.exitCode = kor(process.argv.includes('--snabb') ? SNABBA_STEG : STEG);
    }
}

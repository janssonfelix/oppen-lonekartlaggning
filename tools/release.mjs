// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
// Release-grinden: kontrollerar att en version är redo att taggas.
//
//   npm run release:kontroll
//
// Kontrollerna:
//   - VERSION, package.json, CHANGELOG:s översta versionsrubrik och dist/RELEASE.txt anger samma version,
//     och CHANGELOG har ingen rubrik "Oförlöst" kvar;
//   - bygget i dist/ är det som RELEASE.txt beskriver (SHA-256), och riskanalysen anger samma bygge och
//     kontrollsumma;
//   - riskanalysens granskningsdatum och dataskyddsbeskrivningens "Granskad mot koden" är inte äldre än
//     senaste commit som rör koden (src/, tools/bundle.mjs, vendor/) — teknisk-plan.md §9 punkt 17b;
//   - arbetskatalogen är ren, så att taggen pekar på exakt det som kontrollerats.
//
// Vid OK skrivs taggkommandot ut. Release-arbetsflödet (.github/workflows/release.yml) kör samma kontroll
// innan det bygger, signerar och publicerar. Kontrollen är en ren funktion (kontrollera) som testas på
// fixturer i tests/release.test.js; samla() läser filerna och git.

import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CALVER = /^(\d{4})\.(\d{2})\.(\d{2})$/;
const DATUM = /^\d{4}-\d{2}-\d{2}$/;
// De sökvägar vars ändring kräver att riskanalysen granskas på nytt.
export const KODVAGAR = ['src', 'tools/bundle.mjs', 'vendor'];
const PUNKT = 'teknisk-plan.md §9 punkt 17b';

// 2026.10.04 -> 2026.10.4 (npm tillåter inte inledande nollor i package.json).
const semverish = v => String(v).split('.').map(p => String(Number(p))).join('.');

/**
 * @typedef {Object} Underlag
 * @property {string} version            VERSION-filens innehåll
 * @property {string} pkgVersion         package.json:s version
 * @property {string} changelog          CHANGELOG.md
 * @property {string} release            dist/RELEASE.txt
 * @property {string} artefaktSha        SHA-256 för dist/oppen-lonekartlaggning.html
 * @property {string} riskanalys         docs/dataskydd/riskanalys.md
 * @property {string} dataskydd          docs/dataskydd/dataskydd.md
 * @property {string} ejIncheckat        `git status --porcelain` (tom när arbetskatalogen är ren)
 * @property {string} senasteKodandring  ÅÅÅÅ-MM-DD för senaste commit som rör KODVAGAR ('' om okänt)
 */

/**
 * Prövar underlaget. Returnerar felen (tom lista = redo att taggas) och versionen.
 * @param {Underlag} u
 * @returns {{fel: string[], version: string}}
 */
export function kontrollera(u) {
    const fel = [];
    const version = String(u.version ?? '').replace(/^﻿/, '').trim();
    if (!CALVER.test(version)) fel.push(`VERSION ("${version}") följer inte CalVer ÅÅÅÅ.MM.DD.`);

    if (semverish(u.pkgVersion) !== semverish(version)) {
        fel.push(`package.json anger version ${u.pkgVersion}, VERSION ${version}. Sätt samma version i båda.`);
    }

    const rubriker = [...String(u.changelog).matchAll(/^## (.+)$/gm)].map(m => m[1].trim());
    if (rubriker.some(r => /^oförlöst/i.test(r))) {
        fel.push('CHANGELOG.md har kvar rubriken "Oförlöst". Byt den mot versionen.');
    }
    const forsta = rubriker.find(r => CALVER.test(r.split(/\s/)[0]));
    if (!forsta) fel.push('CHANGELOG.md har ingen versionsrubrik (## ÅÅÅÅ.MM.DD).');
    else if (forsta.split(/\s/)[0] !== version) {
        fel.push(`CHANGELOG.md:s översta versionsrubrik är ${forsta.split(/\s/)[0]}, VERSION ${version}.`);
    }

    const relVersion = /Version:\s+(\S+)/.exec(u.release)?.[1];
    const relSha = /SHA-256:\s+([0-9a-f]{64})/.exec(u.release)?.[1];
    if (relVersion !== version) {
        fel.push(`dist/RELEASE.txt anger version ${relVersion ?? '(ingen)'}, VERSION ${version}. Kör npm run build:app och npm run bundle.`);
    }
    if (!relSha) fel.push('dist/RELEASE.txt saknar SHA-256.');
    else if (relSha !== u.artefaktSha) {
        fel.push('dist/oppen-lonekartlaggning.html har inte den SHA-256 som dist/RELEASE.txt anger. Kör npm run bundle.');
    }

    const raSha = /\*\*Artefakt-SHA-256:\*\*\s*`([0-9a-f]{64})`/.exec(u.riskanalys)?.[1];
    const raBygge = /\*\*Bygge:\*\*\s*`([^`]+)`/.exec(u.riskanalys)?.[1];
    if (relSha && raSha !== relSha) {
        fel.push(`Riskanalysens kontrollsumma (rad 3) stämmer inte med dist/RELEASE.txt. Granska riskanalysen mot bygget och för in den nya kontrollsumman (${PUNKT}).`);
    }
    if (raBygge !== version) {
        fel.push(`Riskanalysens bygge (rad 3) är ${raBygge ?? '(inget)'}, VERSION ${version} (${PUNKT}).`);
    }

    const raDatum = /\*\*Granskningsdatum:\*\*\s*(\d{4}-\d{2}-\d{2})/.exec(u.riskanalys)?.[1];
    const dsDatum = /\*\*Granskad mot koden:\*\*\s*(\d{4}-\d{2}-\d{2})/.exec(u.dataskydd)?.[1];
    if (!DATUM.test(u.senasteKodandring || '')) {
        fel.push(`Kan inte avgöra när koden senast ändrades (git log -- ${KODVAGAR.join(' ')}). Kör i en fullständig klon (inte grund).`);
    } else {
        for (const [namn, datum] of [['Riskanalysens granskningsdatum', raDatum], ['Dataskyddsbeskrivningens "Granskad mot koden"', dsDatum]]) {
            if (!datum) fel.push(`${namn} saknas (${PUNKT}).`);
            else if (datum < u.senasteKodandring) {
                fel.push(`${namn} (${datum}) är äldre än senaste kodändringen (${u.senasteKodandring}). Granska dokumentet mot koden och sätt dagens datum (${PUNKT}).`);
            }
        }
    }

    if (String(u.ejIncheckat).trim()) {
        fel.push('Arbetskatalogen har ändringar som inte är incheckade. Checka in eller ta bort dem, så att taggen pekar på det som kontrollerats.');
    }
    return { fel, version };
}

/** Läser underlaget ur repot. */
export function samla(root = ROOT) {
    const las = f => readFileSync(join(root, f), 'utf8');
    const git = args => { try { return execFileSync('git', args, { cwd: root, encoding: 'utf8' }); } catch { return ''; } };
    return {
        version: las('VERSION'),
        pkgVersion: JSON.parse(las('package.json')).version,
        changelog: las('CHANGELOG.md'),
        release: las('dist/RELEASE.txt'),
        artefaktSha: createHash('sha256').update(readFileSync(join(root, 'dist', 'oppen-lonekartlaggning.html'))).digest('hex'),
        riskanalys: las('docs/dataskydd/riskanalys.md'),
        dataskydd: las('docs/dataskydd/dataskydd.md'),
        ejIncheckat: git(['status', '--porcelain']),
        senasteKodandring: git(['log', '-1', '--format=%cs', '--', ...KODVAGAR]).trim(),
    };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
    const { fel, version } = kontrollera(samla());
    if (fel.length) {
        console.error(`✗ Version ${version || '(okänd)'} är inte redo att släppas:`);
        for (const f of fel) console.error(`  - ${f}`);
        process.exit(1);
    }
    console.log(`✓ Version ${version} är redo att släppas. Tagga och pusha:`);
    console.log(`  git tag -a v${version} -m "Öppen lönekartläggning ${version}"`);
    console.log(`  git push origin v${version}`);
}

// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
// Demosidan: bygger site/dist/ ur mallen site/index.html och det
// färdiga bygget. Mappen kan läggas på vilken statisk webbplats som helst.
//
// Kör med:  npm run site   (efter npm run bundle)
// Valfritt: GUIDE_URL=https://…/docs/anvandare/ npm run site
//           — adressen där guiderna (Markdown) visas på den plattform som väljs.
// Output:   site/dist/index.html, oppen-lonekartlaggning.html, RELEASE.txt
//           (+ oversikt.png om dist/marknad/skarmbilder/01-oversikt.png finns,
//            + fran-fil-till-analys.gif om dist/marknad/gif/ finns)

import { readFileSync, writeFileSync, mkdirSync, copyFileSync, existsSync, rmSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const FIL = 'oppen-lonekartlaggning.html';
const BILD_KALLA = join(ROOT, 'dist', 'marknad', 'skarmbilder', '01-oversikt.png');
// Den rörliga slingan, om den finns: visas i stället för stillbilden, utom för den som bett om mindre rörelse.
const SLINGA_KALLA = join(ROOT, 'dist', 'marknad', 'gif', 'fran-fil-till-analys.gif');

const GUIDER = [
    ['korguide.md', 'Körguide', 'arbetsflödet steg för steg'],
    ['datauttag.md', 'Datauttag', 'vilka fält personalfilen behöver'],
    ['organisationspaket.md', 'Organisationspaket', 'för systemägaren'],
    ['pilotchecklista.md', 'Checklista för skarp data', 'inför första kartläggningen'],
    ['sakerhetsbeskrivning.md', 'Säkerhetsbeskrivning', 'för IT och dataskyddsombud, på en sida'],
    ['tillganglighetsredogorelse.md', 'Tillgänglighetsredogörelse', 'vad som är prövat och kända begränsningar'],
];

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Läser version, kontrollsumma och storlek ur RELEASE.txt. */
export function lasRelease(text) {
    const version = text.match(/^Version:\s+(\S+)/m)?.[1];
    const sha = text.match(/^SHA-256:\s+([0-9a-f]{64})/m)?.[1];
    const storlek = text.match(/^Size:\s+([\d.]+ [KM]?B)/m)?.[1];
    if (!version || !sha || !storlek) throw new Error('RELEASE.txt saknar version, storlek eller SHA-256 — kör npm run bundle.');
    return { version, sha, storlek };
}

/**
 * Fyller mallen.
 * @param {string} mall site/index.html
 * @param {{version:string, sha:string, storlek:string, guideUrl?:string, bild?:string, slinga?:string}} v
 */
export function byggSida(mall, { version, sha, storlek, guideUrl, bild, slinga }) {
    let guider;
    if (guideUrl) {
        if (!/^https:\/\//.test(guideUrl)) throw new Error('GUIDE_URL måste börja med https://');
        const bas = guideUrl.endsWith('/') ? guideUrl : guideUrl + '/';
        guider = '<p>Guider:</p>\n        <ul>\n' + GUIDER.map(([fil, namn, vad]) =>
            `            <li><a href="${esc(bas + fil)}">${namn}</a> — ${vad}</li>`).join('\n') + '\n        </ul>';
    } else {
        guider = '<p>Guiderna (körguide, datauttag, organisationspaket och checklistan för skarp data) finns i källkoden under <code>docs/anvandare/</code>.</p>';
    }
    // Slingan kräver stillbilden: den som har bett om mindre rörelse (prefers-reduced-motion) får stillbilden.
    const bildHtml = bild && slinga
        ? `<picture><source media="(prefers-reduced-motion: reduce)" srcset="${esc(bild)}">`
            + `<img class="bild" src="${esc(slinga)}" alt="Verktyget med påhittad data: filen öppnas, underlaget läses in och listan Att göra visar var man börjar."></picture>`
        : bild
        ? `<img class="bild" src="${esc(bild)}" alt="Verktygets översikt med påhittad data: processens steg och listan Att göra.">`
        : '';
    return mall
        .replace(/\{\{VERSION\}\}/g, esc(version))
        .replace(/\{\{SHA\}\}/g, esc(sha))
        .replace(/\{\{STORLEK\}\}/g, esc(storlek))
        .replace('{{GUIDER}}', guider)
        .replace('{{BILD}}', bildHtml);
}

function main() {
    const bygge = join(ROOT, 'dist', FIL);
    if (!existsSync(bygge)) throw new Error(`dist/${FIL} saknas — kör npm run bundle.`);
    const release = readFileSync(join(ROOT, 'dist', 'RELEASE.txt'), 'utf8');
    const info = lasRelease(release);
    const sha = createHash('sha256').update(readFileSync(bygge)).digest('hex');
    if (sha !== info.sha) throw new Error('RELEASE.txt stämmer inte med bygget — kör npm run bundle.');

    const ut = join(ROOT, 'site', 'dist');
    rmSync(ut, { recursive: true, force: true });
    mkdirSync(ut, { recursive: true });
    copyFileSync(bygge, join(ut, FIL));
    writeFileSync(join(ut, 'RELEASE.txt'), release);
    const bild = existsSync(BILD_KALLA) ? 'oversikt.png' : undefined;
    if (bild) copyFileSync(BILD_KALLA, join(ut, bild));
    const slinga = bild && existsSync(SLINGA_KALLA) ? 'fran-fil-till-analys.gif' : undefined;
    if (slinga) copyFileSync(SLINGA_KALLA, join(ut, slinga));
    const mall = readFileSync(join(ROOT, 'site', 'index.html'), 'utf8');
    writeFileSync(join(ut, 'index.html'), byggSida(mall, { ...info, guideUrl: process.env.GUIDE_URL || undefined, bild, slinga }));
    console.log(`Demosidan byggd: site/dist/ (version ${info.version}${slinga ? ', med rörlig slinga' : bild ? ', med skärmbild' : ''}${process.env.GUIDE_URL ? ', med guidelänkar' : ''})`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();

// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
// Bedömer OSV-Scanners resultat för programvaruförteckningen: node tools/sarbarheter.mjs <resultat.json>
//
// Arbetsflödet .github/workflows/sarbarheter.yml låter OSV-Scanner slå biblioteken i dist/sbom.cdx.json mot
// sårbarhetsdatabasen OSV och skriva resultatet som JSON (med --all-packages). Det här skriptet läser resultatet och
// faller (slutkod 1) om
//   - resultatet saknas eller inte går att läsa (skanningen misslyckades),
//   - ett bibliotek i förteckningen saknas i resultatet (skannern kände inte igen det och prövade det alltså inte),
//   - ett bibliotek har en känd sårbarhet som inte står i ÅTGÄRDADE för en version som är åtgärdad.
// Skriptet gör inga nätverksanrop; det läser bara filer.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { byggSbom } from './sbom.mjs';

/**
 * Kända sårbarheter som databasen anger utan åtgärdad version och därför träffar varje version av paketet, fast
 * rådgivningen själv säger var de är åtgärdade. Gäller SheetJS: npm-paketet `xlsx` slutade uppdateras vid 0.18.5,
 * och nyare versioner ges ut utanför npm-registret, så rådgivningarna kan inte ange en åtgärdad npm-version.
 * Ett fynd räknas bort bara när bibliotekets version är minst `atgardadI`; en nedgradering faller alltså igen.
 * Varje rad prövas mot rådgivningens text innan den förs in.
 * @type {Array<{ id: string, paket: string, atgardadI: string, skal: string }>}
 */
export const ÅTGÄRDADE = [
    { id: 'GHSA-4r6h-8v6p-xvw6', paket: 'xlsx', atgardadI: '0.19.3',
        skal: 'CVE-2023-30533 (prototype pollution vid inläsning): rådgivningen anger SheetJS CE 0.19.2 och tidigare.' },
    { id: 'GHSA-5pgg-2g8v-p4x9', paket: 'xlsx', atgardadI: '0.20.2',
        skal: 'CVE-2024-22363 (ReDoS): rådgivningen anger SheetJS CE före 0.20.2.' },
];

/**
 * Jämför två versioner på formen x.y.z.
 * @param {string} a
 * @param {string} b
 * @returns {number} negativt om a < b, 0 om lika, positivt om a > b.
 */
export function jämförVersion(a, b) {
    const x = a.split('.').map(Number), y = b.split('.').map(Number);
    for (let i = 0; i < Math.max(x.length, y.length); i++) {
        const d = (x[i] || 0) - (y[i] || 0);
        if (d) return d;
    }
    return 0;
}

/**
 * @typedef {{ id: string, aliases?: string[], summary?: string }} Sarbarhet
 * @typedef {{ package: { name: string, version: string, ecosystem: string }, vulnerabilities?: Sarbarhet[] }} Paket
 * @typedef {{ results?: Array<{ packages?: Paket[] }> }} Resultat
 * @typedef {{ paket: string, version: string, id: string, alias: string[], sammanfattning: string }} Fynd
 */

/**
 * Bedömer ett resultat mot förteckningens bibliotek.
 * @param {Resultat} resultat OSV-Scanners JSON-utdata.
 * @param {Array<{ purl: string }>} komponenter Förteckningens komponenter (byggSbom().components).
 * @returns {{ saknas: string[], fynd: Fynd[], bortraknade: Fynd[] }}
 */
export function bedöm(resultat, komponenter) {
    const paket = (resultat.results || []).flatMap(r => r.packages || []);
    const nyckel = (/** @type {string} */ n, /** @type {string} */ v) => `${n}@${v}`;
    const funna = new Set(paket.filter(p => p.package.ecosystem === 'npm').map(p => nyckel(p.package.name, p.package.version)));
    const saknas = komponenter.map(c => c.purl.replace(/^pkg:npm\//, '')).filter(k => !funna.has(k));
    /** @type {Fynd[]} */ const fynd = [];
    /** @type {Fynd[]} */ const bortraknade = [];
    for (const p of paket) {
        for (const s of p.vulnerabilities || []) {
            const f = { paket: p.package.name, version: p.package.version, id: s.id, alias: s.aliases || [], sammanfattning: s.summary || '' };
            const känd = ÅTGÄRDADE.find(a => a.paket === f.paket && (a.id === f.id || f.alias.includes(a.id)));
            (känd && jämförVersion(f.version, känd.atgardadI) >= 0 ? bortraknade : fynd).push(f);
        }
    }
    return { saknas, fynd, bortraknade };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
    const fil = process.argv[2];
    /** @type {Resultat} */
    let resultat;
    try {
        resultat = JSON.parse(readFileSync(fil, 'utf8'));
    } catch (e) {
        console.error(`::error::Inget läsbart resultat från OSV-Scanner (${fil}): ${e.message}. Se steget som skannar.`);
        process.exit(1);
    }
    const { saknas, fynd, bortraknade } = bedöm(resultat, byggSbom().components);
    for (const f of bortraknade) {
        console.log(`Åtgärdad i denna version, räknas bort: ${f.paket}@${f.version} ${f.id} (${ÅTGÄRDADE.find(a => a.id === f.id || f.alias.includes(a.id))?.skal})`);
    }
    for (const k of saknas) console.error(`::error::${k} finns i förteckningen men inte i resultatet: biblioteket prövades inte.`);
    for (const f of fynd) {
        console.error(`::error::${f.paket}@${f.version}: ${f.id}${f.alias.length ? ` (${f.alias.join(', ')})` : ''} ${f.sammanfattning} https://osv.dev/vulnerability/${f.id}`);
    }
    if (saknas.length || fynd.length) process.exit(1);
    console.log('Inga kända sårbarheter i biblioteken i vendor/.');
}

// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
// Bedömer OSV:s svar för programvaruförteckningen: node tools/sarbarheter.mjs <svar.json>
//
// Arbetsflödet .github/workflows/sarbarheter.yml låter tools/sarbarheter-hamta.mjs fråga sårbarhetsdatabasen OSV om
// biblioteken i dist/sbom.cdx.json och skriva svaret som JSON (en post `namn@version` med listan `vulns` per
// bibliotek). Det här skriptet läser svaret och faller (slutkod 1) om
//   - svaret saknas eller inte går att läsa (hämtningen misslyckades),
//   - ett bibliotek i förteckningen saknas i svaret (det prövades alltså inte),
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
 * @typedef {Record<string, { vulns?: Sarbarhet[] }>} Svar OSV:s svar per bibliotek, med nyckeln `namn@version`.
 * @typedef {{ paket: string, version: string, id: string, alias: string[], sammanfattning: string }} Fynd
 */

/**
 * Bedömer svaret mot förteckningens bibliotek.
 * @param {Svar} svar Svaret från tools/sarbarheter-hamta.mjs.
 * @param {Array<{ purl: string }>} komponenter Förteckningens komponenter (byggSbom().components).
 * @returns {{ saknas: string[], fynd: Fynd[], bortraknade: Fynd[] }}
 */
export function bedöm(svar, komponenter) {
    /** @type {string[]} */ const saknas = [];
    /** @type {Fynd[]} */ const fynd = [];
    /** @type {Fynd[]} */ const bortraknade = [];
    for (const k of komponenter.map(c => c.purl.replace(/^pkg:npm\//, ''))) {
        const vulns = svar?.[k]?.vulns;
        if (!Array.isArray(vulns)) { saknas.push(k); continue; }
        const i = k.lastIndexOf('@');
        const [paket, version] = [k.slice(0, i), k.slice(i + 1)];
        for (const s of vulns) {
            const f = { paket, version, id: s.id, alias: s.aliases || [], sammanfattning: s.summary || '' };
            const känd = ÅTGÄRDADE.find(a => a.paket === f.paket && (a.id === f.id || f.alias.includes(a.id)));
            (känd && jämförVersion(f.version, känd.atgardadI) >= 0 ? bortraknade : fynd).push(f);
        }
    }
    return { saknas, fynd, bortraknade };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
    const fil = process.argv[2];
    /** @type {Svar} */
    let svar;
    try {
        svar = JSON.parse(readFileSync(fil, 'utf8'));
    } catch (e) {
        console.error(`::error::Inget läsbart svar från OSV (${fil}): ${e.message}. Se steget som frågar OSV.`);
        process.exit(1);
    }
    const komponenter = byggSbom().components;
    const { saknas, fynd, bortraknade } = bedöm(svar, komponenter);
    for (const f of bortraknade) {
        console.log(`Åtgärdad i denna version, räknas bort: ${f.paket}@${f.version} ${f.id} (${ÅTGÄRDADE.find(a => a.id === f.id || f.alias.includes(a.id))?.skal})`);
    }
    for (const k of saknas) console.error(`::error::${k} finns i förteckningen men inte i svaret: biblioteket prövades inte.`);
    for (const f of fynd) {
        console.error(`::error::${f.paket}@${f.version}: ${f.id}${f.alias.length ? ` (${f.alias.join(', ')})` : ''} ${f.sammanfattning} https://osv.dev/vulnerability/${f.id}`);
    }
    if (saknas.length || fynd.length) process.exit(1);
    console.log(`${komponenter.length} bibliotek prövade. Inga kända sårbarheter i biblioteken i vendor/.`);
}

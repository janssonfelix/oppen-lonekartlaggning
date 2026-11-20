// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
// Frågar sårbarhetsdatabasen OSV om biblioteken i programvaruförteckningen:
//   node tools/sarbarheter-hamta.mjs <sbom.cdx.json> <svar.json>
//
// Arbetsflödet .github/workflows/sarbarheter.yml kör skriptet efter tools/sbom.mjs och bedömer svaret med
// tools/sarbarheter.mjs. För varje komponent i förteckningen läses paketadressen (purl) och OSV:s öppna API
// (https://api.osv.dev/v1/query) frågas med paketets namn, ekosystem och version, och ingenting annat. Svaret skrivs
// som JSON, med en post per bibliotek (`namn@version`) och dess lista `vulns`.
//
// Skriptet avslutar med 1, utan att skriva något svar, om en fråga misslyckas: nätfel, annan status än 200, ett svar
// som inte är JSON eller inte har API:ts form. Det skiljer alltså "kunde inte fråga" från fynd, som bara
// bedömningen avgör. Adressen kan bytas med miljövariabeln OSV_ADRESS (för att pröva felvägen); standardvärdet är
// den riktiga.
//
// Bara CI kör skriptet. Verktyget självt (HTML-filen) gör inga nätverksanrop (S1 i docs/utveckling/skydd.md).

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const OSV_ADRESS = 'https://api.osv.dev/v1/query';

/** Ekosystemen i purl och deras namn i OSV. Förteckningen har i dag bara npm-paket. */
const EKOSYSTEM = { npm: 'npm' };

/** Högsta antal sidor per bibliotek; skyddar mot en sidindelning som aldrig tar slut. */
const MAX_SIDOR = 50;

/**
 * Läser ekosystem, namn och version ur en paketadress på formen pkg:<typ>/<namn>@<version>.
 * @param {string} purl
 * @returns {{ ekosystem: string, namn: string, version: string }}
 */
export function läsPurl(purl) {
    const m = /^pkg:([a-z]+)\/(.+)@([^@/]+)$/.exec(purl || '');
    if (!m || !EKOSYSTEM[m[1]]) throw new Error(`okänd paketadress i förteckningen: ${purl}`);
    return { ekosystem: EKOSYSTEM[m[1]], namn: decodeURIComponent(m[2]), version: decodeURIComponent(m[3]) };
}

/**
 * Frågar OSV om varje komponent. Kastar vid första fråga som misslyckas.
 * @param {Array<{ purl: string }>} komponenter Förteckningens komponenter.
 * @param {{ fetch?: typeof fetch, adress?: string }} [val] fetch och adress kan bytas i testerna.
 * @returns {Promise<Record<string, { vulns: Array<{ id: string, aliases?: string[], summary?: string }> }>>}
 */
export async function hämta(komponenter, { fetch: f = fetch, adress = OSV_ADRESS } = {}) {
    /** @type {Record<string, { vulns: any[] }>} */
    const svar = {};
    for (const k of komponenter) {
        const { ekosystem, namn, version } = läsPurl(k.purl);
        const vulns = [];
        let sida = '';
        for (let i = 0; ; i++) {
            if (i >= MAX_SIDOR) throw new Error(`Kunde inte fråga OSV om ${namn}@${version}: fler än ${MAX_SIDOR} sidor.`);
            const fråga = { package: { name: namn, ecosystem: ekosystem }, version, ...(sida ? { page_token: sida } : {}) };
            let data;
            try {
                const r = await f(adress, {
                    method: 'POST', headers: { 'content-type': 'application/json' },
                    body: JSON.stringify(fråga), signal: AbortSignal.timeout(30000),
                });
                if (r.status !== 200) throw new Error(`status ${r.status}`);
                data = await r.json();
            } catch (e) {
                const orsak = e.cause?.code ? ` (${e.cause.code})` : '';
                throw new Error(`Kunde inte fråga OSV om ${namn}@${version} (${adress}): ${e.message}${orsak}`, { cause: e });
            }
            if (!data || typeof data !== 'object' || (data.vulns !== undefined && !Array.isArray(data.vulns))) {
                throw new Error(`Kunde inte fråga OSV om ${namn}@${version}: svaret har inte API:ts form.`);
            }
            vulns.push(...(data.vulns || []));
            sida = data.next_page_token || '';
            if (!sida) break;
        }
        svar[`${namn}@${version}`] = { vulns };
    }
    return svar;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
    const [sbomFil, utFil] = process.argv.slice(2);
    try {
        const { components } = JSON.parse(readFileSync(sbomFil, 'utf8'));
        const svar = await hämta(components, { adress: process.env.OSV_ADRESS || OSV_ADRESS });
        writeFileSync(utFil, JSON.stringify(svar, null, 2) + '\n');
        console.log(`OSV frågad om ${Object.keys(svar).length} bibliotek: ${Object.keys(svar).join(', ')} -> ${utFil}`);
    } catch (e) {
        console.error(`::error::Sårbarhetsdatabasen kunde inte frågas, så biblioteken är inte prövade (inget besked om fynd): ${e.message}`);
        process.exit(1);
    }
}

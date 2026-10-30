// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
// Programvaruförteckning (SBOM) för den byggda filen, i CycloneDX 1.5 (JSON): npm run sbom.
//
// Den byggda filen innehåller fyra tredjepartsbibliotek och ingenting annat utifrån. Förteckningen
// listar dem med version (läst ur själva biblioteksfilen, som tests/sakerhet.test.js gör), licens,
// SHA-256 (ur vendor/SHA256SUMS) och paketadress, och verktyget självt med byggets kontrollsumma.
// Organisationer under cybersäkerhetslagen (NIS2) brukar be om en sådan förteckning för varje
// program de inför; release-arbetsflödet lägger den på releasen, signerad som de andra filerna.
//
// Deterministisk: ingen tidsstämpel och inget slumpat serienummer, så att två körningar på samma
// källa ger samma fil. Körs utan nätverk och utan beroenden.

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const läs = f => readFileSync(join(root, f), 'utf8');

/** Biblioteken i den byggda filen: fil i vendor/, namn på npm, licens (SPDX) och var versionen står i filen. */
export const BIBLIOTEK = [
    { fil: 'd3.min.js',        npm: 'd3',        namn: 'D3',        licens: 'ISC',        version: /d3js\.org v(\d+\.\d+\.\d+)/ },
    { fil: 'jszip.min.js',     npm: 'jszip',     namn: 'JSZip',     licens: 'MIT',        version: /JSZip v(\d+\.\d+\.\d+)/ },
    { fil: 'papaparse.min.js', npm: 'papaparse', namn: 'PapaParse', licens: 'MIT',        version: /Papa Parse\s+v(\d+\.\d+\.\d+)/ },
    { fil: 'xlsx.mini.min.js', npm: 'xlsx',      namn: 'SheetJS Community Edition', licens: 'Apache-2.0', version: /version="(\d+\.\d+\.\d+)"/ },
];

/**
 * @typedef {{ alg: string, content: string }} Hash
 * @typedef {{ type: string, 'bom-ref': string, name: string, version: string, purl: string,
 *   licenses: Array<{ license: { id: string } }>, hashes: Hash[], properties: Array<{ name: string, value: string }> }} Komponent
 * @typedef {{ bomFormat: string, specVersion: string, version: number, serialNumber?: string,
 *   metadata: { timestamp?: string, component: { type: string, 'bom-ref': string, name: string, version: string,
 *     description: string, licenses: Array<{ license: { id: string } }>, hashes: Hash[],
 *     externalReferences: Array<{ type: string, url: string }> } },
 *   components: Komponent[], dependencies: Array<{ ref: string, dependsOn: string[] }> }} Sbom
 */

/**
 * Bygger förteckningen ur källan. Kastar om en version eller kontrollsumma saknas: hellre ett
 * byggfel än en förteckning som påstår fel sak.
 * @returns {Sbom} CycloneDX-dokumentet.
 */
export function byggSbom() {
    const version = läs('VERSION').replace(/^﻿/, '').trim();
    const summor = Object.fromEntries(läs('vendor/SHA256SUMS').trim().split('\n').map(r => {
        const [sha, fil] = r.trim().split(/\s+/); return [fil, sha];
    }));
    /** @type {Komponent[]} */
    const components = BIBLIOTEK.map(b => {
        const m = läs(`vendor/${b.fil}`).slice(0, 3000).match(b.version);
        if (!m) throw new Error(`sbom: ingen version i vendor/${b.fil}`);
        if (!summor[b.fil]) throw new Error(`sbom: ingen kontrollsumma för ${b.fil} i vendor/SHA256SUMS`);
        return {
            type: 'library',
            'bom-ref': `pkg:npm/${b.npm}@${m[1]}`,
            name: b.namn,
            version: m[1],
            purl: `pkg:npm/${b.npm}@${m[1]}`,
            licenses: [{ license: { id: b.licens } }],
            hashes: [{ alg: 'SHA-256', content: summor[b.fil] }],
            properties: [{ name: 'fil', value: `vendor/${b.fil}` }],
        };
    });
    const artefakt = join(root, 'dist', 'oppen-lonekartlaggning.html');
    /** @type {Hash[]} */
    const hashes = existsSync(artefakt)
        ? [{ alg: 'SHA-256', content: createHash('sha256').update(readFileSync(artefakt)).digest('hex') }]
        : [];
    return {
        bomFormat: 'CycloneDX',
        specVersion: '1.5',
        version: 1,
        metadata: {
            component: {
                type: 'application',
                'bom-ref': `oppen-lonekartlaggning@${version}`,
                name: 'oppen-lonekartlaggning',
                version,
                description: 'Öppen lönekartläggning: en HTML-fil som körs lokalt i webbläsaren, utan nätverk och lagring.',
                licenses: [{ license: { id: 'MIT' } }],
                hashes,
                externalReferences: [{ type: 'vcs', url: 'https://github.com/janssonfelix/oppen-lonekartlaggning' }],
            },
        },
        components,
        dependencies: [
            { ref: `oppen-lonekartlaggning@${version}`, dependsOn: components.map(c => c['bom-ref']) },
            ...components.map(c => ({ ref: c['bom-ref'], dependsOn: [] })),
        ],
    };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
    const ut = join(root, 'dist', 'sbom.cdx.json');
    const sbom = byggSbom();
    writeFileSync(ut, JSON.stringify(sbom, null, 2) + '\n');
    console.log(`SBOM: ${sbom.components.length} bibliotek -> dist/sbom.cdx.json` +
        (sbom.metadata.component.hashes.length ? '' : ' (utan artefaktens kontrollsumma: kör npm run bundle först)'));
}

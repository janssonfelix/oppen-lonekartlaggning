// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
// Genererar src/lib/aid-etiketter.js ur SKR:s etikettlista (xlsx). Excelfilen checkas inte in.
//
// Kör med:  npm run gen:aid -- "<Etikettlista AID ....xlsx>" <version, t.ex. 2026-09-23>
// Tar bara med kod, etikettnamn och möjliga ansvarskoder (inte beskrivningar och titlar).

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

/** "A, B, C och L samt annat uttalat ansvar" → ['A','B','C','L','1001','1002'] */
export function tolkaMojligaAnsvarskoder(text) {
    const forsta = String(text ?? '').split('\n')[0];
    const koder = [...new Set(forsta.match(/\b[ABCLFM]\b/g) || [])];
    if (/annat uttalat ansvar/i.test(forsta)) koder.push('1001', '1002');
    return koder;
}

/** Rader ur bladet ([kod, namn, beskrivning, titlar, hänvisning, ansvarskoder]) → etiketter. */
export function etiketterFranRader(rader) {
    return rader
        .filter(r => typeof r[0] === 'number' && /^\d{6}$/.test(String(r[0])))
        .map(r => [String(r[0]), String(r[1]).replace(/\s+/g, ' ').trim(), tolkaMojligaAnsvarskoder(r[5]).join(',')]);
}

function main() {
    const [fil, version] = process.argv.slice(2);
    if (!fil || !/^\d{4}-\d{2}-\d{2}$/.test(version || '')) {
        console.error('Användning: npm run gen:aid -- <etikettlista.xlsx> <ÅÅÅÅ-MM-DD>');
        process.exit(1);
    }
    const ctx = { console };
    ctx.self = ctx;
    ctx.window = ctx;
    vm.createContext(ctx);
    vm.runInContext(readFileSync(new URL('../vendor/xlsx.mini.min.js', import.meta.url), 'utf8'), ctx);
    const wb = ctx.XLSX.read(readFileSync(fil), { type: 'buffer' });
    const rader = ctx.XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: '' });
    const etiketter = etiketterFranRader(rader);
    if (etiketter.length < 100) throw new Error(`Bara ${etiketter.length} etiketter hittades — fel fil?`);
    const kalla = `SKR, Etikettlista AID 2018 (reviderad ${version})`;
    const lista = etiketter.map(e => `        ${JSON.stringify(e)}`).join(',\n');
    const ut = `// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
// AUTO-GENERERAD av tools/gen-aid-etiketter.mjs ur ${kalla}. Ändra inte för hand.
// Innehåller bara kod, etikettnamn och möjliga ansvarskoder per etikett.
//
// Webbläsarbygget får en AUTO-GENERERAD spegel i src/app/09-lib-speglar.js.

const LISTA = Object.freeze({
    version: '${version}',
    kalla: '${kalla}',
    etiketter: Object.freeze([
${lista}
    ])
});

/** Etikettlistan: { version, kalla, etiketter: [kod, namn, 'A,B,…'][] }. */
export function aidEtikettlista() {
    return LISTA;
}
`;
    writeFileSync(new URL('../src/lib/aid-etiketter.js', import.meta.url), ut);
    console.log(`src/lib/aid-etiketter.js: ${etiketter.length} etiketter (${kalla})`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();

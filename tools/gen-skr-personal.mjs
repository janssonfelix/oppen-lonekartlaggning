// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
// Genererar src/lib/skr-personal.js ur SKR:s personalstatistik (xlsx). Excelfilerna checkas inte in.
//
// Kör med:  npm run gen:skr -- "<Tabell4 KP ÅÅÅÅ.xlsx>" "<Tabell5 RP ÅÅÅÅ.xlsx>" <ÅÅÅÅ-MM, t.ex. 2025-11>
// Tar bara med AID-etikett, antal anställningar och andel kvinnor, för kommuner och regioner var för sig.
// SKR döljer andelen för små grupper ("**"); då sparas null.

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

/** Rader ur ett blad ([kod, klartext, antal, % kvinnor, …]) → Map kod → { n, pct|null }. */
export function etiketterFranTabell(rader) {
    const ut = new Map();
    for (const r of rader || []) {
        const kod = String(r[0] ?? '').trim();
        if (!/^\d{6}$/.test(kod)) continue;
        const n = typeof r[2] === 'number' ? r[2] : null;
        const pct = typeof r[3] === 'number' ? r[3] : null;
        if (n == null) continue;
        ut.set(kod, { n, pct });
    }
    return ut;
}

/** Slår ihop kommun- och regiontabellen till [kod, nKommun, pctKommun, nRegion, pctRegion]. */
export function slaIhopTabeller(kommun, region) {
    const koder = [...new Set([...kommun.keys(), ...region.keys()])].sort();
    return koder.map(kod => {
        const k = kommun.get(kod), r = region.get(kod);
        return [kod, k ? k.n : 0, k ? k.pct : null, r ? r.n : 0, r ? r.pct : null];
    });
}

function main() {
    const [kp, rp, period] = process.argv.slice(2);
    if (!kp || !rp || !/^\d{4}-\d{2}$/.test(period || '')) {
        console.error('Användning: npm run gen:skr -- <Tabell4 KP.xlsx> <Tabell5 RP.xlsx> <ÅÅÅÅ-MM>');
        process.exit(1);
    }
    const ctx = { console };
    ctx.self = ctx;
    ctx.window = ctx;
    vm.createContext(ctx);
    vm.runInContext(readFileSync(new URL('../vendor/xlsx.mini.min.js', import.meta.url), 'utf8'), ctx);
    const las = fil => {
        const wb = ctx.XLSX.read(readFileSync(fil), { type: 'buffer' });
        return etiketterFranTabell(ctx.XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: '' }));
    };
    const kommun = las(kp), region = las(rp);
    if (kommun.size < 100 || region.size < 100) throw new Error(`Bara ${kommun.size}/${region.size} etiketter hittades — fel fil?`);
    const [ar, man] = period.split('-');
    const manad = ['januari', 'februari', 'mars', 'april', 'maj', 'juni', 'juli', 'augusti', 'september', 'oktober', 'november', 'december'][+man - 1];
    const kalla = `SKR, personalstatistik ${manad} ${ar} (Tabell 4 KP, Tabell 5 RP)`;
    const lista = slaIhopTabeller(kommun, region).map(e => `        ${JSON.stringify(e)}`).join(',\n');
    const ut = `// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
// AUTO-GENERERAD av tools/gen-skr-personal.mjs ur ${kalla}. Ändra inte för hand.
// Per AID-etikett: antal anställningar och andel kvinnor (%) i kommuner respektive regioner.
// null = SKR redovisar inte andelen (små tal).
//
// Webbläsarbygget får en AUTO-GENERERAD spegel i src/app/09-lib-speglar.js.

const STATISTIK = Object.freeze({
    period: '${period}',
    kalla: '${kalla}',
    etiketter: Object.freeze([
${lista}
    ])
});

/** SKR:s personalstatistik: { period, kalla, etiketter: [kod, nKommun, pctKommun|null, nRegion, pctRegion|null][] }. */
export function skrPersonalstatistik() {
    return STATISTIK;
}
`;
    writeFileSync(new URL('../src/lib/skr-personal.js', import.meta.url), ut);
    console.log(`src/lib/skr-personal.js: ${kommun.size} etiketter i kommuner, ${region.size} i regioner (${kalla})`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();

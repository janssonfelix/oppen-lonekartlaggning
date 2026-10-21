// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
/**
 * Genererar tests/fixtures/stat-referens.json — en liten deterministisk lönefil
 * som referenstesterna i tests/stat-referens.test.js räknar på.
 *
 *   node tests/fixtures/gen-stat-referens.mjs
 *
 * Seedad mulberry32 (src/lib/rng.js) ⇒ samma fil varje gång. 100 rader med BAS A–F,
 * kön, ålder och lön. Sann modell i log-lön:
 *   ln(lön) = 10,25 + 0,06·BAS-rang − 0,05·kvinna + 0,006·(ålder − 42) + ε
 * där ε är heteroskedastisk (spridningen växer med BAS-rang och ålder), så att
 * HC3 och klassisk varians skiljer sig åt på ett sätt som ett test kan se.
 *
 * Filen innehåller BÅDE råraderna (för funktionerna i app-scope, som själva
 * centrerar) och de centrerade designkolumnerna (så att referensskriptet i
 * Python kan räkna på exakt samma X och y utan att känna verktygets logik).
 * Centreringen följer verktyget: ålder centreras på radmedel, BAS-rang på
 * medelvärdet av de UNIKA rangerna (se runQuantileRegressionAtAllTau).
 */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { mulberry32 } from '../../src/lib/rng.js';
import { basRangFn } from '../../src/lib/likvardighet.js';

const rnd = mulberry32(20261016);
// Box–Muller ur två uniforma drag.
const normal = () => Math.sqrt(-2 * Math.log(1 - rnd())) * Math.cos(2 * Math.PI * rnd());

const basLista = ['A', 'B', 'C', 'D', 'E', 'F'];
const rows = [];
for (let i = 0; i < 100; i++) {
    const kv = rnd() < 0.55 ? 1 : 0;
    // Kvinnor något oftare i lägre BAS (ger en endowment-komponent i Blinder-Oaxaca).
    const basIdx = Math.min(5, Math.floor(rnd() * (kv ? 5 : 6) + (kv ? 0 : 0.6)));
    const bas = basLista[basIdx];
    const rang = basIdx + 1;
    const alder = Math.round(24 + rnd() * 40);
    const sd = 0.04 + 0.015 * rang + 0.002 * Math.abs(alder - 42);
    const lnLon = 10.25 + 0.06 * rang - 0.05 * kv + 0.006 * (alder - 42) + sd * normal();
    rows.push({ bas, kon: kv ? 'kvinna' : 'man', alder, lon: Math.round(Math.exp(lnLon)), yrke: '000 Testyrke' });
}

const rang = basRangFn(rows.map(r => r.bas));
const unika = [...new Set(rows.map(r => r.bas))].sort().map(rang);
const basMean = unika.reduce((s, v) => s + v, 0) / unika.length;
const ageMean = rows.reduce((s, r) => s + r.alder, 0) / rows.length;
const design = rows.map(r => ({
    y: Math.log(r.lon),
    kv: r.kon === 'kvinna' ? 1 : 0,
    alderC: r.alder - ageMean,
    basC: rang(r.bas) - basMean
}));

const ut = {
    _kommentar: 'Genererad av tests/fixtures/gen-stat-referens.mjs (seed 20261016). Ändra inte för hand — referensvärdena i stat-referens.test.js hör ihop med exakt dessa tal.',
    seed: 20261016,
    ageMean, basMean,
    rows, design
};
writeFileSync(join(dirname(fileURLToPath(import.meta.url)), 'stat-referens.json'), JSON.stringify(ut, null, 1) + '\n');
console.log(`skrev ${rows.length} rader; kvinnor=${rows.filter(r => r.kon === 'kvinna').length}, ageMean=${ageMean}, basMean=${basMean}`);

// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
// Skapar en påhittad personalfil att prova verktyget med.
//
// Kör med:  npm run gen:testdata               (5 000 personer → testdata_5000.csv)
//           npm run gen:testdata -- 55000 ut.csv
// CSV-filer checkas aldrig in (.gitignore).

import { writeFileSync } from 'node:fs';
import { byggTestCsv } from './lib/testdata.mjs';

const n = Number(process.argv[2] || 5000);
if (!Number.isInteger(n) || n < 1) { console.error('Ange antal personer som ett positivt heltal.'); process.exit(1); }
const ut = process.argv[3] || `testdata_${n}.csv`;
writeFileSync(ut, '﻿' + byggTestCsv(n));
console.log(`Påhittad personalfil med ${n} personer: ${ut}`);

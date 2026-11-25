// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
// Läser första bladet i en Excel-fil som rader, med samma SheetJS som verktyget (vendor/), åt generatorerna
// tools/gen-aid-etiketter.mjs och tools/gen-skr-personal.mjs.
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

/** Första bladet i filen som en lista med rader (tomma celler som ''). */
export function forstaBladetsRader(fil) {
    const ctx = { console };
    ctx.self = ctx;
    ctx.window = ctx;
    vm.createContext(ctx);
    vm.runInContext(readFileSync(new URL('../../vendor/xlsx.mini.min.js', import.meta.url), 'utf8'), ctx);
    const wb = ctx.XLSX.read(readFileSync(fil), { type: 'buffer' });
    return ctx.XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: '' });
}

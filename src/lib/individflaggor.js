// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
/**
 * Öppen lönekartläggning — Personer att granska (ADR-23)
 *
 * För varje person i en grupp med samma AID och BAS (minst minGrupp personer) räknas en
 * förväntad lön från KOLLEGORNA (utan personen själv): ln(lön) = a + b·ålder när
 * kollegornas åldersspridning är minst 5 år, annars kollegornas medianlön. Personen
 * flaggas när lönen ligger minst `grans` procent under den förväntade. Allt i O(n log n)
 * per grupp: summorna för regressionen och den sorterade lönelistan räknas en gång och
 * personen dras bort.
 *
 * Webbläsarbygget får en AUTO-GENERERAD spegel i src/app/09-lib-speglar.js.
 */

import { groupKey, konOf } from './falt.js';

// Median av en sorterad lista där ett exemplar av värdet v tas bort.
function _medianUtan(sorterad, v) {
    let lo = 0, hi = sorterad.length;
    while (lo < hi) { const m = (lo + hi) >> 1; if (sorterad[m] < v) lo = m + 1; else hi = m; }
    const bort = lo, n = sorterad.length - 1;
    const vid = p => sorterad[p < bort ? p : p + 1];
    return n % 2 ? vid((n - 1) / 2) : (vid(n / 2 - 1) + vid(n / 2)) / 2;
}

function _grupp(g, grans) {
    const n = g.length, m = n - 1;
    const medelAlder = g.reduce((s, r) => s + r.alder, 0) / n;
    const x = g.map(r => r.alder - medelAlder), y = g.map(r => Math.log(r.lon));
    let Sx = 0, Sy = 0, Sxx = 0, Sxy = 0;
    for (let i = 0; i < n; i++) { Sx += x[i]; Sy += y[i]; Sxx += x[i] * x[i]; Sxy += x[i] * y[i]; }
    const aldrar = g.map(r => r.alder).sort((a, b) => a - b);
    const loner = g.map(r => r.lon).sort((a, b) => a - b);
    const ut = [];
    for (let i = 0; i < n; i++) {
        const r = g[i];
        const lagst = r.alder === aldrar[0] ? aldrar[1] : aldrar[0];
        const hogst = r.alder === aldrar[n - 1] ? aldrar[n - 2] : aldrar[n - 1];
        const sx = Sx - x[i], sy = Sy - y[i], sxx = Sxx - x[i] * x[i], sxy = Sxy - x[i] * y[i];
        const vxx = sxx - sx * sx / m;
        let forvantad, metod;
        if (hogst - lagst >= 5 && vxx > 1e-9) {
            const b = (sxy - sx * sy / m) / vxx, a = (sy - b * sx) / m;
            forvantad = Math.exp(a + b * x[i]); metod = 'alder';
        } else {
            forvantad = _medianUtan(loner, r.lon); metod = 'median';
        }
        const avvikelsePct = (r.lon - forvantad) / forvantad * 100;
        if (avvikelsePct <= -grans) {
            ut.push({ radnr: r.radnr ?? null, kon: konOf(r), alder: r.alder, aid: groupKey(r, 'aid'), bas: r.bas,
                      lon: r.lon, forvantad, avvikelsePct, kollegor: m, metod, ansvarsgrupp: r.ansvarsgrupp ?? null });
        }
    }
    return ut;
}

export function flaggaIndivider(rader, { minGrupp = 10, grans = 10 } = {}) {
    const grupper = new Map();
    for (const r of rader || []) {
        if (!(r.lon > 0) || !(r.alder > 0)) continue;
        const kon = konOf(r);
        if (kon !== 'Kvinna' && kon !== 'Man') continue;
        const nyckel = `${groupKey(r, 'aid')}\u0000${r.bas}`;
        if (!grupper.has(nyckel)) grupper.set(nyckel, []);
        grupper.get(nyckel).push(r);
    }
    const provade = { kv: 0, ma: 0 };
    let ejProvade = 0;
    const flaggade = [];
    for (const g of grupper.values()) {
        if (g.length < minGrupp) { ejProvade += g.length; continue; }
        for (const r of g) konOf(r) === 'Kvinna' ? provade.kv++ : provade.ma++;
        flaggade.push(..._grupp(g, grans));
    }
    flaggade.sort((a, b) => a.avvikelsePct - b.avvikelsePct || (a.radnr ?? Infinity) - (b.radnr ?? Infinity));
    const tot = provade.kv + provade.ma;
    const kvFlagg = flaggade.filter(f => f.kon === 'Kvinna').length;
    return { provade, ejProvade, flaggade, andelKv: {
        provade: tot ? provade.kv / tot * 100 : null,
        flaggade: flaggade.length ? kvFlagg / flaggade.length * 100 : null,
    } };
}

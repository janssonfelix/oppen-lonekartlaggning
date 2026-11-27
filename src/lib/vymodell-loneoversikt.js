// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
/**
 * Öppen lönekartläggning — vymodellen för Löneöversikten, tabellen överst i Tabeller och egna vyer (ADR-99): per
 * BAS-intervall referensens rad, organisationen, kvinnorna, männen och varje yrkesgrupp (AID-koden inom intervallet,
 * ADR-89) med minst fem personer, med
 * P10, median, P90, antal, spridning och jämförelsestatistikens median. Allt som räknas och maskeras står här, med
 * tröskeln som argument; ritfunktionen i src/app/39-loneoversikt.js (ritaLoneoversikt) ritar bara det den får.
 */
import { aidAvRad, aidAvYrke, namnrader } from './aid.js';
import { statistikFor } from './jamforelse.js';
import { arKvinna, arMan } from './kon.js';
import { kvantil, median } from './stat.js';

/** En yrkesgrupp med färre personer får ingen egen rad (den ingår i organisationens rad). */
export const LONEOVERSIKT_MINSTA_YRKE = 5;

/**
 * Vymodellen. En rad med färre än k personer utelämnas och namnges i sitt intervalls `utelamnade`; en yrkesgrupp med
 * färre än fem personer får ingen rad och räknas i `smaYrken`. En rad ligger `underReferens` när dess median är under
 * referensens P10. Mot jämförelsestatistiken (AID-koden i kategorin och BAS-intervallet) står statistikens median och
 * skillnaden i procent, när statistiken har en rad med positiv median.
 * @param {any[]} rader
 * @param {{bas:string[], k:number, policyFor?:((aid:any, bas:string) => any)|null, statistik?:any[]}} val
 *   policyFor: ställningstagandets rad för en AID-kod och ett BAS-intervall
 */
export function vymodellLoneoversikt(rader, { bas, k, policyFor, statistik = [] }) {
    let utelamnade = 0, smaYrken = 0;
    const block = bas.map(b => {
        const df = rader.filter(r => r.bas === b);
        const referens = policyFor ? policyFor(null, b) || null : null;
        const radlista = [], basUtelamnade = [];
        const rad = (kategori, subset) => {
            if (!subset.length) return;
            if (subset.length < k) { utelamnade++; basUtelamnade.push(kategori); return; }
            const lons = subset.map(r => r.lon);
            const med = median(lons), p10 = kvantil(lons, 0.1), p90 = kvantil(lons, 0.9);
            /** @type {number|null} */ let statMedian = null;
            /** @type {number|null} */ let statDiff = null;
            if (statistik.length) {
                const sr = statistikFor(statistik, aidAvYrke(kategori), b)?.rad;
                if (sr && sr.median > 0) { statMedian = sr.median; statDiff = (med / sr.median - 1) * 100; }
            }
            radlista.push({ kategori, lons, n: lons.length, p10, med, p90, spridning: p10 > 0 ? p90 / p10 : null,
                underReferens: !!(referens && referens.p10 && med < referens.p10), statMedian, statDiff });
        };
        rad('Organisationen', df);
        rad('Kvinna', df.filter(r => arKvinna(r)));
        rad('Man', df.filter(r => arMan(r)));
        // En yrkesgrupp är AID-koden inom BAS-intervallet (ADR-89), med texten som står på flest av gruppens rader.
        const namn = namnrader(df, aidAvRad), perKod = new Map();
        df.forEach(r => { const kod = aidAvRad(r); if (!perKod.has(kod)) perKod.set(kod, []); perKod.get(kod).push(r); });
        [...perKod].map(([kod, g]) => [String(namn.get(kod).yrke ?? kod), g]).sort((x, y) => (x[0] < y[0] ? -1 : x[0] > y[0] ? 1 : 0)).forEach(([y, g]) => {
            if (g.length >= LONEOVERSIKT_MINSTA_YRKE) rad(y, g);
            else smaYrken++;
        });
        return { bas: b, referens, rader: radlista, utelamnade: basUtelamnade };
    });
    return { block, utelamnade, smaYrken };
}

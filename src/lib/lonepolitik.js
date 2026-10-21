// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
/**
 * Öppen lönekartläggning — Lönepolitiskt ställningstagande (ren kärna)
 *
 * Rena funktioner för att analysera organisationens löneläge mot det EGNA
 * lönepolitiska ställningstagandet (P10/Median/P90 per BAS och/eller AID).
 * Separat från app.js för att kunna testas via Vitest utan DOM/state; app.js
 * får en AUTO-GENERERAD spegel (`_lp*` i src/app/09-lib-speglar.js via
 * tools/gen-mirrors.mjs) — ändra här och kör `npm run build:app`, rör ej
 * spegeln (vaktas av tests/drift.test.js).
 *
 * Själva uppslaget (vilken policyrad som gäller för en grupp) görs av
 * policyFor() i app.js, eftersom det läser state. Här hanteras bara matematiken
 * när bandet väl är känt.
 *
 * Maskeringstrappan (tre steg, se `src/app/75-lonepolitik.js`) tillämpas av anroparen; de här
 * funktionerna räknar på det de får och rapporterar n så att anroparen kan
 * maskera.
 */

function _lpMedian(arr) {
    if (!arr || !arr.length) return 0;
    const s = arr.slice().sort((a, b) => a - b);
    const m = Math.floor(s.length / 2);
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

// Linjär interpolation mellan närmaste rangvärden (samma definition som stat.quantile).
function _lpQuantile(sorted, q) {
    const pos = (sorted.length - 1) * q;
    const lo = Math.floor(pos), hi = Math.ceil(pos);
    return lo === hi ? sorted[lo] : sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

/**
 * Organisationens faktiska lönespann i en grupp (P10, median, P90) — jämförs med
 * referensens band i bandkartan. Percentiler kräver minst k personer; annars null.
 * @returns {null|{n:number, p10:number, med:number, p90:number}}
 */
export function organisationsBand(rows, k) {
    const lons = (rows || []).map(r => r.lon).filter(v => v > 0).sort((a, b) => a - b);
    if (lons.length < k) return null;
    return { n: lons.length, p10: _lpQuantile(lons, 0.1), med: _lpMedian(lons), p90: _lpQuantile(lons, 0.9) };
}

function _lpIsKvinna(r) {
    return typeof r.kon === 'string' && r.kon.includes('kvinna');
}
function _lpIsMan(r) {
    return r.kon === 'man' || r.kon === 'män';
}

/**
 * Var i sitt eget lönespann ligger en lön?
 *
 * 0 = exakt på P10, 1 = exakt på P90. Värdet klämms INTE till [0,1] — ett
 * resultat < 0 betyder "under policyns golv" och > 1 "över policyns tak", och
 * det är just den informationen analysen finns till för. Anroparen klämmer vid
 * behov för ritning.
 *
 * Returnerar null när bandet inte är användbart (saknade eller icke-positiva
 * gränser, eller P90 ≤ P10 — då är positionsmåttet odefinierat/instabilt).
 *
 * @param {number} lon
 * @param {number} p10
 * @param {number} p90
 * @returns {number|null}
 */
export function bandPosition(lon, p10, p90) {
    if (!(lon > 0) || !(p10 > 0) || !(p90 > 0)) return null;
    if (p90 <= p10) return null;
    return (lon - p10) / (p90 - p10);
}

/**
 * Sammanfattar en grupp mot sitt band.
 * @param {Array<{lon:number, kon?:string}>} rows
 * @param {{p10:number, med:number, p90:number}} pol
 * @returns {null|{n:number, median:number, position:number|null, medianVsPolicyPct:number|null, p10:number, med:number, p90:number}}
 */
export function groupBandStats(rows, pol) {
    if (!Array.isArray(rows) || !rows.length || !pol) return null;
    const lons = rows.map(r => r.lon).filter(v => v > 0);
    if (!lons.length) return null;
    const median = _lpMedian(lons);
    return {
        n: lons.length,
        median,
        position: bandPosition(median, pol.p10, pol.p90),
        medianVsPolicyPct: pol.med > 0 ? ((median / pol.med) - 1) * 100 : null,
        p10: pol.p10, med: pol.med, p90: pol.p90
    };
}

/**
 * Hur många individer ligger under golvet, inom bandet respektive över taket?
 * Kräver positiva P10/P90; annars null.
 * @returns {null|{n:number, under:number, within:number, over:number, underPct:number, overPct:number}}
 */
export function complianceCounts(rows, pol) {
    if (!Array.isArray(rows) || !rows.length || !pol) return null;
    if (!(pol.p10 > 0) || !(pol.p90 > 0)) return null;
    // Samma kontroll som bandPosition: ett inverterat band (P10 >= P90) är
    // malformerad policydata. Utan den skulle varje individ hamna i "under"
    // eller "över" och "inom spann" alltid bli 0 — ett tyst, trovärdigt fel.
    if (pol.p90 <= pol.p10) return null;
    let under = 0, over = 0, n = 0;
    for (const r of rows) {
        if (!(r.lon > 0)) continue;
        n++;
        if (r.lon < pol.p10) under++;
        else if (r.lon > pol.p90) over++;
    }
    if (!n) return null;
    return {
        n, under, over, within: n - under - over,
        underPct: (under / n) * 100,
        overPct: (over / n) * 100
    };
}

/**
 * Könsskillnad i bandposition — analysens kärnfråga: placeras kvinnor lägre i
 * SAMMA lönespann än män?
 *
 * Kräver minst `minPerKon` av varje kön (k-anonymitet + meningsfullhet).
 * diff > 0 betyder att kvinnor i snitt ligger HÖGRE i bandet än män;
 * diff < 0 att de ligger lägre.
 *
 * @param {Array<{lon:number, kon:string}>} rows
 * @param {{p10:number, p90:number}} pol
 * @param {number} [minPerKon=10]
 * @returns {null|{nKv:number, nMa:number, kvPos:number, maPos:number, diff:number}}
 */
export function genderBandGap(rows, pol, minPerKon = 10) {
    if (!Array.isArray(rows) || !pol) return null;
    const posOf = r => bandPosition(r.lon, pol.p10, pol.p90);
    const kv = rows.filter(_lpIsKvinna).map(posOf).filter(v => v != null);
    const ma = rows.filter(_lpIsMan).map(posOf).filter(v => v != null);
    if (kv.length < minPerKon || ma.length < minPerKon) return null;
    const mean = a => a.reduce((s, v) => s + v, 0) / a.length;
    const kvPos = mean(kv), maPos = mean(ma);
    return { nKv: kv.length, nMa: ma.length, kvPos, maPos, diff: kvPos - maPos };
}

/**
 * Kostnad för att lyfta alla under golvet upp till policyns P10.
 * Returnerar månadsbelopp (exkl. PO) — anroparen lägger på PO-påslag och
 * beräkningsperiod från state.costSettings, som i Löneöversyn.
 * @returns {null|{nAffected:number, totalMonth:number}}
 */
export function costToFloor(rows, pol) {
    if (!Array.isArray(rows) || !pol || !(pol.p10 > 0)) return null;
    // Golvet ensamt är meningsfullt även utan tak, men ett ANGIVET tak under
    // golvet betyder att bandet är felvänt — räkna då inte på det.
    if (pol.p90 > 0 && pol.p90 <= pol.p10) return null;
    let nAffected = 0, totalMonth = 0;
    for (const r of rows) {
        if (!(r.lon > 0)) continue;
        if (r.lon < pol.p10) { nAffected++; totalMonth += pol.p10 - r.lon; }
    }
    return { nAffected, totalMonth };
}

/**
 * Täckningsgrad: hur stor del av personalen omfattas över huvud taget av en
 * policyrad? En ofullständig policyfil får inte se ut som ett gott resultat —
 * "inga avvikelser" kan betyda "ingen referens".
 *
 * @param {Array<{n:number, hasPolicy:boolean}>} groups
 * @returns {{groupsTotal:number, groupsCovered:number, personsTotal:number, personsCovered:number, personsPct:number}}
 */
export function policyCoverage(groups) {
    const g = Array.isArray(groups) ? groups : [];
    let personsTotal = 0, personsCovered = 0, groupsCovered = 0;
    for (const x of g) {
        const n = x && x.n > 0 ? x.n : 0;
        personsTotal += n;
        if (x && x.hasPolicy) { groupsCovered++; personsCovered += n; }
    }
    return {
        groupsTotal: g.length,
        groupsCovered,
        personsTotal,
        personsCovered,
        personsPct: personsTotal ? (personsCovered / personsTotal) * 100 : 0
    };
}

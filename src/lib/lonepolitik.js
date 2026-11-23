// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
/**
 * Öppen lönekartläggning — Lönepolitiskt ställningstagande (ren kärna)
 *
 * Rena funktioner för att analysera organisationens löneläge mot det EGNA
 * lönepolitiska ställningstagandet (P10/Median/P90 per BAS och/eller AID).
 * Separat från appen för att kunna testas via Vitest utan DOM/state.
 *
 * Själva uppslaget (vilken policyrad som gäller för en grupp) görs av
 * policyFor() i app.js, eftersom det läser state; lonepolitikModell() tar emot
 * det som argument, liksom tröskeln k.
 *
 * Maskeringstrappan (tre steg, `maskeringsniva`) sätts på varje yrkesgrupp i
 * modellen; ritningen tillämpar den (`src/app/75-lonepolitik.js`). De andra
 * funktionerna räknar på det de får och rapporterar n så att anroparen kan
 * maskera.
 *
 * Bygger på: verktygets egen modell.
 * Beräkningarna står i spårbarhetsmatrisen, docs/utveckling/sparbarhet.md (B6.1–B6.3).
 */

import { median as _median, kvantil as _kvantil } from './stat.js';
import { arKvinna, arMan } from './kon.js';
import { aidAvYrke, namnrader } from './aid.js';

/** Undre gräns för den antalsbaserade mellannivån i maskeringstrappan. */
const ANTAL_MIN = 5;

/** Konstanterna ovan i ett objekt, för appen. */
export function lonepolitikKonstanter() {
    return Object.freeze({ ANTAL_MIN });
}

/**
 * Organisationens faktiska lönespann i en grupp (P10, median, P90) — jämförs med
 * referensens band i bandkartan. Percentiler kräver minst k personer; annars null.
 * @returns {null|{n:number, p10:number, med:number, p90:number}}
 */
export function organisationsBand(rader, k) {
    const lons = (rader || []).map(r => r.lon).filter(v => v > 0).sort((a, b) => a - b);
    if (lons.length < k) return null;
    return { n: lons.length, p10: _kvantil(lons, 0.1), med: _median(lons), p90: _kvantil(lons, 0.9) };
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
export function bandlage(lon, p10, p90) {
    if (!(lon > 0) || !(p10 > 0) || !(p90 > 0)) return null;
    if (p90 <= p10) return null;
    return (lon - p10) / (p90 - p10);
}

/**
 * Sammanfattar en grupp mot sitt band.
 * @param {Array<{lon:number, kon?:string}>} rader
 * @param {{p10:number, med:number, p90:number}} pol
 * @returns {null|{n:number, median:number, position:number|null, medianVsPolicyPct:number|null, p10:number, med:number, p90:number}}
 */
export function gruppMotBand(rader, pol) {
    if (!Array.isArray(rader) || !rader.length || !pol) return null;
    const lons = rader.map(r => r.lon).filter(v => v > 0);
    if (!lons.length) return null;
    const median = _median(lons);
    return {
        n: lons.length,
        median,
        position: bandlage(median, pol.p10, pol.p90),
        medianVsPolicyPct: pol.med > 0 ? ((median / pol.med) - 1) * 100 : null,
        p10: pol.p10, med: pol.med, p90: pol.p90
    };
}

/**
 * Hur många individer ligger under golvet, inom bandet respektive över taket?
 * Kräver positiva P10/P90; annars null.
 * @returns {null|{n:number, under:number, within:number, over:number, underPct:number, overPct:number}}
 */
export function antalMotBand(rader, pol) {
    if (!Array.isArray(rader) || !rader.length || !pol) return null;
    if (!(pol.p10 > 0) || !(pol.p90 > 0)) return null;
    // Samma kontroll som bandlage: ett inverterat band (P10 >= P90) är
    // malformerad policydata. Utan den skulle varje individ hamna i "under"
    // eller "över" och "inom spann" alltid bli 0 — ett tyst, trovärdigt fel.
    if (pol.p90 <= pol.p10) return null;
    let under = 0, over = 0, n = 0;
    for (const r of rader) {
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
 * @param {Array<{lon:number, kon:string}>} rader
 * @param {{p10:number, p90:number}} pol
 * @param {number} [minPerKon=10]
 * @returns {null|{nKv:number, nMa:number, kvPos:number, maPos:number, diff:number}}
 */
export function konsskillnadIBand(rader, pol, minPerKon = 10) {
    if (!Array.isArray(rader) || !pol) return null;
    const posOf = r => bandlage(r.lon, pol.p10, pol.p90);
    const kv = rader.filter(arKvinna).map(posOf).filter(v => v != null);
    const ma = rader.filter(arMan).map(posOf).filter(v => v != null);
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
export function kostnadTillGolv(rader, pol) {
    if (!Array.isArray(rader) || !pol || !(pol.p10 > 0)) return null;
    // Golvet ensamt är meningsfullt även utan tak, men ett ANGIVET tak under
    // golvet betyder att bandet är felvänt — räkna då inte på det.
    if (pol.p90 > 0 && pol.p90 <= pol.p10) return null;
    let nAffected = 0, totalMonth = 0;
    for (const r of rader) {
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
 * @param {Array<{n:number, hasPolicy:boolean}>} grupper
 * @returns {{groupsTotal:number, groupsCovered:number, personsTotal:number, personsCovered:number, personsPct:number}}
 */
export function tackningsgrad(grupper) {
    const g = Array.isArray(grupper) ? grupper : [];
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

/**
 * Maskeringstrappan för en yrkesgrupp med n personer, vid tröskeln k:
 *   n >= k                    → 'full': full analys (median, band, kön)
 *   ANTAL_MIN <= n < k        → 'count': endast bandplacering i antal ("2 av 7 under P10")
 *   n < min(ANTAL_MIN, k)     → 'masked': maskerad rad, men inräknad i BAS-totalen
 * Är tröskeln ANTAL_MIN eller lägre finns ingen mellannivå.
 * @returns {'full'|'count'|'masked'}
 */
export function maskeringsniva(n, k) {
    if (n >= k) return 'full';
    if (n >= ANTAL_MIN) return 'count';
    return 'masked';
}

/**
 * Lägesklassen för ett läge i spannet (0 = P10, 1 = P90): 0 under spannet, 1–3 nedre, mellersta och övre tredjedelen,
 * 4 över spannet.
 */
export function lagesklass(pos) { return pos < 0 ? 0 : pos < 1 / 3 ? 1 : pos <= 2 / 3 ? 2 : pos <= 1 ? 3 : 4; }

/**
 * Antalet kvinnor och män i varje lägesklass mot bandet (personer utan användbart läge räknas inte).
 * @returns {{kv:number[], ma:number[]}}
 */
export function konLagen(rader, pol) {
    const ut = { kv: [0, 0, 0, 0, 0], ma: [0, 0, 0, 0, 0] };
    for (const r of rader) {
        const kon = arKvinna(r) ? 'kv' : arMan(r) ? 'ma' : null;
        const pos = kon ? bandlage(r.lon, pol.p10, pol.p90) : null;
        if (pos != null && isFinite(pos)) ut[kon][lagesklass(pos)]++;
    }
    return ut;
}

/**
 * Hela analysmodellen för Löneläget mot ställningstagandet: per BAS-intervall, med AID-grupperna under sig.
 * Grupperna är AID (ur yrkesfältet) × BAS; rader utan lön eller BAS räknas inte. BAS-intervallen sorteras i svensk
 * ordning, grupperna i fallande storlek.
 * @param {any[]} rader lönerader
 * @param {{policyFor:(aid:any, bas:any)=>any, nivaEtikett:(pol:any)=>any, k:number, harPolicy:boolean}} opt
 *   policyFor: policyraden som gäller (null om ingen); nivaEtikett: nivån som träffen kom ifrån, för visning;
 *   k: tröskeln som maskeringstrappan, könsgapet och organisationens band prövas mot; harPolicy: om ett
 *   ställningstagande är inläst (utan det byggs ingen modell).
 * @returns {{byBas: any[], coverage: any, hasPolicy: boolean}}
 */
export function lonepolitikModell(rader, { policyFor, nivaEtikett, k, harPolicy }) {
    /** @type {{byBas: any[], coverage: any, hasPolicy: boolean}} */
    const out = { byBas: [], coverage: null, hasPolicy: !!harPolicy };
    if (!rader.length || !out.hasPolicy) return out;

    // Gruppera AID×BAS
    const groups = new Map();
    // Gruppens namn ur texten på flest av dess rader (namnrader), som i resten av verktyget (ADR-89).
    const namnrad = namnrader(rader.filter(r => r.lon > 0 && r.bas), r => aidAvYrke(r.yrke) + '|' + r.bas);
    rader.forEach(r => {
        if (!(r.lon > 0) || !r.bas) return;
        const aid = aidAvYrke(r.yrke);
        const key = aid + '|' + r.bas;
        if (!groups.has(key)) groups.set(key, { aid, bas: r.bas, yrke: namnrad.get(key).yrke, rows: [] });
        groups.get(key).rows.push(r);
    });

    const coverageInput = [];
    const basMap = new Map();
    for (const g of groups.values()) {
        const pol = policyFor(g.aid, g.bas);
        coverageInput.push({ n: g.rows.length, hasPolicy: !!pol });
        if (!basMap.has(g.bas)) basMap.set(g.bas, { bas: g.bas, rows: [], groups: [] });
        const b = basMap.get(g.bas);
        b.rows.push(...g.rows);
        b.groups.push({
            aid: g.aid, bas: g.bas, yrke: g.yrke, n: g.rows.length, rows: g.rows,
            pol, level: nivaEtikett(pol), tier: maskeringsniva(g.rows.length, k),
            stats: pol ? gruppMotBand(g.rows, pol) : null,
            compliance: pol ? antalMotBand(g.rows, pol) : null
        });
    }
    out.coverage = tackningsgrad(coverageInput);

    out.byBas = [...basMap.values()].map(b => {
        // BAS-nivåns eget band (AID-specifika rader gäller bara sina yrken)
        const pol = policyFor(null, b.bas);
        return {
            bas: b.bas,
            pol,
            level: nivaEtikett(pol),
            n: b.rows.length,
            stats: pol ? gruppMotBand(b.rows, pol) : null,
            compliance: pol ? antalMotBand(b.rows, pol) : null,
            genderGap: pol ? konsskillnadIBand(b.rows, pol, k) : null,
            konLagen: pol ? konLagen(b.rows, pol) : null,
            cost: pol ? kostnadTillGolv(b.rows, pol) : null,
            orgBand: organisationsBand(b.rows, k),   // organisationens eget P10–P90 (null under k)
            groups: b.groups.sort((x, y) => y.n - x.n)
        };
    }).sort((a, b) => String(a.bas).localeCompare(String(b.bas), 'sv'));

    return out;
}

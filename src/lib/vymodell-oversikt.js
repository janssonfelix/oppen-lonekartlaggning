// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
/**
 * Öppen lönekartläggning — vymodellen för Översikt (ADR-99): nyckeltalen (antal, kön, medelålder och kvinnors median
 * i procent av mäns för hela organisationen) och läget mot lagkraven (korten Säkerställd skillnad, Könsfördelning,
 * Under referensens P10 och Under jämförelsestatistiken). Allt som räknas, maskeras och bedöms står här, med
 * tröskeln som argument; ritfunktionerna i src/app/13-oversikt.js (ritaNyckeltal, ritaKravstatus) ritar bara det de
 * får och skriver orden.
 */
import { aidAvYrke } from './aid.js';
import { jamforbaraBas } from './datakvalitet.js';
import { statistikFor } from './jamforelse.js';
import { arKvinna, arMan } from './kon.js';
import { median } from './stat.js';
import { konsMedianer } from './struktur.js';
import { JAMN_KONSFORDELNING, oversiktNiva, oversiktPerBas } from './vymodell-lonestruktur.js';

/**
 * Nyckeltalen överst, eller null utan underlag. Kvoten (kvinnors median i procent av mäns) bara när båda könen når k
 * (`lage` 'ok'); 'underK' när ett kön är under k och 'ettKonSaknas' när ett kön saknas helt.
 * @param {any[]} rader
 * @param {number} k
 */
export function oversiktNyckeltal(rader, k) {
    if (!rader.length) return null;
    const aldrar = rader.map(r => r.alder).filter(a => a && !isNaN(a));
    const m = konsMedianer(rader, { k });
    return { n: rader.length, nKv: m.nKv, nMa: m.nMa,
        medelalder: aldrar.length ? aldrar.reduce((a, b) => a + b, 0) / aldrar.length : null,
        lage: !m.nKv || !m.nMa ? 'ettKonSaknas' : m.konOk ? 'ok' : 'underK', kvotPct: m.konOk ? m.kvotPct : null };
}

/** Kortets läge ur antalet och totalen: 'na' utan något att räkna, 'ok' vid noll, annars efter `kritisk`. */
const kortLage = (antal, av, kritisk) => (av === 0 ? 'na' : antal === 0 ? 'ok' : kritisk(antal, av) ? 'crit' : 'warn');

/**
 * Läget mot lagkraven, eller null utan underlag. Varje kort är { antal, av, lage } med lage 'ok', 'warn', 'crit' eller
 * 'na' (inget att räkna).
 * - `gap` och `skev`: bara BAS-intervall där båda könen når k (jamforbaraBas, det exporterna kan jämföra, ADR-51).
 *   Säkerställd skillnad är statusen Värt att granska i översikten per BAS-intervall (ADR-59; oversiktNiva med
 *   golvet), kritisk från tre intervall. Ojämn könsfördelning: ett kön under 40 % av intervallet; aldrig kritisk.
 *   `maskerade` är antalet intervall där ett kön är under k.
 * - `referens`: intervall med minst k personer och en rad med P10 i ställningstagandet, där intervallets median ligger
 *   under P10; kritisk från två. null utan ställningstagande (`policyFor` saknas).
 * - `statistik`: AID-kod i BAS-intervall med minst k personer och en rad i jämförelsestatistiken, där organisationens
 *   median ligger under statistikens; kritisk när mer än hälften ligger under. Samma grupper som Löneläget
 *   (jamforelseRader); `utelamnade` är antalet grupper med en rad men färre än k. null utan jämförelsestatistik.
 * @param {any[]} rader
 * @param {{bas:string[], k:number, golv:number, oversikt?:any[], policyFor?:((aid:any, bas:string) => any)|null,
 *   statistik?:any[]}} val
 *   oversikt: översiktens rader per BAS-intervall (oversiktPerBas) när appen redan räknat dem (bootstrap), annars räknas
 *   de här; policyFor: ställningstagandets rad för en AID-kod och ett BAS-intervall
 */
export function kravstatus(rader, { bas, k, golv, oversikt, policyFor, statistik }) {
    if (!rader.length) return null;
    const jb = jamforbaraBas(rader, k);
    const granskaBas = new Set((oversikt || oversiktPerBas(rader, jb.jamforbara, k)).filter(o => oversiktNiva(o, golv) === 'granska').map(o => o.bas));
    let gap = 0, skev = 0;
    for (const b of jb.jamforbara) {
        const df = rader.filter(r => r.bas === b);
        const nKv = df.filter(r => arKvinna(r)).length, nMa = df.filter(r => arMan(r)).length, tot = nKv + nMa;
        if (granskaBas.has(b)) gap++;
        if (nKv / tot < JAMN_KONSFORDELNING / 100 || nMa / tot < JAMN_KONSFORDELNING / 100) skev++;
    }
    const av = jb.jamforbara.length;

    /** @type {{antal:number, av:number, lage:string}|null} */ let referens = null;
    if (policyFor) {
        let under = 0, total = 0;
        for (const b of bas) {
            const pol = policyFor(null, b);
            const df = rader.filter(r => r.bas === b);
            if (!pol || !pol.p10 || df.length < k) continue;
            total++;
            if (median(df.map(r => r.lon)) < pol.p10) under++;
        }
        referens = { antal: under, av: total, lage: kortLage(under, total, a => a >= 2) };
    }

    /** @type {{antal:number, av:number, lage:string, utelamnade:number}|null} */ let stat = null;
    if (statistik && statistik.length) {
        const perGrupp = new Map();
        for (const r of rader) {
            const nyckel = `${aidAvYrke(r.yrke)}|${r.bas}`;
            if (!perGrupp.has(nyckel)) perGrupp.set(nyckel, { aid: aidAvYrke(r.yrke), bas: r.bas, lon: [] });
            perGrupp.get(nyckel).lon.push(r.lon);
        }
        let under = 0, total = 0, utelamnade = 0;
        for (const g of perGrupp.values()) {
            const rad = statistikFor(statistik, g.aid, g.bas)?.rad;
            if (!rad) continue;
            if (g.lon.length < k) { utelamnade++; continue; }
            total++;
            if (median(g.lon) < rad.median) under++;
        }
        stat = { antal: under, av: total, lage: kortLage(under, total, (a, t) => a / t > 0.5), utelamnade };
    }

    return { jamforbara: av, maskerade: jb.maskerade.length,
        gap: { antal: gap, av, lage: kortLage(gap, av, a => a >= 3) },
        skev: { antal: skev, av, lage: kortLage(skev, av, () => false) },
        referens, statistik: stat };
}

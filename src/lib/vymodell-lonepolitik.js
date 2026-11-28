// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
/**
 * Öppen lönekartläggning — vymodellen för Löneläget mot ställningstagandet (ADR-99): det som avsnitten om
 * ställningstagandet räknar och bedömer utöver modellen själv (lonepolitikModell i lonepolitik.js). Täckningsgradens
 * status, slutsatserna i toppen (yrkesgrupper vars median ligger under, inom och över spannet), bandkartans
 * BAS-intervall och punkter, könspositionen per BAS-intervall, fördelningen i spannets tredjedelar per kön,
 * efterlevnaden per BAS-intervall och tabellens rader per yrkesgrupp med maskeringstrappan. Tröskeln och
 * policyuppslaget är argument; ritfunktionerna i src/app/75-lonepolitik.js ritar bara det de får och skriver orden,
 * också bladet Lönepolitik i Excel (alla flikar).
 */
import { forskjutningISidled } from './figur.js';
import { arKvinna } from './kon.js';
import { konFarRedovisas } from './ktroskel.js';
import { lonepolitikKonstanter, lonepolitikModell } from './lonepolitik.js';
import { avrundaSymmetriskt } from './stat.js';

/** Täckningsgradens gränser: från TACKNING_OK % är den god, under TACKNING_LAG % går resultatet inte att läsa. */
export const TACKNING_OK = 90, TACKNING_LAG = 60;

/** Täckningsgradens status: 'ok' från 90 %, 'varning' från 60 %, annars 'kritisk'. Statusen bedöms på talet som
 * visas, i hela procent (svPct(pct, 0)), så att «90 %» aldrig står med en varning. */
export function tackningsstatus(pct) {
    const visad = avrundaSymmetriskt(pct);
    return visad >= TACKNING_OK ? 'ok' : visad >= TACKNING_LAG ? 'varning' : 'kritisk';
}

/**
 * Slutsatserna i toppen: yrkesgrupper med full analys (minst k) och ett läge i spannet, och hur många av dem vars
 * median ligger under (läge under 0) och över (över 1) spannet. Grupper under k har inget läge att redovisa.
 * @param {any} modell lonepolitikModell
 * @returns {{provade: number, under: number, over: number}}
 */
export function lageISpannet(modell) {
    const lage = { provade: 0, under: 0, over: 0 };
    modell.byBas.forEach(b => b.groups.forEach(g => {
        if (!g.pol || g.tier === 'masked' || g.tier === 'count' || !g.stats || g.stats.position == null) return;
        lage.provade++;
        if (g.stats.position < 0) lage.under++; else if (g.stats.position > 1) lage.over++;
    }));
    return lage;
}

/**
 * Antalet kvinnor och män i spannets lägesklasser (under, nedre, mellersta, övre tredjedelen, över) summerat över
 * BAS-intervallen med spann; `ok` när båda könen når k.
 * @param {any} modell @param {number} k
 */
export function konLagenSumma(modell, k) {
    const sum = { kv: [0, 0, 0, 0, 0], ma: [0, 0, 0, 0, 0] };
    for (const b of modell.byBas) if (b.konLagen) for (const kon of ['kv', 'ma']) b.konLagen[kon].forEach((v, i) => { sum[kon][i] += v; });
    const nKv = sum.kv.reduce((a, v) => a + v, 0), nMa = sum.ma.reduce((a, v) => a + v, 0);
    return { ...sum, nKv, nMa, ok: konFarRedovisas(nKv, nMa, k) };
}

/**
 * Bandkartans underlag: BAS-intervallen med ett användbart spann (P10 och P90 över 0) och en punkt per yrkesgrupp med
 * full analys (minst k) och spann, med medianen, andelen kvinnor i procent, antalet, referensnivån och förskjutningen
 * i sidled (forskjutningISidled: grupper i samma BAS-intervall med nästan samma median flyttas isär).
 * @param {any} modell
 */
export function bandkarta(modell) {
    const bas = modell.byBas.filter(b => b.pol && b.pol.p10 > 0 && b.pol.p90 > 0);
    const punkter = [];
    bas.forEach(b => b.groups.forEach(g => {
        if (g.tier !== 'full' || !g.stats || !g.pol) return;
        punkter.push({ bas: b.bas, aid: g.aid, yrke: g.yrke, n: g.n, median: g.stats.median, niva: g.level || '—',
            kvAndel: g.rows.filter(r => arKvinna(r)).length / g.n * 100 });
    }));
    const sidled = forskjutningISidled(punkter, { band: p => p.bas, varde: p => p.median, namn: p => p.aid });
    return { bas, punkter: punkter.map(p => ({ ...p, forskjutning: sidled.get(p) })) };
}

/**
 * Tabellens block per BAS-intervall: varje yrkesgrupp som utelämnad (under ANTAL_MIN och k, med eller utan rad i
 * ställningstagandet; namnges i en not och räknas in i intervallets rad), 'ingenPolicy', 'antal' (från ANTAL_MIN upp
 * till k: bara antalet under P10) eller 'full' (median, spann, läget i procent och 'under' eller 'over' utanför spannet).
 * @param {any} modell
 */
export function tabellblock(modell) {
    return modell.byBas.map(b => {
        const rader = [], utelamnade = [];
        for (const g of b.groups) {
            if (g.tier === 'masked') { utelamnade.push(g); continue; }   // också utan rad i ställningstagandet: inte ens antalet visas
            if (!g.pol) { rader.push({ g, typ: 'ingenPolicy' }); continue; }
            if (g.tier === 'count') { rader.push({ g, typ: 'antal' }); continue; }
            const pos = g.stats && g.stats.position != null ? g.stats.position * 100 : null;
            rader.push({ g, typ: 'full', position: pos, lage: pos == null ? null : pos < 0 ? 'under' : pos > 100 ? 'over' : null });
        }
        return { b, rader, utelamnade };
    });
}

/**
 * Vymodellen för Löneläget mot ställningstagandet.
 * - `modell`: lonepolitikModell; `tom`: inget ställningstagande. Underlaget har alltid rader när fliken ritas, och varje
 *   BAS-intervall i det har en post i `byBas`, med eller utan träff.
 * - `antalMin`: gränsen under vilken en yrkesgrupp utelämnas helt (den lägre av ANTAL_MIN och k).
 * - `tackning`: täckningsgraden i procent och dess status (tackningsstatus).
 * - `lage`: lageISpannet; `bandkarta`; `konLagen`: konLagenSumma.
 * - `konPosition`: BAS-intervallen där båda könen når k (`visade`) och de med spann där något kön inte gör det (`dolda`).
 * - `efterlevnad`: BAS-intervallen med spann som når k (`visade`), de under k (`dolda`, namnen) och om något har spann.
 * - `tabell`: tabellblock.
 * @param {any[]} rader
 * @param {{policyFor: (aid: any, bas: any) => any, nivaEtikett: (pol: any) => any, k: number, harPolicy: boolean}} val
 */
export function vymodellLonepolitik(rader, { policyFor, nivaEtikett, k, harPolicy }) {
    const modell = lonepolitikModell(rader, { policyFor, nivaEtikett, k, harPolicy });
    const medSpann = modell.byBas.filter(b => b.compliance);
    return {
        modell,
        tom: !modell.hasPolicy,
        antalMin: Math.min(lonepolitikKonstanter().ANTAL_MIN, k),
        tackning: modell.coverage ? { pct: modell.coverage.personsPct, status: tackningsstatus(modell.coverage.personsPct) } : null,
        lage: lageISpannet(modell),
        bandkarta: bandkarta(modell),
        konLagen: konLagenSumma(modell, k),
        // genderGap finns bara när båda könen når k (konsskillnadIBand med k).
        konPosition: { visade: modell.byBas.filter(b => b.genderGap), dolda: modell.byBas.filter(b => b.pol && !b.genderGap).map(b => b.bas) },
        efterlevnad: { harSpann: medSpann.length > 0, visade: medSpann.filter(b => !(b.n < k)), dolda: medSpann.filter(b => b.n < k).map(b => b.bas) },
        tabell: tabellblock(modell)
    };
}

// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
/**
 * Öppen lönekartläggning — vymodellen för Lönestrukturs avsnitt per BAS-intervall (ADR-99): *Löneskillnad per
 * BAS-intervall* (översikten med KI och status, tabellen per intervall) och *Könsfördelning per BAS-intervall*.
 * Allt som räknas, maskeras och bedöms står här, med tröskeln som argument; ritfunktionen i
 * src/app/41-lika-arbete.js (ritaLoneskillnadPerBas) ritar bara det den får. Flikens övriga delar har ännu ingen
 * vymodell.
 */
import { talformat } from './figur.js';
import { arKvinna, arMan } from './kon.js';
import { konskvotPerGrupp } from './osakerhet.js';
import { median } from './stat.js';
import { direktivMarkering, kiUtesluterLika, statusNiva } from './status.js';
import { konsMedianer } from './struktur.js';

/** Gränsen för jämn könsfördelning: båda könen minst så många procent av intervallet. */
export const JAMN_KONSFORDELNING = 40;

const kvinnorsLoner = rader => rader.filter(r => arKvinna(r)).map(r => r.lon);
const mansLoner = rader => rader.filter(r => arMan(r)).map(r => r.lon);
/** Uträkningens ingångsdata för en rad (beviset bakom raden). */
const underlag = (bas, rader) => ({ bas, rader, kvLons: kvinnorsLoner(rader), maLons: mansLoner(rader), masked: false });

/**
 * Översiktens rader: kvinnors och mäns medianlön per BAS-intervall med kvoten och dess 95-procentiga bootstrap-KI,
 * bara där båda könen når k. Kvoten, intervallet och prövningen mot k är konskvotPerGrupp i osakerhet.js.
 * @param {any[]} rader
 * @param {string[]} bas  BAS-intervallen i ordning
 * @param {number} k
 * @returns {Array<{bas:string, gap:number, n:number, ci:any, medKv:number, medMa:number, nKv:number, nMa:number}>}
 */
export function oversiktPerBas(rader, bas, k) {
    const perBas = /** @type {Record<string, any[]>} */ (Object.fromEntries(bas.map(b => [b, rader.filter(r => r.bas === b)])));
    const { visade } = konskvotPerGrupp(bas.map(b => [b, kvinnorsLoner(perBas[b]), mansLoner(perBas[b])]), { k, ki: true });
    return visade.map(v => ({ bas: v.nyckel, gap: v.gap, n: perBas[v.nyckel].length, ci: v.ci, medKv: v.medKv, medMa: v.medMa, nKv: v.nKv, nMa: v.nMa }));
}

/**
 * Statusen för en översiktsrad (uppmärksamhetstrappan, ADR-59): ett kön under golvet ger 'ejbedomd', annars prövar
 * KI:t mot 100 % och storleken.
 * @param {{gap:number, ci:any, nKv:number, nMa:number}} o
 * @param {number} golv
 */
export function oversiktNiva(o, golv) {
    if (!(o.nKv >= golv && o.nMa >= golv)) return 'ejbedomd';
    return statusNiva(Math.abs(100 - o.gap), kiUtesluterLika(o.ci));
}

/**
 * Vymodellen. Översiktens rader är dyra (bootstrap); appen räknar dem en gång per underlag och tröskel och skickar
 * dem som `oversikt`, annars räknas de här.
 * @param {any[]} rader
 * @param {{bas:string[], k:number, golv:number, litetUnderlag:number, oversikt?:any[]}} val
 *   litetUnderlag: golvet för en rad i könsfördelningen (ADR-57), oberoende av k
 */
export function vymodellLonestruktur(rader, { bas, k, golv, litetUnderlag, oversikt }) {
    const perBas = /** @type {Record<string, any[]>} */ (Object.fromEntries(bas.map(b => [b, rader.filter(r => r.bas === b)])));

    // Översikten: bara intervall där båda könen når k. De som saknas sägs under tabellen: hela intervallet under k
    // (forSma), eller ett kön under k (ettKon).
    const visade = (oversikt || oversiktPerBas(rader, bas, k)).map(o => ({ ...o, niva: oversiktNiva(o, golv),
        direktiv: direktivMarkering(o.gap), skillnadKr: Math.round(o.medKv) - Math.round(o.medMa), underlag: underlag(o.bas, perBas[o.bas]) }));
    const storst = visade.slice().sort((a, b) => Math.abs(100 - b.gap) - Math.abs(100 - a.gap))[0] || null;
    const iTabell = new Set(visade.map(o => o.bas)), forSma = /** @type {string[]} */ ([]), ettKon = /** @type {string[]} */ ([]);
    for (const b of bas) {
        const n = perBas[b].length;
        if (!iTabell.has(b) && n) (n < k ? forSma : ettKon).push(b);
    }

    // Tabellen per BAS-intervall, samma tvådelade regel som i Lika arbete: hela intervallet under k → ingen rad;
    // bara ett kön under k → intervallets samlade median, som bygger på minst k personer.
    /** @type {{rader: any[], utelamnade: string[], samlade: string[], maskerade: number}} */
    const skillnad = { rader: [], utelamnade: [], samlade: [], maskerade: 0 };
    for (const b of bas) {
        const df = perBas[b], nKv = df.filter(r => arKvinna(r)).length, nMa = df.filter(r => arMan(r)).length;
        if (nKv < 2 || nMa < 2) continue;
        if (nKv < k || nMa < k) skillnad.maskerade++;
        const m = konsMedianer(df, { k });
        if (!m.konOk && df.length < k) { skillnad.utelamnade.push(b); continue; }
        if (!m.konOk) { skillnad.samlade.push(b); skillnad.rader.push({ bas: b, nKv, nMa, samlad: true, medTot: median(df.map(r => r.lon)) }); continue; }
        const kvotPct = parseFloat(m.kvotPct.toFixed(1));
        skillnad.rader.push({ bas: b, nKv, nMa, samlad: false, kvotPct, direktiv: direktivMarkering(kvotPct), medKv: m.medKv, medMa: m.medMa, underlag: underlag(b, df) });
    }

    // Könsfördelningen: en rad från litetUnderlag personer, bara antal och andelar (ADR-57); mindre intervall namnges.
    /** @type {{rader: any[], utelamnade: string[]}} */
    const konsfordelning = { rader: [], utelamnade: [] };
    for (const b of bas) {
        const df = perBas[b], nKv = df.filter(r => arKvinna(r)).length, nMa = df.filter(r => arMan(r)).length, tot = nKv + nMa;
        if (tot < litetUnderlag) { if (tot > 0) konsfordelning.utelamnade.push(b); continue; }
        const pctKv = parseFloat((nKv / tot * 100).toFixed(1)), pctMa = parseFloat((nMa / tot * 100).toFixed(1));
        const underrepresenterat = pctKv < JAMN_KONSFORDELNING ? 'Kvinna' : pctMa < JAMN_KONSFORDELNING ? 'Man' : null;
        konsfordelning.rader.push({ bas: b, tot, nKv, nMa, pctKv, pctMa, underrepresenterat });
    }

    return {
        oversikt: { rader: visade, storst, forSma, ettKon,
            exportAnteckning: storst ? `Störst skillnad: BAS ${storst.bas}, kvinnors median ${talformat(storst.gap, 'pct')} av männens` : null },
        skillnad, konsfordelning
    };
}

// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
/**
 * Öppen lönekartläggning — Jämförelsestatistik (ADR-35).
 *
 * Per yrke (AID-kodens siffror i början av yrket) och BAS-intervall: organisationens P10, median och P90,
 * jämförelsestatistikens och ställningstagandets värden och skillnaderna. Grupper med färre än k personer
 * tas inte med. Tabellen, diagrammen och den samlade Excelexporten läser samma rader.
 *
 * Statistikens matchning (`statistikFor`) är det enda uppslaget i verktyget: samma AID och samma BAS, annars en rad
 * för samma AID som saknar BAS. En rad för ett annat BAS-intervall används aldrig.
 *
 * Webbläsarbygget får en AUTO-GENERERAD spegel i src/app/09-lib-speglar.js.
 */
import { median, quantile } from './stat.js';
import { sektorsnamn } from './aid.js';

const _pos = v => (typeof v === 'number' && v > 0 ? v : null);
const _tre = (p10, med, p90) => ({ p10: _pos(p10), median: _pos(med), p90: _pos(p90) });
const _diff = (org, ref) => (org != null && ref != null ? { kr: org - ref, pct: (org / ref - 1) * 100 } : null);
const _diffar = (org, ref) => ({ p10: _diff(org.p10, ref.p10), median: _diff(org.median, ref.median), p90: _diff(org.p90, ref.p90) });

/** AID-kodens inledande siffror, annars hela yrkessträngen. */
export function aidAvYrke(yrke) {
    const m = String(yrke ?? '').match(/^(\d+)/);
    return m ? m[1] : String(yrke ?? '');
}

/**
 * Statistikens rad för en organisationsgrupp AID×BAS: en rad med samma AID och samma BAS ('aid-bas'), annars en
 * rad med samma AID som saknar BAS ('aid'). En rad för ett annat BAS-intervall används aldrig. AID och BAS
 * jämförs som text.
 * @param {Array<{aid?:any, bas?:any}>|null|undefined} statistik
 * @param {any} aid
 * @param {any} bas
 * @returns {{rad: any, matchning: 'aid-bas'|'aid'}|null}
 */
export function statistikFor(statistik, aid, bas) {
    const a = String(aid ?? ''), b = String(bas ?? '');
    if (!a || !Array.isArray(statistik)) return null;
    const sammaAid = x => x != null && String(x.aid ?? '') === a;
    const exakt = b ? statistik.find(x => sammaAid(x) && String(x.bas ?? '') === b) : null;
    if (exakt) return { rad: exakt, matchning: 'aid-bas' };
    const utanBas = statistik.find(x => sammaAid(x) && !x.bas);
    return utanBas ? { rad: utanBas, matchning: 'aid' } : null;
}

/** Matchningsnivån i ord, samma ord som ställningstagandets nivåer; "–" utan statistik. */
export const MATCHNING_ETIKETT = { 'aid-bas': 'AID + BAS', aid: 'Endast AID' };
/** @param {string|null|undefined} matchning */
export function matchningEtikett(matchning) {
    return (matchning && MATCHNING_ETIKETT[matchning]) || '–';
}

/** Antalet rader (yrkesgrupper) per matchningsnivå. @param {Array<{statistikMatchning?:string|null}>} rader */
export function matchningAntal(rader) {
    const ut = { aidBas: 0, aid: 0, utan: 0 };
    for (const r of rader || []) {
        if (r.statistikMatchning === 'aid-bas') ut.aidBas++;
        else if (r.statistikMatchning === 'aid') ut.aid++;
        else ut.utan++;
    }
    return ut;
}

/** Sammanfattningen ovanför tabellen; tom sträng utan rader. @param {Array<{statistikMatchning?:string|null}>} rader */
export function matchningSammanfattning(rader) {
    if (!rader || !rader.length) return '';
    const { aidBas, aid, utan } = matchningAntal(rader);
    return `Statistiken: ${aidBas} ${aidBas === 1 ? 'yrkesgrupp matchad' : 'yrkesgrupper matchade'} på AID och BAS, `
        + `${aid} på endast AID, ${utan} utan statistik.`;
}

/**
 * Statistikens median per organisationsgrupp, som Löneöversyns marknadspositionering läser den: nyckeln `aid|bas`,
 * bara för grupper med en matchad rad med positiv median.
 * @param {Array<any>} statistik
 * @param {Array<{aid:any, bas:any}>} grupper
 * @returns {Map<string, number>}
 */
export function statistikMarknad(statistik, grupper) {
    const ut = new Map();
    for (const g of grupper || []) {
        const m = statistikFor(statistik, g.aid, g.bas);
        if (m && m.rad.median > 0) ut.set(String(g.aid) + '|' + String(g.bas), m.rad.median);
    }
    return ut;
}

/**
 * Medianen av statistikens matchade medianer för grupperna AID×BAS (varje grupp en gång); null utan någon träff.
 * @param {Array<any>} statistik
 * @param {Array<{aid:any, bas:any}>} grupper
 * @returns {number|null}
 */
export function statistikensMedianFor(statistik, grupper) {
    const sedda = new Set(), medianer = [];
    for (const g of grupper || []) {
        const nyckel = String(g.aid) + '|' + String(g.bas);
        if (sedda.has(nyckel)) continue;
        sedda.add(nyckel);
        const m = statistikFor(statistik, g.aid, g.bas);
        if (m && m.rad.median > 0) medianer.push(m.rad.median);
    }
    return medianer.length ? median(medianer) : null;
}

/**
 * @param {Array<{yrke:string, bas:string, lon:number, kon?:string}>} rader
 * @param {{statistik:Array, policyFor:(aid:string, bas:string)=>({p10?:number, med?:number, p90?:number}|null), k:number}} opt
 */
export function jamforelseRader(rader, { statistik = [], policyFor = () => null, k }) {
    const perAid = new Map();   // aid → Map(bas → { yrke, lons })
    for (const r of rader || []) {
        const aid = aidAvYrke(r.yrke);
        if (!perAid.has(aid)) perAid.set(aid, new Map());
        const perBas = perAid.get(aid);
        if (!perBas.has(r.bas)) perBas.set(r.bas, { yrke: r.yrke, lons: [], kvinnor: 0 });
        const g = perBas.get(r.bas);
        g.lons.push(r.lon);
        if (typeof r.kon === 'string' && r.kon.includes('kvinna')) g.kvinnor++;
    }
    const ut = [], utelamnade = [];
    for (const [aid, perBas] of perAid) {
        for (const bas of [...perBas.keys()].sort()) {
            const { yrke, lons, kvinnor } = perBas.get(bas);
            if (lons.length < k) { utelamnade.push(`${aid} (BAS ${bas})`); continue; }
            const org = _tre(quantile(lons, 0.1), median(lons), quantile(lons, 0.9));
            const traff = statistikFor(statistik, aid, bas), s = traff?.rad;
            const p = policyFor(aid, bas);
            const stat = _tre(s?.p10, s?.median, s?.p90), pol = _tre(p?.p10, p?.med, p?.p90);
            // kvAndel: andelen kvinnor i procent, för könsdominansen i Löneläget (samma räkning som bandkartan).
            ut.push({ aid, yrke, bas, sektor: sektorsnamn(aid), n: lons.length, kvAndel: kvinnor / lons.length * 100, org, statistik: stat, stallningstagande: pol,
                statistikMatchning: traff ? traff.matchning : null,
                diff: { statistik: _diffar(org, stat), stallningstagande: _diffar(org, pol) } });
        }
    }
    ut.sort((a, b) => (a.bas !== b.bas ? (a.bas < b.bas ? -1 : 1) : a.yrke < b.yrke ? -1 : a.yrke > b.yrke ? 1 : 0));
    return { rader: ut, utelamnade };
}

/** Underlaget till diagram 2: raderna med median i båda, mest negativ skillnad först. */
export function avvikelseRangordning(rader, kalla) {
    return (rader || []).filter(r => r.diff[kalla] && r.diff[kalla].median)
        .sort((a, b) => a.diff[kalla].median.pct - b.diff[kalla].median.pct);
}

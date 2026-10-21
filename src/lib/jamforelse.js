// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
/**
 * Öppen lönekartläggning — Jämförelsestatistik (ADR-35).
 *
 * Per yrke (AID-kodens siffror i början av yrket) och BAS-intervall: organisationens P10, median och P90,
 * jämförelsestatistikens och ställningstagandets värden och skillnaderna. Grupper med färre än k personer
 * tas inte med. Tabellen, diagrammen och den samlade Excelexporten läser samma rader.
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
 * @param {Array<{yrke:string, bas:string, lon:number}>} rader
 * @param {{statistik:Array, policyFor:(aid:string, bas:string)=>({p10?:number, med?:number, p90?:number}|null), k:number}} opt
 */
export function jamforelseRader(rader, { statistik = [], policyFor = () => null, k }) {
    const perAid = new Map();   // aid → Map(bas → { yrke, lons })
    for (const r of rader || []) {
        const aid = aidAvYrke(r.yrke);
        if (!perAid.has(aid)) perAid.set(aid, new Map());
        const perBas = perAid.get(aid);
        if (!perBas.has(r.bas)) perBas.set(r.bas, { yrke: r.yrke, lons: [] });
        perBas.get(r.bas).lons.push(r.lon);
    }
    const ut = [], utelamnade = [];
    for (const [aid, perBas] of perAid) {
        for (const bas of [...perBas.keys()].sort()) {
            const { yrke, lons } = perBas.get(bas);
            if (lons.length < k) { utelamnade.push(`${aid} (BAS ${bas})`); continue; }
            const org = _tre(quantile(lons, 0.1), median(lons), quantile(lons, 0.9));
            const s = statistik.find(x => x.aid === aid && x.bas === bas) || statistik.find(x => x.aid === aid && !x.bas);
            const p = policyFor(aid, bas);
            const stat = _tre(s?.p10, s?.median, s?.p90), pol = _tre(p?.p10, p?.med, p?.p90);
            ut.push({ aid, yrke, bas, sektor: sektorsnamn(aid), n: lons.length, org, statistik: stat, stallningstagande: pol,
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

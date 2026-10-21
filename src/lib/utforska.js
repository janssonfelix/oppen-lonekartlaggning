// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
/**
 * Öppen lönekartläggning — Utforska: pivot över lönerader
 *
 * Ren kärna bakom Utforska-fliken: urval (src/lib/urval.js), gruppering på en eller två
 * dimensioner, mått och k-markering. Vet ingenting om DOM, ritaren eller state.
 *
 * DÖLJER INGENTING. Små grupper (n < k) räknas och markeras med `liten`, och
 * grupper där ena könet är under k med `konLiten`. Vyn tonar dem och exporten
 * utelämnar dem som standard (ADR-14). Regeln bor här, på ett ställe.
 *
 * Webbläsarbygget får en AUTO-GENERERAD spegel i src/app/09-lib-speglar.js
 * (tools/gen-mirrors.mjs). Ändra här och kör `npm run build:app`.
 */
import { median, quantile } from './stat.js';
import { groupKey, konOf, jamforAldersgrupp, jamforLonespann } from './falt.js';
import { jamforSektor, mellannivaEtikett, huvudomrade } from './aid.js';
import { personFilter, uppfyllerGrupp, gruppVillkorAktivt } from './urval.js';

export const DIMENSIONER = ['bas', 'aid', 'alder', 'kon', 'alla', 'aidbas', 'lonespann', 'sektor', 'aidniva'];
export const MATT = ['median', 'medel', 'n', 'p10', 'p25', 'p75', 'p90', 'spridning', 'andelKv', 'gap'];
// Mått som inte går att dela upp per kön (de ÄR en jämförelse mellan könen).
const UTAN_KONSUPPDELNING = new Set(['andelKv', 'gap']);

function _hink() { return { lons: [], kv: [], ma: [] }; }
function _lagg(h, r) {
    h.lons.push(r.lon);
    const k = konOf(r);
    if (k === 'Kvinna') h.kv.push(r.lon);
    else if (k === 'Man') h.ma.push(r.lon);
}
// Mått på en lönelista. Används både för gruppen och för varje kön.
function _matt(lons, matt) {
    if (!lons.length) return null;
    switch (matt) {
        case 'n': return lons.length;
        case 'medel': return lons.reduce((s, v) => s + v, 0) / lons.length;
        case 'p10': return quantile(lons, 0.10);
        case 'p25': return quantile(lons, 0.25);
        case 'p75': return quantile(lons, 0.75);
        case 'p90': return quantile(lons, 0.90);
        case 'spridning': {
            const p10 = quantile(lons, 0.10);
            return p10 > 0 ? quantile(lons, 0.90) / p10 : null;
        }
        default: return median(lons);
    }
}
function _varde(h, matt) {
    if (matt === 'andelKv') {
        const t = h.kv.length + h.ma.length;
        return t ? (h.kv.length / t) * 100 : null;
    }
    if (matt === 'gap') {
        if (!h.kv.length || !h.ma.length) return null;
        const mm = median(h.ma);
        return mm > 0 ? (median(h.kv) / mm) * 100 : null;
    }
    return _matt(h.lons, matt);
}
function _sortera(dim, etiketter, varden, matt) {
    if (dim === 'bas') return etiketter.sort((a, b) => a.localeCompare(b, 'sv'));
    if (dim === 'alder') return etiketter.sort(jamforAldersgrupp);
    if (dim === 'lonespann') return etiketter.sort(jamforLonespann);
    if (dim === 'sektor') return etiketter.sort(jamforSektor);
    if (dim === 'aidniva') return etiketter.sort((a, b) => (a.startsWith('AID ') ? 0 : 1) - (b.startsWith('AID ') ? 0 : 1) || a.localeCompare(b, 'sv'));   // okänd kod sist
    const v = l => varden.get(l);
    if (matt === 'gap') return etiketter.sort((a, b) => (v(a) ?? Infinity) - (v(b) ?? Infinity));
    return etiketter.sort((a, b) => (v(b) ?? -Infinity) - (v(a) ?? -Infinity));
}

/**
 * Hopslagning av små AID-grupper (bara i Utforska, ADR-33): grupper under k slås
 * ihop per AID-mellannivå; räcker inte summan, per sektor. Grupper som fortfarande är under k
 * behåller sin nyckel (och visas som små). Nyckel = groupKey(r, 'aid').
 * @returns {Map<string, string>} aid-nyckel → ersättningsnyckel ("Övriga i AID 2070xx (2 yrken)")
 */
export function slaIhopSmaAid(rows, k) {
    const n = new Map(), aidAv = new Map();
    for (const r of rows || []) {
        const key = groupKey(r, 'aid');
        n.set(key, (n.get(key) || 0) + 1);
        aidAv.set(key, r.aid);
    }
    const sma = [...n.keys()].filter(key => n.get(key) < k);
    const ut = new Map();
    const slaIhop = nivaAv => {
        const grupper = new Map();
        for (const key of sma.filter(x => !ut.has(x))) {
            const niva = nivaAv(aidAv.get(key));
            if (!niva) continue;
            if (!grupper.has(niva)) grupper.set(niva, []);
            grupper.get(niva).push(key);
        }
        for (const [niva, keys] of grupper) {
            if (keys.length < 2) continue;
            if (keys.reduce((s, key) => s + n.get(key), 0) < k) continue;
            const namn = `Övriga i ${niva} (${keys.length} yrken)`;
            keys.forEach(key => ut.set(key, namn));
        }
    };
    slaIhop(aid => mellannivaEtikett(aid));
    slaIhop(aid => huvudomrade(aid)?.namn ?? null);   // okänd sektor slås inte ihop
    return ut;
}

/**
 * Pivot över lönerader.
 * @param {any[]} rows - lönerader ({ bas, aid, yrke, yrkeLabel, lon, alder, kon })
 * @param {{rad:string, kolumn?:string|null, matt?:string, delaKon?:boolean, urval?:any, gruppVillkor?:any[], slaIhop?:boolean}} spec
 * @param {{k?:number}} [opts]
 */
export function computePivot(rows, spec, { k = 10 } = {}) {
    const rad = spec.rad;
    const kol = spec.kolumn && spec.kolumn !== rad ? spec.kolumn : null;
    const matt = spec.matt && MATT.includes(spec.matt) ? spec.matt : 'median';
    const delaKon = !!spec.delaKon && rad !== 'kon' && kol !== 'kon' && !UTAN_KONSUPPDELNING.has(matt);
    const urvalSpec = spec.urval || { lage: 'alla', villkor: [] };
    const gruppVillkor = spec.gruppVillkor || [];
    const aktivaGrupp = gruppVillkor.filter(g => gruppVillkorAktivt(g) && MATT.includes(g.matt));
    const person = personFilter(urvalSpec);

    const urvalRader = (rows || []).filter(r => r.lon > 0 && person(r));
    // Hopslagning av små AID-grupper, bara när raderna är AID (ADR-33).
    const ersatt = spec.slaIhop && rad === 'aid' ? slaIhopSmaAid(urvalRader, k) : null;
    const urval = { n: urvalRader.length, nKv: 0, nMa: 0 };
    const cellHinkar = new Map(), radHinkar = new Map(), kolHinkar = new Map();
    for (const r of urvalRader) {
        const ko = konOf(r);
        if (ko === 'Kvinna') urval.nKv++;
        else if (ko === 'Man') urval.nMa++;
        const rk0 = groupKey(r, rad);
        const rk = ersatt && ersatt.has(rk0) ? ersatt.get(rk0) : rk0;
        if (rk == null) continue;
        let kk = null;
        if (kol) {
            kk = groupKey(r, kol);
            if (kk == null) continue;
        }
        const nyckel = kol ? rk + '\u0000' + kk : rk;
        if (!cellHinkar.has(nyckel)) cellHinkar.set(nyckel, { rad: rk, kol: kk, h: _hink() });
        _lagg(cellHinkar.get(nyckel).h, r);
        if (kol) {
            if (!radHinkar.has(rk)) radHinkar.set(rk, _hink());
            _lagg(radHinkar.get(rk), r);
            if (!kolHinkar.has(kk)) kolHinkar.set(kk, _hink());
            _lagg(kolHinkar.get(kk), r);
        }
    }

    // Gruppvillkor prövas per cell, på cellens egna löner.
    let dolda = 0;
    const kvar = [...cellHinkar.values()].filter(({ h }) => {
        if (!aktivaGrupp.length) return true;
        // Gap räknat på ett kön under k får inte avgöra om gruppen visas — då
        // skulle gruppens närvaro i exporten röja det (ADR-12/14).
        const varden = Object.fromEntries(aktivaGrupp.map(g => [g.matt,
            (g.matt === 'gap' && (h.kv.length < k || h.ma.length < k)) ? null : _varde(h, g.matt)]));
        if (uppfyllerGrupp(varden, aktivaGrupp)) return true;
        dolda++;
        return false;
    });
    const celler = kvar.map(({ rad: rk, kol: kk, h }) => ({
        rad: rk, kol: kk,
        n: h.lons.length, nKv: h.kv.length, nMa: h.ma.length,
        value: _varde(h, matt),
        valueKv: delaKon ? _matt(h.kv, matt) : null,
        valueMa: delaKon ? _matt(h.ma, matt) : null,
        liten: h.lons.length < k,
        konLiten: h.kv.length < k || h.ma.length < k
    }));

    /** @type {string[]} */ let radEtiketter;
    /** @type {string[]|null} */ let kolumnEtiketter = null;
    if (kol) {
        const totalvarden = hinkar => new Map([...hinkar].map(([l, h]) => [l, _varde(h, matt)]));
        const radMed = new Set(celler.map(c => c.rad)), kolMed = new Set(celler.map(c => c.kol));
        radEtiketter = _sortera(rad, [...radHinkar.keys()].filter(l => radMed.has(l)), totalvarden(radHinkar), matt);
        kolumnEtiketter = _sortera(kol, [...kolHinkar.keys()].filter(l => kolMed.has(l)), totalvarden(kolHinkar), matt);
    } else {
        radEtiketter = _sortera(rad, celler.map(c => c.rad), new Map(celler.map(c => [c.rad, c.value])), matt);
    }
    const ri = new Map(radEtiketter.map((l, i) => [l, i]));
    const ki = kol && kolumnEtiketter ? new Map(kolumnEtiketter.map((l, i) => [l, i])) : null;
    celler.sort((a, b) => ((ri.get(a.rad) ?? 0) - (ri.get(b.rad) ?? 0)) || (ki ? (ki.get(a.kol) ?? 0) - (ki.get(b.kol) ?? 0) : 0));

    return { spec: { rad, kolumn: kol, matt, delaKon, urval: urvalSpec, gruppVillkor, slaIhop: !!ersatt },
             radEtiketter, kolumnEtiketter, celler, urval, dolda };
}

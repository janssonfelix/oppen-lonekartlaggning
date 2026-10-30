// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
/**
 * Öppen lönekartläggning — organisationens löner mot båda referenserna (ADR-55).
 *
 * Ställningstagandet är referenspunkten: löneläget och jämförelsestatistiken mäts mot det, aldrig tvärtom.
 * Modulen bygger på raderna ur jamforelse.js (organisationens P10, median och P90 per yrke och BAS mot båda
 * referenserna) och räknar läget i spannet, mönstret, förslaget på referens och överblickens tal. Grupper under
 * minsta gruppstorlek är redan borta ur raderna; modulen vet inget om tröskeln. Förslaget är ett förslag, ingen
 * regel som verktyget tillämpar någon annanstans.
 *
 * Webbläsarbygget får en AUTO-GENERERAD spegel i src/app/09-lib-speglar.js.
 */
import { bandPosition } from './lonepolitik.js';

const _NAMN = { stallningstagande: 'ställningstagandet', statistik: 'statistiken' };
const _inom = pos => pos >= 0 && pos <= 100;
const _riktning = (pos, under, over) => (pos == null ? null : pos < 0 ? under : pos > 100 ? over : 'inom');
const _pos = (median, ref) => {
    const p = bandPosition(median, ref?.p10, ref?.p90);
    return p == null ? null : p * 100;
};
const _skillnad = (varde, ref) => (varde != null && ref != null ? (varde / ref - 1) * 100 : null);

/**
 * Var en median ligger mot en referens P10–P90: 0 = P10, 100 = P90, utanför spannet under 0 och över 100.
 * @param {number|null} median
 * @param {{p10?:number|null, p90?:number|null}} ref
 */
export function lageISpann(median, ref) {
    const pos = _pos(median, ref);
    if (pos == null) return { pos: null, ord: '' };
    const ord = pos < 0 ? 'nedanför' : pos < 33 ? 'i nedre delen' : pos < 67 ? 'mitt i' : pos <= 100 ? 'i övre delen' : 'ovanför';
    return { pos, ord };
}

/** Löneläget och statistiken mot ställningstagandet, i ord. Statistiken räknas på sin median, så bara median räcker. */
export function monster(rad) {
    const p = rad.stallningstagande;
    const lonelage = _riktning(_pos(rad.org?.median, p), 'nedanför', 'ovanför');
    const statistik = _riktning(_pos(rad.statistik?.median, p), 'under', 'över');
    if (lonelage == null && statistik == null) {
        const motStatistik = _riktning(_pos(rad.org?.median, rad.statistik), 'nedanför', 'ovanför');
        return { lonelage, statistik, text: motStatistik ? `ställningstagande saknas; löneläget ${motStatistik} statistiken` : '' };
    }
    const delar = [];
    if (lonelage) delar.push(`löneläget ${lonelage} ställningstagandet`);
    if (statistik) {
        const samma = (lonelage === 'ovanför' && statistik === 'över') || (lonelage === 'nedanför' && statistik === 'under') || (lonelage === 'inom' && statistik === 'inom');
        delar.push(`statistiken ${samma ? 'också ' : ''}${statistik}`);
    }
    return { lonelage, statistik, text: delar.join(', ') };
}

// Avståndet i kronor från medianen till spannets närmaste kant.
const _avstand = (median, ref) => Math.max(ref.p10 - median, median - ref.p90, 0);
const _lageOrd = (median, nyckel, ref) => {
    const r = _riktning(_pos(median, ref), 'nedanför', 'ovanför');
    return r && (r === 'inom' ? `löneläget ligger inom ${_NAMN[nyckel]}` : `löneläget ligger ${r} ${_NAMN[nyckel]}`);
};

/**
 * Förslag på referens: den gruppen ligger inom, ställningstagandet om gruppen ligger inom båda, annars den vars
 * spann ligger närmast. Bara spann kan jämföras: en referens med bara median föreslås när ingen annan finns.
 */
export function forslag(rad) {
    const median = rad.org?.median;
    const finns = ['stallningstagande', 'statistik'].filter(k => rad[k]?.median != null);
    if (!finns.length) return { referens: null, skal: '' };
    const medSpann = finns.filter(k => _pos(median, rad[k]) != null);
    const skal = k => _lageOrd(median, k, rad[k]) || `bara ${_NAMN[k]} finns`;
    if (medSpann.length < 2) {
        const k = medSpann[0] || finns[0];
        return { referens: k, skal: skal(k) };
    }
    const inom = medSpann.filter(k => _inom(_pos(median, rad[k])));
    if (inom.length === 1) return { referens: inom[0], skal: medSpann.map(skal).join('; ') };
    if (inom.length === 2) return { referens: 'stallningstagande', skal: 'löneläget ligger inom båda' };
    const [narmast] = [...medSpann].sort((a, b) => _avstand(median, rad[a]) - _avstand(median, rad[b]));
    return { referens: narmast, skal: skal(narmast) };
}

function _vagd(grupper, nyckel) {
    let summa = 0, n = 0;
    for (const g of grupper) {
        const pct = _skillnad(g.org?.median, g[nyckel]?.median);
        if (pct == null) continue;
        summa += g.n * pct; n += g.n;
    }
    return n ? summa / n : null;
}

const _utanforMitten = g => {
    const pos = g.lage.stallningstagande.pos;
    return pos == null || _inom(pos) ? -1 : Math.abs(pos - 50);
};

/**
 * @param {Array<any>} rader raderna ur jamforelseRader
 * @param {{harStatistik?:boolean, harStallningstagande?:boolean, statistikHarSpann?:boolean}} opt
 */
export function referensOverblick(rader, { harStatistik = true, harStallningstagande = true, statistikHarSpann = true } = {}) {
    const tom = { p10: null, median: null, p90: null };
    const grupper = (rader || []).map(r => {
        const rad = { ...r, statistik: harStatistik ? r.statistik : tom, stallningstagande: harStallningstagande ? r.stallningstagande : tom };
        const spann = statistikHarSpann ? rad.statistik : { ...rad.statistik, p10: null, p90: null };
        const bedomd = { ...rad, statistik: spann };
        return { ...rad, lage: { stallningstagande: lageISpann(rad.org?.median, rad.stallningstagande), statistik: lageISpann(rad.org?.median, spann) },
            monster: monster(bedomd), forslag: forslag(bedomd) };
    }).sort((a, b) => _utanforMitten(b) - _utanforMitten(a) || (a.yrke < b.yrke ? -1 : a.yrke > b.yrke ? 1 : 0));

    const motPolicy = grupper.filter(g => g.monster.lonelage != null);
    const personer = motPolicy.reduce((s, g) => s + g.n, 0);
    const tal = villkor => {
        const urval = motPolicy.filter(g => g.monster.statistik != null && villkor(g.monster));
        const antal = urval.reduce((s, g) => s + g.n, 0);
        return { grupper: urval.length, personer: antal, andel: personer ? 100 * antal / personer : 0 };
    };
    const statistikMotStallningstagande = grupper
        .filter(g => g.statistik.median != null && g.stallningstagande.median != null)
        .map(g => ({ yrke: g.yrke, bas: g.bas, aid: g.aid,
            p10: _skillnad(g.statistik.p10, g.stallningstagande.p10),
            median: _skillnad(g.statistik.median, g.stallningstagande.median),
            p90: _skillnad(g.statistik.p90, g.stallningstagande.p90) }))
        .sort((a, b) => /** @type {number} */ (b.median) - /** @type {number} */ (a.median));
    return { grupper,
        tal: { antalGrupper: grupper.length,
            perMonster: {
                badaOver: tal(m => m.lonelage === 'ovanför' && m.statistik === 'över'),
                baraLonelageOver: tal(m => m.lonelage === 'ovanför' && m.statistik !== 'över'),
                baraStatistikOver: tal(m => m.lonelage !== 'ovanför' && m.statistik === 'över'),
                badaInom: tal(m => m.lonelage === 'inom' && m.statistik === 'inom')
            },
            forslagStatistik: grupper.filter(g => g.forslag.referens === 'statistik').length,
            vagdMedianMotStallningstagandePct: _vagd(grupper, 'stallningstagande'),
            vagdMedianMotStatistikPct: _vagd(grupper, 'statistik') },
        statistikMotStallningstagande };
}

/** Bildens rader i listans ordning: de tre spannen per yrkesgrupp, null för en referens utan median. */
export function hantelRader(grupper) {
    const ref = v => (v?.median != null ? { p10: v.p10, median: v.median, p90: v.p90 } : null);
    return (grupper || []).map(g => ({ namn: `${g.yrke} · BAS ${g.bas}`, stallningstagande: ref(g.stallningstagande), statistik: ref(g.statistik), org: g.org }));
}

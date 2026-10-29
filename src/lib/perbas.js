// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
/**
 * Öppen lönekartläggning — tabellerna per BAS-intervall, i den form en skriven lönekartläggning brukar ha.
 *
 * Tre tabeller, byggda efter arbetsgivarnas egna utkast:
 *  1. Per BAS-intervall: referensen (ställningstagandet), organisationen, varje yrkesgrupp med jämförelse-
 *     statistikens rad under, och sist kvinnor och män — P10, median, P90 och antal.
 *  2. Löneskillnader inom likvärdigt arbete: per BAS medellön för alla, män och kvinnor, kvinnors
 *     medellön i procent av mäns, andel kvinnor och medelålder.
 *  3. Löneskillnader i åldersgrupper: per BAS medellön i tre åldersgrupper.
 *
 * Minsta gruppstorlek (k) tillämpas här: en yrkesgrupp, ett BAS-intervall eller en åldersgrupp med färre än
 * k personer får ingen lönerad, och könsuppdelade mått visas bara när båda könen når k. De utelämnade
 * räknas upp så att rapporten säger vad den inte redovisar.
 *
 * Webbläsarbygget får en AUTO-GENERERAD spegel i src/app/09-lib-speglar.js.
 */
import { median, quantile } from './stat.js';

const _arKv = r => String(r.kon || '').includes('kvinna');
const _arMa = r => r.kon === 'man' || r.kon === 'män';
const _medel = arr => (arr.length ? arr.reduce((s, x) => s + x, 0) / arr.length : null);
const _loner = rader => rader.map(r => r.lon).filter(x => typeof x === 'number' && isFinite(x) && x > 0);
const _aldrar = rader => rader.map(r => r.alder).filter(x => typeof x === 'number' && isFinite(x) && x > 0);
const _matt = rader => { const l = _loner(rader); return l.length ? { n: rader.length, p10: quantile(l, 0.1), med: median(l), p90: quantile(l, 0.9) } : null; };

/** Yrkesgruppens namn: AID-koden och etiketten. */
export function yrkesnamn(r) {
    const aid = r.aid != null ? String(r.aid).trim() : '';
    const etikett = r.yrkeLabel ? String(r.yrkeLabel).trim() : '';
    if (aid && etikett && etikett !== aid) return `${aid} ${etikett}`;
    return aid || etikett || String(r.yrke || '').trim() || '(okänt yrke)';
}

/**
 * Åldersgrupperna ur gränserna: [35, 50] → ['–34', '35–49', '50–'].
 * @param {number[]} granser
 */
export function aldersgruppNamn(granser) {
    const g = [...granser].sort((a, b) => a - b);
    const ut = [`–${g[0] - 1}`];
    for (let i = 0; i < g.length - 1; i++) ut.push(`${g[i]}–${g[i + 1] - 1}`);
    ut.push(`${g[g.length - 1]}–`);
    return ut;
}
const _aldersgrupp = (alder, granser) => { let i = 0; while (i < granser.length && alder >= granser[i]) i++; return i; };

/**
 * @param {Array<{bas:string, aid?:string, yrke?:string, yrkeLabel?:string, kon:string, lon:number, alder?:number}>} rader
 * @param {{k?: number, referens?: ((aid: string|null, bas: string) => ({p10?:number, med?:number, p90?:number}|null))|null,
 *          statistik?: Array<{aid:string, bas?:string, median:number, p10?:number, p90?:number}>|null,
 *          referensNamn?: string, statistikNamn?: string, aldersgranser?: number[]}} [opt]
 */
export function perBasTabeller(rader, opt = {}) {
    const k = opt.k ?? 10;
    const referens = typeof opt.referens === 'function' ? opt.referens : () => null;
    const statistik = Array.isArray(opt.statistik) ? opt.statistik : [];
    const referensNamn = opt.referensNamn || 'Referens';
    const statistikNamn = opt.statistikNamn || 'Jämförelsestatistik';
    const granser = (opt.aldersgranser && opt.aldersgranser.length ? opt.aldersgranser : [35, 50]).slice().sort((a, b) => a - b);
    const d = (rader || []).filter(r => r && r.bas);
    const basar = [...new Set(d.map(r => String(r.bas)))].sort((a, b) => a.localeCompare(b, 'sv'));
    const statFor = (aid, bas) => statistik.find(s => String(s.aid) === String(aid) && String(s.bas || '') === String(bas))
        || statistik.find(s => String(s.aid) === String(aid) && !s.bas) || null;

    const intervall = [];
    const basUtelamnade = [];
    for (const bas of basar) {
        const df = d.filter(r => String(r.bas) === bas);
        if (df.length < k) { basUtelamnade.push(bas); continue; }
        const rad = [];
        const utelamnade = [];
        const ref = referens(null, bas);
        if (ref && (ref.p10 != null || ref.med != null || ref.p90 != null)) rad.push({ typ: 'referens', namn: referensNamn, n: null, p10: ref.p10 ?? null, med: ref.med ?? null, p90: ref.p90 ?? null });
        const org = _matt(df);
        if (org) rad.push({ typ: 'organisation', namn: 'Organisationen', ...org });
        // Yrkesgrupperna, största först; under varje yrke dess rad i jämförelsestatistiken.
        const perYrke = new Map();
        df.forEach(r => { const key = String(r.aid ?? r.yrke ?? ''); if (!perYrke.has(key)) perYrke.set(key, []); perYrke.get(key).push(r); });
        const yrken = [...perYrke.entries()].sort((a, b) => b[1].length - a[1].length || yrkesnamn(a[1][0]).localeCompare(yrkesnamn(b[1][0]), 'sv'));
        for (const [key, rows] of yrken) {
            const namn = yrkesnamn(rows[0]);
            if (rows.length < k) { utelamnade.push(namn); continue; }
            const m = _matt(rows);
            if (!m) continue;
            rad.push({ typ: 'yrke', namn, aid: key, ...m });
            const s = rows[0].aid != null ? statFor(rows[0].aid, bas) : null;
            if (s && s.median > 0) rad.push({ typ: 'statistik', namn: `${statistikNamn}: ${namn}`, aid: key, n: null, p10: s.p10 ?? null, med: s.median, p90: s.p90 ?? null });
        }
        const kv = df.filter(_arKv), ma = df.filter(_arMa);
        const konVisas = kv.length >= k && ma.length >= k;
        if (konVisas) {
            const mk = _matt(kv), mm = _matt(ma);
            if (mk) rad.push({ typ: 'kvinnor', namn: 'Kvinnor', ...mk });
            if (mm) rad.push({ typ: 'man', namn: 'Män', ...mm });
        }
        intervall.push({ bas, n: df.length, nKv: kv.length, nMa: ma.length, rader: rad, utelamnade, konVisas, antalYrken: perYrke.size });
    }

    // Könsgap och ålder per BAS, med raden Alla först.
    const konsgapRad = (namn, rows) => {
        const kv = rows.filter(_arKv), ma = rows.filter(_arMa);
        const konVisas = kv.length >= k && ma.length >= k;
        const medel = _medel(_loner(rows)), medelKv = konVisas ? _medel(_loner(kv)) : null, medelMa = konVisas ? _medel(_loner(ma)) : null;
        return {
            bas: namn, n: rows.length, medel, medelMa, medelKv,
            kvot: konVisas && medelMa != null && medelMa > 0 && medelKv != null ? medelKv / medelMa * 100 : null,
            andelKv: rows.length ? kv.length / rows.length * 100 : null,
            alder: _medel(_aldrar(rows)), alderMa: konVisas ? _medel(_aldrar(ma)) : null, alderKv: konVisas ? _medel(_aldrar(kv)) : null,
            konVisas
        };
    };
    const visadeBas = basar.filter(b => !basUtelamnade.includes(b));
    const konsgap = { rader: [konsgapRad('Alla', d), ...visadeBas.map(b => konsgapRad(b, d.filter(r => String(r.bas) === b)))] };

    const grupper = aldersgruppNamn(granser);
    const aldersRad = (namn, rows) => {
        /** @type {any[][]} */
        const per = grupper.map(() => []);
        rows.forEach(r => { if (typeof r.alder === 'number' && isFinite(r.alder) && r.alder > 0) per[_aldersgrupp(r.alder, granser)].push(r); });
        return { bas: namn, n: rows.length, alder: _medel(_aldrar(rows)), medel: _medel(_loner(rows)),
            perGrupp: per.map(g => (g.length >= k ? _medel(_loner(g)) : null)), antalPerGrupp: per.map(g => g.length) };
    };
    const aldersgrupper = { grupper, rader: [aldersRad('Alla', d), ...visadeBas.map(b => aldersRad(b, d.filter(r => String(r.bas) === b)))] };

    return { k, intervall, basUtelamnade, konsgap, aldersgrupper };
}

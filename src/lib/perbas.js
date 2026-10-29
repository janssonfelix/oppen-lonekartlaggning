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
import { sektorsnamn } from './aid.js';

// ---- Receptet (ADR-52): vad avsnittet ska innehålla. Standardvärdet är tabellerna som de står i arbetsgivarnas utkast. ----
export const PERBAS_DIMENSIONER = ['bas', 'sektor'];
export const PERBAS_MATT = ['p10', 'p25', 'med', 'p75', 'p90', 'medel'];
export const PERBAS_MATT_ETIKETT = Object.freeze({ p10: 'P10', p25: 'P25', med: 'Median', p75: 'P75', p90: 'P90', medel: 'Medellön' });
export const PERBAS_RADER = ['referens', 'organisation', 'yrken', 'statistik', 'kvinnor', 'man'];
export const PERBAS_RAD_ETIKETT = Object.freeze({ referens: 'Referensen (ställningstagandet)', organisation: 'Organisationen', yrken: 'Yrkesgrupperna',
    statistik: 'Jämförelsestatistikens rad under varje yrke', kvinnor: 'Kvinnor', man: 'Män' });
export function perBasStandard() {
    return { dim: 'bas', rader: [...PERBAS_RADER], matt: ['p10', 'med', 'p90'], konsgap: true, aldersgrupper: true, aldersgranser: [35, 50] };
}
/** Receptet i giltig form; okända värden faller tillbaka på standard. Null in ger standardreceptet. */
export function valideraPerBasRecept(r) {
    const std = perBasStandard();
    if (!r || typeof r !== 'object') return std;
    const granser = Array.isArray(r.aldersgranser) ? [...new Set(r.aldersgranser.map(Number).filter(x => Number.isInteger(x) && x > 16 && x < 80))].sort((a, b) => a - b) : [];
    const matt = Array.isArray(r.matt) ? PERBAS_MATT.filter(m => r.matt.includes(m)) : [];
    return {
        dim: PERBAS_DIMENSIONER.includes(r.dim) ? r.dim : 'bas',
        rader: Array.isArray(r.rader) ? PERBAS_RADER.filter(x => r.rader.includes(x)) : std.rader,
        matt: matt.length ? matt : std.matt,
        konsgap: r.konsgap !== false, aldersgrupper: r.aldersgrupper !== false,
        aldersgranser: granser.length ? granser : std.aldersgranser
    };
}
export function perBasReceptArStandard(r) { return JSON.stringify(valideraPerBasRecept(r)) === JSON.stringify(perBasStandard()); }

const _arKv = r => String(r.kon || '').includes('kvinna');
const _arMa = r => r.kon === 'man' || r.kon === 'män';
const _medel = arr => (arr.length ? arr.reduce((s, x) => s + x, 0) / arr.length : null);
const _loner = rader => rader.map(r => r.lon).filter(x => typeof x === 'number' && isFinite(x) && x > 0);
const _aldrar = rader => rader.map(r => r.alder).filter(x => typeof x === 'number' && isFinite(x) && x > 0);
const _matt = rader => { const l = _loner(rader); return l.length ? { n: rader.length, p10: quantile(l, 0.1), p25: quantile(l, 0.25), med: median(l), p75: quantile(l, 0.75), p90: quantile(l, 0.9), medel: _medel(l) } : null; };

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
 *          referensNamn?: string, statistikNamn?: string, aldersgranser?: number[], recept?: any}} [opt]
 *   `recept` (ADR-52): dimensionen som upprepas ('bas' eller 'sektor'), vilka rader och mått, och om summeringstabellerna
 *   ska med; utelämnat ger standardreceptet. Med sektor som dimension finns ingen referensrad (ställningstagandet
 *   gäller BAS-intervall).
 */
export function perBasTabeller(rader, opt = {}) {
    const k = opt.k ?? 10;
    const recept = valideraPerBasRecept(opt.recept);
    const visa = new Set(recept.rader);
    const dimAv = recept.dim === 'sektor' ? (r => sektorsnamn(r.aid) || '') : (r => String(r.bas ?? ''));
    const referens = typeof opt.referens === 'function' ? opt.referens : () => null;
    const statistik = Array.isArray(opt.statistik) ? opt.statistik : [];
    const referensNamn = opt.referensNamn || 'Referens';
    const statistikNamn = opt.statistikNamn || 'Jämförelsestatistik';
    const granser = (opt.aldersgranser && opt.aldersgranser.length ? opt.aldersgranser : recept.aldersgranser).slice().sort((a, b) => a - b);
    const d = (rader || []).filter(r => r && r.bas && dimAv(r));
    const basar = [...new Set(d.map(dimAv))].sort((a, b) => a.localeCompare(b, 'sv'));
    const statFor = (aid, bas) => statistik.find(s => String(s.aid) === String(aid) && String(s.bas || '') === String(bas))
        || statistik.find(s => String(s.aid) === String(aid) && !s.bas) || null;

    const intervall = [];
    const basUtelamnade = [];
    for (const bas of basar) {
        const df = d.filter(r => dimAv(r) === bas);
        if (df.length < k) { basUtelamnade.push(bas); continue; }
        const rad = [];
        const utelamnade = [];
        const ref = recept.dim === 'bas' && visa.has('referens') ? referens(null, bas) : null;
        if (ref && (ref.p10 != null || ref.med != null || ref.p90 != null)) rad.push({ typ: 'referens', namn: referensNamn, n: null, p10: ref.p10 ?? null, med: ref.med ?? null, p90: ref.p90 ?? null });
        const org = visa.has('organisation') ? _matt(df) : null;
        if (org) rad.push({ typ: 'organisation', namn: 'Organisationen', ...org });
        // Yrkesgrupperna, största först; under varje yrke dess rad i jämförelsestatistiken.
        const perYrke = new Map();
        df.forEach(r => { const key = String(r.aid ?? r.yrke ?? ''); if (!perYrke.has(key)) perYrke.set(key, []); perYrke.get(key).push(r); });
        const yrken = [...perYrke.entries()].sort((a, b) => b[1].length - a[1].length || yrkesnamn(a[1][0]).localeCompare(yrkesnamn(b[1][0]), 'sv'));
        for (const [key, rows] of yrken) {
            if (!visa.has('yrken')) break;
            const namn = yrkesnamn(rows[0]);
            if (rows.length < k) { utelamnade.push(namn); continue; }
            const m = _matt(rows);
            if (!m) continue;
            rad.push({ typ: 'yrke', namn, aid: key, ...m });
            const s = visa.has('statistik') && rows[0].aid != null && recept.dim === 'bas' ? statFor(rows[0].aid, bas) : null;
            if (s && s.median > 0) rad.push({ typ: 'statistik', namn: `${statistikNamn}: ${namn}`, aid: key, n: null, p10: s.p10 ?? null, med: s.median, p90: s.p90 ?? null });
        }
        const kv = df.filter(_arKv), ma = df.filter(_arMa);
        const konVisas = kv.length >= k && ma.length >= k;
        if (konVisas) {
            const mk = visa.has('kvinnor') ? _matt(kv) : null, mm = visa.has('man') ? _matt(ma) : null;
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
    const konsgap = { rader: [konsgapRad('Alla', d), ...visadeBas.map(b => konsgapRad(b, d.filter(r => dimAv(r) === b)))] };

    const grupper = aldersgruppNamn(granser);
    const aldersRad = (namn, rows) => {
        /** @type {any[][]} */
        const per = grupper.map(() => []);
        rows.forEach(r => { if (typeof r.alder === 'number' && isFinite(r.alder) && r.alder > 0) per[_aldersgrupp(r.alder, granser)].push(r); });
        return { bas: namn, n: rows.length, alder: _medel(_aldrar(rows)), medel: _medel(_loner(rows)),
            perGrupp: per.map(g => (g.length >= k ? _medel(_loner(g)) : null)), antalPerGrupp: per.map(g => g.length) };
    };
    const aldersgrupper = { grupper, rader: [aldersRad('Alla', d), ...visadeBas.map(b => aldersRad(b, d.filter(r => dimAv(r) === b)))] };

    return { k, recept, dim: recept.dim, dimEtikett: recept.dim === 'sektor' ? 'Sektor' : 'BAS-intervall', intervall, basUtelamnade,
             konsgap: recept.konsgap ? konsgap : null, aldersgrupper: recept.aldersgrupper ? aldersgrupper : null };
}

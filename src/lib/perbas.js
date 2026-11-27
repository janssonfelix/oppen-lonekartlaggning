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
 * räknas upp så att rapporten säger vad den inte redovisar. Raden Alla och organisationens rad räknas på hela
 * underlaget, så att en utelämnad grupps medellön inte ska gå att räkna fram som en differens undertrycks vid behov
 * också medelvärdena för en visad grupp (kompletterande undertryckning, ADR-83, `kompletterandeUndertryckning` i undertryckning.js).
 *
 * Bygger på: ADR-52 och ADR-83, docs/utveckling/k-troskeln.md avsnitt 2.
 * Beräkningarna står i spårbarhetsmatrisen, docs/utveckling/sparbarhet.md (B6.7).
 */
import { median, kvantil } from './stat.js';
import { sektorsnamn, aidAvRad, namnrader } from './aid.js';
import { statistikFor } from './jamforelse.js';
import { STANDARDTERMER as T, stor, adjektiv } from './termer.js';
import { kompletterandeUndertryckning } from './undertryckning.js';
import { arKvinna, arMan } from './kon.js';
import { K_STANDARD } from './ktroskel.js';


// ---- Receptet (ADR-52): vad avsnittet ska innehålla. Standardvärdet är tabellerna som de står i arbetsgivarnas utkast. ----
export const PERBAS_DIMENSIONER = ['bas', 'sektor'];
export const PERBAS_MATT = ['p10', 'p25', 'med', 'p75', 'p90', 'medel'];
export const PERBAS_RADER = ['referens', 'organisation', 'yrken', 'statistik', 'kvinnor', 'man'];
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

const _medel = arr => (arr.length ? arr.reduce((s, x) => s + x, 0) / arr.length : null);
const _loner = rader => rader.map(r => r.lon).filter(x => typeof x === 'number' && isFinite(x) && x > 0);
const _aldrar = rader => rader.map(r => r.alder).filter(x => typeof x === 'number' && isFinite(x) && x > 0);
const _matt = rader => { const l = _loner(rader); return l.length ? { n: rader.length, p10: kvantil(l, 0.1), p25: kvantil(l, 0.25), med: median(l), p75: kvantil(l, 0.75), p90: kvantil(l, 0.9), medel: _medel(l) } : null; };

/** Yrkesgruppens namn: AID-koden och etiketten. */
export function yrkesnamn(r) {
    const aid = r.aid != null ? String(r.aid).trim() : '';
    const etikett = r.yrkeLabel ? String(r.yrkeLabel).trim() : '';
    if (aid && etikett && etikett !== aid) return `${aid} ${etikett}`;
    return aid || etikett || String(r.yrke || '').trim() || `(${adjektiv('okänd', T.enhet)} ${T.enhet.en})`;
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
 *          referensNamn?: string, statistikNamn?: string, recept?: any}} [opt]
 *   `recept` (ADR-52): dimensionen som upprepas ('bas' eller 'sektor'), vilka rader och mått, och om summeringstabellerna
 *   ska med; utelämnat ger standardreceptet. Med sektor som dimension finns ingen referensrad (ställningstagandet
 *   gäller BAS-intervall).
 */
export function perBasTabeller(rader, opt = {}) {
    const k = opt.k ?? K_STANDARD;
    const recept = valideraPerBasRecept(opt.recept);
    const visa = new Set(recept.rader);
    const dimAv = recept.dim === 'sektor' ? (r => sektorsnamn(r.aid) || '') : (r => String(r.bas ?? ''));
    const referens = typeof opt.referens === 'function' ? opt.referens : () => null;
    const statistik = Array.isArray(opt.statistik) ? opt.statistik : [];
    const referensNamn = opt.referensNamn || 'Referens';
    const statistikNamn = opt.statistikNamn || 'Jämförelsestatistik';
    const granser = recept.aldersgranser;   // valideraPerBasRecept har sorterat dem
    const d = (rader || []).filter(r => r && r.bas && dimAv(r));
    // Ålderskolumnen är valfri (ADR-64): utan ålder utelämnas åldersgrupperna och medelåldern.
    const harAlder = d.some(r => typeof r.alder === 'number' && r.alder > 0);
    const basar = [...new Set(d.map(dimAv))].sort((a, b) => a.localeCompare(b, 'sv'));
    // Statistikens gemensamma uppslag (jamforelse.js): samma AID och BAS, annars samma AID utan BAS.
    const statFor = (aid, bas) => statistikFor(statistik, aid, bas)?.rad || null;

    const perDim = new Map(basar.map(b => [b, d.filter(r => dimAv(r) === b)]));
    const raderI = b => perDim.get(b) || [];
    const basUtelamnade = basar.filter(b => raderI(b).length < k);
    const visadeBas = basar.filter(b => raderI(b).length >= k);
    const nKvI = b => raderI(b).filter(arKvinna).length, nMaI = b => raderI(b).filter(arMan).length;
    const konVisasI = b => nKvI(b) >= k && nMaI(b) >= k;
    const harMedel = recept.matt.includes('medel');

    // Kompletterande undertryckning (ADR-83). Raden Alla i tabellerna inom likvärdigt arbete och i åldersgrupper räknas
    // på hela underlaget; omfattar de utelämnade intervallen färre än k personer undertrycks medelvärdena för de minsta
    // visade intervallen, i alla tabellerna (också organisationens rad, yrkesgrupperna och könsraderna i intervallets
    // tabell, som annars ger intervallets medellön tillbaka). Raden Alla bär bara medelvärden i de två tabellerna.
    const allaVisas = recept.konsgap || (recept.aldersgrupper && harAlder);
    const medelDolda = new Set(allaVisas
        ? kompletterandeUndertryckning(basar.map(b => ({ namn: b, n: raderI(b).length, dold: raderI(b).length < k })), k).map(i => basar[i])
        : []);
    // Samma regel per kön: medellön per kön på raden Alla minus de visade intervallens ger de dolda könscellernas
    // gemensamma medellön, och den ska omfatta minst k personer av det könet. Ett intervall vars könsmedel döljs ger
    // också via sin medellön för alla den andra könets dolda celler, så båda könens medel döljs tillsammans.
    const konDolda = new Set();
    if (recept.konsgap && d.filter(arKvinna).length >= k && d.filter(arMan).length >= k) {
        for (const antal of [nKvI, nMaI]) {
            const delar = basar.map(b => ({ namn: b, n: antal(b), dold: raderI(b).length < k || medelDolda.has(b) || !konVisasI(b) || konDolda.has(b) }));
            kompletterandeUndertryckning(delar, k).forEach(i => konDolda.add(basar[i]));
        }
    }
    const utanMedel = r => ({ ...r, medel: null });

    const intervall = [];
    for (const bas of visadeBas) {
        const df = raderI(bas);
        const medelDold = medelDolda.has(bas), konMedelDold = konDolda.has(bas);
        const rad = [];
        const utelamnade = [];
        const ref = recept.dim === 'bas' && visa.has('referens') ? referens(null, bas) : null;
        if (ref && (ref.p10 != null || ref.med != null || ref.p90 != null)) rad.push({ typ: 'referens', namn: referensNamn, n: null, p10: ref.p10 ?? null, med: ref.med ?? null, p90: ref.p90 ?? null });
        const org = visa.has('organisation') ? _matt(df) : null;
        if (org) rad.push({ typ: 'organisation', namn: 'Organisationen', ...(medelDold ? utanMedel(org) : org) });
        // Yrkesgrupperna, största först; under varje yrke dess rad i jämförelsestatistiken. Gruppen är AID-koden
        // (aidAvRad), och en rad utan kod grupperas på sin text.
        const perYrke = new Map();
        df.forEach(r => { const key = aidAvRad(r); if (!perYrke.has(key)) perYrke.set(key, []); perYrke.get(key).push(r); });
        // Yrkesgruppens namn ur texten på flest av dess rader (namnrader), som i resten av verktyget (ADR-89).
        const namnrad = namnrader(df, aidAvRad), namnAv = rows => yrkesnamn(namnrad.get(aidAvRad(rows[0])));
        const yrken = [...perYrke.entries()].sort((a, b) => b[1].length - a[1].length || namnAv(a[1]).localeCompare(namnAv(b[1]), 'sv'));
        // Organisationens rad minus yrkesgruppernas ger de utelämnade yrkesgruppernas medellön: samma regel inom intervallet.
        // En yrkesgrupp utan någon lön har inget medel och räknas varken som visad eller som dold.
        const yrkesMatt = visa.has('yrken') ? yrken.map(([, rows]) => (rows.length >= k ? _matt(rows) : null)) : [];
        const yrkenDolda = new Set(visa.has('yrken') && !medelDold
            ? kompletterandeUndertryckning(yrken.map(([, rows], i) => ({ namn: namnAv(rows), n: rows.length < k || yrkesMatt[i] ? rows.length : 0, dold: rows.length < k || !yrkesMatt[i] })), k)
            : []);
        const undertryckta = [];
        yrken.forEach(([key, rows], i) => {
            if (!visa.has('yrken')) return;
            const namn = namnAv(rows);
            if (rows.length < k) { utelamnade.push(namn); return; }
            const m = yrkesMatt[i];
            if (!m) return;
            const dold = medelDold || yrkenDolda.has(i);
            if (yrkenDolda.has(i)) undertryckta.push(namn);
            rad.push({ typ: 'yrke', namn, aid: key, ...(dold ? utanMedel(m) : m) });
            const s = visa.has('statistik') && rows[0].aid != null && recept.dim === 'bas' ? statFor(rows[0].aid, bas) : null;
            if (s && s.median > 0) rad.push({ typ: 'statistik', namn: `${statistikNamn}: ${namn}`, aid: key, n: null, p10: s.p10 ?? null, med: s.median, p90: s.p90 ?? null });
        });
        const kv = df.filter(arKvinna), ma = df.filter(arMan);
        const konVisas = kv.length >= k && ma.length >= k;
        if (konVisas) {
            const mk = visa.has('kvinnor') ? _matt(kv) : null, mm = visa.has('man') ? _matt(ma) : null;
            const konDold = medelDold || konMedelDold;
            if (mk) rad.push({ typ: 'kvinnor', namn: 'Kvinnor', ...(konDold ? utanMedel(mk) : mk) });
            if (mm) rad.push({ typ: 'man', namn: 'Män', ...(konDold ? utanMedel(mm) : mm) });
        }
        // Noterna gäller bara när tabellen visar måttet Medellön; medelvärdena är tomma oavsett.
        intervall.push({ bas, n: df.length, nKv: kv.length, nMa: ma.length, rader: rad, utelamnade, konVisas, antalYrken: perYrke.size,
            undertryckta: harMedel ? undertryckta : [], medelUndertryckt: harMedel && medelDold,
            konMedelUndertryckt: harMedel && konVisas && !medelDold && konMedelDold && (visa.has('kvinnor') || visa.has('man')) });
    }

    // Könsgap och ålder per BAS, med raden Alla först.
    const konsgapRad = (namn, rows, medelDold = false, konDold = false) => {
        const kv = rows.filter(arKvinna), ma = rows.filter(arMan);
        const konVisas = kv.length >= k && ma.length >= k;
        const konMedel = konVisas && !medelDold && !konDold;
        const medel = medelDold ? null : _medel(_loner(rows)), medelKv = konMedel ? _medel(_loner(kv)) : null, medelMa = konMedel ? _medel(_loner(ma)) : null;
        return {
            bas: namn, n: rows.length, medel, medelMa, medelKv,
            kvot: konMedel && medelMa != null && medelMa > 0 && medelKv != null ? medelKv / medelMa * 100 : null,
            andelKv: rows.length ? kv.length / rows.length * 100 : null,
            alder: harAlder && !medelDold ? _medel(_aldrar(rows)) : null, alderMa: harAlder && konMedel ? _medel(_aldrar(ma)) : null,
            alderKv: harAlder && konMedel ? _medel(_aldrar(kv)) : null,
            konVisas
        };
    };
    const konsgap = { rader: [konsgapRad('Alla', d), ...visadeBas.map(b => konsgapRad(b, raderI(b), medelDolda.has(b), konDolda.has(b)))],
        undertryckta: visadeBas.filter(b => medelDolda.has(b)), konUndertryckta: visadeBas.filter(b => konDolda.has(b) && !medelDolda.has(b) && konVisasI(b)) };

    const grupper = aldersgruppNamn(granser);
    const aldersRad = (namn, rows, medelDold = false) => {
        /** @type {any[][]} */
        const per = grupper.map(() => []);
        rows.forEach(r => { if (typeof r.alder === 'number' && isFinite(r.alder) && r.alder > 0) per[_aldersgrupp(r.alder, granser)].push(r); });
        return { bas: namn, n: rows.length, alder: medelDold ? null : _medel(_aldrar(rows)), medel: medelDold ? null : _medel(_loner(rows)),
            perGrupp: per.map(g => (g.length >= k && !medelDold ? _medel(_loner(g)) : null)), antalPerGrupp: per.map(g => g.length) };
    };
    const aldersgrupper = { grupper, rader: [aldersRad('Alla', d), ...visadeBas.map(b => aldersRad(b, raderI(b), medelDolda.has(b)))],
        undertryckta: visadeBas.filter(b => medelDolda.has(b)) };

    return { k, recept, dim: recept.dim, dimEtikett: stor(recept.dim === 'sektor' ? T.huvudomrade.en : T.niva.en), intervall, basUtelamnade, harAlder,
             konsgap: recept.konsgap ? konsgap : null, aldersgrupper: recept.aldersgrupper && harAlder ? aldersgrupper : null };
}

// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
// ---- Årsbokslut (ADR-54): jämförelse mellan år ----
// Ett k-skyddat sammandrag av årets kartläggning som konfigurationsfilen bär, så att nästa års kartläggning kan
// jämföras mot det. Bara aggregat: nyckeltal för hela organisationen, en rad per jämförbar yrkesgrupp (båda könen
// minst k), en rad per BAS-intervall med minst k personer (basIntervall; könsmedianerna bara när båda könen når k)
// och Att göra-punkternas läge. Aldrig individer, aldrig lönedata. Modulen är ren: ingen DOM, inget state.

export const ARSBOKSLUT_VERSION = 1;
const MAX_TEXT = 200;

const _tal = v => (typeof v === 'number' && isFinite(v) ? v : null);
const _heltal = (v, lo, hi) => (Number.isInteger(v) && v >= lo && v <= hi ? v : null);
const _text = v => (typeof v === 'string' ? v.trim().slice(0, MAX_TEXT) : '');

/**
 * Årsbokslutet i giltig form, eller null när det inte går att läsa. Yrkesgrupper där ett kön har färre än k
 * personer faller bort (de får inte bära könsuppdelade mått), och ett tal som inte är ändligt blir null.
 * @param {any} o
 */
export function valideraArsbokslut(o) {
    if (!o || typeof o !== 'object' || Array.isArray(o)) return null;
    const ar = _heltal(o.ar, 2000, 2100);
    const k = _heltal(o.k, 1, 1000);
    const skapat = typeof o.skapat === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(o.skapat) ? o.skapat : null;
    if (ar == null || k == null || !skapat) return null;
    const n = o.nyckeltal && typeof o.nyckeltal === 'object' ? o.nyckeltal : {};
    const nKv = _heltal(n.nKv, 0, 10_000_000) ?? 0, nMa = _heltal(n.nMa, 0, 10_000_000) ?? 0;
    const konOk = nKv >= k && nMa >= k;
    const nyckeltal = {
        n: _heltal(n.n, 0, 10_000_000) ?? nKv + nMa, nKv, nMa,
        medKv: konOk ? _tal(n.medKv) : null, medMa: konOk ? _tal(n.medMa) : null,
        kvotPct: konOk ? _tal(n.kvotPct) : null,
        oforklaratPct: _tal(n.oforklaratPct),
        antalFlaggade: _heltal(n.antalFlaggade, 0, 1_000_000) ?? 0,
        antalKandidatpar: _heltal(n.antalKandidatpar, 0, 1_000_000) ?? 0,
        utelamnadePar: _heltal(n.utelamnadePar, 0, 1_000_000) ?? 0,
    };
    const grupper = (Array.isArray(o.grupper) ? o.grupper : []).map(g => {
        if (!g || typeof g !== 'object') return null;
        const yrke = _text(g.yrke); const gKv = _heltal(g.nKv, 0, 10_000_000), gMa = _heltal(g.nMa, 0, 10_000_000);
        if (!yrke || gKv == null || gMa == null || gKv < k || gMa < k) return null;
        return { yrke, nKv: gKv, nMa: gMa, medKv: _tal(g.medKv), medMa: _tal(g.medMa), gapPct: _tal(g.gapPct), flaggad: g.flaggad === true };
    }).filter(Boolean);
    const punkter = (Array.isArray(o.punkter) ? o.punkter : []).map(p => {
        if (!p || typeof p !== 'object') return null;
        const id = _text(p.id); if (!id) return null;
        return { id, titel: _text(p.titel), kategori: _text(p.kategori), klar: p.klar === true };
    }).filter(Boolean);
    return { version: ARSBOKSLUT_VERSION, ar, skapat, k, verktyg: _text(o.verktyg), nyckeltal, grupper, punkter,
        basIntervall: _valideraBasIntervall(o.basIntervall, k) };
}

/**
 * Löneläget per BAS-intervall: en rad per intervall med minst k personer. P10, median och P90 för hela intervallet;
 * kvinnors och mäns median bara när båda könen når k. Ett intervall under k faller bort helt. Fältet är valfritt:
 * ett bokslut från en äldre version saknar det och får null (inte en tom lista, som betyder att inget intervall
 * nådde k).
 * @param {any} lista
 * @param {number} k
 */
function _valideraBasIntervall(lista, k) {
    if (!Array.isArray(lista)) return null;
    return lista.map(r => {
        if (!r || typeof r !== 'object') return null;
        const bas = _text(r.bas).slice(0, 20);
        const nKv = _heltal(r.nKv, 0, 10_000_000) ?? 0, nMa = _heltal(r.nMa, 0, 10_000_000) ?? 0;
        const n = _heltal(r.n, 0, 10_000_000);
        if (!bas || n == null || n < k) return null;
        const konOk = nKv >= k && nMa >= k;
        return { bas, n, nKv, nMa, p10: _tal(r.p10), med: _tal(r.med), p90: _tal(r.p90),
            medKv: konOk ? _tal(r.medKv) : null, medMa: konOk ? _tal(r.medMa) : null };
    }).filter(Boolean);
}

/** Bygger ett årsbokslut ur delarna (samma form som valideraArsbokslut ger); null när delarna inte räcker. */
export function byggArsbokslut({ ar, skapat, k, verktyg, nyckeltal, grupper, punkter, basIntervall }) {
    return valideraArsbokslut({ ar, skapat, k, verktyg, nyckeltal, grupper, punkter, basIntervall });
}

/** Måtten per BAS-intervall i jämförelsen: nyckel och etikett. Alla är kronor. */
export const ARSBOKSLUT_BAS_MATT = Object.freeze([
    ['p10', 'P10'], ['med', 'Median'], ['p90', 'P90'], ['medKv', 'Median kvinnor'], ['medMa', 'Median män'],
]);

/** Ett mått båda åren: förra året, i år, skillnaden och skillnaden i procent av förra året (null när ett saknas). */
function _forandring(a, b) {
    const ok = typeof a === 'number' && typeof b === 'number';
    return { forra: a ?? null, nu: b ?? null, diff: ok ? b - a : null, pct: ok && a !== 0 ? (b - a) / a * 100 : null };
}

/**
 * Löneutvecklingen per BAS-intervall: en rad per intervall som finns något av åren (årets ordning först, sedan de
 * som bara fanns förra året), med antal och varje mått förra året, i år och förändringen i kronor och procent.
 * null när ett av boksluten saknar fältet.
 */
export function jamforBasIntervall(forra, nu) {
    if (!Array.isArray(forra) || !Array.isArray(nu)) return null;
    const fB = new Map(forra.map(r => [r.bas, r])), nB = new Map(nu.map(r => [r.bas, r]));
    const ordning = [...nB.keys(), ...[...fB.keys()].filter(b => !nB.has(b))];
    return ordning.map(bas => {
        const f = fB.get(bas) || null, n = nB.get(bas) || null;
        const rad = { bas, finnsForra: !!f, finnsNu: !!n, n: _forandring(f && f.n, n && n.n), nKv: _forandring(f && f.nKv, n && n.nKv), nMa: _forandring(f && f.nMa, n && n.nMa) };
        for (const [m] of ARSBOKSLUT_BAS_MATT) rad[m] = _forandring(f && f[m], n && n[m]);
        return rad;
    });
}

/** Nyckeltalens rader i jämförelsen: nyckel, etikett och typ (hur talet skrivs). */
export const ARSBOKSLUT_NYCKELTAL = Object.freeze([
    ['n', 'Antal personer', 'antal'], ['nKv', 'Kvinnor', 'antal'], ['nMa', 'Män', 'antal'],
    ['medKv', 'Medianlön kvinnor', 'kr'], ['medMa', 'Medianlön män', 'kr'],
    ['kvotPct', 'Kvinnors medianlön i % av mäns', 'pct'], ['oforklaratPct', 'Oförklarat lönegap (regressionen, %)', 'pct'],
    ['antalFlaggade', 'Flaggade yrkesgrupper i Lika arbete', 'antal'], ['antalKandidatpar', 'Kandidatpar i Likvärdigt arbete', 'antal'],
]);

/**
 * Jämför förra årets bokslut med årets: nyckeltal rad för rad, flaggade yrkesgrupper (kvar, nya, borta) och
 * Att göra-punkter (vad som bockades av förra året, vilka av förra årets punkter som är klara nu).
 * @param {ReturnType<typeof valideraArsbokslut>} forra
 * @param {ReturnType<typeof valideraArsbokslut>} nu
 */
export function jamforArsbokslut(forra, nu) {
    if (!forra || !nu) return null;
    const nyckeltal = ARSBOKSLUT_NYCKELTAL.map(([nyckel, etikett, typ]) => {
        const a = forra.nyckeltal[nyckel], b = nu.nyckeltal[nyckel];
        return { nyckel, etikett, typ, forra: a, nu: b, diff: typeof a === 'number' && typeof b === 'number' ? b - a : null };
    });
    const perYrke = lista => new Map(lista.map(g => [g.yrke, g]));
    const fG = perYrke(forra.grupper), nG = perYrke(nu.grupper);
    const rad = (yrke, f, n) => ({ yrke, gapForra: f ? f.gapPct : null, gapNu: n ? n.gapPct : null, nKv: n ? n.nKv : (f ? f.nKv : null), nMa: n ? n.nMa : (f ? f.nMa : null) });
    const kvar = [], nya = [], borta = [];
    for (const [yrke, n] of nG) { if (!n.flaggad) continue; const f = fG.get(yrke); (f && f.flaggad ? kvar : nya).push(rad(yrke, f, n)); }
    for (const [yrke, f] of fG) { if (!f.flaggad) continue; const n = nG.get(yrke); if (!n || !n.flaggad) borta.push(rad(yrke, f, n)); }
    const sortera = l => l.sort((a, b) => Math.abs(b.gapNu ?? b.gapForra ?? 0) - Math.abs(a.gapNu ?? a.gapForra ?? 0));
    const nuKlar = new Map(nu.punkter.map(p => [p.id, p.klar]));
    const kvarFranForra = forra.punkter.filter(p => !p.klar).map(p => ({ ...p, finnsNu: nuKlar.has(p.id), klarNu: nuKlar.get(p.id) === true }));
    return {
        nyckeltal,
        grupper: { kvar: sortera(kvar), nya: sortera(nya), borta: sortera(borta), antalForra: forra.grupper.length, antalNu: nu.grupper.length },
        punkter: { totaltForra: forra.punkter.length, klaraForra: forra.punkter.filter(p => p.klar).length,
                   totaltNu: nu.punkter.length, klaraNu: nu.punkter.filter(p => p.klar).length, kvarFranForra },
        samma_k: forra.k === nu.k,
        basIntervall: jamforBasIntervall(forra.basIntervall, nu.basIntervall),
    };
}

/**
 * Hantelns rader: en per yrkesgrupp som har ett gap båda åren, med kvinnors medianlön i procent av mäns förra året
 * (fore) och i år (efter), sorterade efter förändringens storlek. riktning: 'mot' när kvoten närmar sig 100,
 * 'fran' när den fjärmar sig, 'lika' när den inte ändrats. Grupper som saknar gap ett av åren (under tröskeln,
 * eller fanns inte) räknas i utelamnade.
 * @param {ReturnType<typeof jamforArsbokslut>} j
 */
export function hantelRader(j) {
    if (!j) return { rader: [], utelamnade: 0 };
    const alla = [...j.grupper.kvar, ...j.grupper.nya, ...j.grupper.borta];
    const med = alla.filter(g => typeof g.gapForra === 'number' && typeof g.gapNu === 'number');
    const rader = med.map(g => {
        const fore = 100 + g.gapForra, efter = 100 + g.gapNu;
        const dFore = Math.abs(fore - 100), dEfter = Math.abs(efter - 100);
        const riktning = Math.abs(dEfter - dFore) < 0.05 ? 'lika' : dEfter < dFore ? 'mot' : 'fran';
        return { namn: g.yrke, fore, efter, riktning, andring: efter - fore };
    }).sort((a, b) => Math.abs(b.andring) - Math.abs(a.andring));
    return { rader, utelamnade: alla.length - med.length };
}

/**
 * Hantelns rader för löneutvecklingen per BAS-intervall: medianlönen förra året (fore) och i år (efter), i
 * intervallens ordning. riktning: 'upp', 'ned' eller 'lika' (en förändring, ingen bedömning). Intervall som saknar
 * median ett av åren räknas i utelamnade.
 * @param {ReturnType<typeof jamforArsbokslut>} j
 */
export function basHantelRader(j) {
    if (!j || !Array.isArray(j.basIntervall)) return { rader: [], utelamnade: 0 };
    const med = j.basIntervall.filter(r => typeof r.med.forra === 'number' && typeof r.med.nu === 'number');
    const rader = med.map(r => {
        const andring = r.med.nu - r.med.forra;
        return { namn: `BAS ${r.bas}`, bas: r.bas, fore: r.med.forra, efter: r.med.nu, andring, riktning: andring > 0 ? 'upp' : andring < 0 ? 'ned' : 'lika' };
    });
    return { rader, utelamnade: j.basIntervall.length - med.length };
}

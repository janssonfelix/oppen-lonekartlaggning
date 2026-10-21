// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
/**
 * Öppen lönekartläggning — SKR:s personalstatistik som referens för kvinnoandel.
 *
 * Kvinnoandel per AID-etikett i kommuner, regioner eller båda tillsammans (organisationstypen),
 * vägd med antal anställningar.
 * Där SKR döljer andelen (små tal) räknas bara den del som redovisas; saknas etiketten helt
 * används prefixet (tre första siffrorna). Används som reserv i Likvärdigt arbete och som
 * referensvärde att jämföra organisationens egen könsfördelning mot.
 *
 * Webbläsarbygget får en AUTO-GENERERAD spegel i src/app/09-lib-speglar.js.
 */
import { skrPersonalstatistik } from './skr-personal.js';
import { normaliseraAid, sektorsnamn } from './aid.js';

const DELAR = ['alla', 'kommun', 'region'];
const _del = del => (DELAR.includes(del) ? del : 'alla');

function _vag(rader, del = 'alla') {
    let n = 0, kv = 0;
    for (const [, nK, pK, nR, pR] of rader) {
        if (pK != null && del !== 'region') { n += nK; kv += nK * pK / 100; }
        if (pR != null && del !== 'kommun') { n += nR; kv += nR * pR / 100; }
    }
    return n > 0 ? { pct: kv / n * 100, n, del } : null;
}

/** "kommuner", "regioner" eller "kommuner och regioner". */
export function skrDelText(del) {
    return { kommun: 'kommuner', region: 'regioner' }[del] || 'kommuner och regioner';
}

/**
 * Kvinnoandel (%) för ett AID-prefix (tre siffror), eller null.
 * @param {string|number} prefix
 * @param {{del?: 'alla'|'kommun'|'region'}} [opt] - vilken del av statistiken (organisationstypen)
 */
export function skrKvinnoandelPrefix(prefix, { del = 'alla' } = {}) {
    const rader = skrPersonalstatistik().etiketter.filter(e => String(e[0]).startsWith(String(prefix)));
    const v = _vag(rader, _del(del)) || (_del(del) !== 'alla' ? _vag(rader) : null);
    return v ? { ...v, niva: 'prefix', prefix: String(prefix) } : null;
}

/**
 * Kvinnoandel (%) för en AID-kod i den valda delen: etiketten, annars prefixet; finns yrket inte
 * alls i delen används kommuner och regioner tillsammans. null för okänd kod.
 */
export function skrKvinnoandel(aid, { del = 'alla' } = {}) {
    const kod = normaliseraAid(aid);
    if (!kod) return null;
    const d = _del(del);
    const alla = skrPersonalstatistik().etiketter;
    const etikett = alla.filter(e => e[0] === kod), prefix = alla.filter(e => String(e[0]).startsWith(kod.slice(0, 3)));
    const forsok = [[etikett, d, 'etikett'], [prefix, d, 'prefix'], [etikett, 'alla', 'etikett'], [prefix, 'alla', 'prefix']];
    for (const [rader, del2, niva] of forsok) {
        const v = _vag(rader, del2);
        if (v) return { ...v, niva, prefix: kod.slice(0, 3) };
    }
    return null;
}

/** Kvinnoandel (%) för en sektor (AID-huvudområdets namn) i den valda delen, eller null. */
export function skrKvinnoandelSektor(namn, { del = 'alla' } = {}) {
    const rader = skrPersonalstatistik().etiketter.filter(e => sektorsnamn(e[0]) === namn);
    const v = _vag(rader, _del(del)) || (_del(del) !== 'alla' ? _vag(rader) : null);
    return v ? { ...v, niva: 'sektor' } : null;
}

/** Källa och period för referensvärdena. */
export function skrReferensInfo() {
    const s = skrPersonalstatistik();
    return { period: s.period, kalla: s.kalla };
}

// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
/**
 * Öppen lönekartläggning — AID-hierarkin (ADR-33).
 *
 * AID (SKR:s arbetsidentifikation) har en sexsiffrig etikett; de två första siffrorna anger ett
 * av 13 huvudområden ("sektorer"), de fyra första en mellannivå utan namn. Restkoder ("annan")
 * har 090 som de tre sista siffrorna. Etikettnamn och möjliga ansvarskoder kommer ur SKR:s
 * etikettlista (aid-etiketter.js, genererad).
 */
import { aidEtikettlista } from './aid-etiketter.js';
import { STANDARDTERMER as T, stor, adjektiv } from './termer.js';


export const HUVUDOMRADEN = Object.freeze([
    { prefix: '10', namn: 'Ledningsarbete' },
    { prefix: '15', namn: 'Handläggar- och administratörsarbete' },
    { prefix: '20', namn: 'Vård- och omsorgsarbete med mera' },
    { prefix: '25', namn: 'Tandvårdsarbete' },
    { prefix: '30', namn: 'Rehabilitering och förebyggande arbete' },
    { prefix: '35', namn: 'Individ- och familjeomsorg, äldreomsorg, funktionsnedsättning, socialpsykiatri och integration' },
    { prefix: '40', namn: 'Förskole-, skol-, fritids- och annan pedagogisk verksamhet' },
    { prefix: '45', namn: 'Kultur-, turism- och friluftsarbete' },
    { prefix: '50', namn: 'Teknikarbete' },
    { prefix: '52', namn: 'Vaktmästeri, trädgård, anläggning med mera' },
    { prefix: '55', namn: 'Räddningstjänstarbete' },
    { prefix: '60', namn: 'Köks- och måltidsarbete' },
    { prefix: '65', namn: 'Städ, tvätt och renhållningsarbete' },
]);
export const OKANT_HUVUDOMRADE = `${stor(adjektiv('okänd', T.huvudomrade))} ${T.huvudomrade.en}`;

const _PER_PREFIX = new Map(HUVUDOMRADEN.map(h => [h.prefix, h]));
const _ORDNING = new Map(HUVUDOMRADEN.map((h, i) => [h.namn, i]));
/** @type {Map<string, {kod:string, namn:string, ansvarskoder:string[]}>|null} */
let _index = null;

function _etiketter() {
    if (!_index) {
        _index = new Map(aidEtikettlista().etiketter.map(([kod, namn, a]) =>
            [kod, { kod, namn, ansvarskoder: a ? a.split(',') : [] }]));
    }
    return _index;
}

/** Sex siffror först i fältet (som AID-koden läses i dag), annars null. */
export function normaliseraAid(aid) {
    const m = String(aid ?? '').trim().match(/^(\d{6})(?!\d)/);
    return m ? m[1] : null;
}

/** Sifferprefixet ur ett yrkesfält (de inledande siffrorna), eller null när fältet saknar ett. */
export function sifferprefixAvYrke(yrke) {
    const m = String(yrke ?? '').match(/^(\d+)/);
    return m ? m[1] : null;
}

/** AID-koden ur ett yrkesfält: de inledande siffrorna, annars hela yrkesfältet som text. */
export function aidAvYrke(yrke) {
    return sifferprefixAvYrke(yrke) ?? String(yrke ?? '');
}

/**
 * AID-koden som en lönerad grupperas på: aidAvYrke(r.yrke), och för en rad utan text i fältet radens `aid` (inläsningen
 * tar `aid` ur samma sifferprefix, så för en inläst rad är de samma). En grupp är AID-koden i BAS-intervallet i hela
 * verktyget, aldrig texten i fältet: två stavningar av samma etikett är en grupp, och en rad utan kod grupperas på sin
 * text.
 * @param {{aid?:any, yrke?:any}|null|undefined} r
 */
export function aidAvRad(r) {
    if (!r) return '';
    return r.yrke != null && r.yrke !== '' ? aidAvYrke(r.yrke) : String(r.aid ?? '');
}

/**
 * Gruppernas namn (ADR-89): för varje grupp texten i fältet för AID-etikett (`yrke`) som står på flest av gruppens
 * rader; står två texter på lika många rader gäller den som kommer först i lönefilen. En stavning som bara står på
 * enstaka rader, eller ett namn som skrivits i fältet på en rad, blir alltså inte gruppens namn när en annan text står
 * på fler rader. Ger för varje nyckel den första raden med den texten, så att den som skriver namnet tar etiketten
 * (`yrkeLabel`) eller hela fältet ur samma rad. Har gruppen en enda text är raden gruppens första.
 * @template K
 * @param {Iterable<any>} rader - i lönefilens ordning
 * @param {(r: any) => K} nyckelAv - gruppens nyckel för en rad
 * @returns {Map<K, any>}
 */
export function namnrader(rader, nyckelAv) {
    /** @type {Map<K, Map<string, {rad: any, n: number}>>} */
    const perGrupp = new Map();
    for (const r of rader || []) {
        if (!r) continue;
        const nyckel = nyckelAv(r), text = r.yrke == null ? '' : String(r.yrke);
        let texter = perGrupp.get(nyckel);
        if (!texter) { texter = new Map(); perGrupp.set(nyckel, texter); }
        const t = texter.get(text);
        if (t) t.n++; else texter.set(text, { rad: r, n: 1 });
    }
    const ut = new Map();
    for (const [nyckel, texter] of perGrupp) {
        /** @type {{rad: any, n: number}|null} */ let bast = null;
        for (const t of texter.values()) if (!bast || t.n > bast.n) bast = t;
        if (bast) ut.set(nyckel, bast.rad);
    }
    return ut;
}

/** Huvudområdet för en AID-kod, eller null. */
export function huvudomrade(aid) {
    const k = normaliseraAid(aid);
    return k ? (_PER_PREFIX.get(k.slice(0, 2)) || null) : null;
}

/** Sektorns namn — huvudområdet, eller "Okänt huvudområde". */
export function sektorsnamn(aid) {
    const h = huvudomrade(aid);
    return h ? h.namn : OKANT_HUVUDOMRADE;
}

/** De fyra första siffrorna, eller null. */
export function mellanniva(aid) {
    const k = normaliseraAid(aid);
    return k ? k.slice(0, 4) : null;
}

/** "AID 2070xx", eller null. */
export function mellannivaEtikett(aid) {
    const m = mellanniva(aid);
    return m ? `AID ${m}xx` : null;
}

/** Etiketten ur SKR:s lista: { kod, namn, ansvarskoder }, eller null. */
export function etikett(aid) {
    const k = normaliseraAid(aid);
    return k ? (_etiketter().get(k) || null) : null;
}

/** Restkod ("annan"/"annat"): de tre sista siffrorna är 090. */
export function arRestkod(aid) {
    const k = normaliseraAid(aid);
    return !!k && k.endsWith('090');
}

/** Etikett under huvudområdet Ledningsarbete (10xxxx). */
export function arLedningsetikett(aid) {
    const k = normaliseraAid(aid);
    return !!k && k.startsWith('10');
}

/** Sorterar sektorsnamn i prefixordning; okänt huvudområde sist. */
export function jamforSektor(a, b) {
    const i = n => _ORDNING.get(n) ?? HUVUDOMRADEN.length;
    return i(a) - i(b);
}

/** Version, källa och antal etiketter i den inbyggda etikettlistan. */
export function etikettlistaInfo() {
    const l = aidEtikettlista();
    return { version: l.version, kalla: l.kalla, antal: l.etiketter.length };
}

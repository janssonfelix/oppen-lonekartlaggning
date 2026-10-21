// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
/**
 * Öppen lönekartläggning — AID-hierarkin (ADR-33).
 *
 * AID (SKR:s arbetsidentifikation) har en sexsiffrig etikett; de två första siffrorna anger ett
 * av 13 huvudområden ("sektorer"), de fyra första en mellannivå utan namn. Restkoder ("annan")
 * har 090 som de tre sista siffrorna. Etikettnamn och möjliga ansvarskoder kommer ur SKR:s
 * etikettlista (aid-etiketter.js, genererad).
 *
 * Webbläsarbygget får en AUTO-GENERERAD spegel i src/app/09-lib-speglar.js.
 */
import { aidEtikettlista } from './aid-etiketter.js';

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
export const OKANT_HUVUDOMRADE = 'Okänt huvudområde';

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

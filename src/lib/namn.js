// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
/**
 * Öppen lönekartläggning — namnformer för organisationen och jämförelsestatistiken
 * (ADR-36), och ordformen för ett antal personer.
 */
import { genitiv } from './termer.js';

const MAX = 100;

/** Genitiv: namnet + "s", utom när det slutar på s, x eller z (regeln i termer.js). */
export function namnGenitiv(namn) {
    return genitiv(String(namn ?? '').trim());
}

/** Trimmar, slår ihop blanksteg och kortar till högst 100 tecken. */
export function normaliseraNamn(text) {
    return String(text ?? '').replace(/\s+/g, ' ').trim().slice(0, MAX);
}

/** "person" när antalet är 1, annars "personer": `${k} ${personOrd(k)}` ger "minst 1 person". */
export function personOrd(n) {
    return Number(n) === 1 ? 'person' : 'personer';
}

/** "1 kvinna, 6 män": antalen med ordens rätta form (talen som de ges, utan formatering). */
export function kvinnorOchMan(kv, ma) {
    return `${kv} ${Number(kv) === 1 ? 'kvinna' : 'kvinnor'}, ${ma} ${Number(ma) === 1 ? 'man' : 'män'}`;
}

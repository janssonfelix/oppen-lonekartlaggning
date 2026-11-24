// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
// Högst så många gruppnamn räknas upp i noten innan resten summeras.
import { personOrd } from '../lib/namn.js';
import { esc } from './01-html-och-tillganglighet.js';
import { kTroskel } from './06-k-troskel.js';
export const K_NOT_MAX_NAMN = 12;

// "grupp|grupper" -> rätt form efter antal. Anropare skickar båda formerna
// eftersom svensk pluralböjning inte går att härleda ur en ändelse.
export function _kNotForm(sammanhang, antal) {
    const delar = String(sammanhang || 'grupp|grupper').split('|');
    return antal === 1 ? delar[0] : (delar[1] || delar[0]);
}

// OBS: noterna innehåller AVSIKTLIGT ingen inline-markup. SheetJS
// (table_to_sheet) trimmar varje elements text var för sig och slår ihop dem
// utan avskiljare, så ett <strong> mitt i meningen gav "4 yrkesgruppervisas"
// i Excel-exporten. Noten är ändå visuellt avskild via .k-mask-note.
export function _kNotNamn(lista) {
    const visade = lista.slice(0, K_NOT_MAX_NAMN).map(esc).join(', ');
    return visade + (lista.length > K_NOT_MAX_NAMN ? ` och ${lista.length - K_NOT_MAX_NAMN} till` : '');
}

/**
 * Not om grupper som UTELÄMNATS ur en tabell på grund av minsta gruppstorlek.
 *
 * En rad där varje mätvärde står som "< k" bär ingen information — den gör
 * bara tabellen längre och analysen svårare att läsa. I stället utelämnas
 * raden och gruppen redovisas här, med namn, så att handläggaren vet exakt
 * vad som saknas och varför. Uppgifterna finns i underlaget; det är
 * redovisningen per grupp som inte är tillåten.
 *
 * @param {string[]} namn        Gruppernas namn (BAS, yrke, AID …).
 * @param {string} [sammanhang]  Vad grupperna är, som "singular|plural".
 * @param {number} [trosk]       Tröskel att nämna (default kTroskel()).
 * @returns {string} HTML, eller tom sträng om inget utelämnats.
 */
export function kMaskNot(namn, sammanhang, trosk) {
    const lista = (namn || []).filter(Boolean);
    if (!lista.length) return '';
    const n = lista.length;
    const t = trosk || kTroskel();
    const den = n === 1 ? 'Den har' : 'De har';
    const dess = n === 1 ? 'dess' : 'deras';
    return `<p class="k-mask-note">${n} ${esc(_kNotForm(sammanhang, n))} visas inte här: `
        + `${_kNotNamn(lista)}. ${den} färre än ${t} ${personOrd(t)}, och ${dess} lönemått skulle kunna `
        + `peka ut enskilda. Personerna ingår fortfarande i underlaget och i totalsummorna — det är `
        + `redovisningen per grupp som utgår.</p>`;
}

/**
 * Samma not som text utan markup, för rapportmodellen och kortets egna noter: vad som inte visas (`vad`, i plural)
 * och var personerna fortfarande ingår (`dar`).
 * @param {string[]} namn
 * @param {string} sammanhang  "singular|plural"
 * @param {number} t           tröskeln
 * @param {string} vad
 * @param {string} dar
 */
export function _kMaskNotText(namn, sammanhang, t, vad, dar) {
    const lista = (namn || []).filter(Boolean);
    if (!lista.length) return '';
    const n = lista.length;
    const visade = lista.slice(0, K_NOT_MAX_NAMN).join(', ') + (n > K_NOT_MAX_NAMN ? ` och ${n - K_NOT_MAX_NAMN} till` : '');
    const text = n === 1 ? vad.replace(/\bderas\b/g, 'dess') : vad;
    return `${n} ${_kNotForm(sammanhang, n)} visas inte här: ${visade}. ${n === 1 ? 'Det har' : 'De har'} färre än ${t} ${personOrd(t)}, `
        + `och ${text}. Personerna ingår fortfarande i ${dar}; det är redovisningen per ${_kNotForm(sammanhang, 1)} som utgår.`;
}

/**
 * Not om grupper där bara KÖNSUPPDELNINGEN är för liten. Gruppen som helhet
 * ligger över tröskeln, så dess samlade median får redovisas — men en
 * könsjämförelse skulle peka ut de få individerna i det mindre könet.
 *
 * @param {string[]} namn       Gruppernas namn.
 * @param {string} [sammanhang] "singular|plural".
 * @returns {string} HTML, eller tom sträng.
 */
export function kSamladNot(namn, sammanhang) {
    const lista = (namn || []).filter(Boolean);
    if (!lista.length) return '';
    const n = lista.length;
    const stora = n === 1 ? 'Gruppen är stor nog' : 'Grupperna är stora nog';
    return `<p class="k-mask-note">${n} ${esc(_kNotForm(sammanhang, n))} visas med `
        + `gruppens samlade median i stället för könsuppdelade medianer: ${_kNotNamn(lista)}. `
        + `${stora} att redovisa, men ett av könen har färre än ${kTroskel()} ${personOrd(kTroskel())}, `
        + `så en könsjämförelse skulle peka ut enskilda.</p>`;
}


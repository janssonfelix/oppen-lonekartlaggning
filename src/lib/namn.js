// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
/**
 * Öppen lönekartläggning — namnformer för organisationen och jämförelsestatistiken
 * (ADR-36).
 *
 * Webbläsarbygget får en AUTO-GENERERAD spegel i src/app/09-lib-speglar.js.
 */
const MAX = 100;

/** Genitiv: namnet + "s", utom när det slutar på s, x eller z. */
export function namnGenitiv(namn) {
    const n = String(namn ?? '').trim();
    if (!n) return '';
    return /[sxz]$/i.test(n) ? n : n + 's';
}

/** Trimmar, slår ihop blanksteg och kortar till högst 100 tecken. */
export function normaliseraNamn(text) {
    return String(text ?? '').replace(/\s+/g, ' ').trim().slice(0, MAX);
}

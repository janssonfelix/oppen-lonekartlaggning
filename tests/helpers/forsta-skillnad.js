// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
/**
 * Bitvis jämförelse för adaptertesterna (tests/*-adapter.test.js): appens adapter mot funktionen i src/lib/.
 */

/** Första skillnaden mellan två värden som sökväg, eller null när de är lika (tal med Object.is, nycklar i ordning). */
export function forstaSkillnad(a, b, vag = '') {
    if (typeof a === 'number' || typeof b === 'number') return Object.is(a, b) ? null : `${vag}: ${a} ≠ ${b}`;
    if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') return a === b ? null : `${vag}: ${a} ≠ ${b}`;
    if (Array.isArray(a) !== Array.isArray(b)) return `${vag}: lista mot objekt`;
    const ka = Object.keys(a), kb = Object.keys(b);
    if (ka.join('|') !== kb.join('|')) return `${vag}: nycklarna ${ka.join(',')} ≠ ${kb.join(',')}`;
    for (const k of ka) {
        const s = forstaSkillnad(a[k], b[k], `${vag}.${k}`);
        if (s) return s;
    }
    return null;
}

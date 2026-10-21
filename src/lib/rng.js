// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
/**
 * Öppen lönekartläggning — Deterministisk slumpgenerator för bootstrap
 *
 * Med `Math.random()` skulle SAMMA fil ge OLIKA bootstrap-intervall vid varje
 * körning. Intervallen hamnar i utskrifter som går till ledning och fack, så två
 * personer med samma underlag ska få samma siffror — och projektet i övrigt är
 * byggt på reproducerbarhet (golden-lås, determinismtester, mulberry32 i
 * testdatageneratorn).
 *
 * Därför seedas generatorn från datat självt. Samma indata → samma seed →
 * samma intervall, varje gång, i varje webbläsare. Statistiskt likvärdigt —
 * bootstrap kräver bara att draget är pseudoslumpmässigt, inte oförutsägbart.
 *
 * Separat från app.js för Vitest; app.js får en AUTO-GENERERAD spegel (`_rng*`
 * i src/app/09-lib-speglar.js via tools/gen-mirrors.mjs) — ändra här och kör
 * `npm run build:app`, rör ej spegeln (vaktas av tests/drift.test.js).
 */

/**
 * FNV-1a, 32 bitar. Snabb och stabil sträng→heltal-hash.
 * @param {string} str
 * @returns {number} osignerat 32-bitars heltal
 */
export function hashSeed(str) {
    let h = 2166136261;
    const s = String(str);
    for (let i = 0; i < s.length; i++) {
        h ^= s.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    return h >>> 0;
}

/**
 * mulberry32 — samma generator som testdatageneratorn använder. Liten, snabb
 * och tillräckligt bra för bootstrap-återsampling.
 * @param {number} seed
 * @returns {() => number} funktion som ger tal i [0, 1)
 */
export function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
        a = (a + 0x6D2B79F5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

/**
 * Härleder en stabil seed ur själva talserierna. Använder längd + summa per
 * serie, vilket är billigt och ändras så fort underlaget ändras (ny fil, annat
 * urval → nytt men reproducerbart intervall).
 * @param {...Array<number>} arrays
 * @returns {number}
 */
export function seedFromNumbers(...arrays) {
    let s = '';
    for (const arr of arrays) {
        if (!Array.isArray(arr)) { s += 'x|'; continue; }
        let sum = 0;
        for (let i = 0; i < arr.length; i++) {
            const v = Number(arr[i]);
            if (isFinite(v)) sum += v;
        }
        s += arr.length + ':' + Math.round(sum) + '|';
    }
    return hashSeed(s);
}

/**
 * Bekvämlighet: seedad generator direkt ur talserierna.
 * @param {...Array<number>} arrays
 * @returns {() => number}
 */
export function rngFor(...arrays) {
    return mulberry32(seedFromNumbers(...arrays));
}

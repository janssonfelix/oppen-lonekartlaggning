// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
/**
 * Förminskning av sidan för bygget (tools/bundle.mjs).
 *
 * Blanksteg mellan taggar tas bort, utom där det bär betydelse: mellan två textelement som står i löpande text
 * är blanksteget ett ordmellanrum. `<strong>Ålder</strong> <em>(valfri)</em>` ska visas som "Ålder (valfri)", inte
 * "Ålder(valfri)". Mallarna för termerna (data-term-template, ADR-74) lägger text i egna <span>, så fallet är vanligt.
 * Innehållet i pre, script, style och textarea rörs inte.
 */

// Element som står i löpande text. En stängande sådan tagg följd av blanksteg och en öppnande sådan tagg är två ord.
const TEXTELEMENT = 'a|abbr|b|code|em|i|kbd|span|strong';
const TEXTELEMENT_GRANS = new RegExp(`(</(?:${TEXTELEMENT})>)\\s+(<(?:${TEXTELEMENT})\\b)`, 'gi');
const ORDMELLANRUM = '\u0000ORDMELLANRUM\u0000';

/**
 * @param {string} html
 * @returns {string}
 */
export function minifyHtml(html) {
    const protectedBlocks = new Map();
    let protIdx = 0;
    const patterns = [
        /<pre\b[^>]*>[\s\S]*?<\/pre\b[^>]*>/gis,
        /<script\b[^>]*>[\s\S]*?<\/script\b[^>]*>/gis,
        /<style\b[^>]*>[\s\S]*?<\/style\b[^>]*>/gis,
        /<textarea\b[^>]*>[\s\S]*?<\/textarea\b[^>]*>/gis
    ];
    for (const p of patterns) {
        html = html.replace(p, m => {
            const key = `__BUNDLE_PROTECTED_${protIdx}__`;
            protectedBlocks.set(key, m);
            protIdx++;
            return key;
        });
    }
    // HTML-kommentarer (utom villkorskommentarer <!--[if ...)). Upprepa tills inget ändras, så att en
    // borttagning inte kan foga ihop en ny kommentar av resterna.
    let forra;
    do { forra = html; html = html.replace(/<!--(?!\[if)[\s\S]*?-->/g, ''); } while (html !== forra);
    // Blanksteg mellan två textelement (</em> <strong>, </span> <em>) är ett ordmellanrum och blir ETT mellanslag:
    // utan det skrivs orden ihop ("som</span><em>inte" visas som "sominte"). Platshållaren sätts tillbaka sist.
    html = html.replace(TEXTELEMENT_GRANS, `$1${ORDMELLANRUM}$2`);
    // Övrigt blanksteg mellan taggar tas bort
    html = html.replace(/>\s+</g, '><');
    html = html.split(ORDMELLANRUM).join(' ');
    // Kollapsa flera whitespace till ett mellanslag inom textnoder
    html = html.replace(/[ \t]+/g, ' ');
    html = html.replace(/\r?\n\s*/g, '\n');
    html = html.replace(/\n+/g, '\n');
    // Aterstall skyddade block
    for (const [key, value] of protectedBlocks) {
        html = html.split(key).join(value);
    }
    return html.trim();
}

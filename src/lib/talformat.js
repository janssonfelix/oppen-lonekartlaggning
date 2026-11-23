// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
/**
 * Öppen lönekartläggning — Tal som text, svenskt format (ren modul)
 *
 * Talformatet på ett ställe: appens tabeller och lib-modulerna som skriver text
 * (rapportunderlaget, diagramkärnan, prioriteringen) använder samma funktioner och avrundar därför likadant.
 *
 * All text som visas ska ha decimalkomma och mellanslag före procenttecknet ("85,2 %"). toFixed ger decimalpunkt
 * och används bara där ett tal ska läsas av kod (CSS-mått, sorteringsvärden, tal till Excel).
 *
 * Mellan talet och enheten står ett hårt mellanslag (U+00A0), som Intl redan skriver mellan tusentalen: då bryts
 * «36 262 kr» och «73 %» aldrig isär i en smal kolumn, på skärmen eller i utskriften. Excel-exporten gör det hårda
 * mellanslaget till ett vanligt (src/app/22-exporthjalpare.js), liksom CSV och urklipp (_tableCellText i
 * src/app/12-tillstand.js), så där står talen som förut. Word-utkastet gör om allt blanktecken till vanligt
 * mellanslag (src/app/62-word-utkast.js); där hålls ett belopp ihop av kolumnbredden, som src/lib/docx.js räknar så
 * att talet ryms på en rad.
 */
import { avrundaSymmetriskt } from './stat.js';

const _svNf = new Map();
/**
 * Talet med `dec` decimaler i svenskt format; "–" om det inte är ett ändligt tal. Halvorna avrundas bort från noll
 * (avrundaSymmetriskt): −1 600,5 och 1 600,5 visas båda med siffrorna 1 601. Noll visas utan minustecken (ingen "−0,0").
 * @param {unknown} v
 * @param {number} [dec]
 * @returns {string}
 */
export function svTal(v, dec = 0) {
    if (typeof v !== 'number' || !isFinite(v)) return '–';
    if (!_svNf.has(dec)) _svNf.set(dec, new Intl.NumberFormat('sv-SE', { minimumFractionDigits: dec, maximumFractionDigits: dec }));
    return _svNf.get(dec).format(avrundaSymmetriskt(v, dec));
}

/** Som svTal, med " %" efter (hårt mellanslag). @param {unknown} v @param {number} [dec] @returns {string} */
export function svPct(v, dec = 1) { return typeof v === 'number' && isFinite(v) ? `${svTal(v, dec)} %` : '–'; }

// PO-påslaget i procent med högst två decimaler och utan avslutande nollor, som användaren skrev det: 40 → "40 %",
// 39,15 → "39,15 %", 31,4 → "31,4 %".
const _svPoNf = new Intl.NumberFormat('sv-SE', { maximumFractionDigits: 2 });
/** @param {unknown} v @returns {string} */
export function svPoPct(v) { return typeof v === 'number' && isFinite(v) ? `${_svPoNf.format(v)} %` : '–'; }

/** Beloppet i hela kronor med " kr" efter (hårt mellanslag); `tom` när det inte är ett ändligt tal.
 *  @param {unknown} v @param {string} [tom] @returns {string} */
export function svKr(v, tom = '–') { return typeof v === 'number' && isFinite(v) ? `${svTal(v, 0)} kr` : tom; }

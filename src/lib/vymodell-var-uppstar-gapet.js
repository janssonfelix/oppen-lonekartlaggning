// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
/**
 * Öppen lönekartläggning — vymodellen för kortet Var uppstår löneskillnaden? i Lönestruktur (ADR-99, ADR-22, ADR-65):
 * uppdelningen av gapet i medellön (gapUppdelning, med k), medianens kvot, delarna med belopp, andel och de grupper
 * som bidrar mest, och trappans steg. Ritfunktionen i src/app/68-var-uppstar-gapet.js (ritaGapUppdelning) ritar bara
 * det den får; delarnas åtgärd och länk är appens.
 */
import { gapDelar, gapStandardVariabler, gapUppdelning } from './gapuppdelning.js';
import { konsMedianer } from './struktur.js';

/**
 * Delens andel av hela skillnaden i procent för trappan, eller null när den inte säger något: en liten skillnad
 * (`litetGap`), en del som går åt andra hållet än helheten eller en del som är större än helheten.
 * @param {{gap:number, litetGap?:boolean}} u
 * @param {number} v
 */
export function andelAvSkillnaden(u, v) {
    if (u.litetGap || !u.gap) return null;
    const a = v / u.gap * 100;
    return a >= 0 && a <= 100 ? a : null;
}

/**
 * Trappan i omvänd ordning: från hela skillnaden dras delarna av en i taget, och nivån efter den sista är noll.
 * Ett steg per del med nivån före och efter, intervallet (avrundat) och andelen (andelAvSkillnaden).
 * @param {{gap:number, delar:Record<string, number>, litetGap?:boolean, variabler?:string[]}} u
 */
export function gapTrappa(u) {
    const delar = gapDelar(u.variabler || gapStandardVariabler());
    let niva = u.gap;
    return delar.map(d => {
        const v = u.delar[d.id], fore = niva; niva -= v;
        return { del: d, belopp: v, fore, efter: niva, lag: Math.round(Math.min(fore, niva)), hog: Math.round(Math.max(fore, niva)),
            inom: d.variabel === null, andel: andelAvSkillnaden(u, v) };
    });
}

/**
 * Vymodellen, null utan underlag och { forFa: true } när ett kön har färre än k i urvalet. Delarnas andel i raderna
 * är beloppet delat med hela skillnaden (null vid en liten skillnad); grupperna som räknats samman (ADR-87) har
 * bara sitt antal.
 * @param {any[]} rader
 * @param {{k:number, variabler:string[]}} val
 */
export function vymodellVarUppstarGapet(rader, { k, variabler }) {
    if (!rader.length) return null;
    const u = gapUppdelning(rader, { k, variabler });
    if (!u) return { forFa: true };
    const valda = u.variabler || variabler;
    const delar = gapDelar(valda).map(d => ({ ...d, belopp: u.delar[d.id], andel: u.litetGap ? null : u.delar[d.id] / u.gap * 100,
        topp: u.topp[d.id], ovrigaAntal: u.ovrigaAntal[d.id] || 0 }));
    return { forFa: false, uppdelning: u, variabler: valda, medianKvot: konsMedianer(rader, { k }).kvotPct,
        delar, storst: Math.max(1, ...delar.map(d => Math.abs(d.belopp))) };
}

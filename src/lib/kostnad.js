// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
/**
 * Öppen lönekartläggning — Kostnad för beräkningsperioden (ren modell)
 *
 * Kostnadsformeln på ett ställe: ett månadsbelopp × beräkningsperiodens månader × (1 + PO-påslaget). Prioriteringen,
 * löneöversynen, handlingsplanen och beräkningsbeviset räknar med den.
 *
 * Kostnadsinställningarna tolkas likadant överallt: månader som saknas eller är 0 blir 12, PO som saknas blir 0 %.
 * Fältet i Inställningar väljer 3, 6, 9 eller 12 månader, så 0 nås inte därifrån.
 *
 * Multiplikationen görs i ordningen belopp × månader × PO-faktor, så att alla som räknar får samma tal ända ut i sista
 * decimalen. Därför ges PO-faktorn och månaderna var för sig och inte som en färdig produkt.
 *
 * Bygger på: verktygets egen modell; PO-påslagets standardvärde i ADR-84.
 * Beräkningarna står i spårbarhetsmatrisen, docs/utveckling/sparbarhet.md (B7.1).
 */

/** Kostnadsinställningarnas standardvärden. PO-påslaget 40 % är ett standardantagande; organisationen sätter sitt eget. */
export const COST_DEFAULTS = Object.freeze({
    months: 12,         // beräkningsperiod (3/6/9/12 vanligt)
    poPct:  40          // PO-påslag i % (arbetsgivaravgifter och pension ovanpå lönen)
});

/**
 * Kostnadsinställningarna med standardvärdena ifyllda.
 * @param {{months?: number, poPct?: number}|null|undefined} kostnadsval
 * @returns {{months: number, poPct: number, poFaktor: number}}  poFaktor = 1 + poPct / 100
 */
export function kostnadsfaktor(kostnadsval) {
    const months = (kostnadsval && kostnadsval.months) || 12;
    const poPct = (kostnadsval && kostnadsval.poPct) || 0;
    return { months, poPct, poFaktor: 1 + poPct / 100 };
}

/**
 * En redan summerad månadskostnad för hela perioden med PO-påslag: belopp × månader × (1 + PO). Beloppet behåller
 * sitt tecken.
 * @param {number} kronorPerManad
 * @param {{months?: number, poPct?: number}|null|undefined} kostnadsval
 */
export function periodkostnad(kronorPerManad, kostnadsval) {
    const { months, poFaktor } = kostnadsfaktor(kostnadsval);
    return kronorPerManad * months * poFaktor;
}

/**
 * Perioden som kostnaden gäller, som ord efter «kr/» och «per»: «år» när beräkningsperioden är tolv månader, annars
 * antalet månader («6 mån»). Kostnaderna räknas för beräkningsperioden, inte för ett år.
 * @param {{months?: number}|null|undefined} kostnadsval
 */
export function periodOrd(kostnadsval) {
    const { months } = kostnadsfaktor(kostnadsval);
    return months === 12 ? 'år' : `${months} mån`;
}

/**
 * Ett månadsbelopp per person som kostnad för `antal` personer under beräkningsperioden, med perioden och PO-påslaget
 * ur kostnadsinställningarna: |belopp| × månader × (1 + PO) × antal. Trots namnet är det ett år bara när perioden är
 * tolv månader (periodOrd). Prioriteringens åtgärdskostnad och gruppdossierns räkneexempel räknar med samma formel.
 * @param {number} kronorPerManad
 * @param {number} antal
 * @param {{months?: number, poPct?: number}|null|undefined} kostnadsval
 */
export function kostnadPerAr(kronorPerManad, antal, kostnadsval) {
    return periodkostnad(Math.abs(kronorPerManad), kostnadsval) * antal;
}

// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
/**
 * Öppen lönekartläggning — Kostnad per år (ren modell)
 *
 * Kostnadsformeln på ett ställe: ett månadsbelopp × beräkningsperiodens månader × (1 + PO-påslaget). Prioriteringen,
 * löneöversynen, handlingsplanen och beräkningsbeviset räknar med den.
 *
 * Kostnadsinställningarna tolkas likadant överallt: månader som saknas eller är 0 blir 12, PO som saknas blir 0 %.
 * Fältet i Inställningar tillåter 1–60 månader, så 0 nås inte därifrån.
 *
 * Multiplikationen görs i samma ordning som innan formeln samlades här (belopp × månader × PO-faktor), så att inget
 * tal ändras i sista decimalen. Därför ges PO-faktorn och månaderna var för sig och inte som en färdig produkt.
 *
 * Bygger på: verktygets egen modell; PO-påslagets standardvärde i ADR-84.
 * Beräkningarna står i spårbarhetsmatrisen, docs/utveckling/sparbarhet.md (B7.1).
 */

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
 * Ett månadsbelopp per person som belopp per år för `antal` personer, med beräkningsperiod och PO-påslag ur
 * kostnadsinställningarna: |belopp| × månader × (1 + PO) × antal. Prioriteringens åtgärdskostnad och
 * gruppdossierns räkneexempel räknar med samma formel.
 * @param {number} kronorPerManad
 * @param {number} antal
 * @param {{months?: number, poPct?: number}|null|undefined} kostnadsval
 */
export function kostnadPerAr(kronorPerManad, antal, kostnadsval) {
    return periodkostnad(Math.abs(kronorPerManad), kostnadsval) * antal;
}

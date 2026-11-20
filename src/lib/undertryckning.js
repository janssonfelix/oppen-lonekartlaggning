// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
/**
 * Öppen lönekartläggning — kompletterande undertryckning och sammanslagning (ADR-83, ADR-87,
 * `docs/utveckling/k-troskeln.md` avsnitt 2).
 *
 * Två allmänna regler för delar av en total, där totalen skrivs ut och delarna har ett medelvärde var:
 *  - `kompletterandeUndertryckning`: vilka visade delar vars medelvärden också ska undertryckas, så att totalen minus
 *    de visade delarna aldrig ger medelvärdet för färre än k personer. Används av tabellerna per BAS-intervall.
 *  - `sammanslagning`: vilka delar som ska räknas samman till en, så att varje del har 0 eller minst k personer av
 *    varje kön. Används där delarnas medelvärden inte står var för sig men går att räkna fram ur ett ekvationssystem
 *    (uppdelningen av löneskillnaden och huvudområdenas andel av den): när varje del har 0 eller minst k av varje kön
 *    är allt som går att räkna fram ett medel för minst k personer av ett kön, eller en vägd summa av sådana.
 *
 * Funktionerna vet inte vad delarna är (BAS-intervall, AID-etiketter, huvudområden, åldersgrupper). Antal och andelar
 * berörs inte (ADR-70).
 *
 * Webbläsarbygget får en AUTO-GENERERAD spegel i src/app/09-lib-speglar.js.
 */

/**
 * Kompletterande undertryckning (ADR-83): vilka visade delar vars medelvärden också ska undertryckas, så att en total
 * minus de visade delarna aldrig ger medelvärdet för färre än k personer.
 *
 * Delarna är en uppdelning av totalen; `dold` är en del som redan utelämnas eller undertrycks. Omfattar de dolda
 * tillsammans 0 eller minst k personer ändras ingenting. Annars väljs den minsta visade delen (färst personer, vid lika
 * antal först efter namn och sedan ordningen i listan), och så vidare tills de dolda tillsammans når k. Räcker inte
 * alla delar väljs alla, och bara totalen har ett medelvärde. Delar utan personer (n ≤ 0) väljs aldrig.
 *
 * Antal och andelar berörs inte (ADR-70), och medianer och percentiler inte heller (de går inte att dela upp).
 * @param {Array<{n:number, dold?:boolean, namn?:string}>} delar
 * @param {number} k
 * @returns {number[]} index i `delar` för de visade delar som ska undertryckas, i den ordning de valdes
 */
export function kompletterandeUndertryckning(delar, k) {
    let dolda = 0;
    for (const d of delar) if (d.dold) dolda += d.n;
    if (dolda <= 0 || dolda >= k) return [];
    const kandidater = delar.map((d, i) => ({ n: d.n, namn: String(d.namn ?? ''), i }))
        .filter(d => !delar[d.i].dold && d.n > 0)
        .sort((a, b) => a.n - b.n || a.namn.localeCompare(b.namn, 'sv') || a.i - b.i);
    const ut = [];
    for (const d of kandidater) {
        if (dolda >= k) break;
        ut.push(d.i);
        dolda += d.n;
    }
    return ut;
}

/**
 * Sammanslagning (ADR-87): vilka delar som räknas samman till en, så att varje del, också den sammanslagna, har 0 eller
 * minst k kvinnor och 0 eller minst k män.
 *
 * En del där ett kön har 1 till k − 1 personer slås samman. Har de sammanslagna tillsammans 1 till k − 1 kvinnor
 * läggs den visade del till som har färst kvinnor (men minst en), och så vidare, med samma val som
 * `kompletterandeUndertryckning`; sedan samma sak för männen. En visad del har 0 eller minst k av varje kön, så att
 * lägga till den för det ena könet förstör aldrig det andra. Räcker inte alla delar slås alla samman, och de har då
 * tillsammans helhetens antal. Har helheten 0 eller minst k av varje kön, som den har där funktionen används, får den
 * sammanslagna delen alltid det, och den består då av minst två delar.
 * @param {Array<{nKv:number, nMa:number, namn?:string}>} delar
 * @param {number} k
 * @returns {number[]} index i `delar` för de delar som slås samman, stigande; tomt eller minst två
 */
export function sammanslagning(delar, k) {
    const liten = n => n > 0 && n < k;
    const samman = delar.map(d => liten(d.nKv) || liten(d.nMa));
    for (;;) {
        let nya = 0;
        for (const kon of ['nKv', 'nMa']) {
            const val = kompletterandeUndertryckning(delar.map((d, i) => ({ namn: d.namn, n: d[kon], dold: samman[i] })), k);
            for (const i of val) samman[i] = true;
            nya += val.length;
        }
        if (!nya) break;
    }
    return samman.flatMap((s, i) => (s ? [i] : []));
}

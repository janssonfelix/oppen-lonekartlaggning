// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
/**
 * Öppen lönekartläggning — kompletterande undertryckning och sammanslagning (ADR-83, ADR-87,
 * `docs/utveckling/k-troskeln.md` avsnitt 2).
 *
 * Tre allmänna regler för delar av en total, där totalen skrivs ut och delarna har ett medelvärde var:
 *  - `kompletterandeUndertryckning`: vilka visade delar vars medelvärden också ska undertryckas, så att totalen minus
 *    de visade delarna aldrig ger medelvärdet för färre än k personer. Används av tabellerna per BAS-intervall.
 *  - `sammanslagning`: vilka delar som ska räknas samman till en, så att varje del har 0 eller minst k personer av
 *    varje kön. Används där delarnas medelvärden inte står var för sig men går att räkna fram ur ett ekvationssystem
 *    (uppdelningen av löneskillnaden och huvudområdenas andel av den): när varje del har 0 eller minst k av varje kön
 *    är allt som går att räkna fram ett medel för minst k personer av ett kön, eller en vägd summa av sådana.
 *  - `kompletterandeUndertryckningPerNyckel`: samma regel som den första mellan tabeller, där totalerna står i några
 *    och delarna, med samma nyckel, i en annan (JPA-protokollets blad 2 mot bladet 3 och tabellerna per
 *    BAS-intervall, ADR-91).
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
 * alla delar väljs alla, och bara totalen har ett medelvärde. Delar utan personer (n ≤ 0) väljs aldrig, och inte heller
 * en del som är `fast` (dess medelvärde står i en annan tabell och går inte att undertrycka här).
 *
 * Antal och andelar berörs inte (ADR-70), och medianer och percentiler inte heller (de går inte att dela upp).
 * @param {Array<{n:number, dold?:boolean, fast?:boolean, namn?:string}>} delar
 * @param {number} k
 * @returns {number[]} index i `delar` för de visade delar som ska undertryckas, i den ordning de valdes
 */
export function kompletterandeUndertryckning(delar, k) {
    let dolda = 0;
    for (const d of delar) if (d.dold) dolda += d.n;
    if (dolda <= 0 || dolda >= k) return [];
    const kandidater = delar.map((d, i) => ({ n: d.n, namn: String(d.namn ?? ''), i }))
        .filter(d => !delar[d.i].dold && !delar[d.i].fast && d.n > 0)
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

/**
 * Kompletterande undertryckning mellan tabeller (ADR-91): totaler per nyckel (till exempel BAS-intervall) i några
 * tabeller och delar med samma nyckel i en annan, med antal och medelvärde per kön. Delarna behöver inte täcka totalen:
 * resten är totalens personer som ingen del med synligt medelvärde har. För varje total och varje mått den redovisar
 * (`nKv` för kvinnornas medelvärde, `nMa` för männens, `n` för allas) får resten inte vara 1 till k − 1 personer,
 * eftersom totalen minus de visade delarna då ger restens medelvärde. Annars undertrycks medelvärdena för den minsta
 * visade delen, och så vidare (`kompletterandeUndertryckning`). En undertryckt del förlorar båda könens medelvärden,
 * eftersom en tabell som har det ena könets medelvärde och skillnaden ger det andra; den räknas därför till resten för
 * båda könen, och reglerna prövas om tills inget ändras. Totalerna berörs inte: de betyder det de betydde.
 *
 * En total utan nyckel (`nyckel: null`) är hela underlaget och paras med alla delar. En del vars medelvärde för alla
 * står i en annan tabell (`allaSyns`) är visad för måttet `n` också när dess medelvärden per kön undertrycks, och den
 * kan inte undertryckas för det måttet här; den tabellen har sin egen regel (ADR-83).
 *
 * Antal och andelar berörs inte (ADR-70), och medianer och percentiler inte heller.
 * @param {Array<{nyckel:string|null, nKv?:number, nMa?:number, n?:number}>} totaler  totalerna och de mått de redovisar
 * @param {Array<{nyckel:string, nKv:number, nMa:number, n?:number, namn?:string, dold?:boolean, allaSyns?:boolean}>} delar
 *   `dold`: delens medelvärden per kön står redan inte; `n` är antalet för alla (standard nKv + nMa)
 * @param {number} k
 * @returns {number[]} index i `delar` för de delar vars medelvärden också ska undertryckas, stigande
 */
export function kompletterandeUndertryckningPerNyckel(totaler, delar, k) {
    const dold = delar.map(d => !!d.dold), ut = new Set();
    const antal = (d, matt) => (matt === 'n' ? d.n ?? d.nKv + d.nMa : d[matt]);
    for (let andrad = true; andrad;) {
        andrad = false;
        for (const t of totaler) {
            for (const matt of /** @type {const} */ (['nKv', 'nMa', 'n'])) {
                if (typeof t[matt] !== 'number') continue;   // totalen redovisar inte måttet
                const fast = i => matt === 'n' && !!delar[i].allaSyns;
                const visade = delar.flatMap((d, i) => ((t.nyckel == null || d.nyckel === t.nyckel) && (!dold[i] || fast(i)) ? [i] : []));
                if (!visade.length) continue;
                const rest = t[matt] - visade.reduce((s, i) => s + antal(delar[i], matt), 0);
                if (rest <= 0 || rest >= k) continue;
                const val = kompletterandeUndertryckning([...visade.map(i => ({ n: antal(delar[i], matt), namn: delar[i].namn, fast: fast(i) || dold[i] })), { n: rest, dold: true }], k);
                for (const j of val) { dold[visade[j]] = true; ut.add(visade[j]); andrad = true; }
            }
        }
    }
    return [...ut].sort((a, b) => a - b);
}

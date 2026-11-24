// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
/**
 * Öppen lönekartläggning — urvalet i JPA-protokollet (protokollet för gemensam lönebedömning, ADR-79, ADR-91).
 *
 * Vilka AID-etiketter som står i blad 2 (lika arbete) och vilka BAS-intervall som står i blad 3 (likvärdigt arbete),
 * hur många som utelämnats och av vilket skäl, och vilka lönenivåer per kön som får stå (S4,
 * `docs/utveckling/k-troskeln.md` avsnitt 2, *Lönenivåerna i JPA-protokollet*). Bladens uppställning görs i
 * `src/app/24-excelexport.js`.
 */
import { bhJustera } from './stat.js';
import { perBasSignal } from './status.js';
import { kompletterandeUndertryckningPerNyckel } from './undertryckning.js';

/** Fyra tankstreck: ett lönemått per kön som inte får stå. */
export const JPA_DOLD = Object.freeze(['—', '—', '—', '—']);

/**
 * Cellerna för ett lönemått per kön: kvinnor, män, differens (kr) och kvinnors i % av mäns. Bara för en grupp där
 * båda könen når tröskeln `k` (S4); annars fyra tankstreck.
 * @param {number} kv @param {number} ma @param {number} nKv @param {number} nMa @param {number} k
 * @returns {(number|string)[]}
 */
export function jpaNivaCeller(kv, ma, nKv, nMa, k) {
    if (!(nKv >= k && nMa >= k) || !isFinite(kv) || !isFinite(ma) || !(ma > 0)) return [...JPA_DOLD];
    return [Math.round(kv), Math.round(ma), Math.round(kv - ma), +(kv / ma * 100).toFixed(1)];
}

/**
 * Urvalet i protokollets blad 2 och 3.
 *
 * Blad 2: Lika arbetes grupper (`lika`, ur `laLikaGrupper`) med statusen Värt att granska (ADR-59), mest negativa
 * skillnaden först, med medianerna och medelvärdena per kön. Blad 3: BAS-intervall (`perBas`, regressionen per
 * intervall) där skillnaden är säkerställd också efter korrigering för många tester (Benjamini–Hochberg över
 * intervallen med status ok och ändligt p-värde, q < 0,05) och minst 3 %, som regressionskortet och Att göra (ADR-71).
 *
 * Kompletterande undertryckning mellan bladen (ADR-91): intervallets medelvärde per kön i blad 3 minus gruppernas i
 * samma intervall i blad 2 får inte ge medelvärdet för 1 till k − 1 personer av ett kön. Annars döljs medelvärdena för
 * den minsta gruppen i blad 2, och så vidare; intervallets rad och medianerna står kvar.
 *
 * @param {{ grupper: any[], utelamnade: any[], ejJamforbara: any[] }} lika
 * @param {any[]} perBas
 * @param {{ k: number }} opts
 */
export function jpaUrval(lika, perBas, { k }) {
    const jamforda = lika.grupper.filter(g => !g.samladMedian);
    const yrken = jamforda.filter(g => g.niva === 'granska').map(g => ({
        yrke: g.yrke, bas: g.bas, nKv: g.nKv, nMa: g.nMa, tot: g.tot,
        medKv: Math.round(g.medKv), medMa: Math.round(g.medMa),
        // Negativ = kvinnor lägre. En enda avrundning, som i konsMedianer, och ingen före cellens: 34 059 mot 40 000 är
        // 85,1475 % och står som 85,1 (avrundat till två decimaler först blev det 85,2).
        gapPct: (g.medKv - g.medMa) * 100 / g.medMa,
        diffKr: Math.round(g.medKv - g.medMa), direktiv: g.direktiv,
        // Medelvärdet redovisas bredvid medianen (ADR-79); urvalet och statusen bestäms av medianen.
        medel: jpaNivaCeller(g.medelKv, g.medelMa, g.nKv, g.nMa, k)
    }));
    yrken.sort((a, b) => a.gapPct - b.gapPct);   // mest negativa (mest kritiska) först

    const okTester = perBas.filter(b => b.status === 'ok' && isFinite(b.pValue));
    const qVarden = bhJustera(okTester.map(b => b.pValue));
    const bhQ = new Map(okTester.map((b, i) => [b, qVarden[i]]));
    const exkluderade = {
        yrkenMaskerade: lika.grupper.filter(g => g.samladMedian).length + lika.utelamnade.length + lika.ejJamforbara.length,
        yrkenEjBedomda: jamforda.filter(g => g.niva === 'ejbedomd').length,
        yrkenOjamn: jamforda.filter(g => g.niva === 'folj' || g.niva === 'balanserat').length,
        basMaskerade: 0, basSingular: 0, basUnderTroskel: 0
    };
    const bas = [];
    for (const b of perBas) {
        if (b.status === 'too_few') { exkluderade.basMaskerade++; continue; }
        if (b.status === 'singular') { exkluderade.basSingular++; continue; }
        // Regressionens tal är justerat: samma regel som statusen, ingen direktivmarkering. Ett intervall utan ändligt
        // p-värde har inget q och räknas som inte säkerställt.
        const q = bhQ.get(b);
        if (q == null || perBasSignal(b.gapPct, q < 0.05, b.pValue < 0.05).niva !== 'titta') { exkluderade.basUnderTroskel++; continue; }
        bas.push({ ...b, q });
    }
    bas.sort((a, b) => a.gapPct - b.gapPct);

    const undertryckta = kompletterandeUndertryckningPerNyckel(
        bas.filter(b => b.kvN >= k && b.maN >= k).map(b => ({ nyckel: String(b.bas), nKv: b.kvN, nMa: b.maN })),
        yrken.map(j => ({ nyckel: String(j.bas ?? ''), nKv: j.nKv, nMa: j.nMa, namn: j.yrke, dold: j.medel[0] === JPA_DOLD[0] })), k)
        .map(i => { yrken[i].medel = [...JPA_DOLD]; return yrken[i]; });

    return { yrken, bas, undertryckta, exkluderade };
}

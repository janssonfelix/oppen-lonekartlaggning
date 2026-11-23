// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
/**
 * Öppen lönekartläggning — vymodellen för livscykelanalysen i Ålder & karriär (ADR-99): det som analysen visar utöver
 * modellen själv (livscykelRegression i livscykel.js). Modellens lönenivåer per BAS-intervall vid 25 och 65 år och de
 * intervall som utelämnas under tröskeln, om kurvan för det valda intervallet visas, nyckeltalen som kvoter,
 * mönstret över karriären och jämförelsen med huvudmodellen. Modellens resultat, huvudregressionens resultat och
 * tröskeln är argument: vymodellen räknar ingen regression och minns ingen (ADR-17). Ritfunktionen i
 * src/app/52-livscykel.js (ritaLivscykel) ritar bara det den får och skriver orden.
 */
import { samspelSakerstallt } from './livscykel.js';

/**
 * Modellens lönenivåer per BAS-intervall vid 25 och 65 år. Modellen är en regression över alla intervall: skillnaden i
 * procent är densamma i alla, och nivån kommer ur modellens egen BAS-koefficient (basFaktor), inte ur uppmätta
 * medianer. `n` är antalet personer med lön i intervallet i hela underlaget.
 * @param {any} res livscykelRegression
 * @param {any[]} rader hela underlaget
 */
export function livscykelBasRader(res, rader) {
    const sista = res.predKvinna.length - 1;
    return res.basList.map(b => {
        const skala = res.basFaktor?.[b] ?? 1.0;
        const kv25 = res.predKvinna[0].lon * skala, kv65 = res.predKvinna[sista].lon * skala;
        const ma25 = res.predMan[0].lon * skala, ma65 = res.predMan[sista].lon * skala;
        return { bas: b, n: rader.filter(r => r.bas === b && r.lon > 0).length, kv25, kv65, ma25, ma65,
            gap25Pct: res.gapAt25, gap65Pct: res.gapAt65,
            gap25Kr: kv25 - ma25, gap65Kr: kv65 - ma65 };   // kvinnor mot män: negativt när kvinnor ligger lägre
    });
}

/**
 * Visas ingen kurva för det valda intervallet? Ja när intervallet har färre än k personer, räknat som tabellens rader,
 * så att tabellen och kurvan följs åt (ADR-70).
 * @param {{fixBas:string}} res @param {Array<{bas:string, n:number}>} basRader @param {number} k
 */
export function livscykelKurvaUtelamnad(res, basRader, k) {
    const fix = (basRader || []).find(r => r.bas === res.fixBas);
    return !!fix && fix.n < k;
}

/**
 * Mönstret över karriären: 'konstant' när samspelet mellan kön och ålder inte är säkerställt, annars 'växande' när
 * kvinnors lön mot mäns sjunker mer än 2 procentenheter mellan 25 och 65 år, 'krympande' när den stiger mer än 2,
 * och 'praktiskt konstant' däremellan. Samma regel för analysen och punkten i Att göra.
 * @param {{gapDelta:number, kvAgePVal:number, kvAge2PVal:number}} res
 */
export function livscykelMonster(res) {
    if (!samspelSakerstallt(res.kvAgePVal, res.kvAge2PVal)) return 'konstant';
    return res.gapDelta < -2 ? 'växande' : res.gapDelta > 2 ? 'krympande' : 'praktiskt konstant';
}

/**
 * Vymodellen för livscykelanalysen.
 * - `basRader`: livscykelBasRader; `visade` och `utelamnade` (namnen) delade vid k; `kurvaUtelamnad`.
 * - `kvot25`, `kvot65`: kvinnors lön i procent av mäns vid 25 och 65 år (100 plus skillnaden).
 * - `samspel`: samspelet är säkerställt; `monster`: livscykelMonster.
 * - `huvud`: huvudregressionens tal att jämföra med (justerat R², skillnad, p, n och antal per kön), null när den
 *   inte kunde skattas; `sammaUrval`: modellerna bygger på lika många kvinnor och män; `adjR2Delta` (procentenheter)
 *   och `mervarde` ('liten' under 1, 'måttlig' under 3, annars 'stor').
 * - `livscykelGapPct`: livscykelmodellens skillnad vid medelåldern, (exp(β_kön) − 1) × 100.
 * @param {any} res livscykelRegression (utan fel)
 * @param {{rader:any[], k:number, huvud:any}} val huvud: huvudregressionens resultat i samma varv (ADR-17)
 */
export function vymodellLivscykel(res, { rader, k, huvud }) {
    const basRader = livscykelBasRader(res, rader);
    const h = huvud && !huvud.error
        ? { adjR2: huvud.adjR2, gapPct: huvud.konPct, p: huvud.pValue, n: huvud.n, nKv: huvud.nKvAnalysed, nMa: huvud.nMaAnalysed } : null;
    const adjR2Delta = h && h.adjR2 != null ? (res.adjR2 - h.adjR2) * 100 : null;
    return {
        basRader,
        visade: basRader.filter(r => !(r.n < k)),
        utelamnade: basRader.filter(r => r.n < k).map(r => r.bas),
        kurvaUtelamnad: livscykelKurvaUtelamnad(res, basRader, k),
        kvot25: 100 + res.gapAt25, kvot65: 100 + res.gapAt65,
        samspel: samspelSakerstallt(res.kvAgePVal, res.kvAge2PVal),
        monster: livscykelMonster(res),
        huvud: h,
        sammaUrval: !h || (h.nKv === res.kvN && h.nMa === res.maN),
        adjR2Delta,
        mervarde: adjR2Delta == null ? null : adjR2Delta < 1 ? 'liten' : adjR2Delta < 3 ? 'måttlig' : 'stor',
        livscykelGapPct: (Math.exp(res.kvCoef) - 1) * 100
    };
}

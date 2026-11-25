// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
/**
 * Öppen lönekartläggning — osäkerheten kring skattningarna.
 *
 *   - organisationensKvotKI, medianKvotKI, medianKvotKIGiltiga: percentil-bootstrapintervallen (95 %) på mediankvoten
 *     kvinnor/män, för hela organisationen (Översikt), per BAS-intervall och åldersgrupp (Lika arbete, Ålder &
 *     karriär) och per grupp (gruppdossiern, rapportunderlaget). Dragningarnas medianer tas ur rangräkning
 *     (bootstrapMedianer i likvardighet.js).
 *   - regressionslinjensBand: 95-procentigt konfidensband kring en enkel regressionslinje (Ålder & karriär).
 *   - styrkeanalys, sigmaInomGrupp, gruppMde: minsta upptäckbara skillnad vid 80 % styrka och α = 0,05.
 *   - extremvarden: löner långt från sitt BAS-intervalls medel på log-skala.
 *   - trattUnderlag: trattdiagrammets grupper, deras slumpens gränser och fältets halva bredd (Lika arbete).
 *   - kvantilBootstrap: intervallen kring kvantilregressionens skattningar (ADR-63).
 *
 * Rena funktioner: raderna, golvet och tröskeln kommer in som argument. Där slump används är generatorn ett val
 * (`rng`); utan den seedas den ur datat (slumpFor), så att resultatet är detsamma varje gång, och dragningarna görs ur
 * sorterade listor, så att det inte beror på radordningen (ADR-86). Percentilintervallet tas
 * med percentilintervall i stat.js. Appens funktioner (raknaBootstrapKI,
 * raknaStyrkeanalys, raknaGruppMDE, linjarRegressionKI, hittaExtremvarden, _laBootstrapGapKI,
 * _laTrattUnderlagRakna, _regKvantilBootstrap) är tunna adaptrar som läser tillståndet och anropar funktionerna här.
 *
 * Inga DOM-/state-beroenden.
 *
 * Bygger på: docs/utveckling/regressionsmodellen.md avsnitt 7 och ADR-86.
 * Beräkningarna står i spårbarhetsmatrisen, docs/utveckling/sparbarhet.md (B4.1, B4.2 och B4.4–B4.8).
 */
import { median, linjarRegression, percentilintervall } from './stat.js';
import { slumpFor } from './rng.js';
import { slumpensGranser } from './status.js';
import { bootstrapMedianer } from './likvardighet.js';
import { kvantilDesign, kvantilregression } from './regression.js';
import { arKvinna, arMan } from './kon.js';
import { konsMedianerUrLoner } from './struktur.js';
import { aidAvRad, namnrader } from './aid.js';

/** Antalet dragningar i intervallet för hela organisationen (Översikt). */
export const B_ORGANISATION = 2000;
/** Antalet dragningar i intervallet per BAS-intervall och per åldersgrupp. */
export const B_PER_GRUPP = 1000;
/** Antalet dragningar i gruppdossierns och rapportunderlagets intervall. */
export const B_DOSSIER = 2000;
/** Minsta antal av vardera könet för ett bootstrapintervall på mediankvoten per grupp. */
export const KVOT_MIN_N = 3;
/** Minsta antal giltiga dragningar (männens median över noll) för att dossierns intervall ska ges. */
export const DOSSIER_MIN_GILTIGA = 20;
/** z för 95 % tvåsidigt: konfidensbandet kring regressionslinjen och trattens fält. */
export const Z_95 = 1.96;
/** Konfidensbandet: minsta antal punkter för en linje med spridning, och antalet punkter längs linjen. */
export const BAND_MIN_N = 3, BAND_STEG = 30;
/** Faktorn i minsta upptäckbara skillnad: 1,96 (α = 0,05 tvåsidigt) + 0,842 (styrka 80 %). */
export const Z_STYRKA = 2.802;
/** Jämn könsfördelning i styrkeanalysen: det mindre könet är minst 40 % av alla. */
export const BALANSGRANS = 0.4;
/** Minsta antal personer för styrkeanalysen. */
export const STYRKA_MIN_N = 10;
/** Minsta antal residualer för σ inom grupp; med färre används spridningen i hela urvalet. */
export const MDE_SIGMA_MIN_RESIDUALER = 20;
/** Gruppens minsta upptäckbara skillnad: under 3 % god, under 7 % godtagbar, annars svag. */
export const MDE_GOD = 3, MDE_GODTAGBAR = 7;
/** Under så många av något kön är gruppen för liten för styrkeuppskattningen. */
export const MDE_FOR_LITEN = 5;
/** Extremvärdesgränsen: avståndet från BAS-intervallets medel på log-skala, i standardavvikelser. */
export const EXTREMVARDE_Z = 3;
/** Trattens σ ur medianens absoluta avvikelse: 1,4826 × MAD är σ vid normalfördelning. */
export const MAD_TILL_SIGMA = 1.4826;
/** Medianens standardfel i förhållande till medelvärdets vid normalfördelning (√(π/2)). */
export const MEDIAN_SE_FAKTOR = 1.2533;
/** Rättningen av trattens normalformel för små grupper: 1 + 0,6 / (det mindre könets antal). */
export const SMA_GRUPPER_RATTNING = 0.6;
/** Kvantilregressionens bootstrap: antalet omsamplingar och största antal personer som intervallet räknas för. */
export const KVANTIL_KI_B = 200, KVANTIL_KI_MAX_N = 2000;

/** Konstanterna ovan i ett objekt, för appen. */
export function osakerhetKonstanter() {
    return Object.freeze({ B_ORGANISATION, B_PER_GRUPP, B_DOSSIER, KVOT_MIN_N, DOSSIER_MIN_GILTIGA, Z_95, BAND_MIN_N, BAND_STEG,
        Z_STYRKA, BALANSGRANS, STYRKA_MIN_N, MDE_SIGMA_MIN_RESIDUALER, MDE_GOD, MDE_GODTAGBAR, MDE_FOR_LITEN, EXTREMVARDE_Z,
        MAD_TILL_SIGMA, MEDIAN_SE_FAKTOR, SMA_GRUPPER_RATTNING, KVANTIL_KI_B, KVANTIL_KI_MAX_N });
}


// ---- Bootstrapintervallen på mediankvoten ----

/**
 * 95-procentigt percentil-bootstrapintervall för mediankvoten kvinnor/män i hela organisationen (Översikt).
 *
 * Metod: B dragningar med återläggning ur vardera könet, mediankvoten per dragning, percentilintervallet (95 %).
 * B = 2000: med B = 600 blev Monte Carlo-variabiliteten på gränserna ~±0,5 pp, vilket märks för gränsfall; variationen
 * minskar med 1/√B, så B = 2000 ger ungefär hälften, på ~50–200 ms vid alla typiska storlekar. Dragningarnas medianer
 * tas ur rangräkning (O(n) per dragning; sortering gav O(B·n log n), flera sekunder vid 20 000 rader), med identiskt
 * resultat. En dragning där männens median inte är positiv ger kvoten 1.
 *
 * Skillnaden i procent (`gapPct`) har verktygets tecken, (kvot − 1) · 100, negativ när kvinnor ligger lägre, som den råa
 * skillnaden den står bredvid (se regressionsmodellen.md avsnitt 1, Tecknet). Gränserna följer kvotens: lo ur kvotens lo.
 * @param {Array<{lon:number, kon:string}>} rader
 * @param {number} golv  minsta antal av vardera könet (statGolv() i appen)
 * @param {{B?: number, rng?: () => number}} [val]  rng: generatorn; utan den seedad ur lönerna
 * @returns {null | {ratio: {point:number, lo:number, hi:number}, gapPct: {point:number, lo:number, hi:number}, B:number}}
 */
export function organisationensKvotKI(rader, golv, { B = B_ORGANISATION, rng } = {}) {
    const d = rader.filter(r => r.lon > 0);
    const kv = d.filter(r => arKvinna(r)).map(r => r.lon);
    const ma = d.filter(r => arMan(r)).map(r => r.lon);
    const km = konsMedianerUrLoner(kv, ma, { k: golv });
    if (!km.konOk) return null;
    const ratios = new Array(B);
    const m = bootstrapMedianer(kv, ma, B, rng || slumpFor(kv, ma));   // seedad ur datat → reproducerbart KI
    for (let b = 0; b < B; b++) {
        const mKv = m.kv[b], mMa = m.ma[b];
        ratios[b] = mMa > 0 ? mKv / mMa : 1;
    }
    ratios.sort((a, b) => a - b);
    const { lag: lo, hog: hi } = percentilintervall(ratios);
    return {
        ratio:  { point: km.medKv / km.medMa, lo, hi },
        gapPct: { point: km.gapPct, lo: (lo - 1) * 100, hi: (hi - 1) * 100 },
        B
    };
}

/**
 * 95-procentigt percentil-bootstrapintervall för kvinnors median i procent av mäns, för en grupp (BAS-intervall,
 * åldersgrupp). En dragning där männens median inte är positiv ger 100.
 * @param {number[]} kvLoner
 * @param {number[]} maLoner
 * @param {{B?: number, rng?: () => number}} [val]  rng: generatorn; utan den seedad ur lönerna
 * @returns {null | {lo:number, hi:number}} null med färre än KVOT_MIN_N av något kön
 */
export function medianKvotKI(kvLoner, maLoner, { B = B_PER_GRUPP, rng } = {}) {
    if (kvLoner.length < KVOT_MIN_N || maLoner.length < KVOT_MIN_N) return null;
    const ratios = new Array(B);
    const m = bootstrapMedianer(kvLoner, maLoner, B, rng || slumpFor(kvLoner, maLoner));   // seedad ur datat → reproducerbart KI
    for (let b = 0; b < B; b++) {
        const mKv = m.kv[b], mMa = m.ma[b];
        ratios[b] = mMa > 0 ? (mKv / mMa) * 100 : 100;
    }
    ratios.sort((a, b) => a - b);
    const { lag, hog } = percentilintervall(ratios);
    return { lo: lag, hi: hog };
}

/**
 * Kvinnors median i procent av mäns per grupp (BAS-intervall, åldersgrupp, yrkesgrupp), bara där både kvinnorna och
 * männen är minst k (k-tröskeln, S4). Den enda prövningen mot k för översikten per BAS-intervall, lönegapet per
 * åldersgrupp och löneöversynens grupper före och efter. Kvoten räknas med konsMedianerUrLoner (struktur.js): bara
 * löner över 0 räknas. En grupp utan sådana löner hoppas över, och en grupp där ett kön har färre än k hamnar i `dolda`.
 * @param {Iterable<[any, number[], number[]]>} grupper  [nyckel, kvinnornas löner, männens löner], i visningsordning
 * @param {{k: number, ki?: boolean}} val  ki: med medianKvotKI (B_PER_GRUPP) i `ci`
 * @returns {{visade: Array<{nyckel: any, nKv: number, nMa: number, medKv: number, medMa: number, gap: number, ci?: null | {lo: number, hi: number}}>, dolda: any[]}}
 */
export function konskvotPerGrupp(grupper, { k, ki = false }) {
    const visade = [], dolda = [];
    for (const [nyckel, kv, ma] of grupper) {
        const km = konsMedianerUrLoner(kv, ma, { k });
        if (!km.nKv && !km.nMa) continue;
        if (!km.konOk) { dolda.push(nyckel); continue; }
        visade.push({ nyckel, nKv: km.nKv, nMa: km.nMa, medKv: km.medKv, medMa: km.medMa, gap: km.kvotPct, ...(ki ? { ci: medianKvotKI(kv, ma) } : {}) });
    }
    return { visade, dolda };
}

/**
 * Som medianKvotKI, men dragningar där männens median inte är positiv räknas inte, och intervallet ges bara när minst
 * DOSSIER_MIN_GILTIGA dragningar återstår (gruppdossiern och rapportunderlaget).
 * @param {number[]} kvLoner
 * @param {number[]} maLoner
 * @param {{B?: number, rng?: () => number}} [val]  rng: generatorn; utan den seedad ur lönerna
 * @returns {null | {lo:number, hi:number}}
 */
export function medianKvotKIGiltiga(kvLoner, maLoner, { B = B_DOSSIER, rng } = {}) {
    if (kvLoner.length < KVOT_MIN_N || maLoner.length < KVOT_MIN_N) return null;
    const ratios = new Array(B);
    const m = bootstrapMedianer(kvLoner, maLoner, B, rng || slumpFor(kvLoner, maLoner));   // seedad ur datat → reproducerbart KI
    for (let b = 0; b < B; b++) {
        const mMa = m.ma[b];
        ratios[b] = mMa > 0 ? (m.kv[b] / mMa) * 100 : NaN;
    }
    const ok = ratios.filter(v => isFinite(v)).sort((a, b) => a - b);
    if (ok.length < DOSSIER_MIN_GILTIGA) return null;
    const { lag, hog } = percentilintervall(ok);
    return { lo: lag, hi: hog };
}

// ---- Konfidensbandet kring en regressionslinje ----

/**
 * 95-procentigt konfidensband för en enkel linjär regressionslinje.
 * SE av MEDELPREDIKTIONEN vid x: σ × √(1/n + (x−x̄)²/Σ(xi−x̄)²), där σ² = RSS/(n−2). Ger punkter {x, y, lo, hi}
 * jämnt spridda över [minX, maxX].
 * @param {Array<[number, number]>} data  [x, y]-par
 * @param {number} minX
 * @param {number} maxX
 * @param {number} [steg]  antal punkter (BAND_STEG)
 * @returns {null | Array<{x:number, y:number, lo:number, hi:number}>} null med färre än BAND_MIN_N punkter eller
 *   utan spridning i x
 */
export function regressionslinjensBand(data, minX, maxX, steg = BAND_STEG) {
    const n = data.length;
    if (n < BAND_MIN_N) return null;
    const reg = linjarRegression(data);
    if (!reg) return null;
    const meanX = data.reduce((s, p) => s + p[0], 0) / n;
    let ssX = 0, rss = 0;
    for (let i = 0; i < n; i++) {
        ssX += (data[i][0] - meanX) ** 2;
        const yhat = reg.m * data[i][0] + reg.b;
        rss += (data[i][1] - yhat) ** 2;
    }
    if (ssX <= 0) return null;
    const sigma2 = rss / Math.max(1, n - 2);
    const out = [];
    for (let i = 0; i < steg; i++) {
        const x = minX + (maxX - minX) * (i / (steg - 1));
        const y = reg.m * x + reg.b;
        const se = Math.sqrt(Math.max(0, sigma2 * (1 / n + (x - meanX) ** 2 / ssX)));
        out.push({ x, y, lo: y - Z_95 * se, hi: y + Z_95 * se });
    }
    return out;
}

// ---- Styrkan: minsta upptäckbara skillnad ----

/**
 * Minsta upptäckbara skillnad i procent vid 80 % styrka och α = 0,05:
 * MDE_log ≈ 2,802 · σ_log · √(1/n_kv + 1/n_ma), i procent (e^MDE_log − 1) · 100.
 * @param {number} sigma  σ för log(lön)
 * @param {number} nKv
 * @param {number} nMa
 * @returns {number}
 */
export function mdeProcent(sigma, nKv, nMa) {
    const mdeLog = Z_STYRKA * sigma * Math.sqrt(1 / nKv + 1 / nMa);
    return (Math.exp(mdeLog) - 1) * 100;
}

/**
 * Minsta upptäckbara lönegap (procent) för regressionens könskoefficient vid 80 % styrka och α = 0,05, för hela
 * organisationen (mdeProcent).
 *
 * σ_log är spridningen i log(lön) INOM grupp (sigmaInomGrupp): den poolade standardavvikelsen av residualerna
 * log(lön) − log(gruppens median per kön) över alla yrkesgrupper inom BAS med minst `golv` av varje kön (samma idé som
 * trattdiagrammets σ, trattUnderlag). Spridningen över hela urvalet duger inte: den rymmer skillnaderna mellan
 * BAS-intervallen och överskattar spridningen inom en grupp, så att MDE per grupp blev för stor. Är underlaget för
 * litet (inga grupper når golvet, eller färre än MDE_SIGMA_MIN_RESIDUALER residualer) används hela urvalets σ.
 * @param {Array<{lon:number, kon:string, yrke?:any, bas?:any}>} rader
 * @param {number} golv  minsta antal av vardera könet i en grupp (statGolv() i appen)
 * @returns {null | {n:number, nKv:number, nMa:number, mdePct:number, sigma:number, sigmaKalla:'inomGrupp'|'helaUrvalet',
 *                   sigmaHela:number, sigmaGrupper:number, balanced:boolean}}
 */
export function styrkeanalys(rader, golv) {
    const d = rader.filter(r => r.lon > 0);
    if (d.length < STYRKA_MIN_N) return null;
    const arKv = arKvinna, arMa = arMan;
    const kv = d.filter(arKv).map(r => r.lon);
    const ma = d.filter(arMa).map(r => r.lon);
    if (kv.length < 2 || ma.length < 2) return null;
    // SD av log(lön) över hela urvalet — reserven när underlaget per grupp är för litet
    const allLog = d.map(r => Math.log(r.lon));
    const meanLog = allLog.reduce((s, v) => s + v, 0) / allLog.length;
    const varLog  = allLog.reduce((s, v) => s + (v - meanLog) ** 2, 0) / (allLog.length - 1);
    const sigmaHela = Math.sqrt(varLog);
    const inom = sigmaInomGrupp(d, arKv, arMa, golv);
    const sigma = inom ? inom.sigma : sigmaHela;
    const mdePct = mdeProcent(sigma, kv.length, ma.length);
    const minN = Math.min(kv.length, ma.length);
    const maxN = Math.max(kv.length, ma.length);
    // Jämn könsfördelning enligt verktygets definition: båda könen ≥ 40% av totalen.
    const balanced = minN / (minN + maxN) >= BALANSGRANS;
    return { n: d.length, nKv: kv.length, nMa: ma.length, mdePct, sigma, sigmaKalla: inom ? 'inomGrupp' : 'helaUrvalet',
             sigmaHela, sigmaGrupper: inom ? inom.grupper : 0, balanced };
}

/**
 * Poolad standardavvikelse av residualerna log(lön) − log(gruppens median per kön) över alla grupper (AID-kod i
 * BAS-intervallet, aidAvRad) med minst `golv` av varje kön. Frihetsgraderna är antalet residualer minus två medianer per grupp.
 * @param {Array<{lon:number, yrke?:any, bas?:any}>} d  rader med lön över noll
 * @param {(r: any) => boolean} arKv
 * @param {(r: any) => boolean} arMa
 * @param {number} golv
 * @returns {null | {sigma:number, grupper:number, residualer:number}} null när underlaget är för litet
 */
export function sigmaInomGrupp(d, arKv, arMa, golv) {
    /** @type {Map<string, {kv: number[], ma: number[]}>} */
    const perGrupp = new Map();
    for (const r of d) {
        const kv = arKv(r), ma = arMa(r);
        if (!kv && !ma) continue;
        const nyckel = `${aidAvRad(r)}|${r.bas}`;   // AID-koden i BAS-intervallet, som trattUnderlag
        if (!perGrupp.has(nyckel)) perGrupp.set(nyckel, { kv: [], ma: [] });
        /** @type {{kv: number[], ma: number[]}} */ (perGrupp.get(nyckel))[kv ? 'kv' : 'ma'].push(r.lon);
    }
    const grupper = [...perGrupp.values()].filter(g => g.kv.length >= golv && g.ma.length >= golv);
    if (!grupper.length) return null;
    let summa = 0, antal = 0;
    for (const g of grupper) {
        for (const [loner] of [[g.kv], [g.ma]]) {
            const logMed = Math.log(median(loner));
            for (const v of loner) { summa += (Math.log(v) - logMed) ** 2; antal++; }
        }
    }
    const df = antal - 2 * grupper.length;
    if (antal < MDE_SIGMA_MIN_RESIDUALER || df < 1) return null;
    const sigma = Math.sqrt(summa / df);
    return sigma > 0 ? { sigma, grupper: grupper.length, residualer: antal } : null;
}

/**
 * Minsta upptäckbara skillnad för en undergrupp (yrkesgrupp, BAS-rad) med σ ur styrkeanalysen.
 * @param {number} nKv  antal kvinnor i gruppen
 * @param {number} nMa  antal män i gruppen
 * @param {number|null|undefined} sigma  σ för log(lön)
 * @returns {null | {mdePct:number, level:'good'|'fair'|'poor', tooSmall:boolean}}
 */
export function gruppMde(nKv, nMa, sigma) {
    if (!sigma || nKv < 2 || nMa < 2) return null;
    const mdePct = mdeProcent(sigma, nKv, nMa);
    const level = mdePct < MDE_GOD ? 'good' : mdePct < MDE_GODTAGBAR ? 'fair' : 'poor';
    const tooSmall = nKv < MDE_FOR_LITEN || nMa < MDE_FOR_LITEN;
    return { mdePct, level, tooSmall };
}

// ---- Extremvärden ----

/**
 * Löner som ligger ovanligt långt från sitt BAS-intervalls medel på log-skala (robust mot positivt skev fördelning):
 * z = (log(lön) − μ)/σ inom BAS-intervallet, och |z| ≥ troskel flaggas för manuell granskning (kan vara felinmatning).
 * BAS-intervall med färre än `golv` personer bedöms inte (för få för en spridningsskattning).
 * Könet skrivs 'Kvinna' eller 'Man'; rader utan känt kön finns inte i underlaget (de utesluts vid inläsningen).
 * @param {Array<{lon:number, bas:any, yrke?:any, kon:string, alder?:any, radnr?:any}>} rader
 * @param {number} golv  minsta antal personer i BAS-intervallet (statGolv() i appen)
 * @param {number} [troskel]  z-gränsen (EXTREMVARDE_Z)
 * @returns {Array<{radnr:any, bas:any, yrke:any, kon:string, alder:any, lon:number, groupMedian:number, z:number, diffPct:number}>}
 *   sorterade på |z|, störst först
 */
export function extremvarden(rader, golv, troskel = EXTREMVARDE_Z) {
    const d = rader;
    if (!d.length) return [];
    // Gruppera per BAS, beräkna log-mean + log-SD
    /** @type {Record<string, any[]>} */
    const byBas = {};
    d.forEach((r, idx) => {
        if (!byBas[r.bas]) byBas[r.bas] = [];
        byBas[r.bas].push({ ...r, _idx: idx + 1 });
    });
    /** @type {Array<{radnr:any, bas:any, yrke:any, kon:string, alder:any, lon:number, groupMedian:number, z:number, diffPct:number}>} */
    const results = [];
    Object.entries(byBas).forEach(([_bas, rows]) => {
        if (rows.length < golv) return; // för få för en spridningsskattning
        const logs = rows.map(r => Math.log(r.lon));
        const mean = logs.reduce((s, v) => s + v, 0) / logs.length;
        const variance = logs.reduce((s, v) => s + (v - mean) ** 2, 0) / Math.max(1, logs.length - 1);
        const sd = Math.sqrt(variance);
        if (sd === 0) return;
        const groupMedian = median(rows.map(r => r.lon));
        rows.forEach(r => {
            const z = (Math.log(r.lon) - mean) / sd;
            if (Math.abs(z) >= troskel) {
                results.push({
                    radnr: r.radnr ?? null,
                    bas: r.bas,
                    yrke: r.yrke,
                    kon: arKvinna(r) ? 'Kvinna' : 'Man',
                    alder: r.alder,
                    lon: r.lon,
                    groupMedian,
                    z,
                    diffPct: ((r.lon - groupMedian) / groupMedian) * 100
                });
            }
        });
    });
    results.sort((a, b) => Math.abs(b.z) - Math.abs(a.z));
    return results;
}

// ---- Trattdiagrammets underlag ----

/**
 * Trattdiagrammets grupper (Lika arbete): AID-kod + BAS-intervall ur varje persons egen rad, bara grupper där båda
 * könen når `k`. Varje grupp får kvoten (kvinnors median i % av mäns), slumpens gränser (slumpensGranser i status.js:
 * omkastning, för grupper över 300 personer normalformeln med gruppens egen spridning) och om kvoten ligger utanför.
 * Fältets halva bredd för en grupp med nKv och nMa är 1,96 × 1,2533 × σ × √(1/nKv + 1/nMa) × (1 + 0,6/min(nKv, nMa)),
 * i procent, där σ = 1,4826 × MAD av ln(lön) − ln(könets median i gruppen) över alla grupperna.
 * @param {Array<{lon:number, bas:any, kon:string, aid?:any, yrke?:any}>} rader
 * @param {number} k  minsta antal av vardera könet i en grupp (tröskeln)
 * @returns {null | {sigma:number, halv:(nKv:number, nMa:number) => number, punkter:Array<{nyckel:string, yrke:any, bas:any,
 *   aid:string, n:number, nKv:number, nMa:number, medKv:number, medMa:number, kvot:number, gransLag:number,
 *   gransHog:number, utanfor:boolean}>}} null utan grupper eller utan spridning
 */
export function trattUnderlag(rader, k) {
    /** @type {Map<string, {nyckel:string, yrke:any, bas:any, aid:string, kv:number[], ma:number[], km?:any}>} */
    const perGrupp = new Map();
    // Gruppens namn är texten på flest av dess rader (namnrader), som i resten av verktyget (ADR-89).
    const iGrupp = r => r.lon > 0 && r.bas && (arKvinna(r) || arMan(r));
    const nyckelAv = r => `${String(r.aid || r.yrke || '').trim()}|${r.bas}`;
    const namn = namnrader(rader.filter(iGrupp), nyckelAv);
    for (const r of rader) {
        if (!iGrupp(r)) continue;
        const kv = arKvinna(r);
        const aid = String(r.aid || r.yrke || '').trim(), nyckel = nyckelAv(r);
        if (!perGrupp.has(nyckel)) perGrupp.set(nyckel, { nyckel, yrke: namn.get(nyckel).yrke, bas: r.bas, aid, kv: [], ma: [] });
        /** @type {{kv: number[], ma: number[]}} */ (perGrupp.get(nyckel))[kv ? 'kv' : 'ma'].push(r.lon);
    }
    const grupper = [...perGrupp.values()].filter(g => (g.km = konsMedianerUrLoner(g.kv, g.ma, { k })).konOk);
    if (!grupper.length) return null;
    /** @type {number[]} */
    const rest = [];
    for (const g of grupper) {
        const { medKv, medMa } = g.km;
        for (const v of g.kv) rest.push(Math.log(v) - Math.log(medKv));
        for (const v of g.ma) rest.push(Math.log(v) - Math.log(medMa));
    }
    const sigma = MAD_TILL_SIGMA * median(rest.map(Math.abs));
    if (!(sigma > 0)) return null;
    /** @param {number} nKv @param {number} nMa */
    const halv = (nKv, nMa) => 100 * Z_95 * MEDIAN_SE_FAKTOR * sigma * Math.sqrt(1 / nKv + 1 / nMa) * (1 + SMA_GRUPPER_RATTNING / Math.min(nKv, nMa));
    return { sigma, halv, punkter: grupper.map(g => {
        const { medKv, medMa, kvotPct: kvot } = g.km;
        const grans = slumpensGranser(g.kv, g.ma);
        return { nyckel: g.nyckel, yrke: g.yrke, bas: g.bas, aid: g.aid, n: g.kv.length + g.ma.length, nKv: g.kv.length, nMa: g.ma.length, medKv, medMa, kvot, gransLag: grans.lag, gransHog: grans.hog,
                 utanfor: kvot < grans.lag || kvot > grans.hog }; }) };
}

// ---- Kvantilregressionens intervall ----

/** @param {any} v */
const _nyckeldel = v => (v == null ? '' : typeof v === 'number' ? v : String(v));
/**
 * Den fasta ordningen för kvantilbootstrapens rader: lön, kön, BAS-intervall, ålder och sedan AID, yrke och
 * ansvarsgrupp. Designmatrisen (kvantilDesign) bygger på lön, kön, BAS och ålder; övriga fält tas med så att
 * ordningen är fullständig också för rader som skiljer sig bara där. Tal jämförs som tal, övrigt som text.
 * @param {any} a
 * @param {any} b
 */
function _kvantilRadordning(a, b) {
    for (const f of ['lon', 'kon', 'bas', 'alder', 'aid', 'yrke', 'ansvarsgrupp']) {
        const x = _nyckeldel(a[f]), y = _nyckeldel(b[f]);
        if (x === y) continue;
        if (typeof x === 'number' && typeof y === 'number') return x - y;
        return String(x) < String(y) ? -1 : 1;
    }
    return 0;
}

/**
 * Percentil-bootstrapintervall (95 %) på kvantilregressionens könskoefficient per τ och på skillnaden P90 − P10
 * (ADR-63). Varje omsampling drar n rader med återläggning och bygger designen på nytt ur dem (kvantilDesign), så att
 * referensintervallet är det första som finns i omsamplingen och ett intervall som inte kom med inte ger en
 * nollkolumn; könskoefficienten beror inte på referensen eller centreringen. Ålder centreras på hela urvalets medel,
 * och varje omsampling startar IRLS i hela urvalets lösning (samma kolumn efter namn), vilket bara gör det snabbare.
 * Ett intervall ges när minst hälften av omsamplingarna gav en skattning. IRLS-skattningen är en approximation av
 * kvantillösningen; intervallet bootstrappar approximationen.
 * @param {any[]} rader0  kvantilDesign(...).rader: raderna som punktskattningen räknades på (i vilken ordning som helst)
 * @param {any} modell  förklaringsmodellen
 * @param {Array<{tau:number, error?:boolean, ki?:any}>} results  punktskattningarna; `ki` skrivs in i dem
 * @param {(d: any) => boolean} arKv
 * @param {{B?: number, rng?: () => number}} [val]  rng: generatorn; utan den seedad ur lönerna per kön
 * @returns {{results: Array<any>, diffKi: {lag:number, hog:number}|null, kiB:number, kiUtelamnad:string}}
 */
export function kvantilBootstrap(rader0, modell, results, arKv, { B = KVANTIL_KI_B, rng } = {}) {
    const rnd = rng || slumpFor(rader0.filter(arKv).map(d => d.lon), rader0.filter(d => !arKv(d)).map(d => d.lon));   // seedad ur datat → reproducerbart KI
    // Raderna sorteras på en fast, fullständig nyckel innan dragningen, så att omsamplingarna inte beror på
    // radordningen (ADR-86). Två rader som är lika i nyckeln är utbytbara i designen.
    const raw = [...rader0].sort(_kvantilRadordning);
    const n = raw.length;
    /** @type {number[][]} */
    const prov = results.map(() => []);
    /** @type {number[]} */
    const diffProv = [];
    const i10 = results.findIndex(r => r.tau === 0.1), i90 = results.findIndex(r => r.tau === 0.9);
    // Ålder centreras på hela urvalets medel (könskoefficienten beror inte på centreringen).
    const ageMean = modell.alder ? raw.reduce((s, d) => s + d.alder, 0) / n : undefined;
    // Varje omsampling startar IRLS i hela urvalets lösning (samma kolumn efter namn), vilket bara gör det snabbare.
    const hel = kvantilDesign(raw, modell, { ageMean });
    const helBeta = results.map(r => (r.error ? null : (kvantilregression(hel.X, hel.y, r.tau) || {}).beta || null));
    for (let b = 0; b < B; b++) {
        const urval = new Array(n);
        for (let i = 0; i < n; i++) urval[i] = raw[Math.floor(rnd() * n)];
        const { X, y, kolumner } = kvantilDesign(urval, modell, { ageMean });
        const konPct = results.map((r, k) => {
            if (r.error) return null;
            const b0 = helBeta[k];
            const start = b0 ? kolumner.map(c => { const j = hel.kolumner.indexOf(c); return j >= 0 ? b0[j] : 0; }) : null;
            const fit = kvantilregression(X, y, r.tau, undefined, undefined, start);
            return fit ? (Math.exp(fit.beta[1]) - 1) * 100 : null;
        });
        konPct.forEach((v, k) => { if (v != null) prov[k].push(v); });
        const p10 = i10 >= 0 ? konPct[i10] : null, p90 = i90 >= 0 ? konPct[i90] : null;
        if (p10 != null && p90 != null) diffProv.push(p90 - p10);
    }
    /** @param {number[]} v */
    const intervall = v => {
        v.sort((a, c) => a - c);
        return v.length < B / 2 ? null : percentilintervall(v);
    };
    results.forEach((r, k) => { if (!r.error) r.ki = intervall(prov[k]); });
    return { results, diffKi: intervall(diffProv), kiB: B, kiUtelamnad: '' };
}

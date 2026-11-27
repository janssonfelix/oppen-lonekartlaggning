// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
/**
 * Öppen lönekartläggning — vymodellen för fliken Likvärdigt arbete (ADR-99): det som fliken räknar och bedömer
 * utöver paren själva (likvardighetsparUr i likvardighet.js): resultatet när beräkningen kastar och diagnostiken
 * bara fliken visar, antalet små kvinnodominerade grupper vid tröskeln, poängläget och jämförelsekällorna, om
 * jämförelsen kan genomföras, antalen och det största paret i flikens topp, parets säkerhet och varför den
 * åldersjusterade skillnaden saknas, om inställningarna är anpassade, diagrammet Krav mot lön (grupperna med
 * minst k, nivån kraven brukar ge, avståndet, placeringen i sidled och vilka som får namn) och raderna i diagrammet
 * över kandidatparen. Tröskeln och inställningarna är argument; ritfunktionerna i src/app/34-likvardigt-arbete.js
 * ritar bara det de får och skriver orden. Fliken redovisar grupper under tröskeln (undantaget, k-troskeln.md §4);
 * tröskeln gäller bara diagrammet Krav mot lön och räkningen av små grupper i diagnostiken.
 */
import { basRangordning, KVINNO_TROSKEL_STANDARD, kravGrupper, parAntal } from './likvardighet.js';
import { linjarRegression, median } from './stat.js';
import { svPct } from './talformat.js';

/** Inställningarnas utgångsläge, samma som state.likvardighet i src/app/12-tillstand.js. */
export const LV_STANDARD = Object.freeze({ kvinnoTrosholdPct: KVINNO_TROSKEL_STANDARD, kvDomDefinition: 'do', jamforelse: 'alla', minGapPct: 0, topN: 20 });

/**
 * Resultatet när beräkningen kastar: samma form som likvardighetsparUr, utan grupper och par, så att fliken kan visa
 * vad som gick fel i stället för att vara tom.
 * @param {{antalRader:number, antalStatistik:number, poang:boolean, opts:any}} val
 */
export function likvardighetFelresultat({ antalRader, antalStatistik, poang, opts }) {
    return {
        orgKvDom: [], orgIckeKv: [], statIckeKv: [], pairs: [], lagreKrav: [],
        diagnostik: {
            organisation: { totalRader: antalRader, antalAidxBas: 0, kvDomFunna: 0, kvDomMedNLessThanK: 0, ickeKvFunna: 0 },
            statistik: { totalRader: antalStatistik, klass: { kvDom: 0, blandat: 0, ickeKv: 0, oklassificerad: 0 }, klassKalla: { lokal: 0, nationell: 0 } },
            jämförelse: { gemensammaBas: 0, möjligaPar: 0, statHögre: 0, statLägreEllerLika: 0, internaPar: 0, externaPar: 0, basMedExternFallback: 0,
                kravProxy: poang ? 'poäng' : 'bas', kvUtanPoang: 0 },
            fel: []
        },
        opts: { ...opts }
    };
}

/**
 * Diagnostiken som bara fliken visar: de tre första kvinnodominerade grupperna och jämförelsestatistikens tre första
 * jämförelseetiketter som text, om statistiken har egen könsfördelning, och felen. Fyller på resultatet och ger det.
 * @param {any} res
 * @param {{harLokalKonsdata:boolean, fel:string[]}} val
 */
export function kompletteraDiagnostik(res, { harLokalKonsdata, fel }) {
    const d = res.diagnostik;
    d.organisation.exempelKvDom = res.orgKvDom.slice(0, 3).map(g => `${g.aid} (${g.label}) BAS ${g.bas} n=${g.n}`);
    d.statistik.harLokalKonsdata = !!harLokalKonsdata;
    d.statistik.exempelIckeKv = res.statIckeKv.slice(0, 3).map(g => `${g.aid} (${g.label}) BAS ${g.bas} ${svPct(g.kvAndel, 0)}kv`);
    d.fel = fel;
    return res;
}

/** Antalet kvinnodominerade grupper med färre än k personer (de ingår ändå; bara diagnostiken räknar dem). */
export function kvDomUnderK(orgKvDom, k) {
    return (orgKvDom || []).filter(g => g.n < k).length;
}

/** Poängläget: kraven mäts med arbetsvärderingspoäng, och bara organisationens egna jämförs (ADR-76). */
export function lvPoang(result) {
    return result?.diagnostik?.jämförelse?.kravProxy === 'poäng';
}

/** Jämförelsestatistikens jämförelseetiketter som paren kan använda: inga i poängläget (ADR-76). */
export function lvStatJamfor(result) {
    return lvPoang(result) ? [] : result.statIckeKv;
}

/**
 * Antalet par före Visa max-urvalet (likvardighetsparUr: parAntal). Ett resultat utan räkningen (felvägen) räknas ur
 * de par som finns, med samma regel.
 * @param {any} result
 * @returns {{totalt:number, overDirektiv:number, sakra:number}}
 */
export function lvParAntal(result) {
    if (result && result.parAntal) return result.parAntal;
    return parAntal((result && result.pairs) || []);
}

/** Parets säkerhet ur bootstrapintervallet: 'saker' när hela intervallet är över 0, 'slumpfel' annars, null utan intervall. */
export function parSakerhet(p) {
    if (!p.gapCI || p.gapCI.lo == null) return null;
    return p.gapCI.lo > 0 ? 'saker' : 'slumpfel';
}

/**
 * Varför paret saknar åldersjusterad skillnad: 'extern' (jämförelsestatistiken saknar individdata), 'underlag' (för få
 * med ålder eller för liten spridning i jämförelseetiketten), eller null när skillnaden finns.
 */
export function justeradSaknas(p) {
    const j = p.aldersJusterad;
    if (j && isFinite(j.gapPct)) return null;
    return p.jamforKalla !== 'intern' ? 'extern' : 'underlag';
}

/**
 * Vymodellen för fliken, ur resultatet (likvardighetsparUr eller felresultatet).
 * - `orgOk`: lönefil med kvinnodominerade grupper; `internOk`: egna jämförelseetiketter; `statOk`: jämförelsestatistik
 *   med jämförelseetiketter som paren kan använda; `jamforOk`: jämförelsen kan genomföras (kvinnodominerade grupper och
 *   minst en jämförelsekälla).
 * - `antal`: alla par före Visa max; `visaAlla`: det finns fler par än tabellen visar.
 * - `storst`: paret med störst skillnad i procent och dess kvot (det kvinnodominerade yrkets median i % av
 *   jämförelseetikettens), eller null utan par.
 * - `anpassat`: något val skiljer sig från utgångsläget (LV_STANDARD).
 * @param {any} result
 * @param {{harData:boolean, harStatistik:boolean, installningar:{kvinnoTrosholdPct:number, minGapPct:number, topN:number},
 *   definition:string, jamforelse:string}} val
 */
export function vymodellLikvardigtArbete(result, { harData, harStatistik, installningar, definition, jamforelse }) {
    const d = result.diagnostik;
    const poang = lvPoang(result), statJamfor = lvStatJamfor(result);
    const orgOk = harData && d.organisation.kvDomFunna > 0;
    const internOk = d.organisation.ickeKvFunna > 0;
    const statOk = harStatistik && statJamfor.length > 0;
    const jamforOk = orgOk && (internOk || statOk);
    const antal = lvParAntal(result);
    const storstPar = result.pairs.reduce((a, p) => (!a || p.gapPct > a.gapPct ? p : a), null);
    const s = LV_STANDARD, c = installningar;
    return {
        poang, statJamfor, orgOk, internOk, statOk, jamforOk, antal,
        antalAttJamfora: result.orgIckeKv.length + statJamfor.length,
        visaAlla: jamforOk && antal.totalt > result.pairs.length,
        storst: storstPar ? { par: storstPar, kvotPct: storstPar.kvMedian / storstPar.maMedian * 100 } : null,
        anpassat: c.kvinnoTrosholdPct !== s.kvinnoTrosholdPct || c.minGapPct !== s.minGapPct || c.topN !== s.topN
            || definition !== s.kvDomDefinition || jamforelse !== s.jamforelse
    };
}

/**
 * Diagrammet Krav mot lön: en punkt per AID-etikett i BAS-intervallet med minst k personer (kravGrupper), eller
 * { forFa: true } med färre än tre grupper. Nivån kraven brukar ge är med poäng en rät linje (minsta kvadrat över
 * grupperna; utan spridning i poäng medelvärdet och ingen linje), annars medianen av gruppmedianerna per
 * BAS-intervall. Varje punkt får avståndet till nivån i hela kronor; utan poäng flyttas grupper med nästan samma median
 * isär i sidled (`forskjutning`); de tio kvinnodominerade grupper som ligger längst under nivån får namn (`etikett`).
 * `antalUnder` är de kvinnodominerade grupperna under nivån.
 * @param {any[]} rader
 * @param {{k:number, definition?:string, grans?:number, poangByKey?:Map<string, number>|null}} val
 */
export function vymodellKravMotLon(rader, { k, definition, grans, poangByKey }) {
    const { medPoang, grupper, utanPlats } = kravGrupper(rader, { k, definition, grans, poangByKey });
    if (grupper.length < 3) return { forFa: /** @type {const} */ (true) };
    const rang = basRangordning(grupper.map(g => g.bas));
    const basOrdning = [...new Set(grupper.map(g => g.bas))].sort((a, b) => rang(a) - rang(b));
    let niva, linje;
    if (medPoang) {
        const reg = linjarRegression(grupper.map(g => [g.krav, g.median]));
        const medel = grupper.reduce((s, g) => s + g.median, 0) / grupper.length;
        niva = g => (reg ? reg.m * g.krav + reg.b : medel);
        const xs = grupper.map(g => g.krav), a = Math.min(...xs), b = Math.max(...xs);
        linje = reg ? [{ x: a, y: reg.m * a + reg.b }, { x: b, y: reg.m * b + reg.b }] : [];
    } else {
        const perBas = new Map();
        for (const g of grupper) { if (!perBas.has(g.bas)) perBas.set(g.bas, []); perBas.get(g.bas).push(g.median); }
        niva = g => median(perBas.get(g.bas));
        linje = basOrdning.map(bas => ({ bas, y: median(perBas.get(bas)) }));   // en hörnpunkt per intervall: följer urvalet
    }
    // Utan poäng står alla grupper i ett BAS-intervall på samma plats i sidled. Fil 0 i mitten, sedan omväxlande åt
    // höger och vänster; en grupp tar första fil där ingen redan lagd grupp ligger närmare än en tjugondel av lönespannet.
    const sidled = new Map();
    if (!medPoang) {
        const alla = grupper.map(g => g.median), nara = Math.max(1, (Math.max(...alla) - Math.min(...alla)) / 20);
        const filer = [0, 1, -1, 2, -2, 3, -3, 4, -4];
        for (const bas of new Set(grupper.map(g => g.bas))) {
            const lagda = [];
            for (const g of grupper.filter(q => q.bas === bas).sort((p, q) => (p.median - q.median) || String(p.namn).localeCompare(String(q.namn), 'sv'))) {
                const fil = filer.find(f => !lagda.some(o => o.fil === f && Math.abs(o.median - g.median) < nara)) ?? 0;
                lagda.push({ fil, median: g.median });
                if (fil) sidled.set(g, fil * 0.085);
            }
        }
    }
    const under = grupper.filter(g => g.dominans === 'kvinnodominerad' && g.median < niva(g)).sort((p, q) => (p.median - niva(p)) - (q.median - niva(q))).slice(0, 10);
    const punkter = grupper.map(g => ({ ...g, avstand: Math.round(g.median - niva(g)),
        ...(sidled.has(g) ? { forskjutning: sidled.get(g) } : {}), etikett: under.includes(g) }));
    return { forFa: /** @type {const} */ (false), medPoang, basOrdning, linje, punkter, utanPlats,
        antalUnder: punkter.filter(p => p.dominans === 'kvinnodominerad' && p.avstand < 0).length,
        uppskattade: punkter.filter(p => p.uppskattad).length };
}

/**
 * Raderna i diagrammet över kandidatparen: de `max` allvarligaste paren (allvarsindex), ett par per namn och
 * BAS-intervall (det första vinner), och bara par med båda medianerna. Har två rader samma namn står intervallen i
 * namnet: "(BAS C)", eller "(BAS C mot D)" när jämförelseyrket ligger i ett annat intervall.
 * @param {any[]} pairs
 * @param {(p:any) => string} namn
 * @param {number} [max]
 * @returns {{p:any, y:string}[]}
 */
export function kandidatparRader(pairs, namn, max = 14) {
    const top = pairs.slice().sort((a, b) => (b.allvarsindex || 0) - (a.allvarsindex || 0)).slice(0, max);
    const rader = [], sedda = new Set();
    for (const p of top) {
        const y = namn(p), nyckel = `${y}\u0000${p.kvBas}\u0000${p.maBas}`;
        if (!sedda.has(nyckel) && isFinite(p.kvMedian) && isFinite(p.maMedian)) { sedda.add(nyckel); rader.push({ p, y }); }
    }
    const antal = rader.reduce((m, r) => m.set(r.y, (m.get(r.y) || 0) + 1), new Map());
    return rader.map(({ p, y }) => ({ p, y: antal.get(y) > 1 ? `${y} (BAS ${p.kvBas}${p.maBas !== p.kvBas ? ` mot ${p.maBas}` : ''})` : y }));
}

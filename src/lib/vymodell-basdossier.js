// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
/**
 * Öppen lönekartläggning — vymodellen för BAS-dossiern, "Ett BAS-intervall, en sida" (ADR-99): nyckeltalen och läget
 * mot ställningstagandet, yrkesgrupperna (Lika arbetes grupper och status), paren i likvärdigt arbete, medianlönen
 * per åldersgrupp och kön och förra årets rad ur årsbokslutet (ADR-54). Allt som räknas, maskeras och bedöms står här,
 * med tröskeln som argument; paren i likvärdigt arbete och förra årets bokslut kommer som argument. Ritfunktionen i
 * src/app/81-basdossier.js ritar bara det den får, och textversionen (basdossierStycken) läser samma modell.
 */
import { aidAvRad } from './aid.js';
import { bokslutBasRad, bokslutMedGrans, jamforBasIntervall } from './arsbokslut.js';
import { arKvinna, arMan } from './kon.js';
import { konFarRedovisas, parForRedovisning } from './ktroskel.js';
import { aldersgruppNamn } from './perbas.js';
import { likaArbeteGrupper } from './rapportunderlag.js';
import { kvantil, median } from './stat.js';
import { konsMedianer } from './struktur.js';
import { gruppdossierGrupper } from './vymodell-gruppdossier.js';

/** Åldersgrupperna: –34, 35–49, 50– (standardgränserna i bladen per BAS-intervall, perBasStandard i perbas.js; ett
 * recept med andra gränser ändrar inte dossiern). */
export const BASDOSSIER_ALDERSGRANSER = [35, 50];

/**
 * BAS-intervallen som får öppnas i dossiern: minst k personer med lön, i intervallens ordning.
 * @param {any[]} rader
 * @param {string[]} bas  BAS-intervallen i ordning
 * @param {number} k
 */
export function basdossierIntervall(rader, bas, k) {
    return bas.map(b => ({ bas: b, n: rader.filter(r => r.bas === b && r.lon > 0).length })).filter(x => x.n > 0 && x.n >= k);
}

/**
 * Yrkesgruppens status ur likaArbeteGrupper, samma som tabellen i Lika arbete (uppmärksamhetstrappan, ADR-59):
 * 'liten' när könsuppdelningen är för liten (samlad median), annars nivån eller 'ejbedomd'.
 * @param {any} g
 */
export function basdossierStatus(g) {
    if (g.samladMedian) return 'liten';
    return g.niva || 'ejbedomd';
}

/**
 * Vymodellen för ett BAS-intervall, eller null när intervallet saknas eller har färre än k personer.
 * - Nyckeltalen för intervallets personer med lön; kvinnors och mäns median och kvoten bara när båda könen når k
 *   (`konOk`). Mot ställningstagandets rad för intervallet: skillnaden i procent för P10, median och P90.
 * - `yrken`: Lika arbetes grupper i intervallet (AID-koden, ADR-89) med antal, status och medianerna per kön bara när
 *   gruppen inte har samlad median; `ocksaI` är de andra intervall där AID-koden finns, `dossierKey` gruppdossiern när
 *   gruppen når k. `yrkenUtelamnade` och `ejJamforbara` namnger grupperna under k och dem som inte går att jämföra.
 * - `par`: kandidatparen och paren lägre krav, högre lön där det kvinnodominerade yrket ligger i intervallet; par med
 *   en grupp under k räknas i `utelamnade`.
 * - `alder`: per åldersgrupp antal, medianen när gruppen når k och ett köns median bara när båda könen når k; null utan
 *   ålder i lönefilen (ADR-64).
 * - `forra`: intervallets rad ur förra årets bokslut, läst med den högre av filens och den inställda tröskeln och
 *   jämförd med årets rad (bokslutBasRad); `lage` säger varför det inte finns något att jämföra.
 * @param {any[]} rader  hela underlaget
 * @param {string} bas
 * @param {{k:number, basIntervall:string[], golv?:number, kInstalld?:number, referens?:any, referensNamn?:string,
 *   lika?:any, likvardighet?:{pairs?:any[], lagreKrav?:any[]}|null, harAlder?:boolean, forraBokslut?:any}} val
 *   basIntervall: intervallen i ordning; golv: Lika arbetes golv för statusen; kInstalld: den inställda tröskeln
 *   (förra årets rad); referens och referensNamn: ställningstagandets rad för intervallet och dess kortnamn; lika:
 *   Lika arbetes grupper (likaArbeteGrupper) när appen redan räknat dem; likvardighet: resultatet i Likvärdigt arbete
 */
export function vymodellBasdossier(rader, bas, { k, basIntervall, golv = 10, kInstalld = k, referens = null, referensNamn = '', lika,
    likvardighet = null, harAlder = false, forraBokslut = null }) {
    if (!basdossierIntervall(rader, basIntervall, k).some(x => x.bas === bas)) return null;
    const df = rader.filter(r => r.bas === bas && r.lon > 0);
    const lon = df.map(r => r.lon);
    const med = median(lon), p10 = kvantil(lon, 0.10), p90 = kvantil(lon, 0.90);
    const { nKv, nMa, medKv, medMa, kvotPct, konOk } = konsMedianer(df, { k });

    // 1. Läget mot ställningstagandet: referensens rad för BAS-intervallet (inte en yrkesrad).
    const pct = (v, ref) => (v != null && ref > 0 ? (v / ref - 1) * 100 : null);
    const ref = referens ? { namn: referensNamn, p10: referens.p10 ?? null, med: referens.med ?? null, p90: referens.p90 ?? null,
        diffPct: { p10: pct(p10, referens.p10), med: pct(med, referens.med), p90: pct(p90, referens.p90) } } : null;

    // 2. Grupperna i intervallet: Lika arbetes grupper läses direkt, så att dossiern aldrig säger något annat än Lika arbete.
    const lg = lika || likaArbeteGrupper(rader, { k, golv });
    const iBas = g => g.bas === String(bas);
    const basPerYrke = new Map();
    for (const r of rader) { if (!(r.lon > 0)) continue; const kod = aidAvRad(r); if (!basPerYrke.has(kod)) basPerYrke.set(kod, new Set()); basPerYrke.get(kod).add(r.bas); }
    const nycklar = new Set(gruppdossierGrupper(rader, k).map(g => g.key));
    const yrken = lg.grupper.filter(iBas).map(g => {
        const aid = g.aid, delade = !g.samladMedian;
        const ocksaI = [...(basPerYrke.get(aid) || [])].filter(b => b !== bas).sort();
        return { yrke: g.yrke, aid, nKv: g.nKv, nMa: g.nMa, tot: g.tot, status: basdossierStatus(g), samlad: !!g.samladMedian, ocksaI,
            medKv: delade ? g.medKv : null, medMa: delade ? g.medMa : null, kvotPct: delade ? g.kvot * 100 : null,
            medTot: g.samladMedian ? g.medTot : null, dossierKey: nycklar.has(`${aid}|${bas}`) ? `${aid}|${bas}` : null };
    }).sort((a, b) => b.tot - a.tot || String(a.yrke).localeCompare(String(b.yrke), 'sv'));

    // 3. Likvärdigt arbete: kandidatpar och hierarkiska par där det kvinnodominerade yrket ligger i intervallet.
    const a = parForRedovisning(((likvardighet && likvardighet.pairs) || []).filter(p => p.kvBas === bas), k);
    const b = parForRedovisning(((likvardighet && likvardighet.lagreKrav) || []).filter(p => p.kvBas === bas), k);
    const parRad = p => ({ kvLabel: p.kvLabel, kvAid: p.kvAid, kvBas: p.kvBas, kvN: p.kvN, kvMedian: p.kvMedian,
        maLabel: p.maLabel, maAid: p.maAid, maBas: p.maBas, maN: p.maN ?? null, maMedian: p.maMedian, gapKr: p.gapKr, gapPct: p.gapPct });

    // 4. Ålder: medianlön per åldersgrupp och kön; ett köns median bara när båda könen i åldersgruppen når k.
    const G = BASDOSSIER_ALDERSGRANSER;
    const iGrupp = (r, i) => { const lo = i === 0 ? -Infinity : G[i - 1], hi = i < G.length ? G[i] : Infinity; return r.alder >= lo && r.alder < hi; };
    const medAlder = df.filter(r => typeof r.alder === 'number' && r.alder > 0);
    const alder = !harAlder ? null : aldersgruppNamn(G).map((namn, i) => {
        const grupp = medAlder.filter(r => iGrupp(r, i)), gKv = grupp.filter(r => arKvinna(r)), gMa = grupp.filter(r => arMan(r));
        const ok = konFarRedovisas(gKv.length, gMa.length, k);
        return { namn, n: grupp.length, nKv: gKv.length, nMa: gMa.length,
            med: grupp.length && grupp.length >= k ? median(grupp.map(r => r.lon)) : null,
            medKv: ok ? median(gKv.map(r => r.lon)) : null, medMa: ok ? median(gMa.map(r => r.lon)) : null };
    });

    // 5. Förra året: intervallets rad ur förra årets bokslut, jämförd med årets (samma rad som bokslutet bär).
    /** @type {any} */ const fb = forraBokslut ? bokslutMedGrans(forraBokslut, Math.max(forraBokslut.k, kInstalld)) : null;
    /** @type {any} */ let forra = { lage: 'ingetBokslut' };
    if (fb && !Array.isArray(fb.basIntervall)) forra = { lage: 'saknasFalt', ar: fb.ar };
    else if (fb) {
        const f = fb.basIntervall.find(r => r.bas === bas);
        const nu = bokslutBasRad(rader, bas, k);
        const j = f && nu ? jamforBasIntervall([f], [nu]) : null;
        forra = j && j[0] ? { lage: 'ok', ar: fb.ar, rad: j[0] } : { lage: 'saknasIntervall', ar: fb.ar };
    }

    return { bas, n: df.length, nKv, nMa, andelKv: df.length ? nKv / df.length * 100 : null,
        median: med, p10, p90, konOk, medKv, medMa, kvotPct,
        referens: ref, yrken, yrkenUtelamnade: lg.utelamnadeGrupper.filter(iBas).map(g => g.yrke).sort((x, y) => String(x).localeCompare(String(y), 'sv')),
        ejJamforbara: lg.ejJamforbaraGrupper.filter(iBas).map(g => g.yrke),
        par: { kandidat: a.par.map(parRad), hierarkiska: b.par.map(parRad), utelamnade: a.utelamnade + b.utelamnade },
        alder, forra, k };
}

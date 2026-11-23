// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
/**
 * Öppen lönekartläggning — Prioriteringsanalys (ren modell)
 *
 * Grupperar raderna per AID-kod × BAS (samma grupper som jämförelsen och gruppdossiern), beräknar median, könsmedianer (med k-regeln, ADR-12),
 * avvikelse mot en referens, åtgärdskostnad (inkl. PO-påslag och beräkningsperiod, formeln i kostnad.js),
 * status mot trösklar, snabbvinst, bristyrke och det sammanvägda prioriteringsindexet.
 *
 * Modellen tar allt den behöver som parametrar och läser inget globalt tillstånd.
 * Referensen kommer utifrån som funktionen referensFor(aid, bas), så samma modell
 * används för både ställningstagandet och jämförelsestatistiken.
 *
 * Appen får modellen genom lib-speglarna (ADR-8); computePrioritization() i
 * src/app/55-prioritering.js är den tunna adaptern som läser state.
 *
 * Bygger på: verktygets egen modell, docs/utveckling/prioriteringsmodellen.md. Beräkningarna står i docs/utveckling/berakningsregister.md.
 */
import { median, quantile, avrundaSymmetriskt } from './stat.js';
import { aidAvYrke, namnrader } from './aid.js';
import { kostnadsfaktor, kostnadPerAr } from './kostnad.js';
import { arKvinna, arMan } from './kon.js';
import { svPoPct } from './talformat.js';

// Prioriteringsmodellens tal. Alla är verktygets egna val, inte hämtade från någon extern källa.
// Bevisrutan i appen hämtar dem genom prioKonstanter(), så förklaringarna och poängen visar samma tal.
/** Avvikelsen i procent som ger full avvikelsepoäng (sev): över detta tas poängen upp till 100. */
export const AVVIKELSE_TAK = 30;
/** Antalet personer i gruppen som ger full volympoäng (vol). */
export const VOLYM_TAK = 50;
/** Löneskillnaden mellan kvinnor och män i procent som ger full poäng för skillnaden (gap). */
export const GAP_TAK = 15;
/** Riktningsvikten för en grupp under referensen (full vikt). */
export const RIKTNING_UNDER = 1.0;
/** Riktningsvikten för en grupp över referensen (halv vikt). */
export const RIKTNING_OVER = 0.5;
/** Bonusmultiplikatorn för en grupp som markerats som bristyrke. */
export const BRIST_MULTIPLIKATOR = 1.2;
/** Snabb vinst: kostnaden per person och månad ska vara under detta belopp i kronor. */
export const SNABB_VINST_KR = 1500;
/** Snabb vinst: avvikelsen från referensen ska vara större än detta i procent. */
export const SNABB_VINST_AVVIKELSE = 3;
/** Snabb vinst: gruppen ska ha minst detta antal personer (en nedre gräns, ingen övre). */
export const SNABB_VINST_MIN_N = 5;

/** Konstanterna ovan i ett objekt, för appen (spegelns alias måste vara funktioner). */
export function prioKonstanter() {
    return Object.freeze({ AVVIKELSE_TAK, VOLYM_TAK, GAP_TAK, RIKTNING_UNDER, RIKTNING_OVER, BRIST_MULTIPLIKATOR,
        SNABB_VINST_KR, SNABB_VINST_AVVIKELSE, SNABB_VINST_MIN_N });
}

/**
 * Räkneexemplet om könsskillnaden i en grupp: vad skillnaden i medianlön motsvarar per år
 * för gruppens kvinnor, eller null när kvinnornas median inte ligger minst 100 kr lägre (skillnaden avrundas till
 * hundratal, som i diagrammens verktygstips) eller en median saknas. Anroparen skickar bara medianer som får
 * redovisas (båda könen når tröskeln).
 * @param {{medKv: number, medMa: number, nKv: number}} g
 * @param {{months?: number, poPct?: number}|null|undefined} costSettings
 * @param {(v: number) => string} kr  beloppsformat
 * @returns {string|null}
 */
export function arsbeloppMening(g, costSettings, kr) {
    if (!g || !(g.medKv > 0) || !(g.medMa > 0) || !(g.nKv > 0)) return null;
    const diff = avrundaSymmetriskt((g.medMa - g.medKv) / 100) * 100;   // som kronorSkillnad i src/lib/figur.js
    if (diff < 100) return null;
    const { months, poPct: po } = kostnadsfaktor(costSettings);
    const belopp = Math.round(kostnadPerAr(diff, g.nKv, costSettings) / 1000) * 1000;
    return `Räkneexempel: kvinnornas medianlön ligger ${kr(diff)} per månad under männens. För gruppens ${g.nKv} kvinnor motsvarar `
        + `det omkring ${kr(belopp)} per år (${months} månader, PO-påslag ${svPoPct(po)}). Det är ett räkneexempel, `
        + 'inte en kostnadsbedömning: om skillnaden har sakliga skäl bedömer HR.';
}

/**
 * Grunderna för motiveringsförslagen till en prioriteringspost: deterministiska regler över gruppens rader, i den
 * ordning förslagen visas. Texterna skriver appen (generateMotivationSuggestions i src/app/55-prioritering.js).
 *
 * Koderna: `underlag` (ett kön under minsta gruppstorlek), `styrka` (skillnaden under detektionströskeln), `alder`
 * (könens medelålder skiljer minst 3 år), `kvintil` (kvinnor överrepresenterade i lägsta lönekvintilen; kräver
 * kTroskel för båda könen, ADR-12), `brist`, `snabbVinst`, `over` (mer än 5 % över referensen) och `nara`
 * (inom ±naraGrans % av referensen, minst 10 personer).
 *
 * @param {{_rows?: Array<{kon:string, lon:number, alder?:number}>, kvN:number, maN:number, n:number, diffPct:number,
 *          isBrist?:boolean, isQuickWin?:boolean}} item
 * @param {{kInstalld:number, kTroskel:number, mdePct?:number|null, naraGrans:number}} opt
 *        kInstalld: den inställda minsta gruppstorleken; kTroskel: den gällande tröskeln; mdePct: detektionströskeln
 *        i procent (saknas den prövas inte regeln); naraGrans: uppföljningsgränsen i procent (tecknet spelar ingen roll)
 * @returns {Array<{kod:string, type:'warn'|'info'|'ok'|'flag'} & Object>}
 */
export function motiveringsgrunder(item, { kInstalld, kTroskel, mdePct, naraGrans }) {
    const out = [];
    const rows = item._rows || [];
    if (!rows.length) return out;

    // Varningen gäller skattningens säkerhet, inte läget (beslut av produktägaren 2026-10-16; tidigare ett fast 5)
    if (item.kvN < kInstalld || item.maN < kInstalld) out.push({ kod: 'underlag', type: 'warn', kvN: item.kvN, maN: item.maN, k: kInstalld });

    if (mdePct != null && Math.abs(item.diffPct) < mdePct && item.n < 30) out.push({ kod: 'styrka', type: 'info', diffPct: item.diffPct, mdePct });

    const kvAges = rows.filter(r => arKvinna(r)).map(r => r.alder || 0).filter(a => a > 0);
    const maAges = rows.filter(r => arMan(r)).map(r => r.alder || 0).filter(a => a > 0);
    if (kvAges.length >= 3 && maAges.length >= 3) {
        const medelKv = kvAges.reduce((s, v) => s + v, 0) / kvAges.length;
        const medelMa = maAges.reduce((s, v) => s + v, 0) / maAges.length;
        if (Math.abs(medelMa - medelKv) >= 3) out.push({ kod: 'alder', type: 'info', medelKv, medelMa });
    }

    // Lönepositionsmått per kön: kräver tröskeln för båda könen (ADR-12)
    if (item.kvN >= kTroskel && item.maN >= kTroskel) {
        const q1 = quantile(rows.map(r => r.lon), 0.2);
        const andelKv = item.kvN > 0 ? rows.filter(r => arKvinna(r) && r.lon <= q1).length / item.kvN : 0;
        const andelMa = item.maN > 0 ? rows.filter(r => arMan(r) && r.lon <= q1).length / item.maN : 0;
        if (andelKv >= 0.4 && andelKv - andelMa >= 0.2) out.push({ kod: 'kvintil', type: 'flag', andelKv, andelMa });
    }

    if (item.isBrist) out.push({ kod: 'brist', type: 'info' });
    if (item.isQuickWin) out.push({ kod: 'snabbVinst', type: 'ok', n: item.n });
    if (item.diffPct > 5) out.push({ kod: 'over', type: 'info', diffPct: item.diffPct });

    // Ett läge mot referensen, ingen bedömning (A5)
    const nara = Math.abs(naraGrans);
    if (Math.abs(item.diffPct) < nara && item.n >= 10) out.push({ kod: 'nara', type: 'ok', nara });
    return out;
}

/**
 * Prioriteringsindexet för en grupp: riktningsvikt × (avvikelse·vikt + volym·vikt + jämställdhet·vikt),
 * multiplicerat med bristmultiplikatorn. Vikterna normaliseras till summan 100 %.
 * Skala 0–100 (före bristmultiplikatorn).
 *
 * Delpoängen (sev, vol, gap) och multiplikatorerna står på varje post som prioriteringen returnerar.
 *
 * @param {{sevScore:number, volScore:number, gapScore:number, riktningsvikt:number,
 *          bristMultiplier:number, vikter:{avvikelse:number, volym:number, jamstalldhet:number}}} delar
 * @returns {number}
 */
export function prioIndex(delar) {
    const { sevScore, volScore, gapScore, riktningsvikt, bristMultiplier, vikter: w } = delar;
    const wTotal = Math.max(1, w.avvikelse + w.volym + w.jamstalldhet);
    return bristMultiplier * riktningsvikt * (
        sevScore * (w.avvikelse    / wTotal) +
        volScore * (w.volym        / wTotal) +
        gapScore * (w.jamstalldhet / wTotal)
    );
}

/**
 * Bygger prioriteringslistan (sorterad på priorityIndex, störst först).
 *
 * @param {Array<{yrke:string, bas:string, kon:string, lon:number}>} rader
 * @param {Object} opt
 * @param {(aid:string, bas:string) => ({median:number, kalla:string}|null)} opt.referensFor
 *        Referensmedian för gruppen, eller null om gruppen saknar referens.
 * @param {number} opt.kTroskel - minsta antal personer per grupp och per kön (ADR-12)
 * @param {{atgardThreshold:number, akutMinN:number, bevakaThreshold:number, analyseraThreshold:number}} opt.prioConfig
 * @param {{avvikelse:number, volym:number, jamstalldhet:number}} opt.prioWeights
 * @param {{months?:number, poPct?:number}} [opt.costSettings]
 * @param {Set<string>} [opt.bristAids] - AID-koder som markerats som bristyrke
 * @returns {Array<Object>} en post per AID-kod och BAS-intervall: `yrke` är gruppens namn (texten på flest av dess rader),
 *          `aid` AID-koden och `bas` BAS-intervallet
 */
export function prioritera(rader, { referensFor, kTroskel, prioConfig, prioWeights, costSettings, bristAids }) {
    const d = rader || [];
    if (!d.length) return [];

    // En grupp är AID-koden och BAS-intervallet, som i jamforelseRader (jamforelse.js) och gruppdossiern: koden ur
    // aidAvYrke (rader utan kod grupperas på hela texten), och gruppens namn är texten på flest av dess rader
    // (namnrader). Två stavningar av samma etikett ("207011 Handläggare" och "207011 Handläggare, natt") är alltså en grupp.
    const groups = {};
    const namn = namnrader(d, r => `${aidAvYrke(r.yrke)}|${r.bas}`);
    d.forEach(r => {
        const aid  = aidAvYrke(r.yrke);
        const key  = `${aid}|${r.bas}`;
        if (!groups[key]) groups[key] = { yrke: namn.get(key).yrke, aid, bas: r.bas, rows: [] };
        groups[key].rows.push(r);
    });

    const items = [];
    Object.values(groups).forEach(g => {
        // GDPR k-anonymitet: kräver minst kTroskel personer per grupp
        if (g.rows.length < kTroskel) return;

        const lons     = g.rows.map(r => r.lon);
        const med      = median(lons);
        const kvLons   = g.rows.filter(r => arKvinna(r)).map(r => r.lon);
        const maLons   = g.rows.filter(r => arMan(r)).map(r => r.lon);
        // ADR-12: könsjämförelsen kräver kTroskel personer av vartdera könet; annars bara gruppens samlade median.
        const medKv    = kvLons.length >= kTroskel ? median(kvLons) : null;
        const medMa    = maLons.length >= kTroskel ? median(maLons) : null;
        // Skillnaden gånger 100 delat med jämförelsevärdet: en enda avrundning (se diffPct nedan).
        const gapPct   = (medKv && medMa) ? (medKv - medMa) * 100 / medMa : null;

        // Referensvärde (levereras av anroparen)
        const ref = referensFor(g.aid, g.bas);
        const refMedian = ref ? ref.median : null;
        const refSource = ref ? ref.kalla : null;
        if (!refMedian) return; // ingen referens för denna grupp – hoppa över

        const diffKr  = med - refMedian;
        // För löner i hela kronor (en median kan bli en halv krona) är kronskillnaden gånger 100 exakt, så divisionen
        // är den enda avrundningen och en avvikelse som är exakt en procentsats blir exakt den: 38 000 mot 40 000 ger
        // −5, inte −5,000000000000004 som (38 000 / 40 000 − 1) × 100. Då behövs ingen tolerans mot trösklarna
        // nedan: en grupp exakt på gränsen hamnar aldrig bortom den (prövas i tests/prioritering.test.js).
        const diffPct = diffKr * 100 / refMedian;
        // Beräkningsperiod + PO-påslag (sociala avgifter + pensioner)
        // Total kostnad för att lyfta gruppen TILL referensen (endast om under), inklusive PO
        const annualGapTotal = diffKr < 0 ? kostnadPerAr(diffKr, g.rows.length, costSettings) : 0;
        // Total överlönekostnad (för "över"-grupper)
        const annualOverTotal = diffKr > 0 ? kostnadPerAr(diffKr, g.rows.length, costSettings) : 0;

        // Prioriteringsindex med konfigurerbara viktningar
        const sevScore  = Math.min(AVVIKELSE_TAK, Math.abs(diffPct)) / AVVIKELSE_TAK * 100;
        const volScore  = Math.min(VOLYM_TAK, g.rows.length) / VOLYM_TAK * 100;
        const gapScore  = gapPct !== null ? Math.min(GAP_TAK, Math.abs(gapPct)) / GAP_TAK * 100 : 0;
        const riktningsvikt = diffPct < 0 ? RIKTNING_UNDER : RIKTNING_OVER;
        // E: Bristyrke ger en bonus-multiplikator i prioriteringen
        const isBrist = bristAids && bristAids.has(g.aid);
        const bristMultiplier = isBrist ? BRIST_MULTIPLIKATOR : 1.0;
        const priorityIndex = prioIndex({
            sevScore, volScore, gapScore, riktningsvikt,
            bristMultiplier, vikter: prioWeights
        });
        // C: Genomsnittlig revision per anställd (kr/månad) — för snabbavläsning
        const costPerPerson = diffKr < 0 ? Math.abs(diffKr) : 0;
        // B: "Snabb vinst"-flagga — liten kostnad/person men signifikant procentuellt lyft
        const isQuickWin = costPerPerson > 0 && costPerPerson < SNABB_VINST_KR && Math.abs(diffPct) > SNABB_VINST_AVVIKELSE
            && g.rows.length >= SNABB_VINST_MIN_N;

        // Status-kategori (med konfigurerbara tröskelvärden)
        const cfg = prioConfig;
        let status = 'ok';
        if (diffPct < cfg.atgardThreshold && g.rows.length >= cfg.akutMinN) status = 'akut';
        else if (diffPct < cfg.atgardThreshold)                              status = 'atgard';
        else if (diffPct < cfg.bevakaThreshold)                              status = 'bevaka';
        else if (diffPct > cfg.analyseraThreshold)                           status = 'analysera';

        items.push({
            yrke: g.yrke, aid: g.aid, bas: g.bas,
            n: g.rows.length, kvN: kvLons.length, maN: maLons.length,
            median: med, refMedian, refSource,
            diffPct, diffKr, annualGapTotal, annualOverTotal,
            costPerPerson, isQuickWin, isBrist,
            gapPct, medKv, medMa,
            sevScore, volScore, gapScore, riktningsvikt, bristMultiplier,
            priorityIndex,
            status,
            // #13 Behåll referens till rader för motivation-suggestion-engine.
            // Lättviktig kostnad — rader är samma minimerade objekt som finns i state.data.
            _rows: g.rows
        });
    });

    items.sort((a, b) => b.priorityIndex - a.priorityIndex);
    return items;
}

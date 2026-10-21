// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
/**
 * Öppen lönekartläggning — Prioriteringsanalys (ren modell)
 *
 * Grupperar raderna per yrke × BAS, beräknar median, könsmedianer (med k-regeln, ADR-12),
 * avvikelse mot en referens, åtgärdskostnad (inkl. PO-påslag och beräkningsperiod),
 * status mot trösklar, snabbvinst, bristyrke och det sammanvägda prioriteringsindexet.
 *
 * Modellen tar allt den behöver som parametrar och läser inget globalt tillstånd.
 * Referensen kommer utifrån som funktionen referensFor(aid, bas), så samma modell
 * används för både ställningstagandet och jämförelsestatistiken.
 *
 * Appen får modellen genom lib-speglarna (ADR-8); computePrioritization() i
 * src/app/55-prioritering.js är den tunna adaptern som läser state.
 */
import { median } from './stat.js';

/**
 * Ett månadsbelopp per person som belopp per år för `antal` personer, med beräkningsperiod och PO-påslag ur
 * kostnadsinställningarna: |belopp| × månader × (1 + PO) × antal. Prioriteringens åtgärdskostnad och
 * gruppdossierns räkneexempel räknar med samma formel.
 * @param {number} kronorPerManad
 * @param {number} antal
 * @param {{months?: number, poPct?: number}|null|undefined} costSettings
 */
export function kostnadPerAr(kronorPerManad, antal, costSettings) {
    const months = (costSettings && costSettings.months) || 12;
    const poFactor = 1 + ((costSettings && costSettings.poPct) || 0) / 100;
    return Math.abs(kronorPerManad) * months * poFactor * antal;
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
    const diff = Math.round((g.medMa - g.medKv) / 100) * 100;
    if (diff < 100) return null;
    const months = (costSettings && costSettings.months) || 12, po = (costSettings && costSettings.poPct) || 0;
    const belopp = Math.round(kostnadPerAr(diff, g.nKv, costSettings) / 1000) * 1000;
    return `Räkneexempel: kvinnornas medianlön ligger ${kr(diff)} per månad under männens. För gruppens ${g.nKv} kvinnor motsvarar `
        + `det omkring ${kr(belopp)} per år (${months} månader, PO-påslag ${String(po).replace('.', ',')} %). Det är ett räkneexempel, `
        + 'inte en kostnadsbedömning: om skillnaden har sakliga skäl bedömer HR.';
}

/**
 * Prioriteringsindexet för en grupp: riktningsvikt × (avvikelse·vikt + volym·vikt + jämställdhet·vikt),
 * multiplicerat med bristmultiplikatorn. Vikterna normaliseras till summan 100 %.
 * Skala 0–100 (före bristmultiplikatorn).
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
 * @returns {Array<Object>}
 */
export function prioritera(rader, { referensFor, kTroskel, prioConfig, prioWeights, costSettings, bristAids }) {
    const d = rader || [];
    if (!d.length) return [];

    const groups = {};
    d.forEach(r => {
        const aidM = r.yrke.match(/^(\d+)/);
        const aid  = aidM ? aidM[1] : r.yrke;
        const key  = `${r.yrke}|${r.bas}`;
        if (!groups[key]) groups[key] = { yrke: r.yrke, aid, bas: r.bas, rows: [] };
        groups[key].rows.push(r);
    });

    const items = [];
    Object.values(groups).forEach(g => {
        // GDPR k-anonymitet: kräver minst kTroskel personer per grupp
        if (g.rows.length < kTroskel) return;

        const lons     = g.rows.map(r => r.lon);
        const med      = median(lons);
        const kvLons   = g.rows.filter(r => r.kon.includes('kvinna')).map(r => r.lon);
        const maLons   = g.rows.filter(r => r.kon === 'man' || r.kon === 'män').map(r => r.lon);
        // ADR-12: könsjämförelsen kräver kTroskel personer av vartdera könet; annars bara gruppens samlade median.
        const medKv    = kvLons.length >= kTroskel ? median(kvLons) : null;
        const medMa    = maLons.length >= kTroskel ? median(maLons) : null;
        const gapPct   = (medKv && medMa) ? (medKv/medMa - 1) * 100 : null;

        // Referensvärde (levereras av anroparen)
        const ref = referensFor(g.aid, g.bas);
        const refMedian = ref ? ref.median : null;
        const refSource = ref ? ref.kalla : null;
        if (!refMedian) return; // ingen referens för denna grupp – hoppa över

        const diffPct = ((med / refMedian) - 1) * 100;
        const diffKr  = med - refMedian;
        // Beräkningsperiod + PO-påslag (sociala avgifter + pensioner)
        // Total kostnad för att lyfta gruppen TILL referensen (endast om under), inklusive PO
        const annualGapTotal = diffKr < 0 ? kostnadPerAr(diffKr, g.rows.length, costSettings) : 0;
        // Total överlönekostnad (för "över"-grupper)
        const annualOverTotal = diffKr > 0 ? kostnadPerAr(diffKr, g.rows.length, costSettings) : 0;

        // Prioriteringsindex med konfigurerbara viktningar
        const sevScore  = Math.min(30, Math.abs(diffPct)) / 30 * 100;
        const volScore  = Math.min(50, g.rows.length) / 50 * 100;
        const gapScore  = gapPct !== null ? Math.min(15, Math.abs(gapPct)) / 15 * 100 : 0;
        const directionWeight = diffPct < 0 ? 1.0 : 0.5;
        // E: Bristyrke ger en bonus-multiplikator (1.2x) i prioriteringen
        const isBrist = bristAids && bristAids.has(g.aid);
        const bristMultiplier = isBrist ? 1.2 : 1.0;
        const priorityIndex = prioIndex({
            sevScore, volScore, gapScore, riktningsvikt: directionWeight,
            bristMultiplier, vikter: prioWeights
        });
        // C: Genomsnittlig revision per anställd (kr/månad) — för snabbavläsning
        const costPerPerson = diffKr < 0 ? Math.abs(diffKr) : 0;
        // B: "Snabb vinst"-flagga — liten kostnad/person men signifikant procentuellt lyft
        const isQuickWin = costPerPerson > 0 && costPerPerson < 1500 && Math.abs(diffPct) > 3 && g.rows.length >= 5;

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

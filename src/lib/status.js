// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
/**
 * Öppen lönekartläggning — uppmärksamhetstrappan och direktivmarkeringen (ADR-59).
 *
 * Statusen för en skillnad mellan kvinnors och mäns lön sätts på STATISTISK SIGNAL:
 *
 *   Värt att granska  — skillnaden är säkerställd (utanför slumpens gränser, eller ett KI som utesluter lika lön)
 *                       och minst STORLEKSGRANS (3 %, verktygets egen storleksgräns).
 *   Följ upp          — minst 3 % men inte säkerställd, eller säkerställd men under 3 %.
 *   Balanserat        — under 3 % och inte säkerställd.
 *   Går ej att bedöma — något kön är under golvet (statGolv i appen) eller skillnaden kunde inte prövas.
 *
 * Direktivmarkeringen (minst DIREKTIVNIVA, 5 %) är något annat: en märkt markering på den OJUSTERADE medianskillnaden,
 * som visar var den nivå som direktivets regler om gemensam lönebedömning utgår från nås. Den är ingen bedömning och
 * står aldrig på regressionens justerade tal.
 *
 * Slumpens gränser för en grupp är trattdiagrammets: omkastning av könen inom gruppen (1 000 gånger, seedad ur
 * datat), och för en grupp över 300 personer en normalapproximation med gruppens egen spridning.
 *
 * Webbläsarbygget får en AUTO-GENERERAD spegel i src/app/09-lib-speglar.js. Inga DOM-/state-beroenden.
 */
import { median } from './stat.js';
import { rngFor } from './rng.js';

/** Verktygets egen storleksgräns för statusen, i procent av mäns lön. */
export const STORLEKSGRANS = 3;
/** Nivån för direktivmarkeringen på den ojusterade löneskillnaden, i procent. */
export const DIREKTIVNIVA = 5;
/** Antalet omkastningar per grupp, och gruppstorleken över vilken normalapproximationen används. */
export const OMKASTNINGAR = 1000, STOR_GRUPP = 300;

/** Statusens ord och gräns i klartext (färg, ikon och symbol hör till appen, 10-diagramtema.js). */
export const STATUS_ORD = Object.freeze({
    granska: Object.freeze({ serie: 'Värt att granska', grans: 'säkerställd skillnad på minst 3 %' }),
    folj: Object.freeze({ serie: 'Följ upp', grans: 'minst 3 % men inte säkerställd, eller säkerställd men under 3 %' }),
    balanserat: Object.freeze({ serie: 'Balanserat', grans: 'under 3 % och inte säkerställd' }),
    ejbedomd: Object.freeze({ serie: 'Går ej att bedöma', grans: 'för få av ett kön för att pröva skillnaden' })
});

/** Direktivmarkeringens etikett, kolumnrubrik och verktygstips. */
export const DIREKTIV_ETIKETT = '≥ 5 %';
export const DIREKTIV_KOLUMN = 'Ojusterad löneskillnad ≥ 5 %';
export const DIREKTIV_TIPS = 'Direktivets regler om gemensam lönebedömning utgår från en skillnad på minst 5 %; markeringen visar var den nivån nås. Den är inte en bedömning.';

/**
 * Konstanterna i ett objekt, för appen och andra lib-moduler (speglingen exponerar bara funktioner).
 * @returns {{STORLEKSGRANS:number, DIREKTIVNIVA:number, STATUS_ORD:typeof STATUS_ORD, DIREKTIV_ETIKETT:string, DIREKTIV_KOLUMN:string, DIREKTIV_TIPS:string}}
 */
export function statusKonstanter() {
    return { STORLEKSGRANS, DIREKTIVNIVA, STATUS_ORD, DIREKTIV_ETIKETT, DIREKTIV_KOLUMN, DIREKTIV_TIPS };
}

/**
 * Trappans nivå för ett avstånd från lika lön (|100 − kvinnors lön i % av mäns|) och en prövning.
 * @param {number} avstand
 * @param {boolean|null|undefined} sakerstalld  true/false från prövningen; null när den inte kunde göras
 * @returns {'granska'|'folj'|'balanserat'|'ejbedomd'}
 */
export function statusNiva(avstand, sakerstalld) {
    if (typeof avstand !== 'number' || !isFinite(avstand) || typeof sakerstalld !== 'boolean') return 'ejbedomd';
    const stor = Math.abs(avstand) >= STORLEKSGRANS;
    if (sakerstalld && stor) return 'granska';
    if (stor || sakerstalld) return 'folj';
    return 'balanserat';
}

/**
 * Direktivmarkeringen: den ojusterade löneskillnaden (kvinnors median i % av mäns) ligger minst 5 % från lika lön.
 * @param {number|null|undefined} kvotPct
 */
export function direktivMarkering(kvotPct) {
    return typeof kvotPct === 'number' && isFinite(kvotPct) && Math.abs(100 - kvotPct) >= DIREKTIVNIVA - 1e-9;
}

/** Ett konfidensintervall för kvoten (i %) utesluter lika lön (100). null när intervallet saknas. */
export function kiUtesluterLika(ci) {
    if (!ci || !isFinite(ci.lo) || !isFinite(ci.hi)) return null;
    return ci.lo > 100 || ci.hi < 100;
}

// Median med quickselect (muterar bufferten). Samma räkning som appens _quickMedian, så att trattens gränser är
// desamma som förut.
function _snabbMedian(a) {
    const n = a.length;
    if (!n) return 0;
    const select = k => {
        let lo = 0, hi = n - 1;
        while (hi > lo) {
            const mid = (lo + hi) >> 1;
            if (a[mid] < a[lo]) { const t = a[lo]; a[lo] = a[mid]; a[mid] = t; }
            if (a[hi] < a[lo]) { const t = a[lo]; a[lo] = a[hi]; a[hi] = t; }
            if (a[hi] < a[mid]) { const t = a[mid]; a[mid] = a[hi]; a[hi] = t; }
            const pivot = a[mid];
            let i = lo, j = hi;
            while (i <= j) {
                while (a[i] < pivot) i++;
                while (a[j] > pivot) j--;
                if (i <= j) { const t = a[i]; a[i] = a[j]; a[j] = t; i++; j--; }
            }
            if (k <= j) hi = j;
            else if (k >= i) lo = i;
            else return a[k];
        }
        return a[k];
    };
    const k = n >> 1;
    const upper = select(k);
    if (n & 1) return upper;
    let m = a[0];
    for (let i = 1; i < k; i++) if (a[i] > m) m = a[i];
    return (m + upper) / 2;
}

/**
 * Omkastning av könen inom gruppen: de mittersta 95 % av de kvoter (kvinnors median i % av mäns) slumpen ger.
 * @param {number[]} kv
 * @param {number[]} ma
 * @param {number} [B]
 * @returns {{lag:number, hog:number}}
 */
export function omkastningsGranser(kv, ma, B = OMKASTNINGAR) {
    const alla = kv.concat(ma), n = alla.length, nKv = kv.length, rnd = rngFor(kv, ma), kvoter = new Array(B);
    for (let b = 0; b < B; b++) {
        // Ofullständig Fisher–Yates: de första nKv platserna blir ett slumpvis urval utan återläggning.
        for (let i = 0; i < nKv; i++) { const j = i + ((rnd() * (n - i)) | 0), t = alla[i]; alla[i] = alla[j]; alla[j] = t; }
        const mKv = _snabbMedian(alla.slice(0, nKv)), mMa = _snabbMedian(alla.slice(nKv));
        kvoter[b] = mMa > 0 ? mKv / mMa * 100 : 100;
    }
    kvoter.sort((x, y) => x - y);
    return { lag: kvoter[Math.floor(B * 0.025)], hog: kvoter[Math.min(B - 1, Math.floor(B * 0.975))] };
}

/**
 * Slumpens gränser för en grupp: omkastning, och för en grupp över STOR_GRUPP personer normalformeln med gruppens
 * egen spridning (där är formeln rätt, och omkastningens kostnad växer med gruppen).
 * @param {number[]} kv
 * @param {number[]} ma
 * @returns {{lag:number, hog:number}}
 */
export function slumpensGranser(kv, ma) {
    if (kv.length + ma.length <= STOR_GRUPP) return omkastningsGranser(kv, ma);
    const medKv = median(kv), medMa = median(ma);
    const r = [...kv.map(v => Math.abs(Math.log(v) - Math.log(medKv))), ...ma.map(v => Math.abs(Math.log(v) - Math.log(medMa)))];
    const h = 100 * 1.96 * 1.2533 * 1.4826 * median(r) * Math.sqrt(1 / kv.length + 1 / ma.length);
    return { lag: 100 - h, hog: 100 + h };
}

/**
 * Hela bedömningen för en grupp: kvoten, avståndet, prövningen mot slumpens gränser, trappans nivå och
 * direktivmarkeringen. Ett kön under `golv` ger nivån 'ejbedomd' och ingen prövning.
 * @param {number[]} kv
 * @param {number[]} ma
 * @param {{golv?: number, granser?: {lag:number, hog:number}|null}} [val]  `granser` om de redan är räknade
 */
export function bedomSkillnad(kv, ma, { golv = 10, granser } = {}) {
    const medKv = median(kv), medMa = median(ma);
    const kvot = medMa > 0 ? medKv / medMa * 100 : NaN, avstand = Math.abs(100 - kvot);
    const direktiv = direktivMarkering(kvot);
    if (kv.length < golv || ma.length < golv || kv.length < 2 || ma.length < 2 || !isFinite(kvot))
        return { kvot, avstand, sakerstalld: null, niva: /** @type {'ejbedomd'} */ ('ejbedomd'), direktiv, granser: null };
    const gr = granser || slumpensGranser(kv, ma);
    const sakerstalld = isFinite(gr.lag) && isFinite(gr.hog) ? (kvot < gr.lag || kvot > gr.hog) : null;
    return { kvot, avstand, sakerstalld, niva: statusNiva(avstand, sakerstalld), direktiv, granser: gr };
}

/**
 * Per-BAS-signalen i regressionskortet (justerad skillnad): Titta närmare = säkerställd efter korrigering och minst 3 %;
 * Dokumentera = säkerställd under 3 %; Osäkert utslag = bara det råa p-värdet; annars Inget utslag. Ingen
 * direktivmarkering: regressionens tal är justerade.
 * @param {number} skillnadPct
 * @param {boolean} sakerEfterKorrigering
 * @param {boolean} sakerRatt  rå p < 0,05
 * @returns {{niva: 'titta'|'dokumentera'|'osakert'|'inget'}}
 */
export function perBasSignal(skillnadPct, sakerEfterKorrigering, sakerRatt) {
    if (sakerEfterKorrigering) return { niva: Math.abs(skillnadPct) >= STORLEKSGRANS ? 'titta' : 'dokumentera' };
    return { niva: sakerRatt ? 'osakert' : 'inget' };
}

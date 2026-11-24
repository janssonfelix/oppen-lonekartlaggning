// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
/**
 * Öppen lönekartläggning — vymodellen för regressionskortet i Lönestruktur (ADR-99): det kortet räknar och bedömer
 * utöver huvudregressionen själv (huvudregression i regression.js). Stegen så som de får redovisas och de som visas i
 * kortet, förklaringsbudgeten, kronexemplet och andelen av kvinnornas lönesumma, ansvarsraden, signalen och q-värdet
 * per BAS-intervall, BAS-effekterna efter tröskeln, slutsatsen, varningarna om ett begränsat underlag och
 * tolkningen av gapet längs lönefördelningen. Regressionens resultat och tröskeln är argument: vymodellen räknar
 * aldrig regressionen och minns den inte (ADR-17). Ritfunktionen i src/app/51-lika-arbete-regressionskort.js
 * (ritaRegressionskort) ritar bara det den får och skriver orden.
 */
import { arKvinna } from './kon.js';
import { basEffekterForRedovisning, konFarRedovisas, regStegForRedovisning } from './ktroskel.js';
import { STEG_BAS, STEG_YRKE } from './regression.js';
import { bhJustera } from './stat.js';
import { perBasSignal, STORLEKSGRANS } from './status.js';

const STEG_NYCKEL = { [STEG_BAS]: 'bas', '+ Ålder': 'alder', [STEG_YRKE]: 'yrke' };

/**
 * Översätter den oförklarade skillnaden till kronor. Modellen är multiplikativ på log-skalan: kvinnans lön = mannens
 * × (1 + konPct/100), med männens medianlön som referens. En storleksordning som gör procenten begriplig, inte en
 * åtgärdskostnad (den räknas mot individlönerna i Löneöversyn).
 * @param {any} r regressionsresultatet (konPct, medianMa, nKvAnalysed)
 * @returns {null|{refMan:number, refKvinna:number, krMonth:number, krYear:number, krTotalYear:number}}
 */
export function regressionKronor(r) {
    if (!r || typeof r.konPct !== 'number' || !isFinite(r.konPct) || !(r.medianMa > 0)) return null;
    const refMan = r.medianMa;
    const refKvinna = refMan * (1 + r.konPct / 100);
    const krMonth = refMan - refKvinna;          // > 0 när kvinnor ligger under
    return { refMan, refKvinna, krMonth, krYear: krMonth * 12, krTotalYear: krMonth * 12 * (r.nKvAnalysed || 0) };
}

/**
 * Förklaringsbudgeten: hur många procentenheter av den ojusterade skillnaden varje steg tar, i den ordning stegen
 * kommer (ADR-56), och hur mycket som blir kvar. En kontroll som gör skillnaden större (negativt bidrag) flaggas
 * (`anyNegative`) och får ingen andel. Delarna har nyckeln 'bas', 'alder' eller 'yrke'; orden är appens.
 * @param {Array} seqOk stegen med status 'ok', det ojusterade först
 * @returns {null|{g0:number, remaining:number, parts:Array<{key:string, val:number, share:number}>, denom:number,
 *   anyNegative:boolean, remainingShare:number}}
 */
export function forklaringsbudget(seqOk) {
    if (!Array.isArray(seqOk) || seqOk.length < 2) return null;
    const ok = seqOk.filter(s => typeof s.gapPct === 'number');
    if (ok.length < 2 || ok[0].name !== 'Endast kön') return null;
    const g0 = Math.abs(ok[0].gapPct);
    if (!(g0 > 0)) return null;
    /** @type {Array<{key:string, val:number, share:number}>} */
    const parts = [];
    for (let i = 1; i < ok.length; i++) {
        const key = STEG_NYCKEL[ok[i].name];
        if (key) parts.push({ key, val: Math.abs(ok[i - 1].gapPct) - Math.abs(ok[i].gapPct), share: 0 });
    }
    if (!parts.length) return null;
    const last = Math.abs(ok[ok.length - 1].gapPct);
    const anyNegative = parts.some(p => p.val < -0.005);
    const posSum = parts.reduce((s, p) => s + Math.max(0, p.val), 0);
    const denom = Math.max(0.01, posSum + last);
    parts.forEach(p => { p.share = (Math.max(0, p.val) / denom) * 100; });
    return { g0, remaining: last, parts, denom, anyNegative, remainingShare: (last / denom) * 100 };
}

/** Det sista steget i huvudtalet för en förklaringsmodell (ADR-56): steget som räknar in modellens sista variabel. */
export function sistaSteg(m) {
    return m.yrkesgrupp ? STEG_YRKE : m.alder ? '+ Ålder' : m.bas ? STEG_BAS : 'Endast kön';
}

/**
 * Ritas trappan? Bara när alla steg får visas: med det ojusterade steget utelämnat (ett kön under tröskeln, R1) ritas
 * ingen, eftersom en trappa som börjar på steg två skulle låta det utelämnade räknas fram.
 * @param {{steg:Array, utelamnat:boolean}|null} stegUt regStegForRedovisning
 */
export function trappaVisas(stegUt) {
    return !!stegUt && !stegUt.utelamnat && stegUt.steg.filter(s => s.status === 'ok').length >= 2 && stegUt.steg[0].status === 'ok';
}

/**
 * Signalen för ett BAS-intervall i regressionen per intervall: säkerställd kräver både rått p och q under 0,05
 * (Benjamini–Hochberg), storleken prövas mot storleksgränsen (perBasSignal). `q` saknas för ett intervall utan ändligt
 * p-värde, och prövas då inte.
 * @param {{gapPct:number, pValue:number}} p @param {number|undefined} q
 * @returns {'titta'|'dokumentera'|'osakert'|'inget'}
 */
export function perBasNiva(p, q) {
    return perBasSignal(p.gapPct, p.pValue < 0.05 && (q == null || q < 0.05), p.pValue < 0.05).niva;
}

/**
 * Regressionerna per BAS-intervall med q-värdet (Benjamini–Hochberg över intervallen med status ok och ändligt
 * p-värde) och signalen. `antalTester` är antalet sådana intervall; `qPerBas` slår upp q på intervallets namn.
 * @param {any[]|undefined} perBas
 */
export function perBasRegression(perBas) {
    const tester = (perBas || []).filter(p => p.status === 'ok' && isFinite(p.pValue));
    const q = bhJustera(tester.map(t => t.pValue));
    /** @type {Record<string, number>} */
    const qPerBas = {};
    tester.forEach((t, i) => { qPerBas[t.bas] = q[i]; });
    const rader = (perBas || []).map(p => {
        if (p.status !== 'ok') return { ...p };
        const qp = qPerBas[p.bas], niva = perBasNiva(p, qp);
        return { ...p, q: qp, niva, ejEfterKorrigering: niva === 'osakert' && qp >= 0.05 };
    });
    return { rader, qPerBas, antalTester: tester.length };
}

/**
 * Varningarna om ett begränsat underlag (verktygets egna gränser, inte lagens): färre än 50 i modellen, färre än 15
 * observationer per parameter, ett konfidensintervall bredare än 10 procentenheter och färre än 10 av ett kön.
 * @param {any} r
 */
export function tillforlitlighet(r) {
    const obsPerParam = r.n / Math.max(1, r.k);
    const kiBredd = r.konPctHigh != null && r.konPctLow != null ? r.konPctHigh - r.konPctLow : null;
    const minKon = Math.min(r.nKvAnalysed, r.nMaAnalysed);
    return { litetUrval: r.n < 50, faObsPerParam: obsPerParam < 15, obsPerParam,
        brettKi: kiBredd != null && kiBredd > 10, kiBredd, svagKontrast: minKon < 10 };
}

/**
 * Tolkningen av gapet längs lönefördelningen (ADR-63), ur kvantilregressionens skattningar med intervall: 'glastak'
 * när intervallet för P90 − P10 ligger under noll, 'golv' när det ligger över, 'ingen' när det täcker noll,
 * 'utanIntervall' när intervallet inte räknas, annars null. `visas` när minst två skattningar lyckades. `ejKonvergerat`:
 * de kvantiler vars IRLS inte konvergerade inom varvtaket (S2), så att kortet kan säga det.
 * @param {any} qr _regKvantilBerakna i appen: results, diff, kiUtelamnad
 */
export function kvantilVymodell(qr) {
    if (!qr) return { visas: false };
    const giltiga = qr.results.filter(x => !x.error);
    if (giltiga.length < 2) return { visas: false };
    const vid = tau => qr.results.find(x => x.tau === tau);
    const diff = qr.diff || { varde: null, ki: null };
    const harDiff = typeof diff.varde === 'number' && isFinite(diff.varde);
    const tolkning = !harDiff ? null : diff.ki && diff.ki.hog < 0 ? 'glastak' : diff.ki && diff.ki.lag > 0 ? 'golv'
        : diff.ki ? 'ingen' : qr.kiUtelamnad ? 'utanIntervall' : null;
    const ejKonvergerat = giltiga.filter(x => x.konvergerat === false).map(x => x.tau);
    return { visas: true, giltiga, p10: vid(0.1), p50: vid(0.5), p90: vid(0.9), diff, harDiff, tolkning, ejKonvergerat };
}

/**
 * Vymodellen för regressionskortet, ur huvudregressionens resultat. Null när regressionen inte kunde skattas.
 * - `stegUt`: stegen så som de får redovisas (R1); `seqOk`: huvudtalets steg med status ok (yrkesgruppssteget bara när
 *   det är valt, ADR-46); `yrkeVisas`: yrkesgruppssteget visas efter huvudtalet; `stegIKortet`: stegen i kortet;
 *   `visaSteg`: stegen ritas (två, eller ett när det ojusterade är utelämnat); `stegMax`: största skillnaden bland dem,
 *   som stegens bredd räknas mot, så att ett utelämnat steg inte går att läsa ut.
 * - `budget`: förklaringsbudgeten, null när det ojusterade steget är utelämnat; `budgetMedYrke`: budgeten har
 *   yrkesgruppssteget utöver huvudtalet; `trappa`: trappan ritas.
 * - `konOk`, `kronor`, `andelAvLonesumma`: kronexemplet utgår från männens medianlön och står bara när båda könen når k
 *   (R1, C6); andelen är av kvinnornas samlade årslön i modellens urval (lön, och ålder när den finns).
 * - `ansvar`: { fore, efter } när ansvarssteget kunde skattas och huvudtalets sista steg visas (ADR-33).
 * - `niva`: 'titta' (säkerställd och minst storleksgränsen), 'dokumentera' (säkerställd under den) eller 'ingen'.
 * - `perBas`, `basEffekter` (efter k, med noten ur `basEffektNot`), `tillforlitlighet`.
 * @param {any} r huvudregressionens resultat
 * @param {{k:number, rader:any[], medAlder:boolean, basEffektNot:(utelamnade:string[]) => string}} val
 */
export function vymodellRegressionskort(r, { k, rader, medAlder, basEffektNot }) {
    if (!r || r.error) return null;
    const stegUt = regStegForRedovisning(r, k);
    const sista = sistaSteg(r.modell);
    const seqOk = stegUt.steg.filter(s => s.status === 'ok' && (r.modell.yrkesgrupp || s.name !== STEG_YRKE));
    const yrkeVisas = r.yrkesSteg?.status === 'ok' && !r.modell.yrkesgrupp && seqOk.some(s => s.name === sista);
    const stegIKortet = yrkeVisas ? [...seqOk, r.yrkesSteg] : seqOk;
    const budget = stegUt.utelamnat ? null : forklaringsbudget(stegIKortet);
    const konOk = konFarRedovisas(r.nKvAnalysed, r.nMaAnalysed, k);
    const kronor = konOk ? regressionKronor(r) : null;
    const lonesummaKvAr = konOk ? rader.filter(d => d.lon > 0 && (!medAlder || d.alder > 0) && arKvinna(d)).reduce((s, d) => s + d.lon, 0) * 12 : 0;
    const sistaISteg = seqOk[seqOk.length - 1];
    const sakerstalld = r.pValue < 0.05;
    return {
        stegUt, seqOk, yrkeVisas, stegIKortet, sista,
        visaSteg: seqOk.length >= (stegUt.utelamnat ? 1 : 2),
        stegMax: Math.max(...stegIKortet.map(s => Math.abs(s.gapPct)), 0.01),
        budget, budgetMedYrke: !!budget && !r.modell.yrkesgrupp && budget.parts.some(p => p.key === 'yrke'),
        trappa: trappaVisas(stegUt),
        konOk, kronor, andelAvLonesumma: kronor && lonesummaKvAr > 0 ? Math.abs(kronor.krTotalYear) / lonesummaKvAr * 100 : null,
        ansvar: r.ansvarSteg?.status === 'ok' && sistaISteg?.name === sista ? { fore: sistaISteg.gapPct, efter: r.ansvarSteg.gapPct } : null,
        sakerstalld, niva: !sakerstalld ? 'ingen' : Math.abs(r.konPct) >= STORLEKSGRANS ? 'titta' : 'dokumentera',
        perBas: perBasRegression(r.perBas),
        basEffekter: basEffekterForRedovisning(r, k, basEffektNot),
        tillforlitlighet: tillforlitlighet(r)
    };
}

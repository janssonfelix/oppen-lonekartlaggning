// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
/**
 * Öppen lönekartläggning — Strukturanalys & EU-rapportmått
 *
 * Rena funktioner för representation/segregation, kvartilfördelning (EU
 * 2023/970 Art. 9), distributionellt gap (sticky floor vs glass ceiling),
 * mediangap och direktivets tecken på gapet (tillDirektivtecken). Separat från appen för Vitest.
 * Inga DOM-/state-beroenden.
 *
 * Bygger på: verktygets egen modell; tecknet i docs/utveckling/regressionsmodellen.md avsnitt 1.
 * Beräkningarna står i spårbarhetsmatrisen, docs/utveckling/sparbarhet.md (B2.1–B2.5).
 */

import { median as _median, kvantil as _kvantil } from './stat.js';
import { arKvinna, arMan } from './kon.js';
import { konFarRedovisasFor } from './ktroskel.js';


/**
 * Kvinnors och mäns medianlön och kvoten mellan dem: det enda stället där verktygets centrala mått räknas. Bara rader
 * med lön över 0 räknas. `konOk` är att båda könen har minst max(1, k) personer (k-anonymitet: annars pekar måtten ut
 * de få i det mindre könet); medianerna, kvoten (kvinnors median i procent av mäns) och gapet (kvoten minus 100) är
 * null när konOk är falskt. Antalen står alltid kvar. Anroparen i appen skickar gällande tröskel; standardvärdet 1
 * finns för enhetstesterna.
 * @returns {{nKv:number, nMa:number, medKv:number, medMa:number, kvotPct:number, gapPct:number, konOk:true}
 *         | {nKv:number, nMa:number, medKv:null, medMa:null, kvotPct:null, gapPct:null, konOk:false}}
 */
export function konsMedianer(rader, { k = 1 } = {}) {
    const kv = [], ma = [];
    (rader || []).forEach(r => { if (arKvinna(r)) kv.push(r.lon); else if (arMan(r)) ma.push(r.lon); });
    return konsMedianerUrLoner(kv, ma, { k });
}

/**
 * Som konsMedianer, för den som redan har delat lönerna efter kön: kvinnornas och männens löner var för sig. Samma
 * regel: bara löner över 0 räknas, och konOk kräver minst max(1, k) av vardera könet.
 * @param {number[]} kvLoner
 * @param {number[]} maLoner
 * @param {{k?: number}} [val]
 * @returns {ReturnType<typeof konsMedianer>}
 */
export function konsMedianerUrLoner(kvLoner, maLoner, { k = 1 } = {}) {
    const kv = (kvLoner || []).filter(v => v > 0), ma = (maLoner || []).filter(v => v > 0);
    const konOk = kv.length >= Math.max(1, k) && ma.length >= Math.max(1, k);
    if (!konOk) return { nKv: kv.length, nMa: ma.length, medKv: null, medMa: null, kvotPct: null, gapPct: null, konOk };
    // Bara löner över 0 räknas, så mäns median är alltid över 0 här.
    const medKv = _median(kv), medMa = _median(ma);
    return { nKv: kv.length, nMa: ma.length, medKv, medMa, kvotPct: medKv / medMa * 100, gapPct: (medKv / medMa - 1) * 100, konOk };
}

/**
 * Mediangapet kvinnor vs män (%), null om något kön saknas — eller har färre än `k` personer
 * (k-anonymitet: gapet pekar annars ut de få i det mindre könet). Se konsMedianer.
 */
export function medianGapPct(rader, { k = 1 } = {}) {
    return konsMedianer(rader, { k }).gapPct;
}

/**
 * Representation/segregation per BAS-nivå. Sorteras BAS A–Ö (lägst värderad nivå
 * först) — om andelen kvinnor sjunker mot högre BAS finns vertikal segregering.
 *
 * `k` är minsta antal per kön för att könsuppdelade mått ska lämnas ut (k-anonymitet): har
 * ett kön färre, blir medianKv, medianMa och gapPct null och `konLitet` sant. BAS:ets samlade
 * median och antalen står kvar — om BAS:et som helhet får redovisas avgör anroparen på `n`.
 * @returns {Array<{bas,n,nKv,nMa,andelKv,median,medianKv,medianMa,gapPct,konLitet}>}
 */
export function representationPerBas(rader, { k = 1 } = {}) {
    const minst = Math.max(1, k);
    const m = new Map();
    (rader || []).forEach(r => {
        if (!(r.lon > 0)) return;
        let g = m.get(r.bas);
        if (!g) { g = { bas: r.bas, lons: [], kvLons: [], maLons: [], nKv: 0, nMa: 0, n: 0 }; m.set(r.bas, g); }
        g.lons.push(r.lon); g.n++;
        if (arKvinna(r)) { g.kvLons.push(r.lon); g.nKv++; }
        else if (arMan(r)) { g.maLons.push(r.lon); g.nMa++; }
    });
    return [...m.values()].map(g => {
        // Båda könen finns, men minst ett är för litet för en könsjämförelse.
        const konLitet = g.kvLons.length > 0 && g.maLons.length > 0 && (g.kvLons.length < minst || g.maLons.length < minst);
        const visaKv = g.kvLons.length >= minst && !konLitet, visaMa = g.maLons.length >= minst && !konLitet;
        return {
            bas: g.bas, n: g.n, nKv: g.nKv, nMa: g.nMa,
            andelKv: g.n ? 100 * g.nKv / g.n : 0,
            median: _median(g.lons),
            medianKv: visaKv ? _median(g.kvLons) : null,
            medianMa: visaMa ? _median(g.maLons) : null,
            gapPct: konsMedianerUrLoner(g.kvLons, g.maLons, { k: minst }).gapPct,
            konLitet
        };
    }).sort((a, b) => String(a.bas).localeCompare(String(b.bas), 'sv'));   // BAS A–Ö, som i övriga verktyget
}

/**
 * Kvartilfördelning (EU 2023/970 Art. 9f): dela arbetsstyrkan i fyra lika stora
 * lönekvartiler (Q1 = lägst) och redovisa andel kvinnor/män i varje.
 *
 * Gränserna mellan kvartilerna är mittpunkten mellan högsta lönen i den lägre och
 * lägsta i den högre kvartilen. Kvartilernas yttre löner redovisas inte: Q1:s lägsta
 * och Q4:s högsta är organisationens lägsta och högsta enskilda lön. Q1 har ingen undre gräns, Q4 ingen övre.
 *
 * `k`: har ett kön färre än k personer i hela urvalet lämnas könsfördelningen per kvartil
 * inte ut (nKv, nMa och andelKv blir null, `konDolt` sant) — tre män i Q4 säger var just de
 * tjänar. Antal per kvartil och gränserna står kvar.
 * @returns {Array<{q:number, n:number, nKv:number|null, nMa:number|null, andelKv:number|null, undre:number|null, ovre:number|null, konDolt:boolean}>}
 */
export function kvartilfordelning(rader, { k = 1 } = {}) {
    const all = (rader || []).filter(r => r.lon > 0).slice().sort((a, b) => a.lon - b.lon);
    const n = all.length;
    if (n < 4) return [];
    /** @type {Array<{q:number, n:number, nKv:number, nMa:number, undre:number|null, ovre:number|null}>} */
    const out = [1, 2, 3, 4].map(q => ({ q, n: 0, nKv: 0, nMa: 0, undre: null, ovre: null }));
    /** @type {Array<number|null>} */ const lo = [null, null, null, null];
    /** @type {Array<number|null>} */ const hi = [null, null, null, null];
    all.forEach((r, i) => {
        const q = Math.min(3, Math.floor(i * 4 / n));
        const o = out[q];
        o.n++; if (arKvinna(r)) o.nKv++; else if (arMan(r)) o.nMa++;
        if (lo[q] == null) lo[q] = r.lon;
        hi[q] = r.lon;
    });
    for (let q = 0; q < 3; q++) {
        const grans = ((hi[q] ?? 0) + (lo[q + 1] ?? 0)) / 2;   // n ≥ 4: varje kvartil har minst en person
        out[q].ovre = grans; out[q + 1].undre = grans;
    }
    const totKv = out.reduce((s, o) => s + o.nKv, 0), totMa = out.reduce((s, o) => s + o.nMa, 0);
    const konDolt = k > 1 && (totKv < k || totMa < k);
    return out.map(o => ({
        q: o.q, n: o.n,
        nKv: konDolt ? null : o.nKv, nMa: konDolt ? null : o.nMa,
        andelKv: konDolt ? null : (o.n ? 100 * o.nKv / o.n : 0),
        undre: o.undre, ovre: o.ovre, konDolt
    }));
}

/**
 * Distributionellt gap: lönegapet vid olika percentiler. Större gap i toppen =
 * glastak; större i botten = sticky floor.
 *
 * `k` är minsta antal per kön (k-anonymitet); under det returneras en tom lista. Golvet är
 * aldrig lägre än 2, eftersom en percentil av en enda lön inte är ett mått.
 * @returns {Array<{p,kv,ma,gapPct}>}
 */
export function fordelningsgap(rader, percentiler, { k = 2 } = {}) {
    const ps = percentiler || [10, 25, 50, 75, 90];
    const kv = [], ma = [];
    (rader || []).forEach(r => { if (!(r.lon > 0)) return; if (arKvinna(r)) kv.push(r.lon); else if (arMan(r)) ma.push(r.lon); });
    const minst = Math.max(2, k);
    if (kv.length < minst || ma.length < minst) return [];
    return ps.map(p => {
        const kvP = _kvantil(kv, p / 100), maP = _kvantil(ma, p / 100);
        return { p, kv: kvP, ma: maP, gapPct: maP > 0 ? (kvP / maP - 1) * 100 : null };
    });
}

/**
 * Lönegapet med direktivets tecken (EU 2023/970 art. 9). Verktyget räknar skillnaden som (kvinnor − män) / män,
 * negativ när kvinnor ligger lägre; direktivet uttrycker gapet som skillnaden i procent av mäns lön,
 * (män − kvinnor) / män, positiv när kvinnor ligger lägre. Beloppet är detsamma — bara tecknet vänds. Används
 * enbart av EU-lönerapporten och rapportens avsnitt om lönetransparens; övriga flikar och blad behåller verktygets
 * konvention (kvinnors lön i procent av mäns). null och icke-tal lämnas som null; −0 blir 0.
 * @param {number|null|undefined} gapPct (kvinnor − män) / män i procent
 * @returns {number|null}
 */
export function tillDirektivtecken(gapPct) {
    if (typeof gapPct !== 'number' || !isFinite(gapPct)) return null;
    return gapPct === 0 ? 0 : -gapPct;
}

/**
 * Reservationen om lönebegreppet vid EU-rapportmåtten (beslut 7a): verktyget räknar på fast heltidsmånadslön, direktivets
 * lönebegrepp omfattar mer. Står vid måtten i fliken Lönestruktur, i EU-lönerapportens Excel, i rapportens avsnitt om
 * lönetransparens och i rapportunderlaget. Inga artikelnummer (ADR-16).
 */
const LONEBEGREPP_RESERVATION = 'Måtten är räknade på fast heltidsmånadslön. Direktivets lönebegrepp är vidare (total ersättning, inklusive rörliga delar och förmåner); komplettera ur lönesystemet om ni rapporterar.';
/** @returns {string} reservationen om lönebegreppet vid EU-rapportmåtten */
export function lonebegreppReservation() { return LONEBEGREPP_RESERVATION; }

// ---- Lönefördelningen i Ålder & karriär: klasserna för histogrammet (flyttade från src/app/40-alder-karriar.js) ----

// Minsta och största värdet i en lista: en slinga, eftersom Math.min(...v) slår i taket för antal argument vid stora filer.
export function omfang(v) {
    let min = Infinity, max = -Infinity;
    for (const x of v) { if (x < min) min = x; if (x > max) max = x; }
    return [min, max];
}

// ---- Löneklasser: indelningen för histogrammet ----
// Klassbredden väljs bland jämna steg så att spannet ger ungefär `mal` klasser. Spannet mäts mellan 5:e och 95:e
// percentilen, så att enstaka löner långt ut inte gör klasserna för breda.
export function lonesteg(loner, mal = 12) {
    const spann = _kvantil(loner, 0.95) - _kvantil(loner, 0.05);
    return [500, 1000, 2000, 2500, 5000, 10000, 20000].find(s => spann / s <= mal) || 50000;
}

// ---- Histogram: lönefördelningen för kvinnor och män, klass för klass ----
// Andel av respektive kön per löneklass. Visas bara när båda könen når tröskeln. Ingen stapel får gälla en klass
// med färre än tröskeln personer: klasserna i ändarna slås ihop inåt tills ändklassen når tröskeln ("under X",
// "X eller mer"), och finns en gles klass i mitten fördubblas klassbredden och indelningen görs om. Går det inte
// att få minst tre klasser ritas inget.
export function histogramKlasser(kv, ma, k) {
    const alla = [...kv, ...ma];
    if (kv.length < k || ma.length < k) return null;
    let steg = lonesteg(alla);
    for (let varv = 0; varv < 6; varv++, steg *= 2) {
        const [lagst, hogst] = omfang(alla), golv = Math.floor(lagst / steg) * steg, antal = Math.floor((hogst - golv) / steg) + 1;
        /** @type {Array<{fran: number, till: number, nKv: number, nMa: number, oppenNed?: boolean, oppenUpp?: boolean}>} */
        let klasser = Array.from({ length: antal }, (_, i) => ({ fran: golv + i * steg, till: golv + (i + 1) * steg, nKv: 0, nMa: 0 }));
        const plats = v => Math.min(antal - 1, Math.floor((v - golv) / steg));
        for (const v of kv) klasser[plats(v)].nKv++;
        for (const v of ma) klasser[plats(v)].nMa++;
        const n = c => c.nKv + c.nMa;
        const slaIhop = (a, b) => ({ fran: a.fran, till: b.till, nKv: a.nKv + b.nKv, nMa: a.nMa + b.nMa, ...(a.oppenNed ? { oppenNed: true } : {}), ...(b.oppenUpp ? { oppenUpp: true } : {}) });
        while (klasser.length > 1 && n(klasser[0]) < k) klasser = [{ ...slaIhop(klasser[0], klasser[1]), oppenNed: true }, ...klasser.slice(2)];
        while (klasser.length > 1 && n(klasser[klasser.length - 1]) < k) klasser = [...klasser.slice(0, -2), { ...slaIhop(klasser[klasser.length - 2], klasser[klasser.length - 1]), oppenUpp: true }];
        if (klasser.length >= 3 && klasser.every(c => n(c) >= k)) return klasser;
    }
    return null;
}

/**
 * Lönestrukturens mått på ett ställe, för fliken Lönestruktur, rapportutkastet och EU-exporten: andelen kvinnor,
 * representationen per BAS (med de BAS-intervall som får redovisas, n ≥ k, de som utelämnas och de där ett kön är
 * för litet), percentilerna, kvartilerna och gapet i median- och medellön. Könsuppdelade mått kräver k för varje kön
 * (ADR-12); `meanGap` är kvinnors medellön i procent av mäns minus 100, null när ett kön är under k eller saknas.
 * @param {any[]} rader
 * @param {number} k
 */
export function strukturMatt(rader, k) {
    const d = rader || [];
    const konOk = konFarRedovisasFor(d, k);
    const kv = d.filter(r => arKvinna(r)).map(r => r.lon);
    const ma = d.filter(r => arMan(r)).map(r => r.lon);
    const totKv = kv.length;
    const meanGap = (konOk && kv.length && ma.length) ? ((kv.reduce((s, x) => s + x, 0) / kv.length) / (ma.reduce((s, x) => s + x, 0) / ma.length) - 1) * 100 : null;
    const rep = representationPerBas(d, { k });
    const repVisade = rep.filter(g => g.n >= k);
    return {
        konOk, kv, ma, totKv, totAndel: d.length ? 100 * totKv / d.length : 0, meanGap,
        rep, repVisade,
        repUtelamnade: rep.filter(g => g.n < k).map(g => g.bas),
        repKonLitet: repVisade.filter(g => g.konLitet).map(g => g.bas),
        dist: fordelningsgap(d, undefined, { k }),
        q: kvartilfordelning(d, { k }),
        medGap: medianGapPct(d, { k }),
    };
}

// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
/**
 * Öppen lönekartläggning — Strukturanalys & EU-rapportmått
 *
 * Rena funktioner för representation/segregation, kvartilfördelning (EU
 * 2023/970 Art. 9), distributionellt gap (sticky floor vs glass ceiling),
 * mediangap och direktivets tecken på gapet (tillDirektivtecken). Separat från app.js för Vitest; app.js får en AUTO-GENERERAD
 * spegel (`_st*` i src/app/09-lib-speglar.js via tools/gen-mirrors.mjs) — ändra
 * här och kör `npm run build:app`, rör ej spegeln. Inga DOM-/state-beroenden.
 */

function _median(arr) {
    if (!arr || !arr.length) return 0;
    const s = arr.slice().sort((a, b) => a - b);
    const m = s.length >> 1;
    return (s.length & 1) ? s[m] : (s[m - 1] + s[m]) / 2;
}
function _quantile(arr, q) {
    if (!arr || !arr.length) return 0;
    const s = arr.slice().sort((a, b) => a - b);
    const pos = (s.length - 1) * q;
    const lo = Math.floor(pos), hi = Math.ceil(pos);
    return lo === hi ? s[lo] : s[lo] + (s[hi] - s[lo]) * (pos - lo);
}
function _isKv(r) { return r.kon && r.kon.includes('kvinna'); }
function _isMa(r) { return r.kon === 'man' || r.kon === 'män'; }

/**
 * Mediangapet kvinnor vs män (%), null om något kön saknas — eller har färre än `k` personer
 * (k-anonymitet: gapet pekar annars ut de få i det mindre könet). Anroparen i appen skickar
 * alltid gällande tröskel; standardvärdet 1 finns för enhetstesterna.
 */
export function medianGapPct(rows, { k = 1 } = {}) {
    const kv = [], ma = [];
    (rows || []).forEach(r => { if (!(r.lon > 0)) return; if (_isKv(r)) kv.push(r.lon); else if (_isMa(r)) ma.push(r.lon); });
    if (kv.length < Math.max(1, k) || ma.length < Math.max(1, k)) return null;
    return (_median(kv) / _median(ma) - 1) * 100;
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
export function representationByBas(rows, { k = 1 } = {}) {
    const minst = Math.max(1, k);
    const m = new Map();
    (rows || []).forEach(r => {
        if (!(r.lon > 0)) return;
        let g = m.get(r.bas);
        if (!g) { g = { bas: r.bas, lons: [], kvLons: [], maLons: [], nKv: 0, nMa: 0, n: 0 }; m.set(r.bas, g); }
        g.lons.push(r.lon); g.n++;
        if (_isKv(r)) { g.kvLons.push(r.lon); g.nKv++; }
        else if (_isMa(r)) { g.maLons.push(r.lon); g.nMa++; }
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
            gapPct: (visaKv && visaMa) ? (_median(g.kvLons) / _median(g.maLons) - 1) * 100 : null,
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
export function quartileDistribution(rows, { k = 1 } = {}) {
    const all = (rows || []).filter(r => r.lon > 0).slice().sort((a, b) => a.lon - b.lon);
    const n = all.length;
    if (n < 4) return [];
    /** @type {Array<{q:number, n:number, nKv:number, nMa:number, undre:number|null, ovre:number|null}>} */
    const out = [1, 2, 3, 4].map(q => ({ q, n: 0, nKv: 0, nMa: 0, undre: null, ovre: null }));
    /** @type {Array<number|null>} */ const lo = [null, null, null, null];
    /** @type {Array<number|null>} */ const hi = [null, null, null, null];
    all.forEach((r, i) => {
        const q = Math.min(3, Math.floor(i * 4 / n));
        const o = out[q];
        o.n++; if (_isKv(r)) o.nKv++; else if (_isMa(r)) o.nMa++;
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
export function distributionalGap(rows, percentiles, { k = 2 } = {}) {
    const ps = percentiles || [10, 25, 50, 75, 90];
    const kv = [], ma = [];
    (rows || []).forEach(r => { if (!(r.lon > 0)) return; if (_isKv(r)) kv.push(r.lon); else if (_isMa(r)) ma.push(r.lon); });
    const minst = Math.max(2, k);
    if (kv.length < minst || ma.length < minst) return [];
    return ps.map(p => {
        const kvP = _quantile(kv, p / 100), maP = _quantile(ma, p / 100);
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

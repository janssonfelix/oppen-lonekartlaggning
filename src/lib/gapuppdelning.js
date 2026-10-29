// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
/**
 * Öppen lönekartläggning — Var uppstår löneskillnaden? (ADR-22)
 *
 * Delar gapet i medellön (kvinnor − män, kr/mån; negativt när kvinnor ligger lägre) i tre delar som summerar exakt:
 *   A  BAS-fördelning       Σ_b Δs_b · (W̄_b − W̄)
 *   B  AID inom BAS         Σ_b s̄_b · Σ_a Δs_a|b · (W̄_ab − W̄_b)
 *   C  inom AID och BAS     Σ_b s̄_b · Σ_a s̄_a|b · ΔW_ab
 * Δx = x_kvinnor − x_män, x̄ = (x_män + x_kvinnor) / 2 (symmetriskt, inget referenskön).
 * Saknas ett kön i en grupp sätts dess medellön lika med det andra könets; gruppen
 * bidrar då bara till fördelningsdelen. Centreringen (− W̄, − W̄_b) ändrar inga summor
 * eftersom Σ Δs = 0, men gör varje grupps post tolkbar.
 *
 * Webbläsarbygget får en AUTO-GENERERAD spegel i src/app/09-lib-speglar.js.
 */

import { groupKey, konOf } from './falt.js';

const _medel = rader => rader.reduce((s, r) => s + r.lon, 0) / rader.length;

function _grupper(kv, ma, nyckel) {
    const m = new Map();
    const lagg = (r, g) => {
        const key = nyckel(r);
        if (!m.has(key)) m.set(key, { kv: [], ma: [] });
        m.get(key)[g].push(r);
    };
    kv.forEach(r => lagg(r, 'kv'));
    ma.forEach(r => lagg(r, 'ma'));
    return m;
}

// Andelar och medellöner för en grupp; saknat kön får det andra könets medellön.
function _cell(g, totKv, totMa, k) {
    const wKv0 = g.kv.length ? _medel(g.kv) : null, wMa0 = g.ma.length ? _medel(g.ma) : null;
    // Grupperna kommer ur _grupper och har alltid minst en person, så båda blir tal; ?? 0 för typkontrollen.
    const wKv = wKv0 ?? wMa0 ?? 0, wMa = wMa0 ?? wKv0 ?? 0;
    return {
        sKv: g.kv.length / totKv, sMa: g.ma.length / totMa, wKv, wMa, w: (wKv + wMa) / 2,
        bada: g.kv.length > 0 && g.ma.length > 0,
        synlig: (g.kv.length === 0 || g.kv.length >= k) && (g.ma.length === 0 || g.ma.length >= k),
    };
}

/** @typedef {{namn:string, kr:number, synlig:boolean}} Post */

// Alla poster per del, med synlig = båda könen i gruppen (och för B/C även BAS:en) har 0 eller
// minst k personer. null när ett kön har färre än k i hela urvalet.
function _beraknaPoster(rader, k) {
    const kv = [], ma = [];
    for (const r of rader || []) {
        if (!(r.lon > 0)) continue;
        const g = konOf(r);
        if (g === 'Kvinna') kv.push(r);
        else if (g === 'Man') ma.push(r);
    }
    if (kv.length < k || ma.length < k) return null;

    const medel = { kv: _medel(kv), ma: _medel(ma) };
    const wTot = (medel.ma + medel.kv) / 2;
    /** @type {{A: Post[], B: Post[], C: Post[]}} */
    const poster = { A: [], B: [], C: [] };

    for (const [bas, gb] of _grupper(kv, ma, r => r.bas || '—')) {
        const b = _cell(gb, kv.length, ma.length, k);
        poster.A.push({ namn: `BAS ${bas}`, kr: (b.sKv - b.sMa) * (b.w - wTot), synlig: b.synlig });
        if (!b.bada) continue;   // ΔW_b = 0 — BAS:en bidrar varken till B eller C
        const sb = (b.sKv + b.sMa) / 2;
        for (const [aid, ga] of _grupper(gb.kv, gb.ma, r => groupKey(r, 'aid'))) {
            const a = _cell(ga, gb.kv.length, gb.ma.length, k);
            const namn = `${aid}, BAS ${bas}`;
            // BAS-medellönen (båda könens) ingår i B-posten, så även BAS:en måste klara k.
            const synlig = a.synlig && b.synlig;
            poster.B.push({ namn, kr: sb * (a.sKv - a.sMa) * (a.w - b.w), synlig });
            poster.C.push({ namn, kr: sb * ((a.sKv + a.sMa) / 2) * (a.wKv - a.wMa), synlig });
        }
    }
    return { kv, ma, medel, poster };
}

/** Samtliga poster, även dolda — bara för tester av skyddsregeln; redovisas aldrig. */
/**
 * @param {any[]} rader
 * @param {{k?:number}} [opts]
 */
export function gapPoster(rader, { k } = {}) {
    const r = _beraknaPoster(rader, k);
    return r ? r.poster : null;
}

// Skyddsregel för topplistan. Det som inte visas i en del är delens summa minus de visade
// posterna. Den som läser vet inte beloppen eller tecknen på de enskilda posterna i resten,
// så osäkerheten om en dold grupps bidrag h är summan av |belopp| för ALLA ANDRA poster i
// resten (dolda och ej visade synliga). Den ska vara minst SKYDD · |h| för varje dold post med
// |h| ≥ 0,5 kr. Håller det inte tas den minsta visade posten bort ur listan (den går in i
// resten) tills regeln håller. De dolda gruppernas summa redovisas aldrig.
// Håller regeln inte ens med tom lista består delen i praktiken av den dolda gruppen; då
// redovisas inga delar alls (skyddad: false) — A + B + C = hela skillnaden, så en enskild del
// kan inte döljas medan de andra visas.
const SKYDD = 0.5;
function _skyddad(poster, visade) {
    const vis = new Set(visade);
    const rest = poster.filter(p => !vis.has(p));
    const brus = rest.reduce((s, p) => s + Math.abs(p.kr), 0);
    return rest.filter(p => !p.synlig && Math.abs(p.kr) >= 0.5)
        .every(h => brus - Math.abs(h.kr) >= SKYDD * Math.abs(h.kr));
}

/**
 * @param {any[]} rader
 * @param {{k?:number}} [opts]
 */
export function gapUppdelning(rader, { k } = {}) {
    const r = _beraknaPoster(rader, k);
    if (!r) return null;
    const { kv, ma, medel, poster } = r;
    const gap = medel.kv - medel.ma;   // kvinnor mot män, som i resten av verktyget

    const delar = {}, topp = {}, ovrigaAntal = {};
    let skyddad = true;
    for (const d of ['A', 'B', 'C']) {
        delar[d] = poster[d].reduce((s, p) => s + p.kr, 0);
        ovrigaAntal[d] = poster[d].filter(p => !p.synlig).length;
        // Poster som avrundas till 0 kr säger inget och visas inte (de ingår i delen).
        const visade = poster[d].filter(p => p.synlig && Math.abs(p.kr) >= 0.5)
            .sort((x, y) => Math.abs(y.kr) - Math.abs(x.kr) || x.namn.localeCompare(y.namn, 'sv'))
            .slice(0, 3);
        while (visade.length && !_skyddad(poster[d], visade)) visade.pop();
        if (!_skyddad(poster[d], visade)) skyddad = false;
        topp[d] = visade.map(({ namn, kr }) => ({ namn, kr }));
    }
    const gapPct = gap / medel.ma * 100;
    const bas = { n: { kv: kv.length, ma: ma.length }, medel, gap, gapPct, litetGap: Math.abs(gapPct) < 1 };
    if (!skyddad) return { ...bas, skyddad: false, delar: null, topp: null, ovrigaAntal: null };
    return { ...bas, skyddad: true, delar, topp, ovrigaAntal };
}

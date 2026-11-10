// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
/**
 * Öppen lönekartläggning — Var uppstår löneskillnaden? (ADR-22, valbara variabler ADR-65)
 *
 * Delar gapet i medellön (kvinnor − män, kr/mån; negativt när kvinnor ligger lägre) i delar som summerar exakt.
 * Standardvalet är variablerna BAS och AID, i den ordningen, och ger tre delar:
 *   A  BAS-fördelning       Σ_b Δs_b · (W̄_b − W̄)
 *   B  AID inom BAS         Σ_b s̄_b · Σ_a Δs_a|b · (W̄_ab − W̄_b)
 *   C  inom AID och BAS     Σ_b s̄_b · Σ_a s̄_a|b · ΔW_ab
 * Allmänt, med variablerna v_1 … v_n (1 ≤ n ≤ 4) nästlade i den ordningen: varje cell c på nivå i−1 har vikten
 * ω_c = produkten av s̄ längs vägen från roten (roten: ω = 1, hela urvalet). Då är
 *   del i (1 ≤ i ≤ n)   Σ_c ω_c · Σ_{barn b av c} Δs_b|c · (W̄_b − W̄_c)
 *   del n+1 (inom)      Σ_{löv l} ω_l · ΔW_l,  där ω_l = ω_förälder · s̄_l
 * Summan är exakt ΔW för roten, eftersom ΔW_c = Σ_b Δs_b|c · W̄_b + Σ_b s̄_b|c · ΔW_b (symmetriskt, ΔX·Ȳ + X̄·ΔY).
 * Δx = x_kvinnor − x_män, x̄ = (x_män + x_kvinnor) / 2 (symmetriskt, inget referenskön).
 * Saknas ett kön i en cell sätts dess medellön lika med det andra könets; cellen bidrar då bara till sin
 * fördelningsdel, och inget under den räknas (ΔW = 0). Centreringen (− W̄_c) ändrar inga summor
 * eftersom Σ Δs = 0, men gör varje grupps post tolkbar.
 * AID-nivåerna (sektor, aidniva, aid) ordnas alltid grovt till fint på sina platser: en finare nivå före en grövre
 * ger annars en tom del. Ålder (åldersgrupp, ageBucket) kan bara väljas när lönefilen har ålder (ADR-64).
 *
 * Webbläsarbygget får en AUTO-GENERERAD spegel i src/app/09-lib-speglar.js.
 */

import { groupKey, konOf } from './falt.js';

/** Variablerna i den ordning gränssnittet visar dem. */
export const GAP_VARIABLER = ['bas', 'sektor', 'aidniva', 'aid', 'alder'];
export const GAP_VARIABLER_STANDARD = ['bas', 'aid'];
/** Alla variabler, i gränssnittets ordning (en kopia). */
export function gapAllaVariabler() { return [...GAP_VARIABLER]; }
/** Standardvalet BAS, AID (en kopia). */
export function gapStandardVariabler() { return [...GAP_VARIABLER_STANDARD]; }
const GAP_MAX = 4;
// AID-hierarkin, grov till fin (ADR-33).
const AID_NIVAER = ['sektor', 'aidniva', 'aid'];

// Ord per variabel: etikett (kryssrutan), liten (i löptext: "inom samma …"), fordelning (del 1), over ("fördelade över …"
// i kortet), overKort (samma i rapportunderlaget), olika ("har olika … inom samma"), post (en grupps namn).
const ORD = {
    bas: { etikett: 'BAS', liten: 'BAS', fordelning: 'BAS-fördelning', over: 'BAS-intervallen', overKort: 'BAS', olika: 'BAS', post: n => `BAS ${n}` },
    sektor: { etikett: 'Sektor', liten: 'sektor', fordelning: 'Sektorsfördelning', over: 'sektorerna', overKort: 'sektorer', olika: 'sektor', post: n => n },
    aidniva: { etikett: 'AID-mellannivå', liten: 'AID-mellannivå', fordelning: 'Fördelning över AID-mellannivåer', over: 'AID-mellannivåerna', overKort: 'AID-mellannivåer', olika: 'AID-mellannivå', post: n => n },
    aid: { etikett: 'AID', liten: 'AID', fordelning: 'AID-fördelning', over: 'AID-koderna', overKort: 'AID', olika: 'AID', post: n => n },
    alder: { etikett: 'Åldersgrupp', liten: 'åldersgrupp', fordelning: 'Åldersfördelning', over: 'åldersgrupperna', overKort: 'åldersgrupper', olika: 'ålder', post: n => n === '—' ? 'ålder saknas' : `${n} år` },
};

/** Etiketten för en variabel (kryssrutan, rapportunderlaget). @param {string} v */
export function gapVariabelEtikett(v) { return ORD[v] ? ORD[v].etikett : String(v); }

const _versal = t => t.charAt(0).toUpperCase() + t.slice(1);
// Gemen i löptext, utom förkortningar (BAS, AID).
const _gemen = t => (t.length > 1 && t[1] === t[1].toUpperCase() && t[1] !== t[1].toLowerCase()) ? t : t.charAt(0).toLowerCase() + t.slice(1);
const _och = a => a.length <= 1 ? (a[0] || '') : `${a.slice(0, -1).join(', ')} och ${a[a.length - 1]}`;

/**
 * Normaliserar ett val från konfigurationsfilen eller gränssnittet: bara kända variabler, inga dubbletter, högst fyra,
 * AID-nivåerna grovt till fint och åldersgrupp bara när lönefilen har ålder. Ett tomt eller ogiltigt val ger
 * standard med en varning; null ger standard utan varning.
 * @param {any} v
 * @param {{harAlder?: boolean}} [opts]
 * @returns {{variabler: string[], varningar: string[]}}
 */
export function normaliseraGapVariabler(v, { harAlder = true } = {}) {
    const varningar = [];
    if (v == null) return { variabler: [...GAP_VARIABLER_STANDARD], varningar };
    if (!Array.isArray(v)) {
        varningar.push('Uppdelningens variabler gick inte att läsa; standardvalet BAS och AID används.');
        return { variabler: [...GAP_VARIABLER_STANDARD], varningar };
    }
    let val = [...new Set(v.filter(x => typeof x === 'string' && GAP_VARIABLER.includes(x)))];
    if (val.length > GAP_MAX) {
        val = val.slice(0, GAP_MAX);
        varningar.push('Högst fyra variabler kan väljas; de första fyra används.');
    }
    if (!harAlder && val.includes('alder')) {
        val = val.filter(x => x !== 'alder');
        varningar.push('Åldersgrupp kan inte väljas: lönefilen saknar ålder.');
    }
    if (!val.length) {
        if (!varningar.length) varningar.push('Uppdelningen behöver minst en variabel; standardvalet BAS och AID används.');
        return { variabler: [...GAP_VARIABLER_STANDARD], varningar };
    }
    // AID-nivåerna på sina platser, grovt till fint.
    const platser = val.map((x, i) => AID_NIVAER.includes(x) ? i : -1).filter(i => i >= 0);
    const nivaer = platser.map(i => val[i]).sort((a, b) => AID_NIVAER.indexOf(a) - AID_NIVAER.indexOf(b));
    platser.forEach((p, j) => { val[p] = nivaer[j]; });
    return { variabler: val, varningar };
}

/** Sant när valet (efter normalisering) är standardvalet BAS, AID. @param {any} v */
export function gapVariablerArStandard(v) {
    const n = normaliseraGapVariabler(v).variabler;
    return n.length === GAP_VARIABLER_STANDARD.length && n.every((x, i) => x === GAP_VARIABLER_STANDARD[i]);
}

/**
 * Delarna för ett val: id (A, B, …), namn, variabel (null för den sista, "inom"), texten i kortet (betyder) och
 * frasen i rapportunderlaget (orsak: "på …"). Standardvalet ger texterna från före ADR-65.
 * @param {string[]} variabler normaliserade
 * @returns {{id: string, namn: string, variabel: string|null, betyder: string, orsak: string}[]}
 */
export function gapDelar(variabler) {
    const v = variabler && variabler.length ? variabler : GAP_VARIABLER_STANDARD;
    const inom = i => _och(v.slice(0, i).reverse().map(x => ORD[x].liten));   // finast först: "AID och BAS"
    /** @type {{id: string, namn: string, variabel: string|null, betyder: string, orsak: string}[]} */
    const delar = v.map((x, i) => i === 0
        ? { id: 'ABCDE'[i], namn: ORD[x].fordelning, variabel: x, betyder: `Kvinnor och män är olika fördelade över ${ORD[x].over}.`,
            orsak: `på att kvinnor och män är olika fördelade över ${ORD[x].overKort}` }
        : { id: 'ABCDE'[i], namn: `${_versal(ORD[x].liten)} inom ${inom(i)}`, variabel: x,
            betyder: `Kvinnor och män har olika ${ORD[x].olika} inom samma ${inom(i)}.`, orsak: `på olika ${ORD[x].olika} inom samma ${inom(i)}` });
    delar.push({ id: 'ABCDE'[v.length], namn: `Inom ${inom(v.length)}`, variabel: null,
        betyder: `Kvinnor och män har olika lön i samma ${inom(v.length)}.`, orsak: `på löneskillnader inom samma ${inom(v.length)}` });
    return delar;
}

/** Variablerna i löptext, i valets ordning: "BAS, åldersgrupp och AID". @param {string[]} variabler */
export function gapVariablerIText(variabler) { return _och((variabler || []).map(x => ORD[x] ? ORD[x].liten : String(x))); }

/** Delarna i en mening: "BAS-fördelning, AID inom BAS och lön inom samma AID och BAS". @param {string[]} variabler */
export function gapDelarIText(variabler) {
    const v = variabler && variabler.length ? variabler : GAP_VARIABLER_STANDARD;
    const d = gapDelar(v);
    return _och([...d.slice(0, -1).map(x => _gemen(x.namn)), `lön inom samma ${_och(v.slice().reverse().map(x => ORD[x].liten))}`]);
}

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

// Alla poster per del (A, B, …), med synlig = båda könen i cellen och i alla dess överceller har 0 eller minst k
// personer. null när ett kön har färre än k i hela urvalet. Posterna läggs i samma ordning och räknas med samma
// operationer som före ADR-65 (djupet först, vikten ω multipliceras från vänster), så att standardvalet ger
// bitlika tal.
function _beraknaPoster(rader, k, variabler) {
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
    const n = variabler.length;
    /** @type {Record<string, Post[]>} */
    const poster = {};
    for (let i = 0; i <= n; i++) poster['ABCDE'[i]] = [];
    const nyckel = v => r => groupKey(r, v) ?? '—';   // åldersgrupp saknas (ålder 0) blir en egen grupp

    // Cellen på nivå `niva` (0 = roten) med vikten ω (null i roten), medellönen w, namnen uppåt och om alla
    // överceller är synliga.
    const ner = (gkv, gma, niva, omega, w, namn, synligUppat) => {
        const v = variabler[niva];
        for (const [key, g] of _grupper(gkv, gma, nyckel(v))) {
            const c = _cell(g, gkv.length, gma.length, k);
            const cNamn = [ORD[v].post(key), ...namn];
            const synlig = c.synlig && synligUppat;
            const delta = c.sKv - c.sMa;
            poster['ABCDE'[niva]].push({ namn: cNamn.join(', '), kr: omega === null ? delta * (c.w - w) : omega * delta * (c.w - w), synlig });
            if (niva + 1 < n) {
                if (!c.bada) continue;   // ΔW_c = 0 — cellen bidrar inte längre ner
                const sc = (c.sKv + c.sMa) / 2;
                ner(g.kv, g.ma, niva + 1, omega === null ? sc : omega * sc, c.w, cNamn, synlig);
            } else {
                const sc = (c.sKv + c.sMa) / 2;
                poster['ABCDE'[n]].push({ namn: cNamn.join(', '), kr: omega === null ? sc * (c.wKv - c.wMa) : omega * sc * (c.wKv - c.wMa), synlig });
            }
        }
    };
    ner(kv, ma, 0, null, wTot, [], true);
    return { kv, ma, medel, poster };
}

/** Samtliga poster, även dolda — bara för tester av skyddsregeln; redovisas aldrig. */
/**
 * @param {any[]} rader
 * @param {{k?:number, variabler?:any}} [opts]
 */
export function gapPoster(rader, { k, variabler } = {}) {
    const r = _beraknaPoster(rader, k, _variablerFor(rader, variabler));
    return r ? r.poster : null;
}

// Valet normaliserat mot underlaget: åldersgrupp bara när lönefilen har ålder (ålder 0 = saknas, ADR-64).
const _variablerFor = (rader, variabler) => normaliseraGapVariabler(variabler, { harAlder: (rader || []).some(r => r && r.alder > 0) }).variabler;

// Skyddsregel för topplistan. Det som inte visas i en del är delens summa minus de visade
// posterna. Den som läser vet inte beloppen eller tecknen på de enskilda posterna i resten,
// så osäkerheten om en dold grupps bidrag h är summan av |belopp| för ALLA ANDRA poster i
// resten (dolda och ej visade synliga). Den ska vara minst SKYDD · |h| för varje dold post med
// |h| ≥ 0,5 kr. Håller det inte tas den minsta visade posten bort ur listan (den går in i
// resten) tills regeln håller. De dolda gruppernas summa redovisas aldrig.
// Håller regeln inte ens med tom lista består delen i praktiken av den dolda gruppen; då
// redovisas inga delar alls (skyddad: false) — delarna summerar till hela skillnaden, så en enskild del
// kan inte döljas medan de andra visas. Regeln gäller per del, för varje val av variabler (ADR-65).
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
 * @param {{k?:number, variabler?:any}} [opts] variabler: förklaringsvariablerna i ordning (null = standard, BAS och AID)
 */
export function gapUppdelning(rader, { k, variabler } = {}) {
    const val = _variablerFor(rader, variabler);
    const r = _beraknaPoster(rader, k, val);
    if (!r) return null;
    const { kv, ma, medel, poster } = r;
    const gap = medel.kv - medel.ma;   // kvinnor mot män, som i resten av verktyget

    const delar = {}, topp = {}, ovrigaAntal = {};
    let skyddad = true;
    for (const d of Object.keys(poster)) {
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
    if (!skyddad) return { ...bas, skyddad: false, delar: null, topp: null, ovrigaAntal: null, variabler: val };
    return { ...bas, skyddad: true, delar, topp, ovrigaAntal, variabler: val };
}

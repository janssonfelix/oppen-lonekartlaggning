// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
/**
 * Öppen lönekartläggning — Likvärdighetsanalys (DiskrL 3:10 §)
 *
 * Ren, testbar kärna för § 3:10-analysen. Appen får den genom lib-speglarna
 * (ADR-8); computeLikvardighetPairs() i 34-likvardigt-arbete.js är adaptern
 * runt den. Vitest verifierar *algoritmen* deterministiskt.
 *
 * Modellen:
 *   Steg 1 — Organisationens AID×BAS-grupper delas i:
 *            • kvinnodominerade (kvinnoPct > kvinnoThr, mer än 60 %) — analysens subjekt
 *            • icke-kvinnodominerade (kvinnoPct < 100−kvinnoThr, mindre än 40 %) — interna
 *              jämförelsekandidater (PRIMÄR jämförelsekälla; § 3:10 är en
 *              inom-arbetsgivare-analys). K-anonymitet tillämpas EJ.
 *   Steg 2 — jämförelsestatistikens AID×BAS klassificeras som
 *            icke-kvinnodominerade (kvAndel ≤ 40 %). Lokal könsdata primär,
 *            SCB-prefix-fallback (injicerad `scbKlass`-funktion) annars.
 *            Används som EXTERN fallback per BAS.
 *   Steg 3 — Jämför INOM samma BAS-intervall (= likvärdiga krav). Per BAS
 *            väljs internt jämförelseyrke om sådant finns, annars jämförelsestatistiken.
 *            Flagga par där jämförelseyrkets median > organisationens median,
 *            gap ≥ minGapPct. Varje par får ett bootstrap-95 %-CI på
 *            medianskillnaden (intern: bägge urvalen; extern: org-löner mot
 *            jämförelsestatistikens median som konstant). Interna par får
 *            dessutom en ÅLDERSJUSTERAD skillnad (aldersjusteradSkillnad):
 *            jämförelseyrkets lön standardiserad till den kvinnodominerade
 *            gruppens åldersfördelning. Den råa skillnaden är huvudmåttet —
 *            lagen prövar lönenivån som sådan — den justerade visar hur
 *            mycket av skillnaden som kan bero på åldersstruktur.
 *
 * @see 34-likvardigt-arbete.js computeLikvardighetPairs
 */

import { median as _median } from './stat.js';
import { rngFor } from './rng.js';

export const KVINNO_TROSKEL_DEFAULT = 60;   // > → kvinnodominerat (mer än 60 % kvinnor; jurist 2026-10-19, A5)
export const ICKE_KV_TAK = 40;              // < → icke-kvinnodominerat (mindre än 40 % kvinnor; jämförelsestatistiken)
export const KV_DOM_STAT = 60;               // > → kvinnodominerat (jämförelsestatistiken, skippas)

function _sortedMedian(arr) {
    if (!arr || !arr.length) return 0;
    const s = arr.slice().sort((a, b) => a - b);
    const m = s.length >> 1;
    return s.length & 1 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/**
 * Bootstrap-CI för MEDIAN-SKILLNAD i kronor (m_ma − m_kv), percentil [2.5,97.5].
 * Används för INTERNA par (bägge sidor har individdata).
 * @param {number[]} kvLons
 * @param {number[]} maLons
 * @param {number} [B=1000]
 * @param {() => number} [rng=Math.random] - injicerbar RNG för deterministiska tester
 * @returns {{lo:number, hi:number}|null}
 */
export function bootstrapMedianDiffKr(kvLons, maLons, B = 1000, rng = Math.random) {
    if (!Array.isArray(kvLons) || !Array.isArray(maLons)) return null;
    if (kvLons.length < 3 || maLons.length < 3) return null;
    const diffs = new Array(B);
    const kvN = kvLons.length, maN = maLons.length;
    for (let b = 0; b < B; b++) {
        const sKv = new Array(kvN), sMa = new Array(maN);
        for (let i = 0; i < kvN; i++) sKv[i] = kvLons[(rng() * kvN) | 0];
        for (let i = 0; i < maN; i++) sMa[i] = maLons[(rng() * maN) | 0];
        diffs[b] = _sortedMedian(sMa) - _sortedMedian(sKv);
    }
    diffs.sort((a, b) => a - b);
    return { lo: diffs[Math.floor(B * 0.025)], hi: diffs[Math.floor(B * 0.975)] };
}

/**
 * Bootstrap-CI mot ett KONSTANT referensvärde (constMedian − m_sample).
 * Används för EXTERNA par (jämförelsestatistikens median är ett aggregat utan individdata).
 * @param {number[]} orgLons
 * @param {number} constMedian
 * @param {number} [B=1000]
 * @param {() => number} [rng=Math.random]
 * @returns {{lo:number, hi:number}|null}
 */
export function bootstrapMedianVsConstantKr(orgLons, constMedian, B = 1000, rng = Math.random) {
    if (!Array.isArray(orgLons) || orgLons.length < 3) return null;
    if (!(constMedian > 0)) return null;
    const n = orgLons.length;
    const diffs = new Array(B);
    for (let b = 0; b < B; b++) {
        const sample = new Array(n);
        for (let i = 0; i < n; i++) sample[i] = orgLons[(rng() * n) | 0];
        diffs[b] = constMedian - _sortedMedian(sample);
    }
    diffs.sort((a, b) => a - b);
    return { lo: diffs[Math.floor(B * 0.025)], hi: diffs[Math.floor(B * 0.975)] };
}

export const ALDERS_GOLV_DEFAULT = 10;      // minsta antal personer i jämförelseyrket för åldersjustering
export const ALDERS_SPRIDNING_MIN = 5;      // minsta åldersspridning (år) i jämförelseyrket

function _medel(arr) {
    const v = (arr || []).filter(x => typeof x === 'number' && isFinite(x));
    return v.length ? v.reduce((s, x) => s + x, 0) / v.length : null;
}

/**
 * Åldersjusterad skillnad för ett internt par: jämförelseyrkets lön standardiseras
 * till den kvinnodominerade gruppens åldersfördelning.
 *
 * I jämförelseyrket skattas log(lön) = a + b·ålder (OLS). Kravet är minst `golv`
 * personer med ålder och minst 5 års åldersspridning — annars null. Lönen
 * prediceras sedan vid varje person i den kvinnodominerade gruppen med dennes
 * ålder; medianen av prediktionerna är den åldersjusterade jämförelsemedianen.
 * Skillnaden räknas i kronor och procent mot den kvinnodominerade gruppens
 * (råa) median, så att den är jämförbar med parets råa skillnad.
 *
 * @param {Array<{lon:number, alder?:number}>} kvRader - den kvinnodominerade gruppen
 * @param {Array<{lon:number, alder?:number}>} jmfRader - jämförelseyrket (individlöner)
 * @param {{golv?:number}} [opts]
 * @returns {{medianJusterad:number, gapKr:number, gapPct:number, metod:'alder'}|null}
 */
export function aldersjusteradSkillnad(kvRader, jmfRader, { golv = ALDERS_GOLV_DEFAULT } = {}) {
    /** @returns {r is {lon:number, alder:number}} */
    const ok = r => !!r && r.lon > 0 && typeof r.alder === 'number' && isFinite(r.alder);
    const jmf = (jmfRader || []).filter(ok);
    if (jmf.length < Math.max(golv, 3)) return null;
    let lagst = Infinity, hogst = -Infinity;
    for (const r of jmf) { if (r.alder < lagst) lagst = r.alder; if (r.alder > hogst) hogst = r.alder; }
    if (hogst - lagst < ALDERS_SPRIDNING_MIN) return null;
    const n = jmf.length;
    const mx = jmf.reduce((s, r) => s + r.alder, 0) / n;
    let Sxx = 0, Sxy = 0, Sy = 0;
    for (const r of jmf) { const x = r.alder - mx, y = Math.log(r.lon); Sxx += x * x; Sxy += x * y; Sy += y; }
    if (!(Sxx > 1e-9)) return null;
    const b = Sxy / Sxx, a = Sy / n - b * mx;
    const kvAlla = (kvRader || []).filter(r => r && r.lon > 0);
    const kvMedAlder = kvAlla.filter(ok);
    if (!kvAlla.length || !kvMedAlder.length) return null;
    const pred = kvMedAlder.map(r => Math.exp(a + b * r.alder));
    const medianJusterad = _median(pred);
    const kvMedian = _median(kvAlla.map(r => r.lon));
    if (!(medianJusterad > 0) || !(kvMedian > 0)) return null;
    const gapKr = medianJusterad - kvMedian;
    return { medianJusterad, gapKr, gapPct: gapKr / kvMedian * 100, metod: 'alder' };
}

/** Individrader {lon, alder} ur en aggregerad grupp (lons och aldrar är parallella). */
function _gruppRader(g) {
    if (!g || !Array.isArray(g.lons)) return [];
    const aldrar = Array.isArray(g.aldrar) ? g.aldrar : [];
    return g.lons.map((lon, i) => ({ lon, alder: aldrar[i] }));
}

/** Åldersfälten för ett par: medelålder per sida och den justerade skillnaden (bara interna par). */
function _aldersFalt(f, g, ärIntern, golv) {
    /** @type {ReturnType<typeof aldersjusteradSkillnad>} */
    let aldersJusterad = null;
    if (ärIntern) {
        try { aldersJusterad = aldersjusteradSkillnad(_gruppRader(f), _gruppRader(g), { golv }); } catch (_) { aldersJusterad = null; }
    }
    return {
        kvMedelAlder: _medel(f.aldrar),
        maMedelAlder: ärIntern ? _medel(g.aldrar) : null,
        aldersJusterad
    };
}

/**
 * Steg 1 — aggregera organisationens individdata per AID×BAS och dela upp i
 * kvinnodominerade grupper (analysens subjekt) och icke-kvinnodominerade
 * grupper (interna jämförelsekandidater).
 *
 * @param {Array<{aid:string, bas:string, lon:number, kon:string, yrkeLabel?:string, yrke?:string, alder?:number}>} data
 * @param {number} kvinnoThr - kvinnotröskel i procent (> → kvinnodominerat)
 * @param {number} [K=10]
 * @returns {{orgKvDom:Array, orgIckeKv:Array, antalAidxBas:number, kvDomMedNLessThanK:number}}
 */
export function aggregeraOrgKvDom(data, kvinnoThr = KVINNO_TROSKEL_DEFAULT, K = 10) {
    const ickeKvTak = 100 - kvinnoThr;
    const map = new Map();   // nyckel: aid|bas
    for (const r of (data || [])) {
        const aid = String(r?.aid || '').trim();
        if (!aid || !(r.lon > 0) || !r.bas) continue;
        const key = aid + '|' + r.bas;
        if (!map.has(key)) {
            map.set(key, { aid, bas: r.bas, label: r.yrkeLabel || r.yrke || aid, n: 0, nKv: 0, lons: [], aldrar: [] });
        }
        const g = map.get(key);
        g.n++;
        if (typeof r.kon === 'string' && r.kon.includes('kvinna')) g.nKv++;
        g.lons.push(r.lon);
        // Åldern bärs parallellt med lönen (null när den saknas) för åldersjusteringen i steg 3.
        g.aldrar.push(typeof r.alder === 'number' && isFinite(r.alder) ? r.alder : null);
    }
    const orgKvDom = [];
    const orgIckeKv = [];
    let kvDomMedNLessThanK = 0;
    for (const g of map.values()) {
        const kvinnoPct = (g.nKv / g.n) * 100;
        const obj = {
            aid: g.aid, bas: g.bas, label: g.label,
            n: g.n, nKv: g.nKv, kvinnoPct,
            median: _median(g.lons), lons: g.lons.slice(), aldrar: g.aldrar.slice()
        };
        if (kvinnoPct > kvinnoThr) {
            orgKvDom.push(obj);
            if (g.n < K) kvDomMedNLessThanK++;
        } else if (kvinnoPct < ickeKvTak) {
            orgIckeKv.push(obj);
        }
    }
    orgKvDom.sort((a, b) => b.n - a.n);
    orgIckeKv.sort((a, b) => b.n - a.n);
    return { orgKvDom, orgIckeKv, antalAidxBas: map.size, kvDomMedNLessThanK };
}

/**
 * Steg 2 — klassificera jämförelsestatistiken per AID×BAS. Returnerar de
 * icke-kvinnodominerade raderna grupperade per BAS.
 *
 * @param {Array<{aid:string, bas:string, median:number, andelKv?:number, aidFull?:string, nKv?:number, nMa?:number}>} statistik
 * @param {((aid:string) => ({kvAndel:number}|null))|null} [scbKlass] - SCB-prefix-fallback
 * @returns {{statIckeKv:Array, statByBas:Map, klass:Object, klassKalla:Object}}
 */
export function klassificeraStatistik(statistik, scbKlass) {
    const statByBas = new Map();
    const statIckeKv = [];
    const klass = { kvDom: 0, blandat: 0, ickeKv: 0, oklassificerad: 0 };
    const klassKalla = { lokal: 0, scb: 0 };

    for (const s of (statistik || [])) {
        if (!s || !s.aid || !s.bas || !(s.median > 0)) continue;
        if (!/^\d+$/.test(String(s.aid))) continue;   // hoppa över yrkesfamiljerubriker

        /** @type {number|null} */ let kvAndel = null;
        /** @type {'lokal'|'scb'|null} */ let källa = null;
        if (s.andelKv != null && s.andelKv >= 0 && s.andelKv <= 100) {
            kvAndel = s.andelKv; källa = 'lokal';
        } else if (typeof scbKlass === 'function') {
            const scb = scbKlass(s.aid);
            if (scb && scb.kvAndel != null) { kvAndel = scb.kvAndel; källa = 'scb'; }
        }
        if (kvAndel == null) { klass.oklassificerad++; continue; }
        if (källa === 'lokal') klassKalla.lokal++; else klassKalla.scb++;

        if (kvAndel > KV_DOM_STAT) { klass.kvDom++; continue; }
        if (kvAndel >= ICKE_KV_TAK) { klass.blandat++; continue; }
        klass.ickeKv++;

        const rawLabel = s.aidFull || s.aid;
        const aidStr = String(s.aid);
        const cleanLabel = String(rawLabel).startsWith(aidStr)
            ? String(rawLabel).slice(aidStr.length).replace(/^\s*[—\-:.\s]*/, '').trim() || aidStr
            : rawLabel;
        const obj = {
            aid: s.aid, label: cleanLabel, bas: s.bas,
            median: s.median, kvAndel, källa, nKv: s.nKv, nMa: s.nMa
        };
        if (!statByBas.has(s.bas)) statByBas.set(s.bas, []);
        statByBas.get(s.bas).push(obj);
        statIckeKv.push(obj);
    }
    statIckeKv.sort((a, b) => a.kvAndel - b.kvAndel);
    return { statIckeKv, statByBas, klass, klassKalla };
}

/**
 * Bygg en Map per BAS av organisationens interna jämförelseyrken.
 * @param {Array} orgIckeKv
 * @returns {Map<string, Array>}
 */
export function orgIckeKvByBas(orgIckeKv) {
    const m = new Map();
    for (const g of (orgIckeKv || [])) {
        if (!m.has(g.bas)) m.set(g.bas, []);
        m.get(g.bas).push(g);
    }
    return m;
}

/**
 * Steg 3 — bygg kandidatpar inom samma BAS. Per BAS väljs organisationens
 * egna icke-kv-dom yrken (intern, primärt); saknas sådant används jämförelsestatistiken
 * (extern fallback). Flagga par där jämförelseyrkets median > org-median.
 *
 * @param {Array} orgKvDom
 * @param {Map} internByBas - från orgIckeKvByBas()
 * @param {Map} externByBas - statByBas från klassificeraStatistik()
 * @param {Object} [opts] - { minGap, topN, B, rng, golv }
 * @returns {{pairs:Array, jämförelse:Object}}
 */
export function byggPar(orgKvDom, internByBas, externByBas, opts = {}) {
    const minGap = opts.minGap ?? 0;
    const topN = opts.topN ?? 100;
    const B = opts.B ?? 1000;
    const golv = opts.golv ?? ALDERS_GOLV_DEFAULT;
    // Utan explicit rng seedas bootstrappen PER PAR ur parets egna löner
    // (rngFor). Då blir konfidensintervallen reproducerbara mellan körningar —
    // ett Math.random-default gav nya KI varje gång och gjorde ett exporterat
    // underlag omöjligt att återskapa. Tester injicerar sin egen rng.
    const rngOpt = opts.rng ?? null;
    const prngFor = (a, b) => rngOpt || rngFor(a, b);
    const jämförelse = {
        gemensammaBas: 0, möjligaPar: 0, statHögre: 0, statLägreEllerLika: 0,
        internaPar: 0, externaPar: 0, basMedExternFallback: 0,
        kravProxy: 'bas', kvUtanPoang: 0
    };
    const pairs = [];
    internByBas = internByBas || new Map();
    externByBas = externByBas || new Map();
    if (!orgKvDom?.length || (!internByBas.size && !externByBas.size)) return { pairs, jämförelse };

    const orgBasSet = new Set(orgKvDom.map(f => f.bas));
    const jämförBasSet = new Set([...internByBas.keys(), ...externByBas.keys()]);
    jämförelse.gemensammaBas = [...orgBasSet].filter(b => jämförBasSet.has(b)).length;

    const candidates = [];
    for (const f of orgKvDom) {
        const internaRows = internByBas.get(f.bas) || [];
        const externaRows = externByBas.get(f.bas) || [];
        let jämförRader, källa;
        if (internaRows.length) {
            jämförRader = internaRows; källa = 'intern';
        } else if (externaRows.length) {
            jämförRader = externaRows; källa = 'extern';
            jämförelse.basMedExternFallback++;
        } else {
            continue;
        }
        for (const g of jämförRader) {
            jämförelse.möjligaPar++;
            if (g.median <= f.median) { jämförelse.statLägreEllerLika++; continue; }
            jämförelse.statHögre++;
            const gapKr = g.median - f.median;
            const gapPct = (gapKr / f.median) * 100;
            if (gapPct < minGap) continue;

            const ärIntern = källa === 'intern';
            /** @type {{lo:number, hi:number}|null} */
            let gapCI = null;
            try {
                gapCI = (ärIntern && Array.isArray(g.lons))
                    ? bootstrapMedianDiffKr(f.lons, g.lons, B, prngFor(f.lons, g.lons))
                    : bootstrapMedianVsConstantKr(f.lons, g.median, B, prngFor(f.lons, [g.median]));
            } catch (_) { gapCI = null; }

            if (ärIntern) jämförelse.internaPar++; else jämförelse.externaPar++;

            candidates.push({
                kvAid: f.aid, kvLabel: f.label, kvBas: f.bas,
                kvN: f.n, kvNKv: f.nKv, kvMedian: f.median, kvKvinnoPct: f.kvinnoPct,
                maAid: g.aid, maLabel: g.label, maBas: f.bas,
                maMedian: g.median,
                maKvAndel: ärIntern ? g.kvinnoPct : g.kvAndel,
                maN: ärIntern ? g.n : null,
                maNKv: g.nKv, maNMa: g.nMa,
                jamforKalla: källa,                       // 'intern' | 'extern'
                maKlassKort: ärIntern ? 'intern' : (g.källa === 'lokal' ? 'lokal' : 'SCB'),
                maScbKvAndel: ärIntern ? g.kvinnoPct : g.kvAndel,
                maScbPrefix: (!ärIntern && g.källa === 'scb') ? String(g.aid).slice(0, 3) : null,
                gapKr, gapPct, gapCI,
                ..._aldersFalt(f, g, ärIntern, golv),
                allvarsindex: Math.abs(gapKr) * f.n
            });
        }
    }
    candidates.sort((a, b) => b.gapPct - a.gapPct);
    return { pairs: candidates.slice(0, topN), jämförelse };
}

/**
 * Steg 3 (#5) — bygg kandidatpar med ARBETSVÄRDERINGSPOÄNG som krav-proxy
 * istället för BAS. Parar över BAS-gränser: ett jämförelseyrke kvalificerar om
 * dess poäng ≤ det kvinnodominerade yrkets poäng × (1 + band) — dvs likvärdiga
 * eller lägre krav (DiskrL 3:10). Intern jämförelse är primär; saknas internt
 * kvalificerande yrke används jämförelsestatistiken (extern fallback).
 *
 * @param {Array} orgKvDom
 * @param {Array} internAll - organisationens icke-kv-dom yrken (flat)
 * @param {Array} externAll - jämförelsestatistikens icke-kv-dom yrken (flat)
 * @param {Map<string,number>} poangByKey - 'AID|BAS' eller 'AID' → poäng
 * @param {Object} [opts] - { minGap, topN, B, rng, bandPct, golv }
 * @returns {{pairs:Array, jämförelse:Object}}
 */
export function byggParPoäng(orgKvDom, internAll, externAll, poangByKey, opts = {}) {
    const minGap = opts.minGap ?? 0;
    const topN = opts.topN ?? 100;
    const B = opts.B ?? 1000;
    const golv = opts.golv ?? ALDERS_GOLV_DEFAULT;
    // Utan explicit rng seedas bootstrappen PER PAR ur parets egna löner
    // (rngFor). Då blir konfidensintervallen reproducerbara mellan körningar —
    // ett Math.random-default gav nya KI varje gång och gjorde ett exporterat
    // underlag omöjligt att återskapa. Tester injicerar sin egen rng.
    const rngOpt = opts.rng ?? null;
    const prngFor = (a, b) => rngOpt || rngFor(a, b);
    const bandPct = opts.bandPct ?? 5;
    const jämförelse = {
        gemensammaBas: 0, möjligaPar: 0, statHögre: 0, statLägreEllerLika: 0,
        internaPar: 0, externaPar: 0, basMedExternFallback: 0,
        kravProxy: 'poäng', kvUtanPoang: 0
    };
    const pairs = [];
    orgKvDom = orgKvDom || [];
    internAll = internAll || [];
    externAll = externAll || [];
    poangByKey = poangByKey || new Map();
    if (!orgKvDom.length || !poangByKey.size) return { pairs, jämförelse };

    const poangFor = g => poangByKey.get(g.aid + '|' + g.bas) ?? poangByKey.get(String(g.aid)) ?? null;
    const candidates = [];
    for (const f of orgKvDom) {
        const fP = poangFor(f);
        if (fP == null) { jämförelse.kvUtanPoang++; continue; }
        const tak = fP * (1 + bandPct / 100);
        let jämförRader = internAll.filter(g => { const p = poangFor(g); return p != null && p <= tak; });
        let källa = 'intern';
        if (!jämförRader.length) {
            jämförRader = externAll.filter(g => { const p = poangFor(g); return p != null && p <= tak; });
            källa = 'extern';
            if (jämförRader.length) jämförelse.basMedExternFallback++;
        }
        for (const g of jämförRader) {
            jämförelse.möjligaPar++;
            if (g.median <= f.median) { jämförelse.statLägreEllerLika++; continue; }
            jämförelse.statHögre++;
            const gapKr = g.median - f.median;
            const gapPct = (gapKr / f.median) * 100;
            if (gapPct < minGap) continue;
            const ärIntern = källa === 'intern';
            /** @type {{lo:number, hi:number}|null} */
            let gapCI = null;
            try {
                gapCI = (ärIntern && Array.isArray(g.lons))
                    ? bootstrapMedianDiffKr(f.lons, g.lons, B, prngFor(f.lons, g.lons))
                    : bootstrapMedianVsConstantKr(f.lons, g.median, B, prngFor(f.lons, [g.median]));
            } catch (_) { gapCI = null; }
            if (ärIntern) jämförelse.internaPar++; else jämförelse.externaPar++;
            candidates.push({
                kvAid: f.aid, kvLabel: f.label, kvBas: f.bas,
                kvN: f.n, kvNKv: f.nKv, kvMedian: f.median, kvKvinnoPct: f.kvinnoPct,
                maAid: g.aid, maLabel: g.label, maBas: g.bas,
                maMedian: g.median,
                maKvAndel: ärIntern ? g.kvinnoPct : g.kvAndel,
                maN: ärIntern ? g.n : null,
                maNKv: g.nKv, maNMa: g.nMa,
                jamforKalla: källa,
                maKlassKort: ärIntern ? 'intern' : (g.källa === 'lokal' ? 'lokal' : 'SCB'),
                maScbKvAndel: ärIntern ? g.kvinnoPct : g.kvAndel,
                maScbPrefix: (!ärIntern && g.källa === 'scb') ? String(g.aid).slice(0, 3) : null,
                gapKr, gapPct, gapCI,
                ..._aldersFalt(f, g, ärIntern, golv),
                kvPoang: fP, maPoang: poangFor(g),
                allvarsindex: Math.abs(gapKr) * f.n
            });
        }
    }
    candidates.sort((a, b) => b.gapPct - a.gapPct);
    return { pairs: candidates.slice(0, topN), jämförelse };
}

/**
 * Lägre krav, högre lön (ADR-25): par där ett kvinnodominerat
 * yrke har lägre medianlön än ett av ORGANISATIONENS icke-kvinnodominerade yrken i
 * strikt LÄGRE BAS. BAS som krav-proxy — används bara när poäng saknas.
 *
 * @param {Array} orgKvDom
 * @param {Array} orgIckeKv
 * @param {Object} opts - { rang: bas → tal, minGap, topN, B, rng }
 * @returns {Array} par med samma fält som interna kandidatpar plus basSteg
 */
export function byggParLagreKrav(orgKvDom, orgIckeKv, opts = {}) {
    const { rang } = opts;
    const minGap = opts.minGap ?? 0, topN = opts.topN ?? 100, B = opts.B ?? 1000;
    const rngOpt = opts.rng ?? null;
    const ut = [];
    for (const f of orgKvDom || []) {
        const rf = rang(f.bas);
        for (const g of orgIckeKv || []) {
            const rg = rang(g.bas);
            if (!(rg < rf) || !(g.median > f.median)) continue;
            const gapKr = g.median - f.median;
            const gapPct = gapKr / f.median * 100;
            if (gapPct < minGap) continue;
            ut.push({ _f: f, _g: g,
                kvAid: f.aid, kvLabel: f.label, kvBas: f.bas, kvN: f.n, kvNKv: f.nKv, kvMedian: f.median, kvKvinnoPct: f.kvinnoPct,
                maAid: g.aid, maLabel: g.label, maBas: g.bas, maMedian: g.median, maKvAndel: g.kvinnoPct,
                maN: g.n, maNKv: g.nKv, maNMa: g.n - g.nKv,
                jamforKalla: 'intern', gapKr, gapPct, gapCI: null, basSteg: rf - rg,
            });
        }
    }
    ut.sort((a, b) => b.gapPct - a.gapPct || b.basSteg - a.basSteg);
    // Konfidensintervall bara för paren som behålls — sorteringen beror inte på dem, och
    // bootstrappen seedas per par, så resultatet blir detsamma som om alla räknats.
    return ut.slice(0, topN).map(({ _f, _g, ...p }) => {
        try { p.gapCI = bootstrapMedianDiffKr(_f.lons, _g.lons, B, rngOpt || rngFor(_f.lons, _g.lons)); } catch (_) { p.gapCI = null; }
        return p;
    });
}

/**
 * BAS-rang (BAS-ordningen är fast, se §5 i teknisk-plan.md): bokstavens plats i alfabetet, A=1, B=2 … Varje bokstav är ett lika brett
 * poängintervall i BAS-systemet, så ett BAS-steg är alltid ett intervall — B → D är två steg
 * även när C saknas i underlaget. Samma rang används av regressionerna och Lägre krav.
 * Något som inte är en bokstav läggs alfabetiskt efter bokstäverna.
 * @param {string[]} allaBas - BAS-värdena i underlaget (behövs bara för det som inte är bokstäver)
 * @returns {(bas:string) => number}
 */
export function basRangFn(allaBas) {
    const alfa = [...new Set(allaBas)].sort((a, b) => String(a).localeCompare(String(b), 'sv'));
    return b => { const i = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.indexOf(String(b).toUpperCase()); return String(b).length === 1 && i >= 0 ? i + 1 : 100 + alfa.indexOf(b); };
}

/**
 * Orkestrator — speglar app.js `computeLikvardighetPairs()` (utan state).
 *
 * @param {Object} [input]
 * @param {Array} [input.data] - organisationens individdata
 * @param {Array} [input.statistik] - jämförelsestatistiken
 * @param {((aid:string)=>({kvAndel:number}|null))|null} [input.scbKlass]
 * @param {Object} [input.opts] - { kvinnoTrosholdPct, minGapPct, topN, B, rng, k, aldersGolv }
 * @returns {{orgKvDom:Array, orgIckeKv:Array, statIckeKv:Array, pairs:Array, lagreKrav:Array, diagnostik:Object, opts:Object}}
 */
export function computeLikvardighetPairs({ data = [], statistik = [], scbKlass = null, opts = {} } = {}) {
    const kvinnoThr = opts.kvinnoTrosholdPct ?? KVINNO_TROSKEL_DEFAULT;
    const minGap = opts.minGapPct ?? 0;
    const topN = opts.topN ?? 100;
    const B = opts.B ?? 1000;
    // Skickas vidare ORÖRT: byggPar seedar per par ur parets egna löner när
    // ingen rng anges. Ett `?? Math.random` här hade satt opts.rng i varje
    // anrop och tyst slagit ut den seedningen — konfidensintervallen blev då
    // nya vid varje körning, vilket gör ett exporterat underlag omöjligt att
    // återskapa. Bara tester injicerar en egen rng.
    const rng = opts.rng;

    const poangByKey = opts.poangByKey || null;   // #5: arbetsvärdering som krav-proxy
    const bandPct = opts.poangBandPct ?? 5;
    const golv = opts.aldersGolv ?? ALDERS_GOLV_DEFAULT;   // minsta jämförelseyrke för åldersjusteringen

    // k-tröskeln används bara för att RÄKNA små kvinnodominerade grupper i diagnostiken (de ingår ändå).
    const s1 = aggregeraOrgKvDom(data, kvinnoThr, opts.k ?? 10);
    const s2 = klassificeraStatistik(statistik, scbKlass);
    const internByBas = orgIckeKvByBas(s1.orgIckeKv);
    const s3 = (poangByKey && poangByKey.size)
        ? byggParPoäng(s1.orgKvDom, s1.orgIckeKv, s2.statIckeKv, poangByKey, { minGap, topN, B, rng, bandPct, golv })
        : byggPar(s1.orgKvDom, internByBas, s2.statByBas, { minGap, topN, B, rng, golv });
    const lagreKrav = (poangByKey && poangByKey.size) ? [] : byggParLagreKrav(s1.orgKvDom, s1.orgIckeKv, {
        rang: basRangFn([...s1.orgKvDom, ...s1.orgIckeKv].map(g => g.bas)),
        minGap, topN, B, rng });

    return {
        orgKvDom: s1.orgKvDom,
        orgIckeKv: s1.orgIckeKv,
        statIckeKv: s2.statIckeKv,
        pairs: s3.pairs,
        lagreKrav,
        diagnostik: {
            organisation: {
                totalRader: data.length,
                antalAidxBas: s1.antalAidxBas,
                kvDomFunna: s1.orgKvDom.length,
                kvDomMedNLessThanK: s1.kvDomMedNLessThanK,
                ickeKvFunna: s1.orgIckeKv.length
            },
            statistik: {
                totalRader: statistik.length,
                klass: s2.klass,
                klassKalla: s2.klassKalla
            },
            jämförelse: s3.jämförelse,
            fel: []
        },
        opts: { kvinnoTrosholdPct: kvinnoThr, minGapPct: minGap, topN }
    };
}

// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
/**
 * Öppen lönekartläggning — Regressionsmodeller för lika arbete
 *
 * Rena, testbara modeller: OLS-baserad kollinearitetsdiagnos, gap per BAS
 * (betingade regressioner), sekventiell dekomponering med BAS-indikatorer och
 * yrkesgrupp inom BAS, kvantilregression (IRLS) samt Blinder-Oaxaca-
 * dekomposition. Modellerna tar allt de behöver som parametrar (rader, listor,
 * statGolv-värdet och förklaringsmodellen) och läser inget globalt tillstånd.
 *
 * Appen får dem genom lib-speglarna (ADR-8); src/app/50-regressionsmodeller.js
 * är den tunna adaptern som läser getData() och statGolv(). OLS-kärnan
 * (fitOLS, invert, matMul, pValue2Sided, tQuantile) ligger i stat.js. Ingen modell här
 * räknar BAS som ett tal; BAS-rangen (basRangFn) finns kvar i likvardighet.js för Lägre krav.
 *
 * @see 50-regressionsmodeller.js (adaptern i appen)
 */

import { fitOLS, invert, matMul, pValue2Sided, tQuantile } from './stat.js';

// ---- Förklaringsmodellen som värde (ADR-56) ----
// Vilka variabler huvudregressionen, trappan och Blinder-Oaxaca räknar bort utöver kön. Standard är ADR-44/46/53-modellen:
// BAS-intervall och ålder, utan yrkesgrupp. Lagras i appen som null när den är standard (12-tillstand.js).
export const FORKLARINGSMODELL_STANDARD = Object.freeze({ bas: true, alder: true, yrkesgrupp: false, skal: '' });
/** Under så många procentenheter i förklaringsgrad (R²) räknas en variabel som "tillför lite" (beslut 2026-11-05). */
export const TILLFOR_GRANS_PP = 0.5;
/** Gränsen som funktion, för appens spegel (speglarna bär bara funktioner). */
export function tillforGransPp() { return TILLFOR_GRANS_PP; }
const SKAL_MAX = 300;

/**
 * Har lönefilen ålder? Sant när minst en rad har en ålder över 0 (ADR-64). Ålderskolumnen är valfri: saknas den läser
 * inläsningen ålder 0 på varje rad, och då räknas modellerna utan ålder i stället för att alla rader faller bort.
 * @param {any[]} rows
 */
export function harAlderIRader(rows) {
    return (rows || []).some(d => d && d.alder > 0);
}
/** Raden har det som modellerna kräver: positiv lön, känt kön och, när lönefilen har ålder, en ålder över 0. */
const _modellRad = (d, harAlder) => d && d.lon > 0 && (!harAlder || d.alder > 0) && typeof d.kon === 'string'
    && (d.kon.includes('kvinna') || d.kon === 'man' || d.kon === 'män');

/**
 * Normaliserar ett värde från konfigurationsfilen eller gränssnittet till en giltig modell.
 * @param {any} v
 * @param {{harYrke?: boolean, harAlder?: boolean}} [opts] harYrke = datat har AID eller yrke (annars kan yrkesgrupp
 *   inte väljas); harAlder = lönefilen har ålder (annars räknas ålder inte bort, ADR-64)
 * @returns {{modell: {bas:boolean, alder:boolean, yrkesgrupp:boolean, skal:string}, varningar: string[]}}
 */
export function normaliseraForklaringsmodell(v, { harYrke = true, harAlder = true } = {}) {
    const varningar = [];
    const utanAlder = m => {
        if (m.alder && !harAlder) {
            m.alder = false;
            varningar.push('Ålder kan inte räknas bort: lönefilen saknar ålder.');
        }
        return m;
    };
    if (v == null) return { modell: utanAlder({ ...FORKLARINGSMODELL_STANDARD }), varningar };
    if (typeof v !== 'object' || Array.isArray(v)) {
        varningar.push('Förklaringsmodellen i filen gick inte att läsa; standardmodellen används.');
        return { modell: utanAlder({ ...FORKLARINGSMODELL_STANDARD }), varningar };
    }
    const modell = utanAlder({ bas: v.bas === true, alder: v.alder === true, yrkesgrupp: v.yrkesgrupp === true,
        skal: typeof v.skal === 'string' ? v.skal.slice(0, SKAL_MAX) : '' });
    if (modell.yrkesgrupp && !harYrke) {
        modell.yrkesgrupp = false;
        varningar.push('Yrkesgrupp inom BAS kan inte väljas: lönefilen saknar AID och yrke.');
    }
    if (modell.yrkesgrupp && !modell.bas) {
        modell.bas = true;
        varningar.push('Yrkesgrupp inom BAS förutsätter BAS-intervall; BAS är valt.');
    }
    return { modell, varningar };
}

/** @param {{bas:boolean, alder:boolean, yrkesgrupp:boolean, skal:string}} m */
export function forklaringsmodellArStandard(m) {
    const n = normaliseraForklaringsmodell(m).modell;
    return n.bas === FORKLARINGSMODELL_STANDARD.bas && n.alder === FORKLARINGSMODELL_STANDARD.alder
        && n.yrkesgrupp === FORKLARINGSMODELL_STANDARD.yrkesgrupp && n.skal === FORKLARINGSMODELL_STANDARD.skal;
}

/** Variablerna i modellen i den fasta ordningen BAS, ålder, yrkesgrupp. @returns {Array<'bas'|'alder'|'yrkesgrupp'>} */
export function modellVariabler(m) {
    return /** @type {Array<'bas'|'alder'|'yrkesgrupp'>} */ (['bas', 'alder', 'yrkesgrupp'].filter(k => m && m[k] === true));
}

/** Frasen i löptext: "när {fras} räknats bort". Tom sträng för endast kön. */
export function modellFras(m) {
    const delar = [];
    if (m && m.alder) delar.push('ålder');
    if (m && m.bas) delar.push('BAS-intervall');
    if (m && m.yrkesgrupp) delar.push('yrkesgrupp');
    if (delar.length <= 1) return delar.join('');
    return `${delar.slice(0, -1).join(', ')} och ${delar[delar.length - 1]}`;
}

/** Modellen i ord för modelDesc och rapporten: "kön + ålder + BAS-intervall (indikatorer)". */
export function modellBeskrivning(m) {
    const delar = ['kön'];
    if (m && m.alder) delar.push('ålder');
    if (m && m.bas) delar.push('BAS-intervall (indikatorer)');
    if (m && m.yrkesgrupp) delar.push('yrkesgrupp inom BAS (fasta effekter)');
    return delar.join(' + ');
}

// Diagnostiserar varför modellen misslyckas
export function diagnoseCollinearity(rows, basList) {
    const issues = [];
    // Helt enkönade BAS
    let singleSexBas = 0;
    basList.forEach(b => {
        const sub = rows.filter(d => d.bas === b);
        if (sub.length < 3) return;
        const hasKv = sub.some(d => d.kon.includes('kvinna'));
        const hasMa = sub.some(d => d.kon === 'man' || d.kon === 'män');
        if (!hasKv || !hasMa) singleSexBas++;
    });
    if (singleSexBas > 0) issues.push(`<strong>${singleSexBas}</strong> BAS-intervall är helt enkönade – könseffekten kan inte estimeras inom dessa.`);
    if (basList.length < 2) issues.push(`Endast <strong>${basList.length}</strong> BAS-intervall i urvalet – ingen variation att estimera BAS-effekten med.`);
    if (rows.length < 50)  issues.push(`Litet urval (n=${rows.length}) – kan ge instabila estimat.`);
    return issues;
}

// Per-BAS conditional regressions: gap inom varje BAS efter ålderskontroll.
// golv = statGolv(): minsta antal per kön i en BAS för att en regression ska köras. Utan ålder i lönefilen (ADR-64)
// skattas kön ensamt inom varje BAS.
export function computePerBasGap(rows, basList, { golv }) {
    // Modellen tar log(lön) och kodar kön binärt. Rader utan positiv lön ger
    // -Infinity, rader utan ålder skevar centreringen, och rader med okänt kön
    // skulle räknas som MÄN av `kon.includes('kvinna') ? 1 : 0`. Filtret hör
    // därför hemma här i stället för hos anroparen — av tre anropare skickade
    // två in ofiltrerad getData() (JPA-exporten och gruppdossiern).
    const harAlder = harAlderIRader(rows);
    const giltiga = (rows || []).filter(d => _modellRad(d, harAlder));
    const out = [];
    basList.forEach(b => {
        const sub = giltiga.filter(d => d.bas === b);
        const kv  = sub.filter(d => d.kon.includes('kvinna'));
        const ma  = sub.filter(d => d.kon === 'man' || d.kon === 'män');
        if (kv.length < golv || ma.length < golv) {
            out.push({ bas: b, n: sub.length, kvN: kv.length, maN: ma.length, status: 'too_few' });
            return;
        }
        const aMean = harAlder ? sub.reduce((s,d)=>s+d.alder,0)/sub.length : 0;
        const X = sub.map(d => [1, d.kon.includes('kvinna')?1:0, ...(harAlder ? [d.alder - aMean] : [])]);
        const y = sub.map(d => Math.log(d.lon));
        const fit = fitOLS(X, y);
        if (!fit) { out.push({ bas: b, n: sub.length, kvN: kv.length, maN: ma.length, status: 'singular' }); return; }
        const beta = fit.beta[1];
        const se   = Math.sqrt(fit.vcovHC3[1][1]); // HC3 robust SE
        const p    = pValue2Sided(beta/se, fit.n, fit.k);
        const tq   = tQuantile(0.975, fit.n - fit.k);   // t-kvantil för 95 % KI (1,96 vid df ≥ 100)
        const ciLo = (Math.exp(beta - tq*se) - 1) * 100;
        const ciHi = (Math.exp(beta + tq*se) - 1) * 100;
        out.push({ bas: b, n: sub.length, kvN: kv.length, maN: ma.length, gapPct: (Math.exp(beta)-1)*100, ciLow: ciLo, ciHigh: ciHi, pValue: p, R2: fit.R2, status: 'ok' });
    });
    return out;
}

// Sekventiell dekomponering: visa hur gapet krymper när kontroller läggs till
// BAS kodas som indikatorvariabler (en kolumn per BAS-intervall utom det första, som är referens),
// så att varje intervall får sin egen nivå — ingen antagen lika stor löneskillnad per bokstav.
export function basIndikatorer(basList) {
    return basList.slice(1);
}

// golv = statGolv(): minsta antal per kön för att ett ansvarssteg ska redovisas.
// modell = förklaringsmodellen (ADR-56): stegen är "Endast kön" följt av ett steg per vald variabel i ordningen
// BAS, ålder, yrkesgrupp, var och en ovanpå de föregående. Yrkesgruppssteget räknas alltid när BAS är med (det
// visas efter huvudtalet när det inte är valt, ADR-46); "+ Ansvar" läggs sist ovanpå den valda modellen.
export function computeSequentialGap(rows, ageMean, basList, { golv, modell = FORKLARINGSMODELL_STANDARD }) {
    const m = normaliseraForklaringsmodell(modell, { harAlder: harAlderIRader(rows) }).modell;
    const { y, isKv, ageC, bygg, skatta, steg } = _sekvensRigg(rows, ageMean, basList);
    const olsVar = modellVariabler(m).filter(v => v !== 'yrkesgrupp');
    const ut = steg(olsVar).map(skatta);
    const medAlder = m.alder;
    // Yrkesgrupp inom BAS (ADR-46): sist bland modellens steg; utan ålder vald räknas det utan ålderskolumnen.
    if (m.bas) ut.push(computeYrkesgruppGap(rows, y, isKv, ageC, { medAlder }));
    // Ansvar (ansvarskod) som eget sista steg: en indikator per ansvarsgrupp med minst k personer;
    // mindre grupper räknas med "inget". Redovisas separat, inte i huvudtalet (ADR-33).
    const grupper = ['ledning', 'uppdrag'].filter(g => rows.filter(r => r.ansvarsgrupp === g).length >= golv);
    if (rows.some(r => r.ansvarsgrupp) && grupper.length) {
        const ansvar = rows.map(d => grupper.map(g => (d.ansvarsgrupp === g ? 1 : 0)));
        ut.push(m.yrkesgrupp
            ? computeYrkesgruppGap(rows, y, isKv, ageC, { medAlder, extra: ansvar, name: '+ Ansvar' })
            : skatta({ name: '+ Ansvar', X: bygg(olsVar, i => ansvar[i]) }));
    }
    return ut;
}

/**
 * Vad varje variabel tillför (ADR-56): förklaringsgraden och könsgapet med och utan variabeln, räknat mot
 * fullmodellen kön + BAS + ålder oberoende av vad som är valt, så att tabellen i panelen står still när man
 * kryssar. Yrkesgrupp mäts ovanpå fullmodellen (den är en tilläggsvariabel, aldrig i förslaget). Utan ålder i
 * lönefilen (ADR-64) är fullmodellen kön + BAS och ålder får ingen rad.
 * @param {any[]} rows @param {number} ageMean @param {string[]} basList
 * @param {{golv:number, harYrke?:boolean}} opts harYrke = datat har AID eller yrke
 * @returns {{full:{status:string, gapPct?:number, R2?:number, k?:number},
 *   rader:Array<{variabel:'bas'|'alder'|'yrkesgrupp', deltaR2pp:number, gapUtan:number, gapMed:number, tillforLite:boolean, status:string}>,
 *   forslag:{tabort:string[]}}}
 */
export function computeVariabelTillfor(rows, ageMean, basList, { golv: _golv, harYrke = false }) {
    const { y, isKv, ageC, bygg, skatta } = _sekvensRigg(rows, ageMean, basList);
    const fit = vars => skatta({ name: vars.join('+'), X: bygg(vars) });
    const harAlder = harAlderIRader(rows);
    const full = fit(harAlder ? ['bas', 'alder'] : ['bas']);
    const rad = (variabel, utan, med) => {
        const status = utan.status === 'ok' && med.status === 'ok' ? 'ok' : utan.status !== 'ok' ? utan.status : med.status;
        const ok = status === 'ok';
        const deltaR2pp = ok ? (med.R2 - utan.R2) * 100 : NaN;
        return { variabel, status, deltaR2pp, gapUtan: ok ? utan.gapPct : NaN, gapMed: ok ? med.gapPct : NaN,
            tillforLite: ok && deltaR2pp < TILLFOR_GRANS_PP };
    };
    const rader = harAlder ? [rad('bas', fit(['alder']), full), rad('alder', fit(['bas']), full)] : [rad('bas', fit([]), full)];
    if (harYrke) rader.push(rad('yrkesgrupp', full, computeYrkesgruppGap(rows, y, isKv, ageC, { medAlder: harAlder })));
    const tabort = rader.filter(r => r.variabel !== 'yrkesgrupp' && r.tillforLite).map(r => r.variabel);
    return { full, rader, forslag: { tabort } };
}

// Det gemensamma underlaget för stegen: logaritmerad lön, könsindikator, centrerad ålder, BAS-indikatorer och
// hjälparna som bygger en designmatris av valda variabler och skattar ett steg.
function _sekvensRigg(rows, ageMean, basList) {
    const N = rows.length;
    const y    = rows.map(d => Math.log(d.lon));
    const isKv = rows.map(d => d.kon.includes('kvinna') ? 1 : 0);
    const ageC = rows.map(d => d.alder - ageMean);
    const basInd = basIndikatorer(basList);
    const basD = rows.map(d => basInd.map(b => (d.bas === b ? 1 : 0)));
    const kolumn = { bas: i => basD[i], alder: i => [ageC[i]] };
    /** @param {string[]} vars @param {(i:number) => number[]} [extra] */
    const bygg = (vars, extra = () => []) => rows.map((_, i) => [1, isKv[i], ...vars.flatMap(v => kolumn[v](i)), ...extra(i)]);
    const namn = { bas: '+ BAS-intervall', alder: '+ Ålder' };
    /** @param {string[]} vars */
    const steg = vars => [{ name: 'Endast kön', X: bygg([]) }, ...vars.map((v, j) => ({ name: namn[v], X: bygg(vars.slice(0, j + 1)) }))];
    /** @param {{name:string, X:number[][]}} s @returns {{name:string, status:string, gapPct?:number, R2?:number, k?:number, nGrupper?:number, nGrupperBada?:number, nPersoner?:number, nEnkonade?:number}} */
    const skatta = s => {
        if (N < s.X[0].length + 5) return { name: s.name, status: 'too_few' };
        const fit = fitOLS(s.X, y);
        if (!fit) return { name: s.name, status: 'singular' };
        return { name: s.name, status: 'ok', gapPct: (Math.exp(fit.beta[1]) - 1) * 100, R2: fit.R2, k: fit.k };
    };
    return { y, isKv, ageC, bygg, skatta, steg };
}

/**
 * Steget "+ Yrkesgrupp": könsgapet efter fasta effekter för yrkesgrupp inom BAS (AID×BAS),
 * utöver ålder — löneskillnaden mellan kvinnor och män med samma yrkesgrupp, BAS och ålder.
 *
 * Skattas med inomtransformation (within-estimator): gruppmedelvärdet dras av från log-lön,
 * kön och ålder inom varje AID×BAS-grupp, och OLS körs utan intercept på de transformerade
 * variablerna. Det ger exakt samma könskoefficient som en indikator per grupp skulle ge
 * (Frisch–Waugh–Lovell), men går på 55 000 rader utan en designmatris med hundratals
 * kolumner. R² räknas mot den otransformerade lönens totala variation, så att den är
 * jämförbar med stegen före.
 *
 * Grupper med färre än statGolv() av något kön ingår i skattningen — gruppmedelvärdet är
 * ett mellanled, inte ett redovisat värde — men bara grupper med båda könen bidrar till
 * könskoefficienten (i en enkönad grupp är det transformerade könet noll). Antalet grupper
 * och personer steget bygger på följer med i resultatet.
 * Gruppnyckeln är AID-koden (eller yrket när AID saknas) inom BAS, samma som § 3:10-motorn.
 * Modellen läser ingen golv-gräns, så den tar inte emot golv (statGolv används bara i ansvarssteget).
 * medAlder = false utelämnar ålderskolumnen (ålder inte vald, ADR-56); extra = ytterligare kolumner per rad som
 * inomtransformeras i samma grupper (ansvarssteget ovanpå yrkesgrupp); name = stegets namn.
 * @returns {{name:string, status:string, gapPct?:number, R2?:number, k?:number,
 *           nGrupper?:number, nGrupperBada?:number, nPersoner?:number, nEnkonade?:number}}
 */
export function computeYrkesgruppGap(rows, y, isKv, ageC, { medAlder = true, extra = null, name = '+ Yrkesgrupp' } = {}) {
    if (!rows.some(d => d.aid || d.yrke)) return { name, status: 'too_few', nGrupper: 0, nGrupperBada: 0, nPersoner: 0, nEnkonade: 0 };
    // Kolumnerna som inomtransformeras: kön, (ålder), (extra kolumner, t.ex. ansvarsindikatorer).
    const kol = rows.map((_, i) => [isKv[i], ...(medAlder ? [ageC[i]] : []), ...(extra ? extra[i] : [])]);
    const inom = inomYrkesgrupp(rows, y, kol);
    if (!inom.ok) return { name, status: 'too_few', ...inom.meta };
    const fit = fitOLS(inom.X, inom.yW);
    if (!fit) return { name, status: 'singular', ...inom.meta };
    return {
        name, status: 'ok',
        gapPct: (Math.exp(fit.beta[0]) - 1) * 100,
        R2: inom.R2Total(fit.rss),
        k: inom.k,
        ...inom.meta
    };
}

/**
 * Inomtransformationen för yrkesgrupp inom BAS (ADR-46): drar gruppmedelvärdet från log-lön och från varje kolumn i
 * `kol` inom AID×BAS-gruppen. Delas av steget + Yrkesgrupp och av huvudregressionen när yrkesgrupp är vald (ADR-56).
 * @param {any[]} rows @param {number[]} y @param {number[][]} kol kolumner per rad (utan intercept)
 * @returns {{ok:boolean, X:number[][], yW:number[], k:number, nGrupper:number, meta:{nGrupper:number, nGrupperBada:number, nPersoner:number, nEnkonade:number}, R2Total:(rss:number)=>number}}
 */
export function inomYrkesgrupp(rows, y, kol) {
    const N = rows.length;
    const p = kol[0].length;
    const nyckel = d => `${(d.aid || d.yrke || '').toString().trim()}|${d.bas ?? ''}`;
    const grupper = new Map();   // nyckel → { n, sy, s[] (summa per kolumn), kv, ma }
    const key = new Array(N);
    for (let i = 0; i < N; i++) {
        const k = nyckel(rows[i]); key[i] = k;
        let g = grupper.get(k);
        if (!g) { g = { n: 0, sy: 0, s: new Array(p).fill(0), kv: 0, ma: 0 }; grupper.set(k, g); }
        g.n++; g.sy += y[i]; for (let j = 0; j < p; j++) g.s[j] += kol[i][j];
        if (kol[i][0]) g.kv++; else g.ma++;   // kolumn 0 är könsindikatorn
    }
    let nGrupperBada = 0, nPersoner = 0;
    grupper.forEach(g => { if (g.kv > 0 && g.ma > 0) { nGrupperBada++; nPersoner += g.n; } });
    const meta = { nGrupper: grupper.size, nGrupperBada, nPersoner, nEnkonade: grupper.size - nGrupperBada };
    const yMedel = y.reduce((s, v) => s + v, 0) / N;
    let tss = 0; for (let i = 0; i < N; i++) tss += (y[i] - yMedel) ** 2;
    const R2Total = rss => (tss > 0 ? 1 - rss / tss : 0);
    // Frihetsgrader: lutningarna plus en nivå per grupp
    if (N < grupper.size + p + 5 || nGrupperBada === 0) return { ok: false, X: [], yW: [], k: p + grupper.size, nGrupper: grupper.size, meta, R2Total };
    const X = new Array(N), yW = new Array(N);
    for (let i = 0; i < N; i++) {
        const g = grupper.get(key[i]);
        X[i] = kol[i].map((v, j) => v - g.s[j] / g.n);
        yW[i] = y[i] - g.sy / g.n;
    }
    return { ok: true, X, yW, k: p + grupper.size, nGrupper: grupper.size, meta, R2Total };
}

/**
 * Kvantilregression via IRLS (Iteratively Reweighted Least Squares).
 * Estimerar τ:te kvantilen istället för medelvärdet. Ger insyn i hur lönegapet
 * beter sig i olika delar av lönefördelningen ("glasstaket" vs "klistergolvet").
 * Startvärde tas från OLS för snabb konvergens. eps = 1e-6 hindrar division-med-noll
 * när residual ≈ 0.
 * @param {number[][]} X - n×k designmatris.
 * @param {number[]} y - n-vektor (typiskt log(lön)).
 * @param {number} tau - Kvantil ∈ (0,1), t.ex. 0.5 för median, 0.9 för P90.
 * @param {number} [maxIter=60]
 * @param {number} [tol=1e-5]
 * @param {number[]|null} [start] - startvärde för β (annars OLS-lösningen); påverkar bara hur snabbt det konvergerar.
 * @returns {null | {beta:number[]}} null om n < k+5 eller XtWX singulär.
 */
export function quantileRegression(X, y, tau, maxIter = 60, tol = 1e-5, start = null) {
    const n = X.length, k = X[0].length;
    if (n < k + 5) return null;
    // Starta från OLS för snabb konvergens, eller från ett givet startvärde (bootstrappen startar i punktskattningen)
    let beta;
    if (Array.isArray(start) && start.length === k && start.every(Number.isFinite)) beta = start.slice();
    else {
        const olsFit = fitOLS(X, y);
        if (!olsFit) return null;
        beta = olsFit.beta.slice();
    }
    const eps = 1e-6;
    // Bara radernas nollskilda kolumner räknas (BAS-indikatorerna är mest nollor, ADR-63), i platta typade fält; en
    // nolla bidrar inte till någon summa och ordningen är densamma, så resultatet är detsamma som med hela raden.
    const rs = new Int32Array(n + 1);
    for (let i = 0; i < n; i++) { let c = 0; for (let j = 0; j < k; j++) if (X[i][j] !== 0) c++; rs[i + 1] = rs[i] + c; }
    const kol = new Int32Array(rs[n]), val = new Float64Array(rs[n]);
    for (let i = 0, p = 0; i < n; i++) for (let j = 0; j < k; j++) if (X[i][j] !== 0) { kol[p] = j; val[p] = X[i][j]; p++; }
    const S = new Float64Array(k * k), w = new Float64Array(n);
    for (let iter = 0; iter < maxIter; iter++) {
        for (let i = 0; i < n; i++) {
            let yhat = 0;
            for (let p = rs[i]; p < rs[i + 1]; p++) yhat += val[p] * beta[kol[p]];
            const r = y[i] - yhat;
            const wTau = r >= 0 ? tau : (1 - tau);
            w[i] = wTau / Math.max(Math.abs(r), eps);
        }
        // Lös WLS: β = (X' W X)^-1 X' W y
        S.fill(0);
        const XtWy = new Array(k).fill(0);
        for (let i = 0; i < n; i++) {
            const wi = w[i], yi = y[i], p0 = rs[i], p1 = rs[i + 1];
            for (let p = p0; p < p1; p++) {
                const a = kol[p], xa = val[p];
                XtWy[a] += wi * xa * yi;
                const rad = a * k;
                for (let q = p0; q < p1; q++) S[rad + kol[q]] += wi * xa * val[q];
            }
        }
        const XtWX = Array.from({ length: k }, (_, a) => Array.from(S.subarray(a * k, a * k + k)));
        const inv = invert(XtWX);
        if (!inv) return null;
        const newBeta = matMul(inv, XtWy.map(v => [v])).map(r => r[0]);
        // Konvergens-check
        let delta = 0;
        for (let i = 0; i < k; i++) delta += Math.abs(newBeta[i] - beta[i]);
        beta = newBeta;
        if (delta < tol) break;
    }
    return { beta };
}

/**
 * Blinder-Oaxaca-dekomposition (Blinder 1973, Oaxaca 1973).
 *
 * Bryter ned rågapet i ln(lön) mellan män och kvinnor i tre komponenter:
 *
 *   ΔÄ = (X̄_M − X̄_F) · β_F   +   X̄_F · (β_M − β_F)   +   (X̄_M − X̄_F) · (β_M − β_F)
 *        ──────── Endowment ────   ──── Coefficient ────   ────── Interaction ──────
 *
 * "Endowment" = skillnaden förklaras av att män och kvinnor har olika
 *    karakteristika (ålder, BAS-fördelning) värderade till kvinnornas
 *    avkastning. Detta är den "förklarade" delen.
 * "Coefficient" = män får olika avkastning på samma karakteristika.
 * "Interaction" = samspel mellan skillnader i karakteristika och
 *    skillnader i avkastning. Räknas som "oförklarat" i en tredelad uppdelning.
 *
 * Klassisk presentation (Medlingsinstitutet använder denna form):
 *   Förklarat   = Endowment
 *   Oförklarat  = Coefficient + Interaction
 *
 * Modell: ln(lön) ~ ålder (centrerad) + en indikator per BAS-intervall — samma kodning som huvudregressionen
 * (ADR-44, ADR-53) — körd separat för kvinnor respektive män. Med förklaringsmodellen (ADR-56) kan ålder eller
 * BAS utelämnas, och yrkesgrupp inom BAS ersätter BAS-indikatorerna med en indikator per AID×BAS-grupp (samma
 * referensregel; komponenten heter då yrke). Endast kön ger null. Referensintervallet är det alfabetiskt första
 * som finns hos BÅDA könen; ett intervall som bara finns hos ett kön får en indikator bara i det könets modell
 * (det andra könets koefficient är 0), så dess bidrag hamnar i samspelet. Komponenterna redovisas per
 * variabel som intercept, ålder och BAS, där BAS är summan över indikatorerna.
 *
 * @param {any[]} rows - råradernas poster; filtreras här på lön, ålder och kön.
 * @param {{golv:number, modell?:any}} opts golv = statGolv(); modell = förklaringsmodellen.
 * @returns {null | {
 *   modell:{bas:boolean, alder:boolean, yrkesgrupp:boolean, skal:string},
 *   rawGapPct:number, explainedPct:number, unexplainedPct:number,
 *   endowmentPct:number, coefficientPct:number, interactionPct:number,
 *   components:{[k:string]:{q:number,u:number,i:number}},
 *   basRef:string|null, basIndikatorer:string[], gruppRef:string|null, gruppIndikatorer:string[],
 *   n:number, nKv:number, nMa:number,
 *   _raw:{rawGapLog:number, q:number, u:number, i:number}
 * }}
 */
export function blinderOaxaca(rows, { golv, modell = FORKLARINGSMODELL_STANDARD }) {
    const harAlder = harAlderIRader(rows);
    const m = normaliseraForklaringsmodell(modell, { harYrke: rows.some(d => d.aid || d.yrke), harAlder }).modell;
    if (!m.bas && !m.alder) return null;   // endast kön: inget att dela upp
    const raw = rows.filter(d => _modellRad(d, harAlder));
    if (raw.length < 50) return null;
    const kv = raw.filter(d => d.kon.includes('kvinna'));
    const ma = raw.filter(d => d.kon === 'man' || d.kon === 'män');
    if (kv.length < golv || ma.length < golv) return null;

    const ageMean = raw.reduce((s, d) => s + d.alder, 0) / raw.length;
    // Gruppindikatorerna: BAS, eller yrkesgrupp inom BAS (nyckel som computeYrkesgruppGap) när den är vald.
    const gruppAv = m.yrkesgrupp ? (d => `${(d.aid || d.yrke || '').toString().trim()}|${d.bas ?? ''}`) : (d => d.bas);
    const gruppNamn = m.yrkesgrupp ? 'yrke' : 'bas';
    let gruppRef = null, indikatorer = [];
    if (m.bas) {
        const alla = [...new Set(raw.map(gruppAv))].sort();
        const harKv = new Set(kv.map(gruppAv)), harMa = new Set(ma.map(gruppAv));
        gruppRef = alla.find(g => harKv.has(g) && harMa.has(g));
        if (gruppRef == null) return null;
        indikatorer = alla.filter(g => g !== gruppRef);
    }
    // Kolumnernas namn: konstant, (ålder), en per indikator. Komponenterna summeras per namn.
    const kolNamn = ['intercept', ...(m.alder ? ['age'] : []), ...indikatorer.map(() => gruppNamn)];
    const p = kolNamn.length;

    // Designmatris för en grupp: [1, (ålder − ageMean), indikator per grupp utom referensen]. En indikator som är noll
    // för alla i gruppen (gruppen saknas hos könet) lämnas utanför gruppens skattning och får β = 0.
    const kolumner = group => indikatorer.map(g => group.some(d => gruppAv(d) === g));
    const design = (group, med) => ({
        X: group.map(d => [1, ...(m.alder ? [d.alder - ageMean] : []), ...indikatorer.filter((_, j) => med[j]).map(g => (gruppAv(d) === g ? 1 : 0))]),
        y: group.map(d => Math.log(d.lon)) });
    const medKv = kolumner(kv), medMa = kolumner(ma);
    const dKv = design(kv, medKv), dMa = design(ma, medMa);
    const fitK = fitOLS(dKv.X, dKv.y);
    const fitM = fitOLS(dMa.X, dMa.y);
    if (!fitK || !fitM) return null;
    const fasta = m.alder ? 2 : 1;
    // Koefficienter i full längd, 0 där gruppen saknas hos könet.
    const fullBeta = (fit, med) => { const b = fit.beta.slice(0, fasta); let j = fasta; for (const x of med) b.push(x ? fit.beta[j++] : 0); return b; };
    const betaKv = fullBeta(fitK, medKv), betaMa = fullBeta(fitM, medMa);

    // Gruppmedelvärden för X̄ i full längd.
    const meanX = group => {
        const out = new Array(p).fill(0);
        for (const d of group) {
            out[0] += 1;
            if (m.alder) out[1] += d.alder - ageMean;
            const g = gruppAv(d);
            indikatorer.forEach((b, j) => { if (g === b) out[fasta + j] += 1; });
        }
        return out.map(v => v / group.length);
    };
    const xKv = meanX(kv), xMa = meanX(ma);

    const dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0);
    const rawGapLog = dot(xMa, betaMa) - dot(xKv, betaKv);

    // Dekomposition per kolumn; indikatorerna summeras till en komponent (bas eller yrke).
    /** @type {{[k:string]: {q:number,u:number,i:number}}} */
    const components = {};
    for (const k of kolNamn) if (!components[k]) components[k] = { q: 0, u: 0, i: 0 };
    let qSum = 0, uSum = 0, iSum = 0;
    for (let k = 0; k < p; k++) {
        const dx = xMa[k] - xKv[k];          // skillnad i karakteristika
        const db = betaMa[k] - betaKv[k];    // skillnad i koefficient
        const q = dx * betaKv[k];            // endowment
        const u = xKv[k] * db;               // coefficient
        const i = dx * db;                   // interaction
        const c = components[kolNamn[k]];
        c.q += q; c.u += u; c.i += i;
        qSum += q; uSum += u; iSum += i;
    }
    // Kontroll: qSum + uSum + iSum ≈ rawGapLog (avvikelse ~1e-10 förväntas pga floating point)

    // Konvertera log-komponenter till %-skillnad: (exp(c) − 1) × 100
    const pct = c => (Math.exp(c) - 1) * 100;

    return {
        modell: m,
        rawGapPct: pct(rawGapLog),
        endowmentPct: pct(qSum),
        coefficientPct: pct(uSum),
        interactionPct: pct(iSum),
        explainedPct: pct(qSum),
        unexplainedPct: pct(uSum + iSum),
        components,
        // BAS-fälten när BAS-indikatorer används, gruppfälten när yrkesgrupp inom BAS används (null annars).
        basRef: m.bas && !m.yrkesgrupp ? gruppRef : null, basIndikatorer: m.bas && !m.yrkesgrupp ? indikatorer : [],
        gruppRef: m.yrkesgrupp ? gruppRef : null, gruppIndikatorer: m.yrkesgrupp ? indikatorer : [],
        n: raw.length, nKv: kv.length, nMa: ma.length,
        // Råa log-värden för exakt summa-verifiering i tester
        _raw: { rawGapLog, q: qSum, u: uSum, i: iSum }
    };
}

/**
 * Kvantilregressionens design (ADR-63): samma variabler som huvudregressionen enligt förklaringsmodellen, utan
 * yrkesgrupp inom BAS — intercept, kön, [ålder centrerad på radmedel], [en indikator per BAS-intervall utom det
 * första, som är referens]. Matrisen byggs med samma hjälpare som stegen i den sekventiella dekomponeringen
 * (_sekvensRigg). Raderna filtreras här (lön > 0, kvinna eller man, ålder > 0 bara när ålder är med i modellen),
 * så att punktskattningen och bootstrappen i appen räknar på exakt samma matris.
 * @param {any[]} rows - råradernas poster.
 * @param {any} [modell] - förklaringsmodellen (normaliseras; yrkesgrupp ingår aldrig).
 * @param {{ageMean?:number, basList?:string[]}} [opts] ageMean/basList ges utifrån eller räknas ur raderna
 *   (basList sorterad, referens = första).
 * @returns {{rader:any[], X:number[][], y:number[], kolumner:string[], ageMean:number, basList:string[],
 *   modell:{bas:boolean, alder:boolean}}}
 */
export function kvantilDesign(rows, modell = FORKLARINGSMODELL_STANDARD, { ageMean, basList } = {}) {
    // Utan ålder i lönefilen (ADR-64) räknas modellen utan ålder, som i huvudregressionen.
    const m = normaliseraForklaringsmodell(modell, { harAlder: harAlderIRader(rows) }).modell;
    const rader = rows.filter(d => d.lon > 0 && (!m.alder || d.alder > 0)
        && typeof d.kon === 'string' && (d.kon.includes('kvinna') || d.kon === 'man' || d.kon === 'män'));
    const bl = m.bas ? (basList || [...new Set(rader.map(d => d.bas))].sort()) : [];
    const am = m.alder ? (ageMean != null ? ageMean : rader.reduce((s, d) => s + d.alder, 0) / (rader.length || 1)) : NaN;
    const vars = ['alder', 'bas'].filter(v => m[v]);
    const X = rader.length ? _sekvensRigg(rader, am, bl).bygg(vars) : [];
    const kolumner = ['intercept', 'kvinna', ...vars.flatMap(v => (v === 'alder' ? ['alder'] : basIndikatorer(bl).map(b => `bas:${b}`)))];
    return { rader, X, y: rader.map(d => Math.log(d.lon)), kolumner, ageMean: am, basList: bl, modell: { bas: m.bas, alder: m.alder } };
}

/**
 * Kör kvantilregression vid τ ∈ {.10, .50, .90} på kvantilDesign (samma variabler som huvudregressionen, utan
 * yrkesgrupp; ADR-63) och returnerar löneskillnaden i procent vid varje kvantil och skillnaden P90 − P10 i
 * procentenheter (negativ: skillnaden till kvinnornas nackdel är större i toppen än i botten).
 * Används för analysen av glastak och klibbigt golv i UI:t.
 * @param {any[]} rows - råradernas poster; filtreras i kvantilDesign.
 * @param {{modell?:any, ageMean?:number, basList?:string[]}} [opts] modell = förklaringsmodellen.
 * @returns {null | {results:Array<{tau:number, konPct?:number, error?:true}>, diffP90P10:number|null,
 *   kolumner:string[], n:number, nKv:number, nMa:number}} null om N < 50.
 */
export function quantileRegressionAtAllTau(rows, { modell = FORKLARINGSMODELL_STANDARD, ageMean, basList } = {}) {
    const d = kvantilDesign(rows, modell, { ageMean, basList });
    if (d.rader.length < 50) return null; // för litet urval för stabil kvantilregression
    const results = [];
    for (const tau of [0.1, 0.5, 0.9]) {
        const fit = quantileRegression(d.X, d.y, tau);
        if (!fit) { results.push({ tau, error: true }); continue; }
        results.push({ tau, konPct: (Math.exp(fit.beta[1]) - 1) * 100 });
    }
    const p10 = results[0], p90 = results[2];
    const diffP90P10 = p10.error || p90.error ? null : p90.konPct - p10.konPct;
    const nKv = d.rader.filter(r => r.kon.includes('kvinna')).length;
    return { results, diffP90P10, kolumner: d.kolumner, n: d.rader.length, nKv, nMa: d.rader.length - nKv };
}

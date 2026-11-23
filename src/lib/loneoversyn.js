// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
/**
 * Öppen lönekartläggning — Pure löneöversyns-/prognosfunktioner
 *
 * Budget-först-modell: en pott (kr eller % av lönesumman) fördelas GENERELLT
 * (till alla) + RIKTAT (till valda BAS→AID-grupper), och utfallet (nya löner,
 * budgetutnyttjande, råa lönegapet före/efter) beräknas.
 *
 * Separat från app.js för att kunna testas via Vitest utan DOM/state.
 * app.js får en AUTO-GENERERAD spegel (`_fc*` i src/app/09-lib-speglar.js via
 * tools/gen-mirrors.mjs) — ändra här och kör `npm run build:app`, rör ej spegeln
 * (vaktas av artefaktgrinden). Det oförklarade gapet (OLS) beräknas INTE
 * här — det körs i app.js mot simulerad data via data-swap, eftersom det kräver
 * regressionsmotorn. Här beräknas bara det rena (median-baserade) gapet; tröskelmålets
 * sökning (likalonslyftForMal) får appens skattning som argument.
 *
 * All matematik sker på ursprungslönerna: generellt och riktat summeras additivt
 * per individ, så fördelningen är ordningsoberoende och transparent.
 *
 * Bygger på: verktygets egen modell, docs/utveckling/loneoversynsmodellen.md.
 * Beräkningarna står i spårbarhetsmatrisen, docs/utveckling/sparbarhet.md (B7.2–B7.4 och B7.6–B7.9).
 */

import { arKvinnodominerad } from './likvardighet.js';
import { periodkostnad } from './kostnad.js';
import { median as _medianStat, kvantil as _kvantilStat } from './stat.js';
import { arKvinna, arMan } from './kon.js';

// Omslag: tål null/undefined som indata (0 för tom), vilket stat.js inte gör. Algoritmen finns bara i stat.js.
function _median(arr) { return arr && arr.length ? _medianStat(arr) : 0; }
function _kvantil(arr, q) { return arr && arr.length ? _kvantilStat(arr, q) : 0; }

/**
 * "Water-filling": höj de lägst betalda först. Hittar en gemensam nivå L (≤ cap)
 * och lyfter alla under L upp till L så långt potten räcker. Pengar som inte
 * får plats under cap lämnas oanvända (returneras implicit via summan av deltan).
 * @returns {number[]} delta per individ (samma ordning som lons)
 */
function _lyftLagstForst(lons, pott, cap) {
    const n = lons.length;
    if (!n || pott <= 0) return new Array(n).fill(0);
    const c = (cap == null) ? Infinity : cap;
    const sorted = lons.slice().sort((a, b) => a - b);
    let L = sorted[0], used = 0;
    if (c <= L) return new Array(n).fill(0);   // taket ligger under lägsta lönen
    for (let i = 1; i <= n; i++) {
        const nextBreak = i < n ? sorted[i] : Infinity;
        const ceiling = Math.min(nextBreak, c);
        const k = i;                            // antal individer på/under L
        const seg = k * (ceiling - L);
        if (used + seg >= pott) { L += (pott - used) / k; used = pott; break; }
        used += seg; L = ceiling;
        if (c !== Infinity && L >= c) { L = c; break; }
    }
    return lons.map(x => (x < L ? L - x : 0));
}

/** Total månadslönesumma. */
export function lonesumma(rader) {
    return (rader || []).reduce((s, r) => s + (r.lon > 0 ? r.lon : 0), 0);
}

/**
 * Potten i kr/månad utifrån budgeten.
 * @param {Array} rader
 * @param {{mode:string, value:number|null}} budget
 */
export function beraknaPott(rader, budget) {
    if (!budget || budget.value == null || !isFinite(budget.value)) return 0;   // samma villkor som pottArAngiven
    if (budget.mode === 'kr') return Math.max(0, budget.value);
    return Math.max(0, lonesumma(rader) * budget.value / 100);  // % av lönesumman
}

/**
 * Det råa (median-baserade) lönegapet kvinnor vs män, i procent.
 * @param {Array} rader
 * @param {(r:Object)=>number} lonAv - väljer lönefältet (lon eller nyLon)
 * @returns {number|null}
 */
export function raLonegap(rader, lonAv) {
    const kv = [], ma = [];
    (rader || []).forEach(r => {
        const L = lonAv(r);
        if (!(L > 0)) return;
        if (arKvinna(r)) kv.push(L);
        else if (arMan(r)) ma.push(L);
    });
    if (!kv.length || !ma.length) return null;
    return (_median(kv) / _median(ma) - 1) * 100;
}

/**
 * Raderna en riktad pott gäller: gruppen (BAS, eller BAS och AID), begränsad till ett kön (`kon`:
 * 'kvinna' | 'man', annars alla) och till löner under en gräns (`lonCap`, kr/mån, annars alla).
 * Samma urval som fordela() räknar på, så att gränssnittet kan visa hur många raden berör.
 * @param {Array} rader - individrader {bas, aid, kon, lon}
 * @param {{bas:string, aid:string, kon?:string, lonCap?:number|null}} t
 * @returns {number[]} index i rader
 */
export function riktadeRader(rader, t) {
    const kon = t.kon === 'kvinna' || t.kon === 'man' ? t.kon : 'alla';
    const cap = t.lonCap != null && isFinite(t.lonCap) && t.lonCap > 0 ? t.lonCap : null;
    const konOk = r => kon === 'alla' || (kon === 'kvinna' ? arKvinna(r) : arMan(r));
    const ut = [];
    (rader || []).forEach((r, i) => {
        if (r.bas !== t.bas) return;
        if (t.aid !== '*' && r.aid !== t.aid) return;
        if (!konOk(r) || (cap != null && !(r.lon < cap))) return;
        ut.push(i);
    });
    return ut;
}

/**
 * Fördelar generellt + riktat påslag och returnerar nya löner per individ,
 * sammanställning per grupp och totaler.
 * @param {Array} rader - individrader {bas, aid, kon, lon}
 * @param {{mode:string, value:number|null}} generell - generellt påslag till alla (value null = 0)
 * @param {Array<{bas,aid,mode:'pct'|'kr'|'till',value,dist:'flat'|'lowest'|'target',targetLevel?:'median'|'p25',kon?:string,lonCap?:number|null}>} riktningar
 *   mode 'till' lyfter var och en i urvalet som ligger under beloppet upp till det (ingen pott att fördela).
 * @param {number} [avrundning=0] - avrunda nya löner till närmaste steg (kr), 0 = ingen avrundning
 */
export function fordela(rader, generell, riktningar, avrundning) {
    const n = (rader || []).length;
    const genDeltas = new Array(n).fill(0);
    const g = generell || { mode: 'pct', value: 0 };
    const gVal = g.value != null && isFinite(g.value) ? g.value : 0;
    for (let i = 0; i < n; i++) {
        if (rader[i].lon <= 0) continue;
        genDeltas[i] = g.mode === 'kr' ? gVal : rader[i].lon * gVal / 100;
    }

    const tgtDeltas = new Array(n).fill(0);
    (riktningar || []).forEach(t => {
        // aid === '*' → hela BAS-intervallet (alla yrken i BAS:et); kön och lönegräns snävar in raden.
        const idxs = riktadeRader(rader, t);
        if (!idxs.length) return;
        const lons = idxs.map(i => rader[i].lon);
        if (t.mode === 'till') {
            const mal = isFinite(t.value) ? t.value : 0;
            idxs.forEach((i, j) => { if (lons[j] > 0 && lons[j] < mal) tgtDeltas[i] += mal - lons[j]; });
            return;
        }
        const groupSum = lons.reduce((s, x) => s + (x > 0 ? x : 0), 0);
        const pott = t.mode === 'kr' ? (isFinite(t.value) ? t.value : 0)
                                     : groupSum * (isFinite(t.value) ? t.value : 0) / 100;
        if (pott <= 0 || groupSum <= 0) return;
        let gd;
        if (t.dist === 'flat') {
            const frac = pott / groupSum;
            gd = lons.map(x => (x > 0 ? x * frac : 0));
        } else {
            const cap = t.dist === 'target'
                ? (t.targetLevel === 'p25' ? _kvantil(lons, 0.25) : _median(lons))
                : Infinity;
            gd = _lyftLagstForst(lons, pott, cap);
        }
        idxs.forEach((i, j) => { tgtDeltas[i] += gd[j]; });
    });

    // Avrundning till lönetrappa: bara för individer som faktiskt får påslag
    // (delta > 0), och aldrig under ursprungslönen.
    const step = (avrundning && avrundning > 0) ? avrundning : 0;
    const perPerson = rader.map((r, i) => {
        let delta = genDeltas[i] + tgtDeltas[i];
        if (step > 0 && delta > 0) {
            const rounded = Math.round((r.lon + delta) / step) * step;
            delta = Math.max(0, rounded - r.lon);
        }
        return { bas: r.bas, aid: r.aid, kon: r.kon, lon: r.lon, nyLon: r.lon + delta, delta };
    });

    // Sammanställning per grupp
    const groups = new Map();
    perPerson.forEach(p => {
        const k = p.bas + '|' + p.aid;
        let gr = groups.get(k);
        if (!gr) { gr = { bas: p.bas, aid: p.aid, oldL: [], newL: [], kvN: 0, n: 0, cost: 0 }; groups.set(k, gr); }
        gr.oldL.push(p.lon); gr.newL.push(p.nyLon);
        gr.cost += p.delta; gr.n++;
        if (arKvinna(p)) gr.kvN++;
    });
    const perGroup = [...groups.values()].map(gr => ({
        bas: gr.bas, aid: gr.aid, n: gr.n, kvN: gr.kvN,
        andelKv: gr.n ? 100 * gr.kvN / gr.n : 0,
        gammalMedian: _median(gr.oldL), nyMedian: _median(gr.newL),
        kostnad: gr.cost
    }));

    // generell/riktad-split speglar avsikten (oavrundat); totalRaise speglar
    // det faktiska, ev. avrundade, utfallet (summan av perPerson-deltan).
    const generellCost = genDeltas.reduce((s, x) => s + x, 0);
    const riktadCost = tgtDeltas.reduce((s, x) => s + x, 0);
    const totalRaise = perPerson.reduce((s, p) => s + p.delta, 0);
    return { perPerson, perGroup, totals: { generellCost, riktadCost, totalRaise } };
}

/**
 * Ett kandidatpar per kvinnodominerat yrke (BAS-intervall och AID): det med störst skillnad i kronor (ADR-69).
 * Ett yrke med flera jämförelseyrken får då en rad och en pott i förslagen, inte en per jämförelseyrke. Anroparen
 * har redan tagit bort paren som inte får redovisas, så att valet görs bland dem som når tröskeln. Ordningen och
 * objekten är desamma som i indata.
 * @template {{bas: any, aid: any, gapKr: number}} T
 * @param {T[]} [kandidater]
 * @returns {T[]}
 */
export function ettParPerYrke(kandidater) {
    /** @type {Map<string, T>} */
    const bast = new Map();
    for (const c of kandidater || []) {
        const nyckel = c.bas + '|' + c.aid;
        const forra = bast.get(nyckel);
        if (!forra || c.gapKr > forra.gapKr) bast.set(nyckel, c);
    }
    const valda = new Set(bast.values());
    return (kandidater || []).filter(c => valda.has(c));
}

/**
 * Föreslår en riktad fördelning som minskar de osakliga gapen först. Fördelar
 * riktadPott proportionellt mot påverkansindex (gapKr × n), kapat vid kostnaden
 * att helt stänga respektive grupps gap. Ett par per yrke (ettParPerYrke).
 * @param {Array<{bas,aid,gapKr:number,n:number}>} kandidater - gapKr > 0 = under referens (kr/mån/person)
 * @param {number} riktadPott
 * @param {number} [minN=0] - rikta endast mot grupper med minst minN personer
 */
export function foreslaRiktning(kandidater, riktadPott, minN = 0) {
    const valid = ettParPerYrke(kandidater).filter(c => c.gapKr > 0 && c.n > 0 && c.n >= (minN || 0));
    if (!valid.length || riktadPott <= 0) return [];
    const totalIndex = valid.reduce((s, c) => s + c.gapKr * c.n, 0);
    if (totalIndex <= 0) return [];
    return valid.map(c => {
        const share = (c.gapKr * c.n) / totalIndex;
        const want = c.gapKr * c.n;                  // kostnad att helt stänga (kr/mån)
        const alloc = Math.min(want, riktadPott * share);
        return { bas: c.bas, aid: c.aid, mode: 'kr', value: Math.round(alloc), dist: 'lowest' };
    }).filter(t => t.value > 0);
}

/**
 * Mål-läge: bygg riktade rader som stänger en andel (fraction) av de osakliga
 * gapen. Kostnaden för att helt stänga en grupps gap är gapKr × n; för andelen
 * f blir det f × gapKr × n. Fördelas lägst-först inom gruppen. Ett par per yrke (ettParPerYrke), också i
 * känslighetskurvan, som bygger på den här funktionen.
 * @param {Array<{bas,aid,gapKr:number,n:number}>} kandidater
 * @param {number} andel - 0..1
 * @param {number} [minN=0]
 */
export function stangningsriktning(kandidater, andel, minN = 0) {
    const f = Math.max(0, Math.min(1, andel));
    if (f <= 0) return [];
    return ettParPerYrke(kandidater)
        .filter(c => c.gapKr > 0 && c.n > 0 && c.n >= (minN || 0))
        .map(c => ({ bas: c.bas, aid: c.aid, mode: /** @type {'kr'} */ ('kr'), value: Math.round(f * c.gapKr * c.n), dist: /** @type {'lowest'} */ ('lowest') }))
        .filter(t => t.value > 0);
}

/**
 * Stegvis plan: rampa fördelningen linjärt över N år (1/N per år) och beräkna
 * ackumulerad kostnad och råa lönegapet vid varje år. Stödjer DiskrL 3:11
 * ("senast inom tre år"). perPerson kommer från fordela (har delta + lon + kon).
 * @returns {Array<{year,andelPct,kumRaise,kumKostnad,rawGap}>}
 */
export function stegvisPlan(rader, perPerson, ar, kostnadsval) {
    const N = Math.max(1, Math.min(5, Math.round(ar) || 1));
    const out = [];
    for (let k = 1; k <= N; k++) {
        const frac = k / N;
        const simRows = perPerson.map((p, i) => ({ kon: rader[i].kon, lon: rader[i].lon + p.delta * frac }));
        const kumRaise = perPerson.reduce((s, p) => s + p.delta * frac, 0);
        out.push({
            year: k, andelPct: 100 * frac, kumRaise,
            kumKostnad: periodkostnad(kumRaise, kostnadsval),
            rawGap: raLonegap(simRows, r => r.lon)
        });
    }
    return out;
}

/**
 * Sammanställning per BAS→AID-grupp (för kriteriebaserad riktning).
 * @returns {Array<{bas,aid,n,kvN,andelKv,median}>}
 */
export function sammanstallGrupper(rader) {
    const m = new Map();
    (rader || []).forEach(r => {
        const k = r.bas + '|' + r.aid;
        let g = m.get(k);
        if (!g) { g = { bas: r.bas, aid: r.aid, lons: [], kvN: 0, n: 0 }; m.set(k, g); }
        g.lons.push(r.lon); g.n++;
        if (arKvinna(r)) g.kvN++;
    });
    return [...m.values()].map(g => ({
        bas: g.bas, aid: g.aid, n: g.n, kvN: g.kvN,
        andelKv: g.n ? 100 * g.kvN / g.n : 0, median: _median(g.lons)
    }));
}

/**
 * Leapfrog-/spillover-detektering: hittar grupper som efter påslaget passerar
 * (går om) en grupp som tidigare hade högre median — vilket kan skapa ny
 * skevhet. Jämför på gruppmedianer (perGroup från fordela).
 * @returns {Array<{bas:string, aid:string, overBas:string, overAid:string, gammalA:number, nyA:number, gammalB:number, nyB:number}>}
 */
export function hittaOmkorningar(perGrupp) {
    const g = (perGrupp || []).filter(x => x.n > 0);
    const out = [];
    for (let i = 0; i < g.length; i++) {
        for (let j = 0; j < g.length; j++) {
            if (i === j) continue;
            if (g[i].gammalMedian < g[j].gammalMedian - 1e-6 && g[i].nyMedian > g[j].nyMedian + 1e-6) {
                out.push({
                    bas: g[i].bas, aid: g[i].aid, overBas: g[j].bas, overAid: g[j].aid,
                    gammalA: g[i].gammalMedian, nyA: g[i].nyMedian,
                    gammalB: g[j].gammalMedian, nyB: g[j].nyMedian
                });
            }
        }
    }
    return out;
}

/**
 * Sant när budgeten har ett belopp eller en procentsats; ett tomt fält (value null) är ingen angiven pott.
 * @param {{mode?:string, value:number|null}|null|undefined} budget
 */
export function pottArAngiven(budget) {
    return !!budget && budget.value != null && isFinite(budget.value);
}

/**
 * Hela prognosutfallet: pott, budgetutnyttjande, total kostnad (inkl. PO + period)
 * och råa lönegapet före/efter. Det OFÖRKLARADE gapet (OLS) beräknas i app.js.
 * Utan angiven pott (pottAngiven false) är pott 0, kvar null och overBudget falskt: det finns ingen pott att
 * överskrida. En angiven pott på 0 kr flaggas som vanligt när något fördelas.
 * @param {Array} rader
 * @param {{mode:string, value:number|null}} budget
 * @param {{mode:string, value:number|null}} generell
 * @param {Array} riktningar
 * @param {{months?:number, poPct?:number, roundStep?:number, kvThreshold?:number, kvDefinition?:string}} [kostnadsval]
 *   kvThreshold och kvDefinition: samma definition av kvinnodominerat som likvärdighetsanalysen (ADR-60).
 */
export function prognosutfall(rader, budget, generell, riktningar, kostnadsval) {
    const pott = beraknaPott(rader, budget);
    const alloc = fordela(rader, generell, riktningar, kostnadsval && kostnadsval.roundStep);
    const totalRaise = alloc.totals.totalRaise;
    // Gränsen för kvinnodominerat: saknas den gäller arKvinnodominerads standard, KVINNO_TROSKEL_STANDARD i
    // likvardighet.js (spegeln exponerar bara funktioner, så konstanten importeras inte hit). 0 är en gräns, inte en som saknas.
    const kvThreshold = kostnadsval?.kvThreshold ?? undefined;
    const lonsummaFore = lonesumma(rader);
    // Hur mycket av påslaget går till kvinnodominerade grupper (jämställdhetsandel)
    const kvDefinition = (kostnadsval && kostnadsval.kvDefinition) || 'do';
    const equityCost = alloc.perGroup.reduce((s, g) => s + (arKvinnodominerad(g.andelKv, kvDefinition, kvThreshold) ? g.kostnad : 0), 0);
    const pottAngiven = pottArAngiven(budget);
    return {
        pott,
        pottAngiven,
        använt: totalRaise,
        kvar: pottAngiven ? pott - totalRaise : null,
        overBudget: pottAngiven && totalRaise > pott + 1e-6,
        totalKostnad: periodkostnad(totalRaise, kostnadsval),
        lonsummaFore,
        lonsummaEfter: lonsummaFore + totalRaise,
        rawGapFore: raLonegap(rader, r => r.lon),
        rawGapEfter: raLonegap(alloc.perPerson, p => p.nyLon),
        generellCost: alloc.totals.generellCost,
        riktadCost: alloc.totals.riktadCost,
        equityCost,
        leapfrog: hittaOmkorningar(alloc.perGroup),
        alloc
    };
}

// ===================================================================
// Lönespann/compa-ratio, individnivå-remediation,
// marknadspositionering, budgetkänslighet.
// ===================================================================

/**
 * (A) Lönespann per BAS: P25 / median / P75. compa-ratio och range-penetration
 * beräknas mot detta i UI.
 * @returns {Array<{bas,n,p25,median,p75}>}
 */
export function lonespannPerBas(rader) {
    const m = new Map();
    (rader || []).forEach(r => {
        if (!(r.lon > 0)) return;
        if (!m.has(r.bas)) m.set(r.bas, []);
        m.get(r.bas).push(r.lon);
    });
    return [...m.entries()].map(([bas, lons]) => ({
        bas, n: lons.length,
        p25: _kvantil(lons, 0.25), median: _median(lons), p75: _kvantil(lons, 0.75)
    })).sort((a, b) => (a.bas < b.bas ? -1 : a.bas > b.bas ? 1 : 0));
}

/**
 * (B) Individnivå-remediation (DiskrL 3:9 — lika arbete): flaggar kvinnor som
 * är betalda mer än `gapPct` % under sitt likalöne-benchmark (mäns median i
 * samma BAS×AID, fallback mäns median i BAS) och beräknar kostnaden att lyfta
 * dem till benchmark. Endast aggregat returneras för visning; `flagged` används
 * internt för seeding och summeras per grupp.
 *
 * `minMen` är minsta antal män bakom ett benchmark. Appen skickar alltid gällande k-tröskel:
 * mot en enda mans lön vore "kostnaden att lyfta" en kvinna hans lön minus hennes.
 * Standardvärdet 1 finns för enhetstesterna.
 * @param {Array} rader
 * @param {{gapPct?:number, minMen?:number}} val
 */
export function individlyft(rader, val) {
    const o = val || {};
    const trigger = (o.gapPct != null ? o.gapPct : 5) / 100;
    const minMen = o.minMen || 1;
    const menByGroup = new Map(), menByBas = new Map();
    (rader || []).forEach(r => {
        if (!(r.lon > 0)) return;
        if (!arMan(r)) return;
        const gk = r.bas + '|' + r.aid;
        if (!menByGroup.has(gk)) menByGroup.set(gk, []);
        menByGroup.get(gk).push(r.lon);
        if (!menByBas.has(r.bas)) menByBas.set(r.bas, []);
        menByBas.get(r.bas).push(r.lon);
    });
    const benchFor = (bas, aid) => {
        const g = menByGroup.get(bas + '|' + aid);
        if (g && g.length >= minMen) return { v: _median(g), kalla: 'yrke' };
        const b = menByBas.get(bas);
        if (b && b.length >= minMen) return { v: _median(b), kalla: 'bas' };
        return null;
    };
    const flagged = [];
    (rader || []).forEach(r => {
        if (!(r.lon > 0)) return;
        if (!arKvinna(r)) return;
        const bench = benchFor(r.bas, r.aid);
        if (!bench) return;
        if (r.lon < bench.v * (1 - trigger)) {
            flagged.push({ bas: r.bas, aid: r.aid, lon: r.lon, benchmark: bench.v, kalla: bench.kalla, shortfall: bench.v - r.lon });
        }
    });
    const byGroup = new Map();
    flagged.forEach(f => {
        const k = f.bas + '|' + f.aid;
        let g = byGroup.get(k);
        if (!g) { g = { bas: f.bas, aid: f.aid, count: 0, cost: 0 }; byGroup.set(k, g); }
        g.count++; g.cost += f.shortfall;
    });
    return {
        flagged, count: flagged.length,
        totalCost: flagged.reduce((s, f) => s + f.shortfall, 0),
        perGroup: [...byGroup.values()].sort((a, b) => b.cost - a.cost)
    };
}

/**
 * (E) Marknadspositionering: bygg riktade rader som lyfter grupper vars median
 * ligger under marknad × factor, mot den nivån.
 * @param {Array<{bas,aid,n,median}>} grupper - från sammanstallGrupper
 * @param {Map<string,number>} marknadPerNyckel - nyckel "aid|bas" eller "aid" → marknadsmedian
 * @param {number} faktor - andel av marknadsmedian att nå (t.ex. 0.95)
 * @param {number} [minN=0]
 */
export function marknadsriktning(grupper, marknadPerNyckel, faktor, minN) {
    const f = faktor > 0 ? faktor : 1;
    const out = [];
    (grupper || []).forEach(g => {
        if (g.n < (minN || 0)) return;
        let mk = marknadPerNyckel.get(g.aid + '|' + g.bas);
        if (mk == null) mk = marknadPerNyckel.get(g.aid);
        if (mk == null || !(mk > 0)) return;
        const target = mk * f;
        if (g.median < target) {
            out.push({ bas: g.bas, aid: g.aid, mode: 'kr', value: Math.round((target - g.median) * g.n), dist: 'lowest', pool: 'marknad' });
        }
    });
    return out;
}

/**
 * (F) Budgetkänslighet: svep §3:10-stängning 0→100 % och returnera kostnad +
 * råa lönegapet för varje steg (avtagande avkastning).
 * @returns {Array<{fraction,kostnad,rawGap}>}
 */
export function kanslighetskurva(rader, kandidater, kostnadsval, steg) {
    const S = steg || 10;
    const out = [];
    for (let i = 0; i <= S; i++) {
        const frac = i / S;
        const targets = stangningsriktning(kandidater, frac, 0);
        const alloc = fordela(rader, { mode: 'pct', value: 0 }, targets, kostnadsval && kostnadsval.roundStep);
        out.push({
            fraction: frac,
            kostnad: periodkostnad(alloc.totals.totalRaise, kostnadsval),
            rawGap: raLonegap(alloc.perPerson, p => p.nyLon)
        });
    }
    return out;
}

/** Tröskelmålets standardmål: en oförklarad skillnad på högst 5 %. */
export const TROSKELMAL_STANDARD_PCT = 5;
/** Det största lyft i procent som tröskelmålet prövar; krävs mer redovisas det som utom räckhåll. */
export const TROSKELMAL_MAX_LYFT_PCT = 40;
/** Antalet halveringar i sökningen: intervallet 0–40 % krymper till 40 / 2^22, under 0,00001 procentenheter. */
export const TROSKELMAL_VARV = 22;
/** Signifikansgränsen i läget "inte signifikant": målet är nått när p-värdet är över den (eller saknas). */
export const TROSKELMAL_SIGNIFIKANS_P = 0.05;

/** Tröskelmålets konstanter, för appen (spegeln exponerar bara funktioner). */
export function troskelmalKonstanter() {
    return { STANDARD_PCT: TROSKELMAL_STANDARD_PCT, MAX_LYFT_PCT: TROSKELMAL_MAX_LYFT_PCT,
             VARV: TROSKELMAL_VARV, SIGNIFIKANS_P: TROSKELMAL_SIGNIFIKANS_P };
}

/**
 * (C) Tröskelmål: det minsta jämna lyftet i procent till alla kvinnor som behövs för att den oförklarade skillnaden
 * ska nå målet, antingen högst `malPct` procent (skillnaden räknas som kvinnor mot män, negativ när kvinnor ligger
 * lägre) eller inte signifikant (p över TROSKELMAL_SIGNIFIKANS_P). Söks med bisektion i 0–TROSKELMAL_MAX_LYFT_PCT %
 * i TROSKELMAL_VARV varv; svaret är intervallets övre gräns, där målet är nått.
 *
 * Regressionen körs inte här: `skatta(rader)` är appens skattning (huvudregressionen på de givna raderna) och
 * returnerar `{ konPct, pValue }`, med `konPct` null när den inte går att skatta. Kostnaden per månad är summan av
 * kvinnornas lön gånger lyftet, utan påslag; kostnaden över perioden räknar appen.
 * @param {any[]} rader lönefilens rader ({lon, kon, …})
 * @param {{malPct?: number, signifikans?: boolean,
 *   skatta: (rader: any[]) => {konPct: number|null, pValue: number|null}}} opts
 * @returns {{status: 'ingenSkattning'|'redan'|'utomRackhall'|'hittat',
 *   utgangslage: {konPct: number|null, pValue: number|null},
 *   lyftPct?: number, kostnadPerManad?: number, resultat?: {konPct: number|null, pValue: number|null}}}
 *   ingenSkattning: regressionen går inte att skatta på raderna; redan: målet är redan nått; utomRackhall: inte ens
 *   TROSKELMAL_MAX_LYFT_PCT % räcker; hittat: lyftPct, kostnadPerManad och skattningen efter lyftet (resultat)
 */
export function likalonslyftForMal(rader, { malPct = TROSKELMAL_STANDARD_PCT, signifikans = false, skatta }) {
    const kvinnor = rader.filter(arKvinna);
    const utgangslage = skatta(rader);
    if (utgangslage.konPct == null) return { status: 'ingenSkattning', utgangslage };
    const okFor = g => signifikans ? (g.pValue == null || g.pValue > TROSKELMAL_SIGNIFIKANS_P) : (g.konPct != null && g.konPct >= -malPct);
    const medLyft = x => {
        const sim = rader.map(r => arKvinna(r) ? { ...r, lon: r.lon * (1 + x / 100) } : r);
        const g = skatta(sim);
        return { konPct: g.konPct, pValue: g.pValue, kostnad: kvinnor.reduce((s, r) => s + r.lon * x / 100, 0) };
    };
    if (okFor(utgangslage)) return { status: 'redan', utgangslage };
    let lo = 0, hi = TROSKELMAL_MAX_LYFT_PCT;
    if (!okFor(medLyft(hi))) return { status: 'utomRackhall', utgangslage };
    for (let varv = 0; varv < TROSKELMAL_VARV; varv++) { const mitt = (lo + hi) / 2; if (okFor(medLyft(mitt))) hi = mitt; else lo = mitt; }
    const { konPct, pValue, kostnad } = medLyft(hi);
    return { status: 'hittat', utgangslage, lyftPct: hi, kostnadPerManad: kostnad, resultat: { konPct, pValue } };
}

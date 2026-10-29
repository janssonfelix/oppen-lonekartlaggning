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
 * (vaktas av tests/drift.test.js). Det oförklarade gapet (OLS) beräknas INTE
 * här — det körs i app.js mot simulerad data via data-swap, eftersom det kräver
 * regressionsmotorn. Här beräknas bara det rena (median-baserade) gapet.
 *
 * All matematik sker på ursprungslönerna: generellt och riktat summeras additivt
 * per individ, så fördelningen är ordningsoberoende och transparent.
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

/**
 * "Water-filling": höj de lägst betalda först. Hittar en gemensam nivå L (≤ cap)
 * och lyfter alla under L upp till L så långt potten räcker. Pengar som inte
 * får plats under cap lämnas oanvända (returneras implicit via summan av deltan).
 * @returns {number[]} delta per individ (samma ordning som lons)
 */
function _waterLevelDeltas(lons, pott, cap) {
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
export function totalLonSum(rows) {
    return (rows || []).reduce((s, r) => s + (r.lon > 0 ? r.lon : 0), 0);
}

/**
 * Potten i kr/månad utifrån budgeten.
 * @param {Array} rows
 * @param {{mode:string, value:number|null}} budget
 */
export function computePott(rows, budget) {
    if (!budget || budget.value == null || !isFinite(budget.value)) return 0;
    if (budget.mode === 'kr') return Math.max(0, budget.value);
    return Math.max(0, totalLonSum(rows) * budget.value / 100);  // % av lönesumman
}

/**
 * Det råa (median-baserade) lönegapet kvinnor vs män, i procent.
 * @param {Array} rows
 * @param {(r:Object)=>number} getLon - väljer lönefältet (lon eller nyLon)
 * @returns {number|null}
 */
export function rawGenderGap(rows, getLon) {
    const kv = [], ma = [];
    (rows || []).forEach(r => {
        const L = getLon(r);
        if (!(L > 0)) return;
        if (r.kon && r.kon.includes('kvinna')) kv.push(L);
        else if (r.kon === 'man' || r.kon === 'män') ma.push(L);
    });
    if (!kv.length || !ma.length) return null;
    return (_median(kv) / _median(ma) - 1) * 100;
}

/**
 * Raderna en riktad pott gäller: gruppen (BAS, eller BAS och AID), begränsad till ett kön (`kon`:
 * 'kvinna' | 'man', annars alla) och till löner under en gräns (`lonCap`, kr/mån, annars alla).
 * Samma urval som allocate() räknar på, så att gränssnittet kan visa hur många raden berör.
 * @param {Array} rows - individrader {bas, aid, kon, lon}
 * @param {{bas:string, aid:string, kon?:string, lonCap?:number|null}} t
 * @returns {number[]} index i rows
 */
export function targetRows(rows, t) {
    const kon = t.kon === 'kvinna' || t.kon === 'man' ? t.kon : 'alla';
    const cap = t.lonCap != null && isFinite(t.lonCap) && t.lonCap > 0 ? t.lonCap : null;
    const konOk = r => kon === 'alla' || (kon === 'kvinna' ? String(r.kon || '').includes('kvinna') : (r.kon === 'man' || r.kon === 'män'));
    const ut = [];
    (rows || []).forEach((r, i) => {
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
 * @param {Array} rows - individrader {bas, aid, kon, lon}
 * @param {{mode:string, value:number|null}} generell - generellt påslag till alla (value null = 0)
 * @param {Array<{bas,aid,mode:'pct'|'kr'|'till',value,dist:'flat'|'lowest'|'target',targetLevel?:'median'|'p25',kon?:string,lonCap?:number|null}>} targets
 *   mode 'till' lyfter var och en i urvalet som ligger under beloppet upp till det (ingen pott att fördela).
 * @param {number} [roundStep=0] - avrunda nya löner till närmaste steg (kr), 0 = ingen avrundning
 */
export function allocate(rows, generell, targets, roundStep) {
    const n = (rows || []).length;
    const genDeltas = new Array(n).fill(0);
    const g = generell || { mode: 'pct', value: 0 };
    const gVal = g.value != null && isFinite(g.value) ? g.value : 0;
    for (let i = 0; i < n; i++) {
        if (rows[i].lon <= 0) continue;
        genDeltas[i] = g.mode === 'kr' ? gVal : rows[i].lon * gVal / 100;
    }

    const tgtDeltas = new Array(n).fill(0);
    (targets || []).forEach(t => {
        // aid === '*' → hela BAS-intervallet (alla yrken i BAS:et); kön och lönegräns snävar in raden.
        const idxs = targetRows(rows, t);
        if (!idxs.length) return;
        const lons = idxs.map(i => rows[i].lon);
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
                ? (t.targetLevel === 'p25' ? _quantile(lons, 0.25) : _median(lons))
                : Infinity;
            gd = _waterLevelDeltas(lons, pott, cap);
        }
        idxs.forEach((i, j) => { tgtDeltas[i] += gd[j]; });
    });

    // Avrundning till lönetrappa: bara för individer som faktiskt får påslag
    // (delta > 0), och aldrig under ursprungslönen.
    const step = (roundStep && roundStep > 0) ? roundStep : 0;
    const perPerson = rows.map((r, i) => {
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
        if (p.kon && p.kon.includes('kvinna')) gr.kvN++;
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
 * Föreslår en riktad fördelning som minskar de osakliga gapen först. Fördelar
 * riktadPott proportionellt mot påverkansindex (gapKr × n), kapat vid kostnaden
 * att helt stänga respektive grupps gap.
 * @param {Array<{bas,aid,gapKr:number,n:number}>} candidates - gapKr > 0 = under referens (kr/mån/person)
 * @param {number} riktadPott
 * @param {number} [minN=0] - rikta endast mot grupper med minst minN personer
 */
export function suggestTargets(candidates, riktadPott, minN = 0) {
    const valid = (candidates || []).filter(c => c.gapKr > 0 && c.n > 0 && c.n >= (minN || 0));
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
 * f blir det f × gapKr × n. Fördelas lägst-först inom gruppen.
 * @param {Array<{bas,aid,gapKr:number,n:number}>} candidates
 * @param {number} fraction - 0..1
 * @param {number} [minN=0]
 */
export function closureTargets(candidates, fraction, minN = 0) {
    const f = Math.max(0, Math.min(1, fraction));
    if (f <= 0) return [];
    return (candidates || [])
        .filter(c => c.gapKr > 0 && c.n > 0 && c.n >= (minN || 0))
        .map(c => ({ bas: c.bas, aid: c.aid, mode: /** @type {'kr'} */ ('kr'), value: Math.round(f * c.gapKr * c.n), dist: /** @type {'lowest'} */ ('lowest') }))
        .filter(t => t.value > 0);
}

/**
 * Stegvis plan: rampa fördelningen linjärt över N år (1/N per år) och beräkna
 * ackumulerad kostnad och råa lönegapet vid varje år. Stödjer DiskrL 3:11
 * ("senast inom tre år"). perPerson kommer från allocate (har delta + lon + kon).
 * @returns {Array<{year,andelPct,kumRaise,kumKostnad,rawGap}>}
 */
export function stagedPlan(rows, perPerson, years, costOpts) {
    const N = Math.max(1, Math.min(5, Math.round(years) || 1));
    const months = (costOpts && costOpts.months) || 12;
    const poFactor = 1 + ((costOpts && costOpts.poPct) || 0) / 100;
    const out = [];
    for (let k = 1; k <= N; k++) {
        const frac = k / N;
        const simRows = perPerson.map((p, i) => ({ kon: rows[i].kon, lon: rows[i].lon + p.delta * frac }));
        const kumRaise = perPerson.reduce((s, p) => s + p.delta * frac, 0);
        out.push({
            year: k, andelPct: 100 * frac, kumRaise,
            kumKostnad: kumRaise * months * poFactor,
            rawGap: rawGenderGap(simRows, r => r.lon)
        });
    }
    return out;
}

/**
 * Sammanställning per BAS→AID-grupp (för kriteriebaserad riktning).
 * @returns {Array<{bas,aid,n,kvN,andelKv,median}>}
 */
export function summarizeGroups(rows) {
    const m = new Map();
    (rows || []).forEach(r => {
        const k = r.bas + '|' + r.aid;
        let g = m.get(k);
        if (!g) { g = { bas: r.bas, aid: r.aid, lons: [], kvN: 0, n: 0 }; m.set(k, g); }
        g.lons.push(r.lon); g.n++;
        if (r.kon && r.kon.includes('kvinna')) g.kvN++;
    });
    return [...m.values()].map(g => ({
        bas: g.bas, aid: g.aid, n: g.n, kvN: g.kvN,
        andelKv: g.n ? 100 * g.kvN / g.n : 0, median: _median(g.lons)
    }));
}

/**
 * Leapfrog-/spillover-detektering: hittar grupper som efter påslaget passerar
 * (går om) en grupp som tidigare hade högre median — vilket kan skapa ny
 * skevhet. Jämför på gruppmedianer (perGroup från allocate).
 * @returns {Array<{bas:string, aid:string, overBas:string, overAid:string, gammalA:number, nyA:number, gammalB:number, nyB:number}>}
 */
export function detectLeapfrog(perGroup) {
    const g = (perGroup || []).filter(x => x.n > 0);
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
 * Hela prognosutfallet: pott, budgetutnyttjande, total kostnad (inkl. PO + period)
 * och råa lönegapet före/efter. Det OFÖRKLARADE gapet (OLS) beräknas i app.js.
 * @param {Array} rows
 * @param {{mode:string, value:number|null}} budget
 * @param {{mode:string, value:number|null}} generell
 * @param {Array} targets
 * @param {{months?:number, poPct?:number, roundStep?:number, kvThreshold?:number}} [costOpts]
 */
export function forecastOutcome(rows, budget, generell, targets, costOpts) {
    const pott = computePott(rows, budget);
    const alloc = allocate(rows, generell, targets, costOpts && costOpts.roundStep);
    const totalRaise = alloc.totals.totalRaise;
    const months = (costOpts && costOpts.months) || 12;
    const poFactor = 1 + ((costOpts && costOpts.poPct) || 0) / 100;
    const kvThreshold = (costOpts && costOpts.kvThreshold) || 60;
    const lonsummaFore = totalLonSum(rows);
    // Hur mycket av påslaget går till kvinnodominerade grupper (jämställdhetsandel)
    const equityCost = alloc.perGroup.reduce((s, g) => s + (g.andelKv >= kvThreshold ? g.kostnad : 0), 0);
    return {
        pott,
        använt: totalRaise,
        kvar: pott - totalRaise,
        overBudget: totalRaise > pott + 1e-6,
        totalKostnad: totalRaise * months * poFactor,
        lonsummaFore,
        lonsummaEfter: lonsummaFore + totalRaise,
        rawGapFore: rawGenderGap(rows, r => r.lon),
        rawGapEfter: rawGenderGap(alloc.perPerson, p => p.nyLon),
        generellCost: alloc.totals.generellCost,
        riktadCost: alloc.totals.riktadCost,
        equityCost,
        leapfrog: detectLeapfrog(alloc.perGroup),
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
export function bandStats(rows) {
    const m = new Map();
    (rows || []).forEach(r => {
        if (!(r.lon > 0)) return;
        if (!m.has(r.bas)) m.set(r.bas, []);
        m.get(r.bas).push(r.lon);
    });
    return [...m.entries()].map(([bas, lons]) => ({
        bas, n: lons.length,
        p25: _quantile(lons, 0.25), median: _median(lons), p75: _quantile(lons, 0.75)
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
 * @param {Array} rows
 * @param {{gapPct?:number, minMen?:number}} opts
 */
export function individualRemediation(rows, opts) {
    const o = opts || {};
    const trigger = (o.gapPct != null ? o.gapPct : 5) / 100;
    const minMen = o.minMen || 1;
    const menByGroup = new Map(), menByBas = new Map();
    (rows || []).forEach(r => {
        if (!(r.lon > 0)) return;
        if (!(r.kon === 'man' || r.kon === 'män')) return;
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
    (rows || []).forEach(r => {
        if (!(r.lon > 0)) return;
        if (!(r.kon && r.kon.includes('kvinna'))) return;
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
 * @param {Array<{bas,aid,n,median}>} groups - från summarizeGroups
 * @param {Map<string,number>} marketByKey - nyckel "aid|bas" eller "aid" → marknadsmedian
 * @param {number} factor - andel av marknadsmedian att nå (t.ex. 0.95)
 * @param {number} [minN=0]
 */
export function marketTargets(groups, marketByKey, factor, minN) {
    const f = factor > 0 ? factor : 1;
    const out = [];
    (groups || []).forEach(g => {
        if (g.n < (minN || 0)) return;
        let mk = marketByKey.get(g.aid + '|' + g.bas);
        if (mk == null) mk = marketByKey.get(g.aid);
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
export function sensitivityCurve(rows, candidates, costOpts, steps) {
    const S = steps || 10;
    const months = (costOpts && costOpts.months) || 12;
    const poFactor = 1 + ((costOpts && costOpts.poPct) || 0) / 100;
    const out = [];
    for (let i = 0; i <= S; i++) {
        const frac = i / S;
        const targets = closureTargets(candidates, frac, 0);
        const alloc = allocate(rows, { mode: 'pct', value: 0 }, targets, costOpts && costOpts.roundStep);
        out.push({
            fraction: frac,
            kostnad: alloc.totals.totalRaise * months * poFactor,
            rawGap: rawGenderGap(alloc.perPerson, p => p.nyLon)
        });
    }
    return out;
}

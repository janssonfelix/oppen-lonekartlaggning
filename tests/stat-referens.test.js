/**
 * Referenstester: verktygets statistik mot värden från etablerade implementationer.
 *
 * tests/stat.test.js prövar egenskaper (brusfri data, symmetri, singularitet). Den här
 * filen prövar i stället SIFFRORNA på en fast fixtur, så att en felräkning i HC3,
 * t-fördelningen, kvantilregressionen eller Blinder-Oaxaca fångas.
 *
 * Hur referensvärdena togs fram (2026-10-16):
 *   - Fixturen tests/fixtures/stat-referens.json: 100 rader, seedad mulberry32
 *     (tests/fixtures/gen-stat-referens.mjs, seed 20261016), heteroskedastiskt brus.
 *   - Referensvärdena tests/fixtures/stat-referens-varden.json räknades med
 *     tests/fixtures/ref-stat-referens.py (python3 -I; statsmodels 0.15.0, scipy 1.18.1):
 *       OLS-koefficienter, klassisk vcov och HC3 .......... statsmodels OLS (cov_HC3 ≡ R sandwich::vcovHC type="HC3")
 *       t-fördelningens CDF ............................... scipy.stats.t.cdf
 *       kvantilregression τ = 0,1 / 0,5 / 0,9 ............. exakt LP-lösning av check-förlusten (scipy linprog/HiGHS,
 *                                                           ≡ R quantreg::rq); statsmodels QuantReg gav samma β inom 1e-6
 *       Blinder-Oaxaca .................................... två statsmodels-OLS + komponentformeln
 *     Varken statsmodels eller R var installerat på maskinen; statsmodels/scipy installerades i en
 *     tillfällig venv enbart för att räkna fram fixturen. CI behöver inte Python.
 *
 * Uppmätt avvikelse i verktyget (toleranserna nedan speglar den):
 *   - fitOLS: β, vcovClassic, vcovHC3, R², σ² inom relativt 1e-12 av statsmodels.
 *   - tDistCdf (Hills approximation): största absoluta fel 2,1e-3 vid df 5, 4,8e-4 vid df 10,
 *     6,6e-5 vid df 26, 4,4e-6 vid df 99. Kommentaren i stat.js lovar «~4 decimaler för df ≥ 2»,
 *     vilket alltså bara håller från df ≈ 10 och uppåt.
 *   - _quantileRegression (IRLS): könskoefficienten avviker 0,21 procentenheter från den exakta
 *     lösningen vid τ = 0,5 men under 0,002 procentenheter vid τ = 0,1 och 0,9. Under den
 *     rapporteringsgräns på 0,5 procentenheter uppdraget satte; algoritmen är oförändrad.
 *   - Blinder-Oaxaca: komponenterna inom 1e-12.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { fitOLS, tDistCdf, pValue2Sided } from '../src/lib/stat.js';
import { basRangFn } from '../src/lib/likvardighet.js';
import { createAppWindow } from './helpers/app-harness.js';

const here = dirname(fileURLToPath(import.meta.url));
const las = f => JSON.parse(readFileSync(join(here, 'fixtures', f), 'utf8'));
const fx = las('stat-referens.json');
const ref = las('stat-referens-varden.json');

const X = fx.design.map(d => [1, d.kv, d.alderC, d.basC]);
const y = fx.design.map(d => d.y);
const pct = b => (Math.exp(b) - 1) * 100;
const relNara = (a, b, tol) => expect(Math.abs(a - b) / Math.max(Math.abs(b), 1e-300)).toBeLessThan(tol);

describe('fixturen', () => {
    it('designkolumnerna är konsekventa med råraderna och verktygets centrering', () => {
        // Verktyget centrerar ålder på radmedel och BAS-rang på medel av de UNIKA rangerna.
        const rang = basRangFn(fx.rows.map(r => r.bas));
        const unika = [...new Set(fx.rows.map(r => r.bas))].sort().map(rang);
        const basMean = unika.reduce((s, v) => s + v, 0) / unika.length;
        const ageMean = fx.rows.reduce((s, r) => s + r.alder, 0) / fx.rows.length;
        expect(fx.rows).toHaveLength(100);
        expect(ageMean).toBe(fx.ageMean);
        expect(basMean).toBe(fx.basMean);
        fx.rows.forEach((r, i) => {
            const d = fx.design[i];
            expect(d.y).toBe(Math.log(r.lon));
            expect(d.kv).toBe(r.kon === 'kvinna' ? 1 : 0);
            expect(d.alderC).toBe(r.alder - ageMean);
            expect(d.basC).toBe(rang(r.bas) - basMean);
        });
    });
});

describe('fitOLS mot statsmodels', () => {
    const fit = fitOLS(X, y);
    it('β (6 decimaler) och R², adjR², σ², RSS', () => {
        expect(fit).not.toBeNull();
        ref.ols.beta.forEach((b, i) => expect(fit.beta[i]).toBeCloseTo(b, 6));
        expect(fit.R2).toBeCloseTo(ref.ols.R2, 10);
        expect(fit.adjR2).toBeCloseTo(ref.ols.adjR2, 10);
        expect(fit.sigma2).toBeCloseTo(ref.ols.sigma2, 10);
        expect(fit.rss).toBeCloseTo(ref.ols.rss, 10);
    });
    it('vcovClassic elementvis (relativt 1e-9)', () => {
        for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) relNara(fit.vcovClassic[i][j], ref.ols.vcovClassic[i][j], 1e-9);
    });
    it('vcovHC3 elementvis (relativt 1e-9) och HC3-standardfel (6 decimaler)', () => {
        for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) relNara(fit.vcovHC3[i][j], ref.ols.vcovHC3[i][j], 1e-9);
        ref.ols.seHC3.forEach((se, i) => expect(Math.sqrt(fit.vcovHC3[i][i])).toBeCloseTo(se, 8));
    });
    it('HC3 skiljer sig från klassisk vcov på den heteroskedastiska fixturen', () => {
        // Sanity: fixturen är byggd så att testet verkligen skiljer HC3 från klassisk.
        expect(Math.abs(fit.vcovHC3[1][1] / fit.vcovClassic[1][1] - 1)).toBeGreaterThan(0.01);
    });
    it('p-värdet för könskoefficienten (t = β/SE_HC3, df = n−k) mot scipy', () => {
        const t = fit.beta[1] / Math.sqrt(fit.vcovHC3[1][1]);
        expect(t).toBeCloseTo(ref.ols.tKon, 8);
        // df = 96: Hills approximation ligger inom 1e-5 av exakt CDF här.
        expect(pValue2Sided(t, fit.n, fit.k)).toBeCloseTo(ref.ols.pKon, 4);
    });
});

describe('tDistCdf och pValue2Sided mot scipy.stats.t', () => {
    // Uppmätt maxfel per df (se filhuvudet) med marginal.
    const tol = { 5: 3e-3, 10: 1e-3, 26: 1e-4, 99: 1e-5 };
    for (const df of [5, 10, 26, 99]) {
        it(`CDF vid df=${df} inom ${tol[df]}`, () => {
            for (const [t, p] of Object.entries(ref.tcdf[df])) {
                expect(Math.abs(tDistCdf(+t, df) - p)).toBeLessThan(tol[df]);
                expect(Math.abs(tDistCdf(-t, df) - (1 - p))).toBeLessThan(tol[df]);
            }
        });
        it(`tvåsidigt p vid df=${df} inom ${2 * tol[df]}`, () => {
            for (const [t, p] of Object.entries(ref.tcdf[df])) {
                // pValue2Sided tar n och k; df = n − k.
                expect(Math.abs(pValue2Sided(+t, df + 4, 4) - 2 * (1 - p))).toBeLessThan(2 * tol[df]);
            }
        });
    }
    it('tabellvärdet t = 2,056 vid df 26 ger p ≈ 0,05', () => {
        // qt(0.975, 26) = 2.0555; scipy: 2·(1 − pt(2.056, 26)) = 0.04995.
        expect(pValue2Sided(2.056, 30, 4)).toBeCloseTo(0.05, 3);
        expect(pValue2Sided(2.056, 30, 4)).toBeCloseTo(2 * (1 - ref.tcdf[26]['2.056']), 3);
    });
});

describe('kvantilregression (IRLS i app-scope) mot exakt LP-lösning (≡ quantreg::rq)', () => {
    // IRLS är en approximation; toleranserna är de uppmätta avvikelserna med marginal (se filhuvudet).
    const tolBeta = 3e-3, tolKonPp = 0.3;
    for (const tau of ['0.1', '0.5', '0.9']) {
        it(`τ = ${tau}: alla β inom ${tolBeta}, könskoefficienten inom ${tolKonPp} procentenheter`, () => {
            const w = createAppWindow();
            w.__X = X; w.__y = y;
            const fit = w.eval(`_quantileRegression(window.__X, window.__y, ${tau})`);
            expect(fit).not.toBeNull();
            const rb = ref.quantreg[tau].beta;
            rb.forEach((b, i) => expect(Math.abs(fit.beta[i] - b)).toBeLessThan(tolBeta));
            expect(Math.abs(pct(fit.beta[1]) - pct(rb[1]))).toBeLessThan(tolKonPp);
            // Check-förlusten får inte vara lägre än LP-optimum (det är per definition minimum) och inte mycket högre.
            const forlust = y.reduce((s, yi, i) => {
                const r = yi - X[i].reduce((a, v, j) => a + v * fit.beta[j], 0);
                return s + (r >= 0 ? +tau * r : (+tau - 1) * r);
            }, 0);
            expect(forlust).toBeGreaterThanOrEqual(ref.quantreg[tau].loss - 1e-9);
            expect(forlust / ref.quantreg[tau].loss - 1).toBeLessThan(1e-3);
        });
    }
    it('runQuantileRegressionAtAllTau på råraderna ger samma könsprocent som LP-referensen', () => {
        const w = createAppWindow();
        w.__state.data = fx.rows.map(r => ({ ...r }));
        const ut = w.eval('runQuantileRegressionAtAllTau()');
        expect(ut.n).toBe(100);
        for (const r of ut.results) {
            expect(r.error).toBeUndefined();
            expect(Math.abs(r.konPct - pct(ref.quantreg[String(r.tau)].beta[1]))).toBeLessThan(tolKonPp);
        }
    });
});

describe('sekventiell dekomponering (BAS som indikatorer, ADR-44)', () => {
    // Referensen för stegen med BAS-indikatorer räknas här med lib-fitOLS, som ovan är prövad mot
    // statsmodels på samma fixtur. Steget "Endast kön" jämförs därtill mot statsmodels-värdet
    // (ref.sekventiell.endastKon); plusBas/plusAlder i referensfilen gäller den tidigare linjära
    // BAS-rangen och används inte längre.
    it('könsgapet i varje steg (kön; + BAS-indikatorer; + ålder; + yrkesgrupp)', () => {
        const w = createAppWindow();
        w.__rows = fx.rows.map(r => ({ ...r }));
        const basList = [...new Set(fx.rows.map(r => r.bas))].sort();
        w.__basList = basList;
        const steg = w.eval(`_computeSequentialGap(window.__rows, ${fx.ageMean}, window.__basList)`);
        // Fixturen har ett yrke per BAS, så steget + Yrkesgrupp (inomtransformation på AID×BAS,
        // ADR-46) ska ge exakt samma könskoefficient som + Ålder med BAS-indikatorer
        // (Frisch–Waugh–Lovell) — en kontroll av inomskattaren mot indikatormodellen.
        expect(steg.map(s => s.name)).toEqual(['Endast kön', '+ BAS-intervall', '+ Ålder', '+ Yrkesgrupp']);
        const dummies = basList.slice(1);
        const rad = (r, medAlder, medBas) => [1, r.kon.includes('kvinna') ? 1 : 0,
            ...(medAlder ? [r.alder - fx.ageMean] : []),
            ...(medBas ? dummies.map(b => (r.bas === b ? 1 : 0)) : [])];
        const yl = fx.rows.map(r => Math.log(r.lon));
        const vantat = [
            pct(ref.sekventiell.endastKon[1]),
            pct(fitOLS(fx.rows.map(r => rad(r, false, true)), yl).beta[1]),
            pct(fitOLS(fx.rows.map(r => rad(r, true, true)), yl).beta[1]),
        ];
        vantat.push(vantat[2]);
        steg.forEach((s, i) => {
            expect(s.status).toBe('ok');
            expect(s.gapPct).toBeCloseTo(vantat[i], 8);
        });
    });
});

describe('Blinder-Oaxaca', () => {
    const bo = ref.blinderOaxaca;
    it('komponenterna från två fitOLS-regressioner, handräknade i testet, matchar referensens', () => {
        // Oberoende av app-scope: samma formel som runBlinderOaxaca, men på lib-nivå.
        const kv = fx.design.filter(d => d.kv === 1), ma = fx.design.filter(d => d.kv === 0);
        const Xg = g => g.map(d => [1, d.alderC, d.basC]);
        const fK = fitOLS(Xg(kv), kv.map(d => d.y)), fM = fitOLS(Xg(ma), ma.map(d => d.y));
        const medel = g => [0, 1, 2].map(j => Xg(g).reduce((s, r) => s + r[j], 0) / g.length);
        const xK = medel(kv), xM = medel(ma);
        bo.betaKv.forEach((b, i) => expect(fK.beta[i]).toBeCloseTo(b, 8));
        bo.betaMa.forEach((b, i) => expect(fM.beta[i]).toBeCloseTo(b, 8));
        let q = 0, u = 0, i = 0;
        for (let j = 0; j < 3; j++) {
            const dx = xM[j] - xK[j], db = fM.beta[j] - fK.beta[j];
            q += dx * fK.beta[j]; u += xK[j] * db; i += dx * db;
        }
        expect(q).toBeCloseTo(bo.q, 10);
        expect(u).toBeCloseTo(bo.u, 10);
        expect(i).toBeCloseTo(bo.i, 10);
        expect(q + u + i).toBeCloseTo(bo.rawGapLog, 10);
    });
    it('runBlinderOaxaca på råraderna: endowment, coefficient, interaction mot referens; summan = rågapet', () => {
        const w = createAppWindow();
        w.__state.data = fx.rows.map(r => ({ ...r }));
        const ut = w.eval('runBlinderOaxaca()');
        expect(ut).not.toBeNull();
        expect(ut.nKv).toBe(bo.nKv);
        expect(ut.nMa).toBe(bo.nMa);
        expect(ut._raw.rawGapLog).toBeCloseTo(bo.rawGapLog, 10);
        expect(ut._raw.q).toBeCloseTo(bo.q, 10);
        expect(ut._raw.u).toBeCloseTo(bo.u, 10);
        expect(ut._raw.i).toBeCloseTo(bo.i, 10);
        expect(ut._raw.q + ut._raw.u + ut._raw.i).toBeCloseTo(ut._raw.rawGapLog, 10);
        for (const lab of ['intercept', 'age', 'bas']) {
            expect(ut.components[lab].q).toBeCloseTo(bo.perKomponent[lab].q, 10);
            expect(ut.components[lab].u).toBeCloseTo(bo.perKomponent[lab].u, 10);
            expect(ut.components[lab].i).toBeCloseTo(bo.perKomponent[lab].i, 10);
        }
        expect(ut.rawGapPct).toBeCloseTo(pct(bo.rawGapLog), 8);
        expect(ut.explainedPct).toBeCloseTo(pct(bo.q), 8);
        expect(ut.unexplainedPct).toBeCloseTo(pct(bo.u + bo.i), 8);
    });
});

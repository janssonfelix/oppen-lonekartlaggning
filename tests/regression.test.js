/**
 * Lib-tester för src/lib/regression.js, direkt mot modulen (utan jsdom och utan appen).
 *
 * Prövar samma referensvärden som tests/stat-referens.test.js, men på den rena modellen:
 *   - "Endast kön"-steget i den sekventiella dekomponeringen mot statsmodels-värdet
 *   - kvantilregressionen (τ = 0,1 / 0,5 / 0,9) mot den exakta LP-lösningen (≡ quantreg::rq)
 * Fixturerna och referensvärdena beskrivs i filhuvudet till tests/stat-referens.test.js.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { fitOLS as fitOLSRef } from '../src/lib/stat.js';
import { computeSequentialGap, quantileRegression, FORKLARINGSMODELL_STANDARD, TILLFOR_GRANS_PP,
    normaliseraForklaringsmodell, forklaringsmodellArStandard, modellFras, modellBeskrivning, modellVariabler,
    computeVariabelTillfor } from '../src/lib/regression.js';

const here = dirname(fileURLToPath(import.meta.url));
const las = f => JSON.parse(readFileSync(join(here, 'fixtures', f), 'utf8'));
const fx = las('stat-referens.json');
const ref = las('stat-referens-varden.json');

const pct = b => (Math.exp(b) - 1) * 100;
const X = fx.design.map(d => [1, d.kv, d.alderC, d.basC]);
const y = fx.design.map(d => d.y);

describe('computeSequentialGap: steget "Endast kön"', () => {
    it('könsgapet i procent matchar statsmodels-referensen', () => {
        const basList = [...new Set(fx.rows.map(r => r.bas))].sort();
        const steg = computeSequentialGap(fx.rows.map(r => ({ ...r })), fx.ageMean, basList, { golv: 10 });
        expect(steg[0].name).toBe('Endast kön');
        expect(steg[0].status).toBe('ok');
        expect(steg[0].gapPct).toBeCloseTo(pct(ref.sekventiell.endastKon[1]), 8);
    });
});

describe('quantileRegression mot exakt LP-lösning (≡ quantreg::rq)', () => {
    // Samma toleranser som tests/stat-referens.test.js: IRLS är en approximation.
    const tolBeta = 3e-3, tolKonPp = 0.3;
    for (const tau of [0.1, 0.5, 0.9]) {
        it(`τ = ${tau}: alla β inom ${tolBeta}, könskoefficienten inom ${tolKonPp} procentenheter`, () => {
            const fit = quantileRegression(X, y, tau);
            expect(fit).not.toBeNull();
            const rb = ref.quantreg[String(tau)].beta;
            rb.forEach((b, i) => expect(Math.abs(fit.beta[i] - b)).toBeLessThan(tolBeta));
            expect(Math.abs(pct(fit.beta[1]) - pct(rb[1]))).toBeLessThan(tolKonPp);
            // Check-förlusten ska ligga nära LP-optimum (per definition ≥ optimum).
            const forlust = y.reduce((s, yi, i) => {
                const r = yi - X[i].reduce((a, v, j) => a + v * fit.beta[j], 0);
                return s + (r >= 0 ? tau * r : (tau - 1) * r);
            }, 0);
            expect(forlust).toBeGreaterThanOrEqual(ref.quantreg[String(tau)].loss - 1e-9);
            expect(forlust / ref.quantreg[String(tau)].loss - 1).toBeLessThan(1e-3);
        });
    }
});

describe('förklaringsmodellen som värde (ADR-56)', () => {
    const m = (bas, alder, yrkesgrupp = false, skal = '') => ({ bas, alder, yrkesgrupp, skal });
    it('standard: null och undefined ger fullmodellen utan yrkesgrupp, utan varningar', () => {
        expect(FORKLARINGSMODELL_STANDARD).toEqual(m(true, true));
        expect(TILLFOR_GRANS_PP).toBe(0.5);
        for (const v of [null, undefined]) {
            const r = normaliseraForklaringsmodell(v);
            expect(r.modell).toEqual(m(true, true));
            expect(r.varningar).toEqual([]);
        }
        expect(forklaringsmodellArStandard(m(true, true))).toBe(true);
        expect(forklaringsmodellArStandard(m(true, false))).toBe(false);
        expect(forklaringsmodellArStandard(m(true, true, false, 'skäl'))).toBe(false);
    });
    it('booleska fält tvingas: ett annat värde än true räknas som falskt', () => {
        const r = normaliseraForklaringsmodell({ alder: 'ja', bas: true });
        expect(r.modell.alder).toBe(false);
        expect(r.modell.bas).toBe(true);
        expect(r.modell.yrkesgrupp).toBe(false);
    });
    it('yrkesgrupp kräver BAS: BAS kryssas i med en varning', () => {
        const r = normaliseraForklaringsmodell({ yrkesgrupp: true, bas: false, alder: true });
        expect(r.modell).toEqual(m(true, true, true));
        expect(r.varningar.join(' ')).toMatch(/BAS/);
    });
    it('yrkesgrupp utan yrke i datat: stängs av med en varning', () => {
        const r = normaliseraForklaringsmodell({ yrkesgrupp: true, bas: true, alder: true }, { harYrke: false });
        expect(r.modell.yrkesgrupp).toBe(false);
        expect(r.varningar.length).toBe(1);
    });
    it('skälet klipps till 300 tecken och blir tomt när det inte är en sträng; fel typ ger standard med varning', () => {
        expect(normaliseraForklaringsmodell({ bas: true, alder: true, skal: 'x'.repeat(400) }).modell.skal).toHaveLength(300);
        expect(normaliseraForklaringsmodell({ bas: true, alder: true, skal: 42 }).modell.skal).toBe('');
        const r = normaliseraForklaringsmodell('full');
        expect(r.modell).toEqual(m(true, true));
        expect(r.varningar.length).toBe(1);
    });
    it('frasen för de sex kombinationerna', () => {
        expect(modellFras(m(true, true))).toBe('ålder och BAS-intervall');
        expect(modellFras(m(true, false))).toBe('BAS-intervall');
        expect(modellFras(m(false, true))).toBe('ålder');
        expect(modellFras(m(true, false, true))).toBe('BAS-intervall och yrkesgrupp');
        expect(modellFras(m(true, true, true))).toBe('ålder, BAS-intervall och yrkesgrupp');
        expect(modellFras(m(false, false))).toBe('');
    });
    it('beskrivningen för modelDesc och variablerna i fast ordning', () => {
        expect(modellBeskrivning(m(true, true))).toBe('kön + ålder + BAS-intervall (indikatorer)');
        expect(modellBeskrivning(m(true, false))).toBe('kön + BAS-intervall (indikatorer)');
        expect(modellBeskrivning(m(false, true))).toBe('kön + ålder');
        expect(modellBeskrivning(m(false, false))).toBe('kön');
        expect(modellBeskrivning(m(true, false, true))).toBe('kön + BAS-intervall (indikatorer) + yrkesgrupp inom BAS (fasta effekter)');
        expect(modellVariabler(m(true, true, true))).toEqual(['bas', 'alder', 'yrkesgrupp']);
        expect(modellVariabler(m(false, true))).toEqual(['alder']);
        expect(modellVariabler(m(false, false))).toEqual([]);
    });
});

describe('computeSequentialGap med vald modell (ADR-56)', () => {
    const rader = () => fx.rows.map(r => ({ ...r }));
    const basList = [...new Set(fx.rows.map(r => r.bas))].sort();
    const kor = modell => computeSequentialGap(rader(), fx.ageMean, basList, { golv: 10, modell: { yrkesgrupp: false, skal: '', ...modell } });
    const namn = steg => steg.map(s => s.name);
    it('standardmodellen ger samma steg och tal som i dag (statsmodels-referensen)', () => {
        const steg = kor({ bas: true, alder: true });
        expect(namn(steg)).toEqual(['Endast kön', '+ BAS-intervall', '+ Ålder', '+ Yrkesgrupp']);
        expect(steg[0].gapPct).toBeCloseTo(pct(ref.sekventiell.endastKon[1]), 8);
        // Referensens plusBas/plusAlder är den linjära BAS-rangen (före ADR-44); stegen jämförs med dagens anrop utan modell.
        expect(computeSequentialGap(rader(), fx.ageMean, basList, { golv: 10 }).map(s => s.gapPct)).toEqual(steg.map(s => s.gapPct));
    });
    it('bara BAS, bara ålder, endast kön: stegen följer valet', () => {
        expect(namn(kor({ bas: true, alder: false }))).toEqual(['Endast kön', '+ BAS-intervall', '+ Yrkesgrupp']);
        expect(namn(kor({ bas: false, alder: true }))).toEqual(['Endast kön', '+ Ålder']);
        expect(namn(kor({ bas: false, alder: false }))).toEqual(['Endast kön']);
    });
    it('+ Ålder ovanpå ingenting ger samma gap som modellen kön + ålder', () => {
        const steg = kor({ bas: false, alder: true });
        const Xa = fx.design.map(d => [1, d.kv, d.alderC]);
        const f = fitOLSRef(Xa, y);
        expect(steg[1].gapPct).toBeCloseTo(pct(f.beta[1]), 8);
    });
    it('yrkesgrupp vald: steget + Yrkesgrupp är sist och ok; utan ålder räknas det utan ålderskolumn', () => {
        const medAlder = kor({ bas: true, alder: true, yrkesgrupp: true });
        expect(namn(medAlder)).toEqual(['Endast kön', '+ BAS-intervall', '+ Ålder', '+ Yrkesgrupp']);
        expect(medAlder[3].status).toBe('ok');
        const utanAlder = kor({ bas: true, alder: false, yrkesgrupp: true });
        expect(namn(utanAlder)).toEqual(['Endast kön', '+ BAS-intervall', '+ Yrkesgrupp']);
        expect(utanAlder[2].status).toBe('ok');
        expect(utanAlder[2].gapPct).not.toBeCloseTo(medAlder[3].gapPct, 6);
    });
});

describe('computeVariabelTillfor (ADR-56)', () => {
    const rader = () => fx.rows.map(r => ({ ...r }));
    const basList = [...new Set(fx.rows.map(r => r.bas))].sort();
    it('utan yrke: raderna bas och alder, ΔR² ≥ 0, gapMed = fullmodellens gap, gapUtan = stegets gap utan variabeln', () => {
        const t = computeVariabelTillfor(rader(), fx.ageMean, basList, { golv: 10, harYrke: false });
        expect(t.rader.map(r => r.variabel)).toEqual(['bas', 'alder']);
        const standard = computeSequentialGap(rader(), fx.ageMean, basList, { golv: 10 });
        expect(t.full.gapPct).toBeCloseTo(standard.find(s => s.name === '+ Ålder').gapPct, 10);
        for (const r of t.rader) {
            expect(r.status).toBe('ok');
            expect(r.deltaR2pp).toBeGreaterThanOrEqual(0);
            expect(r.gapMed).toBeCloseTo(t.full.gapPct, 10);
            expect(r.tillforLite).toBe(r.deltaR2pp < TILLFOR_GRANS_PP);
        }
        const utanAlder = computeSequentialGap(rader(), fx.ageMean, basList, { golv: 10, modell: { bas: true, alder: false, yrkesgrupp: false, skal: '' } });
        expect(t.rader[1].gapUtan).toBeCloseTo(utanAlder[1].gapPct, 10);
        const utanBas = computeSequentialGap(rader(), fx.ageMean, basList, { golv: 10, modell: { bas: false, alder: true, yrkesgrupp: false, skal: '' } });
        expect(t.rader[0].gapUtan).toBeCloseTo(utanBas[1].gapPct, 10);
    });
    it('med yrke: en tredje rad som mäts ovanpå fullmodellen', () => {
        const t = computeVariabelTillfor(rader(), fx.ageMean, basList, { golv: 10, harYrke: true });
        expect(t.rader.map(r => r.variabel)).toEqual(['bas', 'alder', 'yrkesgrupp']);
        expect(t.rader[2].gapUtan).toBeCloseTo(t.full.gapPct, 10);
        expect(t.rader[2].status).toBe('ok');
    });
    it('förslaget: när lönen inte beror på ålder föreslås ålder tas bort, inte BAS', () => {
        let seed = 7;
        const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
        const basar = ['A', 'B', 'C', 'D'];
        const rows = Array.from({ length: 400 }, (_, i) => {
            const bas = basar[i % 4];
            return { kon: rnd() < 0.5 ? 'kvinna' : 'man', bas, alder: 25 + Math.floor(rnd() * 40),
                lon: Math.round(25000 * (1 + 0.15 * basar.indexOf(bas)) * Math.exp((rnd() - 0.5) * 0.02)) };
        });
        const ageMean = rows.reduce((s, r) => s + r.alder, 0) / rows.length;
        const t = computeVariabelTillfor(rows, ageMean, basar, { golv: 10, harYrke: false });
        expect(t.forslag.tabort).toEqual(['alder']);
        expect(t.rader[0].tillforLite).toBe(false);
    });
});

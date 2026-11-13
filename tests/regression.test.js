/**
 * Lib-tester för src/lib/regression.js, direkt mot modulen (utan jsdom och utan appen).
 *
 * Prövar samma referensvärden som tests/stat-referens.test.js, men på den rena modellen:
 *   - "Endast kön"-steget i den sekventiella dekomponeringen mot statsmodels-värdet
 *   - kvantilregressionen (τ = 0,1 / 0,5 / 0,9) mot den exakta LP-lösningen (≡ quantreg::rq)
 * Fixturerna och referensvärdena beskrivs i filhuvudet till tests/stat-referens.test.js.
 *
 * Vaktar: R21, R25 (docs/utveckling/regler.md)
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { fitOLS as fitOLSRef } from '../src/lib/stat.js';
import { computeSequentialGap, quantileRegression, FORKLARINGSMODELL_STANDARD, TILLFOR_GRANS_PP,
    normaliseraForklaringsmodell, forklaringsmodellArStandard, modellFras, modellBeskrivning, modellVariabler,
    computeVariabelTillfor, computePerBasGap, blinderOaxaca, kvantilDesign, quantileRegressionAtAllTau, harAlderIRader } from '../src/lib/regression.js';
import { aldersjusteradSkillnad } from '../src/lib/likvardighet.js';

const here = dirname(fileURLToPath(import.meta.url));
const las = f => JSON.parse(readFileSync(join(here, 'fixtures', f), 'utf8'));
const fx = las('stat-referens.json');
const ref = las('stat-referens-varden.json');
const refKv = las('stat-referens-kvantil.json');

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

describe('kvantilDesign: kvantilregressionen på huvudmodellens design (ADR-63)', () => {
    const rader = () => fx.rows.map(r => ({ ...r }));
    const m = (bas, alder, yrkesgrupp = false) => ({ bas, alder, yrkesgrupp, skal: '' });
    it('standardmodellen: intercept, kön, centrerad ålder och en indikator per BAS-intervall utom det första', () => {
        const d = kvantilDesign(rader(), FORKLARINGSMODELL_STANDARD);
        expect(d.kolumner).toEqual(refKv.standard.kolumner);
        expect(d.basList).toEqual(['A', 'B', 'C', 'D', 'E', 'F']);
        expect(d.ageMean).toBe(fx.ageMean);
        expect(d.rader).toHaveLength(100);
        d.X.forEach((x, i) => {
            const r = fx.rows[i];
            expect(x).toEqual([1, r.kon === 'kvinna' ? 1 : 0, r.alder - fx.ageMean, ...['B', 'C', 'D', 'E', 'F'].map(b => (r.bas === b ? 1 : 0))]);
        });
        expect(d.y).toEqual(fx.rows.map(r => Math.log(r.lon)));
    });
    it('indikatorer i stället för BAS-rang: BAS-kolumnerna är 0/1 och högst en etta per rad', () => {
        const d = kvantilDesign(rader(), FORKLARINGSMODELL_STANDARD);
        const bas = d.X.map(x => x.slice(3));
        expect(bas.flat().every(v => v === 0 || v === 1)).toBe(true);
        expect(bas.every(r => r.reduce((s, v) => s + v, 0) <= 1)).toBe(true);
    });
    it('följer förklaringsmodellen: utan ålder ingen ålderskolumn, bara ålder inga BAS-kolumner, yrkesgrupp ingår aldrig', () => {
        const std = kvantilDesign(rader(), m(true, true));
        const utanAlder = kvantilDesign(rader(), m(true, false));
        expect(utanAlder.kolumner).toEqual(refKv.baraBas.kolumner);
        expect(utanAlder.kolumner).not.toContain('alder');
        expect(utanAlder.X[0]).toHaveLength(std.X[0].length - 1);
        expect(kvantilDesign(rader(), m(false, true)).kolumner).toEqual(['intercept', 'kvinna', 'alder']);
        expect(kvantilDesign(rader(), m(false, false)).kolumner).toEqual(['intercept', 'kvinna']);
        // Yrkesgrupp inom BAS väljs bort här (fasta effekter per AID × BAS hör till huvudregressionen, inte kvantilerna).
        expect(kvantilDesign(rader(), m(true, true, true)).kolumner).toEqual(std.kolumner);
    });
    it('utan ålder i modellen behövs ingen ålder i raderna (lönefil utan ålder)', () => {
        const utan = fx.rows.map(({ alder: _a, ...r }) => r);
        const d = kvantilDesign(utan, m(true, false));
        expect(d.rader).toHaveLength(100);
        expect(d.X.flat().every(Number.isFinite)).toBe(true);
        const q = quantileRegressionAtAllTau(utan, { modell: m(true, false) });
        expect(q.results.every(r => !r.error && Number.isFinite(r.konPct))).toBe(true);
    });
    it('basList och ageMean kan ges utifrån; referensen är det första intervallet i listan', () => {
        const d = kvantilDesign(rader(), FORKLARINGSMODELL_STANDARD, { ageMean: 40, basList: ['B', 'A', 'C', 'D', 'E', 'F'] });
        expect(d.kolumner.slice(3)).toEqual(['bas:A', 'bas:C', 'bas:D', 'bas:E', 'bas:F']);
        expect(d.X[0][2]).toBe(fx.rows[0].alder - 40);
    });
});

describe('quantileRegressionAtAllTau på indikatormodellen (ADR-63)', () => {
    it('tar förklaringsmodellen, inte en rangfunktion, och ger könsprocenten per τ och skillnaden P90 − P10', () => {
        const q = quantileRegressionAtAllTau(fx.rows.map(r => ({ ...r })));
        expect(q.n).toBe(100);
        expect(q.kolumner).toEqual(refKv.standard.kolumner);
        expect(q.results.map(r => r.tau)).toEqual([0.1, 0.5, 0.9]);
        for (const r of q.results) expect(Math.abs(r.konPct - pct(refKv.standard[String(r.tau)].beta[1]))).toBeLessThan(0.3);
        expect(q.diffP90P10).toBeCloseTo(q.results[2].konPct - q.results[0].konPct, 12);
        // En rang-parameter har ingen verkan längre.
        const medRang = quantileRegressionAtAllTau(fx.rows.map(r => ({ ...r })), { rang: () => () => 1 });
        expect(medRang.results).toEqual(q.results);
    });
    it('samma skattning som quantileRegression på kvantilDesign (appen och bootstrappen delar matrisen)', () => {
        const d = kvantilDesign(fx.rows.map(r => ({ ...r })), FORKLARINGSMODELL_STANDARD);
        const q = quantileRegressionAtAllTau(fx.rows.map(r => ({ ...r })));
        for (const r of q.results) expect(r.konPct).toBe(pct(quantileRegression(d.X, d.y, r.tau).beta[1]));
    });
});

// ---- Lönefil utan ålder (ADR-64): kön + BAS, inga ålderskolumner ----
/** 3 BAS × 2 kön, deterministiska löner, ålder 0 (ålderskolumnen saknas: inläsningen ger 0). */
function utanAlder(nPer = 30) {
    const rader = [];
    ['A', 'B', 'C'].forEach((bas, j) => {
        for (let i = 0; i < nPer; i++) {
            for (const kon of ['kvinna', 'man']) {
                const lon = 28000 + j * 3000 + (kon === 'man' ? 1200 : 0) + ((i * 37) % 23) * 90;
                rader.push({ bas, kon, lon, alder: 0, aid: '5301', yrke: '5301 Undersköterska' });
            }
        }
    });
    return rader;
}

describe('modellerna utan ålder i lönefilen (ADR-64)', () => {
    it('harAlderIRader: någon rad med ålder > 0', () => {
        expect(harAlderIRader(utanAlder())).toBe(false);
        expect(harAlderIRader([{ alder: 0 }, { alder: 41 }])).toBe(true);
        expect(harAlderIRader([])).toBe(false);
    });
    it('normaliseraForklaringsmodell tvingar bort ålder med en varning; standarden är oförändrad', () => {
        const { modell, varningar } = normaliseraForklaringsmodell({ bas: true, alder: true }, { harAlder: false });
        expect(modell.alder).toBe(false);
        expect(modell.bas).toBe(true);
        expect(varningar.join(' ')).toMatch(/ålder/i);
        expect(normaliseraForklaringsmodell(null, { harAlder: false }).modell.alder).toBe(false);
        expect(normaliseraForklaringsmodell(null).modell).toEqual({ ...FORKLARINGSMODELL_STANDARD });
        expect(FORKLARINGSMODELL_STANDARD.alder).toBe(true);
    });
    it('computeSequentialGap räknar kön och BAS utan åldersteg', () => {
        const steg = computeSequentialGap(utanAlder(), 0, ['A', 'B', 'C'], { golv: 10 });
        expect(steg.map(s => s.name)).not.toContain('+ Ålder');
        expect(steg[0].status).toBe('ok');
        expect(steg.find(s => s.name === '+ BAS-intervall').status).toBe('ok');
    });
    it('computeVariabelTillfor utan ålder: fullmodellen är kön + BAS och ålder har ingen rad', () => {
        const t = computeVariabelTillfor(utanAlder(), 0, ['A', 'B', 'C'], { golv: 10 });
        expect(t.full.status).toBe('ok');
        expect(t.rader.map(x => x.variabel)).not.toContain('alder');
        expect(t.forslag.tabort).not.toContain('alder');
    });
    it('computePerBasGap kör kön utan ålderskolumn', () => {
        const ut = computePerBasGap(utanAlder(), ['A', 'B', 'C'], { golv: 10 });
        expect(ut).toHaveLength(3);
        for (const b of ut) {
            expect(b.status).toBe('ok');
            expect(b.n).toBe(60);
            expect(Number.isFinite(b.gapPct)).toBe(true);
            expect(b.gapPct).toBeLessThan(0);
        }
    });
    it('blinderOaxaca delar upp på BAS utan ålder', () => {
        const bo = blinderOaxaca(utanAlder(), { golv: 10 });
        expect(bo).not.toBeNull();
        expect(bo.modell.alder).toBe(false);
        expect(Object.keys(bo.components)).not.toContain('age');
        expect(bo.n).toBe(180);
        expect(bo._raw.q + bo._raw.u + bo._raw.i).toBeCloseTo(bo._raw.rawGapLog, 9);
    });
    it('quantileRegressionAtAllTau skattar utan ålderskolumn', () => {
        const q = quantileRegressionAtAllTau(utanAlder());
        expect(q).not.toBeNull();
        expect(q.n).toBe(180);
        for (const r of q.results) expect(Number.isFinite(r.konPct)).toBe(true);
    });
    it('aldersjusteradSkillnad ger null utan ålder', () => {
        const r = utanAlder();
        expect(aldersjusteradSkillnad(r.filter(d => d.kon === 'kvinna'), r.filter(d => d.kon === 'man'))).toBeNull();
    });
});

describe('modellerna filtrerar själva bort rader de inte kan räkna (B4)', () => {
    const rader = () => fx.rows.map(r => ({ ...r }));
    const basList = [...new Set(fx.rows.map(r => r.bas))].sort();
    // En rad med okänt kön skulle annars kodas som man (kvinna = 0) och flytta könsgapet.
    const okand = () => ({ ...fx.rows[0], kon: 'okänt', lon: fx.rows[0].lon * 3 });
    const utanLon = () => ({ ...fx.rows[1], lon: 0 });
    const gap = steg => steg.map(s => [s.name, s.status, s.gapPct]);
    it('computeSequentialGap: rad med okänt kön eller lön 0 räknas inte', () => {
        const utan = computeSequentialGap(rader(), fx.ageMean, basList, { golv: 10 });
        const med = computeSequentialGap([...rader(), okand(), utanLon()], fx.ageMean, basList, { golv: 10 });
        expect(gap(med)).toEqual(gap(utan));
    });
    it('computeVariabelTillfor: rad med okänt kön eller lön 0 räknas inte', () => {
        const utan = computeVariabelTillfor(rader(), fx.ageMean, basList, { golv: 10, harYrke: true });
        const med = computeVariabelTillfor([...rader(), okand(), utanLon()], fx.ageMean, basList, { golv: 10, harYrke: true });
        expect(med.full).toEqual(utan.full);
        expect(med.rader).toEqual(utan.rader);
    });
    it('rad med ålder 0 räknas inte när lönefilen har ålder', () => {
        const utan = computeSequentialGap(rader(), fx.ageMean, basList, { golv: 10 });
        const med = computeSequentialGap([...rader(), { ...fx.rows[2], alder: 0 }], fx.ageMean, basList, { golv: 10 });
        expect(gap(med)).toEqual(gap(utan));
    });
});

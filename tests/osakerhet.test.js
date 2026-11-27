// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
/**
 * Osäkerheten kring skattningarna (src/lib/osakerhet.js) och percentilintervallet (src/lib/stat.js), fristående och på
 * små påhittade underlag: bootstrapintervallen på mediankvoten med en injicerad, seedad generator, konfidensbandet
 * kring en regressionslinje räknat för hand, styrkan (minsta upptäckbara skillnad) räknad för hand, extremvärdena med
 * en känd avvikare och ett BAS-intervall under golvet, trattens underlag och kvantilregressionens intervall.
 * Att appens adaptrar ger samma tal som funktionerna här prövas i tests/osakerhet-adapter.test.js.
 */
import { describe, it, expect, vi } from 'vitest';
import { percentilintervall, median } from '../src/lib/stat.js';
import { mulberry32, slumpFor } from '../src/lib/rng.js';
import { slumpensGranser } from '../src/lib/status.js';
import { kvantilregressionAllaTau, kvantilDesign, FORKLARINGSMODELL_STANDARD } from '../src/lib/regression.js';
import {
    organisationensKvotKI, medianKvotKI, medianKvotKIGiltiga, konskvotPerGrupp, regressionslinjensBand, mdeProcent, styrkeanalys, sigmaInomGrupp,
    gruppMde, extremvarden, trattUnderlag, kvantilBootstrap, osakerhetKonstanter,
    B_ORGANISATION, B_PER_GRUPP, B_DOSSIER, BALANSGRANS, MDE_SIGMA_MIN_RESIDUALER, EXTREMVARDE_Z, KVANTIL_KI_B
} from '../src/lib/osakerhet.js';
import { Z_95, Z_STYRKA } from '../src/lib/stat.js';

// Påhittade löner: deterministiska, osorterade, med en del lika värden.
const loner = (n, s, bas = 30000) => Array.from({ length: n }, (_, i) => bas + Math.round(((i * 7919 + s) % 1000) * 4 + (i % 7) * 3));
const rad = (kon, lon, ovrigt = {}) => ({ kon, lon, bas: 'B', yrke: '111111 Påhittat yrke', aid: '111111', alder: 40, ...ovrigt });

describe('[B1.7] percentilintervall', () => {
    // Listan 0, 1, …, n − 1: värdet är indexet. Symmetriskt: lika många värden under den nedre gränsen som över den övre.
    const lista = n => Array.from({ length: n }, (_, i) => i);
    const symmetriskt = n => { const svans = Math.floor(n * 0.025); return { lag: svans, hog: n - 1 - svans }; };
    it('tar index golvet av n · 0,025 och n − 1 − golvet av n · 0,025', () => {
        expect(percentilintervall(lista(1000))).toEqual({ lag: 25, hog: 974 });
        expect(percentilintervall(lista(2000))).toEqual({ lag: 50, hog: 1949 });
        expect(percentilintervall(lista(200))).toEqual({ lag: 5, hog: 194 });
        expect(percentilintervall(lista(40))).toEqual({ lag: 1, hog: 38 });
        expect(percentilintervall(lista(39))).toEqual({ lag: 0, hog: 38 });
        expect(percentilintervall(lista(2))).toEqual({ lag: 0, hog: 1 });
        expect(percentilintervall(lista(1))).toEqual({ lag: 0, hog: 0 });
    });
    it('lika många dragningar ligger under den nedre gränsen som över den övre, för varje n upp till 2 500', () => {
        for (let n = 1; n <= 2500; n++) {
            const { lag, hog } = percentilintervall(lista(n));
            expect(lag, `n = ${n}`).toBe(n - 1 - hog);
            expect({ lag, hog }, `n = ${n}`).toEqual(symmetriskt(n));
        }
    });
    it('fungerar på typade listor', () => {
        expect(percentilintervall(new Float64Array([1, 2, 3]))).toEqual({ lag: 1, hog: 3 });
        expect(percentilintervall(new Float64Array(lista(40).map(i => i * 10)))).toEqual({ lag: 10, hog: 380 });
    });
});

describe('konstanterna', () => {
    it('har sina fastställda värden och finns i objektet för appen', () => {
        expect([B_ORGANISATION, B_PER_GRUPP, B_DOSSIER, Z_95, Z_STYRKA, BALANSGRANS, MDE_SIGMA_MIN_RESIDUALER, EXTREMVARDE_Z, KVANTIL_KI_B])
            .toEqual([2000, 1000, 2000, 1.96, 2.802, 0.4, 20, 3, 200]);
        const k = osakerhetKonstanter();
        expect(Object.isFrozen(k)).toBe(true);
        expect(k.B_ORGANISATION).toBe(2000);
        expect(k.KVANTIL_KI_MAX_N).toBe(2000);
    });
});

describe('[B4.1] bootstrapintervallen på mediankvoten', () => {
    const kv = loner(25, 1, 29000), ma = loner(30, 2, 31000);

    it('medianKvotKI: samma seed ger samma intervall, och det rymmer punktskattningen', () => {
        const a = medianKvotKI(kv, ma, { rng: mulberry32(42) });
        const b = medianKvotKI(kv, ma, { rng: mulberry32(42) });
        const c = medianKvotKI(kv, ma, { rng: mulberry32(43) });
        expect(a).toEqual(b);
        expect(c).not.toEqual(a);
        const punkt = median(kv) / median(ma) * 100;
        expect(a.lo).toBeLessThanOrEqual(punkt);
        expect(a.hi).toBeGreaterThanOrEqual(punkt);
        expect(a.lo).toBeGreaterThan(85);
        expect(a.hi).toBeLessThan(105);
    });
    it('medianKvotKI: utan generator seedas den ur lönerna', () => {
        expect(medianKvotKI(kv, ma)).toEqual(medianKvotKI(kv, ma, { rng: slumpFor(kv, ma) }));
        expect(medianKvotKI(kv, ma, { B: 300 })).toEqual(medianKvotKI(kv, ma, { B: 300, rng: slumpFor(kv, ma) }));
    });
    it('medianKvotKI: färre än tre av ett kön ger inget intervall', () => {
        expect(medianKvotKI([1, 2], [1, 2, 3])).toBeNull();
        expect(medianKvotKI([1, 2, 3], [1, 2])).toBeNull();
    });
    it('medianKvotKIGiltiga: samma seed, samma intervall; utan giltiga dragningar inget intervall', () => {
        const a = medianKvotKIGiltiga(kv, ma, { rng: mulberry32(7) });
        expect(a).toEqual(medianKvotKIGiltiga(kv, ma, { rng: mulberry32(7) }));
        expect(a.lo).toBeLessThan(a.hi);
        expect(medianKvotKIGiltiga(kv, ma)).toEqual(medianKvotKIGiltiga(kv, ma, { rng: slumpFor(kv, ma) }));
        // Männens löner är noll: ingen dragning har en positiv median.
        expect(medianKvotKIGiltiga(kv, [0, 0, 0, 0])).toBeNull();
        expect(medianKvotKIGiltiga([1, 2], [1, 2, 3])).toBeNull();
    });
    it('organisationensKvotKI: golvet, seeden och gapet som spegelbild av kvoten', () => {
        const rader = [...kv.map(l => rad('kvinna', l)), ...ma.map(l => rad('man', l)), rad('kvinna', 0)];
        expect(organisationensKvotKI(rader, 26)).toBeNull();
        const a = organisationensKvotKI(rader, 10, { rng: mulberry32(5) });
        expect(a).toEqual(organisationensKvotKI(rader, 10, { rng: mulberry32(5) }));
        expect(organisationensKvotKI(rader, 10)).toEqual(organisationensKvotKI(rader, 10, { rng: slumpFor(kv, ma) }));
        expect(a.B).toBe(2000);
        expect(a.ratio.point).toBe(median(kv) / median(ma));
        expect(a.ratio.lo).toBeLessThanOrEqual(a.ratio.point);
        expect(a.ratio.hi).toBeGreaterThanOrEqual(a.ratio.point);
        expect(a.gapPct).toEqual({ point: (median(kv) - median(ma)) * 100 / median(ma), lo: (a.ratio.lo - 1) * 100, hi: (a.ratio.hi - 1) * 100 });
    });
});

describe('[B4.2] konskvotPerGrupp', () => {
    const kv = loner(12, 1, 29000), ma = loner(15, 2, 31000);
    it('grupper där ett kön är färre än k är dolda och tomma hoppas över; löner som inte är över 0 räknas inte (konsMedianerUrLoner)', () => {
        const { visade, dolda } = konskvotPerGrupp([['A', kv, ma], ['tom', [], []], ['liten', kv.slice(0, 9), ma], ['noll', kv, [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]], ['bara noll', [0], [0, -1]]], { k: 10 });
        expect(dolda).toEqual(['liten', 'noll']);
        expect(visade).toEqual([{ nyckel: 'A', nKv: 12, nMa: 15, medKv: median(kv), medMa: median(ma), gap: median(kv) * 100 / median(ma) }]);
    });
    it('med ki står medianKvotKI med standardvärdena i ci', () => {
        expect(konskvotPerGrupp([['A', kv, ma]], { k: 10, ki: true }).visade[0].ci).toEqual(medianKvotKI(kv, ma));
    });
});

describe('[B4.4] regressionslinjensBand', () => {
    it('n = 3, räknat för hand: (0, 0), (1, 1), (2, 3)', () => {
        // Linjen y = 1,5x − 1/6; RSS = 1/6, σ² = RSS/(n − 2) = 1/6, x̄ = 1, Σ(x − x̄)² = 2.
        const band = regressionslinjensBand([[0, 0], [1, 1], [2, 3]], 0, 2, 3);
        expect(band).toHaveLength(3);
        const [vid0, vid1, vid2] = band;
        expect(vid1.x).toBe(1);
        expect(vid1.y).toBeCloseTo(4 / 3, 12);
        // Halva bredden är t(0,975; 1) · se, t = 12,706 (tabellvärde).
        // vid x = 1: se = √(1/6 · 1/3)
        expect((vid1.hi - vid1.y) / Math.sqrt(1 / 18)).toBeCloseTo(12.706, 3);
        expect(vid1.y - vid1.lo).toBeCloseTo(vid1.hi - vid1.y, 12);
        // vid x = 0: se = √(1/6 · (1/3 + 1/2)) = √5/6
        expect((vid0.y - vid0.lo) / (Math.sqrt(5) / 6)).toBeCloseTo(12.706, 3);
        expect((vid2.hi - vid2.y) / (Math.sqrt(5) / 6)).toBeCloseTo(12.706, 3);
    });
    it('n = 10: halva bredden vid x̄ är t(0,975; 8) · s · √(1/n), t = 2,306', () => {
        const fel = [0.4, -0.3, 0.1, -0.2, 0.5, -0.5, 0.2, -0.1, 0.3, -0.4];
        const data = fel.map((e, x) => [x, 2 * x + 1 + e]);
        // s med minsta kvadrat-formlerna, oberoende av koden: b = Σ(x − x̄)(y − ȳ)/Σ(x − x̄)², a = ȳ − b·x̄.
        const n = 10, mx = 4.5, my = data.reduce((sum, p) => sum + p[1], 0) / n;
        const b = data.reduce((sum, [x, y]) => sum + (x - mx) * (y - my), 0) / data.reduce((sum, [x]) => sum + (x - mx) ** 2, 0);
        const a = my - b * mx;
        const s = Math.sqrt(data.reduce((sum, [x, y]) => sum + (y - a - b * x) ** 2, 0) / (n - 2));
        const [, mitt] = regressionslinjensBand(data, 0, 9, 3);
        expect(mitt.x).toBe(4.5);
        expect(mitt.hi - mitt.y).toBeCloseTo(2.306 * s * Math.sqrt(1 / n), 3);
        expect(mitt.y - mitt.lo).toBeCloseTo(2.306 * s * Math.sqrt(1 / n), 3);
    });
    it('färre än tre punkter eller utan spridning i x ger inget band', () => {
        expect(regressionslinjensBand([[0, 0], [1, 1]], 0, 1)).toBeNull();
        expect(regressionslinjensBand([[1, 1], [1, 2], [1, 3]], 0, 2)).toBeNull();
    });
    it('ett större n: 30 punkter som standard, smalast vid medelvärdet och smalare med fyra gånger så många punkter', () => {
        const fel = [0.4, -0.3, 0.1, -0.2, 0.5, -0.5, 0.2, -0.1, 0.3, -0.4];
        const serie = upprepa => Array.from({ length: 10 * upprepa }, (_, i) => [i % 10, 2 * (i % 10) + 1 + fel[i % 10]]);
        const tio = regressionslinjensBand(serie(1), 0, 9);
        expect(tio).toHaveLength(30);
        const bredd = p => p.hi - p.lo;
        const mitt = tio.reduce((m, p) => (Math.abs(p.x - 4.5) < Math.abs(m.x - 4.5) ? p : m));
        expect(bredd(mitt)).toBeLessThan(bredd(tio[0]));
        expect(bredd(mitt)).toBeLessThan(bredd(tio[29]));
        const fyrtio = regressionslinjensBand(serie(4), 0, 9);
        // Samma residualmönster fyra gånger: σ är nästan densamma och bredden går ungefär som 1/√n, sedan
        // kvantilernas kvot bortdragen: t(0,975; 38) = 2,024 och t(0,975; 8) = 2,306.
        const kvot = (bredd(fyrtio[0]) / bredd(tio[0])) / (2.024 / 2.306);
        expect(kvot).toBeGreaterThan(0.45);
        expect(kvot).toBeLessThan(0.5);
    });
});

describe('[B4.5] styrkan', () => {
    it('mdeProcent räknad för hand: σ = 0,1, 20 kvinnor och 30 män', () => {
        // 2,802 · 0,1 · √(1/20 + 1/30) = 0,2802 · 0,288675 = 0,0808868; (e^0,0808868 − 1) · 100 = 8,4248 %
        expect(mdeProcent(0.1, 20, 30)).toBeCloseTo(8.4248, 4);
    });
    it('gruppMde: nivåerna, för liten grupp och inget svar utan σ', () => {
        expect(gruppMde(20, 30, 0.1)).toEqual({ mdePct: mdeProcent(0.1, 20, 30), level: 'poor', tooSmall: false });
        // 2,802 · 0,05 · √(2/40) = 0,031327 → 3,18 %: godtagbar
        expect(gruppMde(40, 40, 0.05).level).toBe('fair');
        expect(gruppMde(40, 40, 0.05).mdePct).toBeCloseTo(3.1823, 4);
        expect(gruppMde(400, 400, 0.05).level).toBe('good');
        expect(gruppMde(4, 9, 0.05).tooSmall).toBe(true);
        expect(gruppMde(1, 9, 0.05)).toBeNull();
        expect(gruppMde(10, 10, 0)).toBeNull();
        expect(gruppMde(10, 10, undefined)).toBeNull();
    });
    // Två yrkesgrupper med 12 kvinnor och 12 män var: lönerna i varje kön är medianen · e^(±0,05 · j).
    const avvikelser = [-3, -2, -1, -1, 0, 0, 0, 0, 1, 1, 2, 3];
    const grupp = (yrke, medKv, medMa) => [
        ...avvikelser.map(j => rad('kvinna', medKv * Math.exp(0.05 * j), { yrke })),
        ...avvikelser.map(j => rad('man', medMa * Math.exp(0.05 * j), { yrke }))
    ];
    const rader = [...grupp('A', 30000, 31000), ...grupp('B', 40000, 42000)];
    const arKv = r => r.kon === 'kvinna', arMa = r => r.kon === 'man';

    it('sigmaInomGrupp: den poolade spridningen kring varje köns median, räknad för hand', () => {
        // Σ(0,05 · j)² per kön = 0,0025 · 30 = 0,075; fyra kön-grupper: 0,3. Frihetsgrader 48 − 4 = 44.
        const s = sigmaInomGrupp(rader, arKv, arMa, 10);
        expect(s.grupper).toBe(2);
        expect(s.residualer).toBe(48);
        expect(s.sigma).toBeCloseTo(Math.sqrt(0.3 / 44), 12);
        expect(sigmaInomGrupp(rader, arKv, arMa, 13)).toBeNull();
        // En grupp: 24 residualer räcker; färre än MDE_SIGMA_MIN_RESIDUALER gör det inte.
        expect(sigmaInomGrupp(grupp('A', 30000, 31000), arKv, arMa, 10).residualer).toBe(24);
        expect(sigmaInomGrupp(grupp('A', 30000, 31000).filter((_, i) => i % 12 < 9), arKv, arMa, 9)).toBeNull();
    });
    it('styrkeanalys: σ inom grupp när grupperna når golvet, annars hela urvalets', () => {
        const inom = styrkeanalys(rader, 10);
        expect(inom.sigmaKalla).toBe('inomGrupp');
        expect(inom.sigma).toBeCloseTo(Math.sqrt(0.3 / 44), 12);
        expect(inom.mdePct).toBe(mdeProcent(inom.sigma, 24, 24));
        expect(inom).toMatchObject({ n: 48, nKv: 24, nMa: 24, sigmaGrupper: 2, balanced: true });
        const hela = styrkeanalys(rader, 13);
        expect(hela.sigmaKalla).toBe('helaUrvalet');
        const logs = rader.map(r => Math.log(r.lon)), m = logs.reduce((s, v) => s + v, 0) / logs.length;
        expect(hela.sigma).toBeCloseTo(Math.sqrt(logs.reduce((s, v) => s + (v - m) ** 2, 0) / (logs.length - 1)), 12);
        expect(hela.sigma).toBe(hela.sigmaHela);
        expect(hela.sigmaGrupper).toBe(0);
    });
    it('styrkeanalys: balansgränsen och för litet underlag', () => {
        const obalans = [...rader.filter(arKv), ...rader.filter(arMa).slice(0, 15)];   // 15 av 39 = 0,385
        expect(styrkeanalys(obalans, 10).balanced).toBe(false);
        expect(styrkeanalys([...rader.filter(arKv), ...rader.filter(arMa).slice(0, 16)], 10).balanced).toBe(true);   // 16 av 40
        expect(styrkeanalys(rader.slice(0, 9), 3)).toBeNull();
        expect(styrkeanalys([...rader.filter(arKv), rader.find(arMa)], 3)).toBeNull();
    });
});

describe('[B4.6] extremvarden', () => {
    const basA = loner(15, 3, 30000).map((l, i) => rad(i % 2 ? 'man' : 'kvinna', l, { bas: 'A', radnr: i + 2 }));
    basA[4] = { ...basA[4], lon: 150000 };   // den kända avvikaren, en kvinna
    const basB = loner(6, 4, 30000).map((l, i) => rad('man', l, { bas: 'B', radnr: 100 + i }));
    basB[0] = { ...basB[0], lon: 300000 };   // under golvet: bedöms inte

    it('flaggar den kända avvikaren och inget i BAS-intervallet under golvet', () => {
        const ut = extremvarden([...basA, ...basB], 10);
        expect(ut).toHaveLength(1);
        const [o] = ut;
        expect(o).toMatchObject({ radnr: 6, bas: 'A', kon: 'Kvinna', lon: 150000, alder: 40 });
        const groupMedian = median(basA.map(r => r.lon));
        expect(o.groupMedian).toBe(groupMedian);
        expect(o.diffPct).toBe(((150000 - groupMedian) / groupMedian) * 100);
        expect(o.z).toBeGreaterThanOrEqual(EXTREMVARDE_Z);
        // Med golvet 5 bedöms också intervall B, och dess avvikare kommer med (en man).
        const lagt = extremvarden([...basA, ...basB], 5, 2);
        expect(lagt.find(r => r.bas === 'B')).toMatchObject({ radnr: 100, kon: 'Man', lon: 300000 });
    });
    it('sorterar på |z| störst först, och en tom lista ger en tom lista', () => {
        const ut = extremvarden([...basA, ...basB], 5, 1);
        for (let i = 1; i < ut.length; i++) expect(Math.abs(ut[i - 1].z)).toBeGreaterThanOrEqual(Math.abs(ut[i].z));
        expect(extremvarden([], 10)).toEqual([]);
        // Utan spridning i ett intervall flaggas inget där.
        expect(extremvarden(Array.from({ length: 12 }, () => rad('man', 30000, { bas: 'C' })), 10)).toEqual([]);
    });
});

describe('[B4.7] trattUnderlag', () => {
    const grupp = (aid, bas, nKv, nMa, faktor) => [
        ...loner(nKv, aid.length, 30000).map(l => rad('kvinna', Math.round(l * faktor), { aid, bas, yrke: `${aid} Yrke` })),
        ...loner(nMa, aid.length + 1, 30000).map(l => rad('man', l, { aid, bas, yrke: `${aid} Yrke` }))
    ];
    const rader = [...grupp('111111', 'A', 12, 11, 0.97), ...grupp('222222', 'B', 10, 14, 1.0), ...grupp('333333', 'C', 4, 20, 0.9)];

    it('bara grupper där båda könen når tröskeln, med kvot och slumpens gränser per grupp', () => {
        const u = trattUnderlag(rader, 10);
        expect(u.punkter.map(p => p.nyckel)).toEqual(['111111|A', '222222|B']);
        for (const p of u.punkter) {
            const kv = rader.filter(r => `${r.aid}|${r.bas}` === p.nyckel && r.kon === 'kvinna').map(r => r.lon);
            const ma = rader.filter(r => `${r.aid}|${r.bas}` === p.nyckel && r.kon === 'man').map(r => r.lon);
            const g = slumpensGranser(kv, ma);
            expect(p).toMatchObject({ nKv: kv.length, nMa: ma.length, n: kv.length + ma.length, kvot: median(kv) / median(ma) * 100, gransLag: g.lag, gransHog: g.hog });
            expect(p.utanfor).toBe(p.kvot < g.lag || p.kvot > g.hog);
        }
        expect(trattUnderlag(rader, 3).punkter).toHaveLength(3);
        expect(trattUnderlag(rader, 25)).toBeNull();
    });
    it('fältets halva bredd följer formeln med σ = 1,4826 × MAD', () => {
        const u = trattUnderlag(rader, 10);
        expect(u.sigma).toBeGreaterThan(0);
        expect(u.halv(10, 10)).toBeCloseTo(100 * 1.96 * 1.2533 * u.sigma * Math.sqrt(0.2) * 1.06, 10);
        expect(u.halv(40, 60)).toBeCloseTo(100 * 1.96 * 1.2533 * u.sigma * Math.sqrt(1 / 40 + 1 / 60) * 1.015, 10);
    });
});

describe('[B4.8] kvantilBootstrap', () => {
    // 120 påhittade personer i tre BAS-intervall; kvinnornas lön är 5 % lägre.
    const rader = Array.from({ length: 120 }, (_, i) => {
        const kv = i % 2 === 0, bas = ['A', 'B', 'C'][i % 3], alder = 25 + (i * 7) % 40;
        const lon = Math.round((28000 + 2000 * (i % 3) + 120 * alder + ((i * 7919) % 1000) * 3) * (kv ? 0.95 : 1));
        return { kon: kv ? 'kvinna' : 'man', lon, bas, alder };
    });
    const modell = FORKLARINGSMODELL_STANDARD;
    const qr = kvantilregressionAllaTau(rader, { modell });
    const raw = kvantilDesign(rader, modell).rader;
    const arKv = d => d.kon.includes('kvinna');
    const kor = val => kvantilBootstrap(raw, modell, qr.results.map(r => ({ ...r, ki: null })), arKv, val);

    it('samma seed ger samma intervall, och intervallen rymmer skattningarna', () => {
        const a = kor({ B: 40, rng: mulberry32(11) });
        expect(a).toEqual(kor({ B: 40, rng: mulberry32(11) }));
        expect(a.kiB).toBe(40);
        for (const r of a.results) {
            expect(r.ki.lag).toBeLessThanOrEqual(r.ki.hog);
            expect(r.ki.lag).toBeLessThan(r.konPct + 2);
            expect(r.ki.hog).toBeGreaterThan(r.konPct - 2);
            expect(r.ki.lag).toBeGreaterThan(-15);
            expect(r.ki.hog).toBeLessThan(5);
        }
        expect(a.diffKi.lag).toBeLessThanOrEqual(a.diffKi.hog);
    });
    it('utan generator seedas den ur lönerna per kön, och standardantalet är 200', () => {
        const b = kor({ B: 20 });
        const c = kor({ B: 20, rng: slumpFor(raw.filter(arKv).map(d => d.lon), raw.filter(d => !arKv(d)).map(d => d.lon)) });
        expect(b).toEqual(c);
        expect(KVANTIL_KI_B).toBe(200);
    });
    it('dragningar som inte konvergerat räknas bort: konvergerar ingen ges inget intervall', async () => {
        // Kvantilregressionen ersätts med en som ger samma skattning men aldrig säger att den konvergerat.
        vi.resetModules();
        vi.doMock('../src/lib/regression.js', async orig => {
            const m = /** @type {any} */ (await orig());
            return { ...m, kvantilregression: (...a) => { const f = m.kvantilregression(...a); return f && { ...f, konvergerat: false, andring: f.andring.map(() => 1) }; } };
        });
        try {
            const { kvantilBootstrap: utanKonvergens } = await import('../src/lib/osakerhet.js');
            const ut = utanKonvergens(raw, modell, qr.results.map(r => ({ ...r, ki: null })), arKv, { B: 20, rng: mulberry32(11) });
            expect(ut.results.map(r => r.ki)).toEqual(qr.results.map(() => null));
            expect(ut.diffKi).toBeNull();
        } finally { vi.doUnmock('../src/lib/regression.js'); vi.resetModules(); }
    });
});

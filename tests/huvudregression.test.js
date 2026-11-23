// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
/**
 * Huvudregressionen (verktygets huvudtal) direkt mot src/lib/regression.js, utan jsdom och utan appen: så kan
 * huvudtalet räknas i Node av den som vill granska det. Att appens adapter (korOLSRegression) skickar rätt argument
 * och ger exakt samma returvärde vaktas av tests/huvudregression-adapter.test.js; att talen på demodatan inte ändras
 * vaktas av ögonblicksbilden i tests/berakningar-las.test.js.
 *
 * (a) Ett litet påhittat underlag som byggs deterministiskt här: koefficienten mot en egen designmatris, modellerna,
 *     golven och felfallen. (b) Fixturen tests/fixtures/stat-referens.json (100 rader) med modellen endast kön mot
 *     statsmodels-värdet i stat-referens-varden.json (filhuvudet i tests/stat-referens.test.js beskriver fixturen).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { anpassaOLS, tKvantil } from '../src/lib/stat.js';
import { huvudregression, HUVUDREGRESSION_MIN_N, HUVUDREGRESSION_MIN_PER_KON, FORKLARINGSMODELL_STANDARD,
    STEG_YRKE, blinderOaxaca, kvantilregressionAllaTau } from '../src/lib/regression.js';

const las = f => JSON.parse(readFileSync(join(import.meta.dirname, 'fixtures', f), 'utf8'));
const pct = b => (Math.exp(b) - 1) * 100;

/** Påhittat underlag: n personer, BAS A–D, två yrkesgrupper per BAS, lön ur BAS, ålder och kön plus seedat brus. */
function underlag(n = 80, { kvinnor = null } = {}) {
    let s = 20261120;
    const slump = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
    const rader = [];
    for (let i = 0; i < n; i++) {
        // Varannan fyrtal kvinnor, så att varje BAS-intervall och varje yrkesgrupp har båda könen.
        const kvinna = kvinnor === null ? i % 8 < 4 : i < kvinnor;
        const bas = 'ABCD'[i % 4];
        const alder = 25 + Math.floor(slump() * 40);
        const lon = Math.round(28000 + 4000 * 'ABCD'.indexOf(bas) + 120 * (alder - 25) - (kvinna ? 900 : 0) + 2500 * (slump() - 0.5));
        rader.push({ kon: kvinna ? 'kvinna' : 'man', bas, alder, lon, aid: `${bas}${(i >> 3) % 2}`, yrke: `Yrke ${(i >> 3) % 2}` });
    }
    return rader;
}

const STD = { ...FORKLARINGSMODELL_STANDARD };
const ENDAST_KON = { bas: false, alder: false, yrkesgrupp: false, skal: '' };
const opts = (extra = {}) => ({ modell: STD, kInstalld: 10, golv: 10, ...extra });

describe('[B3.1] huvudregression: påhittat underlag', () => {
    const rader = underlag();

    it('könskoefficienten är OLS på [1, kön, ålder − medel, en indikator per BAS utom A] med HC3 och t-kvantil', () => {
        const r = huvudregression(rader, opts());
        expect(r.error).toBeUndefined();
        const ageMean = rader.reduce((s, d) => s + d.alder, 0) / rader.length;
        const X = rader.map(d => [1, d.kon === 'kvinna' ? 1 : 0, d.alder - ageMean, ...['B', 'C', 'D'].map(b => (d.bas === b ? 1 : 0))]);
        const fit = anpassaOLS(X, rader.map(d => Math.log(d.lon)));
        const se = Math.sqrt(fit.vcovHC3[1][1]);
        const tq = tKvantil(0.975, fit.n - fit.k);
        expect(r.konPct).toBe(pct(fit.beta[1]));
        expect(r.konPctLow).toBe(pct(fit.beta[1] - tq * se));
        expect(r.konPctHigh).toBe(pct(fit.beta[1] + tq * se));
        expect(r.konKvot).toBe(100 + r.konPct);
        expect([r.n, r.k, r.nKvAnalysed, r.nMaAnalysed, r.nBas, r.basRef]).toEqual([80, 6, 40, 40, 4, 'A']);
        expect(r.modelName).toBe('full');
        expect(r.basEffekter.map(b => b.bas)).toEqual(['B', 'C', 'D']);
        // Det sista steget i uppdelningen är samma modell med en annan kolumnordning.
        const sista = r.sequential.filter(s => s.status === 'ok' && s.name !== STEG_YRKE).at(-1);
        expect(sista.name).toBe('+ Ålder');
        expect(sista.gapPct).toBeCloseTo(r.konPct, 9);
    });

    it('är ren: samma svar två gånger, och raderna ändras inte', () => {
        const fore = JSON.stringify(rader);
        expect(huvudregression(rader, opts())).toEqual(huvudregression(rader, opts()));
        expect(JSON.stringify(rader)).toBe(fore);
    });

    it('utan modell används standardmodellen, och medAlder räknas ur raderna', () => {
        expect(huvudregression(rader, { kInstalld: 10, golv: 10 })).toEqual(huvudregression(rader, opts({ medAlder: true })));
    });

    it('AID-etikett inom BAS vald: huvudtalet är steget + Yrkesgrupp', () => {
        const r = huvudregression(rader, opts({ modell: { ...STD, yrkesgrupp: true } }));
        expect(r.modelName).toBe('full');
        expect(r.modell.yrkesgrupp).toBe(true);
        expect(r.basEffekter).toBeNull();
        expect(r.yrkesSteg.status).toBe('ok');
        expect(r.konPct).toBeCloseTo(r.yrkesSteg.gapPct, 9);
    });

    it('utan ålder i lönefilen: alla rader räknas, ingen ålderseffekt', () => {
        const utan = rader.map(d => ({ ...d, alder: 0 }));
        const r = huvudregression(utan, opts({ modell: { ...STD, alder: false } }));
        expect(r.n).toBe(80);
        expect(r.ageEffect).toBeNull();
        expect(r.modell.alder).toBe(false);
        // Ålder vald men saknas i filen: modellen normaliseras utan ålder, som i appen.
        expect(huvudregression(utan, opts()).modell.alder).toBe(false);
    });

    it('reservsteget: BAS sammanfaller med kön, så modellen skattas utan BAS', () => {
        const kollinear = rader.map(d => ({ ...d, bas: d.kon === 'kvinna' ? 'A' : 'B' }));
        const r = huvudregression(kollinear, opts());
        expect(r.modelName).toBe('minimal');
        expect(r.fellBackFromFull).toBe(true);
        expect(r.triedSteps.map(s => s.status)).toEqual(['singular', 'ok']);
        expect(r.modellVald.bas).toBe(true);
        expect(r.modell.bas).toBe(false);
        expect(r.diagnostics.length).toBeGreaterThan(0);
    });

    it('inget steg kan skattas: felet all_failed med försöken och diagnosen', () => {
        const fel = rader.map(d => ({ ...d, bas: d.kon === 'kvinna' ? 'A' : 'B', alder: 40 }));
        const r = huvudregression(fel, opts());
        expect(r.errorCode).toBe('all_failed');
        expect(r.error).toBe('Modellen kunde inte estimeras.');
        expect(r.triedSteps.map(s => s.status)).toEqual(['singular', 'singular']);
        expect(Array.isArray(r.diagnostics)).toBe(true);
    });
});

describe('huvudregression: golven och spärren', () => {
    it('golven är 30 rader och 5 per kön', () => {
        expect(HUVUDREGRESSION_MIN_N).toBe(30);
        expect(HUVUDREGRESSION_MIN_PER_KON).toBe(5);
    });

    it('färre än 30 rader: low_n', () => {
        expect(huvudregression(underlag(29), opts())).toEqual({
            error: 'För få observationer (n < 30) för meningsfull regressionsanalys.', errorCode: 'low_n' });
        expect(huvudregression(underlag(30), opts()).error).toBeUndefined();
    });

    it('rader som inte kan räknas (lön 0, okänt kön, ålder 0) räknas inte mot golvet', () => {
        const rader = underlag(30);
        rader[0] = { ...rader[0], lon: 0 };
        expect(huvudregression(rader, opts()).errorCode).toBe('low_n');
    });

    it('färre än 5 av ett kön: imbalance', () => {
        expect(huvudregression(underlag(40, { kvinnor: 4 }), opts())).toEqual({
            error: 'Otillräcklig könsbalans i urvalet: 4 kvinnor, 36 män. Minst 5 av varje kön krävs.', errorCode: 'imbalance' });
        expect(huvudregression(underlag(40, { kvinnor: 5 }), opts()).error).toBeUndefined();
    });

    it('Endast kön när båda könen når tröskeln: huvudtalet är det ojusterade steget', () => {
        const rader = underlag();
        const r = huvudregression(rader, opts({ modell: ENDAST_KON }));
        expect(r.modellVarning).toBeNull();
        expect(r.modell).toEqual(ENDAST_KON);
        expect(r.bortvalt.map(b => b.variabel)).toEqual(['bas', 'alder']);
        expect(r.bortvalt[0].etikett).toBe('BAS-intervall');
        expect(r.konPct).toBeCloseTo(r.sequential[0].gapPct, 9);
    });

    it('Endast kön när ett kön är under den inställda tröskeln: spärren ger standardmodellen och varningen', () => {
        const rader = underlag();
        const r = huvudregression(rader, opts({ modell: ENDAST_KON, kInstalld: 41, golv: 41 }));
        expect(r.modellVald).toEqual({ ...ENDAST_KON, bas: true, alder: true });
        expect(r.modellVarning).toBe('Endast kön kan inte väljas: ett kön har färre än 41 personer i modellen (minsta '
            + 'gruppstorlek), så den ojusterade skillnaden får inte vara huvudtalet. Modellen är kön + BAS-intervall + ålder.');
        expect(r.konPct).toBe(huvudregression(rader, opts({ kInstalld: 41, golv: 41 })).konPct);
        // Utan ålder i lönefilen säger varningen det, och singularformen följer talet.
        const utan = rader.map(d => ({ ...d, alder: 0 }));
        expect(huvudregression(utan, opts({ modell: ENDAST_KON, kInstalld: 1, golv: 10 })).modellVarning).toBeNull();
        const v = huvudregression(utan.slice(0, 40).concat(utan.slice(40).filter(d => d.kon === 'man')), opts({ modell: ENDAST_KON, kInstalld: 21, golv: 21 }));
        expect(v.modellVarning).toMatch(/färre än 21 personer i modellen .* Modellen är kön \+ BAS-intervall\.$/);
    });
});

describe('huvudregression: fixturen stat-referens.json', () => {
    const fx = las('stat-referens.json');
    const ref = las('stat-referens-varden.json');

    it('endast kön: könskoefficienten mot statsmodels', () => {
        const r = huvudregression(fx.rows.map(d => ({ ...d })), opts({ modell: ENDAST_KON }));
        expect(r.modellVarning).toBeNull();
        expect([r.n, r.k, r.nKvAnalysed, r.nMaAnalysed]).toEqual([100, 2, 57, 43]);
        expect(Math.abs(r.konPct - pct(ref.sekventiell.endastKon[1]))).toBeLessThan(1e-10);
        expect(Math.abs(r.sequential[0].gapPct - pct(ref.sekventiell.endastKon[1]))).toBeLessThan(1e-10);
    });

    it('standardmodellen: BAS F (bara hos männen) får sin egen indikator, och antalen är fixturens', () => {
        const r = huvudregression(fx.rows.map(d => ({ ...d })), opts());
        expect(r.modelName).toBe('full');
        expect(r.basList).toEqual(['A', 'B', 'C', 'D', 'E', 'F']);
        expect(r.k).toBe(8);
        expect(r.ageMean).toBeCloseTo(fx.ageMean, 12);
    });
});

describe('huvudregression: steget + Yrkesgrupp, fasta effekter för AID×BAS med inomtransformation (ADR-46)', () => {
    // Två yrken i samma BAS med olika lönenivå: kvinnorna finns mest i det lägre betalda yrket. Inom varje yrke är lönen
    // identisk för kvinnor och män (bara ålder skiljer), så gapet efter yrkesgrupp är noll — medan gapet efter BAS och
    // ålder är klart negativt.
    const rader = (() => {
        const ut = [];
        const lägg = (aid, bas, niva, kon, n) => { for (let i = 0; i < n; i++) { const alder = 28 + ((i * 5) % 30); ut.push({ aid, yrke: 'Yrke ' + aid, bas, kon, alder, lon: Math.round(niva * Math.exp(0.004 * (alder - 40))) }); } };
        lägg('101', 'C', 28000, 'kvinna', 24); lägg('101', 'C', 28000, 'man', 6);
        lägg('102', 'C', 34000, 'kvinna', 6);  lägg('102', 'C', 34000, 'man', 24);
        lägg('201', 'E', 38000, 'kvinna', 15); lägg('201', 'E', 38000, 'man', 15);
        lägg('202', 'E', 44000, 'kvinna', 12); lägg('202', 'E', 44000, 'man', 12);
        lägg('301', 'F', 50000, 'man', 8);   // enkönad grupp: bidrar inte
        return ut;
    })();
    const r = huvudregression(rader, opts());
    it('gapet efter yrkesgrupp är noll medan huvudtalet och steget + Ålder är kvar', () => {
        expect(r.error).toBeUndefined();
        const alder = r.sequential.find(s => s.name === '+ Ålder');
        expect(r.sequential.at(-1).name).toBe(STEG_YRKE);
        expect(r.yrkesSteg.status).toBe('ok');
        expect(Math.abs(r.yrkesSteg.gapPct)).toBeLessThan(0.05);
        expect(alder.gapPct).toBeLessThan(-3);
        expect(r.konPct).toBeCloseTo(alder.gapPct, 6);   // huvudtalet är oförändrat: steget + Ålder
        expect(r.yrkesSteg.R2).toBeGreaterThan(alder.R2);
    });
    it('inomtransformationen ger samma könskoefficient som en indikator per grupp', () => {
        const am = rader.reduce((s, x) => s + x.alder, 0) / rader.length;
        const g = [...new Set(rader.map(x => x.aid + '|' + x.bas))].sort();
        const X = rader.map(x => [x.kon === 'kvinna' ? 1 : 0, x.alder - am, ...g.map(k => (x.aid + '|' + x.bas === k ? 1 : 0))]);
        expect(r.yrkesSteg.gapPct).toBeCloseTo(pct(anpassaOLS(X, rader.map(x => Math.log(x.lon))).beta[0]), 8);
    });
    it('redovisar grupper och personer: enkönade grupper räknas men bidrar inte', () => {
        expect(r.yrkesSteg).toMatchObject({ nGrupper: 5, nGrupperBada: 4, nEnkonade: 1, nPersoner: 114 });
    });
});

describe('BAS-steg räknas i bokstäver i huvudregressionen, Blinder-Oaxaca och kvantilregressionen (regressionsmodellen.md §3)', () => {
    // Lönen beror bara på bokstaven: +5 % per BAS-intervall. C saknas, så B → D är två intervall. Kvinnorna finns mest
    // i B, männen mest i D. Med rätt numrering förklarar BAS hela skillnaden.
    const PLATS = { A: 1, B: 2, D: 4, E: 5 };
    // brus: ±1 % i ett mönster med medelvärde noll per grupp (alla gruppstorlekar är delbara med 3)
    const rader = (brus = 0) => {
        const ut = [];
        const lägg = (bas, kon, n) => { for (let i = 0; i < n; i++) ut.push({ bas, kon, alder: 30 + ((i * 7) % 25), lon: Math.round(30000 * Math.exp(0.05 * PLATS[bas] + brus * ((i % 3) - 1))), aid: '100', yrke: '100 Yrke', yrkeLabel: 'Yrke' }); };
        lägg('A', 'kvinna', 12); lägg('A', 'man', 12);
        lägg('B', 'kvinna', 30); lägg('B', 'man', 3);
        lägg('D', 'kvinna', 3);  lägg('D', 'man', 30);
        lägg('E', 'kvinna', 12); lägg('E', 'man', 12);
        return ut;
    };
    it('huvudregressionen: inget oförklarat gap och varje BAS-indikator ger 5 % per bokstavssteg mot referensen A', () => {
        const r = huvudregression(rader(), opts());
        expect(r.error).toBeUndefined();
        expect(Math.abs(r.konPct)).toBeLessThan(0.05);
        expect(r.basRef).toBe('A');
        expect(r.basEffekter.map(e => e.bas)).toEqual(['B', 'D', 'E']);
        for (const e of r.basEffekter) expect(e.pct).toBeCloseTo((Math.exp(0.05 * (PLATS[e.bas] - 1)) - 1) * 100, 1);
    });
    it('Blinder-Oaxaca: den oförklarade delen är noll', () => {
        expect(Math.abs(blinderOaxaca(rader(), { golv: 10, modell: STD }).coefficientPct)).toBeLessThan(0.05);
    });
    it('kvantilregressionen: inget gap i någon kvantil', () => {
        const r = kvantilregressionAllaTau(rader(0.01), { modell: STD });
        expect(r.results).toHaveLength(3);
        for (const q of r.results) { expect(q.error).toBeUndefined(); expect(Math.abs(q.konPct)).toBeLessThan(0.5); }
    });
});

describe('huvudregression: den valda förklaringsmodellen i returvärdet (ADR-56)', () => {
    const rader = underlag();
    const kor = modell => huvudregression(rader, opts({ modell }));
    const std = kor(STD);
    it('standard: modelDesc, frasen "ålder och BAS-intervall", inget bortvalt, tillför-tabellen med tre rader', () => {
        expect(std.error).toBeUndefined();
        expect(std.modelDesc).toBe('kön + ålder + BAS-intervall (indikatorer)');
        expect(std.fras).toBe('ålder och BAS-intervall');
        expect(std.bortvalt).toEqual([]);
        expect(std.modell).toEqual({ bas: true, alder: true, yrkesgrupp: false, skal: '' });
        expect(std.tillfor.rader.map(x => x.variabel)).toEqual(['bas', 'alder', 'yrkesgrupp']);
        expect(std.modellVarning).toBeNull();
    });
    it('utan ålder: en kolumn färre, ingen ålderseffekt, ålder bortvald med skälet, inget steg + Ålder', () => {
        const r = kor({ bas: true, alder: false, yrkesgrupp: false, skal: 'ingen lön efter ålder' });
        expect(r.k).toBe(std.k - 1);
        expect(r.ageEffect).toBeNull();
        expect(r.ageP).toBeNull();
        expect(r.bortvalt).toHaveLength(1);
        expect(r.bortvalt[0]).toMatchObject({ variabel: 'alder', etikett: 'Ålder', skal: 'ingen lön efter ålder' });
        expect(typeof r.bortvalt[0].deltaR2pp).toBe('number');
        expect(r.sequential.map(x => x.name)).not.toContain('+ Ålder');
        expect(r.fras).toBe('BAS-intervall');
        expect(r.konPct).toBeCloseTo(r.sequential.find(x => x.name === '+ BAS-intervall').gapPct, 8);
    });
    it('utan BAS: inga BAS-effekter, frasen "ålder"', () => {
        const r = kor({ bas: false, alder: true, yrkesgrupp: false, skal: '' });
        expect(r.basEffekter).toBeNull();
        expect(r.basRef).toBeNull();
        expect(r.fras).toBe('ålder');
        expect(r.modelDesc).toBe('kön + ålder');
        expect(r.bortvalt.map(b => b.variabel)).toEqual(['bas']);
    });
    it('yrkesgrupp vald: frasen, modelDesc och steget + Yrkesgrupp sist; inget bortvalt', () => {
        const r = kor({ bas: true, alder: true, yrkesgrupp: true, skal: '' });
        expect(r.konPct).toBeCloseTo(std.yrkesSteg.gapPct, 6);
        expect(r.fras).toBe('ålder, BAS-intervall och AID-etikett');
        expect(r.modelDesc).toBe('kön + ålder + BAS-intervall (indikatorer) + AID-etikett inom BAS (fasta effekter)');
        expect(r.sequential.at(-1).name).toBe(STEG_YRKE);
        expect(r.bortvalt).toEqual([]);
    });
});

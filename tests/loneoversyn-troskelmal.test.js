// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
/**
 * Tröskelmålet i Löneöversyn (likalonslyftForMal i src/lib/loneoversyn.js): det minsta jämna lyftet i procent till
 * kvinnorna som får den oförklarade skillnaden att nå målet. Skattningen är stubbad med en känd funktion av lönerna
 * (kvinnornas medellön mot männens), så att rätt svar går att räkna för hand; sökningen ska hitta det inom den
 * tolerans som TROSKELMAL_VARV halveringar av 0–TROSKELMAL_MAX_LYFT_PCT ger. Att appen ritar samma HTML som förut
 * prövas av tests/troskelbeslut.test.js.
 */
import { describe, it, expect } from 'vitest';
import {
    likalonslyftForMal, troskelmalKonstanter,
    TROSKELMAL_STANDARD_PCT, TROSKELMAL_MAX_LYFT_PCT, TROSKELMAL_VARV, TROSKELMAL_SIGNIFIKANS_P
} from '../src/lib/loneoversyn.js';

const TOL = TROSKELMAL_MAX_LYFT_PCT / 2 ** TROSKELMAL_VARV;

// n kvinnor med lönen kv och n män med lönen ma.
const underlag = (kv, ma, n = 4) => [
    ...Array.from({ length: n }, () => ({ kon: 'kvinna', lon: kv, bas: 'A' })),
    ...Array.from({ length: n }, () => ({ kon: 'man', lon: ma, bas: 'A' }))
];
const medel = xs => xs.reduce((s, x) => s + x, 0) / xs.length;
// Skillnaden i procent, kvinnor mot män (negativ när kvinnor ligger lägre); p-värdet ges av en egen funktion av den.
const stubbe = (pFor = () => 0.001) => {
    const anrop = [];
    const skatta = rader => {
        anrop.push(rader);
        const kv = medel(rader.filter(r => r.kon === 'kvinna').map(r => r.lon));
        const ma = medel(rader.filter(r => r.kon === 'man').map(r => r.lon));
        const konPct = (kv / ma - 1) * 100;
        return { konPct, pValue: pFor(konPct) };
    };
    return { skatta, anrop };
};

describe('likalonslyftForMal: konstanterna', () => {
    it('standardmålet 5 %, intervallet upp till 40 %, 22 varv och signifikansgränsen 0,05', () => {
        expect([TROSKELMAL_STANDARD_PCT, TROSKELMAL_MAX_LYFT_PCT, TROSKELMAL_VARV, TROSKELMAL_SIGNIFIKANS_P]).toEqual([5, 40, 22, 0.05]);
        expect(troskelmalKonstanter()).toEqual({ STANDARD_PCT: 5, MAX_LYFT_PCT: 40, VARV: 22, SIGNIFIKANS_P: 0.05 });
    });
});

describe('[B7.9] likalonslyftForMal: målet högst X %', () => {
    it('kvinnor 100, män 110 och målet 5 %: lyftet 4,5 % (110 · 0,95 / 100 − 1), inom toleransen och aldrig under', () => {
        const { skatta } = stubbe();
        const svar = likalonslyftForMal(underlag(100, 110), { malPct: 5, skatta });
        expect(svar.status).toBe('hittat');
        expect(svar.lyftPct).toBeGreaterThanOrEqual(4.5 - 1e-12);
        expect(svar.lyftPct - 4.5).toBeLessThanOrEqual(TOL);
        expect(svar.resultat.konPct).toBeGreaterThanOrEqual(-5);
        expect(svar.utgangslage.konPct).toBeCloseTo(-100 / 11, 10);
    });
    it('kostnaden per månad är kvinnornas lönesumma gånger lyftet', () => {
        const svar = likalonslyftForMal(underlag(100, 110, 3), { malPct: 5, skatta: stubbe().skatta });
        expect(svar.kostnadPerManad).toBeCloseTo(3 * 100 * svar.lyftPct / 100, 10);
    });
    it('standardmålet används när målet inte anges', () => {
        const a = likalonslyftForMal(underlag(100, 110), { skatta: stubbe().skatta });
        const b = likalonslyftForMal(underlag(100, 110), { malPct: 5, skatta: stubbe().skatta });
        expect(a).toEqual(b);
    });
    it('skattningen får raderna med kvinnorna lyfta och männen orörda; indata ändras inte', () => {
        const rader = underlag(100, 110);
        const { skatta, anrop } = stubbe();
        const svar = likalonslyftForMal(rader, { malPct: 5, skatta });
        expect(anrop[0]).toBe(rader);
        expect(anrop).toHaveLength(1 + 1 + TROSKELMAL_VARV + 1);   // utgångsläget, 40 %, varven, svaret
        const sista = anrop[anrop.length - 1];
        expect(sista.filter(r => r.kon === 'man').every(r => r.lon === 110)).toBe(true);
        expect(sista.filter(r => r.kon === 'kvinna').every(r => r.lon === 100 * (1 + svar.lyftPct / 100))).toBe(true);
        expect(rader.every(r => r.lon === (r.kon === 'kvinna' ? 100 : 110))).toBe(true);
    });
    it('målet redan nått: status redan, inget lyft', () => {
        const svar = likalonslyftForMal(underlag(108, 110), { malPct: 5, skatta: stubbe().skatta });
        expect(svar.status).toBe('redan');
        expect(svar.lyftPct).toBeUndefined();
        expect(svar.utgangslage.konPct).toBeCloseTo((108 / 110 - 1) * 100, 10);
    });
    // Målet 0 % är ett mål: ingen oförklarad skillnad till kvinnornas nackdel (skillnaden minst 0), inte standardmålet.
    it('målet 0 %: lyftet till lika lön (110 / 100 − 1 = 10 %), inte lyftet för standardmålet', () => {
        const svar = likalonslyftForMal(underlag(100, 110), { malPct: 0, skatta: stubbe().skatta });
        expect(svar.status).toBe('hittat');
        expect(svar.lyftPct).toBeGreaterThanOrEqual(10 - 1e-9);
        expect(svar.lyftPct - 10).toBeLessThanOrEqual(TOL + 1e-9);
        expect(svar.resultat.konPct).toBeGreaterThanOrEqual(0);
        expect(svar.lyftPct).toBeGreaterThan(likalonslyftForMal(underlag(100, 110), { skatta: stubbe().skatta }).lyftPct);
    });
    it('målet 0 %: en skillnad på −0,1 % når inte målet, en skillnad på 0 eller mer gör det', () => {
        expect(likalonslyftForMal(underlag(99.9, 100), { malPct: 0, skatta: stubbe().skatta }).status).toBe('hittat');
        expect(likalonslyftForMal(underlag(100, 100), { malPct: 0, skatta: stubbe().skatta }).status).toBe('redan');
        expect(likalonslyftForMal(underlag(101, 100), { malPct: 0, skatta: stubbe().skatta }).status).toBe('redan');
    });
    it('mer än 40 % krävs: status utomRackhall', () => {
        const svar = likalonslyftForMal(underlag(50, 110), { malPct: 5, skatta: stubbe().skatta });
        expect(svar.status).toBe('utomRackhall');
        expect(svar.lyftPct).toBeUndefined();
    });
});

describe('likalonslyftForMal: målet inte signifikant', () => {
    // p stiger när skillnaden krymper: p = 0,05 vid skillnaden −4 %.
    const pFor = konPct => Math.max(0, 0.05 + (konPct + 4) * 0.01);
    it('lyftet där p passerar 0,05 (skillnaden −4 %: 110 · 0,96 / 100 − 1 = 5,6 %)', () => {
        const svar = likalonslyftForMal(underlag(100, 110), { signifikans: true, malPct: 1, skatta: stubbe(pFor).skatta });
        expect(svar.status).toBe('hittat');
        expect(svar.lyftPct).toBeGreaterThanOrEqual(5.6 - 1e-9);
        expect(svar.lyftPct - 5.6).toBeLessThanOrEqual(TOL + 1e-9);
        expect(svar.resultat.pValue).toBeGreaterThan(TROSKELMAL_SIGNIFIKANS_P);
    });
    it('ett p-värde som saknas räknas som inte signifikant', () => {
        const svar = likalonslyftForMal(underlag(100, 110), { signifikans: true, skatta: stubbe(() => null).skatta });
        expect(svar.status).toBe('redan');
    });
    it('p exakt 0,05 är signifikant; målet i procent spelar ingen roll i läget', () => {
        const svar = likalonslyftForMal(underlag(100, 110), { signifikans: true, malPct: 50, skatta: stubbe(() => 0.05).skatta });
        expect(svar.status).toBe('utomRackhall');
    });
});

describe('likalonslyftForMal: ingen skattning', () => {
    it('konPct null i utgångsläget: status ingenSkattning, och skattningen körs bara en gång', () => {
        let n = 0;
        const svar = likalonslyftForMal(underlag(100, 110), { malPct: 5, skatta: () => { n++; return { konPct: null, pValue: null }; } });
        expect(svar).toEqual({ status: 'ingenSkattning', utgangslage: { konPct: null, pValue: null } });
        expect(n).toBe(1);
    });
    it('en skattning som faller bort efter lyftet räknas som att målet inte är nått', () => {
        const skatta = rader => rader[0].lon === 100 ? { konPct: -10, pValue: 0.001 } : { konPct: null, pValue: null };
        expect(likalonslyftForMal(underlag(100, 110), { malPct: 5, skatta }).status).toBe('utomRackhall');
    });
});

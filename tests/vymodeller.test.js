// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
// Vymodellerna (ADR-99) prövade i Node, utan DOM och tillstånd: Lönestrukturs avsnitt per BAS-intervall
// (src/lib/vymodell-lonestruktur.js), fliken Lika arbete (src/lib/vymodell-lika-arbete.js), fliken Ålder & karriär
// (src/lib/vymodell-alder-karriar.js) och kortet Var uppstår löneskillnaden? (src/lib/vymodell-var-uppstar-gapet.js).
// Underlaget är påhittat:
//   BAS A  100001 Handläggare   15 kvinnor, 15 män (kvinnorna ungefär 10 % lägre)
//   BAS B  100002 Utredare      30 kvinnor, 30 män (hälften av varje kön med ledningsansvar, resten inget ansvar)
//   BAS C  100003 Assistent     12 kvinnor, 4 män
//   BAS D  100004 Tekniker       2 kvinnor, 1 man   (färre än fem personer)
//   BAS E  100005 Vaktmästare    3 kvinnor, 3 män
// Vid k = 10 når A och B tröskeln för båda könen, C bara för kvinnorna (16 personer), E inte alls. Vid k = 25 når bara
// B tröskeln för båda könen, A (30 personer) bara som grupp, och C och E inte alls.
import { describe, it, expect } from 'vitest';
import { vymodellLonestruktur, oversiktPerBas, oversiktNiva } from '../src/lib/vymodell-lonestruktur.js';
import { vymodellLikaArbete, ansvarFor, statusTips } from '../src/lib/vymodell-lika-arbete.js';
import { likaArbeteGrupper } from '../src/lib/rapportunderlag.js';
import { alderBandRader, alderGapRader, alderInsiktText, konHistogram, ladaPerKon, lonefordelningPerBas, multiplarPaneler,
    vymodellAlderOchLon, vymodellAldersstruktur } from '../src/lib/vymodell-alder-karriar.js';
import { andelAvSkillnaden, gapTrappa, vymodellVarUppstarGapet } from '../src/lib/vymodell-var-uppstar-gapet.js';
import { gapUppdelning } from '../src/lib/gapuppdelning.js';
import { konsMedianer } from '../src/lib/struktur.js';

const rad = (yrke, bas, kon, lon, extra) => ({ yrke, aid: yrke.slice(0, 6), yrkeLabel: yrke.slice(7), bas, kon, lon, alder: 40, ...extra });
const flera = (yrke, bas, kon, n, lon, extra = () => ({})) => Array.from({ length: n }, (_, i) => rad(yrke, bas, kon, lon + 100 * i, extra(i)));
const ANSVAR = i => ({ ansvarsgrupp: i % 2 ? 'inget' : 'ledning' });
const underlag = () => [
    ...flera('100001 Handläggare', 'A', 'kvinna', 15, 30000), ...flera('100001 Handläggare', 'A', 'man', 15, 33000),
    ...flera('100002 Utredare', 'B', 'kvinna', 30, 40000, ANSVAR), ...flera('100002 Utredare', 'B', 'man', 30, 40500, ANSVAR),
    ...flera('100003 Assistent', 'C', 'kvinna', 12, 28000), ...flera('100003 Assistent', 'C', 'man', 4, 28500),
    ...flera('100004 Tekniker', 'D', 'kvinna', 2, 35000), ...flera('100004 Tekniker', 'D', 'man', 1, 35000),
    ...flera('100005 Vaktmästare', 'E', 'kvinna', 3, 27000), ...flera('100005 Vaktmästare', 'E', 'man', 3, 27000),
];
const BAS = ['A', 'B', 'C', 'D', 'E'];
const ls = (k, golv = Math.max(k, 10)) => vymodellLonestruktur(underlag(), { bas: BAS, k, golv, litetUnderlag: 5 });
const la = (k, golv = Math.max(k, 10)) => vymodellLikaArbete(underlag(), { k, golv, sigma: 0.1 });

describe('[B2.6] Lönestrukturs vymodell per BAS-intervall', () => {
    it('översikten: bara intervall där båda könen når k, med status, skillnad i kronor och uträkningens underlag', () => {
        const vm = ls(10);
        expect(vm.oversikt.rader.map(o => o.bas)).toEqual(['A', 'B']);
        const a = vm.oversikt.rader[0];
        expect(a).toMatchObject({ nKv: 15, nMa: 15, medKv: 30700, medMa: 33700, skillnadKr: -3000, direktiv: true });
        expect(a.gap).toBeCloseTo(30700 / 33700 * 100, 9);
        expect(a.niva).toBe(oversiktNiva(a, 10));
        expect(a.underlag).toMatchObject({ bas: 'A', masked: false });
        expect(a.underlag.kvLons).toHaveLength(15);
        expect(vm.oversikt.storst.bas).toBe('A');
        expect(vm.oversikt.exportAnteckning).toMatch(/^Störst skillnad: BAS A, kvinnors median 91,1\s%\sav männens$/);
        // Saknas: hela intervallet under k (D, E), eller ett kön under k (C).
        expect(vm.oversikt.forSma).toEqual(['D', 'E']);
        expect(vm.oversikt.ettKon).toEqual(['C']);
        expect(oversiktPerBas(underlag(), BAS, 10).map(o => o.bas)).toEqual(['A', 'B']);
    });

    it('statusen: Går ej att bedöma när ett kön är under golvet, annars KI:t mot 100 % och storleken', () => {
        expect(oversiktNiva({ gap: 80, ci: { lo: 75, hi: 85 }, nKv: 9, nMa: 20 }, 10)).toBe('ejbedomd');
        expect(oversiktNiva({ gap: 80, ci: { lo: 75, hi: 85 }, nKv: 10, nMa: 20 }, 10)).toBe('granska');
        expect(oversiktNiva({ gap: 96, ci: { lo: 90, hi: 101 }, nKv: 10, nMa: 20 }, 10)).toBe('folj');
        expect(oversiktNiva({ gap: 99, ci: { lo: 97, hi: 101 }, nKv: 10, nMa: 20 }, 10)).toBe('balanserat');
    });

    it('tabellen per intervall: samlad median när ett kön är under k, ingen rad när intervallet är under k', () => {
        const { skillnad } = ls(10);
        expect(skillnad.rader.map(r => [r.bas, r.samlad])).toEqual([['A', false], ['B', false], ['C', true]]);
        expect(skillnad.rader[2]).toEqual({ bas: 'C', nKv: 12, nMa: 4, samlad: true, medTot: 28600 });
        expect(skillnad.rader[0].kvotPct).toBe(91.1);
        expect(skillnad.utelamnade).toEqual(['E']);   // D har färre än två män och prövas inte
        expect(skillnad.samlade).toEqual(['C']);
        expect(skillnad.maskerade).toBe(2);
    });

    it('könsfördelningen: en rad från fem personer oavsett k, ojämn när ett kön är under 40 %', () => {
        for (const k of [10, 25]) {
            const { konsfordelning } = ls(k);
            expect(konsfordelning.rader.map(r => r.bas)).toEqual(['A', 'B', 'C', 'E']);
            expect(konsfordelning.utelamnade).toEqual(['D']);
            expect(konsfordelning.rader[2]).toEqual({ bas: 'C', tot: 16, nKv: 12, nMa: 4, pctKv: 75, pctMa: 25, underrepresenterat: 'Man' });
            expect(konsfordelning.rader[0].underrepresenterat).toBeNull();
        }
    });
});

describe('[B5.8] Lika arbetes vymodell', () => {
    it('grupperna: Lika arbetes grupper och status, med förklaringen, dominansen och samlad median under k', () => {
        const vm = la(10), lg = likaArbeteGrupper(underlag(), { k: 10, golv: 10 });
        expect(vm.grupper.map(g => [g.aid, g.bas, g.samladMedian])).toEqual(lg.grupper.map(g => [g.aid, g.bas, g.samladMedian]));
        const a = vm.grupper.find(g => g.bas === 'A');
        expect(a).toMatchObject({ yrke: '100001 Handläggare', nKv: 15, nMa: 15, tot: 30, medKv: 30700, medMa: 33700, samladMedian: false, dominans: 'Könsblandad' });
        expect(a.kvot).toBeCloseTo(30700 / 33700 * 100, 9);
        expect(a.tips).toBe(statusTips(a.niva, lg.grupper.find(g => g.bas === 'A').sakerstalld, 10));
        const c = vm.grupper.find(g => g.bas === 'C');
        expect(c).toMatchObject({ samladMedian: true, medTot: 28600, gap: 0, dominans: 'Kvinnodominerad' });
        expect(c.medKv).toBeUndefined();
        expect(vm.samlade).toEqual(['100003 Assistent (BAS C)']);
        expect(vm.utelamnade).toEqual(['100005 Vaktmästare (BAS E)']);
        expect(vm.ejJamforbara).toEqual(['100004 Tekniker (BAS D)']);
    });

    it('statusens förklaring i ord för varje nivå', () => {
        expect(statusTips('ejbedomd', null, 10)).toBe('Går ej att bedöma: ett kön har färre än 10 personer, för få för att pröva skillnaden');
        expect(statusTips('folj', true, 10)).toMatch(/säkerställd men under 3 %/);
        expect(statusTips('folj', false, 10)).toMatch(/minst 3 % men inte statistiskt säkerställd/);
        expect(statusTips('balanserat', false, 10)).toBe('Skillnaden är under 3 % och inte statistiskt säkerställd');
    });

    it('underraderna per ansvarsgrupp, med kvoten för dem utan ledningsansvar', () => {
        const b = la(10).grupper.find(g => g.bas === 'B');
        expect(b.ansvar.grupper.map(u => [u.grupp, u.n, u.nKv, u.nMa, u.liten, u.samladMedian])).toEqual([['ledning', 30, 15, 15, false, false], ['inget', 30, 15, 15, false, false]]);
        expect(b.ansvar.utanLedning).toBeCloseTo(b.ansvar.grupper[1].kvot, 9);
        expect(la(10).grupper.find(g => g.bas === 'A').ansvar).toBeNull();
        // Under k: inga lönemått i underraden, och ingen kvot för dem utan ledningsansvar.
        const vid25 = ansvarFor(underlag().filter(r => r.bas === 'B'), 25);
        expect(vid25.grupper.every(u => u.medKv === null && u.medMa === null)).toBe(true);
        expect(vid25.utanLedning).toBeNull();
    });

    it('trattens underlag bara med minst två grupper, och ingen vymodell utan underlag', () => {
        expect(la(10).tratt.punkter.map(p => p.bas)).toEqual(['A', 'B']);
        expect(la(25).tratt).toBeNull();
        expect(vymodellLikaArbete([], { k: 10, golv: 10 })).toBeNull();
    });

    it('låg styrka när gruppens minsta upptäckbara skillnad är större än skillnaden', () => {
        // gap är redan avståndet från lika lön: A skiljer 8,9 %, B 1,2 %. Med σ = 0,05 är B:s minsta upptäckbara
        // skillnad 3,7 % och A:s 5,2 %, så bara B får markeringen.
        const jamforbara = s => vymodellLikaArbete(underlag(), { k: 10, golv: 10, sigma: s }).grupper.filter(g => !g.samladMedian);
        expect(jamforbara(0.01).map(g => g.lagStyrka)).toEqual([null, null]);
        const vid05 = jamforbara(0.05);
        expect(vid05.map(g => [g.bas, !!g.lagStyrka])).toEqual([['A', false], ['B', true]]);
        expect(vid05[1].lagStyrka.mdePct).toBeGreaterThan(vid05[1].gap);
        expect(jamforbara(5).every(g => g.lagStyrka)).toBe(true);
        expect(vymodellLikaArbete(underlag(), { k: 10, golv: 10 }).grupper.every(g => !g.lagStyrka)).toBe(true);   // utan spridning ingen styrka
    });
});

// Ålder & karriär: åldrarna stiger med ett år per person, lönen med 200 kr.
//   BAS A  20 kvinnor 25–44 år, 20 män 30–49 år
//   BAS B  12 kvinnor 40–51 år,  4 män 45–48 år
// Vid k = 10 når hela urvalet tröskeln för båda könen (32 kvinnor, 24 män) och BAS B bara för kvinnorna; vid k = 25
// når bara kvinnorna i hela urvalet den.
const aRad = (bas, kon, n, lon, alder) => Array.from({ length: n }, (_, i) => ({ yrke: '100001 Handläggare', aid: '100001', bas, kon, lon: lon + 200 * i, alder: alder + i }));
const alderUnderlag = () => [...aRad('A', 'kvinna', 20, 30000, 25), ...aRad('A', 'man', 20, 32000, 30), ...aRad('B', 'kvinna', 12, 35000, 40), ...aRad('B', 'man', 4, 36000, 45)];
const ak = (bas, k, val = {}) => vymodellAlderOchLon(alderUnderlag(), { bas, k, ...val });

describe('[B2.7] Ålder & karriärs vymodell, lönedelen', () => {
    it('hela urvalet: kvoten, lönen vid samma ålder, trendlinjerna och raden i klartext när båda könen når k', () => {
        const vm = ak('__ALLA__', 10);
        expect([vm.dataKv.length, vm.dataMa.length, vm.konOk]).toEqual([32, 24, true]);
        expect(vm.kvot).toBe(konsMedianer(vm.df, { k: 10 }).kvotPct);
        expect(vm.vidSammaAlder).toBeCloseTo(99.119, 3);
        expect(vm.trendKv.m).toBeCloseTo(296, 0);
        expect(vm.ciKv).toHaveLength(25);
        expect(vm.insikt).toBe(alderInsiktText(vm.trendKv.m, vm.trendMa.m, vm.kvot, vm.vidSammaAlder));
        expect(vm.insikt).toMatch(/^Lönen stiger snabbare med åldern för kvinnor \(\+296\skr per år\) än för män \(\+228\skr\)\. Vid samma ålder är kvinnors lön 99,1\s%/);
        expect([vm.utan, vm.dolda, vm.statMedian, vm.trendAlla]).toEqual(['', 4, null, null]);   // männen i BAS B är för få för punkter
    });

    it('ett BAS-intervall där männen är under k: inget gap, ingen trendlinje, låda eller klasser för dem', () => {
        const vm = ak('B', 10, { trendAlla: true });
        expect([vm.kvot, vm.vidSammaAlder, vm.trendMa, vm.insikt, vm.enAlder]).toEqual([null, null, null, null, false]);
        expect(vm.trendKv).not.toBeNull();
        expect(vm.utan).toBe('män');
        expect(vm.lada).toMatchObject({ nKv: 12, nMa: 4, lonMa: null, utan: 'män' });
        expect(vm.lada.lonKv).toHaveLength(12);
        expect(vm.histogram).toEqual({ nKv: 12, nMa: 4, klasser: null, orsak: 'kon' });
        expect(vm.trendAlla.m).toBeCloseTo(200, 9);   // hela urvalets trendlinje kräver bara att urvalet når k
        expect(ak('B', 25, { trendAlla: true })).toMatchObject({ trendAllaOk: false, trendAlla: null });
        expect(ak('C', 10)).toBeNull();
    });

    it('raden i klartext: lika lutning inom 25 %, och åldersfördelningen som förklarar lite, en del eller tvärtom', () => {
        expect(alderInsiktText(200, 220, 95, 95.5)).toMatch(/^Lönen stiger ungefär lika mycket per levnadsår .* nästan som utan justering \(95,0\s%\)/);
        expect(alderInsiktText(100, 200, 90, 93)).toMatch(/långsammare .* förklarar en del av skillnaden, men inte hela\./);
        expect(alderInsiktText(100, 100, 96, 94)).toMatch(/blir större när åldern räknas bort/);
        expect(alderInsiktText(0, 0, 96, 98, { niva: { en: 'nivå' }, enhet: { en: 'enhet' } })).toMatch(/Vad nivå och enhet förklarar/);
    });

    it('underlaget för «Räkna för» går genom samma regler med samma k: lådorna, klasserna och åldersgrupperna', () => {
        const rader = alderUnderlag().filter(r => r.bas === 'A');
        expect(ladaPerKon(rader, 25)).toEqual({ nKv: 20, nMa: 20, lonKv: null, lonMa: null, utan: 'kvinnor och män' });
        expect(konHistogram(rader, 10).klasser.every(c => c.nKv + c.nMa >= 10)).toBe(true);
        expect(konHistogram(rader, 25).orsak).toBe('kon');
        const vm = ak('__ALLA__', 10), gap = alderGapRader(vm.dataKv, vm.dataMa, 10);
        expect(gap.visade.map(g => [g.namn, g.nKv, g.nMa])).toEqual([['30–39 år', 10, 10], ['40–49 år', 15, 14]]);
        expect(gap.dolda).toEqual(['Under 30 år', '50–59 år']);
    });

    it('lönefördelningen per BAS-intervall och de små multiplarna: små celler markeras och namnges', () => {
        const perKon = lonefordelningPerBas(alderUnderlag(), true, 10);
        expect(perKon.utelamnade).toEqual(['BAS B (män)']);
        expect(perKon.punkter.filter(p => p.liten).map(p => p.rad.bas + p.kon)).toEqual(Array(4).fill('BMan'));
        expect(perKon.ordning).toEqual(['BAS A', 'BAS B']);
        expect(lonefordelningPerBas(alderUnderlag(), false, 25).utelamnade).toEqual(['BAS B']);
        const vm = ak('__ALLA__', 10);
        const { paneler, utanfor } = multiplarPaneler(alderUnderlag(), vm.liten, 10);
        expect(paneler.map(p => [p.bas, p.punkter.length, p.punkter.filter(x => x.liten).length, !!p.trend, p.nedsamplad])).toEqual([['A', 40, 0, true, false], ['B', 16, 4, true, false]]);
        expect(utanfor).toEqual([]);
        expect(multiplarPaneler(alderUnderlag(), vm.liten, 25).utanfor).toEqual(['BAS B']);
    });
});

describe('[B2.8] Ålder & karriärs vymodell, åldersstrukturen', () => {
    it('andelarna per åldersklass, åldrarna och riskerna för hela urvalet och ett BAS-intervall', () => {
        const alla = vymodellAldersstruktur(alderUnderlag(), { bas: '__ALLA__', k: 10, alla: alderUnderlag() });
        expect(alla).toMatchObject({ n: 56, medianAlder: 40.5, orgMedian: 40.5, alderDiff: 0, andel60: 0, andelU40: 44.6, q25: 34, q75: 45,
            pension: null, atervaxt: false, avvikelse: null, aLo: 25, aHi: 51 });
        expect(alla.pctKv).toEqual([0, 8.9, 8.9, 8.9, 17.9, 8.9, 3.6, 0, 0, 0]);
        expect(alla.kurvaKv.ages).toHaveLength(27);
        const b = vymodellAldersstruktur(alderUnderlag(), { bas: 'B', k: 10, alla: alderUnderlag() });
        expect(b).toMatchObject({ n: 16, medianAlder: 46, alderDiff: 5.5, atervaxt: true, avvikelse: 'aldre', band: null });
        const aldre = n60 => Array.from({ length: 10 }, (_, i) => ({ bas: 'X', kon: 'man', lon: 30000, alder: i < 10 - n60 ? 50 + i : 61 }));
        expect([1, 2, 3].map(n => vymodellAldersstruktur(aldre(n), { bas: '__ALLA__', k: 10, alla: aldre(n) }).pension)).toEqual([null, 'uppsikt', 'manga']);
        expect(vymodellAldersstruktur([], { bas: '__ALLA__', k: 10, alla: [] })).toBeNull();
    });

    it('lönespridningen över ålder: bara femårsgrupper med minst k personer, och inget band med färre än två', () => {
        const band = alderBandRader(alderUnderlag(), 10);
        expect(band.map(r => [r.namn, r.n])).toEqual([['30–34 år', 10], ['35–39 år', 10], ['40–44 år', 15], ['45–49 år', 14]]);
        expect(band[0]).toMatchObject({ x: 32.5, alder: 30, p50: 31900 });
        expect(alderBandRader(alderUnderlag(), 15)).toBeNull();
    });
});

describe('[B3.11] Var uppstår löneskillnadens vymodell', () => {
    const ul = () => underlag().filter(r => ['A', 'B', 'C'].includes(r.bas));
    it('delarna med belopp, andel och de grupper som bidrar mest; medianens kvot; för få under k', () => {
        const vm = vymodellVarUppstarGapet(ul(), { k: 10, variabler: ['bas', 'aid'] });
        const u = gapUppdelning(ul(), { k: 10, variabler: ['bas', 'aid'] });
        expect(vm.uppdelning).toEqual(u);
        expect(vm.medianKvot).toBe(konsMedianer(ul(), { k: 10 }).kvotPct);
        expect(vm.delar.map(d => d.id)).toEqual(['A', 'B', 'C']);
        expect(vm.delar.reduce((s, d) => s + d.belopp, 0)).toBeCloseTo(u.gap, 6);
        expect(vm.delar[0].andel).toBeCloseTo(u.delar.A / u.gap * 100, 9);
        expect(vm.delar[0].topp).toEqual(u.topp.A);
        expect(vm.storst).toBe(Math.max(1, ...vm.delar.map(d => Math.abs(d.belopp))));
        expect(vymodellVarUppstarGapet(ul(), { k: 50, variabler: ['bas', 'aid'] })).toEqual({ forFa: true });
        expect(vymodellVarUppstarGapet([], { k: 10, variabler: ['bas'] })).toBeNull();
    });

    it('trappan: från hela skillnaden till noll, och andelen bara när delen ligger inom helheten', () => {
        const steg = gapTrappa({ gap: -2000, delar: { A: -1500, B: 600, C: -1100 } });
        expect(steg.map(s => [s.del.id, s.fore, s.efter, s.lag, s.hog, s.inom])).toEqual([
            ['A', -2000, -500, -2000, -500, false], ['B', -500, -1100, -1100, -500, false], ['C', -1100, 0, -1100, 0, true]]);
        expect(steg.map(s => s.andel && Math.round(s.andel))).toEqual([75, null, 55]);
        expect(andelAvSkillnaden({ gap: -2000, litetGap: true }, -1500)).toBeNull();
        expect(andelAvSkillnaden({ gap: -2000 }, -2500)).toBeNull();
    });
});

// Invarianten på vymodellerna: inget lönemått för en grupp eller ett kön under tröskeln, vid 10 och 25.
describe.each([10, 25])('[I9] vymodellerna vid k = %i', k => {
    const lonemått = ['medKv', 'medMa', 'kvot', 'kvotPct', 'gap', 'ci', 'medTot', 'utanLedning'];
    const harLonematt = o => lonemått.some(f => (o[f] ?? null) !== null && !(f === 'gap' && o.samladMedian));

    it('Lönestruktur: medianerna per kön bara där båda könen når k, den samlade bara där intervallet gör det', () => {
        const vm = ls(k);
        for (const o of vm.oversikt.rader) expect(Math.min(o.nKv, o.nMa), o.bas).toBeGreaterThanOrEqual(k);
        for (const r of vm.skillnad.rader) {
            if (r.samlad) { expect(r.nKv + r.nMa).toBeGreaterThanOrEqual(k); expect(r.medKv).toBeUndefined(); }
            else expect(Math.min(r.nKv, r.nMa)).toBeGreaterThanOrEqual(k);
        }
        for (const r of vm.konsfordelning.rader) { expect(r.tot).toBeGreaterThanOrEqual(5); expect(harLonematt(r)).toBe(false); }
        expect(vm.oversikt.rader.map(o => o.bas)).toEqual(k === 10 ? ['A', 'B'] : ['B']);
        expect(vm.skillnad.utelamnade).toEqual(k === 10 ? ['E'] : ['C', 'E']);
        expect(vm.skillnad.samlade).toEqual(k === 10 ? ['C'] : ['A']);
    });

    it('Lika arbete: grupperna, underraderna och trattens punkter', () => {
        const vm = la(k);
        for (const g of vm.grupper) {
            if (g.samladMedian) { expect(g.tot).toBeGreaterThanOrEqual(k); expect(g.medKv ?? g.medMa ?? g.kvot).toBeUndefined(); }
            else expect(Math.min(g.nKv, g.nMa)).toBeGreaterThanOrEqual(k);
            for (const u of g.ansvar?.grupper || []) {
                if (u.liten) expect(harLonematt(u)).toBe(false);
                if ((u.medKv ?? null) !== null) expect(Math.min(u.nKv, u.nMa)).toBeGreaterThanOrEqual(k);
                if ((u.medTot ?? null) !== null) expect(u.n).toBeGreaterThanOrEqual(k);
            }
        }
        for (const p of vm.tratt?.punkter || []) expect(Math.min(p.nKv, p.nMa)).toBeGreaterThanOrEqual(k);
        const iVymodellen = vm.grupper.map(g => [g.bas, g.samladMedian]).sort();
        expect(iVymodellen).toEqual(k === 10 ? [['A', false], ['B', false], ['C', true]] : [['A', true], ['B', false]]);
        expect(vm.utelamnade).toEqual(k === 10 ? ['100005 Vaktmästare (BAS E)'] : ['100003 Assistent (BAS C)', '100005 Vaktmästare (BAS E)']);
    });

    it('Ålder & karriär: gapen kräver båda könen, ett köns trendlinje och låda könet, klasserna och grupperna k', () => {
        for (const bas of ['__ALLA__', 'A', 'B']) {
            const vm = ak(bas, k, { trendAlla: true });
            const nKv = vm.dataKv.length, nMa = vm.dataMa.length;
            if (vm.kvot !== null || vm.vidSammaAlder !== null || vm.insikt !== null) expect(Math.min(nKv, nMa), bas).toBeGreaterThanOrEqual(k);
            if (vm.trendKv || vm.ciKv || vm.lada.lonKv) expect(nKv, bas).toBeGreaterThanOrEqual(k);
            if (vm.trendMa || vm.ciMa || vm.lada.lonMa) expect(nMa, bas).toBeGreaterThanOrEqual(k);
            if (vm.trendAlla) expect(vm.df.length).toBeGreaterThanOrEqual(k);
            for (const c of vm.histogram.klasser || []) expect(c.nKv + c.nMa).toBeGreaterThanOrEqual(k);
            for (const g of alderGapRader(vm.dataKv, vm.dataMa, k).visade) expect(Math.min(g.nKv, g.nMa)).toBeGreaterThanOrEqual(k);
            // En punkt som inte är liten hör till en grupp och ett kön i gruppen som når k.
            for (const r of vm.df.filter(r => !vm.liten(r))) {
                const grupp = vm.df.filter(x => x.bas === r.bas);
                expect(grupp.length).toBeGreaterThanOrEqual(k);
                expect(grupp.filter(x => x.kon === r.kon).length).toBeGreaterThanOrEqual(k);
            }
            const s = vymodellAldersstruktur(alderUnderlag(), { bas, k, alla: alderUnderlag() });
            for (const r of s.band || []) expect(r.n).toBeGreaterThanOrEqual(k);
        }
        expect(ak('__ALLA__', k).kvot === null).toBe(k === 25);
        const lf = lonefordelningPerBas(alderUnderlag(), true, k);
        for (const p of lf.punkter.filter(x => !x.liten)) expect(lf.punkter.filter(x => x.rad.bas === p.rad.bas && x.kon === p.kon).length).toBeGreaterThanOrEqual(k);
        for (const p of multiplarPaneler(alderUnderlag(), ak('__ALLA__', k).liten, k).paneler) expect(p.punkter.length).toBeGreaterThanOrEqual(k);
    });

    it('Var uppstår löneskillnaden: ingen uppdelning och ingen medianens kvot när ett kön är under k', () => {
        const vm = vymodellVarUppstarGapet(underlag().filter(r => r.bas === 'C'), { k, variabler: ['bas', 'aid'] });
        expect(vm).toEqual({ forFa: true });   // fyra män
        const helt = vymodellVarUppstarGapet(underlag(), { k, variabler: ['bas', 'aid'] });
        for (const d of helt.delar) expect(d.topp.every(p => !/Assistent|Tekniker|Vaktmästare|BAS [CDE]$/.test(p.namn))).toBe(true);
    });
});

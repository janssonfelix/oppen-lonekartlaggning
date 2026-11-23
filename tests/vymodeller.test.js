// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
// Vymodellerna (ADR-99) prövade i Node, utan DOM och tillstånd: Lönestrukturs avsnitt per BAS-intervall
// (src/lib/vymodell-lonestruktur.js), fliken Lika arbete (src/lib/vymodell-lika-arbete.js), fliken Ålder & karriär
// (src/lib/vymodell-alder-karriar.js), kortet Var uppstår löneskillnaden? (src/lib/vymodell-var-uppstar-gapet.js),
// Översikt (src/lib/vymodell-oversikt.js), Löneöversikten (src/lib/vymodell-loneoversikt.js), dossiererna
// (src/lib/vymodell-gruppdossier.js, src/lib/vymodell-basdossier.js), rapportmodellen (src/lib/vymodell-rapport.js)
// och rapportunderlaget (src/lib/vymodell-rapportunderlag.js).
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
import { likaArbeteGrupper, tillText } from '../src/lib/rapportunderlag.js';
import { alderBandRader, alderGapRader, alderInsiktText, konHistogram, ladaPerKon, lonefordelningPerBas, multiplarPaneler,
    vymodellAlderOchLon, vymodellAldersstruktur } from '../src/lib/vymodell-alder-karriar.js';
import { andelAvSkillnaden, gapTrappa, vymodellVarUppstarGapet } from '../src/lib/vymodell-var-uppstar-gapet.js';
import { gapUppdelning } from '../src/lib/gapuppdelning.js';
import { konsMedianer } from '../src/lib/struktur.js';
import { kravstatus, oversiktNyckeltal } from '../src/lib/vymodell-oversikt.js';
import { jamforelseRader } from '../src/lib/jamforelse.js';
import { vymodellLoneoversikt } from '../src/lib/vymodell-loneoversikt.js';
import { gruppdossierGrupper, vymodellGruppdossier } from '../src/lib/vymodell-gruppdossier.js';
import { basdossierIntervall, basdossierStatus, vymodellBasdossier } from '../src/lib/vymodell-basdossier.js';
import { arHelaDokumentationen, perBasUtelamnat, rapportAvsnittIUrval, rapportDossierGrupper, rapportUrvalAttSpara, rapportUrvalAv, RM_AVSNITT,
    RM_URVAL, vymodellRapport } from '../src/lib/vymodell-rapport.js';
import { rapportunderlagDiagram, vymodellRapportunderlag } from '../src/lib/vymodell-rapportunderlag.js';
import { perBasTabeller } from '../src/lib/perbas.js';

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

// Ställningstagandet, jämförelsestatistiken och paren i likvärdigt arbete för dossiererna och Översikt (påhittade).
const policyFor = (aid, bas) => (aid === null ? { A: { p10: 33000, med: 34000, p90: 36000 }, C: { p10: 20000, med: 25000, p90: 30000 }, D: { p10: 40000, med: 41000, p90: 42000 } }[bas] || null
    : { p10: 30000, med: 32000, p90: 34000 });
const PAR = [
    { kvAid: '100003', kvBas: 'C', kvN: 16, kvLabel: 'Assistent', kvMedian: 28600, maAid: '100001', maBas: 'A', maN: 30, maLabel: 'Handläggare', maMedian: 32200, gapKr: -3600, gapPct: -11.2 },
    { kvAid: '100003', kvBas: 'C', kvN: 16, kvLabel: 'Assistent', kvMedian: 28600, maAid: '100005', maBas: 'E', maN: 6, maLabel: 'Vaktmästare', maMedian: 27250, gapKr: 1350, gapPct: 5 },
];

describe('[B2.9] Översiktens nyckeltal', () => {
    it('antal, kön och medelålder; kvoten bara när båda könen når k', () => {
        const vm = oversiktNyckeltal(underlag(), 10);
        expect(vm).toMatchObject({ n: 115, nKv: 62, nMa: 53, medelalder: 40, lage: 'ok' });
        expect(vm.kvotPct).toBe(konsMedianer(underlag(), { k: 10 }).kvotPct);
        expect(oversiktNyckeltal(underlag(), 60)).toMatchObject({ lage: 'underK', kvotPct: null });
        expect(oversiktNyckeltal(underlag().filter(r => r.kon === 'kvinna'), 1)).toMatchObject({ lage: 'ettKonSaknas', kvotPct: null });
        expect(oversiktNyckeltal(underlag().map(r => ({ ...r, alder: null })), 10).medelalder).toBeNull();
        expect(oversiktNyckeltal([], 10)).toBeNull();
    });
});

describe('[B2.10] Översiktens läge mot lagkraven', () => {
    const ks = (val = {}) => kravstatus(underlag(), { bas: BAS, k: 10, golv: 10, ...val });
    it('säkerställd skillnad och könsfördelning bara i intervall där båda könen når k', () => {
        const vm = ks();
        expect(vm).toMatchObject({ jamforbara: 2, maskerade: 3 });
        // A: kvinnorna omkring 10 % lägre (Värt att granska); B: omkring 1 % (inte säkerställd).
        expect(vm.gap).toEqual({ antal: 1, av: 2, lage: 'warn' });
        expect(vm.skev).toEqual({ antal: 0, av: 2, lage: 'ok' });
        // Översiktens rader från appen ger samma tal.
        expect(ks({ oversikt: oversiktPerBas(underlag(), BAS, 1) }).gap).toEqual(vm.gap);
        expect(ks({ k: 40 })).toMatchObject({ jamforbara: 0, gap: { av: 0, lage: 'na' }, skev: { lage: 'na' } });
        const skeva = [...underlag(), ...flera('100002 Utredare', 'B', 'kvinna', 60, 40000)];
        expect(kravstatus(skeva, { bas: BAS, k: 10, golv: 10 }).skev).toEqual({ antal: 1, av: 2, lage: 'warn' });
    });
    it('referensens P10: intervall med minst k personer och en rad med P10; utan ställningstagande inget kort', () => {
        // A: median 32 200 under P10 33 000; C: över 20 000; D har färre än k och räknas inte.
        expect(ks({ policyFor }).referens).toEqual({ antal: 1, av: 2, lage: 'warn' });
        expect(ks({ policyFor: (a, b) => (b === 'A' || b === 'B' ? { p10: 50000 } : null) }).referens).toEqual({ antal: 2, av: 2, lage: 'crit' });
        expect(ks({ policyFor: () => null }).referens).toEqual({ antal: 0, av: 0, lage: 'na' });
        expect(ks().referens).toBeNull();
    });
    it('jämförelsestatistiken: grupper med en rad, kritiskt när mer än hälften ligger under', () => {
        const statistik = [{ aid: '100001', median: 40000 }, { aid: '100003', bas: 'C', median: 20000 }];
        expect(ks({ statistik }).statistik).toEqual({ antal: 1, av: 2, lage: 'warn', utelamnade: 0 });
        expect(ks({ statistik: [...statistik, { aid: '100002', bas: 'B', median: 50000 }] }).statistik).toEqual({ antal: 2, av: 3, lage: 'crit', utelamnade: 0 });
        expect(ks({ statistik: [{ aid: '999999', median: 1 }] }).statistik).toEqual({ antal: 0, av: 0, lage: 'na', utelamnade: 0 });
        expect(ks({ statistik: [] }).statistik).toBeNull();
        expect(kravstatus([], { bas: BAS, k: 10, golv: 10 })).toBeNull();
    });
    it('jämförelsestatistiken: bara grupper med minst k, som Löneläget; de utelämnade räknas', () => {
        // E (sex personer) har en rad men räknas inte; vid 25 inte heller C (16).
        const statistik = [{ aid: '100001', median: 40000 }, { aid: '100003', bas: 'C', median: 50000 }, { aid: '100005', bas: 'E', median: 50000 }];
        expect(ks({ statistik }).statistik).toEqual({ antal: 2, av: 2, lage: 'crit', utelamnade: 1 });
        expect(ks({ statistik, k: 25 }).statistik).toEqual({ antal: 1, av: 1, lage: 'crit', utelamnade: 2 });
        expect(ks({ statistik, k: 40 }).statistik).toEqual({ antal: 0, av: 0, lage: 'na', utelamnade: 3 });
    });
});

describe('[B6.10] Löneöversiktens vymodell', () => {
    it('raderna per BAS-intervall: organisationen, könen och yrkesgrupperna med minst fem, under k utelämnade', () => {
        const vm = vymodellLoneoversikt(underlag(), { bas: BAS, k: 10, policyFor, statistik: [{ aid: '100001', bas: 'A', median: 40000 }] });
        const a = vm.block[0];
        expect(a.referens).toEqual({ p10: 33000, med: 34000, p90: 36000 });
        expect(a.rader.map(r => [r.kategori, r.n])).toEqual([['Organisationen', 30], ['Kvinna', 15], ['Man', 15], ['100001 Handläggare', 30]]);
        const org = a.rader[0];
        expect(org).toMatchObject({ med: 32200, underReferens: true, statMedian: null, statDiff: null });
        expect(org.spridning).toBeCloseTo(org.p90 / org.p10, 12);
        expect(a.rader[3].statMedian).toBe(40000);
        expect(a.rader[3].statDiff).toBeCloseTo((32200 / 40000 - 1) * 100, 9);
        expect(vm.block.map(b => b.utelamnade)).toEqual([[], [], ['Man'], ['Organisationen', 'Kvinna', 'Man'], ['Organisationen', 'Kvinna', 'Man', '100005 Vaktmästare']]);
        expect(vm.utelamnade).toBe(8);
        expect(vm.smaYrken).toBe(1);   // D: tre personer
        expect(vm.block[1].referens).toBeNull();
        expect(vymodellLoneoversikt(underlag(), { bas: ['A'], k: 10 }).block[0].rader[0].underReferens).toBe(false);
    });
});

describe('[B5.9] Gruppdossierns vymodell', () => {
    const grupp = (k, bas) => gruppdossierGrupper(underlag(), k).find(g => g.bas === bas);
    const gd = (k, bas, val = {}) => vymodellGruppdossier(grupp(k, bas), { k, kostnad: { months: 12, poPct: 40 }, par: PAR, ...val });
    it('grupperna: AID-koden i BAS-intervallet med minst k personer, störst först', () => {
        expect(gruppdossierGrupper(underlag(), 10).map(g => [g.key, g.rows.length])).toEqual([['100002|B', 60], ['100001|A', 30], ['100003|C', 16]]);
        expect(gruppdossierGrupper(underlag(), 25).map(g => g.key)).toEqual(['100002|B', '100001|A']);
        expect(gruppdossierGrupper([...underlag(), rad('100001 Handläggare', 'A', 'man', 0)], 10).find(g => g.bas === 'A').rows).toHaveLength(30);
    });
    it('nyckeltalen, den ojusterade skillnaden med KI och räkneexemplet bara när båda könen når k', () => {
        const a = gd(10, 'A');
        expect(a).toMatchObject({ key: '100001|A', n: 30, nKv: 15, nMa: 15, median: 32200, ansvar: null });
        expect(a.gap).toMatchObject({ pct: 30700 / 33700 * 100, medKv: 30700, medMa: 33700 });
        expect(a.gap.ci.lo).toBeLessThan(a.gap.ci.hi);
        expect(a.gap.arsbelopp).toMatch(/^Räkneexempel: kvinnornas medianlön ligger 3\s000\skr per månad under männens\. För gruppens 15 kvinnor/);
        expect(gd(10, 'A', { ki: false }).gap.ci).toBeNull();
        expect(gd(10, 'C').gap).toBeNull();   // fyra män
        expect(gd(25, 'A').gap).toBeNull();
    });
    it('antal per ansvarsgrupp, läget mot ställningstagandet, jämförelsestatistiken och det appen ger', () => {
        expect(gd(10, 'B').ansvar).toEqual({ ledning: { kv: 15, ma: 15 }, uppdrag: { kv: 0, ma: 0 } });
        const ref = { p10: 30000, med: 32000, p90: 34000 };
        const a = gd(10, 'A', { referens: ref, referensNiva: 'AID + BAS', statistik: [{ aid: '100001', median: 35000 }],
            justerat: { bas: 'A', status: 'ok' }, prio: { aid: '100001' }, forslag: [{ text: 'x' }] });
        expect(a).toMatchObject({ pol: ref, polLevel: 'AID + BAS', bench: { median: 35000 }, adjusted: { status: 'ok' }, prio: { aid: '100001' }, suggestions: [{ text: 'x' }] });
        expect(a.band.position).toBeCloseTo((32200 - 30000) / 4000, 12);
        expect(a.compliance).toMatchObject({ n: 30, under: 0, over: 4 });
        expect(gd(10, 'A')).toMatchObject({ pol: null, band: null, compliance: null, bench: null });
    });
    it('paren i likvärdigt arbete: gruppen som kvinnodominerad eller jämförelse, par med en grupp under k utelämnade', () => {
        const c = gd(10, 'C');
        expect(c.lvAsSubject.map(p => p.maAid)).toEqual(['100001']);
        expect(c.lvUtelamnade).toBe(1);
        expect(gd(10, 'A').lvAsComparator.map(p => p.kvAid)).toEqual(['100003']);
        expect(gd(5, 'C').lvAsSubject).toHaveLength(2);
    });
});

describe('[B5.10] BAS-dossierns vymodell', () => {
    const bd = (bas, k, val = {}) => vymodellBasdossier(underlag(), bas, { k, basIntervall: BAS, golv: Math.max(k, 10), ...val });
    const bokslut = (k = 10) => ({ ar: 2025, k, nyckeltal: { nKv: 0, nMa: 0 }, grupper: [],
        basIntervall: [{ bas: 'A', n: 28, nKv: 14, nMa: 14, p10: 29000, med: 31000, p90: 33000, medKv: 30000, medMa: 32000, spridning: 0.13 }] });
    it('intervallen: minst k personer med lön; ingen modell för de andra', () => {
        expect(basdossierIntervall(underlag(), BAS, 10)).toEqual([{ bas: 'A', n: 30 }, { bas: 'B', n: 60 }, { bas: 'C', n: 16 }]);
        expect(bd('D', 10)).toBeNull();
        expect(bd('X', 1)).toBeNull();
    });
    it('nyckeltalen, könens medianer bara när båda når k, och läget mot ställningstagandets rad', () => {
        const a = bd('A', 10, { referens: { p10: 33000, med: 34000, p90: 36000 }, referensNamn: 'referensen' });
        expect(a).toMatchObject({ bas: 'A', n: 30, nKv: 15, nMa: 15, andelKv: 50, median: 32200, konOk: true, medKv: 30700, medMa: 33700, k: 10 });
        expect(a.referens.diffPct.med).toBeCloseTo((32200 / 34000 - 1) * 100, 9);
        expect(a.referens.namn).toBe('referensen');
        expect(bd('C', 10)).toMatchObject({ konOk: false, medKv: null, kvotPct: null, referens: null });
    });
    it('yrkesgrupperna: Lika arbetes status, samlad median när ett kön är under k, gruppdossiern när gruppen når k', () => {
        expect(bd('A', 10).yrken).toMatchObject([{ aid: '100001', status: basdossierStatus(likaArbeteGrupper(underlag(), { k: 10, golv: 10 }).grupper.find(g => g.bas === 'A')), samlad: false, medKv: 30700, dossierKey: '100001|A', ocksaI: [] }]);
        expect(bd('C', 10).yrken).toMatchObject([{ status: 'liten', samlad: true, medKv: null, medTot: 28600, dossierKey: '100003|C' }]);
        expect(bd('A', 25).yrken).toMatchObject([{ samlad: true, medKv: null, dossierKey: '100001|A' }]);
        expect(basdossierStatus({ niva: 'granska' })).toBe('granska');
        expect(basdossierStatus({})).toBe('ejbedomd');
        const ocksa = [...underlag(), ...flera('100001 Handläggare', 'B', 'kvinna', 2, 40000)];
        expect(vymodellBasdossier(ocksa, 'A', { k: 10, basIntervall: BAS }).yrken[0].ocksaI).toEqual(['B']);
    });
    it('paren där det kvinnodominerade yrket ligger i intervallet; ålder; förra årets rad med den högre tröskeln', () => {
        const c = bd('C', 10, { likvardighet: { pairs: PAR, lagreKrav: [PAR[0]] } });
        expect(c.par.kandidat.map(p => p.maAid)).toEqual(['100001']);
        expect(c.par.hierarkiska).toHaveLength(1);
        expect(c.par.utelamnade).toBe(1);
        expect(bd('A', 10).alder).toBeNull();
        const alder = bd('A', 10, { harAlder: true }).alder;
        expect(alder.map(x => [x.namn, x.n])).toEqual([['–34', 0], ['35–49', 30], ['50–', 0]]);
        expect(alder[1]).toMatchObject({ med: 32200, medKv: 30700, medMa: 33700 });
        expect(bd('A', 25, { harAlder: true }).alder[1]).toMatchObject({ med: 32200, medKv: null, medMa: null });
        expect(bd('A', 10).forra).toEqual({ lage: 'ingetBokslut' });
        const forra = bd('A', 10, { forraBokslut: bokslut() }).forra;
        expect(forra).toMatchObject({ lage: 'ok', ar: 2025, rad: { n: { forra: 28, nu: 30 } } });
        expect(bd('B', 10, { forraBokslut: bokslut() }).forra).toEqual({ lage: 'saknasIntervall', ar: 2025 });
        expect(bd('A', 10, { forraBokslut: bokslut(), kInstalld: 30 }).forra.lage).toBe('saknasIntervall');   // raden har 28
        expect(bd('A', 10, { forraBokslut: { ...bokslut(), basIntervall: undefined } }).forra).toEqual({ lage: 'saknasFalt', ar: 2025 });
    });
});

const rm = (k, val = {}) => vymodellRapport(underlag(), { k, golv: Math.max(k, 10), bas: BAS, lvPar: PAR, ...val });
const HP = { rader: [{ grupp: 'X', kostnad: 1200, underlag: 'prio' }, { grupp: 'Y', kostnad: 300, underlag: 'par' }, { grupp: 'Z', kostnad: null, underlag: '' }],
    skal: null, utanBelopp: 'utan belopp', kInstalld: 10, prio: 'prio', par: 'par' };
const ru = (k, val = {}) => vymodellRapportunderlag(underlag(), { k, golv: Math.max(k, 10), topN: 100, lv: { pairs: PAR, lagreKrav: [PAR[1]] }, hp: HP,
    kostnad: {}, basBedomning: 'Bedömning', ...val });

describe('[B2.11] Rapportmodellens vymodell', () => {
    it('sammanfattningen, BAS-intervallen som får redovisas och iakttagelsen om andelen kvinnor', () => {
        const vm = rm(10);
        expect(vm.sammanfattning).toMatchObject({ nKv: 62, nMa: 53, konOk: true });
        expect(vm.sammanfattning).toEqual(konsMedianer(underlag(), { k: 10 }));
        expect(vm.representation.visade.map(g => g.bas)).toEqual(['A', 'B', 'C']);
        expect(vm.representation.dolda).toEqual(['D', 'E']);
        expect(vm.representation.konLitet).toEqual(['C']);
        // C är lägst betalt och har 75 % kvinnor, B högst betalt med 50 %: mer än 15 procentenheter.
        expect([vm.representation.iakttagelse.topp.bas, vm.representation.iakttagelse.botten.bas]).toEqual(['B', 'C']);
        expect(rm(25).representation.iakttagelse).toBeNull();   // bara A och B redovisas, med samma andel
    });
    it('Lika arbetes grupper att bedöma, kandidatparen och översikten per BAS-intervall med status', () => {
        const vm = rm(10);
        expect(vm.lika).toMatchObject({ overskott: 0, sma: 2 });
        expect(vm.lika.grupper.map(g => g.bas)).toEqual(['A']);
        // Paret med Vaktmästare (sex personer) utelämnas; kandidatparens diagram följer då inte med.
        expect(vm.likvardigt).toMatchObject({ antal: 1, utelamnade: 1, allaParVisas: false });
        expect(vm.likvardigt.par.map(p => p.maAid)).toEqual(['100001']);
        expect(rm(10, { lvPar: [PAR[0]] }).likvardigt.allaParVisas).toBe(true);
        expect(vm.oversikt.map(o => [o.bas, o.skillnadKr, o.niva, o.direktiv])).toEqual([['A', -3000, 'granska', true], ['B', -500, 'balanserat', false]]);
    });
    it('högst 30 grupper och 25 par i tabellerna; överskottet räknas', () => {
        const grupper = Array.from({ length: 33 }, (_, i) => ({ bas: 'A', flaggad: true, i }));
        const par = Array.from({ length: 27 }, () => PAR[0]);
        const vm = rm(10, { lika: { grupper, utelamnade: [] }, lvPar: par });
        expect([vm.lika.grupper.length, vm.lika.overskott]).toEqual([30, 3]);
        expect([vm.likvardigt.par.length, vm.likvardigt.overskott]).toEqual([25, 2]);
    });
    it('regressionen: säkerställd och minst 3 %, stegen och BAS-effekterna efter k, regressionerna per BAS-intervall', () => {
        const reg = { konPct: -4, konPctLow: -6, konPctHigh: -2, steg: [], basEffekter: [{ bas: 'B', pct: 2 }, { bas: 'C', pct: 1 }], basRef: 'A', basN: { A: 30, B: 60, C: 8 },
            perBas: [{ bas: 'A', status: 'ok', gapPct: -9, pValue: 0.001 }, { bas: 'B', status: 'ok', gapPct: -1, pValue: 0.5 }, { bas: 'C', status: 'too_few' }] };
        const r = rm(10, { reg, basEffektNot: u => `utan ${u.join(', ')}` }).regression;
        expect(r.kritisk).toBe(true);
        expect(r.basEffekter).toMatchObject({ effekter: [{ bas: 'B' }], utelamnade: ['C'], not: 'utan C' });
        expect(r.perBas.map(pb => [pb.bas, pb.sakerstalld])).toEqual([['A', true], ['B', false]]);
        expect(rm(10, { reg: { ...reg, konPctHigh: 1 } }).regression.kritisk).toBe(false);
        expect(rm(10, { reg: { error: 'för få' } }).regression).toBeNull();
    });
    it('intervallen per BAS-intervall, bilagans gruppdossierer och det tabellerna per BAS-intervall utelämnar', () => {
        expect(rm(10).basintervall).toEqual({ kandidater: [{ bas: 'A', n: 30 }, { bas: 'B', n: 60 }, { bas: 'C', n: 16 }], utelamnade: ['D', 'E'] });
        const d = rapportDossierGrupper(gruppdossierGrupper(underlag(), 10), 10);
        expect(d.med.map(g => g.bas)).toEqual(['B', 'A']);
        expect(d.utan).toBe(1);   // Assistent: fyra män
        expect(perBasUtelamnat(perBasTabeller(underlag(), { k: 10 }))).toEqual({ basUtelamnade: ['D', 'E'], smaYrken: 0, konDolda: ['C'], medelDolda: ['C'] });
    });
});

describe('[B2.12] Rapportens urval', () => {
    it('ett färdigt urval följer sin gällande lista; null är hela dokumentationen utan bilagan', () => {
        expect(rapportUrvalAv(null)).toEqual({ ordning: [...RM_AVSNITT], med: RM_URVAL.hela.med, namn: 'Hela dokumentationen' });
        expect(rapportUrvalAv(rapportUrvalAttSpara('ledning'))).toMatchObject({ med: RM_URVAL.ledning.med, namn: 'Ledningsbrief' });
        expect(rapportUrvalAttSpara('hela')).toBeNull();
        expect(rapportUrvalAv({ ordning: [...RM_AVSNITT], med: [...RM_AVSNITT] }).namn).toBe('Alla avsnitt');
        expect(rapportUrvalAv({ ordning: [...RM_AVSNITT], med: [...RM_URVAL.facklig.med, 'dossierer'] }).namn).toBe('Facklig dialog + bilaga');
        expect(rapportUrvalAv({ ordning: [...RM_AVSNITT], med: ['lika'] }).namn).toBe(`Eget urval (1 av ${RM_AVSNITT.length} avsnitt)`);
    });
    it('en äldre fil: ett tidigare färdigt urval blir urvalet, ett nytt avsnitt sätts in mellan sina grannar', () => {
        const gammal = ['sammanfattning', 'regler', 'lika', 'likvardigt', 'struktur', 'referenser', 'perbas', 'atgarder', 'samverkan', 'beslut', 'regression', 'metod'];
        expect(rapportUrvalAttSpara({ ordning: gammal, med: gammal })).toBeNull();   // det tidigare färdiga urvalet hela
        expect(rapportUrvalAttSpara({ ordning: gammal, med: gammal.filter(id => !['atgarder', 'beslut'].includes(id)) })).toMatchObject({ fast: 'facklig' });
        const egen = rapportUrvalAv({ ordning: gammal, med: ['lika', 'okänt'] });
        expect(egen.ordning.slice(3, 6)).toEqual(['likvardigt', 'basintervall', 'struktur']);
        expect(egen.ordning.at(-1)).toBe('dossierer');
        expect(egen.med).toEqual(['lika']);
    });
    it('avsnitten numreras i urvalets ordning; egna tabeller och förra året följer sina grannar', () => {
        const finns = ['sammanfattning', 'perbas', 'atgarder', 'metod'].map(id => ({ id, rubrik: id, numrerad: id !== 'metod' }));
        const ut = rapportAvsnittIUrval(finns, { urval: { med: ['atgarder', 'perbas', 'metod'] }, egna: { id: 'egna', rubrik: 'egna', numrerad: true }, arsjamf: { id: 'arsjamforelse', rubrik: 'ar', numrerad: true } });
        expect(ut.map(a => a.rubrik)).toEqual(['1. atgarder', '2. ar', '3. perbas', '4. egna', 'metod']);
        expect(rapportAvsnittIUrval(finns, { urval: { med: ['sammanfattning'] }, egna: { id: 'egna', rubrik: 'egna' } }).map(a => a.id)).toEqual(['sammanfattning']);
        expect(arHelaDokumentationen({ avsnitt: finns }, { avsnitt: [...finns, { id: 'dossierer' }] })).toBe(true);
        expect(arHelaDokumentationen({ avsnitt: finns.slice(1) }, { avsnitt: finns })).toBe(false);
    });
});

describe('[B2.13] Rapportunderlagets vymodell', () => {
    it('blocken i ordning, ett block per flaggad grupp och per par som når k, handlingsplanens summor', () => {
        const vm = ru(10);
        expect(vm.block.map(b => b.id)).toEqual(['sammanfattning', 'uppdelning', 'lika', 'likvardigt', 'lagreKrav', 'struktur', 'sektorer', 'handlingsplan', 'yrke:0', 'par:0']);
        expect([vm.harPar, vm.exkluderade]).toEqual([true, 1]);
        expect(ru(25).block.some(b => /^(yrke|par):/.test(b.id))).toBe(false);
        expect(vymodellRapportunderlag([], { k: 10, golv: 10, topN: 100, hp: HP })).toEqual({ block: [], harPar: false, exkluderade: 0 });
    });
    it('handlingsplanens summor per underlag och lägre krav, högre lön utan par under k', () => {
        const vm = ru(10);
        const text = id => tillText(vm.block.find(b => b.id === id));
        expect(text('handlingsplan')).toMatch(/1\s500/);
        expect(text('lagreKrav')).toMatch(/1 par med en grupp under 10/);
    });
    it('kandidatparens diagram bara när det finns par och inget har uteslutits', () => {
        const lista = [{ id: 'a', flik: 'struktur' }, { id: 'b', flik: 'likvardighet' }];
        expect(rapportunderlagDiagram(lista, true, 0).map(g => g.id)).toEqual(['a', 'b']);
        expect(rapportunderlagDiagram(lista, true, 1).map(g => g.id)).toEqual(['a']);
        expect(rapportunderlagDiagram(lista, false, 0).map(g => g.id)).toEqual(['a']);
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
    it('Översikt: kvoten bara när båda könen når k; korten räknar bara intervall där båda könen gör det', () => {
        const n = oversiktNyckeltal(underlag(), k);
        if (n.kvotPct !== null) expect(Math.min(n.nKv, n.nMa)).toBeGreaterThanOrEqual(k);
        const vm = kravstatus(underlag(), { bas: BAS, k, golv: Math.max(k, 10), policyFor });
        expect(vm.jamforbara).toBe(k === 10 ? 2 : 1);
        expect(vm.referens.av).toBe(k === 10 ? 2 : 1);   // A (och C vid 10); D under k
        // Jämförelsestatistiken: bara grupper som når k, som Löneläget (jamforelseRader).
        const statistik = BAS.map((bas, i) => ({ aid: `10000${i + 1}`, bas, median: 30000 }));
        const st = kravstatus(underlag(), { bas: BAS, k, golv: Math.max(k, 10), statistik }).statistik;
        const lonelaget = jamforelseRader(underlag(), { statistik, k });
        expect(st.av).toBe(lonelaget.rader.length);
        expect(st.utelamnade).toBe(lonelaget.utelamnade.length);
    });

    it('Löneöversikten: ingen rad med färre än k, de utelämnade bara med namn', () => {
        const vm = vymodellLoneoversikt(underlag(), { bas: BAS, k, policyFor });
        for (const b of vm.block) for (const r of b.rader) expect(r.n, `${b.bas} ${r.kategori}`).toBeGreaterThanOrEqual(k);
        for (const b of vm.block) for (const u of b.utelamnade) expect(typeof u).toBe('string');
    });

    it('Gruppdossiern: grupperna når k, skillnaden och räkneexemplet bara när båda könen gör det, paren under k utelämnade', () => {
        for (const g of gruppdossierGrupper(underlag(), k)) {
            expect(g.rows.length).toBeGreaterThanOrEqual(k);
            const vm = vymodellGruppdossier(g, { k, par: PAR, kostnad: {} });
            if (vm.gap !== null) expect(Math.min(vm.nKv, vm.nMa)).toBeGreaterThanOrEqual(k);
            for (const p of [...vm.lvAsSubject, ...vm.lvAsComparator]) expect(Math.min(p.kvN, p.maN)).toBeGreaterThanOrEqual(k);
        }
    });

    it('BAS-dossiern: könens medianer, yrkesgruppernas, åldersgruppernas och förra årets bara där k nås', () => {
        for (const { bas } of basdossierIntervall(underlag(), BAS, k)) {
            const vm = vymodellBasdossier(underlag(), bas, { k, basIntervall: BAS, golv: Math.max(k, 10), harAlder: true,
                likvardighet: { pairs: PAR, lagreKrav: [] }, forraBokslut: { ar: 2025, k: 2, nyckeltal: { nKv: 0, nMa: 0 }, grupper: [],
                    basIntervall: [{ bas, n: 12, nKv: 6, nMa: 6, p10: 1, med: 2, p90: 3, medKv: 2, medMa: 2 }] } });
            expect(vm.n).toBeGreaterThanOrEqual(k);
            if (vm.konOk) expect(Math.min(vm.nKv, vm.nMa)).toBeGreaterThanOrEqual(k); else expect(harLonematt(vm)).toBe(false);
            for (const y of vm.yrken) {
                if (y.samlad) { expect(y.tot).toBeGreaterThanOrEqual(k); expect(y.medKv ?? y.medMa ?? y.kvotPct).toBeNull(); }
                else expect(Math.min(y.nKv, y.nMa)).toBeGreaterThanOrEqual(k);
            }
            for (const a of vm.alder) {
                if (a.med !== null) expect(a.n).toBeGreaterThanOrEqual(k);
                if (a.medKv !== null || a.medMa !== null) expect(Math.min(a.nKv, a.nMa)).toBeGreaterThanOrEqual(k);
            }
            for (const p of [...vm.par.kandidat, ...vm.par.hierarkiska]) expect(Math.min(p.kvN, p.maN)).toBeGreaterThanOrEqual(k);
            // Förra årets rad har tolv personer: den läses med den inställda tröskeln, inte filens.
            if (vm.forra.lage === 'ok') expect(vm.forra.rad.n.forra).toBeGreaterThanOrEqual(k);
            expect(vm.forra.lage).toBe(k === 10 ? 'ok' : 'saknasIntervall');
        }
    });
    it('Rapportmodellen och rapportunderlaget: grupper, par, intervall och dossierer bara där k nås', () => {
        const vm = rm(k);
        for (const g of vm.representation.visade) expect(g.n).toBeGreaterThanOrEqual(k);
        for (const g of vm.representation.visade.filter(x => !x.konLitet)) expect(Math.min(g.nKv, g.nMa)).toBeGreaterThanOrEqual(k);
        for (const g of vm.lika.grupper) expect(Math.min(g.nKv, g.nMa)).toBeGreaterThanOrEqual(k);
        for (const p of vm.likvardigt.par) expect(Math.min(p.kvN, p.maN)).toBeGreaterThanOrEqual(k);
        for (const o of vm.oversikt) expect(Math.min(o.nKv, o.nMa)).toBeGreaterThanOrEqual(k);
        for (const b of vm.basintervall.kandidater) expect(b.n).toBeGreaterThanOrEqual(k);
        for (const g of rapportDossierGrupper(gruppdossierGrupper(underlag(), k), k).med) {
            expect(g.rows.filter(r => r.kon === 'kvinna').length).toBeGreaterThanOrEqual(k);
            expect(g.rows.filter(r => r.kon === 'man').length).toBeGreaterThanOrEqual(k);
        }
        if (!vm.sammanfattning.konOk) expect(vm.sammanfattning.kvotPct).toBeNull();
        const block = ru(k).block;
        const lika = likaArbeteGrupper(underlag(), { k, golv: Math.max(k, 10) });
        expect(block.filter(b => b.id.startsWith('yrke:')).length).toBe(lika.grupper.filter(g => g.flaggad).length);
        for (const g of lika.grupper.filter(x => x.flaggad)) expect(Math.min(g.nKv, g.nMa)).toBeGreaterThanOrEqual(k);
        expect(block.filter(b => b.id.startsWith('par:')).length).toBe(PAR.filter(p => Math.min(p.kvN, p.maN) >= k).length);
    });
});

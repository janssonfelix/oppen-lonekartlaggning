// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
// Vymodellerna (ADR-99) prövade i Node, utan DOM och tillstånd: Lönestrukturs avsnitt per BAS-intervall
// (src/lib/vymodell-lonestruktur.js), fliken Lika arbete (src/lib/vymodell-lika-arbete.js), fliken Ålder & karriär
// (src/lib/vymodell-alder-karriar.js), kortet Var uppstår löneskillnaden? (src/lib/vymodell-var-uppstar-gapet.js),
// Översikt (src/lib/vymodell-oversikt.js), Löneöversikten (src/lib/vymodell-loneoversikt.js), dossiererna
// (src/lib/vymodell-gruppdossier.js, src/lib/vymodell-basdossier.js), rapportmodellen (src/lib/vymodell-rapport.js)
// och rapportunderlaget (src/lib/vymodell-rapportunderlag.js), regressionskortet (src/lib/vymodell-regressionskort.js)
// och livscykelanalysen (src/lib/vymodell-livscykel.js) med ett eget underlag med åldrar (regUnderlag nedan), Löneöversyn
// (src/lib/vymodell-loneoversyn.js; regressionen på regUnderlag), Löneläget mot ställningstagandet
// (src/lib/vymodell-lonepolitik.js), och fliken Likvärdigt arbete (src/lib/vymodell-likvardigt-arbete.js), med två
// kvinnodominerade grupper till:
//   BAS A  100006 Undersköterska  12 kvinnor, 2 män
//   BAS B  100007 Biträde          3 kvinnor
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
import { likvardighetsparUr, parAntal } from '../src/lib/likvardighet.js';
import { justeradSaknas, kandidatparRader, kompletteraDiagnostik, kvDomUnderK, likvardighetFelresultat, LV_STANDARD, lvParAntal, lvPoang, lvStatJamfor,
    parSakerhet, vymodellKravMotLon, vymodellLikvardigtArbete } from '../src/lib/vymodell-likvardigt-arbete.js';
import { forklaringsbudget, kvantilVymodell, perBasRegression, regressionKronor, sistaSteg, tillforlitlighet, trappaVisas,
    vymodellRegressionskort } from '../src/lib/vymodell-regressionskort.js';
import { livscykelBasRader, livscykelKurvaUtelamnad, livscykelMonster, vymodellLivscykel } from '../src/lib/vymodell-livscykel.js';
import { huvudregression } from '../src/lib/regression.js';
import { livscykelRegression } from '../src/lib/livscykel.js';
import { bhJustera } from '../src/lib/stat.js';
import { forslagskandidater, individlyftGrupper, kontrollvarningar, kostnadPerPott, kvDomAv, lageMotBas, lutningRader, lutningUrval, oforklaradSkattning,
    oforklaratForeEfter, rensaForeslagnaRader, riktadRadInfo, riktning, scenariojamforelse, forslagUrPotten, villkorsgrupper, scenarioUr, simuleradeRader, utfallsrader, utfallsvy,
    varavKvDom, vymodellIndividlyft, vymodellKanslighet, vymodellPrognos, vymodellTroskelmal } from '../src/lib/vymodell-loneoversyn.js';
import { bandkarta, konLagenSumma, lageISpannet, tabellblock, tackningsstatus, vymodellLonepolitik } from '../src/lib/vymodell-lonepolitik.js';
import { prognosutfall } from '../src/lib/loneoversyn.js';
import { ickeTom } from './helpers/paastaende.js';

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
const lvUnderlag = () => [...underlag(), ...flera('100006 Undersköterska', 'A', 'kvinna', 12, 26000), ...flera('100006 Undersköterska', 'A', 'man', 2, 26000),
    ...flera('100007 Biträde', 'B', 'kvinna', 3, 30000)];
const lvRes = (opts = {}) => likvardighetsparUr({ data: lvUnderlag(), opts: { k: 10, topN: 20, ...opts } });
const lv = (res = lvRes(), val = {}) => vymodellLikvardigtArbete(res, { harData: true, harStatistik: false, installningar: LV_STANDARD, definition: 'do', jamforelse: 'alla', ...val });
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
        expect(a.underlag).toMatchObject({ bas: 'A' });
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
        expect(skillnad.utelamnade).toEqual(['D', 'E']);   // D har bara en man, men räknas och står i noten som de andra
        expect(skillnad.samlade).toEqual(['C']);
        expect(skillnad.maskerade).toBe(3);
        // 40 kvinnor och ingen man: intervallet räknas och sägs i noten, också på skärmen (k = 1).
        const ettKon = vymodellLonestruktur(flera('100001 Handläggare', 'X', 'kvinna', 40, 30000), { bas: ['X'], k: 1, golv: 10, litetUnderlag: 5 }).skillnad;
        expect([ettKon.samlade, ettKon.maskerade]).toEqual([['X'], 1]);
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
    it('raden i klartext följer talens riktning: lutning över, under och lika med noll; kvinnor före och efter män', () => {
        const MINUS = '\u2212';
        expect(alderInsiktText(200, 220, 95, 95.5)).toMatch(/^Lönen stiger .*\(\+200\s?kr\)/);
        expect(alderInsiktText(-120, -130, 95, 95.5)).toMatch(new RegExp(`^Lönen sjunker .*\\(${MINUS}120\\skr\\)`));
        expect(alderInsiktText(0, 0, 95, 95.5)).toMatch(/^Lönen ändras .*\(0\skr\)/);
        expect(alderInsiktText(-120, 300, 95, 95.5)).toMatch(new RegExp(`^Lönen ändras olika med åldern för kvinnor \\(${MINUS}120\\skr per år\\)`));
        expect(alderInsiktText(-0.4, 300, 95, 95.5)).toContain('(0\u00a0kr per år)');                 // inget «−0 kr»
        // Avståndet till lika lön: kvinnor före män (105 → 103) är också en mindre skillnad.
        expect(alderInsiktText(100, 100, 105, 103)).toMatch(/förklarar en del av skillnaden\./);
        expect(alderInsiktText(100, 100, 103, 105)).toMatch(/blir större när åldern räknas bort\./);
        expect(alderInsiktText(100, 100, 96, 94)).not.toMatch(/äldre/);   // orsaken är inte känd för raden
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

describe('Ålder & karriär: varje person med ålder hamnar i en grupp, och ett köns trendlinje stannar inom könets åldrar', () => {
    // Decimalåldrar, åldrar under 20 och över 65: 30 kvinnor och 30 män.
    const blandat = () => Array.from({ length: 60 }, (_, i) => ({ bas: 'A', kon: Math.floor(i / 10) % 2 ? 'man' : 'kvinna', lon: 30000 + 100 * i,
        alder: [17, 19.5, 24.5, 29.5, 33, 39.5, 49.9, 59.5, 64.5, 70][i % 10] }));
    it('summan av åldersgruppernas antal är antalet personer med ålder', () => {
        const rader = blandat(), kv = rader.filter(r => r.kon === 'kvinna'), ma = rader.filter(r => r.kon === 'man');
        const { visade } = alderGapRader(kv, ma, 1);
        expect(visade.reduce((s, g) => s + g.nKv + g.nMa, 0)).toBe(60);
    });
    it('summan av åldersklassernas andelar är 100 % per kön', () => {
        const s = vymodellAldersstruktur(blandat(), { bas: '__ALLA__', k: 1, alla: blandat() });
        expect(s.pctKv.reduce((a, b) => a + b, 0) + s.pctMa.reduce((a, b) => a + b, 0)).toBeCloseTo(100, 6);
    });
    it('kvinnornas konfidensband går över kvinnornas åldrar, männens över männens', () => {
        const rader = [...aRad('A', 'kvinna', 16, 30000, 25), ...aRad('A', 'man', 16, 32000, 39)];
        const vm = vymodellAlderOchLon(rader, { bas: '__ALLA__', k: 10 });
        expect([vm.ciKv[0].x, vm.ciKv[vm.ciKv.length - 1].x]).toEqual([25, 40]);
        expect([vm.ciMa[0].x, vm.ciMa[vm.ciMa.length - 1].x]).toEqual([39, 54]);
        expect([vm.spannKv, vm.spannMa]).toEqual([[25, 40], [39, 54]]);
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
    it('ojämn könsfördelning bedöms på talet som visas: 39,96 % kvinnor visas 40,0 % och är jämn i kortet och tabellen', () => {
        const rader = [...flera('100001 Handläggare', 'X', 'kvinna', 999, 30000), ...flera('100001 Handläggare', 'X', 'man', 1501, 30000)];
        const rad = vymodellLonestruktur(rader, { bas: ['X'], k: 10, golv: 10, litetUnderlag: 5 }).konsfordelning.rader[0];
        expect([rad.pctKv, rad.underrepresenterat]).toEqual([40, null]);
        expect(kravstatus(rader, { bas: ['X'], k: 10, golv: 10 }).skev.antal).toBe(0);
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

describe('[B5.11] Likvärdigt arbetes vymodell', () => {
    it('jämförelsen, antalen, det största paret och om inställningarna är anpassade', () => {
        const res = lvRes(), vm = lv(res);
        expect(vm).toMatchObject({ poang: false, orgOk: true, internOk: true, statOk: false, jamforOk: true, visaAlla: false, anpassat: false });
        expect(res.pairs.map(p => [p.kvAid, p.maAid])).toEqual(expect.arrayContaining([['100006', '100001'], ['100007', '100002']]));
        expect(vm.antal).toEqual(parAntal(res.pairs));
        expect(vm.antalAttJamfora).toBe(res.orgIckeKv.length);
        const storst = res.pairs.reduce((a, p) => (p.gapPct > a.gapPct ? p : a));
        expect(vm.storst.par).toBe(storst);
        expect(vm.storst.kvotPct).toBeCloseTo(storst.kvMedian / storst.maMedian * 100, 9);
        // Visa max: tabellen har färre par än alla.
        expect(lv(lvRes({ topN: 1 })).visaAlla).toBe(true);
        expect(lv(res, { installningar: { ...LV_STANDARD, minGapPct: 5 } }).anpassat).toBe(true);
        expect(lv(res, { jamforelse: 'mansdominerade' }).anpassat).toBe(true);
        // Utan lönefil, och utan jämförelsekälla.
        expect(lv(res, { harData: false })).toMatchObject({ orgOk: false, jamforOk: false });
        const utanPar = likvardighetsparUr({ data: underlag().filter(r => r.bas === 'C'), opts: { k: 10 } });   // bara Assistent, kvinnodominerad
        expect(lv(utanPar)).toMatchObject({ orgOk: true, internOk: false, jamforOk: false, storst: null });
    });

    it('poängläget och jämförelsestatistiken: i poängläget används statistiken inte', () => {
        const res = { ...lvRes(), statIckeKv: [{ aid: '200001' }] };
        expect(lvStatJamfor(res)).toEqual([{ aid: '200001' }]);
        expect(lv(res, { harStatistik: true })).toMatchObject({ statOk: true, antalAttJamfora: res.orgIckeKv.length + 1 });
        const poang = { ...res, diagnostik: { ...res.diagnostik, jämförelse: { ...res.diagnostik.jämförelse, kravProxy: 'poäng' } } };
        expect(lvPoang(poang)).toBe(true);
        expect(lvStatJamfor(poang)).toEqual([]);
        expect(lv(poang, { harStatistik: true }).statOk).toBe(false);
    });

    it('parens säkerhet, den åldersjusterade skillnaden och antalen ur paren när räkningen saknas', () => {
        expect(parSakerhet({ gapCI: { lo: 1, hi: 5 } })).toBe('saker');
        expect(parSakerhet({ gapCI: { lo: 0, hi: 5 } })).toBe('slumpfel');
        expect(parSakerhet({ gapCI: { lo: null } })).toBeNull();
        expect(parSakerhet({})).toBeNull();
        expect(justeradSaknas({ jamforKalla: 'intern', aldersJusterad: { gapPct: 3 } })).toBeNull();
        expect(justeradSaknas({ jamforKalla: 'intern', aldersJusterad: null })).toBe('underlag');
        expect(justeradSaknas({ jamforKalla: 'extern' })).toBe('extern');
        const res = lvRes();
        expect(lvParAntal({ pairs: res.pairs })).toEqual(parAntal(res.pairs));
        expect(lvParAntal(res)).toBe(res.parAntal);
    });

    it('felresultatet och flikens diagnostik', () => {
        const fel = likvardighetFelresultat({ antalRader: 7, antalStatistik: 2, poang: true, opts: { topN: 20 } });
        kompletteraDiagnostik(fel, { harLokalKonsdata: false, fel: ['trasig'] });
        expect(fel).toMatchObject({ pairs: [], diagnostik: { organisation: { totalRader: 7, kvDomFunna: 0, exempelKvDom: [] },
            statistik: { totalRader: 2, harLokalKonsdata: false, exempelIckeKv: [] }, jämförelse: { kravProxy: 'poäng' }, fel: ['trasig'] }, opts: { topN: 20 } });
        expect(lv(fel)).toMatchObject({ orgOk: false, jamforOk: false, antal: { totalt: 0 }, storst: null });
        const res = kompletteraDiagnostik(lvRes(), { harLokalKonsdata: true, fel: [] });
        expect(res.diagnostik.organisation.exempelKvDom).toHaveLength(3);
        expect(res.diagnostik.organisation.exempelKvDom[0]).toMatch(/^\d{6} \(.+\) BAS [A-E] n=\d+$/);
    });

    it('raderna i diagrammet över kandidatparen: de allvarligaste först, ett par per namn, bara med båda medianerna', () => {
        const par = [{ kvLabel: 'a', maLabel: 'x', allvarsindex: 1, kvMedian: 1, maMedian: 2 }, { kvLabel: 'b', maLabel: 'x', allvarsindex: 3, kvMedian: 1, maMedian: 2 },
            { kvLabel: 'b', maLabel: 'x', allvarsindex: 2, kvMedian: 1, maMedian: 2 }, { kvLabel: 'c', maLabel: 'x', allvarsindex: 5, kvMedian: NaN, maMedian: 2 }];
        const rader = kandidatparRader(par, p => `${p.kvLabel} mot ${p.maLabel}`);
        expect(rader.map(r => [r.y, r.p.allvarsindex])).toEqual([['b mot x', 3], ['a mot x', 1]]);
        expect(kandidatparRader(par, p => p.kvLabel, 2).map(r => r.y)).toEqual(['b']);
    });
    it('kandidatparen: samma namn i olika BAS-intervall är olika par och får intervallen i namnet', () => {
        const par = [{ kvLabel: 'a', maLabel: 'x', kvBas: 'C', maBas: 'C', allvarsindex: 3, kvMedian: 1, maMedian: 2 },
            { kvLabel: 'a', maLabel: 'x', kvBas: 'D', maBas: 'E', allvarsindex: 2, kvMedian: 1, maMedian: 2 },
            { kvLabel: 'b', maLabel: 'x', kvBas: 'C', maBas: 'C', allvarsindex: 1, kvMedian: 1, maMedian: 2 }];
        expect(kandidatparRader(par, p => `${p.kvLabel} mot ${p.maLabel}`).map(r => r.y))
            .toEqual(['a mot x (BAS C)', 'a mot x (BAS D mot E)', 'b mot x']);
    });
});

describe('[B5.12] Diagrammet Krav mot lön', () => {
    it('grupper med minst k, nivån per BAS-intervall, avståndet och de kvinnodominerade under nivån med namn', () => {
        const vm = vymodellKravMotLon(lvUnderlag(), { k: 10 });
        expect(vm).toMatchObject({ forFa: false, medPoang: false, basOrdning: ['A', 'B', 'C'], antalUnder: 1, uppskattade: 0, utanPlats: [] });
        expect(vm.punkter.map(p => [p.aid, p.n, p.avstand, p.etikett]).sort()).toEqual([
            ['100001', 30, 2875, false], ['100002', 60, 0, false], ['100003', 16, 0, false], ['100006', 14, -2875, true]]);
        // Nivån i A är medianen av gruppmedianerna 32 200 och 26 450.
        expect(vm.linje).toEqual([{ bas: 'A', y: 29325 }, { bas: 'B', y: 41700 }, { bas: 'C', y: 28600 }]);
        expect(vm.punkter.some(p => p.forskjutning)).toBe(false);   // grupperna i A ligger långt isär
        expect(vymodellKravMotLon(lvUnderlag(), { k: 25 })).toEqual({ forFa: true });
    });
    it('med poäng: en rät linje, och en grupp utan poäng efter sitt BAS-intervall', () => {
        const poangByKey = new Map([['100001|A', 200], ['100006|A', 100], ['100002|B', 300]]);
        const vm = vymodellKravMotLon(lvUnderlag(), { k: 10, poangByKey });
        expect(vm.medPoang).toBe(true);
        expect(vm.utanPlats.map(g => g.aid)).toEqual(['100003']);   // ingen värderad grupp i C
        expect(vm.linje.map(l => l.x)).toEqual([100, 300]);
        expect(vm.punkter.every(p => !p.forskjutning)).toBe(true);
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
    it('yrkesgrupperna är AID-koden inom BAS (ADR-89): två texter för samma kod är en rad, med texten som står på flest', () => {
        const rader = [...flera('100001 Handläggare', 'A', 'kvinna', 8, 30000), ...flera('100001 Handläggare, natt', 'A', 'man', 4, 31000)];
        const yrken = vymodellLoneoversikt(rader, { bas: ['A'], k: 4 }).block[0].rader.slice(3);
        expect(yrken.map(r => [r.kategori, r.n])).toEqual([['100001 Handläggare', 12]]);
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
        // Samma signal som fliken, Excel och protokollet: q-värdet efter korrigeringen för många tester. A har p = 0,04
        // men q = 0,08 med två intervall prövade, och är inte säkerställd.
        const tva = [{ bas: 'A', status: 'ok', gapPct: -4, pValue: 0.04 }, { bas: 'B', status: 'ok', gapPct: -4, pValue: 0.6 }];
        expect(rm(10, { reg: { ...reg, perBas: tva } }).regression.perBas.map(pb => [pb.bas, pb.sakerstalld])).toEqual([['A', false], ['B', false]]);
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

// Regressionskortet och livscykeln: ett påhittat underlag med åldrar 24–68 (regressionen behöver spridning).
//   BAS A  30 kvinnor, 30 män (60)   BAS B  20 kvinnor, 12 män (32)   BAS C  12 kvinnor, 3 män (15)   BAS D  4 kvinnor, 2 män (6)
// Vid k = 10 är D under tröskeln, vid k = 25 också C. Med `fa` har männen 3, 2, 1 och 1 (sju män): under k = 10.
const regRad = (bas, kon, n, lon, a0) => Array.from({ length: n }, (_, i) => {
    const alder = a0 + (i * 7) % 38;
    return { yrke: `20000${'ABCD'.indexOf(bas) + 1} Handläggare`, aid: `20000${'ABCD'.indexOf(bas) + 1}`, yrkeLabel: 'Handläggare', bas, kon, alder,
        lon: lon + 90 * i + (i % 4) * 230 + alder * 40 };
});
const regUnderlag = ({ fa = false } = {}) => [
    ...regRad('A', 'kvinna', 30, 30000, 24), ...regRad('A', 'man', fa ? 3 : 30, 31500, 25),
    ...regRad('B', 'kvinna', 20, 36000, 26), ...regRad('B', 'man', fa ? 2 : 12, 37500, 27),
    ...regRad('C', 'kvinna', 12, 42000, 28), ...regRad('C', 'man', fa ? 1 : 3, 43000, 29),
    ...regRad('D', 'kvinna', 4, 47000, 30), ...regRad('D', 'man', fa ? 1 : 2, 48000, 31)];
const reg = (rader, k) => huvudregression(rader, { medAlder: true, kInstalld: k, golv: Math.max(k, 10) });
const rk = (k, val = {}) => {
    const rader = regUnderlag(val);
    return { rader, r: reg(rader, k), vm: vymodellRegressionskort(reg(rader, k), { k, rader, medAlder: true, basEffektNot: u => `utelämnade: ${u.join(', ')}` }) };
};
const lc = (k, fixBas = null) => {
    const rader = regUnderlag();
    const res = livscykelRegression(rader, { fixBas, golv: Math.max(k, 10) });
    return { res, vm: vymodellLivscykel(res, { rader, k, huvud: reg(rader, k) }) };
};

describe('[B3.12] Regressionskortets vymodell', () => {
    it('ingen vymodell när regressionen inte kunde skattas', () => {
        expect(vymodellRegressionskort({ error: 'x' }, { k: 10, rader: [], medAlder: true, basEffektNot: () => '' })).toBeNull();
    });
    it('stegen, förklaringsbudgeten och trappan när båda könen når k', () => {
        const { r, vm } = rk(10);
        expect(vm.stegUt.utelamnat).toBe(false);
        expect(vm.seqOk.map(s => s.name)).toEqual(['Endast kön', '+ BAS-intervall', '+ Ålder']);
        expect(vm.sista).toBe('+ Ålder');
        expect(vm.visaSteg && vm.trappa).toBe(true);
        expect(vm.stegMax).toBe(Math.max(...vm.stegIKortet.map(x => Math.abs(x.gapPct))));
        expect(vm.yrkeVisas).toBe(r.yrkesSteg?.status === 'ok');
        expect(vm.budget).toEqual(forklaringsbudget(vm.stegIKortet));
        expect(vm.budgetMedYrke).toBe(vm.yrkeVisas);
    });
    it('kronexemplet och andelen av kvinnornas samlade årslön', () => {
        const { r, vm, rader } = rk(10);
        expect(vm.konOk).toBe(true);
        expect(vm.kronor).toEqual(regressionKronor(r));
        const summa = rader.filter(d => d.kon === 'kvinna').reduce((a, d) => a + d.lon, 0) * 12;
        expect(vm.andelAvLonesumma).toBeCloseTo(Math.abs(vm.kronor.krTotalYear) / summa * 100, 10);
        expect(regressionKronor({ konPct: -5, medianMa: 40000, nKvAnalysed: 10 })).toMatchObject({ refKvinna: 38000, krMonth: 2000, krYear: 24000, krTotalYear: 240000 });
        expect(regressionKronor({ konPct: -5, medianMa: 0 })).toBeNull();
        expect(regressionKronor({ konPct: NaN, medianMa: 40000 })).toBeNull();
        expect(regressionKronor(null)).toBeNull();
    });
    it('förklaringsbudgeten: varje steg får det det tar bort, och delarna och resten summerar till hela gapet', () => {
        const b = forklaringsbudget([{ name: 'Endast kön', gapPct: -10, status: 'ok' }, { name: '+ BAS-intervall', gapPct: -6, status: 'ok' },
            { name: '+ Ålder', gapPct: -4, status: 'ok' }]);
        expect([b.g0, b.remaining, b.anyNegative]).toEqual([10, 4, false]);
        expect(b.parts.map(p => p.key)).toEqual(['bas', 'alder']);
        expect(b.parts[0].val).toBeCloseTo(4, 6);
        expect(b.parts[1].val).toBeCloseTo(2, 6);
        expect(b.parts.reduce((s, p) => s + p.share, 0) + b.remainingShare).toBeCloseTo(100, 6);
        // Stegen tas som de kommer: utan BAS-steget går ålderns del från Endast kön.
        const utanBas = forklaringsbudget([{ name: 'Endast kön', status: 'ok', gapPct: -6 }, { name: '+ Ålder', status: 'ok', gapPct: -4 }]);
        expect(utanBas.parts.map(p => p.key)).toEqual(['alder']);
        expect(utanBas.parts[0].val).toBeCloseTo(2, 10);
        expect(utanBas.remaining).toBe(4);
    });
    it('förklaringsbudgeten flaggar en kontroll som ökar gapet, och den delen ritas inte som stapel', () => {
        const b = forklaringsbudget([{ name: 'Endast kön', gapPct: -4, status: 'ok' }, { name: '+ BAS-intervall', gapPct: -7, status: 'ok' },
            { name: '+ Ålder', gapPct: -6, status: 'ok' }]);
        expect(b.anyNegative).toBe(true);
        expect(b.parts[0].val).toBeLessThan(0);
        expect(b.parts[0].share).toBe(0);
    });
    it('slutsatsen: titta från storleksgränsen 3 %, dokumentera under den, ingen utan säkerställd skillnad', () => {
        const { r } = rk(10);
        const niva = (konPct, pValue) => vymodellRegressionskort({ ...r, konPct, pValue }, { k: 10, rader: [], medAlder: true, basEffektNot: () => '' }).niva;
        expect([niva(-3, 0.01), niva(-2.99, 0.01), niva(-8, 0.05), niva(3.2, 0.049)]).toEqual(['titta', 'dokumentera', 'ingen', 'titta']);
    });
    it('ansvarsraden bara när ansvarssteget kunde skattas och huvudtalets sista steg visas', () => {
        const { r } = rk(10);
        const vm = a => vymodellRegressionskort({ ...r, ansvarSteg: a }, { k: 10, rader: [], medAlder: true, basEffektNot: () => '' }).ansvar;
        expect(vm({ status: 'ok', gapPct: -1.2 })).toEqual({ fore: r.sequential.find(x => x.name === '+ Ålder').gapPct, efter: -1.2 });
        expect(vm({ status: 'too_few' })).toBeNull();
        expect(sistaSteg({ bas: true, alder: false, yrkesgrupp: false })).toBe('+ BAS-intervall');
        expect(sistaSteg({ bas: false, alder: false, yrkesgrupp: false })).toBe('Endast kön');
        expect(sistaSteg({ bas: true, alder: true, yrkesgrupp: true })).toBe('+ Yrkesgrupp');
    });
    it('per BAS-intervall: q-värdet över de skattade intervallen och signalen kräver både p och q', () => {
        const perBas = [{ bas: 'A', status: 'ok', gapPct: -4, pValue: 0.04 }, { bas: 'B', status: 'ok', gapPct: -2, pValue: 0.001 },
            { bas: 'C', status: 'ok', gapPct: -6, pValue: 0.03 }, { bas: 'D', status: 'too_few', kvN: 2, maN: 1 }];
        const ut = perBasRegression(perBas);
        const q = bhJustera([0.04, 0.001, 0.03]);
        expect(ut.antalTester).toBe(3);
        expect(ut.qPerBas).toEqual({ A: q[0], B: q[1], C: q[2] });
        expect(ut.rader.map(p => p.niva)).toEqual(['titta', 'dokumentera', 'titta', undefined]);
        expect(perBasRegression([{ bas: 'A', status: 'ok', gapPct: -4, pValue: 0.04 }, { bas: 'B', status: 'ok', gapPct: -4, pValue: 0.6 }]).rader
            .map(p => [p.niva, p.ejEfterKorrigering])).toEqual([['osakert', true], ['inget', false]]);
        expect(rk(10).vm.perBas.antalTester).toBe(2);   // A och B; C och D har för få män
    });
    it('BAS-effekterna: intervall under k utelämnas och namnges i noten', () => {
        expect(rk(10).vm.basEffekter).toMatchObject({ utelamnade: ['D'], not: 'utelämnade: D' });
        expect(rk(25).vm.basEffekter.effekter.map(e => e.bas)).toEqual(['B']);
    });
    it('varningarna om ett begränsat underlag följer verktygets gränser', () => {
        const t = tillforlitlighet({ n: 49, k: 4, konPctLow: -8, konPctHigh: 2.5, nKvAnalysed: 40, nMaAnalysed: 9 });
        expect(t).toMatchObject({ litetUrval: true, faObsPerParam: true, brettKi: true, svagKontrast: true });
        expect(tillforlitlighet({ n: 60, k: 4, konPctLow: -8, konPctHigh: 2, nKvAnalysed: 30, nMaAnalysed: 30 }))
            .toMatchObject({ litetUrval: false, faObsPerParam: false, brettKi: false, svagKontrast: false });
    });
    it('gapet längs lönefördelningen: tolkningen bara när intervallet för P90 − P10 utesluter noll', () => {
        const qr = (ki, kiUtelamnad = '') => ({ results: [{ tau: 0.1, konPct: -2 }, { tau: 0.5, konPct: -3 }, { tau: 0.9, konPct: -6 }], diff: { varde: -4, ki }, kiUtelamnad });
        expect(kvantilVymodell(qr({ lag: -7, hog: -1 })).tolkning).toBe('glastak');
        expect(kvantilVymodell(qr({ lag: 1, hog: 3 })).tolkning).toBe('golv');
        expect(kvantilVymodell(qr({ lag: -3, hog: 2 })).tolkning).toBe('ingen');
        expect(kvantilVymodell(qr(null, 'för många')).tolkning).toBe('utanIntervall');
        expect(kvantilVymodell(qr(null)).tolkning).toBeNull();
        expect(kvantilVymodell({ results: [{ tau: 0.1, konPct: -2 }, { tau: 0.5, error: true }], diff: null }).visas).toBe(false);
        expect(kvantilVymodell(null).visas).toBe(false);
        expect(kvantilVymodell(qr(null)).ejKonvergerat).toEqual([]);
        const ejKonv = { results: [{ tau: 0.1, konPct: -2, konvergerat: false }, { tau: 0.5, konPct: -3, konvergerat: true }, { tau: 0.9, konPct: -6, konvergerat: false }], diff: { varde: -4, ki: null } };
        expect(kvantilVymodell(ejKonv).ejKonvergerat).toEqual([0.1, 0.9]);
    });
    it('[R1] ett kön under k: inget ojusterat steg, ingen förklarad andel, budget, trappa eller kronexempel', () => {
        const { r, vm } = rk(10, { fa: true });
        expect(r.nMaAnalysed).toBe(7);
        expect(vm.stegUt.utelamnat).toBe(true);
        expect(vm.stegUt.explainedShare).toBeNull();
        expect(vm.seqOk.some(s => s.name === 'Endast kön')).toBe(false);
        expect([vm.budget, vm.kronor, vm.andelAvLonesumma, vm.konOk, vm.trappa]).toEqual([null, null, null, false, false]);
        expect(vm.visaSteg).toBe(true);   // de justerade stegen står kvar
        expect(trappaVisas(null)).toBe(false);
    });
});

describe('[B3.13] Livscykelns vymodell', () => {
    it('modellens lönenivåer per BAS-intervall ur BAS-koefficienten, med n ur hela underlaget', () => {
        const { res, vm } = lc(10);
        expect(vm.basRader).toEqual(livscykelBasRader(res, regUnderlag()));
        // Nivåerna vid spannets ändar, där båda könen har personer.
        const b = vm.basRader.find(x => x.bas === 'B'), vid = (pred, a) => pred.find(p => p.age === a).lon;
        expect(b.n).toBe(32);
        expect(b.kvFran).toBeCloseTo(vid(res.predKvinna, res.alderFran) * res.basFaktor.B, 8);
        expect(b.maTill).toBeCloseTo(vid(res.predMan, res.alderTill) * res.basFaktor.B, 8);
        expect(b.gapFranKr).toBeCloseTo(b.kvFran - b.maFran, 8);
        expect([vm.kvotFran, vm.kvotTill]).toEqual([100 + res.gapFran, 100 + res.gapTill]);
        expect(vm.livscykelGapPct).toBeCloseTo((Math.exp(res.kvCoef) - 1) * 100, 10);
    });
    it('intervall under k utelämnas ur tabellen, och kurvan för ett valt intervall under k visas inte', () => {
        expect(lc(10).vm.utelamnade).toEqual(['D']);
        expect(lc(25).vm.utelamnade).toEqual(['C', 'D']);
        expect(lc(10, 'D').vm.kurvaUtelamnad).toBe(true);
        expect(lc(10, 'C').vm.kurvaUtelamnad).toBe(false);
        expect(lc(25, 'C').vm.kurvaUtelamnad).toBe(true);
        expect(livscykelKurvaUtelamnad({ fixBas: 'X' }, [{ bas: 'A', n: 1 }], 10)).toBe(false);
    });
    it('mönstret över karriären: konstant utan säkerställt samspel, annars växande, krympande eller praktiskt konstant vid ±2', () => {
        const m = (gapTill, p = 0.05, gapFran = 0) => livscykelMonster({ gapFran, gapTill, kvAgePVal: p, kvAge2PVal: 0.5 });
        expect([m(-5, 0.10), m(-2.01), m(-2), m(2.01), m(2)]).toEqual(['konstant', 'växande', 'praktiskt konstant', 'växande', 'praktiskt konstant']);
        // Skillnaden mäts som avståndet till lika lön: kvinnorna före män åt båda håll, och kvinnorna efter.
        expect([m(-10, 0.05, -5), m(-2, 0.05, -5), m(10, 0.05, 5), m(2, 0.05, 5)]).toEqual(['växande', 'krympande', 'växande', 'krympande']);
    });
    it('jämförelsen med huvudmodellen: tillskottet i justerat R² och om urvalen är desamma', () => {
        const { res, vm } = lc(10);
        const h = reg(regUnderlag(), 10);
        expect(vm.huvud).toMatchObject({ adjR2: h.adjR2, gapPct: h.konPct, p: h.pValue, n: h.n });
        expect(vm.adjR2Delta).toBeCloseTo((res.adjR2 - h.adjR2) * 100, 10);
        expect(vm.sammaUrval).toBe(true);
        const mer = d => vymodellLivscykel({ ...res, adjR2: h.adjR2 + d / 100 }, { rader: [], k: 10, huvud: h }).mervarde;
        expect([mer(0.99), mer(1.01), mer(2.99), mer(3.01)]).toEqual(['liten', 'måttlig', 'måttlig', 'stor']);
        const utan = vymodellLivscykel(res, { rader: [], k: 10, huvud: { error: 'x' } });
        expect([utan.huvud, utan.adjR2Delta, utan.mervarde, utan.sammaUrval]).toEqual([null, null, null, true]);
        expect(vymodellLivscykel(res, { rader: [], k: 10, huvud: { ...h, nMaAnalysed: h.nMaAnalysed - 1 } }).sammaUrval).toBe(false);
    });
});

// Invarianten på vymodellerna: inget lönemått för en grupp eller ett kön under tröskeln, vid 10 och 25.
// Löneöversyn: kostnadsvalen (12 månader, PO 40 %, kvinnodominerat över 60 %) och en prognos med en pott på 200 000 kr
// och ett generellt påslag på 2 %, som state.forecast.
const KOSTNADSVAL = { months: 12, poPct: 40, roundStep: 0, kvThreshold: 60, kvDefinition: 'do' };
const prognos = (extra = {}) => ({ budget: { mode: 'kr', value: 200000 }, generell: { mode: 'pct', value: 2 }, targets: [], roundStep: 0, years: 1, ...extra });
const regval = k => ({ medAlder: true, kInstalld: k, golv: Math.max(k, 10) });
const lo = (k, extra = {}, rader = underlag()) => vymodellPrognos(rader, { forecast: prognos(extra), kostnadsval: KOSTNADSVAL, k, regval: regval(k) });
const RIKTAD_A = { bas: 'A', aid: '*', kon: 'kvinna', mode: 'pct', value: 3, dist: 'flat', targetLevel: 'median', pool: 'equity' };

describe('[B7.13] Löneöversyns vymodell', () => {
    it('utfallet: prognosutfall, lönerna efter, mätaren och kontrollerna', () => {
        const vm = lo(10);
        expect(vm.out).toEqual(prognosutfall(underlag(), prognos().budget, prognos().generell, [], KOSTNADSVAL));
        expect(vm.sim.map(r => r.lon)).toEqual(vm.out.alloc.perPerson.map(p => p.nyLon));
        expect(vm.anvandPct).toBeCloseTo(100 * vm.out.använt / 200000, 9);
        expect(vm.matare).toBe('ok');
        expect(lo(10, { budget: { mode: 'kr', value: 100 } }).matare).toBe('over');
        expect(vm.tomt).toBe(false);
        expect(lo(10, { budget: { mode: 'kr', value: null }, generell: { mode: 'pct', value: null } }).tomt).toBe(true);
        expect(kontrollvarningar(underlag(), prognos({ budget: { mode: 'pct', value: 60 }, generell: { mode: 'pct', value: -1 },
            targets: [{ bas: 'X', aid: '*', mode: 'kr', value: null }] }))).toEqual(['hogBudget', 'negativtGenerellt', 'radUtanBelopp', 'radUtanTraff']);
    });
    it('utfallets rader: grupper under k maskeras och står samlade, och den minsta visade viks in tills de samlade når k', () => {
        const vm = lo(10);
        // D (3) och E (6) är under 10 och har tillsammans 9: C (16), den minsta visade, viks in.
        expect(vm.tabell.map(t => [t.g.bas, t.maskerad, t.underK])).toEqual([['B', false, false], ['A', false, false], ['C', true, false], ['D', true, true], ['E', true, true]]);
        expect(vm.utfall.invikta.map(g => g.bas)).toEqual(['C']);
        expect(vm.utfall.samlad).toEqual({ antalGrupper: 3, n: 25, kostnad: 14498 });
        expect(vm.rader.reduce((s, g) => s + g.kostnad, 0)).toBeCloseTo(vm.out.använt, 6);
        // Alla grupper tillsammans under k: ingen kostnad per grupp.
        expect(utfallsrader([{ bas: 'A', aid: '1', n: 3, kostnad: 10 }, { bas: 'B', aid: '2', n: 4, kostnad: 20 }], 10).samlad).toEqual({ antalGrupper: 2, n: 7, kostnad: null });
        // På skärmen (k = 1) maskeras inget.
        expect(lo(1).tabell.every(t => !t.maskerad)).toBe(true);
    });
    it('andelen till kvinnodominerade grupper: ett streck när den ger en del av den samlade kostnaden', () => {
        const kvDom = kvDomAv(KOSTNADSVAL);
        // De maskerade C (75 % kvinnor), D och E: C är kvinnodominerad med 16, de övriga 9 < 10.
        expect(lo(10).varavKvDom).toBeNull();
        expect(lo(1).varavKvDom).toBe(lo(1).out.equityCost);
        const u = utfallsrader([{ bas: 'A', aid: '1', n: 12, andelKv: 80, kostnad: 1 }, { bas: 'B', aid: '2', n: 3, andelKv: 80, kostnad: 1 }], 10);
        expect(varavKvDom(u, 5, 10, kvDom)).toBe(5);   // bara kvinnodominerade maskerade: den andra delen är tom
        expect(lo(1).andelAvPott).toBeCloseTo(100 * lo(1).varavKvDom / 200000, 9);
    });
    it('lönespannet, läget mot BAS-medianen, kostnaden per pott och en riktad rad för sig', () => {
        const vm = lo(10);
        expect(vm.band.visade.map(b => b.bas)).toEqual(['A', 'B', 'C']);
        expect(vm.band.utelamnade).toEqual(['D', 'E']);
        expect(lageMotBas(111, 100)).toEqual({ kvot: 1.11, lage: 'over' });
        expect(lageMotBas(89, 100).lage).toBe('under');
        expect(lageMotBas(100, 0)).toEqual({ kvot: null, lage: null });
        expect(vm.tabell.find(t => t.maskerad).lage.kvot).toBeNull();
        const info = riktadRadInfo(underlag(), RIKTAD_A, { k: 10 });
        expect(info.n).toBe(15);
        expect(info.kostnad).toBeCloseTo(0.03 * underlag().filter(r => r.bas === 'A' && r.kon === 'kvinna').reduce((s, r) => s + r.lon, 0), 6);
        expect(kostnadPerPott(underlag(), [RIKTAD_A, { ...RIKTAD_A, pool: 'okänd' }])).toEqual({ perPott: { equity: info.kostnad, övrigt: info.kostnad }, potter: ['equity', 'övrigt'] });
    });
    it('riktningen avgörs på talen som de visas, och den stegvisa planen har gapet bara när båda könen når k', () => {
        expect(riktning(-4.26, -4.34, 0)).toBe(0);          // båda visas som −4,3 %
        expect(riktning(-4.3, -4.0, 0)).toBe(-1);
        expect(riktning(-4.0, -4.3, 0)).toBe(1);
        expect(riktning(95.66, 95.74, 100)).toBe(0);       // båda visas som 95,7 %; avståndet mäts från målet
        expect(riktning(95.7, 96.1, 100)).toBe(-1);
        expect(riktning(null, 1)).toBeNull();
        const vm = lo(10, { years: 3 });
        expect(vm.plan).toHaveLength(3);
        expect(vm.plan.every(p => p.rawGap !== null)).toBe(true);
        expect(lo(10, { years: 1 }).plan).toBeNull();
        expect(lo(70, { years: 3 }).plan.every(p => p.rawGap === null)).toBe(true);   // 62 kvinnor, 53 män
        expect(lo(70).ra).toBeNull();
    });
    it('förslaget ur potten och grupperna som uppfyller ett villkor', () => {
        const kand = [{ bas: 'C', aid: '100003', gapKr: 3600, n: 16, maN: 30 }];
        // Potten 200 000 minus det generella påslaget räcker till hela skillnaden: 3 600 × 16.
        expect(forslagUrPotten(underlag(), { budget: prognos().budget, generell: prognos().generell, kandidater: kand, minN: 10 }))
            .toEqual([{ bas: 'C', aid: '100003', mode: 'kr', value: 57600, dist: 'lowest' }]);
        expect(forslagUrPotten(underlag(), { budget: prognos().budget, generell: prognos().generell, kandidater: kand, minN: 20 })).toEqual([]);
        const kvDom = kvDomAv(KOSTNADSVAL), namn = gs => gs.map(g => g.bas);
        expect(namn(villkorsgrupper(underlag(), { villkor: 'kvdom', minN: 0, arKvDom: kvDom }))).toEqual(['C', 'D']);
        expect(namn(villkorsgrupper(underlag(), { villkor: 'kvdom', minN: 10, arKvDom: kvDom }))).toEqual(['C']);
        expect(namn(villkorsgrupper(underlag(), { villkor: 'alla', minN: 10, arKvDom: kvDom }))).toEqual(['A', 'B', 'C']);
        expect(villkorsgrupper(underlag(), { villkor: 'underbas', minN: 0, arKvDom: kvDom })).toEqual([]);   // en grupp per intervall
    });
    it('grupperna före och efter: bara där båda könen når k; per yrkesgrupp bara de som ändras', () => {
        const d = underlag(), sim = d.map(r => ({ ...r, lon: r.kon === 'kvinna' ? r.lon * 1.05 : r.lon }));
        const bas = lutningRader(d, sim, 'bas', { k: 10, markering: b => ['bas:' + b] });
        expect(bas.map(r => [r.namn, r.nKv, r.nMa, r.markering])).toEqual([['BAS A', 15, 15, ['bas:A']], ['BAS B', 30, 30, ['bas:B']]]);
        expect(bas.every(r => r.efter > r.fore)).toBe(true);
        const grupp = lutningRader(d, d, 'grupp', { k: 10 });
        expect(lutningUrval(grupp, 'grupp')).toEqual({ diagram: [], tabell: [], fler: 0 });
        expect(lutningUrval(bas, 'bas').diagram).toBe(bas);
    });
});

describe('[B7.5] Det oförklarade gapet före och efter: huvudregressionen på raderna, utan minne', () => {
    it('före är huvudregressionen på underlaget, efter på de nya lönerna; inget minns mellan anropen (ADR-17)', () => {
        const rader = regUnderlag();
        const vm = lo(10, { generell: { mode: 'pct', value: 0 }, targets: [RIKTAD_A] }, rader);
        expect(vm.oforklarat.fore).toBe(reg(rader, 10).konPct);
        expect(vm.oforklarat.efter).toBe(reg(simuleradeRader(rader, vm.out), 10).konPct);
        expect(vm.oforklarat.riktning).toBe(-1);
        expect(oforklaratForeEfter(rader, rader, regval(10))).toEqual({ fore: vm.oforklarat.fore, efter: vm.oforklarat.fore });
        expect(oforklaradSkattning(regval(10))(rader.slice(0, 3))).toEqual({ konPct: null, pValue: null });
    });
});

describe('[B6.11] Lönelägets vymodell mot ställningstagandet', () => {
    const lp = (k, harPolicy = true) => vymodellLonepolitik(underlag(), { policyFor, nivaEtikett: p => (p ? 'BAS-intervall' : null), k, harPolicy });
    it('tom utan ställningstagande; täckningsgraden och dess status', () => {
        expect(lp(10, false).tom).toBe(true);
        expect(lp(10).tackning).toEqual({ pct: 100, status: 'ok' });
        expect([tackningsstatus(90), tackningsstatus(89), tackningsstatus(59)]).toEqual(['ok', 'varning', 'kritisk']);
        // Bedöms på talet som visas, i hela procent: 89,6 visas «90 %» och är god, 89,4 visas «89 %»; 59,5 visas «60 %».
        expect([89.6, 89.4, 59.5, 59.4].map(tackningsstatus)).toEqual(['ok', 'varning', 'varning', 'kritisk']);
    });
    it('slutsatserna räknar bara yrkesgrupper med full analys; tabellen följer maskeringstrappan', () => {
        const vm = lp(10);
        expect(vm.lage).toEqual(lageISpannet(vm.modell));
        expect(vm.lage).toEqual({ provade: 3, under: 1, over: 1 });   // A, B och C har minst 10; C under, B över
        expect(vm.antalMin).toBe(5);
        expect(vm.tabell.map(t => [t.b.bas, t.rader.map(r => [r.typ, r.lage ?? null]), t.utelamnade.map(g => g.aid)])).toEqual([
            ['A', [['full', null]], []], ['B', [['full', 'over']], []], ['C', [['full', 'under']], []], ['D', [], ['100004']], ['E', [['antal', null]], []]]);
        expect(tabellblock(vm.modell)).toEqual(vm.tabell);
    });
    it('en grupp under fem utan rad i ställningstagandet maskeras som de andra: namnet i noten, ingen egen rad', () => {
        const g = (aid, tier) => ({ aid, pol: null, tier });
        const [t] = tabellblock({ byBas: [{ bas: 'Z', groups: [g('900001', 'masked'), g('900002', 'count')] }] });
        expect(t.rader.map(r => [r.g.aid, r.typ])).toEqual([['900002', 'ingenPolicy']]);
        expect(t.utelamnade.map(x => x.aid)).toEqual(['900001']);
    });
    it('bandkartan, könspositionen, tredjedelarna och efterlevnaden', () => {
        const vm = lp(10);
        expect(vm.bandkarta).toEqual(bandkarta(vm.modell));
        expect(vm.bandkarta.bas.map(b => b.bas)).toEqual(['A', 'C', 'D']);
        expect(vm.bandkarta.punkter.map(p => [p.bas, p.n, p.kvAndel, p.median])).toEqual([['A', 30, 50, vm.modell.byBas[0].groups[0].stats.median], ['C', 16, 75, vm.modell.byBas[2].groups[0].stats.median]]);
        expect(vm.konPosition.visade.map(b => b.bas)).toEqual(['A']);
        expect(vm.konPosition.dolda).toEqual(['C', 'D']);
        expect(vm.konLagen).toEqual({ ...konLagenSumma(vm.modell, 10), ok: true });
        expect([vm.konLagen.nKv, vm.konLagen.nMa]).toEqual([29, 20]);
        expect(vm.efterlevnad).toMatchObject({ harSpann: true, dolda: ['D'] });
        expect(vm.efterlevnad.visade.map(b => b.bas)).toEqual(['A', 'C']);
    });
});

describe('[I1] Löneöversyn visar ingen kostnad för grupper under tröskeln (vymodellen)', () => {
    it('utfallet: ingen visad rad och ingen samlad kostnad under k', () => {
        for (const k of [10, 25]) {
            const vm = lo(k);
            for (const t of vm.tabell.filter(x => !x.maskerad)) expect(t.g.n).toBeGreaterThanOrEqual(k);
            if ((vm.utfall.samlad?.kostnad ?? null) !== null) expect(vm.utfall.samlad.n).toBeGreaterThanOrEqual(k);
            const vy = utfallsvy(vm.out, k, kvDomAv(KOSTNADSVAL));
            expect(vy.omkorningar).toEqual(vm.omkorningar);
            for (const o of vm.omkorningar) expect(vm.utfall.maskerade.some(g => g.bas === o.bas && g.aid === o.aid)).toBe(false);
        }
    });
    it('kostnaden på individnivå: jämförelsen kräver k män, en grupp får egen rad från k berörda, summan från k', () => {
        const vid = k => vymodellIndividlyft(underlag(), { gapPct: 5, k });
        expect(vid(10).visade.map(g => [g.bas, g.count])).toEqual([['A', 15]]);
        expect(vid(10).summaVisas).toBe(true);
        expect(vid(25).rem.count).toBe(0);   // inget BAS-intervall eller yrke har 25 män utom B, där ingen ligger under
        const smal = vymodellIndividlyft(underlag(), { gapPct: 5, k: 16 });
        expect(smal.visade).toEqual([]);   // A har 15 berörda: under 16 får gruppen ingen egen rad
        expect(smal.dolda).toBe(smal.rem.perGroup.length - smal.visade.length);
        expect(smal.summaVisas).toBe(smal.rem.count >= 16);
        expect(individlyftGrupper(smal.rem, 16)).toEqual(smal.visade);
        expect(vymodellIndividlyft(underlag(), { gapPct: NaN, k: 10 }).rem).toEqual(vid(10).rem);   // ingen gräns: 5 %
    });
});

describe('[I1b] Löneöversyns knappresultat räknas med den tröskel de får', () => {
    const KANDIDAT = [{ bas: 'C', aid: '100003', gapKr: 3600, n: 16, maN: 30 }];
    it('känsligheten: det råa gapet bara när båda könen når k', () => {
        const vid = k => vymodellKanslighet(underlag(), KANDIDAT, KOSTNADSVAL, k);
        expect(vid(1).kurva).toHaveLength(11);
        expect(vid(1).kurva.every(c => c.rawGap !== null)).toBe(true);
        expect(vid(70).kurva.every(c => c.rawGap === null)).toBe(true);
        expect(vid(70).storsta).toBe(0.01);
        expect(vid(70).kurva.map(c => c.kostnad)).toEqual(vid(1).kurva.map(c => c.kostnad));
    });
    it('kostnaden på individnivå och tröskelmålet följer k', () => {
        expect(vymodellIndividlyft(underlag(), { gapPct: 5, k: 1 }).visade.length).toBeGreaterThan(0);
        expect(vymodellIndividlyft(underlag(), { gapPct: 5, k: 25 }).visade).toEqual([]);
        expect(vymodellTroskelmal(regUnderlag(), { k: 10, malPct: 1, signifikans: false, regval: regval(10) }).status).toBe('hittat');
        expect(vymodellTroskelmal(regUnderlag(), { k: 60, malPct: 1, signifikans: false, regval: regval(60) }).status).toBe('konUnderK');
    });
});

describe('[R2] Löneöversyns förslag följer den inställda tröskeln; egna rader står kvar', () => {
    it('kandidaterna: bara par där båda grupperna når k, med meningen om de utelämnade', () => {
        const { kandidater, not } = forslagskandidater(PAR, 10);
        expect(kandidater).toEqual([{ bas: 'C', aid: '100003', gapKr: -3600, n: 16, maN: 30 }]);
        expect(not).toMatch(/^1 par med en grupp under 10/);
        expect(forslagskandidater(PAR, 25).kandidater).toEqual([]);
    });
    it('rensningen: säkert ur minnet, försiktigt utan det, egna rader står kvar, och scenarier med en rad som inte står sig tas bort', () => {
        const egen = { bas: 'D', aid: '100004', mode: 'kr', value: 100 };
        const minns = { bas: 'C', aid: '100003', kalla: 'par' }, ur = { bas: 'C', aid: '100003', kalla: 'par' };
        const ursprung = t => (t === minns ? { kvN: 16, maN: 30 } : undefined);
        const vid = (k, fullstandig) => rensaForeslagnaRader({ rader: [egen, minns, ur], scenarioRader: { A: [ur], B: null }, ursprung, allaPar: PAR, fullstandig, k });
        // Vid 5 når C:s båda par tröskeln: med en fullständig lista står alla kvar.
        expect(vid(5, true)).toEqual({ kvar: [egen, minns, ur], sakert: 0, forsiktigt: 0, bortScenarier: [] });
        // En kapad lista räcker inte för raden utan minne.
        expect(vid(5, false)).toEqual({ kvar: [egen, minns], sakert: 0, forsiktigt: 1, bortScenarier: ['A'] });
        // Vid 10 har C ett par under tröskeln (Vaktmästare, 6): raden utan minne tas bort; den ur minnet räknades ur ett par som når den.
        expect(vid(10, true)).toEqual({ kvar: [egen, minns], sakert: 0, forsiktigt: 1, bortScenarier: ['A'] });
        expect(vid(20, true)).toEqual({ kvar: [egen], sakert: 1, forsiktigt: 1, bortScenarier: ['A'] });
    });
    it('en egen rad på en grupp under tröskeln får en upplysning, och en rad som inte träffar någon en annan', () => {
        expect(riktadRadInfo(underlag(), { bas: 'D', aid: '100004', mode: 'kr', value: 100, dist: 'lowest' }, { k: 10 })).toEqual({ kostnad: 100, n: 3, upplysning: 'underK' });
        expect(riktadRadInfo(underlag(), { bas: 'X', aid: '*', mode: 'kr', value: 100 }, { k: 10 }).upplysning).toBe('ingen');
        expect(riktadRadInfo(underlag(), RIKTAD_A, { k: 10 }).upplysning).toBeNull();
    });
});

describe('[R4] Löneöversynens scenarier: det råa gapet sparas och visas bara när båda könen når tröskeln', () => {
    it('scenariots omkörningar räknas med samma urval som utfallets: en invikt grupp räknas inte', () => {
        // A (12 personer) går om C med sitt riktade påslag men viks in vid 10, eftersom B ensam har 3.
        const d = [...flera('100001 Handläggare', 'A', 'kvinna', 12, 30000), ...flera('100002 Utredare', 'B', 'kvinna', 3, 50000),
            ...flera('100003 Assistent', 'C', 'man', 15, 32000)];
        const riktade = [{ bas: 'A', aid: '*', mode: 'pct', value: 10, dist: 'flat', targetLevel: 'median', pool: 'equity' },
            { bas: 'B', aid: '*', mode: 'pct', value: 1, dist: 'flat', targetLevel: 'median', pool: 'equity' }];
        const out = prognosutfall(d, { mode: 'kr', value: 0 }, { mode: 'pct', value: 5 }, riktade, KOSTNADSVAL);
        for (const k of [1, 10]) expect(scenarioUr(d, out, { efter: null }, k).summary.leapfrog).toBe(utfallsvy(out, k, kvDomAv(KOSTNADSVAL)).omkorningar.length);
        expect(utfallsvy(out, 1, kvDomAv(KOSTNADSVAL)).omkorningar.length).toBe(1);   // fallet har en omkörning
    });
    it('ett scenario sparat vid en lägre tröskel visar inget rågap vid en högre, och Till kv-dom följer utfallets regel', () => {
        const d = underlag(), out = lo(1).out;
        const sc = scenarioUr(d, out, { efter: -2 }, 1);
        expect(sc).toMatchObject({ nKv: 62, nMa: 53, summary: { oforklaratEfter: -2, rawGapEfter: out.rawGapEfter, equityCost: out.equityCost } });
        expect(sc.grupper.map(g => g.bas)).toEqual(['A', 'B', 'C', 'D', 'E']);
        expect(scenarioUr(d, out, { efter: -2 }, 70).summary.rawGapEfter).toBeNull();
        const kvDom = kvDomAv(KOSTNADSVAL), nu = { nKv: 62, nMa: 53 };
        const vid1 = scenariojamforelse({ A: sc, B: null }, { nu, k: 1, arKvDom: kvDom });
        expect(vid1).toEqual({ A: { anvant: out.använt, totalKostnad: out.totalKostnad, raEfter: out.rawGapEfter, oforklaratEfter: -2, tillKvDom: out.equityCost,
            omkorningar: sc.summary.leapfrog }, B: null, maskerat: false });
        const vid70 = scenariojamforelse({ A: sc }, { nu, k: 70, arKvDom: kvDom });
        expect(vid70.A.raEfter).toBeNull();
        expect(vid70.maskerat).toBe(true);
        // Vid 10 ger andelen till kvinnodominerade grupper en del av den samlade kostnaden (som i utfallet).
        expect(scenariojamforelse({ A: sc }, { nu, k: 10, arKvDom: kvDom }).A.tillKvDom).toBeNull();
        // Ett scenario utan antal prövas mot underlaget som det är nu.
        const utan = { ...sc, nKv: undefined, nMa: undefined };
        expect(scenariojamforelse({ A: utan }, { nu: { nKv: 5, nMa: 50 }, k: 10, arKvDom: kvDom }).A.raEfter).toBeNull();
    });
});

describe('[R5] Löneöversyns tröskelmål kräver tröskeln för varje kön (vymodellen)', () => {
    it('ett kön under k ger inget lyft och ingen kostnad, före både målets prövning och sökningen', () => {
        const fa = regUnderlag({ fa: true });   // sju män
        expect(vymodellTroskelmal(fa, { k: 10, malPct: 1, signifikans: false, regval: regval(10) })).toEqual({ status: 'konUnderK' });
        expect(vymodellTroskelmal(fa, { k: 10, malPct: 99, malOk: false, signifikans: false, regval: regval(10) })).toEqual({ status: 'konUnderK' });
        expect(vymodellTroskelmal(regUnderlag(), { k: 10, malPct: 99, malOk: false, signifikans: false, regval: regval(10) })).toEqual({ status: 'ogiltigtMal' });
        const svar = vymodellTroskelmal(regUnderlag(), { k: 10, malPct: 1, signifikans: false, regval: regval(10) });
        expect(svar.status).toBe('hittat');
        expect(svar.utgangslage.konPct).toBe(reg(regUnderlag(), 10).konPct);
        expect(svar.resultat.konPct).toBeGreaterThanOrEqual(-1);
    });
});

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
        expect(vm.skillnad.utelamnade).toEqual(k === 10 ? ['D', 'E'] : ['C', 'D', 'E']);
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
        for (const b of ickeTom(vm.block)) for (const r of b.rader) expect(r.n, `${b.bas} ${r.kategori}`).toBeGreaterThanOrEqual(k);
        for (const b of ickeTom(vm.block)) for (const u of b.utelamnade) expect(typeof u).toBe('string');
    });

    it('Gruppdossiern: grupperna når k, skillnaden och räkneexemplet bara när båda könen gör det, paren under k utelämnade', () => {
        for (const g of ickeTom(gruppdossierGrupper(underlag(), k))) {
            expect(g.rows.length).toBeGreaterThanOrEqual(k);
            const vm = vymodellGruppdossier(g, { k, par: PAR, kostnad: {} });
            if (vm.gap !== null) expect(Math.min(vm.nKv, vm.nMa)).toBeGreaterThanOrEqual(k);
            for (const p of [...vm.lvAsSubject, ...vm.lvAsComparator]) expect(Math.min(p.kvN, p.maN)).toBeGreaterThanOrEqual(k);
        }
    });

    it('BAS-dossiern: könens medianer, yrkesgruppernas, åldersgruppernas och förra årets bara där k nås', () => {
        for (const { bas } of ickeTom(basdossierIntervall(underlag(), BAS, k))) {
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
    it('Likvärdigt arbete: Krav mot lön visar bara grupper som når k; diagnostiken räknar de små vid k', () => {
        const vm = vymodellKravMotLon(lvUnderlag(), { k });
        if (!vm.forFa) for (const p of vm.punkter) expect(p.n).toBeGreaterThanOrEqual(k);
        expect(vm.forFa).toBe(k === 25);
        const res = likvardighetsparUr({ data: lvUnderlag(), opts: { k } });
        expect(kvDomUnderK(res.orgKvDom, k)).toBe(res.diagnostik.organisation.kvDomMedNLessThanK);
        expect(kvDomUnderK(res.orgKvDom, k)).toBe(k === 10 ? 2 : 4);   // Biträde och Tekniker; vid 25 också Undersköterska och Assistent
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
    it('Regressionskortet och livscykeln: kronor, ojusterat steg och budget bara när båda könen når k; BAS-effekter, tabellrader och kurva bara där intervallet gör det', () => {
        for (const val of [{}, { fa: true }]) {
            const { r, vm } = rk(k, val);
            const minKon = Math.min(r.nKvAnalysed, r.nMaAnalysed);
            if (vm.kronor || vm.andelAvLonesumma !== null || vm.budget || vm.trappa || vm.stegUt.explainedShare !== null
                || vm.stegUt.steg.some(x => x.name === 'Endast kön')) expect(minKon).toBeGreaterThanOrEqual(k);
            for (const e of vm.basEffekter.effekter || []) expect(r.basN[e.bas]).toBeGreaterThanOrEqual(k);
            if ((vm.basEffekter.effekter || []).length) expect(r.basN[r.basRef]).toBeGreaterThanOrEqual(k);
            expect(vm.konOk).toBe(!val.fa);   // 47 män når 10 och 25; sju gör det inte
        }
        for (const fixBas of ['A', 'B', 'C', 'D']) {
            const { vm } = lc(k, fixBas);
            for (const b of vm.visade) expect(b.n).toBeGreaterThanOrEqual(k);
            if (!vm.kurvaUtelamnad) expect(vm.basRader.find(b => b.bas === fixBas).n).toBeGreaterThanOrEqual(k);
        }
    });
    it('Löneöversyn: ingen rad, samlad kostnad, gap eller jämförelse före och efter under k', () => {
        const vm = lo(k, { years: 2 });
        for (const t of ickeTom(vm.tabell.filter(x => !x.maskerad))) expect(t.g.n).toBeGreaterThanOrEqual(k);
        if ((vm.utfall.samlad?.kostnad ?? null) !== null) expect(vm.utfall.samlad.n).toBeGreaterThanOrEqual(k);
        for (const b of ickeTom(vm.band.visade)) expect(b.n).toBeGreaterThanOrEqual(k);
        const antal = kon => underlag().filter(r => r.kon === kon).length;
        if (vm.ra || vm.plan?.some(p => p.rawGap !== null)) expect(Math.min(antal('kvinna'), antal('man'))).toBeGreaterThanOrEqual(k);
        const d = underlag(), sim = d.map(r => ({ ...r, lon: r.lon * 1.01 }));
        for (const niva of ['bas', 'grupp']) for (const r of ickeTom(lutningRader(d, sim, niva, { k }))) expect(Math.min(r.nKv, r.nMa)).toBeGreaterThanOrEqual(k);
        const ind = vymodellIndividlyft(d, { gapPct: 5, k });
        for (const g of ind.visade) expect(g.count).toBeGreaterThanOrEqual(k);
        if (ind.summaVisas) expect(ind.rem.count).toBeGreaterThanOrEqual(k);
    });
    it('Löneläget mot ställningstagandet: lönemått bara för grupper och intervall som når k', () => {
        const vm = vymodellLonepolitik(underlag(), { policyFor, nivaEtikett: () => null, k, harPolicy: true });
        for (const t of vm.tabell) for (const r of t.rader.filter(x => x.typ === 'full')) expect(r.g.n).toBeGreaterThanOrEqual(k);
        for (const t of vm.tabell) for (const g of t.utelamnade) expect(g.n).toBeLessThan(vm.antalMin);
        for (const p of vm.bandkarta.punkter) expect(p.n).toBeGreaterThanOrEqual(k);
        for (const b of vm.konPosition.visade) expect(Math.min(b.genderGap.nKv, b.genderGap.nMa)).toBeGreaterThanOrEqual(k);
        for (const b of vm.efterlevnad.visade) expect(b.n).toBeGreaterThanOrEqual(k);
        if (vm.konLagen.ok) expect(Math.min(vm.konLagen.nKv, vm.konLagen.nMa)).toBeGreaterThanOrEqual(k);
        expect(vm.efterlevnad.visade.map(b => b.bas)).toEqual(k === 10 ? ['A', 'C'] : ['A']);
    });
});

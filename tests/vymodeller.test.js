// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
// Vymodellerna (ADR-99) prövade i Node, utan DOM och tillstånd: Lönestrukturs avsnitt per BAS-intervall
// (src/lib/vymodell-lonestruktur.js) och fliken Lika arbete (src/lib/vymodell-lika-arbete.js). Underlaget är påhittat:
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

    it('låg styrka följer gruppens minsta upptäckbara skillnad', () => {
        // Jämförelsen är mot |gap − 100| (gap är redan avståndet från lika lön), som i tabellen före vymodellen.
        const jamforbara = s => vymodellLikaArbete(underlag(), { k: 10, golv: 10, sigma: s }).grupper.filter(g => !g.samladMedian);
        expect(jamforbara(0.1).map(g => g.lagStyrka)).toEqual([null, null]);
        expect(jamforbara(5).every(g => g.lagStyrka && g.lagStyrka.mdePct > Math.abs(g.gap - 100))).toBe(true);
        expect(vymodellLikaArbete(underlag(), { k: 10, golv: 10 }).grupper.every(g => !g.lagStyrka)).toBe(true);   // utan spridning ingen styrka
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
});

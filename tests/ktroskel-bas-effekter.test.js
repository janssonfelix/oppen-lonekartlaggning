/**
 * Regressionens BAS-effekter följer tröskeln (ADR-70): effekten för ett BAS-intervall är dess lönenivå mot
 * referensintervallet, ett lönemått.
 *
 * Underlaget: tre BAS-intervall med 30 personer (15 kvinnor, 15 män) och ett med 4 personer, vars lönenivå ligger
 * tydligt över de andras, så att dess effekt i modellen är ett tal som är lätt att känna igen. I exportläget vid
 * tröskeln 10 står det lilla intervallets effekt ingenstans i det som lämnar verktyget; intervallet namnges i en not.
 * När referensintervallet självt är under tröskeln står ingen effekt alls, eftersom varje effekt då beskriver det
 * lilla intervallets nivå baklänges. Modellen skattas som förut med alla intervall, och skärmen visar allt (ADR-51).
 */
import { describe, it, expect, vi } from 'vitest';
import { createAppWindow } from './helpers/app-harness.js';
import { utanTaggar } from '../src/lib/htmltext.js';
import { normalisera, iExport, harNagon, samlaUtdata, sammanhang } from './helpers/ktroskel-rigg.js';

vi.setConfig({ testTimeout: 60000 });

// En rad per person: lönen är intervallets nivå, med en liten spridning och en liten skillnad mellan könen.
const rad = (bas, kon, lon, alder) => ({ bas, kon, lon, alder, yrke: `6100 Yrke ${bas}`, aid: '6100', yrkeLabel: `Yrke ${bas}`, enhet: '' });
function underlag(nivaer) {
    const r = [];
    for (const [bas, niva, n] of nivaer) {
        for (let i = 0; i < n; i++) {
            const kv = i % 2 === 0;
            r.push(rad(bas, kv ? 'kvinna' : 'man', Math.round(niva * (kv ? 0.97 : 1) * (1 + ((i * 7) % 11) / 400)), 28 + (i * 5) % 30));
        }
    }
    return r;
}
function fonsterMed(nivaer) {
    const w = createAppWindow();
    w.__state.data = underlag(nivaer);
    const basar = nivaer.map(n => n[0]);
    w.__state.policy = basar.map(bas => ({ bas, p10: 22000, med: 30000, p90: 52000 }));
    w.__state.statistik = basar.map(bas => ({ aid: '6100', bas, median: 61700, p10: 55000, p90: 71000 }));
    w.eval('populateSelects(); unlockTabs();');
    return w;
}
// Det lilla intervallet D ligger 80 % över de andra; referensen är A.
const LITET_D = [['A', 30000, 30], ['B', 33000, 30], ['C', 36500, 30], ['D', 54000, 4]];
// Referensintervallet A har 4 personer, med en tydligt lägre nivå.
const LITEN_REF = [['A', 17300, 4], ['B', 30000, 30], ['C', 34700, 30], ['D', 38500, 30]];

// En effekt som den skrivs: en och två decimaler, med komma och punkt, utan tecken.
const former = v => [...new Set([1, 2].flatMap(d => { const t = Math.abs(v).toFixed(d); return [t, t.replace('.', ',')]; }))];
const effekter = w => w.eval('runOLSRegression()').basEffekter;
const lackorI = (utdata, dolda) => {
    const ut = [];
    for (const [namn, text] of utdata.filter(([n]) => n !== 'skärm: alla flikar')) {
        // Talet för sig, inte som en del av ett längre tal ("2100.7", "30100,75").
        for (const v of dolda.filter(v => new RegExp(`(?<![\\d.,])${v.replace('.', '\\.')}(?!\\d)`).test(text))) ut.push(`${namn}: ${v} — "${sammanhang(text, v)}"`);
    }
    return ut;
};
const RAPPORTER = ['Word-utkastet', 'utskrift: komplett', 'utskrift: facklig'];

describe('BAS-effekterna i regressionen: ett intervall under tröskeln har ingen effekt i det som lämnar verktyget (ADR-70)', () => {
    it('fixturen: modellen skattas med alla intervall, och det lilla intervallets effekt är ett tal som inte står någon annanstans', () => {
        const e = effekter(fonsterMed(LITET_D));
        expect(e.map(x => x.bas)).toEqual(['B', 'C', 'D']);
        const d = e.find(x => x.bas === 'D');
        expect(d.pct).toBeGreaterThan(60);
    });

    it('på skärmen visar regressionskortet varje intervalls effekt (ADR-51)', () => {
        const w = fonsterMed(LITET_D);
        w.__renderTabContent('struktur');
        const t = normalisera(w.document.getElementById('regression-card').textContent);
        for (const e of effekter(w)) expect(t, e.bas).toContain(svPct1(e.pct));
    });

    it('exportläget vid 10: kortet visar effekterna för B och C men inte för D, och noten namnger D', () => {
        const w = iExport(fonsterMed(LITET_D));
        w.__renderTabContent('struktur');
        const kort = w.document.getElementById('regression-card');
        const t = normalisera(kort.textContent);
        const e = Object.fromEntries(effekter(w).map(x => [x.bas, x]));
        expect(t).toContain(svPct1(e.B.pct));
        expect(t).toContain(svPct1(e.C.pct));
        expect(harNagon(t, [...former(e.D.pct), ...former(e.D.low), ...former(e.D.high)])).toEqual([]);
        expect(t).toMatch(/1 BAS-intervall visas inte här: D\./);
    });

    it('vid 10: samma utdatavägar som invarianten; D:s effekt och intervall står ingenstans, B:s och C:s står i rapporterna', async () => {
        const w = fonsterMed(LITET_D);
        const e = Object.fromEntries(effekter(w).map(x => [x.bas, x]));
        const utdata = await samlaUtdata(w);
        expect(lackorI(utdata, [...former(e.D.pct), ...former(e.D.low), ...former(e.D.high)])).toEqual([]);
        for (const namn of RAPPORTER) {
            const t = utanTaggar(utdata.find(([n]) => n === namn)[1]);
            expect(t, namn).toMatch(/BAS-effekter/);
            expect(t, namn).toContain(e.B.pct.toFixed(2).replace('.', ','));
            expect(t, namn).toContain(e.C.pct.toFixed(2).replace('.', ','));
            expect(t, namn).toMatch(/1 BAS-intervall visas inte här: D\./);
        }
    }, 180000);

    it('referensintervallet under tröskeln: ingen effekt står i det som lämnar verktyget, och noten säger varför', async () => {
        const w = fonsterMed(LITEN_REF);
        const e = effekter(w);
        expect(w.eval('runOLSRegression()').basRef).toBe('A');
        const dolda = e.flatMap(x => [...former(x.pct), ...former(x.low), ...former(x.high)]);
        const utdata = await samlaUtdata(w);
        expect(lackorI(utdata, dolda)).toEqual([]);
        for (const namn of RAPPORTER) {
            const t = utanTaggar(utdata.find(([n]) => n === namn)[1]);
            expect(t, namn).toMatch(/BAS-effekterna visas inte här: referensintervallet, BAS A, har färre än 10 personer/);
        }
        const kort = utdata.find(([n]) => n === 'skärm i exportläget: alla flikar')[1];
        expect(kort).toMatch(/BAS-effekterna visas inte här: referensintervallet, BAS A, har färre än 10 personer/);
        // Skärmen visar effekterna som förut.
        const w2 = fonsterMed(LITEN_REF);
        w2.__renderTabContent('struktur');
        const skarm = normalisera(w2.document.getElementById('regression-card').textContent);
        for (const x of e) expect(skarm, x.bas).toContain(svPct1(x.pct));
    }, 180000);
});

// Kortets form: ett tecken, en decimal, procent (svPct).
function svPct1(v) { return `${v >= 0 ? '+' : '−'}${Math.abs(v).toFixed(1).replace('.', ',')} %`; }

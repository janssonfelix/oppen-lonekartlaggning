/**
 * K-tröskeln som inställning: Löneöversyn (I1) och invarianten över flikar och exporter vid 10 (I4).
 *
 * Riggen (fixturer, fönster och sökfunktioner) ligger i tests/helpers/ktroskel-rigg.js; sviten är delad i
 * flera filer så att Vitest fördelar den över flera arbetare. Invarianten (tests/helpers/ktroskel-invariant.js)
 * körs vid 25 i tests/ktroskel-invarianter-25.test.js, med sakliga skäl (I5): förberedelsen tar omkring en minut,
 * så de två förberedelserna ligger i var sin fil.
 */
import { describe, it, expect, vi } from 'vitest';
import { createAppWindow } from './helpers/app-harness.js';
import { normalisera, oppnaFlik, iExport, KON_BAS, KON_KV, KON_MA, ENSAM, fonsterKon, laddaXlsx, fangaBocker, X_KV, X_MA, PAR_KV, PAR_MA } from './helpers/ktroskel-rigg.js';
import { invariantSvit } from './helpers/ktroskel-invariant.js';

// Sviten ritar om hela verktyget i varje test. Under full last tar ett test 4–6 s, så standardgränsen 5 s
// fäller olika tester från körning till körning.
vi.setConfig({ testTimeout: 30000 });

describe('I1: Löneöversyn visar ingen kostnad för grupper under tröskeln', () => {
    it('individnivån: på skärmen visas jämförelsen också mot få män (skärmen maskerar inget, ADR-51)', () => {
        const w = fonsterKon(null);
        w.__renderTabContent('loneoversyn');
        w.eval('_forecastRemediation()');
        expect(w.document.querySelectorAll('#forecast-rem-result tbody tr').length).toBeGreaterThan(0);
    });
    it('individnivån i exportläget: jämförelsen kräver tröskeln i antal män, och kostnaden visas inte där antalet maskeras', () => {
        const w = iExport(fonsterKon(null));
        w.__renderTabContent('loneoversyn');
        w.eval('_forecastRemediation()');
        const t = normalisera(w.document.getElementById('forecast-rem-result').textContent);
        expect(t).not.toContain(String(PAR_MA - PAR_KV));                       // en man minus en kvinna
        for (const [i] of KON_BAS.entries()) expect(t).not.toContain(String(30 * (KON_MA[i] - KON_KV[i])));   // mot 1–3 mäns median
        expect(w.document.querySelectorAll('#forecast-rem-result tbody tr').length).toBe(0);
        const rem = w.__state.forecast._remediation;
        expect(rem.perGroup.some(g => KON_BAS.includes(g.bas) || g.aid === '7300')).toBe(false);
    });
    it('individnivån: en grupp med färre flaggade än tröskeln räknas men får ingen egen kostnad, och blir inget förslag', () => {
        const w = createAppWindow();
        const rad = (kon, lon, i) => ({ bas: 'A', kon, lon, alder: 30 + i % 20, yrke: '6000 Yrke', aid: '6000', yrkeLabel: 'Yrke', enhet: '' });
        const r = [];
        for (let i = 0; i < 12; i++) r.push(rad('man', 40000 + i, i));
        for (let i = 0; i < 12; i++) r.push(rad('kvinna', i < 3 ? 31117 : 40000 + i, i));   // tre kvinnor långt under männens median
        w.__state.data = r;
        w.eval('populateSelects(); unlockTabs();');
        iExport(w);
        w.__renderTabContent('loneoversyn');
        w.eval('_forecastRemediation()');
        const el = w.document.getElementById('forecast-rem-result');
        const kostnad = String(Math.round(3 * (40005.5 - 31117)));
        expect(normalisera(el.textContent)).not.toContain(kostnad);
        expect(el.textContent).toMatch(/färre än 10/);
        w.alert = () => {};
        w.eval('_forecastRemediationSeed()');
        expect(w.__state.forecast.targets).toEqual([]);
    });
    it('utfallstabellen (i exportläget) och Excel: kostnaden maskeras där medianerna maskeras, och antalet grupper anges', async () => {
        const w = iExport(fonsterKon(null));
        Object.assign(w.__state.forecast, { generell: { mode: 'pct', value: 2 } });
        w.__renderTabContent('loneoversyn');
        const kostnad = v => String(Math.round(v * 0.02));
        // Kostnaden per grupp vid 2 % påslag: en persons lön, ett pars löner och fyra personers löner gånger 0,02.
        const dolda = { 7001: kostnad(ENSAM), 7300: kostnad(PAR_KV + PAR_MA), 7002: kostnad(2 * X_KV + 2 * X_MA) };
        expect(dolda).toEqual({ 7001: '639', 7300: '1368', 7002: '2972' });
        const tabell = w.document.querySelector('#forecast-outcome .table-wrap');
        const rad = namn => [...tabell.querySelectorAll('tbody tr')].find(tr => tr.children[1].textContent === namn);
        expect(rad('7001')).toBeTruthy();
        for (const aid of ['7001', '7300', '7002']) {
            expect(normalisera(rad(aid).textContent), aid).not.toMatch(/\d kr\/mån/);
            expect(normalisera(rad(aid).textContent), aid).not.toContain(dolda[aid]);
        }
        expect(normalisera(rad('6000').textContent)).toMatch(/\d kr\/mån/);
        expect(w.document.getElementById('forecast-outcome').textContent).toMatch(/\d+ grupper med färre än 10 personer ingår i summorna/);
        await laddaXlsx(w);
        const bok = Object.values(fangaBocker(w, () => w.eval('exportForecast()')))[0];
        const blad = bok.split('[Fördelning]')[1].split('[')[0].split('\n');
        for (const aid of ['7001', '7300', '7002']) {
            expect(blad.find(r => r.includes(`| ${aid} |`)), aid).toMatch(/\|\s*$/);
            expect(blad.find(r => r.includes(`| ${aid} |`)), aid).not.toContain(dolda[aid]);
        }
        expect(blad.find(r => r.includes('| 6000 |'))).toMatch(/\| \d+$/);
        expect(bok).toMatch(/\d+ grupper med färre än 10 personer ingår i summorna/);
    });
    it('höjd tröskel rör inte förslagen på skärmen (skärmen maskerar inget, ADR-51); egna rader står kvar', () => {
        const w = createAppWindow();
        const rader = [];
        const lagg = (n, kon, lon, bas, aid) => { for (let i = 0; i < n; i++) rader.push({ bas, kon, lon: lon + (i % 3) * 10,
            alder: 30 + (i * 7) % 30, yrke: `${aid} Yrke ${aid}`, aid, yrkeLabel: `Yrke ${aid}`, enhet: '' }); };
        lagg(30, 'kvinna', 25000, 'A', '6000'); lagg(30, 'man', 25500, 'A', '6000');
        lagg(20, 'man', 50000, 'C', '6100'); lagg(4, 'kvinna', 50000, 'C', '6100');
        lagg(6, 'kvinna', 36421, 'C', '5300');
        w.__state.data = rader;
        w.eval('populateSelects(); unlockTabs(); sattKTroskel(5, { fraga: false });');
        w.alert = () => {};
        Object.assign(w.__state.forecast, { minGroupN: 0, budget: { mode: 'kr', value: 5000000 }, generell: { mode: 'pct', value: 0 } });
        oppnaFlik(w, 'loneoversyn');
        w.eval('_forecastOptimize()');
        expect(w.__state.forecast.targets.map(t => t.aid)).toContain('5300');
        w.__state.forecast.targets.push({ bas: 'A', aid: '6000', mode: 'kr', value: 1000, dist: 'lowest', targetLevel: 'median', pool: 'övrigt' });
        w.eval('sattKTroskel(10, { fraga: false })');
        expect(w.__state.forecast.targets.map(t => t.aid)).toContain('5300');
        expect(w.__state.forecast.targets.map(t => t.aid)).toContain('6000');
        expect(w.document.getElementById('forecast-par-not').textContent).toBe('');
        // Raden på den lilla gruppen säger att beloppet bygger på enskildas löner (R2).
        expect(w.document.getElementById('forecast-targets').textContent).toMatch(/Raden berör 6 personer, färre än 10 personer/);
    });
});

invariantSvit(10, []);

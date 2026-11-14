/**
 * Löneöversyns scenariojämförelse A/B röjer ingen liten grupps kostnad (ADR-70).
 *
 * Ett sparat scenario bär sin kostnad till kvinnodominerade grupper (Till kv-dom). I exportläget (förhandsvisningen
 * Som i exporten) står Varav till kvinnodominerade grupper i utfallet bara när talet inte ger en del av den samlade
 * kostnaden för grupperna under tröskeln (_fcVaravKvDom). Scenariotabellen följer samma regel med samma funktion:
 * annars ett streck. Underlaget är det i ktroskel-loneoversyn-summor.test.js där Varav visas som streck: en grupp med
 * 30 personer, en med 12 och en ensam kvinna i en egen grupp; den ensamma kvinnans grupp är den enda kvinnodominerade,
 * så kostnaden till kvinnodominerade grupper är hennes påslag, 2 procent av hennes lön. Skärmen visar talet som förut.
 * Scenarierna lämnar inte verktyget (de finns bara i minnet och i fliken).
 */
import { describe, it, expect, vi } from 'vitest';
import { createAppWindow } from './helpers/app-harness.js';
import { normalisera, iExport, ENSAM } from './helpers/ktroskel-rigg.js';

vi.setConfig({ testTimeout: 30000 });

const rad = (bas, aid, kon, lon) => ({ bas, kon, lon, alder: 40, yrke: `${aid} Yrke ${aid}`, aid, yrkeLabel: `Yrke ${aid}`, enhet: '' });
const grupp = (bas, aid, n, lon0, kon) => Array.from({ length: n }, (_, i) => rad(bas, aid, kon || (i % 2 ? 'man' : 'kvinna'), lon0 + i * 10));
const STOR = grupp('A', '6000', 30, 30000);
// Varav visas som streck: den ensamma kvinnan (kvinnodominerad grupp) och den invikta gruppen B 6100 (blandad).
const STRECK = [...STOR, ...grupp('B', '6100', 12, 35000), rad('C', '6200', 'kvinna', ENSAM)];
// Varav står: de maskerade grupperna är alla kvinnodominerade.
const STAR = [...STOR, ...grupp('B', '6100', 12, 35000, 'kvinna'), rad('C', '6200', 'kvinna', ENSAM)];

function fonster(data) {
    const w = createAppWindow();
    w.__state.data = data;
    w.eval('populateSelects(); unlockTabs();');
    Object.assign(w.__state.forecast, { generell: { mode: 'pct', value: 2 } });
    w.__renderTabContent('loneoversyn');
    return w;
}
const celler = tr => [...tr.children].map(c => normalisera(c.textContent).trim());
const krTal = t => (/^−?[\d]+ kr/.test(t) ? Number(t.replace(/ kr.*$/, '').replace('−', '-')) : null);
// Scenariotabellen: rubrikerna och raden för A.
function scenario(w) {
    const t = w.document.querySelector('#forecast-scenarios table');
    const rubriker = [...t.querySelectorAll('thead th')].map(th => normalisera(th.textContent).trim());
    const a = celler(t.querySelector('tbody tr'));
    return Object.fromEntries(rubriker.map((r, i) => [r, a[i]]));
}
// Utfallstabellen: kostnaden för de visade kvinnodominerade grupperna och Varav-raden.
function utfall(w) {
    const rader = [...w.document.querySelectorAll('#forecast-outcome .table-wrap tbody tr')].map(celler);
    const kvDom = rader.filter(c => /^\d+ %$/.test(c[3]) && w.eval(`kvDomNu(${parseInt(c[3], 10)})`));
    const synlig = kvDom.reduce((s, c) => s + (krTal(c[7]) || 0), 0);
    const varav = /Varav till kvinnodominerade grupper \([^)]*\): (–|[\d]+ kr)/.exec(normalisera(w.document.getElementById('forecast-outcome').textContent))[1];
    return { synlig, varav };
}

describe('Scenariojämförelsen A/B: Till kv-dom följer regeln för Varav till kvinnodominerade grupper (ADR-70)', () => {
    it('fixturen: på skärmen är Till kv-dom den ensamma kvinnans påslag', () => {
        const w = fonster(STRECK);
        w.eval("_forecastSaveScenario('A')");
        const s = scenario(w);
        expect(krTal(s['Till kv-dom'])).toBe(Math.round(0.02 * ENSAM));
        expect(utfall(w).varav).toBe(`${Math.round(0.02 * ENSAM)} kr`);
    });

    it('exportläget vid 10, scenariot sparat på skärmen: Varav är ett streck, och scenariotabellen ger ingen differens', () => {
        const w = fonster(STRECK);
        w.eval("_forecastSaveScenario('A')");
        iExport(w);
        w.__renderTabContent('loneoversyn');
        const u = utfall(w);
        expect(u.varav).toBe('–');
        const s = scenario(w);
        // Differensen mellan scenariots Till kv-dom och de kvinnodominerade grupper utfallet visar är kostnaden för de
        // maskerade kvinnodominerade grupperna: här den ensamma kvinnans påslag.
        const till = krTal(s['Till kv-dom']);
        const differens = till === null ? null : till - u.synlig;
        expect(differens, `differensen ${differens} är 2 % av en ensam persons lön (${ENSAM})`).toBeNull();
        expect(s['Till kv-dom']).toBe('–');
        expect(normalisera(w.document.getElementById('forecast-scenarios').textContent)).not.toContain(String(Math.round(0.02 * ENSAM)));
    });

    it('exportläget vid 10, scenariot sparat i exportläget: samma streck', () => {
        const w = iExport(fonster(STRECK));
        w.__renderTabContent('loneoversyn');
        w.eval("_forecastSaveScenario('A')");
        expect(scenario(w)['Till kv-dom']).toBe('–');
        expect(utfall(w).varav).toBe('–');
    });

    it('exportläget vid 10: när Varav står, står scenariots Till kv-dom med samma tal', () => {
        const w = fonster(STAR);
        w.eval("_forecastSaveScenario('A')");
        iExport(w);
        w.__renderTabContent('loneoversyn');
        const u = utfall(w);
        expect(u.varav).not.toBe('–');
        expect(scenario(w)['Till kv-dom']).toBe(u.varav);
    });

    it('övriga kolumner: Använt och total kostnad är utfallets summor, och lönegapen gäller hela organisationen', () => {
        const w = fonster(STRECK);
        w.eval("_forecastSaveScenario('A')");
        iExport(w);
        w.__renderTabContent('loneoversyn');
        const s = scenario(w);
        const o = w.eval('_fcBeraknaUtfall(getData())');
        expect(krTal(s['Använt/mån'])).toBe(Math.round(o.använt));
        expect(krTal(s['Total kostnad'])).toBe(Math.round(o.totalKostnad));
    });

    it('scenarierna lämnar inte verktyget: konfigurationsfilen bär dem inte, och tabellen har ingen egen CSV- eller kopieringsknapp', () => {
        const w = fonster(STRECK);
        w.eval("_forecastSaveScenario('A')");
        const cfg = JSON.stringify(w.__buildConfigSnapshot());
        expect(cfg).not.toMatch(/scenari/i);
        const host = w.document.getElementById('forecast-scenarios');
        expect(host.querySelector('table').id).toBe('');
        expect(w.document.querySelector('[data-csv-table="forecast-scenarios"], [data-copy-table="forecast-scenarios"]')).toBeNull();
    });
});

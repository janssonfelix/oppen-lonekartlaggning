// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
/**
 * Vakten för visningsminnet (ADR-81, 31-navigering.js): en färdigritad flik visas igen utan omritning bara när
 * ingenting har ändrats sedan den ritades, och visar då exakt det den skulle ha visat om den ritats om från början.
 * Här: fram och tillbaka utan ändring, det som görs efter en ritning, att vakten fäller en ökning av
 * visningsversionen som saknas, och att direkta anrop, exportläget och exportgrinden fungerar som förut. Ändringarna
 * prövas i tests/visningsminne-val.test.js och tests/visningsminne-andringar.test.js (riggen i
 * tests/helpers/visningsminne-rigg.js).
 */
import { describe, it, expect, vi } from 'vitest';
import { nav, runda, flikar, byt, jamforAlla, ritaAlla, prova, demo } from './helpers/visningsminne-rigg.js';

vi.setConfig({ testTimeout: 120000 });

describe('visningsminnet: en färdigritad flik visas igen bara när ingenting har ändrats (ADR-81)', () => {
    it('fram och tillbaka utan ändring: ingen flik ritas om, ingen regression körs, och varje flik är som ritad från början', async () => {
        const w = demo();
        await ritaAlla(w);
        await ritaAlla(w);   // det som räknades klart i bakgrunden första varvet är med
        const fore = Object.fromEntries(flikar(w).map(f => [f, runda(w, f)]));
        let regressioner = 0;
        const orig = w.runOLSRegression;
        w.runOLSRegression = function (...a) { regressioner++; return orig.apply(this, a); };
        // Varje flik öppnas efter alla de andra, också dokumentationsflikarna som ritas i exportläget.
        for (const flik of flikar(w)) await byt(w, flik);
        w.runOLSRegression = orig;
        expect(Object.fromEntries(flikar(w).map(f => [f, runda(w, f)]))).toEqual(fore);
        expect(regressioner).toBe(0);
        expect(flikar(w).length).toBeGreaterThan(12);
        expect(await jamforAlla(w)).toEqual([]);
    });

    it('menyn, sidindexet och efter-anropen görs också när fliken visas igen', async () => {
        const w = demo();
        await ritaAlla(w);
        await byt(w, 'struktur');
        const r = runda(w, 'struktur');
        await byt(w, 'dashboard');
        let efter = 0;
        w.klickaFlik(nav(w, 'struktur'), { uppskjut: true, efter: () => { efter++; } });
        expect(runda(w, 'struktur')).toBe(r);                                    // visas direkt, utan omritning
        expect(efter).toBe(1);
        expect(w.document.getElementById('view-struktur').hasAttribute('aria-busy')).toBe(false);
        expect(w.document.querySelector('#view-regression .flow-next-bar')).not.toBeNull();   // Nästa steg står i fliken som visas
        expect(w.document.querySelector('#view-dashboard .flow-next-bar')).toBeNull();
        expect(w.document.getElementById('page-title').textContent).toBe('Lönestruktur');
        expect(w.document.querySelector('#sidindex a[data-sidindex^="avsnitt-struktur"], #sidindex a[data-sidindex]')).not.toBeNull();
    });

    it('vakten fäller en ändring som inte ökar visningsversionen', async () => {
        const w = demo();
        await ritaAlla(w);
        await byt(w, 'dashboard');
        // En konfigurationsfil utan ökningen (som om applyConfigSnapshot saknade den): Prioritering visar då det som
        // ritades med den förra kostnadsperioden.
        const snap = w.__buildConfigSnapshot();
        const visningNy = w.visningNy;
        w.visningNy = () => {};
        w.__applyConfigSnapshot({ ...snap, kostnad: { ...snap.kostnad, manader: 9 } });
        w.visningNy = visningNy;
        const fel = await jamforAlla(w);
        expect(fel.map(f => f.split('\n')[0])).toContain('prioritering');
        // Med ökningen visas ingenting som det var.
        expect(await prova(w, 'dashboard', w => { w.__applyConfigSnapshot({ ...snap, kostnad: { ...snap.kostnad, manader: 4 } }); })).toEqual([]);
    });

    it('direkta anrop, exportläget och klick från koden ritar alltid', async () => {
        const w = demo();
        await ritaAlla(w);
        await byt(w, 'dashboard');
        const r = runda(w, 'struktur');
        nav(w, 'struktur').click();                                             // ett klick från koden
        expect(runda(w, 'struktur')).toBe(r + 1);
        w.__renderTabContent('struktur');
        expect(runda(w, 'struktur')).toBe(r + 2);
        // Ritad i exportläget medan den inte syns (som exportgrinden gör): fliken visas inte som den är utan ritas om.
        await byt(w, 'dashboard');
        w.eval('medExportLage(() => renderTabContent("struktur"))');
        expect(runda(w, 'struktur')).toBe(r + 3);
        await byt(w, 'struktur');
        expect(runda(w, 'struktur')).toBe(r + 4);
        await byt(w, 'dashboard');
        await byt(w, 'struktur');
        expect(runda(w, 'struktur')).toBe(r + 4);
        // Exportgrinden: en flik som visas igen räknas som aktuell bara när den ritats i den generation som gäller.
        await byt(w, 'dashboard');
        w.eval('medExportLage(() => 0)');                                        // en exports tur och retur: ny generation
        await byt(w, 'struktur');
        expect(runda(w, 'struktur')).toBe(r + 4);
        expect(w.eval('flikInaktuell("struktur")')).toBe(true);
        expect(w.eval('exportSakra(document.getElementById("regression-card"))')).toBe(true);
        expect(runda(w, 'struktur')).toBe(r + 5);
        expect(w.eval('flikInaktuell("struktur")')).toBe(false);
    });
    it('tröskeln från fältet (stegvis omritning)', async () => {
        const w = demo();
        expect(await prova(w, 'struktur', async w => {
            const falt = w.document.getElementById('k-troskel');
            falt.value = '14';
            falt.dispatchEvent(new w.Event('change', { bubbles: true }));
            await w.eval('_omritningPagar || Promise.resolve()');
        })).toEqual([]);
    });

});

// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
/**
 * Vakten för visningsminnet (ADR-81): det som ändrar det som visas utan en händelse i sidan — en ny lönefil, ett
 * organisationspaket, en konfigurationsfil, rensningen efter en tid och bakgrundsberäkningarna som blir klara. Efter
 * varje ändring öppnas varje flik igen och jämförs med samma flik ritad från början (tests/helpers/visningsminne-rigg.js).
 */
import { describe, it, expect, vi } from 'vitest';
import { papa, csvFil } from './helpers/granssnitt-rigg.js';
import { nav, vanta, byt, jamforAlla, ritaAlla, ritaAllaDirekt, prova, demo, lonefil, lasInLonefil } from './helpers/visningsminne-rigg.js';

vi.setConfig({ testTimeout: 120000 });

describe('visningsminnet: en färdigritad flik visas igen bara när ingenting har ändrats (ADR-81)', () => {
    it('en ny lönefil, ett organisationspaket, en konfigurationsfil och rensningen', async () => {
        const w = demo();
        expect(await prova(w, 'kon', w => lasInLonefil(w, lonefil())), 'ny lönefil').toEqual([]);
        const paket = w.eval(`JSON.stringify(_opByggPaket({ organisation: 'Exempelorganisationen', skapat: '2026-10-01',
            installningar: { months: 6 },
            referens: { namn: 'Ställningstagande', rader: [{ aid: null, bas: 'A', p10: 25000, med: 30000, p90: 36000 }, { aid: null, bas: 'C', p10: 30000, med: 35000, p90: 41000 }] } }))`);
        expect(await prova(w, 'struktur', w => { expect(w.lasInPaket(paket).ok).toBe(true); }), 'paketet').toEqual([]);
        const snap = w.__buildConfigSnapshot();
        expect(await prova(w, 'dashboard', w => { w.__applyConfigSnapshot({ ...snap, kostnad: { ...snap.kostnad, manader: 9 } }); }), 'konfigurationsfilen').toEqual([]);
        expect(await prova(w, 'prioritering', w => w.__autoClearOnInactivity()), 'rensningen efter en tid').toEqual([]);
    });

    it('bakgrundsberäkningar som blir klara: skattningarna efter ett tröskelbyte, kvantilregressionens intervall och inläsningens efterarbete', async () => {
        const w = demo();
        await ritaAlla(w);
        // Skattningarna (bootstrap-KI, styrkan) räknas i bakgrunden när golvet ändras. Flikarna ritas innan de är klara.
        w.eval('sattKTroskel(15, { fraga: false })');
        expect(w.eval('!!_bakgrundsrakning')).toBe(true);
        ritaAllaDirekt(w);
        await byt(w, 'filer');
        await w.eval('_bakgrundsrakning || Promise.resolve()');
        expect(await jamforAlla(w), 'skattningarna').toEqual([]);
        // Kvantilregressionens intervall: Lönestruktur ritas med raden "räknas i bakgrunden", sedan blir intervallet klart.
        await byt(w, 'struktur');
        w.eval('_regKvantilMinne = null; renderTabContent("struktur")');
        expect(w.eval('!!_regKvantilBakgrund')).toBe(true);
        ritaAllaDirekt(w);
        w.klickaFlik(nav(w, 'dashboard'), { uppskjut: true });
        await w.eval('_regKvantilKlar()');
        expect(await jamforAlla(w), 'kvantilregressionen').toEqual([]);
        // Inläsningens efterarbete (skevheten, kurvorna per kön, bootstrap-KI, Att göra) körs efter att gränssnittet målats.
        papa(w);
        w.loadStructureFile(csvFil(w, lonefil(300), 'lonefil.csv'));
        const status = () => w.document.getElementById('data-status').textContent;
        for (let i = 0; i < 500 && !/förbereder analyser/.test(status()); i++) await vanta(1);
        expect(status()).toMatch(/förbereder analyser/);
        ritaAllaDirekt(w);
        for (let i = 0; i < 500 && /förbereder analyser/.test(status()); i++) await vanta(5);
        expect(await jamforAlla(w), 'inläsningens efterarbete').toEqual([]);
    });

});

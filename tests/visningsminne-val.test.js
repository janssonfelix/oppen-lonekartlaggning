// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
/**
 * Vakten för visningsminnet (ADR-81): ett val i varje flik som har val, och tröskeln, förhandsvisningen, modellvalet
 * och markeringen från koden. Efter varje ändring öppnas varje flik igen och jämförs med samma flik ritad från början
 * (tests/helpers/visningsminne-rigg.js).
 */
import { describe, it, expect, vi } from 'vitest';
import { flikar, byt, vila, jamforAlla, ritaAlla, prova, demo } from './helpers/visningsminne-rigg.js';

vi.setConfig({ testTimeout: 120000 });

describe('visningsminnet: en färdigritad flik visas igen bara när ingenting har ändrats (ADR-81)', () => {
    it('ett val i varje flik som har val', async () => {
        const w = demo();
        await ritaAlla(w);
        const provade = [];
        for (const flik of flikar(w)) {
            await byt(w, flik);
            const paneler = w.eval(`PANEL_GROUPS[${JSON.stringify(flik)}] || [${JSON.stringify(flik)}]`).map(p => w.document.getElementById('view-' + p)).filter(Boolean);
            const val = paneler.flatMap(p => [...p.querySelectorAll('select')]).find(s => !s.disabled && s.options.length > 1);
            if (!val) continue;
            val.selectedIndex = (val.selectedIndex + 1) % val.options.length;
            val.dispatchEvent(new w.Event('change', { bubbles: true }));
            provade.push(`${flik}#${val.id}`);
            await vila(w);
            const fel = await jamforAlla(w);
            expect(fel, `val i ${flik} (#${val.id})`).toEqual([]);
        }
        expect(provade.length).toBeGreaterThan(5);
    });

    it('tröskeln, förhandsvisningen, modellvalet och markeringen från koden', async () => {
        const w = demo();
        expect(await prova(w, 'matrix', w => w.eval('sattKTroskel(12, { fraga: false })')), 'tröskeln').toEqual([]);
        expect(await prova(w, 'dashboard', w => w.eval('sattForhandsvisning(true)')), 'förhandsvisningen på').toEqual([]);
        expect(await prova(w, 'dashboard', w => w.eval('sattForhandsvisning(false)')), 'förhandsvisningen av').toEqual([]);
        expect(await prova(w, 'filer', w => w.eval('sattForklaringsmodell({ ...forklaringsmodell(), alder: !forklaringsmodell().alder })').andrad), 'modellvalet').toEqual([]);
        expect(await prova(w, 'benchmark', w => w.eval("sattDiagramMarkering('bas:C')")), 'markeringen').toEqual([]);
    });

});

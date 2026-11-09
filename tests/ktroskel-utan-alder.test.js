// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
/**
 * Lönefil utan ålder (ADR-64): hela verktyget och varje utdataväg (Word, Excel, ZIP, utskrift, dossierer)
 * med bara BAS, AID, lön och kön. Inget får krascha, och fliken Ålder & karriär är låst.
 */
import { describe, it, expect, vi } from 'vitest';
import { fonsterKon, iExport, samlaUtdata } from './helpers/ktroskel-rigg.js';

vi.setConfig({ testTimeout: 120000 });   // samlaUtdata går igenom varje utdataväg, som i ktroskel-invarianter

const utanAlder = w => {
    w.__state.data = w.__state.data.map(r => ({ ...r, alder: 0 }));
    w.eval('invalidateStatCaches(); populateSelects(); unlockTabs();');
    return w;
};

describe('lönefil utan ålder: hela kedjan', () => {
    it('varje utdataväg byggs utan internt fel', async () => {
        const w = iExport(utanAlder(fonsterKon(null)));
        w.__state._interntFel = [];
        const ut = await samlaUtdata(w);
        expect(w.__state._interntFel, JSON.stringify(w.__state._interntFel)).toEqual([]);
        const namn = ut.map(([n]) => n);
        for (const vag of ['Word-utkastet', 'utskrift: komplett', 'ZIP Excel-filen']) expect(namn).toContain(vag);
        expect(namn.some(n => n.startsWith('Excel alla flikar'))).toBe(true);
        const word = ut.find(([n]) => n === 'Word-utkastet')[1];
        expect(word).toContain('Att ålder räknas bort är ett metodval');
    });
    it('fliken Ålder & karriär är låst med tipset om ålder', () => {
        const w = utanAlder(fonsterKon(null));
        const flik = w.document.querySelector('.nav-item[data-tab="kon"]');
        expect(flik.getAttribute('aria-disabled')).toBe('true');
        expect(flik.getAttribute('title')).toBe('Kräver ålder i lönefilen');
    });
});

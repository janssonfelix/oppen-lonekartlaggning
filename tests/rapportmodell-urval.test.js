// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
/**
 * Urvalets namn i rapportmodellen (58-rapportmodell.js, rapportUrval): ett förval med bilagan ikryssad heter förvalet
 * med tillägget "+ bilaga", alla avsnitt heter "Alla avsnitt", allt annat är ett eget urval.
 */
import { describe, it, expect, vi } from 'vitest';
import { createAppWindow } from './helpers/app-harness.js';

vi.setConfig({ testTimeout: 60000 });

const namn = (w, u) => { w.__u = u; w.eval('sattRapportUrval(window.__u)'); return w.eval('rapportUrval()').namn; };

describe('urvalets namn', () => {
    const w = createAppWindow();
    const AVSNITT = w.eval('[...RM_AVSNITT]');
    const forval = id => w.eval(`[...RM_URVAL.${id}.med]`);
    const medBilaga = id => AVSNITT.filter(a => forval(id).includes(a) || a === 'dossierer');

    it('ett förval utan ändring heter förvalet', () => {
        expect(namn(w, 'hela')).toBe('Hela dokumentationen');
        expect(namn(w, 'ledning')).toBe('Ledningsbrief');
        expect(namn(w, 'facklig')).toBe('Facklig dialog');
    });
    it('ett förval med bilagan ikryssad heter förvalet + bilaga', () => {
        expect(namn(w, { ordning: AVSNITT, med: medBilaga('ledning') })).toBe('Ledningsbrief + bilaga');
        expect(namn(w, { ordning: AVSNITT, med: medBilaga('facklig') })).toBe('Facklig dialog + bilaga');
    });
    it('alla avsnitt med heter Alla avsnitt', () => {
        expect(namn(w, { ordning: AVSNITT, med: AVSNITT })).toBe('Alla avsnitt');
    });
    it('en annan avvikelse är ett eget urval', () => {
        expect(namn(w, { ordning: AVSNITT, med: medBilaga('ledning').filter(a => a !== 'lika') })).toBe(`Eget urval (4 av ${AVSNITT.length} avsnitt)`);
        expect(namn(w, { ordning: AVSNITT, med: ['sammanfattning'] })).toBe(`Eget urval (1 av ${AVSNITT.length} avsnitt)`);
    });
});

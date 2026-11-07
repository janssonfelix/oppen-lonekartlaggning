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

describe('förhandsbeskedet vid ett ändrat kryss räknar inte om avsnitten', () => {
    const w = createAppWindow();
    w.__loadDemoData();
    w.document.querySelector('.nav-item[data-tab="dokumentera"]').click();
    const besked = () => w.document.getElementById('besked-word').textContent;
    const kryssa = (id, pa) => {
        const ruta = /** @type {HTMLInputElement} */ (w.document.querySelector(`[data-urval-med="${id}"]`));
        ruta.checked = pa; ruta.dispatchEvent(new w.Event('change', { bubbles: true }));
    };
    const raknade = fn => {
        w.eval(`window.__antal = 0; window.__orig = runOLSRegression; runOLSRegression = function () { window.__antal++; return window.__orig.apply(this, arguments); };`);
        try { fn(); } finally { w.eval('runOLSRegression = window.__orig;'); }
        return w.__antal;
    };

    it('ett kryss ur och i: beskedet följer urvalet, utan ny regression', () => {
        const fore = besked();
        expect(fore).toMatch(/Hela dokumentationen · 13 avsnitt/);
        expect(raknade(() => kryssa('metod', false))).toBe(0);
        expect(besked()).toMatch(/Eget urval \(12 av 14 avsnitt\) · 12 avsnitt/);
        expect(w.document.querySelector('[data-urval-med="metod"]').checked).toBe(false);
        expect(raknade(() => kryssa('metod', true))).toBe(0);
        expect(besked()).toBe(fore);
    });
    it('bilagan ikryssad: beskedet räknar bilagan, utan ny regression', () => {
        expect(raknade(() => kryssa('dossierer', true))).toBe(0);
        expect(besked()).toMatch(/Alla avsnitt · 14 avsnitt/);
        expect(w.eval('rapportModell()').avsnitt.map(a => a.id)).toContain('dossierer');
        kryssa('dossierer', false);
        expect(besked()).toMatch(/Hela dokumentationen · 13 avsnitt/);
    });
    it('en annan ändring räknar om: ett nytt urval ur listans knappar ger rätt besked', () => {
        w.document.querySelector('[data-urval-fast="ledning"]').click();
        expect(besked()).toMatch(/Ledningsbrief · 4 avsnitt/);
        w.document.querySelector('[data-urval-fast="hela"]').click();
        expect(besked()).toMatch(/Hela dokumentationen · 13 avsnitt/);
    });
    it('minnet bär bara det beskedet räknar, och ingen fil ritas ur det (ADR-17)', () => {
        const minne = w.eval('JSON.stringify(_rmMinne.avsnitt.fasta)');
        const delar = w.eval('_rmMinne.avsnitt.fasta.flatMap(a => a.delar)');
        expect(delar.length).toBeGreaterThan(0);
        expect(delar.every(p => Object.keys(p).join() === 'typ')).toBe(true);
        expect(minne).not.toMatch(/konPct|kolumner|rader/);
        // Utan besked byggs modellen alltid på nytt, också när urvalet sägs vara det enda som ändrats.
        expect(raknade(() => w.eval('rapportModellBada({ ateranvand: true })'))).toBeGreaterThan(0);
    });
    it('en inmatning någon annanstans i sidan, eller en ny tröskel, gör minnet ogiltigt', () => {
        w.document.body.dispatchEvent(new w.Event('input', { bubbles: true }));
        expect(raknade(() => kryssa('metod', false))).toBeGreaterThan(0);
        expect(raknade(() => kryssa('metod', true))).toBe(0);
        w.eval('sattKTroskel(7, { fraga: false, rita: false })');   // utan omritning: bara nyckeln ser ändringen
        expect(raknade(() => kryssa('metod', false))).toBeGreaterThan(0);
        kryssa('metod', true);
    });
});

describe('Excel-filens bladlista i förhandsbeskedet', () => {
    it('räknar inte regressionen för att veta att bladet Underlagets kvalitet följer med', () => {
        const w = createAppWindow();
        w.__loadDemoData();
        w.eval(`window.__antal = 0; window.__orig = runOLSRegression; runOLSRegression = function () { window.__antal++; return window.__orig.apply(this, arguments); };`);
        const blad = w.eval('excelAlltBlad()');
        w.eval('runOLSRegression = window.__orig;');
        expect(blad).toContain('Underlagets kvalitet');
        expect(w.__antal).toBe(0);
    });
});

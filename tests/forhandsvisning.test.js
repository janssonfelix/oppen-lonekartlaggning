// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
// Förhandsvisning av exporten (ADR-51): skärmen i exportläget tills användaren stänger av den, och vad ett
// tröskelbyte räknar om.
import { describe, it, expect, vi } from 'vitest';
import { fonster, ritaAlla, oppnaFlik, synliga, SENT_MELLAN, SENT_SMA } from './helpers/ktroskel-rigg.js';

vi.setConfig({ testTimeout: 60000 });

describe('förhandsvisning: Som export', () => {
    it('knappen byter till exportläget, visar bannern och ramen, och det som syns ritas om; av igen ritar tillbaka', () => {
        const w = fonster(null);
        ritaAlla(w);
        oppnaFlik(w, 'matrix');
        const d = w.document;
        expect(synliga(w, SENT_MELLAN).length).toBeGreaterThan(0);             // skärmen visar grupperna om 20
        expect(w.__state.kTroskel).toBe(10);
        d.getElementById('btn-forhandsvisa').click();
        expect(w.__state.kLage).toBe('export');
        expect(d.body.classList.contains('forhandsvisning')).toBe(true);
        expect(d.getElementById('btn-forhandsvisa').getAttribute('aria-pressed')).toBe('true');
        expect(d.getElementById('forhandsvisning-banner').hidden).toBe(false);
        expect(d.getElementById('forhandsvisning-banner').textContent).toMatch(/färre än 10 personer/);
        // Omritningen från gränssnittet är stegvis; här körs den klar direkt.
        return w.eval('_renderaOmAllaFlikarStegvis()').then(() => {
            expect(synliga(w, SENT_SMA)).toEqual([]);                          // vid 10 är grupperna om 6 borta; de om 20 kvar
            expect(synliga(w, SENT_MELLAN).length).toBeGreaterThan(0);
            w.eval('sattKTroskel(25, { fraga: false })');
            expect(synliga(w, SENT_MELLAN)).toEqual([]);                       // i förhandsvisningen följer skärmen tröskeln
            expect(d.getElementById('forhandsvisning-banner').textContent).toMatch(/färre än 25 personer/);
            // En export medan förhandsvisningen är på lämnar läget som det är.
            w.eval('excelAlltBlad()');
            expect(w.__state.kLage).toBe('export');
            d.getElementById('btn-forhandsvisa-av').click();
            expect(w.__state.kLage).toBe('skarm');
            expect(d.body.classList.contains('forhandsvisning')).toBe(false);
            expect(d.getElementById('forhandsvisning-banner').hidden).toBe(true);
            return w.eval('_renderaOmAllaFlikarStegvis()');
        }).then(() => {
            expect(synliga(w, SENT_MELLAN).length).toBeGreaterThan(0);             // skärmen visar grupperna igen
        });
    });
    it('medan en export pågår byts inget, och utan lönefil byts bara läget', () => {
        const w = fonster(null);
        expect(w.eval('medExportLage(() => sattForhandsvisning(true))')).toBe(false);
        expect(w.__state.kLage).toBe('skarm');
        expect(w.eval('sattForhandsvisning(true)')).toBe(true);
        expect(w.eval('sattForhandsvisning(true)')).toBe(false);                 // redan på
        expect(w.eval('sattForhandsvisning(false)')).toBe(true);
    });
});

describe('tröskelbytet räknar bara om det som beror på tröskeln', () => {
    it('bootstrap-KI och styrkan står kvar när det statistiska golvet är detsamma, och räknas om i bakgrunden när det ändras', async () => {
        const w = fonster(null);
        w.eval('invalidateStatCaches()');
        const ci = w.__state.bootstrapCI, styrka = w.__state.powerAnalysis;
        expect(ci).not.toBeNull();
        w.eval('sattKTroskel(8, { fraga: false })');                            // statGolv 10 → 10
        expect(w.__state.bootstrapCI).toBe(ci);
        expect(w.__state.powerAnalysis).toBe(styrka);
        w.eval('sattKTroskel(12, { fraga: false })');                           // statGolv 10 → 12: räknas om i bakgrunden
        expect(w.__state.bootstrapCI).toBeNull();
        expect(w.document.getElementById('data-status').textContent).toMatch(/förbereder analyser i bakgrunden/);
        await w.eval('_skattningarIBakgrunden()');
        expect(w.__state.bootstrapCI).not.toBeNull();
        expect(w.__state.bootstrapCI).not.toBe(ci);
        expect(w.document.getElementById('data-status').textContent).not.toMatch(/förbereder analyser/);
    });
    it('Att göras lista byggs en gång för Att göra och processöversikten tillsammans', () => {
        const w = fonster(null);
        w.eval('window.__byggda = 0; const __b = buildActionChecklist; buildActionChecklist = function (...a) { window.__byggda++; return __b.apply(null, a); };');
        w.eval('renderOversiktDelar()');
        expect(w.__byggda).toBe(1);
        w.eval('window.__byggda = 0; _renderaOmAllaFlikar()');
        expect(w.__byggda).toBe(1);
        w.eval('window.__byggda = 0; renderProcessTracker()');                 // ensam bygger den själv
        expect(w.__byggda).toBe(1);
    });
});

describe('regressionen körs en gång per funktion, inte en gång per läsare (ADR-17 utan cache)', () => {
    it('Att göra kör regressionen en gång och skickar den vidare till underlagsbedömningen', () => {
        const w = fonster(null);
        w.eval('window.__ols = 0; const __r = runOLSRegression; runOLSRegression = function () { window.__ols++; return __r(); };');
        w.eval('buildActionChecklist()');
        expect(w.__ols).toBe(1);
        w.eval('window.__ols = 0; buildActionChecklist({ endastGrupper: true })');
        expect(w.__ols).toBe(0);
        w.eval('window.__ols = 0; rapportunderlagBlock()');
        expect(w.__ols).toBeLessThanOrEqual(2);                               // ett för blocken, inga fler ur underlagsbedömningen
    });
});

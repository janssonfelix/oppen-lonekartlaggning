// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
// Årsbokslutet i verktyget (ADR-54): byggs i exportläget, följer med konfigurationsfilen, och panelen i Dokumentera
// visar skillnaden mot förra året. Riggen har grupper om 20 (synliga vid 10) och om 6 (dolda vid 10).
import { describe, it, expect, vi } from 'vitest';
import { fonster, SENT_MELLAN, SENT_SMA } from './helpers/ktroskel-rigg.js';
import { createAppWindow } from './helpers/app-harness.js';

vi.setConfig({ testTimeout: 60000 });

describe('årsbokslutet i verktyget', () => {
    it('byggs med den inställda tröskeln: grupperna om 6 finns inte i det, och skärmen är kvar i skärmläget', () => {
        const w = fonster(null);
        const b = w.eval('byggArsbokslutNu()');
        expect(b).toMatchObject({ version: 1, k: 10 });
        expect(b.ar).toBe(new Date().getFullYear());
        const text = JSON.stringify(b);
        for (const s of SENT_SMA) expect(text).not.toContain(String(s));
        expect(b.grupper.length).toBeGreaterThan(0);
        expect(b.grupper.every(g => g.nKv >= 10 && g.nMa >= 10)).toBe(true);
        expect(w.__state.kLage).toBe('skarm');
        expect(text).not.toMatch(/"lon"|radnr/);
    });
    it('konfigurationsfilen bär bokslutet; inläst blir det förra årets, och panelen visar jämförelsen', () => {
        const a = fonster(null);
        const cfg = JSON.parse(JSON.stringify(a.__buildConfigSnapshot()));
        expect(cfg.arsbokslut).toMatchObject({ version: 1, k: 10 });
        // Nästa år: samma underlag, ett bokslut från förra året i filen.
        cfg.arsbokslut.ar = cfg.arsbokslut.ar - 1;
        cfg.arsbokslut.skapat = `${cfg.arsbokslut.ar}-11-01`;
        cfg.arsbokslut.grupper[0].flaggad = !cfg.arsbokslut.grupper[0].flaggad;   // en grupp bytte läge
        const w = fonster(null);
        w.__cfg = cfg;
        w.eval('applyConfigSnapshot(window.__cfg)');
        expect(w.__state.forraArsbokslut).toMatchObject({ ar: cfg.arsbokslut.ar });
        w.__renderTabContent('dokumentera');
        const host = w.document.getElementById('arsjamforelse');
        expect(host.textContent).toContain(`Förra årets bokslut: ${cfg.arsbokslut.ar}`);
        expect(host.textContent).toContain('Nyckeltal');
        expect(host.textContent).toContain('Att göra');
        expect(host.querySelectorAll('table').length).toBeGreaterThanOrEqual(2);
        expect(host.textContent).toMatch(/Nya flaggade \(\d+\)|Inte längre flaggade \(\d+\)/);
        for (const s of [...SENT_SMA]) expect(host.textContent).not.toContain(String(s));
        expect(w.__state.kLage).toBe('skarm');
        // Rensa all data tar bort det.
        w.eval('_rensaAllData({ inbakat: false })');
        expect(w.__state.forraArsbokslut).toBeNull();
    });
    it('utan bokslut säger panelen hur man får ett; ett trasigt bokslut i filen ger en varning, inte ett stopp', () => {
        const w = createAppWindow();
        w.__renderTabContent('dokumentera');
        expect(w.document.getElementById('arsjamforelse').textContent).toContain('Inget årsbokslut inläst');
        const cfg = JSON.parse(JSON.stringify(w.__buildConfigSnapshot()));
        expect(cfg.arsbokslut).toBeNull();
        cfg.arsbokslut = { ar: 'förra året' };
        w.__cfg = cfg;
        const r = w.eval('applyConfigSnapshot(window.__cfg)');
        expect(JSON.stringify(r)).toMatch(/årsbokslut gick inte att läsa/);
        expect(w.__state.forraArsbokslut).toBeNull();
    });
});

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

describe('årsjämförelsen i rapporten, rapportunderlaget och som hantel (ADR-54)', () => {
    const medBokslut = () => {
        const a = fonster(null);
        const cfg = JSON.parse(JSON.stringify(a.__buildConfigSnapshot()));
        cfg.arsbokslut.ar -= 1; cfg.arsbokslut.skapat = `${cfg.arsbokslut.ar}-11-01`;
        // Vartannat yrke var sämre förra året (närmar sig lika lön i år), vart tredje oförändrat men flaggat.
        cfg.arsbokslut.grupper.forEach((g, i) => { if (i % 2) { g.gapPct -= 4; g.flaggad = true; } else if (i % 3 === 0) g.flaggad = true; });
        const w = fonster(null);
        w.__cfg = cfg; w.eval('applyConfigSnapshot(window.__cfg)');
        return { w, cfg };
    };
    it('utan bokslut har rapporten sina tolv avsnitt; med bokslut står Jämförelse med förra året efter Åtgärder och tidsplan, också i ledningsbriefen', () => {
        const u = fonster(null);
        expect(u.eval('rapportModell({ alla: true })').avsnitt.map(a => a.id)).not.toContain('arsjamforelse');
        expect(u.eval('rapportModell({ alla: true })').avsnitt).toHaveLength(12);
        const { w, cfg } = medBokslut();
        const ids = w.eval('rapportModell({ alla: true })').avsnitt.map(a => a.id);
        expect(ids[ids.indexOf('atgarder') + 1]).toBe('arsjamforelse');
        expect(w.eval('rapportUrval()').namn).toBe('Hela dokumentationen');
        const avsnitt = w.eval('rapportModell()').avsnitt.find(a => a.id === 'arsjamforelse');
        expect(avsnitt.rubrik).toMatch(/^\d+\. Jämförelse med förra året$/);
        const tabeller = avsnitt.delar.filter(p => p.typ === 'tabell');
        expect(tabeller[0].kolumner.map(c => c.rubrik)).toEqual(['Mått', String(cfg.arsbokslut.ar), String(cfg.arsbokslut.ar + 1), 'Skillnad']);
        expect(avsnitt.delar.some(p => p.typ === 'diagram' && p.id === 'chart-arsjamforelse')).toBe(true);
        expect(avsnitt.delar.filter(p => p.typ === 'rubrik').map(p => p.text)).toEqual(['Lika arbete', 'Att göra']);
        for (const s of SENT_SMA) expect(JSON.stringify(avsnitt)).not.toContain(String(s));
        w.eval("sattRapportUrval('ledning')");
        expect(w.eval('rapportModell()').avsnitt.map(a => a.id)).toContain('arsjamforelse');
        w.eval("sattRapportUrval({ ordning: ['sammanfattning', 'lika'], med: ['sammanfattning', 'lika'] })");
        expect(w.eval('rapportModell()').avsnitt.map(a => a.id)).not.toContain('arsjamforelse');   // utan Åtgärder följer den inte med
        expect(w.eval('_buildDocumentationDraftHtml()')).not.toContain('Jämförelse med förra året');
        w.eval("sattRapportUrval('hela')");
        expect(w.eval('_buildDocumentationDraftHtml()')).toContain('Jämförelse med förra året');
    });
    it('rapportunderlaget får blocket, panelen ritar hanteln med båda årens värden, och rapportens bild kommer därifrån', () => {
        const { w, cfg } = medBokslut();
        const block = w.eval('rapportunderlagBlock()').find(b => b.id === 'arsjamforelse');
        expect(block).toBeTruthy();
        expect(block.tabell.rubriker).toEqual(['Mått', String(cfg.arsbokslut.ar), String(cfg.arsbokslut.ar + 1), 'Skillnad']);
        w.__renderTabContent('dokumentera');
        expect(w.document.querySelector('[data-rapport-kopiera="arsjamforelse"]')).not.toBeNull();
        const el = w.document.getElementById('chart-arsjamforelse');
        expect(el && el._figur).toBeTruthy();
        const f = el._figur;
        expect(f.lager.slice(0, 3).map(l => l.marke)).toEqual(['intervall', 'punkt', 'punkt']);   // ev. ett fjärde lager: årets punkter med etiketten till vänster
        expect(f.lager[1].serie).toBe(String(cfg.arsbokslut.ar));
        expect(f.lager[2].serie).toBe(String(cfg.arsbokslut.ar + 1));
        expect(f.referens[0].x).toBe(100);
        expect(f.lager.slice(2).reduce((n, l) => n + l.data.length, 0)).toBe(f.lager[0].data.length);   // varje rad har årets punkt
        const rad = f.lager[0].data[0];
        expect(typeof rad.r.fore).toBe('number'); expect(typeof rad.r.efter).toBe('number');
        const farger = w.eval('[PALETTE.semantic.ok, PALETTE.semantic.varning, PALETTE.semantic.neutral]');
        expect(f.lager[0].data.every(d => farger.includes(d.farg))).toBe(true);                     // en färg per riktning (fjärmat sig prövas i lib-testet)
        expect(f.lager[0].data.some(d => d.farg === farger[0])).toBe(true);                         // de som närmat sig lika lön
        expect(f.lager[0].data.some(d => d.farg === farger[2])).toBe(true);                         // de oförändrade
        for (const s of SENT_SMA) expect(JSON.stringify(f)).not.toContain(String(s));
        // Rapportens bild görs ur samma figur (rmDiagramBild ritar fliken och läser den; bilden i sig går inte att göra i jsdom).
        expect(w.eval("diagramRitat(document.getElementById('chart-arsjamforelse'))")).toBe(true);
        expect(w.eval("RM_DIAGRAM.find(g => g.id === 'chart-arsjamforelse').om()")).toBe(true);
    });
});

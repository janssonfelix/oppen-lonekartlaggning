// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
// Årsbokslutet i verktyget (ADR-54): byggs i exportläget, följer med konfigurationsfilen, och panelen i Dokumentera
// visar skillnaden mot förra året. Riggen har grupper om 20 (synliga vid 10) och om 6 (dolda vid 10).
import { describe, it, expect, vi } from 'vitest';
import { fonster, normalisera, SENT_SMA, STORA, TOPP, MELLAN, SENT_MELLAN } from './helpers/ktroskel-rigg.js';
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
        w.__renderTabContent('arbetet');
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
        w.__renderTabContent('arbetet');
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
        expect(avsnitt.delar.filter(p => p.typ === 'rubrik').map(p => p.text)).toEqual(['Löneutveckling per BAS-intervall', 'Lika arbete', 'Att göra']);
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
        w.__renderTabContent('rapporttext');
        expect(w.document.querySelector('[data-rapport-kopiera="arsjamforelse"]')).not.toBeNull();
        w.__renderTabContent('arbetet');
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

describe('löneutveckling per BAS-intervall i bokslutet, i Spara och jämför år och i rapporten', () => {
    // Förra årets bokslut ur årets: medianen 500 kr lägre i varje intervall, P10 och P90 oförändrade.
    const forraArs = (cfg, andra) => {
        cfg.arsbokslut.ar -= 1; cfg.arsbokslut.skapat = `${cfg.arsbokslut.ar}-11-01`;
        if (andra) andra(cfg.arsbokslut);
        return cfg;
    };
    const lasIn = (w, cfg) => { w.__cfg = cfg; w.eval('applyConfigSnapshot(window.__cfg)'); };

    it('bokslutet bär en rad per BAS-intervall med minst k personer, byggd i exportläget; intervallen om 6 saknas', () => {
        const w = fonster(null);
        const b = w.eval('byggArsbokslutNu()');
        expect(b.basIntervall.map(r => r.bas)).toEqual([...STORA, TOPP, ...MELLAN].sort());
        const a = b.basIntervall.find(r => r.bas === MELLAN[0]);
        expect(a).toMatchObject({ n: 20, nKv: 10, nMa: 10, p10: SENT_MELLAN[0], med: SENT_MELLAN[0], p90: SENT_MELLAN[0], medKv: SENT_MELLAN[0], medMa: SENT_MELLAN[0] });
        for (const s of SENT_SMA) expect(JSON.stringify(b.basIntervall)).not.toContain(String(s));
        expect(w.__state.kLage).toBe('skarm');
    });
    it('ett intervall där kvinnorna är 9 får inga könsmedianer i bokslutet', () => {
        const w = fonster(null);
        // Ett intervall med 9 kvinnor och 21 män; kvinnornas median (39 004) får inte stå i bokslutet.
        for (let i = 0; i < 30; i++) w.__state.data.push({ bas: 'J', kon: i < 9 ? 'kvinna' : 'man', lon: i < 9 ? 39000 + i : 40000 + i, alder: 30 + i, yrke: '7000 Nioyrke', aid: '7000', yrkeLabel: 'Nioyrke', enhet: '' });
        w.eval('invalidateStatCaches(); populateSelects();');
        const r = w.eval('byggArsbokslutNu()').basIntervall.find(x => x.bas === 'J');
        expect(r).toMatchObject({ n: 30, nKv: 9, nMa: 21, medKv: null, medMa: null });
        expect(JSON.stringify(r)).not.toContain('39004');
    });
    it('med demodatan och ett konstruerat förra-års-bokslut visar panelen tabellen med antal och hanteln för medianen', () => {
        const a = createAppWindow(); a.__loadDemoData();
        const cfg = forraArs(JSON.parse(JSON.stringify(a.__buildConfigSnapshot())), ab => ab.basIntervall.forEach(r => { if (typeof r.med === 'number') r.med -= 500; }));
        const w = createAppWindow(); w.__loadDemoData();
        lasIn(w, cfg);
        w.__renderTabContent('arbetet');
        const host = w.document.getElementById('arsjamforelse');
        expect(host.textContent).toContain('Löneutveckling per BAS-intervall');
        const tab = host.querySelector('#arsjamforelse-bas');
        expect(tab).not.toBeNull();
        const rubriker = [...tab.querySelectorAll('thead th')].map(th => th.textContent.trim());
        expect(rubriker[0]).toBe('BAS-intervall');
        expect(rubriker).toContain('Antal');
        expect(rubriker.filter(r => /^Median/.test(r)).length).toBeGreaterThan(0);
        const rader = [...tab.querySelectorAll('tbody tr')];
        expect(rader.length).toBe(cfg.arsbokslut.basIntervall.length);
        expect(rader[0].textContent).toContain('+500 kr');
        const fig = w.document.getElementById('chart-arsjamforelse-bas')._figur;
        expect(fig).toBeTruthy();
        expect(fig.lager[1].serie).toBe(String(cfg.arsbokslut.ar));
        expect(fig.lager[0].data.length).toBe(cfg.arsbokslut.basIntervall.filter(r => typeof r.med === 'number').length);
        expect(fig.lager[0].data[0].r.efter - fig.lager[0].data[0].r.fore).toBeCloseTo(500, 5);
        expect(w.__state.kLage).toBe('skarm');
    });
    it('ett bokslut utan fältet (äldre fil) ger en rad om att det saknas, och ingen tabell eller hantel', () => {
        const a = createAppWindow(); a.__loadDemoData();
        const cfg = forraArs(JSON.parse(JSON.stringify(a.__buildConfigSnapshot())), ab => { delete ab.basIntervall; });
        const w = createAppWindow(); w.__loadDemoData();
        lasIn(w, cfg);
        expect(w.__state.forraArsbokslut.basIntervall).toBeNull();
        w.__renderTabContent('arbetet');
        const host = w.document.getElementById('arsjamforelse');
        expect(host.textContent).toMatch(/Löneutveckling per BAS-intervall.*saknas i förra årets fil/s);
        expect(host.querySelector('#arsjamforelse-bas')).toBeNull();
        expect(w.document.getElementById('chart-arsjamforelse-bas')).toBeNull();
        expect(w.eval('rapportModell()').avsnitt.find(x => x.id === 'arsjamforelse').delar.some(p => p.typ === 'rubrik' && p.text === 'Löneutveckling per BAS-intervall')).toBe(false);
    });
    it('rapportmodellen har tabellen under avsnittet Jämförelse med förra året, med antal och förändringen', () => {
        const a = fonster(null);
        const cfg = forraArs(JSON.parse(JSON.stringify(a.__buildConfigSnapshot())), ab => ab.basIntervall.forEach(r => { r.med -= 300; }));
        const w = fonster(null); lasIn(w, cfg);
        const avsnitt = w.eval('rapportModell()').avsnitt.find(x => x.id === 'arsjamforelse');
        const i = avsnitt.delar.findIndex(p => p.typ === 'rubrik' && p.text === 'Löneutveckling per BAS-intervall');
        expect(i).toBeGreaterThan(-1);
        const tab = avsnitt.delar.slice(i).find(p => p.typ === 'tabell');
        expect(tab.kolumner[0].rubrik).toBe('BAS-intervall');
        expect(tab.kolumner.map(c => c.rubrik)).toContain('Antal');
        expect(tab.rader.length).toBe(cfg.arsbokslut.basIntervall.length);
        expect(JSON.stringify(tab.rader[0])).toContain('+300 kr');
        for (const s of SENT_SMA) expect(JSON.stringify(avsnitt)).not.toContain(String(s));
    });
});

describe('ett bokslut sparat med lägre tröskel än årets', () => {
    // Förra årets fil med k = 1 eller 5; i år gäller 10. Intervall och kön under 10 får inte lämna verktyget.
    const SMALL = [77771, 77777, 77779, 66661, 66663];
    const lagK = k => {
        const a = fonster(null);
        const cfg = JSON.parse(JSON.stringify(a.__buildConfigSnapshot()));
        cfg.arsbokslut.ar -= 1; cfg.arsbokslut.skapat = `${cfg.arsbokslut.ar}-11-01`; cfg.arsbokslut.k = k;
        cfg.arsbokslut.basIntervall = cfg.arsbokslut.basIntervall.filter(r => r.bas !== MELLAN[0] && r.bas !== STORA[0]);
        cfg.arsbokslut.basIntervall.push(k === 1 ? { bas: MELLAN[0], n: 1, nKv: 1, nMa: 0, p10: 77771, med: 77777, p90: 77779 }
            : { bas: MELLAN[0], n: 7, nKv: 4, nMa: 3, p10: 77771, med: 77777, p90: 77779 });
        cfg.arsbokslut.basIntervall.push({ bas: STORA[0], n: 150, nKv: k === 1 ? 1 : 6, nMa: 149, p10: 24000, med: 24400, p90: 24800, medKv: 66661, medMa: 66663 });
        const w = fonster(null); w.__cfg = cfg; w.eval('applyConfigSnapshot(window.__cfg)');
        return w;
    };
    for (const k of [1, 5]) {
        it(`k = ${k} i filen: inga små intervall eller kön i panelen, i rapportmodellen eller i BAS-dossierns text`, () => {
            const w = lagK(k);
            expect(w.__state.forraArsbokslut.k).toBe(Math.max(2, k));
            w.__renderTabContent('arbetet');
            const panel = normalisera(w.document.getElementById('arsjamforelse').textContent);
            const modell = normalisera(JSON.stringify(w.eval('medExportLage(() => rapportModell())').avsnitt.find(a => a.id === 'arsjamforelse')));
            const texter = [MELLAN[0], STORA[0]].map(b => normalisera(w.eval(`basdossierText(${JSON.stringify(b)})`) || ''));
            for (const [namn, t] of [['panelen', panel], ['rapportmodellen', modell], ...texter.map((t, i) => [`basdossierText ${i}`, t])]) {
                for (const s of SMALL) expect(t, `${namn}: ${s}`).not.toContain(String(s));
            }
            expect(panel).toContain('24400');   // intervallet står kvar, utan könsmedianerna
            expect(texter[1]).toContain('24400');
            expect(modell).toMatch(/minst 10 personer/);
            expect(panel).toContain('den högre av årens gränser, 10 personer');
            expect(modell).not.toMatch(/respektive års gräns/);
        });
    }
});

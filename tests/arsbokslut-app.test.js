// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
// Årsbokslutet i verktyget (ADR-54): byggs i exportläget, följer med konfigurationsfilen, och panelen i Dokumentera
// visar skillnaden mot förra året. Riggen har grupper om 20 (synliga vid 10) och om 6 (dolda vid 10). Version 2 av
// bokslutet bär handlingsplanens sakliga skäl (kategori och belopp, aldrig kommentarerna), och panelen i Spara och
// jämför år visar skälen per kategori båda åren, per grupp och de grupper som saknar bedömning i år.
import { describe, it, expect, vi } from 'vitest';
import { fonster, normalisera, SENT_SMA, STORA, TOPP, MELLAN, SENT_MELLAN } from './helpers/ktroskel-rigg.js';
import { createAppWindow } from './helpers/app-harness.js';

vi.setConfig({ testTimeout: 60000 });

const ren = t => String(t).replace(/\s+/g, ' ').trim();
const siffror = t => ren(t).replace(/(\d)\s(?=\d{3}\b)/g, '$1');
const demo = () => { const w = createAppWindow(); w.__lasInDemodata(); return w; };
const medSkal = w => Object.entries(w.__state.handlingsplan).filter(([, v]) => v.skal && v.skal.length);

describe('[B8.2] årsbokslutet i verktyget', () => {
    it('byggs med den inställda tröskeln: grupperna om 6 finns inte i det, och skärmen är kvar i skärmläget', () => {
        const w = fonster(null);
        const b = w.eval('byggArsbokslutNu()');
        expect(b).toMatchObject({ version: 2, k: 10 });
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
        const cfg = JSON.parse(JSON.stringify(a.__byggKonfiguration()));
        expect(cfg.arsbokslut).toMatchObject({ version: 2, k: 10 });
        // Nästa år: samma underlag, ett bokslut från förra året i filen.
        cfg.arsbokslut.ar = cfg.arsbokslut.ar - 1;
        cfg.arsbokslut.skapat = `${cfg.arsbokslut.ar}-11-01`;
        cfg.arsbokslut.grupper[0].flaggad = !cfg.arsbokslut.grupper[0].flaggad;   // en grupp bytte läge
        const w = fonster(null);
        w.__cfg = cfg;
        w.eval('tillampaKonfiguration(window.__cfg)');
        expect(w.__state.forraArsbokslut).toMatchObject({ ar: cfg.arsbokslut.ar });
        w.__ritaFlik('arbetet');
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
        w.__ritaFlik('arbetet');
        expect(w.document.getElementById('arsjamforelse').textContent).toContain('Inget årsbokslut inläst');
        const cfg = JSON.parse(JSON.stringify(w.__byggKonfiguration()));
        expect(cfg.arsbokslut).toBeNull();
        cfg.arsbokslut = { ar: 'förra året' };
        w.__cfg = cfg;
        const r = w.eval('tillampaKonfiguration(window.__cfg)');
        expect(JSON.stringify(r)).toMatch(/årsbokslut gick inte att läsa/);
        expect(w.__state.forraArsbokslut).toBeNull();
    });
});

describe('årsjämförelsen i rapporten, rapportunderlaget och som hantel (ADR-54)', () => {
    const medBokslut = () => {
        const a = fonster(null);
        const cfg = JSON.parse(JSON.stringify(a.__byggKonfiguration()));
        cfg.arsbokslut.ar -= 1; cfg.arsbokslut.skapat = `${cfg.arsbokslut.ar}-11-01`;
        // Vartannat yrke var sämre förra året (närmar sig lika lön i år), vart tredje oförändrat men flaggat.
        cfg.arsbokslut.grupper.forEach((g, i) => { if (i % 2) { g.gapPct -= 4; g.flaggad = true; } else if (i % 3 === 0) g.flaggad = true; });
        const w = fonster(null);
        w.__cfg = cfg; w.eval('tillampaKonfiguration(window.__cfg)');
        return { w, cfg };
    };
    it('utan bokslut har rapporten sina fjorton avsnitt (med bilagan med gruppdossierer); med bokslut står Jämförelse med förra året efter Åtgärder och tidsplan, också i ledningsbriefen', () => {
        const u = fonster(null);
        expect(u.eval('rapportModell({ alla: true })').avsnitt.map(a => a.id)).not.toContain('arsjamforelse');
        expect(u.eval('rapportModell({ alla: true })').avsnitt).toHaveLength(14);
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
        expect(w.eval('_byggWordUtkastHtml()')).not.toContain('Jämförelse med förra året');
        w.eval("sattRapportUrval('hela')");
        expect(w.eval('_byggWordUtkastHtml()')).toContain('Jämförelse med förra året');
    });
    it('rapportunderlaget får blocket, panelen ritar hanteln med båda årens värden, och rapportens bild kommer därifrån', () => {
        const { w, cfg } = medBokslut();
        const block = w.eval('rapportunderlagBlock()').find(b => b.id === 'arsjamforelse');
        expect(block).toBeTruthy();
        expect(block.tabell.rubriker).toEqual(['Mått', String(cfg.arsbokslut.ar), String(cfg.arsbokslut.ar + 1), 'Skillnad']);
        w.__ritaFlik('rapporttext');
        expect(w.document.querySelector('[data-rapport-kopiera="arsjamforelse"]')).not.toBeNull();
        w.__ritaFlik('arbetet');
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
        const farger = w.eval('[PALETT.semantic.ok, PALETT.semantic.varning, PALETT.semantic.neutral]');
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
    const lasIn = (w, cfg) => { w.__cfg = cfg; w.eval('tillampaKonfiguration(window.__cfg)'); };

    it('bokslutet bär en rad per BAS-intervall med minst k personer, byggd i exportläget; intervallen om 6 saknas', () => {
        const w = fonster(null);
        const b = w.eval('byggArsbokslutNu()');
        expect(b.basIntervall.map(r => r.bas)).toEqual([...STORA, TOPP, ...MELLAN].sort());
        const a = b.basIntervall.find(r => r.bas === MELLAN[0]);
        expect(a).toMatchObject({ n: 20, nKv: 10, nMa: 10, p10: SENT_MELLAN[0], med: SENT_MELLAN[0], p90: SENT_MELLAN[0], medKv: SENT_MELLAN[0], medMa: SENT_MELLAN[0] });
        for (const s of SENT_SMA) expect(JSON.stringify(b.basIntervall)).not.toContain(String(s));
        expect(w.__state.kLage).toBe('skarm');
    });
    it('med demodatan och ett konstruerat förra-års-bokslut visar panelen tabellen med antal och hanteln för medianen', () => {
        const a = createAppWindow(); a.__lasInDemodata();
        const cfg = forraArs(JSON.parse(JSON.stringify(a.__byggKonfiguration())), ab => ab.basIntervall.forEach(r => { if (typeof r.med === 'number') r.med -= 500; }));
        const w = createAppWindow(); w.__lasInDemodata();
        lasIn(w, cfg);
        w.__ritaFlik('arbetet');
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
        expect(rader[0].textContent).toContain('+500\u00a0kr');
        const fig = w.document.getElementById('chart-arsjamforelse-bas')._figur;
        expect(fig).toBeTruthy();
        expect(fig.lager[1].serie).toBe(String(cfg.arsbokslut.ar));
        expect(fig.lager[0].data.length).toBe(cfg.arsbokslut.basIntervall.filter(r => typeof r.med === 'number').length);
        expect(fig.lager[0].data[0].r.efter - fig.lager[0].data[0].r.fore).toBeCloseTo(500, 5);
        expect(w.__state.kLage).toBe('skarm');
    });
    it('ett bokslut utan fältet (äldre fil) ger en rad om att det saknas, och ingen tabell eller hantel', () => {
        const a = createAppWindow(); a.__lasInDemodata();
        const cfg = forraArs(JSON.parse(JSON.stringify(a.__byggKonfiguration())), ab => { delete ab.basIntervall; });
        const w = createAppWindow(); w.__lasInDemodata();
        lasIn(w, cfg);
        expect(w.__state.forraArsbokslut.basIntervall).toBeNull();
        w.__ritaFlik('arbetet');
        const host = w.document.getElementById('arsjamforelse');
        expect(host.textContent).toMatch(/Löneutveckling per BAS-intervall.*saknas i förra årets fil/s);
        expect(host.querySelector('#arsjamforelse-bas')).toBeNull();
        expect(w.document.getElementById('chart-arsjamforelse-bas')).toBeNull();
        expect(w.eval('rapportModell()').avsnitt.find(x => x.id === 'arsjamforelse').delar.some(p => p.typ === 'rubrik' && p.text === 'Löneutveckling per BAS-intervall')).toBe(false);
    });
    it('rapportmodellen har tabellen under avsnittet Jämförelse med förra året, med antal och förändringen', () => {
        const a = fonster(null);
        const cfg = forraArs(JSON.parse(JSON.stringify(a.__byggKonfiguration())), ab => ab.basIntervall.forEach(r => { r.med -= 300; }));
        const w = fonster(null); lasIn(w, cfg);
        const avsnitt = w.eval('rapportModell()').avsnitt.find(x => x.id === 'arsjamforelse');
        const i = avsnitt.delar.findIndex(p => p.typ === 'rubrik' && p.text === 'Löneutveckling per BAS-intervall');
        expect(i).toBeGreaterThan(-1);
        const tab = avsnitt.delar.slice(i).find(p => p.typ === 'tabell');
        expect(tab.kolumner[0].rubrik).toBe('BAS-intervall');
        expect(tab.kolumner.map(c => c.rubrik)).toContain('Antal');
        expect(tab.rader.length).toBe(cfg.arsbokslut.basIntervall.length);
        expect(JSON.stringify(tab.rader[0])).toContain('+300\u00a0kr');
        for (const s of SENT_SMA) expect(JSON.stringify(avsnitt)).not.toContain(String(s));
    });
});

describe('lönespridningen i bokslutet, i panelen och i rapportens tabell per BAS-intervall', () => {
    const forraArs = (cfg, andra) => {
        cfg.arsbokslut.ar -= 1; cfg.arsbokslut.skapat = `${cfg.arsbokslut.ar}-11-01`;
        if (andra) andra(cfg.arsbokslut);
        return cfg;
    };
    const lasIn = (w, cfg) => { w.__cfg = cfg; w.eval('tillampaKonfiguration(window.__cfg)'); };

    it('panelen har kolumnen Lönespridning förra året och i år i tabellen per BAS-intervall och i de flaggade gruppernas tabeller', () => {
        const a = createAppWindow(); a.__lasInDemodata();
        const cfg = forraArs(JSON.parse(JSON.stringify(a.__byggKonfiguration())), ab => ab.basIntervall.forEach(r => { r.spridning = 0.5; }));
        const w = createAppWindow(); w.__lasInDemodata();
        lasIn(w, cfg);
        w.__ritaFlik('arbetet');
        const tab = w.document.getElementById('arsjamforelse-bas');
        const forsta = [...tab.querySelectorAll('thead tr:first-child th')].map(th => th.textContent.trim());
        expect(forsta.at(-1)).toBe('Lönespridning');
        const rad = tab.querySelector('tbody tr');
        const celler = [...rad.cells].map(c => c.textContent.trim().replace(/\s+/g, ' '));
        expect(celler.at(-2)).toBe('50 %');
        const nu = w.eval('byggArsbokslutNu()').basIntervall[0].spridning;
        expect(celler.at(-1)).toBe(w.eval('svPct')(nu * 100, 0).replace(/\s+/g, ' '));
        const grupp = [...w.document.querySelectorAll('#arsjamforelse table')].find(t => /^AID-etikett/.test(t.querySelector('th').textContent));
        expect(grupp).toBeTruthy();
        expect([...grupp.querySelectorAll('thead th')].map(th => th.textContent.trim()).slice(-2)).toEqual([`Lönespridning ${cfg.arsbokslut.ar}`, `Lönespridning ${cfg.arsbokslut.ar + 1}`]);
        expect(w.document.getElementById('arsjamforelse').textContent).toContain('Lönespridning: (P90 − P10) / median');
    });

    it('rapportens tabell per BAS-intervall har kolumnen Lönespridning; en äldre fil utan fältet visar streck för förra året', () => {
        const a = fonster(null);
        const cfg = forraArs(JSON.parse(JSON.stringify(a.__byggKonfiguration())), ab => ab.basIntervall.forEach(r => { delete r.spridning; }));
        const w = fonster(null); lasIn(w, cfg);
        const avsnitt = w.eval('rapportModell()').avsnitt.find(x => x.id === 'arsjamforelse');
        const i = avsnitt.delar.findIndex(p => p.typ === 'rubrik' && p.text === 'Löneutveckling per BAS-intervall');
        const tab = avsnitt.delar.slice(i).find(p => p.typ === 'tabell');
        expect(tab.kolumner.map(c => c.rubrik)).toEqual(['BAS-intervall', 'Antal', 'P10', 'Median', 'P90', 'Lönespridning']);
        const s1 = tab.rader.find(r => r[0] === `BAS ${STORA[0]}`);
        expect(w.eval('rmCell')(s1[5], 'text')).toMatch(/^– till \d+\s%$/);
        // Panelen visar streck för förra året.
        w.__ritaFlik('arbetet');
        const rad = [...w.document.querySelectorAll('#arsjamforelse-bas tbody tr')].find(tr => tr.cells[0].textContent.trim() === `BAS ${STORA[0]}`);
        expect(rad.cells[rad.cells.length - 2].textContent.trim()).toBe('–');
    });
});

describe('ett bokslut sparat med lägre tröskel än årets', () => {
    // Förra årets fil med k = 1 eller 5; i år gäller 10. Intervall och kön under 10 får inte lämna verktyget.
    const SMALL = [77771, 77777, 77779, 66661, 66663];
    const lagK = k => {
        const a = fonster(null);
        const cfg = JSON.parse(JSON.stringify(a.__byggKonfiguration()));
        cfg.arsbokslut.ar -= 1; cfg.arsbokslut.skapat = `${cfg.arsbokslut.ar}-11-01`; cfg.arsbokslut.k = k;
        cfg.arsbokslut.basIntervall = cfg.arsbokslut.basIntervall.filter(r => r.bas !== MELLAN[0] && r.bas !== STORA[0]);
        cfg.arsbokslut.basIntervall.push(k === 1 ? { bas: MELLAN[0], n: 1, nKv: 1, nMa: 0, p10: 77771, med: 77777, p90: 77779 }
            : { bas: MELLAN[0], n: 7, nKv: 4, nMa: 3, p10: 77771, med: 77777, p90: 77779 });
        cfg.arsbokslut.basIntervall.push({ bas: STORA[0], n: 150, nKv: k === 1 ? 1 : 6, nMa: 149, p10: 24000, med: 24400, p90: 24800, medKv: 66661, medMa: 66663 });
        const w = fonster(null); w.__cfg = cfg; w.eval('tillampaKonfiguration(window.__cfg)');
        return w;
    };
    for (const k of [1, 5]) {
        it(`k = ${k} i filen: inga små intervall eller kön i panelen, i rapportmodellen eller i BAS-dossierns text`, () => {
            const w = lagK(k);
            expect(w.__state.forraArsbokslut.k).toBe(Math.max(3, k));   // K_MIN (ADR-102)
            w.__ritaFlik('arbetet');
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
            // Panelens not säger vad det betyder för de flaggade grupperna.
            expect(panel).toContain('räknas därför som ny i år');
            expect(modell).not.toMatch(/respektive års gräns/);
        });
    }
});

describe('årets bokslut bär de sakliga skälen', () => {
    it('demots tre rader med skäl står i bedomningar med nyckel, antal och skälen utan kommentar', () => {
        const w = demo();
        const b = w.eval('byggArsbokslutNu()');
        expect(b.version).toBe(2);
        const rader = medSkal(w);
        expect(b.bedomningar.map(x => x.nyckel).sort()).toEqual(rader.map(([n]) => n).sort());
        for (const x of b.bedomningar) {
            expect(x.n).toBeGreaterThanOrEqual(10);
            const v = w.__state.handlingsplan[x.nyckel];
            // En rad där ett kön är under minsta gruppstorlek (demots prioriteringsrad) bär bara kategorierna.
            expect(x.skal).toEqual(v.skal.map(s => (x.nMin >= 10 ? { kategori: s.kategori, belopp: s.belopp } : { kategori: s.kategori })));
        }
        const text = JSON.stringify(b);
        for (const [, v] of rader) for (const s of v.skal) expect(text).not.toContain(s.kommentar);
    });
    it('en egen rad följer inte med: den har inget antal att pröva mot minsta gruppstorlek', () => {
        const w = demo();
        w.eval('_hpLaggTillEgen()');
        const egen = Object.keys(w.__state.handlingsplan).find(n => n.startsWith('egen|'));
        w.eval(`_hpSattSkal(${JSON.stringify(egen)}, [{ kategori: 'annat', belopp: 500, kommentar: '' }])`);
        const b = w.eval('byggArsbokslutNu()');
        expect(b.bedomningar.some(x => x.nyckel === egen)).toBe(false);
    });
    it('utan skäl: en tom lista, så att nästa år vet att ingen grupp hade skäl', () => {
        const w = demo();
        w.__state.handlingsplan = {};
        expect(w.eval('byggArsbokslutNu()').bedomningar).toEqual([]);
    });
});

describe('panelen: Sakliga skäl per kategori', () => {
    /** Förra året: samma grupper med större belopp och en grupp som saknar skäl i år. */
    const medForra = (andra = b => b) => {
        const w = demo();
        const nu = w.eval('byggArsbokslutNu()');
        const forra = JSON.parse(JSON.stringify(nu));
        forra.ar = nu.ar - 1; forra.skapat = `${forra.ar}-11-01`;
        forra.bedomningar = forra.bedomningar.map(b => ({ ...b, skal: b.skal.map(s => ({ ...s, belopp: s.belopp + 100 })) }));
        forra.bedomningar.push({ ...forra.bedomningar[0], nyckel: 'prio|9999|Z', grupp: 'Bortflyttad grupp' });
        w.__forra = andra(forra);
        w.eval('state.forraArsbokslut = valideraArsbokslut(window.__forra)');
        w.__ritaFlik('arbetet');
        return { w, nu, host: w.document.getElementById('arsjamforelse') };
    };
    it('tabellen har kolumnerna Kategori, förra året, i år och Förändring, och en rad per kategori', () => {
        const { w, host } = medForra();
        const tabell = host.querySelector('#arsjamforelse-skal');
        expect(tabell).not.toBeNull();
        expect(ren(host.textContent)).toContain('Sakliga skäl per kategori');
        const rubriker = [...tabell.querySelectorAll('thead th')].map(t => ren(t.textContent));
        expect(rubriker[0]).toBe('Kategori');
        expect(rubriker).toContain('Förändring');
        const j = w.eval('arsjamforelse()').j.bedomningar;
        expect(tabell.querySelectorAll('tbody tr').length).toBe(j.kategorier.length + 1);
        expect(ren(tabell.querySelector('tbody tr:last-child').textContent)).toMatch(/^Totalt/);
    });
    it('per grupp: förra årets och årets skäl och hur skillnaden ändrades', () => {
        const { w, host } = medForra();
        const j = w.eval('arsjamforelse()').j.bedomningar;
        expect(j.grupper.length).toBe(3);
        const lista = host.querySelector('#arsjamforelse-skal-grupper');
        expect(lista.querySelectorAll('li').length).toBe(3);
        expect(siffror(lista.textContent)).toMatch(/: förra året \S+ .*, i år \S+ .*\. Skillnaden (minskade|ökade|är oförändrad)/);
    });
    it('ett kandidatpar märks (kandidatpar), så att det skiljs från prioriteringens rad för samma grupp', () => {
        const { w, host } = medForra();
        const j = w.eval('arsjamforelse()').j.bedomningar;
        const par = j.grupper.filter(g => g.nyckel.startsWith('par|'));
        expect(par.length).toBeGreaterThan(0);
        const li = [...host.querySelectorAll('#arsjamforelse-skal-grupper li')].map(x => ren(x.textContent));
        for (const g of par) expect(li).toContainEqual(expect.stringMatching(new RegExp(`^${g.grupp.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} \\(kandidatpar\\): `)));
    });
    it('en grupp med skäl förra året men inte i år: Bedömning saknas i år', () => {
        const { host } = medForra();
        expect(ren(host.textContent)).toMatch(/Hade sakliga skäl förra året men inte i år \(1\)\. Gruppen kan sakna skäl eller inte längre finnas i handlingsplanen:[^]*Bortflyttad grupp/);
        expect(ren(host.textContent)).toContain('Kategorierna och beloppen är organisationens bedömning. Verktyget räknar bara om beloppen till andelar av skillnaden.');
    });
    it('noten säger att grupper med bara kategorier inte räknas med i beloppen', () => {
        const { host } = medForra();
        expect(ren(host.textContent)).toContain('En grupp där ett kön hade färre personer än minsta gruppstorlek har bara kategorierna i bokslutet och räknas inte med i beloppen.');
    });
    it('förra årets fil saknar fältet: en rad om att skälen saknas, ingen tabell', () => {
        const { host } = medForra(f => { const v1 = { ...f, version: 1 }; delete v1.bedomningar; return v1; });
        expect(host.querySelector('#arsjamforelse-skal')).toBeNull();
        expect(ren(host.textContent)).toContain('De sakliga skälen saknas i förra årets fil');
    });
});

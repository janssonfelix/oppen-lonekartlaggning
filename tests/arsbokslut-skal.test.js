// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
/**
 * Årsbokslutet version 2 i verktyget: handlingsplanens sakliga skäl följer med bokslutet (kategori och belopp, aldrig
 * kommentarerna), och panelen i Spara och jämför år visar skälen per kategori båda åren, per grupp och de grupper
 * som saknar bedömning i år.
 */
import { describe, it, expect, vi } from 'vitest';
import { createAppWindow } from './helpers/app-harness.js';
vi.setConfig({ testTimeout: 60000 });

const ren = t => String(t).replace(/\s+/g, ' ').trim();
const siffror = t => ren(t).replace(/(\d)\s(?=\d{3}\b)/g, '$1');
const demo = () => { const w = createAppWindow(); w.__loadDemoData(); return w; };
const medSkal = w => Object.entries(w.__state.handlingsplan).filter(([, v]) => v.skal && v.skal.length);

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
            expect(x.skal).toEqual(v.skal.map(s => ({ kategori: s.kategori, belopp: s.belopp })));
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
        w.eval('state.forraArsbokslut = _abValidera(window.__forra)');
        w.__renderTabContent('arbetet');
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
        expect(siffror(lista.textContent)).toMatch(/Förra årets skäl: \S+ /);
        expect(ren(lista.textContent)).toContain('i år');
    });
    it('en grupp med skäl förra året men inte i år: Bedömning saknas i år', () => {
        const { host } = medForra();
        expect(ren(host.textContent)).toMatch(/Bedömning saknas i år[^]*Bortflyttad grupp/);
    });
    it('förra årets fil saknar fältet: en rad om att skälen saknas, ingen tabell', () => {
        const { host } = medForra(f => { const v1 = { ...f, version: 1 }; delete v1.bedomningar; return v1; });
        expect(host.querySelector('#arsjamforelse-skal')).toBeNull();
        expect(ren(host.textContent)).toContain('De sakliga skälen saknas i förra årets fil');
    });
});

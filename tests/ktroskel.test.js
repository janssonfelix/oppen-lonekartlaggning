/**
 * K-tröskeln som inställning: standardvärdet, bekräftelsen vid sänkning och att tröskeln styr varje flik (läsning vid 10 och 25).
 *
 * Riggen (fixturer, fönster och sökfunktioner) ligger i tests/helpers/ktroskel-rigg.js; sviten är delad i
 * åtta filer så att Vitest fördelar den över flera arbetare.
 */
import { describe, it, expect, beforeAll, vi } from 'vitest';
import { createAppWindow } from './helpers/app-harness.js';
import { FLIKAR, normalisera, synliga, fonster, ritaAlla, SENT_MELLAN, SENT_SMA, iExport } from './helpers/ktroskel-rigg.js';

// Sviten ritar om hela verktyget i varje test. Under full last tar ett test 4–6 s, så standardgränsen 5 s
// fäller olika tester från körning till körning.
vi.setConfig({ testTimeout: 30000 });

describe('k-tröskeln: standardvärde och validering', () => {
    let w;
    beforeAll(() => { w = createAppWindow(); w.__state.kLage = 'export'; });   // isKMasked prövas så som exporterna ser den
    it('är 10 vid start', () => {
        expect(w.eval('kInstalld()')).toBe(10);
        expect(w.eval('statGolv()')).toBe(10);
        expect(w.eval('isKMasked(9)')).toBe(true);
        expect(w.eval('isKMasked(10)')).toBe(false);
    });
    it.each([1, 0, -3, 2.5, 1001, '', ' ', 'tio', '10,0', '1e2', null, undefined, NaN])('avvisar %p och lämnar värdet orört', v => {
        w.__v = v;
        const r = w.eval('sattKTroskel(window.__v, { fraga: false })');
        expect(r.ok).toBe(false);
        expect(r.fel).toMatch(/heltal mellan 2 och 1000/);
        expect(w.eval('kInstalld()')).toBe(10);
    });
    it.each([[2, 2], [1000, 1000], ['12', 12], [' 15 ', 15]])('godtar %p', (v, n) => {
        w.__v = v;
        expect(w.eval('sattKTroskel(window.__v, { fraga: false })')).toMatchObject({ ok: true, varde: n });
        expect(w.eval('kInstalld()')).toBe(n);
        w.eval('sattKTroskel(10, { fraga: false })');
    });
    it('statistiska golv följer med uppåt men aldrig under 10', () => {
        w.eval('sattKTroskel(5, { fraga: false })');
        expect(w.eval('statGolv()')).toBe(10);
        w.eval('sattKTroskel(25, { fraga: false })');
        expect(w.eval('statGolv()')).toBe(25);
        w.eval('sattKTroskel(10, { fraga: false })');
    });
});

describe('k-tröskeln: bekräftelse vid sänkning under 10', () => {
    it('nekad bekräftelse behåller värdet', () => {
        const w = createAppWindow();
        w.confirm = () => false;
        expect(w.eval('sattKTroskel(5)')).toEqual({ ok: false, nekad: true });
        expect(w.eval('kInstalld()')).toBe(10);
    });
    it('frågar vid sänkning under 10, inte vid höjning eller ovanför 10', () => {
        const w = createAppWindow();
        let fragor = 0;
        w.confirm = () => { fragor++; return true; };
        w.eval('sattKTroskel(25)'); w.eval('sattKTroskel(12)');
        expect(fragor).toBe(0);
        w.eval('sattKTroskel(8)');
        expect(fragor).toBe(1);
        w.eval('sattKTroskel(9)');   // höjning, fortfarande under 10
        expect(fragor).toBe(1);
        w.eval('sattKTroskel(6)');
        expect(fragor).toBe(2);
    });
});

describe('k-tröskeln styr varje flik', () => {
    it('på skärmen syns alla grupper, oavsett tröskel (ADR-51)', () => {
        for (const k of [null, 25]) { const w = fonster(k); ritaAlla(w); expect(synliga(w, [...SENT_MELLAN, ...SENT_SMA]).length, String(k)).toBe(6); }
    });
    it('i exportläget vid 10 syns mellangrupperna, inte de små', () => {
        const w = iExport(fonster(null));
        ritaAlla(w);
        expect(synliga(w, SENT_MELLAN).length).toBeGreaterThan(0);
        expect(synliga(w, SENT_SMA)).toEqual([]);
    });
    it('i exportläget vid 25 syns varken mellangrupperna eller de små i någon flik', () => {
        const w = iExport(fonster(25));
        for (const flik of FLIKAR) {
            w.__renderTabContent(flik);
            expect(synliga(w, [...SENT_MELLAN, ...SENT_SMA]), `fliken ${flik}`).toEqual([]);
        }
    });
    it('vid 25: inget mellanvärde i Word-utkastet eller rapportunderlaget', () => {
        const w = fonster(25);
        const text = normalisera(w.__docDraftHtml() + w.__rapportunderlagBlock().map(b => w.__ruTillText(b)).join('\n'));
        for (const v of [...SENT_MELLAN, ...SENT_SMA]) expect(text.includes(String(v)), String(v)).toBe(false);
    });
    it('Word-utkastet utelämnar BAS under tröskeln och namnger dem (ADR-12)', () => {
        const hamta = k => { const w = fonster(k); const d = w.document.createElement('div'); d.innerHTML = w.__docDraftHtml(); return d.querySelector('.k-mask-note'); };
        const vid25 = hamta(25);
        expect(vid25).not.toBeNull();
        expect(vid25.textContent).toMatch(/\bA\b/);
        const vid10 = hamta(10);
        expect(vid10).not.toBeNull();
        expect(vid10.textContent).toMatch(/\bE\b/);
        expect(vid10.textContent).toMatch(/\bF\b/);
        expect(vid10.textContent).not.toMatch(/\bA\b/);
    });
    // Den kompletta rapporten byggs en gång per tröskel: lokalt ≈ 4–5 s vardera, på en delad CI-maskin
    // ungefär tre gånger så lång tid. Två test med egen tidsgräns i stället för ett som låg nära 30 s.
    const rapport = async k => {
        const w = fonster(k);
        w.eval("sattRapportUrval('hela')");   // hela dokumentationen, med bilagorna
        await w.eval('buildPrintReport()');
        return w.document.getElementById('print-report');
    };
    const basNot = el => [...el.querySelectorAll('.k-mask-note')].find(n => /BAS-intervall/.test(n.textContent))?.textContent;
    it('utskriftsrapporten (komplett) vid k = 25 namnger utelämnade BAS i stället för att visa deras median', async () => {
        const vid25 = await rapport(25);
        expect(basNot(vid25)).toMatch(/\bA\b/);
        expect(normalisera(vid25.textContent)).not.toContain('31417');
    }, 60000);
    it('utskriftsrapporten (komplett) vid k = 10 namnger utelämnade BAS i stället för att visa deras median', async () => {
        const vid10 = await rapport(10);
        expect(basNot(vid10)).toMatch(/\bE\b/);
        expect(normalisera(vid10.textContent)).not.toContain('35291');
    }, 60000);
});

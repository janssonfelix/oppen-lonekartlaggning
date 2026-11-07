/**
 * Sakliga skäl i rapporten och exporterna: tabellerna "Sakliga skäl per grupp" och "Sammanställning per kategori" i
 * handlingsplanens avsnitt (rapportmodellen, så Rapporttext, Word och PDF), Excel-bladet Sakliga skal, handlingsplanens
 * kolumner för skäl och förklarad andel, och demots förifyllda skäl på tre rader.
 */
import { describe, it, expect, vi } from 'vitest';
import { createAppWindow } from './helpers/app-harness.js';
import { laddaXlsx, fangaBocker } from './helpers/ktroskel-rigg.js';
vi.setConfig({ testTimeout: 60000 });

const ren = t => String(t).replace(/\s+/g, ' ').trim();
const demo = () => { const w = createAppWindow(); w.__loadDemoData(); return w; };
const medSkal = w => Object.entries(w.__state.handlingsplan).filter(([, v]) => v.skal && v.skal.length);
const atgarder = w => w.eval('rapportModell({ alla: true })').avsnitt.find(a => a.id === 'atgarder');

describe('demot: förifyllda skäl på tre rader', () => {
    it('tre rader som följer med i exporterna får skäl; rader med en medianskillnad först; kommentarerna har inga siffror', () => {
        const w = demo();
        const rader = medSkal(w);
        expect(rader).toHaveLength(3);
        const { nycklar, skillnader } = w.eval('medExportLage(() => { const s = _handlingsplanSeedRows(); return { nycklar: s.nycklar, skillnader: s.skillnader }; })');
        for (const [n, v] of rader) {
            expect(nycklar).toContain(n);
            for (const s of v.skal) { expect(Number.isInteger(s.belopp)).toBe(true); expect(s.kommentar).not.toMatch(/\d/); }
        }
        const medSkillnad = nycklar.filter((n, i) => skillnader[i] > 0);
        const valda = rader.map(([n]) => n);
        for (const n of medSkillnad.slice(0, 3)) expect(valda).toContain(n);
        // Rullistan och övriga fält rörs inte: Att göra-punkten står kvar tills användaren gjort sitt val.
        for (const [, v] of rader) expect([v.sakligt, v.ansvarig, v.tidsplan, v.status]).toEqual(['', '', '', '']);
    });
    it('det stora demot får också tre rader med skäl', () => {
        const w = createAppWindow();
        w.eval('loadStortDemo()');
        expect(medSkal(w)).toHaveLength(3);
    });
    it('förifyllningen skriver inte över skäl som redan finns', () => {
        const w = demo();
        const [n] = medSkal(w)[0];
        w.eval(`_hpSattSkal(${JSON.stringify(n)}, [{ kategori: 'annat', belopp: 1, kommentar: 'eget' }])`);
        w.eval('_hpDemoSkal()');
        expect(w.__state.handlingsplan[n].skal).toEqual([{ kategori: 'annat', belopp: 1, kommentar: 'eget' }]);
    });
});

describe('rapportmodellen: handlingsplanens avsnitt', () => {
    it('efter åtgärdstabellen: Sakliga skäl per grupp och Sammanställning per kategori, med en dämpad mening om bedömningen', () => {
        const w = demo();
        const a = atgarder(w);
        const tabeller = a.delar.filter(p => p.typ === 'tabell');
        expect(tabeller.length).toBe(3);
        const [, perGrupp, perKat] = tabeller;
        expect(perGrupp.kolumner.map(k => k.rubrik)).toEqual(['Grupp', 'Antal berörda', 'Medianskillnad (kr/mån)', 'Kategori', 'Belopp (kr/mån)', 'Andel av skillnaden', 'Kommentar']);
        expect(perKat.kolumner.map(k => k.rubrik)).toEqual(['Kategori', 'Belopp (kr/mån)', 'Andel av skillnaden i grupper med skäl', 'Antal grupper']);
        const rubriker = a.delar.filter(p => p.typ === 'rubrik').map(p => p.text);
        expect(rubriker).toEqual(expect.arrayContaining(['Sakliga skäl per grupp', 'Sammanställning per kategori']));
        const iTabell = a.delar.indexOf(tabeller[0]);
        expect(a.delar.indexOf(perGrupp)).toBeGreaterThan(iTabell);
        expect(a.delar.some(p => p.typ === 'stycke' && p.stil === 'dampad' && /Kategorierna och beloppen är organisationens bedömning\. Verktyget räknar bara om beloppen till andelar av skillnaden\./.test(p.text))).toBe(true);
        // En rad per skäl; gruppen står på första raden.
        const antalSkal = medSkal(w).reduce((t, [, v]) => t + v.skal.length, 0);
        expect(perGrupp.rader).toHaveLength(antalSkal);
        // Sammanställningen summerar skälen per kategori och har en rad Totalt sist.
        const sum = perKat.rader.at(-1);
        expect(sum[0]).toEqual({ text: 'Totalt', fet: true });
        const summa = medSkal(w).reduce((t, [, v]) => t + v.skal.reduce((u, s) => u + s.belopp, 0), 0);
        expect(sum[1]).toBe(summa);
    });
    it('utan skäl: inga nya tabeller', () => {
        const w = demo();
        w.__state.handlingsplan = {};
        const a = atgarder(w);
        expect(a.delar.filter(p => p.typ === 'tabell')).toHaveLength(1);
        expect(a.delar.some(p => p.typ === 'rubrik' && /Sakliga skäl per grupp/.test(p.text))).toBe(false);
    });
    it('Rapporttext visar tabellerna', () => {
        const w = demo();
        w.__renderTabContent('rapporttext');
        const text = ren(w.document.getElementById('view-rapporttext').textContent);
        expect(text).toContain('Sakliga skäl per grupp');
        expect(text).toContain('Sammanställning per kategori');
    });
});

describe('Excel: bladet Sakliga skal och handlingsplanens kolumner', () => {
    it('"Excel (alla flikar)" får bladet Sakliga skal när någon rad har skäl, och förhandsbeskedet säger det', async () => {
        const w = demo();
        await laddaXlsx(w);
        const bok = Object.values(fangaBocker(w, () => w.eval('exportAllToExcel()')))[0];
        expect(bok).toContain('[Sakliga skal]');
        expect(w.eval('excelAlltBlad()')).toContain('Sakliga skal');
        const blad = bok.slice(bok.indexOf('[Sakliga skal]'));
        expect(blad).toContain('Sammanställning per kategori');
        w.__state.handlingsplan = {};
        expect(w.eval('excelAlltBlad()')).not.toContain('Sakliga skal');
        const utan = Object.values(fangaBocker(w, () => w.eval('exportAllToExcel()')))[0];
        expect(utan).not.toContain('[Sakliga skal]');
    });
    it('handlingsplansunderlaget får kolumnerna Sakliga skäl och Förklarad andel', async () => {
        const w = demo();
        await laddaXlsx(w);
        const bok = Object.values(fangaBocker(w, () => w.eval('exportHandlingsplan()')))[0];
        const [rubrik] = bok.split('\n').slice(1);
        expect(rubrik).toMatch(/Sakliga skäl \(kategori och belopp\).*Förklarad andel av skillnaden \(%\)/);
        const [n, v] = medSkal(w)[0];
        const namn = w.eval('_sakKategorier()').find(k => k.id === v.skal[0].kategori).namn;
        expect(ren(bok).replace(/(\d)\s(?=\d{3}\b)/g, '$1')).toContain(`${namn} ${v.skal[0].belopp} kr`);   // fångsten skriver tal utan tusentalsavgränsare
        expect(n).toBeTruthy();
    });
});

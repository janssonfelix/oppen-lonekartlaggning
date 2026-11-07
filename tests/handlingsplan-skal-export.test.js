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
        // Summan per kategori räknas bara över grupper med belopp: en grupp där ett kön är under tröskeln står utan.
        const summa = w.eval('_hpSkalUnderlag().grupper').filter(g => !g.utanBelopp).reduce((t, g) => t + g.sammanstallning.summa, 0);
        expect(sum[1]).toBe(summa);
        expect(w.eval('_hpSkalUnderlag().grupper').some(g => g.utanBelopp), 'demot har en grupp utan belopp').toBe(true);
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

describe('demot följer inte med till en riktig fil', () => {
    it('demots skäl tas bort när en riktig lönefil läses in, också för grupper med samma AID och BAS', async () => {
        const { readFileSync } = await import('node:fs');
        const { join, dirname } = await import('node:path');
        const { fileURLToPath } = await import('node:url');
        const w = createAppWindow();
        w.eval(readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'vendor', 'papaparse.min.js'), 'utf8'));
        w.__loadDemoData();
        const demoNycklar = medSkal(w).map(([n]) => n);
        expect(demoNycklar).toHaveLength(3);
        // En riktig fil med demots personer: samma AID och BAS, så att nycklarna går att matcha.
        const rader = ['BAS;Månadslön;Ålder;Kön;AID', ...w.__state.data.map(r => `${r.bas};${r.lon};${r.alder};${r.kon === 'man' ? 'Man' : 'Kvinna'};${r.aid}`)];
        const n = w.__state.data.length;
        w.__state.data = [];
        w.loadStructureFile(new w.File([rader.join('\n')], 'riktig.csv', { type: 'text/csv' }));
        for (let i = 0; i < 200 && w.__state.data.length !== n; i++) await new Promise(r => setTimeout(r, 20));
        expect(w.__state.isDemo).toBe(false);
        const nya = w.eval('medExportLage(() => _handlingsplanSeedRows().nycklar)');
        expect(demoNycklar.some(k => nya.includes(k)), 'minst en av demots nycklar finns i den riktiga filen').toBe(true);
        expect(w.eval('medExportLage(() => _hpSkalUnderlag().grupper.length)')).toBe(0);
        const cfg = JSON.parse(w.eval('JSON.stringify(buildConfigSnapshot())'));
        expect((cfg.handlingsplan || []).filter(r => r.skal)).toEqual([]);
        expect(JSON.stringify(cfg)).not.toContain('Exempel i demot');
    });
    it('skäl som användaren skrivit på en egen rad i demot påverkas inte av rensningen av demots skäl', () => {
        const w = demo();
        const egen = w.eval('_hpLaggTillEgen()');
        w.eval(`_hpSattSkal(${JSON.stringify(egen)}, [{ kategori: 'annat', belopp: 100, kommentar: 'eget' }])`);
        w.eval('_hpRensaDemoSkal()');
        expect(medSkal(w).map(([k]) => k)).toEqual([egen]);
    });
});

describe('ett kön under minsta gruppstorlek: bara kategorin lämnar verktyget', () => {
    const NOT = 'belopp utelämnat: ett kön under minsta gruppstorlek';
    /** Demots rad med skäl där ett kön är under tröskeln (prioriteringens grupp), med ett känt belopp och en känd kommentar. */
    const medKonUnder = () => {
        const w = demo();
        const { nycklar, minsta } = w.eval('medExportLage(() => { const s = _handlingsplanSeedRows(); return { nycklar: s.nycklar, minsta: s.minsta }; })');
        const nyckel = nycklar.find((n, i) => n.startsWith('prio|') && minsta[i] < 10);
        expect(nyckel, 'demot har en prioriteringsrad med ett kön under tröskeln').toBeTruthy();
        w.eval(`_hpSattSkal(${JSON.stringify(nyckel)}, [{ kategori: 'erfarenhet', belopp: 13579, kommentar: 'Hemlig 24680' }])`);
        return { w, nyckel };
    };
    it('rapportmodellen: kategorin står, belopp och andel är tomma och kommentaren ersätts av noten', () => {
        const { w } = medKonUnder();
        const a = atgarder(w);
        const [, perGrupp] = a.delar.filter(p => p.typ === 'tabell');
        const rad = perGrupp.rader.find(r => r[3] === 'Erfarenhet' && (r[6]?.text || r[6]) === NOT);
        expect(rad, 'raden med noten').toBeTruthy();
        expect(rad[4]?.text ?? rad[4]).toBe('');
        expect(rad[5]).toBeNull();
        const text = JSON.stringify(a);
        expect(text).not.toContain('13579');
        expect(text).not.toContain('24680');
    });
    it('Rapporttext, Excel och handlingsplansunderlaget: talen finns inte, noten gör det', async () => {
        const { w } = medKonUnder();
        w.__renderTabContent('rapporttext');
        const rt = ren(w.document.getElementById('view-rapporttext').textContent);
        expect(rt).toContain(NOT);
        for (const v of ['13579', '13 579', '24680']) expect(rt).not.toContain(v);
        await laddaXlsx(w);
        const alla = Object.values(fangaBocker(w, () => w.eval('exportAllToExcel()')))[0];
        const hp = Object.values(fangaBocker(w, () => w.eval('exportHandlingsplan()')))[0];
        for (const bok of [alla, hp]) { for (const v of ['13579', '24680']) expect(bok).not.toContain(v); expect(bok).toContain(NOT); }
    });
    it('bokslutet bär bara kategorin för raden', () => {
        const { w, nyckel } = medKonUnder();
        const b = w.eval('byggArsbokslutNu()');
        const x = b.bedomningar.find(y => y.nyckel === nyckel);
        expect(x.skal).toEqual([{ kategori: 'erfarenhet' }]);
        expect(x.skillnadKr).toBeNull();
        expect(JSON.stringify(b)).not.toContain('13579');
    });
});

describe('Rapporttext: skälen överstiger skillnaden', () => {
    it('samma mening som i rapportmodellen, med beloppen', () => {
        const w = demo();
        const { nycklar, skillnader } = w.eval('medExportLage(() => { const s = _handlingsplanSeedRows(); return { nycklar: s.nycklar, skillnader: s.skillnader }; })');
        const i = skillnader.findIndex(s => s > 0);
        w.eval(`_hpSattSkal(${JSON.stringify(nycklar[i])}, [{ kategori: 'marknad', belopp: ${skillnader[i] + 300}, kommentar: '' }])`);
        const kr = v => w.eval(`svTal(${v}, 0)`).replace(/\s/g, ' ');
        w.__renderTabContent('rapporttext');
        const rt = ren(w.document.getElementById('view-rapporttext').textContent);
        expect(rt).toContain(`skälen är tillsammans större än skillnaden (${kr(skillnader[i] + 300)} kr mot ${kr(skillnader[i])} kr). Ett belopp kan vara för högt, eller så räknar två skäl samma sak. Kontrollera beloppen.`);
    });
});

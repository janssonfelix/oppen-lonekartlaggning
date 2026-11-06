// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
/**
 * Rapportutkastet per BAS-intervall och resterna från BAS-dossiern.
 *
 * Del 1: auto-rapportutkastet i Rapporttext får ett stycke per BAS-intervall som når k (samma text som BAS-dossierns
 * textkopia, 81-basdossier.js), med en väljare över textrutan som styr utkastet och Återskapa; Word-utkastet och
 * PDF-rapporten får avsnittet Lönekartläggning per BAS-intervall efter likvärdigt arbete, valbart under Rapportens
 * innehåll; rapportunderlaget får ett block per intervall under gruppen Per BAS-intervall.
 * Del 2: rapportunderlagets block om förra året får tabellen Löneutveckling per BAS-intervall, och BAS-hanteln
 * (chart-arsjamforelse-bas) följer med som bild i Word, PDF och ZIP när bokslutet har raderna per intervall.
 */
import { describe, it, expect, vi } from 'vitest';
import { createAppWindow } from './helpers/app-harness.js';

vi.setConfig({ testTimeout: 60000 });

const demo = () => { const w = createAppWindow(); w.__loadDemoData(); return w; };
const utkast = w => /** @type {HTMLTextAreaElement} */ (w.document.getElementById('struktur-narrative'));
const valjare = w => /** @type {HTMLSelectElement} */ (w.document.getElementById('struktur-narrative-omfang'));
const valj = (w, v) => { const s = valjare(w); s.value = v; s.dispatchEvent(new w.Event('change', { bubbles: true })); };
/** Förra årets bokslut ur årets (konfigurationsfilen), med medianen 500 kr lägre i varje intervall. */
const medBokslut = (andra = ab => ab.basIntervall.forEach(r => { if (typeof r.med === 'number') r.med -= 500; })) => {
    const a = demo();
    const cfg = JSON.parse(JSON.stringify(a.__buildConfigSnapshot()));
    cfg.arsbokslut.ar -= 1; cfg.arsbokslut.skapat = `${cfg.arsbokslut.ar}-11-01`;
    andra(cfg.arsbokslut);
    const w = demo();
    w.__cfg = cfg; w.eval('applyConfigSnapshot(window.__cfg)');
    return { w, cfg };
};

describe('rapportutkastet per BAS-intervall (Rapporttext)', () => {
    it('efter helheten står PER BAS-INTERVALL med ett stycke per intervall som når k, i intervallens ordning och i dossierns form', () => {
        const w = demo();
        w.__renderTabContent('rapporttext');
        const t = utkast(w).value;
        expect(t.split('\n')[0]).toBe('LÖNEKARTLÄGGNING — SAMMANFATTNING (utkast)');
        const i = t.indexOf('\nPER BAS-INTERVALL\n');
        expect(i).toBeGreaterThan(t.indexOf('Kvartilfördelning'));
        const del = t.slice(i);
        const rubriker = del.split('\n').filter(r => /^BAS-intervall [A-Z]$/.test(r));
        expect(rubriker).toEqual(['BAS-intervall A', 'BAS-intervall B', 'BAS-intervall C', 'BAS-intervall D', 'BAS-intervall E']);
        // Varje intervall slutar med raden som Word-utkastets fält att fylla i.
        expect(del.match(/^\[HR fyller i\] Bedömning: /gm)).toHaveLength(5);
        // Samma text som dossierns textkopia, utan förra året när inget bokslut är inläst.
        const c = del.slice(del.indexOf('BAS-intervall C\n'), del.indexOf('BAS-intervall D\n'));
        const dossier = w.eval("basdossierText('C')");
        const utanForra = dossier.slice(0, dossier.indexOf('\nFörra året\n'));
        expect(c.startsWith(utanForra)).toBe(true);
        expect(c).not.toContain('Förra året');
        for (const r of ['Nyckeltal', 'Yrkesgrupperna i intervallet', 'Likvärdigt arbete i intervallet', 'Ålder']) expect(c).toContain(`\n${r}\n`);
        // Utkastets slutrad står kvar sist i helheten (före delen per intervall gäller den hela texten).
        expect(t.indexOf('Detta utkast är ett analysunderlag')).toBeLessThan(i);
        expect(w.__state.kLage).toBe('skarm');
    });

    it('i exportläget: med k = 25 faller BAS E (23 personer) bort och nämns, utan lönemått', () => {
        const w = demo();
        w.eval('sattKTroskel(25, { fraga: false })');
        w.__renderTabContent('rapporttext');
        const del = utkast(w).value.split('\nPER BAS-INTERVALL\n')[1];
        expect(del.split('\n').filter(r => /^BAS-intervall [A-Z]$/.test(r))).toEqual(['BAS-intervall A', 'BAS-intervall B', 'BAS-intervall C', 'BAS-intervall D']);
        expect(del).toMatch(/BAS E .*färre än 25 personer/);
        expect(del).not.toContain('BAS-intervall E');
    });

    it('förra året står med när ett bokslut är inläst', () => {
        const { w, cfg } = medBokslut();
        w.__renderTabContent('rapporttext');
        const del = utkast(w).value.split('\nPER BAS-INTERVALL\n')[1];
        expect(del).toContain('\nFörra året\n');
        expect(del).toContain(`Jämfört med ${cfg.arsbokslut.ar}:`);
        expect(del).toContain('+500 kr');
    });

    it('väljaren ovanför textrutan: standard med intervallen; valet ligger i state, inte i filen, och Återskapa följer det', () => {
        const w = demo();
        w.__renderTabContent('rapporttext');
        const s = valjare(w);
        expect(s).not.toBeNull();
        expect([...s.options].map(o => o.textContent)).toEqual(['Hela organisationen', 'Hela organisationen + per BAS-intervall']);
        expect(s.value).toBe('perBas');
        expect(w.__state.utkastPerBas).toBe(true);
        // Väljaren står före textrutan och har en etikett.
        expect(s.compareDocumentPosition(utkast(w)) & w.Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
        expect(w.document.querySelector('label[for="struktur-narrative-omfang"]')).not.toBeNull();
        // Hela organisationen: utkastet ritas om utan intervallen.
        valj(w, 'hela');
        expect(w.__state.utkastPerBas).toBe(false);
        expect(utkast(w).value).not.toContain('PER BAS-INTERVALL');
        expect(utkast(w).value).toContain('LÖNEKARTLÄGGNING — SAMMANFATTNING (utkast)');
        expect(w.__buildConfigSnapshot()).not.toHaveProperty('utkastPerBas');
        expect(JSON.stringify(w.__buildConfigSnapshot())).not.toContain('utkastPerBas');
        // Ett redigerat utkast skrivs inte över av väljaren; Återskapa ritar om efter valet.
        utkast(w).value = 'Egen text'; utkast(w).dispatchEvent(new w.Event('input', { bubbles: true }));
        valj(w, 'perBas');
        expect(utkast(w).value).toBe('Egen text');
        w.document.getElementById('struktur-narrative-regen').click();
        expect(utkast(w).value).toContain('PER BAS-INTERVALL');
        valj(w, 'hela');
        w.document.getElementById('struktur-narrative-regen').click();
        expect(utkast(w).value).not.toContain('PER BAS-INTERVALL');
        // Att öppna fliken igen ritar efter valet.
        w.__renderTabContent('rapporttext');
        expect(utkast(w).value).not.toContain('PER BAS-INTERVALL');
        expect(w.__state.kLage).toBe('skarm');
        // Rensa all data återställer valet.
        w.eval('_rensaAllData({ inbakat: false })');
        expect(w.__state.utkastPerBas).toBe(true);
    });
});

describe('Word-utkastet och PDF-rapporten: Lönekartläggning per BAS-intervall', () => {
    it('avsnittet står efter likvärdigt arbete, med en underrubrik per intervall, samma stycken som texten, yrkesgruppstabellen och fältet att fylla i', () => {
        const w = demo();
        const m = w.eval('rapportModell()');
        const ids = m.avsnitt.map(a => a.id);
        expect(ids[ids.indexOf('likvardigt') + 1]).toBe('basintervall');
        const a = m.avsnitt.find(x => x.id === 'basintervall');
        expect(a.rubrik).toMatch(/^\d+\. Lönekartläggning per BAS-intervall$/);
        const rubriker = a.delar.filter(p => p.typ === 'rubrik');
        expect(rubriker.map(p => p.text)).toEqual(['BAS-intervall A', 'BAS-intervall B', 'BAS-intervall C', 'BAS-intervall D', 'BAS-intervall E']);
        expect(rubriker.every(p => p.niva === 3)).toBe(true);
        // BAS C: stycken ur samma textbyggare som dossiern.
        const iC = a.delar.findIndex(p => p.typ === 'rubrik' && p.text === 'BAS-intervall C');
        const iD = a.delar.findIndex(p => p.typ === 'rubrik' && p.text === 'BAS-intervall D');
        const c = a.delar.slice(iC + 1, iD);
        const text = c.filter(p => p.typ === 'stycke').map(p => p.text);
        const stycken = w.eval("medExportLage(() => basdossierStycken(buildBasdossier('C'), { forraBaraMedBokslut: true }))");
        expect(text).toEqual(stycken.flatMap(s => [s.rubrik, ...s.rader]));
        expect(c.filter(p => p.typ === 'stycke' && p.stil === 'fet').map(p => p.text)).toEqual(stycken.map(s => s.rubrik));
        // Tabellen: AID, yrke, antal per kön, medianer per kön, kvoten och status; bara yrken där båda könen når k.
        const tab = c.find(p => p.typ === 'tabell');
        expect(tab.kolumner.map(k => k.rubrik)).toEqual(['AID', 'Yrke', 'Kvinnor / män', 'Median kvinnor', 'Median män', 'Kvinnors median i % av mäns', 'Status']);
        const d = w.eval("medExportLage(() => buildBasdossier('C'))");
        const delade = d.yrken.filter(y => !y.samlad);
        expect(tab.rader.map(r => r[0])).toEqual(delade.map(y => y.aid));
        for (const r of tab.rader) { expect(typeof r[3]).toBe('number'); expect(typeof r[4]).toBe('number'); expect(typeof r[5]).toBe('number'); }
        expect(c.filter(p => p.typ === 'fyllIn')).toHaveLength(1);
        expect(c.find(p => p.typ === 'fyllIn').text).toMatch(/^Bedömning/);
        // Word-utkastet och utskriften ritas ur modellen.
        const html = w.eval('_buildDocumentationDraftHtml()');
        expect(html).toContain('Lönekartläggning per BAS-intervall');
        expect(html).toContain('<p><strong>Yrkesgrupperna i intervallet</strong></p>');
        const block = w.eval('_utkastTillBlock(_buildDocumentationDraftHtml())');
        const fet = block.find(b => b.typ === 'stycke' && b.delar.length === 1 && b.delar[0].text === 'Yrkesgrupperna i intervallet');
        expect(fet.delar[0].fet).toBe(true);
        expect(w.__state.kLage).toBe('skarm');
    });

    it('i exportläget med k = 25: BAS E finns inte, utelämnat säger det, och inget yrke under k har en rad', () => {
        const w = demo();
        w.eval('sattKTroskel(25, { fraga: false })');
        const a = w.eval('rapportModell()').avsnitt.find(x => x.id === 'basintervall');
        expect(a.delar.filter(p => p.typ === 'rubrik').map(p => p.text)).not.toContain('BAS-intervall E');
        expect(a.utelamnat.join(' ')).toMatch(/BAS E .*färre än 25 personer/);
        for (const tab of a.delar.filter(p => p.typ === 'tabell')) {
            for (const r of tab.rader) expect(r[2]).toMatch(/^(\d+) \/ (\d+)$/);
            for (const r of tab.rader) { const [kv, ma] = r[2].split(' / ').map(Number); expect(kv).toBeGreaterThanOrEqual(25); expect(ma).toBeGreaterThanOrEqual(25); }
        }
    });

    it('avsnittet är valbart i Rapportens innehåll, förvalt på; ledningsbriefen har det inte, facklig dialog har det', () => {
        const w = demo();
        const d = w.document;
        d.querySelector('.nav-item[data-tab="dokumentera"]').click();
        const ruta = /** @type {HTMLInputElement} */ (d.querySelector('#rapport-urval [data-urval-med="basintervall"]'));
        expect(ruta).not.toBeNull();
        expect(ruta.checked).toBe(true);
        expect(ruta.closest('label').textContent.trim()).toBe('Lönekartläggning per BAS-intervall');
        const ordning = [...d.querySelectorAll('#rapport-urval [data-urval-id]')].map(li => li.getAttribute('data-urval-id'));
        expect(ordning[ordning.indexOf('likvardigt') + 1]).toBe('basintervall');
        ruta.checked = false; ruta.dispatchEvent(new w.Event('change', { bubbles: true }));
        expect(w.eval('rapportModell()').avsnitt.map(a => a.id)).not.toContain('basintervall');
        expect(w.eval('_buildDocumentationDraftHtml()')).not.toContain('Lönekartläggning per BAS-intervall');
        w.eval("sattRapportUrval('ledning')");
        expect(w.eval('rapportModell()').avsnitt.map(a => a.id)).not.toContain('basintervall');
        w.eval("sattRapportUrval('facklig')");
        expect(w.eval('rapportModell()').avsnitt.map(a => a.id)).toContain('basintervall');
        w.eval("sattRapportUrval('hela')");
        expect(w.eval('rapportModell()').avsnitt.map(a => a.id)).toContain('basintervall');
    });

    it('ett sparat eget urval från före avsnittet: avsnittet hamnar på sin plats i ordningen, inte sist', () => {
        const w = demo();
        w.eval("sattRapportUrval({ ordning: ['sammanfattning', 'regler', 'lika', 'likvardigt', 'struktur', 'referenser', 'perbas', 'atgarder', 'samverkan', 'beslut', 'regression', 'metod'], med: ['sammanfattning', 'lika'] })");
        const u = w.eval('rapportUrval()');
        expect(u.ordning[u.ordning.indexOf('likvardigt') + 1]).toBe('basintervall');
        expect(u.med).toEqual(['sammanfattning', 'lika']);
    });

    it('PDF-rapporten har avsnittet som egen sektion', async () => {
        const w = demo();
        w.eval("sattRapportUrval('hela')");
        await w.eval('buildPrintReport()');
        const s = w.document.querySelector('#print-report section[data-rm-avsnitt="basintervall"]');
        expect(s).not.toBeNull();
        expect(s.querySelector('h2').textContent).toMatch(/Lönekartläggning per BAS-intervall$/);
        expect([...s.querySelectorAll('h3')].map(h => h.textContent)).toContain('BAS-intervall C');
        expect(s.querySelectorAll('table').length).toBeGreaterThan(0);
    });
});

describe('rapportunderlaget: Per BAS-intervall', () => {
    it('ett block per intervall som når k, med dossierns stycken och yrkesgruppstabellen, under en egen grupp med Kopiera', () => {
        const w = demo();
        const block = w.__rapportunderlagBlock().filter(b => b.id.startsWith('bas:'));
        expect(block.map(b => b.id)).toEqual(['bas:A', 'bas:B', 'bas:C', 'bas:D', 'bas:E']);
        const c = block.find(b => b.id === 'bas:C');
        expect(c.rubrik).toBe('BAS-intervall C');
        const stycken = w.eval("medExportLage(() => basdossierStycken(buildBasdossier('C'), { forraBaraMedBokslut: true }))");
        for (const s of stycken) for (const r of s.rader) expect(c.stycken).toContain(r);
        // Raden att fylla i efter intervallets stycken; urvalet sist, som i övriga block.
        const iBed = c.stycken.findIndex(t => /^\[HR fyller i\] Bedömning: /.test(t));
        expect(iBed).toBeGreaterThan(c.stycken.indexOf(stycken[stycken.length - 1].rader.slice(-1)[0]));
        expect(c.stycken.slice(iBed + 1)).toEqual(['Urval: Hela organisationen.']);
        expect(c.tabell.rubriker).toEqual(['AID', 'Yrke', 'Kvinnor / män', 'Median kvinnor', 'Median män', 'Kvinnors median i % av mäns', 'Status']);
        expect(c.tabell.rader.length).toBeGreaterThan(0);
        expect(c.tabell.rader.every(r => r.every(x => typeof x === 'string'))).toBe(true);
        w.__renderTabContent('rapporttext');
        const d = w.document;
        const rubrik = [...d.querySelectorAll('#rapportunderlag-innehall .ru-grupprubrik')].find(h => h.textContent === 'Per BAS-intervall');
        expect(rubrik).toBeTruthy();
        expect(d.querySelector('[data-rapport-kopiera="bas:C"]')).not.toBeNull();
        const toc = [...d.querySelectorAll('.ru-toc li')].find(li => li.textContent.startsWith('Per BAS-intervall'));
        expect(toc.querySelectorAll('a')).toHaveLength(5);
        expect(w.__ruTillText(c)).toContain('BAS-intervall C');
        // Kopiera alla avsnitt tar bara avsnittsblocken, som förut.
        expect(w.eval('[..._rapportBlockSenast.values()].filter(b => !b.id.includes(":")).map(b => b.id)')).not.toContain('bas:C');
    });

    it('med k = 25 finns inget block för BAS E', () => {
        const w = demo();
        w.eval('sattKTroskel(25, { fraga: false })');
        expect(w.__rapportunderlagBlock().filter(b => b.id.startsWith('bas:')).map(b => b.id)).toEqual(['bas:A', 'bas:B', 'bas:C', 'bas:D']);
    });
});

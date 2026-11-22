/**
 * Röktest (jsdom): Säkerhet, interna fel, AID, ansvarskod, sektorsöversikt och SKR-referensen.
 *
 * Utbrutet ur smoke.test.js så att Vitest fördelar röktesterna över flera arbetare; varje describe-block
 * skapar sina egna fönster via createAppWindow (tests/helpers/app-harness.js).
 */
import { describe, it, expect } from 'vitest';
import { createAppWindow } from './helpers/app-harness.js';

describe('sektorsöversikten', () => {
    it('kortet visar en rad per sektor med demot, i prefixordning', () => {
        const w = createAppWindow();
        w.__loadDemoData();
        w.__renderTabContent('struktur');
        const rader = [...w.document.querySelectorAll('#sektor-table tbody tr')].map(tr => tr.querySelector('.sektor-namn').textContent.trim());
        expect(rader).toEqual(['Vård- och omsorgsarbete med mera', 'Förskole-, skol-, fritids- och annan pedagogisk verksamhet', 'Teknikarbete']);
        expect(w.document.getElementById('struktur-sektorer').textContent).toMatch(/på att kvinnor och män arbetar i olika huvudområden/);
        expect(w.document.getElementById('chart-sektorer')._figur.lager.map(l => l.serie)).toEqual(['Förklaras av ålder och BAS', 'Rå', 'Justerad (ålder, BAS)']);
    });
    it('lönefil utan ålder: ett justerat tal per huvudområde, rubriken säger BAS (ADR-78)', () => {
        const w = createAppWindow();
        w.__loadDemoData();
        w.__state.data = w.__state.data.map(r => ({ ...r, alder: 0 }));
        w.eval('invalidateStatCaches(); populateSelects(); unlockTabs();');
        w.__renderTabContent('struktur');
        const rubriker = [...w.document.querySelectorAll('#sektor-table thead th')].map(th => th.textContent.trim());
        expect(rubriker).toContain('Justerad (BAS)');
        expect(rubriker).not.toContain('Justerad (ålder, BAS)');
        expect(w.document.getElementById('sektor-table').textContent).not.toMatch(/För få/);
        expect(w.document.getElementById('chart-sektorer')._figur.lager.map(l => l.serie)).toEqual(['Förklaras av BAS', 'Rå', 'Justerad (BAS)']);
    });
    it('klick på en sektor öppnar Utforska med sektorn som villkor', () => {
        const w = createAppWindow();
        w.__loadDemoData();
        w.__renderTabContent('struktur');
        w.document.querySelector('#sektor-table [data-sektor="Teknikarbete"]').click();
        const u = w.eval('explorerUrval()').urval;
        expect(u.villkor).toEqual([expect.objectContaining({ falt: 'sektor', op: 'enAv', varde: ['Teknikarbete'] })]);
        expect(w.document.getElementById('explore-rad').value).toBe('aid');
    });
});

describe('ansvarskod i dossiern, Personer att granska och demot', () => {
    it('demot har ansvarskoder och en ansvarskolumn', () => {
        const w = createAppWindow();
        w.__loadDemoData();
        expect(w.__state.ansvarKolumn).toMatchObject({ namn: 'Ansvarskod (demo)' });
        const grupper = new Set(w.__state.data.map(r => r.ansvarsgrupp));
        expect([...grupper].sort()).toEqual(['inget', 'ledning', 'uppdrag']);
        expect(w.__state.data.filter(r => r.ansvarsgrupp === 'ledning').length).toBeGreaterThanOrEqual(10);
    });
    it('demots huvudtal i regressionen är detsamma med och utan ansvaret', () => {
        const w = createAppWindow();
        w.__loadDemoData();
        const med = w.eval('runOLSRegression()');
        w.__state.data.forEach(r => { r.ansvarsgrupp = null; r.ansvarskoder = null; });
        const utan = w.eval('runOLSRegression()');
        expect(med.konPct).toBeCloseTo(utan.konPct, 10);
        expect(med.ansvarSteg).toMatchObject({ status: 'ok' });
        expect(utan.ansvarSteg).toBeNull();
    });
    it('dossiern visar antal per ansvarsgrupp och kön, aldrig lön per ansvarsgrupp', () => {
        const w = createAppWindow();
        w.__loadDemoData();
        const kand = w.__gruppdossierCandidates().find(c => c.rows.some(r => r.ansvarsgrupp === 'ledning'));
        const d = w.__buildGruppdossier(kand.key);
        const nLed = kand.rows.filter(r => r.ansvarsgrupp === 'ledning');
        expect(d.ansvar).toMatchObject({ ledning: { kv: nLed.filter(r => r.kon === 'kvinna').length, ma: nLed.filter(r => r.kon === 'man').length } });
        const html = w.eval(`_gdRenderBody(__buildGruppdossier(${JSON.stringify(kand.key)}))`);
        expect(html).toMatch(/Ledningsansvar \d+ kv \/ \d+ män/);
        expect(w.__gruppdossierAsText(d)).toMatch(/Ansvar: ledningsansvar \d+ kvinnor \/ \d+ män · särskilt uppdrag \d+ kvinnor \/ \d+ män/);
    });
    it('dossiern utan ansvarskolumn har ingen ansvarsrad', () => {
        const w = createAppWindow();
        w.__loadDemoData();
        w.__state.data.forEach(r => { r.ansvarsgrupp = null; r.ansvarskoder = null; });
        w.__state.ansvarKolumn = null;
        const key = w.__gruppdossierCandidates()[0].key;
        expect(w.__buildGruppdossier(key).ansvar).toBeNull();
        expect(w.eval(`_gdRenderBody(__buildGruppdossier(${JSON.stringify(key)}))`)).not.toMatch(/Ledningsansvar/);
    });
    it('Personer att granska har kolumnen Ansvar bara när ansvarskolumnen finns', () => {
        const w = createAppWindow();
        w.__loadDemoData();
        w.eval('renderPersonerAttGranska(true)');
        const rubriker = () => [...w.document.querySelectorAll('#pag-tabell thead th')].map(th => th.textContent);
        expect(rubriker()).toContain('Ansvar');
        expect([...w.document.querySelectorAll('#pag-tabell tbody tr')].every(tr => tr.children.length === rubriker().length)).toBe(true);
        w.__state.ansvarKolumn = null;
        w.eval('renderPersonerAttGranska(true)');
        expect(rubriker()).not.toContain('Ansvar');
    });
});

describe('AID: metodtext enligt handboken', () => {
    it('Om verktyget förklarar AID, sektorerna och etikettlistans version och källa, utan §', () => {
        const w = createAppWindow();
        w.document.querySelector('.nav-item[data-tab="info"]').click();
        w.eval("renderInfoTab('metodik')");
        const avsnitt = w.document.getElementById('om-aid');
        expect(avsnitt).not.toBeNull();
        const t = avsnitt.textContent.replace(/\s+/g, ' ');
        expect(t).toMatch(/inte ett arbetsvärderingssystem/);
        expect(t).toMatch(/2026-09-23/);
        expect(t).toMatch(/SKR/);
        expect(t).toMatch(/232 etiketter/);
        expect(t).toMatch(/Ledningsansvar.*Särskilt uppdrag/);
        expect(t).not.toMatch(/§/);
    });
    it('Lika arbete har en not om AID-grupperna som utgångspunkt', () => {
        const w = createAppWindow();
        const p = w.document.getElementById('la-aid-bakgrund');
        expect(p?.textContent).toMatch(/utgångspunkt/);
        expect(p.textContent).toMatch(/inte ett arbetsvärderingssystem/);
    });
    it('Word-utkastets avsnitt Lika arbete innehåller metodtexten', () => {
        const w = createAppWindow();
        w.__loadDemoData();
        const html = w.__docDraftHtml();
        const lika = html.slice(html.indexOf('Lika arbete — kvinnor och män i samma AID-etikett och BAS-intervall'), html.indexOf('Likvärdigt arbete — kvinnodominerade AID-etiketter'));
        expect(lika).toMatch(/AID är inte ett arbetsvärderingssystem/);
    });
});

describe('sektorsöversiktens punkter i Att göra', () => {
    it('räknas ur samma punkter som hela listan, också likvärdighetsparen, utan att bygga hela listan', async () => {
        const { sektorsnamn } = await import('../src/lib/aid.js');
        const w = createAppWindow();
        w.__loadDemoData();
        const alla = w.eval('buildActionChecklist()');
        const grupp = w.eval('buildActionChecklist({ endastGrupper: true })');
        const medAid = alla.filter(it => it.aid);
        expect(medAid.some(it => it.id.startsWith('lv-'))).toBe(true);
        expect(grupp.map(it => it.id).sort()).toEqual(medAid.map(it => it.id).sort());
        const vantat = {};
        for (const it of medAid) { const s = sektorsnamn(it.aid); vantat[s] = (vantat[s] || 0) + 1; }
        expect(w.eval('_sektorPunkter()')).toEqual(vantat);
    });
});

// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
// AID i appen: ansvarskoden i dossiern, Personer att granska och demot, och metodtexten om AID-kodningen.
import { describe, it, expect } from 'vitest';
import { createAppWindow } from './helpers/app-harness.js';

describe('ansvarskod i dossiern, Personer att granska och demot', () => {
    it('demot har ansvarskoder och en ansvarskolumn', () => {
        const w = createAppWindow();
        w.__lasInDemodata();
        expect(w.__state.ansvarKolumn).toMatchObject({ namn: 'Ansvarskod (demo)' });
        const grupper = new Set(w.__state.data.map(r => r.ansvarsgrupp));
        expect([...grupper].sort()).toEqual(['inget', 'ledning', 'uppdrag']);
        expect(w.__state.data.filter(r => r.ansvarsgrupp === 'ledning').length).toBeGreaterThanOrEqual(10);
    });
    it('demots huvudtal i regressionen är detsamma med och utan ansvaret', () => {
        const w = createAppWindow();
        w.__lasInDemodata();
        const med = w.eval('korOLSRegression()');
        w.__state.data.forEach(r => { r.ansvarsgrupp = null; r.ansvarskoder = null; });
        const utan = w.eval('korOLSRegression()');
        expect(med.konPct).toBeCloseTo(utan.konPct, 10);
        expect(med.ansvarSteg).toMatchObject({ status: 'ok' });
        expect(utan.ansvarSteg).toBeNull();
    });
    it('dossiern visar antal per ansvarsgrupp och kön, aldrig lön per ansvarsgrupp', () => {
        const w = createAppWindow();
        w.__lasInDemodata();
        const kand = w.__gruppdossierCandidates().find(c => c.rows.some(r => r.ansvarsgrupp === 'ledning'));
        const d = w.__buildGruppdossier(kand.key);
        const nLed = kand.rows.filter(r => r.ansvarsgrupp === 'ledning');
        expect(d.ansvar).toMatchObject({ ledning: { kv: nLed.filter(r => r.kon === 'kvinna').length, ma: nLed.filter(r => r.kon === 'man').length } });
        const html = w.eval(`_gdRitaInnehall(__buildGruppdossier(${JSON.stringify(kand.key)}))`);
        expect(html).toMatch(/Ledningsansvar \d+ kv \/ \d+ män/);
        expect(w.__gruppdossierAsText(d)).toMatch(/Ansvar: ledningsansvar \d+ kvinnor \/ \d+ män · särskilt uppdrag \d+ kvinnor \/ \d+ män/);
    });
    it('dossiern utan ansvarskolumn har ingen ansvarsrad', () => {
        const w = createAppWindow();
        w.__lasInDemodata();
        w.__state.data.forEach(r => { r.ansvarsgrupp = null; r.ansvarskoder = null; });
        w.__state.ansvarKolumn = null;
        const key = w.__gruppdossierCandidates()[0].key;
        expect(w.__buildGruppdossier(key).ansvar).toBeNull();
        expect(w.eval(`_gdRitaInnehall(__buildGruppdossier(${JSON.stringify(key)}))`)).not.toMatch(/Ledningsansvar/);
    });
    it('Personer att granska har kolumnen Ansvar bara när ansvarskolumnen finns', () => {
        const w = createAppWindow();
        w.__lasInDemodata();
        w.eval('ritaPersonerAttGranska(true)');
        const rubriker = () => [...w.document.querySelectorAll('#pag-tabell thead th')].map(th => th.textContent);
        expect(rubriker()).toContain('Ansvar');
        expect([...w.document.querySelectorAll('#pag-tabell tbody tr')].every(tr => tr.children.length === rubriker().length)).toBe(true);
        w.__state.ansvarKolumn = null;
        w.eval('ritaPersonerAttGranska(true)');
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
        w.__lasInDemodata();
        const html = w.__docDraftHtml();
        const lika = html.slice(html.indexOf('Lika arbete — kvinnor och män i samma AID-etikett och BAS-intervall'), html.indexOf('Likvärdigt arbete — kvinnodominerade AID-etiketter'));
        expect(lika).toMatch(/AID är inte ett arbetsvärderingssystem/);
    });
});

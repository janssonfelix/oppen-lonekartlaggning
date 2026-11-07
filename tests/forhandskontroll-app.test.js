// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
// Förhandskontrollen av lönefilen i appen: avsnittet i Filer och kvalitet efter inläsningen, varningarna i Att göra
// och inläsningsrapporten, det blockerande läget i Inställningar, och att demo, paket och rensning gör rätt.
import { describe, it, expect } from 'vitest';
import { createAppWindow } from './helpers/app-harness.js';
import { papa, vanta, csvFil } from './helpers/granssnitt-rigg.js';

const status = w => w.document.getElementById('data-status').textContent;
const lasIn = async (w, rader, namn = 'lonefil.csv') => {
    papa(w);
    w.document.getElementById('data-status').textContent = '';
    w.loadStructureFile(csvFil(w, rader, namn));
    await vanta(() => status(w) && !/läser|Läser/.test(status(w)));
};
// CSV-mallens rubriker med 30 rader; lönen kan räknas om (årslön) och ålder skrivas som födelseår.
const fil = ({ lon = i => 30000 + i * 10, alder = i => String(30 + i), kon = i => (i % 2 ? 'Man' : 'Kvinna'), n = 30 } = {}) => {
    const rader = ['BAS-intervall;AID;Manadslon;Alder;Kon'];
    for (let i = 0; i < n; i++) rader.push(`C;207011 Handläggare;${lon(i)};${alder(i)};${kon(i)}`);
    return rader;
};
const avsnitt = w => w.document.getElementById('avsnitt-fi-forhandskontroll');
const nyckel = w => w.document.getElementById('nyckel-fi-forhandskontroll').textContent;
const punkter = w => w.eval('buildActionChecklist()').filter(p => p.id.startsWith('fk-'));
const stoppa = (w, pa = true) => {
    w.eval('oppnaInstallningar()');
    const ruta = w.document.getElementById('inst-fk-stopp');
    ruta.checked = pa;
    ruta.dispatchEvent(new w.Event('change', { bubbles: true }));
    w.eval('stangInstallningar()');
};

describe('förhandskontrollen efter inläsningen', () => {
    it('är dold utan lönefil', () => {
        const w = createAppWindow();
        expect(avsnitt(w).hidden).toBe(true);
        expect(w.__state.forhandskontroll).toBeNull();
    });

    it('en ren fil ger "inget att anmärka", hopfällt, och visar profilen som kände igen filen', async () => {
        const w = createAppWindow();
        await lasIn(w, fil());
        expect(w.__state.data).toHaveLength(30);
        expect(avsnitt(w).hidden).toBe(false);
        expect(avsnitt(w).open).toBe(false);
        expect(nyckel(w)).toBe('inget att anmärka');
        expect(w.__state.forhandskontroll.tolkning).toHaveLength(10);
        const t = avsnitt(w).textContent;
        expect(t).toContain('Känd uppsättning: Verktygets CSV-mall (inbyggd)');
        expect(avsnitt(w).querySelectorAll('#fk-tolkning tbody tr')).toHaveLength(10);
        expect(avsnitt(w).querySelector('#fk-tolkning .fk-fel')).toBeNull();
        expect(punkter(w)).toEqual([]);
    });

    it('en fil med årslön ger varningen utfälld, punkten i Att göra och raden i inläsningsrapporten; en omläst ren fil tar bort punkten', async () => {
        const w = createAppWindow();
        await lasIn(w, fil({ lon: i => 420000 + i * 120 }));
        expect(w.__state.data).toHaveLength(30);   // filen läses in och räknas som i dag
        expect(avsnitt(w).hidden).toBe(false);
        expect(avsnitt(w).open).toBe(true);
        expect(nyckel(w)).toBe('1 varning');
        expect(w.document.getElementById('nyckel-fi-forhandskontroll').classList.contains('ar-kritisk')).toBe(true);
        expect(avsnitt(w).querySelector('.fk-varningar').textContent).toMatch(/årslön/);
        const p = punkter(w);
        expect(p).toHaveLength(1);
        expect(p[0]).toMatchObject({ id: 'fk-lon-arslon', kategori: 'Underlagets kvalitet', prioritet: 'hög', tab: 'filer', källa: 'Förhandskontroll av lönefilen' });
        // Att göra leder till avsnittet.
        w.__renderTabContent('dashboard');
        w.eval('renderActionChecklist()');
        const lank = w.document.querySelector('#action-checklist-container a[data-go-to-anchor="avsnitt-fi-forhandskontroll"]');
        expect(lank).toBeTruthy();
        // Inläsningsrapporten länkar till avsnittet.
        const rapport = w.document.getElementById('data-validation-report');
        expect(rapport.textContent).toMatch(/Förhandskontroll: 1 varning/);
        expect(rapport.querySelector('a[data-go-to-anchor="avsnitt-fi-forhandskontroll"]')).toBeTruthy();

        await lasIn(w, fil(), 'ren.csv');
        expect(punkter(w)).toEqual([]);
        expect(nyckel(w)).toBe('inget att anmärka');
        expect(avsnitt(w).open).toBe(false);
    });

    it('födelseår och okänd kön-kod: cellerna visar tolkningen och den okända koden markeras', async () => {
        const w = createAppWindow();
        await lasIn(w, fil({ alder: i => String(1978 - (i % 10)), kon: i => (i === 0 ? '1' : i % 2 ? 'M' : 'K') }));
        expect(w.__state.data).toHaveLength(29);
        const rader = avsnitt(w).querySelectorAll('#fk-tolkning tbody tr');
        expect(rader[0].querySelector('.fk-fel').textContent).toContain('1');
        expect(rader[0].classList.contains('fk-bort')).toBe(true);
        expect(rader[1].textContent).toMatch(/1977 tolkat som \d+ år/);
        expect(rader[1].textContent).toContain('M tolkat som man');
        expect(w.__state.forhandskontroll.varningar.map(v => v.kod).sort()).toEqual(['alder-fodelsear', 'kon-okand']);
        // Punkten om okänt kön finns redan i Att göra (Datakvalitet): förhandskontrollen lägger inte en till.
        expect(punkter(w).map(p => p.id)).toEqual(['fk-alder-fodelsear']);
        expect(nyckel(w)).toBe('2 varningar');
    });

    it('rensa all data tömmer förhandskontrollen', async () => {
        const w = createAppWindow();
        await lasIn(w, fil({ lon: i => 420000 + i }));
        expect(w.__state.forhandskontroll).toBeTruthy();
        w.eval('_rensaAllData()');
        expect(w.__state.forhandskontroll).toBeNull();
        expect(avsnitt(w).hidden).toBe(true);
        expect(nyckel(w)).toBe('');
    });

    it('ett demo efter en fil tar bort förhandskontrollen (demot läses inte ur en fil)', async () => {
        const w = createAppWindow();
        await lasIn(w, fil());
        w.__loadDemoData();
        expect(w.__state.forhandskontroll).toBeNull();
        expect(avsnitt(w).hidden).toBe(true);
    });
});

describe('Inställningar: stoppa och visa förhandskontrollen innan inläsning', () => {
    it('är av som standard och följer med i konfigurationsfilen', () => {
        const w = createAppWindow();
        expect(w.__state.forhandskontrollStopp).toBe(false);
        expect(w.__buildConfigSnapshot().forhandskontrollStopp).toBe(false);
        stoppa(w);
        expect(w.__state.forhandskontrollStopp).toBe(true);
        const cfg = JSON.parse(JSON.stringify(w.__buildConfigSnapshot()));
        expect(cfg.forhandskontrollStopp).toBe(true);
        const w2 = createAppWindow();
        w2.__cfg = cfg;
        w2.eval('applyConfigSnapshot(window.__cfg)');
        expect(w2.__state.forhandskontrollStopp).toBe(true);
        w2.eval('oppnaInstallningar()');
        expect(w2.document.getElementById('inst-fk-stopp').checked).toBe(true);
        w2.__cfg = { ...cfg, forhandskontrollStopp: 'ja' };
        expect(() => w2.eval('applyConfigSnapshot(window.__cfg)')).toThrow(/forhandskontrollStopp/);
    });

    it('med den på pausas inläsningen tills Läs in klickas', async () => {
        const w = createAppWindow();
        stoppa(w);
        await lasIn(w, fil({ lon: i => 420000 + i }));
        expect(w.__state.data).toHaveLength(0);
        expect(w.document.getElementById('tab-matrix').disabled).toBe(true);
        expect(avsnitt(w).hidden).toBe(false);
        expect(avsnitt(w).open).toBe(true);
        expect(nyckel(w)).toBe('väntar på Läs in');
        expect(status(w)).toMatch(/Läs in eller Avbryt/);
        expect(avsnitt(w).querySelectorAll('#fk-tolkning tbody tr')).toHaveLength(10);
        w.document.getElementById('fk-las-in').click();
        expect(w.__state.data).toHaveLength(30);
        expect(w.document.getElementById('tab-matrix').disabled).toBe(false);
        expect(w.document.getElementById('fk-las-in')).toBeNull();
        expect(nyckel(w)).toBe('1 varning');
        expect(w.__state.filnamn.data).toBe('lonefil.csv');
    });

    it('Avbryt tömmer det inlästa utan att röra tidigare data', async () => {
        const w = createAppWindow();
        await lasIn(w, fil(), 'forsta.csv');
        const forra = w.__state.data, forraKontroll = w.__state.forhandskontroll;
        stoppa(w);
        await lasIn(w, fil({ lon: i => 420000 + i, n: 12 }), 'andra.csv');
        expect(w.__state.data).toBe(forra);
        expect(w.__state.filnamn.data).toBe('forsta.csv');
        expect(w.__state.forhandskontroll.vantar).toBe(true);
        w.document.getElementById('fk-avbryt').click();
        expect(w.__state.data).toBe(forra);
        expect(w.__state.forhandskontroll).toBe(forraKontroll);
        expect(w.__state.filnamn.data).toBe('forsta.csv');
        expect(w.document.getElementById('fk-avbryt')).toBeNull();
        expect(nyckel(w)).toBe('inget att anmärka');
        expect(status(w)).toMatch(/avbröts/);
    });

    it('Avbryt utan tidigare data lämnar verktyget utan lönefil', async () => {
        const w = createAppWindow();
        stoppa(w);
        await lasIn(w, fil());
        w.document.getElementById('fk-avbryt').click();
        expect(w.__state.data).toHaveLength(0);
        expect(w.__state.forhandskontroll).toBeNull();
        expect(avsnitt(w).hidden).toBe(true);
        expect(w.__state.importprofil).toBeNull();
    });

    it('med inställningen avslagen ersätter nästa fil den som väntade', async () => {
        const w = createAppWindow();
        stoppa(w);
        await lasIn(w, fil(), 'vantande.csv');
        stoppa(w, false);
        await lasIn(w, fil({ n: 20 }), 'nasta.csv');
        expect(w.__state.data).toHaveLength(20);
        expect(w.eval('_fkVantar')).toBeNull();
        expect(w.document.getElementById('fk-las-in')).toBeNull();
    });

    it('demo och organisationspaket påverkas inte, och rensa all data släpper en väntande fil', async () => {
        const w = createAppWindow();
        stoppa(w);
        w.__loadDemoData();
        expect(w.__state.data.length).toBeGreaterThan(100);
        expect(w.__state.forhandskontroll).toBeNull();
        expect(avsnitt(w).hidden).toBe(true);
        w.eval('_rensaAllData()');
        const paket = w.eval(`JSON.stringify(_opByggPaket({ organisation: 'Exempelorganisationen', skapat: '2026-10-01',
            referens: { namn: 'Ställningstagande', rader: [{ aid: null, bas: 'A', p10: 25000, med: 28000, p90: 31000 }] } }))`);
        expect(w.lasInPaket(paket).ok).toBe(true);
        expect(w.__state.paket).toBeTruthy();
        expect(w.__state.forhandskontroll).toBeNull();
        await lasIn(w, fil());
        expect(w.__state.forhandskontroll.vantar).toBe(true);
        w.eval('_rensaAllData()');
        expect(w.__state.forhandskontroll).toBeNull();
        expect(w.eval('_fkVantar')).toBeNull();
        expect(avsnitt(w).hidden).toBe(true);
    });
});

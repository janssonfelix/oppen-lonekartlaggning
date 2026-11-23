// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
// Konfigurationsfilen i appen: HR:s manuella arbete sparas och läses tillbaka, också ansvarskoden.
import { describe, it, expect, beforeAll } from 'vitest';
import { createAppWindow } from './helpers/app-harness.js';
import { konfigurationMedNyaNamn, KONFIGURATION_NAMNBYTEN } from '../src/lib/konfiguration.js';

let win;

beforeAll(() => {
    win = createAppWindow();
});

describe('konfig-snapshot: HR:s manuella arbete round-trips', () => {
    // Testdata på gruppnivå — ALDRIG personnamn/personnummer (repot är publikt).
    const NOTE = 'Fast testanteckning på gruppnivå.';
    const STATUS = 'Åtgärd krävs';

    // Nollställ de fält testerna rör, så ordningsberoende undviks.
    const resetFields = () => {
        for (let i = 1; i <= 6; i++) {
            const s = win.document.getElementById('bes8-status-' + i);
            const t = win.document.getElementById('bes8-note-' + i);
            if (s) s.value = '';
            if (t) t.value = '';
        }
        win.__state._actionChecklistDone = new Set();
        const org = win.document.getElementById('kl-org-name');
        if (org) org.value = '';
    };

    it('snapshoten är version 3 och bär bes8/attGoraKlara/orgNamn', () => {
        resetFields();
        const snap = win.__byggKonfiguration();
        expect(snap.version).toBe(3);
        expect(Array.isArray(snap.bes8)).toBe(true);
        expect(snap.bes8.length).toBe(6);
        expect(snap.bes8[0]).toHaveProperty('n');
        expect(snap.bes8[0]).toHaveProperty('status');
        expect(snap.bes8[0]).toHaveProperty('anteckning');
        expect(snap.bes8[0]).not.toHaveProperty('title');   // UI-text sparas ej
        expect(Array.isArray(snap.attGoraKlara)).toBe(true);
        expect(typeof snap.orgNamn).toBe('string');
    });

    it('round-trip återställer § 8-bedömning, avbockningar och org-namn', () => {
        resetFields();
        win.document.getElementById('bes8-status-2').value = STATUS;
        win.document.getElementById('bes8-note-2').value = NOTE;
        win.__state._actionChecklistDone = new Set(['prio-row-x', 'jpa-signed']);
        const orgFalt = win.document.getElementById('kl-org-name');
        orgFalt.value = 'Exempelorganisationen';
        orgFalt.dispatchEvent(new win.Event('change'));   // fältet är kopplat till profilen (ADR-36)

        const snap = win.__byggKonfiguration();
        expect(snap.attGoraKlara).toContain('prio-row-x');

        resetFields();   // simulera "rensa all data" + omladdning
        expect(win.document.getElementById('bes8-note-2').value).toBe('');

        win.__tillampaKonfiguration(snap);
        expect(win.document.getElementById('bes8-status-2').value).toBe(STATUS);
        expect(win.document.getElementById('bes8-note-2').value).toBe(NOTE);
        expect(win.__state._actionChecklistDone.has('prio-row-x')).toBe(true);
        expect(win.__state._actionChecklistDone.has('jpa-signed')).toBe(true);
        expect(win.document.getElementById('kl-org-name').value).toBe('Exempelorganisationen');
        resetFields();
    });

    it('en konfigurationsfil med annat formatnummer än 2 och 3 avvisas', () => {
        const snap = win.__byggKonfiguration();
        expect(() => win.__tillampaKonfiguration({ ...snap, version: 1 })).toThrow(/version 2 och 3/);
        expect(() => win.__tillampaKonfiguration({ ...snap, version: 4 })).toThrow(/version 2 och 3/);
    });
    it('visning.prioReferens i en konfigurationsfil väljer motsvarande referens; värden utanför vitlistan lämnar valet orört', () => {
        const snap = win.__byggKonfiguration();
        const vald = () => win.document.querySelector('input[name="prio-ref"]:checked')?.value;
        win.__tillampaKonfiguration({ ...snap, visning: { ...snap.visning, prioReferens: 'statistik' } });
        expect(vald()).toBe('statistik');
        win.__tillampaKonfiguration({ ...snap, visning: { ...snap.visning, prioReferens: 'stallningstagande' } });
        expect(vald()).toBe('stallningstagande');
        expect(() => win.__tillampaKonfiguration({ ...snap, visning: { ...snap.visning, prioReferens: 'x"]' } })).not.toThrow();
        expect(vald()).toBe('stallningstagande');
        resetFields();
    });
    it('okända fält i en konfigurationsfil ignoreras utan att kasta och hamnar inte i tillståndet', () => {
        const snap = win.__byggKonfiguration();
        win.__tillampaKonfiguration({ ...snap, okantFalt: [1, 2, 3] });
        expect('okantFalt' in win.__state).toBe(false);
        resetFields();
    });

    it('ogiltigt bes8-fält (n utanför 1–6) kastar och muterar inte state', () => {
        const snap = win.__byggKonfiguration();
        snap.bes8 = [{ n: 9, status: '', anteckning: '' }];
        expect(() => win.__tillampaKonfiguration(snap)).toThrow(/bes8/);
        resetFields();
    });

    it('odirtyat struktur-narrativ sparas som null (auto-genereras vid inläsning)', () => {
        const nb = win.document.getElementById('struktur-narrative');
        if (nb) { nb.value = 'auto text'; delete nb.dataset.dirty; }
        const snap = win.__byggKonfiguration();
        expect(snap.strukturNarrativ).toBeNull();
    });
});

describe('ansvarskoden och konfigurationsfilen', () => {
    it('konfigurationsfilen innehåller varken ansvarskoder eller ansvarskolumnen', () => {
        const w = createAppWindow();
        w.__lasInDemodata();
        // Handlingsplanens rader (demots förifyllda skäl) har fältet "ansvarig", en roll och inte ansvarskoden: töms här.
        w.__state.handlingsplan = {};
        expect(JSON.stringify(w.__byggKonfiguration())).not.toMatch(/ansvar/i);
    });
});

describe('äldre konfigurationsfiler (version 2, de gamla fältnamnen, ADR-96)', () => {
    // Regressionsprov: en fil som version 2 skrev den, med påhittade värden. Ändras inte när formatet ändras.
    const GAMMAL_FIL = Object.freeze({
        version: 2, timestamp: '2026-01-01T00:00:00.000Z',
        prioConfig: { atgardThreshold: -6, akutMinN: 12, bevakaThreshold: -3, analyseraThreshold: 4 },
        prioWeights: { avvikelse: 40, volym: 40, jamstalldhet: 20 },
        costSettings: { months: 6, poPct: 35 },
        kTroskel: 10,
        bristAids: ['123'],
        likvardighet: { kvinnoTrosholdPct: 65, kvDomDefinition: 'scb', jamforelse: 'mansdominerade', minGapPct: 3, topN: 30 },
        forecast: {
            budget: { mode: 'pct', value: 2.5 }, generell: { mode: 'kr', value: 500 },
            targets: [{ bas: 'C', aid: '123', mode: 'kr', value: 900, dist: 'flat', targetLevel: 'p25', pool: 'marknad' }],
            minGroupN: 8, roundStep: 100, years: 2
        },
        ui: { prioRef: 'statistik', prioLabelMode: 'alla', konColorBy: 'bas', orgTyp: 'region', jamforelse: { bas: '', sektor: '' } },
        bes8: [{ n: 2, status: 'Åtgärd krävs', note: 'Anteckning på gruppnivå.' }],
        actionChecklistDone: ['punkt-a'], orgName: 'Exempelorganisationen', strukturNarrative: 'Egen text om strukturen.'
    });
    const kopia = o => JSON.parse(JSON.stringify(o));
    // Det inlästa tillståndet som det skrivs tillbaka, utan tidpunkten (sparad).
    const lasIn = cfg => { const w = createAppWindow(); w.__tillampaKonfiguration(kopia(cfg)); const s = kopia(w.__byggKonfiguration()); delete s.sparad; return s; };

    it('en fil med de gamla namnen ger samma tillstånd som samma fil med de nya', () => {
        const franGammal = lasIn(GAMMAL_FIL);
        expect(franGammal).toEqual(lasIn({ ...konfigurationMedNyaNamn(GAMMAL_FIL), version: 3 }));
        // Och filens värden gäller, inte standardvärdena.
        expect(franGammal.prioTrosklar).toEqual({ atgardTroskel: -6, akutMinstN: 12, bevakaTroskel: -3, analyseraTroskel: 4 });
        expect(franGammal.kostnad).toEqual({ manader: 6, poPct: 35 });
        expect(franGammal.likvardighet).toEqual({ kvinnoTroskelPct: 65, kvDomDefinition: 'scb', jamforelse: 'mansdominerade', minstaGapPct: 3, antalPar: 30 });
        expect(franGammal.loneoversyn).toMatchObject({ budget: { enhet: 'pct', varde: 2.5 }, generell: { enhet: 'kr', varde: 500 }, minstaGruppN: 8, avrundning: 100, ar: 2,
            mal: [{ bas: 'C', aid: '123', enhet: 'kr', varde: 900, fordelning: 'flat', malniva: 'p25', pott: 'marknad' }] });
        expect(franGammal.visning).toMatchObject({ prioReferens: 'statistik', prioEtiketter: 'alla', konFargning: 'bas', organisationstyp: 'region' });
        expect(franGammal.bes8.find(a => a.n === 2)).toEqual({ n: 2, status: 'Åtgärd krävs', anteckning: 'Anteckning på gruppnivå.' });
        expect(franGammal).toMatchObject({ attGoraKlara: ['punkt-a'], orgNamn: 'Exempelorganisationen', strukturNarrativ: 'Egen text om strukturen.' });
    });
    it('en fil som sparas innehåller inga gamla namn', () => {
        const fil = lasIn(GAMMAL_FIL);
        expect(konfigurationMedNyaNamn(fil)).toEqual(fil);   // inget att byta: inget gammalt namn på tabellens vägar
        for (const gammalt of Object.keys(KONFIGURATION_NAMNBYTEN[''])) expect(fil).not.toHaveProperty(gammalt);
    });
    it('gränserna gäller under båda namnen: kvinnotröskeln 50–70 och beräkningsperioden', () => {
        const w = createAppWindow();
        const fore = w.__state.likvardighet.kvinnoTrosholdPct;
        expect(() => w.__tillampaKonfiguration({ version: 2, likvardighet: { kvinnoTrosholdPct: 40 } })).toThrow(/likvardighet\.kvinnoTroskelPct måste vara ett tal mellan 50 och 70/);
        expect(() => w.__tillampaKonfiguration({ version: 3, likvardighet: { kvinnoTroskelPct: 75 } })).toThrow(/mellan 50 och 70/);
        expect(w.__state.likvardighet.kvinnoTrosholdPct).toBe(fore);   // tillståndet orört
        expect(() => w.__tillampaKonfiguration({ version: 2, costSettings: { months: 0 } })).toThrow(/kostnad\.manader/);
        expect(() => w.__tillampaKonfiguration({ version: 3, kostnad: { manader: 61 } })).toThrow(/kostnad\.manader/);
        expect(() => w.__tillampaKonfiguration({ version: 2, prioConfig: { akutMinN: 0 } })).toThrow(/prioTrosklar\.akutMinstN/);
    });
});

// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
// Konfigurationsfilen i appen: HR:s manuella arbete sparas och läses tillbaka, också ansvarskoden.
import { describe, it, expect, beforeAll } from 'vitest';
import { createAppWindow } from './helpers/app-harness.js';

let win;

beforeAll(() => {
    win = createAppWindow();
});

describe('konfig-snapshot v2: HR:s manuella arbete round-trips', () => {
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

    it('snapshoten är version 2 och bär bes8/actionChecklistDone/orgName', () => {
        resetFields();
        const snap = win.__buildConfigSnapshot();
        expect(snap.version).toBe(2);
        expect(Array.isArray(snap.bes8)).toBe(true);
        expect(snap.bes8.length).toBe(6);
        expect(snap.bes8[0]).toHaveProperty('n');
        expect(snap.bes8[0]).toHaveProperty('status');
        expect(snap.bes8[0]).toHaveProperty('note');
        expect(snap.bes8[0]).not.toHaveProperty('title');   // UI-text sparas ej
        expect(Array.isArray(snap.actionChecklistDone)).toBe(true);
        expect(typeof snap.orgName).toBe('string');
    });

    it('round-trip återställer § 8-bedömning, avbockningar och org-namn', () => {
        resetFields();
        win.document.getElementById('bes8-status-2').value = STATUS;
        win.document.getElementById('bes8-note-2').value = NOTE;
        win.__state._actionChecklistDone = new Set(['prio-row-x', 'jpa-signed']);
        const orgFalt = win.document.getElementById('kl-org-name');
        orgFalt.value = 'Exempelorganisationen';
        orgFalt.dispatchEvent(new win.Event('change'));   // fältet är kopplat till profilen (ADR-36)

        const snap = win.__buildConfigSnapshot();
        expect(snap.actionChecklistDone).toContain('prio-row-x');

        resetFields();   // simulera "rensa all data" + omladdning
        expect(win.document.getElementById('bes8-note-2').value).toBe('');

        win.__applyConfigSnapshot(snap);
        expect(win.document.getElementById('bes8-status-2').value).toBe(STATUS);
        expect(win.document.getElementById('bes8-note-2').value).toBe(NOTE);
        expect(win.__state._actionChecklistDone.has('prio-row-x')).toBe(true);
        expect(win.__state._actionChecklistDone.has('jpa-signed')).toBe(true);
        expect(win.document.getElementById('kl-org-name').value).toBe('Exempelorganisationen');
        resetFields();
    });

    it('en konfigurationsfil med annat formatnummer än 2 avvisas', () => {
        const snap = win.__buildConfigSnapshot();
        expect(() => win.__applyConfigSnapshot({ ...snap, version: 1 })).toThrow(/version 2/);
        expect(() => win.__applyConfigSnapshot({ ...snap, version: 3 })).toThrow(/version 2/);
    });
    it('ui.prioRef i en konfigurationsfil väljer motsvarande referens; värden utanför vitlistan lämnar valet orört', () => {
        const snap = win.__buildConfigSnapshot();
        const vald = () => win.document.querySelector('input[name="prio-ref"]:checked')?.value;
        win.__applyConfigSnapshot({ ...snap, ui: { ...snap.ui, prioRef: 'statistik' } });
        expect(vald()).toBe('statistik');
        win.__applyConfigSnapshot({ ...snap, ui: { ...snap.ui, prioRef: 'stallningstagande' } });
        expect(vald()).toBe('stallningstagande');
        expect(() => win.__applyConfigSnapshot({ ...snap, ui: { ...snap.ui, prioRef: 'x"]' } })).not.toThrow();
        expect(vald()).toBe('stallningstagande');
        resetFields();
    });
    it('okända fält i en konfigurationsfil ignoreras utan att kasta och hamnar inte i tillståndet', () => {
        const snap = win.__buildConfigSnapshot();
        win.__applyConfigSnapshot({ ...snap, okantFalt: [1, 2, 3] });
        expect('okantFalt' in win.__state).toBe(false);
        resetFields();
    });

    it('ogiltigt bes8-fält (n utanför 1–6) kastar och muterar inte state', () => {
        const snap = win.__buildConfigSnapshot();
        snap.bes8 = [{ n: 9, status: '', note: '' }];
        expect(() => win.__applyConfigSnapshot(snap)).toThrow(/bes8/);
        resetFields();
    });

    it('odirtyat struktur-narrativ sparas som null (auto-genereras vid inläsning)', () => {
        const nb = win.document.getElementById('struktur-narrative');
        if (nb) { nb.value = 'auto text'; delete nb.dataset.dirty; }
        const snap = win.__buildConfigSnapshot();
        expect(snap.strukturNarrative).toBeNull();
    });
});

describe('ansvarskoden och konfigurationsfilen', () => {
    it('konfigurationsfilen innehåller varken ansvarskoder eller ansvarskolumnen', () => {
        const w = createAppWindow();
        w.__loadDemoData();
        // Handlingsplanens rader (demots förifyllda skäl) har fältet "ansvarig", en roll och inte ansvarskoden: töms här.
        w.__state.handlingsplan = {};
        expect(JSON.stringify(w.__buildConfigSnapshot())).not.toMatch(/ansvar/i);
    });
});

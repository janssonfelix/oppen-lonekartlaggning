/**
 * Flikstrukturen efter omläggningen 2026-11-06: varje avsnitt i en flik av sin sort, menyn i rapportens ordning.
 * Vaktar var panelerna ligger och vart låsta flikar leder; innehållet i panelerna testas i respektive svit.
 */
import { describe, it, expect } from 'vitest';
import { createAppWindow } from './helpers/app-harness.js';

describe('Uppgift 1: Filer och kvalitet', () => {
    it('Filer och kvalitet bär filrutorna, kvaliteten och extremvärdena; Översikt inte', () => {
        const d = createAppWindow().document, filer = d.getElementById('view-filer'), ov = d.getElementById('view-dashboard');
        expect(filer).toBeTruthy();
        for (const id of ['organisationspaket', 'upload-cell-data', 'underlagets-kvalitet', 'outliers-container', 'paket-skapa'])
            expect(filer.contains(d.getElementById(id)), id).toBe(true);
        for (const id of ['att-gora', 'avsnitt-ov-process', 'ov-filrad']) expect(ov.contains(d.getElementById(id)), id).toBe(true);
        expect(ov.contains(d.getElementById('upload-sektion'))).toBe(false);
        expect(d.getElementById('chart-ov-kvartiler')).toBeNull();
    });
    it('en låst flik leder till Filer och kvalitet och ger filväljaren fokus', () => {
        const d = createAppWindow().document;
        d.getElementById('tab-matrix').click();
        expect(d.querySelector('.nav-item.active').getAttribute('data-tab')).toBe('filer');
        expect(d.getElementById('view-filer').style.display).toBe('block');
        expect(d.activeElement.id).toBe('file-input-data');
    });
    it('Filer och kvalitet går att öppna utan lönefil, och heter så i sidhuvudet', () => {
        const d = createAppWindow().document, knapp = d.getElementById('tab-filer');
        expect(knapp.getAttribute('aria-disabled')).toBeNull();
        knapp.click();
        expect(d.getElementById('page-title').textContent).toBe('Filer och kvalitet');
    });
});

describe('Uppgift 1: kolumnmappningen', () => {
    it('en lönefil med okända kolumner visar Filer och kvalitet med mappningen, även om en annan flik var öppen', () => {
        const w = createAppWindow(), d = w.document;
        d.querySelector('.nav-item[data-tab="info"]').click();
        w.__state._dataHeaders = ['Avd', 'Befattning', 'Grundlon', 'Fodd', 'Sex'];
        w.eval('maybeShowColumnMapping(); _visaKolumnmappning()');
        expect(d.querySelector('.nav-item.active').getAttribute('data-tab')).toBe('filer');
        expect(d.getElementById('view-filer').contains(d.getElementById('column-map-panel'))).toBe(true);
    });
});

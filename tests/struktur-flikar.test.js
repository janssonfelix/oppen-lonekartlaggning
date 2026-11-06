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

describe('Uppgift 2: Lönestruktur', () => {
    it('Lönestruktur visar struktur, BAS-skevhet, regression och gapuppdelningen; Lika arbete bara yrkesgrupperna', () => {
        const w = createAppWindow(); w.__loadDemoData();
        const d = w.document, synlig = id => d.getElementById(id).style.display === 'block';
        d.querySelector('.nav-item[data-tab="struktur"]').click();
        expect(synlig('view-struktur') && synlig('view-skevhet') && synlig('view-regression')).toBe(true);
        expect(d.getElementById('view-struktur').contains(d.getElementById('gap-uppdelning'))).toBe(true);
        expect(d.getElementById('view-regression').querySelector('[data-audit-id="skevhet"]')).toBeTruthy();
        expect(d.getElementById('regression-card').children.length).toBeGreaterThan(0);
        d.querySelector('.nav-item[data-tab="matrix"]').click();
        expect(synlig('view-lika-yrken')).toBe(true);
        expect(synlig('view-skevhet') || synlig('view-regression')).toBe(false);
        expect(d.getElementById('view-lika-yrken').querySelector('[data-audit-id="matrix"]')).toBeTruthy();
        expect(d.getElementById('view-dashboard').contains(d.getElementById('gap-uppdelning'))).toBe(false);
    });
    it('rapportmodellens BAS-bilder ritas av Lönestruktur', () => {
        const w = createAppWindow();
        for (const id of ['chart-skevhet-overview', 'chart-skevhet-andel', 'chart-perbas-gap'])
            expect(w.eval('RM_DIAGRAM').find(r => r.id === id).flik, id).toBe('struktur');
    });
    it('bara representationen är utfälld i Lönestruktur efter inläsning', () => {
        const w = createAppWindow(); w.__loadDemoData();
        const d = w.document;
        d.querySelector('.nav-item[data-tab="struktur"]').click();
        const oppna = ['view-struktur', 'view-skevhet', 'view-regression']
            .flatMap(id => [...d.getElementById(id).querySelectorAll('details.avsnitt')])
            .filter(a => a.open).map(a => a.id);
        expect(oppna).toEqual(['avsnitt-st-representation']);
    });
    it('navigateTo("skevhet") och navigateTo("regression") öppnar Lönestruktur', () => {
        const w = createAppWindow(); w.__loadDemoData();
        for (const alias of ['skevhet', 'regression']) {
            w.eval(`navigateTo('${alias}')`);
            expect(w.document.querySelector('.nav-item.active').getAttribute('data-tab'), alias).toBe('struktur');
        }
    });
});

describe('Uppgift 3: Rapporttext, Exportera och Spara och jämför år', () => {
    it('Rapporttext bär auto-utkastet och rapportunderlaget; Exportera färdigcheck, robusthet, urval och exporter; Arbetet spara, ögonblicksbild, årsjämförelse, självdiagnostik', () => {
        const d = createAppWindow().document, i = (vy, id) => d.getElementById(vy).contains(d.getElementById(id));
        expect(i('view-rapporttext', 'struktur-narrative') && i('view-rapporttext', 'rapportunderlag')).toBe(true);
        expect(i('view-dokumentera', 'export-hub') && i('view-dokumentera', 'robusthet-body') && i('view-dokumentera', 'rapport-urval')).toBe(true);
        expect(i('view-arbetet', 'btn-config-save') && i('view-arbetet', 'btn-snapshot-save') && i('view-arbetet', 'arsjamforelse') && i('view-arbetet', 'btn-test-load')).toBe(true);
        expect(d.getElementById('avsnitt-dk-samverkan')).toBeNull();
    });
    it('Exportera och Spara och jämför år går att öppna utan lönefil; Rapporttext är låst', () => {
        const d = createAppWindow().document;
        expect(d.getElementById('tab-arbetet').getAttribute('aria-disabled')).toBeNull();
        expect(d.getElementById('tab-dokumentera').getAttribute('aria-disabled')).toBeNull();
        expect(d.getElementById('tab-rapporttext').getAttribute('aria-disabled')).toBe('true');
        d.getElementById('tab-rapporttext').click();
        expect(d.querySelector('.nav-item.active').getAttribute('data-tab')).toBe('filer');
        for (const [flik, titel] of [['arbetet', 'Spara och jämför år'], ['dokumentera', 'Exportera']]) {
            d.getElementById('tab-' + flik).click();
            expect(d.querySelector('.nav-item.active').getAttribute('data-tab'), flik).toBe(flik);
            expect(d.getElementById('page-title').textContent).toBe(titel);
        }
    });
    it('Rapporttext och årsjämförelsen ritas i exportläge', () => {
        const w = createAppWindow(); w.__loadDemoData();
        const d = w.document;
        w.eval(`window.__lagen = [];
            for (const namn of ['renderStrukturUtkast', 'renderRapportunderlag', 'renderArsjamforelse']) {
                const orig = window[namn];
                window[namn] = (...a) => { window.__lagen.push(namn + ':' + iExportLage()); return orig(...a); };
            }`);
        d.getElementById('tab-rapporttext').click();
        expect(d.getElementById('page-title').textContent).toBe('Rapporttext');
        expect(d.getElementById('struktur-narrative').value).toContain('LÖNEKARTLÄGGNING');
        d.getElementById('tab-arbetet').click();
        expect(w.__lagen).toEqual(['renderStrukturUtkast:true', 'renderRapportunderlag:true', 'renderArsjamforelse:true']);
        expect(w.eval('iExportLage()')).toBe(false);
    });
    it('Lönestruktur bygger inte längre utkastet; årsjämförelsens bild ritas av Spara och jämför år', () => {
        const w = createAppWindow(); w.__loadDemoData();
        w.document.querySelector('.nav-item[data-tab="struktur"]').click();
        expect(w.document.getElementById('struktur-narrative').value).toBe('');
        expect(w.eval('RM_DIAGRAM').find(r => r.id === 'chart-arsjamforelse').flik).toBe('arbetet');
        w.eval(`navigateTo('spara')`);
        expect(w.document.querySelector('.nav-item.active').getAttribute('data-tab')).toBe('arbetet');
    });
    it('samverkansknapparna står i Handlingsplan och leder till exporterna', () => {
        const w = createAppWindow(), d = w.document;
        const knappar = [...d.querySelectorAll('[data-dok-klick]')];
        expect(knappar.map(b => b.dataset.dokKlick)).toEqual(['btn-hub-jpa', 'btn-hub-handlingsplan']);
        expect(knappar.every(b => b.closest('.view-panel').id === 'view-handlingsplan')).toBe(true);
        let klick = 0;
        d.getElementById('btn-hub-handlingsplan').addEventListener('click', () => klick++);
        knappar[1].click();
        expect(klick).toBe(1);
    });
});

describe('Uppgift 4: Prioriteringens trösklar och viktning i Inställningar', () => {
    it('Prioriteringens trösklar och viktning står i Inställningar-dialogen, och fliken länkar dit', () => {
        const d = createAppWindow().document, m = d.getElementById('installningar-modal');
        for (const id of ['prio-cfg-atgard', 'prio-cfg-akutN', 'prio-cfg-bevaka', 'prio-cfg-analysera', 'prio-cfg-reset', 'prio-w-avvikelse', 'prio-w-volym', 'prio-w-jamstalldhet', 'prio-w-reset'])
            expect(m.contains(d.getElementById(id)), id).toBe(true);
        expect(d.querySelector('#view-prioritering [data-oppna-installningar="prio-cfg-atgard"]')).toBeTruthy();
        expect(d.getElementById('avsnitt-pr-installningar')).toBeNull();
    });
    it('fliken säger om trösklarna är ändrade, och "Ändra" öppnar dialogen med fokus i granskningsgränsen', () => {
        const w = createAppWindow(), d = w.document;
        w.__loadDemoData();
        w.__renderTabContent('prioritering');
        const rad = d.getElementById('pr-installningar-rad');
        expect(rad.textContent).toMatch(/^Trösklar och viktning: standardvärden/);
        rad.querySelector('[data-oppna-installningar]').click();
        expect(d.getElementById('installningar-modal').style.display).toBe('flex');
        expect(d.activeElement.id).toBe('prio-cfg-atgard');
        const falt = d.getElementById('prio-cfg-atgard');
        falt.value = '-8';
        falt.dispatchEvent(new w.Event('input', { bubbles: true }));
        expect(w.__state.prioConfig.atgardThreshold).toBe(-8);
        expect(rad.textContent).toMatch(/^Trösklar och viktning: anpassade värden/);
    });
    it('en konfigurationsfil som läses in före lönefilen sätter trösklarna i dialogen', () => {
        const w = createAppWindow(), d = w.document;
        w.eval(`applyConfigSnapshot(${JSON.stringify({ version: 2, prioConfig: { akutMinN: 7 } })})`);
        const falt = d.getElementById('prio-cfg-akutN');
        expect(d.getElementById('installningar-modal').contains(falt)).toBe(true);
        expect(falt.value).toBe('7');
        w.__loadDemoData();
        w.__renderTabContent('prioritering');
        expect(w.__state.prioConfig.akutMinN).toBe(7);
        expect(d.getElementById('pr-installningar-rad').textContent).toMatch(/anpassade värden/);
    });
});

/**
 * Flikstrukturen efter omläggningen 2026-11-06: varje avsnitt i en flik av sin sort, menyn i rapportens ordning.
 * Vaktar var panelerna ligger och vart låsta flikar leder; innehållet i panelerna testas i respektive svit.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createAppWindow } from './helpers/app-harness.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

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
        // Auto-utkastets avsnitt bär Rapporttextens prefix (rt-), inte Lönestrukturens.
        expect(i('view-rapporttext', 'avsnitt-rt-utkast') && i('view-rapporttext', 'nyckel-rt-utkast')).toBe(true);
        expect(d.querySelector('[id$="st-utkast"]')).toBeNull();
        expect(i('view-dokumentera', 'export-hub') && i('view-dokumentera', 'robusthet-body') && i('view-dokumentera', 'rapport-urval')).toBe(true);
        expect(i('view-arbetet', 'btn-config-save') && i('view-arbetet', 'btn-snapshot-save') && i('view-arbetet', 'arsjamforelse') && i('view-arbetet', 'btn-test-load')).toBe(true);
        expect(d.getElementById('avsnitt-dk-samverkan')).toBeNull();
    });
    it('Översikt, Filer och kvalitet, Regler & praxis, Handlingsplan, Exportera, Spara och jämför år och Om verktyget går att öppna utan lönefil; Rapporttext är låst', () => {
        const d = createAppWindow().document;
        expect(d.getElementById('tab-arbetet').getAttribute('aria-disabled')).toBeNull();
        expect(d.getElementById('tab-dokumentera').getAttribute('aria-disabled')).toBeNull();
        expect(d.getElementById('tab-rapporttext').getAttribute('aria-disabled')).toBe('true');
        d.getElementById('tab-rapporttext').click();
        expect(d.querySelector('.nav-item.active').getAttribute('data-tab')).toBe('filer');
        for (const [flik, titel] of [['arbetet', 'Spara och jämför år'], ['dokumentera', 'Exportera'], ['bestammelser', 'Regler & praxis'],
            ['handlingsplan', 'Handlingsplan'], ['info', 'Om verktyget'], ['filer', 'Filer och kvalitet'], ['dashboard', 'Översikt']]) {
            d.querySelector(`.nav-item[data-tab="${flik}"]`).click();
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
    it('Återskapa i Rapporttext nollar redigeringen och bygger utkastet på nytt i exportläge', () => {
        const w = createAppWindow(); w.__loadDemoData();
        const d = w.document, nb = d.getElementById('struktur-narrative');
        d.getElementById('tab-rapporttext').click();
        nb.value = 'Egen text';
        nb.dispatchEvent(new w.Event('input', { bubbles: true }));
        expect(nb.dataset.dirty).toBe('1');
        w.eval(`window.__lagen = []; { const o = renderStrukturUtkast; window.renderStrukturUtkast = (...a) => { window.__lagen.push(iExportLage()); return o(...a); }; }`);
        d.getElementById('struktur-narrative-regen').click();
        expect(nb.dataset.dirty).toBeUndefined();
        expect(nb.value).toContain('LÖNEKARTLÄGGNING');
        expect(nb.value).not.toBe('Egen text');
        expect(w.__lagen).toEqual([true]);
        expect(w.eval('iExportLage()')).toBe(false);
    });
    it('Rensa all data tömmer rapportutkastet, också ett redigerat', () => {
        const w = createAppWindow(); w.__loadDemoData();
        const nb = w.document.getElementById('struktur-narrative');
        w.__renderTabContent('rapporttext');
        expect(nb.value).toContain('LÖNEKARTLÄGGNING');
        nb.dataset.dirty = '1';
        w.eval('_rensaAllData()');
        expect(nb.value).toBe('');
        expect(nb.dataset.dirty).toBeUndefined();
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

describe('Uppgift 5: menyn i rapportens ordning', () => {
    it('menyknapparnas aria-controls nämner flikens paneler (PANEL_GROUPS), redan i index.html', () => {
        const w = createAppWindow(), d = w.document, grupper = w.eval('PANEL_GROUPS');
        // 63-tangentbordsnavigering.js sätter attributet vid start; markeringen i index.html ska säga samma sak.
        const kalla = new w.DOMParser().parseFromString(readFileSync(join(__dirname, '..', 'src', 'index.html'), 'utf8'), 'text/html');
        for (const dok of [d, kalla]) {
            for (const b of dok.querySelectorAll('.nav-menu .nav-item')) {
                const flik = b.dataset.tab, forvantat = (grupper[flik] || [flik]).map(p => 'view-' + p);
                expect(b.getAttribute('aria-controls').split(/\s+/), `${dok === d ? 'appen' : 'index.html'}: ${flik}`).toEqual(forvantat);
                for (const id of forvantat) expect(d.getElementById(id), id).toBeTruthy();
            }
        }
    });
    it('Inställningar: Viktning av prioriteringsindex är en underrubrik till Prioritering', () => {
        const d = createAppWindow().document;
        const rubrik = [...d.querySelectorAll('#installningar-modal h3, #installningar-modal h4')].find(h => /Viktning av prioriteringsindex/.test(h.textContent));
        expect(rubrik.tagName).toBe('H4');
    });
    it('menyn står i rapportens ordning', () => {
        const d = createAppWindow().document;
        expect([...d.querySelectorAll('.nav-menu .nav-item')].map(b => b.dataset.tab)).toEqual(
            ['dashboard', 'filer', 'bestammelser', 'benchmark', 'matrix', 'likvardighet', 'struktur', 'kon',
             'prioritering', 'loneoversyn', 'handlingsplan', 'rapporttext', 'dokumentera', 'utforska', 'arbetet', 'info']);
        expect([...d.querySelectorAll('.nav-group')].map(g => g.textContent.trim())).toEqual(
            ['1 · Underlag', '2 · Kartläggning', '3 · Åtgärder', '4 · Rapport', 'Arbetet', 'Hjälp']);
        expect(d.querySelector('[data-tab="benchmark"] .nav-etikett').textContent.trim()).toBe('Löneläget');
    });
    it('Ålder & karriär och Löneläget säger i inledningen att de inte är lagkrav', () => {
        const d = createAppWindow().document;
        for (const v of ['view-kon', 'view-benchmark']) expect(d.querySelector(`#${v} .flik-intro`).textContent).toMatch(/inget lagkrav/i);
    });
    it('Ålder & karriär och Löneläget säger först i sin knapptext att de är fördjupning; Tabeller och egna vyer heter så', () => {
        const d = createAppWindow().document;
        for (const t of ['kon', 'benchmark']) expect(d.querySelector(`.nav-item[data-tab="${t}"]`).dataset.tip, t).toMatch(/^Fördjupning, inget lagkrav\./);
        expect(d.querySelector('[data-tab="utforska"] .nav-etikett').textContent.trim()).toBe('Tabeller och egna vyer');
    });
    it('sidhuvudet heter som menyn för varje flik', () => {
        const w = createAppWindow();
        w.__loadDemoData();
        const d = w.document;
        for (const b of d.querySelectorAll('.nav-menu .nav-item')) {
            if (b.hidden || b.disabled) continue;
            /** @type {HTMLElement} */ (b).click();
            expect(d.getElementById('page-title').textContent, b.dataset.tab).toBe(b.querySelector('.nav-etikett').textContent.trim());
        }
    });
    it('Nästa steg följer rapportens ordning; Löneläget och Ålder & karriär hoppas över när de är låsta', () => {
        const w = createAppWindow();
        const kedja = [];
        for (let t = 'bestammelser'; w.eval('FLOW_NEXT')[t]; t = w.eval('FLOW_NEXT')[t].tab) kedja.push(w.eval('FLOW_NEXT')[t].tab);
        expect(kedja).toEqual(['benchmark', 'matrix', 'likvardighet', 'struktur', 'kon', 'prioritering', 'loneoversyn',
            'handlingsplan', 'rapporttext', 'dokumentera']);
        expect(w.eval('_FLOW_VALFRIA')).toEqual(['benchmark', 'kon']);
        w.__loadDemoData();
        w.document.querySelector('.nav-item[data-tab="benchmark"]').disabled = true;
        w.document.querySelector('.nav-item[data-tab="kon"]').disabled = true;
        expect(w.eval("_flowNasta('bestammelser').tab")).toBe('matrix');
        expect(w.eval("_flowNasta('struktur').tab")).toBe('prioritering');
    });
    it('utan lönefil leder Nästa steg till en låst flik som menyn gör: till lönefilen i Filer och kvalitet', () => {
        for (const [fran, mal] of [['handlingsplan', 'rapporttext'], ['bestammelser', 'matrix']]) {
            const w = createAppWindow();
            const d = w.document;
            /** @type {HTMLElement} */ (d.querySelector(`.nav-item[data-tab="${fran}"]`)).click();
            const knapp = d.querySelector('.flow-next-bar [data-flow-tab]');
            expect(knapp?.getAttribute('data-flow-tab'), fran).toBe(mal);
            /** @type {HTMLElement} */ (knapp).click();
            expect(d.querySelector('.nav-item.active').dataset.tab, fran).toBe('filer');
            expect(d.activeElement.id, fran).toBe('file-input-data');
            expect(d.getElementById('upload-cell-data').classList.contains('visas-nu'), fran).toBe(true);
        }
    });
});

describe('Lönestrukturens mått räknas på ett ställe', () => {
    it('_stMatt ger fliken, rapportutkastet och EU-exporten samma mått som lib-funktionerna', () => {
        const w = createAppWindow(); w.__loadDemoData();
        const d = w.eval('getData()'), k = w.eval('kTroskel()');
        const m = w.eval('_stMatt')(d, k);
        const arKv = r => r.kon && r.kon.includes('kvinna'), arMa = r => r.kon === 'man' || r.kon === 'män';
        const kv = d.filter(arKv).map(r => r.lon), ma = d.filter(arMa).map(r => r.lon);
        const medel = a => a.reduce((s, x) => s + x, 0) / a.length;
        expect(m.konOk).toBe(w.eval('_konFarRedovisasFor')(d));
        expect(m.totKv).toBe(kv.length);
        expect(m.totAndel).toBe(100 * kv.length / d.length);
        expect(m.kv).toEqual(kv); expect(m.ma).toEqual(ma);
        expect(m.meanGap).toBe((medel(kv) / medel(ma) - 1) * 100);
        expect(m.medGap).toBe(w.eval('_stMedianGapPct')(d, { k }));
        expect(m.rep).toEqual(w.eval('_stRepresentationByBas')(d, { k }));
        expect(m.dist).toEqual(w.eval('_stDistributionalGap')(d, undefined, { k }));
        expect(m.q).toEqual(w.eval('_stQuartileDistribution')(d, { k }));
        expect(w.eval('_stMatt')([], k)).toMatchObject({ totKv: 0, totAndel: 0, meanGap: null });
    });
    it('medellönegapet står en gång i 37-struktur.js, inte i tre kopior', () => {
        const kalla = readFileSync(join(__dirname, '..', 'src', 'app', '37-struktur.js'), 'utf8');
        expect(kalla.match(/kv\.reduce\(\(s, x\) => s \+ x, 0\) \/ kv\.length/g)).toHaveLength(1);
        for (const f of ['renderStructure', 'renderStrukturUtkast', '_exportEuReportExport']) {
            const kropp = kalla.slice(kalla.indexOf(`function ${f}(`)).split(/\n}\n/)[0];
            expect(kropp, f).toContain('_stMatt(d, k)');
        }
    });
});

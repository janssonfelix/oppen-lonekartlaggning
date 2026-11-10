// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
// Tabeller och egna vyer: underflikarna Egna vyer och Alla diagram (74-alla-diagram.js). Underflikarnas ARIA och
// tangentbord, grupperna i menyns ordning, kopiorna (samma figur som källan, egna filter, eget id, egen meny), att
// kopiorna inte följer med i ZIP-filen, att en export ur en kopia går genom källan, och att flikarna utan grupp
// förblir utan diagram.
import { describe, it, expect, vi } from 'vitest';
import { createAppWindow } from './helpers/app-harness.js';

vi.setConfig({ testTimeout: 30000 });

const nav = (w, flik) => w.document.querySelector(`.nav-item[data-tab="${flik}"]`).click();
const fonster = () => { const w = createAppWindow(); w.__loadDemoData(); nav(w, 'utforska'); return w; };
const oppnaGrupp = (w, flik) => {
    const g = w.document.getElementById(`ut-alla-${flik}`);
    g.open = true;
    g.dispatchEvent(new w.Event('toggle'));
    return g;
};
const kopior = g => [...g.querySelectorAll('[id^="ut-diagram-"]')];

describe('Underflikarna Egna vyer och Alla diagram', () => {
    it('växlar med klick och pilar, med rätt ARIA, och minns valet när fliken öppnas igen', () => {
        const w = fonster(), d = w.document;
        const lista = d.querySelector('#view-utforska [role="tablist"]');
        const egna = d.getElementById('ut-flik-egna'), alla = d.getElementById('ut-flik-alla');
        expect(lista.getAttribute('aria-label')).toBe('Tabeller och egna vyer');
        expect([...lista.querySelectorAll('[role="tab"]')].map(b => b.textContent)).toEqual(['Egna vyer', 'Alla diagram']);
        expect(egna.getAttribute('aria-controls')).toBe('ut-egna');
        expect(alla.getAttribute('aria-controls')).toBe('ut-alla-diagram');
        for (const id of ['ut-egna', 'ut-alla-diagram']) expect(d.getElementById(id).getAttribute('role')).toBe('tabpanel');
        // Förvalt: Egna vyer.
        expect(egna.getAttribute('aria-selected')).toBe('true');
        expect(alla.getAttribute('aria-selected')).toBe('false');
        expect(d.getElementById('ut-egna').hidden).toBe(false);
        expect(d.getElementById('ut-alla-diagram').hidden).toBe(true);
        expect([egna.tabIndex, alla.tabIndex]).toEqual([0, -1]);
        // Pil höger: Alla diagram, med fokus.
        egna.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
        expect(alla.getAttribute('aria-selected')).toBe('true');
        expect(egna.getAttribute('aria-selected')).toBe('false');
        expect(d.activeElement).toBe(alla);
        expect([egna.tabIndex, alla.tabIndex]).toEqual([-1, 0]);
        expect(d.getElementById('ut-egna').hidden).toBe(true);
        expect(d.getElementById('ut-alla-diagram').hidden).toBe(false);
        // Valet står kvar när användaren går till en annan flik och tillbaka.
        nav(w, 'struktur'); nav(w, 'utforska');
        expect(alla.getAttribute('aria-selected')).toBe('true');
        expect(d.getElementById('ut-alla-diagram').hidden).toBe(false);
        // Klick tillbaka; Om verktygets sektioner rörs inte av underflikarna.
        egna.click();
        expect(d.getElementById('ut-egna').hidden).toBe(false);
        expect(d.querySelector('#view-info .info-section-btn.active').dataset.section).toBe('overview');
        expect(egna.classList.contains('active') && !alla.classList.contains('active')).toBe(true);
    });

    it('sökningen leder till Alla diagram och tillbaka till Egna vyer', () => {
        const w = fonster(), d = w.document;
        const reg = w.eval('SOK_FUNKTIONER');
        expect(reg.find(p => p.avsnitt === 'ut-alla-diagram')).toMatchObject({ namn: 'Alla diagram', flik: 'utforska' });
        const valj = text => {
            const f = d.getElementById('sok-grupp'); f.value = text; f.dispatchEvent(new w.Event('input', { bubbles: true }));
            const li = [...d.querySelectorAll('#sok-grupp-lista [data-sok-funktion]')].find(x => x.querySelector('.sok-namn').textContent === text);
            li.click();
        };
        nav(w, 'struktur');
        valj('Alla diagram');
        expect(d.querySelector('.nav-item.active').dataset.tab).toBe('utforska');
        expect(d.getElementById('ut-alla-diagram').hidden).toBe(false);
        valj('Egna vyer');
        expect(d.getElementById('ut-egna').hidden).toBe(false);
        expect(d.getElementById('avsnitt-ut-egna').contains(d.activeElement)).toBe(true);
    });
});

describe('Alla diagram: grupperna och kopiorna', () => {
    it('en grupp per upplåst flik med diagram, i menyns ordning, stängd från början', () => {
        const w = fonster(), d = w.document;
        d.getElementById('ut-flik-alla').click();
        const grupper = [...d.querySelectorAll('#ut-alla-grupper > details.avsnitt')];
        const flikar = grupper.map(g => g.dataset.utFlik);
        const menyn = [...d.querySelectorAll('.nav-item[data-tab]')].map(b => b.dataset.tab).filter(f => flikar.includes(f));
        expect(flikar).toEqual(menyn);
        expect(flikar).toEqual(expect.arrayContaining(['matrix', 'likvardighet', 'struktur', 'kon', 'prioritering', 'loneoversyn']));
        for (const f of ['utforska', 'dokumentera', 'rapporttext', 'arbetet', 'info']) expect(flikar).not.toContain(f);
        expect(grupper.every(g => !g.open)).toBe(true);
        expect(d.getElementById('ut-alla-prioritering').querySelector('summary h3').textContent).toBe('Prioritering');
        // En låst flik har ingen grupp: Löneläget låses när referensen tas bort, och gruppen försvinner.
        expect(flikar).toContain('benchmark');
        w.eval('state.policy = []; state.statistik = []; synkaJamforelseFlik(); utAllaDiagramRita();');
        expect(d.querySelector('.nav-item[data-tab="benchmark"]').disabled || d.querySelector('.nav-item[data-tab="benchmark"]').hidden).toBe(true);
        expect([...d.querySelectorAll('#ut-alla-grupper > details')].map(g => g.dataset.utFlik)).not.toContain('benchmark');
    });

    it('öppnad grupp ritar fliken och lägger en kopia per diagram, med källans figur, rubrik och en länk till källan', () => {
        const w = fonster(), d = w.document;
        d.getElementById('ut-flik-alla').click();
        expect(w.eval("_ritadVid.has('prioritering')")).toBe(false);
        const fokus = d.getElementById('ut-flik-alla');
        fokus.focus();
        const g = oppnaGrupp(w, 'prioritering');
        // Användaren står kvar i fliken, och fokus flyttas inte.
        expect(d.querySelector('.nav-item.active').dataset.tab).toBe('utforska');
        expect(d.activeElement).toBe(fokus);
        expect(w.eval("_ritadVid.has('prioritering')")).toBe(true);
        const k = kopior(g);
        const kallor = w.eval("_utKallor('prioritering')");
        expect(k.length).toBe(kallor.length);
        expect(k.length).toBeGreaterThanOrEqual(2);
        expect(k.map(x => x.id)).toEqual(kallor.map(x => 'ut-diagram-' + x.id));
        expect(k.map(x => x.id)).toContain('ut-diagram-chart-prio-matrix');
        expect(g.querySelector('.avsnitt-under').textContent).toBe(`${k.length} diagram`);
        const kopia = d.getElementById('ut-diagram-chart-prio-matrix'), kalla = d.getElementById('chart-prio-matrix');
        expect(kopia._figur).toBe(kalla._figur);
        expect(kopia.querySelectorAll('svg [data-marke="punkt"]').length).toBe(kalla.querySelectorAll('svg [data-marke="punkt"]').length);
        expect(kopia.querySelectorAll('svg [data-marke="punkt"]').length).toBeGreaterThan(0);
        const kort = kopia.closest('.ut-kopia');
        expect(kort.querySelector('.ut-kopia-rubrik').textContent).toBe(w.eval('chartExportTitle')(kalla));
        const lank = kort.querySelector('.ut-kopia-fran a');
        expect(kort.querySelector('.ut-kopia-fran').textContent).toBe('Från fliken Prioritering');
        expect([lank.dataset.goToTab, lank.dataset.goToAnchor]).toEqual(['prioritering', 'chart-prio-matrix']);
        // Egen exportmeny med eget id, och filterrader (prioriteringsmatrisen har BAS, yrkesgrupp, sektor, antal och avvikelse).
        const menyer = [kort, kalla.parentElement].map(x => x.querySelector('.chart-export-meny').id);
        expect(menyer[0]).not.toBe(menyer[1]);
        expect([...kort.querySelectorAll('.diagram-urval')].map(r => r.dataset.urvalFalt)).toEqual(['bas', 'yrke', 'sektor', 'n', 'x']);
        expect(w.eval('chartExportTitle')(kopia)).toBe(w.eval('chartExportTitle')(kalla));
        expect(w.eval("chartExportFilename")(kopia, 'png').startsWith('DEMO_Prioritering_')).toBe(true);
        // Inga id:n i dokumentet förekommer två gånger.
        const ids = [...d.querySelectorAll('[id]')].map(e => e.id);
        expect(ids.length).toBe(new Set(ids).size);
        // Länken leder till källdiagrammet i dess flik.
        lank.click();
        expect(d.querySelector('.nav-item.active').dataset.tab).toBe('prioritering');
    });

    it('kopians filter ändrar inte källan, och källans filter ändrar inte kopian', () => {
        const w = fonster(), d = w.document;
        nav(w, 'prioritering');
        nav(w, 'utforska');
        d.getElementById('ut-flik-alla').click();
        oppnaGrupp(w, 'prioritering');
        const kopia = d.getElementById('ut-diagram-chart-prio-matrix'), kalla = d.getElementById('chart-prio-matrix');
        const rad = kopia.closest('.ut-kopia').querySelector('.diagram-urval[data-urval-falt="bas"]');
        const knapp = rad.querySelector('[data-urval]');
        const bas = knapp.dataset.urval;
        const punkter = el => el.querySelectorAll('svg [data-marke="punkt"]').length;
        const fore = [punkter(kopia), punkter(kalla)];
        knapp.click();
        expect(kopia._figurFilter.kategori.get('bas').has(bas)).toBe(true);
        expect(kalla._figurFilter.kategori.get('bas').size).toBe(0);
        expect(punkter(kopia)).toBeLessThan(fore[0]);
        expect(punkter(kalla)).toBe(fore[1]);
        // Minnet nycklas på kopians id: källan ritas om utan kopians val.
        nav(w, 'prioritering');
        expect(d.getElementById('chart-prio-matrix')._figurFilter.kategori.get('bas').size).toBe(0);
        // Ett filter i källan följer inte med till kopian när gruppen ritas om.
        const kallRad = d.getElementById('chart-prio-matrix').parentElement.querySelector('.diagram-urval[data-urval-falt="bas"]');
        const annan = [...kallRad.querySelectorAll('[data-urval]')].find(b => b.dataset.urval !== bas);
        annan.click();
        nav(w, 'utforska');
        const ny = d.getElementById('ut-diagram-chart-prio-matrix');
        expect([...ny._figurFilter.kategori.get('bas')]).toEqual([bas]);
        expect(ny._figur).toBe(d.getElementById('chart-prio-matrix')._figur);
    });

    it('kopiorna följer inte med i ZIP-filen, och en export ur kopian går genom källan', () => {
        const w = fonster(), d = w.document;
        d.getElementById('ut-flik-alla').click();
        for (const f of ['prioritering', 'matrix', 'likvardighet']) oppnaGrupp(w, f);
        const antal = d.querySelectorAll('#ut-alla-grupper [id^="ut-diagram-"]').length;
        expect(antal).toBeGreaterThan(4);
        const zip = w.eval('zipDiagram().map(el => el.id)');
        expect(zip.length).toBeGreaterThan(4);
        expect(zip.filter(id => id.startsWith('ut-diagram-'))).toEqual([]);
        expect(zip).toContain('chart-prio-matrix');
        // Diagramdatan ur en kopia är källans, rad för rad (samma rubrik, samma stämpel, samma punkter).
        for (const id of ['chart-prio-matrix', 'chart-la-tratt']) {
            const kopia = d.getElementById('ut-diagram-' + id);
            expect(kopia, id).toBeTruthy();
            expect(w.__chartExportRows(kopia), id).toEqual(w.__chartExportRows(d.getElementById(id)));
        }
        // En kopia ur Likvärdigt arbete bär källans undantag i stämpeln.
        const lv = [...d.querySelectorAll('#ut-alla-likvardighet [id^="ut-diagram-"]')];
        expect(lv.length).toBeGreaterThan(0);
        for (const kopia of lv) {
            // Likvärdigt arbete bygger om sina behållare när fliken ritas: källan hämtas med sitt id efter varje export.
            const kalla = () => d.getElementById(kopia.id.slice('ut-diagram-'.length));
            expect(w.eval('_kUndantagFor')(kopia, false)).toBe('Likvärdigt arbete');
            const fran = w.__chartExportRows(kopia);
            expect(fran[0][0]).toContain('(undantag: Likvärdigt arbete)');
            expect(fran).toEqual(w.__chartExportRows(kalla()));
        }
        // Kopiorna står kvar och ritas om på skärmen efter en export ur en kopia, med källans figur på skärmen.
        w.__chartExportRows(d.getElementById('ut-diagram-chart-prio-matrix'));
        expect(d.querySelectorAll('#ut-alla-grupper [id^="ut-diagram-"]').length).toBe(antal);
        expect(w.eval("state.kLage")).toBe('skarm');
        expect(w.eval("flikInaktuell('prioritering')")).toBe(false);
        expect(d.getElementById('ut-diagram-chart-prio-matrix')._figur).toBe(d.getElementById('chart-prio-matrix')._figur);
    });

    it('en ändrad tröskel, ny data och Rensa all data', () => {
        const w = fonster(), d = w.document;
        d.getElementById('ut-flik-alla').click();
        oppnaGrupp(w, 'struktur');
        const fore = kopior(d.getElementById('ut-alla-struktur')).length;
        expect(fore).toBeGreaterThan(2);
        // Tröskeln ändras medan samlingen visas: källfliken är inaktuell, och gruppen ritas om med den.
        w.eval('sattKTroskel(25, { fraga: false })');
        expect(w.eval("flikInaktuell('struktur')")).toBe(false);
        const efter = kopior(d.getElementById('ut-alla-struktur'));
        expect(efter.length).toBeGreaterThan(2);
        for (const k of efter) expect(k._figur).toBe(d.getElementById(k.id.slice('ut-diagram-'.length))._figur);
        // Rensa all data tar bort grupperna och kopiorna.
        w.eval('_rensaAllData()');
        expect(d.getElementById('ut-alla-grupper').children.length).toBe(0);
        expect(w.eval("[..._rfBehallare].filter(el => el.id.startsWith('ut-diagram-')).length")).toBe(0);
    });

    it('ett diagram som är dolt i sin flik får ingen kopia', () => {
        const w = fonster(), d = w.document;
        nav(w, 'prioritering');
        d.getElementById('chart-prio-pareto').hidden = true;
        nav(w, 'utforska');
        d.getElementById('ut-flik-alla').click();
        // Fliken är redan ritad och aktuell: grupperna ritas utan att den ritas om.
        const g = oppnaGrupp(w, 'prioritering');
        expect(kopior(g).map(k => k.id)).not.toContain('ut-diagram-chart-prio-pareto');
        expect(kopior(g).map(k => k.id)).toContain('ut-diagram-chart-prio-matrix');
    });

    it('flikarna utan grupp har inga diagram ritade med diagramkärnan', () => {
        const w = createAppWindow();
        w.__loadDemoData();
        for (const f of ['dashboard', 'filer', 'bestammelser', 'handlingsplan']) w.__renderTabContent(f);
        const iFlik = w.eval("[..._rfBehallare].filter(el => el.isConnected && ['dashboard', 'filer', 'bestammelser', 'handlingsplan'].includes(_egFlikFor(el))).map(el => el.id)");
        expect(iFlik).toEqual([]);
    });
});

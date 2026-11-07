/**
 * Funktionssök (86-sok-register.js, 87-sok.js): sökfältet i sidhuvudet hittar också flikarnas avsnitt, dialogerna
 * och fälten i Inställningar, med synonymer, och syns utan lönefil. Vaktar att registret täcker varje avsnitt och
 * bara pekar på sådant som finns, att ett val leder rätt, att en låst flik säger "kräver lönefil" i stället för att
 * navigera dit, och att tangentbordet når båda grupperna i träfflistan.
 */
import { describe, it, expect } from 'vitest';
import { createAppWindow } from './helpers/app-harness.js';

const skriv = (w, t) => { const f = w.document.getElementById('sok-grupp'); f.value = t; f.dispatchEvent(new w.Event('input', { bubbles: true })); };
const tangent = (w, key) => w.document.getElementById('sok-grupp').dispatchEvent(new w.KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
const aktivFlik = w => w.document.querySelector('.nav-item.active').dataset.tab;

// Avsnitten som flikarna bygger när de ritas (de finns inte i index.html): Att göra på Översikt, Likvärdigt arbete
// och Löneläget mot ställningstagandet. Varje id här har en post i registret och finns i sidan när fliken är ritad med demodata.
const DYNAMISKA = ['avsnitt-ov-punkter',
    'avsnitt-lv-par', 'avsnitt-lv-underlag', 'avsnitt-lv-installningar', 'avsnitt-lv-analys',
    'avsnitt-lp-tabell', 'avsnitt-lp-kon', 'avsnitt-lp-efterlevnad', 'avsnitt-lp-tackning'];

describe('Funktionssök', () => {
    it('de dynamiska avsnitten har en post var och finns i sin flik när den ritats med demodata', () => {
        const w = createAppWindow(), d = w.document, reg = w.eval('SOK_FUNKTIONER');
        for (const id of DYNAMISKA) expect(d.getElementById(id), `${id} finns inte i index.html`).toBeNull();
        w.__loadDemoData();
        for (const flik of ['dashboard', 'likvardighet', 'benchmark']) w.__renderTabContent(flik);
        // Varje avsnitt som flikarna byggt (details.avsnitt med id) är antingen i index.html eller i listan ovan.
        const html = new Set([...createAppWindow().document.querySelectorAll('details.avsnitt[id]')].map(x => x.id));
        const byggda = [...d.querySelectorAll('details.avsnitt[id]')].map(x => x.id).filter(id => !html.has(id) && !/^avsnitt-[a-z]+-\d+$/.test(id));
        expect(byggda.sort()).toEqual([...DYNAMISKA].sort());
        for (const id of DYNAMISKA) {
            const p = reg.find(x => x.avsnitt === id);
            expect(p, id).toBeTruthy();
            expect(p.synonymer.length, id).toBeGreaterThan(0);
            expect(d.getElementById(id), id).toBeTruthy();
            expect(w.eval('_egFlikFor')(d.getElementById(id)), id).toBe(p.flik);
        }
    });

    it('ett dynamiskt avsnitt går att välja: utan lönefil kräver det lönefil, med lönefil fälls det ut i sin flik', () => {
        const w = createAppWindow(), d = w.document;
        skriv(w, 'alla punkter');
        const li = d.querySelector('#sok-grupp-lista [data-sok-funktion]');
        expect(li.querySelector('.sok-namn').textContent).toBe('Att göra: alla punkter');
        expect(li.textContent).toContain('kräver lönefil');
        w.__loadDemoData();
        skriv(w, 'kvinnotröskel');
        const lv = [...d.querySelectorAll('#sok-grupp-lista [data-sok-funktion]')].find(x => /Likvärdigt arbete/.test(x.querySelector('.sok-namn').textContent));
        expect(lv.textContent).not.toContain('kräver lönefil');
        lv.click();
        expect(aktivFlik(w)).toBe('likvardighet');
        expect(d.getElementById('avsnitt-lv-installningar').open).toBe(true);
        skriv(w, 'täckningsgrad');
        d.querySelector('#sok-grupp-lista [data-sok-funktion]').click();
        expect(aktivFlik(w)).toBe('benchmark');
        expect(d.getElementById('avsnitt-lp-tackning').open).toBe(true);
    });

    it('registret täcker varje avsnitt i index.html, och varje post pekar på något som finns', () => {
        const w = createAppWindow(), d = w.document, reg = w.eval('SOK_FUNKTIONER');
        const avsnitt = [...d.querySelectorAll('details.avsnitt[id]')].map(x => x.id);
        expect(avsnitt.length).toBeGreaterThan(40);
        for (const id of avsnitt) expect(reg.some(p => p.avsnitt === id), id).toBe(true);
        for (const p of reg) {
            expect(d.querySelector(`.nav-item[data-tab="${p.flik}"]`), p.namn).toBeTruthy();
            if (p.avsnitt && !DYNAMISKA.includes(p.avsnitt)) expect(d.getElementById(p.avsnitt), p.namn).toBeTruthy();
            if (p.falt) expect(d.getElementById(p.falt), p.namn).toBeTruthy();
            if (p.dialog) expect(['installningar', 'ordlista', 'symboler', 'lagras', 'basdossier'], p.namn).toContain(p.dialog);
            expect(!!p.avsnitt !== !!p.dialog, `${p.namn}: antingen ett avsnitt eller en dialog`).toBe(true);
        }
        // Avsnittet står i den flik som visar det.
        for (const p of reg.filter(x => x.avsnitt && !DYNAMISKA.includes(x.avsnitt))) expect(w.eval('_egFlikFor')(d.getElementById(p.avsnitt)), p.namn).toBe(p.flik);
        // Dialogerna och fälten i briefen finns med.
        for (const dlg of ['installningar', 'ordlista', 'symboler', 'lagras']) expect(reg.some(p => p.dialog === dlg && !p.falt), dlg).toBe(true);
        for (const f of ['k-troskel', 'org-typ', 'lonemanad', 'prio-cost-months', 'prio-po-pct', 'prio-cfg-atgard', 'lage-kompakt', 'btn-clear-all-data']) {
            expect(reg.some(p => p.falt === f && p.dialog === 'installningar'), f).toBe(true);
        }
    });

    it('sökfältet syns utan lönefil, och utan lönefil visas bara funktioner', () => {
        const w = createAppWindow(), d = w.document, lista = d.getElementById('sok-grupp-lista');
        expect(d.getElementById('sok-ruta').hidden).toBe(false);
        skriv(w, 'bas');
        expect(lista.hidden).toBe(false);
        expect(lista.querySelectorAll('[role="option"]:not([data-sok-funktion])')).toHaveLength(0);
        expect(lista.querySelectorAll('[data-sok-funktion]').length).toBeGreaterThan(0);
        expect(lista.querySelector('.sok-grupprubrik').getAttribute('role')).toBe('presentation');
        expect(lista.querySelector('.sok-grupprubrik').textContent).toBe('Funktioner');
        expect(lista.querySelector('.sok-grupprubrik').closest('li').getAttribute('role')).toBe('group');
        skriv(w, 'finnsintealls');
        expect(lista.querySelectorAll('[role="option"]')).toHaveLength(0);
        expect(lista.textContent).toBe('Ingen funktion matchar.');
    });

    it('"ögonblicksbild" leder till Spara och jämför år med avsnittet utfällt', () => {
        const w = createAppWindow(), d = w.document;
        expect(d.getElementById('avsnitt-ar-ogonblick').open).toBe(false);
        skriv(w, 'ögonblicksbild');
        d.querySelector('#sok-grupp-lista [data-sok-funktion]').click();
        expect(aktivFlik(w)).toBe('arbetet');
        expect(d.getElementById('avsnitt-ar-ogonblick').open).toBe(true);
        expect(d.activeElement).toBe(d.querySelector('#avsnitt-ar-ogonblick > summary'));
        expect(d.getElementById('sok-grupp').value).toBe('');
        expect(d.getElementById('sok-grupp-lista').hidden).toBe(true);
    });

    it('"PO-påslag" öppnar Inställningar med fokus i fältet', () => {
        const w = createAppWindow(), d = w.document;
        skriv(w, 'PO-påslag');
        const li = d.querySelector('#sok-grupp-lista [data-sok-funktion]');
        expect(li.querySelector('.sok-namn').textContent).toBe('PO-påslag');
        li.click();
        expect(d.getElementById('installningar-modal').style.display).toBe('flex');
        expect(d.activeElement.id).toBe('prio-po-pct');
    });

    it('ordlistan, symbolförklaringen och "Vad lagras?" öppnas från sökningen', () => {
        const w = createAppWindow(), d = w.document;
        const valjForsta = t => { skriv(w, t); d.querySelector('#sok-grupp-lista [data-sok-funktion]').click(); };
        valjForsta('ordlista');
        expect(d.getElementById('glossary-modal').style.display).toBe('flex');
        w.eval('closeGlossary()');
        valjForsta('symboler');
        expect(d.getElementById('symbols-modal').style.display).toBe('flex');
        valjForsta('vad lagras');
        expect(d.getElementById('data-residency-modal').style.display).toBe('flex');
    });

    it('en funktion i en låst flik säger kräver lönefil och leder till Filer och kvalitet', () => {
        const w = createAppWindow(), d = w.document;
        skriv(w, 'regression');
        const li = d.querySelector('#sok-grupp-lista [data-sok-funktion]');
        expect(li.textContent).toContain('kräver lönefil');
        li.click();
        expect(aktivFlik(w)).toBe('filer');
        expect(d.getElementById('avsnitt-ls-regression').open).toBe(false);
        // Med lönefilen inläst är fliken öppen: samma val leder till avsnittet.
        w.__loadDemoData();
        skriv(w, 'regression');
        const efter = d.querySelector('#sok-grupp-lista [data-sok-funktion]');
        expect(efter.textContent).not.toContain('kräver lönefil');
        efter.click();
        expect(aktivFlik(w)).toBe('struktur');
        expect(d.getElementById('avsnitt-ls-regression').open).toBe(true);
    });

    it('en funktion som bara syns med lönefil säger kräver lönefil fast fliken är öppen', () => {
        const w = createAppWindow(), d = w.document;
        skriv(w, 'excel');
        const li = [...d.querySelectorAll('#sok-grupp-lista [data-sok-funktion]')].find(x => /Excel/.test(x.querySelector('.sok-namn').textContent));
        expect(li.textContent).toContain('kräver lönefil');
        li.click();
        expect(aktivFlik(w)).toBe('filer');
    });

    it('med lönefil men utan referens säger Löneläget kräver referens och leder till referenskortet', () => {
        const w = createAppWindow(), d = w.document;
        w.__loadDemoData();
        w.__state.policy = []; w.__state.statistik = [];
        w.eval('synkaJamforelseFlik()');
        expect(d.getElementById('tab-benchmark').hidden).toBe(true);
        w.eval('window.__sagt = []; { const o = announceToScreenReader; window.announceToScreenReader = m => { window.__sagt.push(m); return o(m); }; }');
        skriv(w, 'ställningstagandet');
        const li = d.querySelector('#sok-grupp-lista [data-sok-funktion]');
        expect(li.querySelector('.sok-under').textContent).toContain('kräver referens eller jämförelsestatistik');
        expect(li.textContent).not.toContain('kräver lönefil');
        li.click();
        expect(aktivFlik(w)).toBe('filer');
        expect(d.activeElement.id).toBe('file-input-policy');
        expect(w.__sagt.at(-1)).toMatch(/referens eller jämförelsestatistik/);
    });

    it('Underlagets kvalitet är dold utan lönefil och säger då kräver lönefil', () => {
        const w = createAppWindow(), d = w.document;
        expect(d.getElementById('avsnitt-ov-kvalitet').hidden).toBe(true);
        skriv(w, 'underlagets kvalitet');
        const li = [...d.querySelectorAll('#sok-grupp-lista [data-sok-funktion]')].find(x => x.querySelector('.sok-namn').textContent === 'Underlagets kvalitet');
        expect(li.textContent).toContain('kräver lönefil');
        w.__loadDemoData();
        expect(d.getElementById('avsnitt-ov-kvalitet').hidden).toBe(false);
        w.eval('_rensaAllData()');
        expect(d.getElementById('avsnitt-ov-kvalitet').hidden).toBe(true);
    });

    it('med lönefil leder ett mål som är dolt av annan orsak till flikens topp och säger det, utan att fokusera det dolda', () => {
        const w = createAppWindow(), d = w.document;
        w.__loadDemoData();
        w.eval('window.__sagt = []; { const o = announceToScreenReader; window.announceToScreenReader = m => { window.__sagt.push(m); return o(m); }; }');
        // Avsnittet döljs när fliken ritas, som ett avsnitt som inte gäller underlaget.
        w.eval(`{ const o = renderTabContent; window.renderTabContent = (...a) => { const r = o(...a); document.getElementById('avsnitt-ar-ogonblick').hidden = true; return r; }; }`);
        skriv(w, 'ögonblicksbild');
        d.querySelector('#sok-grupp-lista [data-sok-funktion]').click();
        expect(aktivFlik(w)).toBe('arbetet');
        expect(d.getElementById('avsnitt-ar-ogonblick').open).toBe(false);
        expect(d.activeElement).toBe(d.getElementById('main-content'));
        expect(w.__sagt.at(-1)).toMatch(/visas inte/);
    });

    it('synonymer: "snapshot", "protokoll", "EU", "personalomkostnad" ger träff', () => {
        const w = createAppWindow();
        const traff = t => w.eval(`sokFunktionsTraffar(${JSON.stringify(t)})`);
        for (const t of ['snapshot', 'protokoll', 'EU', 'personalomkostnad', 'förra året', 'jpa', '2023/970', 'oaxaca', 'fjärdedel', 'outliers', 'json', 'testdata', 'docx', 'pdf', 'zip', 'ta bort data', 'tio personer']) {
            expect(traff(t).length, t).toBeGreaterThan(0);
        }
        expect(traff('snapshot')[0].avsnitt).toBe('avsnitt-ar-ogonblick');
        expect(traff('personalomkostnad')[0].falt).toBe('prio-po-pct');
        expect(traff('anonymitet')[0].falt).toBe('k-troskel');
        expect(traff('a').length).toBeLessThanOrEqual(5);
        expect(traff('')).toEqual([]);
    });

    it('med lönefil: grupperna först, funktionerna efter, och tangentbordet går genom båda', () => {
        const w = createAppWindow(), d = w.document, falt = d.getElementById('sok-grupp'), lista = d.getElementById('sok-grupp-lista');
        w.__loadDemoData();
        skriv(w, 'bas');
        const opts = [...lista.querySelectorAll('[role="option"]')];
        const forstaFunktion = opts.findIndex(li => li.hasAttribute('data-sok-funktion'));
        expect(forstaFunktion).toBeGreaterThan(0);
        expect(opts.slice(forstaFunktion).every(li => li.hasAttribute('data-sok-funktion'))).toBe(true);
        expect(opts.map(li => li.id)).toEqual(opts.map((_, i) => `sok-traff-${i}`));
        // Rubrikerna är inte alternativ.
        const rubriker = [...lista.querySelectorAll('.sok-grupprubrik')];
        expect(rubriker.map(r => r.textContent)).toEqual(['Grupper', 'Funktioner']);
        expect(rubriker.every(r => r.getAttribute('role') === 'presentation')).toBe(true);
        // ARIA-mönstret för grupper i en listbox: li[role=group] märkt med sin rubrik, alternativen i en inre lista.
        const grupper = [...lista.querySelectorAll(':scope > li[role="group"]')];
        expect(grupper).toHaveLength(2);
        expect([...lista.children].every(li => li.getAttribute('role') === 'group')).toBe(true);
        grupper.forEach((g, i) => {
            const rubrik = d.getElementById(g.getAttribute('aria-labelledby'));
            expect(rubrik).toBe(rubriker[i]);
            expect(rubrik.tagName).toBe('SPAN');
            expect(rubrik.parentElement).toBe(g);
            const inre = g.querySelector(':scope > ul');
            expect(inre.getAttribute('role')).toBe('presentation');
            expect([...inre.children].every(li => li.getAttribute('role') === 'option')).toBe(true);
        });
        expect(grupper[0].querySelectorAll('[role="option"]:not([data-sok-funktion])').length).toBe(forstaFunktion);
        expect(grupper[1].querySelector('[role="option"]')).toBe(opts[forstaFunktion]);
        // Pil upp från första träffen går runt till sista funktionen; pil ned därifrån tillbaka till första gruppen.
        tangent(w, 'ArrowUp');
        expect(falt.getAttribute('aria-activedescendant')).toBe(opts.at(-1).id);
        expect(opts.at(-1).getAttribute('aria-selected')).toBe('true');
        tangent(w, 'ArrowDown');
        expect(falt.getAttribute('aria-activedescendant')).toBe(opts[0].id);
        // Ned till första funktionen och Retur: den leder dit, och ingen grupp markeras.
        for (let i = 0; i < forstaFunktion; i++) tangent(w, 'ArrowDown');
        expect(falt.getAttribute('aria-activedescendant')).toBe(opts[forstaFunktion].id);
        const mal = w.eval('_sokTraffar')[forstaFunktion];
        tangent(w, 'Enter');
        expect(w.eval('diagramMarkering()')).toBeNull();
        expect(aktivFlik(w)).toBe(mal.flik);
        expect(d.getElementById(mal.avsnitt).open).toBe(true);
        // Escape stänger listan.
        skriv(w, 'bas');
        tangent(w, 'Escape');
        expect(lista.hidden).toBe(true);
    });
});

describe('ordlistans sökning: de gamla orden hittar rätt post (fältet sok)', () => {
    const termer = (w, t) => { w.eval(`renderGlossary(${JSON.stringify(t)})`);
        return [...w.document.querySelectorAll('#glossary-content .glossary-term')].map(e => e.textContent); };
    it('"lönegap" hittar kvoten och de tre sorternas löneskillnad, fast ordet inte står i posterna', () => {
        const w = createAppWindow();
        const traffar = termer(w, 'lönegap');
        expect(traffar).toContain('Kvinnors lön i procent av mäns');
        expect(traffar).toContain('Rå (ojusterad) löneskillnad');
        expect(traffar).toContain('Oförklarad löneskillnad');
        expect(w.document.getElementById('glossary-content').textContent).not.toMatch(/[Ll]önegap/);
    });
    it('"rågap" hittar den råa löneskillnaden', () => {
        expect(termer(createAppWindow(), 'rågap')).toContain('Rå (ojusterad) löneskillnad');
    });
});

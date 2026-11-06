/**
 * Sidindexet ("På den här sidan", 89-sidindex.js): flikens synliga avsnitt som en lista som följer med.
 * Vaktar att listan bara tar med avsnitt som syns, att den byggs om när fliken ritas om och att ett klick leder
 * till avsnittet.
 */
import { describe, it, expect } from 'vitest';
import { createAppWindow } from './helpers/app-harness.js';

const poster = w => [...w.document.querySelectorAll('#sidindex a')].map(a => a.textContent.trim());
const oppna = (w, flik) => w.document.querySelector(`.nav-item[data-tab="${flik}"]`).click();

describe('Sidindex', () => {
    it('indexet listar Lönestrukturs synliga avsnitt i ordning och hoppar över dolda', () => {
        const w = createAppWindow(); w.__loadDemoData();
        oppna(w, 'struktur');
        const lista = poster(w);
        expect(lista[0]).toBe('Organisationen som karta');
        expect(lista).toContain('EU 2023/970 — lönerapportmått');
        // Alla tre panelerna i fliken, i sidans ordning.
        expect(lista.indexOf('Representation per BAS-nivå')).toBeLessThan(lista.indexOf('Lönegap per BAS-intervall'));
        expect(lista.indexOf('Lönegap per BAS-intervall')).toBeLessThan(lista.indexOf('Vad blir kvar av lönegapet?'));
        // Ett avsnitt som döljs är borta när fliken ritas om.
        expect(lista).toContain('Var uppstår löneskillnaden?');
        w.document.getElementById('avsnitt-ov-gap').hidden = true;
        w.__renderTabContent('struktur');
        expect(poster(w)).not.toContain('Var uppstår löneskillnaden?');
        expect(poster(w).length).toBe(lista.length - 1);
        // Den dolda rubriken i kortet under avsnittet (samma text, hidden) räknas aldrig.
        expect(new Set(poster(w)).size).toBe(poster(w).length);
    });
    it('rubriker utan id får ett på sitt avsnitt eller kort, och länken pekar dit', () => {
        const w = createAppWindow(); w.__loadDemoData();
        oppna(w, 'struktur');
        const a = [...w.document.querySelectorAll('#sidindex a')].find(x => x.textContent.trim() === 'Organisationen som karta');
        const mal = w.document.getElementById(a.dataset.sidindex);
        expect(a.dataset.sidindex).toMatch(/^avsnitt-struktur-\d+$/);
        expect(mal.classList.contains('card')).toBe(true);
        expect(mal.querySelector('.card-header > h2').textContent).toBe('Organisationen som karta');
        // Ombyggt index behåller id:t.
        w.__renderTabContent('struktur');
        expect(w.document.querySelector(`#sidindex a[data-sidindex="${a.dataset.sidindex}"]`)).toBeTruthy();
    });
    it('ett klick fäller ut avsnittet och ger summaryn fokus', () => {
        const w = createAppWindow(); w.__loadDemoData();
        oppna(w, 'struktur');
        expect(w.document.getElementById('avsnitt-st-eu').open).toBe(false);
        const a = w.document.querySelector('#sidindex a[data-sidindex="avsnitt-st-eu"]'); a.click();
        expect(w.document.getElementById('avsnitt-st-eu').open).toBe(true);
        expect(w.document.activeElement).toBe(w.document.querySelector('#avsnitt-st-eu > summary'));
        expect(a.classList.contains('ar-aktiv')).toBe(true);
        expect(w.location.hash).toBe('');
    });
    it('ett klick på ett kort ger rubriken fokus utan att ta den ur tabbordningen för andra', () => {
        const w = createAppWindow(); w.__loadDemoData();
        oppna(w, 'struktur');
        const a = [...w.document.querySelectorAll('#sidindex a')].find(x => x.textContent.trim() === 'Organisationen som karta');
        a.click();
        const h = w.document.getElementById(a.dataset.sidindex).querySelector('.card-header > h2');
        expect(w.document.activeElement).toBe(h);
        expect(h.getAttribute('tabindex')).toBe('-1');
        // Summaryn får aldrig tabindex="-1": den ska gå att nå med Tabb.
        w.document.querySelector('#sidindex a[data-sidindex="avsnitt-st-eu"]').click();
        expect(w.document.querySelector('#avsnitt-st-eu > summary').hasAttribute('tabindex')).toBe(false);
    });
    it('utan IntersectionObserver är första posten aktiv', () => {
        const w = createAppWindow(); w.__loadDemoData();
        oppna(w, 'matrix');
        const aktiva = [...w.document.querySelectorAll('#sidindex a.ar-aktiv')];
        expect(aktiva.length).toBe(1);
        expect(aktiva[0]).toBe(w.document.querySelector('#sidindex a'));
    });
    it('raden säger vilket avsnitt läsaren är i: först det första, sedan det som markeras', () => {
        const w = createAppWindow(); w.__loadDemoData();
        oppna(w, 'struktur');
        const summary = () => w.document.querySelector('#sidindex summary').textContent.replace(/\s+/g, ' ').trim();
        expect(summary()).toBe('På den här sidan: Organisationen som karta');
        w.eval('_sidindexMarkera("avsnitt-st-eu")');
        expect(summary()).toBe('På den här sidan: EU 2023/970 — lönerapportmått');
        expect(w.document.querySelector('#sidindex a.ar-aktiv').dataset.sidindex).toBe('avsnitt-st-eu');
        // Ett klick på smal skärm fäller ihop listan, så att den inte täcker avsnittet den ledde till.
        w.document.querySelector('#sidindex details').open = true;
        w.document.querySelector('#sidindex a[data-sidindex="avsnitt-st-sektorer"]').click();
        expect(summary()).toBe('På den här sidan: Per sektor');
        expect(w.document.querySelector('#sidindex details').open).toBe(false);
    });
    it('indexet byggs om när fliken ritas om, och döljs på flikar med färre än tre avsnitt', () => {
        const w = createAppWindow(), nav = w.document.getElementById('sidindex'), kropp = w.document.querySelector('.content-body');
        expect(nav.getAttribute('aria-label')).toBe('På den här sidan');
        expect(nav.parentElement).toBe(kropp);
        oppna(w, 'info');
        expect(nav.hidden).toBe(true);
        expect(kropp.classList.contains('har-sidindex')).toBe(false);
        oppna(w, 'dashboard');
        expect(nav.hidden).toBe(true);
        oppna(w, 'bestammelser');
        expect(nav.hidden).toBe(false);
        expect(kropp.classList.contains('har-sidindex')).toBe(true);
        expect(poster(w).length).toBeGreaterThanOrEqual(3);
        w.__loadDemoData();
        oppna(w, 'matrix');
        expect(nav.hidden).toBe(false);
        expect(poster(w)).toContain('Personer att granska');
        expect(poster(w)).not.toContain('Checklista — bestämmelser & praxis att granska');
        oppna(w, 'info');
        expect(nav.hidden).toBe(true);
        expect(kropp.classList.contains('har-sidindex')).toBe(false);
    });
    it('Exportera listar kortet med exporterna först när det finns ett underlag att exportera', () => {
        const w = createAppWindow();
        oppna(w, 'dokumentera');
        expect(poster(w)).not.toContain('Exportera — vilket underlag behöver du?');
        w.__loadDemoData();
        oppna(w, 'dokumentera');
        expect(poster(w)).toContain('Exportera — vilket underlag behöver du?');
    });
    it('en annan flik som ritas (för en bild) flyttar inte den synliga flikens index', () => {
        const w = createAppWindow(); w.__loadDemoData();
        oppna(w, 'matrix');
        const fore = poster(w);
        w.__renderTabContent('struktur');
        expect(poster(w)).toEqual(fore);
    });
    it('indexet lägger inga avsnitt till sidan och ser likadant ut i kompakt läge', () => {
        const w = createAppWindow(); w.__loadDemoData();
        oppna(w, 'struktur');
        const fore = poster(w);
        expect(w.document.querySelectorAll('#sidindex details.avsnitt, #sidindex h2, #sidindex h3').length).toBe(0);
        w.document.body.classList.add('lage-kompakt');
        w.__renderTabContent('struktur');
        expect(poster(w)).toEqual(fore);
    });
});

// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
// Växeln "Fler kolumner" (05-tabeller-och-lankar.js) i de breda tabellerna: grundvyn gömmer de sekundära
// kolumnerna med hidden på rubrik och celler, full vy visar alla, statusen står nära namnet, exporterna tar alltid
// med alla kolumner, och sorteringen och underradernas colspan fungerar i båda vyerna.
import { describe, it, expect, vi } from 'vitest';
import { createAppWindow } from './helpers/app-harness.js';
import { las } from './helpers/granssnitt-rigg.js';

vi.setConfig({ testTimeout: 30000 });

const TABELLER = [
    { flik: 'prioritering', id: 'prio-table', nyckel: 'prio', dolda: ['kvma', 'median', 'referens', 'avvikelsekr', 'kostnadpers', 'brist'],
        forst: ['prio', 'yrke', 'bas', 'status'] },
    { flik: 'matrix', id: 'matrix-table', nyckel: 'likaYrke', dolda: ['dominans', 'nationellt'], forst: ['yrke', 'status'] },
    { flik: 'likvardighet', id: 'likvardighet-table', nyckel: 'likvardighet', dolda: ['median', 'medianjamf', 'gapkr', 'justerad', 'paverkan'],
        forst: ['nr', 'yrke'] },
    { flik: 'struktur', id: 'la-oversikt', nyckel: 'laOversikt', dolda: ['direktiv'], forst: [] }
];
const rita = (flik) => { const w = createAppWindow(); w.__loadDemoData(); w.__renderTabContent(flik); return w; };
const rubriker = (w, id) => [...w.document.querySelectorAll(`#${id} thead th`)];
const knapp = (w, id) => w.document.querySelector(`[data-fler-kolumner="${id}"]`);
const spann = td => +(td.getAttribute('colspan')) || 1;
const helSpann = td => +(td.getAttribute('data-hel-colspan') || td.getAttribute('colspan')) || 1;

describe('Fler kolumner: grundvyn och full vy', () => {
    for (const t of TABELLER) {
        it(`${t.id}: grundvyn gömmer ${t.dolda.join(', ')} med hidden på rubriken och varje cell; växeln visar alla`, () => {
            const w = rita(t.flik);
            const ths = rubriker(w, t.id);
            expect(ths.length).toBeGreaterThan(t.dolda.length);
            const b = knapp(w, t.id);
            expect(b).toBeTruthy();
            expect(b.textContent).toBe('Fler kolumner');
            expect(b.getAttribute('aria-pressed')).toBe('false');
            expect(b.getAttribute('aria-controls')).toBe(t.id);
            // Knappen står i tabellens verktygsrad, bredvid Kopiera och CSV.
            expect(b.parentElement.querySelector(`[data-copy-table="${t.id}"]`)).toBeTruthy();
            expect(b.parentElement.querySelector(`[data-csv-table="${t.id}"]`)).toBeTruthy();
            const gomda = ths.filter(th => th.hidden).map(th => th.getAttribute('data-kol'));
            expect(gomda.sort()).toEqual([...t.dolda].sort());
            // Varje cell i en gömd kolumn är gömd; raderna har kvar alla sina celler.
            const index = ths.map((th, i) => (th.hidden ? i : -1)).filter(i => i >= 0);
            const rader = [...w.document.querySelectorAll(`#${t.id} tbody tr`)].filter(tr => tr.children.length === ths.length);
            expect(rader.length).toBeGreaterThan(1);
            for (const tr of rader) for (const i of index) expect(tr.children[i].hidden).toBe(true);
            b.click();
            expect(b.getAttribute('aria-pressed')).toBe('true');
            expect(w.__state.flerKolumner[t.nyckel]).toBe(true);
            expect(rubriker(w, t.id).some(th => th.hidden)).toBe(false);
            expect(w.document.querySelectorAll(`#${t.id} [hidden][data-fler-dold], #${t.id} [data-hel-colspan]`)).toHaveLength(0);
            b.click();
            expect(b.getAttribute('aria-pressed')).toBe('false');
            expect(rubriker(w, t.id).filter(th => th.hidden)).toHaveLength(t.dolda.length);
        });
        it(`${t.id}: statusen står nära namnet, och valet står kvar när tabellen ritas om`, () => {
            const w = rita(t.flik);
            expect(rubriker(w, t.id).slice(0, t.forst.length).map(th => th.getAttribute('data-kol'))).toEqual(t.forst);
            knapp(w, t.id).click();
            w.__renderTabContent(t.flik);
            expect(knapp(w, t.id).getAttribute('aria-pressed')).toBe('true');
            expect(rubriker(w, t.id).some(th => th.hidden)).toBe(false);
        });
        it(`${t.id}: kopian och CSV-underlaget har alla kolumner i båda vyerna`, async () => {
            const w = rita(t.flik);
            const alla = rubriker(w, t.id).length;
            const grund = w.__tableToMatrix(t.id);
            knapp(w, t.id).click();
            const full = w.__tableToMatrix(t.id);
            expect(grund).toEqual(full);
            const huvud = grund.findIndex(r => r.length > 1);
            for (const rad of grund.slice(huvud)) expect(rad.length).toBe(grund[huvud].length);
            // Detalj- och Bevis-kolumnen utan export räknas bort; resten följer med.
            expect(grund[huvud].length).toBeGreaterThanOrEqual(alla - 1);
            // Kopiera-knappen i grundvyn: urklippet bär de gömda kolumnernas rubriker.
            knapp(w, t.id).click();
            let kopia = '';
            Object.defineProperty(w.navigator, 'clipboard', { configurable: true, value: { writeText: s => { kopia = s; return Promise.resolve(); } } });
            w.document.querySelector(`[data-copy-table="${t.id}"]`).click();
            await new Promise(r => setTimeout(r, 0));
            const dolda = rubriker(w, t.id).filter(th => th.hidden).map(th => w.eval('_tableCellText')(th));
            expect(dolda.length).toBe(t.dolda.length);
            for (const r of dolda) expect(kopia).toContain(r);
            // Arbetsbokens kopia: inga gömda celler och hela colspan.
            const klon = w.__cloneTable(t.id);
            expect(klon.querySelectorAll('[hidden], [data-fler-dold], [data-hel-colspan]')).toHaveLength(0);
            expect(rubriker(w, t.id).filter(th => th.hidden)).toHaveLength(t.dolda.length);   // skärmens tabell är orörd
        });
    }
});

describe('Fler kolumner: sortering och underrader', () => {
    it('sorteringen fungerar i grundvyn, och de gömda cellerna följer sin rad', () => {
        const w = rita('prioritering');
        const ths = rubriker(w, 'prio-table');
        const iAntal = ths.findIndex(th => th.getAttribute('data-kol') === 'antal');
        const iKvMa = ths.findIndex(th => th.getAttribute('data-kol') === 'kvma');
        const rader = () => [...w.document.querySelectorAll('#prio-table tbody tr')];
        const fore = new Map(rader().map(tr => [tr.children[1].textContent.trim() + tr.children[2].textContent, tr.children[iKvMa].textContent]));
        ths[iAntal].click();
        const antal = rader().map(tr => +tr.children[iAntal].textContent);
        expect(antal).toEqual([...antal].sort((a, b) => a - b));
        for (const tr of rader()) {
            expect(tr.children[iKvMa].hidden).toBe(true);
            expect(tr.children[iKvMa].textContent).toBe(fore.get(tr.children[1].textContent.trim() + tr.children[2].textContent));
        }
        // Kv/Mä summerar till Antal på varje rad efter sorteringen.
        for (const tr of rader()) {
            const [kv, ma] = tr.children[iKvMa].textContent.split('/').map(Number);
            expect(kv + ma).toBe(+tr.children[iAntal].textContent);
        }
        knapp(w, 'prio-table').click();
        expect(rader().map(tr => +tr.children[iAntal].textContent)).toEqual(antal);
        expect(rader().every(tr => !tr.children[iKvMa].hidden)).toBe(true);
    });
    it('en rad som spänner över hela tabellen följer kolumnerna som syns (förslagsraden i Prioritering)', () => {
        const w = rita('prioritering');
        const synliga = () => rubriker(w, 'prio-table').filter(th => !th.hidden).length;
        w.document.querySelector('#prio-table .btn-suggest').click();
        const td = w.document.querySelector('#prio-table tr.suggest-row td');
        expect(spann(td)).toBe(synliga());
        expect(helSpann(td)).toBe(rubriker(w, 'prio-table').length);
        knapp(w, 'prio-table').click();
        expect(spann(td)).toBe(rubriker(w, 'prio-table').length);
        expect(td.hasAttribute('data-hel-colspan')).toBe(false);
    });
    it('Lika arbete: underraderna täcker de synliga kolumnerna i båda vyerna och följer sitt yrke vid sortering', () => {
        const w = rita('matrix');
        const kontroll = () => {
            const synliga = rubriker(w, 'matrix-table').filter(th => !th.hidden).length;
            const under = [...w.document.querySelectorAll('#matrix-table tbody tr')].filter(tr => tr.children.length < rubriker(w, 'matrix-table').length);
            expect(under.length).toBeGreaterThan(0);
            for (const tr of under) expect([...tr.children].filter(td => !td.hidden).reduce((s, td) => s + spann(td), 0)).toBe(synliga);
        };
        kontroll();
        rubriker(w, 'matrix-table')[1].click();   // Status
        const rader = [...w.document.querySelectorAll('#matrix-table tbody tr')];
        rader.forEach((tr, i) => { if (tr.classList.contains('la-underrad')) expect(rader[i - 1].classList.contains('la-underrad') || !!rader[i - 1]._euRow).toBe(true); });
        knapp(w, 'matrix-table').click();
        kontroll();
    });
});

describe('Fler kolumner: de gömda talen finns i beviset', () => {
    it('Prioritering: beviset har Kv/Mä, median, referens, avvikelsen i kronor, kostnaden per person och bristyrket', () => {
        const w = rita('prioritering');
        const it0 = w.document.querySelector('#prio-table tbody tr')._prioItem;
        const b = w.eval('_evidenceForPrioItem')(it0, 'stallningstagande');
        const etiketter = b.rows.map(r => r.label);
        for (const e of ['Antal anställda i gruppen', 'Median månadslön', 'Avvikelse', 'Kostnad per person', 'Bristyrke-multiplikator']) expect(etiketter).toContain(e);
        expect(etiketter.some(e => /^Referens/.test(e))).toBe(true);
        expect(b.rows.find(r => r.label === 'Antal anställda i gruppen').note).toMatch(/kvinnor · \d+ män/);
    });
    it('Lika arbete: beviset har dominansen och andelen kvinnor nationellt, också för yrken med samlad median', () => {
        const w = rita('matrix');
        const rader = [...w.document.querySelectorAll('#matrix-table tbody tr')].filter(tr => tr._euRow);
        expect(rader.every(tr => tr.querySelector('.btn-evidence[data-eu-row]'))).toBe(true);
        for (const tr of rader) {
            const b = w.eval('_evidenceForEUMatrixRow')(tr._euRow);
            const etiketter = b.rows.map(r => r.label);
            expect(etiketter).toContain('Könsdominans');
            expect(etiketter).toContain('Andel kvinnor nationellt');
            if (tr._euRow.samladMedian) expect(etiketter).toContain('Gruppens median');
        }
    });
});

describe('Fler kolumner: inget lagras', () => {
    it('valet ligger i state, och koden skriver inte till webbläsarens lagring', () => {
        const kod = las('src/app/05-tabeller-och-lankar.js');
        const del = kod.slice(kod.indexOf('"Fler kolumner"'), kod.indexOf('// ---- Collapsible BAS-grupper'));
        expect(del).toContain('state.flerKolumner');
        expect(del).not.toMatch(/localStorage|sessionStorage|setItem|indexedDB/);
        expect(createAppWindow().__state.flerKolumner).toEqual({});
    });
});

// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
// Prioriteringen i appen: egna ord och rubriker, och radernas Visa beräkningen och meny Mer.
import { describe, it, expect } from 'vitest';
import { createAppWindow } from './helpers/app-harness.js';

// A5 (beslut 4a): Prioriteringen mäter löneläget mot er referens och har egna ord, så att de inte förväxlas med
// uppmärksamhetstrappan för skillnaden mellan kvinnor och män (Värt att granska, Följ upp, Balanserat).
describe('Prioritering: egna ord och rätt rubrik (A5)', () => {
    const TRAPPAN = /Värt att granska|Följ upp|Balanserat/;
    const oppna = () => { const w = createAppWindow(); w.__lasInDemodata(); w.__ritaFlik('prioritering'); return w; };
    it('fliken har Prioriteringens egna ord, och nyckeltalet heter Kostnad att nå referensen', () => {
        const w = oppna();
        const d = w.document;
        // Kolumnen Skillnad kön bär uppmärksamhetstrappans bricka (ADR-71); den gäller skillnaden mellan kvinnor och män
        // och prövas för sig nedan.
        const vy = d.getElementById('view-prioritering').cloneNode(true);
        vy.querySelectorAll('.prio-konstatus').forEach(e => e.remove());
        expect(d.querySelectorAll('#prio-table tbody tr').length).toBeGreaterThan(0);
        expect(vy.textContent).not.toMatch(TRAPPAN);
        expect([...vy.querySelectorAll('[data-tooltip], [data-k-tooltip], [data-export-label], [title]')]
            .map(e => ['data-tooltip', 'data-k-tooltip', 'data-export-label', 'title'].map(a => e.getAttribute(a) || '').join(' '))
            .filter(t => TRAPPAN.test(t))).toEqual([]);
        expect(w.eval('Object.values(PRIO_STATUS_INFO).map(s => s.label)')).toEqual(['Börja här', 'Under referens, liten grupp', 'Nära referens, under', 'Nära referens', 'Över referens']);
        const ruta = d.getElementById('prio-stat-cost').closest('.stat-box');
        expect(ruta.querySelector('.stat-etikett').textContent.trim()).toBe('Kostnad att nå referensen');
        // Förklaringen står under nyckeltalsraden (i rutan skulle den klippas).
        const not = d.getElementById('prio-stat-cost-not').textContent.replace(/\s+/g, ' ');
        expect(not).toContain('Vad det kostar att lyfta grupper under referensen till dess median. Detta är löneläget mot er referens, inte lönekartläggningens könsskillnader — dem visar Lika arbete och Löneöversyn.');
        expect(not).toContain('inkl. PO-påslag 40 % (ett standardantagande; sätt organisationens eget under Inställningar)');
        expect(d.getElementById('prio-stat-cost-period').textContent).toBe('12 månader, inkl. PO-påslag 40\u00a0%');
        expect(vy.textContent).not.toMatch(/åtgärdskostnad/i);
    });
    // Nyckeltalen heter som statusarna och räknar tabellens rader; Färdigcheck räknar samma grupper (uppgift 3, UX 2026-11-19).
    it('nyckeltalen räknar tabellens statusar, och Färdigcheck säger samma tal med samma gräns', () => {
        const w = oppna();
        const d = w.document;
        const rader = [...d.querySelectorAll('#prio-table tbody tr')].map(tr => tr._prioItem);
        const items = w.eval('raknaPrioritering(_valdPrioReferens())');
        expect(rader.length).toBe(items.length);
        const antal = s => rader.filter(i => i.status === s).length;
        const ruta = id => d.getElementById(id).closest('.stat-box');
        const nyckel = [['prio-stat-akut', 'akut', 'Börja här'], ['prio-stat-under', 'atgard', 'Under referens, liten grupp'], ['prio-stat-over', 'analysera', 'Över referens']];
        for (const [id, status, namn] of nyckel) {
            expect(ruta(id).querySelector('.stat-etikett').textContent.trim()).toBe(namn);
            expect(w.eval(`PRIO_STATUS_INFO.${status}.label`)).toBe(namn);
            expect(d.getElementById(id).textContent, namn).toBe(String(antal(status)));
        }
        // Statuscellen i tabellen bär samma ord som nyckeltalet.
        for (const tr of d.querySelectorAll('#prio-table tbody tr')) expect(tr.textContent).toContain(w.eval(`PRIO_STATUS_INFO.${tr._prioItem.status}.label`));
        expect(d.getElementById('prio-stat-akut-not').textContent).toBe('mer än 5\u00a0% under, minst 10 personer');
        expect(d.getElementById('prio-stat-under-not').textContent).toBe('mer än 5\u00a0% under, färre än 10 personer');
        expect(d.getElementById('prio-stat-over-not').textContent).toBe('mer än 5\u00a0% över');
        // Färdigcheck: alla under noll, varav Börja här och Under referens, liten grupp.
        const under = items.filter(i => i.diffPct < 0).length, varav = antal('akut') + antal('atgard');
        expect(under).toBeGreaterThan(varav); expect(varav).toBeGreaterThan(0);
        const punkt = w.eval('byggFardigcheck()').find(p => p.id === 'flaggade-grupper');
        expect(punkt.title).toBe(`${under} grupper ligger under referensen, varav ${varav} mer än 5\u00a0% under`);
    });
    it('nyckeltalens undertexter, matrisens zoner och Färdigcheck följer inställda gränser', () => {
        const w = oppna();
        const d = w.document;
        w.eval('state.prioConfig = { atgardThreshold: -2.5, akutMinN: 30, bevakaThreshold: -1, analyseraThreshold: 3 }');
        w.__ritaFlik('prioritering');
        expect(d.getElementById('prio-stat-akut-not').textContent).toBe('mer än 2,5\u00a0% under, minst 30 personer');
        expect(d.getElementById('prio-stat-under-not').textContent).toBe('mer än 2,5\u00a0% under, färre än 30 personer');
        expect(d.getElementById('prio-stat-over-not').textContent).toBe('mer än 3\u00a0% över');
        const items = w.eval('raknaPrioritering(_valdPrioReferens())');
        for (const [id, status] of [['prio-stat-akut', 'akut'], ['prio-stat-under', 'atgard'], ['prio-stat-over', 'analysera']]) {
            expect(d.getElementById(id).textContent).toBe(String(items.filter(i => i.status === status).length));
        }
        const f = w.eval("_prioMatrisFigur(raknaPrioritering(_valdPrioReferens()), 'topp10', 'referensen', state.prioConfig)");
        expect(f.referens.map(z => z.etikett)).toEqual(['MER ÄN 2,5\u00a0% UNDER', 'NÄRA REFERENS, UNDER', 'NÄRA REFERENS', 'MER ÄN 3\u00a0% ÖVER']);
        const punkt = w.eval('byggFardigcheck()').find(p => p.id === 'flaggade-grupper');
        const varav = items.filter(i => i.status === 'akut' || i.status === 'atgard').length;
        expect(punkt.title).toBe(`${items.filter(i => i.diffPct < 0).length} grupper ligger under referensen, varav ${varav} mer än 2,5\u00a0% under`);
        // Utan grupper bortom gränsen står bara den första delen.
        w.eval('state.prioConfig = { atgardThreshold: -40, akutMinN: 10, bevakaThreshold: -2, analyseraThreshold: 5 }');
        expect(w.eval('byggFardigcheck()').find(p => p.id === 'flaggade-grupper').title).toMatch(/^\d+ grupper ligger under referensen$/);
    });
    it('kolumnen Skillnad kön bär uppmärksamhetstrappans bricka efter storleken, utan prövning (ADR-71)', () => {
        const w = oppna();
        const rader = [...w.document.querySelectorAll('#prio-table tbody tr')];
        expect(rader.length).toBeGreaterThan(0);
        const golv = w.eval('statGolv()');
        const nivaer = new Set();
        rader.forEach(tr => {
            const i = tr._prioItem;
            const bricka = tr.querySelectorAll('.prio-konstatus');
            expect(bricka.length).toBe(1);
            const b = bricka[0];
            // Brickan står i samma cell som talet för skillnaden mellan kvinnor och män.
            expect(b.closest('td').querySelector('.cell-bar-wrap')).not.toBeNull();
            const vantad = i.gapPct === null || !(i.kvN >= golv && i.maN >= golv) ? 'ejbedomd'
                : Math.abs(i.gapPct) >= 3 ? 'folj' : 'balanserat';
            expect(b.getAttribute('data-niva')).toBe(vantad);
            expect(b.textContent).toBe({ ejbedomd: 'Går ej att bedöma', folj: 'Följ upp', balanserat: 'Balanserat' }[vantad]);
            nivaer.add(vantad);
        });
        // Prioriteringen prövar inte skillnaden mot slumpen: aldrig Värt att granska.
        expect(nivaer.has('granska')).toBe(false);
        // Exporten bär talet, inte brickan.
        const matris = w.__tabellTillMatris('prio-table');
        expect(matris.flat().join(' ')).not.toMatch(/Följ upp|Balanserat|Går ej att bedöma/);
    });
    it('inställningarnas förklaringar för Prioriteringens trösklar använder samma ord', () => {
        const w = oppna();
        const txt = ['prio-cfg-atgard', 'prio-cfg-akutN', 'prio-cfg-bevaka', 'prio-cfg-analysera']
            .map(id => w.document.getElementById(id).closest('label').textContent).join(' ');
        expect(txt).not.toMatch(TRAPPAN);
        expect(txt).toMatch(/Under referens, liten grupp/);
        expect(txt).toMatch(/Nära referens, under/);
    });
    it('förslagen säger hur nära referensen gruppen ligger, utan att avfärda skillnaden', () => {
        const w = oppna();
        w.__it = { diffPct: 0.8, n: 12, kvN: 12, maN: 12, _rows: [{ lon: 1, kon: 'kvinna', alder: 40 }] };
        const nara = w.eval('byggMotiveringsforslag(window.__it)').map(f => f.text).join(' ');
        expect(nara).toContain('Gruppens median ligger inom ±2 % av referensen.');
        expect(nara).not.toMatch(/normal variation|kräver ytterligare utredning/);
        w.__it = { ...w.__it, diffPct: 7.4 };
        expect(w.eval('byggMotiveringsforslag(window.__it)').map(f => f.text)).toContain('Ligger 7,4\u00a0% över referensen. Dokumentera gärna varför.');
    });
    it('snabb vinst säger villkoret i klarspråk, också för en stor grupp (inget "få personer")', () => {
        const w = oppna();
        w.__it = { diffPct: -4, n: 300, kvN: 150, maN: 150, costPerPerson: 1200, isQuickWin: true, _rows: [{ lon: 1, kon: 'kvinna', alder: 40 }] };
        const txt = w.eval('byggMotiveringsforslag(window.__it)').map(f => f.text).join(' ');
        expect(txt).toMatch(/Snabb vinst:<\/strong> gruppen ligger mer än 3\s%\s+under referensen, och kostnaden per person är under 1\s500\s+kr per månad \(300 personer\)\./);
        expect(txt).not.toMatch(/få personer|hanterbar/);
    });
    it('Excel-bladet Prioritering, handlingsplanen och rapporten har samma ord', async () => {
        const { laddaXlsx, fangaBocker } = await import('./helpers/ktroskel-rigg.js');
        const w = oppna();
        await laddaXlsx(w);
        const bok = Object.values(fangaBocker(w, () => w.eval('exportAlltTillExcel()')))[0];
        const blad = bok.split(/\n(?=\[)/).find(b => b.startsWith('[Prioritering]'));
        expect(blad).toBeTruthy();
        expect(blad).not.toMatch(TRAPPAN);
        expect(blad).toContain('Kostnad att nå referensen');
        const hp = Object.values(fangaBocker(w, () => w.eval('exportHandlingsplan()')))[0];
        expect(hp).toContain('Kostnad att nå referensen');
        const atgarder = w.eval('rapportModell({ alla: true })').avsnitt.find(a => a.id === 'atgarder');
        expect(JSON.stringify(atgarder)).not.toMatch(TRAPPAN);
        expect(JSON.stringify(atgarder)).toContain('kostnad att nå referensen');
        const block = w.__rapportunderlagBlock().find(b => b.id === 'handlingsplan');
        expect(w.__ruTillText(block)).toContain('kostnad att nå referensen');
        expect(w.__ruTillText(block)).not.toMatch(TRAPPAN);
    });
    it('Att göra kallar grupperna under referensen Löneläge mot referens, inte Värt att granska', () => {
        const w = oppna();
        const prio = w.eval('byggAtgardslista()').filter(i => i.källa === 'Prioriteringsanalys');
        expect(prio.length).toBeGreaterThan(0);
        expect([...new Set(prio.map(i => i.kategori))]).toEqual(['Löneläge mot referens']);
        expect(prio.map(i => i.detalj).join(' ')).not.toMatch(/kostnad att lyfta till referens/);
    });
});

describe('Prioriteringens rader: Visa beräkningen och menyn Mer', () => {
    const prio = () => {
        const w = createAppWindow();
        w.__lasInDemodata();
        w.__ritaFlik('prioritering');
        w.document.querySelector('.nav-item[data-tab="prioritering"]').click();   // fokus når bara en flik som visas
        return w;
    };
    it('varje rad har förstoringsglaset och en meny Mer med tre val i text; de tillgängliga namnen är som förut', () => {
        const w = prio();
        const rader = [...w.document.querySelectorAll('#prio-table tbody tr')].filter(tr => tr.querySelector('.prio-detalj'));
        expect(rader.length).toBeGreaterThan(3);
        for (const tr of rader) {
            const yrke = tr.querySelector('th[scope="row"]').firstChild.textContent.trim();
            const cell = tr.querySelector('.prio-detalj');
            // Utanför menyn: bara Visa beräkningen och knappen Mer.
            const synliga = [...cell.querySelectorAll('button')].filter(b => !b.closest('.chart-export-meny'));
            expect(synliga.map(b => b.getAttribute('aria-label'))).toEqual([`Visa beräkningen för ${yrke}`, `Mer om ${yrke}`]);
            const meny = cell.querySelector('.prio-mer .chart-export-meny');
            expect(meny.hidden).toBe(true);
            const val = [...meny.querySelectorAll('button')];
            expect(val.map(b => b.getAttribute('aria-label'))).toEqual([
                `Öppna ${yrke} i Löneöversikten`, `Visa motiveringsförslag för ${yrke}`, `Öppna gruppdossier för ${yrke}`]);
            expect(val.map(b => b.textContent)).toEqual(['Löneöversikten', 'Motiveringsförslag', 'Gruppdossier']);
            // Den synliga texten står i det tillgängliga namnet.
            for (const b of [...val, synliga[1]]) expect(b.getAttribute('aria-label').toLowerCase()).toContain(b.textContent.toLowerCase());
        }
    });
    it('Mer öppnas med fokus på första valet, Escape stänger med fokus tillbaka, och ett val stänger menyn', () => {
        const w = prio();
        const d = w.document;
        const wrap = d.querySelector('#prio-table .prio-mer');
        const knapp = wrap.querySelector(':scope > .chart-export-btn');
        const meny = wrap.querySelector('.chart-export-meny');
        knapp.click();
        expect(meny.hidden).toBe(false);
        expect(knapp.getAttribute('aria-expanded')).toBe('true');
        expect(d.activeElement).toBe(meny.querySelector('button'));
        d.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        expect(meny.hidden).toBe(true);
        expect(knapp.getAttribute('aria-expanded')).toBe('false');
        expect(d.activeElement).toBe(knapp);
        // Motiveringsförslag: menyn stängs, förslagsraden kommer under raden och valet säger att det döljer den.
        knapp.click();
        const forslag = meny.querySelector('.btn-suggest');
        forslag.click();
        expect(meny.hidden).toBe(true);
        expect(d.activeElement).toBe(knapp);
        expect(wrap.closest('tr').nextElementSibling.classList.contains('suggest-row')).toBe(true);
        expect(forslag.getAttribute('aria-expanded')).toBe('true');
        expect(forslag.textContent).toBe('Dölj motiveringsförslag');
        forslag.click();
        expect(wrap.closest('tr').nextElementSibling?.classList.contains('suggest-row')).toBeFalsy();
        expect(forslag.textContent).toBe('Motiveringsförslag');
        // Gruppdossiern: menyn stängs, och när dossiern stängs får Mer fokus tillbaka.
        knapp.click();
        meny.querySelector('[data-open-dossier]').click();
        expect(meny.hidden).toBe(true);
        expect(d.getElementById('dossier-modal').style.display).toBe('flex');
        w.eval('stangGruppdossier()');
        expect(d.activeElement).toBe(knapp);
    });
});

describe('Prioritering: varningen "underlaget är litet" går vid minsta gruppstorlek, inte vid 5', () => {
    const forslag = (k, kvN, maN) => {
        const w = createAppWindow();
        if (k !== null) w.eval(`sattKTroskel(${k}, { fraga: false })`);
        const rows = [];
        for (let i = 0; i < kvN; i++) rows.push({ kon: 'kvinna', lon: 20000 + i, alder: 40 });
        for (let i = 0; i < maN; i++) rows.push({ kon: 'man', lon: 40000 + i, alder: 40 });
        w.__item = { _rows: rows, kvN, maN, n: kvN + maN, diffPct: -8, costPerPerson: 0 };
        return w.eval('byggMotiveringsforslag(window.__item)').filter(f => f.type === 'warn').map(f => f.text).join(' ');
    };
    it('vid 10 varnar den för 7 män och nämner tröskeln', () => {
        expect(forslag(null, 12, 7)).toMatch(/Underlaget är litet \(12 kvinnor \/ 7 män; minsta gruppstorlek 10\)/);
    });
    it('vid 5 varnar den inte för 7 män, men för 4', () => {
        expect(forslag(5, 12, 7)).not.toMatch(/Underlaget är litet/);
        expect(forslag(5, 12, 4)).toMatch(/minsta gruppstorlek 5/);
    });
    it('vid 25 varnar den också för 20 av varje kön', () => {
        expect(forslag(25, 20, 20)).toMatch(/minsta gruppstorlek 25/);
    });
});

describe('Prioritering: motiveringsförslagen om åldersskillnaden', () => {
    it('rådet är rätt stavat: Stäm av om åldersskillnaden förklarar', () => {
        const w = createAppWindow();
        const rows = [];
        for (let i = 0; i < 12; i++) rows.push({ kon: 'kvinna', lon: 30000 + i, alder: 35 });
        for (let i = 0; i < 12; i++) rows.push({ kon: 'man', lon: 32000 + i, alder: 45 });
        w.__item = { _rows: rows, kvN: 12, maN: 12, n: 24, diffPct: -6, costPerPerson: 0 };
        const text = w.eval('byggMotiveringsforslag(window.__item)').map(f => f.text).join(' ');
        expect(text).toMatch(/år äldre/);
        expect(text).toContain('Stäm av om åldersskillnaden förklarar');
        expect(text).not.toContain('rekommenderas');
    });
});

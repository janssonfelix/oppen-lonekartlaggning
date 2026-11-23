// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
// En grupp är AID-koden i BAS-intervallet också i appen (ADR-89): Lika arbetes tabell med underraderna
// per ansvarsgrupp, BAS-dossiern och årsbokslutet räknar en kod med flera texter som en grupp. Underlaget är påhittat:
// koden 207011 i BAS C med texten "Handläggare" (6 kvinnor och 6 män, uppdragsansvar), "Handläggare, natt" (5 kvinnor
// och 4 män, inget ansvar) och ett påhittat personnamn (1 man), alltså 11 kvinnor och 11 män. Per text nådde ingen text
// tio av varje kön; per kod gör gruppen det.
import { describe, it, expect, vi } from 'vitest';
import { createAppWindow } from './helpers/app-harness.js';

vi.setConfig({ testTimeout: 60000 });

const TEXT_A = '207011 Handläggare', TEXT_B = '207011 Handläggare, natt', TEXT_NAMN = '207011 Anna Andersson';
const rad = (yrke, kon, lon, i, ansvarsgrupp) => ({ bas: 'C', kon, lon, alder: 30 + 2 * i, yrke, aid: '207011',
    yrkeLabel: yrke.replace(/^\d+\s*/, ''), ansvarsgrupp });
const flera = (yrke, kon, n, lon, ansvar) => Array.from({ length: n }, (_, i) => rad(yrke, kon, lon + 200 * i, i, ansvar));
const underlag = () => [
    ...flera(TEXT_A, 'kvinna', 6, 30000, 'uppdrag'), ...flera(TEXT_A, 'man', 6, 32000, 'uppdrag'),
    ...flera(TEXT_B, 'kvinna', 5, 30500, 'inget'), ...flera(TEXT_B, 'man', 4, 32500, 'inget'),
    rad(TEXT_NAMN, 'man', 33000, 0, 'inget'),
];
const fonster = () => { const w = createAppWindow(); w.__state.data = underlag(); return w; };

describe('[B5.1] Lika arbete i appen: en grupp per AID-kod', () => {
    it('laLikaGrupper: en grupp på 22 med 11 kvinnor och 11 män och könsmedianer, vid tröskeln 10', () => {
        const w = fonster();
        const res = w.eval('laLikaGrupper(hamtaData(), 10)');
        expect(res.utelamnade).toEqual([]);
        expect(res.ejJamforbara).toEqual([]);
        expect(res.grupper.map(g => [g.yrke, g.aid, g.bas, g.nKv, g.nMa, g.tot, g.samladMedian])).toEqual([[TEXT_A, '207011', 'C', 11, 11, 22, false]]);
    });
    it('tabellen per AID-etikett har en rad för koden, och underraderna per ansvarsgrupp räknar alla kodens rader', () => {
        const w = fonster();
        w.eval('ritaLikaArbete(laVymodell())');
        const tbody = w.document.querySelector('#matrix-table tbody');
        // Yrkesraderna; under dem står underraderna och notraden om skörhet.
        const huvud = [...tbody.querySelectorAll('tr')].filter(tr => !tr.classList.contains('la-underrad') && /^\s*\d{6}/.test(tr.textContent));
        expect(huvud).toHaveLength(1);
        expect(huvud[0].textContent).toContain(TEXT_A);
        expect(huvud[0].textContent).toContain('22 (11/11)');
        expect(tbody.textContent).not.toContain('Handläggare, natt');
        expect(tbody.textContent).not.toMatch(/Anna|Andersson/);
        const under = [...tbody.querySelectorAll('tr.la-underrad-ansvar')].map(tr => tr.textContent);
        expect(under).toHaveLength(2);
        expect(under.join('|')).toMatch(/12 \(6\/6\)/);
        expect(under.join('|')).toMatch(/10 \(5\/5\)/);
    });
    it('samma kod i två BAS-intervall: två rader intill varandra, med intervallet i kolumnen BAS-intervall och egna underrader', () => {
        const w = createAppWindow();
        const iD = underlag().map(r => ({ ...r, bas: 'D', lon: r.lon + 4000 }));
        w.__state.data = [...underlag(), ...iD];
        w.eval('ritaLikaArbete(laVymodell())');
        const rubriker = [...w.document.querySelectorAll('#matrix-table thead th')].map(th => th.textContent.trim());
        expect(rubriker[1]).toBe('BAS');
        const rader = [...w.document.querySelectorAll('#matrix-table tbody tr')].filter(tr => tr._euRow);
        expect(rader.map(tr => [tr._euRow.aid, tr._euRow.bas, tr.cells[1].textContent.trim()])).toEqual([['207011', 'C', 'C'], ['207011', 'D', 'D']]);
        expect(rader.every(tr => tr.textContent.includes('22 (11/11)'))).toBe(true);
        // Underraderna per ansvarsgrupp står under sin grupp och räknar bara gruppens intervall.
        const alla = [...w.document.querySelectorAll('#matrix-table tbody tr')];
        const underC = alla.slice(alla.indexOf(rader[0]) + 1, alla.indexOf(rader[1])).filter(tr => tr.classList.contains('la-underrad-ansvar'));
        expect(underC.map(tr => tr.textContent).join('|')).toMatch(/12 \(6\/6\)/);
        expect(underC).toHaveLength(2);
    });
    it('gruppens namn är texten på flest av dess rader i appens egna grupperingar också, när raden med ett namn står först', () => {
        const w = createAppWindow();
        const d = underlag();
        w.__state.data = [d[d.length - 1], ...d.slice(0, -1)];   // personnamnet på första raden
        expect(w.eval('laLikaGrupper(hamtaData(), 10)').grupper.map(g => g.yrke)).toEqual([TEXT_A]);
        expect(w.eval('gruppdossierCandidates()').map(g => g.yrke)).toEqual([TEXT_A]);
        expect(w.eval("buildBasdossier('C')").yrken.map(y => y.yrke)).toEqual([TEXT_A]);
        expect(w.eval('byggArsbokslutNu()').grupper.map(g => g.yrke)).toEqual([TEXT_A]);
        expect(w.eval("_forecastAidsForBas('C')").map(g => g.label)).toEqual(['Handläggare']);
        expect(w.eval("_lutningRader(hamtaData(), hamtaData().map(r => ({ lon: r.lon })), 'grupp')").map(g => g.yrke)).toEqual(['Handläggare']);
        expect(w.eval('kravGrupper(hamtaData(), { k: 10 })').grupper.map(g => g.namn)).toEqual(['Handläggare']);
    });
    it('BAS-dossiern: en yrkesrad för koden, med gruppens antal ur Lika arbete', () => {
        const w = fonster();
        const d = w.eval("buildBasdossier('C')");
        expect(d.yrken.map(y => [y.yrke, y.aid, y.tot, y.nKv, y.nMa])).toEqual([[TEXT_A, '207011', 22, 11, 11]]);
        expect(d.yrkenUtelamnade).toEqual([]);
        expect(d.ejJamforbara).toEqual([]);
    });
    it('årsbokslutet: en grupp för koden, med lönespridningen för alla kodens rader', () => {
        const w = fonster();
        const b = w.eval('byggArsbokslutNu()');
        expect(b.grupper.map(g => [g.yrke, g.bas, g.nKv, g.nMa])).toEqual([[TEXT_A, 'C', 11, 11]]);
        expect(b.grupper[0].spridning).not.toBeNull();
        expect(JSON.stringify(b)).not.toMatch(/Anna|Andersson|Handläggare, natt/);
    });
});

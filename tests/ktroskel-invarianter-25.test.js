/**
 * K-tröskeln som inställning: invarianten över flikar och exporter vid 25 (I4) och sakliga skäl (I8).
 *
 * Riggen (fixturer, fönster och sökfunktioner) ligger i tests/helpers/ktroskel-rigg.js och invarianten i
 * tests/helpers/ktroskel-invariant.js. Invarianten vid 10 körs i tests/ktroskel-invarianter.test.js:
 * varje förberedelse (samlaUtdata) tar omkring en minut, så de fördelas på två filer som körs på var sin arbetare.
 *
 * Vaktar: S4 (docs/utveckling/regler.md)
 */
import { describe, it, expect, beforeAll, vi } from 'vitest';
import { SENT_MELLAN, fonsterKon, samlaUtdata, sammanhang } from './helpers/ktroskel-rigg.js';
import { invariantSvit } from './helpers/ktroskel-invariant.js';

// Sviten ritar om hela verktyget i varje test. Under full last tar ett test 4–6 s, så standardgränsen 5 s
// fäller olika tester från körning till körning.
vi.setConfig({ testTimeout: 30000 });

// Vid 25 är också mellangrupperna (20 personer) under tröskeln.
invariantSvit(25, SENT_MELLAN);

// Sakliga skäl (handlingsplanen): skälen hör till rader som redan är k-grindade. En rad som bara finns på skärmen (en
// grupp under tröskeln) får inte föra ut sina skäl: varken kommentarens tal eller beloppet står i något som lämnar
// verktyget. En rad där ett kön är under tröskeln (den minsta gruppen bakom skillnaden) följer med, men bara med
// kategorin: belopp och kommentar utelämnas. Konfigurationsfilen är användarens egen fil med det som skrivits in och
// undantas (riskanalysen § 6.8), men dess årsbokslut prövas.
describe('I8: sakliga skäl på en rad under tröskeln lämnar inte verktyget', () => {
    let utdata;
    beforeAll(async () => {
        const w = fonsterKon(10);
        // Gruppen 7002 i BAS X (fyra personer) hamnar under referensen: en rad i handlingsplanen bara på skärmen.
        w.eval("state.policy.find(p => p.bas === 'X').med = 90000");
        const skarm = w.eval('_handlingsplanSeedRows().nycklar');
        const { nycklar: ut, minsta } = w.eval('medExportLage(() => { const s = _handlingsplanSeedRows(); return { nycklar: s.nycklar, minsta: s.minsta }; })');
        const under = skarm.find(n => !ut.includes(n));
        const over = ut.find((n, i) => !n.startsWith('egen|') && minsta[i] >= 10);
        const konUnder = ut.find((n, i) => !n.startsWith('egen|') && minsta[i] < 10);
        expect(under, 'fixturen har en rad under tröskeln').toBeTruthy();
        expect(over, 'fixturen har en rad över tröskeln').toBeTruthy();
        expect(konUnder, 'fixturen har en rad där ett kön är under tröskeln').toBeTruthy();
        w.eval(`_hpSattSkal(${JSON.stringify(under)}, [{ kategori: 'marknad', belopp: 87654, kommentar: 'Dold kommentar 98765' }])`);
        w.eval(`_hpSattSkal(${JSON.stringify(over)}, [{ kategori: 'erfarenhet', belopp: 24681, kommentar: 'Synlig kommentar 45678' }])`);
        w.eval(`_hpSattSkal(${JSON.stringify(konUnder)}, [{ kategori: 'utbildning', belopp: 13579, kommentar: 'Kommentar 86420' }])`);
        // Bara hela konfigurationsfilen undantas: den bär handlingsplanen som den skrivits. Dess årsbokslut prövas.
        utdata = (await samlaUtdata(w)).filter(([n]) => n !== 'skärm: alla flikar' && n !== 'konfigurationsfilen (hela)');
    }, 300000);   // samma gräns som I4 (tests/helpers/ktroskel-invariant.js): samlaUtdata bygger alla exporter
    it('kommentarens tal och beloppet syns inte för raden under tröskeln, men för raden över', () => {
        const lackor = [];
        for (const [namn, text] of utdata) for (const v of ['98765', '87654', '87 654']) if (text.includes(v)) lackor.push(`${namn}: ${v} — "${sammanhang(text, v)}"`);
        expect(lackor).toEqual([]);
        expect(utdata.some(([, t]) => t.includes('45678')), 'raden över tröskeln följer med').toBe(true);
        expect(utdata.map(([n]) => n)).toContain('konfigurationsfilen: årsbokslutet');
    });
    it('ett kön under tröskeln: beloppet och kommentaren finns inte i någon export eller i bokslutet, kategorin gör det', () => {
        const lackor = [];
        for (const [namn, text] of utdata) for (const v of ['13579', '13 579', '86420']) if (text.includes(v)) lackor.push(`${namn}: ${v} — "${sammanhang(text, v)}"`);
        expect(lackor).toEqual([]);
        expect(utdata.find(([n]) => n === 'konfigurationsfilen: årsbokslutet')[1]).toContain('"utbildning"');
    });
});

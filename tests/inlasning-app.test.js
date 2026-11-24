// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
// Inläsningen av lönefilen i appen: kolumner, radnummer, ansvarskoden, PII-kontrollen, BAS-intervallen, filrutorna och
// en lönefil vars kolumner inte känns igen.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createAppWindow } from './helpers/app-harness.js';
import { papa, vanta, csvFil, braRader, okandaRader } from './helpers/granssnitt-rigg.js';
import { utanTaggar } from '../src/lib/htmltext.js';

describe('radnummer vid inläsning', () => {
    const vendor = async (w, fil) => {
        const { readFileSync } = await import('node:fs');
        const { join, dirname } = await import('node:path');
        const { fileURLToPath } = await import('node:url');
        w.eval(readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'vendor', fil), 'utf8'));
    };
    const vanta = async w => { for (let i = 0; i < 100 && !w.__state.data.length; i++) await new Promise(r => setTimeout(r, 20)); };
    it('CSV: radnr följer filens rader trots försättsrad, tom rad och utesluten rad', async () => {
        const w = createAppWindow();
        await vendor(w, 'papaparse.min.js');
        const rader = ['Lönerapport 2026', 'BAS;Månadslön;Ålder;Kön;AID',
            'A;30000;40;Kvinna;5301',   // rad 3
            '',                         // rad 4 (tom)
            'K;90000;50;Man;7101',      // rad 5 (BAS K ingår sedan 2026.10)
            'A;31000;41;Man;5301'];     // rad 6
        w.lasInStrukturfil(new w.File([rader.join('\n')], 'p.csv', { type: 'text/csv' }));
        await vanta(w);
        expect(w.__state.data.map(r => r.radnr)).toEqual([3, 5, 6]);
    });
    it('Excel: radnr följer bladets rader trots försättsrad och tom rad', async () => {
        const w = createAppWindow();
        await vendor(w, 'xlsx.mini.min.js');
        const X = w.XLSX;
        const ws = X.utils.aoa_to_sheet([['Lönerapport'], [], ['BAS', 'Månadslön', 'Ålder', 'Kön', 'AID'],
            ['A', 30000, 40, 'Kvinna', '5301'], [], ['A', 31000, 41, 'Man', '5301']]);
        const wb = X.utils.book_new(); X.utils.book_append_sheet(wb, ws, 'Blad1');
        const buf = X.write(wb, { type: 'array', bookType: 'xlsx' });
        w.lasInStrukturfil(new w.File([buf], 'p.xlsx'));
        await vanta(w);
        expect(w.__state.data.map(r => r.radnr)).toEqual([4, 6]);
    });
    it('demodatan har radnr = index + 2', () => {
        const w = createAppWindow();
        w.__lasInDemodata();
        expect(w.__state.data.slice(0, 3).map(r => r.radnr)).toEqual([2, 3, 4]);
    });
    it('extremvärdesdetektorn visar filens radnummer', () => {
        const w = createAppWindow();
        w.__lasInDemodata();
        const i = 40;
        w.__state.data[i].lon = 400000;   // tydlig avvikelse
        const ut = w.eval('hittaExtremvarden(3)');
        const o = ut.find(x => x.lon === 400000);
        expect(o.radnr).toBe(w.__state.data[i].radnr);
        expect(o.seq).toBeUndefined();
    });
});

describe('dolda grupper, belopp, radslut och gränsfältet', () => {
    const rad = (bas, kon, lon, aid) => ({ bas, kon, lon, alder: 40, aid, yrke: aid, enhet: '' });
    const flera = (n, ...a) => Array.from({ length: n }, () => rad(...a));
    it('sammanslagna grupper (i exportläget) redovisas med antal, aldrig med belopp eller namn (ADR-87)', () => {
        const w = createAppWindow();
        w.__state.kLage = 'export';
        const bakgrund = [...flera(30, 'E', 'kvinna', 28000, 'E1'), ...flera(12, 'E', 'man', 29500, 'E1'),
            ...flera(12, 'F', 'kvinna', 33000, 'F1'), ...flera(30, 'F', 'man', 35500, 'F1'),
            ...flera(25, 'G', 'kvinna', 38000, 'G1'), ...flera(15, 'G', 'man', 41000, 'G1')];
        w.__state.data = [...flera(20, 'A', 'kvinna', 30000, 'A1'), ...flera(20, 'A', 'man', 31000, 'A1'),
            ...flera(5, 'C', 'kvinna', 50000, 'C1'), ...flera(3, 'C', 'man', 60000, 'C1'), ...bakgrund];
        w.eval('fyllValjare(); lasUppFlikar(); ritaGapUppdelning();');
        const ovriga = [...w.document.querySelectorAll('#gap-uppdelning .gu-ovriga')].map(li => li.textContent);
        expect(ovriga.length).toBeGreaterThan(0);
        for (const t of ovriga) { expect(t).not.toMatch(/kr/); expect(t).toMatch(/namnges inte: ett kön har färre än 10 personer/); }
        w.__state.data = [...flera(20, 'A', 'kvinna', 30000, 'A1'), ...flera(20, 'A', 'man', 31000, 'A1'),
            ...flera(5, 'C', 'kvinna', 50000, 'C1'), ...flera(3, 'C', 'man', 60000, 'C1')];
        w.eval('ritaGapUppdelning();');
        // Räcker inte de andra grupperna räknas alla samman: delarna står, men ingen grupp namnges.
        const kort = w.document.getElementById('gap-uppdelning-innehall');
        expect(kort.querySelectorAll('.gu-rad')).toHaveLength(3);
        expect(kort.querySelectorAll('.gu-topp li:not(.gu-ovriga)')).toHaveLength(0);
        expect(kort.textContent).not.toMatch(/BAS [AC]|C1/);
    });
    it('belopp som avrundas till noll visas utan tecken', () => {
        const w = createAppWindow();
        expect(w.eval('_guKr(-0.3)')).toBe('0\u00a0kr');
        expect(w.eval('_guKr(0.4)')).toBe('0\u00a0kr');
        expect(w.eval('_guKr(-12)')).toBe('−12\u00a0kr');
    });
    it('kortet förklarar beloppens tecken', () => {
        const w = createAppWindow();
        w.__lasInDemodata(); w.__ritaFlik('struktur');
        expect(w.document.getElementById('gap-uppdelning').textContent).toContain('negativa belopp betyder att kvinnornas medellön är lägre');
    });
    it('CSV med bara CR som radslut får radnummer', async () => {
        const { readFileSync } = await import('node:fs');
        const { join, dirname } = await import('node:path');
        const { fileURLToPath } = await import('node:url');
        const w = createAppWindow();
        w.eval(readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'vendor', 'papaparse.min.js'), 'utf8'));
        const rader = ['BAS;Månadslön;Ålder;Kön;AID', 'A;30000;40;Kvinna;5301', 'A;31000;41;Man;5301'];
        w.lasInStrukturfil(new w.File([rader.join('\r')], 'p.csv', { type: 'text/csv' }));
        for (let i = 0; i < 100 && !w.__state.data.length; i++) await new Promise(r => setTimeout(r, 20));
        expect(w.__state.data.map(r => r.radnr)).toEqual([2, 3]);
    });
    it('gränsfältet visar det värde som används när man lämnar det', () => {
        const w = createAppWindow();
        w.__lasInDemodata();
        w.document.querySelector('.nav-item[data-tab="matrix"]').click();
        const g = w.document.getElementById('pag-grans');
        for (const [in_, ut] of [['100', '30'], ['2', '5'], ['', '10'], ['abc', '10']]) {
            g.value = in_;
            g.dispatchEvent(new w.Event('change'));
            expect(g.value).toBe(ut);
        }
    });
});

describe('ansvarskodskolumnen vid inläsning', () => {
    const vendorPapa = async w => {
        const { readFileSync } = await import('node:fs');
        const { join, dirname } = await import('node:path');
        const { fileURLToPath } = await import('node:url');
        w.eval(readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'vendor', 'papaparse.min.js'), 'utf8'));
    };
    const csv = (extraRubrik = '', extra = () => '') => {
        const rader = [`BAS;Månadslön;Ålder;Kön;AID;Ansvarskod${extraRubrik}`];
        for (let i = 0; i < 30; i++) rader.push(`C;${30000 + i * 10};${30 + i};${i % 2 ? 'Man' : 'Kvinna'};207011;${i % 5 ? '' : 'C'}${extra(i)}`);
        return rader.join('\n');
    };
    it('"— ingen —" för Ansvarskod i kolumnmappningen gör att kolumnen inte läses', async () => {
        const w = createAppWindow();
        await vendorPapa(w);
        w.__state.columnMap = { ansvar: '' };
        w.lasInStrukturfil(new w.File([csv()], 'p.csv', { type: 'text/csv' }));
        for (let i = 0; i < 100 && !w.__state.data.length; i++) await new Promise(r => setTimeout(r, 20));
        expect(w.__state.data.length).toBe(30);
        expect(w.__state.ansvarKolumn).toBeNull();
        expect(w.__state.data.every(r => r.ansvarsgrupp === null || r.ansvarsgrupp === undefined)).toBe(true);
    });
    it('kolumnmappningens "— ingen —" för Ansvarskod sparas och visas som vald', async () => {
        const w = createAppWindow();
        await vendorPapa(w);
        w.lasInStrukturfil(new w.File([csv()], 'p.csv', { type: 'text/csv' }));
        for (let i = 0; i < 100 && !w.__state.data.length; i++) await new Promise(r => setTimeout(r, 20));
        expect(w.__state.ansvarKolumn).toMatchObject({ namn: 'Ansvarskod' });
        const sel = () => w.document.querySelector('#column-map-panel [data-colmap-role="ansvar"]');
        expect(sel().value).toBe('Ansvarskod');
        sel().value = '';
        w.document.getElementById('colmap-apply').click();
        expect(w.__state.columnMap.ansvar).toBe('');
        w.__state.data = [];
        for (let i = 0; i < 100 && !w.__state.data.length; i++) await new Promise(r => setTimeout(r, 20));
        expect(w.__state.ansvarKolumn).toBeNull();
        expect(sel().value).toBe('');
    });
    it('en fil med kolumnen Förnamn (utan andra namnkolumner) avvisas och inget läses in', async () => {
        const w = createAppWindow();
        await vendorPapa(w);
        // Ett förnamn per rad: värdekontrollen kräver för- OCH efternamn, så bara rubriken kan fälla filen.
        const namn = ['Anna', 'Bo', 'Cecilia', 'David', 'Eva'];
        w.lasInStrukturfil(new w.File([csv(';Förnamn', i => `;${namn[i % namn.length]}`)], 'f.csv', { type: 'text/csv' }));
        await new Promise(r => setTimeout(r, 400));
        expect(w.__state.data).toEqual([]);
        const status = w.document.getElementById('data-status').textContent;
        expect(status).toMatch(/Filen avvisad/);
        expect(status).toMatch(/Förnamn/);
    });
    it('bara vitlistade fält hålls i minnet; övriga kolumner läses aldrig in, och alla BAS ingår (riskanalysen §6.4)', async () => {
        const w = createAppWindow();
        await vendorPapa(w);
        const rader = [csv(';Poäng;Anställningsnr;Ansvar;Kostnadsställe', i => `;${300 + i};ANSTNR${9000 + i};ANSVAR${i};KST${i}`)];
        for (let i = 0; i < 3; i++) rader.push(`K;${99000 + i};${40 + i};Kvinna;207011;;${300 + i};ANSTNR${9900 + i};ANSVAR9${i};KST9${i}`);
        w.lasInStrukturfil(new w.File([rader.join('\n')], 'p.csv', { type: 'text/csv' }));
        for (let i = 0; i < 100 && !w.__state.data.length; i++) await new Promise(r => setTimeout(r, 20));
        expect(w.__state.data.length).toBe(33);
        const nycklar = [...new Set(w.__state.data.flatMap(r => Object.keys(r)))].sort();
        expect(nycklar).toEqual(['aid', 'alder', 'ansvarsgrupp', 'ansvarskoder', 'bas', 'kon', 'lon', 'poang', 'radnr', 'yrke', 'yrkeLabel']);
        const allt = JSON.stringify(w.__state.data);
        expect(allt).not.toMatch(/ANSTNR|ANSVAR\d|KST\d/);
        expect(w.__state.data.filter(r => r.bas === 'K').length).toBe(3);
    });
    it('en avvisad fil ändrar inte ansvarskolumnen för den data som redan finns', async () => {
        const w = createAppWindow();
        await vendorPapa(w);
        w.__lasInDemodata();
        const fore = JSON.stringify(w.__state.ansvarKolumn);
        w.lasInStrukturfil(new w.File([csv(';Personnummer', i => `;19800101-${String(1000 + i)}`)], 'p.csv', { type: 'text/csv' }));
        await new Promise(r => setTimeout(r, 400));
        expect(JSON.stringify(w.__state.ansvarKolumn)).toBe(fore);
    });
});

describe('PII-kontrollen vid inläsning samplar hela filen', () => {
    const vendorPapa = async w => {
        const { readFileSync } = await import('node:fs');
        const { join, dirname } = await import('node:path');
        const { fileURLToPath } = await import('node:url');
        w.eval(readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'vendor', 'papaparse.min.js'), 'utf8'));
    };
    // 300 rader; kolumnen Id har personnummer från rad 200, annars ett löpnummer.
    const rader = () => {
        const r = [['BAS', 'Månadslön', 'Ålder', 'Kön', 'Id']];
        for (let i = 0; i < 300; i++) r.push(['C', 30000 + i, 30 + (i % 30), i % 2 ? 'Man' : 'Kvinna', i >= 200 ? `19800101-${1000 + i}` : `L${i}`]);
        return r;
    };
    it('CSV: personnummer som börjar på rad 200 fäller filen', async () => {
        const w = createAppWindow();
        await vendorPapa(w);
        w.lasInStrukturfil(new w.File([rader().map(r => r.join(';')).join('\n')], 'p.csv', { type: 'text/csv' }));
        for (let i = 0; i < 100 && !/avvisad/.test(w.document.getElementById('data-status').textContent); i++) await new Promise(r => setTimeout(r, 20));
        expect(w.__state.data).toEqual([]);
        expect(w.document.getElementById('data-status').textContent).toMatch(/Filen avvisad[\s\S]*Id/);
    });
    it('Excel: personnummer som börjar på rad 200 fäller filen', async () => {
        const w = createAppWindow();
        const { readFileSync } = await import('node:fs');
        const { join, dirname } = await import('node:path');
        const { fileURLToPath } = await import('node:url');
        w.eval(readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'vendor', 'xlsx.mini.min.js'), 'utf8'));
        const X = w.XLSX;
        const wb = X.utils.book_new(); X.utils.book_append_sheet(wb, X.utils.aoa_to_sheet(rader()), 'Blad1');
        const buf = X.write(wb, { type: 'array', bookType: 'xlsx' });
        w.lasInStrukturfil(new w.File([buf], 'p.xlsx'));
        for (let i = 0; i < 100 && !/avvisad/.test(w.document.getElementById('data-status').textContent); i++) await new Promise(r => setTimeout(r, 20));
        expect(w.__state.data).toEqual([]);
        expect(w.document.getElementById('data-status').textContent).toMatch(/Filen avvisad[\s\S]*Id/);
    });
    it('CSV utan personnummer läses in som förut', async () => {
        const w = createAppWindow();
        await vendorPapa(w);
        const r = rader().map((x, i) => (i > 0 ? [...x.slice(0, 4), `L${i}`] : x));
        w.lasInStrukturfil(new w.File([r.map(x => x.join(';')).join('\n')], 'p.csv', { type: 'text/csv' }));
        for (let i = 0; i < 100 && !w.__state.data.length; i++) await new Promise(r2 => setTimeout(r2, 20));
        expect(w.__state.data.length).toBe(300);
    });
});

describe('ansvarsraden och ansvarskolumnen vid fel', () => {
    const vendorPapa = async w => {
        const { readFileSync } = await import('node:fs');
        const { join, dirname } = await import('node:path');
        const { fileURLToPath } = await import('node:url');
        w.eval(readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'vendor', 'papaparse.min.js'), 'utf8'));
    };
    it('ansvarsraden visar skillnaden med tecken och säger till när den byter riktning', () => {
        const w = createAppWindow();
        const t = (a, b) => utanTaggar(w.eval(`_ansvarRadText(${a}, ${b})`));
        expect(t(-6.82, -5.1)).toMatch(/förklarar ytterligare 1,72 procentenheter.*−5,10 %.*före −6,82 %/);
        expect(t(-1, 0.8)).toMatch(/byter skillnaden riktning, från −1,00 % till \+0,80 %/);
        expect(t(-1, 0.8)).not.toMatch(/förklarar ytterligare/);
        expect(t(-5, -6)).toMatch(/förklarar inget.*större, −6,00 % \(före −5,00 %\)/);
    });
    it('ett CSV-fel mitt i läsningen återställer ansvarskolumnen för den data som redan finns', async () => {
        const w = createAppWindow();
        await vendorPapa(w);
        w.__lasInDemodata();
        const fore = JSON.stringify(w.__state.ansvarKolumn);
        const antal = w.__state.data.length;
        w.Papa.parse = (text, cfg) => {
            const falt = ['BAS', 'Månadslön', 'Ålder', 'Kön', 'AID', 'Annan ansvarskod'];
            for (let i = 0; i < 60; i++) {
                cfg.step({ data: { BAS: 'C', 'Månadslön': String(30000 + i), 'Ålder': '40', 'Kön': 'Kvinna', AID: '207011', 'Annan ansvarskod': 'C' }, meta: { fields: falt } }, { abort() {} });
            }
            cfg.error();
        };
        w.lasInStrukturfil(new w.File(['BAS;Månadslön;Ålder;Kön;AID;Annan ansvarskod\nC;30000;40;Kvinna;207011;C'], 'p.csv', { type: 'text/csv' }));
        await new Promise(r => setTimeout(r, 300));
        expect(w.document.getElementById('data-status').textContent).toMatch(/Fel vid CSV-parsning/);
        expect(w.__state.data.length).toBe(antal);
        expect(JSON.stringify(w.__state.ansvarKolumn)).toBe(fore);
    });
    it('enstaka ogiltiga ansvarskoder redovisas i inläsningsraden', async () => {
        const w = createAppWindow();
        await vendorPapa(w);
        const rader = ['BAS;Månadslön;Ålder;Kön;AID;Ansvarskod'];
        for (let i = 0; i < 40; i++) rader.push(`C;${30000 + i * 10};${30 + (i % 20)};${i % 2 ? 'Man' : 'Kvinna'};207011;${i === 7 ? 'X9' : (i % 2 ? 'C' : 'F')}`);
        w.lasInStrukturfil(new w.File([rader.join('\n')], 'p.csv', { type: 'text/csv' }));
        for (let i = 0; i < 100 && !w.__state.data.length; i++) await new Promise(r => setTimeout(r, 20));
        expect(w.__state.ansvarKolumn).toMatchObject({ namn: 'Ansvarskod' });
        expect(w.document.getElementById('data-status').textContent).toMatch(/1 ogiltigt värde räknades som inget särskilt ansvar/);
    });
});

describe('inläsning: alla BAS-intervall ingår', () => {
    it('personer i BAS K och senare läses in som alla andra, utan särskild räkning', async () => {
        const { readFileSync } = await import('node:fs');
        const { join, dirname } = await import('node:path');
        const { fileURLToPath } = await import('node:url');
        const root = join(dirname(fileURLToPath(import.meta.url)), '..');
        const w = createAppWindow();
        w.eval(readFileSync(join(root, 'vendor', 'papaparse.min.js'), 'utf8'));
        const rader = ['BAS;Månadslön;Ålder;Kön;AID'];
        for (let i = 0; i < 40; i++) rader.push(`${['A', 'B', 'J'][i % 3]};${30000 + i * 10};${30 + (i % 20)};${i % 2 ? 'Man' : 'Kvinna'};5301`);
        for (let i = 0; i < 5; i++) rader.push(`K;88888;50;Man;7101`);
        for (let i = 0; i < 2; i++) rader.push(`L;99999;55;Kvinna;7102`);
        const fil = new w.File([rader.join('\n')], 'personal.csv', { type: 'text/csv' });
        w.lasInStrukturfil(fil);
        for (let i = 0; i < 100 && !w.__state.data.length; i++) await new Promise(r => setTimeout(r, 20));
        expect(w.__state.data.length).toBe(47);
        expect(w.__state.data.filter(r => r.bas === 'K').length).toBe(5);
        expect(w.__state.data.filter(r => r.bas === 'L').length).toBe(2);
        expect(w.__state.dataAudit.excludedOverBas).toBeUndefined();
        const status = w.document.getElementById('data-status').textContent;
        expect(status).toContain('47 rader · 5 BAS');
        expect(status).not.toContain('analyseras manuellt');
        expect(w.eval('byggAtgardslista()').some(i => i.id === 'bas-ovanfor-grans')).toBe(false);
    });
});

describe('ingen organisatorisk enhet i data eller utdata (se avgränsningen i mal.md)', () => {
    it('ordlistan, Vad lagras? och riskanalysen beskriver fem fält, utan enhet', async () => {
        const w = createAppWindow();
        w.__lasInDemodata();
        w.eval('oppnaVadLagras()');
        expect(w.document.getElementById('data-residency-content').textContent).not.toMatch(/\bsex fält\b/);
        expect(w.document.body.innerHTML).not.toMatch(/hur en enhet skiljer sig/);
        const { readFileSync } = await import('node:fs');
        const { join, dirname } = await import('node:path');
        const { fileURLToPath } = await import('node:url');
        const rot = join(dirname(fileURLToPath(import.meta.url)), '..');
        const risk = readFileSync(join(rot, 'docs', 'dataskydd', 'riskanalys.md'), 'utf8');
        // ORDLISTA är en const och nås inte i testfönstret — läs ordlistans källa.
        const ord = readFileSync(join(rot, 'src', 'app', '04-ordlista.js'), 'utf8').split('\n').find(l => l.includes("term:'Uppgiftsminimering'"));
        expect(ord).not.toMatch(/ansvar/i);
        expect(risk).not.toMatch(/sex minimerade|sex obligatoriska/);
    });
    it('rapportunderlaget visar ingen lön från ett kön under k i hela organisationen', () => {
        const w = createAppWindow();
        const rad = (kon, lon, i) => ({ bas: ['A', 'B', 'C'][i % 3], kon, lon, alder: 25 + (i % 30), yrke: `${100 + (i % 2)} Yrke`, aid: String(100 + (i % 2)), yrkeLabel: 'Yrke' });
        const rader = [];
        for (let i = 0; i < 12; i++) rader.push(rad('kvinna', 31000 + i * 50, i));
        for (let i = 0; i < 3; i++) rader.push(rad('man', 77777, i));
        w.__state.data = rader;
        w.eval('fyllValjare(); lasUppFlikar();');
        const text = w.__rapportunderlagBlock().map(b => w.__ruTillText(b)).join('\n').replace(/(\d)[\s\u00a0\u202f](?=\d)/g, '$1');
        expect(text).not.toContain('77777');
        expect(text).toContain('Urval: Hela organisationen');
    });
    it('CSV-mallen har ingen Ansvar-kolumn', async () => {
        const w = createAppWindow();
        let blob = null;
        w.URL.createObjectURL = b => { blob = b; return 'blob:x'; };
        w.document.getElementById('btn-download-csv-template').click();
        const text = await blob.text();
        expect(text.split(/\r?\n/)[0]).not.toMatch(/Ansvar/);
        expect(text).not.toMatch(/12345678|12349999/);
    });
    it('exporterna och hjälptexterna nämner ingen enhet', () => {
        const w = createAppWindow();
        w.__lasInDemodata();
        const html = w.__docDraftHtml();
        expect(html).not.toMatch(/Enhet \d|enhetsfilter/i);
        w.eval('oppnaVadLagras()');
        expect(w.document.getElementById('data-residency-content').textContent).not.toMatch(/\benhet\b/);
    });
    it('ingen vy erbjuder enhet som val, och rapportunderlaget har inga enhetsblock', () => {
        const w = createAppWindow();
        w.__lasInDemodata();
        expect(w.document.querySelectorAll('option[value="enhet"]')).toHaveLength(0);
        expect(w.document.getElementById('prio-per-enhet-card')).toBeNull();
        const ids = w.__rapportunderlagBlock();
        expect(ids.every(b => !b.stycken.join(' ').includes('Enhet '))).toBe(true);
    });
    const vendor = async w => {
        const { readFileSync } = await import('node:fs');
        const { join, dirname } = await import('node:path');
        const { fileURLToPath } = await import('node:url');
        w.eval(readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'vendor', 'papaparse.min.js'), 'utf8'));
    };
    it('en lönefil med kolumnen Ansvar läses in utan enhetsfält', async () => {
        const w = createAppWindow();
        await vendor(w);
        const rader = ['BAS;Månadslön;Ålder;Kön;AID;Ansvar'];
        for (let i = 0; i < 12; i++) rader.push(`A;${30000 + i};40;${i % 2 ? 'Man' : 'Kvinna'};5301;110045`);
        w.lasInStrukturfil(new w.File([rader.join('\n')], 'p.csv', { type: 'text/csv' }));
        for (let i = 0; i < 100 && !w.__state.data.length; i++) await new Promise(r => setTimeout(r, 20));
        expect(w.__state.data).toHaveLength(12);
        expect(w.__state.data.every(r => !('enhet' in r))).toBe(true);
        const rec = w.eval(`minimeraLonerad({ BAS: 'A', 'Månadslön': '30000', 'Ålder': '40', 'Kön': 'Kvinna', AID: '5301', Ansvar: '110045' })`);
        expect('enhet' in rec).toBe(false);
    });
    it('hamtaData är hela datan, och tillståndet har inget enhetsfilter', () => {
        const w = createAppWindow();
        w.__lasInDemodata();
        expect(w.document.getElementById('enhet-select')).toBeNull();
        expect(w.__hamtaData()).toBe(w.__state.data);
        expect('activeEnhet' in w.__state).toBe(false);
        expect(w.__state.data.every(r => !('enhet' in r))).toBe(true);
    });
});

describe('Lika arbete och filrutorna: ordning och kompakta rutor — filrutorna', () => {
    it('efter inläsning syns alla tre filrutorna, lönefilens kompakt, och bara ett dataskyddsbesked', () => {
        const w = createAppWindow();
        const d = w.document;
        expect(d.querySelector('.gdpr-info-compact').hidden).toBe(false);
        w.__lasInDemodata();
        expect(d.getElementById('upload-row').style.display).toBe('');
        expect(d.getElementById('upload-collapsed-bar')).toBeNull();
        expect(d.getElementById('btn-toggle-upload')).toBeNull();
        const data = d.getElementById('upload-cell-data');
        expect(data.classList.contains('loaded')).toBe(true);
        const inlast = data.querySelector('.upload-inlast');
        expect(inlast.hidden).toBe(false);
        expect(inlast.textContent).toMatch(/Demodata/);
        expect(d.getElementById('org-namn').value).toBe('Exempelkommunen');
        expect([...inlast.querySelectorAll('button')].map(b => b.textContent.trim())).toEqual(['Byt fil', 'Kolumnmappning']);
        for (const id of ['upload-cell-policy', 'upload-cell-stat']) {
            const c = d.getElementById(id);
            expect(c.hidden).toBe(false);
            expect(c.closest('#upload-row')).not.toBeNull();
        }
        expect(d.querySelector('.gdpr-info-compact').hidden).toBe(true);
        expect(d.getElementById('gdpr-banner').style.display).toBe('inline-flex');
        w.__rensaAllData();
        expect(data.classList.contains('loaded')).toBe(false);
        expect(data.querySelector('.upload-inlast').hidden).toBe(true);
        expect(d.querySelector('.gdpr-info-compact').hidden).toBe(false);
    });
    it('en inläst lönefil visar filnamnet; Byt fil öppnar filväljaren; misslyckat byte behåller statusen', async () => {
        const { readFileSync } = await import('node:fs');
        const { join, dirname } = await import('node:path');
        const { fileURLToPath } = await import('node:url');
        const w = createAppWindow();
        w.eval(readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'vendor', 'papaparse.min.js'), 'utf8'));
        const rader = ['BAS;Månadslön;Ålder;Kön;AID'];
        for (let i = 0; i < 20; i++) rader.push(`A;${30000 + i};40;${i % 2 ? 'Man' : 'Kvinna'};5301`);
        w.lasInStrukturfil(new w.File([rader.join('\n')], 'lonefil_2026.csv', { type: 'text/csv' }));
        for (let i = 0; i < 100 && !w.__state.data.length; i++) await new Promise(r => setTimeout(r, 20));
        await new Promise(r => setTimeout(r, 50));
        const cell = w.document.getElementById('upload-cell-data');
        expect(cell.querySelector('.upload-filnamn').textContent).toMatch(/lonefil_2026\.csv/);
        let klickad = false;
        w.document.getElementById('file-input-data').click = () => { klickad = true; };
        cell.querySelector('[data-byt-fil]').click();
        expect(klickad).toBe(true);
        w.lasInStrukturfil(new w.File([new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])], 'arbetsbok.xls'));
        await new Promise(r => setTimeout(r, 100));
        expect(cell.classList.contains('loaded')).toBe(true);
        expect(cell.querySelector('.upload-filnamn').textContent).toMatch(/lonefil_2026\.csv/);
    });
    it('ställningstagande och statistik: kompakta med namnfält; Ta bort referensen återställer rutan', () => {
        const w = createAppWindow();
        w.__lasInDemodata();
        w.eval("_lasInReferens([{ bas: 'C', p10: 30000, med: 34000, p90: 39000 }], 'lonepolitik_2026.csv'); markeraFilrutaInlast('upload-cell-policy', 'Inläst');");
        w.__state.filnamn.policy = 'lonepolitik_2026.csv';
        w.eval('ritaFilrutor()');
        const pol = w.document.getElementById('upload-cell-policy');
        expect(pol.classList.contains('loaded')).toBe(true);
        expect(pol.querySelector('.upload-filnamn').textContent).toMatch(/lonepolitik_2026\.csv/);
        expect(w.document.getElementById('referens-namn-rad').hidden).toBe(false);
        expect(w.document.getElementById('referens-namn').value).toBe('lonepolitik_2026');   // namngiven efter filen
        w.document.getElementById('btn-referens-aterga').click();
        expect(pol.classList.contains('loaded')).toBe(false);
        expect(pol.querySelector('.upload-inlast').hidden).toBe(true);
        const stat = w.document.getElementById('upload-cell-stat');
        const jmf = w.document.getElementById('jmf-namn');
        expect(jmf).not.toBeNull();
        jmf.value = 'Regionstatistiken'; jmf.dispatchEvent(new w.Event('change'));
        expect(w.eval('jmfNamn()')).toBe('Regionstatistiken');
        expect(stat.querySelector('.upload-namn-fel').hidden).toBe(true);
    });
    it('demots ställningstagande visas kompakt; paketrutan står först, med förklaringen hopfälld, och visar organisationstypen', () => {
        const w = createAppWindow();
        const d = w.document;
        const paket = d.getElementById('organisationspaket');
        expect(paket.querySelector('.paket-huvud').textContent).toMatch(/Steg 1/);
        expect(paket.compareDocumentPosition(d.getElementById('upload-row')) & 4).toBeTruthy();
        // Knappen syns; förklaringen står bakom Vad är ett organisationspaket?, och sist i steget pekar en rad till
        // fliken För systemförvaltaren, där formuläret står.
        expect(paket.querySelector('label.btn #file-input-paket')).not.toBeNull();
        const vad = d.getElementById('paket-vad');
        expect(vad.open).toBe(false);
        expect(vad.querySelector('summary').textContent.trim()).toBe('Vad är ett organisationspaket?');
        expect(vad.textContent).toMatch(/Systemförvaltaren skapar det/);
        expect(d.getElementById('paket-skapa')).toBeNull();
        expect([...paket.children].pop().querySelector('[data-go-to-tab="forvaltare"]')).not.toBeNull();
        w.__lasInDemodata();
        const pol = d.getElementById('upload-cell-policy');
        expect(pol.classList.contains('loaded')).toBe(true);
        expect(pol.querySelector('.upload-filnamn').textContent).toMatch(/Demots ställningstagande/);
        expect(d.querySelector('#organisationspaket .paket-lage').textContent).toMatch(/Organisationen är: en kommun/);
        w.__rensaAllData();
        expect(pol.classList.contains('loaded')).toBe(false);
    });
    it('startytan har de två demovalen bredvid ytan för lönefilen (stort och litet demo)', () => {
        const w = createAppWindow();
        const d = w.document;
        expect(d.getElementById('btn-try-demo')).toBeNull();
        expect(d.getElementById('btn-minimize-upload')).toBeNull();
        const text = d.querySelector('#first-run-hint .ov-start-demo p').textContent.replace(/\s+/g, ' ').trim();
        expect(text).toBe('Prova med demodata, stort demo (5 000 personer) eller litet demo.');
        expect(d.querySelector('#first-run-hint .ov-start-demo h3').textContent).toBe('Ingen fil till hands?');
        // Rubriken har sitt mellanslag (tidigare "Kom igång:läs").
        expect(d.getElementById('ov-start-rubrik').textContent).toBe('Kom igång');
        expect(d.getElementById('first-run-hint').textContent).not.toMatch(/:\S/);
        expect(d.getElementById('first-run-demo-link').textContent).toBe('litet demo');
        // Lönefilskortet i Filer och kvalitet har samma ord för samma val.
        const kort = d.getElementById('upload-demo-val').textContent.replace(/\s+/g, ' ').trim();
        expect(kort).toBe('Ingen fil till hands? Prova med demodata, stort demo (5 000 personer) eller litet demo.');
        expect(d.getElementById('upload-demo-litet').textContent).toBe(d.getElementById('first-run-demo-link').textContent);
        expect(d.getElementById('upload-demo-stort').textContent).toBe(d.getElementById('first-run-stort-demo').textContent);
        d.getElementById('first-run-demo-link').click();
        expect(w.__state.data.length).toBeGreaterThan(0);
    });
});

describe('lönefil vars kolumner inte känns igen', () => {
    const lasIn = async rader => {
        const w = createAppWindow();
        papa(w);
        w.lasInStrukturfil(csvFil(w, rader));
        await vanta(() => w.document.getElementById('column-map-panel')?.innerHTML);
        return w;
    };
    it('märks inte som inläst, och flikarna förblir låsta', async () => {
        const w = await lasIn(okandaRader());
        const d = w.document;
        expect(w.__state.data.length).toBe(0);
        expect(d.getElementById('tab-matrix').disabled).toBe(true);
        const marke = d.querySelector('#upload-cell-data .upload-badge');
        expect(marke.textContent).toContain('Kolumnmappning');
        expect(marke.textContent).not.toContain('Inläst');
        expect(marke.classList.contains('loaded')).toBe(false);
        expect(d.getElementById('upload-cell-data').classList.contains('loaded')).toBe(false);
        expect(d.getElementById('data-status').className).toBe('status-msg warning');
        expect(d.getElementById('dashboard-summary').style.display).not.toBe('grid');
    });
    it('panelen säger vilka rubriker filen hade, och fokus hamnar i första fältet som saknar kolumn', async () => {
        const w = await lasIn(okandaRader());
        const panel = w.document.getElementById('column-map-panel');
        expect(panel.textContent).toContain('Kolumnmappning behövs');
        for (const r of ['Avd', 'Befattning', 'Grundlon', 'Fodd', 'Sex']) expect(panel.querySelector('.colmap-rubriker').textContent).toContain(r);
        expect(w.document.activeElement.getAttribute('data-colmap-role')).toBe('bas');
    });
    it('efter mappningen läses filen in och flikarna låses upp', async () => {
        const w = await lasIn(okandaRader().map((r, i) => i ? r.replace(/^X;/, 'C;').replace(/;K$/, ';Kvinna').replace(/;M$/, ';Man').replace('Handläggare', '207011') : r));
        const satt = (roll, v) => { w.document.querySelector(`[data-colmap-role="${roll}"]`).value = v; };
        satt('bas', 'Avd'); satt('yrke', 'Befattning'); satt('lon', 'Grundlon'); satt('alder', 'Fodd'); satt('kon', 'Sex');
        w.document.getElementById('colmap-apply').click();
        await vanta(() => w.__state.data.length);
        expect(w.__state.data.length).toBe(30);
        expect(w.document.getElementById('tab-matrix').disabled).toBe(false);
        expect(w.document.querySelector('#upload-cell-data .upload-badge').textContent).toContain('Inläst');
    });
    it('ett tidigare inläst underlag ligger kvar när nästa fil inte går att läsa', async () => {
        const w = await lasIn(braRader());
        await vanta(() => w.__state.data.length);
        w.lasInStrukturfil(csvFil(w, okandaRader(), 'okand.csv'));
        await vanta(() => /Kolumnmappning behövs/.test(w.document.getElementById('column-map-panel').textContent));
        expect(w.__state.data.length).toBe(30);
        expect(w.document.getElementById('tab-matrix').disabled).toBe(false);
        expect(w.document.getElementById('data-status').textContent).toContain('ligger kvar');
    });
    it('en fil med igenkända kolumner men utan användbara rader märks inte som inläst', async () => {
        const w = await lasIn(['BAS;Månadslön;Ålder;Kön;AID', 'C;0;40;Kvinna;207011', 'C;0;41;Man;207011']);
        await vanta(() => w.document.getElementById('data-status').textContent);
        expect(w.document.getElementById('tab-matrix').disabled).toBe(true);
        expect(w.document.querySelector('#upload-cell-data .upload-badge').textContent).toContain('Inga rader');
        expect(w.document.getElementById('data-status').textContent).toContain('2 rader utan lön');
    });
});

describe('sortering, Att göra, kopiering och Likvärdigt arbete — inläsning', () => {
    it('CSV med bara CR som radslut och en försättsrad: rubriken hittas och radnumren stämmer', async () => {
        const { readFileSync } = await import('node:fs');
        const { join, dirname } = await import('node:path');
        const { fileURLToPath } = await import('node:url');
        const w = createAppWindow();
        w.eval(readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'vendor', 'papaparse.min.js'), 'utf8'));
        const rader = ['Lönerapport september', 'BAS;Månadslön;Ålder;Kön;AID', 'A;30000;40;Kvinna;5301', 'A;31000;41;Man;5301'];
        w.lasInStrukturfil(new w.File([rader.join('\r')], 'p.csv', { type: 'text/csv' }));
        for (let i = 0; i < 100 && !w.__state.data.length; i++) await new Promise(r => setTimeout(r, 20));
        expect(w.__state.data.map(r => r.radnr)).toEqual([3, 4]);
    });
});

describe('Jämförelsestatistik, Översikt och namn: detaljer — inläsning', () => {
    const vendor = async (w, fil) => {
        const { readFileSync } = await import('node:fs');
        const { join, dirname } = await import('node:path');
        const { fileURLToPath } = await import('node:url');
        w.eval(readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'vendor', fil), 'utf8'));
    };
    it('ett misslyckat Byt fil pekar inte om kolumnmappningen till den avvisade filen', async () => {
        const w = createAppWindow();
        await vendor(w, 'papaparse.min.js');
        const rader = ['BAS;Månadslön;Ålder;Kön;AID'];
        for (let i = 0; i < 20; i++) rader.push(`A;${30000 + i};40;${i % 2 ? 'Man' : 'Kvinna'};5301`);
        w.lasInStrukturfil(new w.File([rader.join('\n')], 'bra.csv', { type: 'text/csv' }));
        for (let i = 0; i < 100 && !w.__state.data.length; i++) await new Promise(r => setTimeout(r, 20));
        w.lasInStrukturfil(new w.File([new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])], 'arbetsbok.xls'));
        await new Promise(r => setTimeout(r, 100));
        expect(w.__state._lastStructureFile.name).toBe('bra.csv');
    });
});

// ---- Adaptrarna i appen: tillståndet och klockan (reglerna prövas i tests/inlasning.test.js) ----
describe('minimeraLonerad i appen', () => {
    it('tolkar födelseår i ålderskolumnen som ålder', () => {
        const w = createAppWindow();
        const rec = w.eval(`minimeraLonerad({ 'BAS': 'A', 'Månadslön': '30000', 'Ålder': '1980', 'Kön': 'Kvinna', 'AID': '5301' })`);
        const expectedAge = new Date().getFullYear() - 1980;
        expect(rec.alder).toBe(expectedAge);
        expect(rec._alderStatus).toBe('birthyear');
    });
});

describe('inläsning i appen: lönefil utan ålderskolumn', () => {
    it('filen med bara BAS, AID, lön och kön läses in med alla rader, utan kolumnmappning', async () => {
        const w = createAppWindow();
        papa(w);
        const rader = ['BAS;AID;Månadslön;Kön'];
        for (let i = 0; i < 40; i++) rader.push(`${i % 2 ? 'C' : 'D'};207011 Handläggare;${30000 + i * 10};${i % 4 < 2 ? 'Man' : 'Kvinna'}`);
        w.lasInStrukturfil(csvFil(w, rader, 'utan-alder.csv'));
        await vanta(() => w.__state.data.length > 0);
        expect(w.__state.data).toHaveLength(40);
        expect(w.__state.data.every(r => r.alder === 0)).toBe(true);
        expect(w.eval('harAlder()')).toBe(false);
        expect(w.eval('_kolumnerSomSaknas(state._dataHeaders)')).toEqual([]);
        expect(w.document.getElementById('column-map-panel').textContent).not.toContain('Kolumnmappning behövs');
        expect(w.__state.forhandskontroll.varningar.map(v => v.kod)).toContain('alder-saknas');
        expect(w.document.getElementById('forhandskontroll').textContent).toContain('Ålder saknas: analysen körs utan åldersjustering; Ålder & karriär visas inte.');
    });
});

describe('inläsning i appen: kolumnvalet', () => {
    // Samma tabell med två kolumner som heter Lön: CSV-läsaren behåller den första och döper om den andra till Lön_1.
    const tabell = () => {
        const t = [['Kön', 'Lön', 'BAS', 'AID', 'Lön']];
        for (let i = 0; i < 40; i++) t.push([i % 2 ? 'Man' : 'Kvinna', String(30000 + i * 10), 'C', '207011 Handläggare', '500']);
        return t;
    };
    const lasIn = async (w, fil) => {
        w.lasInStrukturfil(fil);
        await vanta(() => w.__state.data.length > 0);
        return w.__state.data.map(r => r.lon);
    };
    it('dubbla rubriker: CSV och Excel tar lönen ur samma kolumn', async () => {
        const wCsv = createAppWindow();
        papa(wCsv);
        const csv = await lasIn(wCsv, csvFil(wCsv, tabell().map(r => r.join(';')), 'dubbla.csv'));
        const wX = createAppWindow();
        wX.eval(readFileSync(join(import.meta.dirname, '..', 'vendor', 'xlsx.mini.min.js'), 'utf8'));
        const X = wX.XLSX, wb = X.utils.book_new();
        X.utils.book_append_sheet(wb, X.utils.aoa_to_sheet(tabell()), 'Blad1');
        const xlsx = await lasIn(wX, new wX.File([X.write(wb, { type: 'array', bookType: 'xlsx' })], 'dubbla.xlsx'));
        expect(csv).toHaveLength(40);
        expect(csv[0]).toBe(30000);
        expect(xlsx).toEqual(csv);
        expect(wX.__state._dataHeaders).toEqual(['Kön', 'Lön', 'BAS', 'AID', 'Lön_1']);
    });

    it('ett uppblåst område i Excelbladet (en blank cell i XFD1048576) låser inte inläsningen', async () => {
        const wX = createAppWindow();
        wX.eval(readFileSync(join(import.meta.dirname, '..', 'vendor', 'xlsx.mini.min.js'), 'utf8'));
        const X = wX.XLSX, wb = X.utils.book_new();
        X.utils.book_append_sheet(wb, X.utils.aoa_to_sheet(tabell()), 'Blad1');
        const fil = new wX.File([X.write(wb, { type: 'array', bookType: 'xlsx' })], 'uppblast.xlsx');
        // Bladet som en sådan fil läses till (att skriva den tar själv lika lång tid som tabellen över området).
        const ws = X.utils.aoa_to_sheet(tabell());
        ws.XFD1048576 = { t: 's', v: ' ' };
        ws['!ref'] = 'A1:XFD1048576';
        X.read = () => ({ SheetNames: ['Blad1'], Sheets: { Blad1: ws } });
        const loner = await lasIn(wX, fil);
        expect(loner).toHaveLength(40);
        expect(wX.__state._dataHeaders).toEqual(['Kön', 'Lön', 'BAS', 'AID', 'Lön_1']);
    }, 20000);

    it('kolumnerna slås upp en gång per fil, inte för varje rad', async () => {
        const w = createAppWindow();
        papa(w);
        const original = w.hamtaFalt;
        let anrop = 0;
        w.hamtaFalt = (...a) => { anrop++; return original(...a); };
        const rader = ['BAS;AID;Månadslön;Ålder;Kön'];
        for (let i = 0; i < 40; i++) rader.push(`C;207011 Handläggare;${30000 + i * 10};40;${i % 2 ? 'Man' : 'Kvinna'}`);
        w.lasInStrukturfil(csvFil(w, rader, 'uppslag.csv'));
        await vanta(() => w.__state.data.length > 0);
        expect(w.__state.data).toHaveLength(40);
        expect(anrop).toBe(0);
    });
});

describe('ett oväntat fel under inläsningen', () => {
    it('döljer laddningsrutan, behåller underlaget och visar felbannern', async () => {
        const w = createAppWindow();
        papa(w);
        w.Papa.parse = () => { throw new Error('oväntat'); };
        const ruta = w.document.getElementById('loading-overlay');
        const banner = w.document.getElementById('internt-fel-banner');
        w.lasInStrukturfil(csvFil(w, braRader()));
        expect(ruta.style.display).toBe('flex');
        await vanta(() => !banner.hidden);
        expect(ruta.style.display).toBe('none');
        expect(w.__state.data.length).toBe(0);
        expect(w.document.getElementById('data-status').textContent).toContain('ett internt fel avbröt inläsningen');
    });
});

// Vyer som ritas med diagramkärnan (ADR-39): den gemensamma bildvägen och varje vys figur.
// Delen här: bildvägen, flikarnas figurer, Utforska, länkade vyer och tangentbordet; resten i
// diagramvyer-marken.test.js (riggen i helpers/diagramvyer-rigg.js).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { valideraFigur, figurTillTabell } from '../src/lib/figur.js';
import { createAppWindow } from './helpers/app-harness.js';
import { vanliga, figurMedLiten, person, skapaRigg } from './helpers/diagramvyer-rigg.js';

const { w, behallare, utdata, medData } = skapaRigg();

describe('diagramRitat och diagramTillBild', () => {
    it('diagramRitat: sant för ett ritat diagram, falskt för tomt, helt litet, rensat och för ett element utan figur', () => {
        const el = behallare('chart-bildvag');
        w.__el = el; w.__f = figurMedLiten();
        expect(w.eval('diagramRitat(window.__el)')).toBe(false);
        w.eval('ritaFigur(window.__el, window.__f, {})');
        expect(w.eval('diagramRitat(window.__el)')).toBe(true);
        w.__f = { ...figurMedLiten(), lager: [{ marke: 'stapel', serie: 'S', data: [{ x: 'HEMLIG', y: 77777, liten: true }] }] };
        w.eval('ritaFigur(window.__el, window.__f, {})');
        expect(w.eval('diagramRitat(window.__el)')).toBe(false);
        w.eval('rensaFigur(window.__el)');
        expect(w.eval('diagramRitat(window.__el)')).toBe(false);
        expect(w.eval('diagramRitat({ data: [{ x: [1] }] })')).toBe(false);   // data/layout utan figur räknas inte
        expect(w.eval('diagramRitat({ data: [] })')).toBe(false);
        expect(w.eval('diagramRitat(null)')).toBe(false);
    });
    it('kärnans diagram: bilden ritas ur figuren utan små grupper, i begärd storlek', async () => {
        const el = behallare('chart-bildvag');
        w.__el = el; w.__f = figurMedLiten();
        w.eval('ritaFigur(window.__el, window.__f, {})');
        const org = w.figurTillBild, sedda = [];
        w.figurTillBild = (figur, format, b, h, val) => { sedda.push({ svg: w.figurTillSvg(figur, b, h, val), format, b, h }); return Promise.resolve('data:image/png;base64,AAAA'); };
        try {
            expect(await w.eval('diagramTillBild(window.__el, { bredd: 1600, hojd: 900 })')).toBe('data:image/png;base64,AAAA');
        } finally { w.figurTillBild = org; }
        expect(sedda).toHaveLength(1);
        expect([sedda[0].format, sedda[0].b, sedda[0].h]).toEqual(['png', 1600, 900]);
        expect(sedda[0].svg).not.toMatch(/HEMLIG|77\s?777/);
        expect(sedda[0].svg).toContain('>A<');
        w.eval('rensaFigur(window.__el)');
    });
    it('inget ritat: bildvägen avvisar, också för ett element som bara bär data och layout', async () => {
        await expect(w.eval('diagramTillBild({ data: [{ x: [1], y: [2] }], layout: {} }, { bredd: 10, hojd: 10 })')).rejects.toThrow(/inget att exportera/);
        await expect(w.eval('diagramTillBild(document.createElement("div"), { bredd: 10, hojd: 10 })')).rejects.toThrow(/inget att exportera/);
    });
    it('utskriften får bilden utan rubrik och fotrad; övriga får dem', async () => {
        const el = behallare('chart-bildvag');
        w.__el = el; w.__f = figurMedLiten();
        w.eval('ritaFigur(window.__el, window.__f, {})');
        const org = w.figurTillBild, sedda = [];
        w.figurTillBild = (figur, format, b, h, val) => { sedda.push(val); return Promise.resolve('data:image/png;base64,AAAA'); };
        try {
            await w.eval('diagramTillBild(window.__el, { bredd: 1400, hojd: 600, utanRubrik: true })');
            await w.eval('diagramTillBild(window.__el, { bredd: 1600, hojd: 900 })');
        } finally { w.figurTillBild = org; }
        expect([sedda[0].rubrik, sedda[0].fot]).toEqual([undefined, undefined]);
        expect(sedda[1].rubrik).toBeTruthy();
        expect(sedda[1].fot).toMatch(/^Lönekartläggning \d{4}-\d{2}-\d{2}/);
        w.eval('rensaFigur(window.__el)');
    });
});


describe('Lönepolitik: chart-lp-gender och chart-lp-compliance', () => {
    it('chart-lp-gender: kvinnor och män som två punkter på spannet (0 = P10, 100 = P90), samma tal som modellen', () => {
        const f = w.eval(`_lpFigurKonHantel([{ bas: '5', genderGap: { kvPos: 0.412, maPos: 0.503 } }, { bas: '7', genderGap: { kvPos: 0.6, maPos: 0.55 } }])`);
        expect(f.lager.map(l => [l.marke, l.serie, l.farg])).toEqual([['intervall', 'Policyns spann', '#d5dae3'], ['intervall', 'Skillnad', '#64748b'], ['punkt', 'Kvinnor', '#833a8f'], ['punkt', 'Män', '#5f7f16']]);
        expect(f.lager[0].data).toEqual([{ y: 'BAS 5', lag: 0, hog: 100 }, { y: 'BAS 7', lag: 0, hog: 100 }]);    // banan är hela spannet
        expect(f.lager[1].data).toEqual([{ y: 'BAS 5', lag: 41.2, hog: 50.3 }, { y: 'BAS 7', lag: 55, hog: 60 }]);
        expect(f.lager[2].data).toEqual([{ y: 'BAS 5', x: 41.2, markering: ['bas:5'] }, { y: 'BAS 7', x: 60, markering: ['bas:7'] }]);
        expect(f.lager[3].data).toEqual([{ y: 'BAS 5', x: 50.3, markering: ['bas:5'] }, { y: 'BAS 7', x: 55, markering: ['bas:7'] }]);
        expect(f.x.doman).toEqual([-4, 104]);                                    // hela spannet syns alltid
        expect(f.lager[2].tips(f.lager[2].data[0])).toEqual([['BAS 5'], ['Kvinnor', '41,2 % in i spannet']]);
        expect(() => valideraFigur(f, 't')).not.toThrow();
    });
    it('chart-lp-compliance: staplat till 100 %, tre serier i ordningen under, inom, över', () => {
        const f = w.eval(`_lpFigurKomplians([{ bas: '5', n: 40, compliance: { under: 4, within: 30, over: 6, n: 40 } }])`);
        expect(f.lager.map(l => [l.serie, l.farg])).toEqual([['Under P10', '#c2552d'], ['Inom spann', '#d5dae3'], ['Över P90', '#2a78d6']]);   // två nyanser kring neutralt, inte rött och grönt
        expect(f.lager.every(l => l.lage === 'staplad')).toBe(true);
        expect(f.lager.map(l => l.data[0].y)).toEqual([10, 75, 15]);
        expect(f.y.doman).toEqual([0, 100]);
        expect(() => valideraFigur(f, 't')).not.toThrow();
    });
    it('ritas av kärnan (i exportläget): bara BAS över tröskeln i diagram, export och diagramdata; noten ligger efter behållaren', () => {
        const data = [...Array.from({ length: 14 }, (_, i) => person('A', i % 2 ? 'kvinna' : 'man', 26000 + i * 500)),
                      ...Array.from({ length: 6 }, (_, i) => person('B', i % 2 ? 'kvinna' : 'man', 61111 + i))];
        medData(data, [{ bas: 'A', p10: 25000, med: 30000, p90: 40000 }, { bas: 'B', p10: 25000, med: 30000, p90: 40000 }], () => {
            w.__state.kLage = 'export';
            w.__renderLonepolitik();
            const el = w.document.getElementById('chart-lp-compliance');
            expect(el.querySelector(':scope > svg[role="group"]').getAttribute('aria-label')).toMatch(/Andel medarbetare/);
            expect(el.data).toBeUndefined();                                        // figuren ligger i _figur
            expect(el._figur.lager[0].data.map(d => d.x)).toEqual(['BAS A']);
            expect(utdata(el)).not.toMatch(/BAS B|61\s?11\d/);
            const not = el.nextElementSibling;
            expect(not.getAttribute('data-lp-not')).toBe('komplians');
            expect(not.textContent).toContain('BAS B');
            expect(el.querySelector('[data-lp-not]')).toBeNull();
            w.__renderLonepolitik();                                                // omritning: en not, inte två
            expect(w.document.querySelectorAll('[data-lp-not="komplians"]')).toHaveLength(1);
        });
    });
    it('alla BAS under tröskeln, och tröskeln höjd med fliken ritad: vyns text, ingen figur kvar, inget att exportera', () => {
        const data = Array.from({ length: 14 }, (_, i) => person('A', i % 2 ? 'kvinna' : 'man', 26000 + i * 500));
        medData(data, [{ bas: 'A', p10: 25000, med: 30000, p90: 40000 }], () => {
            w.__renderLonepolitik();
            const el = w.document.getElementById('chart-lp-compliance'), kon = w.document.getElementById('chart-lp-gender');
            expect(el._figur).toBeDefined();
            w.eval('sattKTroskel(20, { fraga: false })');
            w.__renderLonepolitik();
            const el2 = w.document.getElementById('chart-lp-compliance');
            expect(el2._figur).toBeUndefined();
            expect(el2.textContent).toMatch(/färre än 20 personer/);
            expect(el2.querySelector('svg')).toBeNull();
            expect(w.eval('diagramRitat(document.getElementById("chart-lp-compliance"))')).toBe(false);
            expect(w.document.getElementById('chart-lp-gender').textContent).toMatch(/minst 20 av varje kön/);
            expect(kon.isConnected ? kon._figur : undefined).toBeUndefined();
        });
    });
});

describe('Struktur: chart-sektorer', () => {
    it('rå och justerad som punkter per sektor, referenslinje vid 100, axeln ur de visade värdena', () => {
        const f = w.eval(`_sektorFigur([{ namn: 'Vård och omsorg', kvot: 96.4, justerat: { pct: -1.2 } }, { namn: 'Teknik', kvot: 101.3, justerat: null }])`);
        expect([f.x.skala, f.y.skala]).toEqual(['linjar', 'band']);
        expect(f.lager.map(l => [l.marke, l.serie, l.farg])).toEqual([['intervall', 'Förklaras av ålder och BAS', '#64748b'], ['punkt', 'Rå', '#64748b'], ['punkt', 'Justerad (ålder, BAS)', '#2a78d6']]);
        expect(f.lager[0].data).toEqual([{ y: 'Vård och omsorg', lag: 96.4, hog: 98.8, ra: 96.4, ju: 98.8 }]);   // strecket från rå till justerad; inget utan justerat värde
        expect(f.lager[0].legend).toBe(false);
        expect(f.lager[1].data).toEqual([{ y: 'Vård och omsorg', x: 96.4, forskjutning: 0 }, { y: 'Teknik', x: 101.3, forskjutning: 0 }]);
        expect(f.lager[2].data).toEqual([{ y: 'Vård och omsorg', x: 98.8, forskjutning: 0 }]);      // ingen punkt utan justerat värde
        expect(f.referens).toEqual([{ x: 100, streck: 'prickad', farg: '#64748b', etikett: 'Lika lön' }]);
        expect(f.x.doman).toEqual([90, 104]);
        expect(f.y.ordning).toEqual(['Vård och omsorg', 'Teknik']);
        expect(f.y.etikettMax).toBe(64);
        expect(f.lager[2].tips(f.lager[2].data[0])).toEqual([['Vård och omsorg'], ['Justerad (ålder, BAS)', '98,8 %']]);
        expect(() => valideraFigur(f, 't')).not.toThrow();
    });
    it('ritas av kärnan med demodatan: en punkt per sektor och serie, inga staplar, talen i tips stämmer med tabellen', () => {
        const w2 = createAppWindow();
        w2.__loadDemoData();
        w2.__renderTabContent('struktur');
        const el = w2.document.getElementById('chart-sektorer');
        expect(el.data).toBeUndefined();
        expect(el.querySelectorAll('[data-marke="punkt"]').length).toBe(el._figur.lager[0].data.length + el._figur.lager[1].data.length);
        expect(el.querySelector('[data-marke="stapel"]')).toBeNull();
        expect(el.querySelector('[data-marke="referenslinje"]')).not.toBeNull();
        const tabell = [...w2.document.querySelectorAll('#sektor-table tbody tr')].map(tr => tr.querySelector('.sektor-namn').textContent.trim());
        expect(el._figur.y.ordning.every(n => tabell.includes(n))).toBe(true);
    });
    it('ett långt sektornamn på smal skärm: ingen text utanför bilden, hela namnet i <title>', () => {
        const langt = 'Förskole-, skol-, fritids- och annan pedagogisk verksamhet i kommunen';
        w.__f = w.eval(`_sektorFigur([{ namn: ${JSON.stringify(langt)}, kvot: 95, justerat: null }, { namn: 'Teknik', kvot: 101, justerat: null }])`);
        const svg = w.eval('_rfByggSvg(window.__f, 320, {})');
        const etiketter = [...svg.querySelectorAll('text[data-axel="y"]')];
        expect(etiketter.some(t => t.querySelector('title') && t.querySelector('title').textContent === langt)).toBe(true);
        // Etiketten är avkortad (ritaren räknar bredden ur teckenantalet och håller all text inom bilden).
        const kort = etiketter.find(t => t.querySelector('title')).firstChild.textContent;
        expect(kort.length).toBeLessThan(langt.length);
        expect(kort).toMatch(/…$/);
        expect(svg.outerHTML).not.toContain('rotate(');
    });
});

describe('Struktur: sammanfattningens mening om vertikal könssegregering', () => {
    // representationByBas sorterar BAS A–Ö: första BAS:et är lägst värderat, sista högst (teknisk-plan §9 punkt 24).
    const text = (andelKvA, andelKvJ) => {
        const win = createAppWindow();
        const rad = (bas, kon, lon) => ({ bas, kon, lon, alder: 40, yrke: '6000 Yrke', aid: '6000', yrkeLabel: 'Yrke', enhet: '' });
        const r = [];
        for (let i = 0; i < 40; i++) r.push(rad('A', i < 40 * andelKvA / 100 ? 'kvinna' : 'man', 25000 + i));
        for (let i = 0; i < 40; i++) r.push(rad('E', i < 20 ? 'kvinna' : 'man', 35000 + i));
        for (let i = 0; i < 40; i++) r.push(rad('J', i < 40 * andelKvJ / 100 ? 'kvinna' : 'man', 60000 + i));
        win.__state.data = r;
        win.eval('populateSelects(); unlockTabs();');
        win.__renderTabContent('struktur');
        return win.document.getElementById('struktur-narrative').value.split('\n').find(l => l.startsWith('Vertikal könssegregering'));
    };
    it('hög kvinnoandel i BAS A och låg i BAS J: A kallas lägre betalda och J högre betalda', () => {
        const seg = text(80, 20);
        expect(seg).toBeDefined();
        expect(seg).toMatch(/andelen kvinnor är högre i lägre betalda BAS \(A: 80 %\) än i högre betalda \(J: 20 %\)/);
    });
    it('det omvända fallet (fler kvinnor i BAS J än i BAS A) ger ingen mening', () => {
        expect(text(20, 80)).toBeUndefined();
    });
    it('en liten skillnad (under 15 procentenheter) ger ingen mening', () => {
        expect(text(50, 40)).toBeUndefined();
    });
});

describe('Lika arbete: chart-skevhet-overview och chart-perbas-gap', () => {
    it('chart-skevhet-overview: punkt med intervall mot 100 %; status är serie med egen symbol; tal, etikett och KI oförändrade', () => {
        const f = w.eval(`_skevhetFigur([{ bas: '3', gap: 93.44, n: 40, ci: { lo: 90.1, hi: 96.9 } }, { bas: '5', gap: 96.2, n: 55, ci: { lo: 94, hi: 98.5 } },
                                         { bas: '7', gap: 99.1, n: 61, ci: null }])`);
        expect(f.lager.map(l => [l.serie, l.farg, l.symbol])).toEqual(
            [['Avviker mer än 5 %', '#b91c1c', 'romb'], ['Avviker 3–5 %', '#d97706', 'kvadrat'], ['Inom 3 %', '#0f766e', 'cirkel']]);
        expect(f.lager.every(l => l.marke === 'punkt' && l.riktning === 'liggande' && !l.monster)).toBe(true);   // ingen stapel från en avkortad axel
        expect(f.lager[0].data).toEqual([{ y: 'BAS 3', x: 93.4, etikett: '93,4 %', n: 40, markering: ['bas:3'], fel: { lag: 90.1, hog: 96.9 } }]);
        expect(f.lager[2].data[0].fel).toBeUndefined();
        expect(f.y.ordning).toEqual(['BAS 3', 'BAS 5', 'BAS 7']);                 // BAS-ordningen, inte statusordningen
        expect(f.referens).toEqual([expect.objectContaining({ typ: 'zon', x0: 95, x1: 105 }), expect.objectContaining({ x: 100 })]);
        expect(f.x.doman).toEqual([88, 112]);                                     // 100 inom axeln, med intervallens ändar
        expect(f.lager[0].tips(f.lager[0].data[0])).toEqual([['BAS 3'], ['Kvinnors median', '93,4 % av männens'], ['95 % KI', '90,1–96,9 %'], ['Antal', '40']]);
        expect(() => valideraFigur(f, 't')).not.toThrow();
    });
    it('chart-skevhet-overview: en status utan punkter får inget lager (ingen tom post i förklaringen)', () => {
        const f = w.eval(`_skevhetFigur([{ bas: '7', gap: 99.1, n: 61, ci: null }])`);
        expect(f.lager.map(l => l.serie)).toEqual(['Inom 3 %']);
    });
    it('chart-perbas-gap: punkt med intervall, liggande, i given ordning, KI som fel, nollinje, status som serie med symbol', () => {
        const f = w.eval(`_perBasFigur([{ bas: '3', gapPct: -6.214, ciLow: -9, ciHigh: -3.4, pValue: 0.001, n: 40, kvN: 22, maN: 18 },
                                        { bas: '4', gapPct: -2.5, ciLow: -4.5, ciHigh: -0.5, pValue: 0.01, n: 44, kvN: 20, maN: 24 },
                                        { bas: '5', gapPct: 0.8, ciLow: -1, ciHigh: 2.6, pValue: 0.4, n: 50, kvN: 25, maN: 25 }], { 4: 0.2 })`);
        expect(f.lager.every(l => l.marke === 'punkt' && l.riktning === 'liggande' && !l.monster)).toBe(true);
        expect(f.y.ordning).toEqual(['BAS 3', 'BAS 4', 'BAS 5']);
        expect(f.x.nollinje).toBe(true);
        expect(f.x.doman).toEqual([-10, 3.5]);                                    // noll inom axeln, luft på båda sidor
        expect(f.lager.map(l => [l.serie, l.symbol, l.data.map(d => d.y)])).toEqual(
            [['Säkerställt, över 5 %', 'romb', ['BAS 3']], ['Inte säkerställt', 'cirkel', ['BAS 4', 'BAS 5']]]);   // BAS 4: q ≥ 0,05 efter korrigering
        expect(f.lager[0].data[0]).toEqual({ y: 'BAS 3', x: -6.21, fel: { lag: -9, hog: -3.4 }, n: 40, kvN: 22, maN: 18, markering: ['bas:3'] });
        expect(f.lager[0].tips(f.lager[0].data[0])[3]).toEqual(['Antal', '40 (22 kv / 18 mä)']);
        expect(() => valideraFigur(f, 't')).not.toThrow();
    });
    it('ritas av kärnan med demodatan: punkter, intervall och förklaring med symbol för de statusar som finns; inget BAS under tröskeln', () => {
        const w2 = createAppWindow();
        w2.__loadDemoData();
        w2.__renderTabContent('matrix');
        for (const id of ['chart-skevhet-overview', 'chart-perbas-gap']) {
            const el = w2.document.getElementById(id);
            if (!el._figur) { expect(el.textContent, id).toMatch(/För få BAS-intervall/); continue; }
            expect(el.data, id).toBeUndefined();
            const serier = el._figur.lager.map(l => l.serie);
            expect([...el.querySelectorAll('[data-del="forklaring"] [data-serie]')].map(g => g.getAttribute('data-serie')), id).toEqual(serier);
            const punkter = el._figur.lager.reduce((n, l) => n + l.data.length, 0);
            expect(el.querySelectorAll('[data-marke="punkt"]').length, id).toBe(punkter);
            expect(el.querySelectorAll('[data-marke="stapel"], svg[data-marke="monster"]').length, id).toBe(0);
            expect(el.querySelectorAll('[data-marke="fel"]').length, id).toBe(el._figur.lager.reduce((n, l) => n + l.data.filter(d => d.fel).length, 0));
            expect(el.querySelectorAll('[data-del="forklaring"] [data-prov="punkt"]').length, id).toBe(serier.length);   // förklaringen visar symbolen
        }
        // Diagramdatan bär status som serie och konfidensintervallet som Undre/Övre.
        const rader = w2.eval('chartExportRows(document.getElementById("chart-skevhet-overview"))');
        expect(rader.some(r => r.includes('Undre') && r.includes('Övre'))).toBe(true);
    });
    it('ett BAS där ett kön är under tröskeln når varken diagram (i exportläget), exportbild eller diagramdata', () => {
        const data = [...Array.from({ length: 30 }, (_, i) => person('A', i % 2 ? 'kvinna' : 'man', 30000 + i * 100)),
                      ...Array.from({ length: 30 }, (_, i) => person('C', i % 2 ? 'kvinna' : 'man', 32000 + i * 100)),
                      ...Array.from({ length: 24 }, (_, i) => person('B', i < 4 ? 'kvinna' : 'man', i < 4 ? 71111 : 40000 + i))];
        medData(data, [], () => {
            w.__state.kLage = 'export';
            w.__renderTabContent('matrix');
            const el = w.document.getElementById('chart-skevhet-overview');
            expect(el._figur.y.ordning).toEqual(['BAS A', 'BAS C']);
            expect(utdata(el)).not.toMatch(/BAS B|71\s?111/);
            w.eval('sattKTroskel(20, { fraga: false })');                          // nu når inget BAS tröskeln per kön
            w.__renderTabContent('matrix');
            const el2 = w.document.getElementById('chart-skevhet-overview');
            expect(el2._figur).toBeUndefined();
            expect(el2.querySelector('svg')).toBeNull();
        });
    });
});

describe('Lika arbete: översiktstabellen med inbyggd grafik (huvudvyn)', () => {
    it('en rad per BAS med antal, medianer, skillnad, kvot med intervall och status — samma tal som figuren', () => {
        const w2 = createAppWindow();
        w2.__loadDemoData();
        w2.__renderTabContent('matrix');
        const d = w2.document, rader = [...d.querySelectorAll('#la-oversikt tbody tr')];
        const figur = d.getElementById('chart-skevhet-overview')._figur, hantel = d.getElementById('chart-skevhet-hantel')._figur;
        expect(rader.map(r => r.querySelector('th').textContent)).toEqual(figur.y.ordning);
        expect(d.getElementById('la-huvuddiagram').contains(d.getElementById('la-oversikt'))).toBe(true);
        expect(d.getElementById('avsnitt-la-bas').contains(d.getElementById('chart-skevhet-overview'))).toBe(true);   // bilden står i fördjupningen
        const punkter = figur.lager.flatMap(l => l.data.map(p => ({ ...p, serie: l.serie })));
        for (const tr of rader) {
            const celler = [...tr.children].map(c => c.textContent.replace(/\u00a0|\u202f/g, ' ')), bas = celler[0];
            const p = punkter.find(x => x.y === bas);
            const kv = hantel.lager[1].data.find(x => x.y === bas), ma = hantel.lager[2].data.find(x => x.y === bas);
            expect(celler[1]).toBe(`${kv.n} / ${ma.n}`);
            expect(Number(celler[2].replace(/\D/g, ''))).toBe(kv.x);
            expect(Number(celler[3].replace(/\D/g, ''))).toBe(ma.x);
            expect(celler[4].startsWith(kv.x < ma.x ? '−' : kv.x > ma.x ? '+' : '')).toBe(true);
            expect(Number(celler[4].replace(/\D/g, ''))).toBe(Math.abs(kv.x - ma.x));
            expect(celler[6].startsWith(p.etikett.replace(/\u00a0|\u202f/g, ' '))).toBe(true);
            expect(celler[7]).toBe(p.serie);                                      // status i ord, inte bara i färg
            const svg = tr.querySelector('svg.la-oversikt-grafik');
            expect(svg.getAttribute('aria-hidden')).toBe('true');                 // grafiken upprepar bara radens tal
            expect(svg.querySelectorAll('line').length).toBe(p.fel ? 2 : 1);      // linjen vid 100 %, och intervallet om det finns
            expect(Array.isArray(tr._markering)).toBe(true);                      // raden följer de länkade vyerna
        }
        expect(d.querySelectorAll('#la-oversikt-skala text').length).toBe(3);     // 95, 100 och 105 i kolumnens rubrik
    });
    it('ett BAS där ett kön är under tröskeln får ingen rad, och utan rader står ett besked; rensningen tömmer tabellen', () => {
        const data = [...Array.from({ length: 30 }, (_, i) => person('A', i % 2 ? 'kvinna' : 'man', 30000 + i * 100)),
                      ...Array.from({ length: 24 }, (_, i) => person('B', i < 4 ? 'kvinna' : 'man', i < 4 ? 71111 : 40000 + i))];
        medData(data, [], () => {
            w.__state.kLage = 'export';
            w.__renderTabContent('matrix');
            const tb = w.document.querySelector('#la-oversikt tbody');
            expect([...tb.querySelectorAll('tr th')].map(t => t.textContent)).toEqual(['BAS A']);
            expect(tb.textContent).not.toMatch(/BAS B|71\s?111/);
            w.eval('sattKTroskel(20, { fraga: false })');
            w.__renderTabContent('matrix');
            expect(tb.querySelectorAll('tr')).toHaveLength(1);
            expect(tb.textContent).toMatch(/För få BAS-intervall/);
            expect(w.document.getElementById('la-oversikt-skala').innerHTML).toBe('');
        });
        expect(w.eval('RENSA_TABELLER')).toContain('la-oversikt');
    });
});

describe('diagram i Lika arbete, Struktur och de övriga flikarna', () => {
    it('lönespridning per BAS och kön: lådor utan enskilda avvikare, och ett kön under tröskeln ritas inte', () => {
        const w2 = createAppWindow();
        w2.__loadDemoData();
        w2.__renderTabContent('matrix');
        const el = w2.document.getElementById('chart-skevhet-lador'), f = el._figur;
        expect(f.lager.map(l => [l.marke, l.serie, l.avvikare, l.form])).toEqual([['lada', 'Kvinna', false, undefined], ['lada', 'Man', false, undefined]]);
        expect(el.querySelectorAll('[data-marke="avvikare"]')).toHaveLength(0);          // en avvikare är en person
        expect(el.querySelectorAll('[data-marke="lada"]').length).toBeGreaterThan(2);
        const not = w2.document.getElementById('skevhet-lador-not');
        const sma = f.lager.flatMap(l => l.data.filter(d => d.liten).map(d => d.x));
        expect(not.hidden).toBe(!sma.length);
        expect(() => valideraFigur(f, 't')).not.toThrow();
    });
    it('percentilerna i Struktur: kvinnors och mäns lön per percentil som två punkter, samma tal som fördelningen', () => {
        const f = w.eval(`_strukturPercentilFigur([{ p: 10, kv: 30000, ma: 34000, gapPct: -11.76 }, { p: 50, kv: 36000, ma: 42000, gapPct: -14.29 }, { p: 90, kv: 45000, ma: 50500, gapPct: -10.89 }])`);
        expect(f.y.ordning).toEqual(['P10 (lägst betalda)', 'P50 (median)', 'P90 (högst betalda)']);
        expect(f.lager.map(l => [l.marke, l.serie])).toEqual([['intervall', 'Skillnad'], ['punkt', 'Kvinnor'], ['punkt', 'Män']]);
        expect(f.lager[0].data[0]).toMatchObject({ lag: 30000, hog: 34000 });
        expect(f.lager[2].data.map(d => d.etikett)).toEqual(['88,2 %', '85,7 %', '89,1 %']);   // kvinnors lön i % av mäns, vid den högre punkten
        expect(f.lager[1].data.every(d => d.etikett === undefined)).toBe(true);
        expect(() => valideraFigur(f, 't')).not.toThrow();
    });
    it('gapuppdelningen som trappa: de tre delarna läggs på varandra och landar i hela skillnaden', () => {
        const f = w.eval(`_guTrappaFigur({ gap: 6000, delar: { A: 3400, B: -600, C: 3200 } })`);
        expect(f.x.ordning).toEqual(['A. BAS-fördelning', 'B. AID inom BAS', 'C. Inom AID och BAS', 'Hela skillnaden']);
        expect(f.lager[1].data.map(d => [d.lag, d.hog, d.farg])).toEqual([[0, 3400, '#2a78d6'], [2800, 3400, '#eb6834'], [2800, 6000, '#2a78d6']]);   // en del som minskar skillnaden: orange
        expect(f.lager[2].data.map(d => d.y)).toEqual([3400, 2800, 6000, 6000]);
        expect(f.lager[0].data).toEqual([{ x: 'Hela skillnaden', y: 6000 }]);
        expect(f.y.nollinje).toBe(true);
        expect(() => valideraFigur(f, 't')).not.toThrow();
    });
    it('yrkesgruppstabellen ritar kvoten i raden, och exporten bär fortfarande bara talet', () => {
        const w2 = createAppWindow();
        w2.__loadDemoData();
        w2.__renderTabContent('matrix');
        const rader = [...w2.document.querySelectorAll('#matrix-table tbody tr')].filter(tr => tr._euRow && !tr._euRow.samladMedian);
        expect(rader.length).toBeGreaterThan(0);
        for (const tr of rader) {
            const cell = tr.querySelector('.la-kvotcell');
            expect(cell.querySelector('svg.la-oversikt-grafik').getAttribute('aria-hidden')).toBe('true');
            expect(cell.textContent.trim()).toMatch(/^[\d,]+\s?%/);                     // grafiken har ingen text: cellen läses som talet
        }
    });
    it('sju diagram ritas i sina ordinarie behållare och i sin form', () => {
        const w2 = createAppWindow();
        w2.__loadDemoData();
        w2.__state.kLage = 'export';   // figurerna så som exporterna läser dem (ADR-51)
        for (const t of ['matrix', 'likvardighet', 'prioritering', 'kon', 'benchmark', 'loneoversyn']) w2.__renderTabContent(t);
        const d = w2.document, f = id => (d.getElementById(id) || {})._figur;
        const kostnad = f('chart-prio-pareto');
        expect(kostnad.y2).toBeUndefined();                                       // en axel
        expect(kostnad.lager.every(l => l.marke === 'stapel' && l.riktning === 'liggande')).toBe(true);
        const band = f('chart-demo-spread');
        expect(band.lager.slice(0, 3).map(l => l.marke)).toEqual(['band', 'band', 'linje']);
        expect(band.lager[2].data.every(p => p.r.n >= w2.__K)).toBe(true);        // ingen åldersgrupp under tröskeln
        expect(f('chart-kon-histogram').lager.every(l => l.lage === 'overlagrad' && l.opacitet < 1 && !l.data.some(p => p.monster))).toBe(true);
        expect(f('chart-lp-gender').lager.map(l => l.marke)).toEqual(['intervall', 'intervall', 'punkt', 'punkt']);
        const kv = f('chart-reg-kvantil');
        if (kv) { expect(kv.y.skala).toBe('band'); expect(kv.x.doman[0] <= 0 && kv.x.doman[1] >= 0).toBe(true); }   // axeln når noll
        const par = f('chart-likvardighet-heatmap');
        if (par) expect(par.lager.map(l => l.marke)).toEqual(['intervall', 'punkt', 'punkt']);
        for (const id of ['chart-prio-pareto', 'chart-demo-spread', 'chart-kon-histogram', 'chart-lp-gender']) expect(() => valideraFigur(f(id), id), id).not.toThrow();
    });
});

describe('gap per åldersgrupp, trattdiagram och läget i spannet per kön', () => {
    const p = (kon, alder, lon, yrke = 'Y1', bas = 'A') => ({ kon, alder, lon, yrke, aid: yrke, bas });
    it('lönegap per åldersgrupp: en rad per åldersgrupp där båda könen når tröskeln; de övriga namnges, aldrig ritas', () => {
        const kv = [...Array.from({ length: 12 }, (_, i) => p('kvinna', 32 + (i % 6), 30000 + i * 100)), ...Array.from({ length: 12 }, (_, i) => p('kvinna', 44, 33000 + i * 100)), ...Array.from({ length: 3 }, (_, i) => p('kvinna', 62, 71111 + i))];
        const ma = [...Array.from({ length: 12 }, (_, i) => p('man', 33 + (i % 6), 32000 + i * 100)), ...Array.from({ length: 12 }, (_, i) => p('man', 45, 33000 + i * 100)), ...Array.from({ length: 12 }, (_, i) => p('man', 63, 40000 + i * 100))];
        w.__kv = kv; w.__ma = ma;
        const u = w.eval('_konAlderGapRader(window.__kv, window.__ma, 10)');
        expect(u.visade.map(r => [r.namn, r.nKv, r.nMa])).toEqual([['30–39 år', 12, 12], ['40–49 år', 12, 12]]);
        expect(u.dolda).toEqual(['60 år och äldre']);                              // tre kvinnor: visas inte
        expect(u.visade[0].gap).toBeCloseTo(30550 / 32550 * 100, 6);
        expect(u.visade[1].gap).toBeCloseTo(100, 6);
        expect(u.visade[0].ci.lo).toBeLessThan(u.visade[0].gap);
        w.__r = u.visade;
        const f = w.eval('_konAlderGapFigur(window.__r, "hela urvalet")');
        expect(f.y.ordning).toEqual(['30–39 år', '40–49 år']);
        expect(f.lager.every(l => l.marke === 'punkt' && l.riktning === 'liggande')).toBe(true);
        expect(f.lager.flatMap(l => l.data).every(d => d.fel && d.fel.lag <= d.x && d.fel.hog >= d.x)).toBe(true);
        expect(f.referens).toEqual([expect.objectContaining({ typ: 'zon', x0: 95, x1: 105 }), expect.objectContaining({ x: 100 })]);
        expect(JSON.stringify(f)).not.toMatch(/7111\d|60 år/);
        expect(() => valideraFigur(f, 't')).not.toThrow();
    });
    it('trattdiagrammet: gränsen smalnar med gruppens storlek, och en grupp bedöms mot sin egen gräns', () => {
        const grupp = (yrke, n, kvLon, maLon) => [...Array.from({ length: n }, (_, i) => p('kvinna', 40, kvLon + (i - n / 2) * 200, yrke)), ...Array.from({ length: n }, (_, i) => p('man', 40, maLon + (i - n / 2) * 200, yrke))];
        w.__d = [...grupp('Liten', 10, 30000, 30600), ...grupp('Stor', 60, 30000, 33000), ...Array.from({ length: 30 }, (_, i) => p('kvinna', 40, 30000 + i, 'Bara kvinnor')), p('man', 40, 99999, 'Bara kvinnor')];
        const u = w.eval('_laTrattUnderlag(window.__d, 10)');
        expect(u.punkter.map(x => x.yrke).sort()).toEqual(['Liten', 'Stor']);       // gruppen med en man finns inte med
        expect(u.halv(10, 10)).toBeGreaterThan(u.halv(60, 60));                      // tratten: vidare gräns för den lilla gruppen
        expect(u.halv(10, 50)).toBeGreaterThan(u.halv(30, 30));                      // ojämn könsfördelning ger vidare gräns än jämn, vid samma antal
        const stor = u.punkter.find(x => x.yrke === 'Stor'), liten = u.punkter.find(x => x.yrke === 'Liten');
        expect(stor.utanfor).toBe(true);
        expect(liten.utanfor).toBe(false);
        expect(stor.gransLag).toBeLessThan(100);                                     // gruppens egna gränser, ur omkastningen
        expect(stor.gransHog).toBeGreaterThan(100);
        expect(stor.kvot).toBeLessThan(stor.gransLag);
        expect(liten.kvot).toBeGreaterThan(liten.gransLag);                          // den lilla gruppens skillnad ryms inom dess egna gränser
        expect(w.eval('_laTrattUnderlag(window.__d, 10)').punkter.map(x => [x.gransLag, x.gransHog])).toEqual(u.punkter.map(x => [x.gransLag, x.gransHog]));   // seedat: samma varje gång
        w.__u = u;
        const f = w.eval('_laTrattFigur(window.__u, 10)');
        expect(f.lager.map(l => [l.marke, l.serie, l.symbol || null])).toEqual([['band', 'Slumpens gränser (95 %)', null], ['punkt', 'Inom gränserna', 'cirkel'], ['punkt', 'Utanför gränserna', 'romb']]);
        const band = f.lager[0].data;
        expect(band[0].x).toBe(20);                                                 // axeln börjar vid minsta möjliga grupp (2 × tröskeln)
        expect(band[0].hog - band[0].lag).toBeGreaterThan(band[band.length - 1].hog - band[band.length - 1].lag);
        expect(band.every(b => b.lag < 100 && b.hog > 100)).toBe(true);
        expect(f.lager[2].data[0]).toMatchObject({ x: 120, etikett: 'Stor' });       // bara grupper utanför namnges i bilden
        expect(f.lager[1].data[0].etikett).toBeUndefined();
        expect(JSON.stringify(f)).not.toMatch(/99999|Bara kvinnor/);
        expect(() => valideraFigur(f, 't')).not.toThrow();
    });
    it('trattdiagrammet, små grupper: omkastningen pekar ut ungefär 5 % när könen inte skiljer sig, och fältet är inte för snävt', () => {
        // 300 yrkesgrupper om tio kvinnor och tio män ur SAMMA lönefördelning (lognormal, 8 % spridning, löner i steg om
        // 500 kr): varje grupp som hamnar utanför är ett falsklarm. Den okorrigerade normalformeln gav 6–8 % i simulering.
        let frö = 20261012;
        const slump = () => { frö = (frö + 0x6D2B79F5) | 0; let t = Math.imul(frö ^ (frö >>> 15), 1 | frö); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
        const norm = () => Math.sqrt(-2 * Math.log(1 - slump())) * Math.cos(2 * Math.PI * slump());
        const lon = () => Math.round(35000 * Math.exp(0.08 * norm()) / 500) * 500;
        const d = [];
        for (let g = 0; g < 300; g++) for (let i = 0; i < 20; i++) d.push(p(i < 10 ? 'kvinna' : 'man', 40, lon(), 'G' + g));
        w.__d = d;
        const u = w.eval('_laTrattUnderlag(window.__d, 10)');
        expect(u.punkter).toHaveLength(300);
        const falsklarm = u.punkter.filter(x => x.utanfor).length / 300;
        expect(falsklarm).toBeGreaterThan(0.015);
        expect(falsklarm).toBeLessThan(0.085);                                       // kring 5 %
        // Fältet (ritat för jämn könsfördelning) rymmer minst 93 % av grupperna: inte snävare än omkastningen i snitt.
        const h = u.halv(10, 10), innanfor = u.punkter.filter(x => Math.abs(x.kvot - 100) <= h).length / 300;
        expect(innanfor).toBeGreaterThan(0.93);
        expect(u.halv(10, 10) / (100 * 1.96 * 1.2533 * u.sigma * Math.sqrt(0.2))).toBeCloseTo(1.06, 6);   // korrektionen för små grupper
    });
    it('prestanda: översikten och trattens underlag räknas en gång per underlag och tröskel, och minnet släpps vid rensning', () => {
        const grupp = (yrke, n) => [...Array.from({ length: n }, (_, i) => p('kvinna', 40, 30000 + i * 37, yrke)), ...Array.from({ length: n }, (_, i) => p('man', 40, 30500 + i * 41, yrke))];
        w.__d = [...grupp('G1', 12), ...grupp('G2', 15)];
        w.eval('laMinneSlapp()');
        const a = w.eval('_laOversiktRader(window.__d, ["A"], 10)'), u = w.eval('_laTrattUnderlag(window.__d, 10)');
        expect(w.eval('_laOversiktRader(window.__d, ["A"], 10)')).toBe(a);              // samma objekt: inte räknat om
        expect(w.eval('_laTrattUnderlag(window.__d, 10)')).toBe(u);
        expect(w.eval('_laOversiktRader(window.__d, ["A"], 11)')).not.toBe(a);          // annan tröskel: räknas om
        expect(w.eval('_laOversiktRader(window.__d, ["A"], 11)')).toEqual(a);           // … med samma tal här (båda könen når 11)
        w.__d2 = w.__d.slice();
        expect(w.eval('_laTrattUnderlag(window.__d2, 10)')).not.toBe(u);                // annat underlag: räknas om
        expect(w.eval('_laMinnen.size')).toBeGreaterThan(0);
        w.eval('laMinneSlapp()');
        expect(w.eval('_laMinnen.size')).toBe(0);
        // Rensningen och ogiltigförklaringen av statistiken släpper minnet (det håller en referens till dataraderna).
        w.eval('_laOversiktRader(window.__d, ["A"], 10)');
        w.eval('invalidateStatCaches({ recompute: false })');
        expect(w.eval('_laMinnen.size')).toBe(0);
    });
    it('trattdiagrammet: en grupp över 300 personer bedöms med gruppens egen spridning, och högst sex grupper namnges', () => {
        const grupp = (yrke, n, kvLon, maLon) => [...Array.from({ length: n }, (_, i) => p('kvinna', 40, kvLon + (i % 21 - 10) * 150, yrke)), ...Array.from({ length: n }, (_, i) => p('man', 40, maLon + (i % 21 - 10) * 150, yrke))];
        w.__d = [...grupp('Jättestor', 200, 30000, 30900), ...Array.from({ length: 9 }, (_, g) => grupp('Y' + g, 30, 30000, 33000 + g * 300)).flat()];
        w.eval('laMinneSlapp()');
        const u = w.eval('_laTrattUnderlag(window.__d, 10)');
        const stor = u.punkter.find(x => x.yrke === 'Jättestor');
        expect(stor.n).toBe(400);
        expect((stor.gransLag + stor.gransHog) / 2).toBeCloseTo(100, 9);            // formelns gräns är symmetrisk kring 100
        expect(stor.gransHog - 100).toBeGreaterThan(0.1);
        expect(stor.utanfor).toBe(true);                                             // 3 % skillnad i en grupp om 400
        w.__u = u;
        const f = w.eval('_laTrattFigur(window.__u, 10)');
        const namn = f.lager.flatMap(l => l.data || []).filter(x => x.etikett).map(x => x.etikett);
        expect(namn).toHaveLength(6);                                                // tio grupper utanför, sex namngivna
        expect(namn).toContain('Y8');                                                // de som avviker mest
        expect(namn).not.toContain('Jättestor');
        expect(f.lager.filter(l => l.marke === 'punkt').every(l => l.etikettLage === 'auto')).toBe(true);   // till höger, till vänster vid högerkanten
    });
    it('läget i spannet per kön: fem klasser som summerar till 100 %, och ingen figur när ett kön är under tröskeln', () => {
        const pol = { p10: 30000, p90: 36000 };
        w.__pol = pol;
        w.__rows = [p('kvinna', 40, 29000), p('kvinna', 40, 30500), p('kvinna', 40, 31000), p('kvinna', 40, 33000), p('man', 40, 35500), p('man', 40, 37000), p('man', 40, 33000)];
        expect(w.eval('_lpKonLagen(window.__rows, window.__pol)')).toEqual({ kv: [1, 2, 1, 0, 0], ma: [0, 0, 1, 1, 1] });
        expect([-0.1, 0, 0.33, 0.34, 0.66, 0.67, 1, 1.01].map(v => w.eval(`_lpLagesklass(${v})`))).toEqual([0, 1, 1, 2, 2, 3, 3, 4]);
        const f = w.eval('_lpFigurKonLagen({ kv: [1, 2, 1, 0, 0], ma: [0, 0, 1, 1, 2], nKv: 4, nMa: 4 })');
        expect(f.lager.map(l => l.serie)).toEqual(['Under spannet', 'Nedre tredjedelen', 'Mellersta tredjedelen', 'Övre tredjedelen', 'Över spannet']);
        for (const i of [0, 1]) expect(f.lager.reduce((s, l) => s + l.data[i].x, 0)).toBeCloseTo(100, 6);
        expect(f.lager[1].data[0]).toMatchObject({ y: 'Kvinnor', x: 50, fa: true });   // två personer: litet underlag, sägs i tipset
        expect(() => valideraFigur(f, 't')).not.toThrow();
        const w2 = createAppWindow();
        w2.__loadDemoData();
        w2.__state.kLage = 'export';
        w2.__renderTabContent('lonepolitik');
        expect(w2.document.getElementById('lp-konlagen-kort').hidden).toBe(false);
        expect(w2.document.getElementById('chart-lp-konlagen')._figur.lager).toHaveLength(5);
        w2.eval('sattKTroskel(200, { fraga: false })');
        w2.__renderTabContent('lonepolitik');
        expect(w2.document.getElementById('lp-konlagen-kort').hidden).toBe(true);
        expect(w2.document.getElementById('chart-lp-konlagen')._figur).toBeUndefined();
    });
    it('i exportläget: de tre diagrammen ritas med demodatan, och höjd tröskel tar bort dem utan att något står kvar', () => {
        const w2 = createAppWindow();
        w2.__loadDemoData();
        w2.__state.kLage = 'export';
        for (const t of ['matrix', 'kon']) w2.__renderTabContent(t);
        const d = w2.document;
        expect(d.getElementById('chart-kon-aldergap')._figur.y.ordning.length).toBeGreaterThan(0);
        expect(d.getElementById('la-tratt-kort').hidden).toBe(false);
        expect(d.getElementById('chart-la-tratt')._figur.lager[0].marke).toBe('band');
        expect(d.getElementById('la-tratt-not').textContent).toMatch(/^\d+ yrkesgrupper där både kvinnor och män når minsta gruppstorlek; \d+ ligger utanför gränserna/);
        w2.eval('sattKTroskel(200, { fraga: false })');
        for (const t of ['matrix', 'kon']) w2.__renderTabContent(t);
        expect(d.getElementById('la-tratt-kort').hidden).toBe(true);
        expect(d.getElementById('chart-la-tratt')._figur).toBeUndefined();
        expect(d.getElementById('chart-kon-aldergap')._figur).toBeUndefined();
        expect(d.getElementById('chart-kon-aldergap').textContent).toMatch(/Ingen åldersgrupp har minst 200 kvinnor och 200 män/);
    });
});

describe('etiketter, långa namn, nollinje', () => {
    it('stapeletikett med felstapel står bredvid strecket när den ryms, annars mitt över med vit kant; utan felstapel orörd', () => {
        const fig = rader => ({ beskrivning: 'F', x: { skala: 'band' }, y: { skala: 'linjar', doman: [77, 113] },
            lager: [{ marke: 'stapel', lage: 'overlagrad', serie: 'S', farg: '#2a78d6', data: rader }] });
        w.__f = fig([{ x: 'BAS 3', y: 93.4, etikett: '93,4 %', fel: { lag: 90.1, hog: 96.9 } }, { x: 'BAS 7', y: 99.1, etikett: '99,1 %' }]);
        const et = b => [...w.eval(`_rfByggSvg(window.__f, ${b}, {})`).querySelectorAll('text[data-marke="etikett"]')]
            .map(t => [t.firstChild.textContent, t.getAttribute('text-anchor'), t.getAttribute('paint-order')]);
        expect(et(900)).toEqual([['93,4 %', 'start', null], ['99,1 %', 'middle', null]]);          // breda staplar: bredvid strecket
        w.__f = fig(Array.from({ length: 14 }, (_, i) => ({ x: 'BAS ' + i, y: 93.4, etikett: '93,4 %', fel: { lag: 90.1, hog: 96.9 } })));
        const smala = et(900);
        if (smala.length) expect(smala.every(e => e[1] === 'middle' && e[2] === 'stroke')).toBe(true);   // smala staplar: vit kant
    });
    it('sektornamn skrivs ut hela på en bred skärm och kortas först när 42 % av bredden inte räcker', () => {
        const langt = 'Förskole-, skol-, fritids- och annan pedagogisk verksamhet';
        w.__f = w.eval(`_sektorFigur([{ namn: ${JSON.stringify(langt)}, kvot: 95, justerat: null }, { namn: 'Teknik', kvot: 101, justerat: null }])`);
        const namn = b => [...w.eval(`_rfByggSvg(window.__f, ${b}, {})`).querySelectorAll('text[data-axel="y"]')].map(t => t.firstChild.textContent);
        expect(namn(1000)).toContain(langt);
        expect(namn(400).some(n => n.endsWith('…'))).toBe(true);
    });
    it('oförklarat gap med bara negativa värden: nollinjen ritas inne i panelen, inte i dess kant', () => {
        w.__f = w.eval(`_perBasFigur([{ bas: '3', gapPct: -6.2, ciLow: -9, ciHigh: -3.4, pValue: 0.001, n: 40, kvN: 22, maN: 18 },
                                      { bas: '4', gapPct: -2.5, ciLow: -4.5, ciHigh: -0.5, pValue: 0.01, n: 44, kvN: 20, maN: 24 }], {})`);
        const svg = w.eval('_rfByggSvg(window.__f, 800, {})');
        const noll = svg.querySelector('[data-marke="nollinje"]'), panel = noll.closest('svg[data-del="panel"]');
        const x = Number(noll.getAttribute('x1'));
        expect(x).toBeGreaterThan(0);
        expect(x).toBeLessThan(Number(panel.getAttribute('width')) - 10);
    });
});

describe('Ålder & karriär: chart-demo-hist', () => {
    it('staplat per kön, referensen som prickad linje med punkter, zon över åldersgrupperna 60+', () => {
        const AB = ['20–24', '25–29', '30–34', '35–39', '40–44', '45–49', '50–54', '55–59', '60–64', '65+'];
        w.__in = { pctKv: AB.map((_, i) => 6 + i), pctMa: AB.map(() => 4), refPct: AB.map(() => 10), isAll: true };
        const f = w.eval('_demoHistFigur(window.__in)');
        expect(f.lager.map(l => [l.marke, l.serie, l.lage, l.farg])).toEqual(
            [['stapel', 'Kvinna', 'staplad', '#833a8f'], ['stapel', 'Man', 'staplad', '#5f7f16'], ['linje', 'Sveriges sysselsatta (SCB AKU)', undefined, '#64748b']]);
        expect(f.lager[2]).toMatchObject({ streck: 'prickad', punkter: true });
        expect(f.lager[0].data[9]).toEqual({ x: '65+', y: 15 });
        expect(f.x.ordning).toEqual(AB);
        expect(f.referens).toEqual([expect.objectContaining({ typ: 'zon', x0: '60–64', x1: '65+' })]);
        expect(f.y.titel).toBe('Andel av organisationen (%)');
        w.__in.isAll = false;
        expect(w.eval('_demoHistFigur(window.__in)').y.titel).toBe('Andel av BAS-intervall (%)');
        expect(() => valideraFigur(f, 't')).not.toThrow();
    });
    it('ritas av kärnan: tio raka etiketter också på smal skärm, zonen ritad, ZIP och meny känner diagrammet', () => {
        const w2 = createAppWindow();
        w2.__loadDemoData();
        w2.__renderTabContent('demografi');
        const el = w2.document.getElementById('chart-demo-hist');
        expect(el.data).toBeUndefined();
        expect(el.querySelectorAll('[data-marke="zon"]')).toHaveLength(1);
        expect(el.querySelectorAll('[data-marke="stapel"]').length).toBeGreaterThan(0);
        expect(w2.eval('diagramRitat(document.getElementById("chart-demo-hist"))')).toBe(true);
        w2.__f = el._figur;
        const smal = w2.eval('_rfByggSvg(window.__f, 320, {})');
        const xEtiketter = [...smal.querySelectorAll('text[data-axel="x"]')];
        expect(xEtiketter.length).toBeGreaterThan(0);
        expect(xEtiketter.every(t => !/rotate/.test(t.getAttribute('transform') || ''))).toBe(true);   // bara y-titeln är vriden
        expect(smal.querySelectorAll('[data-marke="stapel"]').length).toBe(el.querySelectorAll('[data-marke="stapel"]').length);
    });
});

// ---- Linjer, band och lådor ----
describe('Löneutveckling: chart-kon-scatter och chart-kon-boxplot', () => {
    const rader = (n, kon, bas = 'A') => Array.from({ length: n }, (_, i) => person(bas, kon, 30000 + i * 300, { alder: 25 + (i % 35), yrke: `53${i % 3} Yrke` }));
    const rita = (data, fn) => medData(data, [], () => { w.eval("populateSelects(); renderKon('__ALLA__')"); return fn(w.document); });
    const serier = id => w.document.getElementById(id)._figur.lager.map(l => [l.marke, l.serie]);
    it('båda könen över tröskeln: band och trend per kön, punkter per kön, låda per kön', () => {
        rita([...rader(30, 'kvinna'), ...rader(30, 'man')], d => {
            expect(serier('chart-kon-scatter')).toEqual([['band', 'Kvinna 95 % KI'], ['band', 'Man 95 % KI'], ['punkt', 'Kvinna'], ['punkt', 'Man'],
                ['linje', 'Kvinna (trend)'], ['linje', 'Man (trend)']]);
            const el = d.getElementById('chart-kon-scatter'), f = el._figur;
            expect(el.data).toBeUndefined();
            expect(f.lager[2].data).toHaveLength(30);
            expect(f.lager[2].data[0]).toEqual({ x: 25, y: 30000, yrke: '530 Yrke', bas: 'A', markering: ['bas:A', 'grupp:530|A'] });
            expect(vanliga(f.lager[2].tips(f.lager[2].data[0]))).toEqual([['530 Yrke'], ['BAS', 'A'], ['Ålder', '25 år'], ['Lön', '30 000 kr']]);
            expect(f.lager[0].data[0]).toEqual(expect.objectContaining({ x: expect.any(Number), lag: expect.any(Number), hog: expect.any(Number) }));
            expect(el.querySelectorAll('[data-marke="punkt"]')).toHaveLength(60);
            expect(el.querySelectorAll('[data-marke="band"]')).toHaveLength(2);
            expect([...el.querySelectorAll('[data-del="forklaring"] [data-serie]')].map(g => g.getAttribute('data-serie')))
                .toEqual(['Kvinna', 'Man', 'Kvinna (trend)', 'Man (trend)']);                      // banden har ingen egen post
            const lada = d.getElementById('chart-kon-boxplot');
            expect([...new Set(lada._figur.lager[0].data.map(p => p.x))]).toEqual(['Kvinna', 'Man']);
            expect(lada.querySelectorAll('[data-marke="lada"]')).toHaveLength(2);
            // Diagramdatan för lådagrammet är statistik per kön, aldrig en rad per person.
            const tabell = w.eval('chartExportRows(document.getElementById("chart-kon-boxplot"))');
            expect(tabell.filter(r => r[0] === 'Lön')).toHaveLength(2);
        });
    });
    it('kohortförbehållet står under kurvorna: ett tvärsnitt, inte en persons löneutveckling', () => {
        rita([...rader(30, 'kvinna'), ...rader(30, 'man')], d => {
            expect(d.getElementById('kon-kohort-not').textContent).toMatch(/tvärsnitt.*inte hur en persons lön utvecklas/);
        });
    });
    it('tre män (i exportläget): ingen trend, inget band och ingen låda för män — punkterna står kvar, och noterna säger varför', () => {
        rita([...rader(30, 'kvinna'), ...rader(3, 'man')], d => {
            expect(serier('chart-kon-scatter').map(s => s[1])).toEqual(['Kvinna 95 % KI', 'Kvinna', 'Man', 'Kvinna (trend)']);
            const lada = d.getElementById('chart-kon-boxplot');
            expect([...new Set(lada._figur.lager[0].data.map(p => p.x))]).toEqual(['Kvinna']);
            expect(lada.querySelectorAll('[data-marke="lada"]')).toHaveLength(1);
            expect(d.getElementById('chart-kon-boxplot-k-not').textContent).toMatch(/Lådan visas inte för män/);
            expect(lada.querySelector(':scope > svg').getAttribute('aria-label')).toMatch(/Lådan visas inte för män/);
        });
    });
    it('inget kön når tröskeln: lådagrammet rensas helt, ingen figur kvar', () => {
        rita([...rader(4, 'kvinna'), ...rader(3, 'man')], d => {
            const lada = d.getElementById('chart-kon-boxplot');
            expect(lada._figur).toBeUndefined();
            expect(lada.querySelector('svg')).toBeNull();
        });
    });
    it('axeln räknas ur värdena, och ett utsnitt görs med zoom', () => {
        rita([...rader(30, 'kvinna'), ...rader(30, 'man')], d => {
            expect(d.getElementById('chart-kon-scatter')._figur.y.doman).toBeUndefined();
            expect(d.getElementById('chart-kon-boxplot')._figur.y.doman).toBeUndefined();
        });
    });
    it('färg efter BAS: en punktserie per BAS med kön i tipset, trendlinjerna streckade', () => {
        rita([...rader(30, 'kvinna', 'A'), ...rader(30, 'man', 'B')], d => {
            d.getElementById('kon-color-by').value = 'bas';
            w.eval("renderKon('__ALLA__')");
            const f = d.getElementById('chart-kon-scatter')._figur;
            expect(f.lager.filter(l => l.marke === 'punkt').map(l => l.serie).sort()).toEqual(['BAS-A', 'BAS-B']);
            expect(f.lager.find(l => l.serie === 'BAS-A').data[0].kon).toBe('Kvinna');
            expect(f.lager.filter(l => l.marke === 'linje').every(l => l.streck === 'streckad')).toBe(true);
            d.getElementById('kon-color-by').value = 'kon';
        });
    });
});

describe('Ålder & karriär: chart-demo-agecurve, chart-demo-spread', () => {
    it('figurerna: monotona kurvor per kön med zon från 60; percentilband per femårsgrupp', () => {
        const kurva = { ages: [58, 59, 60, 61, 62], share: [1, 2, 3, 2, 1] };
        w.__k = kurva;
        const a = w.eval('_demoAgecurveFigur(window.__k, window.__k, 62)');
        expect(a.lager.map(l => [l.marke, l.serie, l.kurva, l.farg])).toEqual([['linje', 'Kvinna', 'monoton', '#833a8f'], ['linje', 'Man', 'monoton', '#5f7f16']]);
        expect(a.referens).toEqual([expect.objectContaining({ typ: 'zon', x0: 60, x1: 62 })]);
        expect(w.eval('_demoAgecurveFigur(window.__k, window.__k, 59)').referens).toEqual([]);
        expect(a.lager[0].tips({ x: 60, y: 3 })).toEqual([['60 år'], ['Kvinna', '3,0 % av kvinnorna']]);
        // Percentilbandet: tolv personer i 30–34 och tolv i 40–44; de tre i 35–39 är under tröskeln och ritas inte.
        w.__df = [...Array.from({ length: 12 }, (_, i) => ({ alder: 30 + (i % 5), lon: 30000 + i * 1000 })), ...Array.from({ length: 3 }, (_, i) => ({ alder: 36, lon: 71111 + i })),
                  ...Array.from({ length: 12 }, (_, i) => ({ alder: 40 + (i % 5), lon: 40000 + i * 1000 }))];
        const s = w.eval('_demoBandFigur(window.__df, 10, { p10: 24000, med: 30000, p90: 42000 }, 30, 44)');
        expect(s.lager.map(l => l.serie)).toEqual(['P10–P90', 'Mittersta hälften (P25–P75)', 'Median', 'Ställn. P10', 'Ställn. Median', 'Ställn. P90']);
        expect(s.lager.slice(0, 3).map(l => l.marke)).toEqual(['band', 'band', 'linje']);
        expect(s.lager[2].data.map(d => [d.x, d.y, d.r.n])).toEqual([[32.5, 35500, 12], [42.5, 45500, 12]]);
        expect(s.lager[0].data[0].lag).toBeLessThan(s.lager[1].data[0].lag);       // P10 under P25
        expect(JSON.stringify(s)).not.toMatch(/7111\d|37\.5/);                    // gruppen under tröskeln finns inte i figuren
        expect(w.eval('_demoBandFigur(window.__df, 10)').lager).toHaveLength(3);
        expect(w.eval('_demoBandFigur(window.__df.slice(0, 12), 10)')).toBeNull();  // en enda åldersgrupp är inget band
        for (const f of [a, s]) expect(() => valideraFigur(f, 't')).not.toThrow();
    });
    it('ritas av kärnan med demodatan: två diagram, kurvorna som en linje per serie', () => {
        const w2 = createAppWindow();
        w2.__state.kLage = 'export';
        w2.__loadDemoData();
        w2.__renderTabContent('demografi');
        const el = id => w2.document.getElementById(id);
        for (const id of ['chart-demo-agecurve', 'chart-demo-spread']) {
            expect(el(id).data, id).toBeUndefined();
            expect(el(id)._figur, id).toBeDefined();
            expect(() => valideraFigur(el(id)._figur, id)).not.toThrow();
        }
        expect(el('chart-demo-agecurve').querySelectorAll('path[data-marke="linje"]')).toHaveLength(2);
    });
});

describe('Livscykel: lifecycle-chart', () => {
    it('två band (95 % KI) och två kurvor; bandens gränser finns i diagramdatan', () => {
        const pred = lon => [25, 45, 65].map((age, i) => ({ age, lon: lon + i * 4000, lo: lon + i * 4000 - 900, hi: lon + i * 4000 + 900 }));
        w.__r = { predKvinna: pred(28000), predMan: pred(29000), fixBas: '5', gapAt25: -3.4, gapAt65: -6.1 };
        const f = w.eval('_lifecycleFigur(window.__r)');
        expect(f.lager.map(l => [l.marke, l.serie, l.streck])).toEqual([['band', 'Kvinna 95 % KI', undefined], ['band', 'Man 95 % KI', undefined],
            ['linje', 'Kvinna (predikterad lön)', 'hel'], ['linje', 'Man (predikterad lön)', 'streckad']]);
        expect(f.lager[0].data[0]).toEqual({ x: 25, lag: 27100, hog: 28900 });
        expect(f.beskrivning).toMatch(/BAS 5 .*[-−]3[.,]4 procent.*[-−]6[.,]1 procent/);
        expect(vanliga(f.lager[2].tips({ x: 45, y: 32000 }))).toEqual([['Kvinna, 45 år'], ['Predikterad lön', '32 000 kr']]);
        expect(() => valideraFigur(f, 't')).not.toThrow();
        const rader = figurTillTabell(f);
        expect(rader[0]).toEqual(expect.arrayContaining(['Undre', 'Övre']));
    });
});

describe('diagramkärnan: verktygstips på pekskärm', () => {
    it('ett tryck på ett märke visar tipset, och det står kvar när fingret lyfts; musen fungerar som vanligt', () => {
        const el = behallare('chart-pek');
        w.__el = el; w.__f = { beskrivning: 'Pek', x: { skala: 'band' }, y: { skala: 'linjar' },
            lager: [{ marke: 'stapel', serie: 'S', farg: '#2563eb', data: [{ x: 'A', y: 5 }], tips: d => [[d.x], ['Värde', String(d.y)]] }] };
        w.eval('ritaFigur(window.__el, window.__f, { bredd: 400 })');
        const portal = () => w.document.querySelector('.chart-tip-portal');
        const stapel = el.querySelector('[data-marke="stapel"]');
        const handelse = (typ, pointerType) => { const e = new w.Event(typ, { bubbles: true }); e.pointerType = pointerType; e.clientX = 10; e.clientY = 10; return e; };
        stapel.dispatchEvent(handelse('pointerdown', 'touch'));
        expect(portal().textContent).toContain('Värde');
        el.dispatchEvent(handelse('pointerleave', 'touch'));
        expect(portal().textContent).toContain('Värde');                    // fingret lyft: tipset står kvar
        el.querySelector('svg').dispatchEvent(handelse('pointerdown', 'touch'));
        expect(portal().textContent).toBe('');                              // tryck utanför märkena döljer
        stapel.dispatchEvent(handelse('pointerdown', 'mouse'));
        expect(portal().textContent).toBe('');                              // musklick visar inget tips (det gör rörelsen)
        stapel.dispatchEvent(handelse('pointermove', 'mouse'));
        expect(portal().textContent).toContain('Värde');
        el.dispatchEvent(handelse('pointerleave', 'mouse'));
        expect(portal().textContent).toBe('');
        w.eval('rensaFigur(window.__el)');
    });
});

describe('diagramkärnan: lådans färg', () => {
    it('en låda vars individer delar färg får den färgen; blandade färger ger lagrets', () => {
        w.__f = { beskrivning: 'L', legend: false, x: { skala: 'band' }, y: { skala: 'linjar' },
            lager: [{ marke: 'lada', serie: 'Lön', farg: '#111111', data: [
                ...[1, 2, 3, 4, 5].map(y => ({ x: 'Kvinna', y, farg: '#833a8f' })),
                ...[1, 2, 3, 4, 5].map((y, i) => ({ x: 'Blandad', y, farg: i ? '#2a78d6' : '#833a8f' })),
                // En liten individ med annan färg får inte ändra lådans färg (den ritas inte).
                ...[1, 2, 3, 4, 5].map(y => ({ x: 'Man', y, farg: '#2a78d6' })), { x: 'Man', y: 9, farg: '#000000', liten: true }] }] };
        const svg = w.eval('_rfByggSvg(window.__f, 600, {})');
        expect([...svg.querySelectorAll('rect[data-marke="lada"]')].map(r => r.getAttribute('stroke') || r.getAttribute('fill')))
            .toEqual(['#833a8f', '#111111', '#2a78d6']);
    });
});

// ---- De sammansatta diagrammen ----
describe('Jämförelsestatistik: figurerna', () => {
    const rad = (yrke, org, ref, diff) => ({ aid: yrke.slice(0, 6), yrke, bas: 'C', n: 20, org, statistik: ref,
        diff: { statistik: diff } });
    it('spannet: två intervallager (referensen brett bakom, organisationen smalt), medianer som streck och prick', () => {
        w.__r = [rad('207011 Usk', { p10: 28000, median: 31000, p90: 35000 }, { p10: 29000, median: 32000, p90: 36000 }, {}),
                 rad('502010 Sys', { p10: 40000, median: 45000, p90: 52000 }, { p10: null, median: 47000, p90: null }, {})];
        const f = w.eval("_jmfSpannFigur(window.__r, 'statistik', 'Statistiken', 'statistiken')");
        expect(f.lager.map(l => [l.marke, l.riktning, l.symbol, l.tjocklek])).toEqual(
            [['intervall', 'liggande', undefined, 14], ['intervall', 'liggande', undefined, 7], ['punkt', undefined, 'streck', undefined], ['punkt', undefined, undefined, undefined]]);
        expect(f.lager[0].data).toEqual([{ y: '207011 Usk · BAS C', lag: 29000, hog: 36000, markering: ['bas:C', 'grupp:207011|C'] }]);       // utan P10/P90 i referensen: inget spann
        expect(f.lager[1].data[1]).toEqual({ y: '502010 Sys · BAS C', lag: 40000, hog: 52000, markering: ['bas:C', 'grupp:502010|C'] });
        expect(f.lager[2].data).toHaveLength(2);
        expect(f.y.ordning).toEqual(['207011 Usk · BAS C', '502010 Sys · BAS C']);
        expect(() => valideraFigur(f, 't')).not.toThrow();
        expect(figurTillTabell(f)[0]).toEqual(expect.arrayContaining(['Undre', 'Övre']));
    });
    it('avvikelsen: medianen som punkt, P10 och P90 som streck med ett spann emellan, värdet utskrivet utanför radens yttersta märke, nollinje', () => {
        w.__r = [rad('207011 Usk', {}, {}, { median: { pct: -4.25 }, p10: { pct: -2 }, p90: { pct: -6 } }),
                 rad('502010 Sys', {}, {}, { median: { pct: 3.1 }, p10: null, p90: { pct: 5 } })];
        const f = w.eval("_jmfAvvikelseFigur(window.__r, 'statistik', 'statistiken')");
        expect(f.lager.map(l => [l.marke, l.symbol || null, l.serie, l.data.length])).toEqual([['intervall', null, 'Spann P10–P90', 2], ['punkt', null, 'Medianens värde', 2],
            ['punkt', 'streck', 'Skillnad i P10', 1], ['punkt', 'streck', 'Skillnad i P90', 2], ['punkt', null, 'Skillnad i median', 2]]);
        expect(f.lager[0].data.map(d => [d.lag, d.hog])).toEqual([[-6, -2], [3.1, 5]]);                  // spannet rymmer alla tre värdena
        expect(f.lager[1].data.map(d => [d.x, d.etikett])).toEqual([[-2, '−4,3 %'], [5, '+3,1 %']]);     // etiketten vid radens högra ände
        expect(f.lager[1]).toMatchObject({ utanData: true, legend: false, opacitet: 0 });                // bara text: varken i förklaringen eller i diagramdatan
        expect(f.lager[4].data.map(d => [d.x, d.aid])).toEqual([[-4.25, '207011'], [3.1, '502010']]);
        expect(f.lager[4].farg).toBe('#2a78d6');                                                         // en färg: läget mot nollinjen bär riktningen
        expect(vanliga(f.lager[4].tips(f.lager[4].data[1]))).toEqual([['502010 Sys · BAS C'], ['Median', '+3,1 %'], ['P90', '+5,0 %']]);
        expect(f.x.nollinje).toBe(true);
        expect(() => valideraFigur(f, 't')).not.toThrow();
    });

});

describe('Lönepolitik: chart-lp-bandmap', () => {
    it('ritas av kärnan: referensens och organisationens spann som intervall, yrkesgrupper som punkter i tre klasser efter könsfördelning', () => {
        const w2 = createAppWindow();
        w2.__loadDemoData();
        w2.__renderTabContent('lonepolitik');
        const el = w2.document.getElementById('chart-lp-bandmap'), f = el._figur;
        expect(el.data).toBeUndefined();
        expect(f.lager.filter(l => l.marke === 'intervall')).toHaveLength(2);
        expect(f.fargskala).toBeUndefined();                                    // tre klasser, ingen glidande färgskala
        const klasser = f.lager.filter(l => /yrkesgrupp$/.test(l.serie));
        expect(klasser.length).toBeGreaterThan(0);
        for (const l of klasser) expect(l.data.every(p => (/^Kvinno/.test(l.serie) ? p.kvAndel >= 60 : /^Mans/.test(l.serie) ? p.kvAndel <= 40 : p.kvAndel > 40 && p.kvAndel < 60))).toBe(true);
        const grupper = { data: klasser.flatMap(l => l.data) };
        expect(grupper.data.every(p => p.n >= w2.__K && p.kvAndel >= 0 && p.kvAndel <= 100 && Math.abs(p.forskjutning) <= 0.18)).toBe(true);
        expect(el.querySelector('[data-marke="fargstapel"]')).toBeNull();
        expect(el.querySelectorAll('[data-marke="intervall"]').length).toBe(f.lager.filter(l => l.marke === 'intervall').reduce((n, l) => n + l.data.length, 0));
        expect(() => valideraFigur(f, 't')).not.toThrow();
        // Förskjutningen är stabil mellan omritningar.
        const fore = JSON.stringify(grupper.data.map(p => p.forskjutning));
        w2.__renderTabContent('lonepolitik');
        expect(JSON.stringify(w2.document.getElementById('chart-lp-bandmap')._figur.lager.filter(l => /yrkesgrupp$/.test(l.serie)).flatMap(l => l.data).map(p => p.forskjutning))).toBe(fore);
    });
});

describe('Prioritering: chart-prio-pareto och chart-prio-matrix', () => {
    const grupp = (rank, status, over = {}) => ({ rank, status, yrke: `20701${rank} Ett ganska långt yrkesnamn`, bas: 'C', n: 12 + rank, kvN: 8, maN: 4 + rank, median: 30000, refSource: 'referens',
        refMedian: 32000, diffPct: -6.25 + rank, diffKr: -2000 + rank * 300, gapPct: rank === 1 ? -3.2 : null, annualGapTotal: 400000 / rank, annualOverTotal: 0, priorityIndex: 80 - rank, ...over });
    it('kostnadsfördelningen: sorterade liggande staplar på en axel, kumulativ andel som text, de som når 80 % som egen serie', () => {
        w.__v = [grupp(1, 'akut'), grupp(2, 'atgard'), grupp(3, 'bevaka')];
        const f = w.eval('_prioKostnadFigur(window.__v, [54.5, 81.8, 100])');
        expect(f.y2).toBeUndefined();
        expect(f.lager.map(l => [l.marke, l.riktning, l.serie, l.opacitet, l.data.length])).toEqual([['stapel', 'liggande', 'Når tillsammans 80 % av kostnaden', 1, 2], ['stapel', 'liggande', 'Övriga', 0.4, 1]]);
        expect(f.y.ordning[0]).toBe('#1 207011 Ett ganska långt y… · C');
        expect(vanliga([f.lager[0].data.map(d => d.etikett)])[0]).toEqual(['400 000 kr · 55 %', '200 000 kr · 82 %']);
        expect(vanliga(f.lager[0].tips(f.lager[0].data[0]))).toEqual([['207011 Ett ganska långt yrkesnamn · BAS C'], ['Kostnad', '400 000 kr/år'], ['Kumulativ andel', '54,5 %']]);
        expect(f.lager[0].data[0].markering).toEqual(w.eval("markeringFor('C', '207011 Ett ganska långt yrkesnamn')"));
        // Fler än femton grupper: femton ritas, och meningen under diagrammet säger vad de övriga står för.
        w.__m = Array.from({ length: 22 }, (_, i) => grupp(i + 1, 'akut', { annualGapTotal: 1000000 - i * 30000 }));
        const kum = []; let acc = 0; const tot = w.__m.reduce((a, g) => a + g.annualGapTotal, 0);
        for (const g of w.__m) { acc += g.annualGapTotal; kum.push(100 * acc / tot); }
        w.__k = kum;
        const f2 = w.eval('_prioKostnadFigur(window.__m, window.__k)');
        expect(f2.y.ordning).toHaveLength(15);
        expect(f2.lager.reduce((n, l) => n + l.data.length, 0)).toBe(15);
        expect(vanliga([[w.eval(`_prioKostnadNot(window.__m, ${tot})`)]])[0][0]).toMatch(/^Diagrammet visar de 15 grupper som kostar mest\. Övriga 7 grupper står tillsammans för [\d ]+ kr per år \(\d+ % av kostnaden\)/);
        expect(w.eval(`_prioKostnadNot(window.__m.slice(0, 15), ${tot})`)).toBe('');
        expect(() => valideraFigur(f, 't')).not.toThrow();
    });
    it('matrisen: en serie per status som finns, logaritmisk y-axel, fyra zoner med namn, etikett enligt läget', () => {
        w.__v = [grupp(1, 'akut'), grupp(2, 'atgard'), grupp(12, 'ok', { diffPct: 0.5, annualGapTotal: 0 })];
        w.__cfg = { atgardThreshold: -5, bevakaThreshold: -2, analyseraThreshold: 5 };
        const f = w.eval("_prioMatrisFigur(window.__v, 'topp10', 'referensen', window.__cfg)");
        expect(f.lager.map(l => l.serie)).toEqual(['Börja här', 'Värt att granska', 'Balanserat']);
        expect(f.y.skala).toBe('linjar');                                        // grupperna skiljer sig mindre än en tiopotens
        w.__v2 = [grupp(1, 'akut'), { ...grupp(2, 'atgard'), n: 400 }];
        expect(w.eval("_prioMatrisFigur(window.__v2, 'topp10', 'referensen', window.__cfg)").y.skala).toBe('log');
        expect(f.lager.map(l => l.farg)).toEqual(['#4338ca', '#6366f1', '#0f766e']);     // lila för de två första, som i Lika arbetes tabell
        expect(f.referens.map(z => z.etikett)).toEqual(['VÄRT ATT GRANSKA', 'FÖLJ UPP', 'BALANSERAT', 'ÖVER REFERENS']);   // samma ord som statusarna i tabellen
        expect(f.lager[0].data[0]).toMatchObject({ x: -5.25, y: 13, etikett: expect.stringContaining('·C') });
        expect(f.lager[2].data[0].etikett).toBeUndefined();                    // rang 12 får ingen etikett i läget topp 10
        expect(f.lager[0].data[0].storlek).toBeGreaterThan(f.lager[1].data[0].storlek);   // större kostnad, större bubbla
        expect(w.eval("_prioMatrisFigur(window.__v, 'ingen', 'referensen', window.__cfg)").lager.every(l => l.data.every(p => p.etikett === undefined))).toBe(true);
        expect(f.x.doman[0]).toBeLessThan(-5.25); expect(f.x.doman[1]).toBeGreaterThan(5);
        expect(() => valideraFigur(f, 't')).not.toThrow();
        expect(vanliga(f.lager[0].tips(f.lager[0].data[0]))[0]).toEqual(['#1 207011 Ett ganska långt yrkesnamn']);
    });
    it('ritas av kärnan med demodatan, och exportknappen för matrisen ger en bild med alla etiketter', async () => {
        const w2 = createAppWindow();
        w2.__loadDemoData();
        w2.__renderTabContent('prioritering');
        const el = w2.document.getElementById('chart-prio-matrix');
        expect(el.data).toBeUndefined();
        expect(el.querySelectorAll('[data-marke="punkt"]').length).toBe(el._figur.lager.reduce((n, l) => n + l.data.length, 0));
        expect(el.querySelectorAll('[data-marke="zon"]').length).toBeGreaterThan(1);
        const svg = [];
        w2.figurTillBild = (figur, format, b, h, val) => { svg.push(w2.figurTillSvg(figur, b, h, val)); return Promise.resolve('data:image/png;base64,AAAA'); };
        w2.HTMLAnchorElement.prototype.click = () => {};
        // Bilden tas ur diagrammets egen meny Exportera och bär de etiketter som är valda: med «Alla bubblor» en per punkt.
        expect(w2.document.getElementById('btn-export-prio-matrix')).toBeNull();
        const lage = w2.document.getElementById('prio-label-mode');
        lage.value = 'alla';
        lage.dispatchEvent(new w2.Event('change', { bubbles: true }));
        const el2 = w2.document.getElementById('chart-prio-matrix');
        el2.parentElement.querySelector('.chart-export [data-chart-export="png-presentation"]').click();
        await new Promise(r => setTimeout(r, 400));
        expect(svg).toHaveLength(1);
        expect((svg[0].match(/data-marke="punktetikett"/g) || []).length).toBe(el2._figur.lager.reduce((n, l) => n + l.data.length, 0));
    });
});

describe('Likvärdigt arbete: chart-likvardighet-heatmap', () => {
    it('ett kandidatpar per rad: båda medianerna som punkter, gapet som streck och som procent vid jämförelseyrket; allvarligast först', () => {
        w.__par = [{ kvLabel: 'K1', kvBas: 'C', kvMedian: 30000, maLabel: 'J1', maBas: 'C', maMedian: 33000, gapPct: 9.1, gapKr: 3000, allvarsindex: 2 },
                   { kvLabel: 'K2', kvBas: 'C', kvMedian: 31000, maLabel: 'J1', maBas: 'C', maMedian: 33000, gapPct: 6.1, gapKr: 2000, allvarsindex: 5 }];
        const f = w.eval('_lvParFigur(window.__par)');
        expect(f.y.ordning).toEqual(['K2 mot J1', 'K1 mot J1']);
        expect(f.lager.map(l => [l.marke, l.serie])).toEqual([['intervall', 'Gap'], ['punkt', 'Kvinnodominerat yrke'], ['punkt', 'Jämförelseyrke']]);
        expect(f.lager[0].data.map(d => [d.lag, d.hog])).toEqual([[31000, 33000], [30000, 33000]]);
        expect(f.lager[2].data.map(d => d.etikett)).toEqual(['6,1 %', '9,1 %']);
        expect(f.lager[1].data.every(d => d.etikett === undefined)).toBe(true);
        expect(f.fargskala).toBeUndefined();
        expect(() => valideraFigur(f, 't')).not.toThrow();
    });
    it('exporten bär stämpeln om undantaget för fliken', () => {
        const w2 = createAppWindow();
        w2.__loadDemoData();
        w2.__renderTabContent('likvardighet');
        const el = w2.document.getElementById('chart-likvardighet-heatmap');
        if (!el || !el._figur) return;   // demodatan har för få kandidatpar: vyns text visas
        expect(el.data).toBeUndefined();
        expect(w2.eval('chartExportRows(document.getElementById("chart-likvardighet-heatmap"))')[0][0]).toContain('(undantag: Likvärdigt arbete)');
    });
});

// ---- Utforska ----
describe('Utforska: små grupper visas markerade och exporteras bara när rutan är ikryssad', () => {
    const MARKOR = 71337;
    const oppna = () => {
        const w2 = createAppWindow();
        const rad = (bas, kon, lon, alder = 40) => ({ bas, kon, lon, alder, yrke: '100 X', aid: '100', yrkeLabel: 'X' });
        w2.__state.data = [...Array.from({ length: 12 }, (_, i) => rad('A', 'man', 30000 + i * 7)), ...Array.from({ length: 3 }, () => rad('A', 'kvinna', MARKOR)),
                           ...Array.from({ length: 24 }, (_, i) => rad('B', i % 2 ? 'man' : 'kvinna', 26000 + i * 11, 30 + (i % 3) * 12)),
                           ...Array.from({ length: 4 }, (_, i) => rad('LITEN', i % 2 ? 'man' : 'kvinna', MARKOR + 1 + i))];
        w2.eval('populateSelects(); unlockTabs();');
        w2.__state.kLage = 'export';   // så som det lämnar verktyget (ADR-51)
        w2.__renderTabContent('utforska');
        return w2;
    };
    const valj = (w2, val) => { for (const [id, v] of Object.entries(val)) w2.document.getElementById(id).value = v; w2.__renderExplorer(); return w2.document.getElementById('chart-explore'); };
    const export_ = w2 => {
        const u = w2.eval('_rfExportFigur(document.getElementById("chart-explore"))');
        const svg = u.tom ? '' : w2.figurTillSvg(u.figur, 1600, 900, { visaSma: u.visaSma, dolda: u.dolda });
        return (svg + JSON.stringify(w2.eval('chartExportRows(document.getElementById("chart-explore"))'))).replace(/(\d)[\s  ](?=\d)/g, '$1');
    };
    const TYPER = [['staplar', 'ingen', 'kon'], ['liggande', 'ingen', 'kon'], ['hantel', 'ingen', 'helhet'], ['lada', 'ingen', 'kon'], ['punkter', 'ingen', 'kon'], ['svarm', 'ingen', 'kon'], ['regnmoln', 'ingen', 'kon'], ['kvantilpunkter', 'ingen', 'kon'],
                   ['heatmap', 'kon', 'helhet'], ['grupperade', 'kon', 'helhet'], ['bubbla', 'ingen', 'helhet']];
    it.each(TYPER)('%s: skärmen visar den lilla gruppen; exporten bär varken gruppen eller de tre kvinnornas lön — förrän rutan kryssas i', (typ, kolumn, visa) => {
        const w2 = oppna();
        const el = valj(w2, { 'explore-rad': 'bas', 'explore-kolumn': kolumn, 'explore-visa': visa, 'explore-typ': typ });
        expect(el._figur, typ).toBeDefined();
        expect(el.data).toBeUndefined();
        const lonemarken = typ !== 'bubbla';   // bubbeldiagrammet visar gruppens median: kvinnornas lön syns inte i det
        // Visas, markerad (ADR-14): den lilla gruppens datapunkter är märkta och ritas (bubblorna har namnet i verktygstipset).
        expect(el._figur.lager.some(l => l.data.some(d => d.liten && [d.rad, d.x, d.y].includes('LITEN'))), typ).toBe(true);
        expect(el.querySelectorAll('[stroke-dasharray]').length, typ).toBeGreaterThan(0);
        const utan = export_(w2);
        expect(utan, typ).not.toMatch(/LITEN|7133[789]|71340|71341/);
        w2.document.getElementById('explore-inkludera-sma').checked = true;
        const med = export_(w2);
        if (typ !== 'bubbla') expect(med, typ).toContain('LITEN');   // bubblornas diagramdata är x och y, utan gruppnamn
        expect(med.length, typ).toBeGreaterThan(utan.length);
        if (lonemarken && typ !== 'grupperade' && typ !== 'heatmap') expect(med, typ).toMatch(/7133[789]|71340|71341/);
        expect(med, typ).toContain('undantag: valt i Utforska');
        w2.document.getElementById('explore-inkludera-sma').checked = false;
        expect(export_(w2), typ).not.toContain('undantag');
    });
    it('lådagram per kön: en individ är liten när gruppen eller individens kön i gruppen är under tröskeln', () => {
        const w2 = oppna();
        const f = valj(w2, { 'explore-rad': 'bas', 'explore-kolumn': 'ingen', 'explore-visa': 'kon', 'explore-typ': 'lada' })._figur;
        const sma = serie => new Set(f.lager.find(l => l.serie === serie).data.filter(d => d.liten).map(d => d.x));
        expect(sma('Kvinna')).toEqual(new Set(['A', 'LITEN']));                // tre kvinnor i A; hela LITEN
        expect(sma('Man')).toEqual(new Set(['LITEN']));
        expect(f.lager.every(l => l.data.every(d => d.nyckel === d.x))).toBe(true);   // nyckeln är gruppen, aldrig en person
    });
    it('värmekartans färgskala räknas bara ur värden som får redovisas', () => {
        const w2 = oppna();
        const f = valj(w2, { 'explore-rad': 'bas', 'explore-kolumn': 'kon', 'explore-visa': 'helhet', 'explore-typ': 'heatmap' })._figur;
        expect(f.fargskala.doman[1]).toBeLessThan(MARKOR - 1000);
        expect(f.lager[0].data.some(d => d.liten && d.varde >= MARKOR)).toBe(true);   // den lilla cellen finns i vyn, märkt
    });
    it('tomt urval: vyns text, ingen figur och inget att exportera', () => {
        const w2 = oppna();
        w2.__explorerSetFilter({ bas: ['FINNS-INTE-ALLS'] });
        const el = valj(w2, { 'explore-rad': 'bas', 'explore-kolumn': 'ingen', 'explore-typ': 'auto' });
        expect(el._figur).toBeDefined();   // ett okänt filtervärde tas bort tyst: allt visas
        w2.eval('explorerSlappMinne()');
        expect(el._figur).toBeUndefined();
        expect(w2.eval('diagramRitat(document.getElementById("chart-explore"))')).toBe(false);
    });
});

// ---- Utseende: tydligare diagram ----
describe('tydligare diagram: kärnan', () => {
    const staplar = namn => ({ beskrivning: 'T', x: { skala: 'band' }, y: { skala: 'linjar' },
        lager: [{ marke: 'stapel', serie: 'S', farg: '#2563eb', data: namn.map((x, i) => ({ x, y: 10 + i })) }] });
    it('långa kategorinamn på en stående axel bryts på två rader i stället för att kortas hårt', () => {
        w.__f = staplar(['206017 Sjuksköterska allmän', '401011 Lärare grundskola', '503012 Drifttekniker it', '502010 Systemutvecklare', '207011 Undersköterska äldreomsorg', '403010 Barnskötare']);
        const svg = w.eval('_rfByggSvg(window.__f, 760, {})');
        const et = [...svg.querySelectorAll('text[data-axel="x"]')];
        expect(et).toHaveLength(6);
        expect(et.filter(t => t.querySelector('tspan')).length).toBeGreaterThan(3);
        const forsta = et[0];
        // Två rader rymmer yrkeskoden och yrkets namn; det som inte ryms på andra raden kortas.
        expect(forsta.firstChild.textContent).toBe('206017');
        expect(forsta.querySelector('tspan').textContent).toMatch(/^Sjuksköterska/);
        expect(forsta.querySelector('title').textContent).toBe('206017 Sjuksköterska allmän');
        // Korta namn: en rad, och ingen extra höjd reserverad.
        w.__f = staplar(['A', 'B', 'C']);
        expect(w.eval('_rfByggSvg(window.__f, 760, {})').querySelector('text[data-axel="x"] tspan')).toBeNull();
    });
    it('en liten ruta i en värmekarta får streckad kant och ett hörnmärke, inte ränder över hela rutan', () => {
        w.__f = { beskrivning: 'V', x: { skala: 'band' }, y: { skala: 'band' }, fargskala: { typ: 'sekventiell', doman: [0, 10] },
            lager: [{ marke: 'ruta', serie: 'R', data: [{ x: 'a', y: 'r', varde: 3 }, { x: 'b', y: 'r', varde: 7, liten: true }] }] };
        const svg = w.eval('_rfByggSvg(window.__f, 500, { visaSma: true })');
        const rutor = [...svg.querySelectorAll('rect[data-marke="ruta"]')];
        expect(rutor.map(r => !!r.getAttribute('stroke-dasharray'))).toEqual([false, true]);
        expect(svg.querySelectorAll('path[data-marke="rander"]')).toHaveLength(1);
        expect(svg.querySelectorAll('svg[data-marke="rander"]')).toHaveLength(0);
        expect(w.eval('_rfByggSvg(window.__f, 500, {})').querySelectorAll('[data-marke="rander"]')).toHaveLength(0);   // dold: inget spår
    });
    it('exporterad bild har rubrik och fotrad; skärmens diagram har det inte', () => {
        w.__f = staplar(['A', 'B']);
        const svg = w.figurTillSvg(w.__f, 1600, 900, { rubrik: 'Lönegap per BAS-intervall', fot: 'Lönekartläggning 2026-10-09 · Urval: BAS A' });
        expect(svg).toMatch(/data-del="rubrik"[^>]*>Lönegap per BAS-intervall</);
        expect(svg).toMatch(/data-del="fot"[^>]*>Lönekartläggning 2026-10-09 · Urval: BAS A</);
        expect(w.figurTillSvg(w.__f, 1600, 900, {})).not.toMatch(/data-del="(rubrik|fot)"/);
        expect(w.eval('_rfByggSvg(window.__f, 600, {})').querySelector('[data-del="rubrik"], [data-del="fot"]')).toBeNull();
        // Menyns bild: rubriken är kortets rubrik, foten bär datum och urvalet.
        const el = behallare('chart-rubrik');
        w.__el = el;
        w.eval('ritaFigur(window.__el, window.__f, { exportBeskrivning: "BAS A" })');
        expect(w.eval('_chartExportRubrikFot(window.__el, new Date(2026, 9, 9))')).toEqual({ rubrik: 'chart-rubrik', fot: 'Lönekartläggning 2026-10-09 · Urval: BAS A' });
        w.eval('rensaFigur(window.__el)');
    });
});

describe('tydligare diagram: Utforska', () => {
    const cell = (rad, v, n = 20) => ({ rad, kol: null, n, nKv: n / 2, nMa: n / 2, value: v, valueKv: v - 500, valueMa: v + 500, liten: false, konLiten: false });
    it('få staplar bär värdet som etikett; många gör det inte', () => {
        w.__m = { spec: { matt: 'median', delaKon: false }, celler: ['A', 'B', 'C'].map((r, i) => cell(r, 30000 + i * 1000)) };
        expect(vanliga([w.eval('_figStaplar(window.__m, false)').lager[0].data.map(d => d.etikett)])[0]).toEqual(['30 000 kr', '31 000 kr', '32 000 kr']);
        w.__m.celler = Array.from({ length: 14 }, (_, i) => cell(`G${i}`, 30000 + i));
        expect(w.eval('_figStaplar(window.__m, false)').lager[0].data.every(d => d.etikett === undefined)).toBe(true);
    });
    it('könsgapet: status är en serie med egen symbol, ritad som punkt, och står i förklaringen; linjen vid 100 heter Lika lön', () => {
        w.__m = { spec: { matt: 'gap', delaKon: false }, celler: [cell('A', 93), cell('B', 96.5), cell('C', 99.5)] };
        const f = w.eval('_figStaplar(window.__m, false)');
        expect(f.lager.map(l => [l.marke, l.serie, l.symbol, l.data.map(d => d.rad)])).toEqual(
            [['punkt', 'Avviker mer än 5 %', 'romb', ['A']], ['punkt', 'Avviker 3–5 %', 'kvadrat', ['B']], ['punkt', 'Inom 3 %', 'cirkel', ['C']]]);
        expect(f.legend).toBeUndefined();
        expect(f.referens[0]).toMatchObject({ y: 100, etikett: 'Lika lön' });
        expect(f.x.ordning).toEqual(['A', 'B', 'C']);
        expect(() => valideraFigur(f, 't')).not.toThrow();
    });
    it('bubbeldiagrammet: linjerna vid 40 och 60 har etikett, och axeln säger vad storleken visar', () => {
        w.__m = { spec: { matt: 'median' }, celler: [cell('A', 30000), cell('B', 35000, 60)] };
        const f = w.eval('_figBubbla(window.__m)');
        expect(f.referens.map(r => r.etikett)).toEqual(['40 %', '60 %']);
        expect(f.x.titel).toMatch(/storlek.*antal/);
    });
    it('små multiplar: fler än åtta serier ger en panel per rad med kolumnvärdena på x-axeln', () => {
        const kols = ['20–24', '25–29', '30–34', '35–39', '40–44'];
        const celler = ['A', 'B'].flatMap(r => kols.map((k, i) => ({ ...cell(r, 30000 + i * 500), kol: k })));
        w.__m = { spec: { matt: 'median', delaKon: true }, radEtiketter: ['A', 'B'], kolumnEtiketter: kols, celler };
        const f = w.eval('_figGrupperade(window.__m)');
        expect(f.paneler).toEqual(['A', 'B']);
        expect(f.x.ordning).toEqual(kols);
        expect(f.lager.map(l => [l.panel, l.serie])).toEqual([['A', 'Kvinna'], ['A', 'Man'], ['B', 'Kvinna'], ['B', 'Man']]);
        expect(f.lager[0].data[0]).toMatchObject({ x: '20–24', y: 29500, rad: 'A', kol: '20–24' });
        expect(() => valideraFigur(f, 't')).not.toThrow();
        w.__f = f;
        const svg = w.eval('_rfByggSvg(window.__f, 900, {})');
        expect(svg.querySelectorAll('svg[data-del="panel"]')).toHaveLength(2);
        expect([...svg.querySelectorAll('[data-del="forklaring"] [data-serie]')].map(g => g.getAttribute('data-serie'))).toEqual(['Kvinna', 'Man']);
    });
});

// ---- Enskilda löner i spridningsdiagrammen ----
describe('spridningsdiagrammen: en person i en grupp under tröskeln visas inte som punkt', () => {
    const MARKOR = 73331;
    const rad = (yrke, bas, kon, lon, alder) => ({ bas, kon, lon, alder, yrke, aid: yrke.slice(0, 6), yrkeLabel: 'X', enhet: '' });
    const data = () => [
        ...Array.from({ length: 24 }, (_, i) => rad('207011 Usk', 'A', i % 2 ? 'man' : 'kvinna', 30000 + i * 50, 30 + i)),     // 12 + 12: visas
        ...Array.from({ length: 4 }, (_, i) => rad('502010 Sys', 'A', 'kvinna', MARKOR + i, 41 + i)),                          // liten grupp
        ...Array.from({ length: 14 }, (_, i) => rad('403010 Bsk', 'A', i < 3 ? 'man' : 'kvinna', i < 3 ? MARKOR + 10 + i : 28000 + i * 40, 25 + i))];   // 11 kv, 3 män
    const utdata2 = el => utdata(el).replace(/\s(?:c?[xy][12]?|r|d|width|height|transform)="[^"]*"/g, '').replace(/(\d)[\s  ](?=\d)/g, '$1');
    it('individLitenFor: liten när gruppen eller personens kön i gruppen är under tröskeln', () => {
        medData(data(), [], () => {
            const sma = w.eval('(() => { const f = individLitenFor(getData()); return getData().filter(f).map(r => r.lon); })()');
            expect(sma.sort()).toEqual([MARKOR, MARKOR + 1, MARKOR + 2, MARKOR + 3, MARKOR + 10, MARKOR + 11, MARKOR + 12]);
            w.eval('sattKTroskel(3, { fraga: false })');
            expect(w.eval('getData().filter(individLitenFor(getData())).length')).toBe(0);
        });
    });
    it.each([['chart-kon-scatter', "renderKon('__ALLA__')"]])(
        '%s: punkterna ritas inte, syns inte i exportbilden eller diagramdatan, och noten säger hur många', (id, rita) => {
        medData(data(), [], () => {
            w.eval(`populateSelects(); ${rita}`);
            const el = w.document.getElementById(id);
            const punkter = el._figur.lager.filter(l => l.marke === 'punkt').flatMap(l => l.data);
            expect(punkter).toHaveLength(42);
            expect(punkter.filter(p => p.liten)).toHaveLength(7);
            expect(el.querySelectorAll('[data-marke="punkt"]')).toHaveLength(35);
            expect(utdata2(el)).not.toMatch(/7333\d|7334\d|502010/);
            expect(w.document.getElementById(`${id}-k-not`).textContent).toMatch(/^.*7 personer visas inte som punkt/);
            // Trendlinjen bygger på alla — den finns kvar.
            expect(el._figur.lager.some(l => l.marke === 'linje')).toBe(true);
            // Sänkt tröskel: alla punkter visas, och noten om punkter försvinner.
            w.eval(`sattKTroskel(3, { fraga: false }); ${rita}`);
            expect(w.document.getElementById(id).querySelectorAll('[data-marke="punkt"]')).toHaveLength(42);
            expect(w.document.getElementById(`${id}-k-not`)?.textContent || '').not.toMatch(/visas inte som punkt/);
        });
    });
});

// ---- Länkade vyer: en markerad grupp framhävs i alla diagram ----
describe('länkade vyer: markering', () => {
    const fig = (namn, punkter) => ({ beskrivning: namn, x: { skala: 'band' }, y: { skala: 'linjar' },
        lager: [{ marke: 'stapel', serie: 'S', farg: '#2563eb', data: punkter }, { marke: 'linje', serie: 'L', farg: '#111111', data: punkter.map(p => ({ x: p.x, y: p.y })) }] });
    const rita = (id, f) => { const el = behallare(id); w.__el = el; w.__f = f; w.eval('ritaFigur(window.__el, window.__f, { bredd: 500 })'); return el; };
    const lage = el => [...el.querySelectorAll('rect[data-marke="stapel"]')].map(r => [r.hasAttribute('data-markerad'), r.getAttribute('opacity')]);
    const stada = (...els) => { w.eval('sattDiagramMarkering(null)'); for (const el of els) { w.__el = el; w.eval('rensaFigur(window.__el)'); } };
    it('markeringFor: BAS, och yrkesgruppen med yrkets sifferkod', () => {
        expect(w.eval("markeringFor('C')")).toEqual(['bas:C']);
        expect(w.eval("markeringFor('C', '207011 Undersköterska')")).toEqual(['bas:C', 'grupp:207011|C']);
        expect(w.eval("markeringFor('C', '207011')")).toEqual(['bas:C', 'grupp:207011|C']);
        expect(w.eval("markeringFor('', 'x')")).toEqual([]);
        expect(w.eval('markeringFor(null)')).toEqual([]);
    });
    it('ett klick på ett märke markerar gruppen i alla ritade diagram; ett klick till tar bort markeringen', () => {
        const a = rita('chart-mk-a', fig('A', [{ x: 'BAS B', y: 1, markering: ['bas:B'] }, { x: 'BAS C', y: 2, markering: ['bas:C'] }]));
        const b = rita('chart-mk-b', fig('B', [{ x: 'Usk', y: 3, markering: ['bas:C', 'grupp:207011|C'] }, { x: 'Sys', y: 4, markering: ['bas:C', 'grupp:502010|C'] }, { x: 'Bsk', y: 5, markering: ['bas:B', 'grupp:403010|B'] }]));
        const c = rita('chart-mk-c', fig('C', [{ x: 'p', y: 1 }, { x: 'q', y: 2 }]));     // inga grupper: rörs aldrig
        a.querySelector('rect[data-marke="stapel"][data-i="1"]').dispatchEvent(new w.Event('click', { bubbles: true }));
        expect(w.eval('diagramMarkering()')).toEqual(['bas:C']);
        expect(lage(a)).toEqual([[false, '0.22'], [true, null]]);
        expect(lage(b)).toEqual([[true, null], [true, null], [false, '0.22']]);            // ett BAS framhäver sina yrkesgrupper
        expect(lage(c)).toEqual([[false, null], [false, null]]);
        expect(a.querySelector('path[data-marke="linje"]').getAttribute('opacity')).toBeNull();   // linjer rörs inte
        const rad = w.document.getElementById('markering-rad');
        expect(rad.textContent).toContain('Markerat i alla diagram: BAS C');
        // En yrkesgrupp: bara den, och stapeln för dess BAS.
        b.querySelector('rect[data-marke="stapel"][data-i="0"]').dispatchEvent(new w.Event('click', { bubbles: true }));
        expect(w.eval('diagramMarkering()')).toEqual(['grupp:207011|C']);
        expect(lage(b)).toEqual([[true, null], [false, '0.22'], [false, '0.22']]);
        expect(lage(a)).toEqual([[false, '0.22'], [true, null]]);
        // Samma märke en gång till: markeringen tas bort, allt återställs och raden försvinner.
        b.querySelector('rect[data-marke="stapel"][data-i="0"]').dispatchEvent(new w.Event('click', { bubbles: true }));
        expect(w.eval('diagramMarkering()')).toBeNull();
        expect([...lage(a), ...lage(b)].every(([m, o]) => !m && o === null)).toBe(true);
        expect(w.document.getElementById('markering-rad')).toBeNull();
        stada(a, b, c);
    });
    it('ett diagram utan något märke för den markerade gruppen lämnas orört', () => {
        const a = rita('chart-mk-a', fig('A', [{ x: 'BAS B', y: 1, markering: ['bas:B'] }]));
        w.eval("sattDiagramMarkering('bas:FINNS-INTE')");
        expect(lage(a)).toEqual([[false, null]]);
        stada(a);
    });
    it('markeringen följer med vid omritning, syns inte i exporten och försvinner med Escape, raden och Rensa all data', () => {
        const f = fig('A', [{ x: 'BAS B', y: 1, markering: ['bas:B'] }, { x: 'BAS C', y: 2, markering: ['bas:C'] }]);
        const a = rita('chart-mk-a', f);
        w.eval("sattDiagramMarkering('bas:B')");
        w.eval('ritaFigur(window.__el, window.__f, { bredd: 420 })');                      // ny ritning: samma markering
        expect(lage(a)).toEqual([[true, null], [false, '0.22']]);
        const svg = w.figurTillSvg(f, 1600, 900, {});
        expect(svg).not.toMatch(/data-markerad|opacity="0\.22"|markering/);
        expect(JSON.stringify(w.eval('chartExportRows(window.__el)'))).not.toContain('markering');
        w.document.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        expect(w.eval('diagramMarkering()')).toBeNull();
        w.eval("sattDiagramMarkering('bas:B')");
        w.document.querySelector('#markering-rad button[data-markering="rensa"]').click();
        expect(w.eval('diagramMarkering()')).toBeNull();
        w.eval("sattDiagramMarkering('bas:B')");
        const sparat = w.__state.data;
        w.eval('_rensaAllData()');
        expect(w.eval('diagramMarkering()')).toBeNull();
        expect(w.document.getElementById('markering-rad')).toBeNull();
        w.__state.data = sparat;
    });
    it('i verktyget: ett klick på ett BAS i Lika arbete framhäver samma BAS i Lönepolitik, och gruppdossiern erbjuds för en yrkesgrupp', () => {
        const w2 = createAppWindow();
        w2.__loadDemoData();
        w2.__renderTabContent('matrix');
        w2.__renderTabContent('lonepolitik');
        const skev = w2.document.getElementById('chart-skevhet-overview');
        const stapel = skev.querySelector('[data-marke="punkt"]');
        const l = skev._figur.lager[Number(stapel.getAttribute('data-l'))], d = l.data[Number(stapel.getAttribute('data-i'))];
        stapel.dispatchEvent(new w2.Event('click', { bubbles: true }));
        expect(w2.eval('diagramMarkering()')).toEqual([d.markering[0]]);
        const lp = w2.document.getElementById('chart-lp-compliance');
        const markerade = [...lp.querySelectorAll('[data-markerad]')];
        expect(markerade.length).toBeGreaterThan(0);
        expect(markerade.every(m => lp._figur.lager[Number(m.getAttribute('data-l'))].data[Number(m.getAttribute('data-i'))].markering.includes(d.markering[0]))).toBe(true);
        expect(lp.querySelectorAll('[opacity="0.22"]').length).toBeGreaterThan(0);
        expect(w2.document.getElementById('markering-rad').textContent).toContain(`BAS ${d.markering[0].slice(4)}`);
        expect(w2.document.querySelector('#markering-rad [data-markering="dossier"]')).toBeNull();     // ett BAS har ingen dossier
        // En yrkesgrupp med dossier: knappen finns och öppnar den.
        const kand = w2.__gruppdossierCandidates()[0];
        w2.eval(`sattDiagramMarkering('grupp:${kand.key}')`);
        const knapp = w2.document.querySelector('#markering-rad [data-markering="dossier"]');
        expect(knapp).not.toBeNull();
        knapp.click();
        expect(w2.document.getElementById('dossier-modal').style.display).toBe('flex');
    });
});

describe('länkade vyer: flera grupper, tabeller och pensling', () => {
    const fig = punkter => ({ beskrivning: 'F', x: { skala: 'band' }, y: { skala: 'linjar' }, lager: [{ marke: 'stapel', serie: 'S', farg: '#2563eb', data: punkter }] });
    const rita = (id, f, val = '{ bredd: 500 }') => { const el = behallare(id); w.__el = el; w.__f = f; w.eval(`ritaFigur(window.__el, window.__f, ${val})`); return el; };
    const lage = el => [...el.querySelectorAll('rect[data-marke="stapel"]')].map(r => [r.hasAttribute('data-markerad'), r.getAttribute('opacity')]);
    const klick = (m, extra = {}) => { const e = new w.Event('click', { bubbles: true }); Object.assign(e, extra); m.dispatchEvent(e); };
    const stada = (...els) => { w.eval('sattDiagramMarkering(null)'); for (const el of els) { w.__el = el; w.eval('rensaFigur(window.__el)'); } };
    it('Ctrl-klick lägger till en grupp och tar bort den igen; ett vanligt klick ersätter', () => {
        const a = rita('chart-fl-a', fig([{ x: 'B', y: 1, markering: ['bas:B'] }, { x: 'C', y: 2, markering: ['bas:C'] }, { x: 'D', y: 3, markering: ['bas:D'] }]));
        const st = i => a.querySelector(`rect[data-marke="stapel"][data-i="${i}"]`);
        klick(st(0));
        klick(st(1), { ctrlKey: true });
        expect(w.eval('diagramMarkering()')).toEqual(['bas:B', 'bas:C']);
        expect(lage(a)).toEqual([[true, null], [true, null], [false, '0.22']]);
        expect(w.document.getElementById('markering-rad').textContent).toContain('BAS B · BAS C');
        klick(st(0), { metaKey: true });                                  // tas bort ur de markerade
        expect(w.eval('diagramMarkering()')).toEqual(['bas:C']);
        klick(st(2));                                                     // vanligt klick: ersätter
        expect(w.eval('diagramMarkering()')).toEqual(['bas:D']);
        klick(st(0), { shiftKey: true }); klick(st(1), { shiftKey: true });
        expect(w.eval('diagramMarkering()')).toEqual(['bas:D', 'bas:B', 'bas:C']);
        klick(st(1));                                                     // vanligt klick på en av flera: bara den
        expect(w.eval('diagramMarkering()')).toEqual(['bas:C']);
        stada(a);
    });
    it('raden visar högst tre namn och antalet övriga; gruppdossiern erbjuds bara när en enda yrkesgrupp är markerad', () => {
        for (const b of ['A', 'B', 'C', 'D', 'E']) w.eval(`sattDiagramMarkering('bas:${b}', { lagg: true })`);
        const rad = w.document.getElementById('markering-rad');
        expect(rad.textContent).toContain('BAS A · BAS B · BAS C + 2 till');
        expect(rad.querySelector('[data-markering="dossier"]')).toBeNull();
        expect(rad.title).toBe('Escape tar bort markeringen.');   // tipset om Ctrl-klick gäller bara en ensam markering
        w.eval('sattDiagramMarkering(null)');
    });
    it('tabellrader för en markerad grupp framhävs, och ett klick på en rad markerar gruppen — inte ett klick på en knapp i raden', () => {
        const t = w.document.createElement('table');
        t.innerHTML = `<tbody>
            <tr data-markering='["bas:B"]'><td>B</td><td><button type="button">Bevis</button></td></tr>
            <tr data-rad="207011|C"><td>Usk</td><td>C</td></tr>
            <tr><td>Sys</td><td><button type="button" data-yrke="502010 Sys" data-bas="C">↗</button></td></tr>
            <tr><td>utan grupp</td></tr></tbody>`;
        w.document.body.appendChild(t);
        const rader = [...t.querySelectorAll('tr')], markerade = () => rader.map(r => r.classList.contains('rad-markerad'));
        w.eval("sattDiagramMarkering('bas:C')");
        expect(markerade()).toEqual([false, true, true, false]);          // ett BAS framhäver sina yrkesgrupper
        w.eval("sattDiagramMarkering('grupp:502010|C')");
        expect(markerade()).toEqual([false, false, true, false]);
        klick(rader[0].cells[0]);
        expect(w.eval('diagramMarkering()')).toEqual(['bas:B']);
        expect(markerade()).toEqual([true, false, false, false]);
        klick(rader[0].querySelector('button'));                          // knappen i raden gör sitt, markerar inte
        expect(w.eval('diagramMarkering()')).toEqual(['bas:B']);
        klick(rader[1].cells[0], { ctrlKey: true });
        expect(w.eval('diagramMarkering()')).toEqual(['bas:B', 'grupp:207011|C']);
        klick(rader[3].cells[0]);                                         // rad utan grupp: ingenting händer
        expect(w.eval('diagramMarkering()')).toEqual(['bas:B', 'grupp:207011|C']);
        w.eval('sattDiagramMarkering(null)');
        expect(markerade()).toEqual([false, false, false, false]);
        t.remove();
    });
    it('i verktyget: tabellen i Lika arbete följer markeringen, också efter att fliken ritats om', () => {
        const w2 = createAppWindow();
        w2.__loadDemoData();
        w2.__renderTabContent('matrix');
        // En rad med könsuppdelat gap (rader för BAS där ett kön är under tröskeln byggs för sig och går inte att markera).
        const bas = [...w2.document.querySelectorAll('#paygap-table tbody tr')].find(r => Array.isArray(r._markering)).cells[0].textContent.trim();
        w2.eval(`sattDiagramMarkering('bas:${bas}')`);
        const markerade = () => [...w2.document.querySelectorAll('#paygap-table tbody tr.rad-markerad')].map(r => r.cells[0].textContent.trim());
        expect(markerade()).toEqual([bas]);
        w2.__renderTabContent('matrix');                                  // raderna byggs om: markeringen sätts på de nya
        expect(markerade()).toEqual([bas]);
        expect(w2.document.querySelectorAll('#skevhet-table tbody tr.rad-markerad').length).toBe(1);
    });
    it('pensling: punkterna i området framhävs, noten säger antal och median per serie, och ett klick eller Escape tar bort den', () => {
        const f = { beskrivning: 'P', x: { skala: 'linjar' }, y: { skala: 'linjar', format: 'kr' },
            lager: [{ marke: 'punkt', serie: 'Kvinna', farg: '#833a8f', data: [{ x: 30, y: 30000 }, { x: 35, y: 32000 }, { x: 60, y: 50000 }, { x: 33, y: 99999, liten: true }] },
                    { marke: 'punkt', serie: 'Man', farg: '#2a78d6', data: [{ x: 31, y: 34000 }, { x: 62, y: 52000 }] }] };
        const el = rita('chart-pensel', f);
        const pkt = [...el.querySelectorAll('circle[data-marke="punkt"]')];
        expect(pkt).toHaveLength(5);                                       // den lilla punkten ritas inte
        const xs = pkt.map(c => Number(c.getAttribute('cx'))), ys = pkt.map(c => Number(c.getAttribute('cy')));
        // Ett område kring de tre yngsta (x 30–35): från lägsta cx till strax före nästa.
        const gruppen = [0, 1, 3];
        w.__omr = [Math.min(...gruppen.map(i => xs[i])) - 2, Math.min(...gruppen.map(i => ys[i])) - 2, Math.max(...gruppen.map(i => xs[i])) + 2, Math.max(...gruppen.map(i => ys[i])) + 2];
        const ut = w.eval('_rfPensla(window.__el, 0, ...window.__omr)');
        expect(ut).toEqual({ antal: 3, serier: [{ serie: 'Kvinna', antal: 2, median: 31000 }, { serie: 'Man', antal: 1, median: 34000 }] });
        expect(pkt.map(c => [c.hasAttribute('data-penslad'), c.getAttribute('opacity')])).toEqual([[true, null], [true, null], [false, '0.22'], [true, null], [false, '0.22']]);
        const not = el.nextElementSibling;
        expect(not.getAttribute('data-rf')).toBe('pensel');
        expect(not.textContent.replace(/[\u00a0\u202f]/g, ' ')).toMatch(/^Penslat område: 3 punkter — Kvinna 2 \(median 31 000 kr\) · Man 1 \(median 34 000 kr\)\./);
        expect(not.textContent).not.toContain('99');                       // den dolda punkten räknas inte
        expect(el.querySelector('rect[data-del="pensel"]')).not.toBeNull();
        // Exporten bär varken rutan eller nedtoningen.
        expect(w.figurTillSvg(f, 1600, 900, {})).not.toMatch(/pensel|penslad|opacity="0\.22"/);
        // Escape tar bort området.
        w.document.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        expect(el._rfPensel).toBeUndefined();
        expect(el.querySelector('rect[data-del="pensel"]')).toBeNull();
        expect(pkt.every(c => !c.hasAttribute('data-penslad') && c.getAttribute('opacity') === null)).toBe(true);
        expect(w.document.querySelector('[data-rf="pensel"]')).toBeNull();
        // En omritning och rensaFigur tar också bort noten.
        w.eval('_rfPensla(window.__el, 0, ...window.__omr)');
        w.eval('ritaFigur(window.__el, window.__f, { bredd: 480 })');
        expect(w.document.querySelector('[data-rf="pensel"]')).toBeNull();
        w.eval('_rfPensla(window.__el, 0, 0, 0, 9999, 9999)');
        w.eval('rensaFigur(window.__el)');
        expect(w.document.querySelector('[data-rf="pensel"]')).toBeNull();
    });
    it('pensling går inte i ett stapeldiagram, och ett tomt område säger att det är tomt', () => {
        const a = rita('chart-fl-a', fig([{ x: 'B', y: 1 }]));
        expect(w.eval('_rfPensla(window.__el, 0, 0, 0, 500, 500)')).toBeNull();
        expect(w.document.querySelector('[data-rf="pensel"]')).toBeNull();
        stada(a);
        const el = rita('chart-pensel', { beskrivning: 'P', x: { skala: 'linjar' }, y: { skala: 'linjar' }, lager: [{ marke: 'punkt', serie: 'S', farg: '#2563eb', data: [{ x: 1, y: 1 }, { x: 2, y: 2 }] }] });
        expect(w.eval('_rfPensla(window.__el, 0, -50, -50, -40, -40)')).toEqual({ antal: 0, serier: [] });
        expect(el.nextElementSibling.textContent).toMatch(/inga punkter/);
        stada(el);
    });
    it('zoom: "Zooma hit" ritar om med områdets omfång, exporten säger utsnitt, och "Visa hela diagrammet" tar bort det', () => {
        const f = { beskrivning: 'Z', x: { skala: 'linjar' }, y: { skala: 'linjar', format: 'kr' },
            lager: [{ marke: 'punkt', serie: 'Kvinna', farg: '#833a8f', data: [{ x: 30, y: 30000 }, { x: 35, y: 32000 }, { x: 60, y: 50000 }, { x: 33, y: 99999, liten: true }] },
                    { marke: 'punkt', serie: 'Man', farg: '#2a78d6', data: [{ x: 31, y: 34000 }, { x: 62, y: 52000 }] }] };
        const el = rita('chart-zoom', f);
        const pkt = [...el.querySelectorAll('circle[data-marke="punkt"]')];
        const xs = pkt.map(c => Number(c.getAttribute('cx'))), ys = pkt.map(c => Number(c.getAttribute('cy')));
        const gruppen = [0, 1, 3];
        w.__omr = [Math.min(...gruppen.map(i => xs[i])) - 2, Math.min(...gruppen.map(i => ys[i])) - 2, Math.max(...gruppen.map(i => xs[i])) + 2, Math.max(...gruppen.map(i => ys[i])) + 2];
        w.eval('_rfPensla(window.__el, 0, ...window.__omr)');
        const knapp = el.nextElementSibling.querySelector('button');
        expect(knapp.textContent).toBe('Zooma hit');
        knapp.click();
        // Omfånget kommer ur de ritade punkterna i området (30–35 år, 30 000–34 000 kr) med lite luft — inte ur den dolda punkten.
        const z = el._rfZoom;
        expect(z.x[0]).toBeLessThan(30); expect(z.x[0]).toBeGreaterThan(29); expect(z.x[1]).toBeGreaterThan(35); expect(z.x[1]).toBeLessThan(36);
        expect(z.y[0]).toBeLessThan(30000); expect(z.y[0]).toBeGreaterThan(29000); expect(z.y[1]).toBeGreaterThan(34000); expect(z.y[1]).toBeLessThan(35000);
        expect(el._figur).toBe(f);                                          // figuren är orörd: zoomen är en vy av den
        expect(f.x.doman).toBeUndefined();
        expect(w.document.querySelector('[data-rf="pensel"]')).toBeNull();
        const not = el.nextElementSibling;
        expect(not.getAttribute('data-rf')).toBe('zoom');
        expect(not.textContent).toMatch(/utsnitt/);
        expect(el.querySelector(':scope > svg').outerHTML).not.toMatch(/(?<![\d.])99[\s\u00a0\u202f]?999(?!\d)/);   // den dolda punktens lön
        // Exporten: bilden ritas ur utsnittet, fotraden säger det, och tabellen bär alla rader som får visas.
        const u = w.eval('_rfExportFigur(window.__el)');
        expect(u.figur).toBe(f);
        expect(u.utsnitt).toBe(true);
        expect(u.bild.x.doman).toEqual(z.x);
        expect(u.bild.lager).toBe(f.lager);
        expect(w.eval('_chartExportRubrikFot(window.__el, new Date(2026, 9, 10)).fot')).toMatch(/Utsnitt av diagrammet$/);
        expect(w.figurTillSvg(u.bild, 1600, 900, {})).not.toMatch(/(?<![\d.])99[\s\u00a0\u202f]?999(?!\d)/);
        expect(w.eval('chartExportRows(window.__el)').length).toBe(w.eval('(() => { const e = window.__el, z = e._rfZoom; delete e._rfZoom; const n = chartExportRows(e).length; e._rfZoom = z; return n; })()'));
        // Storleksändring behåller utsnittet; "Visa hela diagrammet" tar bort det.
        w.eval('_rfRitaOm(window.__el)');
        expect(el._rfZoom).toEqual(z);
        not.querySelector('button').click();
        expect(el._rfZoom).toBeUndefined();
        expect(w.document.querySelector('[data-rf="zoom"]')).toBeNull();
        expect(w.eval('_chartExportRubrikFot(window.__el, new Date(2026, 9, 10)).fot')).not.toMatch(/Utsnitt/);
        // En ny figur från vyn, och rensaFigur, tar också bort utsnittet.
        for (const slut of ['ritaFigur(window.__el, window.__f, { bredd: 480 })', 'rensaFigur(window.__el)']) {
            w.eval('ritaFigur(window.__el, window.__f, { bredd: 500 })');
            const p2 = [...el.querySelectorAll('circle[data-marke="punkt"]')];
            w.eval('_rfPensla(window.__el, 0, 0, 0, 9999, 9999)');
            el.nextElementSibling.querySelector('button').click();
            expect(p2.length).toBe(5);
            expect(el._rfZoom).toBeDefined();
            w.eval(slut);
            expect(el._rfZoom).toBeUndefined();
            expect(w.document.querySelector('[data-rf="zoom"]')).toBeNull();
        }
    });
    it('zoom: en enda punkt i området ger ingen zoomknapp', () => {
        const el = rita('chart-zoom', { beskrivning: 'Z', x: { skala: 'linjar' }, y: { skala: 'linjar' }, lager: [{ marke: 'punkt', serie: 'S', farg: '#2563eb', data: [{ x: 1, y: 1 }, { x: 9, y: 9 }] }] });
        const c = el.querySelector('circle[data-marke="punkt"]');
        w.__omr = [Number(c.getAttribute('cx')) - 2, Number(c.getAttribute('cy')) - 2, Number(c.getAttribute('cx')) + 2, Number(c.getAttribute('cy')) + 2];
        expect(w.eval('_rfPensla(window.__el, 0, ...window.__omr)').antal).toBe(1);
        expect(el.nextElementSibling.querySelector('button')).toBeNull();
        stada(el);
    });
});
describe('nedborrning: från ett markerat BAS till yrkesgrupperna i Utforska, och tillbaka', () => {
    const oppna = () => {
        const w2 = createAppWindow();
        const rad = (yrke, bas, kon, lon) => ({ bas, kon, lon, alder: 40, yrke, aid: yrke.slice(0, 6), yrkeLabel: yrke.slice(7) });
        w2.__state.data = [...Array.from({ length: 24 }, (_, i) => rad('207011 Usk', 'A', i % 2 ? 'man' : 'kvinna', 30000 + i * 7)),
                           ...Array.from({ length: 24 }, (_, i) => rad('502010 Sys', 'A', i % 2 ? 'man' : 'kvinna', 34000 + i * 9)),
                           ...Array.from({ length: 24 }, (_, i) => rad('403010 Bsk', 'B', i % 2 ? 'man' : 'kvinna', 26000 + i * 11))];
        w2.eval('populateSelects(); unlockTabs();');
        w2.__renderTabContent('utforska');
        return w2;
    };
    const knapp = w2 => w2.document.querySelector('#markering-rad button[data-markering="borra"]');
    it('knappen finns bara när exakt ett BAS-intervall är markerat', () => {
        const w2 = oppna();
        w2.eval("sattDiagramMarkering('bas:A')");
        expect(knapp(w2).textContent).toBe('Visa yrkesgrupperna');
        expect(knapp(w2).title).toMatch(/under tröskeln/);
        w2.eval("sattDiagramMarkering('bas:B', { lagg: true })");
        expect(knapp(w2)).toBeNull();
        w2.eval("sattDiagramMarkering('grupp:207011|A')");
        expect(knapp(w2)).toBeNull();
    });
    it('knappen sätter urvalet till BAS-intervallet och raderna till yrkesgrupp inom BAS; raden i Utforska leder tillbaka', () => {
        const w2 = oppna(), d = w2.document;
        const innan = { lage: 'alla', villkor: [{ falt: 'bas', op: 'enAv', varde: ['B'], inte: false }] };
        w2.__innan = innan;
        w2.eval('explorerSattUrval(window.__innan, [])');
        d.getElementById('explore-rad').value = 'bas';
        d.getElementById('explore-kolumn').value = 'kon';
        const not = d.getElementById('explore-nedborrning');
        expect(not.hidden).toBe(true);
        w2.eval("sattDiagramMarkering('bas:A')");
        knapp(w2).click();
        expect(w2.eval('explorerUrval()')).toEqual({ urval: { lage: 'alla', villkor: [{ falt: 'bas', op: 'enAv', varde: ['A'], inte: false }] }, gruppVillkor: [] });
        expect(d.getElementById('explore-rad').value).toBe('aidbas');
        expect(d.getElementById('explore-kolumn').value).toBe('ingen');
        expect(not.hidden).toBe(false);
        expect(not.textContent).toMatch(/Du kom hit från BAS A/);
        expect(not.textContent).toMatch(/färre än 10 personer följer inte med i en export/);
        // Diagrammet visar de två yrkesgrupperna i BAS A.
        const etiketter = JSON.stringify(d.getElementById('chart-explore')._figur.lager.map(l => l.data.map(p => p.x ?? p.y)));
        expect(etiketter).toMatch(/Usk/); expect(etiketter).toMatch(/Sys/); expect(etiketter).not.toMatch(/Bsk/);
        // En borrning till: vägen tillbaka leder fortfarande till det första urvalet.
        w2.eval("sattDiagramMarkering('bas:B')");
        knapp(w2).click();
        expect(not.textContent).toMatch(/BAS B/);
        not.querySelector('button').click();
        expect(w2.eval('explorerUrval()')).toEqual({ urval: innan, gruppVillkor: [] });
        expect(d.getElementById('explore-rad').value).toBe('bas');
        expect(d.getElementById('explore-kolumn').value).toBe('kon');
        expect(not.hidden).toBe(true);
        expect(not.textContent).toBe('');
    });
    it('"Rensa all data" glömmer vägen tillbaka', () => {
        const w2 = oppna();
        w2.eval("sattDiagramMarkering('bas:A')");
        knapp(w2).click();
        w2.eval('explorerSlappMinne()');
        expect(w2.document.getElementById('explore-nedborrning').hidden).toBe(true);
        const efter = w2.eval('explorerUrval()');
        w2.eval('nedborrningTillbaka()');                                  // inget sparat: gör ingenting
        expect(w2.eval('explorerUrval()')).toEqual(efter);
    });
});

describe('statusfärgerna syns: kontrast mot vit bakgrund och åtskillnad i ljushet', () => {
    const lum = hex => { const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(v => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
    const kontrast = hex => 1.05 / (lum(hex) + 0.05);
    // Paletten läses ur källan (PALETTE är en const i appens eget skript och nås inte utifrån).
    const palett = () => {
        const t = readFileSync('src/app/10-diagramtema.js', 'utf8');
        // Ett värde är en hexkod eller en hänvisning till statusfärgernas tabell (FARG i 01-farger.js, ADR-43).
        const FARG = Object.fromEntries([...readFileSync('src/app/01-farger.js', 'utf8').matchAll(/(\w+): '(#[0-9a-f]{6})'/g)].map(m => [m[1], m[2]]));
        const farg = (block, namn) => { const m = new RegExp(`${namn}:\\s*(?:'(#[0-9a-f]{6})'|FARG\\.(\\w+))`).exec(block) || []; return m[1] || FARG[m[2]]; };
        const sem = /semantic: \{([\s\S]*?)\n {4}\}/.exec(t)[1], prio = /prio: \{([^}]*)\}/.exec(t)[1];
        return { s: Object.fromEntries(['kritisk', 'varning', 'ok'].map(n => [n, farg(sem, n)])),
                 p: Object.fromEntries(['akut', 'atgard', 'bevaka', 'ok', 'analysera'].map(n => [n, farg(prio, n)])) };
    };
    it('kritisk, varning och ok har minst 3:1 mot vitt (WCAG 1.4.11), liksom prioriteringens statusfärger', () => {
        const P = palett();
        for (const [namn, hex] of [...['kritisk', 'varning', 'ok'].map(n => [n, P.s[n]]), ...Object.entries(P.p)]) expect(kontrast(hex), `${namn} ${hex}`).toBeGreaterThanOrEqual(3);
    });
    it('varningen är tydligt ljusare än kritisk och ok — de tre skiljs åt utan att färgtonen behöver uppfattas', () => {
        const s = palett().s;
        expect(lum(s.varning) / lum(s.kritisk)).toBeGreaterThan(2);
        expect(lum(s.varning) / lum(s.ok)).toBeGreaterThan(1.8);
        // Kritisk och ok ligger nära i ljushet: de skiljs på blåandelen (rött mot blågrönt), och i diagrammen på mönster.
        const bla = hex => parseInt(hex.slice(5, 7), 16);
        expect(bla(s.ok) - bla(s.kritisk)).toBeGreaterThan(60);
    });
});

// ---- Tangentbord mellan datapunkterna ----
describe('tangentbord i diagrammen', () => {
    const fig = () => ({ beskrivning: 'T', x: { skala: 'band' }, y: { skala: 'linjar' },
        lager: [{ marke: 'stapel', serie: 'Kvinna', farg: '#833a8f', tips: d => [[d.x], ['Värde', String(d.y)]],
                  data: [{ x: 'A', y: 1, markering: ['bas:A'] }, { x: 'HEMLIG', y: 99, liten: true }, { x: 'B', y: 2, markering: ['bas:B'] }] },
                { marke: 'stapel', serie: 'Man', farg: '#2a78d6', tips: d => [[d.x], ['Värde', String(d.y)]], data: [{ x: 'A', y: 3 }] }] });
    const rita = (val = '{ bredd: 500 }') => { const el = behallare('chart-tang'); w.__el = el; w.__f = fig(); w.eval(`ritaFigur(window.__el, window.__f, ${val})`); return el; };
    const tryck = (el, key, extra = {}) => { const e = new w.KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...extra }); el.querySelector('[data-del="rityta"]').dispatchEvent(e); return e; };
    const fokus = el => { const m = el.querySelector('[data-fokus]'); return m ? `${m.getAttribute('data-l')}/${m.getAttribute('data-i')}` : null; };
    const stada = el => { w.eval('sattDiagramMarkering(null)'); w.__el = el; w.eval('rensaFigur(window.__el)'); };
    it('ritytan går att nå med Tab och säger hur man navigerar', () => {
        const el = rita(), yta = el.querySelector('[data-del="rityta"]');
        expect(yta.getAttribute('tabindex')).toBe('0');
        expect(yta.getAttribute('aria-label')).toMatch(/Piltangenterna/);
        stada(el);
    });
    it('piltangenterna går mellan de ritade märkena i ritordning; den dolda lilla punkten finns inte i ordningen', () => {
        const el = rita();
        expect(fokus(el)).toBeNull();
        tryck(el, 'ArrowRight'); expect(fokus(el)).toBe('0/0');
        tryck(el, 'ArrowRight'); expect(fokus(el)).toBe('0/2');           // hoppar över den lilla (index 1)
        tryck(el, 'ArrowDown');  expect(fokus(el)).toBe('1/0');
        tryck(el, 'ArrowRight'); expect(fokus(el)).toBe('1/0');           // stannar på den sista
        tryck(el, 'ArrowLeft');  expect(fokus(el)).toBe('0/2');
        tryck(el, 'Home');       expect(fokus(el)).toBe('0/0');
        tryck(el, 'End');        expect(fokus(el)).toBe('1/0');
        expect(el.querySelectorAll('[data-fokus]')).toHaveLength(1);
        expect(el.outerHTML).not.toContain('HEMLIG');
        stada(el);
    });
    it('märket med fokus visar sitt verktygstips, och piltangenten rullar inte sidan', () => {
        const el = rita();
        const e = tryck(el, 'ArrowRight');
        expect(e.defaultPrevented).toBe(true);
        const tips = w.document.querySelector('.chart-tip-portal');
        expect(tips.textContent).toContain('A');
        expect(tips.textContent).toContain('Värde: 1');
        tryck(el, 'ArrowRight');
        expect(tips.textContent).toContain('Värde: 2');
        stada(el);
    });
    it('texten som läses upp: serien, tipsets rader och platsen i ordningen', () => {
        expect(w.eval("_rfTipsText([['BAS C'], ['Median', '31 000 kr'], ['Antal', null]])")).toBe('BAS C. Median: 31 000 kr. Antal: –');
        expect(w.eval('_rfTipsText(null)')).toBe('');
    });
    it('Enter gör det ett klick gör: markerar gruppen och kör vyns hanterare; Escape lämnar märket', () => {
        const klick = [];
        w.__klick = d => klick.push(d.x);
        const el = rita('{ bredd: 500, vidKlick: window.__klick }');
        tryck(el, 'Enter');                                               // inget märke har fokus: ingenting händer
        expect(klick).toEqual([]);
        tryck(el, 'ArrowRight'); tryck(el, 'ArrowRight');
        const e = tryck(el, 'Enter');
        expect(e.defaultPrevented).toBe(true);
        expect(klick).toEqual(['B']);
        expect(w.eval('diagramMarkering()')).toEqual(['bas:B']);
        tryck(el, 'Home'); tryck(el, ' ', { ctrlKey: true });             // mellanslag med Ctrl lägger till
        expect(w.eval('diagramMarkering()')).toEqual(['bas:B', 'bas:A']);
        const esc = tryck(el, 'Escape');
        expect(fokus(el)).toBeNull();
        expect(w.document.querySelector('.chart-tip-portal').textContent).toBe('');
        expect(esc.cancelBubble || w.eval('diagramMarkering()') !== null).toBe(true);   // det första Escape tar inte bort markeringen
        stada(el);
    });
    it('fokus försvinner när ritytan lämnas och när diagrammet ritas om', () => {
        const el = rita();
        tryck(el, 'ArrowRight');
        el.querySelector('[data-del="rityta"]').dispatchEvent(new w.Event('focusout', { bubbles: true }));
        expect(fokus(el)).toBeNull();
        tryck(el, 'ArrowRight');
        w.eval('ritaFigur(window.__el, window.__f, { bredd: 480 })');
        expect(fokus(el)).toBeNull();
        tryck(el, 'ArrowRight'); expect(fokus(el)).toBe('0/0');           // börjar om från början
        stada(el);
    });
    it('en låda är ett märke, hur många delar den än ritas med; individpunkter är egna märken', () => {
        const el = behallare('chart-tang');
        w.__el = el;
        w.__f = { beskrivning: 'L', x: { skala: 'band' }, y: { skala: 'linjar' },
            lager: [{ marke: 'lada', serie: 'Lön', tips: (d, s) => [[d.x], ['Median', String(s ? s.median : d.y)]],
                      data: [...[1, 2, 3, 4, 50].map(y => ({ x: 'A', y })), ...[5, 6, 7, 8].map(y => ({ x: 'B', y }))] }] };
        w.eval('ritaFigur(window.__el, window.__f, { bredd: 500 })');
        const lador = w.eval('_rfTangentMarken(window.__el)').filter(m => m.getAttribute('data-marke') !== 'avvikare');
        expect(new Set(lador.map(m => w.eval('_rfLadKategoriFor')(el, m))).size).toBe(2);
        expect(lador).toHaveLength(2);
        stada(el);
    });
});

describe('skillnaden i kronor per månad', () => {
    const p = (kon, alder, lon, yrke = 'Y1', bas = 'A') => ({ kon, alder, lon, yrke, aid: yrke, bas });
    it('kvoten per BAS: datapunkten bär skillnaden avrundad till hundratal, tipset och diagramdatan säger den', () => {
        const f = w.eval(`_skevhetFigur([{ bas: '3', gap: 92.4, n: 40, ci: null, medKv: 38870, medMa: 42070 }])`);
        const d = f.lager[0].data[0];
        expect(d.skillnadKr).toBe(-3200);
        expect(f.lager[0].tips(d)).toEqual([['BAS 3'], ['Kvinnors median', '92,4 % av männens'], ['Skillnad', '−3\u00a0200 kr/mån'], ['95 % KI', '–'], ['Antal', '40']]);
        const tab = figurTillTabell(f);
        expect(tab[0].at(-1)).toBe('Skillnad (kr/mån)');
        expect(tab[1].at(-1)).toBe(-3200);
        expect(() => valideraFigur(f, 't')).not.toThrow();
    });
    it('utan medianer: ingen rad i tipset och ingen kolumn i diagramdatan', () => {
        const f = w.eval(`_skevhetFigur([{ bas: '7', gap: 99.1, n: 61, ci: null }])`);
        expect(f.lager[0].tips(f.lager[0].data[0]).map(r => r[0])).not.toContain('Skillnad');
        expect(figurTillTabell(f)[0]).not.toContain('Skillnad (kr/mån)');
    });
    it('lönegap per åldersgrupp: skillnaden för åldersgrupper där båda könen når tröskeln, ingen för den dolda', () => {
        w.__kv = [...Array.from({ length: 12 }, (_, i) => p('kvinna', 34, 30000 + i * 100)), ...Array.from({ length: 3 }, (_, i) => p('kvinna', 62, 71111 + i))];
        w.__ma = [...Array.from({ length: 12 }, (_, i) => p('man', 35, 32000 + i * 100)), ...Array.from({ length: 12 }, (_, i) => p('man', 63, 40000 + i * 100))];
        w.__r = w.eval('_konAlderGapRader(window.__kv, window.__ma, 10)').visade;
        const f = w.eval('_konAlderGapFigur(window.__r, "hela urvalet")');
        const data = f.lager.flatMap(l => l.data);
        expect(data.map(d => [d.y, d.skillnadKr])).toEqual([['30–39 år', -2000]]);
        expect(f.lager[0].tips(data[0])).toContainEqual(['Skillnad', '−2\u00a0000 kr/mån']);
        expect(JSON.stringify(figurTillTabell(f))).not.toMatch(/60 år/);
    });
    it('trattdiagrammet: varje yrkesgrupp bär sin skillnad', () => {
        const grupp = (yrke, n, kvLon, maLon) => [...Array.from({ length: n }, (_, i) => p('kvinna', 40, kvLon + i, yrke)), ...Array.from({ length: n }, (_, i) => p('man', 40, maLon + i, yrke))];
        w.__d = [...grupp('A', 12, 30000, 31500), ...grupp('B', 12, 33000, 33000)];
        w.__u = w.eval('_laTrattUnderlag(window.__d, 10)');
        const f = w.eval('_laTrattFigur(window.__u, 10)');
        const data = f.lager.slice(1).flatMap(l => l.data);
        expect(Object.fromEntries(data.map(d => [d.p.yrke, d.skillnadKr]))).toEqual({ A: -1500, B: 0 });
        const tipsA = f.lager.slice(1).find(l => l.data.some(d => d.p.yrke === 'A')).tips(data.find(d => d.p.yrke === 'A'));
        expect(tipsA).toContainEqual(['Skillnad', '−1\u00a0500 kr/mån']);
        expect(() => valideraFigur(f, 't')).not.toThrow();
    });
    it('percentilerna: tipset och diagramdatan bär skillnaden vid varje percentil', () => {
        const f = w.eval(`_strukturPercentilFigur([{ p: 10, kv: 30000, ma: 34000, gapPct: -11.76 }, { p: 50, kv: 36040, ma: 42000, gapPct: -14.19 }])`);
        expect(f.lager[0].data.map(d => d.skillnadKr)).toEqual([-4000, -6000]);
        expect(f.lager[1].tips(f.lager[1].data[0])).toContainEqual(['Skillnad', '−4\u00a0000 kr/mån']);
        expect(figurTillTabell(f)[0].at(-1)).toBe('Skillnad (kr/mån)');
    });
});

describe('metodförbehåll under diagram', () => {
    it('_setDiagramMetodNot: egen not efter k-noten, skriver inte över den, och tom text tar bort den', () => {
        const w2 = createAppWindow(), d = w2.document;
        const yta = d.createElement('div'); yta.innerHTML = '<div class="chart-container"><div id="chart-provnot"></div></div>'; d.body.appendChild(yta);
        w2.eval(`_setDiagramKNot('chart-provnot', 'K-noten.'); _setDiagramMetodNot('chart-provnot', 'Förbehållet.')`);
        const k = d.getElementById('chart-provnot-k-not'), m = d.getElementById('chart-provnot-metod-not');
        expect(k.textContent).toBe('K-noten.');
        expect(m.textContent).toBe('Förbehållet.');
        expect(k.nextElementSibling).toBe(m);
        w2.eval(`_setDiagramMetodNot('chart-provnot', 'Nytt förbehåll.')`);
        expect(d.getElementById('chart-provnot-k-not').textContent).toBe('K-noten.');
        expect(d.querySelectorAll('#chart-provnot-metod-not')).toHaveLength(1);
        w2.eval(`_setDiagramMetodNot('chart-provnot', '')`);
        expect(d.getElementById('chart-provnot-metod-not')).toBeNull();
        expect(d.getElementById('chart-provnot-k-not')).not.toBeNull();
    });
    it('trattdiagrammet: förbehållet vid färre än tio grupper, inte vid tio eller fler', () => {
        expect(w.eval('_laTrattGlesNot(9)')).toBe('Med färre än tio grupper säger trattens form lite; bedöm varje grupp för sig i tabellen.');
        expect(w.eval('_laTrattGlesNot(10)')).toBeNull();
        expect(w.eval('_laTrattGlesNot(0)')).toBeNull();
    });
    it('i verktyget: noten under tratten och samma mening under diagrammet i rapporten; metodbilagan har raden', () => {
        const w2 = createAppWindow();
        w2.__loadDemoData();
        w2.__renderTabContent('matrix');
        const d = w2.document, antal = d.getElementById('chart-la-tratt')._figur.lager.filter(l => l.marke === 'punkt').reduce((n, l) => n + l.data.length, 0);
        const not = d.getElementById('chart-la-tratt-metod-not');
        const delar = w2.eval('rapportModell({ alla: true })').avsnitt.flatMap(a => a.delar);
        const i = delar.findIndex(p => p.typ === 'diagram' && p.id === 'chart-la-tratt');
        if (antal < 10) {
            expect(not.textContent).toMatch(/färre än tio grupper/);
            expect(delar[i + 1]).toEqual({ typ: 'stycke', text: expect.stringMatching(/färre än tio grupper/), stil: 'dampad' });
        } else {
            expect(not).toBeNull();
            expect(delar[i + 1]?.text || '').not.toMatch(/färre än tio grupper/);
        }
        expect(w2.eval('_methodAppendixData()').map(r => r[0])).toContain('Trattdiagrammet');
    });
});

describe('Lönefördelningen per BAS-intervall som kvantilpunkter (figuren)', () => {
    const p = (kon, lon, bas) => ({ kon, alder: 40, lon, yrke: 'Y', aid: 'Y', bas });
    it('formen kvantiler med 20 prickar; små kön-och-BAS-celler är märkta och lämnar inget i exporten', () => {
        w.__rader = [...Array.from({ length: 30 }, (_, i) => p('kvinna', 30000 + i * 50, 'A')), ...Array.from({ length: 30 }, (_, i) => p('man', 31000 + i * 50, 'A')),
                     ...Array.from({ length: 3 }, (_, i) => p('man', 77777 + i, 'B')), ...Array.from({ length: 12 }, (_, i) => p('kvinna', 35000 + i, 'B'))];
        const { figur, utelamnade } = w.eval('_konTathetFigur(window.__rader, true, 10, "kvantiler")');
        expect(figur.lager.map(l => [l.serie, l.form, l.antal])).toEqual([['Kvinna', 'kvantiler', 20], ['Man', 'kvantiler', 20]]);
        expect(utelamnade).toEqual(['BAS B (män)']);
        expect(figur.beskrivning).toMatch(/tjugondel/);
        expect(() => valideraFigur(figur, 't')).not.toThrow();
        expect(JSON.stringify(figurTillTabell(w.eval('_figUtanSma')(figur)))).not.toMatch(/7777/);
    });

});

describe('radpaneler i vyerna', () => {
    it('Utforskas hantel och jämförelseflikens två figurer delas vid fler än femton kategorier', () => {
        const w2 = createAppWindow();
        w2.__loadDemoData();
        w2.__renderTabContent('utforska');
        const d = w2.document;
        for (const [id, v] of Object.entries({ 'explore-rad': 'aidbas', 'explore-kolumn': 'ingen', 'explore-typ': 'hantel' })) d.getElementById(id).value = v;
        w2.__renderExplorer();
        const el = d.getElementById('chart-explore');
        expect(el._figur.paneler).toBe('auto');
        const n = el._figur.y.ordning.length;
        const svg = el.querySelector(':scope > svg');
        expect(svg.getAttribute('data-radpaneler')).toBe(n > 15 ? String(Math.ceil(n / 15)) : null);
        expect(w2.eval('_jmfSpannFigur([], "statistik", "S", "s")').paneler).toBe('auto');
        expect(w2.eval('_jmfAvvikelseFigur([], "statistik", "S")').paneler).toBe('auto');
    });
});

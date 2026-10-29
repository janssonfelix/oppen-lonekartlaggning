// Vyer som ritas med diagramkärnan (ADR-39): den gemensamma bildvägen och varje vys figur.
// Delen här: märkena (trappa, punktsvärm, lutning, övergångar, andelsstaplar, täthet, regnmoln, trädkarta),
// utskriften och talformatet; resten i diagramvyer.test.js (riggen i helpers/diagramvyer-rigg.js).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { valideraFigur, figurTillTabell, utanSmaGrupper } from '../src/lib/figur.js';
import { createAppWindow } from './helpers/app-harness.js';
import { vanliga, KALLA, person, skapaRigg } from './helpers/diagramvyer-rigg.js';

const { w, behallare, utdata, medData } = skapaRigg();

describe('Lika arbete: trappan, gapet längs lönefördelningen och hanteln per BAS', () => {
    const steg = [{ name: 'Endast kön', status: 'ok', gapPct: -9.4 }, { name: '+ BAS-intervall', status: 'ok', gapPct: -4.1 }, { name: '+ Ålder', status: 'ok', gapPct: -4.6 }];
    it('trappan: ojusterat och oförklarat gap som staplar, varje steg som ett spann från gapet före till gapet efter', () => {
        w.__s = steg;
        const f = w.eval('_regTrappaFigur(window.__s)');
        expect(f.x.ordning).toEqual(['Ojusterat gap', 'BAS-intervall', 'Ålder', 'Oförklarat gap']);
        expect(f.lager.map(l => l.marke)).toEqual(['stapel', 'intervall', 'punkt']);
        expect(f.lager[0].data).toEqual([{ x: 'Ojusterat gap', y: -9.4 }, { x: 'Oförklarat gap', y: -4.6 }]);
        expect(f.lager[1].data.map(d => [d.x, d.lag, d.hog, d.farg])).toEqual([['BAS-intervall', -9.4, -4.1, '#2a78d6'], ['Ålder', -4.6, -4.1, '#eb6834']]);   // krymper: seriens blå; växer: orange — inga statusfärger
        expect(f.lager[2].data.map(d => d.etikett)).toEqual(['−9,4 %', '−4,1 %', '−4,6 %', '−4,6 %']);
        expect(f.y.nollinje).toBe(true);
        expect(vanliga([f.lager[1].tips(f.lager[1].data[0])[1]])[0]).toEqual(['Ändrar gapet med', '+5,3 procentenheter']);
        expect(() => valideraFigur(f, 't')).not.toThrow();
    });
    it('trappan visas bara när alla steg får visas — aldrig när det ojusterade steget är utelämnat', () => {
        w.__u = { steg, utelamnat: false };
        expect(w.eval('_regTrappaVisas(window.__u)')).toBe(true);
        w.__u = { steg: steg.slice(1), utelamnat: true };
        expect(w.eval('_regTrappaVisas(window.__u)')).toBe(false);
        w.__u = { steg: steg.slice(0, 1), utelamnat: false };
        expect(w.eval('_regTrappaVisas(window.__u)')).toBe(false);              // ett steg är ingen trappa
        w.__u = { steg: [{ name: 'Endast kön', status: 'too_few' }, ...steg.slice(1)], utelamnat: false };
        expect(w.eval('_regTrappaVisas(window.__u)')).toBe(false);
        expect(w.eval('_regTrappaVisas(null)')).toBe(false);
    });
    it('i verktyget: tre män ger ingen trappa (men noten om det utelämnade steget); med båda könen över tröskeln ritas den', () => {
        const rad = (kon, i, bas) => ({ bas, kon, lon: 28000 + i * 137 + (kon === 'man' ? 2500 : 0), alder: 25 + (i % 35), yrke: '100 X', aid: '100', yrkeLabel: 'X' });
        const w2 = createAppWindow();
        w2.__state.data = [...Array.from({ length: 40 }, (_, i) => rad('kvinna', i, i % 2 ? 'A' : 'B')), ...Array.from({ length: 3 }, (_, i) => rad('man', i, 'A'))];
        w2.eval('populateSelects(); unlockTabs();');
        w2.__renderTabContent('matrix');
        expect(w2.document.getElementById('chart-reg-trappa')).toBeNull();
        const w3 = createAppWindow();
        w3.__state.data = [...Array.from({ length: 40 }, (_, i) => rad('kvinna', i, i % 2 ? 'A' : 'B')), ...Array.from({ length: 40 }, (_, i) => rad('man', i, i % 3 ? 'A' : 'B'))];
        w3.eval('populateSelects(); unlockTabs();');
        w3.__renderTabContent('matrix');
        const el = w3.document.getElementById('chart-reg-trappa');
        expect(el && el._figur).toBeTruthy();
        expect(el._figur.x.ordning[0]).toBe('Ojusterat gap');
        expect(el.querySelectorAll('[data-marke="intervall"]').length).toBe(el._figur.lager[1].data.length);
    });
    it('gapet längs lönefördelningen: tre rader från nollinjen, med värdet utskrivet och noll inom axeln', () => {
        w.__q = [{ tau: 0.1, konPct: -6.123 }, { tau: 0.5, konPct: -4.5 }, { tau: 0.9, konPct: -2.25 }];
        const f = w.eval('_regKvantilFigur(window.__q)');
        expect(f.y.ordning).toEqual(['P10 (lägst betalda)', 'Median', 'P90 (högst betalda)']);
        expect(f.lager.map(l => l.marke)).toEqual(['intervall', 'punkt']);
        expect(f.lager[0].data.map(d => [d.lag, d.hog])).toEqual([[-6.12, 0], [-4.5, 0], [-2.25, 0]]);   // strecket börjar i noll
        expect(f.lager[1].data.map(d => d.x)).toEqual([-6.12, -4.5, -2.25]);
        expect(f.lager[1].data.map(d => d.etikett)).toEqual(['−6,1 %', '−4,5 %', '−2,3 %']);
        expect(f.x.nollinje).toBe(true);
        expect(f.x.doman[1]).toBeGreaterThan(0);
        expect(f.lager[1].data.every(d => d.fel === undefined)).toBe(true);
        expect(f.beskrivning).not.toMatch(/konfidensintervall/);
        expect(() => valideraFigur(f, 't')).not.toThrow();
    });
    it('gapet längs lönefördelningen med bootstrap-KI: strecket genom punkten, axeln rymmer intervallet, tipset säger det', () => {
        w.__q = [{ tau: 0.1, konPct: -6.123, ki: { lag: -9.456, hog: -2.1 } }, { tau: 0.5, konPct: -4.5, ki: null }, { tau: 0.9, konPct: -2.25, ki: { lag: -4, hog: 1.234 } }];
        const f = w.eval('_regKvantilFigur(window.__q)');
        expect(f.lager[1].data.map(d => d.fel)).toEqual([{ lag: -9.46, hog: -2.1 }, undefined, { lag: -4, hog: 1.23 }]);
        expect(f.x.doman[0]).toBeLessThan(-9.46);
        expect(f.x.doman[1]).toBeGreaterThan(1.23);
        expect(f.beskrivning).toMatch(/bootstrap-konfidensintervall/);
        expect(vanliga(f.lager[1].tips(f.lager[1].data[0]))).toEqual([['P10 (lägst betalda)'], ['Lönegap', '−6,1 %'], ['95 % KI (bootstrap)', '−9,5 % till −2,1 %']]);
        expect(vanliga(f.lager[1].tips(f.lager[1].data[1]))).toEqual([['Median'], ['Lönegap', '−4,5 %']]);
        expect(() => valideraFigur(f, 't')).not.toThrow();
    });
    it('hanteln: kvinnors och mäns median per BAS, störst skillnad överst, strecket mellan dem', () => {
        const f = w.eval(`_skevhetHantelFigur([{ bas: 'A', medKv: 30000, medMa: 31000, nKv: 12, nMa: 14 }, { bas: 'B', medKv: 34000, medMa: 38500, nKv: 20, nMa: 11 }])`);
        expect(f.y.ordning).toEqual(['BAS B', 'BAS A']);
        expect(f.lager.map(l => [l.marke, l.serie])).toEqual([['intervall', 'Skillnad kvinnor–män'], ['punkt', 'Kvinnor'], ['punkt', 'Män']]);
        expect(f.lager[0].data[0]).toEqual({ y: 'BAS B', lag: 34000, hog: 38500, skillnad: 4500, markering: ['bas:B'] });
        expect(f.lager[1].data[0]).toEqual({ y: 'BAS B', x: 34000, n: 20, markering: ['bas:B'] });
        expect(() => valideraFigur(f, 't')).not.toThrow();
    });
    it('hanteln ritas bara för BAS där båda könen når tröskeln, och följer markeringen', () => {
        const w2 = createAppWindow();
        w2.__loadDemoData();
        w2.__renderTabContent('matrix');
        const stapel = w2.document.getElementById('chart-skevhet-overview')._figur, hantel = w2.document.getElementById('chart-skevhet-hantel');
        expect(new Set(hantel._figur.y.ordning)).toEqual(new Set(stapel.y.ordning));
        const bas = hantel._figur.y.ordning[0].slice(4);
        w2.eval(`sattDiagramMarkering('bas:${bas}')`);
        expect(hantel.querySelectorAll('[data-markerad]').length).toBe(3);      // strecket och de två punkterna
    });
});

// ---- Före och efter, punktsvärm, övergångar ----
describe('punktsvärm: individerna packas intill varandra', () => {
    const fig = (data, punkter = 'svarm') => ({ beskrivning: 'S', x: { skala: 'band' }, y: { skala: 'linjar' }, lager: [{ marke: 'lada', serie: 'Alla', farg: '#2563eb', punkter, data }] });
    const rita = (f, val = '{ bredd: 500 }') => { const el = behallare('chart-svarm'); w.__el = el; w.__f = f; w.eval(`ritaFigur(window.__el, window.__f, ${val})`); return el; };
    const lagen = el => [...el.querySelectorAll('circle[data-marke="individ"]')].map(c => ({ i: Number(c.getAttribute('data-i')), x: Number(c.getAttribute('cx')), y: Number(c.getAttribute('cy')), r: Number(c.getAttribute('r')) }));
    const data = () => Array.from({ length: 40 }, (_, i) => ({ x: 'G', y: 30000 + (i % 8) * 20 }));
    it('ingen cirkel täcker en annan, punkterna ligger kring kategorins mitt, och bilden är densamma varje gång', () => {
        const el = rita(fig(data()));
        const p = lagen(el);
        expect(p).toHaveLength(40);
        for (let a = 0; a < p.length; a++) for (let b = a + 1; b < p.length; b++) {
            expect(Math.hypot(p[a].x - p[b].x, p[a].y - p[b].y), `${a}/${b}`).toBeGreaterThanOrEqual(2 * p[a].r);
        }
        const mitt = p.reduce((s, o) => s + o.x, 0) / p.length;
        expect(Math.max(...p.map(o => Math.abs(o.x - mitt)))).toBeLessThan(60);
        const forsta = el.querySelector(':scope > svg').outerHTML;
        expect(rita(fig(data())).querySelector(':scope > svg').outerHTML).toBe(forsta);
        // Individpunkterna (punkter: 'alla') sprids som vanligt — svärmen är ett eget läge.
        expect(lagen(rita(fig(data(), 'alla'))).map(o => o.x)).not.toEqual(p.map(o => o.x));
        w.eval('rensaFigur(window.__el)');
    });
    it('små individer: ritas inte utan visaSma, lämnar ingen lucka, och flyttar inte de övriga när de visas', () => {
        const med = [...data(), ...Array.from({ length: 6 }, (_, i) => ({ x: 'G', y: 30040 + i, liten: true }))];
        const utan = lagen(rita(fig(data()))).map(o => [o.i, o.x, o.y]);
        const dolda = lagen(rita(fig(med)));
        expect(dolda).toHaveLength(40);
        expect(dolda.map(o => [o.i, o.x, o.y])).toEqual(utan);                       // samma bild som om de små inte fanns
        const visade = lagen(rita(fig(med), '{ bredd: 500, visaSma: true }'));
        expect(visade).toHaveLength(46);
        expect(visade.filter(o => o.i < 40).map(o => [o.i, o.x, o.y])).toEqual(utan);  // de övriga ligger still
        // Diagramdatan bär aldrig individer: en rad per kategori med lådans statistik.
        expect(figurTillTabell(utanSmaGrupper(fig(med))).length).toBe(2);
        w.eval('rensaFigur(window.__el)');
    });
    it('Utforska har punktsvärm som diagramtyp', () => {
        expect(w.document.querySelector('#explore-typ option[value="svarm"]').textContent).toBe('Punktsvärm');
        expect(w.eval("explorerTypSkal('svarm', { rad: 'bas', kolumn: null, matt: 'median' }, null)")).toBeNull();
    });
});

describe('punktetiketter: sida och krockar', () => {
    const rita = f => { const el = behallare('chart-etik'); w.__el = el; w.__f = f; w.eval('ritaFigur(window.__el, window.__f, { bredd: 600 })'); return el; };
    const et = el => [...el.querySelectorAll('text[data-marke="punktetikett"]')].map(t => ({ text: t.childNodes[0].textContent, x: Number(t.getAttribute('x')), y: Number(t.getAttribute('y')), ankare: t.getAttribute('text-anchor') }));
    it('etikettLage ställer texten till vänster eller höger om punkten', () => {
        const el = rita({ beskrivning: 'E', legend: false, x: { skala: 'band', ordning: ['Före', 'Efter'] }, y: { skala: 'linjar' },
            lager: [{ marke: 'punkt', serie: 'V', etikettLage: 'vanster', data: [{ x: 'Före', y: 1, etikett: 'vänster' }] },
                    { marke: 'punkt', serie: 'H', etikettLage: 'hoger', data: [{ x: 'Efter', y: 9, etikett: 'höger' }] }] });
        const [v, h] = et(el), [cv, ch] = [...el.querySelectorAll('circle[data-marke="punkt"]')].map(c => Number(c.getAttribute('cx')));
        expect(v.ankare).toBe('end'); expect(v.x).toBeLessThan(cv);
        expect(h.ankare).toBe('start'); expect(h.x).toBeGreaterThan(ch);
        w.eval('rensaFigur(window.__el)');
    });
    it("etikettLage 'auto' är till höger, och till vänster när texten annars går utanför panelens högerkant", () => {
        const el = rita({ beskrivning: 'E', legend: false, x: { skala: 'linjar', doman: [0, 100] }, y: { skala: 'linjar', doman: [0, 10] },
            lager: [{ marke: 'punkt', serie: 'A', etikettLage: 'auto', data: [{ x: 10, y: 2, etikett: 'ryms till höger' }, { x: 99, y: 8, etikett: 'en lång etikett vid kanten' }] }] });
        const [a, b] = et(el), panelB = Number(el.querySelector('svg[data-del="panel"]').getAttribute('width'));
        expect(a.ankare).toBe('start');
        expect(b.ankare).toBe('end'); expect(b.x).toBeLessThan(panelB);
        w.eval('rensaFigur(window.__el)');
    });
    it('etiketter som skulle skriva över varandra flyttas isär; de som inte krockar rörs inte', () => {
        const f = n => ({ beskrivning: 'E', legend: false, x: { skala: 'band', ordning: ['Före', 'Efter'] }, y: { skala: 'linjar', doman: [0, 100] },
            lager: [{ marke: 'punkt', serie: 'V', etikettLage: 'vanster', data: [{ x: 'Före', y: 50, etikett: 'Grupp ett' }, { x: 'Före', y: 50.5, etikett: 'Grupp två' }, { x: 'Före', y: 51, etikett: 'Grupp tre' }].slice(0, n) },
                    { marke: 'punkt', serie: 'H', etikettLage: 'hoger', data: [{ x: 'Efter', y: 10, etikett: 'ensam' }] }] });
        const ensam = et(rita(f(1)));
        const tre = et(rita(f(3)));
        const ys = tre.filter(e => e.text.startsWith('Grupp')).map(e => e.y).sort((a, b) => a - b);
        expect(ys[1] - ys[0]).toBeGreaterThanOrEqual(10);
        expect(ys[2] - ys[1]).toBeGreaterThanOrEqual(10);
        expect(tre.find(e => e.text === 'ensam')).toEqual(ensam.find(e => e.text === 'ensam'));
        w.eval('rensaFigur(window.__el)');
    });
    it('etiketter som står över sin punkt flyttas uppåt, bort från punkterna, och aldrig över panelens överkant', () => {
        const f = (ys, doman = [0, 100]) => ({ beskrivning: 'E', legend: false, x: { skala: 'linjar', doman: [0, 10] }, y: { skala: 'linjar', doman },
            lager: [{ marke: 'punkt', serie: 'S', data: ys.map((y, i) => ({ x: 5, y, etikett: `Grupp nummer ${i + 1}` })) }] });
        const en = et(rita(f([50])))[0];
        const tva = et(rita(f([50, 50.5])));
        const [undre, ovre] = tva.map(e => e.y).sort((a, b) => b - a);
        expect(undre).toBeCloseTo(tva.find(e => e.text === 'Grupp nummer 1').y, 5);
        expect(tva.find(e => e.text === 'Grupp nummer 1').y).toBeCloseTo(en.y, 5);   // den nedre står kvar
        expect(undre - ovre).toBeGreaterThanOrEqual(12);                              // den övre har flyttats uppåt, med luft emellan
        // Högst upp i panelen finns ingen plats ovanför: då hålls etiketterna inom panelen.
        const topp = et(rita(f([99, 99.2, 99.4])));
        expect(Math.min(...topp.map(e => e.y))).toBeGreaterThan(0);
        const sorterade = topp.map(e => e.y).sort((a, b) => a - b);
        expect(sorterade[1] - sorterade[0]).toBeGreaterThanOrEqual(12);
        expect(sorterade[2] - sorterade[1]).toBeGreaterThanOrEqual(12);
        w.eval('rensaFigur(window.__el)');
    });
    it('en dold liten punkts etikett påverkar inte de övrigas lägen', () => {
        const f = extra => ({ beskrivning: 'E', legend: false, x: { skala: 'linjar', doman: [0, 10] }, y: { skala: 'linjar', doman: [0, 100] },
            lager: [{ marke: 'punkt', serie: 'S', data: [{ x: 5, y: 50, etikett: 'Synlig grupp' }, ...extra] }] });
        const utan = et(rita(f([])));
        const med = et(rita(f([{ x: 5, y: 50.2, etikett: 'HEMLIG', liten: true }])));
        expect(med).toEqual(utan);
        w.eval('rensaFigur(window.__el)');
    });
    it('ett lager märkt utanData får inga rader i diagramdatan', () => {
        const t = figurTillTabell({ beskrivning: 'E', x: { skala: 'band' }, y: { skala: 'linjar' },
            lager: [{ marke: 'linje', serie: 'A', data: [{ x: 'Före', y: 1 }, { x: 'Efter', y: 2 }] }, { marke: 'punkt', serie: 'Etiketter', utanData: true, data: [{ x: 'Före', y: 1, etikett: 'A 1' }] }] });
        expect(t.slice(1).map(r => r[0])).toEqual(['A', 'A']);
    });
});

describe('före och efter: lutningsdiagrammen', () => {
    const MARKOR = 77123;
    const rad = (aid, bas, kon, lon) => ({ bas, kon, lon, alder: 40, yrke: `${aid} Yrke${aid}`, aid, yrkeLabel: `Yrke${aid}`, enhet: '' });
    const data = () => [
        ...Array.from({ length: 14 }, (_, i) => rad('6000', 'A', 'kvinna', 30000 + i * 10)), ...Array.from({ length: 10 }, (_, i) => rad('6000', 'A', 'man', 30000 + i * 10)),
        ...Array.from({ length: 10 }, (_, i) => rad('6100', 'A', 'kvinna', 36000 + i * 10)), ...Array.from({ length: 14 }, (_, i) => rad('6100', 'A', 'man', 36000 + i * 10)),
        ...Array.from({ length: 3 }, (_, i) => rad('7000', 'S', 'kvinna', MARKOR + i)), ...Array.from({ length: 12 }, (_, i) => rad('7000', 'S', 'man', 40000 + i * 10))];
    const oppna = () => {
        const w2 = createAppWindow();
        w2.__state.data = data();
        w2.eval('populateSelects(); unlockTabs();');
        w2.__state.forecast.targets = [{ bas: 'A', aid: '6000', mode: 'pct', value: 10, dist: 'flat', targetLevel: 'median', pool: 'övrigt' }];
        w2.__renderTabContent('loneoversyn');
        return w2;
    };
    const allt = el => (el.outerHTML + JSON.stringify(el._figur || null)).replace(/(\d)[\s  ](?=\d)/g, '$1');
    it('Löneöversyn per BAS: en rad per BAS där båda könen når tröskeln, före som streck och efter som punkt, grönt när gapet närmar sig 100 %', () => {
        const w2 = oppna(), el = w2.document.getElementById('chart-forecast-lutning'), f = el._figur;
        expect(f.y.ordning).toEqual(['BAS A']);                                       // BAS S: tre kvinnor — visas inte
        expect(f.lager.map(l => [l.marke, l.serie, l.symbol || null])).toEqual([['intervall', 'Förändring', null], ['punkt', 'Före', 'streck'], ['punkt', 'Efter', null]]);
        const fore = f.lager[1].data[0].x, efter = f.lager[2].data[0].x;
        expect(fore).toBeLessThan(100);                                               // kvinnors median i % av mäns
        expect(Math.abs(efter - 100)).toBeLessThan(Math.abs(fore - 100));
        expect(f.referens).toEqual([expect.objectContaining({ x: 100, etikett: 'Lika lön' })]);
        expect(f.x.doman[0]).toBeLessThanOrEqual(fore);
        expect(f.x.doman[1]).toBeGreaterThan(100);                                    // axeln når alltid lika lön
        expect(f.lager[0].data[0].farg).toBe('#0f766e');
        expect(f.lager[0].data[0].markering).toEqual(['bas:A']);
        expect(el.querySelectorAll('text[data-marke="punktetikett"]')).toHaveLength(1);   // värdet efter står utskrivet
        expect(allt(el)).not.toMatch(/7712[345]|BAS S/);
        expect(w2.document.getElementById('forecast-lutning-not').textContent).toMatch(/minst 10 kvinnor och 10 män/);
        // Diagramdatan bär förändringen som ett spann och de två värdena var för sig.
        expect(w2.eval('chartExportRows(document.getElementById("chart-forecast-lutning"))').filter(r => r.includes('BAS A'))).toHaveLength(3);
    });
    it('Löneöversyn per yrkesgrupp: bara grupper där gapet ändras; annars en text', () => {
        const w2 = oppna(), d = w2.document, el = d.getElementById('chart-forecast-lutning');
        d.getElementById('forecast-lutning-niva').value = 'grupp';
        d.getElementById('forecast-lutning-niva').dispatchEvent(new w2.Event('change', { bubbles: true }));
        expect(el._figur).toBeUndefined();                                            // ett jämnt påslag ändrar inget gap inom gruppen
        expect(el.textContent).toMatch(/I ingen yrkesgrupp med minst 10 kvinnor och 10 män ändras kvinnors median i procent av mäns/);
        // Med löner som ändras olika för könen: grupperna visas, den lilla aldrig.
        w2.__sim = w2.__state.data.map(r => ({ ...r, lon: r.kon === 'kvinna' ? r.lon * 1.05 : r.lon }));
        const rader = w2.eval('_forecastLutningRader(getData(), window.__sim, "grupp")');
        expect(rader.map(r => r.namn).sort()).toEqual(['Yrke6000 · A', 'Yrke6100 · A']);
        expect(rader[0].markering).toEqual(['bas:A', 'grupp:6000|A']);
        expect(rader.every(r => r.efter > r.fore)).toBe(true);
        expect(JSON.stringify(rader)).not.toMatch(/7712|7000/);
    });
    it('foreEfterFigur för belopp: egna namn på lägena, axeln följer värdena med luft, och ingen linje för lika lön', () => {
        const f = w.eval("foreEfterFigur({ rader: [{ namn: 'Kvinnor', fore: 30000, efter: 31000, farg: '#833a8f' }, { namn: 'Män', fore: 33000, efter: 33500, farg: '#2a78d6' }], kolumner: ['Då', 'Nu'], titel: 'Medianlön', format: 'kr', beskrivning: 'B' })");
        expect(f.lager.map(l => [l.marke, l.serie, l.symbol || null])).toEqual([['intervall', 'Förändring', null], ['punkt', 'Då', 'streck'], ['punkt', 'Nu', null]]);
        expect(f.referens).toBeUndefined();
        expect(f.x.format).toBe('kr');
        expect(f.x.doman[0]).toBeLessThan(30000);
        expect(f.x.doman[1]).toBeGreaterThan(33500);
        expect(f.x.doman[0]).toBeGreaterThan(20000);                             // inte ned till noll: läget är det som läses
        expect(f.lager[2].data[0].etikett.replace(/[\u00a0\u202f]/g, ' ')).toBe('31 000 kr');
        expect(vanliga(f.lager[1].tips(f.lager[1].data[0]))).toEqual([['Kvinnor'], ['Då', '30 000 kr'], ['Nu', '31 000 kr']]);
        expect(() => valideraFigur(f)).not.toThrow();
    });
    it('ögonblicksbilden: medianlön per kön, en rad per kön, bara när könen får visas i båda lägena', () => {
        const w2 = oppna(), d = w2.document, ruta = d.getElementById('snapshot-lutning-ruta'), el = d.getElementById('chart-snapshot-lutning');
        expect(ruta.hidden).toBe(true);
        w2.__state.snapshot = w2.eval('buildAnalysisSnapshot()');
        w2.__state.snapshot.medianKv -= 1000;
        w2.eval('renderSnapshotComparison()');
        expect(ruta.hidden).toBe(false);
        expect(el._figur.y.ordning).toEqual(['Kvinnor', 'Män']);
        expect(el._figur.lager.map(l => l.serie)).toEqual(['Förändring', 'Ögonblicksbild', 'Nuvarande']);
        expect(el._figur.lager[2].data[0].x - el._figur.lager[1].data[0].x).toBe(1000);
        // Bilden sparad med för få av ett kön: inga könsuppdelade medianer, och inget diagram.
        w2.__state.snapshot.nKv = 3;
        w2.eval('renderSnapshotComparison()');
        expect(ruta.hidden).toBe(true);
        expect(el._figur).toBeUndefined();
    });
});

describe('övergångar: märkena flyttar sig mellan två ritningar', () => {
    const fig = (a, b) => ({ beskrivning: 'Ö', x: { skala: 'band', ordning: ['A', 'B'] }, y: { skala: 'linjar', doman: [0, 10] },
        lager: [{ marke: 'stapel', serie: 'S', farg: '#2563eb', data: [{ x: 'A', y: a }, { x: 'B', y: b }] }] });
    const rita = f => { const el = w.__el || behallare('chart-overgang'); w.__el = el; w.__f = f; w.eval('ritaFigur(window.__el, window.__f, { bredd: 500 })'); return el; };
    const hojder = el => [...el.querySelectorAll('rect[data-marke="stapel"]')].map(r => Number(r.getAttribute('height')));
    const medRorelse = fn => {
        const mm = w.matchMedia, raf = w.requestAnimationFrame;
        w.matchMedia = q => ({ matches: /no-preference/.test(q) });
        w.requestAnimationFrame = () => 0;                                            // testet stegar själv
        try { fn(); } finally { w.matchMedia = mm; w.requestAnimationFrame = raf; w.eval('rensaFigur(window.__el)'); w.__el = null; }
    };
    it('utan besked om att rörelse går bra ritas den nya bilden direkt', () => {
        w.__el = null;
        const el = rita(fig(2, 8));
        rita(fig(8, 2));
        expect(el._rfOvergang).toBeUndefined();
        w.eval('rensaFigur(window.__el)'); w.__el = null;
    });
    it('med rörelse: staplarna börjar där de stod och slutar exakt där ritaren ställde dem', () => {
        medRorelse(() => {
            w.__el = null;
            const el = rita(fig(2, 8));
            const fore = hojder(el);
            expect(el._rfOvergang).toBeUndefined();                                   // första ritningen: inget att flytta från
            const ny = fig(8, 2);
            rita(ny);
            expect(el._rfOvergang).toBeDefined();
            expect(hojder(el)).toEqual(fore);                                         // andel 0: de gamla lägena
            w.eval('_rfOvergangSatt(window.__el, 0.5)');
            const mitt = hojder(el);
            expect(mitt[0]).toBeGreaterThan(fore[0]); expect(mitt[0]).toBeLessThan(fore[1]);
            w.eval('_rfOvergangSatt(window.__el, 1)');
            expect(el._rfOvergang).toBeUndefined();
            expect(el.querySelector('svg[data-del="panel"]').outerHTML).toBe(w.eval('_rfByggSvg(window.__f, 500, {})').querySelector('svg[data-del="panel"]').outerHTML);
        });
    });
    it('en ny ritning mitt i en övergång utgår från där märkena är, och rensaFigur avslutar den', () => {
        medRorelse(() => {
            w.__el = null;
            const el = rita(fig(2, 8));
            rita(fig(8, 2));
            w.eval('_rfOvergangSatt(window.__el, 0.5)');
            const mitt = hojder(el);
            rita(fig(9, 1));
            expect(hojder(el)).toEqual(mitt);
            expect(el._rfOvergang).toBeDefined();
        });
        expect(w.document.getElementById('chart-overgang')._rfOvergang).toBeUndefined();
    });
    it('punkter utan nyckel på talaxlar följs inte mellan två figurer — men inom samma figur (zoom)', () => {
        medRorelse(() => {
            w.__el = null;
            const p = () => ({ beskrivning: 'P', x: { skala: 'linjar' }, y: { skala: 'linjar' }, lager: [{ marke: 'punkt', serie: 'S', farg: '#2563eb', data: [{ x: 1, y: 1 }, { x: 5, y: 5 }, { x: 9, y: 9 }] }] });
            const el = rita(p());
            rita({ ...p(), lager: [{ ...p().lager[0], data: [{ x: 2, y: 7 }, { x: 4, y: 3 }, { x: 9, y: 1 }] }] });
            expect(el._rfOvergang).toBeUndefined();                                   // andra personer: ingen identitet att följa
            w.eval('_rfPensla(window.__el, 0, 0, 0, 9999, 9999)');
            el.nextElementSibling.querySelector('button').click();                    // zoom: samma figur, samma punkter
            expect(el._rfOvergang).toBeDefined();
            w.eval('_rfOvergangAvsluta(window.__el)');
            expect(el.querySelector('svg[data-del="panel"]').outerHTML).toBe(w.eval('_rfByggSvg(_rfZoomad(window.__el), 500, {})').querySelector('svg[data-del="panel"]').outerHTML);
        });
    });
    it('en liten punkt som inte ritas har inget läge att flytta från eller till', () => {
        medRorelse(() => {
            w.__el = null;
            const f = y => ({ beskrivning: 'L', x: { skala: 'band', ordning: ['A', 'HEMLIG'] }, y: { skala: 'linjar', doman: [0, 100] },
                lager: [{ marke: 'stapel', serie: 'S', farg: '#2563eb', data: [{ x: 'A', y }, { x: 'HEMLIG', y: 99, liten: true }] }] });
            const el = rita(f(10));
            rita(f(50));
            expect(el._rfOvergang.poster.every(p => p.m.getAttribute('data-i') === '0')).toBe(true);
            expect(el.querySelectorAll('rect[data-marke="stapel"]')).toHaveLength(1);
        });
    });
});

// ---- Andelsstaplar: divergerande stapel i Lönepolitik och staplade staplar i Utforska ----
describe('Lönepolitik: efterlevnaden kring en mittlinje', () => {
    const rader = "[{ bas: '5', n: 40, compliance: { under: 4, within: 30, over: 6, n: 40 } }, { bas: '7', n: 20, compliance: { under: 8, within: 10, over: 2, n: 20 } }]";
    it('under åt vänster och över åt höger, störst andel utanför överst, symmetrisk axel utan tecken', () => {
        const f = w.eval(`_lpFigurKompliansMitt(${rader})`);
        expect(f.lager.map(l => [l.serie, l.farg, l.riktning, l.lage, !!l.absolut])).toEqual([['Under P10', '#c2552d', 'liggande', 'staplad', true], ['Över P90', '#2a78d6', 'liggande', 'staplad', false]]);
        expect(f.y.ordning).toEqual(['BAS 7', 'BAS 5']);                              // 50 % utanför före 25 %
        expect(f.lager[0].data.map(d => d.x)).toEqual([-40, -10]);
        expect(f.lager[1].data.map(d => d.x)).toEqual([10, 15]);
        expect(f.lager[0].data[0]).toMatchObject({ andel: 40, inom: 50, markering: ['bas:7'] });
        expect(f.x.doman).toEqual([-50, 50]);
        expect(f.x).toMatchObject({ format: 'pctAbs', nollinje: true });
        expect(() => valideraFigur(f, 't')).not.toThrow();
        // Axeln bär samma tal på båda sidor om mitten, utan tecken och utan decimaler.
        const el = behallare('chart-mitt'); w.__el = el; w.__f = f;
        w.eval('ritaFigur(window.__el, window.__f, { bredd: 700 })');
        const axel = [...el.querySelectorAll('[data-axel="x"]')].map(t => t.textContent);
        expect(axel.filter(t => t === '40')).toHaveLength(2);
        expect(axel.join(' ')).not.toMatch(/[-−,]/);
        w.eval('rensaFigur(window.__el)');
        // Diagramdatan bär andelen utan tecken.
        expect(figurTillTabell(f).slice(1).map(r => [r[0], r[1]])).toEqual([['Under P10', 40], ['Under P10', 10], ['Över P90', 10], ['Över P90', 15]]);
    });
    it('valet Uppställning byter figur, gäller vid nästa rendering, och BAS under tröskeln ritas inte i någon av dem', () => {
        const data = [...Array.from({ length: 14 }, (_, i) => person('A', i % 2 ? 'kvinna' : 'man', 26000 + i * 1500)),
                      ...Array.from({ length: 6 }, (_, i) => person('B', i % 2 ? 'kvinna' : 'man', 61111 + i))];
        medData(data, [{ bas: 'A', p10: 28000, med: 34000, p90: 40000 }, { bas: 'B', p10: 25000, med: 30000, p90: 40000 }], () => {
            w.__renderLonepolitik();
            const d = w.document, val = () => d.getElementById('lp-komplians-vy'), el = () => d.getElementById('chart-lp-compliance');
            expect(val().value).toBe('staplad');
            expect(el()._figur.lager).toHaveLength(3);
            val().value = 'mitt';
            val().dispatchEvent(new w.Event('change', { bubbles: true }));
            expect(val().value).toBe('mitt');                                         // valet står kvar efter omritningen
            expect(el()._figur.lager.map(l => l.serie)).toEqual(['Under P10', 'Över P90']);
            expect(el()._figur.y.ordning).toEqual(['BAS A']);
            expect(utdata(el())).not.toMatch(/BAS B|61\s?11\d/);
            expect([...el().querySelectorAll('[data-axel="x"]')].map(t => t.textContent).join(' ')).not.toMatch(/[-−]/);
            val().value = 'staplad';
            val().dispatchEvent(new w.Event('change', { bubbles: true }));
            expect(el()._figur.lager).toHaveLength(3);
        });
    });
});

describe('Utforska: staplade staplar, i antal eller som andel av raden', () => {
    const MARKOR = 71444;
    const oppna = () => {
        const w2 = createAppWindow();
        const rad = (bas, kon, lon) => ({ bas, kon, lon, alder: 40, yrke: '100 X', aid: '100', yrkeLabel: 'X' });
        w2.__state.data = [...Array.from({ length: 30 }, (_, i) => rad('A', 'man', 30000 + i * 7)), ...Array.from({ length: 10 }, (_, i) => rad('A', 'kvinna', 31000 + i)),
                           ...Array.from({ length: 17 }, (_, i) => rad('B', 'man', 26000 + i * 11)), ...Array.from({ length: 3 }, () => rad('B', 'kvinna', MARKOR))];
        w2.eval('populateSelects(); unlockTabs();');
        w2.__renderTabContent('utforska');
        return w2;
    };
    const valj = (w2, val) => { for (const [id, v] of Object.entries(val)) w2.document.getElementById(id).value = v; w2.__renderExplorer(); return w2.document.getElementById('chart-explore'); };
    it('typen kräver en kolumn, låser måttet till antal och visningen till helhet, och valet antal/andel syns bara för den', () => {
        const w2 = oppna(), d = w2.document;
        valj(w2, { 'explore-rad': 'bas', 'explore-kolumn': 'ingen', 'explore-typ': 'staplar' });
        expect(d.querySelector('#explore-typ option[value="staplade"]').disabled).toBe(true);
        expect(d.getElementById('explore-stapel-visa').parentElement.hidden).toBe(true);
        valj(w2, { 'explore-kolumn': 'kon', 'explore-typ': 'staplade', 'explore-measure': 'median' });
        expect(d.getElementById('explore-typ').value).toBe('staplade');
        expect(d.getElementById('explore-measure').disabled).toBe(true);
        expect(d.getElementById('explore-stapel-visa').parentElement.hidden).toBe(false);
        expect(d.getElementById('explore-chart-title').textContent).toMatch(/^Antal per/);
    });
    it('antal: ett segment per kolumnvärde; andel: varje rad summerar till 100 % av radens hela antal', () => {
        const w2 = oppna();
        const el = valj(w2, { 'explore-rad': 'bas', 'explore-kolumn': 'kon', 'explore-typ': 'staplade', 'explore-stapel-visa': 'antal' });
        const varden = f => Object.fromEntries(f.lager.map(l => [l.serie, l.data.map(p => [p.x, p.y, !!p.liten])]));
        expect(el._figur.lager.every(l => l.marke === 'stapel' && l.lage === 'staplad')).toBe(true);
        expect(varden(el._figur)).toEqual({ Kvinna: [['A', 10, false], ['B', 3, true]], Man: [['A', 30, false], ['B', 17, false]] });
        const el2 = valj(w2, { 'explore-stapel-visa': 'andel' });
        expect(varden(el2._figur)).toEqual({ Kvinna: [['A', 25, false], ['B', 15, true]], Man: [['A', 75, false], ['B', 85, false]] });
        expect(el2._figur.y.doman).toEqual([0, 100]);
        expect(w2.document.getElementById('explore-chart-title').textContent).toMatch(/^Andel per/);
        // Fyra segment på skärmen (den lilla cellen visas markerad); exporten bär bara tre, och aldrig de tre kvinnornas lön.
        expect(el2.querySelectorAll('rect[data-marke="stapel"]')).toHaveLength(4);
        const rader = w2.eval('chartExportRows(document.getElementById("chart-explore"))');
        expect(rader.filter(r => r[1] === 'B').map(r => r[0])).toEqual(['Man']);
        expect(JSON.stringify(rader) + el2.outerHTML).not.toContain(String(MARKOR));
    });
    it('för många kolumnvärden ger en text i stället för ett diagram', () => {
        const w2 = oppna();
        w2.__state.data = Array.from({ length: 60 }, (_, i) => ({ bas: 'A', kon: 'man', lon: 30000 + i, alder: 40, yrke: `${100 + (i % 15)} Y${i % 15}`, aid: String(100 + (i % 15)), yrkeLabel: `Y${i % 15}` }));
        w2.eval('populateSelects()');
        const el = valj(w2, { 'explore-rad': 'bas', 'explore-kolumn': 'aid', 'explore-typ': 'staplade' });
        expect(el._figur).toBeUndefined();
        expect(el.textContent).toMatch(/15 värden — för många för staplade staplar \(högst 12\)/);
    });
});

// ---- Andelsstaplar, del 2: könsfördelning per BAS, ålderspyramid, avvikelse från förväntad lön per kön ----
describe('andelsstaplar: könsfördelning, ålderspyramid och avvikelse från förväntad lön', () => {
    const MARKOR = 78111;
    const rad = (aid, bas, kon, lon, alder) => ({ bas, kon, lon, alder, yrke: `${aid} Yrke${aid}`, aid, yrkeLabel: `Yrke${aid}`, enhet: '' });
    const data = () => [
        // BAS A: 12 kvinnor och 12 män i samma yrke. Två kvinnor ligger långt under, en man långt över.
        ...Array.from({ length: 12 }, (_, i) => rad('6000', 'A', 'kvinna', i < 2 ? 20000 : 30000 + i * 10, 30 + i * 2)),
        ...Array.from({ length: 12 }, (_, i) => rad('6000', 'A', 'man', i === 0 ? 42000 : 30000 + i * 10, 31 + i * 2)),
        // BAS S: tre kvinnor — för få för att visas per kön.
        ...Array.from({ length: 3 }, (_, i) => rad('7000', 'S', 'kvinna', MARKOR + i, 40 + i * 3)), ...Array.from({ length: 12 }, (_, i) => rad('7000', 'S', 'man', 40000 + i * 10, 35 + i * 2))];
    const oppna = () => {
        const w2 = createAppWindow();
        w2.__state.data = data();
        w2.eval('populateSelects(); unlockTabs();');
        return w2;
    };
    it('könsfördelning per BAS: staplat till 100 %, linjer vid 40 och 60 %, samma BAS och andelar som tabellen', () => {
        const f = w.eval("_skevhetAndelFigur([{ bas: 'A', tot: 20, pctKv: 75, pctMa: 25 }, { bas: 'B', tot: 10, pctKv: 5, pctMa: 95 }])");
        expect(f.lager.map(l => [l.serie, l.lage, l.riktning, l.farg])).toEqual([['Kvinnor', 'staplad', 'liggande', '#833a8f'], ['Män', 'staplad', 'liggande', '#5f7f16']]);
        expect(f.lager[0].data.map((d, i) => d.x + f.lager[1].data[i].x)).toEqual([100, 100]);
        expect(f.lager[0].data.map(d => 'etikett' in d)).toEqual([true, false]);       // 5 % ryms inte som text
        expect(f.referens.map(r => r.x)).toEqual([40, 60]);
        expect(f.x.doman).toEqual([0, 100]);
        expect(() => valideraFigur(f, 't')).not.toThrow();
        const w2 = oppna();
        w2.__renderTabContent('matrix');
        const el = w2.document.getElementById('chart-skevhet-andel');
        const tabell = [...w2.document.querySelectorAll('#skevhet-table tbody tr')].map(tr => ['BAS ' + tr.cells[0].textContent.trim(), parseFloat(tr.cells[2].textContent)]);
        expect(el._figur.lager[0].data.map(d => [d.y, d.x])).toEqual(tabell);
        expect(el.querySelectorAll('rect[data-marke="stapel"]').length).toBe(tabell.length * 2);
    });
    it('ålderspyramiden: kvinnor åt vänster, män åt höger, äldst överst, samma andelar som histogrammet', () => {
        const w2 = oppna();
        w2.__renderTabContent('kon');
        w2.eval("renderDemografi('__ALLA__')");
        const pyr = w2.document.getElementById('chart-demo-pyramid')._figur, hist = w2.document.getElementById('chart-demo-hist')._figur;
        expect(pyr.lager.map(l => [l.serie, !!l.absolut, l.riktning])).toEqual([['Kvinna', true, 'liggande'], ['Man', false, 'liggande']]);
        expect(pyr.lager[0].data.every(d => d.x <= 0)).toBe(true);
        expect(pyr.lager[1].data.every(d => d.x >= 0)).toBe(true);
        expect(pyr.lager[0].data.map(d => d.andel)).toEqual(hist.lager[0].data.map(d => d.y));
        expect(pyr.lager[1].data.map(d => d.andel)).toEqual(hist.lager[1].data.map(d => d.y));
        expect(pyr.y.ordning).toEqual(hist.x.ordning.slice().reverse());
        expect(pyr.x.doman[0]).toBe(-pyr.x.doman[1]);
        expect(pyr.x.format).toBe('pctAbs');
        // Diagramdatan bär andelarna utan tecken.
        expect(figurTillTabell(pyr).slice(1).every(r => r[1] >= 0)).toBe(true);
    });
    it('avvikelse från förväntad lön: andel per kön och BAS, bara där båda könen når tröskeln, i hela procent', () => {
        const w2 = oppna();
        const rader = w2.eval('_pagAvvikelseRader(getData(), 10)');
        expect(rader.map(r => [r.bas, r.kon, r.n])).toEqual([['A', 'Kvinnor', 12], ['A', 'Män', 12]]);   // BAS S: tre kvinnor
        expect(rader[0].under).toBe(17);                                                // 2 av 12 kvinnor
        expect(rader[1].under).toBe(0);
        expect(rader[1].over).toBe(8);                                                  // 1 av 12 män
        expect(rader.every(r => Number.isInteger(r.under) && Number.isInteger(r.over))).toBe(true);
        w2.__renderTabContent('matrix');
        w2.eval('renderPersonerAttGranska()');
        const d = w2.document, t = d.getElementById('pag-avvikelse-tabell');
        expect(d.getElementById('pag-diagram-ruta').hidden).toBe(false);
        expect(d.getElementById('chart-pag-avvikelse')).toBeNull();                     // tabell med inbyggd grafik i stället för diagram
        const celler = [...t.querySelectorAll('tbody tr')].map(tr => [...tr.children].map(c => c.textContent.replace(/\u00a0|\u202f/g, ' ')));
        expect(celler.map(c => [c[0], c[1], c[2], c[3], c[5]])).toEqual([['BAS A', 'Kvinnor', '12', '17 %*', '0 %'], ['BAS A', 'Män', '12', '0 %', '8 %*']]);   // * = färre än fem personer
        const grafik = [...t.querySelectorAll('tbody svg')];
        expect(grafik.map(g => g.querySelectorAll('rect').length)).toEqual([1, 1]);    // en stapel åt vänster (under), en åt höger (över)
        expect(grafik.every(g => g.getAttribute('aria-hidden') === 'true')).toBe(true);
        expect(t.querySelector('tbody tr')._markering).toEqual(['bas:A']);
        expect(d.getElementById('pag-diagram-not').textContent).toMatch(/minst 10 kvinnor och 10 män/);
        expect(d.getElementById('pag-diagram-not').textContent).toMatch(/märkta med \* gäller färre än 5 personer/);
        // Varken den lilla gruppens löner eller någon enskild lön står i tabellen.
        expect(t.outerHTML.replace(/(\d)[\s  ](?=\d)/g, '$1')).not.toMatch(/7811\d|BAS S|20000|42000/);
        // Som resten av panelen: ingen exportknapp.
        expect(d.getElementById('personer-att-granska').querySelector('.chart-export, .chart-export-btn')).toBeNull();
        // Höjd tröskel: inget kön i BAS A når den längre — tabellen försvinner.
        w2.eval('sattKTroskel(13, { fraga: false })');
        w2.eval('renderPersonerAttGranska()');
        expect(d.getElementById('pag-diagram-ruta').hidden).toBe(true);
        expect(t.querySelectorAll('tbody tr')).toHaveLength(0);
    });
});

// ---- Närmaste punkt, lönekvartilerna, krav mot lön och täthetskurvor ----
describe('närmaste punkt får verktygstipset och klicket', () => {
    const fig = () => ({ beskrivning: 'N', x: { skala: 'linjar', doman: [0, 100] }, y: { skala: 'linjar', doman: [0, 100] },
        lager: [{ marke: 'punkt', serie: 'S', farg: '#2563eb', tips: d => [[String(d.namn)]],
                  data: [{ x: 10, y: 10, namn: 'A' }, { x: 50, y: 50, namn: 'HEMLIG', liten: true }, { x: 90, y: 90, namn: 'B' }] }] });
    const rita = (val = '{ bredd: 500 }') => { const el = behallare('chart-nara'); w.__el = el; w.__f = fig(); w.eval(`ritaFigur(window.__el, window.__f, ${val})`); return el; };
    const lage = (el, i) => { const c = el.querySelector(`circle[data-marke="punkt"][data-i="${i}"]`); return [Number(c.getAttribute('cx')), Number(c.getAttribute('cy'))]; };
    const narmast = (x, y, r = 24) => { w.__p = [x, y, r]; const m = w.eval('_rfNarmastI(window.__el, 0, ...window.__p)'); return m ? m.getAttribute('data-i') : null; };
    it('den närmaste ritade punkten inom radien; ingen utanför; en dold liten punkt kan aldrig bli närmast', () => {
        const el = rita();
        const [ax, ay] = lage(el, 0), [bx, by] = lage(el, 2);
        expect(narmast(ax + 10, ay - 10)).toBe('0');
        expect(narmast(bx - 5, by + 5)).toBe('2');
        expect(narmast(ax + 30, ay)).toBeNull();                                       // 30 px bort: utanför 24
        expect(narmast(ax + 30, ay, 40)).toBe('0');
        // Mitt i ytan ligger den dolda punkten: där finns inget märke, och närmaste är långt bort.
        expect(el.querySelectorAll('circle[data-marke="punkt"]')).toHaveLength(2);
        expect(narmast((ax + bx) / 2, (ay + by) / 2)).toBeNull();
        expect(narmast((ax + bx) / 2, (ay + by) / 2, 9999)).not.toBe('1');
        w.eval('rensaFigur(window.__el)');
    });
    it('med visaSma finns den lilla punkten i sökningen; sökningen byggs om när diagrammet ritas om', () => {
        const el = rita('{ bredd: 500, visaSma: true }');
        const [mx, my] = lage(el, 1);
        expect(narmast(mx + 3, my + 3)).toBe('1');
        w.eval('ritaFigur(window.__el, window.__f, { bredd: 500 })');                  // utan visaSma: punkten är borta
        expect(narmast(mx + 3, my + 3)).toBeNull();
        w.eval('rensaFigur(window.__el)');
    });
    it('ringen: högst ett märke bär data-nara, och den tas bort när tipset döljs', () => {
        const el = rita();
        const [a, b] = [...el.querySelectorAll('circle[data-marke="punkt"]')];
        w.__m = a; w.eval('_rfNaraMarkera(window.__el, window.__m)');
        w.__m = b; w.eval('_rfNaraMarkera(window.__el, window.__m)');
        expect([a.hasAttribute('data-nara'), b.hasAttribute('data-nara')]).toEqual([false, true]);
        w.eval('_rfDoljTips(window.__el)');
        expect(el.querySelector('[data-nara]')).toBeNull();
        // Exporten bär aldrig ringen.
        expect(w.figurTillSvg(fig(), 1600, 900, {})).not.toContain('data-nara');
        w.eval('rensaFigur(window.__el)');
    });
    it('stapeldiagram har inga punktmärken: ingen närmaste', () => {
        const el = behallare('chart-nara'); w.__el = el;
        w.__f = { beskrivning: 'S', x: { skala: 'band' }, y: { skala: 'linjar' }, lager: [{ marke: 'stapel', serie: 'S', data: [{ x: 'A', y: 1 }] }] };
        w.eval('ritaFigur(window.__el, window.__f, { bredd: 500 })');
        expect(narmast(50, 50, 9999)).toBeNull();
        w.eval('rensaFigur(window.__el)');
    });
});

describe('Struktur: lönekvartilerna som diagram', () => {
    const rad = (kon, lon) => ({ bas: 'A', kon, lon, alder: 40, yrke: '100 X', aid: '100', yrkeLabel: 'X', enhet: '' });
    const oppna = data => { const w2 = createAppWindow(); w2.__state.data = data; w2.eval('populateSelects(); unlockTabs();'); w2.__renderTabContent('struktur'); return w2; };
    it('fyra staplar till 100 % med högst lön överst, linje vid organisationens andel kvinnor, samma tal som tabellen', () => {
        // 40 personer: kvinnorna lågt, männen högt. Q1 och Q2 är alla kvinnor utom ..., osv.
        const data = [...Array.from({ length: 24 }, (_, i) => rad('kvinna', 30000 + i * 100)), ...Array.from({ length: 16 }, (_, i) => rad('man', 32500 + i * 100))];
        const w2 = oppna(data), el = w2.document.getElementById('chart-struktur-kvartiler'), f = el._figur;
        expect(f.lager.map(l => [l.serie, l.lage, l.riktning])).toEqual([['Kvinnor', 'staplad', 'liggande'], ['Män', 'staplad', 'liggande']]);
        expect(f.y.ordning).toEqual(['Q4 (högst lön)', 'Q3', 'Q2', 'Q1 (lägst lön)']);
        expect(f.lager[0].data.map((d, i) => Math.round(d.x + f.lager[1].data[i].x))).toEqual([100, 100, 100, 100]);
        expect(f.referens).toEqual([expect.objectContaining({ x: 60 })]);              // 24 av 40 är kvinnor
        const tabell = [...el.parentElement.querySelectorAll('table tbody tr')].map(tr => parseFloat(tr.cells[5].textContent));
        expect(f.lager[0].data.map(d => Math.round(d.x))).toEqual(tabell);
        expect(f.lager[0].data[0].x).toBeGreaterThan(f.lager[0].data[3].x);            // fler kvinnor i den lägsta kvartilen
        expect(el.querySelectorAll('rect[data-marke="stapel"]').length).toBeGreaterThanOrEqual(5);
    });
    it('ett kön under tröskeln: tabellen utelämnar könsuppdelningen och inget diagram ritas', () => {
        const data = [...Array.from({ length: 3 }, (_, i) => rad('kvinna', 30000 + i * 100)), ...Array.from({ length: 30 }, (_, i) => rad('man', 32500 + i * 100))];
        const w2 = oppna(data), el = w2.document.getElementById('chart-struktur-kvartiler');
        expect(el._figur).toBeUndefined();
        expect(el.querySelector('svg')).toBeNull();
    });
});

describe('Likvärdigt arbete: krav mot lön', () => {
    const MARKOR = 79222;
    const rad = (aid, bas, kon, lon) => ({ bas, kon, lon, alder: 40, yrke: `${aid} Yrke${aid}`, aid, yrkeLabel: `Yrke${aid}`, enhet: '' });
    const grupp = (aid, bas, nKv, nMa, lon) => [...Array.from({ length: nKv }, (_, i) => rad(aid, bas, 'kvinna', lon + i)), ...Array.from({ length: nMa }, (_, i) => rad(aid, bas, 'man', lon + i))];
    const data = () => [...grupp('2000', 'A', 11, 1, 28000), ...grupp('2100', 'A', 2, 12, 31000), ...grupp('3000', 'B', 12, 2, 30000), ...grupp('3100', 'B', 6, 6, 36000),
                        ...grupp('3200', 'B', 1, 13, 37000), ...grupp('4000', 'C', 3, 1, MARKOR)];
    it('grupperna: bara de som når tröskeln, dominans efter andel kvinnor, utan poäng efter BAS-intervall', () => {
        w.__d = data();
        const u = w.eval('_lvKravGrupper(window.__d, { kvinnoThr: 60, k: 10 })');
        expect(u.medPoang).toBe(false);
        expect(u.grupper.map(g => [g.aid, g.dominans]).sort()).toEqual([['2000', 'kvinnodominerad'], ['2100', 'mansdominerad'], ['3000', 'kvinnodominerad'], ['3100', 'blandad'], ['3200', 'mansdominerad']]);
        const f = w.eval('_lvKravFigur(_lvKravGrupper(window.__d, { kvinnoThr: 60, k: 10 }))');
        expect(f.x).toMatchObject({ skala: 'band', ordning: ['BAS A', 'BAS B'] });
        expect(f.lager.map(l => [l.marke, l.serie, l.symbol || null])).toEqual([['linje', 'Nivå per BAS-intervall', null],
            ['punkt', 'Kvinnodominerad', 'cirkel'], ['punkt', 'Mansdominerad', 'triangelHoger'], ['punkt', 'Blandad', 'cirkel']]);
        // De kvinnodominerade grupperna ligger under nivån i sitt BAS-intervall och får sitt namn utskrivet.
        const kv = f.lager[1].data;
        expect(kv.every(d => d.avstand < 0 && d.etikett === d.namn)).toBe(true);
        expect(kv[0].markering).toEqual(['bas:A', 'grupp:2000|A']);
        expect(f.lager[2].data.every(d => d.etikett === undefined)).toBe(true);
        expect(() => valideraFigur(f, 't')).not.toThrow();
        expect(JSON.stringify(f)).not.toMatch(/7922\d|Yrke4000/);                        // gruppen med fyra personer
    });
    it('med poängtabell: poängen på x-axeln, en rät trendlinje, och en grupp utan poäng placeras efter sitt BAS-intervall', () => {
        w.__d = data();
        w.__p = new Map([['2000|A', 200], ['2100|A', 220], ['3000|B', 300], ['3200|B', 340]]);   // 3100|B saknar poäng
        const u = w.eval('_lvKravGrupper(window.__d, { kvinnoThr: 60, k: 10, poangByKey: window.__p })');
        expect(u.medPoang).toBe(true);
        const utan = u.grupper.find(g => g.aid === '3100');
        expect(utan).toMatchObject({ uppskattad: true, krav: 320 });                     // medianen av 300 och 340 i BAS B
        expect(u.utanPlats).toEqual([]);
        const f = w.eval('_lvKravFigur(_lvKravGrupper(window.__d, { kvinnoThr: 60, k: 10, poangByKey: window.__p }))');
        expect(f.x).toMatchObject({ skala: 'linjar', titel: 'Arbetsvärderingspoäng' });
        expect(f.lager[0]).toMatchObject({ marke: 'linje', serie: 'Nivå efter kraven (trend)' });
        expect(f.lager[0].data.map(d => d.x)).toEqual([200, 340]);
        // Ingen värderad grupp i intervallet: gruppen går inte att placera.
        w.__p = new Map([['2000|A', 200], ['2100|A', 220]]);
        const u2 = w.eval('_lvKravGrupper(window.__d, { kvinnoThr: 60, k: 10, poangByKey: window.__p })');
        expect(u2.grupper.map(g => g.aid).sort()).toEqual(['2000', '2100']);
        expect(u2.utanPlats.map(g => g.aid).sort()).toEqual(['3000', '3100', '3200']);
    });
    it('vyn: diagrammet ritas i fliken, noten säger tröskeln, och höjd tröskel ger en text', () => {
        const w2 = createAppWindow();
        w2.__state.data = data();
        w2.eval('populateSelects(); unlockTabs();');
        w2.__renderTabContent('likvardighet');
        const d = w2.document, el = () => d.getElementById('chart-likvardighet-krav');
        expect(el()._figur.lager.filter(l => l.marke === 'punkt').reduce((s, l) => s + l.data.length, 0)).toBe(5);
        expect(d.getElementById('lv-krav-not').textContent).toMatch(/minst 10 personer/);
        expect((el().outerHTML + JSON.stringify(w2.eval('chartExportRows(document.getElementById("chart-likvardighet-krav"))'))).replace(/(\d)[\s  ](?=\d)/g, '$1')).not.toMatch(/7922\d|Yrke4000/);
        w2.eval('sattKTroskel(15, { fraga: false })');
        w2.__renderTabContent('likvardighet');
        expect(el()._figur).toBeUndefined();
        expect(el().textContent).toMatch(/För få yrkesgrupper med minst 15 personer/);
    });
});

describe('täthetskurvor: lådmärkets form fiol', () => {
    const fig = data => ({ beskrivning: 'F', x: { skala: 'band', ordning: ['A', 'B'] }, y: { skala: 'linjar', doman: [0, 100] },
        lager: [{ marke: 'lada', form: 'fiol', serie: 'Alla', farg: '#2563eb', data, tips: (d, s) => [[d.x], ['Antal', String(s ? s.n : 0)]] }] });
    const rita = (f, val = '{ bredd: 500 }') => { const el = behallare('chart-fiol'); w.__el = el; w.__f = f; w.eval(`ritaFigur(window.__el, window.__f, ${val})`); return el; };
    const panel = el => el.querySelector('svg[data-del="panel"]').outerHTML;
    const A = () => [20, 22, 24, 25, 26, 27, 28, 30, 31, 33, 35, 36].map(y => ({ x: 'A', y }));
    it('kurvan: högsta punkten är 1, den går mellan gränserna, och två grupper av värden ger två toppar', () => {
        w.__v = [10, 11, 12, 13, 14, 50, 51, 52, 53, 54];
        const k = w.eval('_rfTathetKurva(window.__v, 10, 54)');
        expect(k[0].v).toBe(10); expect(k[k.length - 1].v).toBe(54);
        expect(Math.max(...k.map(p => p.t))).toBe(1);
        const mitt = k[Math.floor(k.length / 2)].t;
        expect(mitt).toBeLessThan(0.8);                                                // dalen mellan topparna
        expect(w.eval('_rfTathetKurva([5], 5, 5)').map(p => p.t)).toEqual([1, 1]);
    });
    it('en fiol per kategori, med median och kvartiler men utan morrhår och avvikarpunkter', () => {
        const el = rita(fig([...A(), ...A().map(d => ({ x: 'B', y: d.y + 40 }))]));
        expect(el.querySelectorAll('path[data-marke="lada"][data-form="fiol"]')).toHaveLength(2);
        expect(el.querySelectorAll('line[data-marke="median"]')).toHaveLength(2);
        expect(el.querySelectorAll('line[data-marke="kvartil"]')).toHaveLength(4);
        expect(el.querySelectorAll('[data-marke="morrhar"], [data-marke="avvikare"], rect[data-marke="lada"]')).toHaveLength(0);
        // Träffen ger lådans sammanfattning — ett aggregat, aldrig en individ.
        w.__m = el.querySelector('path[data-marke="lada"]');
        const t = w.eval('_rfTraff(window.__el, window.__m)');
        expect(t.sammanfattning).toMatchObject({ n: 12 });
        expect(figurTillTabell(fig(A())).slice(1)).toHaveLength(1);                     // en rad per kategori
        w.eval('rensaFigur(window.__el)');
    });
    it('en avvikare långt bort ändrar inte kurvan: den slutar vid morrhårens ändar', () => {
        const med = v => panel(rita(fig([...A(), { x: 'A', y: v }])));
        const a = med(95), b = med(80);
        expect(a).toBe(b);                                                             // två olika avvikare, samma bild
        expect(a).not.toMatch(/data-marke="avvikare"/);
        w.eval('rensaFigur(window.__el)');
    });
    it('små individer: samma bild som utan dem; en kategori med bara små ritas inte; med visaSma streckad kant', () => {
        const sma = [{ x: 'A', y: 77, liten: true }, { x: 'B', y: 71, liten: true }, { x: 'B', y: 72, liten: true }];
        const utan = panel(rita(fig(A())));
        const el = rita(fig([...A(), ...sma]));
        expect(panel(el)).toBe(utan);
        expect(el.querySelectorAll('path[data-form="fiol"]')).toHaveLength(1);
        expect(el.outerHTML).not.toMatch(/>B</);                                       // kategorin finns inte ens på axeln
        const visad = rita(fig([...A(), ...sma]), '{ bredd: 500, visaSma: true }');
        expect([...visad.querySelectorAll('path[data-form="fiol"]')].map(p => p.getAttribute('stroke-dasharray'))).toEqual(['3 2', '3 2']);
        w.eval('rensaFigur(window.__el)');
    });
});

describe('Ålder & karriär: lönefördelningen per BAS-intervall', () => {
    const MARKOR = 76555;
    const rad = (bas, kon, lon) => ({ bas, kon, lon, alder: 40, yrke: '100 X', aid: '100', yrkeLabel: 'X', enhet: '' });
    const data = () => [...Array.from({ length: 12 }, (_, i) => rad('A', 'kvinna', 30000 + i * 100)), ...Array.from({ length: 12 }, (_, i) => rad('A', 'man', 32000 + i * 100)),
                        ...Array.from({ length: 3 }, (_, i) => rad('B', 'kvinna', MARKOR + i)), ...Array.from({ length: 14 }, (_, i) => rad('B', 'man', 40000 + i * 100)),
                        ...Array.from({ length: 4 }, (_, i) => rad('S', 'man', MARKOR + 100 + i))];
    it('alla: en kurva per BAS som når tröskeln; per kön: en per kön som når den — övriga är små och namnges', () => {
        w.__d = data();
        const alla = w.eval('_konTathetFigur(window.__d, false, 10)');
        expect(alla.figur.lager.map(l => [l.marke, l.form, l.serie])).toEqual([['lada', 'fiol', 'Alla']]);
        const sma = f => [...new Set(f.lager.flatMap(l => l.data.filter(d => d.liten).map(d => `${d.x}|${l.serie}`)))].sort();
        expect(sma(alla.figur)).toEqual(['BAS S|Alla']);
        expect(alla.utelamnade).toEqual(['BAS S']);
        const kon = w.eval('_konTathetFigur(window.__d, true, 10)');
        expect(kon.figur.lager.map(l => l.serie)).toEqual(['Kvinna', 'Man']);
        expect(sma(kon.figur)).toEqual(['BAS B|Kvinna', 'BAS S|Man']);
        expect(kon.utelamnade).toEqual(['BAS B (kvinnor)', 'BAS S (män)']);
        expect(kon.figur.lager[0].data[0].markering).toEqual(['bas:A']);
    });
    it('vyn: kurvorna ritas i fliken, valet Per kön ritar om, och inget under tröskeln finns i bild, data eller export', () => {
        const w2 = createAppWindow();
        w2.__state.data = data();
        w2.eval('populateSelects(); unlockTabs();');
        w2.__renderTabContent('kon');
        const d = w2.document, el = d.getElementById('chart-kon-tathet');
        expect(el.querySelectorAll('path[data-form="fiol"]')).toHaveLength(2);          // BAS A och B
        expect(d.getElementById('kon-tathet-not').textContent).toMatch(/Visas inte, färre än 10 personer: BAS S\./);
        d.getElementById('kon-tathet-visa').value = 'kon';
        d.getElementById('kon-tathet-visa').dispatchEvent(new w2.Event('change', { bubbles: true }));
        expect(el.querySelectorAll('path[data-form="fiol"]')).toHaveLength(3);          // A kvinnor, A män, B män
        expect(d.getElementById('kon-tathet-not').textContent).toMatch(/BAS B \(kvinnor\), BAS S \(män\)/);
        const allt = (el.outerHTML + JSON.stringify(w2.eval('chartExportRows(document.getElementById("chart-kon-tathet"))'))).replace(/(\d)[\s  ](?=\d)/g, '$1').replace(/\s(?:d|x[12]?|y[12]?|transform|width|height)="[^"]*"/g, '');
        expect(allt).not.toMatch(/7655\d|7665\d|BAS S/);
        // Diagramdatan: en rad per kurva med median och kvartiler — aldrig en rad per person.
        expect(w2.eval('chartExportRows(document.getElementById("chart-kon-tathet"))').filter(r => /^BAS /.test(String(r[1])))).toHaveLength(3);
    });
});

// ---- Regnmoln, små multiplar, histogram, ytor och trädkarta ----
describe('regnmoln: täthetskurva, streck och individpunkter i samma bild', () => {
    const fig = data => ({ beskrivning: 'R', x: { skala: 'band', ordning: ['A'] }, y: { skala: 'linjar', doman: [0, 100] },
        lager: [{ marke: 'lada', form: 'regnmoln', serie: 'Alla', farg: '#2563eb', data, tips: (d, s) => [[d.x], [s ? 'Antal' : 'Lön', String(s ? s.n : d.y)]] }] });
    const rita = (f, val = '{ bredd: 500 }') => { const el = behallare('chart-regn'); w.__el = el; w.__f = f; w.eval(`ritaFigur(window.__el, window.__f, ${val})`); return el; };
    const A = () => [20, 22, 24, 25, 26, 27, 28, 30, 31, 33, 35, 36].map(y => ({ x: 'A', y }));
    it('molnet till höger om mitten, punkterna till vänster, median och kvartiler som streck', () => {
        const el = rita(fig(A()));
        expect(el.querySelectorAll('path[data-marke="lada"][data-form="regnmoln"]')).toHaveLength(1);
        expect(el.querySelectorAll('line[data-marke="median"]')).toHaveLength(1);
        expect(el.querySelectorAll('line[data-marke="kvartil"]')).toHaveLength(2);
        const punkter = [...el.querySelectorAll('circle[data-marke="individ"]')];
        expect(punkter).toHaveLength(12);
        const med = Number(el.querySelector('line[data-marke="median"]').getAttribute('x1'));
        expect(punkter.every(c => Number(c.getAttribute('cx')) < med)).toBe(true);
        // Kurvan är ett aggregat, punkten en individ.
        w.__m = el.querySelector('path[data-marke="lada"]');
        expect(w.eval('_rfTraff(window.__el, window.__m)').sammanfattning).toMatchObject({ n: 12 });
        w.__m = punkter[0];
        expect(w.eval('_rfTraff(window.__el, window.__m)').d).toMatchObject({ x: 'A' });
        expect(figurTillTabell(fig(A())).slice(1)).toHaveLength(1);                     // diagramdatan: aldrig individer
        w.eval('rensaFigur(window.__el)');
    });
    it('små individer: samma bild som utan dem; med visaSma ritas de sist och de övriga ligger still', () => {
        const sma = [{ x: 'A', y: 77, liten: true }, { x: 'A', y: 78, liten: true }];
        const lagen = el => [...el.querySelectorAll('circle[data-marke="individ"]')].map(c => [c.getAttribute('data-i'), c.getAttribute('cx'), c.getAttribute('cy')]);
        const utan = rita(fig(A())), panelUtan = utan.querySelector('svg[data-del="panel"]').outerHTML, lagenUtan = lagen(utan);
        expect(rita(fig([...A(), ...sma])).querySelector('svg[data-del="panel"]').outerHTML).toBe(panelUtan);
        const visad = lagen(rita(fig([...A(), ...sma]), '{ bredd: 500, visaSma: true }'));
        expect(visad).toHaveLength(14);
        expect(visad.slice(0, 12).map(p => [p[0], p[1]])).toEqual(lagenUtan.map(p => [p[0], p[1]]));
        w.eval('rensaFigur(window.__el)');
    });
});

describe('Ålder & karriär: lön mot ålder i små multiplar', () => {
    const MARKOR = 75333;
    const rad = (yrke, bas, kon, lon, alder) => ({ bas, kon, lon, alder, yrke, aid: yrke.slice(0, 3), yrkeLabel: 'X', enhet: '' });
    const data = () => [...Array.from({ length: 24 }, (_, i) => rad('100 X', 'A', i % 2 ? 'man' : 'kvinna', 30000 + i * 50, 30 + i)),
                        ...Array.from({ length: 4 }, (_, i) => rad('200 Liten', 'A', 'kvinna', MARKOR + i, 41 + i)),
                        ...Array.from({ length: 22 }, (_, i) => rad('300 Y', 'B', i % 2 ? 'man' : 'kvinna', 36000 + i * 50, 28 + i)),
                        ...Array.from({ length: 5 }, (_, i) => rad('400 Z', 'S', 'man', MARKOR + 50 + i, 50 + i))];
    it('en panel per BAS som når tröskeln, punkter per kön med samma regel som punktdiagrammet, trend per panel', () => {
        const w2 = createAppWindow();
        w2.__state.data = data();
        w2.eval('populateSelects(); unlockTabs();');
        w2.__renderTabContent('kon');
        const d = w2.document, el = d.getElementById('chart-kon-multiplar'), f = el._figur;
        expect(f.paneler).toEqual(['BAS A', 'BAS B']);
        expect(f.lager.filter(l => l.marke === 'linje').map(l => l.panel)).toEqual(['BAS A', 'BAS B']);
        // De fyra i den lilla yrkesgruppen är små: de ritas inte, men ingår i trendlinjen för sitt intervall.
        expect(f.lager.filter(l => l.panel === 'BAS A' && l.marke === 'punkt').flatMap(l => l.data).filter(p => p.liten)).toHaveLength(4);
        expect(el.querySelectorAll('[data-marke="punkt"]')).toHaveLength(46);
        expect(el.querySelectorAll('svg[data-del="panel"]')).toHaveLength(2);
        expect(d.getElementById('kon-multiplar-not').textContent).toMatch(/BAS S/);
        const allt = (el.outerHTML + JSON.stringify(w2.eval('chartExportRows(document.getElementById("chart-kon-multiplar"))'))).replace(/(\d)[\s  ](?=\d)/g, '$1').replace(/\s(?:d|c?[xy][12]?|transform|width|height|r)="[^"]*"/g, '');
        expect(allt).not.toMatch(/7533\d|7538\d|BAS S/);
    });
});

describe('Ålder & karriär: histogram med kön mot kön', () => {
    it('varje klass rymmer minst tröskeln, ändarna slås ihop, och andelarna summerar till 100 % per kön', () => {
        w.__kv = [...Array.from({ length: 30 }, (_, i) => 30000 + i * 300), 61000];        // en ensam kvinna högt upp
        w.__ma = [...Array.from({ length: 30 }, (_, i) => 33000 + i * 300), 21000];        // en ensam man långt ned
        const klasser = w.eval('_konHistogramKlasser(window.__kv, window.__ma, 10)');
        expect(klasser.length).toBeGreaterThanOrEqual(3);
        expect(klasser.every(c => c.nKv + c.nMa >= 10)).toBe(true);
        expect(klasser[0].oppenNed).toBe(true);
        expect(klasser[klasser.length - 1].oppenUpp).toBe(true);
        expect(klasser.reduce((s, c) => s + c.nKv, 0)).toBe(31);
        w.__kl = klasser;
        const f = w.eval('_konHistogramFigur(window.__kl, 31, 31, "hela urvalet")');
        expect(f.lager.map(l => Math.round(l.data.reduce((s, d) => s + d.y, 0)))).toEqual([100, 100]);
        expect(f.x.ordning[0]).toMatch(/^under /);
        expect(f.x.ordning[f.x.ordning.length - 1]).toMatch(/ eller mer$/);
        expect(JSON.stringify(f)).not.toMatch(/61[\s ]?000|21[\s ]?000|"61"|"21"/);   // de ensamma lönerna syns inte som klassgräns
        expect(() => valideraFigur(f, 't')).not.toThrow();
    });
    it('ett kön under tröskeln, eller löner som inte går att dela in: inga klasser', () => {
        w.__kv = [30000, 31000, 32000]; w.__ma = Array.from({ length: 30 }, (_, i) => 33000 + i * 300);
        expect(w.eval('_konHistogramKlasser(window.__kv, window.__ma, 10)')).toBeNull();
        w.__kv = Array.from({ length: 10 }, () => 30000); w.__ma = Array.from({ length: 10 }, () => 30000);
        expect(w.eval('_konHistogramKlasser(window.__kv, window.__ma, 10)')).toBeNull();
    });
});

describe('Ålder & karriär: lönefördelningen per kön i fliken', () => {
    it('vyn: histogrammet ritas i fliken och följer tröskeln', () => {
        const w2 = createAppWindow();
        const rad = (kon, lon, alder) => ({ bas: 'A', kon, lon, alder, yrke: '100 X', aid: '100', yrkeLabel: 'X', enhet: '' });
        w2.__state.data = [...Array.from({ length: 30 }, (_, i) => rad('kvinna', 30000 + i * 200, 30 + (i % 4))), ...Array.from({ length: 30 }, (_, i) => rad('man', 32000 + i * 200, 40 + (i % 4)))];
        w2.eval('populateSelects(); unlockTabs();');
        w2.__renderTabContent('kon');
        const d = w2.document;
        expect(d.getElementById('chart-kon-histogram')._figur.lager.map(l => l.serie)).toEqual(['Kvinnor', 'Män']);
        w2.eval('sattKTroskel(31, { fraga: false })');
        w2.eval("renderKon('__ALLA__')");
        expect(d.getElementById('chart-kon-histogram')._figur).toBeUndefined();
        expect(d.getElementById('chart-kon-histogram').textContent).toMatch(/färre än 31 personer/);
    });
});

describe('anteckning i exportbilden', () => {
    it('vyns anteckning står först i fotraden; utan anteckning står bara Lönekartläggning och datumet i fotraden', () => {
        const f = { beskrivning: 'A', x: { skala: 'band' }, y: { skala: 'linjar' }, lager: [{ marke: 'stapel', serie: 'S', data: [{ x: 'A', y: 1 }] }] };
        const el = behallare('chart-anteckning'); w.__el = el; w.__f = f;
        w.eval('ritaFigur(window.__el, window.__f, { bredd: 500, exportAnteckning: "Störst skillnad: BAS C" })');
        expect(w.eval('_chartExportRubrikFot(window.__el, new Date(2026, 9, 10)).fot')).toBe('Störst skillnad: BAS C · Lönekartläggning 2026-10-10');
        w.eval('ritaFigur(window.__el, window.__f, { bredd: 500 })');
        expect(w.eval('_chartExportRubrikFot(window.__el, new Date(2026, 9, 10)).fot')).toBe('Lönekartläggning 2026-10-10');
        w.eval('rensaFigur(window.__el)');
    });
});

describe('fria ytor och dolda axlar (märket yta)', () => {
    const fig = data => ({ beskrivning: 'Y', legend: false, x: { skala: 'linjar', doman: [0, 2], dold: true }, y: { skala: 'linjar', doman: [0, 1], dold: true },
        fargskala: { typ: 'sekventiell', doman: [0, 100] }, lager: [{ marke: 'yta', serie: 'S', data, tips: d => [[d.namn]] }] });
    const rita = (f, val = '{ bredd: 600 }') => { const el = behallare('chart-yta'); w.__el = el; w.__f = f; w.eval(`ritaFigur(window.__el, window.__f, ${val})`); return el; };
    const ytor = () => [{ x0: 0, x1: 1, y0: 0, y1: 1, namn: 'Stor', etikett: 'Stor', undertext: '10 personer', fargvarde: 80, varde: 10 },
                        { x0: 1, x1: 2, y0: 0.5, y1: 1, namn: 'Halv', etikett: 'Halv', fargvarde: 20, varde: 5 },
                        { x0: 1, x1: 2, y0: 0, y1: 0.5, namn: 'HEMLIG', etikett: 'HEMLIG', fargvarde: 50, varde: 3, liten: true }];
    it('ytorna ritas mellan sina hörn, med etikett när den ryms, utan axelmarkeringar och stödlinjer', () => {
        const el = rita(fig(ytor().slice(0, 2)));
        const r = [...el.querySelectorAll('rect[data-marke="yta"]')].map(e => ['x', 'y', 'width', 'height'].map(a => Number(e.getAttribute(a))));
        expect(r).toHaveLength(2);
        expect(r[0][2]).toBeCloseTo(r[1][2], 5);                                        // samma bredd
        expect(r[1][3]).toBeCloseTo(r[0][3] / 2, 5);                                    // halva höjden
        expect(r[1][1]).toBeCloseTo(r[0][1], 5);                                        // den övre halvan
        expect([...el.querySelectorAll('text[data-marke="ytetikett"]')].map(t => t.childNodes[0].textContent)).toEqual(['Stor', '10 personer', 'Halv']);
        expect(el.querySelectorAll('[data-axel]')).toHaveLength(0);
        w.__m = el.querySelector('rect[data-marke="yta"]');
        expect(w.eval('_rfTraff(window.__el, window.__m)').d.namn).toBe('Stor');
        w.eval('rensaFigur(window.__el)');
    });
    it('en liten yta: samma bild som utan den, aldrig i exporten; med visaSma ritas den markerad', () => {
        const panel = el => el.querySelector('svg[data-del="panel"]').outerHTML;
        const utan = panel(rita(fig(ytor().slice(0, 2))));
        const el = rita(fig(ytor()));
        expect(panel(el)).toBe(utan);
        expect(el.outerHTML + w.figurTillSvg(fig(ytor()), 1600, 900, {}) + JSON.stringify(figurTillTabell(utanSmaGrupper(fig(ytor()))))).not.toContain('HEMLIG');
        const visad = rita(fig(ytor()), '{ bredd: 600, visaSma: true }');
        expect(visad.querySelectorAll('rect[data-marke="yta"]')).toHaveLength(3);
        expect(visad.querySelector('rect[data-marke="yta"][data-i="2"]').getAttribute('stroke-dasharray')).toBe('4 3');
        w.eval('rensaFigur(window.__el)');
    });
});

describe('Struktur: organisationen som trädkarta', () => {
    const MARKOR = 73777;
    const rad = (aid, bas, kon, lon) => ({ bas, kon, lon, alder: 40, yrke: `${aid} Yrke${aid}`, aid, yrkeLabel: `Yrke${aid}`, enhet: '' });
    const grupp = (aid, bas, nKv, nMa) => [...Array.from({ length: nKv }, () => rad(aid, bas, 'kvinna', 30000)), ...Array.from({ length: nMa }, () => rad(aid, bas, 'man', 31000))];
    const data = () => [...grupp('2000', 'A', 15, 5), ...grupp('2100', 'A', 2, 10), ...grupp('2200', 'A', 3, 0).map(r => ({ ...r, lon: MARKOR })), ...grupp('2300', 'A', 0, 2),
                        ...grupp('3000', 'B', 20, 20)];
    it('en yta per yrkesgrupp som når tröskeln, små hopslagna per BAS utan namn och könsfördelning, ytan följer antalet', () => {
        w.__d = data();
        const f = w.eval('_strukturTradkartaFigur(window.__d, 10)');
        expect(f.lager.map(l => [l.marke, l.serie])).toEqual([['yta', 'BAS-intervall'], ['yta', 'Yrkesgrupper']]);
        expect(f.lager[0].data.map(d => [d.namn, d.varde])).toEqual([['BAS A', 37], ['BAS B', 40]]);
        const g = f.lager[1].data;
        expect(g.map(d => [d.etikett, d.n, d.fargvarde ?? null]).sort()).toEqual([['Yrke2000', 20, 75], ['Yrke2100', 12, 16.7], ['Yrke3000', 40, 50], ['Övriga små grupper (2)', 5, null]].sort());
        const yta = d => (d.x1 - d.x0) * (d.y1 - d.y0);
        const stor = g.find(d => d.etikett === 'Yrke3000'), liten = g.find(d => d.etikett === 'Yrke2100');
        expect(yta(stor) / yta(liten)).toBeGreaterThan(2.5);                              // 40 mot 12 personer (kanterna tar lite plats)
        expect(JSON.stringify(f)).not.toMatch(/Yrke2200|Yrke2300|73777|30000|31000/);    // inga små gruppers namn, inga löner
        expect(f.x.dold && f.y.dold).toBe(true);
        expect(() => valideraFigur(f, 't')).not.toThrow();
        expect(g.find(d => d.etikett === 'Yrke2000').markering).toEqual(['bas:A', 'grupp:2000|A']);
    });
    it('vyn: kartan ritas i Struktur med färgskala, och diagramdatan bär namn och antal', () => {
        const w2 = createAppWindow();
        w2.__state.data = data();
        w2.eval('populateSelects(); unlockTabs();');
        w2.__renderTabContent('struktur');
        const el = w2.document.getElementById('chart-struktur-tradkarta');
        expect(el.querySelectorAll('rect[data-marke="yta"]')).toHaveLength(6);           // två BAS + fyra ytor
        expect(el.querySelectorAll('[data-marke="fargstapel"]').length).toBeGreaterThan(0);
        const rader = w2.eval('chartExportRows(document.getElementById("chart-struktur-tradkarta"))');
        expect(rader.some(r => r[0] === 'Yrkesgrupper' && r[1] === 'Yrke3000 · BAS B' && r[2] === 40)).toBe(true);
        expect(JSON.stringify(rader) + el.outerHTML).not.toMatch(/Yrke2200|Yrke2300|73777/);
    });
});

// ---- Litet underlag och gapet i tabell ----
describe('litet underlag: staplar som gäller få personer ritas med mönster', () => {
    it('kärnan: mönster på en enskild stapel (datapunktens monster), inte på lagrets övriga', () => {
        const f = { beskrivning: 'M', x: { skala: 'band' }, y: { skala: 'linjar' }, lager: [{ marke: 'stapel', serie: 'S', farg: '#2563eb', data: [{ x: 'A', y: 10 }, { x: 'B', y: 4, monster: 'prickar' }, { x: 'C', y: 7, monster: 'okänt' }] }] };
        const el = behallare('chart-monster'); w.__el = el; w.__f = f;
        w.eval('ritaFigur(window.__el, window.__f, { bredd: 500 })');
        expect(el.querySelectorAll('rect[data-marke="stapel"]')).toHaveLength(3);
        expect(el.querySelectorAll('svg[data-marke="monster"]')).toHaveLength(1);
        w.eval('rensaFigur(window.__el)');
    });
    it('histogrammet: en stapel med färre än fem av könet är märkt, tipset och noten säger det', () => {
        expect(w.eval('litetUnderlag()')).toBe(5);
        w.__kl = [{ fran: 30000, till: 32000, nKv: 12, nMa: 2 }, { fran: 32000, till: 34000, nKv: 8, nMa: 8 }, { fran: 34000, till: 36000, nKv: 0, nMa: 10 }];
        const f = w.eval('_konHistogramFigur(window.__kl, 20, 20, "x")');
        expect(f.lager[0].data.map(d => !!d.fa)).toEqual([false, false, false]);               // 12, 8 och 0 kvinnor: noll är inget litet underlag
        expect(f.lager[1].data.map(d => !!d.fa)).toEqual([true, false, false]);                // 2 män
        expect(f.lager.every(l => l.lage === 'overlagrad' && l.opacitet === 0.55 && l.data.every(d => !d.monster))).toBe(true);   // två halvgenomskinliga lager, inget mönster
        expect(f.lager[1].tips(f.lager[1].data[0]).some(r => r[0] === 'Litet underlag')).toBe(true);
        expect(f.lager[1].tips(f.lager[1].data[1]).some(r => r[0] === 'Litet underlag')).toBe(false);
        const w2 = createAppWindow();
        const rad = (kon, lon) => ({ bas: 'A', kon, lon, alder: 40, yrke: '100 X', aid: '100', yrkeLabel: 'X', enhet: '' });
        w2.__state.data = [...Array.from({ length: 30 }, (_, i) => rad('kvinna', 30000 + i * 200)), ...Array.from({ length: 30 }, (_, i) => rad('man', 32000 + i * 200))];
        w2.eval('populateSelects(); unlockTabs();');
        w2.__renderTabContent('kon');
        const not = w2.document.getElementById('kon-histogram-not');
        const fa = w2.document.getElementById('chart-kon-histogram')._figur.lager.some(l => l.data.some(d => d.fa));
        expect(not.hidden).toBe(!fa);
        if (fa) expect(not.textContent).toMatch(/färre än 5 personer av könet/);
    });
});

describe('Löneöversyn: gapet per grupp före och efter står också i en tabell', () => {
    it('samma rader och tal som diagrammet, med förändringen, och raderna går att markera', () => {
        const w2 = createAppWindow();
        const rad = (aid, bas, kon, lon) => ({ bas, kon, lon, alder: 40, yrke: `${aid} Yrke${aid}`, aid, yrkeLabel: `Yrke${aid}`, enhet: '' });
        w2.__state.data = [...Array.from({ length: 14 }, (_, i) => rad('6000', 'A', 'kvinna', 30000 + i * 10)), ...Array.from({ length: 10 }, (_, i) => rad('6000', 'A', 'man', 30000 + i * 10)),
                           ...Array.from({ length: 10 }, (_, i) => rad('6100', 'A', 'kvinna', 36000 + i * 10)), ...Array.from({ length: 14 }, (_, i) => rad('6100', 'A', 'man', 36000 + i * 10))];
        w2.eval('populateSelects(); unlockTabs();');
        w2.__state.forecast.targets = [{ bas: 'A', aid: '6000', mode: 'pct', value: 10, dist: 'flat', targetLevel: 'median', pool: 'övrigt' }];
        w2.__renderTabContent('loneoversyn');
        const d = w2.document, f = d.getElementById('chart-forecast-lutning')._figur;
        const rader = [...d.querySelectorAll('#forecast-lutning-table tbody tr')];
        expect(rader).toHaveLength(1);
        const celler = [...rader[0].cells].map(c => c.textContent.replace(/[  ]/g, ' '));
        const fmt = v => new Intl.NumberFormat('sv-SE', { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(v).replace(/[  ]/g, ' ') + ' %';
        const fore = f.lager.find(l => l.serie === 'Före').data[0], efter = f.lager.find(l => l.serie === 'Efter').data[0];
        expect(celler.slice(0, 3)).toEqual(['BAS A', fmt(fore.x), fmt(efter.x)]);
        expect(celler[3]).toMatch(/procentenheter$/);
        expect(rader[0]._markering).toEqual(['bas:A']);
        // Per yrkesgrupp med ett jämnt påslag ändras inget gap: tabellen är tom.
        d.getElementById('forecast-lutning-niva').value = 'grupp';
        d.getElementById('forecast-lutning-niva').dispatchEvent(new w2.Event('change', { bubbles: true }));
        expect(d.getElementById('forecast-lutning-tabell').innerHTML).toBe('');
    });
});

// ---- Exportvägarna och prestanda ----
describe('ZIP-exporten: alla ritade diagram som får exporteras', () => {
    it('listan följer det som är ritat, i id-ordning, och aldrig diagrammet i Personer att granska', () => {
        const w2 = createAppWindow();
        w2.__loadDemoData();
        for (const t of ['matrix', 'struktur', 'kon']) w2.__renderTabContent(t);
        const ids = w2.eval('zipDiagram().map(el => el.id)');
        expect(ids).toEqual(ids.slice().sort((a, b) => a.localeCompare(b)));
        for (const id of ['chart-skevhet-overview', 'chart-skevhet-andel', 'chart-struktur-kvartiler', 'chart-struktur-tradkarta', 'chart-kon-scatter', 'chart-kon-tathet', 'chart-demo-pyramid']) expect(ids, id).toContain(id);
        expect(ids.some(id => id.startsWith('chart-pag-'))).toBe(false);                 // Personer att granska bär inget diagram att exportera
        expect(ids).not.toContain('chart-explore');                                      // Utforska är inte öppnat: inte ritat
        expect(new Set(ids).size).toBe(ids.length);
    });
});

describe('små multiplar: tak på antalet punkter per panel', () => {
    it('ett stort intervall visar ett urval, lika varje gång; små personer räknas inte in i taket; trenden räknas ur alla', () => {
        const rad = (i, bas) => ({ bas, kon: i % 2 ? 'man' : 'kvinna', lon: 30000 + (i % 500) * 10, alder: 25 + (i % 40), yrke: '100 X', aid: '100', yrkeLabel: 'X', enhet: '' });
        w.__d = [...Array.from({ length: 4000 }, (_, i) => rad(i, 'A')), ...Array.from({ length: 40 }, (_, i) => rad(i, 'B'))];
        const u = w.eval('_konMultiplarFigur(window.__d, () => false, 10)');
        const antal = panel => u.figur.lager.filter(l => l.panel === panel && l.marke === 'punkt').reduce((s, l) => s + l.data.length, 0);
        expect(antal('BAS A')).toBeLessThanOrEqual(1500);
        expect(antal('BAS A')).toBeGreaterThan(1000);
        expect(antal('BAS B')).toBe(40);
        expect(u.nedsamplade).toEqual(['BAS A']);
        const igen = w.eval('_konMultiplarFigur(window.__d, () => false, 10)');
        expect(JSON.stringify(igen.figur.lager.map(l => l.data.length))).toBe(JSON.stringify(u.figur.lager.map(l => l.data.length)));
    });
});

describe('utskriften ur rapportmodellen', () => {
    it('avsnittens diagram följer med som bilder med bildtext; bilagorna följer bara med hela dokumentationen', async () => {
        const w2 = createAppWindow();
        w2.__loadDemoData();
        w2.print = () => {};
        const bygg = async urval => { w2.eval(`sattRapportUrval(${JSON.stringify(urval)})`); await w2.eval('buildPrintReport()'); await new Promise(r => setTimeout(r, 0)); return w2.document.getElementById('print-report'); };
        const rubriker = el => [...el.querySelectorAll('h1, h2')].map(h => h.textContent);
        const hela = await bygg('hela');
        // Samma avsnitt i samma ordning som Word-utkastet.
        const modell = w2.eval('rapportModell()').avsnitt;
        expect([...hela.querySelectorAll('section.rm-avsnitt')].map(s => s.dataset.rmAvsnitt)).toEqual(modell.map(a => a.id));
        expect([...hela.querySelectorAll('section.rm-avsnitt > h2')].map(h => h.textContent)).toEqual(modell.map(a => a.rubrik));
        const bildtexter = [...hela.querySelectorAll('figure.rm-bild figcaption')].map(f => f.textContent);
        for (const t of ['Kvinnors medianlön i procent av mäns, per BAS-intervall — samma kvot och intervall som tabellen ovan', 'Könsfördelning per BAS-intervall', 'Kvinnor och män per lönekvartil', 'Oförklarat lönegap per BAS-intervall']) expect(bildtexter, t).toContain(t);
        expect([...hela.querySelectorAll('img')].every(i => (i.getAttribute('alt') || '').length > 10 && /^data:image\/png/.test(i.getAttribute('src')))).toBe(true);
        expect(hela.textContent).toContain('Låst kopia');
        expect(hela.textContent).not.toContain('UTKAST att färdigställa');
        // Bilagorna: flikarnas tabeller och diagram.
        for (const r of ['Bilagor: tabeller och diagram ur flikarna', 'Löneöversikt (organisation · kön · yrke)', 'Lönefördelningen per BAS-intervall', 'Bilaga: Metodik & urval (kvalitetssäkring)']) expect(rubriker(hela), r).toContain(r);
        // Ett kortare urval är just avsnitten: inga bilagor, och inga avsnitt utöver urvalet.
        const facklig = await bygg('facklig');
        expect(rubriker(facklig).some(r => /^Bilagor:|Löneöversikt/.test(r))).toBe(false);
        expect([...facklig.querySelectorAll('section.rm-avsnitt')].map(s => s.dataset.rmAvsnitt)).toEqual(['sammanfattning', 'regler', 'lika', 'likvardigt', 'struktur', 'perbas', 'samverkan', 'regression', 'metod']);
        expect(facklig.querySelector('.k-stampel')).toBeNull();          // tröskeln står i metodbilagan
        // (Utskriften ritas i samma element varje gång: det som gäller facklig dialog prövas före nästa utskrift.)
        const ledning = await bygg('ledning');
        expect([...ledning.querySelectorAll('section.rm-avsnitt > h2')].map(h => h.textContent.slice(0, 2))).toEqual(['1.', '2.', '3.', '4.']);
        // Utan metodbilagan står tröskeln som en egen rad sist.
        expect(ledning.querySelector('.k-stampel').textContent).toMatch(/Minsta gruppstorlek för redovisning: 10/);
        // Väljaren för mallar är borta.
        expect(w2.document.getElementById('pdf-template')).toBeNull();
    }, 30000);
});

// ---- Svenskt talformat och språkrester ----
describe('tal som text har decimalkomma, och texten är svensk', () => {
    it('svTal och svPct: decimalkomma, mellanslag före procent, aldrig minus noll, streck för det som inte är ett tal', () => {
        const t = s => String(s).replace(/[  ]/g, ' ').replace(/−/g, '-');
        expect(t(w.eval('svTal(85.24, 1)'))).toBe('85,2');
        expect(t(w.eval('svTal(12345.6, 0)'))).toBe('12 346');
        expect(t(w.eval('svPct(88.84, 1)'))).toBe('88,8 %');
        expect(t(w.eval('svTal(-0.04, 1)'))).toBe('0,0');
        expect(t(w.eval('svTal(-3.26, 1)'))).toBe('-3,3');
        expect(w.eval('svTal(NaN, 1)')).toBe('–');
        expect(w.eval('svPct(null)')).toBe('–');
    });
    it('Ålder & karriär: nyckeltal och insikter har ingen decimalpunkt', () => {
        const w2 = createAppWindow();
        w2.__loadDemoData();
        w2.__renderTabContent('kon');
        const d = w2.document;
        const texter = ['kon-kpi-gap', 'kon-kpi-agegap', 'kon-kpi-slope', 'demo-kpi-age', 'demo-kpi-age-sub', 'demo-kpi-senior', 'demo-kpi-junior', 'demo-risk-insight', 'kon-insight', 'demo-insight']
            .map(id => d.getElementById(id)).filter(Boolean).map(el => el.textContent);
        expect(texter.length).toBeGreaterThan(5);
        expect(texter.filter(t => /\d\.\d/.test(t))).toEqual([]);
        expect(texter.filter(t => /\d%/.test(t))).toEqual([]);                           // mellanslag före procenttecknet
    });
    it('sidan säger inte "default" eller "vs" i rubriker och val', () => {
        const d = w.document;
        const synligt = [...d.querySelectorAll('h1, h2, h3, h4, option, summary, label, button')].map(el => el.textContent.trim());
        expect(synligt.filter(t => /\(default\)|(^|\s)vs\.?(\s|$)/i.test(t))).toEqual([]);
    });
});

describe('lönegapet visas som kvinnors lön i procent av mäns', () => {
    const t = s => String(s).replace(/[  ]/g, ' ');
    it('andelAvMan: 100 plus skillnaden, med decimalkomma; streck när värdet saknas', () => {
        expect(t(w.eval('andelAvMan(-8.3)'))).toBe('91,7 %');
        expect(t(w.eval('andelAvMan(0)'))).toBe('100,0 %');
        expect(t(w.eval('andelAvMan(4.25, 2)'))).toBe('104,25 %');
        expect(w.eval('andelAvMan(null)')).toBe('–');
    });
    it('Struktur: tabellerna och direktivets mått står i procent av mäns, med direktivets lönegap under', () => {
        const w2 = createAppWindow();
        w2.__loadDemoData();
        w2.__renderTabContent('struktur');
        const d = w2.document;
        expect(t(d.getElementById('struktur-representation').textContent)).toMatch(/Kvinnors median i % av mäns/);
        expect(t(d.getElementById('struktur-distribution').textContent)).toMatch(/Kvinnors lön i % av mäns/);
        const eu = t(d.getElementById('struktur-eu').textContent);
        // Direktivets mått står i samma form som resten, med direktivets lönegap under: positivt när kvinnor ligger lägre.
        expect(eu).toMatch(/Kvinnors medianlön i procent av mäns\s*\d+,\d %\s*Lönegap enligt direktivet: \d+,\d %/);
        expect(eu).toMatch(/positiv när kvinnor ligger lägre/);
        expect(eu).not.toMatch(/\(skillnad\)/);
    });
    it('Löneöversyn och lönesimulatorn säger procent av mäns för det råa gapet, och skillnad för det oförklarade', () => {
        const w2 = createAppWindow();
        w2.__loadDemoData();
        w2.__state.forecast.budget = { mode: 'pct', value: 2 };   // utan pott visas inget utfall
        w2.__renderTabContent('loneoversyn');
        const ut = t(w2.document.getElementById('forecast-outcome').textContent);
        expect(ut).toMatch(/Kvinnors medianlön i % av mäns: \d+,\d % till \d+,\d %/);
        expect(ut).toMatch(/Oförklarat gap \(regressionen\)/);
        expect(ut).not.toMatch(/Råa lönegapet/);
    });
});

describe('svenskt talformat i alla vyer, utan att exporterna ändras', () => {
    it('sorteringen läser minustecknet som Intl skriver', () => {
        expect(w.eval('_parseSwedishNumber("\\u22124,63 %")')).toBeCloseTo(-4.63, 5);
        expect(w.eval('_parseSwedishNumber("85,2 %")')).toBeCloseTo(85.2, 5);
    });
    it('ingen flik visar ett procenttal med decimalpunkt', () => {
        const w2 = createAppWindow();
        w2.__loadDemoData();
        const kvar = {};
        for (const flik of ['dashboard', 'matrix', 'likvardighet', 'struktur', 'prioritering', 'loneoversyn', 'kon', 'lonepolitik', 'utforska', 'benchmark']) {
            w2.__renderTabContent(flik);
            const traffar = new Set();
            for (const el of w2.document.querySelectorAll('.view *, [id^="view-"] *')) {
                if (el.children.length || el.closest('script, style, svg, code, pre, textarea, select')) continue;
                const m = /\d\.\d+\s?%/.exec(el.textContent);
                if (m) traffar.add(el.textContent.trim().slice(0, 60));
            }
            if (traffar.size) kvar[flik] = [...traffar].slice(0, 5);
        }
        expect(kvar).toEqual({});
    }, 30000);   // ritar varje flik: över standardgränsen 5 s när hela sviten körs parallellt
});

describe('ett bildspråk — linjeikoner i stället för bildtecken', () => {
    const BILDTECKEN = /[\u{1F300}-\u{1FAFF}⬜⚡⛔⚖⚙✨✅⚪]/u;
    it('ikon ger en dekorativ inline-SVG; ett okänt namn ger ingenting', () => {
        const h = w.eval("ikon('nal')");
        expect(h).toMatch(/^<svg class="ikon ikon-nal" width="16" height="16"[^>]*aria-hidden="true"[^>]*>.*<\/svg>$/);
        expect(w.eval("ikon('oga', 28)")).toMatch(/width="28" height="28"/);
        expect(w.eval("ikon('finns-inte')")).toBe('');
    });
    it('källan har inga bildtecken kvar utanför kommentarer', () => {
        const kvar = [];
        for (const [fil, text] of [...KALLA, ['index.html', readFileSync('src/index.html', 'utf8')]]) {
            if (/^09-lib/.test(fil)) continue;
            text.split('\n').forEach((rad, i) => { if (!/^\s*(\/\/|\*|\/\*|<!--)/.test(rad) && BILDTECKEN.test(rad)) kvar.push(`${fil}:${i + 1}`); });
        }
        expect(kvar).toEqual([]);
    });
    it('statusmärkena är ikon plus ord, och tabellens text — det exporten läser — är ren text', () => {
        const w2 = createAppWindow();
        w2.__loadDemoData();
        w2.__renderTabContent('matrix');
        w2.__renderTabContent('prioritering');
        const d = w2.document;
        const status = [...d.querySelectorAll('#matrix-table tbody td')].find(td => /Värt att granska|Följ upp/.test(td.textContent));
        expect(status.querySelector('svg.ikon')).not.toBeNull();
        expect(BILDTECKEN.test(status.textContent)).toBe(false);
        expect(status.textContent.trim()).toMatch(/^(Värt att granska|Följ upp)/);
        // De fyra signalerna i regressionskortet har var sin form.
        const former = new Set(['statusKritisk', 'statusVarning', 'statusOsaker', 'statusIngen'].map(n => w2.eval(`ikon('${n}')`).replace(/class="[^"]*"/, '')));
        expect(former.size).toBe(4);
        expect(BILDTECKEN.test(d.body.textContent.replace(/\s+/g, ' '))).toBe(false);
    });
    it('Lika arbete: tabellen visar kvinnors median i procent av mäns, som dess exportrubrik säger', () => {
        const w2 = createAppWindow();
        w2.__loadDemoData();
        w2.__renderTabContent('matrix');
        const d = w2.document;
        expect([...d.querySelectorAll('#matrix-table thead th')].some(th => /Kvinnors median i % av mäns/.test(th.textContent))).toBe(true);
        expect(d.getElementById('matrix-table').textContent).not.toMatch(/Kvinnor [+−-]?\d/);
    });
});

// ---- Lika arbete i formen resultat först ----
describe('Lika arbete — urval, slutsatser och avsnittens nyckeltal', () => {
    const MARKOR = 72666;
    const t = s => String(s).replace(/[  ]/g, ' ').replace(/\s+/g, ' ').trim();
    it('slutsatserna säger detsamma som tabellerna under, och avsnitten bär sina nyckeltal', () => {
        const w2 = createAppWindow();
        w2.__loadDemoData();
        w2.__renderTabContent('matrix');
        const d = w2.document;
        const rader = [...d.querySelectorAll('#matrix-table tbody tr')].map(tr => tr._euRow).filter(r => r && !r.samladMedian);
        const granska = rader.filter(r => r.niva === 'granska').length;
        const kort = [...d.querySelectorAll('#la-slutsatser .slutsats')].map(k => [t(k.querySelector('.slutsats-etikett').textContent), t(k.querySelector('.slutsats-varde').textContent)]);
        expect(kort.map(k => k[0])).toEqual(['Yrkesgrupper att granska', 'Största skillnaden', 'Kvar efter ålder och nivå', 'Personer att granska']);
        expect(kort[0][1]).toBe(`${granska} av ${rader.length}`);
        const storst = rader.slice().sort((a, b) => Math.abs(100 - b.kvot) - Math.abs(100 - a.kvot))[0];
        expect(kort[1][1]).toBe(storst.kvot.toFixed(1).replace('.', ',') + ' %');
        expect(kort[2][1]).toMatch(/^[+−-]?\d+,\d %$/);                               // regressionens gap: skillnad
        expect(kort[3][1]).toBe(String(d.querySelectorAll('#pag-tabell tbody tr').length));
        expect(t(d.getElementById('la-urval').textContent)).toMatch(/Hela urvalet · 260 personer.*Minsta gruppstorlek 10/);
        expect(t(d.getElementById('nyckel-la-yrkesgrupper').textContent)).toMatch(new RegExp(`^${granska} att granska`));
        expect(t(d.getElementById('nyckel-la-bas').textContent)).toMatch(/^\d+ av \d+ över 5 %$/);
        expect(t(d.getElementById('nyckel-la-kon').textContent)).toMatch(/^\d+ av \d+ ojämna$/);
        expect(t(d.getElementById('nyckel-la-regression').textContent)).toMatch(/oförklarat$/);
        // Huvudvyn — översiktstabellen — ligger i toppen, i mallen för diagramkort.
        const kortet = d.getElementById('la-oversikt').closest('.diagramkort');
        expect(kortet.id).toBe('la-huvuddiagram');
        expect(kortet.querySelector('.diagramkort-rubrik').textContent).toMatch(/Kvinnors och mäns lön per BAS-intervall/);
    });
    it('markeringen står i raden under urvalsraden; "Rensa all data" tömmer toppen', () => {
        const w2 = createAppWindow();
        w2.__loadDemoData();
        w2.__renderTabContent('matrix');
        const d = w2.document;
        w2.eval("sattDiagramMarkering('bas:C')");
        expect(t(d.getElementById('markering-rad').textContent)).toMatch(/Markerat i alla diagram: BAS C/);
        expect(d.getElementById('la-urval').textContent).not.toMatch(/Markerat/);
        w2.eval('sattDiagramMarkering(null)');
        expect(d.getElementById('markering-rad')).toBeNull();
        w2.confirm = () => true;
        w2.eval('clearAllData()');
        expect(d.getElementById('la-slutsatser').innerHTML).toBe('');
        expect(d.getElementById('la-urval').textContent).toBe('');
        // Avsnittens nyckeltal är tomma; Regler & praxis säger att inget område är bedömt.
        expect([...d.querySelectorAll('.avsnitt-nyckel:not([id^="nyckel-rp-"])')].every(e => e.textContent === '')).toBe(true);
        expect([...d.querySelectorAll('.avsnitt-nyckel[id^="nyckel-rp-"]')].every(e => e.textContent === 'Ej bedömt')).toBe(true);
    });
    it('små grupper: toppen räknar bara rader med könsuppdelning och namnger aldrig en grupp under tröskeln', () => {
        const w2 = createAppWindow();
        const rad = (yrke, bas, kon, lon) => ({ bas, kon, lon, alder: 40, yrke, aid: yrke.slice(0, 6), yrkeLabel: yrke.slice(7), enhet: '' });
        w2.__state.data = [...Array.from({ length: 12 }, (_, i) => rad('207011 Usk', 'A', 'kvinna', 30000 + i * 10)), ...Array.from({ length: 12 }, (_, i) => rad('207011 Usk', 'A', 'man', 33000 + i * 10)),
                           ...Array.from({ length: 12 }, (_, i) => rad('502010 Hemlig', 'A', 'man', 40000 + i * 10)), ...Array.from({ length: 2 }, (_, i) => rad('502010 Hemlig', 'A', 'kvinna', MARKOR + i))];
        w2.eval('populateSelects(); unlockTabs();');
        w2.__renderTabContent('matrix');
        const topp = t(w2.document.getElementById('la-topp').textContent);
        expect(topp).toMatch(/Yrkesgrupper att granska\s*1 av 1/);
        expect(topp).toMatch(/Största skillnaden\s*\d+,\d %\s*207011 Usk/);
        expect(topp).not.toMatch(/Hemlig|7266\d/);
    });
});

// ---- Ålder & karriär i formen resultat först ----
describe('Ålder & karriär — ett urval för hela fliken, och avsnitt med nyckeltal', () => {
    const t = s => String(s).replace(/[  ]/g, ' ').replace(/\s+/g, ' ').trim();
    const oppna = () => { const w2 = createAppWindow(); w2.__loadDemoData(); w2.__renderTabContent('kon'); return w2; };
    it('väljaren i urvalsraden styr både lönedelen och åldersstrukturen; den dolda väljaren följer med', () => {
        const w2 = oppna(), d = w2.document;
        const sel = d.getElementById('bas-select-kon'), dold = d.getElementById('bas-select-demo');
        expect(sel.closest('.urvalsrad')).not.toBeNull();
        expect(dold.closest('.controls-row').hidden).toBe(true);
        const bas = [...sel.options].map(o => o.value).find(v => v !== '__ALLA__');
        const fore = { n: d.getElementById('kon-kpi-n').textContent, alder: d.getElementById('demo-kpi-age').textContent, hist: JSON.stringify(d.getElementById('chart-demo-hist')._figur.lager[0].data) };
        sel.value = bas;
        sel.dispatchEvent(new w2.Event('change', { bubbles: true }));
        expect(dold.value).toBe(bas);
        expect(d.getElementById('kon-kpi-n').textContent).not.toBe(fore.n);                 // lönedelen ritades om
        expect(JSON.stringify(d.getElementById('chart-demo-hist')._figur.lager[0].data)).not.toBe(fore.hist);   // och åldersstrukturen
        expect(t(d.getElementById('ak-urval-text').textContent)).toMatch(/^\d+ personer · minsta gruppstorlek 10$/);
        // Åt andra hållet: en länk som sätter den dolda väljaren flyttar hela fliken.
        dold.value = '__ALLA__';
        dold.dispatchEvent(new w2.Event('change', { bubbles: true }));
        expect(sel.value).toBe('__ALLA__');
        expect(d.getElementById('kon-kpi-n').textContent).toBe(fore.n);
    });
    it('avsnitten: lön mot ålder är öppet, de övriga hopfällda men ritade, och de som följer urvalet säger sitt nyckeltal', () => {
        const w2 = oppna(), d = w2.document;
        for (const id of ['chart-kon-boxplot', 'chart-kon-histogram', 'chart-demo-hist', 'chart-demo-pyramid', 'chart-kon-tathet', 'chart-kon-multiplar']) {
            const el = d.getElementById(id);
            expect(el._figur, id).toBeDefined();
            expect(el.closest('details.avsnitt').open, id).toBe(false);
        }
        expect(d.getElementById('chart-demo-spread').closest('details.avsnitt').open).toBe(true);
        expect(d.getElementById('chart-kon-scatter').closest('details.avsnitt')).toBeNull();          // huvuddiagrammet ligger i toppen
        expect(t(d.getElementById('nyckel-ak-fordelning').textContent)).toMatch(/^Kvinnors median \d+,\d % av mäns$/);
        expect(t(d.getElementById('nyckel-ak-struktur').textContent)).toMatch(/^\d+,\d % är 60 år eller äldre$/);
        expect(t(d.getElementById('nyckel-ak-lon').textContent)).toMatch(/^[+−-]?[\d ]+ kr per år$/);
        expect(t(d.getElementById('nyckel-ak-alla').textContent)).toMatch(/^\d+ BAS-intervall$/);
        // Avsnittet som inte följer urvalet säger det i rubriken, inte i en not under varje diagram.
        expect(t(d.querySelector('#avsnitt-ak-alla > summary').textContent)).toMatch(/Följer inte urvalet/);
        expect(d.getElementById('avsnitt-ak-alla').textContent).not.toMatch(/oavsett valt BAS-intervall/);
    });
    it('ett kön under tröskeln: avsnittet om lönefördelning får inget nyckeltal', () => {
        const w2 = createAppWindow();
        const rad = (kon, lon, alder) => ({ bas: 'A', kon, lon, alder, yrke: '100 X', aid: '100', yrkeLabel: 'X', enhet: '' });
        w2.__state.data = [...Array.from({ length: 20 }, (_, i) => rad('kvinna', 30000 + i * 100, 30 + i)), ...Array.from({ length: 3 }, (_, i) => rad('man', 55555 + i, 40 + i))];
        w2.eval('populateSelects(); unlockTabs();');
        w2.__renderTabContent('kon');
        expect(w2.document.getElementById('nyckel-ak-fordelning').textContent).toBe('');
        expect(w2.document.getElementById('avsnitt-ak-fordelning').querySelector('summary').textContent).not.toMatch(/5555\d/);
    });
});

// ---- Prioritering — resultatet först, inställningarna sist ----
describe('Prioritering i formen resultat först', () => {
    const t = s => String(s).replace(/[  ]/g, ' ').replace(/\s+/g, ' ').trim();
    const efter = (a, b) => !!(a.compareDocumentPosition(b) & 4);   // b kommer efter a
    it('nyckeltalen och matrisen först; åtgärdslistan öppen; kostnad, inställningar och metod hopfällda — i den ordningen', () => {
        const w2 = createAppWindow();
        w2.__loadDemoData();
        w2.__renderTabContent('prioritering');
        const d = w2.document, g = id => d.getElementById(id);
        const ordning = ['prio-summary', 'chart-prio-matrix', 'avsnitt-pr-lista', 'avsnitt-pr-kostnad', 'avsnitt-pr-installningar', 'avsnitt-pr-metod'].map(g);
        for (let i = 1; i < ordning.length; i++) expect(efter(ordning[i - 1], ordning[i]), ordning[i].id).toBe(true);
        expect(g('chart-prio-matrix').closest('details')).toBeNull();
        expect(['lista', 'kostnad', 'installningar', 'metod'].map(n => g('avsnitt-pr-' + n).open)).toEqual([true, false, false, false]);
        // Hopfällt men ritat och fungerande.
        expect(g('chart-prio-pareto')._figur).toBeDefined();
        expect(g('prio-cfg-atgard').closest('details').id).toBe('avsnitt-pr-installningar');
        expect(d.querySelector('[data-audit-id="prioritering"]').closest('details.avsnitt').id).toBe('avsnitt-pr-metod');
        expect(d.querySelectorAll('#prio-table tbody tr').length).toBeGreaterThan(0);
    });
    it('nyckeltalen: listan och kostnaden säger samma som rutorna, och inställningarna säger om de är ändrade', () => {
        const w2 = createAppWindow();
        w2.__loadDemoData();
        w2.__renderTabContent('prioritering');
        const d = w2.document;
        expect(t(d.getElementById('nyckel-pr-lista').textContent)).toMatch(/^\d+ grupp(er)?/);
        expect(t(d.getElementById('nyckel-pr-kostnad').textContent)).toBe(t(d.getElementById('prio-stat-cost').textContent));
        expect(t(d.getElementById('nyckel-pr-installningar').textContent)).toBe('Standardvärden');
        const falt = d.getElementById('prio-cfg-atgard');
        falt.value = '-8';
        falt.dispatchEvent(new w2.Event('input', { bubbles: true }));
        expect(t(d.getElementById('nyckel-pr-installningar').textContent)).toBe('Anpassade värden');
        expect(d.getElementById('nyckel-pr-installningar').classList.contains('ar-kritisk')).toBe(true);
    });
});

describe('kvantilpunkter: gruppen som lika stora andelar, aldrig individer', () => {
    const fig = (data, extra = {}) => ({ beskrivning: 'K', x: { skala: 'band', ordning: ['A', 'B'] }, y: { skala: 'linjar', doman: [0, 200] },
        lager: [{ marke: 'lada', form: 'kvantiler', antal: 20, serie: 'Alla', farg: '#2563eb', data, tips: (d, s) => [[d.x], ['Antal', String(s ? s.n : 0)]], ...extra }] });
    const rita = (f, val = '{ bredd: 500 }') => { const el = behallare('chart-kvantil'); w.__el = el; w.__f = f; w.eval(`ritaFigur(window.__el, window.__f, ${val})`); return el; };
    const A = n => Array.from({ length: n }, (_, i) => ({ x: 'A', y: 20 + i }));
    it('lika många prickar som kvantiler, alla mellan gruppens lägsta och högsta värde, inga individpunkter', () => {
        const el = rita(fig(A(60)));
        const prickar = [...el.querySelectorAll('circle[data-marke="kvantilpunkt"]')];
        expect(prickar).toHaveLength(20);
        expect(el.querySelectorAll('[data-marke="individ"], [data-marke="avvikare"]')).toHaveLength(0);
        // Prickarnas kvantiler ligger inom min–max; skärmläget följer värdeaxeln (högre värde = högre upp).
        const kp = w.eval('_figKvantilpunkter(window.__f.lager[0].data.map(d => d.y), 20)');
        expect(kp.varden.every(v => v >= 20 && v <= 79)).toBe(true);
        // Ingen prick täcker en annan: två prickar i samma kolumn ligger minst en diameter isär i sidled.
        const pos = prickar.map(c => [Number(c.getAttribute('cx')), Number(c.getAttribute('cy')), Number(c.getAttribute('r'))]);
        for (let a = 0; a < pos.length; a++) for (let b = a + 1; b < pos.length; b++) {
            expect(Math.hypot(pos[a][0] - pos[b][0], pos[a][1] - pos[b][1])).toBeGreaterThanOrEqual(pos[a][2] + pos[b][2] - 1e-6);
        }
        w.eval('rensaFigur(window.__el)');
    });
    it('en liten grupp: högst halva gruppen som prickar, och träffen säger prickens kvantil ur individerna', () => {
        const el = rita(fig(A(12)));
        expect(el.querySelectorAll('circle[data-marke="kvantilpunkt"]')).toHaveLength(6);
        w.__m = el.querySelector('circle[data-marke="kvantilpunkt"][data-kvantil="0"]');
        const t = w.eval('_rfTraff(window.__el, window.__m)');
        expect(t.sammanfattning).toMatchObject({ n: 12, kvantil: { nr: 1, antal: 6 } });
        expect(t.sammanfattning.kvantil.varde).toBeCloseTo(20 + 11 * (0.5 / 6), 6);
        expect(t.d).toEqual({ x: 'A' });                                                  // ett aggregat, ingen person
        w.eval('rensaFigur(window.__el)');
    });
    it('små grupper lämnar inga spår utan visaSma; med visaSma streckas prickarna', () => {
        const data = [...A(30), ...Array.from({ length: 4 }, (_, i) => ({ x: 'B', y: 173.37 + i, liten: true }))];
        let el = rita(fig(data));
        expect(el.querySelectorAll('circle[data-marke="kvantilpunkt"]')).toHaveLength(15);
        expect(el.innerHTML).not.toMatch(/17[3-6]\.37/);
        el = rita(fig(data), '{ bredd: 500, visaSma: true }');
        expect(el.querySelectorAll('circle[data-marke="kvantilpunkt"][stroke-dasharray]')).toHaveLength(2);
        w.eval('rensaFigur(window.__el)');
    });
    it('diagramdatan är kvantiltabellen, och utan små grupper finns den lilla gruppen inte i den', () => {
        const tab = figurTillTabell(fig(A(60)));
        expect(tab).toHaveLength(21);
        expect(tab[1][1]).toBe('A · 1/20');
        expect(tab.slice(1).every(r => typeof r[2] === 'number' && r[2] >= 20 && r[2] <= 79)).toBe(true);
        const data = [...A(30), ...Array.from({ length: 4 }, (_, i) => ({ x: 'B', y: 173.37 + i, liten: true }))];
        expect(JSON.stringify(figurTillTabell(utanSmaGrupper(fig(data))))).not.toMatch(/"B ·|17[3-6]\.37/);
    });
});

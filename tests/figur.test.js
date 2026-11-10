/**
 * Figurformatet: ren logik utan DOM och utan D3.
 */
import { describe, it, expect } from 'vitest';
import { talformat, valideraFigur, utanSmaGrupper, axelVarden, skalDoman, ladstatistik, antalPunkter, figurTillTabell, panelerMedLager, MARKEN, kronorSkillnad, kronorTipsRad, kvantilpunkter, urvalVarden, urvalEtikett, arBortvald, urvalLista, urvalSpann, urvalBeskrivning, urvalIntervallText, TALFORMAT,
    URVAL_LISTA_MAX, urvalSomLista, urvalAktivt, harleddaLager, harlettNamn, harlettNot } from '../src/lib/figur.js';
import { quantile } from '../src/lib/stat.js';

const blank = s => s.replace(/\s/g, ' ').replace('−', '-');
const bas = (over = {}) => ({
    beskrivning: 'Medianlön per BAS',
    x: { skala: 'band', titel: 'BAS' }, y: { skala: 'linjar', titel: 'Kronor/månad', format: 'kr' },
    lager: [{ marke: 'stapel', serie: 'Kvinna', data: [{ x: 'A', y: 30000 }, { x: 'B', y: 41200, liten: true }] }],
    ...over,
});

describe('valideraFigur: kategoriaxelns skala', () => {
    const ax = (x, y) => ({ beskrivning: 'b', x, y, lager: [] });
    const med = (lager, x, y) => ({ ...ax(x, y), lager: [lager] });
    it('en stapel kräver bandskala på kategoriaxeln (x, eller y för liggande)', () => {
        expect(() => valideraFigur(med({ marke: 'stapel', data: [] }, { skala: 'linjar' }, { skala: 'linjar' }))).toThrow(/stapel.*band.*x/);
        expect(() => valideraFigur(med({ marke: 'stapel', riktning: 'liggande', data: [] }, { skala: 'linjar' }, { skala: 'linjar' }))).toThrow(/stapel.*band.*y/);
        expect(() => valideraFigur(med({ marke: 'stapel', data: [] }, { skala: 'band' }, { skala: 'linjar' }))).not.toThrow();
        expect(() => valideraFigur(med({ marke: 'stapel', riktning: 'liggande', data: [] }, { skala: 'linjar' }, { skala: 'band' }))).not.toThrow();
    });
    it('en låda kräver bandskala på kategoriaxeln; en ruta kräver band på båda', () => {
        expect(() => valideraFigur(med({ marke: 'lada', data: [] }, { skala: 'linjar' }, { skala: 'linjar' }))).toThrow(/lada.*band/);
        expect(() => valideraFigur({ ...ax({ skala: 'band' }, { skala: 'linjar' }), fargskala: { doman: [0, 1] }, lager: [{ marke: 'ruta', data: [] }] })).toThrow(/ruta.*band/);
        expect(() => valideraFigur({ ...ax({ skala: 'band' }, { skala: 'band' }), fargskala: { doman: [0, 1] }, lager: [{ marke: 'ruta', data: [] }] })).not.toThrow();
    });
    it('en låda stöder bara stående riktning: liggande lådor avvisas (ritaren ritar dem inte)', () => {
        const lig = { marke: 'lada', riktning: 'liggande', data: [{ y: 'A', x: 1 }] };
        expect(() => valideraFigur(med(lig, { skala: 'linjar' }, { skala: 'band' }), 'chart-x')).toThrow(/Ogiltig figur \(chart-x\): lager 0: lada stöder bara stående riktning/);
        expect(() => valideraFigur(med(lig, { skala: 'band' }, { skala: 'linjar' }))).toThrow(/lada stöder bara stående riktning/);
        for (const riktning of [undefined, 'staende']) {
            expect(() => valideraFigur(med({ marke: 'lada', ...(riktning ? { riktning } : {}), data: [{ x: 'A', y: 1 }] }, { skala: 'band' }, { skala: 'linjar' }))).not.toThrow();
        }
    });
});

describe('valideraFigur: monster', () => {
    const f = m => ({ beskrivning: 'm', x: { skala: 'band' }, y: { skala: 'linjar' }, lager: [{ marke: 'stapel', monster: m, data: [{ x: 'a', y: 1 }] }] });
    it('godtar linjer, prickar och inget; avvisar annat och andra märken', () => {
        for (const m of ['linjer', 'prickar', undefined]) expect(() => valideraFigur(f(m), 't')).not.toThrow();
        expect(() => valideraFigur(f('rutor'), 't')).toThrow(/monster/);
        expect(() => valideraFigur({ beskrivning: 'm', x: { skala: 'linjar' }, y: { skala: 'linjar' }, lager: [{ marke: 'punkt', monster: 'linjer', data: [{ x: 1, y: 1 }] }] }, 't')).toThrow(/monster/);
    });
});

describe('valideraFigur: färgskalans domän (V2)', () => {
    const ruta = fargskala => ({ beskrivning: 'b', x: { skala: 'band' }, y: { skala: 'band' }, ...(fargskala === undefined ? {} : { fargskala }), lager: [{ marke: 'ruta', data: [{ x: 'A', y: 'B', varde: 1 }] }] });
    const punkt = (fargskala, fargvarde) => ({ beskrivning: 'b', x: { skala: 'linjar' }, y: { skala: 'linjar' }, fargskala, lager: [{ marke: 'punkt', data: [{ x: 1, y: 2, ...(fargvarde === null ? {} : { fargvarde }) }] }] });
    it.each([
        ['tomt objekt', {}], ['true', true], ['en sträng', 'sekventiell'], ['doman med strängar', { doman: ['a', 'b'] }], ['doman med ett tal', { doman: [1] }],
        ['doman med tre tal', { doman: [1, 2, 3] }], ['doman med NaN', { doman: [0, NaN] }], ['doman med oändligt', { doman: [0, Infinity] }], ['doman som inte är en lista', { doman: '0,1' }], ['doman null', { doman: null }],
    ])('en ruta kräver en färgskala med två ändliga tal i doman: %s avvisas', (_, fargskala) => {
        expect(() => valideraFigur(ruta(fargskala), 'chart-heat')).toThrow(/Ogiltig figur \(chart-heat\): fargskala: doman måste vara två ändliga tal/);
        expect(() => valideraFigur(punkt(fargskala, 50))).toThrow(/fargskala: doman måste vara två ändliga tal/);
    });
    it('lika tal och omvänd domän är tillåtna', () => {
        for (const doman of [[0, 1], [100, 100], [120, 80], [-5, 5]]) {
            expect(() => valideraFigur(ruta({ typ: 'sekventiell', doman }))).not.toThrow();
            expect(() => valideraFigur(punkt({ doman }, 3))).not.toThrow();
        }
    });
    it('utan lager som behöver färg prövas inte färgskalan', () => {
        expect(() => valideraFigur(punkt({}, null))).not.toThrow();
        expect(() => valideraFigur(punkt(true, null))).not.toThrow();
    });
    it('saknas färgskalan helt är felet detsamma', () => {
        expect(() => valideraFigur(ruta(undefined))).toThrow(/ruta med färgvärde kräver fargskala/);
    });
});

describe('talformat', () => {
    it('svensk lokal, namngivna format', () => {
        expect(blank(talformat(41200, 'kr'))).toBe('41 200 kr');
        expect(blank(talformat(41200.6, 'kr', { enhet: false }))).toBe('41 201');
        expect(blank(talformat(12.345, 'pct'))).toBe('12,3 %');
        expect(blank(talformat(-3.21, 'pct'))).toBe('-3,2 %');
        expect(blank(talformat(1234, 'antal'))).toBe('1 234');
        expect(blank(talformat(1.005, 'tal2'))).toMatch(/^1,0[01]$/);
        expect(talformat(47, 'ar')).toBe('47');
    });
    it.each([null, undefined, NaN, Infinity, 'x'])('%p ger ett tankstreck', v => {
        expect(talformat(v, 'kr')).toBe('–');
    });
});

describe('valideraFigur', () => {
    it('godtar en giltig figur och returnerar den', () => {
        const f = bas();
        expect(valideraFigur(f, 'chart-x')).toBe(f);
    });
    it.each([
        ['beskrivning saknas', { beskrivning: '  ' }],
        ['axeln x saknar giltig skala', { x: { titel: 'BAS' } }],
        ['axeln y saknar giltig skala', { y: { skala: 'kubisk' } }],
        ['lager saknas', { lager: [] }],
        ['okänt märke', { lager: [{ marke: 'tårta', data: [] }] }],
        ['data saknas', { lager: [{ marke: 'stapel' }] }],
        ['panelen', { paneler: ['Kvinna'], lager: [{ marke: 'stapel', panel: 'Man', data: [] }] }],
        ['fargskala', { lager: [{ marke: 'ruta', data: [{ x: 'A', y: 'B', varde: 1 }] }] }],
        ['fargskala', { lager: [{ marke: 'punkt', data: [{ x: 1, y: 2, fargvarde: 50 }] }] }],
        ['y2', { lager: [{ marke: 'linje', axel: 'y2', data: [{ x: 'A', y: 1 }] }] }],
        ['y2 måste', { y2: { skala: 'log' } }],
        ['tips', { lager: [{ marke: 'stapel', data: [], tips: 'text' }] }],
        ['större än noll', { y: { skala: 'log' }, lager: [{ marke: 'punkt', data: [{ x: 'A', y: 0 }] }] }],
    ])('kastar: %s', (text, over) => {
        expect(() => valideraFigur(bas(over), 'chart-x')).toThrow(text);
        expect(() => valideraFigur(bas(over), 'chart-x')).toThrow('chart-x');
    });
    it('alla märken i MARKEN godtas', () => {
        expect(MARKEN).toEqual(['stapel', 'intervall', 'punkt', 'linje', 'band', 'lada', 'ruta', 'yta']);
        for (const marke of MARKEN.filter(m => m !== 'yta')) {
            expect(() => valideraFigur(bas({ y: { skala: 'band' }, fargskala: { typ: 'sekventiell', doman: [0, 1] }, lager: [{ marke, data: [] }] }))).not.toThrow();
        }
        // Fria ytor ligger på två talaxlar.
        const yta = { beskrivning: 'Y', x: { skala: 'linjar' }, y: { skala: 'linjar' }, lager: [{ marke: 'yta', data: [{ x0: 0, x1: 1, y0: 0, y1: 1, namn: 'A', varde: 3 }] }] };
        expect(() => valideraFigur(yta)).not.toThrow();
        expect(() => valideraFigur({ ...yta, x: { skala: 'band' } })).toThrow(/yta kräver talaxlar/);
        expect(() => valideraFigur({ ...yta, lager: [{ marke: 'yta', data: [{ x0: 'a', x1: 1, y0: 0, y1: 1 }] }] })).toThrow(/x0/);
        expect(figurTillTabell(yta).slice(1)).toEqual([['Serie 1', 'A', 3]]);
    });
});

describe('utanSmaGrupper', () => {
    it('tar bort små datapunkter, tomma lager och därmed deras etiketter — utan att ändra originalet', () => {
        const f = bas({ lager: [
            { marke: 'stapel', serie: 'Kvinna', data: [{ x: 'A', y: 1 }, { x: 'B', y: 2, liten: true }] },
            { marke: 'stapel', serie: 'Man', data: [{ x: 'B', y: 3, liten: true }] },
        ] });
        const u = utanSmaGrupper(f);
        expect(u.lager).toHaveLength(1);
        expect(u.lager[0].data).toEqual([{ x: 'A', y: 1 }]);
        expect(skalDoman(u, 'x')).toEqual(['A']);
        expect(f.lager[0].data).toHaveLength(2);
        expect(antalPunkter(f)).toBe(3);
        expect(antalPunkter(u)).toBe(1);
    });
    it('per kön: bara det lilla könets punkt försvinner', () => {
        const f = bas({ lager: [
            { marke: 'stapel', serie: 'Kvinna', data: [{ x: 'A', y: 1 }] },
            { marke: 'stapel', serie: 'Man', data: [{ x: 'A', y: 2, liten: true }] },
        ] });
        expect(utanSmaGrupper(f).lager.map(l => l.serie)).toEqual(['Kvinna']);
    });
});

describe('utanSmaGrupper: kategoriordningen', () => {
    const f = () => bas({ lager: [
        { marke: 'linje', serie: 'L1', data: [{ x: 'A', y: 1 }, { x: 'B', y: 2, liten: true }, { x: 'C', y: 3 }, { x: 'D', y: 4, liten: true }, { x: 'E', y: 5 }] },
        { marke: 'linje', serie: 'L2', data: ['A', 'B', 'C', 'D', 'E'].map((x, i) => ({ x, y: i })) },
    ] });
    it('ordningen A–E består; B och D finns kvar eftersom lager 2 har dem', () => {
        expect(skalDoman(utanSmaGrupper(f()), 'x')).toEqual(['A', 'B', 'C', 'D', 'E']);
    });
    it('en kategori som bara finns som små punkter har ingen plats i domänen', () => {
        const g = bas({ lager: [{ marke: 'stapel', data: [{ x: 'A', y: 1 }, { x: 'Hemlig', y: 2, liten: true }, { x: 'B', y: 3 }] }] });
        expect(skalDoman(utanSmaGrupper(g), 'x')).toEqual(['A', 'B']);
    });
    it('en uttrycklig ordning vinner', () => {
        const g = f(); g.x.ordning = ['E', 'A'];
        expect(skalDoman(utanSmaGrupper(g), 'x')).toEqual(['E', 'A', 'B', 'C', 'D']);
    });
    it('originalfigurens axelobjekt rörs inte', () => {
        const g = f();
        const ut = utanSmaGrupper(g);
        expect(g.x.ordning).toBeUndefined();
        expect(ut.x).not.toBe(g.x);
        expect(ut.y).toBe(g.y);   // linjära axlar delas, ingen kopia behövs
    });
    it('figurTillTabell ger samma ordning för korstabellen när anroparen skickar utanSmaGrupper(figur)', () => {
        const g = bas({ x: { skala: 'band' }, y: { skala: 'band' }, fargskala: {}, lager: [
            { marke: 'ruta', serie: 'R', data: [{ x: 'A', y: 'P', varde: 1 }, { x: 'B', y: 'P', varde: 2, liten: true }, { x: 'C', y: 'P', varde: 3 }, { x: 'B', y: 'Q', varde: 4 }, { x: 'A', y: 'Q', varde: 5 }] },
        ] });
        expect(figurTillTabell(utanSmaGrupper(g))[0]).toEqual(['R', 'A', 'B', 'C']);
    });
});

describe('utanSmaGrupper: paneler (U2)', () => {
    const HEM = { x: 'A', y: 98765, liten: true, etikett: 'ETIK-HEMLIG', nyckel: 'NYCK-HEMLIG' };
    const trePaneler = () => bas({ paneler: ['HemligPanel', 'Kvinna', 'Man'], lager: [
        { marke: 'punkt', panel: 'Kvinna', serie: 'K', data: [{ x: 'A', y: 1 }] },
        { marke: 'punkt', panel: 'Man', serie: 'M', data: [{ x: 'A', y: 1 }] },
        { marke: 'punkt', panel: 'HemligPanel', serie: 'H', data: [HEM] },
    ] });
    it('en panel vars lager alla var små finns inte kvar — varken i paneler eller någon annanstans i figuren', () => {
        const f = trePaneler();
        const u = utanSmaGrupper(f);
        expect(u.paneler).toEqual(['Kvinna', 'Man']);
        for (const h of ['HemligPanel', 'HEMLIG', '98765']) expect(JSON.stringify(u)).not.toContain(h);
        expect(f.paneler).toEqual(['HemligPanel', 'Kvinna', 'Man']);   // originalet rörs inte
        expect(u.paneler).not.toBe(f.paneler);
    });
    it('figurTillTabell(utanSmaGrupper(f)) namnger inte den borttagna panelen', () => {
        const tabell = figurTillTabell(utanSmaGrupper(trePaneler()));
        expect(JSON.stringify(tabell)).not.toContain('HemligPanel');
        expect(tabell.map(r => r[0])).toEqual(['Serie', 'K · Kvinna', 'M · Man']);
    });
    it('ordningen består, och ett kvarvarande lager utan panel behåller alla paneler (det ritas i varje panel)', () => {
        const f = bas({ paneler: ['P3', 'P1', 'P2'], lager: [
            { marke: 'stapel', panel: 'P2', data: [{ x: 'A', y: 1 }] },
            { marke: 'stapel', panel: 'P1', data: [{ x: 'A', y: 1, liten: true }] },
            { marke: 'stapel', panel: 'P3', data: [{ x: 'A', y: 1 }] },
        ] });
        expect(utanSmaGrupper(f).paneler).toEqual(['P3', 'P2']);
        const g = { ...f, lager: [...f.lager, { marke: 'stapel', data: [{ x: 'A', y: 2 }] }] };
        expect(utanSmaGrupper(g).paneler).toEqual(['P3', 'P1', 'P2']);
        const h = { ...f, lager: [...f.lager, { marke: 'stapel', data: [{ x: 'A', y: 2, liten: true }] }] };   // lagret utan panel försvinner
        expect(utanSmaGrupper(h).paneler).toEqual(['P3', 'P2']);
    });
    it('är idempotent, tål att alla paneler försvinner och lägger inte till paneler i en figur utan', () => {
        const u = utanSmaGrupper(trePaneler());
        expect(utanSmaGrupper(u)).toEqual(u);
        const allt = bas({ paneler: ['P'], lager: [{ marke: 'stapel', panel: 'P', data: [{ x: 'A', y: 1, liten: true }] }] });
        expect(utanSmaGrupper(allt).paneler).toEqual([]);
        expect('paneler' in utanSmaGrupper(bas())).toBe(false);
    });
    it('panelerMedLager: panelerna som har något av lagren, i panelernas ordning', () => {
        expect(panelerMedLager(['A', 'B', 'C'], [{ panel: 'C' }, { panel: 'A' }])).toEqual(['A', 'C']);
        expect(panelerMedLager(['A', 'B'], [{ panel: 'B' }, {}])).toEqual(['A', 'B']);
        expect(panelerMedLager(['A', 'B'], [])).toEqual([]);
    });
});

describe('skalDoman', () => {
    it('band: ordning först, bara kategorier som finns i data, resten i dataordning', () => {
        const f = bas({ x: { skala: 'band', ordning: ['C', 'B', 'Z'] }, lager: [{ marke: 'stapel', data: [{ x: 'A', y: 1 }, { x: 'B', y: 2 }, { x: 'C', y: 3 }] }] });
        expect(skalDoman(f, 'x')).toEqual(['C', 'B', 'A']);
    });
    it('band: tal blir strängar', () => {
        const f = bas({ lager: [{ marke: 'stapel', data: [{ x: 1, y: 1 }, { x: 2, y: 2 }] }] });
        expect(skalDoman(f, 'x')).toEqual(['1', '2']);
    });
    it('linjär: staplar tar med noll; punkter gör det inte; doman vinner', () => {
        expect(skalDoman(bas(), 'y')).toEqual([0, 41200]);
        const p = bas({ lager: [{ marke: 'punkt', data: [{ x: 'A', y: 90 }, { x: 'B', y: 104 }] }] });
        expect(skalDoman(p, 'y')).toEqual([90, 104]);
        expect(skalDoman(bas({ y: { skala: 'linjar', doman: [85, 102] } }), 'y')).toEqual([85, 102]);
    });
    it('staplade staplar: summan per kategori; negativa värden under noll', () => {
        const f = bas({ lager: [
            { marke: 'stapel', lage: 'staplad', data: [{ x: 'A', y: 30 }, { x: 'B', y: 10 }] },
            { marke: 'stapel', lage: 'staplad', data: [{ x: 'A', y: 50 }, { x: 'B', y: 20 }] },
        ] });
        expect(skalDoman(f, 'y')).toEqual([0, 80]);
        expect(skalDoman(bas({ lager: [{ marke: 'stapel', data: [{ x: 'A', y: -5 }, { x: 'B', y: 3 }] }] }), 'y')).toEqual([-5, 3]);
    });
    it('band, intervall, felstaplar och liggande märken räknas på rätt axel', () => {
        const f = bas({ x: { skala: 'linjar' }, y: { skala: 'band' }, lager: [
            { marke: 'intervall', riktning: 'liggande', data: [{ y: 'A', lag: 20, hog: 60 }] },
            { marke: 'stapel', riktning: 'liggande', data: [{ y: 'A', x: 40, fel: { lag: 10, hog: 70 } }] },
        ] });
        expect(skalDoman(f, 'x')).toEqual([0, 70]);
        expect(skalDoman(f, 'y')).toEqual(['A']);
        const b = bas({ x: { skala: 'linjar' }, lager: [{ marke: 'band', data: [{ x: 25, lag: 100, hog: 300 }, { x: 65, lag: 150, hog: 250 }] }] });
        expect(skalDoman(b, 'x')).toEqual([25, 65]);
        expect(skalDoman(b, 'y')).toEqual([100, 300]);
    });
    it('y2 hämtar bara lager med axel y2', () => {
        const f = bas({ y2: { skala: 'linjar' }, lager: [
            { marke: 'stapel', data: [{ x: 'A', y: 500 }] },
            { marke: 'linje', axel: 'y2', data: [{ x: 'A', y: 40 }, { x: 'B', y: 100 }] },
        ] });
        expect(skalDoman(f, 'y')).toEqual([0, 500]);
        expect(skalDoman(f, 'y2')).toEqual([40, 100]);
    });
    it('tomt, null och NaN: en användbar domän utan NaN', () => {
        const f = bas({ lager: [{ marke: 'punkt', data: [{ x: 'A', y: null }, { x: 'B', y: NaN }] }] });
        expect(skalDoman(f, 'y')).toEqual([0, 1]);
        expect(skalDoman(bas({ lager: [{ marke: 'punkt', data: [{ x: 'A', y: 7 }] }] }), 'y')).toEqual([6, 8]);
        expect(skalDoman(bas({ y: { skala: 'log' }, lager: [{ marke: 'punkt', data: [] }] }), 'y')).toEqual([1, 10]);
    });
    it('klarar 200 000 punkter utan stackfel', () => {
        const data = Array.from({ length: 200000 }, (_, i) => ({ x: i, y: i % 977 }));
        const f = bas({ x: { skala: 'linjar' }, lager: [{ marke: 'punkt', data }] });
        expect(skalDoman(f, 'x')).toEqual([0, 199999]);
    });
});

describe('ladstatistik', () => {
    it('kvartiler som stat.js quantile; morrhår inom 1,5 kvartilavstånd; avvikare utanför', () => {
        const v = [10, 12, 13, 14, 15, 16, 17, 18, 40];
        const s = ladstatistik(v);
        expect(s.q1).toBe(quantile(v, 0.25));
        expect(s.median).toBe(quantile(v, 0.5));
        expect(s.q3).toBe(quantile(v, 0.75));
        expect(s.lag).toBe(10);
        expect(s.hog).toBe(18);
        expect(s.avvikare).toEqual([40]);
    });
    it('tom lista ger null; ett värde ger en platt låda; null och NaN hoppas över', () => {
        expect(ladstatistik([])).toBeNull();
        expect(ladstatistik([null, NaN])).toBeNull();
        expect(ladstatistik([5])).toEqual({ q1: 5, median: 5, q3: 5, lag: 5, hog: 5, avvikare: [] });
    });
});

describe('axelVarden', () => {
    it('ger råvärdena per axel', () => {
        expect(axelVarden(bas(), 'x')).toEqual(['A', 'B']);
        expect(axelVarden(bas(), 'y')).toEqual([30000, 41200]);
    });
});

describe('fix 1: staplade staplar, positiva och negativa for sig', () => {
    const st = (a, b, c) => bas({ lager: [
        { marke: 'stapel', lage: 'staplad', data: a },
        { marke: 'stapel', lage: 'staplad', data: b },
        ...(c ? [{ marke: 'stapel', lage: 'staplad', data: c }] : []),
    ] });
    it('negativa staplar staplas nedat', () => {
        expect(skalDoman(st([{ x: 'A', y: -3 }, { x: 'B', y: 2 }], [{ x: 'A', y: -4 }]), 'y')).toEqual([-7, 2]);
    });
    it('liggande variant', () => {
        const f = bas({ x: { skala: 'linjar' }, y: { skala: 'band' }, lager: [
            { marke: 'stapel', lage: 'staplad', riktning: 'liggande', data: [{ y: 'A', x: -3 }, { y: 'B', x: 2 }] },
            { marke: 'stapel', lage: 'staplad', riktning: 'liggande', data: [{ y: 'A', x: -4 }] },
        ] });
        expect(skalDoman(f, 'x')).toEqual([-7, 2]);
    });
    it('plus och minus i samma kategori', () => {
        expect(skalDoman(st([{ x: 'A', y: 5 }], [{ x: 'A', y: -3 }, { x: 'B', y: 1 }], [{ x: 'A', y: 4 }, { x: 'B', y: -6 }]), 'y')).toEqual([-6, 9]);
    });
    it('befintligt staplat test ger fortfarande 0-80', () => {
        expect(skalDoman(st([{ x: 'A', y: 30 }, { x: 'B', y: 10 }], [{ x: 'A', y: 50 }, { x: 'B', y: 20 }]), 'y')).toEqual([0, 80]);
    });
});

describe('fix 2: valideraFigur och icke-numerisk indata', () => {
    const med = (data, over = {}, lager = {}) => bas({ lager: [{ marke: 'punkt', data, ...lager }], ...over });
    const kastar = (f, text) => {
        expect(() => valideraFigur(f, 'chart-x')).toThrow(text);
        expect(() => valideraFigur(f, 'chart-x')).toThrow('chart-x');
    };
    it('null-post i data', () => kastar(med([{ x: 'A', y: 1 }, null]), 'datapunkt 1 är inte ett objekt'));
    it('sträng på linjär axel', () => kastar(med([{ x: 'A', y: '30000' }]), 'datapunkt 0'));
    it('NaN på linjär axel', () => kastar(med([{ x: 'A', y: NaN }]), 'y'));
    it('Infinity på linjär axel', () => kastar(med([{ x: 'A', y: Infinity }]), 'y'));
    it('null och undefined på linjär axel godtas', () => {
        expect(() => valideraFigur(med([{ x: 'A', y: null }, { x: 'B' }]), 'c')).not.toThrow();
    });
    it('sträng och tal på bandaxel godtas', () => {
        expect(() => valideraFigur(med([{ x: 'A', y: 1 }, { x: 7, y: 2 }]), 'c')).not.toThrow();
    });
    it('fel.lag som sträng', () => kastar(bas({ lager: [{ marke: 'stapel', data: [{ x: 'A', y: 1, fel: { lag: '0', hog: 2 } }] }] }), 'fel.lag'));
    it('intervall lag/hog som sträng på liggande', () => kastar(bas({ x: { skala: 'linjar' }, y: { skala: 'band' }, lager: [{ marke: 'intervall', riktning: 'liggande', data: [{ y: 'A', lag: 'a', hog: 2 }] }] }), 'lag'));
    it('y2-lager prövas mot y2-axeln', () => kastar(bas({ y2: { skala: 'linjar' }, lager: [{ marke: 'linje', axel: 'y2', data: [{ x: 'A', y: 'x' }] }] }), 'datapunkt 0'));
    it('varde, fargvarde och storlek måste vara tal', () => {
        const fs = { typ: 'sekventiell', doman: [0, 1] };
        kastar(bas({ fargskala: fs, lager: [{ marke: 'ruta', data: [{ x: 'A', y: 'B', varde: '1' }] }], y: { skala: 'band' } }), 'varde');
        kastar(bas({ fargskala: fs, lager: [{ marke: 'punkt', data: [{ x: 'A', y: 1, fargvarde: 'x' }] }] }), 'fargvarde');
        kastar(med([{ x: 'A', y: 1, storlek: NaN }]), 'storlek');
    });
    it.each([
        [[1]], ['0-10'], [[5, 5]], [[0, 'a']], [[NaN, 3]],
    ])('doman %p ogiltig', d => kastar(bas({ y: { skala: 'linjar', doman: d } }), 'doman'));
    it('log-doman med 0 ogiltig', () => kastar(bas({ y: { skala: 'log', doman: [0, 100] }, lager: [{ marke: 'punkt', data: [] }] }), 'doman'));
    it('giltig doman godtas', () => {
        expect(() => valideraFigur(bas({ y: { skala: 'linjar', doman: [85, 102] } }), 'c')).not.toThrow();
    });
    it('utanSmaGrupper och antalPunkter tål null-post', () => {
        const f = med([null, { x: 'A', y: 1, liten: true }, { x: 'B', y: 2 }]);
        expect(antalPunkter(f)).toBe(3);
        expect(utanSmaGrupper(f).lager[0].data).toEqual([{ x: 'B', y: 2 }])   // null-poster släpps (T3);
    });
    it('200 000 punkter valideras på under en sekund', () => {
        const data = Array.from({ length: 200000 }, (_, i) => ({ x: i, y: i % 977 + 1 }));
        const f = bas({ x: { skala: 'linjar' }, y: { skala: 'log' }, lager: [{ marke: 'punkt', data }] });
        const t = performance.now();
        valideraFigur(f, 'c');
        expect(performance.now() - t).toBeLessThan(1000);
    });
});

describe('fix 3: talformat utan negativ nolla', () => {
    it('inget minus när värdet avrundas till noll', () => {
        expect(blank(talformat(-0, 'kr'))).toBe('0 kr');
        expect(blank(talformat(-0.4, 'kr'))).toBe('0 kr');
        expect(blank(talformat(-0.04, 'pct'))).toBe('0,0 %');
        expect(blank(talformat(-0.004, 'tal2'))).toBe('0,00');
        expect(blank(talformat(-0.2, 'antal'))).toBe('0');
    });
    it('behåller minus när det finns kvar', () => {
        expect(blank(talformat(-0.06, 'pct'))).toBe('-0,1 %');
    });
    it('null som tredje argument', () => {
        expect(blank(talformat(5, 'kr', null))).toBe('5 kr');
    });
});

describe('figurTillTabell', () => {
    const f = over => ({ beskrivning: 'b', x: { skala: 'band', titel: 'BAS' }, y: { skala: 'linjar', titel: 'Kronor/månad' }, ...over });
    it('långt format: Serie, x-titel, y-titel', () => {
        expect(figurTillTabell(f({ lager: [
            { marke: 'stapel', serie: 'Kvinna', data: [{ x: 'A', y: 30000 }, { x: 'B', y: 31000 }] },
            { marke: 'linje', serie: 'Man', data: [{ x: 'A', y: 32000 }, { x: 'B', y: null }] },
        ] }))).toEqual([
            ['Serie', 'BAS', 'Kronor/månad'],
            ['Kvinna', 'A', 30000], ['Kvinna', 'B', 31000],
            ['Man', 'A', 32000], ['Man', 'B', ''],
        ]);
    });
    it('namnlös serie och axlar utan titel får reservnamn', () => {
        expect(figurTillTabell({ beskrivning: 'b', x: { skala: 'linjar' }, y: { skala: 'linjar' },
            lager: [{ marke: 'punkt', data: [{ x: 1, y: 2 }] }] })).toEqual([['Serie', 'x', 'y'], ['Serie 1', 1, 2]]);
    });
    it('band, intervall och felstaplar ger kolumnerna Undre och Övre', () => {
        expect(figurTillTabell(f({ x: { skala: 'linjar', titel: 'Ålder' }, lager: [
            { marke: 'band', serie: 'Kvinna 95 % KI', data: [{ x: 25, lag: 100, hog: 300 }] },
            { marke: 'linje', serie: 'Kvinna', data: [{ x: 25, y: 200 }] },
        ] }))).toEqual([
            ['Serie', 'Ålder', 'Kronor/månad', 'Undre', 'Övre'],
            ['Kvinna 95 % KI', 25, '', 100, 300],
            ['Kvinna', 25, 200, '', ''],
        ]);
        expect(figurTillTabell(f({ x: { skala: 'linjar', titel: 'Kronor' }, y: { skala: 'band', titel: 'Yrke' }, lager: [
            { marke: 'intervall', riktning: 'liggande', serie: 'P10–P90', data: [{ y: 'Lärare', lag: 30, hog: 50 }] },
            { marke: 'stapel', riktning: 'liggande', serie: 'Gap', data: [{ y: 'Lärare', x: 4, fel: { lag: 1, hog: 7 } }] },
        ] }))).toEqual([
            ['Serie', 'Kronor', 'Yrke', 'Undre', 'Övre'],
            ['P10–P90', '', 'Lärare', 30, 50],
            ['Gap', 4, 'Lärare', 1, 7],
        ]);
    });
    it('ruta blir en korstabell i domänernas ordning; block skiljs av en tom rad', () => {
        expect(figurTillTabell(f({
            x: { skala: 'band', ordning: ['30–39', '20–29'] }, y: { skala: 'band' },
            fargskala: { typ: 'sekventiell', doman: [0, 1], titel: 'Median' },
            lager: [
                { marke: 'ruta', serie: 'Median', data: [{ x: '20–29', y: 'A', varde: 1 }, { x: '30–39', y: 'A', varde: 2 }, { x: '30–39', y: 'B', varde: 3 }] },
                { marke: 'punkt', serie: 'Antal', data: [{ x: '20–29', y: 'A' }] },
            ],
        }))).toEqual([
            ['Median', '30–39', '20–29'],
            ['A', 2, 1],
            ['B', 3, ''],
            [],
            ['Serie', 'x', 'y'],
            ['Antal', '20–29', 'A'],
        ]);
    });
    it('paneler skrivs ut i seriens namn; NaN och oändligt blir tomt', () => {
        expect(figurTillTabell(f({ paneler: ['Kvinna', 'Man'], lager: [
            { marke: 'stapel', serie: 'Median', panel: 'Kvinna', data: [{ x: 'A', y: NaN }] },
            { marke: 'stapel', serie: 'Median', panel: 'Man', data: [{ x: 'A', y: Infinity }] },
        ] }))).toEqual([['Serie', 'BAS', 'Kronor/månad'], ['Median · Kvinna', 'A', ''], ['Median · Man', 'A', '']]);
    });
    it('null-post i data hoppas över', () => {
        expect(figurTillTabell(f({ lager: [{ marke: 'stapel', serie: 'S', data: [null, { x: 'A', y: 1 }] },
            { marke: 'ruta', serie: 'R', data: [null, { x: 'A', y: 'B', varde: 2 }] }] })))
            .toEqual([['R', 'A'], ['B', 2], [], ['Serie', 'BAS', 'Kronor/månad'], ['S', 'A', 1]]);
    });
    it('lager på höger axel bär axeln i serienamnet', () => {
        const g = (y2, lager) => f({ y2, lager });
        expect(figurTillTabell(g({ skala: 'linjar', titel: 'Kumulativ %' }, [
            { marke: 'linje', serie: 'Kumulativ', axel: 'y2', data: [{ x: 'A', y: 0.5 }] },
        ]))).toEqual([['Serie', 'BAS', 'Kronor/månad'], ['Kumulativ (höger axel: Kumulativ %)', 'A', 0.5]]);
        expect(figurTillTabell(g({ skala: 'linjar' }, [
            { marke: 'linje', serie: 'Kumulativ', axel: 'y2', data: [{ x: 'A', y: 0.5 }] },
        ]))[1][0]).toBe('Kumulativ (höger axel)');
        expect(figurTillTabell(g({ skala: 'linjar', titel: 'Andel' }, [
            { marke: 'stapel', serie: 'Vänster', data: [{ x: 'A', y: 1 }] },
            { marke: 'linje', axel: 'y2', data: [{ x: 'A', y: 0.5 }] },
        ])).map(r => r[0])).toEqual(['Serie', 'Vänster', 'Serie 2 (höger axel: Andel)']);
        expect(figurTillTabell(g({ skala: 'linjar', titel: 'Andel' }, [
            { marke: 'linje', serie: 'K', panel: 'Man', axel: 'y2', data: [{ x: 'A', y: 0.5 }] },
        ]))[1][0]).toBe('K (höger axel: Andel) · Man');
    });
    // V4 (dataminimering): en låda exporteras som statistik per kategori — aldrig en rad per individ.
    it('låda: två individer i en kategori ger EN rad med median, q1 och q3 — inga individer', () => {
        expect(figurTillTabell(f({ lager: [{ marke: 'lada', serie: 'Lön', data: [{ x: 'A', y: 30000 }, { x: 'A', y: 32000 }] }] })))
            .toEqual([['Serie', 'BAS', 'Kronor/månad', 'Undre', 'Övre'], ['Lön', 'A', 31000, 30500, 31500]]);
    });
    it('låda: flera kategorier i axelns ordning (x.ordning först), båda punktlägena, en individ ger en platt låda, en kategori utan värden ger ingen rad', () => {
        const ind = (x, ys) => ys.map(y => ({ x, y }));
        for (const punkter of ['avvikare', 'alla', undefined]) {
            const fig = f({ x: { skala: 'band', titel: 'BAS', ordning: ['C', 'A'] }, lager: [{ marke: 'lada', serie: 'Lön', ...(punkter ? { punkter } : {}),
                data: [...ind('A', [10, 20, 30, 40, 100]), ...ind('B', [7]), ...ind('Tom', [null, undefined, NaN]), ...ind('C', [1, 2, 3]), { x: 'A', y: 50 }] }] });
            const t = figurTillTabell(fig);
            expect(t[0]).toEqual(['Serie', 'BAS', 'Kronor/månad', 'Undre', 'Övre']);
            expect(t.slice(1).map(r => r[1]), String(punkter)).toEqual(['C', 'A', 'B']);
            const sA = ladstatistik([10, 20, 30, 40, 100, 50]);
            expect(t[2]).toEqual(['Lön', 'A', sA.median, sA.q1, sA.q3]);
            expect(t[3]).toEqual(['Lön', 'B', 7, 7, 7]);
            expect(t).toHaveLength(4);
            expect(JSON.stringify(t)).not.toContain('100');   // ingen enskild lön står i tabellen
        }
    });
    it('låda ihop med andra märken: övriga lager behåller sina rader, lådan sina statistikrader', () => {
        const t = figurTillTabell(f({ lager: [{ marke: 'stapel', serie: 'Medel', data: [{ x: 'A', y: 5 }] }, { marke: 'lada', serie: 'Lön', panel: 'Kvinna', data: [{ x: 'A', y: 1 }, { x: 'A', y: 3 }] }] }));
        expect(t).toEqual([['Serie', 'BAS', 'Kronor/månad', 'Undre', 'Övre'], ['Medel', 'A', 5, '', ''], ['Lön · Kvinna', 'A', 2, 1.5, 2.5]]);
    });
    it('låda: figurTillTabell(utanSmaGrupper(f)) är tabellen för figuren där de små individerna tagits bort', () => {
        const data = sma => [{ x: 'A', y: 10 }, ...(sma ? [{ x: 'A', y: 99999, liten: true }, { x: 'Hemlig', y: 77777, liten: true }] : []), { x: 'A', y: 20 }, { x: 'B', y: 5 }, ...(sma ? [{ x: 'B', y: 88888, liten: true }] : []), { x: 'B', y: 9 }];
        const fig = sma => f({ lager: [{ marke: 'lada', serie: 'Lön', data: data(sma) }] });
        const t = figurTillTabell(utanSmaGrupper(fig(true)));
        expect(t).toEqual(figurTillTabell(fig(false)));
        expect(t).toEqual([['Serie', 'BAS', 'Kronor/månad', 'Undre', 'Övre'], ['Lön', 'A', 15, 12.5, 17.5], ['Lön', 'B', 7, 6, 8]]);
        expect(JSON.stringify(t)).not.toMatch(/Hemlig|99999|77777|88888/);
    });
    it('stående intervall: kategori i x, gränser i Undre/Övre', () => {
        expect(figurTillTabell(f({ lager: [{ marke: 'intervall', serie: 'I', data: [{ x: 'A', lag: 1, hog: 2 }] }] })))
            .toEqual([['Serie', 'BAS', 'Kronor/månad', 'Undre', 'Övre'], ['I', 'A', '', 1, 2]]);
    });
    it('stående stapel med fel ger värdet och felgränserna', () => {
        expect(figurTillTabell(f({ lager: [{ marke: 'stapel', serie: 'S', data: [{ x: 'A', y: 1, fel: { lag: 0, hog: 2 } }] }] })))
            .toEqual([['Serie', 'BAS', 'Kronor/månad', 'Undre', 'Övre'], ['S', 'A', 1, 0, 2]]);
    });
    it('ruta: tom cell blir tom och två punkter i samma cell behåller den sista', () => {
        expect(figurTillTabell(f({ y: { skala: 'band' }, lager: [{ marke: 'ruta', serie: 'M', data: [
            { x: 'a', y: 'P', varde: null }, { x: 'b', y: 'P', varde: 1 }, { x: 'b', y: 'P', varde: 2 },
        ] }] }))).toEqual([['M', 'a', 'b'], ['P', '', 2]]);
    });
    it('kategorier som börjar med =, +, - eller @ passerar oförändrade', () => {
        // Att neutralisera formelinledare är CSV-skrivarens jobb (_neutraliseraCell i src/app/22-exporthjalpare.js).
        const kat = ['=1+1', '+1', '-1', '@sum'];
        expect(figurTillTabell(f({ lager: [{ marke: 'stapel', serie: 'S', data: kat.map(x => ({ x, y: 1 })) }] })).slice(1).map(r => r[1]))
            .toEqual(kat);
    });
    it('tom figur ger en tom tabell', () => {
        expect(figurTillTabell(f({ lager: [{ marke: 'stapel', data: [] }] }))).toEqual([]);
    });
});

describe('kronorSkillnad och kronorTipsRad', () => {
    it('kvinnors median minus mäns, avrundad till hundratal; negativ när kvinnorna ligger lägre', () => {
        expect(kronorSkillnad(38870, 42070)).toBe(-3200);
        expect(kronorSkillnad(42049, 42000)).toBe(0);
        expect(kronorSkillnad(42000, 40000)).toBe(2000);
        expect(Object.is(kronorSkillnad(41990, 42000), -0)).toBe(false);
    });
    it('null när en median saknas eller inte är ett positivt tal', () => {
        for (const [a, b] of [[null, 30000], [30000, undefined], [NaN, 30000], [30000, 0], [0, 30000]]) expect(kronorSkillnad(a, b)).toBeNull();
    });
    it('tipsraden har tecken och enheten kr/mån, och saknas utan belopp', () => {
        expect(kronorTipsRad(-3200)).toEqual([['Skillnad', '−3\u00a0200 kr/mån']]);
        expect(kronorTipsRad(1500)).toEqual([['Skillnad', '+1\u00a0500 kr/mån']]);
        expect(kronorTipsRad(0)).toEqual([['Skillnad', '0 kr/mån']]);
        expect(kronorTipsRad(null)).toEqual([]);
    });
    it('valideringen kräver att skillnadKr är ett tal, och diagramdatan får kolumnen bara när någon punkt bär den', () => {
        const fig = data => ({ beskrivning: 'B', x: { skala: 'linjar' }, y: { skala: 'band' }, lager: [{ marke: 'punkt', riktning: 'liggande', serie: 'S', data }] });
        expect(() => valideraFigur(fig([{ x: 90, y: 'A', skillnadKr: 'x' }]), 't')).toThrow(/skillnadKr/);
        expect(figurTillTabell(fig([{ x: 90, y: 'A', skillnadKr: -1200 }, { x: 95, y: 'B' }]))).toEqual([['Serie', 'x', 'y', 'Skillnad (kr/mån)'], ['S', 90, 'A', -1200], ['S', 95, 'B', '']]);
        expect(figurTillTabell(fig([{ x: 90, y: 'A' }]))[0]).toEqual(['Serie', 'x', 'y']);
    });
});

describe('kvantilpunkter', () => {
    it('antal kvantiler i andelarnas mitt, med stat.quantiles interpolation', () => {
        const v = Array.from({ length: 41 }, (_, i) => i * 10);           // 0..400
        const kp = kvantilpunkter(v, 20);
        expect(kp.antal).toBe(20);
        expect(kp.varden[0]).toBeCloseTo(400 * 0.025, 9);
        expect(kp.varden[19]).toBeCloseTo(400 * 0.975, 9);
        expect(kvantilpunkter(v, 50).antal).toBe(20);                     // högst halva gruppen
    });
    it('högst halva gruppen, och null under två värden', () => {
        expect(kvantilpunkter([1, 2, 3, 4, 5], 20).antal).toBe(2);
        expect(kvantilpunkter([7], 20)).toBeNull();
        expect(kvantilpunkter([], 20)).toBeNull();
        expect(kvantilpunkter([3, NaN, 1, 'x', 2, 4], 20).varden).toEqual([1.75, 3.25]);
    });
    it('valideringen: form och antal', () => {
        const fig = l => ({ beskrivning: 'B', x: { skala: 'band' }, y: { skala: 'linjar' }, lager: [{ marke: 'lada', serie: 'S', data: [{ x: 'A', y: 1 }], ...l }] });
        expect(() => valideraFigur(fig({ form: 'kvantiler', antal: 20 }), 't')).not.toThrow();
        expect(() => valideraFigur(fig({ form: 'kvantiler' }), 't')).not.toThrow();
        expect(() => valideraFigur(fig({ form: 'kvantiler', antal: 30 }), 't')).toThrow(/antal/);
        expect(() => valideraFigur(fig({ form: 'fiol', antal: 20 }), 't')).toThrow(/antal/);
        expect(() => valideraFigur(fig({ form: 'kvantil' }), 't')).toThrow(/form/);
    });
});


describe('urval', () => {
    const URVAL = { falt: 'bas', namn: 'BAS-intervall', etikett: 'BAS {v}' };
    const stapelfigur = (over = {}) => ({
        beskrivning: 'Medianlön per BAS-intervall',
        x: { skala: 'band', ordning: ['BAS C', 'BAS A', 'BAS B'] }, y: { skala: 'linjar' },
        urval: URVAL,
        lager: [
            { marke: 'stapel', serie: 'Kvinna', data: [{ x: 'BAS A', y: 1, bas: 'A' }, { x: 'BAS B', y: 2, bas: 'B' }, { x: 'BAS C', y: 3, bas: 'C' }, { bas: 'D', liten: true }] },
            { marke: 'punkt', serie: 'Referens', data: [{ x: 'BAS A', y: 5 }] },
        ],
        ...over,
    });
    it('valideraFigur godtar ett urval med falt, namn och etikett', () => {
        expect(() => valideraFigur(stapelfigur(), 't')).not.toThrow();
        expect(() => valideraFigur(stapelfigur({ urval: { falt: 'bas', namn: 'BAS-intervall' } }), 't')).not.toThrow();
    });
    it('valideraFigur avvisar ett urval utan falt, med falt som inte är en sträng eller med etikett som inte är en sträng', () => {
        expect(() => valideraFigur(stapelfigur({ urval: { namn: 'x' } }), 't')).toThrow(/Ogiltig figur \(t\): urval/);
        expect(() => valideraFigur(stapelfigur({ urval: { falt: 3, namn: 'x' } }), 't')).toThrow(/urval/);
        expect(() => valideraFigur(stapelfigur({ urval: { falt: 'bas', namn: 'x', etikett: 5 } }), 't')).toThrow(/urval/);
        expect(() => valideraFigur(stapelfigur({ urval: { falt: 'bas' } }), 't')).toThrow(/urval/);
        expect(() => valideraFigur(stapelfigur({ urval: 'bas' }), 't')).toThrow(/urval/);
    });
    it('urvalVarden följer bandaxelns ordning och tar inte med små grupper eller punkter utan fältet', () => {
        expect(urvalVarden(stapelfigur())).toEqual(['C', 'A', 'B']);
        expect(urvalVarden(stapelfigur(), null, { visaSma: true })).toEqual(['C', 'A', 'B', 'D']);
        expect(urvalVarden(stapelfigur(), 'bas', { visaSma: true })).toEqual(['C', 'A', 'B', 'D']);
    });
    it('urvalVarden: värden som inte är kategorier på bandaxeln kommer efter de ordnade, i svensk sorteringsordning', () => {
        const f = stapelfigur();
        f.lager[1].data.push({ x: 'BAS A', y: 6, bas: 'Ö' }, { x: 'BAS A', y: 7, bas: 'Ä' }, { x: 'BAS A', y: 8, bas: 'Z' });
        expect(urvalVarden(f)).toEqual(['C', 'A', 'B', 'Z', 'Ä', 'Ö']);
    });
    it('urvalVarden utan bandaxel: sorterat med svensk ordning; tåler null-poster', () => {
        const f = {
            beskrivning: 'Lön mot ålder', x: { skala: 'linjar' }, y: { skala: 'linjar' }, urval: { falt: 'bas', namn: 'BAS-intervall' },
            lager: [{ marke: 'punkt', data: ['N', 'A', 'Ö', 'B', 'A'].map((bas, i) => ({ x: i, y: i, bas })).concat([null]) }],
        };
        expect(urvalVarden(f)).toEqual(['A', 'B', 'N', 'Ö']);
    });
    it('urvalVarden utan urval ger en tom lista', () => {
        expect(urvalVarden(stapelfigur({ urval: undefined }))).toEqual([]);
    });
    it('urvalVarden jämför värdena som strängar', () => {
        const f = { beskrivning: 'b', x: { skala: 'linjar' }, y: { skala: 'linjar' }, urval: { falt: 'n', namn: 'N' },
            lager: [{ marke: 'punkt', data: [{ x: 1, y: 1, n: 2 }, { x: 2, y: 2, n: '2' }, { x: 3, y: 3, n: 10 }] }] };
        expect(urvalVarden(f)).toEqual(['10', '2']);
    });
    it('urvalEtikett sätter in värdet i mallen, eller visar värdet utan mall', () => {
        expect(urvalEtikett(stapelfigur(), null, 'A')).toBe('BAS A');
        expect(urvalEtikett(stapelfigur(), 'bas', 'A')).toBe('BAS A');
        expect(urvalEtikett(stapelfigur({ urval: { falt: 'bas', namn: 'BAS-intervall' } }), null, 'A')).toBe('A');
    });
    it('arBortvald: bara en punkt med fältet och ett bortvalt värde', () => {
        const f = stapelfigur();
        expect(arBortvald(f, new Set(['A']), { bas: 'A' })).toBe(true);
        expect(arBortvald(f, new Set(['A']), { bas: 'B' })).toBe(false);
        expect(arBortvald(f, new Set(['A']), { y: 3 })).toBe(false);
        expect(arBortvald(stapelfigur({ urval: undefined }), new Set(['A']), { bas: 'A' })).toBe(false);
        expect(arBortvald(f, undefined, { bas: 'A' })).toBe(false);
        expect(arBortvald(f, new Set(['A']), null)).toBe(false);
    });
    // Diagramfilter v2: flera dimensioner, kategori och intervall.
    const ANTAL = { typ: 'intervall', falt: 'n', namn: 'Antal personer i gruppen', format: 'antal', etikett: '{v} personer i gruppen' };
    const tvaDim = (over = {}) => ({
        beskrivning: 'Grupper', x: { skala: 'linjar' }, y: { skala: 'linjar' },
        urval: [{ typ: 'kategori', ...URVAL }, ANTAL],
        lager: [
            { marke: 'punkt', serie: 'Grupper', data: [
                { x: 1, y: 1, bas: 'A', n: 5 }, { x: 2, y: 2, bas: 'A', n: 10 }, { x: 3, y: 3, bas: 'B', n: 50 },
                { x: 4, y: 4, bas: 'B', n: 51 }, { x: 5, y: 5, bas: 'C', n: 200, liten: true }, { x: 6, y: 6 }] },
        ],
        ...over,
    });
    const filter = (kat = {}, int = {}) => ({ kategori: new Map(Object.entries(kat).map(([k, v]) => [k, new Set(v)])), intervall: new Map(Object.entries(int)) });
    it('urvalLista: ett ensamt objekt blir en lista med en kategori; en lista behåller ordningen; utan urval en tom lista', () => {
        expect(urvalLista(stapelfigur())).toEqual([{ typ: 'kategori', ...URVAL }]);
        expect(urvalLista(tvaDim()).map(u => [u.typ, u.falt])).toEqual([['kategori', 'bas'], ['intervall', 'n']]);
        expect(urvalLista(stapelfigur({ urval: undefined }))).toEqual([]);
        expect(urvalLista(null)).toEqual([]);
    });
    it('valideraFigur godtar en lista med kategori och intervall och avvisar fel typ, okänt format och samma fält två gånger', () => {
        expect(() => valideraFigur(tvaDim(), 't')).not.toThrow();
        expect(() => valideraFigur(tvaDim({ urval: [] }), 't')).not.toThrow();
        expect(() => valideraFigur(tvaDim({ urval: [{ ...ANTAL, format: undefined }] }), 't')).not.toThrow();
        expect(() => valideraFigur(tvaDim({ urval: [{ ...ANTAL, typ: 'spann' }] }), 't')).toThrow(/urval 0: typ/);
        expect(() => valideraFigur(tvaDim({ urval: [{ ...ANTAL, format: 'procent' }] }), 't')).toThrow(/urval 0: format/);
        expect(() => valideraFigur(tvaDim({ urval: [{ ...URVAL, format: 'antal' }] }), 't')).toThrow(/format gäller bara intervall/);
        expect(() => valideraFigur(tvaDim({ urval: [URVAL, { ...ANTAL, falt: 'bas' }] }), 't')).toThrow(/urval 1: fältet "bas" förekommer två gånger/);
        expect(() => valideraFigur(tvaDim({ urval: [URVAL, { typ: 'intervall', falt: 'n' }] }), 't')).toThrow(/urval 1: falt och namn/);
        expect(() => valideraFigur(tvaDim({ urval: [URVAL, null] }), 't')).toThrow(/urval 1/);
        for (const f of TALFORMAT) expect(() => valideraFigur(tvaDim({ urval: [{ ...ANTAL, format: f }] }), 't')).not.toThrow();
    });
    it('urvalSpann: minsta och största talet utan små grupper (om inte visaSma); null under två olika tal eller utan dimensionen', () => {
        expect(urvalSpann(tvaDim(), 'n')).toEqual({ min: 5, max: 51 });
        expect(urvalSpann(tvaDim(), ANTAL)).toEqual({ min: 5, max: 51 });
        expect(urvalSpann(tvaDim(), null, { visaSma: true })).toEqual({ min: 5, max: 200 });
        const lika = tvaDim();
        lika.lager[0].data.forEach(d => { if ('n' in d) d.n = 7; });
        expect(urvalSpann(lika, 'n')).toBeNull();
        expect(urvalSpann(tvaDim(), 'bas')).toBeNull();                  // en kategori är inget intervall
        expect(urvalSpann(stapelfigur(), null)).toBeNull();
        expect(urvalVarden(tvaDim(), 'n')).toEqual([]);                  // och ett intervall har inga knappar
    });
    it('arBortvald med intervall: utanför döljs, gränserna ingår, en gräns som saknas gäller inte, en punkt utan fältet påverkas aldrig', () => {
        const f = tvaDim();
        const p = n => ({ x: 1, y: 1, bas: 'A', n });
        const fi = filter({}, { n: { min: 10, max: 50 } });
        expect([5, 9.99, 10, 30, 50, 50.01, 51].map(n => arBortvald(f, fi, p(n)))).toEqual([true, true, false, false, false, true, true]);
        expect(arBortvald(f, filter({}, { n: { min: 10, max: null } }), p(1000))).toBe(false);
        expect(arBortvald(f, filter({}, { n: { min: null, max: 50 } }), p(1))).toBe(false);
        expect(arBortvald(f, filter({}, { n: { min: 10 } }), p(9))).toBe(true);
        expect(arBortvald(f, fi, { x: 6, y: 6 })).toBe(false);           // utan fältet
        expect(arBortvald(f, fi, { x: 6, y: 6, n: 'många' })).toBe(false);   // inte ett tal
        // Ett filter på ett fält som inte är en dimension i figuren gäller inte.
        expect(arBortvald(f, filter({}, { y: { min: 100 } }), p(30))).toBe(false);
        expect(arBortvald(f, filter({ x: ['1'] }), p(30))).toBe(false);
    });
    it('arBortvald med två dimensioner: en punkt döljs om någon av dem döljer den', () => {
        const f = tvaDim();
        const fi = filter({ bas: ['B'] }, { n: { min: 10 } });
        const synliga = f.lager[0].data.filter(d => !d.liten && !arBortvald(f, fi, d));
        expect(synliga).toEqual([{ x: 2, y: 2, bas: 'A', n: 10 }, { x: 6, y: 6 }]);
    });
    it('arBortvald: en mängd (det äldre formatet) gäller den första kategoridimensionen', () => {
        const f = tvaDim({ urval: [ANTAL, { typ: 'kategori', ...URVAL }, { typ: 'kategori', falt: 'kon', namn: 'Kön' }] });
        expect(arBortvald(f, new Set(['A']), { bas: 'A', n: 1 })).toBe(true);
        expect(arBortvald(f, new Set(['A']), { kon: 'A', n: 1 })).toBe(false);
        expect(arBortvald(f, ['A'], { bas: 'A' })).toBe(false);          // en lista är ingen mängd och inget filter
    });
    it('urvalIntervallText och urvalBeskrivning: samma text i noten och exportens fotrad', () => {
        expect(urvalIntervallText(ANTAL, { min: 10, max: 50 })).toBe('10–50');
        expect(urvalIntervallText(ANTAL, { min: 10, max: null })).toBe('minst 10');
        expect(urvalIntervallText(ANTAL, { max: 50 })).toBe('högst 50');
        expect(urvalIntervallText(ANTAL, { min: 1.5 })).toBe('minst 1,5');
        expect(urvalIntervallText({ format: 'pct' }, { min: -5, max: 2.5 })).toBe('−5,0–2,5 %');
        expect(urvalIntervallText(ANTAL, {})).toBe('');
        expect(urvalIntervallText(ANTAL, null)).toBe('');
        const f = tvaDim();
        expect(urvalBeskrivning(f, filter({ bas: ['B', 'A'] }, { n: { min: 10, max: 50 } }))).toEqual(['utan BAS A, BAS B', '10–50 personer i gruppen']);
        expect(urvalBeskrivning(f, filter({ bas: [] }, {}))).toEqual([]);
        expect(urvalBeskrivning(f, null)).toEqual([]);
        // Utan mall: namnet och intervallet.
        expect(urvalBeskrivning(tvaDim({ urval: [{ ...ANTAL, etikett: undefined }] }), filter({}, { n: { max: 50 } }))).toEqual(['Antal personer i gruppen högst 50']);
        // Det äldre formatet (en mängd) beskrivs som den första kategorin.
        expect(urvalBeskrivning(stapelfigur(), new Set(['A', 'C']))).toEqual(['utan BAS C, BAS A']);
    });

    // ---- Diagramfilter v3: listor och härledda lager ----
    const YRKE = { typ: 'kategori', falt: 'yrke', namn: 'Yrkesgrupp', etikett: '{v}', visning: 'lista' };
    const yrken = n => Array.from({ length: n }, (_, i) => `Yrke ${String(i + 1).padStart(2, '0')}`);
    const yrkesFigur = (n, urval = [YRKE]) => ({ beskrivning: 'Yrken', x: { skala: 'linjar' }, y: { skala: 'linjar' }, urval,
        lager: [{ marke: 'punkt', serie: 'Grupper', data: yrken(n).map((yrke, i) => ({ x: i, y: i, yrke })).concat([{ x: 99, y: 99, yrke: 'Liten', liten: true }]) }] });
    it('urvalSomLista: visning lista, eller fler än URVAL_LISTA_MAX värden', () => {
        expect(URVAL_LISTA_MAX).toBe(12);
        expect(urvalSomLista(YRKE, 2)).toBe(true);
        expect(urvalSomLista(URVAL, 12)).toBe(false);
        expect(urvalSomLista(URVAL, 13)).toBe(true);
        expect(urvalSomLista(null, 40)).toBe(false);
    });
    it('valideraFigur: visning gäller bara kategori och måste vara lista', () => {
        expect(() => valideraFigur(yrkesFigur(3), 't')).not.toThrow();
        expect(() => valideraFigur(yrkesFigur(3, [{ ...YRKE, visning: 'knappar' }]), 't')).toThrow(/urval 0: visning gäller bara kategori/);
        expect(() => valideraFigur(tvaDim({ urval: [{ ...ANTAL, visning: 'lista' }] }), 't')).toThrow(/urval 0: visning gäller bara kategori/);
    });
    it('urvalBeskrivning för en lista: utan (högst tre bortvalda), bara (högst tre valda), annars namnet och antalet', () => {
        const f = yrkesFigur(40);
        const bort = n => filter({ yrke: yrken(40).slice(0, n) });
        expect(urvalBeskrivning(f, bort(3))).toEqual(['utan Yrke 01, Yrke 02, Yrke 03']);
        expect(urvalBeskrivning(f, bort(28))).toEqual(['Yrkesgrupp 12 av 40']);
        expect(urvalBeskrivning(f, bort(37))).toEqual(['bara Yrke 38, Yrke 39, Yrke 40']);
        expect(urvalBeskrivning(f, bort(40))).toEqual(['Yrkesgrupp 0 av 40']);
        // Den lilla gruppens värde räknas bara med visaSma.
        expect(urvalBeskrivning(f, bort(28), { visaSma: true })).toEqual(['Yrkesgrupp 13 av 41']);
        // En kategori som inte är en lista säger alltid utan.
        const knappar = yrkesFigur(5, [{ ...YRKE, visning: undefined }]);
        expect(urvalBeskrivning(knappar, filter({ yrke: yrken(5).slice(0, 4) }))).toEqual(['utan Yrke 01, Yrke 02, Yrke 03, Yrke 04']);
    });
    it('urvalAktivt: ett bortvalt värde eller en gräns', () => {
        expect(urvalAktivt(null)).toBe(false);
        expect(urvalAktivt(filter({ bas: [] }, {}))).toBe(false);
        expect(urvalAktivt(filter({ bas: ['A'] }))).toBe(true);
        expect(urvalAktivt(filter({}, { n: { min: null, max: null } }))).toBe(false);
        expect(urvalAktivt(filter({}, { n: { min: 3 } }))).toBe(true);
        expect(urvalAktivt(new Set())).toBe(false);
        expect(urvalAktivt(new Set(['A']))).toBe(true);
    });

    // Två punktlager (Kvinna, Man) och en trend per kön som räknas ur punkterna: medelvärdet av y på två x.
    const medel = p => p.reduce((s, d) => s + d.y, 0) / p.length;
    const trend = (serie, minN, namn) => ({ marke: 'linje', serie: `${serie} (trend)`, data: [{ x: 0, y: 1 }, { x: 10, y: 1 }],
        harleddAv: { lager: [serie], berakna: p => [{ x: 0, y: medel(p) }, { x: 10, y: medel(p) }], ...(minN !== undefined ? { minN } : {}), ...(namn ? { namn } : {}) } });
    const trendFigur = () => ({ beskrivning: 'Lön mot ålder', x: { skala: 'linjar' }, y: { skala: 'linjar' }, urval: [URVAL],
        lager: [
            { marke: 'punkt', serie: 'Kvinna', data: [{ x: 1, y: 10, bas: 'A' }, { x: 2, y: 20, bas: 'B' }, { x: 3, y: 30, bas: 'B' }, { x: 4, y: 1000, bas: 'A', liten: true }] },
            { marke: 'punkt', serie: 'Man', data: [{ x: 1, y: 40, bas: 'A' }, { x: 2, y: 60, bas: 'B' }] },
            trend('Kvinna', 2, 'trendlinjen för kvinnor'), trend('Man', 2),
        ] });
    it('harleddaLager utan aktivt filter: samma figur, inget räknas om', () => {
        const f = trendFigur();
        for (const fi of [null, undefined, filter({ bas: [] }), new Set()]) {
            const h = harleddaLager(f, fi);
            expect(h.figur).toBe(f);
            expect(h.omraknade).toEqual([]);
            expect(h.utelamnade).toEqual([]);
        }
        const utan = { ...f, lager: f.lager.slice(0, 2) };
        expect(harleddaLager(utan, filter({ bas: ['A'] })).figur).toBe(utan);
    });
    it('harleddaLager räknar om ur källagrens synliga punkter (inte bortvalda, inte små utan visaSma) och rör inget annat', () => {
        const f = trendFigur();
        const sedda = [];
        f.lager[2].harleddAv.berakna = p => { sedda.push(p.map(d => d.y)); return [{ x: 0, y: medel(p) }]; };
        const h = harleddaLager(f, filter({ bas: ['A'] }));
        expect(sedda).toEqual([[20, 30]]);
        expect(h.figur).not.toBe(f);
        expect(h.figur.lager[2].data).toEqual([{ x: 0, y: 25 }]);
        expect(h.figur.lager[2].harleddAv).toBe(f.lager[2].harleddAv);
        expect(h.figur.lager[2].serie).toBe('Kvinna (trend)');
        expect(h.figur.lager[0]).toBe(f.lager[0]);                       // källagren är desamma
        expect(h.figur.lager[1]).toBe(f.lager[1]);
        // Männen har bara en synlig punkt kvar (B 60): under minN = 2.
        expect(h.figur.lager[3].data).toEqual([]);
        expect(h.omraknade).toEqual([{ index: 2, namn: 'trendlinjen för kvinnor' }]);
        expect(h.utelamnade).toEqual([{ index: 3, namn: 'Serien Man (trend)', minN: 2, antal: 1 }]);
        // Originalet är oförändrat.
        expect(f.lager[2].data).toEqual([{ x: 0, y: 1 }, { x: 10, y: 1 }]);
        // Med visaSma räknas den lilla punkten.
        sedda.length = 0;
        harleddaLager(f, filter({ bas: ['B'] }), { visaSma: true });
        expect(sedda).toEqual([[10, 1000]]);
        // Ett aktivt filter som inte döljer något räknar ändå om, ur de synliga punkterna (den lilla räknas inte).
        sedda.length = 0;
        harleddaLager(f, filter({}, { x: { min: 0 } }));
        expect(sedda).toEqual([[10, 20, 30]]);
    });
    it('harleddaLager: gränsen minN (lika många räcker), minst en punkt, och noterna', () => {
        const f = trendFigur();
        f.lager[3].harleddAv.minN = 1;
        const h = harleddaLager(f, filter({ bas: ['A'] }));
        expect(h.figur.lager[3].data).toEqual([{ x: 0, y: 60 }, { x: 10, y: 60 }]);
        f.lager[3].harleddAv.minN = 0;                                    // minst en punkt ändå
        const ingen = trendFigur();
        ingen.lager[1].data.forEach(d => { d.bas = 'A'; });
        ingen.lager[3].harleddAv.minN = 0;
        const h0 = harleddaLager(ingen, filter({ bas: ['A'] }));
        expect(h0.utelamnade).toEqual([{ index: 3, namn: 'Serien Man (trend)', minN: 1, antal: 0 }]);
        expect(harlettNot(harleddaLager(trendFigur(), filter({ bas: ['A'] })))).toEqual({
            omraknade: ['Trendlinjen för kvinnor gäller urvalet.'],
            utelamnade: ['Serien Man (trend) visas inte: färre än 2 synliga punkter.'],
        });
        expect(harlettNot(null)).toEqual({ omraknade: [], utelamnade: [] });
        expect(harlettNamn({ serie: 'S' })).toBe('Serien S');
        expect(harlettNamn({})).toBe('Lagret');
    });
    it('harleddaLager: berakna som inte ger en lista, eller ger ogiltig data, kastar', () => {
        const f = trendFigur();
        f.lager[2].harleddAv.berakna = () => null;
        expect(() => harleddaLager(f, filter({ bas: ['A'] }))).toThrow(/berakna måste ge en lista/);
        f.lager[2].harleddAv.berakna = () => [{ x: 'a', y: 1 }];
        expect(() => harleddaLager(f, filter({ bas: ['A'] }))).toThrow(/Ogiltig figur \(härlett lager\)/);
    });
    it('valideraFigur: harleddAv kräver källager som finns (och inte själva är härledda), en funktion och ett heltal minN', () => {
        expect(() => valideraFigur(trendFigur(), 't')).not.toThrow();
        const med = ändra => { const f = trendFigur(); ändra(f.lager[2].harleddAv, f); return () => valideraFigur(f, 't'); };
        expect(med(h => { h.lager = ['Okänd']; })).toThrow(/källagret "Okänd" finns inte/);
        expect(med(h => { h.lager = ['Man (trend)']; })).toThrow(/källagret "Man \(trend\)" finns inte/);
        expect(med(h => { h.lager = []; })).toThrow(/harleddAv.lager/);
        expect(med(h => { h.berakna = 'x'; })).toThrow(/harleddAv.berakna/);
        expect(med(h => { h.minN = 1.5; })).toThrow(/harleddAv.minN/);
        expect(med(h => { h.namn = 3; })).toThrow(/harleddAv.namn/);
        expect(med((h, f) => { f.lager[2].harleddAv = 'ja'; })).toThrow(/harleddAv måste vara/);
    });

});

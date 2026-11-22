// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
// Förhandskontrollen av lönefilen (src/lib/forhandskontroll.js): hur filen tolkades, rad för rad och i sammandrag,
// med varningar. Indata är konstruerade: de tio första raderna med råvärde och tolkning, de använda raderna och
// inläsningens räknare.
import { describe, it, expect } from 'vitest';
import {
    byggForhandskontroll, forhandskontrollGranser, FK_ANTAL_RADER, FK_ARSLON_MEDIAN, FK_TIMLON_MEDIAN,
    FK_SPRIDNING_GANGER, FK_ALDER_MIN, FK_ALDER_MAX, FK_SMA_GRUPP, FK_NAMN_RADNR, FK_LON_MIN, FK_LON_MAX, FK_BAS, namnIYrkesfaltetText, namnIYrkesfaltetRadnr,
} from '../src/lib/forhandskontroll.js';

const MAPPNING = { bas: 'BAS', yrke: 'AID', lon: 'Månadslön', alder: 'Ålder', kon: 'Kön' };
const HEADERS = ['BAS', 'AID', 'Månadslön', 'Ålder', 'Kön'];
const stats = (over = {}) => ({
    totalRaw: 30, excludedNoBas: 0, excludedZeroLon: 0, excludedMissingKon: 0, invalidLon: 0, invalidAlder: 0,
    invalidAlderUtesluten: 0, alderFromBirthYear: 0, invalidLonExamples: [], invalidAlderExamples: [], missingKonExamples: [], ...over,
});
// En ren rad: råvärdet är det verktyget tolkar.
const ren = i => ({
    radnr: i + 2, anvands: true,
    ra: { bas: 'C', yrke: '207011 Handläggare', lon: String(30000 + i * 10), alder: String(30 + i), kon: i % 2 ? 'Man' : 'Kvinna' },
    tolkat: { bas: 'C', yrke: '207011 Handläggare', lon: 30000 + i * 10, alder: 30 + i, kon: i % 2 ? 'man' : 'kvinna' },
    status: { lon: 'ok', alder: 'ok' },
});
const data = rader => rader.filter(r => r.anvands).map(r => ({ bas: r.tolkat.bas, lon: r.tolkat.lon, alder: r.tolkat.alder, kon: r.tolkat.kon }));
const konVarden = rader => {
    const m = new Map();
    for (const r of rader) { const k = r.ra.kon; const v = m.get(k) || { 'rå': k, tolkat: r.tolkat.kon === 'kvinna' || r.tolkat.kon === 'man' ? r.tolkat.kon : null, antal: 0 }; v.antal++; m.set(k, v); }
    return [...m.values()];
};
const bygg = (rader, over = {}) => byggForhandskontroll({
    rader, data: data(rader), konVarden: konVarden(rader), parseStats: stats({ totalRaw: rader.length }),
    headers: HEADERS, mappning: MAPPNING, k: 10, profil: null, ...over,
});
const koder = fk => fk.varningar.map(v => v.kod);
const trettio = (andra = r => r) => Array.from({ length: 30 }, (_, i) => andra(ren(i), i));

describe('gränsvärdena', () => {
    it('är designens: tio rader, årslön över 150 000, timlön under 5 000, spridning tio gånger medianen, ålder 16–75, grupper under tio, lön 15 000–250 000, BAS en bokstav', () => {
        expect(FK_ANTAL_RADER).toBe(10);
        expect(FK_ARSLON_MEDIAN).toBe(150000);
        expect(FK_TIMLON_MEDIAN).toBe(5000);
        expect(FK_SPRIDNING_GANGER).toBe(10);
        expect([FK_ALDER_MIN, FK_ALDER_MAX]).toEqual([16, 75]);
        expect(FK_SMA_GRUPP).toBe(10);
        expect([FK_LON_MIN, FK_LON_MAX]).toEqual([15000, 250000]);
        expect(forhandskontrollGranser()).toEqual({ antalRader: 10, arslonMedian: 150000, timlonMedian: 5000, spridningGanger: 10, alderMin: 16, alderMax: 75, smaGrupp: 10, namnRadnr: 5, lonMin: 15000, lonMax: 250000, bas: FK_BAS });
    });
});

describe('byggForhandskontroll: allt rent', () => {
    const fk = bygg(trettio());
    it('ger inga varningar', () => expect(fk.varningar).toEqual([]));
    it('tolkningen har de tio första raderna med rå, tolkat och fel per roll, utan tolkning när den är råvärdet', () => {
        expect(fk.tolkning).toHaveLength(10);
        expect(fk.tolkning[0].radnr).toBe(2);
        expect(Object.keys(fk.tolkning[0].celler)).toEqual(['bas', 'yrke', 'lon', 'alder', 'kon']);
        const c = fk.tolkning[0].celler;
        expect(c.bas).toMatchObject({ 'rå': 'C', tolkat: 'C', fel: null, text: 'C' });
        expect(c.lon).toMatchObject({ 'rå': '30000', tolkat: 30000, fel: null });
        expect(c.alder.text).toBe('30');
        for (const rad of fk.tolkning) for (const cell of Object.values(rad.celler)) expect(cell.fel).toBeNull();
    });
    it('kön som skrivs förkortat visar tolkningen (Kvinna och kvinna är samma ord)', () => {
        expect(fk.tolkning[0].celler.kon.text).toBe('Kvinna');
        const k = bygg(trettio(r => ({ ...r, ra: { ...r.ra, kon: r.tolkat.kon === 'man' ? 'M' : 'K' } })));
        expect(k.tolkning[0].celler.kon.text).toBe('K tolkat som kvinna');
        expect(k.tolkning[1].celler.kon.text).toBe('M tolkat som man');
    });
    it('sammandraget räknar raderna i filen och de som används', () => {
        expect(fk.sammandrag).toMatchObject({ totalt: 30, anvands: 30, fodelsear: 0 });
        expect(fk.sammandrag.bortfall).toEqual([]);
    });
    it('fördelningen: BAS-värden, kön-värden med tolkning, lön och ålder', () => {
        expect(fk.fordelning.bas).toEqual({ varden: [{ bas: 'C', antal: 30 }], ovanliga: [] });
        expect(fk.fordelning.kon).toEqual([{ 'rå': 'Kvinna', tolkat: 'kvinna', antal: 15 }, { 'rå': 'Man', tolkat: 'man', antal: 15 }]);
        expect(fk.fordelning.lon).toEqual({ min: 30000, median: 30145, max: 30290 });
        expect(fk.fordelning.alder).toMatchObject({ min: 30, max: 59, utanfor: 0 });
        expect(fk.fordelning.smaBas).toMatchObject({ k: 10, bas: [], rader: 0, andel: 0 });
    });
    it('kolumnerna: de som används per roll och inga oanvända; profilen följer med', () => {
        expect(fk.kolumner.anvanda).toEqual([{ roll: 'bas', rubrik: 'BAS' }, { roll: 'yrke', rubrik: 'AID' }, { roll: 'lon', rubrik: 'Månadslön' }, { roll: 'alder', rubrik: 'Ålder' }, { roll: 'kon', rubrik: 'Kön' }]);
        expect(fk.kolumner.oanvanda).toEqual([]);
        expect(bygg(trettio(), { profil: { namn: 'CSV-mallen', kalla: 'inbyggd' } }).kolumner.profil).toEqual({ namn: 'CSV-mallen', kalla: 'inbyggd' });
    });
    it('tar bara de tio första raderna', () => expect(bygg(trettio()).tolkning.map(r => r.radnr)).toEqual([2, 3, 4, 5, 6, 7, 8, 9, 10, 11]));
});

describe('byggForhandskontroll: felläsningar', () => {
    it('årslön: medianen över 150 000 är ett fel, och texten bär inga löner ur filen', () => {
        const fk = bygg(trettio(r => ({ ...r, ra: { ...r.ra, lon: String(r.tolkat.lon * 12) }, tolkat: { ...r.tolkat, lon: r.tolkat.lon * 12 } })));
        expect(koder(fk)).toEqual(['lon-arslon']);
        const v = fk.varningar[0];
        expect(v.niva).toBe('fel');
        expect(v.text).toMatch(/årslön/);
        expect(v.text).not.toMatch(/36\s?0\d\d|361/);
    });
    it('timlön: medianen under 5 000 är ett fel', () => {
        const fk = bygg(trettio(r => ({ ...r, tolkat: { ...r.tolkat, lon: 180 + r.radnr } })));
        expect(koder(fk)).toEqual(['lon-timlon']);
        expect(fk.varningar[0]).toMatchObject({ niva: 'fel' });
        expect(fk.varningar[0].text).toMatch(/timlön/);
    });
    it('spridning: den högsta lönen över tio gånger medianen är en varning (inte årslön)', () => {
        const fk = bygg(trettio((r, i) => (i === 29 ? { ...r, tolkat: { ...r.tolkat, lon: 400000 } } : r)));
        expect(koder(fk)).toEqual(['lon-spridning']);
        expect(fk.varningar[0].niva).toBe('varning');
        expect(fk.varningar[0].text).not.toContain('400');
    });
    it('lönen tolkad ur ett format med decimaler: 36 500,00 tolkat som 36 500', () => {
        const fk = bygg(trettio((r, i) => (i === 0 ? { ...r, ra: { ...r.ra, lon: '36 500,00' }, tolkat: { ...r.tolkat, lon: 36500 } } : r)));
        expect(fk.tolkning[0].celler.lon.text).toMatch(/^36 500,00 tolkat som 36\s500$/);
        expect(fk.tolkning[0].celler.lon.fel).toBeNull();
    });
    it('födelseår: cellen visar 1978 tolkat som 48 år, sammandraget räknar raderna och det blir en varning', () => {
        const rader = trettio((r, i) => ({ ...r, ra: { ...r.ra, alder: String(1978 - (i % 10)) }, tolkat: { ...r.tolkat, alder: 48 + (i % 10) }, status: { ...r.status, alder: 'birthyear' } }));
        const fk = bygg(rader, { parseStats: stats({ alderFromBirthYear: 30 }) });
        expect(fk.tolkning[0].celler.alder).toMatchObject({ 'rå': '1978', tolkat: 48, fel: null, text: '1978 tolkat som 48 år' });
        expect(fk.sammandrag.fodelsear).toBe(30);
        expect(koder(fk)).toEqual(['alder-fodelsear']);
        expect(fk.varningar[0]).toMatchObject({ niva: 'varning' });
        expect(fk.varningar[0].text).toMatch(/30 rader/);
    });
    it('okänd kön-kod: cellen markeras, raden faller bort, fördelningen säger att koden inte tolkas', () => {
        const rader = trettio((r, i) => (i < 4 ? { ...r, anvands: false, ra: { ...r.ra, kon: '1' }, tolkat: { ...r.tolkat, kon: '' } } : r));
        const fk = bygg(rader, { parseStats: stats({ excludedMissingKon: 4, missingKonExamples: ['1', '1', '1'] }) });
        expect(fk.tolkning[0].anvands).toBe(false);
        expect(fk.tolkning[0].celler.kon.fel).toMatch(/okänd/);
        expect(fk.tolkning[0].celler.kon.text).toBe('1');
        expect(fk.fordelning.kon).toContainEqual({ 'rå': '1', tolkat: null, antal: 4 });
        expect(fk.sammandrag.bortfall).toEqual([{ kod: 'kon', antal: 4, text: 'utan känt kön', exempel: ['1', '1', '1'] }]);
        expect(koder(fk)).toEqual(['kon-okand']);
        expect(fk.varningar[0].text).toMatch(/4 rader/);
    });
    it('BAS med skräp: cellen markeras, värdet är ovanligt och det blir en varning', () => {
        const rader = trettio((r, i) => (i < 12 ? { ...r, ra: { ...r.ra, bas: 'C (chef)' }, tolkat: { ...r.tolkat, bas: 'C (CHEF)' } } : r));
        const fk = bygg(rader);
        expect(fk.tolkning[0].celler.bas).toMatchObject({ 'rå': 'C (chef)', tolkat: 'C (CHEF)', text: 'C (chef) tolkat som C (CHEF)' });
        expect(fk.tolkning[0].celler.bas.fel).toBe('inte en bokstav');
        expect(fk.fordelning.bas.ovanliga).toEqual(['C (CHEF)']);
        expect(koder(fk)).toEqual(['bas-ovanlig']);
        expect(fk.varningar[0].text).toContain('C (CHEF)');
    });
    it('varje bokstav A–Ö är ett rimligt BAS-värde; en siffra eller två bokstäver ger varning', () => {
        const med = varden => trettio((r, i) => { const bas = varden[i % varden.length]; return { ...r, ra: { ...r.ra, bas }, tolkat: { ...r.tolkat, bas } }; });
        const fk = bygg(med(['P', 'Ö']));
        expect(fk.tolkning.map(t => t.celler.bas.fel)).toEqual(Array(10).fill(null));
        expect(fk.fordelning.bas.ovanliga).toEqual([]);
        expect(koder(fk)).not.toContain('bas-ovanlig');
        const fel = bygg(med(['1', 'AB']));
        expect(fel.tolkning[0].celler.bas.fel).toBe('inte en bokstav');
        expect(fel.fordelning.bas.ovanliga).toEqual(['1', 'AB']);
        expect(fel.varningar.find(v => v.kod === 'bas-ovanlig').text).toBe('2 BAS-värden är inte en bokstav (1, AB): kontrollera BAS-kolumnen.');
    });
    it('ålder utanför 16–75: cellen markeras och antalet står i varningen', () => {
        const rader = trettio((r, i) => (i === 0 ? { ...r, ra: { ...r.ra, alder: '14' }, tolkat: { ...r.tolkat, alder: 14 } }
            : i === 1 ? { ...r, ra: { ...r.ra, alder: '81' }, tolkat: { ...r.tolkat, alder: 81 } } : r));
        const fk = bygg(rader);
        expect(fk.tolkning[0].celler.alder.fel).toMatch(/16–75/);
        expect(fk.tolkning[1].celler.alder.fel).toMatch(/16–75/);
        expect(fk.fordelning.alder).toMatchObject({ min: 14, max: 81, utanfor: 2 });
        expect(koder(fk)).toEqual(['alder-utanfor']);
        expect(fk.varningar[0].text).toMatch(/2 personer/);
        expect(fk.varningar[0].text).not.toMatch(/14|81/);
    });
    describe('ålder utanför 16–75: radnumren och följden', () => {
        // Poster med radnummer, som inläsningen ger dem: åldern 12 eller 88 på de angivna raderna, 40 på de andra.
        const poster = utanfor => Array.from({ length: 30 }, (_, i) => ({ bas: 'C', lon: 30000, kon: i % 2 ? 'man' : 'kvinna',
            radnr: 2 + i * 7, alder: utanfor.includes(2 + i * 7) ? (i % 2 ? 88 : 12) : 40 }));
        const text = (utanfor, over = d => d) => bygg(trettio(), { data: over(poster(utanfor)) }).varningar.find(v => v.kod === 'alder-utanfor').text;
        it('radnumren i stigande ordning, och följden för analysen', () => {
            expect(text([2, 72, 163])).toBe('3 personer har en ålder utanför 16–75 år (rad 2, 72 och 163). '
                + 'Raderna räknas med i åldersjusteringen tills filen är rättad: kontrollera ålderskolumnen och läs in filen igen.');
            expect(text([163, 2], d => [...d].reverse())).toMatch(/\(rad 2 och 163\)/);
        });
        it('en person i singular', () => {
            expect(text([9])).toBe('1 person har en ålder utanför 16–75 år (rad 9). '
                + 'Raden räknas med i åldersjusteringen tills filen är rättad: kontrollera ålderskolumnen och läs in filen igen.');
        });
        it('fler än fem: "till exempel" och de fem första', () => {
            expect(text([2, 9, 16, 23, 30, 37, 44])).toMatch(/^7 personer har en ålder utanför 16–75 år \(till exempel rad 2, 9, 16, 23 och 30\)\. /);
        });
        it('utan radnummer (som demodata) bara antalet', () => {
            expect(text([2, 9], d => d.map(r => ({ ...r, radnr: null })))).toMatch(/^2 personer har en ålder utanför 16–75 år\. Raderna räknas med/);
        });
        it('ingen ålder ur filen i texten', () => {
            expect(text([2, 9, 16])).not.toMatch(/\b(12|88)\b/);
        });
    });
    it('en lön som inte går att läsa och en saknad BAS: cellerna markeras och bortfallet redovisas', () => {
        const rader = trettio((r, i) => (i === 0 ? { ...r, anvands: false, ra: { ...r.ra, lon: 'saknas' }, tolkat: { ...r.tolkat, lon: 0 }, status: { ...r.status, lon: 'invalid' } }
            : i === 1 ? { ...r, anvands: false, ra: { ...r.ra, bas: '' }, tolkat: { ...r.tolkat, bas: '' } } : r));
        const fk = bygg(rader, { parseStats: stats({ excludedNoBas: 1, excludedZeroLon: 1, invalidLon: 1, invalidLonExamples: ['saknas'] }) });
        expect(fk.tolkning[0].celler.lon.fel).toMatch(/inte läsas som tal/);
        expect(fk.tolkning[1].celler.bas).toMatchObject({ text: '(tom)' });
        expect(fk.tolkning[1].celler.bas.fel).toMatch(/saknas/);
        expect(fk.sammandrag.bortfall.map(b => b.kod)).toEqual(['bas', 'lon']);
        expect(fk.sammandrag.ogiltigLon).toEqual({ antal: 1, exempel: ['saknas'] });
        expect(koder(fk)).toEqual(['bortfall-bas', 'bortfall-lon']);
    });
    it('små BAS-intervall räknas med minsta gruppstorleken men ger ingen varning', () => {
        const rader = [...trettio(), ...Array.from({ length: 3 }, (_, i) => { const r = ren(30 + i); return { ...r, tolkat: { ...r.tolkat, bas: 'H' } }; })];
        const fk = bygg(rader);
        expect(fk.fordelning.smaBas).toEqual({ k: 10, bas: ['H'], rader: 3, andel: 3 / 33 });
        expect(fk.varningar).toEqual([]);
        expect(bygg(rader, { k: 2 }).fordelning.smaBas.bas).toEqual([]);
    });
});

describe('byggForhandskontroll: kolumner', () => {
    it('kolumner som inte används listas, och poäng och ansvarskod visas bara när de mappats', () => {
        const fk = bygg(trettio(), { headers: [...HEADERS, 'Anstnr', 'Kostnadsställe'] });
        expect(fk.kolumner.oanvanda).toEqual(['Anstnr', 'Kostnadsställe']);
        expect(Object.keys(fk.tolkning[0].celler)).not.toContain('poang');
        const med = trettio(r => ({ ...r, ra: { ...r.ra, poang: '480', ansvar: 'X' }, tolkat: { ...r.tolkat, poang: 480, ansvar: 'inget' }, status: { ...r.status, poang: 'ok', ansvar: 'invalid' } }));
        const fk2 = bygg(med, { headers: [...HEADERS, 'Poäng', 'Ansvarskod'], mappning: { ...MAPPNING, poang: 'Poäng', ansvar: 'Ansvarskod' } });
        expect(Object.keys(fk2.tolkning[0].celler)).toEqual(['bas', 'yrke', 'lon', 'alder', 'kon', 'poang', 'ansvar']);
        expect(fk2.tolkning[0].celler.poang).toMatchObject({ text: '480', fel: null });
        expect(fk2.tolkning[0].celler.ansvar.fel).toMatch(/ogiltig/);
    });
    it('yrkets råvärde visas inte: cellen visar det verktyget sparar (kortat och rensat)', () => {
        const ra = '207011 Handläggare med särskilt ansvar för samordning Anna Berg';
        const fk = bygg(trettio(r => ({ ...r, ra: { ...r.ra, yrke: ra }, tolkat: { ...r.tolkat, yrke: '207011 Handläggare med särskilt ansvar för samor…' } })));
        expect(fk.tolkning[0].celler.yrke).toMatchObject({ 'rå': null, text: '207011 Handläggare med särskilt ansvar för samor…', fel: null });
        expect(JSON.stringify(fk)).not.toContain('Anna');
    });
    it('långa råvärden kortas till 24 tecken', () => {
        const fk = bygg(trettio((r, i) => (i === 0 ? { ...r, anvands: false, ra: { ...r.ra, kon: 'x'.repeat(40) }, tolkat: { ...r.tolkat, kon: 'x'.repeat(40) } } : r)));
        expect(fk.tolkning[0].celler.kon['rå']).toBe('x'.repeat(24) + '…');
    });
});

describe('byggForhandskontroll: lönefil utan ålder (ADR-64)', () => {
    const utanAlder = r => ({ ...r, ra: { ...r.ra, alder: undefined }, tolkat: { ...r.tolkat, alder: 0 }, status: { ...r.status, alder: 'empty' } });
    const { alder: _a, ...mappning } = MAPPNING;
    const fk = bygg(trettio(utanAlder), { mappning, headers: HEADERS.filter(h => h !== 'Ålder') });
    it('tolkningen har ingen ålderskolumn', () => {
        expect(Object.keys(fk.tolkning[0].celler)).toEqual(['bas', 'yrke', 'lon', 'kon']);
        expect(fk.fordelning.alder).toBeNull();
    });
    it('en varning säger att analysen körs utan åldersjustering', () => {
        const v = fk.varningar.find(x => x.kod === 'alder-saknas');
        expect(v).toBeTruthy();
        expect(v.text).toBe('Ålder saknas: analysen körs utan åldersjustering; Ålder & karriär visas inte.');
        expect(koder(fk)).toEqual(['alder-saknas']);
    });
    it('med ålder ingen sådan varning', () => expect(koder(bygg(trettio()))).not.toContain('alder-saknas'));
});

describe('byggForhandskontroll: personnamn i fältet för AID-etikett', () => {
    const med = (antal, radnr) => bygg(trettio(), { parseStats: stats({ yrkeNamn: antal, yrkeNamnRadnr: radnr }) });
    it('ingen varning när antalet är 0 eller saknas', () => {
        expect(koder(med(0, []))).toEqual([]);
        expect(koder(bygg(trettio()))).toEqual([]);
        expect(namnIYrkesfaltetText(0, [])).toBe('');
    });
    it('två rader: varningen med antal och radnummer, och texten är den enda källans', () => {
        const fk = med(2, [12, 40]);
        expect(koder(fk)).toEqual(['yrke-namn']);
        expect(fk.varningar[0].niva).toBe('varning');
        expect(fk.varningar[0].text).toBe('Fältet för AID-etikett ser ut att innehålla personnamn på 2 rader (rad 12 och 40). '
            + 'Verktyget behöver inga namn. Ta bort namnen ur kolumnen i uttaget ur lönesystemet och läs in filen igen. '
            + 'Namn som står kvar kan följa med i tabeller och exporter.');
        expect(fk.varningar[0].text).toBe(namnIYrkesfaltetText(2, [12, 40]));
    });
    it('en rad i singular', () => {
        expect(med(1, [7]).varningar[0].text).toMatch(/^Fältet för AID-etikett ser ut att innehålla personnamn på 1 rad \(rad 7\)\./);
    });
    it('fler rader än radnummer: "till exempel" och högst fem radnummer', () => {
        expect(med(8, [3, 5, 9, 11, 14]).varningar[0].text).toMatch(/på 8 rader \(till exempel rad 3, 5, 9, 11 och 14\)\./);
        expect(namnIYrkesfaltetText(9, [1, 2, 3, 4, 5, 6, 7])).toMatch(/\(till exempel rad 1, 2, 3, 4 och 5\)/);
        expect(FK_NAMN_RADNR).toBe(5);
    });
    it('utan kända radnummer står bara antalet', () => {
        expect(namnIYrkesfaltetText(3, [null, null])).toMatch(/på 3 rader\. Verktyget/);
        expect(namnIYrkesfaltetRadnr(3, [null, null])).toBe('');
    });
    it('radnumren har en källa: inläsningsrapportens exempel och parentesen i varningen', () => {
        expect(namnIYrkesfaltetRadnr(2, [137, 138])).toBe('rad 137 och 138');
        expect(namnIYrkesfaltetRadnr(1, [7])).toBe('rad 7');
        expect(namnIYrkesfaltetRadnr(9, [1, 2, 3, 4, 5, 6, 7])).toBe('till exempel rad 1, 2, 3, 4 och 5');
        expect(namnIYrkesfaltetRadnr(0, [1])).toBe('');
        expect(namnIYrkesfaltetText(2, [137, 138])).toContain(`(${namnIYrkesfaltetRadnr(2, [137, 138])})`);
    });
    it('varningen kommer före de andra', () => {
        const fk = bygg(trettio(), { parseStats: stats({ yrkeNamn: 1, yrkeNamnRadnr: [2], alderFromBirthYear: 30 }) });
        expect(koder(fk)).toEqual(['yrke-namn', 'alder-fodelsear']);
    });
});

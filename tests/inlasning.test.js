/**
 * Tolkningen av indata: src/lib/inlasning.js körd fristående i Node, utan appen och utan låst klocka.
 *
 * tests/parsing.test.js prövar samma tolkning genom appen (extractMinimalRecord och spegeln) med hela tabellerna;
 * här körs ett urval ur dem direkt mot lib-funktionerna, och födelseårsreserven med referensåret som argument.
 */
import { describe, it, expect } from 'vitest';
import {
    parseNumber, parseNumberStrict, _normalizeKon, _normalizeBas, _normalizePolicyAid, _cleanYrkeField,
    _pnrSampelSteg, detectSensitiveColumns, tolkaLonerad
} from '../src/lib/inlasning.js';

describe('inlasning: tal (parseNumber, parseNumberStrict)', () => {
    // [råvärde, parseNumber, parseNumberStrict.status]
    it.each([
        ['32 500,50', 32500.5, 'ok'],
        ['32.500,50', 32500.5, 'ok'],
        ['1,234,567.89', 1234567.89, 'ok'],
        ['32,500', 32500, 'ok'],
        ['32,5', 32.5, 'ok'],
        ['0,500', 0.5, 'ok'],
        ['32 500 kr', 32500, 'ok'],
        ['32500:-', 32500, 'ok'],
        ["32'500", 32500, 'ok'],
        ['−32500', -32500, 'ok'],
        ['-1 250,50 kr', -1250.5, 'ok'],
        ['', 0, 'empty'],
        [null, 0, 'empty'],
        ['saknas', 0, 'invalid'],
        ['12abc', 12, 'ok'],
        ['1.2.3', 1.2, 'ok'],
    ])('%o → %o, status %o', (raw, value, status) => {
        expect(parseNumber(raw)).toBe(value);
        expect(parseNumberStrict(raw)).toEqual({ status, value, raw });
    });
});

describe('inlasning: kön, BAS och AID', () => {
    it.each([
        ['K', 'kvinna'], ['Kvinnor.', 'kvinna'], ['Female ', 'kvinna'], ['W', 'kvinna'],
        ['M.', 'man'], ['Män', 'man'], ['MÄN', 'man'], ['Male', 'man'],
        ['1', ''], ['X', 'x'], ['', ''], [null, ''],
    ])('kön %o → %o', (raw, forvantat) => {
        expect(_normalizeKon(raw)).toBe(forvantat);
    });
    it.each([
        ['BAS A', 'A'], ['bas-2', '2'], ['bas: d', 'D'], [' b ', 'B'], ['BASA', 'BASA'], ['BAS', 'BAS'], ['BAS-', 'BAS-'],
        ['A<script>', 'ASCRIPT'], ['A" onmouseover="alert(1)', 'A ONMOUSEOVER=ALERT(1)'], ['', ''], [null, ''],
    ])('BAS %o → %o', (raw, forvantat) => {
        expect(_normalizeBas(raw)).toBe(forvantat);
    });
    it('AID i ställningstagandet: sifferprefixet, annars den rensade strängen', () => {
        expect(_normalizePolicyAid('207 Förskollärare')).toBe('207');
        expect(_normalizePolicyAid(' <Ledning> ')).toBe('Ledning');
        expect(_normalizePolicyAid('')).toBe('');
    });
});

describe('inlasning: yrke (_cleanYrkeField)', () => {
    it.each([
        ['101010 — Ledning', '101010 Ledning'],
        ['101010', '101010'],
        ['101010 Lärare grundskola', '101010 Lärare grundskola'],
        ['101010 Anna Andersson', '101010 ***'],
        ['101010 ANDERSSON, ANNA', '101010 ***'],
        ['101010 Andersson, Anna', '101010 ***'],
        ['101010 anna andersson', '101010 anna andersson'],
        ['101010 ANDERSSON, Anna', '101010 ANDERSSON, Anna'],
        ['101010 <Anna> <Andersson>', '101010 ***'],
        ['101010 Lärare <b>&\'"', '101010 Lärare b'],
        ['101010 Ledarskapsutveckling och personal Anna Andersson', '101010 Ledarskapsutveckling och personal ***'],
        ['101010 Chef, enhet', '101010 Chef, enhet'],
        ['101010 IT-tekniker', '101010 IT-tekniker'],
        ['', ''], [null, ''], ['   ', ''],
    ])('%o → %o', (raw, forvantat) => {
        expect(_cleanYrkeField(raw)).toBe(forvantat);
    });
});

describe('inlasning: en lönerad (tolkaLonerad)', () => {
    const falt = (alder, ovrigt = {}) => ({ bas: 'A', kon: 'Man', lon: '30000', alder, poang: '', yrke: '5301', ...ovrigt });

    // Referensåret är ett argument: ingen klocka behövs. [ålderskolumnen, referensår, ålder, status]
    it.each([
        ['1980', 2026, 46, 'birthyear'],
        ['1980', 2027, 47, 'birthyear'],
        ['1900', 2026, 126, 'birthyear'],   // nedre gränsen ingår
        ['1899', 2026, 1899, 'ok'],         // under 1900: inget födelseår
        ['2011', 2026, 15, 'birthyear'],    // referensår − 15: övre gränsen ingår
        ['2012', 2026, 2012, 'ok'],         // referensår − 14: inget födelseår
        ['2012', 2027, 15, 'birthyear'],    // samma värde, ett år senare
        ['45', 2026, 45, 'ok'],
        ['', 2026, 0, 'empty'],
        ['okänd', 2026, 0, 'invalid'],
    ])('ålderskolumnen %o med referensåret %o → alder %o, status %o', (raw, referensar, alder, status) => {
        const rec = tolkaLonerad(falt(raw), referensar);
        expect(rec.alder).toBe(alder);
        expect(rec._alderStatus).toBe(status);
    });

    it('hela raden normaliseras: BAS, kön, lön, yrke, AID och poäng', () => {
        const rec = tolkaLonerad({ bas: 'BAS B', kon: 'K', lon: '32.500,50', alder: '38', poang: '342,5', yrke: '203010 Förskollärare' }, 2026);
        expect(rec).toEqual({
            bas: 'B', yrke: '203010 Förskollärare', aid: '203010', yrkeLabel: 'Förskollärare', lon: 32500.5, alder: 38,
            kon: 'kvinna', poang: 342.5, ansvarskoder: null, ansvarsgrupp: null, _lonStatus: 'ok', _alderStatus: 'ok'
        });
    });

    it('ansvarskoden läses bara när en godkänd kolumn finns', () => {
        expect(tolkaLonerad(falt('45', { ansvar: 'C1' }), 2026)).toMatchObject({ ansvarskoder: null, ansvarsgrupp: null });
        expect(tolkaLonerad(falt('45', { ansvar: 'C1' }), 2026, true)).toMatchObject({ ansvarskoder: ['C'], ansvarsgrupp: 'ledning' });
        expect(tolkaLonerad(falt('45', { ansvar: 'X' }), 2026, true)).toMatchObject({ ansvarskoder: [], ansvarsgrupp: 'inget' });
        expect(tolkaLonerad(falt('45'), 2026, true)).toMatchObject({ ansvarskoder: [], ansvarsgrupp: 'inget' });
    });

    it('ogiltig lön och saknad poäng', () => {
        const rec = tolkaLonerad(falt('45', { lon: 'saknas', poang: undefined }), 2026);
        expect(rec.lon).toBe(0);
        expect(rec._lonStatus).toBe('invalid');
        expect(rec.poang).toBeNull();
    });
});

describe('inlasning: känsliga kolumner', () => {
    it('stegen mellan samplade rader', () => {
        expect(_pnrSampelSteg(1)).toBe(1);
        expect(_pnrSampelSteg(50)).toBe(1);
        expect(_pnrSampelSteg(51)).toBe(2);
        expect(_pnrSampelSteg(7000)).toBe(140);
    });
    it('rubriker och värden som avslöjar personuppgifter', () => {
        const rader = Array.from({ length: 10 }, (_, i) => ({
            'Anst.nr': String(1000 + i), 'Förnamn': 'x', 'Id': `19800101-123${i}`, 'Kontakt': `p${i}@exempel.se`,
            'Person': ['Anna Andersson', 'Bo Berg', 'Cecilia Ek'][i % 3], 'Befattning': 'Lärare grundskola'
        }));
        expect(detectSensitiveColumns(rader).map(f => f.col)).toEqual(['Förnamn', 'Id', 'Kontakt', 'Person']);
        expect(detectSensitiveColumns([])).toEqual([]);
    });
});

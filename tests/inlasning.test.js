/**
 * Tolkningen av indata: src/lib/inlasning.js körd fristående i Node, utan appen och utan låst klocka.
 *
 * tests/parsing.test.js prövar samma tolkning genom appen (extractMinimalRecord och spegeln) med hela tabellerna;
 * här körs ett urval ur dem direkt mot lib-funktionerna, och födelseårsreserven med referensåret som argument.
 */
import { describe, it, expect } from 'vitest';
import {
    parseNumber, parseNumberStrict, _normalizeKon, _normalizeBas, _normalizePolicyAid, _cleanYrkeField,
    _pnrSampelSteg, detectSensitiveColumns, tolkaLonerad, yrkeLiknarNamn, YRKE_NAMNMONSTER,
    yrkeNamnNyckel, sallsyntaNamnrader, YRKE_NAMN_HOGST_RADER
} from '../src/lib/inlasning.js';
import { aidEtikettlista } from '../src/lib/aid-etiketter.js';

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
        ['12abc', 0, 'invalid'],
        ['abc12', 0, 'invalid'],
        ['12 st', 0, 'invalid'],
        ['45 år', 45, 'ok'],
        ['45år', 45, 'ok'],
        ['45 ÅR', 45, 'ok'],
        ['45årig', 0, 'invalid'],
        ['45 årsarbetare', 0, 'invalid'],
        ['1.2.3', 0, 'invalid'],
        ['1,2,3', 0, 'invalid'],
        ['12,34.56', 0, 'invalid'],
        ['-', 0, 'invalid'],
        ['.', 0, 'invalid'],
        ['32\u00a0500', 32500, 'ok'],
        ['32\u202f500', 32500, 'ok'],
        ['32.500', 32500, 'ok'],
        ['32.5', 32.5, 'ok'],
        ['32 500 SEK', 32500, 'ok'],
        ['3,25 %', 3.25, 'ok'],
        [' 42 ', 42, 'ok'],
    ])('%o → %o, status %o', (raw, value, status) => {
        expect(parseNumber(raw)).toBe(value);
        expect(parseNumberStrict(raw)).toEqual({ status, value, raw });
    });
    it('ett värde som redan är ett tal (ur Excel) läses som det är, också i exponentform', () => {
        expect(parseNumberStrict(1e-7)).toEqual({ status: 'ok', value: 1e-7, raw: '1e-7' });
        expect(parseNumber(32500.5)).toBe(32500.5);
        expect(parseNumberStrict(NaN).status).toBe('invalid');
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
        ['101010 Anna Andersson', '101010 Anna Andersson'],
        ['101010 ANDERSSON, ANNA', '101010 ANDERSSON, ANNA'],
        ['101010 Andersson, Anna', '101010 Andersson, Anna'],
        ['101010 anna andersson', '101010 anna andersson'],
        ['101010 ANDERSSON, Anna', '101010 ANDERSSON, Anna'],
        ['101010 <Anna> <Andersson>', '101010 Anna Andersson'],
        ['101010 Lärare <b>&\'"', '101010 Lärare b'],
        ['101010 Ledarskapsutveckling och personal Anna Andersson', '101010 Ledarskapsutveckling och personal Anna A…'],
        // Ingenting maskeras (ADR-85): etiketter med versal på två ord kommer ut oförändrade.
        ['101010 Sjuksköterska Natt', '101010 Sjuksköterska Natt'],
        ['101010 Lärare Grundskola', '101010 Lärare Grundskola'],
        ['101010 Chef, enhet', '101010 Chef, enhet'],
        ['101010 IT-tekniker', '101010 IT-tekniker'],
        ['', ''], [null, ''], ['   ', ''],
    ])('%o → %o', (raw, forvantat) => {
        expect(_cleanYrkeField(raw)).toBe(forvantat);
    });
});

describe('inlasning: namn i yrkesfältet (yrkeLiknarNamn)', () => {
    it.each([
        '101010 Sjuksköterska Anna Andersson',
        '101010 Anna Andersson',
        '101010 Andersson, Anna',
        '101010 ANDERSSON, ANNA',
        '101010 Anna-Lisa Berg',
        '101010 — Sjuksköterska — Örjan Östberg 75%',
        '101010 <Anna> <Andersson>',
        'Anna Andersson',
    ])('%o ser ut att innehålla ett namn', raw => {
        expect(yrkeLiknarNamn(raw)).toBe(true);
    });

    it.each([
        '101010 Sjuksköterska',
        '101010 Lärare grundskola',
        '101010 IT-tekniker',
        '101010 Ledning, övergripande',
        '101010',
        '',
        '   ',
        null,
        undefined,
        // De kända gränserna: namn i gemener, ett ensamt namn och blandad form hittas inte.
        '101010 sjuksköterska anna andersson',
        '101010 Andersson',
        '101010 sjuksköterska Andersson',
        '101010 ANDERSSON, Anna',
    ])('%o ser inte ut att innehålla ett namn', raw => {
        expect(yrkeLiknarNamn(raw)).toBe(false);
    });

    it('ingen etikett i den inbyggda etikettlistan träffas', () => {
        const etiketter = aidEtikettlista().etiketter;
        expect(etiketter.length).toBeGreaterThan(200);
        expect(etiketter.filter(([kod, namn]) => yrkeLiknarNamn(`${kod} ${namn}`)).map(([kod, namn]) => `${kod} ${namn}`)).toEqual([]);
        expect(etiketter.filter(([, namn]) => yrkeLiknarNamn(namn)).map(([, namn]) => namn)).toEqual([]);
    });

    it('mönstren bär inget tillstånd, och etiketten skiljs ut som i _cleanYrkeField', () => {
        expect(YRKE_NAMNMONSTER).toHaveLength(2);
        for (const re of YRKE_NAMNMONSTER) expect(re.flags).toBe('');   // utan /g: test() bär inget tillstånd mellan anropen
        // Båda tar etiketten ur samma hjälpfunktion.
        for (const f of [_cleanYrkeField, yrkeNamnNyckel]) expect(f.toString()).toContain('_yrkeEtikett(s)');
    });

    it('nyckeln: etikettexten i gemener med blanksteg samman, tom utan namnmönster', () => {
        expect(yrkeNamnNyckel('101010 Sjuksköterska  Anna   Andersson')).toBe('sjuksköterska anna andersson');
        expect(yrkeNamnNyckel('101010 — ANDERSSON, ANNA')).toBe('andersson, anna');
        expect(yrkeNamnNyckel('101010 Lärare grundskola')).toBe('');
        expect(yrkeNamnNyckel('')).toBe('');
        expect(yrkeNamnNyckel(null)).toBe('');
    });

    it('prövas på råvärdet: ett namn efter kortningsgränsen på 40 tecken räknas också', () => {
        expect(_cleanYrkeField('101010 Sjuksköterska Anna Andersson')).toBe('101010 Sjuksköterska Anna Andersson');
        expect(yrkeLiknarNamn('101010 Sjuksköterska Anna Andersson')).toBe(true);
        const lang = '101010 handläggare med särskilt ansvar för samordning Anna Andersson';
        expect(_cleanYrkeField(lang)).not.toMatch(/Anna|Andersson/);
        expect(yrkeLiknarNamn(lang)).toBe(true);
    });
});

describe('inlasning: sällsynta namnrader (sallsyntaNamnrader)', () => {
    // Räknaren som inläsningen bygger: per nyckel antal och de första YRKE_NAMN_HOGST_RADER radnumren.
    const rakna = varden => {
        const m = new Map();
        varden.forEach((raw, i) => {
            const k = yrkeNamnNyckel(raw);
            if (!k) return;
            const v = m.get(k) || { antal: 0, radnr: [] };
            v.antal++;
            if (v.radnr.length < YRKE_NAMN_HOGST_RADER) v.radnr.push(i + 2);
            m.set(k, v);
        });
        return m;
    };
    it('gränsen är två rader', () => expect(YRKE_NAMN_HOGST_RADER).toBe(2));
    it('40 rader "Sjuksköterska Natt" och en rad med ett namn ger en misstänkt rad', () => {
        const varden = [...Array(40).fill('101010 Sjuksköterska Natt'), '101010 Sjuksköterska Anna Andersson'];
        expect(sallsyntaNamnrader(rakna(varden))).toEqual({ antal: 1, radnr: [42] });
    });
    it('samma namn på tre rader är över gränsen och ger 0 (känd gräns)', () => {
        expect(sallsyntaNamnrader(rakna(Array(3).fill('101010 Anna Andersson')))).toEqual({ antal: 0, radnr: [] });
    });
    it('två rader med samma namn räknas båda', () => {
        expect(sallsyntaNamnrader(rakna(['101010 Anna Andersson', '101010 Lärare', '101010 Anna Andersson']))).toEqual({ antal: 2, radnr: [2, 4] });
    });
    it('skiftläge och extra blanksteg räknas som samma text', () => {
        // Samma text med olika blanksteg på tre rader: över gränsen. "SJUKSKÖTERSKA NATT" har inget namnmönster.
        const varden = ['101010 Sjuksköterska Natt', '101010 SJUKSKÖTERSKA NATT', '101010  Sjuksköterska   Natt ', '101010 Sjuksköterska\tNatt'];
        expect(sallsyntaNamnrader(rakna(varden))).toEqual({ antal: 0, radnr: [] });
        const tre = ['101010 Andersson, Anna', '101010 ANDERSSON, ANNA', '101010   Anna   Andersson', '101010 Anna Andersson '];
        expect([...rakna(tre).keys()]).toEqual(['andersson, anna', 'anna andersson']);
        expect(sallsyntaNamnrader(rakna([...tre, '101010 ANDERSSON, ANNA']))).toEqual({ antal: 2, radnr: [4, 5] });
    });
    it('radnumren i stigande ordning och högst så många som begärs; en tom räknare ger 0', () => {
        const varden = ['101010 Eva Ek', '101010 Bo Ek', '101010 Al Ek', '101010 Ulf Ek', '101010 Per Ek', '101010 Siv Ek', '101010 Eva Ek'];
        expect(sallsyntaNamnrader(rakna(varden), 5)).toEqual({ antal: 7, radnr: [2, 3, 4, 5, 6] });
        expect(sallsyntaNamnrader(new Map())).toEqual({ antal: 0, radnr: [] });
        expect(sallsyntaNamnrader(null)).toEqual({ antal: 0, radnr: [] });
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

    it('skräp efter siffrorna: lönen och åldern blir ogiltiga och poängen saknas', () => {
        const rec = tolkaLonerad(falt('45årig', { lon: '32500abc', poang: '342x' }), 2026);
        expect(rec).toMatchObject({ lon: 0, _lonStatus: 'invalid', alder: 0, _alderStatus: 'invalid', poang: null });
    });
    it('åldern med enheten "år" läses som ålder', () => {
        expect(tolkaLonerad(falt('45år'), 2026)).toMatchObject({ alder: 45, _alderStatus: 'ok' });
        expect(tolkaLonerad(falt('45 ÅR'), 2026)).toMatchObject({ alder: 45, _alderStatus: 'ok' });
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

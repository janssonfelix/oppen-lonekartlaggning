/**
 * Tolkningen av indata: src/lib/inlasning.js körd fristående i Node, utan appen och utan låst klocka. Filtexten
 * (teckenkodning, avgränsare, rubrikrad, filformat), kolumnvalet, talen, normaliseringarna, en lönerad och de
 * känsliga kolumnerna prövas här och bara här. Appens adaptrar (hamtaFalt, minimeraLonerad m.fl., som läser
 * tillståndet och klockan) och inläsningen av hela filer prövas i tests/inlasning-app.test.js.
 *
 * Tabellerna låser dagens tolkning av indata. Där resultatet kan överraska står det med en kommentar; det låses ändå
 * och ska ändras medvetet, inte av en omstrukturering.
 */
import { describe, it, expect } from 'vitest';
import {
    tolkaTal, tolkaTalStrikt, _normaliseraKon, _normaliseraBas, _normaliseraPolicyAid, _stadaYrkesfalt,
    _pnrSampelSteg, hittaKansligaKolumner, tolkaLonerad, yrkeLiknarNamn, YRKE_NAMNMONSTER,
    yrkeNamnNyckel, sallsyntaNamnrader, YRKE_NAMN_HOGST_RADER,
    _gissaAvgransare, _avkodaCsv, _hittaCsvRubrik, _gissaTabellformat, bladetsSlut,
    _rubrikForRoll, vardeForRoll, gissaKolumnmappning, lonefilensRubriker, hittaAnsvarKolumn, _bedomAnsvarKolumn, minimeraRad
} from '../src/lib/inlasning.js';
import { aidEtikettlista } from '../src/lib/aid-etiketter.js';

describe('[B9.1] inlasning: tal (tolkaTal, tolkaTalStrikt)', () => {
    // [råvärde, tolkaTal, tolkaTalStrikt.status]
    it.each([
        ['32 500,50', 32500.5, 'ok'],
        ['32 500', 32500, 'ok'],
        ['32500,50', 32500.5, 'ok'],
        ['1 000 000', 1000000, 'ok'],
        ['32.500,50', 32500.5, 'ok'],
        ['1.234.567,89', 1234567.89, 'ok'],
        ['32,500.50', 32500.5, 'ok'],
        ['1,234,567.89', 1234567.89, 'ok'],
        ['32,500', 32500, 'ok'],
        ['1,234,567', 1234567, 'ok'],
        // En ensam separator med 1–2 decimaler är decimaltecken.
        ['32,5', 32.5, 'ok'],
        ['3,5', 3.5, 'ok'],
        ['0,5', 0.5, 'ok'],
        ['0,500', 0.5, 'ok'],           // heltalsdelen "0" tvingar decimaltolkning
        ['0.500', 0.5, 'ok'],
        ['0', 0, 'ok'],
        ['32 500 kr', 32500, 'ok'],
        ['32 500 kr', 32500, 'ok'],
        ['32 500 kr.', 32500, 'ok'],
        ['32500 kronor', 32500, 'ok'],
        ['SEK 32500', 32500, 'ok'],
        ['32500:-', 32500, 'ok'],
        ['32 500,-', 32500, 'ok'],
        ['5%', 5, 'ok'],
        ['+5', 5, 'ok'],
        ["32'500", 32500, 'ok'],
        // Minustecknet U+2212 (verktygets egna exporter, Intl) läses som minus, inte som ett positivt tal.
        ['−32500', -32500, 'ok'],
        ['\u221232 500', -32500, 'ok'],
        ['\u22121\u00a0250,50 kr', -1250.5, 'ok'],
        ['\u22123,25 %', -3.25, 'ok'],
        ['\u2212', 0, 'invalid'],
        ['-1 250,50 kr', -1250.5, 'ok'],
        ['', 0, 'empty'],
        [null, 0, 'empty'],
        [undefined, 0, 'empty'],
        ['saknas', 0, 'invalid'],
        ['12abc', 0, 'invalid'],
        ['abc12', 0, 'invalid'],
        ['12 st', 0, 'invalid'],
        ['45 år', 45, 'ok'],
        ['45år', 45, 'ok'],
        ['45 ÅR', 45, 'ok'],
        ['45årig', 0, 'invalid'],
        ['45 årsarbetare', 0, 'invalid'],
        ['3.25E+04', 0, 'invalid'],      // exponentform i text läses inte (förr: 3,2504)
        ['1.2.3', 0, 'invalid'],         // flera decimalpunkter som inte är tusentalsgrupper
        ['1,2,3', 0, 'invalid'],         // samma sak för kommatecken
        ['12,34.56', 0, 'invalid'],      // både punkt och komma, men delen före decimaltecknet är inga tregrupper
        ['1.2,3', 0, 'invalid'],
        ['-', 0, 'invalid'],
        ['.', 0, 'invalid'],
        ['32\u00a0500', 32500, 'ok'],
        ['32\u202f500', 32500, 'ok'],
        ['32.500', 32500, 'ok'],
        ['1.234', 1234, 'ok'],
        ['1.500', 1500, 'ok'],
        ['32.5', 32.5, 'ok'],
        ['32 500 SEK', 32500, 'ok'],
        ['3,25 %', 3.25, 'ok'],
        [' 42 ', 42, 'ok'],
    ])('%o → %o, status %o', (raw, value, status) => {
        expect(tolkaTal(raw)).toBe(value);
        expect(tolkaTalStrikt(raw)).toEqual({ status, value, raw });
    });
    it('ett värde som redan är ett tal (ur Excel) läses som det är, också i exponentform', () => {
        expect(tolkaTalStrikt(1e-7)).toEqual({ status: 'ok', value: 1e-7, raw: '1e-7' });
        expect(tolkaTal(32500.5)).toBe(32500.5);
        expect(tolkaTalStrikt(NaN).status).toBe('invalid');
    });
});

describe('[B9.2] [B9.3] inlasning: kön, BAS och AID', () => {
    it.each([
        // Förkortningar, engelska värden och pluralformerna ("Män", "Kvinnor").
        ['K', 'kvinna'], ['K.', 'kvinna'], [' Kvinna ', 'kvinna'], ['kvinna', 'kvinna'], ['KVINNA', 'kvinna'],
        ['Kv', 'kvinna'], ['KV', 'kvinna'], ['Kv.', 'kvinna'], ['Kvinnor', 'kvinna'], ['Kvinnor.', 'kvinna'], ['kvinnor', 'kvinna'],
        ['F', 'kvinna'], ['f', 'kvinna'], ['Female', 'kvinna'], ['Female ', 'kvinna'], ['FEMALE', 'kvinna'],
        ['W', 'kvinna'], ['w', 'kvinna'], ['Woman', 'kvinna'], [' woman ', 'kvinna'],
        ['M', 'man'], ['M.', 'man'], ['Ma', 'man'], ['MA', 'man'], ['Man', 'man'], [' man ', 'man'],
        ['Män', 'man'], ['MÄN', 'man'], ['Male', 'man'], [' Male ', 'man'],
        // Siffervärden mappas inte (systemspecifik kodning, gissa inte); övrigt returneras normaliserat
        // (gemener, utan skiljetecken).
        ['1', ''], ['2', ''], ['x', 'x'], ['X', 'x'], ['', ''], [null, ''], [undefined, ''],
    ])('kön %o → %o', (raw, forvantat) => {
        expect(_normaliseraKon(raw)).toBe(forvantat);
    });
    it.each([
        // BAS-prefixet strippas så att intervallet inte splittras; utan separator ("BASA") eller ensamt lämnas det.
        ['A', 'A'], ['2', '2'], ['BAS A', 'A'], ['bas-2', '2'], ['bas: d', 'D'], ['Bas: C', 'C'], [' b ', 'B'], [' c ', 'C'],
        ['Bas  E', 'E'], ['BASA', 'BASA'], ['BAS', 'BAS'],
        ['BAS-', 'BAS-'],                  // överraskning: prefixet utan värde lämnas orört
        // HTML-meta-tecknen strippas (defense-in-depth vid inläsning): en BAS-kolumn ska inte kunna bära
        // attribut-utbrytning vidare. Ordet "script" blir kvar.
        ['A<script>', 'ASCRIPT'], ['<script>', 'SCRIPT'], ['A" onmouseover="alert(1)', 'A ONMOUSEOVER=ALERT(1)'], ['A"b', 'AB'], ["B'", 'B'],
        ['', ''], [null, ''], [undefined, ''],
    ])('BAS %o → %o', (raw, forvantat) => {
        expect(_normaliseraBas(raw)).toBe(forvantat);
    });
    it('AID i ställningstagandet: sifferprefixet, annars den rensade strängen', () => {
        expect(_normaliseraPolicyAid('207 Förskollärare')).toBe('207');
        expect(_normaliseraPolicyAid(' <Ledning> ')).toBe('Ledning');
        expect(_normaliseraPolicyAid('')).toBe('');
    });
});

describe('[B9.5] inlasning: yrke (_stadaYrkesfalt)', () => {
    it.each([
        ['101010 Ledning', '101010 Ledning'],
        ['203010 Förskollärare', '203010 Förskollärare'],
        ['101010 — Ledning', '101010 Ledning'],
        ['101010', '101010'],
        ['Ledning', 'Ledning'],
        ['101010 Lärare grundskola', '101010 Lärare grundskola'],
        // Ingenting maskeras (ADR-85): namn behålls som de står, och inläsningen varnar i stället.
        ['101010 Anna Andersson', '101010 Anna Andersson'],
        ['5301 Anna Andersson', '5301 Anna Andersson'],
        ['5301 Örjan Östberg', '5301 Örjan Östberg'],
        ['101010 ANDERSSON, ANNA', '101010 ANDERSSON, ANNA'],
        ['101010 Andersson, Anna', '101010 Andersson, Anna'],
        ['101010 anna andersson', '101010 anna andersson'],
        ['101010 ANDERSSON, Anna', '101010 ANDERSSON, Anna'],
        // HTML-tecknen rensas.
        ['101010 <Anna> <Andersson>', '101010 Anna Andersson'],
        ['101010 <Ledning> & "Chef"', '101010 Ledning  Chef'],
        ['101010 Lärare <b>&\'"', '101010 Lärare b'],
        ['5301 <script>x</script>', '5301 scriptx/script'],
        // Kortningen klipper etiketten vid 40 tecken, också mitt i ett ord.
        ['101010 Ledarskapsutveckling och personalansvar i organisationen', '101010 Ledarskapsutveckling och personalansvar…'],
        ['101010 Ledarskapsutveckling och personal Anna Andersson', '101010 Ledarskapsutveckling och personal Anna A…'],
        ['5301 ' + 'a'.repeat(60), '5301 ' + 'a'.repeat(40) + '…'],
        // Ingenting maskeras (ADR-85): etiketter med versal på två ord kommer ut oförändrade.
        ['101010 Sjuksköterska Natt', '101010 Sjuksköterska Natt'],
        ['101010 Lärare Grundskola', '101010 Lärare Grundskola'],
        // Riktiga etiketter som råkar ha komma, bindestreck eller versal i förkortning ändras inte.
        ['101010 Chef, enhet', '101010 Chef, enhet'],
        ['101010 Sjuksköterska', '101010 Sjuksköterska'],
        ['101010 IT-tekniker', '101010 IT-tekniker'],
        ['101010 Ledning, övergripande', '101010 Ledning, övergripande'],
        ['', ''], [null, ''], [undefined, ''], ['   ', ''],
    ])('%o → %o', (raw, forvantat) => {
        expect(_stadaYrkesfalt(raw)).toBe(forvantat);
    });
    // Genomgång av hela etikettlistan: ingen riktig etikett ändras, utom av 40-teckensgränsen.
    it('ingen av de AID-etiketter som verktyget känner till ändras, utom av 40-teckensgränsen', () => {
        const andrade = [];
        for (const [kod, namn] of aidEtikettlista().etiketter) {
            const forvantat = namn.length > 40 ? namn.substring(0, 40).trim() + '…' : namn;
            const ut = _stadaYrkesfalt(kod + ' ' + namn);
            if (ut !== kod + ' ' + forvantat) andrade.push(`${kod} ${namn} → ${ut}`);
        }
        expect(andrade).toEqual([]);
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

    it('mönstren bär inget tillstånd, och etiketten skiljs ut som i _stadaYrkesfalt', () => {
        expect(YRKE_NAMNMONSTER).toHaveLength(2);
        for (const re of YRKE_NAMNMONSTER) expect(re.flags).toBe('');   // utan /g: test() bär inget tillstånd mellan anropen
        // Båda tar etiketten ur samma hjälpfunktion.
        for (const f of [_stadaYrkesfalt, yrkeNamnNyckel]) expect(f.toString()).toContain('_yrkeEtikett(s)');
    });

    it('nyckeln: etikettexten i gemener med blanksteg samman, tom utan namnmönster', () => {
        expect(yrkeNamnNyckel('101010 Sjuksköterska  Anna   Andersson')).toBe('sjuksköterska anna andersson');
        expect(yrkeNamnNyckel('101010 — ANDERSSON, ANNA')).toBe('andersson, anna');
        expect(yrkeNamnNyckel('101010 Lärare grundskola')).toBe('');
        expect(yrkeNamnNyckel('')).toBe('');
        expect(yrkeNamnNyckel(null)).toBe('');
    });

    it('prövas på råvärdet: ett namn efter kortningsgränsen på 40 tecken räknas också', () => {
        expect(_stadaYrkesfalt('101010 Sjuksköterska Anna Andersson')).toBe('101010 Sjuksköterska Anna Andersson');
        expect(yrkeLiknarNamn('101010 Sjuksköterska Anna Andersson')).toBe(true);
        const lang = '101010 handläggare med särskilt ansvar för samordning Anna Andersson';
        expect(_stadaYrkesfalt(lang)).not.toMatch(/Anna|Andersson/);
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

describe('[B9.4] inlasning: en lönerad (tolkaLonerad)', () => {
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
        expect(hittaKansligaKolumner(rader).map(f => f.col)).toEqual(['Förnamn', 'Id', 'Kontakt', 'Person']);
        expect(hittaKansligaKolumner([])).toEqual([]);
    });
});

describe('hittaKansligaKolumner (PII-rubriker)', () => {
    // Rader vars värden inte själva utlöser värdekontrollen (ett ord, inte "Förnamn Efternamn").
    const rader = kol => Array.from({ length: 10 }, (_, i) => ({ BAS: 'C', [kol]: `V${i}` }));
    it('rubriken Förnamn avvisas, med och utan ö', () => {
        for (const kol of ['Förnamn', 'Fornamn', 'FÖRNAMN', 'Förnamn ']) {
            const fel = hittaKansligaKolumner(rader(kol));
            expect(fel.map(f => f.col), kol).toEqual([kol]);
            expect(fel[0].reason).toMatch(/personnamn/);
        }
    });
    it('Efternamn, Namn och e-post känns igen även med svenska tecken i rubriken', () => {
        expect(hittaKansligaKolumner(rader('Efternamn')).map(f => f.reason)).toEqual(['Kolumnrubriken antyder personnamn']);
        expect(hittaKansligaKolumner(rader('Namn')).map(f => f.reason)).toEqual(['Kolumnrubriken antyder personnamn']);
        expect(hittaKansligaKolumner(rader('E-postadress')).map(f => f.reason)).toEqual(['Kolumnrubriken antyder e-postadress']);
    });
    it('vanliga rubriker avvisas inte', () => {
        for (const kol of ['BAS', 'Månadslön', 'Ålder', 'Kön', 'AID', 'Ansvarskod', 'Enhet', 'Benämning', 'Anställningsnummer',
                           'Sjukhus', 'Lönepolitik', 'Religionskunskap (ämne)', 'Fackområde']) {
            expect(hittaKansligaKolumner(rader(kol)), kol).toEqual([]);
        }
    });
    // Särskilda kategorier (dataskyddsförordningen art. 9): underlaget ska inte innehålla dem, och riskanalysen
    // säger att det inte gör det. Rubrikkontrollen gör påståendet sant i stället för antaget (lagrum.md, C23b).
    it('rubriker som antyder särskilda kategorier av personuppgifter avvisas', () => {
        for (const kol of ['Fackmedlemskap', 'Facklig tillhörighet', 'Fackförbund', 'Medlemskap', 'Hälsa', 'Hälsotillstånd',
                           'Sjukfrånvaro', 'Sjukskrivning', 'Sjukdom', 'Diagnos', 'Etnicitet', 'Etniskt ursprung', 'Religion',
                           'Trosuppfattning', 'Politisk tillhörighet', 'Sexuell läggning', 'Funktionsnedsättning',
                           'Genetisk', 'Biometri', 'HALSA', 'sexuell laggning']) {
            const fel = hittaKansligaKolumner(rader(kol));
            expect(fel.map(f => f.col), kol).toEqual([kol]);
            expect(fel[0].reason, kol).toMatch(/särskild kategori/);
        }
    });
});

describe('hittaKansligaKolumner (värdena)', () => {
    // 300 rader; personnumren börjar på rad 200. De 50 första raderna är rena, så bara en sampling över hela filen
    // (var ⌈n/50⌉:e rad) hittar dem.
    const fil = (kol, varde) => Array.from({ length: 300 }, (_, i) => ({ BAS: 'C', Lön: String(30000 + i), [kol]: varde(i) }));
    it('personnummer som börjar på rad 200 hittas', () => {
        const fel = hittaKansligaKolumner(fil('Id', i => (i >= 200 ? `19800101-${1000 + i}` : `A${i}`)));
        expect(fel.map(f => f.col)).toEqual(['Id']);
        expect(fel[0].reason).toMatch(/personnummer/);
    });
    it('samplingen täcker hela filen: e-post bara i slutet hittas', () => {
        const fel = hittaKansligaKolumner(fil('Kontakt', i => (i >= 250 ? `p${i}@exempel.se` : '')));
        expect(fel.map(f => f.reason)).toEqual([expect.stringMatching(/e-post/)]);
    });
    const namn = ['Anna Andersson', 'Bo Berg', 'Cecilia Carlsson', 'David Dahl', 'Eva Ek', 'Fredrik Falk'];
    const tio = (kol, f) => Array.from({ length: 12 }, (_, i) => ({ BAS: 'C', [kol]: f(namn[i % namn.length]) }));
    it('namn med versaler, gemener och efternamn först med komma känns igen', () => {
        const omvand = n => n.split(' ').reverse().join(', ');
        for (const [etikett, f] of [['Versaler', n => n.toUpperCase()], ['Gemener', n => n.toLowerCase()],
            ['Komma', omvand], ['Komma versaler', n => omvand(n).toUpperCase()], ['Komma utan mellanslag', n => omvand(n).replace(' ', '')]]) {
            const fel = hittaKansligaKolumner(tio('Person', f));
            expect(fel.map(x => x.reason), etikett).toEqual([expect.stringMatching(/personnamn/)]);
        }
    });
    it('befattningar med stor bokstav bara först räknas inte som namn', () => {
        const titlar = ['Lärare grundskola', 'Undersköterska hemtjänst', 'Lärare fritidshem', 'Administratör ekonomi', 'Kock storkök'];
        expect(hittaKansligaKolumner(Array.from({ length: 50 }, (_, i) => ({ BAS: 'C', Befattning: titlar[i % 5] })))).toEqual([]);
    });
});

// ---- Filtexten: avgränsare, teckenkodning, filformat och rubrikrad ----
const win1252 = (str) => new Uint8Array([...str].map(c => c.charCodeAt(0))).buffer;  // codepoint<256
const utf8 = (str) => new TextEncoder().encode(str).buffer;

describe('_gissaAvgransare', () => {
    it('detekterar semikolon, komma och tab', () => {
        expect(_gissaAvgransare('A;B;C\n1;2;3')).toBe(';');
        expect(_gissaAvgransare('A,B,C\n1,2,3')).toBe(',');
        expect(_gissaAvgransare('A\tB\tC')).toBe('\t');
    });
    it('faller tillbaka på ; när ingen avgränsare hittas', () => {
        expect(_gissaAvgransare('EnEndaKolumn')).toBe(';');
    });
});

describe('_avkodaCsv (teckenkodning)', () => {
    it('läser UTF-8 korrekt', () => {
        const d = _avkodaCsv(utf8('Lön;Ålder;Kön'));
        expect(d.encoding).toBe('UTF-8');
        expect(d.text).toBe('Lön;Ålder;Kön');
    });
    it('faller tillbaka på Windows-1252 vid ogiltig UTF-8 (Excel-CSV)', () => {
        const d = _avkodaCsv(win1252('Lön;Ålder;Kön'));
        expect(d.encoding).toBe('Windows-1252');
        expect(d.text).toBe('Lön;Ålder;Kön');   // å/ä/ö intakt — ingen mojibake
    });
    it('hanterar UTF-8 BOM', () => {
        const withBom = new Uint8Array([0xEF, 0xBB, 0xBF, ...new TextEncoder().encode('AID;Poäng')]).buffer;
        const d = _avkodaCsv(withBom);
        expect(d.encoding).toBe('UTF-8 (BOM)');
        expect(d.text).toBe('AID;Poäng');
    });
    it('läser UTF-16 LE med BOM (Excels "Unicode-text")', () => {
        const codes = [0xFF, 0xFE];
        for (const ch of 'Lön\tÅlder\tKön') { const c = ch.charCodeAt(0); codes.push(c & 0xFF, c >> 8); }
        const d = _avkodaCsv(new Uint8Array(codes).buffer);
        expect(d.encoding).toBe('UTF-16 LE');
        expect(d.text).toBe('Lön\tÅlder\tKön');   // ingen NUL-interfoliering, BOM struken
    });
});

describe('_gissaTabellformat (magiska bytes)', () => {
    it('identifierar XLSX (ZIP), legacy XLS (OLE2) och text', () => {
        expect(_gissaTabellformat(new Uint8Array([0x50, 0x4B, 0x03, 0x04, 0]))).toBe('xlsx');
        expect(_gissaTabellformat(new Uint8Array([0xD0, 0xCF, 0x11, 0xE0, 0xA1]))).toBe('xls-legacy');
        expect(_gissaTabellformat(new TextEncoder().encode('BAS;Lön;Kön'))).toBe('text');
        expect(_gissaTabellformat(new Uint8Array([0xEF, 0xBB, 0xBF, 0x42]))).toBe('text');  // UTF-8 BOM = text
    });
});

describe('bladetsSlut (Excelbladets verkliga område)', () => {
    it('sista raden och kolumnen med värde; blanka celler och nycklar med ! räknas inte', () => {
        expect(bladetsSlut({ '!ref': 'A1:XFD1048576', A1: { v: 'BAS' }, E3: { v: 30000 }, AA2: { v: '' }, XFD1048576: { v: ' ' } }))
            .toEqual({ r: 2, c: 4 });
        expect(bladetsSlut({ AB10: { v: 0 } })).toEqual({ r: 9, c: 27 });
        expect(bladetsSlut({ '!ref': 'A1:C3' })).toBeNull();
    });
});

describe('_hittaCsvRubrik (rubrikrad + preamble-tolerans)', () => {
    const GROUPS = [['bas', 'basintervall'], ['mnadsln', 'lon', 'ln'], ['kon', 'kn'], ['lder', 'alder']];
    it('hittar rubrikraden på rad 0 utan preamble', () => {
        const h = _hittaCsvRubrik('BAS;Månadslön;Kön;Ålder\nA;30000;Kvinna;45', GROUPS);
        expect(h.line).toBe(0);
        expect(h.delim).toBe(';');
    });
    it('hoppar över försättsrader från exportverktyg', () => {
        const text = 'Rapport uttagen 2026-01-15;;;\nOrganisation: Testorganisationen;;;\n\nBAS;Månadslön;Kön;Ålder\nA;30000;Kvinna;45';
        const h = _hittaCsvRubrik(text, GROUPS);
        expect(h.line).toBe(3);
        expect(h.delim).toBe(';');
    });
    it('detekterar avgränsare per rubrikrad (komma)', () => {
        const h = _hittaCsvRubrik('Preamble utan struktur\nBAS,Lön,Kön\nA,30000,K', GROUPS);
        expect(h.line).toBe(1);
        expect(h.delim).toBe(',');
    });
    it('utan träffar: rad 0 och avgränsaren ur första raden', () => {
        const h = _hittaCsvRubrik('X;Y;Z\n1;2;3', GROUPS);
        expect(h.line).toBe(0);
        expect(h.delim).toBe(';');
    });
});

// ---- Kolumnvalet: vilken rubrik som bär vilket fält ----
// `val` är det appens adaptrar skickar ur tillståndet: kolumnmappningen och importprofilen.
describe('hamtaFalt (kolumnmatchning + manuell mappning)', () => {
    it('matchar kolumn via mönster', () => {
        const row = { 'Ansvar': '100000', 'BAS-intervall': 'C', 'Månadslön': '30000' };
        expect(vardeForRoll(row, ['mnadsln', 'lon', 'ln'], 'lon')).toBe('30000');
        expect(vardeForRoll(row, ['bas', 'basintervall'], 'bas')).toBe('C');
    });
    it('manuell columnMap vinner över auto-matchning', () => {
        const row = { 'Lönenivå': 'D', 'Lön': '31000' };
        expect(vardeForRoll(row, ['bas'], 'bas', { columnMap: { bas: 'Lönenivå' } })).toBe('D');
    });
    it('importprofilen före namnet, och en vald rubrik som filen saknar gäller inte', () => {
        const rubriker = ['Lön', 'Grundlön'];
        expect(_rubrikForRoll(rubriker, ['lon', 'ln'], 'lon', { importprofil: { mappning: { lon: 'Grundlön' } } })).toBe('Grundlön');
        expect(_rubrikForRoll(rubriker, ['lon', 'ln'], 'lon', { columnMap: { lon: 'Saknas' }, importprofil: { mappning: { lon: 'Saknas' } } })).toBe('Lön');
        expect(_rubrikForRoll(rubriker, ['bas'], 'bas')).toBeUndefined();
    });
});

describe('gissaKolumnmappning', () => {
    it('känner igen standardrubriker', () => {
        const m = gissaKolumnmappning(['Ansvar', 'BAS-intervall', 'AID', 'Månadslön', 'Ålder', 'Kön']);
        expect(m.bas).toBe('BAS-intervall');
        expect(m.lon).toBe('Månadslön');
        expect(m.kon).toBe('Kön');
        expect(m.yrke).toBe('AID');
    });
    it('lämnar omatchade roller null', () => {
        const m = gissaKolumnmappning(['Kostnadsställe', 'Befattning']);
        expect(m.bas).toBeNull();
        expect(m.yrke).toBe('Befattning');
    });
});

// En lönerad som inläsningen ser den: rubrikerna slås upp på radens nycklar utan kolumnmappning, och referensåret är 2026.
const minimera = (row, ansvarKolumn = null) => minimeraRad(row, lonefilensRubriker(Object.keys(row)), ansvarKolumn, 2026);

describe('inläsning: kolumnvalet', () => {
    // "Lön" rensas till "ln", och "Lönetillägg" till "lnetillgg", som också innehåller "ln".
    const rubriker = ['Lönetillägg', 'Kön', 'BAS', 'Lön'];
    it('en rubrik som är exakt lika sökordet går före en som bara innehåller det', () => {
        expect(gissaKolumnmappning(rubriker).lon).toBe('Lön');
        const row = { 'Lönetillägg': '500', 'Kön': 'Kvinna', 'BAS': 'A', 'Lön': '30000' };
        expect(vardeForRoll(row, ['mnadsln', 'lon', 'ln'], 'lon')).toBe('30000');
        expect(minimera(row).lon).toBe(30000);
    });
    it('delsträngen gäller när ingen rubrik är exakt lika, och sökordens ordning står sig', () => {
        expect(gissaKolumnmappning(['Lönetillägg', 'Kön']).lon).toBe('Lönetillägg');
        expect(gissaKolumnmappning(['Lön', 'Månadslön']).lon).toBe('Månadslön');
    });
    it('en exakt rubrik för ett senare sökord går före en delsträng för ett tidigare, och annars den kortaste', () => {
        expect(gissaKolumnmappning(['Kontor', 'Kön']).kon).toBe('Kön');
        expect(gissaKolumnmappning(['Basenhet', 'BAS-intervall']).bas).toBe('BAS-intervall');
        expect(gissaKolumnmappning(['Anställningsålder', 'Ålder (år)']).alder).toBe('Ålder (år)');
        expect(gissaKolumnmappning(['Lönetillägg', 'Grundlön']).lon).toBe('Grundlön');
    });
    it('yrkets sökord är en prioritetsordning: AID-etikett går före en rubrik som bara heter AID', () => {
        expect(gissaKolumnmappning(['AID', 'AID-etikett']).yrke).toBe('AID-etikett');
    });
});

describe('_normaliseraBas + minimeraLonerad', () => {
    it('vanlig ålder påverkas inte av födelseårsheuristiken', () => {
        const rec = minimera({ 'BAS': 'A', 'Månadslön': '30000', 'Ålder': '45', 'Kön': 'Man', 'AID': '5301' });
        expect(rec.alder).toBe(45);
        expect(rec._alderStatus).toBe('ok');
    });
    it('full rad med K/M-kön och BAS-prefix normaliseras', () => {
        const rec = minimera({ 'BAS-intervall': 'BAS B', 'Månadslön': '32.500,50', 'Ålder': '38', 'Kön': 'K', 'AID': '203010 Förskollärare' });
        expect(rec.bas).toBe('B');
        expect(rec.kon).toBe('kvinna');
        expect(rec.lon).toBe(32500.5);
    });
    it('valfri Poäng-kolumn i strukturdatan läses som arbetsvärderingspoäng', () => {
        const med = minimera({ 'BAS': 'A', 'Månadslön': '30000', 'Ålder': '45', 'Kön': 'Kvinna', 'AID': '5301', 'Poäng': '342,5' });
        expect(med.poang).toBe(342.5);
        const utan = minimera({ 'BAS': 'A', 'Månadslön': '30000', 'Ålder': '45', 'Kön': 'Man', 'AID': '5301' });
        expect(utan.poang).toBeNull();
        const arbv = minimera({ 'BAS': 'A', 'Månadslön': '30000', 'Ålder': '45', 'Kön': 'Man', 'AID': '5301', 'Arbetsvärdering': '410' });
        expect(arbv.poang).toBe(410);
    });
});

// ---- Lönefil utan ålderskolumn (ADR-64): ålder är valfri ----
describe('inläsning: lönefil utan ålderskolumn', () => {
    it('minimeraLonerad: utan kolumnen blir åldern 0, inget fel', () => {
        const rec = minimera({ BAS: 'C', AID: '207011 Handläggare', 'Månadslön': '31000', 'Kön': 'Kvinna' });
        expect(rec).toMatchObject({ bas: 'C', lon: 31000, kon: 'kvinna', alder: 0, _alderStatus: 'empty' });
    });
});

describe('inläsning: AID:s ansvarskod', () => {
    const rad = extra => ({ 'BAS': 'C', 'Månadslön': '30000', 'Ålder': '40', 'Kön': 'Kvinna', 'AID': '207011', ...extra });
    it('yrkeskolumnen blir AID även när AID-ansvar står före den', () => {
        const map = gissaKolumnmappning(['AID-ansvar', 'AID', 'BAS', 'Månadslön', 'Ålder', 'Kön']);
        expect(map.yrke).toBe('AID');
        const rec = minimera({ 'AID-ansvar': 'C', ...rad() });
        expect(rec.aid).toBe('207011');
    });
    it('kolumnen Ansvar (kostnadsställe) blir aldrig ansvarskod', () => {
        expect(hittaAnsvarKolumn(['Ansvar', 'AID', 'BAS'])).toBeNull();
        expect(hittaAnsvarKolumn(['Ansvar', 'Ansvarskod', 'AID'])).toBe('Ansvarskod');
        const rec = minimera(rad({ 'Ansvar': '10000123' }));
        expect(rec.ansvarskoder).toBeNull();
        expect(rec.ansvarsgrupp).toBeNull();
    });
    it('kolumnmappningen och importprofilen väljer kolumnen; "— ingen —" väljer bort den', () => {
        const rubriker = ['Ansvarskod', 'Kod2', 'AID'];
        expect(hittaAnsvarKolumn(rubriker, { columnMap: { ansvar: 'Kod2' } })).toBe('Kod2');
        expect(hittaAnsvarKolumn(rubriker, { importprofil: { mappning: { ansvar: 'Kod2' } } })).toBe('Kod2');
        expect(hittaAnsvarKolumn(rubriker, { columnMap: { ansvar: '' }, importprofil: { mappning: { ansvar: 'Kod2' } } })).toBeNull();
    });
    it('med godkänd kolumn får raderna koder och ansvarsgrupp', () => {
        const kol = { namn: 'Ansvarskod' };
        expect(minimera(rad({ 'Ansvarskod': 'C1' }), kol)).toMatchObject({ ansvarskoder: ['C'], ansvarsgrupp: 'ledning' });
        expect(minimera(rad({ 'Ansvarskod': '1002' }), kol)).toMatchObject({ ansvarskoder: ['1002'], ansvarsgrupp: 'uppdrag' });
        expect(minimera(rad({ 'Ansvarskod': '' }), kol)).toMatchObject({ ansvarskoder: [], ansvarsgrupp: 'inget' });
        expect(minimera(rad({ 'Ansvarskod': 'X' }), kol)).toMatchObject({ ansvarskoder: [], ansvarsgrupp: 'inget' });
    });
    it('minst 95 % giltiga värden krävs', () => {
        const giltig = Array.from({ length: 20 }, (_, i) => (i % 3 ? 'C' : ''));
        expect(_bedomAnsvarKolumn('Ansvarskod', giltig)).toMatchObject({ namn: 'Ansvarskod', godkand: true });
        const underkand = _bedomAnsvarKolumn('Ansvarskod', [...Array(17).fill('F'), 'X', 'Y', 'Z']);
        expect(underkand.godkand).toBe(false);
        expect(underkand.giltiga).toBeCloseTo(0.85, 6);
        expect(_bedomAnsvarKolumn('Ansvarskod', ['', '']).godkand).toBe(false);
    });
});

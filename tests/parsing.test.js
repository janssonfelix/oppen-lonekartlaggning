/**
 * Tester för CSV-parsningslagret i app.js (teckenkodning, avgränsare,
 * kolumnmatchning, fältsanering). Funktionerna lever i app.js (classic script
 * för file://-bygget) och extraheras därför direkt ur källan och körs i Node —
 * samma mönster som drift.test.js. Skyddar bl.a. GDPR-namnmaskeringens regex
 * och #2-teckenkodningsdetekteringen.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { arAnsvarskodRubrik, tolkaAnsvarskod, ansvarsgrupp, andelGiltiga } from '../src/lib/ansvar.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const appSrc = readFileSync(join(__dirname, '..', 'dist', 'app.js'), 'utf8');

function balancedFrom(src, startIdx) {
    let depth = 0, seen = false;
    for (let j = src.indexOf('{', startIdx); j < src.length; j++) {
        const c = src[j];
        if (c === '{') { depth++; seen = true; }
        else if (c === '}') { depth--; if (seen && depth === 0) return j; }
    }
    throw new Error('obalanserade klamrar från ' + startIdx);
}
function extractFn(name) {
    const start = appSrc.indexOf('function ' + name + '(');
    if (start < 0) throw new Error('hittade ej function ' + name);
    return appSrc.slice(start, balancedFrom(appSrc, start) + 1);
}
function extractConst(name) {
    const start = appSrc.indexOf('const ' + name + ' = {');
    if (start < 0) throw new Error('hittade ej const ' + name);
    return appSrc.slice(start, balancedFrom(appSrc, start) + 1) + ';';
}

// esc är en enradig arrow vars stränglitteraler innehåller ';' (t.ex. "&amp;"),
// så vi tar hela raden i stället för att balansera/klippa vid semikolon.
function extractLine(prefix) {
    const start = appSrc.indexOf(prefix);
    if (start < 0) throw new Error('hittade ej ' + prefix);
    const end = appSrc.indexOf('\n', start);
    return appSrc.slice(start, end);
}

const P = new Function('_anArRubrik', '_anTolka', '_anGrupp', '_anAndelGiltiga', `
    const state = { columnMap: null, ansvarKolumn: null };
    ${extractConst('ALLOWED_FIELDS')}
    ${extractLine('const esc =')}
    ${extractLine('const _RADSLUT =')}
    ${extractFn('getField')}
    ${extractFn('autoDetectColumnMap')}
    ${extractFn('_detectDelimiter')}
    ${extractFn('_decodeCsvBuffer')}
    ${extractFn('_cleanYrkeField')}
    ${extractFn('_normalizeNumberString')}
    ${extractFn('parseNumber')}
    ${extractFn('parseNumberStrict')}
    ${extractFn('_sniffTabularFormat')}
    ${extractFn('_findCsvHeader')}
    ${extractFn('_normalizeKon')}
    ${extractFn('_stripHtmlMeta')}
    ${extractFn('_normalizeBas')}
    ${extractFn('extractMinimalRecord')}
    ${extractFn('_hittaAnsvarKolumn')}
    ${extractFn('_bedomAnsvarKolumn')}
    ${extractFn('detectSensitiveColumns')}
    return { state, detectSensitiveColumns, esc, getField, autoDetectColumnMap, _detectDelimiter, _decodeCsvBuffer, _cleanYrkeField,
             _normalizeNumberString, parseNumber, parseNumberStrict, _sniffTabularFormat,
             _findCsvHeader, _normalizeKon, _normalizeBas, extractMinimalRecord, _hittaAnsvarKolumn, _bedomAnsvarKolumn };
`)(arAnsvarskodRubrik, tolkaAnsvarskod, ansvarsgrupp, andelGiltiga);

// ---------------------------------------------------------------------------
// Sandboxen ovan plockar ut ENSKILDA funktioner ur app.js med extractFn(). Får en
// av dem ett NYTT beroende — t.ex. en funktion speglad från src/lib/ — syns det annars
// först som ett kryptiskt "X is not defined" djupt nere i ett orelaterat test.
// Det här testet körs först och översätter felet till en åtgärd.
describe('testsandbox: nya beroenden i parsern ger ett begripligt fel', () => {
    it('extractMinimalRecord kan köras med de funktioner sandboxen exponerar', () => {
        try {
            P.extractMinimalRecord({ 'BAS': 'A', 'Månadslön': '30000', 'Ålder': '45', 'Kön': 'Kvinna', 'AID': '5301' });
        } catch (e) {
            if (e instanceof ReferenceError) {
                const namn = String(e.message).replace(/ is not defined[\s\S]*/, '').trim();
                throw new Error(
                    `Parsern har fått ett nytt beroende: "${namn}" finns inte i testsandboxen.\n` +
                    `Lägg till det i new Function(...)-listan ovan med \${extractFn('<källnamn>')}.\n` +
                    `OBS: är "${namn}" ett spegelnamn från src/lib/ (t.ex. _xxYyy) heter källfunktionen ` +
                    `något annat i src/lib/ — extrahera källnamnet och aliasa: const ${namn} = <källnamn>;`
                );
            }
            throw e;
        }
    });
});

const win1252 = (str) => new Uint8Array([...str].map(c => c.charCodeAt(0))).buffer;  // codepoint<256
const utf8 = (str) => new TextEncoder().encode(str).buffer;

describe('_detectDelimiter', () => {
    it('detekterar semikolon, komma och tab', () => {
        expect(P._detectDelimiter('A;B;C\n1;2;3')).toBe(';');
        expect(P._detectDelimiter('A,B,C\n1,2,3')).toBe(',');
        expect(P._detectDelimiter('A\tB\tC')).toBe('\t');
    });
    it('faller tillbaka på ; när ingen avgränsare hittas', () => {
        expect(P._detectDelimiter('EnEndaKolumn')).toBe(';');
    });
});

describe('_decodeCsvBuffer (teckenkodning)', () => {
    it('läser UTF-8 korrekt', () => {
        const d = P._decodeCsvBuffer(utf8('Lön;Ålder;Kön'));
        expect(d.encoding).toBe('UTF-8');
        expect(d.text).toBe('Lön;Ålder;Kön');
    });
    it('faller tillbaka på Windows-1252 vid ogiltig UTF-8 (Excel-CSV)', () => {
        const d = P._decodeCsvBuffer(win1252('Lön;Ålder;Kön'));
        expect(d.encoding).toBe('Windows-1252');
        expect(d.text).toBe('Lön;Ålder;Kön');   // å/ä/ö intakt — ingen mojibake
    });
    it('hanterar UTF-8 BOM', () => {
        const withBom = new Uint8Array([0xEF, 0xBB, 0xBF, ...new TextEncoder().encode('AID;Poäng')]).buffer;
        const d = P._decodeCsvBuffer(withBom);
        expect(d.encoding).toBe('UTF-8 (BOM)');
        expect(d.text).toBe('AID;Poäng');
    });
});

describe('getField (kolumnmatchning + manuell mappning)', () => {
    it('matchar kolumn via mönster', () => {
        const row = { 'Ansvar': '100000', 'BAS-intervall': 'C', 'Månadslön': '30000' };
        expect(P.getField(row, P.state ? ['mnadsln', 'lon', 'ln'] : [], 'lon')).toBe('30000');
        expect(P.getField(row, ['bas', 'basintervall'], 'bas')).toBe('C');
    });
    it('manuell columnMap vinner över auto-matchning', () => {
        const row = { 'Lönenivå': 'D', 'Lön': '31000' };
        P.state.columnMap = { bas: 'Lönenivå' };
        expect(P.getField(row, ['bas'], 'bas')).toBe('D');
        P.state.columnMap = null;
    });
});

describe('autoDetectColumnMap', () => {
    it('känner igen standardrubriker', () => {
        const m = P.autoDetectColumnMap(['Ansvar', 'BAS-intervall', 'AID', 'Månadslön', 'Ålder', 'Kön']);
        expect(m.bas).toBe('BAS-intervall');
        expect(m.lon).toBe('Månadslön');
        expect(m.kon).toBe('Kön');
        expect(m.yrke).toBe('AID');
    });
    it('lämnar omatchade roller null', () => {
        const m = P.autoDetectColumnMap(['Kostnadsställe', 'Befattning']);
        expect(m.bas).toBeNull();
        expect(m.yrke).toBe('Befattning');
    });
});

describe('_normalizeNumberString + parseNumber (tusentals-/decimalheuristik)', () => {
    it('svenskt format: mellanslag-tusental + komma-decimal', () => {
        expect(P.parseNumber('32 500')).toBe(32500);
        expect(P.parseNumber('32 500,50')).toBe(32500.5);
        expect(P.parseNumber('32500,50')).toBe(32500.5);
    });
    it('tyskt/Excel-format: punkt-tusental + komma-decimal', () => {
        expect(P.parseNumber('32.500,50')).toBe(32500.5);
        expect(P.parseNumber('1.234.567,89')).toBe(1234567.89);
    });
    it('engelskt format: komma-tusental + punkt-decimal', () => {
        expect(P.parseNumber('32,500')).toBe(32500);        // var: 32.5
        expect(P.parseNumber('1,234,567.89')).toBe(1234567.89);
    });
    it('ensam separator med 1–2 decimaler är decimal', () => {
        expect(P.parseNumber('32,5')).toBe(32.5);
        expect(P.parseNumber('32.5')).toBe(32.5);
        expect(P.parseNumber('0,5')).toBe(0.5);
    });
    it('punkt-tusental utan decimaler', () => {
        expect(P.parseNumber('32.500')).toBe(32500);
        expect(P.parseNumber('1.500')).toBe(1500);
    });
    it('valutasuffix och NBSP-tusental strippas', () => {
        expect(P.parseNumber('32 500 kr')).toBe(32500);   // NBSP som tusental
        expect(P.parseNumber('32500:-')).toBe(32500);
    });
    it('heltalsdel "0" tvingar decimaltolkning', () => {
        expect(P.parseNumber('0,500')).toBe(0.5);
    });
    it('parseNumberStrict: graderingen bevarad', () => {
        expect(P.parseNumberStrict('').status).toBe('empty');
        expect(P.parseNumberStrict('saknas').status).toBe('invalid');
        expect(P.parseNumberStrict('32.500,50')).toMatchObject({ status: 'ok', value: 32500.5 });
    });
});

describe('_decodeCsvBuffer (UTF-16)', () => {
    const utf16le = (str) => {
        const codes = [0xFF, 0xFE];
        for (const ch of str) { const c = ch.charCodeAt(0); codes.push(c & 0xFF, c >> 8); }
        return new Uint8Array(codes).buffer;
    };
    it('läser UTF-16 LE med BOM (Excels "Unicode-text")', () => {
        const d = P._decodeCsvBuffer(utf16le('Lön\tÅlder\tKön'));
        expect(d.encoding).toBe('UTF-16 LE');
        expect(d.text).toBe('Lön\tÅlder\tKön');   // ingen NUL-interfoliering, BOM struken
    });
});

describe('_sniffTabularFormat (magiska bytes)', () => {
    it('identifierar XLSX (ZIP), legacy XLS (OLE2) och text', () => {
        expect(P._sniffTabularFormat(new Uint8Array([0x50, 0x4B, 0x03, 0x04, 0]))).toBe('xlsx');
        expect(P._sniffTabularFormat(new Uint8Array([0xD0, 0xCF, 0x11, 0xE0, 0xA1]))).toBe('xls-legacy');
        expect(P._sniffTabularFormat(new TextEncoder().encode('BAS;Lön;Kön'))).toBe('text');
        expect(P._sniffTabularFormat(new Uint8Array([0xEF, 0xBB, 0xBF, 0x42]))).toBe('text');  // UTF-8 BOM = text
    });
});

describe('_findCsvHeader (rubrikrad + preamble-tolerans)', () => {
    const GROUPS = [['bas', 'basintervall'], ['mnadsln', 'lon', 'ln'], ['kon', 'kn'], ['lder', 'alder']];
    it('hittar rubrikraden på rad 0 utan preamble', () => {
        const h = P._findCsvHeader('BAS;Månadslön;Kön;Ålder\nA;30000;Kvinna;45', GROUPS);
        expect(h.line).toBe(0);
        expect(h.delim).toBe(';');
    });
    it('hoppar över försättsrader från exportverktyg', () => {
        const text = 'Rapport uttagen 2026-01-15;;;\nOrganisation: Testorganisationen;;;\n\nBAS;Månadslön;Kön;Ålder\nA;30000;Kvinna;45';
        const h = P._findCsvHeader(text, GROUPS);
        expect(h.line).toBe(3);
        expect(h.delim).toBe(';');
    });
    it('detekterar avgränsare per rubrikrad (komma)', () => {
        const h = P._findCsvHeader('Preamble utan struktur\nBAS,Lön,Kön\nA,30000,K', GROUPS);
        expect(h.line).toBe(1);
        expect(h.delim).toBe(',');
    });
    it('utan träffar: rad 0 och avgränsaren ur första raden', () => {
        const h = P._findCsvHeader('X;Y;Z\n1;2;3', GROUPS);
        expect(h.line).toBe(0);
        expect(h.delim).toBe(';');
    });
});

describe('_normalizeKon (kön-värden från olika system)', () => {
    it('mappar förkortningar och engelska värden', () => {
        expect(P._normalizeKon('K')).toBe('kvinna');
        expect(P._normalizeKon('Kv')).toBe('kvinna');
        expect(P._normalizeKon('F')).toBe('kvinna');
        expect(P._normalizeKon('Female')).toBe('kvinna');
        expect(P._normalizeKon('M')).toBe('man');
        expect(P._normalizeKon('Male')).toBe('man');
    });
    it('pluralformerna "Män" och "Kvinnor" mappas', () => {
        expect(P._normalizeKon('Män')).toBe('man');
        expect(P._normalizeKon('Man')).toBe('man');
        expect(P._normalizeKon('Kvinnor')).toBe('kvinna');
    });
    it('mappar INTE siffervärden (systemspecifik kodning — gissa inte)', () => {
        expect(P._normalizeKon('1')).toBe('');
        expect(P._normalizeKon('2')).toBe('');
    });
});

describe('_normalizeBas + extractMinimalRecord', () => {
    it('strippar BAS-prefix så intervall inte splittras', () => {
        expect(P._normalizeBas('BAS A')).toBe('A');
        expect(P._normalizeBas('bas-2')).toBe('2');
        expect(P._normalizeBas(' c ')).toBe('C');
        expect(P._normalizeBas('BASA')).toBe('BASA');   // inget separatortecken — orört
        expect(P._normalizeBas('BAS')).toBe('BAS');     // ensamt "BAS" lämnas
    });
    it('tolkar födelseår i ålderskolumnen som ålder', () => {
        const rec = P.extractMinimalRecord({ 'BAS': 'A', 'Månadslön': '30000', 'Ålder': '1980', 'Kön': 'Kvinna', 'AID': '5301' });
        const expectedAge = new Date().getFullYear() - 1980;
        expect(rec.alder).toBe(expectedAge);
        expect(rec._alderStatus).toBe('birthyear');
    });
    it('vanlig ålder påverkas inte av födelseårsheuristiken', () => {
        const rec = P.extractMinimalRecord({ 'BAS': 'A', 'Månadslön': '30000', 'Ålder': '45', 'Kön': 'Man', 'AID': '5301' });
        expect(rec.alder).toBe(45);
        expect(rec._alderStatus).toBe('ok');
    });
    it('full rad med K/M-kön och BAS-prefix normaliseras', () => {
        const rec = P.extractMinimalRecord({ 'BAS-intervall': 'BAS B', 'Månadslön': '32.500,50', 'Ålder': '38', 'Kön': 'K', 'AID': '203010 Förskollärare' });
        expect(rec.bas).toBe('B');
        expect(rec.kon).toBe('kvinna');
        expect(rec.lon).toBe(32500.5);
    });
    it('valfri Poäng-kolumn i strukturdatan läses som arbetsvärderingspoäng', () => {
        const med = P.extractMinimalRecord({ 'BAS': 'A', 'Månadslön': '30000', 'Ålder': '45', 'Kön': 'Kvinna', 'AID': '5301', 'Poäng': '342,5' });
        expect(med.poang).toBe(342.5);
        const utan = P.extractMinimalRecord({ 'BAS': 'A', 'Månadslön': '30000', 'Ålder': '45', 'Kön': 'Man', 'AID': '5301' });
        expect(utan.poang).toBeNull();
        const arbv = P.extractMinimalRecord({ 'BAS': 'A', 'Månadslön': '30000', 'Ålder': '45', 'Kön': 'Man', 'AID': '5301', 'Arbetsvärdering': '410' });
        expect(arbv.poang).toBe(410);
    });
});

describe('XSS-härdning: esc + _normalizeBas i attributkontext', () => {
    it('esc escapear < > & samt citattecken (säker i attributkontext)', () => {
        expect(P.esc('<b>')).toBe('&lt;b&gt;');
        expect(P.esc('a & b')).toBe('a &amp; b');
        // Citattecken måste escapeas så data-bas="${esc(x)}" inte kan brytas ut
        expect(P.esc('A" onmouseover="alert(1)')).toBe('A&quot; onmouseover=&quot;alert(1)');
        expect(P.esc("x' onx='y")).toBe('x&#39; onx=&#39;y');
        expect(P.esc(null)).toBe('');
        expect(P.esc(undefined)).toBe('');
    });
    it('_normalizeBas strippar HTML-meta-tecken (defense-in-depth vid inläsning)', () => {
        // En illvillig BAS-kolumn ska inte kunna bära attribut-utbrytning vidare.
        expect(P._normalizeBas('A" onmouseover="alert(1)')).toBe('A ONMOUSEOVER=ALERT(1)');
        expect(P._normalizeBas('<script>')).toBe('SCRIPT');
        expect(P._normalizeBas("B'")).toBe('B');
        // Normala BAS-värden påverkas inte
        expect(P._normalizeBas('BAS A')).toBe('A');
        expect(P._normalizeBas('2')).toBe('2');
    });
});

describe('detectSensitiveColumns (PII-rubriker)', () => {
    // Rader vars värden inte själva utlöser värdekontrollen (ett ord, inte "Förnamn Efternamn").
    const rader = kol => Array.from({ length: 10 }, (_, i) => ({ BAS: 'C', [kol]: `V${i}` }));
    it('rubriken Förnamn avvisas, med och utan ö (teknisk-plan §9 punkt 22 var en känd brist)', () => {
        for (const kol of ['Förnamn', 'Fornamn', 'FÖRNAMN', 'Förnamn ']) {
            const fel = P.detectSensitiveColumns(rader(kol));
            expect(fel.map(f => f.col), kol).toEqual([kol]);
            expect(fel[0].reason).toMatch(/personnamn/);
        }
    });
    it('Efternamn, Namn och e-post känns igen även med svenska tecken i rubriken', () => {
        expect(P.detectSensitiveColumns(rader('Efternamn')).map(f => f.reason)).toEqual(['Kolumnrubriken antyder personnamn']);
        expect(P.detectSensitiveColumns(rader('Namn')).map(f => f.reason)).toEqual(['Kolumnrubriken antyder personnamn']);
        expect(P.detectSensitiveColumns(rader('E-postadress')).map(f => f.reason)).toEqual(['Kolumnrubriken antyder e-postadress']);
    });
    it('vanliga rubriker avvisas inte', () => {
        for (const kol of ['BAS', 'Månadslön', 'Ålder', 'Kön', 'AID', 'Ansvarskod', 'Enhet', 'Benämning', 'Anställningsnummer']) {
            expect(P.detectSensitiveColumns(rader(kol)), kol).toEqual([]);
        }
    });
});

describe('_cleanYrkeField (GDPR-sanering)', () => {
    it('behåller AID + etikett', () => {
        expect(P._cleanYrkeField('203010 Förskollärare')).toBe('203010 Förskollärare');
    });
    it('maskerar namn (inkl. Å/Ä/Ö-initialer)', () => {
        expect(P._cleanYrkeField('5301 Anna Andersson')).toBe('5301 ***');
        expect(P._cleanYrkeField('5301 Örjan Östberg')).toBe('5301 ***');   // regressionsskydd för [A-ZÅÄÖ]
    });
    it('strippar HTML-/XSS-tecken', () => {
        expect(P._cleanYrkeField('5301 <script>x</script>')).not.toMatch(/[<>"'&]/);
    });
    it('trunkerar för långa etiketter', () => {
        const out = P._cleanYrkeField('5301 ' + 'a'.repeat(60));
        expect(out.length).toBeLessThan(55);
        expect(out.endsWith('…')).toBe(true);
    });
});


describe('inläsning: AID:s ansvarskod', () => {
    const rad = extra => ({ 'BAS': 'C', 'Månadslön': '30000', 'Ålder': '40', 'Kön': 'Kvinna', 'AID': '207011', ...extra });
    it('yrkeskolumnen blir AID även när AID-ansvar står före den', () => {
        const map = P.autoDetectColumnMap(['AID-ansvar', 'AID', 'BAS', 'Månadslön', 'Ålder', 'Kön']);
        expect(map.yrke).toBe('AID');
        const rec = P.extractMinimalRecord({ 'AID-ansvar': 'C', ...rad() });
        expect(rec.aid).toBe('207011');
    });
    it('kolumnen Ansvar (kostnadsställe) blir aldrig ansvarskod', () => {
        expect(P._hittaAnsvarKolumn(['Ansvar', 'AID', 'BAS'])).toBeNull();
        expect(P._hittaAnsvarKolumn(['Ansvar', 'Ansvarskod', 'AID'])).toBe('Ansvarskod');
        P.state.ansvarKolumn = null;
        const rec = P.extractMinimalRecord(rad({ 'Ansvar': '10000123' }));
        expect(rec.ansvarskoder).toBeNull();
        expect(rec.ansvarsgrupp).toBeNull();
    });
    it('med godkänd kolumn får raderna koder och ansvarsgrupp', () => {
        P.state.ansvarKolumn = { namn: 'Ansvarskod' };
        expect(P.extractMinimalRecord(rad({ 'Ansvarskod': 'C1' }))).toMatchObject({ ansvarskoder: ['C'], ansvarsgrupp: 'ledning' });
        expect(P.extractMinimalRecord(rad({ 'Ansvarskod': '1002' }))).toMatchObject({ ansvarskoder: ['1002'], ansvarsgrupp: 'uppdrag' });
        expect(P.extractMinimalRecord(rad({ 'Ansvarskod': '' }))).toMatchObject({ ansvarskoder: [], ansvarsgrupp: 'inget' });
        expect(P.extractMinimalRecord(rad({ 'Ansvarskod': 'X' }))).toMatchObject({ ansvarskoder: [], ansvarsgrupp: 'inget' });
        P.state.ansvarKolumn = null;
    });
    it('minst 95 % giltiga värden krävs', () => {
        const giltig = Array.from({ length: 20 }, (_, i) => (i % 3 ? 'C' : ''));
        expect(P._bedomAnsvarKolumn('Ansvarskod', giltig)).toMatchObject({ namn: 'Ansvarskod', godkand: true });
        const underkand = P._bedomAnsvarKolumn('Ansvarskod', [...Array(17).fill('F'), 'X', 'Y', 'Z']);
        expect(underkand.godkand).toBe(false);
        expect(underkand.giltiga).toBeCloseTo(0.85, 6);
        expect(P._bedomAnsvarKolumn('Ansvarskod', ['', '']).godkand).toBe(false);
    });
});

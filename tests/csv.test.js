/**
 * CSV- och urklippstexten med formelskydd (src/lib/csv.js, ADR-15), utan DOM.
 *
 * En textcell som börjar med = + - @ (eller tabb/CR) får ett inledande apostrof-tecken. Ett tal i svenskt format —
 * decimalkomma, tusentalsavgränsare som vanligt, hårt (U+00A0) eller smalt hårt (U+202F) mellanslag, procent och kr —
 * skrivs som det står. Ett tal med minustecken (U+2212, som tabellerna skriver) får ett vanligt '-', så att Excel läser
 * det som tal; text med '−' som inte är ett tal står kvar. Text som ser ut som tal (BAS, AID med inledande nolla, årtal,
 * personnummerlika strängar) skrivs också som den står: CSV-skrivaren gör aldrig om text till tal eller tal till text.
 * Tabellernas tal genom CSV och urklipp prövas i tests/talformat.test.js.
 *
 * All data är påhittad.
 */
import { describe, it, expect } from 'vitest';
import { tillCsv, tillTsv } from '../src/lib/csv.js';

const NBSP = '\u00A0', NNBSP = '\u202F', MINUS = '\u2212';

describe('CSV-exporten: svenska tal lämnas orörda', () => {
    const cell = v => tillCsv([[v]]);
    const rad = celler => tillCsv([celler]);

    it('decimalkomma, med och utan tecken', () => {
        for (const v of ['3,25', '-3,25', '+3,25', '0,5', '-0,05']) expect(cell(v), v).toBe(v);
    });
    it('tusentalsavgränsare: vanligt, hårt och smalt hårt mellanslag', () => {
        for (const sep of [' ', NBSP, NNBSP]) {
            for (const v of [`31${sep}417`, `-31${sep}417`, `1${sep}250${sep}000`, `-1${sep}250,50`, `-31${sep}417 kr`, `-31${sep}417${sep}kr`]) {
                expect(cell(v), JSON.stringify(v)).toBe(v);
            }
        }
    });
    it('negativa tal med bindestreck skrivs som de står', () => {
        // '-' före ett tal är ett tal och får inget formelskydd.
        for (const v of ['-7', '-1 250 kr', '-3,25 %', `-31${NBSP}417`]) expect(cell(v), v).toBe(v);
    });
    it('negativa tal med minustecken (U+2212) skrivs med bindestreck, så att Excel läser dem som tal', () => {
        for (const [v, ut] of [[`${MINUS}7`, '-7'], [`${MINUS}1 250 kr`, '-1 250 kr'], [`${MINUS}3,25 %`, '-3,25 %'],
            [`${MINUS}31${NBSP}417`, `-31${NBSP}417`], [`${MINUS}0,05`, '-0,05'], [`${MINUS}2 år`, '-2 år']]) {
            expect(cell(v), v).toBe(ut);
            expect(tillTsv([[v]]), v).toBe(ut);
        }
    });
    it('text med minustecken (U+2212) som inte är ett tal står kvar, utan apostrof', () => {
        // Intervall och uttryck som tabellerna kan visa; '−' är inget formeltecken i Excel.
        for (const v of [`${MINUS}3 – 5`, `${MINUS}3,2–5,1`, `${MINUS}3,2 till 5,1`, `5 ${MINUS} 3`, `${MINUS}A1`, MINUS,
            `${MINUS}${MINUS}5`, `${MINUS}-5`, `${MINUS}+5`, `${MINUS}2 dagar`, `30 000 ${MINUS} 28 000 = 2 000`]) {
            expect(cell(v), v).toBe(v);
            expect(tillTsv([[v]]), v).toBe(v);
        }
    });
    it('procent, kr, st och år efter talet', () => {
        for (const v of ['-3,2 %', '+3,25 %', '-3,2%', `-0,50${NBSP}%`, '-1 250 kr', '+12 st', '-2 år']) expect(cell(v), v).toBe(v);
    });
    it('tal som JavaScript-tal skrivs som de är', () => {
        expect(rad([-5, 0, 31417, -3.25])).toBe('-5;0;31417;-3.25');
    });
    it('text som ser ut som tal förblir samma text: BAS, AID med inledande nolla, årtal, personnummerlika strängar', () => {
        for (const v of ['A', 'B', '012345', '0123 Förskollärare', '2026', '19800101-1234', '800101-1234', '20260101', '2026-11-10']) {
            expect(cell(v), v).toBe(v);
        }
    });
    it('text som börjar med ett formeltecken men inte är ett tal får apostrofen', () => {
        // Bara siffror, mellanslag, komma och punkt (och en enhet) räknas som tal; allt annat efter '-' eller '+' skyddas.
        for (const v of ['-A1', '-1+2', '+46 70 123 45 67 x', '-3,2 % =1', '-1 250 kr)', '- 5', '-', '+', '-,5', '-19800101-1234', '-2 dagar']) {
            expect(cell(v), v).toBe("'" + v);
        }
    });
    it('tomma celler blir tomma fält', () => {
        expect(rad([null, '', undefined, 0, ''])).toBe(';;;0;');
        expect(tillCsv([['a', 'b'], [], ['', null]])).toBe('a;b\r\n\r\n;');
    });
    it('ett tal med semikolon eller citattecken citeras, och skyddet gäller före citeringen', () => {
        expect(cell('-1;2')).toBe(`"'-1;2"`);
        expect(cell('3,25;4')).toBe('"3,25;4"');
    });
    it('urklippet behandlar talen likadant', () => {
        expect(tillTsv([[`${MINUS}3,25 %`, '-31 417 kr', `-1${NNBSP}250`, '012345', '-A1', null]]))
            .toBe(`-3,25 %\t-31 417 kr\t-1${NNBSP}250\t012345\t'-A1\t`);
    });
    it('formelskyddet gäller som förut i både CSV och urklipp', () => {
        for (const v of ['-A1', '=1+2', '+46 70 x', '@SUMMA(A1)', '-2 dagar', '-']) {
            expect(cell(v), v).toBe("'" + v);
            expect(tillTsv([[v]]), v).toBe("'" + v);
        }
    });
    it('en tabb eller radbrytning i en cell blir mellanslag i urklippet, så att raden hålls ihop och skyddet gäller', () => {
        expect(tillTsv([['5310 Undersköterska\nnatt', 31000]])).toBe('5310 Undersköterska natt\t31000');
        expect(tillTsv([['a\r\n=1+2', 'b\tc']])).toBe('a =1+2\tb c');
        expect(tillTsv([['\n=1+2']])).toBe(' =1+2');   // ledande blanksteg: Excel läser det som text
    });
});


// CSV- och urklippsexport: en cell som börjar med = + - @ (eller tabb/radbrytning)
// tolkas som formel när filen öppnas eller klistras in i Excel. Yrkes- och
// enhetsnamn kommer ur lönefilen, så en fientlig fil kunde annars smyga in en
// formel i HR:s export ("CSV-injektion", OWASP).
describe('export: formler i celler neutraliseras', () => {
    const rad = celler => tillCsv([celler]);
    it('formelstart får ett inledande apostrof-tecken', () => {
        expect(rad(['=HYPERLINK("http://x","klick")'])).toBe(`"'=HYPERLINK(""http://x"",""klick"")"`);
        expect(rad(['+1+1'])).toBe("'+1+1");
        expect(rad(['@SUM(A1)'])).toBe("'@SUM(A1)");
        expect(rad(['-2+3'])).toBe("'-2+3");
        expect(rad(['\t=1'])).toBe("'\t=1");
    });
    it('vanliga tal och formaterade värden lämnas orörda', () => {
        expect(rad([-5, 3.25, '-3,2 %', '+12', '−', '31 417 kr', '-1 250 kr', 'Förskollärare'])).toBe("-5;3.25;-3,2 %;+12;−;31 417 kr;-1 250 kr;Förskollärare");
    });
    it('urklippet neutraliseras på samma sätt', () => {
        expect(tillTsv([['=1+1', 'a'], ['-7', '@x']])).toBe("'=1+1\ta\n-7\t'@x");
    });
});

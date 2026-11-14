/**
 * Svenskt talformat i exporterna.
 *
 * Tre vägar prövas:
 *   1. CSV- och urklippsexporten (`_toCsv`, `_tillTsv`, `_CSV_TALLIKT` i src/app/22-exporthjalpare.js): ett tal i
 *      svenskt format — decimalkomma, tusentalsavgränsare som vanligt, hårt (U+00A0) eller smalt hårt (U+202F)
 *      mellanslag, procent och kr — skrivs som det står, utan formelskyddets apostrof (ADR-15). Ett tal med
 *      minustecken (U+2212, som tabellerna skriver) får ett vanligt '-', så att Excel läser det som tal; text med
 *      '−' som inte är ett tal står kvar. Text som ser ut som tal (BAS, AID med inledande nolla, årtal, personnummerlika strängar)
 *      skrivs också som den står: CSV-skrivaren gör aldrig om text till tal eller tal till text.
 *   2. Jämförelseexporten (`exportBenchmarkExcel`, src/app/64-jamforelse-export.js): kronor och procent är talceller
 *      med svenskt talformat, koder är textceller, och en tom cell är tom. Arbetsboken skrivs och läses tillbaka
 *      med SheetJS, och värdena är desamma.
 *   3. Rundtur av talen: ett tal som verktyget skriver i svenskt format (svTal/svPct, som tabellerna och därmed
 *      CSV-exporten bär) läses tillbaka av talinläsningen (`parseNumberStrict`) till samma värde.
 *
 * All data är påhittad.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { createAppWindow } from './helpers/app-harness.js';
import { laddaXlsx } from './helpers/ktroskel-rigg.js';

const NBSP = ' ', NNBSP = ' ', MINUS = '−';

describe('CSV-exporten: svenska tal lämnas orörda', () => {
    let w;
    beforeAll(() => { w = createAppWindow(); });
    const cell = v => w.__toCsv([[v]]);
    const rad = celler => w.__toCsv([celler]);

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
            expect(w.__tillTsv([[v]]), v).toBe(ut);
        }
    });
    it('text med minustecken (U+2212) som inte är ett tal står kvar, utan apostrof', () => {
        // Intervall och uttryck som tabellerna kan visa; '−' är inget formeltecken i Excel.
        for (const v of [`${MINUS}3 – 5`, `${MINUS}3,2–5,1`, `${MINUS}3,2 till 5,1`, `5 ${MINUS} 3`, `${MINUS}A1`, MINUS,
            `${MINUS}${MINUS}5`, `${MINUS}-5`, `${MINUS}+5`, `${MINUS}2 dagar`, `30 000 ${MINUS} 28 000 = 2 000`]) {
            expect(cell(v), v).toBe(v);
            expect(w.__tillTsv([[v]]), v).toBe(v);
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
        expect(w.__toCsv([['a', 'b'], [], ['', null]])).toBe('a;b\r\n\r\n;');
    });
    it('ett tal med semikolon eller citattecken citeras, och skyddet gäller före citeringen', () => {
        expect(cell('-1;2')).toBe(`"'-1;2"`);
        expect(cell('3,25;4')).toBe('"3,25;4"');
    });
    it('urklippet behandlar talen likadant', () => {
        expect(w.__tillTsv([[`${MINUS}3,25 %`, '-31 417 kr', `-1${NNBSP}250`, '012345', '-A1', null]]))
            .toBe(`-3,25 %\t-31 417 kr\t-1${NNBSP}250\t012345\t'-A1\t`);
    });
    it('formelskyddet gäller som förut i både CSV och urklipp', () => {
        for (const v of ['-A1', '=1+2', '+46 70 x', '@SUMMA(A1)', '-2 dagar', '-']) {
            expect(cell(v), v).toBe("'" + v);
            expect(w.__tillTsv([[v]]), v).toBe("'" + v);
        }
    });
});

describe('CSV-exporten av en tabell: talen som de står på skärmen', () => {
    it('tusentalsavgränsaren blir ett vanligt mellanslag, minustecknet blir bindestreck och decimalkommat står kvar', () => {
        const w = createAppWindow();
        const t = w.document.createElement('table');
        t.id = 'talformat-prov';
        // svTal skriver tusentalsavgränsaren som hårt mellanslag och minus som U+2212 (Intl, sv-SE).
        const tal = w.eval('[svTal(-31417), svTal(1250.5, 2), svPct(-3.25, 2), svPct(12.5, 1)]');
        t.innerHTML = `<thead><tr><th>Yrke</th><th>BAS</th><th>A</th><th>B</th><th>C</th><th>D</th><th>Tom</th></tr></thead>
            <tbody><tr><td>012345 Påhittat yrke</td><td>A</td>${tal.map(v => `<td>${v}</td>`).join('')}<td></td></tr></tbody>`;
        w.document.body.appendChild(t);
        const rader = w.__tableToMatrix('talformat-prov');
        expect(rader[1]).toEqual(['012345 Påhittat yrke', 'A', `${MINUS}31 417`, '1 250,50', `${MINUS}3,25 %`, '12,5 %', '']);
        expect(w.__toCsv(rader.slice(1))).toBe('012345 Påhittat yrke;A;-31 417;1 250,50;-3,25 %;12,5 %;');
        expect(w.__tillTsv(rader.slice(1))).toBe('012345 Påhittat yrke\tA\t-31 417\t1 250,50\t-3,25 %\t12,5 %\t');
    });
});

describe('Rundtur: verktygets svenska tal läses tillbaka till samma värde', () => {
    let w;
    beforeAll(() => { w = createAppWindow(); });
    const las = s => w.eval(`parseNumberStrict(${JSON.stringify(s)})`);
    it('tal skrivna med svTal och svPct', () => {
        for (const [v, dec] of [[31417, 0], [-31417, 0], [1250.5, 2], [-1250.5, 2], [-3.25, 2], [0.5, 1], [-0.05, 2], [1234567.89, 2]]) {
            const text = w.eval(`svTal(${v}, ${dec})`);
            expect(las(text), JSON.stringify(text)).toEqual({ status: 'ok', value: v, raw: text });
            const pct = w.eval(`svPct(${v}, ${dec})`);
            expect(las(pct).value, JSON.stringify(pct)).toBe(v);
        }
    });
    it('samma tal efter CSV-exportens mellanslag (vanligt, hårt eller smalt hårt) och med kr', () => {
        for (const sep of [' ', NBSP, NNBSP]) {
            expect(las(`31${sep}417`).value).toBe(31417);
            expect(las(`-31${sep}417 kr`).value).toBe(-31417);
            expect(las(`${MINUS}31${sep}417 kr`).value).toBe(-31417);
            expect(las(`${MINUS}1${sep}250,50`).value).toBe(-1250.5);
        }
    });
    it('tal med minustecken (U+2212) ger samma värde efter CSV-exporten och urklippet', () => {
        for (const [v, dec] of [[-31417, 0], [-1250.5, 2], [-3.25, 2], [-0.05, 2], [-7, 0]]) {
            for (const text of [w.eval(`svTal(${v}, ${dec})`), w.eval(`svPct(${v}, ${dec})`)]) {
                expect(text.startsWith(MINUS), JSON.stringify(text)).toBe(true);
                const csv = w.__toCsv([[text]]), tsv = w.__tillTsv([[text]]);
                expect(csv.startsWith('-'), JSON.stringify(csv)).toBe(true);
                expect(tsv).toBe(csv);
                expect(las(csv).value, JSON.stringify(csv)).toBe(v);
                expect(las(csv).value).toBe(las(text).value);
            }
        }
    });
    it('ett minustecken (U+2212) byter tecken på talet precis som ett bindestreck', () => {
        expect(las(`${MINUS}7`).value).toBe(-7);
        expect(las(`${MINUS}3,25 %`).value).toBe(-3.25);
        expect(w.eval(`parseNumber(${JSON.stringify(MINUS + '32 500')})`)).toBe(-32500);
    });
    it('tomma celler och ett ensamt streck är inga tal', () => {
        expect(las('').status).toBe('empty');
        expect(las('   ').status).toBe('empty');
        for (const s of ['–', MINUS, '-']) expect(las(s).status, s).toBe('invalid');
    });
});

describe('Jämförelseexporten: talceller med svenskt talformat, koder som text', () => {
    let w, bok;
    // Påhittad organisation: en yrkesgrupp med AID som börjar med noll, en grupp i ett annat BAS-intervall och en
    // grupp under tröskeln. Lönerna ger både positiva och negativa skillnader mot referenserna.
    beforeAll(async () => {
        w = createAppWindow();
        await laddaXlsx(w);
        w.eval(`(() => {
            const rows = [];
            const add = (n, bas, aid, label, kon, lon0, steg) => { for (let i = 0; i < n; i++) rows.push({
                bas, yrke: aid + ' ' + label, aid, yrkeLabel: label, lon: lon0 + i * steg, alder: 30 + i, kon, poang: null, enhet: '1' }); };
            add(6, 'A', '012345', 'Påhittat yrke ett', 'kvinna', 28000, 250);
            add(6, 'A', '012345', 'Påhittat yrke ett', 'man',    28500, 250);
            add(12, 'B', '234567', 'Påhittat yrke två', 'kvinna', 41000, 500);
            add(2, 'C', '345678', 'Påhittat yrke tre', 'man', 50000, 0);
            state.data = rows;
            state.dataAudit = { totalRaw: rows.length, excludedNoBas: 0, excludedZeroLon: 0 };
            state.policy = [{ bas: 'A', p10: 29000, med: 30000, p90: 31000 }, { bas: 'B', p10: 40000, med: 42000, p90: 45000 }];
            state.statistik = [{ aid: '012345', bas: 'A', median: 29500.4, p10: 28100, p90: 31000 }, { aid: '234567', bas: 'B', median: 44000 }];
            state.statistikHasP10 = true; state.statistikHasP90 = true;
        })()`);
        w.__fangad = null;
        w.XLSX.writeFile = (wb, namn) => { w.__fangad = { wb, namn }; };
        w.eval('exportBenchmarkExcel()');
        bok = w.__fangad.wb;
    });
    const blad = () => bok.Sheets['Jämförelse_alla_percentiler'];
    const rubriker = () => w.XLSX.utils.sheet_to_json(blad(), { header: 1, raw: true })[1];
    const radFor = aid => {
        const aoa = w.XLSX.utils.sheet_to_json(blad(), { header: 1, raw: true, defval: null });
        return aoa.findIndex(r => String(r[0]).startsWith(aid));
    };
    const cellAt = (r, rubrik, start = 0) => blad()[w.XLSX.utils.encode_cell({ r, c: rubriker().indexOf(rubrik, start) })];

    it('AID med inledande nolla och BAS är textceller', () => {
        const r = radFor('012345');
        expect(blad()[w.XLSX.utils.encode_cell({ r, c: 0 })]).toMatchObject({ t: 's', v: '012345 Påhittat yrke ett' });
        expect(blad()[w.XLSX.utils.encode_cell({ r, c: 1 })]).toMatchObject({ t: 's', v: 'A' });
    });
    it('gruppen under tröskeln är utelämnad', () => {
        expect(radFor('345678')).toBe(-1);
    });
    it('kronor är heltal i talceller med tusentalsformat och kr', () => {
        const r = radFor('012345');
        for (const rubrik of ['Median', 'Diff Median (kr)', 'Diff P10 (kr)', 'Diff P90 (kr)']) {
            const c = cellAt(r, rubrik);
            expect(c.t, rubrik).toBe('n');
            expect(Number.isInteger(c.v), rubrik).toBe(true);
            expect(c.z, rubrik).toBe('#,##0\\ "kr"');
        }
    });
    it('P10 och P90 är kronor och har samma format som medianen', () => {
        const r = radFor('012345');
        for (const rubrik of ['P10', 'P90']) {
            for (const start of [4, 8, 17]) {
                const c = cellAt(r, rubrik, start);
                expect(c.t, `${rubrik} från kolumn ${start}`).toBe('n');
                expect(c.z, `${rubrik} från kolumn ${start}`).toBe('#,##0\\ "kr"');
            }
        }
    });
    it('procent är tal i procentenheter med två decimaler, också när skillnaden är negativ', () => {
        const r = radFor('012345');
        const kr = cellAt(r, 'Diff Median (kr)');
        const pct = cellAt(r, 'Diff Median (%)');
        expect(pct.t).toBe('n');
        expect(pct.z).toBe('0.00\\ "%"');
        expect(pct.v).toBe(Number(pct.v.toFixed(2)));
        // Organisationens median under statistikens: båda skillnaderna negativa, med vanligt minus i talet.
        expect(kr.v).toBeLessThan(0);
        expect(pct.v).toBeLessThan(0);
        // Talformatet i Excel är oberoende av språket: punkt är decimaltecken i formatkoden, och Excel visar
        // decimalkomma och svenskt minus efter datorns inställning.
        expect(pct.z).not.toMatch(/,/);
    });
    it('bredden P90/P10 är en kvot utan kr-format', () => {
        const c = cellAt(radFor('012345'), 'Bredd P90/P10');
        expect(c.t).toBe('n');
        expect(c.v).toBeGreaterThan(1);
        expect(c.v).toBeLessThan(2);
        expect(c.z ?? '').not.toMatch(/kr/);
    });
    it('en referens som saknas ger tomma celler, inte noll eller text', () => {
        const r = radFor('234567');   // statistiken har bara medianen för gruppen
        expect(cellAt(r, 'P10', 8)).toBeUndefined();
        expect(cellAt(r, 'Diff P10 (%)', 8)).toBeUndefined();
        expect(cellAt(r, 'Median', 11)).toMatchObject({ t: 'n', v: 44000 });
    });
    it('rundtur: arbetsboken skrivs och läses tillbaka med samma tal och samma text', () => {
        const ut = w.XLSX.write(bok, { type: 'array', bookType: 'xlsx' });
        const in_ = w.XLSX.read(ut, { type: 'array', cellNF: true });
        const fore = w.XLSX.utils.sheet_to_json(blad(), { header: 1, raw: true, defval: null });
        const efter = w.XLSX.utils.sheet_to_json(in_.Sheets['Jämförelse_alla_percentiler'], { header: 1, raw: true, defval: null });
        expect(efter).toEqual(fore);
        const r = radFor('012345');
        const adr = w.XLSX.utils.encode_cell({ r, c: 0 });
        expect(in_.Sheets['Jämförelse_alla_percentiler'][adr]).toMatchObject({ t: 's', v: '012345 Påhittat yrke ett' });
        // Talformaten följer med filen.
        const median = w.XLSX.utils.encode_cell({ r, c: rubriker().indexOf('Median') });
        expect(in_.Sheets['Jämförelse_alla_percentiler'][median].z).toBe('#,##0\\ "kr"');
    });
});

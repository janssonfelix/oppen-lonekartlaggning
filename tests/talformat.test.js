/**
 * Svenskt talformat i exporterna.
 *
 * Talformatet självt (src/lib/talformat.js) prövas utan DOM längst ned. Tre vägar ut ur verktyget prövas:
 *   1. CSV- och urklippsexporten av en tabell: talen som de står på skärmen (`tableToMatrix` och src/lib/csv.js).
 *      Cellernas formelskydd och talformat prövas utan DOM i tests/csv.test.js.
 *   2. Jämförelseexporten (`exportBenchmarkExcel`, src/app/64-jamforelse-export.js): kronor och procent är talceller
 *      med svenskt talformat, koder är textceller, och en tom cell är tom. Arbetsboken skrivs och läses tillbaka
 *      med SheetJS, och värdena är desamma.
 *   3. Rundtur av talen: ett tal som verktyget skriver i svenskt format (svTal/svPct, som tabellerna och därmed
 *      CSV-exporten bär) läses tillbaka av talinläsningen (`tolkaTalStrikt`) till samma värde.
 *
 * All data är påhittad.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { createAppWindow } from './helpers/app-harness.js';
import { laddaXlsx } from './helpers/ktroskel-rigg.js';
import { svTal, svPct, svKr, svPoPct } from '../src/lib/talformat.js';
import { talformat } from '../src/lib/figur.js';

const NBSP = ' ', NNBSP = ' ', MINUS = '−';

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
        expect(w.__tillCsv(rader.slice(1))).toBe('012345 Påhittat yrke;A;-31 417;1 250,50;-3,25 %;12,5 %;');
        expect(w.__tillTsv(rader.slice(1))).toBe('012345 Påhittat yrke\tA\t-31 417\t1 250,50\t-3,25 %\t12,5 %\t');
    });
});

describe('Talet och enheten hålls ihop med ett hårt mellanslag (svPct, svKr)', () => {
    let w;
    beforeAll(() => { w = createAppWindow(); });
    it('Excel läser cellen som ett tal med enhet, och CSV och urklipp skriver vanliga mellanslag som förut', () => {
        expect(w.eval('_exportTalMedEnhet(svKr(36262))')).toEqual({ tal: 36262, enhet: 'kr', dec: 0 });
        expect(w.eval('_exportTalMedEnhet(svPct(-3.25, 2))')).toEqual({ tal: -3.25, enhet: '%', dec: 2 });
        const t = w.document.createElement('table');
        t.id = 'talformat-enhet';
        t.innerHTML = `<thead><tr><th>Yrke</th><th>Kr</th><th>Pct</th></tr></thead>
            <tbody><tr><td>012345 Påhittat yrke</td><td>${w.eval('svKr(36262)')}</td><td>${w.eval('svPct(-3.25, 2)')}</td></tr></tbody>`;
        w.document.body.appendChild(t);
        const rader = w.__tableToMatrix('talformat-enhet');
        expect(rader[1]).toEqual(['012345 Påhittat yrke', '36 262 kr', `${MINUS}3,25 %`]);
        expect(w.__tillCsv(rader.slice(1))).toBe('012345 Påhittat yrke;36 262 kr;-3,25 %');
    });
    it('p-värdet hålls ihop: «p < 0,001» bryts inte mellan tecknet och talet', () => {
        expect(w.eval('_formatPValue(0.0004)')).toBe(`p${NBSP}<${NBSP}0,001`);
        expect(w.eval('_formatPValue(0.03)')).toBe(`p${NBSP}<${NBSP}0,05`);
        expect(w.eval('_formatPValue(0.1234)')).toBe(`p${NBSP}=${NBSP}0,123`);
    });
    it('talinläsningen läser tillbaka samma värde', () => {
        expect(w.eval(`tolkaTalStrikt(svKr(-31417)).value`)).toBe(-31417);
        expect(w.eval(`tolkaTalStrikt(svPct(-3.25, 2)).value`)).toBe(-3.25);
    });
});

describe('[B9.1] Rundtur: verktygets svenska tal läses tillbaka till samma värde', () => {
    let w;
    beforeAll(() => { w = createAppWindow(); });
    const las = s => w.eval(`tolkaTalStrikt(${JSON.stringify(s)})`);
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
                const csv = w.__tillCsv([[text]]), tsv = w.__tillTsv([[text]]);
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
        expect(w.eval(`tolkaTal(${JSON.stringify(MINUS + '32 500')})`)).toBe(-32500);
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

// Talformatet (src/lib/talformat.js) prövas utan DOM: appen får samma funktioner genom spegeln. Halvorna avrundas
// bort från noll (avrundaSymmetriskt i src/lib/stat.js), så att ett tal och dess motsatta tal visas med samma siffror.
// Math.round avrundar halvorna uppåt, och då stod samma avvikelse som "−1 600 kr" och kostnaden, samma tal utan
// tecken, som "1 601 kr".
describe('talformatet: svTal, svPct, svKr och svPoPct', () => {
    const utanTecken = s => s.replace(MINUS, '');
    it('procent och kronor skrivs med U+00A0 före enheten, så att en smal kolumn inte bryter isär dem', () => {
        expect(svPct(12.5, 1)).toBe(`12,5${NBSP}%`);
        expect(svKr(36262)).toBe(`36${NBSP}262${NBSP}kr`);
        expect(svKr(-1250.4)).toBe(`${MINUS}1${NBSP}250${NBSP}kr`);
        expect(svPoPct(31.4)).toBe(`31,4${NBSP}%`);
    });
    it('det som inte är ett ändligt tal blir «–»', () => {
        for (const v of [NaN, Infinity, null, undefined, '12']) {
            expect(svTal(v), String(v)).toBe('–');
            expect(svPct(v), String(v)).toBe('–');
            expect(svKr(v), String(v)).toBe('–');
            expect(svPoPct(v), String(v)).toBe('–');
        }
        expect(svKr(undefined, '—')).toBe('—');
    });
    it('svKr: −1 600,5 och 1 600,5 visas med samma siffror', () => {
        expect(svKr(1600.5)).toBe(`1${NBSP}601${NBSP}kr`);
        expect(svKr(-1600.5)).toBe(`${MINUS}1${NBSP}601${NBSP}kr`);
        for (const v of [0.5, 2.5, 1600.5, 12345.5, 1600.4, 1600.6]) expect(utanTecken(svKr(-v)), String(v)).toBe(svKr(v));
    });
    it('svTal och svPct med en och två decimaler', () => {
        expect(svPct(-4.25, 1)).toBe(`${MINUS}4,3${NBSP}%`);
        expect(svPct(4.25, 1)).toBe(`4,3${NBSP}%`);
        for (const [v, dec] of [[0.25, 1], [4.25, 1], [12.75, 1], [0.125, 2], [1.5, 0], [2.5, 0]]) {
            expect(utanTecken(svTal(-v, dec)), `${v} ${dec}`).toBe(svTal(v, dec));
            expect(utanTecken(svPct(-v, dec)), `${v} ${dec}`).toBe(svPct(v, dec));
        }
    });
    it('diagramkärnans talformat avrundar likadant', () => {
        for (const v of [0.5, 1600.5, 2.25, 4.25, 0.125]) {
            for (const namn of ['kr', 'pct', 'antal', 'tal2']) expect(utanTecken(talformat(-v, namn)), `${v} ${namn}`).toBe(talformat(v, namn));
        }
        // 1,005 lagras som 1,00499…: alla format visar 1,00, också rapportunderlaget, som förut avrundade med Intl till 1,01.
        expect(talformat(1.005, 'tal2')).toBe(svTal(1.005, 2));
        expect(svTal(1.005, 2)).toBe('1,00');
    });
    it('noll och tal som avrundas till noll visas utan minustecken', () => {
        expect(svKr(0)).toBe(`0${NBSP}kr`);
        expect(svKr(-0.4)).toBe(`0${NBSP}kr`);
        expect(svKr(-0)).toBe(`0${NBSP}kr`);
        expect(svPct(-0.04, 1)).toBe(`0,0${NBSP}%`);
        expect(svTal(-0.004, 2)).toBe('0,00');
        expect(talformat(-0.04, 'pct')).toMatch(/^0,0\s%$/);
    });
    it('tal som inte ligger på en halva avrundas som förut', () => {
        expect(svKr(1600.49)).toBe(`1${NBSP}600${NBSP}kr`);
        expect(svKr(-1600.51)).toBe(`${MINUS}1${NBSP}601${NBSP}kr`);
        expect(svKr(-1600.49)).toBe(`${MINUS}1${NBSP}600${NBSP}kr`);
        expect(svPct(12.34, 1)).toBe(`12,3${NBSP}%`);
    });
    it('svPoPct: högst två decimaler och inga avslutande nollor', () => {
        expect(svPoPct(40)).toBe(`40${NBSP}%`);
        expect(svPoPct(39.15)).toBe(`39,15${NBSP}%`);
        expect(svPoPct(31.40)).toBe(`31,4${NBSP}%`);
    });
});

describe('idagDatum: dagens datum i lokal tid, inte UTC', () => {
    let w;
    beforeAll(() => { w = createAppWindow(); });
    it('nyårsnatten 00:30 och 23:30 ger den lokala dagen, i varje tidszon', () => {
        // Datumen byggs i lokal tid; toISOString hade gett 2026-12-31 för 00:30 öster om UTC.
        expect(w.eval('idagDatum(new Date(2027, 0, 1, 0, 30))')).toBe('2027-01-01');
        expect(w.eval('idagDatum(new Date(2026, 11, 31, 23, 30))')).toBe('2026-12-31');
        expect(w.eval('idagDatum(new Date(2026, 2, 9, 1, 5))')).toBe('2026-03-09');
    });
});

/**
 * Valideringsrapporten (tools/valideringsrapport.mjs, npm run valideringsrapport): varje ID i spårbarhetsmatrisen
 * prövas mot en körning av testsviten. Prövas på en liten matris och en påhittad JSON-rapport från Vitest.
 */
import { describe, it, expect } from 'vitest';
import { lasMatris, idIRubrik, bedom, slaSamman, markdown } from '../tools/valideringsrapport.mjs';

const ROOT = '/repo';
const MATRIS = [
    '## 1. Något',
    '',
    '| ID | Vad som räknas | Funktion och fil | Indata | Bygger på | Tester | Referensfall |',
    '|---|---|---|---|---|---|---|',
    '| X1.1 | Median | `median`, `stat.js` | tal | – | `tests/a.test.js` | saknas |',
    '| X1.2 | Kvantil | `kvantil`, `stat.js` | tal | – | `tests/a.test.js` | saknas |',
    '',
    '| Parameter | Värde |',
    '|---|---|',
    '| k | 10 |',
    '',
    '| ID | Påstående | Regel | Funktion och fil | Tester |',
    '|---|---|---|---|---|',
    '| Y2 | Inga nätverksanrop | S1 | `src/index.html` | `tests/b.test.js` |',
].join('\n');

const test = (titlar, status) => ({ ancestorTitles: titlar.slice(0, -1), title: titlar.at(-1), fullName: titlar.join(' '), status });
const fil = (namn, tester, status = 'passed') => ({ name: `${ROOT}/${namn}`, status, assertionResults: tester });

describe('valideringsrapporten', () => {
    it('läser matrisens tabeller med ID och hoppar över andra tabeller', () => {
        const m = lasMatris(MATRIS);
        expect(m.map(r => r.ID)).toEqual(['X1.1', 'X1.2', 'Y2']);
        expect(m[2]['Påstående']).toBe('Inga nätverksanrop');
    });

    it('läser ID:n först i rubriken, ett eller flera, och bara inom hakparentes', () => {
        expect(idIRubrik('[X1.1] median')).toEqual(['X1.1']);
        expect(idIRubrik('[X1.1] [X1.2] båda')).toEqual(['X1.1', 'X1.2']);
        expect(idIRubrik('median [X1.1]')).toEqual([]);
        expect(idIRubrik('X1.1 median')).toEqual([]);
    });

    it('godkänner när varje ID har ett godkänt test, också genom en describe eller flera ID per test', () => {
        const r = bedom(lasMatris(MATRIS), { testResults: [
            fil('tests/a.test.js', [test(['[X1.1] [X1.2] båda', 'räknar'], 'passed'), test(['utan ID'], 'passed')]),
            fil('tests/b.test.js', [test(['[Y2] stängt'], 'passed'), test(['[Y2] hoppat'], 'skipped')]),
        ] }, ROOT);
        expect(r.godkand).toBe(true);
        expect(r.summering).toEqual({ id: 3, godkanda: 3, underkanda: 0, saknade: 0 });
        expect(r.sviten).toMatchObject({ filer: 2, tester: 4, godkanda: 3, underkanda: 0, ovriga: 1 });
        expect(r.rader[0].tester).toEqual([{ fil: 'tests/a.test.js', namn: '[X1.1] [X1.2] båda räknar', utfall: 'passed' }]);
        expect(markdown({ ...r, bygge: {} })).toContain('| X1.2 | Kvantil | `kvantil`, `stat.js` | `tests/a.test.js` (1) | godkänd |');
    });

    it('fäller på ett ID utan test och på ett test med ID som faller', () => {
        const r = bedom(lasMatris(MATRIS), { testResults: [
            fil('tests/a.test.js', [test(['[X1.1] median', 'ett'], 'passed'), test(['[X1.1] median', 'två'], 'failed')], 'failed'),
            fil('tests/b.test.js', [test(['[Y2] stängt'], 'skipped')]),
        ] }, ROOT);
        expect(r.godkand).toBe(false);
        expect(r.rader.map(x => x.utfall)).toEqual(['underkänd', 'saknas', 'saknas']);
        expect(r.summering).toEqual({ id: 3, godkanda: 0, underkanda: 1, saknade: 2 });
        expect(markdown({ ...r, bygge: {} })).toContain('**UNDERKÄND.**');
    });

    it('fäller när ett test utan ID faller eller en fil inte kunde köras', () => {
        const alla = [test(['[X1.1] [X1.2] [Y2] alla'], 'passed')];
        expect(bedom(lasMatris(MATRIS), { testResults: [fil('tests/a.test.js', alla), fil('tests/c.test.js', [test(['x'], 'failed')], 'failed')] }, ROOT).godkand).toBe(false);
        expect(bedom(lasMatris(MATRIS), { testResults: [fil('tests/a.test.js', alla), fil('tests/c.test.js', [], 'failed')] }, ROOT).godkand).toBe(false);
        expect(bedom(lasMatris(MATRIS), { testResults: [fil('tests/a.test.js', alla)] }, ROOT).godkand).toBe(true);
    });

    it('en omkörning ersätter filen den körde om', () => {
        const forsta = { testResults: [fil('tests/a.test.js', [], 'failed'), fil('tests/b.test.js', [test(['[Y2] x'], 'passed')])] };
        const omkorning = { testResults: [fil('tests/a.test.js', [test(['[X1.1] [X1.2] x'], 'passed')])] };
        const r = bedom(lasMatris(MATRIS), slaSamman([forsta, omkorning]), ROOT);
        expect(r.godkand).toBe(true);
        expect(r.sviten.filer).toBe(2);
    });
});

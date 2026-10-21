import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { namnFranFil } from '../src/lib/referens.js';
import { createAppWindow } from './helpers/app-harness.js';

// Ingen inbyggd referens (ADR-28): modulen namnger bara en uppladdad fil.
describe('src/lib/referens.js', () => {
    it('namnFranFil tar bort ändelse och blanksteg; tomt ger "Egen referens"', () => {
        expect(namnFranFil('LPS 2027 Förskola.csv')).toBe('LPS 2027 Förskola');
        expect(namnFranFil('  malbild.v2.xlsx ')).toBe('malbild.v2');
        expect(namnFranFil('.csv')).toBe('Egen referens');
        expect(namnFranFil('')).toBe('Egen referens');
        expect(namnFranFil(undefined)).toBe('Egen referens');
    });
});

// Jämförelsestatistikens AID och BAS saneras vid inläsning på samma sätt som lönefilens
// fält: HTML-metatecken tas bort innan värdena når state (esc() vid rendering är det
// egentliga skyddet; detta är ett extra lager).
describe('jämförelsestatistik: AID och BAS saneras vid inläsning', () => {
    it('ett AID-värde med "<b>" läses in utan HTML-metatecken, i både aid, aidFull och bas', async () => {
        const w = createAppWindow();
        w.__loadDemoData();
        w.eval(readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'vendor', 'papaparse.min.js'), 'utf8'));
        const input = w.document.getElementById('file-input-stat');
        const csv = 'AID;BAS;Median\n5301 <b>Undersköterska</b>;"C&";30000\n';
        const fil = new w.File([csv], 'statistik.csv', { type: 'text/csv' });
        Object.defineProperty(input, 'files', { configurable: true, value: [fil] });
        input.dispatchEvent(new w.Event('change'));
        for (let i = 0; i < 50 && !/inlästa|Fel/.test(w.document.getElementById('stat-status').textContent); i++) await new Promise(r => setTimeout(r, 20));
        expect(w.document.getElementById('stat-status').textContent).toMatch(/1 poster inlästa/);
        const rad = w.__state.statistik.find(r => r.aid === '5301');
        expect(rad).toBeTruthy();
        expect(rad.aidFull).toBe('5301 bUndersköterska/b');
        expect(rad.bas).toBe('C');
        for (const r of w.__state.statistik) expect(`${r.aid}${r.aidFull}${r.bas}`).not.toMatch(/[<>"'&]/);
    });
});

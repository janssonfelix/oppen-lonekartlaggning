// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
// Gemensam rigg för gränssnittstesterna (tests/granssnitt*.test.js): filer, CSV-rader och textsökning.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

export const rot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const las = fil => readFileSync(join(rot, fil), 'utf8');
export const papa = w => w.eval(las('vendor/papaparse.min.js'));
export const vanta = async (villkor, varv = 100) => { for (let i = 0; i < varv && !villkor(); i++) await new Promise(r => setTimeout(r, 20)); };
export const csvFil = (w, rader, namn = 'fil.csv') => new w.File([rader.join('\n')], namn, { type: 'text/csv' });
export const braRader = (n = 30) => {
    const rader = ['BAS;Månadslön;Ålder;Kön;AID'];
    for (let i = 0; i < n; i++) rader.push(`C;${30000 + i * 10};${30 + (i % 30)};${i % 2 ? 'Man' : 'Kvinna'};207011`);
    return rader;
};
export const okandaRader = () => {
    const rader = ['Avd;Befattning;Grundlon;Fodd;Sex'];
    for (let i = 0; i < 30; i++) rader.push(`X;Handläggare;${30000 + i};${1970 + i};${i % 2 ? 'M' : 'K'}`);
    return rader;
};

// Text i element utan barn som innehåller ett tal med decimalpunkt. Kod, formelrutor och fält räknas inte.
export const medDecimalpunkt = rot0 => {
    const ut = new Set();
    for (const el of rot0.querySelectorAll('*')) {
        if (el.children.length || el.closest('script, style, svg, code, pre, textarea, select, input')) continue;
        if (/\d\.\d/.test(el.textContent)) ut.add(el.textContent.trim().slice(0, 70));
    }
    return [...ut];
};

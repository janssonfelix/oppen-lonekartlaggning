// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
// Den visade texten i varje flik, med demodatan: tal och ord som användaren läser. Fångar också text som byggs med tal
// («1 personer»), som ordproven i dokumentation-sprak inte ser.
import { describe, it, expect } from 'vitest';
import { delatFlikfonster } from './helpers/app-harness.js';

const { flikfonster, ritade } = delatFlikfonster();

// Ett mönster per fel, med ett namn som säger vad som är fel.
export const VISAD_TEXT_FEL = [
    ['plural efter 1', /(?<![\d,.  −-])1[  ](personer|grupper|kvinnor|män|slutsatser|yrken|rader|intervall(?:en)|par|anställda|etiketter|kriterier|punkter)\b/],
    ['decimalpunkt', /(?<![\w.])\d+\.\d+(?![\w.])\s*(?:%|kr|år|procent|\b)/],
    ['%-enheter', /%-enhet/],
    ['engelska', /\b(Diff|[Ss]napshot|Spillover|Ring-fenced|Timeout|Sheet|Lifecycle|[Aa]uto-match\w*|[Bb]enchmark|[Oo]utlier\w*|[Gg]ap(?![\wåäö-])|[Ss]core|[Dd]ashboard|[Ss]ummary|[Rr]eport|N\/A|[Pp]ending|[Ww]arning)\b/],
    ['slangord', /\b(obs|pers|datan|datat)\b/],
];

describe('den visade texten i flikarna', () => {
    it('flikarna har ritats', () => { expect(flikfonster()).toBeTruthy(); expect(ritade.size).toBeGreaterThan(10); });
    it('ingen flik visar «1 personer», en decimalpunkt eller «%-enheter»', () => {
        const fel = [];
        for (const [flik, { paneler }] of ritade) for (const p of paneler) {
            const text = p.textContent.replace(/\s+/g, ' ');
            for (const [namn, re] of VISAD_TEXT_FEL) for (const m of text.matchAll(new RegExp(re.source, 'g'))) fel.push(`${flik}: ${namn}: …${text.slice(Math.max(0, m.index - 40), m.index + 40)}…`);
        }
        expect(fel).toEqual([]);
    });
});

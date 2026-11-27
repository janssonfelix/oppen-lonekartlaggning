// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
// Den visade texten i varje flik: tal och ord som användaren läser. Fångar också text som byggs med tal
// («1 personer»), som ordproven i dokumentation-sprak inte ser. Flikarna läses två gånger: med demodatan och med ett
// underlag där antalen blir 1 (en grupp med en kvinna, ett intervall med en man, en person ensam i sin grupp, ett
// ställningstagande och en statistik med en rad), för det är där fel antal syns.
import { describe, it, expect } from 'vitest';
import { delatFlikfonster } from './helpers/app-harness.js';
import { lasInEttor, textfel } from './helpers/visad-text.js';

const ALLA_FLIKAR = ['dashboard', 'filer', 'bestammelser', 'matrix', 'likvardighet', 'struktur', 'prioritering', 'loneoversyn',
    'handlingsplan', 'dokumentera', 'rapporttext', 'arbetet', 'kon', 'benchmark', 'utforska', 'forvaltare', 'info'];

const demo = delatFlikfonster();
const ettor = delatFlikfonster(lasInEttor, ALLA_FLIKAR);

describe('den visade texten i flikarna', () => {
    it('flikarna har ritats', () => { expect(demo.flikfonster()).toBeTruthy(); expect(demo.ritade.size).toBeGreaterThan(10); });
    it.each([['demodatan', demo], ['underlaget med antal 1', ettor]])('ingen flik visar «1 personer», en decimalpunkt eller «%-enheter» (%s)', (_namn, { flikfonster, ritade }) => {
        expect(flikfonster()).toBeTruthy();
        const fel = [];
        for (const [flik, { paneler }] of ritade) for (const p of paneler) fel.push(...textfel(flik, p.textContent));
        expect(fel).toEqual([]);
    });
});

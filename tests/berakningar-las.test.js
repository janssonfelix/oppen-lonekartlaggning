// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
/**
 * Låsande test (characterization) för appens beräkningar på demodatan: regressionen, bootstrap-KI för översikten,
 * power-analysen, extremvärdena, regressionslinjens KI och lönegapets KI per BAS-intervall.
 *
 * Testet fryser DAGENS tal. Ändrar en refaktorering ett tal, faller testet och visar vilket. Ett avsiktligt
 * ändrat tal uppdateras med `npx vitest run -u tests/berakningar-las.test.js` och granskas i diffen av
 * snapshot-filen. Talen avrundas till tio gällande siffror innan de jämförs, så att de blir desamma på alla maskiner.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { createAppWindow } from './helpers/app-harness.js';

/**
 * Gör ett värde till något stabilt att snapshot:a: flyttal till tio gällande siffror, NaN och Infinity som sträng,
 * Map och Set som array, funktioner utelämnas. Värdena kommer från appens fönster, så objekten är från en annan
 * realm och kontrolleras med konstruktörsnamn i stället för instanceof.
 */
function stabil(v) {
    if (typeof v === 'number') return isFinite(v) ? Number(v.toPrecision(10)) : String(v);
    if (v === null || v === undefined || typeof v === 'string' || typeof v === 'boolean') return v;
    if (typeof v === 'function') return undefined;
    const namn = v.constructor?.name;
    if (Array.isArray(v)) return v.map(stabil).filter(x => x !== undefined);
    if (namn === 'Map') return [...v].map(([k, x]) => [stabil(k), stabil(x)]);
    if (namn === 'Set') return [...v].map(stabil).filter(x => x !== undefined);
    const ut = {};
    for (const k of Object.keys(v)) {
        const x = stabil(v[k]);
        if (x !== undefined) ut[k] = x;
    }
    return ut;
}

// Påhittade lönelistor för de två små funktionerna (inga verkliga löner).
const kvinnoLoner = [31200, 30850, 32400, 31900, 30400, 33100, 31500, 32050];
const mansLoner = [34100, 33750, 35200, 34600, 33900, 35800];

describe('beräkningar på demodatan (låsta tal)', () => {
    const w = createAppWindow();
    beforeAll(() => { w.__lasInDemodata(); });

    it('[B3.1] regressionen (korOLSRegression) ger samma tal', () => {
        expect(stabil(w.__runOLS())).toMatchSnapshot('korOLSRegression');
    });

    it('översiktens bootstrap-KI (state.bootstrapCI utan elapsed) ger samma tal', () => {
        w.raknaBootstrapKI();
        const { elapsed: _tid, ...utanTid } = w.__state.bootstrapCI;
        expect(stabil(utanTid)).toMatchSnapshot('bootstrapCI');
    });

    it('power-analysen (raknaStyrkeanalys) ger samma tal', () => {
        expect(stabil(w.raknaStyrkeanalys())).toMatchSnapshot('raknaStyrkeanalys');
    });

    it('extremvärdena (hittaExtremvarden) ger samma tal', () => {
        expect(stabil(w.hittaExtremvarden())).toMatchSnapshot('hittaExtremvarden');
    });

    it('regressionslinjens KI (linjarRegressionKI) på en påhittad serie ger samma tal', () => {
        const serie = [[1, 2.1], [2, 3.9], [3, 6.2], [4, 7.8], [5, 10.1], [6, 12.2], [7, 13.8], [8, 16.1]];
        expect(stabil(w.linjarRegressionKI(serie, 1, 8, 5))).toMatchSnapshot('linjarRegressionKI');
    });

    it('lönegapets KI per BAS-intervall (_laBootstrapGapKI) på två påhittade lönelistor ger samma tal', () => {
        expect(stabil(w._laBootstrapGapKI(kvinnoLoner, mansLoner))).toMatchSnapshot('_laBootstrapGapKI');
    });
});

describe('extremvärden med en påhittad avvikare', () => {
    it('hittaExtremvarden flaggar raden som multiplicerats med fem, och snapshoten låser listan', () => {
        // Eget fönster: testet ändrar data. hittaExtremvarden läser state.data direkt (hamtaData), så ingen cache behöver
        // ogiltigförklaras.
        const w = createAppWindow();
        w.__lasInDemodata();
        const rader = w.__state.data;
        // Det största BAS-intervallet, och i det den första raden i datan (deterministiskt val).
        const antal = {};
        for (const r of rader) antal[r.bas] = (antal[r.bas] || 0) + 1;
        const storst = Object.keys(antal).sort((a, b) => antal[b] - antal[a] || (a < b ? -1 : 1))[0];
        const index = rader.findIndex(r => r.bas === storst);
        const forre = rader[index].lon;
        rader[index].lon = forre * 5;

        const utfall = w.hittaExtremvarden();
        expect(utfall.length).toBeGreaterThanOrEqual(1);
        const flaggad = utfall.find(o => o.bas === storst && o.lon === forre * 5);
        expect(flaggad, 'den ändrade raden ska vara flaggad').toBeDefined();
        expect(stabil(utfall)).toMatchSnapshot('hittaExtremvarden med avvikare');
    });
});

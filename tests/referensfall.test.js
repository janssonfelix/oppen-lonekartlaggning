// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
/**
 * Handräknade referensfall: små fall (5–40 rader påhittade löner) där facit och uträkningen står i klartext, så att
 * den som granskar kan följa hur ett tal kommer till med papper eller kalkylblad, utan Python.
 *
 * Varje fall är en JSON-fil i tests/fixtures/referensfall/ med fälten id, titel, funktion, indata, forvantat,
 * harledning och vid behov tolerans. Facit är räknat för hand ur formeln i källans kommentarer, inte avskrivet
 * ur kodens svar. Ett nytt fall är bara en ny JSON-fil.
 *
 * funktion är "modul#exportnamn" (modulen relativt repots rot) eller "adapter#namn" för en adapter nedan, när
 * argumenten inte går att uttrycka i JSON. indata är listan med argument. forvantat jämförs delvis: för ett
 * objekt prövas bara de fält som står i facit, en lista ska ha samma längd och prövas element för element, och
 * tal jämförs inom tolerans (standard 0). Ett fall med fältet avvikelse är ett fynd där koden ger ett annat tal
 * än handräkningen; det körs som it.fails tills avvikelsen är utredd.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { medianGapPct, tillDirektivtecken } from '../src/lib/struktur.js';
import { prioritera } from '../src/lib/prioritering.js';

const here = dirname(fileURLToPath(import.meta.url));
const rot = join(here, '..');
const mapp = join(here, 'fixtures', 'referensfall');

const ADAPTRAR = {
    /** Samma rader med direktivets tecken: tillDirektivtecken(medianGapPct(rader, opt)). */
    direktivteckenForRader: (rader, opt) => tillDirektivtecken(medianGapPct(rader, opt)),
    /**
     * prioritera med referensen som tabell i stället för funktion: opt.referenser har nyckeln "AID|BAS" och
     * värdet {median, kalla}; opt.bristAids är en lista som görs om till en mängd.
     */
    prioriteraMedReferenstabell: (rader, { referenser, bristAids, ...opt }) => prioritera(rader, {
        ...opt,
        referensFor: (aid, bas) => referenser[`${aid}|${bas}`] ?? null,
        bristAids: new Set(bristAids || []),
    }),
};

async function hamtaFunktion(funktion) {
    const [modul, namn] = funktion.split('#');
    if (modul === 'adapter') return ADAPTRAR[namn];
    const m = await import(pathToFileURL(join(rot, modul)).href);
    return m[namn];
}

// Delvis jämförelse: listar avvikelserna som "sökväg: förväntat …, fick …".
function jamfor(fick, vantat, tol, sokvag, fel) {
    if (typeof vantat === 'number') {
        if (typeof fick !== 'number' || !(Math.abs(fick - vantat) <= tol)) fel.push(`${sokvag}: förväntat ${vantat}, fick ${fick}`);
    } else if (Array.isArray(vantat)) {
        if (!Array.isArray(fick) || fick.length !== vantat.length) {
            fel.push(`${sokvag}: förväntat en lista med ${vantat.length} element, fick ${JSON.stringify(fick)}`);
            return;
        }
        vantat.forEach((v, i) => jamfor(fick[i], v, tol, `${sokvag}[${i}]`, fel));
    } else if (vantat !== null && typeof vantat === 'object') {
        if (fick === null || typeof fick !== 'object') { fel.push(`${sokvag}: förväntat ett objekt, fick ${JSON.stringify(fick)}`); return; }
        for (const [k, v] of Object.entries(vantat)) jamfor(fick[k], v, tol, `${sokvag}.${k}`, fel);
    } else if (fick !== vantat) {
        fel.push(`${sokvag}: förväntat ${JSON.stringify(vantat)}, fick ${JSON.stringify(fick)}`);
    }
}

const filer = readdirSync(mapp).filter(f => f.endsWith('.json')).sort();
const fall = filer.map(f => ({ fil: f, ...JSON.parse(readFileSync(join(mapp, f), 'utf8')) }));

describe('handräknade referensfall', () => {
    it('mappen har fall, och varje fall har id, titel, funktion, indata, forvantat och en härledning', () => {
        expect(fall.length).toBeGreaterThanOrEqual(12);
        for (const c of fall) {
            expect(typeof c.id, c.fil).toBe('string');
            expect(typeof c.titel, c.fil).toBe('string');
            expect(c.funktion, c.fil).toMatch(/^[^#]+#\w+$/);
            expect(Array.isArray(c.indata), c.fil).toBe(true);
            expect('forvantat' in c, c.fil).toBe(true);
            expect(Array.isArray(c.harledning) && c.harledning.length > 0, c.fil).toBe(true);
            expect(c.harledning.every(s => typeof s === 'string' && s.trim().length > 0), c.fil).toBe(true);
        }
        expect(new Set(fall.map(c => c.id)).size).toBe(fall.length);
    });

    for (const c of fall) {
        const prov = async () => {
            const fn = await hamtaFunktion(c.funktion);
            expect(typeof fn, `${c.funktion} finns inte`).toBe('function');
            const fel = [];
            jamfor(await fn(...c.indata), c.forvantat, c.tolerans ?? 0, 'resultat', fel);
            expect(fel).toEqual([]);
        };
        // Ett fall med avvikelse är ett fynd: koden ger ett annat tal än handräkningen (se fältet i JSON-filen).
        if (c.avvikelse) it.fails(`${c.id}: ${c.titel} (avvikelse: ${c.avvikelse})`, prov);
        else it(`${c.id}: ${c.titel}`, prov);
    }
});

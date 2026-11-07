// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
// Importprofiler (src/lib/importprofiler.js): en sparad kolumnmappning som bara bär rubriknamn.
import { describe, it, expect } from 'vitest';
import {
    valideraImportprofil, valideraImportprofiler, matchaImportprofil, profilFranMappning, importprofilerTillJson,
    normaliseraRubrik, INBYGGDA_PROFILER, inbyggdaProfiler, MAX_PROFILER, IMPORTPROFIL_FORMAT,
} from '../src/lib/importprofiler.js';

const profil = (over = {}) => ({
    id: 'var-personallista', namn: 'Vår personallista',
    rubriker: { bas: ['Lönenivå'], yrke: ['Befattningskod'], lon: ['Grundlön heltid'], alder: ['Födelseår'], kon: ['Juridiskt kön'] },
    ...over,
});
const FIL = ['Avdelning', 'Lönenivå', 'Befattningskod', 'Grundlön heltid', 'Födelseår', 'Juridiskt kön'];

describe('valideraImportprofil', () => {
    it('godtar en profil med rubriknamn och sätter kännetecknen till de obligatoriska rollernas rubriker', () => {
        const p = valideraImportprofil(profil(), { kalla: 'konfiguration' });
        expect(p).not.toBeNull();
        expect(p.kalla).toBe('konfiguration');
        expect(p.kannetecken).toEqual(['Lönenivå', 'Befattningskod', 'Grundlön heltid', 'Födelseår', 'Juridiskt kön']);
        expect(p.rubriker.bas).toEqual(['Lönenivå']);
    });
    it('för bara vitlistade fält vidare: okända fält och roller faller bort', () => {
        const p = valideraImportprofil(profil({ varden: [32000, 41000], rubriker: { ...profil().rubriker, personnamn: ['Namn'] }, exempel: 'Anna' }));
        expect(Object.keys(p).sort()).toEqual(['id', 'kalla', 'kannetecken', 'namn', 'rubriker']);
        expect(Object.keys(p.rubriker)).not.toContain('personnamn');
    });
    it('avvisar personnummerliknande text i en rubrik, ett kännetecken eller namnet', () => {
        expect(valideraImportprofil(profil({ rubriker: { ...profil().rubriker, bas: ['19850101-1234'] } }))).toBeNull();
        expect(valideraImportprofil(profil({ kannetecken: ['850101-1234'] }))).toBeNull();
        expect(valideraImportprofil(profil({ namn: 'Lista 198501011234' }))).toBeNull();
    });
    it('avvisar e-postadresser', () => {
        expect(valideraImportprofil(profil({ namn: 'anna@exempel.se' }))).toBeNull();
        expect(valideraImportprofil(profil({ rubriker: { ...profil().rubriker, kon: ['k@exempel.se'] } }))).toBeNull();
    });
    it('avvisar en rubrik eller ett namn över 80 tecken', () => {
        expect(valideraImportprofil(profil({ rubriker: { ...profil().rubriker, lon: ['L'.repeat(81)] } }))).toBeNull();
        expect(valideraImportprofil(profil({ namn: 'N'.repeat(81) }))).toBeNull();
        expect(valideraImportprofil(profil({ rubriker: { ...profil().rubriker, lon: ['L'.repeat(80)] } }))).not.toBeNull();
    });
    it('avvisar fler än 20 rubriker för en roll, rubriker som inte är text och en profil utan rubriker', () => {
        expect(valideraImportprofil(profil({ rubriker: { ...profil().rubriker, yrke: Array.from({ length: 21 }, (_, i) => `Yrke ${i}`) } }))).toBeNull();
        expect(valideraImportprofil(profil({ rubriker: { ...profil().rubriker, lon: [32000] } }))).toBeNull();
        expect(valideraImportprofil(profil({ rubriker: {} }))).toBeNull();
        expect(valideraImportprofil(profil({ rubriker: { bas: ['---'] } }))).toBeNull();   // tom efter normalisering
        expect(valideraImportprofil(null)).toBeNull();
        expect(valideraImportprofil(profil({ namn: '' }))).toBeNull();
    });
    it('tar bort HTML-tecken ur texten', () => {
        const p = valideraImportprofil(profil({ namn: 'Vår <b>lista</b>' }));
        expect(p.namn).toBe('Vår blista/b');
    });
    it('en fil kan inte göra sin profil inbyggd: källan sätts av den som läser in', () => {
        expect(valideraImportprofil(profil({ kalla: 'inbyggd' }), { kalla: 'organisationspaket' }).kalla).toBe('organisationspaket');
        expect(valideraImportprofil(profil({ kalla: 'inbyggd' })).kalla).toBe('konfiguration');
    });
});

describe('valideraImportprofiler', () => {
    it('avvisar fler än 50 profiler', () => {
        const lista = Array.from({ length: MAX_PROFILER + 1 }, (_, i) => profil({ id: `p-${i}`, namn: `Profil ${i}` }));
        const r = valideraImportprofiler(lista, { kalla: 'konfiguration' });
        expect(r.profiler).toEqual([]);
        expect(r.fel).toMatch(/50/);
        expect(valideraImportprofiler(lista.slice(0, MAX_PROFILER), { kalla: 'konfiguration' }).profiler.length).toBe(MAX_PROFILER);
    });
    it('hoppar över ogiltiga profiler och räknar dem, och tar en profil per id', () => {
        const r = valideraImportprofiler([profil(), profil({ namn: '850101-1234' }), profil()], { kalla: 'konfiguration' });
        expect(r.profiler.length).toBe(1);
        expect(r.bort).toBe(2);
        expect(valideraImportprofiler('inte en lista', { kalla: 'konfiguration' }).fel).toBeTruthy();
    });
});

describe('matchaImportprofil', () => {
    const p = valideraImportprofil(profil(), { kalla: 'konfiguration' });
    it('gäller när alla kännetecken finns bland filens rubriker, och ger mappningen roll → filens rubrik', () => {
        const t = matchaImportprofil(FIL, [p]);
        expect(t.profil.id).toBe('var-personallista');
        expect(t.mappning).toEqual({ bas: 'Lönenivå', yrke: 'Befattningskod', lon: 'Grundlön heltid', alder: 'Födelseår', kon: 'Juridiskt kön' });
    });
    it('kräver alla kännetecken', () => {
        expect(matchaImportprofil(FIL.filter(r => r !== 'Juridiskt kön'), [p])).toBeNull();
    });
    it('jämför normaliserat, som autoDetectColumnMap: versaler och tecken spelar ingen roll', () => {
        const t = matchaImportprofil(['LÖNENIVÅ', 'befattnings-kod', 'Grundlön_heltid', 'födelseår', 'Juridiskt  kön'], [p]);
        expect(t.mappning.yrke).toBe('befattnings-kod');
        expect(normaliseraRubrik('Månadslön')).toBe('mnadsln');
    });
    it('profilen fyller bara sina roller', () => {
        const delvis = valideraImportprofil({ namn: 'Bara lönen', rubriker: { lon: ['Grundlön heltid'] } }, { kalla: 'konfiguration' });
        const t = matchaImportprofil(FIL, [delvis]);
        expect(t.mappning).toEqual({ lon: 'Grundlön heltid' });
    });
    it('prioritetsordning: organisationspaketet, konfigurationsfilen, inbyggda — oavsett listans ordning', () => {
        const ur = kalla => valideraImportprofil(profil({ id: `p-${kalla}`, namn: kalla }), { kalla });
        const inbyggd = { ...ur('konfiguration'), id: 'p-inbyggd', kalla: 'inbyggd' };
        expect(matchaImportprofil(FIL, [inbyggd, ur('konfiguration'), ur('organisationspaket')]).profil.kalla).toBe('organisationspaket');
        expect(matchaImportprofil(FIL, [inbyggd, ur('konfiguration')]).profil.kalla).toBe('konfiguration');
        // Inom samma källa vinner den första som gäller.
        const a = valideraImportprofil(profil({ id: 'a', namn: 'A' }), { kalla: 'konfiguration' });
        const b = valideraImportprofil(profil({ id: 'b', namn: 'B' }), { kalla: 'konfiguration' });
        expect(matchaImportprofil(FIL, [a, b]).profil.id).toBe('a');
    });
    it('ingen profil gäller: null', () => {
        expect(matchaImportprofil(['BAS', 'AID'], [p])).toBeNull();
        expect(matchaImportprofil([], [])).toBeNull();
    });
});

describe('profilFranMappning', () => {
    const mappning = { bas: 'Lönenivå', yrke: 'Befattningskod', lon: 'Grundlön heltid', alder: 'Födelseår', kon: 'Juridiskt kön', poang: '', ansvar: '' };
    it('bygger en profil ur en gjord mappning, med de obligatoriska rollernas rubriker som kännetecken', () => {
        const p = profilFranMappning({ namn: 'Vår personallista', kalla: 'konfiguration', mappning, rubriker: FIL });
        expect(p.namn).toBe('Vår personallista');
        expect(p.kalla).toBe('konfiguration');
        expect(p.kannetecken).toEqual(['Lönenivå', 'Befattningskod', 'Grundlön heltid', 'Födelseår', 'Juridiskt kön']);
        expect(p.rubriker).toEqual({ bas: ['Lönenivå'], yrke: ['Befattningskod'], lon: ['Grundlön heltid'], alder: ['Födelseår'], kon: ['Juridiskt kön'] });
        expect(matchaImportprofil(FIL, [p]).mappning).toEqual({ bas: 'Lönenivå', yrke: 'Befattningskod', lon: 'Grundlön heltid', alder: 'Födelseår', kon: 'Juridiskt kön' });
    });
    it('tar bara rubriker som finns i filen, och kräver alla obligatoriska roller', () => {
        expect(profilFranMappning({ namn: 'X', kalla: 'konfiguration', mappning: { ...mappning, bas: 'Finns inte' }, rubriker: FIL })).toBeNull();
        expect(profilFranMappning({ namn: 'X', kalla: 'konfiguration', mappning: { ...mappning, kon: '' }, rubriker: FIL })).toBeNull();
    });
    it('samma namn och rubriker ger samma id', () => {
        const a = profilFranMappning({ namn: 'Vår personallista', kalla: 'konfiguration', mappning, rubriker: FIL });
        const b = profilFranMappning({ namn: 'Vår personallista', kalla: 'konfiguration', mappning, rubriker: [...FIL].reverse() });
        expect(a.id).toBe(b.id);
        expect(a.id).toMatch(/^[a-z0-9-]+$/);
    });
});

describe('INBYGGDA_PROFILER', () => {
    it('bara format projektet själv definierar: CSV-mallen, testdatan och demodatans fält', () => {
        expect(INBYGGDA_PROFILER.map(p => p.id)).toEqual(['inbyggd-csv-mallen', 'inbyggd-testdata', 'inbyggd-demodata']);
        expect(inbyggdaProfiler()).toBe(INBYGGDA_PROFILER);
        for (const p of INBYGGDA_PROFILER) {
            expect(p.kalla).toBe('inbyggd');
            expect(valideraImportprofil(p, { kalla: 'inbyggd' })).toEqual(p);
            expect(Object.isFrozen(p)).toBe(true);
        }
    });
    it('känner igen CSV-mallens och testdatans rubrikrader', () => {
        expect(matchaImportprofil(['BAS-intervall', 'AID', 'Manadslon', 'Alder', 'Kon', 'Poang'], INBYGGDA_PROFILER).profil.id).toBe('inbyggd-csv-mallen');
        const t = matchaImportprofil('Ansvar;BAS;AID-etikett;Månadslön;Ålder;Kön'.split(';'), INBYGGDA_PROFILER);
        expect(t.profil.id).toBe('inbyggd-testdata');
        // Kolumnen Ansvar (oftast ett kostnadsställe) läses aldrig som ansvarskod.
        expect(t.mappning).toEqual({ bas: 'BAS', yrke: 'AID-etikett', lon: 'Månadslön', alder: 'Ålder', kon: 'Kön' });
        expect(matchaImportprofil(['bas', 'yrke', 'lon', 'alder', 'kon'], INBYGGDA_PROFILER).profil.id).toBe('inbyggd-demodata');
    });
});

describe('importprofilerTillJson', () => {
    it('ger en fil med formatet och profilerna, utan källan, som går att läsa tillbaka', () => {
        const p = valideraImportprofil(profil(), { kalla: 'organisationspaket' });
        const o = JSON.parse(importprofilerTillJson([p]));
        expect(o.format).toBe(IMPORTPROFIL_FORMAT);
        expect(o.profiler[0]).toEqual({ id: p.id, namn: p.namn, rubriker: p.rubriker, kannetecken: p.kannetecken });
        expect(valideraImportprofiler(o.profiler, { kalla: 'konfiguration' }).profiler[0].id).toBe(p.id);
    });
});

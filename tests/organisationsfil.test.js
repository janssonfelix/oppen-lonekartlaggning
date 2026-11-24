// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
/**
 * Organisationsfilen (docs/utveckling/organisationsfil.md): den rena kärnan som bakar in
 * organisationspaketet i verktygsfilen och läser ut det igen.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { bakaIn, lasUt, kannIgenVerktyget, filnamnForslag, normaliseraFilnamn, skriptBlock, jamforVersion, flyttaOrganisationsfil, MALL_ID } from '../src/lib/organisationsfil.js';
import { byggPaket, tolkaPaket } from '../src/lib/organisationspaket.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const bygge = readFileSync(join(root, 'dist', 'oppen-lonekartlaggning.html'), 'utf8');
const kalla = readFileSync(join(root, 'src', 'index.html'), 'utf8');
const paket = { format: 'oppen-lonekartlaggning/organisationspaket', version: 1, organisation: { namn: 'Exempel & Co <AB>' },
    installningar: { kTroskel: 12 }, referens: { namn: 'Ställningstagandet', rader: [{ bas: 'A', p10: 25000, med: 30000, p90: 35000 }] } };

describe('organisationsfil: känna igen verktyget', () => {
    it('den byggda filen känns igen med version', () => {
        expect(kannIgenVerktyget(bygge)).toMatchObject({ ok: true, version: expect.stringMatching(/^\d{4}\.\d{2}\.\d{2}$/) });
    });
    it('en fil byggd före ADR-98 (const APP_VERSION = \'…\') känns igen med version', () => {
        const gammal = kalla.replace('</head>', "<script>const APP_VERSION = '2026.01.15';</script></head>");
        expect(kannIgenVerktyget(gammal)).toEqual({ ok: true, version: '2026.01.15' });
    });
    it('källans index.html känns igen men saknar version', () => {
        expect(kannIgenVerktyget(kalla)).toEqual({ ok: true, version: null });
    });
    it('en annan fil avvisas', () => {
        expect(kannIgenVerktyget('<html><body>hej</body></html>').ok).toBe(false);
        expect(bakaIn('<html><body>hej</body></html>', JSON.stringify(paket)).ok).toBe(false);
    });
});

describe('organisationsfil: baka in och läsa ut', () => {
    it('blocket ligger sist i filen, efter sista skriptet och licenstexterna, och läses ut med metadata', () => {
        const r = bakaIn(bygge, JSON.stringify(paket), { skapad: '2026-10-19', organisation: paket.organisation.namn, verktygssha: 'abc' });
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        const i = r.html.indexOf(`<template id="${MALL_ID}"`);
        expect(i).toBeGreaterThan(r.html.lastIndexOf('</script>'));
        expect(i).toBeGreaterThan(r.html.indexOf('<template id="licenstexter">'));
        expect(r.html.endsWith('</template></body></html>')).toBe(true);
        const ut = lasUt(r.html);
        expect(ut).not.toBeNull();
        expect(ut.meta).toEqual({ skapad: '2026-10-19', organisation: 'Exempel & Co <AB>', verktygsversion: r.version, verktygssha: 'abc' });
        expect(JSON.parse(ut.json)).toEqual(paket);
    });
    it('inget skript rörs: varje skriptblock är byte-identiskt före och efter', () => {
        const r = bakaIn(bygge, JSON.stringify(paket), {});
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        expect(skriptBlock(r.html)).toEqual(skriptBlock(bygge));
        expect(r.html.length - bygge.length).toBeGreaterThan(50);
    });
    it('JSON-texten bär varken < eller & (de skrivs som \\u003c och \\u0026)', () => {
        const r = bakaIn(bygge, JSON.stringify(paket), {});
        if (!r.ok) throw new Error(r.fel);
        const block = r.html.slice(r.html.indexOf(`<template id="${MALL_ID}"`));
        const inre = block.slice(block.indexOf('>') + 1, block.indexOf('</template>'));
        expect(inre).not.toMatch(/[<&]/);
        expect(JSON.parse(inre).organisation.namn).toBe('Exempel & Co <AB>');
    });
    it('ett tidigare inbakat paket ersätts, inte dubbleras', () => {
        const a = bakaIn(bygge, JSON.stringify(paket), { organisation: 'Första' });
        if (!a.ok) throw new Error(a.fel);
        const b = bakaIn(a.html, JSON.stringify({ ...paket, organisation: { namn: 'Andra' } }), { organisation: 'Andra' });
        if (!b.ok) throw new Error(b.fel);
        expect((b.html.match(/<template id="inbakat-organisationspaket"/g) || []).length).toBe(1);
        expect(lasUt(b.html).meta.organisation).toBe('Andra');
        expect(skriptBlock(b.html)).toEqual(skriptBlock(bygge));
    });
    it('ogiltig JSON och fel typ avvisas', () => {
        expect(bakaIn(bygge, '{inte json').ok).toBe(false);
        expect(bakaIn(bygge, '[1,2]').ok).toBe(false);
    });
    it('den publicerade byggfilen har inget inbakat paket', () => {
        expect(lasUt(bygge)).toBeNull();
    });
});

describe('organisationsfil: filnamn', () => {
    it('förslaget är en slug ur organisationens namn', () => {
        expect(filnamnForslag('Exempelkommunen')).toBe('oppen-lonekartlaggning-exempelkommunen.html');
        expect(filnamnForslag('Region Örebro län')).toBe('oppen-lonekartlaggning-region-orebro-lan.html');
        expect(filnamnForslag('')).toBe('oppen-lonekartlaggning-organisation.html');
    });
    it('systemägarens namn behålls, får ändelsen .html och rensas från sökvägstecken', () => {
        expect(normaliseraFilnamn('Lönekartläggning 2026', 'X')).toBe('Lönekartläggning 2026.html');
        expect(normaliseraFilnamn('verktyg.HTML', 'X')).toBe('verktyg.HTML');
        expect(normaliseraFilnamn('a/b:c', 'X')).toBe('a-b-c.html');
        expect(normaliseraFilnamn('   ', 'Kommunen')).toBe('oppen-lonekartlaggning-kommunen.html');
    });
});

describe('organisationsfil: jämföra versioner', () => {
    it('jämför de tre talen i ÅÅÅÅ.MM.DD', () => {
        expect(jamforVersion('2026.11.22', '2026.11.22')).toBe(0);
        expect(jamforVersion('2026.11.03', '2026.11.22')).toBe(-1);
        expect(jamforVersion('2027.01.02', '2026.12.30')).toBe(1);
    });
    it('ett suffix räknas inte, och en sträng utan mönstret ger null', () => {
        expect(jamforVersion('2026.11.22-kommunen', '2026.11.22')).toBe(0);
        expect(jamforVersion('okänd', '2026.11.22')).toBeNull();
    });
});

describe('organisationsfil: flytta till en ny version', () => {
    const giltigt = JSON.stringify(byggPaket({ organisation: 'Exempelregionen', skapat: '2026-10-01', avserAr: 2026,
        referens: { namn: 'Ställningstagandet', rader: [{ bas: 'A', p10: 25000, med: 30000, p90: 35000 }] } }));
    const medVersion = (html, v) => html.replace(/(var APP_VERSION = ")[0-9.]+(")/, `$1${v}$2`);
    const nyHtml = bygge;
    const nyVersion = kannIgenVerktyget(bygge).version;
    const gammalUtan = medVersion(bygge, '2026.01.15');
    const baka = (html, json) => { const r = bakaIn(html, json, { skapad: '2026-10-02', organisation: 'Exempelregionen' }); if (!r.ok) throw new Error(r.fel); return r.html; };
    const gammal = baka(gammalUtan, giltigt);
    const meta = { skapad: '2026-11-24', verktygssha: 'def' };

    it('flyttar paketet till den nya filen och anger organisation, datum och versioner', () => {
        const r = flyttaOrganisationsfil(gammal, nyHtml, meta);
        if (!r.ok) throw new Error(r.fel);
        const ut = lasUt(r.html);
        expect(tolkaPaket(ut.json)).toEqual(tolkaPaket(giltigt));
        expect(ut.meta).toEqual({ skapad: '2026-11-24', organisation: 'Exempelregionen', verktygsversion: nyVersion, verktygssha: 'def' });
        expect(r).toMatchObject({ organisation: 'Exempelregionen', paketSkapat: '2026-10-01', franVersion: '2026.01.15', tillVersion: nyVersion, aldreVersion: false });
    });
    it('inga skript rörs i den nya filen', () => {
        const r = flyttaOrganisationsfil(gammal, nyHtml, meta);
        if (!r.ok) throw new Error(r.fel);
        expect(skriptBlock(r.html)).toEqual(skriptBlock(nyHtml));
    });
    it('en gammal fil utan paket avvisas', () => {
        const r = flyttaOrganisationsfil(gammalUtan, nyHtml, meta);
        expect(r.ok).toBe(false);
        if (!r.ok) expect(r.fel).toContain('Den gamla filen har inget inbakat paket');
    });
    it('ett ogiltigt paket i den gamla filen avvisas med samma fel som vid inläsning', () => {
        const trasig = baka(gammalUtan, '{"format":"fel"}');
        const r = flyttaOrganisationsfil(trasig, nyHtml, meta);
        const t = tolkaPaket('{"format":"fel"}');
        expect(r.ok).toBe(false);
        if (!r.ok && !t.ok) expect(r.fel).toContain(t.fel);
    });
    it('en gammal fil som inte är verktyget avvisas med besked om vilken fil det gäller', () => {
        const r = flyttaOrganisationsfil('<html><body>hej</body></html>', nyHtml, meta);
        expect(r.ok).toBe(false);
        if (!r.ok) expect(r.fel).toMatch(/^Den gamla filen är inte verktyget: innehållssäkerhetspolicyn saknas/);
    });
    it('en ny fil som inte är verktyget avvisas med besked om vilken fil det gäller', () => {
        const r = flyttaOrganisationsfil(gammal, '<html><body>hej</body></html>', meta);
        expect(r.ok).toBe(false);
        if (!r.ok) expect(r.fel).toMatch(/^Den nya filen är inte verktyget/);
    });
    it('en ny fil som redan är en organisationsfil får det gamla paketet i stället för sitt eget', () => {
        const annat = JSON.stringify(byggPaket({ organisation: 'Exempelkommunen', skapat: '2026-09-01',
            referens: { rader: [{ bas: 'A', p10: 1, med: 2, p90: 3 }] } }));
        const r = flyttaOrganisationsfil(gammal, baka(nyHtml, annat), meta);
        if (!r.ok) throw new Error(r.fel);
        expect((r.html.match(/<template id="inbakat-organisationspaket"/g) || []).length).toBe(1);
        expect(tolkaPaket(lasUt(r.html).json)).toEqual(tolkaPaket(giltigt));
    });
    it('en ny fil som är äldre än den gamla tillåts men flaggas', () => {
        const r = flyttaOrganisationsfil(baka(medVersion(bygge, '2099.01.01'), giltigt), nyHtml, meta);
        if (!r.ok) throw new Error(r.fel);
        expect(r.aldreVersion).toBe(true);
    });
    it('IT:s kontroll: utan blocket är organisationsfilen byte för byte den fil som bakades in i', () => {
        const r = flyttaOrganisationsfil(gammal, nyHtml, meta);
        if (!r.ok) throw new Error(r.fel);
        expect(r.html.replace(/<template id="inbakat-organisationspaket"[^>]*>[\s\S]*?<\/template>/, '')).toBe(nyHtml);
    });
});

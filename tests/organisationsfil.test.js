// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
/**
 * Organisationsfilen (docs/utveckling/organisationsfil-design.md): den rena kärnan som bakar in
 * organisationspaketet i verktygsfilen och läser ut det igen.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { bakaIn, lasUt, kannIgenVerktyget, filnamnForslag, normaliseraFilnamn, skriptBlock, MALL_ID } from '../src/lib/organisationsfil.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const bygge = readFileSync(join(root, 'dist', 'oppen-lonekartlaggning.html'), 'utf8');
const kalla = readFileSync(join(root, 'src', 'index.html'), 'utf8');
const paket = { format: 'oppen-lonekartlaggning/organisationspaket', version: 1, organisation: { namn: 'Exempel & Co <AB>' },
    installningar: { kTroskel: 12 }, referens: { namn: 'Ställningstagandet', rader: [{ bas: 'A', p10: 25000, med: 30000, p90: 35000 }] } };

describe('organisationsfil: känna igen verktyget', () => {
    it('den byggda filen känns igen med version', () => {
        expect(kannIgenVerktyget(bygge)).toMatchObject({ ok: true, version: expect.stringMatching(/^\d{4}\.\d{2}\.\d{2}$/) });
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

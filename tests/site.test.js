/**
 * Demosidan: tools/site.mjs fyller mallen site/index.html.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { byggSida, lasRelease } from '../tools/site.mjs';

const ROOT = join(import.meta.dirname, '..');
const mall = readFileSync(join(ROOT, 'site', 'index.html'), 'utf8');
const SHA = 'a'.repeat(64);
const bygg = (extra = {}) => byggSida(mall, { version: '2026.09.30', sha: SHA, storlek: '3.00 MB', ...extra });

describe('demosidan: mallen fylls', () => {
    it('version, kontrollsumma och storlek fylls i och inga platshållare blir kvar', () => {
        const html = bygg();
        expect(html).toContain('Version 2026.09.30');
        expect(html).toContain(SHA);
        expect(html).toContain('3.00 MB');
        expect(html).not.toMatch(/\{\{[A-Z]+\}\}/);
    });
    it('demoknappen öppnar verktyget i demoläge och nedladdningen är en nedladdning', () => {
        const html = bygg();
        expect(html).toContain('href="oppen-lonekartlaggning.html?demo=1"');
        expect(html).toMatch(/href="oppen-lonekartlaggning.html" download/);
        expect(html).toMatch(/För skarp data: ladda ner filen/);
    });
    it('inga skript, inga externa resurser, CSP utan script-src', () => {
        const html = bygg();
        expect(html).not.toMatch(/<script/i);
        expect(html).not.toMatch(/\b(src|href)="https?:/);
        expect(html).toMatch(/Content-Security-Policy" content="default-src 'none';/);
        expect(html).not.toMatch(/script-src/);
    });
    it('utan guideadress hänvisas till källkoden; med adress blir det länkar', () => {
        expect(bygg()).toMatch(/docs\/anvandare/);
        const html = bygg({ guideUrl: 'https://example.org/repo/docs/anvandare/' });
        expect(html).toContain('href="https://example.org/repo/docs/anvandare/korguide.md"');
        expect(html).toContain('href="https://example.org/repo/docs/anvandare/organisationspaket.md"');
    });
    it('guideadressen måste vara https och escapas', () => {
        expect(() => bygg({ guideUrl: 'javascript:alert(1)//' })).toThrow(/https/);
        expect(bygg({ guideUrl: 'https://example.org/"><x>/' })).not.toContain('"><x>');
    });
    it('skärmbilden tas med bara när den finns', () => {
        expect(bygg()).not.toMatch(/<img/);
        expect(bygg({ bild: 'oversikt.png' })).toMatch(/<img class="bild" src="oversikt.png" alt="[^"]+"/);
    });
    it('den rörliga slingan visas i stället för stillbilden, utom för den som bett om mindre rörelse', () => {
        const html = bygg({ bild: 'oversikt.png', slinga: 'slinga.gif' });
        expect(html).toMatch(/<picture><source media="\(prefers-reduced-motion: reduce\)" srcset="oversikt.png"><img class="bild" src="slinga.gif" alt="[^"]+"><\/picture>/);
        expect(bygg({ slinga: 'slinga.gif' })).not.toMatch(/<img/);   // slingan ensam, utan stillbild att falla tillbaka på, tas inte med
    });
});

describe('demosidan: byggrapporten', () => {
    it('version, kontrollsumma och storlek läses ur RELEASE.txt', () => {
        const r = lasRelease(`Version:    2026.09.30\nSize:       3.00 MB (3145244 bytes)\nSHA-256:    ${SHA}\n`);
        expect(r).toEqual({ version: '2026.09.30', sha: SHA, storlek: '3.00 MB' });
    });
    it('en ofullständig byggrapport avvisas', () => {
        expect(() => lasRelease('Version: 1\n')).toThrow(/RELEASE/);
    });
});

/**
 * Vakt: versionsstämpeln får bara finnas på ETT ställe.
 *
 * Bakgrund: APP_VERSION/APP_BUILD_DATE var hårdkodade i 60-print-init.js (nu 60-utskrift.js m.fl.) och
 * hade glidit isär från VERSION — app:en stämplade 2026.07.22 (och benchmark-
 * exporten 2026.05.09) medan bygget var 2026.10.04. APP_VERSION är det
 * användaren ser i rapportens sidfot och i Excel-/Word-metadata, så en
 * felaktig stämpel pekar tillbaka på fel beräkningsversion i ett underlag
 * som ska vara spårbart.
 *
 * VERSION är nu enda källa; src/app/08-version.js genereras ur den.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { generateVersionSource, readVersion, buildDateFor } from '../tools/gen-version.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const srcDir = join(root, 'src', 'app');

// 2026.10.04 -> 2026.10.4 (npm/semver tillåter inte inledande nollor, så
// package.json kan inte lagra CalVer-formen ordagrant).
const semverish = v => v.split('.').map(p => String(Number(p))).join('.');

describe('versionsstämpel', () => {
    it('VERSION följer CalVer ÅÅÅÅ.MM.DD', () => {
        expect(readVersion()).toMatch(/^\d{4}\.\d{2}\.\d{2}$/);
    });

    it('src/app/08-version.js är i synk med VERSION', () => {
        const current = readFileSync(join(srcDir, '08-version.js'), 'utf8');
        expect(
            current === generateVersionSource(),
            'src/app/08-version.js är i osynk med VERSION. Kör `npm run build:app`.'
        ).toBe(true);
    });

    it('APP_BUILD_DATE härleds ur versionen (inte systemklockan)', () => {
        // Byte-reproducerbarheten hänger på detta: ett `new Date()` i
        // generatorn hade gett ny SHA-256 vid varje bygge.
        const v = readVersion();
        const src = readFileSync(join(srcDir, '08-version.js'), 'utf8');
        expect(src).toContain(`const APP_BUILD_DATE = '${buildDateFor(v)}';`);
        expect(buildDateFor('2026.10.04')).toBe('2026-10-04');
    });

    it('package.json anger samma version som VERSION', () => {
        const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
        expect(semverish(pkg.version)).toBe(semverish(readVersion()));
    });

    it('ingen annan src/app-modul hårdkodar en version', () => {
        const rx = /['"]20\d\d\.\d\d\.\d\d['"]/;
        const offenders = readdirSync(srcDir)
            .filter(f => /^\d\d-.*\.js$/.test(f) && f !== '08-version.js')
            .filter(f => rx.test(readFileSync(join(srcDir, f), 'utf8')));
        expect(
            offenders,
            `Versionssträng hårdkodad i: ${offenders.join(', ')}. Använd APP_VERSION.`
        ).toEqual([]);
    });

    it('generatorn vägrar en VERSION som inte är CalVer', () => {
        expect(() => buildDateFor('dev')).toThrow(/CalVer|härleda/);
    });
});

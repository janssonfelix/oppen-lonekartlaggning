// SPDX-License-Identifier: MIT
/**
 * Programvaruförteckningen (tools/sbom.mjs, npm run sbom): listar exakt biblioteken i vendor/, med
 * versionerna ur biblioteksfilerna och kontrollsummorna ur vendor/SHA256SUMS, deterministiskt, och
 * release-arbetsflödet lägger den signerad på releasen.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { byggSbom, BIBLIOTEK } from '../tools/sbom.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const läs = f => readFileSync(join(root, f), 'utf8');

describe('sbom: innehållet speglar vendor/', () => {
    const sbom = byggSbom();
    it('är CycloneDX och listar varje biblioteksfil i vendor/, inga andra', () => {
        expect(sbom.bomFormat).toBe('CycloneDX');
        const iVendor = readdirSync(join(root, 'vendor')).filter(f => f.endsWith('.js')).sort();
        expect(BIBLIOTEK.map(b => b.fil).sort()).toEqual(iVendor);
        expect(sbom.components.map(c => c.properties[0].value).sort()).toEqual(iVendor.map(f => `vendor/${f}`));
    });
    it('kontrollsummorna är filernas faktiska och de i SHA256SUMS', () => {
        for (const c of sbom.components) {
            const fil = c.properties[0].value;
            const sha = createHash('sha256').update(readFileSync(join(root, fil))).digest('hex');
            expect(c.hashes[0].content, fil).toBe(sha);
        }
    });
    it('versionerna är de som LICENSES.md anger, och licenserna är SPDX-id', () => {
        const md = läs('LICENSES.md');
        for (const c of sbom.components) {
            expect(md, c.name).toMatch(new RegExp(`Version:\\*\\* ${c.version.replace(/\./g, '\\.')}\\b`));
            expect(c.licenses[0].license.id).toMatch(/^(MIT|ISC|Apache-2\.0)$/);
            expect(c.purl).toBe(`pkg:npm/${c.purl.split('/')[1].split('@')[0]}@${c.version}`);
        }
    });
    it('verktygets version är VERSION och beroendegrafen pekar på alla bibliotek', () => {
        expect(sbom.metadata.component.version).toBe(läs('VERSION').trim());
        expect(sbom.dependencies[0].dependsOn.sort()).toEqual(sbom.components.map(c => c['bom-ref']).sort());
    });
    it('är deterministisk: ingen tidsstämpel, inget serienummer, samma dokument två gånger', () => {
        expect(sbom.serialNumber).toBeUndefined();
        expect(sbom.metadata.timestamp).toBeUndefined();
        expect(JSON.stringify(byggSbom())).toBe(JSON.stringify(sbom));
    });
});

describe('sbom: följer med releasen', () => {
    it('release.yml bygger förteckningen efter bygget och signerar och publicerar den', () => {
        const rel = läs('.github/workflows/release.yml');
        const jobb = rel.slice(rel.indexOf('\njobs:'));
        expect(jobb.indexOf('npm run sbom')).toBeGreaterThan(jobb.indexOf('npm run bundle'));
        expect(jobb).toMatch(/cosign sign-blob --yes --bundle sbom\.cdx\.json\.sigstore\.json sbom\.cdx\.json/);
        expect(jobb).toMatch(/dist\/sbom\.cdx\.json\.sigstore\.json/);
        expect(läs('.gitignore')).toMatch(/^dist\/sbom\.cdx\.json$/m);
    });
    it('SECURITY.md säger att förteckningen finns på releasen', () => {
        expect(läs('SECURITY.md')).toMatch(/sbom\.cdx\.json/);
    });
});

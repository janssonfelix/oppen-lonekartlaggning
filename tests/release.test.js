/**
 * Release-grinden (tools/release.mjs, npm run release:kontroll): en version taggas bara när CHANGELOG har
 * versionen överst, riskanalysen är granskad mot det bygge och den kod som släpps och arbetskatalogen är ren
 * (teknisk-plan.md §9 punkt 17b). Prövas på fixturer, inte på riktig git. Versionen i package.json prövas i
 * tests/version.test.js och RELEASE.txt av artefaktgrinden i CI (princip 4 i
 * docs/utveckling/principer.md).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { kontrollera, KODVAGAR, VERIFIERING } from '../tools/release.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const SHA = 'a'.repeat(64);

/** Ett underlag som passerar; varje test ändrar en sak. */
const ok = (andra = {}) => ({
    version: '2026.11.02\n',
    changelog: '# Changelog\n\n## 2026.11.02\n\n- Något.\n\n## 2026.10.13\n\n- Tidigare.\n',
    release: `Version:    2026.11.02\nSHA-256:    ${SHA}\n`,
    riskanalys: `# Riskanalys\n\n**Bygge:** \`2026.11.02\` · **Artefakt-SHA-256:** \`${SHA}\` (se \`dist/RELEASE.txt\`).\n**Granskningsdatum:** 2026-11-02.\n`,
    dataskydd: '# Dataskydd\n\n**Granskad mot koden:** 2026-11-01.\n',
    ejIncheckat: '',
    senasteKodandring: '2026-11-01',
    ...andra,
});
const fel = andra => kontrollera(ok(andra)).fel;

describe('release-grinden', () => {
    it('ett komplett underlag passerar', () => {
        expect(kontrollera(ok())).toEqual({ fel: [], version: '2026.11.02' });
    });

    it('CHANGELOG: ingen Oförlöst-rubrik, och översta versionen är VERSION', () => {
        expect(fel({ changelog: '## Oförlöst\n\n- x\n\n## 2026.11.02\n' }).join()).toMatch(/Oförlöst/);
        expect(fel({ changelog: '## 2026.10.13\n' }).join()).toMatch(/översta versionsrubrik är 2026\.10\.13/);
        expect(fel({ changelog: '# Changelog\n' }).join()).toMatch(/ingen versionsrubrik/);
    });

    it('RELEASE.txt måste ha en kontrollsumma att jämföra riskanalysen med', () => {
        expect(fel({ release: 'Version:    2026.11.02\n' }).join()).toMatch(/saknar SHA-256/);
    });

    it('riskanalysen anger bygget och kontrollsumman, med hänvisning till punkt 17b', () => {
        const annan = ok().riskanalys.replace(SHA, 'c'.repeat(64));
        expect(fel({ riskanalys: annan }).join()).toMatch(/kontrollsumma .*punkt 17b/);
        const gammal = ok().riskanalys.replace('`2026.11.02`', '`2026.10.13`');
        expect(fel({ riskanalys: gammal }).join()).toMatch(/Riskanalysens bygge .* är 2026\.10\.13/);
    });

    it('granskningsdatumen får inte vara äldre än senaste kodändringen', () => {
        const f = fel({ senasteKodandring: '2026-11-03' });
        expect(f.join()).toMatch(/Riskanalysens granskningsdatum \(2026-11-02\) är äldre än senaste kodändringen \(2026-11-03\)/);
        expect(f.join()).toMatch(/"Granskad mot koden" \(2026-11-01\) är äldre/);
        expect(f.every(t => /punkt 17b/.test(t))).toBe(true);
        // Samma dag räcker.
        expect(fel({ senasteKodandring: '2026-11-01' })).toEqual([]);
    });

    it('okänd kodändring (grund klon) och saknade datum är fel, inte godkänt', () => {
        expect(fel({ senasteKodandring: '' }).join()).toMatch(/fullständig klon/);
        expect(fel({ dataskydd: '# Dataskydd\n' }).join()).toMatch(/"Granskad mot koden" saknas/);
    });

    it('arbetskatalogen måste vara ren', () => {
        expect(fel({ ejIncheckat: ' M src/app/13-oversikt.js\n' }).join()).toMatch(/inte är incheckade/);
    });

    it('kodvägarna är de som planen anger', () => {
        expect(KODVAGAR).toEqual(['src', 'tools/bundle.mjs', 'vendor']);
    });

    it('riskanalysen och dataskyddsbeskrivningen har de rader grinden läser', () => {
        const ra = readFileSync(join(root, 'docs/dataskydd/riskanalys.md'), 'utf8');
        const ds = readFileSync(join(root, 'docs/dataskydd/dataskydd.md'), 'utf8');
        expect(ra).toMatch(/\*\*Bygge:\*\* `[^`]+` · \*\*Artefakt-SHA-256:\*\* `[0-9a-f]{64}`/);
        expect(ra).toMatch(/\*\*Granskningsdatum:\*\* \d{4}-\d{2}-\d{2}/);
        expect(ds).toMatch(/\*\*Granskad mot koden:\*\* \d{4}-\d{2}-\d{2}/);
    });
});

// B5 (beslut 11b): kontrollsumman som alternativ till cosign, med PowerShell-raden bredvid Linux/mac-raden.
describe('kontrollsumman i RELEASE.txt och dokumenten', () => {
    const las = f => readFileSync(join(root, f), 'utf8');
    it('SECURITY.md och körguiden §0: stycket om kontrollsumman när cosign inte kan köras, med båda kommandona', () => {
        const stycke = 'Kan ni inte köra cosign: kontrollsumman i RELEASE.txt skyddar mot en skadad eller förväxlad fil';
        for (const f of ['SECURITY.md', 'docs/anvandare/korguide.md']) {
            const t = las(f).replace(/\s+/g, ' ');
            const i = t.indexOf(stycke);
            expect(i, f).toBeGreaterThan(t.indexOf('cosign verify-blob'));
            expect(t.slice(i), f).toContain(VERIFIERING.powershell);
            expect(t.slice(i), f).toContain(VERIFIERING.linux);
        }
    });
    it('säkerhetsbeskrivningen: distributionen är organisationens, och beskrivningar tas emot som bidrag', () => {
        const t = las('docs/anvandare/sakerhetsbeskrivning.md').replace(/\s+/g, ' ');
        expect(t).toContain('Hur filen distribueras i er organisation (intranät, filserver, organisationsfil) avgör ni; webbläsarpolicyer och e-postfilter kan påverka. Beskrivningar av fungerande distributionsvägar tas tacksamt emot som bidrag.');
    });
});

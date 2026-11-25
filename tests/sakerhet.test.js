/**
 * Säkerhetshärdning: CSP för stilar, låsta tredjepartsbibliotek,
 * en enda escaping-funktion, utskriftsfönstret, låsta CI-steg och sårbarhetsbevakningen av vendor/.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { createAppWindow } from './helpers/app-harness.js';
import { regexEscape } from './helpers/regex.js';
import { utanHtmlKommentarer, utanSkript } from './helpers/htmlrens.js';
import { esc } from '../src/lib/htmltext.js';
import { bedöm, jämförVersion, ÅTGÄRDADE } from '../tools/sarbarheter.mjs';
import { hämta, läsPurl } from '../tools/sarbarheter-hamta.mjs';

const ROOT = join(import.meta.dirname, '..');
const läs = f => readFileSync(join(ROOT, f), 'utf8');
const sha256b64 = s => createHash('sha256').update(s, 'utf8').digest('base64');

// Sidans CSP (den första meta-taggen; utskriftsfönstrets egen policy står escapad i ett skript) och dess direktiv.
const cspIHtml = html => html.match(/http-equiv="Content-Security-Policy" content="([^"]+)"/)[1];
const delaCsp = csp => Object.fromEntries(csp.split(';').map(d => d.trim()).filter(Boolean).map(d => {
    const [namn, ...värden] = d.split(/\s+/);
    return [namn, värden];
}));
// Värden som pekar ut i nätet (S1): allt som varken är ett lokalt schema eller ett citerat nyckelord, alltså *,
// http:, https:, ws:, wss:, värdnamn och adresser. 'self' räknas också: det släpper samma ursprung om filen
// läggs på en server.
const LOKALA_SCHEMAN = ['data:', 'blob:'];
const natkallor = direktiv => Object.entries(direktiv).flatMap(([namn, värden]) => värden
    .filter(v => v === "'self'" || (!v.startsWith("'") && !LOKALA_SCHEMAN.includes(v)))
    .map(v => `${namn} ${v}`));
const SHA256_KALLA = /^'sha256-[A-Za-z0-9+/]+=*'$/;
const skriptkallorUtomKontrollsummor = värden => värden.filter(v => !SHA256_KALLA.test(v));

describe('säkerhet: CSP för stilar i bygget', () => {
    const html = läs('dist/oppen-lonekartlaggning.html');
    const direktiv = delaCsp(cspIHtml(html));
    it('style-elementen kräver kontrollsumma; bara stilattribut får vara inline', () => {
        expect(direktiv['style-src-elem']).toBeDefined();
        expect(direktiv['style-src-elem']).not.toContain("'unsafe-inline'");
        expect(direktiv['style-src-attr']).toEqual(["'none'"]);   // inga style-attribut i markeringen (ADR-30, ADR-43); utan direktivet gäller style-src 'unsafe-inline'
    });
    it('varje <style>-block i bygget har sin kontrollsumma i CSP:n — och en tom stilmall har ingen', () => {
        // Bara riktiga element: text inuti skripten (mallsträngar) räknas inte.
        const skriptfri = utanSkript(html);
        const block = [...skriptfri.matchAll(/<style>([\s\S]*?)<\/style>/g)].map(m => m[1]);
        expect(block.length).toBeGreaterThanOrEqual(1);
        for (const css of block) expect(direktiv['style-src-elem']).toContain(`'sha256-${sha256b64(css)}'`);
        // En tom stilmall har ingen kontrollsumma: ett bibliotek som skapar en egen <style> blockeras.
        expect(direktiv['style-src-elem']).not.toContain(`'sha256-${sha256b64('')}'`);
        expect(direktiv['style-src-elem']).toHaveLength(block.length);
    });
});

describe('[S1] säkerhet: byggets CSP släpper inte nätet', () => {
    const csp = cspIHtml(läs('dist/oppen-lonekartlaggning.html'));
    const direktiv = delaCsp(csp);
    it('default-src och connect-src är \'none\' och inget annat', () => {
        expect(direktiv['default-src']).toEqual(["'none'"]);
        expect(direktiv['connect-src']).toEqual(["'none'"]);
    });
    it('script-src har bara kontrollsummor: inget \'unsafe-inline\', inget \'unsafe-eval\', inga källor (ADR-9)', () => {
        expect(direktiv['script-src']).not.toContain("'unsafe-inline'");
        expect(direktiv['script-src']).not.toContain("'unsafe-eval'");
        expect(direktiv['script-src'].filter(v => SHA256_KALLA.test(v)).length).toBeGreaterThanOrEqual(1);
        expect(skriptkallorUtomKontrollsummor(direktiv['script-src'])).toEqual([]);
    });
    it('inget direktiv i policyn pekar ut i nätet', () => {
        expect(natkallor(direktiv)).toEqual([]);
    });
    it('källans CSP har default-src och connect-src \'none\' (bygget ärver dem; script-src byts ut i bygget)', () => {
        const källa = delaCsp(cspIHtml(läs('src/index.html')));
        expect(källa['default-src']).toEqual(["'none'"]);
        expect(källa['connect-src']).toEqual(["'none'"]);
    });
    it('självtest: tolkningen och nätkällorna fäller en policy som släpper ut', () => {
        const ut = delaCsp("default-src 'self'; connect-src https://exempel.invalid wss:; img-src * data:; font-src fonter.exempel.invalid; script-src 'sha256-abc=' http:");
        expect(natkallor(ut)).toEqual(["default-src 'self'", 'connect-src https://exempel.invalid', 'connect-src wss:',
            'img-src *', 'font-src fonter.exempel.invalid', 'script-src http:']);
        expect(skriptkallorUtomKontrollsummor(ut['script-src'])).toEqual(['http:']);
        const stängd = delaCsp("default-src 'none'; script-src 'sha256-abc='; img-src data: blob:; font-src data:; connect-src 'none'");
        expect(natkallor(stängd)).toEqual([]);
        expect(skriptkallorUtomKontrollsummor(stängd['script-src'])).toEqual([]);
        // En kopia av byggets policy utan connect-src, eller med 'unsafe-inline' i script-src, fälls.
        expect(delaCsp(csp.replace(/connect-src [^;]*;/, ''))['connect-src']).toBeUndefined();
        expect(skriptkallorUtomKontrollsummor(delaCsp(csp.replace('script-src ', "script-src 'unsafe-inline' "))['script-src']))
            .toEqual(["'unsafe-inline'"]);
    });
});

describe('[S3] en fil, utan server: bygget hämtar inget utifrån', () => {
    const html = läs('dist/oppen-lonekartlaggning.html');
    it('inga skript med src och inga modulskript, inga länkade stilmallar eller resurser', () => {
        const skripttaggar = [...html.matchAll(/<script\b([^>]*)>/gi)].map(m => m[1]);
        expect(skripttaggar.length).toBeGreaterThan(0);
        expect(skripttaggar.filter(a => /\bsrc\s*=|type\s*=\s*["']?module/i.test(a))).toEqual([]);
        expect(utanSkript(html, { medAttribut: true })).not.toMatch(/<link\b/i);
    });
});

describe('säkerhet: tredjepartsbiblioteken är låsta med kontrollsummor', () => {
    it('varje fil i vendor/ har en kontrollsumma, och den stämmer', () => {
        const summor = Object.fromEntries(läs('vendor/SHA256SUMS').trim().split('\n').map(r => {
            const [sha, fil] = r.split(/\s+\*?/);
            return [fil, sha];
        }));
        const filer = readdirSync(join(ROOT, 'vendor')).filter(f => f !== 'SHA256SUMS');
        expect(Object.keys(summor).sort()).toEqual(filer.sort());
        for (const f of filer) {
            const faktisk = createHash('sha256').update(readFileSync(join(ROOT, 'vendor', f))).digest('hex');
            expect(faktisk, f).toBe(summor[f]);
        }
    });
});

describe('säkerhet: en enda escaping-funktion', () => {
    it('src definierar esc() på ett ställe, src/lib/htmltext.js', () => {
        const def = ['src/app', 'src/lib'].flatMap(d => readdirSync(join(ROOT, d)).filter(f => f.endsWith('.js'))
            .flatMap(f => (läs(`${d}/${f}`).match(/\bconst esc\s*=/g) || []).map(() => `${d}/${f}`)));
        expect(def).toEqual(['src/lib/htmltext.js']);
    });
    // Citattecken måste escapas så att data-bas="${esc(x)}" inte kan brytas ut.
    it('esc escapar < > & och citattecken (säker i attributkontext)', () => {
        expect(esc('<b>')).toBe('&lt;b&gt;');
        expect(esc('a & b')).toBe('a &amp; b');
        expect(esc('A" onmouseover="alert(1)')).toBe('A&quot; onmouseover=&quot;alert(1)');
        expect(esc("x' onx='y")).toBe('x&#39; onx=&#39;y');
        expect(esc(null)).toBe('');
        expect(esc(undefined)).toBe('');
    });
});

// En nedladdningslänk som aldrig släpps håller filens innehåll (lönemått) kvar i minnet, också efter Rensa all data.
describe('säkerhet: en enda väg för nedladdningar', () => {
    it('bara laddaNer i 03-hjalpfunktioner.js skapar nedladdningslänkar', () => {
        const filer = readdirSync(join(ROOT, 'src/app')).filter(f => f.endsWith('.js') && /URL\.createObjectURL/.test(läs(`src/app/${f}`)));
        expect(filer).toEqual(['03-hjalpfunktioner.js']);
        expect(läs('src/app/03-hjalpfunktioner.js')).toMatch(/revokeObjectURL\(url\)/);
    });
});

describe('säkerhet: utskriftsfönstret', () => {
    it('rubriken escapas, fönstret får en egen CSP och inga inline-stilblock', () => {
        const w = createAppWindow();
        let skrivet = '';
        const fonster = { document: { write: s => { skrivet += s; }, close() {}, head: null }, focus() {}, print() {} };
        w.open = () => fonster;
        w.eval(`skrivUtMallflik('view-bestammelser', 'Rubrik <img src=x onerror="window.__xss=1">')`);
        expect(skrivet).not.toContain('<img src=x');
        expect(skrivet).toContain('&lt;img');
        expect(skrivet).toMatch(/<meta http-equiv="Content-Security-Policy" content="default-src 'none';/);
        expect(skrivet).not.toMatch(/<style>/);
    });
});

describe('säkerhet: CI-stegen är låsta på commit', () => {
    const arbetsfloden = readdirSync(join(ROOT, '.github', 'workflows')).filter(f => /\.ya?ml$/.test(f));
    it('arbetsflödena för CI och release finns', () => {
        expect(arbetsfloden).toEqual(expect.arrayContaining(['ci.yml', 'release.yml', 'sarbarheter.yml']));
    });
    for (const fil of arbetsfloden) {
        it(`${fil}: varje "uses:" pekar på en fullständig commit-SHA med versionen som kommentar`, () => {
            const uses = [...läs(`.github/workflows/${fil}`).matchAll(/uses:\s*(\S+)(.*)$/gm)].map(m => [m[1], m[2]]);
            expect(uses.length).toBeGreaterThan(0);
            for (const [u, kommentar] of uses) {
                expect(u, u).toMatch(/@[0-9a-f]{40}$/);
                expect(kommentar, u).toMatch(/^\s+# v\d/);
            }
        });
    }
    // Listan följer repots inställning för tillåtna actions (Settings → Actions → General): bara GitHubs egna och
    // cosign-installeraren. Ett steg utanför den startar inte alls (startup_failure). Den som ändrar inställningen
    // ändrar listan.
    const TILLÅTNA = [/^actions\//, /^sigstore\/cosign-installer@/];
    for (const fil of arbetsfloden) {
        it(`${fil}: varje "uses:" är en action som repots inställning tillåter`, () => {
            for (const [, u] of läs(`.github/workflows/${fil}`).matchAll(/uses:\s*(\S+)/g)) {
                expect(TILLÅTNA.some(t => t.test(u)), u).toBe(true);
            }
        });
    }
    it('release.yml: grinden körs före bygget, förteckningen och valideringsrapporten efter, och signeringen är keyless med minsta behörighet', () => {
        const rel = läs('.github/workflows/release.yml');
        expect(rel).toMatch(/^permissions: \{\}$/m);
        expect(rel).toMatch(/id-token: write/);
        expect(rel).toMatch(/fetch-depth: 0/);
        expect(rel).toMatch(/attestations: write/);
        const steg = ['npm ci', 'npm run release:kontroll', 'npm run bundle', 'npm run sbom', 'npm run valideringsrapport',
            'git worktree add --detach "$RUNNER_TEMP/ombygge" "$GITHUB_REF_NAME"', 'cosign sign-blob', 'cosign verify-blob',
            'uses: actions/attest-build-provenance@', 'gh release create'];
        const jobb = rel.slice(rel.indexOf('\njobs:'));   // kommentaren överst nämner stegen i annan ordning
        const plats = steg.map(s => jobb.indexOf(s));
        expect(plats.every(p => p > 0), steg.join(', ')).toBe(true);
        expect([...plats].sort((a, b) => a - b)).toEqual(plats);
        expect(rel).not.toMatch(/--key\b|COSIGN_PRIVATE_KEY/);
        // Jobbet som kör utvecklingsberoendena har inga skrivbehörigheter och sparar ingen nyckel i .git/config; jobbet
        // som signerar och publicerar kör ingen npm och checkar inte ut repot, så ingen kod ur npm når dess behörigheter.
        const bygg = jobb.slice(jobb.indexOf('\n  bygg:'), jobb.indexOf('\n  publicera:'));
        const publicera = jobb.slice(jobb.indexOf('\n  publicera:'));
        expect(bygg).toMatch(/permissions:\n\s+contents: read\n/);
        expect(bygg).not.toMatch(/: write/);
        expect(bygg).toMatch(/persist-credentials: false/);
        expect(publicera).toMatch(/needs: bygg/);
        expect(publicera).toMatch(/id-token: write/);
        expect(publicera).not.toMatch(/\bnpm\b|\bnpx\b|actions\/checkout@|actions\/setup-node@/);
        // Artefakten, RELEASE.txt, programvaruförteckningen och valideringsrapporten signeras och publiceras med sina
        // Sigstore-paket.
        for (const f of ['oppen-lonekartlaggning.html', 'RELEASE.txt', 'sbom.cdx.json', 'valideringsrapport.md', 'valideringsrapport.json']) {
            expect(jobb, f).toContain(`cosign sign-blob --yes --bundle ${f}.sigstore.json ${f}`);
            expect(jobb, f).toContain(`dist/${f}.sigstore.json`);
            // ... och får en attestering av ursprunget (ADR-101).
            expect(jobb.slice(jobb.indexOf('actions/attest-build-provenance@')), f).toMatch(new RegExp(`^ {12}dist/${f.replace(/\./g, '\\.')}$`, 'm'));
        }
    });
    it('ci.yml och release.yml: ett andra bygge i en ny katalog jämförs med filen (reproducerbart bygge, ADR-101)', () => {
        const ci = läs('.github/workflows/ci.yml');
        expect(ci).toMatch(/git worktree add --detach "\$RUNNER_TEMP\/andra-bygget" HEAD/);
        expect(ci).toMatch(/cd "\$RUNNER_TEMP\/andra-bygget" && TZ=\S+ LC_ALL=C npm run bundle/);
        const rel = läs('.github/workflows/release.yml');
        expect(rel).toMatch(/cd "\$RUNNER_TEMP\/ombygge" && npm run bundle/);
        expect(rel).toContain('if [ "$signeras" != "$ombyggd" ]');
    });
    it('dependabot uppdaterar npm och arbetsflödenas steg', () => {
        const d = läs('.github/dependabot.yml');
        expect(d).toMatch(/package-ecosystem: npm/);
        expect(d).toMatch(/package-ecosystem: github-actions/);
    });
});

describe('säkerhet: sårbarhetsbevakningen av vendor/', () => {
    const wf = läs('.github/workflows/sarbarheter.yml');
    const jobb = wf.slice(wf.indexOf('\njobs:'));   // kommentaren överst nämner stegen
    it('körs på schema, för hand och när biblioteken eller förteckningen ändras, med bara läsbehörighet', () => {
        expect(wf).toMatch(/^ {2}schedule:\n {4}- cron: '[^']+'/m);
        expect(wf).toMatch(/^ {2}workflow_dispatch:/m);
        for (const p of ['vendor/**', 'tools/sbom.mjs', 'tools/sarbarheter.mjs', 'tools/sarbarheter-hamta.mjs', 'TREDJEPARTSLICENSER.md']) {
            expect(wf.split(`- '${p}'`).length - 1, p).toBe(2);   // både push och pull_request
        }
        expect(wf).toMatch(/^permissions:\n {2}contents: read$/m);
        expect(wf).not.toMatch(/secrets\.|write/);
    });
    it('bygger förteckningen, frågar OSV och bedömer svaret i egna steg, utan tredjepartssteg', () => {
        const steg = ['node tools/sbom.mjs', 'node tools/sarbarheter-hamta.mjs dist/sbom.cdx.json dist/osv-svar.json',
            'node tools/sarbarheter.mjs dist/osv-svar.json'];
        const plats = steg.map(s => jobb.indexOf(s));
        expect(plats.every(p => p > 0), steg.join(', ')).toBe(true);
        expect([...plats].sort((a, b) => a - b)).toEqual(plats);
        const uses = [...jobb.matchAll(/uses:\s*(\S+)/g)].map(m => m[1]);
        expect(uses.length).toBeGreaterThan(0);
        for (const u of uses) expect(u, u).toMatch(/^actions\//);
        // Inget steg får fortsätta vid fel: en fråga som misslyckas ska fälla jobbet.
        expect(jobb).not.toMatch(/continue-on-error/);
    });
});

describe('säkerhet: bedömningen av OSV-svaret (tools/sarbarheter.mjs)', () => {
    const komponenter = [{ purl: 'pkg:npm/papaparse@5.7.0' }, { purl: 'pkg:npm/xlsx@0.20.3' }];
    const ny = { id: 'GHSA-xxxx-xxxx-xxxx', summary: 'påhittad' };
    const redos = { id: 'GHSA-5pgg-2g8v-p4x9', aliases: ['CVE-2024-22363'] };
    it('godkänner när alla bibliotek prövades utan fynd', () => {
        const r = bedöm({ 'papaparse@5.7.0': { vulns: [] }, 'xlsx@0.20.3': { vulns: [] } }, komponenter);
        expect(r).toEqual({ saknas: [], fynd: [], bortraknade: [] });
    });
    it('ett bibliotek utan svar räknas, så att en förteckning som inte prövades inte passerar', () => {
        expect(bedöm({ 'xlsx@0.20.3': { vulns: [] } }, komponenter).saknas).toEqual(['papaparse@5.7.0']);
        expect(bedöm({ 'papaparse@5.7.0': {}, 'xlsx@0.20.3': { vulns: [] } }, komponenter).saknas).toEqual(['papaparse@5.7.0']);
        expect(bedöm({}, komponenter).saknas).toHaveLength(2);
    });
    it('ett okänt fynd fäller; ett åtgärdat räknas bort bara från den åtgärdade versionen', () => {
        const r = bedöm({ 'papaparse@5.7.0': { vulns: [ny] }, 'xlsx@0.20.3': { vulns: [redos] } }, komponenter);
        expect(r.fynd.map(f => f.id)).toEqual(['GHSA-xxxx-xxxx-xxxx']);
        expect(r.bortraknade.map(f => f.id)).toEqual(['GHSA-5pgg-2g8v-p4x9']);
        // Fyndet känns igen också på aliaset.
        const viaAlias = bedöm({ 'xlsx@0.20.3': { vulns: [{ id: 'PYSEC-påhittad', aliases: ['GHSA-4r6h-8v6p-xvw6'] }] } }, [{ purl: 'pkg:npm/xlsx@0.20.3' }]);
        expect(viaAlias).toMatchObject({ fynd: [], bortraknade: [{ id: 'PYSEC-påhittad' }] });
        // En nedgradering faller igen.
        const gammal = bedöm({ 'xlsx@0.20.1': { vulns: [redos] } }, [{ purl: 'pkg:npm/xlsx@0.20.1' }]);
        expect(gammal.fynd.map(f => f.id)).toEqual(['GHSA-5pgg-2g8v-p4x9']);
    });
    it('jämför versioner numeriskt, och de åtgärdade gäller den SheetJS-version som ligger i vendor/', () => {
        expect(jämförVersion('0.20.10', '0.20.2')).toBeGreaterThan(0);
        expect(jämförVersion('0.19.3', '0.20.2')).toBeLessThan(0);
        const sheetjs = läs('vendor/xlsx.mini.min.js').slice(0, 3000).match(/version="(\d+\.\d+\.\d+)"/)[1];
        for (const a of ÅTGÄRDADE) expect(jämförVersion(sheetjs, a.atgardadI), a.id).toBeGreaterThanOrEqual(0);
    });
});

describe('säkerhet: frågan mot OSV (tools/sarbarheter-hamta.mjs)', () => {
    const komponenter = [{ purl: 'pkg:npm/papaparse@5.7.0' }, { purl: 'pkg:npm/xlsx@0.20.3' }];
    // Ett påhittat API: svarar med de givna sidorna per paket och sparar frågorna.
    const påhittat = (sidor, frågor = []) => async (_adress, init) => {
        const f = JSON.parse(init.body);
        frågor.push(f);
        const lista = sidor[`${f.package.name}@${f.version}`] || [{}];
        const i = f.page_token ? Number(f.page_token) : 0;
        return { status: 200, json: async () => ({ ...lista[i], ...(i + 1 < lista.length ? { next_page_token: String(i + 1) } : {}) }) };
    };
    it('frågar med bara namn, ekosystem och version och samlar alla sidor', async () => {
        const frågor = [];
        const svar = await hämta(komponenter, { fetch: påhittat({ 'xlsx@0.20.3': [{ vulns: [{ id: 'A' }] }, { vulns: [{ id: 'B' }] }] }, frågor) });
        expect(svar).toEqual({ 'papaparse@5.7.0': { vulns: [] }, 'xlsx@0.20.3': { vulns: [{ id: 'A' }, { id: 'B' }] } });
        expect(frågor[0]).toEqual({ package: { name: 'papaparse', ecosystem: 'npm' }, version: '5.7.0' });
        expect(frågor.at(-1)).toEqual({ package: { name: 'xlsx', ecosystem: 'npm' }, version: '0.20.3', page_token: '1' });
    });
    it('nätfel, annan status än 200, svar som inte är JSON eller har fel form fäller med beskedet att OSV inte kunde frågas', async () => {
        const fall = [
            async () => { throw new TypeError('fetch failed'); },
            async () => ({ status: 503, json: async () => ({}) }),
            async () => ({ status: 200, json: async () => { throw new SyntaxError('Unexpected token <'); } }),
            async () => ({ status: 200, json: async () => ({ vulns: 'inte en lista' }) }),
            async () => ({ status: 200, json: async () => null }),
        ];
        for (const f of fall) await expect(hämta(komponenter, { fetch: f })).rejects.toThrow(/^Kunde inte fråga OSV om papaparse@5\.7\.0/);
    });
    it('läser paketadressen och avvisar en okänd', () => {
        expect(läsPurl('pkg:npm/xlsx@0.20.3')).toEqual({ ekosystem: 'npm', namn: 'xlsx', version: '0.20.3' });
        expect(läsPurl('pkg:npm/%40skop/paket@1.0.0').namn).toBe('@skop/paket');
        expect(() => läsPurl('pkg:pypi/x@1')).toThrow(/okänd paketadress/);
    });
});

describe('säkerhet: bibliotekens versioner stämmer i dokumentationen', () => {
    // Versionen läses ur själva biblioteksfilen, så att en uppgradering inte kan lämna
    // gamla versionsnummer i licenstexterna, Om verktyget eller TREDJEPARTSLICENSER.md.
    const version = (fil, re) => { const m = läs(`vendor/${fil}`).slice(0, 3000).match(re); if (!m) throw new Error(`ingen version i ${fil}`); return m[1]; };
    const BIBLIOTEK = [
        ['PapaParse', version('papaparse.min.js', /Papa Parse\s+v(\d+\.\d+\.\d+)/)],
        ['JSZip', version('jszip.min.js', /JSZip v(\d+\.\d+\.\d+)/)],
        ['SheetJS', version('xlsx.mini.min.js', /version="(\d+\.\d+\.\d+)"/)],
        ['D3', version('d3.min.js', /d3js\.org v(\d+\.\d+\.\d+)/)],
    ];
    it('licenstexten, Om verktyget och TREDJEPARTSLICENSER.md anger bibliotekens faktiska versioner', () => {
        const licenser = läs('src/licenser.txt'), om = läs('src/app/65-om-verktyget.js'), md = läs('TREDJEPARTSLICENSER.md');
        for (const [namn, v] of BIBLIOTEK) {
            expect(licenser, `licenser.txt: ${namn} ${v}`).toMatch(new RegExp(`${regexEscape(namn)}[^\\n]*\\b${regexEscape(v)}\\b`));
            expect(om, `Om verktyget: ${namn} ${v}`).toMatch(new RegExp(`${regexEscape(namn)}[^<]*</td><td>${regexEscape(v)}</td>`));
            expect(md, `TREDJEPARTSLICENSER.md: ${namn} ${v}`).toMatch(new RegExp(`^\\| ${regexEscape(namn)}[^|\\n]* \\| ${regexEscape(v)}\\b`, 'm'));
        }
    });
});

describe('[S2] lagringsspärren', () => {
    it('lagringsspärren har inget undantag: varje skrivning till localStorage och sessionStorage kastar', () => {
        const w = createAppWindow();
        for (const nyckel of ['x', 'd3']) {
            expect(() => w.localStorage.setItem(nyckel, '1'), nyckel).toThrow(/Persistent storage forbidden/);
            expect(() => w.sessionStorage.setItem(nyckel, '1'), nyckel).toThrow(/Persistent storage forbidden/);
        }
        expect(läs('src/app/00-sakerhet-och-uppstart.js')).not.toMatch(/stack\.includes|startsWith\(/);
    });
    it('direkt tilldelning till lagringen kastar också, och ingenting lagras', () => {
        const w = createAppWindow();
        for (const lager of ['localStorage', 'sessionStorage']) {
            expect(() => w.eval(`${lager}.x = '1'`), lager).toThrow(/Persistent storage forbidden/);
            expect(() => w.eval(`${lager}['lon'] = '31000'`), lager).toThrow(/Persistent storage forbidden/);
            expect(() => w.eval(`Object.defineProperty(${lager}, 'y', { value: '1' })`), lager).toThrow(/Persistent storage forbidden/);
            expect(w.eval(`${lager}.length`), lager).toBe(0);
            // Läsning och rensning fungerar som vanligt.
            expect(w.eval(`${lager}.getItem('x')`), lager).toBeNull();
            expect(() => w.eval(`${lager}.removeItem('x'); ${lager}.clear();`), lager).not.toThrow();
        }
    });
});

// Statusfärgernas kontrast prövas i tests/farger.test.js; här prövas att de för ljusa nyanserna inte används.
describe('för ljusa statusnyanser används inte som text', () => {
    it('för ljusa statusnyanser (under 4,5:1 som text) står inte i vyerna, sidan eller stilmallen', async () => {
        const { readdirSync } = await import('node:fs');
        // Diagrammens palett (10-diagram*.js) har egna färger för serier, prövade för sig (3:1 för grafik).
        const filer = [...readdirSync('src/app').filter(f => /^\d\d-.*\.js$/.test(f) && !/^10-diagram/.test(f)).map(f => `src/app/${f}`), 'src/index.html', 'src/style.css'];
        const forLjusa = /#(ef4444|f59e0b|10b981|059669|d97706|dc2626)\b/i;
        expect(filer.filter(f => forLjusa.test(läs(f)))).toEqual([]);
        // Word-utkastets egna ramar (src/lib/docx.js skriver färger utan #): bärnsten som duger som kant mot vitt.
        expect(läs('src/lib/docx.js')).not.toMatch(/['"](EF4444|F59E0B|10B981|059669|D97706|DC2626|D4A017)['"]/i);
    });
});

describe('diagram: beskrivning för skärmläsare, svenska talformat och Pareto', () => {
    let w, diagram, karnans;
    beforeAll(async () => {
        w = createAppWindow();
        w.__lasInDemodata();
        for (const t of ['dashboard', 'matrix', 'likvardighet', 'struktur', 'prioritering', 'loneoversyn',
            'handlingsplan', 'kon', 'utforska', 'benchmark']) w.__ritaFlik(t);
        await new Promise(r => setTimeout(r, 300));
        diagram = [...w.document.querySelectorAll('*')].filter(el => el.layout && el.data);   // ska vara tom: inget annat ritar diagram
        karnans = [...w.document.querySelectorAll('*')].filter(el => el._figur);   // ritade av diagramkärnan (ADR-39)
    });
    it('varje diagram har role="img" och en beskrivning (WCAG 1.1.1)', () => {
        // Vakten hindrar att ett nytt diagram läggs till utan beskrivning — och att något ritas förbi diagramkärnan.
        expect(diagram.map(el => el.id)).toEqual([]);
        // Diagrammen bär beskrivningen på sin egen <svg role="group">, med ritytan som role="img".
        expect(karnans.length).toBeGreaterThan(12);
        const utanK = karnans.filter(el => {
            const svg = el.querySelector(':scope > svg[role="group"]');
            return svg && !((svg.getAttribute('aria-label') || '').trim().length > 10 && svg.querySelector('[role="img"]'));
        }).map(el => el.id);
        expect(utanK).toEqual([]);
    });
    it('alla diagram använder decimalkomma och mellanslag som tusentalsavgränsare', () => {
        // Axlarnas tal skrivs av talformat (src/lib/figur.js): aldrig decimalpunkt, aldrig komma som tusentalsavgränsare.
        const axeltext = karnans.flatMap(el => [...el.querySelectorAll('text[data-axel]')].map(t => t.firstChild ? t.firstChild.textContent : ''));
        expect(axeltext.length).toBeGreaterThan(40);
        expect(axeltext.filter(t => /^\d+\.\d+$/.test(t) || /\d,\d{3}\b/.test(t))).toEqual([]);
    });
    it('Pareto: ritas av diagramkärnan med raka etiketter (inga lutande namn att krocka med)', () => {
        const svg = w.document.getElementById('chart-prio-pareto').querySelector(':scope > svg');
        expect(svg).not.toBeNull();
        expect([...svg.querySelectorAll('text[data-axel="x"]')].every(t => !/rotate/.test(t.getAttribute('transform') || ''))).toBe(true);
    });
});

describe('[S5] namnen: inga hårdkodade etiketter', () => {
    it('etiketterna läser orgNamn/jmfNamn', async () => {
        const { readFileSync, readdirSync } = await import('node:fs');
        const dir = new URL('../src/app/', import.meta.url);
        const forbjudna = [/name:\s*'Organisationen/, />Median org\.</, />Kvinnodom\. yrke \(org\.\)</, /'Median i jämförelsestatistiken'/,
            /label:\s*'— Jämförelsestatistik'/, /label:\s*'jämförelsestatistiken'/];
        const traffar = [];
        for (const f of readdirSync(dir).filter(f => /^\d\d-.*\.js$/.test(f))) {
            const src = readFileSync(new URL(f, dir), 'utf8');
            for (const re of forbjudna) if (re.test(src)) traffar.push(`${f}: ${re}`);
        }
        expect(traffar).toEqual([]);
    });
});

describe('säkerhet: inga style-attribut i markeringen (ADR-30, ADR-43)', () => {
    // CSP:n har style-src-attr 'none': ett style="…" som kommer in som markering (index.html, innerHTML-mallar, setAttribute)
    // blockeras. Stilen står i klasser i src/style.css; uträknade mått skrivs som data-stil-* och sätts via CSSOM
    // (tillampaDataStil i 03-hjalpfunktioner.js), som CSP:n inte rör. el.style.x = … i skript är därför tillåtet.
    // Exportmallarna (58-rapportmodell, 62-word-utkast, 60-utskrift, 24-excelexport, 64-jamforelse-export) bygger HTML som inte
    // renderas i dokumentet — men 58 och 62 tolkas med DOMParser, som ärver CSP:n (Chromium rapporterar varje style-attribut där),
    // och 60 skriver PDF-rapporten i #print-report. Därför gäller förbudet också dem; ett undantag ska stå här med ett antal.
    const EXPORTMALLAR = {};
    const utanKommentarer = js => js.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\s\/\/ .*$/gm, '');
    const stilAttribut = text => (text.match(/[\s'"`]style\s*=\s*\\?["']/g) || []).length;
    it('index.html och mallarna i src/app/ har inga style-attribut (utom de uppräknade exportmallarna)', () => {
        const fynd = {};
        for (const f of readdirSync(join(ROOT, 'src/app')).filter(f => f.endsWith('.js'))) {
            const n = stilAttribut(utanKommentarer(läs(`src/app/${f}`)));
            if (n !== (EXPORTMALLAR[f] || 0)) fynd[f] = n;
        }
        const sida = stilAttribut(utanHtmlKommentarer(läs('src/index.html')));
        if (sida) fynd['src/index.html'] = sida;
        expect(fynd).toEqual({});
    });
    it('det byggda skalet (utanför skripten) har inga style-attribut', () => {
        const skal = utanSkript(läs('dist/oppen-lonekartlaggning.html')).replace(/<style>[\s\S]*?<\/style>/g, '');
        expect(skal.match(/\sstyle\s*=/g) || []).toEqual([]);
    });
    it('filer som skriver data-stil-* anropar tillampaDataStil, och hjälparen sätter bara bredd och läge', () => {
        // byggStapelcell (05) ger bara en cell; tabellen byggs och sätts in i 55-prioritering.js, som anropar hjälparen.
        const KONSUMENT = { '05-tabeller-och-lankar.js': '55-prioritering.js' };
        const utan = [];
        for (const f of readdirSync(join(ROOT, 'src/app')).filter(f => f.endsWith('.js') && f !== '03-hjalpfunktioner.js')) {
            const js = utanKommentarer(läs(`src/app/${f}`));
            const anropar = /tillampaDataStil\(/.test(utanKommentarer(läs(`src/app/${KONSUMENT[f] || f}`)));
            if (/data-stil-/.test(js) && !anropar) utan.push(f);
        }
        expect(utan).toEqual([]);
        expect(läs('src/app/03-hjalpfunktioner.js')).toContain("const DATA_STIL = [['data-stil-bredd', 'width'], ['data-stil-vanster', 'left'], ['data-stil-mvanster', 'marginLeft']];");
    });
    it('skript sätter inget style-attribut med setAttribute eller D3:s .attr("style")', () => {
        const traffar = [];
        for (const f of readdirSync(join(ROOT, 'src/app')).filter(f => f.endsWith('.js'))) {
            if (/setAttribute\(\s*['"]style['"]|\.attr\(\s*['"]style['"]/.test(utanKommentarer(läs(`src/app/${f}`)))) traffar.push(f);
        }
        expect(traffar).toEqual([]);
    });
});

describe('beräkningsbevisen: värden ur lönefilen escapas i bevisrutans HTML', () => {
    // intro, formula och footer skrivs som HTML i bevisrutan (_oppnaBevisruta). Ett BAS-värde ur filen med
    // HTML-tecken ska komma ut som text, med och utan ålder i lönefilen.
    it('per-BAS-regressionens intro bär BAS escapat', () => {
        const w = createAppWindow();
        const bas = '<b>x</b>';
        for (const alder of [true, false]) {
            w.eval(`harAlder = () => ${alder};`);
            const p = w.eval(`_bevisForPerBasRad({ bas: ${JSON.stringify(bas)}, status: 'ok', n: 40, kvN: 20, maN: 20, gapPct: -2, ciLow: -4, ciHigh: 0, pValue: 0.2, R2: 0.1 }, null)`);
            expect(p.intro).toContain('&lt;b&gt;x&lt;/b&gt;');
            expect(p.intro).not.toContain(bas);
        }
    });
});

/**
 * Säkerhetshärdning: CSP för stilar, låsta tredjepartsbibliotek,
 * en enda escaping-funktion, utskriftsfönstret och låsta CI-steg.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { createAppWindow } from './helpers/app-harness.js';

const ROOT = join(import.meta.dirname, '..');
const läs = f => readFileSync(join(ROOT, f), 'utf8');
const sha256b64 = s => createHash('sha256').update(s, 'utf8').digest('base64');

describe('säkerhet: CSP för stilar i bygget', () => {
    const html = läs('dist/oppen-lonekartlaggning.html');
    const csp = html.match(/http-equiv="Content-Security-Policy" content="([^"]+)"/)[1];
    const direktiv = Object.fromEntries(csp.split(';').map(d => d.trim()).filter(Boolean).map(d => {
        const [namn, ...värden] = d.split(/\s+/);
        return [namn, värden];
    }));
    it('style-elementen kräver kontrollsumma; bara stilattribut får vara inline', () => {
        expect(direktiv['style-src-elem']).toBeDefined();
        expect(direktiv['style-src-elem']).not.toContain("'unsafe-inline'");
        expect(direktiv['style-src-attr']).toEqual(["'none'"]);   // inga style-attribut i markeringen (ADR-30, ADR-43); utan direktivet gäller style-src 'unsafe-inline'
    });
    it('varje <style>-block i bygget har sin kontrollsumma i CSP:n — och en tom stilmall har ingen', () => {
        // Bara riktiga element: text inuti skripten (mallsträngar) räknas inte.
        const utanSkript = html.replace(/<script>[\s\S]*?<\/script>/g, '');
        const block = [...utanSkript.matchAll(/<style>([\s\S]*?)<\/style>/g)].map(m => m[1]);
        expect(block.length).toBeGreaterThanOrEqual(1);
        for (const css of block) expect(direktiv['style-src-elem']).toContain(`'sha256-${sha256b64(css)}'`);
        // En tom stilmall har ingen kontrollsumma: ett bibliotek som skapar en egen <style> blockeras.
        expect(direktiv['style-src-elem']).not.toContain(`'sha256-${sha256b64('')}'`);
        expect(direktiv['style-src-elem']).toHaveLength(block.length);
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
    it('src/app definierar esc() på ett ställe', () => {
        const def = readdirSync(join(ROOT, 'src/app')).filter(f => f.endsWith('.js') && !f.startsWith('09-'))
            .flatMap(f => (läs(`src/app/${f}`).match(/\bconst esc\s*=/g) || []).map(() => f));
        expect(def).toEqual(['01-html-och-tillganglighet.js']);
    });
});

describe('säkerhet: utskriftsfönstret', () => {
    it('rubriken escapas, fönstret får en egen CSP och inga inline-stilblock', () => {
        const w = createAppWindow();
        let skrivet = '';
        const fonster = { document: { write: s => { skrivet += s; }, close() {}, head: null }, focus() {}, print() {} };
        w.open = () => fonster;
        w.eval(`printScaffoldView('view-bestammelser', 'Rubrik <img src=x onerror="window.__xss=1">')`);
        expect(skrivet).not.toContain('<img src=x');
        expect(skrivet).toContain('&lt;img');
        expect(skrivet).toMatch(/<meta http-equiv="Content-Security-Policy" content="default-src 'none';/);
        expect(skrivet).not.toMatch(/<style>/);
    });
});

describe('säkerhet: CI-stegen är låsta på commit', () => {
    const arbetsfloden = readdirSync(join(ROOT, '.github', 'workflows')).filter(f => /\.ya?ml$/.test(f));
    it('arbetsflödena för CI och release finns', () => {
        expect(arbetsfloden).toEqual(expect.arrayContaining(['ci.yml', 'release.yml']));
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
    it('release.yml: grinden körs före bygget, och signeringen är keyless med minsta behörighet', () => {
        const rel = läs('.github/workflows/release.yml');
        expect(rel).toMatch(/^permissions: \{\}$/m);
        expect(rel).toMatch(/id-token: write/);
        expect(rel).toMatch(/fetch-depth: 0/);
        const steg = ['npm ci', 'npm run release:kontroll', 'npm run bundle', 'cosign sign-blob', 'cosign verify-blob', 'gh release create'];
        const jobb = rel.slice(rel.indexOf('\njobs:'));   // kommentaren överst nämner stegen i annan ordning
        const plats = steg.map(s => jobb.indexOf(s));
        expect(plats.every(p => p > 0), steg.join(', ')).toBe(true);
        expect([...plats].sort((a, b) => a - b)).toEqual(plats);
        expect(rel).not.toMatch(/--key\b|COSIGN_PRIVATE_KEY/);
    });
    it('dependabot uppdaterar npm och arbetsflödenas steg', () => {
        const d = läs('.github/dependabot.yml');
        expect(d).toMatch(/package-ecosystem: npm/);
        expect(d).toMatch(/package-ecosystem: github-actions/);
    });
});

describe('säkerhet: bibliotekens versioner stämmer i dokumentationen', () => {
    // Versionen läses ur själva biblioteksfilen, så att en uppgradering inte kan lämna
    // gamla versionsnummer i licenstexterna, Om verktyget eller LICENSES.md.
    const version = (fil, re) => { const m = läs(`vendor/${fil}`).slice(0, 3000).match(re); if (!m) throw new Error(`ingen version i ${fil}`); return m[1]; };
    const BIBLIOTEK = [
        ['PapaParse', version('papaparse.min.js', /Papa Parse\s+v(\d+\.\d+\.\d+)/)],
        ['JSZip', version('jszip.min.js', /JSZip v(\d+\.\d+\.\d+)/)],
        ['SheetJS', version('xlsx.mini.min.js', /version="(\d+\.\d+\.\d+)"/)],
        ['D3', version('d3.min.js', /d3js\.org v(\d+\.\d+\.\d+)/)],
    ];
    it('licenstexten, Om verktyget och LICENSES.md anger bibliotekens faktiska versioner', () => {
        const licenser = läs('src/licenser.txt'), om = läs('src/app/65-om-verktyget.js'), md = läs('LICENSES.md');
        for (const [namn, v] of BIBLIOTEK) {
            expect(licenser, `licenser.txt: ${namn} ${v}`).toMatch(new RegExp(`${namn}[^\\n]*\\b${v.replace(/\./g, '\\.')}\\b`));
            expect(om, `Om verktyget: ${namn} ${v}`).toMatch(new RegExp(`${namn}[^<]*</td><td>${v.replace(/\./g, '\\.')}</td>`));
            expect(md, `LICENSES.md: ${namn} ${v}`).toMatch(new RegExp(`## ${namn}[\\s\\S]*?Version:\\*\\* ${v.replace(/\./g, '\\.')}\\b`));
        }
    });
});

describe('lagringsspärren', () => {
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

// Statusfärgerna i gränssnittet används som text mot vitt och ska nå kravet 4,5:1.
describe('gränssnittets statusfärger har kontrast nog för text', () => {
    const lum = hex => { const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(v => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
    const kontrast = hex => 1.05 / (lum(hex) + 0.05);
    it('de tre statusfärgerna har minst 4,5:1 mot vit bakgrund (WCAG 1.4.3)', () => {
        const css = läs('src/style.css');
        for (const namn of ['--status-kritisk', '--status-varning', '--status-ok', '--danger']) {
            const hex = (new RegExp(`${namn}:\\s*(#[0-9a-f]{6})`).exec(css) || [])[1];
            expect(hex, namn).toBeDefined();
            expect(kontrast(hex), `${namn} ${hex}`).toBeGreaterThanOrEqual(4.5);
        }
    });
    it('för ljusa statusnyanser (under 4,5:1 som text) står inte i vyerna, sidan eller stilmallen', async () => {
        const { readdirSync } = await import('node:fs');
        // Diagrammens palett (10-diagram*.js) har egna färger för serier, prövade för sig (3:1 för grafik).
        const filer = [...readdirSync('src/app').filter(f => /^\d\d-.*\.js$/.test(f) && !/^(09-lib-speglar|10-diagram)/.test(f)).map(f => `src/app/${f}`), 'src/index.html', 'src/style.css'];
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
        w.__loadDemoData();
        for (const t of ['dashboard', 'matrix', 'likvardighet', 'struktur', 'prioritering', 'loneoversyn',
            'handlingsplan', 'kon', 'lonepolitik', 'utforska', 'benchmark']) w.__renderTabContent(t);
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
        if (!svg) return;   // inga grupper under referensen i demodatan: kurvan visas inte
        expect([...svg.querySelectorAll('text[data-axel="x"]')].every(t => !/rotate/.test(t.getAttribute('transform') || ''))).toBe(true);
    });
});

describe('namnen: inga hårdkodade etiketter', () => {
    it('etiketterna läser orgNamn/jmfNamn', async () => {
        const { readFileSync, readdirSync } = await import('node:fs');
        const dir = new URL('../src/app/', import.meta.url);
        const forbjudna = [/name:\s*'Organisationen/, />Median org\.</, />Kvinnodom\. yrke \(org\.\)</, /'Median i jämförelsestatistiken'/,
            /label:\s*'— Jämförelsestatistik'/, /label:\s*'jämförelsestatistiken'/];
        const traffar = [];
        for (const f of readdirSync(dir).filter(f => /^\d\d-.*\.js$/.test(f) && f !== '09-lib-speglar.js')) {
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
        const sida = stilAttribut(läs('src/index.html').replace(/<!--[\s\S]*?-->/g, ''));
        if (sida) fynd['src/index.html'] = sida;
        expect(fynd).toEqual({});
    });
    it('det byggda skalet (utanför skripten) har inga style-attribut', () => {
        const skal = läs('dist/oppen-lonekartlaggning.html').replace(/<script>[\s\S]*?<\/script>/g, '').replace(/<style>[\s\S]*?<\/style>/g, '');
        expect(skal.match(/\sstyle\s*=/g) || []).toEqual([]);
    });
    it('filer som skriver data-stil-* anropar tillampaDataStil, och hjälparen sätter bara bredd och läge', () => {
        // buildBarCell (05) ger bara en cell; tabellen byggs och sätts in i 55-prioritering.js, som anropar hjälparen.
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

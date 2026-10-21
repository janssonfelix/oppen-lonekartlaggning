/**
 * Vakt: dokumentationen ska beskriva den BYGGDA versionen (kvalitetskrav K4).
 *
 * Dokumentation glider isär från koden i varje commit: deltabeller som saknar
 * moduler, filer som inte finns, byggkommandon och testantal som inte stämmer.
 * Det som GÅR att kontrollera mekaniskt kontrolleras därför här, så att
 * påståenden om filer, moduler, skript och trösklar inte kan glida isär från
 * koden utan att CI säger ifrån.
 *
 * Det som inte går att mekanisera — om en förklaring är korrekt och begriplig —
 * står kvar som en öppen punkt i docs/utveckling/teknisk-plan.md § 9.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join, basename } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const läs = f => readFileSync(join(root, f), 'utf8');

const PLAN = 'docs/utveckling/teknisk-plan.md';
const planMd = läs(PLAN);
const appReadme = läs('src/app/README.md');
const pkg = JSON.parse(läs('package.json'));
const appDelar = readdirSync(join(root, 'src', 'app')).filter(f => /^\d\d-.*\.js$/.test(f)).sort();

describe('dokumentation: src/app/README.md speglar katalogen', () => {
    it('varje källmodul finns i deltabellen', () => {
        const saknas = appDelar.filter(f => !appReadme.includes('`' + f + '`'));
        expect(saknas, `moduler som saknas i deltabellen: ${saknas.join(', ')}`).toEqual([]);
    });

    it('deltabellen listar inga moduler som inte finns', () => {
        const nämnda = [...appReadme.matchAll(/`(\d\d-[\w.-]+\.js)`/g)].map(m => m[1]);
        const spöken = [...new Set(nämnda)].filter(f => !appDelar.includes(f));
        expect(spöken, `moduler i tabellen som inte finns på disk: ${spöken.join(', ')}`).toEqual([]);
    });
});

describe('dokumentation: teknisk-plan.md stämmer med projektet', () => {
    it('testfilsantalet i den tekniska planen är rätt', () => {
        const testfiler = readdirSync(join(root, 'tests')).filter(f => f.endsWith('.test.js'));
        const m = /Vitest — \d+ tester i (\d+) filer/.exec(planMd);
        expect(m, 'hittade ingen "Vitest — N tester i M filer"-rad i teknisk-plan.md').not.toBeNull();
        expect(
            Number(m[1]),
            `teknisk-plan.md säger ${m[1]} testfiler, katalogen har ${testfiler.length}`
        ).toBe(testfiler.length);
    });

    it('k-anonymitetströskeln i teknisk-plan.md är den som gäller i koden', () => {
        const kod = /const K_STANDARD = (\d+);/.exec(läs('src/app/06-k-anonymitet-och-dataminimering.js'));
        expect(kod).not.toBeNull();
        expect(planMd).toContain(`K_STANDARD = ${kod[1]}`);
    });

    it('alla npm-skript som nämns finns i package.json', () => {
        const nämnda = [...planMd.matchAll(/`npm run ([\w:]+)`/g)].map(m => m[1]);
        expect(nämnda.length).toBeGreaterThan(0);
        const okända = [...new Set(nämnda)].filter(n => !pkg.scripts[n]);
        expect(okända, `npm-skript som inte finns: ${okända.join(', ')}`).toEqual([]);
    });

    // Hela planen beskriver nuläget, så varje fil den pekar ut ska finnas.
    it('filerna som den tekniska planen pekar ut finns på disk', () => {
        const kandidater = [...planMd.matchAll(/`([\w.-]+\/[\w./-]+\.(?:js|mjs|json|md|html|css|txt|yml))`/g)]
            .map(m => m[1])
            .filter(f => !f.includes('*'));
        expect(kandidater.length).toBeGreaterThan(0);
        const saknade = [...new Set(kandidater)].filter(f => !existsSync(join(root, f)));
        expect(saknade, `planen pekar ut filer som inte finns: ${saknade.join(', ')}`).toEqual([]);
    });
});

describe('dokumentation: CHANGELOG är kronologisk', () => {
    it('versionsrubrikerna står i fallande datumordning', () => {
        const rubriker = [...läs('CHANGELOG.md').matchAll(/^## (\d{4})\.(\d{2})\.(\d{2})/gm)]
            .map(m => `${m[1]}-${m[2]}-${m[3]}`);
        expect(rubriker.length).toBeGreaterThan(0);
        const sorterad = [...rubriker].sort().reverse();
        expect(rubriker, 'CHANGELOG-posterna ligger inte i fallande datumordning').toEqual(sorterad);
    });

    it('den översta posten är inte nyare än VERSION', () => {
        const version = läs('VERSION').trim().replace(/\./g, '-');
        const första = /^## (\d{4})\.(\d{2})\.(\d{2})/m.exec(läs('CHANGELOG.md'));
        expect(`${första[1]}-${första[2]}-${första[3]}` <= version).toBe(true);
    });
});

describe('dokumentation: k-tröskeln beskrivs med rätt tal överallt', () => {
    // Användaren kan ändra tröskeln (ADR-38): appens texter
    // fylls i ur kTroskel() (vaktas i ktroskel.test.js), och dokumenten nedan anger
    // standardvärdet K_STANDARD.
    const K = Number(/const K_STANDARD = (\d+);/.exec(läs('src/app/06-k-anonymitet-och-dataminimering.js'))[1]);
    const filer = ['docs/dataskydd/dataskydd.md', 'docs/dataskydd/riskanalys.md',
                   'docs/anvandare/sammanfattning-hr-chefer.md', 'docs/anvandare/korguide.md', PLAN];

    for (const fil of filer) {
        it(`${fil}: "färre än/minst N personer" har N = ${K}`, () => {
            const fel = [...läs(fil).matchAll(/(?:färre än|minst) (\d+) personer/g)]
                .map(m => Number(m[1]))
                .filter(n => n !== K);
            expect(fel, `${fil} anger fel tröskel: ${fel.join(', ')}`).toEqual([]);
        });
    }
});

describe('dokumentation: k-tröskeln är en inställning (ADR-38)', () => {
    it('teknisk plan har ADR-38 och nämner kTroskel() och statGolv()', () => {
        expect(planMd).toMatch(/\*\*ADR-38 — /);
        expect(planMd).toContain('kTroskel()');
        expect(planMd).toContain('statGolv()');
    });
    for (const fil of ['docs/dataskydd/dataskydd.md', 'docs/dataskydd/riskanalys.md']) {
        it(`${fil} säger att värdet kan ändras och att det skrivs ut i utdata`, () => {
            const t = läs(fil);
            expect(t).toMatch(/standard(värdet)? (är )?10/i);
            expect(t).toMatch(/kan ändra/);
            expect(t).toMatch(/Tröskeln är sänkt från standardvärdet 10/);
        });
        it(`${fil} påstår inte att varje export eller all utdata bär värdet`, () => {
            expect(läs(fil)).not.toMatch(/i all utdata|varje export (och rapport )?anger|allt som exporteras|i allt som lämnar/);
        });
    }
    // Dataskyddsdokumenten påstår inte mer om skyddet än testerna och utdata håller för, och de
    // säger vad invarianten inte prövar.
    for (const fil of ['docs/dataskydd/dataskydd.md', 'docs/dataskydd/riskanalys.md']) {
        it(`${fil} påstår inte mer om skyddet än testerna och utdata håller för`, () => {
            const t = läs(fil);
            expect(t).not.toMatch(/prövas automatiskt på alla flikar och exporter/);
            expect(t).not.toMatch(/på alla flikar och (alla )?exporter/);
            expect(t).not.toMatch(/aggregat för grupper över tröskeln/);
            expect(t).not.toMatch(/invarianten vid tre värden/);
            // Utdata är inte enbart aggregat: ZIP-filens bilder av spridningsdiagrammen har en punkt per anställd.
            // Word och PDF bär bara diagram över grupper.
            expect(t).toMatch(/en punkt per anställd/);
            // Vad invarianten inte prövar ska stå utskrivet.
            expect(t).toMatch(/prövar inte|Inte prövat/);
        });
    }
    it('dokumenten säger inte att en konfigurationsfil utan fältet ger 10, eller att ett paket alltid bär tröskeln', () => {
        for (const fil of ['docs/dataskydd/dataskydd.md', 'docs/dataskydd/riskanalys.md', PLAN, 'CHANGELOG.md',
                           'docs/anvandare/korguide.md', 'docs/anvandare/organisationspaket.md']) {
            const t = läs(fil);
            expect(t, fil).not.toMatch(/fil\s+utan fältet ger 10/);
            expect(t, fil).not.toMatch(/alltid bär tröskeln|bär alltid\s+tröskeln/);
            expect(t, fil).not.toMatch(/lämnar ut par/);   // "lämnar ut" betyder röjer; "utelämnar" avses
        }
    });
    it('körguiden och organisationspaketets guide beskriver inställningen', () => {
        expect(läs('docs/anvandare/korguide.md')).toContain('Minsta gruppstorlek för redovisning');
        expect(läs('docs/anvandare/organisationspaket.md')).toContain('Minsta gruppstorlek för redovisning');
    });
});

describe('dokumentation: dataskyddstexterna följer ADR-14 och ADR-15', () => {
    // Utforska visar små grupper tonade och exporten utelämnar dem bara när rutan
    // är urkryssad (ADR-14); formler i CSV/urklipp neutraliseras (ADR-15). De texter
    // ett dataskyddsombud läser först beskriver just det.
    const texter = ['docs/dataskydd/dataskydd.md', 'docs/dataskydd/riskanalys.md',
                    'src/app/60-utskrift.js', 'src/app/62-word-utkast.js', 'src/app/65-om-verktyget.js',
                    'src/app/04-ordlista.js', 'src/app/06-k-anonymitet-och-dataminimering.js'];
    for (const fil of texter) {
        it(`${fil}: påstår inte att små grupper aldrig syns i någon utdata`, () => {
            expect(läs(fil)).not.toMatch(/redovisas inte i någon utdata/);
        });
    }
    for (const fil of ['docs/dataskydd/dataskydd.md', 'docs/dataskydd/riskanalys.md']) {
        it(`${fil}: beskriver undantaget i Utforska (ADR-14) och formelskyddet (ADR-15)`, () => {
            const t = läs(fil);
            expect(t).toMatch(/ADR-14/);
            expect(t).toMatch(/ADR-15/);
        });
    }
});

describe('dokumentation: användarnära texter', () => {
    const anvandartexter = ['src/index.html', 'src/app/60-utskrift.js', 'src/app/62-word-utkast.js',
        'src/app/65-om-verktyget.js', 'src/app/04-ordlista.js', 'src/app/06-k-anonymitet-och-dataminimering.js',
        'src/app/51-lika-arbete-regressionskort.js', 'src/app/52-livscykel.js', 'docs/anvandare/korguide.md', 'docs/anvandare/sammanfattning-hr-chefer.md',
        'docs/anvandare/pilotchecklista.md', 'docs/anvandare/datauttag.md', 'docs/dataskydd/dataskydd.md',
        'docs/anvandare/sakerhetsbeskrivning.md', 'docs/anvandare/tillganglighetsredogorelse.md', 'docs/anvandare/information-till-anstallda.md',
        'docs/dataskydd/riskanalys.md'];

    // p-värdet är sannolikheten för ett så stort utslag OM det inte fanns någon
    // verklig skillnad — inte sannolikheten att resultatet "beror på slump".
    for (const fil of anvandartexter) {
        it(`${fil}: förklarar inte p-värdet som sannolikheten att resultatet beror på slump`, () => {
            expect(läs(fil)).not.toMatch(/sannolikhet att resultatet beror på (slump|slumpmässig)/);
        });
    }

    // Hänvisningar med sökväg ska finnas relativt roten eller det hänvisande dokumentet;
    // ett bart filnamn (t.ex. "datauttag.md" i appens hjälptext) ska finnas någonstans i repot.
    const mdFiler = (() => {
        const ut = [];
        const gå = dir => {
            for (const e of readdirSync(join(root, dir), { withFileTypes: true })) {
                if (e.name === 'node_modules' || e.name.startsWith('.')) continue;   // dolda kataloger: git och lokala verktyg
                const rel = dir ? `${dir}/${e.name}` : e.name;
                if (e.isDirectory()) gå(rel); else if (e.name.endsWith('.md')) ut.push(rel);
            }
        };
        gå('');
        return new Set(ut.map(f => basename(f)));
    })();
    it('alla .md-dokument som användartexterna hänvisar till finns', () => {
        const saknas = [];
        for (const fil of anvandartexter) {
            for (const m of läs(fil).matchAll(/(?<![\w/.-])((?:[\w.-]+\/)*[A-Za-z0-9][\w.-]*\.md)\b/g)) {
                const ref = m[1];
                const finns = ref.includes('/')
                    ? existsSync(join(root, ref)) || existsSync(join(root, dirname(fil), ref))
                    : mdFiler.has(ref);
                if (!finns) saknas.push(`${fil} → ${ref}`);
            }
        }
        expect([...new Set(saknas)]).toEqual([]);
    });
});

describe('dokumentation: licenstexterna följer med den byggda filen', () => {
    // MIT och Apache 2.0 kräver att licenstexten följer med varje kopia. LICENSES.md
    // distribueras inte med HTML-filen, så texterna byggs in i den (src/licenser.txt).
    const bygge = läs('dist/oppen-lonekartlaggning.html');
    it('fullständiga MIT-texter för PapaParse, JSZip och pako, och ISC-texten för D3', () => {
        expect((bygge.match(/Permission is hereby granted, free of charge/g) || []).length).toBeGreaterThanOrEqual(3);
        for (const namn of ['Matthew Holt', 'Stuart Knightley', 'Vitaly Puzrin', 'Mike Bostock']) expect(bygge).toContain(namn);
        expect(bygge).toMatch(/Permission to use, copy, modify, and\/or distribute this software/);   // ISC
    });
    it('Apache License 2.0 i sin helhet för SheetJS', () => {
        expect(bygge).toContain('SheetJS LLC');
        expect(bygge).toMatch(/Apache License\s+Version 2\.0, January 2004/);
        expect(bygge).toContain('END OF TERMS AND CONDITIONS');
    });
    it('texterna ligger i en inaktiv mall, inte i ett skript (CSP-hasharna är oförändrade)', () => {
        expect(bygge).toMatch(/<template id="licenstexter">/);
        // Efter sista skriptet: biblioteken innehåller själva '</body>', och en infogning där
        // bryter skriptets CSP-hash.
        expect(bygge.indexOf('<template id="licenstexter">')).toBeGreaterThan(bygge.lastIndexOf('</script>'));
    });
    it('den publicerade filen har inget inbakat organisationspaket (organisationsfilen skapas av systemägaren)', () => {
        // Strängen byggs ihop så att inte sökningen träffar sin egen källkod i bygget.
        const mall = '<' + 'template id="inbakat-' + 'organisationspaket"';
        expect(bygge.slice(bygge.lastIndexOf('</script>'))).not.toContain(mall);
    });
});

describe('vakt: inga spår av tidigare versioner eller namngivna organisationer', () => {
    // Verktyget är ett öppet projekt: ingen inbyggd arbetsgivare, inget tidigare diagrambibliotek, inget
    // tidigare produktnamn, inga borttagna verktyg. Orden står bara som kontrollsummor (SHA-256, 16 tecken),
    // så att inte heller vakten bär dem. Texten normaliseras (gemener, utan diakritiska tecken) och delas i ord;
    // ordföljder om ett till tre ord jämförs. PREFIX: ordföljden börjar med ordet (nyckeln är ordets längd).
    // EXAKT: hela ordföljden. Ett nytt ord läggs till med kontrollsumman av dess normaliserade form:
    //   node -e "const s=process.argv[1].normalize('NFD').replace(/\p{M}/gu,'').toLowerCase();console.log(s.length,require('crypto').createHash('sha256').update(s).digest('hex').slice(0,16))" "Ordet"
    const PREFIX = { 6: ['5536a646767eeca5'], 8: ['38e6bcd7fe7d4979'], 10: ['4ff103b68f160fd2'], 11: ['b225390a8984c8de'],
        12: ['873cbfbe8f1e4870'], 14: ['18b7fdefbcdf5b06'], 15: ['1233afb9089e16ca'], 21: ['9689275bf45a18f3'], 24: ['a86a1996dd3b22b0'] };
    const EXAKT = new Set(['5d9b3a5c535dfba6', '0c75ab591994bb7a', 'ab20b314b3d3ac43', '7d03bf86a3732b23',
        '1e0fb1ad0799b31d', '495d7842aa80549a', 'be3b5ed12e072cc3', '7c38d5864015fc72']);
    const summor = new Map();
    const summa = s => { let v = summor.get(s); if (v === undefined) { v = createHash('sha256').update(s).digest('hex').slice(0, 16); summor.set(s, v); } return v; };
    const ord = text => text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().match(/[\p{L}\p{N}_]+/gu) || [];
    const vakt = (prefix, exakt) => {
        const prefixSummor = new Map(Object.entries(prefix).map(([l, s]) => [Number(l), new Set(s)]));
        return text => {
            const o = ord(text);
            for (let i = 0; i < o.length; i++) {
                const följd = [o[i], `${o[i]} ${o[i + 1]}`, `${o[i]} ${o[i + 1]} ${o[i + 2]}`].slice(0, Math.min(3, o.length - i));
                if (följd.some(f => exakt.has(summa(f)))) return följd[0];
                const längst = följd[följd.length - 1];
                for (const [l, s] of prefixSummor) if (längst.length >= l && s.has(summa(längst.slice(0, l)))) return följd[0];
            }
            return null;
        };
    };
    const förbjudet = vakt(PREFIX, EXAKT);
    const HOPPA = /^(node_modules|\.git|\.claude|vendor|package-lock\.json)(\/|$)/;
    const spårade = () => execSync('git ls-files', { cwd: root, encoding: 'utf8' }).split('\n')
        .filter(f => f && !HOPPA.test(f));
    const textfil = f => /\.(js|mjs|html|css|md|json|txt|yml|snap|gitignore)$/.test(f) || /^(NOTICE|LICENSE|VERSION|\.gitignore)$/.test(basename(f));
    it('vakten fångar prefix, exakta ordföljder, versaler, diakritiska tecken och skiljetecken', () => {
        const prov = vakt({ 7: [summa('exempel')], 11: [summa('tva ordbitt')] }, new Set([summa('ett'), summa('tre ord har')]));
        for (const fras of ['Exempelorden', 'EXEMPEL', 'éxempel', 'TVÅ Ordbitten', 'ett', 'Ett.', 'tre-ord, HAR'])
            expect(prov(`text ${fras} text`), fras).not.toBeNull();
        for (const fras of ['exempl', 'ettan', 'tva ord', 'tre ord', 'ordexempel'])
            expect(prov(`text ${fras} text`), fras).toBeNull();
    });
    it('ingen spårad textfil i repot bär ett förbjudet ord', () => {
        const traffar = spårade().filter(textfil).filter(f => existsSync(join(root, f)))
            .map(f => [f, förbjudet(läs(f))]).filter(([, t]) => t !== null).map(([f]) => f);
        expect(traffar).toEqual([]);
    });
    it('menyns rubrik bär produktnamnet', () => {
        expect(läs('src/index.html')).toMatch(/<div class="sidebar-header">\s*<h2>Öppen lönekartläggning<\/h2>/);
    });
    it('den byggda filen heter oppen-lonekartlaggning.html och bär namnet', () => {
        expect(existsSync(join(root, 'dist', 'oppen-lonekartlaggning.html'))).toBe(true);
        expect(läs('dist/oppen-lonekartlaggning.html')).toContain('<title>Öppen lönekartläggning</title>');
        expect(läs('dist/RELEASE.txt')).toContain('oppen-lonekartlaggning.html');
    });
});

describe('den tekniska planen beskriver nuläget', () => {
    const plan = läs('docs/utveckling/teknisk-plan.md');
    it('ADR-loggen bär inga datum i rubrikerna och inga beslut om tidigare lägen', () => {
        const rubriker = [...plan.matchAll(/^\*\*ADR-(\d+) — ([^*]+)\*\*/gm)];
        expect(rubriker.length).toBeGreaterThan(20);
        for (const [hel] of rubriker) expect(hel, hel).not.toMatch(/\(\d{4}-\d{2}(-\d{2})?[^)]*\)/);
        expect(plan).not.toMatch(/ersätter ADR-|ersatt av ADR-|Delvis ersatt/);
    });
    it('varje ADR som koden, testerna och dokumenten pekar på finns i planen', () => {
        const finns = new Set([...plan.matchAll(/^\*\*ADR-(\d+) —/gm)].map(m => Number(m[1])));
        const gå = dir => readdirSync(join(root, dir), { withFileTypes: true }).flatMap(e =>
            e.isDirectory() ? gå(`${dir}/${e.name}`) : [`${dir}/${e.name}`]);
        const filer = [...gå('src'), ...gå('tools'), ...gå('tests'), ...gå('docs')]
            .filter(f => /\.(js|mjs|html|css|md)$/.test(f) && !f.endsWith('09-lib-speglar.js'));
        const saknas = filer.flatMap(f => [...läs(f).matchAll(/ADR-(\d+)\b/g)].map(m => Number(m[1])).filter(n => !finns.has(n)).map(n => `${f}: ADR-${n}`));
        expect([...new Set(saknas)]).toEqual([]);
    });
    it('inga länkar till arbetsverktyg och inga väntande platshållare för lönesystem', () => {
        expect(plan).not.toMatch(/väntar på systemförvaltarna|är platshållare/);
    });
});

describe('riskanalysen beskriver det aktuella bygget, inte vägen dit', () => {
    const ra = läs('docs/dataskydd/riskanalys.md');
    it('ett granskningsdatum, inga tidigare granskningar, ingen tidslinje', () => {
        expect(ra).not.toMatch(/föregående fullständiga granskningar|Härdningstidslinje|omgranskning/);
        expect(ra).not.toMatch(/sedan 20\d\d[-.]\d\d|tillkom 20\d\d-|till och med 20\d\d-|release 20\d\d\.\d\d\.\d\d|bygge 2026\.0[5-9]/);
    });
    it('byggets version och kontrollsumma stämmer med RELEASE.txt', () => {
        const rel = läs('dist/RELEASE.txt');
        const version = /Version:\s+(\S+)/.exec(rel)[1];
        const sha = /SHA-256:\s+([0-9a-f]{64})/.exec(rel)[1];
        expect(ra).toContain(`\`${version}\``);
        expect(ra).toContain(sha);
    });
});

describe('testdata: helt syntetisk generator', () => {
    it('ger rubrikrad och n rader, samma varje gång, utan personnummer', async () => {
        const { byggTestCsv } = await import('../tools/lib/testdata.mjs');
        const a = byggTestCsv(10);
        expect(a).toBe(byggTestCsv(10));
        const rader = a.trim().split('\n');
        expect(rader[0]).toBe('Ansvar;BAS;AID-etikett;Månadslön;Ålder;Kön');
        expect(rader).toHaveLength(11);
        expect(a).not.toMatch(/\b\d{6}[-+]\d{4}\b/);
    });
});

describe('dokumentation: organisationen, inte förvaltningen', () => {
    // "Förvaltning" är kommunal organisationslogik; det är arbetsgivaren som kartlägger. Ordet får inte stå
    // någonstans — inte heller i kodnamn (förkortningen förv/forv före versal, siffra, _ eller ordslut).
    // Verben förvaltar/förvaltad, systemförvaltare och förväntad är tillåtna.
    const FORV = /[Ff][öo]rvaltning|FÖRVALTNING|(?<![\p{L}\p{N}_])[Ff][öo]rv(?=[\p{Lu}\p{N}_.]|(?![\p{L}\p{N}]))/u;
    const gå = dir => readdirSync(join(root, dir), { withFileTypes: true }).flatMap(e =>
        e.isDirectory() ? gå(`${dir}/${e.name}`) : [`${dir}/${e.name}`]);
    it('mönstret fångar ordet och kodnamnen men inte de tillåtna orden', () => {
        for (const t of ['Testförvaltningen', 'forvaltningsBand', "'forvaltning'", 'förvKvDom', 'förv2', 'Förv.', 'const forv =', 'FÖRVALTNING'])
            expect(FORV.test(t), t).toBe(true);
        for (const t of ['förvaltar', 'förvaltad', 'systemförvaltare', 'förväntad', 'forvantat', 'förval', 'förvaras'])
            expect(FORV.test(t), t).toBe(false);
    });
    it('varken gränssnitt, exporter, kod, tester eller dokument säger "förvaltning"', () => {
        const filer = [...gå('src'), ...gå('docs'), ...gå('tools'), ...gå('tests'),
            'README.md', 'CONTRIBUTING.md', 'site/index.html', 'dist/app.js', 'dist/oppen-lonekartlaggning.html']
            .filter(f => f !== 'tests/dokumentation.test.js' && !f.startsWith('tools/data/') && /\.(js|mjs|html|md|css|txt|snap)$/.test(f));
        expect(filer.filter(f => FORV.test(läs(f)))).toEqual([]);
    });
});


describe('dokumentation: skripten som nämns finns', () => {
    const pkg = JSON.parse(läs('package.json'));
    it('varje npm-skript som kör ett verktyg pekar på en fil som finns', () => {
        const saknas = Object.entries(pkg.scripts).flatMap(([namn, cmd]) =>
            [...cmd.matchAll(/node (tools\/\S+)/g)].map(m => m[1]).filter(f => !existsSync(join(root, f))).map(f => `${namn}: ${f}`));
        expect(saknas).toEqual([]);
    });
    it('varje "npm run …" i README och CONTRIBUTING finns i package.json', () => {
        for (const f of ['README.md', 'CONTRIBUTING.md']) {
            for (const [, namn] of läs(f).matchAll(/npm run ([\w:-]+)/g)) expect(pkg.scripts, `${f}: npm run ${namn}`).toHaveProperty([namn]);
        }
    });
});

describe('dokumentation: kodbasen är redo att publiceras', () => {
    it('inga datafiler (csv, xlsx, xls) är incheckade', () => {
        const filer = execSync('git ls-files', { cwd: root, encoding: 'utf8' }).split('\n')
            .filter(f => /\.(csv|xlsx|xls)$/i.test(f));
        expect(filer).toEqual([]);
    });
    it('README, CONTRIBUTING och SECURITY finns och nämner licensen och kontaktvägen', () => {
        const readme = läs('README.md');
        expect(readme).toMatch(/MIT-licensen/);
        expect(readme).toMatch(/Prova/);
        expect(läs('CONTRIBUTING.md')).toMatch(/MIT-licensen/);
        // En funktionsadress, inte en privat adress.
        expect(läs('SECURITY.md')).toMatch(/oppen-lonekartlaggning@proton\.me/);
        expect(läs('SECURITY.md')).not.toMatch(/gmail/i);
    });
    it('.gitignore utesluter lokal data och arbetsmappar', () => {
        const g = läs('.gitignore');
        for (const m of ['*.csv', '*.xlsx', '.claude/']) expect(g).toContain(m);
    });
});

describe('dokumentation: licens MIT', () => {
    const gå = dir => readdirSync(join(root, dir), { withFileTypes: true }).flatMap(e =>
        e.isDirectory() ? gå(`${dir}/${e.name}`) : [`${dir}/${e.name}`]);
    it('LICENSE är MIT-texten med upphovspersonen och NOTICE anger licensen', () => {
        const l = läs('LICENSE');
        expect(l).toMatch(/^MIT License\n\nCopyright \(c\) 2026 Felix Jansson/);
        expect(l).toContain('Permission is hereby granted, free of charge');
        expect(läs('NOTICE')).toMatch(/Copyright 2026 Felix Jansson/);
        expect(läs('NOTICE')).toMatch(/SPDX: MIT/);
    });
    it('varje källfil bär licensraden (SPDX)', () => {
        const filer = [...gå('src/app'), ...gå('src/lib'), ...gå('tools'), 'src/index.html', 'src/style.css']
            .filter(f => /\.(js|mjs|html|css)$/.test(f) && !f.endsWith('09-lib-speglar.js'));
        expect(filer.filter(f => !läs(f).slice(0, 400).includes('SPDX-License-Identifier: MIT'))).toEqual([]);
    });
    it('den byggda filen bär verktygets MIT-text och upphovspersonen', () => {
        const b = läs('dist/oppen-lonekartlaggning.html');
        expect(b).toContain('MIT License — Öppen lönekartläggning');
        expect(b).toContain('Copyright (c) 2026 Felix Jansson');
        expect(b).toContain('Copyright 2026 Felix Jansson');
    });
});

describe('dokumentation: AID och ansvarskoden', () => {
    it('dataskyddet nämner ansvarskoden, datauttaget att Ansvar inte läses, planen ADR-33', () => {
        expect(läs('docs/dataskydd/dataskydd.md')).toMatch(/ansvarskod/i);
        expect(läs('docs/dataskydd/riskanalys.md')).toMatch(/ansvarskod/i);
        expect(läs('docs/anvandare/datauttag.md')).toMatch(/Ansvar.{0,80}läses\s+(aldrig|inte)/s);
        expect(planMd).toMatch(/\*\*ADR-33 —/);
    });
});

describe('dokumentation: Jämförelsestatistik', () => {
    it('ADR-35 finns och beskriver k-gränsen för P10/P90', () => {
        const i = planMd.indexOf('**ADR-35 —');
        expect(i).toBeGreaterThan(-1);
        expect(planMd.slice(i, planMd.indexOf('\n**ADR-', i + 1))).toMatch(/P10.*10 personer/s);
    });
});

describe('dokumentation: Översikt och namn', () => {
    it('ADR-36 finns; dataskyddet nämner namnen i konfigurationsfilen', () => {
        expect(planMd).toMatch(/\*\*ADR-36 —/);
        expect(läs('docs/dataskydd/riskanalys.md')).toMatch(/jämförelsestatistikens namn/);
        expect(läs('docs/dataskydd/dataskydd.md')).toMatch(/organisationens namn/i);
    });
});

describe('dokumentation: Word-utkastet som .docx', () => {
    it('ADR-37 finns; körguiden säger .docx', () => {
        expect(planMd).toMatch(/\*\*ADR-37 —/);
        expect(läs('docs/anvandare/korguide.md')).toMatch(/Word-utkast[^\n]*\.docx/);
    });
});

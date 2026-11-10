/**
 * Vakt: dokumentationen ska beskriva den BYGGDA versionen (kvalitetskrav K4).
 *
 * Dokumentation glider isär från koden i varje commit: deltabeller som saknar
 * moduler, filer som inte finns och byggkommandon som inte stämmer.
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

describe('dokumentation: valbar förklaringsmodell (ADR-56)', () => {
    it('teknisk plan har ADR-56 med gränsen 0,5 procentenheter och tilläggen i ADR-46 och ADR-53', () => {
        expect(planMd).toMatch(/\*\*ADR-56 — Valbar förklaringsmodell/);
        expect(planMd).toMatch(/0,5 procentenheter/);
        expect(planMd).toMatch(/ADR-46[^]*?ADR-56/);
        expect(planMd).toMatch(/ADR-53[^]*?valet \(ADR-56\)/);
    });
    it('Om verktyget, körguiden och ändringsloggen beskriver valet', () => {
        expect(läs('src/app/65-om-verktyget.js')).toMatch(/[Ff]örklaringsmodell/);
        expect(läs('src/app/65-om-verktyget.js')).toMatch(/0,5 procentenheter/);
        expect(läs('docs/anvandare/korguide.md')).toMatch(/välja om ålder, BAS-intervall och yrkesgrupp/);
        expect(läs('CHANGELOG.md')).toMatch(/\*\*Valbar förklaringsmodell/);
    });
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
    // Konfidensintervallet säger inte att det sanna värdet "med 95 % sannolikhet" ligger i intervallet.
    const P_FEL = /sannolikhet att resultatet beror på (slump|slumpmässig)|(?:osannolikt|troligt|sannolikhet(?:en)?)\s+(?:att\s+)?(?:skillnaden|resultatet)\s+(?:bara\s+)?(?:beror på|är)\s+(?:slump|slumpen)/;
    const KI_FEL = /ligger med 95 ?% sannolikhet inom/;
    it('mönstren för p-värdet och konfidensintervallet fångar de felaktiga formuleringarna', () => {
        for (const t of ['det är mycket osannolikt att skillnaden beror på slumpen', 'Hur troligt att skillnaden bara är slump',
            'sannolikhet att resultatet beror på slump'])
            expect(P_FEL.test(t), t).toBe(true);
        for (const t of ['en så stor skillnad sällan uppstår av slumpen när ingen finns', 'svår att förklara med slump'])
            expect(P_FEL.test(t), t).toBe(false);
        expect(KI_FEL.test('Det "verkliga" värdet ligger med 95 % sannolikhet inom det angivna intervallet.')).toBe(true);
    });
    for (const fil of anvandartexter) {
        it(`${fil}: förklarar inte p-värdet som sannolikheten att resultatet beror på slump`, () => {
            expect(läs(fil)).not.toMatch(P_FEL);
            expect(läs(fil)).not.toMatch(KI_FEL);
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

describe('produktnamnet', () => {
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


describe('vakt: avförda ord och lagrum i användartexten (språkgenomgången 2026-11)', () => {
    // Ordvalen från språkgenomgången: löneskillnad (inte lönegap eller gap), anställda, BAS-intervall,
    // likvärdigt arbete, lönefil. Lagen hänvisas till med kapitel, aldrig med paragraf eller artikel
    // (ADR-16, docs/utveckling/lagrum.md). Vakten gäller det användaren läser: index.html, strängarna i
    // appen och användar- och dataskyddsdokumenten. Kodkommentarer, identifierare, CHANGELOG,
    // docs/utveckling och testerna ligger utanför; sökregistrets synonymer och ordlistans sok-fält också,
    // så att de gamla orden går att söka på.
    //
    // Kända luckor: Källor-undantaget i Om verktyget gäller hela mallen references (inte rad för rad);
    // index.html prövas rad för rad, så ett ord som bryts över två rader kan slinka igenom; ett avfört ord
    // ensamt i en gemen enordsliteral prövas bara när den är värdet på etikett:, label: eller rubrik:;
    // "gap-" med gement g följt av bindestreck prövas inte (det är klassnamn och id:n).
    const AVFORDA = [
        ['lönegap', /[Ll]önegap|LÖNEGAP/],
        ['gap', /(?<![\p{L}\p{N}_.\-\/`])(?:[Gg]ap(?:et|en)?|[Rr]ågap(?:et)?|[Kk]önsgap(?:et)?)(?![\p{L}\p{N}_\-`])|(?<![\p{L}\p{N}_.\-\/`])Gap-\p{L}/u],
        ['medarbetare', /[Mm]edarbetar/],
        ['likvärdiga arbeten', /likvärdiga arbeten/i],
        ['BAS-nivå', /BAS-nivå(?!\s+[A-ZÅÄÖ]\b)/],
        ['strukturdata', /[Ss]trukturdata|[Ss]trukturfil/],
        ['osakliga gap', /osakliga gap/],
        ['anmälningspliktig', /anmälningspliktig/],
        ['utredningsgräns', /utrednings(?:gräns|tröskel|steg)|obligatorisk utredning|[Ll]agstadgat tröskelvärde/],
        // Klarspråksputsen (K-OR7): "Nära pension", och svenska ord i stället för de engelska och tekniska termerna.
        // Ordlistan får ange den engelska termen inom parentes som förklaring ("(eng. privacy by design)").
        ['Successionszon', /[Ss]uccessions(?:zon|risk)/],
        ['conditional gap', /[Cc]onditional gap/],
        ['Privacy by Design', /Privacy by [Dd]esign/],
        // "vitlista" får stå bredvid kodnamnet ALLOWED_FIELDS; annars "godkända fält".
        ['vitlista', /^(?![\s\S]*ALLOWED_FIELDS)[\s\S]*[Vv]itlist/],
        ['datafunnel', /[Dd]atafunnel/],
        ['lokal-only', /lokal-only/i],
        ['leverage', /[Ll]everage/],
        ['media-mått', /[Mm]edia-mått/],
        ['rekryteringspipeline', /[Rr]ekryteringspipeline/],
    ];
    // I gränssnittet: inget paragraftecken och inget artikelnummer. "3 kap." är tillåtet.
    const LAGRUM_UI = [['§', /§/], ['artikel', /\b[Aa]rt\.\s*\d|[Aa]rtikel\s+\d/]];
    // I dokumenten är "§6.4" en avsnittshänvisning; ett lagrum skrivs "§ 8", "8 §" eller "§§".
    // Dataskyddsdokumenten och informationsmallen behåller dataskyddsförordningens artiklar (lagrum.md).
    const LAGRUM_DOK = [['§', /§\s+\d|\d\s*§|§§/]];

    const traffar = (text, monster) => monster.filter(([, re]) => re.test(text)).map(([n]) => n);
    const utanKommentarer = s => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1');
    // Bara literaler som ser ut som text prövas: med blanksteg eller med versal först. Identifierare
    // som 'lonegapPct' och id:n som 'gap-uppdelning' faller bort.
    const textLiteraler = src => {
        const ut = []; const re = /'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"|`(?:[^`\\]|\\.)*`/g; let m;
        while ((m = re.exec(src))) ut.push(m[0].slice(1, -1).replace(/\$\{[^}]*\}/g, ' '));
        return ut.filter(l => /\s/.test(l) || /^[A-ZÅÄÖ]/.test(l));
    };
    // Värden på etikett:, label: och rubrik: visas för användaren, också när de är ett gement ord.
    const etikettVarden = src => [...src.matchAll(/\b(?:etikett|label|rubrik):\s*(['"`])((?:(?!\1)[^\\\n]|\\.)*)\1/g)].map(m => m[2]);
    const appKalla = (fil, src) => {
        let s = utanKommentarer(src).replace(/synonymer:\s*\[[^\]]*\]/g, '').replace(/sok:\s*'[^']*'/g, '');
        if (fil.endsWith('65-om-verktyget.js')) s = s.replace(/references: \(\) => `[\s\S]*?`/, '');   // Källor
        return s;
    };
    // Attribut som användaren läser (title, aria-label, data-tooltip, alt, placeholder, data-export-label)
    // står kvar som text också när värdet är ett ord; övriga attribut utan blanksteg (id, klass) rensas.
    const htmlText = src => src.replace(/<!--[\s\S]*?-->/g, '').replace(/<script[\s\S]*?<\/script>/g, '')
        .replace(/<style[\s\S]*?<\/style>/g, '')
        .replace(/\s(?:title|aria-label|data-tooltip|alt|placeholder|data-export-label)="([^"]*)"/g, ' [$1] ')
        .replace(/\s[\w-]+="[^"\s]*"/g, '');

    it('mönstren fångar de avförda orden men inte identifierare och tillåtna former', () => {
        for (const t of ['Lönegapet', 'det råa lönegapet', 'Gapet visar', 'ett gap på', 'rågapet', 'Könsgapet',
            'BAS-nivån', 'Ladda upp strukturdata', 'strukturfilen', 'medarbetarna', 'likvärdiga arbeten',
            'osakliga gap', 'anmälningspliktig', 'EU-direktivets utredningströskel', 'Lagstadgat tröskelvärde', 'Gap-analys',
            'i successionszon', 'Hög successionsrisk', 'Per-BAS conditional gap', 'Privacy by Design', 'Privacy by design', 'Urval (datafunnel)', 'bara vitlistade kolumner', 'Fältvitlistan',
            'lokal-only-arkitektur', 'leverage', 'media-mått', 'rekryteringspipelinen'])
            expect(traffar(t, AVFORDA), t).not.toEqual([]);
        for (const t of ['gapPct', 'meanGap', '68-var-uppstar-gapet.js', 'chart-perbas-gap', 'BAS-nivå B',
            'löneskillnad', 'anställda', 'BAS-intervall', 'likvärdigt arbete', 'lönefilen', '`gap`',
            'Nära pension', 'Inbyggt dataskydd', '(eng. privacy by design)', 'bara godkända fält', 'vitlista `ALLOWED_FIELDS`', 'inflytelserika punkter', 'rekryteringen'])
            expect(traffar(t, AVFORDA), t).toEqual([]);
        for (const t of ['(§ 8)', 'art. 9', 'Art. 9', 'artikel 10', '3 kap. 9 §']) expect(traffar(t, LAGRUM_UI), t).not.toEqual([]);
        for (const t of ['Diskrimineringslagen kräver att du analyserar varje skillnad (3 kap.).', 'lagen'])
            expect(traffar(t, LAGRUM_UI), t).toEqual([]);
        for (const t of ['§ 8-bedömningarna', '9 §', '§§ 1–11']) expect(traffar(t, LAGRUM_DOK), t).not.toEqual([]);
        for (const t of ['(§6.4)', 'teknisk-plan §9 punkt 1', '`organisationspaket.md` §5']) expect(traffar(t, LAGRUM_DOK), t).toEqual([]);
    });
    it('strängfiltret prövar text men inte identifierare, kommentarer, synonymer eller ordlistans sok-fält', () => {
        const src = "const lonegapPct = 1; // Lönegapets form\n/* Gapet */ x('gap-uppdelning', 'Gapet visar');\n"
            + "{ synonymer: ['lönegap'] } { sok:'lönegap gap' } y(`Läs in ${'Strukturdata'} först`);";
        expect(textLiteraler(appKalla('x.js', src))).toEqual(['Gapet visar', 'Läs in   först']);
        expect(etikettVarden("gap: { etikett: 'gap', enhet: '%' }, x: { label: 'medellön' }, y: { rubrik: \"Lönegap\" }"))
            .toEqual(['gap', 'medellön', 'Lönegap']);
        expect(htmlText('<th id="lonegap" class="gap" title="Lönegap">Kvinnor</th>')).toBe('<th [Lönegap] >Kvinnor</th>');
    });

    const appFiler = [
        ...appDelar.filter(f => f !== '09-lib-speglar.js').map(f => `src/app/${f}`),
        ...readdirSync(join(root, 'src/lib')).filter(f => f.endsWith('.js')).map(f => `src/lib/${f}`),
    ];
    const dokument = ['README.md',
        ...readdirSync(join(root, 'docs/anvandare')).filter(f => f.endsWith('.md')).map(f => `docs/anvandare/${f}`),
        ...readdirSync(join(root, 'docs/dataskydd')).filter(f => f.endsWith('.md')).map(f => `docs/dataskydd/${f}`)];

    it('strängarna i appen använder inte de avförda orden, paragrafer eller artiklar', () => {
        const fel = appFiler.flatMap(f => { const k = appKalla(f, läs(f)); return [...textLiteraler(k), ...etikettVarden(k)]
            .flatMap(l => traffar(l, [...AVFORDA, ...LAGRUM_UI]).map(n => `${f}: ${n}: ${l.trim().slice(0, 100)}`)); });
        expect(fel).toEqual([]);
    });
    it('index.html använder inte de avförda orden, paragrafer eller artiklar', () => {
        const fel = htmlText(läs('src/index.html')).split('\n').flatMap((l, i) =>
            traffar(l, [...AVFORDA, ...LAGRUM_UI]).map(n => `src/index.html:${i + 1}: ${n}: ${l.trim().slice(0, 100)}`));
        expect(fel).toEqual([]);
    });
    it('användar- och dataskyddsdokumenten använder inte de avförda orden eller paragrafer', () => {
        const fel = dokument.flatMap(f => läs(f).replace(/```[\s\S]*?```/g, m => m.replace(/[^\n]/g, '')).split('\n').flatMap((l, i) =>
            traffar(l, [...AVFORDA, ...LAGRUM_DOK]).map(n => `${f}:${i + 1}: ${n}: ${l.trim().slice(0, 100)}`)));
        expect(fel).toEqual([]);
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
    it('README och dokumenten räknar fälten som kolumnmappningen: fyra obligatoriska, tre valfria (ADR-64)', () => {
        const app = läs('src/app/32-filinlasning.js');
        const roller = [...app.matchAll(/\{ role: '(\w+)'[^}]*required: (true|false)/g)].map(m => [m[1], m[2] === 'true']);
        expect(roller.find(([r]) => r === 'alder')).toEqual(['alder', false]);
        expect(roller.filter(([, k]) => k).map(([r]) => r).sort()).toEqual(['bas', 'kon', 'lon', 'yrke']);
        expect(läs('README.md').replace(/\s+/g, ' ')).toMatch(/fyra obligatoriska, tre valfria/);
        expect(läs('README.md')).not.toMatch(/fem obligatoriska/);
        expect(planMd).toMatch(/\*\*ADR-64 — Ålder är valfri i lönefilen/);
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

/**
 * Vakt: dokumentationen ska beskriva den BYGGDA versionen (princip 4 i docs/utveckling/principer.md).
 *
 * Dokumentation glider isär från koden i varje commit: deltabeller som saknar
 * moduler, filer som inte finns och byggkommandon som inte stämmer.
 * Det som GÅR att kontrollera mekaniskt kontrolleras därför här, så att
 * påståenden om filer, moduler, skript och trösklar inte kan glida isär från
 * koden utan att CI säger ifrån. Språket i det användaren läser vaktas i
 * dokumentation-sprak.test.js.
 *
 * Det som inte går att mekanisera — om en förklaring är korrekt och begriplig —
 * prövas inte här.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { IMPORTPROFIL_ROLLER, OBLIGATORISKA_ROLLER } from '../src/lib/importprofiler.js';
import { ickeTom } from './helpers/paastaende.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const läs = f => readFileSync(join(root, f), 'utf8');

const MAL = 'docs/utveckling/mal.md';
const ADR = 'docs/utveckling/arkitekturbeslut.md';
const adrMd = läs(ADR);
// Utvecklardokumenten vars sökvägar och npm-skript prövas mot projektet.
const UTV_DOK = [MAL, ADR, 'docs/utveckling/oppna-punkter.md'];
const utvMd = UTV_DOK.map(läs).join('\n');
const appReadme = läs('src/app/README.md');
const pkg = JSON.parse(läs('package.json'));
const appDelar = readdirSync(join(root, 'src', 'app')).filter(f => /^\d\d-.*\.js$/.test(f)).sort();
// Alla filer under en katalog, med sökväg från roten.
const gå = dir => readdirSync(join(root, dir), { withFileTypes: true }).flatMap(e =>
    e.isDirectory() ? gå(`${dir}/${e.name}`) : [`${dir}/${e.name}`]);

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

describe('dokumentation: målen, arkitekturbesluten och de öppna punkterna stämmer med projektet', () => {
    it('alla npm-skript som nämns finns i package.json', () => {
        const nämnda = [...utvMd.matchAll(/`npm run ([\w:]+)`/g)].map(m => m[1]);
        expect(nämnda.length).toBeGreaterThan(0);
        const okända = [...new Set(nämnda)].filter(n => !pkg.scripts[n]);
        expect(okända, `npm-skript som inte finns: ${okända.join(', ')}`).toEqual([]);
    });

    it('filerna som dokumenten pekar ut finns på disk', () => {
        const kandidater = [...utvMd.matchAll(/`([\w.-]+\/[\w./-]+\.(?:js|mjs|json|md|html|css|txt|yml))`/g)]
            .map(m => m[1])
            .filter(f => !f.includes('*'));
        expect(kandidater.length).toBeGreaterThan(0);
        const saknade = [...new Set(kandidater)].filter(f => !existsSync(join(root, f)));
        expect(saknade, `dokumenten pekar ut filer som inte finns: ${saknade.join(', ')}`).toEqual([]);
    });

    it('varje fil som ett beslut pekar på under Gäller i dag finns', () => {
        // Pekarna står ofta som bara filnamn; de söks där dokumenten och koden ligger.
        const mappar = ['', 'docs/utveckling/', 'docs/dataskydd/', 'docs/anvandare/', 'docs/'];
        const pekare = [...adrMd.matchAll(/\*Gäller i dag:\*([\s\S]*?)(?=\n\n|\*\*ADR-)/g)]
            .flatMap(m => [...m[1].matchAll(/`([\w./-]+\.(?:md|js|mjs|json))`/g)].map(x => x[1]));
        expect(pekare.length).toBeGreaterThan(50);
        const saknade = [...new Set(pekare)].filter(f => !mappar.some(d => existsSync(join(root, d + f))));
        expect(saknade, `besluten pekar på filer som inte finns: ${saknade.join(', ')}`).toEqual([]);
    });
});

// CLAUDE.md är ingången för AI-assistenter: kort nog att läsas i sin helhet, och den pekar bara på det som finns.
describe('dokumentation: CLAUDE.md är en kort ingång', () => {
    const claudeMd = läs('CLAUDE.md');
    it('CLAUDE.md är högst 60 rader', () => {
        expect(claudeMd.trimEnd().split('\n').length).toBeLessThanOrEqual(60);
    });
    // En sökväg inom backtick: något med snedstreck, eller ett filnamn med ändelse. Ignorerade mappar (privat/)
    // finns inte i en ny klon och prövas inte.
    it('varje fil och mapp som CLAUDE.md pekar ut finns på disk', () => {
        const kandidater = [...new Set([...claudeMd.matchAll(/`([\w.-]+\/[\w./-]*|[\w.-]+\.(?:js|mjs|json|md|html|css|txt|yml))`/g)]
            .map(m => m[1]))];
        expect(kandidater.length).toBeGreaterThan(0);
        let ignorerade = [];
        try {
            ignorerade = execSync('git check-ignore --stdin', { cwd: root, encoding: 'utf8', input: kandidater.join('\n') })
                .split('\n').filter(Boolean);
        } catch { /* git check-ignore avslutar med 1 när ingen sökväg är ignorerad */ }
        const saknade = kandidater.filter(f => !ignorerade.includes(f) && !existsSync(join(root, f)));
        expect(saknade, `CLAUDE.md pekar ut filer som inte finns: ${saknade.join(', ')}`).toEqual([]);
    });
});

// skydd.md är källan för skyddens vakter utanför testsviten (testerna står i spårbarhetsmatrisen): varje fil och mapp det pekar ut ska finnas. En sökväg med snedstreck
// läses från roten; ett bart filnamn (`app.js`, `k-troskeln.md`) ska finnas någonstans i repot. Adresser som
// file:// prövas inte.
describe('dokumentation: skydd.md pekar bara på det som finns', () => {
    it('varje sökväg inom backtick i skydd.md finns på disk', () => {
        const kandidater = [...new Set([...läs('docs/utveckling/skydd.md')
            .matchAll(/`([\w.-]+\/[\w./-]*|[\w.-]+\.(?:js|mjs|json|md|html|css|txt|yml))`/g)]
            .map(m => m[1]).filter(f => !f.includes('://')))];
        expect(kandidater.length).toBeGreaterThan(0);
        const namn = new Set(execSync('git ls-files', { cwd: root, encoding: 'utf8' }).split('\n').map(f => f.split('/').pop()));
        const saknade = kandidater.filter(f => f.includes('/') ? !existsSync(join(root, f)) : !namn.has(f));
        expect(saknade, `skydd.md pekar ut filer som inte finns: ${saknade.join(', ')}`).toEqual([]);
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

describe('dokumentation: k-tröskelns standardvärde står rätt', () => {
    // Källan är K_STANDARD i koden. Användaren kan ändra tröskeln (ADR-38): appens texter fylls i ur kTroskel()
    // (vaktas i ktroskel.test.js), och dokumenten nedan anger standardvärdet. Det här är den enda kontrollen av talet.
    const K = Number(/export const K_STANDARD = (\d+);/.exec(läs('src/lib/ktroskel.js'))[1]);
    const filer = ['docs/dataskydd/dataskydd.md', 'docs/dataskydd/riskanalys.md',
                   'docs/anvandare/sammanfattning-hr-chefer.md', 'docs/anvandare/korguide.md', MAL, ADR];

    for (const fil of filer) {
        it(`${fil}: "färre än/minst N personer" och "standardvärdet N" har N = ${K}`, () => {
            const t = läs(fil);
            const fel = [...t.matchAll(/(?:färre än|minst) (\d+) personer|K_STANDARD = (\d+)|[Ss]tandardvärdet (?:är )?(\d+)\b/g)]
                .map(m => Number(m[1] ?? m[2] ?? m[3]))
                .filter(n => n !== K);
            expect(fel, `${fil} anger fel tröskel: ${fel.join(', ')}`).toEqual([]);
        });
    }
    it('dataskyddsdokumenten anger standardvärdet', () => {
        for (const fil of ['docs/dataskydd/dataskydd.md', 'docs/dataskydd/riskanalys.md'])
            expect(läs(fil), fil).toMatch(new RegExp(`[Ss]tandardvärdet (är )?${K}\\b`));
    });
});


describe('dokumentation: talen för intervallet och golven står rätt', () => {
    // Samma slags vakt som för K_STANDARD ovan: talet läses ur konstanten i koden, och varje dokument som anges måste
    // nämna det minst en gång med mönstret (en vakt som inte hittar något faller) och aldrig med ett annat tal. Ett tal
    // får stå med siffror eller i ord ("fem"). Arkitekturbesluten är en logg och tas inte med: ett äldre beslut får
    // ange det tal som gällde då.
    const konstant = (fil, namn) => Number(new RegExp(`export const ${namn} = (\\d+);`).exec(läs(fil))[1]);
    const ORD = ['noll', 'ett', 'två', 'tre', 'fyra', 'fem', 'sex', 'sju', 'åtta', 'nio', 'tio'];
    const tal = s => (ORD.includes(s) ? ORD.indexOf(s) : Number(s.replace(/\s/g, '')));
    const KT = 'docs/utveckling/k-troskeln.md', DS = 'docs/dataskydd/dataskydd.md', RA = 'docs/dataskydd/riskanalys.md';
    const SP = 'docs/utveckling/sparbarhet.md', RM = 'docs/utveckling/regressionsmodellen.md';
    const vakter = [
        { namn: 'K_MIN', kalla: 'src/lib/ktroskel.js', filer: [DS, RA, KT, SP, 'docs/anvandare/organisationspaket.md'],
          // "heltal 3–1000", "heltal mellan 3 och 1000", "Inställning (3–1000)", "till lägst 3"
          monster: /heltal (?:mellan )?(\d+)(?:–| och )\d|Inställning \((\d+)–\d|(?:till|är) lägst (\d+)\b/g },
        { namn: 'K_MAX', kalla: 'src/lib/ktroskel.js', filer: [RA, KT, SP, 'docs/anvandare/organisationspaket.md'],
          monster: /heltal (?:mellan )?\d+(?:–| och )(\d(?:[\d ]*\d)?)\b|Inställning \(\d+–(\d+)\)/g },
        { namn: 'LITET_UNDERLAG', kalla: 'src/lib/ktroskel.js', filer: [DS, RA, KT, SP],
          // Könsfördelningens och tabellernas egen rad "från fem personer", mönstret och asterisken "färre än fem
          // personer med/sägs"; inte Löneöversiktens golv per AID-etikett, som också är 5 men är en annan konstant.
          monster: /färre än ([\p{L}\d]+) personer (?:med|sägs)|från ([\p{L}\d]+) personer|minst ([\p{L}\d]+) personer i exportläget|`LITET_UNDERLAG` \(([\p{L}\d]+)\)/gu },
        { namn: 'HUVUDREGRESSION_MIN_PER_KON', kalla: 'src/lib/regression.js',
          filer: [DS, RA, KT, SP, RM, 'docs/anvandare/korguide.md', 'docs/anvandare/sammanfattning-hr-chefer.md'],
          // "regressionens eget fasta golv, 5 av varje kön", "kräver 5 kvinnor och 5 män", "golven 30 och 5"
          monster: /golv(?:\*\*)?,? (?:är )?(\d+) (?:av varje kön|per kön)|kräver (\d+) kvinnor och (\d+) män|golven \d+ och (\d+)|och med färre än (\d+)\s+av något kön/g },
        { namn: 'HUVUDREGRESSION_MIN_N', kalla: 'src/lib/regression.js', filer: [RM, SP],
          // Inte översikten per huvudområde ("minst 30 sådana rader"), som har en egen konstant i sektor.js.
          monster: /färre än (\d+) sådana rader|minst (\d+) rader|golven (\d+) och \d+/g }
    ];
    for (const { namn, kalla, filer, monster } of vakter) {
        const varde = konstant(kalla, namn);
        for (const fil of filer) {
            it(`${namn} = ${varde} (${kalla}) står rätt i ${fil}`, () => {
                const traffar = [...läs(fil).matchAll(monster)].flatMap(m => m.slice(1).filter(x => x !== undefined).map(tal));
                expect(traffar.length, `${fil} nämner inte ${namn}`).toBeGreaterThan(0);
                expect(traffar.filter(n => n !== varde), `${fil} anger fel tal för ${namn}`).toEqual([]);
            });
        }
    }
});


describe('dokumentation: k-tröskeln är en inställning (ADR-38)', () => {
    for (const fil of ['docs/dataskydd/dataskydd.md', 'docs/dataskydd/riskanalys.md']) {
        it(`${fil} säger att värdet kan ändras och att det skrivs ut i utdata`, () => {
            const t = läs(fil);
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
        for (const fil of ['docs/dataskydd/dataskydd.md', 'docs/dataskydd/riskanalys.md', MAL, ADR, 'CHANGELOG.md',
                           'docs/anvandare/korguide.md', 'docs/anvandare/organisationspaket.md']) {
            const t = läs(fil);
            expect(t, fil).not.toMatch(/fil\s+utan fältet ger 10/);
            expect(t, fil).not.toMatch(/alltid bär tröskeln|bär alltid\s+tröskeln/);
            expect(t, fil).not.toMatch(/lämnar ut par/);   // "lämnar ut" betyder röjer; "utelämnar" avses
        }
    });
});

describe('dokumentation: undantagen till S4 har samma namn i de tre dokumenten', () => {
    // k-troskeln.md §4 bär listan och hur varje undantag är byggt; dataskydd.md §3 och riskanalysen §6.5 har en rad per
    // undantag om risken, under samma namn i fetstil. Namnen läses ur tabellen i §4.
    const avsnitt = (fil, fran, till) => { const t = läs(fil); return t.slice(t.indexOf(fran), t.indexOf(till, t.indexOf(fran))); };
    const namn = [...avsnitt('docs/utveckling/k-troskeln.md', '## 4. ', '## 5. ').matchAll(/^\| \*\*(.+?)\*\* \|/gm)].map(m => m[1]);
    it('tabellen i k-troskeln.md §4 har undantag', () => expect(namn.length).toBeGreaterThanOrEqual(5));
    const fetstil = t => [...t.matchAll(/\*\*([^*]+)\*\*/g)].map(m => m[1]);
    for (const [fil, fran, till] of [['docs/dataskydd/dataskydd.md', '## 3. ', '## 4. '], ['docs/dataskydd/riskanalys.md', '### 6.5 ', '### 6.6 ']]) {
        it(`${fil} nämner varje undantag i fetstil under samma namn`, () => {
            const fet = fetstil(avsnitt(fil, fran, till));
            expect(namn.filter(n => !fet.some(f => f.includes(n))), fil).toEqual([]);
        });
    }
    it('de numrerade undantagen i dataskydd.md §3 finns i tabellen', () => {
        const numrerade = [...avsnitt('docs/dataskydd/dataskydd.md', '## 3. ', '## 4. ').matchAll(/^\d+\. \*\*([^*]+?)(?: \(ADR-\d+\))?:\*\*/gm)].map(m => m[1]);
        expect(numrerade).toHaveLength(4);
        expect(numrerade.filter(n => !namn.includes(n))).toEqual([]);
    });
});

describe('dokumentation: dataskyddstexterna följer ADR-14 och ADR-15', () => {
    // Utforska visar små grupper tonade och exporten utelämnar dem bara när rutan
    // är urkryssad (ADR-14); formler i CSV/urklipp neutraliseras (ADR-15). De texter
    // ett dataskyddsombud läser först beskriver just det.
    const texter = [...appDelar.map(f => `src/app/${f}`), 'src/index.html',
        ...['docs/anvandare', 'docs/dataskydd'].flatMap(d => readdirSync(join(root, d)).filter(f => f.endsWith('.md')).map(f => `${d}/${f}`))];
    it('ingen text påstår att små grupper aldrig syns i någon utdata', () => {
        expect(texter.filter(f => /redovisas inte i någon utdata/.test(läs(f)))).toEqual([]);
    });
    for (const fil of ['docs/dataskydd/dataskydd.md', 'docs/dataskydd/riskanalys.md']) {
        it(`${fil}: beskriver undantaget i Utforska (ADR-14) och formelskyddet (ADR-15)`, () => {
            const t = läs(fil);
            expect(t).toMatch(/ADR-14/);
            expect(t).toMatch(/ADR-15/);
        });
    }
});

describe('dokumentation: licenstexterna följer med den byggda filen', () => {
    // MIT och Apache 2.0 kräver att licenstexten följer med varje kopia. TREDJEPARTSLICENSER.md
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
    it('den publicerade filen har inget inbakat organisationspaket (organisationsfilen skapas av systemförvaltaren)', () => {
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
    });
});

// Ett dokument inom backtick söks relativt de här katalogerna (roten sist).
const DOKUMENTKATALOGER = ['docs/utveckling', '.github', ''];
const dokumentFinns = s => [...s.matchAll(/`([^`\s]+\.\w+)`/g)]
    .some(([, f]) => DOKUMENTKATALOGER.some(k => existsSync(join(root, k ? `${k}/${f}` : f))));
// Indexets rader: nummer, rubrik, status, datum.
const indexrader = [...adrMd.matchAll(/^\| ADR-(\d+) \| [^|\n]+? \| ([^|\n]+) \| [^|\n]+ \|$/gm)];
const beslutsnummer = [...adrMd.matchAll(/^\*\*ADR-(\d+) —/gm)].map(m => Number(m[1]));

describe('arkitekturbesluten: numren som koden pekar på finns, och hänvisningarna går att följa', () => {
    it('varje ADR som koden, testerna och dokumenten pekar på finns i arkitekturbesluten', () => {
        const finns = new Set(beslutsnummer);
        const filer = [...gå('src'), ...gå('tools'), ...gå('tests'), ...gå('docs')]
            .filter(f => /\.(js|mjs|html|css|md)$/.test(f));
        const saknas = filer.flatMap(f => [...läs(f).matchAll(/ADR-(\d+)\b/g)].map(m => Number(m[1])).filter(n => !finns.has(n)).map(n => `${f}: ADR-${n}`));
        expect([...new Set(saknas)]).toEqual([]);
    });
    // Koder och namn ur interna granskningsomgångar (DR5, «Uppgift 6», «S5 i punkt 26», «beslut 8c», «fix 2», «slutgranskningens fynd», en gammal funktionslistas «#9») förklaras inte någonstans i repot, och
    // flera krockade med skydden S1–S5 och riskanalysens id. En hänvisning går till ett ADR eller ett dokument.
    const GRANSKNINGSKOD = /\b(?:D[RSTUVGF]\d+|Uppgift \d+|[Rr]ättning(?:somgång)? \d+|fixrunda \d+|fix \d+(?=:)|[A-Z]\d+ i punkt \d+|etapp \d+[a-z]?|beslut \d+[a-z]|[A-Z]-[A-Z]{2}\d+|[Ss]lutgranskning\w*|(?:granskning|inventering\w*) \d{4}-\d\d-\d\d|Punkt \d+(?=,))\b|\(V\d+\)|(?:\/\/|\/\*|<!--|\*|-- |(?:describe|it)\(['`]|— )\s*#\d{1,2}\b|\(#\d{1,2}\)/;
    it('mönstret för granskningskoder fångar koderna men inte ADR, skydden eller BAS', () => {
        for (const t of ['(DR1)', 'DS3: staplar', 'Uppgift 6', 'Rättning 1, DV2', 'fixrunda 1', 'fix 2: indata', 'S5 i punkt 26', 'etapp 1b', 'beslut 8c', 'Klarspråket (K-OR7)', 'domänen (V2)', 'slutgranskningens fynd', 'granskning 2026-10-30', 'UX-inventeringen 2026-11-19', 'Punkt 26, under', '// #9: demoläge', "describe('#1 röktest'", '// ---- #13 Förslag', 'poäng-läge (#5)']) expect(GRANSKNINGSKOD.test(t), t).toBe(true);
        for (const t of ['ADR-63', '(S4)', 'BAS D2', 'cell D2', 'docx', 'uppgiften', '[B3.7]', 'A-Z0', 'granskningen', "'#,##0'", '<strong>#1, #2</strong>', "toBe('#1 207011 Yrke')", "'#2563eb'"]) expect(GRANSKNINGSKOD.test(t), t).toBe(false);
    });
    it('koden, verktygen och testerna hänvisar inte till granskningsomgångarnas koder', () => {
        const filer = [...gå('src'), ...gå('tools'), ...gå('tests')]
            .filter(f => /\.(js|mjs|html|css)$/.test(f) && f !== 'tests/dokumentation-struktur.test.js' && !f.startsWith('tools/data/'));
        expect(filer.flatMap(f => läs(f).split('\n').map((r, i) => [r, i]).filter(([r]) => GRANSKNINGSKOD.test(r))
            .map(([r, i]) => `${f}:${i + 1} ${r.trim().slice(0, 80)}`))).toEqual([]);
    });
    it('testernas namn säger vad som gäller, inte att det är som förut', () => {
        const HISTORIA = /^\s*(?:describe|it)\b.*(?:som förut|som i dag|före ändringen|characterization\))/;
        const filer = gå('tests').filter(f => f.endsWith('.js') && f !== 'tests/dokumentation-struktur.test.js');
        expect(filer.flatMap(f => läs(f).split('\n').map((r, i) => [r, i]).filter(([r]) => HISTORIA.test(r))
            .map(([r, i]) => `${f}:${i + 1} ${r.trim().slice(0, 80)}`))).toEqual([]);
    });
});

// Kommentarerna i källan: var kommentarerna står och på vilken rad.
const KOMMENTAR = /\/\*[\s\S]*?\*\/|\/\/[^\n]*/g;
const radFor = (t, i) => t.slice(0, i).split('\n').length;
const kallfiler = (...kataloger) => kataloger.flatMap(gå).filter(f => /\.(js|mjs)$/.test(f) && !f.startsWith('tools/data/'));

describe('kommentarerna följer koden', () => {
    // Ett kodnamn i en kommentar är ett namn med understreck först (`_fooBar`, med eller utan parentes) eller ett
    // camelCase-namn följt av en parentes (`fooBar()`); ett camelCase-ord utan parentes kan vara ett webbläsar-API,
    // ett SVG-element eller ett fält och prövas inte.
    it('ett kodnamn som en kommentar i src nämner finns i koden', () => {
        const filer = kallfiler('src');
        const namn = new Set(filer.flatMap(f => [...läs(f).replace(KOMMENTAR, ' ').matchAll(/[A-Za-z_$][\w$]*/g)].map(m => m[0])));
        expect(filer.flatMap(f => { const t = läs(f);
            return [...t.matchAll(KOMMENTAR)].flatMap(k => [...k[0].matchAll(/(?<![\w$])(_[a-zA-Z]\w{3,}|[a-z]+[A-Z]\w+(?=\())/g)]
                .filter(m => !namn.has(m[1])).map(m => `${f}:${radFor(t, k.index)} ${m[1]}`)); })).toEqual([]);
    });
    // «tidigare» och «räknades» står oftast utan historik («tidigare år», «raderna som räknades») och prövas bara i
    // de historiska formerna («tidigare hette», «räknades förut»).
    it('kommentarerna i koden, verktygen och testerna säger vad som gäller, inte att det är som förut', () => {
        const HISTORIK = /som förut|som i dag|BAKGRUND|[Bb]ug-?fix|tidigare hette|[Ff]lyttade? från|[Bb]röts ut|[Ff]örr(?![a-zåäö])|[Ff]örut(?![a-zåäö])|\bhette\b|\b[Nn]umera\b|[Ää]ndrat med ADR/;
        expect(kallfiler('src', 'tools', 'tests').filter(f => f !== 'tests/dokumentation-struktur.test.js').flatMap(f => { const t = läs(f);
            return [...t.matchAll(KOMMENTAR)].filter(k => HISTORIK.test(k[0]))
                .map(k => `${f}:${radFor(t, k.index)} ${k[0].match(HISTORIK)[0]}`); })).toEqual([]);
    });
    it('lagrum står inte i den gamla formen «§ 3:10» eller «DiskrL 3:10» i koden, verktygen eller testerna', () => {
        const GAMMAL = /§ ?\d+:\d+|DiskrL ?\d+:\d+/;
        const filer = kallfiler('src', 'tools', 'tests').filter(f => !['tests/dokumentation-struktur.test.js', 'tests/start-och-meny-app.test.js', 'tests/dokumentation-sprak.test.js'].includes(f));
        expect(filer.flatMap(f => läs(f).split('\n').map((r, i) => [r, i]).filter(([r]) => GAMMAL.test(r))
            .map(([r, i]) => `${f}:${i + 1} ${r.trim().slice(0, 80)}`))).toEqual([]);
    });
});

describe('en källa: inga egna kopior av esc, median eller kvantil', () => {
    // Bygget kräver redan att varje namn deklareras i en enda modul (tools/build-app.mjs); det här fångar kopiorna
    // under andra namn. xmlText (XML, utan ogiltiga tecken) och organisationsfilens attributpar (kodar och avkodar)
    // är egna uppgifter.
    const KOPIA = [
        ['esc', /\.replace\(\/&\/g, ?['"]&amp;['"]\)/, ['src/lib/htmltext.js', 'src/lib/docx.js', 'src/lib/organisationsfil.js']],
        ['median', /length % 2 \?/, ['src/lib/stat.js']],
        ['kvantil', /\.length - 1\) \* /, ['src/lib/stat.js']],
    ];
    it('esc står i src/lib/htmltext.js, median och kvantil i src/lib/stat.js', () => {
        expect(kallfiler('src').flatMap(f => { const t = läs(f);
            return KOPIA.filter(([, re, tillatna]) => !tillatna.includes(f) && re.test(t)).map(([namn]) => `${f}: egen ${namn}`); })).toEqual([]);
    });
});

describe('appens moduler: inga vakter på funktioner och bibliotek som alltid finns', () => {
    // Ett importerat eller i filen deklarerat namn finns alltid när modulen körs; en typeof-vakt på det döljer bara
    // ett stavfel. Vakter på webbläsarens API, lokala variabler och egenskaper står kvar, och typeof i JSDoc-typer
    // (ReturnType<typeof X>) är ingen vakt.
    it('ingen typeof på ett importerat namn eller en i filen deklarerad funktion i src/app', () => {
        expect(kallfiler('src/app').flatMap(f => {
            const t = läs(f);
            const egna = new Set([
                ...[...t.matchAll(/import\s*\{([^}]*)\}\s*from/g)].flatMap(m => m[1].split(',').map(n => n.trim().split(/\s+as\s+/).pop()).filter(Boolean)),
                ...[...t.matchAll(/function\s*\*?\s*([A-Za-z_$][\w$]*)\s*\(/g)].map(m => m[1]),
            ]);
            return [...t.matchAll(/typeof ([A-Za-z_$][\w$]*) [!=]==/g)].filter(m => egna.has(m[1]))
                .map(m => `${f}:${radFor(t, m.index)} ${m[1]}`);
        })).toEqual([]);
    });
    // Biblioteken i vendor/ bäddas in före appen (tools/bundle.mjs), och bygget avbryts om en av filerna saknas.
    it('ingen typeof på de inbäddade biblioteken i src/app', () => {
        const bibliotek = [...läs('types/globals.d.ts').matchAll(/^declare const (\w+): any;/gm)].map(m => m[1]);
        expect(bibliotek.length).toBeGreaterThan(0);
        const vakt = new RegExp(`typeof (${bibliotek.join('|')})\\b`, 'g');
        expect(kallfiler('src/app').flatMap(f => {
            const t = läs(f);
            return [...t.matchAll(vakt)].map(m => `${f}:${radFor(t, m.index)} ${m[1]}`);
        })).toEqual([]);
    });
});

describe('arkitekturbesluten: numren som koden pekar på finns, och hänvisningarna går att följa (index)', () => {
    it('indextabellen och besluten har samma nummer, i samma ordning', () => {
        expect(beslutsnummer.length).toBeGreaterThan(20);
        expect(indexrader.map(m => Number(m[1]))).toEqual(beslutsnummer);
    });
    it('Gäller i dag, Sammanförd i och Flyttad till pekar på ett dokument som finns', () => {
        const fel = [];
        for (const [, nr, status] of indexrader)
            if (/^(Sammanförd i|Flyttad till) /.test(status) && !dokumentFinns(status)) fel.push(`ADR-${nr}: ${status}`);
        // Fältet Gäller i dag går till nästa fält i stycket (*Avvisat:* …) eller till styckets slut.
        for (const [fält] of adrMd.matchAll(/\*Gäller i dag:\*(?:(?!\n\n|\*[^*\s][^*\n]*:\*)[\s\S])*/g))
            if (!dokumentFinns(fält)) fel.push(fält);
        expect(fel).toEqual([]);
    });
});

describe('riskanalysen beskriver det aktuella bygget, inte vägen dit', () => {
    const ra = läs('docs/dataskydd/riskanalys.md');
    it('ett granskningsdatum, inga tidigare granskningar, ingen tidslinje', () => {
        expect(ra).not.toMatch(/föregående fullständiga granskningar|Härdningstidslinje|omgranskning/);
        expect(ra).not.toMatch(/sedan 20\d\d[-.]\d\d|tillkom 20\d\d-|till och med 20\d\d-|release 20\d\d\.\d\d\.\d\d|bygge 2026\.0[5-9]/);
    });
    // Byggets version och kontrollsumma (rad 3) förs in vid release och prövas av release-grinden (tools/release.mjs).
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

describe('dokumentation: skripten som nämns finns', () => {
    it('varje npm-skript som kör ett verktyg pekar på en fil som finns', () => {
        const saknas = Object.entries(pkg.scripts).flatMap(([namn, cmd]) =>
            [...cmd.matchAll(/node (tools\/\S+)/g)].map(m => m[1]).filter(f => !existsSync(join(root, f))).map(f => `${namn}: ${f}`));
        expect(saknas).toEqual([]);
    });
    it('varje "npm run …" i README och CONTRIBUTING finns i package.json', () => {
        for (const f of ['README.md', '.github/CONTRIBUTING.md']) {
            for (const [, namn] of ickeTom(läs(f).matchAll(/npm run ([\w:-]+)/g))) expect(pkg.scripts, `${f}: npm run ${namn}`).toHaveProperty([namn]);
        }
    });
});

describe('dokumentation: en Definition of Done, och npm run kontroll kör CI:s steg', () => {
    // Ett avsnitt i ett Markdown-dokument: från rubriken till nästa rubrik på samma eller högre nivå.
    const avsnitt = (text, rubrik) => {
        const start = text.indexOf(rubrik);
        if (start < 0) return '';
        const nivå = /^#+/.exec(rubrik)[0].length;
        const resten = text.slice(start + rubrik.length);
        const slut = resten.search(new RegExp(`^#{1,${nivå}} `, 'm'));
        return slut < 0 ? resten : resten.slice(0, slut);
    };
    // Ett jobb i ci.yml: från dess rad till nästa jobb på samma indrag.
    const jobb = namn => {
        const ci = läs('.github/workflows/ci.yml');
        const start = ci.search(new RegExp(`^ {2}${namn}:`, 'm'));
        expect(start, namn).toBeGreaterThan(-1);
        const resten = ci.slice(start + 1);
        const slut = resten.search(/^ {2}\w[\w-]*:/m);
        return slut < 0 ? resten : resten.slice(0, slut);
    };
    // Jobben som samlas i kontrollen quality: grindarna, den delade sviten och röktestet i webbläsarna.
    const qualitySteg = () => ['grindar', 'tester', 'browser']
        .flatMap(namn => [...jobb(namn).matchAll(/npm run ([\w:-]+)/g)].map(m => m[1]));
    const kontroll = () => import('../tools/kontroll.mjs');

    it('varje "npm run …" i CI-jobben grindar, tester och browser ingår i STEG i tools/kontroll.mjs', async () => {
        const ci = qualitySteg();
        expect(ci.length).toBeGreaterThan(0);
        expect(ci).toContain('test:full');
        const { STEG } = await kontroll();
        expect(ci.filter(n => !STEG.includes(n))).toEqual([]);
    });
    it('ci.yml och release.yml kör artefaktgrinden genom tools/kontroll.mjs, som har regeln för vilka filer som jämförs', () => {
        for (const fil of ['ci.yml', 'release.yml']) {
            const wf = läs(`.github/workflows/${fil}`);
            const steg = /- name: Artefakten motsvarar källan[^\n]*\n\s+run: (.*)/.exec(wf);
            expect(steg?.[1], fil).toBe('node tools/kontroll.mjs --artefakt');
        }
    });
    it('sviten är delad så att varje del körs, och quality väntar på grindarna, alla delar och röktestet', () => {
        const tester = jobb('tester');
        const delar = /del: \[([\d, ]+)\]/.exec(tester)[1].split(',').map(s => Number(s.trim()));
        const antal = Number(/--shard=\$\{\{ matrix\.del \}\}\/(\d+)/.exec(tester)[1]);
        expect(delar).toEqual(Array.from({ length: antal }, (_, i) => i + 1));
        const quality = jobb('quality');
        expect(quality).toMatch(/if: always\(\)/);
        expect(quality).toMatch(/needs: \[grindar, tester, browser\]/);
        for (const n of ['grindar', 'tester', 'browser']) expect(quality).toContain(`needs.${n}.result`);
    });
    it('STEG har också bygget och webbläsarjobbets röktest, och varje steg finns i package.json', async () => {
        const { STEG, SNABBA_STEG } = await kontroll();
        for (const n of ['build:app', 'bundle', 'test:browser']) expect(STEG).toContain(n);
        expect([...STEG, ...SNABBA_STEG].filter(n => !pkg.scripts[n])).toEqual([]);
        expect(pkg.scripts.kontroll).toMatch(/node tools\/kontroll\.mjs/);
    });
    it('CONTRIBUTING har Definition of Done med npm run kontroll; GOVERNANCE och README pekar dit', () => {
        expect(läs('.github/CONTRIBUTING.md')).toMatch(/Definition of Done[\s\S]*npm run kontroll/);
        const gov = avsnitt(läs('.github/GOVERNANCE.md'), '## Hur en ändring kommer in');
        expect(gov).toContain('CONTRIBUTING.md');
        expect(gov).not.toMatch(/npm run (test:full|test:browser|bundle)/);
        const readme = avsnitt(läs('README.md'), '## För dig som utvecklar');
        expect(readme).toContain('CONTRIBUTING.md');
        expect(readme).toContain('npm run kontroll');
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
        expect(läs('.github/CONTRIBUTING.md')).toMatch(/MIT-licensen/);
        for (const f of ['.github/GOVERNANCE.md', '.github/CODE_OF_CONDUCT.md']) expect(existsSync(join(root, f)), f).toBe(true);
        // En funktionsadress, inte en privat adress.
        expect(läs('SECURITY.md')).toMatch(/oppen-lonekartlaggning@proton\.me/);
        expect(läs('SECURITY.md')).not.toMatch(/gmail/i);
    });
    it('README och dokumenten räknar fälten som kolumnmappningen: fyra obligatoriska, tre valfria (ADR-64)', () => {
        // Kolumnmappningen, förhandskontrollen och importprofilerna läser rollerna ur src/lib/importprofiler.js.
        expect(IMPORTPROFIL_ROLLER).toContain('alder');
        expect(OBLIGATORISKA_ROLLER).not.toContain('alder');
        expect([...OBLIGATORISKA_ROLLER].sort()).toEqual(['bas', 'kon', 'lon', 'yrke']);
        expect(IMPORTPROFIL_ROLLER.length - OBLIGATORISKA_ROLLER.length).toBe(3);
        expect(läs('README.md').replace(/\s+/g, ' ')).toMatch(/fyra obligatoriska, tre valfria/);
        expect(läs('README.md')).not.toMatch(/fem obligatoriska/);
    });
    it('.gitignore utesluter lokal data och arbetsmappar', () => {
        const g = läs('.gitignore');
        for (const m of ['*.csv', '*.xlsx', '.claude/']) expect(g).toContain(m);
    });
});

describe('dokumentation: licens MIT', () => {
    it('LICENSE är MIT-texten med upphovspersonen och TREDJEPARTSLICENSER.md hänvisar till den', () => {
        const l = läs('LICENSE');
        expect(l).toMatch(/^MIT License\n\nCopyright \(c\) 2026 Felix Jansson/);
        expect(l).toContain('Permission is hereby granted, free of charge');
        expect(existsSync(join(root, 'NOTICE'))).toBe(false);
        expect(läs('TREDJEPARTSLICENSER.md')).toMatch(/MIT-licensen; se\s+\[`LICENSE`\]\(LICENSE\)/);
    });
    it('varje källfil bär licensraden (SPDX)', () => {
        const filer = [...gå('src/app'), ...gå('src/lib'), ...gå('tools'), 'src/index.html', 'src/style.css']
            .filter(f => /\.(js|mjs|html|css)$/.test(f));
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
    it('dataskyddet nämner ansvarskoden, datauttaget att Ansvar inte läses', () => {
        expect(läs('docs/dataskydd/dataskydd.md')).toMatch(/ansvarskod/i);
        expect(läs('docs/dataskydd/riskanalys.md')).toMatch(/ansvarskod/i);
        expect(läs('docs/anvandare/datauttag.md')).toMatch(/Ansvar.{0,80}läses\s+(aldrig|inte)/s);
    });
});

describe('dokumentation: Översikt och namn', () => {
    it('dataskyddet nämner namnen i konfigurationsfilen', () => {
        expect(läs('docs/dataskydd/riskanalys.md')).toMatch(/jämförelsestatistikens namn/);
        expect(läs('docs/dataskydd/dataskydd.md')).toMatch(/organisationens namn/i);
    });
});

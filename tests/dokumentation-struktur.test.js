/**
 * Vakt: dokumentationen ska beskriva den BYGGDA versionen (kvalitetskrav K4).
 *
 * Dokumentation glider isär från koden i varje commit: deltabeller som saknar
 * moduler, filer som inte finns och byggkommandon som inte stämmer.
 * Det som GÅR att kontrollera mekaniskt kontrolleras därför här, så att
 * påståenden om filer, moduler, skript och trösklar inte kan glida isär från
 * koden utan att CI säger ifrån. Språket i det användaren läser vaktas i
 * dokumentation-sprak.test.js.
 *
 * Det som inte går att mekanisera — om en förklaring är korrekt och begriplig —
 * står kvar som en öppen punkt i docs/utveckling/teknisk-plan.md § 9.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const läs = f => readFileSync(join(root, f), 'utf8');

const PLAN = 'docs/utveckling/teknisk-plan.md';
const planMd = läs(PLAN);
const ADR = 'docs/utveckling/arkitekturbeslut.md';
const adrMd = läs(ADR);
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
    it('alla npm-skript som nämns finns i package.json', () => {
        const nämnda = [...(planMd + adrMd).matchAll(/`npm run ([\w:]+)`/g)].map(m => m[1]);
        expect(nämnda.length).toBeGreaterThan(0);
        const okända = [...new Set(nämnda)].filter(n => !pkg.scripts[n]);
        expect(okända, `npm-skript som inte finns: ${okända.join(', ')}`).toEqual([]);
    });

    // Hela planen och arkitekturbesluten beskriver nuläget, så varje fil de pekar ut ska finnas.
    it('filerna som den tekniska planen och arkitekturbesluten pekar ut finns på disk', () => {
        const kandidater = [...(planMd + adrMd).matchAll(/`([\w.-]+\/[\w./-]+\.(?:js|mjs|json|md|html|css|txt|yml))`/g)]
            .map(m => m[1])
            .filter(f => !f.includes('*'));
        expect(kandidater.length).toBeGreaterThan(0);
        const saknade = [...new Set(kandidater)].filter(f => !existsSync(join(root, f)));
        expect(saknade, `planen pekar ut filer som inte finns: ${saknade.join(', ')}`).toEqual([]);
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

// skydd.md är källan för skyddens vakter: varje fil och mapp det pekar ut ska finnas. En sökväg med snedstreck
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
    const K = Number(/const K_STANDARD = (\d+);/.exec(läs('src/app/06-k-troskel.js'))[1]);
    const filer = ['docs/dataskydd/dataskydd.md', 'docs/dataskydd/riskanalys.md',
                   'docs/anvandare/sammanfattning-hr-chefer.md', 'docs/anvandare/korguide.md', PLAN, ADR];

    for (const fil of filer) {
        it(`${fil}: "färre än/minst N personer" och "standardvärdet N" har N = ${K}`, () => {
            const t = läs(fil);
            const fel = [...t.matchAll(/(?:färre än|minst) (\d+) personer|K_STANDARD = (\d+)|[Ss]tandardvärdet (?:är )?(\d+)\b/g)]
                .map(m => Number(m[1] ?? m[2] ?? m[3]))
                .filter(n => n !== K);
            expect(fel, `${fil} anger fel tröskel: ${fel.join(', ')}`).toEqual([]);
        });
    }
    it('den tekniska planen och dataskyddsdokumenten anger standardvärdet', () => {
        expect(planMd).toContain(`K_STANDARD = ${K}`);
        for (const fil of ['docs/dataskydd/dataskydd.md', 'docs/dataskydd/riskanalys.md'])
            expect(läs(fil), fil).toMatch(new RegExp(`[Ss]tandardvärdet (är )?${K}\\b`));
    });
});

describe('dokumentation: valbar förklaringsmodell (ADR-56)', () => {
    it('Om verktyget och körguiden beskriver valet', () => {
        expect(läs('src/app/65-om-verktyget.js')).toMatch(/[Ff]örklaringsmodell/);
        expect(läs('src/app/65-om-verktyget.js')).toMatch(/0,5 procentenheter/);
        expect(läs('docs/anvandare/korguide.md')).toMatch(/välja om ålder, BAS-intervall och yrkesgrupp/);
    });
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
        for (const fil of ['docs/dataskydd/dataskydd.md', 'docs/dataskydd/riskanalys.md', PLAN, ADR, 'CHANGELOG.md',
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
                    'src/app/04-ordlista.js', 'src/app/06-k-troskel.js', 'src/app/06-kvinnoandel-referens.js',
                    'src/app/06-maskeringsnoter.js', 'src/app/06-uppgiftsminimering.js'];
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
    });
});

// Statusorden i indexet (ADR-68). Sammanförd i och Flyttad till nämner dokumentet inom backtick.
const STATUS = /^(Gällande|Ändrad av ADR-\d+|Sammanförd i |Flyttad till |Upphävd)/;
// Ett dokument inom backtick söks relativt de här katalogerna (roten sist).
const DOKUMENTKATALOGER = ['docs/utveckling', '.github', ''];

/**
 * Status och hänvisningar till gällande lydelse i arkitekturbesluten (ADR-68). Tar dokumentets text och en funktion
 * som säger om en sökväg (relativ roten) finns, och returnerar en lista med fel: en status utanför statusorden, en
 * status *Sammanförd i* eller *Flyttad till* som inte nämner ett dokument som finns, och en rad *Gäller i dag:* som
 * inte pekar på ett dokument som finns. Ren funktion, så att självtestet kan ge den en påhittad text.
 */
function granskaStatusOchHänvisningar(text, finns) {
    const fel = [];
    const dokumentFinns = s => [...s.matchAll(/`([^`\s]+\.\w+)`/g)]
        .some(([, f]) => DOKUMENTKATALOGER.some(k => finns(k ? `${k}/${f}` : f)));
    for (const [, nr, status] of text.matchAll(/^\| ADR-(\d+) \| [^|\n]+? \| ([^|\n]+) \| [^|\n]+ \|$/gm)) {
        if (!STATUS.test(status)) fel.push({ slag: 'status', adr: Number(nr), status });
        else if (/^(Sammanförd i|Flyttad till) /.test(status) && !dokumentFinns(status))
            fel.push({ slag: 'status-utan-dokument', adr: Number(nr), status });
    }
    // Raden Gäller i dag fortsätter till nästa fält (*Vakt:* …), nästa beslut eller en tom rad.
    for (const [rad] of text.matchAll(/^\*Gäller i dag:\*[^\n]*(?:\n(?!\n|\*[^*\s][^*\n]*:\*|\*\*ADR-)[^\n]*)*/gm)) {
        if (!dokumentFinns(rad)) fel.push({ slag: 'gäller-i-dag', rad });
    }
    return fel;
}

describe('den tekniska planen och arkitekturbesluten beskriver nuläget', () => {
    const plan = adrMd;
    it('ADR-loggen bär inga datum i rubrikerna och inga beslut om tidigare lägen', () => {
        const rubriker = [...plan.matchAll(/^\*\*ADR-(\d+) — ([^*]+)\*\*/gm)];
        expect(rubriker.length).toBeGreaterThan(20);
        for (const [hel] of rubriker) expect(hel, hel).not.toMatch(/\(\d{4}-\d{2}(-\d{2})?[^)]*\)/);
        expect(plan).not.toMatch(/ersätter ADR-|ersatt av ADR-|Delvis ersatt/i);
    });
    it('varje ADR som koden, testerna och dokumenten pekar på finns i arkitekturbesluten', () => {
        const finns = new Set([...plan.matchAll(/^\*\*ADR-(\d+) —/gm)].map(m => Number(m[1])));
        const gå = dir => readdirSync(join(root, dir), { withFileTypes: true }).flatMap(e =>
            e.isDirectory() ? gå(`${dir}/${e.name}`) : [`${dir}/${e.name}`]);
        const filer = [...gå('src'), ...gå('tools'), ...gå('tests'), ...gå('docs')]
            .filter(f => /\.(js|mjs|html|css|md)$/.test(f) && !f.endsWith('09-lib-speglar.js'));
        const saknas = filer.flatMap(f => [...läs(f).matchAll(/ADR-(\d+)\b/g)].map(m => Number(m[1])).filter(n => !finns.has(n)).map(n => `${f}: ADR-${n}`));
        expect([...new Set(saknas)]).toEqual([]);
    });
    it('inga länkar till arbetsverktyg och inga väntande platshållare för lönesystem', () => {
        expect(planMd + adrMd).not.toMatch(/väntar på systemförvaltarna|är platshållare/);
    });
    it('indextabellen och besluten har samma nummer, i samma ordning, och varje rad har en status', () => {
        const beslut = [...adrMd.matchAll(/^\*\*ADR-(\d+) —/gm)].map(m => Number(m[1]));
        const rader = [...adrMd.matchAll(/^\| ADR-(\d+) \| [^|\n]+? \| ([^|\n]+) \| [^|\n]+ \|$/gm)];
        expect(beslut.length).toBeGreaterThan(20);
        expect(rader.map(m => Number(m[1]))).toEqual(beslut);
        for (const [rad, , status] of rader) expect(status, rad).toMatch(STATUS);
        // En status som pekar på ett annat beslut pekar på ett som finns.
        const pekar = rader.flatMap(m => [...m[2].matchAll(/ADR-(\d+)/g)].map(p => Number(p[1])));
        expect(pekar.filter(n => !beslut.includes(n))).toEqual([]);
    });
    it('Sammanförd i, Flyttad till och Gäller i dag pekar på ett dokument som finns (ADR-68)', () => {
        expect(granskaStatusOchHänvisningar(adrMd, f => existsSync(join(root, f)))).toEqual([]);
    });
    it('den tekniska planen har kvar avsnittsnumreringen och hänvisar till arkitekturbesluten', () => {
        const avsnitt = [...planMd.matchAll(/^## (\d+)\. /gm)].map(m => Number(m[1]));
        expect(avsnitt).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
        expect(planMd).toContain('[`arkitekturbeslut.md`](arkitekturbeslut.md)');
        expect(planMd).not.toMatch(/^\*\*ADR-\d+ —/m);
    });
});

describe('arkitekturbesluten: självtest av status- och hänvisningskontrollen', () => {
    // En påhittad index- och beslutstext med ett fel av varje slag. Numren är beslut som finns, så att sökningen
    // efter beslutsnummer ovan inte fäller på den här filen.
    const text = [
        '| ADR-1 | Ett | Gällande | – |',
        '| ADR-2 | Två | Sammanförd i `finns.md` §2 | – |',
        '| ADR-4 | Fyra | Flyttad till `saknas.md` | – |',
        '| ADR-5 | Fem | Sammanförd i referensen | – |',
        '| ADR-6 | Sex | Borttagen | – |',
        '| ADR-7 | Sju | Flyttad till `.github/annat.md` | – |',
        '',
        '**ADR-1 — Ett.** Beslut 2026-01-01.',
        '*Beslut:* något.',
        '*Gäller i dag:* `finns.md` §2.',
        '*Vakt:* ingen: text.',
        '',
        '**ADR-2 — Två.** Beslut 2026-01-02.',
        '*Gäller i dag:* `saknas.md` §1 och',
        '`också-saknas.md` §3.',
        '*Vakt:* ingen: text.',
        '',
        '**ADR-4 — Fyra.** Beslut 2026-01-03.',
        '*Gäller i dag:* referensen för området.',
    ].join('\n');
    const finns = s => ['docs/utveckling/finns.md', '.github/annat.md'].includes(s);
    const fel = granskaStatusOchHänvisningar(text, finns);
    it('statusmönstret godtar statusorden och inget annat', () => {
        for (const s of ['Gällande', 'Ändrad av ADR-51', 'Ändrad av ADR-53 och ADR-63', 'Sammanförd i `k.md`',
            'Flyttad till `teknisk-plan.md` §6', 'Upphävd']) expect(STATUS.test(s), s).toBe(true);
        for (const s of ['Borttagen', 'Ändrad', 'Sammanförd', 'gällande']) expect(STATUS.test(s), s).toBe(false);
    });
    it('rapporterar en status utanför statusorden', () => {
        expect(fel.filter(f => f.slag === 'status')).toEqual([{ slag: 'status', adr: 6, status: 'Borttagen' }]);
    });
    it('rapporterar Sammanförd i och Flyttad till utan ett dokument som finns, och godtar ett som finns', () => {
        expect(fel.filter(f => f.slag === 'status-utan-dokument')).toEqual([
            { slag: 'status-utan-dokument', adr: 4, status: 'Flyttad till `saknas.md`' },
            { slag: 'status-utan-dokument', adr: 5, status: 'Sammanförd i referensen' },
        ]);
    });
    it('rapporterar en rad Gäller i dag utan ett dokument som finns, också när raden fortsätter', () => {
        expect(fel.filter(f => f.slag === 'gäller-i-dag')).toEqual([
            { slag: 'gäller-i-dag', rad: '*Gäller i dag:* `saknas.md` §1 och\n`också-saknas.md` §3.' },
            { slag: 'gäller-i-dag', rad: '*Gäller i dag:* referensen för området.' },
        ]);
    });
    it('inga andra fel', () => {
        expect(fel).toHaveLength(5);
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
    const pkg = JSON.parse(läs('package.json'));
    it('varje npm-skript som kör ett verktyg pekar på en fil som finns', () => {
        const saknas = Object.entries(pkg.scripts).flatMap(([namn, cmd]) =>
            [...cmd.matchAll(/node (tools\/\S+)/g)].map(m => m[1]).filter(f => !existsSync(join(root, f))).map(f => `${namn}: ${f}`));
        expect(saknas).toEqual([]);
    });
    it('varje "npm run …" i README och CONTRIBUTING finns i package.json', () => {
        for (const f of ['README.md', '.github/CONTRIBUTING.md']) {
            for (const [, namn] of läs(f).matchAll(/npm run ([\w:-]+)/g)) expect(pkg.scripts, `${f}: npm run ${namn}`).toHaveProperty([namn]);
        }
    });
});

describe('dokumentation: en Definition of Done, och npm run kontroll kör CI:s steg', () => {
    const pkg = JSON.parse(läs('package.json'));
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
    // Jobben som samlas i kontrollen quality: grindarna och den delade sviten.
    const qualitySteg = () => ['grindar', 'tester']
        .flatMap(namn => [...jobb(namn).matchAll(/npm run ([\w:-]+)/g)].map(m => m[1]));
    const kontroll = () => import('../tools/kontroll.mjs');

    it('varje "npm run …" i CI-jobben grindar och tester ingår i STEG i tools/kontroll.mjs', async () => {
        const ci = qualitySteg();
        expect(ci.length).toBeGreaterThan(0);
        expect(ci).toContain('test:full');
        const { STEG } = await kontroll();
        expect(ci.filter(n => !STEG.includes(n))).toEqual([]);
    });
    it('sviten är delad så att varje del körs, och quality väntar på grindarna och alla delar', () => {
        const tester = jobb('tester');
        const delar = /del: \[([\d, ]+)\]/.exec(tester)[1].split(',').map(s => Number(s.trim()));
        const antal = Number(/--shard=\$\{\{ matrix\.del \}\}\/(\d+)/.exec(tester)[1]);
        expect(delar).toEqual(Array.from({ length: antal }, (_, i) => i + 1));
        const quality = jobb('quality');
        expect(quality).toMatch(/if: always\(\)/);
        expect(quality).toMatch(/needs: \[grindar, tester\]/);
        for (const n of ['grindar', 'tester']) expect(quality).toContain(`needs.${n}.result`);
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
        expect(readme).toMatch(/Prova/);
        expect(läs('.github/CONTRIBUTING.md')).toMatch(/MIT-licensen/);
        for (const f of ['.github/GOVERNANCE.md', '.github/CODE_OF_CONDUCT.md']) expect(existsSync(join(root, f)), f).toBe(true);
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
    });
    it('.gitignore utesluter lokal data och arbetsmappar', () => {
        const g = läs('.gitignore');
        for (const m of ['*.csv', '*.xlsx', '.claude/']) expect(g).toContain(m);
    });
});

describe('dokumentation: licens MIT', () => {
    const gå = dir => readdirSync(join(root, dir), { withFileTypes: true }).flatMap(e =>
        e.isDirectory() ? gå(`${dir}/${e.name}`) : [`${dir}/${e.name}`]);
    it('LICENSE är MIT-texten med upphovspersonen och TREDJEPARTSLICENSER.md hänvisar till den', () => {
        const l = läs('LICENSE');
        expect(l).toMatch(/^MIT License\n\nCopyright \(c\) 2026 Felix Jansson/);
        expect(l).toContain('Permission is hereby granted, free of charge');
        expect(existsSync(join(root, 'NOTICE'))).toBe(false);
        expect(läs('TREDJEPARTSLICENSER.md')).toMatch(/MIT-licensen; se\s+\[`LICENSE`\]\(LICENSE\)/);
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

describe('dokumentation: Word-utkastet som .docx', () => {
    it('körguiden säger .docx', () => {
        expect(läs('docs/anvandare/korguide.md')).toMatch(/Word-utkast[^\n]*\.docx/);
    });
});

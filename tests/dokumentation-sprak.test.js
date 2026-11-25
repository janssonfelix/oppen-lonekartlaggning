/**
 * Vakt: språket i det användaren läser (princip 6 i docs/utveckling/principer.md).
 *
 * Ordvalen från språkgenomgången och lagrummen, p-värdets och konfidensintervallets
 * förklaring, ordet "förvaltning", och att användartexternas hänvisningar till
 * dokument pekar på något som finns. Varje mönster har ett självtest som visar att
 * det fångar de felaktiga formuleringarna och släpper de tillåtna. Dokumentationens
 * struktur och tal ur koden vaktas i dokumentation-struktur.test.js.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, basename } from 'node:path';
import { textLiteraler, etikettVarden, appKalla, htmlText } from './helpers/anvandartext.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const läs = f => readFileSync(join(root, f), 'utf8');

const appDelar = readdirSync(join(root, 'src', 'app')).filter(f => /^\d\d-.*\.js$/.test(f)).sort();

describe('dokumentation: användarnära texter', () => {
    // Allt användaren kan läsa: appens och bibliotekets källfiler, sidan och användar- och dataskyddsdokumenten.
    const anvandartexter = [...appDelar.map(f => `src/app/${f}`),
        ...readdirSync(join(root, 'src/lib')).filter(f => f.endsWith('.js')).map(f => `src/lib/${f}`), 'src/index.html',
        ...['docs/anvandare', 'docs/dataskydd'].flatMap(d => readdirSync(join(root, d)).filter(f => f.endsWith('.md')).map(f => `${d}/${f}`))];

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
    it('ingen användartext förklarar p-värdet som sannolikheten att resultatet beror på slump', () => {
        expect(anvandartexter.filter(f => P_FEL.test(läs(f)) || KI_FEL.test(läs(f)))).toEqual([]);
    });

    // Hänvisningar med sökväg ska finnas relativt roten eller det hänvisande dokumentet;
    // ett bart filnamn (t.ex. "datauttag.md" i appens hjälptext) ska finnas någonstans i repot.
    const mdFiler = (() => {
        const ut = [];
        const gå = dir => {
            for (const e of readdirSync(join(root, dir), { withFileTypes: true })) {
                if (e.name === 'node_modules' || (e.name.startsWith('.') && e.name !== '.github')) continue;   // dolda kataloger: git och lokala verktyg
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
            'README.md', '.github/CONTRIBUTING.md', 'site/index.html', 'dist/app.js', 'dist/oppen-lonekartlaggning.html']
            .filter(f => f !== 'tests/dokumentation-sprak.test.js' && !f.startsWith('tools/data/') && /\.(js|mjs|html|md|css|txt|snap)$/.test(f));
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
        // Juridiska formuleringar hålls övergripande (ADR-106, ingen juristgranskning före lansering): verktyget påstår
        // inte vad direktivet kräver i detalj. "ingen anmälningsplikt" får stå; "anmälningspliktig" inte.
        ['anmälningspliktig', /anmälningspliktig/iu],
        ['utredningsgräns', /utrednings(?:krav|gräns|tröskel|steg)|obligatorisk utredning|(?:bör|ska|måste) utredas/iu],
        ['lagstadgat', /lagstadga/iu],
        ['direktivet kräver', /enligt (?:eu-?)?direktivet (?:bör|ska|säger)|direktiv\S* (?:bör|ska|säger|kräver)\b/iu],
        ['unexplained gender pay gap', /unexplained gender pay gap/iu],
        ['diskrimineringsindikerande', /diskrimineringsindikerande/iu],
        // Klarspråket: "Nära pension", och svenska ord i stället för de engelska och tekniska termerna.
        // Ordlistan får ange den engelska termen inom parentes som förklaring ("(eng. privacy by design)").
        ['Successionszon', /[Ss]uccessions(?:zon|risk)/],
        ['conditional gap', /[Cc]onditional gap/],
        ['Privacy by Design', /Privacy by [Dd]esign/],
        // "vitlista" får stå bredvid kodnamnet TILLATNA_FALT; annars "godkända fält".
        ['vitlista', /^(?![\s\S]*TILLATNA_FALT)[\s\S]*[Vv]itlist/],
        ['datafunnel', /[Dd]atafunnel/],
        ['lokal-only', /lokal-only/i],
        ['leverage', /[Ll]everage/],
        ['media-mått', /[Mm]edia-mått/],
        ['rekryteringspipeline', /[Rr]ekryteringspipeline/],
        // Verktyget tillämpar tröskelvärdesregeln på tabeller, inte k-anonymitet (ett krav på mikrodatafiler); det
        // användaren läser säger "minsta gruppstorlek" (docs/utveckling/k-troskeln.md). Ordlistans sok-fält leder dit.
        ['k-anonymitet', /[Kk]-anon/],
    ];
    // I gränssnittet: inget paragraftecken och inget artikelnummer. "3 kap." är tillåtet.
    const LAGRUM_UI = [['§', /§/], ['artikel', /\b[Aa]rt\.\s*\d|[Aa]rtikel\s+\d/]];
    // I dokumenten är "§6.4" en avsnittshänvisning; ett lagrum skrivs "§ 8", "8 §" eller "§§".
    // Dataskyddsdokumenten och informationsmallen behåller dataskyddsförordningens artiklar (lagrum.md).
    const LAGRUM_DOK = [['§', /§\s+\d|\d\s*§|§§/]];

    const traffar = (text, monster) => monster.filter(([, re]) => re.test(text)).map(([n]) => n);
    // Strängfiltret (textLiteraler, etikettVarden, appKalla, htmlText) står i tests/helpers/anvandartext.js och
    // delas med termvakten i tests/termer.test.js. Bara literaler som ser ut som text prövas: med blanksteg eller
    // med versal först; värden på etikett:, label: och rubrik: också som ett gement ord. I index.html står de
    // attribut som användaren läser (title, aria-label, data-tooltip, alt, placeholder, data-export-label) kvar som text.

    it('mönstren fångar de avförda orden men inte identifierare och tillåtna former', () => {
        for (const t of ['Lönegapet', 'det råa lönegapet', 'Gapet visar', 'ett gap på', 'rågapet', 'Könsgapet',
            'BAS-nivån', 'Ladda upp strukturdata', 'strukturfilen', 'medarbetarna', 'likvärdiga arbeten',
            'osakliga gap', 'anmälningspliktig', 'EU-direktivets utredningströskel', 'Lagstadgat tröskelvärde', 'Gap-analys',
            'i successionszon', 'Hög successionsrisk', 'Per-BAS conditional gap', 'Privacy by Design', 'Privacy by design', 'Urval (datafunnel)', 'bara vitlistade kolumner', 'Fältvitlistan',
            'lokal-only-arkitektur', 'leverage', 'media-mått', 'rekryteringspipelinen', 'K-anonymitet', 'k-anonymiteten', '4. Exkluderat (k-anon)',
            'utredningskrav', 'enligt EU-direktivet bör', 'Lönetransparensdirektivet kräver att', 'gap över 5 % bör utredas',
            'anmälningspliktiga', 'Unexplained gender pay gap'])
            expect(traffar(t, AVFORDA), t).not.toEqual([]);
        for (const t of ['gapPct', 'meanGap', '68-var-uppstar-gapet.js', 'chart-perbas-gap', 'BAS-nivå B',
            'löneskillnad', 'anställda', 'BAS-intervall', 'likvärdigt arbete', 'lönefilen', '`gap`',
            'Nära pension', 'Inbyggt dataskydd', '(eng. privacy by design)', 'bara godkända fält', 'vitlista `TILLATNA_FALT`', 'inflytelserika punkter', 'rekryteringen', 'minsta gruppstorlek', 'tests/kanonymitet.test.js',
            'ingen anmälningsplikt', 'direktivets regler om gemensam lönebedömning', 'Direktivet skulle vara infört'])
            expect(traffar(t, AVFORDA), t).toEqual([]);
        for (const t of ['(§ 8)', 'art. 9', 'Art. 9', 'artikel 10', '3 kap. 9 §']) expect(traffar(t, LAGRUM_UI), t).not.toEqual([]);
        for (const t of ['Diskrimineringslagen kräver att du analyserar varje skillnad (3 kap.).', 'lagen'])
            expect(traffar(t, LAGRUM_UI), t).toEqual([]);
        for (const t of ['§ 8-bedömningarna', '9 §', '§§ 1–11']) expect(traffar(t, LAGRUM_DOK), t).not.toEqual([]);
        for (const t of ['(§6.4)', 'riskanalysen §8 punkt 1', '`organisationspaket.md` §5']) expect(traffar(t, LAGRUM_DOK), t).toEqual([]);
    });
    it('strängfiltret prövar text men inte identifierare, kommentarer, synonymer eller ordlistans sok-fält', () => {
        const src = "const lonegapPct = 1; // Lönegapets form\n/* Gapet */ x('gap-uppdelning', 'Gapet visar');\n"
            + "{ synonymer: ['lönegap'] } { sok:'lönegap gap k-anonymitet' } y(`Läs in ${'Strukturdata'} först`);";
        expect(textLiteraler(appKalla('x.js', src))).toEqual(['Gapet visar', 'Läs in   först']);
        expect(etikettVarden("gap: { etikett: 'gap', enhet: '%' }, x: { label: 'medellön' }, y: { rubrik: \"Lönegap\" }"))
            .toEqual(['gap', 'medellön', 'Lönegap']);
        expect(htmlText('<th id="lonegap" class="gap" title="Lönegap">Kvinnor</th>')).toBe('<th [Lönegap] >Kvinnor</th>');
    });

    const appFiler = [
        ...appDelar.map(f => `src/app/${f}`),
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

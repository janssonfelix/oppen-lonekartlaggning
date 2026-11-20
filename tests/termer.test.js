/**
 * Termerna på ett ställe (ADR-74): src/lib/termer.js har AID:s ord som variabler, med ordformer och genus, och
 * hjälparna som böjer dem. Enhetstesterna prövar standarden och en annan uppsättning (ett ett-ord, yrke), så att det
 * syns att texter som byggs med hjälparna blir riktig svenska i båda.
 *
 * Vakten håller de avförda orden (yrke, yrkesgrupp, jämförelseyrke, yrkeskod, yrkesbenämning, AID-grupp, sektor
 * om AID:s huvudområde) och termernas egna ordformer borta från det användaren läser i src/app/, src/lib/ och
 * src/index.html, på samma sätt som tests/farger.test.js håller färgkoderna på ett ställe. Alla filer prövas; det
 * som får stå kvar står som uttryckliga undantag med skäl nedan. Användardokumenten (docs/anvandare/, docs/dataskydd/)
 * prövas för de avförda orden i löptexten.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { JSDOM } from 'jsdom';
import { STANDARDTERMER, TERM_BEGREPP, TERM_FORMER, TERM_MAX, skapaTermer, genitiv, stor, artikel, adjektiv, termFras,
    ordForAntal, fyllTermer, termformer } from '../src/lib/termer.js';
import { namnGenitiv } from '../src/lib/namn.js';
import { textLiteraler, etikettVarden, appKalla, htmlText, LASTA_ATTRIBUT } from './helpers/anvandartext.js';
import { createAppWindow } from './helpers/app-harness.js';

const ROOT = join(import.meta.dirname, '..');
const läs = f => readFileSync(join(ROOT, f), 'utf8');

// En annan uppsättning: yrke är ett ett-ord, och benämningen ett en-ord. Bara för testerna.
const YRKE = skapaTermer({
    enhet: { en: 'yrke', bf: 'yrket', fl: 'yrken', bfl: 'yrkena', genus: 'neutrum' },
    jamforelse: { en: 'jämförelseyrke', bf: 'jämförelseyrket', fl: 'jämförelseyrken', bfl: 'jämförelseyrkena', genus: 'neutrum' },
    kod: { en: 'yrkeskod', bf: 'yrkeskoden', fl: 'yrkeskoder', bfl: 'yrkeskoderna', genus: 'utrum' },
    namn: { en: 'yrkesbenämning', bf: 'yrkesbenämningen', fl: 'yrkesbenämningar', bfl: 'yrkesbenämningarna', genus: 'utrum' },
});
const AID_METODTEXT = /const AID_METODTEXT = '([^']*)';/.exec(läs('src/app/04-ordlista.js'))[1];

describe('termerna: standarduppsättningen', () => {
    it('har AID:s ord med ordformer och genus', () => {
        expect(TERM_BEGREPP).toEqual(['enhet', 'jamforelse', 'kod', 'namn', 'huvudomrade', 'niva']);
        expect(TERM_FORMER).toEqual(['en', 'bf', 'fl', 'bfl']);
        expect(STANDARDTERMER.enhet).toEqual({ en: 'AID-etikett', bf: 'AID-etiketten', fl: 'AID-etiketter', bfl: 'AID-etiketterna', kort: 'AID', genus: 'utrum' });
        expect(STANDARDTERMER.jamforelse.bfl).toBe('jämförelseetiketterna');
        expect(STANDARDTERMER.kod).toEqual({ en: 'AID-kod', bf: 'AID-koden', fl: 'AID-koder', bfl: 'AID-koderna', genus: 'utrum' });
        expect(STANDARDTERMER.namn).toEqual({ en: 'etikettnamn', bf: 'etikettnamnet', fl: 'etikettnamn', bfl: 'etikettnamnen', genus: 'neutrum' });
        expect(STANDARDTERMER.huvudomrade).toEqual({ en: 'huvudområde', bf: 'huvudområdet', fl: 'huvudområden', bfl: 'huvudområdena', genus: 'neutrum' });
        expect(STANDARDTERMER.niva).toEqual({ en: 'BAS-intervall', bf: 'BAS-intervallet', fl: 'BAS-intervall', bfl: 'BAS-intervallen', genus: 'neutrum' });
        expect(STANDARDTERMER.system).toBe('AID');
        expect(Object.isFrozen(STANDARDTERMER) && Object.isFrozen(STANDARDTERMER.enhet)).toBe(true);
    });
    it('den korta formen finns bara för AID-etikett; de andra begreppen har ingen (ADR-75)', () => {
        for (const b of TERM_BEGREPP) if (b !== 'enhet') expect(STANDARDTERMER[b].kort, b).toBeUndefined();
    });
    it('termformer listar varje ordform en gång, längsta först', () => {
        const f = termformer();
        expect(f).toContain('AID-etiketterna');
        expect(f).toContain('etikettnamn');
        expect(new Set(f).size).toBe(f.length);
        expect(f.indexOf('AID-etiketterna')).toBeLessThan(f.indexOf('AID-etikett'));
    });
});

describe('termerna: hjälparna', () => {
    const S = STANDARDTERMER;
    it('genitiv: +s, utom efter s, x och z; namn.js använder samma regel', () => {
        expect(genitiv('AID-etiketten')).toBe('AID-etikettens');
        expect(genitiv('BAS-intervall')).toBe('BAS-intervalls');
        expect(genitiv('huvudområdes')).toBe('huvudområdes');
        expect(genitiv('Box')).toBe('Box');
        expect(genitiv('  ')).toBe('');
        expect(namnGenitiv('  Exempelkommunen ')).toBe('Exempelkommunens');
    });
    it('stor begynnelsebokstav rör bara första tecknet', () => {
        expect(stor('huvudområdet')).toBe('Huvudområdet');
        expect(stor('AID-etikett')).toBe('AID-etikett');
        expect(stor('ämne')).toBe('Ämne');
        expect(stor('')).toBe('');
    });
    it('artikeln följer genus och antal', () => {
        expect(artikel(S.enhet)).toBe('en');
        expect(artikel(S.niva)).toBe('ett');
        expect(artikel(S.enhet, { bestamd: true })).toBe('den');
        expect(artikel(S.niva, { bestamd: true })).toBe('det');
        expect(artikel(S.niva, { bestamd: true, plural: true })).toBe('de');
        expect(artikel(S.niva, { plural: true })).toBe('');
    });
    it('adjektivet böjs efter genus och antal; ett oregelbundet anges med sina tre former', () => {
        const fall = [['kvinnodominerad', 'kvinnodominerat', 'kvinnodominerade'], ['sexsiffrig', 'sexsiffrigt', 'sexsiffriga'],
            ['stor', 'stort', 'stora'], ['känd', 'känt', 'kända'], ['röd', 'rött', 'röda'], ['lätt', 'lätt', 'lätta'],
            ['ny', 'nytt', 'nya'], ['lägre', 'lägre', 'lägre'], ['lika', 'lika', 'lika']];
        for (const [utrum, neutrum, plural] of fall) {
            expect(adjektiv(utrum, S.enhet), utrum).toBe(utrum);
            expect(adjektiv(utrum, S.niva), utrum).toBe(neutrum);
            expect(adjektiv(utrum, S.niva, { plural: true }), utrum).toBe(plural);
            expect(adjektiv(utrum, S.enhet, { bestamd: true }), utrum).toBe(plural);
        }
        const egen = { utrum: 'egen', neutrum: 'eget', plural: 'egna' };
        expect([adjektiv(egen, S.enhet), adjektiv(egen, S.niva), adjektiv(egen, S.niva, { plural: true })]).toEqual(['egen', 'eget', 'egna']);
    });
    it('termFras: formen, med adjektiv (bestämd form får den/det/de) och genitiv', () => {
        expect(termFras(S.enhet)).toBe('AID-etikett');
        expect(termFras(S.enhet, 'fl', { adjektiv: 'kvinnodominerad' })).toBe('kvinnodominerade AID-etiketter');
        expect(termFras(S.enhet, 'bf', { adjektiv: 'kvinnodominerad' })).toBe('den kvinnodominerade AID-etiketten');
        expect(termFras(S.enhet, 'bfl', { adjektiv: 'kvinnodominerad' })).toBe('de kvinnodominerade AID-etiketterna');
        expect(termFras(S.enhet, 'bf', { genitiv: true })).toBe('AID-etikettens');
        expect(() => termFras(S.enhet, /** @type {any} */ ('xx'))).toThrow(/ordform/);
    });
    it('kort form: AID för AID-etikett, annars obestämd form; genitiv går, adjektiv inte', () => {
        expect(termFras(S.enhet, 'kort')).toBe('AID');
        expect(termFras(S.jamforelse, 'kort')).toBe('jämförelseetikett');
        expect(termFras(S.enhet, 'kort', { genitiv: true })).toBe('AIDs');
        expect(fyllTermer('{enhet.kort}')).toBe('AID');
        expect(fyllTermer('{Enhet.kort} median högre (kr)')).toBe('AID median högre (kr)');
        expect(fyllTermer('{Niva.kort}')).toBe('BAS-intervall');
        expect(fyllTermer('{enhet.kort:kvinnodominerad}')).toBe('{enhet.kort:kvinnodominerad}');
        expect(termformer()).not.toContain('AID');
    });
    it('ordForAntal: singular vid 1, annars plural', () => {
        expect(`1 ${ordForAntal(1, S.enhet)}`).toBe('1 AID-etikett');
        expect(`3 ${ordForAntal(3, S.enhet)}`).toBe('3 AID-etiketter');
        expect(`2 ${ordForAntal('2', S.niva)}`).toBe('2 BAS-intervall');
    });
    it('fyllTermer: formerna, versal, genitiv, artikel och adjektiv; andra klamrar står kvar', () => {
        expect(fyllTermer('Kvinnor och män med samma {enhet.en}')).toBe('Kvinnor och män med samma AID-etikett');
        expect(fyllTermer('{Enhet.bfl} i samma {niva.en}')).toBe('AID-etiketterna i samma BAS-intervall');
        expect(fyllTermer('{huvudomrade}')).toBe('huvudområde');
        expect(fyllTermer('{Huvudomrade.bf} och {system.s} etikettlista')).toBe('Huvudområdet och AIDs etikettlista');
        expect(fyllTermer('{enhet.art} {enhet.en:kvinnodominerad}')).toBe('en kvinnodominerad AID-etikett');
        expect(fyllTermer('{Enhet.bf:kvinnodominerad} har lägre lön')).toBe('Den kvinnodominerade AID-etiketten har lägre lön');
        expect(fyllTermer('räknas som {enhet.adj:kvinnodominerad}')).toBe('räknas som kvinnodominerad');
        expect(fyllTermer('{jamforelse.bf.s} median')).toBe('jämförelseetikettens median');
        expect(fyllTermer('minst {k} och {golv}, {benchmarkLabel}, {okänd.en}, {enhet.xx}')).toBe('minst {k} och {golv}, {benchmarkLabel}, {okänd.en}, {enhet.xx}');
        expect(fyllTermer('{enhet.art.s} {enhet.adj}')).toBe('{enhet.art.s} {enhet.adj}');
    });
});

describe('termerna: en annan uppsättning (ett ett-ord) blir riktig svenska', () => {
    it('skapaTermer lägger uppsättningen över standarden', () => {
        expect(YRKE.enhet.en).toBe('yrke');
        expect(YRKE.niva).toBe(STANDARDTERMER.niva);
        expect(YRKE.system).toBe('AID');
        expect(skapaTermer()).toBe(STANDARDTERMER);
        expect(skapaTermer({ system: '  Egen  kod ' }).system).toBe('Egen kod');
        expect(YRKE.enhet.kort).toBeUndefined();
        expect(fyllTermer('{Enhet.kort} median högre (kr)', YRKE)).toBe('Yrke median högre (kr)');
        const medKort = skapaTermer({ enhet: { ...YRKE.enhet, kort: ' Y ' } });
        expect([medKort.enhet.kort, fyllTermer('{enhet.kort}', medKort)]).toEqual(['Y', 'Y']);
        expect(Object.isFrozen(YRKE)).toBe(true);
    });
    it('artikel, adjektiv och genitiv följer ett-ordet', () => {
        const par = [
            ['{enhet.art} {enhet.en:kvinnodominerad}', 'en kvinnodominerad AID-etikett', 'ett kvinnodominerat yrke'],
            ['{enhet.fl:kvinnodominerad}', 'kvinnodominerade AID-etiketter', 'kvinnodominerade yrken'],
            ['{Enhet.bf:kvinnodominerad} har lägre lön än {jamforelse.bf}', 'Den kvinnodominerade AID-etiketten har lägre lön än jämförelseetiketten',
                'Det kvinnodominerade yrket har lägre lön än jämförelseyrket'],
            ['{enhet.bf.s} median', 'AID-etikettens median', 'yrkets median'],
            ['{jamforelse.bf.s} median', 'jämförelseetikettens median', 'jämförelseyrkets median'],
            ['räknas som {enhet.adj:kvinnodominerad}', 'räknas som kvinnodominerad', 'räknas som kvinnodominerat'],
            ['{Enhet.art} {enhet.en} består av {kod.art} {kod.en:sexsiffrig} och {namn.art} {namn.en}',
                'En AID-etikett består av en sexsiffrig AID-kod och ett etikettnamn', 'Ett yrke består av en sexsiffrig yrkeskod och en yrkesbenämning'],
            ['där {kod.bf} står {kod.adj:följd} av {namn.bf}', 'där AID-koden står följd av etikettnamnet', 'där yrkeskoden står följd av yrkesbenämningen'],
        ];
        for (const [mall, standard, yrke] of par) {
            expect(fyllTermer(mall), mall).toBe(standard);
            expect(fyllTermer(mall, YRKE), mall).toBe(yrke);
        }
        expect(`1 ${ordForAntal(1, YRKE.enhet)}, 3 ${ordForAntal(3, YRKE.enhet)}`).toBe('1 yrke, 3 yrken');
        expect(`${artikel(YRKE.enhet)} ${termFras(YRKE.enhet, 'en', { adjektiv: 'kvinnodominerad' })}`).toBe('ett kvinnodominerat yrke');
    });
    it('metodtexten om AID blir riktig svenska med båda uppsättningarna', () => {
        expect(fyllTermer(AID_METODTEXT)).toContain('En AID-etikett består av en sexsiffrig AID-kod och ett etikettnamn och står för ett arbetsområde.');
        expect(fyllTermer(AID_METODTEXT, YRKE)).toContain('Ett yrke består av en sexsiffrig yrkeskod och en yrkesbenämning och står för ett arbetsområde.');
        expect(fyllTermer(AID_METODTEXT, YRKE)).toContain('Yrkena är därför en utgångspunkt för lika arbete');
        for (const t of [STANDARDTERMER, YRKE]) expect(fyllTermer(AID_METODTEXT, t)).not.toMatch(/\{/);
    });
    it('avvisar tomma, för långa och okända värden, ofullständiga begrepp och tecken som inte får stå i en mall', () => {
        const hel = { en: 'a', bf: 'b', fl: 'c', bfl: 'd', genus: 'utrum' };
        expect(() => skapaTermer({ enhet: { ...hel, en: ' ' } })).toThrow(/enhet\.en/);
        expect(() => skapaTermer({ enhet: { ...hel, fl: 'x'.repeat(TERM_MAX + 1) } })).toThrow(/längre än/);
        expect(() => skapaTermer({ enhet: { ...hel, bfl: undefined } })).toThrow(/enhet\.bfl/);
        expect(() => skapaTermer({ enhet: { ...hel, genus: 'maskulinum' } })).toThrow(/genus/);
        expect(() => skapaTermer(/** @type {any} */ ({ grupp: hel }))).toThrow(/Okänt begrepp/);
        expect(() => skapaTermer({ enhet: { ...hel, en: '<b>x</b>' } })).toThrow(/tecken/);
        expect(() => skapaTermer({ enhet: { ...hel, en: '{niva.en}' } })).toThrow(/tecken/);
        expect(() => skapaTermer({ system: '' })).toThrow(/system/);
        expect(() => skapaTermer({ enhet: { ...hel, kort: ' ' } })).toThrow(/enhet\.kort/);
        expect(() => skapaTermer({ enhet: { ...hel, kort: '{x}' } })).toThrow(/tecken/);
        expect(() => skapaTermer(/** @type {any} */ ([]))).toThrow(/objekt/);
    });
});

describe('termerna i appen', () => {
    it('T är standarduppsättningen och termText fyller mallar', () => {
        const w = createAppWindow();
        expect(w.eval('T.enhet.fl')).toBe('AID-etiketter');
        expect(w.eval('termText("{Enhet.bfl} i samma {niva.en}, minst {k}")')).toBe('AID-etiketterna i samma BAS-intervall, minst {k}');
        expect(w.eval('termArtikel(T.enhet) + " " + termFras(T.enhet, "en", { adjektiv: "kvinnodominerad" })')).toBe('en kvinnodominerad AID-etikett');
    });
    it('data-term-template fyller texten eller attributet i data-term-attr', () => {
        const w = createAppWindow(), d = w.document;
        const matrix = d.getElementById('tab-matrix');
        matrix.setAttribute('data-tip', 'x');
        const not = d.querySelector('#la-aid-bakgrund span[data-term-template]');
        not.textContent = 'x';
        w.eval('applyProfileLabels()');
        expect(matrix.getAttribute('data-tip')).toBe('Kvinnor och män med samma AID-etikett — skiljer sig lönen?');
        expect(matrix.textContent).not.toMatch(/AID-etikett/);
        expect(not.textContent).toBe(fyllTermer(AID_METODTEXT));
    });
    it('Löneläget: kolumnrubriken har den korta formen, exportetiketten hela termen (ADR-75)', () => {
        const w = createAppWindow(), d = w.document;
        w.eval('applyProfileLabels()');
        const th = d.querySelector('#benchmark-thead th');
        expect(th.textContent.trim()).toBe('AID');
        expect(th.getAttribute('data-export-label')).toBe('AID-etikett');
    });
    it('ordlistan visar posterna med termerna och hittar dem på de gamla orden (fältet sok)', () => {
        const w = createAppWindow(), d = w.document;
        const termer = t => { w.eval(`renderGlossary(${JSON.stringify(t)})`); return [...d.querySelectorAll('#glossary-content .glossary-term')].map(e => e.textContent); };
        const alla = termer('');
        for (const t of ['AID-etikett', 'AID-kod', 'Huvudområde', 'BAS-intervall', 'Oförklarad skillnad per BAS-intervall']) expect(alla).toContain(t);
        expect(alla).not.toContain('Yrkesgrupp');
        expect(d.getElementById('glossary-content').textContent).not.toMatch(/\{(?:[A-Za-z]+[.:}])/);
        for (const ord of ['yrke', 'yrkesgrupp', 'yrkesbenämning']) expect(termer(ord), ord).toContain('AID-etikett');
        expect(termer('yrkeskod')).toContain('AID-kod');
        expect(termer('sektor')).toContain('Huvudområde');
        expect(termer('jämförelseyrke')).toContain('Kandidatpar');
    });
    it('ordlistans mallar blir hela texter också med en annan uppsättning', () => {
        const w = createAppWindow();
        for (const g of w.eval('GLOSSARY')) {
            for (const t of [STANDARDTERMER, YRKE]) {
                for (const falt of [g.term, g.short, g.long]) expect(fyllTermer(falt, t), g.term).not.toMatch(/\{(?!k\}|golv\})[^}]*\}/);
            }
        }
    });
    it('metodtexten är fylld i Om verktyget och i Word-utkastet', () => {
        const w = createAppWindow();
        w.document.querySelector('.nav-item[data-tab="info"]').click();
        w.eval("renderInfoTab('metodik')");
        expect(w.document.getElementById('om-aid').textContent.replace(/\s+/g, ' ')).toContain(fyllTermer(AID_METODTEXT));
        w.__loadDemoData();
        const html = w.__docDraftHtml();
        expect(html).toContain('En AID-etikett består av en sexsiffrig AID-kod och ett etikettnamn');
        expect(html).not.toMatch(/\{(?:enhet|kod|namn|niva|jamforelse|huvudomrade)/i);
    });
});

// ---- Vakten ----

// De avförda orden. Yrke fångas i varje ord där det ingår (yrkesgrupp, jämförelseyrke, yrkeskod, yrkesbenämning …),
// men inte i identifierare (yrkeLabel, data-yrke, r.yrke). Sektor fångas bara som eget ord eller förled.
const AVFORDA = [
    ['yrke', /(?<![\p{L}\p{N}_\-.])(?:\p{Lu}?\p{Ll}*yrke|Yrke)\p{Ll}*(?![\p{L}\p{N}_\-])/gu],
    ['AID-grupp', /AID(?:×BAS)?-grupp\p{Ll}*/gu],
    ['sektor', /(?<![\p{L}\p{N}_\-.])[Ss]ektor\p{Ll}*(?![\p{L}\p{N}_\-])/gu],
];
// Termernas egna ordformer (och genitiv), med stor eller liten begynnelsebokstav.
const reEsc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const TERMFORMER = new RegExp(`(?<![\\p{L}\\p{N}_\\-])(?:${termformer().map(f => `[${f[0].toLowerCase()}${f[0].toUpperCase()}]${reEsc(f.slice(1))}`).join('|')})s?(?![\\p{L}\\p{N}_])`, 'gu');

// Undantag, uttryckligen. Ord: bristyrke är ett eget begrepp i Prioritering, yrkesliv ett vardagligt ord.
const UNDANTAG_ORD = /^(?:[Bb]ristyrke\p{Ll}*|[Yy]rkesliv\p{Ll}*)$/u;
// Fraser där yrke eller sektor används i vardaglig mening eller om något annat än AID, per fil.
const UNDANTAG_FRASER = [
    { fil: 'src/app/04-ordlista.js', fras: 'arbetar i olika yrken och sektorer', skal: 'arbetsmarknaden i hela samhället, inte AID' },
    { fil: 'src/app/04-ordlista.js', fras: 'standardvägning för yrke, sektor, utbildning', skal: 'den nationella statistikens variabler (Medlingsinstitutets rapport)' },
    { fil: 'src/index.html', fras: 'arbetar ofta i olika yrken och sektorer', skal: 'arbetsmarknaden i hela samhället, inte AID' },
    { fil: 'src/index.html', fras: 'standardvägning för yrke, sektor, utbildning', skal: 'den nationella statistikens variabler (Medlingsinstitutets rapport)' },
    { fil: 'src/index.html', fras: 'Vilken sektor som räknas', skal: 'sektor som kommuner eller regioner (inställningen för den nationella statistiken)' },
    { fil: 'src/lib/regression.js', fras: '+ Yrkesgrupp', skal: 'nyckeln för stegets namn i dekomponeringen; det som visas kommer ur stegEtikett' },
    { fil: 'src/lib/regression.js', fras: '+ BAS-intervall', skal: 'nyckeln för stegets namn i dekomponeringen; det som visas kommer ur stegEtikett' },
    { fil: 'src/app/40-alder-karriar.js', fras: 'utbildning, yrkesval och anställningstid', skal: 'vardagligt ord om personers val, inte AID' },
    { fil: 'src/app/55-prioritering.js', fras: 'Erfarenhet och tid i yrket', skal: 'personens erfarenhet, vardagligt ord, inte AID' },
    { fil: 'src/app/56-handlingsplan.js', fras: 'svårrekryterat yrke i regionen', skal: 'demots exempel på ett sakligt skäl (marknad), vardagligt ord' },
    { fil: 'src/app/56-handlingsplan.js', fras: 'längre yrkeserfarenhet', skal: 'demots exempel på ett sakligt skäl (erfarenhet), vardagligt ord' },
    { fil: 'src/lib/sakligaskal.js', fras: 'Svårrekryterade yrken eller konkurrens', skal: 'kategorin Marknad bland de sakliga skälen, vardagligt ord om arbetsmarknaden' },
    { fil: 'src/lib/sakligaskal.js', fras: 'Dokumenterad yrkeserfarenhet', skal: 'kategorin Erfarenhet bland de sakliga skälen, personens erfarenhet' },
    { fil: 'src/index.html', fras: 'Markera som bristyrke: yrken som organisationen har svårt att rekrytera till', skal: 'vad ett bristyrke är (Prioritering), vardagligt ord' },
    { fil: 'src/index.html', fras: 'i lönefilen ofta Yrke eller Befattning', skal: 'lönefilens kolumnrubriker, som verktyget känner igen (ALLOWED_FIELDS)' },
    { fil: 'src/app/32-filinlasning.js', fras: 'i lönefilen ofta Yrke eller Befattning', skal: 'lönefilens kolumnrubriker i kolumnmappningen, som verktyget känner igen (ALLOWED_FIELDS)' },
    { fil: 'src/app/65-om-verktyget.js', fras: 'utbildning, yrkesval och anställningstid', skal: 'vardagligt ord om personers val, inte AID' },
    { fil: 'src/app/21-stort-demo.js', fras: 'Yrkeslärare gymnasieskola', skal: 'AID:s egen etikett i det stora demot (som i aid-etiketter.js)' },
    { fil: 'src/app/21-stort-demo.js', fras: 'Studie- och yrkesvägledare', skal: 'AID:s egen etikett i det stora demot (som i aid-etiketter.js)' },
];
// Kolumnigenkänningen jämför med lönefilens rubriker, som är filens ord och inte verktygets: lönefiler med rubriken
// Yrke, Yrkesgrupp eller Befattning ska fortfarande läsas in (ALLOWED_FIELDS), och importprofilernas rubriker och
// kännetecken är rubrikerna i en känd uppsättning. De blocken prövas inte.
const KOLUMNIGENKANNING = [
    { fil: 'src/app/06-uppgiftsminimering.js', block: /const ALLOWED_FIELDS = \{[\s\S]*?\n\};/g },
    { fil: 'src/lib/importprofiler.js', block: /\b(?:rubriker|kannetecken):\s*(?:\{[^}]*\}|\[[^\]]*\])/g },
    // CSV-mallens rubriker är kolumnnamnen i filen som laddas ned, och de ska kännas igen när filen läses in igen.
    { fil: 'src/app/32-filinlasning.js', block: /const CSV_MALL_RUBRIKER = \[[^\]]*\];/g },
];
// Filer som inte prövas: AID:s etikettlista är data, och etikettnamnen är AID:s egna (till exempel Studie- och yrkesvägledare).
const UNDANTAG_FILER = ['src/lib/aid-etiketter.js'];


/** Träffarna i en text: avförda ord (utom undantagsorden) och termernas ordformer. */
function traffar(text) {
    const ut = [];
    for (const [namn, re] of AVFORDA) for (const m of text.matchAll(re)) if (!UNDANTAG_ORD.test(m[0])) ut.push(`${namn}: ${m[0]}`);
    for (const m of text.matchAll(TERMFORMER)) ut.push(`term: ${m[0]}`);
    return ut;
}
const utanFraser = (fil, text) => UNDANTAG_FRASER.filter(u => u.fil === fil).reduce((t, u) => t.split(u.fras).join(' '), text);

/** index.html: elementen med data-term-template prövas mot sin mall och tas sedan bort ur det som granskas. */
function htmlUtanMallar(src) {
    const dom = new JSDOM(src);
    for (const el of dom.window.document.querySelectorAll('[data-term-template]')) {
        const attr = el.getAttribute('data-term-attr');
        if (attr) el.removeAttribute(attr); else el.textContent = '';
        el.removeAttribute('data-term-template');
    }
    return dom.serialize();
}

/** Det användaren läser i en fil, som texter att pröva. */
function synligText(fil) {
    const src = läs(fil);
    if (fil.endsWith('.html')) return [utanFraser(fil, htmlText(htmlUtanMallar(src), [...LASTA_ATTRIBUT, 'data-tip', 'data-k-tooltip']))];
    let k = appKalla(fil, src);
    for (const u of KOLUMNIGENKANNING) if (u.fil === fil) k = k.replace(u.block, '');
    return [...textLiteraler(k), ...etikettVarden(k)].map(l => utanFraser(fil, l));
}
const fyndI = fil => synligText(fil).flatMap(t => traffar(t).map(n => `${fil}: ${n}: ${t.trim().slice(0, 90)}`));

const GRANSKADE = [
    ...readdirSync(join(ROOT, 'src/app')).filter(f => /^\d\d-.*\.js$/.test(f) && f !== '09-lib-speglar.js').map(f => `src/app/${f}`),
    ...readdirSync(join(ROOT, 'src/lib')).filter(f => f.endsWith('.js') && f !== 'termer.js').map(f => `src/lib/${f}`),
    'src/index.html',
].filter(f => !UNDANTAG_FILER.includes(f));

describe('vakt: AID:s ord står bara i termer.js (ADR-74)', () => {
    it('mönstret fångar de avförda orden och termernas former i en text, men inte identifierare och undantagen', () => {
        for (const t of ['Alla yrkesgrupper', 'Yrkesgrupp', 'samma yrke', 'yrken', 'yrket', 'jämförelseyrket', 'Jämförelseyrke', 'yrkeskod',
            'Yrkesbenämning', 'kvinnoyrken', 'Om AID-grupperna', 'AID×BAS-grupp', 'per sektor', 'Sektorer', 'sektorsöversikten',
            'AID-etiketter', 'BAS-intervallen', 'BAS-intervallets', 'huvudområdets', 'Huvudområde', 'etikettnamnet', 'jämförelseetikett', 'AID-koden'])
            expect(traffar(t), t).not.toEqual([]);
        for (const t of ['yrkeLabel', 'data-yrke', 'r.yrke', 'yrke-modal', 'bristyrken', 'Bristyrke', 'över ett yrkesliv', 'AID-kodningen',
            'AID-mellannivå', 'etikett', 'AID', 'BAS', 'BAS-fördelning', 'sektorsAndel', 'jmf-sektor'])
            expect(traffar(t), t).toEqual([]);
    });
    it('strängfiltret prövar texten, inte identifierare, kommentarer, sok-fält, kolumnigenkänningen eller fyllda mallar', () => {
        const src = "const yrkeLabel = r.yrkeLabel; // yrkesgrupper\n/* Yrke */ x('yrke', 'Alla yrkesgrupper', `${r.yrke} i {niva.en}`); { sok:'yrke yrkesgrupp' }";
        expect(textLiteraler(appKalla('x.js', src)).flatMap(traffar)).toEqual(['yrke: yrkesgrupper']);
        for (const u of KOLUMNIGENKANNING) expect(läs(u.fil), u.fil).toMatch(u.block);
        expect(läs(KOLUMNIGENKANNING[0].fil).match(KOLUMNIGENKANNING[0].block)[0]).toMatch(/"yrkesgrupp","yrke"/);
        const html = '<div data-yrke="x" class="yrke-modal dold" title="Yrkesgrupper">Text <span data-term-template="{enhet.en}">AID-etikett</span>'
            + '<b data-tip="AID-etikett" data-term-template="{enhet.en}" data-term-attr="data-tip">x</b></div>';
        expect(traffar(htmlText(htmlUtanMallar(html), [...LASTA_ATTRIBUT, 'data-tip']))).toEqual(['yrke: Yrkesgrupper']);
    });
    it('ingen fil har avförda ord eller termernas ordformer i det användaren läser', () => {
        expect(GRANSKADE.length).toBeGreaterThan(100);
        expect(GRANSKADE).toContain('src/index.html');
        expect(GRANSKADE.flatMap(fyndI)).toEqual([]);
    });
    it('undantagen står där de sägs stå', () => {
        for (const u of UNDANTAG_FRASER) expect(läs(u.fil), `${u.fil}: ${u.fras}`).toContain(u.fras);
    });
    it('index.html: varje data-term-template har standardtexten i elementet, och alla klamrar är termer', () => {
        // I data-k-tooltip står också {k} och {golv}, som tröskeln fyller i efter termerna (06-k-troskel.js).
        const d = new JSDOM(läs('src/index.html')).window.document;
        const mallar = [...d.querySelectorAll('[data-term-template]')];
        expect(mallar.length).toBeGreaterThanOrEqual(3);
        for (const el of mallar) {
            const mall = el.getAttribute('data-term-template'), attr = el.getAttribute('data-term-attr');
            const fylld = fyllTermer(mall);
            expect(attr === 'data-k-tooltip' ? fylld.replace(/\{(?:k|golv)\}/g, '') : fylld, mall).not.toMatch(/\{/);
            expect(attr ? el.getAttribute(attr) : el.textContent, mall).toBe(fyllTermer(mall));
        }
    });
    it('index.html har samma metodtext som AID_METODTEXT', () => {
        const d = new JSDOM(läs('src/index.html')).window.document;
        expect(d.querySelector('#la-aid-bakgrund span[data-term-template]').getAttribute('data-term-template')).toBe(AID_METODTEXT);
    });
});

// ---- Användardokumenten ----
// Dokumenten för användaren och dataskyddet kan inte läsa termerna och är skrivna med standardorden; de avförda orden får
// inte stå där heller. Termernas ordformer prövas inte (dokumenten skriver dem), och kod inom backtick prövas inte: där
// står namn i koden och lönefilens kolumnnamn. Utvecklardokumenten i docs/utveckling/ prövas inte.
const DOK_KATALOGER = ['docs/anvandare', 'docs/dataskydd'];
// Ord: verbet styrka (styrker) är inget yrke.
const DOK_UNDANTAG_ORD = /^[Ss]tyrk\p{Ll}*$/u;
const DOK_UNDANTAG_FRASER = [
    { fil: 'docs/anvandare/datauttag.md', fras: '*Yrke* eller *Befattning*', skal: 'lönefilens kolumnnamn, som verktyget känner igen (ALLOWED_FIELDS)' },
    { fil: 'docs/anvandare/korguide.md', fras: '*Yrke* eller *Befattning*', skal: 'lönefilens kolumnnamn, som verktyget känner igen (ALLOWED_FIELDS)' },
];
const DOKUMENT = DOK_KATALOGER.flatMap(k => readdirSync(join(ROOT, k)).filter(f => f.endsWith('.md')).map(f => `${k}/${f}`));

/** De avförda orden i en text ur ett dokument, utan kod inom backtick (också över radbrytning) och undantagen. */
function dokTraffar(text, fil = '') {
    let t = text.replace(/`[^`]*`/g, ' ');
    for (const u of DOK_UNDANTAG_FRASER) if (u.fil === fil) t = t.split(u.fras).join(' ');
    const ut = [];
    for (const [namn, re] of AVFORDA) for (const m of t.matchAll(re))
        if (!UNDANTAG_ORD.test(m[0]) && !DOK_UNDANTAG_ORD.test(m[0])) ut.push(`${namn}: ${m[0]}`);
    return ut;
}

describe('vakt: användardokumenten har inte de avförda orden (ADR-74)', () => {
    it('mönstret släpper kod inom backtick och undantagen men fångar orden i löptext', () => {
        expect(DOKUMENT).toContain('docs/anvandare/korguide.md');
        expect(DOKUMENT).toContain('docs/dataskydd/riskanalys.md');
        expect(dokTraffar('Signaturen styrker. Fältet `yrke` och `{ "yrke": […],\n "lon": […] }`; bristyrke.')).toEqual([]);
        expect(dokTraffar('Kolumnen heter ofta *Yrke* eller *Befattning*.', 'docs/anvandare/korguide.md')).toEqual([]);
        expect(dokTraffar('kvinnor och män i samma yrke, per sektor, *Yrke*')).toEqual(['yrke: yrke', 'yrke: Yrke', 'sektor: sektor']);
    });
    it('inget dokument i docs/anvandare/ och docs/dataskydd/ har avförda ord i löptexten', () => {
        expect(DOKUMENT.flatMap(f => dokTraffar(läs(f), f).map(n => `${f}: ${n}`))).toEqual([]);
    });
    it('undantagen står där de sägs stå', () => {
        for (const u of DOK_UNDANTAG_FRASER) expect(läs(u.fil), `${u.fil}: ${u.fras}`).toContain(u.fras);
    });
});

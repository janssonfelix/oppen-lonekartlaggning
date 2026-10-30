/**
 * Invariant: k-anonymiteten, inte stickprov på den.
 *
 * BAKGRUND: `isKMasked` anropas på ett sextiotal ställen i src/app/, men bara
 * ett par av dem hade test. Under arbetet med lönepolitikfliken läckte
 * _lpRenderCompliance grupper under tröskeln — i nyskriven kod som ingen
 * befintlig vakt fångade. Fler stickprov löser inte det; varje ny vy behöver
 * skyddet automatiskt. Första körningen av det här testet hittade tre vyer
 * som redovisade lönemått för BAS-intervall med sex personer (livscykel-
 * översikten, representations-pyramiden och lönespannstabellen).
 *
 * FORM: datasetet har två befolkningar.
 *
 *  1. En STOR "säker" befolkning i sex BAS-intervall med 150 personer i varje.
 *     Den är till för att organisationens EGNA mått — medianer, percentiler,
 *     regressioner — ska ha något lagligt att landa på. Utan den hade vakten
 *     larmat på laglig utdata: P90 för hela organisationen är per definition
 *     någons faktiska lön.
 *
 *  2. Tolv SMÅ grupper med sex personer var (under tröskeln), där alla i en
 *     grupp har exakt samma lön — ett "sentinelvärde" unikt för gruppen. Då är
 *     varje tänkbart gruppaggregat (median, medel, min, max, kvartil) lika med
 *     just det sentinelvärdet.
 *
 * Sentinelvärdena ligger ÖVER hela den säkra befolkningen, och den säkra
 * befolkningen är stor nog att percentilerna upp till P90 stannar i den.
 * Syns ett sentinelvärde i utdatan har alltså en vy röjt en grupp under
 * tröskeln — det finns ingen annan väg dit.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { createAppWindow } from './helpers/app-harness.js';
import { attributtext, utanLagen } from './helpers/attributtext.js';

const SAKRA_BAS = ['S1', 'S2', 'S3', 'S4', 'S5', 'S6'];
const PER_SAKER_BAS = 150;                       // väl över tröskeln

// Ett stort BAS med löner ÖVER sentinelvärdena. Utan det vore organisationens
// högsta lön en av de små gruppernas, och kvartilstabellens Q4-spann (art. 9f)
// hade visat ett sentinelvärde som yttergräns — en extremvärdesredovisning,
// inte ett gruppaggregat, men omöjlig att skilja från en läcka i en textsökning.
const TOPP_BAS = 'S7';

const SMA_BAS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'];
const PER_SMA_BAS = 6;                           // under K_STANDARD (10)

// En unik, "omöjlig" lön per liten grupp, mellan den säkra befolkningens
// 24 000–28 899 och topp-BAS:ets 50 000–50 899.
//
// Siffrorna är medvetet ICKE-repetitiva: en första version använde 31 111,
// 33 333 … och larmade falskt på inline-stilar som `width:31.78333333333%`,
// där flyttalsbrus återskapar repsiffror.
const SENTINEL = [31417, 32719, 33827, 34513, 35291, 36107,
                  37649, 38273, 39461, 40819, 41573, 42967];

function byggDataset() {
    const rader = [];
    // (1) Säker befolkning — spridda löner, jämn könsfördelning.
    SAKRA_BAS.forEach((bas, b) => {
        for (let i = 0; i < PER_SAKER_BAS; i++) {
            rader.push({
                bas,
                kon: i % 2 === 0 ? 'kvinna' : 'man',
                lon: 24000 + (b * 800) + ((i * 37) % 900),
                alder: 25 + ((i * 7) % 40),
                yrke: `${6000 + b} Säkeryrke ${b}`,
                aid: String(6000 + b),
                yrkeLabel: `Säkeryrke ${b}`,
                enhet: ''
            });
        }
    });
    // (1b) Topp-BAS — håller organisationens högsta lön utanför sentinelbandet.
    for (let i = 0; i < PER_SAKER_BAS; i++) {
        rader.push({
            bas: TOPP_BAS,
            kon: i % 2 === 0 ? 'kvinna' : 'man',
            lon: 50000 + ((i * 37) % 900),
            alder: 25 + ((i * 7) % 40),
            yrke: '6900 Toppyrke',
            aid: '6900',
            yrkeLabel: 'Toppyrke',
            enhet: ''
        });
    }
    // (2) Små grupper — alla i gruppen på exakt sitt sentinelvärde.
    SMA_BAS.forEach((bas, g) => {
        for (let i = 0; i < PER_SMA_BAS; i++) {
            rader.push({
                bas,
                kon: i % 2 === 0 ? 'kvinna' : 'man',
                lon: SENTINEL[g],
                alder: 30 + (i * 3) + g,
                yrke: `${5300 + g} Yrke ${g}`,
                aid: String(5300 + g),
                yrkeLabel: `Yrke ${g}`,
                enhet: ''
            });
        }
    });
    return rader;
}

// Policyspann för samtliga BAS så att även lönepolitikfliken har något att rita.
function byggPolicy() {
    return [...SAKRA_BAS, TOPP_BAS, ...SMA_BAS].map(b => ({ bas: b, p10: 22000, med: 30000, p90: 52000 }));
}

const FLIKAR = ['dashboard', 'bestammelser', 'matrix', 'likvardighet', 'struktur',
                'prioritering', 'loneoversyn', 'kon', 'demografi', 'benchmark',
                'utforska', 'benchmark', 'kvalitet', 'rapport', 'handlingsplan', 'info'];

// Tar bort mellanrum inuti tal ("31 111" / "31 111" -> "31111") så att
// formaterade belopp går att söka i.
const normalisera = t => t.replace(/(\d)[\s  ](?=\d)/g, '$1');

// Alla lövelement vars text ELLER attribut (data-sort-value bär råa tal)
// innehåller ett sentinelvärde.
function rojandeElement(win) {
    const ut = [];
    for (const el of win.document.body.querySelectorAll('*')) {
        // Utforska visar medvetet grupper under tröskeln (ADR-14): vyn är ett
        // analysverktyg för den som redan har rådatan, och skyddet flyttar till
        // exporten. Det som VISAS där undantas; exporten vaktas i egen describe nedan.
        if (el.closest('#view-utforska')) continue;
        if (el.closest('#personer-att-granska')) continue;   // ADR-23: individlista, bara i verktyget
        if (el.children.length) continue;
        const attr = attributtext(el);
        const text = normalisera(`${el.textContent} ${attr}`);
        if (SENTINEL.some(s => text.includes(String(s)))) ut.push(el);
    }
    return ut;
}

// Element med ett diagram ritat av diagramkärnan (utom Utforska, vars export vaktas för sig), och det som kan lämna
// verktyget ur ett sådant: den exporterade bildens SVG och diagramdatans rader.
function karnansDiagram(w) {
    // Individdiagrammen (en punkt per person; lådagrammets avvikare) undantas som i tests/ktroskel.test.js: deras export
    // bär enskilda löner i dag, också för personer i små grupper — öppen fråga i teknisk-plan § 9 (ADR-14), inte ny här.
    const INDIVIDDIAGRAM = new Set(['chart-kon-boxplot']);
    return [...w.document.body.querySelectorAll('*')].filter(el => el._figur && !el.closest('#view-utforska') && !INDIVIDDIAGRAM.has(el.id));
}
function karnansUtdata(w, el) {
    w.__kel = el;
    // Lägesattributen (pixlar med många decimaler) tas bort: de bär ingen lön men kan av en slump likna ett belopp.
    return [utanLagen(el.outerHTML),
        utanLagen(w.eval('(() => { const u = _rfExportFigur(window.__kel); return u && !u.tom ? figurTillSvg(u.figur, 1600, 900, { visaSma: u.visaSma, dolda: u.dolda }) : ""; })()')),
        JSON.stringify(w.eval('chartExportRows(window.__kel)'))];
}

// Vilken flikpanel ett element ligger i — för ett begripligt felmeddelande.
function panelFor(el) {
    let a = el;
    while (a && !(a.classList && a.classList.contains('view-panel'))) a = a.parentElement;
    return a && a.id ? a.id : '(utanför flikpanel)';
}

let win;
let sedda;   // element som redan rapporterats, så en läcka inte smittar alla efterföljande flikar

beforeAll(() => {
    win = createAppWindow();
    win.__state.data = byggDataset();
    win.__state.policy = byggPolicy();
    win.eval('populateSelects(); unlockTabs();');
    // Vyerna ritas här i exportläget (ADR-51): så läser exporterna dem. Skärmläget prövas positivt nedan.
    win.__state.kLage = 'export';
    sedda = new WeakSet();
    for (const el of rojandeElement(win)) sedda.add(el);
});

describe('k-anonymitet: skärmen maskerar inget (ADR-51)', () => {
    it('på skärmen visar flikarna grupperna under tröskeln; i exportläget inte', () => {
        const w = createAppWindow();
        w.__state.data = byggDataset();
        w.__state.policy = byggPolicy();
        w.eval('populateSelects(); unlockTabs();');
        for (const f of ['matrix', 'struktur', 'prioritering']) w.__renderTabContent(f);
        expect(rojandeElement(w).length).toBeGreaterThan(0);
        w.__state.kLage = 'export';
        w.eval('ritGenerationNy()');
        for (const f of ['matrix', 'struktur', 'prioritering']) w.__renderTabContent(f);
        expect(rojandeElement(w)).toEqual([]);
    });
});

describe('k-anonymitet: invariant över samtliga flikar (i exportläget)', () => {
    it('de små grupperna ligger under tröskeln och de säkra över', () => {
        const perBas = new Map();
        for (const r of win.__state.data) perBas.set(r.bas, (perBas.get(r.bas) || 0) + 1);
        for (const bas of SMA_BAS) expect(perBas.get(bas), `BAS ${bas}`).toBeLessThan(10);
        for (const bas of [...SAKRA_BAS, TOPP_BAS]) expect(perBas.get(bas), `BAS ${bas}`).toBeGreaterThanOrEqual(10);
    });

    it('inget sentinelvärde kan uppstå ur organisationens egna mått', () => {
        // De percentiler verktyget redovisar (art. 9f: P10–P90) måste hamna
        // UTANFÖR sentinelbandet, annars larmar vakten på laglig utdata:
        // en organisationsbred percentil är per definition någons faktiska lön.
        // Kontrolleras per kön, eftersom art. 9-tabellen delar upp så.
        const data = win.__state.data;
        const lag = SENTINEL[0], hog = SENTINEL[SENTINEL.length - 1];
        for (const kon of ['kvinna', 'man']) {
            const loner = data.filter(r => r.kon === kon).map(r => r.lon).sort((a, b) => a - b);
            for (const p of [10, 25, 50, 75, 90]) {
                const v = loner[Math.floor((p / 100) * (loner.length - 1))];
                expect(v >= lag && v <= hog, `P${p} för ${kon} (${v}) hamnade i sentinelbandet`).toBe(false);
            }
        }
        // Ytterkanterna hör till de stora BAS:en, så kvartilspann och andra
        // extremvärden kan inte råka visa ett sentinelvärde.
        const alla = data.map(r => r.lon);
        expect(Math.min(...alla)).toBeLessThan(SENTINEL[0]);
        expect(Math.max(...alla)).toBeGreaterThan(SENTINEL[SENTINEL.length - 1]);
    });

    it('FLIKAR täcker varje flik i menyn (annars går en ny flik oprövad)', () => {
        const meny = [...win.document.querySelectorAll('.nav-item[data-tab]')].map(e => e.getAttribute('data-tab'));
        const tackta = new Set(FLIKAR.map(f => win.eval(`tabMal(${JSON.stringify(f)})`)));
        expect(meny.filter(f => !tackta.has(f))).toEqual([]);
        expect([...tackta].filter(f => !meny.includes(f))).toEqual([]);
    });

    for (const flik of FLIKAR) {
        it(`fliken "${flik}" röjer ingen grupp under tröskeln`, () => {
            win.__renderTabContent(flik);
            const nya = rojandeElement(win).filter(el => !sedda.has(el));
            for (const el of nya) sedda.add(el);
            const beskrivning = nya.slice(0, 3).map(el =>
                `${panelFor(el)}: "${normalisera(el.textContent).trim().slice(0, 60)}"`);
            // Diagram ritade med diagramkärnan (ADR-39): också det som EXPORTERAS ur dem granskas — bilden och diagramdatan.
            for (const el of karnansDiagram(win)) {
                const ut = normalisera(karnansUtdata(win, el).join(' '));
                expect(SENTINEL.filter(v => ut.includes(String(v))), `export ur ${el.id} i fliken "${flik}"`).toEqual([]);
            }
            expect(
                beskrivning,
                `Fliken "${flik}" redovisade mått för grupper med n < 10 i ${nya.length} element.`
            ).toEqual([]);
        });
    }
});

// När bara KÖNSUPPDELNINGEN är för liten, men gruppen som helhet ligger över
// tröskeln, utelämnas inte raden — då visas gruppens samlade median. Det är
// den lagliga mellanvägen: ett lönemått att analysera, utan könsjämförelse
// som skulle peka ut de få individerna i det mindre könet.
describe('k-anonymitet: samlad median när bara könsuppdelningen är för liten', () => {
    const KVINNOLON = 60000;   // två kvinnor, samma lön -> deras median vore 60 000
    let w2;

    beforeAll(() => {
        w2 = createAppWindow();
        const rader = [];
        for (let i = 0; i < 2; i++) {
            rader.push({ bas: 'A', kon: 'kvinna', lon: KVINNOLON, alder: 40 + i,
                yrke: '7100 Blandyrke', aid: '7100', yrkeLabel: 'Blandyrke', enhet: '' });
        }
        for (let i = 0; i < 12; i++) {
            rader.push({ bas: 'A', kon: 'man', lon: 70000 + i, alder: 30 + i,
                yrke: '7100 Blandyrke', aid: '7100', yrkeLabel: 'Blandyrke', enhet: '' });
        }
        w2.__state.data = rader;
        w2.eval('populateSelects(); unlockTabs();');
        w2.__state.kLage = 'export';   // så som tabellen lämnar verktyget (ADR-51)
        w2.__renderTabContent('matrix');
    });

    it('raden finns kvar och redovisar gruppens samlade median', () => {
        const html = w2.document.getElementById('matrix-table').textContent;
        expect(html).toContain('7100 Blandyrke');
        expect(html).toContain('Gruppens median');
    });

    it('kvinnornas median redovisas inte', () => {
        // Personer att granska visar enskilda i verktyget (ADR-23, samma princip som
        // Utforska i ADR-14); den vaktas i stället av testet att listan aldrig lämnar verktyget.
        const kropp = w2.document.body.cloneNode(true);
        kropp.querySelector('#personer-att-granska')?.remove();
        const text = kropp.textContent.replace(/(\d)[\s\u00a0\u202f](?=\d)/g, '$1');
        expect(text).not.toContain(String(KVINNOLON));
    });

    it('noten förklarar varför könsjämförelsen utgår', () => {
        const text = w2.document.getElementById('matrix-table').textContent;
        expect(text).toMatch(/samlade median i stället för könsuppdelade/);
    });
});

// ADR-14: Utforska visar små grupper men exporten utelämnar dem tills
// användaren aktivt kryssar i "Ta med grupper under 10 i exporten".
describe('k-anonymitet: Utforskas export', () => {
    let w3;
    const harSentinel = rows => rows.flat().some(c => SENTINEL.some(s => normalisera(String(c)).includes(String(s))));
    const kryss = pa => {
        w3.document.getElementById('explore-inkludera-sma').checked = pa;
        w3.__renderExplorer();
    };
    const exportRader = () => w3.__chartExportRows(w3.document.getElementById('chart-explore'));

    beforeAll(async () => {
        w3 = createAppWindow();
        w3.__state.data = byggDataset();
        w3.eval('populateSelects(); unlockTabs();');
        w3.__renderTabContent('utforska');
        await new Promise(r => setTimeout(r, 0));
    });

    it('vyn visar de tolv små grupperna som andra grupper; i exportläget tonade', () => {
        kryss(false);
        expect(w3.document.querySelectorAll('#explore-table tr.explore-liten')).toHaveLength(0);
        expect(w3.document.querySelectorAll('#explore-table tbody tr').length).toBeGreaterThan(12);
        w3.__state.kLage = 'export'; w3.__renderExplorer();
        expect(w3.document.querySelectorAll('#explore-table tr.explore-liten')).toHaveLength(12);
        w3.__state.kLage = 'skarm'; w3.__renderExplorer();
    });
    it('tabellens export utelämnar dem när rutan är av', () => {
        kryss(false);
        expect(harSentinel(w3.__tableToMatrix('explore-table'))).toBe(false);
    });
    it('diagrammets export utelämnar dem när rutan är av', () => {
        kryss(false);
        expect(harSentinel(exportRader())).toBe(false);
    });
    it('båda tar med dem när rutan är ikryssad', () => {
        kryss(true);
        expect(harSentinel(w3.__tableToMatrix('explore-table'))).toBe(true);
        expect(harSentinel(exportRader())).toBe(true);
    });

    it('ett lönevillkor som skapar en liten grupp: exporten utelämnar den med rutan av', () => {
        w3.__explorerSetUrval({ lage: 'alla', villkor: [{ falt: 'lon', op: 'mellan', varde: [SENTINEL[0], SENTINEL[0]], inte: false }] });
        kryss(false);
        expect(harSentinel(w3.__tableToMatrix('explore-table').filter(r => !String(r[0]).startsWith('Urval:')))).toBe(false);
        // Rad 2 ("Urval: … mellan 31 417 och 31 417 kr") är användarens egen villkorsgräns,
        // inte gruppens data — vakten gäller dataraderna.
        expect(harSentinel(exportRader().filter(r => !String(r[0]).startsWith('Urval:')))).toBe(false);
        kryss(true);
        expect(harSentinel(w3.__tableToMatrix('explore-table'))).toBe(true);
        w3.__explorerSetUrval({ lage: 'alla', villkor: [] });
    });

    it('gruppvillkor i korstabell: små grupper syns inte i exporten, inte ens som etikett', () => {
        const d = w3.document;
        const sma = new Set(SMA_BAS);
        // Släpper igenom de små grupperna G–L (sentinel > SENTINEL[5]) och döljer A–F.
        w3.__explorerSetUrval({ lage: 'alla', villkor: [] }, [{ matt: 'median', op: 'storre', varde: SENTINEL[5] }]);
        d.getElementById('explore-kolumn').value = 'kon';
        try {
            kryss(false);
            expect(w3.__tableToMatrix('explore-table').map(r => r[0]).filter(x => sma.has(x))).toEqual([]);
            expect(exportRader().flat().filter(x => sma.has(x))).toEqual([]);
            kryss(true);
            expect(w3.__tableToMatrix('explore-table').map(r => r[0]).filter(x => sma.has(x))).toHaveLength(6);
        } finally {
            d.getElementById('explore-kolumn').value = 'ingen';
            w3.__explorerSetUrval({ lage: 'alla', villkor: [] }, []);
            kryss(false);
        }
    });

    it('per kön med två dimensioner: exporten röjer inga små grupper', () => {
        const d = w3.document;
        d.getElementById('explore-kolumn').value = 'alder';
        d.getElementById('explore-visa').value = 'kon';
        try {
            kryss(false);
            expect(harSentinel(w3.__tableToMatrix('explore-table'))).toBe(false);
            expect(harSentinel(exportRader())).toBe(false);
            kryss(true);
            expect(harSentinel(w3.__tableToMatrix('explore-table'))).toBe(true);
        } finally {
            d.getElementById('explore-kolumn').value = 'ingen';
            d.getElementById('explore-visa').value = 'helhet';
            kryss(false);
        }
    });
});

// Den nya risken med "Per kön": ett kön under tröskeln inuti en grupp som
// själv ligger över den. Tre kvinnor med ett unikt markörvärde i en cell på 15.
describe('k-anonymitet: kön under tröskeln inuti en större grupp (Per kön)', () => {
    const MARKOR = 43291;
    let w4;
    const harMarkor = rows => rows.flat().some(c => normalisera(String(c)).includes(String(MARKOR)));
    beforeAll(async () => {
        w4 = createAppWindow();
        const rad = (bas, kon, lon) => ({ bas, kon, lon, alder: 40, yrke: '100 X', aid: '100', yrkeLabel: 'X', enhet: '1000' });
        const rader = [];
        for (let i = 0; i < 12; i++) rader.push(rad('A', 'man', 30000 + i * 7));
        for (let i = 0; i < 3; i++) rader.push(rad('A', 'kvinna', MARKOR));
        for (let i = 0; i < 20; i++) rader.push(rad('B', i % 2 ? 'man' : 'kvinna', 26000 + i * 11));
        w4.__state.data = rader;
        w4.eval('populateSelects(); unlockTabs();');
        w4.__renderTabContent('utforska');
        await new Promise(r => setTimeout(r, 0));
    });
    const fall = [['staplar', 'ingen'], ['liggande', 'ingen'], ['heatmap', 'alder'], ['grupperade', 'alder']];
    for (const [typ, kolumn] of fall) {
        it(`${typ}: exporten röjer inte kvinnornas lön med rutan av, men gör det med rutan på`, () => {
            const d = w4.document;
            d.getElementById('explore-rad').value = 'bas';
            d.getElementById('explore-kolumn').value = kolumn;
            d.getElementById('explore-typ').value = typ;
            d.getElementById('explore-visa').value = 'kon';
            const kryss = pa => { d.getElementById('explore-inkludera-sma').checked = pa; w4.__renderExplorer(); };
            const exporter = () => [w4.__tableToMatrix('explore-table'), w4.__chartExportRows(d.getElementById('chart-explore'))];
            kryss(false);
            for (const e of exporter()) expect(harMarkor(e)).toBe(false);
            kryss(true);
            expect(exporter().some(harMarkor)).toBe(true);
        });
    }
});

describe('k-anonymitet: kompliansöversikten', () => {
    it('gap-räkningen bygger bara på BAS där båda könen har minst k', () => {
        win.__updateCompliance();
        const t = win.document.getElementById('comp-gap-val').textContent;
        const m = t.match(/(\d+) av (\d+)/);
        const j = win.__dqJamforbaraBas(win.__getData(), win.__K);
        expect(j.maskerade.length, 'datasetet ska ha maskerade BAS').toBeGreaterThan(0);
        expect(m, t).not.toBeNull();
        expect(Number(m[2])).toBe(j.jamforbara.length);
    });
});

describe('k-anonymitet: utskriften ur rapportmodellen mot referensen', () => {
    it('BAS under k redovisas inte med median, även när referensens P10 ligger över', async () => {
        const w = createAppWindow();
        w.__state.data = byggDataset();
        // P10 över alla sentinelvärden → varje BAS hamnar "under referensens P10".
        w.__state.policy = [...SAKRA_BAS, TOPP_BAS, ...SMA_BAS].map(b => ({ aid: null, bas: b, p10: 90000, med: 95000, p90: 99000 }));
        w.eval('populateSelects(); unlockTabs();');
        w.print = () => {};
        await w.eval('buildPrintReport()');
        const el = w.document.getElementById('print-report');
        const text = normalisera(el.innerHTML.replace(/src="data:[^"]*"/g, ''));
        expect(el.querySelectorAll('section.rm-avsnitt').length).toBeGreaterThanOrEqual(8);
        const lackor = SENTINEL.filter(s => text.includes(String(s)));
        expect(lackor).toEqual([]);
        expect(el.textContent).toMatch(/visas inte här|färre än \d+ personer/);
    }, 30000);
});

describe('k-anonymitet: rapportunderlaget', () => {
    it('inget sentinelvärde i något block, varken som HTML eller text', () => {
        const block = win.__rapportunderlagBlock();
        const innehall = normalisera(block.map(b => win.__ruTillWordHtml(b) + '\n' + win.__ruTillText(b)).join('\n'));
        const lackor = SENTINEL.filter(s => innehall.includes(String(s)));
        expect(lackor).toEqual([]);
    });
});

describe('k-anonymitet: var uppstår löneskillnaden', () => {
    it('inget sentinelvärde i kortet', () => {
        win.eval('renderGapUppdelning()');
        const t = normalisera(win.document.getElementById('gap-uppdelning').innerHTML);
        expect(SENTINEL.filter(s => t.includes(String(s)))).toEqual([]);
    });
    it('små BAS namnges inte i topplistan', () => {
        const u = win.__guGapUppdelning(win.__getData(), { k: win.__K });
        const namn = ['A', 'B', 'C'].flatMap(d => u.topp[d].map(p => p.namn));
        for (const b of SMA_BAS) expect(namn.filter(n => n.endsWith(`BAS ${b}`))).toEqual([]);
    });
});

describe('k-anonymitet: rapportunderlagets parblock med små kvinnodominerade grupper', () => {
    // Datasetet ovan har jämnt könsfördelade små grupper och ger därför inga kandidatpar.
    // Här bildar små kvinnodominerade yrken (sentinellön) par både inom BAS och mot ett
    // yrke i lägre BAS — paren finns i fliken (undantagen från k) men inte i underlaget.
    let w2;
    beforeAll(() => {
        w2 = createAppWindow();
        const rader = [];
        const lägg = (n, kon, lon, bas, aid) => { for (let i = 0; i < n; i++) rader.push({ bas, kon, lon: lon + (i % 3) * 10,
            alder: 30 + (i * 7) % 30, yrke: `${aid} Yrke ${aid}`, aid, yrkeLabel: `Yrke ${aid}`, enhet: '' }); };
        lägg(30, 'kvinna', 25000, 'A', '6000'); lägg(30, 'man', 25500, 'A', '6000');
        lägg(20, 'man', 50000, 'C', '6100');   lägg(4, 'kvinna', 50000, 'C', '6100');   // jämförelseyrke, lika krav
        lägg(6, 'kvinna', SENTINEL[0], 'C', '5300');                                   // litet, kvinnodominerat
        lägg(6, 'kvinna', SENTINEL[1], 'E', '5301');                                   // litet, högre krav än 6100
        w2.__state.data = rader;
        w2.eval('populateSelects(); unlockTabs();');
    });
    it('paren med små grupper finns i beräkningen (annars prövar testet inget)', () => {
        const lv = w2.eval('likvardighetResultat()');
        expect(lv.pairs.some(p => p.kvN < 10)).toBe(true);
        expect((lv.lagreKrav || []).some(p => p.kvN < 10)).toBe(true);
    });
    it('inget sentinelvärde i något block, varken som HTML eller text', () => {
        const block = w2.__rapportunderlagBlock();
        const innehall = normalisera(block.map(b => w2.__ruTillWordHtml(b) + '\n' + w2.__ruTillText(b)).join('\n'));
        expect(SENTINEL.filter(s => innehall.includes(String(s)))).toEqual([]);
    });
});

describe('k-anonymitet: Excel-exporterna (JPA, alla flikar, EU-lönerapport, handlingsplan)', () => {
    // Exporterna fångas i stället för att skrivas (som i exports.golden). Likvärdighetsexporten
    // (§ 3:10) är undantagen från k-masken och prövas därför inte här.
    it('inget sentinelvärde i någon cell', async () => {
        const { readFileSync } = await import('node:fs');
        const { join, dirname } = await import('node:path');
        const { fileURLToPath } = await import('node:url');
        const root = join(dirname(fileURLToPath(import.meta.url)), '..');
        const w = createAppWindow();
        w.eval(readFileSync(join(root, 'vendor', 'xlsx.mini.min.js'), 'utf8'));
        w.__state.data = byggDataset();
        w.__state.policy = byggPolicy();
        w.eval('populateSelects(); unlockTabs();');
        w.alert = () => {};
        const fångat = {};
        w.XLSX.writeFile = (wb, namn) => { fångat[namn] = wb; };
        for (const fn of ['exportJPAProtocol', 'exportAllToExcel', 'exportEuReport', 'exportHandlingsplan']) {
            try { w.eval(`${fn}()`); } catch (e) { throw new Error(`${fn}: ${e.message}`); }
        }
        expect(Object.keys(fångat).length).toBeGreaterThanOrEqual(3);
        const lackor = [];
        for (const [namn, wb] of Object.entries(fångat)) {
            for (const blad of wb.SheetNames) {
                const rader = w.XLSX.utils.sheet_to_json(wb.Sheets[blad], { header: 1, raw: true });
                for (const rad of rader) for (const c of rad) {
                    const t = normalisera(String(c ?? ''));
                    for (const s of SENTINEL) if (t.includes(String(s))) lackor.push(`${namn} / ${blad}: ${t.slice(0, 80)}`);
                }
            }
        }
        expect(lackor).toEqual([]);
    });
});

// Tillgänglighet (WCAG 1.4.1): färg får inte vara det enda som skiljer ut små
// grupper. Nedtonade staplar får mönster och nedtonade punkter streckad kantlinje.
describe('k-anonymitet: små grupper i Utforska markeras även utan färg', () => {
    let w;
    beforeAll(async () => {
        w = createAppWindow();
        const rad = (bas, kon, lon, alder = 40) => ({ bas, kon, lon, alder, yrke: '100 X', aid: '100', yrkeLabel: 'X' });
        const rader = [];
        for (let i = 0; i < 12; i++) rader.push(rad('A', 'man', 30000 + i * 7));
        for (let i = 0; i < 3; i++) rader.push(rad('A', 'kvinna', 29000 + i));
        for (let i = 0; i < 24; i++) rader.push(rad('B', i % 2 ? 'man' : 'kvinna', 26000 + i * 11, 30 + (i % 3) * 12));
        w.__state.data = rader;
        w.eval('populateSelects(); unlockTabs();');
        w.__state.kLage = 'export';   // nedtoningen hör till exportläget (ADR-51)
        w.__renderTabContent('utforska');
        await new Promise(r => setTimeout(r, 0));
    });
    const fall = [['staplar', 'ingen', 'kon'], ['liggande', 'ingen', 'kon'], ['grupperade', 'alder', 'kon'], ['hantel', 'ingen', 'helhet'],
        ['bubbla', 'ingen', 'helhet', 'alder']];
    for (const [typ, kolumn, visa, radVar = 'bas'] of fall) {
        it(`${typ}: varje nedtonad stapel eller punkt har mönster eller streckad kant`, () => {
            const d = w.document;
            d.getElementById('explore-rad').value = radVar;
            d.getElementById('explore-kolumn').value = kolumn;
            d.getElementById('explore-typ').value = typ;
            d.getElementById('explore-visa').value = visa;
            w.__renderExplorer();
            // Diagramkärnan (ADR-39) ritar små grupper markerade: varje märke som hör till en liten datapunkt har
            // streckad kant (och ytor därtill ränder) — aldrig bara en annan färg (WCAG 1.4.1).
            const el = d.getElementById('chart-explore'), lager = el._figur.lager;
            let tonade = 0;
            const saknar = [];
            for (const m of el.querySelectorAll('[data-l][data-i]')) {
                const l = lager[Number(m.getAttribute('data-l'))], p = l && l.data[Number(m.getAttribute('data-i'))];
                if (!p || !p.liten) continue;
                tonade++;
                if (!m.getAttribute('stroke-dasharray')) saknar.push(`${l.serie}[${m.getAttribute('data-i')}] <${m.tagName}>`);
            }
            // Och omvänt: inget märke för en datapunkt över tröskeln ser litet ut.
            const fel = [...el.querySelectorAll('[data-l][data-i][stroke-dasharray]')].filter(m => {
                const l = lager[Number(m.getAttribute('data-l'))], p = l && l.data[Number(m.getAttribute('data-i'))];
                return l && l.marke !== 'linje' && l.marke !== 'intervall' && p && !p.liten;
            });
            expect(fel.map(m => m.outerHTML.slice(0, 80))).toEqual([]);
            expect(tonade, `${typ}: testdata ska ge minst en nedtonad grupp`).toBeGreaterThan(0);
            expect(saknar).toEqual([]);
        });
    }
});

// Sektorsöversikten: en sektor där ett kön har färre än k får inga
// könsuppdelade lönemått — varken i vyn, Excel-bladet eller rapportunderlaget.
describe('k-anonymitet: sektorsöversikten', () => {
    const MARKOR = 43291;
    let w;
    beforeAll(async () => {
        w = createAppWindow();
        const rad = (aid, kon, lon, alder = 40) => ({ aid, yrke: aid + ' X', yrkeLabel: 'X', bas: 'C', kon, lon, alder });
        const rader = [];
        for (let i = 0; i < 3; i++) rader.push(rad('502010', 'kvinna', MARKOR));
        for (let i = 0; i < 15; i++) rader.push(rad('503012', 'man', 42000 + i * 13, 30 + i));
        for (let i = 0; i < 30; i++) rader.push(rad('207011', i % 2 ? 'man' : 'kvinna', 30000 + i * 17, 25 + i));
        w.__state.data = rader;
        w.eval('populateSelects(); unlockTabs();');
        w.__state.kLage = 'export';   // tabellen så som Excel-bladet läser den (ADR-51)
        w.__renderTabContent('struktur');
        w.__renderTabContent('dokumentera');
        await new Promise(r => setTimeout(r, 0));
    });
    const harMarkor = s => normalisera(String(s)).includes(String(MARKOR));
    it('vyn (i exportläget) visar samlad median för teknik och ingen markörlön', () => {
        const t = w.document.getElementById('sektor-table');
        const teknik = [...t.querySelectorAll('tbody tr')].find(tr => /Teknikarbete/.test(tr.textContent));
        expect(teknik.textContent).toMatch(/Samlad median/);
        expect(harMarkor(t.textContent)).toBe(false);
    });
    it('Excel-bladet och rapportunderlaget röjer inte markörlönen', () => {
        expect(w.__tableToMatrix('sektor-table').flat().some(harMarkor)).toBe(false);
        expect(harMarkor(w.document.getElementById('rapportunderlag-innehall').textContent)).toBe(false);
        expect(w.document.getElementById('rapportunderlag-innehall').textContent).toMatch(/Per sektor/);
    });
});

describe('k-anonymitet: ansvarsunderrader i Lika arbete', () => {
    const MARKOR = 51873;
    let w;
    beforeAll(() => {
        w = createAppWindow();
        const rad = (kon, lon, alder, grupp) => ({ aid: '402010', yrke: '402010 Förskollärare', yrkeLabel: 'Förskollärare', bas: 'C', kon, lon, alder,
            ansvarskoder: grupp === 'uppdrag' ? ['L'] : [], ansvarsgrupp: grupp });
        const rader = [];
        for (let i = 0; i < 3; i++) rader.push(rad('kvinna', MARKOR, 40 + i, 'uppdrag'));
        for (let i = 0; i < 14; i++) rader.push(rad('kvinna', 30000 + i * 41, 30 + i, 'inget'));
        for (let i = 0; i < 14; i++) rader.push(rad('man', 30300 + i * 43, 31 + i, 'inget'));
        w.__state.data = rader;
        w.eval('populateSelects(); unlockTabs();');
        w.__state.kLage = 'export';   // tabellen så som Excel-matrisen läser den (ADR-51)
        w.__renderTabContent('matrix');
    });
    const harMarkor = s => normalisera(String(s)).includes(String(MARKOR));
    it('underraden med tre personer visar ingen lön, varken i tabellen (exportläget) eller Excel-matrisen', () => {
        const t = w.document.getElementById('matrix-table');
        const under = [...t.querySelectorAll('tr.la-underrad')];
        expect(under.some(tr => /Särskilt uppdrag/.test(tr.textContent))).toBe(true);
        expect(under.find(tr => /Särskilt uppdrag/.test(tr.textContent)).textContent).toMatch(/Färre än 10/);
        expect(harMarkor(t.textContent)).toBe(false);
        expect(w.__tableToMatrix('matrix-table').flat().some(harMarkor)).toBe(false);
    });
});

describe('k-anonymitet: sektorernas andel när ett kön är under k i hela underlaget', () => {
    it('ingen rad om sektorernas andel (gapet i kronor + procent ger annars mannens lön)', () => {
        const w = createAppWindow();
        const rader = Array.from({ length: 40 }, (_, i) => ({ aid: '207011', yrke: '207011 X', yrkeLabel: 'X', bas: 'C', kon: 'kvinna', lon: 30000 + i * 11, alder: 25 + i }));
        rader.push({ aid: '502010', yrke: '502010 Y', yrkeLabel: 'Y', bas: 'C', kon: 'man', lon: 47123, alder: 44 });
        w.__state.data = rader;
        w.eval('populateSelects(); unlockTabs();');
        w.__state.kLage = 'export';
        w.__renderTabContent('struktur');
        w.__renderTabContent('dokumentera');
        expect(w.document.querySelector('#struktur-sektorer .sektor-andel')).toBeNull();
        expect(w.document.getElementById('rapportunderlag-innehall').textContent).not.toMatch(/skillnaden i medellön för hela organisationen/i);
    });
});

describe('k-anonymitet: den samlade jämförelseexporten', () => {
    it('en grupp under 10 med unik markörlön syns inte; den namnges i metadata', async () => {
        const { readFileSync } = await import('node:fs');
        const { join, dirname } = await import('node:path');
        const { fileURLToPath } = await import('node:url');
        const root = join(dirname(fileURLToPath(import.meta.url)), '..');
        const MARKOR = 61237;
        const w = createAppWindow();
        w.eval(readFileSync(join(root, 'vendor', 'xlsx.mini.min.js'), 'utf8'));
        const rad = (yrke, kon, lon) => ({ aid: yrke.slice(0, 6), yrke, yrkeLabel: 'X', bas: 'C', kon, lon, alder: 40 });
        w.__state.data = [...Array.from({ length: 12 }, (_, i) => rad('207011 Usk', i % 2 ? 'man' : 'kvinna', 30000 + i * 100)),
                          ...Array.from({ length: 3 }, () => rad('502010 Sysutv', 'kvinna', MARKOR))];
        w.__state.statistik = [{ aid: '207011', bas: 'C', median: 31000, p10: 29000, p90: 33000 }, { aid: '502010', bas: 'C', median: 45000 }];
        w.eval('populateSelects(); unlockTabs();');
        const fangat = {};
        w.XLSX.writeFile = (wb, namn) => { fangat[namn] = wb; };
        w.eval('exportBenchmarkExcel()');
        const wb = Object.values(fangat)[0];
        const celler = wb.SheetNames.flatMap(b => w.XLSX.utils.sheet_to_json(wb.Sheets[b], { header: 1, raw: true }).flat());
        expect(celler.some(c => String(c).includes(String(MARKOR)))).toBe(false);
        expect(celler.some(c => String(c).includes('502010 (BAS C)'))).toBe(true);
    });
    it('tabellen i fliken (i exportläget) visar inte den lilla gruppen', () => {
        const MARKOR = 61237;
        const w = createAppWindow();
        const rad = (yrke, kon, lon) => ({ aid: yrke.slice(0, 6), yrke, yrkeLabel: 'X', bas: 'C', kon, lon, alder: 40 });
        w.__state.data = [...Array.from({ length: 12 }, (_, i) => rad('207011 Usk', i % 2 ? 'man' : 'kvinna', 30000 + i * 100)),
                          ...Array.from({ length: 3 }, () => rad('502010 Sysutv', 'kvinna', MARKOR))];
        w.__state.statistik = [{ aid: '207011', bas: 'C', median: 31000 }, { aid: '502010', bas: 'C', median: 45000 }];
        w.eval('populateSelects(); unlockTabs();');
        w.__state.kLage = 'export';
        w.__renderTabContent('benchmark');
        const t = w.document.getElementById('benchmark-table').textContent.replace(/\s/g, '');
        expect(t).not.toMatch(/61237|61 ?237/);
        expect(w.document.querySelector('#benchmark-table tr[data-rad^="502010"]')).toBeNull();
    });
    it('diagrammens data innehåller inte den lilla gruppen', () => {
        const MARKOR = 61237;
        const w = createAppWindow();
        w.__state.kLage = 'export';
        const rad = (yrke, kon, lon) => ({ aid: yrke.slice(0, 6), yrke, yrkeLabel: 'X', bas: 'C', kon, lon, alder: 40 });
        w.__state.data = [...Array.from({ length: 12 }, (_, i) => rad('207011 Usk', i % 2 ? 'man' : 'kvinna', 30000 + i * 100)),
                          ...Array.from({ length: 3 }, () => rad('502010 Sysutv', 'kvinna', MARKOR))];
        w.__state.statistik = [{ aid: '207011', bas: 'C', median: 31000 }, { aid: '502010', bas: 'C', median: 45000 }];
        w.eval('populateSelects(); unlockTabs();');
        w.__renderTabContent('benchmark');
        for (const id of ['chart-jamforelse-spann', 'chart-jamforelse-avvikelse']) {
            // Ritade av diagramkärnan (ADR-39): figuren på elementet, skärmens SVG, exportbilden och diagramdatan.
            const el = w.document.getElementById(id);
            expect(el._figur, id).toBeDefined();
            expect(normalisera(JSON.stringify(el._figur) + karnansUtdata(w, el).join(' ')), id).not.toMatch(/61237|502010/);
        }
    });
});

describe('k-anonymitet: organisationspaketet kan stänga av små grupper i Utforskas export (ADR-47)', () => {
    let w;
    const harSentinel = rows => rows.flat().some(c => SENTINEL.some(s => normalisera(String(c)).includes(String(s))));
    const rad = () => w.document.getElementById('explore-inkludera-sma-rad');
    const not = () => w.document.getElementById('explore-sma-last');

    beforeAll(async () => {
        w = createAppWindow();
        const paket = { format: 'lonekartlaggning-organisationspaket', version: 1, organisation: { namn: 'Exempelorganisationen' },
            skapat: '2026-10-08', installningar: { smaGrupperIExport: false },
            referens: { rader: [{ bas: 'S1', p10: 20000, med: 25000, p90: 30000 }] } };
        expect(w.eval(`lasInPaket(${JSON.stringify(JSON.stringify(paket))}, 'x.lonepaket.json')`).ok).toBe(true);
        w.__state.data = byggDataset();
        w.eval('populateSelects(); unlockTabs();');
        w.__renderTabContent('utforska');
        await new Promise(r => setTimeout(r, 0));
    });

    it('rutan är dold och raden säger att paketet inte tillåter det', () => {
        expect(rad().hidden).toBe(true);
        expect(not().hidden).toBe(false);
        expect(not().textContent).toMatch(/Organisationspaketet tillåter inte/);
        expect(w.document.getElementById('paket-info').textContent).toMatch(/små grupper tas aldrig med i Utforskas export/);
    });
    it('vyn visar de små grupperna (tonade i exportläget), men exporten utelämnar dem även om rutan kryssas i programmatiskt', () => {
        w.document.getElementById('explore-inkludera-sma').checked = true;
        w.__state.kLage = 'export'; w.__renderExplorer(); w.__state.kLage = 'skarm';
        expect(w.document.querySelectorAll('#explore-table tr.explore-liten')).toHaveLength(12);
        expect(w.document.getElementById('explore-inkludera-sma').checked).toBe(false);
        expect(harSentinel(w.__tableToMatrix('explore-table'))).toBe(false);
        expect(harSentinel(w.__chartExportRows(w.document.getElementById('chart-explore')))).toBe(false);
    });
    it('Rensa all data tar bort låsningen: rutan visas igen och raden döljs', () => {
        w.eval('_rensaAllData()');
        expect(rad().hidden).toBe(false);
        expect(not().hidden).toBe(true);
    });
});

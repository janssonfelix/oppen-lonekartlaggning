/**
 * Lib-speglar (ADR-8): app.js måste bära den statistiska kärnan (stat/
 * forecast/structure) eftersom webbläsarbygget skeppar app.js, inte src/lib/.
 * src/app/09-lib-speglar.js GENERERAS verbatim ur src/lib/ av
 * tools/gen-mirrors.mjs (endast `export` strippas), så kropparna kan inte
 * glida isär. Detta test vaktar de två återstående riskerna:
 *
 *   1. STALENESS — att den incheckade 09-lib-speglar.js är i synk med src/lib/
 *      (någon ändrade lib men körde inte `npm run build:app`).
 *   2. ALIAS-WIRING — att varje app-globalt spegelnamn (_fitOLS, _fcComputePott …)
 *      faktiskt pekar på RÄTT lib-funktion (en felmappning i manifestet fångas).
 *
 * Själva lib-logiken testas direkt i stat/loneoversyn/struktur.test.js m.fl., och
 * exports.golden.test.js vaktar att exporterna är oförändrade (facit byte för byte).
 *
 * § 3:10 (computeLikvardighetPairs) speglas också; app.js har en tunn state-adapter
 * runt spegeln. Att adaptern verkligen DELEGERAR — och inte smyger tillbaka en egen implementation — vaktas
 * längst ned.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import * as libStat from '../src/lib/stat.js';
import * as libFc from '../src/lib/loneoversyn.js';
import * as libSt from '../src/lib/struktur.js';
import * as libLp from '../src/lib/lonepolitik.js';
import * as libRng from '../src/lib/rng.js';
import * as libLv from '../src/lib/likvardighet.js';
import * as libFalt from '../src/lib/falt.js';
import * as libUrval from '../src/lib/urval.js';
import * as libRef from '../src/lib/referens.js';
import * as libDq from '../src/lib/datakvalitet.js';
import * as libRu from '../src/lib/rapportunderlag.js';
import * as libGu from '../src/lib/gapuppdelning.js';
import * as libIf from '../src/lib/individflaggor.js';
import * as libUt from '../src/lib/utforska.js';
import * as libOp from '../src/lib/organisationspaket.js';
import * as libAg from '../src/lib/attgora.js';
import * as libAidEt from '../src/lib/aid-etiketter.js';
import * as libAid from '../src/lib/aid.js';
import * as libSk from '../src/lib/sektor.js';
import * as libAn from '../src/lib/ansvar.js';
import * as libAk from '../src/lib/aidkontroll.js';
import * as libSkrP from '../src/lib/skr-personal.js';
import * as libSkrR from '../src/lib/skrreferens.js';
import * as libJf from '../src/lib/jamforelse.js';
import * as libNamn from '../src/lib/namn.js';
import * as libDocx from '../src/lib/docx.js';
import * as libFigur from '../src/lib/figur.js';
import * as libReg from '../src/lib/regression.js';
import * as libPr from '../src/lib/prioritering.js';
import * as libLc from '../src/lib/livscykel.js';
import * as libOf from '../src/lib/organisationsfil.js';
import * as libPb from '../src/lib/perbas.js';
import * as libTr from '../src/lib/tabellrecept.js';
import * as libAb from '../src/lib/arsbokslut.js';
import { MODULES, generateMirrorsSource } from '../tools/gen-mirrors.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const appSrc = readFileSync(join(root, 'dist', 'app.js'), 'utf8');
const mirrorsPath = join(root, 'src', 'app', '09-lib-speglar.js');
const mirrorsSrc = readFileSync(mirrorsPath, 'utf8');

// Extrahera `function NAME(...) { ... }` via balanserad klammerräkning.
function extractFn(src, name) {
    const start = src.indexOf('function ' + name + '(');
    if (start < 0) throw new Error('hittade ej function ' + name);
    let depth = 0, seen = false;
    for (let j = src.indexOf('{', start); j < src.length; j++) {
        const c = src[j];
        if (c === '{') { depth++; seen = true; }
        else if (c === '}') { depth--; if (seen && depth === 0) return src.slice(start, j + 1); }
    }
    throw new Error('obalanserade klamrar i ' + name);
}

// Deterministisk PRNG så testet är stabilt
function lcg(seed) { return () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; }; }

// Evaluera den genererade spegelfilen och plocka ut alla app-globala alias.
// Värdet null i expose: namnet returneras ur modulen (för importer mellan lib-moduler) men får inget alias;
// det nås här genom modulens namnrymd.
const allAliases = MODULES.flatMap(m => Object.values(m.expose)).filter(Boolean);
const allEntries = MODULES.flatMap(m => Object.keys(m.expose));
const M = new Function(`${mirrorsSrc}\n;return { ${[...allAliases, ...MODULES.map(m => m.ns)].join(', ')} };`)();
const libByFile = { 'stat.js': libStat, 'loneoversyn.js': libFc, 'struktur.js': libSt,
    'lonepolitik.js': libLp, 'rng.js': libRng, 'likvardighet.js': libLv, 'falt.js': libFalt, 'urval.js': libUrval, 'referens.js': libRef, 'datakvalitet.js': libDq, 'rapportunderlag.js': libRu, 'gapuppdelning.js': libGu, 'individflaggor.js': libIf, 'utforska.js': libUt, 'organisationspaket.js': libOp, 'attgora.js': libAg, 'aid-etiketter.js': libAidEt, 'aid.js': libAid, 'sektor.js': libSk, 'ansvar.js': libAn, 'aidkontroll.js': libAk, 'skr-personal.js': libSkrP, 'skrreferens.js': libSkrR, 'jamforelse.js': libJf, 'namn.js': libNamn, 'docx.js': libDocx, 'figur.js': libFigur, 'regression.js': libReg,
    'prioritering.js': libPr, 'livscykel.js': libLc, 'organisationsfil.js': libOf, 'perbas.js': libPb, 'tabellrecept.js': libTr, 'arsbokslut.js': libAb };

describe('lib-speglar: 09-lib-speglar.js genereras ur src/lib/', () => {
    it('STALENESS: incheckad 09-lib-speglar.js är i synk med src/lib/ (kör gen-mirrors)', () => {
        // Normalisera radslut så CRLF/LF-skillnader (git autocrlf) inte ger falskt larm.
        const norm = s => s.replace(/\r\n/g, '\n');
        expect(
            norm(mirrorsSrc),
            'src/app/09-lib-speglar.js är inte i synk med src/lib/. Kör `npm run build:app`.'
        ).toBe(norm(generateMirrorsSource()));
    });

    it('ALIAS-WIRING: varje spegelnamn pekar på exakt rätt lib-funktion', () => {
        // Normalisera radslut: `new Function`-källan (05) och ES-import-källan (lib)
        // kan ha olika radslut beroende på git autocrlf — jämför text, inte radslut.
        // Vitest skriver om importerade namn i lib-källan (`groupKey(` blir
        // `__vite_ssr_import_1__.groupKey(`); spegeln har dem som vanliga namn.
        const nlnorm = s => s.replace(/\r\n/g, '\n').replace(/__vite_ssr_import_\d+__\./g, '');
        let checked = 0;
        for (const mod of MODULES) {
            const lib = libByFile[mod.file];
            const libText = nlnorm(readFileSync(join(root, 'src', 'lib', mod.file), 'utf8'));
            for (const [internal, alias] of Object.entries(mod.expose)) {
                const appName = alias || `${mod.ns}.${internal}`;
                const fn = alias ? M[alias] : M[mod.ns][internal];
                expect(typeof fn, `${appName} ska vara en funktion`).toBe('function');
                // Spegelns källtext ska finnas ordagrant i lib-FILEN. Jämförelsen görs mot
                // filen, inte mot den importerade funktionens toString(): testmiljöns
                // kodomvandlare (Vitest 5) kan ändra texten marginellt (t.ex. ett `;` efter
                // en for-loop). Namnet kontrolleras separat, så att en felkoppling till en
                // annan funktion i samma fil fångas. Gäller även privata hjälpare (_median).
                const text = nlnorm(fn.toString());
                expect(libText, `${appName} → ${mod.file}`).toContain(text);
                expect(text, `${appName} → lib.${internal}`).toMatch(new RegExp(`^(async )?function\\*? ?${internal.replace(/\$/g, '\\$')}\\s*\\(`));
                if (lib[internal]) expect(lib[internal].name, `${appName} → lib.${internal}`).toBe(internal);
                checked++;
            }
        }
        expect(checked).toBe(allEntries.length);
    });

    it('beteende-stickprov: aliasen räknar som lib på slumpdata', () => {
        const rnd = lcg(99);
        for (let i = 0; i < 200; i++) {
            const x = rnd() * 12 - 6;
            expect(M._pValue2Sided(x, 202, 2)).toBe(libStat.pValue2Sided(x, 202, 2));   // df = 200 ≥ 100: går genom normalCdf
            expect(M._pValue2Sided(x, 22, 2)).toBe(libStat.pValue2Sided(x, 22, 2));     // df = 20: går genom tDistCdf
        }
        // forecast: summarizeGroups + computePott speglar lib på slumprader
        const rows = Array.from({ length: 60 }, () => ({
            bas: ['A', 'B', 'C'][rnd() * 3 | 0], aid: String(5000 + (rnd() * 4 | 0)),
            kon: rnd() > 0.5 ? 'kvinna' : 'man', lon: 25000 + Math.round(rnd() * 20000)
        }));
        expect(M._fcSummarizeGroups(rows)).toEqual(libFc.summarizeGroups(rows));
        expect(M._fcComputePott(rows, { mode: 'pct', value: 2.5 })).toBe(libFc.computePott(rows, { mode: 'pct', value: 2.5 }));
        // structure: alla fyra mått speglar lib
        expect(M._stMedianGapPct(rows)).toBe(libSt.medianGapPct(rows));
        expect(M._stRepresentationByBas(rows)).toEqual(libSt.representationByBas(rows));
        expect(M._stQuartileDistribution(rows)).toEqual(libSt.quartileDistribution(rows));
        expect(M._stDistributionalGap(rows)).toEqual(libSt.distributionalGap(rows));
        // stat: fitOLS speglar lib (känd linjär modell + brus)
        const X = rows.slice(0, 20).map((_, i) => [1, i, (i % 3)]);
        const y = X.map(r => 2 + 3 * r[1] - r[2]);
        expect(M._fitOLS(X, y)).toEqual(libStat.fitOLS(X, y));
    });
});

// ===================================================================
// § 3:10: app.js ska DELEGERA till spegeln, inte reimplementera den.
//
// App-funktionen är en adapter: läs state, anropa `_lvComputePairs`, fyll på med
// UI-diagnostik. Testet nedan kör adaptern med en SPION i stället för spegeln
// och kontrollerar att state översätts rätt — och att adaptern inte bär någon
// egen implementation.
// OBS: app.js innehåller TVÅ funktioner med det här namnet — lib-spegelns
// (`function computeLikvardighetPairs({ data = [], … })`) och app:ens adapter.
// extractFn() skulle fastna på spegelns destrukturerade parameterlista, så vi
// söker adapterns exakta, parameterlösa signatur.
const appLVSrc = (() => {
    const sig = 'function computeLikvardighetPairs() {';
    const i = appSrc.indexOf(sig);
    if (i < 0) throw new Error('hittade ej app-adaptern computeLikvardighetPairs()');
    return extractFn(appSrc.slice(i), 'computeLikvardighetPairs');
})();
// kTroskel() läses ur state, som i appen (adaptern skickar värdet vidare till lib).
const makeAppLV = new Function('state', 'nationellAidKlass', '_lvComputePairs', `
    const kTroskel = () => state.kTroskel ?? 10;
    const kInstalld = kTroskel;
    // Talformatshjälparna ur 03-hjalpfunktioner.js: adaptern skriver diagnostik med dem.
    const svTal = (v, dec = 0) => Number(v).toFixed(dec).replace('.', ',');
    const svPct = (v, dec = 1) => svTal(v, dec) + ' %';
    ${appLVSrc}
    return computeLikvardighetPairs;
`);

const tomtResultat = () => ({
    orgKvDom: [{ aid: '5301', bas: 'B', label: 'Undersköterska', n: 12, kvAndel: 80 }],
    orgIckeKv: [],
    statIckeKv: [{ aid: '2000', bas: 'B', label: 'Ingenjör', n: 14, kvAndel: 14.3 }],
    pairs: [],
    diagnostik: { organisation: {}, statistik: {}, jämförelse: {}, fel: [] },
    opts: {}
});

describe('§ 3:10: app.js delegerar till lib-spegeln', () => {
    it('adaptern innehåller ingen egen implementation', () => {
        expect(appLVSrc).toContain('_lvComputePairs(');
        // Namn som bara en egen implementation av algoritmen har. Dyker något av dem upp
        // har någon börjat implementera i app.js i stället för i src/lib/.
        for (const spår of ['orgMap', 'statByBas', 'bootstrapMedianDiffKr', '_bootstrapMedianDiffKr']) {
            expect(appLVSrc, `"${spår}" hör hemma i src/lib/likvardighet.js, inte i adaptern`).not.toContain(spår);
        }
    });

    it('översätter state till lib-anropet (BAS-läge)', () => {
        let sedd = null;
        const spion = arg => { sedd = arg; return tomtResultat(); };
        const state = {
            data: [{ aid: '5301', bas: 'B', lon: 30000, kon: 'kvinna' }],
            statistik: [{ aid: '2000', bas: 'B', median: 35000 }],
            statistikHasKon: true,
            arbetsvardering: null,
            likvardighet: { kvinnoTrosholdPct: 55, minGapPct: 3, topN: 20 }
        };
        state.kTroskel = 15;
        makeAppLV(state, () => null, spion)();
        expect(sedd.opts.k).toBe(15);   // tröskeln följer med (räknar små grupper i diagnostiken)
        expect(sedd.data).toBe(state.data);
        expect(sedd.statistik).toBe(state.statistik);
        expect(typeof sedd.scbKlass).toBe('function');
        // BAS-ordningen är fast (se §5 i teknisk-plan.md): ingen basRang skickas.
        expect(sedd.opts).toEqual({ kvinnoTrosholdPct: 55, minGapPct: 3, topN: 20, k: 15 });
    });

    it('skickar med arbetsvärderingen i poäng-läge (#5)', () => {
        let sedd = null;
        const byKey = new Map([['5301|B', 100]]);
        const state = {
            data: [], statistik: [], statistikHasKon: false,
            arbetsvardering: { byKey, count: 1, hasBas: true },
            likvardighet: { poangBandPct: 7 }
        };
        const res = makeAppLV(state, () => null, arg => { sedd = arg; return tomtResultat(); })();
        expect(sedd.opts.poangByKey).toBe(byKey);
        expect(sedd.opts.poangBandPct).toBe(7);
        expect(res.opts.poangBandPct).toBe(7);
    });

    it('fyller på med den UI-diagnostik som lib inte producerar', () => {
        const state = {
            data: [], statistik: [], statistikHasKon: true,
            arbetsvardering: null, likvardighet: {}
        };
        const res = makeAppLV(state, () => null, () => tomtResultat())();
        expect(res.diagnostik.organisation.exempelKvDom).toEqual(['5301 (Undersköterska) BAS B n=12']);
        expect(res.diagnostik.statistik.exempelIckeKv).toEqual(['2000 (Ingenjör) BAS B 14 %kv']);
        expect(res.diagnostik.statistik.harLokalKonsdata).toBe(true);
        expect(res.diagnostik.fel).toEqual([]);
    });

    it('returnerar ett strukturerat resultat även när spegeln kastar', () => {
        const state = {
            data: [{ aid: 'x', bas: 'A', lon: 1, kon: 'kvinna' }], statistik: [],
            statistikHasKon: false, arbetsvardering: null, likvardighet: {}
        };
        const res = makeAppLV(state, () => null, () => { throw new Error('trasig'); })();
        expect(res).not.toBeNull();
        expect(res.pairs).toEqual([]);
        expect(res.diagnostik.fel[0]).toMatch(/trasig/);
        expect(res.diagnostik.organisation.totalRader).toBe(1);
    });
});

describe('§ 3:10: spegeln ger reproducerbara konfidensintervall', () => {
    // Bootstrappen seedas ur parets egna löner. Utan det blir KI:t nytt vid
    // varje körning och ett exporterat underlag går inte att återskapa.
    const rader = (aid, bas, kv, ma) => [
        ...kv.map(lon => ({ aid, bas, lon, kon: 'kvinna', yrkeLabel: aid })),
        ...ma.map(lon => ({ aid, bas, lon, kon: 'man', yrkeLabel: aid }))
    ];
    const data = [
        ...rader('5301', 'B', [30000, 30100, 30200, 30300, 30400, 30500, 30600, 30700], [31000, 31100]),
        ...rader('4100', 'B', [34000], [34100, 34200, 34300, 34400, 34500, 34600, 34700, 34800, 34900])
    ];

    it('två körningar ger identiska gapCI', () => {
        const kör = () => M._lvComputePairs({ data, statistik: [], scbKlass: () => null,
            opts: { kvinnoTrosholdPct: 60, minGapPct: 0, topN: 100 } });
        const a = kör(), b = kör();
        expect(a.pairs.length).toBeGreaterThan(0);
        expect(a.pairs[0].gapCI).not.toBeNull();
        expect(a.pairs.map(p => p.gapCI)).toEqual(b.pairs.map(p => p.gapCI));
    });

    it('en injicerad rng används när testet ber om det', () => {
        const konst = () => 0.5;
        const res = M._lvComputePairs({ data, statistik: [], scbKlass: () => null,
            opts: { kvinnoTrosholdPct: 60, minGapPct: 0, topN: 100, rng: konst } });
        // Alla resamplingar blir identiska → noll bredd på intervallet.
        expect(res.pairs[0].gapCI.lo).toBe(res.pairs[0].gapCI.hi);
    });
});

// ===================================================================
// Regressionsmodellerna (src/lib/regression.js): app-filen är en tunn adapter.
// Modellerna ska inte finnas i 50-regressionsmodeller.js igen, och varje app-funktion
// ska delegera till spegeln med getData()/statGolv()/_lvBasRangFn.
describe('regression: 50-regressionsmodeller.js är en tunn adapter', () => {
    const regSrc = readFileSync(join(root, 'src', 'app', '50-regressionsmodeller.js'), 'utf8');
    const adaptrar = ['_diagnoseCollinearity', '_computePerBasGap', '_basIndikatorer', '_computeSequentialGap',
        '_quantileRegression', 'runBlinderOaxaca', 'runQuantileRegressionAtAllTau'];

    it('innehåller inga egna beräkningar (ingen log eller OLS-anrop)', () => {
        expect(regSrc, 'log-lön räknas i src/lib/regression.js').not.toContain('Math.log(');
        expect(regSrc, 'OLS anropas i src/lib/regression.js').not.toContain('_fitOLS(');
    });

    for (const namn of adaptrar) {
        it(`${namn} delegerar till spegeln`, () => {
            const kropp = extractFn(regSrc, namn);
            expect(kropp, `${namn} ska anropa en _rg-spegel`).toMatch(/_rg[A-Z]\w*\(/);
        });
    }

    it('de app-globala spegelnamnen finns i 09-lib-speglar.js och pekar på regression.js', () => {
        for (const namn of Object.values(MODULES.find(m => m.file === 'regression.js').expose)) {
            expect(typeof M[namn], namn).toBe('function');
        }
    });
});

// ===================================================================
// Prioriteringsanalysen (src/lib/prioritering.js) och livscykelmodellen (src/lib/livscykel.js):
// båda adaptrarna i appen är tunna och delegerar till spegeln. Modellerna ska inte finnas kvar
// i 55-prioritering.js respektive 52-livscykel.js.
describe('prioritering och livscykel: adaptrarna är tunna och delegerar till spegeln', () => {
    const prioSrc = readFileSync(join(root, 'src', 'app', '55-prioritering.js'), 'utf8');
    const lcSrc = readFileSync(join(root, 'src', 'app', '52-livscykel.js'), 'utf8');

    it('computePrioritization delegerar till _prPrioritera och bygger ingen egen beräkning', () => {
        const kropp = extractFn(prioSrc, 'computePrioritization');
        expect(kropp).toContain('_prPrioritera(');
        for (const spår of ['Stat.median', 'isKMasked', 'priorityIndex', 'sevScore', 'annualGapTotal', 'groups[']) {
            expect(kropp, `"${spår}" hör hemma i src/lib/prioritering.js`).not.toContain(spår);
        }
    });

    it('runLifecycleRegression delegerar till _lcLivscykelRegression och bygger ingen egen modell', () => {
        const kropp = extractFn(lcSrc, 'runLifecycleRegression');
        expect(kropp).toContain('_lcLivscykelRegression(');
        expect(lcSrc, 'OLS anropas i src/lib/livscykel.js').not.toContain('_fitOLS(');
        expect(kropp, 'log-lön räknas i src/lib/livscykel.js').not.toContain('Math.log(');
        expect(kropp, 'designmatrisen hör hemma i src/lib/livscykel.js').not.toContain('dummyBas');
    });

    it('spegelnamnen finns och pekar på rätt lib-funktioner', () => {
        const pr = MODULES.find(m => m.file === 'prioritering.js');
        const lc = MODULES.find(m => m.file === 'livscykel.js');
        expect(pr.expose).toEqual({ prioritera: '_prPrioritera', arsbeloppMening: '_prArsbeloppMening' });
        expect(lc.expose).toEqual({ livscykelRegression: '_lcLivscykelRegression' });
        expect(typeof M._prPrioritera).toBe('function');
        expect(typeof M._prArsbeloppMening).toBe('function');
        expect(typeof M._lcLivscykelRegression).toBe('function');
    });

    it('spegeln ger samma resultat som lib-modulen på samma indata', () => {
        const rader = [
            ...Array.from({ length: 12 }, (_, i) => ({ yrke: '5301 Undersköterska', bas: 'B', kon: 'kvinna', lon: 30000 + i })),
            ...Array.from({ length: 12 }, (_, i) => ({ yrke: '5301 Undersköterska', bas: 'B', kon: 'man', lon: 32000 + i }))
        ];
        const opt = { referensFor: () => ({ median: 35000, kalla: 'x' }), kTroskel: 10,
            prioConfig: { atgardThreshold: -5, akutMinN: 10, bevakaThreshold: -2, analyseraThreshold: 5 },
            prioWeights: { avvikelse: 50, volym: 30, jamstalldhet: 20 }, costSettings: { months: 12, poPct: 39.15 },
            bristAids: new Set() };
        expect(M._prPrioritera(rader, opt)).toEqual(libPr.prioritera(rader, opt));
        expect(M._lcLivscykelRegression(rader, { golv: 10 })).toEqual(libLc.livscykelRegression(rader, { golv: 10 }));
    });
});

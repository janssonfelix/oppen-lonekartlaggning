/**
 * Adaptrarna i appen: likvärdigt arbete, regressionen, prioriteringen och livscykeln räknas i src/lib/, som appen
 * importerar (ADR-98). Testerna här vaktar att adaptrarna i src/app/ DELEGERAR till lib och inte smyger tillbaka en
 * egen implementation.
 *
 * Själva lib-logiken testas direkt i stat/loneoversyn/struktur.test.js m.fl., och
 * exports.golden.test.js vaktar att exporterna är oförändrade (facit byte för byte).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import * as libLv from '../src/lib/likvardighet.js';
import { svPct } from '../src/lib/talformat.js';
import { kompletteraDiagnostik, likvardighetFelresultat } from '../src/lib/vymodell-likvardigt-arbete.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const appSrc = readFileSync(join(root, 'dist', 'app.js'), 'utf8');

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

// ===================================================================
// Likvärdigt arbete: appen ska DELEGERA till lib, inte reimplementera den.
//
// App-funktionen är en adapter: läs state, anropa `likvardighetsparUr`, fyll på med
// UI-diagnostik. Testet nedan kör adaptern med en SPION i stället för lib
// och kontrollerar att state översätts rätt — och att adaptern inte bär någon
// egen implementation.
const appLVSrc = (() => {
    const sig = 'function likvardighetspar(over) {';
    const i = appSrc.indexOf(sig);
    if (i < 0) throw new Error('hittade ej app-adaptern likvardighetspar()');
    return extractFn(appSrc.slice(i), 'likvardighetspar');
})();
// kTroskel() läses ur state, som i appen (adaptern skickar värdet vidare till lib).
// Vymodellens felresultat och flikens diagnostik (src/lib/vymodell-likvardigt-arbete.js) ges som i appen.
const _makeAppLV = new Function('state', 'nationellAidKlass', 'likvardighetsparUr', 'kompletteraDiagnostik', 'likvardighetFelresultat', `
    const kTroskel = () => state.kTroskel ?? 10;
    const kInstalld = kTroskel;
    // Definitionen och jämförelsemängden ur 45-aid-bas-tabeller.js (ADR-60), lästa ur state som i appen.
    const aidbasDefinition = () => state.likvardighet && state.likvardighet.kvDomDefinition === 'scb' ? 'scb' : 'do';
    const lvJamforelse = () => state.likvardighet && state.likvardighet.jamforelse === 'mansdominerade' ? 'mansdominerade' : 'alla';
    ${appLVSrc}
    return likvardighetspar;
`);
const makeAppLV = (state, nationellAidKlass, ur) => _makeAppLV(state, nationellAidKlass, ur, kompletteraDiagnostik, likvardighetFelresultat);

const tomtResultat = () => ({
    orgKvDom: [{ aid: '5301', bas: 'B', label: 'Undersköterska', n: 12, kvAndel: 80 }],
    orgIckeKv: [],
    statIckeKv: [{ aid: '2000', bas: 'B', label: 'Ingenjör', n: 14, kvAndel: 14.3 }],
    pairs: [],
    diagnostik: { organisation: {}, statistik: {}, jämförelse: {}, fel: [] },
    opts: {}
});

describe('likvärdigt arbete: appen delegerar till lib', () => {
    it('adaptern innehåller ingen egen implementation', () => {
        expect(appLVSrc).toContain('likvardighetsparUr(');
        // Namn som bara en egen implementation av algoritmen har. Dyker något av dem upp
        // har någon börjat implementera i app.js i stället för i src/lib/.
        for (const spår of ['orgMap', 'statByBas', 'bootstrapMedianskillnadKr', '_bootstrapMedianDiffKr']) {
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
            likvardighet: { kvinnoTrosholdPct: 55, kvDomDefinition: 'scb', jamforelse: 'mansdominerade', minGapPct: 3, topN: 20 }
        };
        state.kTroskel = 15;
        makeAppLV(state, () => null, spion)();
        expect(sedd.opts.k).toBe(15);   // tröskeln följer med (räknar små grupper i diagnostiken)
        expect(sedd.data).toBe(state.data);
        expect(sedd.statistik).toBe(state.statistik);
        expect(typeof sedd.nationellKlass).toBe('function');
        // BAS-ordningen är fast (se §6 i likvardighetsmodellen.md): ingen basRang skickas.
        // Definitionen av kvinnodominerat och jämförelsemängden följer med (ADR-60).
        expect(sedd.opts).toEqual({ kvinnoTrosholdPct: 55, kvDomDefinition: 'scb', jamforelse: 'mansdominerade', minGapPct: 3, topN: 20, k: 15 });
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
        // Procenttalet skrivs av vymodellen med talformat.js (hårt mellanslag före %), som i appen.
        expect(res.diagnostik.statistik.exempelIckeKv).toEqual([`2000 (Ingenjör) BAS B ${svPct(14, 0)}kv`]);
        expect(res.diagnostik.statistik.harLokalKonsdata).toBe(true);
        expect(res.diagnostik.fel).toEqual([]);
    });

    it('returnerar ett strukturerat resultat även när lib kastar', () => {
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

describe('likvärdigt arbete: lib ger reproducerbara konfidensintervall', () => {
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
        const kör = () => libLv.likvardighetsparUr({ data, statistik: [], nationellKlass: () => null,
            opts: { kvinnoTrosholdPct: 60, minGapPct: 0, topN: 100 } });
        const a = kör(), b = kör();
        expect(a.pairs.length).toBeGreaterThan(0);
        expect(a.pairs[0].gapCI).not.toBeNull();
        expect(a.pairs.map(p => p.gapCI)).toEqual(b.pairs.map(p => p.gapCI));
    });

    it('en injicerad rng används när testet ber om det', () => {
        const konst = () => 0.5;
        const res = libLv.likvardighetsparUr({ data, statistik: [], nationellKlass: () => null,
            opts: { kvinnoTrosholdPct: 60, minGapPct: 0, topN: 100, rng: konst } });
        // Alla resamplingar blir identiska → noll bredd på intervallet.
        expect(res.pairs[0].gapCI.lo).toBe(res.pairs[0].gapCI.hi);
    });
});

// ===================================================================
// Regressionsmodellerna (src/lib/regression.js): app-filen är en tunn adapter.
// Modellerna ska inte finnas i 50-regressionsmodeller.js igen, och varje app-funktion
// ska delegera till lib.
describe('regression: 50-regressionsmodeller.js är en tunn adapter', () => {
    const regSrc = readFileSync(join(root, 'src', 'app', '50-regressionsmodeller.js'), 'utf8');
    const adaptrar = ['_raknaPerBasGap', 'korBlinderOaxaca', 'korKvantilregressionAllaTau'];
    const libNamn = /import \{([^}]*)\} from '\.\.\/lib\/regression\.js'/.exec(regSrc)[1].split(',').map(s => s.trim().split(/\s+as\s+/).pop());

    it('innehåller inga egna beräkningar (ingen log eller OLS-anrop)', () => {
        expect(regSrc, 'log-lön räknas i src/lib/regression.js').not.toContain('Math.log(');
        expect(regSrc, 'OLS anropas i src/lib/regression.js').not.toContain('anpassaOLS(');
    });

    for (const namn of adaptrar) {
        it(`${namn} delegerar till lib`, () => {
            const kropp = extractFn(regSrc, namn);
            expect(libNamn.some(n => kropp.includes(`${n}(`)), `${namn} ska anropa en funktion ur src/lib/regression.js`).toBe(true);
        });
    }
});

// ===================================================================
// Prioriteringsanalysen (src/lib/prioritering.js) och livscykelmodellen (src/lib/livscykel.js):
// båda adaptrarna i appen är tunna och delegerar till lib. Modellerna ska inte finnas kvar
// i 55-prioritering.js respektive 52-livscykel.js.
describe('prioritering och livscykel: adaptrarna är tunna och delegerar till lib', () => {
    const prioSrc = readFileSync(join(root, 'src', 'app', '55-prioritering.js'), 'utf8');
    const lcSrc = readFileSync(join(root, 'src', 'app', '52-livscykel.js'), 'utf8');

    it('raknaPrioritering delegerar till prioritera och bygger ingen egen beräkning', () => {
        const kropp = extractFn(prioSrc, 'raknaPrioritering');
        expect(kropp).toContain('prioritera(');
        for (const spår of ['Stat.median', 'kMaskerad', 'priorityIndex', 'sevScore', 'annualGapTotal', 'groups[']) {
            expect(kropp, `"${spår}" hör hemma i src/lib/prioritering.js`).not.toContain(spår);
        }
    });

    it('korLivscykelregression delegerar till livscykelRegression och bygger ingen egen modell', () => {
        const kropp = extractFn(lcSrc, 'korLivscykelregression');
        expect(kropp).toContain('livscykelRegression(');
        expect(lcSrc, 'OLS anropas i src/lib/livscykel.js').not.toContain('anpassaOLS(');
        expect(kropp, 'log-lön räknas i src/lib/livscykel.js').not.toContain('Math.log(');
        expect(kropp, 'designmatrisen hör hemma i src/lib/livscykel.js').not.toContain('dummyBas');
    });
});

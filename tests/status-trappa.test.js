/**
 * Uppmärksamhetstrappan (ADR-59, beslut 1a): statusen sätts på statistisk signal, inte på storleken ensam.
 *
 *   Värt att granska — skillnaden är säkerställd (slumpens gränser för gruppen) OCH minst 3 % (verktygets
 *                      storleksgräns).
 *   Följ upp         — minst 3 % men inte säkerställd, eller säkerställd men under 3 %.
 *   Balanserat       — under 3 % och inte säkerställd.
 *   Går ej att bedöma — något kön är under golvet (statGolv i appen).
 *
 * Direktivmarkeringen (≥ 5 %) är något annat: den följer den OJUSTERADE medianskillnaden och står aldrig på
 * regressionens justerade tal.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { statusNiva, direktivMarkering, slumpensGranser, omkastningsGranser, bedomSkillnad, perBasSignal, STORLEKSGRANS, DIREKTIVNIVA,
    STATUS_ORD, DIREKTIV_TIPS, DIREKTIV_KOLUMN } from '../src/lib/status.js';
import { likaArbeteGrupper, stabilitetKort, avsnittBlock } from '../src/lib/rapportunderlag.js';
import { slumpFor } from '../src/lib/rng.js';

const person = (yrke, kon, lon) => ({ yrke, kon, lon, alder: 40, bas: 'C' });
/** n löner jämnt fördelade kring `mitt` med relativ halvbredd `spann` (deterministiskt). */
const loner = (n, mitt, spann) => Array.from({ length: n }, (_, i) => Math.round(mitt * (1 + spann * (2 * i / (n - 1) - 1))));
const yrke = (namn, kv, ma) => [...kv.map(l => person(namn, 'kvinna', l)), ...ma.map(l => person(namn, 'man', l))];

describe('[B4.10] statusNiva: trappan', () => {
    it('säkerställd och minst 3 % är Värt att granska', () => {
        expect(statusNiva(4, true)).toBe('granska');
        expect(statusNiva(3, true)).toBe('granska');
    });
    it('minst 3 % utan säkerställd skillnad, eller säkerställd under 3 %, är Följ upp', () => {
        expect(statusNiva(6, false)).toBe('folj');
        expect(statusNiva(8, false)).toBe('folj');
        expect(statusNiva(1.5, true)).toBe('folj');
    });
    it('under 3 % och inte säkerställd är Balanserat', () => {
        expect(statusNiva(2.9, false)).toBe('balanserat');
        expect(statusNiva(0, false)).toBe('balanserat');
    });
    it('utan prövning (null) eller utan tal går det inte att bedöma', () => {
        expect(statusNiva(8, null)).toBe('ejbedomd');
        expect(statusNiva(NaN, true)).toBe('ejbedomd');
    });
    it('gränserna är 3 och 5 %, och ingen status bygger på 5 %', () => {
        expect(STORLEKSGRANS).toBe(3);
        expect(DIREKTIVNIVA).toBe(5);
        for (const s of Object.values(STATUS_ORD)) expect(s.grans).not.toMatch(/5\s*%/);
    });
});

describe('bedomSkillnad: en grupp mot slumpens gränser', () => {
    it('en grupp med 18 kvinnor och 2 män och 8 % skillnad är inte Värt att granska', () => {
        const kv = loner(18, 92000, 0.15), ma = loner(2, 100000, 0.15);
        // Under golvet (10 per kön): går inte att bedöma.
        expect(bedomSkillnad(kv, ma, { golv: 10 }).niva).toBe('ejbedomd');
        // Också utan golv: två män räcker inte för att skillnaden ska vara säkerställd.
        const b = bedomSkillnad(kv, ma, { golv: 2 });
        expect(b.sakerstalld).toBe(false);
        expect(b.niva).not.toBe('granska');
    });
    it('en grupp med 30/30 och 4 % säkerställd skillnad är Värt att granska', () => {
        const b = bedomSkillnad(loner(30, 96000, 0.02), loner(30, 100000, 0.02), { golv: 10 });
        expect(b.avstand).toBeCloseTo(4, 5);
        expect(b.sakerstalld).toBe(true);
        expect(b.niva).toBe('granska');
        expect(b.direktiv).toBe(false);   // under 5 %: ingen direktivmarkering
    });
    it('en grupp med 30/30 och 6 % skillnad som inte är säkerställd är Följ upp', () => {
        const b = bedomSkillnad(loner(30, 94000, 0.5), loner(30, 100000, 0.5), { golv: 10 });
        expect(b.avstand).toBeCloseTo(6, 5);
        expect(b.sakerstalld).toBe(false);
        expect(b.niva).toBe('folj');
        expect(b.direktiv).toBe(true);    // markeringen följer den ojusterade skillnaden, oberoende av statusen
    });
    it('gränserna är reproducerbara (seedade ur datat)', () => {
        const kv = loner(25, 97000, 0.1), ma = loner(25, 100000, 0.1);
        expect(slumpensGranser(kv, ma)).toEqual(slumpensGranser(kv, ma));
    });
});

// Referensen: den tidigare omkastningen, som flyttade lönerna och tog medianen med quickselect på kopior, med
// utgångsläget kvinnornas löner stigande följda av männens stigande (ADR-86) och symmetriska percentilindex. Den nya
// flyttar rangerna och läser medianerna ur rangordningen; gränserna ska vara exakt desamma med samma slumpföljd.
function refMedian(a) {
    const n = a.length;
    if (!n) return 0;
    const s = a.slice().sort((x, y) => x - y), m = n >> 1;
    return n & 1 ? s[m] : (s[m - 1] + s[m]) / 2;
}
function refOmkastningsGranser(kv, ma, B = 1000) {
    const alla = [...kv].sort((x, y) => x - y).concat([...ma].sort((x, y) => x - y)), n = alla.length, nKv = kv.length, rnd = slumpFor(kv, ma), kvoter = new Array(B);
    for (let b = 0; b < B; b++) {
        for (let i = 0; i < nKv; i++) { const j = i + ((rnd() * (n - i)) | 0), t = alla[i]; alla[i] = alla[j]; alla[j] = t; }
        const mKv = refMedian(alla.slice(0, nKv)), mMa = refMedian(alla.slice(nKv));
        kvoter[b] = mMa > 0 ? mKv / mMa * 100 : 100;
    }
    kvoter.sort((x, y) => x - y);
    const svans = Math.floor(B * 0.025);
    return { lag: kvoter[svans], hog: kvoter[B - 1 - svans] };
}

describe('[B4.9] omkastningsGranser ur rangordning ger samma gränser som omkastade löner', () => {
    const fall = [
        ['2 mot 2', loner(2, 30000, 0.1), loner(2, 31000, 0.1)],
        ['udda mot jämnt', loner(11, 97000, 0.1), loner(8, 100000, 0.1)],
        ['jämnt mot udda', loner(30, 94000, 0.5), loner(25, 100000, 0.5)],
        ['många lika löner', [30000, 30000, 30000, 31000, 31000, 29000, 30000, 30000], [33000, 33000, 34000, 33000, 33000, 33000, 30000]],
        ['alla lika', Array(9).fill(30000), Array(6).fill(30000)],
        ['decimaler', [30000.5, 29999.25, 30001.75, 30000.5, 30002], [33000.1, 32999.9, 33000.3, 33000.1]],
        ['nära gränsen för stora grupper', loner(180, 96000, 0.3), loner(120, 100000, 0.2)]
    ];
    for (const [namn, kv, ma] of fall) {
        it(namn, () => {
            const ny = omkastningsGranser(kv, ma), ref = refOmkastningsGranser(kv, ma);
            expect(ny.lag).toBe(ref.lag);
            expect(ny.hog).toBe(ref.hog);
            expect(omkastningsGranser(kv, ma, 200)).toEqual(refOmkastningsGranser(kv, ma, 200));
        });
    }
    it('lönerna som skickas in ändras inte', () => {
        const kv = loner(11, 97000, 0.1), ma = loner(8, 100000, 0.1), kvKopia = kv.slice(), maKopia = ma.slice();
        omkastningsGranser(kv, ma);
        expect(kv).toEqual(kvKopia);
        expect(ma).toEqual(maKopia);
    });
});

describe('likaArbeteGrupper: yrkesgruppernas status', () => {
    const rader = [
        ...yrke('Liten', loner(18, 92000, 0.15), loner(2, 100000, 0.15)),
        ...yrke('Säker', loner(30, 96000, 0.02), loner(30, 100000, 0.02)),
        ...yrke('Spridd', loner(30, 94000, 0.5), loner(30, 100000, 0.5)),
    ];
    const { grupper } = likaArbeteGrupper(rader, { k: 1, golv: 10 });
    const g = namn => grupper.find(x => x.yrke === namn);
    it('ett kön under golvet ger Går ej att bedöma', () => {
        expect(g('Liten').niva).toBe('ejbedomd');
        expect(g('Liten').flaggad).toBe(false);
    });
    it('flaggad är detsamma som Värt att granska', () => {
        expect(g('Säker').niva).toBe('granska');
        expect(g('Säker').flaggad).toBe(true);
        expect(g('Spridd').niva).toBe('folj');
        expect(g('Spridd').flaggad).toBe(false);
    });
    it('direktivmarkeringen följer den ojusterade medianskillnaden', () => {
        expect(g('Spridd').direktiv).toBe(true);
        expect(g('Säker').direktiv).toBe(false);
        expect(g('Liten').direktiv).toBe(true);   // 8 %: markeringen är ingen bedömning och kräver ingen prövning
    });
    it('stabiliteten prövas mot statusens storleksgräns (3 %), inte mot 5 %', () => {
        expect(g('Säker').stabilitet).toBeTruthy();
        const kort = stabilitetKort(g('Säker').stabilitet, 1);
        expect(kort).not.toMatch(/5 %/);
        expect(stabilitetKort({ niva: 'stabil', provadeMax: 2, begransad: null }, 5)).toMatch(/minst 3 %/);
    });
    it('rapportens avsnitt listar Värt att granska och har direktivkolumnen', () => {
        const b = avsnittBlock('lika', { grupper, utelamnade: [] }, { k: 1 });
        const text = JSON.stringify(b);
        expect(text).toMatch(/värda att granska/);
        expect(text).not.toMatch(/över 5 %/);
        expect(b.tabell.rubriker).toContain(DIREKTIV_KOLUMN);
        expect(b.tabell.rader.map(r => r[0])).toEqual(['Säker']);
    });
});

describe('direktivmarkeringen', () => {
    it('är minst 5 % på kvoten (kvinnors median i % av mäns)', () => {
        expect(direktivMarkering(95)).toBe(true);
        expect(direktivMarkering(95.01)).toBe(false);
        expect(direktivMarkering(106)).toBe(true);
        expect(direktivMarkering(null)).toBe(false);
    });
    it('kolumnen heter efter den ojusterade löneskillnaden', () => {
        expect(DIREKTIV_KOLUMN).toBe('Ojusterad löneskillnad ≥ 5 %');
    });
    it('verktygstipset säger att markeringen inte är en bedömning', () => {
        expect(DIREKTIV_TIPS).toMatch(/minst 5 %/);
        expect(DIREKTIV_TIPS).toMatch(/inte en bedömning/);
    });
    it('saknas på regressionens tal: per-BAS-signalen bygger på 3 % och bär ingen markering', () => {
        const s = perBasSignal(4, true, true);
        expect(s).toEqual({ niva: 'titta' });
        expect(perBasSignal(2, true, true).niva).toBe('dokumentera');
        expect(perBasSignal(8, false, true).niva).toBe('osakert');
        expect(perBasSignal(8, false, false).niva).toBe('inget');
        expect('direktiv' in s).toBe(false);
    });
});

describe('ingen färg på storleken ensam i appen', () => {
    // Den gamla gapKlass i livscykeln färgade nyckeltalen rött över 5 % och gult över 2 %, på storleken ensam. En
    // jämförelse med 5 % som direkt väljer en färgklass (fg-, farg-, ar-, bricka-, bg-, f-) är samma fel.
    const MONSTER = /Math\.abs\([^)]*\)\s*>=?\s*5(?:\.0+)?\s*\?\s*['"`](?:fg|farg|ar|bricka|bg|f)-[\w-]+/;
    const appDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'app');
    it('ingen fil under src/app/ (utom spegeln) sätter en färgklass på |skillnad| > 5', () => {
        const traffar = readdirSync(appDir).filter(f => f.endsWith('.js') && f !== '09-lib-speglar.js')
            .flatMap(f => readFileSync(join(appDir, f), 'utf8').split('\n')
                .map((rad, i) => (MONSTER.test(rad) ? `${f}:${i + 1}: ${rad.trim()}` : null)).filter(Boolean));
        expect(traffar).toEqual([]);
    });
    it('mönstret fäller den gamla gapKlass', () => {
        expect(MONSTER.test("const gapKlass = (g) => Math.abs(g) > 5 ? 'fg-kritisk' : Math.abs(g) > 2 ? 'fg-varning' : 'fg-ok';")).toBe(true);
    });

    // Percentiltabellen i Lönestruktur färgade cellen Kvinnors lön i % av mäns rosa och halvfet när skillnaden var
    // större än 5 %, och livscykelns tabell per BAS-intervall färgade Skillnad 25 och 65 år (kr) under -1000 kr, båda
    // på storleken ensam (ADR-71). En skillnad (gap, gapPct, gap25Kr, skillnad, diff …) som jämförs med en gräns skild
    // från 0 och direkt väljer en färg- eller viktklass är samma fel. Tecknet (< 0, kvinnor lägre) får välja färg på
    // en stapel.
    const STORLEK = /\b\w*(?:gap|skillnad|diff)\w*\s*[<>]=?\s*-?(?!0(?:\.0+)?\b)\d+(?:\.\d+)?\s*\?\s*['"`]\s*(?:fg|farg|ar|bricka|bg|f|halvfet)[\w-]*/i;
    // Undantag: rader som får jämföra en skillnad med en storleksgräns och välja klass, som "fil:rad-text" med motiv.
    // Listan är tom: inget ställe under src/app/ har i dag ett beslut som tillåter det.
    const STORLEK_UNDANTAG = /** @type {Set<string>} */ (new Set([]));
    it('ingen fil under src/app/ (utom spegeln) sätter färg eller fetstil på en skillnad jämförd med en storleksgräns', () => {
        const traffar = readdirSync(appDir).filter(f => f.endsWith('.js') && f !== '09-lib-speglar.js')
            .flatMap(f => readFileSync(join(appDir, f), 'utf8').split('\n')
                .map((rad, i) => (STORLEK.test(rad) && !STORLEK_UNDANTAG.has(`${f}:${rad.trim()}`) ? `${f}:${i + 1}: ${rad.trim()}` : null))
                .filter(Boolean));
        expect(traffar).toEqual([]);
    });
    it('mönstret fäller percentiltabellens gamla markering men inte stapelns tecken', () => {
        expect(STORLEK.test("<td class=\"t-hoger${x.gapPct < -5 ? ' fg-rosa halvfet' : ''}\">")).toBe(true);
        expect(STORLEK.test("${x.gapPct < 0 ? 'bg-rosa' : 'bg-ok'}")).toBe(false);
    });
    it('mönstret fäller livscykeltabellens gamla markering i kronor', () => {
        expect(STORLEK.test("<td class=\"t-hoger halvfet${r.gap25Kr < -1000 ? ' fg-varning' : ''}\">")).toBe(true);
        expect(STORLEK.test("${skillnadPct >= 5 ? 'farg-granska' : ''}")).toBe(true);
    });
});

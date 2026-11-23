// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
/**
 * Differensprovet: går en utelämnad grupps medellön att räkna fram ur det som en export skriver? (S4: "ett lönemått
 * får inte heller gå att räkna fram ur summorna i samma export".)
 *
 * Varje utdata som bygger på medel eller summor och utelämnar små grupper prövas med ett påhittat underlag där exakt
 * en grupp ligger under tröskeln, med en person och med fyra (tests/helpers/differens.js). Provet räknar som den som
 * läser exporten: bara med det som skrivs ut, avrundat som exporten avrundar (hela kronor för lönemått, en decimal för
 * andelar), och för jämförelse också på de oavrundade talen. Härledd betyder inom ± 1 % av gruppens sanna medellön
 * (GRANS i hjälparen, med motivering).
 *
 * Formen: ett prov där härledningen lyckas i dag är ett hål och skrivs `it.fails`, med kroppen som påstår det önskade
 * läget (att härledningen missar med mer än gränsen). Det är grönt så länge hålet finns och blir rött den dag det
 * stängs; den som stänger hålet byter då till `it`. Ett prov där härledningen redan misslyckas är ett vanligt `it`.
 * Proven räknar resten av alla rader som har ett värde, så att en kompletterande undertryckning (en visad rad som
 * blankas) ger resten för den lilla gruppen och den undertryckta tillsammans, inte ett tal för den lilla.
 *
 * Varje utdata prövas i en liten organisation (60 personer plus den lilla gruppen) och en stor (2 000). Avrundningen
 * till hela kronor ger ett fel i differensen på högst (antalet i totalen + antalen i delarna) × 0,5 kr, ungefär
 * organisationens storlek i kronor, delat med den lilla gruppens storlek; avrundningsfelen är oberoende, så det typiska
 * felet är ungefär en tredjedel av det. Felet växer alltså med organisationens storlek: några tiotal kronor vid 60
 * personer, några hundra vid 2 000. Med en person i gruppen gav underlagen här 0,01–0,03 % vid 60 personer och
 * 0,1–0,8 % vid 2 000; med fyra personer en fjärdedel så mycket. Vid några tusen personer och en person i gruppen
 * kan avrundningen ensam föra resultatet utanför gränsen, men det skyddar inte: ± några procent är fortfarande lönen.
 *
 * Det som inte går att pröva som differens har en motivering i sitt describe-block.
 *
 * Förhållandet till invarianten (ADR-88): invarianten I4 (tests/helpers/ktroskel-invariant.js) kör ett differensprov
 * på det som faktiskt lämnar verktyget vid tröskeln 10 och 25, med riggens enda underlag: varje tabell med medel,
 * summa eller kostnad är deklarerad i riggen, och en total minus de visade delarna i samma tabell får inte lämna färre
 * än tröskeln personer. Den här filen står kvar för det invarianten inte når: lib-modulerna med påhittade underlag i
 * flera storlekar och med en eller fyra personer i den lilla gruppen, varianter som riggens underlag inte har
 * (recepten, andra variabler i uppdelningen), och ekvationssystemen som bara lösaren (harledLinjart) ser. Självtestet
 * för invariantens prov står i blocket nedan.
 */
import { describe, it, expect } from 'vitest';
import { perBasTabeller } from '../src/lib/perbas.js';
import { pivottabell } from '../src/lib/utforska.js';
import { sektorernasAndel, sektorsTabell } from '../src/lib/sektor.js';
import { gapUppdelning, gapPoster } from '../src/lib/gapuppdelning.js';
import { sektorsnamn } from '../src/lib/aid.js';
import { gruppnyckel, konAv } from '../src/lib/falt.js';
import { byggArsbokslut, bokslutMedGrans, jamforBasIntervall, ARSBOKSLUT_NYCKELTAL, ARSBOKSLUT_BAS_MATT } from '../src/lib/arsbokslut.js';
import { kompletterandeUndertryckning } from '../src/lib/undertryckning.js';
import { rest, heltal, avvikelse, GRANS, underlagMedEnLitenGrupp, harledLinjart, differensprov, tabellerUrText, tabellerUrHtml, tal } from './helpers/differens.js';

const K = 10;
// Storlekarna som prövas: antalet personer utöver den lilla gruppen.
const STORLEKAR = [['liten organisation', 60], ['stor organisation', 2000]];
const FALL = STORLEKAR.flatMap(([namn, ovriga]) => [1, 4].map(nLiten => ({ namn: `${namn}, ${nLiten} ${nLiten === 1 ? 'person' : 'personer'}`, ovriga, nLiten })));
// De nyare proven för huvudområdena och uppdelningen prövar också en organisation mitt emellan.
const FALL_MED_MELLAN = [['liten organisation', 60], ['mellanstor organisation', 300], ['stor organisation', 2000]]
    .flatMap(([namn, ovriga]) => [1, 4].map(nLiten => ({ namn: `${namn}, ${nLiten} ${nLiten === 1 ? 'person' : 'personer'}`, ovriga, nLiten })));
const underlag = (fall, opt) => underlagMedEnLitenGrupp({ antal: fall.ovriga + fall.nLiten, nLiten: fall.nLiten, k: K, ...opt });

// En rad som exporten skriver den: antal och medellön i hela kronor (eller oavrundad, för jämförelse).
const skriven = (n, medel, avrunda) => ({ n, medel: avrunda ? heltal(medel) : medel });
const medVarde = rader => rader.filter(r => typeof r.medel === 'number' && isFinite(r.medel));
const medelAv = rader => rader.reduce((s, r) => s + r.lon, 0) / rader.length;
/** Andelen kvinnor som den skrivs (en decimal) tillbaka till ett antal: exakt så länge gruppen har under 1 000 personer. */
const antalUrAndel = (n, andelKv) => Math.round(n * (Math.round(andelKv * 10) / 10) / 100);

/**
 * Påstår det önskade läget: det härledda missar gruppens medellön med mer än gränsen, både på exportens avrundade tal
 * och på de oavrundade.
 * @param {(avrunda: boolean) => number|null|undefined} harled
 * @param {number} sann
 */
function harledningenMissar(harled, sann) {
    for (const avrunda of [true, false]) {
        const v = harled(avrunda);
        expect(avvikelse(v, sann), `${avrunda ? 'hela kronor' : 'oavrundat'}: härlett ${v}, sant ${sann}`).toBeGreaterThan(GRANS);
    }
}

describe('hjälparen', () => {
    it('resten är totalen minus delarna, i antal och medel', () => {
        expect(rest({ n: 10, medel: 30 }, [{ n: 4, medel: 20 }, { n: 5, medel: 30 }])).toEqual({ n: 1, medel: 70 });
        expect(rest({ n: 10, medel: 30 }, [{ n: 10, medel: 30 }])).toBeNull();
        expect(rest({ n: 10, medel: null }, [])).toBeNull();
    });
    it('underlaget har exakt en grupp under tröskeln, med den medellön som anges, och är detsamma för samma frö', () => {
        const opt = { antal: 61, stora: [{ bas: 'A' }, { bas: 'B' }], liten: { bas: 'C' }, nLiten: 4 };
        const { rader, liten } = underlagMedEnLitenGrupp(opt);
        const per = bas => rader.filter(r => r.bas === bas);
        expect([per('A').length, per('B').length, per('C').length]).toEqual([29, 28, 4]);
        expect(liten).toEqual({ n: 4, medel: 95000 });
        expect(per('C').reduce((s, r) => s + r.lon, 0) / 4).toBe(95000);
        expect(underlagMedEnLitenGrupp(opt).rader).toEqual(rader);
        expect(() => underlagMedEnLitenGrupp({ ...opt, nLiten: 10 })).toThrow();
    });
});

// Självtest för differensprovet i invarianten (differensprov i tests/helpers/differens.js): en påhittad tabell med en
// total och delar, skriven som exporterna skriver den.
describe('[S4] differensprovet i invarianten (självtest)', () => {
    // A–C når tröskeln och visas; D (4 personer) utelämnas. Raden Alla räknas på alla 71.
    const GRUPPER = [['A', 30, 30000], ['B', 25, 32000], ['C', 12, 28000], ['D', 4, 41000]];
    const N = GRUPPER.reduce((s, g) => s + g[1], 0);
    const MEDEL = GRUPPER.reduce((s, g) => s + g[1] * g[2], 0) / N;
    const KANDA = [{ namn: 'grupp D', n: 4, medel: 41000 }];
    const DEKL = [{ namn: 'påhittad tabell', vag: /^påhittad export$/, rubrik: /^Grupp \| Antal \| Medellön \| Median$/,
        antal: 'Antal', total: /^Alla$/, matt: [{ kolumn: 'Medellön' }] }];
    const tabell = (medel = g => String(g[2])) => ['Grupp | Antal | Medellön | Median', `Alla | ${N} | ${Math.round(MEDEL)} | 30500`,
        ...GRUPPER.filter(g => g[1] >= K).map(g => `${g[0]} | ${g[1]} | ${medel(g)} | ${g[2]}`), 'Grupper under 10 personer redovisas inte.'].join('\n');
    const prov = (text, dekl = DEKL, vag = 'påhittad export') => differensprov(tabellerUrText(vag, text), dekl, { k: K, kanda: KANDA });

    it('en liten grupp som går att räkna fram ur totalen och delarna fäller provet', () => {
        const { fynd, odeklarerade, fel, oanvanda } = prov(tabell());
        expect([odeklarerade, fel, oanvanda]).toEqual([[], [], []]);
        expect(fynd).toHaveLength(1);
        expect(fynd[0]).toMatchObject({ n: 4, total: 'Alla', kolumn: 'Medellön', motsvarar: ['grupp D'] });
        expect(Math.abs(fynd[0].medel - 41000)).toBeLessThan(41000 * GRANS);
    });
    it('samma tabell med kompletterande undertryckning godkänns', () => {
        const delar = GRUPPER.map(([namn, n]) => ({ namn, n, dold: n < K }));
        const undertryckta = kompletterandeUndertryckning(delar, K).map(i => GRUPPER[i][0]);
        expect(undertryckta).toEqual(['C']);
        const { fynd, fel, oanvanda } = prov(tabell(g => (undertryckta.includes(g[0]) ? '–' : String(g[2]))));
        expect([fynd, fel, oanvanda]).toEqual([[], [], []]);
    });
    it('en summa och ett mått per kön prövas också, med antalet ur en egen kolumn eller ur andelen kvinnor', () => {
        // Kvinnorna: 20 i A och 3 i B (B visar inte könens medel). Raden Alla bär kvinnornas medel och summan.
        const text = ['Grupp | Antal | Andel kvinnor (%) | Medellön kvinnor | Lönesumma',
            `Alla | 55 | ${(23 / 55 * 100).toFixed(1)} | ${Math.round((20 * 30000 + 3 * 39000) / 23)} | ${30 * 30000 + 25 * 32000}`,
            'A | 30 | 66.7 | 30000 | 900000', 'B | 25 | 12.0 | – | 800000'].join('\n');
        const dekl = [{ namn: 'per kön', vag: /^påhittad export$/, rubrik: /^Grupp \| Antal \| Andel kvinnor/, antal: 'Antal', total: /^Alla$/,
            matt: [{ kolumn: 'Medellön kvinnor', antal: { andel: 'Andel kvinnor (%)' } }, { kolumn: 'Lönesumma', typ: 'summa' }] }];
        const { fynd, fel } = prov(text, dekl);
        expect(fel).toEqual([]);
        // Summan går jämnt upp (inget blir över); kvinnornas medel lämnar de tre i B, med avrundningens fel.
        expect(fynd.map(f => [f.kolumn, f.n])).toEqual([['Medellön kvinnor', 3]]);
        expect(Math.abs(fynd[0].medel - 39000)).toBeLessThan(39000 * GRANS);
    });
    it('utan uttalad totalrad: en rad som minus en delmängd av de övriga lämnar en känd liten grupp fäller provet', () => {
        // Raden för hela intervallet S (A, C och D) står bland grupperna; D (4 personer) utelämnas. Med en annan summa för S
        // går antalet fortfarande jämnt upp, men resten motsvarar ingen känd liten grupp: inget fynd.
        const nS = 46, medelS = (30 * 30000 + 12 * 28000 + 4 * 41000) / nS;
        const text = ['Grupp | Antal | Lönesumma', `S | ${nS} | ${Math.round(nS * medelS)}`, 'A | 30 | 900000', 'B | 25 | 800000', 'C | 12 | 336000'].join('\n');
        const dekl = [{ namn: 'delmängd', vag: /^påhittad export$/, rubrik: /^Grupp \| Antal \| Lönesumma$/, antal: 'Antal', total: 'delmängd',
            matt: [{ kolumn: 'Lönesumma', typ: 'summa' }] }];
        const { fynd, fel, oanvanda } = prov(text, dekl);
        expect([fel, oanvanda]).toEqual([[], []]);
        expect(fynd.map(f => [f.total, f.n, f.motsvarar])).toEqual([['S', 4, ['grupp D']]]);
        expect(prov(text.replace(`S | ${nS} | ${Math.round(nS * medelS)}`, 'S | 46 | 1350000'), dekl).fynd).toEqual([]);
    });
    it('en tabell med bara medianer och percentiler prövas inte och kräver ingen deklaration', () => {
        const text = ['Grupp | Antal | Median | P10 | P90', `Alla | ${N} | 30500 | 26000 | 39000`, 'A | 30 | 30000 | 29000 | 31000', 'B | 25 | 32000 | 31000 | 33000'].join('\n');
        expect(prov(text, [])).toEqual({ fynd: [], odeklarerade: [], fel: [], oanvanda: [] });
    });
    it('en odeklarerad tabell med en medelkolumn fäller provet med meddelandet att den måste deklareras', () => {
        const { odeklarerade, fynd } = prov(tabell(), DEKL, 'ny export');
        expect(fynd).toEqual([]);
        expect(odeklarerade).toHaveLength(1);
        expect(odeklarerade[0]).toMatch(/^ny export: rubrikraden "Grupp \| Antal \| Medellön \| Median" måste deklareras i DIFFERENS_DEKLARATIONER/);
        // Deklarerad som inget att dela upp: godkänd, men inte prövad.
        const inget = [{ namn: 'ny', vag: /^ny export$/, rubrik: /^Grupp \| Antal \| Medellön/, inget: 'påhittat skäl' }];
        expect(prov(tabell(), inget, 'ny export')).toEqual({ fynd: [], odeklarerade: [], fel: [], oanvanda: [] });
    });
    it('en deklaration som inte känner igen något, eller vars delar inte ryms i totalen, fäller provet', () => {
        expect(prov(tabell(), DEKL, 'annan väg').oanvanda).toEqual(['påhittad tabell: känner inte igen någon tabell']);
        const fel = prov(tabell().replace(`Alla | ${N}`, 'Alla | 50')).fel;
        expect(fel[0]).toMatch(/delarna har fler personer \(67\) än totalen \(50\)/);
    });
    it('HTML-tabeller och Excel-blad läses med sina rubriker', () => {
        const html = `<p>x</p><table><caption>Per grupp</caption><thead><tr><th>Grupp</th><th>Antal</th><th>Medellön</th><th>Median</th></tr></thead>`
            + `<tbody><tr><td>Alla</td><td>${N}</td><td>${Math.round(MEDEL).toLocaleString('sv-SE')} kr</td><td colspan="1">30 500 kr</td></tr>`
            + GRUPPER.filter(g => g[1] >= K).map(g => `<tr><td>${g[0]}</td><td>${g[1]}</td><td>${g[2].toLocaleString('sv-SE')} kr</td><td>x</td></tr>`).join('')
            + '</tbody></table>';
        const [t] = tabellerUrHtml('påhittad export', html);
        expect(t.blad).toBe('Per grupp');
        expect(differensprov([t], DEKL, { k: K, kanda: KANDA }).fynd.map(f => f.n)).toEqual([4]);
        const blad = tabellerUrText('påhittad export', `[Översikt]\nText | x\n[Grupper]\n${tabell()}`);
        expect(blad.map(b => b.blad)).toEqual(['Översikt', 'Grupper']);
        expect(differensprov(blad, DEKL, { k: K, kanda: KANDA }).fynd.map(f => f.n)).toEqual([4]);
    });
    it('cellerna läses som exporterna skriver tal', () => {
        expect([tal('31 417 kr'), tal('12,5 %'), tal('−3,2'), tal('–'), tal(''), tal('A1'), tal(42)]).toEqual([31417, 12.5, -3.2, null, null, null, 42]);
    });
});

// ---- a. Tabellerna per BAS-intervall (src/lib/perbas.js) ----
// Exporterna skriver tabellerna så här (src/app/58-rapportmodell.js för Word och PDF, src/app/24-excelexport.js för
// Excel, båda i hela kronor): intervalltabellen med antal och receptets mått per rad; Löneskillnader inom likvärdigt
// arbete med antal, medellön för alla, män och kvinnor, kvot, andel kvinnor och medelålder; Löneskillnader i
// åldersgrupper med antal, medelålder, medellön för alla och medellön per åldersgrupp. Antalet per åldersgrupp
// (antalPerGrupp) skrivs inte ut. Hålen här stängdes med kompletterande undertryckning (ADR-83,
// `kompletterandeUndertryckning` i src/lib/undertryckning.js): proven var `it.fails` och är nu vanliga `it`.
describe('per BAS-intervall: Löneskillnader inom likvärdigt arbete, raden Alla mot intervallen', () => {
    const STORA = ['A', 'B', 'C', 'D', 'E'].map(bas => ({ bas, aid: '150101' }));
    for (const fall of FALL) {
        it(`${fall.namn}: ett utelämnat BAS-intervalls medellön går inte att härleda`, () => {
            const { rader, liten } = underlag(fall, { stora: STORA, liten: { bas: 'F', aid: '150101' } });
            const t = perBasTabeller(rader, { k: K });
            expect(t.basUtelamnade).toEqual(['F']);
            const [alla, ...bas] = t.konsgap.rader;
            harledningenMissar(avrunda => rest(skriven(alla.n, alla.medel, avrunda), medVarde(bas).map(r => skriven(r.n, r.medel, avrunda)))?.medel, liten.medel);
        });
    }

    for (const fall of FALL) {
        it(`${fall.namn}: med huvudområde som dimension går det utelämnade huvudområdets medellön inte att härleda`, () => {
            const { rader, liten } = underlag(fall, { stora: [{ aid: '150101' }, { aid: '200101' }, { aid: '400101' }], liten: { aid: '650101' } });
            const t = perBasTabeller(rader, { k: K, recept: { dim: 'sektor' } });
            expect(t.basUtelamnade).toHaveLength(1);
            const [alla, ...sektorer] = t.konsgap.rader;
            harledningenMissar(avrunda => rest(skriven(alla.n, alla.medel, avrunda), medVarde(sektorer).map(r => skriven(r.n, r.medel, avrunda)))?.medel, liten.medel);
        });
    }

    // Könsraderna: medellön för män och kvinnor står bara där båda könen når tröskeln, men raden Alla har båda könen
    // och antalet kvinnor per rad står som andel. Kvinnorna i ett intervall där de är under tröskeln blir resten.
    for (const fall of FALL) {
        it(`${fall.namn}: kvinnornas medellön i ett intervall där de är under tröskeln går inte att härleda`, () => {
            const { rader, liten } = underlag(fall, { stora: [{ bas: 'A' }, { bas: 'B', kon: 'man' }, { bas: 'C' }], liten: { bas: 'B' } });
            const t = perBasTabeller(rader, { k: K });
            const [alla, ...bas] = t.konsgap.rader;
            expect(bas.find(r => r.bas === 'B')).toMatchObject({ konVisas: false, medelKv: null, medelMa: null });
            const kv = r => ({ n: antalUrAndel(r.n, r.andelKv), medel: r.medelKv });
            harledningenMissar(avrunda => rest(skriven(kv(alla).n, alla.medelKv, avrunda),
                medVarde(bas.map(kv)).map(r => skriven(r.n, r.medel, avrunda)))?.medel, liten.medel);
        });
    }

    // Vägarna nedan stängdes tillsammans med de ovan (ADR-83): samma differenser ur andra kolumner och tabeller i samma
    // avsnitt.
    // Den lilla gruppens åldrar ligger långt från de övrigas (25–64 år, i medel omkring 45), så att en blandning inte
    // råkar träffa.
    const ALDER_LITEN = 62;
    const aldrarna = (n, alder0 = ALDER_LITEN) => Array.from({ length: n }, (_, i) => alder0 + i).reduce((s, x) => s + x, 0) / n;

    // Medelåldern står i samma tabell: raden Alla mot intervallen ger det utelämnade intervallets medelålder.
    for (const fall of FALL) {
        it(`${fall.namn}: ett utelämnat BAS-intervalls medelålder går inte att härleda`, () => {
            const { rader } = underlag(fall, { stora: STORA, liten: { bas: 'F', aid: '150101' }, alderLiten: ALDER_LITEN });
            const [alla, ...bas] = perBasTabeller(rader, { k: K }).konsgap.rader;
            const alder = r => ({ n: r.n, medel: r.alder });
            harledningenMissar(avrunda => rest(skriven(alla.n, alla.alder, avrunda), medVarde(bas.map(alder)).map(r => skriven(r.n, r.medel, avrunda)))?.medel, aldrarna(fall.nLiten));
        });
    }

    // Intervallets tabell med måttet Medellön har organisationens rad, med samma medellön som tabellen inom likvärdigt
    // arbete: raden Alla där mot organisationens rader i intervallens tabeller. De måste undertrycka samma intervall.
    for (const fall of FALL) {
        it(`${fall.namn}: med måttet Medellön går det utelämnade intervallets medellön inte att härleda ur organisationens rader`, () => {
            const { rader, liten } = underlag(fall, { stora: STORA, liten: { bas: 'F', aid: '150101' } });
            const t = perBasTabeller(rader, { k: K, recept: { matt: ['med', 'medel'] } });
            const alla = t.konsgap.rader[0];
            const org = t.intervall.map(i => i.rader.find(r => r.typ === 'organisation'));
            harledningenMissar(avrunda => rest(skriven(alla.n, alla.medel, avrunda), medVarde(org).map(r => skriven(r.n, r.medel, avrunda)))?.medel, liten.medel);
        });
    }

    // Kvinnornas medellön i B via männen: raden Alla för män minus de visade intervallens män ger männen i B, och B:s
    // medellön för alla minus männen ger kvinnorna. Regeln per kön döljer därför båda könens medel i ytterligare ett
    // intervall.
    for (const fall of FALL) {
        it(`${fall.namn}: kvinnornas medellön i ett intervall där de är under tröskeln går inte att härleda via männen`, () => {
            const { rader, liten } = underlag(fall, { stora: [{ bas: 'A' }, { bas: 'B', kon: 'man' }, { bas: 'C' }], liten: { bas: 'B' } });
            const [alla, ...bas] = perBasTabeller(rader, { k: K }).konsgap.rader;
            const B = bas.find(r => r.bas === 'B');
            const ma = r => ({ n: r.n - antalUrAndel(r.n, r.andelKv), medel: r.medelMa });
            harledningenMissar(avrunda => {
                const maB = rest(skriven(ma(alla).n, alla.medelMa, avrunda), medVarde(bas.map(ma)).map(r => skriven(r.n, r.medel, avrunda)));
                const nKvB = antalUrAndel(B.n, B.andelKv), b = skriven(B.n, B.medel, avrunda);
                return maB && typeof b.medel === 'number' ? (b.n * b.medel - maB.n * maB.medel) / nKvB : null;
            }, liten.medel);
        });
    }

    // Medelåldern per kön följer samma regel som medellönen per kön.
    for (const fall of FALL) {
        it(`${fall.namn}: kvinnornas medelålder i ett intervall där de är under tröskeln går inte att härleda`, () => {
            const { rader } = underlag(fall, { stora: [{ bas: 'A' }, { bas: 'B', kon: 'man' }, { bas: 'C' }], liten: { bas: 'B' }, alderLiten: ALDER_LITEN });
            const [alla, ...bas] = perBasTabeller(rader, { k: K }).konsgap.rader;
            const kv = r => ({ n: antalUrAndel(r.n, r.andelKv), medel: r.alderKv });
            harledningenMissar(avrunda => rest(skriven(kv(alla).n, alla.alderKv, avrunda),
                medVarde(bas.map(kv)).map(r => skriven(r.n, r.medel, avrunda)))?.medel, aldrarna(fall.nLiten));
        });
    }

    // Könsraderna i intervallets tabell med måttet Medellön har samma medellön per kön som tabellen inom likvärdigt arbete.
    for (const fall of FALL) {
        it(`${fall.namn}: med måttet Medellön går kvinnornas medellön inte att härleda ur könsraderna i intervallens tabeller`, () => {
            const { rader, liten } = underlag(fall, { stora: [{ bas: 'A' }, { bas: 'B', kon: 'man' }, { bas: 'C' }], liten: { bas: 'B' } });
            const t = perBasTabeller(rader, { k: K, recept: { matt: ['med', 'medel'] } });
            const alla = t.konsgap.rader[0];
            const kvRader = t.intervall.map(i => i.rader.find(r => r.typ === 'kvinnor')).filter(Boolean);
            harledningenMissar(avrunda => rest(skriven(antalUrAndel(alla.n, alla.andelKv), alla.medelKv, avrunda),
                medVarde(kvRader).map(r => skriven(r.n, r.medel, avrunda)))?.medel, liten.medel);
        });
    }
});

describe('per BAS-intervall: intervalltabellen med måttet Medellön, organisationens rad mot yrkesgrupperna', () => {
    // Organisationens rad och yrkesgruppernas rader har antal i kolumnen Antal (intervallets antal står också i
    // rubrikraden, `n`). Med exakt en AID-etikett utelämnad är resten den etiketten.
    for (const fall of FALL) {
        it(`${fall.namn}: en utelämnad AID-etiketts medellön går inte att härleda`, () => {
            const { rader, liten } = underlag(fall, { stora: ['150101', '150102', '150103'].map(aid => ({ bas: 'C', aid })), liten: { bas: 'C', aid: '150104' } });
            const t = perBasTabeller(rader, { k: K, recept: { matt: ['med', 'medel'] } });
            const C = t.intervall[0];
            expect(C.utelamnade).toEqual(['150104 Yrke 150104']);
            const org = C.rader.find(r => r.typ === 'organisation');
            const yrken = C.rader.filter(r => r.typ === 'yrke');
            harledningenMissar(avrunda => rest(skriven(org.n, org.medel, avrunda), medVarde(yrken).map(r => skriven(r.n, r.medel, avrunda)))?.medel, liten.medel);
        });
    }

    it('utan måttet Medellön (standardreceptet: P10, median, P90) har tabellen inget medel att räkna med', () => {
        const { rader } = underlag(FALL[0], { stora: ['150101', '150102', '150103'].map(aid => ({ bas: 'C', aid })), liten: { bas: 'C', aid: '150104' } });
        const t = perBasTabeller(rader, { k: K });
        // Raderna bär medel i lib-resultatet, men exporterna skriver bara receptets mått (rmPerBasAvsnitt, _excelPerBasRader);
        // medianer och kvantiler summerar inte.
        expect(t.recept.matt).toEqual(['p10', 'med', 'p90']);
    });
});

describe('per BAS-intervall: Löneskillnader i åldersgrupper', () => {
    // Kolumnerna Antal och Medellön alla är desamma som i tabellen inom likvärdigt arbete, och raden Alla räknas på
    // hela underlaget: samma differens som ovan, och samma intervall undertrycks (ADR-83).
    for (const fall of FALL) {
        it(`${fall.namn}: ett utelämnat BAS-intervalls medellön går inte att härleda ur kolumnerna Antal och Medellön alla`, () => {
            const { rader, liten } = underlag(fall, { stora: ['A', 'B', 'C', 'D', 'E'].map(bas => ({ bas })), liten: { bas: 'F' } });
            const [alla, ...bas] = perBasTabeller(rader, { k: K }).aldersgrupper.rader;
            harledningenMissar(avrunda => rest(skriven(alla.n, alla.medel, avrunda), medVarde(bas).map(r => skriven(r.n, r.medel, avrunda)))?.medel, liten.medel);
        });
    }

    // Medellönen i en åldersgrupp under tröskeln: antalet per åldersgrupp skrivs inte ut, så medellönen för alla och de
    // visade åldersgruppernas medellön räcker inte (två okända: antalet och medellönen i den dolda gruppen). Provet visar
    // det med två underlag som ger exakt samma utskrivna tabeller (intervalltabellen, likvärdigt arbete och åldersgrupper,
    // varje skriven cell lika) men olika medellön i den dolda åldersgruppen: ingen uträkning ur tabellerna kan träffa
    // båda inom gränsen. Underlag 2 är underlag 1 med en person ur 35–49 år, vars lön är gruppens medellön, flyttad till
    // –34 år; en person 50– år blir tio år äldre så att medelåldern står still. Lönerna är desamma, så kvantilerna också.
    for (const nLiten of [1, 4]) {
        it(`${nLiten === 1 ? 'en person' : 'fyra personer'} i åldersgruppen –34: dess medellön går inte att räkna fram ur tabellerna`, () => {
            const p = (lon, alder) => ({ bas: 'A', aid: '150101', yrke: '150101 Yrke 150101', yrkeLabel: 'Yrke 150101', kon: 'kvinna', lon, alder });
            const unga = Array.from({ length: nLiten }, (_, i) => p(60000 + (i - (nLiten - 1) / 2) * 200, 30));
            const mellan = Array.from({ length: 11 }, (_, i) => p(40000 + (i - 5) * 500, 40));   // medellön 40 000, en har den
            const aldre = Array.from({ length: 10 }, (_, i) => p(50000 + i * 300, 55));
            const ett = [...unga, ...mellan, ...aldre];
            const flyttad = mellan.findIndex(r => r.lon === 40000);
            const tva = [...unga, { ...mellan[flyttad], alder: 30 }, ...mellan.filter((_, i) => i !== flyttad), { ...aldre[0], alder: 65 }, ...aldre.slice(1)];
            const skrivet = rader => {
                const t = perBasTabeller(rader, { k: K });
                const h = v => (typeof v === 'number' ? Math.round(v * 10) / 10 : v);
                return {
                    intervall: t.intervall.map(i => i.rader.map(r => [r.namn, r.n, ...t.recept.matt.map(m => heltal(r[m]))])),
                    konsgap: t.konsgap.rader.map(r => [r.bas, r.n, heltal(r.medel), heltal(r.medelMa), heltal(r.medelKv), h(r.kvot), h(r.andelKv), heltal(r.alder), heltal(r.alderMa), heltal(r.alderKv)]),
                    alder: t.aldersgrupper.rader.map(r => [r.bas, r.n, heltal(r.alder), heltal(r.medel), ...r.perGrupp.map(heltal)]),
                };
            };
            expect(skrivet(tva)).toEqual(skrivet(ett));
            expect(skrivet(ett).alder[0].slice(4)).toEqual([null, 40000, 51350]);
            const medel = rader => { const u = rader.filter(r => r.alder < 35); return u.reduce((s, r) => s + r.lon, 0) / u.length; };
            const [m1, m2] = [medel(ett), medel(tva)];
            // Ett tal inom gränsen från båda kräver att de ligger högst två gränser isär.
            expect(Math.abs(m1 - m2) / Math.max(m1, m2)).toBeGreaterThan(2 * GRANS);
        });
    }
});

// ---- b. Egna vyers pivot (src/lib/utforska.js) ----
describe('Egna vyer: pivoten med måttet Medellön och en kolumndimension', () => {
    // pivottabell räknar summor per rad och per kolumn (radHinkar, kolHinkar), men bara för att sortera etiketterna;
    // resultatet bär inga totaler, bara cellerna, och urvalets antal. Tabellen i src/app/70-utforska.js skriver en
    // kolumn per kolumnvärde utan totalrad eller totalkolumn; en cell under tröskeln blir tom i exporten och rader och
    // kolumner med bara sådana celler utelämnas (data-export-tom, data-export-utelamna), om inte användaren kryssar i
    // rutan för grupper under k. Utan en total i samma export finns ingen differens att räkna. (Sorteringen efter
    // totalvärdet, för AID, säger bara en ordning.)
    for (const fall of FALL) {
        it(`${fall.namn}: resultatet har inga totaler, och cellerna utan den lilla räcker inte till en differens`, () => {
            const { rader } = underlag(fall, { stora: [{ bas: 'A' }, { bas: 'B' }, { bas: 'C' }], liten: { bas: 'C', kon: 'man' } });
            for (const r of rader) if (r.bas === 'C' && r.lon < 90000) r.kon = 'kvinna';   // C: bara kvinnor utom den lilla gruppen
            const p = pivottabell(rader, { rad: 'bas', kolumn: 'kon', matt: 'medel' }, { k: K });
            expect(Object.keys(p).sort()).toEqual(['celler', 'dolda', 'kolumnEtiketter', 'radEtiketter', 'spec', 'urval']);
            expect(Object.keys(p.urval).sort()).toEqual(['n', 'nKv', 'nMa']);
            const liten = p.celler.find(c => c.liten);
            expect(liten).toMatchObject({ rad: 'C', kol: 'Man', n: fall.nLiten });
            // Det som exporten skriver: cellerna över tröskeln. Ingen av dem innehåller den lilla gruppen.
            const skrivna = p.celler.filter(c => !c.liten);
            expect(skrivna.every(c => !(c.rad === 'C' && c.kol === 'Man'))).toBe(true);
        });
    }

    // Utanför S4 men värt att veta: två vyer exporterade var för sig ger samma differens som raden Alla mot intervallen (Hela urvalet i en
    // vy, BAS i en annan). Skyddet gäller summorna i samma export; differenser mellan två exporter står som ovaktade.
    it('två exporter: vyn Hela urvalet och vyn BAS ger tillsammans ett utelämnat intervalls medellön (utanför S4)', () => {
        const { rader, liten } = underlag(FALL[0], { stora: [{ bas: 'A' }, { bas: 'B' }], liten: { bas: 'C' } });
        const hela = pivottabell(rader, { rad: 'alla', matt: 'medel' }, { k: K }).celler[0];
        const bas = pivottabell(rader, { rad: 'bas', matt: 'medel' }, { k: K }).celler.filter(c => !c.liten);
        const r = rest(skriven(hela.n, hela.value, true), bas.map(c => skriven(c.n, c.value, true)));
        expect(avvikelse(r.medel, liten.medel)).toBeLessThan(GRANS);
    });
});

// ---- c. Huvudområdena (src/lib/sektor.js) ----
describe('Huvudområdena: sektorsTabell och sektorernasAndel', () => {
    // sektorsTabell har bara medianer (för alla, kvinnor och män), kvoten mellan medianerna, den justerade skillnaden
    // ur en regression och antal och andelar. Ett huvudområde under tröskeln står utan lönemått. Medianer går inte att
    // dela upp i delar, så det finns ingen total att räkna en differens mot.
    it('sektorsTabell: inget medel och ingen summa att räkna med', () => {
        const { rader } = underlag(FALL[0], { stora: [{ aid: '150101' }, { aid: '400101' }], liten: { aid: '650101' } });
        const t = sektorsTabell(rader, { k: K });
        for (const r of t) expect(Object.keys(r).filter(n => /medel|summa/i.test(n))).toEqual([]);
        expect(t.find(r => r.maskerad)).toMatchObject({ n: FALL[0].nLiten, medTot: null, medKv: null, medMa: null, kvot: null, justerat: null });
    });

    // sektorernasAndel skriver gapet i medellön (gapKr) och huvudområdenas del av det (sektorKr, och som andel), i
    // Lönestrukturs vy (src/app/37-struktur.js) och i rapportunderlaget (avsnittet Per huvudområde). I samma vy och i
    // samma "Kopiera alla avsnitt" står kvinnornas och männens medellön (Var uppstår löneskillnaden?,
    // src/app/68-var-uppstar-gapet.js och avsnittet uppdelning), antalet kvinnor och män (Sammanfattning) och varje
    // visat huvudområdes antal och andel kvinnor. Med två huvudområden är sektorKr = Δs₁ · (w₁ − w₂), med Δs₁ = andelen av
    // kvinnorna − andelen av männen i område 1 (verktygets tecken, som gapuppdelning.js), där wₛ är
    // medelvärdet av områdets medellön för kvinnor och män. Har det lilla området bara ett kön (en person har alltid
    // det) är w₂ dess medellön, och med de två totalerna blir det en ekvation med en okänd. Hålet stängdes med
    // sammanslagning (ADR-87, `sammanslagning` i src/lib/undertryckning.js): ett huvudområde där ett kön har färre än
    // tröskeln räknas samman med andra, och blir bara ett kvar skrivs beloppet inte.
    const skrivs = a => !!a && a.sektorKr !== null && a.andel !== null && Math.abs(a.andel) >= 0.01;   // annars står inget belopp
    for (const fall of FALL) {
        it(`${fall.namn}: med två huvudområden går det lilla områdets medellön inte att härleda ur beloppet och medellönerna`, () => {
            const { rader, liten } = underlag(fall, { stora: [{ aid: '400101' }], liten: { aid: '650101', kon: 'man' } });
            const andel = sektorernasAndel(rader, { k: K });
            const gu = gapUppdelning(rader, { k: K });
            const [stort] = sektorsTabell(rader, { k: K }).filter(r => !r.maskerad);
            // Antalen: hela underlaget (Sammanfattning) och det stora området (antal och andel kvinnor).
            const nKv = gu.n.kv, nMa = gu.n.ma;
            const nKv1 = antalUrAndel(stort.n, stort.andelKv), nMa1 = stort.n - nKv1, nMa2 = nMa - nMa1;
            expect([nKv1, nKv - nKv1]).toEqual([nKv, 0]);   // det lilla området har inga kvinnor
            harledningenMissar(avrunda => {
                if (!skrivs(andel)) return null;
                const v = x => (avrunda ? heltal(x) : x);
                const mKv = v(gu.medel.kv), mMa = v(gu.medel.ma), skr = v(andel.sektorKr);
                const D = skr / (nKv1 / nKv - nMa1 / nMa);   // w₁ − w₂ (sektorKr har verktygets tecken: Δs = kvinnor − män)
                // w₁ = (mKv + ma₁) / 2 och ma₁ = (nMa · mMa − nMa₂ · w₂) / nMa₁, ger w₂:
                return ((mKv + nMa * mMa / nMa1) / 2 - D) / (1 + nMa2 / (2 * nMa1));
            }, liten.medel);
        });
    }

    // Samma sak som ett ekvationssystem (harledLinjart i hjälparen), utan någon formel för huvudområdena: allt som
    // står i samma export samtidigt — de två medellönerna och beloppet — mot medellönen i varje huvudområde och kön.
    const cellSektor = r => `${sektorsnamn(r.aid)}|${r.kon}`;
    const ekvationer = rader => {
        const ut = skrivs(sektorernasAndel(rader, { k: K }));
        return rad => {
            const gu = gapUppdelning(rad, { k: K }), a = sektorernasAndel(rad, { k: K });
            return [gu.medel.kv, gu.medel.ma, ...(ut ? [a.sektorKr] : [])];
        };
    };
    const harledSektor = (rader, valj) => {
        const val = rader.filter(valj), mal = {};
        for (const r of val) mal[cellSektor(r)] = (mal[cellSektor(r)] || 0) + 1 / val.length;
        return harledLinjart({ rader, cell: cellSektor, utskrivet: ekvationer(rader), mal });
    };
    for (const fall of FALL_MED_MELLAN) {
        it(`${fall.namn}: två huvudområden, ekvationssystemet ger inte det lilla områdets medellön`, () => {
            const { rader, liten } = underlag(fall, { stora: [{ aid: '400101' }], liten: { aid: '650101', kon: 'man' } });
            harledningenMissar(harledSektor(rader, r => r.aid === '650101'), liten.medel);
        });
    }
    // Tre huvudområden: ett stort med båda könen och två små med bara män. Var för sig går de små inte att räkna fram,
    // men tillsammans är de en okänd: männens medellön i de två små områdena tillsammans, färre än tröskeln.
    for (const fall of FALL_MED_MELLAN) {
        it(`${fall.namn}: tre huvudområden med två små, ekvationssystemet ger inte de smås gemensamma medellön`, () => {
            const { rader } = underlag(fall, { stora: [{ aid: '400101' }], liten: { aid: '650101', kon: 'man' } });
            const forlaga = rader[rader.length - 1];
            const andra = Array.from({ length: fall.nLiten }, (_, i) => ({ ...forlaga, aid: '600101', yrke: '600101 Yrke 600101', yrkeLabel: 'Yrke 600101', lon: 70000 + i * 300 }));
            const alla = [...rader, ...andra];
            const sma = r => r.aid === '650101' || r.aid === '600101';
            expect(alla.filter(sma).length).toBeLessThan(K);
            harledningenMissar(harledSektor(alla, sma), medelAv(alla.filter(sma)));
        });
    }
    // Fyra huvudområden: två stora med båda könen, ett med bara män och ett litet med kvinnor.
    for (const fall of FALL_MED_MELLAN) {
        it(`${fall.namn}: fyra huvudområden med ett litet, ekvationssystemet ger inte det lilla områdets medellön`, () => {
            const { rader, liten } = underlag(fall, { stora: [{ aid: '400101' }, { aid: '200101' }, { aid: '150101', kon: 'man' }], liten: { aid: '650101' } });
            harledningenMissar(harledSektor(rader, r => r.aid === '650101'), liten.medel);
        });
    }
});

// ---- d. Var uppstår löneskillnaden? (src/lib/gapuppdelning.js) ----
describe('Var uppstår löneskillnaden: delarna och de största posterna', () => {
    // Exporten (kortet i src/app/68-var-uppstar-gapet.js och avsnittet uppdelning i rapportunderlaget) skriver
    // kvinnornas och männens medellön, varje del i kronor och upp till tre poster per del med namn och belopp.
    //
    // Den tidigare skyddsregeln räknade resten av en del som okänd. Men med antalen per BAS och kön (Struktur och
    // Sammanfattning i samma underlag) och de två medellönerna är en visad post i del A en ekvation: Pᵦ = Δsᵦ · (wᵦ − W̄),
    // där W̄ är medelvärdet av de två medellönerna, och varje del är en ekvation till. Underlaget: BAS A med kvinnor och
    // män, BAS B med bara män, BAS C med en eller fyra kvinnor. Del C (lön inom samma AID och BAS) ger skillnaden mellan
    // kvinnor och män i A; en visad post i del A ger A:s eller B:s nivå; männens medellön ger det andra intervallet;
    // kvinnornas medellön ger då kvinnorna i C. Hålet stängdes med sammanslagning (ADR-87): en grupp där ett kön har
    // färre än tröskeln räknas samman med andra grupper inom samma övergrupp innan uppdelningen räknas, så att varje
    // grupp som delarna och posterna bygger på har 0 eller minst tröskeln av varje kön.
    const harled = (rader, gu, avrunda) => {
        const v = x => (avrunda ? heltal(x) : x);
        const kvi = r => r.kon === 'kvinna';
        const nKv = gu.n.kv, nMa = gu.n.ma;
        const nKvA = rader.filter(r => r.bas === 'A' && kvi(r)).length, nMaA = rader.filter(r => r.bas === 'A' && !kvi(r)).length;
        const nMaB = nMa - nMaA, nKvC = nKv - nKvA;
        const mKv = v(gu.medel.kv), mMa = v(gu.medel.ma), wTot = (mKv + mMa) / 2;
        const postC = gu.topp.C.find(p => / BAS A$/.test(p.namn));
        const pA = gu.topp.A.find(p => p.namn === 'BAS A'), pB = gu.topp.A.find(p => p.namn === 'BAS B');
        if (!postC || (!pA && !pB)) return null;   // uppgifterna som behövs står inte
        const dA = v(postC.kr) / ((nKvA / nKv + nMaA / nMa) / 2);   // kvinnor − män i A
        let kvA;
        if (pA) kvA = wTot + v(pA.kr) / (nKvA / nKv - nMaA / nMa) + dA / 2;
        else kvA = (nMa * mMa - nMaB * (wTot + v(pB.kr) / (-nMaB / nMa))) / nMaA + dA;
        return (nKv * mKv - nKvA * kvA) / nKvC;
    };
    const fallet = fall => underlag(fall, { stora: [{ bas: 'A' }, { bas: 'B', kon: 'man' }], liten: { bas: 'C' } });

    // BAS C har bara kvinnor, för få; det enda andra intervallet med kvinnor är A, så C och A räknas samman. B står kvar
    // och kan namnges, men A:s poster står inte, och det som behövs för härledningen saknas.
    for (const fall of FALL) {
        it(`${fall.namn}: BAS A och C räknas samman, och kvinnornas medellön i det lilla intervallet går inte att härleda ur posterna och medellönerna`, () => {
            const { rader, liten } = fallet(fall);
            const gu = gapUppdelning(rader, { k: K });
            expect(gu.topp.A.map(p => p.namn)).toEqual(['BAS B']);
            expect(Object.values(gu.topp).flat().some(p => /BAS [AC]/.test(p.namn))).toBe(false);
            harledningenMissar(avrunda => harled(rader, gu, avrunda), liten.medel);
        });
    }

    // Samma underlag som ett ekvationssystem: allt som står samtidigt (medellönerna, varje del och de namngivna
    // posterna) mot medellönen i varje cell. Det prövar också delarna, som ensamma kan ge en liten grupps medellön (se
    // valet med en variabel nedan).
    const cellFor = variabler => r => [...variabler.map(v => String(gruppnyckel(r, v) ?? '—')), konAv(r)].join('|');
    const ekvationer = (rader, variabler) => {
        const gu = gapUppdelning(rader, { k: K, variabler });
        const namn = gu.delar ? Object.entries(gu.topp).flatMap(([d, l]) => l.map(p => [d, p.namn])) : [];
        return rad => {
            const u = gapUppdelning(rad, { k: K, variabler });
            const poster = gapPoster(rad, { k: K, variabler });
            return [u.medel.kv, u.medel.ma, ...(gu.delar ? Object.keys(gu.delar).map(d => u.delar[d]) : []),
                ...namn.map(([d, n]) => poster[d].find(p => p.namn === n).kr)];
        };
    };
    const harledGrupp = (rader, variabler, valj) => {
        const cell = cellFor(variabler), val = rader.filter(valj), mal = {};
        for (const r of val) mal[cell(r)] = (mal[cell(r)] || 0) + 1 / val.length;
        return harledLinjart({ rader, cell, utskrivet: ekvationer(rader, variabler), mal });
    };

    for (const fall of FALL_MED_MELLAN) {
        it(`${fall.namn}: standardvalet, ekvationssystemet ger inte kvinnornas medellön i det lilla intervallet`, () => {
            const { rader, liten } = fallet(fall);
            harledningenMissar(harledGrupp(rader, ['bas', 'aid'], r => r.bas === 'C'), liten.medel);
        });
    }
    // En variabel: delen är huvudområdenas andel ovan (samma formel), och den räcker ensam med medellönerna.
    for (const fall of FALL_MED_MELLAN) {
        it(`${fall.namn}: med huvudområde som enda variabel ger delen och medellönerna inte det lilla områdets medellön`, () => {
            const { rader, liten } = underlag(fall, { stora: [{ aid: '400101' }], liten: { aid: '650101', kon: 'man' } });
            harledningenMissar(harledGrupp(rader, ['sektor'], r => r.aid === '650101'), liten.medel);
        });
    }
    // AID-mellannivån: samma sak inom ett huvudområde (de fyra första siffrorna), med den lilla gruppen i en egen
    // mellannivå; ensam, följd av AID och efter huvudområdet.
    for (const fall of FALL_MED_MELLAN) {
        it(`${fall.namn}: med AID-mellannivå ger ekvationssystemet inte den lilla gruppens medellön`, () => {
            const { rader, liten } = underlag(fall, { stora: [{ aid: '150101' }, { aid: '150201', kon: 'man' }], liten: { aid: '150301' } });
            for (const variabler of [['aidniva'], ['aidniva', 'aid'], ['sektor', 'aidniva']]) {
                harledningenMissar(harledGrupp(rader, variabler, r => r.aid === '150301'), liten.medel);
            }
        });
    }
    // Åldersgrupper: samma struktur som BAS-fallet, med åldern i stället för BAS (A = 30 år, B = 40 år, C = 62 år).
    for (const fall of FALL_MED_MELLAN) {
        it(`${fall.namn}: med åldersgrupp ger ekvationssystemet inte den lilla åldersgruppens medellön`, () => {
            const { rader, liten } = fallet(fall);
            const alder = { A: 30, B: 40, C: 62 };
            const medAlder = rader.map(r => ({ ...r, alder: alder[r.bas] }));
            for (const variabler of [['alder'], ['alder', 'aid'], ['bas', 'alder']]) {
                harledningenMissar(harledGrupp(medAlder, variabler, r => r.alder === 62), liten.medel);
            }
        });
    }
    // Flera små celler: utöver BAS C (kvinnor) har BAS D två män och BAS E en kvinna och en man. Varken en liten cell
    // för sig eller de små tillsammans per kön går att räkna fram.
    for (const fall of FALL_MED_MELLAN) {
        it(`${fall.namn}: flera små celler, ekvationssystemet ger ingen av dem och inte heller de små tillsammans`, () => {
            const { rader } = fallet(fall);
            const p = (bas, kon, lon) => ({ ...rader[0], bas, kon, lon });
            const alla = [...rader, p('D', 'man', 61000), p('D', 'man', 61800), p('E', 'kvinna', 52000), p('E', 'man', 49000)];
            const val = [r => r.bas === 'C', r => r.bas === 'D', r => r.bas === 'E' && r.kon === 'kvinna', r => r.bas === 'E' && r.kon === 'man',
                r => r.kon === 'kvinna' && (r.bas === 'C' || r.bas === 'E'), r => r.kon === 'man' && (r.bas === 'D' || r.bas === 'E')];
            for (const variabler of [['bas', 'aid'], ['bas'], ['bas', 'alder', 'aid']]) {
                for (const valj of val) harledningenMissar(harledGrupp(alla, variabler, valj), medelAv(alla.filter(valj)));
            }
        });
    }
});

// ---- e. Årsbokslutet (src/lib/arsbokslut.js) ----
describe('Årsbokslutet: nyckeltal för hela organisationen mot raderna per grupp och BAS-intervall', () => {
    // Bokslutet bär bara antal, medianer, P10 och P90, kvoten mellan medianerna, lönespridningen ((P90 − P10) / median)
    // och de sakliga skälens belopp per kategori, aldrig ett medel eller en lönesumma. Medianer och kvantiler för hela
    // organisationen är inte summor av gruppernas, så raderna per grupp och intervall ger ingen differens mot nyckeltalen;
    // de enda talen som summerar är antalen, och antal omfattas inte av skyddet (ADR-70). De sakliga skälens belopp är
    // organisationens bedömning, inte löner, och en grupp under tröskeln bär inga belopp (_valideraBedomningar).
    // Golvet ARSBOKSLUT_K_MIN = 2 gäller ett bokslut sparat med en lägre tröskel; bokslutMedGrans tillämpar årets
    // tröskel på det som jämförelsen visar.
    it('bokslutets fält och jämförelsens mått har inget medel och ingen summa av löner', () => {
        const b = byggArsbokslut({ ar: 2026, skapat: '2026-11-19', k: 2, verktyg: 'prov',
            nyckeltal: { n: 61, nKv: 30, nMa: 31, medKv: 34000, medMa: 35000, kvotPct: 97.1 },
            grupper: [{ yrke: '150101 Yrke 150101', nKv: 12, nMa: 12, medKv: 34000, medMa: 35000, gapPct: -2.9 }],
            basIntervall: [{ bas: 'A', n: 58, nKv: 28, nMa: 30, p10: 30000, med: 34500, p90: 40000 }, { bas: 'F', n: 3, nKv: 2, nMa: 1, p10: 90000, med: 95000, p90: 99000 }],
            punkter: [], bedomningar: [] });
        const falt = o => Object.entries(o).flatMap(([n, v]) => (v && typeof v === 'object' ? [n, ...falt(v)] : [n]));
        expect(falt(b).filter(n => /medel|summa|lonesumma/i.test(n))).toEqual([]);
        expect([...ARSBOKSLUT_NYCKELTAL.map(x => x[0]), ...ARSBOKSLUT_BAS_MATT.map(x => x[0])].filter(n => /medel|summa/i.test(n))).toEqual([]);
        // Med årets tröskel 10 faller intervallet med tre personer bort ur det som jämförelsen visar.
        const med10 = bokslutMedGrans(b, 10);
        expect(jamforBasIntervall(med10.basIntervall, med10.basIntervall).map(r => r.bas)).toEqual(['A']);
    });
});

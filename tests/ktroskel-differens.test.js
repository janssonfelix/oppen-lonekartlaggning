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
 */
import { describe, it, expect } from 'vitest';
import { perBasTabeller } from '../src/lib/perbas.js';
import { computePivot } from '../src/lib/utforska.js';
import { sektorernasAndel, sektorsTabell } from '../src/lib/sektor.js';
import { gapUppdelning } from '../src/lib/gapuppdelning.js';
import { byggArsbokslut, bokslutMedGrans, jamforBasIntervall, ARSBOKSLUT_NYCKELTAL, ARSBOKSLUT_BAS_MATT } from '../src/lib/arsbokslut.js';
import { rest, heltal, avvikelse, GRANS, underlagMedEnLitenGrupp } from './helpers/differens.js';

const K = 10;
// Storlekarna som prövas: antalet personer utöver den lilla gruppen.
const STORLEKAR = [['liten organisation', 60], ['stor organisation', 2000]];
const FALL = STORLEKAR.flatMap(([namn, ovriga]) => [1, 4].map(nLiten => ({ namn: `${namn}, ${nLiten} ${nLiten === 1 ? 'person' : 'personer'}`, ovriga, nLiten })));
const underlag = (fall, opt) => underlagMedEnLitenGrupp({ antal: fall.ovriga + fall.nLiten, nLiten: fall.nLiten, k: K, ...opt });

// En rad som exporten skriver den: antal och medellön i hela kronor (eller oavrundad, för jämförelse).
const skriven = (n, medel, avrunda) => ({ n, medel: avrunda ? heltal(medel) : medel });
const medVarde = rader => rader.filter(r => typeof r.medel === 'number' && isFinite(r.medel));
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

// ---- a. Tabellerna per BAS-intervall (src/lib/perbas.js) ----
// Exporterna skriver tabellerna så här (src/app/58-rapportmodell.js för Word och PDF, src/app/24-excelexport.js för
// Excel, båda i hela kronor): intervalltabellen med antal och receptets mått per rad; Löneskillnader inom likvärdigt
// arbete med antal, medellön för alla, män och kvinnor, kvot, andel kvinnor och medelålder; Löneskillnader i
// åldersgrupper med antal, medelålder, medellön för alla och medellön per åldersgrupp. Antalet per åldersgrupp
// (antalPerGrupp) skrivs inte ut.
describe('per BAS-intervall: Löneskillnader inom likvärdigt arbete, raden Alla mot intervallen (S-1)', () => {
    const STORA = ['A', 'B', 'C', 'D', 'E'].map(bas => ({ bas, aid: '150101' }));
    for (const fall of FALL) {
        it.fails(`${fall.namn}: ett utelämnat BAS-intervalls medellön går inte att härleda (S-1)`, () => {
            const { rader, liten } = underlag(fall, { stora: STORA, liten: { bas: 'F', aid: '150101' } });
            const t = perBasTabeller(rader, { k: K });
            expect(t.basUtelamnade).toEqual(['F']);
            const [alla, ...bas] = t.konsgap.rader;
            harledningenMissar(avrunda => rest(skriven(alla.n, alla.medel, avrunda), medVarde(bas).map(r => skriven(r.n, r.medel, avrunda)))?.medel, liten.medel);
        });
    }

    for (const fall of FALL) {
        it.fails(`${fall.namn}: med huvudområde som dimension går det utelämnade huvudområdets medellön inte att härleda (S-1)`, () => {
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
        it.fails(`${fall.namn}: kvinnornas medellön i ett intervall där de är under tröskeln går inte att härleda (S-1)`, () => {
            const { rader, liten } = underlag(fall, { stora: [{ bas: 'A' }, { bas: 'B', kon: 'man' }, { bas: 'C' }], liten: { bas: 'B' } });
            const t = perBasTabeller(rader, { k: K });
            const [alla, ...bas] = t.konsgap.rader;
            expect(bas.find(r => r.bas === 'B')).toMatchObject({ konVisas: false, medelKv: null, medelMa: null });
            const kv = r => ({ n: antalUrAndel(r.n, r.andelKv), medel: r.medelKv });
            harledningenMissar(avrunda => rest(skriven(kv(alla).n, alla.medelKv, avrunda),
                medVarde(bas.map(kv)).map(r => skriven(r.n, r.medel, avrunda)))?.medel, liten.medel);
        });
    }
});

describe('per BAS-intervall: intervalltabellen med måttet Medellön, organisationens rad mot yrkesgrupperna (S-1)', () => {
    // Organisationens rad och yrkesgruppernas rader har antal i kolumnen Antal (intervallets antal står också i
    // rubrikraden, `n`). Med exakt en AID-etikett utelämnad är resten den etiketten.
    for (const fall of FALL) {
        it.fails(`${fall.namn}: en utelämnad AID-etiketts medellön går inte att härleda (S-1)`, () => {
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
    // hela underlaget: samma differens som S-1.
    for (const fall of FALL) {
        it.fails(`${fall.namn}: ett utelämnat BAS-intervalls medellön går inte att härleda ur kolumnerna Antal och Medellön alla (S-1)`, () => {
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
    // computePivot räknar summor per rad och per kolumn (radHinkar, kolHinkar), men bara för att sortera etiketterna;
    // resultatet bär inga totaler, bara cellerna, och urvalets antal. Tabellen i src/app/70-utforska.js skriver en
    // kolumn per kolumnvärde utan totalrad eller totalkolumn; en cell under tröskeln blir tom i exporten och rader och
    // kolumner med bara sådana celler utelämnas (data-export-tom, data-export-utelamna), om inte användaren kryssar i
    // rutan för grupper under k. Utan en total i samma export finns ingen differens att räkna. (Sorteringen efter
    // totalvärdet, för AID, säger bara en ordning.)
    for (const fall of FALL) {
        it(`${fall.namn}: resultatet har inga totaler, och cellerna utan den lilla räcker inte till en differens`, () => {
            const { rader } = underlag(fall, { stora: [{ bas: 'A' }, { bas: 'B' }, { bas: 'C' }], liten: { bas: 'C', kon: 'man' } });
            for (const r of rader) if (r.bas === 'C' && r.lon < 90000) r.kon = 'kvinna';   // C: bara kvinnor utom den lilla gruppen
            const p = computePivot(rader, { rad: 'bas', kolumn: 'kon', matt: 'medel' }, { k: K });
            expect(Object.keys(p).sort()).toEqual(['celler', 'dolda', 'kolumnEtiketter', 'radEtiketter', 'spec', 'urval']);
            expect(Object.keys(p.urval).sort()).toEqual(['n', 'nKv', 'nMa']);
            const liten = p.celler.find(c => c.liten);
            expect(liten).toMatchObject({ rad: 'C', kol: 'Man', n: fall.nLiten });
            // Det som exporten skriver: cellerna över tröskeln. Ingen av dem innehåller den lilla gruppen.
            const skrivna = p.celler.filter(c => !c.liten);
            expect(skrivna.every(c => !(c.rad === 'C' && c.kol === 'Man'))).toBe(true);
        });
    }

    // Utanför S4 men värt att veta: två vyer exporterade var för sig ger samma differens som S-1 (Hela urvalet i en
    // vy, BAS i en annan). Skyddet gäller summorna i samma export; differenser mellan två exporter står som ovaktade.
    it('två exporter: vyn Hela urvalet och vyn BAS ger tillsammans ett utelämnat intervalls medellön (utanför S4)', () => {
        const { rader, liten } = underlag(FALL[0], { stora: [{ bas: 'A' }, { bas: 'B' }], liten: { bas: 'C' } });
        const hela = computePivot(rader, { rad: 'alla', matt: 'medel' }, { k: K }).celler[0];
        const bas = computePivot(rader, { rad: 'bas', matt: 'medel' }, { k: K }).celler.filter(c => !c.liten);
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
    // visat huvudområdes antal och andel kvinnor. Med två huvudområden är sektorKr = Δs₁ · (w₁ − w₂), där wₛ är
    // medelvärdet av områdets medellön för kvinnor och män. Har det lilla området bara ett kön (en person har alltid
    // det) är w₂ dess medellön, och med de två totalerna blir det en ekvation med en okänd.
    for (const fall of FALL) {
        it.fails(`${fall.namn}: med två huvudområden går det lilla områdets medellön inte att härleda ur sektorKr och medellönerna (S-4)`, () => {
            const { rader, liten } = underlag(fall, { stora: [{ aid: '400101' }], liten: { aid: '650101', kon: 'man' } });
            const andel = sektorernasAndel(rader, { k: K });
            const gu = gapUppdelning(rader, { k: K });
            const [stort] = sektorsTabell(rader, { k: K }).filter(r => !r.maskerad);
            expect(Math.abs(andel.andel)).toBeGreaterThanOrEqual(0.01);   // annars skrivs inte sektorKr ut
            // Antalen: hela underlaget (Sammanfattning) och det stora området (antal och andel kvinnor).
            const nKv = gu.n.kv, nMa = gu.n.ma;
            const nKv1 = antalUrAndel(stort.n, stort.andelKv), nMa1 = stort.n - nKv1, nMa2 = nMa - nMa1;
            expect([nKv1, nKv - nKv1]).toEqual([nKv, 0]);   // det lilla området har inga kvinnor
            harledningenMissar(avrunda => {
                const v = x => (avrunda ? heltal(x) : x);
                const mKv = v(gu.medel.kv), mMa = v(gu.medel.ma), skr = v(andel.sektorKr);
                const D = skr / (nMa1 / nMa - nKv1 / nKv);   // w₁ − w₂
                // w₁ = (mKv + ma₁) / 2 och ma₁ = (nMa · mMa − nMa₂ · w₂) / nMa₁, ger w₂:
                return ((mKv + nMa * mMa / nMa1) / 2 - D) / (1 + nMa2 / (2 * nMa1));
            }, liten.medel);
        });
    }
    // Med tre eller fler huvudområden är sektorKr en ekvation i flera okända medellöner och räcker inte ensam; det
    // prövas inte här.
});

// ---- d. Var uppstår löneskillnaden? (src/lib/gapuppdelning.js) ----
describe('Var uppstår löneskillnaden: delarna och de största posterna', () => {
    // Exporten (kortet i src/app/68-var-uppstar-gapet.js och avsnittet uppdelning i rapportunderlaget) skriver
    // kvinnornas och männens medellön, varje del i kronor och upp till tre poster per del med namn och belopp. Posterna
    // för en grupp där ett kön är under tröskeln står aldrig, och skyddsregeln (_skyddad) tar bort visade poster tills
    // resten av delen har minst hälften av den dolda postens belopp som brus; räcker det inte står inga delar.
    //
    // Regeln räknar resten som okänd. Men med antalen per BAS och kön (Struktur och Sammanfattning i samma underlag)
    // och de två medellönerna är en visad post i del A en ekvation: Pᵦ = Δsᵦ · (wᵦ − W̄), där W̄ är medelvärdet av de två
    // medellönerna. Underlaget: BAS A med kvinnor och män, BAS B med bara män, BAS C med en eller fyra kvinnor. Del C
    // (lön inom samma AID och BAS) ger skillnaden mellan kvinnor och män i A; en visad post i del A ger A:s eller B:s
    // nivå; männens medellön ger det andra intervallet; kvinnornas medellön ger då kvinnorna i C.
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

    // Liten organisation: den lilla gruppens post i del A är stor mot de andra, regeln tar bort alla visade poster i
    // del A, och det som behövs står inte.
    for (const fall of FALL.filter(f => f.ovriga < 100)) {
        it(`${fall.namn}: skyddsregeln tömmer del A, och kvinnornas medellön i det lilla intervallet går inte att härleda`, () => {
            const { rader, liten } = fallet(fall);
            const gu = gapUppdelning(rader, { k: K });
            expect(gu.skyddad).toBe(true);
            expect(gu.topp.A).toEqual([]);
            harledningenMissar(avrunda => harled(rader, gu, avrunda), liten.medel);
        });
    }
    // Stor organisation: den lilla gruppens post är liten mot B:s, regeln släpper fram B:s post, och ekvationerna ger
    // kvinnornas medellön i C.
    for (const fall of FALL.filter(f => f.ovriga > 100)) {
        it.fails(`${fall.namn}: kvinnornas medellön i det lilla intervallet går inte att härleda ur en visad post och medellönerna (S-4)`, () => {
            const { rader, liten } = fallet(fall);
            const gu = gapUppdelning(rader, { k: K });
            expect(gu.topp.A.map(p => p.namn)).toEqual(['BAS B']);
            harledningenMissar(avrunda => harled(rader, gu, avrunda), liten.medel);
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

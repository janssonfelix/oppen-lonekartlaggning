// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
// En grupp är AID-koden i BAS-intervallet, i hela verktyget (ADR-89), aldrig texten i fältet för AID-etikett. Texten
// maskeras inte (ADR-85), så en kod kan ha flera texter: två stavningar av samma etikett, eller en rad där ett namn
// står i fältet. Underlaget här är påhittat: koden 207011 i BAS C med texten "Handläggare" på 8 rader, "Handläggare,
// natt" på 7 och ett påhittat personnamn på 1, alltså 16 personer (8 kvinnor och 8 män). Per text vore det två grupper under tröskeln 10 och en grupp på en person; per kod är det en grupp på 16. Sist prövas
// att Lika arbete, prioriteringen, jämförelsen, tabellerna per BAS-intervall och trattdiagrammet ger samma uppsättning
// grupper för samma underlag, så att de inte kan glida isär igen.
import { describe, it, expect } from 'vitest';
import { likaArbeteGrupper } from '../src/lib/rapportunderlag.js';
import { trattUnderlag, sigmaInomGrupp } from '../src/lib/osakerhet.js';
import { flaggaIndivider } from '../src/lib/individflaggor.js';
import { inomYrkesgrupp } from '../src/lib/regression.js';
import { gapPoster } from '../src/lib/gapuppdelning.js';
import { gruppnyckel, gruppnycklar } from '../src/lib/falt.js';
import { pivottabell } from '../src/lib/utforska.js';
import { iUrvalet } from '../src/lib/urval.js';
import { aidAvRad, namnrader } from '../src/lib/aid.js';
import { byggArsbokslut, jamforArsbokslut } from '../src/lib/arsbokslut.js';
import { prioritera } from '../src/lib/prioritering.js';
import { jamforelseRader } from '../src/lib/jamforelse.js';
import { perBasTabeller } from '../src/lib/perbas.js';
import { grupperaAidBas } from '../src/lib/aidbas.js';
import { aggregeraOrgKvDom } from '../src/lib/likvardighet.js';

// En rad som inläsningen ger den (inlasning.js): aid är sifferprefixet, yrkeLabel texten efter koden.
const rad = (text, bas, kon, lon, alder) => {
    const m = text.match(/^(\d+)/), aid = m ? m[1] : '';
    return { bas, kon, lon, alder, yrke: text, aid, yrkeLabel: aid ? text.replace(/^\d+\s*/, '') : text };
};
const flera = (text, bas, kon, n, lon, steg = 0) => Array.from({ length: n }, (_, i) => rad(text, bas, kon, lon + steg * i, 30 + 3 * i));
const TEXT_A = '207011 Handläggare', TEXT_B = '207011 Handläggare, natt', TEXT_NAMN = '207011 Anna Andersson';
// Kvinnorna 30 000 ×4 och 31 000 ×4 (median 30 500), männen 32 000 ×4 och 33 000 ×4 (median 32 500).
const delA = () => [...flera(TEXT_A, 'C', 'kvinna', 4, 30000), ...flera(TEXT_A, 'C', 'man', 4, 32000)];
const delB = () => [...flera(TEXT_B, 'C', 'kvinna', 4, 31000), ...flera(TEXT_B, 'C', 'man', 3, 33000)];
const delNamn = () => [rad(TEXT_NAMN, 'C', 'man', 33000, 45)];
const underlag = () => [...delA(), ...delB(), ...delNamn()];

describe('[B5.1] aidAvRad och gruppnycklarna', () => {
    it('koden är sifferprefixet i texten; utan text radens aid; utan kod hela texten', () => {
        expect(aidAvRad(rad(TEXT_B, 'C', 'man', 1, 30))).toBe('207011');
        expect(aidAvRad({ aid: '1', bas: 'A' })).toBe('1');
        expect(aidAvRad({ yrke: 'Ingen kod', aid: '' })).toBe('Ingen kod');
    });
    it('gruppnyckel följer texten (tre grupper); gruppnycklar följer koden (en grupp, med namnet på flest rader)', () => {
        const r = underlag();
        expect(new Set(r.map(x => gruppnyckel(x, 'aid'))).size).toBe(3);
        const nyckel = gruppnycklar(r);
        expect([...new Set(r.map(x => nyckel(x, 'aid')))]).toEqual([TEXT_A]);
        expect([...new Set(r.map(x => nyckel(x, 'aidbas')))]).toEqual([`${TEXT_A} · BAS C`]);
        expect(nyckel(r[0], 'bas')).toBe('C');
        // Namnet beror inte på ordningen: står raden med ett namn först heter gruppen ändå efter etiketten.
        const omvand = [...delNamn(), ...delB(), ...delA()];
        expect([...new Set(omvand.map(x => gruppnycklar(omvand)(x, 'aidbas')))]).toEqual([`${TEXT_A} · BAS C`]);
    });
});

describe('namnrader: gruppens namn är texten på flest av dess rader', () => {
    const t = (yrke, bas = 'C') => ({ yrke, bas });
    const namn = rader => [...namnrader(rader, r => `${aidAvRad(r)}|${r.bas}`)].map(([k, r]) => [k, r.yrke]);
    it('flest rader vinner, också när en annan text står först', () => {
        expect(namn([t(TEXT_NAMN), t(TEXT_B), t(TEXT_A), t(TEXT_A)])).toEqual([['207011|C', TEXT_A]]);
    });
    it('lika många rader: texten som kommer först i lönefilen', () => {
        expect(namn([t(TEXT_B), t(TEXT_A), t(TEXT_A), t(TEXT_B)])).toEqual([['207011|C', TEXT_B]]);
        expect(namn([t(TEXT_A), t(TEXT_B), t(TEXT_B), t(TEXT_A)])).toEqual([['207011|C', TEXT_A]]);
    });
    it('ger raden, så att etiketten och hela fältet kommer ur samma rad; varje grupp för sig', () => {
        const a = rad(TEXT_A, 'C', 'man', 1, 30), b = rad(TEXT_B, 'D', 'man', 1, 30);
        const m = namnrader([b, a, rad(TEXT_A, 'C', 'kvinna', 2, 31)], r => `${aidAvRad(r)}|${r.bas}`);
        expect(m.get('207011|C')).toBe(a);
        expect(m.get('207011|D')).toBe(b);
    });
    it('rader utan kod grupperas på sin text och heter som den', () => {
        expect(namn([t('Ingen kod', 'B'), t('Ingen kod, natt', 'B'), t('Ingen kod', 'B')])).toEqual([['Ingen kod|B', 'Ingen kod'], ['Ingen kod, natt|B', 'Ingen kod, natt']]);
        expect(namnrader([], aidAvRad).size).toBe(0);
    });
});

describe('likaArbeteGrupper: en grupp är AID-koden', () => {
    it('före: per text två grupper under tröskeln 10 (8 och 7) och en grupp på en person', () => {
        expect(likaArbeteGrupper(delA(), { k: 10 })).toMatchObject({ grupper: [], utelamnade: [`${TEXT_A} (BAS C)`], ejJamforbara: [] });
        expect(likaArbeteGrupper(delB(), { k: 10 })).toMatchObject({ grupper: [], utelamnade: [`${TEXT_B} (BAS C)`], ejJamforbara: [] });
        expect(likaArbeteGrupper(delNamn(), { k: 10 })).toMatchObject({ grupper: [], utelamnade: [], ejJamforbara: [`${TEXT_NAMN} (BAS C)`],
            ejJamforbaraGrupper: [{ yrke: TEXT_NAMN, aid: '207011', bas: 'C' }] });
    });
    it('efter: en grupp på 16 med 8 kvinnor och 8 män, som vid tröskeln 10 redovisas med sin samlade median', () => {
        const res = likaArbeteGrupper(underlag(), { k: 10 });
        expect(res.utelamnade).toEqual([]);
        expect(res.ejJamforbara).toEqual([]);
        expect(res.grupper).toHaveLength(1);
        expect(res.grupper[0]).toMatchObject({ yrke: TEXT_A, aid: '207011', bas: 'C', nKv: 8, nMa: 8, tot: 16, samladMedian: true, niva: 'ejbedomd', medTot: 31500 });
    });
    it('efter, vid tröskeln och golvet 5: medianer per kön, kvoten och statusen för hela koden', () => {
        const [g] = likaArbeteGrupper(underlag(), { k: 5, golv: 5 }).grupper;
        expect(g).toMatchObject({ yrke: TEXT_A, aid: '207011', nKv: 8, nMa: 8, tot: 16, samladMedian: false, medKv: 30500, medMa: 32500 });
        expect(g.kvot).toBeCloseTo(30500 / 32500, 12);
        expect(g.gapPct).toBeCloseTo(100 - 30500 / 32500 * 100, 12);
        expect(g.niva).toBe('granska');
        expect(g.flaggad).toBe(true);
        // Per text var det inga könsmedianer alls: varje text har färre än 5 av något kön.
        for (const del of [delA(), delB()]) expect(likaArbeteGrupper(del, { k: 5, golv: 5 }).grupper.every(x => x.samladMedian)).toBe(true);
    });
    it('gruppens namn är texten på flest av dess rader; varken namnet eller talen beror på ordningen', () => {
        const a = likaArbeteGrupper(underlag(), { k: 5, golv: 5 }).grupper[0];
        const b = likaArbeteGrupper([...delB(), ...delNamn(), ...delA()], { k: 5, golv: 5 }).grupper[0];
        expect(a.yrke).toBe(TEXT_A);   // 8 rader, mot 7 och 1
        expect(b).toEqual(a);
        // En grupp vars första rad har ett personnamn i fältet heter efter etiketten.
        expect(likaArbeteGrupper([...delNamn(), ...delA(), ...delB()], { k: 10 }).grupper[0].yrke).toBe(TEXT_A);
        // Lika många rader med två texter: texten som kommer först i lönefilen.
        const lika = [...flera(TEXT_B, 'C', 'kvinna', 2, 30000), ...flera(TEXT_A, 'C', 'man', 2, 32000), ...flera(TEXT_A, 'C', 'kvinna', 1, 30000), ...flera(TEXT_B, 'C', 'man', 1, 32000)];
        expect(likaArbeteGrupper(lika, { k: 1 }).grupper[0].yrke).toBe(TEXT_B);
    });
    it('samma kod i två BAS-intervall är två grupper, intill varandra i BAS-ordning; rader utan kod grupperas på sin text', () => {
        const r = [...underlag(), ...flera(TEXT_B, 'D', 'kvinna', 3, 36000), ...flera(TEXT_B, 'D', 'man', 3, 36000),
            ...flera('Ingen kod', 'B', 'kvinna', 3, 30000), ...flera('Ingen kod', 'B', 'man', 3, 30000),
            ...flera('Ingen kod, natt', 'B', 'kvinna', 3, 30000), ...flera('Ingen kod, natt', 'B', 'man', 3, 30000)];
        const res = likaArbeteGrupper(r, { k: 5 });
        expect(res.grupper.map(g => `${g.aid}|${g.bas}|${g.tot}`).sort()).toEqual(['207011|C|16', '207011|D|6', 'Ingen kod, natt|B|6', 'Ingen kod|B|6']);
        const i = res.grupper.findIndex(g => g.aid === '207011');
        expect(res.grupper.slice(i, i + 2).map(g => g.bas)).toEqual(['C', 'D']);
    });
});

describe('trattdiagrammet, personer att granska, regressionen, uppdelningen och Utforska följer koden', () => {
    it('[B4.7] trattUnderlag: en punkt 207011 i BAS C med 16 personer; per text ingen (ett kön under 5)', () => {
        const u = trattUnderlag(underlag(), 5);
        expect(u.punkter.map(p => [p.nyckel, p.n, p.nKv, p.nMa, p.yrke])).toEqual([['207011|C', 16, 8, 8, TEXT_A]]);
        expect(trattUnderlag(delA(), 5)).toBeNull();
        expect(trattUnderlag(delB(), 5)).toBeNull();
    });
    it('sigmaInomGrupp: koden i BAS-intervallet är en grupp (per text nådde ingen text golvet 5 för båda könen)', () => {
        const ar = kon => r => r.kon === kon;
        const r = [...underlag(), ...flera('503012 Drifttekniker', 'C', 'kvinna', 5, 35000, 400), ...flera('503012 Drifttekniker', 'C', 'man', 5, 36000, 400)];
        expect(sigmaInomGrupp(r, ar('kvinna'), ar('man'), 5)).toMatchObject({ grupper: 2, residualer: 26 });
    });
    it('[B5.6] flaggaIndivider: alla 16 prövas mot kollegorna i koden; per text prövades ingen (grupperna under 10)', () => {
        const efter = flaggaIndivider(underlag(), { minGrupp: 10, grans: 10 });
        expect(efter.provade).toEqual({ kv: 8, ma: 8 });
        expect(efter.ejProvade).toBe(0);
        for (const del of [delA(), delB(), delNamn()]) {
            const fore = flaggaIndivider(del, { minGrupp: 10, grans: 10 });
            expect(fore.provade).toEqual({ kv: 0, ma: 0 });
            expect(fore.ejProvade).toBe(del.length);
        }
        // Personens egen text står kvar i posten.
        const alla = flaggaIndivider(underlag(), { minGrupp: 10, grans: -Infinity }).flaggade;
        expect(alla.filter(f => f.aid === TEXT_NAMN)).toHaveLength(1);
    });
    it('steget AID-etikett inom BAS: en gruppnivå för koden', () => {
        const r = [...underlag(), ...flera('503012 Drifttekniker', 'C', 'kvinna', 5, 35000), ...flera('503012 Drifttekniker', 'C', 'man', 5, 36000)];
        const y = r.map(x => Math.log(x.lon)), kol = r.map(x => [x.kon === 'kvinna' ? 1 : 0, x.alder - 40]);
        expect(inomYrkesgrupp(r, y, kol).meta).toEqual({ nGrupper: 2, nGrupperBada: 2, nPersoner: 26, nEnkonade: 0 });
    });
    it('gapuppdelningen med variabeln AID: en post för koden, med 8 kvinnor och 8 män', () => {
        const r = [...underlag(), ...flera('503012 Drifttekniker', 'C', 'kvinna', 5, 35000), ...flera('503012 Drifttekniker', 'C', 'man', 5, 36000)];
        const poster = gapPoster(r, { k: 1, variabler: ['aid'] });
        expect(poster.A.map(p => [p.namn, p.nKv, p.nMa]).sort()).toEqual([[TEXT_A, 8, 8], ['503012 Drifttekniker', 5, 5]]);
    });
    it('Utforska: pivoten och villkoren på AID-etikett läser koden', () => {
        const r = underlag();
        const m = pivottabell(r, { rad: 'aid', matt: 'median' }, { k: 10 });
        expect(m.celler.map(c => [c.rad, c.n, c.liten])).toEqual([[TEXT_A, 16, false]]);
        const villkor = { lage: 'alla', villkor: [{ falt: 'aid', op: 'enAv', varde: [TEXT_A] }] };
        expect(r.filter(iUrvalet(villkor, gruppnycklar(r)))).toHaveLength(16);
        expect(r.filter(iUrvalet(villkor))).toHaveLength(8);   // gruppnyckel utan underlag: bara texten
    });
});

describe('årsbokslutet: grupperna paras på koden', () => {
    const gruppPost = g => ({ yrke: g.yrke, bas: g.bas, nKv: g.nKv, nMa: g.nMa, medKv: g.medKv, medMa: g.medMa, gapPct: g.skillnadPct, flaggad: g.flaggad, spridning: null });
    const bokslut = (ar, grupper, k = 5) => byggArsbokslut({ ar, skapat: `${ar}-12-31`, k, verktyg: 'test', nyckeltal: { n: 16, nKv: 8, nMa: 8 }, grupper, punkter: [] });
    const arets = () => bokslut(2026, likaArbeteGrupper(underlag(), { k: 5, golv: 5 }).grupper.map(gruppPost));
    it('årets bokslut har en grupp för koden i intervallet, med namnet från texten på flest av gruppens rader', () => {
        expect(arets().grupper.map(g => [g.yrke, g.bas, g.nKv, g.nMa, g.flaggad])).toEqual([[TEXT_A, 'C', 8, 8, true]]);
    });
    it('ett bokslut sparat med en annan text för koden jämförs med årets grupp (kvar, inte ny och borta)', () => {
        const forra = bokslut(2025, [{ yrke: TEXT_B, bas: 'C', nKv: 6, nMa: 6, medKv: 30000, medMa: 32000, gapPct: -6.25, flaggad: true }]);
        const j = jamforArsbokslut(forra, arets());
        expect(j.grupper.kvar.map(g => [g.yrke, g.gapForra, g.nKv])).toEqual([[TEXT_A, -6.25, 8]]);
        expect(j.grupper.nya).toEqual([]);
        expect(j.grupper.borta).toEqual([]);
        expect([j.grupper.antalForra, j.grupper.antalNu]).toEqual([1, 1]);
    });
    it('ett äldre bokslut med flera texter för samma kod: gruppen med årets namn, annars den största, och ingen dubbelrad', () => {
        const a = { yrke: TEXT_A, bas: 'C', nKv: 5, nMa: 5, medKv: 30000, medMa: 32000, gapPct: -6.25, flaggad: true };
        const b = { yrke: TEXT_B, bas: 'C', nKv: 6, nMa: 6, medKv: 31000, medMa: 33000, gapPct: -6.06, flaggad: true };
        const j1 = jamforArsbokslut(bokslut(2025, [b, a]), arets());
        expect(j1.grupper.kvar.map(g => g.gapForra)).toEqual([-6.25]);
        expect(j1.grupper.borta).toEqual([]);
        expect(j1.grupper.antalForra).toBe(1);
        const c = { ...a, yrke: '207011 Handläggare dag' };
        const j2 = jamforArsbokslut(bokslut(2025, [c, b]), arets());
        expect(j2.grupper.kvar.map(g => g.gapForra)).toEqual([-6.06]);
    });
    it('för ett underlag med en text per kod är jämförelsen densamma som på texten', () => {
        const g = { yrke: '301010 Fritidsledare', nKv: 6, nMa: 6, medKv: 30000, medMa: 31000, gapPct: -3.2, flaggad: true };
        const h = { yrke: '503012 Drifttekniker', nKv: 6, nMa: 6, medKv: 40000, medMa: 41000, gapPct: -2.4, flaggad: true };
        const j = jamforArsbokslut(bokslut(2025, [g]), bokslut(2026, [{ ...g, gapPct: -2 }, h]));
        expect(j.grupper.kvar.map(x => [x.yrke, x.gapForra, x.gapNu])).toEqual([[g.yrke, -3.2, -2]]);
        expect(j.grupper.nya.map(x => x.yrke)).toEqual([h.yrke]);
    });
});

// Samma underlag, samma grupper: varje analys som grupperar på lika arbete ger samma nycklar (kod och BAS-intervall)
// och samma antal. Underlaget har koder med flera texter, en kod i två intervall och rader utan kod. Tröskeln är 1
// (alla grupper redovisas), och varje grupp har minst två av varje kön.
describe('en och samma uppsättning grupper i hela verktyget', () => {
    const blandat = () => [
        ...underlag(),
        ...flera(TEXT_B, 'D', 'kvinna', 3, 36000, 300), ...flera(TEXT_A, 'D', 'man', 2, 37000, 300),
        ...flera('503012 Drifttekniker', 'C', 'kvinna', 2, 35000, 300), ...flera('503012 Drifttekniker, jour', 'C', 'man', 5, 36000, 300),
        ...flera('Ingen kod', 'B', 'kvinna', 2, 29000, 300), ...flera('Ingen kod', 'B', 'man', 2, 29500, 300),
        ...flera('Ingen kod, natt', 'B', 'kvinna', 2, 29000, 300), ...flera('Ingen kod, natt', 'B', 'man', 3, 29500, 300),
    ];
    const VANTAT = ['207011|C|16', '207011|D|5', '503012|C|7', 'Ingen kod, natt|B|5', 'Ingen kod|B|4'];
    const sortera = l => [...l].sort();
    const nycklar = (lista, n = g => g.n) => sortera(lista.map(g => `${g.aid}|${g.bas}|${n(g)}`));
    const r = blandat();
    // Namnet: texten på flest av gruppens rader, vid lika många den första. I 503012 står "Drifttekniker" först men
    // "Drifttekniker, jour" på fler rader; i 207011 i BAS D står "Handläggare, natt" på tre rader och "Handläggare" på två.
    const NAMN = ['207011|C|Handläggare', '207011|D|Handläggare, natt', '503012|C|Drifttekniker, jour', 'Ingen kod, natt|B|Ingen kod, natt', 'Ingen kod|B|Ingen kod'];
    const etikett = t => String(t).replace(/^\d+\s*/, '');
    const namnen = (lista, namn) => sortera(lista.map(g => `${g.aid}|${g.bas}|${etikett(namn(g))}`));
    it('samma namn på varje grupp i alla analyser', () => {
        const prio = prioritera(r, { referensFor: () => ({ median: 40000, kalla: 'x' }), kTroskel: 1,
            prioConfig: { atgardThreshold: -5, akutMinN: 10, bevakaThreshold: -2, analyseraThreshold: 5 }, prioWeights: { avvikelse: 50, volym: 30, jamstalldhet: 20 } });
        expect(namnen(likaArbeteGrupper(r, { k: 1 }).grupper, g => g.yrke)).toEqual(NAMN);
        expect(namnen(prio, g => g.yrke)).toEqual(NAMN);
        expect(namnen(jamforelseRader(r, { k: 1 }).rader, g => g.yrke)).toEqual(NAMN);
        expect(namnen(trattUnderlag(r, 1).punkter, g => g.yrke)).toEqual(NAMN);
        expect(namnen(grupperaAidBas(r), g => g.yrke)).toEqual(NAMN);
        const t = perBasTabeller(r, { k: 1 });
        expect(namnen(t.intervall.flatMap(i => i.rader.filter(x => x.typ === 'yrke').map(x => ({ aid: x.aid, bas: i.bas, namn: x.namn }))), g => g.namn)).toEqual(NAMN);
        const nyckel = gruppnycklar(r);
        const utforska = [...new Map(r.map(x => [`${aidAvRad(x)}|${x.bas}`, { aid: aidAvRad(x), bas: x.bas, namn: nyckel(x, 'aidbas').split(' · BAS')[0] }])).values()];
        expect(namnen(utforska, g => g.namn)).toEqual(NAMN);
        // Likvärdigt arbete grupperar bara rader med kod (fältet aid).
        const lv = aggregeraOrgKvDom(r, 60, 1);
        expect(namnen([...lv.orgKvDom, ...lv.orgIckeKv], g => g.label)).toEqual(NAMN.filter(n => /^\d/.test(n)));
    });
    it('Lika arbetes tabell (och BAS-dossiern, som läser den), tabellerna per AID-kod och BAS-intervall och trattdiagrammet', () => {
        expect(nycklar(likaArbeteGrupper(r, { k: 1 }).grupper, g => g.tot)).toEqual(VANTAT);
        expect(nycklar(grupperaAidBas(r))).toEqual(VANTAT);
        expect(nycklar(trattUnderlag(r, 1).punkter)).toEqual(VANTAT);
    });
    it('prioriteringen och jämförelsen', () => {
        const prio = prioritera(r, { referensFor: () => ({ median: 40000, kalla: 'x' }), kTroskel: 1,
            prioConfig: { atgardThreshold: -5, akutMinN: 10, bevakaThreshold: -2, analyseraThreshold: 5 }, prioWeights: { avvikelse: 50, volym: 30, jamstalldhet: 20 } });
        expect(nycklar(prio)).toEqual(VANTAT);
        expect(nycklar(jamforelseRader(r, { k: 1 }).rader)).toEqual(VANTAT);
    });
    it('tabellerna per BAS-intervall', () => {
        const t = perBasTabeller(r, { k: 1 });
        const yrken = t.intervall.flatMap(i => i.rader.filter(x => x.typ === 'yrke').map(x => ({ aid: x.aid, bas: i.bas, n: x.n })));
        expect(nycklar(yrken)).toEqual(VANTAT);
    });
});

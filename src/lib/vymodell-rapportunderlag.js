// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
/**
 * Öppen lönekartläggning — vymodellen för Rapportunderlaget (ADR-20, ADR-99): alla kopierbara block (avsnitt,
 * yrkesgrupper, kandidatpar, förra året, per BAS-intervall och egna tabeller) ur underlaget och analysernas resultat.
 * Allt som räknas, maskeras och väljs ut står här, med tröskeln som argument; blocken själva byggs av
 * src/lib/rapportunderlag.js. Regressionen, likvärdighetsberäkningen, handlingsplanen, referensöverblicken, förra
 * årets jämförelse och BAS-dossierernas stycken räknas i appen och ges som argument; src/app/67-rapportunderlag.js
 * ritar blocken och sköter kopieringen.
 */
import { aidAvRad } from './aid.js';
import { talformat } from './figur.js';
import { gapUppdelning } from './gapuppdelning.js';
import { arKvinna, arMan } from './kon.js';
import { parForRedovisning, parNarK } from './ktroskel.js';
import { medianKvotKIGiltiga } from './osakerhet.js';
import { arsbeloppMening } from './prioritering.js';
import { arsjamforelseBlock, avsnittBlock, basintervallBlock, egenTabellBlock, gruppBlock, justeratGapInomYrke, likaArbeteGrupper, parBlock,
    referenserBlock } from './rapportunderlag.js';
import { sektorernasAndel, sektorsTabell } from './sektor.js';
import { konsMedianerUrLoner, kvartilfordelning, representationPerBas } from './struktur.js';
import { receptTillTabeller } from './tabellrecept.js';

/** Förledet i id:t för blocken per AID-etikett i Lika arbete ("yrke:0"); en nyckel, inte text (ADR-74). */
export const RU_GRUPPBLOCK = 'yrke:';

/**
 * Diagrammen som kan kopieras som bild. Kandidatparens diagram (fliken likvardighet) visar alla par, även par med en
 * grupp under k som underlaget inte redovisar; det erbjuds därför bara när det finns par och inget har uteslutits.
 * @template {{flik:string}} D
 * @param {D[]} diagram
 * @param {boolean} harPar
 * @param {number} exkluderade
 * @returns {D[]}
 */
export function rapportunderlagDiagram(diagram, harPar, exkluderade) {
    return diagram.filter(g => g.flik !== 'likvardighet' || (harPar && !exkluderade));
}

/**
 * Vymodellen: blocken i ordning, och läget för kandidatparens diagram (`harPar`, `exkluderade`).
 * - Sammanfattningen: antal och medianer per kön (konsMedianerUrLoner prövar k), den oförklarade skillnaden med
 *   regressionens fras och det bortvalda (ADR-56), och underlagets kvalitet med de kriterier som inte är ok.
 * - Lika arbete: samma grupper som EU-tabellen (likaArbeteGrupper); ett block per flaggad grupp (Värt att granska,
 *   ADR-59) med bootstrap-KI, den justerade skillnaden (golvet) och årsbeloppet.
 * - Likvärdigt arbete: bara par där båda grupperna når k (parForRedovisning), också i Lägre krav, högre lön.
 * - Struktur, sektorer, handlingsplanen (summorna per underlag och de sakliga skälen), referenserna, förra året, ett
 *   block per BAS-intervall som når k och ett per egen tabell (receptTillTabeller med k).
 * @param {any[]} rader
 * @param {{k:number, golv:number, demo?:boolean, troskelNot?:string, kStampel?:string, reg?:any, kvalitet?:any, lika?:any,
 *   lv?:any, topN:number, kvinnoTroskel?:any, kvDomDefinition?:any, jamforelse?:any, gapVariabler?:any, skrDel?:any,
 *   hp: {rader:any[], skal?:any, utanBelopp:string, kInstalld:number, prio:string, par:string},
 *   referenser?:any, harStatistik?:boolean, kostnad?:any, arsjamforelse?:any,
 *   basintervall?:Array<{bas:string, stycken:any[], yrken:any[]}>, basBedomning:string, recept?:any[]}} val
 *   golv: golvet för statistiska skattningar (statGolv); troskelNot: meningen om sänkt tröskel; kStampel: tröskelns
 *   stämpel i sammanfattningen; reg: regressionen; kvalitet: underlagets kvalitet (bedomningUnderlag); lika: Lika
 *   arbetes grupper när appen redan räknat dem; lv: likvärdighetsberäkningens resultat; topN: maxantalet par när
 *   resultatet inte bär sitt; hp.rader: handlingsplanens rader i underlagets form, hp.skal: de sakliga skälen;
 *   kostnad: kostnadsinställningarna för årsbeloppet; arsjamforelse: { j, forra, nu } eller null;
 *   basintervall: BAS-dossierernas stycken och yrkesrader per intervall som når k
 */
export function vymodellRapportunderlag(rader, val) {
    const { k, golv, demo = false, troskelNot, kStampel, reg = null, kvalitet = null, lv = null, hp, referenser = null, harStatistik = false,
        kostnad, arsjamforelse = null, basintervall = [], basBedomning = '', recept = [] } = val;
    if (!rader.length) return { block: [], harPar: false, exkluderade: 0 };
    const opt = { k, urval: 'Hela organisationen', demo: !!demo, troskelNot: troskelNot || undefined };

    // Sammanfattning
    const kvLon = rader.filter(r => arKvinna(r)).map(r => r.lon), maLon = rader.filter(r => arMan(r)).map(r => r.lon);
    const km = konsMedianerUrLoner(kvLon, maLon);   // k prövas i avsnittet
    const sammanfattning = {
        n: rader.length, nKv: kvLon.length, nMa: maLon.length, medKv: km.medKv, medMa: km.medMa, kvotPct: km.kvotPct,
        oforklarat: !reg || reg.error ? null : { pct: reg.konPct, lo: reg.konPctLow, hi: reg.konPctHigh, fras: reg.fras, bortvalt: reg.bortvalt },   // frasen och det bortvalda följer modellen (ADR-56)
        kvalitet: kvalitet ? { status: kvalitet.status, brister: kvalitet.kriterier.filter(c => c.status !== 'ok').map(c => c.namn) } : null,
    };

    // Lika arbete — samma grupper som EU-tabellen
    const lika = val.lika || likaArbeteGrupper(rader, { k, golv });   // flaggad = Värt att granska (ADR-59)

    // Likvärdigt arbete — par med en grupp under k redovisas inte (fliken är undantagen från k, underlaget inte)
    const { par, utelamnade: parUtelamnade } = parForRedovisning(lv && lv.pairs, k);
    const topN = (lv && lv.opts && lv.opts.topN) ?? val.topN;   // maxantalet som resultatet faktiskt räknades med
    const kravProxy = (lv && lv.diagnostik && lv.diagnostik.jämförelse && lv.diagnostik.jämförelse.kravProxy) || 'bas';
    const lagreKrav = (lv && lv.lagreKrav) || [];

    // Struktur
    const representation = (representationPerBas(rader, { k }) || []).slice().sort((a, b) => String(a.bas).localeCompare(String(b.bas), 'sv'));
    const kvartiler = kvartilfordelning(rader, { k }) || [];

    // Handlingsplan — samma förifyllning som fliken (som redan utelämnar par under k)
    const hpRader = hp.rader;
    const hpSkal = hp.skal;
    const hpSkalBlock = hpSkal && hpSkal.grupper.length ? { grupper: hpSkal.grupper.map(g => ({ grupp: g.grupp, antal: g.antal, skillnadKr: g.skillnadKr, skal: g.sammanstallning.skal,
        utanBelopp: !!g.utanBelopp, summa: g.sammanstallning.summa, overstiger: !!g.sammanstallning.overstiger })), perKategori: hpSkal.perKategori, notUtanBelopp: hp.utanBelopp, k: hp.kInstalld } : null;
    const summa = lista => lista.reduce((s, r) => s + (r.kostnad || 0), 0);

    /** @type {any[]} */
    const block = [
        avsnittBlock('sammanfattning', sammanfattning, { ...opt, troskelNot: kStampel }),
        avsnittBlock('uppdelning', gapUppdelning(rader, { k, variabler: val.gapVariabler }), opt),   // valda variabler (ADR-65)
        avsnittBlock('lika', lika, opt),
        avsnittBlock('likvardigt', { par, exkluderade: parUtelamnade, kravProxy,
            kvinnoTroskel: val.kvinnoTroskel, kvDomDefinition: val.kvDomDefinition, jamforelse: val.jamforelse, topN }, opt),
        avsnittBlock('lagreKrav', { par: lagreKrav.filter(p => parNarK(p, k)), exkluderade: lagreKrav.filter(p => !parNarK(p, k)).length, kravProxy, topN }, opt),
        avsnittBlock('struktur', { representation, kvartiler, nKv: kvLon.length, nMa: maLon.length }, opt),
        avsnittBlock('sektorer', { sektorer: sektorsTabell(rader, { k, skrDel: val.skrDel }), andel: sektorernasAndel(rader, { k }) }, opt),
        avsnittBlock('handlingsplan', { rader: hpRader, summa: summa(hpRader),
            summaReferens: summa(hpRader.filter(r => r.underlag === hp.prio)),
            summaJamforelse: summa(hpRader.filter(r => r.underlag === hp.par)),
            ...(hpSkalBlock ? { skal: hpSkalBlock } : {}) }, opt),
    ];
    // Kolumnen Matchning bara när statistik finns, som i detaljlistan.
    if (referenser) block.push(referenserBlock(referenser, { ...opt, harStatistik }));
    lika.grupper.filter(g => g.flaggad).forEach((g, i) => {
        const gruppen = rader.filter(r => aidAvRad(r) === g.aid && String(r.bas) === g.bas);   // gruppens rader: koden i BAS-intervallet, alla stavningar
        const ki = medianKvotKIGiltiga(gruppen.filter(r => arKvinna(r)).map(r => r.lon), gruppen.filter(r => arMan(r)).map(r => r.lon));
        const arsbelopp = arsbeloppMening(g, kostnad, v => talformat(v, 'kr'));
        block.push(gruppBlock(g, { ...opt, id: RU_GRUPPBLOCK + i, justerat: justeratGapInomYrke(gruppen, { k: golv }), ki, arsbelopp }));
    });
    par.forEach((p, i) => block.push(parBlock(p, { ...opt, id: `par:${i}`, kravProxy })));
    // Jämförelsen med förra året (ADR-54), när ett bokslut är inläst.
    if (arsjamforelse) block.push(arsjamforelseBlock(arsjamforelse.j, { ...opt, forraAr: arsjamforelse.forra.ar, nuAr: arsjamforelse.nu.ar }));
    // Per BAS-intervall: ett block per intervall som når k, med BAS-dossierns stycken (samma text som dossierns kopia,
    // rapportutkastet och rapportens avsnitt) och intervallets yrkesgruppstabell.
    for (const b of basintervall) block.push(basintervallBlock({ ...b, bedomning: basBedomning }, opt));
    // Egna tabeller (ADR-52): ett block per tabell, ur samma recept som Word-utkastet, PDF-rapporten och Excel.
    recept.forEach((r, i) => receptTillTabeller(rader, r, { k }).forEach((t, j) => block.push(egenTabellBlock(t, { ...opt, id: `egen:${i}:${j}` }))));
    return { block, harPar: par.length > 0, exkluderade: parUtelamnade };
}

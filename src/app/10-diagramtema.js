// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
// ====================================================================
// 10-diagramtema.js — Delat diagram-tema (visualiserings-Steg 1)
//
// ENDA KÄLLA för diagrammens färger och typografi: paletten (kön, status, serier, färgskalor) och diagrammens
// teckensnitt. Diagramkärnan (10-diagramritare.js, ADR-39) och vyernas figurer läser härifrån — ingen vy har en
// egen hexkod.
// ====================================================================
import { gruppnyckel, jamforAldersgrupp } from '../lib/falt.js';
import { statusKonstanter, statusNiva } from '../lib/status.js';
import { stor } from '../lib/termer.js';
import { oversiktNiva } from '../lib/vymodell-lonestruktur.js';
import { FARG } from './01-farger.js';
import { statGolv } from './06-k-troskel.js';
import { T } from './09-termer.js';

// Kanonisk färgpalett. All könsfärgning och alla semantiska färger härleds
// härifrån (se `const farger` i 12-tillstand.js, som speglar PALETT.kon).
export const PALETT = {
    // Kön — genomgående i hela verktyget. Plommon för kvinnor och olivgrönt för män (beslut 2026-10-17):
    // inte rosa och blått, som kopplar färgen till en stereotyp. Båda har minst 4,5:1 mot vit yta (7,1 och
    // 4,6), skiljer sig mer än det tidigare paret vid simulerad protanopi och deuteranopi, och ligger tydligt ifrån
    // statusfärgerna (granska, ok, varning) och seriefärgerna. Kön står alltid också med ord i legenden.
    // Prövas i tests/farger.test.js.
    kon: { kvinna: '#833a8f', man: '#5f7f16' },
    // Semantiska statusfärger (avvikelse/varning/ok m.m.).
    semantic: {
        policy:   '#d24723',
        // Statusfärgerna har minst 3:1 i kontrast mot vit bakgrund (WCAG 1.4.11) och skiljer sig i ljushet och
        // ton också för den som har svårt att skilja rött från grönt: mörkt rött, mellanljus bärnsten, blågrönt.
        kritisk:  FARG.kritisk,
        varning:  '#d97706',
        ok:       FARG.ok,
        granska:  FARG.granska,   // «Värt att granska»: samma lila som i tabellerna och Prioritering
        neutral:  FARG.svag,
        referens: FARG.svag,
        linje:    FARG.dampad,   // mörk neutral linje (P90, felstaplar)
        trend:    '#1c5cab',   // trendlinje över punkter i seriens första färg
        spann:    '#d5dae3',   // referensens spann (P10–P90) bakom organisationens
        mork:     FARG.text    // markörer som ska synas mot både röd och grön stapel
    },
    // Kvalitativ serie-palett för diagram med många kategorier (t.ex. AID).
    // De åtta första i den här ordningen klarar kontrollen för färgblindhet mellan grannar. De fyra sista är mörkare
    // steg av de fyra första, för de få vyer som har fler än åtta serier (Utforska tillåter tolv segment).
    serie: ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#4a3aa7', '#e34948',
            '#184f95', '#a84418', '#0f7a55', '#8a6a00'],
    // Divergerande skala för heatmaps, centrerad på neutral mitt.
    // Låg (rött) = kvinnors median klart under männens; hög (blått) = över.
    // Två kulörer och en neutral mitt: varmt åt ena hållet, kallt åt det andra (fler kulörer läses som regnbåge).
    divergerande: [
        [0.0, '#a5371a'], [0.25, '#e59a7b'], [0.5, '#eeeeec'],
        [0.75, '#86b6ef'], [1.0, '#1c5cab']
    ],
    // Sekventiell skala (förvalet för `typ: 'sekventiell'`), för mått där högt varken är bra eller dåligt (lön, antal).
    sekventiellNeutral: [[0, '#dce9fb'], [0.5, '#5598e7'], [1, '#0d366b']],
    // Prioriteringsmatrisens statusar (samma nyanser som statusbrickorna i fliken).
    // Prioriteringens statusar. «Börja här» och «Värt att granska» är lila — samma färg som statusen «Värt att granska»
    // i Lika arbetes yrkesgruppstabell (lila överallt, inte rött). Lila säger «titta
    // här först» utan att påstå att något är fel; rött är förbehållet fel i underlaget.
    prio: { akut: FARG.granska, atgard: FARG.granskaLjus, bevaka: '#d97706', ok: FARG.ok, analysera: FARG.info },
    // Trapporna som delar en löneskillnad (Var uppstår löneskillnaden?, Vad blir kvar av löneskillnaden?). Färgen säger
    // vad delen betyder, inte åt vilket håll den går: hela skillnaden neutral, det som förklaras av var kvinnor och män
    // arbetar (struktur) en färg, och det som blir kvar inom samma grupp (lönesättningen) en annan. Inga statusfärger:
    // att något förklaras är ingen bedömning. Seriens två första färger, som skiljer sig också vid färgblindhet.
    // strukturLjus är ett steg som inte ingår i huvudtalet (regressionens AID-etikett inom BAS): strukturens blå,
    // ljusare, som en färg och inte som genomskinlighet, så att förklaringens ruta har samma färg som stapeln.
    uppdelning: { helhet: FARG.dampad, struktur: '#2a78d6', strukturLjus: '#9fc2ed', lonesattning: '#eb6834' },
    // Läget mot ett spann (lönepolitikens spann, personernas avstånd till gruppens median): varmt under, neutralt
    // inom, kallt över, med den divergerande skalans mellansteg för tredjedelarna.
    lage: { under: '#c2552d', nedre: '#e59a7b', inom: '#d5dae3', ovre: '#86b6ef', over: '#2a78d6' }
};

// Uppmärksamhetstrappan (ADR-59): statusordförrådet för en skillnad mellan kvinnors och mäns lön — ETT ställe för alla
// flikar. Statusen sätts på statistisk signal (src/lib/status.js): Värt att granska = säkerställd och minst 3 %
// (verktygets storleksgräns); Följ upp = minst 3 % men inte säkerställd, eller säkerställd under 3 %; Balanserat =
// under 3 % och inte säkerställd; Går ej att bedöma = ett kön under golvet. Direktivets 5 % är ingen status utan en
// egen markering på den ojusterade löneskillnaden (_direktivBricka i 41-lika-arbete.js).
// Varje ord har en färg (nyckel i PALETT.semantic och klassen ar-<farg>), en linjeikon för tabellerna (03-ikoner.js)
// och en symbol för diagrammen, så att statusen inte bärs av färgen ensam (WCAG 1.4.1). Samma ord står i Lika arbete,
// Ålder & karriär, Utforska och Förklaringen. «Börja här» och «Över referens» hör bara till Prioritering
// (55-prioritering.js): det första är rangordningens översta nivå, det andra ett läge och ingen allvarlighetsgrad.
// Trappans konstanter ur src/lib/status.js: storleksgränsen (3 %), direktivnivån (5 %), orden och markeringens texter.
export const { STORLEKSGRANS: _STS_STORLEK, STATUS_ORD: _STS_ORD, DIREKTIV_ETIKETT: _STS_DIR_ETIKETT, DIREKTIV_KOLUMN: _STS_DIR_KOLUMN,
        DIREKTIV_TIPS: _STS_DIR_TIPS } = statusKonstanter();
export const GAP_STATUS = Object.freeze([
    { ..._STS_ORD.granska, niva: 'granska', farg: 'granska', ikon: 'sok', symbol: 'romb' },
    { ..._STS_ORD.folj, niva: 'folj', farg: 'varning', ikon: 'oga', symbol: 'kvadrat' },
    { ..._STS_ORD.balanserat, niva: 'balanserat', farg: 'ok', ikon: 'bock', symbol: 'cirkel' }
]);
/** Statusen när skillnaden inte kan prövas (ett kön under golvet): grå, ingen allvarlighetsgrad. */
export const GAP_STATUS_EJ = Object.freeze({ ..._STS_ORD.ejbedomd, niva: 'ejbedomd', farg: 'neutral', ikon: 'streck', symbol: 'cirkel' });
/** Alla fyra, i diagrammens ordning (förklaringen namnger bara de som förekommer). */
export const GAP_STATUS_ALLA = Object.freeze([...GAP_STATUS, GAP_STATUS_EJ]);
/**
 * Dimensionerna i figurens urval (figur.urval, se docs/utveckling/diagramkarnan.md): filtren ovanför diagrammet
 * döljer märken, inget räknas om. En dimension ges bara där varje märke hör till ett enda värde (punkten, stapeln,
 * spannet eller lådan bär fältet), så att filtret döljer hela märken.
 *   bas           kategori på `bas` med det nakna värdet (t.ex. 'A'); knapparna heter 'BAS A' …
 *   antal         intervall på `n`: gruppens antal personer, samma tal som i tipset
 *   konsdominans  kategori på `konsdom`: 'Kvinnodominerad', 'Mansdominerad' eller 'Blandad'
 *   matchning     kategori på `matchning`: 'AID + BAS' eller 'Endast AID'
 *   avvikelse     intervall på `x`: avvikelsen i procent
 *   yrkesgrupp    kategori på `yrke` (AID-etiketten som i tipset), visad som lista med sökfält
 *   sektor        kategori på `sektor` (huvudområdets namn som i översikten per huvudområde), visad som lista med sökfält
 *   alder         intervall på `alder`: personens ålder, eller femårsgruppens första år (format ar)
 *   lon           intervall på `lon`: personens månadslön (format kr)
 *   aldersgrupp   kategori på `aldersgrupp`: åldersgruppens namn som i tipset ('30–39 år')
 *   minstaKon     intervall på `nMin`: antalet av det minst företrädda könet i gruppen (det mindre av antalen i tipset)
 *   lonegap       intervall på `gap`: löneskillnaden i procent, samma tal som i tipset
 */
export const URVAL = Object.freeze({
    bas: Object.freeze({ typ: 'kategori', falt: 'bas', namn: stor(T.niva.en), etikett: 'BAS {v}' }),
    antal: Object.freeze({ typ: 'intervall', falt: 'n', namn: 'Antal personer i gruppen', format: 'antal', etikett: '{v} personer i gruppen' }),
    konsdominans: Object.freeze({ typ: 'kategori', falt: 'konsdom', namn: 'Könsdominans', etikett: '{v}' }),
    matchning: Object.freeze({ typ: 'kategori', falt: 'matchning', namn: 'Matchning', etikett: '{v}' }),
    avvikelse: Object.freeze({ typ: 'intervall', falt: 'x', namn: 'Avvikelse (%)', format: 'pct', etikett: 'avvikelse {v}' }),
    yrkesgrupp: Object.freeze({ typ: 'kategori', falt: 'yrke', namn: stor(T.enhet.en), etikett: '{v}', visning: 'lista' }),
    sektor: Object.freeze({ typ: 'kategori', falt: 'sektor', namn: stor(T.huvudomrade.en), etikett: '{v}', visning: 'lista' }),
    alder: Object.freeze({ typ: 'intervall', falt: 'alder', namn: 'Ålder', format: 'ar', etikett: 'ålder {v} år' }),
    lon: Object.freeze({ typ: 'intervall', falt: 'lon', namn: 'Månadslön (kr)', format: 'kr', etikett: 'lön {v}' }),
    aldersgrupp: Object.freeze({ typ: 'kategori', falt: 'aldersgrupp', namn: 'Åldersgrupp', etikett: '{v}' }),
    minstaKon: Object.freeze({ typ: 'intervall', falt: 'nMin', namn: 'Antal av det minsta könet', format: 'antal', etikett: '{v} av det minsta könet' }),
    lonegap: Object.freeze({ typ: 'intervall', falt: 'gap', namn: 'Löneskillnad (%)', format: 'pct', etikett: 'löneskillnad {v}' }),
});
// Dimensionerna i ett underlag (figur.underlag.dimensioner): vad ett sammanfattande diagram kan räknas om för. Värdet
// läses ur personraden med samma gruppnycklar som Tabeller och egna vyer (gruppnyckel i src/lib/falt.js); personerna har
// inget färdigt sektorsfält.
export const UNDERLAG = Object.freeze({
    sektor: Object.freeze({ typ: 'kategori', falt: 'sektor', namn: stor(T.huvudomrade.en), visning: 'lista', varde: r => gruppnyckel(r, 'sektor') }),
    aldersgrupp: Object.freeze({ typ: 'kategori', falt: 'aldersgrupp', namn: 'Åldersgrupp', visning: 'lista', varde: r => gruppnyckel(r, 'alder'), ordning: (a, b) => jamforAldersgrupp(a, b) }),
    yrkesgrupp: Object.freeze({ typ: 'kategori', falt: 'yrke', namn: stor(T.enhet.en), visning: 'lista', varde: r => r.yrke }),
    bas: Object.freeze({ typ: 'kategori', falt: 'bas', namn: stor(T.niva.en), etikett: 'BAS {v}', varde: r => r.bas }),
});
/**
 * Statusen för ett avstånd från lika lön i procent (|100 − kvoten|) och en prövning av skillnaden (true/false; null
 * när den inte kunde göras, vilket ger Går ej att bedöma).
 * @param {number} avstand
 * @param {boolean|null|undefined} sakerstalld
 */
export function gapStatus(avstand, sakerstalld) {
    const niva = statusNiva(avstand, sakerstalld);
    return GAP_STATUS_ALLA.find(s => s.niva === niva) || GAP_STATUS_EJ;
}
/** Statusen för en nivå ('granska', 'folj', 'balanserat', 'ejbedomd'). */
export function gapStatusNiva(niva) { return GAP_STATUS_ALLA.find(s => s.niva === niva) || GAP_STATUS_EJ; }
/** Statusen för en rad med kvot (i %), 95 % KI och antal per kön: KI:t mot 100 % prövar, golvet är statGolv(). */
export function gapStatusKI(o) { return gapStatusNiva(oversiktNiva(o, statGolv())); }

// Gemensamt teckensnitt/typografi för diagram (matchar appens sans-stack).
export const DIAGRAM_TYPSNITT = {
    family: 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    size: 12,
    minsta: 11,            // golvet för de minsta rollerna (punkt- och linjeetiketter, ytans andra rad, fotraden): _rfLitenPx
    color: '#1f2430',
    dampad: '#5b6472'      // axlarnas siffror och rubriker: ett steg lugnare än diagrammets egna etiketter
};

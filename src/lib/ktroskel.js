// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
/**
 * Öppen lönekartläggning — reglerna för vad som får redovisas vid minsta gruppstorlek k (skyddet S4,
 * `docs/utveckling/k-troskeln.md`).
 *
 * Funktionerna tar tröskeln som argument. Vilken tröskel som gäller (den inställda i exportläget, 1 på skärmen; ADR-51)
 * avgör appen: adaptrarna i `src/app/06-k-troskel.js` läser `kTroskel()` eller `kInstalld()` och behåller sina
 * tidigare namn. Stämpeln och texterna om regeln får alltid den inställda tröskeln.
 *
 * Webbläsarbygget får en AUTO-GENERERAD spegel i src/app/09-lib-speglar.js.
 */
import { arKvinna, arMan } from './kon.js';
import { aidAvYrke } from './aid.js';
import { personOrd } from './namn.js';

/** Tröskelns standardvärde och gränser (ADR-38); appen läser dem härifrån. */
export const K_STANDARD = 10;
export const K_MIN = 2;
export const K_MAX = 1000;

/** Golvet för skattningar: aldrig under standardvärdet, och följer en högre inställd tröskel uppåt. */
export function statGolvVid(kInstalld) { return Math.max(kInstalld, K_STANDARD); }

/** Heltal K_MIN–K_MAX ur ett tal eller en sträng, annars null. Bara rena heltal godtas. */
export function kTolka(v) {
    const s = typeof v === 'number' ? String(v) : (typeof v === 'string' ? v.trim() : '');
    if (!/^\d+$/.test(s)) return null;
    const n = Number(s);
    return n >= K_MIN && n <= K_MAX ? n : null;
}

/**
 * Får ett KÖNSUPPDELAT lönemått redovisas (ett köns median eller percentil, ett könsgap, en
 * kostnad som räknats ur ett gap)? Varje kön ska nå tröskeln (ADR-12): annars pekar måttet ut
 * de få i det mindre könet, även när gruppen som helhet är stor nog.
 * @param {number} nKv - Antal kvinnor.
 * @param {number} nMa - Antal män.
 * @param {number} k
 */
export function konFarRedovisas(nKv, nMa, k) {
    return nKv >= k && nMa >= k;
}

/** Antal kvinnor och män i en radmängd (samma könsregler som i övriga verktyget). */
export function konAntal(rader) {
    let nKv = 0, nMa = 0;
    for (const r of rader || []) {
        if (arKvinna(r)) nKv++;
        else if (arMan(r)) nMa++;
    }
    return { nKv, nMa };
}

/** Får könsuppdelade lönemått för hela radmängden redovisas? */
export function konFarRedovisasFor(rader, k) {
    const { nKv, nMa } = konAntal(rader);
    return konFarRedovisas(nKv, nMa, k);
}

/** Meningen där ett könsuppdelat mått för hela urvalet utelämnats (samma ordalydelse som Rapportunderlaget). */
export function konUtelamnatNot(k) {
    return k <= 1 ? 'Könsuppdelade lönemått redovisas inte eftersom ett av könen saknas i urvalet.'
        : `Könsuppdelade lönemått redovisas inte eftersom ett kön har färre än ${k} ${personOrd(k)} i urvalet.`;
}

/**
 * Regressionens råa mediangap som text. Regressionen själv har ett fast golv (5 per kön, ADR-38),
 * men det råa gapet är ett beskrivande könsuppdelat mått och följer tröskeln: under den står ett
 * streck med förklaring.
 * @param {any} reg  regressionsresultatet (rawGapPct, nKvAnalysed, nMaAnalysed …)
 * @param {(v:number)=>string} fmt
 * @param {number} k
 */
export function raGapText(reg, fmt, k) {
    if (!reg || reg.rawGapPct == null) return '–';
    return konFarRedovisas(reg.nKvAnalysed, reg.nMaAnalysed, k) ? fmt(reg.rawGapPct) : (k <= 1 ? '– (ett av könen saknas)' : `– (ett kön har färre än ${k} ${personOrd(k)})`);
}

/**
 * Regressionens stegvisa uppdelning så som den får redovisas. Första steget ("Endast kön") är
 * skillnaden mellan könens geometriska medellöner utan någon kontroll — ett beskrivande
 * könsuppdelat mått som följer tröskeln, liksom allt som räknats ur det (förklarad andel,
 * förklaringsbudgeten). Det justerade gapet berörs inte: det visas från regressionens eget golv
 * (5 per kön, ADR-38). Beräkningen ändras inte; bara vad som visas.
 * @param {any} reg  regressionsresultatet (sequential, explainedShare, nKvAnalysed, nMaAnalysed …)
 * @param {number} k
 * @returns {{steg:Array, explainedShare:number|null, utelamnat:boolean, not:string}}
 */
export function regStegForRedovisning(reg, k) {
    const alla = (reg && reg.sequential) || [];
    if (!reg || konFarRedovisas(reg.nKvAnalysed, reg.nMaAnalysed, k)) {
        return { steg: alla, explainedShare: reg ? reg.explainedShare : null, utelamnat: false, not: '' };
    }
    return {
        steg: alla.filter(s => s.name !== 'Endast kön'),
        explainedShare: null,
        utelamnat: true,
        not: `Det ojusterade steget (endast kön) och den förklarade andelen visas inte eftersom ett kön har färre än ${k} ${personOrd(k)} i modellen.`
    };
}

/**
 * Regressionens BAS-effekter så som de får redovisas (ADR-70, beslut 2026-11-14). Effekten för ett BAS-intervall med
 * färre personer än tröskeln ligger nära deras genomsnittliga lönenivå: den skrivs inte ut, och intervallet namnges i
 * noten (redovisningsformen i ADR-12). Är referensintervallet självt under tröskeln beskriver varje effekt dess nivå
 * baklänges; då skrivs ingen effekt ut. Modellen och dess referens (ADR-44) ändras inte; bara vad som visas. På
 * skärmen är tröskeln 1 och allt visas (ADR-51).
 * @param {any} reg  regressionsresultatet (basEffekter, basRef, basN)
 * @param {number} k
 * @param {(utelamnade:string[]) => string} maskNot  noten om utelämnade intervall (appen skriver den med sina termer)
 * @returns {{effekter: Array|null, utelamnade: string[], referensUtelamnad: boolean, not: string}}
 *   effekter är null när modellen inte har BAS-effekter; noten är text utan markup.
 */
export function basEffekterForRedovisning(reg, k, maskNot) {
    const alla = reg && reg.basEffekter;
    if (!alla) return { effekter: null, utelamnade: [], referensUtelamnad: false, not: '' };
    const n = b => (reg.basN && reg.basN[b]) || 0;
    if (reg.basRef != null && n(reg.basRef) < k) {
        return { effekter: [], utelamnade: alla.map(e => e.bas), referensUtelamnad: true,
            not: `BAS-effekterna visas inte här: referensintervallet, BAS ${reg.basRef}, har färre än ${k} ${personOrd(k)}, och varje effekt mot det skulle visa dess lönenivå. Personerna ingår fortfarande i modellen.` };
    }
    const utelamnade = alla.filter(e => n(e.bas) < k).map(e => e.bas);
    return { effekter: alla.filter(e => !(n(e.bas) < k)), utelamnade, referensUtelamnad: false,
        not: utelamnade.length ? maskNot(utelamnade) : '' };
}

/** Når båda yrkesgrupperna i paret gränsen k? Ett jämförelseyrke ur statistiken (maN saknas) prövas inte. */
export function parNarK(p, k) {
    return p.kvN >= k && (p.maN == null || p.maN >= k);
}

/** Mening om par som utelämnats ur underlaget (samma ordalydelse som Rapportunderlaget). */
export function parUtelamnadeNot(antal, k) {
    return antal ? `${antal} par med en grupp under ${k} ${personOrd(k)} redovisas inte här.` : '';
}

/**
 * Delar en lista § 3:10-par i de som får redovisas utanför fliken Likvärdigt arbete och antalet som
 * utelämnas. `not` är meningen om de utelämnade (tom när inga utelämnats). Ordningen bevaras och
 * objekten är desamma som i indata.
 * @param {any[]|undefined} allaPar
 * @param {number} k
 */
export function parForRedovisning(allaPar, k) {
    const alla = allaPar || [];
    const par = alla.filter(p => parNarK(p, k));
    const utelamnade = alla.length - par.length;
    return { par, utelamnade, not: parUtelamnadeNot(utelamnade, k) };
}

/** Raden som anger den inställda tröskeln (stämpeln), på de utdata som bär den. */
export function kStampelVid(kInstalld) {
    return `Minsta gruppstorlek för redovisning: ${kInstalld}.`
        + (kInstalld < K_STANDARD ? ` Tröskeln är sänkt från standardvärdet ${K_STANDARD}.` : '');
}

/**
 * Tillägget för en export som medvetet kan innehålla grupper under tröskeln (dokumenterade
 * undantag: Likvärdigt arbete, och Utforska när användaren kryssat i det). Utan tillägget läses
 * stämpeln som ett löfte om att filen saknar sådana grupper.
 */
export function kUndantagNot(undantag) {
    return undantag ? `Den här filen kan även innehålla grupper under tröskeln (undantag: ${undantag}).` : '';
}

/** Stämpeln, med tillägget om undantag när exporten hör till ett. */
export function kStampelForVid(undantag, kInstalld) {
    return undantag ? `${kStampelVid(kInstalld)} ${kUndantagNot(undantag)}` : kStampelVid(kInstalld);
}

/** Stämpeln när tröskeln är sänkt under standard, annars tom sträng. */
export function kSanktNot(kInstalld) { return kInstalld < K_STANDARD ? kStampelVid(kInstalld) : ''; }

/** Sidfot med tillägg när tröskeln är sänkt under standard. */
export function kSidfot(text, kInstalld) {
    return kInstalld < K_STANDARD ? `${text} · minsta gruppstorlek ${kInstalld} (standard ${K_STANDARD})` : text;
}

const harStampel = rows => rows.some(r => Array.isArray(r) && typeof r[0] === 'string' && r[0].includes('Minsta gruppstorlek för redovisning'));
/** Tabell-CSV: stämpeln som sista rad, om den inte redan står i raderna (diagramdata). */
export function csvMedStampel(rader, undantag, kInstalld) {
    return harStampel(rader) ? rader : [...rader, [], [kStampelForVid(undantag, kInstalld)]];
}
/** Tabell till urklipp: stämpeln bara när tröskeln är sänkt eller exporten hör till ett undantag. */
export function tsvMedStampel(rader, undantag, kInstalld) {
    return (kSanktNot(kInstalld) || undantag) && !harStampel(rader) ? [...rader, [], [kStampelForVid(undantag, kInstalld)]] : rader;
}

/** Byter {k} mot den inställda tröskeln och {golv} mot det statistiska golvet. */
export function kText(s, kInstalld) {
    return String(s ?? '').replace(/\{k\}/g, String(kInstalld)).replace(/\{golv\}/g, String(statGolvVid(kInstalld)));
}

/**
 * En punkt per person (spridningsdiagrammen lön mot ålder) röjer personens lön tillsammans med yrke och BAS.
 * Punkten är därför liten — den ritas inte och exporteras inte — när personens grupp (AID-koden inom BAS-intervallet,
 * samma indelning som gruppdossiern) har färre än k, eller när personens kön har det i gruppen (ADR-12).
 * Antalen räknas på hela underlaget, inte på det urval diagrammet visar.
 * @param {any[]} rader
 * @param {number} k
 * @returns {(rad:any) => boolean} sant om radens punkt är liten
 */
export function individLitenForVid(rader, k) {
    const grupp = r => `${aidAvYrke(r.yrke)}|${r.bas}`;
    const konAv = r => (arKvinna(r) ? 'kv' : (arMan(r) ? 'ma' : 'ovr'));
    const n = new Map();
    for (const r of rader) {
        if (!(r.lon > 0) || !r.bas) continue;
        const g = grupp(r);
        n.set(g, (n.get(g) || 0) + 1);
        n.set(`${g}|${konAv(r)}`, (n.get(`${g}|${konAv(r)}`) || 0) + 1);
    }
    return r => (n.get(grupp(r)) || 0) < k || (n.get(`${grupp(r)}|${konAv(r)}`) || 0) < k;
}

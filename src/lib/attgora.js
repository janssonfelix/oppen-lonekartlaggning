// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
/**
 * Öppen lönekartläggning — regler för Att göra och processöversikten (ADR-29).
 *
 * Ren logik utan DOM och state: vilka punkter som visas under Börja här och när ett
 * analyssteg i processöversikten räknas som klart. Appen (18-atgardslista.js,
 * 13-oversikt.js) bygger punkterna och skickar in dem.
 *
 * Webbläsarbygget får en AUTO-GENERERAD spegel i src/app/09-lib-speglar.js.
 */

/** Kategorier för fynd som gäller skillnader mellan kvinnor och män (lagkravet). */
export const KONSRELATERADE = ['Lika arbete', 'EU 2023/970', 'Likvärdigt arbete'];

const PRIORITET = { 'hög': 0, medel: 1, 'låg': 2 };

/**
 * Rang inom samma prioritet: underlaget först (fel i data påverkar allt), sedan de
 * könsrelaterade fynden, sist avvikelser mot lönepolitiken och övriga iakttagelser.
 */
export function attGoraRang(punkt) {
    if (/^(Underlag|Datakvalitet)/.test(punkt.kategori)) return 0;
    return KONSRELATERADE.includes(punkt.kategori) ? 1 : 2;
}

/**
 * Börja här: de första ej avbockade punkterna, i ordningen prioritet → rang → ursprunglig.
 * @param {Array<{id:string, kategori:string, prioritet:string, [k:string]:any}>} punkter
 * @param {Set<string>} klar  id för avbockade punkter
 */
export function borjaHar(punkter, klar, antal = 3) {
    return punkter.map((punkt, i) => ({ punkt, i })).filter(x => !klar.has(x.punkt.id))
        .sort((a, b) => (PRIORITET[a.punkt.prioritet] ?? 3) - (PRIORITET[b.punkt.prioritet] ?? 3)
            || attGoraRang(a.punkt) - attGoraRang(b.punkt) || a.i - b.i)
        .slice(0, antal).map(x => x.punkt);
}

/** Antal punkter (t) och antal avbockade (d) inom kategorierna. */
export function hanterade(punkter, klar, kategorier) {
    const egna = punkter.filter(punkt => kategorier.includes(punkt.kategori));
    return { t: egna.length, d: egna.filter(punkt => klar.has(punkt.id)).length };
}

/** Steg 3, Lika arbete: klart när regressionen gått att köra och alla punkter är hanterade. */
export function stegLikaArbete({ regressionOk, t, d }) {
    if (!regressionOk) return { status: 'delvis', detail: 'Underlaget räcker ännu inte för en tillförlitlig regression.' };
    return {
        status: d >= t ? 'klar' : 'delvis',
        detail: t ? `Oförklarat gap beräknat · ${d} av ${t} punkter hanterade i Att göra.`
                  : 'Oförklarat gap beräknat — inga punkter att förklara eller åtgärda.',
    };
}

/**
 * Steg 4, Likvärdigt arbete: klart när analysen inte hittar par, eller när alla par är hanterade. Finns bara par
 * med en grupp under minsta gruppstorlek (`utelamnade`, de redovisas bara i fliken Likvärdigt arbete) finns inget
 * att hantera i Att göra — men steget är inte klart: tillståndet `inget` pekar till fliken (beslut av
 * produktägaren 2026-10-16).
 */
export function stegLikvardigt({ analys, antalPar, utelamnade = 0, k, t, d }) {
    if (!analys) return { status: 'ej', detail: 'Granska likvärdiga arbeten på fliken.' };
    if (antalPar === 0 && utelamnade > 0) {
        return { status: 'inget', detail: `Inget att hantera i Att göra: ${utelamnade} par har en grupp under ${k != null ? `${k} personer` : 'minsta gruppstorlek'} och redovisas bara i fliken Likvärdigt arbete — gå till steget för att granska dem.` };
    }
    if (antalPar === 0) return { status: 'klar', detail: 'Analysen körd — inga kandidatpar utifrån nuvarande trösklar.' };
    return {
        status: t > 0 && d >= t ? 'klar' : 'delvis',
        detail: `${antalPar} kandidatpar (kvinnodominerade mot likvärdiga yrken) · ${d} av ${t} kandidatpar hanterade i Att göra.`,
    };
}

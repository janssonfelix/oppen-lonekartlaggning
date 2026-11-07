// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
/**
 * Öppen lönekartläggning — sakliga skäl som strukturerad post.
 *
 * Handlingsplanen (56-handlingsplan.js) låter organisationen ange sakliga skäl per grupp: kategori, belopp i kronor
 * per månad av gruppens medianskillnad och en kort kommentar. Modulen är ren: kategorierna, valideringen av en lista
 * med skäl, sammanställningen för en rad (andel, summa, återstår) och summan per kategori över raderna. Andelarna är
 * organisationens bedömning; verktyget räknar bara ihop dem. Ingen DOM, inget state.
 *
 * Webbläsarbygget får en AUTO-GENERERAD spegel i src/app/09-lib-speglar.js.
 */

/** Kategorierna i fast ordning (rullistan, tabellerna och årsjämförelsen följer den). */
export const SKAL_KATEGORIER = Object.freeze([
    Object.freeze({ id: 'marknad', namn: 'Marknad', forklaring: 'Svårrekryterade yrken eller konkurrens från andra arbetsgivare.' }),
    Object.freeze({ id: 'utbildning', namn: 'Utbildning', forklaring: 'Formell utbildning utöver vad arbetet kräver.' }),
    Object.freeze({ id: 'erfarenhet', namn: 'Erfarenhet', forklaring: 'Dokumenterad yrkeserfarenhet eller tid i arbetet.' }),
    Object.freeze({ id: 'prestation', namn: 'Prestation och resultat', forklaring: 'Bedömd prestation enligt organisationens lönekriterier.' }),
    Object.freeze({ id: 'overgang', namn: 'Övergång', forklaring: 'Lön som följt med vid byte av tjänst, omorganisation eller verksamhetsövergång.' }),
    Object.freeze({ id: 'annat', namn: 'Annat sakligt skäl', forklaring: 'Beskriv i kommentaren.' }),
]);

/** Gränserna för ett skäl: belopp i hela kronor per månad, kommentarens längd och antalet skäl per rad. */
export const SKAL_GRANSER = Object.freeze({ maxBelopp: 200000, maxKommentar: 200, maxAntal: 8 });

/** @type {Map<string, string>} */
const _namn = new Map(SKAL_KATEGORIER.map(k => [k.id, k.namn]));

/** Kategorierna som en ny lista (appen bygger rullistan av den). */
export function skalKategorier() {
    return SKAL_KATEGORIER.map(k => ({ ...k }));
}

/**
 * Prövar en lista med skäl. Ett skäl med okänd kategori, ett belopp som inte är ett heltal 0–200 000 eller en
 * kommentar som inte är text eller är längre än 200 tecken faller bort; av de giltiga står de åtta första kvar.
 * `bort` är antalet som föll bort (en lista som inte är en lista räknas som ett). Saknas fältet (null) är listan tom.
 * @param {any} lista
 * @returns {{skal: {kategori: string, belopp: number, kommentar: string}[], bort: number}}
 */
export function valideraSkal(lista) {
    if (lista == null) return { skal: [], bort: 0 };
    if (!Array.isArray(lista)) return { skal: [], bort: 1 };
    const giltiga = [];
    let bort = 0;
    for (const s of lista) {
        const ok = s && typeof s === 'object' && _namn.has(s.kategori)
            && Number.isInteger(s.belopp) && s.belopp >= 0 && s.belopp <= SKAL_GRANSER.maxBelopp
            && (s.kommentar == null || (typeof s.kommentar === 'string' && s.kommentar.length <= SKAL_GRANSER.maxKommentar));
        if (ok) giltiga.push({ kategori: s.kategori, belopp: s.belopp, kommentar: s.kommentar || '' });
        else bort++;
    }
    bort += Math.max(0, giltiga.length - SKAL_GRANSER.maxAntal);
    return { skal: giltiga.slice(0, SKAL_GRANSER.maxAntal), bort };
}

/** En skillnad som andelar kan räknas mot: ett ändligt tal över 0, annars null. */
const _namnare = v => (typeof v === 'number' && isFinite(v) && v > 0 ? v : null);

/**
 * Sammanställningen för en rad: varje skäl med kategorins namn och andel av skillnaden, summan, den förklarade
 * andelen och det som återstår (aldrig under 0; `overstiger` när skälen är större än skillnaden). Utan en skillnad
 * över 0 (en egen rad, eller kvinnornas median högre) räknas inga andelar; skillnaden står kvar som den kom in.
 * @param {{kategori: string, belopp: number, kommentar?: string}[]|null|undefined} skal
 * @param {number|null} skillnadKr gruppens medianskillnad i kronor per månad
 */
export function skalSammanstallning(skal, skillnadKr) {
    const lista = Array.isArray(skal) ? skal : [];
    const n = _namnare(skillnadKr);
    const rader = lista.map(s => ({ ...s, namn: _namn.get(s.kategori) || s.kategori, andel: n ? s.belopp / n : null }));
    const summa = lista.reduce((t, s) => t + s.belopp, 0);
    const aterstar = n ? Math.max(0, n - summa) : null;
    return {
        skal: rader, antal: rader.length, summa,
        skillnadKr: typeof skillnadKr === 'number' && isFinite(skillnadKr) ? skillnadKr : null,
        forklaradAndel: n ? summa / n : null,
        aterstar, aterstarAndel: n ? /** @type {number} */ (aterstar) / n : null,
        overstiger: n != null && summa > n,
    };
}

/**
 * Summan per kategori över raderna som har minst ett skäl. Andelen är kategorins belopp i rader med en skillnad över
 * 0 delat med den totala skillnaden i de raderna; en rad utan skillnad bidrar bara till summan. Kategorierna i
 * listans ordning, bara de som används. `antalGrupper` per kategori: rader med minst ett skäl i den.
 * @param {{skal: {kategori: string, belopp: number}[], skillnadKr: number|null}[]|null|undefined} rader
 */
export function skalPerKategori(rader) {
    const med = (Array.isArray(rader) ? rader : []).filter(r => r && Array.isArray(r.skal) && r.skal.length);
    const per = new Map();
    let skillnad = 0, summa = 0, summaMedSkillnad = 0;
    for (const r of med) {
        const n = _namnare(r.skillnadKr);
        if (n) skillnad += n;
        const sett = new Set();
        for (const s of r.skal) {
            if (!per.has(s.kategori)) per.set(s.kategori, { summa: 0, medSkillnad: 0, grupper: 0 });
            const k = per.get(s.kategori);
            k.summa += s.belopp; summa += s.belopp;
            if (n) { k.medSkillnad += s.belopp; summaMedSkillnad += s.belopp; }
            if (!sett.has(s.kategori)) { sett.add(s.kategori); k.grupper++; }
        }
    }
    const kategorier = SKAL_KATEGORIER.filter(k => per.has(k.id)).map(k => {
        const p = per.get(k.id);
        return { kategori: k.id, namn: k.namn, summa: p.summa, andel: skillnad > 0 ? p.medSkillnad / skillnad : null, antalGrupper: p.grupper };
    });
    return { kategorier, antalGrupper: med.length, skillnadKr: skillnad, summa, andel: skillnad > 0 ? summaMedSkillnad / skillnad : null };
}

// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
/**
 * Öppen lönekartläggning — Tabellerna per AID-kod och BAS-intervall
 *
 * Lika arbete är samma yrkesgrupp (AID-kod) på samma nivå (BAS-intervall). Här byggs de fyra tabeller som en
 * skriven lönekartläggning behöver på den nivån, ur varje persons egen rad:
 *
 *   1. Lika arbete AID x BAS — kvinnors median i procent av mäns per grupp, mot slumpens gränser
 *   2. Likvärdigt arbete — grupperna per BAS-intervall med könsfördelning, klassning, median och lönespridning
 *   3. Hierarkisk jämförelse — ett arbete i lägre BAS som inte är kvinnodominerat men har högre median än ett
 *      kvinnodominerat arbete i högre BAS
 *   4. Analys på individnivå — grupperna där något kön är för litet för en könsuppdelad jämförelse
 *
 * Reglerna för små grupper följer med som parametrar: `k` är antalet per kön (och per grupp i tabell 2 och 3) som
 * krävs för ett lönemått, `golv` är antalet i gruppen som krävs för en egen rad; mindre grupper räknas upp i `sma`.
 *
 * Klassningen av kvinnodominerat arbete har två definitioner, som heter efter lydelsen (ADR-72): *Mer än X %*
 * (nyckeln 'do') och *X % eller mer* (nyckeln 'scb'). Gränsen X är 60 % om inget annat anges. Mansdominerat
 * speglas; övriga är könsblandade.
 *
 * Ren modul utan DOM eller state. Webbläsarbygget får en AUTO-GENERERAD spegel i src/app/09-lib-speglar.js.
 */
import { median, quantile } from './stat.js';
import { basRangFn, konsklass } from './likvardighet.js';

/**
 * Definitionerna av kvinnodominerat arbete: nyckel → namn (valet i inställningarna) och text (tabellerna och
 * metodbladet). Namnen säger lydelsen, inte en avsändare (ADR-72). Nycklarna 'do' och 'scb' är historiska och står
 * kvar, så att sparade konfigurationsfiler (`likvardighet.kvDomDefinition`) fortsätter att läsas.
 */
export const KV_DEFINITIONER = Object.freeze({
    do: Object.freeze({ namn: 'Mer än {grans} %', text: 'mer än {grans} % kvinnor' }),
    scb: Object.freeze({ namn: '{grans} % eller mer', text: '{grans} % kvinnor eller mer' })
});
export const KV_GRANS_STANDARD = 60;

export const KLASS_KV = 'Kvinnodominerad', KLASS_MA = 'Mansdominerad', KLASS_BLANDAD = 'Könsblandad';
export const BEDOMNING_INOM = 'Inom gränserna', BEDOMNING_UTANFOR = 'Utanför gränserna', BEDOMNING_INDIVID = 'Analyseras på individnivå';
export const INGA_HIERARKISKA_PAR = 'Inga fall där ett arbete med lägre krav, som inte är kvinnodominerat, har högre lön än ett kvinnodominerat arbete med högre krav.';

/** Definitionens namn, med gränsen insatt: "Mer än 60 %" eller "60 % eller mer". */
export function kvDefinitionNamn(definition, grans = KV_GRANS_STANDARD) {
    return (KV_DEFINITIONER[definition] || KV_DEFINITIONER.do).namn.replace('{grans}', String(grans));
}
/** Klassernas namn, för den som jämför klassningen. */
export function klassNamn() { return { kv: KLASS_KV, ma: KLASS_MA, blandad: KLASS_BLANDAD }; }
/** Texten när den hierarkiska jämförelsen inte har några par. */
export function ingaParText() { return INGA_HIERARKISKA_PAR; }
/** Texten för definitionen, med gränsen insatt: "mer än 60 % kvinnor" eller "60 % kvinnor eller mer". */
export function kvDefinitionText(definition, grans = KV_GRANS_STANDARD) {
    return (KV_DEFINITIONER[definition] || KV_DEFINITIONER.do).text.replace('{grans}', String(grans));
}

/**
 * Klassningen av en grupp efter andelen kvinnor.
 * @param {number|null} andelKv - procent kvinnor, eller null när andelen är okänd
 * @param {'do'|'scb'} [definition]
 * @param {number} [grans]
 * @returns {string} Kvinnodominerad, Mansdominerad, Könsblandad eller '' för okänd andel
 */
export function dominans(andelKv, definition = 'do', grans = KV_GRANS_STANDARD) {
    // Samma definition som likvärdighetsanalysen (ADR-60): konsklass i likvardighet.js.
    const k = konsklass(andelKv, definition, grans);
    return k === 'kvinnodominerad' ? KLASS_KV : k === 'mansdominerad' ? KLASS_MA : k === 'blandad' ? KLASS_BLANDAD : '';
}

/**
 * Om en grupp med klassen `klass` är ett jämförelseyrke (ADR-60): alla som inte är kvinnodominerade, eller bara de
 * mansdominerade när filtret `jamforelse` är 'mansdominerade'. Samma mängd som kandidatparen i Likvärdigt arbete.
 * @param {string} klass
 * @param {'alla'|'mansdominerade'|string} [jamforelse]
 */
export function arJamforelseKlass(klass, jamforelse = 'alla') {
    if (!klass || klass === KLASS_KV) return false;
    return jamforelse === 'mansdominerade' ? klass === KLASS_MA : true;
}

const arKv = r => typeof r.kon === 'string' && r.kon.includes('kvinna');
const arMa = r => r.kon === 'man' || r.kon === 'män';

/**
 * Grupperar raderna per AID-kod och BAS-intervall, hämtade ur varje persons egen rad. Rader utan lön, kön eller
 * BAS räknas inte. Rader utan AID-kod grupperas på yrkestexten.
 * @param {Array<{aid?:string, bas:string, kon:string, lon:number, yrke?:string, yrkeLabel?:string}>} rader
 * @returns {Array<{aid:string, bas:string, yrke:string, n:number, nKv:number, nMa:number, kvLoner:number[], maLoner:number[], loner:number[]}>}
 */
export function grupperaAidBas(rader) {
    const map = new Map();
    for (const r of rader || []) {
        if (!r || !r.bas || !(r.lon > 0)) continue;
        const kv = arKv(r), ma = arMa(r);
        if (!kv && !ma) continue;
        const aid = String(r.aid || r.yrke || '').trim();
        if (!aid) continue;
        const key = `${aid}|${r.bas}`;
        if (!map.has(key)) map.set(key, { aid, bas: String(r.bas), yrke: String(r.yrkeLabel || r.yrke || aid), n: 0, nKv: 0, nMa: 0, kvLoner: [], maLoner: [], loner: [] });
        const g = map.get(key);
        g.n++;
        if (kv) { g.nKv++; g.kvLoner.push(r.lon); } else { g.nMa++; g.maLoner.push(r.lon); }
        g.loner.push(r.lon);
    }
    return [...map.values()];
}

/** Sorterar grupper: BAS-intervall stigande (bokstavsordningen), därefter antal fallande, därefter AID-kod. */
export function sorteraGrupper(grupper) {
    const rang = basRangFn(grupper.map(g => g.bas));
    return [...grupper].sort((a, b) => rang(a.bas) - rang(b.bas) || b.n - a.n || String(a.aid).localeCompare(String(b.aid), 'sv'));
}

const litenRad = g => ({ bas: g.bas, aid: g.aid, yrke: g.yrke, n: g.n, nKv: g.nKv, nMa: g.nMa });
/** Delar grupperna i de som får en egen rad (minst `golv` personer) och de som räknas upp i noten. */
function _delaPaGolv(grupper, golv) {
    const sorterade = sorteraGrupper(grupper);
    return { rader: sorterade.filter(g => g.n >= golv), sma: sorterade.filter(g => g.n < golv).map(litenRad) };
}

/**
 * Tabell 1 — Lika arbete AID x BAS.
 * @param {Array} rader - personraderna
 * @param {{k?:number, golv?:number, granser?: ((g:any) => ({lag:number, hog:number}|null))|null}} val
 *   `granser` ger slumpens 95-procentiga gränser för gruppen (kvinnors median i % av mäns), räknade av anroparen med
 *   samma metod som trattdiagrammet; anropas bara för grupper där båda könen når k.
 */
export function likaArbeteTabell(rader, { k = 10, golv = 5, granser } = {}) {
    const { rader: grupper, sma } = _delaPaGolv(grupperaAidBas(rader), golv);
    const ut = grupper.map(g => {
        const bada = g.nKv >= k && g.nMa >= k;
        /** @type {{bas:string, aid:string, yrke:string, n:number, nKv:number, nMa:number, medKv:number|null, medMa:number|null, kvot:number|null, lag:number|null, hog:number|null, bedomning:string}} */
        const rad = { bas: g.bas, aid: g.aid, yrke: g.yrke, n: g.n, nKv: g.nKv, nMa: g.nMa, medKv: null, medMa: null, kvot: null, lag: null, hog: null, bedomning: BEDOMNING_INDIVID };
        if (!bada) return rad;
        rad.medKv = median(g.kvLoner); rad.medMa = median(g.maLoner);
        rad.kvot = rad.medMa > 0 ? rad.medKv / rad.medMa * 100 : null;
        const gr = typeof granser === 'function' ? granser(g) : null;
        if (gr && isFinite(gr.lag) && isFinite(gr.hog) && rad.kvot != null) {
            rad.lag = gr.lag; rad.hog = gr.hog;
            rad.bedomning = rad.kvot < gr.lag || rad.kvot > gr.hog ? BEDOMNING_UTANFOR : BEDOMNING_INOM;
        } else rad.bedomning = '';   // gränserna kunde inte räknas (t.ex. ingen spridning i underlaget)
        return rad;
    });
    return { rader: ut, sma };
}

/**
 * Tabell 2 — Likvärdigt arbete: grupperna per BAS-intervall med könsfördelning och klassning, och sammanfattningen
 * per intervall där det finns både kvinnodominerade grupper och andra grupper med median.
 * @param {Array} rader
 * @param {{k?:number, golv?:number, definition?:'do'|'scb', grans?:number, jamforelse?:'alla'|'mansdominerade', nationell?: ((aid:string) => (number|null))|null}} val
 *   `nationell` ger andelen kvinnor nationellt för en AID-kod (procent), eller null när den saknas.
 *   `jamforelse` avgör vilka grupper som räknas som övriga i sammanfattningen (ADR-60).
 */
export function likvardigtTabell(rader, { k = 10, golv = 5, definition = 'do', grans = KV_GRANS_STANDARD, jamforelse = 'alla', nationell = null } = {}) {
    const { rader: grupper, sma } = _delaPaGolv(grupperaAidBas(rader), golv);
    const ut = grupper.map(g => {
        const andelKv = g.nKv / g.n * 100;
        const nat = typeof nationell === 'function' ? nationell(g.aid) : null;
        const andelKvNat = typeof nat === 'number' && isFinite(nat) ? nat : null;
        const stor = g.n >= k;
        const med = stor ? median(g.loner) : null, p10 = stor ? quantile(g.loner, 0.1) : null, p90 = stor ? quantile(g.loner, 0.9) : null;
        const spridning = med != null && p10 != null && p90 != null && med > 0 ? (p90 - p10) / med : null;
        return { bas: g.bas, aid: g.aid, yrke: g.yrke, n: g.n, nKv: g.nKv, nMa: g.nMa, andelKv, andelKvNat,
                 klass: dominans(andelKv, definition, grans),
                 brukar: andelKvNat == null ? '' : dominans(andelKvNat, definition, grans) === KLASS_KV ? 'Ja' : 'Nej',
                 median: med, p10, p90, spridning };
    });
    // Sammanfattningen: högsta och lägsta median bland de kvinnodominerade och bland övriga, per BAS-intervall.
    const sammanfattning = [];
    for (const bas of [...new Set(ut.map(r => r.bas))]) {
        const medMedian = ut.filter(r => r.bas === bas && r.median != null);
        const kvDom = medMedian.filter(r => r.klass === KLASS_KV).map(r => /** @type {number} */ (r.median)), ovriga = medMedian.filter(r => arJamforelseKlass(r.klass, jamforelse)).map(r => /** @type {number} */ (r.median));
        if (!kvDom.length || !ovriga.length) continue;
        const kvHogst = Math.max(...kvDom), ovHogst = Math.max(...ovriga);
        sammanfattning.push({ bas, antalKvDom: kvDom.length, antalOvriga: ovriga.length,
            kvDom: { hogst: kvHogst, lagst: Math.min(...kvDom) }, ovriga: { hogst: ovHogst, lagst: Math.min(...ovriga) },
            skillnadKr: ovHogst - kvHogst, skillnadPct: kvHogst > 0 ? (ovHogst / kvHogst - 1) * 100 : null });
    }
    return { rader: ut, sma, sammanfattning, definition, grans, jamforelse };
}

/**
 * Tabell 3 — Hierarkisk jämförelse: par (A, B) där A inte är kvinnodominerad, B är kvinnodominerad, A har lägre
 * BAS-intervall än B och A har högre median än B. Båda grupperna har minst k personer. Sorterat på skillnaden, störst först.
 * @param {Array} rader
 * A är ett jämförelseyrke enligt `jamforelse` (ADR-60): standard alla som inte är kvinnodominerade.
 * @param {{k?:number, definition?:'do'|'scb', grans?:number, jamforelse?:'alla'|'mansdominerade'}} val
 */
export function hierarkiskaPar(rader, { k = 10, definition = 'do', grans = KV_GRANS_STANDARD, jamforelse = 'alla' } = {}) {
    const grupper = grupperaAidBas(rader).filter(g => g.n >= k)
        .map(g => ({ aid: g.aid, bas: g.bas, yrke: g.yrke, n: g.n, median: median(g.loner), klass: dominans(g.nKv / g.n * 100, definition, grans) }));
    const rang = basRangFn(grupper.map(g => g.bas));
    const par = [];
    for (const a of grupper.filter(g => arJamforelseKlass(g.klass, jamforelse))) {
        for (const b of grupper.filter(g => g.klass === KLASS_KV)) {
            if (rang(a.bas) < rang(b.bas) && a.median > b.median) {
                par.push({ a, b, skillnadKr: a.median - b.median, skillnadPct: b.median > 0 ? (a.median / b.median - 1) * 100 : null });
            }
        }
    }
    return par.sort((x, y) => y.skillnadKr - x.skillnadKr || rang(x.a.bas) - rang(y.a.bas) || String(x.a.aid).localeCompare(String(y.a.aid), 'sv'));
}

/**
 * Tabell 4 — Analys på individnivå: grupperna där något kön har färre än k personer. Inga löner.
 * @param {Array} rader
 * @param {{k?:number, golv?:number}} val
 */
export function individnivaTabell(rader, { k = 10, golv = 5 } = {}) {
    const { rader: grupper, sma } = _delaPaGolv(grupperaAidBas(rader).filter(g => g.nKv < k || g.nMa < k), golv);
    return { rader: grupper.map(litenRad), sma };
}

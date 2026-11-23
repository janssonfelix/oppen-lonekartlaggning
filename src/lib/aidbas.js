// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
/**
 * Öppen lönekartläggning — Tabellerna per AID-kod och BAS-intervall
 *
 * Lika arbete är samma yrkesgrupp (AID-kod) på samma nivå (BAS-intervall). Här byggs de fyra tabeller som en
 * skriven lönekartläggning behöver på den nivån, ur varje persons egen rad:
 *
 *   1. Lika arbete AID x BAS — Lika arbetes grupper med status, i BAS-ordning (ADR-90)
 *   2. Likvärdigt arbete — grupperna per BAS-intervall med könsfördelning, klassning, median och lönespridning
 *   3. Hierarkisk jämförelse — ett arbete i lägre BAS som inte är kvinnodominerat men har högre median än ett
 *      kvinnodominerat arbete i högre BAS
 *   4. Analys på individnivå — grupperna där något kön är för litet för en könsuppdelad jämförelse
 *
 * I tabell 2–4 följer reglerna för små grupper med som parametrar: `k` är antalet per kön (och per grupp i tabell 2 och
 * 3) som krävs för ett lönemått, `golv` är antalet i gruppen som krävs för en egen rad; mindre grupper räknas upp i
 * `sma`. Tabell 1 har Lika arbetes grupper och regler (likaArbeteTabell).
 *
 * Klassningen av kvinnodominerat arbete har två definitioner, som heter efter lydelsen (ADR-72): *Mer än X %*
 * (nyckeln 'do') och *X % eller mer* (nyckeln 'scb'). Gränsen X är 60 % om inget annat anges. Mansdominerat
 * speglas; övriga är könsblandade.
 *
 * Ren modul utan DOM eller state.
 */
import { median, kvantil } from './stat.js';
import { basRangordning, konsklass } from './likvardighet.js';
import { arKvinna, arMan } from './kon.js';
import { namnrader } from './aid.js';

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
export const INGA_HIERARKISKA_PAR = 'Inga fall där ett arbete med lägre krav, som inte är kvinnodominerat, har högre lön än ett kvinnodominerat arbete med högre krav.';

/** Definitionens namn, med gränsen insatt: "Mer än 60 %" eller "60 % eller mer". */
export function kvDefinitionNamn(definition, grans = KV_GRANS_STANDARD) {
    return (KV_DEFINITIONER[definition] || KV_DEFINITIONER.do).namn.replace('{grans}', String(grans));
}
/** Klassernas namn, för den som jämför klassningen. */
export function klassNamn() { return { kv: KLASS_KV, ma: KLASS_MA, blandad: KLASS_BLANDAD }; }
/** Texten när den hierarkiska jämförelsen inte har några par. */
export function ingaParText() { return INGA_HIERARKISKA_PAR; }
/**
 * Texten för definitionen, med gränsen insatt: "mer än 60 % kvinnor" eller "60 % kvinnor eller mer".
 * @param {string} definition - 'do' eller 'scb'
 * @param {number|string} [grans] - gränsen, eller gränsen redan formaterad som text (rapportunderlaget, appen)
 */
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

const arKv = arKvinna;
const arMa = arMan;

/**
 * Grupperar raderna per AID-kod och BAS-intervall, hämtade ur varje persons egen rad. Rader utan lön, kön eller
 * BAS räknas inte. Rader utan AID-kod grupperas på yrkestexten.
 * @param {Array<{aid?:string, bas:string, kon:string, lon:number, yrke?:string, yrkeLabel?:string}>} rader
 * @returns {Array<{aid:string, bas:string, yrke:string, n:number, nKv:number, nMa:number, kvLoner:number[], maLoner:number[], loner:number[]}>}
 */
export function grupperaAidBas(rader) {
    const map = new Map();
    // Gruppens namn ur texten på flest av dess rader (namnrader), som i resten av verktyget (ADR-89).
    const iGrupp = r => !!(r && r.bas && r.lon > 0 && (arKv(r) || arMa(r)) && String(r.aid || r.yrke || '').trim());
    const nyckelAv = r => `${String(r.aid || r.yrke || '').trim()}|${r.bas}`;
    const namn = namnrader((rader || []).filter(iGrupp), nyckelAv);
    for (const r of rader || []) {
        if (!iGrupp(r)) continue;
        const kv = arKv(r);
        const aid = String(r.aid || r.yrke || '').trim();
        const key = nyckelAv(r), nr = namn.get(key);
        if (!map.has(key)) map.set(key, { aid, bas: String(r.bas), yrke: String(nr.yrkeLabel || nr.yrke || aid), n: 0, nKv: 0, nMa: 0, kvLoner: [], maLoner: [], loner: [] });
        const g = map.get(key);
        g.n++;
        if (kv) { g.nKv++; g.kvLoner.push(r.lon); } else { g.nMa++; g.maLoner.push(r.lon); }
        g.loner.push(r.lon);
    }
    return [...map.values()];
}

/** Sorterar grupper: BAS-intervall stigande (bokstavsordningen), därefter antal fallande, därefter AID-kod. */
export function sorteraGrupper(grupper) {
    const rang = basRangordning(grupper.map(g => g.bas));
    return [...grupper].sort((a, b) => rang(a.bas) - rang(b.bas) || b.n - a.n || String(a.aid).localeCompare(String(b.aid), 'sv'));
}

const litenRad = g => ({ bas: g.bas, aid: g.aid, yrke: g.yrke, n: g.n, nKv: g.nKv, nMa: g.nMa });
/** Delar grupperna i de som får en egen rad (minst `golv` personer) och de som räknas upp i noten. */
function _delaPaGolv(grupper, golv) {
    const sorterade = sorteraGrupper(grupper);
    return { rader: sorterade.filter(g => g.n >= golv), sma: sorterade.filter(g => g.n < golv).map(litenRad) };
}

/**
 * Tabell 1 — Lika arbete AID x BAS: Lika arbetes grupper och status i BAS-ordning. Tabellen räknar ingenting eget:
 * den får resultatet av likaArbeteGrupper (src/lib/rapportunderlag.js), som anroparen räknar med verktygets tröskel,
 * så att den har samma grupper, samma k-regel och samma status som tabellen per AID-etikett och inte kan säga något
 * annat om samma grupp. En grupp där ett kön är under tröskeln står utan könsuppdelade mått (`samladMedian`); en grupp
 * som helt ligger under tröskeln får ingen rad utan står med namn i `utelamnade`; `ejJamforbara` är antalet grupper
 * med färre än två av något kön, som inte jämförs.
 * @param {{grupper?: any[], utelamnade?: string[], ejJamforbara?: string[]}|null} lika
 * @returns {{rader: Array<{bas:string, aid:string, yrke:string, n:number, nKv:number, nMa:number, medKv:number|null,
 *   medMa:number|null, kvot:number|null, lag:number|null, hog:number|null, niva:string, samladMedian:boolean}>,
 *   utelamnade: string[], ejJamforbara: number}}
 */
export function likaArbeteTabell(lika) {
    const rader = sorteraGrupper(((lika && lika.grupper) || []).map(g => {
        const samlad = !!g.samladMedian;
        return { bas: String(g.bas ?? ''), aid: String(g.aid ?? ''), yrke: String(g.etikett ?? g.yrke ?? ''), n: g.tot, nKv: g.nKv, nMa: g.nMa,
            medKv: samlad ? null : g.medKv, medMa: samlad ? null : g.medMa, kvot: samlad || !(g.kvot > 0) ? null : g.kvot * 100,
            lag: samlad ? null : (g.lag ?? null), hog: samlad ? null : (g.hog ?? null), niva: String(g.niva), samladMedian: samlad };
    }));
    return { rader, utelamnade: [...((lika && lika.utelamnade) || [])], ejJamforbara: ((lika && lika.ejJamforbara) || []).length };
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
        const med = stor ? median(g.loner) : null, p10 = stor ? kvantil(g.loner, 0.1) : null, p90 = stor ? kvantil(g.loner, 0.9) : null;
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
    const rang = basRangordning(grupper.map(g => g.bas));
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

// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
/**
 * Öppen lönekartläggning — Likvärdighetsanalys (DiskrL 3:10 §)
 *
 * Ren, testbar kärna för § 3:10-analysen. Appen importerar den
 * (ADR-98); likvardighetspar() i 34-likvardigt-arbete.js är adaptern
 * runt den. Vitest verifierar *algoritmen* deterministiskt.
 *
 * Modellen (ADR-60: jämförelseyrkena är alla som inte är kvinnodominerade):
 *   Klassning — EN definition i hela verktyget: arKvinnodominerad()/konsklass() nedan.
 *            'do': mer än gränsen (standard 60 %); 'scb': gränsen eller mer. Mansdominerat
 *            speglas för män; övriga är blandade.
 *   Steg 1 — Organisationens AID×BAS-grupper delas i:
 *            • kvinnodominerade — analysens subjekt
 *            • alla övriga (mansdominerade och blandade) — interna jämförelsekandidater
 *              med klassen synlig (PRIMÄR jämförelsekälla; § 3:10 är en
 *              inom-arbetsgivare-analys). Minsta gruppstorlek tillämpas EJ.
 *   Steg 2 — jämförelsestatistikens AID×BAS som inte är kvinnodominerade blir
 *            kandidater med klass. Lokal könsdata primär, den nationella
 *            personalstatistiken som reserv (injicerad `nationellKlass`-funktion) annars.
 *            Används som EXTERN fallback per BAS.
 *            Filtret `jamforelse: 'mansdominerade'` begränsar båda mängderna till de
 *            mansdominerade (det tidigare urvalet).
 *   Steg 3 — Jämför INOM samma BAS-intervall (= likvärdiga krav). Per BAS
 *            väljs internt jämförelseyrke om sådant finns, annars jämförelsestatistiken.
 *            Flagga par där jämförelseyrkets median > organisationens median,
 *            gap ≥ minGapPct. Varje par får ett bootstrap-95 %-CI på
 *            medianskillnaden (intern: bägge urvalen; extern: org-löner mot
 *            jämförelsestatistikens median som konstant). Interna par får
 *            dessutom en ÅLDERSJUSTERAD skillnad (aldersjusteradSkillnad):
 *            jämförelseyrkets lön standardiserad till den kvinnodominerade
 *            gruppens åldersfördelning. Den råa skillnaden är huvudmåttet —
 *            lagen prövar lönenivån som sådan — den justerade visar hur
 *            mycket av skillnaden som kan bero på åldersstruktur.
 *
 * @see 34-likvardigt-arbete.js likvardighetspar
 */

import { median as _median, percentilintervall } from './stat.js';
import { slumpFor } from './rng.js';
import { direktivMarkering } from './status.js';
import { arKvinna } from './kon.js';
import { namnrader } from './aid.js';

export const KVINNO_TROSKEL_STANDARD = 60;   // > → kvinnodominerat ('do', *Mer än 60 %*)

/**
 * Den enda definitionen av kvinnodominerat arbete i verktyget (ADR-60, §9.22).
 * 'do' (*Mer än X %*): mer än gränsen. 'scb' (*X % eller mer*): gränsen eller mer. Nycklarna är historiska och
 * står kvar för sparade konfigurationsfiler; valen heter efter lydelsen (ADR-72).
 * @param {number|null|undefined} pct - procent kvinnor
 * @param {'do'|'scb'|string} [definition='do']
 * @param {number} [grans=60]
 * @returns {boolean}
 */
export function arKvinnodominerad(pct, definition = 'do', grans = KVINNO_TROSKEL_STANDARD) {
    if (typeof pct !== 'number' || !isFinite(pct)) return false;
    // Andelen räknas på flera sätt (nKv / n * 100 …), och 11 av 20 blir 55,00000000000001; avrundad hamnar en andel
    // exakt på gränsen på rätt sida, oavsett hur den räknats.
    const p = Math.round(pct * 1e9) / 1e9;
    return definition === 'scb' ? p >= grans : p > grans;
}

/**
 * Könsklassen för en grupp efter andelen kvinnor, med samma definition för män (speglad).
 * @param {number|null|undefined} pct - procent kvinnor
 * @param {'do'|'scb'|string} [definition='do']
 * @param {number} [grans=60]
 * @returns {'kvinnodominerad'|'mansdominerad'|'blandad'|''} '' när andelen är okänd
 */
export function konsklass(pct, definition = 'do', grans = KVINNO_TROSKEL_STANDARD) {
    if (typeof pct !== 'number' || !isFinite(pct)) return '';
    if (arKvinnodominerad(pct, definition, grans)) return 'kvinnodominerad';
    if (arKvinnodominerad(100 - pct, definition, grans)) return 'mansdominerad';
    return 'blandad';
}

/**
 * Förbereder en grupps löner för bootstrapmedianen: lönerna sorteras stigande en gång (en kopia), och dragningarna görs
 * ur den sorterade listan. En dragning räknar sedan hur många gånger varje plats dras, och medianen läses ur den
 * kumulativa räkningen. Det ger samma median som att sortera varje dragning, men i O(n) i stället för O(n log n) och
 * utan allokeringar per dragning. Eftersom platserna är platser i den SORTERADE listan beror dragningarna bara på
 * lönerna, inte på i vilken ordning de stod i filen (ADR-86): lika löner har samma värde, så det spelar ingen roll
 * vilken av dem som står först.
 * @param {number[]} lons
 * @returns {{n:number, sorterad:Float64Array, antal:Int32Array}}
 */
function _sorteratUnderlag(lons) {
    const n = lons.length;
    const sorterad = Float64Array.from(lons).sort();
    return { n, sorterad, antal: new Int32Array(n) };
}

/**
 * Medianen av en dragning med återläggning ur underlaget. Anropar `rng()` n gånger, i samma ordning som en
 * dragning `sorterad[(rng() * n) | 0]` per position ur de stigande sorterade lönerna. Udda n: det mittersta
 * elementet; jämnt n: medel av de två mittersta.
 * @param {{n:number, sorterad:Float64Array, antal:Int32Array}} u
 * @param {() => number} rng
 * @returns {number}
 */
function _dragningsmedian(u, rng) {
    const { n, sorterad, antal } = u;
    antal.fill(0);
    for (let i = 0; i < n; i++) antal[(rng() * n) | 0]++;
    const m = n >> 1;
    let summa = 0, r = 0;
    if (n & 1) {
        for (; r < n; r++) { summa += antal[r]; if (summa > m) return sorterad[r]; }
    }
    // Jämnt n: det nedre mittelementet har index m − 1, det övre index m (räknat från 0).
    for (; r < n; r++) {
        summa += antal[r];
        if (summa >= m) break;
    }
    const nedre = sorterad[r];
    if (summa >= m + 1) return nedre;
    for (r++; r < n; r++) {
        summa += antal[r];
        if (summa >= m + 1) break;
    }
    return (nedre + sorterad[r]) / 2;
}

/**
 * Medianerna i B bootstrapdragningar ur två grupper: per dragning dras först kvN löner ur kv och sedan maN ur ma,
 * med återläggning, i samma ordning som `sorterad[(rng() * n) | 0]` per position ur gruppens stigande sorterade
 * löner, så att dragningarna inte beror på radordningen (ADR-86). Medianerna tas ur rangräkning
 * (`_dragningsmedian`) och är desamma som om varje dragning sorterades. Den gemensamma kärnan för
 * bootstrapintervallen på medianskillnaden (här) och på mediankvoten (Lika arbete, Ålder & karriär, gruppdossiern).
 * Lönerna ska vara ändliga tal; de ändras inte.
 * @param {number[]} kvLoner
 * @param {number[]} maLoner
 * @param {number} B
 * @param {() => number} rng
 * @returns {{kv: Float64Array, ma: Float64Array}} medianen per dragning för vardera gruppen
 */
export function bootstrapMedianer(kvLoner, maLoner, B, rng) {
    const kv = _sorteratUnderlag(kvLoner), ma = _sorteratUnderlag(maLoner);
    const mKv = new Float64Array(B), mMa = new Float64Array(B);
    for (let b = 0; b < B; b++) {
        mKv[b] = _dragningsmedian(kv, rng);
        mMa[b] = _dragningsmedian(ma, rng);
    }
    return { kv: mKv, ma: mMa };
}

/**
 * Bootstrap-CI för MEDIAN-SKILLNAD i kronor (m_ma − m_kv), 95 % (percentilintervall i stat.js).
 * Används för INTERNA par (bägge sidor har individdata). Dragningarna och medianerna ur `bootstrapMedianer`.
 * @param {number[]} kvLoner
 * @param {number[]} maLoner
 * @param {number} [B=1000]
 * @param {() => number} [rng=Math.random] - injicerbar RNG för deterministiska tester
 * @returns {{lo:number, hi:number}|null}
 */
export function bootstrapMedianskillnadKr(kvLoner, maLoner, B = 1000, rng = Math.random) {
    if (!Array.isArray(kvLoner) || !Array.isArray(maLoner)) return null;
    if (kvLoner.length < 3 || maLoner.length < 3) return null;
    const m = bootstrapMedianer(kvLoner, maLoner, B, rng);
    const diffs = new Array(B);
    for (let b = 0; b < B; b++) diffs[b] = m.ma[b] - m.kv[b];
    diffs.sort((a, b) => a - b);
    const { lag, hog } = percentilintervall(diffs);
    return { lo: lag, hi: hog };
}

/**
 * Bootstrap-CI mot ett KONSTANT referensvärde (constMedian − m_sample).
 * Används för EXTERNA par (jämförelsestatistikens median är ett aggregat utan individdata).
 * @param {number[]} orgLoner
 * @param {number} konstMedian
 * @param {number} [B=1000]
 * @param {() => number} [rng=Math.random]
 * @returns {{lo:number, hi:number}|null}
 */
export function bootstrapMedianMotKonstantKr(orgLoner, konstMedian, B = 1000, rng = Math.random) {
    if (!Array.isArray(orgLoner) || orgLoner.length < 3) return null;
    if (!(konstMedian > 0)) return null;
    const org = _sorteratUnderlag(orgLoner);
    const diffs = new Array(B);
    for (let b = 0; b < B; b++) diffs[b] = konstMedian - _dragningsmedian(org, rng);
    diffs.sort((a, b) => a - b);
    const { lag, hog } = percentilintervall(diffs);
    return { lo: lag, hi: hog };
}

export const ALDERS_GOLV_STANDARD = 10;      // minsta antal personer i jämförelseyrket för åldersjustering
export const ALDERS_SPRIDNING_MIN = 5;      // minsta åldersspridning (år) i jämförelseyrket

function _medel(arr) {
    const v = (arr || []).filter(x => typeof x === 'number' && isFinite(x));
    return v.length ? v.reduce((s, x) => s + x, 0) / v.length : null;
}

/**
 * Åldersjusterad skillnad för ett internt par: jämförelseyrkets lön standardiseras
 * till den kvinnodominerade gruppens åldersfördelning.
 *
 * I jämförelseyrket skattas log(lön) = a + b·ålder (OLS). Kravet är minst `golv`
 * personer med ålder och minst 5 års åldersspridning — annars null. Lönen
 * prediceras sedan vid varje person i den kvinnodominerade gruppen med dennes
 * ålder; medianen av prediktionerna är den åldersjusterade jämförelsemedianen.
 * Skillnaden räknas i kronor och procent mot den kvinnodominerade gruppens
 * (råa) median, så att den är jämförbar med parets råa skillnad.
 *
 * @param {Array<{lon:number, alder?:number}>} kvRader - den kvinnodominerade gruppen
 * @param {Array<{lon:number, alder?:number}>} jmfRader - jämförelseyrket (individlöner)
 * @param {{golv?:number}} [opts]
 * @returns {{medianJusterad:number, gapKr:number, gapPct:number, metod:'alder'}|null}
 */
export function aldersjusteradSkillnad(kvRader, jmfRader, { golv = ALDERS_GOLV_STANDARD } = {}) {
    /** @returns {r is {lon:number, alder:number}} */
    // Ålder 0 är en saknad ålder: inläsningen ger 0 för en tom cell (som i regression.js och resten av lib).
    const ok = r => !!r && r.lon > 0 && typeof r.alder === 'number' && isFinite(r.alder) && r.alder > 0;
    const jmf = (jmfRader || []).filter(ok);
    if (jmf.length < Math.max(golv, 3)) return null;
    let lagst = Infinity, hogst = -Infinity;
    for (const r of jmf) { if (r.alder < lagst) lagst = r.alder; if (r.alder > hogst) hogst = r.alder; }
    if (hogst - lagst < ALDERS_SPRIDNING_MIN) return null;
    const n = jmf.length;
    const mx = jmf.reduce((s, r) => s + r.alder, 0) / n;
    let Sxx = 0, Sxy = 0, Sy = 0;
    for (const r of jmf) { const x = r.alder - mx, y = Math.log(r.lon); Sxx += x * x; Sxy += x * y; Sy += y; }
    if (!(Sxx > 1e-9)) return null;
    const b = Sxy / Sxx, a = Sy / n - b * mx;
    const kvAlla = (kvRader || []).filter(r => r && r.lon > 0);
    const kvMedAlder = kvAlla.filter(ok);
    if (!kvAlla.length || !kvMedAlder.length) return null;
    const pred = kvMedAlder.map(r => Math.exp(a + b * r.alder));
    const medianJusterad = _median(pred);
    const kvMedian = _median(kvAlla.map(r => r.lon));
    if (!(medianJusterad > 0) || !(kvMedian > 0)) return null;
    const gapKr = medianJusterad - kvMedian;
    return { medianJusterad, gapKr, gapPct: gapKr * 100 / kvMedian, metod: 'alder' };
}

/** Individrader {lon, alder} ur en aggregerad grupp (lons och aldrar är parallella). */
function _gruppRader(g) {
    if (!g || !Array.isArray(g.lons)) return [];
    const aldrar = Array.isArray(g.aldrar) ? g.aldrar : [];
    return g.lons.map((lon, i) => ({ lon, alder: aldrar[i] }));
}

/** Åldersfälten för ett par: medelålder per sida och den justerade skillnaden (bara interna par). */
function _aldersFalt(f, g, ärIntern, golv) {
    /** @type {ReturnType<typeof aldersjusteradSkillnad>} */
    let aldersJusterad = null;
    if (ärIntern) {
        try { aldersJusterad = aldersjusteradSkillnad(_gruppRader(f), _gruppRader(g), { golv }); } catch (_) { aldersJusterad = null; }
    }
    return {
        kvMedelAlder: _medel(f.aldrar),
        maMedelAlder: ärIntern ? _medel(g.aldrar) : null,
        aldersJusterad
    };
}

/**
 * Steg 1 — aggregera organisationens individdata per AID×BAS och dela upp i
 * kvinnodominerade grupper (analysens subjekt) och alla övriga grupper
 * (interna jämförelsekandidater, med klassen mansdominerad eller blandad).
 *
 * @param {Array<{aid:string, bas:string, lon:number, kon:string, yrkeLabel?:string, yrke?:string, alder?:number}>} data
 * @param {number} kvinnoGrans - kvinnotröskel i procent
 * @param {number} [K=10]
 * @param {'do'|'scb'} [definition='do'] - 'do': mer än tröskeln; 'scb': tröskeln eller mer
 * @returns {{orgKvDom:Array, orgIckeKv:Array, antalAidxBas:number, kvDomMedNLessThanK:number}}
 */
export function aggregeraOrgKvDom(data, kvinnoGrans = KVINNO_TROSKEL_STANDARD, K = 10, definition = 'do') {
    const map = new Map();   // nyckel: aid|bas
    // Namnet ur texten på flest av gruppens rader (namnrader), som i resten av verktyget (ADR-89).
    const iGrupp = r => !!(String(r?.aid || '').trim() && r.lon > 0 && r.bas);
    const namn = namnrader((data || []).filter(iGrupp), r => String(r.aid).trim() + '|' + r.bas);
    for (const r of (data || [])) {
        if (!iGrupp(r)) continue;
        const aid = String(r.aid).trim();
        const key = aid + '|' + r.bas;
        if (!map.has(key)) {
            const nr = namn.get(key);
            map.set(key, { aid, bas: r.bas, label: nr.yrkeLabel || nr.yrke || aid, n: 0, nKv: 0, lons: [], aldrar: [] });
        }
        const g = map.get(key);
        g.n++;
        if (arKvinna(r)) g.nKv++;
        g.lons.push(r.lon);
        // Åldern bärs parallellt med lönen (null när den saknas) för åldersjusteringen i steg 3.
        g.aldrar.push(typeof r.alder === 'number' && isFinite(r.alder) && r.alder > 0 ? r.alder : null);   // 0 = saknas
    }
    const orgKvDom = [];
    const orgIckeKv = [];
    let kvDomMedNLessThanK = 0;
    for (const g of map.values()) {
        const kvinnoPct = (g.nKv / g.n) * 100;
        const klass = konsklass(kvinnoPct, definition, kvinnoGrans);
        const obj = {
            aid: g.aid, bas: g.bas, label: g.label,
            n: g.n, nKv: g.nKv, kvinnoPct, klass,
            median: _median(g.lons), lons: g.lons.slice(), aldrar: g.aldrar.slice()
        };
        if (klass === 'kvinnodominerad') {
            orgKvDom.push(obj);
            if (g.n < K) kvDomMedNLessThanK++;
        } else {
            orgIckeKv.push(obj);
        }
    }
    orgKvDom.sort((a, b) => b.n - a.n);
    orgIckeKv.sort((a, b) => b.n - a.n);
    return { orgKvDom, orgIckeKv, antalAidxBas: map.size, kvDomMedNLessThanK };
}

/**
 * Steg 2 — klassificera jämförelsestatistiken per AID×BAS. Returnerar raderna
 * som inte är kvinnodominerade (mansdominerade och blandade, med klass) grupperade per BAS.
 * `klass.ickeKv` är alla kandidater; `klass.blandat` är hur många av dem som är blandade.
 *
 * @param {Array<{aid:string, bas:string, median:number, andelKv?:number, aidFull?:string, nKv?:number, nMa?:number}>} statistik
 * @param {((aid:string) => ({kvAndel:number}|null))|null} [nationellKlass] - reserven: den nationella kvinnoandelen per AID-kod
 * @param {{definition?:'do'|'scb', grans?:number}} [val]
 * @returns {{statIckeKv:Array, statByBas:Map, klass:Object, klassKalla:Object}}
 */
export function klassificeraStatistik(statistik, nationellKlass, { definition = 'do', grans = KVINNO_TROSKEL_STANDARD } = {}) {
    const statByBas = new Map();
    const statIckeKv = [];
    const klass = { kvDom: 0, blandat: 0, ickeKv: 0, oklassificerad: 0 };
    const klassKalla = { lokal: 0, nationell: 0 };

    for (const s of (statistik || [])) {
        if (!s || !s.aid || !s.bas || !(s.median > 0)) continue;
        if (!/^\d+$/.test(String(s.aid))) continue;   // hoppa över yrkesfamiljerubriker

        /** @type {number|null} */ let kvAndel = null;
        /** @type {'lokal'|'nationell'|null} */ let källa = null;
        if (s.andelKv != null && s.andelKv >= 0 && s.andelKv <= 100) {
            kvAndel = s.andelKv; källa = 'lokal';
        } else if (typeof nationellKlass === 'function') {
            const nat = nationellKlass(s.aid);
            if (nat && nat.kvAndel != null) { kvAndel = nat.kvAndel; källa = 'nationell'; }
        }
        if (kvAndel == null) { klass.oklassificerad++; continue; }
        if (källa === 'lokal') klassKalla.lokal++; else klassKalla.nationell++;

        const ks = konsklass(kvAndel, definition, grans);
        if (ks === 'kvinnodominerad') { klass.kvDom++; continue; }
        if (ks === 'blandad') klass.blandat++;
        klass.ickeKv++;

        const rawLabel = s.aidFull || s.aid;
        const aidStr = String(s.aid);
        const cleanLabel = String(rawLabel).startsWith(aidStr)
            ? String(rawLabel).slice(aidStr.length).replace(/^\s*[—\-:.\s]*/, '').trim() || aidStr
            : rawLabel;
        const obj = {
            aid: s.aid, label: cleanLabel, bas: s.bas,
            median: s.median, kvAndel, klass: ks, källa, nKv: s.nKv, nMa: s.nMa
        };
        if (!statByBas.has(s.bas)) statByBas.set(s.bas, []);
        statByBas.get(s.bas).push(obj);
        statIckeKv.push(obj);
    }
    statIckeKv.sort((a, b) => a.kvAndel - b.kvAndel);
    return { statIckeKv, statByBas, klass, klassKalla };
}

/**
 * Bygg en Map per BAS av organisationens interna jämförelseyrken.
 * @param {Array} orgIckeKv
 * @returns {Map<string, Array>}
 */
export function orgIckeKvPerBas(orgIckeKv) {
    const m = new Map();
    for (const g of (orgIckeKv || [])) {
        if (!m.has(g.bas)) m.set(g.bas, []);
        m.get(g.bas).push(g);
    }
    return m;
}

/**
 * Antalet par som klarat minsta gapet, räknat FÖRE topN-urvalet (ADR-61): totalt, hur många som når direktivnivån 5 %
 * på det ojusterade gapet (det kvinnodominerade yrkets median i % av jämförelseyrkets, direktivMarkering) och hur
 * många som har en säker skillnad (hela KI:t över 0).
 * @param {Array} candidates
 * @returns {{totalt:number, overDirektiv:number, sakra:number}}
 */
export function parAntal(candidates) {
    let overDirektiv = 0, sakra = 0;
    for (const p of candidates) {
        if (p.maMedian > 0 && direktivMarkering(p.kvMedian / p.maMedian * 100)) overDirektiv++;
        if (p.gapCI && p.gapCI.lo != null && p.gapCI.lo > 0) sakra++;
    }
    return { totalt: candidates.length, overDirektiv, sakra };
}

/**
 * Steg 3 — bygg kandidatpar inom samma BAS. Per BAS väljs organisationens
 * egna icke-kv-dom yrken (intern, primärt); saknas sådant används jämförelsestatistiken
 * (extern fallback). Flagga par där jämförelseyrkets median > org-median.
 *
 * @param {Array} orgKvDom
 * @param {Map} internPerBas - från orgIckeKvPerBas()
 * @param {Map} externPerBas - statByBas från klassificeraStatistik()
 * @param {Object} [val] - { minGap, topN, B, rng, golv }
 * @returns {{pairs:Array, jämförelse:Object, antal:{totalt:number, overDirektiv:number, sakra:number}}}
 */
export function byggPar(orgKvDom, internPerBas, externPerBas, val = {}) {
    const minGap = val.minGap ?? 0;
    const topN = val.topN ?? 100;
    const B = val.B ?? 1000;
    const golv = val.golv ?? ALDERS_GOLV_STANDARD;
    // Utan explicit rng seedas bootstrappen PER PAR ur parets egna löner
    // (slumpFor). Då blir konfidensintervallen reproducerbara mellan körningar —
    // ett Math.random-default gav nya KI varje gång och gjorde ett exporterat
    // underlag omöjligt att återskapa. Tester injicerar sin egen rng.
    const rngOpt = val.rng ?? null;
    const prngFor = (a, b) => rngOpt || slumpFor(a, b);
    const jämförelse = {
        gemensammaBas: 0, möjligaPar: 0, statHögre: 0, statLägreEllerLika: 0,
        internaPar: 0, externaPar: 0, basMedExternFallback: 0,
        kravProxy: 'bas', kvUtanPoang: 0
    };
    const pairs = [];
    internPerBas = internPerBas || new Map();
    externPerBas = externPerBas || new Map();
    if (!orgKvDom?.length || (!internPerBas.size && !externPerBas.size)) return { pairs, jämförelse, antal: parAntal(pairs) };

    const orgBasSet = new Set(orgKvDom.map(f => f.bas));
    const jämförBasSet = new Set([...internPerBas.keys(), ...externPerBas.keys()]);
    jämförelse.gemensammaBas = [...orgBasSet].filter(b => jämförBasSet.has(b)).length;

    const candidates = [];
    for (const f of orgKvDom) {
        const internaRows = internPerBas.get(f.bas) || [];
        const externaRows = externPerBas.get(f.bas) || [];
        let jämförRader, källa;
        if (internaRows.length) {
            jämförRader = internaRows; källa = 'intern';
        } else if (externaRows.length) {
            jämförRader = externaRows; källa = 'extern';
            jämförelse.basMedExternFallback++;
        } else {
            continue;
        }
        for (const g of jämförRader) {
            jämförelse.möjligaPar++;
            if (g.median <= f.median) { jämförelse.statLägreEllerLika++; continue; }
            jämförelse.statHögre++;
            const gapKr = g.median - f.median;
            const gapPct = gapKr * 100 / f.median;   // multiplicera först: ett par exakt på minGap faller inte bort på avrundningen
            if (gapPct < minGap) continue;

            const ärIntern = källa === 'intern';
            /** @type {{lo:number, hi:number}|null} */
            let gapCI = null;
            try {
                gapCI = (ärIntern && Array.isArray(g.lons))
                    ? bootstrapMedianskillnadKr(f.lons, g.lons, B, prngFor(f.lons, g.lons))
                    : bootstrapMedianMotKonstantKr(f.lons, g.median, B, prngFor(f.lons, [g.median]));
            } catch (_) { gapCI = null; }

            if (ärIntern) jämförelse.internaPar++; else jämförelse.externaPar++;

            candidates.push({
                kvAid: f.aid, kvLabel: f.label, kvBas: f.bas,
                kvN: f.n, kvNKv: f.nKv, kvMedian: f.median, kvKvinnoPct: f.kvinnoPct,
                maAid: g.aid, maLabel: g.label, maBas: f.bas,
                maMedian: g.median,
                maKvAndel: ärIntern ? g.kvinnoPct : g.kvAndel,
                maKvinnoPct: ärIntern ? g.kvinnoPct : g.kvAndel,
                maKlass: g.klass || '',
                maN: ärIntern ? g.n : null,
                maNKv: g.nKv, maNMa: g.nMa,
                jamforKalla: källa,                       // 'intern' | 'extern'
                maKlassKort: ärIntern ? 'intern' : (g.källa === 'lokal' ? 'lokal' : 'nationell'),   // var andelen kommer ifrån
                gapKr, gapPct, gapCI,
                ..._aldersFalt(f, g, ärIntern, golv),
                allvarsindex: Math.abs(gapKr) * f.n
            });
        }
    }
    candidates.sort((a, b) => b.gapPct - a.gapPct);
    return { pairs: candidates.slice(0, topN), jämförelse, antal: parAntal(candidates) };
}

/**
 * Steg 3 — bygg kandidatpar med ARBETSVÄRDERINGSPOÄNG som krav-proxy
 * istället för BAS. Parar över BAS-gränser: ett jämförelseyrke kvalificerar om
 * dess poäng ≤ det kvinnodominerade yrkets poäng × (1 + band) — dvs likvärdiga
 * eller lägre krav (DiskrL 3:10). Bara organisationens egna jämförelseetiketter
 * jämförs: jämförelsestatistiken har inga poäng (ADR-76).
 *
 * @param {Array} orgKvDom
 * @param {Array} internAlla - organisationens icke-kv-dom yrken (flat)
 * @param {Map<string,number>} poangPerNyckel - 'AID|BAS' eller 'AID' → poäng
 * @param {Object} [val] - { minGap, topN, B, rng, bandPct, golv }
 * @returns {{pairs:Array, jämförelse:Object, antal:{totalt:number, overDirektiv:number, sakra:number}}}
 */
export function byggParPoang(orgKvDom, internAlla, poangPerNyckel, val = {}) {
    const minGap = val.minGap ?? 0;
    const topN = val.topN ?? 100;
    const B = val.B ?? 1000;
    const golv = val.golv ?? ALDERS_GOLV_STANDARD;
    // Utan explicit rng seedas bootstrappen PER PAR ur parets egna löner
    // (slumpFor). Då blir konfidensintervallen reproducerbara mellan körningar —
    // ett Math.random-default gav nya KI varje gång och gjorde ett exporterat
    // underlag omöjligt att återskapa. Tester injicerar sin egen rng.
    const rngOpt = val.rng ?? null;
    const prngFor = (a, b) => rngOpt || slumpFor(a, b);
    const bandPct = val.bandPct ?? 5;
    // externaPar och basMedExternFallback står kvar (alltid 0) så att diagnostiken har samma form som i BAS-läget;
    // fliken och exporterna visar dem inte när kravProxy är 'poäng'.
    const jämförelse = {
        gemensammaBas: 0, möjligaPar: 0, statHögre: 0, statLägreEllerLika: 0,
        internaPar: 0, externaPar: 0, basMedExternFallback: 0,
        kravProxy: 'poäng', kvUtanPoang: 0
    };
    const pairs = [];
    orgKvDom = orgKvDom || [];
    internAlla = internAlla || [];
    poangPerNyckel = poangPerNyckel || new Map();
    if (!orgKvDom.length || !poangPerNyckel.size) return { pairs, jämförelse, antal: parAntal(pairs) };

    const poangFor = g => poangPerNyckel.get(g.aid + '|' + g.bas) ?? poangPerNyckel.get(String(g.aid)) ?? null;
    const candidates = [];
    for (const f of orgKvDom) {
        const fP = poangFor(f);
        if (fP == null) { jämförelse.kvUtanPoang++; continue; }
        const tak = fP * (1 + bandPct / 100);
        const jämförRader = internAlla.filter(g => { const p = poangFor(g); return p != null && p <= tak; });
        for (const g of jämförRader) {
            jämförelse.möjligaPar++;
            if (g.median <= f.median) { jämförelse.statLägreEllerLika++; continue; }
            jämförelse.statHögre++;
            const gapKr = g.median - f.median;
            const gapPct = gapKr * 100 / f.median;   // multiplicera först: ett par exakt på minGap faller inte bort på avrundningen
            if (gapPct < minGap) continue;
            /** @type {{lo:number, hi:number}|null} */
            let gapCI = null;
            try {
                gapCI = bootstrapMedianskillnadKr(f.lons, g.lons, B, prngFor(f.lons, g.lons));
            } catch (_) { gapCI = null; }
            jämförelse.internaPar++;
            candidates.push({
                kvAid: f.aid, kvLabel: f.label, kvBas: f.bas,
                kvN: f.n, kvNKv: f.nKv, kvMedian: f.median, kvKvinnoPct: f.kvinnoPct,
                maAid: g.aid, maLabel: g.label, maBas: g.bas,
                maMedian: g.median,
                maKvAndel: g.kvinnoPct,
                maKvinnoPct: g.kvinnoPct,
                maKlass: g.klass || '',
                maN: g.n,
                maNKv: g.nKv, maNMa: g.nMa,
                jamforKalla: 'intern',
                maKlassKort: 'intern',
                gapKr, gapPct, gapCI,
                ..._aldersFalt(f, g, true, golv),
                kvPoang: fP, maPoang: poangFor(g),
                allvarsindex: Math.abs(gapKr) * f.n
            });
        }
    }
    candidates.sort((a, b) => b.gapPct - a.gapPct);
    return { pairs: candidates.slice(0, topN), jämförelse, antal: parAntal(candidates) };
}

/**
 * Lägre krav, högre lön (ADR-25): par där ett kvinnodominerat
 * yrke har lägre medianlön än ett av ORGANISATIONENS icke-kvinnodominerade yrken (samma mängd som kandidatparen, ADR-60) i
 * strikt LÄGRE BAS. BAS som krav-proxy — används bara när poäng saknas.
 *
 * @param {Array} orgKvDom
 * @param {Array} orgIckeKv
 * @param {Object} val - { rang: bas → tal, minGap, topN, B, rng }
 * @returns {Array} par med samma fält som interna kandidatpar plus basSteg
 */
export function byggParLagreKrav(orgKvDom, orgIckeKv, val = {}) {
    const { rang } = val;
    const minGap = val.minGap ?? 0, topN = val.topN ?? 100, B = val.B ?? 1000;
    const rngOpt = val.rng ?? null;
    const ut = [];
    for (const f of orgKvDom || []) {
        const rf = rang(f.bas);
        for (const g of orgIckeKv || []) {
            const rg = rang(g.bas);
            if (!(rg < rf) || !(g.median > f.median)) continue;
            const gapKr = g.median - f.median;
            const gapPct = gapKr * 100 / f.median;   // multiplicera först: ett par exakt på minGap faller inte bort på avrundningen
            if (gapPct < minGap) continue;
            ut.push({ _f: f, _g: g,
                kvAid: f.aid, kvLabel: f.label, kvBas: f.bas, kvN: f.n, kvNKv: f.nKv, kvMedian: f.median, kvKvinnoPct: f.kvinnoPct,
                maAid: g.aid, maLabel: g.label, maBas: g.bas, maMedian: g.median, maKvAndel: g.kvinnoPct,
                maKvinnoPct: g.kvinnoPct, maKlass: g.klass || '',
                maN: g.n, maNKv: g.nKv, maNMa: g.n - g.nKv,
                jamforKalla: 'intern', gapKr, gapPct, gapCI: null, basSteg: rf - rg,
            });
        }
    }
    ut.sort((a, b) => b.gapPct - a.gapPct || b.basSteg - a.basSteg);
    // Konfidensintervall bara för paren som behålls — sorteringen beror inte på dem, och
    // bootstrappen seedas per par, så resultatet blir detsamma som om alla räknats.
    return ut.slice(0, topN).map(({ _f, _g, ...p }) => {
        try { p.gapCI = bootstrapMedianskillnadKr(_f.lons, _g.lons, B, rngOpt || slumpFor(_f.lons, _g.lons)); } catch (_) { p.gapCI = null; }
        return p;
    });
}

/**
 * BAS-rang (BAS-ordningen är fast, se likvardighetsmodellen.md §6): bokstavens plats i alfabetet, A=1, B=2 … Varje bokstav är ett lika brett
 * poängintervall i BAS-systemet, så ett BAS-steg är alltid ett intervall — B → D är två steg
 * även när C saknas i underlaget. Samma rang används av regressionerna och Lägre krav.
 * Något som inte är en bokstav läggs alfabetiskt efter bokstäverna.
 * @param {string[]} allaBas - BAS-värdena i underlaget (behövs bara för det som inte är bokstäver)
 * @returns {(bas:string) => number}
 */
export function basRangordning(allaBas) {
    const alfa = [...new Set(allaBas)].sort((a, b) => String(a).localeCompare(String(b), 'sv'));
    return b => { const i = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.indexOf(String(b).toUpperCase()); return String(b).length === 1 && i >= 0 ? i + 1 : 100 + alfa.indexOf(b); };
}

/**
 * Orkestrator — speglar app.js `likvardighetspar()` (utan state).
 *
 * @param {Object} [input]
 * @param {Array} [input.data] - organisationens individdata
 * @param {Array} [input.statistik] - jämförelsestatistiken
 * @param {((aid:string)=>({kvAndel:number}|null))|null} [input.nationellKlass]
 * @param {Object} [input.opts] - { kvinnoTrosholdPct, kvDomDefinition, jamforelse, minGapPct, topN, B, rng, k, aldersGolv }
 *   kvDomDefinition: 'do' (*Mer än X %*, standard) | 'scb' (*X % eller mer*; ADR-72).
 *   jamforelse: 'alla' (alla som inte är kvinnodominerade, standard) | 'mansdominerade' (ADR-60).
 * @returns {{orgKvDom:Array, orgIckeKv:Array, statIckeKv:Array, pairs:Array, parAntal:{totalt:number, overDirektiv:number, sakra:number}, lagreKrav:Array, diagnostik:Object, opts:Object}}
 */
export function likvardighetsparUr({ data = [], statistik = [], nationellKlass = null, opts = {} } = {}) {
    const kvinnoThr = opts.kvinnoTrosholdPct ?? KVINNO_TROSKEL_STANDARD;
    const definition = opts.kvDomDefinition === 'scb' ? 'scb' : 'do';
    const jamforelse = opts.jamforelse === 'mansdominerade' ? 'mansdominerade' : 'alla';
    const minGap = opts.minGapPct ?? 0;
    const topN = opts.topN ?? 100;
    const B = opts.B ?? 1000;
    // Skickas vidare ORÖRT: byggPar seedar per par ur parets egna löner när
    // ingen rng anges. Ett `?? Math.random` här hade satt opts.rng i varje
    // anrop och tyst slagit ut den seedningen — konfidensintervallen blev då
    // nya vid varje körning, vilket gör ett exporterat underlag omöjligt att
    // återskapa. Bara tester injicerar en egen rng.
    const rng = opts.rng;

    const poangByKey = opts.poangByKey || null;   // arbetsvärdering som krav-proxy
    const bandPct = opts.poangBandPct ?? 5;
    const golv = opts.aldersGolv ?? ALDERS_GOLV_STANDARD;   // minsta jämförelseyrke för åldersjusteringen

    // k-tröskeln används bara för att RÄKNA små kvinnodominerade grupper i diagnostiken (de ingår ändå).
    const s1 = aggregeraOrgKvDom(data, kvinnoThr, opts.k ?? 10, definition);
    const s2 = klassificeraStatistik(statistik, nationellKlass, { definition, grans: kvinnoThr });
    // Filtret 'mansdominerade' begränsar jämförelsemängden innan paren byggs, så att reserven
    // till jämförelsestatistiken per BAS fungerar som förut när bara blandade egna yrken finns.
    if (jamforelse === 'mansdominerade') {
        s1.orgIckeKv = s1.orgIckeKv.filter(g => g.klass === 'mansdominerad');
        s2.statIckeKv = s2.statIckeKv.filter(g => g.klass === 'mansdominerad');
        for (const [bas, rader] of s2.statByBas) {
            const kvar = rader.filter(g => g.klass === 'mansdominerad');
            if (kvar.length) s2.statByBas.set(bas, kvar); else s2.statByBas.delete(bas);
        }
    }
    const internByBas = orgIckeKvPerBas(s1.orgIckeKv);
    const s3 = (poangByKey && poangByKey.size)
        ? byggParPoang(s1.orgKvDom, s1.orgIckeKv, poangByKey, { minGap, topN, B, rng, bandPct, golv })
        : byggPar(s1.orgKvDom, internByBas, s2.statByBas, { minGap, topN, B, rng, golv });
    const lagreKrav = (poangByKey && poangByKey.size) ? [] : byggParLagreKrav(s1.orgKvDom, s1.orgIckeKv, {
        rang: basRangordning([...s1.orgKvDom, ...s1.orgIckeKv].map(g => g.bas)),
        minGap, topN, B, rng });

    return {
        orgKvDom: s1.orgKvDom,
        orgIckeKv: s1.orgIckeKv,
        statIckeKv: s2.statIckeKv,
        pairs: s3.pairs,
        parAntal: s3.antal,   // alla par före topN-urvalet (ADR-61)
        lagreKrav,
        diagnostik: {
            organisation: {
                totalRader: data.length,
                antalAidxBas: s1.antalAidxBas,
                kvDomFunna: s1.orgKvDom.length,
                kvDomMedNLessThanK: s1.kvDomMedNLessThanK,
                ickeKvFunna: s1.orgIckeKv.length
            },
            statistik: {
                totalRader: statistik.length,
                klass: s2.klass,
                klassKalla: s2.klassKalla
            },
            jämförelse: s3.jämförelse,
            fel: []
        },
        opts: { kvinnoTrosholdPct: kvinnoThr, kvDomDefinition: definition, jamforelse, minGapPct: minGap, topN }
    };
}

// ---- Krav mot lön: en punkt per yrkesgrupp ----------------------------------
// Kraven är arbetsvärderingspoäng när en poängtabell är inläst, annars BAS-intervallets rang — samma krav-proxy som
// parbildningen. En grupp som saknar poäng i en inläst tabell placeras efter sitt BAS-intervall: medianpoängen för
// intervallets värderade grupper; tipset och noten säger det. Finns ingen värderad grupp i
// intervallet går gruppen inte att placera och namnges i noten.
// Bara grupper som når tröskeln: diagrammet visar gruppens medianlön. Linjen räknas ur de grupper som visas.
/**
 * @param {any[]} rader
 * @param {{k?: number, poangByKey?: Map<string, number>|null, definition?: string, grans?: number}} [opts] definition och
 *   grans: appens val av definitionen av kvinnodominerat (konsklass)
 */
export function kravGrupper(rader, { k = 10, poangByKey = null, definition = 'do', grans = KVINNO_TROSKEL_STANDARD } = {}) {
    const map = new Map();
    // Namnet ur texten på flest av gruppens rader (namnrader), som i resten av verktyget (ADR-89).
    const iGrupp = r => !!(r && String(r.aid || '').trim() && r.lon > 0 && r.bas);
    const namnrad = namnrader((rader || []).filter(iGrupp), r => String(r.aid).trim() + '|' + r.bas);
    for (const r of rader || []) {
        if (!iGrupp(r)) continue;
        const aid = String(r.aid).trim();
        const key = aid + '|' + r.bas, nr = namnrad.get(key);
        if (!map.has(key)) map.set(key, { aid, bas: r.bas, namn: nr.yrkeLabel || nr.yrke || aid, n: 0, nKv: 0, loner: [] });
        const g = map.get(key);
        g.n++; if (arKvinna(r)) g.nKv++; g.loner.push(r.lon);
    }
    const medPoang = !!(poangByKey && poangByKey.size);
    const alla = [...map.values()].filter(g => g.n >= k).map(g => {
        const andelKv = 100 * g.nKv / g.n;
        const poang = medPoang ? (poangByKey.get(g.aid + '|' + g.bas) ?? poangByKey.get(g.aid) ?? null) : null;
        return { aid: g.aid, bas: g.bas, namn: g.namn, n: g.n, andelKv, median: _median(g.loner), poang,
                 dominans: konsklass(andelKv, definition, grans) };   // den enda definitionen av kvinnodominerat (ADR-60)
    });
    if (!medPoang) return { medPoang, grupper: alla, utanPlats: [] };
    // Medianpoängen per BAS-intervall, ur de värderade grupper som visas.
    const perBas = new Map();
    for (const g of alla) if (g.poang != null) { if (!perBas.has(g.bas)) perBas.set(g.bas, []); perBas.get(g.bas).push(g.poang); }
    const grupper = [], utanPlats = [];
    for (const g of alla) {
        if (g.poang != null) grupper.push({ ...g, krav: g.poang });
        else if (perBas.has(g.bas)) grupper.push({ ...g, krav: _median(perBas.get(g.bas)), uppskattad: true });
        else utanPlats.push(g);
    }
    return { medPoang, grupper, utanPlats };
}

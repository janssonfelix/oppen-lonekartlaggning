// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
/**
 * Öppen lönekartläggning — vymodellen för fliken Ålder & karriär (ADR-99): lönedelen (nyckeltalen, lön mot ålder med
 * trendlinjer, lådorna per kön, lönefördelningen per kön, lönegapet per åldersgrupp och de små multiplarna) och
 * åldersstrukturen (åldersfördelningen, kurvorna och lönespridningen över ålder), och lönefördelningen per
 * BAS-intervall som Lönestruktur ritar. Allt som räknas, maskeras och bedöms står här, med tröskeln som argument;
 * ritfunktionerna i src/app/40-alder-karriar.js (ritaAlderOchLon, ritaAldersstruktur) ritar bara det de får. Delarna
 * som ett diagram kan räkna för ett underlag (figur.underlag.rita) är egna funktioner, så att diagrammets
 * omräkning och vyn går genom samma regel med samma k.
 */
import { aidAvYrke } from './aid.js';
import { statistikensMedianFor } from './jamforelse.js';
import { arKvinna, arMan } from './kon.js';
import { individLitenForVid } from './ktroskel.js';
import { konskvotPerGrupp, regressionslinjensBand } from './osakerhet.js';
import { kvantil, linjarRegression, median } from './stat.js';
import { histogramKlasser, konsMedianer, omfang } from './struktur.js';
import { STANDARDTERMER } from './termer.js';
import { svKr, svPct, svTecken } from './talformat.js';

const kr = v => `${svTecken(v)}${svKr(v)}`;

/**
 * Raden under nyckeltalen i klartext: stiger lönen lika mycket per levnadsår för kvinnor och män (lutningarna skiljer
 * högst 25 % från medelvärdet), och hur mycket av skillnaden förklarar åldersfördelningen (under en procentenhet:
 * lite)? lutKv och lutMa är trendlinjernas lutning i kronor per år; ra och vidSammaAlder är kvinnors lön i procent
 * av mäns, utan justering respektive avläst vid medelåldern. Texten följer talens riktning: en lutning som inte är
 * över noll stiger inte, och skillnaden mäts som avståndet till lika lön (100 %), åt vilket håll den än går.
 */
export function alderInsiktText(lutKv, lutMa, ra, vidSammaAlder, termer = STANDARDTERMER) {
    const medel = (Math.abs(lutKv) + Math.abs(lutMa)) / 2;
    const likaLutning = medel === 0 || Math.abs(lutKv - lutMa) / medel <= 0.25;
    const lutning = likaLutning
        ? `Lönen ${lutKv > 0 && lutMa > 0 ? 'stiger' : lutKv < 0 && lutMa < 0 ? 'sjunker' : 'ändras'} ungefär lika mycket per levnadsår för kvinnor (${kr(lutKv)}) och män (${kr(lutMa)}).`
        : !(lutKv > 0 && lutMa > 0)
            ? `Lönen ändras olika med åldern för kvinnor (${kr(lutKv)} per år) och män (${kr(lutMa)}).`
        : lutKv < lutMa
            ? `Lönen stiger långsammare med åldern för kvinnor (${kr(lutKv)} per år) än för män (${kr(lutMa)}).`
            : `Lönen stiger snabbare med åldern för kvinnor (${kr(lutKv)} per år) än för män (${kr(lutMa)}).`;
    const fore = Math.abs(ra - 100), efter = Math.abs(vidSammaAlder - 100);
    const justering = Math.abs(vidSammaAlder - ra) < 1
        ? `Vid samma ålder är kvinnors lön ${svPct(vidSammaAlder, 1)} av mäns, nästan som utan justering (${svPct(ra, 1)}): åldersfördelningen förklarar lite av skillnaden.`
        : efter < fore
            ? `Vid samma ålder är kvinnors lön ${svPct(vidSammaAlder, 1)} av mäns, mot ${svPct(ra, 1)} utan justering: åldersfördelningen förklarar en del av skillnaden${efter >= 5 ? ', men inte hela' : ''}.`
            : `Vid samma ålder är kvinnors lön ${svPct(vidSammaAlder, 1)} av mäns, mot ${svPct(ra, 1)} utan justering: skillnaden blir större när åldern räknas bort.`;
    return `${lutning} ${justering} Vad ${termer.niva.en} och ${termer.enhet.en} förklarar står i Lönestruktur.`;
}

/**
 * Lådorna per kön för raderna: ett köns löner bara när könet når k (null annars), och vilka kön som saknas.
 * @param {any[]} rader
 * @param {number} k
 */
export function ladaPerKon(rader, k) {
    const lonKv = rader.filter(d => arKvinna(d)).map(d => d.lon), lonMa = rader.filter(d => arMan(d)).map(d => d.lon);
    const kvOk = lonKv.length >= k, maOk = lonMa.length >= k;
    return { nKv: lonKv.length, nMa: lonMa.length, lonKv: kvOk ? lonKv : null, lonMa: maOk ? lonMa : null,
        utan: [kvOk ? null : 'kvinnor', maOk ? null : 'män'].filter(Boolean).join(' och ') };
}

/**
 * Lönefördelningen per kön i löneklasser med minst k personer i varje (histogramKlasser), eller null med orsaken:
 * ett kön under k ('kon') eller lönerna går inte att dela in ('klasser'). Bara löner över 0 räknas.
 * @param {any[]} rader
 * @param {number} k
 */
export function konHistogram(rader, k) {
    const lon = ar => rader.filter(ar).map(d => d.lon).filter(v => v > 0);
    const kv = lon(d => arKvinna(d)), ma = lon(d => arMan(d));
    const klasser = histogramKlasser(kv, ma, k);
    return { nKv: kv.length, nMa: ma.length, klasser, orsak: klasser ? null : kv.length < k || ma.length < k ? 'kon' : 'klasser' };
}

/** Åldersgrupperna för lönegapet per åldersgrupp: [från, namn]. En grupp går till nästa grupps från, så att varje
 * ålder över 0 (också 29,5 och under 20) hamnar i exakt en grupp. */
export const ALDERSGRUPPER = [[0, 'Under 30 år'], [30, '30–39 år'], [40, '40–49 år'], [50, '50–59 år'], [60, '60 år och äldre']];

/** Indexet för den grupp i en stigande lista med undre gränser som åldern hör till: den sista gränsen ≤ åldern. */
const gruppFor = (fran, alder) => fran.filter(f => alder >= f).length - 1;

/**
 * Lönegapet per åldersgrupp: kvinnors medianlön i procent av mäns med bootstrapintervall, bara där båda könen når k
 * (konskvotPerGrupp). Ålder 0 är saknad ålder (ADR-64) och räknas inte.
 * @param {any[]} dataKv
 * @param {any[]} dataMa
 * @param {number} k
 */
export function alderGapRader(dataKv, dataMa, k) {
    const fran = ALDERSGRUPPER.map(([f]) => f);
    const { visade, dolda } = konskvotPerGrupp(ALDERSGRUPPER.map(([, namn], g) => {
        const i = r => r.alder > 0 && gruppFor(fran, r.alder) === g && r.lon > 0;
        return [namn, dataKv.filter(i).map(r => r.lon), dataMa.filter(i).map(r => r.lon)];
    }), { k, ki: true });
    return { visade: visade.map(({ nyckel: namn, ...v }) => ({ namn, ...v })), dolda };
}

/**
 * Lönefördelningen per BAS-intervall, eller per kön i varje intervall: de giltiga raderna (lön över 0, med BAS och,
 * per kön, kön), var och en `liten` när intervallet eller könet i intervallet är under k; de små cellerna i ordning
 * och intervallen i BAS-ordning.
 * @param {any[]} rader
 * @param {boolean} perKon
 * @param {number} k
 * @returns {{punkter: Array<{rad:any, kon:'Kvinna'|'Man'|null, liten:boolean}>, utelamnade: string[], ordning: string[]}}
 */
export function lonefordelningPerBas(rader, perKon, k) {
    const kon = r => (arKvinna(r) ? 'Kvinna' : arMan(r) ? 'Man' : null);
    const giltiga = rader.filter(r => r.lon > 0 && r.bas != null && r.bas !== '' && (!perKon || kon(r)));
    const antal = new Map();
    const cell = r => (perKon ? `${r.bas}\u0000${kon(r)}` : String(r.bas));
    for (const r of giltiga) antal.set(cell(r), (antal.get(cell(r)) || 0) + 1);
    const utelamnade = [...antal].filter(([, n]) => n < k).map(([c]) => { const [bas, kn] = c.split('\u0000'); return kn ? `BAS ${bas} (${kn === 'Kvinna' ? 'kvinnor' : 'män'})` : `BAS ${bas}`; })
        .sort((a, b) => a.localeCompare(b, 'sv', { numeric: true }));
    return { punkter: giltiga.map(r => ({ rad: r, kon: kon(r), liten: antal.get(cell(r)) < k })), utelamnade,
        ordning: [...new Set(giltiga.map(r => r.bas))].sort().map(b => 'BAS ' + b) };
}

/** Högst så många paneler i de små multiplarna, och högst så många punkter per panel (var n:te i filens ordning). */
export const MULTIPLAR_MAX = 8, MULTIPLAR_PUNKTER = 1500;

/**
 * De små multiplarna, lön mot ålder per BAS-intervall: de största intervallen som når k (högst MULTIPLAR_MAX), i
 * BAS-ordning. En panel har sina punkter (en `liten` punkt ritas inte; över MULTIPLAR_PUNKTER ritbara visas var n:te,
 * samma varje gång) och trendlinjen ur alla i intervallet.
 * @param {any[]} rader
 * @param {(rad:any) => boolean} liten  individLitenForVid för hela underlaget
 * @param {number} k
 */
export function multiplarPaneler(rader, liten, k) {
    const giltiga = rader.filter(r => r.lon > 0 && r.alder > 0 && r.kon && r.bas != null && r.bas !== '');
    const perBas = new Map();
    for (const r of giltiga) { if (!perBas.has(r.bas)) perBas.set(r.bas, []); perBas.get(r.bas).push(r); }
    const stora = [...perBas].filter(([, g]) => g.length >= k).sort((a, b) => b[1].length - a[1].length);
    const valda = stora.slice(0, MULTIPLAR_MAX).map(([b]) => b).sort();
    const utanfor = [...perBas.keys()].filter(b => !valda.includes(b)).sort().map(b => 'BAS ' + b);
    const paneler = valda.map(bas => {
        const g = perBas.get(bas);
        const ritbara = g.filter(r => !liten(r)), steg = Math.max(1, Math.ceil(ritbara.length / MULTIPLAR_PUNKTER));
        const urval = steg > 1 ? new Set(ritbara.filter((_, i) => i % steg === 0)) : null;
        const punkter = g.filter(r => !urval || liten(r) || urval.has(r)).map(r => ({ rad: r, kon: arKvinna(r) ? 'Kvinna' : arMan(r) ? 'Man' : null, liten: liten(r) }));
        const reg = linjarRegression(g.map(r => [r.alder, r.lon])), [a0, a1] = omfang(g.map(r => r.alder));
        return { bas, punkter, trend: reg ? { reg, a0, a1 } : null, nedsamplad: !!urval };
    });
    return { paneler, utanfor };
}

/**
 * Lönedelen av fliken för ett BAS-intervall eller hela urvalet ('__ALLA__'), eller null med färre än två personer
 * med ålder och kön. Ett köns trendlinje, konfidensband och låda kräver k för det könet; kvoten och lönen vid samma
 * ålder kräver det för båda; hela urvalets trendlinje kräver k personer; en persons punkt ritas bara när personens
 * grupp och kön i gruppen når k (individLitenForVid, räknat på hela underlaget).
 * @param {any[]} rader  hela underlaget (fliken urval)
 * @param {{bas:string, k:number, statistik?:any[], trendAlla?:boolean, termer?:any}} val
 *   statistik: jämförelsestatistiken; trendAlla: hela urvalets trendlinje är vald
 */
export function vymodellAlderOchLon(rader, { bas, k, statistik = [], trendAlla = false, termer = STANDARDTERMER }) {
    const isAll = bas === '__ALLA__';
    const df = rader.filter(d => (isAll || d.bas === bas) && d.alder && d.alder > 0 && d.kon);
    if (df.length < 2) return null;
    const dataKv = df.filter(d => arKvinna(d)), dataMa = df.filter(d => arMan(d));
    const par = rr => rr.map(d => [d.alder, d.lon]);
    const regKv = linjarRegression(par(dataKv)), regMa = linjarRegression(par(dataMa));
    const aldrar = df.map(d => d.alder);
    const [minAlder, maxAlder] = omfang(aldrar);
    const medelAlder = aldrar.reduce((a, b) => a + b, 0) / aldrar.length;
    const kvOk = dataKv.length >= k, maOk = dataMa.length >= k, konOk = kvOk && maOk;
    const kvot = konsMedianer(df, { k }).kvotPct;   // null när ett kön är under k
    // Ett köns regression är null när könet bara har en ålder i urvalet: då finns ingen lutning och ingen justering.
    const medAlder = !!(regKv && regMa);
    const expKv = medAlder ? regKv.m * medelAlder + regKv.b : NaN, expMa = medAlder ? regMa.m * medelAlder + regMa.b : NaN;
    const vidSammaAlder = konOk && medAlder && expMa > 0 ? (expKv / expMa) * 100 : null;
    const liten = individLitenForVid(rader, k);
    // Ett köns trendlinje och band ritas över könets egna åldrar, inte över urvalets: ingen linje utanför underlaget.
    const spannKv = omfang(dataKv.map(d => d.alder)), spannMa = omfang(dataMa.map(d => d.alder));
    return {
        isAll, df, dataKv, dataMa, minAlder, maxAlder, spannKv, spannMa, kvOk, maOk, konOk, kvot, vidSammaAlder,
        // Trendlinjerna bara för ett kön som når k.
        trendKv: kvOk ? regKv : null, trendMa: maOk ? regMa : null,
        insikt: kvot != null && vidSammaAlder != null ? alderInsiktText(/** @type {any} */ (regKv).m, /** @type {any} */ (regMa).m, kvot, vidSammaAlder, termer) : null,
        enAlder: konOk && !medAlder,
        trendAllaOk: df.length >= k,
        trendAlla: trendAlla && df.length >= k ? linjarRegression(par(df)) : null,
        ciKv: kvOk ? regressionslinjensBand(par(dataKv), ...spannKv, 25) : null,
        ciMa: maOk ? regressionslinjensBand(par(dataMa), ...spannMa, 25) : null,
        // En uppslagning per AID×BAS-grupp i urvalet (aldrig ett annat BAS), och medianen av de matchade medianerna.
        statMedian: statistik.length ? statistikensMedianFor(statistik, df.map(d => ({ aid: aidAvYrke(d.yrke), bas: d.bas }))) : null,
        utan: [kvOk ? null : 'kvinnor', maOk ? null : 'män'].filter(Boolean).join(' och '),
        liten, dolda: df.filter(liten).length,
        lada: ladaPerKon(df, k),
        histogram: konHistogram(df, k)
    };
}

// ---- Åldersstrukturen ----
// Åldersklasserna i histogrammet: de undre gränserna, och namnen ur dem. En klass går till nästa klass undre gräns,
// och den första tar alla under 25, så att varje ålder över 0 hamnar i exakt en klass.
const KLASS_FRAN = [0, 25, 30, 35, 40, 45, 50, 55, 60, 65];
export const ALDERSKLASSER = KLASS_FRAN.map((f, i) => (i === 0 ? `Under ${KLASS_FRAN[1]}` : i === KLASS_FRAN.length - 1 ? `${f}+` : `${f}–${KLASS_FRAN[i + 1] - 1}`));
// Sveriges sysselsatta befolkning per femårsgrupp (procent av total). Källa: SCB Arbetskraftsundersökningen (AKU),
// genomsnitt 2023, där den första klassen är 20–24 år. Värdena är avrundade och ska tolkas som ungefärlig referens, inte exakta tal.
export const SYSSELSATTA_PCT = [9, 12, 13, 13, 12, 12, 11, 10, 6, 2];

const perKlass = rader => KLASS_FRAN.map((_, i) => rader.filter(d => d.alder > 0 && gruppFor(KLASS_FRAN, d.alder) === i).length);

/**
 * Åldersfördelningen som kurva: andel av gruppen per ålder, utjämnad med ett centrerat glidande medel (win = halva
 * fönsterbredden), så att en enskild person inte ger en topp.
 * @returns {{ages:number[], share:number[]}}
 */
export function andelPerAlder(rows, lo, hi, win) {
    const total = rows.length;
    const cnt = {};
    rows.forEach(r => { const a = Math.round(r.alder); cnt[a] = (cnt[a] || 0) + 1; });
    const ages = [], share = [];
    for (let a = lo; a <= hi; a++) {
        let s = 0, n = 0;
        for (let x = a - win; x <= a + win; x++) { s += (cnt[x] || 0); n++; }
        ages.push(a);
        share.push(total ? +((s / n) / total * 100).toFixed(2) : 0);
    }
    return { ages, share };
}

/**
 * Lönespridningen över ålder: P10, P25, median, P75 och P90 per femårsgrupp, bara för grupper med minst k personer,
 * eller null med färre än två sådana grupper. `alder` är gruppens första år.
 * @param {any[]} df
 * @param {number} k
 */
export function alderBandRader(df, k) {
    const grupper = new Map();
    for (const r of df) { const a = Number(r.alder), l = Number(r.lon); if (!isFinite(a) || !(l > 0)) continue; const g = Math.floor(a / 5) * 5; if (!grupper.has(g)) grupper.set(g, []); grupper.get(g).push(l); }
    const rader = [...grupper.entries()].sort((x, y) => x[0] - y[0]).filter(([, v]) => v.length >= k).map(([g, v]) => {
        const s = v.slice().sort((x, y) => x - y), q = p => Math.round(kvantil(s, p));
        return { x: g + 2.5, alder: g, namn: `${g}–${g + 4} år`, n: s.length, p10: q(0.1), p25: q(0.25), p50: q(0.5), p75: q(0.75), p90: q(0.9) };
    });
    return rader.length < 2 ? null : rader;
}

/**
 * Åldersstrukturen för ett BAS-intervall eller hela urvalet, eller null med färre än två personer med ålder. Bara
 * antal, andelar och åldrar, inga löner utom lönespridningen över ålder (alderBandRader, med k). Riskerna: andelen
 * 60 år och äldre över 25 % ('manga') eller 15 % ('uppsikt'), under 15 % under 40 år (atervaxt), och i ett
 * BAS-intervall medianåldern mer än 5 år från organisationens ('aldre', 'yngre').
 * @param {any[]} rader  fliken urval
 * @param {{bas:string, k:number, alla:any[]}} val  alla: hela organisationen, för dess medianålder
 */
export function vymodellAldersstruktur(rader, { bas, k, alla }) {
    const isAll = bas === '__ALLA__' || !bas;
    const df = rader.filter(d => (isAll || d.bas === bas) && d.alder > 0);
    if (df.length < 2) return null;
    const n = df.length;
    const pct = c => +(c / n * 100).toFixed(1);
    const basKv = df.filter(d => arKvinna(d)), basMa = df.filter(d => arMan(d));
    const aldrar = df.map(d => d.alder);
    const medianAlder = median(aldrar), orgMedian = median(alla.filter(d => d.alder > 0).map(d => d.alder));
    // Successionszonen är 60+ (motsvarar riktålder 60–67); trösklarna följer den.
    const andel60 = pct(df.filter(d => d.alder >= 60).length), andelU40 = pct(df.filter(d => d.alder < 40).length);
    const alderDiff = +(medianAlder - orgMedian).toFixed(1);
    const [minA, maxA] = omfang(aldrar);
    const aLo = Math.max(18, Math.floor(minA)), aHi = Math.min(67, Math.ceil(maxA));
    return {
        isAll, n, df, pctKv: perKlass(basKv).map(pct), pctMa: perKlass(basMa).map(pct), refPct: SYSSELSATTA_PCT.slice(),
        medianAlder, orgMedian, alderDiff, andel60, andelU40,
        q25: Math.round(kvantil(aldrar, 0.25)), q75: Math.round(kvantil(aldrar, 0.75)),
        pension: andel60 > 25 ? 'manga' : andel60 > 15 ? 'uppsikt' : null,
        atervaxt: andelU40 < 15,
        avvikelse: isAll ? null : alderDiff > 5 ? 'aldre' : alderDiff < -5 ? 'yngre' : null,
        aLo, aHi,
        // Andel av eget kön per ålder, 5-årigt glidande medel (win = 2).
        kurvaKv: andelPerAlder(basKv, aLo, aHi, 2), kurvaMa: andelPerAlder(basMa, aLo, aHi, 2),
        band: alderBandRader(df, k)
    };
}

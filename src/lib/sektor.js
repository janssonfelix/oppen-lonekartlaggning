// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
/**
 * Öppen lönekartläggning — sektorsöversikten (ADR-33).
 *
 * En sektor är ett AID-huvudområde. Per sektor: antal, andel kvinnor, medianer och kvot med samma
 * k-regler som Lika arbete (ett kön under k → samlad median; gruppen under k → maskerad), justerad
 * skillnad med huvudregressionens kodning (kön + ålder när lönefilen har den + BAS som indikatorer, HC3 och
 * t-kvantil; justeradSkillnad i regression.js, ADR-78) när sektorn har ≥ 30 personer och ≥ k av varje
 * kön, och sektorernas andel av gapet i medellön (samma symmetriska formel som del A i
 * gapuppdelning.js, med sektor i stället för BAS). Går modellen med BAS inte att skatta i ett huvudområde med minst två
 * BAS-intervall (kön och BAS går inte att skilja åt) ges inget justerat tal: ett tal utan BAS vore inte justerat för BAS.
 *
 * Webbläsarbygget får en AUTO-GENERERAD spegel i src/app/09-lib-speglar.js.
 */
import { median } from './stat.js';
import { justeradSkillnad, harAlderIRader } from './regression.js';
import { sektorsnamn, jamforSektor } from './aid.js';
import { konOf } from './falt.js';
import { skrKvinnoandelSektor } from './skrreferens.js';
import { skapaTermer, stor } from './termer.js';
import { personOrd } from './namn.js';
import { sammanslagning } from './undertryckning.js';

const T = skapaTermer();

const MIN_REGRESSION = 30;

// Justerad skillnad med huvudregressionens kodning (ADR-78): k-villkoren här, modellen i regression.js.
function _justerat(rader, k, medAlder) {
    const giltiga = rader.filter(r => r.lon > 0 && (!medAlder || r.alder > 0) && konOf(r) !== 'Övrig/okänd');
    const nKv = giltiga.filter(r => konOf(r) === 'Kvinna').length;
    if (giltiga.length < MIN_REGRESSION || nKv < k || giltiga.length - nKv < k) return { just: null, skal: 'fa' };
    const just = justeradSkillnad(giltiga, { medAlder });
    // Räknat utan BAS fast huvudområdet har flera BAS-intervall: talet är inte justerat för BAS och visas inte.
    if (just && !just.medBas && just.antalBas >= 2) return { just: null, skal: 'ejBas' };
    return { just, skal: just ? 'ok' : 'fa' };
}

/**
 * Rubriken och bisatsen för den justerade skillnaden, för vyn och rapportunderlaget (ADR-78): med ålder bara när
 * lönefilen har ålder.
 * @param {{justeratMedAlder?:boolean}[]} tabell - sektorsTabell()
 */
export function sektorJusteradText(tabell) {
    const medAlder = (tabell || []).every(r => r.justeratMedAlder !== false);
    return { medAlder, rubrik: medAlder ? 'Justerad (ålder, BAS)' : 'Justerad (BAS)', justeradFor: `${medAlder ? 'ålder och ' : ''}${T.niva.en}` };
}

/**
 * @param {any[]} rader - lönerader ({ aid, kon, lon, alder, bas, ansvarsgrupp? })
 * @param {{k:number, punkter?:Object<string, number>, skrDel?:string}} opts - punkter i Att göra per sektorsnamn;
 *        skrDel = organisationstypen ('alla' | 'kommun' | 'region') för SKR-referensen
 */
export function sektorsTabell(rader, { k, punkter = {}, skrDel = 'alla' }) {
    const per = new Map();
    for (const r of rader || []) {
        if (!(r.lon > 0)) continue;
        const namn = sektorsnamn(r.aid);
        if (!per.has(namn)) per.set(namn, []);
        per.get(namn).push(r);
    }
    const harAnsvar = (rader || []).some(r => r.ansvarsgrupp);
    const medAlder = harAlderIRader(rader);   // lönefilen har ålder (ADR-64): gäller alla huvudområden
    return [...per.keys()].sort(jamforSektor).map(namn => {
        const g = per.get(namn);
        const kv = g.filter(r => konOf(r) === 'Kvinna'), ma = g.filter(r => konOf(r) === 'Man');
        const n = g.length, maskerad = n < k;
        const bada = kv.length >= k && ma.length >= k;
        const medKv = !maskerad && bada ? median(kv.map(r => r.lon)) : null;
        const medMa = !maskerad && bada ? median(ma.map(r => r.lon)) : null;
        const just = maskerad ? { just: null, skal: null } : _justerat(g, k, medAlder);
        const andelLedning = grupp => (grupp.length ? grupp.filter(r => r.ansvarsgrupp === 'ledning').length / grupp.length * 100 : null);
        return {
            namn, n, nKv: kv.length, nMa: ma.length,
            andelKv: n ? kv.length / n * 100 : null,
            skrAndelKv: skrKvinnoandelSektor(namn, { del: skrDel })?.pct ?? null,   // referens: SKR:s personalstatistik
            skrDel: skrKvinnoandelSektor(namn, { del: skrDel })?.del ?? null,
            maskerad, samladMedian: !maskerad && !bada,
            medTot: maskerad ? null : median(g.map(r => r.lon)),
            medKv, medMa, kvot: medKv != null && medMa != null && medMa > 0 ? medKv / medMa * 100 : null,
            justerat: just.just, justeratSkal: just.skal,   // 'ok' | 'fa' (för få) | 'ejBas' (kön och BAS går inte att skilja åt)
            justeratMedAlder: medAlder,   // rubriken och texterna säger vad som justeras för
            antalAid: new Set(g.map(r => r.aid)).size,
            punkter: punkter[namn] || 0,
            ledningKv: harAnsvar && !maskerad && kv.length >= k ? andelLedning(kv) : null,
            ledningMa: harAnsvar && !maskerad && ma.length >= k ? andelLedning(ma) : null,
        };
    });
}

/**
 * Sektorernas andel av gapet i medellön (män − kvinnor): Σ_s Δs_s · (W̄_s − W̄).
 * Null när ett kön har färre än k personer: gapet i kronor tillsammans med gapet i procent
 * (Struktur) ger annars det lilla könets medellön — samma regel som gapuppdelning.js.
 *
 * Huvudområden där ett kön har 1 till k − 1 personer räknas samman med andra (ADR-87, `sammanslagning` i
 * undertryckning.js), samma regel som del A i gapuppdelning.js: annars ger beloppet sektorKr tillsammans med kvinnornas
 * och männens medellön och antalen ett litet områdes medellön (med två huvudområden är det en ekvation med en okänd).
 * `sammanslagna` är de sammanräknade områdenas namn i tabellens ordning och `sma` de av dem där ett kön har för få.
 * Räknas alla samman till ett är sektorKr och andel null: beloppet vore noll och säger ingenting om fördelningen.
 */
export function sektorernasAndel(rader, { k = 10 } = {}) {
    const kv = (rader || []).filter(r => r.lon > 0 && konOf(r) === 'Kvinna');
    const ma = (rader || []).filter(r => r.lon > 0 && konOf(r) === 'Man');
    if (!kv.length || !ma.length || kv.length < k || ma.length < k) return null;
    const medel = a => a.reduce((s, r) => s + r.lon, 0) / a.length;
    const gapKr = medel(ma) - medel(kv);
    const namn = [...new Set([...kv, ...ma].map(r => sektorsnamn(r.aid)))];
    const grupper = namn.map(s => ({ s, k: kv.filter(r => sektorsnamn(r.aid) === s), m: ma.filter(r => sektorsnamn(r.aid) === s) }));
    const samman = sammanslagning(grupper.map(g => ({ namn: g.s, nKv: g.k.length, nMa: g.m.length })), k);
    const egna = grupper.filter((_, i) => !samman.includes(i));
    const delar = samman.length ? [...egna, { s: null, k: samman.flatMap(i => grupper[i].k), m: samman.flatMap(i => grupper[i].m) }] : egna;
    const cell = ({ k, m }) => {
        const wK = k.length ? medel(k) : medel(m), wM = m.length ? medel(m) : medel(k);
        return { dS: m.length / ma.length - k.length / kv.length, w: (wK + wM) / 2, sBar: (m.length / ma.length + k.length / kv.length) / 2 };
    };
    const ordnade = ix => ix.map(i => grupper[i].s).sort(jamforSektor);
    const liten = n => n > 0 && n < k;
    const sammanslagna = ordnade(samman), sma = ordnade(samman.filter(i => liten(grupper[i].k.length) || liten(grupper[i].m.length)));
    if (samman.length && delar.length < 2) return { gapKr, sektorKr: null, andel: null, sammanslagna, sma };
    const celler = delar.map(cell);
    const wBar = celler.reduce((s, c) => s + c.sBar * c.w, 0);
    const sektorKr = celler.reduce((s, c) => s + c.dS * (c.w - wBar), 0);
    return { gapKr, sektorKr, andel: Math.abs(gapKr) > 1e-9 ? sektorKr / gapKr : null, sammanslagna, sma };
}

/**
 * Meningen om sammanräknade huvudområden under beloppet (vyn och rapportunderlaget, ADR-87), eller '' när inget
 * räknats samman. Namnger områdena; antal och namn omfattas inte av skyddet (ADR-70).
 * @param {{sektorKr:number|null, sammanslagna?:string[], sma?:string[]}|null} a - sektorernasAndel()
 * @param {number} k
 */
export function sektorAndelNot(a, k) {
    if (!a || !a.sammanslagna || !a.sammanslagna.length) return '';
    const lista = l => (l.length <= 1 ? (l[0] || '') : `${l.slice(0, -1).join(', ')} och ${l[l.length - 1]}`);
    const orsak = `ett kön har färre än ${k} ${personOrd(k)} i ${lista(a.sma || [])}`;
    const varfor = `Annars skulle medellönen för färre än ${k} kvinnor eller män gå att räkna fram ur beloppet.`;
    if (a.sektorKr == null) {
        return `Hur mycket av skillnaden som beror på att kvinnor och män arbetar i olika ${T.huvudomrade.fl} redovisas inte, eftersom ${orsak}. ${varfor}`;
    }
    return `${stor(T.huvudomrade.bfl)} ${lista(a.sammanslagna)} räknas här samman, eftersom ${orsak}. ${varfor}`;
}

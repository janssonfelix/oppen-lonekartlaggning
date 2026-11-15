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
 * gapuppdelning.js, med sektor i stället för BAS).
 *
 * Webbläsarbygget får en AUTO-GENERERAD spegel i src/app/09-lib-speglar.js.
 */
import { median } from './stat.js';
import { justeradSkillnad, harAlderIRader } from './regression.js';
import { sektorsnamn, jamforSektor } from './aid.js';
import { konOf } from './falt.js';
import { skrKvinnoandelSektor } from './skrreferens.js';

const MIN_REGRESSION = 30;

// Justerad skillnad med huvudregressionens kodning (ADR-78): k-villkoren här, modellen i regression.js.
function _justerat(rader, k, medAlder) {
    const giltiga = rader.filter(r => r.lon > 0 && (!medAlder || r.alder > 0) && konOf(r) !== 'Övrig/okänd');
    const nKv = giltiga.filter(r => konOf(r) === 'Kvinna').length;
    if (giltiga.length < MIN_REGRESSION || nKv < k || giltiga.length - nKv < k) return null;
    return justeradSkillnad(giltiga, { medAlder });
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
        const just = maskerad ? null : _justerat(g, k, medAlder);
        const andelLedning = grupp => (grupp.length ? grupp.filter(r => r.ansvarsgrupp === 'ledning').length / grupp.length * 100 : null);
        return {
            namn, n, nKv: kv.length, nMa: ma.length,
            andelKv: n ? kv.length / n * 100 : null,
            skrAndelKv: skrKvinnoandelSektor(namn, { del: skrDel })?.pct ?? null,   // referens: SKR:s personalstatistik
            skrDel: skrKvinnoandelSektor(namn, { del: skrDel })?.del ?? null,
            maskerad, samladMedian: !maskerad && !bada,
            medTot: maskerad ? null : median(g.map(r => r.lon)),
            medKv, medMa, kvot: medKv != null && medMa != null && medMa > 0 ? medKv / medMa * 100 : null,
            justerat: just, justeratSkal: maskerad ? null : (just ? 'ok' : 'fa'),
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
 */
export function sektorernasAndel(rader, { k = 10 } = {}) {
    const kv = (rader || []).filter(r => r.lon > 0 && konOf(r) === 'Kvinna');
    const ma = (rader || []).filter(r => r.lon > 0 && konOf(r) === 'Man');
    if (!kv.length || !ma.length || kv.length < k || ma.length < k) return null;
    const medel = a => a.reduce((s, r) => s + r.lon, 0) / a.length;
    const gapKr = medel(ma) - medel(kv);
    const namn = [...new Set([...kv, ...ma].map(r => sektorsnamn(r.aid)))];
    const cell = s => {
        const k = kv.filter(r => sektorsnamn(r.aid) === s), m = ma.filter(r => sektorsnamn(r.aid) === s);
        const wK = k.length ? medel(k) : medel(m), wM = m.length ? medel(m) : medel(k);
        return { dS: m.length / ma.length - k.length / kv.length, w: (wK + wM) / 2, sBar: (m.length / ma.length + k.length / kv.length) / 2 };
    };
    const celler = namn.map(cell);
    const wBar = celler.reduce((s, c) => s + c.sBar * c.w, 0);
    const sektorKr = celler.reduce((s, c) => s + c.dS * (c.w - wBar), 0);
    return { gapKr, sektorKr, andel: Math.abs(gapKr) > 1e-9 ? sektorKr / gapKr : null };
}

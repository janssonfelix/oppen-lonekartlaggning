// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
/**
 * Öppen lönekartläggning — AID:s ansvarskod (ADR-33; AID-handboken s. 9–13).
 *
 * Koder: A, B, C (chef), L (annan ledningspersonal), F (funktionsansvar), M (läkare med bakjour
 * eller medicinskt ansvarsområde), 1001 (lektor), 1002 (förstelärare). En sista position kan
 * användas lokalt (C1, 10013) och ignoreras. Flera koder per person tillåts. Analyserna använder
 * bara tre ansvarsgrupper. Kolumnen "Ansvar" är oftast ett kostnadsställe och läses aldrig.
 *
 * Webbläsarbygget får en AUTO-GENERERAD spegel i src/app/09-lib-speglar.js.
 */
import { median } from './stat.js';
import { konOf } from './falt.js';

export const ANSVARSGRUPP_NAMN = Object.freeze({ ledning: 'Ledningsansvar', uppdrag: 'Särskilt uppdrag', inget: 'Inget särskilt ansvar' });
const LEDNING = new Set(['A', 'B', 'C', 'L']);
const EN_KOD = /^(?:([ABCLFM])[0-9A-Z]?|(100[12])[0-9A-Z]?)$/;

/** Ett cellvärde → lista med koder; [] för tomt; null om något ingående värde är ogiltigt. */
export function tolkaAnsvarskod(v) {
    const s = String(v ?? '').trim().toUpperCase();
    if (!s) return [];
    const delar = s.split(/[\s,;]+/).filter(Boolean);
    const ut = [];
    for (const d of delar) {
        const m = EN_KOD.exec(d);
        if (!m) return null;
        const kod = m[1] || m[2];
        if (!ut.includes(kod)) ut.push(kod);
    }
    return ut;
}

/** 'ledning' om någon kod är A, B, C eller L; annars 'uppdrag' om F, M, 1001 eller 1002; annars 'inget'. */
export function ansvarsgrupp(koder) {
    const k = koder || [];
    if (k.some(x => LEDNING.has(x))) return 'ledning';
    return k.length ? 'uppdrag' : 'inget';
}

/** Andelen giltiga av de ifyllda värdena, eller null om inga är ifyllda. */
export function andelGiltiga(varden) {
    const ifyllda = (varden || []).filter(v => String(v ?? '').trim());
    if (!ifyllda.length) return null;
    return ifyllda.filter(v => tolkaAnsvarskod(v) !== null).length / ifyllda.length;
}

/** Kolumnrubrik som anger AID:s ansvarskod — aldrig bara "Ansvar". */
export function arAnsvarskodRubrik(rubrik) {
    const r = String(rubrik ?? '').toLowerCase().replace(/å/g, 'a').replace(/ä/g, 'a').replace(/ö/g, 'o').replace(/[^a-z0-9]/g, '');
    return /ansvarskod|aidansvar|ansvarsniva/.test(r);
}

const ORDNING = ['ledning', 'uppdrag', 'inget'];

/**
 * Underrader per ansvarsgrupp inom en grupp (Lika arbete), med samma k-regler som yrkesraden:
 * gruppen under k → inga lönemått; ett kön under k → samlad median utan könsjämförelse.
 * @param {any[]} rader
 * @param {{k:number}} opts
 * @returns {any[]}
 */
export function ansvarsUnderrader(rader, { k }) {
    return ORDNING.map(grupp => {
        const g = (rader || []).filter(r => r.ansvarsgrupp === grupp && r.lon > 0);
        if (!g.length) return null;
        const kv = g.filter(r => konOf(r) === 'Kvinna'), ma = g.filter(r => konOf(r) === 'Man');
        const liten = g.length < k, bada = kv.length >= k && ma.length >= k;
        const medKv = !liten && bada ? median(kv.map(r => r.lon)) : null;
        const medMa = !liten && bada ? median(ma.map(r => r.lon)) : null;
        return { grupp, namn: ANSVARSGRUPP_NAMN[grupp], n: g.length, nKv: kv.length, nMa: ma.length, liten,
            samladMedian: !liten && !bada, medTot: liten ? null : median(g.map(r => r.lon)),
            medKv, medMa, kvot: medKv != null && medMa != null && medMa > 0 ? medKv / medMa * 100 : null };
    }).filter(Boolean);
}


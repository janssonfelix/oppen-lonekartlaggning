// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
/**
 * Öppen lönekartläggning — underlagets kvalitet (ADR-19).
 *
 * Inget viktat index: fem kriterier får status
 * OK / Varning / Kritisk; helheten är det sämsta kriteriet, så en allvarlig brist
 * kan inte spädas ut av andra delar. Könsfördelningen i organisationen är inget
 * kvalitetskriterium — den är ett fynd (könsskevhet).
 */
import { konOf } from './falt.js';

const RANG = { ok: 0, varning: 1, kritisk: 2 };
const FTE_GOLV = 20000;

function _stat(v, okGrans, varnGrans, hogreArBattre) {
    if (v == null || !isFinite(v)) return 'kritisk';
    if (hogreArBattre) return v >= okGrans ? 'ok' : v >= varnGrans ? 'varning' : 'kritisk';
    return v <= okGrans ? 'ok' : v <= varnGrans ? 'varning' : 'kritisk';
}
const _pct = v => (v == null || !isFinite(v)) ? '–' : `${(Math.round(v * 10) / 10).toLocaleString('sv-SE')} %`;

/** BAS där båda könen har minst k personer (samma regel som maskeringen). */
export function jamforbaraBas(rader, k) {
    const perBas = new Map();
    for (const r of rader || []) {
        const kon = konOf(r);
        if (kon === 'Övrig/okänd' || !r.bas) continue;
        const g = perBas.get(r.bas) || { kv: 0, ma: 0 };
        if (kon === 'Kvinna') g.kv++; else g.ma++;
        perBas.set(r.bas, g);
    }
    const jamforbara = [], maskerade = [];
    let iJamforbara = 0, totalt = 0;
    for (const bas of [...perBas.keys()].sort((a, b) => a.localeCompare(b, 'sv'))) {
        const g = perBas.get(bas);
        totalt += g.kv + g.ma;
        if (g.kv >= k && g.ma >= k) { jamforbara.push(bas); iJamforbara += g.kv + g.ma; }
        else maskerade.push(bas);
    }
    return { jamforbara, maskerade, andelPersoner: totalt ? iJamforbara / totalt : null };
}

/** Minsta upptäckbara skillnad i % (80 % styrka, α = 0,05) ur könskoefficientens SE (log-skala). */
export function mdeFranSe(se) {
    if (typeof se !== 'number' || !isFinite(se) || se <= 0) return null;
    return (Math.exp(2.802 * se) - 1) * 100;
}

/**
 * @param {any[]} rader
 * @param {{k?:number, audit?:any, mde?:number|null, modell?:any}} [opts]
 */
export function bedomUnderlag(rader, { k, audit, mde, modell } = {}) {
    const d = rader || [];
    const kriterier = [];

    const j = jamforbaraBas(d, k);
    const jPct = j.andelPersoner == null ? null : j.andelPersoner * 100;
    kriterier.push({
        id: 'jamforbarhet', namn: 'Jämförbarhet', status: _stat(jPct, 80, 50, true), varde: jPct,
        text: jPct == null
            ? 'Inga personer med känt kön att jämföra.'
            : `${_pct(jPct)} av personalen finns i BAS-intervall där båda könen har minst ${k} personer`
              + (j.maskerade.length ? ` (${j.maskerade.length} BAS-intervall maskeras: ${j.maskerade.join(', ')}).` : '.'),
    });

    kriterier.push({
        id: 'styrka', namn: 'Statistisk styrka', status: _stat(mde, 2, 5, false), varde: mde,
        text: mde == null
            ? 'Styrkan kunde inte beräknas eftersom regressionen inte gick att skatta.'
            : `Den minsta könsskillnad analysen säkert kan upptäcka är ${_pct(mde)}.`
              + (mde > 5 ? ' Skillnader kring 5 % kan alltså passera oupptäckta.' : ''),
    });

    const bort = audit && audit.totalRaw > 0
        ? ((audit.excludedNoBas || 0) + (audit.excludedZeroLon || 0) + (audit.excludedMissingKon || 0)
           + Math.max(0, (audit.invalidAlder || 0) - (audit.invalidAlderUtesluten || 0))) / audit.totalRaw * 100
        : null;
    kriterier.push({
        id: 'fullstandighet', namn: 'Fullständighet', status: bort == null ? 'varning' : _stat(bort, 2, 10, false), varde: bort,
        text: bort == null
            ? 'Inläsningens räknare saknas; bortfallet är okänt.'
            : `${_pct(bort)} av filens rader föll bort eller saknar giltig ålder.`
    });

    const orimliga = d.filter(r => !(r.lon >= FTE_GOLV && r.lon <= 250000)
        || !(r.alder >= 18 && r.alder <= 70) || !/^[A-J]$/i.test(r.bas || '')).length;
    const orimPct = d.length ? orimliga / d.length * 100 : null;
    kriterier.push({
        id: 'rimlighet', namn: 'Rimlighet', status: _stat(orimPct, 1, 5, false), varde: orimPct,
        text: orimPct == null ? 'Inga rader att kontrollera.'
            : `${orimliga} rader (${_pct(orimPct)}) har lön under ${FTE_GOLV.toLocaleString('sv-SE')} eller över 250 000 kr, ålder utanför 18–70 eller BAS utanför A–J.`,
    });

    const mStatus = modell === 'full' ? 'ok' : modell === 'minimal' ? 'varning' : 'kritisk';
    kriterier.push({
        id: 'modell', namn: 'Modell', status: mStatus, varde: modell ?? null,
        text: modell === 'full' ? 'Regressionen tar hänsyn till både ålder och BAS-intervall.'
            : modell === 'minimal' ? 'Regressionen kunde bara ta hänsyn till ålder, inte BAS-intervall.'
            : 'Regressionen gick inte att skatta.',
    });

    const status = kriterier.reduce((s, c) => RANG[c.status] > RANG[s] ? c.status : s, 'ok');
    return { status, kriterier };
}

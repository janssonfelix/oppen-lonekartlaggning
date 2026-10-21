// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
/**
 * Öppen lönekartläggning — kontroll av AID-kodningen (ADR-33).
 * Kriterierna har samma form som i datakvalitet.js och läggs till i Underlagets kvalitet.
 * Texterna redovisar antal och koder, aldrig enskilda personer eller löner.
 *
 * Webbläsarbygget får en AUTO-GENERERAD spegel i src/app/09-lib-speglar.js.
 */
import { etikett, huvudomrade, arRestkod, arLedningsetikett, normaliseraAid } from './aid.js';
import { quantile } from './stat.js';

const RESTKOD_GRANS = 10;      // % av personerna
const SPRIDNING_GRANS = 1.6;   // P90/P10

const pers = n => `${n} ${n === 1 ? 'person' : 'personer'}`;

/**
 * @param {any[]} rader
 * @param {{k:number, harAnsvar?:boolean}} opts
 */
export function aidKriterier(rader, { k, harAnsvar = false }) {
    const alla = (rader || []).filter(Boolean);
    // En yrkeskolumn utan sexsiffriga koder (t.ex. befattningar i klartext) har ingen AID-kodning att pröva.
    const d = alla.filter(r => normaliseraAid(r.aid));
    if (!d.length) return [];
    const utanKod = alla.length - d.length;
    const ut = [];

    const okanda = d.filter(r => !etikett(r.aid) || !huvudomrade(r.aid));
    const okandaKoder = [...new Set(okanda.map(r => normaliseraAid(r.aid)))].slice(0, 5);
    const delar = [];
    if (okanda.length) delar.push(`${pers(okanda.length)} har en AID-kod som inte finns i SKR:s etikettlista (t.ex. ${okandaKoder.join(', ')}).`);
    if (utanKod) delar.push(`${pers(utanKod)} saknar en sexsiffrig AID-kod.`);
    ut.push({ id: 'aid-okanda', namn: 'AID-koder', status: delar.length ? 'varning' : 'ok', varde: okanda.length + utanKod,
        text: delar.length
            ? `${delar.join(' ')} De ingår i analyserna men får ingen sektor.`
            : 'Alla AID-koder finns i SKR:s etikettlista.' });

    const rest = d.filter(r => arRestkod(r.aid)).length;
    const restPct = d.length ? rest / d.length * 100 : 0;
    ut.push({ id: 'aid-restkoder', namn: 'Restkoder (annan/annat)', status: restPct > RESTKOD_GRANS ? 'varning' : 'ok', varde: restPct,
        text: !rest ? 'Ingen har en restkod (…090).'
            : `${pers(rest)} (${restPct.toFixed(1).replace('.', ',')} %) har en restkod (…090).`
            + (restPct > RESTKOD_GRANS ? ' Jämförelserna inom dessa grupper blir grövre — granska om en annan etikett passar bättre.' : '') });

    const per = new Map();
    d.forEach(r => { const key = normaliseraAid(r.aid); if (!per.has(key)) per.set(key, []); per.get(key).push(r.lon); });
    const breda = [...per].filter(([, l]) => l.length >= k).map(([aid, l]) => {
        const p10 = quantile(l, 0.1), p90 = quantile(l, 0.9);
        return { aid, kvot: p10 > 0 ? p90 / p10 : null };
    }).filter(x => x.kvot != null && x.kvot > SPRIDNING_GRANS);
    ut.push({ id: 'aid-spridning', namn: 'Lönespridning inom AID', status: breda.length ? 'varning' : 'ok', varde: breda.length,
        text: breda.length
            ? `${breda.length} AID-grupper har ovanligt stor lönespridning (P90/P10 över ${String(SPRIDNING_GRANS).replace('.', ',')}): ${breda.slice(0, 5).map(x => x.aid).join(', ')}. Värt att granska — det kan tyda på att olika arbeten har samma kod.`
            : 'Ingen AID-grupp har ovanligt stor lönespridning.' });

    if (harAnsvar) {
        const utanKod = d.filter(r => arLedningsetikett(r.aid) && !(r.ansvarskoder || []).some(x => 'ABCL'.includes(x) && x.length === 1)).length;
        ut.push({ id: 'aid-ledning-utan-ansvar', namn: 'Ledningsetikett utan ansvarskod', status: utanKod ? 'varning' : 'ok', varde: utanKod,
            text: utanKod ? `${pers(utanKod)} har en ledningsetikett (10xxxx) utan ansvarskod A, B, C eller L, som etikettlistan kräver.`
                : 'Alla med ledningsetikett har ansvarskod.' });
        const otillatna = d.filter(r => {
            const e = etikett(r.aid);
            return e && (r.ansvarskoder || []).some(x => !e.ansvarskoder.includes(x));
        }).length;
        ut.push({ id: 'aid-otillaten-ansvarskod', namn: 'Ansvarskod och etikett', status: otillatna ? 'varning' : 'ok', varde: otillatna,
            text: otillatna ? `${pers(otillatna)} har en ansvarskod som etikettlistan inte tillåter för etiketten (t.ex. A utanför ledningsarbete, F på en ledningsetikett, M för någon som inte är läkare).`
                : 'Alla ansvarskoder är tillåtna för sina etiketter.' });
    }
    return ut;
}

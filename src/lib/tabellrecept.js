// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
/**
 * Öppen lönekartläggning — egna tabeller i rapporten (ADR-52).
 *
 * En tabell som användaren byggt i Utforska sparas som ett RECEPT — rader, kolumner, mått, urval och om tabellen ska
 * upprepas per BAS-intervall — aldrig som tal. Recepten ritas om i exportläget när Word-utkastet, PDF-rapporten och
 * Excel-filen byggs, med samma pivot som fliken (computePivot) och samma regler för minsta gruppstorlek som Utforskas
 * export: en cell under tröskeln blir tom, och rader och kolumner som bara har tomma celler utelämnas och räknas.
 *
 * Webbläsarbygget får en AUTO-GENERERAD spegel i src/app/09-lib-speglar.js.
 */
import { computePivot } from './utforska.js';

// Samma listor som i src/lib/utforska.js (DIMENSIONER, MATT); tests/tabellrecept.test.js vaktar att de är lika.
const DIMENSIONER = ['bas', 'aid', 'alder', 'kon', 'alla', 'aidbas', 'lonespann', 'sektor', 'aidniva'];
const MATT = ['median', 'medel', 'n', 'p10', 'p25', 'p75', 'p90', 'spridning', 'andelKv', 'gap'];
export const RECEPT_DIMENSIONER = DIMENSIONER, RECEPT_MATT = MATT;

export const DIM_ETIKETT = Object.freeze({
    bas: 'BAS-intervall', aid: 'Yrkesgrupp (AID)', alder: 'Åldersgrupp', kon: 'Kön',
    aidbas: 'Yrkesgrupp inom BAS', lonespann: 'Lönespann', alla: 'Hela urvalet',
    sektor: 'Sektor (AID-huvudområde)', aidniva: 'AID-mellannivå'
});
export const MATT_ETIKETT = Object.freeze({
    median: 'Median månadslön', medel: 'Medellön', n: 'Antal (n)',
    p10: 'P10', p25: 'P25', p75: 'P75', p90: 'P90',
    spridning: 'Spridning (P90/P10)', andelKv: 'Andel kvinnor (%)', gap: 'Kvinnors median i % av mäns'
});
/** Kolumntyp i rapportmodellen per mått (58-rapportmodell.js: rmCell). */
export const MATT_TYP = Object.freeze({
    median: 'kr', medel: 'kr', n: 'antal', p10: 'kr', p25: 'kr', p75: 'kr', p90: 'kr', spridning: 'tal2', andelKv: 'pct1', gap: 'pct1'
});
export const UPPREPNING = ['bas'];
const MAX_NAMN = 80;

let _nr = 0;
/** Ett nytt recept ur Utforskas spec. Namnet kortas till 80 tecken; utan namn får tabellen en beskrivning som namn.
 * @param {any} spec
 * @param {{namn?: string, upprepa?: string|null}} [val] */
export function nyttRecept(spec, { namn = '', upprepa = null } = {}) {
    const r = valideraRecept({ id: `t${Date.now().toString(36)}${(++_nr).toString(36)}`, namn: String(namn || '').trim().slice(0, MAX_NAMN), spec, upprepa });
    if (r && !r.namn) r.namn = receptBeskrivning(r);
    return r;
}

/** Receptet i giltig form, eller null när det inte går att använda (okänd dimension eller okänt mått). */
export function valideraRecept(r) {
    if (!r || typeof r !== 'object' || !r.spec || typeof r.spec !== 'object') return null;
    const s = r.spec;
    if (!DIMENSIONER.includes(s.rad)) return null;
    const kolumn = s.kolumn && s.kolumn !== s.rad && DIMENSIONER.includes(s.kolumn) ? s.kolumn : null;
    const matt = MATT.includes(s.matt) ? s.matt : 'median';
    const urval = s.urval && typeof s.urval === 'object' && Array.isArray(s.urval.villkor)
        ? { lage: s.urval.lage === 'nagot' ? 'nagot' : 'alla', villkor: s.urval.villkor.filter(v => v && typeof v === 'object').map(v => ({ ...v })) }
        : { lage: 'alla', villkor: [] };
    const gruppVillkor = Array.isArray(s.gruppVillkor) ? s.gruppVillkor.filter(g => g && typeof g === 'object').map(g => ({ ...g })) : [];
    return {
        id: typeof r.id === 'string' && r.id ? r.id.slice(0, 40) : `t${Date.now().toString(36)}`,
        namn: String(r.namn || '').trim().slice(0, MAX_NAMN),
        spec: { rad: s.rad, kolumn, matt, delaKon: !!s.delaKon, slaIhop: !!s.slaIhop, urval, gruppVillkor },
        upprepa: UPPREPNING.includes(r.upprepa) && r.upprepa !== s.rad && r.upprepa !== kolumn ? r.upprepa : null
    };
}

/** En rad som beskriver receptet: "Median månadslön per Yrkesgrupp (AID) och Kön, kvinnor och män var för sig, en tabell per BAS-intervall". */
export function receptBeskrivning(r) {
    const s = r.spec;
    const delar = [`${MATT_ETIKETT[s.matt]} per ${DIM_ETIKETT[s.rad]}${s.kolumn ? ` och ${DIM_ETIKETT[s.kolumn]}` : ''}`];
    if (s.delaKon) delar.push('kvinnor och män var för sig');
    if (s.urval.villkor.length) delar.push(`${s.urval.villkor.length} ${s.urval.villkor.length === 1 ? 'villkor' : 'villkor'} i urvalet`);
    if (s.gruppVillkor.length) delar.push('gruppvillkor');
    if (r.upprepa) delar.push(`en tabell per ${DIM_ETIKETT[r.upprepa]}`);
    return delar.join(', ');
}

const _bas = rows => [...new Set(rows.map(r => String(r.bas ?? '')).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'sv'));
const _nText = c => `${c.n} (${c.nKv}/${c.nMa})`;

/**
 * Tabellerna ur ett recept, i rapportmodellens form: { rubrik, kolumner: [{rubrik, typ}], rader: [[...]], utelamnade, not }.
 * Flera tabeller när receptet upprepas per BAS-intervall. Tröskeln k tillämpas här.
 * @param {any[]} rows
 * @param {any} recept
 * @param {{k?: number}} [opt]
 * @returns {Array<{rubrik: string, kolumner: {rubrik: string, typ: string}[], rader: any[][], utelamnade: number, not: string}>}
 */
export function receptTillTabeller(rows, recept, { k = 10 } = {}) {
    const r = valideraRecept(recept);
    if (!r) return [];
    const bygg = (rader, rubrik) => _tabell(computePivot(rader, r.spec, { k }), r.spec, k, rubrik);
    if (r.upprepa === 'bas') {
        return /** @type {any[]} */ (_bas(rows).map(b => bygg(rows.filter(x => String(x.bas) === b), `${r.namn} — BAS ${b}`)).filter(t => t && t.rader.length));
    }
    const t = bygg(rows, r.namn);
    return t && t.rader.length ? [t] : [];   // en tabell där ingen grupp når tröskeln utelämnas (anroparen anger det)
}

function _tabell(model, spec, k, rubrik) {
    if (!model || !model.celler.length) return null;
    const dim = DIM_ETIKETT[spec.rad], typ = MATT_TYP[spec.matt] || 'kr';
    let kolumner, rader, utelamnade = 0;
    if (spec.kolumn) {
        const byKey = new Map(model.celler.map(c => [c.rad + '\u0000' + c.kol, c]));
        const kol = (model.kolumnEtiketter || []).flatMap(kl => spec.delaKon
            ? [{ kl, rubrik: `${kl} · Kvinnor`, v: c => c.valueKv, n: c => c.nKv }, { kl, rubrik: `${kl} · Män`, v: c => c.valueMa, n: c => c.nMa }]
            : [{ kl, rubrik: kl, v: c => c.value, n: c => c.n }]);
        const liten = (c, d) => c.liten || d.n(c) < k;
        const varde = (c, d) => {
            if (!c) return null;
            if (spec.matt === 'n' && !c.liten) return d.n(c);                      // antal är inte ett lönemått
            if (liten(c, d) || (spec.matt === 'gap' && c.konLiten)) return null;
            return d.v(c);
        };
        const matris = model.radEtiketter.map(rk => kol.map(d => varde(byKey.get(rk + '\u0000' + d.kl), d)));
        const kolMed = kol.map((_, j) => matris.some(rad => rad[j] != null));
        const radMed = matris.map(rad => rad.some(v => v != null));
        utelamnade = radMed.filter(x => !x).length;
        kolumner = [{ rubrik: `${dim} \\ ${DIM_ETIKETT[spec.kolumn]}`, typ: 'text' }, ...kol.filter((_, j) => kolMed[j]).map(d => ({ rubrik: d.rubrik, typ }))];
        rader = model.radEtiketter.map((rk, i) => [rk, ...matris[i].filter((_, j) => kolMed[j])]).filter((_, i) => radMed[i]);
    } else if (spec.delaKon) {
        const synliga = model.celler.filter(c => !c.liten);
        utelamnade = model.celler.length - synliga.length;
        kolumner = [{ rubrik: dim, typ: 'text' }, { rubrik: 'Kvinnor', typ }, { rubrik: 'Män', typ }, { rubrik: 'n (K/M)', typ: 'text' }];
        const v = (c, n, x) => (spec.matt === 'n' || n >= k ? x : null);
        rader = synliga.map(c => [c.rad, v(c, c.nKv, c.valueKv), v(c, c.nMa, c.valueMa), _nText(c)]);
    } else {
        const synliga = model.celler.filter(c => !c.liten);
        utelamnade = model.celler.length - synliga.length;
        kolumner = [{ rubrik: dim, typ: 'text' }, { rubrik: MATT_ETIKETT[spec.matt], typ }, { rubrik: 'n (K/M)', typ: 'text' }];
        rader = synliga.map(c => [c.rad, spec.matt === 'gap' && c.konLiten ? null : c.value, _nText(c)]);
    }
    const noter = [];
    if (utelamnade) noter.push(`${utelamnade} ${utelamnade === 1 ? 'grupp' : 'grupper'} med färre än ${k} personer redovisas inte.`);
    if (model.dolda) noter.push(`${model.dolda} ${model.dolda === 1 ? 'grupp' : 'grupper'} döljs av gruppvillkoren.`);
    return { rubrik, kolumner, rader, utelamnade, not: noter.join(' ') };
}

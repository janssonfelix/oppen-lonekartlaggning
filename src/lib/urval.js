// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
/**
 * Öppen lönekartläggning — Urval: villkor i Utforska
 *
 * Personvillkor ({ lage: 'alla'|'nagot', villkor: [{ falt, op, varde, inte }] })
 * avgör vilka personer som ingår innan grupperna räknas. Gruppvillkor
 * ([{ matt, op, varde }], alla måste gälla) avgör vilka grupper som visas efter
 * att måtten räknats (src/lib/utforska.js gör själva uträkningen).
 *
 * Regler: ofullständiga villkor ignoreras; ett
 * saknat värde uppfyller aldrig ett villkor, inte heller när det är vänt med
 * `inte`; `mellan` är inklusive och tål omvända gränser.
 *
 * Webbläsarbygget får en AUTO-GENERERAD spegel i src/app/09-lib-speglar.js.
 */
import { groupKey } from './falt.js';

const FALT = {
    bas:         { typ: 'kategori', etikett: 'BAS', dim: 'bas' },
    aid:         { typ: 'kategori', etikett: 'Yrkesgrupp', dim: 'aid' },
    sektor:      { typ: 'kategori', etikett: 'Sektor', dim: 'sektor' },
    aldersgrupp: { typ: 'kategori', etikett: 'Åldersgrupp', dim: 'alder' },
    kon:         { typ: 'kategori', etikett: 'Kön', dim: 'kon' },
    lon:         { typ: 'tal', etikett: 'Lön', enhet: 'kr' },
    alder:       { typ: 'tal', etikett: 'Ålder', enhet: 'år' }
};
const GRUPP_MATT = {
    median:    { etikett: 'median', enhet: 'kr' },
    medel:     { etikett: 'medellön', enhet: 'kr' },
    n:         { etikett: 'n', enhet: 'st' },
    p10:       { etikett: 'P10', enhet: 'kr' },
    p25:       { etikett: 'P25', enhet: 'kr' },
    p75:       { etikett: 'P75', enhet: 'kr' },
    p90:       { etikett: 'P90', enhet: 'kr' },
    spridning: { etikett: 'spridning (P90/P10)', enhet: '' },
    andelKv:   { etikett: 'andel kvinnor', enhet: '%' },
    gap:       { etikett: 'gap', enhet: '%' }
};
const TAL_OP = ['storre', 'minst', 'mindre', 'hogst', 'mellan'];
const OP_TEXT = { storre: 'större än', minst: 'minst', mindre: 'mindre än', hogst: 'högst', mellan: 'mellan' };

export function faltInfo() { return FALT; }
export function gruppMattInfo() { return GRUPP_MATT; }

const _tal = x => typeof x === 'number' && isFinite(x);
// Gränsen för en taljämförelse, eller null om villkoret är ofullständigt.
function _grans(op, varde) {
    if (op === 'mellan') {
        if (!Array.isArray(varde) || varde.length !== 2 || !_tal(varde[0]) || !_tal(varde[1])) return null;
        return varde[0] <= varde[1] ? [varde[0], varde[1]] : [varde[1], varde[0]];
    }
    return _tal(varde) ? varde : null;
}
function _jamfor(x, op, g) {
    if (op === 'storre') return x > g;
    if (op === 'minst') return x >= g;
    if (op === 'mindre') return x < g;
    if (op === 'hogst') return x <= g;
    if (op === 'mellan') return x >= g[0] && x <= g[1];
    return false;
}

export function villkorAktivt(v) {
    const f = v && FALT[v.falt];
    if (!f) return false;
    if (f.typ === 'kategori') return v.op === 'enAv' && Array.isArray(v.varde) && v.varde.length > 0;
    return TAL_OP.includes(v.op) && _grans(v.op, v.varde) !== null;
}

// Radens värde i fältet, eller null om det saknas.
function _radVarde(rad, falt) {
    const f = FALT[falt];
    if (f.typ === 'kategori') return groupKey(rad, f.dim);
    const x = Number(rad[falt]);
    return (rad[falt] == null || !isFinite(x) || x <= 0) ? null : x;
}
function _uppfyller(rad, v) {
    const x = _radVarde(rad, v.falt);
    if (x == null) return false;
    const traff = FALT[v.falt].typ === 'kategori' ? v.varde.includes(x) : _jamfor(x, v.op, _grans(v.op, v.varde));
    return v.inte ? !traff : traff;
}

export function personFilter(urval) {
    const aktiva = ((urval && urval.villkor) || []).filter(villkorAktivt);
    if (!aktiva.length) return () => true;
    if (urval.lage === 'nagot') return rad => aktiva.some(v => _uppfyller(rad, v));
    return rad => aktiva.every(v => _uppfyller(rad, v));
}

export function gruppVillkorAktivt(g) {
    return !!g && Object.prototype.hasOwnProperty.call(GRUPP_MATT, g.matt)
        && TAL_OP.includes(g.op) && _grans(g.op, g.varde) !== null;
}

export function uppfyllerGrupp(varden, gruppVillkor) {
    return (gruppVillkor || []).filter(gruppVillkorAktivt).every(g => {
        const x = varden ? varden[g.matt] : null;
        return _tal(x) && _jamfor(x, g.op, _grans(g.op, g.varde));
    });
}

const _fmt = (x, enhet) => {
    const s = x.toLocaleString('sv-SE', { maximumFractionDigits: 2 });
    return enhet ? `${s} ${enhet}` : s;
};
function _beskrivVillkor(v) {
    const f = FALT[v.falt];
    if (f.typ === 'kategori') return `${f.etikett} ${v.inte ? 'är inte en av' : 'är en av'} ${v.varde.join(', ')}`;
    const g = _grans(v.op, v.varde);
    const inte = v.inte ? 'inte ' : '';
    if (v.op === 'mellan') return `${f.etikett} ${inte}mellan ${_fmt(g[0], '')} och ${_fmt(g[1], f.enhet)}`;
    return `${f.etikett} ${inte}${OP_TEXT[v.op]} ${_fmt(g, f.enhet)}`;
}
function _beskrivGrupp(g) {
    const m = GRUPP_MATT[g.matt];
    const gr = _grans(g.op, g.varde);
    if (g.op === 'mellan') return `${m.etikett} mellan ${_fmt(gr[0], '')} och ${_fmt(gr[1], m.enhet)}`;
    return `${m.etikett} ${OP_TEXT[g.op]} ${_fmt(gr, m.enhet)}`;
}

/** Klartext för etiketter och export. Tom sträng när inget villkor är aktivt. */
export function beskrivUrval(urval, gruppVillkor) {
    const aktiva = ((urval && urval.villkor) || []).filter(villkorAktivt);
    const grupp = (gruppVillkor || []).filter(gruppVillkorAktivt);
    const delar = [];
    if (aktiva.length) delar.push(`${urval.lage === 'nagot' ? 'Något av' : 'Alla av'}: ${aktiva.map(_beskrivVillkor).join(' · ')}`);
    if (grupp.length) delar.push(`Grupper: ${grupp.map(_beskrivGrupp).join(' · ')}`);
    return delar.join('. ');
}

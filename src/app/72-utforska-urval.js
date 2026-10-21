// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
// ====================================================================
// 72-utforska-urval.js — Villkorsbyggaren i Utforska
//
// Håller urvalet (personvillkor, alla/något) och gruppvillkoren, ritar
// panelen "Urval" och etiketterna under kontrollerna. Logiken bor i
// src/lib/urval.js (speglad som _ur*); här finns bara state och gränssnitt.
//
// Raderna byggs om bara när villkorens STRUKTUR ändras (antal, fält,
// jämförelse) eller datan byts — inte när ett värde ändras. Annars tappar
// den som skriver ett tal eller kryssar i en lista fokus.
// ====================================================================

/** @type {{lage: string, villkor: any[]}} */
let _urvalState = { lage: 'alla', villkor: [] };
/** @type {any[]} */
let _gruppState = [];
/** @type {string|null} */
let _urvalSignatur = null;
/** @type {any[]|null} */
let _urvalDataRef = null;   // state.data som värdelistorna byggdes för

// Jämförelser i listan. "Inte" ligger i listan så att raden läses som en mening.
const _URVAL_OP_KATEGORI = [['enAv', 'är en av'], ['inteEnAv', 'är inte en av']];
const _URVAL_OP_TAL = [['storre', 'större än'], ['minst', 'minst'], ['mindre', 'mindre än'],
                       ['hogst', 'högst'], ['mellan', 'mellan'], ['inteMellan', 'inte mellan']];
const _GRUPP_OP = _URVAL_OP_TAL.filter(([k]) => k !== 'inteMellan');

function _urvalOpVarde(v) {
    if (v.op === 'enAv') return v.inte ? 'inteEnAv' : 'enAv';
    if (v.op === 'mellan') return v.inte ? 'inteMellan' : 'mellan';
    return v.op;
}
function _urvalFranOpVarde(val) {
    if (val === 'inteEnAv') return { op: 'enAv', inte: true };
    if (val === 'inteMellan') return { op: 'mellan', inte: true };
    return { op: val, inte: false };
}
const _kopia = x => JSON.parse(JSON.stringify(x));

function explorerUrval() {
    return { urval: _kopia(_urvalState), gruppVillkor: _kopia(_gruppState) };
}
function explorerSattUrval(urval, gruppVillkor) {
    _urvalState = { lage: urval && urval.lage === 'nagot' ? 'nagot' : 'alla',
                    villkor: _kopia((urval && urval.villkor) || []).map(v => ({ inte: false, ...v })) };
    _gruppState = _kopia(gruppVillkor || []);
    _urvalSignatur = null;
}
function explorerNollstallUrval() { explorerSattUrval({ lage: 'alla', villkor: [] }, []); }

/** Släpper referensen till datan som värdelistorna byggdes för ("Rensa all data"). */
function explorerUrvalSlappMinne() {
    _urvalDataRef = null;
    _urvalSignatur = null;
}

// Kategorivärden i aktuell data, sorterade som Utforska sorterar dimensionen.
function _urvalVarden(rows, dim) {
    const set = new Set();
    for (const r of rows) {
        if (!(r.lon > 0)) continue;
        const k = _utGroupKey(r, dim);
        if (k != null) set.add(k);
    }
    const vals = [...set];
    return dim === 'alder' ? vals.sort(_faltJamforAlder) : vals.sort((a, b) => a.localeCompare(b, 'sv'));
}

/** Tar bort kategorivärden som inte finns i datan (efter en ny inläsning). */
function explorerRensaUrval(rows) {
    const falt = _urFaltInfo();
    const cache = {};
    for (const v of _urvalState.villkor) {
        const f = falt[v.falt];
        if (!f || f.typ !== 'kategori' || !Array.isArray(v.varde)) continue;
        cache[f.dim] = cache[f.dim] || new Set(_urvalVarden(rows, f.dim));
        v.varde = v.varde.filter(x => cache[f.dim].has(x));
    }
}

function _urvalSignaturFor() {
    return JSON.stringify([state.data && state.data.length,
        _urvalState.villkor.map(v => [v.falt, _urvalOpVarde(v)]),
        _gruppState.map(g => [g.matt, g.op])]);
}

function _urvalTalHtml(attr, i, varde, enhet, etikett) {
    const falt = (pos, x) => `<input type="number" class="form-select explore-urval-tal" ${attr}="${i}" data-pos="${pos}" `
        + `value="${x == null ? '' : esc(String(x))}" aria-label="${esc(etikett)}${pos === 1 ? ', övre gräns' : ''}">`;
    const suffix = enhet ? ` <span class="explore-urval-enhet">${esc(enhet)}</span>` : '';
    if (Array.isArray(varde)) return `${falt(0, varde[0])} och ${falt(1, varde[1])}${suffix}`;
    return `${falt(0, varde)}${suffix}`;
}

function _urvalRadHtml(v, i, rows) {
    const falt = _urFaltInfo();
    const f = falt[v.falt] || falt.bas;
    const nr = `Villkor ${i + 1}`;
    const faltOpts = Object.entries(falt).map(([k, d]) =>
        `<option value="${k}"${k === v.falt ? ' selected' : ''}>${esc(d.etikett)}</option>`).join('');
    const opVal = _urvalOpVarde(v);
    const opOpts = (f.typ === 'kategori' ? _URVAL_OP_KATEGORI : _URVAL_OP_TAL).map(([k, t]) =>
        `<option value="${k}"${k === opVal ? ' selected' : ''}>${t}</option>`).join('');
    let varde;
    if (f.typ === 'kategori') {
        const valda = new Set(v.varde || []);
        const boxar = _urvalVarden(rows, f.dim).map((x, j) => {
            const id = `explore-uv-${i}-${j}`;
            return `<label for="${id}" class="explore-filter-val"><input type="checkbox" id="${id}" data-urval-varde="${i}" `
                + `value="${esc(x)}"${valda.has(x) ? ' checked' : ''}> ${esc(x)}</label>`;
        }).join('');
        varde = `<details class="explore-urval-val"><summary data-urval-antal="${i}">Välj värden (${valda.size})</summary>`
            + `<input type="search" class="form-select" data-urval-sok="${i}" aria-label="${nr}: sök bland värdena">`
            + `<div class="explore-filter-vals">${boxar}</div></details>`;
    } else {
        varde = _urvalTalHtml('data-urval-tal', i, v.varde, f.enhet, `${nr}: värde`);
    }
    return `<div class="explore-urval-rad">`
        + `<select class="form-select" data-urval-falt="${i}" aria-label="${nr}: fält">${faltOpts}</select>`
        + `<select class="form-select" data-urval-op="${i}" aria-label="${nr}: jämförelse">${opOpts}</select>`
        + varde
        + `<span class="explore-urval-ofullst"${_urVillkorAktivt(v) ? ' hidden' : ''}>Ofullständigt – ignoreras</span>`
        + `<button type="button" class="explore-urval-bort" data-urval-bort="person:${i}" aria-label="Ta bort ${nr.toLowerCase()}">${ikon('kryss', 14)}</button>`
        + '</div>';
}

function _gruppRadHtml(g, i) {
    const matt = _urGruppMattInfo();
    const m = matt[g.matt] || matt.gap;
    const nr = `Gruppvillkor ${i + 1}`;
    const mattOpts = Object.entries(matt).map(([k, d]) =>
        `<option value="${k}"${k === g.matt ? ' selected' : ''}>${esc(d.etikett)}</option>`).join('');
    const opOpts = _GRUPP_OP.map(([k, t]) => `<option value="${k}"${k === g.op ? ' selected' : ''}>${t}</option>`).join('');
    return `<div class="explore-urval-rad">`
        + `<select class="form-select" data-gv-matt="${i}" aria-label="${nr}: mått">${mattOpts}</select>`
        + `<select class="form-select" data-gv-op="${i}" aria-label="${nr}: jämförelse">${opOpts}</select>`
        + _urvalTalHtml('data-gv-tal', i, g.varde, m.enhet, `${nr}: värde`)
        + `<span class="explore-urval-ofullst"${_urGruppVillkorAktivt(g) ? ' hidden' : ''}>Ofullständigt – ignoreras</span>`
        + `<button type="button" class="explore-urval-bort" data-urval-bort="grupp:${i}" aria-label="Ta bort ${nr.toLowerCase()}">${ikon('kryss', 14)}</button>`
        + '</div>';
}

// Raderna byggs om när fält eller jämförelse byts. Den som stod i en lista eller
// ett sifferfält ska stå kvar där efteråt, annars kan man bara stega ett steg
// i taget med tangentbordet.
const _URVAL_FOKUS_ATTR = ['data-urval-falt', 'data-urval-op', 'data-urval-tal', 'data-gv-matt', 'data-gv-op', 'data-gv-tal'];
function _urvalFokusNyckel() {
    const a = document.activeElement;
    if (!a || !a.closest || !a.closest('#explore-urval')) return null;
    const namn = _URVAL_FOKUS_ATTR.find(n => a.hasAttribute(n));
    if (!namn) return null;
    const pos = a.hasAttribute('data-pos') ? `[data-pos="${a.getAttribute('data-pos')}"]` : '';
    return `[${namn}="${a.getAttribute(namn)}"]${pos}`;
}

// Uppdaterar det som ändras med värdena, utan att bygga om raderna.
function _urvalUppdateraMarkorer() {
    document.querySelectorAll('#explore-urval-villkor .explore-urval-rad').forEach((rad, i) => {
        const m = rad.querySelector('.explore-urval-ofullst');
        if (m) /** @type {HTMLElement} */ (m).hidden = _urVillkorAktivt(_urvalState.villkor[i]);
        const antal = rad.querySelector('[data-urval-antal]');
        if (antal) antal.textContent = `Välj värden (${(_urvalState.villkor[i].varde || []).length})`;
    });
    document.querySelectorAll('#explore-urval-grupp .explore-urval-rad').forEach((rad, i) => {
        const m = rad.querySelector('.explore-urval-ofullst');
        if (m) /** @type {HTMLElement} */ (m).hidden = _urGruppVillkorAktivt(_gruppState[i]);
    });
}

function renderExplorerUrvalUi(rows) {
    const lista = document.getElementById('explore-urval-villkor');
    const grupp = document.getElementById('explore-urval-grupp');
    const lage = document.getElementById('explore-urval-lage');
    const chips = document.getElementById('explore-filter-chips');
    if (!lista || !grupp) return;
    if (lage) /** @type {HTMLInputElement} */ (lage).value = _urvalState.lage;
    const sig = _urvalSignaturFor();
    // Samma antal rader betyder inte samma data — en ny fil med lika många
    // anställda måste också ge nya värdelistor.
    if (sig !== _urvalSignatur || _urvalDataRef !== state.data) {
        _urvalSignatur = sig;
        _urvalDataRef = state.data;
        const fokus = _urvalFokusNyckel();
        lista.innerHTML = _urvalState.villkor.map((v, i) => _urvalRadHtml(v, i, rows)).join('');
        grupp.innerHTML = _gruppState.map((g, i) => _gruppRadHtml(g, i)).join('');
        if (fokus) /** @type {HTMLInputElement} */ (document.querySelector(`#explore-urval ${fokus}`))?.focus();
    }
    _urvalUppdateraMarkorer();
    if (chips) {
        const text = _urBeskrivUrval(_urvalState, _gruppState);
        chips.innerHTML = text
            ? `<span class="explore-urval-text">${esc(text)}</span><button type="button" class="btn-table-tool" data-explore-clear>Rensa allt</button>`
            : '';
    }
}

function _urvalTal(el) {
    const x = el.value === '' ? null : Number(el.value);
    return x == null || !isFinite(x) ? null : x;
}
function _urvalSattTal(obj, el) {
    const x = _urvalTal(el);
    if (Array.isArray(obj.varde)) obj.varde[Number(el.getAttribute('data-pos'))] = x;
    else obj.varde = x;
}

// ---- Wiring ----
const _urvalPanel = document.getElementById('explore-urval');
_urvalPanel?.addEventListener('change', e => {
    const t = /** @type {HTMLInputElement} */ (e.target);
    const falt = _urFaltInfo();
    let i;
    if (/** @type {HTMLElement} */ (t).id === 'explore-urval-lage') {
        _urvalState.lage = /** @type {HTMLInputElement} */ (t).value === 'nagot' ? 'nagot' : 'alla';
    } else if ((i = /** @type {HTMLElement} */ (t).getAttribute('data-urval-falt')) != null) {
        const v = _urvalState.villkor[i];
        const fore = falt[v.falt] && falt[v.falt].typ;
        v.falt = /** @type {HTMLInputElement} */ (t).value;
        if (falt[v.falt].typ !== fore) {
            Object.assign(v, falt[v.falt].typ === 'kategori'
                ? { op: 'enAv', varde: [], inte: false } : { op: 'minst', varde: null, inte: false });
        } else {
            // Samma typ men annat fält: värdet hör till det gamla fältet (lön och
            // ålder har olika enheter, BAS och yrkesgrupp olika värden).
            v.varde = falt[v.falt].typ === 'kategori' ? [] : (v.op === 'mellan' ? [null, null] : null);
        }
    } else if ((i = /** @type {HTMLElement} */ (t).getAttribute('data-urval-op')) != null) {
        const v = _urvalState.villkor[i];
        const var_mellan = v.op === 'mellan';
        Object.assign(v, _urvalFranOpVarde(/** @type {HTMLInputElement} */ (t).value));
        if ((v.op === 'mellan') !== var_mellan) v.varde = v.op === 'mellan' ? [null, null] : null;
    } else if ((i = /** @type {HTMLElement} */ (t).getAttribute('data-urval-varde')) != null) {
        const v = _urvalState.villkor[i];
        const s = new Set(v.varde || []);
        if (/** @type {HTMLInputElement} */ (t).checked) s.add(/** @type {HTMLInputElement} */ (t).value); else s.delete(/** @type {HTMLInputElement} */ (t).value);
        v.varde = [...s];
    } else if ((i = /** @type {HTMLElement} */ (t).getAttribute('data-urval-tal')) != null) {
        _urvalSattTal(_urvalState.villkor[i], t);
    } else if ((i = /** @type {HTMLElement} */ (t).getAttribute('data-gv-matt')) != null) {
        _gruppState[i].matt = /** @type {HTMLInputElement} */ (t).value;
    } else if ((i = /** @type {HTMLElement} */ (t).getAttribute('data-gv-op')) != null) {
        const g = _gruppState[i];
        const var_mellan = g.op === 'mellan';
        g.op = /** @type {HTMLInputElement} */ (t).value;
        if ((g.op === 'mellan') !== var_mellan) g.varde = g.op === 'mellan' ? [null, null] : null;
    } else if ((i = /** @type {HTMLElement} */ (t).getAttribute('data-gv-tal')) != null) {
        _urvalSattTal(_gruppState[i], t);
    } else {
        return;
    }
    renderExplorer();
});
_urvalPanel?.addEventListener('input', e => {
    const t = /** @type {HTMLInputElement} */ (e.target);
    const i = /** @type {HTMLElement} */ (t).getAttribute('data-urval-sok');
    if (i == null) return;
    const q = /** @type {HTMLInputElement} */ (t).value.trim().toLowerCase();
    /** @type {HTMLElement} */ (t).parentElement?.querySelectorAll('.explore-filter-val').forEach(l => {
        /** @type {HTMLElement} */ (l).hidden = !!q && !l.textContent.toLowerCase().includes(q);
    });
});
_urvalPanel?.addEventListener('click', e => {
    const lagg = /** @type {HTMLElement} */ (e.target).closest('[data-urval-lagg-till]');
    if (lagg) {
        if (lagg.getAttribute('data-urval-lagg-till') === 'grupp') _gruppState.push({ matt: 'gap', op: 'mindre', varde: null });
        else _urvalState.villkor.push({ falt: 'bas', op: 'enAv', varde: [], inte: false });
        renderExplorer();
        return;
    }
    const bort = /** @type {HTMLElement} */ (e.target).closest('[data-urval-bort]');
    if (bort) {
        const [typ, i] = (bort.getAttribute('data-urval-bort') || '').split(':');
        if (typ === 'grupp') _gruppState.splice(Number(i), 1); else _urvalState.villkor.splice(Number(i), 1);
        renderExplorer();
    }
});
_urvalPanel?.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    const lista = /** @type {HTMLElement} */ (e.target).closest('.explore-urval-val');
    if (!lista || !/** @type {HTMLDetailsElement} */ (lista).open) return;
    /** @type {HTMLDetailsElement} */ (lista).open = false;
    lista.querySelector('summary')?.focus();
    e.stopPropagation();
});

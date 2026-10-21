// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
// ---- Personer att granska (ADR-23) ----
/**
 * Panel sist i Lika arbete: personer minst X % under förväntad lön bland kollegor i samma
 * AID och BAS (logiken i src/lib/individflaggor.js). Listan lämnar aldrig verktyget:
 * inga exportverktyg på tabellen, inget i exporterna, dold vid utskrift (ADR-23).
 */
function _pagGrans() {
    const el = document.getElementById('pag-grans');
    const v = el ? parseFloat(String(/** @type {HTMLInputElement} */ (el).value).replace(',', '.')) : NaN;
    if (!Number.isFinite(v)) return 10;
    return Math.min(30, Math.max(5, v));
}

// Stora listor ritas i sin helhet först på begäran — tusentals rader gör fliken seg.
const _PAG_MAX_RADER = 200;

const _ANSVARSGRUPP_NAMN = { ledning: 'Ledningsansvar', uppdrag: 'Särskilt uppdrag', inget: 'Inget särskilt ansvar' };
function ansvarsgruppNamn(g) { return _ANSVARSGRUPP_NAMN[g] || '—'; }
/** Ansvarsgruppens namn i tabellens smala kolumn; hela namnet står i cellens verktygstips. */
function _pagAnsvarKort(g) { return ansvarsgruppNamn(g).replace(/^(Inget särskilt) ansvar$/, '$1'); }

function renderPersonerAttGranska(visaAlla = false) {
    const host = document.getElementById('personer-att-granska');
    const body = document.getElementById('pag-innehall');
    if (!host || !body) return;
    const d = getData();
    if (!d.length) { host.hidden = true; body.innerHTML = ''; _pagRitaAvvikelse(null, 0); return; }
    host.hidden = false;
    const grans = _pagGrans();
    const r = _ifFlaggaIndivider(d, { minGrupp: statGolv(), grans });
    _pagRitaAvvikelse(d, grans);
    const tal = (v, dec = 0) => new Intl.NumberFormat('sv-SE', { minimumFractionDigits: dec, maximumFractionDigits: dec }).format(v);
    const g = new Intl.NumberFormat('sv-SE', { maximumFractionDigits: 1 }).format(grans);
    const demo = state.isDemo ? '<p class="pag-demo"><strong>DEMODATA — inte verkliga löner.</strong></p>' : '';
    const ejProvade = r.ejProvade
        ? `<p class="pag-not">${tal(r.ejProvade)} ${r.ejProvade === 1 ? 'person' : 'personer'} i grupper med färre än ${statGolv()} personer prövades inte.</p>` : '';
    if (!(r.provade.kv + r.provade.ma)) {
        body.innerHTML = demo + `<p>Inga grupper med minst ${statGolv()} personer i samma AID och BAS.</p>` + ejProvade;
        return;
    }
    if (!r.flaggade.length) {
        body.innerHTML = demo + `<p>Ingen ligger minst ${g} % under förväntad lön.</p>` + ejProvade;
        return;
    }
    const n = r.flaggade.length;
    const kv = r.flaggade.filter(f => f.kon === 'Kvinna').length, ma = n - kv;
    const sammanfattning = `<p class="pag-sammanfattning"><strong>${tal(n)} ${n === 1 ? 'person ligger' : 'personer ligger'} minst ${g} % under förväntad lön</strong>: `
        + `${tal(kv)} ${kv === 1 ? 'kvinna' : 'kvinnor'} och ${tal(ma)} ${ma === 1 ? 'man' : 'män'}. `
        + `Kvinnor är ${tal(r.andelKv.provade)} % av de prövade och ${tal(r.andelKv.flaggade)} % av de flaggade.</p>`;
    const medAnsvar = !!state.ansvarKolumn;
    const visade = visaAlla ? r.flaggade : r.flaggade.slice(0, _PAG_MAX_RADER);
    const rader = visade.map(f => `<tr>
        <td>${f.radnr ?? '—'}</td><td>${esc(f.kon)}</td><td class="num">${tal(f.alder)}</td>
        <td>${esc(f.aid)}</td><td>${esc(f.bas)}</td>
        <td class="num">${tal(Math.round(f.lon))} kr</td><td class="num">${tal(Math.round(f.forvantad))} kr${f.metod === 'alder' ? '' : '<span class="pag-median" title="Förväntad lön är gruppens median">*</span>'}</td>
        <td class="num">${tal(f.avvikelsePct, 1).replace('-', '−')} %</td><td class="num">${tal(f.kollegor)}</td>${medAnsvar ? `<td class="pag-ansvar"${_pagAnsvarKort(f.ansvarsgrupp) !== ansvarsgruppNamn(f.ansvarsgrupp) ? ` title="${esc(ansvarsgruppNamn(f.ansvarsgrupp))}"` : ''}>${esc(_pagAnsvarKort(f.ansvarsgrupp))}</td>` : ''}</tr>`).join('');
    // Hur den förväntade lönen räknats står i en not under tabellen, inte i en kolumn: nästan alltid ur åldern.
    const medMedian = visade.some(f => f.metod !== 'alder');
    const metodNot = `<p class="pag-not pag-metod">Förväntad lön är räknad ur åldern bland kollegorna i samma AID och BAS.`
        + (medMedian ? ' <span class="pag-median">*</span> Gruppens median: åldrarna i gruppen ligger för nära varandra för att räkna med åldern.' : '') + '</p>';
    body.innerHTML = demo + sammanfattning + ejProvade
        + `<div class="pag-tabell-wrap" tabindex="0" role="region" aria-label="Personer att granska, rullar i sidled"><table id="pag-tabell" class="data-table"><thead><tr>
            <th>Rad</th><th>Kön</th><th class="num">Ålder</th><th>AID</th><th>BAS</th><th class="num">Lön</th>
            <th class="num">Förväntad lön</th><th class="num">Avvikelse</th><th class="num">Kollegor</th>${medAnsvar ? '<th>Ansvar</th>' : ''}
        </tr></thead><tbody>${rader}</tbody></table></div>` + metodNot
        + (visade.length < n
            ? `<p class="pag-not">Visar de ${tal(visade.length)} största avvikelserna. <button type="button" class="btn btn-secondary btn-sm" id="pag-visa-alla">Visa alla (${tal(n)})</button></p>` : '');
}

// ---- Avvikelse från förväntad lön per kön och BAS-intervall (divergerande stapel) ----
// Samma prövning som listan ovanför (samma grupper, samma förväntade lön, samma gräns), summerad per BAS-intervall
// och kön: hur stor andel av de prövade kvinnorna respektive männen som ligger minst gränsen UNDER den förväntade
// lönen (åt vänster) och minst gränsen ÖVER (åt höger). Bara BAS-intervall där både de prövade kvinnorna och de
// prövade männen når tröskeln — ett segment gäller aldrig färre. Andelarna är hela procent. Diagrammet namnger
// ingen person och bär ingen lön. Som resten av panelen går det inte att exportera (markeraUtanExport på rutan,
// skälet `individer` i 11-diagramexport.js): inget ur Personer att granska lämnar verktyget.
markeraUtanExport(document.getElementById('pag-diagram-ruta'), 'individer');
function _pagAvvikelseRader(d, grans) {
    const k = kTroskel(), perBas = new Map();
    // Gränsen −∞ ger avvikelsen för alla prövade, inte bara de flaggade.
    for (const f of _ifFlaggaIndivider(d, { minGrupp: statGolv(), grans: -Infinity }).flaggade) {
        if (!perBas.has(f.bas)) perBas.set(f.bas, { Kvinna: [], Man: [] });
        perBas.get(f.bas)[f.kon].push(f.avvikelsePct);
    }
    const ut = [];
    for (const [bas, g] of [...perBas].sort((a, b) => String(a[0]).localeCompare(String(b[0]), 'sv', { numeric: true }))) {
        if (g.Kvinna.length < k || g.Man.length < k) continue;
        for (const [kon, namn] of [['Kvinna', 'Kvinnor'], ['Man', 'Män']]) {
            const a = g[kon], andel = n => Math.round(100 * n / a.length);
            const nUnder = a.filter(v => v <= -grans).length, nOver = a.filter(v => v >= grans).length;
            ut.push({ bas, kon: namn, n: a.length, under: andel(nUnder), over: andel(nOver), nUnder, nOver });
        }
    }
    return ut;
}
// Avvikelsen per kön och BAS-intervall som tabell med inbyggd grafik: en rad per kön och intervall med antalet
// prövade och andelen långt under respektive över förväntad lön, och de två andelarna ritade i raden kring en
// mittlinje (under åt vänster, över åt höger). Ett diagram med en stapel per rad stod till hälften tomt; tabellen
// visar också nollorna och antalet bakom. `rader` kommer från _pagAvvikelseRader: bara BAS där båda könen når tröskeln.
const _PAG_FARG = { under: '#c2552d', over: FARG.svag };
function _pagAvvikelseGrafik(o, kant) {
    const b = 200, h = 20, m = b / 2, w = v => +(Math.min(v, kant) / kant * (m - 2)).toFixed(1);
    return `<svg class="la-oversikt-grafik" viewBox="0 0 ${b} ${h}" width="${b}" height="${h}" aria-hidden="true" focusable="false">`
        + (o.under > 0 ? `<rect x="${m - w(o.under)}" y="4" width="${w(o.under)}" height="${h - 8}" rx="2" fill="${_PAG_FARG.under}"/>` : '')
        + (o.over > 0 ? `<rect x="${m}" y="4" width="${w(o.over)}" height="${h - 8}" rx="2" fill="${_PAG_FARG.over}"/>` : '')
        + `<line x1="${m}" x2="${m}" y1="0" y2="${h}" stroke="${PALETTE.semantic.mork}" stroke-width="1.2"/></svg>`;
}
function _pagAvvikelseTabell(rader, grans) {
    const t = document.getElementById('pag-avvikelse-tabell');
    if (!t) return false;
    const g = new Intl.NumberFormat('sv-SE', { maximumFractionDigits: 1 }).format(grans);
    const kant = Math.min(100, Math.ceil(Math.max(10, ...rader.map(o => Math.max(o.under, o.over))) * 1.2 / 10) * 10);
    const andel = (v, antal) => `${_figTalformat(v, 'antal')} %${antal > 0 && antal < litetUnderlag() ? '<span class="pag-litet" title="Litet underlag">*</span>' : ''}`;
    /** @type {HTMLElement} */ (t.querySelector('thead')).innerHTML = `<tr><th scope="col">BAS-intervall</th><th scope="col" class="ta-vanster">Kön</th><th scope="col" class="tal">Prövade</th>`
        + `<th scope="col" class="tal">Minst ${g} % under</th><th scope="col" class="la-oversikt-skala t-mitt" data-export-skip>under åt vänster · över åt höger</th><th scope="col" class="ta-vanster">Minst ${g} % över</th></tr>`;
    const tb = /** @type {HTMLElement} */ (t.querySelector('tbody'));
    tb.innerHTML = '';
    let fa = false;
    for (const o of rader) {
        if ((o.nUnder > 0 && o.nUnder < litetUnderlag()) || (o.nOver > 0 && o.nOver < litetUnderlag())) fa = true;
        const tr = document.createElement('tr');
        tr._markering = markeringFor(o.bas);
        tr.innerHTML = `<th scope="row">BAS ${esc(o.bas)}</th><td class="ta-vanster">${esc(o.kon)}</td><td class="tal">${o.n}</td><td class="tal">${andel(o.under, o.nUnder)}</td>`
            + `<td class="la-oversikt-cell">${_pagAvvikelseGrafik(o, kant)}</td><td class="ta-vanster">${andel(o.over, o.nOver)}</td>`;
        tb.appendChild(tr);
    }
    return fa;
}
function _pagRitaAvvikelse(d, grans) {
    const ruta = document.getElementById('pag-diagram-ruta'), t = document.getElementById('pag-avvikelse-tabell');
    if (!ruta || !t) return;
    const rader = d ? _pagAvvikelseRader(d, grans) : [];
    ruta.hidden = !rader.length;
    if (!rader.length) { /** @type {HTMLElement} */ (t.querySelector('thead')).innerHTML = ''; /** @type {HTMLElement} */ (t.querySelector('tbody')).innerHTML = ''; return; }
    const fa = _pagAvvikelseTabell(rader, grans);
    const not = document.getElementById('pag-diagram-not');
    if (not) not.textContent = `Bara BAS-intervall där minst ${kTroskel()} kvinnor och ${kTroskel()} män har prövats. En avvikelse är inte i sig osaklig — tabellen visar var det finns mest att titta närmare på.`
        + (fa ? ` Andelar märkta med * gäller färre än ${litetUnderlag()} personer: ett litet underlag, som inte ska läsas som ett mönster.` : '');
}

document.getElementById('pag-grans')?.addEventListener('input', () => renderPersonerAttGranska());
// När fältet lämnas visas värdet som faktiskt används (klämt till 5–30).
document.getElementById('pag-grans')?.addEventListener('change', e => { /** @type {HTMLInputElement} */ (e.target).value = String(_pagGrans()); renderPersonerAttGranska(); });
document.addEventListener('click', e => { if (/** @type {HTMLElement} */ (e.target).closest('#pag-visa-alla')) renderPersonerAttGranska(true); });

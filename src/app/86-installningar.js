// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
// ---- Inställningar ----
/**
 * Panelen samlar det som gäller flera flikar: minsta gruppstorlek, organisationstyp, PO-påslag och beräkningsperiod,
 * och Prioriteringens trösklar och viktning (de styr åtgärdslistan, kostnaden, handlingsplanen och rapporterna).
 * Övriga inställningar för en enda flik står kvar i fliken, bredvid resultatet de påverkar; panelen visar var de
 * finns och om de är ändrade.
 */
function installningarOppna() {
    const m = document.getElementById('installningar-modal');
    return !!m && m.style.display === 'flex';
}
/** @param {{fokus?: string|null}} [val] fokus: id på fältet som ska få fokus */
function oppnaInstallningar({ fokus = null } = {}) {
    const m = document.getElementById('installningar-modal');
    if (!m) return;
    if (typeof sattMeny === 'function') sattMeny(false, { fokus: false });
    _instRita();
    const oppnare = document.activeElement;
    m.style.display = 'flex';
    trapFocus(m, oppnare);
    const mal = fokus ? document.getElementById(fokus) : null;
    // trapFocus sätter fokus på panelens första knapp efter en kort stund: det efterfrågade fältet tar över efter det.
    if (mal) { mal.focus(); setTimeout(() => { if (installningarOppna()) mal.focus(); }, 80); }
}
function stangInstallningar() {
    const m = document.getElementById('installningar-modal');
    if (!m || !installningarOppna()) return;
    releaseFocus(m);
    m.style.display = 'none';
}

/** Länken "Minsta gruppstorlek N" i flikarnas urvalsrad och i Översikts filrad: öppnar panelen med fokus i fältet. */
function kTroskelLank() {
    return `<button type="button" class="ov-filrad-lank" data-oppna-installningar="k-troskel" title="Ändra minsta gruppstorlek">Minsta gruppstorlek ${kInstalld()}</button>`;
}

function _instRita() {
    const namn = document.getElementById('inst-namn'), flikar = document.getElementById('inst-flikar');
    const lonemanad = /** @type {HTMLInputElement|null} */ (document.getElementById('lonemanad'));
    if (lonemanad) lonemanad.value = state.lonemanad || '';
    if (namn) {
        namn.innerHTML = [['Organisation', orgNamn('inget namn angivet')], ['Referens', referensNamn()],
            ['Jämförelsestatistik', state.statistik.length ? (state.statistikNamn || 'Jämförelsestatistik') : 'ingen inläst']]
            .map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('');
    }
    _instRitaImportprofiler();
    if (!flikar) return;
    const last = flik => { const n = document.querySelector(`.nav-item[data-tab="${flik}"]`); return !n || /** @type {HTMLInputElement} */ (n).disabled; };
    const anpassad = a => (a ? 'Anpassade värden' : 'Standardvärden');
    const lv = state.likvardighet || {};
    const band = document.getElementById('arbvard-band'), extrem = document.getElementById('outliers-threshold');
    const rader = [
        { flik: 'likvardighet', avsnitt: 'avsnitt-lv-installningar', namn: 'Likvärdigt arbete', vad: 'Kvinnotröskel, definition av kvinnodominerat (DO/SCB), minsta gap och antal par',
          lage: anpassad(lv.kvinnoTrosholdPct !== 60 || lv.minGapPct !== 5 || lv.topN !== 20 || aidbasDefinition() !== 'do'), andrad: lv.kvinnoTrosholdPct !== 60 || lv.minGapPct !== 5 || lv.topN !== 20 || aidbasDefinition() !== 'do' },
        { flik: 'likvardighet', avsnitt: 'avsnitt-lv-poang', namn: 'Likvärdigt arbete', vad: 'Ekvivalensband för arbetsvärdering med poäng',
          lage: `± ${band ? /** @type {HTMLInputElement} */ (band).value : 5} %`, andrad: !!band && String(/** @type {HTMLInputElement} */ (band).value) !== '5' },
        { flik: 'matrix', avsnitt: 'avsnitt-la-personer', namn: 'Lika arbete', vad: 'Gräns för personer att granska',
          lage: `${typeof _pagGrans === 'function' ? _pagGrans() : 10} % under förväntad lön`, andrad: typeof _pagGrans === 'function' && _pagGrans() !== 10 },
        // Fliken Filer och kvalitet är öppen utan lönefil, men avsnittet med tröskeln är dolt tills en fil är inläst.
        { flik: 'filer', avsnitt: 'avsnitt-ov-kvalitet', kraverData: true, namn: 'Filer och kvalitet', vad: 'Tröskel för extremvärden',
          lage: `${extrem ? svTal(parseFloat(/** @type {HTMLInputElement} */ (extrem).value) || 3, 1) : '3,0'} standardavvikelser`, andrad: !!extrem && (parseFloat(/** @type {HTMLInputElement} */ (extrem).value) || 3) !== 3 },
    ];
    const utanData = !getData().length;
    flikar.innerHTML = rader.map(r => `<li class="inst-flik${r.andrad ? ' ar-andrad' : ''}">
        <span class="inst-flik-namn"><strong>${esc(r.namn)}</strong> — ${esc(r.vad)}</span>
        <span class="inst-flik-lage">${esc(r.lage)}</span>
        <button type="button" class="btn-table-tool" data-inst-flik="${esc(r.flik)}" data-inst-avsnitt="${esc(r.avsnitt)}"${last(r.flik) || (r.kraverData && utanData) ? ' disabled title="Läs in en lönefil först"' : ''}>Öppna</button>
    </li>`).join('');
}

// ---- Importprofiler (src/lib/importprofiler.js) ----
/** Rollernas namn som i kolumnmappningen. */
function _ipRollNamn(roll) {
    const r = COLMAP_ROLES.find(x => x.role === roll);
    return r ? r.label : roll;
}
/** Listan i Inställningar: sessionens profiler med namn, källa och rubriker per roll, och de inbyggda med namn. */
function _instRitaImportprofiler() {
    const el = document.getElementById('inst-importprofiler');
    if (!el) return;
    const profiler = state.importprofiler || [];
    const rad = p => `<li class="inst-ip">
        <p class="marg-0"><strong>${esc(p.namn)}</strong> <span class="text-dampad-sm">(${esc(_importprofilKalla(p.kalla))})</span></p>
        <dl class="inst-lista">${Object.entries(p.rubriker).map(([roll, rubriker]) => `<dt>${esc(_ipRollNamn(roll))}</dt><dd>${rubriker.map(r => esc(r)).join(', ')}</dd>`).join('')}</dl>
        <p class="text-dampad-sm marg-0">Känns igen på: ${p.kannetecken.map(k => esc(k)).join(', ')}</p>
        <div class="rad-bryt gap-8 marg-t-12">
            <button type="button" class="btn btn-secondary btn-sm" data-ip-exportera="${esc(p.id)}">Exportera JSON</button>
            <button type="button" class="btn btn-secondary btn-sm" data-ip-ta-bort="${esc(p.id)}">Ta bort</button>
        </div>
    </li>`;
    el.innerHTML = (profiler.length ? `<ul class="inst-ip-lista">${profiler.map(rad).join('')}</ul>`
        : '<p class="text-dampad-sm">Inga sparade importprofiler. Peka ut kolumnerna i kolumnmappningen och spara mappningen där.</p>')
        + `<p class="text-dampad-sm">Inbyggda (verktygets egna format): ${_ipInbyggda().map(p => esc(p.namn)).join(', ')}.</p>`;
}
/** Profilen (eller alla sessionens profiler utan id) som JSON att dela eller bidra med: bara rubriknamn. */
function importprofilExport(id) {
    const profiler = (state.importprofiler || []).filter(p => id == null || p.id === id);
    return _ipTillJson(profiler);
}
function _ipExportera(id) {
    const p = (state.importprofiler || []).find(x => x.id === id);
    if (!p) return;
    const blob = new Blob([importprofilExport(id)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `importprofil-${p.id}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    announceToScreenReader(`Importprofilen ${p.namn} är exporterad: ${a.download}`);
}
function _ipTaBort(id) {
    const p = (state.importprofiler || []).find(x => x.id === id);
    if (!p) return;
    state.importprofiler = state.importprofiler.filter(x => x !== p);
    // Gällde profilen för den inlästa filen nollas den, så att filrutan inte nämner en borttagen profil.
    if (state.importprofil && state.importprofil.id === id) {
        state.importprofil = null;
        if (typeof renderFilrutor === 'function') renderFilrutor();
    }
    _instRitaImportprofiler();
    if (typeof maybeShowColumnMapping === 'function' && (state._dataHeaders || []).length) maybeShowColumnMapping();
    /** @type {HTMLElement|null} */ (document.getElementById('inst-importprofiler-rubrik'))?.focus();
    announceToScreenReader(`Importprofilen ${p.namn} är borttagen för sessionen.`);
}

/** Stänger panelen, går till fliken och fäller ut avsnittet där inställningen står. */
function _instGaTill(flik, avsnitt) {
    stangInstallningar();
    const nav = document.querySelector(`.nav-item[data-tab="${flik}"]`);
    if (!nav || /** @type {HTMLInputElement} */ (nav).disabled) return;
    /** @type {HTMLElement} */ (nav).click();
    const el = document.getElementById(avsnitt);
    if (!el) return;
    /** @type {HTMLDetailsElement} */ (el).open = true;
    if (typeof el.scrollIntoView === 'function') el.scrollIntoView({ block: 'start' });
    const sammanfattning = el.querySelector(':scope > summary');
    if (sammanfattning) /** @type {HTMLInputElement} */ (sammanfattning).focus();
}

document.getElementById('btn-open-installningar')?.addEventListener('click', () => oppnaInstallningar());
document.getElementById('installningar-close')?.addEventListener('click', stangInstallningar);
document.querySelector('#installningar-modal .glossary-backdrop')?.addEventListener('click', stangInstallningar);
document.addEventListener('keydown', e => { if (e.key === 'Escape' && installningarOppna()) stangInstallningar(); });
document.addEventListener('click', e => {
    if (!/** @type {HTMLElement} */ (e.target).closest) return;
    const lank = /** @type {HTMLElement} */ (e.target).closest('[data-oppna-installningar]');
    if (lank) { oppnaInstallningar({ fokus: lank.getAttribute('data-oppna-installningar') || null }); return; }
    const ipExp = /** @type {HTMLElement} */ (e.target).closest('[data-ip-exportera]');
    if (ipExp) { _ipExportera(ipExp.getAttribute('data-ip-exportera')); return; }
    const ipBort = /** @type {HTMLElement} */ (e.target).closest('[data-ip-ta-bort]');
    if (ipBort) { _ipTaBort(ipBort.getAttribute('data-ip-ta-bort')); return; }
    const flik = /** @type {HTMLElement} */ (e.target).closest('[data-inst-flik]');
    if (flik) { _instGaTill(flik.getAttribute('data-inst-flik'), flik.getAttribute('data-inst-avsnitt')); return; }
    if (/** @type {HTMLElement} */ (e.target).closest('#inst-till-filer')) {
        stangInstallningar();
        const nav = document.querySelector('.nav-item[data-tab="filer"]');
        if (nav) /** @type {HTMLElement} */ (nav).click();
        const rad = document.getElementById('upload-row');
        if (rad && typeof rad.scrollIntoView === 'function') rad.scrollIntoView({ block: 'start' });
    }
});

// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
// ---- Inställningar ----
/**
 * Panelen samlar det som gäller flera flikar: minsta gruppstorlek och organisationstyp. Inställningar för
 * en enda flik står kvar i fliken, bredvid resultatet de påverkar; panelen visar var de finns och om de är ändrade.
 * PO-påslag och beräkningsperiod hör till Prioritering och står kvar där.
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
    if (namn) {
        namn.innerHTML = [['Organisation', orgNamn('inget namn angivet')], ['Referens', referensNamn()],
            ['Jämförelsestatistik', state.statistik.length ? (state.statistikNamn || 'Jämförelsestatistik') : 'ingen inläst']]
            .map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('');
    }
    if (!flikar) return;
    const last = flik => { const n = document.querySelector(`.nav-item[data-tab="${flik}"]`); return !n || /** @type {HTMLInputElement} */ (n).disabled; };
    const anpassad = a => (a ? 'Anpassade värden' : 'Standardvärden');
    const lv = state.likvardighet || {};
    const prioAnpassad = JSON.stringify(state.prioConfig) !== JSON.stringify(PRIO_CONFIG_DEFAULTS);
    const band = document.getElementById('arbvard-band'), extrem = document.getElementById('outliers-threshold');
    const rader = [
        { flik: 'prioritering', avsnitt: 'avsnitt-pr-installningar', namn: 'Prioritering', vad: 'Trösklar och viktning',
          lage: anpassad(prioAnpassad), andrad: prioAnpassad },
        { flik: 'likvardighet', avsnitt: 'avsnitt-lv-installningar', namn: 'Likvärdigt arbete', vad: 'Kvinnotröskel, minsta gap och antal par',
          lage: anpassad(lv.kvinnoTrosholdPct !== 60 || lv.minGapPct !== 5 || lv.topN !== 20), andrad: lv.kvinnoTrosholdPct !== 60 || lv.minGapPct !== 5 || lv.topN !== 20 },
        { flik: 'likvardighet', avsnitt: 'avsnitt-lv-poang', namn: 'Likvärdigt arbete', vad: 'Ekvivalensband för arbetsvärdering med poäng',
          lage: `± ${band ? /** @type {HTMLInputElement} */ (band).value : 5} %`, andrad: !!band && String(/** @type {HTMLInputElement} */ (band).value) !== '5' },
        { flik: 'matrix', avsnitt: 'avsnitt-la-personer', namn: 'Lika arbete', vad: 'Gräns för personer att granska',
          lage: `${typeof _pagGrans === 'function' ? _pagGrans() : 10} % under förväntad lön`, andrad: typeof _pagGrans === 'function' && _pagGrans() !== 10 },
        { flik: 'dashboard', avsnitt: 'avsnitt-ov-kvalitet', namn: 'Översikt', vad: 'Tröskel för extremvärden',
          lage: `${extrem ? svTal(parseFloat(/** @type {HTMLInputElement} */ (extrem).value) || 3, 1) : '3,0'} standardavvikelser`, andrad: !!extrem && (parseFloat(/** @type {HTMLInputElement} */ (extrem).value) || 3) !== 3 },
    ];
    flikar.innerHTML = rader.map(r => `<li class="inst-flik${r.andrad ? ' ar-andrad' : ''}">
        <span class="inst-flik-namn"><strong>${esc(r.namn)}</strong> — ${esc(r.vad)}</span>
        <span class="inst-flik-lage">${esc(r.lage)}</span>
        <button type="button" class="btn-table-tool" data-inst-flik="${esc(r.flik)}" data-inst-avsnitt="${esc(r.avsnitt)}"${last(r.flik) ? ' disabled title="Läs in en lönefil först"' : ''}>Öppna</button>
    </li>`).join('');
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
    const flik = /** @type {HTMLElement} */ (e.target).closest('[data-inst-flik]');
    if (flik) { _instGaTill(flik.getAttribute('data-inst-flik'), flik.getAttribute('data-inst-avsnitt')); return; }
    if (/** @type {HTMLElement} */ (e.target).closest('#inst-till-filer')) {
        stangInstallningar();
        const nav = document.querySelector('.nav-item[data-tab="dashboard"]');
        if (nav) /** @type {HTMLElement} */ (nav).click();
        const vy = document.getElementById('view-dashboard');
        if (vy && vy.classList.contains('har-data') && !vy.classList.contains('visa-filer')) document.getElementById('btn-ov-filer')?.click();
        const rad = document.getElementById('upload-row');
        if (rad && typeof rad.scrollIntoView === 'function') rad.scrollIntoView({ block: 'start' });
    }
});

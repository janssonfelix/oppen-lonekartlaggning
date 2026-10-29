// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
// ---- Förhandsbesked och urval (ADR-40) ----
/**
 * Dokumentera visar före exporten vad varje fil kommer att innehålla och vad som utelämnas, och låter användaren
 * välja vilka avsnitt som följer med i rapporten och i vilken ordning (nivå 1). Urvalet ligger i minnet
 * (state.rapportUrval, se 58-rapportmodell.js) och följer med i konfigurationsfilen — inget lagras i webbläsaren.
 *
 * Beskedet räknas ur samma källa som filen ritas ur: rapportmodellen för Word-utkastet och PDF-rapporten och bladlistan för
 * Excel; ZIP-filen är Word-utkastet, Excel-filen och diagrammen i alla flikar. Det namnger bara det som redan får namnges (BAS-intervall under tröskeln
 * namnges på samma sätt i vyerna); kandidatpar som utelämnas räknas, de namnges inte.
 */
function _ebText(delar) { return delar.filter(Boolean).join(' · '); }
function _ebAntal(n, en, flera) { return `${n} ${n === 1 ? en : flera}`; }

function renderExportBesked() {
    const har = getData().length > 0;
    const satt = (id, html) => { const el = document.getElementById(id); if (el) el.innerHTML = har ? html : ''; };
    if (!har) { ['besked-word', 'besked-pdf', 'besked-excel', 'besked-zip'].forEach(id => satt(id, '')); _ebRitaUrval(); return; }
    /** @type {any} */ let b = null;
    try { b = rmBesked(rapportModell()); } catch (e) { rapporteraFel('Förhandsbesked: Word-utkastet', e); }
    if (b) {
        satt('besked-word', `<strong>Innehåller:</strong> ${esc(_ebText([b.urval, _ebAntal(b.avsnitt, 'avsnitt', 'avsnitt'), _ebAntal(b.tabeller, 'tabell', 'tabeller'), _ebAntal(b.diagram, 'diagram', 'diagram'), `${b.fyllIn} fält att fylla i`]))}`
            + (b.utelamnat.length ? `<br><strong>Utelämnar:</strong> ${esc(b.utelamnat.join(' · '))}` : '<br><strong>Utelämnar:</strong> ingenting'));
        // PDF-rapporten är samma modell; flikarnas tabeller följer med som bilagor när inget avsnitt är bortvalt.
        const hela = b.avsnitt === rapportModell({ alla: true }).avsnitt.length;
        satt('besked-pdf', `<strong>Innehåller:</strong> ${esc(_ebText([b.urval, _ebAntal(b.avsnitt, 'avsnitt', 'avsnitt'), _ebAntal(b.tabeller, 'tabell', 'tabeller'), _ebAntal(b.diagram, 'diagram', 'diagram'),
            hela ? 'bilagor med flikarnas tabeller och diagram' : 'inga bilagor (ett kortare urval är just avsnitten)']))}`
            + `<br><strong>Utelämnar:</strong> ${esc(b.utelamnat.length ? b.utelamnat.join(' · ') : 'ingenting')}`);
        _laNyckel('nyckel-ex-urval', b.urval);
    }
    try {
        const blad = excelAlltBlad();
        satt('besked-excel', `<strong>Innehåller:</strong> ${esc(_ebAntal(blad.length, 'blad', 'blad'))} — ${esc(blad.join(', '))}<br>`
            + `<strong>Utelämnar:</strong> ${esc(`grupper med färre än ${kInstalld()} personer (minsta gruppstorlek; på skärmen visas de)`)}`);
    } catch (e) { rapporteraFel('Förhandsbesked: Excel', e); }
    try {
        satt('besked-zip', `<strong>Innehåller:</strong> ${esc(`Word-utkastet, Excel-filen (${_ebAntal(excelAlltBlad().length, 'blad', 'blad')}) och diagrammen i alla flikar som bilder`)}<br>`
            + `<strong>Utelämnar:</strong> ${esc(`diagram utan något att visa över tröskeln, och diagrammet i Personer att granska`)}`);
    } catch (e) { rapporteraFel('Förhandsbesked: ZIP', e); }
    _ebRitaUrval();
}

/** Listan där urvalet görs: en rad per avsnitt med ruta och knappar för att flytta upp och ned, och de tre färdiga urvalen. */
function _ebRitaUrval() {
    const host = document.getElementById('rapport-urval');
    if (!host) return;
    if (!getData().length) { host.innerHTML = ''; _laNyckel('nyckel-ex-urval', ''); return; }
    const u = rapportUrval();
    let rubriker = {};
    try { // Lagrummet i rubriken hör till dokumentet; i gränssnittet står avsnittets namn utan paragrafhänvisning.
        rubriker = Object.fromEntries(rapportModell({ alla: true }).avsnitt.map(a => [a.id, a.grundrubrik.replace(/\s*\((?:§|EU)[^)]*\)\s*$/, '')])); } catch (e) { rapporteraFel('Urval: avsnitten', e); }
    const finns = u.ordning.filter(id => rubriker[id]);
    host.innerHTML = `<div class="urval-fasta" role="group" aria-label="Färdiga urval">`
        + Object.entries(RM_URVAL).map(([nyckel, f]) => `<button type="button" class="btn btn-secondary btn-sm" data-urval-fast="${nyckel}" aria-pressed="${u.namn === f.namn}">${esc(f.namn)}</button>`).join('')
        + `</div><ol class="urval-lista">` + finns.map((id, i) => `<li class="urval-rad" data-urval-id="${esc(id)}">
            <label><input type="checkbox" data-urval-med="${esc(id)}"${u.med.includes(id) ? ' checked' : ''}> ${esc(rubriker[id])}</label>
            <span class="urval-flytta"><button type="button" class="btn-table-tool" data-urval-flytta="-1" aria-label="Flytta upp: ${esc(rubriker[id])}"${i === 0 ? ' disabled' : ''}>${ikon('pilUpp', 14)}</button>
            <button type="button" class="btn-table-tool" data-urval-flytta="1" aria-label="Flytta ned: ${esc(rubriker[id])}"${i === finns.length - 1 ? ' disabled' : ''}>${ikon('pilNed', 14)}</button></span></li>`).join('')
        + `</ol><p class="avsnitt-inledning marg-10-0-0">Urvalet gäller Word-utkastet och PDF-rapporten. Det följer med när du sparar konfigurationen, men lagras inte i webbläsaren.</p>`
        + _ebEgnaTabellerHtml() + _ebPerBasReceptHtml();
    _laNyckel('nyckel-ex-urval', u.namn);
}

// ---- Egna tabeller och receptet för avsnittet per BAS-intervall (ADR-52) ----
function _ebEgnaTabellerHtml() {
    const t = state.rapportTabeller || [];
    const rader = t.map((r, i) => `<li class="urval-rad" data-egen-id="${esc(r.id)}">
            <span><strong>${esc(r.namn)}</strong><br><small class="f-dampad">${esc(_trBeskrivning(r))}</small></span>
            <span class="urval-flytta"><button type="button" class="btn-table-tool" data-egen-flytta="-1" aria-label="Flytta upp: ${esc(r.namn)}"${i === 0 ? ' disabled' : ''}>${ikon('pilUpp', 14)}</button>
            <button type="button" class="btn-table-tool" data-egen-flytta="1" aria-label="Flytta ned: ${esc(r.namn)}"${i === t.length - 1 ? ' disabled' : ''}>${ikon('pilNed', 14)}</button>
            <button type="button" class="btn-table-tool" data-egen-bort aria-label="Ta bort: ${esc(r.namn)}">Ta bort</button></span></li>`).join('');
    return `<div id="rapport-egna" class="marg-t-14"><h3 class="fs-md marg-0-0-6">Egna tabeller</h3>
        <p class="text-dampad-sm marg-0-0-6">Tabeller du byggt i Utforska och lagt till med <em>Lägg till i rapporten</em>. De står i avsnittet <em>Egna tabeller</em> i Word-utkastet och PDF-rapporten och i bladet <em>Egna tabeller</em> i Excel-filen, räknade med minsta gruppstorlek.</p>
        ${t.length ? `<ol class="urval-lista">${rader}</ol>` : '<p class="text-dampad-sm">Inga egna tabeller ännu.</p>'}</div>`;
}
const EB_PERBAS_RADER = [['referens', 'Referensen (ställningstagandet)'], ['organisation', 'Organisationen'], ['yrken', 'Yrkesgrupperna'], ['statistik', 'Jämförelsestatistikens rad under varje yrke'], ['kvinnor', 'Kvinnor'], ['man', 'Män']];
const EB_PERBAS_MATT = [['p10', 'P10'], ['p25', 'P25'], ['med', 'Median'], ['p75', 'P75'], ['p90', 'P90'], ['medel', 'Medellön']];
function _ebPerBasReceptHtml() {
    const r = _pbValideraRecept(state.perBasRecept);
    const kryss = (id, text, pa) => `<label class="fs-sm"><input type="checkbox" id="${id}"${pa ? ' checked' : ''}> ${esc(text)}</label>`;
    return `<div id="rapport-perbas" class="marg-t-14"><h3 class="fs-md marg-0-0-6">Tabellerna per BAS-intervall</h3>
        <p class="text-dampad-sm marg-0-0-6">Avsnittet <em>Lönestruktur per BAS-intervall</em> följer det här receptet. Standard är tabellerna som i en skriven lönekartläggning.</p>
        <div class="rad-bryt gap-14">
            <label class="fs-sm">Upprepa per <select id="pb-dim" class="form-select bredd-auto"><option value="bas"${r.dim === 'bas' ? ' selected' : ''}>BAS-intervall</option><option value="sektor"${r.dim === 'sektor' ? ' selected' : ''}>sektor (AID-huvudområde)</option></select></label>
            <fieldset class="falt-grupp"><legend>Rader i varje tabell</legend>${EB_PERBAS_RADER.map(([v, t]) => kryss('pb-rad-' + v, t, r.rader.includes(v))).join(' ')}</fieldset>
            <fieldset class="falt-grupp"><legend>Mått</legend>${EB_PERBAS_MATT.map(([v, t]) => kryss('pb-matt-' + v, t, r.matt.includes(v))).join(' ')}</fieldset>
            <fieldset class="falt-grupp"><legend>Summeringstabeller</legend>${kryss('pb-konsgap', 'Löneskillnader inom likvärdigt arbete', r.konsgap)} ${kryss('pb-aldersgrupper', 'Löneskillnader i åldersgrupper', r.aldersgrupper)}
                <label class="fs-sm">Åldersgränser <input type="text" id="pb-aldersgranser" class="form-select bredd-6em" value="${esc(r.aldersgranser.join(', '))}" autocomplete="off" title="Gränser mellan åldersgrupperna, t.ex. 35, 50 ger –34, 35–49 och 50–"></label></fieldset>
        </div>
        <p class="rad-mitt gap-8 marg-6-0-0"><span id="pb-recept-status" class="text-dampad-sm">${_pbReceptArStandard(state.perBasRecept) ? 'Standardreceptet.' : 'Eget recept — följer med i konfigurationsfilen.'}</span>
        <button type="button" id="pb-aterstall" class="btn btn-secondary btn-sm"${_pbReceptArStandard(state.perBasRecept) ? ' hidden' : ''}>Återställ standard</button></p></div>`;
}
/** Läser receptformuläret till state. Standardreceptet sparas som null. */
function _ebLasPerBasRecept() {
    const v = id => /** @type {HTMLInputElement} */ (document.getElementById(id));
    if (!v('pb-dim')) return;
    const r = {
        dim: v('pb-dim').value,
        rader: EB_PERBAS_RADER.map(([x]) => x).filter(x => v('pb-rad-' + x)?.checked),
        matt: EB_PERBAS_MATT.map(([x]) => x).filter(x => v('pb-matt-' + x)?.checked),
        konsgap: !!v('pb-konsgap')?.checked, aldersgrupper: !!v('pb-aldersgrupper')?.checked,
        aldersgranser: String(v('pb-aldersgranser')?.value || '').split(/[,;\s]+/).map(Number).filter(x => Number.isInteger(x) && x > 0)
    };
    const giltigt = _pbValideraRecept(r);
    state.perBasRecept = _pbReceptArStandard(giltigt) ? null : giltigt;
}
document.addEventListener('change', e => {
    const el = /** @type {HTMLElement} */ (e.target);
    if (!el || !el.closest || !el.closest('#rapport-perbas')) return;
    _ebLasPerBasRecept();
    const fokus = el.id;
    renderExportBesked();
    document.getElementById(fokus)?.focus();
});
document.addEventListener('click', e => {
    const t = /** @type {HTMLElement} */ (e.target);
    if (!t || !t.closest) return;
    if (t.closest('#pb-aterstall')) { state.perBasRecept = null; renderExportBesked(); return; }
    const bort = t.closest('[data-egen-bort]'), flytta = t.closest('[data-egen-flytta]');
    if (!bort && !flytta) return;
    const id = /** @type {HTMLElement} */ (bort || flytta).closest('[data-egen-id]')?.getAttribute('data-egen-id');
    const lista = [...(state.rapportTabeller || [])], i = lista.findIndex(r => r.id === id);
    if (i < 0) return;
    if (bort) lista.splice(i, 1);
    else if (flytta) { const j = i + Number(flytta.getAttribute('data-egen-flytta')); if (j < 0 || j >= lista.length) return; [lista[i], lista[j]] = [lista[j], lista[i]]; }
    state.rapportTabeller = lista;
    renderExportBesked();
    if (flytta) /** @type {HTMLElement} */ (document.querySelector(`[data-egen-id="${id}"] [data-egen-flytta="${flytta.getAttribute('data-egen-flytta')}"]:not([disabled])`))?.focus();
});

document.addEventListener('click', e => {
    if (!/** @type {HTMLElement} */ (e.target).closest) return;
    const fast = /** @type {HTMLElement} */ (e.target).closest('[data-urval-fast]');
    if (fast) { sattRapportUrval(fast.getAttribute('data-urval-fast')); renderExportBesked(); /** @type {HTMLInputElement} */ (document.querySelector(`[data-urval-fast="${fast.getAttribute('data-urval-fast')}"]`))?.focus(); return; }
    const flytta = /** @type {HTMLElement} */ (e.target).closest('[data-urval-flytta]');
    if (!flytta) return;
    const id = flytta.closest('[data-urval-id]')?.getAttribute('data-urval-id') || '', steg = Number(flytta.getAttribute('data-urval-flytta'));
    const u = rapportUrval(), i = u.ordning.indexOf(id);
    // Flytta förbi nästa avsnitt som finns i listan (ett avsnitt som saknas i underlaget visas inte, men behåller sin plats).
    const synliga = [...document.querySelectorAll('#rapport-urval [data-urval-id]')].map(li => li.getAttribute('data-urval-id'));
    const granne = synliga[synliga.indexOf(id) + steg];
    if (i < 0 || !granne) return;
    const j = u.ordning.indexOf(granne), ordning = [...u.ordning];
    ordning.splice(i, 1); ordning.splice(j, 0, id);
    sattRapportUrval({ ordning, med: u.med });
    renderExportBesked();
    /** @type {HTMLInputElement} */ (document.querySelector(`#rapport-urval [data-urval-id="${id}"] [data-urval-flytta="${steg}"]:not([disabled])`))?.focus();
});
document.addEventListener('change', e => {
    const ruta = e.target && /** @type {HTMLElement} */ (e.target).matches && /** @type {HTMLElement} */ (e.target).matches('[data-urval-med]') ? e.target : null;
    if (!ruta) return;
    const u = rapportUrval(), id = /** @type {HTMLElement} */ (ruta).getAttribute('data-urval-med');
    sattRapportUrval({ ordning: u.ordning, med: /** @type {HTMLInputElement} */ (ruta).checked ? [...u.med, id] : u.med.filter(x => x !== id) });
    renderExportBesked();
    /** @type {HTMLInputElement} */ (document.querySelector(`[data-urval-med="${id}"]`))?.focus();
});

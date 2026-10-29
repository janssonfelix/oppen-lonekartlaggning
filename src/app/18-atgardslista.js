// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
// ============================================================================
// ÅTGÄRDSLISTA — samlad checklist från alla flikar
// ============================================================================
// buildActionChecklist är UTTÖMMANDE — den samlar varje grupp/par/flagga
//   som HR behöver agera på, grupperad efter kategori (AKUT, § 3:10, EU-utred,
//   datakvalitet). HR kan klicka av punkterna när de hanterat dem.
//   State sparas på state._actionChecklist (i minnet — försvinner vid reload).

// Tal i punkternas texter: decimalkomma och belopp utan tecken — riktningen skrivs med ord.
const _agPct = v => Math.abs(v).toFixed(1).replace('.', ',');
const _agTal = (v, dec) => v.toFixed(dec).replace('.', ',');
const _agRiktning = v => (v < 0 ? 'lägre' : 'högre');

/**
 * Bygger en uttömmande lista av åtgärdspunkter från alla analysflikar.
 * Varje punkt har stabilt id så användarens "klar"-markering kvarstår även
 * om listan regenereras efter dataändring (samma grupp = samma id).
 *
 * @returns {Array<{id, kategori, prioritet, titel, detalj, tab, källa}>}
 */
function buildActionChecklist({ endastGrupper = false } = {}) {
    /** @type {any[]} */
    const items = [];
    if (!state.data.length) return items;
    // Regressionen körs en gång här och skickas vidare till det som läser den (ADR-17: ingen cache, bara ett värde).
    const reg = !endastGrupper && typeof runOLSRegression === 'function' ? runOLSRegression() : null;

    // Punkterna per grupp (prioriteringen och likvärdighetsparen) bär AID-koden; sektorsöversikten
    // räknar bara dem och bygger därför inte de tunga, organisationsövergripande delarna.
    if (!endastGrupper) {
        // === 1. Underlagets kvalitet (ADR-19) — en punkt per kriterium som inte är OK ===
        try {
            const uk = (typeof bedomningUnderlag === 'function') ? bedomningUnderlag({ reg }) : null;
            if (uk) uk.kriterier.filter(c => c.status !== 'ok').forEach(c => items.push({
                id: 'dq-' + c.id,
                kategori: 'Underlagets kvalitet',
                prioritet: c.status === 'kritisk' ? 'hög' : 'medel',
                titel: `${c.namn}: ${c.status === 'kritisk' ? 'kritisk' : 'varning'}`,
                detalj: c.text,
                tab: 'dashboard',
                källa: 'Underlagets kvalitet'
            }));
            if (state.dataAudit) {
                const da = state.dataAudit;
                if ((da.excludedMissingKon || 0) > 0) {
                    items.push({
                        id: 'dq-kon',
                        kategori: 'Datakvalitet',
                        prioritet: 'hög',
                        titel: `${da.excludedMissingKon} rad${da.excludedMissingKon === 1 ? '' : 'er'} saknar kön och exkluderades`,
                        detalj: 'Komplettera källfilen så fler personer kan ingå i analysen.',
                        tab: 'dashboard',
                        källa: 'CSV-uppladdning'
                    });
                }
                if ((da.invalidLon || 0) > 0) {
                    items.push({
                        id: 'dq-lon',
                        kategori: 'Datakvalitet',
                        prioritet: 'medel',
                        titel: `${da.invalidLon} rad${da.invalidLon === 1 ? '' : 'er'} med ogiltig lön`,
                        detalj: 'Kontrollera att lönekolumnen innehåller siffror, inte text. Se exempel i datakvalitetsrapporten.',
                        tab: 'dashboard',
                        källa: 'CSV-uppladdning'
                    });
                }
            }
        } catch (e) { rapporteraFel('Att göra: underlagets kvalitet', e); }

        // === Lika arbete: rått gap > 5 % i jämförbara BAS (samma regel som kompliansen) ===
        try {
            const d = getData();
            const jb = _dqJamforbaraBas(d, kInstalld());
            const perBas = (reg && !reg.error && reg.perBas) ? reg.perBas : [];
            jb.jamforbara.forEach(b => {
                const df = d.filter(r => r.bas === b);
                const kv = df.filter(r => r.kon.includes('kvinna')).map(r => r.lon);
                const ma = df.filter(r => r.kon === 'man' || r.kon === 'män').map(r => r.lon);
                const gap = (Stat.median(kv) / Stat.median(ma)) * 100 - 100;
                if (Math.abs(gap) <= 5) return;
                const pb = perBas.find(p => p.bas === b && p.status === 'ok');
                const forklaring = pb
                    ? (Math.abs(pb.gapPct) <= 5
                        ? ` Efter hänsyn till ålder har kvinnor ${_agPct(pb.gapPct)} % ${_agRiktning(pb.gapPct)} lön — under 5 %.`
                        : ` Efter hänsyn till ålder har kvinnor ${_agPct(pb.gapPct)} % ${_agRiktning(pb.gapPct)} lön.`)
                    : '';
                items.push({
                    id: 'gap-bas-' + b, kategori: 'Lika arbete', prioritet: 'medel',
                    titel: `BAS ${b}: kvinnors medianlön ${andelAvMan(gap)} av mäns`,   // rå skillnad: samma form som i Lika arbete
                    detalj: `Rå skillnad över 5 % i ett jämförbart BAS-intervall.${forklaring} Pröva om skillnaden har sakliga skäl.`,
                    tab: 'matrix', källa: 'Lika arbete'
                });
            });
        } catch (e) { rapporteraFel('Att göra: lika arbete per BAS', e); }

        // === 1b. Oförklarat gap för hela organisationen (regressionen) ===
        try {
            if (reg && !reg.error && reg.pValue < 0.05) {
                items.push({
                    id: 'reg-oforklarat', kategori: 'Lika arbete',
                    prioritet: Math.abs(reg.konPct) > 5 ? 'hög' : 'medel',
                    titel: `Oförklarat lönegap för hela organisationen: kvinnor ${_agPct(reg.konPct)} % ${_agRiktning(reg.konPct)} lön än män (efter ålder och BAS)`,
                    detalj: 'Ett oförklarat gap är inte samma sak som ett osakligt. Pröva skillnaden per yrkesgrupp i Lika arbete.',
                    tab: 'matrix', källa: 'Regressionen i Lika arbete'
                });
            }
        } catch (e) { rapporteraFel('Att göra: regressionen', e); }
    }

    // === 2. Prioriteringsanalysen (AKUT, åtgärd, bevaka) ===
    try {
        if (state.policy.length || state.statistik.length) {
            const ref = (typeof _selectedPrioReference === 'function')
                ? _selectedPrioReference()
                : (/** @type {HTMLInputElement} */ (document.querySelector('input[name="prio-ref"]:checked'))?.value || 'stallningstagande');
            const prioItems = (typeof computePrioritization === 'function') ? computePrioritization(ref) : [];
            prioItems.filter(i => i.status === 'akut').forEach(i => {
                const fmt = new Intl.NumberFormat('sv-SE');
                items.push({
                    id: `prio-akut-${i.aid || i.yrke}-${i.bas}`, aid: i.aid || null,
                    kategori: 'Värt att börja med',
                    prioritet: 'hög',
                    titel: `${i.yrke} (BAS ${i.bas}) — ${_agPct(i.diffPct)} % under ${i.refSource}`,
                    detalj: `n=${i.n}, kostnad att lyfta till referens: ${fmt.format(Math.round(i.annualGapTotal))} kr/år. Väg skillnaden mot sakliga skäl och dokumentera din bedömning.`,
                    tab: 'prioritering',
                    källa: 'Prioriteringsanalys'
                });
            });
            prioItems.filter(i => i.status === 'atgard').slice(0, 10).forEach(i => {
                items.push({
                    id: `prio-atgard-${i.aid || i.yrke}-${i.bas}`, aid: i.aid || null,
                    kategori: 'Värt att granska',
                    prioritet: 'medel',
                    titel: `${i.yrke} (BAS ${i.bas}) — ${_agPct(i.diffPct)} % under ${i.refSource}`,
                    detalj: `n=${i.n}, påverkansindex ${svTal(i.priorityIndex, 0)}. Titta närmare på om det finns sakliga skäl för skillnaden.`,
                    tab: 'prioritering',
                    källa: 'Prioriteringsanalys'
                });
            });
        }
    } catch (e) { rapporteraFel('Att göra: prioriteringen', e); }

    // === 3. § 3:10 Likvärdighetsanalys — kandidatpar ===
    // Paren kommer i första hand ur organisationens egna yrken; jämförelsestatistiken är
    // bara en reserv. Därför krävs ingen inläst statistik för att paren ska komma med.
    try {
        if (typeof computeLikvardighetPairs === 'function') {
            const lv = likvardighetResultat();
            // k-anonymitet: par med en grupp under tröskeln tas bort FÖRE begränsningen till 20
            // (undantaget gäller bara fliken Likvärdigt arbete); meningen om dem: _attGoraParNot().
            _parForRedovisning(lv?.pairs).par.slice(0, 20).forEach(p => {
                items.push({
                    id: `lv-${p.kvAid}-${p.maAid}-${p.kvBas}`, aid: p.kvAid || null,
                    kategori: 'Likvärdigt arbete',
                    prioritet: p.gapPct >= 10 ? 'hög' : 'medel',
                    titel: `${p.kvLabel || p.kvAid} (BAS ${p.kvBas}, ${svPct(p.kvKvinnoPct, 0)} kv) ligger ${_agPct(p.gapPct)} % under ${p.maLabel || p.maAid}`,
                    detalj: `Organisationens median ${Math.round(p.kvMedian).toLocaleString('sv-SE')} kr mot jämförelsestatistikens ${Math.round(p.maMedian).toLocaleString('sv-SE')} kr. Granska om kraven är likvärdiga och dokumentera sakliga skäl.`,
                    tab: 'likvardighet',
                    källa: 'Likvärdighetsanalys'
                });
            });
        }
    } catch (e) { rapporteraFel('Att göra: likvärdigt arbete', e); }

    if (!endastGrupper) {
        // === 4. EU-Lönekartläggning — per-BAS gap > 5 % efter korrigering för många tester (Benjamini–Hochberg) ===
        try {
            if (reg && !reg.error && reg.perBas) {
                // BH-justering
                const okTests = reg.perBas.filter(p => p.status === 'ok' && isFinite(p.pValue));
                const bhQ = {};
                if (okTests.length > 1) {
                    const sorted = [...okTests].sort((a, b) => a.pValue - b.pValue);
                    const m = sorted.length;
                    const qRaw = sorted.map((t, i) => Math.min(1, t.pValue * m / (i + 1)));
                    for (let i = m - 2; i >= 0; i--) qRaw[i] = Math.min(qRaw[i], qRaw[i + 1]);
                    sorted.forEach((t, i) => { bhQ[t.bas] = qRaw[i]; });
                }
                reg.perBas.forEach(p => {
                    if (p.status !== 'ok') return;
                    const q = bhQ[p.bas];
                    const sig = p.pValue < 0.05 && (q == null || q < 0.05);
                    if (sig && Math.abs(p.gapPct) > 5) {
                        items.push({
                            id: `eu-bas-${p.bas}`,
                            kategori: 'EU 2023/970',
                            prioritet: 'hög',
                            titel: `BAS ${p.bas}: kvinnor ${_agPct(p.gapPct)} % ${_agRiktning(p.gapPct)} lön efter ålderskontroll — utredningskrav`,
                            detalj: `Statistiskt säkerställt också efter korrigering för många samtidiga tester (p=${p.pValue < 0.001 ? '< 0,001' : _agTal(p.pValue, 3)}, q=${q != null && q < 0.001 ? '< 0,001' : (q != null ? _agTal(q, 3) : '—')}). Över 5 %-tröskeln i EU:s lönetransparensdirektiv — här aktualiseras direktivets utredningssteg.`,
                            tab: 'matrix',
                            källa: 'Lika arbete'
                        });
                    }
                });
            }
        } catch (e) { rapporteraFel('Att göra: EU-direktivets mått', e); }

        // === 6. Livscykelanalys — växande gap ===
        try {
            const life = (typeof runLifecycleRegression === 'function') ? runLifecycleRegression(_lifecycleFixBas) : null;
            if (life && life.ok && life.gapDelta > 2 && (life.kvAgePVal < 0.10 || life.kvAge2PVal < 0.10)) {
                items.push({
                    id: 'livscykel-vaxer',
                    kategori: 'Livscykel',
                    prioritet: 'medel',
                    titel: `Lönegapet växer med åldern (+${_agTal(life.gapDelta, 1)} procentenheter mellan 25 och 65 år)`,
                    detalj: 'Kan indikera långsammare karriärväg för kvinnor, föräldraledighetseffekter eller könsbias i lönerevisioner. Granska lönerevisionshistorik och befordringsstatistik per kön.',
                    tab: 'kon',
                    källa: 'Livscykelanalys'
                });
            }
        } catch (e) { rapporteraFel('Att göra: livscykeln', e); }
    }

    return items;
}

// Länk till punktens flik. Datakvalitetspunkter hör till Översikt, där användaren
// redan är — de leder till Underlagets kvalitet i stället. aria-label skiljer
// länkarna åt för skärmläsare (annars heter alla "Gå dit").
function _attGoraLank(it, text, klass = '') {
    if (!it.tab) return '';
    const ankare = it.tab === 'dashboard' ? ' data-go-to-anchor="underlagets-kvalitet"' : '';
    // Namnet börjar med den synliga texten (WCAG 2.5.3), följd av punkten.
    return `<a href="#" data-go-to-tab="${esc(it.tab)}"${ankare} aria-label="${esc(text)}: ${esc(it.titel)}"${klass ? ` class="${klass}"` : ''}>${text}</a>`;
}

/** Meningen om § 3:10-par som utelämnats ur listan (grupp under tröskeln), annars tom sträng. */
function _attGoraParNot() {
    try {
        if (!state.data.length || typeof computeLikvardighetPairs !== 'function') return '';
        return _parForRedovisning(likvardighetResultat()?.pairs).not;
    } catch (_e) { return ''; }
}

/**
 * Renderar åtgärdslistan på Översikt. Visar grupperade kategorier, klickbara
 * checkboxar (state i minnet via state._actionChecklistDone-Set), CSV-export.
 */
/** Ritar Att göra och svarar med punkterna (processöversikten läser dem). */
function renderActionChecklist() {
    const wrap = document.getElementById('action-checklist-container');
    const kort = document.getElementById('att-gora');
    const borja = document.getElementById('att-gora-borja');
    if (!wrap) return;
    if (!state.data.length) { wrap.innerHTML = ''; if (kort) kort.hidden = true; if (borja) borja.innerHTML = ''; return []; }
    if (kort) kort.hidden = false;

    const items = buildActionChecklist();   // returneras, så att processöversikten kan läsa samma lista
    // Hela listan är ett avsnitt som fälls ut: "Börja här" ovanför bär det som ska göras först.
    // Listan ritas om vid varje avbockning, så avsnittets läge bevaras.
    const varOppen = !!/** @type {HTMLDetailsElement} */ ((wrap.querySelector('#avsnitt-ov-punkter') || {})).open;
    const somAvsnitt = (nyckel, innehall) => `<details class="avsnitt" id="avsnitt-ov-punkter"${varOppen ? ' open' : ''}>
        <summary><span class="avsnitt-titel"><h2>Alla punkter</h2><span class="avsnitt-under">Hela listan, grupperad efter var punkten kommer ifrån</span></span><span class="avsnitt-nyckel" id="nyckel-ov-punkter">${esc(nyckel)}</span></summary>
        ${innehall}</details>`;
    const parNot = _attGoraParNot();
    const parNotHtml = parNot ? `<p class="att-gora-par-not text-dampad-sm marg-8-0-0 pad-0-4">${esc(parNot)}</p>` : '';
    if (!items.length) {
        wrap.innerHTML = somAvsnitt('Inga punkter', `<div class="insight-feed">
            <div class="insight-empty">Inga punkter att hantera. Verktyget har inte lyft något som sticker ut utifrån aktuell analys.</div>
            ${parNotHtml}
        </div>`);
        if (borja) borja.innerHTML = '<h3 class="att-gora-borja-rubrik">Börja här</h3><p>Inga punkter att hantera.</p>';
        return;
    }

    // Initiera klar-set om saknas
    if (!state._actionChecklistDone) state._actionChecklistDone = new Set();
    const done = state._actionChecklistDone;

    // Gruppera efter kategori
    const byKategori = {};
    items.forEach(it => {
        if (!byKategori[it.kategori]) byKategori[it.kategori] = [];
        byKategori[it.kategori].push(it);
    });

    // Prioriteten bär statusmärkena med egen form (03-ikoner.js): fylld cirkel för hög, triangel för medel — samma
    // märken som statusarna i tabellerna, så att färg aldrig är ensam om betydelsen.
    const prioKlass = p => p === 'hög' ? 'fg-kritisk' : p === 'medel' ? 'fg-varning' : 'fg-ok';
    const prioIcon  = p => p === 'hög' ? ikon('statusKritisk', 14) : p === 'medel' ? ikon('statusVarning', 14) : ikon('bock', 14);
    const totalDone = items.filter(it => done.has(it.id)).length;
    const totalCount = items.length;

    wrap.innerHTML = somAvsnitt(`${totalDone} av ${totalCount} hanterade`, `
        <div class="insight-feed">
            <div class="insight-feed-header rad-bryt-mitt mellan">
                <span class="avsnitt-verktyg-rubrik">Verktyg för listan</span>
                <div class="rad-mitt gap-10">
                    <span class="text-dampad-sm">${totalDone} / ${totalCount} hanterade</span>
                    <button id="btn-export-checklist" class="btn btn-secondary btn-sm" title="Exportera som CSV — öppnas direkt i Excel/Word">CSV</button>
                    <button id="btn-checklist-clear-done" class="btn btn-secondary btn-sm" title="Avmarkera alla för att börja om">Rensa markeringar</button>
                </div>
            </div>
            <p class="text-dampad-sm lh-1_55 marg-8-0-14 pad-0-4">
                Sammanställning av alla punkter du behöver hantera enligt verktygets analyser.
                Klicka på rutorna när du hanterat punkten. Exportera som CSV för att klistra in
                i Word-mallen eller dela med ansvariga kollegor. Markeringarna sparas under sessionen
                men försvinner när du stänger fliken (GDPR — ingen persistens).
            </p>
            ${parNotHtml}
            ${Object.entries(byKategori).map(([kat, list]) => `
                <details open class="ag-grupp">
                    <summary>
                        ${esc(kat)} <span class="text-dampad-sm fw-normal">(${list.length} punkt${list.length === 1 ? '' : 'er'}, ${list.filter(it => done.has(it.id)).length} hanterade)</span>
                    </summary>
                    <ul class="utan-punkter marg-0 pad-0">
                        ${list.map(it => `
                            <li class="topp ram-t-1-kant rad gap-12 pad-10-14${done.has(it.id) ? ' bg-ok-yta' : ''}">
                                <input type="checkbox" class="act-cb pekare marg-t-3" data-id="${esc(it.id)}" ${done.has(it.id) ? 'checked' : ''} aria-label="Markera som hanterad: ${esc(it.titel)}">
                                <div class="flex-1">
                                    <div class="rad-bryt baslinje gap-8">
                                        <span class="ag-prio ${prioKlass(it.prioritet)}">${prioIcon(it.prioritet)} ${esc(it.prioritet.charAt(0).toUpperCase() + it.prioritet.slice(1))}</span>
                                        <strong class="fs-md${done.has(it.id) ? ' farg-dampad genomstruken' : ''}">${esc(it.titel)}</strong>
                                    </div>
                                    <div class="text-dampad-sm lh-1_5 marg-t-4">${esc(it.detalj)}</div>
                                    <div class="finstilt">
                                        Källa: ${esc(it.källa)} ·
                                        ${_attGoraLank(it, 'öppna fliken', 'farg-primary utan-understrykning')}
                                    </div>
                                </div>
                            </li>`).join('')}
                    </ul>
                </details>`).join('')}
        </div>
    `);

    const oppna = _agBorjaHar(items, done);   // ordningen: src/lib/attgora.js (ADR-29)
    if (borja) borja.innerHTML = `<h3 class="att-gora-borja-rubrik">Börja här</h3>` + (oppna.length
        ? `<ol class="att-gora-borja-lista">${oppna.map(it => `<li data-borja-id="${esc(it.id)}"><strong>${esc(it.titel)}</strong> <span class="att-gora-kat">${esc(it.kategori)}</span>${it.tab ? ' ' + _attGoraLank(it, 'Gå dit') : ''}</li>`).join('')}</ol>`
        : '<p>Alla punkter är hanterade.</p>');

    // Checkbox-handlers
    wrap.querySelectorAll('.act-cb').forEach(cb => {
        cb.addEventListener('change', () => {
            const id = /** @type {HTMLElement} */ (cb).dataset.id || '';
            if (/** @type {HTMLInputElement} */ (cb).checked) done.add(id);
            else done.delete(id);
            renderActionChecklist();  // omrendrera för uppdaterad räknare + bakgrundsfärg
        });
    });

    // CSV-export
    document.getElementById('btn-export-checklist')?.addEventListener('click', () => medExportLage(() => exportActionChecklistCSV(buildActionChecklist(), done)));

    // Rensa markeringar
    document.getElementById('btn-checklist-clear-done')?.addEventListener('click', () => {
        if (!confirm('Avmarkera alla ' + done.size + ' hanterade punkter?')) return;
        state._actionChecklistDone = new Set();
        renderActionChecklist();
    });
    return items;
}

/**
 * Exporterar åtgärdslistan som CSV.
 */
// Går alltid genom exportläget (ADR-51): djupräknaren håller skärmen i exportläget tills den sista pågående exporten är klar.
function exportActionChecklistCSV(...a) { return medExportLage(() => _exportActionChecklistCSVExport.apply(null, /** @type {any} */ (a))); }
function _exportActionChecklistCSVExport(items, done) {
    if (!items.length) { alert('Ingen åtgärdslista att exportera.'); return; }
    const rows = [[
        'Status', 'Prioritet', 'Kategori', 'Punkt', 'Detalj', 'Källa', 'Flik'
    ]];
    items.forEach(it => {
        rows.push([
            done.has(it.id) ? 'Hanterad' : 'Öppen',
            it.prioritet.toUpperCase(),
            it.kategori,
            it.titel,
            it.detalj,
            it.källa,
            it.tab
        ]);
    });
    rows.push([]);
    rows.push(['# METADATA']);
    rows.push(['Genererad', new Date().toLocaleString('sv-SE')]);
    rows.push(['Verktyg', 'Öppen lönekartläggning v' + (typeof APP_VERSION !== 'undefined' ? APP_VERSION : '–')]);
    rows.push(['Totalt punkter', items.length]);
    rows.push(['Hanterade', items.filter(it => done.has(it.id)).length]);
    const parNot = _attGoraParNot();
    if (parNot) rows.push(['Utelämnade par', parNot]);
    _downloadCSV(rows, 'atgardslista_' + new Date().toISOString().slice(0, 10));
}

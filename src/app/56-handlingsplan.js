// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
// ---- Handlingsplan: mall, förifyllning från Prioritering och Likvärdigt arbete, export ----
// Förifyllt handlingsplansunderlag (Excel): seedar rader från Prioritering
// (grupper under referens) och § 3:10-paren. Endast aggregat — inga individdata.
// Renodlar analysflödet: verktyget levererar underlaget, planen färdigställs i Word.
// Delad seedning av handlingsplanen: rader från Prioritering (under referens, § 9)
// + § 3:10-par. Returnerar enbart de förifyllda dataraderna (utan tomrader) så att
// både Excel-exporten och skärm-mallen (renderHandlingsplanSeed) använder samma logik.
function _handlingsplanSeedRows() {
    const months = (state.costSettings && state.costSettings.months) || 12;
    const poFactor = 1 + ((state.costSettings && state.costSettings.poPct) || 0) / 100;
    const rows = [];
    let prioCount = 0, lvCount = 0, parUtelamnade = 0;
    try {
        const ref = (typeof _selectedPrioReference === 'function') ? _selectedPrioReference() : 'stallningstagande';
        const hasRef = ref === 'stallningstagande' ? state.policy.length : state.statistik.length;
        if (hasRef) {
            const thr = (state.prioConfig && state.prioConfig.atgardThreshold != null) ? state.prioConfig.atgardThreshold : -5;
            computePrioritization(ref).filter(i => i.diffPct < thr).forEach(i => {
                rows.push(['Granska löneläge och väg mot sakliga skäl', `${i.yrke} · BAS ${i.bas}`, 'Lika arbete (referensjämförelse)', '', Math.round(i.annualGapTotal), '', '', '']);
                prioCount++;
            });
        }
    } catch (e) { rapporteraFel('Handlingsplan: prioriteringen', e); }
    try {
        if (state.statistik.length || state.data.length) {
            const lv = likvardighetResultat();
            // k-anonymitet: par med en grupp under tröskeln förifylls inte (undantaget gäller bara fliken)
            const { par, utelamnade } = _parForRedovisning(lv && lv.pairs);
            parUtelamnade = utelamnade;
            par.forEach(p => {
                const arsKostnad = Math.round(Math.abs(p.gapKr) * (p.kvN || 1) * months * poFactor);
                rows.push(['Granska likvärdigt arbete (kvinnodominerat yrke)', `${p.kvAid} · BAS ${p.kvBas}`, 'Likvärdigt arbete', '', arsKostnad, '', '', '']);
                lvCount++;
            });
        }
    } catch (e) { rapporteraFel('Handlingsplan: likvärdigt arbete', e); }
    return { rows, prioCount, lvCount, parUtelamnade, parNot: _parUtelamnadeNot(parUtelamnade) };
}

// Lagrumstexten i de förifyllda raderna hör till Excel-exporten; i gränssnittet
// visas varifrån raden kommer, utan paragrafhänvisning.
function _handlingsplanUnderlag(lagrum) {
    if (/^Lika arbete\b/.test(lagrum)) return 'Lika arbete (referensjämförelse)';
    if (/^Likvärdigt arbete\b/.test(lagrum)) return 'Likvärdigt arbete';
    return lagrum;
}

// #UX Renderar de förifyllda raderna direkt i skärm-mallen (read-only) ovanför
// fyllbara tomrader — så HR ser underlaget utan att först behöva exportera.
function renderHandlingsplanSeed() {
    const tbody = document.getElementById('handlingsplan-tbody');
    if (!tbody) return;
    const seed = getData().length ? _handlingsplanSeedRows() : { rows: [], prioCount: 0, lvCount: 0, parUtelamnade: 0, parNot: '' };
    const fmtKr = n => (n ? Math.round(n).toLocaleString('sv-SE') + ' kr' : '');
    const seededHtml = seed.rows.map(r =>
        `<tr class="handlingsplan-seeded"><td>${esc(r[0])}</td><td>${esc(r[1])}</td><td>${esc(_handlingsplanUnderlag(r[2]))}</td>` +
        `<td></td><td class="t-hoger">${esc(fmtKr(r[4]))}</td><td></td><td></td><td></td></tr>`).join('');
    const emptyN = Math.max(5, 8 - seed.rows.length);
    const emptyHtml = Array.from({ length: emptyN }, () =>
        '<tr class="handlingsplan-empty"><td>&nbsp;</td><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr>').join('');
    tbody.innerHTML = seededHtml + emptyHtml;
    const note = document.getElementById('handlingsplan-seed-note');
    if (note) {
        const parNot = seed.parNot ? ` ${esc(seed.parNot)}` : '';
        note.innerHTML = (seed.rows.length
            ? `Förifyllt med <strong>${seed.rows.length}</strong> rad${seed.rows.length === 1 ? '' : 'er'} (${seed.prioCount} under referens, ${seed.lvCount} från likvärdighetsanalysen-kandidater) — de grå raderna är ett utgångsläge att granska. Komplettera med sakliga skäl, ansvarig, tidsplan och status; exportera till Excel eller skriv ut för att färdigställa i Word.`
            : 'Mallen förifylls automatiskt med grupperna från Prioritering och Likvärdigt arbete när data och referens finns. Fyll annars i för hand eller ladda upp underlag på <strong>Översikt</strong>.') + parNot;
    }
}

function exportHandlingsplan() {
    if (typeof XLSX === 'undefined') { alert('Excel-biblioteket kunde inte laddas.'); return; }
    const header = ['Åtgärd', 'Berörd grupp (AID·BAS)', 'Lagrum', 'Sakligt skäl prövat?', 'Beräknad kostnad (kr/år, inkl. PO)', 'Ansvarig', 'Tidsplan (senast inom 3 år)', 'Status'];
    const seed = _handlingsplanSeedRows();
    const prioCount = seed.prioCount, lvCount = seed.lvCount;
    const rows = seed.rows.slice();
    for (let i = 0; i < 5; i++) rows.push(['', '', '', '', '', '', '', '']);   // tomma rader för manuella tillägg

    const guide = [
        ['Handlingsplan för jämställda löner — vägledning', ''],
        ['Lagrum', 'Diskrimineringslagen 3 kap.: åtgärder, kostnadsberäkning och tidsplan i dokumentationen av lönekartläggningen'],
        ['§ 11', 'Arbetsgivare med minst 10 anställda ska upprätta en handlingsplan med åtgärder, kostnadsberäkning och tidsplan.'],
        ['Tidsplan', 'Åtgärderna ska genomföras så snart som möjligt, dock senast inom tre år.'],
        ['Ej inom 3 år', 'Åtgärder som inte kan genomföras inom tre år ska dokumenteras särskilt med motivering och plan för när de kan genomföras.'],
        ['§ 13', 'Lönekartläggningen, analysen och handlingsplanen ska dokumenteras skriftligt.'],
        ['Samverkan', 'Arbetet ska bedrivas i samverkan med arbetstagarna (diskrimineringslagen).'],
        ['', ''],
        ['Detta underlag', `Förifyllt med ${prioCount} grupp(er) under referens (Prioritering) och ${lvCount} kandidatpar i likvärdigt arbete.${seed.parNot ? ' ' + seed.parNot : ''} Fyll i sakliga skäl, ansvarig, tidsplan och status. Endast aggregat — inga individdata.`],
        ['OBS', 'Detta är ett analysunderlag. Den sammanhållna handlingsplanen färdigställs i arbetsgivarens dokumentation/Word.']
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([header, ...rows]), 'Handlingsplan');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(guide), 'Vägledning');
    _appendMethodSheet(wb);
    XLSX.writeFile(wb, `handlingsplan_underlag_${new Date().toISOString().slice(0, 10)}.xlsx`);
    if (typeof announceToScreenReader === 'function') announceToScreenReader('Handlingsplansunderlag exporterat.');
}
document.getElementById('btn-export-handlingsplan')?.addEventListener('click', exportHandlingsplan);

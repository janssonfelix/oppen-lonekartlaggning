// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
// ---- Excel-export av jämförelsen mot jämförelsestatistiken ----

/**
 * Exporterar samlad benchmark-jämförelse till Excel-fil.
 *
 * Innehåller ALLA percentiler (P10/Median/P90 + bredd P90/P10) för:
 *   - Organisationen (beräknat från CSV-data)
 *   - Extern jämförelsestatistik (state.statistik) — om laddat och har percentilen
 *   - Lönepolitiskt ställningstagande (state.policy) — om laddat
 *
 * Plus diff (kr och %) mot vardera referens per percentil. Inkluderar metadata-flik
 * med profil, version, datum, n total. Hoppar över k-maskerade grupper.
 *
 * Inte beroende av vilken metric-knapp som är vald i UI:t — alla värden exporteras alltid.
 */
// Går alltid genom exportläget (ADR-51): djupräknaren håller skärmen i exportläget tills den sista pågående exporten är klar.
function exportBenchmarkExcel(...a) { return medExportLage(() => _exportBenchmarkExcelExport.apply(null, /** @type {any} */ (a))); }
function _exportBenchmarkExcelExport() {
    if (typeof XLSX === 'undefined') { alert('XLSX-biblioteket är inte laddat.'); return; }
    const d = getData();
    if (!d.length) { alert('Ingen data laddad. Ladda upp strukturdatan först.'); return; }
    const hasStat = state.statistik.length > 0;
    const hasPolicy = state.policy.length > 0;
    if (!hasStat && !hasPolicy) {
        alert('Ingen referensdata laddad — varken jämförelsestatistik eller lönepolitiskt ställningstagande. Inget att jämföra mot.');
        return;
    }

    const profileLabel = state.profile.benchmarkLabel;

    // Hjälpare: round eller null
    const rOrNull = v => (v && isFinite(v)) ? Math.round(v) : null;
    const pctOrNull = (org, ref) => (org && ref) ? Number(((org / ref - 1) * 100).toFixed(2)) : null;
    const diffOrNull = (org, ref) => (org && ref) ? Math.round(org - ref) : null;
    const breddOrNull = (p10, p90) => (p10 && p90 && p10 > 0) ? Number((p90 / p10).toFixed(3)) : null;

    // Header-rad: 30+ kolumner. Multi-line-grupperade headers via två rader.
    const headerRow1 = [
        '', '', '',
        orgNamn(), '', '', '',
        `Jämförelse: ${profileLabel}`, '', '', '', '', '', '', '',
        referensNamn(), '', '', '', '', '', '', ''
    ];
    const headerRow2 = [
        'AID / Yrkesgrupp', 'BAS', 'N (organisationen)',
        'P10', 'Median', 'P90', 'Bredd P90/P10',
        'P10', 'Diff P10 (kr)', 'Diff P10 (%)',
        'Median', 'Diff Median (kr)', 'Diff Median (%)',
        'P90', 'Diff P90 (kr)', 'Diff P90 (%)',
        'P10', 'Diff P10 (kr)', 'Diff P10 (%)',
        'Median', 'Diff Median (kr)', 'Diff Median (%)',
        'P90', 'Diff P90 (kr)', 'Diff P90 (%)'
    ];

    // Raderna kommer ur src/lib/jamforelse.js — samma som tabellen och diagrammen.
    const { rader, utelamnade: maskedGroups } = _jfRader(d, { statistik: state.statistik, policyFor, k: kTroskel() });
    const dataRows = rader.map(r => {
        const s = r.statistik, p = r.stallningstagande, o = r.org;
        return [
            r.yrke, r.bas, r.n,
            rOrNull(o.p10), rOrNull(o.median), rOrNull(o.p90), breddOrNull(o.p10, o.p90),
            rOrNull(s.p10),    diffOrNull(o.p10, s.p10),       pctOrNull(o.p10, s.p10),
            rOrNull(s.median), diffOrNull(o.median, s.median), pctOrNull(o.median, s.median),
            rOrNull(s.p90),    diffOrNull(o.p90, s.p90),       pctOrNull(o.p90, s.p90),
            rOrNull(p.p10),    diffOrNull(o.p10, p.p10),       pctOrNull(o.p10, p.p10),
            rOrNull(p.median), diffOrNull(o.median, p.median), pctOrNull(o.median, p.median),
            rOrNull(p.p90),    diffOrNull(o.p90, p.p90),       pctOrNull(o.p90, p.p90)
        ];
    });
    const nGroups = rader.length;
    const nPersoner = rader.reduce((s, r) => s + r.n, 0);

    // Bygg arket
    const aoa = [headerRow1, headerRow2, ...dataRows];
    const sheet = XLSX.utils.aoa_to_sheet(aoa);

    // Slå ihop celler för grupp-headers (rad 1)
    if (!sheet['!merges']) sheet['!merges'] = [];
    sheet['!merges'].push({ s: { r: 0, c: 3 },  e: { r: 0, c: 6 } });   // Organisationen (4 kolumner)
    sheet['!merges'].push({ s: { r: 0, c: 7 },  e: { r: 0, c: 15 } });  // Jämförelse (9 kolumner)
    sheet['!merges'].push({ s: { r: 0, c: 16 }, e: { r: 0, c: 24 } });  // Ställningstagande (9 kolumner)

    // Kolumnbredd
    sheet['!cols'] = [
        { wch: 42 }, { wch: 6 }, { wch: 6 },
        { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 10 },
        { wch: 10 }, { wch: 12 }, { wch: 12 },
        { wch: 10 }, { wch: 12 }, { wch: 12 },
        { wch: 10 }, { wch: 12 }, { wch: 12 },
        { wch: 10 }, { wch: 12 }, { wch: 12 },
        { wch: 10 }, { wch: 12 }, { wch: 12 },
        { wch: 10 }, { wch: 12 }, { wch: 12 }
    ];

    // Frys första 2 raderna (headers) + första kolumnen (yrke)
    sheet['!freeze'] = { xSplit: 1, ySplit: 2 };

    // Metadata-flik
    const meta = [
        ['Öppen lönekartläggning — Samlad Jämförelse-export', ''],
        ['', ''],
        ['Genererad', new Date().toISOString()],
        ['Verktyg version', APP_VERSION],
        ['', ''],
        ['Aktiv profil', state.profile.name],
        ['Jämförelseinstitution', profileLabel],
        ['', ''],
        ['Antal grupper i export', nGroups],
        ['Antal personer (totalt)', nPersoner],
        [`Antal grupper utelämnade, k-anonymitet (n<${kTroskel()})`, maskedGroups.length],
        ...(maskedGroups.length ? [['  - vilka', maskedGroups.join(', ')]] : []),
        ['', ''],
        ['Jämförelsestatistik laddat', hasStat ? 'Ja' : 'Nej'],
        ['  - innehåller P10', state.statistikHasP10 ? 'Ja' : 'Nej (saknas i uppladdad fil)'],
        ['  - innehåller P90', state.statistikHasP90 ? 'Ja' : 'Nej (saknas i uppladdad fil)'],
        ['Referens', referensNamn() + referensKalla()],
        ['', ''],
        ['Diff-kolumner: positiva värden (grön) = organisationen ligger över referens.', ''],
        ['Negativa värden (röd) = organisationen ligger under referens.', ''],
        ['Tomma celler = referensvärde saknas i uppladdad fil eller ej tillämpligt.', ''],
        [`k-anonymitet (n<${kTroskel()}) = grupper med färre än ${kTroskel()} personer exkluderas helt.`, '']
    ];
    const metaSheet = XLSX.utils.aoa_to_sheet(meta);
    metaSheet['!cols'] = [{ wch: 48 }, { wch: 32 }];

    // Applicera svenska nummerformat på data-kolumnerna.
    // Jämförelse-arket har två header-rader (group + sub) — applicera mot sub-header (rad 1).
    _applyColumnNumFormats(sheet, SV_NUM_FORMATS, 1);

    // Bygg workbook
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, sheet, 'Jamforelse_alla_percentiler');
    XLSX.utils.book_append_sheet(wb, metaSheet, 'Metadata');

    const filename = `lonekartlaggning_jamforelse_${new Date().toISOString().slice(0,10)}.xlsx`;
    _appendMethodSheet(wb);
    XLSX.writeFile(wb, filename);
    _showExportSensitivityToast();
    announceToScreenReader(`Excel-fil exporterad: ${nGroups} grupp${nGroups === 1 ? '' : 'er'}, ${nPersoner} person${nPersoner === 1 ? '' : 'er'}.`);
}

document.getElementById('btn-export-benchmark')?.addEventListener('click', exportBenchmarkExcel);

// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
// ---- Excel-export av jämförelsen mot jämförelsestatistiken ----
import { jamforelseRader, matchningEtikett } from '../lib/jamforelse.js';
import { personOrd } from '../lib/namn.js';
import { stor } from '../lib/termer.js';
import { meddelaSkarmlasare } from './01-html-och-tillganglighet.js';
import { idagDatum } from './03-hjalpfunktioner.js';
import { kTroskel } from './06-k-troskel.js';
import { orgNamn } from './07-standardinstallningar.js';
import { APP_VERSION } from './08-version.js';
import { T } from './09-termer.js';
import { hamtaData, policyFor, referensKalla, referensNamn, state } from './12-tillstand.js';
import { _laggTillMetodblad, _tillampaTalformat, _visaExportvarning, SV_TALFORMAT } from './22-exporthjalpare.js';
import { medExportLage } from './23-exportgrind.js';

/**
 * Jämförelsen mot jämförelsestatistiken och ställningstagandet som Excel-fil: P10, median och P90 (och kvoten
 * P90/P10) för organisationen, jämförelsestatistiken och ställningstagandet, med skillnaden i kronor och procent mot
 * varje referens, och ett blad med uppgifter om exporten. Grupper under minsta gruppstorlek står inte med. Alla mått
 * följer med, oavsett vilket mått fliken visar.
 */
// Går alltid genom exportläget (ADR-51): djupräknaren håller skärmen i exportläget tills den sista pågående exporten är klar.
function exportJamforelseExcel(...a) { return medExportLage(() => _exportJamforelseExcelExport.apply(null, /** @type {any} */ (a))); }
function _exportJamforelseExcelExport() {
    const d = hamtaData();
    if (!d.length) { alert('Ingen lönefil är inläst. Läs in lönefilen först.'); return; }
    const hasStat = state.statistik.length > 0;
    const hasPolicy = state.policy.length > 0;
    if (!hasStat && !hasPolicy) {
        alert('Det finns inget att jämföra med. Läs in ställningstagandet eller jämförelsestatistiken.');
        return;
    }

    const profileLabel = state.profile.benchmarkLabel;

    const rOrNull = v => (v && isFinite(v)) ? Math.round(v) : null;
    const pctOrNull = (org, ref) => (org && ref) ? Number(((org / ref - 1) * 100).toFixed(2)) : null;
    const diffOrNull = (org, ref) => (org && ref) ? Math.round(org - ref) : null;
    const breddOrNull = (p10, p90) => (p10 && p90 && p10 > 0) ? Number((p90 / p10).toFixed(3)) : null;

    // Två rubrikrader: den första grupperar kolumnerna, den andra namnger dem.
    const headerRow1 = [
        '', '', '', '',
        orgNamn(), '', '', '',
        `Jämförelse: ${profileLabel}`, '', '', '', '', '', '', '',
        referensNamn(), '', '', '', '', '', '', ''
    ];
    const headerRow2 = [
        stor(T.enhet.en), 'BAS', 'Matchning', 'N (organisationen)',
        'P10', 'Median', 'P90', 'Bredd P90/P10',
        'P10', 'Skillnad P10 (kr)', 'Skillnad P10 (%)',
        'Median', 'Skillnad median (kr)', 'Skillnad median (%)',
        'P90', 'Skillnad P90 (kr)', 'Skillnad P90 (%)',
        'P10', 'Skillnad P10 (kr)', 'Skillnad P10 (%)',
        'Median', 'Skillnad median (kr)', 'Skillnad median (%)',
        'P90', 'Skillnad P90 (kr)', 'Skillnad P90 (%)'
    ];

    // Raderna kommer ur src/lib/jamforelse.js — samma som tabellen och diagrammen.
    const { rader, utelamnade: maskedGroups } = jamforelseRader(d, { statistik: state.statistik, policyFor, k: kTroskel() });
    const dataRows = rader.map(r => {
        const s = r.statistik, p = r.stallningstagande, o = r.org;
        return [
            r.yrke, r.bas, matchningEtikett(r.statistikMatchning), r.n,
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

    const aoa = [headerRow1, headerRow2, ...dataRows];
    const sheet = XLSX.utils.aoa_to_sheet(aoa);

    // Gruppernas rubriker på rad 1 spänner över sina kolumner.
    if (!sheet['!merges']) sheet['!merges'] = [];
    sheet['!merges'].push({ s: { r: 0, c: 4 },  e: { r: 0, c: 7 } });   // Organisationen (4 kolumner)
    sheet['!merges'].push({ s: { r: 0, c: 8 },  e: { r: 0, c: 16 } });  // Jämförelse (9 kolumner)
    sheet['!merges'].push({ s: { r: 0, c: 17 }, e: { r: 0, c: 25 } });  // Ställningstagande (9 kolumner)

    sheet['!cols'] = [
        { wch: 42 }, { wch: 6 }, { wch: 12 }, { wch: 6 },
        { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 10 },
        { wch: 10 }, { wch: 12 }, { wch: 12 },
        { wch: 10 }, { wch: 12 }, { wch: 12 },
        { wch: 10 }, { wch: 12 }, { wch: 12 },
        { wch: 10 }, { wch: 12 }, { wch: 12 },
        { wch: 10 }, { wch: 12 }, { wch: 12 },
        { wch: 10 }, { wch: 12 }, { wch: 12 }
    ];

    // Rubrikraderna och första kolumnen står kvar när man rullar.
    sheet['!freeze'] = { xSplit: 1, ySplit: 2 };

    // Bladet Metadata
    const meta = [
        ['Öppen lönekartläggning — jämförelsen med alla percentiler', ''],
        ['', ''],
        ['Genererad', new Date().toLocaleString('sv-SE')],
        ['Verktygets version', APP_VERSION],
        ['', ''],
        ['Aktiv profil', state.profile.name],
        ['Jämförelseinstitution', profileLabel],
        ['', ''],
        ['Antal grupper i export', nGroups],
        ['Antal personer (totalt)', nPersoner],
        [`Antal grupper utelämnade, minsta gruppstorlek (n<${kTroskel()})`, maskedGroups.length],
        ...(maskedGroups.length ? [['  - vilka', maskedGroups.join(', ')]] : []),
        ['', ''],
        ['Jämförelsestatistik inläst', hasStat ? 'Ja' : 'Nej'],
        ['  - innehåller P10', state.statistikHasP10 ? 'Ja' : 'Nej (saknas i den inlästa filen)'],
        ['  - innehåller P90', state.statistikHasP90 ? 'Ja' : 'Nej (saknas i den inlästa filen)'],
        ['Matchning', `AID + BAS: samma AID och samma BAS. Endast AID: en rad med samma AID som saknar BAS. Rader för andra ${T.niva.fl} används aldrig. – = statistik saknas.`],
        ['Referens', referensNamn() + referensKalla()],
        ['', ''],
        ['Skillnadskolumnerna: ett positivt värde betyder att organisationen ligger över referensen, ett negativt att den ligger under.', ''],
        ['En tom cell: referensvärdet saknas i den inlästa filen eller gäller inte gruppen.', ''],
        [`Minsta gruppstorlek: grupper med färre än ${kTroskel()} ${personOrd(kTroskel())} står inte med.`, '']
    ];
    const metaSheet = XLSX.utils.aoa_to_sheet(meta);
    metaSheet['!cols'] = [{ wch: 48 }, { wch: 32 }];

    // Svenska talformat efter kolumnrubrikerna, som står på rad 2.
    _tillampaTalformat(sheet, SV_TALFORMAT, 1);
    // P10 och P90 är kronor som medianen, men rubrikerna har inget nyckelord i SV_TALFORMAT (och "Bredd P90/P10"
    // är en kvot): de får medianens format här.
    headerRow2.forEach((rubrik, c) => {
        if (rubrik !== 'P10' && rubrik !== 'P90') return;
        for (let r = 2; r < aoa.length; r++) {
            const cell = sheet[XLSX.utils.encode_cell({ c, r })];
            if (cell && cell.t === 'n') cell.z = SV_TALFORMAT.median;
        }
    });

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, sheet, 'Jämförelse_alla_percentiler');
    XLSX.utils.book_append_sheet(wb, metaSheet, 'Metadata');

    const filename = `lonekartlaggning_jamforelse_${idagDatum()}.xlsx`;
    _laggTillMetodblad(wb);
    XLSX.writeFile(wb, filename);
    _visaExportvarning();
    meddelaSkarmlasare(`Excel-fil exporterad: ${nGroups} grupp${nGroups === 1 ? '' : 'er'}, ${nPersoner} person${nPersoner === 1 ? '' : 'er'}.`);
}

/** Det som körs vid laddning, i filens ordning; src/app/index.js anropar delarnas uppstart i sifferordning. */
export function uppstartJamforelseExport() {
    document.getElementById('btn-export-benchmark')?.addEventListener('click', exportJamforelseExcel);
}

// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson

// #5 Export-hubb: direktexporter för de state-drivna underlagen (kräver inte att
// respektive flik besökts). Övriga hubb-rader navigerar via data-flow-tab.
document.getElementById('btn-hub-jpa')?.addEventListener('click', () => exportJPAProtocol());
document.getElementById('btn-hub-handlingsplan')?.addEventListener('click', () => exportHandlingsplan());

// ============================================================
// #8 Reproducerbarhets-appendix — identiska metod- och parameteruppgifter i
// ALLA exporter, så varje flaggat resultat går att återskapa och försvara i
// samverkan/tvist. Två format: aoa-rader (Excel) och HTML (print/rapport).
// ============================================================
function _methodAppendixData() {
    const total = (state.data && state.data.length) || 0;
    const used  = (typeof getData === 'function' ? getData().length : total);
    const ver   = (typeof APP_VERSION !== 'undefined' ? APP_VERSION : '–');
    return [
        ['Verktyg', `Öppen lönekartläggning (v${ver})`],
        ['Exporttidpunkt', new Date().toLocaleString('sv-SE')],
        ['Artefakt-SHA-256', 'Se RELEASE.txt / filens banner (single-file-bygget är källans sanning)'],
        ['Datakälla', state.isDemo
            ? '⚠ DEMODATA — syntetisk exempeldata, INTE en verklig analys'
            : 'Lokalt uppladdad fil (bearbetad helt i webbläsaren, inga nätverksanrop)'],
        ['Antal personer (inläst)', String(total)],
        ['Antal personer (i denna analys)', String(used)],
        ['Modell — oförklarat gap', 'OLS på log(månadslön) ~ kön + ålder + BAS-intervall (indikatorvariabler, första BAS som referens); HC3-robusta standardfel (Long & Ervin 2000)'],
        ['Steg + Yrkesgrupp (dekomponeringen)', 'Könsgap med fasta effekter för yrkesgrupp inom BAS (AID×BAS) utöver ålder, skattat med inomtransformation; visas som sista steg, ingår inte i huvudtalet'],
        ['Ålder & karriär (tvärsnitt)', 'Lön mot ålder och livscykelmodellen bygger på ett tvärsnitt: de visar skillnader mellan åldersgrupper i dag, inte hur en persons lön utvecklas över karriären (kohorteffekter)'],
        ['Trattdiagrammet', 'Med färre än tio yrkesgrupper säger trattens form lite; varje grupp bedöms då för sig i tabellen. Punktens bedömning bygger på en omkastning av könen inom gruppen'],
        ['p-värden', 't-fördelning vid df < 100, annars normalfördelning; Benjamini-Hochberg (FDR) vid multipla grupptest'],
        ['Konfidensintervall', 'Bootstrap-percentil (B ≥ 1000 sampel) på mediankvot kvinna/man'],
        ['Signifikansnivå', 'α = 0,05'],
        ['Minsta gruppstorlek för redovisning', `${kTroskel()} personer. Grupper med färre redovisas inte i beskrivande vyer (gäller inte likvärdighetsanalysen).`
            + (kTroskel() < K_STANDARD ? ` Tröskeln är sänkt från standardvärdet ${K_STANDARD}.` : '')],
        ['Referens för lönenivåer', referensNamn() + referensKalla()],
        ['Jämförelsestatistik', statistikBeskrivning()],
        ['Krav-proxy (likvärdigt arbete)', state.arbetsvardering ? 'Arbetsvärderingspoäng (ur strukturdatans Poäng-kolumn)' : 'BAS-intervall (ordinal rangordning)'],
        ['Lönegapets tecken', 'Verktyget räknar skillnaden som (kvinnor − män) / män och visar den som kvinnors lön i procent av mäns (under 100 = kvinnor lägre). EU-lönerapporten och rapportens avsnitt om lönetransparens redovisar i stället direktivets lönegap, (män − kvinnor) / män i procent, enligt art. 9: positivt tal = kvinnor lägre. Beloppet är detsamma.'],
        ['Tolkningsregel', 'Ett oförklarat gap är en statistisk signal om var man bör titta närmare — inte ett bevis för osaklig (diskriminerande) löneskillnad. Den bedömningen görs kvalitativt av arbetsgivaren.'],
        ['Rättslig ram', 'Diskrimineringslagen 3 kap. (lönekartläggning); direktiv (EU) 2023/970 om lönetransparens. De enskilda lagrummen står i docs/utveckling/lagrum.md.']
    ];
}
// Lägger till ett "Metod & parametrar"-blad sist i en XLSX-arbetsbok.
// `undantag`: exporten hör till ett dokumenterat undantag från minsta gruppstorlek och säger det.
// `extra`: rader [rubrik, text] som bara gäller den här arbetsboken (ett blads mått och regler); läggs sist.
/**
 * @param {any} wb
 * @param {{undantag?: string, extra?: any[][]}} [val]
 */
function _appendMethodSheet(wb, { undantag = '', extra = [] } = {}) {
    if (typeof XLSX === 'undefined' || !XLSX.utils || !wb) return;
    const rows = [['Metod & parametrar — reproducerbarhet och tolkning'], [''], ...(_methodAppendixData()), ...extra];
    if (undantag) {
        const i = rows.findIndex(r => r[0] === 'Minsta gruppstorlek för redovisning');
        rows.splice(i + 1, 0, ['Undantag från minsta gruppstorlek', _kUndantagNot(undantag)]);
    }
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = [{ wch: 32 }, { wch: 88 }];
    try { XLSX.utils.book_append_sheet(wb, ws, 'Metod & parametrar'); } catch (_e) { /* dubblettnamn: hoppa */ }
}
// ---- Excel-export-hjälpare: rensar HTML-tabell för läsbara Excel-celler ----
/**
 * Klonar en HTML-tabell och rensar bort UI-element som inte hör hemma i Excel:
 *   - informationsikonerna (.info-tip)
 *   - status-badges (⚠ ⚠ 🔒 ✓ ✕ etc.)
 *   - knappar (cross-links, förslag-knappar)
 *   - checkboxar konverteras till "Ja"/"Nej"
 *
 * Headers kan överrides via `data-export-label` på <th>:
 *   <th data-export-label="Median organisationen (kr/mån)">Median</th>
 *
 * Kolumner kan exkluderas helt via `data-export-skip` på <th>.
 *
 * @param {string} tableId
 * @returns {HTMLTableElement | null} Klonad tabell redo för XLSX-konvertering
 */
/**
 * En hopfälld grupp, en rad som en sökning gömt eller en hopfälld underrad är fortfarande en del av tabellen: i en
 * export (arbetsboken, PDF-rapportens bilaga) är alla rader synliga. Görs på en kopia, aldrig på skärmens tabell.
 */
function _exportVisaAllaRader(klon) {
    klon.querySelectorAll('tbody tr').forEach(tr => {
        tr.style.removeProperty('display');
        if (!tr.getAttribute('style')) tr.removeAttribute('style');   // ett tomt style="" i markeringen räknas som överträdelse av CSP:n (style-src-attr 'none') när raden sätts in i PDF-rapporten
        tr.hidden = false;
        tr.classList.remove('collapsed');
    });
    return klon;
}
function _cloneAndCleanTableForExport(tableId) {
    const t = exportElement(tableId);   // exportgrinden: tabellens flik är ritad med det som gäller nu
    if (!t || !t.querySelector('tbody tr')) return null;
    const clone = t.cloneNode(true);
    _exportText(clone);
    _exportVisaAllaRader(clone);

    // Identifiera kolumnindex att skippa
    const skipCols = [];
    const ths = /** @type {HTMLElement} */ (clone).querySelectorAll('thead th');
    ths.forEach((th, i) => {
        if (th.hasAttribute('data-export-skip')) skipCols.push(i);
    });

    // Rensa header-celler
    ths.forEach(th => {
        const exportLabel = th.getAttribute('data-export-label');
        if (exportLabel) {
            th.textContent = exportLabel;
            return;
        }
        // Ta bort info-tip spans, badges, sr-only-text
        th.querySelectorAll('.info-tip, .sr-only, sup').forEach(el => el.remove());
        // Normalisera whitespace
        th.textContent = th.textContent.replace(/\s+/g, ' ').trim();
    });

    // Rensa data-celler från knappar, badges etc.
    /** @type {HTMLElement} */ (clone).querySelectorAll('tbody tr').forEach(tr => {
        // Konvertera checkboxar till "Ja"/"Nej"
        tr.querySelectorAll('input[type="checkbox"]').forEach(cb => {
            const td = cb.closest('td');
            if (td) td.textContent = /** @type {HTMLInputElement} */ (cb).checked ? 'Ja' : 'Nej';
        });
        // Ta bort knappar (cross-link, suggest; brist-toggle är redan gjord till text ovan)
        tr.querySelectorAll('.row-cross-link, .btn-suggest, button, input[type="text"]').forEach(el => el.remove());
        // Strippa kvarvarande icon-suffix från cell-text (⚠ ⚠ 🔒 ✓ ✕ 🔴 ⛔ etc.)
        tr.querySelectorAll('td, th').forEach(td => {
            // Behåll text-noden men ta bort ikon-spans (cursor:help-badges etc.)
            td.querySelectorAll('span[title].hjalp-markor').forEach(s => s.remove());
            // Normalisera whitespace inom cellen
            // Staplarnas mått ligger som style-attribut (satta via CSSOM); sätts markeringen om genom innerHTML blockerar CSP:n dem
            // (style-src-attr 'none'), och exporten behöver dem inte.
            td.querySelectorAll('[style]').forEach(el => el.removeAttribute('style'));
            td.innerHTML = td.innerHTML.replace(/&nbsp;/g, ' ');
        });
        // Varje cell får sin typ bestämd här, inte av kalkylbladsläsarens gissning (ADR-30/43: tabellen är det
        // som visas, arbetsboken ska bära samma sak). Se _exportCellVarde: ett tal i cellens text blir ett tal med
        // sin enhet som talformat, allt annat blir text — också "17/17", som läsaren annars tolkar som ett datum.
        tr.querySelectorAll('td, th').forEach(td => _exportMarkCell(td));
    });

    // Skippa kolumner via DOM-manipulation. Kolumnindex räknas i tabellens logiska kolumner: en cell med colspan
    // täcker flera, så en rad med en sammanslagen cell har färre barn än rubrikraden (notrader, "Gruppens median").
    if (skipCols.length) {
        ['thead tr', 'tbody tr', 'tfoot tr'].forEach(sel => {
            /** @type {HTMLElement} */ (clone).querySelectorAll(sel).forEach(tr => {
                let kol = 0;
                [...tr.children].forEach(cell => {
                    const span = Math.max(1, parseInt(cell.getAttribute('colspan') || '', 10) || 1);
                    const start = kol, slut = kol + span - 1;
                    kol += span;
                    const traffar = skipCols.filter(i => i >= start && i <= slut).length;
                    if (!traffar) return;
                    if (traffar >= span) cell.remove();
                    else cell.setAttribute('colspan', String(span - traffar));
                });
            });
        });
    }

    return clone;
}

/**
 * Ett tal i svenskt visningsformat, med enhet: "32 067 kr" → { tal: 32067, enhet: 'kr', dec: 0 },
 * "−4,45 %" → { tal: -4.45, enhet: '%', dec: 2 }, "1,30" → { tal: 1.3, enhet: '', dec: 2 }. Null när texten
 * är något annat än ett ensamt tal ("17/17", "46 (28/18)", "Gruppens median 29 985 kr", "–").
 */
function _exportTalMedEnhet(text) {
    const t = String(text == null ? '' : text).replace(/[  ]/g, ' ').replace(/\s+/g, ' ').trim();
    const m = /^([+−-]?)(\d{1,3}(?: \d{3})+|\d+)(?:,(\d+))? ?(%|kr)?$/.exec(t);
    if (!m) return null;
    const tecken = m[1] === '−' ? '-' : m[1];
    const tal = parseFloat(tecken + m[2].replace(/ /g, '') + (m[3] != null ? '.' + m[3] : ''));
    if (!isFinite(tal)) return null;
    return { tal, enhet: m[4] || '', dec: m[3] != null ? m[3].length : 0 };
}

/**
 * Cellens värde i arbetsboken, ur det cellen VISAR.
 *
 *  - Texten är ett tal ("93,6 %", "33 932 kr", "46"): talet, i procent när enheten är procent (93.6, inte 0.936),
 *    med enheten som talformat. data-sort-value tas bara när det är samma storhet med fler decimaler (33 931,5
 *    bakom "33 932 kr") — inte när det är något annat än det som visas (gapet 6,4 bakom kvoten "93,6 %", andelen
 *    −0,0445 bakom "−4,45 %", prioriteringsindexet bakom statustexten).
 *  - Annars texten som text — "17/17" skulle läsaren annars göra till ett datum, "46 (28/18)" och "–" till ingenting.
 *
 * @returns {{t:'n', v:number, z?:string}|{t:'s', v:string}|null} null för en tom cell.
 */
/**
 * @param {HTMLTableCellElement} td
 * @returns {{t: 'n'|'s', v: any, z?: string}|null}
 */
function _exportCellVarde(td) {
    const text = td.textContent.replace(/[  ]/g, ' ').replace(/\s+/g, ' ').trim();
    if (text === '') return null;
    const p = _exportTalMedEnhet(text);
    if (!p) return { t: 's', v: text };
    let v = p.tal;
    const sv = td.getAttribute && td.getAttribute('data-sort-value');
    if (sv != null && sv.trim() !== '') {
        const n = parseFloat(sv);
        if (isFinite(n) && Math.abs(n - p.tal) <= 0.5 * Math.pow(10, -p.dec) + 1e-9) v = n;
    }
    const dec = p.dec ? '.' + '0'.repeat(p.dec) : '';
    const z = p.enhet === '%' ? `0${dec}\\ "%"` : p.enhet === 'kr' ? '#,##0\\ "kr"' : p.dec ? `0${dec}` : null;
    return z ? { t: 'n', v, z } : { t: 'n', v };
}

/** Skriver cellens värde i attributen data-t/data-v/data-z, som table_to_sheet läser utan att gissa, och i texten. */
function _exportMarkCell(td) {
    const c = _exportCellVarde(td);
    if (!c) return;
    td.setAttribute('data-t', c.t);
    td.setAttribute('data-v', String(c.v));
    if (c.z) td.setAttribute('data-z', c.z);
    td.textContent = String(c.v);
}

/** Standard-format-map för svenska användare. Triggas av nyckelord i kolumnrubriken. */
const SV_NUM_FORMATS = Object.freeze({
    // Ordningen avgör: första träffen gäller. Rubriker som "Kvinnors median i % av männens", "P10 skillnad mot …
    // (%)" och "Avvikelse per person (kr/mån)" innehåller flera nyckelord, så enheten i parentesen prövas först.
    '(%)':      '0.00\\ "%"',
    ' % av':    '0.0\\ "%"',
    'kr/mån':   '#,##0\\ "kr"',
    '(kr':      '#,##0\\ "kr"',
    ' kr)':     '#,##0\\ "kr"',
    '(kvot)':   '0.00',
    'avvikelse': '0.00\\ "%"',     // anv "Avvikelse %"
    'gap':      '0.00\\ "%"',
    'diff (%)': '0.00\\ "%"',
    'diff mot': '0.00\\ "%"',
    'andel':    '0.0\\ "%"',
    'lön':      '#,##0\\ "kr"',
    'median':   '#,##0\\ "kr"',
    'kostnad':  '#,##0\\ "kr"',
    'referens': '#,##0\\ "kr"',
    'antal':    '#,##0',
    'index':    '0',
    'ålder':    '0'
});

/**
 * Bygger AOA-block av en rensad tabellklon med grupprader (tr.group-header):
 *
 *   BAS A                    ← grupptitel (egen rad)
 *   Yrke | P10 | Median | …  ← kolumnrubriker (UPPREPAS per grupp)
 *   datarad…
 *   (tomrad)                 ← skiljer blocken åt
 *   BAS B
 *   Yrke | P10 | Median | …
 *   …
 *
 * Syfte: HR ska kunna markera ett blocks rubrikrad + datarader i Excel och
 * klistra in direkt i Word som en ren tabell per BAS — i stället för dagens
 * enda långa tabell där grupptiteln blir en encellsrad mitt i datat.
 * Tal hämtas från data-sort-value (riktiga numbers → svenska talformat).
 *
 * @param {HTMLTableElement} clone - Från _cloneAndCleanTableForExport.
 * @returns {{aoa:Array<Array>, merges:Array, firstHeaderRowIdx:number|null}}
 */
function _groupedCloneToAoa(clone) {
    const headers = [...clone.querySelectorAll('thead th')]
        .map(th => th.textContent.replace(/\s+/g, ' ').trim());
    const aoa = [];
    const merges = [];
    /** @type {number|null} */ let firstHeaderRowIdx = null;
    const cellValue = td => {
        // Cleanern (_exportMarkCell) har redan bestämt typ, värde och talformat; ett tal blir ett cellobjekt.
        const t = td.getAttribute && td.getAttribute('data-t');
        if (t === 'n') {
            const cell = { t: 'n', v: parseFloat(td.getAttribute('data-v')) };
            const z = td.getAttribute('data-z');
            if (z) cell.z = z;
            return cell;
        }
        return td.textContent.replace(/\s+/g, ' ').trim();
    };
    [...clone.querySelectorAll('tbody tr')].forEach(tr => {
        if (tr.classList.contains('group-header')) {
            if (aoa.length) aoa.push([]);   // tomrad mellan block
            const title = tr.textContent.replace(/\s+/g, ' ').trim();
            merges.push({ s: { r: aoa.length, c: 0 }, e: { r: aoa.length, c: Math.max(0, headers.length - 1) } });
            aoa.push([title]);
            if (firstHeaderRowIdx === null) firstHeaderRowIdx = aoa.length;
            aoa.push(headers.slice());
        } else {
            aoa.push([...tr.children].map(cellValue));
        }
    });
    return { aoa, merges, firstHeaderRowIdx };
}

/**
 * Sätter kolumnbredder (!cols) utifrån längsta innehåll per kolumn, 8–45 tecken
 * — så exporten är läsbar direkt utan manuell breddjustering i Excel.
 * @param {Object} sheet - XLSX worksheet.
 */
function _autoColWidths(sheet) {
    if (!sheet || !sheet['!ref']) return;
    const range = XLSX.utils.decode_range(sheet['!ref']);
    const widths = [];
    for (let c = range.s.c; c <= range.e.c; c++) {
        let max = 8;
        for (let r = range.s.r; r <= range.e.r; r++) {
            const cell = sheet[XLSX.utils.encode_cell({ c, r })];
            if (!cell || cell.v == null) continue;
            const len = String(cell.v).length + (cell.t === 'n' ? 4 : 0); // marginal för "kr"/"%"-format
            if (len > max) max = len;
        }
        widths.push({ wch: Math.min(45, max + 1) });
    }
    sheet['!cols'] = widths;
}

/** Klonar+rensar och returnerar XLSX-worksheet. Tillämpar svenska number-format.
 *  BAS-grupperade tabeller (tr.group-header) exporteras som Word-vänliga block
 *  med upprepade kolumnrubriker per grupp (se _groupedCloneToAoa). */
function tableToCleanSheet(tableId) {
    const clone = _cloneAndCleanTableForExport(tableId);
    if (!clone) return null;
    if (/** @type {HTMLElement} */ (clone).querySelector('tbody tr.group-header')) {
        const g = _groupedCloneToAoa(/** @type {HTMLTableElement} */ (clone));
        const sheet = XLSX.utils.aoa_to_sheet(g.aoa);
        if (g.merges.length) sheet['!merges'] = g.merges;
        _applyColumnNumFormats(sheet, SV_NUM_FORMATS, g.firstHeaderRowIdx ?? 0);
        _autoColWidths(sheet);
        // Ingen frusen rad — rubrikerna upprepas per block i stället.
        return sheet;
    }
    const sheet = XLSX.utils.table_to_sheet(clone);
    _applyColumnNumFormats(sheet, SV_NUM_FORMATS);
    _autoColWidths(sheet);
    // Frys första raden (header) för läsbarhet
    sheet['!freeze'] = { ySplit: 1 };
    return sheet;
}

/**
 * Tillämpar Excel-cellsformat (z-property) på alla data-rader för kolumner
 * vars header matchar en av nyckel-substrings. Excel använder sedan
 * användarens locale för faktisk rendering — "#,##0" blir "1 234" i svenska
 * Excel, "1,234" i engelska.
 *
 * Exempel:
 *   _applyColumnNumFormats(sheet, {
 *       'kr':   '#,##0\\ "kr"',       // 32 067 kr
 *       '%':    '0.0\\ "%"',          // -12.3 %
 *       'n':    '#,##0',              // 1 234
 *       'år':   '0'                   // 45
 *   });
 *
 * @param {Object} sheet  - XLSX worksheet
 * @param {Object} formatMap - { kolumnsubstring: formatString }
 * @param {number} [headerRowIdx=0] - vilken rad är headern (0-indexerad)
 */
function _applyColumnNumFormats(sheet, formatMap, headerRowIdx = 0) {
    if (!sheet || !sheet['!ref']) return;
    const range = XLSX.utils.decode_range(sheet['!ref']);
    for (let c = range.s.c; c <= range.e.c; c++) {
        const headerAddr = XLSX.utils.encode_cell({ c, r: range.s.r + headerRowIdx });
        const headerCell = sheet[headerAddr];
        if (!headerCell || typeof headerCell.v !== 'string') continue;
        const headerLow = headerCell.v.toLowerCase();
        for (const [pattern, fmt] of Object.entries(formatMap)) {
            if (headerLow.includes(pattern.toLowerCase())) {
                for (let r = range.s.r + headerRowIdx + 1; r <= range.e.r; r++) {
                    const addr = XLSX.utils.encode_cell({ c, r });
                    const cell = sheet[addr];
                    if (cell && cell.t === 'n' && !cell.z) cell.z = fmt;
                }
                break;  // använd första matchande pattern, hoppa till nästa kolumn
            }
        }
    }
}

/** Klonar+rensar och returnerar XLSX-workbook (för en-flik-export).
 *  Delegerar till tableToCleanSheet så BAS-grupperade tabeller får samma
 *  Word-vänliga blockformat i alla exportvägar. */
function tableToCleanBook(tableId, sheetName) {
    const sheet = tableToCleanSheet(tableId);
    if (!sheet) return null;
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, sheet, sheetName);
    return wb;
}

// ---- Excel export-varning (GDPR-affordans) ----
/**
 * Visar en kort, icke-blockerande "post-export"-notis så HR påminns om att
 * aggregerade lönefiler är känsliga och inte ska mailas okrypterat.
 * Vi blockerar inte exporten — vi gör organisatorisk-känsligheten synlig.
 */

// ---- CSV-export --------------------------------------------------------------
// Robust CSV-helper som INTE är beroende av XLSX-biblioteket. Producerar
// semikolon-separerade filer med UTF-8 BOM (svenska Excel-default), CRLF-
// radslut och korrekta citerade fält. Garanterat fungerande i alla webbläsare:
// blob-URL + anchor-klick + revokeObjectURL.
// En textcell som börjar med = + - @ (eller tabb/CR) blir en formel när filen
// öppnas eller klistras in i Excel. Yrkesnamn och andra texter kommer ur lönefilen,
// så en fientlig fil kunde annars lägga en formel i HR:s export (CSV-injektion,
// OWASP). Sådana celler får ett inledande apostrof-tecken, som Excel visar som
// text. Tal — även formaterade som "-3,2 %" eller "-1 250 kr" — lämnas orörda.
const _CSV_FORMELSTART = /^[=+\-@\t\r]/;
const _CSV_TALLIKT = /^[+-]?\d[\d\s.,]*(\s?(%|kr|st|år))?$/;
function _neutraliseraCell(v) {
    if (typeof v !== 'string' || !_CSV_FORMELSTART.test(v) || _CSV_TALLIKT.test(v)) return v;
    return "'" + v;
}

function _toCsv(rows, delimiter) {
    delimiter = delimiter || ';';
    const escapeCell = v => {
        if (v == null) return '';
        let s = String(_neutraliseraCell(v));
        if (s.includes(delimiter) || s.includes('"') || s.includes('\n') || s.includes('\r')) {
            s = '"' + s.replace(/"/g, '""') + '"';
        }
        return s;
    };
    return rows.map(r => (Array.isArray(r) ? r : [r]).map(escapeCell).join(delimiter)).join('\r\n');
}
// Demoläget märks i filnamnet, som diagram- och Word-exporterna (bara en gång).
function _csvFilnamn(namn) {
    const n = namn || 'export';
    return state.isDemo && !n.startsWith('DEMO_') ? 'DEMO_' + n : n;
}
// `undantag`: se _kUndantagNot (06) — exporten kan innehålla grupper under tröskeln och säger det.
function _downloadCSV(rows, filename, { undantag = '' } = {}) {
    if (!Array.isArray(rows) || !rows.length) {
        alert('Ingen data att exportera.');
        return;
    }
    try {
        const BOM = '﻿';  // UTF-8 BOM så Excel öppnar med korrekt teckenkodning
        const csv = BOM + _toCsv(_csvMedStampel(rows, undantag));
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = _csvFilnamn(filename) + '.csv';
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 1500);
        if (typeof _showExportSensitivityToast === 'function') _showExportSensitivityToast();
        if (typeof announceToScreenReader === 'function') announceToScreenReader('CSV exporterad: ' + (rows.length - 1) + ' rader.');
    } catch (err) {
        alert('CSV-export misslyckades: ' + (err.message || String(err)));
    }
}

function _showExportSensitivityToast(bodyHtml) {
    const existing = document.getElementById('export-sensitivity-toast');
    if (existing) existing.remove();
    const toast = document.createElement('div');
    toast.id = 'export-sensitivity-toast';
    toast.setAttribute('role', 'status');
    toast.style.cssText = `position:fixed; bottom:24px; right:24px; max-width:380px; padding:14px 18px; background:${FARG.text}; color:${FARG.yta}; border-left:4px solid ${FARG.varning}; border-radius:8px; box-shadow:0 6px 20px rgba(0,0,0,0.28); z-index:99998; font-size:0.88rem; line-height:1.55;`;
    // Neutral text: notisen visas efter alla exporter, också de som innehåller en rad per person
    // eller grupper under tröskeln, och ska därför inte utlova aggregering.
    const body = bodyHtml || `<strong>Fil sparad</strong><br>
        Filen innehåller lönedata. Hantera den som personuppgifter: förvara den på behörighetsstyrd disk och skicka den inte via okrypterad e-post.`;
    toast.innerHTML = body
        + `<button data-dismiss-parent class="bak-transparent ram-1-blek rund-4 farg-yta pekare fs-xs marg-v-8 marg-t-6 pad-2-10">OK</button>`;
    // Markeringsraden ligger också nere till höger: notisen ställs ovanför den, så att ingen täcker den andra.
    if (document.getElementById('markering-rad')) toast.style.bottom = '76px';
    document.body.appendChild(toast);
    setTimeout(() => { if (toast.parentNode) toast.remove(); }, 12000);
}

// ---- Multi-flik Excel-export ----

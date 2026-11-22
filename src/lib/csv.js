// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
/**
 * Öppen lönekartläggning — CSV- och urklippstext med formelskydd (ADR-15).
 *
 * En textcell som börjar med = + - @ (eller tabb/CR) blir en formel när filen öppnas eller klistras in i Excel.
 * Yrkesnamn och andra texter kommer ur lönefilen, så en fientlig fil kunde annars lägga en formel i HR:s export
 * (CSV-injektion, OWASP). Sådana celler får ett inledande apostrof-tecken, som Excel visar som text. Tal — även
 * formaterade som "-3,2 %" eller "-1 250 kr" — lämnas orörda. Modulen importerar ingenting.
 *
 * Webbläsarbygget får en AUTO-GENERERAD spegel i src/app/09-lib-speglar.js.
 */

const FORMELSTART = /^[=+\-@\t\r]/;
const TALLIKT = /^[+-]?\d[\d\s.,]*(\s?(%|kr|st|år))?$/;

/**
 * En cell med formelskydd. Tabellernas minustecken (U+2212, svTal/svPct) läser Excel som text; ett tal skrivs därför
 * med '-'. Text som innehåller '−' men inte är ett tal (t.ex. ett intervall) står kvar som den är.
 */
export function neutraliseraCell(v) {
    if (typeof v === 'string' && v[0] === '−' && TALLIKT.test('-' + v.slice(1))) return '-' + v.slice(1);
    if (typeof v !== 'string' || !FORMELSTART.test(v) || TALLIKT.test(v)) return v;
    return "'" + v;
}

/** Rad-matris → CSV-text: semikolon som standard, CRLF-radslut och citerade fält där det behövs. */
export function tillCsv(rows, delimiter) {
    delimiter = delimiter || ';';
    const escapeCell = v => {
        if (v == null) return '';
        let s = String(neutraliseraCell(v));
        if (s.includes(delimiter) || s.includes('"') || s.includes('\n') || s.includes('\r')) {
            s = '"' + s.replace(/"/g, '""') + '"';
        }
        return s;
    };
    return rows.map(r => (Array.isArray(r) ? r : [r]).map(escapeCell).join(delimiter)).join('\r\n');
}

/** Rad-matris → TSV för urklipp, med samma formelskydd som CSV-exporten. */
export function tillTsv(rows) {
    return rows.map(r => r.map(c => (c == null ? '' : neutraliseraCell(c))).join('\t')).join('\n');
}

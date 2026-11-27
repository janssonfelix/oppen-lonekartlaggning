// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
import { extremvarden } from '../lib/osakerhet.js';
import { svPct, svTal } from '../lib/talformat.js';
import { stor } from '../lib/termer.js';
import { esc } from './01-html-och-tillganglighet.js';
import { statGolv } from './06-k-troskel.js';
import { T } from './09-termer.js';
import { hamtaData, state } from './12-tillstand.js';

// ---- Outliers-detektor (rad-nivå) ----
/**
 * Löner som ligger ovanligt långt från sitt BAS-intervalls medel på log-skala (extremvarden i src/lib/osakerhet.js):
 * |z| ≥ threshold flaggas för manuell granskning (kan vara felinmatning). BAS-intervall under statGolv() bedöms inte.
 * @param {number} [threshold=3] - Z-tröskel.
 * @returns {Array<Object>} Outlier-rader sorterade på |Z| desc.
 */
export function hittaExtremvarden(threshold) {
    return extremvarden(hamtaData(), statGolv(), threshold);
}

export function ritaExtremvarden() {
    const container = document.getElementById('outliers-container');
    const wrap = document.getElementById('outliers-table-wrap');
    const countEl = document.getElementById('outliers-count');
    if (!container || !wrap) return;
    if (!state.data.length) { container.style.display = 'none'; return; }
    container.style.display = 'block';
    const threshold = parseFloat(/** @type {HTMLInputElement} */ (document.getElementById('outliers-threshold'))?.value) || 3;
    const outs = hittaExtremvarden(threshold);
    if (countEl) countEl.textContent = outs.length === 0 ? `(inga minst ${threshold} standardavvikelser från medel)` : `(${outs.length} ${outs.length === 1 ? 'rad flaggad' : 'rader flaggade'})`;
    if (!outs.length) {
        wrap.innerHTML = `<p class="farg-dampad pad-20 ta-mitt">Inga extremvärden med gränsen ${threshold} standardavvikelser. Datan är homogen inom BAS-grupperna.</p>`;
        return;
    }
    const fmt = new Intl.NumberFormat('sv-SE');
    wrap.innerHTML = `<div class="rulla-x"><table class="data-table st-088">
        <thead><tr>
            <th>Rad</th><th>BAS</th><th>${stor(T.enhet.en)}</th><th>Kön</th><th class="t-hoger">Ålder</th>
            <th class="t-hoger">Lön</th><th class="t-hoger">BAS-median</th>
            <th class="t-hoger">Diff %</th><th class="t-hoger">Avvikelse (sd)</th><th>Bedömning</th>
        </tr></thead>
        <tbody>
            ${outs.map(o => {
                const sgnD = o.diffPct >= 0 ? '+' : '';
                const sgnZ = o.z >= 0 ? '+' : '';
                const color = Math.abs(o.z) > 4 ? 'f-kritisk' : 'fg-varning';
                const bedömning = Math.abs(o.z) > 4
                    ? 'Mycket avvikande — kan vara registerfel'
                    : 'Bör granskas (specialkompetens? marknadsläge? fel?)';
                return `<tr>
                    <td>${o.radnr ?? '—'}</td>
                    <td>${esc(o.bas)}</td>
                    <td>${esc(o.yrke)}</td>
                    <td>${esc(o.kon)}</td>
                    <td class="t-hoger">${o.alder > 0 ? o.alder : '–'}</td>
                    <td class="tabelltal fw-600 ta-hoger">${fmt.format(o.lon)}</td>
                    <td class="farg-dampad tabelltal ta-hoger">${fmt.format(Math.round(o.groupMedian))}</td>
                    <td class="t-tal ${color}">${sgnD}${svPct(o.diffPct, 1)}</td>
                    <td class="t-tal fet ${color}">${sgnZ}${svTal(o.z, 2)}</td>
                    <td class="fs-xs">${bedömning}</td>
                </tr>`;
            }).join('')}
        </tbody>
    </table></div>
    <p class="text-dampad-xs lh-1_5 marg-t-10">
        <strong>Tolkning:</strong> en avvikelse på minst ${threshold} betyder att personens lön ligger minst ${threshold} standardavvikelser från BAS-gruppens log-medellön. Negativa värden = lön betydligt under gruppen, positiva = betydligt över. Granska för att avgöra om det är registerfel, sakligt motiverat eller faktisk avvikelse.
    </p>`;
}

/** Det som körs vid laddning, i filens ordning; src/app/index.js anropar delarnas uppstart i sifferordning. */
export function uppstartExtremvardenBasrang() {
    document.getElementById('outliers-threshold')?.addEventListener('input', ritaExtremvarden);
}

// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson

// ---- Outliers-detektor (rad-nivå) ----
/**
 * Identifierar individuella löner som ligger ovanligt långt från sin BAS-grupps median.
 * Använder log-skala (robust mot positivt skev fördelning) och Z-poäng = (log(lön) − μ)/σ.
 * Z ≥ threshold flaggas som outlier för manuell granskning (kan vara felinmatning).
 * @param {number} [threshold=3] - Z-tröskel.
 * @returns {Array<Object>} Outlier-rader sorterade på |Z| desc.
 */
function detectOutliers(threshold = 3) {
    const d = getData();
    if (!d.length) return [];
    // Gruppera per BAS, beräkna log-mean + log-SD
    const byBas = {};
    d.forEach((r, idx) => {
        if (!byBas[r.bas]) byBas[r.bas] = [];
        byBas[r.bas].push({ ...r, _idx: idx + 1 });
    });
    const results = [];
    Object.entries(byBas).forEach(([_bas, rows]) => {
        if (rows.length < statGolv()) return; // för få för en spridningsskattning
        const logs = rows.map(r => Math.log(r.lon));
        const mean = logs.reduce((s, v) => s + v, 0) / logs.length;
        const variance = logs.reduce((s, v) => s + (v - mean) ** 2, 0) / Math.max(1, logs.length - 1);
        const sd = Math.sqrt(variance);
        if (sd === 0) return;
        const groupMedian = Stat.median(rows.map(r => r.lon));
        rows.forEach(r => {
            const z = (Math.log(r.lon) - mean) / sd;
            if (Math.abs(z) >= threshold) {
                results.push({
                    radnr: r.radnr ?? null,
                    bas: r.bas,
                    yrke: r.yrke,
                    kon: r.kon.includes('kvinna') ? 'Kvinna' : 'Man',
                    alder: r.alder,
                    lon: r.lon,
                    groupMedian,
                    z,
                    diffPct: ((r.lon - groupMedian) / groupMedian) * 100
                });
            }
        });
    });
    results.sort((a, b) => Math.abs(b.z) - Math.abs(a.z));
    return results;
}

function renderOutliers() {
    const container = document.getElementById('outliers-container');
    const wrap = document.getElementById('outliers-table-wrap');
    const countEl = document.getElementById('outliers-count');
    if (!container || !wrap) return;
    if (!state.data.length) { container.style.display = 'none'; return; }
    container.style.display = 'block';
    const threshold = parseFloat(/** @type {HTMLInputElement} */ (document.getElementById('outliers-threshold'))?.value) || 3;
    const outs = detectOutliers(threshold);
    if (countEl) countEl.textContent = outs.length === 0 ? `(inga minst ${threshold} standardavvikelser från medel)` : `(${outs.length} rader flaggade)`;
    if (!outs.length) {
        wrap.innerHTML = `<p class="farg-dampad pad-20 ta-mitt">Inga extremvärden med gränsen ${threshold} standardavvikelser. Datan är homogen inom BAS-grupperna.</p>`;
        return;
    }
    const fmt = new Intl.NumberFormat('sv-SE');
    wrap.innerHTML = `<div class="rulla-x"><table class="data-table st-088">
        <thead><tr>
            <th>Rad</th><th>BAS</th><th>Yrkesgrupp</th><th>Kön</th><th class="t-hoger">Ålder</th>
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
                    <td class="t-hoger">${o.alder}</td>
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

document.getElementById('outliers-threshold')?.addEventListener('input', renderOutliers);

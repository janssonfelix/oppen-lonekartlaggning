// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson

// ---- Audit / spårbarhet av beräkningar ("Beräkning & urval") ----
// Varje analysfunktion fyller i sitt audit-objekt så användaren kan kvalitetssäkra.
const auditRegistry = {};

function buildBaseAudit() {
    const da = state.dataAudit || { totalRaw: 0, excludedNoBas: 0, excludedZeroLon: 0 };
    const totalRaw   = da.totalRaw;
    const afterParse = state.data.length;
    const afterFilter = getData().length;
    const parseExcl = [];
    if (da.excludedNoBas > 0)   parseExcl.push(['Saknar BAS-intervall', da.excludedNoBas]);
    if (da.excludedZeroLon > 0) parseExcl.push(['Lön ≤ 0 eller saknas', da.excludedZeroLon]);
    return { totalRaw, afterParse, afterFilter, parseExcl };
}

function setAudit(id, audit) {
    auditRegistry[id] = audit;
    const panel = document.querySelector(`details.audit-panel[data-audit-id="${id}"] .audit-content`);
    if (panel) panel.innerHTML = renderAuditHtml(audit);
}

function renderAuditHtml(a) {
    const fmt = n => n.toLocaleString('sv-SE');
    const exclRows = [
        ...(a.parseExcl || []).map(([r,c]) => `<tr><td>− ${esc(r)}</td><td class="t-tal">${fmt(c)}</td></tr>`),
        ...(a.analysisExclusions || []).map(([r,c]) => `<tr><td>− ${esc(r)}</td><td class="t-tal">${fmt(c)}</td></tr>`)
    ].join('');
    const used = a.usedInAnalysis !== undefined ? a.usedInAnalysis : a.afterFilter;
    const formlerHtml = (a.formler || []).map(([n, d]) => `<li><strong>${esc(n)}:</strong> ${d}</li>`).join('');
    const notesHtml   = (a.notes || []).map(n => `<li>${n}</li>`).join('');

    return `
        <div class="audit-section">
            <div class="audit-section-header">Urval (datafunnel)</div>
            <table class="audit-table">
                <tr><td>Total i datafilen:</td><td class="tabelltal fw-600 ta-hoger">${fmt(a.totalRaw)}</td></tr>
                ${exclRows}
                <tr class="audit-total"><td>= Använda i denna analys:</td><td class="farg-primary tabelltal fw-700 ta-hoger">${fmt(used)}</td></tr>
            </table>
        </div>
        ${formlerHtml ? `<div class="audit-section"><div class="audit-section-header">Formler &amp; definitioner</div><ul>${formlerHtml}</ul></div>` : ''}
        ${notesHtml ? `<div class="audit-section"><div class="audit-section-header">Speciella regler</div><ul>${notesHtml}</ul></div>` : ''}
        <div class="audit-section">
            <div class="audit-section-header">Datakälla</div>
            <ul>
                <li>Strukturfil: ${fmt(a.totalRaw)} rader inlästa, ${fmt(a.afterParse)} efter validering</li>
                <li>Referens: ${esc(referensNamn())}${esc(referensKalla())} — ${state.policy.length} rader</li>
                <li>Jämförelsestatistik: ${state.statistik.length ? state.statistik.length + ' poster inlästa' : '<em>Ej uppladdad</em>'}</li>
            </ul>
        </div>
    `;
}


// ---- Generisk tabell-sortering ----
function _parseSwedishNumber(str) {
    if (str == null) return NaN;
    // Svenskt format: decimalkomma, och minustecknet U+2212 som Intl skriver (annars sorteras negativa tal som positiva).
    const s = str.toString().trim().replace(/\u2212/g, '-').replace(/ /g, ' ').replace(',', '.');
    const cleaned = s.replace(/[^\d.\-]/g, '');
    if (cleaned === '' || cleaned === '-' || cleaned === '.') return NaN;
    return parseFloat(cleaned);
}
function _compareCells(a, b, idx, dir) {
    const ca = a.children[idx], cb = b.children[idx];
    if (!ca || !cb) return 0;
    const va = ca.getAttribute('data-sort-value') ?? ca.textContent;
    const vb = cb.getAttribute('data-sort-value') ?? cb.textContent;
    const na = _parseSwedishNumber(va), nb = _parseSwedishNumber(vb);
    const bothNum = !isNaN(na) && !isNaN(nb);
    let cmp;
    if (bothNum) cmp = na - nb;
    else cmp = va.toString().trim().localeCompare(vb.toString().trim(), 'sv');
    return dir === 'asc' ? cmp : -cmp;
}
function enableTableSort(tableId) {
    const table = document.getElementById(tableId);
    if (!table || table._sortInit) return;
    table._sortInit = true;
    const thead = table.querySelector('thead');
    if (!thead) return;
    thead.querySelectorAll('th').forEach((th, idx) => {
        if (th.hasAttribute('data-no-sort')) return;
        th.classList.add('sortable');
        th.addEventListener('click', () => {
            const tbody = table.querySelector('tbody');
            if (!tbody) return;
            const dir = th.getAttribute('data-sort-dir') === 'asc' ? 'desc' : 'asc';
            thead.querySelectorAll('th[data-sort-dir]').forEach(t => t.removeAttribute('data-sort-dir'));
            th.setAttribute('data-sort-dir', dir);
            const rows = Array.from(tbody.querySelectorAll('tr'));
            const hasGroups = rows.some(r => r.classList.contains('group-header'));
            if (hasGroups) {
                // Sortera inom varje grupp; behåll grupp-ordning men sortera barnen
                /** @type {any[]} */ const groups = [];
                /** @type {any} */ let cur = null;
                rows.forEach(r => {
                    if (r.classList.contains('group-header')) { cur = { header: r, children: [] }; groups.push(cur); }
                    else if (cur) cur.children.push(r);
                });
                groups.forEach(g => g.children.sort((a,b) => _compareCells(a, b, idx, dir)));
                tbody.innerHTML = '';
                const frag = document.createDocumentFragment();
                groups.forEach(g => { frag.appendChild(g.header); g.children.forEach(c => frag.appendChild(c)); });
                tbody.appendChild(frag);
            } else {
                // Underrader (.la-underrad) följer raden ovanför och sorteras inte själva.
                const enheter = [];
                rows.forEach(r => {
                    if (r.classList.contains('la-underrad') && enheter.length) enheter[enheter.length - 1].push(r);
                    else enheter.push([r]);
                });
                enheter.sort((a,b) => _compareCells(a[0], b[0], idx, dir));
                enheter.forEach(e => e.forEach(r => tbody.appendChild(r)));
            }
        });
    });
}

// ---- Collapsible BAS-grupper ----
function setupCollapsibleGroups(tableId) {
    const tbody = document.querySelector(`#${tableId} tbody`);
    if (!tbody || tbody._collapseInit) return;
    tbody._collapseInit = true;
    tbody.addEventListener('click', e => {
        const row = /** @type {HTMLElement} */ (e.target).closest('tr.group-header');
        if (!row) return;
        const collapsed = row.classList.toggle('collapsed');
        let nxt = row.nextElementSibling;
        while (nxt && !nxt.classList.contains('group-header')) {
            /** @type {HTMLElement} */ (nxt).style.display = collapsed ? 'none' : '';
            nxt = nxt.nextElementSibling;
        }
    });
}
function toggleAllGroups(tableId, collapse) {
    const tbody = document.querySelector(`#${tableId} tbody`);
    if (!tbody) return;
    tbody.querySelectorAll('tr.group-header').forEach(row => {
        const isCol = row.classList.contains('collapsed');
        if (collapse && !isCol) /** @type {HTMLElement} */ (row).click();
        else if (!collapse && isCol) /** @type {HTMLElement} */ (row).click();
    });
}

// ---- Cross-tab navigation ----
function navigateTo(tabName, opts = {}) {
    tabName = tabMal(tabName);
    const btn = document.querySelector(`.nav-item[data-tab="${tabName}"]`);
    if (!btn || /** @type {HTMLInputElement} */ (btn).disabled) return;
    /** @type {HTMLElement} */ (btn).click();
    if (opts.search && opts.searchInputId) {
        setTimeout(() => {
            const input = document.getElementById(opts.searchInputId);
            if (input) {
                /** @type {HTMLInputElement} */ (input).value = opts.search;
                input.dispatchEvent(new Event('input', { bubbles: true }));
            }
        }, 100);
    }
    if (opts.highlightMatch) {
        setTimeout(() => {
            const tbody = document.querySelector(`#${opts.highlightMatch.tableId} tbody`);
            if (!tbody) return;
            tbody.querySelectorAll('tr.row-highlighted').forEach(r => r.classList.remove('row-highlighted'));
            const rows = tbody.querySelectorAll('tr');
            for (const r of rows) {
                const text = r.textContent.toLowerCase();
                if (opts.highlightMatch.contains.every(s => text.includes(s.toLowerCase()))) {
                    r.classList.add('row-highlighted');
                    r.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    setTimeout(() => r.classList.remove('row-highlighted'), 4000);
                    break;
                }
            }
        }, 200);
    }
}
// Global delegation för cross-link-knappar
document.addEventListener('click', e => {
    const link = /** @type {HTMLElement} */ (e.target).closest('.row-cross-link');
    if (!link) return;
    e.preventDefault();
    e.stopPropagation();
    const target = /** @type {HTMLElement} */ (link).dataset.target;
    const yrke = /** @type {HTMLElement} */ (link).dataset.yrke || '';
    const bas  = /** @type {HTMLElement} */ (link).dataset.bas  || '';
    if (target === 'rapport') {
        navigateTo('rapport', { search: yrke, searchInputId: 'search-rapport' });
    } else if (target === 'matrix') {
        navigateTo('matrix', { highlightMatch: { tableId: 'matrix-table', contains: [yrke] } });
    } else if (target === 'demografi') {
        navigateTo('demografi');
        setTimeout(() => {
            const sel = document.getElementById('bas-select-demo');
            if (sel) {
                /** @type {HTMLInputElement} */ (sel).value = bas;
                sel.dispatchEvent(new Event('change', { bubbles: true }));
            }
        }, 150);
    }
});

// ---- Mini-bar för procentkolumn (bidirektionell) ----
// percent: signerat procentvärde, scaleMax: max abs-värde som motsvarar full bar
function buildBarCell(percent, scaleMax = 25, options = {}) {
    const fmt = options.format || (p => (p >= 0 ? '+' : '') + svPct(p, 1));
    // En decimal på skärmen; exporten bär två (data-export-text, se _exportText).
    const exportText = options.format ? '' : ` data-export-text="${(percent >= 0 ? '+' : '') + svPct(percent, 2)}"`;
    if (percent === null || percent === undefined || isNaN(percent)) {
        return `<div class="cell-bar-wrap"><span class="cell-bar-bg bidirectional"></span><span class="cell-bar-value f-dampad">–</span></div>`;
    }
    const clamped = Math.max(-scaleMax, Math.min(scaleMax, percent));
    const halfPct = Math.abs(clamped) / scaleMax * 50; // % av baren
    const isNeg = percent < 0;
    const left  = isNeg ? (50 - halfPct) + '%' : '50%';
    const width = halfPct + '%';
    return `<div class="cell-bar-wrap" data-sort-value="${percent}">
        <span class="cell-bar-bg bidirectional">
            <span class="cell-bar-fill ${isNeg ? 'bg-kritisk' : 'bg-ok'}" data-stil-vanster="${left}" data-stil-bredd="${width}"></span>
        </span>
        <span class="cell-bar-value ${isNeg ? 'f-kritisk' : 'fg-ok'} halvfet"${exportText}>${fmt(percent)}</span>
    </div>`;
}

// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson

// ---- Löneöversikten (tabellen överst i Utforska) ----
function generateRapport() {
    const tbody = /** @type {HTMLElement} */ (document.querySelector("#rapport-table tbody"));
    tbody.innerHTML = "";
    const fmt = new Intl.NumberFormat('sv-SE', {style:'currency',currency:'SEK',maximumFractionDigits:0});
    const d   = getData();
    const bas = getBasIntervals();
    let kMaskedRowsCount = 0;
    let yrkenSkippedCount = 0;

    bas.forEach(b => {
        const df  = d.filter(r => r.bas === b);
        const pol = policyFor(null, b);
        const trH = document.createElement("tr");
        trH.className = "group-header";
        trH.dataset.bas = b;
        trH.innerHTML = `<td colspan="8">BAS ${esc(b)}</td>`;
        tbody.appendChild(trH);
        const basUtelamnade = [];
        if (pol) {
            const tr = document.createElement("tr");
            // data-sort-value → Excel-exporten får riktiga tal (sorterbara/summerbara)
            tr.innerHTML = `<td>${esc(referensKortnamn())}</td><td data-sort-value="${pol.p10}">${fmt.format(pol.p10)}</td><td data-sort-value="${pol.med}">${fmt.format(pol.med)}</td><td data-sort-value="${pol.p90}">${fmt.format(pol.p90)}</td><td>-</td><td>-</td><td>-</td><td>-</td>`;
            tbody.appendChild(tr);
        }
        const addRow = (kategori, subset) => {
            if (!subset.length) return;
            // k-anonymitet: raden utelämnas i stället för att fyllas med
            // "< 10"-celler. En rad där P10, median, P90 och spridning alla är
            // maskerade ger inget att analysera — den gör bara rapporten längre.
            // Gruppen räknas i stället upp i noten sist i BAS-blocket.
            if (isKMasked(subset.length)) { kMaskedRowsCount++; basUtelamnade.push(kategori); return; }
            const lons = subset.map(r => r.lon);
            const med = Stat.median(lons), p10 = Stat.quantile(lons, 0.1), p90 = Stat.quantile(lons, 0.9);
            const isWarn = pol && pol.p10 && med < pol.p10;
            const spreadTal = p10 > 0 ? p90 / p10 : null;
            const spread = spreadTal != null ? svTal(spreadTal, 2) : "-";
            let statMed = "-", statDiff = "-", statColor = "";
            /** @type {number|null} */ let statRefMedian = null;
            /** @type {number|null} */ let statDiffRaw = null;
            if (state.statistik.length > 0) {
                const aidM = kategori.match(/^(\d+)/);
                const aidCode = aidM ? aidM[1] : kategori;
                const sr = state.statistik.find(s => s.aid === aidCode && s.bas === b) || state.statistik.find(s => s.aid === aidCode && !s.bas);
                if (sr && sr.median > 0) {
                    statMed = fmt.format(sr.median);
                    statRefMedian = sr.median;
                    const diff = ((med / sr.median) - 1) * 100;
                    statDiffRaw = +diff.toFixed(1);
                    statDiff = (diff > 0 ? "+" : "") + svPct(diff, 1);
                    statColor = diff < 0 ? "f-kritisk" : "fg-ok";
                }
            }
            // Bevis-knapp i kategori-cellen
            // (ingen ny kolumn — håller rapportstrukturen oförändrad).
            const evidenceBtn = ` <button class="btn-evidence" data-rapport-row="1" type="button" title="Visa beräkningen bakom denna rad" aria-label="Visa bevis för ${esc(kategori)}">${ikon('sok')}</button>`;
            const tr = document.createElement("tr");
            // data-sort-value på talceller → Excel-exporten får riktiga tal
            const svMed = statRefMedian != null ? ` data-sort-value="${statRefMedian}"` : '';
            const svDiff = statDiffRaw != null ? ` data-sort-value="${statDiffRaw}"` : '';
            tr.innerHTML = `<td>${esc(kategori)}${evidenceBtn}</td><td class="${isWarn?'warning-cell':''}" data-sort-value="${p10}">${fmt.format(p10)}</td><td class="${isWarn?'warning-cell':''}" data-sort-value="${med}">${fmt.format(med)}</td><td data-sort-value="${p90}">${fmt.format(p90)}</td><td data-sort-value="${lons.length}">${lons.length}</td><td${spreadTal != null ? ` data-sort-value="${spreadTal.toFixed(2)}"` : ''}>${spread}</td><td class="bak-info-yta"${svMed}>${statMed}</td><td class="bg-info-yta halvfet ${statColor}"${svDiff}>${statDiff}</td>`;
            // Cache rad-data så bevis-handler kan plocka upp den
            tr._rapportRow = { kategori, bas: b, lons: lons.slice(), polRow: pol, statRefMedian, masked: false };
            tbody.appendChild(tr);
        };
        addRow("Organisationen", df);
        addRow("Kvinna", df.filter(r => r.kon.includes("kvinna")));
        addRow("Man", df.filter(r => r.kon === "man" || r.kon === "män"));
        const yrkeMap = {};
        df.forEach(r => { if (!yrkeMap[r.yrke]) yrkeMap[r.yrke] = []; yrkeMap[r.yrke].push(r); });
        Object.keys(yrkeMap).sort().forEach(y => {
            if (yrkeMap[y].length >= 5) addRow(y, yrkeMap[y]);
            else yrkenSkippedCount++;
        });
        if (basUtelamnade.length) {
            const trN = document.createElement("tr");
            trN.innerHTML = `<td colspan="8">${kMaskNote(basUtelamnade, 'grupp i detta BAS|grupper i detta BAS')}</td>`;
            tbody.appendChild(trN);
        }
    });

    // Bevis-popup för rapport-rader
    tbody.querySelectorAll('.btn-evidence[data-rapport-row]').forEach(btn => {
        btn.addEventListener('click', e => {
            e.stopPropagation();
            const tr = btn.closest('tr');
            const payload = tr?._rapportRow;
            if (!payload) return;
            _openEvidenceModal(_evidenceForRapportRow(payload));
        });
    });

    // Jämförelsestatistikens två kolumner visas bara när en statistik är inläst (de står kvar i tabellen för exporten).
    document.getElementById('rapport-table')?.classList.toggle('utan-jamforelse', !state.statistik.length);
    if (!/** @type {HTMLInputElement} */ (document.getElementById('search-rapport'))?.value) _rapportTillampaHopfallning();

    // Audit
    const base = buildBaseAudit();
    setAudit('rapport', {
        title: 'Löneöversikt',
        ...base,
        usedInAnalysis: base.afterFilter,
        analysisExclusions: [
            ...(yrkenSkippedCount > 0 ? [[`Yrkesgrupper med <5 personer (slås ihop med "Organisationen"-raden)`, yrkenSkippedCount]] : [])
        ],
        formler: [
            ['Median', 'P50, mittersta värdet av sorterad lönelista'],
            ['P10', 'Värdet där 10% av gruppen tjänar mindre'],
            ['P90', 'Värdet där 90% av gruppen tjänar mindre'],
            ['Lönespridning', '<code>P90 / P10</code> (1.0 = ingen spridning, &gt;1.5 = bred spridning)'],
            ['Diff mot jämförelsestatistiken', '<code>(organisationens median / jämförelsens median) − 1</code> uttryckt i %']
        ],
        notes: [
            `K-anonymitet: ${kMaskedRowsCount} grupp${kMaskedRowsCount === 1 ? '' : 'er'} utelämnades (n &lt; ${kTroskel()}); de räknas upp under respektive BAS`,
            `BAS-grupper visar i ordning: "${esc(referensKortnamn())}" (referensen), "Organisationen", "Kvinna", "Man" och sedan varje yrkesgrupp med ≥5 personer`
        ]
    });
}

// Löneöversikten: fäll in/ut alla
document.getElementById('rapport-collapse-all')?.addEventListener('click', () => toggleAllGroups('rapport-table', true));
document.getElementById('rapport-expand-all')?.addEventListener('click', () => toggleAllGroups('rapport-table', false));

// Vilka BAS-grupper som är hopfällda. Från början alla utom den första: tabellen är lång, och det man söker är oftast
// ett BAS i taget. Valet står kvar när tabellen ritas om; «Rensa all data» glömmer det.
/** @type {Set<string>|null} */
let _rapportHopfallda = null;   // Set med BAS, eller null = alla utom den första
function _rapportTillampaHopfallning() {
    const rubriker = [...document.querySelectorAll('#rapport-table tbody tr.group-header')];
    if (!_rapportHopfallda) _rapportHopfallda = new Set(rubriker.slice(1).map(tr => /** @type {HTMLElement} */ (tr).dataset.bas || ''));
    for (const tr of rubriker) {
        const hop = _rapportHopfallda.has(/** @type {HTMLElement} */ (tr).dataset.bas || '');
        tr.classList.toggle('collapsed', hop);
        for (let n = tr.nextElementSibling; n && !n.classList.contains('group-header'); n = n.nextElementSibling) /** @type {HTMLElement} */ (n).style.display = hop ? 'none' : '';
    }
}
function rapportGlomHopfallning() { _rapportHopfallda = null; }
document.querySelector('#rapport-table tbody')?.addEventListener('click', e => {
    if (!/** @type {HTMLElement} */ (e.target).closest('tr.group-header')) return;
    // Raden fälls av tabellens gemensamma lyssnare; här noteras bara läget när den har gjort sitt.
    setTimeout(() => { _rapportHopfallda = new Set([...document.querySelectorAll('#rapport-table tbody tr.group-header.collapsed')].map(tr => /** @type {HTMLElement} */ (tr).dataset.bas || '')); }, 0);
});

// Search rapport
document.getElementById("search-rapport")?.addEventListener("input", e => {
    const q = /** @type {HTMLInputElement} */ (e.target).value.toLowerCase();
    if (!q) { _rapportTillampaHopfallning(); return; }   // tomt sökfält: tillbaka till det hopfällda läget
    document.querySelectorAll('#rapport-table tbody tr.group-header.collapsed').forEach(tr => tr.classList.remove('collapsed'));   // en sökning visar träffar i alla BAS
    const rows = [...document.querySelectorAll("#rapport-table tbody tr")];
    rows.forEach(tr => { if (!tr.classList.contains("group-header")) /** @type {HTMLElement} */ (tr).style.display = tr.textContent.toLowerCase().includes(q) ? "" : "none"; });
    rows.forEach((tr, i) => {
        if (!tr.classList.contains("group-header")) return;
        const hasVisible = rows.slice(i+1).some(r => !r.classList.contains("group-header") && /** @type {HTMLElement} */ (r).style.display !== "none");
        /** @type {HTMLElement} */ (tr).style.display = !q || hasVisible ? "" : "none";
    });
});

// Export Excel (bara Löneöversikten)
document.getElementById("btn-export-excel")?.addEventListener("click", () => {
    const wb = tableToCleanBook('rapport-table', 'Rapport');
    if (wb) { _appendMethodSheet(wb); XLSX.writeFile(wb, "lonekartlaggning_rapport.xlsx"); _showExportSensitivityToast(); }
});

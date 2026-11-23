// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
import { svPct, svTal } from '../lib/talformat.js';
import { stor } from '../lib/termer.js';
import { vymodellLoneoversikt } from '../lib/vymodell-loneoversikt.js';
import { esc } from './01-html-och-tillganglighet.js';
import { ikon } from './03-ikoner.js';
import { byggGrundurval, sattMetodik, vaxlaAllaGrupper } from './05-tabeller-och-lankar.js';
import { kTroskel } from './06-k-troskel.js';
import { kMaskNot } from './06-maskeringsnoter.js';
import { T } from './09-termer.js';
import { hamtaBasIntervall, hamtaData, policyFor, referensKortnamn, state } from './12-tillstand.js';
import { _laggTillMetodblad, _visaExportvarning, tabellTillBok } from './22-exporthjalpare.js';
import { medExportLage } from './23-exportgrind.js';
import { _evidenceForRapportRow, _openEvidenceModal } from './27-berakningsbevis.js';
import { basdossierKandidater, basdossierKnapp } from './81-basdossier.js';

// ---- Löneöversikten (tabellen överst i Utforska) ----
export function ritaLoneoversikt() {
    const tbody = /** @type {HTMLElement} */ (document.querySelector("#rapport-table tbody"));
    tbody.innerHTML = "";
    const fmt = new Intl.NumberFormat('sv-SE', {style:'currency',currency:'SEK',maximumFractionDigits:0});
    const vm = vymodellLoneoversikt(hamtaData(), { bas: hamtaBasIntervall(), k: kTroskel(), policyFor, statistik: state.statistik });
    const dossierBas = new Set(basdossierKandidater().map(x => x.bas));

    vm.block.forEach(({ bas: b, referens: pol, rader, utelamnade }) => {
        const trH = document.createElement("tr");
        trH.className = "group-header";
        trH.dataset.bas = b;
        trH.innerHTML = `<td colspan="8">BAS ${esc(b)}${dossierBas.has(b) ? basdossierKnapp(b) : ''}</td>`;
        tbody.appendChild(trH);
        if (pol) {
            const tr = document.createElement("tr");
            // data-sort-value → Excel-exporten får riktiga tal (sorterbara/summerbara)
            tr.innerHTML = `<td>${esc(referensKortnamn())}</td><td data-sort-value="${pol.p10}">${fmt.format(pol.p10)}</td><td data-sort-value="${pol.med}">${fmt.format(pol.med)}</td><td data-sort-value="${pol.p90}">${fmt.format(pol.p90)}</td><td>-</td><td>-</td><td>-</td><td>-</td>`;
            tbody.appendChild(tr);
        }
        // Minsta gruppstorlek: en rad under tröskeln utelämnas i stället för att fyllas med "< 10"-celler; gruppen räknas i
        // stället upp i noten sist i BAS-blocket (vymodellen).
        for (const r of rader) {
            const kategori = r.kategori, lons = r.lons, med = r.med, p10 = r.p10, p90 = r.p90, spridning = r.spridning, statMedian = r.statMedian;
            const warn = r.underReferens ? 'warning-cell' : '';
            const statDiffRaw = r.statDiff != null ? +r.statDiff.toFixed(1) : null;
            const statMed = statMedian != null ? fmt.format(statMedian) : "-";
            const statDiff = r.statDiff != null ? (r.statDiff > 0 ? "+" : "") + svPct(r.statDiff, 1) : "-";
            const statColor = r.statDiff != null ? (r.statDiff < 0 ? "f-kritisk" : "fg-ok") : "";
            // Bevis-knapp i kategori-cellen
            // (ingen ny kolumn — håller rapportstrukturen oförändrad).
            const evidenceBtn = ` <button class="btn-evidence" data-rapport-row="1" type="button" title="Visa beräkningen bakom denna rad" aria-label="Visa beräkningen för ${esc(kategori)}">${ikon('sok')}</button>`;
            const tr = document.createElement("tr");
            // data-sort-value på talceller → Excel-exporten får riktiga tal
            const svMed = statMedian != null ? ` data-sort-value="${statMedian}"` : '';
            const svDiff = statDiffRaw != null ? ` data-sort-value="${statDiffRaw}"` : '';
            tr.innerHTML = `<td>${esc(kategori)}${evidenceBtn}</td><td class="${warn}" data-sort-value="${p10}">${fmt.format(p10)}</td><td class="${warn}" data-sort-value="${med}">${fmt.format(med)}</td><td data-sort-value="${p90}">${fmt.format(p90)}</td><td data-sort-value="${lons.length}">${lons.length}</td><td${spridning != null ? ` data-sort-value="${spridning.toFixed(2)}"` : ''}>${spridning != null ? svTal(spridning, 2) : "-"}</td><td class="bak-info-yta"${svMed}>${statMed}</td><td class="bg-info-yta halvfet ${statColor}"${svDiff}>${statDiff}</td>`;
            // Cache rad-data så bevis-handler kan plocka upp den
            tr._rapportRow = { kategori, bas: b, rad: r, polRow: pol, masked: false };
            tbody.appendChild(tr);
        }
        if (utelamnade.length) {
            const trN = document.createElement("tr");
            trN.innerHTML = `<td colspan="8">${kMaskNot(utelamnade, 'grupp i detta BAS|grupper i detta BAS')}</td>`;
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
    const base = byggGrundurval();
    sattMetodik('rapport', {
        title: 'Löneöversikt',
        ...base,
        usedInAnalysis: base.afterFilter,
        analysisExclusions: [
            ...(vm.smaYrken > 0 ? [[`${stor(T.enhet.fl)} med <5 personer (slås ihop med "Organisationen"-raden)`, vm.smaYrken]] : [])
        ],
        formler: [
            ['Median', 'P50, mittersta värdet av sorterad lönelista'],
            ['P10', 'Värdet där 10% av gruppen tjänar mindre'],
            ['P90', 'Värdet där 90% av gruppen tjänar mindre'],
            ['Lönespridning', '<code>P90 / P10</code> (1.0 = ingen spridning, &gt;1.5 = bred spridning)'],
            ['Diff mot jämförelsestatistiken', '<code>(organisationens median / jämförelsens median) − 1</code> uttryckt i %']
        ],
        notes: [
            `Minsta gruppstorlek: ${vm.utelamnade} grupp${vm.utelamnade === 1 ? '' : 'er'} utelämnades (n &lt; ${kTroskel()}); de räknas upp under respektive BAS`,
            `BAS-grupper visar i ordning: "${esc(referensKortnamn())}" (referensen), "Organisationen", "Kvinna", "Man" och sedan varje ${T.enhet.en} med ≥5 personer`
        ]
    });
}

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
export function rapportGlomHopfallning() { _rapportHopfallda = null; }

/** Det som körs vid laddning, i filens ordning; src/app/index.js anropar delarnas uppstart i sifferordning. */
export function uppstartLoneoversikt() {
    // Löneöversikten: fäll in/ut alla
    document.getElementById('rapport-collapse-all')?.addEventListener('click', () => vaxlaAllaGrupper('rapport-table', true));
    document.getElementById('rapport-expand-all')?.addEventListener('click', () => vaxlaAllaGrupper('rapport-table', false));
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
    document.getElementById("btn-export-excel")?.addEventListener("click", () => medExportLage(() => {
        const wb = tabellTillBok('rapport-table', 'Rapport');
        if (wb) { _laggTillMetodblad(wb); XLSX.writeFile(wb, "lonekartlaggning_rapport.xlsx"); _visaExportvarning(); }
    }));
}

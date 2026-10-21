// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson

// ---- File Upload: Policy CSV ----
// Läser in ett eget ställningstagande (redan tolkade rader) och namnger det efter
// filen (ADR-28). Returnerar antal giltiga rader; 0 = inget ändrat.
function _lasInReferens(rader, filnamn) {
    const policy = rader.map(row => ({
        aid: _normalizePolicyAid(row.aid ?? getField(row, ["aid","yrkeskod","befattningskod"])),
        bas: _normalizeBas(row.bas ?? getField(row, ["bas","basintervall"])),
        p10: typeof row.p10 === 'number' ? row.p10 : parseNumber(getField(row, ["10e","p10","10"])),
        med: typeof row.med === 'number' ? row.med : parseNumber(getField(row, ["median","med"])),
        p90: typeof row.p90 === 'number' ? row.p90 : parseNumber(getField(row, ["90e","p90","90"]))
    })).filter(p => p.bas || p.aid);
    if (!policy.length) return 0;
    state.policy = policy;
    state.policyKalla = 'fil';
    const namn = _refNamnFranFil(filnamn);
    state.policyNamn = namn;
    state.policyKortnamn = namn;
    renderReferensKort();
    if (typeof renderPaketInfo === 'function') { renderPaketInfo(); uppdateraPaketKnapp(); }
    return policy.length;
}

// Referenskortet på Översikt: vilken referens som används, namnfält för egen fil
// och knappen som tar bort den.
function renderReferensKort() {
    const el = document.getElementById('referens-status');
    if (!el) return;
    const har = harReferens();
    el.innerHTML = har
        ? `Används: <strong>${esc(referensNamn())}</strong>${esc(referensKalla())}`
        : '<strong>Ingen referens inläst.</strong><br><span class="ref-hjalp">Ladda upp ert lönepolitiska ställningstagande — eller ett organisationspaket.</span>';
    const falt = document.getElementById('referens-namn-rad');
    const input = document.getElementById('referens-namn');
    const aterga = document.getElementById('btn-referens-aterga');
    const egen = har && state.policyKalla === 'fil';
    // Namnet får ändras både för en egen fil och för ett inläst paket (paketet kan bära ett filnamn som
    // systemägaren inte bytte); borttagning gäller bara egen fil — paketets delar tas bort med paketet.
    const namnges = har && (state.policyKalla === 'fil' || state.policyKalla === 'paket');
    if (falt) falt.hidden = !namnges;
    if (input && document.activeElement !== input) /** @type {HTMLInputElement} */ (input).value = namnges ? referensNamn() : '';
    if (aterga) { aterga.hidden = !egen; aterga.textContent = 'Ta bort referensen'; }
}
_kopplaNamnFalt('referens-namn', sattReferensNamn);
document.getElementById('btn-referens-aterga')?.addEventListener('click', () => {
    aterstallReferens();
    const ps = document.getElementById('policy-status');
    if (ps) { ps.textContent = ''; ps.className = 'status-msg'; }
    const fil = document.getElementById('file-input-policy');
    if (fil) /** @type {HTMLInputElement} */ (fil).value = '';   // samma fil ska kunna laddas upp igen
    if (typeof resetUploadCell === 'function') resetUploadCell('upload-cell-policy', 'upload-cell optional', 'Valfritt');
    ritaOmReferens();
});
const policyInput = /** @type {HTMLElement} */ (document.getElementById("file-input-policy"));
const policyStatus = /** @type {HTMLElement} */ (document.getElementById("policy-status"));
policyInput.addEventListener("change", e => {
    const file = /** @type {HTMLInputElement} */ (e.target).files?.[0];
    if (!file) return;
    showLoading();
    // Gemensam läsväg: CSV (alla kodningar/avgränsare, preamble-tolerant) + XLSX.
    // `aid` är VALFRI: en policyrad får vara BAS-nivå, AID-specifik
    // (yrke oavsett BAS) eller AID+BAS (mest specifik). Uppslaget sker via
    // policyFor(), som följer specificitetsordningen. _findCsvHeader poängsätter
    // synonymträffar (kräver inte alla grupper), så BAS-only-filer hittas också.
    readTabularFile(file, [["bas"], ["aid", "yrkeskod", "befattningskod"], ["p10", "10e", "10"], ["median", "med"], ["p90", "90e", "90"]], res => {
        if (!res.ok) {
            hideLoading();
            policyStatus.textContent = '' + res.error;
            policyStatus.className = "status-msg";
            return;
        }
        const nInlasta = _lasInReferens(res.rows, file.name);
        if (!nInlasta) {
            hideLoading();
            policyStatus.textContent = 'Inga giltiga rader — varje rad behöver en BAS-kolumn, en AID-kolumn eller båda.';
            policyStatus.className = "status-msg";
            return;
        }
        const nAid = state.policy.filter(p => p.aid).length;
        const nBas = state.policy.filter(p => p.bas && !p.aid).length;
        policyStatus.textContent = `${state.policy.length} rader inlästa`
            + (nAid ? ` (${nBas} BAS-nivå, ${nAid} AID-specifika)` : ' (BAS-nivå)')
            + ` · ${res.encoding === 'XLSX' ? res.format : res.encoding}`;
        policyStatus.className = "status-msg success";
        markUploadLoaded('upload-cell-policy', 'Inläst');
        state.filnamn.policy = file.name; renderFilrutor();
        hideLoading(); updateCompliance();
        renderConsistencyBanner();
        renderActionChecklist();
        renderProcessTracker();
        if (getData().length > 0) generateRapport();
    });
});

// Jämförelse-fliken syns bara när jämförelsestatistik är uppladdad.
function _visaJamforelseFlik(synlig) {
    const tb = document.getElementById('tab-benchmark');
    if (!tb) return;
    tb.hidden = !synlig;
    /** @type {HTMLInputElement} */ (tb).disabled = !synlig;
    if (synlig) tb.removeAttribute('title');
    if (!synlig && tb.classList.contains('active')) /** @type {HTMLElement} */ (document.querySelector('.nav-item[data-tab="dashboard"]'))?.click();
}

// ---- File Upload: External Statistics (Excel) ----
const statInput = /** @type {HTMLElement} */ (document.getElementById("file-input-stat"));
const statStatus = /** @type {HTMLElement} */ (document.getElementById("stat-status"));

statInput.addEventListener("change", e => {
    const file = /** @type {HTMLInputElement} */ (e.target).files?.[0];
    if (!file) return;
    showLoading();
    // Gemensam läsväg (samma som struktur/policy/historik): CSV alla kodningar +
    // preamble-tolerans, XLSX, och tydligt .xls-besked. Rubrikraden hittas av readTabularFile via synonymerna
    // AID + Median; kolumnrollerna mappas därefter på de funna rubrikerna.
    readTabularFile(file, [["aid", "yrkesgrupp"], ["median"]], res => {
        if (!res.ok) {
            hideLoading();
            statStatus.textContent = "Fel: " + res.error;
            statStatus.className = "status-msg error";
            return;
        }
        try {
            const hdr = res.headers.map(h => (h || "").toString().toLowerCase());
            const idxAID = hdr.findIndex(t => t.includes("aid") || t.includes("yrkesgrupp"));
            const idxBAS = hdr.findIndex(t => t.includes("bas"));
            // Median: exkludera "diff"-kolumner (t.ex. "Diff LPS Median" vs "Totalt Median").
            const idxMed = hdr.findIndex(t => t.includes("median") && !t.includes("diff"));
            // Valfria percentiler — matchar både "Totalt 10:e p", "P10", "10e",
            // "10 percentilen" m.fl. men exkluderar "Diff LPS 10:e p".
            const idxP10 = hdr.findIndex(t =>
                !t.includes("diff") && /(\b10:?\s*e\s*p|\bp10\b|10\s*percent|\b10e\b)/.test(t)
            );
            const idxP90 = hdr.findIndex(t =>
                !t.includes("diff") && /(\b90:?\s*e\s*p|\bp90\b|90\s*percent|\b90e\b)/.test(t)
            );
            // Läs in jämförelsestatistikens faktiska könsfördelning
            // (Kvinnor Antal, Män Antal, Andel kvinnor). Detta möjliggör att
            // § 3:10-analysen kan använda LOKAL könsfördelning per AID×BAS
            // i stället för SKR:s personalstatistik som reserv.
            const idxNKv = hdr.findIndex(t =>
                /(kvinnor\s*antal|kv\s*antal|antal\s*kvinnor)/.test(t)
            );
            const idxNMa = hdr.findIndex(t =>
                /(m[aä]n\s*antal|ma\s*antal|antal\s*m[aä]n)/.test(t)
            );
            const idxAndelKv = hdr.findIndex(t =>
                /(andel\s*kvinnor|kvinno?andel|%\s*kvinnor)/.test(t)
            );
            if (idxAID === -1 || idxMed === -1) throw new Error("AID eller Median saknas i filen.");
            // Rad-objekten är nycklade på originalrubrikerna — översätt index → nyckel.
            const col = i => i !== -1 ? res.headers[i] : null;
            const cAID = col(idxAID), cBAS = col(idxBAS), cMed = col(idxMed),
                  cP10 = col(idxP10), cP90 = col(idxP90),
                  cNKv = col(idxNKv), cNMa = col(idxNMa), cAndel = col(idxAndelKv);
            state.statistik = [];
            state.statistikNamn = _refNamnFranFil(file.name);
            state.statistikKalla = 'fil';
            // Likvärdighetsparen jämförs mot statistiken — ett sparat resultat gäller inte längre.
            if (state.likvardighet) state.likvardighet.result = null;
            // Spara om P10/P90 var närvarande, så UI kan visa info-banner
            state.statistikHasP10 = idxP10 !== -1;
            state.statistikHasP90 = idxP90 !== -1;
            state.statistikHasKon = (idxNKv !== -1 && idxNMa !== -1) || idxAndelKv !== -1;
            res.rows.forEach(r => {
                // Samma sanering som lönefilen och ställningstagandet: HTML-metatecken bort
                // vid inläsning (esc() vid rendering är det egentliga skyddet).
                const aidRaw = cAID && r[cAID] != null ? _stripHtmlMeta(r[cAID]).trim() : "";
                const basRaw = cBAS && r[cBAS] != null ? _normalizeBas(r[cBAS]) : "";
                const median = parseNumber(r[/** @type {string} */ (cMed)]);
                const p10 = cP10 ? parseNumber(r[cP10]) : 0;
                const p90 = cP90 ? parseNumber(r[cP90]) : 0;
                // Könsfördelning (om finns)
                const nKv = cNKv ? parseNumber(r[cNKv]) : null;
                const nMa = cNMa ? parseNumber(r[cNMa]) : null;
                let andelKv = cAndel ? parseNumber(r[cAndel]) : null;
                // Konvertera till %: om värdet är ≤ 1 antas det vara decimal (0.65), annars %
                if (andelKv != null && andelKv > 0 && andelKv <= 1) andelKv = andelKv * 100;
                // Beräkna andelKv från antal om kolumn saknas
                if (andelKv == null && nKv != null && nMa != null && (nKv + nMa) > 0) {
                    andelKv = (nKv / (nKv + nMa)) * 100;
                }
                if (aidRaw && median > 0) {
                    state.statistik.push({
                        aid: _normalizePolicyAid(aidRaw), aidFull: aidRaw, bas: basRaw,
                        median, p10, p90,
                        nKv: nKv != null && nKv >= 0 ? nKv : null,
                        nMa: nMa != null && nMa >= 0 ? nMa : null,
                        andelKv: andelKv != null && andelKv >= 0 && andelKv <= 100 ? andelKv : null
                    });
                }
            });
            const extras = [];
            if (state.statistikHasP10) extras.push('P10');
            if (state.statistikHasP90) extras.push('P90');
            if (state.statistikHasKon) extras.push('könsfördelning');
            const src = res.encoding === 'XLSX' ? res.format : res.encoding;
            statStatus.textContent = (extras.length
                ? `${state.statistik.length} poster inlästa (median + ${extras.join(' + ')})`
                : `${state.statistik.length} poster inlästa`) + ` · ${src}`;
            statStatus.className = "status-msg success";
            markUploadLoaded('upload-cell-stat', 'Inläst');
            state.filnamn.statistik = file.name; renderFilrutor();
            if (typeof renderPaketInfo === 'function') { renderPaketInfo(); uppdateraPaketKnapp(); }
            _visaJamforelseFlik(true);
            hideLoading(); updateCompliance();
            renderConsistencyBanner();
            renderActionChecklist();
            renderProcessTracker();
        } catch (err) {
            hideLoading();
            statStatus.textContent = "Fel: " + err.message;
            statStatus.className = "status-msg error";
        }
    });
});

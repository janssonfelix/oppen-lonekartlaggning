// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson

// ---- Rensa all data: lagringsminimering (art. 5.1 e, 25.2) ----
/**
 * Tömmer all in-memory data och tar ned all renderad UI som kan innehålla
 * personuppgifter. Användaren har samma effekt om de stänger fliken — denna
 * knapp gör rensningen till en explicit, dokumenterad åtgärd. Rätten till radering utövas mot källsystemet.
 */
function clearAllData() {
    const hasAny = state.data.length || state.policy.length || state.statistik.length || state.snapshot || state.paket;
    if (!hasAny) {
        announceToScreenReader('Ingen data finns i minnet att rensa.');
        return;
    }
    if (!confirm('Detta raderar all data ur minnet (struktur, policy, statistik, scenarion, snapshot). Detta går inte att ångra. Fortsätt?')) return;

    _rensaAllData();
}

/**
 * Själva rensningen, utan bekräftelsefråga. Enda rensningsvägen: används av
 * knappen "Rensa all data" och av den automatiska rensningen vid inaktivitet,
 * så att de aldrig kan glida isär. Vaktas av invarianten "Rensa all data: ingen
 * lönedata kvar" i tests/smoke.test.js, för båda vägarna.
 */
// Behållare som fylls av JavaScript med innehåll som kan bära lönedata. Listorna används av "Rensa all data" och av
// exportgrinden (23-exportgrind.js), som tömmer flikar som inte längre är ritade med gällande tröskel.
const RENSA_BEHALLARE = ['struktur-representation', 'struktur-distribution', 'struktur-eu', 'struktur-sektorer', 'forecast-outcome', 'explore-table',
    'outliers-table-wrap', 'print-report'];
const RENSA_TABELLER = ['rapport-table', 'matrix-table', 'la-oversikt', 'pag-avvikelse-tabell', 'paygap-table', 'skevhet-table', 'benchmark-table', 'prio-table'];
const RENSA_OVRIGT = ['action-checklist-container', 'outlier-list', 'data-validation-report', 'reality-check', 'snapshot-comparison', 'consistency-banner', 'process-tracker', 'likvardighet-content', 'blinder-oaxaca-card', 'livscykel-content', 'lonepolitik-content', 'robusthet-body', 'fardigcheck-body', 'rapportunderlag-innehall', 'gap-uppdelning-innehall', 'pag-innehall', 'att-gora-borja'];

function _rensaAllData({ inbakat = true } = {}) {
    if (typeof laMinneSlapp === 'function') laMinneSlapp();   // minnet håller en referens till dataraderna
    // 0. Utforska håller egna referenser till raderna (senaste modellen,
    //    urvalets värdelistor, diagrammets exportfunktion) — släpp dem också,
    //    annars finns hela underlaget kvar i minnet efter rensningen.
    if (typeof explorerSlappMinne === 'function') explorerSlappMinne();
    if (typeof rapportGlomHopfallning === 'function') rapportGlomHopfallning();

    // 1. Nolla state-objektet
    state.data = [];
    state.kTroskel = K_STANDARD;      // ADR-38: tillbaka till standard
    // Organisationspaketets låsningar (ADR-47) följer med paketet; en låst rensningstid går tillbaka till standard.
    const inaktivitetVarLast = state.paketLas.inaktivitetMin != null;
    state.paketLas = { kTroskelLagst: null, inaktivitetMin: null, smaGrupperIExport: true };
    if (inaktivitetVarLast && typeof setInactivityTimeout === 'function') setInactivityTimeout(INAKTIVITET_STANDARD_MIN);
    if (typeof explorerSynkaSmaLas === 'function') explorerSynkaSmaLas();
    if (typeof _kVisaFel === 'function') _kVisaFel('');   // ett felmeddelande vid fältet hör till det rensade läget
    if (typeof _synkaKTroskel === 'function') _synkaKTroskel();
    aterstallReferens();   // ADR-28: ingen referens (ingen inbyggd)
    state.profile = { ...DEFAULT_PROFILE };   // neutral profil (demoläget och paket sätter en egen)
    if (typeof applyProfileLabels === 'function') applyProfileLabels();
    if (typeof _synkaOrgTyp === 'function') _synkaOrgTyp();
    if (typeof synkaNamnFalt === 'function') synkaNamnFalt();
    if (typeof jamforelseSattVal === 'function') jamforelseSattVal({ kalla: 'statistik', bas: '', sektor: '' });
    // Organisationspaketet (ADR-28): grundinställningarna kom ur paketet — tillbaka till standard.
    if (state.paket) state.costSettings = { ...state.costSettings, poPct: COST_DEFAULTS.poPct, months: COST_DEFAULTS.months };
    state.paket = null;
    state.statistikNamn = null;
    state.statistikKalla = null;
    state.statistikHasP10 = false;
    state.statistikHasP90 = false;
    state.statistikHasKon = false;
    if (typeof _synkaKostnadsfalt === 'function') _synkaKostnadsfalt();
    if (typeof renderPaketInfo === 'function') renderPaketInfo();
    const paketStatus = document.getElementById('paket-status');
    if (paketStatus) { paketStatus.textContent = ''; paketStatus.className = 'status-msg'; }
    if (typeof _fyllPaketFormular === 'function') _fyllPaketFormular();
    state.statistik = [];
    state.isDemo = false;   // #9: lämna demoläge
    if (typeof _renderDemoBanner === 'function') _renderDemoBanner();
    state._interntFel = [];   // interna fel gällde det rensade underlaget
    if (typeof visaInterntFel === 'function') visaInterntFel();
    state._lastStructureFile = null;   // släpp filreferensen (GDPR: inget kvar i RAM)
    state.arbetsvardering = null;
    state.columnMap = null;
    state.ansvarKolumn = null;
    state._dataHeaders = [];
    state.scenarios = [];
    state.snapshot = null;
    state.forraArsbokslut = null;
    state.dataAudit = null;
    state.bristAids = new Set();
    state.rapportUrval = null;
    state.rapportTabeller = [];
    state.perBasRecept = null;
    // Rensa även historiska snapshots och anteckningar
    state.forecast = { budget: { mode: 'pct', value: null }, generell: { mode: 'pct', value: null }, targets: [], minGroupN: 10, roundStep: 0, years: 1, scenarios: { A: null, B: null }, result: null };
    // Rensa även beräkningscacher som kan innehålla
    // spår av lönefördelningar (CI-värden, MDE-mått från power-analysen).
    state.bootstrapCI = null;
    state.powerAnalysis = null;
    state.dataAudit = null;
    if (state.likvardighet) state.likvardighet.result = null;

    // 2. Tear down renderad DOM som kan innehålla data
    // Behållare som fylls helt av JavaScript (Struktur, Löneöversyn, Utforska).
    // Vaktas av invarianten "Rensa all data: ingen lönedata kvar" i tests/smoke.test.js —
    // en ny vy som ritar lönedata utanför de rensade behållarna fångas där.
    // Hit hör också outliers-table-wrap (extremvärdesdetektorn) och print-report (utskriften med
    // kopior av tabellerna).
    RENSA_BEHALLARE.forEach(id => { const el = document.getElementById(id); if (el) el.innerHTML = ''; });
    RENSA_TABELLER.forEach(id => {
        const t = document.getElementById(id);
        if (t) { const tb = t.querySelector('tbody'); if (tb) tb.innerHTML = ''; }
    });
    // Diagram ritade med diagramkärnan (ADR-39) bär sin figur — med lönevärden — som egenskap på behållaren och
    // har lyssnare, storleksbevakning och ett verktygstips i sidans portal. De hittas genom ritarens register,
    // inte på id: också behållare utan "chart-"-id, i tomt läge eller som har lämnat dokumentet rensas.
    if (typeof sattDiagramMarkering === 'function') sattDiagramMarkering(null);   // markeringen namnger en grupp
    // Flikens topp (slutsatser och nyckeltal) namnger grupper och bär tal: den töms tillsammans med allt annat.
    // Urvalsraden i Ålder & karriär bär flikens BAS-väljare, som hör till sidan: där töms bara texten bredvid.
    document.querySelectorAll('.slutsatser, .urvalsrad:not(#ak-urval)').forEach(el => { el.innerHTML = ''; });
    { const t = document.getElementById('ak-urval-text'); if (t) t.textContent = ''; }
    document.querySelectorAll('.avsnitt-nyckel').forEach(el => { el.textContent = ''; el.classList.remove('ar-kritisk'); });
    if (typeof _rfRensaAlla === 'function') _rfRensaAlla();
    // Exportmenyerna har också id som börjar med chart- (chart-export-N): de är inte diagram och ska stå kvar.
    document.querySelectorAll('[id^="chart-"]:not(.chart-export-meny)').forEach(el => {
        el.innerHTML = '';
    });
    RENSA_OVRIGT
        .forEach(id => { const el = document.getElementById(id); if (el) el.innerHTML = ''; });
    // § 8-ställningens bedömningar (status + anteckning) — nollställ
    document.querySelectorAll('.bes8-field').forEach(el => { /** @type {HTMLInputElement} */ (el).value = ''; });
    if (typeof bes8Uppdatera === 'function') bes8Uppdatera();
    const dashSummary = document.getElementById('dashboard-summary');
    if (dashSummary) dashSummary.style.display = 'none';
    const ukPanel = document.getElementById('underlagets-kvalitet');
    if (ukPanel) { ukPanel.hidden = true; ukPanel.removeAttribute('data-status'); }
    const guKort = document.getElementById('gap-uppdelning');
    if (guKort) guKort.hidden = true;
    const pagKort = document.getElementById('personer-att-granska');
    if (pagKort) pagKort.hidden = true;
    const agKort = document.getElementById('att-gora');
    if (agKort) agKort.hidden = true;
    if (typeof ovRitaLage === 'function') ovRitaLage();   // Översikt blir åter en uppladdningssida
    ['underlagets-kvalitet-status','underlagets-kvalitet-rader'].forEach(id => { const el = document.getElementById(id); if (el) el.innerHTML = ''; });

    // 3. Återställ uppladdningsceller
    if (typeof resetUploadCell === 'function') {
        resetUploadCell('upload-cell-data',    'upload-cell required', 'Obligatorisk');
        resetUploadCell('upload-cell-policy',  'upload-cell optional', 'Valfritt');
        resetUploadCell('upload-cell-stat',    'upload-cell optional', 'Valfritt');
        resetUploadCell('upload-cell-history', 'upload-cell optional', 'Valfritt');
    }
    document.querySelectorAll('input[type="file"]').forEach(inp => { /** @type {HTMLInputElement} */ (inp).value = ''; });
    if (typeof renderReferensKort === 'function') renderReferensKort();
    ['data-status','policy-status','stat-status','config-status'].forEach(id => {
        const el = document.getElementById(id);
        if (el) { el.textContent = ''; el.className = 'status-msg'; el.innerHTML = ''; }
    });

    // 4. Lås tabbar
    ['tab-kon','tab-matrix','tab-prioritering','tab-loneoversyn','tab-struktur','tab-benchmark','tab-likvardighet','tab-utforska','tab-lonepolitik'].forEach(id => {
        const el = document.getElementById(id);
        if (el) { /** @type {HTMLInputElement} */ (el).disabled = true; el.setAttribute('title', 'Ladda upp strukturdata för att aktivera'); }
    });
    if (typeof _visaJamforelseFlik === 'function') _visaJamforelseFlik(false);
    state.filnamn = { data: null, policy: null, statistik: null };
    if (typeof renderFilrutor === 'function') renderFilrutor();
    if (typeof navigateTo === 'function') navigateTo('dashboard');

    updateGdprBanner();
    if (typeof updateCompliance === 'function') updateCompliance();
    announceToScreenReader('All data har raderats ur minnet.');
    // Organisationsfil: paketet är en del av filen och kommer tillbaka efter rensningen, som vid start.
    if (inbakat && typeof lasInInbakatPaket === 'function') lasInInbakatPaket();
}

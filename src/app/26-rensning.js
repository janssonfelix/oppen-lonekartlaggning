// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
import { K_STANDARD } from '../lib/ktroskel.js';
import { meddelaSkarmlasare } from './01-html-och-tillganglighet.js';
import { visaInterntFel } from './03-hjalpfunktioner.js';
import { navigeraTill } from './05-tabeller-och-lankar.js';
import { _kVisaFel, _synkaKTroskel } from './06-k-troskel.js';
import { tillampaProfiletiketter, COST_DEFAULTS, STANDARDPROFIL, INAKTIVITET_STANDARD_MIN, synkaNamnFalt } from './07-standardinstallningar.js';
import { _rfRensaAlla } from './10-diagramritare.js';
import { sattDiagramMarkering } from './11-markering.js';
import { aterstallReferens, nyPrognos, state } from './12-tillstand.js';
import { ovRitaLage, ritaKravstatus, skattningarSlapp } from './13-oversikt.js';
import { _fkSlapp, _fkVantar } from './17-forhandskontroll.js';
import { _ritaDemoruta } from './20-demodata-diagnostik.js';
import { visningNy } from './23-exportgrind.js';
import { _stangBevisruta } from './27-berakningsbevis.js';
import { uppdateraDataskyddsbesked } from './25-dataskyddsinfo.js';
import { sattInaktivitetstid } from './28-vad-lagras-inaktivitet.js';
import { _fyllPaketFormular, _synkaKostnadsfalt, _synkaOrgTyp, lasInInbakatPaket, ritaPaketinfo } from './29-organisationspaket.js';
import { ritaFilrutor, aterstallFilruta } from './32-filinlasning.js';
import { _fcGlomKnappresultat } from './36-loneoversyn.js';
import { _visaJamforelseFlik, ritaReferensKort } from './38-referensfiler.js';
import { rapportGlomHopfallning } from './39-loneoversikt.js';
import { laMinneSlapp } from './41-lika-arbete.js';
import { jamforelseSattVal } from './42-jamforelse.js';
import { _hpDemoNycklar, ritaHandlingsplan } from './56-handlingsplan.js';
import { stangSkalDialog } from './57-sakliga-skal.js';
import { _rmMinneSlapp } from './58-rapportmodell.js';
import { bes8Stod, bes8Uppdatera } from './61-regler-och-praxis.js';
import { utforskaSlappMinne, utforskaSynkaSmaLas } from './70-utforska.js';
import { stangGruppdossier } from './80-gruppdossier.js';
import { stangBasdossier } from './81-basdossier.js';

// ---- Rensa all data: lagringsminimering (art. 5.1 e, 25.2) ----
/**
 * Tömmer all in-memory data och tar ned all renderad UI som kan innehålla
 * personuppgifter. Användaren har samma effekt om de stänger fliken — denna
 * knapp gör rensningen till en explicit, dokumenterad åtgärd. Rätten till radering utövas mot källsystemet.
 */
export function rensaAllData() {
    const hasAny = state.data.length || state.policy.length || state.statistik.length || state.snapshot || state.paket || (state.importprofiler || []).length
        || _fkVantar || state.forhandskontroll;   // en fil som väntar på Läs in, eller förhandskontrollens tio rader
    if (!hasAny) {
        meddelaSkarmlasare('Ingen data finns i minnet att rensa.');
        return;
    }
    if (!confirm('All data försvinner ur minnet: lönefilen, ställningstagandet, statistiken, scenarierna och ögonblicksbilden. Det går inte att ångra. Vill du fortsätta?')) return;

    _rensaAllData();
}

// Behållare som fylls av JavaScript med innehåll som kan bära lönedata. Listorna används av "Rensa all data" och av
// exportgrinden (23-exportgrind.js), som tömmer flikar som inte längre är ritade med gällande tröskel.
export const RENSA_BEHALLARE = ['struktur-representation', 'struktur-distribution', 'struktur-eu', 'struktur-sektorer', 'forecast-outcome', 'explore-table',
    'outliers-table-wrap', 'print-report'];
export const RENSA_TABELLER = ['rapport-table', 'matrix-table', 'la-oversikt', 'pag-avvikelse-tabell', 'paygap-table', 'skevhet-table', 'benchmark-table', 'prio-table'];
export const RENSA_OVRIGT = ['action-checklist-container', 'outlier-list', 'data-validation-report', 'snapshot-comparison', 'consistency-banner', 'process-tracker', 'likvardighet-content', 'forklaringsmodell-panel', 'blinder-oaxaca-card', 'livscykel-content', 'lonepolitik-content', 'ref-overblick', 'jmf-slutsatser', 'robusthet-body', 'fardigcheck-body', 'rapportunderlag-innehall', 'gap-uppdelning-innehall', 'pag-innehall', 'att-gora-borja', 'aidbas-lika', 'aidbas-individ', 'aidbas-likvardigt', 'aidbas-hierarki', 'ut-alla-grupper',
    'forecast-threshold-result', 'forecast-sensitivity', 'forecast-rem-result',   // Löneöversyns knappresultat
    'dossier-body', 'basdossier-body', 'evidence-modal-content', 'skal-body'];   // dialogerna med gruppens tal

/**
 * Själva rensningen, utan bekräftelsefråga. Enda rensningsvägen: används av
 * knappen "Rensa all data" och av den automatiska rensningen vid inaktivitet,
 * så att de aldrig kan glida isär. Vaktas av invarianten "Rensa all data: ingen
 * lönedata kvar" i tests/dataskydd-app.test.js, för båda vägarna.
 */
export function _rensaAllData({ inbakat = true } = {}) {
    visningNy();   // också rensningen efter en tid utan aktivitet: ingen ritad flik visas igen (ADR-81)
    laMinneSlapp();   // minnet håller en referens till dataraderna
    _rmMinneSlapp();   // förhandsbeskedets minne (58-rapportmodell.js)
    // 0. Utforska håller egna referenser till raderna (senaste modellen,
    //    urvalets värdelistor, diagrammets exportfunktion) — släpp dem också,
    //    annars finns hela underlaget kvar i minnet efter rensningen.
    utforskaSlappMinne();
    rapportGlomHopfallning();

    // 1. Nolla state-objektet
    state.data = [];
    state.kTroskel = K_STANDARD;      // ADR-38: tillbaka till standard
    state.lonemanad = '';             // lönemånaden hör till underlaget
    // Organisationspaketets låsningar (ADR-47) följer med paketet; en låst rensningstid går tillbaka till standard.
    const inaktivitetVarLast = state.paketLas.inaktivitetMin != null;
    state.paketLas = { kTroskelLagst: null, inaktivitetMin: null, smaGrupperIExport: true };
    if (inaktivitetVarLast) sattInaktivitetstid(INAKTIVITET_STANDARD_MIN);
    utforskaSynkaSmaLas();
    _kVisaFel('');   // ett felmeddelande vid fältet hör till det rensade läget
    _synkaKTroskel();
    aterstallReferens();   // ADR-28: ingen referens (ingen inbyggd)
    state.profile = { ...STANDARDPROFIL };   // neutral profil (demoläget och paket sätter en egen)
    tillampaProfiletiketter();
    _synkaOrgTyp();
    synkaNamnFalt();
    jamforelseSattVal({ bas: '', sektor: '' });
    // Organisationspaketet (ADR-28): grundinställningarna kom ur paketet — tillbaka till standard.
    if (state.paket) state.costSettings = { ...state.costSettings, poPct: COST_DEFAULTS.poPct, months: COST_DEFAULTS.months };
    state.paket = null;
    state.statistikNamn = null;
    state.statistikKalla = null;
    state.statistikHasP10 = false;
    state.statistikHasP90 = false;
    state.statistikHasKon = false;
    _synkaKostnadsfalt();
    ritaPaketinfo();
    const paketStatus = document.getElementById('paket-status');
    if (paketStatus) { paketStatus.textContent = ''; paketStatus.className = 'status-msg'; }
    _fyllPaketFormular();
    state.statistik = [];
    state.isDemo = false;   // lämna demoläge
    state.demoStort = false;
    _ritaDemoruta();
    state._interntFel = [];   // interna fel gällde det rensade underlaget
    visaInterntFel();
    state._lastStructureFile = null;   // släpp filreferensen (GDPR: inget kvar i RAM)
    state.arbetsvardering = null;
    state.columnMap = null;
    // Importprofilerna: konfigurationsfilens tas bort, och paketets följer paketet ut (state.paket ovan). I en
    // organisationsfil kommer det inbakade paketets profiler tillbaka med paketet sist i rensningen.
    state.importprofiler = [];
    state.importprofil = null;
    _fkSlapp();   // förhandskontrollen och en fil som väntar på Läs in
    state.ansvarKolumn = null;
    state._dataHeaders = [];
    state.scenarios = [];
    state.snapshot = null;
    state.forraArsbokslut = null;
    state.dataAudit = null;
    state.bristAids = new Set();
    state.rapportUrval = null;
    state.utkastPerBas = true;
    state.rapportTabeller = [];
    state.perBasRecept = null;
    state.forklaringsmodell = null;
    state.gapUppdelning = null;
    state.forecast = nyPrognos();
    _fcGlomKnappresultat();   // knappresultaten räknas inte om på nästa underlag
    // Beräkningscacherna bär spår av lönefördelningarna (konfidensintervall, minsta detekterbara skillnad).
    state.bootstrapCI = null;
    state.powerAnalysis = null;
    skattningarSlapp();   // skattningarna vid andra golv (ADR-103)
    if (state.likvardighet) state.likvardighet.result = null;

    // 2. Töm det ritade som kan bära lönedata
    // Dialogerna med en grupps tal stängs först: en öppen dossier får inte stå kvar på skärmen efter rensningen vid
    // inaktivitet. Innehållet töms med RENSA_OVRIGT nedan.
    for (const stang of [stangGruppdossier, stangBasdossier, _stangBevisruta, stangSkalDialog]) stang();
    // Behållare som fylls helt av JavaScript (Struktur, Löneöversyn, Utforska).
    // Vaktas av invarianten "Rensa all data: ingen lönedata kvar" i tests/dataskydd-app.test.js —
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
    sattDiagramMarkering(null);   // markeringen namnger en grupp
    // Flikens topp (slutsatser och nyckeltal) namnger grupper och bär tal: den töms tillsammans med allt annat.
    // Urvalsraden i Ålder & karriär bär flikens BAS-väljare, som hör till sidan: där töms bara texten bredvid.
    document.querySelectorAll('.slutsatser, .urvalsrad:not(#ak-urval)').forEach(el => { el.innerHTML = ''; });
    { const t = document.getElementById('ak-urval-text'); if (t) t.textContent = ''; }
    document.querySelectorAll('.avsnitt-nyckel').forEach(el => { el.textContent = ''; el.classList.remove('ar-kritisk', 'ar-granska'); });
    _rfRensaAlla();
    // Exportmenyerna har också id som börjar med chart- (chart-export-N): de är inte diagram och ska stå kvar.
    document.querySelectorAll('[id^="chart-"]:not(.chart-export-meny)').forEach(el => {
        el.innerHTML = '';
    });
    RENSA_OVRIGT
        .forEach(id => { const el = document.getElementById(id); if (el) el.innerHTML = ''; });
    // § 8-ställningens bedömningar (status + anteckning) — nollställ
    document.querySelectorAll('.bes8-field').forEach(el => { /** @type {HTMLInputElement} */ (el).value = ''; });
    bes8Uppdatera();
    bes8Stod();
    // Handlingsplanens ifyllda fält (sakligt skäl, ansvarig, tidsplan, status) — nollställ och rita mallen tom
    state.handlingsplan = {};
    if (typeof _hpDemoNycklar !== 'undefined') _hpDemoNycklar.clear();
    ritaHandlingsplan();
    // Rapporttextens utkast bär fynden i klarspråk, också ett redigerat: det töms och markeringen tas bort.
    const utkast = document.getElementById('struktur-narrative');
    if (utkast) { /** @type {HTMLTextAreaElement} */ (utkast).value = ''; delete utkast.dataset.dirty; }
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
    // Löneläget, Överblick: bandkartans och statistikspannets kort (diagrammen är redan rensade ovan).
    for (const id of ['lp-bandkarta-kort', 'jmf-statlage-kort']) { const kort = document.getElementById(id); if (kort) kort.hidden = true; }
    { const t = document.getElementById('lp-bandkarta-forklaring'); if (t) t.textContent = ''; }
    ovRitaLage();   // Översikt blir åter en uppladdningssida
    ['underlagets-kvalitet-status','underlagets-kvalitet-rader'].forEach(id => { const el = document.getElementById(id); if (el) el.innerHTML = ''; });

    // 3. Återställ uppladdningsceller
    aterstallFilruta('upload-cell-data',    'upload-cell required', 'Obligatorisk');
    aterstallFilruta('upload-cell-policy',  'upload-cell optional', 'Valfritt');
    aterstallFilruta('upload-cell-stat',    'upload-cell optional', 'Valfritt');
    aterstallFilruta('upload-cell-history', 'upload-cell optional', 'Valfritt');
    document.querySelectorAll('input[type="file"]').forEach(inp => { /** @type {HTMLInputElement} */ (inp).value = ''; });
    ritaReferensKort();
    ['data-status','policy-status','stat-status','config-status'].forEach(id => {
        const el = document.getElementById(id);
        if (el) { el.textContent = ''; el.className = 'status-msg'; el.innerHTML = ''; }
    });

    // 4. Lås tabbar
    ['tab-kon','tab-matrix','tab-prioritering','tab-loneoversyn','tab-struktur','tab-benchmark','tab-likvardighet','tab-utforska','tab-rapporttext'].forEach(id => {
        const el = document.getElementById(id);
        if (el) { /** @type {HTMLInputElement} */ (el).disabled = true; el.setAttribute('title', 'Läs in lönefilen för att öppna fliken'); }
    });
    _visaJamforelseFlik(false);
    state.filnamn = { data: null, policy: null, statistik: null };
    ritaFilrutor();
    navigeraTill('dashboard');

    uppdateraDataskyddsbesked();
    ritaKravstatus();
    meddelaSkarmlasare('All data har raderats ur minnet.');
    // Organisationsfil: paketet är en del av filen och kommer tillbaka efter rensningen, som vid start.
    if (inbakat) lasInInbakatPaket();
    visningNy();   // och det som ritades under rensningen visas inte igen heller
}

// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
import { _sdStallningstagande, demodiagnostik, genereraDemodata, genereraStortDemoStatistik } from '../lib/demodata.js';
import { svTal } from '../lib/talformat.js';
import { esc } from './01-html-och-tillganglighet.js';
import { rapporteraFel } from './03-hjalpfunktioner.js';
import { ikon } from './03-ikoner.js';
import { kInstalld } from './06-k-troskel.js';
import { tillampaProfiletiketter, synkaNamnFalt } from './07-standardinstallningar.js';
import { T } from './09-termer.js';
import { _rfUrvalGlom } from './10-diagramritare.js';
import { getBasIntervals, state } from './12-tillstand.js';
import { bedomningUnderlag, populateSelects, renderProcessTracker, renderUnderlagetsKvalitet, UK_ETIKETT, ritaKravstatus, ritaNyckeltal } from './13-oversikt.js';
import { renderOutliers } from './15-extremvarden-basrang.js';
import { renderConsistencyBanner, renderDataValidationReport, syncDatakvalitetPanel } from './16-inlasningskontroll.js';
import { _fkSlapp } from './17-forhandskontroll.js';
import { renderActionChecklist } from './18-atgardslista.js';
import { STORT_DEMO_STATISTIKNAMN } from './21-stort-demo.js';
import { visningNy } from './23-exportgrind.js';
import { updateGdprBanner } from './25-dataskyddsinfo.js';
import { _rensaAllData, clearAllData } from './26-rensning.js';
import { _synkaOrgTyp, _tomStatistik } from './29-organisationspaket.js';
import { unlockTabs } from './31-navigering.js';
import { _deriveArbetsvarderingFromData, markUploadLoaded } from './32-filinlasning.js';
import { _fcGlomKnappresultat } from './36-loneoversyn.js';
import { renderReferensKort, synkaJamforelseFlik } from './38-referensfiler.js';
import { ritaLoneoversikt } from './39-loneoversikt.js';
import { ritaAlderOchLon } from './40-alder-karriar.js';
import { lsBasVymodell, ritaLoneskillnadPerBas } from './41-lika-arbete.js';
import { _formatPValue, runOLSRegression } from './51-lika-arbete-regressionskort.js';
import { _hpDemoSkal } from './56-handlingsplan.js';

// ---- #16 Testdata + självdiagnostik ----
// genereraTestdata och genereraDemodata står i src/lib/demodata.js; appen importerar dem.

// Reglerna står i demodiagnostik (src/lib/demodata.js); här läses tillståndet och orden.
function runDiagnostics() {
    const reg = runOLSRegression();
    return demodiagnostik({ rader: state.data, reg, underlag: bedomningUnderlag({ reg }), antalBas: getBasIntervals().length },   // regressionen skickas vidare (ADR-17)
        { nivaFl: T.niva.fl, underlagEtikett: s => UK_ETIKETT[s], pText: _formatPValue });
}

// Demolägets påhittade organisation och ställningstagande (ADR-28). Bara i demoläget;
// försvinner med rensningen. Siffrorna är påhittade och speglar ingen verklig organisation.
// Nivåerna följer demolönerna (ca 30 000 kr i BAS A och 5 000 kr per intervall), så att
// några grupper hamnar under ställningstagandet och Prioritering och Lönepolitik har
// något att visa.
const DEMO_ORGANISATION = 'Exempelkommunen';
const DEMO_REFERENS = Object.freeze({
    namn: 'Exempelkommunens lönepolitik',
    rader: Object.freeze(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'].map((bas, i) => {
        const med = 31000 + i * 5000;
        return Object.freeze({ aid: null, bas, p10: Math.round(med * 0.9 / 100) * 100, med, p90: Math.round(med * 1.12 / 100) * 100 });
    })),
});
// Det stora demot (21-stort-demo.js) räknar sitt ställningstagande ur sina egna löner, BAS A–K.
function _lasInDemoReferens({ stort = false } = {}) {
    state.policy = (stort ? _sdStallningstagande(state.data, kInstalld()) : DEMO_REFERENS.rader).map(r => ({ ...r }));
    state.policyNamn = DEMO_REFERENS.namn;
    state.policyKortnamn = DEMO_REFERENS.namn;
    state.policyKalla = 'demo';
    state.profile = { ...state.profile, name: DEMO_ORGANISATION, orgTyp: 'kommun' };
    if (typeof _synkaOrgTyp === 'function') _synkaOrgTyp();
    if (typeof synkaNamnFalt === 'function') synkaNamnFalt();
    if (typeof tillampaProfiletiketter === 'function') tillampaProfiletiketter();
    if (typeof renderReferensKort === 'function') renderReferensKort();
    if (typeof markUploadLoaded === 'function') markUploadLoaded('upload-cell-policy', 'Demo');
}
// Det stora demots påhittade jämförelsestatistik (21-stort-demo.js). Det lilla demot har ingen: en kvarvarande från
// det stora tas bort.
function _lasInDemoStatistik({ stort = false } = {}) {
    if (stort) {
        state.statistik = genereraStortDemoStatistik();
        state.statistikNamn = STORT_DEMO_STATISTIKNAMN;
        state.statistikKalla = 'demo';
        state.statistikHasP10 = state.statistikHasP90 = state.statistikHasKon = true;
        markUploadLoaded('upload-cell-stat', 'Demo');
    } else if (state.statistikKalla === 'demo') {
        _tomStatistik();
    }
    if (state.likvardighet) state.likvardighet.result = null;   // likvärdighetsparen jämförs mot statistiken
    if (typeof synkaJamforelseFlik === 'function') synkaJamforelseFlik();
}

// Det som det lilla och det stora demot (21-stort-demo.js) gör lika: frågan om befintlig data, rensningen av verkliga
// delar, underlaget, demoläget, referensen och ritningen av Översikt och Filer och kvalitet. Bannern ritar anroparen sist.
// Ger false om användaren avbröt.
export function _lasInDemounderlag(skapa, { stort = false } = {}) {
    if ((state.data.length || state.paket) && !confirm('Lönefilen du har läst in ersätts. Vill du fortsätta?')) return false;
    // Demot blandas aldrig med verkliga delar (ett organisationspaket, egen referens eller statistik).
    // Demots egen statistik (statistikKalla 'demo') är ingen verklig del: den ersätts eller tas bort nedan.
    if (state.paket || state.policyKalla === 'fil' || state.policyKalla === 'paket' || (state.statistik.length && state.statistikKalla !== 'demo')) _rensaAllData({ inbakat: false });
    if (typeof _rfUrvalGlom === 'function') _rfUrvalGlom();   // urvalet i diagrammen hör till det förra underlaget, som vid en ny lönefil
    state.data = skapa();
    if (typeof _fcGlomKnappresultat === 'function') _fcGlomKnappresultat();   // Löneöversyns knappresultat gällde det förra underlaget
    state.importprofil = null;   // demodatan läses inte ur en fil: ingen känd uppsättning
    _fkSlapp();   // inte heller någon förhandskontroll, och en fil som väntade på Läs in släpps
    state.data.forEach((r, i) => { r.radnr = i + 2; });   // som en fil med rubrik på rad 1
    _deriveArbetsvarderingFromData();   // demodata saknar poäng → rensar ev. kvarvarande
    state.ansvarKolumn = { namn: 'Ansvarskod (demo)', godkand: true, giltiga: 1 };
    state.isDemo = true;   // #9: markera som demoläge — syntetisk data, aldrig verklig analys
    state.demoStort = stort;   // bannern och filraden säger vilket demo det är
    _lasInDemoReferens({ stort });   // demot är självständigt; rensningen tar bort referensen igen
    _lasInDemoStatistik({ stort });
    state.dataAudit = { totalRaw: state.data.length, excludedNoBas: 0, excludedZeroLon: 0 };
    /** @type {HTMLElement} */ (document.getElementById("dashboard-summary")).style.display = "grid";
    unlockTabs();
    ritaNyckeltal();
    populateSelects();
    ritaLoneoversikt();
    ritaLoneskillnadPerBas(lsBasVymodell());
    ritaAlderOchLon('__ALLA__');
    ritaKravstatus();
    const reg = runOLSRegression();   // en gång i det här varvet, skickas vidare (ADR-17: ett värde, ingen cache)
    renderUnderlagetsKvalitet({ reg });
    updateGdprBanner();
    renderConsistencyBanner();
    renderActionChecklist({ reg });
    renderOutliers();
    renderDataValidationReport();
    syncDatakvalitetPanel({ reg });
    renderProcessTracker({ reg });
    const status = stort ? `Syntetisk testdata, stort demo: ${svTal(state.data.length)} personer` : `Syntetisk testdata: ${state.data.length} personer`;
    /** @type {HTMLElement} */ (document.getElementById('data-status')).innerHTML = `<span class="farg-info">${ikon('sok')} ${status}</span>`;
    /** @type {HTMLElement} */ (document.getElementById('data-status')).className = 'status-msg';
    markUploadLoaded('upload-cell-data', 'Testdata');
    // Exempel på sakliga skäl på tre rader i handlingsplanen, så att tabellerna i rapporten och Excel syns.
    if (typeof _hpDemoSkal === 'function') try { _hpDemoSkal(); } catch (e) { rapporteraFel('Demot: sakliga skäl', e); }
    visningNy();   // ett nytt underlag: ingen ritad flik visas igen som den är (ADR-81)
    return true;
}

export function loadDemoData() {
    if (!_lasInDemounderlag(genereraDemodata)) return;

    // Kör diagnostik
    const tests = runDiagnostics();
    const passCount = tests.filter(t => t.pass).length;
    const failCount = tests.length - passCount;
    const wrap = /** @type {HTMLElement} */ (document.getElementById('diagnostic-results'));
    wrap.style.display = 'block';
    wrap.innerHTML = `
        <div class="bak-white ram-1-kant rund-8 pad-14-16">
            <h3 class="underrubrik">
                Diagnostik-resultat: ${failCount === 0 ? `<span class="farg-ok">${ikon('bock')} Alla tester lyckades</span>` : `<span class="f-kritisk">${ikon('stopp')} ${failCount} av ${tests.length} tester misslyckades</span>`}
            </h3>
            <table class="data-table st-088">
                <thead><tr><th>Test</th><th>Förväntat</th><th>Faktiskt</th><th>Status</th></tr></thead>
                <tbody>
                    ${tests.map(t => `
                        <tr>
                            <td>${esc(t.name)}</td>
                            <td class="f-dampad">${esc(t.expected)}</td>
                            <td class="tabelltal fw-600">${esc(t.actual)}</td>
                            <td>${t.pass ? `<span class="farg-ok">${ikon('bock')} Godkänt</span>` : `<span class="f-kritisk">${ikon('stopp')} Underkänt</span>`}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
            <p class="text-dampad-xs marg-t-8">Testdatan har 200 personer fördelade jämnt mellan kön. Modellen är konstruerad så att en oförklarad skillnad på ungefär −3 % ska finnas kvar efter kontroll för ålder och BAS. Kvinnor är i snitt yngre och tenderar att placeras i lägre BAS, vilket ger en större rå löneskillnad som delvis förklaras av strukturen.</p>
        </div>
    `;
    _renderDemoBanner();
}

// #9 Demo-/utbildningsläge: visa/dölj en tydlig banner så syntetisk demodata
// aldrig förväxlas med verklig analys. Banner-elementet finns i index.html.
// Döljer även första-intryck-hinten när data finns (anropas i alla data-lägesbyten).
export function _renderDemoBanner() {
    const b = document.getElementById('demo-mode-banner');
    if (b) b.style.display = state.isDemo ? 'flex' : 'none';
    // Det stora demot säger det i bannern; det lilla har kvar sin text.
    const storlek = document.getElementById('demo-mode-storlek');
    if (storlek) storlek.textContent = state.isDemo && state.demoStort ? ` (stort demo, ${svTal(state.data.length)} personer)` : '';
    // Demovalen i lönefilskortet: borta när en riktig lönefil är inläst, kvar i demoläget (byt mellan litet och stort).
    const val = document.getElementById('upload-demo-val');
    if (val) val.hidden = state.data.length > 0 && !state.isDemo;
    const h = document.getElementById('first-run-hint');
    if (h) h.style.display = state.data.length ? 'none' : '';
    // #5 Export-hubben är bara meningsfull när det finns data att exportera
    const hub = document.getElementById('export-hub');
    if (hub) hub.style.display = state.data.length ? 'block' : 'none';   // 'block', inte '': klassen .dold i markeringen döljer annars kortet
}

/** Det som körs vid laddning, i filens ordning; src/app/index.js anropar delarnas uppstart i sifferordning. */
export function uppstartDemodataDiagnostik() {
    // #9: samma demoladdning nås från självdiagnostiken, den synliga "Prova"-knappen
    // OCH länken i första-intryck-hinten.
    // Lönefilskortet i Filer och kvalitet har samma val (upload-demo-litet; det stora demot i 21-stort-demo.js).
    ['btn-test-load', 'first-run-demo-link', 'upload-demo-litet'].forEach(id =>
        document.getElementById(id)?.addEventListener('click', loadDemoData));
    document.getElementById('btn-exit-demo')?.addEventListener('click', clearAllData);
}

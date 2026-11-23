// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson

// ---- #16 Testdata + självdiagnostik ----
// genereraTestdata och genereraDemodata står i src/lib/demodata.js; appen når dem genom spegeln.

function runDiagnostics() {
    const tests = [];

    // Test 1: råa gapet ska vara märkbart negativt (kvinnor yngre + lägre BAS = lägre lön)
    const rawGap = _stKonsMedianer(state.data).gapPct;   // diagnostik på demodata: ingen tröskel (k = 1)
    tests.push({
        name: 'Den råa löneskillnaden är negativ (kvinnor lägre lön)',
        expected: '< -3%',
        actual: svPct(rawGap, 2),
        pass: rawGap != null && rawGap < -3
    });

    // Test 2: oförklarat gap (efter ålder + BAS) ska vara nära den injicerade -3%-effekten
    const reg = runOLSRegression();
    if (!reg.error) {
        tests.push({
            name: 'Oförklarad skillnad nära −3 % (inlagd könseffekt)',
            expected: '-1% till -5%',
            actual: svPct(reg.konPct, 2),
            pass: reg.konPct > -5 && reg.konPct < -1
        });
        tests.push({
            name: 'Oförklarad skillnad är statistiskt signifikant (p < 0,05)',
            expected: 'p < 0,05',
            actual: _formatPValue(reg.pValue),
            pass: reg.pValue < 0.05
        });
        // BAS-effekt ska finnas: nivån i högsta BAS mot referensen, utslagen per bokstavssteg
        if (reg.basEffekter && reg.basEffekter.length) {
            const sista = reg.basEffekter[reg.basEffekter.length - 1];
            const rang = _lvBasRangFn(reg.basList);
            const steg = rang(sista.bas) - rang(reg.basRef);
            const perSteg = (Math.exp(Math.log(1 + sista.pct / 100) / steg) - 1) * 100;
            tests.push({
                name: 'BAS-effekt är signifikant positiv (~10-15% per steg)',
                expected: '+5% till +25% per steg',
                actual: svPct(perSteg, 2) + ` (BAS ${sista.bas} mot ${reg.basRef}: ${svPct(sista.pct, 1)})`,
                pass: perSteg > 5 && perSteg < 25
            });
        }
        tests.push({
            name: 'R² > 30% (modellen förklarar betydande andel av lönerna)',
            expected: 'R² > 0.30',
            actual: svPct(reg.R2 * 100, 2),
            pass: reg.R2 > 0.30
        });
    } else {
        tests.push({ name: 'Regression kunde estimeras', expected: 'OK', actual: 'Fel: ' + reg.error, pass: false });
    }

    // Test 3: Underlagets kvalitet får inte vara kritisk för testdatan
    const dq = bedomningUnderlag({ reg });   // regressionen ovan skickas vidare (ADR-17)
    if (dq) {
        tests.push({
            name: 'Underlagets kvalitet är inte kritisk (testdata)',
            expected: 'OK eller Varning',
            actual: UK_ETIKETT[dq.status],
            pass: dq.status !== 'kritisk'
        });
    }

    // Test 4: BAS-intervall korrekt antal
    tests.push({
        name: `Antal unika ${T.niva.fl} = 5 (testdatan har A–E)`,
        expected: '5',
        actual: getBasIntervals().length.toString(),
        pass: getBasIntervals().length === 5
    });

    return tests;
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
    if (typeof applyProfileLabels === 'function') applyProfileLabels();
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
function _lasInDemounderlag(skapa, { stort = false } = {}) {
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
    updateDashboardStats();
    populateSelects();
    generateRapport();
    generateSkevhet();
    renderKon('__ALLA__');
    updateCompliance();
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

function loadDemoData() {
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
// #9: samma demoladdning nås från självdiagnostiken, den synliga "Prova"-knappen
// OCH länken i första-intryck-hinten.
// Lönefilskortet i Filer och kvalitet har samma val (upload-demo-litet; det stora demot i 21-stort-demo.js).
['btn-test-load', 'first-run-demo-link', 'upload-demo-litet'].forEach(id =>
    document.getElementById(id)?.addEventListener('click', loadDemoData));
document.getElementById('btn-exit-demo')?.addEventListener('click', clearAllData);

// #9 Demo-/utbildningsläge: visa/dölj en tydlig banner så syntetisk demodata
// aldrig förväxlas med verklig analys. Banner-elementet finns i index.html.
// Döljer även första-intryck-hinten när data finns (anropas i alla data-lägesbyten).
function _renderDemoBanner() {
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

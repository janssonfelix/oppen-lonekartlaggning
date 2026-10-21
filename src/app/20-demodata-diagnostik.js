// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson

// ---- #16 Testdata + självdiagnostik ----
function generateTestData() {
    // Syntetisk dataset: 200 personer, 5 BAS (A-E), känd struktur:
    // - Lön = 30000 + BAS_rank*5000 + age_centered*200 + random_noise
    // - Kön-effekt: kvinnor får -3% justerad lön (oförklarat gap = ~3%)
    // - Naturligt råa gapet ca -8% pga att kvinnor är yngre i snitt
    const data = [];
    const basList = ['A','B','C','D','E'];
    const aidList = ['402010 Förskollärare', '207024 Vårdbiträde', '502010 Systemutvecklare', '401011 Lärare grundskola', '206017 Sjuksköterska'];
    let seed = 42;
    const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
    const rndNorm = () => { let u = 0, v = 0; while(u === 0) u = rnd(); while(v === 0) v = rnd(); return Math.sqrt(-2*Math.log(u)) * Math.cos(2*Math.PI*v); };
    for (let i = 0; i < 200; i++) {
        const isKvinna = i < 100; // 50/50
        // Kvinnor är i snitt något yngre + tenderar att hamna i lägre BAS
        const baseAge = isKvinna ? 38 : 44;
        const alder = Math.max(22, Math.min(65, Math.round(baseAge + rndNorm() * 8)));
        const basRank = isKvinna
            ? Math.max(0, Math.min(4, Math.round(1.5 + rndNorm() * 1.2)))
            : Math.max(0, Math.min(4, Math.round(2.5 + rndNorm() * 1.2)));
        const bas = basList[basRank];
        const yrke = aidList[basRank];
        // Lön: baseras på BAS + ålder + ev kön-bias
        const baseLon = 30000 + basRank * 5000 + (alder - 40) * 250;
        const konPenalty = isKvinna ? -baseLon * 0.03 : 0; // -3% för kvinnor
        const noise = rndNorm() * 1500;
        const lon = Math.round(baseLon + konPenalty + noise);
        data.push({
            bas, yrke,
            lon: Math.max(20000, lon),
            alder,
            kon: isKvinna ? 'kvinna' : 'man'
        });
        // Ett slumptal per person dras och används inte: testdatan — och självdiagnostikens
        // förväntade värden — bygger på den dragningsföljden.
        rnd();
    }
    return data;
}

function runDiagnostics() {
    const tests = [];

    // Test 1: råa gapet ska vara märkbart negativt (kvinnor yngre + lägre BAS = lägre lön)
    const kv = state.data.filter(r => r.kon.includes('kvinna'));
    const ma = state.data.filter(r => r.kon === 'man' || r.kon === 'män');
    const rawGap = (Stat.median(kv.map(r=>r.lon)) / Stat.median(ma.map(r=>r.lon)) - 1) * 100;
    tests.push({
        name: 'Råa lönegapet är negativt (kvinnor lägre lön)',
        expected: '< -3%',
        actual: svPct(rawGap, 2),
        pass: rawGap < -3
    });

    // Test 2: oförklarat gap (efter ålder + BAS) ska vara nära den injicerade -3%-effekten
    const reg = runOLSRegression();
    if (!reg.error) {
        tests.push({
            name: 'Oförklarat gap nära -3% (injicerad kön-effekt)',
            expected: '-1% till -5%',
            actual: svPct(reg.konPct, 2),
            pass: reg.konPct > -5 && reg.konPct < -1
        });
        tests.push({
            name: 'Oförklarat gap är statistiskt signifikant (p < 0,05)',
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
    const dq = bedomningUnderlag();
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
        name: 'Antal unika BAS-intervall = 5 (testdatan har A–E)',
        expected: '5',
        actual: getBasIntervals().length.toString(),
        pass: getBasIntervals().length === 5
    });

    return tests;
}

// Demodata ("Prova med demodata"): självdiagnostikens 200 personer med AID och
// yrkesnamn, plus tre yrken i BAS C som ger kandidatpar i likvärdigt arbete — två
// kvinnodominerade yrken med lägre lön än ett mansdominerat på samma nivå.
// generateTestData() lämnas orörd: självdiagnostiken bygger på dess kända egenskaper.
function generateDemoData() {
    const data = generateTestData().map(r => ({
        ...r, aid: r.yrke.split(' ')[0], yrkeLabel: r.yrke.replace(/^\d+\s*/, '')
    }));
    const lagg = (yrke, n, kvinnor, grundlon) => {
        for (let i = 0; i < n; i++) {
            const alder = 26 + ((i * 7) % 34);
            data.push({
                bas: 'C', yrke, aid: yrke.split(' ')[0], yrkeLabel: yrke.replace(/^\d+\s*/, ''),
                lon: Math.round(grundlon + (alder - 40) * 150 + ((i * 37) % 11 - 5) * 120),
                alder, kon: i < kvinnor ? 'kvinna' : 'man'
            });
        }
    };
    lagg('403010 Barnskötare', 20, 18, 36500);    // 90 % kvinnor
    lagg('207011 Undersköterska', 20, 17, 37500); // 85 % kvinnor
    lagg('503012 Drifttekniker', 20, 3, 42500);   // 15 % kvinnor
    // Ansvarskod (AID): var 15:e man och var 30:e kvinna har ledningsansvar, var 30:e person
    // ett särskilt uppdrag och var 15:e lärare är förstelärare. Påverkar inte lönerna.
    const raknare = { kvinna: 0, man: 0 };
    let larare = 0;
    data.forEach((r, i) => {
        const nr = ++raknare[r.kon];
        let koder = [];
        if ((r.kon === 'man' && nr % 15 === 0) || (r.kon === 'kvinna' && nr % 30 === 0)) koder = ['C'];
        else if (r.aid === '401011' && ++larare % 15 === 0) koder = ['1002'];
        else if ((i + 1) % 30 === 0) koder = ['F'];
        r.ansvarskoder = koder;
        r.ansvarsgrupp = _anGrupp(koder);
    });
    return data;
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
function _lasInDemoReferens() {
    state.policy = DEMO_REFERENS.rader.map(r => ({ ...r }));
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

function loadDemoData() {
    if ((state.data.length || state.paket) && !confirm('Detta ersätter befintlig data i sessionen. Fortsätt?')) return;
    // Demot blandas aldrig med verkliga delar (ett organisationspaket, egen referens eller statistik).
    if (state.paket || state.policyKalla === 'fil' || state.policyKalla === 'paket' || state.statistik.length) _rensaAllData({ inbakat: false });
    state.data = generateDemoData();
    state.data.forEach((r, i) => { r.radnr = i + 2; });   // som en fil med rubrik på rad 1
    _deriveArbetsvarderingFromData();   // demodata saknar poäng → rensar ev. kvarvarande
    state.ansvarKolumn = { namn: 'Ansvarskod (demo)', godkand: true, giltiga: 1 };
    state.isDemo = true;   // #9: markera som demoläge — syntetisk data, aldrig verklig analys
    _lasInDemoReferens();   // demot är självständigt; rensningen tar bort referensen igen
    state.dataAudit = { totalRaw: state.data.length, excludedNoBas: 0, excludedZeroLon: 0 };
    /** @type {HTMLElement} */ (document.getElementById("dashboard-summary")).style.display = "grid";
    unlockTabs();
    updateDashboardStats();
    populateSelects();
    generateRapport();
    generateSkevhet();
    renderKon('__ALLA__');
    updateCompliance();
    renderUnderlagetsKvalitet();
    updateGdprBanner();
    renderConsistencyBanner();
    renderActionChecklist();
    renderOutliers();
    renderRealityCheck();
    renderDataValidationReport();
    syncDatakvalitetPanel();
    renderProcessTracker();
    /** @type {HTMLElement} */ (document.getElementById('data-status')).innerHTML = `<span class="farg-info">${ikon('sok')} Syntetisk testdata: ${state.data.length} personer</span>`;
    /** @type {HTMLElement} */ (document.getElementById('data-status')).className = 'status-msg';
    markUploadLoaded('upload-cell-data', 'Testdata');

    // Kör diagnostik
    const tests = runDiagnostics();
    const passCount = tests.filter(t => t.pass).length;
    const failCount = tests.length - passCount;
    const wrap = /** @type {HTMLElement} */ (document.getElementById('diagnostic-results'));
    wrap.style.display = 'block';
    wrap.innerHTML = `
        <div class="bak-white ram-1-kant rund-8 pad-14-16">
            <h4 class="underrubrik">
                Diagnostik-resultat: ${failCount === 0 ? `<span class="farg-ok">${ikon('bock')} Alla tester lyckades</span>` : `<span class="f-kritisk">${ikon('stopp')} ${failCount} av ${tests.length} tester misslyckades</span>`}
            </h4>
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
            <p class="text-dampad-xs marg-t-8">Testdatan har 200 personer fördelade jämnt mellan kön. Modellen är konstruerad så att ett oförklarat gap på ~−3% ska kvarstå efter kontroll för ålder och BAS. Kvinnor är i snitt yngre och tenderar att placeras i lägre BAS, vilket ger ett större råa gap som delvis förklaras strukturellt.</p>
        </div>
    `;
    _renderDemoBanner();
}
// #9: samma demoladdning nås från självdiagnostiken, den synliga "Prova"-knappen
// OCH länken i första-intryck-hinten.
['btn-test-load', 'first-run-demo-link'].forEach(id =>
    document.getElementById(id)?.addEventListener('click', loadDemoData));
document.getElementById('btn-exit-demo')?.addEventListener('click', clearAllData);

// #9 Demo-/utbildningsläge: visa/dölj en tydlig banner så syntetisk demodata
// aldrig förväxlas med verklig analys. Banner-elementet finns i index.html.
// Döljer även första-intryck-hinten när data finns (anropas i alla data-lägesbyten).
function _renderDemoBanner() {
    const b = document.getElementById('demo-mode-banner');
    if (b) b.style.display = state.isDemo ? 'flex' : 'none';
    const h = document.getElementById('first-run-hint');
    if (h) h.style.display = state.data.length ? 'none' : '';
    // #5 Export-hubben är bara meningsfull när det finns data att exportera
    const hub = document.getElementById('export-hub');
    if (hub) hub.style.display = state.data.length ? 'block' : 'none';   // 'block', inte '': klassen .dold i markeringen döljer annars kortet
}

// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
// ---- Lönerevisionssimulator ----
//
// Simulatorn följer minsta gruppstorlek (ADR-38): urvalet — kön, BAS-intervall och lönegräns — ska nå
// tröskeln innan något räknas, och regeln ska beröra minst så många personer innan utfallet visas
// (kostnaden för "höj till" och de stegvisa lyften är annars skillnaden mot enskildas löner). Lönegapet
// före och efter är ett könsuppdelat mått för hela organisationen och kräver tröskeln för varje kön
// (`_konFarRedovisasFor`). Antalet berörda per kön är ett antal, inte ett lönemått, och visas.

/** Urvalet som simulatorns kontroller anger: de rader som matchar kön, BAS-intervall och lönegräns. */
function _simUrval(d) {
    const konSel    = /** @type {HTMLInputElement} */ (document.getElementById('sim-kon'))?.value      || 'kvinna';
    const basSel    = /** @type {HTMLInputElement} */ (document.getElementById('sim-bas'))?.value      || '__ALLA__';
    const lonCapStr = /** @type {HTMLInputElement} */ (document.getElementById('sim-loncap'))?.value;
    const lonCap    = lonCapStr ? parseFloat(lonCapStr) : null;
    const matchesKon = r =>
        konSel === 'alla' ||
        (konSel === 'kvinna' && r.kon.includes('kvinna')) ||
        (konSel === 'man'    && (r.kon === 'man' || r.kon === 'män'));
    const matchesBas = r => basSel === '__ALLA__' || r.bas === basSel;
    const underCap   = r => lonCap == null || r.lon < lonCap;
    const iUrval = r => matchesKon(r) && matchesBas(r) && underCap(r);
    return { iUrval, urval: d.filter(iUrval) };
}

/** Meningen när urvalet eller de berörda är färre än tröskeln (samma ordalydelse i knappen och i utfallet). */
function _simUnderTroskelNot(vad, n) {
    const k = kTroskel();
    return `${vad === 'urval' ? 'Simuleringen körs inte: urvalet (kön, BAS-intervall och lönegräns)' : 'Utfallet visas inte: åtgärden berör'}`
        + ` ${n} ${n === 1 ? 'person' : 'personer'}, färre än ${k} (minsta gruppstorlek för redovisning).`
        + ` Kostnaden skulle då bygga på enskildas löner. Vidga urvalet${vad === 'urval' ? '' : ' eller ändra åtgärden'}.`;
}

/**
 * Läget för urvalet i kontrollerna: når det tröskeln? `not` är meningen när det inte gör det.
 * @returns {null | {n:number, ok:boolean, not:string}}
 */
function _simUrvalStatus() {
    const d = getData();
    if (!d.length) return null;
    const n = _simUrval(d).urval.length;
    const ok = n >= kTroskel();
    return { n, ok, not: ok ? '' : _simUnderTroskelNot('urval', n) };
}

/**
 * Knappen "Beräkna simulering" följer urvalet: under tröskeln är den inaktiv och meningen står där utfallet
 * annars visas. När urvalet åter når tröskeln tas meningen bort (ett visat utfall lämnas orört).
 */
function _simSynkaKnapp() {
    const btn = document.getElementById('sim-run');
    const wrap = document.getElementById('sim-results');
    if (!btn) return;
    const st = _simUrvalStatus();
    const sparr = !!(st && !st.ok);
    /** @type {HTMLInputElement} */ (btn).disabled = sparr;
    btn.title = sparr ? st.not : '';
    if (!wrap) return;
    if (sparr) {
        wrap.style.display = 'block';
        wrap.innerHTML = `<p class="gd-missing">${esc(st.not)}</p>`;
        wrap._lastSimResult = null;
        wrap.dataset.simSparr = '1';
    } else if (wrap.dataset.simSparr) {
        delete wrap.dataset.simSparr;
        wrap.style.display = 'none';
        wrap.innerHTML = '';
    }
}

/**
 * Simulerar effekten av en lönerevision: applicerar utvalt påslag (kr eller %)
 * på filtrerad delmängd och rapporterar nya gruppstatistiker, total kostnad
 * (inkl. PO-påslag och period), och risk för "spillover" (att andra grupper hamnar under).
 * Under tröskeln (urvalet eller de berörda) returneras `{ underTroskel: true, not }` utan tal.
 * @returns {null | Object} Strukturerat resultat med before/after + kostnadsblock.
 */
function runSalarySimulation() {
    const d = getData();
    if (!d.length) return null;
    const actionSel = /** @type {HTMLInputElement} */ (document.getElementById('sim-action'))?.value   || 'add';
    const amount    = parseFloat(/** @type {HTMLInputElement} */ (document.getElementById('sim-amount'))?.value) || 0;
    const { iUrval, urval } = _simUrval(d);
    if (urval.length < kTroskel()) return { affectedCount: 0, underTroskel: true, not: _simUnderTroskelNot('urval', urval.length) };

    // A: Stegvis lyft beräknar målnivå per BAS (P25 eller median) och delar i 3 lika årssteg
    /** @type {any} */ let stagedTarget = null;
    if (actionSel === 'staged_p25' || actionSel === 'staged_median') {
        stagedTarget = {};
        const basList = [...new Set(d.map(r => r.bas))];
        basList.forEach(b => {
            const lons = d.filter(r => r.bas === b).map(r => r.lon).sort((a,bv) => a - bv);
            if (!lons.length) return;
            const idx = actionSel === 'staged_p25' ? Math.floor(lons.length * 0.25) : Math.floor(lons.length * 0.5);
            stagedTarget[b] = lons[Math.min(idx, lons.length - 1)];
        });
    }

    // Bygg simulerad data
    const simData = d.map(r => {
        const original = r.lon;
        if (iUrval(r)) {
            let newLon = original;
            if (actionSel === 'add')      newLon = original + amount;
            else if (actionSel === 'pct') newLon = original * (1 + amount / 100);
            else if (actionSel === 'raise_to' && original < amount) newLon = amount;
            else if (stagedTarget && stagedTarget[r.bas] && original < stagedTarget[r.bas]) {
                // År 1: lyft 1/3 av vägen mot målet
                const totalGap = stagedTarget[r.bas] - original;
                newLon = original + Math.round(totalGap / 3);
            }
            return { ...r, lon: newLon, _delta: newLon - original };
        }
        return { ...r, _delta: 0 };
    });

    // Beräkna effekter (med konfigurerade månader + PO-påslag)
    const months = (state.costSettings && state.costSettings.months) || 12;
    const poFactor = 1 + ((state.costSettings && state.costSettings.poPct) || 0) / 100;
    const affected = simData.filter(r => r._delta > 0);
    if (affected.length && affected.length < kTroskel()) {
        return { affectedCount: affected.length, underTroskel: true, not: _simUnderTroskelNot('berorda', affected.length) };
    }
    const totalMonthlyCost = affected.reduce((s, r) => s + r._delta, 0);
    const totalAnnualCost  = totalMonthlyCost * months * poFactor;

    // Råa lönegapet före/efter: ett könsuppdelat mått för hela organisationen — kräver tröskeln för varje kön.
    const konFar = _konFarRedovisasFor(d);
    const kvAll = d.filter(r => r.kon.includes('kvinna'));
    const maAll = d.filter(r => r.kon === 'man' || r.kon === 'män');
    const beforeGap = konFar && kvAll.length && maAll.length ? (Stat.median(kvAll.map(r=>r.lon)) / Stat.median(maAll.map(r=>r.lon)) - 1) * 100 : null;
    const kvSim = simData.filter(r => r.kon.includes('kvinna'));
    const maSim = simData.filter(r => r.kon === 'man' || r.kon === 'män');
    const afterGap = konFar && kvSim.length && maSim.length ? (Stat.median(kvSim.map(r=>r.lon)) / Stat.median(maSim.map(r=>r.lon)) - 1) * 100 : null;
    const konNot = konFar ? '' : _konUtelamnatNot();

    // OLS oförklarat gap före/efter (kör regression mot original-data och simulerad)
    //
    // Try/finally garanterar att state.data återställs även om
    // runOLSRegression kastar (t.ex. vid numerisk singularitet i designmatrisen
    // efter simulerad lönehöjning). Annars kunde en krasch lämna sessionsstaten
    // med simulerad data permanent skriven över den riktiga.
    const origData = state.data;
    let regAfter, regBefore;
    try {
        state.data = simData;
        regAfter = runOLSRegression();
        // Återställ före regBefore-körningen så den körs mot original
        state.data = origData;
        regBefore = runOLSRegression();
    } finally {
        // Säkerhetsnät: garantera att original-state återställs även vid undantag
        state.data = origData;
    }

    return {
        affectedCount: affected.length,
        totalMonthlyCost,
        totalAnnualCost,
        beforeGap, afterGap, konNot,
        beforeUnexplained: regBefore && !regBefore.error ? regBefore.konPct : null,
        afterUnexplained:  regAfter  && !regAfter.error  ? regAfter.konPct  : null,
        beforeUnexplainedSig: regBefore && !regBefore.error ? regBefore.pValue < 0.05 : null,
        afterUnexplainedSig:  regAfter  && !regAfter.error  ? regAfter.pValue  < 0.05 : null,
        // Effekt per kön
        affectedKv: affected.filter(r => r.kon.includes('kvinna')).length,
        affectedMa: affected.filter(r => r.kon === 'man' || r.kon === 'män').length
    };
}

function renderSalarySimResults() {
    const wrap = document.getElementById('sim-results');
    if (!wrap) return;
    // J: stöd för min/max-spann
    const maxEl = document.getElementById('sim-amount-max');
    const maxVal = maxEl && /** @type {HTMLInputElement} */ (maxEl).value ? parseFloat(/** @type {HTMLInputElement} */ (maxEl).value) : null;
    const amountEl = /** @type {HTMLInputElement} */ (document.getElementById('sim-amount'));
    const minVal = parseFloat(/** @type {HTMLInputElement} */ (amountEl).value) || 0;
    if (maxVal && maxVal > minVal) {
        const origAmount = /** @type {HTMLInputElement} */ (amountEl).value;
        /** @type {HTMLInputElement} */ (amountEl).value = String(minVal);
        const resMin = runSalarySimulation();
        /** @type {HTMLInputElement} */ (amountEl).value = String(maxVal);
        const resMax = runSalarySimulation();
        /** @type {HTMLInputElement} */ (amountEl).value = origAmount;
        if (!resMin || !resMax) { wrap.style.display = 'none'; return; }
        const under = [resMin, resMax].find(r => r.underTroskel);
        if (under) { _renderSimUnderTroskel(wrap, under); return; }
        _renderSimMinMax(wrap, resMin, resMax, minVal, maxVal);
        return;
    }
    const res = runSalarySimulation();
    if (!res) { wrap.style.display = 'none'; return; }
    if (res.underTroskel) { _renderSimUnderTroskel(wrap, res); return; }
    delete wrap.dataset.simSparr;
    if (res.affectedCount === 0) {
        wrap.style.display = 'block';
        wrap.innerHTML = `<div class="bak-botten rund-6 farg-dampad pad-14-16">Inga personer matchar reglerna. Justera filter eller åtgärd.</div>`;
        return;
    }
    const fmt = new Intl.NumberFormat('sv-SE');
    const fmtPct = v => v == null ? '–' : (v >= 0 ? '+' : '') + svPct(v, 1);
    const dGap = (res.beforeGap != null && res.afterGap != null) ? (res.afterGap - res.beforeGap) : null;
    const dUnexp = (res.beforeUnexplained != null && res.afterUnexplained != null) ? (res.afterUnexplained - res.beforeUnexplained) : null;
    const dirGap = dGap != null ? (Math.abs(res.afterGap) < Math.abs(res.beforeGap) ? 'närmare 100 % (förbättring)' : 'längre från 100 %') : '';
    const dirUnexp = dUnexp != null ? (Math.abs(res.afterUnexplained) < Math.abs(res.beforeUnexplained) ? 'närmare 100 % (förbättring)' : 'längre från 100 %') : '';

    wrap.style.display = 'block';
    wrap._lastSimResult = res;  // cache för bevis-knappen
    wrap.innerHTML = `
        <div class="bak-white ram-1-kant rund-8 pad-16-18">
            <h4 class="rad-mitt fs-md mellan marg-0-0-12">
                <span>Simuleringseffekt</span>
                <button class="btn-evidence" id="btn-evidence-sim" type="button" title="Visa beräkningen bakom simuleringsresultatet" aria-label="Visa bevis för simuleringen">Bevis</button>
            </h4>
            <div class="summary-stats m-0">
                <div class="stat-box ram-v-farg-primary">
                    <div class="stat-etikett">Berörda personer</div>
                    <div class="stat-val fs-nyckeltal">${fmt.format(res.affectedCount)}</div>
                    <div class="finstilt">Kvinnor: ${res.affectedKv} · Män: ${res.affectedMa}</div>
                </div>
                <div class="stat-box ram-v-farg-kritisk">
                    <div class="stat-etikett">Total budgetpåverkan</div>
                    <div class="stat-val fs-xl">${_fmtCost(res.totalAnnualCost)}</div>
                    <div class="finstilt">
                        ${fmt.format(Math.round(res.totalMonthlyCost))} kr/månad × ${state.costSettings.months} mån × ${svTal((1 + state.costSettings.poPct/100), 2)} (PO-påslag)
                    </div>
                </div>
                <div class="stat-box ram-v-farg-ok">
                    <div class="stat-etikett">Kvinnors medianlön i % av mäns</div>
                    ${res.konNot ? `<div class="gd-missing">${esc(res.konNot)}</div>` : `
                    <div class="farg-dampad fs-md">Före: ${andelAvMan(res.beforeGap)}</div>
                    <div class="fs-xl fw-700">Efter: ${andelAvMan(res.afterGap)}</div>
                    ${dGap != null ? `<div class="text-dampad-xs marg-t-2">Förändring: ${dGap >= 0 ? '+' : ''}${svTal(dGap, 1)} procentenheter · ${dirGap}</div>` : ''}`}
                </div>
                <div class="stat-box ram-v-farg-info">
                    <div class="stat-etikett">Oförklarat gap (regressionen)</div>
                    <div class="farg-dampad fs-md">Före: ${fmtPct(res.beforeUnexplained)}${res.beforeUnexplainedSig ? ' (sig.)' : ''}</div>
                    <div class="fs-xl fw-700">Efter: ${fmtPct(res.afterUnexplained)}${res.afterUnexplainedSig ? ' (sig.)' : ''}</div>
                    ${dUnexp != null ? `<div class="text-dampad-xs marg-t-2">Δ: ${dUnexp >= 0 ? '+' : ''}${svTal(dUnexp, 2)} pp · ${dirUnexp}</div>` : ''}
                </div>
            </div>
            <p class="text-dampad-xs lh-1_5 marg-t-14">
                <em>Simuleringen körs i minnet — den faktiska datan är oförändrad. Resultatet visar vad som händer om regeln tillämpas.</em>
            </p>
            ${_buildSpilloverWarning(res)}
        </div>
    `;
    // Bevis-popup för simulering
    document.getElementById('btn-evidence-sim')?.addEventListener('click', () => {
        const cached = wrap._lastSimResult || res;
        _openEvidenceModal(_evidenceForSimulation(cached));
    });
}

// H: Löneglidning-varning — varnar om åtgärden potentiellt triggar krav från andra grupper
function _buildSpilloverWarning(res) {
    if (!res || res.affectedCount === 0) return '';
    // (förenklad heuristik: om åtgärden lyfter en grupp över sin BAS-median, kan andra i samma BAS reagera)
    const items = computePrioritization(_selectedPrioReference());
    const akut = items.filter(i => i.status === 'akut' || i.status === 'atgard').length;
    if (akut === 0) return '';
    return `<div class="notis-varning fs-sm lh-1_55 marg-t-14 pad-10-14">
        <strong>${ikon('statusVarning')} Löneglidning att överväga:</strong> Om denna åtgärd genomförs kan andra grupper i samma BAS-intervall eller med liknande lönenivå rikta motsvarande krav. Identifiera dessa proaktivt och planera kommunikation. Granska Prioriteringen efter simuleringen — det finns ${akut} ytterligare grupp${akut>1?'er':''} som också ligger under referensen.
    </div>`;
}

/** Utfallet under tröskeln: bara meningen om vad som utelämnats och varför, inga tal. */
function _renderSimUnderTroskel(wrap, res) {
    wrap.style.display = 'block';
    wrap._lastSimResult = null;
    wrap.dataset.simSparr = '1';
    wrap.innerHTML = `<p class="gd-missing">${esc(res.not)}</p>`;
}

// J: rendera min/max-spann sida vid sida
function _renderSimMinMax(wrap, resMin, resMax, minVal, maxVal) {
    const fmt = new Intl.NumberFormat('sv-SE');
    const fmtPct = v => v == null ? '–' : (v >= 0 ? '+' : '') + svPct(v, 1);
    wrap.style.display = 'block';
    delete wrap.dataset.simSparr;
    const konNot = resMin.konNot || resMax.konNot;
    wrap.innerHTML = `
        <div class="bak-white ram-1-kant rund-8 pad-16-18">
            <h4 class="fs-md marg-0-0-12">Simuleringseffekt — min/max-spann</h4>
            ${konNot ? `<p class="gd-missing">${esc(konNot)}</p>` : ''}
            <table class="data-table st-09">
                <thead><tr><th scope="col">Mått</th><th class="t-hoger" scope="col">Min (${fmt.format(minVal)} kr)</th><th class="t-hoger" scope="col">Max (${fmt.format(maxVal)} kr)</th></tr></thead>
                <tbody>
                    <tr><th scope="row" class="ram-b-1-kant fw-normal ta-vanster">Berörda personer</th><td class="t-hoger">${fmt.format(resMin.affectedCount)}</td><td class="t-hoger">${fmt.format(resMax.affectedCount)}</td></tr>
                    <tr><th scope="row" class="ram-b-1-kant fw-normal ta-vanster">Total budgetpåverkan</th><td class="t-hoger">${_fmtCost(resMin.totalAnnualCost)}</td><td class="t-hoger">${_fmtCost(resMax.totalAnnualCost)}</td></tr>
                    <tr><th scope="row" class="ram-b-1-kant fw-normal ta-vanster">Kvinnors medianlön i % av mäns (efter)</th><td class="t-hoger">${andelAvMan(resMin.afterGap)}</td><td class="t-hoger">${andelAvMan(resMax.afterGap)}</td></tr>
                    <tr><th scope="row" class="ram-b-1-kant fw-normal ta-vanster">Oförklarat gap (efter)</th><td class="t-hoger">${fmtPct(resMin.afterUnexplained)}</td><td class="t-hoger">${fmtPct(resMax.afterUnexplained)}</td></tr>
                </tbody>
            </table>
            <p class="text-dampad-xs lh-1_5 marg-t-10">
                <em>Visar effekt vid två olika belopp för budgetdialog. Antal månader och PO-påslag enligt aktuella inställningar.</em>
            </p>
        </div>
    `;
}

function populateSimBasSelect() {
    const sel = document.getElementById('sim-bas');
    if (!sel) return;
    const bas = getBasIntervals();
    const cur = /** @type {HTMLInputElement} */ (sel).value;
    sel.innerHTML = '<option value="__ALLA__">Alla BAS</option>' + bas.map(b => `<option value="${esc(b)}">BAS-${esc(b)}</option>`).join('');
    if (cur && [.../** @type {HTMLSelectElement} */ (sel).options].some(o => o.value === cur)) /** @type {HTMLInputElement} */ (sel).value = cur;
    _simSynkaKnapp();
}

document.getElementById('sim-run')?.addEventListener('click', renderSalarySimResults);
document.getElementById('sim-reset')?.addEventListener('click', () => {
    const wrap = document.getElementById('sim-results');
    if (wrap) { wrap.style.display = 'none'; wrap.innerHTML = ''; delete wrap.dataset.simSparr; }
    /** @type {HTMLInputElement} */ (document.getElementById('sim-amount')).value = '1500';
    /** @type {HTMLInputElement} */ (document.getElementById('sim-loncap')).value = '';
    /** @type {HTMLInputElement} */ (document.getElementById('sim-kon')).value = 'kvinna';
    /** @type {HTMLInputElement} */ (document.getElementById('sim-bas')).value = '__ALLA__';
    /** @type {HTMLInputElement} */ (document.getElementById('sim-action')).value = 'add';
    _simSynkaKnapp();
});
// Urvalets kontroller: knappen följer tröskeln medan användaren väljer.
['sim-kon', 'sim-bas'].forEach(id => document.getElementById(id)?.addEventListener('change', _simSynkaKnapp));
document.getElementById('sim-loncap')?.addEventListener('input', _simSynkaKnapp);

// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
// Löneöversyn & prognos (budget-först-fördelning)
// -------------------------------------------------------------------
// De rena funktionerna (_fc*) genereras i src/app/09-lib-speglar.js från src/lib/loneoversyn.js.
// Endast UI/state-koden ligger här.
// ===================================================================

// ---- UI: Löneöversyn-fliken ----
function _forecastReadControls() {
    const bm = document.getElementById('forecast-budget-mode');
    const bv = document.getElementById('forecast-budget-value');
    const gm = document.getElementById('forecast-generell-mode');
    const gv = document.getElementById('forecast-generell-value');
    if (bm) state.forecast.budget.mode = /** @type {HTMLInputElement} */ (bm).value;
    if (bv) state.forecast.budget.value = /** @type {HTMLInputElement} */ (bv).value === '' ? null : parseFloat(/** @type {HTMLInputElement} */ (bv).value);
    if (gm) state.forecast.generell.mode = /** @type {HTMLInputElement} */ (gm).value;
    if (gv) state.forecast.generell.value = /** @type {HTMLInputElement} */ (gv).value === '' ? null : parseFloat(/** @type {HTMLInputElement} */ (gv).value);
    const mn = document.getElementById('forecast-min-n');
    if (mn) { const v = parseInt(/** @type {HTMLInputElement} */ (mn).value, 10); state.forecast.minGroupN = isFinite(v) && v >= 0 ? v : 0; }
    const rs = document.getElementById('forecast-round');
    if (rs) { const v = parseInt(/** @type {HTMLInputElement} */ (rs).value, 10); state.forecast.roundStep = isFinite(v) && v >= 0 ? v : 0; }
    const yr = document.getElementById('forecast-years');
    if (yr) { const v = parseInt(/** @type {HTMLInputElement} */ (yr).value, 10); state.forecast.years = isFinite(v) && v >= 1 ? v : 1; }
}
// Distinkta AID (yrken) inom ett BAS, med visningsetikett + gruppstorlek.
function _forecastAidsForBas(bas) {
    const seen = new Map();
    getData().forEach(r => {
        if (r.bas !== bas) return;
        let g = seen.get(r.aid);
        if (!g) { g = { aid: r.aid, label: (r.yrkeLabel || r.aid || '').toString(), n: 0 }; seen.set(r.aid, g); }
        g.n++;
    });
    return [...seen.values()].sort((a, b) => a.label.localeCompare(b.label, 'sv'));
}
function renderForecastTargets() {
    const host = document.getElementById('forecast-targets');
    if (!host) return;
    const basList = getBasIntervals();
    const t = state.forecast.targets;
    if (!t.length) {
        host.innerHTML = '<p class="text-dampad-sm marg-4-0">Inga riktade potter tillagda. Lägg till en grupp eller använd förslagsknappen.</p>';
        return;
    }
    const dAll = getData();
    // Radens urval ("*" = hela BAS-intervallet; kön och lönegräns snävar in). En rad som användaren själv
    // lägger på färre personer än tröskeln är tillåten (egen simulering, ADR-38 R2): beloppet räknas som
    // för andra rader, och noten under raden säger vad det bygger på.
    const gruppN = tg => _fcTargetRows(dAll, tg).length;
    host.innerHTML = t.map((tg, i) => {
        // #13 Isolerad kostnad för raden (vad den äter av potten)
        let rowCost = 0;
        try { rowCost = _fcAllocate(dAll, { mode: 'pct', value: 0 }, [tg], state.forecast.roundStep).totals.riktadCost; } catch (_e) { rowCost = 0; }
        const basOpts = basList.map(b => `<option value="${esc(b)}"${tg.bas === b ? ' selected' : ''}>${esc(b)}</option>`).join('');
        const aids = _forecastAidsForBas(tg.bas || basList[0]);
        const aidOpts = `<option value="*"${tg.aid === '*' ? ' selected' : ''}>Hela BAS (alla yrken)</option>`
            + aids.map(a => `<option value="${esc(a.aid)}"${tg.aid === a.aid ? ' selected' : ''}>${esc(a.label)} (n=${a.n})</option>`).join('');
        const distOpts = [['flat', 'Lika % till alla'], ['lowest', 'Lyft lägst betalda först'], ['target', 'Lyft mot målnivå']]
            .map(([v, l]) => `<option value="${v}"${tg.dist === v ? ' selected' : ''}>${l}</option>`).join('');
        const lvlOpts = [['median', 'BAS-median'], ['p25', 'BAS P25']]
            .map(([v, l]) => `<option value="${v}"${tg.targetLevel === v ? ' selected' : ''}>${l}</option>`).join('');
        const konOpts = [['alla', 'Alla'], ['kvinna', 'Bara kvinnor'], ['man', 'Bara män']]
            .map(([v, l]) => `<option value="${v}"${(tg.kon || 'alla') === v ? ' selected' : ''}>${l}</option>`).join('');
        const till = tg.mode === 'till';
        return `<div class="forecast-target-row" data-idx="${i}">
            <select data-f="bas" aria-label="BAS-intervall">${basOpts}</select>
            <select data-f="aid" aria-label="Yrke (AID)">${aidOpts}</select>
            <select data-f="kon" aria-label="Kön som omfattas" title="Begränsa raden till ett kön">${konOpts}</select>
            <label class="ft-cap" title="Bara löner under gränsen omfattas; tomt = alla">under <input type="number" data-f="lonCap" min="0" step="500" value="${tg.lonCap == null ? '' : tg.lonCap}" aria-label="Bara löner under (kr/mån)" placeholder="alla löner"> kr</label>
            <select data-f="mode" aria-label="Beloppstyp"><option value="kr"${tg.mode === 'kr' ? ' selected' : ''}>kr/mån att fördela</option><option value="pct"${tg.mode === 'pct' ? ' selected' : ''}>% av grupplön</option><option value="till"${till ? ' selected' : ''}>höj till (kr/mån)</option></select>
            <input type="number" data-f="value" min="0" step="100" value="${tg.value == null ? '' : tg.value}" aria-label="Belopp" class="bredd-90">
            <select data-f="dist" aria-label="Fördelning inom gruppen"${till ? ' class="dold"' : ''}>${distOpts}</select>
            <select data-f="targetLevel" aria-label="Målnivå"${tg.dist === 'target' ? '' : ' class="dold"'}>${lvlOpts}</select>
            <select data-f="pool" aria-label="Pott-typ" title="Ring-fenced pott (visas i kostnad-per-pott)">${[['equity', 'Likalön'], ['marknad', 'Marknad'], ['befordran', 'Befordran'], ['övrigt', 'Övrigt']].map(([v, l]) => `<option value="${v}"${(tg.pool || 'övrigt') === v ? ' selected' : ''}>${l}</option>`).join('')}</select>
            <span class="text-dampad-xs ingen-radbrytning" title="Vad raden förbrukar av potten">≈ ${Math.round(rowCost).toLocaleString('sv-SE')} kr</span>
            <button type="button" data-f="remove" class="btn btn-secondary btn-sm" aria-label="Ta bort rad">${ikon('kryss', 14)}</button>
        </div>${gruppN(tg) > 0 && gruppN(tg) < kInstalld() ? `<p class="k-mask-note">Raden berör ${gruppN(tg)} ${gruppN(tg) === 1 ? 'person' : 'personer'}, färre än ${kInstalld()} personer — beloppet bygger på enskildas löner och ingår i summorna, även i Excel-exporten.</p>` : (gruppN(tg) === 0 ? '<p class="k-mask-note">Ingen i gruppen matchar kön och lönegräns.</p>' : '')}`;
    }).join('');
    host.querySelectorAll('.forecast-target-row').forEach(rowEl => {
        const i = parseInt(rowEl.getAttribute('data-idx') || '', 10);
        rowEl.querySelectorAll('[data-f]').forEach(ctrl => {
            const field = ctrl.getAttribute('data-f') || '';
            if (field === 'remove') {
                ctrl.addEventListener('click', () => { state.forecast.targets.splice(i, 1); renderForecastTargets(); updateForecast(); });
                return;
            }
            ctrl.addEventListener('change', () => {
                const tg = state.forecast.targets[i];
                if (field === 'value') tg.value = /** @type {HTMLInputElement} */ (ctrl).value === '' ? null : parseFloat(/** @type {HTMLInputElement} */ (ctrl).value);
                else if (field === 'lonCap') tg.lonCap = /** @type {HTMLInputElement} */ (ctrl).value === '' ? null : parseFloat(/** @type {HTMLInputElement} */ (ctrl).value);
                else tg[field] = /** @type {HTMLInputElement} */ (ctrl).value;
                if (field === 'bas') { tg.aid = (_forecastAidsForBas(tg.bas)[0] || {}).aid || ''; renderForecastTargets(); }
                if (field === 'dist' || field === 'mode' || field === 'kon' || field === 'lonCap') renderForecastTargets();
                updateForecast();
            });
            if (field === 'value' || field === 'lonCap') ctrl.addEventListener('input', () => {
                state.forecast.targets[i][field] = /** @type {HTMLInputElement} */ (ctrl).value === '' ? null : parseFloat(/** @type {HTMLInputElement} */ (ctrl).value);
                updateForecast();
            });
        });
    });
}
// OLS oförklarat gap (β_kön i %) före/efter via data-swap. Returnerar {fore, efter}.
function _forecastOlsGap(origRows, simRows) {
    const savedData = state.data;
    let fore = null, efter = null;
    try {
        state.data = origRows; const rb = runOLSRegression(); if (rb && !rb.error) fore = rb.konPct;
        state.data = simRows;  const ra = runOLSRegression(); if (ra && !ra.error) efter = ra.konPct;
    } finally {
        state.data = savedData;
    }
    return { fore, efter };
}
function updateForecast() {
    const meterEl = document.getElementById('forecast-meter');
    const outEl = document.getElementById('forecast-outcome');
    if (!meterEl && !outEl) return;
    _forecastReadControls();
    const d = getData();
    if (!d.length) {
        if (meterEl) meterEl.innerHTML = '';
        { const topp = document.getElementById('lo-slutsatser'); if (topp) topp.innerHTML = ''; }
        if (outEl) outEl.innerHTML = '<p class="farg-dampad pad-18 ta-mitt">Ladda upp strukturdata för att prognosticera.</p>';
        document.getElementById('view-loneoversyn')?.classList.remove('lo-tomt');
        _renderForecastLutning(null, null);
        return;
    }
    const cost = { months: (state.costSettings && state.costSettings.months) || 12, poPct: (state.costSettings && state.costSettings.poPct) || 0, roundStep: state.forecast.roundStep || 0 };
    // #10 Indata-validering: fånga orimliga värden innan beräkning
    const valWarn = [];
    const bv = state.forecast.budget.value, gv = state.forecast.generell.value;
    if (bv != null && bv < 0) valWarn.push('Budgeten är negativ.');
    if (state.forecast.budget.mode === 'pct' && bv != null && bv > 50) valWarn.push('Budgeten är ovanligt hög (> 50 % av lönesumman) — kontrollera.');
    if (gv != null && gv < 0) valWarn.push('Det generella påslaget är negativt.');
    if (state.forecast.generell.mode === 'pct' && gv != null && gv > 25) valWarn.push('Det generella påslaget är ovanligt högt (> 25 %).');
    if (state.forecast.targets.some(t => t.value == null || !(t.value > 0))) valWarn.push('En eller flera riktade rader saknar belopp.');
    if (state.forecast.targets.some(t => _fcTargetRows(d, t).length === 0)) valWarn.push('En riktad rad matchar ingen person (kön eller lönegräns).');
    const out = _fcForecastOutcome(d, state.forecast.budget, state.forecast.generell, state.forecast.targets, cost);
    const riktade = state.forecast.targets.length;
    _laNyckel('nyckel-lo-riktade', riktade ? `${riktade} ${riktade === 1 ? 'riktad pott' : 'riktade potter'}` : 'Inga riktade potter');
    _laNyckel('nyckel-lo-planering', state.forecast.roundStep > 0 || (state.forecast.years || 1) > 1 ? 'Anpassade värden' : 'Standardvärden');
    state.forecast.result = out;
    const simRows = d.map((r, i) => ({ ...r, lon: out.alloc.perPerson[i].nyLon }));
    const ols = _forecastOlsGap(d, simRows);
    _renderForecastLutning(d, simRows);

    const kr = n => Math.round(n).toLocaleString('sv-SE') + ' kr';
    const pct = n => (n == null ? '–' : (n >= 0 ? '+' : '') + svPct(n, 1));
    // Budgetmätare
    const anvPct = out.pott > 0 ? Math.min(100, 100 * out.använt / out.pott) : 0;
    const meterKlass = out.overBudget ? 'bg-kritisk' : (anvPct > 95 ? 'bg-varning' : 'bg-ok');
    // Nyckeltalen står i flikens topp, som på övriga flikar (potten, vad som gått åt och vad det kostar); mätaren under
    // formuläret visar bara förloppet och varningarna.
    { const topp = document.getElementById('lo-slutsatser');
      if (topp) topp.innerHTML = [
          _laSlutsats('Pott', out.pott > 0 ? kr(out.pott) : '–', out.pott > 0 ? 'kr per månad att fördela' : 'ingen budget angiven'),
          _laSlutsats('Använt', kr(out.använt), out.pott > 0 ? `${svTal(100 * out.använt / out.pott, 0)} % av potten` : 'av påslagen hittills'),
          _laSlutsats('Kvar att fördela', kr(out.kvar), out.kvar < -0.5 ? 'fördelningen överskrider potten' : 'av potten', out.kvar < -0.5),
          _laSlutsats('Lönesumma per månad', kr(out.lonsummaEfter), `från ${kr(out.lonsummaFore)}`),
          _laSlutsats('Total kostnad', kr(out.totalKostnad), `${cost.months} mån, PO ${svPct(cost.poPct, 2)}`),
      ].join(''); }
    if (meterEl) meterEl.innerHTML = `
        <div class="bak-kant rund-6 hojd-12 marg-t-10 klipp" role="img" aria-label="Budgetutnyttjande ${svTal(anvPct, 0)} procent">
            <div class="hojd-100p ${meterKlass}" data-stil-bredd="${anvPct.toFixed(1)}%"></div>
        </div>
        ${out.overBudget ? `<p class="farg-danger fs-sm fw-600 marg-8-0-0">${ikon('statusVarning')} Fördelningen överskrider potten.</p>` : ''}
        ${valWarn.length ? `<p class="farg-varning fs-sm marg-8-0-0">${ikon('statusVarning')} ${valWarn.map(esc).join(' ')}</p>` : ''}
        ${state.forecast.roundStep > 0 ? `<p class="text-dampad-xs marg-6-0-0">Nya löner avrundas till närmaste ${state.forecast.roundStep} kr.</p>` : ''}`; if (meterEl) tillampaDataStil(meterEl);

    // (A) Lönespann per BAS + compa-ratio
    const bands = _fcBandStats(d);
    const bandByBas = {}; bands.forEach(b => { bandByBas[b.bas] = b; });
    // k-anonymitet: ett BAS under tröskeln får inte röja sitt lönespann —
    // P25/median/P75 pekar då ut enskilda löner. Raden utelämnas i stället för
    // att fyllas med "< 10"-celler, och BAS:et räknas upp i noten under.
    const bandVisade = bands.filter(b => !isKMasked(b.n));
    const bandUtelamnade = bands.filter(b => isKMasked(b.n)).map(b => b.bas);
    const bandPanelHtml = bands.length ? `<div class="card ram-v-4-granska-ljus marg-0-0-14">
        <strong class="block-mb6">Lönespann per BAS (P25 / median / P75)</strong>
        ${bandVisade.length ? `<table class="data-table st-085"><thead><tr><th>BAS</th><th class="t-hoger">n</th><th class="t-hoger">P25</th><th class="t-hoger">Median</th><th class="t-hoger">P75</th></tr></thead>
        <tbody>${bandVisade.map(b => `<tr><td>${esc(b.bas)}</td><td class="t-hoger">${b.n}</td><td class="t-hoger">${kr(b.p25)}</td><td class="t-hoger">${kr(b.median)}</td><td class="t-hoger">${kr(b.p75)}</td></tr>`).join('')}</tbody></table>` : ''}
        ${kMaskNote(bandUtelamnade, 'BAS-intervall|BAS-intervall')}
        <p class="text-dampad-xs marg-6-0-0">Läget mot BAS-medianen i tabellen nedan är gruppens nya median delad med BAS-medianen: över 1,10 märks «över», under 0,90 märks «under».</p>
    </div>` : '';
    // (D) Kostnad per pott (ring-fenced)
    const poolLabels = { equity: 'Likalön', marknad: 'Marknad', befordran: 'Befordran', 'övrigt': 'Övrigt' };
    const poolCost = {};
    state.forecast.targets.forEach(t => {
        let c = 0;
        try { c = _fcAllocate(d, { mode: 'pct', value: 0 }, [t], state.forecast.roundStep).totals.riktadCost; } catch (_e) { c = 0; }
        const p = poolLabels[t.pool] ? t.pool : 'övrigt';
        poolCost[p] = (poolCost[p] || 0) + c;
    });
    const poolRows = Object.keys(poolLabels).filter(p => poolCost[p] > 0.5);
    const poolHtml = (poolRows.length || out.generellCost > 0.5) ? `<div class="card ram-v-4-7c3aed marg-0-0-14">
        <strong class="block-mb6">Kostnad per pott (kr/mån)</strong>
        <table class="data-table st-085"><tbody>
            ${out.generellCost > 0.5 ? `<tr><td>Generellt påslag</td><td class="t-hoger">${kr(out.generellCost)}</td></tr>` : ''}
            ${poolRows.map(p => `<tr><td>${poolLabels[p]}</td><td class="t-hoger">${kr(poolCost[p])}</td></tr>`).join('')}
        </tbody></table>
        <p class="text-dampad-xs marg-6-0-0">Ring-fenced pottar — tagga varje riktad rad med en pott-typ för att se vart utrymmet går.</p>
    </div>` : '';
    // Utfall: nyckeltal + gap + per-grupp-tabell (k-anonymitet på medianer)
    const rows = out.alloc.perGroup.filter(g => Math.abs(g.kostnad) > 0.5).sort((a, b) => b.kostnad - a.kostnad);
    const K = kTroskel();
    // Där medianerna maskeras maskeras också kostnaden: i en grupp med en person är ett påslag i
    // procent personens lön gånger procentsatsen. Summorna ovan omfattar alla grupper.
    const antalMaskerade = rows.filter(g => g.n < K).length;
    const maskNot = antalMaskerade
        ? `<p class="k-mask-note">${antalMaskerade} ${antalMaskerade === 1 ? 'grupp' : 'grupper'} med färre än ${K} personer ingår i summorna, men ${antalMaskerade === 1 ? 'dess' : 'deras'} medianer och kostnad redovisas inte per grupp.</p>`
        : '';
    // Könsuppdelade mått för hela urvalet kräver tröskeln för varje kön (ADR-12).
    const konOk = _konFarRedovisasFor(d);
    const tableRows = rows.map(g => {
        const masked = g.n < K;
        const medCells = masked
            ? `<td colspan="3" class="farg-dampad kursiv">n &lt; ${K} (maskerad)</td>`
            : `<td class="t-hoger">${kr(g.gammalMedian)}</td><td class="fw-600 ta-hoger">${kr(g.nyMedian)}</td><td class="farg-ok ta-hoger">+${svPct((100 * (g.nyMedian / g.gammalMedian - 1)), 1)}</td>`;
        const bm = bandByBas[g.bas] ? bandByBas[g.bas].median : null;
        const compa = (!masked && bm > 0) ? g.nyMedian / bm : null;
        const compaCell = compa == null
            ? '<td class="farg-dampad ta-hoger">–</td>'
            : `<td class="t-hoger${compa > 1.1 ? ' fg-varning' : compa < 0.9 ? ' fg-info-mork' : ''}">${svTal(compa, 2)}${compa > 1.1 ? ' över' : compa < 0.9 ? ' under' : ''}</td>`;
        return `<tr><td>${esc(g.bas)}</td><td>${esc(g.aid)}</td><td class="t-hoger">${g.n}</td><td class="t-hoger">${svPct(g.andelKv, 0)}</td>${medCells}<td class="t-hoger">${masked ? '–' : kr(g.kostnad) + '/mån'}</td>${compaCell}</tr>`;
    }).join('');
    const gapCell = (before, after, _lowerBetterTowardZero) => {
        const arrow = (before == null || after == null) ? '' : (Math.abs(after) < Math.abs(before) ? ` <span class="farg-ok">minskar</span>` : (Math.abs(after) > Math.abs(before) ? ' <span class="f-kritisk">ökar</span>' : ' <span class="f-dampad">oförändrat</span>'));
        return `${pct(before)} till <strong>${pct(after)}</strong>${arrow}`;
    };
    // Det råa gapet visas som kvinnors medianlön i procent av mäns (andelAvMan); pilen säger om den närmar sig 100.
    const andelCell = (before, after) => {
        const arrow = (before == null || after == null) ? '' : (Math.abs(after) < Math.abs(before) ? ` <span class="farg-ok">närmar sig 100 %</span>` : (Math.abs(after) > Math.abs(before) ? ' <span class="f-kritisk">längre från 100 %</span>' : ' <span class="f-dampad">oförändrat</span>'));
        return `${andelAvMan(before)} till <strong>${andelAvMan(after)}</strong>${arrow}`;
    };
    // #12 Enkel före/efter-stapel på |rågap| (mindre = bättre)
    const gapBar = (before, after) => {
        if (before == null || after == null) return '';
        const scale = Math.max(Math.abs(before), Math.abs(after), 0.01);
        const w = v => (Math.abs(v) / scale * 100).toFixed(1);
        return `<div class="marg-t-6 max-bredd-360">
            <div class="rad-mitt gap-6 marg-b-3"><span class="text-dampad-xs bredd-42">Före</span><div class="bak-kant rund-5 flex-1 hojd-10 klipp"><div class="hojd-100p bg-blek" data-stil-bredd="${w(before)}%"></div></div></div>
            <div class="rad-mitt gap-6"><span class="text-dampad-xs bredd-42">Efter</span><div class="bak-kant rund-5 flex-1 hojd-10 klipp"><div class="hojd-100p ${Math.abs(after) <= Math.abs(before) ? 'bg-ok' : 'bg-kritisk'}" data-stil-bredd="${w(after)}%"></div></div></div>
        </div>`;
    };
    // #8 Stegvis plan över N år (DiskrL 3:11)
    const years = state.forecast.years || 1;
    let stagedHtml = '';
    if (years > 1 && out.använt > 0.5) {
        const plan = _fcStagedPlan(d, out.alloc.perPerson, years, cost);
        stagedHtml = `<div class="card ram-v-4-info marg-0-0-14">
            <strong class="block-mb6">Stegvis plan över ${years} år (senast inom tre år)</strong>
            <table class="data-table fs-sm"><thead><tr><th>År</th><th class="t-hoger">Andel infört</th><th class="t-hoger">Ack. kostnad (inkl. PO)</th><th class="t-hoger">Kvinnors median i % av mäns</th></tr></thead>
            <tbody>${plan.map(p => `<tr><td>${p.year}</td><td class="t-hoger">${svPct(p.andelPct, 0)}</td><td class="t-hoger">${kr(p.kumKostnad)}</td><td class="t-hoger">${!konOk || p.rawGap == null ? '–' : andelAvMan(p.rawGap)}</td></tr>`).join('')}</tbody></table>
            <p class="text-dampad-xs marg-8-0-0">Linjär infasning (1/${years} per år). Gapet visar läget när respektive års andel är införd.</p>
        </div>`;
    }
    // Fördelning av påslaget: generellt / riktat, samt andel till kvinnodom. grupper
    const equityPctOfPott = out.pott > 0 ? 100 * out.equityCost / out.pott : null;
    const splitHtml = out.använt > 0.5 ? `
        <div class="card ram-v-4-7c3aed marg-0-0-14">
            <strong class="block-mb6">Hur potten används</strong>
            <div class="fs-md lh-1_8">
                Generellt påslag: <strong>${kr(out.generellCost)}</strong> &nbsp;·&nbsp; Riktade potter: <strong>${kr(out.riktadCost)}</strong><br>
                Varav till kvinnodominerade grupper (≥60 %): <strong>${kr(out.equityCost)}</strong>${equityPctOfPott != null ? ` <span class="f-dampad">(${svPct(equityPctOfPott, 0)} av potten)</span>` : ''}
            </div>
            <p class="text-dampad-xs marg-8-0-0">Andelen till kvinnodominerade grupper är en indikation på hur mycket av översynen som riktas mot de osakliga gapen.</p>
        </div>` : '';
    // Spillover-/leapfrog-varning
    // Jämförelsen visar gruppmedianer: bara grupper som når tröskeln tas med.
    const leaps = _fcDetectLeapfrog(out.alloc.perGroup.filter(g => !isKMasked(g.n)));
    const leapHtml = leaps.length ? `
        <div class="card bak-varning-yta ram-v-4-varning marg-0-0-14">
            <strong class="block-mb6">${ikon('statusVarning')} Spillover: ${leaps.length} grupp${leaps.length > 1 ? 'er' : ''} går om en tidigare högre grupp</strong>
            <ul class="fs-sm lh-1_6 marg-4-0-0-18">
                ${leaps.slice(0, 6).map(l => `<li><strong>${esc(l.bas)}·${esc(l.aid)}</strong> (median ${kr(l.gammalA)} till ${kr(l.nyA)}) passerar <strong>${esc(l.overBas)}·${esc(l.overAid)}</strong> (${kr(l.gammalB)} till ${kr(l.nyB)})</li>`).join('')}
                ${leaps.length > 6 ? `<li>… och ${leaps.length - 6} till.</li>` : ''}
            </ul>
            <p class="text-dampad-xs marg-8-0-0">En grupp som passerar en tidigare högre betald grupp kan skapa ny skevhet — kontrollera att omkastningen är sakligt motiverad.</p>
        </div>` : '';
    if (outEl) outEl.innerHTML = `
        <div class="card ram-v-4-accent marg-0-0-14">
            <strong class="block-mb6">Lönegap före och efter</strong>
            <div class="fs-md lh-1_8">
                Kvinnors medianlön i % av mäns: ${konOk ? andelCell(out.rawGapFore, out.rawGapEfter) : esc(_konUtelamnatNot()) + '<br>'}
                ${konOk ? gapBar(out.rawGapFore, out.rawGapEfter) : ''}
                Oförklarat gap (regressionen): ${ols.fore == null && ols.efter == null ? '<span class="f-dampad">— (för få obs för regression)</span>' : gapCell(ols.fore, ols.efter)}
            </div>
            <p class="text-dampad-xs marg-8-0-0">Under 100 % betyder att kvinnors medianlön är lägre än mäns. Det oförklarade gapet anges som skillnad i procent (negativt = kvinnor lägre; "minskar" = närmare noll) och körs om via OLS på de simulerade lönerna.</p>
        </div>
        ${splitHtml}
        ${poolHtml}
        ${stagedHtml}
        ${leapHtml}
        ${bandPanelHtml}
        ${rows.length ? `<div class="table-wrap"><table class="data-table st-088">
            <thead><tr><th>BAS</th><th>Yrke (AID)</th><th class="t-hoger">n</th><th class="t-hoger">Andel kv</th><th class="t-hoger">Gammal median</th><th class="t-hoger">Ny median</th><th class="t-hoger">Δ</th><th class="t-hoger">Kostnad</th><th class="t-hoger">Läge mot BAS-medianen (ny)</th></tr></thead>
            <tbody>${tableRows}</tbody></table></div>${maskNot}`
        : '<p class="text-dampad-sm">Ingen grupp har fått påslag ännu — ange ett generellt påslag eller lägg till riktade potter.</p>'}`; if (outEl) tillampaDataStil(outEl);
    // Utan pott och utan påslag finns inget utfall: en tom mätare och tabeller där före är lika med efter ser ut som
    // ett resultat. Då står en rad som säger vad som behövs, och mätaren, diagrammet och exporten visas inte.
    const tomt = !(out.pott > 0) && !(out.använt > 0.5);
    document.getElementById('view-loneoversyn')?.classList.toggle('lo-tomt', tomt);
    if (tomt && outEl) outEl.innerHTML = '<p class="tomt-lage">Ange en pott ovan så visas utfallet här.</p>';
}
// ---- Före och efter (diagramkärnan, ADR-39) ----
// `rader`: [{ namn, fore, efter, farg, markering? }] — anroparen ger bara rader som får visas.
// Ett värde före och efter, per grupp: en rad per grupp med värdet före som ett streck, värdet efter som en punkt och
// förflyttningen som ett streck emellan — inte lutande linjer på en avkortad axel, där små ändringar ser dramatiska
// ut. För en kvot (format 'pct') når axeln alltid 100 %, lika lön, som är utsatt som linje; för belopp ('kr') följer
// axeln värdena med luft omkring. `kolumner` namnger de två lägena (Före/Efter, Ögonblicksbild/Nuvarande).
/** @param {{rader: any[], titel: string, beskrivning: string, format?: 'pct'|'kr', kolumner?: string[]}} val */
function foreEfterFigur({ rader, titel, beskrivning, format = 'pct', kolumner = ['Före', 'Efter'] }) {
    const alla = rader.flatMap(r => [r.fore, r.efter]), p = v => _figTalformat(v, format), [a, b] = kolumner, kvot = format === 'pct';
    const m = r => (r.markering ? { markering: r.markering } : {});
    const tips = d => [[d.y], [a, p(d.r.fore)], [b, p(d.r.efter)]];
    const lag = Math.min(...alla), hog = Math.max(...alla), luft = Math.max((hog - lag) * 0.12, Math.abs(hog) * 0.02);
    return { beskrivning, y: { skala: 'band', ordning: rader.map(r => r.namn), etikettMax: 36 },
        x: { skala: 'linjar', titel, ...(kvot ? {} : { format }), doman: kvot ? [Math.floor(Math.min(lag, 95) - 1), Math.ceil(Math.max(hog, 100) + 1)] : [lag - luft, hog + luft * 1.6] },
        hojd: Math.max(160, 96 + rader.length * 32),
        ...(kvot ? { referens: [{ x: 100, farg: PALETTE.semantic.mork, tjocklek: 1.5, etikett: 'Lika lön' }] } : {}),
        lager: [{ marke: 'intervall', riktning: 'liggande', serie: 'Förändring', tjocklek: 3, legend: false,
                  data: rader.map(r => ({ y: r.namn, lag: Math.min(r.fore, r.efter), hog: Math.max(r.fore, r.efter), farg: r.farg, r, ...m(r) })), tips },
                { marke: 'punkt', symbol: 'streck', serie: a, farg: PALETTE.semantic.neutral, storlek: 6, data: rader.map(r => ({ y: r.namn, x: r.fore, r, ...m(r) })), tips },
                { marke: 'punkt', serie: b, farg: PALETTE.semantic.mork, storlek: 6, etikettLage: 'hoger',
                  data: rader.map(r => ({ y: r.namn, x: r.efter, farg: r.farg, etikett: p(r.efter), r, ...m(r) })), tips }] };
}

// Lönegapet (kvinnors median mot mäns, i procent — negativt när kvinnor ligger lägre) per BAS-intervall eller
// yrkesgrupp, före och efter påslagen. Bara grupper där både kvinnor och män når tröskeln: löneöversynens
// riktade rader för små grupper kommer aldrig hit.
/** @returns {Array<{namn: string, fore: number|null, efter: number|null, [k: string]: any}>} */
function _forecastLutningRader(d, sim, niva) {
    const k = kTroskel(), grupper = new Map();
    d.forEach((r, i) => {
        const kv = !!(r.kon && r.kon.includes('kvinna')), ma = r.kon === 'man' || r.kon === 'män';
        if (!(kv || ma) || !sim[i]) return;
        const nyckel = niva === 'bas' ? String(r.bas) : `${r.aid}|${r.bas}`;
        let g = grupper.get(nyckel);
        if (!g) {
            g = { namn: niva === 'bas' ? `BAS ${r.bas}` : `${r.yrkeLabel || r.yrke || r.aid} · ${r.bas}`,
                  markering: markeringFor(r.bas, niva === 'bas' ? null : r.aid), kv: [[], []], ma: [[], []] };
            grupper.set(nyckel, g);
        }
        const h = kv ? g.kv : g.ma;
        h[0].push(r.lon); h[1].push(sim[i].lon);
    });
    const gap = (kv, ma) => { const mm = Stat.median(ma); return mm > 0 ? Stat.median(kv) / mm * 100 : null; };   // kvinnors median i % av mäns
    const fran100 = v => Math.abs(v - 100);
    const farg = (fore, efter) => (fran100(efter) < fran100(fore) - 0.05 ? PALETTE.semantic.ok : fran100(efter) > fran100(fore) + 0.05 ? PALETTE.semantic.kritisk : PALETTE.semantic.neutral);
    return [...grupper.values()].filter(g => g.kv[0].length >= k && g.ma[0].length >= k)
        .map(g => ({ namn: g.namn, markering: g.markering, fore: gap(g.kv[0], g.ma[0]), efter: gap(g.kv[1], g.ma[1]) }))
        .filter(g => g.fore != null && g.efter != null)
        .map(g => ({ ...g, farg: farg(g.fore, g.efter) }));
}
const FORECAST_LUTNING_MAX = 15;
// Samma tal som diagrammet, som tabell: gapet per grupp före och efter påslagen står inte någon annanstans.
function _forecastLutningTabell(rader, niva) {
    const host = document.getElementById('forecast-lutning-tabell');
    if (!host) return;
    if (!rader.length) { host.innerHTML = ''; return; }
    const p = v => _figTalformat(v, 'pct'), diff = v => (v > 0 ? '+' : '') + _figTalformat(v, undefined) + ' procentenheter';
    host.innerHTML = `<table id="forecast-lutning-table" class="data-table fs-sm marg-t-10">
        <thead><tr><th>${niva === 'bas' ? 'BAS-intervall' : 'Yrkesgrupp'}</th><th class="t-hoger">Kvinnors median i % av mäns, före</th><th class="t-hoger">Efter</th><th class="t-hoger">Förändring</th></tr></thead>
        <tbody>${rader.map(r => `<tr><td>${esc(r.namn)}</td><td class="t-hoger">${p(r.fore)}</td><td class="fw-600 ta-hoger">${p(r.efter)}</td><td class="t-hoger">${diff(+(r.efter - r.fore).toFixed(1))}</td></tr>`).join('')}</tbody></table>`;
    for (const [i, tr] of [...host.querySelectorAll('tbody tr')].entries()) if (rader[i].markering) tr._markering = rader[i].markering;
}
function _renderForecastLutning(d, sim) {
    const el = document.getElementById('chart-forecast-lutning');
    if (!el) return;
    const not = document.getElementById('forecast-lutning-not');
    const niva = /** @type {HTMLInputElement} */ ((document.getElementById('forecast-lutning-niva') || {})).value === 'grupp' ? 'grupp' : 'bas';
    const k = kTroskel();
    let rader = d && sim ? _forecastLutningRader(d, sim, niva) : [], fler = 0;
    if (niva === 'grupp') {
        // Yrkesgrupperna är många: bara de där gapet ändras, störst ändring först.
        const andrade = rader.filter(r => r.efter != null && r.fore != null && Math.abs(r.efter - r.fore) >= 0.05).sort((x, y) => Math.abs((y.efter ?? 0) - (y.fore ?? 0)) - Math.abs((x.efter ?? 0) - (x.fore ?? 0)));
        fler = Math.max(0, andrade.length - FORECAST_LUTNING_MAX);
        rader = andrade.slice(0, FORECAST_LUTNING_MAX);
        _forecastLutningTabell(andrade, niva);   // tabellen bär alla ändrade grupper, också dem diagrammet inte ryms
    } else _forecastLutningTabell(rader, niva);
    if (not) not.textContent = !rader.length ? '' : `Det lodräta strecket är värdet före, punkten värdet efter. Grönt: närmar sig 100 % (lika lön). Rött: längre från 100 %. Grått: oförändrat. Bara ${niva === 'bas' ? 'BAS-intervall' : 'yrkesgrupper'} med minst ${k} kvinnor och ${k} män visas.`
        + (fler ? ` Visar de ${FORECAST_LUTNING_MAX} yrkesgrupper där gapet ändras mest; ${fler} till ändras mindre.` : '');
    if (!rader.length) {
        rensaFigur(el);
        const text = !d ? '' : niva === 'bas' ? `Inget BAS-intervall har minst ${k} kvinnor och ${k} män, så kvinnors median i procent av mäns visas inte per BAS-intervall.`
            : `I ingen yrkesgrupp med minst ${k} kvinnor och ${k} män ändras kvinnors median i procent av mäns av påslagen.`;
        el.innerHTML = text ? `<p class="text-dampad-sm marg-8-0">${esc(text)}</p>` : '';
        return;
    }
    ritaFigur(el, foreEfterFigur({ rader, titel: 'Kvinnors median i % av mäns',
        beskrivning: `Kvinnors medianlön i procent av mäns per ${niva === 'bas' ? 'BAS-intervall' : 'yrkesgrupp'} före och efter påslagen i prognosen: strecket är värdet före, punkten värdet efter. Linjen vid 100 procent är lika lön. Samma tal står i tabellen under.` }));
}
document.getElementById('forecast-lutning-niva')?.addEventListener('change', () => updateForecast());

function renderForecast() {
    // Spegla state → statiska kontroller (för config-load)
    const setVal = (id, v) => { const el = document.getElementById(id); if (el && v != null) /** @type {HTMLInputElement} */ (el).value = v; };
    setVal('forecast-budget-mode', state.forecast.budget.mode);
    setVal('forecast-budget-value', state.forecast.budget.value);
    setVal('forecast-generell-mode', state.forecast.generell.mode);
    setVal('forecast-generell-value', state.forecast.generell.value);
    setVal('forecast-min-n', state.forecast.minGroupN);
    setVal('forecast-round', state.forecast.roundStep);
    setVal('forecast-years', state.forecast.years);
    renderForecastTargets();
    updateForecast();
    _renderScenarioCompare();
}
// Kandidater ur § 3:10-paren för förslag, mål-läge och känslighetskurva. Par med en grupp under
// tröskeln tas inte med (undantaget gäller bara fliken Likvärdigt arbete); minsta gruppstorlek för
// riktning är en ytterligare, strängare gräns. Meningen om utelämnade par visas vid förslagen
// (#forecast-par-not) och står i Excel-exporten.
let _fcParNot = '';
function _fcKandidater() {
    let pairs = [];
    try { const lv = likvardighetResultat(); pairs = (lv && lv.pairs) || []; } catch (_e) { pairs = []; }
    const r = _parForRedovisning(pairs);
    _fcParNot = r.not;
    const el = document.getElementById('forecast-par-not');
    if (el) el.textContent = r.not;
    return r.par.map(p => ({ bas: p.kvBas, aid: p.kvAid, gapKr: p.gapKr, n: p.kvN }));
}
function _forecastOptimize() {
    const d = getData();
    if (!d.length) return;
    _forecastReadControls();
    const pott = _fcComputePott(d, state.forecast.budget);
    const gen = _fcAllocate(d, state.forecast.generell, []);
    const riktadPott = Math.max(0, pott - gen.totals.generellCost);
    const cand = _fcKandidater();
    const targets = _fcSuggestTargets(cand, riktadPott, state.forecast.minGroupN || 0);
    if (!targets.length) {
        alert('Inga osakliga gap kunde identifieras i likvärdighetsanalysen för grupper ≥ ' + (state.forecast.minGroupN || 0) + ' personer, eller ingen riktad pott återstår efter det generella påslaget. Sänk minsta storlek eller lägg till riktade potter manuellt.');
        return;
    }
    state.forecast.targets = targets.map(t => ({ bas: t.bas, aid: t.aid, mode: 'kr', value: t.value, dist: 'lowest', targetLevel: 'median', pool: 'equity', kalla: 'par' }));
    renderForecastTargets();
    updateForecast();
}
/**
 * Efter höjd tröskel: tar bort riktade rader som föreslogs ur § 3:10-par (kalla: 'par') vars
 * grupp inte längre finns bland kandidaterna, och uppdaterar meningen om utelämnade par. Rader
 * som användaren lagt till själv står kvar. Anropas av sattKTroskel före omritningen.
 * @returns {number} Antal borttagna rader.
 */
function _fcRensaParMal() {
    if (!state.data.length || !state.forecast || !Array.isArray(state.forecast.targets)) return 0;
    // Utan förslag ur par och utan visad mening finns inget att rensa eller uppdatera — och då
    // ska analysen inte heller köras här (den cachas, och underlaget kan vara på väg in).
    if (!_fcParNot && !state.forecast.targets.some(t => t.kalla === 'par')) return 0;
    const kvar = new Set(_fcKandidater().map(c => c.bas + '|' + c.aid));
    const fore = state.forecast.targets.length;
    state.forecast.targets = state.forecast.targets.filter(t => t.kalla !== 'par' || kvar.has(t.bas + '|' + t.aid));
    return fore - state.forecast.targets.length;
}
// Kriteriebaserad riktning: expandera en massregel till riktade rader.
function _forecastAddByCriteria() {
    const d = getData();
    if (!d.length) return;
    _forecastReadControls();
    const matcher = /** @type {HTMLInputElement} */ (document.getElementById('forecast-rule-match'))?.value || 'kvdom';
    const mode = /** @type {HTMLInputElement} */ (document.getElementById('forecast-rule-mode'))?.value || 'pct';
    const dist = /** @type {HTMLInputElement} */ (document.getElementById('forecast-rule-dist'))?.value || 'lowest';
    const value = parseFloat(/** @type {HTMLInputElement} */ (document.getElementById('forecast-rule-value'))?.value);
    const minN = state.forecast.minGroupN || 0;
    if (!isFinite(value) || value <= 0) { alert('Ange ett belopp (kr eller %) för massregeln.'); return; }
    const groups = _fcSummarizeGroups(d);
    const basMed = {}, basP25 = {};
    getBasIntervals().forEach(b => { basMed[b] = _fcMedian(d.filter(r => r.bas === b).map(r => r.lon)); });
    _fcBandStats(d).forEach(bb => { basP25[bb.bas] = bb.p25; });
    const match = g => {
        if (g.n < minN) return false;
        if (matcher === 'kvdom') return g.andelKv >= 60;
        if (matcher === 'underbas') return g.median < basMed[g.bas];
        if (matcher === 'underp25') return g.median < basP25[g.bas];   // grön-cirklade (under spann)
        return true; // 'all'
    };
    const pool = matcher === 'kvdom' ? 'equity' : 'övrigt';
    const picked = groups.filter(match);
    if (!picked.length) { alert('Inga grupper matchar kriteriet (kontrollera minsta gruppstorlek = ' + minN + ').'); return; }
    let added = 0;
    picked.forEach(g => {
        if (!state.forecast.targets.some(t => t.bas === g.bas && t.aid === g.aid)) {
            state.forecast.targets.push({ bas: g.bas, aid: g.aid, mode, value, dist, targetLevel: 'median', pool });
            added++;
        }
    });
    renderForecastTargets();
    updateForecast();
    if (added === 0) alert('De matchande grupperna fanns redan som riktade rader.');
}
// Mål-läge: bygg riktade rader som stänger en andel av de osakliga gapen (§ 3:10).
function _forecastClosure() {
    const d = getData();
    if (!d.length) return;
    _forecastReadControls();
    const fracPct = parseFloat(/** @type {HTMLInputElement} */ (document.getElementById('forecast-closure-pct'))?.value);
    if (!isFinite(fracPct) || fracPct <= 0) { alert('Ange hur stor andel av de osakliga gapen som ska stängas (%).'); return; }
    const cand = _fcKandidater();
    const targets = _fcClosureTargets(cand, fracPct / 100, state.forecast.minGroupN || 0);
    if (!targets.length) { alert('Inga osakliga gap i likvärdigt arbete att stänga för grupper ≥ ' + (state.forecast.minGroupN || 0) + ' personer.'); return; }
    state.forecast.targets = targets.map(t => ({ bas: t.bas, aid: t.aid, mode: 'kr', value: t.value, dist: 'lowest', targetLevel: 'median', pool: 'equity', kalla: 'par' }));
    renderForecastTargets();
    updateForecast();
}
// Scenario A/B: spara nuläget som ett scenario och jämför.
function _forecastSaveScenario(slot) {
    const o = state.forecast.result;
    if (!o) { alert('Ingen prognos att spara ännu.'); return; }
    const d = getData();
    const sim = d.map((r, i) => ({ ...r, lon: o.alloc.perPerson[i].nyLon }));
    const ols = _forecastOlsGap(d, sim);
    const { nKv, nMa } = _konAntal(d);
    const konOk = _konFarRedovisas(nKv, nMa);   // det råa gapet sparas bara när varje kön når tröskeln
    state.forecast.scenarios[slot] = {
        budgetTxt: (state.forecast.budget.value || 0) + (state.forecast.budget.mode === 'kr' ? ' kr' : ' %'),
        targetsCount: state.forecast.targets.length,
        // Antalen följer med, så att jämförelsen kan pröva rågapet mot den tröskel som gäller när den visas.
        nKv, nMa,
        summary: {
            använt: o.använt, totalKostnad: o.totalKostnad,
            rawGapFore: konOk ? o.rawGapFore : null, rawGapEfter: konOk ? o.rawGapEfter : null,
            oforklaratEfter: ols.efter, equityCost: o.equityCost,
            // Samma urval som spillover-kortet i utfallet: bara grupper som når tröskeln.
            leapfrog: _fcDetectLeapfrog(o.alloc.perGroup.filter(g => !isKMasked(g.n))).length
        }
    };
    _renderScenarioCompare();
}
function _renderScenarioCompare() {
    const host = document.getElementById('forecast-scenarios');
    if (!host) return;
    const sc = state.forecast.scenarios || {};
    if (!sc.A && !sc.B) { host.innerHTML = '<p class="text-dampad-sm marg-0">Spara två scenarier (A/B) för att jämföra utfall sida vid sida.</p>'; return; }
    const kr = n => n == null ? '–' : Math.round(n).toLocaleString('sv-SE') + ' kr';
    const pc = n => n == null ? '–' : (n >= 0 ? '+' : '') + svPct(n, 1);
    // Ett scenario sparat vid en lägre tröskel kan bära ett rågap som inte längre får visas (som
    // A/B-bilden i 19-konfiguration.js). Saknas antalen prövas det mot underlaget som det är nu.
    const nu = _konAntal(getData());
    const konOk = s => _konFarRedovisas(s.nKv ?? nu.nKv, s.nMa ?? nu.nMa);
    const maskerat = [sc.A, sc.B].some(s => s && s.summary.rawGapEfter != null && !konOk(s));
    const col = (s) => s ? `<td class="t-hoger">${kr(s.summary.använt)}</td><td class="t-hoger">${kr(s.summary.totalKostnad)}</td><td class="t-hoger">${andelAvMan(konOk(s) ? s.summary.rawGapEfter : null)}</td><td class="t-hoger">${pc(s.summary.oforklaratEfter)}</td><td class="t-hoger">${kr(s.summary.equityCost)}</td><td class="t-hoger">${s.summary.leapfrog}</td>` : '<td colspan="6" class="farg-dampad kursiv">ej sparat</td>';
    host.innerHTML = `<table class="data-table fs-sm">
        <thead><tr><th>Scenario</th><th class="t-hoger">Använt/mån</th><th class="t-hoger">Total kostnad</th><th class="t-hoger">Kv. median i % av mäns, efter</th><th class="t-hoger">Oförkl. efter</th><th class="t-hoger">Till kv-dom</th><th class="t-hoger">Spillover</th></tr></thead>
        <tbody>
            <tr><td><strong>A</strong> ${sc.A ? `<span class="f-dampad">(${esc(sc.A.budgetTxt)}, ${sc.A.targetsCount} riktade)</span>` : ''}</td>${col(sc.A)}</tr>
            <tr><td><strong>B</strong> ${sc.B ? `<span class="f-dampad">(${esc(sc.B.budgetTxt)}, ${sc.B.targetsCount} riktade)</span>` : ''}</td>${col(sc.B)}</tr>
        </tbody></table>${maskerat ? `<p class="k-mask-note">Kvinnors median i procent av mäns visas inte: ett kön har färre än ${kTroskel()} personer i urvalet.</p>` : ''}`;
}
// Kör OLS på en given radmängd via data-swap. Returnerar {konPct, pValue}.
function _forecastOlsOn(rows) {
    const sd = state.data;
    let res = { konPct: null, pValue: null };
    try {
        state.data = rows;
        const r = runOLSRegression();
        if (r && !r.error) res = { konPct: r.konPct, pValue: r.pValue };
    } finally { state.data = sd; }
    return res;
}
// (C) Tröskelmål: minsta likalönslyft till kvinnor för att nå mål-gap / icke-signifikans.
function _forecastThreshold() {
    const host = document.getElementById('forecast-threshold-result');
    const d = getData();
    if (!host) return;
    if (!d.length) { host.innerHTML = ''; return; }
    // Lyftet i procent och dess kostnad är kvinnornas lönesumma gånger procentsatsen — ett könsuppdelat
    // lönemått. Det visas bara när varje kön når tröskeln (regressionen jämför mot män); annars ett streck
    // med förklaring (beslut av produktägaren 2026-10-16).
    if (!_konFarRedovisasFor(d)) { host.innerHTML = `<span class="f-dampad">– ${esc(_konUtelamnatNot())}</span>`; return; }
    const tgt = parseFloat(/** @type {HTMLInputElement} */ (document.getElementById('forecast-threshold-pct'))?.value) || 5;
    const useSig = !!/** @type {HTMLInputElement} */ (document.getElementById('forecast-threshold-sig'))?.checked;
    const women = d.filter(r => r.kon && r.kon.includes('kvinna'));
    const base = _forecastOlsOn(d);
    if (base.konPct == null) { host.innerHTML = '<span class="f-dampad">För få observationer för regression.</span>'; return; }
    const okFor = g => useSig ? (g.pValue == null || g.pValue > 0.05) : (g.konPct != null && g.konPct >= -tgt);
    const evalLift = x => {
        const sim = d.map(r => (r.kon && r.kon.includes('kvinna')) ? { ...r, lon: r.lon * (1 + x / 100) } : r);
        const g = _forecastOlsOn(sim);
        return { ...g, cost: women.reduce((s, r) => s + r.lon * x / 100, 0) };
    };
    if (okFor(base)) { host.innerHTML = `<span class="farg-ok">${ikon('bock')} Målet är redan uppfyllt (oförklarat gap ${svPct(base.konPct, 1)}${useSig ? `, p=${base.pValue == null ? '–' : svTal(base.pValue, 3)}` : ''}).</span>`; return; }
    let lo = 0, hi = 40;
    if (!okFor(evalLift(hi))) { host.innerHTML = `<span class="f-kritisk">Mer än 40 % likalönslyft skulle krävas — kontrollera datan/modellen.</span>`; return; }
    for (let it = 0; it < 22; it++) { const mid = (lo + hi) / 2; if (okFor(evalLift(mid))) hi = mid; else lo = mid; }
    const res = evalLift(hi);
    const months = (state.costSettings && state.costSettings.months) || 12;
    const poFactor = 1 + ((state.costSettings && state.costSettings.poPct) || 0) / 100;
    host.innerHTML = `<div class="fs-sm lh-1_6">
        För att nå <strong>${useSig ? 'icke-signifikant oförklarat gap (p&gt;0,05)' : 'oförklarat gap ≥ −' + tgt + ' %'}</strong> krävs ett likalönslyft på <strong>≈ ${svPct(hi, 1)}</strong> till kvinnor.
        <br>Kostnad: <strong>≈ ${Math.round(res.cost).toLocaleString('sv-SE')} kr/mån</strong> (≈ ${Math.round(res.cost * months * poFactor).toLocaleString('sv-SE')} kr inkl. PO/period). Oförklarat gap då: ${res.konPct == null ? '–' : svPct(res.konPct, 2)}.
        <br><span class="text-dampad-xs">Informativ beräkning (jämn lyft-procent till kvinnor) — för fördelning per grupp, använd förslags-/mål-knapparna.</span>
    </div>`;
}
// (E) Marknadspositionering: lyft grupper under marknad × factor.
function _forecastMarket() {
    const d = getData();
    if (!d.length) return;
    _forecastReadControls();
    const f = (parseFloat(/** @type {HTMLInputElement} */ (document.getElementById('forecast-market-factor'))?.value) || 95) / 100;
    const market = new Map();
    (state.statistik || []).forEach(s => {
        if (!(s.median > 0)) return;
        if (s.aid != null && s.bas != null) market.set(String(s.aid) + '|' + String(s.bas), s.median);
        if (s.aid != null && !market.has(String(s.aid))) market.set(String(s.aid), s.median);
    });
    if (!market.size) { alert('Ingen marknadsstatistik inläst (ladda upp jämförelsestatistik).'); return; }
    const groups = _fcSummarizeGroups(d);
    const t = _fcMarketTargets(groups, market, f, state.forecast.minGroupN || 0);
    if (!t.length) { alert('Inga grupper ligger under marknad × ' + svTal(f * 100, 0) + ' % (eller marknadsmatchning saknas) för grupper ≥ ' + (state.forecast.minGroupN || 0) + '.'); return; }
    let added = 0;
    t.forEach(x => { if (!state.forecast.targets.some(y => y.bas === x.bas && y.aid === x.aid)) { state.forecast.targets.push({ bas: x.bas, aid: x.aid, mode: 'kr', value: x.value, dist: 'lowest', targetLevel: 'median', pool: 'marknad' }); added++; } });
    renderForecastTargets();
    updateForecast();
    if (!added) alert('De matchande grupperna fanns redan som riktade rader.');
}
// (F) Budgetkänslighetskurva (§3:10-stängning 0→100 %).
function _forecastSensitivity() {
    const host = document.getElementById('forecast-sensitivity');
    const d = getData();
    if (!host) return;
    if (!d.length) { host.innerHTML = ''; return; }
    _forecastReadControls();
    const cand = _fcKandidater();
    if (!cand.length) { host.innerHTML = '<span class="text-dampad-sm">Inga gap i likvärdigt arbete att svepa (kräver identifierade osakliga gap).</span>'; return; }
    const cost = { months: (state.costSettings && state.costSettings.months) || 12, poPct: (state.costSettings && state.costSettings.poPct) || 0, roundStep: state.forecast.roundStep || 0 };
    const curve = _fcSensitivityCurve(d, cand, cost, 10);
    if (!_konFarRedovisasFor(d)) curve.forEach(c => { c.rawGap = null; });   // k: det råa gapet följer tröskeln
    const maxGap = Math.max(...curve.map(c => Math.abs(c.rawGap || 0)), 0.01);
    const kr = n => Math.round(n).toLocaleString('sv-SE') + ' kr';
    host.innerHTML = `<table class="data-table fs-sm"><thead><tr><th>Stängt av gap</th><th class="t-hoger">Total kostnad</th><th class="t-hoger">Kvinnors median i % av mäns</th><th>　</th></tr></thead><tbody>
        ${curve.map(c => `<tr><td>${svPct((c.fraction * 100), 0)}</td><td class="t-hoger">${kr(c.kostnad)}</td><td class="t-hoger">${c.rawGap == null ? '–' : andelAvMan(c.rawGap)}</td><td><div class="rund-4 hojd-9 min-bredd-2 bg-info" data-stil-bredd="${(Math.abs(c.rawGap || 0) / maxGap * 100).toFixed(0)}%"></div></td></tr>`).join('')}
    </tbody></table><p class="text-dampad-xs marg-6-0-0">Avtagande avkastning: visar hur det råa gapet och kostnaden utvecklas när en allt större andel av gapen i likvärdigt arbete stängs.${_fcParNot ? ' ' + esc(_fcParNot) : ''}</p>`; tillampaDataStil(host);
}
// (B) Individnivå-remediation (DiskrL 3:9).
function _forecastRemediation() {
    const host = document.getElementById('forecast-rem-result');
    const d = getData();
    if (!host) return;
    if (!d.length) { host.innerHTML = ''; return; }
    const gp = parseFloat(/** @type {HTMLInputElement} */ (document.getElementById('forecast-rem-pct'))?.value);
    // k-anonymitet: jämförelsen kräver tröskeln i antal män (mot en enda mans lön vore kostnaden
    // hans lön minus hennes), och en grupp får egen rad först när tröskeln i antal kvinnor berörs.
    const rem = _fcIndividualRemediation(d, { gapPct: isFinite(gp) ? gp : 5, minMen: kTroskel() });
    state.forecast._remediation = rem;
    const months = (state.costSettings && state.costSettings.months) || 12;
    const poFactor = 1 + ((state.costSettings && state.costSettings.poPct) || 0) / 100;
    const kr = n => Math.round(n).toLocaleString('sv-SE') + ' kr';
    if (!rem.count) { host.innerHTML = `<span class="farg-ok">${ikon('bock')} Inga kvinnor ligger mer än tröskeln under sitt jämförelsevärde.</span>`; return; }
    const K = kTroskel();
    const visade = rem.perGroup.filter(g => g.count >= K);
    const dolda = rem.perGroup.length - visade.length;
    const rowsHtml = visade.slice(0, 12).map(g => `<tr><td>${esc(g.bas)}</td><td>${esc(g.aid)}</td><td class="t-hoger">${g.count}</td><td class="t-hoger">${kr(g.cost)}/mån</td></tr>`).join('');
    // Summan är ett lönemått över de berörda: den visas först när de är minst K.
    const summa = rem.count >= K
        ? `Kostnad att lyfta alla till jämförelsevärdet: <strong>${kr(rem.totalCost)}/mån</strong> (≈ ${kr(rem.totalCost * months * poFactor)} inkl. PO/period).`
        : `Kostnaden visas inte, eftersom färre än ${K} personer berörs.`;
    const doldaNot = dolda
        ? `<p class="k-mask-note">${dolda} ${dolda === 1 ? 'grupp' : 'grupper'} där färre än ${K} kvinnor berörs ${rem.count >= K ? 'ingår i summan men ' : ''}redovisas inte per grupp och blir inga riktade rader.</p>`
        : '';
    host.innerHTML = `<div class="fs-sm marg-b-8"><strong>${rem.count}</strong> individer (kvinnor) ligger mer än tröskeln under sitt jämförelsevärde. ${summa}</div>
        ${rowsHtml ? `<table class="data-table st-085"><thead><tr><th>BAS</th><th>Yrke (AID)</th><th class="t-hoger">Antal</th><th class="t-hoger">Kostnad</th></tr></thead><tbody>${rowsHtml}</tbody></table>` : ''}${doldaNot}
        <p class="text-dampad-xs marg-6-0-0">Jämförelsevärdet är mäns median i samma yrke (BAS×AID) när minst ${K} män finns där, annars mäns median i BAS (också minst ${K} män). Endast aggregat visas. Den slutliga bedömningen av sakliga skäl görs manuellt.</p>`;
}
function _forecastRemediationSeed() {
    const rem = state.forecast._remediation;
    if (!rem || !rem.perGroup.length) { alert('Kör analysen först.'); return; }
    let added = 0;
    // Bara grupper som fått egen rad blir riktade rader (beloppet står i raden).
    const visade = rem.perGroup.filter(g => g.count >= kTroskel());
    if (!visade.length) { alert(`Ingen grupp har minst ${kTroskel()} berörda — inga riktade rader läggs till.`); return; }
    visade.forEach(g => {
        if (!state.forecast.targets.some(t => t.bas === g.bas && t.aid === g.aid)) {
            state.forecast.targets.push({ bas: g.bas, aid: g.aid, mode: 'kr', value: Math.round(g.cost), dist: 'lowest', targetLevel: 'median', pool: 'equity' });
            added++;
        }
    });
    renderForecastTargets();
    updateForecast();
    if (!added) alert('Grupperna fanns redan som riktade rader.');
}
// Går alltid genom exportläget (ADR-51): djupräknaren håller skärmen i exportläget tills den sista pågående exporten är klar.
function exportForecast(...a) { return medExportLage(() => _exportForecastExport.apply(null, /** @type {any} */ (a))); }
function _exportForecastExport() {
    if (typeof XLSX === 'undefined') { alert('Excel-biblioteket kunde inte laddas.'); return; }
    const out = state.forecast.result;
    if (!out) { alert('Ingen prognos att exportera ännu.'); return; }
    _fcKandidater();   // uppdaterar meningen om utelämnade par efter gällande tröskel
    const kr = n => Math.round(n);
    const K = kTroskel();
    const konOk = _konFarRedovisasFor(getData());
    const exportGrupper = out.alloc.perGroup.filter(g => Math.abs(g.kostnad) > 0.5).sort((a, b) => b.kostnad - a.kostnad);
    const antalMaskerade = exportGrupper.filter(g => g.n < K).length;
    const meta = [
        ['Löneöversyn — prognosunderlag', ''],
        ['Genererad', new Date().toLocaleString('sv-SE')],
        ['Verktyg', 'Öppen lönekartläggning v' + (typeof APP_VERSION !== 'undefined' ? APP_VERSION : '–')],
        ['', ''],
        ['Budgetläge', state.forecast.budget.mode === 'kr' ? 'Krontal/mån' : '% av lönesumman'],
        ['Budgetvärde', state.forecast.budget.value],
        ['Pott (kr/mån)', kr(out.pott)],
        ['Använt (kr/mån)', kr(out.använt)],
        ['Kvar att fördela (kr/mån)', kr(out.kvar)],
        ['Generellt påslag', (state.forecast.generell.value || 0) + (state.forecast.generell.mode === 'kr' ? ' kr/mån' : ' %')],
        ['Minsta gruppstorlek för riktning', state.forecast.minGroupN || 0],
        ...state.forecast.targets.map((t, i) => [`Riktad pott ${i + 1}`, `BAS ${t.bas}, ${t.aid === '*' ? 'alla yrken' : 'AID ' + t.aid}${t.kon === 'kvinna' ? ', bara kvinnor' : t.kon === 'man' ? ', bara män' : ''}${t.lonCap > 0 ? `, löner under ${Math.round(t.lonCap)} kr` : ''}: ${t.mode === 'till' ? `höj till ${t.value} kr/mån` : t.mode === 'kr' ? `${t.value} kr/mån` : `${t.value} % av grupplön`}${t.mode === 'till' ? '' : ` (${{ flat: 'lika %', lowest: 'lägst först', target: 'mot målnivå' }[t.dist] || t.dist})`}`]),
        ...(_fcParNot ? [['Utelämnade kandidatpar (likvärdigt arbete)', _fcParNot]] : []),
        ['Avrundning av nya löner (kr)', state.forecast.roundStep || 0],
        ['Stegvis plan (antal år)', state.forecast.years || 1],
        ['Generellt (kr/mån)', kr(out.generellCost || 0)],
        ['Riktat (kr/mån)', kr(out.riktadCost || 0)],
        ['Varav till kvinnodominerade grupper (kr/mån)', kr(out.equityCost || 0)],
        ['Spillover-varningar (grupper som går om en högre grupp)', _fcDetectLeapfrog(out.alloc.perGroup.filter(g => !isKMasked(g.n))).length],
        ['Total kostnad (inkl. PO + period)', kr(out.totalKostnad)],
        ['Lönesumma före (kr/mån)', kr(out.lonsummaFore)],
        ['Lönesumma efter (kr/mån)', kr(out.lonsummaEfter)],
        ['Kvinnors medianlön i % av mäns, före', !konOk || out.rawGapFore == null ? '–' : +(100 + out.rawGapFore).toFixed(1)],
        ['Kvinnors medianlön i % av mäns, efter', !konOk || out.rawGapEfter == null ? '–' : +(100 + out.rawGapEfter).toFixed(1)],
        ...(konOk ? [] : [['Könsuppdelade mått', _konUtelamnatNot()]]),
        ...(antalMaskerade ? [['Grupper under tröskeln', `${antalMaskerade} ${antalMaskerade === 1 ? 'grupp' : 'grupper'} med färre än ${K} personer ingår i summorna, men ${antalMaskerade === 1 ? 'dess' : 'deras'} medianer och kostnad redovisas inte per grupp.`]] : []),
        ['', ''],
        ['OBS', 'Endast aggregat. Råa individlöner ingår ej (Privacy by Design). Slutlig löneöversyn dokumenteras i Word/handlingsplan.']
    ];
    const header = ['BAS', 'Yrke (AID)', 'n', 'Andel kvinnor (%)', 'Gammal median', 'Ny median', 'Förändring (%)', 'Kostnad (kr/mån)'];
    const body = exportGrupper.map(g => {
        const masked = g.n < K;
        return [g.bas, g.aid, g.n, +g.andelKv.toFixed(0),
            masked ? 'n<' + K : kr(g.gammalMedian),
            masked ? 'n<' + K : kr(g.nyMedian),
            masked ? '' : +(100 * (g.nyMedian / g.gammalMedian - 1)).toFixed(1),
            masked ? '' : kr(g.kostnad)];
    });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(meta), 'Sammanfattning');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([header, ...body]), 'Fördelning');
    _appendMethodSheet(wb);
    XLSX.writeFile(wb, `loneoversyn_prognos_${new Date().toISOString().slice(0, 10)}.xlsx`);
    if (typeof announceToScreenReader === 'function') announceToScreenReader('Löneöversynens prognosunderlag exporterat.');
}
(function wireForecast() {
    ['forecast-budget-mode', 'forecast-budget-value', 'forecast-generell-mode', 'forecast-generell-value', 'forecast-min-n', 'forecast-round', 'forecast-years'].forEach(id => {
        const el = document.getElementById(id);
        if (el) { el.addEventListener('input', updateForecast); el.addEventListener('change', updateForecast); }
    });
    document.getElementById('forecast-closure')?.addEventListener('click', _forecastClosure);
    document.getElementById('forecast-market-btn')?.addEventListener('click', _forecastMarket);
    document.getElementById('forecast-threshold-btn')?.addEventListener('click', _forecastThreshold);
    document.getElementById('forecast-sensitivity-btn')?.addEventListener('click', _forecastSensitivity);
    document.getElementById('forecast-rem-btn')?.addEventListener('click', _forecastRemediation);
    document.getElementById('forecast-rem-seed')?.addEventListener('click', _forecastRemediationSeed);
    document.getElementById('forecast-save-a')?.addEventListener('click', () => _forecastSaveScenario('A'));
    document.getElementById('forecast-save-b')?.addEventListener('click', () => _forecastSaveScenario('B'));
    document.getElementById('forecast-add-target')?.addEventListener('click', () => {
        const basList = getBasIntervals();
        const bas = basList[0] || '';
        const aid = (_forecastAidsForBas(bas)[0] || {}).aid || '';
        state.forecast.targets.push({ bas, aid, kon: 'alla', lonCap: null, mode: 'kr', value: null, dist: 'lowest', targetLevel: 'median', pool: 'övrigt' });
        renderForecastTargets();
        updateForecast();
    });
    document.getElementById('forecast-add-criteria')?.addEventListener('click', _forecastAddByCriteria);
    document.getElementById('forecast-optimize')?.addEventListener('click', _forecastOptimize);
    document.getElementById('forecast-export')?.addEventListener('click', exportForecast);
    document.getElementById('forecast-reset')?.addEventListener('click', () => {
        state.forecast = { budget: { mode: 'pct', value: null }, generell: { mode: 'pct', value: null }, targets: [], minGroupN: 10, roundStep: 0, years: 1, scenarios: { A: null, B: null }, result: null };
        ['forecast-budget-value', 'forecast-generell-value'].forEach(id => { const el = document.getElementById(id); if (el) /** @type {HTMLInputElement} */ (el).value = ''; });
        const mn = document.getElementById('forecast-min-n'); if (mn) /** @type {HTMLInputElement} */ (mn).value = '10';
        const rs = document.getElementById('forecast-round'); if (rs) /** @type {HTMLInputElement} */ (rs).value = '0';
        const yr = document.getElementById('forecast-years'); if (yr) /** @type {HTMLInputElement} */ (yr).value = '1';
        renderForecast();
    });
})();

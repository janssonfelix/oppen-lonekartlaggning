// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson

// ---- Datavalideringsrapport (efter CSV-parse) ----
/**
 * Reality-check-panel.
 *
 * Före HR börjar tolka analyserna, kör en sanity-check av att underlaget
 * är rimligt. Fångar t.ex. fel kolumnmappning (95 % män), orealistiska
 * åldrar (medianålder 19 år) eller löner som lämnats i ören istället för
 * kronor. Skyddar mot tysta tolkningsfel.
 *
 * Klassificering av varje check:
 *   ✅ grönt   — inom rimligt intervall
 *   ⚠ gult    — utanför typiskt intervall men inte omöjligt
 *   🔴 rött   — extremt avvikande, kontrollera mappningen
 */
function renderRealityCheck() {
    const wrap = document.getElementById('reality-check');
    if (!wrap) return;
    if (!state.data.length) { wrap.style.display = 'none'; wrap.innerHTML = ''; return; }

    const d = state.data;
    const n = d.length;

    // Check 1: könsfördelning
    const nKv = d.filter(r => r.kon.includes('kvinna')).length;
    const pctKv = n > 0 ? nKv / n * 100 : 0;
    let konStatus, konMsg;
    if (pctKv >= 30 && pctKv <= 70) {
        konStatus = 'ok';
        konMsg = `Könsfördelning: <strong>${svPct(pctKv, 1)} kvinnor, ${svPct((100 - pctKv), 1)} män</strong>. Inom typiskt kommunalt intervall (30–70 %).`;
    } else if (pctKv >= 15 && pctKv <= 85) {
        konStatus = 'warn';
        konMsg = `Könsfördelning: <strong>${svPct(pctKv, 1)} kvinnor, ${svPct((100 - pctKv), 1)} män</strong>. Skev men inte omöjlig — vanligt i specialiserade organisationer (t.ex. teknisk eller socialtjänst).`;
    } else {
        konStatus = 'err';
        konMsg = `Könsfördelning: <strong>${svPct(pctKv, 1)} kvinnor, ${svPct((100 - pctKv), 1)} män</strong>. Extremt avvikande — <strong>kontrollera att kön-kolumnen är korrekt mappad</strong>. En vanlig felkälla är att kolumnen innehåller ett ID istället för "Kvinna"/"Man".`;
    }

    // Check 2: medianålder
    const ages = d.map(r => r.alder).filter(a => a > 0);
    const medAge = ages.length ? Stat.median(ages) : 0;
    const minAge = ages.length ? Math.min(...ages) : 0;
    const maxAge = ages.length ? Math.max(...ages) : 0;
    let alderStatus, alderMsg;
    if (medAge >= 38 && medAge <= 55) {
        alderStatus = 'ok';
        alderMsg = `Medianålder: <strong>${svTal(medAge, 0)} år</strong> (spann ${minAge}–${maxAge}). Inom typiskt kommunalt intervall (38–55 år).`;
    } else if (medAge >= 30 && medAge <= 60) {
        alderStatus = 'warn';
        alderMsg = `Medianålder: <strong>${svTal(medAge, 0)} år</strong> (spann ${minAge}–${maxAge}). Något utanför typiskt intervall — kontrollera om datan kommer från en specifik organisation med ovanlig demografi.`;
    } else {
        alderStatus = 'err';
        alderMsg = `Medianålder: <strong>${svTal(medAge, 0)} år</strong> (spann ${minAge}–${maxAge}). Extremt avvikande — <strong>kontrollera ålders-kolumnen</strong>. Vanlig felkälla är att ett anställningsdatum lästs in som ålder, eller att kolumnen visar år för anställning istället.`;
    }

    // Check 3: lönespridning (P10, median, P90)
    const lons = d.map(r => r.lon).filter(l => l > 0);
    const p10 = Stat.quantile(lons, 0.10);
    const p50 = Stat.median(lons);
    const p90 = Stat.quantile(lons, 0.90);
    const fmtK = v => Math.round(v).toLocaleString('sv-SE') + ' kr';
    let lonStatus, lonMsg;
    if (p50 >= 25000 && p50 <= 60000) {
        lonStatus = 'ok';
        lonMsg = `Lönespridning: P10 <strong>${fmtK(p10)}</strong> · median <strong>${fmtK(p50)}</strong> · P90 <strong>${fmtK(p90)}</strong>. Inom typiskt svenskt kommunintervall.`;
    } else if (p50 >= 15000 && p50 < 25000) {
        lonStatus = 'warn';
        lonMsg = `Lönespridning: P10 <strong>${fmtK(p10)}</strong> · median <strong>${fmtK(p50)}</strong> · P90 <strong>${fmtK(p90)}</strong>. Låg medianlön — finns deltidsanställda räknade som heltid i underlaget? Lönen bör vara heltidsekvivalent.`;
    } else if (p50 > 60000 && p50 <= 90000) {
        lonStatus = 'warn';
        lonMsg = `Lönespridning: P10 <strong>${fmtK(p10)}</strong> · median <strong>${fmtK(p50)}</strong> · P90 <strong>${fmtK(p90)}</strong>. Hög medianlön — typisk för specialistorganisationer eller äldre data har lönerevisionerats.`;
    } else {
        lonStatus = 'err';
        lonMsg = `Lönespridning: P10 <strong>${fmtK(p10)}</strong> · median <strong>${fmtK(p50)}</strong> · P90 <strong>${fmtK(p90)}</strong>. Extremt avvikande — <strong>kontrollera lön-kolumnen</strong>. Vanlig felkälla: lönen är angiven i ören (multiplicera med 1/100), årslön istället för månadslön (dela med 12), eller deltidsproportionerad istället för heltidsekvivalent.`;
    }

    // (BAS-maskeringen bedöms nu av kriteriet Jämförbarhet i Underlagets kvalitet, ADR-19.)

    // Check 5: FTE-heuristik — andel löner under heltidsgolvet.
    // Check 3 fångar bara när MEDIANEN är låg; den vanliga felmoden är blandade
    // heltids- och ej omräknade deltidslöner (normal median, fet låg svans).
    // Heltidslöner i kommunal sektor understiger i praktiken inte ~20 000 kr/mån;
    // deltid på 50–75 % hamnar ofta på 12–18 000 kr.
    const FTE_GOLV = 20000;
    const nLow = lons.filter(l => l < FTE_GOLV).length;
    const pctLow = lons.length ? (nLow / lons.length) * 100 : 0;
    let fteStatus, fteMsg;
    if (nLow === 0) {
        fteStatus = 'ok';
        fteMsg = `Inga löner under ${fmtK(FTE_GOLV)}/mån — förenligt med heltidsomräknade (FTE) löner, som verktyget förutsätter.`;
    } else if (pctLow <= 2) {
        fteStatus = 'ok';
        fteMsg = `${nLow} lön${nLow === 1 ? '' : 'er'} (${svPct(pctLow, 1)}) under ${fmtK(FTE_GOLV)}/mån — enstaka undantag (t.ex. ungdomsanställningar) är normalt. Verktyget förutsätter heltidsomräknade (FTE) löner.`;
    } else if (pctLow <= 15) {
        fteStatus = 'warn';
        fteMsg = `<strong>${nLow}</strong> löner (<strong>${svPct(pctLow, 1)}</strong>) ligger under ${fmtK(FTE_GOLV)}/mån — kontrollera att månadslönerna är <strong>heltidsomräknade (FTE)</strong>. Ej omräknade deltidslöner snedvrider hela könsanalysen, eftersom deltid oftast är kvinnodominerad.`;
    } else {
        fteStatus = 'err';
        fteMsg = `<strong>${nLow}</strong> löner (<strong>${svPct(pctLow, 1)}</strong>) ligger under ${fmtK(FTE_GOLV)}/mån — underlaget ser <strong>inte</strong> heltidsomräknat ut. Exportera lönerna som heltidsekvivalenter (FTE) ur lönesystemet innan analysen används; ej omräknade deltidslöner gör könsjämförelserna missvisande.`;
    }

    const icon = s => s === 'ok' ? ikon('bock') : s === 'warn' ? ikon('statusVarning') : ikon('statusKritisk');
    const allStatuses = [konStatus, alderStatus, lonStatus, fteStatus];
    const hasErr = allStatuses.includes('err');
    const hasWarn = allStatuses.includes('warn');
    const headerClass = hasErr ? 'has-err' : hasWarn ? 'has-warn' : 'all-ok';
    wrap.style.display = 'block';
    wrap.className = 'reality-check ' + headerClass;
    wrap.innerHTML = `
        <h4 class="text-dampad-xs versal marg-0-0-6">Rimlighet i detalj</h4>
        <p class="text-dampad-sm marg-0-0-12">
            Fångar typiska mappningsfel (fel kolumn, fel enhet, fel kön-kodning). Verktyget kan inte
            avgöra om värdena är "rätt" — bara att de är inom rimliga intervall.
        </p>
        <ul class="reality-list utan-punkter marg-0 pad-0">
            <li class="rc-${konStatus} rund-0-4-4-0 fs-md lh-1_5 marg-b-6 pad-8-10">
                <span class="mr-6">${icon(konStatus)}</span>${konMsg}
            </li>
            <li class="rc-${alderStatus} rund-0-4-4-0 fs-md lh-1_5 marg-b-6 pad-8-10">
                <span class="mr-6">${icon(alderStatus)}</span>${alderMsg}
            </li>
            <li class="rc-${lonStatus} rund-0-4-4-0 fs-md lh-1_5 marg-b-6 pad-8-10">
                <span class="mr-6">${icon(lonStatus)}</span>${lonMsg}
            </li>
            <li class="rc-${fteStatus} rund-0-4-4-0 fs-md lh-1_5 marg-b-6 pad-8-10">
                <span class="mr-6">${icon(fteStatus)}</span>${fteMsg}
            </li>
        </ul>
    `;
}

function renderDataValidationReport() {
    const wrap = document.getElementById('data-validation-report');
    if (!wrap) return;
    if (!state.data.length) { wrap.style.display = 'none'; wrap.innerHTML = ''; return; }

    const da = state.dataAudit || {};
    const totalRaw = da.totalRaw || 0;
    const excludedNoBas = da.excludedNoBas || 0;
    const excludedZeroLon = da.excludedZeroLon || 0;
    const excludedMissingKon = da.excludedMissingKon || 0;
    const invalidLon = da.invalidLon || 0;
    const invalidAlder = da.invalidAlder || 0;
    const invalidLonExamples = da.invalidLonExamples || [];
    const invalidAlderExamples = da.invalidAlderExamples || [];
    const missingKonExamples = da.missingKonExamples || [];
    const used = state.data.length;

    // Räkna varningar
    const outliers = detectOutliers(3);
    const bas = getBasIntervals();
    const singleSexBas = bas.filter(b => {
        const sub = state.data.filter(r => r.bas === b);
        if (sub.length < 3) return false;
        const hasKv = sub.some(r => r.kon.includes('kvinna'));
        const hasMa = sub.some(r => r.kon === 'man' || r.kon === 'män');
        return !hasKv || !hasMa;
    }).length;
    const kMaskedBas = bas.filter(b => state.data.filter(r => r.bas === b).length < kTroskel()).length;

    // Konsistenskontroll
    const dataBas = [...new Set(state.data.map(r => r.bas))].sort();
    const dataAids = [...new Set(state.data.map(r => { const m = r.yrke.match(/^(\d+)/); return m ? m[1] : null; }).filter(Boolean))];
    /** @type {any} */ let polStatus = null;
    /** @type {any} */ let statStatus = null;
    if (state.policy.length) {
        const polBas = state.policy.map(p => p.bas);
        const missing = dataBas.filter(b => !polBas.includes(b));
        polStatus = { ok: missing.length === 0, missing };
    }
    if (state.statistik.length) {
        const statAids = [...new Set(state.statistik.map(s => s.aid))];
        const missing = dataAids.filter(a => !statAids.includes(a));
        statStatus = { ok: missing.length === 0, missing };
    }

    const warnings = outliers.length + singleSexBas + (polStatus && !polStatus.ok ? 1 : 0) + (statStatus && !statStatus.ok ? 1 : 0);
    const hasWarnings = warnings > 0;

    const fmt = n => n.toLocaleString('sv-SE');

    wrap.className = 'data-validation-report' + (hasWarnings ? ' has-warnings' : '');
    wrap.style.display = 'block';
    wrap.innerHTML = `
        <h4 class="text-dampad-xs versal marg-14-0-8">Inläsning & varningar${hasWarnings ? ' — ' + warnings + ' att granska' : ''}</h4>
        <div class="dvr-grid">
            <div class="dvr-section">
                <h4>Från fil till analys</h4>
                <div class="dvr-row ok"><span>Total rader i fil:</span><span class="dvr-value">${fmt(totalRaw)}</span></div>
                ${excludedNoBas > 0 ? `<div class="dvr-row warn"><span><span class="dvr-icon">−</span>Saknar BAS:</span><span class="dvr-value">${fmt(excludedNoBas)}</span></div>` : ''}
                ${excludedZeroLon > 0 ? `<div class="dvr-row warn"><span><span class="dvr-icon">−</span>Lön ≤ 0:</span><span class="dvr-value">${fmt(excludedZeroLon)}</span></div>` : ''}
                ${excludedMissingKon > 0 ? `<div class="dvr-row warn"><span><span class="dvr-icon">−</span>Saknar/okänt kön:${missingKonExamples.length ? ' <span class="text-dampad-xs">ex: ' + missingKonExamples.map(e => '"' + esc(e) + '"').join(', ') + '</span>' : ''}</span><span class="dvr-value">${fmt(excludedMissingKon)}</span></div>` : ''}
                ${invalidLon > 0 ? `<div class="dvr-row warn"><span><span class="dvr-icon">${ikon('statusVarning')}</span>Ogiltig lön (text):${invalidLonExamples.length ? ' <span class="text-dampad-xs">ex: ' + invalidLonExamples.map(e => '"' + esc(e) + '"').join(', ') + '</span>' : ''}</span><span class="dvr-value">${fmt(invalidLon)}</span></div>` : ''}
                ${invalidAlder > 0 ? `<div class="dvr-row warn"><span><span class="dvr-icon">${ikon('statusVarning')}</span>Ogiltig ålder (text):${invalidAlderExamples.length ? ' <span class="text-dampad-xs">ex: ' + invalidAlderExamples.map(e => '"' + esc(e) + '"').join(', ') + '</span>' : ''}</span><span class="dvr-value">${fmt(invalidAlder)}</span></div>` : ''}
                <div class="dvr-row dvr-total ok"><span>= Inlästa:</span><span class="dvr-value">${fmt(used)}</span></div>
                ${totalRaw > 0 ? `<div class="text-dampad-xs marg-t-4">Användbarhetsgrad: <strong>${svPct((used / Math.max(1, totalRaw) * 100), 1)}</strong> av filens rader.</div>` : ''}
                ${(invalidLon > 0 || invalidAlder > 0 || excludedMissingKon > 0) ? `<div class="farg-varning fs-xs lh-1_4 marg-t-6">Granska om antalet är högt — kan signalera ett systematiskt fel i exporten från lönesystemet. Exempel-värdena ovan visar de första 3 mönstren som föll ut, för felsökning.</div>` : ''}
            </div>

            <div class="dvr-section">
                <h4>Datavarningar</h4>
                ${outliers.length > 0
                    ? `<div class="dvr-row warn"><span><span class="dvr-icon">${ikon('statusVarning')}</span>Extremvärden (mer än 3 standardavvikelser):</span><span class="dvr-value">${outliers.length}</span></div>`
                    : `<div class="dvr-row ok"><span><span class="dvr-icon">${ikon('bock')}</span>Inga extremvärden (mer än 3 standardavvikelser)</span><span></span></div>`}
                ${singleSexBas > 0
                    ? `<div class="dvr-row warn"><span><span class="dvr-icon">${ikon('statusVarning')}</span>Enkönade BAS:</span><span class="dvr-value">${singleSexBas}</span></div>`
                    : `<div class="dvr-row ok"><span><span class="dvr-icon">${ikon('bock')}</span>Alla BAS har båda kön</span><span></span></div>`}
                ${kMaskedBas > 0
                    ? `<div class="dvr-row ok"><span><span class="dvr-icon">${ikon('las')}</span>K-maskerade BAS (n&lt;${kTroskel()}):</span><span class="dvr-value">${kMaskedBas}</span></div>`
                    : ''}
                <div class="text-dampad-xs lh-1_4 marg-t-6">${outliers.length > 0 ? 'Granska Outliers-detektorn nedan för detaljer.' : 'Inga uppenbara registerfel hittades.'}</div>
            </div>

            <div class="dvr-section">
                <h4>Konsistens med referensfiler</h4>
                ${polStatus
                    ? polStatus.ok
                        ? `<div class="dvr-row ok"><span><span class="dvr-icon">${ikon('bock')}</span>${esc(referensKortnamn())}:</span><span class="dvr-value">OK</span></div>`
                        : `<div class="dvr-row warn"><span><span class="dvr-icon">${ikon('statusVarning')}</span>${esc(referensKortnamn())}:</span><span class="dvr-value">${polStatus.missing.length} BAS saknas</span></div>`
                    : ''}
                ${statStatus
                    ? statStatus.ok
                        ? `<div class="dvr-row ok"><span><span class="dvr-icon">${ikon('bock')}</span>Jämförelsestatistik:</span><span class="dvr-value">OK</span></div>`
                        : `<div class="dvr-row warn"><span><span class="dvr-icon">${ikon('statusVarning')}</span>Jämförelsestatistik:</span><span class="dvr-value">${statStatus.missing.length} AID saknas</span></div>`
                    : '<div class="dvr-row f-dampad"><span><span class="dvr-icon">' + ikon('statusIngen') + '</span>Jämförelsestatistik:</span><span>Ej uppladdad</span></div>'}
                <div class="text-dampad-xs lh-1_4 marg-t-6">Detaljer i konsistens-bannern nedan.</div>
            </div>
        </div>
    `;
}

// Underlagets kvalitet (ADR-19): rimlighetskontrollen och inläsningsrapporten är
// underlag i panelen; statusen kommer från bedomningUnderlag().
// Anropas efter renderRealityCheck() + renderDataValidationReport().
function syncDatakvalitetPanel() {
    renderUnderlagetsKvalitet();
}

// ---- Konsistenscheck mellan filer ----
function renderConsistencyBanner() {
    const wrap = document.getElementById('consistency-banner-container');
    if (!wrap) return;
    if (!state.data.length) { wrap.innerHTML = ''; return; }

    const issues = [];
    const dataBas = [...new Set(state.data.map(d => d.bas).filter(Boolean))].sort();
    const dataAids = [...new Set(state.data.map(d => { const m = d.yrke.match(/^(\d+)/); return m ? m[1] : null; }).filter(Boolean))];

    // Ställningstagande
    if (state.policy.length) {
        const polBas = state.policy.map(p => p.bas);
        const dataNotInPol = dataBas.filter(b => !polBas.includes(b));
        const polNotInData = polBas.filter(b => !dataBas.includes(b));
        if (dataNotInPol.length) issues.push(`<strong>${esc(referensKortnamn())}:</strong> ${dataNotInPol.length} BAS-intervall saknas (<code>${dataNotInPol.map(esc).join(', ')}</code>) — analyserna kan inte jämföra dessa mot policy.`);
        // Den inbyggda målbilden täcker A–K avsiktligt; att underlaget saknar några BAS är inget fynd.
        if (polNotInData.length && state.policyKalla !== 'demo') issues.push(`<strong>${esc(referensKortnamn())}:</strong> ${polNotInData.length} BAS-intervall finns i policy men inte i strukturdata (<code>${polNotInData.map(esc).join(', ')}</code>).`);
    }

    // Jämförelsestatistik — visa AID + yrkesetikett
    if (state.statistik.length) {
        const statAids = [...new Set(state.statistik.map(s => s.aid))];
        const dataAidNotInStat = dataAids.filter(a => !statAids.includes(a));
        // Bygg AID → yrkesnamn-uppslagning från strukturdatan
        const aidToYrke = {};
        state.data.forEach(d => {
            const m = d.yrke.match(/^(\d+)/);
            const a = m ? m[1] : null;
            if (a && !aidToYrke[a]) aidToYrke[a] = d.yrke;
        });
        if (dataAidNotInStat.length) {
            const display = dataAidNotInStat.slice(0, 6)
                .map(a => `<code>${esc(aidToYrke[a] || a)}</code>`)
                .join(', ');
            const more = dataAidNotInStat.length > 6 ? ` … och ${dataAidNotInStat.length - 6} till` : '';
            issues.push(`<strong>Jämförelsestatistik:</strong> ${dataAidNotInStat.length} AID-koder i strukturdatan saknar matchning i jämförelsestatistiken (${display}${more}) — dessa yrken kan inte jämföras med statistiken.`);
        }
    }

    if (!issues.length) {
        if (state.policy.length || state.statistik.length) {
            wrap.innerHTML = `<div class="consistency-banner ok">${ikon('bock')} <strong>Konsistens-kontroll OK:</strong> Inläst data matchar väl mot uppladdade referensfiler.</div>`;
        } else {
            wrap.innerHTML = '';
        }
        return;
    }
    wrap.innerHTML = `<div class="consistency-banner">${ikon('statusVarning')} <strong>Konsistens-kontroll: ${issues.length} varning${issues.length>1?'ar':''}</strong><ul>${issues.map(i => `<li>${i}</li>`).join('')}</ul></div>`;
}

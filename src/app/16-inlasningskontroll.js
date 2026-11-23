// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
import { sifferprefixAvYrke } from '../lib/aid.js';
import { namnIYrkesfaltetRadnr } from '../lib/forhandskontroll.js';
import { arKvinna, arMan } from '../lib/kon.js';
import { svPct } from '../lib/talformat.js';
import { ordForAntal } from '../lib/termer.js';
import { esc } from './01-html-och-tillganglighet.js';
import { ikon } from './03-ikoner.js';
import { kInstalld } from './06-k-troskel.js';
import { T } from './09-termer.js';
import { getBasIntervals, referensKortnamn, state } from './12-tillstand.js';
import { renderUnderlagetsKvalitet } from './13-oversikt.js';
import { detectOutliers } from './15-extremvarden-basrang.js';
import { _fkRapportrad } from './17-forhandskontroll.js';
import { harAlder } from './50-regressionsmodeller.js';

// ---- Datavalideringsrapport (efter CSV-parse) ----
export function renderDataValidationReport() {
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
    // Personnamn i fältet för AID-etikett: antal rader och de första radnumren. Hela varningen står i
    // förhandskontrollen och i Att göra; här står en kort rad, med radnumren i förhandskontrollens formulering.
    const yrkeNamn = da.yrkeNamn || 0;
    const yrkeNamnRadnr = namnIYrkesfaltetRadnr(yrkeNamn, da.yrkeNamnRadnr);
    const used = state.data.length;

    // Räkna varningar
    const outliers = detectOutliers(3);
    const bas = getBasIntervals();
    const singleSexBas = bas.filter(b => {
        const sub = state.data.filter(r => r.bas === b);
        if (sub.length < 3) return false;
        const hasKv = sub.some(r => arKvinna(r));
        const hasMa = sub.some(r => arMan(r));
        return !hasKv || !hasMa;
    }).length;
    const kMaskedBas = bas.filter(b => state.data.filter(r => r.bas === b).length < kInstalld()).length;

    // Konsistenskontroll
    const dataBas = [...new Set(state.data.map(r => r.bas))].sort();
    const dataAids = [...new Set(state.data.map(r => sifferprefixAvYrke(r.yrke)).filter(Boolean))];
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
                ${yrkeNamn > 0 ? `<div class="dvr-row warn" data-dvr="yrke-namn"><span><span class="dvr-icon">${ikon('statusVarning')}</span>Personnamn i fältet för ${esc(T.enhet.en)}:${yrkeNamnRadnr ? ' <span class="text-dampad-xs">' + esc(yrkeNamnRadnr) + '</span>' : ''}</span><span class="dvr-value">${fmt(yrkeNamn)}</span></div>` : ''}
                ${excludedNoBas > 0 ? `<div class="dvr-row warn"><span><span class="dvr-icon">−</span>Saknar BAS:</span><span class="dvr-value">${fmt(excludedNoBas)}</span></div>` : ''}
                ${excludedZeroLon > 0 ? `<div class="dvr-row warn"><span><span class="dvr-icon">−</span>Lön ≤ 0:</span><span class="dvr-value">${fmt(excludedZeroLon)}</span></div>` : ''}
                ${excludedMissingKon > 0 ? `<div class="dvr-row warn"><span><span class="dvr-icon">−</span>Saknar/okänt kön:${missingKonExamples.length ? ' <span class="text-dampad-xs">ex: ' + missingKonExamples.map(e => '"' + esc(e) + '"').join(', ') + '</span>' : ''}</span><span class="dvr-value">${fmt(excludedMissingKon)}</span></div>` : ''}
                ${invalidLon > 0 ? `<div class="dvr-row warn"><span><span class="dvr-icon">${ikon('statusVarning')}</span>Ogiltig lön (text):${invalidLonExamples.length ? ' <span class="text-dampad-xs">ex: ' + invalidLonExamples.map(e => '"' + esc(e) + '"').join(', ') + '</span>' : ''}</span><span class="dvr-value">${fmt(invalidLon)}</span></div>` : ''}
                ${invalidAlder > 0 ? `<div class="dvr-row warn"><span><span class="dvr-icon">${ikon('statusVarning')}</span>Ogiltig ålder (text):${invalidAlderExamples.length ? ' <span class="text-dampad-xs">ex: ' + invalidAlderExamples.map(e => '"' + esc(e) + '"').join(', ') + '</span>' : ''}</span><span class="dvr-value">${fmt(invalidAlder)}</span></div>` : ''}
                ${!harAlder() ? `<div class="dvr-row warn"><span><span class="dvr-icon">${ikon('statusVarning')}</span>Ålder saknas: analysen körs utan åldersjustering; Ålder &amp; karriär visas inte.</span><span class="dvr-value">–</span></div>` : ''}
                <div class="dvr-row dvr-total ok"><span>= Inlästa:</span><span class="dvr-value">${fmt(used)}</span></div>
                ${typeof _fkRapportrad === 'function' ? _fkRapportrad() : ''}
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
                    ? `<div class="dvr-row ok"><span><span class="dvr-icon">${ikon('las')}</span>BAS under minsta gruppstorlek (n&lt;${kInstalld()}, redovisas inte i exporterna):</span><span class="dvr-value">${kMaskedBas}</span></div>`
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
                    : '<div class="dvr-row f-dampad"><span><span class="dvr-icon">' + ikon('statusIngen') + '</span>Jämförelsestatistik:</span><span>Inte inläst</span></div>'}
                <div class="text-dampad-xs lh-1_4 marg-t-6">Detaljer i konsistens-bannern nedan.</div>
            </div>
        </div>
    `;
}

// Underlagets kvalitet (ADR-19): inläsningsrapporten är underlag i panelen;
// statusen kommer från bedomningUnderlag().
// Anropas efter renderDataValidationReport().
/** @param {{reg?: any}} [val] reg: regressionen när anroparen just kört den i samma varv (ADR-17) */
export function syncDatakvalitetPanel(val) {
    renderUnderlagetsKvalitet(val);
}

// ---- Konsistenscheck mellan filer ----
export function renderConsistencyBanner() {
    const wrap = document.getElementById('consistency-banner-container');
    if (!wrap) return;
    if (!state.data.length) { wrap.innerHTML = ''; return; }

    const issues = [];
    const dataBas = [...new Set(state.data.map(d => d.bas).filter(Boolean))].sort();
    const dataAids = [...new Set(state.data.map(d => sifferprefixAvYrke(d.yrke)).filter(Boolean))];

    // Ställningstagande
    if (state.policy.length) {
        const polBas = state.policy.map(p => p.bas);
        const dataNotInPol = dataBas.filter(b => !polBas.includes(b));
        const polNotInData = polBas.filter(b => !dataBas.includes(b));
        if (dataNotInPol.length) issues.push(`<strong>${esc(referensKortnamn())}:</strong> ${dataNotInPol.length} ${ordForAntal(dataNotInPol.length, T.niva)} saknas (<code>${dataNotInPol.map(esc).join(', ')}</code>) — analyserna kan inte jämföra dessa mot policy.`);
        // Den inbyggda målbilden täcker A–K avsiktligt; att underlaget saknar några BAS är inget fynd.
        if (polNotInData.length && state.policyKalla !== 'demo') issues.push(`<strong>${esc(referensKortnamn())}:</strong> ${polNotInData.length} ${ordForAntal(polNotInData.length, T.niva)} finns i policy men inte i lönefilen (<code>${polNotInData.map(esc).join(', ')}</code>).`);
    }

    // Jämförelsestatistik — visa AID + yrkesetikett
    if (state.statistik.length) {
        const statAids = [...new Set(state.statistik.map(s => s.aid))];
        const dataAidNotInStat = dataAids.filter(a => !statAids.includes(a));
        // Bygg AID → yrkesnamn-uppslagning från strukturdatan
        const aidToYrke = {};
        state.data.forEach(d => {
            const a = sifferprefixAvYrke(d.yrke);
            if (a && !aidToYrke[a]) aidToYrke[a] = d.yrke;
        });
        if (dataAidNotInStat.length) {
            const display = dataAidNotInStat.slice(0, 6)
                .map(a => `<code>${esc(aidToYrke[a] || a)}</code>`)
                .join(', ');
            const more = dataAidNotInStat.length > 6 ? ` … och ${dataAidNotInStat.length - 6} till` : '';
            issues.push(`<strong>Jämförelsestatistik:</strong> ${dataAidNotInStat.length} ${ordForAntal(dataAidNotInStat.length, T.kod)} i lönefilen saknar matchning i jämförelsestatistiken (${display}${more}) — de kan inte jämföras med statistiken.`);
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

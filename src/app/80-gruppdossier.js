// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
// ====================================================================
// 80-gruppdossier.js — "En grupp, en sida"
//
// Samlar allt verktyget REDAN vet om en vald yrkesgrupp (AID × BAS) på ett
// ställe, så handläggaren slipper hoppa mellan Lika arbete, Likvärdigt arbete,
// Prioritering, Jämförelse och Lönepolitik för att förstå en enda grupp.
//
// Ingen ny statistik — enbart en sammanställning av befintliga beräkningar.
// Dossiern DOKUMENTERAR INTE sakliga skäl; det är en medveten produktgräns
// (teknisk-plan.md §2). Den samlar underlaget för den bedömning som görs någon annanstans.
// ====================================================================

// Bootstrap-KI på mediankvoten (kvinnors median som % av männens). Samma metod
// som skevhetsöversikten, men den funktionen är lokal i generateSkevhet().
// B = 2000 matchar computeBootstrapCI: B=600 gav ~±0,5 pp Monte Carlo-spridning
// på KI-gränserna, vilket märktes för gränsfall.
function _gdBootstrapGapCI(kvLons, maLons, B = 2000) {
    if (kvLons.length < 3 || maLons.length < 3) return null;
    const med = arr => {
        const s = arr.slice().sort((a, b) => a - b), m = s.length >> 1;
        return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
    };
    const ratios = new Array(B);
    const rnd = _rngFor(kvLons, maLons);   // seedad ur datat → reproducerbart KI
    for (let b = 0; b < B; b++) {
        const sKv = kvLons.map(() => kvLons[(rnd() * kvLons.length) | 0]);
        const sMa = maLons.map(() => maLons[(rnd() * maLons.length) | 0]);
        const mMa = med(sMa);
        ratios[b] = mMa > 0 ? (med(sKv) / mMa) * 100 : NaN;
    }
    const ok = ratios.filter(v => isFinite(v)).sort((a, b) => a - b);
    if (ok.length < 20) return null;
    return { lo: ok[Math.floor(ok.length * 0.025)], hi: ok[Math.floor(ok.length * 0.975)] };
}

/** Alla grupper som får öppnas i dossier (k-anonymitet som överallt annars). */
function gruppdossierCandidates() {
    const map = new Map();
    getData().forEach(r => {
        if (!(r.lon > 0) || !r.bas) return;
        const m = String(r.yrke || '').match(/^(\d+)/);
        const aid = m ? m[1] : String(r.yrke || '');
        const key = aid + '|' + r.bas;
        if (!map.has(key)) map.set(key, { key, aid, bas: r.bas, yrke: r.yrke, rows: [] });
        map.get(key).rows.push(r);
    });
    return [...map.values()]
        .filter(g => !isKMasked(g.rows.length))
        .sort((a, b) => b.rows.length - a.rows.length);
}

/** Bygger dossier-modellen för en grupp. Returnerar null om gruppen saknas/maskeras. */
function buildGruppdossier(key) {
    const g = gruppdossierCandidates().find(x => x.key === key);
    if (!g) return null;

    const lons = g.rows.map(r => r.lon);
    const kv = g.rows.filter(r => typeof r.kon === 'string' && r.kon.includes('kvinna'));
    const ma = g.rows.filter(r => r.kon === 'man' || r.kon === 'män');
    const kvLons = kv.map(r => r.lon), maLons = ma.map(r => r.lon);

    // Ojusterat gap — visas bara när bägge könen når k-tröskeln
    /** @type {any} */ let gap = null;
    if (kvLons.length >= kTroskel() && maLons.length >= kTroskel()) {
        const mKv = Stat.median(kvLons), mMa = Stat.median(maLons);
        gap = {
            pct: mMa > 0 ? (mKv / mMa) * 100 : null,
            medKv: mKv, medMa: mMa,
            ci: _gdBootstrapGapCI(kvLons, maLons),
            // Räkneexemplet i kronor per år, med prioriteringens kostnadsinställningar.
            arsbelopp: _prArsbeloppMening({ medKv: mKv, medMa: mMa, nKv: kvLons.length }, state.costSettings, v => _figTalformat(Math.round(v), 'kr'))
        };
    }

    // Ansvarskod: antal per ansvarsgrupp och kön (aldrig lön per ansvarsgrupp)
    /** @type {any} */ let ansvar = null;
    if (g.rows.some(r => r.ansvarsgrupp)) {
        ansvar = {};
        for (const grupp of ['ledning', 'uppdrag']) {
            ansvar[grupp] = { kv: kv.filter(r => r.ansvarsgrupp === grupp).length, ma: ma.filter(r => r.ansvarsgrupp === grupp).length };
        }
    }

    // Justerat (åldersrensat) gap för gruppens BAS
    let adjusted = null;
    try {
        const perBas = _computePerBasGap(getData(), [g.bas]);
        adjusted = (perBas || []).find(p => p.bas === g.bas) || null;
    } catch (_e) { adjusted = null; }

    // Lönepolitiskt ställningstagande
    const pol = (typeof policyFor === 'function') ? policyFor(g.aid, g.bas) : null;
    const band = pol ? _lpGroupBandStats(g.rows, pol) : null;
    const compliance = pol ? _lpComplianceCounts(g.rows, pol) : null;

    // § 3:10-par där gruppen ingår (som subjekt eller som jämförelseyrke)
    // Par där den andra gruppen är under tröskeln redovisas inte här (undantaget gäller bara fliken).
    let lvAsSubject = [], lvAsComparator = [], lvUtelamnade = 0;
    try {
        const res = likvardighetResultat();
        const gruppens = ((res && res.pairs) || []).filter(p =>
            (p.kvAid === g.aid && p.kvBas === g.bas) || (p.maAid === g.aid && p.maBas === g.bas));
        const { par: pairs, utelamnade } = _parForRedovisning(gruppens);
        lvUtelamnade = utelamnade;
        lvAsSubject = pairs.filter(p => p.kvAid === g.aid && p.kvBas === g.bas);
        lvAsComparator = pairs.filter(p => p.maAid === g.aid && p.maBas === g.bas);
    } catch (e) { rapporteraFel('Gruppdossier: likvärdigt arbete', e); }

    // Extern jämförelsestatistik
    const bench = (state.statistik || []).find(s => s.aid === g.aid && s.bas === g.bas)
               || (state.statistik || []).find(s => s.aid === g.aid && !s.bas) || null;

    // Prioritering + hypoteser
    let prio = null, suggestions = [];
    try {
        const ref = (typeof _selectedPrioReference === 'function') ? _selectedPrioReference() : 'statistik';
        // computePrioritization grupperar på `yrke|bas` (hela strängen "AID Etikett")
        // medan dossiern grupperar på `aid|bas`. Samma AID kan därför ge flera
        // prio-poster; ta inte bara den första — slå ihop dem, annars visas
        // kostnad och antal för en delmängd av gruppen.
        const traffar = (computePrioritization(ref) || []).filter(i => i.aid === g.aid && i.bas === g.bas);
        if (traffar.length === 1) {
            prio = traffar[0];
        } else if (traffar.length > 1) {
            const nTot = traffar.reduce((s, i) => s + (i.n || 0), 0);
            prio = {
                ...traffar[0],
                yrke: `${g.aid} (${traffar.length} yrkesbenämningar)`,
                n: nTot,
                annualGapTotal: traffar.reduce((s, i) => s + (i.annualGapTotal || 0), 0),
                // n-viktat medelvärde — ett rakt medel skulle ge små grupper lika tyngd
                diffPct: nTot ? traffar.reduce((s, i) => s + (i.diffPct || 0) * (i.n || 0), 0) / nTot : traffar[0].diffPct,
                costPerPerson: nTot ? traffar.reduce((s, i) => s + (i.annualGapTotal || 0), 0) / nTot : traffar[0].costPerPerson,
                _rows: traffar.flatMap(i => i._rows || [])
            };
        }
        if (prio && typeof generateMotivationSuggestions === 'function') {
            suggestions = generateMotivationSuggestions(prio) || [];
        }
    } catch (e) { rapporteraFel('Gruppdossier: prioriteringen', e); }

    return {
        key: g.key, aid: g.aid, bas: g.bas, yrke: g.yrke,
        n: g.rows.length, nKv: kv.length, nMa: ma.length,
        median: Stat.median(lons),
        p10: Stat.quantile(lons, 0.10), p90: Stat.quantile(lons, 0.90),
        gap, adjusted, ansvar, skr: _skrKvinnoandel(g.aid, { del: _skrDel() }), pol, polLevel: policyLevelLabel(pol), band, compliance,
        lvAsSubject, lvAsComparator, lvUtelamnade, bench, prio, suggestions
    };
}

// ---- Rendering --------------------------------------------------------------

// Dossiern är en DETALJVY för en rad, inte ett eget arbetsläge — därför modal
// som nås från tabellrader, inte en post i huvudmenyn.
function openGruppdossier(preselectKey) {
    const modal = document.getElementById('dossier-modal');
    if (!modal) return;
    renderGruppdossier(preselectKey);
    modal.style.display = 'flex';
    if (typeof trapFocus === 'function') trapFocus(modal);
}
function closeGruppdossier() {
    const modal = document.getElementById('dossier-modal');
    if (!modal) return;
    if (typeof releaseFocus === 'function') releaseFocus(modal);
    modal.style.display = 'none';
}

function renderGruppdossier(preselectKey) {
    const sel = document.getElementById('dossier-select');
    const body = document.getElementById('dossier-body');
    if (!sel || !body) return;

    const cands = gruppdossierCandidates();
    if (!cands.length) {
        sel.innerHTML = '';
        body.innerHTML = `<div class="flik-empty-state"><div class="empty-icon">${ikon('tomLada')}</div>
            <h3>Inga grupper att visa</h3>
            <p>Ingen yrkesgrupp når tröskeln på ${kTroskel()} personer. Ladda upp strukturdata, eller analysera på BAS-nivå i stället.</p></div>`;
        return;
    }
    // Fyll väljaren (bevara valet om det fortfarande finns)
    const wanted = preselectKey || /** @type {HTMLInputElement} */ (sel).value || cands[0].key;
    sel.innerHTML = cands.map(g =>
        `<option value="${esc(g.key)}">${esc(gruppNamn(g))} — BAS ${esc(g.bas)} (n=${g.rows.length})</option>`
    ).join('');
    /** @type {HTMLInputElement} */ (sel).value = cands.some(g => g.key === wanted) ? wanted : cands[0].key;

    const d = buildGruppdossier(/** @type {HTMLInputElement} */ (sel).value);
    if (!d) { body.innerHTML = '<p class="f-dampad">Gruppen kunde inte läsas.</p>'; return; }
    body.innerHTML = _gdRenderBody(d);
    // Fokusfällan cachar de fokuserbara elementen när modalen öppnas. Byter man
    // yrkesgrupp byggs innehållet om och cachen pekar på borttagna noder — fällan
    // måste därför läggas om medan modalen är öppen.
    const modal = document.getElementById('dossier-modal');
    if (modal && modal.style.display === 'flex') {
        if (typeof releaseFocus === 'function') releaseFocus(modal);
        if (typeof trapFocus === 'function') trapFocus(modal);
    }
}

/** Gruppens namn med AID-koden en gång: yrkesetiketten börjar oftast redan med koden. */
function gruppNamn(g) {
    const aid = String(g.aid ?? ''), yrke = String(g.yrke ?? '').trim();
    if (!yrke || yrke === aid) return aid;
    return yrke.startsWith(aid) ? yrke : `${aid} ${yrke}`;
}

function _gdRenderBody(d) {
    const kr = v => v == null || !isFinite(v) ? '–' : Math.round(v).toLocaleString('sv-SE') + ' kr';
    const pct = (v, dec = 1) => svPct(v, dec);
    const card = (title, inner, note) => `
        <div class="gd-card">
            <h3>${title}</h3>
            ${note ? `<p class="gd-note">${note}</p>` : ''}
            ${inner}
        </div>`;
    const missing = txt => `<p class="gd-missing">${txt}</p>`;

    // 1. Nyckeltal
    const kvPct = d.n ? (d.nKv / d.n) * 100 : 0;
    const nyckeltal = `
        <div class="gd-kpis">
            <div class="gd-kpi"><span>${d.n}</span><small>personer</small></div>
            <div class="gd-kpi"><span>${d.nKv} / ${d.nMa}</span><small>kvinnor / män (${svPct(kvPct, 0)} kv)${d.skr
                ? `<br>SKR: ${svPct(d.skr.pct, 0)} kvinnor i ${_skrDelText(d.skr.del)}` : ''}</small></div>
            <div class="gd-kpi"><span>${kr(d.median)}</span><small>median</small></div>
            <div class="gd-kpi"><span>${kr(d.p10)} – ${kr(d.p90)}</span><small>P10 – P90</small></div>
        </div>${d.ansvar ? `
        <p class="gd-ansvar">Ansvar: Ledningsansvar ${d.ansvar.ledning.kv} kv / ${d.ansvar.ledning.ma} män ·
            Särskilt uppdrag ${d.ansvar.uppdrag.kv} kv / ${d.ansvar.uppdrag.ma} män</p>` : ''}`;

    // 2. Ojusterat gap
    const gapInner = d.gap && d.gap.pct != null
        ? `<div class="gd-big ${Math.abs(100 - d.gap.pct) > 5 ? 'f-kritisk' : Math.abs(100 - d.gap.pct) > 3 ? 'fg-varning' : 'fg-ok'}">${pct(d.gap.pct, 1)}</div>
           <p>Kvinnors median som andel av männens. Kvinnor ${kr(d.gap.medKv)} · Män ${kr(d.gap.medMa)}.</p>
           ${d.gap.arsbelopp ? `<p class="gd-note">${esc(d.gap.arsbelopp)}</p>` : ''}
           ${d.gap.ci ? `<p class="gd-note">95 % bootstrap-KI: ${pct(d.gap.ci.lo)} – ${pct(d.gap.ci.hi)}${d.gap.ci.lo <= 100 && d.gap.ci.hi >= 100 ? ' — intervallet rymmer 100 %, skillnaden är inte säkerställd.' : ''}</p>` : ''}`
        : missing(`Kräver minst ${kTroskel()} av varje kön i gruppen (här ${d.nKv} kv / ${d.nMa} mä).`);

    // 3. Justerat gap för BAS
    const adjInner = d.adjusted && d.adjusted.status === 'ok'
        ? `<div class="gd-big">${d.adjusted.gapPct >= 0 ? '+' : ''}${svPct(d.adjusted.gapPct, 1)}</div>
           <p>Åldersrensat gap för hela BAS ${esc(d.bas)} (gruppens arbetsvärderingsnivå), 95 % KI ${svTal(d.adjusted.ciLow, 1)} – ${svPct(d.adjusted.ciHigh, 1)}.</p>
           <p class="gd-note">Avser BAS-intervallet, inte enbart denna yrkesgrupp.</p>`
        : missing('BAS-intervallet har inte tillräcklig könsbalans för en åldersrensad skattning.');

    // 4. Lönepolitik
    const polInner = d.pol
        ? `<p>Referens (${esc(referensKortnamn())}): <strong>${kr(d.pol.p10)} – ${kr(d.pol.p90)}</strong> (median ${kr(d.pol.med)}) · nivå: <strong>${esc(d.polLevel || '–')}</strong></p>
           ${d.band && d.band.position != null
                ? `<div class="gd-big">${svPct((d.band.position * 100), 0)}</div><p>Gruppens median ligger så långt in i spannet (0 % = P10, 100 % = P90).</p>`
                : '<p class="gd-note">Spannet är för smalt för ett positionsmått.</p>'}
           ${d.compliance ? `<p>${d.compliance.under} av ${d.compliance.n} under P10 · ${d.compliance.over} över P90.</p>` : ''}`
        : missing('Ingen policyreferens träffar denna grupp (varken AID- eller BAS-nivå).');

    // 5. § 3:10
    const lvRow = p => `<li>${esc(gruppNamn({ aid: p.maAid, yrke: p.maLabel }))} — gap ${svPct(p.gapPct, 1)} (${kr(p.gapKr)})</li>`;
    const lvNot = d.lvUtelamnade ? `<p class="gd-note">${esc(_parUtelamnadeNot(d.lvUtelamnade))}</p>` : '';
    const lvInner = (d.lvAsSubject.length || d.lvAsComparator.length)
        ? `${d.lvAsSubject.length ? `<p><strong>Gruppen är kvinnodominerad och jämförs mot:</strong></p><ul class="gd-list">${d.lvAsSubject.map(lvRow).join('')}</ul>` : ''}
           ${d.lvAsComparator.length ? `<p><strong>Gruppen används som jämförelseyrke för:</strong></p><ul class="gd-list">${d.lvAsComparator.map(p => `<li>${esc(gruppNamn({ aid: p.kvAid, yrke: p.kvLabel }))} — gap ${svPct(p.gapPct, 1)}</li>`).join('')}</ul>` : ''}${lvNot}`
        : (lvNot || missing('Gruppen ingår inte i någon jämförelse av likvärdigt arbete.'));

    // 6. Benchmark
    const benchInner = d.bench && d.bench.median > 0
        ? `<p>Extern median: <strong>${kr(d.bench.median)}</strong> · organisationen: <strong>${kr(d.median)}</strong>
           (${svPct(((d.median / d.bench.median - 1) * 100), 1)})</p>`
        : missing('Ingen matchande rad i jämförelsestatistiken.');

    // 7. Prioritering & kostnad
    const prioInner = d.prio
        ? `<p>Status: <strong>${esc(d.prio.status || '–')}</strong> · avvikelse mot referens (${esc(d.prio.refSource || '–')}): <strong>${pct(d.prio.diffPct)}</strong></p>
           <p>Kostnad att lyfta till referensens median: <strong>${kr(d.prio.annualGapTotal)}/år</strong> (${kr(d.prio.costPerPerson)}/person).</p>`
        : missing('Gruppen finns inte i prioriteringslistan (saknar referens eller ligger över den).');

    // 8. Hypoteser
    const hypInner = d.suggestions.length
        // s.text är verktygsförfattad markup (innehåller <strong>) och bygger enbart
        // på tal och fasta ord — ingen användardata interpoleras i den. esc() här
        // skulle visa taggarna som text. Typen escapas dock, den styr en CSS-klass.
        ? `<ul class="gd-list">${d.suggestions.map(s => `<li class="gd-hyp gd-hyp-${esc(s.type || 'info')}">${s.text}</li>`).join('')}</ul>`
        : missing('Inga regelbaserade hypoteser utlöstes för denna grupp.');

    return `
        <div class="gd-head">
            <h3 class="fs-lg marg-0">${esc(gruppNamn(d))}</h3>
            <span class="gd-sub">BAS ${esc(d.bas)} · ${d.n} personer</span>
            <button type="button" class="btn-table-tool" id="btn-dossier-copy" title="Kopiera dossiern som text">${ikon('kopiera', 14)} Kopiera</button>
        </div>
        <p class="reg-caveat-inline"><strong>Dossiern dokumenterar inte sakliga skäl.</strong> Den samlar underlaget —
        bedömningen och dokumentationen görs i er ordinarie process.</p>
        <div class="gd-grid">
            ${card('Nyckeltal', nyckeltal)}
            ${card('Ojusterat lönegap', gapInner)}
            ${card('Gap när åldern räknats bort', adjInner)}
            ${card('Mot er lönepolitik', polInner)}
            ${card('Likvärdigt arbete', lvInner)}
            ${card('Extern jämförelse', benchInner)}
            ${card('Hur angeläget — och vad kostar det?', prioInner)}
            ${card('Frågor att undersöka', hypInner, 'Regelbaserade uppslag, inte färdiga motiveringar. Ingen AI är inblandad.')}
        </div>`;
}

/** Ren textversion för urklipp — praktiskt vid dokumentation i Word. */
function gruppdossierAsText(d) {
    const kr = v => v == null || !isFinite(v) ? '-' : Math.round(v).toLocaleString('sv-SE') + ' kr';
    const L = [];
    L.push(`GRUPPDOSSIER: ${gruppNamn(d)} - BAS ${d.bas}`);
    L.push(`Antal: ${d.n} (${d.nKv} kvinnor / ${d.nMa} man) - median ${kr(d.median)} - P10-P90 ${kr(d.p10)}-${kr(d.p90)}`);
    if (d.skr) L.push(`Referens SKR: ${svPct(d.skr.pct, 0)} kvinnor i ${_skrDelText(d.skr.del)} (${_skrReferensInfo().kalla})`);
    if (d.ansvar) L.push(`Ansvar: Ledningsansvar ${d.ansvar.ledning.kv} kv / ${d.ansvar.ledning.ma} man - Sarskilt uppdrag ${d.ansvar.uppdrag.kv} kv / ${d.ansvar.uppdrag.ma} man`);
    if (d.gap && d.gap.pct != null) L.push(`Ojusterat gap: ${svPct(d.gap.pct, 1)} av mannens median`);
    if (d.gap && d.gap.arsbelopp) L.push(d.gap.arsbelopp);
    if (d.adjusted && d.adjusted.status === 'ok') L.push(`Aldersrensat gap (BAS ${d.bas}): ${svPct(d.adjusted.gapPct, 1)}`);
    if (d.pol) L.push(`Referensspann ${referensKortnamn()}: ${kr(d.pol.p10)}-${kr(d.pol.p90)} (${d.polLevel})`
        + (d.band && d.band.position != null ? ` - position ${svPct((d.band.position * 100), 0)}` : ''));
    if (d.prio) L.push(`Prioritering: ${d.prio.status} - avvikelse ${svPct(d.prio.diffPct, 1)} - ${kr(d.prio.annualGapTotal)}/ar`);
    // Förslagen är HTML (fetstil m.m.); textkopian tar bort taggarna och avkodar tecknen
    // utan att tolka HTML.
    const somText = h => String(h).replace(/<[^>]*>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
    if (d.suggestions.length) { L.push('Hypoteser att undersoka:'); d.suggestions.forEach(s => L.push('  - ' + somText(s.text))); }
    if (d.lvUtelamnade) L.push(_parUtelamnadeNot(d.lvUtelamnade));
    L.push('OBS: Dossiern dokumenterar inte sakliga skal - den bedomningen gors separat.');
    // Delbar på egen hand (urklipp): stämpeln när tröskeln är sänkt
    if (_kSanktNot()) L.push('', _kSanktNot());
    return L.join('\n');
}

// ---- Wiring ----
document.getElementById('dossier-select')?.addEventListener('change', () => renderGruppdossier());
// Djuplänk från tabellrader i andra flikar
document.addEventListener('click', e => {
    const btn = /** @type {HTMLElement} */ (e.target).closest('[data-open-dossier]');
    if (btn) { openGruppdossier(btn.getAttribute('data-open-dossier')); return; }
    if (/** @type {HTMLElement} */ (e.target).closest('[data-dossier-close]')) closeGruppdossier();
});
document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && document.getElementById('dossier-modal')?.style.display === 'flex') {
        closeGruppdossier();
    }
});
document.addEventListener('click', e => {
    if (!/** @type {HTMLElement} */ (e.target).closest('#btn-dossier-copy')) return;
    const sel = document.getElementById('dossier-select');
    const d = sel ? buildGruppdossier(/** @type {HTMLInputElement} */ (sel).value) : null;
    if (!d) return;
    const txt = gruppdossierAsText(d);
    const done = () => { if (typeof announceToScreenReader === 'function') announceToScreenReader('Dossier kopierad.'); };
    if (navigator.clipboard?.writeText) navigator.clipboard.writeText(txt).then(done).catch(() => {});
    else done();
});

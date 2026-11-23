// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
// ====================================================================
// 80-gruppdossier.js — "En grupp, en sida"
//
// Samlar allt verktyget REDAN vet om en vald yrkesgrupp (AID × BAS) på ett
// ställe, så handläggaren slipper hoppa mellan Lika arbete, Likvärdigt arbete,
// Prioritering och Jämförelse för att förstå en enda grupp.
//
// Ingen ny statistik — enbart en sammanställning av befintliga beräkningar.
// Dossiern DOKUMENTERAR INTE sakliga skäl; det är en medveten produktgräns
// (avgränsningen i docs/utveckling/mal.md). Den samlar underlaget för den bedömning som görs någon annanstans.
// ====================================================================
import { aidAvYrke, namnrader } from '../lib/aid.js';
import { talformat } from '../lib/figur.js';
import { htmlTillText } from '../lib/htmltext.js';
import { statistikFor } from '../lib/jamforelse.js';
import { arKvinna, arMan } from '../lib/kon.js';
import { antalMotBand, gruppMotBand } from '../lib/lonepolitik.js';
import { personOrd } from '../lib/namn.js';
import { medianKvotKIGiltiga } from '../lib/osakerhet.js';
import { arsbeloppMening } from '../lib/prioritering.js';
import { skrDelText, skrKvinnoandel } from '../lib/skrreferens.js';
import { konsMedianer } from '../lib/struktur.js';
import { svKr, svPct, svTal } from '../lib/talformat.js';
import { adjektiv, stor } from '../lib/termer.js';
import { announceToScreenReader, esc, releaseFocus, trapFocus } from './01-html-och-tillganglighet.js';
import { rapporteraFel } from './03-hjalpfunktioner.js';
import { ikon } from './03-ikoner.js';
import { _kSanktNot, _parForRedovisning, _parUtelamnadeNot, isKMasked, kTroskel } from './06-k-troskel.js';
import { _skrDel, skrForklaring, skrKallaKort } from './06-kvinnoandel-referens.js';
import { T } from './09-termer.js';
import { gapStatusKI } from './10-diagramtema.js';
import { getData, policyFor, policyLevelLabel, referensKortnamn, Stat, state } from './12-tillstand.js';
import { medExportLage } from './23-exportgrind.js';
import { likvardighetResultat } from './34-likvardigt-arbete.js';
import { _direktivInline } from './41-lika-arbete.js';
import { _computePerBasGap, harAlder } from './50-regressionsmodeller.js';
import { _selectedPrioReference, computePrioritization, generateMotivationSuggestions } from './55-prioritering.js';
import { _hpBedomningar, _hpBedomningHtml, _hpPassarGrupp } from './56-handlingsplan.js';
import { basdossierKandidater, basdossierKnapp } from './81-basdossier.js';

// Bootstrap-KI på mediankvoten (kvinnors median som % av männens): medianKvotKIGiltiga i src/lib/osakerhet.js. Samma
// dragningar som översikten per BAS-intervall (_laBootstrapGapCI), med B = 2000 som computeBootstrapCI; dragningar
// där männens median inte är positiv räknas inte.
export function _gdBootstrapGapCI(kvLons, maLons, B) {
    return medianKvotKIGiltiga(kvLons, maLons, { B });
}

/** Alla grupper som får öppnas i dossier (k-anonymitet som överallt annars). */
export function gruppdossierCandidates() {
    const map = new Map(), d = getData();
    // Gruppens namn ur texten på flest av dess rader (namnrader), som i resten av verktyget (ADR-89).
    const namnrad = namnrader(d.filter(r => r.lon > 0 && r.bas), r => aidAvYrke(r.yrke) + '|' + r.bas);
    d.forEach(r => {
        if (!(r.lon > 0) || !r.bas) return;
        const aid = aidAvYrke(r.yrke);
        const key = aid + '|' + r.bas;
        if (!map.has(key)) map.set(key, { key, aid, bas: r.bas, yrke: namnrad.get(key).yrke, rows: [] });
        map.get(key).rows.push(r);
    });
    return [...map.values()]
        .filter(g => !isKMasked(g.rows.length))
        .sort((a, b) => b.rows.length - a.rows.length);
}

/** Kvinnorna och männen i en grupps rader, på samma sätt som dossiern räknar dem. */
export function _gdKon(rows) {
    return { kv: rows.filter(r => arKvinna(r)), ma: rows.filter(r => arMan(r)) };
}

/**
 * Det som är lika för alla grupper i ett och samma bygge (rapportens bilaga): kandidatlistan, det åldersrensade gapet
 * per BAS-intervall och prioriteringen. Utan det räknar varje dossier om allt, vilket kostar sekunder på stora underlag.
 * Med `text: true` byggs dossiererna för textversionen, som inte visar bootstrap-intervallet; det räknas då inte (det
 * var nästan hela bilagans kostnad).
 * @param {{text?: boolean}} [val]
 */
export function gruppdossierDelat({ text = false } = {}) {
    return { kandidater: gruppdossierCandidates(), perBas: new Map(), prio: new Map(), text };
}

/**
 * Bygger dossier-modellen för en grupp. Returnerar null om gruppen saknas/maskeras.
 * @param {string} key
 * @param {any} [delat] ur gruppdossierDelat(), när flera dossierer byggs i samma anrop
 */
export function buildGruppdossier(key, delat = null) {
    const g = (delat ? delat.kandidater : gruppdossierCandidates()).find(x => x.key === key);
    if (!g) return null;

    const lons = g.rows.map(r => r.lon);
    const { kv, ma } = _gdKon(g.rows);
    const kvLons = kv.map(r => r.lon), maLons = ma.map(r => r.lon);

    // Ojusterat gap — visas bara när bägge könen når k-tröskeln
    /** @type {any} */ let gap = null;
    const km = konsMedianer(g.rows, { k: kTroskel() });
    if (km.konOk) {
        const mKv = km.medKv, mMa = km.medMa;
        gap = {
            pct: km.kvotPct,
            medKv: mKv, medMa: mMa,
            ci: delat && delat.text ? null : _gdBootstrapGapCI(kvLons, maLons),
            // Räkneexemplet i kronor per år, med prioriteringens kostnadsinställningar.
            arsbelopp: arsbeloppMening({ medKv: mKv, medMa: mMa, nKv: kvLons.length }, state.costSettings, v => talformat(v, 'kr'))
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

    // Justerat (åldersrensat) gap för gruppens BAS. Utan ålder i lönefilen (ADR-64) visar dossiern inget sådant.
    let adjusted = null;
    if (harAlder()) try {
        const rakna = () => _computePerBasGap(getData(), [g.bas]);
        let perBas;
        if (!delat) perBas = rakna();
        else { if (!delat.perBas.has(g.bas)) delat.perBas.set(g.bas, rakna()); perBas = delat.perBas.get(g.bas); }
        adjusted = (perBas || []).find(p => p.bas === g.bas) || null;
    } catch (_e) { adjusted = null; }

    // Lönepolitiskt ställningstagande
    const pol = (typeof policyFor === 'function') ? policyFor(g.aid, g.bas) : null;
    const band = pol ? gruppMotBand(g.rows, pol) : null;
    const compliance = pol ? antalMotBand(g.rows, pol) : null;

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
    const bench = statistikFor(state.statistik, g.aid, g.bas)?.rad || null;

    // Prioritering + hypoteser
    let prio = null, suggestions = [];
    try {
        const ref = (typeof _selectedPrioReference === 'function') ? _selectedPrioReference() : 'statistik';
        // computePrioritization grupperar på AID-kod och BAS, som dossiern: högst en post per grupp.
        let alla;
        if (!delat) alla = computePrioritization(ref);
        else { if (!delat.prio.has(ref)) delat.prio.set(ref, computePrioritization(ref)); alla = delat.prio.get(ref); }
        prio = (alla || []).find(i => i.aid === g.aid && i.bas === g.bas) || null;
        if (prio && typeof generateMotivationSuggestions === 'function') {
            suggestions = generateMotivationSuggestions(prio) || [];
        }
    } catch (e) { rapporteraFel('Gruppdossier: prioriteringen', e); }

    return {
        key: g.key, aid: g.aid, bas: g.bas, yrke: g.yrke,
        n: g.rows.length, nKv: kv.length, nMa: ma.length,
        median: Stat.median(lons),
        p10: Stat.kvantil(lons, 0.10), p90: Stat.kvantil(lons, 0.90),
        gap, adjusted, ansvar, skr: skrKvinnoandel(g.aid, { del: _skrDel() }), pol, polLevel: policyLevelLabel(pol), band, compliance,
        lvAsSubject, lvAsComparator, lvUtelamnade, bench, prio, suggestions
    };
}

// ---- Rendering --------------------------------------------------------------

// Dossiern är en DETALJVY för en rad, inte ett eget arbetsläge — därför modal
// som nås från tabellrader, inte en post i huvudmenyn.
export function openGruppdossier(preselectKey) {
    const modal = document.getElementById('dossier-modal');
    if (!modal) return;
    renderGruppdossier(preselectKey);
    modal.style.display = 'flex';
    if (typeof trapFocus === 'function') trapFocus(modal);
}
export function closeGruppdossier() {
    const modal = document.getElementById('dossier-modal');
    if (!modal) return;
    if (typeof releaseFocus === 'function') releaseFocus(modal);
    modal.style.display = 'none';
}

export function renderGruppdossier(preselectKey) {
    const sel = document.getElementById('dossier-select');
    const body = document.getElementById('dossier-body');
    if (!sel || !body) return;

    const cands = gruppdossierCandidates();
    if (!cands.length) {
        sel.innerHTML = '';
        body.innerHTML = `<div class="flik-empty-state"><div class="empty-icon">${ikon('tomLada')}</div>
            <h3>Inga grupper att visa</h3>
            <p>${stor(adjektiv({ utrum: 'ingen', neutrum: 'inget', plural: 'inga' }, T.enhet))} ${T.enhet.en} når tröskeln på ${kTroskel()} ${personOrd(kTroskel())}. Läs in en större lönefil, eller analysera per ${T.niva.en} i stället.</p></div>`;
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
export function gruppNamn(g) {
    const aid = String(g.aid ?? ''), yrke = String(g.yrke ?? '').trim();
    if (!yrke || yrke === aid) return aid;
    return yrke.startsWith(aid) ? yrke : `${aid} ${yrke}`;
}

function _gdRenderBody(d) {
    const kr = v => svKr(v);
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
                ? `<br><span title="${esc(skrForklaring())}">nationellt: ${svPct(d.skr.pct, 0)} kvinnor i ${skrDelText(d.skr.del)}</span>` : ''}</small></div>
            <div class="gd-kpi"><span>${kr(d.median)}</span><small>median</small></div>
            <div class="gd-kpi"><span>${kr(d.p10)} – ${kr(d.p90)}</span><small>P10 – P90</small></div>
        </div>${basdossierKandidater().some(x => x.bas === d.bas) ? `<p class="gd-note">${basdossierKnapp(d.bas, { text: `Hela BAS ${d.bas}` })} allt om intervallet på en sida</p>` : ''}${d.ansvar ? `
        <p class="gd-ansvar">Ansvar: Ledningsansvar ${d.ansvar.ledning.kv} kv / ${d.ansvar.ledning.ma} män ·
            Särskilt uppdrag ${d.ansvar.uppdrag.kv} kv / ${d.ansvar.uppdrag.ma} män</p>` : ''}`;

    // 2. Ojusterat gap
    // Färgen följer uppmärksamhetstrappan (KI:t mot 100 %, ADR-59); direktivmarkeringen står bredvid det ojusterade talet.
    const gapKlass = d.gap && d.gap.pct != null
        ? ({ granska: 'farg-granska', folj: 'fg-varning', balanserat: 'fg-ok' }[gapStatusKI({ gap: d.gap.pct, ci: d.gap.ci, nKv: d.nKv, nMa: d.nMa }).niva] || 'f-dampad')
        : '';
    const gapInner = d.gap && d.gap.pct != null
        ? `<div class="gd-big ${gapKlass}">${pct(d.gap.pct, 1)}${_direktivInline(d.gap.pct)}</div>
           <p>Kvinnors median som andel av männens. Kvinnor ${kr(d.gap.medKv)} · Män ${kr(d.gap.medMa)}.</p>
           ${d.gap.arsbelopp ? `<p class="gd-note">${esc(d.gap.arsbelopp)}</p>` : ''}
           ${d.gap.ci ? `<p class="gd-note">95 % bootstrap-KI: ${pct(d.gap.ci.lo)} – ${pct(d.gap.ci.hi)}${d.gap.ci.lo <= 100 && d.gap.ci.hi >= 100 ? ' — intervallet rymmer 100 %, skillnaden är inte säkerställd.' : ''}</p>` : ''}`
        : missing(`Kräver minst ${kTroskel()} av varje kön i gruppen (här ${d.nKv} kv / ${d.nMa} mä).`);

    // 3. Justerat gap för BAS
    const adjInner = d.adjusted && d.adjusted.status === 'ok'
        ? `<div class="gd-big">${d.adjusted.gapPct >= 0 ? '+' : ''}${svPct(d.adjusted.gapPct, 1)}</div>
           <p>Åldersrensad skillnad för hela BAS ${esc(d.bas)} (gruppens arbetsvärderingsnivå), 95 % KI ${svTal(d.adjusted.ciLow, 1)} – ${svPct(d.adjusted.ciHigh, 1)}.</p>
           <p class="gd-note">Avser ${T.niva.bf}, inte enbart den här gruppen.</p>`
        : missing(`${stor(T.niva.bf)} har inte tillräcklig könsbalans för en åldersrensad skattning.`);

    // 4. Mot ställningstagandet
    const polInner = d.pol
        ? `<p>Referens (${esc(referensKortnamn())}): <strong>${kr(d.pol.p10)} – ${kr(d.pol.p90)}</strong> (median ${kr(d.pol.med)}) · nivå: <strong>${esc(d.polLevel || '–')}</strong></p>
           ${d.band && d.band.position != null
                ? `<div class="gd-big">${svPct((d.band.position * 100), 0)}</div><p>Gruppens median ligger så långt in i spannet (0 % = P10, 100 % = P90).</p>`
                : '<p class="gd-note">Spannet är för smalt för ett positionsmått.</p>'}
           ${d.compliance ? `<p>${d.compliance.under} av ${d.compliance.n} under P10 · ${d.compliance.over} över P90.</p>` : ''}`
        : missing(`Ingen policyreferens träffar denna grupp (varken på ${T.kod.en} eller ${T.niva.en}).`);

    // 5. § 3:10
    const lvRow = p => `<li>${esc(gruppNamn({ aid: p.maAid, yrke: p.maLabel }))} — skillnad ${svPct(p.gapPct, 1)} (${kr(p.gapKr)})</li>`;
    const lvNot = d.lvUtelamnade ? `<p class="gd-note">${esc(_parUtelamnadeNot(d.lvUtelamnade))}</p>` : '';
    const lvInner = (d.lvAsSubject.length || d.lvAsComparator.length)
        ? `${d.lvAsSubject.length ? `<p><strong>Gruppen är kvinnodominerad och jämförs mot:</strong></p><ul class="gd-list">${d.lvAsSubject.map(lvRow).join('')}</ul>` : ''}
           ${d.lvAsComparator.length ? `<p><strong>Gruppen används som ${T.jamforelse.en} för:</strong></p><ul class="gd-list">${d.lvAsComparator.map(p => `<li>${esc(gruppNamn({ aid: p.kvAid, yrke: p.kvLabel }))} — skillnad ${svPct(p.gapPct, 1)}</li>`).join('')}</ul>` : ''}${lvNot}`
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
        <p class="reg-caveat-inline"><strong>Dossiern dokumenterar inte sakliga skäl.</strong> Skälen dokumenterar du i Handlingsplan.</p>
        ${_hpBedomningHtml(_hpBedomningar(delar => _hpPassarGrupp(delar, String(d.aid), String(d.yrke), String(d.bas))), { medGrupp: true })}
        <div class="gd-grid">
            ${card('Nyckeltal', nyckeltal)}
            ${card('Ojusterad löneskillnad', gapInner)}
            ${harAlder() ? card('Skillnad när åldern räknats bort', adjInner) : ''}
            ${card('Mot organisationens lönepolitik', polInner)}
            ${card('Likvärdigt arbete', lvInner)}
            ${card('Extern jämförelse', benchInner)}
            ${card('Hur angeläget — och vad kostar det?', prioInner)}
            ${card('Frågor att undersöka', hypInner, 'Regelbaserade uppslag, inte färdiga motiveringar. Ingen AI är inblandad.')}
        </div>`;
}

/**
 * Ren textversion: kopian till urklipp och rapportens bilaga med gruppdossierer. Med `stampel: false` utelämnas
 * meningen om sänkt tröskel — bilagan skriver den en gång överst i stället för en gång per grupp.
 * @param {any} d
 * @param {{stampel?: boolean}} [val]
 */
export function gruppdossierAsText(d, { stampel = true } = {}) {
    const kr = v => v == null || !isFinite(v) ? '–' : Math.round(v).toLocaleString('sv-SE') + ' kr';
    const L = [];
    L.push(`Gruppdossier: ${gruppNamn(d)} – BAS ${d.bas}`);
    L.push(`Antal: ${d.n} (${d.nKv} kvinnor, ${d.nMa} män) · median ${kr(d.median)} · P10–P90 ${kr(d.p10)}–${kr(d.p90)}`);
    if (d.skr) L.push(`Nationell referens: ${svPct(d.skr.pct, 0)} kvinnor i ${skrDelText(d.skr.del)} (${skrKallaKort()})`);
    if (d.ansvar) L.push(`Ansvar: ledningsansvar ${d.ansvar.ledning.kv} kvinnor / ${d.ansvar.ledning.ma} män · särskilt uppdrag ${d.ansvar.uppdrag.kv} kvinnor / ${d.ansvar.uppdrag.ma} män`);
    if (d.gap && d.gap.pct != null) L.push(`Ojusterad löneskillnad: ${svPct(d.gap.pct, 1)} av männens median`);
    if (d.gap && d.gap.arsbelopp) L.push(d.gap.arsbelopp);
    if (d.adjusted && d.adjusted.status === 'ok') L.push(`Skillnad när åldern räknats bort (BAS ${d.bas}): ${svPct(d.adjusted.gapPct, 1)}`);
    if (d.pol) L.push(`Referensspann ${referensKortnamn()}: ${kr(d.pol.p10)}–${kr(d.pol.p90)} (${d.polLevel})`
        + (d.band && d.band.position != null ? ` · position ${svPct((d.band.position * 100), 0)}` : ''));
    if (d.prio) L.push(`Prioritering: ${d.prio.status} · avvikelse ${svPct(d.prio.diffPct, 1)} · ${kr(d.prio.annualGapTotal)} per år`);
    // Förslagen är HTML (fetstil m.m.); textkopian tar bort taggarna och avkodar tecknen
    // utan att tolka HTML.
    const somText = h => htmlTillText(h);
    if (d.suggestions.length) { L.push('Frågor att undersöka:'); d.suggestions.forEach(s => L.push('  – ' + somText(s.text))); }
    if (d.lvUtelamnade) L.push(_parUtelamnadeNot(d.lvUtelamnade));
    L.push('Obs! Dossiern dokumenterar inte sakliga skäl – den bedömningen görs separat.');
    // Delbar på egen hand (urklipp): stämpeln när tröskeln är sänkt
    if (stampel && _kSanktNot()) L.push('', _kSanktNot());
    return L.join('\n');
}

/** Det som körs vid laddning, i filens ordning; src/app/index.js anropar delarnas uppstart i sifferordning. */
export function uppstartGruppdossier() {
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
        const d = sel ? medExportLage(() => buildGruppdossier(/** @type {HTMLInputElement} */ (sel).value)) : null;   // texten lämnar verktyget (ADR-51)
        if (!d) return;
        const txt = medExportLage(() => gruppdossierAsText(d));
        const done = () => { if (typeof announceToScreenReader === 'function') announceToScreenReader('Dossier kopierad.'); };
        if (navigator.clipboard?.writeText) navigator.clipboard.writeText(txt).then(done).catch(() => {});
        else done();
    });
}

// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson

// ---- Prioriteringsanalys ----
// Samlar yrkesgrupper × BAS, beräknar avvikelse mot vald referens
// och rangordnar efter ett sammansatt prioriteringsindex.
/**
 * Bygger prioriteringslistan: beräknar avvikelse mot referens, kostnad för utjämning
 * (inkl. PO-påslag och beräkningsperiod), klassning (Utred/Bevaka/Analysera/OK),
 * jämställdhetsindex, och en sammanvägd prio-poäng (avvikelse·volym·jämställdhet).
 * Driver "Prioritering"-tabben + EU-kartläggningens åtgärdslista.
 * @param {string} reference - Referens-mätsticka: 'stallningstagande'|'statistik'
 * @returns {Array<Object>} Lista av prio-items, sorterade på score desc.
 */
function computePrioritization(reference) {
    // Modellen (grupperingen, indexet, k-regeln) ligger i src/lib/prioritering.js (ADR-8).
    // Här översätts bara state till referensFor och parametrar.
    return _prPrioritera(getData(), {
        referensFor: (aid, bas) => {
            if (reference === 'stallningstagande') {
                const pol = policyFor(aid, bas);
                return pol && pol.med ? { median: pol.med, kalla: referensKortnamn() } : null;
            }
            // 'statistik'
            const sr = state.statistik.find(s => s.aid === aid && s.bas === bas)
                   || state.statistik.find(s => s.aid === aid && !s.bas);
            return sr && sr.median > 0 ? { median: sr.median, kalla: 'jämförelsestatistiken' } : null;
        },
        kTroskel: kTroskel(),
        prioConfig: state.prioConfig,
        prioWeights: state.prioWeights,
        costSettings: state.costSettings,
        bristAids: state.bristAids
    });
}

// ---- #13 AI-fri "förslag till motivering"-engine ----
/**
 * Genererar regelbaserade förslag på testbara hypoteser/sakliga skäl för
 * en prio-rad. INGEN AI/LLM — bara deterministiska regler över datan.
 * Förslagen är frågor HR själv borde ställa, inte färdiga motiveringar.
 *
 * Regelpaket:
 *   1. Underlag — för få personer av endera kön
 *   2. Statistisk styrka — under MDE-tröskeln
 *   3. Ålderskillnad mellan kön i samma grupp
 *   4. Glasstaks/golvs-mönster — kvinnor överrepresenterade i lägsta lönekvintilen
 *   5. Bristyrke flagga — marknadsläge som potentiellt sakligt skäl
 *   6. Quick-win — hanterbar kostnad, lämplig för pilotåtgärd
 *   7. Positiv differens — över referens, andra slags motivering
 *
 * @param {Object} item - Prio-item med _rows.
 * @returns {Array<{type:'warn'|'info'|'ok'|'flag', text:string}>}
 */
function generateMotivationSuggestions(item) {
    const out = [];
    const rows = item._rows || [];
    if (!rows.length) return out;

    // 1. Underlag: ett kön under minsta gruppstorlek (beslut av produktägaren 2026-10-16; tidigare ett fast 5)
    if (item.kvN < kTroskel() || item.maN < kTroskel()) {
        out.push({
            type: 'warn',
            text: `Underlaget är litet (${item.kvN} kvinnor / ${item.maN} män; minsta gruppstorlek ${kTroskel()}). Skillnaden kan inte säkerställas statistiskt — ett tips är att överväga att slå ihop med en näraliggande BAS-grupp eller titta på individerna var för sig.`
        });
    }

    // 2. Power-tröskel
    if (state.powerAnalysis && Math.abs(item.diffPct) < state.powerAnalysis.mdePct && item.n < 30) {
        out.push({
            type: 'info',
            text: `Skillnaden (${svPct(item.diffPct, 1)}) ligger under detektionströskeln (~${svPct(state.powerAnalysis.mdePct, 1)}). Det innebär att skillnaden är så liten att den inte med säkerhet kan skiljas från slumpmässiga variationer.`
        });
    }

    // 3. Åldersskillnad mellan kön i samma grupp
    const kvAges = rows.filter(r => r.kon.includes('kvinna')).map(r => r.alder).filter(a => a > 0);
    const maAges = rows.filter(r => r.kon === 'man' || r.kon === 'män').map(r => r.alder).filter(a => a > 0);
    if (kvAges.length >= 3 && maAges.length >= 3) {
        const meanKvAge = kvAges.reduce((s, v) => s + v, 0) / kvAges.length;
        const meanMaAge = maAges.reduce((s, v) => s + v, 0) / maAges.length;
        const ageDiff = meanMaAge - meanKvAge;
        if (Math.abs(ageDiff) >= 3) {
            const who = ageDiff > 0 ? 'Männen' : 'Kvinnorna';
            out.push({
                type: 'info',
                text: `${who} är i snitt <strong>${svTal(Math.abs(ageDiff), 1)} år äldre</strong> än motparten i denna grupp (${svTal(meanMaAge, 0)} mot ${svTal(meanKvAge, 0)}). Vi rekommenderas att ni stämmer av om åldersskillnaden kan förklara en del av lönegapet — erfarenhet och tid i yrket är ofta sakliga grunder för löneskillnader.`
            });
        }
    }

    // 4. Glasstak/-golv-mönster: kvinnor överrepresenterade i lägsta lönekvintil
    //    (lönepositionsmått per kön: kräver k-tröskeln för båda könen, ADR-12)
    if (item.kvN >= kTroskel() && item.maN >= kTroskel()) {
        const allLons = rows.map(r => r.lon).sort((a, b) => a - b);
        const q1 = allLons[Math.floor(allLons.length * 0.2)];
        const kvBelowQ1 = rows.filter(r => r.kon.includes('kvinna') && r.lon <= q1).length;
        const maBelowQ1 = rows.filter(r => (r.kon === 'man' || r.kon === 'män') && r.lon <= q1).length;
        const kvShareInQ1 = item.kvN > 0 ? kvBelowQ1 / item.kvN : 0;
        const maShareInQ1 = item.maN > 0 ? maBelowQ1 / item.maN : 0;
        if (kvShareInQ1 >= 0.4 && kvShareInQ1 - maShareInQ1 >= 0.2) {
            out.push({
                type: 'flag',
                text: `<strong>Glasstaks-/klistergolvsmönster:</strong> ${svPct((kvShareInQ1*100), 0)} av kvinnorna i denna grupp ligger i den lägsta lönekvintilen, jämfört med ${svPct((maShareInQ1*100), 0)} av männen. Det kan vara värdefullt att titta närmare på hur karriärvägar, befordringar och lönesättningsbeslut ser ut för gruppen.`
            });
        }
    }

    // 5. Bristyrke
    if (item.isBrist) {
        out.push({
            type: 'info',
            text: 'Markerat som <strong>bristyrke</strong>. Marknadsläge (rekryteringssvårighet) kan vara ett sakligt skäl — dokumentera gärna marknadsläget med stöd av extern statistik (t.ex. från SCB lönestrukturstatistik).'
        });
    }

    // 6. Quick-win
    if (item.isQuickWin) {
        out.push({
            type: 'ok',
            text: `<strong>Snabbvinst:</strong> få personer (${item.n}), hanterbar kostnad per person (~${Math.round(item.costPerPerson).toLocaleString('sv-SE')} kr/månad). Lämplig för pilotåtgärd för att visa förändringsvilja.`
        });
    }

    // 7. Positiv diff (över referens)
    if (item.diffPct > 5) {
        out.push({
            type: 'info',
            text: `Ligger ${svPct(item.diffPct, 1)} <strong>över</strong> referens. Detta kan ofta förklaras av specialistkompetens, marknadsläge i området eller individuella prestationer — det är bra att dokumentera detta för att skapa ökad transparens i lönesättningen.`
        });
    }

    // 8. Statistisk obetydlighet
    if (Math.abs(item.diffPct) < 1.5 && item.n >= 10) {
        out.push({
            type: 'ok',
            text: `Skillnaden är liten (${svPct(Math.abs(item.diffPct), 1)}). Inom normal variation — och är sannolikt inte något som kräver ytterligare utredning.`
        });
    }

    return out;
}

// Enhetlig "uppmärksamhetstrappa" — coachande, inte föreskrivande. Verktyget
// föreslår var HR tittar; det dömer inte. Samma skala används i alla flikar.
// (De interna nycklarna behålls oförändrade; bara etikett/ikon/färg är coachande.)
const PRIO_STATUS_INFO = {
    akut:      { label: 'Börja här',     icon: ikon('nal'), color: FARG.granska, bg: FARG.granskaBg, klass: 'bricka-granska' },
    atgard:    { label: 'Värt att granska', icon: ikon('sok'), color: FARG.granska, bg: FARG.granskaBg, klass: 'bricka-granska' },
    bevaka:    { label: 'Följ upp',      icon: ikon('oga'), color: FARG.varning, bg: FARG.varningBg, klass: 'bricka-varning' },
    ok:        { label: 'Balanserat',    icon: ikon('bock'),  color: FARG.ok, bg: FARG.okBg, klass: 'bricka-ok' },
    analysera: { label: 'Över referens', icon: ikon('info'), color: FARG.info, bg: FARG.infoBg, klass: 'bricka-info' }
};

function _selectedPrioReference() {
    const r = document.querySelector('input[name="prio-ref"]:checked');
    return r ? /** @type {HTMLInputElement} */ (r).value : 'stallningstagande';
}

function _selectedPrioLabelMode() {
    const el = document.getElementById('prio-label-mode');
    return el ? /** @type {HTMLInputElement} */ (el).value : 'topp10';
}

function _makePrioLabel(item, rank, mode) {
    if (mode === 'ingen') return '';
    const isTop10 = rank <= 10;
    const isAkut  = item.status === 'akut';
    // AID + etikett: visa hela yrket (AID + benämning) men trunkerat för läsbarhet
    const yrkeShort = item.yrke.length > 28 ? item.yrke.substring(0, 27) + '…' : item.yrke;
    const fullLabel = `${yrkeShort}·${item.bas}`;
    let show = false;
    if (mode === 'alla')         show = true;
    else if (mode === 'topp10')  show = isTop10;
    else if (mode === 'akuta')   show = isAkut || isTop10;
    if (!show) return '';
    return isTop10 ? `#${rank} ${fullLabel}` : fullLabel;
}

// Avrunda kostnader till "snygga" referensvärden (10k, 25k, 50k, 100k, 250k, 500k, 1M, ...)
function _niceCostLevels(maxCost) {
    if (!maxCost || maxCost <= 0) return [10000, 50000, 100000];
    const log10 = Math.floor(Math.log10(maxCost));
    const base  = Math.pow(10, log10);
    // Tre nivåer: 10%, 30%, 100% av size cap (rough)
    const cap = base * Math.ceil(maxCost / base);
    return [Math.round(cap * 0.1), Math.round(cap * 0.3), Math.round(cap)];
}
function _fmtCost(kr) {
    if (kr >= 1e6) return svTal(kr/1e6, kr >= 1e7 ? 0 : 1) + ' Mkr';
    if (kr >= 1e3) return Math.round(kr/1e3) + ' tkr';
    return Math.round(kr) + ' kr';
}

function renderPrioritering() {
    _simSynkaKnapp();   // simulatorns knapp följer tröskeln och urvalet (14-lonesimulator.js)
    const ref = _selectedPrioReference();
    const empty   = document.getElementById('prio-empty');
    const content = document.getElementById('prio-content');
    if (!empty || !content) return;

    const refNamnEl = document.getElementById('prio-ref-policy-namn');
    if (refNamnEl) refNamnEl.textContent = referensKortnamn();
    // Saknas referensdata?
    const hasRefData = ref === 'stallningstagande' ? state.policy.length > 0 : state.statistik.length > 0;
    if (!hasRefData) {
        empty.style.display = 'block';
        content.style.display = 'none';
        const text = document.getElementById('prio-empty-text');
        if (text) text.textContent = ref === 'stallningstagande'
            ? 'Ladda upp ert lönepolitiska ställningstagande — eller ett organisationspaket — på Översikt. Verktyget kan inte rangordna utan referenspunkt.'
            : 'Ladda upp jämförelsestatistik — eller ett organisationspaket — på Översikt. Verktyget kan inte rangordna utan referenspunkt.';
        return;
    }
    empty.style.display = 'none';
    content.style.display = 'block';

    const items = computePrioritization(ref);
    if (!items.length) {
        content.innerHTML = `<p class="farg-dampad pad-32 ta-mitt">Ingen yrkesgrupp har matchande referens i den valda jämförelsen. Kontrollera att <code>${ref === 'stallningstagande' ? 'BAS-intervallen' : 'AID-koderna'}</code> i din strukturdata matchar jämförelsefilen.</p>`;
        return;
    }

    // Sammanfattningsstatistik
    const akutCount  = items.filter(i => i.status === 'akut').length;
    const underCount = items.filter(i => i.diffPct < -5).length;
    const overCount  = items.filter(i => i.diffPct >  5).length;
    const totalCost  = items.reduce((s, i) => s + i.annualGapTotal, 0);
    const fmt = new Intl.NumberFormat('sv-SE');
    const fmtMkr = totalCost >= 1e6 ? svTal(totalCost/1e6, 1) + ' Mkr' :
                   totalCost >= 1e3 ? Math.round(totalCost/1e3) + ' tkr' : Math.round(totalCost) + ' kr';
    /** @type {HTMLElement} */ (document.getElementById('prio-stat-akut')).textContent  = String(akutCount);
    /** @type {HTMLElement} */ (document.getElementById('prio-stat-under')).textContent = String(underCount);
    /** @type {HTMLElement} */ (document.getElementById('prio-stat-over')).textContent  = String(overCount);
    /** @type {HTMLElement} */ (document.getElementById('prio-stat-cost')).textContent  = String(fmtMkr);
    // Avsnittens nyckeltal (ADR-41): samma tal som rutorna ovanför.
    _laNyckel('nyckel-pr-lista', `${items.length} ${items.length === 1 ? 'grupp' : 'grupper'}${akutCount ? ` · ${akutCount} att börja med` : ''}`, akutCount > 0);
    _laNyckel('nyckel-pr-kostnad', totalCost > 0 ? fmtMkr : '');
    const anpassat = JSON.stringify(state.prioConfig) !== JSON.stringify(PRIO_CONFIG_DEFAULTS);
    _laNyckel('nyckel-pr-installningar', anpassat ? 'Anpassade värden' : 'Standardvärden', anpassat);
    const costPerEl = document.getElementById('prio-stat-cost-period');
    if (costPerEl) costPerEl.textContent = `${state.costSettings.months} mån, inkl ${svPct(state.costSettings.poPct, 2)} PO`;

    // Sätt rang per item (matchar tabellen)
    items.forEach((it, idx) => { it.rank = idx + 1; });

    // Pareto-kurva: kumulativ kostnadsfördelning
    const itemsForPareto = items.filter(i => i.annualGapTotal > 0).sort((a, b) => b.annualGapTotal - a.annualGapTotal);
    const totalParetoCost = itemsForPareto.reduce((s, i) => s + i.annualGapTotal, 0);
    const paretoEl = document.getElementById('chart-prio-pareto');
    const paretoSummary = document.getElementById('prio-pareto-summary');
    if (paretoEl && itemsForPareto.length > 0 && totalParetoCost > 0) {
        const visade = itemsForPareto.slice(0, Math.min(40, itemsForPareto.length));
        // Kumulativ procent, och antalet grupper som når 50 % och 80 %
        let acc = 0;
        const cumPct = visade.map(i => { acc += i.annualGapTotal; return (acc / totalParetoCost) * 100; });
        const n80 = cumPct.findIndex(p => p >= 80) + 1 || itemsForPareto.length;
        const n50 = cumPct.findIndex(p => p >= 50) + 1 || itemsForPareto.length;
        ritaFigur(paretoEl, _prioKostnadFigur(visade, cumPct));
        { let not = document.getElementById('prio-kostnad-not');
          if (!not) { not = document.createElement('p'); not.id = 'prio-kostnad-not'; not.className = 'diagramkort-not'; (paretoEl.closest('.chart-export-host') || paretoEl).insertAdjacentElement('afterend', not); }
          not.textContent = _prioKostnadNot(itemsForPareto, totalParetoCost); }
        if (paretoSummary) {
            paretoSummary.innerHTML = `
                <div class="farg-primary fw-700 marg-b-4">Total: ${_fmtCost(totalParetoCost)}</div>
                <div class="text-dampad-xs marg-b-6">${state.costSettings.months} mån × ${svPct(state.costSettings.poPct, 2)} PO</div>
                <div>Topp <strong>${n50}</strong> grupper = 50%</div>
                <div>Topp <strong>${n80}</strong> grupper = 80%</div>
                <div class="finstilt">Alla under-betalda grupper sammanställda. Fokus på topp 80%-gränsen ger maximal kostnadseffekt.</div>
            `;
        }
    } else if (paretoEl) {
        rensaFigur(paretoEl);
        paretoEl.innerHTML = '<div class="farg-dampad pad-32 ta-mitt">Inga grupper under referensen — kurvan visas inte.</div>';
        if (paretoSummary) paretoSummary.innerHTML = '';
    }

    // Bubbeldiagram: avvikelse mot referensen (x) mot gruppens storlek (y, log), med kostnaden som bubblans yta.
    const refLabel = ref === 'stallningstagande' ? referensNamn() : 'jämförelsestatistiken';
    ritaFigur('chart-prio-matrix', _prioMatrisFigur(items, _selectedPrioLabelMode(), refLabel, state.prioConfig), { hojd: 520 });

    // Uppdatera storlekslegenden under grafen
    const sizeMax = Math.max(...items.map(i => Math.max(i.annualGapTotal, i.annualOverTotal, 1)));
    const levels = _niceCostLevels(sizeMax);
    const s1 = document.getElementById('prio-legend-s1');
    const s2 = document.getElementById('prio-legend-s2');
    const s3 = document.getElementById('prio-legend-s3');
    if (s1) s1.textContent = _fmtCost(levels[0]);
    if (s2) s2.textContent = _fmtCost(levels[1]);
    if (s3) s3.textContent = _fmtCost(levels[2]) + '+';

    // Audit
    const baseP = buildBaseAudit();
    // Räkna grupper utan referens
    const dForCount = getData();
    let smallCount = 0, noRefCount = 0;
    const groupCheck = {};
    dForCount.forEach(r => {
        const m = r.yrke.match(/^(\d+)/);
        const aid = m ? m[1] : r.yrke;
        const k = `${r.yrke}|${r.bas}`;
        if (!groupCheck[k]) groupCheck[k] = { n: 0, aid, bas: r.bas };
        groupCheck[k].n++;
    });
    Object.values(groupCheck).forEach(g => {
        if (isKMasked(g.n)) { smallCount++; return; }
        if (ref === 'stallningstagande') {
            const pol = policyFor(g.aid, g.bas);
            if (!pol || !pol.med) noRefCount++;
        } else {
            const sr = state.statistik.find(s => s.aid === g.aid && s.bas === g.bas)
                  || state.statistik.find(s => s.aid === g.aid && !s.bas);
            if (!sr) noRefCount++;
        }
    });
    setAudit('prioritering', {
        title: 'Prioriteringsanalys',
        ...baseP,
        usedInAnalysis: items.length,
        analysisExclusions: [
            ...(smallCount > 0 ? [[`Yrke×BAS-grupper för små (k-anonymitet n&lt;${kTroskel()})`, smallCount]] : []),
            ...(noRefCount > 0 ? [[`Yrke×BAS-grupper utan matchning i ${ref === 'stallningstagande' ? referensNamn() : 'jämförelsestatistiken'}`, noRefCount]] : [])
        ],
        formler: [
            ['Avvikelse %', '<code>(organisationens median / referensens median) − 1</code> i %'],
            ['Åtgärdskostnad', `<code>|avvikelse kr/mån| × ${state.costSettings.months} mån × (1 + ${svPct(state.costSettings.poPct, 2)}/100) × antal personer</code> (endast om under referens, inkl PO-påslag)`],
            ['Prioriteringsindex', `<code>riktningsvikt × (avvikelse·${state.prioWeights.avvikelse}% + volym·${state.prioWeights.volym}% + jämställdhet·${state.prioWeights.jamstalldhet}%)</code>, skala 0-100`],
            ['Riktningsvikt', '1.0 om under referens, 0.5 om över (under-betalning vägs tyngre)'],
            ['Status', `Prioriterad utredning om avvikelse &lt; ${state.prioConfig.atgardThreshold}% och n ≥ ${state.prioConfig.akutMinN} · Utredning rekommenderas om avvikelse &lt; ${state.prioConfig.atgardThreshold}% · Följ upp om &lt; ${state.prioConfig.bevakaThreshold}% · Översyn rekommenderas om &gt; +${state.prioConfig.analyseraThreshold}%`]
        ],
        notes: [
            `Aktuell referens: <strong>${ref === 'stallningstagande' ? esc(referensNamn()) + ' (per BAS)' : 'jämförelsestatistiken (per AID)'}</strong>`,
            ...(JSON.stringify(state.prioConfig) !== JSON.stringify(PRIO_CONFIG_DEFAULTS) ? [`<strong>${ikon('kugghjul')} Anpassad konfiguration aktiv</strong> – tröskelvärdena har justerats från standardvärdena (Utredning: -5%, "Snarast"-volym: 10, Uppföljning: -2%, Granskning: +5%)`] : []),
            'Tabellen visar topp 30 grupper rankade efter prioriteringsindex',
            'Bubbeldiagrammets storlek = årskostnad, x = avvikelse, y = antal personer (log skala)'
        ]
    });

    // Tabell – topp 30 (med filter)
    const tbody = /** @type {HTMLElement} */ (document.querySelector('#prio-table tbody'));
    tbody.innerHTML = '';
    const filterQuickwin = /** @type {HTMLInputElement} */ (document.getElementById('prio-filter-quickwin'))?.checked;
    const filterBrist    = /** @type {HTMLInputElement} */ (document.getElementById('prio-filter-brist'))?.checked;
    const filteredItems = items.filter(i =>
        (!filterQuickwin || i.isQuickWin) &&
        (!filterBrist    || i.isBrist)
    );
    const top = filteredItems.slice(0, 30);
    top.forEach(i => {
        const tr = document.createElement('tr');
        const statusInfo = PRIO_STATUS_INFO[i.status];
        const sgnKr  = i.diffKr  >= 0 ? '+' : '';
        const gapBar = buildBarCell(i.gapPct, 15);
        const diffBar = buildBarCell(i.diffPct, 25);
        const costTxt = i.annualGapTotal > 0 ? fmt.format(Math.round(i.annualGapTotal)) + ' kr' : '–';
        const costSort = i.annualGapTotal > 0 ? i.annualGapTotal : 0;
        const costPerPersonTxt = i.costPerPerson > 0 ? fmt.format(Math.round(i.costPerPerson)) : '–';
        const quickwinBadge = i.isQuickWin ? ' <span title="Snabb vinst" class="hjalpmarke hjalp-markor">' + ikon('blixt', 14) + '</span>' : '';
        const bristBadge    = i.isBrist    ? ' <span title="Bristyrke" class="hjalpmarke hjalp-markor">' + ikon('statusVarning', 14) + '</span>' : '';
        // #2 Power-varning per grupp: visa ⚠️ när gruppens MDE > observerad avvikelse
        // eller när någon köns-cell har < 5 personer.
        const groupMDE = computeGroupMDE(i.kvN, i.maN);
        const lowPower = groupMDE && (groupMDE.tooSmall || groupMDE.mdePct > Math.abs(i.diffPct));
        const powerBadge = lowPower
            ? ` <span title="Låg statistisk styrka — gruppens minsta detekterbara effekt ≈ ${svPct(groupMDE.mdePct, 1)}, ${groupMDE.tooSmall ? 'och underlaget per kön är litet (<5)' : 'större än observerad avvikelse'}. Tolka resultatet med försiktighet." class="farg-varning hjalpmarke fs-0_92em hjalp-markor">${ikon('statusVarning', 14)}</span>`
            : '';
        const rowKey = `${i.yrke}|${i.bas}`;
        // #13 Förslag-knapp: suggestionerna beräknas vid expand, inte i förväg
        const suggestionBtn = i._rows && i._rows.length
            ? `<button class="btn-suggest bak-transparent ram-1-kant rund-4 pekare fs-xs marg-v-4 pad-2-6" data-row-key="${esc(rowKey)}" type="button" title="Visa förslag på sakliga skäl-hypoteser" aria-label="Visa motiveringsförslag för ${esc(i.yrke)}" aria-expanded="false">${ikon('lampa')}</button>`
            : '';
        tr.innerHTML = `
            <td class="sticky-col-1" data-sort-value="${i.priorityIndex}"><div class="rund-12 inline-block fs-sm fw-700 min-bredd-36 pad-3-8 ta-mitt ${i.priorityIndex>60?'bricka-kritisk':i.priorityIndex>40?'bricka-varning':'bricka-neutral'}">${svTal(i.priorityIndex, 0)}</div></td>
            <th scope="row" class="sticky-col-2 ram-b-1-kant fs-md fw-normal ta-vanster">${esc(i.yrke)}${quickwinBadge}${bristBadge}${powerBadge}</th>
            <td>${esc(i.bas)}</td>
            <td class="t-hoger">${i.n}</td>
            <td class="t-mitt">${i.kvN}/${i.maN}</td>
            <td class="t-hoger" data-sort-value="${i.median}">${fmt.format(Math.round(i.median))}</td>
            <td class="farg-dampad ta-hoger" data-sort-value="${i.refMedian}">${fmt.format(Math.round(i.refMedian))}</td>
            <td class="t-hoger">${diffBar}</td>
            <td class="t-hoger${i.diffKr < 0 ? ' f-kritisk' : ''}" data-sort-value="${i.diffKr}">${sgnKr}${fmt.format(Math.round(i.diffKr))}</td>
            <td class="t-hoger">${gapBar}</td>
            <td class="t-hoger${i.costPerPerson > 0 ? ' f-kritisk' : ''}" data-sort-value="${i.costPerPerson}">${costPerPersonTxt}</td>
            <td class="fw-600 ta-hoger" data-sort-value="${costSort}">${costTxt}</td>
            <td class="t-mitt" data-sort-value="${i.priorityIndex}"><span class="rund-12 inline-block fs-xs fw-600 pad-3-10 ${statusInfo.klass}">${statusInfo.icon ? statusInfo.icon + ' ' : ''}${statusInfo.label}</span></td>
            <td class="t-mitt">
                <input type="checkbox" class="brist-toggle" data-aid="${esc(i.aid)}" ${i.isBrist ? 'checked' : ''} aria-label="Markera ${esc(i.yrke)} som bristyrke">
            </td>
            <td class="ta-mitt ingen-radbrytning">
                <button class="row-cross-link" data-target="rapport" data-yrke="${esc(i.yrke)}" data-bas="${esc(i.bas)}" title="Öppna i Löneöversikten" aria-label="Öppna ${esc(i.yrke)} i Löneöversikten">${ikon('pilUt', 14)}</button>${suggestionBtn}
                <button class="btn-evidence" data-prio-row="1" type="button" title="Visa beräkningen bakom prioritetsindex" aria-label="Visa bevis för ${esc(i.yrke)}">${ikon('sok')}</button>
                <button class="btn-evidence" data-open-dossier="${esc(i.aid)}|${esc(i.bas)}" type="button" title="Öppna gruppdossiern — allt om denna grupp på en sida" aria-label="Öppna gruppdossier för ${esc(i.yrke)}">${ikon('dokument')}</button>
            </td>
        `;
        // Cache item-referensen på TR så suggestion-handler kan plocka upp den
        tr._prioItem = i;
        tbody.appendChild(tr);
    });
    tillampaDataStil(tbody);

    // Bevis-popup för prio-rader
    tbody.querySelectorAll('.btn-evidence[data-prio-row]').forEach(btn => {
        btn.addEventListener('click', e => {
            e.stopPropagation();
            const tr = btn.closest('tr');
            const item = tr?._prioItem;
            if (!item) return;
            _openEvidenceModal(_evidenceForPrioItem(item, ref));
        });
    });

    // #13 Suggestion-toggle-handler: expanderar en sub-rad under den klickade
    tbody.querySelectorAll('.btn-suggest').forEach(btn => {
        btn.addEventListener('click', e => {
            e.stopPropagation();
            const tr = /** @type {HTMLElement} */ (btn.closest('tr'));
            const item = tr._prioItem;
            if (!item) return;
            const next = tr.nextElementSibling;
            // Stäng om redan öppen
            if (next && next.classList.contains('suggest-row')) {
                next.remove();
                btn.setAttribute('aria-expanded', 'false');
                btn.textContent = 'Förslag';
                return;
            }
            const suggestions = generateMotivationSuggestions(item);
            const newTr = document.createElement('tr');
            newTr.classList.add('suggest-row');
            const colCount = tr.children.length;
            if (suggestions.length === 0) {
                newTr.innerHTML = `<td colspan="${colCount}" class="bak-yta pad-8-16"><em class="f-dampad">Inga regelbaserade förslag matchar denna grupp. Använd kommentarsfältet för fri motivering.</em></td>`;
            } else {
                const items = suggestions.map(s => `<li class="ms-${s.type}">${s.text}</li>`).join('');
                newTr.innerHTML = `<td colspan="${colCount}"><div class="motivation-suggestions"><strong>${ikon('lampa')} Hypoteser att granska för ${esc(item.yrke)} / BAS ${esc(item.bas)}:</strong><ul>${items}</ul><p class="text-dampad-xs kursiv marg-t-6">Förslagen är regelbaserade frågeställningar — inte färdiga motiveringar. Verifiera mot data och dokumentera i kommentarsfältet ovan.</p></div></td>`;
            }
            /** @type {HTMLElement} */ (tr.parentNode).insertBefore(newTr, tr.nextSibling);
            btn.setAttribute('aria-expanded', 'true');
            btn.textContent = 'Stäng';
        });
    });
    // Listeners för bristyrke-toggle och kommentarer
    tbody.querySelectorAll('.brist-toggle').forEach(cb => {
        cb.addEventListener('change', e => {
            const aid = /** @type {HTMLElement} */ (e.target).dataset.aid || '';
            if (/** @type {HTMLInputElement} */ (e.target).checked) state.bristAids.add(aid);
            else state.bristAids.delete(aid);
            renderPrioritering();
        });
    });
}

// Lyssnare för referens-toggle och etikett-toggle
document.querySelectorAll('input[name="prio-ref"]').forEach(el => {
    el.addEventListener('change', renderPrioritering);
});
document.getElementById('prio-label-mode')?.addEventListener('change', renderPrioritering);
document.getElementById('prio-filter-quickwin')?.addEventListener('change', renderPrioritering);
document.getElementById('prio-filter-brist')?.addEventListener('change', renderPrioritering);

// F: Stegvis konsekvensanalys — visar effekt om vi gör topp N
document.getElementById('btn-prio-consequence')?.addEventListener('click', () => {
    const panel = document.getElementById('prio-consequence-panel');
    if (!panel) return;
    if (panel.style.display === 'block') { panel.style.display = 'none'; return; }
    const ref = _selectedPrioReference();
    const items = computePrioritization(ref);
    if (!items.length) { panel.innerHTML = '<p class="farg-dampad pad-12">Ingen data att analysera.</p>'; panel.style.display='block'; return; }
    const totalCost = items.reduce((s, i) => s + i.annualGapTotal, 0);
    const checkpoints = [3, 5, 10, 15, 20, 30, items.length];
    const fmt = new Intl.NumberFormat('sv-SE');
    let rows = '';
    let cumCost = 0;
    items.forEach((i, idx) => {
        cumCost += i.annualGapTotal;
        if (checkpoints.includes(idx + 1)) {
            const pctOfTotal = totalCost > 0 ? svTal(cumCost / totalCost * 100, 0) : '0';
            const personerLyfta = items.slice(0, idx + 1).reduce((s, x) => s + x.n, 0);
            rows += `<tr><td>Topp <strong>${idx + 1}</strong></td><td class="t-hoger">${fmt.format(personerLyfta)} pers</td><td class="t-hoger">${_fmtCost(cumCost)}</td><td class="t-hoger">${pctOfTotal} %</td></tr>`;
        }
    });
    panel.innerHTML = `
        <div class="bak-white ram-1-kant rund-8 pad-14-16">
            <h4 class="underrubrik">Stegvis konsekvensanalys: budgetpåverkan om N grupper utreds</h4>
            <p class="text-dampad-sm lh-1_55 marg-0-0-10">
                Visar kumulativ kostnad och täckningsgrad om de prioriterade grupperna åtgärdas i ordning. Underlättar val mellan ambitioner: "vi tar topp 5 i år" eller "vi tar topp 10".
            </p>
            <table class="data-table st-088">
                <thead><tr><th>Åtgärd</th><th class="t-hoger">Antal personer</th><th class="t-hoger">Total kostnad</th><th class="t-hoger">Andel av total</th></tr></thead>
                <tbody>${rows}</tbody>
            </table>
        </div>
    `;
    panel.style.display = 'block';
});

// Lyssnare för konfigurerbara tröskelvärden
function _readPrioConfigInputs() {
    const get = (id, def) => {
        const el = document.getElementById(id);
        if (!el) return def;
        const v = parseFloat(/** @type {HTMLInputElement} */ (el).value);
        return isNaN(v) ? def : v;
    };
    state.prioConfig = {
        atgardThreshold:    get('prio-cfg-atgard',    PRIO_CONFIG_DEFAULTS.atgardThreshold),
        akutMinN:    Math.max(1, Math.round(get('prio-cfg-akutN', PRIO_CONFIG_DEFAULTS.akutMinN))),
        bevakaThreshold:    get('prio-cfg-bevaka',    PRIO_CONFIG_DEFAULTS.bevakaThreshold),
        analyseraThreshold: get('prio-cfg-analysera', PRIO_CONFIG_DEFAULTS.analyseraThreshold)
    };
    // Visa "anpassad konfiguration"-flagga om något skiljer sig
    const isCustom = JSON.stringify(state.prioConfig) !== JSON.stringify(PRIO_CONFIG_DEFAULTS);
    const flag = document.getElementById('prio-cfg-custom-flag');
    if (flag) flag.style.display = isCustom ? 'inline' : 'none';
    _laNyckel('nyckel-pr-installningar', isCustom ? 'Anpassade värden' : 'Standardvärden', isCustom);
}
['prio-cfg-atgard','prio-cfg-akutN','prio-cfg-bevaka','prio-cfg-analysera'].forEach(id => {
    document.getElementById(id)?.addEventListener('input', () => {
        _readPrioConfigInputs();
        renderPrioritering();
    });
});
document.getElementById('prio-cfg-reset')?.addEventListener('click', () => {
    /** @type {HTMLInputElement} */ (document.getElementById('prio-cfg-atgard')).value    = String(PRIO_CONFIG_DEFAULTS.atgardThreshold);
    /** @type {HTMLInputElement} */ (document.getElementById('prio-cfg-akutN')).value     = String(PRIO_CONFIG_DEFAULTS.akutMinN);
    /** @type {HTMLInputElement} */ (document.getElementById('prio-cfg-bevaka')).value    = String(PRIO_CONFIG_DEFAULTS.bevakaThreshold);
    /** @type {HTMLInputElement} */ (document.getElementById('prio-cfg-analysera')).value = String(PRIO_CONFIG_DEFAULTS.analyseraThreshold);
    _readPrioConfigInputs();
    renderPrioritering();
});

// Viktnings-inputs
function _readPrioWeightsInputs() {
    const get = (id, def) => {
        const el = document.getElementById(id);
        if (!el) return def;
        const v = parseFloat(/** @type {HTMLInputElement} */ (el).value);
        return isNaN(v) ? def : Math.max(0, v);
    };
    state.prioWeights = {
        avvikelse:    get('prio-w-avvikelse',    PRIO_WEIGHTS_DEFAULTS.avvikelse),
        volym:        get('prio-w-volym',        PRIO_WEIGHTS_DEFAULTS.volym),
        jamstalldhet: get('prio-w-jamstalldhet', PRIO_WEIGHTS_DEFAULTS.jamstalldhet)
    };
    const sumEl = document.getElementById('prio-w-sum');
    const sum = state.prioWeights.avvikelse + state.prioWeights.volym + state.prioWeights.jamstalldhet;
    if (sumEl) sumEl.textContent = `Summa: ${sum} (normaliseras till 100% automatiskt)`;
}
['prio-w-avvikelse','prio-w-volym','prio-w-jamstalldhet'].forEach(id => {
    document.getElementById(id)?.addEventListener('input', () => {
        _readPrioWeightsInputs();
        renderPrioritering();
    });
});
document.getElementById('prio-w-reset')?.addEventListener('click', () => {
    /** @type {HTMLInputElement} */ (document.getElementById('prio-w-avvikelse')).value    = String(PRIO_WEIGHTS_DEFAULTS.avvikelse);
    /** @type {HTMLInputElement} */ (document.getElementById('prio-w-volym')).value        = String(PRIO_WEIGHTS_DEFAULTS.volym);
    /** @type {HTMLInputElement} */ (document.getElementById('prio-w-jamstalldhet')).value = String(PRIO_WEIGHTS_DEFAULTS.jamstalldhet);
    _readPrioWeightsInputs();
    renderPrioritering();
});

// Kostnadsberäknings-inputs (månader + PO-påslag)
function _readCostSettings() {
    const monthsEl = document.getElementById('prio-cost-months');
    const poEl     = document.getElementById('prio-po-pct');
    const months   = monthsEl ? parseInt(/** @type {HTMLInputElement} */ (monthsEl).value, 10) || COST_DEFAULTS.months : COST_DEFAULTS.months;
    const poPct    = poEl ? parseFloat(/** @type {HTMLInputElement} */ (poEl).value) : COST_DEFAULTS.poPct;
    state.costSettings = {
        months: Math.max(1, Math.min(60, months)),
        poPct:  Math.max(0, Math.min(100, isNaN(poPct) ? COST_DEFAULTS.poPct : poPct))
    };
    const sum = document.getElementById('prio-cost-summary');
    if (sum) {
        const isCustom = state.costSettings.months !== COST_DEFAULTS.months || Math.abs(state.costSettings.poPct - COST_DEFAULTS.poPct) > 0.01;
        sum.innerHTML = isCustom
            ? `<strong class="farg-varning">${ikon('kugghjul')} Anpassad konfiguration:</strong> ${state.costSettings.months} mån × ${svPct(state.costSettings.poPct, 2)} PO`
            : `Standard: ${state.costSettings.months} mån × ${svPct(state.costSettings.poPct, 2)} PO (SKR:s cirkulär 2025 för kommuner och regioner)`;
    }
}
['prio-cost-months','prio-po-pct'].forEach(id => {
    document.getElementById(id)?.addEventListener('input', () => {
        _readCostSettings();
        renderPrioritering();
    });
    document.getElementById(id)?.addEventListener('change', () => {
        _readCostSettings();
        renderPrioritering();
    });
});
document.getElementById('prio-cost-reset')?.addEventListener('click', () => {
    /** @type {HTMLInputElement} */ (document.getElementById('prio-cost-months')).value = String(COST_DEFAULTS.months);
    /** @type {HTMLInputElement} */ (document.getElementById('prio-po-pct')).value      = String(COST_DEFAULTS.poPct);
    _readCostSettings();
    renderPrioritering();
});
// Initiera period-sammanfattningen vid sidladdning
setTimeout(_readCostSettings, 0);

document.getElementById('btn-export-prio-excel')?.addEventListener('click', () => {
    const table = document.getElementById('prio-table');
    if (table) {
        const wb = tableToCleanBook('prio-table', 'Prioritering');
        if (wb) { _appendMethodSheet(wb); XLSX.writeFile(wb, 'prioriteringslista.xlsx'); _showExportSensitivityToast(); }
    }
});

// ---- Print-to-PDF: komplett rapport ----
// Använder webbläsarens inbyggda "Skriv ut → Spara som PDF". Inga externa beroenden.

// ---- Figurer för diagramkärnan (ADR-39, steg 3) ----
// Kostnadsfördelningen (Pareto) som liggande, sorterade staplar på EN axel — inte staplar och en linje mot var sin
// axel, där höjd och läge läses mot olika skalor. Den
// kumulativa andelen står som text vid varje stapel i stället för som en linje mot en andra axel, och grupperna som
// tillsammans når 80 % av kostnaden är en egen serie.
const PRIO_KOSTNAD_MAX = 15;
/** Meningen under kostnadsdiagrammet: vad de grupper som inte ritas står för. Tom när alla ritas. */
function _prioKostnadNot(alla, totalt) {
    const rest = alla.slice(PRIO_KOSTNAD_MAX);
    if (!rest.length || !(totalt > 0)) return '';
    const summa = rest.reduce((s, i) => s + i.annualGapTotal, 0);
    return `Diagrammet visar de ${PRIO_KOSTNAD_MAX} grupper som kostar mest. Övriga ${rest.length} grupper står tillsammans för ${_figTalformat(Math.round(summa), 'kr')} per år (${svPct(100 * summa / totalt, 0)} av kostnaden) och finns i tabellen nedan.`;
}
function _prioKostnadFigur(allaVisade, allCumPct) {
    // Högst PRIO_KOSTNAD_MAX grupper ritas; resten redovisas som en mening under diagrammet (_prioKostnadNot) — en
    // sammanlagd stapel för dem blir längst av alla och gör de övriga svåra att läsa. Med fyrtio grupper blev
    // diagrammet annars över tusen punkter högt.
    const visade = allaVisade.slice(0, PRIO_KOSTNAD_MAX), cumPct = allCumPct.slice(0, PRIO_KOSTNAD_MAX);
    const namn = (i, n) => `#${n + 1} ${_rfKorta(String(i.yrke), 26)} · ${i.bas}`;
    const y = visade.map(namn), n80 = cumPct.findIndex(p => p >= 80);
    const inom = n => n80 < 0 || n <= n80;
    const mnkr = v => (v >= 1e6 ? `${svTal(v / 1e6, 2)} mnkr` : _figTalformat(Math.round(v), 'kr'));
    const lager = (serie, farg, opacitet, valj) => ({ marke: 'stapel', riktning: 'liggande', lage: 'overlagrad', serie, farg, opacitet,
        data: visade.map((i, n) => ({ i, n })).filter(({ n }) => valj(n)).map(({ i, n }) => ({ y: y[n], x: i.annualGapTotal, yrke: i.yrke, bas: i.bas, kum: cumPct[n],
            etikett: `${mnkr(i.annualGapTotal)} · ${svTal(cumPct[n], 0)} %`, markering: markeringFor(i.bas, i.yrke) })),
        tips: d => [[`${d.yrke} · BAS ${d.bas}`], ['Kostnad', `${_figTalformat(d.x, 'kr')}/år`], ['Kumulativ andel', _figTalformat(d.kum, 'pct')]] });
    return { beskrivning: 'Årskostnad per grupp, störst först, med den kumulativa andelen av totalkostnaden som text. Siffrorna finns i prioriteringstabellen nedan.',
        y: { skala: 'band', ordning: y, etikettMax: 40 }, x: { skala: 'linjar', titel: 'Årskostnad (kr) · procenttalet är kumulativ andel', format: 'kr' },
        hojd: Math.max(170, 90 + visade.length * 28),
        lager: [lager('Når tillsammans 80 % av kostnaden', PALETTE.serie[0], 1, inom), lager('Övriga', PALETTE.serie[0], 0.4, n => !inom(n))].filter(l => l.data.length) };
}

// Matrisen: en punktserie per status (förklaringen kan dölja en status), zoner för tröskelvärdena med namn, och
// gruppens namn som text på punkten enligt valt etikettläge.
function _prioMatrisFigur(items, etikettlage, refLabel, cfg) {
    const kr = v => _figTalformat(Math.round(v), 'kr');
    const pm = (v, dec) => `${v >= 0 ? '+' : '−'}${Math.abs(v).toFixed(dec).replace('.', ',')}`;
    const kostnad = i => Math.max(i.annualGapTotal, i.annualOverTotal);
    const storst = Math.max(1, ...items.map(kostnad));
    const tips = d => [[`#${d.rang} ${d.yrke}`], [`BAS ${d.bas}`, `n = ${d.y} (Kv: ${d.kvN}, Mä: ${d.maN})`], ['Median', kr(d.median)],
        [`Referens (${d.refKalla})`, kr(d.refMedian)], ['Avvikelse', `${pm(d.x, 2)} % (${pm(d.diffKr, 0).slice(0, 1)}${kr(Math.abs(d.diffKr))}/mån)`],
        ...(d.gapPct != null ? [['Lönegap kön', `${pm(d.gapPct, 1)} %`]] : []),
        ...(d.atgard > 0 ? [['Åtgärdskostnad/år', kr(d.atgard)]] : d.over > 0 ? [['Överlönekostnad/år', kr(d.over)]] : []),
        ['Prioriteringsindex', `${svTal(d.index, 0)}/100`]];
    const lager = Object.keys(PRIO_STATUS_INFO).map(status => ({
        marke: 'punkt', serie: PRIO_STATUS_INFO[status].label, farg: PALETTE.prio[status], opacitet: 0.72, kant: FARG.vit, tips,
        data: items.filter(i => i.status === status && isFinite(i.diffPct) && i.n > 0).map(i => {
            const etikett = _makePrioLabel(i, i.rank, etikettlage);
            return { x: +i.diffPct.toFixed(2), y: i.n, storlek: Math.max(4, 16 * Math.sqrt(Math.max(kostnad(i), storst * 0.02) / storst)),
                     ...(etikett ? { etikett } : {}), rang: i.rank, yrke: i.yrke, bas: i.bas, kvN: i.kvN, maN: i.maN, median: i.median,
                     refKalla: i.refSource, refMedian: i.refMedian, diffKr: i.diffKr, gapPct: i.gapPct, atgard: i.annualGapTotal, over: i.annualOverTotal,
                     index: i.priorityIndex, markering: markeringFor(i.bas, i.yrke) };
        })
    })).filter(l => l.data.length);
    // X-axeln rymmer både datat och tröskelzonerna, med luft; noll är alltid med.
    const tAt = cfg.atgardThreshold, tBe = cfg.bevakaThreshold, tAn = cfg.analyseraThreshold;
    const diff = items.map(i => i.diffPct).filter(v => isFinite(v));
    const dMin = diff.length ? Math.min(...diff) : tAt - 5, dMax = diff.length ? Math.max(...diff) : tAn + 5;
    const spann = dMax - dMin, luft = Math.max(2, spann * 0.08);
    const xMin = Math.min(dMin - luft, tAt - Math.max(3, spann * 0.05), -1), xMax = Math.max(dMax + luft, tAn + Math.max(3, spann * 0.05), 1);
    const antal = items.map(i => i.n).filter(v => v > 0), stor = antal.length > 1 && Math.max(...antal) / Math.min(...antal) > 10;
    const zon = (x0, x1, farg, etikett, textfarg) => ({ typ: 'zon', x0, x1, farg, opacitet: 0.07, etikett, textfarg });
    return { beskrivning: 'Prioriteringsmatris: varje grupps avvikelse mot referensen mot gruppens storlek, med kostnaden som bubblans storlek. Samma grupper listas i tabellen nedan.',
        x: { skala: 'linjar', titel: `Avvikelse mot ${refLabel} (%)`, doman: [xMin, xMax], nollinje: true },
        // Logskala bara när grupperna skiljer sig med mer än en tiopotens; annars är en vanlig axel lättare att läsa.
        y: stor ? { skala: 'log', titel: 'Antal personer i gruppen (log skala)' } : { skala: 'linjar', titel: 'Antal personer i gruppen' },
        // Zonerna heter som statusarna i tabellen och förklaringen under den («Börja här» är de största grupperna i den första zonen).
        referens: [zon(xMin, tAt, PALETTE.prio.akut, PRIO_STATUS_INFO.atgard.label.toUpperCase(), FARG.granska), zon(tAt, tBe, PALETTE.semantic.varning, PRIO_STATUS_INFO.bevaka.label.toUpperCase(), FARG.varning),
                   zon(tBe, tAn, PALETTE.semantic.ok, PRIO_STATUS_INFO.ok.label.toUpperCase(), FARG.ok), zon(tAn, xMax, PALETTE.prio.analysera, PRIO_STATUS_INFO.analysera.label.toUpperCase(), FARG.infoMork)].filter(z => z.x1 > z.x0),
        lager };
}

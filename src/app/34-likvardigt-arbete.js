// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
// § 3:10 — Likvärdigt arbete (likvärdighetsanalys)
// ============================================================
// Beräkning och rendering av kandidatpar enligt DiskrL 3:10: kvinnodominerade
// yrken jämförs mot icke-kvinnodominerade yrken inom samma BAS-intervall
// (arbetsvärderingsnivå), internt i organisationen i första hand och mot
// jämförelsestatistiken som fallback. Inkluderar bootstrap-KI på medianskillnaden,
// diagrammet över kandidatparen och Excel-/CSV-export.
//
// Algoritmen bor i src/lib/likvardighet.js och speglas in i bygget som alla andra
// kärnmoduler (ADR-8). Det som ligger här är state-adaptern och allt som rör
// UI: rendering, pardiagram och export. Att adaptern verkligen delegerar vaktas
// av tests/drift.test.js.
/**
 * Likvärdighetsparen för nuvarande data och inställningar: det sparade resultatet om det
 * finns, annars räknas de och sparas. Allt som bara LÄSER paren går via denna, så att
 * de räknas en gång (varje ändring av data eller inställningar nollställer resultatet).
 * @returns {any}
 */
// SKR:s kvinnoandel för AID-etiketten (efter organisationstypen) — referens bredvid organisationens egen.
function _lvSkrPct(aid) {
    const ref = _skrKvinnoandel(aid, { del: _skrDel() });
    return ref ? `${svPct(ref.pct, 1)}` : '–';
}
function _lvSkrKort(aid) {
    const ref = _skrKvinnoandel(aid, { del: _skrDel() });
    return ref ? ` (nationellt ${svPct(ref.pct, 0)})` : '';
}

// Åldersjusteringens krav (speglar ALDERS_GOLV_DEFAULT och ALDERS_SPRIDNING_MIN i src/lib/likvardighet.js).
const ALDERS_GOLV = 10, ALDERS_SPRIDNING = 5;
function _lvAlderText(v) { return typeof v === 'number' && isFinite(v) ? svTal(v, 0) : '–'; }
/** Varför ett par saknar åldersjusterad skillnad — verktygstipset bakom strecket. */
function _lvJusteradSaknasText(p) {
    if (p.jamforKalla !== 'intern') return 'Ingen åldersjustering: jämförelseyrket kommer från jämförelsestatistiken och saknar individdata.';
    return `Ingen åldersjustering: jämförelseyrket har färre än ${ALDERS_GOLV} personer med ålder eller mindre än ${ALDERS_SPRIDNING} års åldersspridning, eller åldrar saknas i underlaget.`;
}

function likvardighetResultat() {
    if (state.likvardighet && state.likvardighet.result) return state.likvardighet.result;
    const lv = computeLikvardighetPairs();
    if (state.likvardighet) state.likvardighet.result = lv;
    return lv;
}

/**
 * § 3:10-analys — state-adapter runt src/lib/likvardighet.js.
 *
 * Algoritmen finns bara i lib, som speglas som alla andra kärnmoduler (ADR-8);
 * den här funktionen gör bara tre saker:
 * läser `state`, anropar `_lvComputePairs`, och fyller på med den UI-diagnostik
 * som lib inte känner till (exempelrader, lokal könsdata, felsträngar).
 *
 * KÄRNPRINCIP: transparens. Funktionen returnerar ALLTID ett strukturerat
 * resultat (aldrig null), även när en datakälla saknas.
 *
 * Egenskaper:
 *   - Ingen k-anonymitet (aggregat per yrkesgrupp; uttryckligt designbeslut)
 *   - Bootstrap-KI i kronor på medianskillnaden för VARJE par, seedat ur
 *     parets egna löner så att KI:t går att återskapa
 *   - Arbetsvärderingspoäng som krav-proxy när tabell finns, annars BAS-rank
 *
 * @returns {any} alltid ett objekt — aldrig null
 */
function computeLikvardighetPairs() {
    const cfg = state.likvardighet || {};
    const kvinnoThr = cfg.kvinnoTrosholdPct ?? 60;
    const av = state.arbetsvardering;
    const usePoang = !!(av && av.byKey && av.byKey.size > 0);

    const opts = {
        kvinnoTrosholdPct: kvinnoThr,
        minGapPct: cfg.minGapPct ?? 0,     // default 0 (visa alla med jämförelseyrket högre)
        topN: cfg.topN ?? 100,
        k: kInstalld()                     // bara för att räkna små grupper i diagnostiken (undantaget gäller exporten); analysen maskar inte
    };
    if (usePoang) {
        opts.poangByKey = av.byKey;
        opts.poangBandPct = cfg.poangBandPct ?? 5;
    }

    let res, fel = [];
    try {
        res = _lvComputePairs({
            data: state.data || [],
            statistik: state.statistik || [],
            scbKlass: nationellAidKlass,
            opts
        });
    } catch (e) {
        // Ingen early return: UI:t ska kunna visa vad som gick fel i stället för
        // en tom flik.
        fel = [`Likvärdighetsanalysen kunde inte köras: ${e.message}`];
        res = {
            orgKvDom: [], orgIckeKv: [], statIckeKv: [], pairs: [], lagreKrav: [],
            diagnostik: {
                organisation: { totalRader: (state.data || []).length, antalAidxBas: 0,
                    kvDomFunna: 0, kvDomMedNLessThanK: 0, ickeKvFunna: 0 },
                statistik: { totalRader: (state.statistik || []).length,
                    klass: { kvDom: 0, blandat: 0, ickeKv: 0, oklassificerad: 0 },
                    klassKalla: { lokal: 0, scb: 0 } },
                jämförelse: { gemensammaBas: 0, möjligaPar: 0, statHögre: 0, statLägreEllerLika: 0,
                    internaPar: 0, externaPar: 0, basMedExternFallback: 0,
                    kravProxy: usePoang ? 'poäng' : 'bas', kvUtanPoang: 0 },
                fel: []
            },
            opts: { ...opts }
        };
    }

    // Diagnostik som bara UI:t behöver och som lib därför inte producerar.
    const d = res.diagnostik;
    d.organisation.exempelKvDom = res.orgKvDom.slice(0, 3)
        .map(g => `${g.aid} (${g.label}) BAS ${g.bas} n=${g.n}`);
    d.statistik.harLokalKonsdata = !!state.statistikHasKon;
    d.statistik.exempelIckeKv = res.statIckeKv.slice(0, 3)
        .map(g => `${g.aid} (${g.label}) BAS ${g.bas} ${svPct(g.kvAndel, 0)}kv`);
    d.fel = fel;
    if (usePoang) res.opts.poangBandPct = opts.poangBandPct;

    return res;
}

// Lägre krav, högre lön (ADR-25) — par över BAS-gränserna.
function _lagreKravHtml(result) {
    const poang = result.diagnostik?.jämförelse?.kravProxy === 'poäng';
    const par = result.lagreKrav || [];
    const fmt = new Intl.NumberFormat('sv-SE', { maximumFractionDigits: 0 });
    const pct = v => new Intl.NumberFormat('sv-SE', { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(v);
    let innehall;
    if (poang) innehall = '<p>Med arbetsvärderingspoäng jämförs yrken redan över BAS-gränserna i kandidatparen ovan.</p>';
    else if (!par.length) innehall = '<p>Inget kvinnodominerat yrke har lägre medianlön än ett yrke i lägre BAS.</p>';
    else innehall = `<div class="rulla-x"><table id="likvardighet-lagre-krav-table" class="data-table"><thead><tr>
            <th>Kvinnodominerat yrke</th><th>BAS</th><th>Median</th><th>Jämförelseyrke</th><th>BAS</th><th>Median</th>
            <th>BAS-steg</th><th>Skillnad (kr)</th><th>Skillnad (%)</th><th>95 % KI</th></tr></thead><tbody>${par.map(p => `<tr>
            <td>${esc(p.kvLabel)}</td><td>${esc(p.kvBas)}</td><td data-sort-value="${p.kvMedian}">${fmt.format(p.kvMedian)}</td>
            <td>${esc(p.maLabel)}</td><td>${esc(p.maBas)}</td><td data-sort-value="${p.maMedian}">${fmt.format(p.maMedian)}</td>
            <td>${p.basSteg}</td><td data-sort-value="${p.gapKr}">${fmt.format(p.gapKr)}</td><td data-sort-value="${p.gapPct}">${pct(p.gapPct)} %</td>
            <td>${p.gapCI ? `${fmt.format(p.gapCI.lo)}–${fmt.format(p.gapCI.hi)} kr` : '–'}</td></tr>`).join('')}</tbody></table></div>`;
    return `<section id="likvardighet-lagre-krav" class="card marg-t-18">
        <h3 class="fs-lg">Lägre krav, högre lön</h3>
        <p class="text-dampad-sm">Kvinnodominerade yrken som har lägre medianlön än ett av organisationens yrken i lägre BAS. BAS används som mått på krav och är grovt — pröva mot befattningsbeskrivningarna.</p>
        ${innehall}</section>`;
}

/**
 * Renderar § 3:10-flikens UI.
 *
 * Alltid-synliga steg:
 *   1. Diagnostik — vad parsern fann
 *   2. Organisationens kvinnodominerade yrken
 *   3. Jämförelseyrken: organisationens egna icke-kv-dom yrken (primärt) +
 *      jämförelsestatistiken (fallback per BAS)
 *   4. Jämförelse (huvudtabellen) med bootstrap-CI på medianskillnaden
 *
 * Felsökningsvy gömd bakom dev-flagga (window.__LV_DEBUG__).
 */
function renderLikvardighet() {
    const wrap = document.getElementById('likvardighet-content');
    if (!wrap) return;

    const cfg = state.likvardighet;
    const hasData = state.data.length > 0;
    const hasStat = state.statistik.length > 0;

    if (!hasData && !hasStat) {
        _lvRitaTopp(null);
        wrap.innerHTML = `
            <div class="insight-box warn pad-18">
                <strong>${ikon('statusVarning')} Inga datafiler uppladdade</strong>
                <p class="fs-md lh-1_55 marg-8-0">
                    Ladda upp <strong>strukturdata för organisationen</strong> (CSV) och
                    <strong>jämförelsestatistik</strong> (Excel) på Översikt för att aktivera analysen.
                </p>
            </div>`;
        return;
    }

    let result;
    try {
        result = computeLikvardighetPairs();
        state.likvardighet.result = result;
    } catch (e) {
        _lvRitaTopp(null);
        wrap.innerHTML = `
            <div class="insight-box warn pad-18">
                <strong>${ikon('statusKritisk')} Internt fel vid beräkning</strong>
                <p class="typsnitt-mono-ui fs-sm marg-8-0">${esc(e.message)}</p>
                <p class="fs-sm marg-8-0">Rapportera felet — funktionen ska aldrig kasta undantag. Ladda om sidan och försök igen.</p>
            </div>`;
        return;
    }

    const fmtKr = v => v == null ? '–' : Math.round(v).toLocaleString('sv-SE') + ' kr';

    const d = result.diagnostik;

    // ====== Sektion 0: Felmeddelanden ======
    let felHtml = '';
    if (d.fel.length) {
        felHtml = `
            <div class="insight-box warn mb-14">
                <strong>${ikon('statusKritisk')} Fel under beräkning</strong>
                <ul class="marg-6-0-0 pad-v-22">
                    ${d.fel.map(f => `<li>${esc(f)}</li>`).join('')}
                </ul>
            </div>`;
    }

    // ====== Sektion 1: Intro + diagnostik ======
    const orgOK = hasData && d.organisation.kvDomFunna > 0;
    const internOK = d.organisation.ickeKvFunna > 0;
    const statOK  = hasStat && d.statistik.klass.ickeKv > 0;
    // Jämförelsen kan genomföras så snart organisationen har kvinnodom.
    // yrken OCH minst en jämförelsekälla (interna icke-kv yrken eller jämförelsestatistiken).
    const jämförOK = orgOK && (internOK || statOK);

    const introHtml = `
        <div class="insight-box info lv-hjalp ram-v-4-accent marg-b-14">
            <strong>${ikon('info')} Så här fungerar likvärdighetsanalysen</strong>
            <p class="fs-md lh-1_55 marg-8-0">
                Lagen kräver att kvinnodominerade yrken jämförs med icke-kvinnodominerade yrken
                som har <em>likvärdiga eller lägre krav</em>. Likvärdighetsanalysen är en
                <strong>inom-arbetsgivare-analys</strong> — därför jämförs i första hand
                organisationens egna yrken med varandra.
            </p>
            ${d.jämförelse.kravProxy === 'poäng'
                ? `<p class="bak-ok-bg ram-v-4-ok rund-4 fs-sm marg-8-0 pad-8-12">
                       <strong>Krav-proxy: arbetsvärdering (poäng)</strong> — yrken paras på likvärdiga eller lägre krav enligt er uppladdade poängtabell, ekvivalensband ±${result.opts.poangBandPct ?? 5} %.${d.jämförelse.kvUtanPoang ? ` <span class="varning-pa-yta">${d.jämförelse.kvUtanPoang} kvinnodominerade yrken saknar poäng och uteslöts.</span>` : ''}</p>`
                : `<p class="bak-accent-yta ram-v-4-accent rund-4 fs-sm marg-8-0 pad-8-12">
                       <strong>Krav-proxy: BAS-rank</strong> — yrken inom samma BAS-intervall antas ha likvärdiga krav. Har ni en egen arbetsvärdering kan ni ladda upp en poängtabell ovan för en juridiskt starkare jämförelse.</p>`}
            <ul class="fs-sm lh-1_6 marg-8-0 pad-v-22">
                <li><strong>Steg 1</strong>: Identifiera <em>organisationens kvinnodominerade</em>
                    AID×BAS-grupper (≥ ${cfg.kvinnoTrosholdPct} % kvinnor).
                    K-anonymitet tillämpas <strong>inte</strong> i denna analys eftersom
                    resultatet är aggregerat per yrkesgrupp.</li>
                <li><strong>Steg 2</strong>: Välj jämförelseyrken inom samma BAS-intervall
                    (likvärdiga krav). <strong>Primärt</strong> används organisationens egna
                    icke-kvinnodominerade yrken (≤ ${100 - cfg.kvinnoTrosholdPct} % kvinnor)
                    — en äkta inom-arbetsgivare-jämförelse. Saknas internt jämförelseyrke i
                    en viss BAS används <em>jämförelsestatistiken</em> som extern proxy
                    ${d.statistik.harLokalKonsdata
                        ? `<span class="farg-ok">(lokal könsfördelning).</span>`
                        : `<span class="varning-pa-yta">(könsfördelningen hämtas då ur den nationella statistiken: andel kvinnor per AID-kod i ${_skrDelText(_skrDel())}, ${esc(skrKallaKort())}).</span>`}</li>
                <li><strong>Steg 3</strong>: Flagga par där jämförelseyrkets median är högre
                    än det kvinnodominerade yrkets. Varje par får ett
                    <strong>bootstrap-95 %-konfidensintervall</strong> på medianskillnaden.
                    Den råa skillnaden är det lagen prövar — lönenivån som sådan; kolumnen
                    <em>Justerad för ålder</em> visar bredvid hur mycket av skillnaden som kan bero på
                    åldersstruktur (jämförelseyrkets lön omräknad till det kvinnodominerade yrkets
                    åldersfördelning; bara för interna par med minst ${ALDERS_GOLV} personer och
                    ${ALDERS_SPRIDNING} års åldersspridning i jämförelseyrket).</li>
            </ul>
        </div>`;

    const diagnostikHtml = `
        <div class="card marg-b-14 pad-14">
            <h3 class="fs-lg marg-0-0-10">Diagnostik — vad verktyget ser</h3>
            <div class="rutnat fs-sm gap-14 kolumner-2-lika">
                <div class="rund-6 pad-12 ${orgOK ? 'ruta-ok' : 'ruta-varning'}">
                    <strong>Organisationens data</strong>
                    <ul class="lh-1_6 marg-6-0-0 pad-v-18">
                        <li>Totalt inlästa rader: <strong>${d.organisation.totalRader.toLocaleString('sv-SE')}</strong></li>
                        <li>Unika AID×BAS-grupper: <strong>${d.organisation.antalAidxBas}</strong></li>
                        <li>Kvinnodominerade (≥ ${cfg.kvinnoTrosholdPct} % kvinnor): <strong>${d.organisation.kvDomFunna}</strong></li>
                        <li>Interna jämförelseyrken (≤ ${100 - cfg.kvinnoTrosholdPct} % kvinnor): <strong class="farg-ok">${d.organisation.ickeKvFunna}</strong> <small class="f-dampad">(primär jämförelsekälla)</small></li>
                        ${d.organisation.kvDomMedNLessThanK > 0
                            ? `<li><span class="f-dampad">•varav ${d.organisation.kvDomMedNLessThanK} grupp${d.organisation.kvDomMedNLessThanK === 1 ? '' : 'er'} med n &lt; ${kTroskel()} (inkluderade ändå — ingen k-mask i denna analys)</span></li>`
                            : ''}
                        ${d.organisation.exempelKvDom.length
                            ? `<li class="marg-t-4"><small class="f-dampad">Topp 3: ${d.organisation.exempelKvDom.map(esc).join(' · ')}</small></li>`
                            : ''}
                    </ul>
                </div>
                <div class="rund-6 pad-12 ${statOK ? 'ruta-ok' : 'ruta-varning'}">
                    <strong>jämförelsestatistiken</strong>
                    <ul class="lh-1_6 marg-6-0-0 pad-v-18">
                        <li>Totalt inlästa rader: <strong>${d.statistik.totalRader.toLocaleString('sv-SE')}</strong></li>
                        <li>Lokal könsdata: <strong>${d.statistik.harLokalKonsdata ? 'ja' : `nej — nationell könsfördelning ur ${esc(skrKallaKort())} som reserv`}</strong></li>
                        <li>Klassificering:
                            <strong class="farg-ok">${d.statistik.klass.ickeKv} icke-kv-dom</strong>,
                            ${d.statistik.klass.kvDom} kv-dom,
                            ${d.statistik.klass.blandat} blandat,
                            ${d.statistik.klass.oklassificerad} oklassificerade</li>
                        <li>Källa: ${d.statistik.klassKalla.lokal} lokal, ${d.statistik.klassKalla.scb} nationell statistik (SKR)</li>
                        ${d.statistik.exempelIckeKv.length
                            ? `<li class="marg-t-4"><small class="f-dampad">Exempel icke-kv-dom: ${d.statistik.exempelIckeKv.map(esc).join(' · ')}</small></li>`
                            : ''}
                    </ul>
                </div>
            </div>
            ${jämförOK ? `
                <div class="bak-accent-yta ram-v-3-accent rund-4 fs-sm marg-t-10 pad-10-12">
                    <strong>Jämförelse</strong>:
                    ${d.jämförelse.gemensammaBas} gemensamma BAS-intervall,
                    ${d.jämförelse.möjligaPar} möjliga par,
                    varav <strong>${d.jämförelse.statHögre} där jämförelseyrkets median är högre</strong> än det kvinnodominerade yrkets
                    (${d.jämförelse.statLägreEllerLika} där jämförelseyrket ≤ organisation — visas ej, inget problem med likvärdigt arbete).
                    <br><span class="f-dampad">Flaggade par: <strong>${d.jämförelse.internaPar}</strong> interna (organisation mot organisation),
                    <strong>${d.jämförelse.externaPar}</strong> externa (mot jämförelsestatistiken)${d.jämförelse.basMedExternFallback > 0 ? ` — ${d.jämförelse.basMedExternFallback} BAS saknade internt jämförelseyrke och föll tillbaka på jämförelsestatistiken` : ''}.</span>
                </div>` : ''}
        </div>`;

    // ====== Sektion 2: Organisationens kv-dom yrken ======
    const orgTblRows = result.orgKvDom.map((g, i) => `
        <tr>
            <td>${i + 1}</td>
            <td><strong>${esc(g.aid)}</strong>${g.label && g.label !== g.aid ? ' ' + esc(g.label) : ''}</td>
            <td>${esc(g.bas)}</td>
            <td class="t-hoger">${g.n}</td>
            <td class="t-hoger">${svPct(g.kvinnoPct, 1)}</td>
            <td class="farg-dampad ta-hoger">${_lvSkrPct(g.aid)}</td>
            <td class="t-hoger">${fmtKr(g.median)}</td>
        </tr>`).join('');
    const orgTblHtml = `
        <details class="mb-14" open>
            <summary class="bak-upphojd rund-6 pekare fw-600 pad-10-14">
                Steg 1 — Organisationens kvinnodominerade yrken (${result.orgKvDom.length} st)
            </summary>
            <div class="pad-10-0">
                ${result.orgKvDom.length
                    ? `<div class="table-responsive"><table class="data-table st-088">
                        <thead><tr><th>#</th><th>AID / Yrke</th><th>BAS</th><th class="t-hoger">Antal</th><th class="t-hoger">% kvinnor</th><th class="t-hoger" title="Andel kvinnor i yrket enligt SKR:s personalstatistik (kommuner, regioner eller båda efter organisationstypen) — ett referensvärde">% kvinnor, SKR</th><th class="t-hoger">Medianlön</th></tr></thead>
                        <tbody>${orgTblRows}</tbody>
                    </table></div>`
                    : `<p class="farg-dampad pad-14">Inga kvinnodominerade AID×BAS-grupper hittades i organisationens data. Kontrollera att <strong>Kön</strong>-kolumnen är korrekt mappad och att kvinnotröskeln (${cfg.kvinnoTrosholdPct} %) inte är för hög.</p>`}
            </div>
        </details>`;

    // ====== Sektion 2a: Organisationens interna jämförelseyrken (primärt) ======
    const internTblRows = result.orgIckeKv.map((g, i) => `
        <tr>
            <td>${i + 1}</td>
            <td><strong>${esc(g.aid)}</strong>${g.label && g.label !== g.aid ? ' ' + esc(g.label) : ''}</td>
            <td>${esc(g.bas)}</td>
            <td class="t-hoger">${g.n}</td>
            <td class="t-hoger">${svPct(g.kvinnoPct, 1)}</td>
            <td class="farg-dampad ta-hoger">${_lvSkrPct(g.aid)}</td>
            <td class="t-hoger">${fmtKr(g.median)}</td>
        </tr>`).join('');
    const internTblHtml = `
        <details class="mb-14" open>
            <summary class="bak-upphojd rund-6 pekare fw-600 pad-10-14">
                Steg 2a — Organisationens interna jämförelseyrken (${result.orgIckeKv.length} st) <small class="farg-dampad fw-400">— primär jämförelsekälla</small>
            </summary>
            <div class="pad-10-0">
                ${result.orgIckeKv.length
                    ? `<div class="table-responsive"><table class="data-table st-088">
                        <thead><tr><th>#</th><th>AID / Yrke</th><th>BAS</th><th class="t-hoger">Antal</th><th class="t-hoger">% kvinnor</th><th class="t-hoger" title="Andel kvinnor i yrket enligt SKR:s personalstatistik (kommuner, regioner eller båda efter organisationstypen) — ett referensvärde">% kvinnor, SKR</th><th class="t-hoger">Medianlön</th></tr></thead>
                        <tbody>${internTblRows}</tbody>
                    </table></div>`
                    : `<p class="farg-dampad pad-14">Organisationen har inga icke-kvinnodominerade yrken (≤ ${100 - cfg.kvinnoTrosholdPct} % kvinnor). Jämförelsen faller då tillbaka på jämförelsestatistiken (Steg 2b).</p>`}
            </div>
        </details>`;

    // ====== Sektion 2b: jämförelsestatistikens icke-kv-dom yrken (fallback) ======
    const statTblRows = result.statIckeKv.map((g, i) => `
        <tr>
            <td>${i + 1}</td>
            <td><strong>${esc(g.aid)}</strong>${g.label && g.label !== g.aid ? ' ' + esc(g.label) : ''}</td>
            <td>${esc(g.bas)}</td>
            <td class="t-hoger">${svPct(g.kvAndel, 1)}</td>
            <td class="t-mitt"><span class="rund-8 fs-xs pad-1-6 ${g.källa === 'lokal' ? 'bricka-ok' : 'bricka-varning'}">${g.källa === 'lokal' ? 'Statistiken' : 'SKR'}</span></td>
            <td class="t-hoger">${fmtKr(g.median)}</td>
            <td class="farg-dampad ta-hoger">${g.nKv != null ? `${g.nKv}/${g.nMa}` : '—'}</td>
        </tr>`).join('');
    const statTblHtml = `
        <details class="mb-14" open>
            <summary class="bak-upphojd rund-6 pekare fw-600 pad-10-14">
                Steg 2b — jämförelsestatistikens icke-kvinnodominerade yrken (${result.statIckeKv.length} st) <small class="farg-dampad fw-400">— extern fallback per BAS</small>
            </summary>
            <div class="pad-10-0">
                ${result.statIckeKv.length
                    ? `<div class="table-responsive"><table class="data-table st-088">
                        <thead><tr><th>#</th><th>AID / Yrke</th><th>BAS</th><th class="t-hoger">% kvinnor</th><th class="t-mitt">Källa</th><th class="t-hoger">Medianlön</th><th class="t-hoger" title="Antal kvinnor / män i jämförelsestatistiken (om den har könsfördelning)">Kv/Mä</th></tr></thead>
                        <tbody>${statTblRows}</tbody>
                    </table></div>`
                    : `<p class="farg-dampad pad-14">${d.statistik.totalRader === 0
                        ? 'Ingen jämförelsestatistik inläst (valfri). Med en inläst används dess yrken där ett eget jämförelseyrke saknas — läs in den på <a href="#" data-go-to-tab="dashboard">Översikt</a>.'
                        : 'Inga icke-kvinnodominerade AID×BAS-grupper hittades i jämförelsestatistiken: alla AID-koder klassificerades som kvinnodominerade eller blandade.'}</p>`}
            </div>
        </details>`;

    // ====== Sektion 4: § 3:10-kandidatpar (huvudtabellen) ======
    const källBadge = p => {
        if (p.jamforKalla === 'intern') return `<span class="bak-ok-bg rund-8 farg-ok fs-0_72rem pad-1-6" title="Organisationens eget yrke (inom-arbetsgivare-jämförelse)">intern</span>`;
        if (p.maKlassKort === 'lokal') return `<span class="bak-varning-bg rund-8 farg-varning fs-0_72rem pad-1-6" title="jämförelsestatistiken, egen könsfördelning">Statistiken</span>`;
        return `<span class="bak-varning-bg rund-8 farg-varning fs-0_72rem pad-1-6" title="jämförelsestatistiken; könsfördelningen ur den nationella statistiken (${esc(skrKallaKort())})">nationell</span>`;
    };
    const ciCell = p => {
        if (!p.gapCI || p.gapCI.lo == null) return '<span class="f-dampad" title="För få observationer för bootstrap">—</span>';
        const säker = p.gapCI.lo > 0;
        // Intervallet på en rad («4 365–7 635 kr») med omdömet som ett märke under; exporten bär formen med klamrar.
        const tal = v => Math.round(v).toLocaleString('sv-SE');
        return `<span class="lv-ki" title="95 % bootstrap-konfidensintervall på medianskillnaden" data-export-text="[${fmtKr(p.gapCI.lo)}, ${fmtKr(p.gapCI.hi)}]">${tal(p.gapCI.lo)}–${tal(p.gapCI.hi)} kr</span><br><span class="lv-ki-marke ${säker ? 'bricka-ok' : 'bricka-varning'}">${säker ? 'säker skillnad' : 'inom slumpfel'}</span>`;
    };
    const justCell = p => {
        const j = p.aldersJusterad;
        if (!j || !isFinite(j.gapPct)) return `<span class="f-dampad" title="${esc(_lvJusteradSaknasText(p))}">—</span>`;
        return `<span title="Jämförelseyrkets median omräknad till det kvinnodominerade yrkets åldersfördelning: ${fmtKr(j.medianJusterad)} — skillnad ${fmtKr(j.gapKr)}. Medelålder ${_lvAlderText(p.kvMedelAlder)} mot ${_lvAlderText(p.maMedelAlder)} år.">${svPct(j.gapPct, 1)}</span>`;
    };
    const parRows = result.pairs.map((p, i) => `
        <tr>
            <td>${i + 1}</td>
            <td><strong>${esc(p.kvAid)}</strong>${p.kvLabel && p.kvLabel !== p.kvAid ? ' ' + esc(p.kvLabel) : ''}<br><small class="f-dampad lv-under"${_lvSkrKort(p.kvAid) ? ` title="Andel kvinnor i yrket nationellt (${esc(skrKallaKort())}):${esc(_lvSkrKort(p.kvAid).replace(/[()]|SKR/g, ''))}"` : ''}>BAS ${esc(p.kvBas)} · ${svPct(p.kvKvinnoPct, 0)} kv<span class="bara-export">${_lvSkrKort(p.kvAid)}</span> · n=${p.kvN}</small></td>
            <td class="t-hoger">${fmtKr(p.kvMedian)}</td>
            <td><strong>${esc(p.maAid)}</strong>${p.maLabel && p.maLabel !== p.maAid ? ' ' + esc(p.maLabel) : ''}<br><small class="f-dampad lv-under">BAS ${esc(p.maBas)} · ${svPct(p.maKvAndel, 0)} kv ${källBadge(p)}${p.maN != null ? ` · n=${p.maN}` : ''}</small></td>
            <td class="t-hoger">${fmtKr(p.maMedian)}</td>
            <td class="t-hoger"><strong>${fmtKr(p.gapKr)}</strong></td>
            <td class="t-hoger"><strong>${svPct(p.gapPct, 1)}</strong></td>
            <td class="t-hoger">${justCell(p)}</td>
            <td class="lv-ki-cell fs-xs ta-hoger">${ciCell(p)}</td>
            <td class="t-hoger">${Math.round(p.allvarsindex).toLocaleString('sv-SE')}</td>
            <td class="t-mitt"><button class="btn-evidence" data-lv-pair="${i}" type="button" title="Visa beräkningen" aria-label="Bevis för par ${i+1}">${ikon('sok')}</button></td>
        </tr>`).join('');
    let parTblHtml;
    if (!jämförOK) {
        parTblHtml = `
            <div class="insight-box warn mb-14">
                <strong>${ikon('statusVarning')} Jämförelsen kan inte genomföras</strong>
                <p class="fs-md lh-1_55 marg-8-0">
                    Analysen kräver kvinnodominerade yrken <em>och</em> minst en jämförelsekälla:
                    ${!orgOK ? '<br>• <strong>Organisationen saknar kvinnodominerade grupper.</strong> Se Steg 1 ovan.' : ''}
                    ${(orgOK && !internOK && !statOK) ? '<br>• <strong>Inga jämförelseyrken finns</strong> — varken interna icke-kvinnodominerade yrken (Steg 2a) eller jämförelsestatistiken (Steg 2b).' : ''}
                </p>
            </div>`;
    } else if (!result.pairs.length) {
        parTblHtml = `
            <div class="insight-box info mb-14">
                <strong>${ikon('info')} Inga kandidatpar hittades</strong>
                <p class="fs-md marg-8-0">
                    Organisationen har ${result.orgKvDom.length} kvinnodominerade grupper och
                    ${result.orgIckeKv.length} interna + ${result.statIckeKv.length} externa jämförelseyrken — men
                    inom de ${d.jämförelse.gemensammaBas} gemensamma BAS-intervallen är inget
                    jämförelseyrke högre avlönat än organisationens kvinnodominerade yrken.
                    ${cfg.minGapPct > 0 ? `(Min gap-tröskeln är satt till ${cfg.minGapPct} %.)` : ''}
                </p>
            </div>`;
    } else {
        parTblHtml = `
            <div class="table-responsive">
                <table id="likvardighet-table" class="data-table">
                    <thead>
                        <tr>
                            <th>#</th>
                            <th title="Kvinnodominerat yrke i organisationen (faktisk könsfördelning).">Kvinnodom. yrke (${esc(orgNamn('org.'))})</th>
                            <th title="Median månadslön i organisationens grupp.">Median ${esc(orgNamn('org.'))}</th>
                            <th title="Jämförelseyrke: organisationens eget icke-kv-dom yrke (intern) eller jämförelsestatistiken (extern fallback).">Jämförelseyrke</th>
                            <th title="Median månadslön i jämförelseyrket.">Median jämf.</th>
                            <th title="Skillnad i kronor (jämförelseyrke − organisation).">Gap (kr)</th>
                            <th title="Skillnad i procent av organisationens median.">Gap (%)</th>
                            <th title="Skillnaden när jämförelseyrkets lön räknats om till det kvinnodominerade yrkets åldersfördelning (log(lön) ~ ålder i jämförelseyrket). Den råa skillnaden är det lagen prövar; den här visar hur mycket som kan bero på åldersstruktur. Bara interna par." data-export-label="Justerad för ålder (%)">Justerad för ålder</th>
                            <th title="95 % bootstrap-konfidensintervall på medianskillnaden. Ligger hela intervallet över 0 är skillnaden statistiskt säker.">95 % KI</th>
                            <th title="Påverkansindex = |gap kr| × antal medarbetare i det kvinnodominerade yrket. Heuristik för att prioritera de par som rör flest individer och störst lönegap — inte ett lagstadgat mått." data-export-label="Påverkan">Påverkan (kr/mån)</th>
                            <th>Bevis</th>
                        </tr>
                    </thead>
                    <tbody>${parRows}</tbody>
                </table>
            </div>`;
    }

    // ====== Felsökningsvy (B4: endast bakom dev-flagga window.__LV_DEBUG__) ======
    let debugHtml = '';
    if (typeof window !== 'undefined' && window.__LV_DEBUG__) {
        const debugStat = state.statistik.slice(0, 3).map(s => JSON.stringify({
            aid: s.aid, bas: s.bas, median: s.median,
            nKv: s.nKv, nMa: s.nMa, andelKv: s.andelKv,
            aidFull: (s.aidFull || '').slice(0, 40)
        }));
        const debugData = state.data.slice(0, 3).map(r => JSON.stringify({
            aid: r.aid, bas: r.bas, kon: r.kon, lon: r.lon, yrkeLabel: (r.yrkeLabel||'').slice(0,30)
        }));
        debugHtml = `
            <details class="marg-t-16" open>
                <summary class="text-dampad-sm pekare">Felsökningsdata (dev-läge)</summary>
                <div class="bak-yta ram-1-kant rund-4 typsnitt-mono-ui fs-xs lh-1_5 marg-t-8 rulla-x pad-10">
                    <strong>state.statistikHasKon:</strong> ${state.statistikHasKon}<br>
                    <strong>state.statistik (3 första):</strong><br>
                    ${debugStat.length ? debugStat.map(s => '  ' + esc(s)).join('<br>') : '  (tom)'}
                    <br><br>
                    <strong>state.data (3 första):</strong><br>
                    ${debugData.length ? debugData.map(s => '  ' + esc(s)).join('<br>') : '  (tom)'}
                </div>
            </details>`;
    }

    // ====== Kontroller ======
    const controlsHtml = `
        <div class="card mb-14">
            <div class="controls-row mitt bryt gap-18">
                <div class="mitt rad-inline gap-8">
                    <label for="lv-kvinno-thr">Kvinnotröskel:</label>
                    <input type="number" id="lv-kvinno-thr" min="50" max="70" step="5" value="${cfg.kvinnoTrosholdPct}" class="form-select bredd-64">
                    <span>%</span>
                </div>
                <div class="mitt rad-inline gap-8">
                    <label for="lv-min-gap">Min gap:</label>
                    <input type="number" id="lv-min-gap" min="0" max="50" step="1" value="${cfg.minGapPct}" class="form-select bredd-64">
                    <span>%</span>
                </div>
                <div class="mitt rad-inline gap-8">
                    <label for="lv-top-n">Visa max:</label>
                    <input type="number" id="lv-top-n" min="10" max="500" step="10" value="${cfg.topN}" class="form-select bredd-72">
                    <span>par</span>
                </div>
            </div>
        </div>`;
    // Exporten hör till paren, inte till inställningarna: knapparna står överst i avsnittet om paren.
    const exportHtml = (jämförOK && result.pairs.length) ? `
        <div class="tabell-export-rad">
            <div class="chart-export tabell-export">
                <button type="button" class="chart-export-btn" aria-expanded="false" aria-controls="lv-export-meny" aria-label="Exportera kandidatparens tabell">Exportera</button>
                <div class="chart-export-meny" id="lv-export-meny" hidden>
                    <button type="button" id="btn-export-likvardighet-csv">CSV (öppnas direkt i Excel)</button>
                    <button type="button" id="btn-export-likvardighet">Excel (.xlsx) med metodblad</button>
                </div>
            </div>
        </div>` : '';

    // ====== Sätt ihop allt ======
    const kravGammal = document.getElementById('chart-likvardighet-krav');
    if (kravGammal) rensaFigur(kravGammal);   // kortets HTML byggs om: den gamla behållaren släpps först
    // Avsnitten byggs om vid varje ritning. Vilka som är utfällda bevaras, annars skulle avsnittet med
    // inställningarna fällas ihop varje gång ett värde i det ändras. Första gången är avsnittet om paren öppet.
    const fanns = !!wrap.querySelector('details.avsnitt');
    const oppna = new Set([...wrap.querySelectorAll('details.avsnitt')].filter(a => /** @type {HTMLDetailsElement} */ (a).open).map(a => a.id));
    const avsnitt = (namn, rubrik, under, nyckel, innehall) => {
        const id = `avsnitt-lv-${namn}`;
        return `<details class="avsnitt" id="${id}"${(fanns ? oppna.has(id) : namn === 'par') ? ' open' : ''}>
            <summary><span class="avsnitt-titel"><h2>${rubrik}</h2><span class="avsnitt-under">${under}</span></span><span class="avsnitt-nyckel" id="nyckel-lv-${namn}">${esc(nyckel)}</span></summary>
            ${innehall}</details>`;
    };
    const std = { kvinnoTrosholdPct: 60, minGapPct: 5, topN: 20 };   // samma som utgångsläget i 12-tillstand.js
    const anpassat = cfg.kvinnoTrosholdPct !== std.kvinnoTrosholdPct || cfg.minGapPct !== std.minGapPct || cfg.topN !== std.topN;
    _lvRitaTopp(result, cfg);
    wrap.innerHTML =
        felHtml +
        `<div class="card marg-0-0-14">
            <h2 class="fs-md marg-0-0-4">Krav mot lön — alla yrkesgrupper</h2>
            <p class="text-dampad-xs marg-0-0-8">En punkt per yrkesgrupp: arbetets krav vågrätt, medianlönen lodrätt. Kvinnodominerade grupper som ligger under linjen har lägre lön än kraven brukar ge i organisationen — de är värda att titta närmare på.</p>
            <div id="chart-likvardighet-krav"></div>
            <p id="lv-krav-not" class="text-dampad-xs marg-8-0-0"></p>
        </div>` +
        `<p class="avsnitt-rubrikrad">Fördjupning</p>` +
        avsnitt('par', 'Par att titta närmare på', 'Kvinnodominerade yrken mot högre avlönade jämförelseyrken på samma nivå', `${result.pairs.length} par`,
        exportHtml +
        ((jämförOK && result.pairs.length) ? `
        <div class="card mb-14">
            <div class="chart-header rad-bryt-mitt gap-12 mellan marg-b-8">
                <h3 class="fs-md marg-0">Kandidatparen i kronor</h3>
                <span class="text-dampad-xs">Ett par per rad: avståndet mellan punkterna är gapet, allvarligast först</span>
            </div>
            <div id="chart-likvardighet-heatmap"></div>
        </div>` : '') +
        parTblHtml +
        _lagreKravHtml(result)) +
        avsnitt('underlag', 'Yrkena bakom jämförelsen', 'Steg för steg: de kvinnodominerade yrkena och jämförelseyrkena',
            `${result.orgKvDom.length} kvinnodominerade, ${result.orgIckeKv.length + result.statIckeKv.length} att jämföra med`,
            orgTblHtml + internTblHtml + statTblHtml) +
        avsnitt('installningar', 'Inställningar', 'Kvinnotröskel, minsta gap och antal par. Standardvärdena räcker för de flesta.',
            anpassat ? 'Anpassade värden' : 'Standardvärden', controlsHtml) +
        avsnitt('analys', 'Så fungerar analysen', 'Metoden, och vad verktyget ser i ert underlag', '', introHtml + diagnostikHtml) +
        debugHtml;

    // ====== Event-hooks ======
    const onNumChange = (id, key, min, max) => {
        const el = document.getElementById(id);
        if (!el) return;
        el.addEventListener('change', () => {
            let v = parseFloat(/** @type {HTMLInputElement} */ (el).value);
            if (!isFinite(v)) return;
            if (min != null && v < min) v = min;
            if (max != null && v > max) v = max;
            state.likvardighet[key] = v;
            renderLikvardighet();
        });
    };
    onNumChange('lv-kvinno-thr', 'kvinnoTrosholdPct', 50, 70);
    onNumChange('lv-min-gap',    'minGapPct',         0, 50);
    onNumChange('lv-top-n',      'topN',              10, 500);
    document.getElementById('btn-export-likvardighet')?.addEventListener('click', exportLikvardighet);
    document.getElementById('btn-export-likvardighet-csv')?.addEventListener('click', exportLikvardighetCSV);

    // Bevis-popup
    wrap.querySelectorAll('.btn-evidence[data-lv-pair]').forEach(btn => {
        btn.addEventListener('click', () => {
            const idx = parseInt(/** @type {HTMLElement} */ (btn).dataset.lvPair || '', 10);
            const p = (state.likvardighet.result?.pairs || [])[idx];
            if (!p) return;
            _openEvidenceModal(_evidenceForLikvardighetPair(p));
        });
    });

    if (typeof enableTableSort === 'function') enableTableSort('likvardighet-table');
    if (typeof addTableExportTools === 'function') addTableExportTools('likvardighet-table', 'likvardighet');
    if (document.getElementById('likvardighet-lagre-krav-table')) {
        if (typeof enableTableSort === 'function') enableTableSort('likvardighet-lagre-krav-table');
        if (typeof addTableExportTools === 'function') addTableExportTools('likvardighet-lagre-krav-table', 'likvardighet_lagre_krav');
    }

    // Kandidatparen som bild (visualiserings-Steg 2), om det finns par.
    if (jämförOK && result.pairs.length) renderLikvardighetHeatmap(result.pairs);
    renderLikvardighetKrav();
}

// ---- § 3:10: kandidatparen som bild (visualiserings-Steg 2) -----------------
// Rena par-listan (kvinnodominerat yrke × jämförelseyrke, z = lönegap %) blir en
// äkta 2D-matris. Tabellen finns kvar som tillgänglighetsalternativ (role="img"
// + aria pekar dit). Färgen är enkelriktad (PALETTE.sekventiell): rödare cell =
// större gap = jämförelseyrket tjänar mer än det kvinnodominerade yrket.
/** Flikens topp: urvalsraden och slutsatserna. Talen är de som tabellerna i fliken visar (paren är redan prövade mot tröskeln). */
function _lvRitaTopp(result, cfg) {
    const urval = document.getElementById('lv-urval'), host = document.getElementById('lv-slutsatser');
    if (!urval || !host) return;
    if (!result) { urval.textContent = ''; host.innerHTML = ''; return; }
    urval.innerHTML = `<span><strong>Hela urvalet</strong> · ${svTal(getData().length, 0)} personer</span>${kTroskelLank()}`;
    const par = result.pairs, sakra = par.filter(p => p.gapCI && p.gapCI.lo != null && p.gapCI.lo > 0).length;
    const storst = par.reduce((a, p) => (!a || p.gapPct > a.gapPct ? p : a), null);
    host.innerHTML = _laSlutsats('Kvinnodominerade yrken', svTal(result.orgKvDom.length, 0), `minst ${cfg.kvinnoTrosholdPct} % kvinnor`)
        + _laSlutsats('Jämförelseyrken', svTal(result.orgIckeKv.length + result.statIckeKv.length, 0), `${result.orgIckeKv.length} egna, ${result.statIckeKv.length} ur statistiken`, false, 'Egna yrken som inte är kvinnodominerade, och yrken ur jämförelsestatistiken')
        + _laSlutsats('Par att titta närmare på', svTal(par.length, 0), par.length ? `${sakra} med säker skillnad` : 'Inget jämförelseyrke ligger högre')
        // Nyckeltalen visar kvinnors lön i % av mäns (här: det kvinnodominerade yrkets median i % av jämförelseyrkets);
        // partabellen behåller sin skillnad, hur mycket mer jämförelseyrket tjänar, och verktygstipset säger hur de hänger ihop.
        + (storst ? _laSlutsats('Största skillnaden', svPct(storst.kvMedian / storst.maMedian * 100, 1), `${storst.kvLabel || storst.kvAid} i % av ${storst.maLabel || storst.maAid}`, false,
            `Det kvinnodominerade yrkets medianlön i % av jämförelseyrkets. I tabellen över paren står samma skillnad som hur mycket mer jämförelseyrket tjänar: ${svPct(storst.gapPct, 1)}.`) : '');
}

// ---- Krav mot lön: en punkt per yrkesgrupp ----------------------------------
// Kraven är arbetsvärderingspoäng när en poängtabell är inläst, annars BAS-intervallets rang — samma krav-proxy som
// parbildningen. En grupp som saknar poäng i en inläst tabell placeras efter sitt BAS-intervall: medianpoängen för
// intervallets värderade grupper; tipset och noten säger det. Finns ingen värderad grupp i
// intervallet går gruppen inte att placera och namnges i noten.
// Bara grupper som når tröskeln: diagrammet visar gruppens medianlön. Linjen räknas ur de grupper som visas.
/**
 * @param {any[]} rader
 * @param {{kvinnoThr?: number, k?: number, poangByKey?: Map<string, number>|null}} [opts]
 */
function _lvKravGrupper(rader, { kvinnoThr = 60, k = 10, poangByKey = null } = {}) {
    const map = new Map();
    for (const r of rader || []) {
        const aid = String(r && r.aid || '').trim();
        if (!aid || !(r.lon > 0) || !r.bas) continue;
        const key = aid + '|' + r.bas;
        if (!map.has(key)) map.set(key, { aid, bas: r.bas, namn: r.yrkeLabel || r.yrke || aid, n: 0, nKv: 0, loner: [] });
        const g = map.get(key);
        g.n++; if (typeof r.kon === 'string' && r.kon.includes('kvinna')) g.nKv++; g.loner.push(r.lon);
    }
    const medPoang = !!(poangByKey && poangByKey.size);
    const alla = [...map.values()].filter(g => g.n >= k).map(g => {
        const andelKv = 100 * g.nKv / g.n;
        const poang = medPoang ? (poangByKey.get(g.aid + '|' + g.bas) ?? poangByKey.get(g.aid) ?? null) : null;
        return { aid: g.aid, bas: g.bas, namn: g.namn, n: g.n, andelKv, median: Stat.median(g.loner), poang,
                 dominans: andelKv >= kvinnoThr ? 'kvinnodominerad' : andelKv <= 100 - kvinnoThr ? 'mansdominerad' : 'blandad' };
    });
    if (!medPoang) return { medPoang, grupper: alla, utanPlats: [] };
    // Medianpoängen per BAS-intervall, ur de värderade grupper som visas.
    const perBas = new Map();
    for (const g of alla) if (g.poang != null) { if (!perBas.has(g.bas)) perBas.set(g.bas, []); perBas.get(g.bas).push(g.poang); }
    const grupper = [], utanPlats = [];
    for (const g of alla) {
        if (g.poang != null) grupper.push({ ...g, krav: g.poang });
        else if (perBas.has(g.bas)) grupper.push({ ...g, krav: Stat.median(perBas.get(g.bas)), uppskattad: true });
        else utanPlats.push(g);
    }
    return { medPoang, grupper, utanPlats };
}
const _LV_KRAV_SERIER = [
    { dominans: 'kvinnodominerad', serie: 'Kvinnodominerad', farg: () => PALETTE.kon.kvinna, symbol: 'cirkel' },
    { dominans: 'mansdominerad', serie: 'Mansdominerad', farg: () => PALETTE.kon.man, symbol: 'triangelHoger' },
    { dominans: 'blandad', serie: 'Blandad', farg: () => PALETTE.semantic.neutral, symbol: 'cirkel' }
];
function _lvKravFigur({ medPoang, grupper }, { kvinnoThr = 60 } = {}) {
    const kr = v => _figTalformat(v, 'kr');
    const rang = _lvBasRangFn(grupper.map(g => g.bas));
    const basOrdning = [...new Set(grupper.map(g => g.bas))].sort((a, b) => rang(a) - rang(b)).map(b => 'BAS ' + b);
    const x = g => (medPoang ? g.krav : 'BAS ' + g.bas);
    // Nivån kraven brukar ge: med poäng en rät linje (minsta kvadrat över grupperna), annars medianen av
    // gruppmedianerna per BAS-intervall.
    let niva, linje;
    if (medPoang) {
        const reg = Stat.linearRegression(grupper.map(g => [g.krav, g.median]));
        niva = g => reg.m * g.krav + reg.b;
        const xs = grupper.map(g => g.krav), a = Math.min(...xs), b = Math.max(...xs);
        linje = a < b ? [{ x: a, y: reg.m * a + reg.b }, { x: b, y: reg.m * b + reg.b }] : [];
    } else {
        const perBas = new Map();
        for (const g of grupper) { if (!perBas.has(g.bas)) perBas.set(g.bas, []); perBas.get(g.bas).push(g.median); }
        niva = g => Stat.median(perBas.get(g.bas));
        linje = basOrdning.map(b => ({ x: b, y: Stat.median(perBas.get(b.slice(4))) }));
    }
    // Utan poäng står alla grupper i ett BAS-intervall på samma plats i sidled, och grupper med nästan samma median
    // täcker varandra. De flyttas isär i sidled inom intervallets bredd: fil 0 i mitten, sedan omväxlande åt höger och
    // vänster. En grupp tar första fil där ingen redan lagd grupp ligger närmare än en tjugondel av lönespannet.
    const sidled = new Map();
    if (!medPoang) {
        const alla = grupper.map(g => g.median), nara = Math.max(1, (Math.max(...alla) - Math.min(...alla)) / 20);
        const filer = [0, 1, -1, 2, -2, 3, -3, 4, -4];
        for (const bas of new Set(grupper.map(g => g.bas))) {
            const lagda = [];
            for (const g of grupper.filter(q => q.bas === bas).sort((p, q) => (p.median - q.median) || String(p.namn).localeCompare(String(q.namn), 'sv'))) {
                const fil = filer.find(f => !lagda.some(o => o.fil === f && Math.abs(o.median - g.median) < nara)) ?? 0;
                lagda.push({ fil, median: g.median });
                if (fil) sidled.set(g, fil * 0.085);
            }
        }
    }
    // Namn bara på de kvinnodominerade grupper som ligger längst under nivån — det är dem diagrammet pekar ut.
    const under = grupper.filter(g => g.dominans === 'kvinnodominerad' && g.median < niva(g)).sort((p, q) => (p.median - niva(p)) - (q.median - niva(q))).slice(0, 10);
    const storlek = n => Math.max(4, Math.min(12, 2 + Math.sqrt(n)));
    /** @type {any[]} */
    const lager = _LV_KRAV_SERIER.map(s => ({ marke: 'punkt', serie: s.serie, farg: s.farg(), symbol: s.symbol, opacitet: 0.8, etikettLage: 'hoger',
        data: grupper.filter(g => g.dominans === s.dominans).map(g => ({ x: x(g), y: Math.round(g.median), ...(sidled.has(g) ? { forskjutning: sidled.get(g) } : {}), storlek: storlek(g.n), namn: g.namn, bas: g.bas, n: g.n, andelKv: g.andelKv,
            avstand: Math.round(g.median - niva(g)), uppskattad: !!g.uppskattad, krav: g.krav, markering: markeringFor(g.bas, g.aid),
            ...(under.includes(g) ? { etikett: g.namn } : {}) })),
        tips: d => [[`${d.namn} · BAS ${d.bas}`], ['Medianlön', kr(d.y)], [d.avstand < 0 ? 'Under nivån' : 'Över nivån', kr(Math.abs(d.avstand))],
                    ['Andel kvinnor', _figTalformat(d.andelKv, 'pct')], ['Antal', String(d.n)],
                    ...(medPoang ? [[d.uppskattad ? 'Poäng (efter BAS-intervallet)' : 'Arbetsvärderingspoäng', _figTalformat(d.krav, 'antal')]] : [])]
    })).filter(l => l.data.length);
    if (linje.length >= 2) lager.unshift({ marke: 'linje', serie: medPoang ? 'Nivå efter kraven (trend)' : 'Nivå per BAS-intervall', farg: PALETTE.semantic.mork, streck: 'streckad', tjocklek: 1.5, data: linje });
    return { beskrivning: `En punkt per yrkesgrupp: arbetets krav (${medPoang ? 'arbetsvärderingspoäng' : 'BAS-intervall'}) mot gruppens medianlön, med form och färg efter könsdominans (kvinnodominerad från ${kvinnoThr} procent kvinnor). Den streckade linjen är nivån kraven brukar ge i organisationen.`,
        x: medPoang ? { skala: 'linjar', titel: 'Arbetsvärderingspoäng' } : { skala: 'band', titel: 'BAS-intervall (stigande krav)', ordning: basOrdning },
        y: { skala: 'linjar', titel: 'Gruppens medianlön', format: 'kr' }, hojd: 420, lager };
}
function renderLikvardighetKrav() {
    const el = document.getElementById('chart-likvardighet-krav');
    if (!el) return;
    const cfg = state.likvardighet || {}, av = state.arbetsvardering, k = kTroskel(), kvinnoThr = cfg.kvinnoTrosholdPct ?? 60;
    const u = _lvKravGrupper(state.data || [], { kvinnoThr, k, poangByKey: av && av.byKey && av.byKey.size ? av.byKey : null });
    const not = document.getElementById('lv-krav-not');
    if (u.grupper.length < 3) {
        rensaFigur(el);
        el.innerHTML = `<p class="text-dampad-sm marg-8-0">För få yrkesgrupper${k > 1 ? ` med minst ${k} personer` : ''} för att visa krav mot lön.</p>`;
        if (not) not.textContent = '';
        return;
    }
    const figur = _lvKravFigur(u, { kvinnoThr });
    const under = figur.lager.filter(l => l.serie === 'Kvinnodominerad').flatMap(l => l.data).filter(d => d.avstand < 0).length;
    ritaFigur(el, figur, { exportAnteckning: `${under} ${under === 1 ? 'kvinnodominerad grupp ligger' : 'kvinnodominerade grupper ligger'} under nivån` });
    const uppskattade = u.grupper.filter(g => g.uppskattad).length;
    if (not) not.textContent = `${k > 1 ? `Bara yrkesgrupper med minst ${k} personer. ` : ''}Punktens storlek följer antalet personer.`
        + (uppskattade ? ` ${uppskattade} ${uppskattade === 1 ? 'grupp saknar' : 'grupper saknar'} poäng i arbetsvärderingen och är placerade efter sitt BAS-intervall (medianpoängen för intervallets värderade grupper).` : '')
        + (u.utanPlats.length ? ` Kan inte placeras (ingen värderad grupp i samma BAS-intervall): ${u.utanPlats.map(g => g.namn).join(', ')}.` : '');
}

function renderLikvardighetHeatmap(pairs) {
    const el = document.getElementById('chart-likvardighet-heatmap');
    if (!el) return;
    if (!Array.isArray(pairs) || !pairs.length) { rensaFigur(el); el.innerHTML = ''; return; }
    ritaFigur(el, _lvParFigur(pairs));
}
// Kandidatparen som bild (behållaren heter chart-likvardighet-heatmap): ett kandidatpar per rad, det kvinnodominerade yrkets och jämförelseyrkets medianlön som
// två punkter på samma kronaxel. Avståndet är gapet; procenttalet står vid jämförelseyrket. De allvarligaste
// paren först (allvarsindex), högst `max` rader. Fliken redovisar grupper under tröskeln (ADR-14).
function _lvParFigur(pairs, max = 14) {
    const top = pairs.slice().sort((a, b) => (b.allvarsindex || 0) - (a.allvarsindex || 0)).slice(0, max);
    const namn = p => `${_rfKorta(String(p.kvLabel), 22)} mot ${_rfKorta(String(p.maLabel), 22)}`;
    const rader = [], sedda = new Set();
    for (const p of top) { const y = namn(p); if (!sedda.has(y) && isFinite(p.kvMedian) && isFinite(p.maMedian)) { sedda.add(y); rader.push({ p, y }); } }
    const kr = v => _figTalformat(Math.round(v), 'kr');
    const tips = ({ p }) => [[`${p.kvLabel} (BAS ${p.kvBas})`], ['Median', kr(p.kvMedian)], [`${p.maLabel} (BAS ${p.maBas})`], ['Median', kr(p.maMedian)], ['Gap', `${svPct(p.gapPct, 1)} (${kr(p.gapKr)})`]];
    const punkt = (serie, farg, falt, extra = {}) => ({ marke: 'punkt', serie, farg, storlek: 6, ...extra,
        data: rader.map(r => ({ y: r.y, x: Math.round(r.p[falt]), p: r.p, ...(extra.etikettLage ? { etikett: svPct(r.p.gapPct, 1) } : {}) })), tips: d => tips(d) });
    return { beskrivning: 'Kandidatpar i likvärdigt arbete: det kvinnodominerade yrkets och jämförelseyrkets medianlön per par, med gapet i procent. Samma par finns i kandidatpar-tabellen nedan.',
        x: { skala: 'linjar', titel: 'Medianlön (kr/månad)', format: 'kr' }, y: { skala: 'band', ordning: rader.map(r => r.y), etikettMax: 48 },
        hojd: Math.max(160, 96 + rader.length * 32),
        lager: [{ marke: 'intervall', riktning: 'liggande', serie: 'Gap', farg: PALETTE.semantic.neutral, tjocklek: 2, legend: false,
                  data: rader.map(r => ({ y: r.y, lag: Math.round(Math.min(r.p.kvMedian, r.p.maMedian)), hog: Math.round(Math.max(r.p.kvMedian, r.p.maMedian)), p: r.p })), tips: d => tips(d) },
                punkt('Kvinnodominerat yrke', PALETTE.kon.kvinna, 'kvMedian'), punkt('Jämförelseyrke', PALETTE.kon.man, 'maMedian', { etikettLage: 'hoger' })] };
}

/**
 * Exporterar § 3:10-tabellen + metadatablad till Excel.
 */
/**
 * Robust CSV-export för § 3:10. Använder _downloadCSV-helpern direkt —
 * INGA beroenden på XLSX-biblioteket. Detta är PRIMÄR exportväg (Excel-versionen
 * är sekundär).
 */
// Metodraden om åldersjusteringen (CSV:ns metadata och Excel-arbetsbokens metadatablad).
const LV_JUSTERAD_METOD = 'Jämförelseyrkets lön omräknad till det kvinnodominerade yrkets åldersfördelning: log(lön) = a + b·ålder skattas i jämförelseyrket (minst ' + ALDERS_GOLV + ' personer, minst ' + ALDERS_SPRIDNING + ' års åldersspridning), lönen prediceras vid varje person i det kvinnodominerade yrket och medianen av prediktionerna jämförs med dess median. Den råa skillnaden är det lagen prövar; den justerade visar hur mycket som kan bero på åldersstruktur. Bara interna par; tomt när den inte kan räknas.';

// Går alltid genom exportläget (ADR-51): djupräknaren håller skärmen i exportläget tills den sista pågående exporten är klar.
function exportLikvardighetCSV(...a) { return medExportLage(() => _exportLikvardighetCSVExport.apply(null, /** @type {any} */ (a))); }
function _exportLikvardighetCSVExport() {
    const result = likvardighetResultat();
    if (!result || !Array.isArray(result.pairs) || !result.pairs.length) {
        alert('Inga jämförelsepar att exportera. Kontrollera att Steg 3 i fliken visar par.');
        return;
    }
    const num = (v, dec) => {
        if (v == null) return '';
        const n = Number(v);
        if (!isFinite(n)) return '';
        return (dec != null && dec > 0) ? n.toFixed(dec).replace('.', ',') : Math.round(n);
    };
    const källNamn = p => p.jamforKalla === 'intern' ? 'Intern (organisation)'
        : (p.maKlassKort === 'lokal' ? 'jämförelsestatistiken' : 'SKR:s personalstatistik');
    const rows = [[
        'Nr',
        'Org. AID', 'Org. Yrke', 'BAS', 'Org. n', 'Org. % kvinnor', 'Median Org. (kr)',
        'Jämf. AID', 'Jämf. Yrke', 'Jämf. % kvinnor', 'Jämf. n', 'Jämförelsekälla', 'Median Jämf. (kr)',
        'Gap (kr)', 'Gap (%)', 'Justerad för ålder (%)', 'KI 95% låg (kr)', 'KI 95% hög (kr)', 'Säkerhet', 'Påverkansindex',
        'Sakligt skäl — fylls i', 'Status / åtgärd — fylls i'
    ]];
    result.pairs.forEach((p, i) => {
        const ci = p.gapCI && p.gapCI.lo != null;
        rows.push([
            i + 1,
            p.kvAid || '', p.kvLabel || '', p.kvBas || '', num(p.kvN), num(p.kvKvinnoPct, 1), num(p.kvMedian),
            p.maAid || '', p.maLabel || '', num(p.maKvAndel, 1), num(p.maN),
            källNamn(p),
            num(p.maMedian),
            num(p.gapKr), num(p.gapPct, 2),
            p.aldersJusterad ? num(p.aldersJusterad.gapPct, 2) : '',
            ci ? num(p.gapCI.lo) : '', ci ? num(p.gapCI.hi) : '',
            ci ? (p.gapCI.lo > 0 ? 'Säker skillnad' : 'Inom slumpfel') : 'Ej beräkningsbar',
            num(p.allvarsindex),
            '', ''   // tomma protokollfält: sakligt skäl + status/åtgärd
        ]);
    });
    // Lägg till metadata-rader sist (åtskilda från data med tom rad)
    rows.push([]);
    rows.push(['# METADATA']);
    rows.push(['Genererad', new Date().toLocaleString('sv-SE')]);
    rows.push(['Verktyg', 'Öppen lönekartläggning v' + (typeof APP_VERSION !== 'undefined' ? APP_VERSION : '–')]);
    rows.push(['Kvinnotröskel (%)', result.opts.kvinnoTrosholdPct]);
    rows.push(['Min gap (%)', result.opts.minGapPct]);
    rows.push(['Antal par', result.pairs.length]);
    rows.push(['•varav interna (organisation mot organisation)', result.diagnostik?.jämförelse?.internaPar ?? 0]);
    rows.push(['•varav externa (mot jämförelsestatistiken)', result.diagnostik?.jämförelse?.externaPar ?? 0]);
    rows.push(['BAS som föll tillbaka på extern statistik', result.diagnostik?.jämförelse?.basMedExternFallback ?? 0]);
    rows.push(['Klassificeringskälla — jämförelsestatistiken', result.diagnostik?.statistik?.klassKalla?.lokal ?? 0]);
    rows.push(['Klassificeringskälla — SKR:s personalstatistik', result.diagnostik?.statistik?.klassKalla?.scb ?? 0]);
    rows.push(['KI-metod', 'Bootstrap B=1000; intern = bägge individurvalen, extern = org-löner mot jämförelsestatistikens median']);
    rows.push(['Justerad för ålder', LV_JUSTERAD_METOD]);
    rows.push(['k-anonymitet', 'Tillämpas EJ i denna analys']);
    _downloadCSV(rows, 'lonekartlaggning_likvardighet_' + new Date().toISOString().slice(0, 10), { undantag: 'Likvärdigt arbete' });
}

// Går alltid genom exportläget (ADR-51): djupräknaren håller skärmen i exportläget tills den sista pågående exporten är klar.
function exportLikvardighet(...a) { return medExportLage(() => _exportLikvardighetExport.apply(null, /** @type {any} */ (a))); }
function _exportLikvardighetExport() {
    // STEG 0: Diagnostiska statusmeddelanden så användaren ser EXAKT var det
    // klickar. Om något felar visas alert med stegnamn — användaren kan
    // rapportera, vi kan felsöka.
    let stegnamn = 'init';
    try {
        stegnamn = 'kontroll XLSX-bibliotek';
        if (typeof XLSX === 'undefined' || !XLSX.utils || typeof XLSX.writeFile !== 'function') {
            alert('Excel-bibliotek (SheetJS) saknas eller är ofullständigt i bygget. Ladda om sidan med Ctrl+Shift+R.');
            return;
        }

        stegnamn = 'hämta result från state';
        const result = likvardighetResultat();
        if (!result) {
            alert('Internt fel: result är null. Renderera fliken igen.');
            return;
        }
        if (!Array.isArray(result.pairs) || result.pairs.length === 0) {
            alert(`Inga jämförelsepar att exportera (pairs.length = ${result.pairs ? result.pairs.length : 'undefined'}).\n\nKontrollera att Steg 3 i fliken visar par i tabellen.`);
            return;
        }
        const { pairs } = result;
        const diagnostik = result.diagnostik || {};
        const opts = result.opts || {};

        // Helper: säker numerisk-konvertering. Returnerar number om giltigt,
        // tom sträng om null/undefined/NaN. Excel hanterar tomma strängar.
        const num = (v, decimals) => {
            if (v == null) return '';
            const n = Number(v);
            if (!isFinite(n)) return '';
            return (decimals != null && decimals > 0) ? +n.toFixed(decimals) : Math.round(n);
        };

        stegnamn = 'bygg arbetsbok';
        const wb = XLSX.utils.book_new();

        stegnamn = 'bygg datablad';
        const källNamn = p => p.jamforKalla === 'intern' ? 'Intern (organisation)'
            : (p.maKlassKort === 'lokal' ? 'jämförelsestatistiken' : 'SKR:s personalstatistik');
        const header = [
            'Nr',
            'Org. AID', 'Org. Yrke', 'BAS', 'Org. n', 'Org. % kvinnor', 'Median Org. (kr)',
            'Jämf. AID', 'Jämf. Yrke', 'Jämf. % kvinnor', 'Jämf. n', 'Jämförelsekälla', 'Median Jämf. (kr)',
            'Gap (kr)', 'Gap (%)', 'Justerad för ålder (%)', 'KI 95% låg (kr)', 'KI 95% hög (kr)', 'Säkerhet', 'Påverkansindex',
            'Sakligt skäl — fylls i', 'Status / åtgärd — fylls i'
        ];
        const rows = [header];
        for (let i = 0; i < pairs.length; i++) {
            const p = pairs[i] || {};
            const ci = p.gapCI && p.gapCI.lo != null;
            rows.push([
                i + 1,
                p.kvAid || '', p.kvLabel || '', p.kvBas || '', num(p.kvN), num(p.kvKvinnoPct, 1), num(p.kvMedian),
                p.maAid || '', p.maLabel || '', num(p.maKvAndel, 1), num(p.maN),
                källNamn(p),
                num(p.maMedian),
                num(p.gapKr), num(p.gapPct, 2),
                p.aldersJusterad ? num(p.aldersJusterad.gapPct, 2) : '',
                ci ? num(p.gapCI.lo) : '', ci ? num(p.gapCI.hi) : '',
                ci ? (p.gapCI.lo > 0 ? 'Säker skillnad' : 'Inom slumpfel') : 'Ej beräkningsbar',
                num(p.allvarsindex),
                '', ''   // tomma protokollfält: sakligt skäl + status/åtgärd
            ]);
        }
        const sheet = XLSX.utils.aoa_to_sheet(rows);
        // Kolumnbredder — säkert standardattribut
        sheet['!cols'] = [
            { wch: 4 }, { wch: 8 }, { wch: 30 }, { wch: 6 }, { wch: 7 }, { wch: 12 }, { wch: 14 },
            { wch: 8 }, { wch: 30 }, { wch: 12 }, { wch: 7 }, { wch: 20 }, { wch: 14 },
            { wch: 11 }, { wch: 8 }, { wch: 12 }, { wch: 14 }, { wch: 14 }, { wch: 16 }, { wch: 14 },
            { wch: 46 }, { wch: 32 }
        ];
        // Hoppar över !freeze (icke-standard i mini-versionen) och num-format
        // (icke-kritisk kosmetik). Datat står sig utan.
        XLSX.utils.book_append_sheet(wb, sheet, 'Likvärdighet §3-10');

        stegnamn = 'bygg metadatablad';
        // Säker getter — diagnostik-objektet kan ha varit ofullständigt om
        // computeLikvardighetPairs avbröts mitt i ett steg.
        /** @param {() => any} path @param {any} [fallback] */
        const safe = (path, fallback = '') => {
            try {
                const v = path();
                return v == null ? fallback : v;
            } catch (_e) { return fallback; }
        };
        const meta = [
            ['LIKVÄRDIGHETSANALYS — DISKRIMINERINGSLAGEN KAP. 3 § 10', ''],
            ['', ''],
            ['Genererad', new Date().toLocaleString('sv-SE')],
            ['Verktyg', 'Öppen lönekartläggning (v' + (typeof APP_VERSION !== 'undefined' ? APP_VERSION : '–') + ')'],
            ['Aktiv profil', safe(() => state.profile.name)],
            ['Modell', 'Organisationens kvinnodominerade AID×BAS jämförs inom samma BAS, primärt mot organisationens egna icke-kv-dom yrken (intern), annars jämförelsestatistiken (extern fallback)'],
            ['', ''],
            ['— PARAMETRAR —', ''],
            ['Kvinnotröskel (%)', safe(() => opts.kvinnoTrosholdPct, '')],
            ['Min gap (%)', safe(() => opts.minGapPct, '')],
            ['Visa max antal par', safe(() => opts.topN, '')],
            ['k-anonymitet', 'Tillämpas EJ i denna analys'],
            ['', ''],
            ['— DIAGNOSTIK —', ''],
            ['Organisationens AID×BAS totalt', safe(() => diagnostik.organisation.antalAidxBas, 0)],
            ['Kvinnodominerade i organisationen', safe(() => diagnostik.organisation.kvDomFunna, 0)],
            ['•varav med n < k-tröskel (inkluderade ändå)', safe(() => diagnostik.organisation.kvDomMedNLessThanK, 0)],
            ['Rader i jämförelsestatistiken', safe(() => diagnostik.statistik.totalRader, 0)],
            ['Jämförelsestatistiken har könsfördelning', safe(() => diagnostik.statistik.harLokalKonsdata, false) ? 'Ja' : 'Nej'],
            ['Icke-kvinnodominerade i jämförelsestatistiken', safe(() => diagnostik.statistik.klass.ickeKv, 0)],
            ['Kvinnodominerade i jämförelsestatistiken', safe(() => diagnostik.statistik.klass.kvDom, 0)],
            ['Blandade i jämförelsestatistiken', safe(() => diagnostik.statistik.klass.blandat, 0)],
            ['Oklassificerade i jämförelsestatistiken', safe(() => diagnostik.statistik.klass.oklassificerad, 0)],
            ['Klassificering från jämförelsestatistikens könsfördelning', safe(() => diagnostik.statistik.klassKalla.lokal, 0)],
            ['Klassificering från SKR:s personalstatistik', safe(() => diagnostik.statistik.klassKalla.scb, 0)],
            ['Interna jämförelseyrken i organisationen', safe(() => diagnostik.organisation.ickeKvFunna, 0)],
            ['Gemensamma BAS', safe(() => diagnostik.jämförelse.gemensammaBas, 0)],
            ['Möjliga par', safe(() => diagnostik.jämförelse.möjligaPar, 0)],
            ['•varav jämförelseyrke > organisation', safe(() => diagnostik.jämförelse.statHögre, 0)],
            ['Flaggade interna par', safe(() => diagnostik.jämförelse.internaPar, 0)],
            ['Flaggade externa par (jämförelsestatistiken)', safe(() => diagnostik.jämförelse.externaPar, 0)],
            ['BAS som föll tillbaka på extern statistik', safe(() => diagnostik.jämförelse.basMedExternFallback, 0)],
            ['Par i utdata', pairs.length],
            ['', ''],
            ['— RÄTTSLIG GRUND —', ''],
            ['Diskrimineringslagen', 'Arbetsgivaren ska analysera om kvinnodominerade yrken har lägre lön än icke-kvinnodominerade yrken med likvärdiga eller lägre krav.'],
            ['Krav-proxy', 'Jämförelsen sker INOM samma BAS — likvärdighet är datadefinierad förutsättning.'],
            ['Jämförelsekälla', 'Primärt organisationens egna icke-kv-dom yrken (inom-arbetsgivare). Saknas internt jämförelseyrke i en BAS används jämförelsestatistiken som extern proxy.'],
            ['95 % KI', 'Bootstrap B=1000 på medianskillnaden. Intern: omdragning av bägge individurvalen. Extern: omdragning av org-löner mot jämförelsestatistikens median som konstant. Hela intervallet > 0 = säker skillnad.'],
            ['Justerad för ålder (%)', LV_JUSTERAD_METOD],
            ['Påverkansindex', 'Heuristik för rangordning: |gap kr| × antal medarbetare i gruppen. Inte ett lagstadgat mått.']
        ];
        const metaSheet = XLSX.utils.aoa_to_sheet(meta);
        metaSheet['!cols'] = [{ wch: 42 }, { wch: 72 }];
        XLSX.utils.book_append_sheet(wb, metaSheet, 'Metadata');

        stegnamn = 'skriv fil';
        const filename = 'lonekartlaggning_likvardighet_' + new Date().toISOString().slice(0, 10) + '.xlsx';
        _appendMethodSheet(wb, { undantag: 'Likvärdigt arbete' });
        XLSX.writeFile(wb, filename);

        stegnamn = 'efter-steg';
        if (typeof _showExportSensitivityToast === 'function') _showExportSensitivityToast();
        if (typeof announceToScreenReader === 'function') announceToScreenReader('Likvärdighetsanalys exporterad: ' + pairs.length + ' par.');
    } catch (err) {
        const msg = err && err.message ? err.message : String(err);
        const stackPreview = err && err.stack ? ('\n\nStack:\n' + String(err.stack).split('\n').slice(0, 4).join('\n')) : '';
        alert('Excel-export misslyckades vid steg "' + stegnamn + '":\n\n' + msg + stackPreview + '\n\nKontrollera att ingen annan applikation har en låst kopia av filen, eller rapportera detta meddelande till verktygsutvecklaren.');
    }
}


// ===================================================================

// Arbetsvärdering (poäng) läses ur strukturdatans valfria Poäng-kolumn —
// se _deriveArbetsvarderingFromData (anropas i _afterDataLoaded); någon egen uppladdning
// finns inte. Ekvivalensbandet ställs in i § 3:10-fliken.
document.getElementById('arbvard-band')?.addEventListener('change', e => {
    const v = parseFloat(/** @type {HTMLInputElement} */ (e.target).value);
    if (state.likvardighet && isFinite(v) && v >= 0) state.likvardighet.poangBandPct = v;
    if (state.likvardighet) state.likvardighet.result = null;
    const active = document.querySelector('.nav-item.active');
    if (active && active.getAttribute('data-tab') === 'likvardighet') renderLikvardighet();
});

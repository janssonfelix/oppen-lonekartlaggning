// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
// § 3:10 — Likvärdigt arbete (likvärdighetsanalys)
// ============================================================
// Beräkning och rendering av kandidatpar enligt DiskrL 3:10: kvinnodominerade
// yrken jämförs mot alla yrken som inte är kvinnodominerade (mansdominerade och
// blandade, klassen synlig; filtret jamforelse = 'mansdominerade' ger bara de
// mansdominerade, ADR-60) inom samma BAS-intervall
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
    if (p.jamforKalla !== 'intern') return termText('Ingen åldersjustering: {jamforelse.bf} kommer från jämförelsestatistiken och saknar individdata.');
    return `Ingen åldersjustering: ${T.jamforelse.bf} har färre än ${ALDERS_GOLV} personer med ålder eller mindre än ${ALDERS_SPRIDNING} års åldersspridning, eller åldrar saknas i underlaget.`;
}

/** Metadataraden om kvinnodominerade enheter som jämfördes med jämförelsestatistiken (CSV och Excel). */
function _lvExternFallbackText() {
    return termText('{Enhet.fl:kvinnodominerad} (i {niva.en}) jämförda med jämförelsestatistiken');
}

/** Poängläget: kraven mäts med arbetsvärderingspoäng, och bara organisationens egna jämförs (ADR-76). */
function _lvPoang(result) {
    return result?.diagnostik?.jämförelse?.kravProxy === 'poäng';
}

/** Jämförelsestatistikens jämförelseetiketter som paren kan använda: inga i poängläget, där bara organisationens egna jämförs (ADR-76). */
function _lvStatJamfor(result) {
    return _lvPoang(result) ? [] : result.statIckeKv;
}

function likvardighetResultat() {
    let lv = state.likvardighet && state.likvardighet.result;
    if (!lv) {
        lv = computeLikvardighetPairs();
        if (state.likvardighet) state.likvardighet.result = lv;
    }
    // Det enda i resultatet som beror på k-tröskeln är antalet små kvinnodominerade grupper i diagnostiken. Det räknas
    // här vid varje läsning med gällande tröskel, så att ett tröskelbyte inte behöver räkna om paren (de läser ingen
    // tröskel; det som redovisas utanför fliken prövas mot tröskeln när det läses, _parForRedovisning).
    const org = lv.diagnostik && lv.diagnostik.organisation;
    if (org && Array.isArray(lv.orgKvDom)) { const k = kInstalld(); org.kvDomMedNLessThanK = lv.orgKvDom.filter(g => g.n < k).length; }
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
 * @param {{kvinnoTrosholdPct?: number}} [over] - kvinnotröskel som går före inställningen (robusthetspanelen)
 * @returns {any} alltid ett objekt — aldrig null
 */
function computeLikvardighetPairs(over) {
    const cfg = state.likvardighet || {};
    const kvinnoThr = over?.kvinnoTrosholdPct ?? cfg.kvinnoTrosholdPct ?? 60;
    const av = state.arbetsvardering;
    const usePoang = !!(av && av.byKey && av.byKey.size > 0);

    const opts = {
        kvinnoTrosholdPct: kvinnoThr,
        kvDomDefinition: aidbasDefinition(),   // den enda definitionen av kvinnodominerat (ADR-60)
        jamforelse: lvJamforelse(),           // 'alla' som inte är kvinnodominerade | 'mansdominerade'
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
            nationellKlass: nationellAidKlass,
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
                    klassKalla: { lokal: 0, nationell: 0 } },
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

// Lägre krav, högre lön (ADR-25) — par över BAS-gränserna. På skärmen står BAS som liten text under etiketterna, som i
// partabellen, och BAS-steget bakom Fler kolumner. BAS-kolumnerna står kvar i tabellen för exporterna (.bara-export,
// dolda på skärmen), och texten under etiketten följer inte med ut (data-export-text): exporten är densamma som förut.
function _lagreKravHtml(result) {
    const poang = result.diagnostik?.jämförelse?.kravProxy === 'poäng';
    const par = result.lagreKrav || [];
    const fmt = new Intl.NumberFormat('sv-SE', { maximumFractionDigits: 0 });
    const pct = v => new Intl.NumberFormat('sv-SE', { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(v);
    let innehall;
    if (poang) innehall = `<p>${termText('Med arbetsvärderingspoäng jämförs {enhet.fl} redan över BAS-gränserna i kandidatparen ovan.')}</p>`;
    else if (!par.length) innehall = `<p>${termText('Ingen av {enhet.bfl:kvinnodominerad} har lägre medianlön än {enhet.art} {enhet.en} i lägre BAS.')}</p>`;
    else innehall = `<div class="rulla-x"><table id="likvardighet-lagre-krav-table" class="data-table"><thead><tr>
            <th>${termText('{Enhet.en:kvinnodominerad}')}</th><th class="bara-export">BAS</th><th>Median</th><th>${termText('{Jamforelse.en}')}</th><th class="bara-export">BAS</th><th>Median</th>
            <th data-kol="bassteg">BAS-steg</th><th>Skillnad (kr)</th><th>Skillnad (%)</th><th>95 % KI</th></tr></thead><tbody>${par.map(p => `<tr>
            <td>${esc(p.kvLabel)}<br><small class="f-dampad lv-under" data-export-text="">BAS ${esc(p.kvBas)}</small></td><td class="bara-export">${esc(p.kvBas)}</td><td data-sort-value="${p.kvMedian}">${fmt.format(p.kvMedian)}</td>
            <td>${esc(p.maLabel)}<br><small class="f-dampad lv-under" data-export-text="">BAS ${esc(p.maBas)}</small></td><td class="bara-export">${esc(p.maBas)}</td><td data-sort-value="${p.maMedian}">${fmt.format(p.maMedian)}</td>
            <td>${p.basSteg}</td><td data-sort-value="${p.gapKr}">${fmt.format(p.gapKr)}</td><td data-sort-value="${p.gapPct}">${pct(p.gapPct)}\u00a0%</td>
            <td>${p.gapCI ? `${fmt.format(p.gapCI.lo)}–${fmt.format(p.gapCI.hi)}\u00a0kr` : '–'}</td></tr>`).join('')}</tbody></table></div>`;
    return `<section id="likvardighet-lagre-krav" class="card marg-t-18">
        <h3 class="fs-lg">Lägre krav, högre lön</h3>
        ${poang ? '' : `<p class="text-dampad-sm">${termText('{Enhet.fl:kvinnodominerad} som har lägre medianlön än {enhet.art} av organisationens {enhet.fl} i lägre BAS.')} BAS används som mått på krav och är grovt — pröva mot befattningsbeskrivningarna.</p>`}
        ${innehall}</section>`;
}

// Kolumnerna som partabellens grundvy gömmer bakom Fler kolumner (data-kol på rubrikerna i renderLikvardighet).
// Antalen står också under båda etiketterna (n=).
const LV_DOLDA_KOLUMNER = ['median', 'antal', 'medianjamf', 'gapkr', 'justerad', 'paverkan'];
// Lägre krav, högre lön: BAS-steget bakom Fler kolumner (_lagreKravHtml).
const LV_LAGRE_KRAV_DOLDA_KOLUMNER = ['bassteg'];
// Nycklarna för kolumnerna med paret (data-kol) är historiska och står kvar; texten i kolumnen kommer ur termerna.
const LV_KOL_KVDOM = 'yrke', LV_KOL_JAMF = 'jamfyrke';
/**
 * Renderar § 3:10-flikens UI.
 *
 * Alltid-synliga steg:
 *   1. Diagnostik — vad parsern fann
 *   2. Organisationens kvinnodominerade yrken
 *   3. Jämförelseyrken: organisationens egna yrken som inte är kvinnodominerade (primärt) +
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
                <strong>${ikon('statusVarning')} Inga filer inlästa</strong>
                <p class="fs-md lh-1_55 marg-8-0">
                    Läs in <strong>lönefilen</strong> (CSV) och
                    <strong>jämförelsestatistiken</strong> (Excel) i Filer och kvalitet för att starta analysen.
                </p>
            </div>`;
        return;
    }

    let result;
    try {
        result = likvardighetResultat();
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

    const fmtKr = v => svKr(v);

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
    const statOK  = hasStat && _lvStatJamfor(result).length > 0;
    // Jämförelsen kan genomföras så snart organisationen har kvinnodom.
    // yrken OCH minst en jämförelsekälla (interna icke-kv yrken eller jämförelsestatistiken).
    const jämförOK = orgOK && (internOK || statOK);

    const introHtml = `
        <div class="insight-box info lv-hjalp marg-b-14">
            <strong>${ikon('info')} Så här fungerar likvärdighetsanalysen</strong>
            <p class="fs-md lh-1_55 marg-8-0">
                Lönekartläggningens regler omfattar en jämförelse mellan kvinnodominerat arbete och arbete som inte är kvinnodominerat
                och har <em>likvärdiga eller lägre krav</em>. Verktyget jämför kvinnodominerade ${T.enhet.fl} med alla ${T.enhet.fl} som inte är kvinnodominerade —
                både mansdominerade och blandade — och visar könsandelen i varje ${T.jamforelse.en}. Analysen är en
                <strong>jämförelse inom organisationen</strong> — därför jämförs ${d.jämförelse.kravProxy === 'poäng'
                    ? `organisationens egna ${T.enhet.fl} med varandra; jämförelsestatistiken har inga poäng och används inte.`
                    : `i första hand organisationens egna ${T.enhet.fl} med varandra.`}
            </p>
            ${d.jämförelse.kravProxy === 'poäng'
                ? `<p class="bak-ok-bg rund-4 fs-sm marg-8-0 pad-8-12">
                       <strong>Mått på kraven: arbetsvärdering (poäng)</strong> — ${T.enhet.fl} paras på likvärdiga eller lägre krav enligt organisationens poäng, lika krav inom ±${result.opts.poangBandPct ?? 5} %.${d.jämförelse.kvUtanPoang ? ` <span class="varning-pa-yta">${d.jämförelse.kvUtanPoang} ${termFras(T.enhet, d.jämförelse.kvUtanPoang === 1 ? 'en' : 'fl', { adjektiv: 'kvinnodominerad' })} saknar poäng och uteslöts.</span>` : ''}</p>`
                : `<p class="bak-accent-yta rund-4 fs-sm marg-8-0 pad-8-12">
                       <strong>Mått på kraven: ${T.niva.bf}</strong> — ${T.enhet.fl} inom samma ${T.niva.en} antas ha likvärdiga krav. Har organisationen en egen arbetsvärdering kan du lägga till poängen i lönefilen; poäng mäter kraven i arbetet bättre.</p>`}
            <ul class="fs-sm lh-1_6 marg-8-0 pad-v-22">
                <li><strong>Steg 1</strong>: Identifiera <em>organisationens kvinnodominerade</em>
                    ${T.enhet.fl} i varje ${T.niva.en} (${esc(aidbasDefinitionText())}).
                    K-anonymitet tillämpas <strong>inte</strong> i denna analys eftersom
                    resultatet är aggregerat per ${T.enhet.en}.</li>
                ${_lvPoang(result) ? `<li><strong>Steg 2</strong>: Välj ${T.jamforelse.fl} med lika eller lägre poäng
                    (likvärdiga eller lägre krav), också i andra ${T.niva.fl}. Bara organisationens egna
                    ${T.enhet.fl} som inte är kvinnodominerade (${jamforelseGransText()}) jämförs; jämförelsestatistiken
                    har inga poäng och används inte.</li>` : `<li><strong>Steg 2</strong>: Välj ${T.jamforelse.fl} inom samma ${T.niva.en}
                    (likvärdiga krav). <strong>Primärt</strong> används organisationens egna
                    ${T.enhet.fl} som inte är kvinnodominerade (${jamforelseGransText()})
                    — en jämförelse inom organisationen. Saknas ${termArtikel(T.jamforelse)} ${T.jamforelse.en} i organisationen i
                    ${termArtikel(T.niva)} ${T.niva.en} används <em>jämförelsestatistiken</em> i stället
                    ${d.statistik.harLokalKonsdata
                        ? `<span class="farg-ok">(lokal könsfördelning).</span>`
                        : `<span class="varning-pa-yta">(könsfördelningen hämtas då ur den nationella statistiken: andel kvinnor per ${T.kod.en} i ${_skrDelText(_skrDel())}, ${esc(skrKallaKort())}).</span>`}</li>`}
                <li><strong>Steg 3</strong>: Flagga par där ${termText('{jamforelse.bf.s}')} median är högre
                    än ${termText('{enhet.bf.s:kvinnodominerad}')}. Varje par får ett
                    <strong>bootstrap-95 %-konfidensintervall</strong> på medianskillnaden.
                    Den råa skillnaden är det lagen prövar — lönenivån som sådan; kolumnen
                    <em>Justerad för ålder</em> visar bredvid hur mycket av skillnaden som kan bero på
                    åldersstruktur (${termText('{jamforelse.bf.s}')} lön omräknad till ${termText('{enhet.bf.s:kvinnodominerad}')}
                    åldersfördelning; bara för interna par med minst ${ALDERS_GOLV} personer och
                    ${ALDERS_SPRIDNING} års åldersspridning i ${T.jamforelse.bf}).</li>
            </ul>
        </div>`;

    const diagnostikHtml = `
        <div class="card marg-b-14 pad-14">
            <h3 class="fs-lg marg-0-0-10">Diagnostik — vad verktyget ser</h3>
            <div class="rutnat fs-sm gap-14 kolumner-2-lika">
                <div class="rund-6 pad-12 ${orgOK ? 'ruta-ok' : 'ruta-varning'}">
                    <strong>Organisationens data</strong> ${statusMarke(orgOK ? 'ok' : 'varning')}
                    <ul class="lh-1_6 marg-6-0-0 pad-v-18">
                        <li>Totalt inlästa rader: <strong>${d.organisation.totalRader.toLocaleString('sv-SE')}</strong></li>
                        <li>Unika ${T.enhet.fl} i ${T.niva.fl}: <strong>${d.organisation.antalAidxBas}</strong></li>
                        <li>Kvinnodominerade (${kvDomGransText()}): <strong>${d.organisation.kvDomFunna}</strong></li>
                        <li>Interna ${T.jamforelse.fl} (${jamforelseGransText()}): <strong class="farg-ok">${d.organisation.ickeKvFunna}</strong> <small class="f-dampad">(${_lvPoang(result) ? 'den enda jämförelsekällan med poäng' : 'primär jämförelsekälla'})</small></li>
                        ${d.organisation.kvDomMedNLessThanK > 0
                            ? `<li><span class="f-dampad">•varav ${d.organisation.kvDomMedNLessThanK} grupp${d.organisation.kvDomMedNLessThanK === 1 ? '' : 'er'} med n &lt; ${kTroskel()} (inkluderade ändå — ingen k-mask i denna analys)</span></li>`
                            : ''}
                        ${d.organisation.exempelKvDom.length
                            ? `<li class="marg-t-4"><small class="f-dampad">Topp 3: ${d.organisation.exempelKvDom.map(esc).join(' · ')}</small></li>`
                            : ''}
                    </ul>
                </div>
                <div class="rund-6 pad-12 ${statOK ? 'ruta-ok' : 'ruta-varning'}">
                    <strong>jämförelsestatistiken</strong> ${statusMarke(statOK ? 'ok' : 'varning')}
                    <ul class="lh-1_6 marg-6-0-0 pad-v-18">
                        <li>Totalt inlästa rader: <strong>${d.statistik.totalRader.toLocaleString('sv-SE')}</strong></li>
                        <li>Lokal könsdata: <strong>${d.statistik.harLokalKonsdata ? 'ja' : `nej — nationell könsfördelning ur ${esc(skrKallaKort())} som reserv`}</strong></li>
                        <li>Klassificering:
                            <strong class="farg-ok">${d.statistik.klass.ickeKv} inte kvinnodominerade</strong>
                            (varav ${d.statistik.klass.blandat} blandade${lvJamforelse() === 'mansdominerade' ? ', som inte används med filtret mansdominerade' : ''}),
                            ${d.statistik.klass.kvDom} kvinnodominerade,
                            ${d.statistik.klass.oklassificerad} oklassificerade</li>
                        <li>Källa: ${d.statistik.klassKalla.lokal} lokal, ${d.statistik.klassKalla.nationell} nationell statistik (SKR)</li>
                        ${d.statistik.exempelIckeKv.length
                            ? `<li class="marg-t-4"><small class="f-dampad">Exempel på ${T.jamforelse.fl}: ${d.statistik.exempelIckeKv.map(esc).join(' · ')}</small></li>`
                            : ''}
                    </ul>
                </div>
            </div>
            ${jämförOK ? `
                <div class="bak-accent-yta rund-4 fs-sm marg-t-10 pad-10-12">
                    <strong>Jämförelse</strong>:
                    ${_lvPoang(result) ? '' : `${d.jämförelse.gemensammaBas} gemensamma ${T.niva.fl},`}
                    ${d.jämförelse.möjligaPar} möjliga par,
                    varav <strong>${d.jämförelse.statHögre} där ${termText('{jamforelse.bf.s}')} median är högre</strong> än ${termText('{enhet.bf.s:kvinnodominerad}')}
                    (${d.jämförelse.statLägreEllerLika} där ${T.jamforelse.bf} ≤ organisation — visas ej, inget problem med likvärdigt arbete).
                    <br><span class="f-dampad">Flaggade par: <strong>${d.jämförelse.internaPar}</strong> interna (organisation mot organisation),
                    ${d.jämförelse.kravProxy === 'poäng' ? 'inga externa: med poäng jämförs bara organisationens egna' : `<strong>${d.jämförelse.externaPar}</strong> externa (mot jämförelsestatistiken)`}${d.jämförelse.basMedExternFallback > 0 ? ` — ${d.jämförelse.basMedExternFallback} ${termFras(T.enhet, d.jämförelse.basMedExternFallback === 1 ? 'en' : 'fl', { adjektiv: 'kvinnodominerad' })} (i ${termArtikel(T.niva)} ${T.niva.en}) hade ${termAdjektiv({ utrum: 'ingen', neutrum: 'inget', plural: 'inga' }, T.enhet)} ${T.enhet.en} att jämföra med i organisationen och jämfördes i stället med jämförelsestatistiken` : ''}.</span>
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
                Steg 1 — Organisationens kvinnodominerade ${T.enhet.fl} (${result.orgKvDom.length} st)
            </summary>
            <div class="pad-10-0">
                ${result.orgKvDom.length
                    ? `<div class="table-responsive"><table class="data-table st-088">
                        <thead><tr><th>#</th><th>${termStor(T.enhet.en)}</th><th>BAS</th><th class="t-hoger">Antal</th><th class="t-hoger">% kvinnor</th><th class="t-hoger" title="Andel kvinnor med ${T.enhet.bf} enligt SKR:s personalstatistik (kommuner, regioner eller båda efter organisationstypen) — ett referensvärde">% kvinnor, SKR</th><th class="t-hoger">Medianlön</th></tr></thead>
                        <tbody>${orgTblRows}</tbody>
                    </table></div>`
                    : `<p class="farg-dampad pad-14">Inga kvinnodominerade ${T.enhet.fl} hittades i organisationens data. Kontrollera att <strong>Kön</strong>-kolumnen är korrekt mappad och att kvinnotröskeln (${cfg.kvinnoTrosholdPct} %) inte är för hög.</p>`}
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
            <td>${konsklassOrd(g.klass)}</td>
            <td class="farg-dampad ta-hoger">${_lvSkrPct(g.aid)}</td>
            <td class="t-hoger">${fmtKr(g.median)}</td>
        </tr>`).join('');
    const internTblHtml = `
        <details class="mb-14" open>
            <summary class="bak-upphojd rund-6 pekare fw-600 pad-10-14">
                Steg 2a — Organisationens interna ${T.jamforelse.fl} (${result.orgIckeKv.length} st) <small class="farg-dampad fw-400">— ${_lvPoang(result) ? 'den enda jämförelsekällan med poäng' : 'primär jämförelsekälla'}</small>
            </summary>
            <div class="pad-10-0">
                ${result.orgIckeKv.length
                    ? `<div class="table-responsive"><table class="data-table st-088">
                        <thead><tr><th>#</th><th>${termStor(T.enhet.en)}</th><th>BAS</th><th class="t-hoger">Antal</th><th class="t-hoger">% kvinnor</th><th title="Mansdominerad eller blandad, efter vald definition av kvinnodominerat">Klass</th><th class="t-hoger" title="Andel kvinnor med ${T.enhet.bf} enligt SKR:s personalstatistik (kommuner, regioner eller båda efter organisationstypen) — ett referensvärde">% kvinnor, SKR</th><th class="t-hoger">Medianlön</th></tr></thead>
                        <tbody>${internTblRows}</tbody>
                    </table></div>`
                    : `<p class="farg-dampad pad-14">Organisationen har inga ${T.jamforelse.fl} (${jamforelseGransText()}). Jämförelsen faller då tillbaka på jämförelsestatistiken (Steg 2b).</p>`}
            </div>
        </details>`;

    // ====== Sektion 2b: jämförelsestatistikens yrken som inte är kvinnodominerade (fallback) ======
    const statTblRows = result.statIckeKv.map((g, i) => `
        <tr>
            <td>${i + 1}</td>
            <td><strong>${esc(g.aid)}</strong>${g.label && g.label !== g.aid ? ' ' + esc(g.label) : ''}</td>
            <td>${esc(g.bas)}</td>
            <td class="t-hoger">${svPct(g.kvAndel, 1)}</td>
            <td>${konsklassOrd(g.klass)}</td>
            <td class="t-mitt"><span class="rund-8 fs-xs pad-1-6 ${g.källa === 'lokal' ? 'bricka-ok' : 'bricka-varning'}">${g.källa === 'lokal' ? 'Statistiken' : 'SKR'}</span></td>
            <td class="t-hoger">${fmtKr(g.median)}</td>
            <td class="farg-dampad ta-hoger">${g.nKv != null ? `${g.nKv}/${g.nMa}` : '—'}</td>
        </tr>`).join('');
    const statTblHtml = `
        <details class="mb-14" open>
            <summary class="bak-upphojd rund-6 pekare fw-600 pad-10-14">
                Steg 2b — jämförelsestatistikens ${T.enhet.fl} som inte är kvinnodominerade (${result.statIckeKv.length} st) <small class="farg-dampad fw-400">— ${d.jämförelse.kravProxy === 'poäng' ? 'används inte med arbetsvärderingspoäng, eftersom statistiken saknar poäng' : 'extern fallback per BAS'}</small>
            </summary>
            <div class="pad-10-0">
                ${result.statIckeKv.length
                    ? `<div class="table-responsive"><table class="data-table st-088">
                        <thead><tr><th>#</th><th>${termStor(T.enhet.en)}</th><th>BAS</th><th class="t-hoger">% kvinnor</th><th title="Mansdominerad eller blandad, efter vald definition av kvinnodominerat">Klass</th><th class="t-mitt">Källa</th><th class="t-hoger">Medianlön</th><th class="t-hoger" title="Antal kvinnor / män i jämförelsestatistiken (om den har könsfördelning)">Kv/Mä</th></tr></thead>
                        <tbody>${statTblRows}</tbody>
                    </table></div>`
                    : `<p class="farg-dampad pad-14">${d.jämförelse.kravProxy === 'poäng' && d.statistik.totalRader === 0
                        ? 'Ingen jämförelsestatistik inläst. Med arbetsvärderingspoäng används den inte i paren, eftersom den saknar poäng.'
                        : d.statistik.totalRader === 0
                        ? termText('Ingen jämförelsestatistik inläst (valfri). Med en inläst används dess {enhet.fl} i de {niva.fl} där organisationen saknar {jamforelse.fl} — läs in den under <a href="#" data-go-to-tab="filer">Filer och kvalitet</a>.')
                        : (lvJamforelse() === 'mansdominerade'
                            ? termText('Inga mansdominerade {enhet.fl} hittades i jämförelsestatistiken.')
                            : termText('Inga {enhet.fl} som inte är kvinnodominerade hittades i jämförelsestatistiken: alla {kod.fl} klassificerades som kvinnodominerade eller saknar könsfördelning.'))}</p>`}
            </div>
        </details>`;

    // ====== Sektion 4: § 3:10-kandidatpar (huvudtabellen) ======
    const källBadge = p => {
        if (p.jamforKalla === 'intern') return `<span class="bak-ok-bg rund-8 farg-ok fs-xs pad-1-6" title="Ur organisationens egna löner (jämförelse inom organisationen)">intern</span>`;
        if (p.maKlassKort === 'lokal') return `<span class="bak-varning-bg rund-8 farg-varning fs-xs pad-1-6" title="jämförelsestatistiken, egen könsfördelning">Statistiken</span>`;
        return `<span class="bak-varning-bg rund-8 farg-varning fs-xs pad-1-6" title="jämförelsestatistiken; könsfördelningen ur den nationella statistiken (${esc(skrKallaKort())})">nationell</span>`;
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
        return `<span title="${termText('{Jamforelse.bf.s} median omräknad till {enhet.bf.s:kvinnodominerad} åldersfördelning')}: ${fmtKr(j.medianJusterad)} — skillnad ${fmtKr(j.gapKr)}. Medelålder ${_lvAlderText(p.kvMedelAlder)} mot ${_lvAlderText(p.maMedelAlder)} år.">${svPct(j.gapPct, 1)}</span>`;
    };
    const parRows = result.pairs.map((p, i) => `
        <tr>
            <td>${i + 1}</td>
            <td><strong>${esc(p.kvAid)}</strong>${p.kvLabel && p.kvLabel !== p.kvAid ? ' ' + esc(p.kvLabel) : ''}<br><small class="f-dampad lv-under"${_lvSkrKort(p.kvAid) ? ` title="Andel kvinnor med ${T.enhet.bf} nationellt (${esc(skrKallaKort())}):${esc(_lvSkrKort(p.kvAid).replace(/[()]|SKR/g, ''))}"` : ''}>BAS ${esc(p.kvBas)} · ${svPct(p.kvKvinnoPct, 0)} kv<span class="bara-export">${_lvSkrKort(p.kvAid)}</span> · n=${p.kvN}</small></td>
            <td class="t-hoger">${fmtKr(p.kvMedian)}</td>
            <td><strong>${esc(p.maAid)}</strong>${p.maLabel && p.maLabel !== p.maAid ? ' ' + esc(p.maLabel) : ''}<br><small class="f-dampad lv-under">BAS ${esc(p.maBas)}${_lvPoang(result) ? '' : ` · ${källBadge(p)}`}${p.maN != null ? ` · n=${p.maN}` : ''}</small></td>
            <td class="t-hoger">${p.kvN} / ${p.maN != null ? p.maN : '–'}</td>
            <td class="lv-konsandel" data-sort-value="${p.maKvAndel ?? ''}">${svPct(p.maKvAndel, 0)}<br><small class="f-dampad">${konsklassOrd(p.maKlass)}</small></td>
            <td class="t-hoger">${fmtKr(p.maMedian)}</td>
            <td class="t-hoger"><strong>${fmtKr(p.gapKr)}</strong></td>
            <td class="t-hoger"><strong>${svPct(p.gapPct, 1)}</strong></td>
            <td class="lv-ki-cell fs-xs ta-hoger">${ciCell(p)}</td>
            <td class="t-hoger">${justCell(p)}</td>
            <td class="t-hoger">${Math.round(p.allvarsindex).toLocaleString('sv-SE')}</td>
            <td class="t-mitt"><button class="btn-evidence" data-lv-pair="${i}" type="button" title="Visa beräkningen" aria-label="Visa beräkningen för par ${i+1}">${ikon('sok')}</button></td>
        </tr>`).join('');
    let parTblHtml;
    if (!jämförOK) {
        parTblHtml = `
            <div class="insight-box warn mb-14">
                <strong>${ikon('statusVarning')} Jämförelsen kan inte genomföras</strong>
                <p class="fs-md lh-1_55 marg-8-0">
                    Analysen kräver kvinnodominerade ${T.enhet.fl} <em>och</em> minst en jämförelsekälla:
                    ${!orgOK ? '<br>• <strong>Organisationen saknar kvinnodominerade grupper.</strong> Se Steg 1 ovan.' : ''}
                    ${(orgOK && !internOK && !statOK) ? termText('<br>• <strong>Inga {jamforelse.fl} finns</strong> — varken interna {enhet.fl} som inte är kvinnodominerade (Steg 2a) eller jämförelsestatistiken (Steg 2b).') : ''}
                </p>
            </div>`;
    } else if (!result.pairs.length) {
        parTblHtml = `
            <div class="insight-box info mb-14">
                <strong>${ikon('info')} Inga kandidatpar hittades</strong>
                <p class="fs-md marg-8-0">
                    Organisationen har ${result.orgKvDom.length} kvinnodominerade grupper och
                    ${_lvPoang(result) ? `${result.orgIckeKv.length} ${T.jamforelse.fl}` : `${result.orgIckeKv.length} interna och ${_lvStatJamfor(result).length} externa ${T.jamforelse.fl}`}.
                    ${_lvPoang(result) ? `Ingen av ${T.jamforelse.bfl} med lika eller lägre poäng har` : `Inom de ${d.jämförelse.gemensammaBas} gemensamma ${T.niva.bfl} har ingen av
                    ${T.jamforelse.bfl}`} högre lön än organisationens kvinnodominerade ${T.enhet.fl}.
                    ${cfg.minGapPct > 0 ? `(Bara par med minst ${cfg.minGapPct} % skillnad visas, efter valet i Inställningar.)` : ''}
                </p>
            </div>`;
    } else {
        parTblHtml = `
            <div class="table-responsive">
                <table id="likvardighet-table" class="data-table">
                    <thead>
                        <tr>
                            <th data-kol="nr">#</th>
                            <th data-kol="${LV_KOL_KVDOM}" title="${termText('{Enhet.en:kvinnodominerad} i organisationen (faktisk könsfördelning).')}">Kvinnodom. ${T.enhet.en} (${esc(orgNamn('org.'))})</th>
                            <th data-kol="median" title="Median månadslön i organisationens grupp.">Median ${esc(orgNamn('org.'))}</th>
                            <th data-kol="${LV_KOL_JAMF}" title="${termText(_lvPoang(result) ? '{Jamforelse.en}: {enhet.art} {enhet.en} i organisationen som inte är {enhet.adj:kvinnodominerad} och har lika eller lägre poäng.' : '{Jamforelse.en}: {enhet.art} {enhet.en} i organisationen som inte är {enhet.adj:kvinnodominerad} (intern), annars jämförelsestatistiken (extern).')}">${termText('{Jamforelse.en}')}</th>
                            <th data-kol="antal" title="${termText('Antal personer med {enhet.bf:kvinnodominerad} och med {jamforelse.bf} (– när jämförelsestatistiken inte anger antal).')}">Antal (kvinnodom. / jämf.)</th>
                            <th data-kol="konsandel" title="${termText('Könsandel i {jamforelse.bf} och dess klass: mansdominerad eller blandad.')}" data-export-label="Könsandel jämf. (% kvinnor)">Könsandel</th>
                            <th data-kol="medianjamf" title="${termText('Median månadslön i {jamforelse.bf}.')}">Median jämf.</th>
                            <th data-kol="gapkr" title="${termText('Skillnad i kronor ({jamforelse.en} − organisation).')}">Skillnad (kr)</th>
                            <th data-kol="gappct" title="Skillnad i procent av organisationens median.">Skillnad (%)</th>
                            <th data-kol="ki" title="95 % bootstrap-konfidensintervall på medianskillnaden. Ligger hela intervallet över 0 är skillnaden statistiskt säker.">95 % KI</th>
                            <th data-kol="justerad" title="${termText('Skillnaden när {jamforelse.bf.s} lön räknats om till {enhet.bf.s:kvinnodominerad} åldersfördelning (log(lön) ~ ålder i {jamforelse.bf}).')} Den råa skillnaden är det lagen prövar; den här visar hur mycket som kan bero på åldersstruktur. Bara interna par." data-export-label="Justerad för ålder (%)">Justerad för ålder</th>
                            <th data-kol="paverkan" title="${termText('Skillnaden i kronor gånger antalet personer med {enhet.bf:kvinnodominerad}, per månad')}">Summa för gruppen (kr/mån)</th>
                            <th data-kol="bevis">Beräkning</th>
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
    // Definitionens värden 'do' och 'scb' är historiska nycklar; valen heter efter lydelsen och nycklarna står kvar,
    // så att sparade konfigurationsfiler fortsätter att läsas (ADR-72).
    const controlsHtml = `
        <div class="card mb-14">
            <div class="controls-row mitt bryt gap-18">
                <div class="mitt rad-inline gap-8">
                    <label for="lv-kvinno-thr">Kvinnotröskel:</label>
                    <input type="number" id="lv-kvinno-thr" min="50" max="70" step="5" value="${cfg.kvinnoTrosholdPct}" class="form-select bredd-64">
                    <span>%</span>
                </div>
                <div class="mitt rad-inline gap-8">
                    <label for="lv-kv-definition">Kvinnodominerat när andelen kvinnor är:</label>
                    <select id="lv-kv-definition" class="form-select bredd-auto" title="Gäller hela verktyget: kandidatparen, tabellerna per ${T.kod.en} och ${T.niva.en}, Lika arbete, Löneöversyn och Lönepolitik. Gränsen är kvinnotröskeln; välj om en grupp som ligger precis på gränsen räknas som kvinnodominerad. Lagen anger ingen siffra.">
                        <option value="do"${aidbasDefinition() === 'do' ? ' selected' : ''}>${esc(_aidbasDefinitionNamn('do', cfg.kvinnoTrosholdPct))}</option>
                        <option value="scb"${aidbasDefinition() === 'scb' ? ' selected' : ''}>${esc(_aidbasDefinitionNamn('scb', cfg.kvinnoTrosholdPct))}</option>
                    </select>
                </div>
                <div class="mitt rad-inline gap-8">
                    <input type="checkbox" id="lv-bara-mansdominerade"${lvJamforelse() === 'mansdominerade' ? ' checked' : ''}>
                    <label for="lv-bara-mansdominerade" title="Av som standard: då jämförs med alla ${T.enhet.fl} som inte är kvinnodominerade, både mansdominerade och blandade.">Jämför bara med mansdominerade ${T.enhet.fl}</label>
                </div>
                <div class="mitt rad-inline gap-8">
                    <label for="lv-min-gap">Visa bara par med minst</label>
                    <input type="number" id="lv-min-gap" min="0" max="50" step="1" value="${cfg.minGapPct}" class="form-select bredd-64">
                    <span>% skillnad (0 = alla)</span>
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
                <button type="button" class="chart-export-btn" aria-expanded="false" aria-controls="lv-export-meny" aria-label="Exportera tabellen med kandidatparen">Exportera tabellen</button>
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
    const std = { kvinnoTrosholdPct: 60, minGapPct: 0, topN: 20 };   // samma som utgångsläget i 12-tillstand.js
    const anpassat = cfg.kvinnoTrosholdPct !== std.kvinnoTrosholdPct || cfg.minGapPct !== std.minGapPct || cfg.topN !== std.topN || aidbasDefinition() !== 'do' || lvJamforelse() !== 'alla';
    // Fliken visar de största paren (Visa max); finns fler står en knapp som visar alla (ADR-61).
    const antal = lvParAntal(result);
    const visaAllaHtml = (jämförOK && antal.totalt > result.pairs.length) ? `
        <p class="text-dampad-xs marg-8-0">Tabellen visar de ${svTal(result.pairs.length, 0)} största skillnaderna av ${svTal(antal.totalt, 0)} par.
            <button type="button" id="lv-visa-alla" class="btn btn-secondary btn-sm">Visa alla ${svTal(antal.totalt, 0)} par</button></p>` : '';
    _lvRitaTopp(result);
    wrap.innerHTML =
        felHtml +
        `<div class="card marg-0-0-14">
            <h2 class="fs-md marg-0-0-4">Krav mot lön — alla ${T.enhet.fl}</h2>
            <p class="text-dampad-xs marg-0-0-8">En punkt per ${T.enhet.en}: arbetets krav vågrätt, medianlönen lodrätt. Kvinnodominerade grupper som ligger under linjen har lägre lön än kraven brukar ge i organisationen — de är värda att titta närmare på.</p>
            <div id="chart-likvardighet-krav"></div>
            <p id="lv-krav-not" class="text-dampad-xs marg-8-0-0"></p>
        </div>` +
        `<p class="avsnitt-rubrikrad">Fördjupning</p>` +
        avsnitt('par', 'Par att titta närmare på', termText(_lvPoang(result) ? '{Enhet.fl:kvinnodominerad} mot {jamforelse.fl} med lika eller lägre poäng och högre lön' : '{Enhet.fl:kvinnodominerad} mot {jamforelse.fl} med högre lön i samma {niva.en}'),
            antal.totalt > result.pairs.length ? `${result.pairs.length} av ${antal.totalt} par` : `${result.pairs.length} par`,
        exportHtml +
        ((jämförOK && result.pairs.length) ? `
        <div class="card mb-14">
            <div class="chart-header rad-bryt-mitt gap-12 mellan marg-b-8">
                <h3 class="fs-md marg-0">Kandidatparen i kronor</h3>
                <span class="text-dampad-xs">Ett par per rad: avståndet mellan punkterna är skillnaden, störst först</span>
            </div>
            <div id="chart-likvardighet-heatmap"></div>
        </div>` : '') +
        parTblHtml + visaAllaHtml +
        _lagreKravHtml(result)) +
        avsnitt('underlag', termText('{Enhet.bfl} bakom jämförelsen'), termText('Steg för steg: {enhet.bfl:kvinnodominerad} och {jamforelse.bfl}'),
            `${result.orgKvDom.length} kvinnodominerade, ${result.orgIckeKv.length + _lvStatJamfor(result).length} att jämföra med`,
            orgTblHtml + internTblHtml + statTblHtml) +
        avsnitt('installningar', 'Inställningar', termText('Kvinnotröskel, definition av kvinnodominerat, vilka {enhet.fl} som jämförs, minsta skillnad och antal par. Standardvärdena räcker för de flesta.'),
            anpassat ? 'Anpassade värden' : 'Standardvärden', controlsHtml) +
        avsnitt('analys', 'Så fungerar analysen', 'Metoden, och vad verktyget ser i underlaget', '', introHtml + diagnostikHtml) +
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
            state.likvardighet.result = null;   // paren räknas med det nya värdet
            renderLikvardighet();
        });
    };
    onNumChange('lv-kvinno-thr', 'kvinnoTrosholdPct', 50, 70);
    onNumChange('lv-min-gap',    'minGapPct',         0, 50);
    onNumChange('lv-top-n',      'topN',              10, 500);
    document.getElementById('lv-visa-alla')?.addEventListener('click', () => {
        state.likvardighet.topN = Math.max(10, antal.totalt);
        state.likvardighet.result = null;
        renderLikvardighet();
    });
    document.getElementById('lv-kv-definition')?.addEventListener('change', e => {
        state.likvardighet.kvDomDefinition = /** @type {HTMLSelectElement} */ (e.target).value === 'scb' ? 'scb' : 'do';
        state.likvardighet.result = null;
        renderLikvardighet(); renderAidBasLikvardigt();
    });
    document.getElementById('lv-bara-mansdominerade')?.addEventListener('change', e => {
        state.likvardighet.jamforelse = /** @type {HTMLInputElement} */ (e.target).checked ? 'mansdominerade' : 'alla';
        state.likvardighet.result = null;
        renderLikvardighet(); renderAidBasLikvardigt();
    });
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
    // Grundvyn gömmer det sekundära; talen finns också i beviset (förstoringsglaset i kolumnen Bevis).
    if (typeof flerKolumner === 'function') flerKolumner('likvardighet-table', LV_DOLDA_KOLUMNER, 'likvardighet');
    if (document.getElementById('likvardighet-lagre-krav-table')) {
        if (typeof enableTableSort === 'function') enableTableSort('likvardighet-lagre-krav-table');
        if (typeof addTableExportTools === 'function') addTableExportTools('likvardighet-lagre-krav-table', 'likvardighet_lagre_krav');
        if (typeof flerKolumner === 'function') flerKolumner('likvardighet-lagre-krav-table', LV_LAGRE_KRAV_DOLDA_KOLUMNER, 'lvLagreKrav');
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
/**
 * Antalet par före Visa max-urvalet (lib: parAntal). Ett resultat utan räkningen (felvägen) räknas ur de par som finns.
 * @param {any} result
 * @returns {{totalt:number, overDirektiv:number, sakra:number}}
 */
function lvParAntal(result) {
    if (result && result.parAntal) return result.parAntal;
    const par = (result && result.pairs) || [];
    return { totalt: par.length,
             overDirektiv: par.filter(p => p.maMedian > 0 && _stsDirektiv(p.kvMedian / p.maMedian * 100)).length,
             sakra: par.filter(p => p.gapCI && p.gapCI.lo != null && p.gapCI.lo > 0).length };
}
/** Flikens topp: urvalsraden och slutsatserna. Talen är de som tabellerna i fliken visar (paren är redan prövade mot tröskeln). */
function _lvRitaTopp(result) {
    const urval = document.getElementById('lv-urval'), host = document.getElementById('lv-slutsatser');
    if (!urval || !host) return;
    if (!result) { urval.textContent = ''; host.innerHTML = ''; return; }
    urval.innerHTML = `<span><strong>Hela urvalet</strong> · ${svTal(getData().length, 0)} personer</span>${kTroskelLank()}`;
    const par = result.pairs, antal = lvParAntal(result);
    const storst = par.reduce((a, p) => (!a || p.gapPct > a.gapPct ? p : a), null);
    // Med arbetsvärderingspoäng jämförs bara organisationens egna (ADR-76).
    const statJmf = _lvStatJamfor(result), poang = result.diagnostik?.jämförelse?.kravProxy === 'poäng';
    const kallor = poang ? 'bara organisationens egna (jämförelsestatistiken har inga poäng)' : 'egna och ur jämförelsestatistiken';
    host.innerHTML = _laSlutsats(termText('{Enhet.fl:kvinnodominerad}'), svTal(result.orgKvDom.length, 0), kvDomGransText())
        + _laSlutsats(termText('{Jamforelse.fl}'), svTal(result.orgIckeKv.length + statJmf.length, 0), poang ? 'egna' : `${result.orgIckeKv.length} egna, ${statJmf.length} ur statistiken`, false,
            lvJamforelse() === 'mansdominerade'
                ? `Bara mansdominerade ${T.enhet.fl} (${jamforelseGransText()}), ${kallor}`
                : `${termStor(T.enhet.fl)} som inte är kvinnodominerade (${jamforelseGransText()}): mansdominerade och blandade, ${kallor}`)
        // Alla par räknas, också de som Visa max inte visar; direktivnivån 5 % syns utan att dölja paren under den (ADR-61).
        + _laSlutsats('Par att titta närmare på', svTal(antal.totalt, 0),
            antal.totalt ? `varav ${svTal(antal.overDirektiv, 0)} med ${_STS_DIR_KOLUMN.toLowerCase()}, ${svTal(antal.sakra, 0)} med säker skillnad` : termText('Inga {jamforelse.fl} ligger högre'), false,
            antal.totalt ? `${_STS_DIR_KOLUMN}: ${termText('{enhet.bf.s:kvinnodominerad} medianlön är minst 5 % under {jamforelse.bf.s}')}. ${_STS_DIR_TIPS}` : '')
        // Nyckeltalen visar kvinnors lön i % av mäns (här: det kvinnodominerade yrkets median i % av jämförelseyrkets);
        // partabellen behåller sin skillnad, hur mycket mer jämförelseyrket tjänar, och verktygstipset säger hur de hänger ihop.
        + (storst ? _laSlutsats('Lägst lön i % av jämförelsen', svPct(storst.kvMedian / storst.maMedian * 100, 1), `${storst.kvLabel || storst.kvAid} i % av ${storst.maLabel || storst.maAid}`, false,
            `${termText('{Enhet.bf.s:kvinnodominerad} medianlön i % av {jamforelse.bf.s}. I tabellen över paren står samma skillnad som hur mycket högre {jamforelse.bf.s} medianlön är')}: ${svPct(storst.gapPct, 1)}.`) : '');
}

// ---- Krav mot lön: en punkt per yrkesgrupp ----------------------------------
// Grupperna räknas i src/lib/likvardighet.js (kravGrupper, här _lvKravGrupper).
const _LV_KRAV_SERIER = [
    { dominans: 'kvinnodominerad', serie: 'Kvinnodominerad', farg: () => PALETTE.kon.kvinna, symbol: 'cirkel' },
    { dominans: 'mansdominerad', serie: 'Mansdominerad', farg: () => PALETTE.kon.man, symbol: 'triangelHoger' },
    { dominans: 'blandad', serie: 'Blandad', farg: () => PALETTE.semantic.neutral, symbol: 'cirkel' }
];
function _lvKravFigur({ medPoang, grupper }) {
    const kr = v => _figTalformat(v, 'kr');
    const rang = _lvBasRangFn(grupper.map(g => g.bas));
    const basOrdning = [...new Set(grupper.map(g => g.bas))].sort((a, b) => rang(a) - rang(b)).map(b => 'BAS ' + b);
    const x = g => (medPoang ? g.krav : 'BAS ' + g.bas);
    // Nivån kraven brukar ge: med poäng en rät linje (minsta kvadrat över grupperna), annars medianen av
    // gruppmedianerna per BAS-intervall.
    let niva, linje;
    if (medPoang) {
        const reg = Stat.linjarRegression(grupper.map(g => [g.krav, g.median]));
        // Utan spridning i poäng (null) är minsta kvadrat-nivån medelvärdet av gruppmedianerna, och ingen linje ritas.
        const medel = grupper.reduce((s, g) => s + g.median, 0) / grupper.length;
        niva = g => (reg ? reg.m * g.krav + reg.b : medel);
        const xs = grupper.map(g => g.krav), a = Math.min(...xs), b = Math.max(...xs);
        linje = reg ? [{ x: a, y: reg.m * a + reg.b }, { x: b, y: reg.m * b + reg.b }] : [];
    } else {
        const perBas = new Map();
        for (const g of grupper) { if (!perBas.has(g.bas)) perBas.set(g.bas, []); perBas.get(g.bas).push(g.median); }
        niva = g => Stat.median(perBas.get(g.bas));
        linje = basOrdning.map(b => ({ x: b, y: Stat.median(perBas.get(b.slice(4))), bas: b.slice(4) }));   // en hörnpunkt per intervall: följer urvalet
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
    const lager = _LV_KRAV_SERIER.map(s => ({ marke: 'punkt', serie: s.serie, farg: s.farg(), symbol: s.symbol, opacitet: 0.8, etikettLage: 'undvik',
        data: grupper.filter(g => g.dominans === s.dominans).map(g => ({ x: x(g), y: Math.round(g.median), ...(sidled.has(g) ? { forskjutning: sidled.get(g) } : {}), storlek: storlek(g.n), namn: g.namn, bas: g.bas, sektor: _aidSektorsnamn(g.aid), n: g.n, andelKv: g.andelKv,
            avstand: Math.round(g.median - niva(g)), uppskattad: !!g.uppskattad, krav: g.krav, markering: markeringFor(g.bas, g.aid),
            ...(under.includes(g) ? { etikett: g.namn } : {}) })),
        tips: d => [[`${d.namn} · BAS ${d.bas}`], ['Medianlön', kr(d.y)], [d.avstand < 0 ? 'Under nivån' : 'Över nivån', kr(Math.abs(d.avstand))],
                    ['Andel kvinnor', _figTalformat(d.andelKv, 'pct')], ['Antal', String(d.n)],
                    ...(medPoang ? [[d.uppskattad ? `Poäng (efter ${T.niva.bf})` : 'Arbetsvärderingspoäng', _figTalformat(d.krav, 'antal')]] : [])]
    })).filter(l => l.data.length);
    if (linje.length >= 2) lager.unshift({ marke: 'linje', serie: medPoang ? 'Nivå efter kraven (trend)' : `Nivå per ${T.niva.en}`, farg: PALETTE.semantic.mork, streck: 'streckad', tjocklek: 1.5, data: linje });
    return { beskrivning: `En punkt per ${T.enhet.en}: arbetets krav (${medPoang ? 'arbetsvärderingspoäng' : T.niva.en}) mot gruppens medianlön, med form och färg efter könsdominans (kvinnodominerad vid ${kvDomGransText().replaceAll('%', 'procent')}). Den streckade linjen är nivån kraven brukar ge i organisationen.`,
        urval: [URVAL.bas, URVAL.sektor, URVAL.antal], x: medPoang ? { skala: 'linjar', titel: 'Arbetsvärderingspoäng' } : { skala: 'band', titel: `${termStor(T.niva.en)} (stigande krav)`, ordning: basOrdning },
        y: { skala: 'linjar', titel: 'Gruppens medianlön', format: 'kr' }, hojd: 420, lager };
}
function renderLikvardighetKrav() {
    const el = document.getElementById('chart-likvardighet-krav');
    if (!el) return;
    const av = state.arbetsvardering, k = kTroskel();
    const u = _lvKravGrupper(state.data || [], { k, definition: aidbasDefinition(), grans: aidbasGrans(), poangByKey: av && av.byKey && av.byKey.size ? av.byKey : null });
    const not = document.getElementById('lv-krav-not');
    if (u.grupper.length < 3) {
        rensaFigur(el);
        el.innerHTML = `<p class="text-dampad-sm marg-8-0">För få ${T.enhet.fl}${k > 1 ? ` med minst ${k} personer` : ''} för att visa krav mot lön.</p>`;
        if (not) not.textContent = '';
        return;
    }
    const figur = _lvKravFigur(u);
    const under = figur.lager.filter(l => l.serie === 'Kvinnodominerad').flatMap(l => l.data).filter(d => d.avstand < 0).length;
    ritaFigur(el, figur, { exportAnteckning: `${under} ${under === 1 ? 'kvinnodominerad grupp ligger' : 'kvinnodominerade grupper ligger'} under nivån` });
    const uppskattade = u.grupper.filter(g => g.uppskattad).length;
    if (not) not.textContent = `${k > 1 ? `Bara ${T.enhet.fl} med minst ${k} personer. ` : ''}Punktens storlek följer antalet personer.`
        + (uppskattade ? ` ${uppskattade} ${uppskattade === 1 ? 'grupp saknar' : 'grupper saknar'} poäng i arbetsvärderingen och är placerade efter medianpoängen för de värderade grupperna i samma ${T.niva.en}.` : '')
        + (u.utanPlats.length ? ` Kan inte placeras (ingen värderad grupp i samma ${T.niva.en}): ${u.utanPlats.map(g => g.namn).join(', ')}.` : '');
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
// Filtren döljer hela par: det kvinnodominerade yrkets BAS-intervall, löneskillnaden (tipsets Skillnad) och antalet i det
// kvinnodominerade yrket (n i tabellen). Ett par samlar två yrken, men varje fält har ett enda värde per par.
const LV_PAR_ANTAL = Object.freeze({ typ: 'intervall', falt: 'n', namn: termText('Antal med {enhet.bf:kvinnodominerad}'), format: 'antal', etikett: termText('{v} med {enhet.bf:kvinnodominerad}') });
function _lvParFigur(pairs, max = 14) {
    const top = pairs.slice().sort((a, b) => (b.allvarsindex || 0) - (a.allvarsindex || 0)).slice(0, max);
    const namn = p => `${_rfKorta(String(p.kvLabel), 22)} mot ${_rfKorta(String(p.maLabel), 22)}`;
    const rader = [], sedda = new Set();
    for (const p of top) { const y = namn(p); if (!sedda.has(y) && isFinite(p.kvMedian) && isFinite(p.maMedian)) { sedda.add(y); rader.push({ p, y }); } }
    const kr = v => _figTalformat(v, 'kr');
    const parFalt = p => ({ ...(p.kvBas != null && p.kvBas !== '' ? { bas: String(p.kvBas) } : {}), ...(isFinite(p.gapPct) ? { gap: +p.gapPct.toFixed(1) } : {}), ...(p.kvN > 0 ? { n: p.kvN } : {}) });
    const tips = ({ p }) => [[`${p.kvLabel} (BAS ${p.kvBas})`], ['Median', kr(p.kvMedian)], [`${p.maLabel} (BAS ${p.maBas})`], ['Median', kr(p.maMedian)], ['Skillnad', `${svPct(p.gapPct, 1)} (${kr(p.gapKr)})`]];
    const punkt = (serie, farg, falt, extra = {}) => ({ marke: 'punkt', serie, farg, storlek: 6, ...extra,
        data: rader.map(r => ({ y: r.y, x: Math.round(r.p[falt]), p: r.p, ...parFalt(r.p), ...(extra.etikettLage ? { etikett: svPct(r.p.gapPct, 1) } : {}) })), tips: d => tips(d) });
    return { beskrivning: termText('Kandidatpar i likvärdigt arbete: {enhet.bf.s:kvinnodominerad} och {jamforelse.bf.s} medianlön per par, med skillnaden i procent. Samma par finns i kandidatpar-tabellen nedan.'),
        urval: [{ ...URVAL.bas, namn: termText('{Niva.en} ({enhet.en:kvinnodominerad})') }, URVAL.lonegap, LV_PAR_ANTAL],
        x: { skala: 'linjar', titel: 'Medianlön (kr/månad)', format: 'kr' }, y: { skala: 'band', ordning: rader.map(r => r.y), etikettMax: 48 },
        hojd: Math.max(160, 96 + rader.length * 32),
        lager: [{ marke: 'intervall', riktning: 'liggande', serie: 'Skillnad', farg: PALETTE.semantic.neutral, tjocklek: 2, legend: false,
                  data: rader.map(r => ({ y: r.y, lag: Math.round(Math.min(r.p.kvMedian, r.p.maMedian)), hog: Math.round(Math.max(r.p.kvMedian, r.p.maMedian)), p: r.p, ...parFalt(r.p) })), tips: d => tips(d) },
                punkt(termText('{Enhet.en:kvinnodominerad}'), PALETTE.kon.kvinna, 'kvMedian'), punkt(termText('{Jamforelse.en}'), PALETTE.kon.man, 'maMedian', { etikettLage: 'hoger' })] };
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
const LV_JUSTERAD_METOD = termText('{Jamforelse.bf.s} lön omräknad till {enhet.bf.s:kvinnodominerad} åldersfördelning: log(lön) = a + b·ålder skattas i {jamforelse.bf} (minst ') + ALDERS_GOLV + ' personer, minst ' + ALDERS_SPRIDNING + termText(' års åldersspridning), lönen prediceras vid varje person med {enhet.bf:kvinnodominerad} och medianen av prediktionerna jämförs med dess median. Den råa skillnaden är det lagen prövar; den justerade visar hur mycket som kan bero på åldersstruktur. Bara interna par; tomt när den inte kan räknas.');

// Kandidatparens rubrik och rader, gemensamma för CSV- och Excel-exporten; `num` formaterar talen för respektive format.
function _lvParRader(pairs, num) {
    const källNamn = p => p.jamforKalla === 'intern' ? 'Intern (organisation)'
        : (p.maKlassKort === 'lokal' ? 'jämförelsestatistiken' : 'SKR:s personalstatistik');
    const rows = [[
        'Nr',
        'Org. AID', `Org. ${T.namn.en}`, 'BAS', 'Org. n', 'Org. % kvinnor', 'Median Org. (kr)',
        'Jämf. AID', `Jämf. ${T.namn.en}`, 'Jämf. % kvinnor', 'Jämf. klass', 'Jämf. n', 'Jämförelsekälla', 'Median Jämf. (kr)',
        'Skillnad (kr)', 'Skillnad (%)', 'Justerad för ålder (%)', 'KI 95% låg (kr)', 'KI 95% hög (kr)', 'Säkerhet', 'Summa för gruppen (kr/mån)',
        'Sakligt skäl — fylls i', 'Status / åtgärd — fylls i'
    ]];
    pairs.forEach((p, i) => {
        const ci = p.gapCI && p.gapCI.lo != null;
        rows.push([
            i + 1,
            p.kvAid || '', p.kvLabel || '', p.kvBas || '', num(p.kvN), num(p.kvKvinnoPct, 1), num(p.kvMedian),
            p.maAid || '', p.maLabel || '', num(p.maKvAndel, 1), konsklassOrd(p.maKlass), num(p.maN),
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
    return rows;
}

// Går alltid genom exportläget (ADR-51): djupräknaren håller skärmen i exportläget tills den sista pågående exporten är klar.
function exportLikvardighetCSV(...a) { return medExportLage(() => _exportLikvardighetCSVExport.apply(null, /** @type {any} */ (a))); }
function _exportLikvardighetCSVExport() {
    const result = likvardighetResultat();
    if (!result || !Array.isArray(result.pairs) || !result.pairs.length) {
        alert(termText('Det finns inga kandidatpar att exportera. Sänk minsta skillnad i fliken, eller kontrollera att lönefilen har kvinnodominerade {enhet.fl}.'));
        return;
    }
    const num = (v, dec) => {
        if (v == null) return '';
        const n = Number(v);
        if (!isFinite(n)) return '';
        return (dec != null && dec > 0) ? n.toFixed(dec).replace('.', ',') : Math.round(n);
    };
    const rows = _lvParRader(result.pairs, num);
    // Lägg till metadata-rader sist (åtskilda från data med tom rad)
    rows.push([]);
    rows.push(['# METADATA']);
    rows.push(['Genererad', new Date().toLocaleString('sv-SE')]);
    rows.push(['Verktyg', 'Öppen lönekartläggning v' + (typeof APP_VERSION !== 'undefined' ? APP_VERSION : '–')]);
    rows.push(['Kvinnotröskel (%)', result.opts.kvinnoTrosholdPct]);
    rows.push(['Kvinnodominerat vid', aidbasDefinitionText()]);
    rows.push([termStor(T.jamforelse.fl), jamforelseGransText()]);
    rows.push(['Minsta skillnad (%)', result.opts.minGapPct]);
    rows.push(['Antal par', result.pairs.length]);
    rows.push(['•varav interna (organisation mot organisation)', result.diagnostik?.jämförelse?.internaPar ?? 0]);
    const poang = _lvPoang(result);
    if (!poang) {   // i poängläget används jämförelsestatistiken inte (ADR-76)
        rows.push(['•varav externa (mot jämförelsestatistiken)', result.diagnostik?.jämförelse?.externaPar ?? 0]);
        rows.push([_lvExternFallbackText(), result.diagnostik?.jämförelse?.basMedExternFallback ?? 0]);
    }
    rows.push(['Klassificeringskälla — jämförelsestatistiken', result.diagnostik?.statistik?.klassKalla?.lokal ?? 0]);
    rows.push(['Klassificeringskälla — SKR:s personalstatistik', result.diagnostik?.statistik?.klassKalla?.nationell ?? 0]);
    rows.push(['KI-metod', poang ? 'Bootstrap B=1000 på bägge individurvalen'
        : 'Bootstrap B=1000; intern = bägge individurvalen, extern = org-löner mot jämförelsestatistikens median']);
    rows.push(['Justerad för ålder', LV_JUSTERAD_METOD]);
    rows.push(['k-anonymitet', 'Tillämpas EJ i denna analys']);
    _downloadCSV(rows, 'lonekartlaggning_likvardighet_' + idagDatum(), { undantag: 'Likvärdigt arbete' });
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
            alert('Exporten kunde inte starta: en del av verktyget saknas i filen. Ladda om sidan; hjälper det inte, hämta verktyget på nytt.');
            return;
        }

        stegnamn = 'hämta result från state';
        const result = likvardighetResultat();
        if (!result) {
            alert('Något gick fel i verktyget. Öppna fliken igen; hjälper det inte, rapportera felet.');
            return;
        }
        if (!Array.isArray(result.pairs) || result.pairs.length === 0) {
            alert(termText('Det finns inga kandidatpar att exportera. Sänk minsta skillnad i fliken, eller kontrollera att lönefilen har kvinnodominerade {enhet.fl}.'));
            return;
        }
        const { pairs } = result;
        const diagnostik = result.diagnostik || {};
        const opts = result.opts || {};
        const poang = _lvPoang(result);   // i poängläget används jämförelsestatistiken inte (ADR-76)

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
        const rows = _lvParRader(pairs, num);
        const sheet = XLSX.utils.aoa_to_sheet(rows);
        // Kolumnbredder — säkert standardattribut
        sheet['!cols'] = [
            { wch: 4 }, { wch: 8 }, { wch: 30 }, { wch: 6 }, { wch: 7 }, { wch: 12 }, { wch: 14 },
            { wch: 8 }, { wch: 30 }, { wch: 12 }, { wch: 14 }, { wch: 7 }, { wch: 20 }, { wch: 14 },
            { wch: 11 }, { wch: 8 }, { wch: 12 }, { wch: 14 }, { wch: 14 }, { wch: 16 }, { wch: 14 },
            { wch: 46 }, { wch: 32 }
        ];
        // Hoppar över !freeze (icke-standard i mini-versionen) och num-format
        // (icke-kritisk kosmetik). Datat står sig utan.
        XLSX.utils.book_append_sheet(wb, sheet, 'Likvärdigt arbete');

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
            [`Likvärdigt arbete — kvinnodominerade ${T.enhet.fl}`, ''],
            ['', ''],
            ['Genererad', new Date().toLocaleString('sv-SE')],
            ['Verktyg', 'Öppen lönekartläggning (v' + (typeof APP_VERSION !== 'undefined' ? APP_VERSION : '–') + ')'],
            ['Aktiv profil', safe(() => state.profile.name)],
            ['Modell', poang
                ? termText('Organisationens kvinnodominerade {enhet.fl} jämförs med organisationens egna {enhet.fl} som inte är kvinnodominerade (mansdominerade och blandade; könsandelen i {jamforelse.bf} står i tabellen) och har lika eller lägre arbetsvärderingspoäng, också i andra {niva.fl}')
                : termText('Organisationens kvinnodominerade {enhet.fl} jämförs inom samma {niva.en} med {enhet.fl} som inte är kvinnodominerade (mansdominerade och blandade; könsandelen i {jamforelse.bf} står i tabellen), i första hand organisationens egna (intern), annars jämförelsestatistiken (extern)')],
            ['', ''],
            ['— PARAMETRAR —', ''],
            ['Kvinnotröskel (%)', safe(() => opts.kvinnoTrosholdPct, '')],
            ['Kvinnodominerat vid', aidbasDefinitionText()],
            [termStor(T.jamforelse.fl), jamforelseGransText()],
            ['Minsta skillnad (%)', safe(() => opts.minGapPct, '')],
            ['Visa max antal par', safe(() => opts.topN, '')],
            ['k-anonymitet', 'Tillämpas EJ i denna analys'],
            ['', ''],
            ['— DIAGNOSTIK —', ''],
            [`Organisationens ${T.enhet.fl} i ${T.niva.fl} totalt`, safe(() => diagnostik.organisation.antalAidxBas, 0)],
            ['Kvinnodominerade i organisationen', safe(() => diagnostik.organisation.kvDomFunna, 0)],
            ['•varav med n < k-tröskel (inkluderade ändå)', safe(() => diagnostik.organisation.kvDomMedNLessThanK, 0)],
            ['Rader i jämförelsestatistiken', safe(() => diagnostik.statistik.totalRader, 0)],
            ['Jämförelsestatistiken har könsfördelning', safe(() => diagnostik.statistik.harLokalKonsdata, false) ? 'Ja' : 'Nej'],
            ['Inte kvinnodominerade i jämförelsestatistiken', safe(() => diagnostik.statistik.klass.ickeKv, 0)],
            ['•varav blandade', safe(() => diagnostik.statistik.klass.blandat, 0)],
            ['Kvinnodominerade i jämförelsestatistiken', safe(() => diagnostik.statistik.klass.kvDom, 0)],
            ['Oklassificerade i jämförelsestatistiken', safe(() => diagnostik.statistik.klass.oklassificerad, 0)],
            ['Klassificering från jämförelsestatistikens könsfördelning', safe(() => diagnostik.statistik.klassKalla.lokal, 0)],
            ['Klassificering från SKR:s personalstatistik', safe(() => diagnostik.statistik.klassKalla.nationell, 0)],
            [`Interna ${T.jamforelse.fl} i organisationen`, safe(() => diagnostik.organisation.ickeKvFunna, 0)],
            ...(poang ? [] : [['Gemensamma BAS', safe(() => diagnostik.jämförelse.gemensammaBas, 0)]]),
            ['Möjliga par', safe(() => diagnostik.jämförelse.möjligaPar, 0)],
            [`•varav ${T.jamforelse.en} > organisation`, safe(() => diagnostik.jämförelse.statHögre, 0)],
            ['Flaggade interna par', safe(() => diagnostik.jämförelse.internaPar, 0)],
            ...(poang ? [] : [   // i poängläget används jämförelsestatistiken inte (ADR-76)
                ['Flaggade externa par (jämförelsestatistiken)', safe(() => diagnostik.jämförelse.externaPar, 0)],
                [_lvExternFallbackText(), safe(() => diagnostik.jämförelse.basMedExternFallback, 0)]]),
            ['Par i utdata', pairs.length],
            ['', ''],
            ['— RÄTTSLIG GRUND —', ''],
            ['Diskrimineringslagen', 'Arbetsgivaren ska analysera om kvinnodominerat arbete har lägre lön än arbete som inte är kvinnodominerat och har likvärdiga eller lägre krav.'],
            ['Mått på kraven', poang
                ? `Organisationens arbetsvärderingspoäng: lika krav inom ±${safe(() => opts.poangBandPct, 5)} %, över BAS-gränserna.`
                : `Jämförelsen sker inom samma ${T.niva.en}; verktyget utgår från att kraven där är likvärdiga.`],
            ['Jämförelsekälla', poang
                ? termText('Organisationens egna {enhet.fl} som inte är kvinnodominerade. Jämförelsestatistiken har inga poäng och används inte.')
                : termText('I första hand organisationens egna {enhet.fl} som inte är kvinnodominerade. Saknas sådana i {niva.art} {niva.en} används jämförelsestatistiken i stället.')],
            ['95 % KI', poang
                ? 'Bootstrap B=1000 på medianskillnaden, med omdragning av bägge individurvalen. Hela intervallet > 0 = säker skillnad.'
                : 'Bootstrap B=1000 på medianskillnaden. Intern: omdragning av bägge individurvalen. Extern: omdragning av org-löner mot jämförelsestatistikens median som konstant. Hela intervallet > 0 = säker skillnad.'],
            ['Justerad för ålder (%)', LV_JUSTERAD_METOD],
            ['Summa för gruppen (kr/mån)', termText('Skillnaden i kronor gånger antalet personer med {enhet.bf:kvinnodominerad}, per månad. Används bara för att rangordna paren.')]
        ];
        const metaSheet = XLSX.utils.aoa_to_sheet(meta);
        metaSheet['!cols'] = [{ wch: 42 }, { wch: 72 }];
        XLSX.utils.book_append_sheet(wb, metaSheet, 'Metadata');

        stegnamn = 'skriv fil';
        const filename = 'lonekartlaggning_likvardighet_' + idagDatum() + '.xlsx';
        _appendMethodSheet(wb, { undantag: 'Likvärdigt arbete' });
        XLSX.writeFile(wb, filename);

        stegnamn = 'efter-steg';
        if (typeof _showExportSensitivityToast === 'function') _showExportSensitivityToast();
        if (typeof announceToScreenReader === 'function') announceToScreenReader('Likvärdighetsanalys exporterad: ' + pairs.length + ' par.');
    } catch (err) {
        const msg = err && err.message ? err.message : String(err);
        const stackPreview = err && err.stack ? ('\n\nStack:\n' + String(err.stack).split('\n').slice(0, 4).join('\n')) : '';
        alert('Excelfilen kunde inte skapas (steg "' + stegnamn + '"):\n\n' + msg + stackPreview + '\n\nStäng filen om den är öppen i Excel och försök igen. Hjälper det inte, rapportera meddelandet.');
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

// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
// ====================================================================
// 75-lonepolitik.js — Fördjupad analys mot lönepolitiskt ställningstagande
//
// Fliken svarar på "lever vi upp till vår egen
// lönepolitik, och var gör vi det inte?" — ner på yrkesgruppsnivå (AID).
//
// Matematiken ligger i src/lib/lonepolitik.js (speglad som _lp* i 05). Uppslaget
// av vilken policyrad som gäller görs av policyFor() (state-beroende).
//
// Maskeringstrappa (PLAN §4) — AID-upplösning utan att urholka k-anonymiteten:
//   n >= kTroskel()                → full analys (median, band, kön)
//   LP_COUNT_TIER_MIN <= n < k     → endast bandplacering i ANTAL ("2 av 7 under P10")
//   n < min(LP_COUNT_TIER_MIN, k)  → maskerad rad, men inräknad i BAS-totalen
// Är tröskeln satt till LP_COUNT_TIER_MIN eller lägre finns ingen mellannivå.
// ====================================================================

const LP_COUNT_TIER_MIN = 5;   // undre gräns för antalsbaserad redovisning

function _lpAidOf(r) {
    const m = String(r.yrke || '').match(/^(\d+)/);
    return m ? m[1] : String(r.yrke || '');
}
function _lpTier(n) {
    if (n >= kTroskel()) return 'full';
    if (n >= LP_COUNT_TIER_MIN) return 'count';
    return 'masked';
}

/**
 * Bygger hela analysmodellen för fliken: per BAS, med AID-grupper under sig.
 * Ren nog att kunna inspekteras i test via window-shimmen.
 */
function buildLonepolitikModel() {
    const d = getData();
    /** @type {{byBas: any[], coverage: any, hasPolicy: boolean}} */
    const out = { byBas: [], coverage: null, hasPolicy: (state.policy || []).length > 0 };
    if (!d.length || !out.hasPolicy) return out;

    // Gruppera AID×BAS
    const groups = new Map();
    d.forEach(r => {
        if (!(r.lon > 0) || !r.bas) return;
        const aid = _lpAidOf(r);
        const key = aid + '|' + r.bas;
        if (!groups.has(key)) groups.set(key, { aid, bas: r.bas, yrke: r.yrke, rows: [] });
        groups.get(key).rows.push(r);
    });

    const coverageInput = [];
    const basMap = new Map();
    for (const g of groups.values()) {
        const pol = policyFor(g.aid, g.bas);
        coverageInput.push({ n: g.rows.length, hasPolicy: !!pol });
        if (!basMap.has(g.bas)) basMap.set(g.bas, { bas: g.bas, rows: [], groups: [] });
        const b = basMap.get(g.bas);
        b.rows.push(...g.rows);
        b.groups.push({
            aid: g.aid, bas: g.bas, yrke: g.yrke, n: g.rows.length, rows: g.rows,
            pol, level: policyLevelLabel(pol), tier: _lpTier(g.rows.length),
            stats: pol ? _lpGroupBandStats(g.rows, pol) : null,
            compliance: pol ? _lpComplianceCounts(g.rows, pol) : null
        });
    }
    out.coverage = _lpPolicyCoverage(coverageInput);

    out.byBas = [...basMap.values()].map(b => {
        // BAS-nivåns eget band (AID-specifika rader gäller bara sina yrken)
        const pol = policyFor(null, b.bas);
        return {
            bas: b.bas,
            pol,
            level: policyLevelLabel(pol),
            n: b.rows.length,
            stats: pol ? _lpGroupBandStats(b.rows, pol) : null,
            compliance: pol ? _lpComplianceCounts(b.rows, pol) : null,
            genderGap: pol ? _lpGenderBandGap(b.rows, pol, kTroskel()) : null,
            konLagen: pol ? _lpKonLagen(b.rows, pol) : null,
            cost: pol ? _lpCostToFloor(b.rows, pol) : null,
            orgBand: _lpOrganisationsBand(b.rows, kTroskel()),   // organisationens eget P10–P90 (null under k)
            groups: b.groups.sort((x, y) => y.n - x.n)
        };
    }).sort((a, b) => String(a.bas).localeCompare(String(b.bas), 'sv'));

    return out;
}

// ---- Renderare --------------------------------------------------------------

function renderLonepolitik() {
    const wrap = document.getElementById('lonepolitik-content');
    const empty = document.getElementById('lonepolitik-empty');
    if (!wrap || !empty) return;
    const rubrik = document.getElementById('lonepolitik-rubrik');
    if (rubrik) rubrik.textContent = `Lönerna mot ${referensNamn()}`;
    const model = buildLonepolitikModel();

    if (!model.hasPolicy || !model.byBas.length) {
        _lpRitaTopp(null);
        empty.style.display = 'block';
        wrap.style.display = 'none';
        // Två lägen: ingen referens alls, eller en referens som inte matchar underlaget.
        const h = empty.querySelector('h2'), p = empty.querySelector('p');
        if (h && p) {
            if (!harReferens()) {
                h.textContent = 'Ingen referens inläst';
                p.textContent = 'Ladda upp ert lönepolitiska ställningstagande — eller ett organisationspaket — på Översikt, så jämförs lönerna mot det.';
            } else {
                h.textContent = 'Referensen matchar inte underlaget';
                p.innerHTML = 'Referensen har inga rader för underlagets BAS-intervall eller yrken. Ladda upp en fil med P10/Median/P90 där varje rad har en <strong>BAS</strong>-kolumn, en <strong>AID</strong>-kolumn, eller båda.';
            }
        }
        return;
    }
    empty.style.display = 'none';
    wrap.style.display = 'block';

    // Avsnitten byggs om vid varje ritning; vilka som är utfällda bevaras. Första gången är tabellen öppen.
    const fanns = !!wrap.querySelector('details.avsnitt');
    const oppna = new Set([...wrap.querySelectorAll('details.avsnitt')].filter(a => /** @type {HTMLDetailsElement} */ (a).open).map(a => a.id));
    const avsnitt = (namn, rubrik, under, nyckel, innehall) => {
        const id = `avsnitt-lp-${namn}`;
        return `<details class="avsnitt" id="${id}"${(fanns ? oppna.has(id) : namn === 'tabell') ? ' open' : ''}>
            <summary><span class="avsnitt-titel"><h2>${rubrik}</h2><span class="avsnitt-under">${under}</span></span><span class="avsnitt-nyckel" id="nyckel-lp-${namn}">${esc(nyckel)}</span></summary>
            ${innehall}</details>`;
    };
    const lage = _lpRitaTopp(model);
    const [bandkarta, konsposition, efterlevnad] = _lpChartShellsHtml();
    wrap.innerHTML = bandkarta + `<p class="avsnitt-rubrikrad">Fördjupning</p>`
        + avsnitt('tabell', 'Yrkesgrupper mot sitt spann', 'Var varje grupps median ligger i spannet, och hur många som ligger under',
            `${lage.provade} yrkesgrupper`, _lpTableHtml(model))
        + avsnitt('kon', 'Könsposition i bandet', 'Placeras kvinnor lägre i samma lönespann än män?', '', konsposition)
        + avsnitt('efterlevnad', 'Efterlevnad', 'Andel under, inom eller över eget spann per BAS-intervall', '', efterlevnad)
        + avsnitt('tackning', 'Täckningsgrad', 'Hur mycket av personalen har en policyreferens?', svPct(model.coverage.personsPct, 0), _lpCoverageHtml(model));

    _lpRenderBandMap(model);
    _lpRenderGenderPosition(model);
    _lpRitaKonLagen(model);
    _lpRenderCompliance(model);
    if (typeof enableTableSort === 'function') enableTableSort('lonepolitik-table');
    if (typeof addTableExportTools === 'function') addTableExportTools('lonepolitik-table', 'lonepolitik');
}

function _lpCoverageHtml(model) {
    const c = model.coverage;
    const pct = c.personsPct;
    const tone = pct >= 90 ? 'ok' : pct >= 60 ? 'warn' : 'crit';
    const farg = tone === 'ok' ? 'ok' : tone === 'warn' ? 'varning' : 'kritisk';
    return `
    <div class="card mb-16 bl4-${farg}">
        <div class="rad-bryt baslinje gap-12">
            <div class="fs-2rem tabelltal fw-700 fg-${farg}">${svPct(pct, 0)}</div>
            <div class="text-dampad-sm">
                ${c.personsCovered} av ${c.personsTotal} personer · ${c.groupsCovered} av ${c.groupsTotal} yrkesgrupper
            </div>
        </div>
        ${pct < 100 ? `<p class="reg-caveat-inline marg-t-10"><strong>Läs resultatet mot detta:</strong>
            grupper utan policyrad kan inte avvika. "Inga avvikelser" kan alltså betyda
            <em>ingen referens</em> snarare än ett gott resultat.</p>` : ''}
    </div>`;
}

function _lpChartShellsHtml() {
    return [`
    <div class="card mb-16">
        <div class="chart-header rad-bryt-mitt gap-12 mellan marg-b-8">
            <h3 class="fs-lg marg-0">Bandkartan — var ligger varje yrkesgrupp i sitt spann?</h3>
            <span class="text-dampad-xs">Grå stapel = ${esc(referensKortnamn())}:s P10–P90. Streck i den = referensens median. Blå stapel = organisationens faktiska P10–P90 (bara BAS med minst ${kTroskel()} personer). Punkt = yrkesgruppens median: kvinnodominerad, mansdominerad eller blandad.</span>
        </div>
        <div id="chart-lp-bandmap"></div>
    </div>`, `
    <div class="card mb-16">
        <p class="reg-caveat-inline">Ett lägre läge i bandet är ett <strong>fynd att förklara</strong> — inte ett konstaterat fel.
        Nyanställning, tillfällig placering och erfarenhet kan alla ligga bakom.</p>
        <div class="chart-container"><div id="chart-lp-gender"></div></div>
        <div id="lp-konlagen-kort" class="diagramkort marg-t-18" hidden>
            <h3 class="diagramkort-rubrik">Var i spannet ligger kvinnor och män?</h3>
            <p class="diagramkort-forklaring">Genomsnittsläget ovan kan vara lika för könen fast det ena samlas i nedre delen av spannet. Här delas spannet i tredjedelar: stapeln visar hur stor andel av kvinnorna respektive männen som ligger i varje del.</p>
            <div class="chart-container"><div id="chart-lp-konlagen"></div></div>
            <p id="lp-konlagen-not" class="diagramkort-not"></p>
        </div>
    </div>`, `
    <div class="card mb-16">
        <div class="rad-bryt-mitt gap-12 slutjusterad marg-b-8">
            <span><label for="lp-komplians-vy" class="fs-sm marg-h-6">Uppställning</label>
            <select id="lp-komplians-vy" class="form-select pad-4-8 bredd-auto">
                <option value="staplad"${_lpKompliansVy === 'staplad' ? ' selected' : ''}>Hela fördelningen (100 %)</option>
                <option value="mitt"${_lpKompliansVy === 'mitt' ? ' selected' : ''}>Avvikelserna kring en mittlinje</option>
            </select></span>
        </div>
        <div id="chart-lp-compliance"></div>
    </div>`];
}

/**
 * Flikens topp: urvalsraden och slutsatserna. Räknar bara yrkesgrupper som tabellen visar med percentiler —
 * grupper under tröskeln har ingen position att redovisa. Ett läge utanför spannet är ett fynd att förklara
 * och märks inte som fel; låg täckningsgrad märks, eftersom resultatet då inte går att läsa.
 * @returns {{provade:number, under:number, over:number}}
 */
function _lpRitaTopp(model) {
    const urval = document.getElementById('lp-urval'), host = document.getElementById('lp-slutsatser');
    const lage = { provade: 0, under: 0, over: 0 };
    if (!model) { if (urval) urval.textContent = ''; if (host) host.innerHTML = ''; return lage; }
    model.byBas.forEach(b => b.groups.forEach(g => {
        if (!g.pol || g.tier === 'masked' || g.tier === 'count' || !g.stats || g.stats.position == null) return;
        lage.provade++;
        if (g.stats.position < 0) lage.under++; else if (g.stats.position > 1) lage.over++;
    }));
    if (!urval || !host) return lage;
    const c = model.coverage;
    urval.innerHTML = `<span><strong>Hela urvalet</strong> · ${svTal(c.personsTotal, 0)} personer</span><span>Referens: ${esc(referensNamn())}</span>${kTroskelLank()}`;
    const grupper = n => `${n === 1 ? 'yrkesgrupp' : 'yrkesgrupper'}`;
    host.innerHTML = _laSlutsats('Täckningsgrad', svPct(c.personsPct, 0), `${c.personsCovered} av ${c.personsTotal} personer har en referens`, c.personsPct < 60)
        + _laSlutsats('Median under spannet', svTal(lage.under, 0), `${grupper(lage.under)} av ${lage.provade} prövade`)
        + _laSlutsats('Median inom spannet', svTal(lage.provade - lage.under - lage.over, 0), grupper(lage.provade - lage.under - lage.over))
        + _laSlutsats('Median över spannet', svTal(lage.over, 0), grupper(lage.over));
    return lage;
}

function _lpRenderBandMap(model) {
    const el = document.getElementById('chart-lp-bandmap');
    if (!el) return;
    const bas = model.byBas.filter(b => b.pol && b.pol.p10 > 0 && b.pol.p90 > 0);
    if (!bas.length) { _lpIngetDiagram(el, 'Inget BAS-intervall har ett användbart P10–P90-spann i policyn.'); return; }
    ritaFigur(el, _lpBandkartaFigur(bas), { hojd: 460 });
}

// Bandkartans figur (diagramkärnan, ADR-39): referensens spann och organisationens faktiska spann per BAS som märket
// `intervall`, med varje yrkesgrupps median som punkt.
// Organisationens spann finns bara för BAS med minst k personer (`b.orgBand`), och punkterna bara för grupper på full
// nivå (percentiler kräver n ≥ k) — inget annat når figuren.
function _lpBandkartaFigur(bas) {
    const x = b => 'BAS ' + b.bas, kr = v => _figTalformat(v, 'kr'), utanKr = v => _figTalformat(v, 'kr', { enhet: false });
    const refNamn = referensKortnamn(), org = plotNamn(orgNamn());
    const refMed = b => (b.pol.med > 0 ? b.pol.med : (b.pol.p10 + b.pol.p90) / 2);
    const medOrgBand = bas.filter(b => b.orgBand);
    const pts = [];
    bas.forEach(b => b.groups.forEach(g => {
        if (g.tier !== 'full' || !g.stats || !g.pol) return;
        const kvAndel = g.rows.filter(r => typeof r.kon === 'string' && r.kon.includes('kvinna')).length / g.n * 100;
        // Förskjutningen härleds ur gruppens identitet, inte slump — punkterna ska ligga still mellan omritningar.
        pts.push({ x: x(b), y: g.stats.median, forskjutning: ((_rngHashSeed(g.aid + '|' + g.bas) % 1000) / 1000 - 0.5) * 0.36,
                   storlek: Math.max(3.5, Math.min(9, Math.sqrt(g.n) * 1.1)), kvAndel, n: g.n, yrke: g.yrke, bas: b.bas, niva: g.level || '—', markering: markeringFor(b.bas, g.aid) });
    }));
    return { beskrivning: 'Referensens lönespann och organisationens faktiska lönespann per BAS-intervall, med varje yrkesgrupps median inlagd som punkt. Samma värden finns i tabellen nedan.',
        x: { skala: 'band', ordning: bas.map(x) }, y: { skala: 'linjar', titel: 'Månadslön', format: 'kr' },
        lager: [
            { marke: 'intervall', serie: `${refNamn} (P10–P90)`, farg: PALETTE.semantic.spann, tjocklek: 14,
              data: bas.map(b => ({ x: x(b), lag: b.pol.p10, hog: b.pol.p90, markering: markeringFor(b.bas) })), tips: d => [[d.x], [refNamn, `P10 ${utanKr(d.lag)} · P90 ${kr(d.hog)}`]] },
            { marke: 'punkt', symbol: 'streck', serie: `${refNamn} median`, farg: PALETTE.semantic.referens, storlek: 4.5, legend: false,
              data: bas.map(b => ({ x: x(b), y: refMed(b) })), tips: d => [[d.x], [`${refNamn} median`, kr(d.y)]] },
            { marke: 'intervall', serie: `${org} (P10–P90)`, farg: PALETTE.serie[0], opacitet: 0.55, tjocklek: 6,
              data: medOrgBand.map(b => ({ x: x(b), lag: b.orgBand.p10, hog: b.orgBand.p90, med: b.orgBand.med, n: b.orgBand.n, markering: markeringFor(b.bas) })),
              tips: d => [[d.x], ['Organisationen', `P10 ${utanKr(d.lag)} · median ${utanKr(d.med)} · P90 ${kr(d.hog)}`], ['Antal', String(d.n)]] },
            // Yrkesgrupperna i tre klasser efter könsfördelning (som i Likvärdigt arbete) i stället för en färgskala:
            // tre färger går att läsa mot spannen, en glidande skala gör det inte.
            .../** @type {Array<[string, string, (a: number) => boolean]>} */ ([['Kvinnodominerad yrkesgrupp', PALETTE.kon.kvinna, a => a >= 60], ['Mansdominerad yrkesgrupp', PALETTE.kon.man, a => a <= 40], ['Blandad yrkesgrupp', PALETTE.semantic.neutral, a => a > 40 && a < 60]])
                .map(([serie, farg, hor]) => ({ marke: 'punkt', serie, farg, kant: FARG.vit, data: pts.filter(p => hor(p.kvAndel)),
                    tips: d => [[d.yrke], [`BAS ${d.bas}`, `median ${kr(d.y)}`], ['Kvinnor', _figTalformat(d.kvAndel, 'antal') + ' %'], ['Referens', d.niva], ['Antal', String(d.n)]] }))
        ].filter(l => l.data.length) };
}

// Positionen i spannet är ett LÄGE, inte en mängd: kvinnor och män som två punkter på en bana som är policyns
// spann (0 = P10, 100 = P90) — inte som två staplar. Raderna är redan filtrerade av vyn: inget BAS-intervall under
// tröskeln når figuren.
function _lpFigurKonHantel(rows) {
    const y = b => 'BAS ' + b.bas, pos = (b, f) => +(b.genderGap[f] * 100).toFixed(1);
    const alla = rows.flatMap(b => [pos(b, 'kvPos'), pos(b, 'maPos')]);
    const punkt = (namn, farg, falt) => ({ marke: 'punkt', serie: namn, farg, storlek: 6,
        data: rows.map(b => ({ y: y(b), x: pos(b, falt), markering: markeringFor(b.bas) })), tips: d => [[d.y], [namn, `${_figTalformat(d.x, 'pct')} in i spannet`]] });
    return { beskrivning: 'Kvinnors respektive mäns genomsnittliga position i policyns lönespann per BAS-intervall, som två punkter på spannet: 0 procent är spannets nedre gräns (P10), 100 procent den övre (P90).',
        y: { skala: 'band', ordning: rows.map(y) }, x: { skala: 'linjar', titel: 'Position i spannet (%) — 0 = P10, 100 = P90', doman: [Math.min(0, ...alla) - 4, Math.max(100, ...alla) + 4] },
        hojd: Math.max(170, 100 + rows.length * 34),
        referens: [{ x: 50, streck: 'prickad', farg: PALETTE.semantic.neutral, tjocklek: 1, etikett: 'Mitten' }],
        lager: [{ marke: 'intervall', riktning: 'liggande', serie: 'Policyns spann', farg: PALETTE.semantic.spann, tjocklek: 12, data: rows.map(b => ({ y: y(b), lag: 0, hog: 100 })), tips: d => [[d.y], ['Spann', 'P10–P90']] },
                { marke: 'intervall', riktning: 'liggande', serie: 'Skillnad', farg: PALETTE.semantic.neutral, tjocklek: 2, legend: false,
                  data: rows.map(b => ({ y: y(b), lag: Math.min(pos(b, 'kvPos'), pos(b, 'maPos')), hog: Math.max(pos(b, 'kvPos'), pos(b, 'maPos')) })) },
                punkt('Kvinnor', PALETTE.kon.kvinna, 'kvPos'), punkt('Män', PALETTE.kon.man, 'maPos')] };
}

// ---- Var i spannet ligger kvinnor och män? ----
// Varje person får ett läge i sitt BAS-intervalls spann (0 = P10, 1 = P90) och räknas till en av fem klasser: under
// spannet, nedre, mellersta eller övre tredjedelen, eller över spannet. Genomsnittsläget (diagrammet ovanför) kan vara
// detsamma för könen fast det ena samlas i nedre tredjedelen; fördelningen visar det. Klasserna räknas per BAS-intervall
// med policyspann och läggs ihop över hela urvalet; ett kön redovisas bara när det når tröskeln.
const _LP_LAGEN = [['Under spannet', '#c2552d'], ['Nedre tredjedelen', '#e59a7b'], ['Mellersta tredjedelen', '#d5dae3'], ['Övre tredjedelen', '#86b6ef'], ['Över spannet', '#2a78d6']];
function _lpLagesklass(pos) { return pos < 0 ? 0 : pos < 1 / 3 ? 1 : pos <= 2 / 3 ? 2 : pos <= 1 ? 3 : 4; }
function _lpKonLagen(rows, pol) {
    const ut = { kv: [0, 0, 0, 0, 0], ma: [0, 0, 0, 0, 0] };
    for (const r of rows) {
        const kon = typeof r.kon === 'string' && r.kon.includes('kvinna') ? 'kv' : (r.kon === 'man' || r.kon === 'män') ? 'ma' : null;
        const pos = kon ? _lpBandPosition(r.lon, pol.p10, pol.p90) : null;
        if (pos != null && isFinite(pos)) ut[kon][_lpLagesklass(pos)]++;
    }
    return ut;
}
function _lpKonLagenSumma(model) {
    const sum = { kv: [0, 0, 0, 0, 0], ma: [0, 0, 0, 0, 0] };
    for (const b of model.byBas) if (b.konLagen) for (const k of ['kv', 'ma']) b.konLagen[k].forEach((v, i) => { sum[k][i] += v; });
    return { ...sum, nKv: sum.kv.reduce((a, v) => a + v, 0), nMa: sum.ma.reduce((a, v) => a + v, 0) };
}
function _lpFigurKonLagen(sum) {
    const rader = [['Kvinnor', sum.kv, sum.nKv], ['Män', sum.ma, sum.nMa]];
    return { beskrivning: 'Andel av kvinnorna respektive männen i policyspannets nedre, mellersta och övre tredjedel samt under och över spannet, staplat till 100 procent. Varje person räknas mot sitt BAS-intervalls spann.',
        y: { skala: 'band', ordning: rader.map(r => r[0]) }, x: { skala: 'linjar', titel: 'Andel av könet (%)', doman: [0, 100] }, hojd: 190,
        lager: _LP_LAGEN.map(([serie, farg], i) => ({ marke: 'stapel', lage: 'staplad', riktning: 'liggande', serie, farg,
            data: rader.map(([namn, antal, n]) => { const a = +(100 * antal[i] / n).toFixed(1), fa = antal[i] > 0 && antal[i] < litetUnderlag();
                return { y: namn, x: a, n, ...(fa ? { fa: true } : {}), ...(a >= 7 ? { etikett: svPct(a, 0) } : {}) }; }),
            tips: d => [[d.y], [serie, _figTalformat(d.x, 'pct')], ['Antal i könet', String(d.n)], ...(d.fa ? [['Litet underlag', `färre än ${litetUnderlag()} personer`]] : [])] })) };
}
function _lpRitaKonLagen(model) {
    const el = document.getElementById('chart-lp-konlagen'), kort = document.getElementById('lp-konlagen-kort'), not = document.getElementById('lp-konlagen-not');
    if (!el) return;
    const sum = _lpKonLagenSumma(model), k = kTroskel(), ok = sum.nKv >= k && sum.nMa >= k;
    if (kort) kort.hidden = !ok;
    if (!ok) { rensaFigur(el); if (not) not.textContent = ''; return; }
    ritaFigur(el, _lpFigurKonLagen(sum));
    const pct = (a, n) => svPct(100 * (a[0] + a[1]) / n, 0);
    if (not) not.textContent = `${pct(sum.kv, sum.nKv)} av kvinnorna och ${pct(sum.ma, sum.nMa)} av männen ligger i nedre tredjedelen eller under spannet. ${svTal(sum.nKv, 0)} kvinnor och ${svTal(sum.nMa, 0)} män med policyspann ingår.`;
}

const _LP_LAGE = { under: '#c2552d', inom: '#d5dae3', over: '#2a78d6' };
function _lpFigurKomplians(rows) {
    const pct = (v, n) => +((v / n) * 100).toFixed(1);
    const serie = (namn, farg, falt) => ({
        marke: 'stapel', lage: 'staplad', serie: namn, farg,
        data: rows.map(b => ({ x: 'BAS ' + b.bas, y: pct(b.compliance[falt], b.compliance.n), markering: markeringFor(b.bas) })),
        tips: d => [[d.x], [namn, _figTalformat(d.y, 'pct')]]
    });
    return { beskrivning: 'Andel medarbetare under, inom och över policyns lönespann per BAS-intervall',
        x: { skala: 'band' }, y: { skala: 'linjar', titel: 'Andel av medarbetarna (%)', doman: [0, 100] },
        hojd: Math.max(260, 60 + rows.length * 38),
        // Två nyanser kring en neutral mitt (under — inom — över), inte rött och grönt: läget i spannet är en riktning.
        lager: [serie('Under P10', _LP_LAGE.under, 'under'), serie('Inom spann', _LP_LAGE.inom, 'within'),
                serie('Över P90', _LP_LAGE.over, 'over')] };
}

// Samma andelar ställda kring en mittlinje (divergerande stapel): under spannet åt vänster, över åt höger, störst
// andel utanför spannet överst. Andelen inom spannet ritas inte — den står i tipset. Under-lagret har negativa
// värden för att hamna till vänster och är märkt `absolut`, så diagramdatan bär andelen utan tecken.
let _lpKompliansVy = 'staplad';   // 'staplad' | 'mitt' — användarens val, gäller tills sidan laddas om
function _lpFigurKompliansMitt(rows) {
    const pct = (v, n) => +((v / n) * 100).toFixed(1);
    const sorterade = rows.slice().sort((a, b) => (b.compliance.under + b.compliance.over) / b.compliance.n - (a.compliance.under + a.compliance.over) / a.compliance.n);
    const serie = (namn, farg, falt, tecken) => ({
        marke: 'stapel', lage: 'staplad', riktning: 'liggande', serie: namn, farg, ...(tecken < 0 ? { absolut: true } : {}),
        data: sorterade.map(b => {
            const andel = pct(b.compliance[falt], b.compliance.n);
            return { y: 'BAS ' + b.bas, x: tecken * andel || 0, andel, inom: pct(b.compliance.within, b.compliance.n), markering: markeringFor(b.bas),
                     ...(andel > 0 ? { etikett: _figTalformat(andel, 'pct') } : {}) };
        }),
        tips: d => [[d.y], [namn, _figTalformat(d.andel, 'pct')], ['Inom spann', _figTalformat(d.inom, 'pct')]]
    });
    const storst = Math.max(10, ...sorterade.map(b => Math.max(pct(b.compliance.under, b.compliance.n), pct(b.compliance.over, b.compliance.n))));
    const grans = Math.min(100, Math.ceil(storst * 1.15 / 10) * 10);
    return { beskrivning: 'Andel medarbetare under respektive över policyns lönespann per BAS-intervall, ställda kring en mittlinje: under åt vänster, över åt höger. Störst andel utanför spannet överst. Resten ligger inom spannet.',
        y: { skala: 'band', ordning: sorterade.map(b => 'BAS ' + b.bas) },
        x: { skala: 'linjar', titel: 'Under P10 åt vänster · andel av medarbetarna (%) · över P90 åt höger', format: 'pctAbs', doman: [-grans, grans], nollinje: true },
        hojd: Math.max(260, 70 + sorterade.length * 38),
        lager: [serie('Under P10', _LP_LAGE.under, 'under', -1), serie('Över P90', _LP_LAGE.over, 'over', 1)] };
}
document.addEventListener('change', e => {
    if (!e.target || /** @type {HTMLElement} */ (e.target).id !== 'lp-komplians-vy') return;
    _lpKompliansVy = /** @type {HTMLInputElement} */ (e.target).value === 'mitt' ? 'mitt' : 'staplad';
    if (typeof renderLonepolitik === 'function') renderLonepolitik();
});

// Ett meddelande i stället för diagrammet: figuren släpps först, så att ingen export eller omritning finns kvar.
function _lpIngetDiagram(el, text) {
    rensaFigur(el);
    const p = document.createElement('p');
    p.style.cssText = 'color:var(--text-muted);font-size:0.9rem;margin:8px 0;';
    p.textContent = text;
    el.appendChild(p);
}

function _lpRenderGenderPosition(model) {
    const el = document.getElementById('chart-lp-gender');
    if (!el) return;
    const rows = model.byBas.filter(b => b.genderGap);
    if (!rows.length) {
        _lpIngetDiagram(el, `Inget BAS-intervall har minst ${kTroskel()} av varje kön med användbart policyspann — könsanalysen kan inte redovisas.`);
        return;
    }
    ritaFigur(el, _lpFigurKonHantel(rows));
}

function _lpRenderCompliance(model) {
    const el = document.getElementById('chart-lp-compliance');
    if (!el) return;
    // K-anonymitet: staplarna visar andelar med en decimal, så ett BAS-intervall
    // under tröskeln skulle gå att baklängesräkna till antal individer — och
    // policyns P10/P90 visas i samma vy. BAS-rollupen byggs av ALLA AID-grupper
    // oavsett maskeringstrappa, så tröskeln måste sättas här.
    const alla = model.byBas.filter(b => b.compliance);
    const rows = alla.filter(b => !isKMasked(b.n));
    const dolda = alla.filter(b => isKMasked(b.n)).map(b => 'BAS ' + b.bas);
    // Noten om utelämnade intervall ligger EFTER behållaren (kärnan äger behållarens innehåll).
    const gammal = el.parentElement && el.parentElement.querySelector('[data-lp-not="komplians"]');
    if (gammal) gammal.remove();
    if (!rows.length) {
        _lpIngetDiagram(el, alla.length
            ? `Samtliga BAS-intervall med policyspann har färre än ${kTroskel()} personer och kan därför inte redovisas.`
            : 'Ingen BAS har användbara bandgränser i policyn.');
        return;
    }
    ritaFigur(el, _lpKompliansVy === 'mitt' ? _lpFigurKompliansMitt(rows) : _lpFigurKomplians(rows));
    if (dolda.length) {
        // Namnger de utelämnade intervallen i stället för att bara räkna dem —
        // samma princip som noterna under tabellerna.
        const note = document.createElement('div');
        note.setAttribute('data-lp-not', 'komplians');
        note.innerHTML = kMaskNote(dolda, 'BAS-intervall|BAS-intervall');
        el.insertAdjacentElement('afterend', note);
    }
}

function _lpTableHtml(model) {
    const kr = v => v == null ? '–' : Math.round(v).toLocaleString('sv-SE') + ' kr';
    const rows = [];
    model.byBas.forEach(b => {
        rows.push(`<tr class="group-header"><td colspan="7">BAS ${esc(b.bas)}${b.pol ? '' : ' — <em>ingen policyreferens</em>'}</td></tr>`);
        const utelamnade = [];
        b.groups.forEach(g => {
            const name = `${esc(g.aid)}${g.yrke && g.yrke !== g.aid ? ' ' + esc(g.yrke) : ''}`;
            if (!g.pol) {
                rows.push(`<tr><td>${name}</td><td class="t-hoger">${g.n}</td><td colspan="5" class="farg-dampad kursiv">Ingen policyreferens</td></tr>`);
                return;
            }
            // k-anonymitet, nedersta steget: gruppen är så liten att inte ens
            // antalet får visas. Raden bar ingenting annat än "< 5" — den
            // utelämnas och gruppen räknas upp i noten sist i BAS-blocket.
            // Personerna ingår fortfarande i BAS-totalen.
            if (g.tier === 'masked') { utelamnade.push(g.yrke && g.yrke !== g.aid ? `${g.aid} ${g.yrke}` : g.aid); return; }
            if (g.tier === 'count') {
                const c = g.compliance;
                rows.push(`<tr><td>${name}</td><td class="t-hoger">${g.n}</td>`
                    + `<td class="t-mitt f-dampad" colspan="3">Endast antal (n &lt; ${kTroskel()})</td>`
                    + `<td class="t-mitt" data-sort-value="${c ? c.under : 0}">${c ? `${c.under} av ${c.n} under P10` : '–'}</td>`
                    + `<td class="t-mitt">${esc(g.level || '–')}</td></tr>`);
                return;
            }
            const s = g.stats, c = g.compliance;
            const posPct = s && s.position != null ? (s.position * 100) : null;
            const posKlass = posPct == null ? '' : posPct < 0 ? ' f-kritisk halvfet' : posPct > 100 ? ' fg-info' : '';
            rows.push(`<tr><td>${name}</td>`
                + `<td class="t-hoger">${g.n}</td>`
                + `<td class="tabelltal ta-hoger" data-sort-value="${s.median}">${kr(s.median)}</td>`
                + `<td class="t-tal">${kr(g.pol.p10)}–${kr(g.pol.p90)}</td>`
                + `<td class="t-tal${posKlass}" data-sort-value="${posPct == null ? '' : posPct}">${posPct == null ? 'Spann för smalt' : svPct(posPct, 0)}</td>`
                + `<td class="t-mitt" data-sort-value="${c ? c.under : 0}">${c ? `${c.under} av ${c.n}` : '–'}</td>`
                + `<td class="t-mitt">${esc(g.level || '–')}</td></tr>`);
        });
        if (utelamnade.length) {
            rows.push(`<tr><td colspan="7">${kMaskNote(utelamnade, 'yrkesgrupp|yrkesgrupper', Math.min(LP_COUNT_TIER_MIN, kTroskel()))}</td></tr>`);
        }
    });
    return `
    <div class="card">
        <p class="text-dampad-sm lh-1_55 marg-0-0-10">
            <strong>Position</strong> är var gruppens median ligger i spannet: 0 % = på P10, 100 % = på P90.
            Under 0 % eller över 100 % betyder att medianen ligger utanför spannet.
            Grupper med färre än ${kTroskel()} personer visas utan percentiler, och under ${Math.min(LP_COUNT_TIER_MIN, kTroskel())} maskeras de helt —
            men de räknas alltid in i BAS-totalen.
        </p>
        <div class="table-container">
            <table id="lonepolitik-table" class="data-table fs-sm" aria-label="Yrkesgrupper jämförda mot ${esc(referensNamn())}">
                <thead><tr>
                    <th>AID / Yrkesgrupp</th>
                    <th class="t-hoger">N</th>
                    <th class="t-hoger">Median</th>
                    <th class="t-hoger">Policyspann</th>
                    <th class="t-hoger">Position</th>
                    <th class="t-mitt">Under P10</th>
                    <th class="t-mitt">Referensnivå</th>
                </tr></thead>
                <tbody>${rows.join('')}</tbody>
            </table>
        </div>
    </div>`;
}

// ---- Bladet Lönepolitik i "Excel (alla flikar)" ----
/**
 * Talen bakom fliken som ett blad: yrkesgrupperna mot sitt spann, läget i spannet per kön och BAS-intervall,
 * fördelningen i spannets tredjedelar per kön och efterlevnaden per BAS-intervall. Samma modell och samma regler
 * som fliken: maskeringstrappan för yrkesgrupperna (_lpTier), tröskeln per kön för de könsuppdelade måtten
 * (_konFarRedovisas — samma villkor som genderBandGap och kortet om tredjedelarna) och tröskeln per BAS-intervall
 * för efterlevnaden (isKMasked). Finns inget ställningstagande, eller matchar det inte underlaget, blir det inget blad.
 * @returns {null|any[][]} bladets rader
 */
function _lpExcelBlad() {
    const model = buildLonepolitikModel();
    if (!model.hasPolicy || !model.byBas.length) return null;
    const k = kTroskel(), r1 = v => Math.round(v * 10) / 10, kr = v => Math.round(v);
    const pct = (a, n) => (n ? r1(100 * a / n) : '');
    // Yrkets benämning utan AID-koden först (yrke är "AID benämning" när filen har båda).
    const benamning = g => String(g.yrke || '').replace(/^\d+\s*/, '');
    const namn = g => (benamning(g) ? `${g.aid} ${benamning(g)}` : String(g.aid));
    /** @type {any[][]} */
    const ut = [
        [`Lönerna mot ${referensNamn()} (fliken Lönepolitik)`],
        [`Position är var medianen ligger i referensens spann: 0 % = på P10, 100 % = på P90; under 0 eller över 100 betyder utanför spannet. `
            + `Yrkesgrupper med färre än ${k} personer står med antal men utan lönemått, och med färre än ${Math.min(LP_COUNT_TIER_MIN, k)} utelämnas de; de räknas alltid in i BAS-intervallets rader. `
            + `Könsuppdelade mått redovisas bara där varje kön har minst ${k} personer.`],
        [],
        ['Yrkesgrupper mot sitt spann'],
        ['BAS-intervall', 'AID', 'Yrkesgrupp', 'Antal', 'Median (kr)', 'Referensens P10 (kr)', 'Referensens P90 (kr)', 'Position (%)', 'Under P10 (antal)', 'Referensnivå']
    ];
    const utelamnade = [];
    for (const b of model.byBas) {
        for (const g of b.groups) {
            if (!g.pol) { ut.push([b.bas, g.aid, benamning(g), g.n, '', '', '', '', '', 'Ingen referens']); continue; }
            if (g.tier === 'masked') { utelamnade.push(namn(g)); continue; }
            const c = g.compliance;
            if (g.tier === 'count') { ut.push([b.bas, g.aid, benamning(g), g.n, '', '', '', '', c ? c.under : '', g.level || '']); continue; }
            const s = g.stats;
            ut.push([b.bas, g.aid, benamning(g), g.n, s ? kr(s.median) : '', kr(g.pol.p10), kr(g.pol.p90),
                s && s.position != null ? r1(s.position * 100) : '', c ? c.under : '', g.level || '']);
        }
    }
    if (utelamnade.length) ut.push([`Visas inte (färre än ${Math.min(LP_COUNT_TIER_MIN, k)} personer): ${utelamnade.join(', ')}.`]);

    // Läget i spannet per kön: bara BAS-intervall där varje kön når tröskeln (samma villkor som hanteldiagrammet).
    ut.push([], ['Läget i spannet per kön, per BAS-intervall (genomsnittlig position: 0 % = P10, 100 % = P90)'],
        ['BAS-intervall', 'Antal kvinnor', 'Antal män', 'Kvinnors läge (%)', 'Mäns läge (%)', 'Skillnad kvinnor − män (procentenheter)']);
    const konDolda = [];
    for (const b of model.byBas) {
        if (!b.pol) continue;
        const gg = b.genderGap;
        if (!gg || !_konFarRedovisas(gg.nKv, gg.nMa)) { konDolda.push(b.bas); continue; }
        ut.push([b.bas, gg.nKv, gg.nMa, r1(gg.kvPos * 100), r1(gg.maPos * 100), r1(gg.diff * 100)]);
    }
    if (konDolda.length) ut.push([`Visas inte (ett kön har färre än ${k} personer, eller spannet är inte användbart): ${konDolda.join(', ')}.`]);

    // Tredjedelarna: hela urvalet, som kortet i fliken — bara när båda könen når tröskeln.
    const sum = _lpKonLagenSumma(model);
    ut.push([], ['Fördelningen i spannets tredjedelar per kön (hela urvalet, andel av könet)'],
        ['Kön', 'Antal', ..._LP_LAGEN.map(([serie]) => `${serie} (%)`)]);
    if (_konFarRedovisas(sum.nKv, sum.nMa)) {
        ut.push(['Kvinnor', sum.nKv, ...sum.kv.map(a => pct(a, sum.nKv))], ['Män', sum.nMa, ...sum.ma.map(a => pct(a, sum.nMa))]);
    } else ut.push([_konUtelamnatNot()]);

    // Efterlevnad per BAS-intervall: som diagrammet, intervall under tröskeln utelämnas och namnges.
    ut.push([], ['Efterlevnad per BAS-intervall'],
        ['BAS-intervall', 'Antal', 'Under P10 (antal)', 'Inom spannet (antal)', 'Över P90 (antal)', 'Under P10 (%)', 'Inom spannet (%)', 'Över P90 (%)']);
    const efterDolda = [];
    for (const b of model.byBas) {
        const c = b.compliance;
        if (!c) continue;
        if (isKMasked(b.n)) { efterDolda.push(b.bas); continue; }
        ut.push([b.bas, c.n, c.under, c.within, c.over, pct(c.under, c.n), pct(c.within, c.n), pct(c.over, c.n)]);
    }
    if (efterDolda.length) ut.push([`Visas inte (färre än ${k} personer): ${efterDolda.join(', ')}.`]);
    return ut;
}

// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson

// ---- Jämförelsestatistik (ADR-35) ----
// Raderna räknas i src/lib/jamforelse.js; här finns filter, tabell och diagram. Avsnittet Mot jämförelsestatistiken i
// fliken Jämförelse: jämförelsen mot ställningstagandet är avsnittet före (75-lonepolitik.js, ADR-55).
const _jmfVal = { bas: '', sektor: '' };

function jamforelseVal() { return { ..._jmfVal }; }
/** @param {{bas?: string, sektor?: string}} [val] */
function jamforelseSattVal({ bas, sektor } = {}) {
    if (bas !== undefined) _jmfVal.bas = typeof bas === 'string' ? bas : '';
    if (sektor !== undefined) _jmfVal.sektor = typeof sektor === 'string' ? sektor : '';
}
function jamforelseUnderlag() {
    return _jfRader(getData(), { statistik: state.statistik, policyFor, k: kTroskel() });
}
function _jmfKallaNamn(kalla) {
    return kalla === 'stallningstagande' ? referensKortnamn() : jmfNamn('jämförelsestatistiken');
}
function jamforelseAktivKalla() { return 'statistik'; }
// "Urval: BAS C · sektor X" när ett filter är aktivt, annars tomt — för panel, Excel och utskrift.
function jamforelseUrvalText() {
    const delar = [];
    if (_jmfVal.bas) delar.push(`BAS ${_jmfVal.bas}`);
    if (_jmfVal.sektor) delar.push(`sektor ${_jmfVal.sektor}`);
    return delar.length ? `Urval: ${delar.join(' · ')}` : '';
}
function _jmfFyllVal(sel, varden, valt) {
    if (!sel) return '';
    const giltigt = varden.includes(valt) ? valt : '';
    sel.innerHTML = '<option value="">Alla</option>' + varden.map(v => `<option value="${esc(v)}"${v === giltigt ? ' selected' : ''}>${esc(v)}</option>`).join('');
    sel.value = giltigt;
    return giltigt;
}
function jamforelseMarkeraRad(aid, bas) {
    const tr = [...document.querySelectorAll('#benchmark-table tbody tr[data-rad]')].find(t => /** @type {HTMLElement} */ (t).dataset.rad === `${aid}|${bas}`);
    if (!tr) return false;
    // Ligger raden i en hopfälld BAS-grupp fälls gruppen ut först (samma klick som på rubriken).
    let h = tr.previousElementSibling;
    while (h && !h.classList.contains('group-header')) h = h.previousElementSibling;
    if (h && h.classList.contains('collapsed')) /** @type {HTMLElement} */ (h).click();
    document.querySelectorAll('#benchmark-table tr.row-highlighted').forEach(x => x.classList.remove('row-highlighted'));
    tr.classList.add('row-highlighted');
    if (typeof tr.scrollIntoView === 'function') tr.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setTimeout(() => tr.classList.remove('row-highlighted'), 4000);
    return true;
}

function generateBenchmark() {
    const tbody = document.querySelector('#benchmark-table tbody');
    const infoEl = document.getElementById('benchmark-metric-info');
    if (!tbody) return;
    const d = getData();
    if (!state.statistik.length || !d.length) {
        tbody.innerHTML = `<tr><td colspan="12" class="pad-0"><div class="flik-empty-state">
            <div class="empty-icon">${ikon('tomLada', 32)}</div><h2>Jämförelsestatistik saknas</h2>
            <p>Läs in jämförelsestatistik på Översikt, så jämförs organisationens löner mot den här.</p>
            <button class="empty-action" data-goto-tab="dashboard">Gå till uppladdning</button></div></td></tr>`;
        if (infoEl) infoEl.textContent = '';
        rensaFigur('chart-jamforelse-spann'); rensaFigur('chart-jamforelse-avvikelse');
        const diag = document.getElementById('jmf-diagram'); if (diag) diag.innerHTML = '';
        return;
    }

    const { rader: alla, utelamnade } = jamforelseUnderlag();
    _jmfVal.bas = _jmfFyllVal(document.getElementById('jmf-bas'), [...new Set(alla.map(r => r.bas))].sort(), _jmfVal.bas);
    _jmfVal.sektor = _jmfFyllVal(document.getElementById('jmf-sektor'), [...new Set(alla.map(r => r.sektor))].sort(_aidJamforSektor), _jmfVal.sektor);
    const rader = alla.filter(r => (!_jmfVal.bas || r.bas === _jmfVal.bas) && (!_jmfVal.sektor || r.sektor === _jmfVal.sektor));
    const kalla = jamforelseAktivKalla();

    // Rubrikerna för jmf-kolumnerna namnger källan, så att exporterna säger vad som jämförs.
    const kallaNamn = _jmfKallaNamn(kalla);
    document.querySelectorAll('#benchmark-thead th[data-jmf]').forEach(th => {
        const p = /** @type {HTMLElement} */ (th).dataset.jmf;
        const text = /** @type {HTMLElement} */ (th).dataset.jmfTyp === 'diff' ? `${p} skillnad mot ${kallaNamn} (%)` : `${p} ${kallaNamn} (kr/mån)`;
        th.setAttribute('data-export-label', text);
        /** @type {HTMLElement} */ (th).title = text;
    });
    // Organisationens kolumner namnger organisationen när den har ett namn (ADR-36).
    document.querySelectorAll('#benchmark-thead th.jmf-block').forEach(th => {
        const p = /** @type {HTMLElement} */ (th).dataset.pctl || (/** @type {HTMLElement} */ (th).dataset.pctl = th.textContent.trim().split(' ')[0]);
        th.textContent = `${p} ${orgNamn('org')}`;
        th.setAttribute('data-export-label', `${p} ${orgNamn('organisationen')} (kr/mån)`);
        /** @type {HTMLElement} */ (th).title = th.getAttribute('data-export-label') || '';
    });
    if (infoEl) {
        const saknas = kalla === 'statistik' ? [!state.statistikHasP10 && 'P10', !state.statistikHasP90 && 'P90'].filter(Boolean) : [];
        infoEl.textContent = `Jmf = ${_jmfKallaNamn(kalla)}.` + (saknas.length ? ` ${saknas.join(' och ')} saknas i jämförelsestatistiken.` : '');
        infoEl.classList.toggle('warn', saknas.length > 0);
    }

    const fmt = new Intl.NumberFormat('sv-SE', { style: 'currency', currency: 'SEK', maximumFractionDigits: 0 });
    const kr = v => (v == null ? '–' : fmt.format(Math.round(v)));
    const diffCell = dd => (dd == null
        ? '<td class="num muted" data-sort-value="">–</td>'
        : `<td class="num ${dd.pct < 0 ? 'jmf-neg' : 'jmf-pos'}" data-sort-value="${dd.pct.toFixed(2)}" title="${dd.kr >= 0 ? '+' : '−'}${fmt.format(Math.abs(Math.round(dd.kr)))}">${dd.pct >= 0 ? '+' : '−'}${Math.abs(dd.pct).toFixed(1).replace('.', ',')} %</td>`);
    const block = (r, p) => `<td class="num jmf-block" data-sort-value="${r.org[p] ?? ''}">${kr(r.org[p])}</td>`
        + `<td class="num muted" data-sort-value="${r[kalla][p] ?? ''}">${kr(r[kalla][p])}</td>${diffCell(r.diff[kalla][p])}`;

    let html = '', curBas = null;
    for (const r of rader) {
        if (r.bas !== curBas) { curBas = r.bas; html += `<tr class="group-header"><td colspan="12">BAS ${esc(r.bas)}</td></tr>`; }
        html += `<tr data-rad="${esc(r.aid)}|${esc(r.bas)}"><td>${esc(r.yrke)}</td><td>${esc(r.bas)}</td><td class="num" data-sort-value="${r.n}">${r.n}</td>`
            + `${block(r, 'p10')}${block(r, 'median')}${block(r, 'p90')}</tr>`;
    }
    tbody.innerHTML = html || '<tr><td colspan="12" class="farg-dampad pad-24 ta-mitt">Inga yrken i urvalet.</td></tr>';
    try { ritaJamforelseDiagram(rader, kalla); } catch (e) { rapporteraFel('Jämförelse: diagrammen', e); }

    // Antalen gäller samma urval som tabellen (filtren på BAS och sektor).
    const utanMatch = rader.filter(r => r[kalla].median == null).length;
    const iUrval = namn => {
        const m = namn.match(/^(.*) \(BAS (.*)\)$/);
        return !m || ((!_jmfVal.bas || m[2] === _jmfVal.bas) && (!_jmfVal.sektor || _aidSektorsnamn(m[1]) === _jmfVal.sektor));
    };
    const utelamnadeIUrval = utelamnade.filter(iUrval);
    const urval = jamforelseUrvalText();
    setAudit('benchmark', {
        title: 'Jämförelsestatistik',
        ...buildBaseAudit(),
        usedInAnalysis: rader.length,
        analysisExclusions: [
            ...(urval ? [[esc(urval), '']] : []),
            ...(utelamnadeIUrval.length ? [[`Yrke×BAS-grupper för små (k-anonymitet n&lt;${kTroskel()})`, utelamnadeIUrval.length]] : []),
            ...(utanMatch ? [[`Yrke×BAS-grupper utan median i ${esc(_jmfKallaNamn(kalla))}`, utanMatch]] : [])
        ],
        formler: [
            ['AID-kod (matchningsnyckel)', 'Inledande sifferprefix av yrkesnamn (t.ex. "402010 Förskollärare" ger 402010)'],
            ['Percentiler', '<code>P10 = kvantil 0,1</code>, <code>median</code>, <code>P90 = kvantil 0,9</code> av organisationens löner i yrke och BAS'],
            ['Diff (%)', '<code>(organisationens värde / jämförelsens värde − 1) × 100</code>, per percentil'],
            ['Matchning', 'Jämförelsestatistiken: först AID + BAS, annars AID utan BAS. Ställningstagandet: AID + BAS, annars AID, annars BAS']
        ],
        notes: [
            'Negativ skillnad (röd) = organisationen ligger under jämförelsen',
            'Positiv skillnad (grön) = över jämförelsen (kan motiveras av specialistkompetens, marknadsläge)'
        ]
    });
}

document.getElementById('jmf-bas')?.addEventListener('change', e => { jamforelseSattVal({ bas: /** @type {HTMLInputElement} */ (e.target).value }); generateBenchmark(); });
document.getElementById('jmf-sektor')?.addEventListener('change', e => { jamforelseSattVal({ sektor: /** @type {HTMLInputElement} */ (e.target).value }); generateBenchmark(); });

// ---- Diagrammen ----
const _JMF_MAX = 25;
const _jmfEtikett = r => `${r.yrke} · BAS ${r.bas}`;
const _jmfPct = v => `${v >= 0 ? '+' : '−'}${Math.abs(v).toFixed(1).replace('.', ',')} %`;

function ritaJamforelseDiagram(rader, kalla) {
    const host = document.getElementById('jmf-diagram');
    if (!host) return;
    const namn = _jmfKallaNamn(kalla);
    // Behållarna byts ut nedan: släpp först figurerna i de gamla.
    rensaFigur('chart-jamforelse-spann'); rensaFigur('chart-jamforelse-avvikelse');
    host.innerHTML = `
        <h3 class="jmf-diagram-rubrik">Var ligger vi i marknadens spann?</h3>
        <div class="jmf-diagram-yta"><div id="chart-jamforelse-spann"></div></div>
        <p id="jmf-spann-not" class="muted"></p>
        <h3 class="jmf-diagram-rubrik">Vilka yrken avviker mest?</h3>
        <div class="jmf-diagram-yta"><div id="chart-jamforelse-avvikelse"></div></div>
        <p id="jmf-avvikelse-not" class="muted"></p>`;
    if (!rader.length) {
        /** @type {HTMLElement} */ (document.getElementById('jmf-spann-not')).textContent = 'Inga yrken i urvalet.';
        /** @type {HTMLElement} */ (document.getElementById('jmf-avvikelse-not')).textContent = 'Inga yrken i urvalet.';
        return;
    }
    try { _ritaJmfSpann(rader, kalla, namn); } catch (e) { rapporteraFel('Jämförelse: spanndiagrammet', e); }
    try { _ritaJmfAvvikelse(rader, kalla, namn); } catch (e) { rapporteraFel('Jämförelse: avvikelsediagrammet', e); }
}

function _ritaJmfSpann(rader, kalla, namnLitet) {
    const namn = namnLitet.charAt(0).toUpperCase() + namnLitet.slice(1);   // förklaringen börjar med versal
    // De största yrkena (flest anställda) om urvalet är stort, i tabellens ordning (BAS, yrke).
    const visa = rader.length > _JMF_MAX
        ? [...rader].sort((a, b) => b.n - a.n).slice(0, _JMF_MAX).sort((a, b) => rader.indexOf(a) - rader.indexOf(b))
        : rader;
    const not = /** @type {HTMLElement} */ (document.getElementById('jmf-spann-not'));
    const saknarBand = visa.some(r => r[kalla].p10 == null || r[kalla].p90 == null);
    not.textContent = (rader.length > _JMF_MAX ? `Visar de ${_JMF_MAX} största yrkena av ${rader.length} — tabellen har alla. ` : '')
        + (saknarBand ? `Där ${namnLitet} saknar P10 eller P90 visas bara medianen.` : '');
    ritaFigur('chart-jamforelse-spann', _jmfSpannFigur(visa, kalla, namn, namnLitet));
}

// Spanndiagrammets figur (diagramkärnan, ADR-39): spann som märket `intervall`, inte överlagrade staplar med
// bas. Referensens spann ligger brett bakom organisationens smala.
function _jmfSpannFigur(visa, kalla, namn, namnLitet) {
    const etikett = _jmfEtikett, ref = r => r[kalla];
    const harBand = v => v.p10 != null && v.p90 != null;
    const kr = v => _figTalformat(v, 'kr');
    const refNamn = plotNamn(namn), org = plotNamn(orgNamn());
    return { beskrivning: `Organisationens lönespann från P10 till P90 per yrke, med medianen som prick, ovanpå spannet i ${namnLitet}. Samma värden står i tabellen nedan.`,
        x: { skala: 'linjar', titel: 'Månadslön (kr)', format: 'kr' }, y: { skala: 'band', ordning: visa.map(etikett), etikettMax: 48 },
        hojd: 110 + 26 * visa.length, paneler: 'auto',   // fler än femton yrken: små multiplar
        lager: [
            { marke: 'intervall', riktning: 'liggande', serie: `${refNamn} P10–P90`, farg: PALETTE.semantic.spann, tjocklek: 14,
              data: visa.filter(r => harBand(ref(r))).map(r => ({ y: etikett(r), lag: ref(r).p10, hog: ref(r).p90, markering: markeringFor(r.bas, r.aid) })),
              tips: d => [[d.y], [`${refNamn} P10–P90`, `${_figTalformat(d.lag, 'kr', { enhet: false })}–${kr(d.hog)}`]] },
            { marke: 'intervall', riktning: 'liggande', serie: `${org} P10–P90`, farg: PALETTE.serie[0], tjocklek: 7,
              data: visa.map(r => ({ y: etikett(r), lag: r.org.p10, hog: r.org.p90, markering: markeringFor(r.bas, r.aid) })),
              tips: d => [[d.y], ['Organisationen', `${_figTalformat(d.lag, 'kr', { enhet: false })}–${kr(d.hog)}`]] },
            { marke: 'punkt', symbol: 'streck', serie: `${refNamn} median`, farg: PALETTE.semantic.linje, storlek: 5,
              data: visa.filter(r => ref(r).median != null).map(r => ({ y: etikett(r), x: ref(r).median })), tips: d => [[d.y], [`${refNamn} median`, kr(d.x)]] },
            { marke: 'punkt', serie: `${org} median`, farg: PALETTE.semantic.trend, storlek: 4.5,
              data: visa.map(r => ({ y: etikett(r), x: r.org.median, markering: markeringFor(r.bas, r.aid) })), tips: d => [[d.y], ['Organisationen median', kr(d.x)]] }
        ].filter(l => l.data.length) };
}

function _ritaJmfAvvikelse(rader, kalla, namn) {
    const rang = _jfRangordning(rader, kalla);
    const not = /** @type {HTMLElement} */ (document.getElementById('jmf-avvikelse-not'));
    if (!rang.length) { not.textContent = `Inga yrken har en median i både organisationen och ${namn}.`; return; }
    // Vid stort urval: de 25 med störst avvikelse (åt båda hållen), i rangordning.
    const visa = rang.length > _JMF_MAX
        ? [...rang].sort((a, b) => Math.abs(b.diff[kalla].median.pct) - Math.abs(a.diff[kalla].median.pct)).slice(0, _JMF_MAX)
            .sort((a, b) => a.diff[kalla].median.pct - b.diff[kalla].median.pct)
        : rang;
    not.textContent = rang.length > _JMF_MAX ? `Visar de ${_JMF_MAX} yrkena med störst avvikelse av ${rang.length} — tabellen har alla.` : '';
    // Klick på ett yrke markerar dess rad i tabellen.
    ritaFigur('chart-jamforelse-avvikelse', _jmfAvvikelseFigur(visa, kalla, namn), { vidKlick: d => { if (d && d.aid != null) jamforelseMarkeraRad(d.aid, d.bas); } });
}

// Skillnaden mot referensen per yrke: medianen som punkt, och skillnaden i P10 och P90 som två streck med ett tunt
// spann emellan. Raden läses som ett läge mot nollinjen (ingen skillnad): ligger hela spannet till vänster ligger
// yrket under referensen i hela lönefördelningen, inte bara i medianen. Medianens värde står utskrivet till höger
// om radens yttersta märke, så att det aldrig hamnar under ett annat märke.
function _jmfAvvikelseFigur(visa, kalla, namn) {
    const diff = (r, m) => (r.diff[kalla][m] ? r.diff[kalla][m].pct : null);
    const varden = r => ['p10', 'median', 'p90'].map(m => diff(r, m)).filter(v => v != null);
    const bas = r => ({ y: _jmfEtikett(r), aid: r.aid, bas: r.bas, markering: markeringFor(r.bas, r.aid) });
    const tipsRad = r => [[_jmfEtikett(r)], ...[['P10', 'p10'], ['Median', 'median'], ['P90', 'p90']].filter(([, m]) => diff(r, m) != null).map(([t, m]) => [t, _jmfPct(diff(r, m))])];
    const streck = (serie, farg, m) => ({ marke: 'punkt', symbol: 'streck', serie, farg, storlek: 5,
        data: visa.filter(r => diff(r, m) != null).map(r => ({ ...bas(r), x: diff(r, m), r })), tips: d => tipsRad(d.r) });
    return { beskrivning: `Skillnaden i lön mot ${namn} per yrke, rangordnad från mest negativ: medianen som punkt, och skillnaden i P10 och P90 som streck med ett spann emellan. Samma värden står i tabellen nedan.`,
        x: { skala: 'linjar', titel: `Skillnad mot ${namn} (%)`, nollinje: true }, y: { skala: 'band', ordning: visa.map(_jmfEtikett), etikettMax: 48 },
        hojd: 110 + 28 * visa.length, paneler: 'auto',
        lager: [
            { marke: 'intervall', riktning: 'liggande', serie: 'Spann P10–P90', farg: PALETTE.semantic.spann, tjocklek: 4, legend: false,
              data: visa.filter(r => varden(r).length > 1).map(r => ({ ...bas(r), lag: Math.min(...varden(r)), hog: Math.max(...varden(r)), r })), tips: d => tipsRad(d.r) },
            // Etiketten bärs av en egen, genomskinlig punkt vid radens yttersta märke (lika stor som medianpunkten, så att
            // texten hamnar utanför den).
            { marke: 'punkt', serie: 'Medianens värde', farg: PALETTE.semantic.spann, storlek: 6, opacitet: 0, etikettLage: 'hoger', legend: false, utanData: true,
              data: visa.filter(r => diff(r, 'median') != null).map(r => ({ y: _jmfEtikett(r), x: Math.max(...varden(r)), etikett: _jmfPct(diff(r, 'median')) })) },
            streck('Skillnad i P10', FARG.blek, 'p10'), streck('Skillnad i P90', PALETTE.semantic.mork, 'p90'),
            { marke: 'punkt', serie: 'Skillnad i median', farg: PALETTE.serie[0], storlek: 6,
              data: visa.filter(r => diff(r, 'median') != null).map(r => ({ ...bas(r), x: diff(r, 'median'), r })), tips: d => tipsRad(d.r) }
        ].filter(l => l.data.length) };
}

// ---- OLS Regression: oförklarad löneskillnad ----
// Standardmetod (Medlingsinstitutet/EU 2023/970): log(lön) ~ kön + ålder + BAS-intervall (indikatorvariabler)
/**
 * Standardnormal CDF Φ(x) via Abramowitz & Stegun 26.2.17 (5 termer, abs.fel < 7.5e-8).
 * @param {number} x
 * @returns {number} Φ(x) ∈ [0,1]
 */

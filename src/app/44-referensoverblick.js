// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson

// ---- Överblicken i Löneläget: löneläget och statistiken mot ställningstagandet (ADR-55) ----
// Beräkningen är src/lib/referenser.js. Ställningstagandet är referenspunkten: dess kolumner och rader står först,
// och orden säger var löneläget och statistiken ligger mot det, aldrig tvärtom.
const _RR_MAX = 25;

/** Överblicken ur Jämförelses rader, med den referens som finns; null utan underlag eller utan någon referens. */
function referensOverblick() {
    const harStatistik = state.statistik.length > 0, harStallningstagande = state.policy.length > 0;
    if (!getData().length || (!harStatistik && !harStallningstagande)) return null;
    return _rrOverblick(jamforelseUnderlag().rader, { harStatistik, harStallningstagande,
        statistikHarSpann: !!state.statistikHasP10 && !!state.statistikHasP90 });
}
// Läget i spannet är ett index: rubriken säger skalan, verktygstipset vad talet betyder.
const _RR_LAGE_TIPS = 'Var gruppens medianlön ligger i referensens spann: 0 är referensens P10 och 100 dess P90. Under 0 ligger medianen nedanför spannet, över 100 ovanför. Orden före talet säger samma sak.';
const _RR_MATCHNING_TIPS = 'Hur yrkesgruppen matchades mot jämförelsestatistiken. AID + BAS: en rad med samma AID och samma BAS. Endast AID: det finns ingen sådan rad, så en rad med samma AID som saknar BAS används. En rad för ett annat BAS-intervall används aldrig. – betyder att statistik saknas för gruppen.';
const _rrPct = v => (v == null ? '–' : `${v >= 0 ? '+' : '−'}${svTal(Math.abs(v), 1)} %`);
const _rrSkillnad = (org, ref) => (org != null && ref != null ? (org / ref - 1) * 100 : null);
const _rrLageText = l => (l.pos == null ? '–' : `${l.ord} (${svTal(l.pos, 0)})`);

// Skärmtabellens och Excel-bladets kolumner, i samma ordning. Ställningstagandets kolumner står före statistikens.
function _rrKolumner({ harStatistik, harStallningstagande }) {
    const per = [['P10', 'p10'], ['Median', 'median'], ['P90', 'p90']];
    const skillnad = (kort, nyckel) => per.map(([t, p]) => ({ rubrik: `${t} mot ${kort} (%)`, typ: 'pct', varde: g => _rrSkillnad(g.org[p], g[nyckel][p]) }));
    const lage = g => [harStallningstagande && _rrLageText(g.lage.stallningstagande), harStatistik && _rrLageText(g.lage.statistik)].filter(Boolean).join(' · ');
    return [
        { rubrik: 'Yrkesgrupp', typ: 'text', varde: g => `${g.yrke} · BAS ${g.bas}` },
        // Statistikens matchning (samma ord som tabellen mot jämförelsestatistiken), bara när statistik finns.
        ...(harStatistik ? [{ rubrik: 'Matchning', tips: _RR_MATCHNING_TIPS, typ: 'text', varde: g => _jfMatchningEtikett(g.statistikMatchning),
            sortering: g => ({ 'aid-bas': 1, aid: 2 })[g.statistikMatchning] || 3 }] : []),
        { rubrik: 'n', typ: 'antal', varde: g => g.n },
        ...per.map(([t, p]) => ({ rubrik: `${t} (kr/mån)`, typ: 'kr', varde: g => g.org[p] })),
        ...(harStallningstagande ? skillnad('ställn.', 'stallningstagande') : []),
        ...(harStatistik ? skillnad('stat.', 'statistik') : []),
        { rubrik: harStatistik && harStallningstagande ? 'Läge i spannet, ställn. · stat. (0 = P10, 100 = P90)' : 'Läge i spannet (0 = P10, 100 = P90)', tips: _RR_LAGE_TIPS,
          typ: 'text', varde: lage, sortering: g => (harStallningstagande ? g.lage.stallningstagande.pos : g.lage.statistik.pos) ?? '' },
        // Mönstret i ord; förslaget på referens bara när det skiljer sig från ställningstagandet (src/lib/referenser.js)
        { rubrik: 'Läge och förslag', typ: 'text', varde: g => g.lageOchForslag }
    ];
}

function _rrTabellHtml(kolumner, grupper) {
    const cell = (k, g) => {
        const v = k.varde(g);
        if (k.typ === 'text') return `<td${k.sortering ? ` data-sort-value="${k.sortering(g)}"` : ''}>${esc(v) || '–'}</td>`;
        if (v == null) return '<td class="num muted" data-sort-value="">–</td>';
        if (k.typ === 'pct') return `<td class="num" data-sort-value="${v.toFixed(2)}">${_rrPct(v)}</td>`;
        return `<td class="num" data-sort-value="${v}">${svTal(v, 0)}</td>`;
    };
    return `<div class="table-container"><table id="ref-tabell" class="data-table" aria-label="Löneläget och statistiken mot ställningstagandet per yrkesgrupp"><thead><tr>`
        + kolumner.map(k => `<th scope="col"${k.tips ? ` title="${esc(k.tips)}"` : ''}>${esc(k.rubrik)}</th>`).join('')
        + `</tr></thead><tbody>${grupper.map(g => `<tr>${kolumner.map(k => cell(k, g)).join('')}</tr>`).join('')}</tbody></table></div>`;
}

function _rrTalHtml(tal, { harStatistik, harStallningstagande }) {
    const ruta = (etikett, varde) => `<div class="stat-box"><div class="stat-etikett">${esc(etikett)}</div><div class="stat-val">${esc(varde)}</div></div>`;
    const monsterRuta = (etikett, m) => ruta(etikett, `${m.grupper} · ${svPct(m.andel, 0)}`);
    const pm = tal.perMonster;
    return '<div class="summary-stats">' + [
        ruta('Yrkesgrupper', String(tal.antalGrupper)),
        ...(harStatistik && harStallningstagande ? [
            monsterRuta('Båda över ställningstagandet', pm.badaOver), monsterRuta('Bara löneläget över', pm.baraLonelageOver),
            monsterRuta('Bara statistiken över', pm.baraStatistikOver), monsterRuta('Båda inom', pm.badaInom),
            ruta('Förslaget är statistiken', `${tal.forslagStatistik} ${tal.forslagStatistik === 1 ? 'grupp' : 'grupper'}`)] : []),
        ...(harStallningstagande ? [ruta('Medianen mot ställningstagandet', _rrPct(tal.vagdMedianMotStallningstagandePct))] : []),
        ...(harStatistik ? [ruta('Medianen mot statistiken', _rrPct(tal.vagdMedianMotStatistikPct))] : [])
    ].join('') + '</div>';
}

// En rad per yrkesgrupp på en gemensam lönelinje, med ställningstagandet, statistiken och organisationen bredvid
// varandra i raden: bandet är P10–P90, strecket medianen. Serierna skiljs med färg och förklaring, så att radens
// etikett bara behöver säga yrkesgruppen. En referens med bara median får inget band, bara strecket.
function _rrHantelFigur(rader, { harStatistik }) {
    const serier = [
        { namn: 'Ställningstagandet', nyckel: 'stallningstagande', farg: PALETTE.semantic.neutral },
        ...(harStatistik ? [{ namn: 'Statistiken', nyckel: 'statistik', farg: PALETTE.semantic.trend }] : []),
        { namn: 'Organisationen', nyckel: 'org', farg: PALETTE.semantic.mork }
    ];
    const steg = serier.length === 3 ? 0.27 : 0.2;   // seriernas läge i raden, i andelar av radens höjd
    const kr = v => _figTalformat(v, 'kr');
    const lager = serier.flatMap((s, i) => {
        const forskjutning = (i - (serier.length - 1) / 2) * steg;
        const med = rader.map(r => ({ y: r.namn, bas: r.bas, n: r.n, v: r[s.nyckel] })).filter(d => d.v && d.v.median != null);
        return [
            { marke: 'intervall', riktning: 'liggande', serie: s.namn, farg: s.farg, tjocklek: 8, opacitet: 0.45,
              data: med.filter(d => d.v.p10 != null && d.v.p90 != null).map(d => ({ y: d.y, lag: d.v.p10, hog: d.v.p90, forskjutning, ...(d.bas != null ? { bas: d.bas } : {}), ...(d.n != null ? { n: d.n } : {}) })),
              tips: d => [[d.y], [s.namn], ['P10–P90', `${_figTalformat(d.lag, 'kr', { enhet: false })}–${kr(d.hog)}`]] },
            { marke: 'punkt', symbol: 'streck', serie: s.namn, farg: s.farg, storlek: 5,
              data: med.map(d => ({ y: d.y, x: d.v.median, forskjutning, ...(d.bas != null ? { bas: d.bas } : {}), ...(d.n != null ? { n: d.n } : {}) })), tips: d => [[d.y], [s.namn], ['Median', kr(d.x)]] }
        ];
    });
    return { beskrivning: `Månadslönen per yrkesgrupp, med ${serier.map(s => s.namn.toLowerCase()).join(', ').replace(/, ([^,]*)$/, ' och $1')} bredvid varandra i raden; ställningstagandet är referenspunkten. Bandet är P10–P90 och strecket medianen. Samma värden står i tabellen ovanför.`,
        urval: [URVAL.bas, URVAL.antal], x: { skala: 'linjar', format: 'kr', titel: 'Månadslön (kr)' }, y: { skala: 'band', ordning: rader.map(r => r.namn), etikettMax: 40 },
        hojd: 80 + serier.length * 18 * rader.length,
        lager };
}

function _rrStatTabellHtml(rader) {
    return `<h3 class="jmf-diagram-rubrik">Statistiken mot ställningstagandet</h3>
        <p class="muted">Positivt: statistiken ligger över ställningstagandet. Negativt: statistiken ligger under det. Organisationens löner ingår inte.</p>
        <div class="table-container"><table id="ref-stat-mot-stallning" class="data-table" aria-label="Statistiken mot ställningstagandet per yrkesgrupp"><thead><tr>
        <th scope="col">Yrkesgrupp</th><th scope="col">BAS</th><th scope="col">P10 (%)</th><th scope="col">Median (%)</th><th scope="col">P90 (%)</th></tr></thead><tbody>`
        + rader.map(r => `<tr><td>${esc(r.yrke)}</td><td>${esc(r.bas)}</td>${['p10', 'median', 'p90'].map(p => (r[p] == null
            ? '<td class="num muted" data-sort-value="">–</td>' : `<td class="num" data-sort-value="${r[p].toFixed(2)}">${_rrPct(r[p])}</td>`)).join('')}</tr>`).join('')
        + '</tbody></table></div>';
}

/** Excel-bladet Referenser: skärmens lista med tal som tal, följt av statistiken mot ställningstagandet. */
function _rrExcelBlad() {
    const o = referensOverblick();
    if (!o) return null;
    const har = { harStatistik: state.statistik.length > 0, harStallningstagande: state.policy.length > 0 };
    const pct = v => (v == null ? '' : Math.round(v * 100) / 100);
    const kolumner = _rrKolumner(har);
    const cell = (k, g) => { const v = k.varde(g); return k.typ === 'pct' ? pct(v) : k.typ === 'kr' ? (v == null ? '' : Math.round(v)) : v ?? ''; };
    return [
        ['Löneläget och statistiken mot ställningstagandet (fliken Löneläget)'],
        [`Minsta gruppstorlek ${kTroskel()}: yrkesgrupper med färre personer redovisas inte. Ställningstagandet är referenspunkten.`], [],
        kolumner.map(k => k.rubrik),
        ...o.grupper.map(g => kolumner.map(k => cell(k, g))),
        ...(har.harStatistik && har.harStallningstagande ? [[], ['Statistiken mot ställningstagandet (%)'], ['Yrkesgrupp', 'BAS', 'P10', 'Median', 'P90'],
            ...o.statistikMotStallningstagande.map(r => [r.yrke, r.bas, pct(r.p10), pct(r.median), pct(r.p90)])] : [])
    ];
}

/** Utskriftens bilaga: listan ur överblicken och statistiken mot ställningstagandet. cloneTable går genom exportgrinden. */
function _utskriftReferenserHtml(cloneTable) {
    if (!state.policy.length && !state.statistik.length) return '';
    return `<section class="page-break"><h2>Löneläget och statistiken mot ställningstagandet</h2>${cloneTable('ref-tabell')}${cloneTable('ref-stat-mot-stallning')}</section>`;
}

// Flikens topp: vilka referenser som finns, och hur många grupper som ligger utanför ställningstagandet.
function _rrRitaTopp(o, { harStatistik, harStallningstagande }) {
    const host = document.getElementById('jmf-slutsatser');
    if (!host) return;
    if (!o) { host.innerHTML = ''; return; }
    const antal = villkor => o.grupper.filter(villkor).length;
    const grupper = n => `${n} ${n === 1 ? 'yrkesgrupp' : 'yrkesgrupper'}`;
    host.innerHTML = _laSlutsats('Referenser', harStatistik && harStallningstagande ? 'Båda' : harStatistik ? 'Statistiken' : 'Ställningstagandet',
            harStatistik && harStallningstagande ? 'Ställningstagandet är referenspunkten' : 'Bara den referensen är inläst')
        + (harStallningstagande ? _laSlutsats('Löneläget utanför ställningstagandet', grupper(antal(g => g.monster.lonelage === 'ovanför' || g.monster.lonelage === 'nedanför')), `av ${o.tal.antalGrupper}`) : '')
        + (harStatistik && harStallningstagande ? _laSlutsats('Statistiken över ställningstagandet', grupper(antal(g => g.monster.statistik === 'över')), `av ${o.tal.antalGrupper}`) : '');
}

function renderReferensOverblick() {
    const host = document.getElementById('ref-overblick');
    if (!host) return;
    rensaFigur('chart-ref-hantel');
    const o = referensOverblick();
    _rrRitaTopp(o, { harStatistik: state.statistik.length > 0, harStallningstagande: state.policy.length > 0 });
    if (!o) { host.innerHTML = '<p class="muted">Ingen referens är inläst. Läs in ett ställningstagande eller jämförelsestatistik under Filer och kvalitet.</p>'; return; }
    const har = { harStatistik: state.statistik.length > 0, harStallningstagande: state.policy.length > 0 };
    const saknas = [!har.harStatistik && 'Jämförelsestatistik saknas — läs in den under Filer och kvalitet.', !har.harStallningstagande && 'Ställningstagande saknas — läs in det under Filer och kvalitet.'].filter(Boolean);
    const utanSpann = har.harStatistik && (!state.statistikHasP10 || !state.statistikHasP90);
    const flera = o.grupper.length > _RR_MAX;
    host.innerHTML = `${saknas.map(s => `<p class="urvalsrad">${esc(s)}</p>`).join('')}
        <p class="muted">Ställningstagandet är referenspunkten: löneläget och statistiken mäts mot det. Läget är var medianen ligger i spannet (0 = P10, 100 = P90). Ett förslag på referens står bara med när det inte är ställningstagandet, och det är ett förslag, ingen regel.</p>
        ${_rrTalHtml(o.tal, har)}
        ${_rrTabellHtml(_rrKolumner(har), o.grupper)}
        <h3 class="jmf-diagram-rubrik">Lönerna mot ställningstagandet och statistiken</h3>
        <div class="jmf-diagram-yta"><div id="chart-ref-hantel"></div></div>
        <p class="muted">${flera ? `Visar de ${_RR_MAX} första yrkesgrupperna av ${o.grupper.length} — tabellen har alla. ` : ''}${utanSpann ? 'P10 och P90 saknas i jämförelsestatistiken: den visas bara med sin median.' : ''}</p>
        ${har.harStatistik && har.harStallningstagande ? _rrStatTabellHtml(o.statistikMotStallningstagande) : ''}`;
    try { ritaFigur('chart-ref-hantel', _rrHantelFigur(_rrHantelRader(o.grupper.slice(0, _RR_MAX)), har)); } catch (e) { rapporteraFel('Löneläget: överblickens bild', e); }
    addTableExportTools('ref-tabell', 'referenser');
    enableTableSort('ref-tabell');
    enableTableSort('ref-stat-mot-stallning');
}

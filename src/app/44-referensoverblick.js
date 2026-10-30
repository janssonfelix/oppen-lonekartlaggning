// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson

// ---- Överblicken i Jämförelse: löneläget och statistiken mot ställningstagandet (ADR-55) ----
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
const _rrForslagNamn = { stallningstagande: 'Ställningstagandet', statistik: 'Statistiken' };
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
        { rubrik: 'n', typ: 'antal', varde: g => g.n },
        ...per.map(([t, p]) => ({ rubrik: `${t} (kr/mån)`, typ: 'kr', varde: g => g.org[p] })),
        ...(harStallningstagande ? skillnad('ställn.', 'stallningstagande') : []),
        ...(harStatistik ? skillnad('stat.', 'statistik') : []),
        { rubrik: harStatistik && harStallningstagande ? 'Läge (ställn. · stat.)' : 'Läge i spannet', typ: 'text', varde: lage,
          sortering: g => (harStallningstagande ? g.lage.stallningstagande.pos : g.lage.statistik.pos) ?? '' },
        { rubrik: 'Mönster', typ: 'text', varde: g => g.monster.text },
        { rubrik: 'Förslag på referens', typ: 'text', varde: g => (g.forslag.referens ? `${_rrForslagNamn[g.forslag.referens]}: ${g.forslag.skal}` : '–') }
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
        + kolumner.map(k => `<th scope="col">${esc(k.rubrik)}</th>`).join('')
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
            ruta('Förslaget är statistiken', `${tal.forslagStatistik} grupper`)] : []),
        ...(harStallningstagande ? [ruta('Medianen mot ställningstagandet', _rrPct(tal.vagdMedianMotStallningstagandePct))] : []),
        ...(harStatistik ? [ruta('Medianen mot statistiken', _rrPct(tal.vagdMedianMotStatistikPct))] : [])
    ].join('') + '</div>';
}

// Tre rader per yrkesgrupp på en gemensam lönelinje: bandet är P10–P90, strecket medianen. Färgen sitter på punkterna,
// för raden säger redan vad den visar. En referens med bara median får inget band, bara strecket.
function _rrHantelFigur(rader, { harStatistik }) {
    const delar = r => [
        ['ställningstagandet', r.stallningstagande, PALETTE.semantic.neutral],
        ...(harStatistik ? [['statistiken', r.statistik, PALETTE.semantic.trend]] : []),
        ['organisationen', r.org, PALETTE.semantic.mork]
    ].map(([namn, v, farg]) => ({ namn: r.namn, y: `${r.namn} · ${namn}`, v, farg }));
    const alla = rader.flatMap(delar), kr = v => _figTalformat(v, 'kr');
    const med = alla.filter(d => d.v && d.v.median != null);
    return { beskrivning: 'Månadslönen per yrkesgrupp på tre rader: ställningstagandet, som är referenspunkten, statistiken och organisationen. Bandet är P10–P90 och strecket medianen. Samma värden står i tabellen ovanför.',
        x: { skala: 'linjar', format: 'kr', titel: 'Månadslön (kr)' }, y: { skala: 'band', ordning: alla.map(d => d.y), etikettMax: 48 },
        hojd: 60 + 3 * 20 * rader.length,
        lager: [
            { marke: 'intervall', riktning: 'liggande', serie: 'P10–P90', farg: PALETTE.semantic.neutral, tjocklek: 10, opacitet: 0.45, legend: false,
              data: med.filter(d => d.v.p10 != null && d.v.p90 != null).map(d => ({ y: d.y, lag: d.v.p10, hog: d.v.p90, farg: d.farg })),
              tips: d => [[d.y], ['P10–P90', `${_figTalformat(d.lag, 'kr', { enhet: false })}–${kr(d.hog)}`]] },
            { marke: 'punkt', symbol: 'streck', serie: 'Median', farg: PALETTE.semantic.mork, storlek: 5, legend: false,
              data: med.map(d => ({ y: d.y, x: d.v.median, farg: d.farg })), tips: d => [[d.y], ['Median', kr(d.x)]] }
        ] };
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
    if (!o) { host.innerHTML = '<p class="muted">Ingen referens är inläst. Läs in ett ställningstagande eller jämförelsestatistik på Översikt.</p>'; return; }
    const har = { harStatistik: state.statistik.length > 0, harStallningstagande: state.policy.length > 0 };
    const saknas = [!har.harStatistik && 'Jämförelsestatistik saknas — läs in den på Översikt.', !har.harStallningstagande && 'Ställningstagande saknas — läs in det på Översikt.'].filter(Boolean);
    const utanSpann = har.harStatistik && (!state.statistikHasP10 || !state.statistikHasP90);
    const flera = o.grupper.length > _RR_MAX;
    host.innerHTML = `${saknas.map(s => `<p class="urvalsrad">${esc(s)}</p>`).join('')}
        <p class="muted">Ställningstagandet är referenspunkten: löneläget och statistiken mäts mot det. Läget är var medianen ligger i spannet (0 = P10, 100 = P90), och förslaget är ett förslag, ingen regel.</p>
        ${_rrTalHtml(o.tal, har)}
        ${_rrTabellHtml(_rrKolumner(har), o.grupper)}
        <h3 class="jmf-diagram-rubrik">Lönerna mot ställningstagandet och statistiken</h3>
        <div class="jmf-diagram-yta"><div id="chart-ref-hantel"></div></div>
        <p class="muted">${flera ? `Visar de ${_RR_MAX} första yrkesgrupperna av ${o.grupper.length} — tabellen har alla. ` : ''}${utanSpann ? 'P10 och P90 saknas i jämförelsestatistiken: den visas bara med sin median.' : ''}</p>
        ${har.harStatistik && har.harStallningstagande ? _rrStatTabellHtml(o.statistikMotStallningstagande) : ''}`;
    try { ritaFigur('chart-ref-hantel', _rrHantelFigur(_rrHantelRader(o.grupper.slice(0, _RR_MAX)), har)); } catch (e) { rapporteraFel('Jämförelse: överblickens bild', e); }
    addTableExportTools('ref-tabell', 'referenser');
    enableTableSort('ref-tabell');
    enableTableSort('ref-stat-mot-stallning');
}

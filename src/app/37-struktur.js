// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson

// ===================================================================
// Struktur & EU-rapport — representation/segregation, kvartilfördelning
// (EU 2023/970), distributionellt gap. Auto-rapportutkastet (renderStrukturUtkast) står i fliken Rapporttext.
// De rena måtten (_st*) genereras i src/app/09-lib-speglar.js från src/lib/struktur.js.
// ===================================================================

/**
 * Lönestrukturens mått, räknade på ett ställe för fliken, rapportutkastet i Rapporttext och EU-exporten: andelen
 * kvinnor, representationen per BAS, percentilerna, kvartilerna och gapet i median- och medellön. Könsuppdelade
 * mått kräver tröskeln för varje kön (ADR-12); lib-funktionerna får alltid tröskeln `k`.
 */
function _stMatt(d, k) {
    const konOk = _konFarRedovisasFor(d);
    const kv = d.filter(r => r.kon && r.kon.includes('kvinna')).map(r => r.lon);
    const ma = d.filter(r => r.kon === 'man' || r.kon === 'män').map(r => r.lon);
    const totKv = kv.length;
    const meanGap = (konOk && kv.length && ma.length) ? ((kv.reduce((s, x) => s + x, 0) / kv.length) / (ma.reduce((s, x) => s + x, 0) / ma.length) - 1) * 100 : null;
    return {
        konOk, kv, ma, totKv, totAndel: d.length ? 100 * totKv / d.length : 0, meanGap,
        rep: _stRepresentationByBas(d, { k }),
        dist: _stDistributionalGap(d, undefined, { k }),
        q: _stQuartileDistribution(d, { k }),
        medGap: _stMedianGapPct(d, { k }),
    };
}

function renderStructure() {
    const wrap = document.getElementById('view-struktur');
    if (!wrap) return;
    const d = getData();
    const repEl = document.getElementById('struktur-representation');
    const distEl = document.getElementById('struktur-distribution');
    const euEl = document.getElementById('struktur-eu');
    if (!d.length) {
        [repEl, distEl, euEl].forEach(el => { if (el) el.innerHTML = '<p class="farg-dampad pad-14">Läs in lönefilen först.</p>'; });
        _stRitaTopp(d, null);
        return;
    }
    const kr = n => n == null ? '–' : Math.round(n).toLocaleString('sv-SE') + ' kr';

    // (1) Representations-pyramid
    // Könsuppdelade mått kräver tröskeln för varje kön (ADR-12); lib-funktionerna får alltid värdet.
    const k = kTroskel();
    const { konOk, rep, totKv, totAndel, dist, q, medGap, ma, meanGap } = _stMatt(d, k);
    const konNot = konOk ? '' : `<p class="k-mask-note">${esc(_konUtelamnatNot())}</p>`;
    // k-anonymitet: lönemåtten (median, gap inom BAS) får inte redovisas för
    // BAS-intervall under tröskeln. Raden utelämnas helt i stället för att
    // fyllas med "< 10"-celler — andelen kvinnor ensam bär inte tabellen, och
    // de utelämnade BAS:en räknas upp i noten under.
    const repVisade = rep.filter(g => !isKMasked(g.n));
    const repUtelamnade = rep.filter(g => isKMasked(g.n)).map(g => g.bas);
    if (repEl) repEl.innerHTML = `
        <p class="text-dampad-sm marg-0-0-10">Andel kvinnor per BAS-intervall, i ordning A–Ö. Sjunker andelen kvinnor mot högre BAS-intervall (längre ner i tabellen) finns <strong>vertikal könssegregering</strong> (glastak). Det är en strukturell orsak till löneskillnaden.</p>
        ${repVisade.length ? `<table class="data-table st-088"><thead><tr><th>BAS</th><th class="t-hoger">n</th><th class="t-hoger">Median</th><th class="t-hoger">Andel kvinnor</th><th class="bredd-34p">Andel kvinnor (mot ${svPct(totAndel, 0)} totalt)</th><th class="t-hoger">Kvinnors median i % av mäns</th></tr></thead><tbody>
        ${repVisade.map(g => {
            const over = g.andelKv > totAndel + 10, under = g.andelKv < totAndel - 10;
            const col = over ? 'bg-rosa' : under ? 'bg-accent' : 'bg-ok';
            return `<tr><td><strong>${esc(g.bas)}</strong></td><td class="t-hoger">${g.n}</td><td class="t-hoger">${kr(g.median)}</td><td class="t-hoger">${svPct(g.andelKv, 0)}</td>
            <td><div class="bak-yta-stark rund-7 hojd-14 pos-relativ"><div class="pos-botten-2 pos-absolut pos-topp-2 bredd-2 bg-dampad" data-stil-vanster="${totAndel.toFixed(1)}%" title="Snitt ${svPct(totAndel, 0)}"></div><div class="rund-7 hojd-100p ${col}" data-stil-bredd="${g.andelKv.toFixed(1)}%"></div></div></td>
            <td class="t-hoger">${andelAvMan(g.gapPct)}${g.gapPct != null ? _direktivInline(100 + g.gapPct) : ''}</td></tr>`;
        }).join('')}
        </tbody></table>` : ''}
        ${kMaskNote(repUtelamnade, 'BAS-intervall|BAS-intervall')}
        ${kSamladNote(repVisade.filter(g => g.konLitet).map(g => g.bas), 'BAS-intervall|BAS-intervall')}`; if (repEl) tillampaDataStil(repEl);

    // (3) Distributionellt gap
    if (distEl) {
        if (!dist.length) { distEl.innerHTML = konNot || '<p class="f-dampad">För få av något kön för distributionsanalys.</p>'; }
        else {
            const p10 = dist.find(x => x.p === 10), p90 = dist.find(x => x.p === 90);
            let tolk = '';
            if (p10 && p90 && p10.gapPct != null && p90.gapPct != null) {
                if (Math.abs(p10.gapPct) > Math.abs(p90.gapPct) + 1) tolk = '<strong>Klibbigt golv:</strong> skillnaden är störst bland de lägst betalda. Granska ingångslöner och lägstanivåer.';
                else if (Math.abs(p90.gapPct) > Math.abs(p10.gapPct) + 1) tolk = '<strong>Glastak:</strong> skillnaden är störst bland de högst betalda. Granska befordran och lönesättning i toppen.';
                else tolk = 'Skillnaden är ungefär lika stor i hela lönefördelningen.';
            }
            const maxG = Math.max(...dist.map(x => Math.abs(x.gapPct || 0)), 0.01);
            distEl.innerHTML = `<p class="text-dampad-sm marg-0-0-10">Kvinnors lön i procent av mäns vid olika percentiler i fördelningen. Under 100 % betyder att kvinnor ligger lägre.</p>
            <div class="mb-10" id="chart-struktur-percentiler"></div>
            <table class="data-table st-088">${antalCaption(totKv, ma.length)}<thead><tr><th>Percentil</th><th class="t-hoger">Kvinnor</th><th class="t-hoger">Män</th><th class="t-hoger">Kvinnors lön i % av mäns</th><th class="bredd-32p"></th></tr></thead><tbody>
            ${dist.map(x => `<tr><td>P${x.p}</td><td class="t-hoger">${kr(x.kv)}</td><td class="t-hoger">${kr(x.ma)}</td><td class="t-hoger${x.gapPct < -5 ? ' fg-rosa halvfet' : ''}">${andelAvMan(x.gapPct)}</td><td><div class="rund-5 hojd-10 min-bredd-2 ${x.gapPct < 0 ? 'bg-rosa' : 'bg-ok'}" data-stil-bredd="${(Math.abs(x.gapPct || 0) / maxG * 100).toFixed(0)}%"></div></td></tr>`).join('')}
            </tbody></table>${tolk ? `<p class="fs-sm marg-8-0-0">${tolk}</p>` : ''}`; tillampaDataStil(distEl);
        }
    }

    // Percentilerna och kvartilerna kan räknas för en sektor eller ett BAS-intervall (figur.underlag): samma mått och
    // samma tröskel per kön, för de valda personerna. Resten är de övriga i lönefilen.
    const underlag = rita => ({ dimensioner: [UNDERLAG.sektor, UNDERLAG.bas], rader: d, k, rita });
    { const pEl = document.getElementById('chart-struktur-percentiler'); if (pEl && dist.length && dist.every(x => x.gapPct != null)) ritaFigur(pEl, { ..._strukturPercentilFigur(dist), underlag: underlag(_strukturPercentilFor) }); }

    // (2) EU 2023/970-rapportpaket
    const antal = n => (n == null ? '–' : n);
    // Diagrammet över kvartilerna ligger i kortets HTML, som byggs om här: den gamla behållaren släpps först.
    const kvGammal = document.getElementById('chart-struktur-kvartiler');
    if (kvGammal) rensaFigur(kvGammal);
    if (euEl) euEl.innerHTML = `
        <p class="text-dampad-sm marg-0-0-10">Måtten i direktivet. Här står kvinnors lön i procent av mäns, som i resten av verktyget, med direktivets löneskillnad under: skillnaden i procent av mäns lön, positiv när kvinnor ligger lägre.</p>
        <p class="text-dampad-sm marg-0-0-10"><strong>Lönebegrepp.</strong> ${EU_LONEBEGREPP_RESERVATION}</p>
        <div class="rutnat gap-12 kolumner-auto-180 marg-b-14">
            <div class="card m-0"><div class="text-dampad-xs">Kvinnors medellön i procent av mäns</div><div class="fs-lg fw-700">${andelAvMan(meanGap)}</div><div class="text-dampad-xs">Löneskillnad enligt direktivet: ${direktivGap(meanGap)}</div></div>
            <div class="card m-0"><div class="text-dampad-xs">Kvinnors medianlön i procent av mäns</div><div class="fs-lg fw-700">${andelAvMan(medGap)}</div><div class="text-dampad-xs">Löneskillnad enligt direktivet: ${direktivGap(medGap)}${medGap != null ? _direktivInline(100 + medGap) : ''}</div></div>
        </div>
        <strong class="block-mb6">Andel kvinnor/män per lönekvartil</strong>
        <div class="mb-10" id="chart-struktur-kvartiler"></div>
        <table class="data-table st-088"><thead><tr><th>Kvartil</th><th>Lönespann</th><th class="t-hoger">n</th><th class="t-hoger">Kvinnor</th><th class="t-hoger">Män</th><th class="t-hoger">Andel kvinnor</th></tr></thead><tbody>
        ${q.map(x => `<tr><td>Q${x.q}${x.q === 1 ? ' (lägst)' : x.q === 4 ? ' (högst)' : ''}</td><td>${_kvartilSpann(x, kr)}</td><td class="t-hoger">${x.n}</td><td class="t-hoger">${antal(x.nKv)}</td><td class="t-hoger">${antal(x.nMa)}</td><td class="t-hoger">${x.andelKv == null ? '–' : svPct(x.andelKv, 0)}</td></tr>`).join('')}
        </tbody></table>${konNot}`;

    const kvEl = document.getElementById('chart-struktur-kvartiler');
    // Samma villkor som tabellen: utan könsuppdelning (ett kön under tröskeln) ritas inget diagram.
    if (kvEl && q.length && q.every(x => x.nKv != null && x.nMa != null && x.n > 0)) ritaFigur(kvEl, { ..._strukturKvartilFigur(q, totAndel), underlag: underlag(_strukturKvartilFor) },
        { exportAnteckning: `Andel kvinnor: ${_figTalformat(q[0].andelKv, 'pct')} i lägsta kvartilen, ${_figTalformat(q[q.length - 1].andelKv, 'pct')} i högsta` });

    renderSektorer(d);
    renderStrukturTradkarta(d);
    _stRitaTopp(d, { konOk, totAndel, medGap, q, dist, basAntal: repVisade.length });
}

/**
 * Auto-rapportutkastet i fliken Rapporttext: fynden i klarspråk, ur samma mått som Lönestruktur räknar. Ett utkast
 * som användaren har redigerat skrivs inte över; "Återskapa" tar bort markeringen och ritar om.
 */
function renderStrukturUtkast() {
    const nb = document.getElementById('struktur-narrative');
    if (!nb) return;
    _stSynkaUtkastValjare();
    const d = getData();
    if (!d.length) { /** @type {HTMLInputElement} */ (nb).value = ''; return; }
    if (nb.dataset.dirty) return;
    const k = kTroskel();
    const { konOk, rep, totAndel, dist, q, medGap, meanGap } = _stMatt(d, k);
    const perBas = state.utkastPerBas !== false ? _stUtkastPerBas(k) : null;
    /** @type {HTMLInputElement} */ (nb).value = _buildNarrative(d, { rep, dist, q, medGap, meanGap, totAndel, konOk, perBas });
}

/** Väljaren ovanför utkastet visar valet i state (Hela organisationen, eller med ett stycke per BAS-intervall). */
function _stSynkaUtkastValjare() {
    const sel = /** @type {HTMLSelectElement|null} */ (document.getElementById('struktur-narrative-omfang'));
    if (sel) sel.value = state.utkastPerBas !== false ? 'perBas' : 'hela';
}

/**
 * Utkastets del per BAS-intervall: ett stycke per intervall som når k, i samma text som BAS-dossiern
 * (basintervallUtkastText i 81-basdossier.js) och med raden att fylla i sist. Utkastet ritas i exportläget
 * (Rapporttext), så intervall och yrkesgrupper under k står bara med namn.
 * @param {number} k
 */
function _stUtkastPerBas(k) {
    if (typeof basdossierKandidater !== 'function') return null;
    const kand = basdossierKandidater();
    if (!kand.length) return null;
    const lines = ['PER BAS-INTERVALL', `Ett stycke per BAS-intervall med minst ${k} ${personOrd(k)}: antal och könsfördelning, ${state.policy.length ? 'läget mot ställningstagandet, ' : ''}yrkesgrupperna, likvärdigt arbete, ålder och förra året när ett bokslut är inläst. Yrkesgrupper med färre än ${k} ${personOrd(k)} står bara med namn.`];
    const under = basdossierUtelamnade();
    if (under.length) lines.push(`BAS ${under.join(', ')} redovisas inte (färre än ${k} ${personOrd(k)}).`);
    for (const { bas } of kand) {
        const d = buildBasdossier(bas);
        if (d) lines.push('', basintervallUtkastText(d));
    }
    return lines.join('\n');
}

/** Var i lönefördelningen gapet är störst: samma regel som tolkningen under tabellen (mer än en procentenhet). */
function _stFordelningsMonster(dist) {
    const p10 = dist.find(x => x.p === 10), p90 = dist.find(x => x.p === 90);
    if (!p10 || !p90 || p10.gapPct == null || p90.gapPct == null) return null;
    if (Math.abs(p10.gapPct) > Math.abs(p90.gapPct) + 1) return { namn: 'Klibbigt golv', text: 'Skillnaden störst bland de lägst betalda' };
    if (Math.abs(p90.gapPct) > Math.abs(p10.gapPct) + 1) return { namn: 'Glastak', text: 'Skillnaden störst bland de högst betalda' };
    return { namn: 'Jämnt', text: 'Skillnaden lika stor i hela fördelningen' };
}

/**
 * Flikens topp: urvalsraden, slutsatserna och avsnittens nyckeltal. Allt hämtas ur de mått fliken redan har räknat
 * med tröskeln, så toppen kan inte visa mer än tabellerna. Utan könsuppdelning (ett kön under tröskeln) står bara det.
 */
function _stRitaTopp(d, m) {
    const urval = document.getElementById('st-urval'), host = document.getElementById('st-slutsatser');
    if (!urval || !host) return;
    if (!m) { urval.textContent = ''; host.innerHTML = ''; ['representation', 'karta', 'fordelning', 'eu'].forEach(n => _laNyckel(`nyckel-st-${n}`, '')); return; }
    urval.innerHTML = `<span><strong>Hela urvalet</strong> · ${svTal(d.length, 0)} personer</span>${kTroskelLank()}`;
    _laNyckel('nyckel-st-representation', `${m.basAntal} BAS-intervall`);
    // Kartans yrkesgrupper: ett yrke inom ett BAS-intervall, samma indelning som ytorna (_strukturTradkartaFigur).
    const yrkesgrupper = new Set(d.filter(r => r.bas != null && r.bas !== '').map(r => `${String(r.aid || r.yrke || 'okänd')}|${r.bas}`)).size;
    _laNyckel('nyckel-st-karta', yrkesgrupper ? `${svTal(yrkesgrupper, 0)} yrkesgrupper` : '');
    if (!m.konOk) {
        host.innerHTML = _laSlutsats('Kvinnor och män', 'Visas inte', _konUtelamnatNot());
        _laNyckel('nyckel-st-fordelning', ''); _laNyckel('nyckel-st-eu', '');
        return;
    }
    const monster = _stFordelningsMonster(m.dist);
    const kvartiler = m.q.length && m.q.every(x => x.nKv != null && x.nMa != null && x.n > 0);
    host.innerHTML = _laSlutsats('Andel kvinnor', svPct(m.totAndel, 0), 'av alla i urvalet')
        + _laSlutsats('Kvinnors medianlön', andelAvMan(m.medGap), 'av mäns, i hela urvalet')
        + (kvartiler ? _laSlutsats('Lägsta lönekvartilen', svPct(m.q[0].andelKv, 0), 'är kvinnor')
            + _laSlutsats('Högsta lönekvartilen', svPct(m.q[m.q.length - 1].andelKv, 0), 'är kvinnor') : '')
        + (monster ? _laSlutsats('Lönefördelningen', monster.namn, monster.text) : '');
    _laNyckel('nyckel-st-fordelning', monster ? monster.namn : '');
    _laNyckel('nyckel-st-eu', typeof m.medGap === 'number' ? `Kvinnors medianlön ${andelAvMan(m.medGap)} av mäns` : '');
}

// ---- Sektorsöversikten (ADR-33). k-reglerna sitter i src/lib/sektor.js. ----
function _sektorPunkter() {
    const ut = {};
    let punkter = [];
    try { punkter = buildActionChecklist({ endastGrupper: true }); } catch (e) { rapporteraFel('Sektorsöversikten: Att göra', e); }
    for (const it of punkter) {
        if (!it.aid) continue;
        const s = _aidSektorsnamn(it.aid);
        ut[s] = (ut[s] || 0) + 1;
    }
    return ut;
}

// ---- Trädkarta: organisationen som ytor ----
// Varje yrkesgrupp är en yta vars storlek är antalet personer, samlade per BAS-intervall, och färgen är andelen
// kvinnor. Kartan bär bara antal och könsfördelning — inga löner. Yrkesgrupper under tröskeln slås ihop till en grå
// yta per BAS-intervall ("Övriga små grupper") med sitt sammanlagda antal och utan könsfördelning; är också den
// under tröskeln visas den ändå som antal, eftersom BAS-intervallets storlek redan står i tabellerna ovanför.
// Lägena räknas här med d3.treemap; kärnan ritar ytorna (märket `yta`, dolda axlar).
// Filtren (BAS-intervall, sektor och antal) döljer yrkesgrupper. Kartan läggs då om ur de grupper som syns: båda
// lagren är härledda ur yrkesgruppernas synliga ytor (harleddAv, ADR-39), och omräkningen ändrar bara ytornas läge och
// storlek — inget tal. BAS-ytans antal är hela intervallets, som utan filter. Ytan "Övriga små grupper" samlar flera
// yrken och sektorer; den bär BAS och antal men ingen sektor och påverkas därför inte av sektorsfiltret.
const TRADKARTA_FORM = 2.4;   // kartans bredd i förhållande till höjden
// Lägena för yrkesgruppernas ytor (i kartans ordning: BAS-intervall, inom dem störst först och de små sist), samlade
// per BAS-intervall. Ger BAS-ytorna och yrkesgrupperna med sina nya lägen; inga andra fält ändras.
function _tradkartaLagen(blad) {
    const perBas = new Map();
    for (const b of blad) { if (!perBas.has(b.bas)) perBas.set(b.bas, []); perBas.get(b.bas).push(b); }
    const rot = d3.hierarchy({ children: [...perBas].map(([bas, children]) => ({ bas, children })) }).sum(o => (o.children ? 0 : o.n));
    d3.treemap().size([TRADKARTA_FORM, 1]).paddingOuter(0.006).paddingTop(0.05).paddingInner(0.003).round(false)(rot);
    const yta = n => ({ x0: n.x0, x1: n.x1, y0: 1 - n.y1, y1: 1 - n.y0 });   // y uppåt i diagrammet, nedåt i layouten
    return { basYtor: (rot.children || []).map(n => ({ ...yta(n), namn: `BAS ${n.data.bas}`, varde: n.value, etikett: `BAS ${n.data.bas}`, markering: markeringFor(n.data.bas) })),
        grupper: rot.leaves().filter(n => n.depth === 2).map(n => ({ ...n.data, ...yta(n) })) };
}
function _strukturTradkartaFigur(rader, k = kTroskel()) {
    const perBas = new Map();
    for (const r of rader) {
        if (r.bas == null || r.bas === '') continue;
        if (!perBas.has(r.bas)) perBas.set(r.bas, new Map());
        const aid = String(r.aid || r.yrke || 'okänd'), g = perBas.get(r.bas);
        if (!g.has(aid)) g.set(aid, { aid, bas: r.bas, namn: r.yrkeLabel || r.yrke || aid, n: 0, nKv: 0 });
        const o = g.get(aid);
        o.n++; if (r.kon && r.kon.includes('kvinna')) o.nKv++;
    }
    const barn = [...perBas].sort((a, b) => String(a[0]).localeCompare(String(b[0]), 'sv')).map(([bas, g]) => {
        const stora = [...g.values()].filter(o => o.n >= k).sort((a, b) => b.n - a.n);
        const sma = [...g.values()].filter(o => o.n < k);
        const ovriga = sma.length ? [{ aid: null, bas, namn: `Övriga små grupper (${sma.length})`, n: sma.reduce((s, o) => s + o.n, 0), nKv: null, ovriga: true }] : [];
        return [...stora, ...ovriga];
    }).filter(b => b.length);
    if (!barn.length) return null;
    // Yrkesgruppernas ytor utan läge; lägena sätts av _tradkartaLagen, för alla grupper eller för dem som syns.
    const blad = barn.flat().map(o => ({ namn: `${o.namn} · BAS ${o.bas}`, varde: o.n, etikett: o.namn, undertext: `${o.n} personer`, bas: o.bas, n: o.n,
        ...(o.ovriga ? { farg: FARG.kantStark, ovriga: true }
            : { sektor: _aidSektorsnamn(o.aid), fargvarde: +(100 * o.nKv / o.n).toFixed(1), andelKv: 100 * o.nKv / o.n, markering: markeringFor(o.bas, o.aid) }) }));
    const { basYtor, grupper } = _tradkartaLagen(blad);
    // BAS-ytans antal är alltid hela intervallets (inget räknas om); bara läget följer de synliga grupperna.
    const basAntal = new Map(basYtor.map(b => [b.namn, b.varde]));
    const namn = 'ytornas läge och storlek';
    return { legend: false, hojd: 460,
        beskrivning: `Organisationen som karta: varje yta är en yrkesgrupp, storleken är antalet personer och färgen andelen kvinnor, samlade per BAS-intervall. Yrkesgrupper med färre än ${k} ${personOrd(k)} är hopslagna till en grå yta per intervall.`,
        urval: [URVAL.bas, URVAL.sektor, URVAL.antal],
        x: { skala: 'linjar', doman: [0, TRADKARTA_FORM], dold: true }, y: { skala: 'linjar', doman: [0, 1], dold: true },
        fargskala: { typ: 'divergerande', doman: [0, 100], mitt: 50, titel: 'Andel kvinnor (%)', farger: [[0, PALETTE.kon.man], [0.5, FARG.ytaStark], [1, PALETTE.kon.kvinna]] },
        lager: [{ marke: 'yta', serie: 'BAS-intervall', farg: FARG.kant, opacitet: 0.5, etikettLage: 'topp', data: basYtor,
                  tips: d => [[d.namn], ['Antal', String(d.varde)]],
                  harleddAv: { lager: ['Yrkesgrupper'], namn, berakna: p => _tradkartaLagen(p).basYtor.map(b => ({ ...b, varde: basAntal.get(b.namn) })) } },
                { marke: 'yta', serie: 'Yrkesgrupper', data: grupper,
                  tips: d => [[d.namn], ['Antal', String(d.n)], ...(d.ovriga ? [['Könsfördelning', 'visas inte för små grupper']] : [['Andel kvinnor', _figTalformat(d.andelKv, 'pct')]])],
                  harleddAv: { lager: ['Yrkesgrupper'], namn, berakna: p => _tradkartaLagen(p).grupper } }] };
}
function renderStrukturTradkarta(d, id = 'chart-struktur-tradkarta') {
    const el = document.getElementById(id);
    if (!el) return;
    // Lägena räknas med D3 här i vyn, utanför ritarens felhantering: ett fel (eller ett bygge utan D3) får inte
    // avbryta resten av fliken.
    /** @type {any} */ let figur = null;
    try { figur = d && d.length && typeof d3 !== 'undefined' ? _strukturTradkartaFigur(d) : null; }
    catch (e) { rapporteraFel('diagram chart-struktur-tradkarta', e); }
    if (figur) ritaFigur(el, figur); else rensaFigur(el);
}

// Lönekvartilerna som staplar till 100 % (EU 2023/970 artikel 9): andel kvinnor och män i varje fjärdedel av
// lönefördelningen, med organisationens andel kvinnor som streckad linje. Samma tal som tabellen under.
// Var i lönefördelningen skillnaden sitter: kvinnors och mäns lön vid samma percentil som två punkter på en
// kronaxel, lägst betalda överst. Glider punkterna isär nedåt i bilden är gapet störst i toppen (glastak), uppåt
// i botten (klibbigt golv). Samma tal som tabellen under; `dist` finns bara när båda könen når tröskeln.
// Percentilerna för ett underlag (figur.underlag.rita): samma mått som fliken, eller en text när ett kön är under tröskeln.
function _strukturPercentilFor(rader, { beskrivning }) {
    const dist = _stDistributionalGap(rader, undefined, { k: kTroskel() });
    return dist.length && dist.every(x => x.gapPct != null) ? _strukturPercentilFigur(dist, beskrivning) : _konUtelamnatNot();
}
// Kvartilerna för ett underlag (figur.underlag.rita), med andelen kvinnor i urvalet som linje.
function _strukturKvartilFor(rader, { beskrivning }) {
    const q = _stQuartileDistribution(rader, { k: kTroskel() });
    if (!(q.length && q.every(x => x.nKv != null && x.nMa != null && x.n > 0))) return _konUtelamnatNot();
    const nKv = rader.filter(r => r.kon && r.kon.includes('kvinna')).length;
    return _strukturKvartilFigur(q, rader.length ? 100 * nKv / rader.length : 0, beskrivning);
}
// `omfang` (ett underlag, t.ex. 'sektor Skola'): beskrivningen säger att figuren är räknad för det.
function _strukturPercentilFigur(dist, omfang) {
    const namn = x => `P${x.p}${x.p === 10 ? ' (lägst betalda)' : x.p === 50 ? ' (median)' : x.p === 90 ? ' (högst betalda)' : ''}`, kr = v => _figTalformat(Math.round(v), 'kr');
    const tips = d => [[d.y], ['Kvinnor', kr(d.r.kv)], ['Män', kr(d.r.ma)], ['Kvinnors lön i % av mäns', _figTalformat(100 + d.r.gapPct, 'pct')], ..._figKronorTipsRad(_figKronorSkillnad(d.r.kv, d.r.ma))];
    const punkt = (serie, farg, falt, extra = {}) => ({ marke: 'punkt', serie, farg, storlek: 6, ...extra,
        data: dist.map(x => ({ y: namn(x), x: Math.round(x[falt]), r: x, ...(extra.etikettLage ? { etikett: _figTalformat(100 + x.gapPct, 'pct') } : {}) })), tips });
    const hogst = x => (x.ma >= x.kv ? 'ma' : 'kv');
    return { beskrivning: `Kvinnors och mäns lön vid samma percentil i respektive köns lönefördelning (P10 till P90), som två punkter per percentil. Procenttalet är kvinnors lön i procent av mäns. ${omfang ? `Räknat för ${omfang}; tabellen under gäller hela underlaget.` : 'Samma tal står i tabellen under.'}`,
        x: { skala: 'linjar', titel: 'Månadslön (kr)', format: 'kr' }, y: { skala: 'band', ordning: dist.map(namn) }, hojd: Math.max(220, 100 + dist.length * 34),
        lager: [{ marke: 'intervall', riktning: 'liggande', serie: 'Skillnad', farg: PALETTE.semantic.neutral, tjocklek: 2, legend: false,
                  data: dist.map(x => ({ y: namn(x), lag: Math.round(Math.min(x.kv, x.ma)), hog: Math.round(Math.max(x.kv, x.ma)), r: x, ..._kronorFalt(x.kv, x.ma) })), tips },
                punkt('Kvinnor', PALETTE.kon.kvinna, 'kv', dist.every(x => hogst(x) === 'kv') ? { etikettLage: 'hoger' } : {}),
                punkt('Män', PALETTE.kon.man, 'ma', dist.every(x => hogst(x) === 'kv') ? {} : { etikettLage: 'hoger' })] };
}

function _strukturKvartilFigur(q, totAndel, omfang) {
    const namn = x => `Q${x.q}${x.q === 1 ? ' (lägst lön)' : x.q === 4 ? ' (högst lön)' : ''}`;
    const serie = (s, farg, andel, antal) => ({ marke: 'stapel', lage: 'staplad', riktning: 'liggande', serie: s, farg,
        data: q.map(x => { const a = +andel(x).toFixed(1); return { y: namn(x), x: a, n: antal(x), tot: x.n, ...(a >= 8 ? { etikett: _figTalformat(a, 'pct') } : {}) }; }),
        tips: d => [[d.y], [s, _figTalformat(d.x, 'pct')], ['Antal', `${d.n} av ${d.tot}`]] });
    return { beskrivning: omfang
            ? `Andel kvinnor och män i varje lönekvartil, räknat för ${omfang} och staplat till 100 procent. Den streckade linjen är andelen kvinnor i urvalet (${_figTalformat(totAndel, 'pct')}). Tabellen nedan gäller hela underlaget.`
            : `Andel kvinnor och män i varje lönekvartil, staplat till 100 procent. Den streckade linjen är andelen kvinnor i hela organisationen (${_figTalformat(totAndel, 'pct')}). Samma siffror finns i tabellen nedan.`,
        y: { skala: 'band', ordning: q.slice().reverse().map(namn) },
        x: { skala: 'linjar', titel: 'Andel av kvartilen (%)', doman: [0, 100] },
        hojd: 240,
        referens: [{ x: +totAndel.toFixed(1), streck: 'streckad', farg: PALETTE.semantic.mork, tjocklek: 1.5 }],
        lager: [serie('Kvinnor', PALETTE.kon.kvinna, x => x.andelKv, x => x.nKv), serie('Män', PALETTE.kon.man, x => 100 * x.nMa / x.n, x => x.nMa)] };
}

function renderSektorer(d) {
    const host = document.getElementById('struktur-sektorer');
    if (!host) return;
    let tabell, andel;
    try {
        tabell = _skSektorsTabell(d, { k: kTroskel(), punkter: _sektorPunkter(), skrDel: _skrDel() });
        andel = _skSektorernasAndel(d, { k: kTroskel() });
    } catch (e) { rapporteraFel('Sektorsöversikten', e); host.innerHTML = ''; return; }
    const kr = n => (n == null ? '–' : `${Math.round(n).toLocaleString('sv-SE')} kr`);
    const pc = n => (n == null ? '–' : `${n.toFixed(1).replace('.', ',')} %`);
    const harLedning = tabell.some(r => r.ledningKv != null || r.ledningMa != null);
    const rader = tabell.map(r => {
        const loner = r.maskerad
            ? `<td colspan="3" class="muted">Färre än ${kTroskel()} ${personOrd(kTroskel())} — lönemått redovisas inte</td>`
            : r.samladMedian
                ? `<td colspan="2">Samlad median ${kr(r.medTot)}</td><td class="muted">Ett kön under ${kTroskel()}</td>`
                : `<td class="num" data-sort-value="${Math.round(r.medKv)}">${kr(r.medKv)}</td><td class="num" data-sort-value="${Math.round(r.medMa)}">${kr(r.medMa)}</td>`
                  + `<td class="num" data-sort-value="${r.kvot.toFixed(1)}">${pc(r.kvot)}</td>`;
        const just = r.justerat
            ? `${pc(100 + r.justerat.pct)} <small class="muted">(${pc(100 + r.justerat.low)}–${pc(100 + r.justerat.high)})</small>`
            : (r.justeratSkal === 'fa' ? '<span class="muted">För få</span>' : '–');
        const ledning = harLedning ? `<td class="num">${pc(r.ledningKv)} / ${pc(r.ledningMa)}</td>` : '';
        // Namnet står som text (följer med i exporten); pilknappen öppnar sektorn i Tabeller och egna vyer.
        return `<tr><td><span class="sektor-namn">${esc(r.namn)}</span> <button type="button" class="row-cross-link" data-sektor="${esc(r.namn)}"
                title="Visa sektorns yrken i Tabeller och egna vyer" aria-label="Visa ${esc(r.namn)} i Tabeller och egna vyer">${ikon('pilUt', 14)}</button></td>
            <td class="num" data-sort-value="${r.n}">${r.n}</td><td class="num" data-sort-value="${r.andelKv == null ? '' : r.andelKv.toFixed(1)}">${pc(r.andelKv)}</td><td class="num" data-sort-value="${r.skrAndelKv == null ? '' : r.skrAndelKv.toFixed(1)}">${pc(r.skrAndelKv)}</td>${loner}<td>${just}</td>
            <td class="num" data-sort-value="${r.antalAid}">${r.antalAid}</td><td class="num" data-sort-value="${r.punkter}">${r.punkter}</td>${ledning}</tr>`;
    }).join('');
    const andelText = !andel || andel.andel == null ? ''
        : Math.abs(andel.andel) < 0.01
            ? `<p class="sektor-andel">Skillnaden i medellön för hela organisationen (${kr(andel.gapKr)} per månad) beror nästan inte alls
               på att kvinnor och män arbetar i olika sektorer (under 1 %).</p>`
            : `<p class="sektor-andel">Av skillnaden i medellön för hela organisationen (${kr(andel.gapKr)} per månad) beror
               ${kr(andel.sektorKr)} (${pc(andel.andel * 100)}) på att kvinnor och män arbetar i olika sektorer.</p>`;
    host.innerHTML = `<table class="data-table" id="sektor-table"><thead><tr><th>Sektor</th><th>Antal</th><th>Andel kvinnor</th><th title="Andel kvinnor i samma sektor nationellt, i ${_skrDelText(_skrDel())} enligt ${esc(skrKallaKort())} — ett referensvärde">Kvinnor nationellt</th>
        <th>Median kvinnor</th><th>Median män</th><th>Kvinnors lön i % av mäns</th><th>Justerad (ålder, BAS)</th>
        <th>AID-grupper</th><th>Punkter i Att göra</th>${harLedning ? '<th>Ledningsansvar kv / män</th>' : ''}</tr></thead>
        <tbody>${rader}</tbody></table>${andelText}`;
    host.querySelectorAll('[data-sektor]').forEach(b => b.addEventListener('click', () => {
        explorerSattUrval({ lage: 'alla', villkor: [{ falt: 'sektor', op: 'enAv', varde: [/** @type {HTMLElement} */ (b).dataset.sektor] }] }, []);
        const rad = document.getElementById('explore-rad');
        if (rad) /** @type {HTMLInputElement} */ (rad).value = 'aid';
        /** @type {HTMLElement} */ (document.querySelector('.nav-item[data-tab="utforska"]'))?.click();
    }));
    const visa = tabell.filter(r => r.kvot != null);
    const el = document.getElementById('chart-sektorer');
    if (!el) return;
    if (visa.length) ritaFigur(el, _sektorFigur(visa)); else rensaFigur(el);
}

// Sektordiagrammets figur (diagramkärnan, ADR-39): rå och justerad kvot som punkter mot linjen 100 % — inte staplar
// på en avkortad axel, där stapelns längd säger något annat än värdet.
// `visa` är de sektorer vars kvot redovisas i tabellen; inga andra når figuren, och axeln räknas bara ur dem.
// Filtren: sektor (lista) och antal personer i sektorn, samma namn och antal som tabellens kolumner Sektor och Antal.
function _sektorFigur(visa) {
    const falt = r => ({ sektor: r.namn, n: r.n });
    const just = r => (r.justerat ? +(100 + r.justerat.pct).toFixed(1) : null);
    const varden = visa.flatMap(r => [r.kvot, just(r)]).filter(v => v != null);
    const xMin = Math.max(0, Math.floor(Math.min(...varden) / 5) * 5 - 5), xMax = Math.max(100, Math.ceil(Math.max(...varden))) + 2;
    const lager = (serie, farg, varde, forskjutning) => ({
        marke: 'punkt', serie, farg, storlek: 6, kant: FARG.vit,
        data: visa.filter(r => varde(r) != null).map(r => ({ y: r.namn, x: +varde(r).toFixed(1), forskjutning, ...falt(r) })),
        tips: d => [[d.y], [serie, _figTalformat(d.x, 'pct')]]
    });
    return { beskrivning: 'Kvinnors lön i procent av mäns per sektor, rå och justerad för ålder och BAS-intervall. Samma värden finns i tabellen.',
        urval: [URVAL.sektor, URVAL.antal], x: { skala: 'linjar', titel: 'Kvinnors lön i % av mäns', doman: [xMin, xMax] },
        y: { skala: 'band', ordning: visa.map(r => r.namn), etikettMax: 64 },   // sektornamnen är långa och ska gå att läsa
        hojd: Math.max(170, 90 + visa.length * 36),
        referens: [{ x: 100, streck: 'prickad', farg: PALETTE.semantic.referens, etikett: 'Lika lön' }],
        // Strecket från rå till justerad visar hur mycket ålder och nivå förklarar: långt streck = mycket.
        lager: [{ marke: 'intervall', riktning: 'liggande', serie: 'Förklaras av ålder och BAS', farg: PALETTE.semantic.neutral, tjocklek: 2, legend: false,
                  data: visa.filter(r => just(r) != null).map(r => ({ y: r.namn, lag: +Math.min(r.kvot ?? 0, just(r) ?? 0).toFixed(1), hog: +Math.max(r.kvot ?? 0, just(r) ?? 0).toFixed(1), ra: r.kvot, ju: just(r), ...falt(r) })),
                  tips: d => [[d.y], ['Rå', _figTalformat(d.ra, 'pct')], ['Justerad', _figTalformat(d.ju, 'pct')]] },
                lager('Rå', PALETTE.semantic.neutral, r => r.kvot, 0), lager('Justerad (ålder, BAS)', PALETTE.serie[0], just, 0)] };
}

// (4) Bygg ett klarspråksutkast av fynden.
function _buildNarrative(d, ctx) {
    const fmtPct = n => n == null ? '–' : (n >= 0 ? '+' : '') + svPct(n, 1);
    const lines = [];
    lines.push('LÖNEKARTLÄGGNING — SAMMANFATTNING (utkast)');
    lines.push('');
    lines.push(`Underlaget omfattar ${d.length} anställda (${svPct(ctx.totAndel, 0)} kvinnor) fördelade på ${getBasIntervals().length} BAS-intervall.`);
    lines.push('');
    lines.push('Löneskillnad (kvinnors lön i procent av mäns):');
    if (ctx.konOk) lines.push(`  • Kvinnors genomsnittslön är ${andelAvMan(ctx.meanGap)} av mäns, och medianlönen ${andelAvMan(ctx.medGap)} av mäns.`);
    else lines.push(`  • ${_konUtelamnatNot()}`);
    /** @type {any} */ let reg = null; try { reg = runOLSRegression(); } catch (_e) { reg = null; }
    if (reg && !reg.error) {
        lines.push(`  • ${reg.fras ? `Efter kontroll för ${reg.fras} kvarstår en oförklarad skillnad` : 'Utan att något räknats bort är skillnaden'} på ${fmtPct(reg.konPct)} (negativ när kvinnor ligger lägre; ${reg.pValue < 0.05 ? 'statistiskt säkerställt' : 'ej statistiskt säkerställt'}).`);
    }
    lines.push('');
    // Distributionsmönster
    const p10 = ctx.dist.find(x => x.p === 10), p90 = ctx.dist.find(x => x.p === 90);
    if (p10 && p90 && p10.gapPct != null && p90.gapPct != null) {
        if (Math.abs(p10.gapPct) > Math.abs(p90.gapPct) + 1) lines.push(`Löneskillnaden är störst bland de lägst betalda (kvinnors lön vid P10: ${andelAvMan(p10.gapPct)} av mäns, vid P90: ${andelAvMan(p90.gapPct)}) — ett klibbigt golv. Granska ingångslöner och lägstanivåer.`);
        else if (Math.abs(p90.gapPct) > Math.abs(p10.gapPct) + 1) lines.push(`Löneskillnaden är störst bland de högst betalda (kvinnors lön vid P90: ${andelAvMan(p90.gapPct)} av mäns, vid P10: ${andelAvMan(p10.gapPct)}) — ett glastak. Granska befordran och lönesättning i toppen.`);
    }
    // Segregation
    // Bara BAS som tabellen visar namnges (k-anonymitet).
    // ctx.rep är sorterad BAS A–Ö (representationByBas): första är lägst värderat, sista högst.
    const sorted = ctx.rep.filter(g => !isKMasked(g.n));
    if (sorted.length >= 2) {
        const lagsta = sorted[0], hogsta = sorted[sorted.length - 1];
        if (lagsta.andelKv - hogsta.andelKv > 15) lines.push(`Vertikal könssegregering: andelen kvinnor är högre i lägre betalda BAS (${lagsta.bas}: ${svPct(lagsta.andelKv, 0)}) än i högre betalda (${hogsta.bas}: ${svPct(hogsta.andelKv, 0)}). Det är en strukturell orsak till löneskillnaden.`);
    }
    // § 3:10
    /** @type {any} */ let lv = null; try { lv = likvardighetResultat(); } catch (_e) { lv = null; }
    // k-anonymitet: antalet redovisas för par där båda grupperna når tröskeln; resten nämns (som övriga utdata)
    const lvPar = _parForRedovisning(lv && lv.pairs);
    if (lvPar.par.length || lvPar.utelamnade) {
        lines.push('');
        if (lvPar.par.length) lines.push(`Likvärdigt arbete: ${lvPar.par.length} kvinnodominerade yrkesgrupper identifierades med lägre lön än likvärdiga grupper som inte är kvinnodominerade. Dessa ska analyseras med avseende på sakliga skäl.`);
        if (lvPar.not) lines.push(lvPar.par.length ? lvPar.not : `Likvärdigt arbete: ${lvPar.not}`);
    }
    lines.push('');
    lines.push('Kvartilfördelning (direktivets mått):');
    if (ctx.q.some(x => x.konDolt)) lines.push(`  • ${_konUtelamnatNot()}`);
    else ctx.q.forEach(x => lines.push(`  • Q${x.q}: ${svPct(x.andelKv, 0)} kvinnor (n=${x.n}).`));
    lines.push('');
    lines.push('Utkastet är ett underlag. Organisationen skriver själv dokumentationen, med sakliga skäl, åtgärder, kostnader och tidsplan.');
    // Delen per BAS-intervall står efter helheten (väljaren ovanför utkastet).
    if (ctx.perBas) { lines.push(''); lines.push(ctx.perBas); }
    // Texten kopieras och sprids för sig: under standardvärdet bär den meningen om sänkt tröskel.
    const sankt = _kSanktNot();
    if (sankt) { lines.push(''); lines.push(sankt); }
    return lines.join('\n');
}
// Går alltid genom exportläget (ADR-51): djupräknaren håller skärmen i exportläget tills den sista pågående exporten är klar.
function exportEuReport(...a) { return medExportLage(() => _exportEuReportExport.apply(null, /** @type {any} */ (a))); }
function _exportEuReportExport() {
    if (typeof XLSX === 'undefined') { alert('Exporten kunde inte starta: en del av verktyget saknas i filen. Ladda om sidan; hjälper det inte, hämta verktyget på nytt.'); return; }
    const d = getData();
    if (!d.length) { alert('Ingen data.'); return; }
    const kr = n => n == null ? '' : Math.round(n);
    const k = kTroskel();
    const { konOk, q, rep, dist, kv, ma, meanGap, medGap } = _stMatt(d, k);
    // Måtten står med direktivets tecken (art. 9): (män − kvinnor) / män i procent, positivt när kvinnor ligger
    // lägre. Verktyget räknar (kvinnor − män) / män; _stTillDirektivtecken vänder tecknet, bara i den här exporten
    // och rapportens avsnitt om lönetransparens — övriga blad och flikar visar kvinnors lön i procent av mäns.
    const DIREKTIV_RUBRIK = 'Löneskillnad enligt direktivet (%), positivt tal = kvinnor lägre';
    const DIREKTIV_METOD = 'Löneskillnaden är (män − kvinnor) / män i procent, enligt direktivet: positivt tal = kvinnor lägre. Verktygets flikar och övriga blad visar i stället kvinnors lön i procent av mäns; talet är lika stort.';
    function direktivRound(v) { const t = _stTillDirektivtecken(v); return t == null ? '–' : +t.toFixed(1); }
    const meta = [
        ['Lönetransparensdirektivets mått', ''],
        ['Lönebegrepp', EU_LONEBEGREPP_RESERVATION],
        ['Genererad', new Date().toLocaleString('sv-SE')],
        ['Verktyg', 'Öppen lönekartläggning v' + (typeof APP_VERSION !== 'undefined' ? APP_VERSION : '–')],
        ['Antal anställda', d.length],
        ['Löneskillnad i medellön enligt direktivet (%), positivt tal = kvinnor lägre', direktivRound(meanGap)],
        ['Löneskillnad i medianlön enligt direktivet (%), positivt tal = kvinnor lägre', direktivRound(medGap)],
        ['Tecken', DIREKTIV_METOD],
        ...(konOk ? [] : [['Könsuppdelade mått', _konUtelamnatNot()]]),
        ['', ''],
        ['OBS', 'Aggregat — inga individdata.']
    ];
    /** @type {any[][]} */
    const quart = [['Kvartil', 'Lönespann', 'n', 'Kvinnor', 'Män', 'Andel kvinnor (%)'],
        ...q.map(x => ['Q' + x.q, _kvartilSpann(x, v => Math.round(v).toLocaleString('sv-SE') + ' kr'), x.n, x.nKv ?? '', x.nMa ?? '', x.andelKv == null ? '' : +x.andelKv.toFixed(0)])];
    if (!konOk) { quart.push([]); quart.push([_konUtelamnatNot()]); }
    const repArr = [['BAS', 'n', 'Median', 'Andel kvinnor (%)', DIREKTIV_RUBRIK]]
        // k-anonymitet: BAS under tröskeln utelämnas och summeras i en slutrad,
        // samma princip som i vyn — en rad med enbart "< 10" bär ingen analys.
        .concat(rep.filter(g => !isKMasked(g.n))
            .map(g => [g.bas, g.n, kr(g.median), +g.andelKv.toFixed(0), g.gapPct == null ? '' : direktivRound(g.gapPct)]));
    const repUtelamnadeX = rep.filter(g => isKMasked(g.n)).map(g => g.bas);
    if (repUtelamnadeX.length) {
        repArr.push([]);
        repArr.push([`Utelämnat enligt k-anonymitet (n < ${kTroskel()}): ${repUtelamnadeX.join(', ')}`]);
    }
    const repKonLitet = rep.filter(g => !isKMasked(g.n) && g.konLitet).map(g => g.bas);
    if (repKonLitet.length) {
        repArr.push([]);
        repArr.push([`Löneskillnaden utelämnad (ett kön har färre än ${kTroskel()} ${personOrd(kTroskel())}): ${repKonLitet.join(', ')}`]);
    }
    /** @type {any[][]} */
    // Antalet kvinnor och män bakom percentilerna (samma för alla rader; på skärmen står det i tabellens rubrikrad).
    const distArr = [['Percentil', 'Kvinnor', 'Män', DIREKTIV_RUBRIK, 'Antal kvinnor', 'Antal män'],
        ...dist.map(x => ['P' + x.p, kr(x.kv), kr(x.ma), x.gapPct == null ? '' : direktivRound(x.gapPct), kv.length, ma.length])];
    if (!konOk) { distArr.push([]); distArr.push([_konUtelamnatNot()]); }
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(meta), 'Sammanfattning');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(quart), 'Kvartilfördelning');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(repArr), 'Representation');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(distArr), 'Skillnad i lönefördelningen');
    _appendMethodSheet(wb, { extra: [['Löneskillnadens tecken i den här filen', DIREKTIV_METOD]] });
    XLSX.writeFile(wb, `eu_lonerapport_${new Date().toISOString().slice(0, 10)}.xlsx`);
    if (typeof announceToScreenReader === 'function') announceToScreenReader('EU-lönerapport exporterad.');
}
(function wireStructure() {
    document.getElementById('struktur-eu-export')?.addEventListener('click', exportEuReport);
    document.getElementById('struktur-narrative-regen')?.addEventListener('click', () => {
        const nb = document.getElementById('struktur-narrative');
        if (nb) { delete nb.dataset.dirty; medExportLage(renderStrukturUtkast); }
    });
    // Väljaren ovanför utkastet: valet ligger i state (inte i konfigurationsfilen). Ett redigerat utkast skrivs inte
    // över; Återskapa ritar om det med valet.
    document.getElementById('struktur-narrative-omfang')?.addEventListener('change', e => {
        state.utkastPerBas = /** @type {HTMLSelectElement} */ (e.target).value !== 'hela';
        const nb = document.getElementById('struktur-narrative');
        if (nb && nb.dataset.dirty) { if (typeof announceToScreenReader === 'function') announceToScreenReader('Utkastet är redigerat och skrivs inte över. Återskapa ritar om det med valet.'); return; }
        medExportLage(renderStrukturUtkast);
    });
    document.getElementById('struktur-narrative-copy')?.addEventListener('click', () => {
        const nb = document.getElementById('struktur-narrative');
        if (nb) { /** @type {HTMLInputElement} */ (nb).select(); try { document.execCommand('copy'); } catch (_e) { /* ignore */ } }
    });
    const nb = document.getElementById('struktur-narrative');
    if (nb) nb.addEventListener('input', () => { nb.dataset.dirty = '1'; });
})();

// Kvartilens lönespann utan enskilda löner: bara gränserna mellan kvartilerna
// (Q1 "upp till", Q4 "över").
function _kvartilSpann(x, kr) {
    if (x.undre == null) return `upp till ${kr(x.ovre)}`;
    if (x.ovre == null) return `över ${kr(x.undre)}`;
    return `${kr(x.undre)} – ${kr(x.ovre)}`;
}

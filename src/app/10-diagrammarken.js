// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
// ====================================================================
// 10-diagrammarken.js — Diagramkärnans märken (ADR-39; se docs/utveckling/diagramkarnan.md)
//
// Andra filen av tre i ritaren (se 10-diagramlayout.js för uppdelningen). Här ligger det som ritas i en panel:
// märkena stapel, punkt, linje, band, intervall, låda och ruta (_RF_MARKEN), markeringen av små grupper
// (_rfLitenYta, _rfLitenPunkt), färgskalan och färgstapeln, och referenserna (zoner och linjer).
//
// Regeln för varje märke: gå igenom lagrets data med ursprungligt index och hoppa över `!d || c.dold(d)` FÖRST.
// Allt som räknas ur flera punkter (kvartiler, urval, spridning i sidled, banor, textbeslut) räknas ur dem som
// återstår — en liten grupp som inte ritas får inte lämna spår i någon annan geometri.
//
// Toppnivåns `const` (_RF_RANDER, _RF_MARKEN) och PALETTE, CHART_FONT, d3 läses bara inne i funktioner;
// _RF_MARKEN pekar på funktionsdeklarationer, som finns från början.
// ====================================================================

// Markering av små grupper utöver färg (WCAG 1.4.1): streckad kant, och för ytor ränder. Ränderna är
// verklig geometri i en egen nästlad <svg> (klipper till stapeln), inte ett mönster: SVG:n har inga id.
// Glesa, tunna ränder: markeringen ska synas utan att ta över bilden — värdet under ska gå att läsa.
const _RF_RANDER = { steg: 10 * Math.SQRT2, bredd: 1.6, max: 400, minst: 3 };
function _rfLitenYta(g, rect, c) {
    rect.attr('stroke', PALETTE.semantic.neutral).attr('stroke-width', 1.5).attr('stroke-dasharray', '4 3');
    // Bara den del av stapeln som ligger i panelen (en stapel som skjuter långt utanför ska inte ge tusen streck).
    const x0 = Math.max(0, +rect.attr('x')), y0 = Math.max(0, +rect.attr('y'));
    const x1 = Math.min(c.panelB, +rect.attr('x') + +rect.attr('width')), y1 = Math.min(c.inreH, +rect.attr('y') + +rect.attr('height'));
    const w = x1 - x0, h = y1 - y0;
    if (!(w >= _RF_RANDER.minst && h >= _RF_RANDER.minst)) return;   // tunnare syns inga ränder; den streckade kanten är kvar (T6)
    const yta = g.append('svg').attr('data-marke', 'rander').attr('pointer-events', 'none').attr('overflow', 'hidden')
        .attr('x', x0).attr('y', y0).attr('width', w).attr('height', h);
    const n = Math.min(_RF_RANDER.max, Math.ceil((w + h) / _RF_RANDER.steg));
    for (let k = 0; k <= n; k++) {
        const kx = k * _RF_RANDER.steg;   // linjer som stiger 45° åt höger, med lika avstånd
        yta.append('line').attr('x1', kx - h).attr('y1', h).attr('x2', kx).attr('y2', 0)
            .attr('stroke', FARG.vit).attr('stroke-opacity', 0.55).attr('stroke-width', _RF_RANDER.bredd);
    }
}

// Mönster på en yta (lagervalet `monster`, förbättring 7): en status får inte bäras av färgen ensam. Verklig geometri
// i en nästlad <svg>, som ränderna: vågräta linjer eller prickar i rutnät — aldrig diagonalt, det betyder liten grupp.
// Används både för stapeln (klippt till panelen av anroparen) och för förklaringens ruta.
function _rfMonster(g, x0, y0, w, h, monster) {
    if (!(w >= _RF_RANDER.minst && h >= _RF_RANDER.minst)) return;
    const yta = g.append('svg').attr('data-marke', 'monster').attr('pointer-events', 'none').attr('overflow', 'hidden')
        .attr('x', x0).attr('y', y0).attr('width', w).attr('height', h);
    // Mönstret ska synas utan att ta över: tunna sneda streck (45°) eller små glesa prickar i ytans färg.
    const steg = 7;
    if (monster === 'linjer') {
        const antal = Math.min(_RF_RANDER.max, Math.ceil((w + h) / steg));
        for (let r = 0; r <= antal; r++) {
            yta.append('line').attr('x1', r * steg - h).attr('x2', r * steg).attr('y1', h).attr('y2', 0)
                .attr('stroke', FARG.vit).attr('stroke-opacity', 0.6).attr('stroke-width', 1.2);
        }
        return;
    }
    const rader = Math.min(_RF_RANDER.max, Math.ceil(h / steg)), kol = Math.ceil(w / steg);
    let n = 0;
    for (let r = 0; r < rader && n < _RF_RANDER.max; r++) {
        for (let k = 0; k < kol && n < _RF_RANDER.max; k++, n++) {
            yta.append('circle').attr('cx', k * steg + 3.5 + (r % 2 ? steg / 2 : 0)).attr('cy', r * steg + 3.5).attr('r', 1)
                .attr('fill', FARG.vit).attr('fill-opacity', 0.7);
        }
    }
}
function _rfMonsterIPanel(g, rect, c, monster) {
    const x0 = Math.max(0, +rect.attr('x')), y0 = Math.max(0, +rect.attr('y'));
    const x1 = Math.min(c.panelB, +rect.attr('x') + +rect.attr('width')), y1 = Math.min(c.inreH, +rect.attr('y') + +rect.attr('height'));
    _rfMonster(g, x0, y0, x1 - x0, y1 - y0, monster);
}

// En liten ruta i en värmekarta: streckad kant och ett hörnmärke (mer än färg, WCAG 1.4.1) — inga ränder över hela
// rutan, som i en karta med många små celler skulle dölja färgerna.
function _rfLitenRuta(g, rect) {
    rect.attr('stroke', PALETTE.semantic.neutral).attr('stroke-width', 1.5).attr('stroke-dasharray', '4 3');
    const x = +rect.attr('x'), y = +rect.attr('y'), w = +rect.attr('width'), h = +rect.attr('height');
    const s = Math.min(9, w / 2, h / 2);
    if (s < 3) return;
    g.append('path').attr('data-marke', 'rander').attr('pointer-events', 'none')
        .attr('d', `M${x + w - s},${y}H${x + w}V${y + s}Z`).attr('fill', PALETTE.semantic.neutral);
}

// Textfärg som syns mot en fyllning: vit mot mörk, annars den vanliga textfärgen. Bara #rgb och #rrggbb känns igen.
function _rfTextPaFarg(farg) {
    const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(farg));
    if (!m) return CHART_FONT.color;
    const h = m[1].length === 3 ? m[1].replace(/./g, c => c + c) : m[1];
    const [r, g, b] = [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16) / 255);
    return 0.2126 * r + 0.7152 * g + 0.0722 * b < 0.5 ? FARG.vit : CHART_FONT.color;
}

function _rfStapel(g, l, li, c) {
    const ligg = l.riktning === 'liggande';
    const kat = ligg ? c.y : c.x, vard = ligg ? c.x : c.yFor(l);
    if (!kat.bandwidth || vard.bandwidth) return;
    const lage = l.lage || 'bredvid';
    const { tjock, flytt, plats } = _rfStapelPlats(kat, l, li, c.bredvid);
    const bas = _rfBas(vard);
    const [dLag, dHog] = _rfDomanSorterad(vard);
    const axelNamn = ligg ? 'x' : (l.axel === 'y2' ? 'y2' : 'y');
    // Vilka punkters etiketter som ritas är redan avgjort, en gång per lager (_rfEtikettBeslut) — samma beslut som
    // etikettrummet räknades med. Här avgörs inget om plats, utom för staplade segment (ryms texten i segmentet?).
    const etiketter = c.etiketter.get(li);
    l.data.forEach((d, i) => {
        if (!d || c.dold(d)) return;
        const nyckel = String(ligg ? d.y : d.x);
        const k = kat(nyckel), v = ligg ? d.x : d.y;
        if (k == null || !_rfTal(v)) return;
        let fran = bas, till = v;
        if (lage === 'staplad') {
            // Positiva värden staplas uppåt och negativa nedåt, var för sig (som _staplatSpann i figur.js),
            // per värdeaxel och kategori.
            const sk = `${axelNamn}|${v < 0 ? '-' : '+'}|${nyckel}`;
            fran = c.stapel.get(sk) || 0; till = fran + v;
            c.stapel.set(sk, till);
        }
        const a = vard(fran), b = vard(till);
        if (!_rfTal(a) || !_rfTal(b)) return;
        const farg = d.farg || c.farg(l, li);
        const r = g.append('rect').attr('data-marke', 'stapel').attr('data-l', li).attr('data-i', i)
            .attr(ligg ? 'y' : 'x', k + flytt).attr(ligg ? 'height' : 'width', tjock)
            .attr(ligg ? 'x' : 'y', Math.min(a, b)).attr(ligg ? 'width' : 'height', Math.abs(b - a))
            .attr('fill', farg);
        // Rundade hörn på en ensam stapel; i en staplad stapel skiljs segmenten åt av en tunn kant i ytans färg.
        if (lage === 'staplad') r.attr('stroke', FARG.vit).attr('stroke-width', 1.5);
        else r.attr('rx', Math.min(_RF.stapelHorn, tjock / 2, Math.abs(b - a) / 2));
        if (l.opacitet != null) r.attr('fill-opacity', l.opacitet);
        // Mönstret är lagrets, eller den enskilda stapelns (`monster` på datapunkten: t.ex. en stapel med litet underlag).
        const monster = d.monster === 'linjer' || d.monster === 'prickar' ? d.monster : l.monster;
        if (monster) _rfMonsterIPanel(g, r, c, monster);
        if (d.liten) _rfLitenYta(g, r, c);
        const mitt = k + flytt + tjock / 2;
        if (d.fel && _rfTal(d.fel.lag) && _rfTal(d.fel.hog)) {
            const f1 = vard(d.fel.lag), f2 = vard(d.fel.hog);
            if (_rfTal(f1) && _rfTal(f2)) {
                g.append('line').attr('data-marke', 'fel').attr('pointer-events', 'none')
                    .attr(ligg ? 'y1' : 'x1', mitt).attr(ligg ? 'y2' : 'x2', mitt)
                    .attr(ligg ? 'x1' : 'y1', f1).attr(ligg ? 'x2' : 'y2', f2)
                    .attr('stroke', FARG.dampad).attr('stroke-width', 1.4);
            }
        }
        // Etiketten ritas i c.texter (utanför den klippta gruppen) och bara om staplen ligger helt i domänen.
        if (!etiketter || !etiketter.has(d) || !_rfInomDoman(fran, till, dLag, dHog)) return;
        if (lage === 'staplad') {
            // Staplad: etiketten ligger mitt i sitt eget segment och ritas bara om den ryms där.
            const px = c.px - 1, hel = String(d.etikett);
            const langs = Math.abs(b - a), tvars = tjock;
            const ryms = ligg ? langs >= _rfBredd(hel, px) + 4 && tvars >= px + 2 : langs >= px + 2 && tvars >= _rfBredd(hel, px) + 4;
            if (ryms) {
                const m = (a + b) / 2;
                const t = _rfText(c.texter, ligg ? m : mitt, ligg ? mitt + px * 0.35 : m + px * 0.35, hel, { px, ankare: 'middle', farg: _rfTextPaFarg(farg) });
                t.attr('data-marke', 'etikett').attr('pointer-events', 'none');
            }
        } else {
            const bort = ligg ? (b >= a ? 1 : -1) : (b <= a ? 1 : -1);   // 1 = åt höger / uppåt på skärmen
            const px = c.px - 1;
            const hel = String(d.etikett);
            // Vågrät etikett: högst c.etikettMax tecken (hela texten i title). Stående etiketter kortas aldrig.
            const text = ligg ? _rfKorta(hel, c.etikettMax) : hel;
            // En felstapel går genom etikettens plats mitt över en stående stapel. Ryms texten till höger om strecket
            // ställs den där, bredvid strecket; annars (och för liggande staplar) får den vit kant, så att strecket
            // inte stryker över siffrorna.
            const medFel = !!(d.fel && _rfTal(d.fel.lag) && _rfTal(d.fel.hog));
            // (Platsen är stapelns halva del av bandet, inte stapelns egen bredd: en smal stapel i ett brett band har rum.)
            const bredvid = medFel && !ligg && plats / 2 >= _rfBredd(text, px) + 8;
            const t = ligg
                ? _rfText(c.texter, b + bort * 4, mitt + px * 0.35, text, { px, ankare: bort > 0 ? 'start' : 'end', title: hel })
                : _rfText(c.texter, bredvid ? mitt + 5 : mitt, bort > 0 ? b - 4 : b + 4 + px * 0.8, text, { px, ankare: bredvid ? 'start' : 'middle', title: hel });
            t.attr('data-marke', 'etikett').attr('pointer-events', 'none');
            if ((medFel && !bredvid) || l.etikettKant) t.attr('stroke', FARG.vit).attr('stroke-width', 3).attr('stroke-linejoin', 'round').attr('paint-order', 'stroke');
        }
    });
}

// Fyllda symboler: cirkel (förval), romb och kvadrat. Formen skiljer serier åt utan färg; en tunn ring i ytans färg
// håller isär punkter som ligger på varandra eller på en linje. Samma funktion ritar förklaringens prov.
function _rfSymbol(g, symbol, x, y, r, farg) {
    const m = symbol === 'romb' ? g.append('path').attr('d', `M${x},${y - r * 1.25}L${x + r * 1.25},${y}L${x},${y + r * 1.25}L${x - r * 1.25},${y}Z`)
        : symbol === 'kvadrat' ? g.append('rect').attr('x', x - r * 0.9).attr('y', y - r * 0.9).attr('width', r * 1.8).attr('height', r * 1.8).attr('rx', 1)
        : g.append('circle').attr('cx', x).attr('cy', y).attr('r', r);
    return m.attr('fill', farg).attr('stroke', FARG.vit).attr('stroke-width', 1);
}

function _rfPunkt(g, l, li, c) {
    const ys = c.yFor(l);
    const vagrat = !!c.y.bandwidth && !c.x.bandwidth;   // värdet löper vågrätt (liggande diagram)
    // Små punkter tas bort FÖRE urvalet; sedan ritas var k:te återstående (jämnt urval).
    // Bara ritningen — alla mått räknas på hela underlaget innan figuren byggs.
    const syns = [];
    l.data.forEach((d, i) => { if (d && !c.dold(d)) syns.push([d, i]); });
    const steg = syns.length > SCATTER_MAX_POINTS ? Math.ceil(syns.length / SCATTER_MAX_POINTS) : 1;
    let ritade = 0;
    syns.forEach(([d, i], n) => {
        if (n % steg) return;
        const x = _rfPos(c.x, d.x, c.x.bandwidth ? d.forskjutning : 0);
        const y = _rfPos(ys, d.y, ys.bandwidth ? d.forskjutning : 0);
        if (x == null || y == null) return;
        const r = _rfTal(d.storlek) ? d.storlek : (l.storlek || 4);
        const farg = d.fargvarde != null && c.fargskala ? c.fargskala(d.fargvarde) : (d.farg || c.farg(l, li));
        // Punktens osäkerhet (`fel`: undre och övre gräns) är ett streck genom punkten längs värdeaxeln — vedertagen form
        // för ett skattat värde som jämförs mot en referens. Strecket ritas före punkten, så att punkten ligger överst.
        if (d.fel && _rfTal(d.fel.lag) && _rfTal(d.fel.hog)) {
            const ligg = l.riktning === 'liggande', vs = ligg ? c.x : ys;
            const f1 = vs.bandwidth ? NaN : vs(d.fel.lag), f2 = vs.bandwidth ? NaN : vs(d.fel.hog);
            if (_rfTal(f1) && _rfTal(f2)) {
                g.append('line').attr('data-marke', 'fel').attr('pointer-events', 'none')
                    .attr(ligg ? 'y1' : 'x1', ligg ? y : x).attr(ligg ? 'y2' : 'x2', ligg ? y : x)
                    .attr(ligg ? 'x1' : 'y1', f1).attr(ligg ? 'x2' : 'y2', f2)
                    .attr('stroke', farg).attr('stroke-width', 2).attr('stroke-linecap', 'round').attr('stroke-opacity', 0.75);
            }
        }
        let m;
        if (!l.symbol || l.symbol === 'cirkel' || l.symbol === 'romb' || l.symbol === 'kvadrat') {
            m = _rfSymbol(g, l.symbol, x, y, r, farg);
        } else if (l.symbol === 'streck') {
            const h = r * 2;
            m = g.append('path').attr('d', vagrat ? `M${x},${y - h}V${y + h}` : `M${x - h},${y}H${x + h}`)
                .attr('fill', 'none').attr('stroke', farg).attr('stroke-width', 2.5);
        } else {
            const vinkel = l.symbol === 'triangelVanster' ? -90 : 90;
            m = g.append('path').attr('d', d3.symbol(d3.symbolTriangle, r * r * 3)())
                .attr('transform', `translate(${x},${y}) rotate(${vinkel})`).attr('fill', farg);
        }
        m.attr('data-marke', 'punkt').attr('data-l', li).attr('data-i', i);
        // Punktens etikett (t.ex. gruppens namn i en matris): mitt över punkten, med vit kant. Den hör till punkten och
        // ritas därför aldrig för en punkt som inte ritas.
        if (d.etikett != null && String(d.etikett) !== '') {
            const fpx = c.px - 2, hel = String(d.etikett), text = _rfKorta(hel, 28), tb = _rfBredd(text, fpx);
            // Lagrets etikettLage ställer texten till vänster eller höger om punkten (värdet bredvid en punkt i ett liggande diagram);
            // annars mitt över punkten — eller under, om den inte ryms ovanför (panelens överkant).
            // 'auto' är till höger om punkten, och till vänster när texten annars skulle gå utanför panelens högerkant.
            const sida = l.etikettLage === 'vanster' ? -1 : l.etikettLage === 'hoger' ? 1 : l.etikettLage === 'auto' ? (x + r + 5 + tb > c.panelB ? -1 : 1) : 0;
            const tx = x + sida * (r + 5);
            const ty = sida ? y + fpx * 0.35 : (y - r - 3 < fpx ? y + r + fpx : y - r - 3);
            const t = _rfText(c.texter, tx, ty, text, { px: fpx, ankare: sida < 0 ? 'end' : sida > 0 ? 'start' : 'middle', title: hel,
                attr: { 'data-marke': 'punktetikett', 'pointer-events': 'none', stroke: FARG.vit, 'stroke-width': 3, 'stroke-linejoin': 'round', 'paint-order': 'stroke' } });
            if (c.punktetiketter) c.punktetiketter.push({ t, y: ty, hojd: fpx + 3, over: !sida && ty < y, x0: sida < 0 ? tx - tb : sida > 0 ? tx : tx - tb / 2, x1: sida < 0 ? tx : sida > 0 ? tx + tb : tx + tb / 2 });
        }
        if (l.opacitet != null) m.attr('fill-opacity', l.opacitet);
        if (l.kant) m.attr('stroke', l.kant).attr('stroke-width', 1);
        if (d.liten) {
            // Mer än färg: streckad kant. Strecket har ingen yta, så det blir självt streckat och behåller färgen.
            if (l.symbol === 'streck') m.attr('stroke-dasharray', '3 2');
            else {
                m.attr('stroke', PALETTE.semantic.neutral).attr('stroke-width', 2).attr('stroke-dasharray', '2 2');
                if (!l.symbol || l.symbol === 'cirkel') m.attr('fill-opacity', 0.45);
            }
        }
        ritade++;
    });
    if (steg > 1) c.nedsamplat(ritade, syns.length);
}

// Punktetiketter som skulle skriva över varandra flyttas isär i höjdled. Bara etiketter som faktiskt krockar rörs:
// de gås igenom uppifrån och ned, och en etikett som överlappar en redan lagd (i sidled och i höjdled) ställs
// närmast under den. Hamnar den sista under panelens nederkant skjuts raden uppåt igen nedifrån. Bara ritade
// punkters etiketter finns i listan, så en dold liten punkt påverkar inte de övrigas lägen.
// Står alla etiketter ÖVER sin punkt (namnen i en matris) flyttas de i stället uppåt, bort från punkterna: en etikett
// som knuffas nedåt hamnar annars mitt på bubblorna den hör till. Det är samma gång, speglad i höjdled.
function _rfEtikettKrockar(etiketter, inreH) {
    if (!etiketter || etiketter.length < 2) return;
    const uppat = etiketter.every(e => e.over);
    const spegla = y => (uppat ? inreH - y : y);
    const golv = e => (uppat ? inreH - e.hojd : inreH - 2);   // speglat: panelens överkant, med plats för textens höjd
    const lista = etiketter.map((e, n) => ({ ...e, n, y: spegla(e.y), ny: spegla(e.y) })).sort((a, b) => (a.y - b.y) || (a.x0 - b.x0) || (a.n - b.n));
    const sidled = (a, b) => a.x0 < b.x1 && b.x0 < a.x1;
    lista.forEach((e, i) => {
        for (let varv = 0; varv < i; varv++) {
            const hinder = lista.slice(0, i).find(p => sidled(p, e) && Math.abs(p.ny - e.ny) < e.hojd);
            if (!hinder) break;
            e.ny = hinder.ny + e.hojd;
        }
    });
    for (let i = lista.length - 1; i >= 0; i--) {
        const e = lista[i];
        if (e.ny > golv(e) && e.ny !== e.y) e.ny = Math.max(e.hojd, golv(e));
        for (let varv = 0; varv < lista.length; varv++) {
            const hinder = lista.slice(i + 1).find(p => sidled(p, e) && Math.abs(p.ny - e.ny) < e.hojd && p.ny >= e.ny);
            if (!hinder) break;
            e.ny = hinder.ny - e.hojd;
        }
    }
    for (const e of lista) if (e.ny !== e.y) e.t.attr('y', spegla(e.ny));
}

// Märket för en liten punkt på en linje eller vid ett bands gräns (bara med visaSma): ihålig, streckad cirkel.
function _rfLitenPunkt(g, li, i, x, y) {
    g.append('circle').attr('data-marke', 'litenpunkt').attr('data-l', li).attr('data-i', i).attr('pointer-events', 'none')
        .attr('cx', x).attr('cy', y).attr('r', 5).attr('fill', 'none')
        .attr('stroke', PALETTE.semantic.neutral).attr('stroke-width', 1.5).attr('stroke-dasharray', '2 2');
}

function _rfLinje(g, l, li, c) {
    const ys = c.yFor(l);
    // Linjen byggs av de punkter som återstår, i ordning: en borttagen liten punkt får inte bryta den.
    const kvar = [];
    l.data.forEach((d, i) => { if (d && !c.dold(d)) kvar.push({ d, i }); });
    const px = o => _rfPos(c.x, o.d.x), py = o => _rfPos(ys, o.d.y);
    const ok = o => px(o) != null && py(o) != null;
    const linje = d3.line().defined(ok).x(px).y(py).curve(l.kurva === 'monoton' ? d3.curveMonotoneX : d3.curveLinear);
    const farg = c.farg(l, li);
    const p = g.append('path').attr('data-marke', 'linje').attr('data-l', li)
        .attr('d', linje(kvar) || '').attr('fill', 'none').attr('stroke', farg).attr('stroke-width', l.tjocklek || 2)
        .attr('stroke-linejoin', 'round').attr('stroke-linecap', 'round');
    const streck = _RF.streck[l.streck || 'hel'];
    if (streck) p.attr('stroke-dasharray', streck);
    for (const o of kvar) {
        if (!ok(o)) continue;
        if (l.punkter) g.append('circle').attr('pointer-events', 'none').attr('cx', px(o)).attr('cy', py(o)).attr('r', 3).attr('fill', farg);
        // Små punkter (bara med visaSma): ihåligt, streckat märke utöver linjen.
        if (o.d.liten) _rfLitenPunkt(g, li, o.i, px(o), py(o));
        // Träffytor för verktygstips: en genomskinlig cirkel per punkt, med punktens eget index.
        if (typeof l.tips === 'function') {
            g.append('circle').attr('data-marke', 'linjepunkt').attr('data-l', li).attr('data-i', o.i)
                .attr('cx', px(o)).attr('cy', py(o)).attr('r', 7).attr('fill', '#000000').attr('fill-opacity', 0);
        }
    }
}

// Band (t.ex. konfidensband): en fylld yta mellan lag och hog. Banan byggs av de punkter som återstår — en borttagen
// liten punkt får inte bryta bandet — i dataordning på en talaxel (som linjer) och i AXELNS ordning på en
// kategoriaxel (annars sicksackar bandet när x.ordning skiljer sig från datans ordning). Små punkter (bara med visaSma) får ihåliga streckade märken
// vid sin övre och undre gräns, som på linjer.
function _rfBand(g, l, li, c) {
    const ys = c.yFor(l);
    if (ys.bandwidth) return;
    const kvar = [];
    l.data.forEach((d, i) => { if (d && !c.dold(d)) kvar.push({ d, i }); });
    const px = o => _rfPos(c.x, o.d.x);
    // Kategoriaxel: sortera efter läge längs axeln (stabilt; punkter utan läge sist — de bryter ändå bandet).
    if (c.x.bandwidth) kvar.sort((p, q) => (px(p) == null ? Infinity : px(p)) - (px(q) == null ? Infinity : px(q)) || p.i - q.i);
    const lag = o => (_rfTal(o.d.lag) ? _rfPos(ys, o.d.lag) : null), hog = o => (_rfTal(o.d.hog) ? _rfPos(ys, o.d.hog) : null);
    const ok = o => px(o) != null && lag(o) != null && hog(o) != null;
    const yta = d3.area().defined(ok).x(px).y0(lag).y1(hog).curve(l.kurva === 'monoton' ? d3.curveMonotoneX : d3.curveLinear);
    g.append('path').attr('data-marke', 'band').attr('data-l', li).attr('pointer-events', 'none')
        .attr('d', yta(kvar) || '').attr('fill', c.farg(l, li)).attr('fill-opacity', l.opacitet != null ? l.opacitet : 0.18).attr('stroke', 'none');
    for (const o of kvar) {
        if (!o.d.liten || !ok(o)) continue;
        for (const y of [hog(o), lag(o)]) _rfLitenPunkt(g, li, o.i, px(o), y);
    }
}

// Intervall (t.ex. P10–P90): ett streck från lag till hog, stående eller liggande. Strecket slutar exakt vid sina
// värden (rak ände) och behöver därför inget rum längs värdeaxeln. Ett litet intervall (bara med visaSma) ritas
// streckat och svagare.
function _rfIntervall(g, l, li, c) {
    const ligg = l.riktning === 'liggande';
    const kat = ligg ? c.y : c.x, vard = ligg ? c.x : c.yFor(l);
    if (vard.bandwidth) return;
    const opacitet = l.opacitet != null ? l.opacitet : 1;
    l.data.forEach((d, i) => {
        if (!d || c.dold(d)) return;
        const k = _rfPos(kat, ligg ? d.y : d.x, kat.bandwidth && _rfTal(d.forskjutning) ? d.forskjutning : 0);
        if (k == null || !_rfTal(d.lag) || !_rfTal(d.hog)) return;
        const a = vard(d.lag), b = vard(d.hog);
        if (!_rfTal(a) || !_rfTal(b)) return;
        const m = g.append('line').attr('data-marke', 'intervall').attr('data-l', li).attr('data-i', i)
            .attr(ligg ? 'y1' : 'x1', k).attr(ligg ? 'y2' : 'x2', k)
            .attr(ligg ? 'x1' : 'y1', Math.min(a, b)).attr(ligg ? 'x2' : 'y2', Math.max(a, b))
            .attr('stroke', d.farg || c.farg(l, li)).attr('stroke-width', l.tjocklek || 6)
            .attr('stroke-opacity', opacitet);
        if (d.liten) m.attr('stroke-dasharray', '4 3').attr('stroke-opacity', opacitet * 0.55);
    });
}

// Spridning i sidled för individpunkter, ett tal i [-0,5, 0,5): härledd ur punktens ordningsnummer, inte slump,
// så att punkterna ligger still mellan omritningar och bilden blir densamma varje gång. Ordningsnumret är
// punktens plats bland de individer som RITAS i samma kategori — aldrig dess index i lagrets data: en dold
// liten individ tidigare i listan får inte flytta de övriga i sidled. Talet blandas (heltalshash) så att
// individer i löneordning inte bildar sneda rader.
function _rfSprid(n) {
    let h = Math.imul(n + 1, 0x9E3779B1);
    h = Math.imul(h ^ (h >>> 15), 0x85EBCA6B);
    h = Math.imul(h ^ (h >>> 13), 0xC2B2AE35);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296 - 0.5;
}

// Punktsvärm (punkter: 'svarm'): läget i sidled för varje individ, så att cirklarna ligger intill varandra utan att
// täcka varandra och fördelningens form syns. `ys` är individernas lägen längs värdeaxeln i ritordning, där de
// `fasta` första är de som alltid ritas och resten är små (bara med visaSma). De fasta packas först, i ordning
// efter värde, och de små därefter kring dem — så ligger de fasta still när små grupper slås av och på, och en
// dold liten individ lämnar ingen lucka. Packningen är helt bestämd av indata: samma bild varje gång.
// Ryms en punkt inte inom ±halv läggs den med den vanliga spridningen i sidled (och får då täcka andra).
function _rfSvarm(ys, fasta, r, halv) {
    const ut = new Array(ys.length).fill(0), d = 2 * r + 0.6, lagda = [];
    const ordning = ys.map((_, n) => n).sort((a, b) => ((a < fasta ? 0 : 1) - (b < fasta ? 0 : 1)) || (ys[a] - ys[b]) || (a - b));
    for (const n of ordning) {
        const y = ys[n], nara = [];
        for (const p of lagda) { const dy = Math.abs(p.y - y); if (dy < d) nara.push({ x: p.x, b: Math.sqrt(d * d - dy * dy) }); }
        const fritt = x => nara.every(p => Math.abs(p.x - x) >= p.b - 1e-9);
        let bast = fritt(0) ? 0 : null;
        if (bast == null) {
            for (const p of nara) for (const x of [p.x - p.b, p.x + p.b]) {
                if (Math.abs(x) > halv || !fritt(x)) continue;
                if (bast == null || Math.abs(x) < Math.abs(bast) - 1e-9 || (Math.abs(Math.abs(x) - Math.abs(bast)) <= 1e-9 && x < bast)) bast = x;
            }
        }
        if (bast == null) { ut[n] = _rfSprid(n) * 2 * halv; continue; }   // fullt: läggs ovanpå, och räknas inte som granne
        ut[n] = bast;
        lagda.push({ x: bast, y });
    }
    return ut;
}

// Täthetskurva för en lådas individer (form: 'fiol'): [{ v, t }] med värdet v och tätheten t i 0–1 (kurvans högsta
// punkt = 1), i `steg` jämnt fördelade steg mellan lag och hog. Skattas med normalkärna och Silvermans bandbredd ur
// de värden som ligger inom [lag, hog] — morrhårens ändar. Avvikarna utanför ingår alltså varken i kurvan eller i
// dess utsträckning: kurvan visar formen hos huvuddelen och röjer mindre om enskilda än lådans avvikarpunkter gör.
function _rfTathetKurva(varden, lag, hog, steg = 40) {
    const v = varden.filter(x => x >= lag && x <= hog), n = v.length;
    if (n < 2 || !(hog > lag)) return [{ v: lag, t: 1 }, { v: hog, t: 1 }];
    const medel = v.reduce((s, x) => s + x, 0) / n;
    const sd = Math.sqrt(v.reduce((s, x) => s + (x - medel) * (x - medel), 0) / (n - 1));
    const st = _figLadstatistik(v), iqr = st ? st.q3 - st.q1 : 0;
    let h = 0.9 * Math.min(sd || Infinity, iqr > 0 ? iqr / 1.34 : Infinity) * Math.pow(n, -0.2);
    if (!(h > 0) || !isFinite(h)) h = (hog - lag) / 10;
    const ut = [];
    let storst = 0;
    for (let i = 0; i < steg; i++) {
        const x = lag + (hog - lag) * i / (steg - 1);
        let t = 0;
        for (const xi of v) { const z = (x - xi) / h; t += Math.exp(-0.5 * z * z); }
        ut.push({ v: x, t });
        if (t > storst) storst = t;
    }
    for (const p of ut) p.t = storst > 0 ? p.t / storst : 1;
    return ut;
}

// Vilka individer ett lådlager räknas ur och ritas av — EN regel, delad av ritaren (_rfLada) och av sidan
// (verktygstipsets sammanfattning, _rfTraff): punkten finns, får visas (`dold`), har ett ändligt värde och ett
// läge på värdeaxeln. Läget prövas mot skalan när den finns (ritaren); utan skala (sidan) gäller axelns slag:
// på en logaritmisk axel har bara värden över noll ett läge. För en validerad figur är de två proven samma sak.
// Ger [{ d, i }] i dataordning, med punktens index i lagrets data.
function _rfLadIndivider(figur, l, dold, skala) {
    const axel = l.axel === 'y2' && figur.y2 ? figur.y2 : figur.y;
    const log = !!axel && axel.skala === 'log';
    const ut = [];
    l.data.forEach((d, i) => {
        if (!d || dold(d) || !_rfTal(d.y)) return;
        if (skala ? !_rfTal(skala(d.y)) : (log && d.y <= 0)) return;
        ut.push({ d, i });
    });
    return ut;
}
// Lådans kategori för en individ (lådorna grupperas på den).
function _rfLadKategori(d) { return String(d.x); }

// Kvantilpunkternas kolumner: prickarna (skärmläge i y, i kvantilordning) läggs i samma kolumn när de ligger
// närmare varandra än en prickdiameter, så att ingen prick täcker en annan. [{ y, index }] — kolumnens läge (medel
// av prickarnas) och prickarnas nummer.
function _rfKvantilKolumner(ypx, r) {
    const ordning = ypx.map((y, j) => ({ y, j })).sort((a, b) => a.y - b.y), ut = [];
    for (const p of ordning) {
        const sista = ut[ut.length - 1];
        if (sista && p.y - sista.start < 2 * r) { sista.index.push(p.j); sista.summa += p.y; }
        else ut.push({ start: p.y, summa: p.y, index: [p.j] });
    }
    return ut.map(k => ({ y: k.summa / k.index.length, index: k.index }));
}

// Prickradien för ett kvantilpunktlager: den största (högst 6) där ingen grupps bredaste kolumn går utanför platsen.
function _rfKvantilRadie(grupper, l, ys, plats) {
    let r = 6;
    for (const punkter of grupper.values()) {
        const kp = _figKvantilpunkter(punkter.map(p => p.d.y), l.antal || 20);
        if (!kp) continue;
        const ypx = kp.varden.map(v => ys(v));
        while (r > 1.5 && Math.max(..._rfKvantilKolumner(ypx, r).map(k => k.index.length)) * 2 * r > plats) r -= 0.5;
    }
    return r;
}

// Låda (alltid stående): en låda per kategori ur lagrets individer, eller varje individ som en punkt
// (punkter: 'alla', utspridda i sidled, eller 'svarm', packade intill varandra). Små individer hoppas över FÖRST, så att de aldrig går in i kvartiler, morrhår, avvikare,
// urvalet eller spridningen i sidled. Lådan bär data-l och den första kvarvarande individens data-i (så att ett
// uppslag hittar kategorin); morrhår, median och avvikare bär inga index; individer bär sina egna.
function _rfLada(g, l, li, c) {
    const ys = c.yFor(l);
    if (!c.x.bandwidth || ys.bandwidth) return;
    // Lådlagren i panelen står bredvid varandra inom kategorin (bara lager som har något att rita räknas).
    const lador = c.lador.includes(li) ? c.lador : [li];
    const inre = d3.scaleBand().domain(lador).range([0, c.x.bandwidth()]).padding(0.15);
    const plats = inre.bandwidth(), bw = Math.min(plats, _RF.ladaMax), lagerfarg = c.farg(l, li);
    const svarm = l.punkter === 'svarm', alla = svarm || l.punkter === 'alla';
    const individer = _rfLadIndivider(c.figur, l, c.dold, ys);
    // Individpunkter nedsamplas som punktlager: var k:te av de individer som återstår (små är redan borta).
    // Lådor räknas alltid ur alla återstående individer.
    const steg = (alla || l.form === 'regnmoln') && individer.length > SCATTER_MAX_POINTS ? Math.ceil(individer.length / SCATTER_MAX_POINTS) : 1;
    const grupper = new Map();
    individer.forEach((o, n) => {
        if (n % steg) return;
        const k = _rfLadKategori(o.d);
        if (!grupper.has(k)) grupper.set(k, []);
        grupper.get(k).push(o);
    });
    let ritade = 0, kvantilRadie = /** @type {number|null} */ (null);
    for (const [k, punkter] of grupper) {
        const x0 = c.x(k);
        if (x0 == null) continue;
        const mitt = x0 + inre(li) + plats / 2, vanster = mitt - bw / 2;
        // Har lådans alla ritade individer samma egna färg är det lådans färg (t.ex. en färg per kön i ett lager).
        const egen = punkter[0].d.farg;
        const farg = egen && punkter.every(o => o.d.farg === egen) ? egen : lagerfarg;
        if (l.form === 'regnmoln') {
            // Regnmoln: en halv täthetskurva till höger om kategorins mitt ("molnet"), median och kvartiler som streck,
            // och varje individ som en punkt till vänster ("regnet"). Kurvan och strecken är ett aggregat (lådans
            // data-marke); punkterna är individer med egna index. De små ritas sist, som i individpunkterna, så att
            // de övriga ligger still när små grupper slås av och på.
            const s = _figLadstatistik(punkter.map(p => p.d.y));
            if (!s) continue;
            const halv = Math.min(plats, 120) / 2, kant = 3;
            const kurva = _rfTathetKurva(punkter.map(p => p.d.y), s.lag, s.hog);
            const bredd = v => { let b = kurva[0]; for (const p of kurva) if (Math.abs(p.v - v) < Math.abs(b.v - v)) b = p; return Math.max(2, b.t * (halv - kant)); };
            const moln = g.append('path').attr('data-marke', 'lada').attr('data-form', 'regnmoln').attr('data-l', li).attr('data-i', punkter[0].i)
                .attr('d', d3.area().y(p => ys(p.v)).x0(() => mitt + kant).x1(p => mitt + kant + p.t * (halv - kant)).curve(d3.curveMonotoneY)(kurva) || '')
                .attr('fill', farg).attr('fill-opacity', 0.3).attr('stroke', farg).attr('stroke-width', 1.5);
            if (punkter.some(p => p.d.liten)) moln.attr('stroke', PALETTE.semantic.neutral).attr('stroke-dasharray', '3 2');
            const streck = (marke, v, tjock) => g.append('line').attr('data-marke', marke).attr('pointer-events', 'none')
                .attr('x1', mitt + kant).attr('x2', mitt + kant + bredd(v)).attr('y1', ys(v)).attr('y2', ys(v)).attr('stroke', farg).attr('stroke-width', tjock);
            streck('kvartil', s.q1, 1); streck('kvartil', s.q3, 1); streck('median', s.median, 2.5);
            const ordnade = [...punkter.filter(p => !p.d.liten), ...punkter.filter(p => p.d.liten)];
            ordnade.forEach(({ d, i }, n) => {
                const m = g.append('circle').attr('data-marke', 'individ').attr('data-l', li).attr('data-i', i)
                    .attr('cx', mitt - kant - _RF.individ - (_rfSprid(n) + 0.5) * Math.max(0, halv - kant - 2 * _RF.individ)).attr('cy', ys(d.y)).attr('r', _RF.individ)
                    .attr('fill', d.farg || farg).attr('fill-opacity', 0.6);
                if (d.liten) m.attr('stroke', PALETTE.semantic.neutral).attr('stroke-width', 1.2).attr('stroke-dasharray', '2 1.5').attr('fill-opacity', 0.15);
                else m.attr('stroke', '#000000').attr('stroke-opacity', 0).attr('stroke-width', _RF.individTraff);
            });
            ritade += ordnade.length;
            continue;
        }
        if (l.form === 'kvantiler') {
            // Kvantilpunktdiagram: gruppen som `antal` lika stora andelar, var och en en prick vid
            // sin kvantil, staplade i sidled där de annars skulle täcka varandra (Wilkinson). Prickarna är ett aggregat
            // (lådans data-marke-familj): tips och klick gäller gruppen, och diagramdatan är kvantilerna.
            const kp = _figKvantilpunkter(punkter.map(p => p.d.y), l.antal || 20);
            if (!kp) continue;
            // Samma prickstorlek i hela lagret, så att grupperna går att jämföra: den största som ryms i varje grupp.
            if (kvantilRadie == null) kvantilRadie = _rfKvantilRadie(grupper, l, ys, plats);
            const r = /** @type {number} */ (kvantilRadie), kolumner = _rfKvantilKolumner(kp.varden.map(v => ys(v)), r);
            const liten = punkter.some(p => p.d.liten);
            for (const kol of kolumner) {
                kol.index.forEach((j, n) => {
                    const m = g.append('circle').attr('data-marke', 'kvantilpunkt').attr('data-l', li).attr('data-i', punkter[0].i).attr('data-kvantil', j)
                        .attr('cx', mitt + (n - (kol.index.length - 1) / 2) * 2 * r).attr('cy', kol.y).attr('r', Math.max(1, r - 0.6))
                        .attr('fill', farg).attr('fill-opacity', 0.85);
                    if (liten) m.attr('stroke', PALETTE.semantic.neutral).attr('stroke-width', 1.2).attr('stroke-dasharray', '2 1.5').attr('fill-opacity', 0.2);
                });
            }
            continue;
        }
        if (alla) {
            // Ordningsnumret för spridningen räknas bland de individer som faktiskt ritas i kategorin, med de små
            // SIST: de övriga ligger då still när små grupper slås av och på (utan visaSma finns inga små här).
            const ordnade = [...punkter.filter(p => !p.d.liten), ...punkter.filter(p => p.d.liten)];
            const sidled = svarm ? _rfSvarm(ordnade.map(p => ys(p.d.y)), ordnade.filter(p => !p.d.liten).length, _RF.individ, Math.max(_RF.individ, plats / 2 - _RF.individ)) : null;
            ordnade.forEach(({ d, i }, n) => {
                const m = g.append('circle').attr('data-marke', 'individ').attr('data-l', li).attr('data-i', i)
                    .attr('cx', mitt + (sidled ? sidled[n] : _rfSprid(n) * bw * 0.8)).attr('cy', ys(d.y)).attr('r', _RF.individ)
                    .attr('fill', d.farg || farg).attr('fill-opacity', svarm ? 0.85 : 0.6);
                // Liten individ: nästan ihålig, med streckad neutral kant (mer än färg). Övriga får en osynlig bred
                // kant: punkten är för liten att träffa med pekaren, och en genomskinlig kant tar emot den utan
                // extra element (bilden ser likadan ut).
                if (d.liten) m.attr('stroke', PALETTE.semantic.neutral).attr('stroke-width', 1.2).attr('stroke-dasharray', '2 1.5').attr('fill-opacity', 0.15);
                else m.attr('stroke', '#000000').attr('stroke-opacity', 0).attr('stroke-width', _RF.individTraff);
            });
            ritade += ordnade.length;
            continue;
        }
        const s = _figLadstatistik(punkter.map(p => p.d.y));
        if (!s) continue;
        const linje = (marke, y1, y2, x1, x2, tjock) => g.append('line').attr('data-marke', marke).attr('pointer-events', 'none')
            .attr('x1', x1).attr('x2', x2).attr('y1', y1).attr('y2', y2).attr('stroke', farg).attr('stroke-width', tjock);
        if (l.form === 'fiol') {
            // Fiol: en täthetskurva speglad kring kategorins mitt, mellan morrhårens ändar, med median och kvartiler
            // som streck. Den bär lådans data-marke och index: tips, klick och tangentbord behandlar den som lådan
            // (ett aggregat), och diagramdatan är lådans. Inga morrhår och inga avvikarpunkter.
            const halv = Math.min(plats, 96) / 2;
            const kurva = _rfTathetKurva(punkter.map(p => p.d.y), s.lag, s.hog);
            const bredd = v => { let b = kurva[0]; for (const p of kurva) if (Math.abs(p.v - v) < Math.abs(b.v - v)) b = p; return Math.max(2, b.t * halv); };
            const fiol = g.append('path').attr('data-marke', 'lada').attr('data-form', 'fiol').attr('data-l', li).attr('data-i', punkter[0].i)
                .attr('d', d3.area().y(p => ys(p.v)).x0(p => mitt - p.t * halv).x1(p => mitt + p.t * halv).curve(d3.curveMonotoneY)(kurva) || '')
                .attr('fill', farg).attr('fill-opacity', 0.3).attr('stroke', farg).attr('stroke-width', 1.5);
            // En kurva som bygger på någon liten individ (bara med visaSma): streckad kant, mer än färg.
            if (punkter.some(p => p.d.liten)) fiol.attr('stroke', PALETTE.semantic.neutral).attr('stroke-dasharray', '3 2');
            linje('kvartil', ys(s.q1), ys(s.q1), mitt - bredd(s.q1), mitt + bredd(s.q1), 1);
            linje('kvartil', ys(s.q3), ys(s.q3), mitt - bredd(s.q3), mitt + bredd(s.q3), 1);
            linje('median', ys(s.median), ys(s.median), mitt - bredd(s.median), mitt + bredd(s.median), 2.5);
            continue;
        }
        linje('morrhar', ys(s.q1), ys(s.lag), mitt, mitt, 1.5);
        linje('morrhar', ys(s.q3), ys(s.hog), mitt, mitt, 1.5);
        const lada = g.append('rect').attr('data-marke', 'lada').attr('data-l', li).attr('data-i', punkter[0].i)
            .attr('x', vanster).attr('width', bw).attr('y', Math.min(ys(s.q1), ys(s.q3))).attr('height', Math.max(1, Math.abs(ys(s.q1) - ys(s.q3))))
            .attr('fill', farg).attr('fill-opacity', 0.25).attr('stroke', farg).attr('stroke-width', 1.5);
        // En låda som bygger på någon liten individ (bara med visaSma) markeras som en liten yta.
        if (punkter.some(p => p.d.liten)) _rfLitenYta(g, lada, c);
        linje('median', ys(s.median), ys(s.median), vanster, vanster + bw, 2.5);
        // `avvikare: false` på lagret: lådan ritas utan de enskilda lönerna utanför morrhåren (en avvikare är en person).
        if (l.avvikare !== false) for (const v of s.avvikare) {
            g.append('circle').attr('data-marke', 'avvikare').attr('pointer-events', 'none')
                .attr('cx', mitt).attr('cy', ys(v)).attr('r', _RF.individ).attr('fill', 'none').attr('stroke', farg).attr('stroke-width', 1.2);
        }
    }
    if (steg > 1) c.nedsamplat(ritade, individer.length);
}

// Färgskalans domän [a, b] ur figurens `fargskala`, eller null om den inte är två ändliga tal. Lika tal vidgas
// med ±1 kring värdet (som skalDoman gör för min === max); a > b är tillåtet och ger en omvänd skala.
function _rfFargDoman(fs) {
    if (!fs || typeof fs !== 'object' || !Array.isArray(fs.doman) || fs.doman.length !== 2) return null;
    const [a, b] = fs.doman;
    if (!_rfTal(a) || !_rfTal(b)) return null;
    return a === b ? [a - 1, a + 1] : [a, b];
}
// Skalans mittvärde om `mitt` är ett tal strikt inom domänen, annars null.
/** @param {any} fs @param {any[]} dom */
const _rfFargMitt = (fs, [a, b]) => (_rfTal(fs.mitt) && fs.mitt > Math.min(a, b) && fs.mitt < Math.max(a, b) ? fs.mitt : null);

/**
 * Färgskala ur figurens `fargskala` ({ typ, doman: [a, b], mitt?, farger? }), eller null om den saknas eller
 * saknar användbar domän (valideraFigur avvisar det för figurer som behöver färg). Värden utanför domänen kläms
 * till ändfärgerna. Med `mitt` ligger skalans mittfärg vid det värdet (t.ex. 100 i en divergerande skala), även
 * när domänen är sned. Skalan följer bara figurens `fargskala` — aldrig lagrens data, så en liten punkt kan inte
 * flytta den. Byggs en gång per ritning (_rfByggSvg) och skickas vidare.
 */
function _rfFargskala(fs) {
    const dom = _rfFargDoman(fs);
    if (!dom) return null;
    const [a, b] = dom;
    const std = {
        sekventiell: PALETTE.sekventiell,
        divergerande: PALETTE.divergerande,
        tvafarg: [[0, PALETTE.kon.man], [1, PALETTE.kon.kvinna]],
    };
    const stopp = (Array.isArray(fs.farger) && fs.farger.length > 1 ? fs.farger : null) || std[fs.typ] || std.sekventiell;
    const mitt = _rfFargMitt(fs, dom);
    const varde = t => (mitt == null ? a + t * (b - a) : (t <= 0.5 ? a + (t / 0.5) * (mitt - a) : mitt + ((t - 0.5) / 0.5) * (b - mitt)));
    return d3.scaleLinear().domain(stopp.map(s => varde(s[0]))).range(stopp.map(s => s[1])).clamp(true);
}

// Bredden färgstapeln behöver i högermarginalen — ur figurens `fargskala` (som har en användbar domän: anroparen
// har redan byggt skalan) och bildens bredd, aldrig ur data. Bredden rymmer titeln och ändvärdena, men högst 30 %
// av bilden (minst _RF.fargB); en längre titel kortas (hela titeln i <title>).
function _rfFargstapelMatt(fs, px, B) {
    const fpx = px - 1, dom = /** @type {any[]} */ (_rfFargDoman(fs)), mitt = _rfFargMitt(fs, dom);
    const text = v => _figTalformat(v, fs.format, { enhet: false });
    const titel = fs.titel != null ? String(fs.titel) : '';
    const etB = [...dom, ...(mitt == null ? [] : [mitt])].reduce((m, v) => Math.max(m, _rfBredd(text(v), fpx)), 0);
    const behov = Math.ceil(Math.max(_RF.fargText + etB, _rfBredd(titel, fpx)));
    const plats = Math.min(Math.max(_RF.fargB, Math.floor(B * 0.3)) - _RF.fargLuft, Math.max(_RF.fargB - _RF.fargLuft, behov));
    return { bredd: plats + _RF.fargLuft, plats };
}

// Färgstapeln till höger om ytan: staplade färgfält i stället för en gradient (ingen <defs>, inget id att krocka
// om), med domänens ändvärden (och mittvärdet om skalan har ett) som text och titeln ovanför. `x` är stapelns
// vänsterkant i ytans koordinater och `plats` bredden den får ta (från _rfFargstapelMatt). Stapeln är linjär i
// värdet med det STÖRSTA värdet överst, också när domänen är omvänd. Fälten bär inga index och tar inte emot pekaren.
function _rfFargstapel(rot, fs, skala, x, hojd, px, plats) {
    if (!skala) return;
    const fpx = px - 1, dom = /** @type {any[]} */ (_rfFargDoman(fs)), mitt = _rfFargMitt(fs, dom);
    const lag = Math.min(...dom), hog = Math.max(...dom);
    const titel = fs.titel != null ? String(fs.titel) : '';
    const titelH = titel ? fpx + 6 : 0;
    const h = Math.max(12, Math.min(hojd - titelH, _RF.fargH));
    const n = Math.max(2, Math.ceil(h / _RF.fargSteg)), steg = h / n;
    const g = rot.append('g').attr('transform', `translate(${x},${(hojd - h - titelH) / 2 + titelH})`);
    for (let i = 0; i < n; i++) {
        // Fälten överlappar en halv pixel så att inga springor syns; det sista slutar exakt vid stapelns nederkant.
        g.append('rect').attr('data-marke', 'fargstapel').attr('pointer-events', 'none').attr('x', 0).attr('y', i * steg)
            .attr('width', _RF.fargStapel).attr('height', i < n - 1 ? steg + 0.5 : steg).attr('fill', skala(hog - (i + 0.5) / n * (hog - lag)));
    }
    g.append('rect').attr('pointer-events', 'none').attr('x', 0).attr('y', 0).attr('width', _RF.fargStapel).attr('height', h)
        .attr('fill', 'none').attr('stroke', FARG.blek).attr('stroke-width', 1);
    // Ändvärdena vid stapelns över- och underkant; mittvärdet på sin plats om det inte krockar med dem.
    // Ett tal som inte ryms på bredden hoppas över (tal kortas aldrig).
    const text = (v, y) => {
        const t = _figTalformat(v, fs.format, { enhet: false });
        if (_RF.fargText + _rfBredd(t, fpx) <= plats + 0.01) _rfText(g, _RF.fargText, y, t, { px: fpx });
    };
    text(hog, fpx * 0.8);
    text(lag, h);
    if (mitt != null) {
        const y = h * (hog - mitt) / (hog - lag) + fpx * 0.35;
        if (y - fpx * 0.8 >= fpx * 1.05 + 2 && y + fpx * 0.25 <= h - fpx * 0.8 - 2) text(mitt, y);
    }
    if (titel) _rfText(g, 0, -6, _rfKorta(titel, plats / (fpx * _RF.tecken)), { px: fpx, title: titel });
}

// Ruta (värmekarta): en ruta per cell med ändligt värde, färgad ur figurens färgskala. Rutorna fyller hela sitt
// steg på bandskalorna (med 1 px springa), så att kartan blir sammanhängande. Med visaText ritas cellernas texter —
// alla eller inga: bara om varje ritad cells text ryms i rutan (dolda små celler räknas inte). Texten är ljus eller
// mörk efter rutans färg (räknad ur färgen — inte ur DOM); på en liten ruta får den en kant i MOTSATT färg (vit
// kring mörk text, mörk kring vit), så att den går att läsa över ränderna.
function _rfRuta(g, l, li, c) {
    if (!c.x.bandwidth || !c.y.bandwidth || !c.fargskala) return;
    const w = Math.max(1, c.x.step() - 1), h = Math.max(1, c.y.step() - 1);
    const fpx = c.px - 1;
    const celler = [];
    l.data.forEach((d, i) => {
        if (!d || c.dold(d)) return;
        const mx = _rfPos(c.x, d.x), my = _rfPos(c.y, d.y);
        if (mx == null || my == null || !_rfTal(d.varde)) return;
        celler.push({ d, i, mx, my });
    });
    const medText = !!l.visaText && h >= fpx + 2 && celler.every(o => o.d.text == null || w >= _rfBredd(o.d.text, fpx) + 4);
    for (const { d, i, mx, my } of celler) {
        const farg = c.fargskala(d.varde);
        const r = g.append('rect').attr('data-marke', 'ruta').attr('data-l', li).attr('data-i', i)
            .attr('x', mx - w / 2).attr('y', my - h / 2).attr('width', w).attr('height', h).attr('fill', farg);
        if (d.liten) _rfLitenRuta(g, r);
        if (!medText || d.text == null) continue;
        const f = d3.color(farg), textfarg = _rfTextPaFarg(f ? f.formatHex() : '');
        // Den mörka kanten kring vit text är tunnare än den vita kring mörk text: en bred mörk kant äter upp de vita tecknen.
        const vit = textfarg === FARG.vit;
        /** @type {{[k: string]: any}|null} */
        const attr = d.liten ? { stroke: vit ? CHART_FONT.color : FARG.vit, 'stroke-width': vit ? _RF.kantMork : 3, 'stroke-linejoin': 'round', 'paint-order': 'stroke' } : null;
        _rfText(g, mx, my + fpx * 0.35, String(d.text), { px: fpx, ankare: 'middle', farg: textfarg, attr })
            .attr('data-marke', 'rutatext').attr('pointer-events', 'none');
    }
}

// Zonerna ur figurens `referens` med sina lägen i panelen: [{ r, lodrat, fran, till }] (px). En zon är lodrät
// (avgränsad längs x) om x0 eller x1 finns, annars vågrät. Zoner på bandskalor, med ogiltiga gränser eller helt
// utanför panelen finns inte med; övriga är klippta till panelen.
function _rfZoner(figur, c, bredd, hojd) {
    const ut = [];
    for (const r of Array.isArray(figur.referens) ? figur.referens : []) {
        if (!r || r.typ !== 'zon') continue;
        const lodrat = r.x0 != null || r.x1 != null;
        const [n0, n1] = lodrat ? ['x0', 'x1'] : ['y0', 'y1'];
        if (r[n0] == null && r[n1] == null) continue;
        const s = lodrat ? c.x : (r.axel === 'y2' && c.y2 ? c.y2 : c.y);
        const max = lodrat ? bredd : hojd;
        if (s.bandwidth) {
            // Bandaxel: gränserna är kategorier, och zonen täcker dem inklusive (med halva mellanrummet till
            // grannarna). En kategori utan ritad punkt finns inte i domänen — då ritas ingen zon.
            const p0 = r[n0] != null ? s(String(r[n0])) : null, p1 = r[n1] != null ? s(String(r[n1])) : null;
            if ((r[n0] != null && p0 == null) || (r[n1] != null && p1 == null)) continue;
            const luft = (s.step() - s.bandwidth()) / 2;
            const kanter = [p0, p1].filter(p => p != null).flatMap(p => [p - luft, p + s.bandwidth() + luft]);
            const fran = Math.max(0, r[n0] != null ? Math.min(...kanter) : 0), till = Math.min(max, r[n1] != null ? Math.max(...kanter) : max);
            if (till > fran) ut.push({ r, lodrat, fran, till });
            continue;
        }
        if ((r[n0] != null && !_rfTal(r[n0])) || (r[n1] != null && !_rfTal(r[n1]))) continue;
        // En gräns som saknas är panelens kant på den sidan (förbi domänens ände och märkenas marginal).
        const [d0, d1] = _rfDomanSorterad(s);
        const stigande = s(d0) <= s(d1);
        const a = r[n0] != null ? s(r[n0]) : (stigande ? 0 : max), b = r[n1] != null ? s(r[n1]) : (stigande ? max : 0);
        if (!_rfTal(a) || !_rfTal(b)) continue;
        const fran = Math.max(0, Math.min(a, b)), till = Math.min(max, Math.max(a, b));
        if (till > fran) ut.push({ r, lodrat, fran, till });
    }
    return ut;
}

// Zonernas etiketter: i panelens OKLIPPTA textgrupp, över märken och referenslinjer, med vit kant så att de går
// att läsa mot vad som än ligger under. Överst i zonen: mitt över en lodrät zon, i övre vänstra hörnet av en vågrät.
// En etikett som inte ryms i zonens bredd kortas (hela texten i <title>, och etiketten tar då emot pekaren); ryms
// färre än tre tecken ritas den inte.
// Ligger en text redan där (en stapeletikett eller en tidigare zonetikett) läggs etiketten en rad längre ned;
// ryms den inte på tre försök ritas den inte.
function _rfZonEtiketter(zoner, c, bredd, hojd) {
    const fpx = c.px - 1;
    // Rutorna för de texter som redan ligger i textgruppen, uppskattade ur deras egna attribut (ingen DOM-mätning).
    const tagna = [];
    c.texter.selectAll('text').each(/** @this {SVGTextElement} */ function () {
        const px = Number(this.getAttribute('font-size')), x = Number(this.getAttribute('x')), y = Number(this.getAttribute('y'));
        const b = _rfBredd(this.firstChild ? this.firstChild.nodeValue : '', px), a = this.getAttribute('text-anchor');
        const x0 = a === 'end' ? x - b : a === 'middle' ? x - b / 2 : x;
        tagna.push({ x0, x1: x0 + b, y0: y - px * 0.8, y1: y + px * 0.25 });
    });
    for (const { r, lodrat, fran, till } of zoner) {
        if (r.etikett == null || String(r.etikett) === '') continue;
        const hel = String(r.etikett);
        const ryms = Math.floor(((lodrat ? till - fran : bredd) - 8) / (fpx * _RF.tecken));   // 4 px luft på var sida
        if (ryms < Math.min(3, hel.length)) continue;
        const text = _rfKorta(hel, ryms), tb = _rfBredd(text, fpx);
        const x0 = lodrat ? (fran + till) / 2 - tb / 2 : Math.min(4, Math.max(0, bredd - tb));
        for (let rad = 0; rad < 3; rad++) {
            const y0 = (lodrat ? 2 : fran + 2) + rad * (fpx + 3);
            const ruta = { x0, x1: x0 + tb, y0, y1: y0 + fpx * 1.05 };
            if (ruta.y1 > hojd) break;
            if (tagna.some(q => ruta.x0 < q.x1 + 2 && q.x0 < ruta.x1 + 2 && ruta.y0 < q.y1 && q.y0 < ruta.y1)) continue;
            tagna.push(ruta);
            // En kortad etikett (den får ett <title> med hela texten) tar emot pekaren, så att webbläsaren visar
            // hela texten; en okortad gör det inte — märkena under den går då att träffa.
            _rfText(c.texter, x0, y0 + fpx * 0.8, text, { px: fpx, farg: r.textfarg || FARG.dampad, fet: true, title: hel,
                attr: { 'data-marke': 'zonetikett', ...(text === hel ? { 'pointer-events': 'none' } : {}), stroke: FARG.vit, 'stroke-width': 3, 'stroke-linejoin': 'round', 'paint-order': 'stroke' } });
            break;
        }
    }
}

// Referenser ur figurens `referens`: zonernas ytor ritas under märkena (del = 'zon'); linjerna och zonernas
// etiketter över (del = 'linje' — linjerna i den klippta panelen, etiketterna i panelens oklippta textgrupp).
// De hör till figuren, inte till någon datapunkt: de bär inga index och tar inte emot pekaren. En referens
// utanför axelns domän ritas inte — och domänen räknas bara ur de punkter som ritas.
// `g` är panelens klippta svg, `bredd` × `hojd` panelens mått.
function _rfReferenser(g, figur, c, bredd, hojd, del) {
    const zoner = _rfZoner(figur, c, bredd, hojd);
    if (del === 'zon') {
        for (const { r, lodrat, fran, till } of zoner) {
            g.append('rect').attr('data-marke', 'zon').attr('pointer-events', 'none')
                .attr('x', lodrat ? fran : 0).attr('width', lodrat ? till - fran : bredd)
                .attr('y', lodrat ? 0 : fran).attr('height', lodrat ? hojd : till - fran)
                .attr('fill', r.farg || FARG.ytaStark).attr('fill-opacity', r.opacitet != null ? r.opacitet : 0.6);
        }
        return;
    }
    for (const r of Array.isArray(figur.referens) ? figur.referens : []) {
        if (!r || (r.typ || 'linje') !== 'linje') continue;
        const lodrat = r.x != null;
        if (!lodrat && r.y == null) continue;
        const s = lodrat ? c.x : (r.axel === 'y2' && c.y2 ? c.y2 : c.y);
        const p = _rfPos(s, lodrat ? r.x : r.y);
        if (p == null || p < -0.5 || p > (lodrat ? bredd : hojd) + 0.5) continue;
        const linje = g.append('line').attr('data-marke', 'referenslinje').attr('pointer-events', 'none')
            .attr('x1', lodrat ? p : 0).attr('x2', lodrat ? p : bredd).attr('y1', lodrat ? 0 : p).attr('y2', lodrat ? hojd : p)
            .attr('stroke', r.farg || FARG.blek).attr('stroke-width', r.tjocklek || 1.5);
        const streck = _RF.streck[r.streck || 'hel'];
        if (streck) linje.attr('stroke-dasharray', streck);
        // Linjens etikett (t.ex. "80 %"): vid linjens högra ände, strax ovanför — eller överst, till höger om en lodrät linje.
        if (r.etikett != null && String(r.etikett) !== '') {
            const fpx = c.px - 2, text = _rfKorta(String(r.etikett), 24), tb = _rfBredd(text, fpx);
            const x = lodrat ? Math.min(p + 4, Math.max(0, bredd - tb)) : Math.max(0, bredd - tb - 4);
            const y = lodrat ? fpx + 2 : Math.max(fpx, p - 4);
            _rfText(c.texter, x, y, text, { px: fpx, farg: r.textfarg || r.farg || FARG.dampad, fet: true, title: String(r.etikett),
                attr: { 'data-marke': 'linjeetikett', 'pointer-events': 'none', stroke: FARG.vit, 'stroke-width': 3, 'stroke-linejoin': 'round', 'paint-order': 'stroke' } });
        }
    }
    _rfZonEtiketter(zoner, c, bredd, hojd);
}

// Märke → ritfunktion (g, lager, lagrets index i inskickade figuren, kontext).
// Yta: en fri rektangel mellan två hörn på talaxlar — { x0, x1, y0, y1, namn?, varde?, fargvarde?, farg?, etikett?,
// undertext? } (trädkartan: vyn räknar lägena, kärnan ritar). Färgen är punktens `farg`, annars färgskalan för
// `fargvarde`, annars lagrets. Etiketten står uppe till vänster i ytan när den ryms (med lagrets `etikettLage:
// 'topp'` bara där, annars också en rad under); en yta som är för liten får ingen text — namnet står i tipset.
// En liten yta (bara med visaSma) får streckad kant och ränder.
function _rfYta(g, l, li, c) {
    const ys = c.yFor(l);
    if (c.x.bandwidth || ys.bandwidth) return;
    const fpx = c.px - 1;
    l.data.forEach((d, i) => {
        if (!d || c.dold(d)) return;
        const xa = c.x(d.x0), xb = c.x(d.x1), ya = ys(d.y0), yb = ys(d.y1);
        if (![xa, xb, ya, yb].every(_rfTal)) return;
        const x = Math.min(xa, xb), y = Math.min(ya, yb), w = Math.abs(xb - xa), h = Math.abs(yb - ya);
        if (!(w > 0 && h > 0)) return;
        const farg = d.farg || (d.fargvarde != null && c.fargskala ? c.fargskala(d.fargvarde) : c.farg(l, li));
        const r = g.append('rect').attr('data-marke', 'yta').attr('data-l', li).attr('data-i', i)
            .attr('x', x).attr('y', y).attr('width', w).attr('height', h).attr('fill', farg).attr('stroke', FARG.vit).attr('stroke-width', 1);
        if (l.opacitet != null) r.attr('fill-opacity', l.opacitet);
        if (d.liten) _rfLitenYta(g, r, c);
        if (d.etikett == null || String(d.etikett) === '' || h < fpx + 6 || w < 28) return;
        const f = d3.color(farg), textfarg = l.opacitet != null && l.opacitet < 0.6 ? CHART_FONT.color : _rfTextPaFarg(f ? f.formatHex() : '');
        const tecken = Math.max(3, Math.floor((w - 8) / (fpx * _RF.tecken)));
        const hel = String(d.etikett);
        _rfText(g, x + 4, y + fpx + 2, _rfKorta(hel, tecken), { px: fpx, farg: textfarg, fet: true, title: hel, attr: { 'data-marke': 'ytetikett', 'pointer-events': 'none' } });
        if (l.etikettLage !== 'topp' && d.undertext != null && h >= 2 * fpx + 10) {
            _rfText(g, x + 4, y + 2 * fpx + 5, _rfKorta(String(d.undertext), tecken), { px: fpx - 1, farg: textfarg, attr: { 'data-marke': 'ytetikett', 'pointer-events': 'none' } });
        }
    });
}

const _RF_MARKEN = { stapel: _rfStapel, punkt: _rfPunkt, linje: _rfLinje, band: _rfBand, intervall: _rfIntervall, lada: _rfLada, ruta: _rfRuta, yta: _rfYta };

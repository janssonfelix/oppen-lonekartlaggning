// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
// ====================================================================
// 10-diagramritare.js — Figur → SVG med D3 (ADR-39; se docs/utveckling/diagramkarnan.md)
//
// Vyerna bygger en figur (ren data, se src/lib/figur.js); ritaren gör SVG av den.
//
// Tre regler bär ritaren:
//  1. Ritaren mäter ALDRIG text i DOM. Bredd räknas ur teckenantal, så samma figur ger samma
//     SVG — i webbläsaren, i jsdom och i ett element som inte sitter i sidan (export).
//  2. SVG:n bär bara presentationsattribut: inga klasser, inga <style>, ingen foreignObject.
//     En exporterad bild ser därför likadan ut utan sidans stilmall, och CSP:n behöver
//     inget undantag.
//  3. Datapunkter märkta `liten` ritas bara med val.visaSma (Utforska, ADR-14).
//
// Index: data-l är lagrets index i figuren som skickades in, data-i datapunktens index i lagrets
// data — alltid, med eller utan visaSma och dolda serier. Små punkter som inte ritas finns inte i
// DOM, så ett uppslag på data-l/data-i kan aldrig ge en borttagen punkt. Allt som inte får lämna
// spår (domäner, förklaring, stapelplatser, staplade summor, paneler) räknas ur de synliga punkterna.
//
// Ritaren är delad i tre filer: 10-diagramlayout.js (mått och layout), 10-diagrammarken.js (märkena, färgskalan,
// referenserna) och den här (vad som ritas, panelen, förklaringen, _rfByggSvg). Alla tre sorteras före
// 10-diagramtema.js: PALETTE och CHART_FONT läses först vid anrop.
// ====================================================================

// _rfByggSvg arbetar i steg; varje steg läser bara det tidigare steg gav (steg 2–4 ligger i 10-diagramlayout.js).
// Steg 1: vad som ritas. Lager med minst en synlig punkt (med sitt index i figurIn.lager), figuren för domäner
// och de paneler som har något synligt. Domäner, förklaring, paneler, stapelplatser och staplade summor räknas
// bara ur detta och de synliga punkterna — aldrig ur figurIn.lager[].data rakt av.
function _rfSynligt(figurIn, val) {
    const visa = !!val.visaSma;
    const dold = d => !visa && !!(d && d.liten);   // en liten punkt som inte får synas
    const dolda = val.dolda || new Set();
    const lagerAlla = figurIn.lager.map((l, li) => ({ l, li, vd: l.data.filter(d => d && !dold(d)) })).filter(o => o.vd.length);
    const synliga = lagerAlla.filter(({ l }) => !(l.serie && dolda.has(String(l.serie))));
    // Kategoriordningen är ALLTID originalets (uttrycklig `ordning` först, sedan första förekomst bland alla
    // lagrens punkter i den inskickade figuren), begränsad till det som ritas — oberoende av visaSma och dolda
    // serier (S5, T4). skalDoman begränsar `ordning` till kategorier som finns i de synliga lagren.
    const original = { ...figurIn, lager: figurIn.lager.map(l => ({ ...l, data: l.data.filter(d => d) })) };
    const bandOrdning = a => (figurIn[a].skala === 'band' ? { ...figurIn[a], ordning: _figSkalDoman(original, a) } : figurIn[a]);
    const domFigur = { ...figurIn, x: bandOrdning('x'), y: bandOrdning('y'), lager: synliga.map(({ l, vd }) => ({ ...l, data: vd })) };
    const panelLista = Array.isArray(figurIn.paneler) && figurIn.paneler.length ? figurIn.paneler : null;
    // En panel utan något synligt lager ritas inte (varken titel eller yta). Regeln är figurformatets
    // (_figPanelerMedLager, samma som utanSmaGrupper använder); ritaren avgör bara VILKA lager som syns.
    const paneler = panelLista ? _figPanelerMedLager(panelLista, lagerAlla.map(({ l }) => l)) : [null];
    const doms = { x: _figSkalDoman(domFigur, 'x'), y: _figSkalDoman(domFigur, 'y'), y2: figurIn.y2 ? _figSkalDoman(domFigur, 'y2') : null };
    return { visa, dold, dolda, lagerAlla, synliga, paneler, antalP: Math.max(1, paneler.length), doms };
}

// En panel: stödlinjer, märken (i en nästlad <svg> som klipper), stapeletiketter, axellinje, x-markeringar, titel.
// L = sammanställda mått (lodrät + vågrät + y-axlar), urval = Map för nedsamplade punktlager.
function _rfRitaPanel(rot, figurIn, syn, L, px, panel, pi, urval) {
    const { panelB, inreH, y, y2 } = L;
    const g = rot.append('g').attr('transform', `translate(${pi * (panelB + L.glapp)},0)`);
    const x = _rfSkala(figurIn.x, syn.doms.x, _rfXOmfang(figurIn, panelB, L.rumX));
    const utV = pi === 0 ? L.vanster - 2 : L.glapp / 2 - 1;
    const utH = pi === syn.paneler.length - 1 ? L.hoger - 2 : L.glapp / 2 - 1;
    const iPanel = _rfIPanel(syn, panel);

    // Stödlinjer (ej klippta) och x-axelns markeringar.
    if (!L.yBand) for (const p of L.yRutnat) g.append('line').attr('x1', 0).attr('x2', panelB).attr('y1', p).attr('y2', p).attr('stroke', FARG.ytaStark).attr('stroke-width', 1);
    const { xEt, rutnat } = _rfXEtiketter(figurIn, x, panelB, utV, utH, px, L.xTvaRader);
    for (const p of rutnat) g.append('line').attr('x1', p).attr('x2', p).attr('y1', 0).attr('y2', inreH).attr('stroke', FARG.ytaStark).attr('stroke-width', 1);

    // Märkena i en nästlad <svg> (egen vy som klipper till panelen — inga id behövs): staplar och punkter
    // utanför en smalare domän når inte axlar eller text.
    const gm = g.append('svg').attr('data-del', 'panel').attr('overflow', 'hidden').attr('x', 0).attr('y', 0).attr('width', panelB).attr('height', inreH);
    const gt = g.append('g');
    const c = {
        x, y, y2, px, figur: figurIn, fargskala: L.fargskala, texter: gt, etikettMax: L.etikettMax, etiketter: L.etiketter, panelB, inreH,
        yFor: l => (l.axel === 'y2' && y2 ? y2 : y),
        farg: (l, li) => l.farg || PALETTE.serie[li % PALETTE.serie.length],
        dold: syn.dold,
        bredvid: _rfBredvid(iPanel),
        lador: iPanel.filter(({ l }) => l.marke === 'lada').map(({ li }) => li),
        stapel: new Map(),
        punktetiketter: [],
    };
    // Referenser under märkena (zoner först).
    _rfReferenser(gm, figurIn, c, panelB, inreH, 'zon');
    for (const { l, li } of iPanel) {
        const ritaMarke = _RF_MARKEN[l.marke];
        if (ritaMarke) ritaMarke(gm, l, li, { ...c, nedsamplat: (ritade, totalt) => urval.set(li, [ritade, totalt]) });
    }
    _rfEtikettKrockar(c.punktetiketter, inreH);
    _rfReferenser(gm, figurIn, c, panelB, inreH, 'linje');
    // Nollinjer (data-marke="nollinje"): sist i den klippta svg:n, över märken och referenser.
    for (const [axel, skala, lodrat] of [[figurIn.x, x, true], [figurIn.y, y, false]]) {
        if (!axel.nollinje || skala.bandwidth) continue;
        const p = skala(0);
        if (!_rfTal(p)) continue;
        gm.append('line').attr('data-marke', 'nollinje').attr('pointer-events', 'none').attr('stroke', FARG.svag).attr('stroke-width', 1.5)
            .attr('x1', lodrat ? p : 0).attr('x2', lodrat ? p : panelB).attr('y1', lodrat ? 0 : p).attr('y2', lodrat ? inreH : p);
    }
    if (!figurIn.x.dold) g.append('line').attr('x1', 0).attr('x2', panelB).attr('y1', inreH).attr('y2', inreH).attr('stroke', FARG.blek).attr('stroke-width', 1);
    for (const k of xEt) {
        const t = _rfText(g, k.p, inreH + px + 6, k.text, { px, ankare: 'middle', title: k.hel, farg: x.bandwidth ? undefined : CHART_FONT.dampad, attr: { 'data-axel': 'x' } });
        // Andra raden av ett långt kategorinamn (L.xTvaRader): en tspan under den första.
        if (k.rad2) t.append('tspan').attr('x', k.p).attr('dy', px + 2).text(k.rad2);
    }
    if (panel != null) _rfText(g, panelB / 2, -8, _rfKorta(panel, panelB / ((px + 1) * _RF.tecken)), { px: px + 1, ankare: 'middle', fet: true, title: String(panel) });
}

// Förklaringen (utanför bildgruppen: knapparna ska vara nåbara för hjälpmedel) och noten.
function _rfRitaLegend(svg, L, syn, px, H, notRader) {
    const legendY = L.topp + L.inreH + L.axelNer + L.legBas;
    const lg = svg.append('g').attr('data-del', 'forklaring');
    L.legend.poster.forEach(p => {
        const dold_ = syn.dolda.has(p.serie);
        const g = lg.append('g').attr('data-serie', p.serie).attr('role', 'button').attr('tabindex', 0)
            .attr('aria-pressed', dold_ ? 'false' : 'true').attr('aria-label', `Visa eller dölj serien ${p.serie}`)
            .attr('transform', `translate(${8 + p.x},${legendY + p.rad * _RF.legendRad})`).attr('cursor', 'pointer')
            .attr('opacity', dold_ ? 0.4 : 1);
        const f = p.l.farg || PALETTE.serie[p.li % PALETTE.serie.length];
        if (p.l.marke === 'linje') g.append('line').attr('x1', 0).attr('x2', 12).attr('y1', -4).attr('y2', -4).attr('stroke', f).attr('stroke-width', 2.5);
        else if (p.l.marke === 'punkt' && (!p.l.symbol || p.l.symbol === 'cirkel' || p.l.symbol === 'romb' || p.l.symbol === 'kvadrat')) _rfSymbol(g, p.l.symbol, 6, -4, 5, f).attr('data-prov', 'punkt');
        else if (p.l.marke === 'punkt' && p.l.symbol === 'streck') g.append('line').attr('data-prov', 'punkt').attr('x1', 6).attr('x2', 6).attr('y1', -10).attr('y2', 2).attr('stroke', f).attr('stroke-width', 2.5);
        else {
            g.append('rect').attr('x', 0).attr('y', -10).attr('width', 12).attr('height', 12).attr('rx', 2).attr('fill', f);
            if (p.l.monster) _rfMonster(g, 0, -10, 12, 12, p.l.monster);
        }
        _rfText(g, 18, 0, p.text, { px, title: p.serie });
    });
    if (L.legend.fler) _rfText(lg, 8 + L.legend.fler.x, legendY + L.legend.fler.rad * _RF.legendRad, L.legend.fler.text, { px, attr: { 'data-legend': 'fler' } });
    notRader.forEach((rad, k) => _rfText(svg, 8, H - 8 - (notRader.length - 1 - k) * px, rad, { px: px - 1, farg: FARG.kritisk }));
    // Fotraden (exporten: verktyg, datum, urval) står överst i botten, i dämpad färg; rubriken överst i bilden.
    if (L.fot) _rfText(svg, 8, H - 8 - notRader.length * px - (notRader.length ? 4 : 0), L.fot, { px: px - 2, farg: FARG.svag, attr: { 'data-del': 'fot' } });
    if (L.rubrik) _rfText(svg, 8, px + 8, L.rubrik, { px: px + 2, fet: true, farg: FARG.text, attr: { 'data-del': 'rubrik' } });
}

/**
 * Bygger SVG:n för en figur. Sätter inget i sidan och läser inget ur den.
 * @param {any} figurIn  figur enligt src/lib/figur.js (redan validerad); data-l/data-i pekar på den
 * @param {number} bredd    bildens bredd i pixlar
 * @param {{hojd?:number, visaSma?:boolean, dolda?:Set<string>, bakgrund?:string, not?:string, rubrik?:string, fot?:string, radpanelBredvid?:boolean}} [val]
 *   rubrik och fot (en rad var, avkortas) är till för exporten: en bild som klistras in i ett dokument säger själv vad den visar.
 * @returns {SVGSVGElement}
 */
function _rfByggSvg(figurIn, bredd, val = {}) {
    if (figurIn.paneler === 'auto') {
        const delar = _rfRadpanelDelar(figurIn);
        if (delar) return _rfByggRadpaneler(figurIn, delar, bredd, val);
        figurIn = { ...figurIn, paneler: undefined };
    }
    const px = CHART_FONT.size;
    const B = isFinite(+bredd) && +bredd > 0 ? +bredd : 600;
    const hv = val.hojd || figurIn.hojd || _RF.hojd;
    const H = isFinite(+hv) && +hv > 0 ? +hv : _RF.hojd;
    const syn = _rfSynligt(figurIn, val);
    const lod = _rfLodratLayout(figurIn, val, B, H, px, syn);
    // Stapeletiketterna (U1) — en kedja framåt, ingen omgång till:
    //  1. märkenas marginaler (rumBas) och y-axelns marginalmått (yMarg) räknas UTAN etikettrum,
    //  2. de ger ytans höjd och panelbredden — kategoriaxlarnas verkliga längder, som etikettrummet inte rör
    //     (rummet krymper bara värdeaxelns pixelomfång; marginalerna behåller måtten från 1),
    //  3. beslutet per lager tas en gång med de längderna, och rummet reserveras för just de etiketter som ritas,
    //  4. y-axlarna får sina slutliga pixelomfång inom de marginaler som redan är mätta.
    const rumBas = _rfEtikettRum(syn.synliga, syn.doms, figurIn, syn.dold);
    const yMarg = _rfYAxlar(figurIn, syn, rumBas, B, px, lod.inreH, null);
    const fargskala = _rfFargskala(figurIn.fargskala);   // en gång per ritning: layouten, märkena och färgstapeln delar den
    const vag = _rfVagratLayout(figurIn, syn, yMarg, B, px, fargskala);
    const etiketter = _rfEtikettBeslut(figurIn, syn, px, lod.inreH, vag.panelB);
    const rum = _rfStapelEtikettRum(rumBas, etiketter, figurIn, syn, px, vag.tak);
    const yAx = _rfYAxlar(figurIn, syn, rum, B, px, lod.inreH, yMarg);
    const L = { ...lod, ...yAx, ...vag, rumX: rum.x, etiketter, fargskala };

    // d3.create('svg') ger ett element i SVG-namnrymden; XMLSerializer skriver xmlns själv vid export.
    const svg = d3.create('svg')
        .attr('role', 'group').attr('aria-label', figurIn.beskrivning)
        .attr('width', B).attr('height', H).attr('viewBox', `0 0 ${B} ${H}`);
    if (val.bakgrund) svg.append('rect').attr('width', B).attr('height', H).attr('fill', val.bakgrund);
    const bild = svg.append('g').attr('data-del', 'rityta').attr('role', 'img').attr('aria-label', 'Diagramyta');
    const rot = bild.append('g').attr('transform', `translate(${L.vanster},${L.topp})`);
    const urval = new Map();   // lager → [ritade, totalt] för nedsamplade punktlager (se _rfPunkt)

    // y-axlarnas markeringar och titlar
    for (const k of L.yEt) _rfText(rot, -8, k.p + px * 0.35, k.text, { px, ankare: 'end', title: k.hel, farg: L.yBand ? undefined : CHART_FONT.dampad, attr: { 'data-axel': 'y' } });
    if (figurIn.y.titel) {
        const t = String(figurIn.y.titel);
        _rfText(rot, 0, 0, _rfKorta(t, L.inreH / (px * _RF.tecken)), { px, ankare: 'middle', title: t, attr: { transform: `translate(${-(L.vanster - px - 2)},${L.inreH / 2}) rotate(-90)` } });
    }
    for (const k of L.y2Et) _rfText(rot, L.inreB + 8, k.p + px * 0.35, k.text, { px, farg: CHART_FONT.dampad, attr: { 'data-axel': 'y2' } });
    if (L.y2 && figurIn.y2.titel) {
        const t = String(figurIn.y2.titel);
        _rfText(rot, 0, 0, _rfKorta(t, L.inreH / (px * _RF.tecken)), { px, ankare: 'middle', title: t, attr: { transform: `translate(${L.inreB + L.y2Block - px + 2},${L.inreH / 2}) rotate(90)` } });
    }
    syn.paneler.forEach((panel, pi) => _rfRitaPanel(rot, figurIn, syn, L, px, panel, pi, urval));
    if (L.xTitel) _rfText(rot, L.inreB / 2, L.inreH + px + 6 + px + 8 + (L.xTvaRader ? px + 2 : 0), _rfKorta(L.xTitel, L.inreB / (px * _RF.tecken)), { px, ankare: 'middle', title: L.xTitel });
    if (fargskala) _rfFargstapel(rot, figurIn.fargskala, fargskala, L.inreB + L.hoger - L.fargB + 8, L.inreH, px, L.fargB - _RF.fargLuft);
    _rfRitaLegend(svg, L, syn, px, H, L.notRader);
    let ritade = 0, totalt = 0;
    for (const [r, t] of urval.values()) { ritade += r; totalt += t; }
    if (totalt) svg.attr('data-nedsamplat', `${ritade}/${totalt}`);
    return svg.node();
}

// ---- Radpaneler: små multiplar för många kategorier ----
// En liggande figur med `paneler: 'auto'` och fler än RF_RADPANEL_MAX kategorier på y ritas som flera delbilder om
// högst så många kategorier, i figurens ordning, staplade under varandra med samma x-axel (samma domän) och en
// rubrik per del ("1–15", "16–30" …). Varje delbild är figuren med punkterna utanför delen utbytta mot null: data-l
// och data-i pekar därför på samma punkt som i hela figuren, och tips, klick och tangentbord fungerar som vanligt.
// Förklaringen står bara under den sista delen, rubriken (export) över den första. Diagramdatan påverkas inte.
const RF_RADPANEL_MAX = 15;
/** Kategorierna i delar om högst RF_RADPANEL_MAX, eller null när figuren inte ska delas. @param {any} figurIn */
function _rfRadpanelDelar(figurIn) {
    if (!figurIn.y || figurIn.y.skala !== 'band' || figurIn.x.skala === 'band' || !figurIn.lager.every(l => l.riktning === 'liggande' || l.marke === 'punkt')) return null;
    const kat = _figSkalDoman({ ...figurIn, lager: figurIn.lager.map(l => ({ ...l, data: l.data.filter(d => d) })) }, 'y');
    if (kat.length <= RF_RADPANEL_MAX) return null;
    const delar = [];
    for (let i = 0; i < kat.length; i += RF_RADPANEL_MAX) delar.push(kat.slice(i, i + RF_RADPANEL_MAX));
    return delar;
}
/** @param {any} figurIn @param {string[][]} delar @param {number} bredd @param {any} val */
function _rfByggRadpaneler(figurIn, delar, bredd, val) {
    const B = isFinite(+bredd) && +bredd > 0 ? +bredd : 600;
    const hel = { ...figurIn, paneler: undefined };
    // Samma x-domän i alla delar: den hela figuren skulle få (ur det som syns).
    const xDoman = figurIn.x.skala === 'band' ? null : _rfSynligt(hel, val).doms.x;
    const totalt = delar.reduce((n, d) => n + d.length, 0);
    const hojd = +(val.hojd || figurIn.hojd) || _RF.hojd;
    // Exporten har fast bildformat (16:9): där står upp till tre delar bredvid varandra i full höjd, i stället för
    // under varandra (då skulle bilden krympas tills inget går att läsa).
    const bredvid = !!val.radpanelBredvid && delar.length <= 3;
    const delB = bredvid ? Math.floor(B / delar.length) : B;
    const perRad = Math.max(24, (hojd - 110) / totalt);
    let start = 0;
    const bilder = delar.map((del, i) => {
        const sista = i === delar.length - 1, set = new Set(del);
        const namn = `${start + 1}–${start + del.length}`;
        start += del.length;
        const delFigur = { ...hel, paneler: [namn], ...(sista ? {} : { legend: false }),
            x: xDoman ? { ...figurIn.x, doman: xDoman } : figurIn.x, y: { ...figurIn.y, ordning: del, _alla: delar.flat() },
            lager: figurIn.lager.map(l => ({ ...l, data: l.data.map(d => (d && set.has(String(d.y)) ? d : null)) })) };
        const h = bredvid ? hojd : Math.round(110 + perRad * del.length + (sista ? 40 : 0));
        return _rfByggSvg(delFigur, delB, { ...val, hojd: h, rubrik: i === 0 ? val.rubrik : (bredvid && val.rubrik ? ' ' : undefined),   // bredvid: samma topp i alla delar
            fot: sista ? val.fot : undefined, not: sista ? val.not : undefined });
    });
    const H = bredvid ? hojd : bilder.reduce((n, s) => n + Number(s.getAttribute('height')), 0);
    const svg = d3.create('svg').attr('role', 'group').attr('aria-label', figurIn.beskrivning)
        .attr('width', B).attr('height', H).attr('viewBox', `0 0 ${B} ${H}`).attr('data-radpaneler', String(delar.length));
    let y = 0, x = 0, ritade = 0, alla = 0;
    for (const s of bilder) {
        const m = /^(\d+)\/(\d+)$/.exec(s.getAttribute('data-nedsamplat') || '');
        if (m) { ritade += +m[1]; alla += +m[2]; }
        s.removeAttribute('role'); s.removeAttribute('aria-label'); s.removeAttribute('data-nedsamplat');
        s.setAttribute('x', String(x)); s.setAttribute('y', String(y)); s.setAttribute('data-del', 'radpanel');
        if (bredvid) x += delB; else y += Number(s.getAttribute('height'));
        svg.node().appendChild(s);
    }
    if (alla) svg.attr('data-nedsamplat', `${ritade}/${alla}`);
    return svg.node();
}

// ====================================================================
// Sidan: ritaFigur, verktygstips, klick, förklaring, storlek, fel (Uppgift 6)
//
// ritaFigur sätter ritarens SVG i en behållare och kopplar det som sidan gör med den. Behållaren bär:
//   el._figur       ORIGINALFIGUREN — också de små punkterna. Läses BARA för uppslag av ett märke som finns i
//                   DOM (data-l/data-i) och för lådornas mått; aldrig för text, antal eller annat som visas.
//   el._figurVal    alternativen (visaSma, hojd, bredd, tomtext, vidKlick, exportMedSma, exportBeskrivning,
//                   exportAnteckning)
//   el._figurDolda  Set med serienamn som dolts via förklaringen (nollställs av en ny figur)
//   el._figurBredd  bredden diagrammet senast ritades för
//   el._rfKoppling  lyssnarna och storleksbevakningen (sätts en gång, överlever omritningar)
//   el._rfRitadFigur  figuren som bilden i DOM ritades ur (samma objekt som el._figur efter en ritning): övergångarna
//                   läser den för att känna igen märken från förra bilden. Tas bort av rensaFigur, som el._figur.
//   el._exportBeskrivning  exportmenyns rad "Urval: …" (11-diagramexport.js läser den)
// rensaFigur tar bort alltihop. Inget av figuren skrivs som attribut i DOM.
//
// Små grupper: ritaren får originalfiguren och visaSma — dolda punkter finns då inte i DOM, så en träff kan
// inte peka på en. _rfTraff vaktar det ändå (en liten punkt utan visaSma är ingen träff, och rapporteras).
// En låda är ett aggregat: hanterarna får { x, nyckel } och lådans mått, aldrig en individs post — och nyckeln
// bara när lådans alla individer delar den. Hanterarna får aldrig lagret självt (dess data bär de små punkterna):
// vidKlick får en fryst beskrivning { serie, marke, panel, axel, index }, och tips anropas utan `this`.
// ====================================================================

/* exported ritaFigur */   // sidans API: vyerna ritar sina diagram med ritaFigur och släpper dem med rensaFigur
/** @type {HTMLElement|null} */
let _rfTipsAgare = null;   // behållaren vars verktygstips visas just nu (portalen är gemensam för sidan)
// Registret över behållare som ritaFigur har ritat i och rensaFigur inte har rensat — också sådana som saknar id
// eller har lämnat dokumentet. Rensningen av sidan (_rfRensaAlla) går igenom det; en väljare kan inte hitta en
// egenskap. _rfSedda minns vilka som har suttit i dokumentet (se _rfStadaBehallare). Läses bara inne i funktioner.
const _rfBehallare = new Set();
const _rfSedda = new WeakSet();
// Behållare som ritaFigur någon gång har ritat i (också efter rensning; bär ingen data och håller ingen kvar i
// minnet). Exportmenyn frågar _rfHarRitat: en meny som står kvar vid en behållare utan figur hör till kärnan.
const _rfRitade = new WeakSet();

function _rfEl(id) {
    const el = typeof id === 'string' ? document.getElementById(id) : id;
    return el && el.nodeType === 1 ? el : null;
}

// Platsen i felrapporten: "<vad> <behållarens id>".
function _rfPlats(vad, el) { return `${vad} ${el.id || ''}`.trim(); }

/**
 * Verktygstipsets rader som HTML: [etikett] blir en rubrikrad, [etikett, värde] en rad med värdet i fetstil.
 * Allt escapas. Annat än rader (null, tomma listor, en rad utan etikett) hoppas över; ett värde som saknas visas som –.
 */
function _rfTipsHtml(rader) {
    const text = v => esc(String(v));
    return (Array.isArray(rader) ? rader : []).filter(r => Array.isArray(r) && r.length && r[0] != null)
        .map(r => (r.length > 1 ? `${text(r[0])}: <strong>${text(r[1] == null ? '–' : r[1])}</strong>` : `<strong>${text(r[0])}</strong>`))
        .join('<br>');
}

/**
 * Kroken som _hideChartTip (02-verktygstips.js) anropar varje gång portalen döljs och töms — av ett diagram
 * här, av Escape, rullning eller ändrad fönsterstorlek, eller av en annan del av sidan: ägaren glöms. Sitter den
 * inte längre i dokumentet (vyn har bytt ut sin behållare utan rensaFigur) rensas den också, så att figuren,
 * lyssnarna, storleksbevakningen och en väntande omritning släpps.
 */
function _rfTipsDolt() {
    const agare = _rfTipsAgare;
    _rfTipsAgare = null;
    if (agare && !agare.isConnected) rensaFigur(agare);
}

/**
 * Nollställer verktygstipset oavsett vem som äger det: portalen döljs och töms, ägaren glöms och en ägare som
 * lämnat dokumentet rensas (allt görs av _hideChartTip och kroken ovan — ett ställe). Anropas när ett diagram
 * döljer sitt eget tips (_rfDoljTips) och av rensningen av sidan (_rfRensaAlla).
 */
function _rfNollstallTips() { _hideChartTip(); }

// En ägare som lämnat dokumentet städas bort (billig koll: vid pekarrörelse, storleksändring och när ett tips döljs).
function _rfStadaAgare() {
    if (_rfTipsAgare && !_rfTipsAgare.isConnected) _rfNollstallTips();
}

// Döljer behållarens eget tips; ett annat diagrams tips rörs inte.
function _rfDoljTips(el) {
    _rfStadaAgare();
    _rfNaraMarkera(el, null);
    if (_rfTipsAgare === el) _rfNollstallTips();
}

/** Har ritaFigur ritat i behållaren (också om den sedan rensats eller hamnat i felläge)? */
function _rfHarRitat(el) { return !!el && _rfRitade.has(el); }

/**
 * Släpper behållare som har suttit i dokumentet men inte gör det längre (vyn har byggt om sin HTML utan
 * rensaFigur): registret håller dem annars kvar i minnet, med figur och lönevärden, tills sidan rensas.
 * En behållare som ritats utanför dokumentet och ännu inte satts in rörs inte. Körs vid varje ritaFigur.
 */
function _rfStadaBehallare(utom) {
    for (const el of [..._rfBehallare]) {
        if (el === utom) continue;
        if (el.isConnected) _rfSedda.add(el);
        else if (_rfSedda.has(el)) rensaFigur(el);
    }
}

/**
 * Rensar VARJE diagram som ritats med ritaFigur — oavsett id, också behållare i tomt läge och sådana som har
 * lämnat dokumentet — och nollställer verktygstipset. Anropas av _rensaAllData (26-rensning.js).
 */
function _rfRensaAlla() {
    for (const el of [..._rfBehallare]) rensaFigur(el);
    _rfBehallare.clear();
    _rfNollstallTips();
}

// Index ur ett attribut: bara heltal utan tecken, annars -1.
function _rfIndex(s) { return typeof s === 'string' && /^\d+$/.test(s) ? Number(s) : -1; }

// Lagrets beskrivning till vidKlick: ett NYTT fryst objekt utan data, tips eller någon väg till lagret.
// `panel` är lagrets plats i figurens paneler (undefined för ett lager utan panel), `index` lagrets plats i figuren.
function _rfLagerBeskrivning(figur, lager, index) {
    const pi = lager.panel != null && Array.isArray(figur.paneler) ? figur.paneler.indexOf(lager.panel) : -1;
    return Object.freeze({ serie: lager.serie, marke: lager.marke, panel: pi >= 0 ? pi : undefined, axel: lager.axel === 'y2' && figur.y2 ? 'y2' : 'y', index });
}

// Det en låda lämnar till hanterarna: { d: { x, nyckel? }, sammanfattning }. Individerna är de som ritaren
// räknade lådan ur (_rfLadIndivider — samma funktion; lådor nedsamplas aldrig). Nyckeln följer bara med när
// lådans ALLA individer har samma, definierade nyckel: en nyckel som hör till en person kan då aldrig komma ut
// ur ett aggregat.
function _rfLadTraff(figur, lager, d, visaSma, m) {
    const kategori = _rfLadKategori(d);
    const individer = _rfLadIndivider(figur, lager, p => !visaSma && !!p.liten).filter(o => _rfLadKategori(o.d) === kategori);
    const s = _figLadstatistik(individer.map(o => o.d.y));
    const punkt = { x: d.x };
    const nyckel = individer.length ? individer[0].d.nyckel : undefined;
    if (nyckel != null && individer.every(o => o.d.nyckel === nyckel)) punkt.nyckel = nyckel;
    // En prick i ett kvantilpunktdiagram: sammanfattningen får prickens kvantil, räknad om ur individerna (inte ur DOM:en).
    const j = m ? _rfIndex(m.getAttribute('data-kvantil')) : -1;
    const kp = j >= 0 && lager.form === 'kvantiler' ? _figKvantilpunkter(individer.map(o => o.d.y), lager.antal || 20) : null;
    const kvantil = kp && j < kp.antal ? { nr: j + 1, antal: kp.antal, varde: kp.varden[j] } : undefined;
    return { d: punkt, sammanfattning: s ? { q1: s.q1, median: s.median, q3: s.q3, lag: s.lag, hog: s.hog, n: individer.length, ...(kvantil ? { kvantil } : {}) } : undefined };
}

/**
 * Träffen bakom ett element i diagrammet: { m, lager, index, d, sammanfattning } eller null (`lager` är
 * originalets lager och stannar i den här filen — hanterarna får det aldrig).
 * Punkten slås upp i el._figur med elementets data-l/data-i. Ett element utan data-i (en linjes bana) är ingen
 * träff. För en låda är `d` ett NYTT objekt { x, nyckel } och `sammanfattning` lådans mått
 * { q1, median, q3, lag, hog, n }; för alla andra märken är `d` datapunkten och sammanfattningen undefined.
 */
function _rfTraff(el, mal) {
    const m = mal && mal.closest ? mal.closest('[data-l]') : null;
    const figur = el._figur;
    if (!m || !figur || !el.contains(m)) return null;
    const index = _rfIndex(m.getAttribute('data-l'));
    const lager = figur.lager[index];
    const d = lager && Array.isArray(lager.data) ? lager.data[_rfIndex(m.getAttribute('data-i'))] : null;
    if (!d) return null;
    const visaSma = !!(el._figurVal && el._figurVal.visaSma);
    if (d.liten && !visaSma) {
        // Kan inte hända: ritaren ritar inga dolda punkter. Vakten finns för att en dold punkt aldrig ska nå en hanterare.
        rapporteraFel(_rfPlats('diagramträff', el), new Error('träff på en dold punkt'));
        return null;
    }
    // I ett lådlager är bara individpunkterna (punkter: 'alla') datapunkter; allt annat är lådan — ett aggregat.
    if (lager.marke === 'lada' && m.getAttribute('data-marke') !== 'individ') {
        return { m, lager, index, ..._rfLadTraff(figur, lager, d, visaSma, m) };
    }
    return { m, lager, index, d, sammanfattning: undefined };
}

// Bredden att rita för: den fasta (val.bredd) om den finns, annars behållarens, annars en reservbredd (en dold
// flik har bredden 0).
function _rfMattBredd(el) {
    const fast = el._figurVal ? +el._figurVal.bredd : NaN;
    return isFinite(fast) && fast > 0 ? fast : (el.clientWidth || 640);
}

// Ersätter behållarens innehåll med en textrad (tomt läge eller fel). Texten sätts som text, aldrig som HTML.
function _rfMeddelande(el, slag, text) {
    const p = document.createElement('p');
    p.setAttribute('data-rf', slag);
    p.setAttribute('role', 'note');
    p.style.cssText = 'color:var(--text-muted); font-size:0.9rem; margin:8px 0;';
    p.textContent = text;
    el.textContent = '';
    el.appendChild(p);
}

// Notisen under diagrammet när ritaren har nedsamplat. Antalen kommer ur ritarens data-nedsamplat, som inte
// räknar dolda punkter — aldrig ur el._figur.
function _rfNotis(el, svg) {
    const m = svg ? /^(\d+)\/(\d+)$/.exec(svg.getAttribute('data-nedsamplat') || '') : null;
    _setScatterSampleNote(el, m ? { shown: Number(m[1]), total: Number(m[2]) } : null);
}

// ---- Övergångar: märkena flyttar sig mellan två ritningar av samma diagram ----
// Ritaren bygger alltid en ny SVG och byter ut den gamla; det ändras inte. Övergången läggs ovanpå: lägena i den
// gamla bilden läses av innan den tas bort, och de märken i den nya som också fanns i den gamla börjar där och
// flyttas till sina platser på 200 ms. När övergången är klar — eller avbryts — bär varje märke exakt de attribut
// ritaren gav det, så bilden är tecken för tecken densamma som utan övergång.
//
// Ett märke känns igen på sin plats i figuren (lager och index) när det är SAMMA figur som ritas igen (zoom, växlad
// serie). För en ny figur känns det igen på märkestyp, serie och punktens `nyckel` — eller kategorin på en
// bandaxel — och bara när den nyckeln är ensam om sitt märke i båda bilderna. Punkter utan något av det (personer
// i ett spridningsdiagram) flyttas aldrig mellan två figurer: de har ingen identitet att följa.
//
// Bara ritade märken har lägen, och ett märke flyttas bara mellan två lägen som båda har ritats: övergången visar
// inget som inte den gamla eller den nya bilden visar. Den är avslagen när webbläsaren inte uttryckligen säger att
// rörelse går bra (prefers-reduced-motion), vid storleksändring och när bilden har fler än 2 000 märken.
const RF_OVERGANG_MS = 200, RF_OVERGANG_MAX = 2000;
const _RF_OVERGANG_ATTR = { circle: ['cx', 'cy', 'r'], rect: ['x', 'y', 'width', 'height'], line: ['x1', 'x2', 'y1', 'y2'] };
function _rfOvergangPa() {
    try { return typeof requestAnimationFrame === 'function' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: no-preference)').matches === true; }
    catch (_e) { return false; }
}
// Märkenas nycklar i den ritade bilden: Map nyckel → element. En nyckel som två märken delar tas bort.
function _rfOvergangMarken(el, figur, samma) {
    const ut = new Map(), dubbla = new Set();
    const bandX = figur.x && figur.x.skala === 'band', bandY = figur.y && figur.y.skala === 'band';
    for (const m of el.querySelectorAll(':scope > svg [data-marke][data-l][data-i]')) {
        if (!_RF_OVERGANG_ATTR[m.tagName]) continue;
        const li = Number(m.getAttribute('data-l')), i = Number(m.getAttribute('data-i')), l = figur.lager[li];
        const d = l && Array.isArray(l.data) ? l.data[i] : null;
        if (!d) continue;
        const marke = m.getAttribute('data-marke');
        let k;
        if (samma) k = `${marke}|${li}|${i}`;
        else {
            const id = d.nyckel != null ? `n:${d.nyckel}` : bandX ? `x:${d.x}` : bandY ? `y:${d.y}` : null;
            if (id == null) continue;
            k = `${marke}|${l.serie != null ? l.serie : '#' + li}|${id}`;
        }
        if (ut.has(k)) dubbla.add(k); else ut.set(k, m);
    }
    for (const k of dubbla) ut.delete(k);
    return ut;
}
// Lägena i bilden som den ser ut just nu (mitt i en pågående övergång: där märkena är).
function _rfOvergangLagen(el, figur, samma) {
    const ut = new Map();
    for (const [k, m] of _rfOvergangMarken(el, figur, samma)) {
        ut.set(k, { tagg: m.tagName, varden: _RF_OVERGANG_ATTR[m.tagName].map(a => Number(m.getAttribute(a))) });
    }
    return ut;
}
// Ställer märkena i den nya bilden på sina gamla lägen och startar flytten. Ger antalet märken som flyttas.
function _rfOvergangStarta(el, fore, figur, samma) {
    const poster = [];
    for (const [k, m] of _rfOvergangMarken(el, figur, samma)) {
        const f = fore.get(k);
        if (!f || f.tagg !== m.tagName) continue;
        _RF_OVERGANG_ATTR[m.tagName].forEach((a, n) => {
            const slut = m.getAttribute(a), till = Number(slut), fran = f.varden[n];
            if (slut == null || !isFinite(till) || !isFinite(fran) || Math.abs(till - fran) < 0.01) return;
            poster.push({ m, a, fran, till, slut });
        });
    }
    if (!poster.length || poster.length > RF_OVERGANG_MAX * 4) return 0;
    /** @type {{poster: any[], start: number|null, klar: boolean}} */
    const o = { poster, start: null, klar: false };
    el._rfOvergang = o;
    _rfOvergangSatt(el, 0);
    const steg = nu => {
        if (o.klar || el._rfOvergang !== o) return;
        const t = typeof nu === 'number' ? nu : Date.now();
        if (o.start == null) o.start = t;
        _rfOvergangSatt(el, (t - o.start) / RF_OVERGANG_MS);
        if (!o.klar) requestAnimationFrame(steg);
    };
    requestAnimationFrame(steg);
    return poster.length;
}
// Ställer en pågående övergång på andelen `andel` (0–1) av vägen; vid 1 får märkena tillbaka ritarens egna attribut.
function _rfOvergangSatt(el, andel) {
    const o = el && el._rfOvergang;
    if (!o || o.klar) return;
    const t = Math.max(0, Math.min(1, andel)), e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    if (t >= 1) {
        for (const p of o.poster) p.m.setAttribute(p.a, p.slut);
        o.klar = true;
        delete el._rfOvergang;
        if (el._rfKoppling) el._rfKoppling.nara = null;   // lägena är nya: närmaste-punkt-sökningen byggs om
        return;
    }
    for (const p of o.poster) p.m.setAttribute(p.a, String(Math.max(p.a === 'r' || p.a === 'width' || p.a === 'height' ? 0 : -Infinity, p.fran + (p.till - p.fran) * e)));
}
/** Avslutar en pågående övergång på en gång: märkena står på sina slutliga lägen. */
function _rfOvergangAvsluta(el) { _rfOvergangSatt(el, 1); }

// Ritar behållarens figur på nytt (ny figur, växlad serie, ny bredd). Kastar om ritaren kastar.
// `overgang: false` (storleksändring) byter bilden utan att märkena flyttar sig.
function _rfRitaOm(el, { overgang = true } = {}) {
    const val = el._figurVal || {}, figur = el._figur;
    // Övergång: den gamla bildens lägen läses av (som de står just nu), sedan avslutas en pågående flytt.
    const forra = el._rfRitadFigur, samma = forra === figur;
    const fore = overgang && forra && _rfOvergangPa() && el.querySelector(':scope > svg') ? _rfOvergangLagen(el, forra, samma) : null;
    _rfOvergangAvsluta(el);
    delete el._rfRitadFigur;
    if (el._rfKoppling) { el._rfKoppling.senast = null; el._rfKoppling.nara = null; el._rfKoppling.naraM = null; }
    _rfDoljTips(el);
    _rfPenselGlom(el);   // en ny bild har andra lägen: det penslade området gäller inte längre
    el._figurBredd = _rfMattBredd(el);
    // Tomt läge: ingen datapunkt återstår när de små är borta. Då visas bara texten — inga axlar, ingen
    // förklaring (den kunde namnge en serie som bara finns i små grupper) och ingen notis.
    if (_figAntalPunkter(val.visaSma ? figur : _figUtanSma(figur)) === 0) {
        _rfMeddelande(el, 'tom', typeof val.tomtext === 'string' && val.tomtext ? val.tomtext : 'Inget att visa');
        _rfNotis(el, null);
        return;
    }
    // Fokus på en post i förklaringen följer med till den nya bilden.
    const aktiv = document.activeElement;
    const fokus = aktiv && el.contains(aktiv) && aktiv.getAttribute ? aktiv.getAttribute('data-serie') : null;
    // Ritaren får ORIGINALET (index och palett följer det) och avgör själv vad som ritas.
    const svg = _rfByggSvg(_rfZoomad(el), Math.max(320, el._figurBredd), { hojd: val.hojd, visaSma: !!val.visaSma, dolda: el._figurDolda });
    el.textContent = '';
    el.appendChild(svg);
    el._rfRitadFigur = figur;
    if (fore && fore.size && fore.size <= RF_OVERGANG_MAX) _rfOvergangStarta(el, fore, figur, samma);
    _rfNotis(el, svg);
    if (fokus != null) _rfFokusera(el, fokus);
    // Länkade vyer (11-markering.js): den markerade gruppen framhävs också i en nyritad bild.
    if (typeof _mkTillampa === 'function') _mkTillampa(el);
    // Tangentbord: ritytan går att nå med Tab när det finns märken att gå mellan; ett tidigare fokusmärke är borta.
    if (el._rfKoppling) el._rfKoppling.fokus = null;
    const yta = _rfRityta(el);
    if (yta && _rfTangentMarken(el).length) {
        yta.setAttribute('tabindex', '0');
        yta.setAttribute('aria-label', 'Diagramyta. Piltangenterna går mellan datapunkterna, Enter väljer.');
    }
}

// Markeringen har ändrats: varje ritat diagram framhäver (eller återställer) sina märken, utan omritning.
function _rfMarkeraAlla() {
    for (const el of _rfBehallare) { try { _mkTillampa(el); } catch (e) { rapporteraFel(_rfPlats('diagrammarkering', el), e); } }
}

function _rfFokusera(el, serie) {
    const post = [...el.querySelectorAll('[data-serie]')].find(g => g.getAttribute('data-serie') === serie);
    if (post && typeof post.focus === 'function') post.focus();
}

// Felet rapporteras, allt kopplas loss och behållaren säger att diagrammet inte kunde ritas.
function _rfVisaFel(el, e) {
    rapporteraFel(_rfPlats('diagram', el), e);
    try {
        rensaFigur(el);
        _rfMeddelande(el, 'fel', 'Diagrammet kunde inte ritas.');
    } catch (_x) { /* behållaren går inte att skriva i; felet är redan rapporterat */ }
}

// Omritning från en händelse (förklaring, storlek): ett fel får inte lämna en halv bild eller nå webbläsaren.
function _rfRitaSakert(el, val) {
    try { _rfRitaOm(el, val); } catch (e) { _rfVisaFel(el, e); }
}

/** Ritar om i behållarens nuvarande bredd, om den har ändrats. En dold behållare (bredd 0) väntar tills den syns. */
function _rfOmStorlek(el) {
    if (!el || !el._figur) return;
    const fast = el._figurVal ? +el._figurVal.bredd : NaN;
    if (!(isFinite(fast) && fast > 0) && !el.clientWidth) return;
    if (_rfMattBredd(el) !== el._figurBredd) _rfRitaSakert(el, { overgang: false });
}

function _rfLegendPost(el, mal) {
    const post = mal && mal.closest ? mal.closest('[data-serie]') : null;
    return post && el.contains(post) ? post : null;
}

// Visar eller döljer en serie (förklaringens post). Posten finns kvar, nedtonad, och behåller fokus.
function _rfVaxla(el, serie) {
    const dolda = el._figurDolda;
    if (!dolda || serie == null) return;
    if (dolda.has(serie)) dolda.delete(serie); else dolda.add(serie);
    _rfRitaSakert(el);
    _rfFokusera(el, serie);
}

// ---- Närmaste punkt ----
// En punkt är några bildpunkter stor. När pekaren är över ritytan men inte på ett märke får den närmaste ritade
// punkten tipset (inom RF_NARA_PX) och klicket (inom RF_NARA_KLICK_PX), och en ring visar vilken det är. Sökningen
// görs med d3.Delaunay över de ritade cirklarnas lägen, byggd en gång per ritning och panel. Bara märken som finns i
// DOM är med: en dold liten punkt kan aldrig bli den närmaste.
const RF_NARA_PX = 24, RF_NARA_KLICK_PX = 12;
const _RF_NARA_MARKEN = 'circle[data-marke="punkt"], circle[data-marke="individ"], circle[data-marke="linjepunkt"]';
/** Det ritade punktmärke i panelen `panel` som ligger närmast (x, y) i panelens koordinater, inom `radie` — eller null. */
function _rfNarmastI(el, panel, x, y, radie) {
    const k = el._rfKoppling, yta = _rfPenselPaneler(el)[panel];
    if (!k || !yta || el._rfOvergang) return null;
    if (!k.nara) k.nara = new Map();
    let s = k.nara.get(panel);
    if (!s) {
        const marken = [...yta.querySelectorAll(_RF_NARA_MARKEN)];
        const lagen = marken.map(m => [Number(m.getAttribute('cx')), Number(m.getAttribute('cy'))]);
        s = { marken, lagen, sok: marken.length ? d3.Delaunay.from(lagen) : null };
        k.nara.set(panel, s);
    }
    if (!s.sok) return null;
    const i = s.sok.find(x, y);
    if (!(i >= 0) || !s.lagen[i]) return null;
    return Math.hypot(s.lagen[i][0] - x, s.lagen[i][1] - y) <= radie ? s.marken[i] : null;
}
function _rfNarmast(el, e, radie) {
    const k = el._rfKoppling;
    if (!k || k.drag || !e.target || !e.target.closest || e.target.closest('[data-del="forklaring"]')) return null;
    const p = _rfPenselLage(el, e);
    return p ? _rfNarmastI(el, p.panel, p.x, p.y, radie) : null;
}
// Ringen kring den närmaste punkten (data-nara; stilmallen ritar den). Högst ett märke per diagram bär den.
function _rfNaraMarkera(el, m) {
    const k = el && el._rfKoppling;
    if (!k || k.naraM === m) return;
    if (k.naraM) k.naraM.removeAttribute('data-nara');
    k.naraM = m || null;
    if (m) m.setAttribute('data-nara', '');
}

function _rfVidRorelse(el, e) {
    _rfStadaAgare();
    const k = el._rfKoppling;
    /** @type {any} */ let t = _rfTraff(el, e.target);
    /** @type {any} */ let nara = null;
    if (!t) { nara = _rfNarmast(el, e, RF_NARA_PX); if (nara) t = _rfTraff(el, nara); }
    const tips = t ? t.lager.tips : null;   // anropas lös från lagret: `this` är inte lagret
    if (!k || typeof tips !== 'function') { _rfDoljTips(el); return; }
    _rfNaraMarkera(el, nara);
    // Tipsets text räknas en gång per märke och ritning; så länge pekaren är kvar på märket flyttas bara rutan.
    if (!k.senast || k.senast.m !== t.m) {
        let html = '';
        try { html = _rfTipsHtml(tips(t.d, t.sammanfattning)); } catch (fel) { rapporteraFel(_rfPlats('diagramtips', el), fel); }
        k.senast = { m: t.m, html };
    }
    if (!k.senast.html) { _rfDoljTips(el); return; }
    _showChartTip(k.senast.html, e.clientX || 0, e.clientY || 0);
    _rfTipsAgare = el;
}

function _rfVidKlick(el, e) {
    // Klicket som följer på att en pensling släpps hör till penslingen, inte till märket under pekaren.
    if (el._rfKoppling && el._rfKoppling.nyssPenslat) { el._rfKoppling.nyssPenslat = false; return; }
    const post = _rfLegendPost(el, e.target);
    if (post) { _rfVaxla(el, post.getAttribute('data-serie')); return; }
    // Ett klick strax intill en punkt gäller punkten — men inte klicket som just tog bort ett penslat område.
    const k = el._rfKoppling, rensat = !!(k && k.nyssRensat);
    if (k) k.nyssRensat = false;
    const nara = rensat ? null : _rfNarmast(el, e, RF_NARA_KLICK_PX);
    const t = _rfTraff(el, e.target) || (nara ? _rfTraff(el, nara) : null);
    if (!t) return;
    // Länkade vyer: ett märke som hör till ett BAS-intervall eller en yrkesgrupp markerar gruppen i alla diagram
    // (den mest specifika nyckeln; ett klick till tar bort markeringen, Ctrl/Cmd/Skift lägger till en grupp).
    // Vyns egen hanterare körs därefter. Tangentbordet gör samma sak med Enter (_rfAktivera).
    _rfAktivera(el, t.m, e);
}

function _rfVidTangent(el, e) {
    const post = _rfLegendPost(el, e.target);
    if (post) {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        e.preventDefault();   // mellanslag ska inte rulla sidan
        _rfVaxla(el, post.getAttribute('data-serie'));
        return;
    }
    _rfTangentIRitytan(el, e);
}

// ====================================================================
// Tangentbord: mellan datapunkterna
//
// Ritytan går att nå med Tab. Piltangenterna flyttar mellan de ritade märkena (i den ordning de ritats: serie för
// serie), Home och End går till första och sista, Enter eller mellanslag gör det ett klick gör, och Escape lämnar
// märket. Märket som har fokus får en ram, verktygstipset visas vid det och dess text läses upp. Bara ritade
// märken finns i ordningen — en dold liten punkt går inte att nå.
// ====================================================================
function _rfRityta(el) { return el.querySelector(':scope > svg [data-del="rityta"]'); }
// Märkena som går att stanna på: ett per datapunkt (en låda är ett märke, hur många delar den än ritas med).
function _rfTangentMarken(el) {
    const sedda = new Set(), ut = [];
    for (const m of el.querySelectorAll(':scope > svg [data-del="rityta"] [data-l][data-i]')) {
        const marke = m.getAttribute('data-marke');
        if (marke === 'linje') continue;   // linjens träffytor (linjepunkt) är märkena, inte kurvan
        const lada = marke !== 'individ' && _rfArLada(el, m);
        const id = lada ? `${m.getAttribute('data-l')}|lada|${_rfLadKategoriFor(el, m)}` : `${m.getAttribute('data-l')}|${m.getAttribute('data-i')}`;
        if (sedda.has(id) || !_rfTraff(el, m)) continue;
        sedda.add(id);
        ut.push(m);
    }
    return ut;
}
function _rfArLada(el, m) { const l = el._figur.lager[_rfIndex(m.getAttribute('data-l'))]; return !!l && l.marke === 'lada'; }
function _rfLadKategoriFor(el, m) {
    const l = el._figur.lager[_rfIndex(m.getAttribute('data-l'))], d = l && l.data[_rfIndex(m.getAttribute('data-i'))];
    return d ? String(d.x) : '';
}
// Raderna i ett verktygstips som löpande text, för uppläsning.
function _rfTipsText(rader) {
    return (Array.isArray(rader) ? rader : []).filter(r => Array.isArray(r) && r.length && r[0] != null)
        .map(r => (r.length > 1 ? `${r[0]}: ${r[1] == null ? '–' : r[1]}` : String(r[0]))).join('. ');
}
function _rfTangentIRitytan(el, e) {
    const yta = _rfRityta(el), k = el._rfKoppling;
    if (!yta || !k || !e.target || !yta.contains(e.target)) return;
    const marken = _rfTangentMarken(el);
    if (!marken.length) return;
    const nu = k.fokus && marken.includes(k.fokus) ? marken.indexOf(k.fokus) : -1;
    /** @type {number|null} */ let till = null;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') till = nu < 0 ? 0 : Math.min(marken.length - 1, nu + 1);
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') till = nu < 0 ? marken.length - 1 : Math.max(0, nu - 1);
    else if (e.key === 'Home') till = 0;
    else if (e.key === 'End') till = marken.length - 1;
    else if ((e.key === 'Enter' || e.key === ' ') && nu >= 0) {
        e.preventDefault();
        _rfAktivera(el, marken[nu], e);
        return;
    } else if (e.key === 'Escape' && nu >= 0) {
        e.stopPropagation();   // Escape lämnar märket; nästa Escape tar bort en markering
        _rfTangentSlapp(el);
        return;
    } else return;
    e.preventDefault();   // piltangenterna ska inte rulla sidan medan man går mellan märkena
    _rfTangentTill(el, marken[till], till, marken.length);
}
function _rfTangentTill(el, m, nr, antal) {
    const k = el._rfKoppling;
    if (k.fokus) k.fokus.removeAttribute('data-fokus');
    k.fokus = m;
    m.setAttribute('data-fokus', '');
    const t = _rfTraff(el, m);
    let rader = [];
    if (t && typeof t.lager.tips === 'function') {
        const tips = t.lager.tips;
        try { rader = tips(t.d, t.sammanfattning); } catch (fel) { rapporteraFel(_rfPlats('diagramtips', el), fel); }
    }
    const html = _rfTipsHtml(rader);
    const r = m.getBoundingClientRect ? m.getBoundingClientRect() : { left: 0, top: 0, width: 0, height: 0 };
    if (html) { _showChartTip(html, r.left + r.width / 2, r.top); _rfTipsAgare = el; } else _rfDoljTips(el);
    const serie = t && t.lager.serie ? `${t.lager.serie}. ` : '';
    if (typeof announceToScreenReader === 'function') announceToScreenReader(`${serie}${_rfTipsText(rader) || 'Datapunkt'} (${nr + 1} av ${antal})`);
}
function _rfTangentSlapp(el) {
    const k = el._rfKoppling;
    if (k && k.fokus) { k.fokus.removeAttribute('data-fokus'); k.fokus = null; }
    _rfDoljTips(el);
}
// Det ett klick på märket gör: markerar gruppen (länkade vyer) och kör vyns hanterare.
function _rfAktivera(el, m, e) {
    const t = _rfTraff(el, m);
    if (!t) return;
    const nycklar = t.d && t.d.markering;
    if (Array.isArray(nycklar) && nycklar.length && typeof sattDiagramMarkering === 'function') {
        try { sattDiagramMarkering(String(nycklar[nycklar.length - 1]), { lagg: !!(e && (e.ctrlKey || e.metaKey || e.shiftKey)) }); } catch (fel) { rapporteraFel(_rfPlats('diagrammarkering', el), fel); }
    }
    const fn = el._figurVal && el._figurVal.vidKlick;
    if (typeof fn !== 'function') return;
    try { fn(t.d, _rfLagerBeskrivning(el._figur, t.lager, t.index)); } catch (fel) { rapporteraFel(_rfPlats('diagramklick', el), fel); }
}

// Storleksbevakningens svar. En behållare som går från dold (bredd 0) till synlig ritas om genast — annars
// syns diagrammet i reservbredden en stund; övriga ändringar väntar 100 ms så att en dragning inte ritar om i ett.
function _rfVidStorlek(el) {
    const k = el._rfKoppling;
    if (!k) return;
    _rfStadaAgare();
    // Städningen kan ha rensat just den här behållaren (den ägde tipset och har lämnat dokumentet): då finns
    // kopplingen inte kvar, och ingen timer får sättas på den.
    if (el._rfKoppling !== k) return;
    clearTimeout(k.vantar);
    const noll = !el.clientWidth;
    if (k.noll && !noll) _rfOmStorlek(el);
    else k.vantar = setTimeout(() => _rfOmStorlek(el), 100);
    k.noll = noll;
}

// Lyssnarna sitter på behållaren (inte på svg:n) och kopplas en gång: de överlever omritningar.
function _rfKoppla(el) {
    if (el._rfKoppling) return;
    /** @type {{lyssnare: Array<[string, any]>, observator: ResizeObserver|null, vantar: any, senast: any, noll: boolean}} */
    const k = { lyssnare: [], observator: null, vantar: null, senast: null, noll: !el.clientWidth };
    const lyssna = (typ, fn) => { el.addEventListener(typ, fn); k.lyssnare.push([typ, fn]); };
    lyssna('pointermove', e => { if (el._rfKoppling && el._rfKoppling.drag) _rfPenselDrag(el, e); else _rfVidRorelse(el, e); });
    // Pekskärm och penna: ett tryck på ett märke visar tipset, och det står kvar när fingret lyfts (webbläsaren skickar
    // då pointerleave). Ett tryck utanför märkena döljer det, liksom rullning (den gemensamma portalen).
    lyssna('pointerdown', e => { if (e.pointerType && e.pointerType !== 'mouse') _rfVidRorelse(el, e); else _rfPenselStart(el, e); });
    lyssna('pointerup', e => _rfPenselSlut(el, e));
    lyssna('pointerleave', e => { if (!e || !e.pointerType || e.pointerType === 'mouse') _rfDoljTips(el); });
    lyssna('click', e => _rfVidKlick(el, e));
    lyssna('keydown', e => _rfVidTangent(el, e));
    lyssna('focusout', e => { const yta = _rfRityta(el); if (yta && e.target === yta) _rfTangentSlapp(el); });
    if (typeof ResizeObserver !== 'undefined') {
        k.observator = new ResizeObserver(() => _rfVidStorlek(el));
        k.observator.observe(el);
    }
    el._rfKoppling = k;
}

/**
 * Enda vägen att rita ett diagram med diagramkärnan (ADR-39). Kastar aldrig: en ogiltig figur eller ett fel
 * under ritningen rapporteras (rapporteraFel) och behållaren säger att diagrammet inte kunde ritas.
 * Små grupper (`liten`) ritas bara med val.visaSma (Utforska, ADR-14).
 * @param {string|HTMLElement|null} id
 * @param {any} figur  enligt src/lib/figur.js
 * @param {{visaSma?:boolean, hojd?:number, bredd?:number, tomtext?:string, vidKlick?:Function,
 *          exportMedSma?:Function, exportBeskrivning?:string, exportAnteckning?:string, rubrik?:string, fot?:string, dolda?:Set<string>}} [val]
 *   vidKlick(d, lagerbeskrivning) och lagrets tips(d, sammanfattning) får datapunkten — för en låda { x, nyckel? }.
 *   lagerbeskrivning = fryst { serie, marke, panel, axel, index }; aldrig lagret självt.
 * @returns {HTMLElement|null}  behållaren, eller null om den inte finns
 */
function ritaFigur(id, figur, val) {
    const el = _rfEl(id);
    if (!el) return null;
    _rfStadaBehallare(el);
    _rfBehallare.add(el);
    if (el.isConnected) _rfSedda.add(el);
    _rfRitade.add(el);
    try {
        _figValidera(figur, el.id || 'diagram');
        el._figur = figur;
        el._figurVal = val && typeof val === 'object' ? val : {};
        el._figurDolda = new Set();
        _rfZoomGlom(el);   // en ny figur har andra värden: ett tidigare utsnitt gäller inte
        el._exportBeskrivning = typeof el._figurVal.exportBeskrivning === 'string' ? el._figurVal.exportBeskrivning : '';
        _rfRitaOm(el);
        _rfKoppla(el);
        _attachChartExport(el);
    } catch (e) {
        _rfVisaFel(el, e);
    }
    return el;
}

/**
 * Tar bort diagrammet och allt ritaFigur kopplade: lyssnare, storleksbevakning, sparad figur, notisen under
 * diagrammet — och tömmer behållaren. Exportmenyn (bredvid behållaren) rörs inte.
 */
function rensaFigur(id) {
    const el = _rfEl(id);
    if (!el) return;
    _rfBehallare.delete(el);
    _rfSedda.delete(el);
    const k = el._rfKoppling;
    if (k) {
        if (k.observator) k.observator.disconnect();
        clearTimeout(k.vantar);
        for (const [typ, fn] of k.lyssnare) el.removeEventListener(typ, fn);
        delete el._rfKoppling;
    }
    _rfDoljTips(el);
    // Exportraden hör till figuren: den tas bara bort om behållaren hade en (en annan del av sidan kan ha lagt en egen).
    if ('_figur' in el) delete el._exportBeskrivning;
    delete el._figur; delete el._figurVal; delete el._figurDolda; delete el._figurBredd;
    _setScatterSampleNote(el, null);
    _rfPenselGlom(el);
    _rfZoomGlom(el);
    _rfOvergangAvsluta(el);
    delete el._rfRitadFigur;
    el.textContent = '';
}

// ====================================================================
// Pensling: dra över punkterna i ett punktdiagram
//
// I ett diagram med punkter på två talaxlar (lön mot ålder, bubblor, prioriteringsmatrisen) kan användaren dra en
// ruta över ett område. Punkterna i rutan framhävs, de andra tonas ned, och en rad under diagrammet säger hur
// många punkter rutan rymmer per serie och deras median. Ett klick i ytan utan att dra, Escape eller en omritning
// tar bort rutan. Penslingen räknar bara på punkter som är ritade — den kan inte säga något som inte redan syns —
// och den följer inte med i någon export.
// ====================================================================
function _rfPenselPaneler(el) { return [...el.querySelectorAll(':scope > svg svg[data-del="panel"]')]; }
function _rfPenselGar(el) {
    const f = el._figur;
    return !!f && f.x.skala !== 'band' && f.y.skala !== 'band' && !!el.querySelector(':scope > svg circle[data-marke="punkt"]');
}
// Pekarens läge i panelens egna koordinater, och vilken panel den är i (null utanför alla).
// Pekarens läge i en panels egna koordinater, och panelens mått: { x, y, b, h }. Räknas med panelens
// skärmmatris (getScreenCTM) — INTE med getBoundingClientRect, som för en nästlad <svg> ger innehållets
// omskrivande ruta och inte panelens ram: läget blev då fel med avståndet från panelens kant till det yttersta
// märket. Utan skärmmatris (jsdom) används rutan.
function _rfPanelLage(panel, e) {
    const b = Number(panel.getAttribute('width')), h = Number(panel.getAttribute('height'));
    const m = typeof panel.getScreenCTM === 'function' ? panel.getScreenCTM() : null;
    if (m && m.a && m.d) return { x: (e.clientX - m.e) / m.a, y: (e.clientY - m.f) / m.d, b, h };
    const r = panel.getBoundingClientRect();
    return r.width ? { x: e.clientX - r.left, y: e.clientY - r.top, b: b || r.width, h: h || r.height } : null;
}
function _rfPenselLage(el, e) {
    const paneler = _rfPenselPaneler(el);
    for (let i = 0; i < paneler.length; i++) {
        const p = _rfPanelLage(paneler[i], e);
        if (p && p.x >= 0 && p.x <= p.b && p.y >= 0 && p.y <= p.h) return { panel: i, x: p.x, y: p.y };
    }
    return null;
}
function _rfPenselStart(el, e) {
    const k = el._rfKoppling;
    if (!k || e.button > 0 || !_rfPenselGar(el)) return;
    if (e.target && e.target.closest && e.target.closest('[data-del="forklaring"]')) return;
    const p = _rfPenselLage(el, e);
    if (!p) return;
    k.drag = { panel: p.panel, x0: p.x, y0: p.y, x1: p.x, y1: p.y };
    // Utan detta markerar draget text i sidan, och nästa drag blir då webbläsarens egen dra-och-släpp av markeringen
    // (pointercancel i Chromium) i stället för en pensling.
    if (e.preventDefault) e.preventDefault();
    try { if (el.setPointerCapture && e.pointerId != null) el.setPointerCapture(e.pointerId); } catch (_e) { /* äldre webbläsare */ }
}
function _rfPenselDrag(el, e) {
    const k = el._rfKoppling, d = k && k.drag;
    if (!d) return;
    const panel = _rfPenselPaneler(el)[d.panel];
    if (!panel) { k.drag = null; return; }
    const p = _rfPanelLage(panel, e);
    if (!p) return;
    d.x1 = Math.max(0, Math.min(p.b, p.x));
    d.y1 = Math.max(0, Math.min(p.h, p.y));
    _rfDoljTips(el);
    _rfPenselRuta(panel, d);
}
function _rfPenselSlut(el, _e) {
    const k = el._rfKoppling, d = k && k.drag;
    if (!d) return;
    k.drag = null;
    const dragen = Math.abs(d.x1 - d.x0) >= 4 && Math.abs(d.y1 - d.y0) >= 4;
    if (dragen) { k.nyssPenslat = true; setTimeout(() => { if (el._rfKoppling) el._rfKoppling.nyssPenslat = false; }, 0); _rfPensla(el, d.panel, d.x0, d.y0, d.x1, d.y1); }
    else if (el._rfPensel) { k.nyssRensat = true; setTimeout(() => { if (el._rfKoppling) el._rfKoppling.nyssRensat = false; }, 0); _rfPenselRensa(el); }   // ett klick i ytan tar bort ett penslat område
}
function _rfPenselRuta(panel, d) {
    let ruta = panel.querySelector(':scope > rect[data-del="pensel"]');
    if (!ruta) {
        ruta = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        ruta.setAttribute('data-del', 'pensel');
        ruta.setAttribute('fill', FARG.accent); ruta.setAttribute('fill-opacity', '0.08');
        ruta.setAttribute('stroke', FARG.accent); ruta.setAttribute('stroke-width', '1'); ruta.setAttribute('stroke-dasharray', '4 3');
        ruta.setAttribute('pointer-events', 'none');
        panel.appendChild(ruta);
    }
    ruta.setAttribute('x', Math.min(d.x0, d.x1)); ruta.setAttribute('y', Math.min(d.y0, d.y1));
    ruta.setAttribute('width', Math.abs(d.x1 - d.x0)); ruta.setAttribute('height', Math.abs(d.y1 - d.y0));
}
/**
 * Penslar området (x0, y0)–(x1, y1), i panelens koordinater, i panelen med nummer `panel`: punkterna i området
 * framhävs, övriga punkter i diagrammet tonas ned, och noten under diagrammet säger vad området rymmer.
 * Returnerar sammanställningen: { antal, serier: [{ serie, antal, median }] }.
 */
function _rfPensla(el, panel, x0, y0, x1, y1) {
    const figur = el && el._figur, p = figur ? _rfPenselPaneler(el)[panel] : null;
    if (!p || !_rfPenselGar(el)) return null;
    const [xa, xb, ya, yb] = [Math.min(x0, x1), Math.max(x0, x1), Math.min(y0, y1), Math.max(y0, y1)];
    _rfPenselRuta(p, { x0: xa, y0: ya, x1: xb, y1: yb });
    const serier = new Map(), xs = [], ys = [];
    let antal = 0;
    for (const m of el.querySelectorAll(':scope > svg circle[data-marke="punkt"]')) {
        const cx = Number(m.getAttribute('cx')), cy = Number(m.getAttribute('cy'));
        const inne = m.closest('svg[data-del="panel"]') === p && cx >= xa && cx <= xb && cy >= ya && cy <= yb;
        if (inne) {
            m.removeAttribute('opacity'); m.setAttribute('data-penslad', '');
            const l = figur.lager[Number(m.getAttribute('data-l'))], d = l && l.data[Number(m.getAttribute('data-i'))];
            if (d) {
                const namn = String(l.serie || 'Punkter');
                if (!serier.has(namn)) serier.set(namn, []);
                serier.get(namn).push(d.y);
                if (typeof d.x === 'number' && isFinite(d.x) && typeof d.y === 'number' && isFinite(d.y)) { xs.push(d.x); ys.push(d.y); }
                antal++;
            }
        } else { m.setAttribute('opacity', '0.22'); m.removeAttribute('data-penslad'); }
    }
    const ut = { antal, serier: [...serier].map(([serie, ys]) => ({ serie, antal: ys.length, median: Stat.median(ys.filter(v => typeof v === 'number' && isFinite(v))) })) };
    // Områdets omfång i axlarnas värden, ur punkterna i området: det är dit en zoom går.
    const omfang = xs.length >= 2 ? { x: [Math.min(...xs), Math.max(...xs)], y: [Math.min(...ys), Math.max(...ys)] } : null;
    el._rfPensel = { panel, ...ut, omfang };
    _rfPenselNot(el, ut);
    return ut;
}
function _rfPenselNot(el, ut) {
    let not = el._rfPenselNotEl;
    if (!ut) { if (not) not.remove(); delete el._rfPenselNotEl; return; }
    if (!not) {
        not = document.createElement('p');
        not.className = 'k-mask-note';
        not.setAttribute('role', 'status');
        not.setAttribute('data-rf', 'pensel');
        el.insertAdjacentElement('afterend', not);
        el._rfPenselNotEl = not;
    }
    const format = el._figur.y.format;
    const delar = ut.serier.map(s => `${s.serie} ${s.antal}${s.antal && typeof s.median === 'number' ? ` (median ${_figTalformat(s.median, format)})` : ''}`);
    not.textContent = ut.antal
        ? `Penslat område: ${ut.antal} ${ut.antal === 1 ? 'punkt' : 'punkter'} — ${delar.join(' · ')}. Klicka i diagrammet eller tryck Escape för att ta bort området.`
        : 'Penslat område: inga punkter. Klicka i diagrammet eller tryck Escape för att ta bort området.';
    if (el._rfPensel && el._rfPensel.omfang) {
        not.appendChild(document.createTextNode(' '));
        not.appendChild(_rfNotKnapp('Zooma hit', () => _rfZooma(el)));
    }
}
function _rfNotKnapp(text, fn) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'btn-table-tool';
    b.textContent = text;
    b.addEventListener('click', fn);
    return b;
}

// ---- Zoom: diagrammet ritas om med det penslade områdets omfång som axlarnas domäner ----
// Domänerna kommer ur punkterna i området (som alla är ritade), med lite luft. Lagren är desamma, så träffar, tips
// och markering fungerar som vanligt; det som hamnar utanför klipps av panelen. En ny figur från vyn tar bort
// utsnittet. Exporten ritar bilden som den visas och säger i fotraden att den är ett utsnitt.
function _rfZoomad(el) {
    const z = el && el._rfZoom, f = el && el._figur;
    return z && f ? { ...f, x: { ...f.x, doman: z.x }, y: { ...f.y, doman: z.y } } : f;
}
function _rfZooma(el) {
    const o = el && el._rfPensel && el._rfPensel.omfang;
    if (!o) return;
    const luft = ([a, b], log) => {
        if (log) return [a / 1.06, b * 1.06];
        const d = (b - a) * 0.04 || Math.abs(a) * 0.05 || 1;
        return [a - d, b + d];
    };
    el._rfZoom = { x: luft(o.x, el._figur.x.skala === 'log'), y: luft(o.y, el._figur.y.skala === 'log') };
    try { _rfRitaOm(el); } catch (e) { delete el._rfZoom; _rfVisaFel(el, e); return; }
    _rfZoomNot(el, true);
}
function _rfZoomAterstall(el) {
    if (!el || !el._rfZoom) return;
    delete el._rfZoom;
    _rfZoomNot(el, false);
    try { _rfRitaOm(el); } catch (e) { _rfVisaFel(el, e); }
}
function _rfZoomNot(el, visa) {
    let not = el._rfZoomNotEl;
    if (!visa) { if (not) not.remove(); delete el._rfZoomNotEl; return; }
    if (!not) {
        not = document.createElement('p');
        not.className = 'k-mask-note';
        not.setAttribute('role', 'status');
        not.setAttribute('data-rf', 'zoom');
        not.textContent = 'Diagrammet visar ett utsnitt. ';
        not.appendChild(_rfNotKnapp('Visa hela diagrammet', () => _rfZoomAterstall(el)));
        el.insertAdjacentElement('afterend', not);
        el._rfZoomNotEl = not;
    }
}
function _rfZoomGlom(el) { delete el._rfZoom; _rfZoomNot(el, false); }
// Glömmer penseln utan att röra bilden (den ska ändå ritas om eller tas bort).
function _rfPenselGlom(el) {
    if (el._rfKoppling) el._rfKoppling.drag = null;
    delete el._rfPensel;
    _rfPenselNot(el, null);
}
// Tar bort det penslade området och återställer punkterna (och en markerad grupp framhävs igen).
function _rfPenselRensa(el) {
    if (!el || !el._rfPensel) return;
    _rfPenselGlom(el);
    for (const m of el.querySelectorAll(':scope > svg [data-penslad], :scope > svg circle[data-marke="punkt"][opacity]')) { m.removeAttribute('opacity'); m.removeAttribute('data-penslad'); }
    const ruta = el.querySelector(':scope > svg rect[data-del="pensel"]');
    if (ruta) ruta.remove();
    if (typeof _mkTillampa === 'function') _mkTillampa(el);
}
function _rfPenselRensaAlla() { for (const el of _rfBehallare) _rfPenselRensa(el); }

// ====================================================================
// Export: SVG och PNG ur en figur
//
// Det som lämnar verktyget får inte bära något spår av en liten grupp som inte ritas: bilden ritas ur
// ORIGINALFIGUREN med visaSma enligt vyn (ritaren ritar då varken märket eller något som räknats ur det), och
// index (data-l/data-i — en lucka i dem skulle visa att en punkt saknas), träffytor och förklaringens
// knappattribut tas bort ur den fristående SVG:n. Vaktas av differentialtestet "export: …" i
// tests/diagramritare.test.js: exporten av en figur är tecken för tecken exporten av samma figur utan små punkter.
// ====================================================================

// Tar bort det som bara hör till sidan ur en SVG som ska stå för sig själv. Bilden ser likadan ut.
function _rfExportStada(svg) {
    svg.removeAttribute('data-nedsamplat');
    for (const el of [...svg.querySelectorAll('*')]) {
        // Osynliga träffytor: linjernas genomskinliga cirklar tas bort; individpunkternas osynliga kant likaså
        // (en läsare som inte kan stroke-opacity skulle annars rita den svart).
        if (el.getAttribute('data-marke') === 'linjepunkt') { el.remove(); continue; }
        if (el.getAttribute('stroke-opacity') === '0') for (const a of ['stroke', 'stroke-opacity', 'stroke-width']) el.removeAttribute(a);
        for (const a of ['data-l', 'data-i', 'pointer-events', 'cursor', 'tabindex']) el.removeAttribute(a);
        if (el.hasAttribute('data-serie')) for (const a of ['role', 'aria-pressed', 'aria-label']) el.removeAttribute(a);
    }
}

// Bildens mått ur det anroparen begärde: annat än ett tal > 0 ger bredd 1600 respektive höjd bredd × 9/16.
// figurTillSvg och figurTillBild (canvasen) räknar med samma regel — ett ställe.
function _rfBildmatt(bredd, hojd) {
    const tal = (v, reserv) => (isFinite(+v) && +v > 0 ? +v : reserv);
    const B = tal(bredd, 1600);
    return [B, tal(hojd, B * 9 / 16)];
}

/**
 * Figuren som fristående SVG-text med vit bakgrund. Ritas på nytt i ett element utanför sidan — möjligt eftersom
 * ritaren aldrig mäter text i DOM. Bilden ritas i en LOGISK storlek (bredd 800, höjd 800 × hojd / bredd) och
 * skalas med viewBox till begärd bredd × höjd, så att text och märken behåller sina proportioner (vid 1600 px
 * ungefär dubbla skärmstorleken). Små grupper ritas inte, om inte val.visaSma. Under standardvärdet för minsta
 * gruppstorlek bär bilden meningen om sänkt tröskel (ADR-38); nedsamplar ritaren står det i bilden (på skärmen
 * står det under diagrammet). Samma figur och val ger samma text. Kastar om figuren är ogiltig.
 * @param {any} figur  ORIGINALFIGUREN enligt src/lib/figur.js — aldrig en förfiltrerad kopia
 * @param {number} bredd  bildens bredd i pixlar (annat än ett tal > 0: 1600)
 * @param {number} hojd   bildens höjd i pixlar (annat än ett tal > 0: bredd × 9/16)
 * @param {{visaSma?:boolean, dolda?:Set<string>, rubrik?:string, fot?:string}} [val]  dolda = serier som dolts via förklaringen
 * @returns {string}
 */
function figurTillSvg(figur, bredd, hojd, val = {}) {
    const [B, H] = _rfBildmatt(bredd, hojd);
    const logB = 800, logH = logB * H / B;
    const o = val && typeof val === 'object' ? val : {};
    _figValidera(figur, 'export');
    const bas = { hojd: logH, radpanelBredvid: true, visaSma: !!o.visaSma, dolda: o.dolda && typeof o.dolda.has === 'function' ? o.dolda : undefined, bakgrund: FARG.vit,
                  ...(typeof o.rubrik === 'string' && o.rubrik ? { rubrik: o.rubrik } : {}), ...(typeof o.fot === 'string' && o.fot ? { fot: o.fot } : {}) };
    const sankt = _kSanktNot();
    let svg = _rfByggSvg(figur, logB, { ...bas, not: sankt });
    // Nedsamplat: antalen står i ritarens data-nedsamplat (som inte räknar dolda punkter). Bilden ritas då en
    // gång till med meningen i noten — två ritningar, samma resultat varje gång.
    const m = /^(\d+)\/(\d+)$/.exec(svg.getAttribute('data-nedsamplat') || '');
    if (m) {
        const urval = `Visar ett urval (${_figTalformat(Number(m[1]), 'antal')} av ${_figTalformat(Number(m[2]), 'antal')} punkter).`;
        svg = _rfByggSvg(figur, logB, { ...bas, not: sankt ? `${urval} ${sankt}` : urval });
    }
    svg.setAttribute('width', String(B));
    svg.setAttribute('height', String(H));
    _rfExportStada(svg);
    return new XMLSerializer().serializeToString(svg);
}

/**
 * Figuren som bild. SVG: data-URL direkt. PNG: SVG:n läses som bild och ritas på en canvas i bredd × höjd.
 * Bilden läses från en data-URL (inte en blob-URL): WebKit har vägrat läsa ut en canvas som fått en SVG från en
 * blob. CSP:n tillåter img-src data:. SVG:n har inga externa resurser och ingen
 * foreignObject — annars blir canvasen spärrad för utläsning. Måtten bestäms en gång, med figurTillSvg:s regel
 * (ogiltiga mått ger reservstorleken), och gäller både SVG:n och canvasen. En canvas som inte går att läsa ut
 * (webbläsaren svarar "data:,", t.ex. för en för stor yta) avvisas — en tom fil laddas aldrig ner.
 * @param {'svg'|'png'} format
 * @returns {Promise<string>} data-URL
 */
function figurTillBild(figur, format, bredd, hojd, val = {}) {
    if (format !== 'svg' && format !== 'png') return Promise.reject(new Error(`Okänt format för diagrambild: ${format}`));
    let url;
    const [B, H] = _rfBildmatt(bredd, hojd);
    try { url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(figurTillSvg(figur, B, H, val)); } catch (e) { return Promise.reject(e); }
    if (format === 'svg') return Promise.resolve(url);
    return new Promise((klar, fel) => {
        const bild = new Image();
        bild.onload = () => {
            try {
                const duk = document.createElement('canvas');
                duk.width = Math.max(1, Math.round(B));
                duk.height = Math.max(1, Math.round(H));
                const yta = /** @type {CanvasRenderingContext2D} */ (duk.getContext('2d'));
                yta.fillStyle = FARG.vit;
                yta.fillRect(0, 0, duk.width, duk.height);
                yta.drawImage(bild, 0, 0, duk.width, duk.height);
                const png = duk.toDataURL('image/png');
                if (typeof png !== 'string' || !png.startsWith('data:image/png')) throw new Error('Diagrambilden kunde inte skapas.');
                klar(png);
            } catch (e) { fel(e); }
        };
        bild.onerror = () => fel(new Error('Diagrambilden kunde inte skapas.'));
        bild.src = url;
    });
}

/**
 * Det som ska LÄMNA verktyget för ett diagram ritat med ritaFigur, eller null när behållaren inte har någon
 * figur (felläge, rensad). Små grupper följer bara med när vyn uttryckligen säger det (val.exportMedSma,
 * Utforskas kryssruta — ADR-14); bara svaret exakt `true` räknas som ja (kastar den, eller svarar den något annat, är det nej). Figuren är ORIGINALET: bilden ritas
 * ur den med visaSma och dolda (samma färger som på skärmen), och diagramdatan filtreras av anroparen —
 * _figTillTabell(visaSma ? figur : _figUtanSma(figur)), alla serier.
 * `tom` är sant när inget återstår att exportera (alla punkter hör till små grupper som inte får följa med).
 * @returns {{figur: any, bild: any, utsnitt: boolean, visaSma: boolean, dolda: Set<string>, tom: boolean} | null}
 */
function _rfExportFigur(gd) {
    if (!gd || !gd._figur) return null;
    const fn = gd._figurVal ? gd._figurVal.exportMedSma : null;
    let visaSma = false;
    if (typeof fn === 'function') {
        try { visaSma = fn() === true; } catch (e) { rapporteraFel(_rfPlats('diagramexport', gd), e); }
    }
    const figur = gd._figur;
    // `bild` är figuren som bilden ritas ur: originalet, eller ett zoomat utsnitt av det (samma lager, andra domäner).
    return { figur, bild: _rfZoomad(gd), utsnitt: !!gd._rfZoom, visaSma, dolda: new Set(gd._figurDolda || []), tom: _figAntalPunkter(visaSma ? figur : _figUtanSma(figur)) === 0 };
}

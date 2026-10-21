// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
// ====================================================================
// 10-diagramlayout.js — Diagramkärnans mått och layout (ADR-39; se docs/utveckling/diagramkarnan.md)
//
// Första filen av tre i ritaren (se 10-diagramritare.js för reglerna som bär alla tre):
//   10-diagramlayout.js  — konstanter, texthjälpare, skalor, märkenas marginaler och stapeletiketternas beslut,
//                          förklaringens poster och layoutstegen (lodrätt, y-axlar, vågrätt, x-markeringar)
//   10-diagrammarken.js  — märkena (_RF_MARKEN), markeringen av små grupper, färgskala och färgstapel, referenser
//   10-diagramritare.js  — vad som ritas (_rfSynligt), panelen, förklaringen och _rfByggSvg
//
// Ingenting här mäter text i DOM: bredd räknas ur teckenantal (_rfBredd).
//
// Filerna sorteras före 10-diagramtema.js. Funktionsdeklarationer syns i hela den sammanfogade app.js, men en
// `const` på toppnivå (_RF, _RF_RANDER, _RF_MARKEN, pilfunktionerna) finns först när dess fil har lästs: de — och
// PALETTE, CHART_FONT och d3 — får bara LÄSAS inne i funktioner, aldrig när filen laddas.
// ====================================================================

const _RF = {
    hojd: 320, tecken: 0.58, maxEtikett: 30,
    // Staplar: största tjocklek (ensam eller staplad, respektive i en grupp bredvid varandra) och hörnens rundning.
    stapelMax: 56, stapelMaxGrupp: 34, stapelHorn: 3,
    legendRad: 20, legendText: 36, legendRader: 4, minYta: 40,
    streck: { hel: null, streckad: '6 4', prickad: '2 3' },
    // Lådor: radie för individpunkter och avvikare, lådans största bredd, och bredden på individpunkternas
    // osynliga kant (träffytan: radie + halva bredden = 6,5 px).
    individ: 2.5, ladaMax: 56, individTraff: 8,
    // Kanten kring vit text på en liten (randig) mörk ruta.
    kantMork: 2,
    // Färgstapeln: minsta reserverade bredd i högermarginalen (varav 8 px luft före och 4 px efter), stapelns
    // bredd, var texterna börjar, största höjd och ungefärlig höjd per färgfält.
    fargB: 64, fargLuft: 12, fargStapel: 12, fargText: 16, fargH: 180, fargSteg: 3,
};

const _rfBredd = (s, px) => String(s == null ? '' : s).length * px * _RF.tecken;
function _rfKorta(s, maxTecken) {
    s = String(s == null ? '' : s);
    const max = Math.max(2, Math.floor(maxTecken));
    return s.length <= max ? s : s.slice(0, max - 1) + '…';
}
const _rfTal = v => typeof v === 'number' && isFinite(v);
// Texten på högst maxRader rader efter uppskattad bredd; sista raden slutar på … om något föll bort.
function _rfRadbryt(text, maxTecken, maxRader) {
    maxTecken = Math.max(4, Math.floor(maxTecken));
    const rader = [];
    let rad = '';
    for (let ord of String(text).split(/\s+/).filter(Boolean)) {
        if (ord.length > maxTecken) ord = ord.slice(0, maxTecken - 1) + '…';
        const ny = rad ? rad + ' ' + ord : ord;
        if (ny.length <= maxTecken) rad = ny;
        else { rader.push(rad); rad = ord; }
    }
    if (rad) rader.push(rad);
    if (rader.length <= maxRader) return rader;
    const ut = rader.slice(0, maxRader);
    const sist = ut[maxRader - 1];
    ut[maxRader - 1] = (sist.length >= maxTecken ? sist.slice(0, maxTecken - 1) : sist) + '…';
    return ut;
}

function _rfSkala(axel, doman, omfang) {
    if (axel.skala === 'band') return d3.scaleBand().domain(doman).range(omfang).paddingInner(0.2).paddingOuter(0.1);
    const log = axel.skala === 'log';
    const d = log && !(doman[0] > 0 && doman[1] > 0) ? [1, 10] : doman;
    const s = (log ? d3.scaleLog() : d3.scaleLinear()).domain(d).range(omfang);
    return (axel.doman || log) ? s : s.nice();
}
// Läge längs en skala: bandets mitt (plus förskjutning i andelar av bandet) eller skalans värde.
function _rfPos(skala, v, forskjutning) {
    if (v == null) return null;
    if (skala.bandwidth) {
        const p = skala(String(v));
        return p == null ? null : p + skala.bandwidth() / 2 + (forskjutning || 0) * skala.bandwidth();
    }
    const p = skala(v);
    return _rfTal(p) ? p : null;
}
// Baslinjen för staplar: nollan om den ligger i domänen, annars domänens kant närmast noll.
function _rfBas(skala) {
    const [a, b] = skala.domain();
    const lag = Math.min(a, b), hog = Math.max(a, b);
    return Math.min(Math.max(0, lag), hog);
}
// Pixelomfång för en värdeaxel av längd `langd`, med plats `rum` ({lo, hi}: vänster/överkant resp.
// höger/nederkant) reserverad för etiketter på staplar som sträcker sig åt det hållet.
function _rfVardeOmfang(langd, rum, lodrat, omvand) {
    const lo = Math.min(rum.lo, langd * 0.3), hi = Math.min(rum.hi, langd * 0.3);
    const o = lodrat ? [langd - hi, lo] : [lo, langd - hi];
    return omvand ? [o[1], o[0]] : o;
}
// Marginal per värdeaxel och sida ({lo, hi}) som MÄRKENA behöver vid axelns ändar, så att de inte klipps mitt itu.
// Känner `punkt`, `linje` och `lada` (och `stapel`, som i stället tar bort marginalen vid sin baslinje): ett nytt
// märke får ingen marginal om det inte läggs till här. Stapeletiketternas rum läggs på efteråt, av
// _rfStapelEtikettRum, när beslutet om etiketterna är taget (_rfEtikettBeslut) — den här funktionen läser
// aldrig `etikett`, så marginalerna (och allt som mäts med dem) är desamma med och utan etiketter.
function _rfEtikettRum(synliga, doms, figur, dold) {
    const rum = { x: { lo: 0, hi: 0 }, y: { lo: 0, hi: 0 }, y2: { lo: 0, hi: 0 } };
    // Staplar står på axellinjen: på den sida av en värdeaxel där domänen slutar i stapelns baslinje får
    // punkternas marginal inte lyfta basen (en punkt exakt på basen kan klippas till hälften — avsiktligt).
    // y och y2 delar beslutet (T1): har någon av dem staplar med basen i domänänden på en sida, får ingen av dem marginal där.
    const basSida = { x: new Set(), y: new Set(), y2: new Set() };
    for (const { l } of synliga) {
        if (l.marke !== 'stapel') continue;
        const nyckel = l.riktning === 'liggande' ? 'x' : (l.axel === 'y2' ? 'y2' : 'y');
        if (!figur[nyckel] || figur[nyckel].skala === 'band' || !doms[nyckel]) continue;
        const [d0, d1] = doms[nyckel];
        const lag = Math.min(d0, d1), hog = Math.max(d0, d1);
        const bas = Math.min(Math.max(0, lag), hog);
        const lodrat = nyckel !== 'x', omv = !!figur[nyckel].omvand;
        const lagSida = lodrat ? (omv ? 'lo' : 'hi') : (omv ? 'hi' : 'lo');       // sidan där minsta värdet ligger
        const hogSida = lagSida === 'lo' ? 'hi' : 'lo';
        if (bas === lag) basSida[nyckel].add(lagSida); else if (bas === hog) basSida[nyckel].add(hogSida);
    }
    for (const sida of [...basSida.y, ...basSida.y2]) { basSida.y.add(sida); basSida.y2.add(sida); }
    // Minst r px marginal på båda sidor av talaxeln `nyckel` — utom på en sida där staplar har sin bas.
    const marginal = (nyckel, r) => {
        if (!figur[nyckel] || figur[nyckel].skala === 'band') return;
        for (const k of ['lo', 'hi']) if (r > rum[nyckel][k] && !basSida[nyckel].has(k)) rum[nyckel][k] = r;
    };
    for (const { l } of synliga) {
        const yNyckel = l.axel === 'y2' ? 'y2' : 'y';
        // Punkter och linjer vid axelns ände ska inte klippas mitt itu: lämna en marginal på talaxlar.
        if (l.marke === 'punkt' || l.marke === 'linje') {
            const r = l.data.reduce((m, d) => Math.max(m, d && !dold(d) && _rfTal(d.storlek) ? d.storlek : 0), l.storlek || 4) + 2;   // bara ritade punkter (S1)
            marginal('x', r);
            marginal(yNyckel, r);
        }
        // Lådor: individpunkter och avvikare är cirklar som sticker ut förbi sitt värde — radien + 2 px längs lådans
        // värdeaxel (lådor är alltid stående). Radien är en konstant: inget läses ur lagrets data.
        // Intervall, band och rutor behöver inget: ett intervall och en låda slutar exakt vid sitt värde, och
        // tjockleken löper tvärs kategoriaxeln, inne i bandet.
        if (l.marke === 'lada') marginal(yNyckel, _RF.individ + 2);
    }
    return rum;
}

// Värdeaxelns nyckel för ett stapellager: x om stapeln ligger, annars y2 (om figuren har en sådan axel) eller y.
const _rfVardeNyckel = (l, figur) => (l.riktning === 'liggande' ? 'x' : (l.axel === 'y2' && figur.y2 ? 'y2' : 'y'));
// Lagren som ritas i en panel (ett lager utan `panel` ritas i varje panel) och vilka av dem som är staplar bredvid varandra.
const _rfIPanel = (syn, panel) => syn.synliga.filter(({ l }) => panel == null || l.panel == null || l.panel === panel);
const _rfBredvid = iPanel => iPanel.filter(({ l }) => l.marke === 'stapel' && (l.lage || 'bredvid') === 'bredvid').map(({ li }) => li);
// Stapelns plats i kategoribandet: tjocklek, förskjutning och `plats` — steget som stapelns etikett får ta
// (bandets steg, eller delplatsens steg när flera lager står bredvid varandra). Delas av beslutet och ritningen.
function _rfStapelPlats(kat, l, li, bredvid) {
    const bw = kat.bandwidth(), lage = l.lage || 'bredvid';
    // En stapel fyller inte hela sitt band: den har en största tjocklek och står mitt i sin plats, så att breda diagram
    // med få kategorier inte blir stora färgblock. Etiketternas plats (`plats`) är oförändrad — den räknas på bandet.
    if (lage === 'bredvid' && bredvid.length > 1) {
        const inre = d3.scaleBand().domain(bredvid).range([0, bw]).padding(0.06);
        const tjock = Math.min(inre.bandwidth(), _RF.stapelMaxGrupp);
        return { tjock, flytt: inre(li) + (inre.bandwidth() - tjock) / 2, plats: inre.step() };
    }
    if (lage === 'overlagrad' && l.bredd) { const tjock = Math.min(bw, _RF.stapelMax) * l.bredd; return { tjock, flytt: (bw - tjock) / 2, plats: kat.step() }; }
    const tjock = Math.min(bw, _RF.stapelMax);
    return { tjock, flytt: (bw - tjock) / 2, plats: kat.step() };
}
// Ligger stapeln fran..till helt i värdeaxelns domän? (En stapel som skärs av domänen får ingen etikett.)
function _rfInomDoman(fran, till, dLag, dHog) {
    const eps = 1e-9 * Math.max(1, Math.abs(dHog - dLag));
    return Math.min(fran, till) >= dLag - eps && Math.max(fran, till) <= dHog + eps;
}
const _rfDomanSorterad = skala => skala.domain().map(Number).sort((a, b) => a - b);

// ETT beslut per stapellager: ritas lagrets etiketter? Svaret är en Map lagerindex → Set med de datapunkter vars
// etikett ritas; ett lager som saknas i den får inga etiketter. Både etikettrummet (_rfStapelEtikettRum) och
// ritningen (_rfStapel) läser detta enda resultat — rum reserveras alltså om och endast om etiketten ritas (U1).
//
// Fristående staplar (bredvid/överlagrad): alla lagrets etiketter eller inga. De ritas om en textrad (liggande)
// eller den bredaste etiketten + 4 px (stående) ryms i stapelns plats — samma plats som ritningen använder
// (_rfStapelPlats), i den trängsta av de paneler där lagret ritas. I mängden ligger bara de punkter som också
// får sin etikett ritad: de som inte döljs, har en kategori på axeln och en stapel helt inom domänen.
// Staplade staplar: etiketten ligger i segmentet och tar inget rum. Den ritas bara om INGET annat stapellager kan
// täcka segmentet, dvs. om varje stapellager i panelen (i alla paneler där lagret ritas) är staplat på samma
// värdeaxel och i samma riktning; annars får inget staplat lager där etiketter. _rfStapel prövar sedan per
// segment om texten ryms.
//
// Beslutet beror på kategoriaxelns längd (inreH för liggande staplar, panelB för stående) och på domänerna —
// inte på etikettrummet: rummet krymper värdeaxelns pixelomfång, aldrig kategoriaxelns, och marginalerna som
// ger panelB mäts utan etikettrum (se _rfByggSvg). Därför behövs ingen andra omgång.
function _rfEtikettBeslut(figurIn, syn, px, inreH, panelB) {
    const ritas = new Map();
    const paneler = syn.paneler.map(p => _rfIPanel(syn, p));
    for (const { l, li } of syn.synliga) {
        if (l.marke !== 'stapel') continue;
        const ligg = l.riktning === 'liggande';
        const katNyckel = ligg ? 'y' : 'x', nyckel = _rfVardeNyckel(l, figurIn);
        if (figurIn[katNyckel].skala !== 'band' || figurIn[nyckel].skala === 'band') continue;   // lagret ritas inte (se _rfStapel)
        const mina = paneler.filter(ip => ip.some(o => o.li === li));
        if (!mina.length) continue;
        const medEtikett = l.data.filter(d => d && !syn.dold(d) && d.etikett != null);
        if (!medEtikett.length) continue;
        if (l.lage === 'staplad') {
            const sammaStapel = o => o.l.lage === 'staplad' && (o.l.riktning === 'liggande') === ligg && _rfVardeNyckel(o.l, figurIn) === nyckel;
            if (mina.every(ip => ip.every(o => o.l.marke !== 'stapel' || sammaStapel(o)))) ritas.set(li, new Set(medEtikett));
            continue;
        }
        const kat = _rfSkala(figurIn[katNyckel], syn.doms[katNyckel], [0, ligg ? inreH : panelB]);
        const vard = _rfSkala(figurIn[nyckel], syn.doms[nyckel], [0, 1]);   // bara domänen läses (den beror inte på pixelomfånget)
        const [dLag, dHog] = _rfDomanSorterad(vard), bas = _rfBas(vard);
        const ritade = medEtikett.filter(d => {
            const v = ligg ? d.x : d.y;
            return kat(String(ligg ? d.y : d.x)) != null && _rfTal(v) && _rfTal(vard(bas)) && _rfTal(vard(v)) && _rfInomDoman(bas, v, dLag, dHog);
        });
        if (!ritade.length) continue;
        const plats = Math.min(...mina.map(ip => _rfStapelPlats(kat, l, li, _rfBredvid(ip)).plats));
        const bredast = ritade.reduce((m, d) => Math.max(m, _rfBredd(d.etikett, px - 1)), 0);
        if (ligg ? px <= plats : bredast + 4 <= plats) ritas.set(li, new Set(ritade));
    }
    return ritas;
}
// Rummet per värdeaxel med stapeletiketternas plats lagd till märkenas marginaler: bredden på etiketten (liggande,
// högst `tak`) eller en textrad (stående), på den sida stapeln sträcker sig mot. Bara för etiketter som ritas
// (_rfEtikettBeslut); staplade etiketter ligger i sina segment och tar inget rum.
function _rfStapelEtikettRum(rumBas, etiketter, figurIn, syn, px, tak) {
    const rum = { x: { ...rumBas.x }, y: { ...rumBas.y }, y2: { ...rumBas.y2 } };
    for (const { l, li } of syn.synliga) {
        const ritade = etiketter.get(li);
        if (!ritade || l.lage === 'staplad') continue;
        const ligg = l.riktning === 'liggande', nyckel = _rfVardeNyckel(l, figurIn);
        const bas = _rfBas(_rfSkala(figurIn[nyckel], syn.doms[nyckel], [0, 1]));
        const omv = nyckel !== 'y2' && !!figurIn[nyckel].omvand;   // y2 ritas aldrig omvänd (se _rfYAxlar)
        for (const d of ritade) {
            const v = ligg ? d.x : d.y;
            // Samma håll som _rfStapel ritar åt: en stapel utan utsträckning (v = bas) får etiketten till höger resp. ovanför.
            const hi = v === bas ? ligg : (ligg ? (v > bas) !== omv : (v > bas) === omv);
            const behov = ligg ? _rfBredd(d.etikett, px - 1) + 6 : px + 6;
            const k = hi ? 'hi' : 'lo';
            if (behov > rum[nyckel][k]) rum[nyckel][k] = behov;
        }
    }
    // Vågräta etiketter kortas till etikettMax tecken; rummet på x är aldrig större än så (taket gäller hela rummet på x).
    rum.x = { lo: Math.min(rum.x.lo, tak), hi: Math.min(rum.x.hi, tak) };
    return rum;
}

const _rfNf = new Map();
function _rfDecimaler(vard) {
    for (let dec = 0; dec < 8; dec++) {
        const f = 10 ** dec;
        if (vard.every(v => Math.abs(v * f - Math.round(v * f)) < 1e-7 * Math.max(1, Math.abs(v * f)))) return dec;
    }
    return 8;
}
// Markeringstext för ett tal: namngivet format om axeln har ett, annars svensk lokal med så många
// decimaler att skilda markeringar ger skilda texter.
function _rfMarkText(axel, v, dec) {
    if (axel.format) return _figTalformat(v, axel.format, { enhet: false });
    if (axel.skala === 'log') dec = _rfDecimaler([v]);   // tiopotenser: "0,01", "1", "100" — inte "100,00"
    if (!_rfNf.has(dec)) _rfNf.set(dec, new Intl.NumberFormat('sv-SE', { minimumFractionDigits: dec, maximumFractionDigits: dec }));
    return _rfNf.get(dec).format(v === 0 ? 0 : v);
}
function _rfMarkSida(axel, v) { return axel.format === 'pctAbs' ? Math.sign(v) : 0; }
// Kandidater för talmarkeringar: [{v, prio}]. Logaritmiska axlar föredrar tiopotenser, sedan 5 och 2.
function _rfTalKandidater(axel, skala, langd, per) {
    const v = skala.ticks(Math.max(2, Math.floor(langd / per)));
    if (axel.skala !== 'log') return v.map(x => ({ v: x, prio: 0 }));
    const ut = [];
    for (const x of v) {
        const m = Math.round(x / 10 ** Math.floor(Math.log10(x) + 1e-9));
        if (m === 1) ut.push({ v: x, prio: 0 }); else if (m === 5) ut.push({ v: x, prio: 1 }); else if (m === 2) ut.push({ v: x, prio: 2 });
    }
    return ut;
}
// Väljer de markeringar som får plats: i prioritetsordning, och bara om utsträckningen längs axeln
// inte överlappar en redan vald (eller har samma text). Talmarkeringar kortas aldrig — de hoppas över.
// På en axel utan tecken (format 'pctAbs', divergerande stapel) står samma text på båda sidor om noll: där räknas
// två markeringar som samma bara om de ligger på samma sida (`sida`).
function _rfValjMarkeringar(kand, storlek, lucka, inom) {
    const ordning = kand.map((k, i) => ({ ...k, i })).sort((a, b) => a.prio - b.prio || a.i - b.i);
    const val = [];
    for (const k of ordning) {
        const s = storlek(k.text);
        if (!inom(k.p, s)) continue;
        if (val.some(q => (q.text === k.text && (q.sida || 0) === (k.sida || 0)) || Math.abs(q.p - k.p) < (s + q.s) / 2 + lucka)) continue;
        val.push({ ...k, s });
    }
    return val.sort((a, b) => a.i - b.i);
}
// Talmarkeringar för en lodrät axel (högst en textrad per markering). Texter bredare än maxB hoppas över.
function _rfLodratMarkningar(axel, skala, langd, px, maxB) {
    const kand = _rfTalKandidater(axel, skala, langd, 40);
    const dec = _rfDecimaler(kand.map(k => k.v));
    const med = kand.map(k => ({ ...k, p: skala(k.v), text: _rfMarkText(axel, k.v, dec), sida: _rfMarkSida(axel, k.v) })).filter(k => _rfTal(k.p) && _rfBredd(k.text, px) <= maxB);
    return { alla: kand.map(k => skala(k.v)).filter(_rfTal), valda: _rfValjMarkeringar(med, () => px + 2, 0, () => true) };
}

/**
 * @param {any} g d3-urval att rita i
 * @param {number} x
 * @param {number} y
 * @param {string} text
 * @param {{px?: number, ankare?: string, farg?: string, fet?: boolean, title?: string, attr?: {[k: string]: any}|null}} [val]
 */
function _rfText(g, x, y, text, { px, ankare = 'start', farg, fet, title, attr } = {}) {
    const t = g.append('text').attr('x', x).attr('y', y).attr('text-anchor', ankare)
        .attr('font-family', CHART_FONT.family).attr('font-size', px || CHART_FONT.size)
        .attr('fill', farg || CHART_FONT.color).text(text);
    if (fet) t.attr('font-weight', 600);
    if (attr) for (const [k, v] of Object.entries(attr)) t.attr(k, v);
    if (title && title !== text) t.append('title').text(title);
    return t;
}

// Förklaringens poster: en per serie. Texten kortas till _RF.legendText tecken (och till bildens bredd),
// raderna är högst maxRader; finns fler poster sist "+ N till" (vanlig text, ingen knapp).
function _rfLegendPoster(serier, px, avail, maxRader) {
    const fler = n => `+ ${n} till`;
    const maxTecken = Math.max(3, Math.min(_RF.legendText, Math.floor((avail - 18) / (px * _RF.tecken))));
    const alla = serier.map(s => {
        const text = _rfKorta(s.serie, maxTecken);
        return { ...s, text, w: 18 + _rfBredd(text, px) + 16 };
    });
    if (!alla.length || maxRader < 1) return { poster: [], fler: null, rader: 0 };
    const placera = lista => {
        let x = 0, rad = 0;
        for (const p of lista) {
            if (x > 0 && x + p.w - 16 > avail) { x = 0; rad++; }
            p.x = x; p.rad = rad; x += p.w;
        }
        return rad + 1;
    };
    let rader = placera(alla);
    if (rader <= maxRader) return { poster: alla, fler: null, rader };
    let kvar = alla.slice();
    for (;;) {
        // Poster som får plats på maxRader rader.
        let x = 0, rad = 0, n = 0;
        for (const p of kvar) {
            let nx = x, nr = rad;
            if (nx > 0 && nx + p.w - 16 > avail) { nx = 0; nr++; }
            if (nr >= maxRader) break;
            x = nx + p.w; rad = nr; n++;
        }
        kvar = kvar.slice(0, n);
        const synliga = kvar.length;
        rader = synliga ? placera(kvar) : 1;
        const sist = synliga ? kvar[synliga - 1] : null;
        const fx = sist ? sist.x + sist.w : 0;
        const ftext = fler(alla.length - synliga);
        if (!synliga || fx + _rfBredd(ftext, px) <= avail) {
            return { poster: kvar, fler: { text: ftext, x: fx, rad: sist ? sist.rad : 0 }, rader: sist ? sist.rad + 1 : 1 };
        }
        kvar = kvar.slice(0, synliga - 1);
        if (!kvar.length) return { poster: [], fler: { text: fler(alla.length), x: 0, rad: 0 }, rader: 1 };
    }
}

// --- _rfByggSvg i steg. Varje steg läser bara det tidigare steg gav; inget värde ändras efteråt. ---
// (Steg 1, _rfSynligt, och själva _rfByggSvg ligger i 10-diagramritare.js.)

// Steg 2: lodräta mått ur teckenantal (aldrig ur DOM): topp, förklaringens rader, notrader och ytans höjd.
function _rfLodratLayout(figurIn, val, B, H, px, syn) {
    const xTitel = figurIn.x.titel ? String(figurIn.x.titel) : '';
    // Långa kategorinamn på en stående axel bryts på två rader. Beslutet tas här, ur de kategorier som ritas och en
    // uppskattad stegbredd (panelernas verkliga bredd är inte känd än): ryms inte det längsta namnet på en rad, och
    // är det fler än ett ord, reserveras en rad till.
    const xDom = figurIn.x.skala === 'band' ? syn.doms.x : [];
    const stegEst = xDom.length ? (B * 0.82 / Math.max(1, syn.paneler.length)) / xDom.length : 0;
    const xTvaRader = xDom.some(v => /\s/.test(String(v).trim()) && _rfBredd(String(v), px) + 4 > stegEst);
    const axelNer = px + 6 + (xTvaRader ? px + 2 : 0) + (xTitel ? px + 8 : 0) + Math.ceil(px * 0.25);   // från ytans nederkant till axeltextens underkant
    const legBas = 10 + Math.max(10, px * 0.8);                              // därifrån till första förklaringsradens baslinje
    const notRader = val.not ? _rfRadbryt(val.not, (B - 16) / ((px - 1) * _RF.tecken), 2) : [];
    const maxT = (B - 16) / ((px - 1) * _RF.tecken);
    const rubrik = val.rubrik ? _rfKorta(String(val.rubrik), (B - 16) / ((px + 2) * _RF.tecken)) : '';
    const fot = val.fot ? _rfKorta(String(val.fot), maxT * (px - 1) / (px - 2)) : '';
    const notH = (notRader.length ? notRader.length * px + 8 : 0) + (fot ? px + 2 : 0);
    const topp = 10 + (rubrik ? px + 14 : 0) + (syn.paneler.some(p => p != null) ? px + 10 : 0);
    const botten = rader => (rader ? axelNer + legBas + (rader - 1) * _RF.legendRad + 4 : axelNer) + 6 + notH;
    let maxRader = 0;
    for (let r = _RF.legendRader; r >= 1; r--) if (H - topp - botten(r) >= _RF.minYta) { maxRader = r; break; }
    const serier = [], sedda = new Set();
    if (figurIn.legend !== false) {
        for (const { l, li } of syn.lagerAlla) {
            if (!l.serie || l.legend === false || sedda.has(String(l.serie))) continue;
            sedda.add(String(l.serie));
            serier.push({ serie: String(l.serie), l, li });
        }
    }
    const legend = _rfLegendPoster(serier, px, B - 16, maxRader);
    const inreH = Math.max(_RF.minYta, H - topp - botten(legend.rader));
    return { xTitel, axelNer, legBas, notRader, topp, legend, inreH, xTvaRader, rubrik, fot };
}

// Steg 3: y-axlarnas skalor och markeringar. Utan `marg` ger steget också marginalernas mått (yB, y2B: bredden
// på den bredaste markeringstexten). Med `marg` (måtten från en tidigare körning utan etikettrum) behålls de
// måtten, och en markering vars text är bredare än sin marginal hoppas över — marginalerna, och därmed
// panelbredden, beror alltså inte på etikettrummet.
function _rfYAxlar(figurIn, syn, rum, B, px, inreH, marg) {
    const yBand = figurIn.y.skala === 'band';
    const yOmfang = yBand ? (figurIn.y.omvand ? [inreH, 0] : [0, inreH]) : _rfVardeOmfang(inreH, rum.y, true, !!figurIn.y.omvand);
    const y = _rfSkala(figurIn.y, syn.doms.y, yOmfang);
    const y2 = figurIn.y2 ? _rfSkala(figurIn.y2, syn.doms.y2, _rfVardeOmfang(inreH, rum.y2, true, false)) : null;
    // Kategorinamn på y-axeln: högst 30 tecken, eller axelns eget `etikettMax` (långa namn som ska gå att läsa) —
    // men aldrig mer än 42 % av bildens bredd.
    const yTak = _rfTal(figurIn.y.etikettMax) && figurIn.y.etikettMax >= 3 ? Math.floor(figurIn.y.etikettMax) : _RF.maxEtikett;
    const yEtikettMax = Math.max(3, Math.min(yTak, Math.floor((B * 0.42) / (px * _RF.tecken))));
    let yEt = [];   // [{p, text, hel}]
    let yRutnat = [];
    if (yBand) {
        const nY = Math.max(1, Math.ceil((px + 2) / Math.max(y.step(), 0.01)));
        yEt = y.domain().map((v, i) => ({ v, i })).filter(o => o.i % nY === 0)
            .map(o => ({ p: _rfPos(y, o.v), text: _rfKorta(o.v, yEtikettMax), hel: String(o.v) })).filter(o => o.p != null);
    } else {
        const m = _rfLodratMarkningar(figurIn.y, y, inreH, px, marg ? marg.yB : B * 0.35);
        yRutnat = m.alla;
        yEt = m.valda.map(k => ({ p: k.p, text: k.text, hel: k.text }));
    }
    // En dold axel (trädkarta: lägena är inga värden) har varken markeringar eller stödlinjer.
    if (figurIn.y.dold) { yEt = []; yRutnat = []; }
    // `_alla` (bara från radpanelerna i 10-diagramritare.js): kategorinamnen i hela figuren, så att varje delbild får
    // samma marginal och x-axlarna står rakt under varandra.
    const yBEgen = yEt.reduce((s, k) => Math.max(s, _rfBredd(k.text, px)), 0);
    const yBAlla = yBand && Array.isArray(figurIn.y._alla) ? figurIn.y._alla.reduce((s, v) => Math.max(s, _rfBredd(_rfKorta(v, yEtikettMax), px)), 0) : 0;
    const yB = marg ? marg.yB : Math.max(yBEgen, yBAlla);
    let y2Et = [], y2B = 0;
    if (y2) {
        y2Et = _rfLodratMarkningar(figurIn.y2, y2, inreH, px, marg ? marg.y2B : B * 0.25).valda;
        y2B = marg ? marg.y2B : y2Et.reduce((s, k) => Math.max(s, _rfBredd(k.text, px)), 0);
    }
    return { yBand, y, y2, yEt, yRutnat, y2Et, y2B, yB };
}

// Pixelomfång för x: band, eller värdeaxel med plats reserverad enligt rumX ({lo, hi}).
const _rfXOmfang = (figurIn, L, rumX) => (figurIn.x.skala === 'band' ? (figurIn.x.omvand ? [L, 0] : [0, L]) : _rfVardeOmfang(L, rumX, false, !!figurIn.x.omvand));

// Steg 4: vågräta mått: marginaler, panelbredd, mellanrum och gränser för etiketter. Halva bredden på yttersta
// talmarkeringen reserveras i sidomarginalerna. Inget här beror på etikettrummet: markeringarnas värden och
// texter följer bara domänen. `tak` är det mesta rum en vågrät stapeletikett får ta (se _rfStapelEtikettRum).
function _rfVagratLayout(figurIn, syn, yAx, B, px, fargskala) {
    const vanster0 = 8 + (figurIn.y.titel ? px + 8 : 0) + yAx.yB + 8;
    let xHalv = 0;
    if (figurIn.x.skala !== 'band') {
        const pre = Math.max(40, (B - vanster0 - 16) / syn.antalP);
        const sPre = _rfSkala(figurIn.x, syn.doms.x, [0, pre]);
        const kand = _rfTalKandidater(figurIn.x, sPre, pre, 80);
        const dec = _rfDecimaler(kand.map(k => k.v));
        xHalv = kand.reduce((s, k) => Math.max(s, _rfBredd(_rfMarkText(figurIn.x, k.v, dec), px) / 2), 0);
    }
    const vanster = Math.max(vanster0, Math.ceil(xHalv) + 4);
    const y2Block = yAx.y2 ? 8 + yAx.y2B + 8 + (figurIn.y2.titel ? px + 8 : 0) : 0;
    // Färgstapeln får den bredd dess titel och ändvärden behöver (ur figurens fargskala, aldrig ur data).
    const fargB = fargskala ? _rfFargstapelMatt(figurIn.fargskala, px, B).bredd : 0;
    const hoger = Math.max(16, y2Block, Math.ceil(xHalv) + 4) + fargB;
    const inreB = Math.max(40, B - vanster - hoger);
    const glapp = syn.antalP > 1 ? Math.max(24, Math.ceil(2 * xHalv) + 8) : 0;
    const panelB = Math.max(20, (inreB - glapp * (syn.antalP - 1)) / syn.antalP);
    // Vågräta stapeletiketter får ta högst 40 % av panelbredden; längre etiketter kortas (hela texten i title).
    const etikettMax = Math.max(3, Math.floor((0.4 * panelB - 6) / ((px - 1) * _RF.tecken)));
    const tak = etikettMax * (px - 1) * _RF.tecken + 6;
    return { vanster, hoger, y2Block, inreB, glapp, panelB, etikettMax, tak, fargB };
}

// x-axelns markeringar i en panel: [{p, text, hel}] och lägen för stödlinjer (bara talaxlar).
// utV/utH: hur långt text får sticka ut åt sidorna (panelens koordinater) utan att nå bildkanten eller grannpanelen.
function _rfXEtiketter(figurIn, x, panelB, utV, utH, px, tvaRader) {
    if (figurIn.x.dold) return { xEt: [], rutnat: [] };
    const xEt = [];
    let rutnat = [];
    if (figurIn.x.skala === 'band') {
        const dom = x.domain();
        const steg = Math.max(x.step(), 0.01);
        const langsta = dom.reduce((s, v) => Math.max(s, Math.min(_RF.maxEtikett, String(v).length)), 1);
        // Varje visad etikett ska rymma minst 8 tecken (eller sin hela längd om den är kortare):
        // visa var n:te, och låt den ta de n platsernas bredd.
        const n = Math.max(1, Math.ceil((Math.min(8, langsta) * px * _RF.tecken + 4) / steg));
        const tecken = Math.min(_RF.maxEtikett, Math.floor((n * steg - 4) / (px * _RF.tecken)));
        dom.forEach((v, i) => {
            if (i % n) return;
            const p = _rfPos(x, v);
            if (p == null) return;
            const hel = String(v);
            const rymmer = Math.min(tecken, Math.floor(2 * Math.min(p + utV, panelB + utH - p) / (px * _RF.tecken)));
            // Ryms inte minst 8 tecken (eller hela namnet) vid kanten hoppas etiketten över.
            if (rymmer < Math.min(8, hel.length)) return;
            if (tvaRader && hel.length > rymmer) {
                const rader = _rfRadbryt(hel, rymmer, 2);
                xEt.push({ p, text: rader[0], rad2: rader[1] || '', hel });
            } else xEt.push({ p, text: hel.length <= rymmer ? hel : _rfKorta(hel, rymmer), hel });
        });
    } else {
        const kand = _rfTalKandidater(figurIn.x, x, panelB, 80);
        const dec = _rfDecimaler(kand.map(k => k.v));
        rutnat = kand.map(k => x(k.v)).filter(_rfTal);
        const med = kand.map(k => ({ ...k, p: x(k.v), text: _rfMarkText(figurIn.x, k.v, dec), sida: _rfMarkSida(figurIn.x, k.v) })).filter(k => _rfTal(k.p));
        for (const k of _rfValjMarkeringar(med, t => _rfBredd(t, px), 6, (p, s) => p - s / 2 >= -utV && p + s / 2 <= panelB + utH)) xEt.push({ p: k.p, text: k.text, hel: k.text });
    }
    return { xEt, rutnat };
}

// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
// ====================================================================
// 71-utforska-figur.js — figurer för Utforska (diagramkärnan, ADR-39 steg 4)
//
// explorerFigure(model, typ, rows) → en figur för ritaFigur (docs/utveckling/diagramkarnan.md).
// Ren: läser bara modellen (src/lib/utforska.js), raderna och PALETTE.
//
// Små grupper (ADR-14): Utforska VISAR grupper under tröskeln, markerade. Figuren innehåller därför alla
// celler, och varje datapunkt som bygger på färre än k personer är märkt `liten`:
//   - cellen som helhet är under tröskeln (c.liten), eller
//   - värdet gäller ett kön som är under tröskeln i cellen (ADR-12), eller
//   - måttet är könsgapet och något av könen är under tröskeln (c.konLiten).
// Vyn ritar med visaSma (kärnan markerar dem med ränder och streckad kant); exporten tar bort dem, om inte
// användaren kryssat i "Ta med grupper under tröskeln". Samma figur för vy och export — de kan inte glida isär.
// Antal (måttet n) per kön är inget lönemått och märks bara när hela cellen är liten.
//
// Varje datapunkt bär `rad` och `kol` (etiketterna): klick-till-dossier (70-utforska.js) läser dem.
// ====================================================================

function _exploreAxisTitle(matt) {
    if (matt === 'gap') return 'Kvinnors median (% av männens)';
    if (matt === 'andelKv') return 'Andel kvinnor (%)';
    if (matt === 'n') return 'Antal';
    if (matt === 'spridning') return 'P90 / P10';
    return 'Kronor/månad';
}
// Axelns talformat (namn i talformat, eller inget för mått som skrivs som de är).
function _exploreFormat(matt) {
    if (matt === 'n') return 'antal';
    if (matt === 'spridning') return 'tal2';
    if (matt === 'gap' || matt === 'andelKv') return undefined;
    return 'kr';
}
const _exploreAxel = (matt, extra) => { const f = _exploreFormat(matt); return { skala: 'linjar', titel: _exploreAxisTitle(matt), ...(f ? { format: f } : {}), ...extra }; };

// Helhet = en vy av cellerna; per kön = två. `liten(c)` säger om vyns värde för cellen bygger på färre än k.
function _explorerKonVyer(model) {
    const { matt, delaKon } = model.spec, k = kTroskel();
    const konLiten = n => matt !== 'n' && n < k;
    return delaKon
        ? [{ namn: 'Kvinnor', kort: 'Kvinna', farg: PALETTE.kon.kvinna, v: c => c.valueKv, n: c => c.nKv, liten: c => !!(c.liten || konLiten(c.nKv)) },
           { namn: 'Män', kort: 'Man', farg: PALETTE.kon.man, v: c => c.valueMa, n: c => c.nMa, liten: c => !!(c.liten || konLiten(c.nMa)) }]
        : [{ namn: null, kort: null, farg: PALETTE.serie[0], v: c => c.value, n: c => c.n, liten: c => !!(c.liten || (matt === 'gap' && c.konLiten)) }];
}
const _exploreHar = v => v != null && isFinite(v);
// Länkade vyer (11-markering.js): en rad som är ett BAS-intervall eller en yrkesgrupp inom BAS kan markeras.
function _exploreMarkering(model, rad) {
    const dim = model.spec.rad;
    if (dim === 'bas') return { markering: markeringFor(rad) };
    if (dim === 'aidbas') { const u = _explorerAidBas(rad); return u ? { markering: markeringFor(u.bas, u.aid) } : {}; }
    return {};
}
const _exploreBeskrivning = (model, form) => `${form}: ${EXPLORE_MATT_LABEL[model.spec.matt] || 'valt mått'} per vald grupp. Samma värden finns i tabellen nedan.`;

function explorerFigure(model, typ, rows) {
    switch (typ) {
        case 'liggande':   return _figStaplar(model, true);
        case 'hantel':     return _figHantel(model);
        case 'bubbla':     return _figBubbla(model);
        case 'lada':       return _figFordelning(model, rows, false);
        case 'punkter':    return _figFordelning(model, rows, 'alla');
        case 'svarm':      return _figFordelning(model, rows, 'svarm');
        case 'regnmoln':   return _figFordelning(model, rows, 'regnmoln');
        case 'kvantilpunkter': return _figFordelning(model, rows, 'kvantiler');
        case 'heatmap':    return _figHeatmap(model);
        case 'grupperade': return _figGrupperade(model);
        case 'staplade':   return _figStaplade(model, /** @type {HTMLInputElement} */ (document.getElementById('explore-stapel-visa'))?.value === 'andel');
        default:           return _figStaplar(model, false);
    }
}

// Könsgapets status: en serie per status med egen symbol — färgen bär den inte ensam (WCAG 1.4.1), och
// förklaringen namnger den. Samma gränser och samma form (punkt, inte stapel) som i Lika arbete: kvoten läses som
// avstånd till 100 %, och en stapels längd från en avkortad axel säger ingenting.
const _EXPLORE_GAPSTATUS = [
    { serie: 'Avviker mer än 5 %', farg: 'kritisk', symbol: 'romb', galler: a => a > 5 },
    { serie: 'Avviker 3–5 %', farg: 'varning', symbol: 'kvadrat', galler: a => a > 3 },
    { serie: 'Inom 3 %', farg: 'ok', symbol: 'cirkel', galler: () => true }
];

function _figStaplar(model, liggande) {
    const { matt, delaKon } = model.spec, celler = model.celler;
    const vyer = _explorerKonVyer(model);
    // Värdet står på stapeln när staplarna är få nog att rymma det (kärnan ritar alla eller inga).
    const medEtikett = celler.length * vyer.length <= 12;
    const punkt = (vy, c) => ({ ...(liggande ? { y: c.rad, x: vy.v(c) } : { x: c.rad, y: vy.v(c) }), rad: c.rad, kol: null, n: vy.n(c), ..._exploreMarkering(model, c.rad),
        ...(medEtikett ? { etikett: _exploreFmt(vy.v(c), matt) } : {}), ...(vy.liten(c) ? { liten: true } : {}) });
    const tips = serie => d => [[d.rad], [serie, _exploreFmt(liggande ? d.x : d.y, matt)], ['Antal', String(d.n)]];
    const riktning = liggande ? { riktning: 'liggande' } : {};
    let lager;
    if (!delaKon && matt === 'gap') {
        const vy = vyer[0], status = c => _EXPLORE_GAPSTATUS.find(s => s.galler(Math.abs(100 - vy.v(c))));
        lager = _EXPLORE_GAPSTATUS.map(s => ({ marke: 'punkt', symbol: s.symbol, storlek: 6, serie: s.serie, farg: PALETTE.semantic[s.farg], ...riktning,
            data: celler.filter(c => _exploreHar(vy.v(c)) && status(c) === s).map(c => punkt(vy, c)), tips: tips(EXPLORE_MATT_LABEL[matt]) }));
    } else {
        lager = vyer.map(vy => {
            const serie = vy.kort || EXPLORE_MATT_LABEL[matt];
            return { marke: 'stapel', serie, farg: vy.farg, ...riktning, data: celler.filter(c => _exploreHar(vy.v(c))).map(c => punkt(vy, c)), tips: tips(serie) };
        });
    }
    lager = lager.filter(l => l.data.length);
    const kategori = { skala: 'band', ordning: celler.map(c => c.rad), ...(liggande ? { etikettMax: 48 } : {}) };
    return { beskrivning: _exploreBeskrivning(model, liggande ? 'Liggande staplar' : 'Staplar'), legend: delaKon || matt === 'gap' ? undefined : false,
        x: liggande ? _exploreAxel(matt) : kategori, y: liggande ? kategori : _exploreAxel(matt),
        hojd: liggande ? Math.max(260, 110 + 24 * celler.length) : 420,
        referens: matt === 'gap' ? [{ ...(liggande ? { x: 100 } : { y: 100 }), streck: 'prickad', farg: PALETTE.semantic.neutral, tjocklek: 1, etikett: 'Lika lön' }] : [],
        lager };
}

function _figHeatmap(model) {
    const { matt, delaKon } = model.spec, celler = model.celler;
    const vyer = _explorerKonVyer(model);
    const kols = model.kolumnEtiketter, rader = model.radEtiketter;
    // Färgskalans ändar skrivs ut i bilden, också i exporten: de räknas därför bara ur värden som får redovisas.
    // Finns inga sådana är exporten tom, och då räknas de ur det som visas.
    const varden = bara => celler.flatMap(c => vyer.filter(vy => !bara || !vy.liten(c)).map(vy => vy.v(c))).filter(_exploreHar);
    const alla = varden(true).length ? varden(true) : varden(false);
    const zmin = alla.length ? Math.min(...alla) : 0, zmax = alla.length ? Math.max(...alla) : 1;
    const diverg = matt === 'gap' || matt === 'andelKv', mitt = matt === 'gap' ? 100 : 50;
    const spann = diverg ? Math.max(Math.abs(zmax - mitt), Math.abs(mitt - zmin), 1) : 0;
    const format = _exploreFormat(matt);
    // Text i cellerna bara när de är få nog att läsas; annars står värdet i verktygstipset.
    const visaText = kols.length * vyer.length <= 12 && rader.length <= 30;
    return { beskrivning: _exploreBeskrivning(model, 'Värmekarta'), legend: false,
        x: { skala: 'band', ordning: kols }, y: { skala: 'band', ordning: rader, etikettMax: 44 },
        hojd: Math.max(260, 120 + 26 * rader.length),
        ...(delaKon ? { paneler: vyer.map(vy => vy.namn) } : {}),
        fargskala: diverg ? { typ: 'divergerande', doman: [mitt - spann, mitt + spann], mitt, titel: _exploreAxisTitle(matt) }
                          : { typ: 'sekventiell', farger: PALETTE.sekventiellNeutral, doman: [zmin, zmax], titel: _exploreAxisTitle(matt), ...(format ? { format } : {}) },
        lager: vyer.map(vy => {
            const serie = vy.namn ? `${EXPLORE_MATT_LABEL[matt]} · ${vy.namn}` : EXPLORE_MATT_LABEL[matt];
            return { marke: 'ruta', serie, visaText, ...(vy.namn ? { panel: vy.namn } : {}),
                data: celler.filter(c => _exploreHar(vy.v(c))).map(c => {
                    const liten = vy.liten(c);
                    return { x: c.kol, y: c.rad, varde: vy.v(c), text: _exploreFmt(vy.v(c), matt) + (liten ? ` (n = ${vy.n(c)})` : ''),
                             rad: c.rad, kol: c.kol, n: vy.n(c), ...(liten ? { liten: true } : {}) };
                }),
                tips: d => [[`${d.rad} · ${d.kol}`], [serie, _exploreFmt(d.varde, matt)], ['Antal', String(d.n)]] };
        }).filter(l => l.data.length) };
}

function _figGrupperade(model) {
    const { matt, delaKon } = model.spec, celler = model.celler;
    const byKey = new Map(celler.map(c => [c.rad + '\u0000' + c.kol, c]));
    const vyer = _explorerKonVyer(model);
    // Många kolumnvärden ger för många smala staplar bredvid varandra. Då ritas små multiplar i stället: en panel
    // per rad, kolumnvärdena på x-axeln och en stapel per kön (eller en för helheten) — samma tal, lättare att läsa.
    const rader = model.radEtiketter.filter(r => model.kolumnEtiketter.some(kl => byKey.has(r + '\u0000' + kl)));
    if (model.kolumnEtiketter.length * vyer.length > 8 && rader.length >= 2 && rader.length <= 8) {
        const lagerM = rader.flatMap(r => vyer.map(vy => {
            const serie = vy.kort || EXPLORE_MATT_LABEL[matt];
            return { marke: 'stapel', serie, farg: vy.farg, panel: r,
                data: model.kolumnEtiketter.map(kl => byKey.get(r + '\u0000' + kl)).filter(c => c && _exploreHar(vy.v(c)))
                    .map(c => ({ x: c.kol, y: vy.v(c), rad: c.rad, kol: c.kol, n: vy.n(c), ...(vy.liten(c) ? { liten: true } : {}) })),
                tips: d => [[`${d.rad} · ${d.kol}`], [serie, _exploreFmt(d.y, matt)], ['Antal', String(d.n)]] };
        })).filter(l => l.data.length);
        return { beskrivning: _exploreBeskrivning(model, 'Staplar i en panel per grupp'), legend: delaKon ? undefined : false,
            paneler: rader.filter(r => lagerM.some(l => l.panel === r)),
            x: { skala: 'band', ordning: model.kolumnEtiketter }, y: _exploreAxel(matt), hojd: 440, lager: lagerM };
    }
    // Per kön: en serie per kolumnvärde och kön. Kvinnor i kolumnens färg, män i samma färg men ljusare;
    // förklaringen visar varje kolumnvärde en gång.
    const lager = model.kolumnEtiketter.flatMap((kl, i) => vyer.map(vy => {
        const serie = vy.kort ? `${kl} · ${vy.kort}` : kl;
        return { marke: 'stapel', serie, farg: PALETTE.serie[i % PALETTE.serie.length],
            ...(vy.kort === 'Man' ? { opacitet: 0.55, legend: false } : {}),
            data: model.radEtiketter.map(r => byKey.get(r + '\u0000' + kl)).filter(c => c && _exploreHar(vy.v(c)))
                .map(c => ({ x: c.rad, y: vy.v(c), rad: c.rad, kol: kl, n: vy.n(c), ...(vy.liten(c) ? { liten: true } : {}) })),
            tips: d => [[`${d.rad} · ${serie}`], [EXPLORE_MATT_LABEL[matt], _exploreFmt(d.y, matt)], ['Antal', String(d.n)]] };
    })).filter(l => l.data.length);
    return { beskrivning: _exploreBeskrivning(model, 'Grupperade staplar') + (delaKon ? ' Mörk stapel = kvinnor, ljus = män.' : ''),
        x: { skala: 'band', ordning: model.radEtiketter, ...(delaKon ? { titel: 'Mörk stapel = kvinnor, ljus = män' } : {}) },
        y: _exploreAxel(matt), hojd: 440, lager };
}

// Staplade staplar: en stapel per rad, ett segment per kolumnvärde, i antal eller som andel av raden (100 %).
// Andelen räknas av radens hela antal — också när ett segment hör till en cell under tröskeln, som är `liten`
// som i övriga Utforska (visas tonad; följer inte med i exporten utan rutan).
function _figStaplade(model, somAndel) {
    const byKey = new Map(model.celler.map(c => [c.rad + '\u0000' + c.kol, c]));
    const summa = new Map();
    for (const c of model.celler) summa.set(c.rad, (summa.get(c.rad) || 0) + (c.n || 0));
    const rader = model.radEtiketter.filter(r => summa.get(r) > 0);
    // Kön som kolumn får verktygets könsfärger; övriga kolumner seriefärgerna.
    const konFarg = model.spec.kolumn === 'kon' ? { Kvinna: PALETTE.kon.kvinna, Man: PALETTE.kon.man, 'Övrig/okänd': PALETTE.semantic.neutral } : {};
    const lager = model.kolumnEtiketter.map((kl, i) => ({
        marke: 'stapel', lage: 'staplad', serie: kl, farg: konFarg[kl] || PALETTE.serie[i % PALETTE.serie.length],
        data: rader.map(r => byKey.get(r + '\u0000' + kl)).filter(c => c && c.n > 0).map(c => {
            const andel = +(100 * c.n / summa.get(c.rad)).toFixed(1);
            return { x: c.rad, y: somAndel ? andel : c.n, rad: c.rad, kol: kl, n: c.n, andel, ...(c.liten ? { liten: true } : {}), ..._exploreMarkering(model, c.rad) };
        }),
        tips: d => [[`${d.rad} · ${kl}`], ['Antal', String(d.n)], ['Andel av raden', _figTalformat(d.andel, 'pct')]]
    })).filter(l => l.data.length);
    return { beskrivning: `Staplade staplar: ${somAndel ? 'andel av varje rad' : 'antal personer'} per kolumnvärde. Samma antal finns i tabellen nedan.`,
        x: { skala: 'band', ordning: rader },
        y: somAndel ? { skala: 'linjar', titel: 'Andel av raden (%)', doman: [0, 100] } : { skala: 'linjar', titel: 'Antal personer', format: 'antal' },
        hojd: 440, lager };
}

function _figHantel(model) {
    const { matt } = model.spec, celler = model.celler;
    const [kv, ma] = _explorerKonVyer({ spec: { ...model.spec, delaKon: true } });
    const punkt = vy => ({ marke: 'punkt', serie: vy.kort, farg: vy.farg, storlek: 6,
        data: celler.filter(c => _exploreHar(vy.v(c))).map(c => ({ y: c.rad, x: vy.v(c), rad: c.rad, kol: null, n: vy.n(c), ..._exploreMarkering(model, c.rad), ...(vy.liten(c) ? { liten: true } : {}) })),
        tips: d => [[d.rad], [vy.kort, _exploreFmt(d.x, matt)], ['Antal', String(d.n)]] });
    // Strecket mellan kvinnors och mäns värde. Det röjer båda värdena, och är därför litet så snart ett av dem är det.
    const streck = { marke: 'intervall', riktning: 'liggande', serie: 'Skillnad kvinnor–män', farg: PALETTE.semantic.neutral, tjocklek: 2, legend: false,
        data: celler.filter(c => _exploreHar(c.valueKv) && _exploreHar(c.valueMa)).map(c => ({
            y: c.rad, lag: Math.min(c.valueKv, c.valueMa), hog: Math.max(c.valueKv, c.valueMa), rad: c.rad, kol: null,
            ...(kv.liten(c) || ma.liten(c) ? { liten: true } : {}) })) };
    // Fler än femton grupper: små multiplar om femton.
    return { beskrivning: _exploreBeskrivning(model, 'Hanteldiagram, kvinnor och män'), paneler: 'auto',
        x: _exploreAxel(matt), y: { skala: 'band', ordning: celler.map(c => c.rad), etikettMax: 48 },
        hojd: Math.max(260, 110 + 24 * celler.length),
        lager: [streck, punkt(kv), punkt(ma)].filter(l => l.data.length) };
}

function _figBubbla(model) {
    const pts = model.celler.filter(c => (c.nKv + c.nMa) > 0 && _exploreHar(c.value));
    const maxN = Math.max(1, ...pts.map(c => c.n));
    const kr = v => _figTalformat(v, 'kr');
    return { beskrivning: 'Bubbeldiagram: varje grupps andel kvinnor mot dess medianlön, med gruppens storlek som bubblans storlek. Samma värden finns i tabellen nedan.',
        legend: false,
        x: { skala: 'linjar', titel: 'Andel kvinnor (%) — bubblans storlek visar antal personer', doman: [0, 100] }, y: { skala: 'linjar', titel: 'Median, kronor/månad', format: 'kr' },
        hojd: 460,
        // 40 % och 60 %: gränserna för könsdominans som § 3:10-analysen använder.
        referens: [40, 60].map(x => ({ x, streck: 'prickad', farg: PALETTE.semantic.neutral, tjocklek: 1, etikett: `${x} %` })),
        lager: [{ marke: 'punkt', serie: 'Grupper', farg: PALETTE.serie[0], opacitet: 0.8, kant: FARG.vit,
            data: pts.map(c => ({ x: (c.nKv / (c.nKv + c.nMa)) * 100, y: c.value, storlek: Math.max(4, 22 * Math.sqrt(c.n / maxN)),
                                  rad: c.rad, kol: null, n: c.n, ..._exploreMarkering(model, c.rad), ...(c.liten ? { liten: true } : {}) })),
            tips: d => [[d.rad], ['Andel kvinnor', _figTalformat(d.x, 'pct')], ['Median', kr(d.y)], ['Antal', String(d.n)]] }] };
}

// Lådagram (allaPunkter = false), individpunkter ('alla') eller punktsvärm ('svarm'), en serie per kön eller en för alla.
// En individ är `liten` när gruppen är under tröskeln eller — per kön — när individens kön är det i gruppen:
// en låda över en handfull personer röjer deras löner (docs/utveckling/diagramkarnan.md, vyns skyldigheter).
function _figFordelning(model, rows, allaPunkter) {
    const { rad, urval, delaKon } = model.spec, k = kTroskel();
    const person = _urPersonFilter(urval);
    const gruppLiten = new Map(model.celler.map(c => [c.rad, !!c.liten]));
    const farg = { Alla: PALETTE.serie[0], Kvinna: PALETTE.kon.kvinna, Man: PALETTE.kon.man, 'Övrig/okänd': PALETTE.semantic.neutral };
    const hinkar = new Map();   // kön → [{ g, lon }]
    const antal = new Map();    // `${g}|${kön}` → antal
    for (const r of rows) {
        if (!(r.lon > 0) || !person(r)) continue;
        const g = _utGroupKey(r, rad);
        if (g == null || !gruppLiten.has(g)) continue;
        const kon = delaKon ? _utKonOf(r) : 'Alla';
        if (!hinkar.has(kon)) hinkar.set(kon, []);
        hinkar.get(kon).push({ g, lon: r.lon });
        antal.set(`${g}|${kon}`, (antal.get(`${g}|${kon}`) || 0) + 1);
    }
    const ordning = ['Alla', 'Kvinna', 'Man', 'Övrig/okänd'];
    const lager = [...hinkar].sort((a, b) => ordning.indexOf(a[0]) - ordning.indexOf(b[0])).map(([kon, personer]) => ({
        marke: 'lada', serie: kon, farg: farg[kon], ...(allaPunkter === 'regnmoln' ? { form: 'regnmoln' } : allaPunkter === 'kvantiler' ? { form: 'kvantiler', antal: 20 } : allaPunkter ? { punkter: allaPunkter } : {}),
        // nyckel = gruppens etikett (aldrig en person): ett klick på en låda öppnar gruppens dossier.
        data: personer.map(p => ({ x: p.g, y: p.lon, nyckel: p.g, ...(gruppLiten.get(p.g) || antal.get(`${p.g}|${kon}`) < k ? { liten: true } : {}) })),
        tips: (d, s) => (s ? [[d.x], ..._kvantilTipsRader(s), [kon === 'Alla' ? 'Median' : `${kon}, median`, _figTalformat(s.median, 'kr')],
                               ['Kvartiler', `${_figTalformat(s.q1, 'kr', { enhet: false })}–${_figTalformat(s.q3, 'kr')}`], ['Antal', String(s.n)]]
                            : [[d.x], [kon === 'Alla' ? 'Lön' : kon, _figTalformat(d.y, 'kr')]])
    }));
    return { beskrivning: allaPunkter === 'kvantiler' ? 'Kvantilpunkter: per vald grupp tjugo prickar, var och en en tjugondel av gruppen (i små grupper en större andel, aldrig färre än två personer), lagda vid den lönen. Inga enskilda löner visas. Samma grupper finns i tabellen nedan.'
        : allaPunkter === 'regnmoln' ? 'Regnmoln: per vald grupp en täthetskurva över lönerna, median och kvartiler som streck, och varje persons lön som en punkt bredvid. Samma grupper finns i tabellen nedan.'
        : allaPunkter === 'svarm' ? 'Punktsvärm: varje persons lön som en punkt, lagda intill varandra så att fördelningens form syns, per vald grupp. Samma grupper finns i tabellen nedan.'
        : allaPunkter ? 'Varje persons lön som en punkt, per vald grupp. Samma grupper finns i tabellen nedan.'
                                      : 'Lådagram över lönerna per vald grupp: median, kvartiler och spridning. Samma grupper finns i tabellen nedan.',
        legend: delaKon ? undefined : false,
        x: { skala: 'band', ordning: model.radEtiketter.filter(l => gruppLiten.has(l)) }, y: { skala: 'linjar', titel: 'Kronor/månad', format: 'kr' },
        hojd: 440, lager };
}

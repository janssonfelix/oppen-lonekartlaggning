// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
import { kronorTipsRad, talformat } from '../lib/figur.js';
import { arKvinna, arMan } from '../lib/kon.js';
import { personOrd } from '../lib/namn.js';
import { omfang } from '../lib/struktur.js';
import { svPct, svTal } from '../lib/talformat.js';
import { adjektiv, ordForAntal, stor } from '../lib/termer.js';
import { alderBandRader, alderGapRader, ALDERSKLASSER, konHistogram, ladaPerKon, lonefordelningPerBas, multiplarPaneler, MULTIPLAR_MAX, MULTIPLAR_PUNKTER, vymodellAlderOchLon, vymodellAldersstruktur } from '../lib/vymodell-alder-karriar.js';
import { FARG } from './01-farger.js';
import { esc } from './01-html-och-tillganglighet.js';
import { _kronorFalt, _kvantilTipsRader } from './03-hjalpfunktioner.js';
import { _konUtelamnatNot, _sattDiagramKNot, individLitenFor, kInstalld, kTroskel, litetUnderlag } from './06-k-troskel.js';
import { jmfNamn, diagramNamn } from './07-standardinstallningar.js';
import { T } from './09-termer.js';
import { rensaFigur, ritaFigur } from './10-diagramritare.js';
import { gapStatusKI, PALETT, UNDERLAG, URVAL } from './10-diagramtema.js';
import { markeringFor } from './11-markering.js';
import { farger, hamtaBasIntervall, hamtaData, linjarRegressionKI, policyFor, Stat, state } from './12-tillstand.js';
import { tomFlikarUtom } from './23-exportgrind.js';
import { _ritaTungtBlock } from './31-navigering.js';
import { _laNyckel, _SKEVHET_STATUS } from './41-lika-arbete.js';
import { harAlder } from './50-regressionsmodeller.js';

// ---- Löneutveckling (Kön) ----
// Kohortförbehållet: lön mot ålder och livscykelkurvorna bygger på ett tvärsnitt av lönerna i dag. De visar
// skillnader mellan åldersgrupper nu, inte hur en persons lön utvecklas — åldersgrupperna skiljer sig också i
// utbildning, yrkesval och anställningstid (kohorteffekter). Står under kurvorna, i Om verktyget och i metodbilagan.
export const KOHORT_FORBEHALL = 'Kurvorna bygger på ett tvärsnitt av lönerna i dag: de visar skillnader mellan åldersgrupper just nu, inte hur en persons lön utvecklas över karriären. Åldersgrupperna skiljer sig också i utbildning, yrkesval och anställningstid (kohorteffekter), så en skillnad mellan 30- och 60-åringar är inte en förväntad löneutveckling.';
/** Utan ålder i lönefilen (ADR-64) ritas fliken inte, och det en tidigare fil ritade i den töms. */
function _akTomUtanAlder() {
    const andra = new Set([...document.querySelectorAll('.nav-item[data-tab]')].map(b => b.getAttribute('data-tab') || '').filter(t => t && t !== 'kon'));
    if (typeof tomFlikarUtom === 'function') tomFlikarUtom(andra);
}
/**
 * Lönedelen av fliken (ADR-99): vymodellAlderOchLon i src/lib/vymodell-alder-karriar.js räknar, maskerar och väljer;
 * här ritas nyckeltalen, noterna och diagrammen ur den.
 */
export function ritaAlderOchLon(bas) {
    if (!harAlder()) { _akTomUtanAlder(); return; }
    const k = kTroskel();
    // Trendlinjen för hela urvalet är ett valbart lager, ett lönemått som bara visas när urvalet når tröskeln
    // (beslut av produktägaren 2026-10-16).
    const trendAlla = !!(/** @type {HTMLInputElement|null} */ (document.getElementById('kon-trend-alla'))?.checked);
    const vm = vymodellAlderOchLon(hamtaData(), { bas, k, statistik: state.statistik, termer: T, trendAlla });
    if (!vm) return;
    const { isAll, df, dataKv, dataMa, kvOk, maOk, konOk, kvot, trendKv, trendMa } = vm;
    const unadjGap = kvot != null ? svPct(kvot, 1) : "–";
    const ageAdjGap = vm.vidSammaAlder != null ? svPct(vm.vidSammaAlder, 1) : "–";
    // Urvalsraden och avsnittens nyckeltal (ADR-41).
    const urvalText = document.getElementById('ak-urval-text');
    if (urvalText) urvalText.textContent = `${svTal(df.length, 0)} personer · minsta gruppstorlek ${kInstalld()}`;
    _laNyckel('nyckel-ak-fordelning', kvot != null ? `Kvinnors median ${unadjGap} av mäns` : '');
    _laNyckel('nyckel-ak-alla', `${hamtaBasIntervall().length} ${ordForAntal(hamtaBasIntervall().length, T.niva)}`);
    /** @type {HTMLElement} */ (document.getElementById("kon-kpi-n")).textContent = svTal(df.length, 0);
    { const u = document.getElementById("kon-kpi-n-under"); if (u) u.textContent = `${svTal(dataKv.length, 0)} kvinnor · ${svTal(dataMa.length, 0)} män`; }
    /** @type {HTMLElement} */ (document.getElementById("kon-kpi-gap")).textContent = unadjGap;
    const ageGapEl = /** @type {HTMLElement} */ (document.getElementById("kon-kpi-agegap"));
    ageGapEl.textContent = ageAdjGap;
    // Talet är justerat för ålder och prövas inte här: ingen status och ingen direktivmarkering (ADR-59). Statusen
    // sätts i Lika arbete, där skillnaden prövas mot slumpen.
    { const u = document.getElementById("kon-kpi-agegap-under");
      if (u) { u.textContent = "kvinnors lön i % av mäns"; u.classList.remove("ar-granska"); } }
    const lutning = reg => (reg ? `${reg.m >= 0 ? '+' : '−'}${svTal(Math.abs(reg.m), 0)}` : '–');
    /** @type {HTMLElement} */ (document.getElementById("kon-kpi-slope")).textContent = `${lutning(trendKv)} / ${lutning(trendMa)} kr`;
    const insightEl = document.getElementById("p-value-insight");
    if (insightEl) {
        const scope = isAll ? "Hela urvalet" : `BAS ${bas}`;
        insightEl.innerHTML = vm.insikt
            ? `<strong>${esc(scope)}:</strong> ${vm.insikt}`
            : `<strong>${esc(scope)}:</strong> ${esc(vm.enAlder ? 'Lönens samband med åldern kan inte räknas eftersom ett av könen bara har en ålder i urvalet.' : _konUtelamnatNot())}`;
    }
    { const not = document.getElementById('kon-kohort-not'); if (not) not.textContent = KOHORT_FORBEHALL; }
    const colorBy = /** @type {HTMLInputElement} */ (document.getElementById('kon-color-by'))?.value || 'kon';
    const scope2 = isAll ? 'hela urvalet' : `${T.niva.en} ${bas}`;
    // Noter under diagrammen om det som utelämnats, och samma sak i diagrammens beskrivningar.
    const { utan } = vm;
    const skal = `färre än ${k} ${personOrd(k)} av ${kvOk || maOk ? 'könet' : 'vartdera könet'} finns i urvalet`;
    ritaFigur('chart-kon-scatter', _konPunktmolnFigur({
        df, dataKv, dataMa, isAll, colorBy, minAlder: vm.minAlder, maxAlder: vm.maxAlder, statMedian: vm.statMedian, liten: vm.liten, trendAlla: vm.trendAlla,
        trendKv, trendMa, ciKv: vm.ciKv, ciMa: vm.ciMa, pol: isAll ? null : policyFor(null, bas),
        beskrivning: `Spridningsdiagram lön mot ålder för ${scope2}. ${dataKv.length} kvinnor och ${dataMa.length} män. ` +
            (konOk && trendKv && trendMa ? `Kvinnors trend ökar med ${Math.round(trendKv.m)} kr per år, mäns med ${Math.round(trendMa.m)} kr per år. `
                   : `${trendKv ? `Kvinnors trend ökar med ${Math.round(trendKv.m)} kr per år. ` : ''}${trendMa ? `Mäns trend ökar med ${Math.round(trendMa.m)} kr per år. ` : ''}${utan ? `Trendlinje visas inte för ${utan}: ${skal}. ` : ''}`) +
            `Ojusterad löneskillnad: ${unadjGap}. Vid samma ålder: ${ageAdjGap}.` +
            (vm.trendAlla ? ` Trend för hela urvalet: ${vm.trendAlla.m >= 0 ? '+' : '−'}${svTal(Math.abs(vm.trendAlla.m), 0)} kr per år.` : '') }), { hojd: 420 });
    // En låda är könets kvartiler: den ritas bara för ett kön som når tröskeln. Lådorna kan räknas för en sektor eller
    // en åldersgrupp (figur.underlag), med samma regel och samma k som vyn (ladaPerKon): resten är de övriga i fliken
    // urval, det valda BAS-intervallet eller hela urvalet.
    const boxEl = document.getElementById('chart-kon-boxplot');
    const lada = _konLadFigurFor(vm.lada, scope2, k);
    if (typeof lada !== 'string') {
        ritaFigur(boxEl, { ...lada, underlag: { dimensioner: [UNDERLAG.sektor, UNDERLAG.aldersgrupp], rader: [...dataKv, ...dataMa], k,
            rita: (rader, { beskrivning }) => _konLadFigurFor(ladaPerKon(rader, k), `${scope2}, ${beskrivning}`, k) } }, { hojd: 420 });
    } else if (boxEl) rensaFigur(boxEl);
    _sattDiagramKNot('chart-kon-scatter', [utan ? `Trendlinje och konfidensband visas inte för ${utan}: ${skal}.` : '',
        trendAlla && !vm.trendAllaOk ? _demoTrendNot(df.length) : '', _individNot(vm.dolda)].filter(Boolean).join(' '));
    _sattDiagramKNot('chart-kon-boxplot', utan ? `Lådan visas inte för ${utan}: ${skal}.` : '');
    ritaKonMultiplar();
    ritaKonHistogram(vm, scope2);
    // Löneskillnaden per åldersgrupp (bootstrapintervall per grupp) ritas efter flikens övre del vid ett flikbyte (ADR-80).
    _ritaTungtBlock('kon', ['chart-kon-aldergap', 'kon-aldergap-not'], () => ritaAlderGap(dataKv, dataMa, scope2));
}

// ---- Lönefördelningen per BAS-intervall (lådmärket: lådor, täthetskurvor eller kvantilpunkter) ----
// En figur per BAS-intervall — eller per kön i varje intervall — över alla i urvalet. Ritas som lådor i Lönestruktur
// (*Lönespridning per BAS-intervall och kön*); täthetskurvorna i Ålder & karriär är borttagna (översynen 2026-10-29),
// formerna finns kvar för andra anropare. En figur är ett aggregat som lådan: en individ är `liten` när intervallet,
// eller könet i intervallet, är under tröskeln, och ritas då inte.
// Vilka som är små, vilka som saknas och ordningen är lonefordelningPerBas i src/lib/vymodell-alder-karriar.js.
export function _konTathetFigur(rader, perKon, k = kTroskel(), form = 'fiol') {
    const { punkter, utelamnade, ordning } = lonefordelningPerBas(rader, perKon, k);
    const serier = perKon ? [['Kvinna', PALETT.kon.kvinna], ['Man', PALETT.kon.man]] : [['Alla', PALETT.serie[0]]];
    const lager = serier.map(([namn, farg]) => ({
        marke: 'lada', ...(form === 'fiol' ? { form: 'fiol' } : form === 'kvantiler' ? { form: 'kvantiler', antal: 20 } : { avvikare: false }), serie: namn, farg,
        data: punkter.filter(p => !perKon || p.kon === namn).map(({ rad: r, liten }) => ({ x: 'BAS ' + r.bas, y: r.lon, bas: r.bas, markering: markeringFor(r.bas), ...(liten ? { liten: true } : {}) })),
        tips: (d, s) => (s ? [[d.x], ..._kvantilTipsRader(s), [perKon ? `${namn}, median` : 'Median', talformat(s.median, 'kr')],
                               ['Kvartiler', `${talformat(s.q1, 'kr', { enhet: false })}–${talformat(s.q3, 'kr')}`], ['Antal', String(s.n)]] : [[d.x]])
    })).filter(l => l.data.length);
    if (form === 'kvantiler') return { utelamnade, figur: { beskrivning: `Lönefördelningen per ${T.niva.en}${perKon ? ' och kön' : ''} som kvantilpunkter: varje prick är en tjugondel av gruppen (i små grupper en större andel, aldrig färre än två personer), lagd vid den lönen. Räkna prickarna under en lön för att se hur stor andel som tjänar mindre. Inga enskilda löner visas.`,
        legend: perKon ? undefined : false, urval: URVAL.bas, x: { skala: 'band', ordning }, y: { skala: 'linjar', titel: 'Månadslön', format: 'kr' }, hojd: 420, lager } };
    if (form !== 'fiol') return { utelamnade, figur: { beskrivning: `Lönespridningen per ${T.niva.en} och kön som lådagram: lådan är mittersta hälften av lönerna (första till tredje kvartilen), strecket i lådan medianen. Enstaka löner utanför morrhåren visas inte. Överlappar kvinnors och mäns lådor i ett intervall ligger könen på samma nivå där. ${stor(T.niva.fl)} där ett kön har färre än ${k} ${personOrd(k)} visas inte för det könet.`,
        urval: URVAL.bas, x: { skala: 'band', ordning }, y: { skala: 'linjar', titel: 'Månadslön', format: 'kr' }, hojd: 380, lager } };
    return { utelamnade, figur: { beskrivning: `Lönefördelningen per ${T.niva.en}${perKon ? ' och kön' : ''} som täthetskurvor: kurvan är bredast där flest löner ligger. Strecken är median och kvartiler. Kurvan slutar vid morrhårens ändar; enstaka löner långt utanför visas inte.`,
        legend: perKon ? undefined : false, urval: URVAL.bas, x: { skala: 'band', ordning }, y: { skala: 'linjar', titel: 'Månadslön', format: 'kr' }, hojd: 420, lager } };
}

const _konTkr = v => talformat(v / 1000, Number.isInteger(v / 1000) ? 'antal' : undefined);

function _konHistogramFigur(klasser, nKv, nMa, scope) {
    const namn = c => (c.oppenNed ? `under ${_konTkr(c.till)}` : c.oppenUpp ? `${_konTkr(c.fran)} eller mer` : `${_konTkr(c.fran)}–${_konTkr(c.till)}`);
    // De två fördelningarna ligger på samma plats, halvgenomskinliga: formen på vardera syns, och där de täcker
    // varandra blandas färgerna (i parvisa staplar går formen inte att se). En stapel som gäller färre än
    // litetUnderlag() personer är märkt `fa` och förklaras i noten och tipset — inget mönster, som inte går att läsa
    // i två lager.
    const serie = (s, farg, falt, tot) => ({ marke: 'stapel', lage: 'overlagrad', serie: s, farg, opacitet: 0.55,
        data: klasser.map(c => ({ x: namn(c), y: +(100 * c[falt] / tot).toFixed(1), n: c.nKv + c.nMa, ...(c[falt] > 0 && c[falt] < litetUnderlag() ? { fa: true } : {}) })),
        tips: d => [[`${d.x} tkr`], [s, talformat(d.y, 'pct')], ['Personer i klassen', String(d.n)], ...(d.fa ? [['Litet underlag', `färre än ${litetUnderlag()} ${s.toLowerCase()}`]] : [])] });
    return { beskrivning: `Lönefördelningen för kvinnor och män i ${scope}: andel av respektive kön per löneklass. Varje klass rymmer minst ${kTroskel()} ${personOrd(kTroskel())}; klasserna i ändarna är hopslagna.`,
        x: { skala: 'band', titel: 'Månadslön (tusen kronor)', ordning: klasser.map(namn) }, y: { skala: 'linjar', titel: 'Andel av könet (%)' }, hojd: 340,
        lager: [serie('Kvinnor', PALETT.kon.kvinna, 'nKv', nKv), serie('Män', PALETT.kon.man, 'nMa', nMa)] };
}
// ---- Lönegap per åldersgrupp ----
// Kvinnors medianlön i procent av mäns i varje åldersgrupp, med samma bootstrap-intervall som BAS-översikten i Lönestruktur
// (_laBootstrapGapKI). Visar VAR i karriären skillnaden finns — inte varför: det är den råa skillnaden mellan alla
// kvinnor och män i åldersgruppen, oavsett yrke och BAS-intervall. En åldersgrupp där ett kön har färre än tröskeln visas inte.
// Kvoten, intervallet och prövningen mot k är alderGapRader i src/lib/vymodell-alder-karriar.js.
function _konAlderGapFigur(rader, scope) {
    const status = o => gapStatusKI(o);   // uppmärksamhetstrappan (ADR-59): KI:t mot 100 % och golvet statGolv()
    const pkt = o => ({ y: o.namn, x: +o.gap.toFixed(1), etikett: talformat(o.gap, 'pct'), o, aldersgrupp: o.namn, nMin: Math.min(o.nKv, o.nMa),
        ...(o.ci ? { fel: { lag: o.ci.lo, hog: o.ci.hi } } : {}), ..._kronorFalt(o.medKv, o.medMa) });
    const kr = v => talformat(v, 'kr');
    const tips = d => [[d.y], ['Kvinnors median', `${talformat(d.x, 'pct')} av männens`], ...kronorTipsRad(d.skillnadKr),
        ['95 % KI', d.fel ? `${talformat(d.fel.lag, 'pct', { enhet: false })}–${talformat(d.fel.hog, 'pct')}` : '–'],
        ['Median kvinnor / män', `${kr(d.o.medKv)} / ${kr(d.o.medMa)}`], ['Antal kvinnor / män', `${d.o.nKv} / ${d.o.nMa}`]];
    const alla = rader.flatMap(o => [o.gap, ...(o.ci ? [o.ci.lo, o.ci.hi] : [])]);
    return { beskrivning: `Kvinnors medianlön i procent av mäns per åldersgrupp i ${scope}, som en punkt med 95 % konfidensintervall mot linjen för lika lön (100 %). Skillnaden är rå: alla kvinnor mot alla män i åldersgruppen, oavsett ${T.enhet.en} och ${T.niva.en}.`,
        // Filtren döljer åldersgrupper (efter namnet, eller antalet av det minst företrädda könet; båda står i tipset).
        urval: [URVAL.aldersgrupp, URVAL.minstaKon],
        y: { skala: 'band', ordning: rader.map(o => o.namn) },
        x: { skala: 'linjar', titel: 'Kvinnors median i % av mäns — 100 = lika lön', doman: [Math.floor(Math.min(90, ...alla) - 2), Math.ceil(Math.max(105, ...alla) + 2)] },
        hojd: Math.max(180, 110 + rader.length * 34),
        referens: [{ typ: 'zon', x0: 97, x1: 103, farg: PALETT.semantic.ok, opacitet: 0.08, etikett: '±3 %' }, { x: 100, farg: PALETT.semantic.mork, tjocklek: 1.5 }],
        lager: _SKEVHET_STATUS.map(s => ({ marke: 'punkt', riktning: 'liggande', symbol: s.symbol, storlek: 6, serie: s.serie, farg: PALETT.semantic[s.farg],
            data: rader.filter(o => status(o) === s).map(pkt), tips })).filter(l => l.data.length) };
}
function ritaAlderGap(dataKv, dataMa, scope) {
    const el = document.getElementById('chart-kon-aldergap');
    if (!el) return;
    const k = kTroskel(), { visade, dolda } = alderGapRader(dataKv, dataMa, k), not = document.getElementById('kon-aldergap-not');
    if (not) { not.hidden = !dolda.length; not.textContent = dolda.length ? `Visas inte, ett kön har färre än ${k} ${personOrd(k)}: ${dolda.join(', ')}.` : ''; }
    if (!visade.length) {
        rensaFigur(el);
        el.innerHTML = `<p class="text-dampad-sm marg-8-0">Ingen åldersgrupp har minst ${k} kvinnor och ${k} män.</p>`;
        return;
    }
    // Kan räknas för en sektor eller en yrkesgrupp (figur.underlag): samma beräkning och samma tröskel per åldersgrupp.
    // Resten är de övriga kvinnorna och männen i fliken urval.
    const rita = (rader, { beskrivning }) => {
        const r = alderGapRader(rader.filter(d => arKvinna(d)), rader.filter(d => arMan(d)), k);
        return r.visade.length ? _konAlderGapFigur(r.visade, `${scope}, ${beskrivning}`) : `Ingen åldersgrupp har minst ${k} kvinnor och ${k} män i urvalet.`;
    };
    ritaFigur(el, { ..._konAlderGapFigur(visade, scope), underlag: { dimensioner: [UNDERLAG.sektor, UNDERLAG.yrkesgrupp], rader: [...dataKv, ...dataMa], k, rita } });
}

// Klasserna, och om ett kön är under k, är konHistogram i src/lib/vymodell-alder-karriar.js, för vyn och för ett underlag.
function ritaKonHistogram(vm, scope) {
    const el = document.getElementById('chart-kon-histogram');
    if (!el) return;
    const k = kTroskel(), h = vm.histogram;
    if (!h.klasser) {
        rensaFigur(el);
        el.innerHTML = `<p class="text-dampad-sm marg-8-0">${h.orsak === 'kon' ? esc(_konUtelamnatNot()) : `Lönerna går inte att dela in i klasser med minst ${k} ${personOrd(k)} i varje.`}</p>`;
        const n0 = document.getElementById('kon-histogram-not'); if (n0) { n0.hidden = true; n0.textContent = ''; }
        return;
    }
    const figur = _konHistogramFigur(h.klasser, h.nKv, h.nMa, scope);
    // Kan räknas för en sektor eller en åldersgrupp (figur.underlag): samma klassindelning och samma tröskel per klass.
    const rita = (rader, { beskrivning }) => {
        const u = konHistogram(rader, k);
        if (u.klasser) return _konHistogramFigur(u.klasser, u.nKv, u.nMa, `${scope}, ${beskrivning}`);
        return u.orsak === 'kon' ? _konUtelamnatNot() : `Lönerna i urvalet går inte att dela in i klasser med minst ${k} ${personOrd(k)} i varje.`;
    };
    ritaFigur(el, { ...figur, underlag: { dimensioner: [UNDERLAG.sektor, UNDERLAG.aldersgrupp], rader: [...vm.dataKv, ...vm.dataMa], k, rita } });
    const not = document.getElementById('kon-histogram-not');
    const fa = figur.lager.some(l => l.data.some(d => d.fa));
    if (not) { not.hidden = !fa; not.textContent = fa ? `Några staplar gäller färre än ${litetUnderlag()} personer av könet i klassen (se verktygstipset på stapeln). Det är ett litet underlag — läs dem som enstaka personer, inte som ett mönster.` : ''; }
}

// ---- Små multiplar: lön mot ålder, en panel per BAS-intervall ----
// Samma punkter och samma regel som i punktdiagrammet överst: en person ritas bara när gruppen och könet i gruppen
// når tröskeln (individLitenFor). Trendlinjen i en panel räknas ur alla i intervallet och ritas bara när
// intervallet når tröskeln. Högst MULTIPLAR_MAX paneler, de största intervallen, i BAS-ordning. Filtren (BAS,
// yrkesgrupp, ålder, lön) döljer punkter; trendlinjen i en panel gäller fortfarande alla i intervallet och döljs bara
// med sitt BAS-intervall (den räknas inte om: en omräkning per panel skulle ge en mening per panel i noten).
// Punkterna bär `alder` och `lon` (samma tal som tipset), så att ålders- och lönefiltren inte döljer trendlinjen.
// Panelerna, punkterna per panel (högst MULTIPLAR_PUNKTER, var n:te i filens ordning) och trendlinjen ur alla i
// intervallet är multiplarPaneler i src/lib/vymodell-alder-karriar.js.
function _konMultiplarFigur(rader, liten, k = kTroskel()) {
    const { paneler, utanfor } = multiplarPaneler(rader, liten, k);
    const lager = [];
    for (const { bas: b, punkter, trend } of paneler) {
        const panel = 'BAS ' + b;
        for (const [namn, farg] of [['Kvinna', PALETT.kon.kvinna], ['Man', PALETT.kon.man]]) {
            const data = punkter.filter(p => p.kon === namn).map(({ rad: r, liten: l }) => ({ x: r.alder, y: r.lon, yrke: r.yrke, bas: r.bas, alder: r.alder, lon: r.lon, kon: namn, ...(l ? { liten: true } : {}), markering: markeringFor(r.bas, r.yrke) }));
            if (data.length) lager.push({ marke: 'punkt', serie: namn, farg, storlek: 2.5, opacitet: 0.6, panel, data, tips: _punktTips });
        }
        if (trend) { const { reg, a0, a1 } = trend;
            lager.push({ marke: 'linje', serie: 'Trend (alla i intervallet)', farg: PALETT.semantic.mork, tjocklek: 1.5, panel, data: [{ x: a0, y: reg.m * a0 + reg.b, bas: b }, { x: a1, y: reg.m * a1 + reg.b, bas: b }] }); }
    }
    return { utanfor, nedsamplade: paneler.filter(p => p.nedsamplad).map(p => 'BAS ' + p.bas), figur: { beskrivning: `Lön mot ålder i ${paneler.length} ${ordForAntal(paneler.length, T.niva)}, ett litet diagram per intervall med gemensamma axlar. Trendlinjen i varje panel räknas ur alla i intervallet.`,
        individer: true, urval: [URVAL.bas, URVAL.yrkesgrupp, URVAL.alder, URVAL.lon], paneler: paneler.map(p => 'BAS ' + p.bas), x: { skala: 'linjar', titel: 'Ålder' }, y: { skala: 'linjar', titel: 'Månadslön', format: 'kr' }, hojd: 340, lager } };
}
function ritaKonMultiplar() {
    const el = document.getElementById('chart-kon-multiplar');
    if (!el) return;
    const d = hamtaData();
    const { figur, utanfor, nedsamplade } = _konMultiplarFigur(d, individLitenFor(d));
    if (figur.paneler.length) ritaFigur(el, figur); else rensaFigur(el);
    const not = document.getElementById('kon-multiplar-not');
    const delar = [utanfor.length ? `Visas inte här (${kTroskel() > 1 ? `färre än ${kTroskel()} ${personOrd(kTroskel())}, eller ` : ''}fler intervall än ${MULTIPLAR_MAX}): ${utanfor.join(', ')}.` : '',
                   nedsamplade.length ? `I ${nedsamplade.join(', ')} visas ett urval av punkterna (högst ${MULTIPLAR_PUNKTER} per intervall); trendlinjen räknas ur alla.` : ''].filter(Boolean);
    if (not) { not.hidden = !delar.length; not.textContent = delar.join(' '); }
}

// ---- Figurer för diagramkärnan (ADR-39, steg 2) ----
// Noten under ett spridningsdiagram om de punkter som inte visas.
// `medTrend` är falskt när diagrammet saknar trendlinje (urvalet under tröskeln): då sägs inget om den.
const _individNot = (n, medTrend = true) => (n ? `${n} ${n === 1 ? 'person visas' : 'personer visas'} inte som punkt: gruppen (${T.enhet.en} inom BAS), eller personens kön i gruppen, har färre än ${kTroskel()} ${personOrd(kTroskel())}.${medTrend ? ' Trendlinjen bygger på alla.' : ''}` : '');
const _punktTips = d => [[d.yrke], ...(d.bas != null ? [['BAS', String(d.bas)]] : []), ...(d.kon ? [['Kön', d.kon]] : []),
                         ['Ålder', `${d.x} år`], ['Lön', talformat(d.y, 'kr')]];
// En vågrät linje över hela åldersspannet (referensens P10, median, P90; jämförelsestatistikens median).
const _vagratLinje = (serie, farg, y, a0, a1, val = {}) => ({ marke: 'linje', serie, farg, data: [{ x: a0, y }, { x: a1, y }], ...val });

// Spridningsdiagrammet lön mot ålder. En persons punkt är `liten` — ritas och exporteras inte — när personens grupp
// eller kön i gruppen är under tröskeln (individLitenFor); trendlinje och konfidensband bygger på alla och finns
// bara för ett kön som når tröskeln — anroparen lämnar annars null. Zoom: pensla ett område och välj "Zooma hit".
// Filtren: BAS-intervall (när hela urvalet visas), yrkesgrupp, ålder och lön. Punkterna bär `alder` och `lon` (samma tal
// som tipset) i stället för att filtren läser x och y: trendlinjerna och statistikens median har också x och y men ska
// inte döljas av dem. Med ett aktivt filter räknas trendlinjerna, konfidensbanden och hela urvalets trend om ur de
// synliga punkterna (harleddAv, samma funktioner som här) och ritas inte när källan har färre än k synliga punkter.
/** @param {{[k: string]: any, liten?: (rad: any) => boolean}} val */
function _konPunktmolnFigur({ df, dataKv, dataMa, isAll, colorBy, minAlder, maxAlder, statMedian, trendKv, trendMa, trendAlla = null, ciKv, ciMa, pol, beskrivning, liten = () => false }) {
    const punkt = (d, medKon) => ({ x: d.alder, y: d.lon, yrke: d.yrke, alder: d.alder, lon: d.lon, ...(isAll || medKon ? { bas: d.bas } : {}),
                                    ...(medKon ? { kon: arKvinna(d) ? 'Kvinna' : 'Man' } : {}), ...(liten(d) ? { liten: true } : {}),
                                    markering: markeringFor(d.bas, d.yrke) });
    const punktlager = (serie, farg, rader, medKon) => ({ marke: 'punkt', serie, farg, storlek: 4, opacitet: 0.7, data: rader.map(d => punkt(d, medKon)), tips: _punktTips });
    const lager = [];
    // Härledningen per kön: i läget kön är källan könets lager, annars alla punktlager och punktens `kon`.
    const kallor = () => lager.filter(l => l.marke === 'punkt').map(l => String(l.serie));
    const perKon = kon => (colorBy === 'kon' ? { lager: [kon] } : { lager: kallor(), villkor: d => d.kon === kon });
    const konNamn = kon => `trendlinjen och konfidensbandet för ${kon === 'Kvinna' ? 'kvinnor' : 'män'}`;
    /** @type {Array<[any, string]>} */ const harledda = [];
    const band = (serie, farg, ci, kon) => {
        if (!ci) return;
        const l = { marke: 'band', serie, farg, opacitet: 0.15, legend: false, data: ci.map(p => ({ x: p.x, lag: p.lo, hog: p.hi })) };
        lager.push(l); harledda.push([l, kon]);
    };
    band('Kvinna 95 % KI', PALETT.kon.kvinna, ciKv, 'Kvinna');
    band('Man 95 % KI', PALETT.kon.man, ciMa, 'Man');
    if (colorBy === 'kon') {
        lager.push(punktlager('Kvinna', PALETT.kon.kvinna, dataKv, false), punktlager('Man', PALETT.kon.man, dataMa, false));
    } else {
        // Färglägg efter BAS eller yrkesgrupp (AID): vid 'aid' de åtta största, övriga som "Övrigt".
        const nyckel = d => (colorBy === 'bas' ? d.bas : d.yrke);
        const antal = {};
        df.forEach(d => { antal[nyckel(d)] = (antal[nyckel(d)] || 0) + 1; });
        const sorterade = Object.keys(antal).sort((a, b) => antal[b] - antal[a]);
        const topp = colorBy === 'aid' ? new Set(sorterade.slice(0, 8)) : new Set(sorterade);
        const grupper = new Map();
        df.forEach(d => { const k = topp.has(String(nyckel(d))) ? String(nyckel(d)) : 'Övrigt'; if (!grupper.has(k)) grupper.set(k, []); grupper.get(k).push(d); });
        [...grupper].forEach(([namn, rader], i) => lager.push(
            punktlager(colorBy === 'bas' ? `BAS-${namn}` : namn, PALETT.serie[i % PALETT.serie.length], rader, true)));
    }
    const trend = (serie, farg, reg, kon) => {
        if (!reg) return;
        const l = _vagratLinje(serie, farg, 0, minAlder, maxAlder, { tjocklek: 3, streck: colorBy === 'kon' ? 'hel' : 'streckad',
            data: [{ x: minAlder, y: reg.m * minAlder + reg.b }, { x: maxAlder, y: reg.m * maxAlder + reg.b }] });
        lager.push(l); harledda.push([l, kon]);
    };
    trend('Kvinna (trend)', PALETT.kon.kvinna, trendKv, 'Kvinna');
    trend('Man (trend)', PALETT.kon.man, trendMa, 'Man');
    const allaNamn = reg => `Hela urvalet (trend, R² = ${svTal(reg.r2, 2)})`;
    if (trendAlla) lager.push({ ..._vagratLinje(allaNamn(trendAlla), PALETT.semantic.trend, 0, minAlder, maxAlder, { tjocklek: 2, streck: 'streckad',
        data: [{ x: minAlder, y: trendAlla.m * minAlder + trendAlla.b }, { x: maxAlder, y: trendAlla.m * maxAlder + trendAlla.b }] }),
        harleddAv: { lager: kallor(), minN: kTroskel(), namn: 'trendlinjen för hela urvalet', berakna: p => {
            const t = _konPunktmolnTrend(p);
            return t ? { data: t.linje, serie: allaNamn(t.reg) } : [];
        } } });
    // Trendlinjerna och banden per kön räknas om ur könets synliga punkter, med samma tröskel som i vyn.
    for (const [l, kon] of harledda) {
        l.harleddAv = { ...perKon(kon), minN: kTroskel(), namn: konNamn(kon),
            berakna: p => { const t = _konPunktmolnTrend(p, l.marke === 'band'); return t ? (l.marke === 'band' ? t.band : t.linje) : []; } };
    }
    if (statMedian != null) lager.push(_vagratLinje(`Median i ${diagramNamn(jmfNamn('jämförelsestatistiken'))}`, PALETT.serie[10], statMedian, minAlder, maxAlder, { streck: 'streckad' }));
    return { beskrivning, individer: true, urval: [...(isAll ? [URVAL.bas] : []), URVAL.yrkesgrupp, URVAL.alder, URVAL.lon],
        x: { skala: 'linjar', titel: 'Ålder' }, y: { skala: 'linjar', titel: 'Månadslön', format: 'kr' }, lager,
        referens: pol ? [{ typ: 'zon', y0: pol.p10, y1: pol.p90, farg: PALETT.semantic.neutral, opacitet: 0.15 },
                         { y: pol.med, streck: 'streckad', farg: PALETT.semantic.neutral, tjocklek: 2 }] : [] };
}

// Trendlinjen (och med `medBand` konfidensbandet) ur punkter i spridningsdiagrammet, för ett härlett lager: samma
// funktioner som vyn (Stat.linjarRegression, linjarRegressionKI), över de synliga punkternas åldersspann. null när
// åldrarna inte spänner över något eller regressionen inte går att räkna.
function _konPunktmolnTrend(punkter, medBand = false) {
    const par = punkter.map(d => [d.x, d.y]), aldrar = par.map(p => p[0]);
    const [a0, a1] = omfang(aldrar);
    if (!(a1 > a0)) return null;
    const reg = Stat.linjarRegression(par);
    if (!reg || !isFinite(reg.m) || !isFinite(reg.b)) return null;
    const ci = medBand ? linjarRegressionKI(par, a0, a1, 25) : null;
    return { reg, linje: [{ x: a0, y: reg.m * a0 + reg.b }, { x: a1, y: reg.m * a1 + reg.b }],
             band: ci ? ci.map(p => ({ x: p.x, lag: p.lo, hog: p.hi })) : [] };
}

// Lådagrammet per kön ur ladaPerKon (fliken urval, eller ett underlag i det): en låda för varje kön som når tröskeln,
// eller texten om att inget kön gör det.
function _konLadFigurFor({ lonKv, lonMa, nKv, nMa, utan }, scope, k) {
    if (!lonKv && !lonMa) return _konUtelamnatNot();
    const skal = `färre än ${k} ${personOrd(k)} av könet finns i urvalet`;
    return _konLadFigur({ lonKv, lonMa,
        beskrivning: `Lådagram av lönefördelning per kön för ${scope}. ${nKv} kvinnor, ${nMa} män.`
            + (utan ? ` Lådan visas inte för ${utan}: ${skal}.` : '') });
}
// Lådagrammet per kön: ett lager, en kategori per kön som når tröskeln (null = könet redovisas inte).
function _konLadFigur({ lonKv, lonMa, beskrivning }) {
    const data = [...(lonKv || []).map(y => ({ x: 'Kvinna', y, farg: PALETT.kon.kvinna })), ...(lonMa || []).map(y => ({ x: 'Man', y, farg: PALETT.kon.man }))];
    return { beskrivning, legend: false, x: { skala: 'band', ordning: ['Kvinna', 'Man'] }, y: { skala: 'linjar', titel: 'Månadslön', format: 'kr' },
        lager: [{ marke: 'lada', serie: 'Lön', data,
                  tips: (d, s) => (s ? [[d.x], ['Median', talformat(s.median, 'kr')], ['Kvartiler', `${talformat(s.q1, 'kr', { enhet: false })}–${talformat(s.q3, 'kr')}`], ['Antal', String(s.n)]]
                                     : [[d.x], ['Lön', talformat(d.y, 'kr')]]) }] };
}

const konValjare  = document.getElementById("bas-select-kon");
const demoValjare = document.getElementById("bas-select-demo");
// Ett urval för hela fliken (ADR-41): väljaren i urvalsraden styr både lönedelen och
// åldersstrukturen. Väljaren i åldersdelen (bas-select-demo) är dold och finns för länkar som hoppar dit med ett BAS-intervall;
// de två hålls lika.
function _akValj(varde, kalla) {
    for (const sel of [konValjare, demoValjare]) {
        if (sel && sel !== kalla && [.../** @type {HTMLSelectElement} */ (sel).options].some(o => o.value === varde)) /** @type {HTMLInputElement} */ (sel).value = varde;
    }
    if (konValjare) ritaAlderOchLon(/** @type {HTMLInputElement} */ (konValjare).value);
    if (demoValjare) ritaAldersstruktur(/** @type {HTMLInputElement} */ (demoValjare).value);
}

// ---- Åldersstrukturen ----
/**
 * Åldersstrukturen (ADR-99): vymodellAldersstruktur i src/lib/vymodell-alder-karriar.js räknar andelarna, åldrarna,
 * riskerna, kurvorna och lönespridningen över ålder; här ritas nyckeltalen, risktexten och diagrammen ur den.
 */
export function ritaAldersstruktur(bas) {
    if (!harAlder()) { _akTomUtanAlder(); return; }
    const vm = vymodellAldersstruktur(hamtaData(), { bas, k: kTroskel(), alla: state.data });
    if (!vm) return;
    const { isAll, n, pctKv, pctMa, andel60, andelU40, alderDiff, orgMedian } = vm;
    const scopeShort = isAll ? 'urvalet' : T.niva.bf;
    const ageEl = document.getElementById('demo-kpi-age');
    if (ageEl) {
        ageEl.textContent = `${svTal(vm.medianAlder, 0)} år`;
        ageEl.style.color = vm.avvikelse ? 'var(--danger)' : 'var(--text-main)';
    }
    const ageSubEl = document.getElementById('demo-kpi-age-sub');
    if (ageSubEl) {
        ageSubEl.textContent = isAll
            ? `${n} personer i organisationen`
            : `${alderDiff>=0?'+':''}${svTal(alderDiff, 1)} år mot organisationen (${svTal(orgMedian, 0)} år)`;
    }
    const senEl = document.getElementById('demo-kpi-senior');
    _laNyckel('nyckel-ak-struktur', `${svPct(andel60, 1)} är 60 år eller äldre`, vm.pension === 'manga');
    if (senEl) { senEl.textContent = svPct(andel60, 1); senEl.style.color = vm.pension === 'manga' ? 'var(--danger)' : vm.pension === 'uppsikt' ? FARG.varning : FARG.ok; }
    const junEl = document.getElementById('demo-kpi-junior');
    if (junEl) { junEl.textContent = svPct(andelU40, 1); junEl.style.color = vm.atervaxt ? FARG.varning : 'var(--text-main)'; }
    const iqrEl = document.getElementById('demo-kpi-iqr');
    if (iqrEl) iqrEl.textContent = `${vm.q25}–${vm.q75} år`;
    // Risk text
    const risks = [];
    if (vm.pension === 'manga') risks.push(`<strong>Många nära pension:</strong> ${svPct(andel60, 1)} av ${scopeShort} är 60 år eller äldre. Med riktåldern 60–67 kan en stor del gå i pension inom 0–7 år. Planera för att deras kunskap förs vidare.`);
    else if (vm.pension === 'uppsikt') risks.push(`<strong>Håll uppsikt – nära pension:</strong> ${svPct(andel60, 1)} är 60 år eller äldre.`);
    if (vm.atervaxt) risks.push(`<strong>Brist på återväxt:</strong> Endast ${svPct(andelU40, 1)} är under 40 år.`);
    if (vm.avvikelse === 'aldre') risks.push(`Medelåldern är ${svTal(alderDiff, 1)} år <em>högre</em> än organisationssnittet.`);
    else if (vm.avvikelse === 'yngre') risks.push(`Medelåldern är ${svTal(Math.abs(alderDiff), 1)} år <em>lägre</em> än organisationssnittet.`);
    const riskEl = document.getElementById('demo-risk-insight');
    if (riskEl) {
        if (risks.length === 0) { riskEl.style.display='none'; }
        else { riskEl.style.display='block'; riskEl.innerHTML=risks.join('<br>') + '<br><span class="text-dampad-sm">Hör till personalplaneringen, inte till lönekartläggningen.</span>'; riskEl.className=vm.pension === 'manga'?'insight-box warning':'insight-box'; }
    }
    // Histogram
    ritaFigur('chart-demo-hist', _demoHistFigur({ pctKv, pctMa, refPct: vm.refPct, isAll }), { hojd: 340 });
    if (document.getElementById('chart-demo-pyramid')) ritaFigur('chart-demo-pyramid', _demoPyramidFigur({ pctKv, pctMa, isAll }));
    // Åldersfördelning per kön och lönespridning över ålder. (Spridningsdiagrammet lön mot ålder ligger överst
    // i fliken; hela urvalets trend är ett valbart lager där.)
    const pol = isAll ? null : policyFor(null, bas);
    ritaFigur('chart-demo-agecurve', _demoAlderskurvaFigur(vm.kurvaKv, vm.kurvaMa), { hojd: 300 });
    // P10/median/P90 per femårsgrupp (en åldersgrupp under tröskeln ritas inte). Avsnittets nyckeltal är antalet grupper.
    { const f = vm.band ? _demoBandFigur(vm.df, kTroskel(), pol, vm.aLo, vm.aHi, vm.band) : null;
      if (f) ritaFigur('chart-demo-spread', f, { hojd: 320 }); else rensaFigur('chart-demo-spread');
      _laNyckel('nyckel-ak-lon', f ? `${f.lager[2].data.length} femårsgrupper` : ''); }
}
// Noten när urvalet är under tröskeln: hela urvalets trendlinje utelämnas (punkterna per person följer sin egen regel).
function _demoTrendNot(n) { return `Trendlinje för hela urvalet visas inte: urvalet har ${n} personer, färre än ${kTroskel()}.`; }

// Åldershistogrammets figur (diagramkärnan, ADR-39): andel per åldersgrupp, staplad per kön, mot Sveriges sysselsatta.
// Raka etiketter, inte lutade. Ingen zon för 60+: nyckeltalet «Andel 60+» ovanför bär successionsläsningen.
function _demoHistFigur({ pctKv, pctMa, refPct, isAll }) {
    const serie = (namn, farg, varden) => ({
        marke: 'stapel', lage: 'staplad', serie: namn, farg, opacitet: 0.85,
        data: ALDERSKLASSER.map((x, i) => ({ x, y: varden[i] })),
        tips: d => [[d.x], [namn, talformat(d.y, 'pct')]]
    });
    return { beskrivning: `Åldersfördelning i ${adjektiv('vald', T.niva)} ${T.niva.en} jämfört med Sveriges sysselsatta befolkning. Nyckeltal i rutorna ovan.`,
        x: { skala: 'band', titel: 'Åldersgrupp', ordning: ALDERSKLASSER.slice() },
        y: { skala: 'linjar', titel: isAll ? 'Andel av organisationen (%)' : `Andel av ${T.niva.en} (%)` },
        lager: [serie('Kvinna', PALETT.kon.kvinna, pctKv), serie('Man', PALETT.kon.man, pctMa),
            { marke: 'linje', serie: 'Sveriges sysselsatta (SCB AKU 2023)', farg: PALETT.semantic.referens, streck: 'prickad', punkter: true,
              data: ALDERSKLASSER.map((x, i) => ({ x, y: refPct[i] })),
              tips: d => [[d.x], ['Sveriges sysselsatta', talformat(d.y, 'pct')]] }] };
}

// Ålderspyramiden: samma andelar som histogrammet ovanför, med kvinnor åt vänster och män åt höger och den äldsta
// åldersgruppen överst. Kvinnornas lager har negativa värden för att hamna till vänster och är märkt `absolut`.
function _demoPyramidFigur({ pctKv, pctMa, isAll }) {
    const grupper = ALDERSKLASSER.slice().reverse();
    const serie = (namn, farg, varden, tecken) => ({
        marke: 'stapel', lage: 'staplad', riktning: 'liggande', serie: namn, farg, opacitet: 0.85, ...(tecken < 0 ? { absolut: true } : {}),
        data: ALDERSKLASSER.map((y, i) => ({ y, x: tecken * varden[i] || 0, andel: varden[i] })),
        tips: d => [[d.y], [namn, talformat(d.andel, 'pct')]]
    });
    const storst = Math.max(5, ...pctKv, ...pctMa);
    const grans = Math.ceil(storst * 1.1 / 5) * 5;
    return { beskrivning: `Ålderspyramid: andel av ${isAll ? 'organisationen' : T.niva.bf} per åldersgrupp, kvinnor åt vänster och män åt höger. Samma andelar som i diagrammet ovanför.`,
        y: { skala: 'band', titel: 'Åldersgrupp', ordning: grupper },
        x: { skala: 'linjar', titel: `Kvinnor åt vänster · andel av ${isAll ? 'organisationen' : T.niva.bf} (%) · Män åt höger`, format: 'pctAbs', doman: [-grans, grans], nollinje: true },
        hojd: Math.max(300, 70 + grupper.length * 24),
        lager: [serie('Kvinna', PALETT.kon.kvinna, pctKv, -1), serie('Man', PALETT.kon.man, pctMa, 1)] };
}

// Utjämnade kurvor ritas monotont: de går aldrig utanför värdena.
function _demoAlderskurvaFigur(kv, ma) {
    const kurva = (serie, farg, c, vilka) => ({ marke: 'linje', serie, farg, kurva: 'monoton', tjocklek: 2.5,
        data: c.ages.map((x, i) => ({ x, y: c.share[i], alder: x })), tips: d => [[`${d.x} år`], [serie, `${talformat(d.y, 'pct')} av ${vilka}`]] });
    return { beskrivning: 'Åldersfördelning som kurva per kön: andel av det egna könet per ålder, 5-årigt glidande medel.',
        urval: [URVAL.alder], x: { skala: 'linjar', titel: 'Ålder' }, y: { skala: 'linjar', titel: 'Andel av könet (%)' },
        lager: [kurva('Kvinna', PALETT.kon.kvinna, kv, 'kvinnorna'), kurva('Man', PALETT.kon.man, ma, 'männen')] };
}

// Lönespridning över ålder: lönen per femårsgrupp som median med två band —
// mittersta hälften (P25–P75) och P10–P90. En åldersgrupp under tröskeln ritas inte; bandet bryts där.
// Åldersfiltret läser femårsgruppens första år (`alder`, i gruppens namn i tipset): en grupp visas när det ligger i
// intervallet. Ställningstagandets linjer bär inget sådant fält och ritas alltid.
// Femårsgrupperna och prövningen mot k är alderBandRader i src/lib/vymodell-alder-karriar.js (vymodellens `band`).
function _demoBandFigur(df, k, pol, aLo, aHi, rader = alderBandRader(df, k)) {
    if (!rader) return null;
    const kr = v => `${talformat(v, 'kr')}/mån`;
    const tips = d => [[d.namn], ['P90', kr(d.r.p90)], ['P75', kr(d.r.p75)], ['Median', kr(d.r.p50)], ['P25', kr(d.r.p25)], ['P10', kr(d.r.p10)], ['Antal', String(d.r.n)]];
    const band = (serie, lag, hog, opacitet) => ({ marke: 'band', serie, farg: PALETT.serie[0], opacitet, data: rader.map(r => ({ x: r.x, lag: r[lag], hog: r[hog], namn: r.namn, alder: r.alder, r })), tips });
    return { beskrivning: `Lönespridning över ålder: medianlön per femårsgrupp, med band för mittersta hälften (P25–P75) och för P10–P90. Åldersgrupper med färre än ${k} ${personOrd(k)} visas inte.`,
        urval: [URVAL.alder], x: { skala: 'linjar', titel: 'Ålder (femårsgrupper)' }, y: { skala: 'linjar', titel: 'Kronor/månad', format: 'kr' },
        lager: [band('P10–P90', 'p10', 'p90', 0.16), band('Mittersta hälften (P25–P75)', 'p25', 'p75', 0.3),
                { marke: 'linje', serie: 'Median', farg: PALETT.serie[0], tjocklek: 2.5, punkter: true, data: rader.map(r => ({ x: r.x, y: r.p50, namn: r.namn, alder: r.alder, r })), tips },
            ...(pol ? [_vagratLinje('Ställn. P10', farger.policy, pol.p10, aLo, aHi, { streck: 'streckad', tjocklek: 1 }),
                       _vagratLinje('Ställn. Median', farger.policy, pol.med, aLo, aHi, { streck: 'streckad', tjocklek: 1.5 }),
                       _vagratLinje('Ställn. P90', farger.policy, pol.p90, aLo, aHi, { streck: 'streckad', tjocklek: 1 })] : [])] };
}

/** Det som körs vid laddning, i filens ordning; src/app/index.js anropar delarnas uppstart i sifferordning. */
export function uppstartAlderKarriar() {
    document.getElementById('kon-trend-alla')?.addEventListener('change', () => { const s = /** @type {HTMLInputElement|null} */ (document.getElementById('bas-select-kon')); if (s) ritaAlderOchLon(s.value); });
    if (konValjare)  konValjare.addEventListener("change",  e => _akValj(/** @type {HTMLInputElement} */ (e.target).value, konValjare));
    document.getElementById('kon-color-by')?.addEventListener('change', () => {
        const s = document.getElementById('bas-select-kon');
        if (s) ritaAlderOchLon(/** @type {HTMLInputElement} */ (s).value);
    });
    if (demoValjare) demoValjare.addEventListener("change", e => _akValj(/** @type {HTMLInputElement} */ (e.target).value, demoValjare));
}

// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
// ====================================================================
// 75-lonepolitik.js — Fördjupad analys mot lönepolitiskt ställningstagande
//
// Fliken svarar på "lever vi upp till vår egen
// lönepolitik, och var gör vi det inte?" — ner på yrkesgruppsnivå (AID).
//
// Modellen och matematiken ligger i src/lib/lonepolitik.js, och det avsnitten räknar och bedömer utöver modellen i
// vymodellen src/lib/vymodell-lonepolitik.js (ADR-99). Uppslaget av vilken policyrad som gäller görs av policyFor()
// (state-beroende) och skickas in; här skrivs orden och ritas.
//
// Maskeringstrappan (`maskeringsniva` i lib) — AID-upplösning utan att urholka minsta gruppstorlek:
//   n >= kTroskel()           → full analys (median, band, kön)
//   ANTAL_MIN <= n < k        → endast bandplacering i ANTAL ("2 av 7 under P10")
//   n < min(ANTAL_MIN, k)     → maskerad rad, men inräknad i BAS-totalen
// Är tröskeln satt till ANTAL_MIN (5) eller lägre finns ingen mellannivå.
// ====================================================================
import { talformat } from '../lib/figur.js';
import { maskeringsniva } from '../lib/lonepolitik.js';
import { personOrd } from '../lib/namn.js';
import { froAvText } from '../lib/rng.js';
import { svKr, svPct, svTal } from '../lib/talformat.js';
import { adjektiv, genitiv, ordForAntal, stor } from '../lib/termer.js';
import { vymodellLonepolitik } from '../lib/vymodell-lonepolitik.js';
import { FARG } from './01-farger.js';
import { esc } from './01-html-och-tillganglighet.js';
import { aktiveraSortering } from './05-tabeller-och-lankar.js';
import { _konUtelamnatNot, kTroskel, litetUnderlag } from './06-k-troskel.js';
import { kMaskNot } from './06-maskeringsnoter.js';
import { orgNamn, diagramNamn } from './07-standardinstallningar.js';
import { T } from './09-termer.js';
import { rensaFigur, ritaFigur } from './10-diagramritare.js';
import { PALETT, URVAL } from './10-diagramtema.js';
import { markeringFor } from './11-markering.js';
import { laggTillTabellverktyg, hamtaData, harReferens, policyFor, policyNivaEtikett, referensKortnamn, referensNamn, state } from './12-tillstand.js';
import { statusMarke } from './13-oversikt.js';
import { _laSlutsats } from './41-lika-arbete.js';
import { konsklassNu } from './45-aid-bas-tabeller.js';
import { kTroskelLank } from './86-installningar.js';

export function _lpNiva(n) { return maskeringsniva(n, kTroskel()); }

/**
 * Vymodellen för avsnitten om ställningstagandet (vymodellLonepolitik i src/lib/vymodell-lonepolitik.js): här
 * översätts bara state till policyuppslaget och tröskeln.
 */
export function lonepolitikVymodell() {
    return vymodellLonepolitik(hamtaData(), {
        policyFor, nivaEtikett: policyNivaEtikett, k: kTroskel(), harPolicy: (state.policy || []).length > 0
    });
}

// ---- Renderare --------------------------------------------------------------

/** Ritar Löneläget mot ställningstagandet: bandkartan, slutsatserna, tabellen, könspositionen, efterlevnaden och täckningen. */
export function ritaLonepolitik() {
    const wrap = document.getElementById('lonepolitik-content');
    const empty = document.getElementById('lonepolitik-empty');
    if (!wrap || !empty) return;
    const rubrik = document.getElementById('lonepolitik-rubrik');
    if (rubrik) rubrik.textContent = `Lönerna mot ${referensNamn()}`;
    const vm = lonepolitikVymodell();
    // Bandkartan står i Löneläget överst, i avsnittet Överblick, och syns när ett ställningstagande finns.
    _lpBandkartaKort(vm);

    if (vm.tom) {
        _lpRitaTopp(null);
        empty.style.display = 'block';
        wrap.style.display = 'none';
        // Två lägen: ingen referens alls, eller en referens som inte matchar underlaget.
        const h = empty.querySelector('h2'), p = empty.querySelector('p');
        if (h && p) {
            if (!harReferens()) {
                h.textContent = 'Ingen referens inläst';
                p.textContent = 'Det finns inget ställningstagande att jämföra med. Läs in organisationens lönepolitiska ställningstagande eller organisationspaketet i Filer och kvalitet, så jämförs lönerna mot det.';
            } else {
                h.textContent = 'Referensen matchar inte underlaget';
                p.innerHTML = `Referensen har inga rader för underlagets ${T.niva.fl} eller ${T.kod.fl}. Läs in en fil med P10/Median/P90 där varje rad har en <strong>BAS</strong>-kolumn, en <strong>AID</strong>-kolumn, eller båda.`;
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
    const lage = _lpRitaTopp(vm);
    const [konsposition, efterlevnad] = _lpDiagramskalHtml();
    wrap.innerHTML = avsnitt('tabell', `${stor(T.enhet.fl)} mot sitt spann`, 'Var varje grupps median ligger i spannet, och hur många som ligger under',
            `${lage.provade} ${ordForAntal(lage.provade, T.enhet)} i ${T.niva.en}`, _lpTabellHtml(vm))
        + avsnitt('kon', 'Könsposition i bandet', 'Placeras kvinnor lägre i samma lönespann än män?', '', konsposition)
        + avsnitt('efterlevnad', 'Efterlevnad', `Andel under, inom eller över eget spann per ${T.niva.en}`, '', efterlevnad)
        + avsnitt('tackning', 'Täckningsgrad', 'Hur mycket av personalen har en policyreferens?', svPct(vm.modell.coverage.personsPct, 0), _lpTackningHtml(vm));

    _lpRitaKonPosition(vm);
    _lpRitaKonLagen(vm);
    _lpRitaEfterlevnad(vm);
    if (typeof aktiveraSortering === 'function') aktiveraSortering('lonepolitik-table');
    if (typeof laggTillTabellverktyg === 'function') laggTillTabellverktyg('lonepolitik-table', 'lonepolitik');
}

function _lpTackningHtml(vm) {
    const c = vm.modell.coverage;
    const pct = vm.tackning.pct;
    const farg = vm.tackning.status;
    return `
    <div class="card mb-16 lp-tackning ram-v-3-${farg}">
        <div class="rad-bryt baslinje gap-12">
            <div class="fs-2rem tabelltal fw-700 fg-${farg}">${svPct(pct, 0)}</div>
            ${statusMarke(farg)}
            <div class="text-dampad-sm">
                ${c.personsCovered} av ${c.personsTotal} personer · ${c.groupsCovered} av ${c.groupsTotal} ${ordForAntal(c.groupsTotal, T.enhet)} i ${T.niva.en}
            </div>
        </div>
        ${pct < 100 ? `<p class="reg-caveat-inline marg-t-10"><strong>Läs resultatet mot detta:</strong>
            grupper utan policyrad kan inte avvika. "Inga avvikelser" kan alltså betyda
            <em>ingen referens</em> snarare än ett gott resultat.</p>` : ''}
    </div>`;
}

// Bandkartans kort i avsnittet Överblick (src/index.html, #lp-bandkarta-kort): synligt när ett ställningstagande finns.
// Matchar ställningstagandet inte underlaget står ett meddelande i kortet, så att överblicken aldrig blir en tom rubrik.
function _lpBandkartaKort(vm) {
    const kort = document.getElementById('lp-bandkarta-kort'), el = document.getElementById('chart-lp-bandmap');
    if (!kort || !el) return;
    if (!vm.modell.hasPolicy) { rensaFigur(el); el.innerHTML = ''; kort.hidden = true; return; }
    kort.hidden = false;
    const forklaring = document.getElementById('lp-bandkarta-forklaring');
    if (forklaring) forklaring.textContent = `Grå stapel = ${referensKortnamn()}:s P10–P90. Streck i den = referensens median. Blå stapel = organisationens faktiska P10–P90 (bara BAS med minst ${kTroskel()} ${personOrd(kTroskel())}). Punkt = ${genitiv(T.enhet.bf)} median: ${adjektiv('kvinnodominerad', T.enhet)}, ${adjektiv('mansdominerad', T.enhet)} eller ${adjektiv('blandad', T.enhet)}.`;
    if (!vm.modell.byBas.length) { _lpIngetDiagram(el, `Ställningstagandet har inga rader för underlagets ${T.niva.fl} eller ${T.kod.fl}.`); return; }
    _lpRitaBandkarta(vm.bandkarta);
}

function _lpDiagramskalHtml() {
    return [`
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
                <option value="staplad"${_lpEfterlevnadVy === 'staplad' ? ' selected' : ''}>Hela fördelningen (100 %)</option>
                <option value="mitt"${_lpEfterlevnadVy === 'mitt' ? ' selected' : ''}>Avvikelserna kring en mittlinje</option>
            </select></span>
        </div>
        <div id="chart-lp-compliance"></div>
    </div>`];
}

/**
 * Flikens topp: urvalsraden och slutsatserna. Räknar bara yrkesgrupper som tabellen visar med percentiler —
 * grupper under tröskeln har ingen position att redovisa (lageISpannet i vymodellen). Ett läge utanför spannet är ett
 * fynd att förklara och märks inte som fel; låg täckningsgrad märks, eftersom resultatet då inte går att läsa.
 * @returns {{provade:number, under:number, over:number}}
 */
function _lpRitaTopp(vm) {
    const urval = document.getElementById('lp-urval'), host = document.getElementById('lp-slutsatser');
    if (!vm) { if (urval) urval.textContent = ''; if (host) host.innerHTML = ''; return { provade: 0, under: 0, over: 0 }; }
    const lage = vm.lage;
    if (!urval || !host) return lage;
    const c = vm.modell.coverage;
    urval.innerHTML = `<span><strong>Hela urvalet</strong> · ${svTal(c.personsTotal, 0)} personer</span><span>Referens: ${esc(referensNamn())}</span>${kTroskelLank()}`;
    const grupper = n => `${ordForAntal(n, T.enhet)} i ${T.niva.en}`;
    host.innerHTML = _laSlutsats('Täckningsgrad', svPct(c.personsPct, 0), `${c.personsCovered} av ${c.personsTotal} personer har en referens`, vm.tackning.status === 'kritisk')
        + _laSlutsats('Median under spannet', svTal(lage.under, 0), `${grupper(lage.under)} av ${lage.provade} prövade`)
        + _laSlutsats('Median inom spannet', svTal(lage.provade - lage.under - lage.over, 0), grupper(lage.provade - lage.under - lage.over))
        + _laSlutsats('Median över spannet', svTal(lage.over, 0), grupper(lage.over));
    return lage;
}

function _lpRitaBandkarta(karta) {
    const el = document.getElementById('chart-lp-bandmap');
    if (!el) return;
    if (!karta.bas.length) { _lpIngetDiagram(el, `${stor(adjektiv({ utrum: 'ingen', neutrum: 'inget', plural: 'inga' }, T.niva))} ${T.niva.en} har ett användbart P10–P90-spann i policyn.`); return; }
    ritaFigur(el, _lpBandkartaFigur(karta), { hojd: 460 });
}

// Yrkesgruppernas könsdominans efter andelen kvinnor i procent: namn, färg och villkor. Bandkartan och statistikens
// spann i Löneläget (42-jamforelse.js) delar klasserna, så att samma färg betyder samma sak i båda.
/** @returns {Array<[string, string, (a: number) => boolean]>} */
export function _lpKonsdominans() {
    return [['Kvinnodominerad', PALETT.kon.kvinna, a => konsklassNu(a) === 'kvinnodominerad'], ['Mansdominerad', PALETT.kon.man, a => konsklassNu(a) === 'mansdominerad'], ['Blandad', PALETT.semantic.neutral, a => konsklassNu(a) === 'blandad']];
}
// Punktens förskjutning i sidled ur gruppens identitet, inte slump: punkterna ska ligga still mellan omritningar.
export function _lpForskjutning(aid, bas) { return ((froAvText(aid + '|' + bas) % 1000) / 1000 - 0.5) * 0.36; }

// Bandkartans figur (diagramkärnan, ADR-39): referensens spann och organisationens faktiska spann per BAS som märket
// `intervall`, med varje yrkesgrupps median som punkt.
// Organisationens spann finns bara för BAS med minst k personer (`b.orgBand`), och punkterna bara för grupper på full
// nivå (percentiler kräver n ≥ k; bandkarta i vymodellen) — inget annat når figuren.
function _lpBandkartaFigur({ bas, punkter }) {
    const x = b => 'BAS ' + b.bas, kr = v => talformat(v, 'kr'), utanKr = v => talformat(v, 'kr', { enhet: false });
    const refNamn = referensKortnamn(), org = diagramNamn(orgNamn());
    const refMed = b => (b.pol.med > 0 ? b.pol.med : (b.pol.p10 + b.pol.p90) / 2);
    const medOrgBand = bas.filter(b => b.orgBand);
    const pts = punkter.map(p => ({ x: 'BAS ' + p.bas, y: p.median, forskjutning: _lpForskjutning(p.aid, p.bas),
        storlek: Math.max(3.5, Math.min(9, Math.sqrt(p.n) * 1.1)), kvAndel: p.kvAndel, n: p.n, yrke: p.yrke, bas: p.bas, niva: p.niva, markering: markeringFor(p.bas, p.aid) }));
    return { beskrivning: `Referensens lönespann och organisationens faktiska lönespann per ${T.niva.en}, med varje ${genitiv(T.enhet.en)} median inlagd som punkt. Samma värden finns i tabellen nedan.`,
        urval: [URVAL.bas, URVAL.yrkesgrupp, URVAL.konsdominans, URVAL.antal], x: { skala: 'band', ordning: bas.map(x) }, y: { skala: 'linjar', titel: 'Månadslön', format: 'kr' },
        lager: [
            { marke: 'intervall', serie: `${refNamn} (P10–P90)`, farg: PALETT.semantic.spann, tjocklek: 14,
              data: bas.map(b => ({ x: x(b), lag: b.pol.p10, hog: b.pol.p90, bas: b.bas, markering: markeringFor(b.bas) })), tips: d => [[d.x], [refNamn, `P10 ${utanKr(d.lag)} · P90 ${kr(d.hog)}`]] },
            { marke: 'punkt', symbol: 'streck', serie: `${refNamn} median`, farg: PALETT.semantic.referens, storlek: 4.5, legend: false,
              data: bas.map(b => ({ x: x(b), y: refMed(b), bas: b.bas })), tips: d => [[d.x], [`${refNamn} median`, kr(d.y)]] },
            { marke: 'intervall', serie: `${org} (P10–P90)`, farg: PALETT.serie[0], opacitet: 0.55, tjocklek: 6,
              // Spannets antal heter `antal`, inte `n`: `n` är en yrkesgrupps antal, som filtret Antal personer i gruppen läser.
              data: medOrgBand.map(b => ({ x: x(b), lag: b.orgBand.p10, hog: b.orgBand.p90, med: b.orgBand.med, antal: b.orgBand.n, bas: b.bas, markering: markeringFor(b.bas) })),
              tips: d => [[d.x], ['Organisationen', `P10 ${utanKr(d.lag)} · median ${utanKr(d.med)} · P90 ${kr(d.hog)}`], ['Antal', String(d.antal)]] },
            // Yrkesgrupperna i tre klasser efter könsfördelning (som i Likvärdigt arbete) i stället för en färgskala:
            // tre färger går att läsa mot spannen, en glidande skala gör det inte.
            ..._lpKonsdominans().map(([klass, farg, hor]) => ({ marke: 'punkt', serie: `${stor(adjektiv(klass.toLowerCase(), T.enhet))} ${T.enhet.en}`, farg, kant: FARG.vit, data: pts.filter(p => hor(p.kvAndel)).map(p => ({ ...p, konsdom: klass })),
                    tips: d => [[d.yrke], [`BAS ${d.bas}`, `median ${kr(d.y)}`], ['Kvinnor', talformat(d.kvAndel, 'antal') + ' %'], ['Referens', d.niva], ['Antal', String(d.n)]] }))
        ].filter(l => l.data.length) };
}

// Positionen i spannet är ett LÄGE, inte en mängd: kvinnor och män som två punkter på en bana som är policyns
// spann (0 = P10, 100 = P90) — inte som två staplar. Raderna är redan filtrerade av vyn: inget BAS-intervall under
// tröskeln når figuren.
function _lpFigurKonHantel(rows) {
    const y = b => 'BAS ' + b.bas, pos = (b, f) => +(b.genderGap[f] * 100).toFixed(1);
    const alla = rows.flatMap(b => [pos(b, 'kvPos'), pos(b, 'maPos')]);
    const punkt = (namn, farg, falt) => ({ marke: 'punkt', serie: namn, farg, storlek: 6,
        data: rows.map(b => ({ y: y(b), x: pos(b, falt), bas: b.bas, markering: markeringFor(b.bas) })), tips: d => [[d.y], [namn, `${talformat(d.x, 'pct')} in i spannet`]] });
    return { beskrivning: `Kvinnors respektive mäns genomsnittliga position i ställningstagandets lönespann per ${T.niva.en}, som två punkter på spannet: 0 procent är spannets nedre gräns (P10), 100 procent den övre (P90).`,
        urval: URVAL.bas, y: { skala: 'band', ordning: rows.map(y) }, x: { skala: 'linjar', titel: 'Position i spannet (%) — 0 = P10, 100 = P90', doman: [Math.min(0, ...alla) - 4, Math.max(100, ...alla) + 4] },
        hojd: Math.max(170, 100 + rows.length * 34),
        referens: [{ x: 50, streck: 'prickad', farg: PALETT.semantic.neutral, tjocklek: 1, etikett: 'Mitten' }],
        lager: [{ marke: 'intervall', riktning: 'liggande', serie: 'Policyns spann', farg: PALETT.semantic.spann, tjocklek: 12, data: rows.map(b => ({ y: y(b), lag: 0, hog: 100, bas: b.bas })), tips: d => [[d.y], ['Spann', 'P10–P90']] },
                { marke: 'intervall', riktning: 'liggande', serie: 'Skillnad', farg: PALETT.semantic.neutral, tjocklek: 2, legend: false,
                  data: rows.map(b => ({ y: y(b), lag: Math.min(pos(b, 'kvPos'), pos(b, 'maPos')), hog: Math.max(pos(b, 'kvPos'), pos(b, 'maPos')), bas: b.bas })) },
                punkt('Kvinnor', PALETT.kon.kvinna, 'kvPos'), punkt('Män', PALETT.kon.man, 'maPos')] };
}

// ---- Var i spannet ligger kvinnor och män? ----
// Varje person får ett läge i sitt BAS-intervalls spann (0 = P10, 1 = P90) och räknas till en av fem klasser: under
// spannet, nedre, mellersta eller övre tredjedelen, eller över spannet. Genomsnittsläget (diagrammet ovanför) kan vara
// detsamma för könen fast det ena samlas i nedre tredjedelen; fördelningen visar det. Klasserna räknas per BAS-intervall
// med policyspann och läggs ihop över hela urvalet; ett kön redovisas bara när det når tröskeln.
const _LP_LAGEN = [['Under spannet', PALETT.lage.under], ['Nedre tredjedelen', PALETT.lage.nedre], ['Mellersta tredjedelen', PALETT.lage.inom], ['Övre tredjedelen', PALETT.lage.ovre], ['Över spannet', PALETT.lage.over]];
function _lpFigurKonLagen(sum) {
    const rader = [['Kvinnor', sum.kv, sum.nKv], ['Män', sum.ma, sum.nMa]];
    return { beskrivning: `Andel av kvinnorna respektive männen i policyspannets nedre, mellersta och övre tredjedel samt under och över spannet, staplat till 100 procent. Varje person räknas mot sitt ${genitiv(T.niva.en)} spann.`,
        y: { skala: 'band', ordning: rader.map(r => r[0]) }, x: { skala: 'linjar', titel: 'Andel av könet (%)', doman: [0, 100] }, hojd: 190,
        lager: _LP_LAGEN.map(([serie, farg], i) => ({ marke: 'stapel', lage: 'staplad', riktning: 'liggande', serie, farg,
            data: rader.map(([namn, antal, n]) => { const a = +(100 * antal[i] / n).toFixed(1), fa = antal[i] > 0 && antal[i] < litetUnderlag();
                return { y: namn, x: a, n, ...(fa ? { fa: true } : {}), ...(a >= 7 ? { etikett: svPct(a, 0) } : {}) }; }),
            tips: d => [[d.y], [serie, talformat(d.x, 'pct')], ['Antal i könet', String(d.n)], ...(d.fa ? [['Litet underlag', `färre än ${litetUnderlag()} personer`]] : [])] })) };
}
function _lpRitaKonLagen(vm) {
    const el = document.getElementById('chart-lp-konlagen'), kort = document.getElementById('lp-konlagen-kort'), not = document.getElementById('lp-konlagen-not');
    if (!el) return;
    // Tredjedelarna redovisas bara när båda könen når tröskeln (konLagenSumma i vymodellen).
    const sum = vm.konLagen, ok = sum.ok;
    if (kort) kort.hidden = !ok;
    if (!ok) { rensaFigur(el); if (not) not.textContent = ''; return; }
    ritaFigur(el, _lpFigurKonLagen(sum));
    const pct = (a, n) => svPct(100 * (a[0] + a[1]) / n, 0);
    if (not) not.textContent = `${pct(sum.kv, sum.nKv)} av kvinnorna och ${pct(sum.ma, sum.nMa)} av männen ligger i nedre tredjedelen eller under spannet. ${svTal(sum.nKv, 0)} kvinnor och ${svTal(sum.nMa, 0)} män med policyspann ingår.`;
}

const _LP_LAGE = PALETT.lage;
function _lpFigurEfterlevnad(rows) {
    const pct = (v, n) => +((v / n) * 100).toFixed(1);
    const serie = (namn, farg, falt) => ({
        marke: 'stapel', lage: 'staplad', serie: namn, farg,
        data: rows.map(b => ({ x: 'BAS ' + b.bas, y: pct(b.compliance[falt], b.compliance.n), bas: b.bas, markering: markeringFor(b.bas) })),
        tips: d => [[d.x], [namn, talformat(d.y, 'pct')]]
    });
    return { beskrivning: `Andel anställda under, inom och över ställningstagandets lönespann per ${T.niva.en}`,
        urval: URVAL.bas, x: { skala: 'band' }, y: { skala: 'linjar', titel: 'Andel av de anställda (%)', doman: [0, 100] },
        hojd: Math.max(260, 60 + rows.length * 38),
        // Två nyanser kring en neutral mitt (under — inom — över), inte rött och grönt: läget i spannet är en riktning.
        lager: [serie('Under P10', _LP_LAGE.under, 'under'), serie('Inom spann', _LP_LAGE.inom, 'within'),
                serie('Över P90', _LP_LAGE.over, 'over')] };
}

// Samma andelar ställda kring en mittlinje (divergerande stapel): under spannet åt vänster, över åt höger, störst
// andel utanför spannet överst. Andelen inom spannet ritas inte — den står i tipset. Under-lagret har negativa
// värden för att hamna till vänster och är märkt `absolut`, så diagramdatan bär andelen utan tecken.
let _lpEfterlevnadVy = 'staplad';   // 'staplad' | 'mitt' — användarens val, gäller tills sidan laddas om
function _lpFigurEfterlevnadMitt(rows) {
    const pct = (v, n) => +((v / n) * 100).toFixed(1);
    const sorterade = rows.slice().sort((a, b) => (b.compliance.under + b.compliance.over) / b.compliance.n - (a.compliance.under + a.compliance.over) / a.compliance.n);
    const serie = (namn, farg, falt, tecken) => ({
        marke: 'stapel', lage: 'staplad', riktning: 'liggande', serie: namn, farg, ...(tecken < 0 ? { absolut: true } : {}),
        data: sorterade.map(b => {
            const andel = pct(b.compliance[falt], b.compliance.n);
            return { y: 'BAS ' + b.bas, x: tecken * andel || 0, andel, inom: pct(b.compliance.within, b.compliance.n), bas: b.bas, markering: markeringFor(b.bas),
                     ...(andel > 0 ? { etikett: talformat(andel, 'pct') } : {}) };
        }),
        tips: d => [[d.y], [namn, talformat(d.andel, 'pct')], ['Inom spann', talformat(d.inom, 'pct')]]
    });
    const storst = Math.max(10, ...sorterade.map(b => Math.max(pct(b.compliance.under, b.compliance.n), pct(b.compliance.over, b.compliance.n))));
    const grans = Math.min(100, Math.ceil(storst * 1.15 / 10) * 10);
    return { beskrivning: `Andel anställda under respektive över ställningstagandets lönespann per ${T.niva.en}, ställda kring en mittlinje: under åt vänster, över åt höger. Störst andel utanför spannet överst. Resten ligger inom spannet.`,
        urval: URVAL.bas, y: { skala: 'band', ordning: sorterade.map(b => 'BAS ' + b.bas) },
        x: { skala: 'linjar', titel: 'Under P10 åt vänster · andel av de anställda (%) · över P90 åt höger', format: 'pctAbs', doman: [-grans, grans], nollinje: true },
        hojd: Math.max(260, 70 + sorterade.length * 38),
        lager: [serie('Under P10', _LP_LAGE.under, 'under', -1), serie('Över P90', _LP_LAGE.over, 'over', 1)] };
}

// Ett meddelande i stället för diagrammet: figuren släpps först, så att ingen export eller omritning finns kvar.
export function _lpIngetDiagram(el, text) {
    rensaFigur(el);
    const p = document.createElement('p');
    p.style.cssText = 'color:var(--text-muted);font-size:0.9rem;margin:8px 0;';
    p.textContent = text;
    el.appendChild(p);
}

function _lpRitaKonPosition(vm) {
    const el = document.getElementById('chart-lp-gender');
    if (!el) return;
    const rows = vm.konPosition.visade;
    if (!rows.length) {
        _lpIngetDiagram(el, `${stor(adjektiv({ utrum: 'ingen', neutrum: 'inget', plural: 'inga' }, T.niva))} ${T.niva.en} har minst ${kTroskel()} av varje kön med användbart policyspann — könsanalysen kan inte redovisas.`);
        return;
    }
    ritaFigur(el, _lpFigurKonHantel(rows));
}

function _lpRitaEfterlevnad(vm) {
    const el = document.getElementById('chart-lp-compliance');
    if (!el) return;
    // Minsta gruppstorlek: staplarna visar andelar med en decimal, så ett BAS-intervall
    // under tröskeln skulle gå att baklängesräkna till antal individer — och
    // policyns P10/P90 visas i samma vy. BAS-rollupen byggs av ALLA AID-grupper
    // oavsett maskeringstrappa, så tröskeln sätts i vymodellen (efterlevnad).
    const rows = vm.efterlevnad.visade;
    const dolda = vm.efterlevnad.dolda.map(b => 'BAS ' + b);
    // Noten om utelämnade intervall ligger EFTER behållaren (kärnan äger behållarens innehåll).
    const gammal = el.parentElement && el.parentElement.querySelector('[data-lp-not="komplians"]');
    if (gammal) gammal.remove();
    if (!rows.length) {
        _lpIngetDiagram(el, vm.efterlevnad.harSpann
            ? `Samtliga ${T.niva.fl} med policyspann har färre än ${kTroskel()} ${personOrd(kTroskel())} och kan därför inte redovisas.`
            : 'Ingen BAS har användbara bandgränser i policyn.');
        return;
    }
    ritaFigur(el, _lpEfterlevnadVy === 'mitt' ? _lpFigurEfterlevnadMitt(rows) : _lpFigurEfterlevnad(rows));
    if (dolda.length) {
        // Namnger de utelämnade intervallen i stället för att bara räkna dem —
        // samma princip som noterna under tabellerna.
        const note = document.createElement('div');
        note.setAttribute('data-lp-not', 'komplians');
        note.innerHTML = kMaskNot(dolda, `${T.niva.en}|${T.niva.fl}`);
        el.insertAdjacentElement('afterend', note);
    }
}

/** Gruppens namn i tabellen, noten och Excel-bladet: AID-koden en gång och sedan benämningen ("206017 Sjuksköterska").
 * Yrket är "AID benämning" när filen har båda, och bara koden när benämning saknas. */
function _lpGruppnamn(g) {
    const benamning = _lpBenamning(g);
    return benamning ? `${g.aid} ${benamning}` : String(g.aid);
}
/** Yrkets benämning utan AID-koden först. Bara koden tas bort, så att en benämning som börjar med en siffra
 * («3D-tekniker») står kvar hel. */
function _lpBenamning(g) {
    const yrke = String(g.yrke || ''), aid = String(g.aid ?? '');
    if (!aid || !yrke.startsWith(aid)) return yrke;
    const rest = yrke.slice(aid.length);
    return rest === '' || /^\s/.test(rest) ? rest.trim() : yrke;
}

function _lpTabellHtml(vm) {
    const kr = v => svKr(v);
    const rows = [];
    // Maskeringstrappan per yrkesgrupp: tabellblock i vymodellen.
    vm.tabell.forEach(({ b, rader, utelamnade }) => {
        rows.push(`<tr class="group-header"><td colspan="7">BAS ${esc(b.bas)}${b.pol ? '' : ' — <em>ingen policyreferens</em>'}</td></tr>`);
        rader.forEach(({ g, typ, position: posPct, lage }) => {
            const name = esc(_lpGruppnamn(g));
            if (typ === 'ingenPolicy') {
                rows.push(`<tr><td>${name}</td><td class="t-hoger">${g.n}</td><td colspan="5" class="farg-dampad kursiv">Ingen policyreferens</td></tr>`);
                return;
            }
            if (typ === 'antal') {
                const c = g.compliance;
                rows.push(`<tr><td>${name}</td><td class="t-hoger">${g.n}</td>`
                    + `<td class="t-mitt f-dampad" colspan="3">Endast antal (n &lt; ${kTroskel()})</td>`
                    + `<td class="t-mitt" data-sort-value="${c ? c.under : 0}">${c ? `${c.under} av ${c.n} under P10` : '–'}</td>`
                    + `<td class="t-mitt">${esc(g.level || '–')}</td></tr>`);
                return;
            }
            const s = g.stats, c = g.compliance;
            const posKlass = lage === 'under' ? ' f-kritisk halvfet' : lage === 'over' ? ' fg-info' : '';
            rows.push(`<tr><td>${name}</td>`
                + `<td class="t-hoger">${g.n}</td>`
                + `<td class="tabelltal ta-hoger" data-sort-value="${s.median}">${kr(s.median)}</td>`
                + `<td class="t-tal">${kr(g.pol.p10)}–${kr(g.pol.p90)}</td>`
                + `<td class="t-tal${posKlass}" data-sort-value="${posPct == null ? '' : posPct}">${posPct == null ? 'Spann för smalt' : svPct(posPct, 0)}</td>`
                + `<td class="t-mitt" data-sort-value="${c ? c.under : 0}">${c ? `${c.under} av ${c.n}` : '–'}</td>`
                + `<td class="t-mitt">${esc(g.level || '–')}</td></tr>`);
        });
        // Minsta gruppstorlek, nedersta steget: gruppen är så liten att inte ens antalet får visas. Raden utelämnas och
        // gruppen räknas upp i noten sist i BAS-blocket. Personerna ingår fortfarande i BAS-totalen.
        if (utelamnade.length) {
            rows.push(`<tr><td colspan="7">${kMaskNot(utelamnade.map(_lpGruppnamn), `${T.enhet.en}|${T.enhet.fl}`, vm.antalMin)}</td></tr>`);
        }
    });
    return `
    <div class="card">
        <p class="text-dampad-sm lh-1_55 marg-0-0-10">
            <strong>Position</strong> är var gruppens median ligger i spannet: 0 % = på P10, 100 % = på P90.
            Under 0 % eller över 100 % betyder att medianen ligger utanför spannet.
            Grupper med färre än ${kTroskel()} ${personOrd(kTroskel())} visas utan percentiler, och under ${vm.antalMin} maskeras de helt —
            men de räknas alltid in i BAS-totalen.
        </p>
        <div class="table-container">
            <table id="lonepolitik-table" class="data-table fs-sm" aria-label="${stor(T.enhet.fl)} jämförda mot ${esc(referensNamn())}">
                <thead><tr>
                    <th>${stor(T.enhet.en)}</th>
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
 * som fliken: maskeringstrappan för yrkesgrupperna (tabellblock), tröskeln per kön för de könsuppdelade måtten
 * (samma villkor som konsskillnadIBand och kortet om tredjedelarna) och tröskeln per BAS-intervall för efterlevnaden,
 * allt ur vymodellen (vymodellLonepolitik). Finns inget ställningstagande, eller matchar det inte underlaget, blir det
 * inget blad.
 * @returns {null|any[][]} bladets rader
 */
export function _lpExcelBlad() {
    const vm = lonepolitikVymodell();
    if (vm.tom) return null;
    const k = kTroskel(), r1 = v => Math.round(v * 10) / 10, kr = v => Math.round(v);
    const pct = (a, n) => (n ? r1(100 * a / n) : '');
    /** @type {any[][]} */
    const ut = [
        [`Lönerna mot ${referensNamn()} (fliken Löneläget)`],
        [`Position är var medianen ligger i referensens spann: 0 % = på P10, 100 % = på P90; under 0 eller över 100 betyder utanför spannet. `
            + `${stor(T.enhet.fl)} med färre än ${k} ${personOrd(k)} står med antal men utan lönemått, och med färre än ${vm.antalMin} utelämnas de; de räknas alltid in i ${genitiv(T.niva.bf)} rader. `
            + `Könsuppdelade mått redovisas bara där varje kön har minst ${k} ${personOrd(k)}.`],
        [],
        [`${stor(T.enhet.fl)} mot sitt spann`],
        [stor(T.niva.en), 'AID', stor(T.namn.en), 'Antal', 'Median (kr)', 'Referensens P10 (kr)', 'Referensens P90 (kr)', 'Position (%)', 'Under P10 (antal)', 'Referensnivå']
    ];
    const utelamnade = [];
    for (const { b, rader, utelamnade: ute } of vm.tabell) {
        for (const { g, typ, position } of rader) {
            const c = g.compliance;
            if (typ === 'ingenPolicy') ut.push([b.bas, g.aid, _lpBenamning(g), g.n, '', '', '', '', '', 'Ingen referens']);
            else if (typ === 'antal') ut.push([b.bas, g.aid, _lpBenamning(g), g.n, '', '', '', '', c ? c.under : '', g.level || '']);
            else ut.push([b.bas, g.aid, _lpBenamning(g), g.n, g.stats ? kr(g.stats.median) : '', kr(g.pol.p10), kr(g.pol.p90),
                position != null ? r1(position) : '', c ? c.under : '', g.level || '']);
        }
        utelamnade.push(...ute.map(_lpGruppnamn));
    }
    if (utelamnade.length) ut.push([`Visas inte (färre än ${vm.antalMin} ${personOrd(vm.antalMin)}): ${utelamnade.join(', ')}.`]);

    // Läget i spannet per kön: bara BAS-intervall där varje kön når tröskeln (samma villkor som hanteldiagrammet).
    ut.push([], [`Läget i spannet per kön, per ${T.niva.en} (genomsnittlig position: 0 % = P10, 100 % = P90)`],
        [stor(T.niva.en), 'Antal kvinnor', 'Antal män', 'Kvinnors läge (%)', 'Mäns läge (%)', 'Skillnad kvinnor − män (procentenheter)']);
    for (const b of vm.konPosition.visade) {
        const gg = b.genderGap;
        ut.push([b.bas, gg.nKv, gg.nMa, r1(gg.kvPos * 100), r1(gg.maPos * 100), r1(gg.diff * 100)]);
    }
    if (vm.konPosition.dolda.length) ut.push([`Visas inte (ett kön har färre än ${k} ${personOrd(k)}, eller spannet är inte användbart): ${vm.konPosition.dolda.join(', ')}.`]);

    // Tredjedelarna: hela urvalet, som kortet i fliken — bara när båda könen når tröskeln.
    const sum = vm.konLagen;
    ut.push([], ['Fördelningen i spannets tredjedelar per kön (hela urvalet, andel av könet)'],
        ['Kön', 'Antal', ..._LP_LAGEN.map(([serie]) => `${serie} (%)`)]);
    if (sum.ok) {
        ut.push(['Kvinnor', sum.nKv, ...sum.kv.map(a => pct(a, sum.nKv))], ['Män', sum.nMa, ...sum.ma.map(a => pct(a, sum.nMa))]);
    } else ut.push([_konUtelamnatNot()]);

    // Efterlevnad per BAS-intervall: som diagrammet, intervall under tröskeln utelämnas och namnges.
    ut.push([], [`Efterlevnad per ${T.niva.en}`],
        [stor(T.niva.en), 'Antal', 'Under P10 (antal)', 'Inom spannet (antal)', 'Över P90 (antal)', 'Under P10 (%)', 'Inom spannet (%)', 'Över P90 (%)']);
    for (const b of vm.efterlevnad.visade) {
        const c = b.compliance;
        ut.push([b.bas, c.n, c.under, c.within, c.over, pct(c.under, c.n), pct(c.within, c.n), pct(c.over, c.n)]);
    }
    if (vm.efterlevnad.dolda.length) ut.push([`Visas inte (färre än ${k} ${personOrd(k)}): ${vm.efterlevnad.dolda.join(', ')}.`]);
    return ut;
}

/** Det som körs vid laddning, i filens ordning; src/app/index.js anropar delarnas uppstart i sifferordning. */
export function uppstartLonepolitik() {
    document.addEventListener('change', e => {
        if (!e.target || /** @type {HTMLElement} */ (e.target).id !== 'lp-komplians-vy') return;
        _lpEfterlevnadVy = /** @type {HTMLInputElement} */ (e.target).value === 'mitt' ? 'mitt' : 'staplad';
        if (typeof ritaLonepolitik === 'function') ritaLonepolitik();
    });
}

// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
import { _fokusfallor, meddelaSkarmlasare, slappFokus, stangAutofyll } from './01-html-och-tillganglighet.js';
import { verktygstipsSlapp } from './02-verktygstips.js';
import { visaInterntFel } from './03-hjalpfunktioner.js';
import { metodikSlapp, navigeraTill } from './05-tabeller-och-lankar.js';
import { _kVisaFel, _synkaKTroskel } from './06-k-troskel.js';
import { tillampaProfiletiketter, COST_DEFAULTS, INAKTIVITET_STANDARD_MIN, synkaNamnFalt } from './07-standardinstallningar.js';
import { _rfRensaAlla } from './10-diagramritare.js';
import { sattDiagramMarkering } from './11-markering.js';
import { nyttTillstand, state } from './12-tillstand.js';
import { ovRitaLage, ritaKravstatus, skattningarSlapp } from './13-oversikt.js';
import { _fkSlapp, _fkVantar } from './17-forhandskontroll.js';
import { _ritaDemoruta } from './20-demodata-diagnostik.js';
import { visningNy } from './23-exportgrind.js';
import { _stangBevisruta } from './27-berakningsbevis.js';
import { uppdateraDataskyddsbesked } from './25-dataskyddsinfo.js';
import { sattInaktivitetstid } from './28-vad-lagras-inaktivitet.js';
import { _fyllPaketFormular, _synkaOrgTyp, lasInInbakatPaket, organisationsfilSlapp, ritaPaketinfo } from './29-organisationspaket.js';
import { ritaFilrutor } from './32-filinlasning.js';
import { _fcGlomKnappresultat } from './36-loneoversyn.js';
import { ritaReferensKort } from './38-referensfiler.js';
import { rapportGlomHopfallning } from './39-loneoversikt.js';
import { laMinneSlapp } from './41-lika-arbete.js';
import { jamforelseSattVal } from './42-jamforelse.js';
import { harAlderSlapp } from './50-regressionsmodeller.js';
import { regKvantilSlapp } from './51-lika-arbete-regressionskort.js';
import { livscykelSlapp } from './52-livscykel.js';
import { synkaPrioFalt } from './55-prioritering.js';
import { _hpDemoNycklar } from './56-handlingsplan.js';
import { stangSkalDialog } from './57-sakliga-skal.js';
import { _rmMinneSlapp } from './58-rapportmodell.js';
import { bes8Stod, bes8Uppdatera } from './61-regler-och-praxis.js';
import { rapportunderlagSlapp } from './67-rapportunderlag.js';
import { utforskaSlappMinne, utforskaSynkaSmaLas } from './70-utforska.js';
import { stangGruppdossier } from './80-gruppdossier.js';
import { basdossierSlapp, stangBasdossier } from './81-basdossier.js';
import { dokumenteraSlapp } from './85-robusthet-fardigcheck.js';

// ---- Rensa all data: lagringsminimering (art. 5.1 e, 25.2) ----
/**
 * Tömmer all in-memory data och tar ned all renderad UI som kan innehålla
 * personuppgifter. Användaren har samma effekt om de stänger fliken — denna
 * knapp gör rensningen till en explicit, dokumenterad åtgärd. Rätten till radering utövas mot källsystemet.
 */
export function rensaAllData() {
    if (!finnsNagotAttRensa()) {
        meddelaSkarmlasare('Ingen data finns i minnet att rensa.');
        return;
    }
    if (!confirm('All data försvinner ur minnet: lönefilen, ställningstagandet, statistiken, scenarierna och ögonblicksbilden. Det går inte att ångra. Vill du fortsätta?')) return;

    _rensaAllData();
}

// ---- Det som står kvar, och om något finns att rensa ----
/**
 * Det i state som står kvar efter rensningen: inställningarna för sessionen (Prioriteringens trösklar, viktning och
 * kostnad, rensningstiden, Likvärdigt arbetes urval, förhandskontrollens stopp och Fler kolumner) och det inbakade
 * paketet. Det organisationspaketet satte (grundinställningarna och låsningarna, ADR-28 och ADR-47) går med paketet; i
 * en organisationsfil står låsningarna kvar genom demot (`_rensaAllData`).
 */
function _kvarVidRensning(fore, nytt) {
    return {
        prioConfig: fore.prioConfig, prioWeights: fore.prioWeights, inactivityTimeoutMin: fore.inactivityTimeoutMin,
        forhandskontrollStopp: fore.forhandskontrollStopp, flerKolumner: fore.flerKolumner,
        paketInbakat: fore.paketInbakat, kLage: fore.kLage,   // exportläget följer exportgrindens räknare (23-exportgrind.js)
        costSettings: fore.paket ? { ...fore.costSettings, poPct: COST_DEFAULTS.poPct, months: COST_DEFAULTS.months } : fore.costSettings,
        likvardighet: { ...nytt.likvardighet, kvinnoTrosholdPct: fore.likvardighet.kvinnoTrosholdPct, kvDomDefinition: fore.likvardighet.kvDomDefinition,
            minGapPct: fore.likvardighet.minGapPct, topN: fore.likvardighet.topN, jamforelse: fore.paket ? nytt.likvardighet.jamforelse : fore.likvardighet.jamforelse },
    };
}
// Finns något att rensa: en fil som väntar på Läs in, eller något i state (utom det som står kvar) som skiljer sig från
// läget efter en rensning. Läget sparas vid start, med det inbakade paketet i en organisationsfil (90-uppstart.js), och
// efter varje rensning. En regel för knappen och för rensningen vid inaktivitet (28-vad-lagras-inaktivitet.js).
let _rensatLage = '';
function _tillstandText() {
    const kvar = new Set(Object.keys(_kvarVidRensning(state, state)));
    return JSON.stringify(state, function (k, v) {
        if (this === state && kvar.has(k)) return undefined;
        return v instanceof Set || v instanceof Map ? [...v] : v;
    });
}
export function sparaRensatLage() { _rensatLage = _tillstandText(); }
export function finnsNagotAttRensa() { return !!_fkVantar || _tillstandText() !== _rensatLage; }

// ---- Sidan som vid start ----
// Rensningen ställer tillbaka dokumentet som det var när verktyget hade startat, före all data: varje element som fanns
// då får tillbaka sina attribut, sitt innehåll, sitt fältvärde och sina egenskaper, och allt som ritats till efteråt tas
// bort. Elementen är desamma, så att lyssnarna från starten står kvar. Så behövs ingen lista över behållare: en ny vy
// töms utan att någon kommer ihåg den. Ett <template> eller <script> som tillkommit står kvar: i en webbläsare ligger det
// inbakade organisationspaketet efter skriptet och finns inte i dokumentet när starten körs.
/** @type {Map<Node, Node>} startlägets nod → sidans */
const _startnoder = new Map();
/** @type {Map<Node, string[]>} sidans element → dess egenskaper vid start */
const _startegenskaper = new Map();
/** @type {HTMLElement|null} kopian av body vid start */
let _startmall = null;
/** Sparar startläget; anropas sist i starten (90-uppstart.js), före demot och det inbakade paketet. */
export function sparaStartlage() {
    const para = (sida, mall) => {
        _startnoder.set(mall, sida);
        _startegenskaper.set(sida, Object.keys(sida));
        mall.childNodes.forEach((m, i) => para(sida.childNodes[i], m));
    };
    stangAutofyll(document.body);   // fälten har autocomplete av redan i startläget (observatören i 01 gör det annars strax efter)
    _startmall = /** @type {HTMLElement} */ (document.body.cloneNode(true));
    para(document.body, _startmall);
    _startmall.querySelector('#boot-splash')?.remove();   // startskärmen tas bort strax efter starten (00-sakerhet-och-uppstart.js)
}
function _aterstall(sida, mall) {
    if (sida.nodeType !== 1) { if (sida.nodeValue !== mall.nodeValue) sida.nodeValue = mall.nodeValue; return; }
    for (const { name } of [...sida.attributes]) if (!mall.hasAttribute(name)) sida.removeAttribute(name);
    // Stilen sätts genom CSSOM: CSP:n (style-src-attr 'none') stoppar ett stilattribut som sätts med setAttribute.
    for (const { name, value } of mall.attributes) if (sida.getAttribute(name) !== value) { if (name === 'style') sida.style.cssText = value; else sida.setAttribute(name, value); }
    const fran = _startegenskaper.get(sida) || [];
    for (const k of Object.keys(sida)) if (!fran.includes(k)) delete sida[k];   // t.ex. att exportmenyn är kopplad
    const barn = [...mall.childNodes].map(m => { const n = /** @type {Node} */ (_startnoder.get(m)); _aterstall(n, m); return n; });
    for (const n of sida.childNodes) if ((n.nodeName === 'TEMPLATE' || n.nodeName === 'SCRIPT') && !barn.includes(n)) barn.push(n);
    if (barn.length !== sida.childNodes.length || barn.some((n, i) => n !== sida.childNodes[i])) sida.replaceChildren(...barn);
    if (sida.nodeName === 'SELECT') [...mall.options].forEach((o, i) => { sida.options[i].selected = o.selected; });
    else if (sida.nodeName === 'INPUT') { if (sida.type === 'checkbox' || sida.type === 'radio') sida.checked = mall.checked; else sida.value = mall.value; }
    else if (sida.nodeName === 'TEXTAREA') sida.value = mall.value;
}

/**
 * Själva rensningen, utan bekräftelsefråga. Enda rensningsvägen: används av
 * knappen "Rensa all data" och av den automatiska rensningen vid inaktivitet,
 * så att de aldrig kan glida isär. Efter rensningen är fönstret som ett färskt fönster (utom inställningarna nedan):
 * det vaktas av invarianten "Rensa all data: fönstret är som ett färskt fönster" i tests/dataskydd-app.test.js, som
 * jämför dokumentet, formulärfälten, state och toppnivåminnena mot ett nytt fönster, för båda vägarna.
 * Med `inbakat: false` (demot och ett paket som läses in i demoläget) läses organisationsfilens paket inte in igen,
 * men dess låsningar (ADR-47) står kvar: demot får inte vara en väg runt dem.
 */
export function _rensaAllData({ inbakat = true } = {}) {
    visningNy();   // också rensningen efter en tid utan aktivitet: ingen ritad flik visas igen (ADR-81)
    // 1. Delarnas egna minnen: var och en släpper sitt.
    laMinneSlapp();
    _rmMinneSlapp();
    utforskaSlappMinne();
    rapportGlomHopfallning();
    _fcGlomKnappresultat();
    skattningarSlapp();   // skattningarna vid andra golv (ADR-103)
    _fkSlapp();   // förhandskontrollen och en fil som väntar på Läs in
    metodikSlapp();
    harAlderSlapp();
    regKvantilSlapp();
    livscykelSlapp();
    basdossierSlapp();
    dokumenteraSlapp();
    rapportunderlagSlapp();
    organisationsfilSlapp();
    _hpDemoNycklar.clear();
    // Dialogerna stängs: en öppen dialog får inte stå kvar på skärmen efter rensningen vid inaktivitet. De med en
    // grupps tal har egna stängningar; övriga släpper sin fokusfälla, och sidan nedan döljer dem.
    for (const stang of [stangGruppdossier, stangBasdossier, _stangBevisruta, stangSkalDialog]) stang();
    for (const modal of [..._fokusfallor.keys()]) slappFokus(modal);
    // Diagram ritade med diagramkärnan (ADR-39) bär sin figur på behållaren och har lyssnare och storleksbevakning;
    // de hittas genom ritarens register, också de som har lämnat dokumentet.
    sattDiagramMarkering(null);   // markeringen namnger en grupp
    _rfRensaAlla();
    verktygstipsSlapp();

    // 2. State som vid start (12-tillstand.js), utom det som står kvar (_kvarVidRensning).
    const nytt = nyttTillstand(), kvar = _kvarVidRensning(state, nytt);
    if (!inbakat && state.paketInbakat) kvar.paketLas = state.paketLas;
    const inaktivitetVarLast = state.paketLas.inaktivitetMin != null && !kvar.paketLas;
    for (const k of Object.keys(state)) delete state[k];
    Object.assign(state, nytt, kvar);
    if (inaktivitetVarLast) sattInaktivitetstid(INAKTIVITET_STANDARD_MIN);   // en låst rensningstid går tillbaka till standard

    // 3. Sidan som vid start. Flikbytet först: det stryker det som väntar på att ritas i en annan flik.
    navigeraTill('dashboard');
    _aterstall(document.body, _startmall);
    synkaPrioFalt();
    utforskaSynkaSmaLas();
    _kVisaFel('');
    _synkaKTroskel();
    tillampaProfiletiketter();
    _synkaOrgTyp();
    synkaNamnFalt();
    jamforelseSattVal({ bas: '', sektor: '' });
    ritaPaketinfo();
    _fyllPaketFormular();
    _ritaDemoruta();
    visaInterntFel();
    bes8Uppdatera();
    bes8Stod();
    ovRitaLage();   // Översikt blir åter en uppladdningssida
    ritaReferensKort();
    ritaFilrutor();
    uppdateraDataskyddsbesked();
    ritaKravstatus();
    meddelaSkarmlasare('All data har raderats ur minnet.');
    // Organisationsfil: paketet är en del av filen och kommer tillbaka efter rensningen, som vid start.
    if (inbakat) lasInInbakatPaket();
    sparaRensatLage();
    visningNy();   // och det som ritades under rensningen visas inte igen heller
}

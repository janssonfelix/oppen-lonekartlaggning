// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
import { meddelaSkarmlasare, esc, stangAutofyll } from './01-html-och-tillganglighet.js';
import { rapporteraFel } from './03-hjalpfunktioner.js';
import { navigeraTill } from './05-tabeller-och-lankar.js';
import { kInstalld } from './06-k-troskel.js';
import { _rfBehallare, rensaFigur } from './10-diagramritare.js';
import { _mkTabeller, diagramMarkering } from './11-markering.js';
import { hamtaData, state } from './12-tillstand.js';
import { fyllValjare, ritaFilerDelar, ritaOversiktDelar, ritaUnderlagetsKvalitet, ritaKravstatus, ritaNyckeltal } from './13-oversikt.js';
import { ritaForhandskontroll } from './17-forhandskontroll.js';
import { _exportDjup, _ritadVid, _ritasNu, medExportLage, ritGeneration, visningNy, visningsversion } from './23-exportgrind.js';
import { ritaLikvardigtArbete } from './34-likvardigt-arbete.js';
import { ritaLoneoversyn } from './36-loneoversyn.js';
import { ritaStruktur, ritaStrukturUtkast } from './37-struktur.js';
import { synkaJamforelseFlik } from './38-referensfiler.js';
import { ritaLoneoversikt } from './39-loneoversikt.js';
import { ritaAldersstruktur, ritaAlderOchLon } from './40-alder-karriar.js';
import { laVymodell, lsBasVymodell, ritaLikaArbeteTopp, ritaLonestrukturNycklar, ritaLikaArbete, ritaLoneskillnadPerBas } from './41-lika-arbete.js';
import { byggJamforelse, ritaStatistikLage } from './42-jamforelse.js';
import { ritaPersonerAttGranska } from './43-personer-att-granska.js';
import { ritaReferensOverblick } from './44-referensoverblick.js';
import { ritaAidBasLika, ritaAidBasLikvardigt } from './45-aid-bas-tabeller.js';
import { harAlder } from './50-regressionsmodeller.js';
import { ritaBlinderOaxacaKort, ritaRegressionskort, korOLSRegression } from './51-lika-arbete-regressionskort.js';
import { ritaLivscykel } from './52-livscykel.js';
import { ritaPrioritering } from './55-prioritering.js';
import { ritaHandlingsplan } from './56-handlingsplan.js';
import { ritaExportBesked } from './59-exportbesked.js';
import { bes8Stod, bes8Uppdatera } from './61-regler-och-praxis.js';
import { ritaOmVerktyget } from './65-om-verktyget.js';
import { ritaRapportunderlag } from './67-rapportunderlag.js';
import { ritaGapUppdelning } from './68-var-uppstar-gapet.js';
import { ritaUtforska } from './70-utforska.js';
import { ritaArsjamforelse } from './73-arsbokslut.js';
import { utAllaDiagramVidRitning, utVisaUnderflikFor } from './74-alla-diagram.js';
import { ritaLonepolitik } from './75-lonepolitik.js';
import { ritaKvalitetssakring } from './85-robusthet-fardigcheck.js';
import { sidindexBygg } from './89-sidindex.js';

/** Visar Filer och kvalitet, rullar fram filkortet `kortId`, ger dess filväljare fokus, markerar kortet en stund och läser upp `text`. */
export function _visaFilkortet(kortId, inputId, text) {
    const filer = document.querySelector('.nav-item[data-tab="filer"]');
    if (filer && !filer.classList.contains('active')) /** @type {HTMLElement} */ (filer).click();
    const kort = document.getElementById(kortId);
    if (!kort) return;
    kort.scrollIntoView?.({ block: 'center' });
    kort.classList.add('visas-nu');
    setTimeout(() => kort.classList.remove('visas-nu'), 2000);
    document.getElementById(inputId)?.focus?.({ preventScroll: true });
    meddelaSkarmlasare(text);
}
/** En låst flik har klickats: visa lönefilskortet i Filer och kvalitet. */
export function visaLonefilskortet(flikNamn) {
    _visaFilkortet('upload-cell-data', 'file-input-data',
        `${flikNamn ? flikNamn + ' kräver ett underlag. ' : ''}Läs in lönefilen här under Filer och kvalitet, så låses flikarna upp.`);
}
/** Lönefilen är inläst men Löneläget kräver en referens eller jämförelsestatistik (38-referensfiler.js): visa
 *  referenskortet (ställningstagandet, annars jämförelsestatistiken) i Filer och kvalitet. */
export function visaReferenskortet(namn) {
    const policy = !!document.getElementById('upload-cell-policy');
    _visaFilkortet(policy ? 'upload-cell-policy' : 'upload-cell-stat', policy ? 'file-input-policy' : 'file-input-stat',
        `${namn ? namn + ' kräver en referens eller jämförelsestatistik. ' : ''}Läs in ett lönepolitiskt ställningstagande eller jämförelsestatistik här under Filer och kvalitet, så visas fliken Löneläget.`);
}
/** Ålder & karriär är låst för att lönefilen saknar ålder (ADR-64): visa lönefilskortet och säg varför. */
export function visaAlderskravet(flikNamn) {
    _visaFilkortet('upload-cell-data', 'file-input-data',
        `${flikNamn || 'Ålder & karriär'} kräver ålder i lönefilen. Lägg till en kolumn med ålder och läs in filen igen.`);
}
/** Fliken Ålder & karriär kräver ålder i lönefilen (ADR-64). Med en lönefil utan ålder är den låst som de andra
 *  låsta flikarna, med tipset "Kräver ålder i lönefilen"; klicket leder till lönefilskortet med det skälet. */
function synkaAlderFlik() {
    const el = /** @type {HTMLElement|null} */ (document.getElementById('tab-kon'));
    if (!el || !state.data.length) return;
    const las = !harAlder();
    /** @type {HTMLInputElement} */ (/** @type {unknown} */ (el)).disabled = las;
    if (las) {
        el.dataset.kraver = 'alder';
        el.setAttribute('title', 'Kräver ålder i lönefilen');
        if (el.classList.contains('active')) /** @type {HTMLElement|null} */ (document.querySelector('.nav-item[data-tab="dashboard"]'))?.click();
    } else if (el.dataset.kraver) {
        delete el.dataset.kraver;
        const tip = el.getAttribute('data-tip');
        if (tip) el.setAttribute('title', tip); else el.removeAttribute('title');
    }
}

// ---- Flikbytet: rita först, räkna sedan (ADR-80) ----
// När användaren själv byter flik (ett klick i menyn, pilarna i menyn, sökfältet, en länk till en flik) blir fliken
// synlig och sidan målas innan fliken räknas. Under tiden står en rad om att fliken räknas, och det som stod i panelen
// sedan förra gången döljs (aria-busy, style.css), så att inget inaktuellt tal syns. Block som tar lång tid och inte
// syns överst (_ritaTungtBlock) ritas efteråt, vart och ett i en egen uppgift, med en platshållare. Ett nytt flikbyte
// under väntan går före: bara den sist valda fliken ritas.
// Allt annat ritar som förut, synkront: ritaFlik anropad direkt (testerna, exportgrinden, exporterna och
// medExportLage, omritningen efter ändrad tröskel) och ett klick från koden (el.click()), som inte är användarens
// eget. Inget resultat sparas mellan uppgifterna (ADR-17): ett block räknas i sin egen uppgift ur det som gäller då,
// och ritar ingenting om underlaget, tröskeln, förhandsvisningen, ett val eller fliken har ändrats sedan fliken ritades.
/** @type {{uppskjut: boolean, efter: (() => void)|null}|null} */
let _nastaFlikbyte = null;
/**
 * Byter till fliken med ett klick på dess knapp i menyn, så att allt som lyssnar på klicket följer med.
 * @param {Element} nav knappen i menyn
 * @param {{uppskjut?: boolean, efter?: (() => void)|null}} [val] uppskjut: visa fliken först och räkna den sedan;
 *   efter: körs när fliken är färdigritad (direkt efter ritningen när den inte skjuts upp)
 */
export function klickaFlik(nav, { uppskjut = false, efter = null } = {}) {
    _nastaFlikbyte = { uppskjut, efter };
    try { /** @type {HTMLElement} */ (nav).click(); } finally { _nastaFlikbyte = null; }
}
let _flikVal = 0;                   // ökar vid varje flikbyte: en väntande ritning av en tidigare vald flik ritar inget
const _flikRunda = new Map();       // flik → numret på flikens senaste ritning (ritaFlik, yttersta anropet)
/** @type {string|null} */
let _uppskjutNasta = null;          // fliken vars nästa ritning kommer från ett uppskjutet flikbyte
/** @type {string|null} */
let _ritasUppskjutet = null;        // fliken som ritas från ett uppskjutet flikbyte just nu: dess tunga block väntar
/** @type {Map<string, {runda: number, antal: number, efter: (() => void)[]}>} */
const _vantandeBlock = new Map();   // flik → block som väntar från flikens senaste ritning
/** @type {{flik: string, runda: number, hosts: HTMLElement[], fn: () => void, fangst: any}[]} */
const _blockKo = [];
/** @type {any} */
let _blockTimer = 0;
let _valRaknare = 0;                // användarens egna val (change), som kan ändra det ett väntande block skulle rita
const FLIK_RAKNAS_TEXT = 'Räknar fram fliken …';
const BLOCK_RAKNAS_TEXT = 'Räknar …';

/**
 * Ritar fliken efter ett byte: utan `uppskjut` direkt, som ritaFlik; med `uppskjut` när sidan har målats.
 * @param {string} target
 * @param {{uppskjut?: boolean, efter?: (() => void)|null}} [val]
 */
function flikbyte(target, { uppskjut = false, efter = null } = {}) {
    const val = ++_flikVal, flik = flikMal(target);
    document.querySelectorAll('.view-panel[aria-busy]').forEach(p => _flikRaknas(/** @type {HTMLElement} */ (p), false));
    if (!uppskjut) { ritaFlik(target); if (efter) efter(); return; }
    // En färdigritad flik som ingenting har ändrat visas som den är (ADR-81).
    if (_visasSomRitad(flik)) { _visaRitad(flik); if (efter) efter(); return; }
    const paneler = /** @type {HTMLElement[]} */ ((PANELGRUPPER[flik] || [flik]).map(p => document.getElementById('view-' + p)).filter(Boolean));
    paneler.forEach(p => _flikRaknas(p, true));
    _efterMalning(() => {
        if (val !== _flikVal) return;   // ett senare flikbyte går före
        _uppskjutNasta = flik;
        try { ritaFlik(target); }
        catch (e) { rapporteraFel(`flikbytet (${flik})`, e); }
        finally { _uppskjutNasta = null; paneler.forEach(p => _flikRaknas(p, false)); }
        if (!efter) return;
        const v = _vantandeBlock.get(flik);
        if (v && v.runda === _flikRunda.get(flik)) v.efter.push(efter); else efter();
    });
}
/** Panelen räknas (aria-busy och en rad överst) eller är klar. Det som stod i panelen döljs under tiden (style.css). */
function _flikRaknas(panel, pa) {
    let rad = panel.querySelector(':scope > .flik-raknas');
    if (!pa) { panel.removeAttribute('aria-busy'); rad?.remove(); return; }
    panel.setAttribute('aria-busy', 'true');
    if (rad || panel.style.display === 'none') return;
    rad = document.createElement('p');
    rad.className = 'flik-raknas';
    rad.setAttribute('role', 'status');
    rad.textContent = FLIK_RAKNAS_TEXT;
    panel.insertBefore(rad, panel.firstChild);
}
/** Kör fn när sidan har målats: efter nästa bildruta, eller efter en kort stund om sidan inte målas (en dold webbläsarflik). */
function _efterMalning(fn) {
    let gjort = false;
    const kor = () => { if (!gjort) { gjort = true; fn(); } };
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => setTimeout(kor, 0));
    setTimeout(kor, 100);
}
/** Det som ett väntande block ritas ur. Ändras något av det under väntan ritar blocket ingenting. */
function _blockFangst() {
    return { data: state.data, k: kInstalld(), forhand: document.body.classList.contains('forhandsvisning'), val: _valRaknare };
}
function _sammaFangst(f) {
    const nu = _blockFangst();
    return f.data === nu.data && f.k === nu.k && f.forhand === nu.forhand && f.val === nu.val;
}
export function _aktivFlik() {
    const a = document.querySelector('.nav-item.active')?.getAttribute('data-tab');
    return a ? flikMal(a) : null;
}
/**
 * Ett block i fliken som tar lång tid och inte syns överst. Ritas fliken från ett uppskjutet flikbyte får blocket en
 * platshållare och ritas i en egen uppgift när fliken har målats; annars ritas det direkt, som förut.
 * @param {string} flik fliken blocket hör till
 * @param {string[]} hostIds behållarna som blocket ritar i (platshållaren står i dem under väntan)
 * @param {() => void} fn ritar blocket
 */
export function _ritaTungtBlock(flik, hostIds, fn) {
    const hosts = _ritasUppskjutet === flik && hamtaData().length   // utan underlag finns inget att räkna
        ?/** @type {HTMLElement[]} */ (hostIds.map(id => document.getElementById(id)).filter(Boolean)) : [];
    if (!hosts.length) { fn(); return; }
    for (const h of hosts) {
        if (typeof _rfBehallare !== 'undefined' && _rfBehallare.has(h)) rensaFigur(h);
        h.innerHTML = `<span class="block-raknas">${BLOCK_RAKNAS_TEXT}</span>`;   // en span: några behållare är stycken
        h.setAttribute('aria-busy', 'true');
    }
    const runda = _flikRunda.get(flik) || 0, v = _vantandeBlock.get(flik);
    if (v && v.runda === runda) v.antal++; else _vantandeBlock.set(flik, { runda, antal: 1, efter: [] });
    _blockKo.push({ flik, runda, hosts, fn, fangst: _blockFangst() });
    _schemalaggBlock();
}
// Varje block väntar tills sidan har målats, så att det som redan är ritat syns innan nästa block räknas.
function _schemalaggBlock(ms = 0) {
    if (_blockTimer) return;
    _blockTimer = 1;
    if (ms) setTimeout(() => _efterMalning(_korNastaBlock), ms); else _efterMalning(_korNastaBlock);
}
function _korNastaBlock() {
    _blockTimer = 0;
    const b = _blockKo.shift();
    try { if (b) _ritaVantandeBlock(b); }
    catch (e) { rapporteraFel('flikbytet: ett block som ritas efter fliken', e); }
    finally { if (_blockKo.length) _schemalaggBlock(); }
}
/** Blocket ritas inte: platshållaren och aria-busy tas bort ur behållarna. */
function _slappBlock(b) {
    for (const h of b.hosts) { h.removeAttribute('aria-busy'); h.querySelector(':scope > .block-raknas')?.remove(); }
}
function _ritaVantandeBlock(b) {
    const v = _vantandeBlock.get(b.flik);
    // Fliken har ritats om sedan blocket köades: den nya ritningen äger behållarna (ritaFlik har släppt dem).
    if (!v || v.runda !== b.runda || _flikRunda.get(b.flik) !== b.runda) return;
    // Användaren har gått vidare: fliken är inte färdigritad (exportgrinden ritar om den) och ritas på nytt när den öppnas.
    if (_aktivFlik() !== b.flik) { _vantandeBlock.delete(b.flik); _blockKo.filter(x => x.flik === b.flik).concat(b).forEach(_slappBlock); return; }
    // En export pågår (den ritar i exportläget): blocket väntar tills den är klar.
    if (_exportDjup > 0) { _blockKo.unshift(b); _schemalaggBlock(50); return; }
    // Underlaget, tröskeln, förhandsvisningen eller ett val har ändrats under väntan: ingenting ur den här ritningen
    // ritas. Står platshållaren kvar (ingen annan har ritat om blocket) ritas fliken om från början.
    if (!_sammaFangst(b.fangst)) {
        _vantandeBlock.delete(b.flik);
        const kvar = b.hosts.some(h => h.isConnected && h.querySelector(':scope > .block-raknas'));
        _blockKo.filter(x => x.flik === b.flik).concat(b).forEach(_slappBlock);
        if (kvar) flikbyte(b.flik, { uppskjut: true, efter: v.efter.length ? () => v.efter.forEach(f => f()) : null });
        return;
    }
    const egen = !_ritasNu.has(b.flik);
    _ritasNu.add(b.flik);   // blocket får läsa sin egen fliks diagram (exportgrinden)
    try { b.fn(); }
    catch (e) { rapporteraFel(`${b.flik}: ett block som ritas efter fliken`, e); }
    finally {
        if (egen) _ritasNu.delete(b.flik);
        _slappBlock(b);
    }
    if (--v.antal > 0) return;
    _vantandeBlock.delete(b.flik);
    _ritadVid.set(b.flik, ritGeneration());   // nu är hela fliken ritad med det som gäller (exportgrinden)
    _visningRitad(b.flik);
    _efterRitning(b.flik);
    for (const f of v.efter) { try { f(); } catch (e) { rapporteraFel('flikbytet: efter ritningen', e); } }
}
// ---- En färdigritad flik visas igen (ADR-81) ----
// När användaren byter tillbaka till en flik som är färdigritad och ingenting har hänt sedan dess som kan ändra det den
// visar, visas den som den är, utan omritning. Det som återanvänds är flikens ritade innehåll i sidan, aldrig ett räknat
// resultat (ADR-17): regressionen och allt annat räknas om varje gång fliken ritas. Villkoren, alla på en gång:
//  - visningsversionen (23-exportgrind.js) är densamma som när fliken ritades klart: ingen inmatning utom ren
//    navigering, ingen ny generation (tröskeln, förhandsvisningen, underlaget, modellvalen), ingen inläsning,
//    rensning eller bakgrundsberäkning som blivit klar;
//  - fliken har inte ritats om sedan dess (dess generation i exportgrinden är densamma), och inga block väntar;
//  - läget (skärm eller export, förhandsvisningen) och dagen är desamma.
// Bara användarens flikbyte (det uppskjutna, ADR-80) visar en flik igen. ritaFlik anropad direkt, exportläget,
// exportgrinden och klick från koden ritar alltid. Exportgrinden ser fliken som förut: den räknas som aktuell bara när
// den ritats i den generation som gäller.
/** @type {Map<string, {v: number, g: number, lage: string}>} */
const _visadSom = new Map();   // flik → visningsversion, generation och läge när fliken senast ritades klart
function _visningsLage() {
    return `${state.kLage}|${document.body.classList.contains('forhandsvisning')}|${new Date().toDateString()}`;
}
/** Fliken är färdigritad: den visas igen så länge ingenting har ändrats. */
function _visningRitad(flik) { _visadSom.set(flik, { v: visningsversion(), g: ritGeneration(), lage: _visningsLage() }); }
function _visasSomRitad(flik) {
    const r = _visadSom.get(flik);
    return !!r && r.v === visningsversion() && _ritadVid.get(flik) === r.g && r.lage === _visningsLage()
        && !_vantandeBlock.has(flik) && !_ritasNu.has(flik);
}
/** Visar fliken som den är ritad och gör det som görs efter en ritning: navigeringen längst ned, sidindexet, markeringen i tabellerna. */
function _visaRitad(flik) {
    if (_aktivFlik() === flik) { ritaNastaSteg(flik); sidindexBygg(flik); }
    _efterRitning(flik);
}
// Det som räknas som en ändring: varje click, change, input, keydown, drop, paste och pointerup i sidan (också i
// sidhuvudet och i dialogerna, och också de som koden skickar), utom ren navigering: menyns knappar och pilar, knappen
// och skuggan för menyn på smala skärmar, sidindexets länkar, sökfältet (ett val i träfflistan som gör något annat än
// att byta flik räknas i sokValj) och tangenter som bara flyttar fokus eller rullar sidan.
const _VISNING_HANDELSER = ['click', 'change', 'input', 'keydown', 'drop', 'paste', 'pointerup'];
const _VISNING_NAVIGERING = '.nav-item, #btn-meny, #meny-skugga, #sidindex, #sok-ruta';
const _TANGENT_FOKUS = new Set(['Tab', 'Shift', 'Control', 'Alt', 'Meta', 'CapsLock', 'PageUp', 'PageDown']);
const _TANGENT_RULLA = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End', ' ']);
/** @param {Event} e */
function _visningAndras(e) {
    const el = /** @type {any} */ (e.target);
    if (el && typeof el.closest === 'function' && el.closest(_VISNING_NAVIGERING)) return false;
    if (e.type !== 'keydown') return true;
    const tangent = /** @type {KeyboardEvent} */ (e).key;
    if (_TANGENT_FOKUS.has(tangent)) return false;
    // Pilar, Home, End och mellanslag rullar sidan när ingenting i den har fokus; i ett fält eller en kontroll räknas de.
    return !(_TANGENT_RULLA.has(tangent) && (!el || el === document || el === document.body || el === document.documentElement));
}

/** Det som görs när en flik har ritats: markeringen i tabellerna och autocomplete på nya fält. */
function _efterRitning(flik) {
    if (typeof _mkTabeller === 'function' && diagramMarkering()) _mkTabeller();
    // Fält som fliken skapade får autocomplete="off" redan nu (observatören i 01-html-och-tillganglighet.js
    // gör det annars strax efter).
    if (typeof stangAutofyll === 'function') stangAutofyll(document.getElementById('view-' + flik) || document);
}

// ---- Tabs ----
// Sammanslagna flikar: en nav-knapp kan visa/rendera flera view-paneler.
// Panelerna ligger redan i rätt DOM-ordning (skevhet före matrix, kon före livscykel).
export const PANELGRUPPER = {
    matrix:      ['lika-yrken'],                       // Lika arbete: yrkesgrupperna, personer att granska, AID × BAS
    struktur:    ['struktur', 'skevhet', 'regression'], // Lönestruktur: fördelning, BAS-skevhet, vad som blir kvar (regression/Oaxaca)
    kon:         ['kon', 'demografi', 'livscykel'],  // Ålder & karriär: kurvor per kön, demografi, gap över karriären
    utforska:    ['rapport', 'utforska'],            // Tabeller och egna vyer: Löneöversikten (fast tabell) + egna vyer
    dokumentera: ['kvalitet', 'dokumentera']         // Exportera: färdigcheck + robusthet + export
};
// Flikalias: namnen leds om till fliken som visar innehållet, så att inga länkar dör.
const FLIKALIAS = { rapport: 'utforska', demografi: 'kon', kvalitet: 'dokumentera', lonepolitik: 'benchmark', skevhet: 'struktur', regression: 'struktur', spara: 'arbetet' };
export function flikMal(namn) { return FLIKALIAS[namn] || namn; }
export function lasUppFlikar() {
    ['tab-kon','tab-matrix','tab-prioritering','tab-loneoversyn','tab-struktur','tab-likvardighet','tab-utforska','tab-rapporttext'].forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        /** @type {HTMLInputElement} */ (el).disabled = false;
        // Låst läge visar "ladda upp först" i title. När fliken låses upp byts den
        // mot flikens egen förklaring (data-tip) — där lagrum/paragrafer bor, så
        // etiketten kan vara på klarspråk.
        const tip = el.getAttribute('data-tip');
        if (tip) el.setAttribute('title', tip); else el.removeAttribute('title');
    });
    synkaJamforelseFlik();
    synkaAlderFlik();
}

// Enda källan för "rendera innehållet i flik X". Anropas både av nav-klick och
// av uppdateraAktivFlik() så att de två aldrig glider isär. Datakrävande flikar
// gatas på hamtaData().length; info-fliken renderar sin egen tomstatus.
// Sammanslagna flikar renderar bägge sina paneler (matrix→skevhet+regression,
// kon→kurvor+livscykel).
// Länkade vyer (11-markering.js): när en flik har ritats om framhävs dess tabellrader för de markerade grupperna.
// Ett uppskjutet flikbyte (flikbyte ovan) ritar här som alla andra; bara flikens tunga block väntar (_ritaTungtBlock).
export function ritaFlik(target) {
    const flik = flikMal(target), yttre = !_ritasNu.has(flik);
    _ritasNu.add(flik);
    // Varje yttersta ritning är en ny runda: block som väntar från en tidigare ritning av fliken ritar inget.
    const runda = yttre ? (_flikRunda.get(flik) || 0) + 1 : (_flikRunda.get(flik) || 0);
    if (yttre) { _flikRunda.set(flik, runda); _vantandeBlock.delete(flik); _blockKo.filter(b => b.flik === flik).forEach(_slappBlock); _visadSom.delete(flik); }
    const uppskjut = yttre && _uppskjutNasta === flik, forra = _ritasUppskjutet;
    if (uppskjut) { _uppskjutNasta = null; _ritasUppskjutet = flik; }
    try {
        const ut = _ritaFlik(target);
        // Exportgrinden (23-exportgrind.js): fliken är ritad med det som gäller nu, eller inte färdigritad när block väntar.
        // Visningsminnet (ADR-81): en färdigritad flik kan visas igen så länge ingenting ändras.
        if (uppskjut && _vantandeBlock.get(flik)?.runda === runda) { _ritadVid.delete(flik); _visadSom.delete(flik); }
        else { _ritadVid.set(flik, ritGeneration()); _visningRitad(flik); }
        return ut;
    }
    finally {
        if (uppskjut) _ritasUppskjutet = forra;
        if (yttre) _ritasNu.delete(flik);
        _efterRitning(flik);
    }
}
// Flikar som bara har något att visa när lönefilen är inläst. Nås en sådan utan underlag (en direktlänk, en
// konfigurationsfil) säger en rad överst vad som saknas, i stället för tomma rader.
const KRAVER_UNDERLAG = ['kon', 'matrix', 'prioritering', 'struktur', 'loneoversyn', 'utforska', 'benchmark', 'rapporttext'];
function _ritaIngetUnderlag(target, tomt) {
    const vy = document.getElementById('view-' + ((PANELGRUPPER[target] || [target])[0]));
    if (!vy) return;
    let rad = vy.querySelector(':scope > .inget-underlag');
    if (!tomt || !KRAVER_UNDERLAG.includes(target)) { rad?.remove(); return; }
    if (rad) return;
    rad = document.createElement('p');
    rad.className = 'urvalsrad inget-underlag';
    rad.setAttribute('role', 'status');
    rad.innerHTML = 'Inget underlag inläst — <a href="#" data-go-to-tab="filer">läs in lönefilen under Filer och kvalitet</a>.';
    vy.insertBefore(rad, vy.firstChild);
}
/** Ålder & karriär med en lönefil utan ålder (ADR-64), t.ex. via en direktlänk: en rad överst säger varför fliken är tom. */
function _ritaUtanAlder(target, utan) {
    const vy = document.getElementById('view-' + ((PANELGRUPPER[target] || [target])[0]));
    if (!vy) return;
    let rad = vy.querySelector(':scope > .utan-alder');
    if (!utan) { rad?.remove(); return; }
    if (rad) return;
    rad = document.createElement('p');
    rad.className = 'k-mask-note utan-alder';   // inte urvalsrad: den töms av tomFlikarUtom
    rad.setAttribute('role', 'status');
    rad.textContent = 'Lönefilen saknar ålder: Ålder & karriär kräver ålder i lönefilen. Analysen i de andra flikarna körs utan åldersjustering.';
    vy.insertBefore(rad, vy.firstChild);
}
function _ritaFlik(target) {
    target = flikMal(target);
    const d = hamtaData();
    _ritaIngetUnderlag(target, !d.length);
    if (target === "kon") _ritaUtanAlder(target, d.length > 0 && !harAlder());
    if (target === "kon" && d.length) {
        const s = document.getElementById("bas-select-kon"); if (s) ritaAlderOchLon(/** @type {HTMLInputElement} */ (s).value); ritaLivscykel();
        const s2 = document.getElementById("bas-select-demo"); if (s2) ritaAldersstruktur(/** @type {HTMLInputElement} */ (s2).value);
    }
    else if (target === "benchmark"    && d.length) { ritaReferensOverblick(); ritaLonepolitik(); ritaStatistikLage(); byggJamforelse(); }
    else if (target === "matrix"       && d.length) {
        const reg = korOLSRegression();   // en gång i det här varvet, skickas vidare (ADR-17)
        ritaLikaArbete(laVymodell(), { reg }); ritaPersonerAttGranska(); ritaAidBasLika(); ritaLikaArbeteTopp({ reg });
    }
    else if (target === "prioritering" && d.length) ritaPrioritering();
    else if (target === "struktur"     && d.length) {
        ritaStruktur(); ritaLoneskillnadPerBas(lsBasVymodell());
        // Vad blir kvar av löneskillnaden (hopfällt från början): regressionen och kvantilregressionen ritas sist.
        _ritaTungtBlock(target, ['forklaringsmodell-panel', 'regression-card', 'blinder-oaxaca-card'], () => ritaBlinderOaxacaKort(ritaRegressionskort()));
        ritaGapUppdelning(); ritaLonestrukturNycklar();
    }
    else if (target === "loneoversyn"  && d.length) ritaLoneoversyn();
    else if (target === "likvardighet" && (d.length || state.statistik.length)) { ritaLikvardigtArbete(); ritaAidBasLikvardigt(); }
    else if (target === "utforska"     && d.length) { ritaLoneoversikt(); ritaUtforska(); utAllaDiagramVidRitning(); }
    // Allt i de tre dokumentationsflikarna lämnar verktyget och ritas i exportläget (ADR-51).
    // Rapportunderlaget (hopfällt från början) och förhandsbeskedet ritas efter flikens övre del (_ritaTungtBlock), också de i exportläget.
    else if (target === "rapporttext") medExportLage(() => { ritaStrukturUtkast(); _ritaTungtBlock(target, ['rapportunderlag-innehall'], () => medExportLage(ritaRapportunderlag)); });
    else if (target === "dokumentera") medExportLage(() => {
        if (d.length) ritaKvalitetssakring();
        _ritaTungtBlock(target, ['rapport-urval', 'besked-word', 'besked-pdf', 'besked-excel', 'besked-zip'], () => medExportLage(() => ritaExportBesked()));
    });
    else if (target === "arbetet")     medExportLage(() => { if (typeof ritaArsjamforelse === 'function') ritaArsjamforelse(); });
    else if (target === "dashboard" && d.length) ritaOversiktDelar();
    else if (target === "filer"     && d.length) ritaFilerDelar();
    else if (target === "info")  ritaOmVerktyget();
    else if (target === "handlingsplan") ritaHandlingsplan();
    else if (target === "bestammelser") { if (typeof bes8Uppdatera === 'function') bes8Uppdatera(); if (typeof bes8Stod === 'function') bes8Stod(); }
    // Förhandskontrollen står i Filer och kvalitet också medan en fil väntar på Läs in, innan något är inläst.
    if (target === "filer") ritaForhandskontroll();
    // Sidans navigering hör till fliken som visas. Ritas en annan flik (t.ex. för att
    // kopiera ett diagram därifrån) ska den synliga flikens rader inte flyttas.
    const aktiv = document.querySelector('.nav-item.active')?.getAttribute('data-tab');
    if (aktiv && flikMal(aktiv) !== target) return;
    ritaNastaSteg(target);
    sidindexBygg(target);   // 89-sidindex.js: flikens avsnitt som en lista som följer med
}

// UX: "Nästa steg"-överlämning längst ner i analysflikarna så processkänslan
// (processkartans steg) följer med in i flikarna, inte bara på Översikt.
const NASTA_STEG = {
    bestammelser: { tab: 'benchmark',     label: 'Löneläget' },
    benchmark:    { tab: 'matrix',        label: 'Lika arbete' },
    matrix:       { tab: 'likvardighet',  label: 'Likvärdigt arbete' },
    likvardighet: { tab: 'struktur',      label: 'Lönestruktur' },
    struktur:     { tab: 'kon',           label: 'Ålder & karriär' },
    kon:          { tab: 'prioritering',  label: 'Prioritering' },
    prioritering: { tab: 'loneoversyn',   label: 'Löneöversyn' },
    loneoversyn:  { tab: 'handlingsplan', label: 'Handlingsplan' },
    handlingsplan:{ tab: 'rapporttext',   label: 'Rapporttext' },
    rapporttext:  { tab: 'dokumentera',   label: 'Exportera' }
};
// Fördjupningen är valfri: ett sådant steg som är låst eller dolt hoppas över (Löneläget utan referens, allt utan underlag).
const _NASTA_STEG_VALFRIA = ['benchmark', 'kon'];
function _nastaSteg(target) {
    let next = NASTA_STEG[target];
    while (next && _NASTA_STEG_VALFRIA.includes(next.tab) && /** @type {HTMLInputElement|null} */ (document.querySelector(`.nav-item[data-tab="${next.tab}"]`))?.disabled) next = NASTA_STEG[next.tab];
    return next;
}
function ritaNastaSteg(target) {
    document.querySelectorAll('.flow-next-bar').forEach(el => el.remove());
    const next = _nastaSteg(target);
    // bestammelser (§ 8) är statisk och alltid tillgänglig; övriga kräver data
    if (!next || (target !== 'bestammelser' && target !== 'handlingsplan' && !hamtaData().length)) return;
    const view = document.getElementById('view-' + (PANELGRUPPER[target] || [target]).at(-1));
    if (!view) return;
    const bar = document.createElement('div');
    bar.className = 'flow-next-bar';
    bar.innerHTML = `<span class="flow-next-label">Klar här?</span> <span>Nästa steg i kartläggningen:</span>`
        + `<button type="button" class="flow-next-btn" data-flow-tab="${next.tab}">${esc(next.label)}</button>`;
    view.appendChild(bar);
}

export function uppdateraAktivFlik() {
    const active = document.querySelector('.nav-item.active');
    if (!active) return;
    const target = active.getAttribute('data-tab');
    ritaNyckeltal();
    fyllValjare();
    ritaKravstatus();
    ritaUnderlagetsKvalitet();
    ritaFlik(target);
}

/** Fäller ut ett avsnitt som en länk leder till: elementet självt om det är ett hopfällt avsnitt, och varje hopfällt
 *  avsnitt det ligger i. Annars landar länken på en rubrik vars innehåll inte syns. */
export function oppnaHopfallda(el) {
    if (typeof utVisaUnderflikFor === 'function') utVisaUnderflikFor(el);   // underfliken i Tabeller och egna vyer som avsnittet står i
    for (let n = el; n; n = n.parentElement) {
        if (n.tagName === 'DETAILS' && !(/** @type {HTMLDetailsElement} */ (n).open)) /** @type {HTMLDetailsElement} */ (n).open = true;
    }
}

// ---- Menyn på smala skärmar ----
// Under 640 punkter ligger menyn utanför bild (se style.css). Knappen Meny öppnar den över innehållet; den stängs
// av ett val i menyn, av Escape och av ett klick utanför. Fokus går till menyn när den öppnas och tillbaka till
// knappen när den stängs. På bredare skärmar finns knappen inte, och koden gör ingenting.
function menyOppen() { return document.body.classList.contains('meny-oppen'); }
export function sattMeny(oppen, { fokus = true } = {}) {
    const knapp = document.getElementById('btn-meny'), skugga = document.getElementById('meny-skugga');
    if (!knapp || oppen === menyOppen()) return;
    document.body.classList.toggle('meny-oppen', oppen);
    knapp.setAttribute('aria-expanded', String(oppen));
    if (skugga) skugga.hidden = !oppen;
    if (!fokus) return;
    if (oppen) /** @type {HTMLInputElement} */ ((document.querySelector('.nav-item.active') || document.querySelector('.nav-item:not([aria-disabled="true"])')))?.focus();
    else knapp.focus();
}
// Fönstret passerar brytpunkten 640 punkter (åt något håll): menyn stängs, och utan glidning. Breddas fönstret medan
// menyn är öppen ligger annars skuggan kvar när menyn åter är en spalt; smalnas det av gled spalten ut över
// innehållet på väg utanför bild. Den smala vyn börjar alltså alltid med menyn stängd; öppnar användaren den själv
// står den kvar tills något stänger den (ändringar inom samma sida av brytpunkten rör den inte).
function _menyVidBrytpunkt() {
    document.body.classList.add('meny-utan-glidning');
    sattMeny(false, { fokus: false });
    const av = () => document.body.classList.remove('meny-utan-glidning');
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => requestAnimationFrame(av)); else setTimeout(av, 50);
}

/** Det som körs vid laddning, i filens ordning; src/app/index.js anropar delarnas uppstart i sifferordning. */
export function uppstartNavigering() {
    // ---- Tab Navigation ----
    // En låst flik är aria-disabled, inte disabled: knappen går att nå och klicka på, skärmläsaren hör den och skälet, och
    // klicket leder till lönefilskortet i Filer och kvalitet i stället för att ingenting händer. Egenskapen `disabled` på knappen
    // läser och sätter aria-disabled, så att resten av koden låser och låser upp flikar som vanligt (el.disabled = true).
    document.querySelectorAll(".nav-item").forEach(btn => {
        Object.defineProperty(btn, 'disabled', {
            configurable: true,
            get() { return this.getAttribute('aria-disabled') === 'true'; },
            set(v) { if (v) this.setAttribute('aria-disabled', 'true'); else this.removeAttribute('aria-disabled'); }
        });
    });
    document.querySelectorAll(".nav-item").forEach(btn => {
        btn.addEventListener("click", e => {
            const byte = _nastaFlikbyte;
            _nastaFlikbyte = null;
            if (/** @type {HTMLInputElement} */ (btn).disabled) {
                if (/** @type {HTMLElement} */ (btn).dataset.kraver === 'alder' && state.data.length) visaAlderskravet(btn.textContent.trim());
                else visaLonefilskortet(btn.textContent.trim());
                return;
            }
            const target = btn.getAttribute("data-tab");
            document.querySelectorAll(".view-panel").forEach(v => /** @type {HTMLElement} */ (v).style.display = "none");
            // Visa alla paneler i flikens grupp (sammanslagna flikar), annars panelen själv.
            (PANELGRUPPER[target] || [target]).forEach(p => {
                const el = document.getElementById(`view-${p}`);
                if (el) el.style.display = "block";
            });
            document.querySelectorAll(".nav-item").forEach(t => t.classList.remove("active"));
            btn.classList.add("active");
            const titles = {
                dashboard: 'Översikt', filer: 'Filer och kvalitet',
                kon: 'Ålder & karriär', dokumentera: 'Exportera',
                rapporttext: 'Rapporttext', arbetet: 'Spara och jämför år',
                benchmark: 'Löneläget', matrix: 'Lika arbete',
                bestammelser: 'Regler & praxis',
                handlingsplan: 'Handlingsplan',
                prioritering: 'Prioritering',
                struktur: 'Lönestruktur',
                loneoversyn: 'Löneöversyn',
                likvardighet: 'Likvärdigt arbete',
                utforska: 'Tabeller och egna vyer',
                info: 'Om verktyget'
            };
            const titleEl = document.getElementById("page-title");
            if (titleEl) titleEl.textContent = titles[target] || target;
            // En ny flik börjar överst: annars står läsaren kvar där förra fliken slutade (granskning 2026-10-30).
            // Före ritningen, så att det som görs efter den (efter: ett avsnitt att visa) får sista ordet.
            window.scrollTo(0, 0);
            // Användarens eget klick (eller ett flikbyte som begär det) visar fliken först och räknar den sedan (ADR-80).
            flikbyte(target || '', { uppskjut: e.isTrusted || !!byte?.uppskjut, efter: byte?.efter || null });
        });
    });
    document.addEventListener('change', e => { if (e.isTrusted) _valRaknare++; }, true);
    for (const typ of _VISNING_HANDELSER) document.addEventListener(typ, e => { if (_visningAndras(e)) visningNy(); }, true);
    // Delegerad klick: knappar utanför Exportera (samverkanskortet i Handlingsplan) som återanvänder navets exportknappar.
    document.addEventListener('click', e => {
        const b = /** @type {HTMLElement} */ (e.target).closest('[data-dok-klick]');
        if (b) document.getElementById(/** @type {HTMLElement} */ (b).dataset.dokKlick || '')?.click();
    });
    // Delegerad klick: "Nästa steg"-knapparna leder till rätt flik via nav-klicket. En låst flik gör som i menyn:
    // nav-klicket visar lönefilskortet i Filer och kvalitet, och då får sidan inte rullas upp förbi kortet.
    document.addEventListener('click', e => {
        const btn = /** @type {HTMLElement} */ (e.target).closest('[data-flow-tab]');
        if (!btn) return;
        const nav = document.querySelector(`.nav-item[data-tab="${flikMal(btn.getAttribute('data-flow-tab'))}"]`);
        if (!nav) return;
        const last = /** @type {HTMLInputElement} */ (nav).disabled;
        klickaFlik(nav, { uppskjut: e.isTrusted });
        if (!last) window.scrollTo({ top: 0, behavior: 'smooth' });
    });
    // Delegerad click-handler för "gå till flik X"-länkar i HTML-strängar
    document.addEventListener('click', e => {
        const a = /** @type {HTMLElement} */ (e.target).closest('[data-go-to-tab]');
        if (!a) return;
        e.preventDefault();
        const target = /** @type {HTMLElement} */ (a).dataset.goToTab;
        // Avsnittet länken leder till visas när fliken är ritad (ADR-80: användarens klick ritar fliken efter att den målats).
        const tillAnkare = () => {
            const ankare = /** @type {HTMLElement} */ (a).dataset.goToAnchor && document.getElementById(/** @type {HTMLElement} */ (a).dataset.goToAnchor || '');
            if (!ankare) return;
            oppnaHopfallda(ankare);
            if (typeof ankare.scrollIntoView === 'function') ankare.scrollIntoView({ block: 'start' });
        };
        if (!(target && typeof navigeraTill === 'function' && navigeraTill(target, { uppskjut: e.isTrusted, efter: tillAnkare }))) tillAnkare();
    });
    document.getElementById('btn-meny')?.addEventListener('click', () => sattMeny(!menyOppen()));
    document.getElementById('meny-skugga')?.addEventListener('click', () => sattMeny(false));
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && menyOppen()) sattMeny(false); });
    document.getElementById('sidomeny')?.addEventListener('click', e => { if (/** @type {HTMLElement} */ (e.target).closest('.nav-item')) sattMeny(false, { fokus: false }); });
    if (typeof window.matchMedia === 'function') {
        const smal = window.matchMedia('(max-width: 640px)');
        if (smal.addEventListener) smal.addEventListener('change', _menyVidBrytpunkt);
    }
}

// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
// ====================================================================
// 11-diagramexport.js — Exportmeny på alla diagram
//
// Varje diagram ritas av diagramkärnan (ritaFigur, ADR-39), som lägger till menyn — så ALLA diagram, även
// framtida, får samma meny utan att någon kommer ihåg att lägga till en knapp.
//
// Kontrakt för vyer:
//   markeraUtanExport(el, skal)     — behållaren (och allt i den) lämnar inte verktyget; skälet ur EXPORT_SKAL.
//   exportBeskrivning (ritaFigur)   — blir rad 2 i diagramdatan och står i bildens fotrad (Utforskas urval).
//   exportMedSma (ritaFigur)        — funktion som svarar om små grupper ska följa med (Utforskas kryssruta).
//   figur.urval (ritaFigur)         — användarens urval i diagrammet (filterraderna): exportmenyns PNG/SVG ritas med
//                                     urvalet och fotraden säger vad som gäller, med samma text som noten under
//                                     diagrammet; diagramdatan har alla rader och en rad "Urval i diagrammet: …".
//                                     diagramTillBild ritar alltid allt. Härledda lager (harleddAv) räknas om för
//                                     urvalet i exportmenyns bild, och fotraden nämner ett lager som då inte ritas.
//   figur.underlag (ritaFigur)      — diagrammet kan räknas för en del av personerna (raderna "Räkna för"): exportmenyns
//                                     bild och diagramdata är figuren för valet, fotraden och raden "Räknat för: …"
//                                     säger valet. diagramTillBild ritar alltid hela underlaget (originalet).
//   figur.individer                 — figuren har en punkt per person: diagramdatan får raden om att filen
//                                     innehåller en rad per person och ska hanteras som personuppgifter (kIndividRad).
//
// Diagrammet exporteras ur sin figur (gd._figur) genom _rfExportFigur: bilden ritas utan små grupper och
// diagramdatan filtreras med utanSmaGrupper, om inte vyn har begärt annat. Finns inget att exportera —
// behållaren har ingen figur (felläge, rensad) eller alla punkter hör till små grupper — lämnar ingenting
// verktyget: menyn säger det i sin felrad.
//
// Underlaget (_diagramexportUnderlag — där vyn tillfrågas om små grupper) bestäms EN gång per export, i
// exporteraDiagram, och lämnas vidare till innehållet och stämpeln: de kan då aldrig komma ur olika svar.
// Rensas eller ritas diagrammet om medan bilden görs laddas ingenting ner.
// ====================================================================
import { EXPORT_SKAL, exportSkal, figurTillTabell, harleddaLager, harlettNot, urvalBeskrivning, utanSmaGrupper } from '../lib/figur.js';
import { esc } from './01-html-och-tillganglighet.js';
import { idagDatum } from './03-hjalpfunktioner.js';
import { ikon } from './03-ikoner.js';
import { _kUndantagFor, kIndividRad, kStampelFor } from './06-k-troskel.js';
import { APP_VERSION } from './08-version.js';
import { _rfExportFigur, figurTillBild } from './10-diagramritare.js';
import { _kopieraMatrisTillUrklipp, state } from './12-tillstand.js';
import { _laddaNedCSV, _visaExportvarning } from './22-exporthjalpare.js';
import { exportSakra, medExportLage } from './23-exportgrind.js';
import { diagramKopiaKalla } from './74-alla-diagram.js';

// ---- När ett diagram inte får lämna verktyget ----
// Regeln och skälen står i src/lib/figur.js (exportSkal, EXPORT_SKAL). Här märks behållaren och läses märkningen.
/** Märker en behållare: inget diagram i den lämnar verktyget. `skal` måste vara en nyckel i EXPORT_SKAL. */
export function markeraUtanExport(el, skal) {
    if (!el) return;
    if (!Object.prototype.hasOwnProperty.call(EXPORT_SKAL, skal)) throw new Error(`markeraUtanExport: okänt skäl "${skal}"`);
    el.setAttribute('data-no-export', skal);
    el.title = `Lämnar inte verktyget: ${EXPORT_SKAL[skal]}.`;
}
/** Skälet till att diagrammet i behållaren inte får lämna verktyget, eller null när det får det. */
function _exportSkalFor(behallare) {
    const m = behallare && behallare.closest ? behallare.closest('[data-no-export]') : null;
    return exportSkal(m ? m.getAttribute('data-no-export') : null);
}
/** Får diagrammet i behållaren lämna verktyget (meny, bild, diagramdata, ZIP, utskrift)? */
export function exportTillaten(behallare) { return _exportSkalFor(behallare) == null; }

const DIAGRAMEXPORT_STORLEKAR = {
    'png-presentation': [1920, 1080],
    'png-dokument':     [1600, 900],
    svg:                [1600, 900]
};
let _diagramexportNr = 0;

function _diagramexportElement(graphDiv) {
    return typeof graphDiv === 'string' ? document.getElementById(graphDiv) : graphDiv;
}
function _diagramexportFilnamnsdel(s) {
    return String(s || '').normalize('NFC').replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '').slice(0, 60);
}

/** Diagrammets rubrik: närmaste h2/h3 i samma kort, annars elementets id. En kopia i Alla diagram har källans rubrik. */
export function diagramexportRubrik(gd) {
    const egen = gd.closest ? gd.closest('.ut-kopia')?.querySelector(':scope > .ut-kopia-rubrik') : null;
    if (egen && egen.textContent.trim()) return egen.textContent.replace(/\s+/g, ' ').trim();
    const kort = gd.closest ? gd.closest('.card') : null;
    const h = kort ? kort.querySelector('h2, h3') : null;
    const t = h ? h.textContent.replace(/\s+/g, ' ').trim() : '';
    return t || gd.id || 'Diagram';
}

/** <DEMO_>Flik_Rubrik_ÅÅÅÅ-MM-DD.ext (en kopia i Alla diagram: källans flik) */
function diagramexportFilnamn(gd, ext, datum = new Date()) {
    const kalla = typeof diagramKopiaKalla === 'function' ? diagramKopiaKalla(gd) : null;
    const panel = (kalla || gd).closest ? (kalla || gd).closest('.view-panel') : null;
    const flik = panel && panel.id ? panel.id.replace(/^view-/, '') : 'diagram';
    const Flik = flik.charAt(0).toUpperCase() + flik.slice(1);
    const dag = idagDatum(datum);
    const titel = _diagramexportFilnamnsdel(diagramexportRubrik(gd)) || 'Diagram';
    return `${state.isDemo ? 'DEMO_' : ''}${_diagramexportFilnamnsdel(Flik)}_${titel}_${dag}.${ext}`;
}

// Svensk Excel läser "89.73" som text eller datum ("12.5" blir 12 maj). Decimaltal
// avrundas därför till två decimaler och skrivs med decimalkomma; heltal lämnas.
function _diagramexportCell(v) {
    if (typeof v !== 'number' || Number.isInteger(v) || !isFinite(v)) return v;
    return String(Math.round(v * 100) / 100).replace('.', ',');
}

/** Behållaren som gäller nu: en omritning i exportgrinden kan ha ersatt den med en ny med samma id. */
function _diagramexportAktuell(gd) { return gd && gd.isConnected === false && gd.id ? (document.getElementById(gd.id) || gd) : gd; }

/** Det som får exporteras ur ett diagram ritat med diagramkärnan, eller null när inget finns att exportera.
 *  Går alltid genom exportläget (ADR-51): figuren läses med den inställda tröskeln. Bilden görs asynkront av dem som
 *  anropar (exporteraDiagram, diagramTillBild), som själva står i exportläget tills bilden är klar. */
function _diagramexportUnderlag(...a) { return medExportLage(() => _diagramexportUnderlagExport.apply(null, /** @type {any} */ (a))); }
function _diagramexportUnderlagExport(gd) {
    // Ett diagram som inte får lämna verktyget (markeraUtanExport) har inget att exportera, vilken väg som än frågar.
    if (!exportTillaten(gd)) return null;
    // Exportgrinden (23-exportgrind.js): diagrammets flik ska vara ritad med det som gäller nu. Ett diagram som en
    // omritning har ersatt (det gamla elementet sitter inte kvar i sidan) har inget att exportera.
    if (typeof exportSakra === 'function' && !exportSakra(gd)) {
        // Omritningen kan ha ersatt behållaren: då gäller den nya med samma id.
        const ny = gd.isConnected === false && gd.id ? document.getElementById(gd.id) : null;
        if (!ny || ny === gd || !exportSakra(ny)) return null;
        gd = ny;
    }
    const ut = _rfExportFigur(gd);
    return ut && !ut.tom ? ut : null;
}

/** Urvalet i diagrammet som text, en del per aktiv dimension (t.ex. ['utan BAS A, BAS N', '10–50 personer i
 *  gruppen']), samma text som noten under diagrammet; [] utan urval. */
function _diagramexportDolt(ut) {
    return ut && ut.filter ? urvalBeskrivning(ut.figur, ut.filter, { visaSma: !!ut.visaSma }) : [];
}

/** Meningarna om härledda lager (harleddAv) som inte ritas i exportmenyns bild: med urvalet har källagren färre än
 *  minN synliga punkter. Samma text som noten under diagrammet; [] utan urval eller utan sådana lager. */
function _diagramexportHarlett(ut) {
    if (!ut || !ut.filter) return [];
    return harlettNot(harleddaLager(ut.bild || ut.figur, ut.filter, { visaSma: !!ut.visaSma })).utelamnade;
}

/** Diagramdata med en spårbarhetsrad överst (ADR-13). Diagram ritade med diagramkärnan (ADR-39) går genom
 *  figurTillTabell — alla serier, också de som dolts via förklaringen; en låda blir statistik per kategori.
 *  Finns inget att exportera: inga rader alls.
 *  `underlag` är exportens underlag när anroparen redan har bestämt det (exporteraDiagram); utelämnat bestäms
 *  det här. Stämpeln får samma svar om små grupper som innehållet. */
function diagramexportRader(gd, underlag) {
    const ut = underlag === undefined ? _diagramexportUnderlag(gd) : underlag;
    if (!ut || (ut.underlag && ut.underlag.tom)) return [];
    gd = _diagramexportAktuell(gd);
    const medSma = ut.visaSma;
    // Med ett underlag är diagramdatan figuren för valet (det som visas), och raden "Räknat för" säger vilket.
    const kalla = ut.underlag && ut.underlag.figur ? ut.underlag.figur : ut.figur;
    const rader = figurTillTabell(medSma ? kalla : utanSmaGrupper(kalla)).map(r => r.map(_diagramexportCell));
    const beskrivning = typeof gd._exportBeskrivning === 'string' ? gd._exportBeskrivning : '';
    // En figur med en punkt per person (figurens `individer`) ger en rad per person: filen säger det på rad 2.
    const individer = ut.figur && ut.figur.individer === true;
    // Urvalet i diagrammet döljer bara märken i bilden: datan har alla rader, och raden säger vad bilden döljer.
    const dolt = _diagramexportDolt(ut);
    return [[`${diagramexportRubrik(gd)} — Lönekartläggning ${APP_VERSION}. ${kStampelFor(_kUndantagFor(gd, medSma))}`],
            ...(individer ? [[kIndividRad()]] : []),
            ...(beskrivning ? [[`Urval: ${beskrivning}`]] : []),
            ...(ut.underlag ? [[`Räknat för: ${ut.underlag.text}`]] : []),
            ...(dolt.length ? [[`Urval i diagrammet: ${dolt.join('; ')}`]] : []), ...rader];
}

/** Rubrik och fotrad till en exporterad bild av ett kärnritat diagram: bilden ska säga själv vad den visar när den
 *  klistras in i ett dokument. Foten: verktyget och dagens datum, och urvalet om vyn har angett ett.
 *  `dolt`: urvalet i diagrammet som text (_diagramexportDolt; bara exportmenyns bild, aldrig diagramTillBild).
 *  `harlett`: härledda lager som inte ritas med urvalet (_diagramexportHarlett).
 *  `underlag`: valet när diagrammet är räknat för en del av personerna (bara exportmenyns bild). Vyns anteckning
 *  (exportAnteckning) gäller hela underlaget och står då inte med.
 *  @param {any} gd @param {Date} [datum] @param {string[]} [dolt] @param {string[]} [harlett] @param {string} [underlag] */
function _diagramexportRubrikFot(gd, datum = new Date(), dolt = [], harlett = [], underlag = '') {
    const dag = idagDatum(datum);
    const urval = typeof gd._exportBeskrivning === 'string' && gd._exportBeskrivning ? ` · Urval: ${gd._exportBeskrivning}` : '';
    // Ett zoomat diagram exporteras som det visas: fotraden säger att bilden är ett utsnitt.
    // Vyns anteckning (val.exportAnteckning) står först i fotraden: en mening om det bilden visar, räknad av vyn
    // ur värden som får visas.
    const v = !underlag && gd._figurVal && typeof gd._figurVal.exportAnteckning === 'string' ? gd._figurVal.exportAnteckning.trim() : '';
    const underlagText = underlag ? ` · Räknat för: ${underlag}` : '';
    const doltText = dolt && dolt.length ? ` · Urval i diagrammet: ${dolt.join('; ')}` : '';
    const harlettText = (harlett || []).map(t => ` · ${String(t).replace(/\.$/, '')}`).join('');
    return { rubrik: diagramexportRubrik(gd), fot: `${v ? v + ' · ' : ''}Lönekartläggning ${dag}${urval}${underlagText}${doltText}${harlettText}${gd._rfZoom ? ' · Utsnitt av diagrammet' : ''}` };
}

/** Bär elementet ett ritat diagram med något att visa? */
export function diagramRitat(el) {
    return !!el && !!_diagramexportUnderlag(el);
}

/** Ett ritat diagram som PNG (data-URL) — den enda vägen till en diagrambild för rapportunderlag, ZIP, utskrift
 *  och prioriteringsmatrisen (ADR-39): originalfiguren utan små grupper (om inte vyn sagt annat) och med de serier
 *  användaren dolt. `utanRubrik`: bilden får ingen rubrik och fotrad (utskriften sätter egna rubriker). */
// Går alltid genom exportläget (ADR-51): djupräknaren håller skärmen i exportläget tills den sista pågående exporten är klar.
export function diagramTillBild(...a) { return medExportLage(() => _diagramTillBildExport.apply(null, /** @type {any} */ (a))); }
async function _diagramTillBildExport(el, val) {
    const { bredd, hojd, utanRubrik = false } = val || {};
    const skal = _exportSkalFor(el);
    if (skal) throw new Error(`Diagrammet lämnar inte verktyget: det ${skal}.`);
    const ut = _diagramexportUnderlag(el);
    el = _diagramexportAktuell(el);
    if (!ut) throw new Error('Det finns inget att exportera i diagrammet.');
    // Användarens urval i diagrammet (ut.filter) och underlaget (ut.underlag) följer INTE med: rapporten, utskriften,
    // ZIP-filen och rapportunderlaget visar alltid hela diagrammet, räknat för hela underlaget.
    const url = await figurTillBild(ut.hel || ut.figur, 'png', bredd, hojd, { visaSma: ut.visaSma, dolda: ut.dolda, ...(utanRubrik ? {} : _diagramexportRubrikFot(el)) });
    if (el._figur !== ut.figur) throw new Error('Diagrammet rensades innan exporten blev klar.');
    return url;
}

// Går alltid genom exportläget (ADR-51): djupräknaren håller skärmen i exportläget tills den sista pågående exporten är klar.
export function _diagramexportBild(...a) { return medExportLage(() => __diagramexportBildExport.apply(null, /** @type {any} */ (a))); }
async function __diagramexportBildExport(gd, val, underlag) {
    const [width, height] = DIAGRAMEXPORT_STORLEKAR[val];
    const format = val === 'svg' ? 'svg' : 'png';
    // Originalfiguren med visaSma enligt vyn och de serier användaren dolt: samma bild som på skärmen,
    // utan små grupper. Meningen om sänkt tröskel lägger figurTillSvg dit.
    const ut = underlag === undefined ? _diagramexportUnderlag(gd) : underlag;
    gd = _diagramexportAktuell(gd);
    if (!ut || (ut.underlag && ut.underlag.tom)) throw new Error('Det finns inget att exportera i diagrammet.');
    // Exportmenyn ritar diagrammet som det visas: också med användarens urval och underlag, som fotraden då namnger.
    const url = await figurTillBild(ut.bild || ut.figur, format, width, height, { visaSma: ut.visaSma, dolda: ut.dolda, filter: ut.filter,
        ..._diagramexportRubrikFot(gd, new Date(), _diagramexportDolt(ut), _diagramexportHarlett(ut), ut.underlag ? ut.underlag.text : '') });
    // Bilden görs asynkront. Har diagrammet under tiden rensats (Rensa all data) eller fått en annan figur
    // lämnar bilden av den gamla inte verktyget.
    if (gd._figur !== ut.figur) throw new Error('Diagrammet rensades innan exporten blev klar.');
    const a = document.createElement('a');
    a.href = url;
    a.download = diagramexportFilnamn(gd, format);
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    a.remove();
    if (typeof _visaExportvarning === 'function') _visaExportvarning();
}

// Går alltid genom exportläget (ADR-51): djupräknaren håller skärmen i exportläget tills den sista pågående exporten är klar.
function exporteraDiagram(...a) { return medExportLage(() => _exporteraDiagramExport.apply(null, /** @type {any} */ (a))); }
function _exporteraDiagramExport(gd, val) {
    // Underlaget bestäms här, en gång (ett anrop av vyns exportMedSma). Menyn finns bara på diagram som ritaFigur
    // ritat; utan något att exportera (felläge, rensat): ingen fil, ingenting på urklipp.
    const underlag = _diagramexportUnderlag(gd);
    gd = _diagramexportAktuell(gd);
    if (underlag === null) return Promise.reject(new Error('Det finns inget att exportera i diagrammet.'));
    // Räknat för ett underlag som inte går att rita (inga personer, eller vyns beräkning gav ingen figur): inget att exportera.
    if (underlag && underlag.underlag && underlag.underlag.tom) return Promise.reject(new Error('Det finns inget att exportera i diagrammet.'));
    if (val === 'data-kopiera') return Promise.resolve(_kopieraMatrisTillUrklipp(diagramexportRader(gd, underlag)));
    if (val === 'data-csv') {
        return Promise.resolve(_laddaNedCSV(diagramexportRader(gd, underlag), diagramexportFilnamn(gd, 'csv').replace(/\.csv$/, '')));
    }
    return _diagramexportBild(gd, val, underlag);
}

/** Lägger exportknappen i diagrammets övre högra hörn. Idempotent. */
export function _laggTillDiagramexport(graphDiv) {
    const gd = _diagramexportElement(graphDiv);
    if (!gd || gd._chartExportAttached || !gd.parentElement) return;
    if (!exportTillaten(gd)) return;
    gd._chartExportAttached = true;
    const host = gd.parentElement;
    host.classList.add('chart-export-host');
    const menyId = `chart-export-${++_diagramexportNr}`;
    const wrap = document.createElement('div');
    wrap.className = 'chart-export';
    wrap.innerHTML =
        `<button type="button" class="chart-export-btn" aria-expanded="false" aria-controls="${menyId}" `
        + `aria-label="Exportera diagrammet ${esc(diagramexportRubrik(gd))}">${ikon('laddaNed', 14)} Exportera diagrammet</button>`
        + `<div class="chart-export-meny" id="${menyId}" hidden>`
        + '<button type="button" data-chart-export="png-presentation">PNG, presentation (1920 × 1080)</button>'
        + '<button type="button" data-chart-export="png-dokument">PNG, dokument (1600 × 900)</button>'
        + '<button type="button" data-chart-export="svg">SVG (vektor, skarp i Word)</button>'
        + '<button type="button" data-chart-export="data-kopiera">Kopiera diagramdata</button>'
        + '<button type="button" data-chart-export="data-csv">Ladda ner diagramdata (CSV)</button>'
        + '<p class="chart-export-fel" role="alert" hidden></p>'
        + '</div>';
    wrap._gd = gd;
    host.insertBefore(wrap, gd);
}

function _diagramexportStang(utom) {
    document.querySelectorAll('.chart-export-meny:not([hidden])').forEach(m => {
        if (m === utom) return;
        /** @type {HTMLElement} */ (m).hidden = true;
        const b = /** @type {HTMLElement} */ (m.parentElement).querySelector('.chart-export-btn');
        if (b) b.setAttribute('aria-expanded', 'false');
    });
}

/** Det som körs vid laddning, i filens ordning; src/app/index.js anropar delarnas uppstart i sifferordning. */
export function uppstartDiagramexport() {
    document.addEventListener('click', e => {
        const btn = /** @type {HTMLElement} */ (e.target).closest('.chart-export-btn');
        if (btn) {
            const meny = /** @type {HTMLElement} */ (/** @type {HTMLElement} */ (btn.parentElement).querySelector('.chart-export-meny'));
            const oppna = /** @type {HTMLElement} */ (meny).hidden;
            _diagramexportStang(meny);
            /** @type {HTMLElement} */ (meny).hidden = !oppna;
            btn.setAttribute('aria-expanded', String(oppna));
            if (oppna) meny.querySelector('button')?.focus();
            return;
        }
        const val = /** @type {HTMLElement} */ (e.target).closest('[data-chart-export]');
        if (val) {
            const wrap = /** @type {HTMLElement} */ (val.closest('.chart-export'));
            const fel = /** @type {HTMLElement} */ (wrap.querySelector('.chart-export-fel'));
            /** @type {HTMLElement} */ (fel).hidden = true;
            exporteraDiagram(wrap._gd, val.getAttribute('data-chart-export'))
                .then(() => {
                    _diagramexportStang();
                    /** @type {HTMLInputElement} */ (wrap.querySelector('.chart-export-btn'))?.focus();   // fokus tillbaka dit man var
                })
                .catch(err => {
                    fel.textContent = 'Exporten misslyckades: ' + ((err && err.message) || String(err));
                    /** @type {HTMLElement} */ (fel).hidden = false;
                });
            return;
        }
        // En tabells exportmeny (.tabell-export) har egna knappar med egna lyssnare: menyn stängs när ett val gjorts.
        if (!/** @type {HTMLElement} */ (e.target).closest('.chart-export') || /** @type {HTMLElement} */ (e.target).closest('.tabell-export .chart-export-meny button')) _diagramexportStang();
    });
    // Stäng menyn när tangentbordsfokus lämnar den (Tab ut).
    document.addEventListener('focusout', e => {
        const wrap = /** @type {HTMLElement} */ (e.target).closest && /** @type {HTMLElement} */ (e.target).closest('.chart-export');
        if (!wrap) return;
        if (e.relatedTarget && wrap.contains(/** @type {Node} */ (e.relatedTarget))) return;
        const meny = wrap.querySelector('.chart-export-meny');
        if (meny && !/** @type {HTMLElement} */ (meny).hidden) _diagramexportStang();
    });
    document.addEventListener('keydown', e => {
        if (e.key !== 'Escape') return;
        const oppen = document.querySelector('.chart-export-meny:not([hidden])');
        if (!oppen) return;
        _diagramexportStang();
        /** @type {HTMLElement} */ (/** @type {HTMLInputElement} */ (oppen.parentElement).querySelector('.chart-export-btn'))?.focus();
    });
}

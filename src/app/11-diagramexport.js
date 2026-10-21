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
//   figur.individer                 — figuren har en punkt per person: diagramdatan får raden om att filen
//                                     innehåller en rad per person och ska hanteras som personuppgifter (kIndividRad).
//
// Diagrammet exporteras ur sin figur (gd._figur) genom _rfExportFigur: bilden ritas utan små grupper och
// diagramdatan filtreras med utanSmaGrupper, om inte vyn har begärt annat. Finns inget att exportera —
// behållaren har ingen figur (felläge, rensad) eller alla punkter hör till små grupper — lämnar ingenting
// verktyget: menyn säger det i sin felrad.
//
// Underlaget (_chartExportUnderlag — där vyn tillfrågas om små grupper) bestäms EN gång per export, i
// chartExportRun, och lämnas vidare till innehållet och stämpeln: de kan då aldrig komma ur olika svar.
// Rensas eller ritas diagrammet om medan bilden görs laddas ingenting ner.
// ====================================================================

// ---- När ett diagram inte får lämna verktyget ----
// Regeln står här och bara här. Ett diagram får inte lämna verktyget — ingen exportmeny, ingen bild till ZIP-filen,
// rapportunderlaget eller utskriften (diagramTillBild), ingen diagramdata — när det står i en behållare som vyn har
// märkt med markeraUtanExport. Skälen är få och uppräknade; ett diagram utan registrerat skäl kan inte märkas, så
// det syns i koden varför varje spärr finns, och användaren ser det i behållarens verktygstips.
const EXPORT_SKAL = {
    // Personer att granska (ADR-23): panelen visar enskilda personer med filens radnummer. Diagrammet namnger ingen
    // och bär ingen lön, men hör till panelen, och inget ur den lämnar verktyget.
    individer: 'hör till Personer att granska, som visar enskilda personer (ADR-23)',
    // Översiktens kopior av Struktur & rapportmåtts diagram: samma bild exporteras från sin egen flik, en gång.
    kopia: 'är en kopia av ett diagram i Struktur & rapportmått och exporteras därifrån'
};
/** Märker en behållare: inget diagram i den lämnar verktyget. `skal` måste vara en nyckel i EXPORT_SKAL. */
function markeraUtanExport(el, skal) {
    if (!el) return;
    if (!Object.prototype.hasOwnProperty.call(EXPORT_SKAL, skal)) throw new Error(`markeraUtanExport: okänt skäl "${skal}"`);
    el.setAttribute('data-no-export', skal);
    el.title = `Lämnar inte verktyget: ${EXPORT_SKAL[skal]}.`;
}
/** Skälet till att diagrammet i behållaren inte får lämna verktyget, eller null när det får det. */
function exportSkal(behallare) {
    const m = behallare && behallare.closest ? behallare.closest('[data-no-export]') : null;
    if (!m) return null;
    // En märkning utan registrerat skäl spärrar ändå: hellre ett diagram för lite i en export än ett för mycket.
    return EXPORT_SKAL[m.getAttribute('data-no-export')] || 'är märkt utan export';
}
/** Får diagrammet i behållaren lämna verktyget (meny, bild, diagramdata, ZIP, utskrift)? */
function exportTillaten(behallare) { return exportSkal(behallare) == null; }

const CHART_EXPORT_STORLEKAR = {
    'png-presentation': [1920, 1080],
    'png-dokument':     [1600, 900],
    svg:                [1600, 900]
};
let _chartExportSeq = 0;

function _chartExportEl(graphDiv) {
    return typeof graphDiv === 'string' ? document.getElementById(graphDiv) : graphDiv;
}
function _chartExportSlug(s) {
    return String(s || '').normalize('NFC').replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '').slice(0, 60);
}

/** Diagrammets rubrik: närmaste h2/h3 i samma kort, annars elementets id. */
function chartExportTitle(gd) {
    const kort = gd.closest ? gd.closest('.card') : null;
    const h = kort ? kort.querySelector('h2, h3') : null;
    const t = h ? h.textContent.replace(/\s+/g, ' ').trim() : '';
    return t || gd.id || 'Diagram';
}

/** <DEMO_>Flik_Rubrik_ÅÅÅÅ-MM-DD.ext */
function chartExportFilename(gd, ext, datum = new Date()) {
    const panel = gd.closest ? gd.closest('.view-panel') : null;
    const flik = panel && panel.id ? panel.id.replace(/^view-/, '') : 'diagram';
    const Flik = flik.charAt(0).toUpperCase() + flik.slice(1);
    const pad = n => String(n).padStart(2, '0');
    const dag = `${datum.getFullYear()}-${pad(datum.getMonth() + 1)}-${pad(datum.getDate())}`;
    const titel = _chartExportSlug(chartExportTitle(gd)) || 'Diagram';
    return `${state.isDemo ? 'DEMO_' : ''}${_chartExportSlug(Flik)}_${titel}_${dag}.${ext}`;
}

// Svensk Excel läser "89.73" som text eller datum ("12.5" blir 12 maj). Decimaltal
// avrundas därför till två decimaler och skrivs med decimalkomma; heltal lämnas.
function _chartExportCell(v) {
    if (typeof v !== 'number' || Number.isInteger(v) || !isFinite(v)) return v;
    return String(Math.round(v * 100) / 100).replace('.', ',');
}

// Har ritaFigur ritat i behållaren? Ja om den bär en figur, eller har burit en (felläge eller rensad: menyn står kvar
// utan figur, och svarar då att det inte finns något att exportera).
function _chartExportKarna(gd) {
    return !!gd && (!!gd._figur || _rfHarRitat(gd));
}

/** Det som får exporteras ur ett diagram ritat med diagramkärnan, eller null när inget finns att exportera. */
function _chartExportUnderlag(gd) {
    // Ett diagram som inte får lämna verktyget (markeraUtanExport) har inget att exportera, vilken väg som än frågar.
    if (!exportTillaten(gd)) return null;
    // Exportgrinden (23-exportgrind.js): diagrammets flik ska vara ritad med det som gäller nu. Ett diagram som en
    // omritning har ersatt (det gamla elementet sitter inte kvar i sidan) har inget att exportera.
    if (typeof exportSakra === 'function' && !exportSakra(gd)) return null;
    const ut = _rfExportFigur(gd);
    return ut && !ut.tom ? ut : null;
}

/** Diagramdata med en spårbarhetsrad överst (ADR-13). Diagram ritade med diagramkärnan (ADR-39) går genom
 *  figurTillTabell — alla serier, också de som dolts via förklaringen; en låda blir statistik per kategori.
 *  Finns inget att exportera: inga rader alls.
 *  `underlag` är exportens underlag när anroparen redan har bestämt det (chartExportRun); utelämnat bestäms
 *  det här. Stämpeln får samma svar om små grupper som innehållet. */
function chartExportRows(gd, underlag) {
    const ut = underlag === undefined ? _chartExportUnderlag(gd) : underlag;
    if (!ut) return [];
    const medSma = ut.visaSma;
    const rader = _figTillTabell(medSma ? ut.figur : _figUtanSma(ut.figur)).map(r => r.map(_chartExportCell));
    const beskrivning = typeof gd._exportBeskrivning === 'string' ? gd._exportBeskrivning : '';
    // En figur med en punkt per person (figurens `individer`) ger en rad per person: filen säger det på rad 2.
    const individer = ut.figur && ut.figur.individer === true;
    return [[`${chartExportTitle(gd)} — Lönekartläggning ${APP_VERSION}. ${kStampelFor(_kUndantagFor(gd, medSma))}`],
            ...(individer ? [[kIndividRad()]] : []),
            ...(beskrivning ? [[`Urval: ${beskrivning}`]] : []), ...rader];
}

/** Rubrik och fotrad till en exporterad bild av ett kärnritat diagram: bilden ska säga själv vad den visar när den
 *  klistras in i ett dokument. Foten: verktyget och dagens datum, och urvalet om vyn har angett ett. */
function _chartExportRubrikFot(gd, datum = new Date()) {
    const p = n => String(n).padStart(2, '0');
    const dag = `${datum.getFullYear()}-${p(datum.getMonth() + 1)}-${p(datum.getDate())}`;
    const urval = typeof gd._exportBeskrivning === 'string' && gd._exportBeskrivning ? ` · Urval: ${gd._exportBeskrivning}` : '';
    // Ett zoomat diagram exporteras som det visas: fotraden säger att bilden är ett utsnitt.
    // Vyns anteckning (val.exportAnteckning) står först i fotraden: en mening om det bilden visar, räknad av vyn
    // ur värden som får visas.
    const v = gd._figurVal && typeof gd._figurVal.exportAnteckning === 'string' ? gd._figurVal.exportAnteckning.trim() : '';
    return { rubrik: chartExportTitle(gd), fot: `${v ? v + ' · ' : ''}Lönekartläggning ${dag}${urval}${gd._rfZoom ? ' · Utsnitt av diagrammet' : ''}` };
}

/** Bär elementet ett ritat diagram med något att visa? */
function diagramRitat(el) {
    return !!el && !!_chartExportUnderlag(el);
}

/** Ett ritat diagram som PNG (data-URL) — den enda vägen till en diagrambild för rapportunderlag, ZIP, utskrift
 *  och prioriteringsmatrisen (ADR-39): originalfiguren utan små grupper (om inte vyn sagt annat) och med de serier
 *  användaren dolt. `utanRubrik`: bilden får ingen rubrik och fotrad (utskriften sätter egna rubriker). */
async function diagramTillBild(el, val) {
    const { bredd, hojd, utanRubrik = false } = val || {};
    const skal = exportSkal(el);
    if (skal) throw new Error(`Diagrammet lämnar inte verktyget: det ${skal}.`);
    const ut = _chartExportUnderlag(el);
    if (!ut) throw new Error('Det finns inget att exportera i diagrammet.');
    const url = await figurTillBild(ut.bild || ut.figur, 'png', bredd, hojd, { visaSma: ut.visaSma, dolda: ut.dolda, ...(utanRubrik ? {} : _chartExportRubrikFot(el)) });
    if (el._figur !== ut.figur) throw new Error('Diagrammet rensades innan exporten blev klar.');
    return url;
}

async function _chartExportImage(gd, val, underlag) {
    const [width, height] = CHART_EXPORT_STORLEKAR[val];
    const format = val === 'svg' ? 'svg' : 'png';
    // Originalfiguren med visaSma enligt vyn och de serier användaren dolt: samma bild som på skärmen,
    // utan små grupper. Meningen om sänkt tröskel lägger figurTillSvg dit.
    const ut = underlag === undefined ? _chartExportUnderlag(gd) : underlag;
    if (!ut) throw new Error('Det finns inget att exportera i diagrammet.');
    const url = await figurTillBild(ut.bild || ut.figur, format, width, height, { visaSma: ut.visaSma, dolda: ut.dolda, ..._chartExportRubrikFot(gd) });
    // Bilden görs asynkront. Har diagrammet under tiden rensats (Rensa all data) eller fått en annan figur
    // lämnar bilden av den gamla inte verktyget.
    if (gd._figur !== ut.figur) throw new Error('Diagrammet rensades innan exporten blev klar.');
    const a = document.createElement('a');
    a.href = url;
    a.download = chartExportFilename(gd, format);
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    a.remove();
    if (typeof _showExportSensitivityToast === 'function') _showExportSensitivityToast();
}

function chartExportRun(gd, val) {
    // Underlaget bestäms här, en gång (ett anrop av vyns exportMedSma).
    const underlag = _chartExportKarna(gd) ? _chartExportUnderlag(gd) : undefined;
    // Ett diagram från diagramkärnan utan något att exportera: ingen fil, ingenting på urklipp.
    if (underlag === null) return Promise.reject(new Error('Det finns inget att exportera i diagrammet.'));
    if (val === 'data-kopiera') return Promise.resolve(_copyMatrixToClipboard(chartExportRows(gd, underlag)));
    if (val === 'data-csv') {
        return Promise.resolve(_downloadCSV(chartExportRows(gd, underlag), chartExportFilename(gd, 'csv').replace(/\.csv$/, '')));
    }
    return _chartExportImage(gd, val, underlag);
}

/** Lägger exportknappen i diagrammets övre högra hörn. Idempotent. */
function _attachChartExport(graphDiv) {
    const gd = _chartExportEl(graphDiv);
    if (!gd || gd._chartExportAttached || !gd.parentElement) return;
    if (!exportTillaten(gd)) return;
    gd._chartExportAttached = true;
    const host = gd.parentElement;
    host.classList.add('chart-export-host');
    const menyId = `chart-export-${++_chartExportSeq}`;
    const wrap = document.createElement('div');
    wrap.className = 'chart-export';
    wrap.innerHTML =
        `<button type="button" class="chart-export-btn" aria-expanded="false" aria-controls="${menyId}" `
        + `aria-label="Exportera diagrammet ${esc(chartExportTitle(gd))}">${ikon('laddaNed', 14)} Exportera</button>`
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

function _chartExportStang(utom) {
    document.querySelectorAll('.chart-export-meny:not([hidden])').forEach(m => {
        if (m === utom) return;
        /** @type {HTMLElement} */ (m).hidden = true;
        const b = /** @type {HTMLElement} */ (m.parentElement).querySelector('.chart-export-btn');
        if (b) b.setAttribute('aria-expanded', 'false');
    });
}

document.addEventListener('click', e => {
    const btn = /** @type {HTMLElement} */ (e.target).closest('.chart-export-btn');
    if (btn) {
        const meny = /** @type {HTMLElement} */ (/** @type {HTMLElement} */ (btn.parentElement).querySelector('.chart-export-meny'));
        const oppna = /** @type {HTMLElement} */ (meny).hidden;
        _chartExportStang(meny);
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
        chartExportRun(wrap._gd, val.getAttribute('data-chart-export'))
            .then(() => {
                _chartExportStang();
                /** @type {HTMLInputElement} */ (wrap.querySelector('.chart-export-btn'))?.focus();   // fokus tillbaka dit man var
            })
            .catch(err => {
                fel.textContent = 'Exporten misslyckades: ' + ((err && err.message) || String(err));
                /** @type {HTMLElement} */ (fel).hidden = false;
            });
        return;
    }
    // En tabells exportmeny (.tabell-export) har egna knappar med egna lyssnare: menyn stängs när ett val gjorts.
    if (!/** @type {HTMLElement} */ (e.target).closest('.chart-export') || /** @type {HTMLElement} */ (e.target).closest('.tabell-export .chart-export-meny button')) _chartExportStang();
});
// Stäng menyn när tangentbordsfokus lämnar den (Tab ut).
document.addEventListener('focusout', e => {
    const wrap = /** @type {HTMLElement} */ (e.target).closest && /** @type {HTMLElement} */ (e.target).closest('.chart-export');
    if (!wrap) return;
    if (e.relatedTarget && wrap.contains(/** @type {Node} */ (e.relatedTarget))) return;
    const meny = wrap.querySelector('.chart-export-meny');
    if (meny && !/** @type {HTMLElement} */ (meny).hidden) _chartExportStang();
});
document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    const oppen = document.querySelector('.chart-export-meny:not([hidden])');
    if (!oppen) return;
    _chartExportStang();
    /** @type {HTMLElement} */ (/** @type {HTMLInputElement} */ (oppen.parentElement).querySelector('.chart-export-btn'))?.focus();
});

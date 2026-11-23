// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
// ---- Rapportunderlag (ADR-20): kopierbara block för en egen Word-mall ----
// Faktastycken, rena tabeller och diagram som klistras in i kommunens mall.
// Bedömningen (sakliga skäl) skrivs av verksamheten — här finns bara underlaget.
// Blocken väljs och räknas i src/lib/vymodell-rapportunderlag.js och byggs i src/lib/rapportunderlag.js;
// här hämtas resultaten ur de befintliga analyserna och kopieringen till urklipp sköts.
import { arTal } from '../lib/htmltext.js';
import { tillText, tillWordHtml } from '../lib/rapportunderlag.js';
import { stor } from '../lib/termer.js';
import { rapportunderlagDiagram, RU_GRUPPBLOCK, vymodellRapportunderlag } from '../lib/vymodell-rapportunderlag.js';
import { announceToScreenReader, esc } from './01-html-och-tillganglighet.js';
import { ANSVARSFORBEHALL } from './03-hjalpfunktioner.js';
import { _kSanktNot, kInstalld, kStampel, kTroskel, statGolv } from './06-k-troskel.js';
import { _skrDel } from './06-kvinnoandel-referens.js';
import { T } from './09-termer.js';
import { _diagramexportBild, diagramRitat, diagramTillBild } from './11-diagramexport.js';
import { getData, state } from './12-tillstand.js';
import { bedomningUnderlag } from './13-oversikt.js';
import { medExportLage } from './23-exportgrind.js';
import { renderTabContent } from './31-navigering.js';
import { likvardighetResultat } from './34-likvardigt-arbete.js';
import { laLikaGrupper } from './41-lika-arbete.js';
import { referensOverblick } from './44-referensoverblick.js';
import { aidbasDefinition, aidbasGrans, lvJamforelse } from './45-aid-bas-tabeller.js';
import { runOLSRegression } from './51-lika-arbete-regressionskort.js';
import { _handlingsplanSeedRows, _handlingsplanUnderlag, _hpKostnadAvser, _hpSkalUnderlag, HP_SKAL_UTAN_BELOPP, HP_UNDERLAG_PAR, HP_UNDERLAG_PRIO } from './56-handlingsplan.js';
import { gapVariabler } from './68-var-uppstar-gapet.js';
import { arsjamforelse } from './73-arsbokslut.js';
import { basdossierKandidater, basdossierStycken, basdossierYrkesrader, BD_BEDOMNING, buildBasdossier } from './81-basdossier.js';
import { _dkRitaTopp } from './85-robusthet-fardigcheck.js';

// Diagram som kan kopieras som bild: id på diagrammet och fliken som ritar det.
const RAPPORT_DIAGRAM = [
    { id: 'chart-skevhet-overview', rubrik: `Löneskillnad per ${T.niva.en}`, flik: 'struktur' },
    { id: 'chart-perbas-gap', rubrik: `Oförklarad löneskillnad per ${T.niva.en}`, flik: 'struktur' },
    { id: 'chart-likvardighet-heatmap', rubrik: 'Kandidatpar i likvärdigt arbete', flik: 'likvardighet' },
];

let _rapportBlockSenast = new Map();
let _rapportParLage = { harPar: false, exkluderade: 0 };

// Maxantalet par som likvärdighetsberäkningen tar fram (samma standard som 34).
function _ruTopN() { return (state.likvardighet && state.likvardighet.topN) ?? 100; }

function _rapportDiagramLista(harPar, exkluderade) { return rapportunderlagDiagram(RAPPORT_DIAGRAM, harPar, exkluderade); }

// Handlingsplanens rader för rapportunderlaget. Förifyllningen (_handlingsplanSeedRows) tar
// redan bort par med en grupp under k, så raderna används som de är — en enda regel för
// skärmen, Excel, utskriften och underlaget.
function _rapportHpRader(seedRows) {
    return seedRows.map(r => ({ atgard: r[0], grupp: r[1], antal: r[8] == null ? null : r[8], underlag: _handlingsplanUnderlag(r[2]), kostnad: r[4], kostnadAvser: _hpKostnadAvser(r[2]) }));
}

/** Alla textblock: avsnitt, yrkesgrupper, kandidatpar, förra året, per BAS-intervall och egna tabeller (visas i grupper). */
// Går alltid genom exportläget (ADR-51): djupräknaren håller skärmen i exportläget tills den sista pågående exporten är klar.
function rapportunderlagBlock(...a) { return medExportLage(() => _rapportunderlagBlockExport.apply(null, /** @type {any} */ (a))); }
// Blocken räknas i vymodellen (src/lib/vymodell-rapportunderlag.js); här hämtas analysernas resultat ur tillståndet.
function _rapportunderlagBlockExport() {
    const d = getData();
    if (!d.length) return [];
    const k = kTroskel();
    const reg = runOLSRegression();
    /** @type {any} */ let lv = null;
    try { lv = likvardighetResultat(); } catch (_e) { lv = null; }
    const hpSeed = _handlingsplanSeedRows();
    const vm = vymodellRapportunderlag(d, {
        k, golv: statGolv(), demo: !!state.isDemo, troskelNot: _kSanktNot(), kStampel: kStampel(),
        reg, kvalitet: bedomningUnderlag({ reg }), lika: laLikaGrupper(d, k), lv, topN: _ruTopN(),
        kvinnoTroskel: aidbasGrans(), kvDomDefinition: aidbasDefinition(), jamforelse: lvJamforelse(), gapVariabler: gapVariabler(), skrDel: _skrDel(),
        hp: { rader: _rapportHpRader(hpSeed.rows), skal: _hpSkalUnderlag(hpSeed), utanBelopp: HP_SKAL_UTAN_BELOPP, kInstalld: kInstalld(), prio: HP_UNDERLAG_PRIO, par: HP_UNDERLAG_PAR },
        referenser: referensOverblick(), harStatistik: state.statistik.length > 0, kostnad: state.costSettings, arsjamforelse: arsjamforelse(),
        basintervall: basdossierKandidater().flatMap(({ bas }) => {
            const bd = buildBasdossier(bas);
            return bd ? [{ bas, stycken: basdossierStycken(bd, { forraBaraMedBokslut: true }), yrken: basdossierYrkesrader(bd) }] : [];
        }),
        basBedomning: BD_BEDOMNING, recept: state.rapportTabeller || [],
    });
    _rapportParLage = { harPar: vm.harPar, exkluderade: vm.exkluderade };
    return vm.block;
}

export function renderRapportunderlag() {
    const host = document.getElementById('rapportunderlag-innehall');
    if (!host) return;
    if (!getData().length) {
        _rapportBlockSenast = new Map();
        host.innerHTML = '<p class="ru-tom">Läs in underlag för att få rapportunderlaget.</p>';
        if (typeof _dkRitaTopp === 'function') _dkRitaTopp({ block: null });
        return;
    }
    const block = rapportunderlagBlock();
    if (typeof _dkRitaTopp === 'function') _dkRitaTopp({ block: block.length });
    _rapportBlockSenast = new Map(block.map(b => [b.id, b]));
    const grupp = (rubrik, lista) => lista.length
        ? `<h3 class="ru-grupprubrik">${esc(rubrik)}</h3>` + lista.map(b => `
            <article class="ru-block" id="${esc(_ruBlockId(b.id))}" data-block-id="${esc(b.id)}">
                <div class="ru-innehall">${tillWordHtml(b)}</div>
                <div class="ru-atgard">
                    <button type="button" class="btn btn-secondary btn-sm" data-rapport-kopiera="${esc(b.id)}">Kopiera</button>
                    <span class="ru-kvitto" role="status"></span>
                </div>
            </article>`).join('')
        : '';
    const avsnitt = block.filter(b => !b.id.includes(':'));
    const yrken = block.filter(b => b.id.startsWith(RU_GRUPPBLOCK));
    const parBl = block.filter(b => b.id.startsWith('par:'));
    const egna = block.filter(b => b.id.startsWith('egen:'));
    const basBl = block.filter(b => b.id.startsWith('bas:'));
    // Diagrammet över kandidatpar finns bara när det finns par att visa.
    const diagram = _rapportDiagramLista(_rapportParLage.harPar, _rapportParLage.exkluderade).map(g => `
        <article class="ru-block ru-diagram">
            <h4>${esc(g.rubrik)}</h4>
            <div class="ru-atgard">
                <button type="button" class="btn btn-secondary btn-sm" data-rapport-diagram="${esc(g.id)}">Kopiera diagram</button>
                <span class="ru-kvitto" role="status"></span>
            </div>
        </article>`).join('');
    // Förteckning och "Kopiera alla avsnitt".
    const toc = (rubrik, lista) => lista.length
        ? `<li><strong>${esc(rubrik)}</strong>: ${lista.map(b => `<a href="#" data-hoppa-till="${esc(_ruBlockId(b.id))}">${esc(b.rubrik)}</a>`).join(' · ')}</li>` : '';
    const forteckning = `<nav class="ru-toc" aria-label="Innehåll i rapportunderlaget"><ul>`
        + toc('Avsnitt', avsnitt) + toc(`Per ${T.niva.en}`, basBl) + toc(stor(T.enhet.fl), yrken) + toc('Kandidatpar', parBl) + toc('Egna tabeller', egna) + `</ul>`
        + `<div class="ru-atgard"><button type="button" class="btn btn-secondary btn-sm" id="btn-ru-kopiera-avsnitt">Kopiera alla avsnitt</button>`
        + `<span class="ru-kvitto" role="status"></span></div><div id="ru-alla-avsnitt" class="ru-alla-avsnitt" hidden></div></nav>`;
    host.innerHTML = `<p class="ru-forbehall">${esc(ANSVARSFORBEHALL)}</p>` + forteckning + grupp('Avsnitt', avsnitt) + grupp(`Per ${T.niva.en}`, basBl) + grupp(`${stor(T.enhet.fl)} i Lika arbete`, yrken)
        + grupp('Kandidatpar i Likvärdigt arbete', parBl) + grupp('Egna tabeller från Tabeller och egna vyer', egna)
        + `<h3 class="ru-grupprubrik">Diagram</h3>${diagram}`;
    // Ett tal eller intervall står på en rad (95 % KI bröts annars på tre rader i en smal kolumn). Bara på skärmen:
    // urklippet byggs om ur blocket, utan klasser.
    host.querySelectorAll('.ru-innehall td').forEach(td => { if (arTal(td.textContent)) td.classList.add('ru-tal'); });
}

// Blockets element-id för hopplänkar (block-id:n innehåller ':').
function _ruBlockId(id) { return 'ru-' + String(id).replace(/[^A-Za-z0-9_-]/g, '-'); }

/** Kopierar alla avsnittsblock (utan yrkes- och parblock) i en kopiering. */
// Går alltid genom exportläget (ADR-51): djupräknaren håller skärmen i exportläget tills den sista pågående exporten är klar.
function kopieraRapportAvsnitt(...a) { return medExportLage(() => _kopieraRapportAvsnittExport.apply(null, /** @type {any} */ (a))); }
async function _kopieraRapportAvsnittExport() {
    const avsnitt = [..._rapportBlockSenast.values()].filter(b => !b.id.includes(':'));
    if (!avsnitt.length) return 'saknas';
    const html = avsnitt.map(b => tillWordHtml(b)).join('\n');
    const text = avsnitt.map(b => tillText(b)).join('\n\n');
    try {
        if (navigator.clipboard && navigator.clipboard.write && typeof ClipboardItem !== 'undefined') {
            await navigator.clipboard.write([new ClipboardItem({
                'text/html': new Blob([html], { type: 'text/html' }),
                'text/plain': new Blob([text], { type: 'text/plain' }),
            })]);
            return 'urklipp';
        }
    } catch (_e) { /* nekat — reserven nedan */ }
    // Reserv: visa avsnitten samlade, markera dem och försök kopiera; annars Ctrl+C.
    const box = document.getElementById('ru-alla-avsnitt');
    const sel = window.getSelection();
    if (!box || !sel) return 'saknas';
    box.innerHTML = html;
    box.hidden = false;
    const range = document.createRange();
    range.selectNodeContents(box);
    sel.removeAllRanges();
    sel.addRange(range);
    let ok = false;
    try { ok = document.execCommand('copy'); } catch (_e) { ok = false; }
    if (ok) box.hidden = true;
    return ok ? 'urklipp' : 'markerat';
}

function _rapportKvitto(knapp, text) {
    const k = knapp && knapp.parentElement && knapp.parentElement.querySelector('.ru-kvitto');
    if (k) k.textContent = text;
    if (typeof announceToScreenReader === 'function') announceToScreenReader(text);
}

/** Kopierar ett block som formaterad text + ren text. Reserv: markera och kopiera. */
// Går alltid genom exportläget (ADR-51): djupräknaren håller skärmen i exportläget tills den sista pågående exporten är klar.
function kopieraRapportBlock(...a) { return medExportLage(() => _kopieraRapportBlockExport.apply(null, /** @type {any} */ (a))); }
async function _kopieraRapportBlockExport(id) {
    const b = _rapportBlockSenast.get(id);
    if (!b) return 'saknas';
    const html = tillWordHtml(b), text = tillText(b);
    try {
        if (navigator.clipboard && navigator.clipboard.write && typeof ClipboardItem !== 'undefined') {
            await navigator.clipboard.write([new ClipboardItem({
                'text/html': new Blob([html], { type: 'text/html' }),
                'text/plain': new Blob([text], { type: 'text/plain' }),
            })]);
            return 'urklipp';
        }
    } catch (_e) { /* nekat — reserven nedan */ }
    const blockEl = [...document.querySelectorAll('.ru-block[data-block-id]')].find(x => /** @type {HTMLElement} */ (x).dataset.blockId === id);
    const el = blockEl && blockEl.querySelector('.ru-innehall');
    if (!el) return 'saknas';
    const sel = window.getSelection();
    if (!sel) return 'saknas';
    const range = document.createRange();
    range.selectNodeContents(el);
    sel.removeAllRanges();
    sel.addRange(range);
    let ok = false;
    try { ok = document.execCommand('copy'); } catch (_e) { ok = false; }
    return ok ? 'urklipp' : 'markerat';
}

// data:-URL → Blob utan fetch: verktygets CSP (connect-src 'none') blockerar fetch av data:.
function _dataUrlTillBlob(dataUrl) {
    const [huvud, data] = String(dataUrl).split(',');
    const mime = (/data:([^;,]+)/.exec(huvud) || [])[1] || 'application/octet-stream';
    const bin = atob(data || '');
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new Blob([bytes], { type: mime });
}

/** Kopierar ett diagram som PNG (1600 × 900). Ritar fliken först om diagrammet saknas.
 *  Reserv: PNG laddas ner via exportmenyns väg. */
// Går alltid genom exportläget (ADR-51): djupräknaren håller skärmen i exportläget tills den sista pågående exporten är klar.
function kopieraRapportDiagram(...a) { return medExportLage(() => _kopieraRapportDiagramExport.apply(null, /** @type {any} */ (a))); }
async function _kopieraRapportDiagramExport(id) {
    const def = _rapportDiagramLista(_rapportParLage.harPar, _rapportParLage.exkluderade).find(g => g.id === id)
        || (id !== 'chart-likvardighet-heatmap' ? RAPPORT_DIAGRAM.find(g => g.id === id) : null);
    if (!def) return 'saknas';
    // Ritas alltid om: ett tidigare ritat diagram kan gälla ett annat urval än blocken.
    try { renderTabContent(def.flik); } catch (_e) { /* ritas inte — hanteras nedan */ }
    const gd = document.getElementById(id);
    if (!diagramRitat(gd)) return 'saknas';
    if (navigator.clipboard && navigator.clipboard.write && typeof ClipboardItem !== 'undefined') {
        try {
            // Urklippet begärs direkt i klicket och får bilden som ett löfte: Safari nekar
            // skrivningen om klicket hunnit "förbrukas" medan bilden renderades.
            const bild = diagramTillBild(gd, { bredd: 1600, hojd: 900 })
                .then(_dataUrlTillBlob);
            bild.catch(() => {});   // avvisas skrivningen utan att läsa löftet: ingen ohanterad avvisning
            await navigator.clipboard.write([new ClipboardItem({ 'image/png': bild })]);
            return 'urklipp';
        } catch (_e) { /* nekat — ladda ner i stället */ }
    }
    try {
        await _diagramexportBild(gd, 'png-dokument');
        return 'nedladdat';
    } catch (_e) {
        return 'fel';
    }
}

/** Det som körs vid laddning, i filens ordning; src/app/index.js anropar delarnas uppstart i sifferordning. */
export function uppstartRapportunderlag() {
    document.addEventListener('click', async e => {
        const knapp = /** @type {HTMLElement} */ (e.target).closest('#btn-ru-kopiera-avsnitt');
        if (!knapp) return;
        const utfall = await kopieraRapportAvsnitt();
        _rapportKvitto(knapp, utfall === 'urklipp' ? 'Kopierat' : utfall === 'markerat' ? 'Markerat — tryck Ctrl+C' : 'Kunde inte kopiera');
    });
    document.addEventListener('click', async e => {
        const knapp = /** @type {HTMLElement} */ (e.target).closest('[data-rapport-kopiera]');
        if (!knapp) return;
        const utfall = await kopieraRapportBlock(/** @type {HTMLElement} */ (knapp).dataset.rapportKopiera);
        _rapportKvitto(knapp, utfall === 'urklipp' ? 'Kopierat' : utfall === 'markerat' ? 'Markerat — tryck Ctrl+C' : 'Kunde inte kopiera');
    });
    document.addEventListener('click', async e => {
        const knapp = /** @type {HTMLElement} */ (e.target).closest('[data-rapport-diagram]');
        if (!knapp) return;
        const utfall = await kopieraRapportDiagram(/** @type {HTMLElement} */ (knapp).dataset.rapportDiagram);
        _rapportKvitto(knapp, utfall === 'urklipp' ? 'Kopierat som bild'
            : utfall === 'nedladdat' ? 'Bilden laddades ner'
            : utfall === 'fel' ? 'Kunde inte skapa bilden — använd exportmenyn i diagrammet'
            : 'Diagrammet finns inte för det här underlaget');
    });
}

// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
// ---- Rapportunderlag (ADR-20): kopierbara block för en egen Word-mall ----
// Faktastycken, rena tabeller och diagram som klistras in i kommunens mall.
// Bedömningen (sakliga skäl) skrivs av verksamheten — här finns bara underlaget.
// Blocken byggs i src/lib/rapportunderlag.js (_ru*); här hämtas resultaten ur de
// befintliga analyserna och kopieringen till urklipp sköts.

// Diagram som kan kopieras som bild: id på diagrammet och fliken som ritar det.
const RAPPORT_DIAGRAM = [
    { id: 'chart-skevhet-overview', rubrik: 'Lönegap per BAS-intervall', flik: 'matrix' },
    { id: 'chart-perbas-gap', rubrik: 'Oförklarat gap per BAS-intervall', flik: 'matrix' },
    { id: 'chart-likvardighet-heatmap', rubrik: 'Kandidatpar i likvärdigt arbete', flik: 'likvardighet' },
];

let _rapportBlockSenast = new Map();
let _rapportParLage = { harPar: false, exkluderade: 0 };

// Kandidatparens diagram visar alla par i fliken — även par med en grupp under k, som
// underlaget inte redovisar. Det erbjuds därför bara när inget par har uteslutits.
// Maxantalet par som likvärdighetsberäkningen tar fram (samma standard som 34).
function _ruTopN() { return (state.likvardighet && state.likvardighet.topN) ?? 100; }

function _rapportDiagramLista(harPar, exkluderade) {
    return RAPPORT_DIAGRAM.filter(g => g.flik !== 'likvardighet' || (harPar && !exkluderade));
}

// Handlingsplanens rader för rapportunderlaget. Förifyllningen (_handlingsplanSeedRows) tar
// redan bort par med en grupp under k, så raderna används som de är — en enda regel för
// skärmen, Excel, utskriften och underlaget.
function _rapportHpRader(seedRows) {
    return seedRows.map(r => ({ atgard: r[0], grupp: r[1], underlag: _handlingsplanUnderlag(r[2]), kostnad: r[4] }));
}

/** Alla textblock i den ordning de visas: avsnitt, yrkesgrupper, kandidatpar. */
// Går alltid genom exportläget (ADR-51): djupräknaren håller skärmen i exportläget tills den sista pågående exporten är klar.
function rapportunderlagBlock(...a) { return medExportLage(() => _rapportunderlagBlockExport.apply(null, /** @type {any} */ (a))); }
function _rapportunderlagBlockExport() {
    const d = getData();
    if (!d.length) return [];
    const k = kTroskel();
    const opt = { k, urval: 'Hela organisationen', demo: !!state.isDemo, troskelNot: _kSanktNot() || undefined };
    const arKv = r => r.kon.includes('kvinna');
    const arMa = r => !arKv(r) && (r.kon.includes('man') || r.kon.includes('män'));

    // Sammanfattning
    const kvLon = d.filter(arKv).map(r => r.lon), maLon = d.filter(arMa).map(r => r.lon);
    const reg = runOLSRegression();
    const uk = bedomningUnderlag({ reg });
    const sammanfattning = {
        n: d.length, nKv: kvLon.length, nMa: maLon.length, medKv: Stat.median(kvLon), medMa: Stat.median(maLon),
        oforklarat: reg.error ? null : { pct: reg.konPct, lo: reg.konPctLow, hi: reg.konPctHigh, medBas: reg.modelName === 'full' },
        kvalitet: uk ? { status: uk.status, brister: uk.kriterier.filter(c => c.status !== 'ok').map(c => c.namn) } : null,
    };

    // Lika arbete — samma grupper som EU-tabellen
    const lika = _ruLikaArbeteGrupper(d, { k, troskel: 5 });

    // Likvärdigt arbete — par med en grupp under k redovisas inte (fliken är undantagen från k, underlaget inte)
    /** @type {any} */ let lv = null;
    try { lv = likvardighetResultat(); } catch (_e) { lv = null; }
    const { par, utelamnade: parUtelamnade } = _parForRedovisning(lv && lv.pairs);
    // Maxantalet som resultatet faktiskt räknades med (faller tillbaka på inställningen).
    const topN = (lv && lv.opts && lv.opts.topN) ?? _ruTopN();
    const kravProxy = (lv && lv.diagnostik && lv.diagnostik.jämförelse && lv.diagnostik.jämförelse.kravProxy) || 'bas';

    // Struktur
    const representation = (_stRepresentationByBas(d, { k: kTroskel() }) || []).slice().sort((a, b) => String(a.bas).localeCompare(String(b.bas), 'sv'));
    const kvartiler = _stQuartileDistribution(d, { k: kTroskel() }) || [];
    _rapportParLage = { harPar: par.length > 0, exkluderade: parUtelamnade };

    // Handlingsplan — samma förifyllning som fliken (som redan utelämnar par under k)
    const hpRader = _rapportHpRader(_handlingsplanSeedRows().rows);

    /** @type {any[]} */
    const block = [
        _ruAvsnittBlock('sammanfattning', sammanfattning, { ...opt, troskelNot: kStampel() }),
        _ruAvsnittBlock('uppdelning', _guGapUppdelning(d, { k }), opt),
        _ruAvsnittBlock('lika', lika, opt),
        _ruAvsnittBlock('likvardigt', { par, exkluderade: parUtelamnade, kravProxy,
            kvinnoTroskel: (state.likvardighet && state.likvardighet.kvinnoTrosholdPct) ?? 60, topN }, opt),
        _ruAvsnittBlock('lagreKrav', {
            par: ((lv && lv.lagreKrav) || []).filter(_parOverTroskel),
            exkluderade: ((lv && lv.lagreKrav) || []).filter(p => !_parOverTroskel(p)).length,
            kravProxy, topN }, opt),
        _ruAvsnittBlock('struktur', { representation, kvartiler, nKv: kvLon.length, nMa: maLon.length }, opt),
        _ruAvsnittBlock('sektorer', { sektorer: _skSektorsTabell(d, { k, skrDel: _skrDel() }), andel: _skSektorernasAndel(d, { k }) }, opt),
        _ruAvsnittBlock('handlingsplan', { rader: hpRader, summa: hpRader.reduce((s, r) => s + (r.kostnad || 0), 0) }, opt),
    ];
    const referenser = referensOverblick();
    if (referenser) block.push(_ruReferenserBlock(referenser, opt));
    lika.grupper.filter(g => g.flaggad).forEach((g, i) => {
        const rader = d.filter(r => r.yrke === g.yrke);
        const ki = _gdBootstrapGapCI(rader.filter(arKv).map(r => r.lon), rader.filter(arMa).map(r => r.lon));
        const arsbelopp = _prArsbeloppMening(g, state.costSettings, v => _figTalformat(Math.round(v), 'kr'));
        block.push(_ruGruppBlock(g, { ...opt, id: `yrke:${i}`, justerat: _ruJusteratGap(rader, { k: statGolv() }), ki, arsbelopp }));
    });
    par.forEach((p, i) => block.push(_ruParBlock(p, { ...opt, id: `par:${i}`, kravProxy })));
    // Jämförelsen med förra året (ADR-54), när ett bokslut är inläst.
    if (typeof arsjamforelse === 'function' && typeof _ruArsjamforelseBlock === 'function') {
        const jf = arsjamforelse();
        if (jf) block.push(_ruArsjamforelseBlock(jf.j, { ...opt, forraAr: jf.forra.ar, nuAr: jf.nu.ar }));
    }
    // Egna tabeller (ADR-52): ett block per tabell, ur samma recept som Word-utkastet, PDF-rapporten och Excel.
    (state.rapportTabeller || []).forEach((r, i) => {
        if (typeof _trTabeller !== 'function' || typeof _ruEgenTabellBlock !== 'function') return;
        _trTabeller(d, r, { k }).forEach((t, j) => block.push(_ruEgenTabellBlock(t, { ...opt, id: `egen:${i}:${j}` })));
    });
    return block;
}

function renderRapportunderlag() {
    const host = document.getElementById('rapportunderlag-innehall');
    if (!host) return;
    // Samverkansknapparna exporterar underlag — inaktiva tills data finns.
    document.querySelectorAll('[data-dok-klick]').forEach(b => { /** @type {HTMLInputElement} */ (b).disabled = !getData().length; });
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
                <div class="ru-innehall">${_ruTillWordHtml(b)}</div>
                <div class="ru-atgard">
                    <button type="button" class="btn btn-secondary btn-sm" data-rapport-kopiera="${esc(b.id)}">Kopiera</button>
                    <span class="ru-kvitto" role="status"></span>
                </div>
            </article>`).join('')
        : '';
    const avsnitt = block.filter(b => !b.id.includes(':'));
    const yrken = block.filter(b => b.id.startsWith('yrke:'));
    const parBl = block.filter(b => b.id.startsWith('par:'));
    const egna = block.filter(b => b.id.startsWith('egen:'));
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
        + toc('Avsnitt', avsnitt) + toc('Yrkesgrupper', yrken) + toc('Kandidatpar', parBl) + toc('Egna tabeller', egna) + `</ul>`
        + `<div class="ru-atgard"><button type="button" class="btn btn-secondary btn-sm" id="btn-ru-kopiera-avsnitt">Kopiera alla avsnitt</button>`
        + `<span class="ru-kvitto" role="status"></span></div><div id="ru-alla-avsnitt" class="ru-alla-avsnitt" hidden></div></nav>`;
    host.innerHTML = forteckning + grupp('Avsnitt', avsnitt) + grupp('Yrkesgrupper i Lika arbete', yrken)
        + grupp('Kandidatpar i Likvärdigt arbete', parBl) + grupp('Egna tabeller från Utforska', egna)
        + `<h3 class="ru-grupprubrik">Diagram</h3>${diagram}`;
}

// Blockets element-id för hopplänkar (block-id:n innehåller ':').
function _ruBlockId(id) { return 'ru-' + String(id).replace(/[^A-Za-z0-9_-]/g, '-'); }

/** Kopierar alla avsnittsblock (utan yrkes- och parblock) i en kopiering. */
// Går alltid genom exportläget (ADR-51): djupräknaren håller skärmen i exportläget tills den sista pågående exporten är klar.
function kopieraRapportAvsnitt(...a) { return medExportLage(() => _kopieraRapportAvsnittExport.apply(null, /** @type {any} */ (a))); }
async function _kopieraRapportAvsnittExport() {
    const avsnitt = [..._rapportBlockSenast.values()].filter(b => !b.id.includes(':'));
    if (!avsnitt.length) return 'saknas';
    const html = avsnitt.map(b => _ruTillWordHtml(b)).join('\n');
    const text = avsnitt.map(b => _ruTillText(b)).join('\n\n');
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

document.addEventListener('click', async e => {
    const knapp = /** @type {HTMLElement} */ (e.target).closest('#btn-ru-kopiera-avsnitt');
    if (!knapp) return;
    const utfall = await kopieraRapportAvsnitt();
    _rapportKvitto(knapp, utfall === 'urklipp' ? 'Kopierat' : utfall === 'markerat' ? 'Markerat — tryck Ctrl+C' : 'Kunde inte kopiera');
});

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
    const html = _ruTillWordHtml(b), text = _ruTillText(b);
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

document.addEventListener('click', async e => {
    const knapp = /** @type {HTMLElement} */ (e.target).closest('[data-rapport-kopiera]');
    if (!knapp) return;
    const utfall = await kopieraRapportBlock(/** @type {HTMLElement} */ (knapp).dataset.rapportKopiera);
    _rapportKvitto(knapp, utfall === 'urklipp' ? 'Kopierat' : utfall === 'markerat' ? 'Markerat — tryck Ctrl+C' : 'Kunde inte kopiera');
});

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
        await _chartExportImage(gd, 'png-dokument');
        return 'nedladdat';
    } catch (_e) {
        return 'fel';
    }
}

document.addEventListener('click', async e => {
    const knapp = /** @type {HTMLElement} */ (e.target).closest('[data-rapport-diagram]');
    if (!knapp) return;
    const utfall = await kopieraRapportDiagram(/** @type {HTMLElement} */ (knapp).dataset.rapportDiagram);
    _rapportKvitto(knapp, utfall === 'urklipp' ? 'Kopierat som bild'
        : utfall === 'nedladdat' ? 'Bilden laddades ner'
        : utfall === 'fel' ? 'Kunde inte skapa bilden — använd exportmenyn i diagrammet'
        : 'Diagrammet finns inte för det här underlaget');
});

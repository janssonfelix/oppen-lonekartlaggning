// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
// ---- PDF-rapporten (utskrift): rapportmodellen som låst kopia, med flikarnas tabeller som bilagor ----
/**
 * Hjälpklasserna (src/style.css, "Hjälpklasser") för utskriftsfönstret, som inte har verktygets stilmall: utan dem
 * tappar en utskriven flik sin högerjustering och sin dämpade text. tests/farger.test.js håller listan lika med stilmallens.
 */
const HJALPKLASSER_CSS = '.t-hoger{text-align:right}.t-mitt{text-align:center}.t-tal{text-align:right;font-variant-numeric:tabular-nums}'
    + `.f-dampad{color:${FARG.dampad}}.f-kritisk{color:${FARG.kritisk}}.st-088{font-size:0.88rem}.st-085{font-size:0.85rem}.st-09{font-size:0.9rem}`
    + '.mb-14{margin-bottom:14px}.mb-10{margin-bottom:10px}.mb-16{margin-bottom:16px}.mt-8{margin-top:8px}.mt-14{margin-top:14px}.m-0{margin:0}.mr-6{margin-right:6px}'
    + '.faltkolumn{display:flex;flex-direction:column;gap:3px;font-size:0.85rem}'
    + `.finstilt{font-size:0.78rem;color:${FARG.dampad};margin-top:4px}.etikett-versal{font-size:0.78rem;color:${FARG.dampad};text-transform:uppercase;letter-spacing:0.05em}`
    + '.fk-cell{padding:6px 12px 6px 0}.fk-ikon{font-size:1.4rem}.block-mb6{display:block;margin-bottom:6px}.underrubrik{margin:0 0 8px;font-size:0.95rem}';

/**
 * Reglerna för det som flikarnas mallar bär som klasser i stället för style-attribut: stilmallens variabler (:root) och allt
 * från hjälpklassbiblioteket (".dold", första raden i blocket "Hjälpklasser som ersätter style-attributen" i src/style.css)
 * till stilmallens slut. Utskriftsfönstret har inte verktygets stilmall, så utan dem tappar de klonade vyerna sina rader,
 * rutnät, avstånd och dämpade text. Läses ur den körande stilmallen, så att biblioteket har en enda källa. Villkorsregler
 * (@media) följer inte med: fönstret är ett utskriftsfönster med ljust tema. Tomt om stilarken inte går att läsa.
 */
function bibliotekCssForUtskrift() {
    let ut = '';
    try {
        for (const ark of document.styleSheets) {
            let inne = false;
            for (const r of ark.cssRules) {
                if (r.type !== 1) continue;
                if (/** @type {CSSStyleRule} */ (r).selectorText === ':root') ut += r.cssText;
                else if (/** @type {CSSStyleRule} */ (r).selectorText === '.dold.dold.dold') inne = true;
                if (inne) ut += r.cssText;
            }
        }
    } catch (_e) { /* stilarket går inte att läsa: HJALPKLASSER_CSS räcker för det som är kvar */ }
    return ut;
}

// Går alltid genom exportläget (ADR-51): djupräknaren håller skärmen i exportläget tills den sista pågående exporten är klar.
function buildPrintReport(...a) { return medExportLage(() => _buildPrintReportExport.apply(null, /** @type {any} */ (a))); }
async function _buildPrintReportExport() {
    if (!getData().length) { alert('Ladda upp data först.'); return; }
    showLoading();
    try {
        // Rapporten är rapportmodellen med gällande urval — samma innehåll som Word-utkastet (58-rapportmodell.js).
        const bada = rapportModellBada(), modell = bada.urval;
        const ritade = new Set(), bilder = new Map();
        for (const del of modell.avsnitt.flatMap(a => a.delar.filter(p => p.typ === 'diagram'))) {
            const b = await rmDiagramBild(del, ritade);
            if (b) bilder.set(del.id, b);
        }
        const helaDokumentationen = modell.avsnitt.length === bada.alla.avsnitt.length;
        let bilagor = '';
        if (helaDokumentationen) {
            // Bilagor med flikarnas egna tabeller och diagram — underlaget bakom avsnitten. De följer bara med när hela
            // dokumentationen är vald; ett kortare urval (ledningsbrief, facklig dialog) är just avsnitten.
            generateRapport();
            generateSkevhet();
            generateEUDirectiveMatrix();
            if (state.statistik.length) generateBenchmark();
            const imgs = {};
            renderKon('__ALLA__');
            await new Promise(r => setTimeout(r, 250));
            for (const [nyckel, id, hojd] of [['kon', 'chart-kon-scatter', 600], ['box', 'chart-kon-boxplot', 500], ['tathet', 'chart-kon-tathet', 560]]) {
                const elD = document.getElementById(String(id));
                if (diagramRitat(elD)) { try { imgs[nyckel] = await diagramTillBild(elD, { bredd: 1400, hojd, utanRubrik: true }); } catch (e) { rapporteraFel(`utskrift: ${id}`, e); } }
            }
            const cloneTable = id => { const t = exportElement(id); return t ? _exportVisaAllaRader(t.cloneNode(true)).outerHTML : ''; };   // genom exportgrinden; hopfällda rader följer med
        const matrixSection   = `<section class="page-break"><h2>Lika arbete – kvinnor och män i samma yrke (EU 2023/970)</h2><p>Yrkesgrupper med &gt; 5% osaklig löneskillnad är anmälningspliktiga.</p>${cloneTable('matrix-table')}</section>`;
        const skevhetSection  = `<section class="page-break"><h2>Lönegap per BAS-intervall (&gt; 5%)</h2>${cloneTable('paygap-table')}<h2 class="pr-ned">Ojämn könsfördelning (under 40 % av ett kön)</h2>${cloneTable('skevhet-table')}</section>`;
            const bildSektion = (rubrik, src, alt) => (src ? `<section class="page-break"><h2>${rubrik}</h2><img src="${src}" alt="${alt}"></section>` : '');
        const rapportSection  = `<section class="page-break"><h2>Löneöversikt (organisation · kön · yrke)</h2>${cloneTable('rapport-table')}</section>`;
        const bmSection       = state.statistik.length ? `<section class="page-break"><h2>Jämförelse mot ${esc(_jmfKallaNamn(jamforelseAktivKalla()))}${jamforelseUrvalText() ? ` (${esc(jamforelseUrvalText())})` : ''}</h2>${cloneTable('benchmark-table')}</section>` : '';
        const bilagaSection   = `
            <section class="page-break">
                <h2>Bilaga: Metodik &amp; urval (kvalitetssäkring)</h2>
                <p class="pr-dampad">Detalj över varje analys, formler och vilka rader som ingått. Använd för revision och kvalitetskontroll av resultaten.</p>
                ${Object.entries(auditRegistry).map(([_id, a]) => {
                    const fmtN = n => n.toLocaleString('sv-SE');
                    const exclRows = [...(a.parseExcl||[]), ...(a.analysisExclusions||[])]
                        // Texten kan innehålla referensens namn (ur fil eller organisationspaket):
                        // taggar tas bort och resten escapas, så att en halv tagg inte kan leva kvar.
                        .map(([r,c]) => `<tr><th>− ${esc(String(r).replace(/<[^>]+>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&'))}</th><td>${fmtN(c)}</td></tr>`).join('');
                    const used = a.usedInAnalysis !== undefined ? a.usedInAnalysis : a.afterFilter;
                    const formler = (a.formler||[]).map(([n,d]) => `<li><strong>${n}:</strong> ${d.replace(/<[^>]+>/g, '')}</li>`).join('');
                    const notes = (a.notes||[]).map(n => `<li>${n.replace(/<[^>]+>/g, '')}</li>`).join('');
                    return `
                        <h3 class="pr-ned-14">${a.title}</h3>
                        <table class="kpi pr-under">
                            <tr><th>Total i datafilen</th><td>${fmtN(a.totalRaw)}</td></tr>
                            ${exclRows}
                            <tr><th><strong>= Använda i denna analys</strong></th><td><strong>${fmtN(used)}</strong></td></tr>
                        </table>
                        ${formler ? `<p class="pr-tat"><strong>Formler:</strong></p><ul>${formler}</ul>` : ''}
                        ${notes ? `<p class="pr-tat"><strong>Speciella regler:</strong></p><ul>${notes}</ul>` : ''}
                    `;
                }).join('')}
            </section>`;
            bilagor = `<section class="page-break"><h1 class="pr-liten-rubrik">Bilagor: tabeller och diagram ur flikarna</h1>
                <p class="pr-dampad">Underlaget bakom avsnitten, som det står i verktygets flikar. Grupper under tröskeln är utelämnade på samma sätt som där.</p></section>`
                + matrixSection + skevhetSection
                + bildSektion('Löneutveckling mot ålder (alla BAS-intervall)', imgs.kon, 'Punktdiagram: lön mot ålder per kön')
                + bildSektion('Lönefördelning per kön', imgs.box, 'Lådagram över lönefördelningen')
                + bildSektion('Lönefördelningen per BAS-intervall', imgs.tathet, 'Täthetskurvor över lönerna per BAS-intervall')
                + rapportSection + bmSection + bilagaSection;
        }
        // Tröskeln står i metodbilagan; saknas den i urvalet står den som en egen rad sist.
        const harMetod = modell.avsnitt.some(a => a.id === 'metod');
        const kStampelRad = harMetod ? '' : `<p class="k-stampel pr-stampel">${esc(kStampel())}</p>`;
        const root = /** @type {HTMLElement} */ (document.getElementById('print-report'));
        root.innerHTML = _kSanktStycke() + rmTillHtml(modell, { utskrift: true, bilder }) + kStampelRad + bilagor;
        tillampaDataStil(root);   // staplarna i de klonade tabellerna bär måttet som data-stil-*; style-attribut i markeringen stoppas av CSP:n

        document.body.classList.add('print-mode');
        hideLoading();
        await new Promise(r => setTimeout(r, 200));
        window.print();
        // Klassen tas bort när utskriftsdialogen stängts (afterprint nedan); tidsgränsen är för webbläsare utan händelsen.
        setTimeout(() => document.body.classList.remove('print-mode'), 1000);
    } catch (err) {
        hideLoading();
        document.body.classList.remove('print-mode');
        alert('Fel vid PDF-generering: ' + err.message);
    }
}

document.getElementById('btn-export-pdf')?.addEventListener('click', buildPrintReport);

// ====================================================================
// Word-utkast: redigerbar §§ 8–14-dokumentation ("sista milen")
// --------------------------------------------------------------------
// Producerar hela dokumentationsskelettet (DiskrL kap. 3) som en REDIGERBAR
// .doc-fil: verktygets fynd är ifyllda och de kvalitativa bedömningar lagen
// ålägger ARBETSGIVAREN (§8-praxis, sakliga skäl, kravvärdering, beslut,
// samverkan) markeras som gula [HR fyller i …]-block. HR öppnar i Word,
// kompletterar och äger slutdokumentet — inget lagras, inget skickas (samma
// lokal-only-princip som övriga exporter; .doc byggs som en lokal Blob).
// ====================================================================



// Skriv ut en scaffold-flik (§ 8-checklista / handlingsplansmall) i ett rent
// fönster med alla <details> expanderade. Offlinesäkert: inga nätverksanrop,
// inga skript i utskriftsdokumentet.
function printScaffoldView(viewId, heading) {
    const view = document.getElementById(viewId);
    if (!view) return;
    const clone = view.cloneNode(true);
    /** @type {HTMLElement} */ (clone).querySelectorAll('details').forEach(d => d.setAttribute('open', ''));
    /** @type {HTMLElement} */ (clone).querySelectorAll('[data-noprint], .flow-next-bar, .flik-intro-mer').forEach(el => el.remove());   // som skärmens utskriftsregel: stegknappen och «Visa mer» gör inget i ett fönster utan skript
    // cloneNode kopierar inte form-fältens AKTUELLA värde — synka in dem så att
    // ifyllda bedömningar/anteckningar (t.ex. § 8-ställningen) faktiskt skrivs ut.
    /** @type {HTMLElement} */ (clone).querySelectorAll('select[id]').forEach(sel => {
        const orig = document.getElementById(sel.id);
        if (orig) [.../** @type {HTMLSelectElement} */ (sel).options].forEach((o, i) => { if (i === /** @type {HTMLSelectElement} */ (orig).selectedIndex) o.setAttribute('selected', 'selected'); else o.removeAttribute('selected'); });
    });
    /** @type {HTMLElement} */ (clone).querySelectorAll('textarea[id]').forEach(ta => {
        const orig = document.getElementById(ta.id);
        if (orig) ta.textContent = /** @type {HTMLInputElement} */ (orig).value;
    });
    const w = window.open('', '_blank');
    if (!w) { alert('Tillåt popup-fönster för att skriva ut.'); return; }
    const css = HJALPKLASSER_CSS + bibliotekCssForUtskrift() + `body{font-family:system-ui,-apple-system,Arial,sans-serif;max-width:860px;margin:24px auto;padding:0 18px;color:${FARG.text};line-height:1.55}`
        + 'h1{font-size:1.4rem;margin:0 0 4px}h4{margin:10px 0 4px;font-size:0.95rem}ul{margin:4px 0 10px 22px}'
        + `summary{font-weight:600;margin-top:14px;font-size:1.05rem}details{border-bottom:1px solid ${FARG.kant};padding-bottom:8px}`
        + `table{border-collapse:collapse;width:100%;margin:10px 0;font-size:0.85rem}th,td{border:1px solid ${FARG.kantStark};padding:6px 8px;text-align:left;vertical-align:top}`
        + `.flik-intro strong{display:block;font-size:1.15rem;margin-bottom:6px}.card{margin:14px 0}.foot{margin-top:24px;font-size:0.8rem;color:${FARG.svag}}`
        + '.handlingsplan-empty td{height:40px}';   // rader att fylla i för hand
    // Fönstret får en egen CSP (utan skript), och stilarna läggs in via CSSOM i stället för
    // ett <style>-block: fönstret ärver verktygets CSP, där <style>-element kräver kontrollsumma (se nedan: byggt stilark).
    w.document.write('<!DOCTYPE html><html lang="sv"><head><meta charset="utf-8">'
        + '<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; style-src \'unsafe-inline\'; img-src data: blob:;">'
        + '<title>' + esc(heading) + '</title></head><body><h1>Lönekartläggning — ' + esc(heading) + '</h1>'
        // Handlingsplanen är förifylld med gruppmått (årskostnad per yrkesgrupp/par); checklistan har inga
        + (viewId === 'view-handlingsplan' ? _kSanktStycke() : '')
        + /** @type {HTMLElement} */ (clone).innerHTML
        + '<p class="foot">Utskrivet ur Öppen lönekartläggning. Dokumentera bedömningar och åtgärder i lönekartläggningsrapporten (Word).</p></body></html>');
    w.document.close();
    try {
        if (typeof /** @type {any} */ (w).CSSStyleSheet === 'function' && 'adoptedStyleSheets' in w.document) {
            // Ett byggt stilark (constructable stylesheet) träffas inte av style-src: fönstret ärver verktygets CSP, och ett
            // <style>-element som skriptet skapar får inget ark där (Chromium: document.styleSheets.length === 0).
            const ark = new /** @type {any} */ (w).CSSStyleSheet();
            ark.replaceSync(css);
            w.document.adoptedStyleSheets = [ark];
        } else {
            const stil = w.document.createElement('style');
            w.document.head.appendChild(stil);
            const ark = /** @type {CSSStyleSheet} */ (stil.sheet);
            css.split('}').filter(r => r.trim()).forEach(r => ark.insertRule(r + '}', ark.cssRules.length));
        }
    } catch (_e) { /* utskriften fungerar även utan stilarna */ }
    w.focus();
    setTimeout(() => { try { w.print(); } catch (_e) {} }, 250);
}
// Generisk koppling: knappar med data-print-view="<viewId>" data-print-title="..."
document.addEventListener('click', e => {
    const btn = /** @type {HTMLElement} */ (e.target).closest('[data-print-view]');
    if (!btn) return;
    printScaffoldView(btn.getAttribute('data-print-view'), btn.getAttribute('data-print-title') || 'Checklista');
});

// Webbläsarens egen utskrift (Ctrl+P) skriver ut den aktiva fliken. Hopfällda avsnitt går inte att fälla ut i
// stilmallen, så de öppnas före utskriften och fälls tillbaka efteråt. PDF-rapporten (body.print-mode) berörs inte.
function _utskriftFore() {
    if (document.body.classList.contains('print-mode')) return;
    document.querySelectorAll('.view-panel details:not([open])').forEach(d => {
        if (/** @type {HTMLElement} */ (d.closest('.view-panel')).style.display === 'none') return;
        /** @type {HTMLDetailsElement} */ (d).open = true;
        d.setAttribute('data-oppnad-for-utskrift', '');
    });
}
function _utskriftEfter() {
    document.body.classList.remove('print-mode');
    document.querySelectorAll('details[data-oppnad-for-utskrift]').forEach(d => {
        /** @type {HTMLDetailsElement} */ (d).open = false;
        d.removeAttribute('data-oppnad-for-utskrift');
    });
}
window.addEventListener('beforeprint', _utskriftFore);
window.addEventListener('afterprint', _utskriftEfter);

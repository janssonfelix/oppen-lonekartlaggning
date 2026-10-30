// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
// ====================================================================
// 70-utforska.js — Utforska: egna vyer
//
// Användaren väljer rader, ev. kolumner, mått, diagramtyp och urval (72-utforska-urval.js) och får
// diagram + tabell direkt. All beräkning sker i src/lib/utforska.js (speglad som
// _utComputePivot m.fl.); figurerna byggs i 71-utforska-figur.js.
//
// SMÅ GRUPPER (ADR-14, ADR-51): på skärmen visas alla grupper som andra (kTroskel() är 1 där); i exportläget
// märks grupper under tröskeln med klassen explore-liten, som exporten läser. Den som använder verktyget har
// redan rådatan; skyddet gäller det som LÄMNAR verktyget. Exporten — tabellens CSV/urklipp och diagrammets exportmeny —
// utelämnar dem därför om inte rutan "Ta med grupper under k" är ikryssad.
// ====================================================================

const EXPLORE_DIM_LABEL = {
    bas: 'BAS-intervall', aid: 'Yrkesgrupp (AID)', alder: 'Åldersgrupp', kon: 'Kön',
    aidbas: 'Yrkesgrupp inom BAS', lonespann: 'Lönespann', alla: 'Hela urvalet',
    sektor: 'Sektor (AID-huvudområde)', aidniva: 'AID-mellannivå'
};
const EXPLORE_MATT_LABEL = {
    median: 'Median månadslön', medel: 'Medellön', n: 'Antal (n)',
    p10: 'P10', p25: 'P25', p75: 'P75', p90: 'P90',
    spridning: 'Spridning (P90/P10)', andelKv: 'Andel kvinnor (%)', gap: 'Kvinnors median i % av mäns'
};
// dim = hur många dimensioner diagramtypen kräver.
const EXPLORE_TYPER = {
    staplar:    { label: 'Staplar', dim: 1 },
    liggande:   { label: 'Liggande staplar', dim: 1 },
    hantel:     { label: 'Hanteldiagram', dim: 1 },
    bubbla:     { label: 'Bubbeldiagram', dim: 1 },
    lada:       { label: 'Låddiagram', dim: 1 },
    punkter:    { label: 'Individpunkter', dim: 1 },
    svarm:      { label: 'Punktsvärm', dim: 1 },
    regnmoln:   { label: 'Regnmoln', dim: 1 },
    kvantilpunkter: { label: 'Kvantilpunkter', dim: 1 },
    heatmap:    { label: 'Heatmap', dim: 2 },
    grupperade: { label: 'Grupperade staplar', dim: 2 },
    staplade:   { label: 'Staplade staplar', dim: 2 }
};
// Staplade staplar visar alltid antal: en stapel per rad, ett segment per kolumnvärde — i antal eller som andel
// av raden. Fler kolumnvärden än så här går inte att läsa som segment.
const EXPLORE_STAPLADE_MAX = 12;
// Diagramtyper som alltid visar median/lönerna själva — måttvalet gäller inte.
const EXPLORE_LASTA_MATT = new Set(['bubbla', 'lada', 'punkter', 'svarm', 'regnmoln', 'kvantilpunkter']);
// Mått som redan jämför könen och därför inte går att dela upp per kön.
const EXPLORE_KON_MATT = new Set(['andelKv', 'gap']);

/** @type {{model: any, typ: string, rows: any[]}|null} */
let _explorerState = null;            // { model, typ, rows } — senaste rendering

function _exploreFmt(v, matt) {
    if (v == null || !isFinite(v)) return '–';
    if (matt === 'n') return Math.round(v).toLocaleString('sv-SE');
    if (matt === 'gap' || matt === 'andelKv') {
        return v.toLocaleString('sv-SE', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' %';
    }
    if (matt === 'spridning') return v.toLocaleString('sv-SE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return Math.round(v).toLocaleString('sv-SE') + ' kr';
}

/** Varför en diagramtyp inte går att välja just nu, eller null om den går. */
function explorerTypSkal(typ, spec, urval) {
    const def = EXPLORE_TYPER[typ];
    if (!def) return 'Okänd diagramtyp.';
    if (def.dim === 2 && !spec.kolumn) return 'Kräver att Kolumner är vald.';
    if (def.dim === 1 && spec.kolumn) return 'Fungerar bara med en dimension. Välj Kolumner: Ingen.';
    if (typ === 'hantel') {
        if (EXPLORE_KON_MATT.has(spec.matt)) return 'Hanteldiagrammet jämför kvinnor och män och kräver ett lönemått.';
        if (spec.rad === 'kon') return 'Raderna är redan kön. Välj en annan dimension.';
        if (urval && (!urval.nKv || !urval.nMa)) return 'Urvalet innehåller bara ett kön.';
    }
    if (typ === 'bubbla' && spec.rad === 'kon') return 'Andel kvinnor per kön säger ingenting. Välj en annan dimension.';
    return null;
}
// Automatiskt val. Ett lönemått per kön visas som hantel: avståndet mellan kvinnors och mäns värde syns direkt, och
// axeln behöver inte börja på noll som för staplar — där några tusen kronors skillnad knappt går att se.
function explorerAutoTyp(spec, urval) {
    if (spec.kolumn) return 'heatmap';
    if (spec.delaKon && !EXPLORE_KON_MATT.has(spec.matt) && spec.matt !== 'n' && spec.matt !== 'spridning'
        && !explorerTypSkal('hantel', spec, urval)) return 'hantel';
    return 'staplar';
}

/**
 * Om valet Helhet/Per kön är låst av diagramtypen, måttet eller dimensionerna:
 * { tvingad: 'helhet'|'kon', skal } — annars { tvingad: null, skal: null }.
 * Användarens eget val lämnas orört, så det gäller igen när låsningen släpper.
 */
function explorerVisaSkal(spec, typ, urval) {
    if (typ === 'hantel') return { tvingad: 'kon', skal: 'Hanteldiagrammet visar alltid kvinnor och män.' };
    if (typ === 'bubbla') return { tvingad: 'helhet', skal: 'Bubbeldiagrammet visar andel kvinnor och är alltid en helhet.' };
    if (typ === 'staplade') return { tvingad: 'helhet', skal: 'Staplade staplar visar sammansättningen som en helhet. Välj Kön som kolumn för att dela upp på kön.' };
    if (spec.rad === 'kon' || spec.kolumn === 'kon') return { tvingad: 'helhet', skal: 'Kön är redan en av dimensionerna.' };
    if (EXPLORE_KON_MATT.has(spec.matt) && !EXPLORE_LASTA_MATT.has(typ)) {
        return { tvingad: 'helhet', skal: 'Måttet jämför redan könen.' };
    }
    if (urval && (!urval.nKv || !urval.nMa)) return { tvingad: 'helhet', skal: 'Urvalet innehåller bara ett kön.' };
    return { tvingad: null, skal: null };
}

// Användarens eget val i "Visa". När valet är låst visar listan det som gäller
// och minns önskemålet i data-onskad; ändras listan under tiden (till något
// annat än det låsta) är det det nya önskemålet.
function _explorerVisaOnskad() {
    const sel = document.getElementById('explore-visa');
    if (!sel) return 'helhet';
    if (sel.dataset.tvingad && /** @type {HTMLInputElement} */ (sel).value === sel.dataset.tvingad) return sel.dataset.onskad || 'helhet';
    return /** @type {HTMLInputElement} */ (sel).value;
}

function _explorerUrvalAntal(rows, urval) {
    const person = _urPersonFilter(urval);
    const ut = { n: 0, nKv: 0, nMa: 0 };
    for (const r of rows) {
        if (!(r.lon > 0) || !person(r)) continue;
        ut.n++;
        const k = _utKonOf(r);
        if (k === 'Kvinna') ut.nKv++; else if (k === 'Man') ut.nMa++;
    }
    return ut;
}

function _explorerSpec() {
    const val = id => /** @type {HTMLInputElement} */ (document.getElementById(id))?.value;
    const kol = val('explore-kolumn');
    return {
        rad: val('explore-rad') || 'bas',
        kolumn: kol && kol !== 'ingen' ? kol : null,
        matt: val('explore-measure') || 'median',
        delaKon: _explorerVisaOnskad() === 'kon',
        // Hopslagning av små AID-grupper — bara i Utforska, bara när raderna är AID (ADR-33).
        slaIhop: !!/** @type {HTMLInputElement} */ (document.getElementById('explore-sla-ihop'))?.checked,
        ...explorerUrval()
    };
}



function _explorerSyncControls(spec, typ, valdTyp, urval) {
    const typSel = document.getElementById('explore-typ');
    if (typSel) {
        for (const opt of /** @type {HTMLSelectElement} */ (typSel).options) {
            if (opt.value === 'auto') continue;
            const skal = explorerTypSkal(opt.value, spec, urval);
            opt.disabled = !!skal;
            opt.title = skal || '';
        }
        if (valdTyp !== 'auto' && explorerTypSkal(valdTyp, spec, urval)) /** @type {HTMLInputElement} */ (typSel).value = 'auto';
    }
    const matt = document.getElementById('explore-measure');
    if (matt) {
        const last = EXPLORE_LASTA_MATT.has(typ) || typ === 'staplade';
        /** @type {HTMLInputElement} */ (matt).disabled = last;
        matt.title = last
            ? `${EXPLORE_TYPER[typ].label} visar alltid ${typ === 'bubbla' ? 'median mot andel kvinnor' : typ === 'staplade' ? 'antal personer' : 'lönerna själva'}. Måttvalet gäller inte.`
            : '';
    }
    // Valet antal/andel hör bara till staplade staplar.
    const stapelVisa = document.getElementById('explore-stapel-visa');
    if (stapelVisa && stapelVisa.parentElement) stapelVisa.parentElement.hidden = typ !== 'staplade';
    const visa = document.getElementById('explore-visa');
    if (visa) {
        const { tvingad, skal } = explorerVisaSkal(spec, typ, urval);
        const onskad = _explorerVisaOnskad();
        if (tvingad) {
            visa.dataset.tvingad = tvingad;
            visa.dataset.onskad = onskad;
            /** @type {HTMLInputElement} */ (visa).value = tvingad;
        } else {
            delete visa.dataset.tvingad;
            delete visa.dataset.onskad;
            /** @type {HTMLInputElement} */ (visa).value = onskad;
        }
        for (const opt of /** @type {HTMLSelectElement} */ (visa).options) {
            const last = !!tvingad && opt.value !== tvingad;
            opt.disabled = last;
            opt.title = last ? skal : '';
        }
        const not = document.getElementById('explore-visa-not');
        if (not) not.textContent = tvingad ? `Visar ${tvingad === 'kon' ? 'per kön' : 'helhet'}: ${skal}` : '';
    }
    const kolSel = document.getElementById('explore-kolumn');
    if (kolSel) for (const opt of /** @type {HTMLSelectElement} */ (kolSel).options) opt.disabled = opt.value === spec.rad;
    const slaIhop = document.getElementById('explore-sla-ihop-rad');
    if (slaIhop) slaIhop.hidden = spec.rad !== 'aid';
}

function _explorerTitle(spec, typ) {
    // Gemen begynnelsebokstav mitt i meningen, men förkortningar (BAS, AID) behåller versalerna.
    const dim = d => { const s = EXPLORE_DIM_LABEL[d]; return /^[A-ZÅÄÖ]{2}/.test(s) ? s : s.charAt(0).toLowerCase() + s.slice(1); };
    // "per bas-intervall och åldersgrupp", "per åldersgrupp för hela urvalet", "för hela urvalet"
    let fras;
    if (spec.rad === 'alla') fras = spec.kolumn ? `per ${dim(spec.kolumn)} för hela urvalet` : 'för hela urvalet';
    else fras = `per ${dim(spec.rad)}` + (spec.kolumn ? ` och ${dim(spec.kolumn)}` : '');
    if (typ === 'bubbla') return `Median mot andel kvinnor ${fras}`;
    if (typ === 'lada' || typ === 'kvantilpunkter') return `Lönefördelning ${fras}`;
    if (typ === 'staplade') return `${/** @type {HTMLInputElement} */ (document.getElementById('explore-stapel-visa'))?.value === 'andel' ? 'Andel' : 'Antal'} ${fras}`;
    if (typ === 'punkter' || typ === 'svarm' || typ === 'regnmoln') return `Löner ${fras}`;
    return `${EXPLORE_MATT_LABEL[spec.matt]} ${fras}`;
}

/**
 * Får exporten ur Utforska ta med grupper under tröskeln? Rutan måste vara ikryssad OCH organisationspaketet
 * tillåta det (ADR-47); utan tillåtelse är rutan dold och svaret alltid nej.
 */
function explorerSmaIExport() {
    return state.paketLas.smaGrupperIExport !== false && !!/** @type {HTMLInputElement} */ (document.getElementById('explore-inkludera-sma'))?.checked;
}

/** Rutan "Ta med grupper under tröskeln" visas bara när paketet tillåter det; annars står en rad om varför. */
function explorerSynkaSmaLas() {
    const tillatet = state.paketLas.smaGrupperIExport !== false;
    const rad = document.getElementById('explore-inkludera-sma-rad');
    if (rad) rad.hidden = !tillatet;
    const ruta = document.getElementById('explore-inkludera-sma');
    if (ruta && !tillatet) /** @type {HTMLInputElement} */ (ruta).checked = false;
    const not = document.getElementById('explore-sma-last');
    if (not) not.hidden = tillatet;
}

function renderExplorer() {
    if (!document.getElementById('explore-rad')) return;
    explorerSynkaSmaLas();
    const rows = getData();
    explorerRensaUrval(rows);
    const spec = _explorerSpec();
    if (spec.kolumn === spec.rad) {
        /** @type {HTMLInputElement} */ (document.getElementById('explore-kolumn')).value = 'ingen';
        spec.kolumn = null;
    }
    const valdTyp = /** @type {HTMLInputElement} */ (document.getElementById('explore-typ'))?.value || 'auto';
    // Urvalets storlek per kön avgör vilka diagramtyper och visningar som går;
    // den beror bara på urvalet, så en enkel räkning räcker (ingen extra pivot).
    const probe = { urval: _explorerUrvalAntal(rows, spec.urval) };
    let typ = valdTyp === 'auto' ? explorerAutoTyp(spec, probe.urval) : valdTyp;
    if (explorerTypSkal(typ, spec, probe.urval)) typ = explorerAutoTyp(spec, probe.urval);
    // En hantel som det automatiska valet gett låser inte "Visa": användaren ska kunna byta tillbaka till helhet.
    const lasTyp = valdTyp === 'auto' && typ === 'hantel' ? 'staplar' : typ;

    const modelSpec = { ...spec };
    if (EXPLORE_LASTA_MATT.has(typ)) modelSpec.matt = 'median';
    if (typ === 'staplade') modelSpec.matt = 'n';
    const { tvingad } = explorerVisaSkal(spec, lasTyp, probe.urval);
    modelSpec.delaKon = tvingad ? tvingad === 'kon' : spec.delaKon;
    const model = _utComputePivot(rows, modelSpec, { k: kTroskel() });

    _explorerSyncControls(spec, lasTyp, valdTyp, model.urval);
    renderExplorerUrvalUi(rows);
    _explorerState = { model, typ, rows };

    const titleEl = document.getElementById('explore-chart-title');
    if (titleEl) titleEl.textContent = _explorerTitle(model.spec, typ);
    const inkl = explorerSmaIExport();
    _renderExplorerChart(model, typ, rows);
    _renderExplorerTable(model, typ, inkl);
    _renderExplorerNote(model);
}

function _renderExplorerChart(model, typ, rows) {
    const el = document.getElementById('chart-explore');
    if (!el) return;
    const exportMeny = el.parentElement && el.parentElement.querySelector(':scope > .chart-export');
    // Inga celler — eller celler där inget mått gick att räkna (t.ex. gap per kön).
    const utanVarden = model.celler.every(c => c.value == null && c.valueKv == null && c.valueMa == null);
    if (!model.urval.n || !model.celler.length || (utanVarden && !EXPLORE_LASTA_MATT.has(typ))) {
        if (exportMeny) /** @type {HTMLElement} */ (exportMeny).hidden = true;   // inget att exportera
        rensaFigur(el);                             // figuren (med lönerna) släpps; meddelandet läses i stället
        el.innerHTML = !model.urval.n
            ? '<p class="explore-tom">Inga personer matchar urvalet. <button type="button" class="btn-table-tool" data-explore-clear>Rensa urvalet</button></p>'
            : '<p class="explore-tom">Inga grupper att visa för valt urval.</p>';
        return;
    }
    if (typ === 'staplade' && model.kolumnEtiketter.length > EXPLORE_STAPLADE_MAX) {
        if (exportMeny) /** @type {HTMLElement} */ (exportMeny).hidden = true;
        rensaFigur(el);
        el.innerHTML = `<p class="explore-tom">Kolumnerna har ${model.kolumnEtiketter.length} värden — för många för staplade staplar (högst ${EXPLORE_STAPLADE_MAX}). Välj en annan kolumn eller diagramtypen Heatmap.</p>`;
        return;
    }
    if (exportMeny) /** @type {HTMLElement} */ (exportMeny).hidden = false;
    // Utforska visar grupper under tröskeln, markerade (ADR-14): figuren ritas med visaSma. Exporten tar bara med dem
    // om rutan är ikryssad — frågan ställs när exporten görs, och bara svaret "ja" räknas.
    ritaFigur(el, explorerFigure(model, typ, rows), {
        visaSma: true,
        exportMedSma: () => explorerSmaIExport(),
        exportBeskrivning: _urBeskrivUrval(model.spec.urval, model.spec.gruppVillkor),
        vidKlick: d => explorerHandleClick(d),
        tomtext: 'Inga grupper att visa för valt urval.'
    });
    /** @type {HTMLElement} */ (el.parentElement).classList.toggle('explore-klickbar', explorerKanFordjupa(model.spec));
}

function _renderExplorerTable(model, typ, inkl) {
    const table = document.getElementById('explore-table');
    if (!table) return;
    const { spec } = model;
    const k = kTroskel();
    const num = (v, m, attr = '') =>
        `<td class="tabelltal ta-hoger" data-sort-value="${v == null ? '' : v}"${attr}>${_exploreFmt(v, m)}</td>`;
    const nTd = c => `<td class="t-hoger" data-sort-value="${c.n}">${c.n.toLocaleString('sv-SE')} (${c.nKv}/${c.nMa})</td>`;
    const trAttr = c => (c.liten ? ` class="explore-liten" title="Färre än ${k} personer"` : '')
        + (c.liten && !inkl ? ' data-export-utelamna' : '');
    const dimLbl = esc(EXPLORE_DIM_LABEL[spec.rad]);
    let head, body;

    if (spec.kolumn) {
        const byKey = new Map(model.celler.map(c => [c.rad + '\u0000' + c.kol, c]));
        // En tabellkolumn per kolumnvärde — eller två, kvinnor och män, per kön.
        const kolumner = model.kolumnEtiketter.flatMap(kl => spec.delaKon
            ? [{ kl, rubrik: `${kl} · Kvinnor`, v: c => c.valueKv, n: c => c.nKv },
               { kl, rubrik: `${kl} · Män`, v: c => c.valueMa, n: c => c.nMa }]
            : [{ kl, rubrik: kl, v: c => c.value, n: c => c.n }]);
        const cellAv = (r, d) => byKey.get(r + '\u0000' + d.kl);
        const liten = (c, d) => c.liten || d.n(c) < k;
        // Utan rutan ikryssad får exporten inte gå att skilja en liten cell från en
        // tom eller dold: båda blir tomma, och rader och kolumner som bara har små
        // celler utelämnas helt — annars röjer etiketten att gruppen finns (ADR-14).
        const synlig = (c, d) => c && !liten(c, d);
        const radUte = new Set(inkl ? [] : model.radEtiketter.filter(r => !kolumner.some(d => synlig(cellAv(r, d), d))));
        const kolUte = new Set(inkl ? [] : kolumner.filter(d => !model.radEtiketter.some(r => synlig(cellAv(r, d), d))));
        const ute = d => (kolUte.has(d) ? ' data-export-utelamna' : '');
        head = `<tr><th>${dimLbl} \\ ${esc(EXPLORE_DIM_LABEL[spec.kolumn])}</th>`
            + kolumner.map(d => `<th class="t-hoger"${ute(d)}>${esc(d.rubrik)}</th>`).join('') + '</tr>';
        body = model.radEtiketter.map(r => `<tr${radUte.has(r) ? ' data-export-utelamna' : ''}><td>${esc(r)}</td>` + kolumner.map(d => {
            const c = cellAv(r, d);
            if (!c) return `<td class="t-hoger" data-sort-value=""${inkl ? '' : ' data-export-tom'}${ute(d)}>–</td>`;
            const v = d.v(c), sm = liten(c, d);
            const bara_kon_liten = !c.liten && spec.matt === 'n';   // antal per kön i en stor grupp följer med
            const attr = (sm ? ` class="explore-liten" title="Färre än ${k} personer"` : '')
                + (!inkl && ((sm && !bara_kon_liten) || (spec.matt === 'gap' && c.konLiten)) ? ' data-export-tom' : '') + ute(d);
            const cell = _exploreFmt(v, spec.matt) + (sm ? ` (n = ${d.n(c)})` : '');
            return `<td class="tabelltal ta-hoger" data-sort-value="${v == null ? '' : v}"${attr}>${esc(cell)}</td>`;
        }).join('') + '</tr>').join('');
    } else if (spec.delaKon) {
        // Antal är inte ett lönemått: det följer med i exporten precis som n (K/M).
        const tom = n => (n < k && !inkl && spec.matt !== 'n') ? ' data-export-tom' : '';
        head = `<tr><th>${dimLbl}</th><th class="t-hoger">Kvinnor</th><th class="t-hoger">Män</th>`
            + '<th class="t-hoger">n (K/M)</th></tr>';
        body = model.celler.map(c => `<tr${trAttr(c)}><td>${esc(c.rad)}</td>`
            + `${num(c.valueKv, spec.matt, tom(c.nKv))}${num(c.valueMa, spec.matt, tom(c.nMa))}${nTd(c)}</tr>`).join('');
    } else if (EXPLORE_LASTA_MATT.has(typ)) {
        head = `<tr><th>${dimLbl}</th><th class="t-hoger">Median månadslön</th>`
            + '<th class="t-hoger">Andel kvinnor</th><th class="t-hoger">n (K/M)</th></tr>';
        body = model.celler.map(c => {
            const andel = (c.nKv + c.nMa) ? c.nKv / (c.nKv + c.nMa) * 100 : null;
            return `<tr${trAttr(c)}><td>${esc(c.rad)}</td>${num(c.value, 'median')}${num(andel, 'andelKv')}${nTd(c)}</tr>`;
        }).join('');
    } else {
        // gap för en grupp där ena könet är under tröskeln redovisas inte i export (ADR-12).
        const gapTom = c => (spec.matt === 'gap' && c.konLiten && !inkl) ? ' data-export-tom' : '';
        head = `<tr><th>${dimLbl}</th><th class="t-hoger">${esc(EXPLORE_MATT_LABEL[spec.matt])}</th>`
            + '<th class="t-hoger">n (K/M)</th></tr>';
        body = model.celler.map(c => `<tr${trAttr(c)}><td>${esc(c.rad)}</td>${num(c.value, spec.matt, gapTom(c))}${nTd(c)}</tr>`).join('');
    }
    const tom = !model.celler.length;
    if (tom) {
        const bredd = (head.match(/<th/g) || []).length || 1;
        body = `<tr data-export-utelamna><td colspan="${bredd}" class="explore-tom">Inga grupper att visa för valt urval.</td></tr>`;
    }
    table.innerHTML = `<thead>${head}</thead><tbody>${body}</tbody>`;
    // Tabellens export börjar med urvalet, som diagrammets gör (tableToMatrix).
    table.setAttribute('data-export-beskrivning', _urBeskrivUrval(spec.urval, spec.gruppVillkor));
    // innerHTML bygger ett NYTT thead; sorteringsflaggan sitter på tabellnoden
    // och måste nollställas, annars är sorteringen död från andra renderingen.
    table._sortInit = false;
    if (typeof enableTableSort === 'function') enableTableSort('explore-table');
    if (typeof addTableExportTools === 'function') addTableExportTools('explore-table', 'utforska');
    const container = table.closest('.table-container');
    const verktyg = container && container.previousElementSibling;
    if (verktyg && verktyg.classList.contains('table-tools')) /** @type {HTMLElement} */ (verktyg).hidden = tom;
}

function _renderExplorerNote(model, extra) {
    const el = document.getElementById('explore-note');
    if (!el) return;
    const antal = model.celler.filter(c => c.liten).length;
    const k = kTroskel();
    const sma = antal
        ? `${antal} ${antal === 1 ? 'grupp har' : 'grupper har'} under ${k} personer. `
          + 'De följer inte med i exporten om du inte kryssar i rutan ovanför diagrammet.'
        : '';
    const konsma = model.spec.delaKon && model.spec.matt !== 'n'
        ? model.celler.filter(c => !c.liten).reduce((s, c) => s + (c.nKv < k ? 1 : 0) + (c.nMa < k ? 1 : 0), 0) : 0;
    const kon = konsma
        ? `${konsma} ${konsma === 1 ? 'könsvärde bygger' : 'könsvärden bygger'} på färre än ${k} personer; `
          + 'de följer inte med i exporten om du inte kryssar i rutan.'
        : '';
    const dolda = model.dolda
        ? `${model.dolda} ${model.dolda === 1 ? 'grupp döljs' : 'grupper döljs'} av gruppvillkoren.` : '';
    el.textContent = [sma, kon, dolda, extra || ''].filter(Boolean).join(' ');
}

// ---- Klick till gruppdossiern (förslag 4) ----
// Dossiern nycklas på "aid|bas". En cell som pekar ut båda öppnar exakt den
// gruppen; en cell som bara pekar ut det ena öppnar den största gruppen inom
// det (dossierns egen lista låter användaren byta). Dimensioner som inte är
// rad eller kolumn kan pekas ut av ett filter med exakt ett värde.
// En dimension som varken är rad eller kolumn pekas ut av urvalet när det har
// läget "alla" och exakt ett aktivt villkor på fältet: "är en av" med ett värde.
function _explorerUrvalEttVarde(spec, dim) {
    const u = spec.urval;
    if (!u || u.lage === 'nagot') return null;
    const falt = dim === 'alder' ? 'aldersgrupp' : dim;
    const pa = (u.villkor || []).filter(v => _urVillkorAktivt(v) && v.falt === falt);
    if (pa.length !== 1) return null;
    const v = pa[0];
    return (v.op === 'enAv' && !v.inte && v.varde.length === 1) ? v.varde[0] : null;
}
// "207 Förskollärare · BAS E" → { aid: '207 Förskollärare', bas: 'E' }
function _explorerAidBas(etikett) {
    const m = String(etikett ?? '').match(/^(.*) · BAS (.*)$/);
    return m ? { aid: m[1], bas: m[2] } : null;
}
function _explorerMalVarde(spec, dim, radEtikett, kolEtikett) {
    if (spec.rad === dim) return radEtikett;
    if (spec.kolumn === dim) return kolEtikett;
    const ur = (spec.rad === 'aidbas' && _explorerAidBas(radEtikett)) || (spec.kolumn === 'aidbas' && _explorerAidBas(kolEtikett));
    if (ur) return ur[dim];
    return _explorerUrvalEttVarde(spec, dim);
}
function explorerKanFordjupa(spec) {
    return spec.rad === 'aidbas' || spec.kolumn === 'aidbas'
        || ['bas', 'aid'].some(d => spec.rad === d || spec.kolumn === d || _explorerUrvalEttVarde(spec, d) != null);
}
function explorerDossierTarget(spec, radEtikett, kolEtikett) {
    const bas = _explorerMalVarde(spec, 'bas', radEtikett, kolEtikett);
    const aidEtikett = _explorerMalVarde(spec, 'aid', radEtikett, kolEtikett);
    if (bas == null && aidEtikett == null) return null;
    if (aidEtikett != null && String(aidEtikett).startsWith('Övriga i ')) return { hopslagen: true };
    // Etiketten är "AID Yrkesnamn"; dossiern använder AID-sifferprefixet.
    const aid = aidEtikett == null ? null : ((String(aidEtikett).match(/^(\d+)/) || [])[1] || String(aidEtikett));
    const traff = gruppdossierCandidates().find(c => (bas == null || c.bas === bas) && (aid == null || c.aid === aid));
    return traff ? { key: traff.key } : { saknas: true };
}
// Klick på ett märke: datapunkten bär radens och kolumnens etikett (`rad`, `kol`); en låda bär gruppens etikett
// som `nyckel` (eller som kategori, `x`).
function explorerHandleClick(d) {
    if (!d || !_explorerState) return;
    const radEtikett = d.rad != null ? d.rad : (d.nyckel != null ? d.nyckel : d.x);
    if (radEtikett == null) return;
    const mal = explorerDossierTarget(_explorerState.model.spec, radEtikett, d.kol ?? null);
    if (!mal) return;
    if (mal.hopslagen) {
        _renderExplorerNote(_explorerState.model,
            'Gruppen har slagits ihop av flera små yrken och har därför ingen gruppdossier. Stäng av "Slå ihop små yrkesgrupper till nästa AID-nivå" för att se yrkena var för sig.');
        return;
    }
    if (mal.saknas) {
        _renderExplorerNote(_explorerState.model,
            `Gruppen har ingen gruppdossier, eftersom dossiern bara finns för grupper med minst ${kTroskel()} personer.`);
        return;
    }
    openGruppdossier(mal.key);
}

/** Släpper Utforskas referenser till lönerader (anropas av "Rensa all data"). */
function explorerSlappMinne() {
    _explorerState = null;
    const gd = document.getElementById('chart-explore');
    if (gd) rensaFigur(gd);
    if (typeof explorerUrvalSlappMinne === 'function') explorerUrvalSlappMinne();
    if (typeof nedborrningGlom === 'function') nedborrningGlom();
}

// ---- Wiring ----
const _exploreVy = document.getElementById('view-utforska');
_exploreVy?.addEventListener('change', e => {
    const t = /** @type {HTMLElement} */ (e.target);
    if (['explore-rad', 'explore-kolumn', 'explore-measure', 'explore-visa',
         'explore-typ', 'explore-inkludera-sma', 'explore-sla-ihop', 'explore-stapel-visa'].includes(/** @type {HTMLElement} */ (t).id)) renderExplorer();
});
_exploreVy?.addEventListener('click', e => {
    if (/** @type {HTMLElement} */ (e.target).closest('[data-explore-clear]')) {
        explorerNollstallUrval();
        renderExplorer();
    }
});

// ---- Egna tabeller i rapporten (ADR-52) ----
// Vyn sparas som ett recept (rader, kolumner, mått, urval); talen räknas om när rapporten byggs, i exportläget.
function explorerTillRapport() {
    const namnEl = /** @type {HTMLInputElement} */ (document.getElementById('explore-rapport-namn'));
    const perBas = !!/** @type {HTMLInputElement} */ (document.getElementById('explore-rapport-perbas'))?.checked;
    const status = document.getElementById('explore-rapport-status');
    const satt = (text, ok) => { if (status) { status.textContent = text; status.className = `status-msg${ok ? ' success' : ''}`; } };
    if (!getData().length) { satt('Läs in en lönefil först.', false); return null; }
    const spec = _explorerSpec();
    const recept = _trNytt(spec, { namn: namnEl ? namnEl.value : '', upprepa: perBas ? 'bas' : null });
    if (!recept) { satt('Vyn går inte att spara som tabell.', false); return null; }
    if (perBas && !recept.upprepa) { satt('En tabell per BAS-intervall går inte när raderna eller kolumnerna redan är BAS-intervall.', false); return null; }
    state.rapportTabeller = [...(state.rapportTabeller || []), recept];
    if (namnEl) namnEl.value = '';
    satt(`Tillagd: ${recept.namn} (${state.rapportTabeller.length} ${state.rapportTabeller.length === 1 ? 'egen tabell' : 'egna tabeller'}). Ordningen ändras under Dokumentera & exportera.`, true);
    if (typeof announceToScreenReader === 'function') announceToScreenReader(`Tabellen ${recept.namn} är tillagd i rapporten.`);
    return recept;
}
document.getElementById('btn-explore-till-rapport')?.addEventListener('click', explorerTillRapport);
document.getElementById('explore-rapport-namn')?.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); explorerTillRapport(); } });

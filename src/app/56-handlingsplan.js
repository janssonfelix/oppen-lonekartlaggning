// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
// ---- Handlingsplan: mall, förifyllning från Prioritering och Likvärdigt arbete, export ----
// Förifyllt handlingsplansunderlag (Excel): seedar rader från Prioritering
// (grupper under referens) och § 3:10-paren. Gruppmått, inga individdata; det användaren
// fyllt i (sakligt skäl, ansvarig, tidsplan, status) ligger i state.handlingsplan och följer med.
// Renodlar analysflödet: verktyget levererar underlaget, planen färdigställs i Word.
// Delad seedning av handlingsplanen: rader från Prioritering (under referens, § 9)
// + § 3:10-par. Returnerar enbart de förifyllda dataraderna (utan tomrader) så att
// både Excel-exporten och skärm-mallen (renderHandlingsplanSeed) använder samma logik.
// Varifrån en förifylld rad kommer, som kolumnen Underlag och exporterna säger det.
const HP_UNDERLAG_PRIO = 'Prioritering (under referensen)';
const HP_UNDERLAG_PAR = 'Likvärdigt arbete (kandidatpar)';

// Fälten som fylls i per rad (ligger i state.handlingsplan, nycklade på raden). Rullistornas värden
// är det som står i exporterna; ett tomt värde betyder att inget är valt.
const HP_SAKLIGT = [['', '—'], ['Ja, sakligt skäl finns', 'Ja, sakligt skäl finns'], ['Nej, åtgärd behövs', 'Nej, åtgärd behövs'], ['Pågår', 'Pågår']];
const HP_STATUS = [['', '—'], ['Planerad', 'Planerad'], ['Pågår', 'Pågår'], ['Genomförd', 'Genomförd'], ['Skjuts upp', 'Skjuts upp (motivera under Tidsplan)']];
const HP_FALT = ['sakligt', 'ansvarig', 'tidsplan', 'status'];
const HP_MAX_TEXT = 500;

/** Gruppen som raden gäller, i samma form för alla rader: "403010 Barnskötare · BAS C". */
function _hpGrupp(aid, namn, bas) {
    const a = aid == null ? '' : String(aid).trim();
    const n = namn == null ? '' : String(namn).trim();
    const yrke = !n || n === a ? a : (a && !n.startsWith(a) ? `${a} ${n}` : n);
    return `${yrke} · BAS ${bas}`;
}

/** Radens nyckel i state.handlingsplan: källa, yrke och BAS (för ett par också jämförelseyrket). */
function _hpNyckel(kalla, ...delar) { return [kalla, ...delar.map(d => d == null ? '' : String(d))].join('|'); }

/** De ifyllda värdena för en rad (tomma strängar när inget är ifyllt). Raden kan ha försvunnit ur underlaget;
 *  värdena ligger då kvar i minnet tills Rensa all data. */
function _hpVarden(nyckel) {
    const v = (state.handlingsplan && state.handlingsplan[nyckel]) || {};
    return { sakligt: v.sakligt || '', ansvarig: v.ansvarig || '', tidsplan: v.tidsplan || '', status: v.status || '' };
}

function _hpSatt(nyckel, falt, varde) {
    if (!HP_FALT.includes(falt) || !nyckel) return;
    if (!state.handlingsplan) state.handlingsplan = {};
    const rad = { ..._hpVarden(nyckel), [falt]: String(varde ?? '').slice(0, HP_MAX_TEXT) };
    if (HP_FALT.every(f => !rad[f])) delete state.handlingsplan[nyckel];
    else state.handlingsplan[nyckel] = rad;
}

function _handlingsplanSeedRows() {
    const months = (state.costSettings && state.costSettings.months) || 12;
    const poFactor = 1 + ((state.costSettings && state.costSettings.poPct) || 0) / 100;
    const rows = [], nycklar = [];
    let prioCount = 0, lvCount = 0, parUtelamnade = 0;
    // En rad: [åtgärd, grupp, underlag, sakligt skäl, kostnad, ansvarig, tidsplan, status] — med det som fyllts i på fliken.
    const lagg = (nyckel, atgard, grupp, underlag, kostnad) => {
        const v = _hpVarden(nyckel);
        rows.push([atgard, grupp, underlag, v.sakligt, kostnad, v.ansvarig, v.tidsplan, v.status]);
        nycklar.push(nyckel);
    };
    try {
        const ref = (typeof _selectedPrioReference === 'function') ? _selectedPrioReference() : 'stallningstagande';
        const hasRef = ref === 'stallningstagande' ? state.policy.length : state.statistik.length;
        if (hasRef) {
            const thr = (state.prioConfig && state.prioConfig.atgardThreshold != null) ? state.prioConfig.atgardThreshold : -5;
            computePrioritization(ref).filter(i => i.diffPct < thr).forEach(i => {
                lagg(_hpNyckel('prio', i.aid || i.yrke, i.bas), 'Granska löneläge och väg mot sakliga skäl', _hpGrupp(i.aid, i.yrke, i.bas), HP_UNDERLAG_PRIO, Math.round(i.annualGapTotal));
                prioCount++;
            });
        }
    } catch (e) { rapporteraFel('Handlingsplan: prioriteringen', e); }
    try {
        if (state.statistik.length || state.data.length) {
            const lv = likvardighetResultat();
            // k-anonymitet: par med en grupp under tröskeln förifylls inte (undantaget gäller bara fliken)
            const { par, utelamnade } = _parForRedovisning(lv && lv.pairs);
            parUtelamnade = utelamnade;
            par.forEach(p => {
                const arsKostnad = Math.round(Math.abs(p.gapKr) * (p.kvN || 1) * months * poFactor);
                lagg(_hpNyckel('par', p.kvAid, p.kvBas, p.maAid, p.maBas), 'Granska likvärdigt arbete (kvinnodominerat yrke)', _hpGrupp(p.kvAid, p.kvLabel, p.kvBas), HP_UNDERLAG_PAR, arsKostnad);
                lvCount++;
            });
        }
    } catch (e) { rapporteraFel('Handlingsplan: likvärdigt arbete', e); }
    return { rows, nycklar, prioCount, lvCount, parUtelamnade, parNot: _parUtelamnadeNot(parUtelamnade) };
}

// Kolumnen Underlag: raderna bär redan sin källa. Äldre texter (sparade utdrag) översätts till samma ord.
function _handlingsplanUnderlag(underlag) {
    if (/^Lika arbete\b/.test(underlag)) return HP_UNDERLAG_PRIO;
    if (/^Likvärdigt arbete$/.test(underlag)) return HP_UNDERLAG_PAR;
    return underlag;
}

// Ett fritextfält som liknar ett personnummer eller en e-postadress får en varning; texten står kvar.
function _hpLiknarPersonuppgift(t) { return !!t && typeof _opLiknarPersonuppgift === 'function' && _opLiknarPersonuppgift(t); }
function _hpUppdateraVarning() {
    const tbody = document.getElementById('handlingsplan-tbody');
    const varning = document.getElementById('handlingsplan-varning');
    if (!tbody || !varning) return;
    let traff = 0;
    tbody.querySelectorAll('input.hp-falt').forEach(el => {
        const liknar = _hpLiknarPersonuppgift(/** @type {HTMLInputElement} */ (el).value);
        el.classList.toggle('hp-falt-varning', liknar);
        if (liknar) { el.setAttribute('aria-describedby', 'handlingsplan-varning'); traff++; } else el.removeAttribute('aria-describedby');
    });
    varning.hidden = !traff;
}

// #UX Renderar de förifyllda raderna direkt i skärm-mallen, med fält för sakligt skäl, ansvarig, tidsplan och status,
// ovanför tomrader som syns på utskriften — så HR ser underlaget och kan fylla i planen utan att först exportera.
function renderHandlingsplanSeed() {
    const tbody = document.getElementById('handlingsplan-tbody');
    if (!tbody) return;
    const seed = getData().length ? _handlingsplanSeedRows() : { rows: [], nycklar: [], prioCount: 0, lvCount: 0, parUtelamnade: 0, parNot: '' };
    const fmtKr = n => (n ? Math.round(n).toLocaleString('sv-SE') + ' kr' : '');
    const lista = (id, nyckel, falt, val, alt, etikett) => `<select id="${id}" class="form-select hp-falt" data-hp-nyckel="${esc(nyckel)}" data-hp-falt="${falt}" aria-label="${esc(etikett)}">`
        + alt.map(([v, l]) => `<option value="${esc(v)}"${v === val ? ' selected' : ''}>${esc(l)}</option>`).join('') + '</select>';
    const text = (id, nyckel, falt, val, platshallare, etikett) => `<input type="text" id="${id}" class="hp-falt" data-hp-nyckel="${esc(nyckel)}" data-hp-falt="${falt}" value="${esc(val)}"`
        + ` maxlength="${HP_MAX_TEXT}" autocomplete="off" placeholder="${esc(platshallare)}" aria-label="${esc(etikett)}">`;
    const seededHtml = seed.rows.map((r, i) => {
        const n = seed.nycklar[i], g = r[1];
        return `<tr class="handlingsplan-seeded"><td>${esc(r[0])}</td><td>${esc(g)}</td><td>${esc(r[2])}</td>`
            + `<td>${lista(`hp-${i}-sakligt`, n, 'sakligt', r[3], HP_SAKLIGT, `Sakligt skäl prövat?: ${g}`)}</td>`
            + `<td class="t-hoger">${esc(fmtKr(r[4]))}</td>`
            + `<td>${text(`hp-${i}-ansvarig`, n, 'ansvarig', r[5], 'Roll, t.ex. HR-chef', `Ansvarig: ${g}`)}</td>`
            + `<td>${text(`hp-${i}-tidsplan`, n, 'tidsplan', r[6], 'T.ex. lönerevisionen nästa år', `Tidsplan: ${g}`)}</td>`
            + `<td>${lista(`hp-${i}-status`, n, 'status', r[7], HP_STATUS, `Status: ${g}`)}</td></tr>`;
    }).join('');
    const emptyN = Math.max(5, 8 - seed.rows.length);
    const emptyHtml = Array.from({ length: emptyN }, () =>
        '<tr class="handlingsplan-empty"><td>&nbsp;</td><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr>').join('');
    tbody.innerHTML = seededHtml + emptyHtml;
    _hpUppdateraVarning();
    const note = document.getElementById('handlingsplan-seed-note');
    if (note) {
        const parNot = seed.parNot ? ` ${esc(seed.parNot)}` : '';
        note.innerHTML = (seed.rows.length
            ? `Förifyllt med <strong>${seed.rows.length}</strong> rad${seed.rows.length === 1 ? '' : 'er'} (${seed.prioCount} från Prioritering, under referensen, och ${seed.lvCount} kandidatpar från Likvärdigt arbete) — ett utgångsläge att granska. Fyll i sakligt skäl, ansvarig, tidsplan och status direkt i raderna.`
            : 'Mallen förifylls automatiskt med grupperna från Prioritering och Likvärdigt arbete när data och referens finns. Fyll annars i för hand eller ladda upp underlag på <strong>Översikt</strong>.') + parNot;
    }
}

// Fälten skriver till state.handlingsplan medan man skriver; tabellen ritas inte om (fokus står kvar).
['input', 'change'].forEach(typ => document.getElementById('handlingsplan-tbody')?.addEventListener(typ, e => {
    const el = /** @type {HTMLInputElement} */ (e.target);
    if (!el || !el.classList || !el.classList.contains('hp-falt')) return;
    _hpSatt(el.dataset.hpNyckel, el.dataset.hpFalt, el.value);
    if (el.tagName === 'INPUT') _hpUppdateraVarning();
}));

/** Det ifyllda i konfigurationsfilen: en post per rad med något ifyllt. */
function _hpForKonfiguration() {
    return Object.keys(state.handlingsplan || {}).map(nyckel => ({ nyckel, ..._hpVarden(nyckel) }))
        .filter(r => HP_FALT.some(f => r[f]));
}
/** Prövar konfigurationsfilens poster; kastar vid fel form. Okända val i rullistorna läses som tomma. */
function _hpValideraKonfiguration(lista) {
    if (!Array.isArray(lista)) throw new Error('handlingsplan måste vara en array.');
    /** @type {{[nyckel: string]: any}} */ const ut = {};
    lista.forEach((r, i) => {
        if (!r || typeof r !== 'object') throw new Error(`handlingsplan[${i}] är inte ett objekt.`);
        if (typeof r.nyckel !== 'string' || !r.nyckel || r.nyckel.length > 300) throw new Error(`handlingsplan[${i}].nyckel måste vara en sträng (högst 300 tecken).`);
        HP_FALT.forEach(f => { if (r[f] != null && typeof r[f] !== 'string') throw new Error(`handlingsplan[${i}].${f} måste vara en sträng.`); });
        const giltig = (v, alt) => alt.some(([a]) => a === v) ? v : '';
        const rad = { sakligt: giltig(r.sakligt || '', HP_SAKLIGT), ansvarig: String(r.ansvarig || '').slice(0, HP_MAX_TEXT),
            tidsplan: String(r.tidsplan || '').slice(0, HP_MAX_TEXT), status: giltig(r.status || '', HP_STATUS) };
        if (HP_FALT.some(f => rad[f])) ut[r.nyckel] = rad;
    });
    return ut;
}

// Går alltid genom exportläget (ADR-51): djupräknaren håller skärmen i exportläget tills den sista pågående exporten är klar.
function exportHandlingsplan(...a) { return medExportLage(() => _exportHandlingsplanExport.apply(null, /** @type {any} */ (a))); }
function _exportHandlingsplanExport() {
    if (typeof XLSX === 'undefined') { alert('Excel-biblioteket kunde inte laddas.'); return; }
    const header = ['Åtgärd', 'Berörd grupp (AID·BAS)', 'Underlag', 'Sakligt skäl prövat?', 'Beräknad kostnad (kr/år, inkl. PO)', 'Ansvarig', 'Tidsplan (senast inom 3 år)', 'Status'];
    const seed = _handlingsplanSeedRows();
    const prioCount = seed.prioCount, lvCount = seed.lvCount;
    const rows = seed.rows.slice();
    for (let i = 0; i < 5; i++) rows.push(['', '', '', '', '', '', '', '']);   // tomma rader för manuella tillägg

    const guide = [
        ['Handlingsplan för jämställda löner — vägledning', ''],
        ['Lagrum', 'Diskrimineringslagen 3 kap.: åtgärder, kostnadsberäkning och tidsplan i dokumentationen av lönekartläggningen'],
        ['§ 11', 'Arbetsgivare med minst 10 anställda ska upprätta en handlingsplan med åtgärder, kostnadsberäkning och tidsplan.'],
        ['Tidsplan', 'Åtgärderna ska genomföras så snart som möjligt, dock senast inom tre år.'],
        ['Ej inom 3 år', 'Åtgärder som inte kan genomföras inom tre år ska dokumenteras särskilt med motivering och plan för när de kan genomföras.'],
        ['§ 13', 'Lönekartläggningen, analysen och handlingsplanen ska dokumenteras skriftligt.'],
        ['Samverkan', 'Arbetet ska bedrivas i samverkan med arbetstagarna (diskrimineringslagen).'],
        ['', ''],
        ['Detta underlag', `Förifyllt med ${prioCount} grupp(er) under referens (Prioritering) och ${lvCount} kandidatpar i likvärdigt arbete.${seed.parNot ? ' ' + seed.parNot : ''} Det som fyllts i på fliken Handlingsplan står med; fyll i resten av sakligt skäl, ansvarig, tidsplan och status. Raderna bygger på gruppmått — inga individdata.`],
        ['OBS', 'Detta är ett analysunderlag. Den sammanhållna handlingsplanen färdigställs i arbetsgivarens dokumentation/Word.']
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([header, ...rows]), 'Handlingsplan');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(guide), 'Vägledning');
    _appendMethodSheet(wb);
    XLSX.writeFile(wb, `handlingsplan_underlag_${new Date().toISOString().slice(0, 10)}.xlsx`);
    if (typeof announceToScreenReader === 'function') announceToScreenReader('Handlingsplansunderlag exporterat.');
}
document.getElementById('btn-export-handlingsplan')?.addEventListener('click', exportHandlingsplan);

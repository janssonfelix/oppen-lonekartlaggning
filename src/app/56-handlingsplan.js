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
const HP_UNDERLAG_EGEN = 'Egen rad';

// Fälten som fylls i per rad (ligger i state.handlingsplan, nycklade på raden). Rullistornas värden
// är det som står i exporterna; ett tomt värde betyder att inget är valt.
const HP_SAKLIGT = [['', '—'], ['Ja, sakligt skäl finns', 'Ja, sakligt skäl finns'], ['Nej, åtgärd behövs', 'Nej, åtgärd behövs'], ['Pågår', 'Pågår']];
const HP_STATUS = [['', '—'], ['Planerad', 'Planerad'], ['Pågår', 'Pågår'], ['Genomförd', 'Genomförd'], ['Skjuts upp', 'Skjuts upp (motivera under Tidsplan)']];
const HP_FALT = ['sakligt', 'ansvarig', 'tidsplan', 'status'];
// En egen rad (tillagd på fliken, nyckel "egen|…") har också åtgärd och grupp som fritext. Den finns tills den tas bort.
const HP_EGEN_FALT = ['atgard', 'grupp'];
const HP_MAX_TEXT = 500;
const _hpArEgen = nyckel => typeof nyckel === 'string' && nyckel.startsWith('egen|');

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
    return { sakligt: v.sakligt || '', ansvarig: v.ansvarig || '', tidsplan: v.tidsplan || '', status: v.status || '',
             ...(_hpArEgen(nyckel) ? { egen: true, atgard: v.atgard || '', grupp: v.grupp || '' } : {}) };
}

function _hpSatt(nyckel, falt, varde) {
    const egen = _hpArEgen(nyckel);
    if (!nyckel || !(HP_FALT.includes(falt) || (egen && HP_EGEN_FALT.includes(falt)))) return;
    if (!state.handlingsplan) state.handlingsplan = {};
    const rad = { ..._hpVarden(nyckel), [falt]: String(varde ?? '').slice(0, HP_MAX_TEXT) };
    // En förifylld rad glöms när alla fält är tomma; en egen rad finns tills den tas bort.
    if (!egen && HP_FALT.every(f => !rad[f])) delete state.handlingsplan[nyckel];
    else state.handlingsplan[nyckel] = rad;
}

/** Lägger till en egen rad sist i tabellen och sätter fokus i dess första fält. */
function _hpLaggTillEgen() {
    if (!state.handlingsplan) state.handlingsplan = {};
    const nyckel = _hpNyckel('egen', Date.now().toString(36) + Math.random().toString(36).slice(2, 6));
    state.handlingsplan[nyckel] = { egen: true, atgard: '', grupp: '', sakligt: '', ansvarig: '', tidsplan: '', status: '' };
    renderHandlingsplanSeed();
    const forsta = [...document.querySelectorAll('#handlingsplan-tbody .hp-falt')].find(el => /** @type {HTMLElement} */ (el).dataset.hpNyckel === nyckel);
    if (forsta) /** @type {HTMLElement} */ (forsta).focus();
    return nyckel;
}
function _hpTaBortEgen(nyckel) {
    if (!_hpArEgen(nyckel) || !state.handlingsplan || !state.handlingsplan[nyckel]) return;
    delete state.handlingsplan[nyckel];
    renderHandlingsplanSeed();
    if (typeof announceToScreenReader === 'function') announceToScreenReader('Raden är borttagen.');
}

/** Raderna i handlingsplanen: de förifyllda från Prioritering och Likvärdigt arbete, sedan de egna. `baraEgna` hoppar
 *  över förifyllningen (utan underlag). */
function _handlingsplanSeedRows({ baraEgna = false } = {}) {
    const months = (state.costSettings && state.costSettings.months) || 12;
    const poFactor = 1 + ((state.costSettings && state.costSettings.poPct) || 0) / 100;
    const rows = [], nycklar = [];
    let prioCount = 0, lvCount = 0, parUtelamnade = 0;
    // En rad: [åtgärd, grupp, underlag, sakligt skäl, kostnad, ansvarig, tidsplan, status, antal berörda] — med det som
    // fyllts i på fliken. Antal berörda är gruppens antal (för ett kandidatpar det kvinnodominerade yrkets), null för en egen rad.
    const lagg = (nyckel, atgard, grupp, underlag, kostnad, antal) => {
        const v = _hpVarden(nyckel);
        rows.push([atgard, grupp, underlag, v.sakligt, kostnad, v.ansvarig, v.tidsplan, v.status, antal == null ? null : antal]);
        nycklar.push(nyckel);
    };
    if (!baraEgna) try {
        const ref = (typeof _selectedPrioReference === 'function') ? _selectedPrioReference() : 'stallningstagande';
        const hasRef = ref === 'stallningstagande' ? state.policy.length : state.statistik.length;
        if (hasRef) {
            const thr = (state.prioConfig && state.prioConfig.atgardThreshold != null) ? state.prioConfig.atgardThreshold : -5;
            computePrioritization(ref).filter(i => i.diffPct < thr).forEach(i => {
                lagg(_hpNyckel('prio', i.aid || i.yrke, i.bas), 'Granska löneläge och väg mot sakliga skäl', _hpGrupp(i.aid, i.yrke, i.bas), HP_UNDERLAG_PRIO, Math.round(i.annualGapTotal), i.n);
                prioCount++;
            });
        }
    } catch (e) { rapporteraFel('Handlingsplan: prioriteringen', e); }
    if (!baraEgna) try {
        if (state.statistik.length || state.data.length) {
            const lv = likvardighetResultat();
            // k-anonymitet: par med en grupp under tröskeln förifylls inte (undantaget gäller bara fliken)
            const { par, utelamnade } = _parForRedovisning(lv && lv.pairs);
            parUtelamnade = utelamnade;
            par.forEach(p => {
                const arsKostnad = Math.round(Math.abs(p.gapKr) * (p.kvN || 1) * months * poFactor);
                lagg(_hpNyckel('par', p.kvAid, p.kvBas, p.maAid, p.maBas), 'Granska likvärdigt arbete (kvinnodominerat yrke)', _hpGrupp(p.kvAid, p.kvLabel, p.kvBas), HP_UNDERLAG_PAR, arsKostnad, p.kvN);
                lvCount++;
            });
        }
    } catch (e) { rapporteraFel('Handlingsplan: likvärdigt arbete', e); }
    // Egna rader sist, i den ordning de lades till. Ingen kostnad räknas: raden är användarens egen.
    let egenCount = 0;
    Object.keys(state.handlingsplan || {}).filter(_hpArEgen).forEach(nyckel => {
        const v = _hpVarden(nyckel);
        rows.push([v.atgard || '', v.grupp || '', HP_UNDERLAG_EGEN, v.sakligt, null, v.ansvarig, v.tidsplan, v.status, null]);
        nycklar.push(nyckel);
        egenCount++;
    });
    return { rows, nycklar, prioCount, lvCount, egenCount, parUtelamnade, parNot: _parUtelamnadeNot(parUtelamnade) };
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
    // Samverkansknapparna (kortet Samverkan & uppföljning) exporterar underlag — inaktiva tills data finns.
    document.querySelectorAll('[data-dok-klick]').forEach(b => { /** @type {HTMLInputElement} */ (b).disabled = !getData().length; });
    const tbody = document.getElementById('handlingsplan-tbody');
    if (!tbody) return;
    const seed = _handlingsplanSeedRows({ baraEgna: !getData().length });
    const fmtKr = n => (n ? Math.round(n).toLocaleString('sv-SE') + ' kr' : '');
    const lista = (id, nyckel, falt, val, alt, etikett) => `<select id="${id}" class="form-select hp-falt" data-hp-nyckel="${esc(nyckel)}" data-hp-falt="${falt}" aria-label="${esc(etikett)}">`
        + alt.map(([v, l]) => `<option value="${esc(v)}"${v === val ? ' selected' : ''}>${esc(l)}</option>`).join('') + '</select>';
    const text = (id, nyckel, falt, val, platshallare, etikett) => `<input type="text" id="${id}" class="hp-falt" data-hp-nyckel="${esc(nyckel)}" data-hp-falt="${falt}" value="${esc(val)}"`
        + ` maxlength="${HP_MAX_TEXT}" autocomplete="off" placeholder="${esc(platshallare)}" aria-label="${esc(etikett)}">`;
    const seededHtml = seed.rows.map((r, i) => {
        const n = seed.nycklar[i], egen = _hpArEgen(n), g = r[1] || (egen ? 'egen rad' : '');
        // En egen rad har åtgärd och grupp som fält och en knapp som tar bort raden; knappen följer inte med i utskriften.
        // Antal berörda står efter gruppen; en egen rad har inget antal.
        const antal = `<td class="t-hoger">${r[8] != null ? esc(String(r[8])) : ''}</td>`;
        const forsta = egen
            ? `<td>${text(`hp-${i}-atgard`, n, 'atgard', r[0], 'Vad ska göras?', 'Åtgärd, egen rad')}</td>`
              + `<td>${text(`hp-${i}-grupp`, n, 'grupp', r[1], 'Grupp eller yrke, inga namn', 'Berörd grupp, egen rad')}</td>${antal}`
              + `<td>${esc(r[2])} <button type="button" class="btn-table-tool hp-ta-bort" data-hp-ta-bort="${esc(n)}" data-noprint aria-label="Ta bort den egna raden">Ta bort</button></td>`
            : `<td>${esc(r[0])}</td><td>${esc(g)}</td>${antal}<td>${esc(r[2])}</td>`;
        return `<tr class="handlingsplan-seeded${egen ? ' handlingsplan-egen' : ''}">${forsta}`
            + `<td>${lista(`hp-${i}-sakligt`, n, 'sakligt', r[3], HP_SAKLIGT, `Sakligt skäl prövat?: ${g}`)}</td>`
            + `<td class="t-hoger">${esc(fmtKr(r[4]))}</td>`
            + `<td>${text(`hp-${i}-ansvarig`, n, 'ansvarig', r[5], 'Roll, t.ex. HR-chef', `Ansvarig: ${g}`)}</td>`
            + `<td>${text(`hp-${i}-tidsplan`, n, 'tidsplan', r[6], 'T.ex. lönerevisionen nästa år', `Tidsplan: ${g}`)}</td>`
            + `<td>${lista(`hp-${i}-status`, n, 'status', r[7], HP_STATUS, `Status: ${g}`)}</td></tr>`;
    }).join('');
    const emptyN = Math.max(5, 8 - seed.rows.length);
    const emptyHtml = Array.from({ length: emptyN }, () =>
        '<tr class="handlingsplan-empty"><td>&nbsp;</td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr>').join('');
    tbody.innerHTML = seededHtml + emptyHtml;
    _hpUppdateraVarning();
    const note = document.getElementById('handlingsplan-seed-note');
    if (note) {
        const parNot = seed.parNot ? ` ${esc(seed.parNot)}` : '';
        const forifyllda = seed.rows.length - seed.egenCount;
        const egna = seed.egenCount ? ` ${seed.egenCount === 1 ? 'En egen rad' : `${seed.egenCount} egna rader`} står sist.` : '';
        note.innerHTML = (forifyllda
            ? `Förifyllt med <strong>${forifyllda}</strong> rad${forifyllda === 1 ? '' : 'er'} (${seed.prioCount} från Prioritering, under referensen, och ${seed.lvCount} kandidatpar från Likvärdigt arbete) — ett utgångsläge att granska. Fyll i sakligt skäl, ansvarig, tidsplan och status direkt i raderna.`
            : 'Mallen förifylls automatiskt med grupperna från Prioritering och Likvärdigt arbete när data och referens finns. Lägg till egna rader med knappen under tabellen, eller ladda upp underlag på <strong>Översikt</strong>.') + egna + parNot;
    }
}

// Fälten skriver till state.handlingsplan medan man skriver; tabellen ritas inte om (fokus står kvar).
['input', 'change'].forEach(typ => document.getElementById('handlingsplan-tbody')?.addEventListener(typ, e => {
    const el = /** @type {HTMLInputElement} */ (e.target);
    if (!el || !el.classList || !el.classList.contains('hp-falt')) return;
    _hpSatt(el.dataset.hpNyckel, el.dataset.hpFalt, el.value);
    if (el.tagName === 'INPUT') _hpUppdateraVarning();
}));
document.getElementById('handlingsplan-tbody')?.addEventListener('click', e => {
    const btn = /** @type {HTMLElement} */ (e.target).closest('[data-hp-ta-bort]');
    if (btn) _hpTaBortEgen(btn.getAttribute('data-hp-ta-bort'));
});
document.getElementById('btn-hp-lagg-till')?.addEventListener('click', () => _hpLaggTillEgen());

/** Det ifyllda i konfigurationsfilen: en post per rad med något ifyllt. */
function _hpForKonfiguration() {
    return Object.keys(state.handlingsplan || {}).map(nyckel => ({ nyckel, ..._hpVarden(nyckel) }))
        .filter(r => r.egen || HP_FALT.some(f => r[f]));
}
/** Prövar konfigurationsfilens poster; kastar vid fel form. Okända val i rullistorna läses som tomma. */
function _hpValideraKonfiguration(lista) {
    if (!Array.isArray(lista)) throw new Error('handlingsplan måste vara en array.');
    /** @type {{[nyckel: string]: any}} */ const ut = {};
    lista.forEach((r, i) => {
        if (!r || typeof r !== 'object') throw new Error(`handlingsplan[${i}] är inte ett objekt.`);
        if (typeof r.nyckel !== 'string' || !r.nyckel || r.nyckel.length > 300) throw new Error(`handlingsplan[${i}].nyckel måste vara en sträng (högst 300 tecken).`);
        const egen = _hpArEgen(r.nyckel);
        [...HP_FALT, ...(egen ? HP_EGEN_FALT : [])].forEach(f => { if (r[f] != null && typeof r[f] !== 'string') throw new Error(`handlingsplan[${i}].${f} måste vara en sträng.`); });
        const giltig = (v, alt) => alt.some(([a]) => a === v) ? v : '';
        const rad = { sakligt: giltig(r.sakligt || '', HP_SAKLIGT), ansvarig: String(r.ansvarig || '').slice(0, HP_MAX_TEXT),
            tidsplan: String(r.tidsplan || '').slice(0, HP_MAX_TEXT), status: giltig(r.status || '', HP_STATUS),
            ...(egen ? { egen: true, atgard: String(r.atgard || '').slice(0, HP_MAX_TEXT), grupp: String(r.grupp || '').slice(0, HP_MAX_TEXT) } : {}) };
        if (egen || HP_FALT.some(f => rad[f])) ut[r.nyckel] = rad;
    });
    return ut;
}

// Går alltid genom exportläget (ADR-51): djupräknaren håller skärmen i exportläget tills den sista pågående exporten är klar.
function exportHandlingsplan(...a) { return medExportLage(() => _exportHandlingsplanExport.apply(null, /** @type {any} */ (a))); }
function _exportHandlingsplanExport() {
    if (typeof XLSX === 'undefined') { alert('Exporten kunde inte starta: en del av verktyget saknas i filen. Ladda om sidan; hjälper det inte, hämta verktyget på nytt.'); return; }
    const header = ['Åtgärd', 'Berörd grupp (AID·BAS)', 'Antal berörda', 'Underlag', 'Sakligt skäl prövat?', 'Beräknad kostnad (kr/år, inkl. PO)', 'Ansvarig', 'Tidsplan (senast inom 3 år)', 'Status'];
    const seed = _handlingsplanSeedRows();
    const prioCount = seed.prioCount, lvCount = seed.lvCount;
    // Bladets kolumner i skärmens ordning: Antal berörda efter gruppen (tomt för en egen rad).
    const rows = seed.rows.map(r => [r[0], r[1], r[8] != null ? r[8] : '', ...r.slice(2, 8)]);
    for (let i = 0; i < 5; i++) rows.push(['', '', '', '', '', '', '', '', '']);   // tomma rader för manuella tillägg

    const guide = [
        ['Handlingsplan för jämställda löner — vägledning', ''],
        ['Lagrum', 'Diskrimineringslagen 3 kap.: åtgärder, kostnadsberäkning och tidsplan i dokumentationen av lönekartläggningen'],
        ['§ 11', 'Arbetsgivare med minst 10 anställda ska upprätta en handlingsplan med åtgärder, kostnadsberäkning och tidsplan.'],
        ['Tidsplan', 'Åtgärderna ska genomföras så snart som möjligt, dock senast inom tre år.'],
        ['Ej inom 3 år', 'Åtgärder som inte kan genomföras inom tre år ska dokumenteras särskilt med motivering och plan för när de kan genomföras.'],
        ['§ 13', 'Lönekartläggningen, analysen och handlingsplanen ska dokumenteras skriftligt.'],
        ['Samverkan', 'Arbetet ska bedrivas i samverkan med arbetstagarna (diskrimineringslagen).'],
        ['', ''],
        ['Detta underlag', `Förifyllt med ${prioCount} grupp(er) under referens (Prioritering) och ${lvCount} kandidatpar i likvärdigt arbete.${seed.parNot ? ' ' + seed.parNot : ''}${seed.egenCount ? ` ${seed.egenCount} egna rader från fliken står sist.` : ''} Det som fyllts i på fliken Handlingsplan står med; fyll i resten av sakligt skäl, ansvarig, tidsplan och status. Raderna bygger på gruppmått — inga individdata.`],
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

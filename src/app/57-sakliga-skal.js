// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
// ====================================================================
// 57-sakliga-skal.js — dialogen Sakliga skäl i Handlingsplan
//
// En rad i handlingsplanen (56-handlingsplan.js) kan bära sakliga skäl: kategori, belopp i kronor per månad av
// gruppens medianskillnad och en kort kommentar (src/lib/sakligaskal.js). Dialogen visar gruppens skillnad överst,
// en rad per skäl och summan längst ned: hur mycket som är förklarat och vad som återstår. När skälen förklarar hela
// skillnaden föreslår dialogen att raden markeras som sakligt förklarad; användaren bekräftar med en knapp.
//
// Exportgrinden: gruppens skillnad räknas i exportläget (medExportLage, ADR-51), som i allt som lämnar verktyget. En
// grupp som inte följer med i exporterna (färre än minsta gruppstorlek) får inga andelar, och dialogen säger det.
// Samma dialogmönster som BAS-dossiern (81-basdossier.js).
// ====================================================================

/** @type {{nyckel: string, grupp: string, kalla: string, skillnadKr: number|null, iExport: boolean, rader: {kategori: string, belopp: string, kommentar: string}[]}|null} */
let _skal = null;
const SKAL_JA = 'Ja, sakligt skäl finns';
const _skalKr = v => `${svTal(Math.round(v), 0)} kr`;
const _skalPct = v => svPct(v * 100, 0);

/** Beloppet i fältet som heltal, eller null när det inte är ett giltigt belopp (0–200 000). */
function _skalBelopp(t) {
    const s = String(t ?? '').replace(/\s/g, '');
    if (!/^\d+$/.test(s)) return null;
    const v = Number(s);
    return v <= 200000 ? v : null;
}
/** Skälen i utkastet som går att lagra.
 * @returns {{kategori: string, belopp: number, kommentar: string}[]} */
const _skalGiltiga = () => (_skal ? /** @type {any[]} */ (_skal.rader.map(r => ({ kategori: r.kategori, belopp: _skalBelopp(r.belopp), kommentar: r.kommentar }))
    .filter(r => r.belopp != null)) : []);

/** Öppnar dialogen för en rad i handlingsplanen, med fokus tillbaka till öppnaren när den stängs. */
function openSkalDialog(nyckel, opener) {
    const modal = document.getElementById('skal-modal');
    if (!modal || !nyckel) return;
    // Gruppens skillnad och om raden följer med i exporterna: ur förifyllningen i exportläget.
    const iExport = medExportLage(() => _handlingsplanSeedRows());
    const skarm = _handlingsplanSeedRows({ baraEgna: !getData().length });
    const i = iExport.nycklar.indexOf(nyckel), j = skarm.nycklar.indexOf(nyckel);
    const rad = i >= 0 ? iExport.rows[i] : j >= 0 ? skarm.rows[j] : null;
    const egen = _hpArEgen(nyckel);
    _skal = {
        nyckel, kalla: nyckel.split('|')[0],
        grupp: (rad && rad[1]) || (egen ? 'Egen rad' : nyckel),
        skillnadKr: i >= 0 ? iExport.skillnader[i] : null,
        iExport: i >= 0 || egen,
        rader: (_hpVarden(nyckel).skal || []).map(s => ({ kategori: s.kategori, belopp: String(s.belopp), kommentar: s.kommentar || '' })),
    };
    _skalRender();
    modal.style.display = 'flex';
    if (typeof trapFocus === 'function') trapFocus(modal, opener || document.activeElement);
}
function closeSkalDialog() {
    const modal = document.getElementById('skal-modal');
    if (!modal || modal.style.display !== 'flex') return;
    if (typeof releaseFocus === 'function') releaseFocus(modal);
    modal.style.display = 'none';
    _skal = null;
}

/** Raden överst: gruppens medianskillnad, eller varför inga andelar räknas. */
function _skalSkillnadHtml() {
    const s = /** @type {NonNullable<typeof _skal>} */ (_skal);
    if (s.kalla === 'egen') return '<p class="skal-skillnad">En egen rad har ingen medianskillnad att räkna andelar mot. Skälen redovisas med belopp.</p>';
    if (!s.iExport) return `<p class="skal-skillnad">Gruppen har färre än ${kInstalld()} personer i det som lämnar verktyget, så raden och skälen följer inte med i exporterna och inga andelar räknas.</p>`;
    if (s.skillnadKr == null) return `<p class="skal-skillnad">Medianskillnaden redovisas inte: ett kön i gruppen har färre än ${kInstalld()} personer. Skälen redovisas med belopp.</p>`;
    const vad = s.kalla === 'par' ? 'jämförelseyrkets median minus det kvinnodominerade yrkets' : 'mäns median minus kvinnors i gruppen';
    if (s.skillnadKr <= 0) return `<p class="skal-skillnad">Kvinnornas median är inte lägre än männens (${vad}: ${svTal(s.skillnadKr, 0)} kr/mån). Andelar räknas inte.</p>`;
    return `<p class="skal-skillnad"><strong>Medianskillnad ${svTal(s.skillnadKr, 0)} kr/mån</strong> <span class="text-dampad-sm">(${vad})</span></p>`;
}

function _skalRadHtml(r, i) {
    const k = _sakKategorier();
    const vald = k.find(x => x.id === r.kategori) || k[0];
    const ogiltig = _skalBelopp(r.belopp) == null;
    return `<tr class="skal-rad" data-skal-i="${i}">`
        + `<td><select class="form-select skal-kategori" data-skal-i="${i}" aria-label="Kategori, skäl ${i + 1}">`
        + k.map(x => `<option value="${esc(x.id)}" title="${esc(x.forklaring)}"${x.id === vald.id ? ' selected' : ''}>${esc(x.namn)}</option>`).join('')
        + `</select><div class="text-dampad-xs skal-forklaring">${esc(vald.forklaring)}</div></td>`
        + `<td><input type="text" inputmode="numeric" class="skal-falt skal-belopp" data-skal-i="${i}" value="${esc(r.belopp)}" autocomplete="off" aria-label="Belopp i kr/mån, skäl ${i + 1}"${ogiltig && r.belopp !== '' ? ' aria-invalid="true"' : ''}></td>`
        + `<td class="t-tal skal-andel">${esc(_skalAndelText(r))}</td>`
        + `<td><input type="text" class="skal-falt skal-kommentar" data-skal-i="${i}" value="${esc(r.kommentar)}" maxlength="200" autocomplete="off" placeholder="Kort motivering, inga namn" aria-label="Kommentar, skäl ${i + 1}"></td>`
        + `<td><button type="button" class="btn-table-tool" data-skal-ta-bort="${i}" aria-label="Ta bort skäl ${i + 1}">Ta bort</button></td></tr>`;
}
function _skalAndelText(r) {
    const b = _skalBelopp(r.belopp), n = _skal && _skal.skillnadKr;
    return b != null && n && n > 0 ? _skalPct(b / n) : '–';
}

/** Ritar hela dialogens innehåll (vid öppning och när ett skäl läggs till eller tas bort). */
function _skalRender() {
    const body = document.getElementById('skal-body');
    if (!body || !_skal) return;
    const s = _skal, fullt = s.rader.length >= 8;
    body.innerHTML = `<h3 class="fs-lg marg-0">${esc(s.grupp)}</h3>${_skalSkillnadHtml()}`
        + (s.rader.length
            ? `<div class="table-container"><table class="data-table st-088 skal-tabell"><thead><tr><th scope="col">Kategori</th><th scope="col" class="t-hoger">Belopp (kr/mån)</th><th scope="col" class="t-hoger">Andel av skillnaden</th><th scope="col">Kommentar</th><th scope="col"><span class="sr-only">Ta bort</span></th></tr></thead><tbody>${s.rader.map(_skalRadHtml).join('')}</tbody></table></div>`
            : '<p class="text-dampad-sm">Inga skäl ännu. Lägg till ett skäl för varje kategori som förklarar en del av skillnaden.</p>')
        + `<div class="rad-bryt-mitt gap-8 marg-t-8"><button id="skal-lagg-till" class="btn btn-secondary btn-sm" type="button"${fullt ? ' disabled' : ''}>Lägg till skäl</button>`
        + '<span class="text-dampad-sm">Högst 8 skäl per grupp. Beloppet är den del av gruppens medianskillnad, i kronor per månad, som skälet förklarar.</span></div>'
        + '<p id="skal-varning" class="handlingsplan-varning" role="status" hidden>En kommentar liknar ett personnummer eller en e-postadress, och texten följer med i exporterna. Skriv på gruppnivå i stället.</p>'
        + '<div id="skal-status"></div>';
    _skalUppdatera();
    // Fokusfällan cachar de fokuserbara elementen: läggs om när innehållet byggs om medan dialogen är öppen.
    const modal = document.getElementById('skal-modal');
    if (modal && modal.style.display === 'flex' && typeof _focusTraps !== 'undefined') {
        const trap = _focusTraps.get(modal), opener = trap ? trap.opener : null;
        if (trap) { modal.removeEventListener('keydown', trap.handler); _focusTraps.delete(modal); }
        const aktiv = document.activeElement;
        trapFocus(modal, opener);
        if (aktiv && aktiv !== document.body && modal.contains(aktiv)) setTimeout(() => /** @type {HTMLElement} */ (aktiv).focus(), 60);
    }
}

/** Lagrar utkastet på raden och ritar om det som räknas: summan, varningarna, förslaget och knappen i tabellen. */
function _skalUppdatera() {
    if (!_skal) return;
    const s = _skal;
    _hpSattSkal(s.nyckel, _skalGiltiga());
    const sum = _sakSammanstallning(_skalGiltiga(), s.iExport ? s.skillnadKr : null);
    const status = document.getElementById('skal-status');
    if (status) {
        const summa = sum.forklaradAndel != null
            ? `Förklarat ${_skalKr(sum.summa)} (${_skalPct(sum.forklaradAndel)}) · Återstår ${_skalKr(/** @type {number} */ (sum.aterstar))} (${_skalPct(/** @type {number} */ (sum.aterstarAndel))})`
            : `Förklarat ${_skalKr(sum.summa)}`;
        const ja = _hpVarden(s.nyckel).sakligt === SKAL_JA;
        status.innerHTML = `<p id="skal-summa" class="skal-summa" aria-live="polite">${esc(summa)}</p>`
            + (sum.overstiger ? '<p id="skal-overstiger" class="handlingsplan-varning" role="alert">Skälen överstiger skillnaden.</p>' : '')
            + (sum.forklaradAndel != null && sum.forklaradAndel >= 1 && !ja
                ? '<div class="skal-forslag"><p class="text-dampad-sm marg-0">Skälen förklarar hela skillnaden. Raden kan markeras med <strong>Ja, sakligt skäl finns</strong>.</p>'
                  + '<button id="skal-markera" class="btn btn-primary btn-sm" type="button">Markera som sakligt förklarad</button></div>'
                : '');
    }
    // Personuppgiftsvakten som i handlingsplanens fritexter.
    let traff = 0;
    document.querySelectorAll('#skal-body input.skal-kommentar').forEach(el => {
        const liknar = _hpLiknarPersonuppgift(/** @type {HTMLInputElement} */ (el).value);
        if (liknar) { el.setAttribute('aria-describedby', 'skal-varning'); traff++; } else el.removeAttribute('aria-describedby');
    });
    const varning = document.getElementById('skal-varning');
    if (varning) varning.hidden = !traff;
    // Knappen i tabellen på fliken, utan att tabellen ritas om (fokus och öppnaren står kvar).
    document.querySelectorAll('#handlingsplan-tbody [data-hp-skal]').forEach(b => {
        const btn = /** @type {HTMLElement} */ (b);
        if (btn.dataset.hpSkal !== s.nyckel) return;
        const sp = btn.querySelector('.hp-skal-sammanfattning');
        const sk = btn.dataset.hpSkillnad;
        if (sp) sp.textContent = _hpSkalSammanfattning(s.nyckel, sk === '' || sk == null ? null : Number(sk));
    });
}

// ---- Wiring ----
document.addEventListener('click', e => {
    const t = /** @type {HTMLElement} */ (e.target);
    if (!t || !t.closest) return;
    // Läs-raden i gruppdossiern och BAS-dossiern: dossiern stängs och raden i Handlingsplan får fokus.
    const gaTill = t.closest('[data-hp-ga-till]');
    if (gaTill) {
        e.preventDefault();
        if (typeof closeGruppdossier === 'function') closeGruppdossier();
        if (typeof closeBasdossier === 'function') closeBasdossier();
        _hpGaTillRad(gaTill.getAttribute('data-hp-ga-till') || '');
        return;
    }
    const oppna = t.closest('[data-hp-skal]');
    if (oppna) { openSkalDialog(oppna.getAttribute('data-hp-skal') || '', oppna); return; }
    if (!t.closest('#skal-modal')) return;
    if (t.closest('[data-skal-close]')) { closeSkalDialog(); return; }
    if (!_skal) return;
    if (t.closest('#skal-lagg-till')) {
        if (_skal.rader.length >= 8) return;
        const anvanda = new Set(_skal.rader.map(r => r.kategori));
        const forsta = _sakKategorier().find(k => !anvanda.has(k.id)) || _sakKategorier()[0];
        _skal.rader.push({ kategori: forsta.id, belopp: '', kommentar: '' });
        _skalRender();
        const sel = [...document.querySelectorAll('#skal-body select.skal-kategori')].at(-1);
        if (sel) /** @type {HTMLElement} */ (sel).focus();
        return;
    }
    const bort = t.closest('[data-skal-ta-bort]');
    if (bort) {
        _skal.rader.splice(Number(bort.getAttribute('data-skal-ta-bort')), 1);
        _skalRender();
        document.getElementById('skal-lagg-till')?.focus();
        if (typeof announceToScreenReader === 'function') announceToScreenReader('Skälet är borttaget.');
        return;
    }
    if (t.closest('#skal-markera')) {
        const nyckel = _skal.nyckel;
        _hpSatt(nyckel, 'sakligt', SKAL_JA);
        document.querySelectorAll('#handlingsplan-tbody select.hp-falt').forEach(el => {
            const sel = /** @type {HTMLSelectElement} */ (el);
            if (sel.dataset.hpNyckel === nyckel && sel.dataset.hpFalt === 'sakligt') sel.value = SKAL_JA;
        });
        _skalUppdatera();
        document.getElementById('skal-summa')?.setAttribute('tabindex', '-1');
        document.getElementById('skal-summa')?.focus();
        if (typeof announceToScreenReader === 'function') announceToScreenReader('Raden är markerad: sakligt skäl finns.');
    }
});
['input', 'change'].forEach(typ => document.getElementById('skal-modal')?.addEventListener(typ, e => {
    const el = /** @type {HTMLInputElement} */ (e.target);
    if (!_skal || !el || !el.dataset || el.dataset.skalI == null) return;
    const r = _skal.rader[Number(el.dataset.skalI)];
    if (!r) return;
    if (el.classList.contains('skal-kategori')) {
        r.kategori = el.value;
        const f = el.parentElement && el.parentElement.querySelector('.skal-forklaring');
        const k = _sakKategorier().find(x => x.id === el.value);
        if (f && k) f.textContent = k.forklaring;
    } else if (el.classList.contains('skal-belopp')) {
        r.belopp = el.value;
        if (_skalBelopp(el.value) == null && el.value !== '') el.setAttribute('aria-invalid', 'true'); else el.removeAttribute('aria-invalid');
        const andel = el.closest('tr')?.querySelector('.skal-andel');
        if (andel) andel.textContent = _skalAndelText(r);
    } else if (el.classList.contains('skal-kommentar')) r.kommentar = el.value.slice(0, 200);
    _skalUppdatera();
}));
document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && document.getElementById('skal-modal')?.style.display === 'flex') closeSkalDialog();
});

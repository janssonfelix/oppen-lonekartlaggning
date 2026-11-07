// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson

// ---- Förhandskontroll av lönefilen ----
// Avsnittet överst i Filer och kvalitet: hur den senast inlästa lönefilen tolkades — de tio första raderna med filens
// värde och verktygets tolkning, sammandraget, värdefördelningen med varningar och kolumnerna. Logiken bor i
// src/lib/forhandskontroll.js (_fkBygg); inläsningen (32-filinlasning.js) samlar raderna och kallar _fkForFil.
// Det som visas finns bara i state.forhandskontroll, i minnet: inte i konfigurationsfilen eller någon export.
// Varningarna står också i Att göra (18-atgardslista.js, _fkAttGora) och i inläsningsrapporten.
//
// Med inställningen "Stoppa och visa förhandskontrollen innan inläsning" (state.forhandskontrollStopp, standard av)
// väntar en inläst fil här på Läs in eller Avbryt (_fkVantar); demo och organisationspaket läses inte via lönefilen
// och påverkas inte.

/** Den fil som väntar på Läs in: { lasIn, tidigare } (tidigare: förhandskontrollen som gällde före), eller null. */
let _fkVantar = /** @type {{lasIn: () => void, tidigare: any}|null} */ (null);
/** Förhandskontrollen som avsnittet senast ritades för: utfällt eller hopfällt sätts bara när en ny ritas. */
let _fkRitad = /** @type {any} */ (null);
const FK_MAX_KONVARDEN = 20;
const FK_OVRIGA = '(övriga värden)';
const FK_ROLLNAMN = { bas: 'BAS', yrke: 'Yrke / AID', lon: 'Lön', alder: 'Ålder', kon: 'Kön', poang: 'Poäng', ansvar: 'Ansvar' };

/** Räknar ett värde i kön-kolumnen med verktygets tolkning (kvinna, man eller null). Högst 20 olika värden. */
function _fkRaknaKon(karta, ra, tolkat) {
    const nyckel = String(ra ?? '').trim();
    const k = karta.has(nyckel) || karta.size < FK_MAX_KONVARDEN ? nyckel : FK_OVRIGA;
    const v = karta.get(k) || { 'rå': k, tolkat: k === FK_OVRIGA ? null : tolkat, antal: 0 };
    v.antal++;
    karta.set(k, v);
}

/**
 * Förhandskontrollen för en inläst fil. Kolumnerna som lästes är kolumnmappningens (vald rubrik, importprofil,
 * delsträng); ansvarskoden bara om kolumnen godkändes.
 * @param {{forsta: any[], konVarden: Map<string, any>, parseStats: any, headers: string[], data: any[]}} u
 */
function _fkForFil({ forsta, konVarden, parseStats, headers, data }) {
    const mappning = { ..._kolumnval(headers).eff, ansvar: state.ansvarKolumn ? state.ansvarKolumn.namn : null };
    const p = state.importprofil;
    return _fkBygg({ rader: forsta, data, konVarden: [...konVarden.values()], parseStats, headers, mappning,
        k: kInstalld(), profil: p ? { namn: p.namn, kalla: p.kalla } : null });
}

/** Nyckeltalet i avsnittets rubrikrad. */
function _fkNyckeltext(fk) {
    if (!fk) return '';
    if (fk.vantar) return 'väntar på Läs in';
    const n = fk.varningar.length;
    return n ? `${n} ${n === 1 ? 'varning' : 'varningar'}` : 'inget att anmärka';
}

/** Filen väntar på Läs in: förhandskontrollen visas med knapparna, och det tidigare underlaget ligger kvar. */
function _fkPausa(fk, lasIn) {
    const tidigare = _fkVantar ? _fkVantar.tidigare : state.forhandskontroll;
    _fkVantar = { lasIn, tidigare };
    state.forhandskontroll = { ...fk, vantar: true };
    hideLoading();
    dataStatus.textContent = 'Förhandskontrollen väntar: filen är inte inläst ännu. Granska tolkningen och välj Läs in eller Avbryt.';
    dataStatus.className = 'status-msg warning';
    renderForhandskontroll();
    const av = document.getElementById('avsnitt-fi-forhandskontroll');
    const filer = document.querySelector('.nav-item[data-tab="filer"]');
    if (filer && !filer.classList.contains('active')) /** @type {HTMLElement} */ (filer).click();
    av?.scrollIntoView?.({ block: 'start' });
    /** @type {HTMLElement|null} */ (document.getElementById('fk-las-in'))?.focus?.({ preventScroll: true });
    announceToScreenReader(dataStatus.textContent);
}
/** Läs in: filen läses in som om inställningen vore av. */
function _fkLasIn() {
    const v = _fkVantar;
    if (!v) return;
    _fkVantar = null;
    v.lasIn();
}
/** Avbryt: det inlästa släpps, och det tidigare underlaget och dess förhandskontroll står kvar. */
function _fkAvbryt() {
    const v = _fkVantar;
    if (!v) return;
    _fkVantar = null;
    state.forhandskontroll = v.tidigare || null;
    renderForhandskontroll();
    dataStatus.textContent = state.data.length
        ? 'Inläsningen avbröts. Det tidigare inlästa underlaget ligger kvar.'
        : 'Inläsningen avbröts. Ingen lönefil är inläst.';
    dataStatus.className = 'status-msg';
    announceToScreenReader(dataStatus.textContent);
}
/** Rensa all data och en ny inläsning av demot: förhandskontrollen och en väntande fil släpps. */
function _fkSlapp() {
    _fkVantar = null;
    _fkRitad = null;
    state.forhandskontroll = null;
    renderForhandskontroll();
}

/**
 * Varningarna som punkter i Att göra (kategorin Underlagets kvalitet). Okänt kön har redan en punkt (Datakvalitet,
 * dq-kon) och läggs inte till två gånger. Inga punkter medan filen väntar på Läs in.
 */
function _fkAttGora() {
    const fk = state.forhandskontroll;
    if (!fk || fk.vantar) return [];
    return fk.varningar.filter(v => v.kod !== 'kon-okand').map(v => ({
        id: 'fk-' + v.kod,
        kategori: 'Underlagets kvalitet',
        prioritet: v.niva === 'fel' ? 'hög' : 'medel',
        titel: `Förhandskontrollen: ${v.niva === 'fel' ? 'kontrollera filen' : 'att granska'}`,
        detalj: v.text,
        tab: 'filer',
        ankare: 'avsnitt-fi-forhandskontroll',
        källa: 'Förhandskontroll av lönefilen'
    }));
}

/** Raden i inläsningsrapporten: förhandskontrollens nyckeltal och länken till avsnittet. */
function _fkRapportrad() {
    const fk = state.forhandskontroll;
    if (!fk || fk.vantar) return '';
    const n = fk.varningar.length;
    return `<div class="dvr-row ${n ? 'warn' : 'ok'}"><span><span class="dvr-icon">${ikon(n ? 'statusVarning' : 'bock')}</span>Förhandskontroll: ${esc(_fkNyckeltext(fk))}</span>`
        + `<a href="#" class="dvr-value" data-go-to-tab="filer" data-go-to-anchor="avsnitt-fi-forhandskontroll">Visa förhandskontrollen</a></div>`;
}

function _fkCellHtml(cell) {
    if (!cell) return '<td></td>';
    if (!cell.fel) return `<td>${esc(cell.text)}</td>`;
    return `<td class="fk-fel">${ikon('statusVarning', 14)} <span class="fk-varde">${esc(cell.text)}</span><span class="fk-skal">${esc(cell.fel)}</span></td>`;
}
const _fkLista = (rader) => `<ul class="fk-lista">${rader.map(r => `<li>${r}</li>`).join('')}</ul>`;
const _fkKr = v => (typeof v === 'number' ? `${svTal(v, 0)} kr` : '–');

/** Ritar avsnittet Förhandskontroll av lönefilen ur state.forhandskontroll (dolt när den saknas). */
function renderForhandskontroll() {
    const av = /** @type {HTMLDetailsElement|null} */ (document.getElementById('avsnitt-fi-forhandskontroll'));
    const host = document.getElementById('forhandskontroll');
    if (!av || !host) return;
    const fk = state.forhandskontroll;
    if (!fk) {
        av.hidden = true;
        host.innerHTML = '';
        _laNyckel('nyckel-fi-forhandskontroll', '');
        _fkRitad = null;
        return;
    }
    av.hidden = false;
    const n = fk.varningar.length, fel = fk.varningar.some(v => v.niva === 'fel');
    _laNyckel('nyckel-fi-forhandskontroll', _fkNyckeltext(fk), fk.vantar ? 'granska' : n ? (fel ? true : 'granska') : false);
    if (_fkRitad !== fk) { av.open = !!fk.vantar || n > 0; _fkRitad = fk; }
    const g = _fkGranser();
    const roller = fk.tolkning.length ? Object.keys(fk.tolkning[0].celler) : ['bas', 'yrke', 'lon', 'alder', 'kon'];
    const p = fk.kolumner.profil;
    const vantar = fk.vantar ? `<div class="fk-vantar">
            <p><strong>Filen är inte inläst ännu.</strong> Inställningen <em>Stoppa och visa förhandskontrollen innan inläsning</em> är på. Granska tolkningen nedan och välj Läs in, eller Avbryt för att släppa filen${state.data.length ? ' och behålla det underlag som redan är inläst' : ''}.</p>
            <div class="rad-bryt gap-10"><button id="fk-las-in" class="btn btn-primary btn-sm" type="button">Läs in</button><button id="fk-avbryt" class="btn btn-secondary btn-sm" type="button">Avbryt</button></div>
        </div>` : '';
    const varningar = n
        ? `<ul class="fk-varningar">${fk.varningar.map(v => `<li class="fk-${v.niva}">${ikon(v.niva === 'fel' ? 'statusKritisk' : 'statusVarning', 14)} ${esc(v.text)}</li>`).join('')}</ul>`
        : `<p class="fk-varningar fk-inget">${ikon('bock', 14)} Inget att anmärka: värdena ligger inom de gränser förhandskontrollen prövar.</p>`;

    const s = fk.sammandrag;
    const bortfall = s.bortfall.map(b => `${esc(svTal(b.antal, 0))} ${b.antal === 1 ? 'rad' : 'rader'} ${esc(b.text)}${b.exempel.length ? ` (t.ex. ${b.exempel.map(e => `"${esc(e)}"`).join(', ')})` : ''}`);
    const sammandrag = _fkLista([
        `Rader i filen: <strong>${esc(svTal(s.totalt, 0))}</strong>; används: <strong>${esc(svTal(s.anvands, 0))}</strong>`,
        ...(bortfall.length ? bortfall.map(t => `Faller bort: ${t}`) : ['Inga rader faller bort']),
        ...(s.ogiltigAlder.antal ? [`Ålder som inte går att läsa som tal: ${esc(svTal(s.ogiltigAlder.antal, 0))} rader (t.ex. ${s.ogiltigAlder.exempel.map(e => `"${esc(e)}"`).join(', ')}); raderna används med okänd ålder`] : []),
        `Ålder tolkad ur födelseår: ${esc(svTal(s.fodelsear, 0))} rader`,
    ]);

    const f = fk.fordelning;
    const kon = f.kon.map(v => `${v['rå'] ? `"${esc(v['rå'])}"` : '(tom)'} ${v.tolkat ? `tolkat som ${esc(v.tolkat)}` : 'tolkas inte'} (${esc(svTal(v.antal, 0))})`).join(', ');
    const fordelning = _fkLista([
        `BAS-värden: ${f.bas.varden.map(b => `${esc(b.bas)} (${esc(svTal(b.antal, 0))})`).join(', ') || '–'}${f.bas.ovanliga.length ? `; inte en bokstav A–N: ${f.bas.ovanliga.map(esc).join(', ')}` : ''}`,
        `Kön-värden: ${kon || '–'}`,
        `Lön: lägst ${_fkKr(f.lon?.min)}, median ${_fkKr(f.lon?.median)}, högst ${_fkKr(f.lon?.max)} (en median över ${esc(svTal(g.arslonMedian, 0))} kr ser ut som årslön, under ${esc(svTal(g.timlonMedian, 0))} kr som timlön)`,
        `Ålder: ${f.alder ? `lägst ${esc(svTal(f.alder.min, 0))}, högst ${esc(svTal(f.alder.max, 0))} år; utanför ${g.alderMin}–${g.alderMax} år: ${esc(svTal(f.alder.utanfor, 0))}` : '–'}`,
        `BAS-intervall med färre än ${esc(svTal(f.smaBas.k, 0))} personer: ${f.smaBas.bas.length ? `${f.smaBas.bas.map(esc).join(', ')} (${esc(svPct(f.smaBas.andel * 100, 1))} av raderna)` : 'inga'}`,
    ]);

    const kol = fk.kolumner;
    const kolumner = _fkLista([
        `Används: ${kol.anvanda.map(a => `${esc(FK_ROLLNAMN[a.roll] || a.roll)}: <code>${esc(a.rubrik)}</code>`).join(', ')}`,
        `Används inte: ${kol.oanvanda.length ? kol.oanvanda.map(h => `<code>${esc(h)}</code>`).join(', ') : 'inga'}`,
        'Personnummer, namn och e-post: en kolumn med sådana uppgifter stoppar inläsningen, och filen hade ingen.',
    ]);

    host.innerHTML = `${vantar}
        <p class="fk-profil text-dampad-sm">${p ? esc(importprofilText(p)) : 'Ingen importprofil kände igen filen: kolumnerna valdes på rubrikernas namn eller i kolumnmappningen.'}</p>
        ${varningar}
        <h3 class="fs-md marg-14-0-8">Tolkningen av de ${esc(svTal(g.antalRader, 0))} första raderna</h3>
        <p class="text-dampad-sm lh-1_5 marg-0-0-8">Filens värde och verktygets tolkning står i samma cell när de skiljer sig. En markerad cell gick inte att tolka eller ligger utanför det rimliga; en dämpad rad används inte i analysen. Raderna visas bara här, på skärmen, och följer inte med i någon export eller i konfigurationsfilen.</p>
        <div class="rulla-x"><table id="fk-tolkning" class="data-table">
            <thead><tr><th scope="col">Rad i filen</th>${roller.map(r => `<th scope="col">${esc(FK_ROLLNAMN[r] || r)}</th>`).join('')}</tr></thead>
            <tbody>${fk.tolkning.map(rad => `<tr${rad.anvands ? '' : ' class="fk-bort"'}><td>${rad.radnr != null ? esc(String(rad.radnr)) : '–'}${rad.anvands ? '' : ' <span class="fk-skal">används inte</span>'}</td>${roller.map(r => _fkCellHtml(rad.celler[r])).join('')}</tr>`).join('')}</tbody>
        </table></div>
        <h3 class="fs-md marg-14-0-8">Sammandrag</h3>${sammandrag}
        <h3 class="fs-md marg-14-0-8">Värdefördelning</h3>${fordelning}
        <h3 class="fs-md marg-14-0-8">Kolumner</h3>${kolumner}`;
    host.querySelector('#fk-las-in')?.addEventListener('click', _fkLasIn);
    host.querySelector('#fk-avbryt')?.addEventListener('click', _fkAvbryt);
}

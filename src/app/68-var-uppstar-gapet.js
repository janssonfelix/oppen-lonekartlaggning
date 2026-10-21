// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
// ---- Var uppstår löneskillnaden? (ADR-22) ----
/**
 * Kort i Översikt: gapet i medellön delat i BAS-fördelning (A), AID inom BAS (B) och
 * lön inom samma AID och BAS (C), med de grupper som bidrar mest. Beräkningen bor i
 * src/lib/gapuppdelning.js (_guGapUppdelning). Anropas först i updateCompliance().
 */
const _GU_DELAR = [
    { id: 'A', namn: 'BAS-fördelning', betyder: 'Kvinnor och män är olika fördelade över BAS.',
      atgard: 'Hör till karriärvägar och rekrytering — inte till lönesättningen.', flik: 'struktur', flikNamn: 'Struktur' },
    { id: 'B', namn: 'AID inom BAS', betyder: 'Kvinnor och män har olika AID inom samma BAS.',
      atgard: 'Kan kräva en lönesatsning på yrket; pröva likvärdigt arbete.', flik: 'likvardighet', flikNamn: 'Likvärdigt arbete' },
    { id: 'C', namn: 'Inom AID och BAS', betyder: 'Kvinnor och män har olika lön i samma AID och BAS.',
      atgard: 'Pröva lika arbete och se över lönerna individuellt.', flik: 'matrix', flikNamn: 'Lika arbete',
      ankare: 'personer-att-granska', ankareNamn: 'Personer att granska' },
];

function _guKr(v, tecken = true) {
    const r = Math.round(v);
    const s = new Intl.NumberFormat('sv-SE', { maximumFractionDigits: 0 }).format(Math.abs(r));
    return `${tecken && r !== 0 ? (r < 0 ? '−' : '+') : ''}${s} kr`;
}
function _guPct(v, dec = 1) {
    return `${new Intl.NumberFormat('sv-SE', { minimumFractionDigits: dec, maximumFractionDigits: dec }).format(v)} %`;
}

function renderGapUppdelning() {
    const host = document.getElementById('gap-uppdelning');
    const body = document.getElementById('gap-uppdelning-innehall');
    if (!host || !body) return;
    const d = getData();
    if (!d.length) { host.hidden = true; body.innerHTML = ''; return; }
    host.hidden = false;
    const demo = state.isDemo ? '<p class="gu-demo"><strong>DEMODATA — inte verkliga löner.</strong></p>' : '';
    /** @type {any} */
    const u = _guGapUppdelning(d, { k: kTroskel() });
    if (!u) {
        body.innerHTML = demo + `<p>För få personer för att dela upp skillnaden: ett kön har färre än ${kTroskel()} personer i urvalet.</p>`;
        return;
    }
    const inledning = u.gap >= 0
        ? `Män har i genomsnitt <strong>${_guKr(u.gap, false)}</strong> (${_guPct(u.gapPct)}) högre medellön än kvinnor.`
        : `Kvinnor har i genomsnitt <strong>${_guKr(-u.gap, false)}</strong> (${_guPct(-u.gapPct)}) högre medellön än män.`;
    const medKv = Stat.median(d.filter(r => r.kon.includes('kvinna') && r.lon > 0).map(r => r.lon));
    const medMa = Stat.median(d.filter(r => (r.kon === 'man' || r.kon === 'män') && r.lon > 0).map(r => r.lon));
    const medianText = medMa > 0 ? ` Kvinnors medianlön är ${_guPct(medKv / medMa * 100)} av mäns.` : '';
    if (!u.skyddad) {
        body.innerHTML = demo + `<p class="gu-inledning">${inledning}${medianText}</p>`
            + `<p class="gu-not">Skillnaden delas inte upp här: en grupp med färre än ${kTroskel()} personer står för så stor del av `
            + 'en av delarna att dess bidrag annars skulle kunna räknas fram.</p>';
        return;
    }
    const max = Math.max(1, ...['A', 'B', 'C'].map(x => Math.abs(u.delar[x])));
    const rader = _GU_DELAR.map(del => {
        const v = u.delar[del.id];
        const bredd = Math.abs(v) / max * 50;
        const andel = u.litetGap ? '' : `<span class="gu-andel">${_guPct(v / u.gap * 100, 0)} av skillnaden</span>`;
        const topp = u.topp[del.id].map(p => `<li>${esc(p.namn)}: ${_guKr(p.kr)}</li>`).join('')
            // Dolda grupper redovisas bara med antal — deras summa kunde röja en enskild grupp.
            + (u.ovrigaAntal[del.id] ? `<li class="gu-ovriga">${u.ovrigaAntal[del.id]} ${u.ovrigaAntal[del.id] === 1 ? 'grupp' : 'grupper'} med färre än ${kTroskel()} personer ingår i summan</li>` : '');
        return `<div class="gu-rad" data-gu-del="${del.id}">
            <div class="gu-rubrik"><strong>${del.id}. ${del.namn}</strong><span class="gu-belopp">${_guKr(v)}</span>${andel}</div>
            <div class="gu-stapel" aria-hidden="true"><span class="gu-fyll ${v < 0 ? 'gu-neg' : 'gu-pos'}" data-stil-mvanster="${(v < 0 ? 50 - bredd : 50).toFixed(1)}%" data-stil-bredd="${bredd.toFixed(1)}%"></span></div>
            <p class="gu-text">${del.betyder} ${del.atgard} <a href="#" data-go-to-tab="${del.flik}">Till ${del.flikNamn}</a>${del.ankare ? ` <a href="#" data-go-to-tab="${del.flik}" data-go-to-anchor="${del.ankare}">${del.ankareNamn}</a>` : ''}</p>
            ${topp ? `<ul class="gu-topp">${topp}</ul>` : ''}
        </div>`;
    }).join('');
    body.innerHTML = demo
        + `<p class="gu-inledning">${inledning}${medianText} Uppdelningen räknar med medellön, eftersom delarna då summerar exakt. Positiva belopp betyder att männens medellön är högre.</p>`
        + (u.litetGap ? '<p class="gu-not">Skillnaden är mindre än 1 % av männens medellön. Delarna kan då peka åt olika håll och vara större än själva skillnaden.</p>' : '')
        + '<div id="chart-gap-uppdelning" class="marg-6-0-14"></div>'
        + rader
        + '<p class="gu-not">Grupperna rangordnas efter bidrag till hela organisationens skillnad och kan därför skilja sig från de flaggade yrkena i Lika arbete, som sorteras efter skillnadens storlek. Grupper där ett kön har färre än '
        + `${kTroskel()} personer namnges inte.</p>`; tillampaDataStil(body);
    { const el = document.getElementById('chart-gap-uppdelning'); if (el) ritaFigur(el, _guTrappaFigur(u)); }
}

// Uppdelningen som trappa: från noll läggs de tre delarna (A, B, C) på varandra och landar i hela skillnaden i
// medellön. Bara de tre delsummorna och totalen ritas — samma tal som raderna under, och aldrig en enskild grupps
// bidrag (det skyddas av uppdelningens egen regel för små grupper; figuren ritas bara när `u.skyddad`).
function _guTrappaFigur(u) {
    const kategorier = [..._GU_DELAR.map(d => `${d.id}. ${d.namn}`), 'Hela skillnaden'];
    let niva = 0;
    const steg = _GU_DELAR.map((d, i) => { const fore = niva; niva += u.delar[d.id];
        return { x: kategorier[i], lag: Math.round(Math.min(fore, niva)), hog: Math.round(Math.max(fore, niva)), del: u.delar[d.id], efter: niva,
                 farg: u.delar[d.id] >= 0 ? PALETTE.serie[0] : PALETTE.serie[1] }; });
    const streck = [...steg.map(s => ({ x: s.x, y: Math.round(s.efter), etikett: _guKr(s.del) })), { x: 'Hela skillnaden', y: Math.round(u.gap), etikett: _guKr(u.gap) }];
    return { beskrivning: 'Skillnaden i medellön mellan män och kvinnor delad i tre delar som läggs på varandra: BAS-fördelning, AID inom BAS och lön inom samma AID och BAS. Positiva belopp betyder att männens medellön är högre. Samma belopp står i raderna under.',
        legend: false, hojd: 280, x: { skala: 'band', ordning: kategorier }, y: { skala: 'linjar', titel: 'Skillnad i medellön (kr/månad)', format: 'kr', nollinje: true },
        lager: [{ marke: 'stapel', lage: 'overlagrad', serie: 'Hela skillnaden', farg: PALETTE.semantic.neutral, opacitet: 0.4, data: [{ x: 'Hela skillnaden', y: Math.round(u.gap) }], tips: d => [[d.x], ['Skillnad i medellön', _guKr(d.y)]] },
                { marke: 'intervall', serie: 'Delens bidrag', tjocklek: 44, data: steg, tips: d => [[d.x], ['Bidrag', _guKr(d.del)], ['Summa hit', _guKr(d.efter)]] },
                { marke: 'punkt', symbol: 'streck', serie: 'Summa efter delen', farg: PALETTE.semantic.mork, storlek: 11, data: streck }] };
}

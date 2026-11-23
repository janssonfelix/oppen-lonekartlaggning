// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
// ---- Var uppstår löneskillnaden? (ADR-22) ----
import { gapAllaVariabler, gapDelar, gapDelarIText, gapOvrigaText, gapStandardVariabler, gapVariabelEtikett, gapVariablerArStandard, gapVariablerIText, normaliseraGapVariabler } from '../lib/gapuppdelning.js';
import { personOrd } from '../lib/namn.js';
import { andelAvSkillnaden, gapTrappa, vymodellVarUppstarGapet } from '../lib/vymodell-var-uppstar-gapet.js';
import { meddelaSkarmlasare, esc } from './01-html-och-tillganglighet.js';
import { ikon } from './03-ikoner.js';
import { kTroskel } from './06-k-troskel.js';
import { T } from './09-termer.js';
import { ritaFigur } from './10-diagramritare.js';
import { PALETTE } from './10-diagramtema.js';
import { hamtaData, state } from './12-tillstand.js';
import { harAlder } from './50-regressionsmodeller.js';
/**
 * Kort i Lönestruktur: gapet i medellön delat efter de valda förklaringsvariablerna (ADR-65; standard BAS och AID ger
 * BAS-fördelning (A), AID inom BAS (B) och lön inom samma AID och BAS (C)), med de grupper som bidrar mest.
 * Beräkningen bor i src/lib/gapuppdelning.js och vymodellen i src/lib/vymodell-var-uppstar-gapet.js. Anropas av Lönestruktur.
 */
// Åtgärd och länk per variabel som delen förklarar; den sista delen ("inom") har nyckeln null.
const _GU_ATGARD = {
    bas: { atgard: 'Hör till karriärvägar och rekrytering — inte till lönesättningen.', flik: 'struktur', flikNamn: 'Lönestruktur' },
    sektor: { atgard: 'Hör till hur verksamheten är organiserad och till rekryteringen.', flik: 'struktur', flikNamn: 'Lönestruktur' },
    aidniva: { atgard: 'Kan kräva en lönesatsning på AID-mellannivån; pröva likvärdigt arbete.', flik: 'likvardighet', flikNamn: 'Likvärdigt arbete' },
    aid: { atgard: `Kan kräva en lönesatsning på ${T.enhet.bf}; pröva likvärdigt arbete.`, flik: 'likvardighet', flikNamn: 'Likvärdigt arbete' },
    alder: { atgard: 'Hör till åldersstrukturen. Pröva om skillnaden finns kvar vid samma ålder.', flik: 'kon', flikNamn: 'Ålder & karriär' },
    inom: { atgard: 'Pröva lika arbete och se över lönerna individuellt.', flik: 'matrix', flikNamn: 'Lika arbete',
        ankare: 'personer-att-granska', ankareNamn: 'Personer att granska' },
};

// ---- Valet av förklaringsvariabler (ADR-65) ----
/** De gällande variablerna, normaliserade mot datat: åldersgrupp bara när lönefilen har ålder (ADR-64). */
export function gapVariabler() {
    return normaliseraGapVariabler(state.gapUppdelning && state.gapUppdelning.variabler, { harAlder: harAlder() }).variabler;
}
/**
 * Sätter variablerna. Standardvalet lagras som null. Det som lagras prövas inte mot åldern, som förklaringsmodellen
 * (ADR-56): en lönefil utan ålder ändrar inte valet för nästa fil.
 * @param {any} v
 * @param {{rita?: boolean}} [opts]
 */
function sattGapVariabler(v, { rita = true } = {}) {
    const { variabler, varningar } = normaliseraGapVariabler(v);
    state.gapUppdelning = gapVariablerArStandard(variabler) ? null : { variabler };
    if (rita) ritaGapUppdelning();
    return { variabler: gapVariabler(), varningar };
}
// Variablerna som kan väljas i det här underlaget: åldersgrupp kräver ålder, sektor och mellannivå AID-koder.
function _guValbara() {
    const harAid = hamtaData().some(r => r.aid);
    return gapAllaVariabler().filter(v => (v !== 'alder' || harAlder()) && (!['sektor', 'aidniva'].includes(v) || harAid));
}
const _GU_MAX = 4;
function _guValHtml() {
    const val = gapVariabler();
    const ovriga = _guValbara().filter(v => !val.includes(v));
    // Flytten prövas genom normaliseringen: AID-nivåerna står alltid grovt till fint, så en flytt förbi en annan
    // AID-nivå går inte och knappen är då avstängd.
    const kanFlytta = (i, steg) => { const j = i + steg; if (j < 0 || j >= val.length) return false;
        const ny = [...val]; [ny[i], ny[j]] = [ny[j], ny[i]]; return normaliseraGapVariabler(ny).variabler.join() !== val.join(); };
    const rad = (v, i) => {
        const namn = esc(gapVariabelEtikett(v));
        return `<li class="urval-rad" data-gu-rad="${v}"><label><input type="checkbox" data-gu-var="${v}" checked${val.length === 1 ? ' disabled title="Minst en variabel"' : ''}> <span class="gu-plats">${i + 1}.</span> ${namn}</label>
            <span class="urval-flytta"><button type="button" class="btn-table-tool" data-gu-flytta="-1" aria-label="Flytta upp: ${namn}"${kanFlytta(i, -1) ? '' : ' disabled'}>${ikon('pilUpp', 14)}</button>
            <button type="button" class="btn-table-tool" data-gu-flytta="1" aria-label="Flytta ned: ${namn}"${kanFlytta(i, 1) ? '' : ' disabled'}>${ikon('pilNed', 14)}</button></span></li>`;
    };
    const fler = val.length >= _GU_MAX;
    // Valet står under diagrammet, hopfällt bakom «Ändra uppdelning». Det står kvar utfällt när kortet ritas om
    // (_guValOppen), så att fokus och skärmläsarens meddelande i _guAndra hamnar i en synlig lista.
    return `<details class="gu-andra"${_guValOppen ? ' open' : ''}><summary>Ändra uppdelning</summary><fieldset class="gu-val"><legend>Förklara med:</legend>
        <p class="gu-not" id="gu-val-hjalp">Ordningen påverkar delarna: den första variabeln får det den förklarar ensam, nästa det den förklarar utöver den första, och så vidare. Välj en till fyra; AID-nivåerna ordnas alltid från grov till fin.</p>
        <ol class="urval-lista gu-val-lista" aria-describedby="gu-val-hjalp">${val.map(rad).join('')}${ovriga.map(v => `<li class="urval-rad" data-gu-rad="${v}"><label><input type="checkbox" data-gu-var="${v}"${fler ? ' disabled title="Högst fyra variabler"' : ''}> ${esc(gapVariabelEtikett(v))}</label></li>`).join('')}</ol>
        ${gapVariablerArStandard(val) ? '' : '<button type="button" class="btn btn-secondary btn-sm" data-gu-standard>Återställ standard (BAS, AID)</button>'}
    </fieldset></details>`;
}
let _guValOppen = false;
// Ritar om kortet och lägger tillbaka fokus på samma kontroll (eller rutan för samma variabel, om knappen nu är avstängd).
function _guAndra(ny, fokus, meddelande) {
    sattGapVariabler(ny);
    const host = document.getElementById('gap-uppdelning');
    const el = /** @type {HTMLElement|null} */ (fokus && host ? host.querySelector(fokus) : null);
    if (el && !(/** @type {any} */ (el).disabled)) el.focus();
    else if (host) { const v = fokus && /data-gu-rad="(\w+)"/.exec(fokus); const r = /** @type {HTMLElement|null} */ (v ? host.querySelector(`[data-gu-var="${v[1]}"]`) : null); if (r) r.focus(); }
    if (meddelande) meddelaSkarmlasare(meddelande);
}

function _guKr(v, tecken = true) {
    const r = Math.round(v);
    const s = new Intl.NumberFormat('sv-SE', { maximumFractionDigits: 0 }).format(Math.abs(r));
    return `${tecken && r !== 0 ? (r < 0 ? '−' : '+') : ''}${s}\u00a0kr`;
}
function _guPct(v, dec = 1) {
    return `${new Intl.NumberFormat('sv-SE', { minimumFractionDigits: dec, maximumFractionDigits: dec }).format(v)}\u00a0%`;
}

/** Kortet (ADR-99): vymodellVarUppstarGapet i src/lib/vymodell-var-uppstar-gapet.js räknar; här ritas texten och trappan. */
export function ritaGapUppdelning() {
    const host = document.getElementById('gap-uppdelning');
    const body = document.getElementById('gap-uppdelning-innehall');
    if (!host || !body) return;
    /** @type {any} */
    const vm = vymodellVarUppstarGapet(hamtaData(), { k: kTroskel(), variabler: gapVariabler() });
    if (!vm) { host.hidden = true; body.innerHTML = ''; return; }
    host.hidden = false;
    const demo = state.isDemo ? '<p class="gu-demo"><strong>DEMODATA — inte verkliga löner.</strong></p>' : '';
    if (vm.forFa) {
        body.innerHTML = demo + `<p>För få personer för att dela upp skillnaden: ett kön har färre än ${kTroskel()} ${personOrd(kTroskel())} i urvalet.</p>`;
        return;
    }
    const u = vm.uppdelning;
    const inledning = u.gap <= 0
        ? `Kvinnors medellön är <strong>${_guKr(-u.gap, false)}</strong> lägre än mäns, det är ${_guPct(-u.gapPct)} av mäns medellön.`
        : `Kvinnors medellön är <strong>${_guKr(u.gap, false)}</strong> högre än mäns, det är ${_guPct(u.gapPct)} av mäns medellön.`;
    const medianText = vm.medianKvot != null ? ` Kvinnors medianlön är ${_guPct(vm.medianKvot)} av mäns.` : '';
    const rader = vm.delar.map(d => {
        const del = { ...d, ..._GU_ATGARD[d.variabel || 'inom'] }, v = del.belopp;
        const bredd = Math.abs(v) / vm.storst * 50;
        // Samma färg som delens stapel i trappan: struktur eller lönesättningen (PALETTE.uppdelning).
        const farg = del.variabel === null ? PALETTE.uppdelning.lonesattning : PALETTE.uppdelning.struktur;
        const andel = del.andel === null ? '' : `<span class="gu-andel">${_guPct(del.andel, 0)} av skillnaden</span>`;
        const topp = del.topp.map(p => `<li>${esc(p.namn)}: ${_guKr(p.kr)}</li>`).join('')
            // Grupper som räknats samman (ADR-87) redovisas bara med antal — deras belopp kunde röja en liten grupp.
            + (del.ovrigaAntal ? `<li class="gu-ovriga">${esc(gapOvrigaText(del.ovrigaAntal, kTroskel()))}</li>` : '');
        return `<div class="gu-rad" data-gu-del="${del.id}">
            <div class="gu-rubrik"><svg class="gu-ruta" width="12" height="12" viewBox="0 0 12 12" aria-hidden="true" focusable="false"><rect width="12" height="12" rx="2" fill="${farg}"/></svg><strong>${del.id}. ${esc(del.namn)}</strong><span class="gu-belopp">${_guKr(v)}</span>${andel}</div>
            <div class="gu-stapel" aria-hidden="true"><svg width="100%" height="10" focusable="false"><rect x="${(v < 0 ? 50 - bredd : 50).toFixed(1)}%" width="${bredd.toFixed(1)}%" height="10" rx="2" fill="${farg}"/></svg></div>
            <p class="gu-text">${esc(del.betyder)} ${del.atgard} <a href="#" data-go-to-tab="${del.flik}">Till ${del.flikNamn}</a>${del.ankare ? ` <a href="#" data-go-to-tab="${del.flik}" data-go-to-anchor="${del.ankare}">${del.ankareNamn}</a>` : ''}</p>
            ${topp ? `<ul class="gu-topp">${topp}</ul>` : ''}
        </div>`;
    }).join('');
    body.innerHTML = demo
        + `<p class="gu-inledning">${inledning}${medianText} Uppdelningen räknar med medellön, eftersom delarna då summerar exakt. Beloppen är kvinnor mot män: negativa belopp betyder att kvinnornas medellön är lägre.</p>`
        + (u.litetGap ? '<p class="gu-not">Skillnaden är mindre än 1 % av männens medellön. Delarna kan då peka åt olika håll och vara större än själva skillnaden.</p>' : '')
        + '<div id="chart-gap-uppdelning" class="marg-6-0-14"></div>'
        + _guValHtml()
        + rader
        + `<p class="gu-not">Grupperna rangordnas efter bidrag till hela organisationens skillnad och kan därför skilja sig från de flaggade ${T.enhet.bfl} i Lika arbete, som sorteras efter skillnadens storlek.`
        // Med tröskeln 1 (skärmen, ADR-51) namnges alla grupper, och meningen om små grupper har inget att säga.
        + (kTroskel() > 1 ? ` Grupper där ett kön har färre än ${kTroskel()} ${personOrd(kTroskel())} räknas samman med andra grupper och namnges inte.` : '') + '</p>';
    { const el = document.getElementById('chart-gap-uppdelning'); if (el) ritaFigur(el, _guTrappaFigur(u)); }
}

// Uppdelningen som trappa i omvänd ordning: hela skillnaden först, sedan delarna (A, B, … en per vald variabel
// och sist "inom") en i taget från hela skillnaden mot noll. Bara delsummorna och helheten ritas — samma tal som raderna
// under, och aldrig en enskild grupps bidrag (i exportläget räknas grupper där ett kön är under tröskeln samman först,
// ADR-87). Färgen säger vad delen betyder (PALETTE.uppdelning), inte åt vilket håll den går.
const _GU_SERIE = { helhet: 'Hela skillnaden', struktur: 'Hur kvinnor och män är fördelade', inom: 'Oförklarat (lön inom samma grupp)' };
// Stegen och andelarna är gapTrappa och andelAvSkillnaden i src/lib/vymodell-var-uppstar-gapet.js.
function _guTrappaFigur(u) {
    const variabler = u.variabler || gapStandardVariabler();
    const delar = gapDelar(variabler);
    const kategorier = [_GU_SERIE.helhet, ...delar.map(d => `${d.id}. ${d.namn}`)];
    const gap = Math.round(u.gap);
    const steg = gapTrappa(u).map((t, i) => ({ x: kategorier[i + 1], lag: t.lag, hog: t.hog, del: t.belopp, fore: t.fore, efter: t.efter,
        skillnadKr: Math.round(t.belopp), inom: t.inom }));
    const etikett = s => { const a = andelAvSkillnaden(u, s.del); return a === null ? _guKr(s.del) : `${_guKr(s.del)} · ${_guPct(a, 0)}`; };
    // Värdet står utanför stapeln, vid den ände som ligger längst från noll: under stapeln när den änden är den undre,
    // annars över. Där korsar det aldrig nollinjen (som ritas över märkena), också när ett steg landar nära noll.
    // Strecket står kvar där steget landar.
    const ande = s => (Math.abs(s.fore) >= Math.abs(s.efter) ? s.fore : s.efter);
    const lage = (y, lag) => (y <= lag ? 'under' : 'over');
    const tips = d => {
        const a = andelAvSkillnaden(u, d.del);
        const andel = a !== null ? [['Andel av skillnaden', _guPct(a, 0)]]
            : u.litetGap ? []
            : [['Andel av skillnaden', Math.sign(d.del) !== Math.sign(u.gap) ? 'anges inte: delen går åt andra hållet än hela skillnaden'
                : 'anges inte: delen är större än hela skillnaden, eftersom en annan del går åt andra hållet']];
        return [[d.x], ['Bidrag', _guKr(d.del)], ...andel, ['Kvar efter delen', _guKr(d.efter)]];
    };
    const antal = ['', 'en', 'två', 'tre', 'fyra', 'fem'][delar.length];
    // Luft över och under trappan, så att värdet vid den lägsta och högsta nivån ryms på sin sida om strecket (annars
    // flyttas det i sidled, och med hela skillnaden först hamnar det då på nästa stapel). Bara delsummor och helheten.
    const nivaer = [0, u.gap, ...steg.map(s => s.efter)], lag = Math.min(...nivaer), hog = Math.max(...nivaer), luft = (hog - lag || 1) * 0.12;
    const delLager = (inom, serie, farg) => ({ marke: 'intervall', serie, farg, tjocklek: 44, data: steg.filter(s => s.inom === inom), tips });
    return { beskrivning: `Skillnaden i medellön, kvinnor mot män: först hela skillnaden, ${_guKr(u.gap)}, och sedan ${antal} delar som tillsammans blir hela skillnaden, en i taget från hela skillnaden mot noll: ${gapDelarIText(variabler)}. Negativa belopp betyder att kvinnornas medellön är lägre. Samma belopp står i raderna under.`,
        hojd: 320,
        x: { skala: 'band', ordning: kategorier }, y: { skala: 'linjar', titel: 'Skillnad i medellön (kr/månad)', format: 'kr', nollinje: true, ...(hog > lag ? { doman: [lag - luft, hog + luft] } : {}) },
        lager: [{ marke: 'intervall', serie: _GU_SERIE.helhet, farg: PALETTE.uppdelning.helhet, tjocklek: 44,
                  data: [{ x: _GU_SERIE.helhet, lag: Math.min(gap, 0), hog: Math.max(gap, 0), skillnadKr: gap }], tips: d => [[d.x], ['Skillnad i medellön', _guKr(d.skillnadKr)]] },
                delLager(false, _GU_SERIE.struktur, PALETTE.uppdelning.struktur),
                delLager(true, _GU_SERIE.inom, PALETTE.uppdelning.lonesattning),
                // Ett streck där steget landar, och beloppet vid stapelns ände längst från noll (ett osynligt streck bär
                // etiketten). Bara markeringar: talen står redan i lagren ovan, och lagren får inga rader i diagramdatan.
                { marke: 'punkt', symbol: 'streck', serie: 'Nivå', legend: false, utanData: true, farg: PALETTE.semantic.mork, storlek: 11,
                  data: [{ x: _GU_SERIE.helhet, y: gap }, ...steg.map(s => ({ x: s.x, y: Math.round(s.efter) }))] },
                { marke: 'punkt', symbol: 'streck', serie: 'Belopp', legend: false, utanData: true, farg: PALETTE.semantic.mork,
                  data: [{ x: _GU_SERIE.helhet, y: gap, storlek: 0, etikett: _guKr(u.gap), etikettLage: lage(gap, Math.min(gap, 0)) },
                         ...steg.map(s => { const y = Math.round(ande(s)); return { x: s.x, y, storlek: 0, etikett: etikett(s), etikettLage: lage(y, s.lag) }; })] }] };
}

/** Det som körs vid laddning, i filens ordning; src/app/index.js anropar delarnas uppstart i sifferordning. */
export function uppstartVarUppstarGapet() {
    document.addEventListener('toggle', e => {
        const d = /** @type {HTMLElement} */ (e.target);
        if (d && d.classList && d.classList.contains('gu-andra') && d.closest('#gap-uppdelning')) _guValOppen = /** @type {HTMLDetailsElement} */ (d).open;
    }, true);
    document.addEventListener('change', e => {
        const el = /** @type {HTMLInputElement} */ (e.target);
        if (!el || !el.closest || !el.closest('#gap-uppdelning .gu-val') || !el.hasAttribute('data-gu-var')) return;
        const v = /** @type {string} */ (el.getAttribute('data-gu-var'));
        const val = gapVariabler();
        const ny = el.checked ? [...val, v].slice(0, _GU_MAX) : val.filter(x => x !== v);
        if (!ny.length) { el.checked = true; return; }
        _guAndra(ny, `[data-gu-var="${v}"]`, `Uppdelningen förklarar nu med ${gapVariablerIText(normaliseraGapVariabler(ny).variabler)}.`);
    });
    document.addEventListener('click', e => {
        const t = /** @type {HTMLElement} */ (e.target);
        if (!t || !t.closest || !t.closest('#gap-uppdelning .gu-val')) return;
        if (t.closest('[data-gu-standard]')) { _guAndra(null, '[data-gu-var="bas"]', 'Uppdelningen förklarar nu med BAS och AID (standard).'); return; }
        const knapp = t.closest('[data-gu-flytta]');
        if (!knapp) return;
        const v = knapp.closest('[data-gu-rad]')?.getAttribute('data-gu-rad');
        const steg = Number(knapp.getAttribute('data-gu-flytta'));
        const val = gapVariabler(), i = val.indexOf(/** @type {string} */ (v)), j = i + steg;
        if (i < 0 || j < 0 || j >= val.length) return;
        const ny = [...val]; [ny[i], ny[j]] = [ny[j], ny[i]];
        _guAndra(ny, `[data-gu-rad="${v}"] [data-gu-flytta="${steg}"]`, `${gapVariabelEtikett(/** @type {string} */ (v))} flyttad ${steg < 0 ? 'upp' : 'ned'}. Ordningen är nu ${gapVariablerIText(normaliseraGapVariabler(ny).variabler)}.`);
    });
}

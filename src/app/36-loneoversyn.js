// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
// Löneöversyn & prognos (budget-först-fördelning)
// -------------------------------------------------------------------
// De rena funktionerna står i src/lib/loneoversyn.js.
// Endast UI/state-koden ligger här.
// ===================================================================
import { namnrader } from '../lib/aid.js';
import { talformat } from '../lib/figur.js';
import { statistikMarknad } from '../lib/jamforelse.js';
import { kostnadsfaktor, periodkostnad } from '../lib/kostnad.js';
import { konAntal } from '../lib/ktroskel.js';
import { ettParPerYrke, marknadsriktning, prognosutfall, sammanstallGrupper, stangningsriktning, troskelmalKonstanter } from '../lib/loneoversyn.js';
import { kvinnorOchMan, personOrd } from '../lib/namn.js';
import { avrundaSymmetriskt } from '../lib/stat.js';
import { svKr, svPct, svPoPct, svTal } from '../lib/talformat.js';
import { adjektiv, stor } from '../lib/termer.js';
import { BUDGET_MAX_PCT, forslagskandidater, forslagUrPotten, GENERELL_MAX_PCT, LAGE_OVER, LAGE_UNDER, kvDomAv, LUTNING_MAX, lutningRader, lutningUrval, oforklaratForeEfter, rensaForeslagnaRader, riktadRadInfo, riktning, scenariojamforelse, scenarioUr, simuleradeRader, utfallsvy, vymodellIndividlyft, vymodellKanslighet, vymodellPrognos, vymodellTroskelmal, villkorsgrupper } from '../lib/vymodell-loneoversyn.js';
import { behallFokus, meddelaSkarmlasare, esc } from './01-html-och-tillganglighet.js';
import { andelAvMan, demoFilnamn, idagDatum, tillampaDataStil } from './03-hjalpfunktioner.js';
import { ikon } from './03-ikoner.js';
import { _konFarRedovisasFor, _konUtelamnatNot, kInstalld, kTroskel } from './06-k-troskel.js';
import { K_NOT_MAX_NAMN, kMaskNot } from './06-maskeringsnoter.js';
import { jmfNamnGenitiv } from './07-standardinstallningar.js';
import { T } from './09-termer.js';
import { rensaFigur, ritaFigur } from './10-diagramritare.js';
import { PALETT, URVAL } from './10-diagramtema.js';
import { markeringFor } from './11-markering.js';
import { hamtaBasIntervall, hamtaData, nyPrognos, state } from './12-tillstand.js';
import { _laggTillMetodblad, _visaExportvarning, verktygMedVersion } from './22-exporthjalpare.js';
import { medExportLage } from './23-exportgrind.js';
import { likvardighetResultat } from './34-likvardigt-arbete.js';
import { _laNyckel, _laSlutsats } from './41-lika-arbete.js';
import { aidbasDefinition, aidbasGrans, kvDomGransText } from './45-aid-bas-tabeller.js';
import { regressionsval } from './51-lika-arbete-regressionskort.js';

// ---- UI: Löneöversyn-fliken ----
function _fcLasReglage() {
    const bm = document.getElementById('forecast-budget-mode');
    const bv = document.getElementById('forecast-budget-value');
    const gm = document.getElementById('forecast-generell-mode');
    const gv = document.getElementById('forecast-generell-value');
    if (bm) state.forecast.budget.mode = /** @type {HTMLInputElement} */ (bm).value;
    if (bv) state.forecast.budget.value = /** @type {HTMLInputElement} */ (bv).value === '' ? null : parseFloat(/** @type {HTMLInputElement} */ (bv).value);
    if (gm) state.forecast.generell.mode = /** @type {HTMLInputElement} */ (gm).value;
    if (gv) state.forecast.generell.value = /** @type {HTMLInputElement} */ (gv).value === '' ? null : parseFloat(/** @type {HTMLInputElement} */ (gv).value);
    const mn = document.getElementById('forecast-min-n');
    if (mn) { const v = parseInt(/** @type {HTMLInputElement} */ (mn).value, 10); state.forecast.minGroupN = isFinite(v) && v >= 0 ? v : 0; }
    const rs = document.getElementById('forecast-round');
    if (rs) { const v = parseInt(/** @type {HTMLInputElement} */ (rs).value, 10); state.forecast.roundStep = isFinite(v) && v >= 0 ? v : 0; }
    const yr = document.getElementById('forecast-years');
    if (yr) { const v = parseInt(/** @type {HTMLInputElement} */ (yr).value, 10); state.forecast.years = isFinite(v) && v >= 1 ? v : 1; }
}
// Distinkta AID (yrken) inom ett BAS, med visningsetikett + gruppstorlek.
function _fcAidForBas(bas) {
    const seen = new Map(), iBas = hamtaData().filter(r => r.bas === bas);
    // Gruppens namn ur texten på flest av dess rader (namnrader), som i resten av verktyget (ADR-89).
    const namnrad = namnrader(iBas, r => r.aid);
    iBas.forEach(r => {
        let g = seen.get(r.aid);
        if (!g) { g = { aid: r.aid, label: (namnrad.get(r.aid).yrkeLabel || r.aid || '').toString(), n: 0 }; seen.set(r.aid, g); }
        g.n++;
    });
    return [...seen.values()].sort((a, b) => a.label.localeCompare(b.label, 'sv'));
}
function ritaRiktadeRader() {
    const host = document.getElementById('forecast-targets');
    if (!host) return;
    const basList = hamtaBasIntervall();
    const t = state.forecast.targets;
    // Ta bort och varje ändring på en rad ritar om raderna: fokus står kvar på motsvarande kontroll (behallFokus).
    if (!t.length) {
        behallFokus(host, () => { host.innerHTML = '<p class="text-dampad-sm marg-4-0">Inga riktade potter tillagda. Lägg till en grupp eller använd förslagsknappen.</p>'; });
        return;
    }
    const dAll = hamtaData();
    // Radens urval ("*" = hela BAS-intervallet; kön och lönegräns snävar in). En rad som användaren själv
    // lägger på färre personer än tröskeln är tillåten (egen simulering, ADR-38 R2): beloppet räknas som
    // för andra rader, och noten under raden säger vad det bygger på (riktadRadInfo i src/lib/vymodell-loneoversyn.js).
    behallFokus(host, () => { host.innerHTML = t.map((tg, i) => {
        // Isolerad kostnad för raden (vad den äter av potten) och antalet den berör
        const info = riktadRadInfo(dAll, tg, { k: kInstalld() });
        // En rad som pekar på ett BAS-intervall eller en befattning som inte finns i underlaget (en egen rad ur förra
        // lönefilen eller konfigurationsfilen) visar sitt eget värde med en not, inte det första i listan.
        const saknas = v => `<option value="${esc(v)}" selected>${esc(v)} (finns inte i lönefilen)</option>`;
        const basOpts = (tg.bas && !basList.includes(tg.bas) ? saknas(tg.bas) : '')
            + basList.map(b => `<option value="${esc(b)}"${tg.bas === b ? ' selected' : ''}>${esc(b)}</option>`).join('');
        const aids = _fcAidForBas(tg.bas || basList[0]);
        const aidOpts = (tg.aid && tg.aid !== '*' && !aids.some(a => a.aid === tg.aid) ? saknas(tg.aid) : '')
            + `<option value="*"${tg.aid === '*' ? ' selected' : ''}>Hela BAS (alla ${T.enhet.fl})</option>`
            + aids.map(a => `<option value="${esc(a.aid)}"${tg.aid === a.aid ? ' selected' : ''}>${esc(a.label)} (n=${a.n})</option>`).join('');
        const distOpts = [['flat', 'Lika % till alla'], ['lowest', 'Lyft lägst betalda först'], ['target', 'Lyft mot målnivå']]
            .map(([v, l]) => `<option value="${v}"${tg.dist === v ? ' selected' : ''}>${l}</option>`).join('');
        const lvlOpts = [['median', 'BAS-median'], ['p25', 'BAS P25']]
            .map(([v, l]) => `<option value="${v}"${tg.targetLevel === v ? ' selected' : ''}>${l}</option>`).join('');
        const konOpts = [['alla', 'Alla'], ['kvinna', 'Bara kvinnor'], ['man', 'Bara män']]
            .map(([v, l]) => `<option value="${v}"${(tg.kon || 'alla') === v ? ' selected' : ''}>${l}</option>`).join('');
        const till = tg.mode === 'till';
        return `<div class="forecast-target-row" data-idx="${i}">
            <select data-f="bas" aria-label="${stor(T.niva.en)}">${basOpts}</select>
            <select data-f="aid" aria-label="${stor(T.enhet.en)}">${aidOpts}</select>
            <select data-f="kon" aria-label="Kön som omfattas" title="Begränsa raden till ett kön">${konOpts}</select>
            <label class="ft-cap" title="Bara löner under gränsen omfattas; tomt = alla">under <input type="number" data-f="lonCap" min="0" step="500" value="${tg.lonCap == null ? '' : tg.lonCap}" aria-label="Bara löner under (kr/mån)" placeholder="alla löner"> kr</label>
            <select data-f="mode" aria-label="Beloppstyp"><option value="kr"${tg.mode === 'kr' ? ' selected' : ''}>kr/mån att fördela</option><option value="pct"${tg.mode === 'pct' ? ' selected' : ''}>% av grupplön</option><option value="till"${till ? ' selected' : ''}>höj till (kr/mån)</option></select>
            <input type="number" data-f="value" min="0" step="100" value="${tg.value == null ? '' : tg.value}" aria-label="Belopp" class="bredd-90">
            <select data-f="dist" aria-label="Fördelning inom gruppen"${till ? ' class="dold"' : ''}>${distOpts}</select>
            <select data-f="targetLevel" aria-label="Målnivå"${tg.dist === 'target' ? '' : ' class="dold"'}>${lvlOpts}</select>
            <select data-f="pool" aria-label="Pott-typ" title="Pottyp: vart pengarna i raden är öronmärkta (visas i Kostnad per pott)">${[['equity', 'Likalön'], ['marknad', 'Marknad'], ['befordran', 'Befordran'], ['övrigt', 'Övrigt']].map(([v, l]) => `<option value="${v}"${(tg.pool || 'övrigt') === v ? ' selected' : ''}>${l}</option>`).join('')}</select>
            <span class="text-dampad-xs ingen-radbrytning" title="Vad raden förbrukar av potten">≈ ${Math.round(info.kostnad).toLocaleString('sv-SE')} kr</span>
            <button type="button" data-f="remove" class="btn btn-secondary btn-sm" aria-label="Ta bort rad">${ikon('kryss', 14)}</button>
        </div>${info.upplysning === 'underK' ? `<p class="k-mask-note">Raden berör ${info.n} ${info.n === 1 ? 'person' : 'personer'}, färre än ${kInstalld()} ${personOrd(kInstalld())} — beloppet bygger på enskildas löner och ingår i summorna, även i Excel-exporten.</p>` : (info.upplysning === 'ingen' ? '<p class="k-mask-note">Ingen i gruppen matchar kön och lönegräns.</p>' : '')}`;
    }).join(''); });
    host.querySelectorAll('.forecast-target-row').forEach(rowEl => {
        const i = parseInt(rowEl.getAttribute('data-idx') || '', 10);
        rowEl.querySelectorAll('[data-f]').forEach(ctrl => {
            const field = ctrl.getAttribute('data-f') || '';
            if (field === 'remove') {
                ctrl.addEventListener('click', () => { state.forecast.targets.splice(i, 1); ritaRiktadeRader(); ritaPrognos(); });
                return;
            }
            ctrl.addEventListener('change', () => {
                const tg = state.forecast.targets[i];
                if (field === 'value') tg.value = /** @type {HTMLInputElement} */ (ctrl).value === '' ? null : parseFloat(/** @type {HTMLInputElement} */ (ctrl).value);
                else if (field === 'lonCap') tg.lonCap = /** @type {HTMLInputElement} */ (ctrl).value === '' ? null : parseFloat(/** @type {HTMLInputElement} */ (ctrl).value);
                else tg[field] = /** @type {HTMLInputElement} */ (ctrl).value;
                if (field === 'bas') tg.aid = (_fcAidForBas(tg.bas)[0] || {}).aid || '';
                ritaRiktadeRader();   // etiketten «≈ kr» och noten under raden läser hela raden
                ritaPrognos();
            });
            if (field === 'value' || field === 'lonCap') ctrl.addEventListener('input', () => {
                state.forecast.targets[i][field] = /** @type {HTMLInputElement} */ (ctrl).value === '' ? null : parseFloat(/** @type {HTMLInputElement} */ (ctrl).value);
                ritaPrognos();
            });
        });
    });
}
// Kostnadsinställningarna som prognosen räknas med.
function _fcKostnadsval() {
    const { months, poPct } = kostnadsfaktor(state.costSettings);
    return { months, poPct, roundStep: state.forecast.roundStep || 0,
             kvThreshold: aidbasGrans(), kvDefinition: aidbasDefinition() };   // samma definition av kvinnodominerat som Likvärdigt arbete (ADR-60)
}
// Gruppens namn i noten under utfallet.
const _fcGruppnamn = g => `BAS ${g.bas} · ${g.aid}`;
/**
 * Noten under utfallet, som text utan markup (skärmen och bladet Fördelning): hur många grupper som är under tröskeln,
 * vilka grupper som har sin kostnad och sina medianer på den samlade raden, och var kostnaden står.
 */
function _fcUtfallsNot(utfall, K) {
    const a = utfall.sma.length;
    if (!a) return '';
    const lista = gs => gs.slice(0, K_NOT_MAX_NAMN).map(_fcGruppnamn).join(', ') + (gs.length > K_NOT_MAX_NAMN ? ` och ${gs.length - K_NOT_MAX_NAMN} till` : '');
    let t = `${a} ${a === 1 ? 'grupp' : 'grupper'} med färre än ${K} ${personOrd(K)} ingår i summorna, men ${a === 1 ? 'dess' : 'deras'} medianer och kostnad redovisas inte per grupp.`;
    if (utfall.invikta.length) t += ` Medianerna och kostnaden för ${lista(utfall.invikta)} redovisas inte heller per grupp: grupperna under tröskeln har tillsammans färre än ${K} ${personOrd(K)}, och annars skulle deras kostnad gå att räkna fram ur summorna.`;
    t += utfall.samlad.kostnad != null
        ? ` Kostnaden för ${utfall.maskerade.length === 1 ? 'gruppen' : `de ${utfall.maskerade.length} grupperna`} står samlad på raden Kostnad för grupper under tröskeln, så att kostnaderna summerar till det använda.`
        : ` Grupperna med påslag har tillsammans färre än ${K} ${personOrd(K)}, så ingen kostnad redovisas per grupp; den står bara i summorna.`;
    return t;
}
/**
 * Prognosens utfall ur raderna och inställningarna som de står i state.forecast. Exporten och scenarierna räknar det
 * här i stället för att läsa ett sparat utfall, så att de aldrig skriver ett utfall som räknades med en rad som
 * sedan har tagits bort (ADR-69).
 */
function _fcBeraknaUtfall(d) {
    return prognosutfall(d, state.forecast.budget, state.forecast.generell, state.forecast.targets, _fcKostnadsval());
}
// Kontrollernas ord (kontrollvarningar i src/lib/vymodell-loneoversyn.js).
const _FC_VARNINGAR = {
    negativBudget: 'Budgeten är negativ.',
    hogBudget: `Budgeten är ovanligt hög (> ${BUDGET_MAX_PCT} % av lönesumman) — kontrollera.`,
    negativtGenerellt: 'Det generella påslaget är negativt.',
    hogtGenerellt: `Det generella påslaget är ovanligt högt (> ${GENERELL_MAX_PCT} %).`,
    radUtanBelopp: 'En eller flera riktade rader saknar belopp.',
    radUtanTraff: 'En riktad rad matchar ingen person (kön eller lönegräns).'
};
// Pottypernas namn (POTTYPER i src/lib/vymodell-loneoversyn.js).
const _FC_POTTER = { equity: 'Likalön', marknad: 'Marknad', befordran: 'Befordran', 'övrigt': 'Övrigt' };
/**
 * Ritar prognosen: nyckeltalen i flikens topp, mätaren och utfallet. Det som räknas, maskeras och bedöms står i
 * vymodellen (vymodellPrognos i src/lib/vymodell-loneoversyn.js, ADR-99); här skrivs orden och ritas.
 */
function ritaPrognos() {
    const meterEl = document.getElementById('forecast-meter');
    const outEl = document.getElementById('forecast-outcome');
    if (!meterEl && !outEl) return;
    _fcLasReglage();
    _fcUppdateraForslagPott();
    const d = hamtaData();
    if (!d.length) {
        if (meterEl) meterEl.innerHTML = '';
        { const topp = document.getElementById('lo-slutsatser'); if (topp) topp.innerHTML = ''; }
        if (outEl) outEl.innerHTML = '<p class="farg-dampad pad-18 ta-mitt">Läs in lönefilen för att göra en prognos.</p>';
        document.getElementById('view-loneoversyn')?.classList.remove('lo-tomt');
        _ritaPrognosLutning(null, null);
        return;
    }
    const cost = _fcKostnadsval();
    const K = kTroskel();
    // Huvudregressionen före och efter räknas i vymodellen på raderna, varje gång (ADR-17).
    const vm = vymodellPrognos(d, { forecast: state.forecast, kostnadsval: cost, k: K, regval: regressionsval() });
    const out = vm.out;
    const riktade = state.forecast.targets.length;
    _laNyckel('nyckel-lo-riktade', riktade ? `${riktade} ${riktade === 1 ? 'riktad pott' : 'riktade potter'}` : 'Inga riktade potter');
    _laNyckel('nyckel-lo-planering', state.forecast.roundStep > 0 || (state.forecast.years || 1) > 1 ? 'Anpassade värden' : 'Standardvärden');
    // Utan pott och utan påslag finns inget utfall att spara eller exportera (fliken säger att en pott behövs).
    state.forecast.result = vm.tomt ? null : out;
    _ritaPrognosLutning(d, vm.sim);

    const kr = n => svKr(n);
    const pct = n => (n == null ? '–' : (n >= 0 ? '+' : '') + svPct(n, 1));
    // Budgetmätare
    const anvPct = vm.anvandPct;
    const meterKlass = { over: 'bg-kritisk', nara: 'bg-varning', ok: 'bg-ok' }[vm.matare];
    // Nyckeltalen står i flikens topp, som på övriga flikar (potten, vad som gått åt och vad det kostar); mätaren under
    // formuläret visar bara förloppet och varningarna.
    { const topp = document.getElementById('lo-slutsatser');
      if (topp) topp.innerHTML = [
          _laSlutsats('Pott', out.pottAngiven ? kr(out.pott) : '–', out.pottAngiven ? 'kr per månad att fördela' : 'ingen pott angiven'),
          _laSlutsats('Använt', kr(out.använt), out.pott > 0 ? `${svTal(100 * out.använt / out.pott, 0)} % av potten` : 'av påslagen hittills'),
          // Utan angiven pott finns inget kvar att räkna och ingen pott att överskrida (pottAngiven ur prognosutfall).
          out.kvar != null
              ? _laSlutsats('Kvar att fördela', kr(out.kvar), out.overBudget ? 'fördelningen överskrider potten' : 'av potten', out.overBudget)
              : _laSlutsats('Kvar att fördela', '–', 'ingen pott angiven'),
          // "från …" bara när summan har ändrats; före första påslaget står utgångsläget
          _laSlutsats('Lönesumma per månad', kr(out.lonsummaEfter), Math.round(out.lonsummaEfter) !== Math.round(out.lonsummaFore) ? `från ${kr(out.lonsummaFore)}` : 'utgångsläget'),
          _laSlutsats('Total kostnad', kr(out.totalKostnad), `${cost.months} mån, PO ${svPoPct(cost.poPct)}`),
      ].join(''); }
    if (meterEl) meterEl.innerHTML = `
        <div class="bak-kant rund-6 hojd-12 marg-t-10 klipp" role="img" aria-label="Budgetutnyttjande ${svTal(anvPct, 0)} procent">
            <div class="hojd-100p ${meterKlass}" data-stil-bredd="${anvPct.toFixed(1)}%"></div>
        </div>
        ${out.overBudget ? `<p class="farg-danger fs-sm fw-600 marg-8-0-0">${ikon('statusVarning')} Fördelningen överskrider potten.</p>` : ''}
        ${vm.varningar.length ? `<p class="farg-varning fs-sm marg-8-0-0">${ikon('statusVarning')} ${vm.varningar.map(v => esc(_FC_VARNINGAR[v])).join(' ')}</p>` : ''}
        ${state.forecast.roundStep > 0 ? `<p class="text-dampad-xs marg-6-0-0">Nya löner avrundas till närmaste ${state.forecast.roundStep} kr.</p>` : ''}`; if (meterEl) tillampaDataStil(meterEl);

    // Lönespann per BAS, och gruppens nya median mot BAS-medianen i utfallstabellen
    // Minsta gruppstorlek: ett BAS under tröskeln får inte röja sitt lönespann —
    // P25/median/P75 pekar då ut enskilda löner. Raden utelämnas i stället för
    // att fyllas med "< 10"-celler, och BAS:et räknas upp i noten under (vm.band).
    const bandVisade = vm.band.visade;
    const bandPanelHtml = vm.band.alla.length ? `<div class="card marg-0-0-14">
        <strong class="block-mb6">Lönespann per BAS (P25 / median / P75)</strong>
        ${bandVisade.length ? `<table class="data-table st-085"><thead><tr><th>BAS</th><th class="t-hoger">n</th><th class="t-hoger">P25</th><th class="t-hoger">Median</th><th class="t-hoger">P75</th></tr></thead>
        <tbody>${bandVisade.map(b => `<tr><td>${esc(b.bas)}</td><td class="t-hoger">${b.n}</td><td class="t-hoger">${kr(b.p25)}</td><td class="t-hoger">${kr(b.median)}</td><td class="t-hoger">${kr(b.p75)}</td></tr>`).join('')}</tbody></table>` : ''}
        ${kMaskNot(vm.band.utelamnade, `${T.niva.en}|${T.niva.fl}`)}
        <p class="text-dampad-xs marg-6-0-0">Läget mot BAS-medianen i tabellen nedan är gruppens nya median delad med BAS-medianen: över ${svTal(LAGE_OVER, 2)} märks «över», under ${svTal(LAGE_UNDER, 2)} märks «under».</p>
    </div>` : '';
    // Kostnad per pott (öronmärkta potter)
    const { perPott: poolCost, potter: poolRows } = vm.potter;
    const poolHtml = (poolRows.length || out.generellCost > 0.5) ? `<div class="card marg-0-0-14">
        <strong class="block-mb6">Kostnad per pott (kr/mån)</strong>
        <table class="data-table st-085"><tbody>
            ${out.generellCost > 0.5 ? `<tr><td>Generellt påslag</td><td class="t-hoger">${kr(out.generellCost)}</td></tr>` : ''}
            ${poolRows.map(p => `<tr><td>${_FC_POTTER[p]}</td><td class="t-hoger">${kr(poolCost[p])}</td></tr>`).join('')}
        </tbody></table>
        <p class="text-dampad-xs marg-6-0-0">Öronmärkta potter: välj en pottyp på varje riktad rad för att se vart utrymmet går.</p>
    </div>` : '';
    // Utfall: nyckeltal + gap + per-grupp-tabell (minsta gruppstorlek på medianer)
    // Där medianerna maskeras maskeras också kostnaden: i en grupp med en person är ett påslag i
    // procent personens lön gånger procentsatsen. Kostnaden för de maskerade raderna står samlad, så att
    // summorna minus de visade raderna inte ger en liten grupps kostnad (ADR-70, utfallsrader i vymodellen).
    const { rader: rows, utfall } = vm;
    const utfallsNot = _fcUtfallsNot(utfall, K);
    const maskNot = utfallsNot ? `<p class="k-mask-note">${esc(utfallsNot)}</p>` : '';
    // Könsuppdelade mått för hela urvalet kräver tröskeln för varje kön (ADR-12): vm.ra är null annars.
    const konOk = vm.konOk;
    const tableRows = vm.tabell.map(({ g, maskerad: masked, underK, lage: l }) => {
        const medCells = masked
            ? `<td colspan="3" class="farg-dampad kursiv">${underK ? `n &lt; ${K} (maskerad)` : 'visas inte (se noten)'}</td>`
            : `<td class="t-hoger">${kr(g.gammalMedian)}</td><td class="fw-600 ta-hoger">${kr(g.nyMedian)}</td><td class="farg-ok ta-hoger">+${svPct((100 * (g.nyMedian / g.gammalMedian - 1)), 1)}</td>`;
        const compaCell = l.kvot == null
            ? '<td class="farg-dampad ta-hoger">–</td>'
            : `<td class="t-hoger${l.lage === 'over' ? ' fg-varning' : l.lage === 'under' ? ' fg-info-mork' : ''}">${svTal(l.kvot, 2)}${l.lage === 'over' ? ' över' : l.lage === 'under' ? ' under' : ''}</td>`;
        return `<tr><td>${esc(g.bas)}</td><td>${esc(g.aid)}</td><td class="t-hoger">${g.n}</td><td class="t-hoger">${svPct(g.andelKv, 0)}</td>${medCells}<td class="t-hoger">${masked ? '–' : kr(g.kostnad) + '/mån'}</td>${compaCell}</tr>`;
    }).join('') + (utfall.samlad && utfall.samlad.kostnad != null
        ? `<tr><td>Kostnad för grupper under tröskeln</td><td>${utfall.samlad.antalGrupper} ${utfall.samlad.antalGrupper === 1 ? 'grupp' : 'grupper'}, ${utfall.samlad.n} ${personOrd(utfall.samlad.n)}</td><td colspan="5"></td><td class="t-hoger">${kr(utfall.samlad.kostnad)}/mån</td><td></td></tr>`
        : '');
    // Ordet och färgen följer talen som de visas (riktning i vymodellen): lika på en decimal är oförändrat.
    const riktningsord = (r, narmare, langre) => (r == null ? '' : r < 0 ? ` <span class="farg-ok">${narmare}</span>`
        : r > 0 ? ` <span class="f-kritisk">${langre}</span>` : ' <span class="f-dampad">oförändrat</span>');
    const ols = vm.oforklarat;
    const gapCell = `${pct(ols.fore)} till <strong>${pct(ols.efter)}</strong>${riktningsord(ols.riktning, 'minskar', 'ökar')}`;
    // Det råa gapet visas som kvinnors medianlön i procent av mäns (andelAvMan); pilen säger om den närmar sig 100.
    const ra = vm.ra;
    const andelCell = ra ? `${andelAvMan(ra.fore)} till <strong>${andelAvMan(ra.efter)}</strong>${riktningsord(ra.riktning, 'närmar sig 100 %', 'längre från 100 %')}` : '';
    // Enkel före/efter-stapel på |rågap| (mindre = bättre)
    const gapBar = () => {
        if (!ra || ra.fore == null || ra.efter == null) return '';
        const scale = Math.max(Math.abs(ra.fore), Math.abs(ra.efter), 0.01);
        const w = v => (Math.abs(v) / scale * 100).toFixed(1);
        return `<div class="marg-t-6 max-bredd-360">
            <div class="rad-mitt gap-6 marg-b-3"><span class="text-dampad-xs bredd-42">Före</span><div class="bak-kant rund-5 flex-1 hojd-10 klipp"><div class="hojd-100p bg-blek" data-stil-bredd="${w(ra.fore)}%"></div></div></div>
            <div class="rad-mitt gap-6"><span class="text-dampad-xs bredd-42">Efter</span><div class="bak-kant rund-5 flex-1 hojd-10 klipp"><div class="hojd-100p ${{ '-1': 'bg-ok', 0: 'bg-dampad', 1: 'bg-kritisk' }[ra.riktning]}" data-stil-bredd="${w(ra.efter)}%"></div></div></div>
        </div>`;
    };
    // Stegvis plan över N år (3 kap. 13 § diskrimineringslagen: senast inom tre år)
    const years = state.forecast.years || 1;
    let stagedHtml = '';
    if (vm.plan) {
        stagedHtml = `<div class="card marg-0-0-14">
            <strong class="block-mb6">Stegvis plan över ${years} år (senast inom tre år)</strong>
            <table class="data-table fs-sm"><thead><tr><th>År</th><th class="t-hoger">Andel infört</th><th class="t-hoger">Ack. kostnad (inkl. PO)</th><th class="t-hoger">Kvinnors median i % av mäns</th></tr></thead>
            <tbody>${vm.plan.map(p => `<tr><td>${p.year}</td><td class="t-hoger">${svPct(p.andelPct, 0)}</td><td class="t-hoger">${kr(p.kumKostnad)}</td><td class="t-hoger">${p.rawGap == null ? '–' : andelAvMan(p.rawGap)}</td></tr>`).join('')}</tbody></table>
            <p class="text-dampad-xs marg-8-0-0">Linjär infasning (1/${years} per år). Skillnaden visar läget när varje års andel är införd.</p>
        </div>`;
    }
    // Fördelning av påslaget: generellt / riktat, samt andel till kvinnodom. grupper
    // Bredvid utfallets rader står andelen bara när den inte ger en del av den samlade kostnaden (ADR-70, varavKvDom).
    const varavKvDom = vm.varavKvDom;
    const equityPctOfPott = vm.andelAvPott;
    const splitHtml = out.använt > 0.5 ? `
        <div class="card marg-0-0-14">
            <strong class="block-mb6">Hur potten används</strong>
            <div class="fs-md lh-1_8">
                Generellt påslag: <strong>${kr(out.generellCost)}</strong> &nbsp;·&nbsp; Riktade potter: <strong>${kr(out.riktadCost)}</strong><br>
                Varav till kvinnodominerade grupper (${esc(kvDomGransText())}): <strong>${varavKvDom == null ? '–' : kr(varavKvDom)}</strong>${equityPctOfPott != null ? ` <span class="f-dampad">(${svPct(equityPctOfPott, 0)} av potten)</span>` : ''}
            </div>
            <p class="text-dampad-xs marg-8-0-0">Andelen till kvinnodominerade grupper visar ungefär hur mycket av översynen som riktas mot skillnaderna i likvärdigt arbete.</p>
        </div>` : '';
    // Grupper som går om varandra (hittaOmkorningar)
    // Jämförelsen visar gruppmedianer: bara grupper som når tröskeln tas med, och inte en grupp vars medianer
    // maskeras i utfallet för att dess kostnad står på den samlade raden (ADR-70, utfallsvy).
    const leaps = vm.omkorningar;
    const leapHtml = leaps.length ? `
        <div class="card bak-varning-yta ram-v-3-varning marg-0-0-14">
            <strong class="block-mb6">${ikon('statusVarning')} Omkörning: ${leaps.length} grupp${leaps.length > 1 ? 'er' : ''} går om en tidigare högre grupp</strong>
            <ul class="fs-sm lh-1_6 marg-4-0-0-18">
                ${leaps.slice(0, 6).map(l => `<li><strong>${esc(l.bas)}·${esc(l.aid)}</strong> (median ${kr(l.gammalA)} till ${kr(l.nyA)}) passerar <strong>${esc(l.overBas)}·${esc(l.overAid)}</strong> (${kr(l.gammalB)} till ${kr(l.nyB)})</li>`).join('')}
                ${leaps.length > 6 ? `<li>… och ${leaps.length - 6} till.</li>` : ''}
            </ul>
            <p class="text-dampad-xs marg-8-0-0">En grupp som passerar en tidigare högre betald grupp kan skapa ny skevhet — kontrollera att omkastningen är sakligt motiverad.</p>
        </div>` : '';
    if (outEl) outEl.innerHTML = `
        <div class="card marg-0-0-14">
            <strong class="block-mb6">Löneskillnad före och efter</strong>
            <div class="fs-md lh-1_8">
                Kvinnors medianlön i % av mäns: ${konOk ? andelCell : esc(_konUtelamnatNot()) + '<br>'}
                ${konOk ? gapBar() : ''}
                Oförklarad skillnad (regressionen): ${ols.fore == null && ols.efter == null ? '<span class="f-dampad">– (för få personer för regressionen)</span>' : gapCell}
            </div>
            <p class="text-dampad-xs marg-8-0-0">Under 100 % betyder att kvinnors medianlön är lägre än mäns. Den oförklarade skillnaden anges i procent (negativt = kvinnor lägre; "minskar" = närmare noll) och räknas om med regressionen på de simulerade lönerna.</p>
        </div>
        ${splitHtml}
        ${poolHtml}
        ${stagedHtml}
        ${leapHtml}
        ${bandPanelHtml}
        ${rows.length ? `<div class="table-wrap"><table class="data-table st-088">
            <thead><tr><th>BAS</th><th>${stor(T.kod.en)}</th><th class="t-hoger">n</th><th class="t-hoger">Andel kv</th><th class="t-hoger">Gammal median</th><th class="t-hoger">Ny median</th><th class="t-hoger">Δ</th><th class="t-hoger">Kostnad</th><th class="t-hoger">Läge mot BAS-medianen (ny)</th></tr></thead>
            <tbody>${tableRows}</tbody></table></div>${maskNot}`
        : '<p class="text-dampad-sm">Ingen grupp har fått påslag ännu — ange ett generellt påslag eller lägg till riktade potter.</p>'}`; if (outEl) tillampaDataStil(outEl);
    // Utan pott och utan påslag finns inget utfall: en tom mätare och tabeller där före är lika med efter ser ut som
    // ett resultat. Då står en rad som säger vad som behövs, och mätaren, diagrammet och exporten visas inte.
    const tomt = vm.tomt;
    document.getElementById('view-loneoversyn')?.classList.toggle('lo-tomt', tomt);
    if (tomt && outEl) outEl.innerHTML = '<p class="tomt-lage">Ange en pott ovan så visas utfallet här.</p>';
}
// ---- Före och efter (diagramkärnan, ADR-39) ----
// `rader`: [{ namn, fore, efter, farg, markering?, bas?, yrke?, n? }] — anroparen ger bara rader som får visas. `bas`,
// `yrke` och `n` följer med till märkena, för figurens urval (URVAL.bas, .yrkesgrupp, .antal), som anroparen sätter.
// Ett värde före och efter, per grupp: en rad per grupp med värdet före som ett streck, värdet efter som en punkt och
// förflyttningen som ett streck emellan — inte lutande linjer på en avkortad axel, där små ändringar ser dramatiska
// ut. För en kvot (format 'pct') når axeln alltid 100 %, lika lön, som är utsatt som linje; för belopp ('kr') följer
// axeln värdena med luft omkring. `kolumner` namnger de två lägena (Före/Efter, Ögonblicksbild/Nuvarande).
/** @param {{rader: any[], titel: string, beskrivning: string, format?: 'pct'|'kr', kolumner?: string[]}} val */
export function foreEfterFigur({ rader, titel, beskrivning, format = 'pct', kolumner = ['Före', 'Efter'] }) {
    const alla = rader.flatMap(r => [r.fore, r.efter]), p = v => talformat(v, format), [a, b] = kolumner, kvot = format === 'pct';
    // bas, yrke, n: radens BAS-intervall, yrkesgrupp och antal (figur.urval)
    const m = r => ({ ...(r.markering ? { markering: r.markering } : {}), ...(r.bas != null ? { bas: r.bas } : {}), ...(r.yrke != null ? { yrke: r.yrke } : {}), ...(r.n != null ? { n: r.n } : {}) });
    const tips = d => [[d.y], [a, p(d.r.fore)], [b, p(d.r.efter)]];
    const lag = Math.min(...alla), hog = Math.max(...alla), luft = Math.max((hog - lag) * 0.12, Math.abs(hog) * 0.02);
    return { beskrivning, y: { skala: 'band', ordning: rader.map(r => r.namn), etikettMax: 36 },
        x: { skala: 'linjar', titel, ...(kvot ? {} : { format }), doman: kvot ? [Math.floor(Math.min(lag, 95) - 1), Math.ceil(Math.max(hog, 100) + 1)] : [lag - luft, hog + luft * 1.6] },
        hojd: Math.max(160, 96 + rader.length * 32),
        ...(kvot ? { referens: [{ x: 100, farg: PALETT.semantic.mork, tjocklek: 1.5, etikett: 'Lika lön' }] } : {}),
        lager: [{ marke: 'intervall', riktning: 'liggande', serie: 'Förändring', tjocklek: 3, legend: false,
                  data: rader.map(r => ({ y: r.namn, lag: Math.min(r.fore, r.efter), hog: Math.max(r.fore, r.efter), farg: r.farg, r, ...m(r) })), tips },
                { marke: 'punkt', symbol: 'streck', serie: a, farg: PALETT.semantic.neutral, storlek: 6, data: rader.map(r => ({ y: r.namn, x: r.fore, r, ...m(r) })), tips },
                { marke: 'punkt', serie: b, farg: PALETT.semantic.mork, storlek: 6, etikettLage: 'hoger',
                  data: rader.map(r => ({ y: r.namn, x: r.efter, farg: r.farg, etikett: p(r.efter), r, ...m(r) })), tips }] };
}

// Lönegapet (kvinnors median mot mäns, i procent — negativt när kvinnor ligger lägre) per BAS-intervall eller
// yrkesgrupp, före och efter påslagen: lutningRader i src/lib/vymodell-loneoversyn.js, bara grupper där både kvinnor
// och män når tröskeln. Här läggs markeringen och färgen till; färgen följer talen som de visas med en decimal
// (riktning), som utfallets rad för hela urvalet.
/** @returns {Array<{namn: string, fore: number, efter: number, [k: string]: any}>} */
function _lutningRader(d, sim, niva) {
    const farg = r => ({ '-1': PALETT.semantic.ok, 0: PALETT.semantic.neutral, 1: PALETT.semantic.kritisk })[riktning(r.fore, r.efter, 100)];
    return lutningRader(d, sim, niva, { k: kTroskel(), markering: markeringFor }).map(r => ({ ...r, farg: farg(r) }));
}
// Samma tal som diagrammet, som tabell: gapet per grupp före och efter påslagen står inte någon annanstans.
function _ritaLutningTabell(rader, niva) {
    const host = document.getElementById('forecast-lutning-tabell');
    if (!host) return;
    if (!rader.length) { host.innerHTML = ''; return; }
    const p = v => talformat(v, 'pct'), diff = v => (v > 0 ? '+' : '') + talformat(v, undefined) + ' procentenheter';
    host.innerHTML = `<table id="forecast-lutning-table" class="data-table fs-sm marg-t-10">
        <thead><tr><th>${niva === 'bas' ? stor(T.niva.en) : stor(T.enhet.en)}</th><th class="t-hoger">Kvinnor / män</th><th class="t-hoger">Kvinnors median i % av mäns, före</th><th class="t-hoger">Efter</th><th class="t-hoger">Förändring</th></tr></thead>
        <tbody>${rader.map(r => `<tr><td>${esc(r.namn)}</td><td class="t-hoger">${r.nKv}/${r.nMa}</td><td class="t-hoger">${p(r.fore)}</td><td class="fw-600 ta-hoger">${p(r.efter)}</td><td class="t-hoger">${diff(avrundaSymmetriskt(r.efter, 1) - avrundaSymmetriskt(r.fore, 1))}</td></tr>`).join('')}</tbody></table>`;
    for (const [i, tr] of [...host.querySelectorAll('tbody tr')].entries()) if (rader[i].markering) tr._markering = rader[i].markering;
}
function _ritaPrognosLutning(d, sim) {
    const el = document.getElementById('chart-forecast-lutning');
    if (!el) return;
    const not = document.getElementById('forecast-lutning-not');
    const niva = /** @type {HTMLInputElement} */ ((document.getElementById('forecast-lutning-niva') || {})).value === 'grupp' ? 'grupp' : 'bas';
    const k = kTroskel();
    // Yrkesgrupperna är många: bara de där gapet ändras, störst ändring först; tabellen bär alla ändrade grupper,
    // också dem diagrammet inte ryms (lutningUrval).
    const urval = lutningUrval(d && sim ? _lutningRader(d, sim, niva) : [], niva);
    const rader = urval.diagram, fler = urval.fler;
    _ritaLutningTabell(urval.tabell, niva);
    if (not) not.textContent = !rader.length ? '' : `Det lodräta strecket är värdet före, punkten värdet efter. Grönt: närmar sig 100 % (lika lön). Rött: längre från 100 %. Grått: oförändrat. Bara ${niva === 'bas' ? T.niva.fl : T.enhet.fl} med minst ${kvinnorOchMan(k, k, ' och ')} visas.`
        + (fler ? ` Visar de ${LUTNING_MAX} ${T.enhet.fl} där skillnaden ändras mest; ${fler} till ändras mindre.` : '');
    if (!rader.length) {
        rensaFigur(el);
        const text = !d ? '' : niva === 'bas' ? `${stor(adjektiv({ utrum: 'ingen', neutrum: 'inget', plural: 'inga' }, T.niva))} ${T.niva.en} har minst ${kvinnorOchMan(k, k, ' och ')}, så kvinnors median i procent av mäns visas inte per ${T.niva.en}.`
            : `I ${adjektiv({ utrum: 'ingen', neutrum: 'inget', plural: 'inga' }, T.enhet)} ${T.enhet.en} med minst ${kvinnorOchMan(k, k, ' och ')} ändras kvinnors median i procent av mäns av påslagen.`;
        el.innerHTML = text ? `<p class="text-dampad-sm marg-8-0">${esc(text)}</p>` : '';
        return;
    }
    // Filtren efter nivån: BAS-intervall eller yrkesgrupp, och antalet (kvinnor och män i tabellen).
    ritaFigur(el, { ...foreEfterFigur({ rader, titel: 'Kvinnors median i % av mäns',
        beskrivning: `Kvinnors medianlön i procent av mäns per ${niva === 'bas' ? T.niva.en : T.enhet.en} före och efter påslagen i prognosen: strecket är värdet före, punkten värdet efter. Linjen vid 100 procent är lika lön. Samma tal står i tabellen under.` }),
        urval: [niva === 'bas' ? URVAL.bas : URVAL.yrkesgrupp, URVAL.antal] });
}

/** Ritar fliken Löneöversyn: kontrollerna ur tillståndet, de riktade raderna, prognosen, scenarierna och knappresultaten. */
export function ritaLoneoversyn() {
    // Fälten följer tillståndet (också efter en inläst konfigurationsfil)
    const setVal = (id, v) => { const el = document.getElementById(id); if (el && v != null) /** @type {HTMLInputElement} */ (el).value = v; };
    setVal('forecast-budget-mode', state.forecast.budget.mode);
    setVal('forecast-budget-value', state.forecast.budget.value);
    setVal('forecast-generell-mode', state.forecast.generell.mode);
    setVal('forecast-generell-value', state.forecast.generell.value);
    setVal('forecast-min-n', state.forecast.minGroupN);
    setVal('forecast-round', state.forecast.roundStep);
    setVal('forecast-years', state.forecast.years);
    ritaRiktadeRader();
    ritaPrognos();
    _ritaScenariojamforelse();
    _fcRitaOmKnappresultat();
}
// Resultaten som räknas på knapptryck: målet för skillnaden, känslighetskurvan och kostnaden på individnivå. Ett resultat
// som visas räknas om när fliken ritas om, i det läge och med den tröskel som gäller nu — förhandsvisningen "Som i
// exporten", en ändrad tröskel eller fliken som öppnas efter att ha tömts (ADR-51). En ruta som är tom förblir tom: inget
// räknas utan knapptryck. Rensa all data, en ny lönefil och Nollställ glömmer resultaten (_fcGlomKnappresultat).
const _fcKnappresultat = new Set();   // id:n för rutorna som visar ett resultat
function _fcRitaOmKnappresultat() {
    if (_fcKnappresultat.has('forecast-threshold-result')) _fcLyftMotMal();
    if (_fcKnappresultat.has('forecast-sensitivity')) _fcKanslighet();
    if (_fcKnappresultat.has('forecast-rem-result')) _fcAtgard();
}
export function _fcGlomKnappresultat() {
    for (const id of _fcKnappresultat) { const el = document.getElementById(id); if (el) el.innerHTML = ''; }
    _fcKnappresultat.clear();
    if (state.forecast) delete state.forecast._remediation;
    _fcBorttagnaNot = '';   // meningen om borttagna förslag gällde det förra underlaget eller den förra prognosen
    _fcVisaParNot();
}
// Kandidater ur paren i likvärdigt arbete för förslag, mål-läge och känslighetskurva. Par där det kvinnodominerade
// yrket eller jämförelseyrket har färre personer än den inställda tröskeln tas inte med, också på
// skärmen (ADR-69): förslagets belopp räknas ur jämförelseyrkets median och står på raden, i summorna,
// i Excel-exporten och i konfigurationsfilen. Undantaget gäller bara fliken Likvärdigt arbete. Minsta
// antal personer i gruppen för riktning är en ytterligare gräns. Meningen om utelämnade par visas vid
// förslagen (#forecast-par-not) och står i Excel-exporten. Bland paren som är kvar tar förslagen ett par per
// kvinnodominerat yrke, det med störst skillnad (ettParPerYrke i src/lib/loneoversyn.js, ADR-69). Urvalet är
// forslagskandidater i src/lib/vymodell-loneoversyn.js (regel R2).
let _fcParNot = '';
// Meningen om föreslagna rader som togs bort (_fcRensaParMal). Står kvar tills ett nytt förslag görs.
let _fcBorttagnaNot = '';
// Storleken på grupperna i paret som en föreslagen rad räknades ur, per rad (objektet i state.forecast.targets).
// Bara i minnet: raden och konfigurationsfilen bär inte paret, så en rad ur en fil har ingen post här (ADR-69).
/** @type {WeakMap<object, {kvN: number, maN: number|null}>} */
const _fcParUrsprung = new WeakMap();
// De riktade raderna som ett sparat scenario (A/B) räknades med, per scenario. Bara i minnet, som scenarierna själva.
/** @type {WeakMap<object, object[]>} */
const _fcScenarioRader = new WeakMap();
/** Alla par i likvärdighetsanalysen, utan tröskel (tom lista om analysen inte går att räkna). */
function _fcAllaPar() {
    try { const lv = likvardighetResultat(); return (lv && lv.pairs) || []; } catch (_e) { return []; }
}
/** Sant när analysens parlista har alla par, det vill säga inte är kapad vid Visa max (parAntal räknas före urvalet). */
function _fcParListanFullstandig(allaPar) {
    try {
        const lv = likvardighetResultat();
        return !!(lv && lv.parAntal && typeof lv.parAntal.totalt === 'number' && lv.parAntal.totalt === allaPar.length);
    } catch (_e) { return false; }
}
function _fcVisaParNot() {
    const el = document.getElementById('forecast-par-not');
    if (el) el.textContent = [_fcParNot, _fcBorttagnaNot].filter(Boolean).join(' ');
}
function _fcKandidater() {
    const r = forslagskandidater(_fcAllaPar(), kInstalld());
    _fcParNot = r.not;
    _fcVisaParNot();
    return r.kandidater;
}
/**
 * Gör förslagen till riktade rader (kalla: 'par') och minns, för varje rad, storleken på grupperna i paret den räknades
 * ur, så att _fcRensaParMal kan avgöra raden säkert när tröskeln ändras. Paret är det som förslaget valde: ett per
 * yrke, ur samma ettParPerYrke (src/lib/loneoversyn.js).
 */
function _fcForslagTillRader(targets, cand) {
    const valda = new Map(ettParPerYrke(cand).map(c => [c.bas + '|' + c.aid, c]));
    _fcBorttagnaNot = '';
    _fcVisaParNot();
    return targets.map(t => {
        const rad = { bas: t.bas, aid: t.aid, mode: 'kr', value: t.value, dist: 'lowest', targetLevel: 'median', pool: 'equity', kalla: 'par' };
        const c = /** @type {{n: number, maN: number|null}|undefined} */ (/** @type {unknown} */ (valda.get(t.bas + '|' + t.aid)));
        if (c) _fcParUrsprung.set(rad, { kvN: c.n, maN: c.maN ?? null });
        return rad;
    });
}
// Förslagsknappen vid potten: samma förslag som knappen under Riktade potter, aktiv först när en pott är angiven.
function _fcUppdateraForslagPott() {
    const knapp = /** @type {HTMLButtonElement|null} */ (document.getElementById('forecast-optimize-pott'));
    if (!knapp) return;
    const v = state.forecast && state.forecast.budget ? state.forecast.budget.value : null;
    knapp.disabled = !(typeof v === 'number' && isFinite(v) && v > 0);
}
// Fäller ut Riktade potter och rullar dit, så att det syns vad förslaget gjorde.
function _fcOptimeraFranPott() {
    _fcOptimera();
    const avsnitt = /** @type {HTMLDetailsElement|null} */ (document.getElementById('avsnitt-lo-riktade'));
    if (!avsnitt) return;
    avsnitt.open = true;
    try { avsnitt.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch (_e) { /* äldre webbläsare: utfällt räcker */ }
}
function _fcOptimera() {
    const d = hamtaData();
    if (!d.length) return;
    _fcLasReglage();
    const cand = _fcKandidater();
    const egna = state.forecast.targets.filter(t => t.kalla !== 'par');
    const targets = forslagUrPotten(d, { budget: state.forecast.budget, generell: state.forecast.generell, egna, kandidater: cand, minN: state.forecast.minGroupN || 0 });
    if (!targets.length) {
        alert('Verktyget hittade inga skillnader i likvärdigt arbete i grupper med minst ' + (state.forecast.minGroupN || 0) + ' ' + personOrd(state.forecast.minGroupN || 0) + ', eller så har det generella påslaget tagit hela potten. Sänk minsta antal personer i gruppen eller lägg till riktade rader själv.');
        return;
    }
    state.forecast.targets = [...egna, ..._fcForslagTillRader(targets, cand)];   // egna rader står kvar; förslagen ersätts
    ritaRiktadeRader();
    ritaPrognos();
}
/**
 * Efter ändrad tröskel, inläst konfigurationsfil och inläst lönefil: tar bort de riktade rader som verktyget föreslog
 * ur par i likvärdigt arbete (kalla: 'par') och som inte säkert räknades ur ett par där båda grupperna når den inställda tröskeln,
 * också på skärmen (ADR-69), och uppdaterar meningen om utelämnade par. Rader som användaren lagt till själv står kvar
 * (regel R2). Anropas av sattKTroskel före omritningen.
 *
 * En rad som verktyget föreslog i den här sessionen avgörs säkert: storleken på paret den räknades ur finns i minnet
 * (_fcParUrsprung). En rad utan den uppgiften (ur en konfigurationsfil, också en äldre med en rad per jämförelseyrke)
 * kan komma ur vilket som helst av yrkets par; den står kvar bara när parlistan är fullständig (inte kapad vid Visa
 * max), yrket har par och alla når tröskeln, annars tas den bort. Meningen vid förslagen säger hur många rader som togs bort och varför.
 * @returns {number} Antal borttagna rader.
 */
export function _fcRensaParMal() {
    if (!state.data.length || !state.forecast || !Array.isArray(state.forecast.targets)) return 0;
    // Utan förslag ur par och utan visad mening finns inget att rensa eller uppdatera — och då
    // ska analysen inte heller köras här (den cachas, och underlaget kan vara på väg in).
    const sc = state.forecast.scenarios || {};
    const scenarioRader = s => (s && _fcScenarioRader.get(s)) || [];
    const harPar = rader => rader.some(t => t.kalla === 'par');
    if (!_fcParNot && !harPar(state.forecast.targets) && !harPar(scenarioRader(sc.A)) && !harPar(scenarioRader(sc.B))) return 0;
    _fcKandidater();   // meningen om utelämnade par efter den inställda tröskeln
    const k = kInstalld();
    const allaPar = _fcAllaPar();
    // Prövningen är rensaForeslagnaRader i src/lib/vymodell-loneoversyn.js. Listan är kapad vid Visa max (topN); den
    // räcker för den försiktiga prövningen bara när den har alla par (parAntal.totalt räknas före urvalet, ADR-61).
    // Lägre krav, högre lön är en egen lista och räknas inte.
    const svar = rensaForeslagnaRader({ rader: state.forecast.targets, allaPar, fullstandig: _fcParListanFullstandig(allaPar), k,
        ursprung: t => _fcParUrsprung.get(t),
        scenarioRader: { A: sc.A ? scenarioRader(sc.A) : null, B: sc.B ? scenarioRader(sc.B) : null } });
    const { sakert, forsiktigt, bortScenarier } = svar;
    state.forecast.targets = svar.kvar;
    // Ett sparat scenario som räknades med en rad som inte står sig tas bort: dess summor räknades ur raden.
    for (const slot of bortScenarier) sc[slot] = null;
    if (sakert + forsiktigt || bortScenarier.length) {
        const rader = n => `${n} ${n === 1 ? 'föreslagen rad' : 'föreslagna rader'}`;
        const skal = [];
        if (sakert) skal.push(`${rader(sakert)} togs bort eftersom paret ${sakert === 1 ? 'den' : 'de'} räknades ur har en grupp under ${k} ${personOrd(k)}.`);
        if (forsiktigt) skal.push(`${rader(forsiktigt)} togs bort eftersom verktyget inte kan avgöra vilket par ${forsiktigt === 1 ? 'den' : 'de'} räknades ur (till exempel ur en konfigurationsfil), och ${T.enhet.bf} har ett par med en grupp under ${k} ${personOrd(k)}, inget par alls eller par utanför de visade (Visa max i Likvärdigt arbete).`);
        if (bortScenarier.length) skal.push(`${bortScenarier.length === 1 ? `Det sparade scenario ${bortScenarier[0]}` : 'De sparade scenarierna A och B'} togs bort eftersom ${bortScenarier.length === 1 ? 'det' : 'de'} räknades med en föreslagen rad som inte står sig vid tröskeln ${k}.`);
        _fcBorttagnaNot = skal.join(' ') + ' Klicka på Föreslå fördelning mot skillnaderna i likvärdigt arbete för ett nytt förslag.';
        // Utfallet räknades med de borttagna raderna: det räknas om ur raderna som står kvar, också när Löneöversyn inte
        // är den öppna fliken. Exporten och scenarierna räknar dessutom alltid om (_fcBeraknaUtfall).
        state.forecast.result = null;
        try { ritaLoneoversyn(); } catch (_e) { /* ritas vid nästa flikbyte; exporten räknar om */ }
        _fcVisaParNot();
    }
    return sakert + forsiktigt;
}
// Kriteriebaserad riktning: expandera en massregel till riktade rader.
function _fcLaggTillEfterVillkor() {
    const d = hamtaData();
    if (!d.length) return;
    _fcLasReglage();
    const matcher = /** @type {HTMLInputElement} */ (document.getElementById('forecast-rule-match'))?.value || 'kvdom';
    const mode = /** @type {HTMLInputElement} */ (document.getElementById('forecast-rule-mode'))?.value || 'pct';
    const dist = /** @type {HTMLInputElement} */ (document.getElementById('forecast-rule-dist'))?.value || 'lowest';
    const value = parseFloat(/** @type {HTMLInputElement} */ (document.getElementById('forecast-rule-value'))?.value);
    const minN = state.forecast.minGroupN || 0;
    if (!isFinite(value) || value <= 0) { alert('Skriv ett belopp i kronor eller procent.'); return; }
    // Urvalet: villkorsgrupper i src/lib/vymodell-loneoversyn.js.
    const pool = matcher === 'kvdom' ? 'equity' : 'övrigt';
    const picked = villkorsgrupper(d, { villkor: matcher, minN, arKvDom: kvDomAv(_fcKostnadsval()) });
    if (!picked.length) { alert('Ingen grupp passar villkoret. Sänk minsta antal personer i gruppen (nu ' + minN + ').'); return; }
    let added = 0;
    picked.forEach(g => {
        if (!state.forecast.targets.some(t => t.bas === g.bas && t.aid === g.aid)) {
            state.forecast.targets.push({ bas: g.bas, aid: g.aid, mode, value, dist, targetLevel: 'median', pool });
            added++;
        }
    });
    ritaRiktadeRader();
    ritaPrognos();
    if (added === 0) alert('Grupperna finns redan bland de riktade raderna.');
}
// Mål-läge: riktade rader som minskar skillnaderna i likvärdigt arbete med en andel.
function _fcStangGap() {
    const d = hamtaData();
    if (!d.length) return;
    _fcLasReglage();
    const fracPct = parseFloat(/** @type {HTMLInputElement} */ (document.getElementById('forecast-closure-pct'))?.value);
    if (!isFinite(fracPct) || fracPct <= 0) { alert('Ange med hur många procent skillnaderna i likvärdigt arbete ska minska.'); return; }
    const cand = _fcKandidater();
    const targets = stangningsriktning(cand, fracPct / 100, state.forecast.minGroupN || 0);
    if (!targets.length) { alert('Verktyget hittade inga skillnader i likvärdigt arbete i grupper med minst ' + (state.forecast.minGroupN || 0) + ' ' + personOrd(state.forecast.minGroupN || 0) + '.'); return; }
    state.forecast.targets = [...state.forecast.targets.filter(t => t.kalla !== 'par'), ..._fcForslagTillRader(targets, cand)];   // egna rader står kvar
    ritaRiktadeRader();
    ritaPrognos();
}
// Scenario A/B: spara nuläget som ett scenario och jämför.
function _fcSparaScenario(slot) {
    const d = hamtaData();
    if (!state.forecast.result || !d.length) { alert('Det finns ingen prognos att spara. Ange en pott först.'); return; }
    const o = _fcBeraknaUtfall(d);
    // Det som scenariot bär räknas i scenarioUr (src/lib/vymodell-loneoversyn.js, regel R4): det råa gapet bara när
    // varje kön når tröskeln, antalen och grupperna med påslag, så att jämförelsen prövar dem mot den tröskel som gäller
    // när den visas. Huvudregressionen före och efter körs här, på raderna (ADR-17).
    const ols = oforklaratForeEfter(d, simuleradeRader(d, o), regressionsval());
    state.forecast.scenarios[slot] = {
        budgetTxt: o.pottAngiven ? (state.forecast.budget.mode === 'kr' ? svKr(state.forecast.budget.value) : svPoPct(state.forecast.budget.value)) : 'ingen pott angiven',
        targetsCount: state.forecast.targets.length,
        ...scenarioUr(d, o, ols, kTroskel())
    };
    _fcScenarioRader.set(state.forecast.scenarios[slot], state.forecast.targets.slice());
    _ritaScenariojamforelse();
}
function _ritaScenariojamforelse() {
    const host = document.getElementById('forecast-scenarios');
    if (!host) return;
    const sc = state.forecast.scenarios || {};
    if (!sc.A && !sc.B) { host.innerHTML = '<p class="text-dampad-sm marg-0">Spara två scenarier (A/B) för att jämföra utfall sida vid sida.</p>'; return; }
    const kr = n => svKr(n);
    const pc = n => n == null ? '–' : (n >= 0 ? '+' : '') + svPct(n, 1);
    // Ett scenario sparat vid en lägre tröskel kan bära ett rågap som inte längre får visas (som A/B-bilden i
    // 19-konfiguration.js); Till kv-dom följer regeln för Varav till kvinnodominerade grupper i utfallet, med samma
    // funktion (ADR-70). Båda prövas i scenariojamforelse (src/lib/vymodell-loneoversyn.js) mot den tröskel som gäller nu.
    const vm = scenariojamforelse(sc, { nu: konAntal(hamtaData()), k: kTroskel(), arKvDom: kvDomAv(_fcKostnadsval()) });
    const maskerat = vm.maskerat;
    const col = (r) => r ? `<td class="t-hoger">${kr(r.anvant)}</td><td class="t-hoger">${kr(r.totalKostnad)}</td><td class="t-hoger">${andelAvMan(r.raEfter)}</td><td class="t-hoger">${pc(r.oforklaratEfter)}</td><td class="t-hoger">${kr(r.tillKvDom)}</td><td class="t-hoger">${r.omkorningar}</td>` : '<td colspan="6" class="farg-dampad kursiv">ej sparat</td>';
    host.innerHTML = `<table class="data-table fs-sm">
        <thead><tr><th>Scenario</th><th class="t-hoger">Använt/mån</th><th class="t-hoger">Total kostnad</th><th class="t-hoger">Kv. median i % av mäns, efter</th><th class="t-hoger">Oförkl. efter</th><th class="t-hoger">Till kv-dom</th><th class="t-hoger">Omkörningar</th></tr></thead>
        <tbody>
            <tr><td><strong>A</strong> ${sc.A ? `<span class="f-dampad">(${esc(sc.A.budgetTxt)}, ${sc.A.targetsCount || 'inga'} ${sc.A.targetsCount === 1 ? 'riktad' : 'riktade'})</span>` : ''}</td>${col(vm.A)}</tr>
            <tr><td><strong>B</strong> ${sc.B ? `<span class="f-dampad">(${esc(sc.B.budgetTxt)}, ${sc.B.targetsCount || 'inga'} ${sc.B.targetsCount === 1 ? 'riktad' : 'riktade'})</span>` : ''}</td>${col(vm.B)}</tr>
        </tbody></table>${maskerat ? `<p class="k-mask-note">Kvinnors median i procent av mäns visas inte: ett kön har färre än ${kTroskel()} ${personOrd(kTroskel())} i urvalet.</p>` : ''}`;
}
// Målet i fältet för tröskelmålet: 0 är ett giltigt mål (ingen oförklarad skillnad), ett tomt fält eller text som inte
// är ett tal ger standardmålet, och ett tal utanför fältets min och max avvisas (ok: false) i stället för att tyst ändras.
/** @returns {{ok: boolean, pct: number, min: number, max: number}} */
function _fcLasMal(falt, standard) {
    const min = parseFloat(falt?.min ?? ''), max = parseFloat(falt?.max ?? '');
    const lo = isFinite(min) ? min : 0, hi = isFinite(max) ? max : Infinity;
    const text = String(falt?.value ?? '').trim().replace(',', '.');
    const v = text === '' ? NaN : Number(text);
    if (!isFinite(v)) return { ok: true, pct: standard, min: lo, max: hi };
    return { ok: v >= lo && v <= hi, pct: v, min: lo, max: hi };
}
// Tröskelmål: det minsta likalönslyftet till kvinnor som når målet för skillnaden eller gör den icke-signifikant.
// Sökningen är likalonslyftForMal i src/lib/loneoversyn.js; här läses fälten och resultatet ritas.
function _fcLyftMotMal() {
    const host = document.getElementById('forecast-threshold-result');
    const d = hamtaData();
    if (!host) return;
    _fcKnappresultat.add('forecast-threshold-result');
    if (!d.length) { host.innerHTML = ''; return; }
    // Lyftet i procent och dess kostnad är kvinnornas lönesumma gånger procentsatsen — ett könsuppdelat
    // lönemått. Det visas bara när varje kön når tröskeln (regressionen jämför mot män); annars ett streck
    // med förklaring (beslut av produktägaren 2026-10-16). Prövningen och sökningen: vymodellTroskelmal i
    // src/lib/vymodell-loneoversyn.js (regel R5), med huvudregressionen på raderna (ADR-17).
    const { STANDARD_PCT, MAX_LYFT_PCT, SIGNIFIKANS_P } = troskelmalKonstanter();
    const useSig = !!/** @type {HTMLInputElement} */ (document.getElementById('forecast-threshold-sig'))?.checked;
    const mal = _fcLasMal(/** @type {HTMLInputElement|null} */ (document.getElementById('forecast-threshold-pct')), STANDARD_PCT);
    const tgt = mal.ok ? mal.pct : STANDARD_PCT;
    const svar = vymodellTroskelmal(d, { k: kTroskel(), malPct: tgt, malOk: mal.ok, signifikans: useSig, regval: regressionsval() });
    if (svar.status === 'konUnderK') { host.innerHTML = `<span class="f-dampad">– ${esc(_konUtelamnatNot())}</span>`; return; }
    // Målet räknas bara i läget högst X %; i läget inte signifikant spelar fältet ingen roll.
    if (svar.status === 'ogiltigtMal') { host.innerHTML = `<span class="f-kritisk">Ange ett mål mellan ${svTal(mal.min)} och ${svPoPct(mal.max)}.</span>`; return; }
    const base = svar.utgangslage;
    if (svar.status === 'ingenSkattning') { host.innerHTML = '<span class="f-dampad">För få observationer för regression.</span>'; return; }
    if (svar.status === 'redan') { host.innerHTML = `<span class="farg-ok">${ikon('bock')} Målet är redan uppfyllt (oförklarad skillnad ${svPct(base.konPct, 1)}${useSig ? `, p=${base.pValue == null ? '–' : svTal(base.pValue, 3)}` : ''}).</span>`; return; }
    if (svar.status === 'utomRackhall') { host.innerHTML = `<span class="f-kritisk">Mer än ${MAX_LYFT_PCT} % likalönslyft skulle krävas. Kontrollera underlaget och regressionens variabler.</span>`; return; }
    const hi = /** @type {number} */ (svar.lyftPct), kostnad = /** @type {number} */ (svar.kostnadPerManad);
    const efter = /** @type {{konPct: number|null}} */ (svar.resultat);
    host.innerHTML = `<div class="fs-sm lh-1_6">
        För att nå <strong>${useSig ? `en oförklarad skillnad som inte är signifikant (p över ${svTal(SIGNIFIKANS_P, 2)})` : 'en oförklarad skillnad på högst ' + svPoPct(tgt)}</strong> krävs ett likalönslyft på <strong>≈ ${svPct(hi, 1)}</strong> till kvinnor.
        <br>Kostnad: <strong>≈ ${Math.round(kostnad).toLocaleString('sv-SE')} kr/mån</strong> (≈ ${Math.round(periodkostnad(kostnad, state.costSettings)).toLocaleString('sv-SE')} kr inkl. PO/period). Oförklarad skillnad då: ${efter.konPct == null ? '–' : svPct(efter.konPct, 2)}.
        <br><span class="text-dampad-xs">Ett räkneexempel med samma procentuella lyft till alla kvinnor. För en fördelning per grupp, använd knapparna för förslag och mål.</span>
    </div>`;
}
// Marknadspositionering: lyft grupper under marknadens median × faktorn.
function _fcMarknad() {
    const d = hamtaData();
    if (!d.length) return;
    _fcLasReglage();
    const f = (parseFloat(/** @type {HTMLInputElement} */ (document.getElementById('forecast-market-factor'))?.value) || 95) / 100;
    if (!(state.statistik || []).some(s => s.median > 0)) { alert('Jämförelsestatistiken är inte inläst. Läs in den under Filer och kvalitet.'); return; }
    const groups = sammanstallGrupper(d);
    // Statistikens gemensamma uppslag per grupp: samma AID och BAS, annars samma AID utan BAS, aldrig ett annat BAS.
    const market = statistikMarknad(state.statistik, groups);
    // Beloppen räknas ur gruppernas medianer: verktygets förslag, som följer den inställda tröskeln i båda lägena (ADR-69).
    const minN = Math.max(state.forecast.minGroupN || 0, kInstalld());
    const t = marknadsriktning(groups, market, f, minN);
    if (!t.length) { alert('Ingen grupp med minst ' + minN + ' ' + personOrd(minN) + ' ligger under ' + svTal(f * 100, 0) + ' procent av ' + jmfNamnGenitiv() + ' median.'); return; }
    let added = 0;
    t.forEach(x => { if (!state.forecast.targets.some(y => y.bas === x.bas && y.aid === x.aid)) { state.forecast.targets.push({ bas: x.bas, aid: x.aid, mode: 'kr', value: x.value, dist: 'lowest', targetLevel: 'median', pool: 'marknad' }); added++; } });
    ritaRiktadeRader();
    ritaPrognos();
    if (!added) alert('Grupperna finns redan bland de riktade raderna.');
}
// Budgetkänsligheten: skillnaderna i likvärdigt arbete minskade med 0–100 %.
function _fcKanslighet() {
    const host = document.getElementById('forecast-sensitivity');
    const d = hamtaData();
    if (!host) return;
    _fcKnappresultat.add('forecast-sensitivity');
    if (!d.length) { host.innerHTML = ''; return; }
    _fcLasReglage();
    const cand = _fcKandidater();
    if (!cand.length) { host.innerHTML = '<span class="text-dampad-sm">Verktyget hittade inga skillnader i likvärdigt arbete att räkna på.</span>'; return; }
    const cost = _fcKostnadsval();   // samma kostnadsinställningar och definition av kvinnodominerat som prognosen
    // k: det råa gapet följer tröskeln; minsta antal personer i gruppen som knappen för att minska skillnaderna
    // (vymodellKanslighet i src/lib/vymodell-loneoversyn.js).
    const { kurva: curve, storsta: maxGap } = vymodellKanslighet(d, cand, cost, kTroskel(), state.forecast.minGroupN || 0);
    const kr = n => svKr(n);
    host.innerHTML = `<table class="data-table fs-sm"><thead><tr><th>Minskning av skillnaderna</th><th class="t-hoger">Total kostnad</th><th class="t-hoger">Kvinnors median i % av mäns</th><th>　</th></tr></thead><tbody>
        ${curve.map(c => `<tr><td>${svPct((c.fraction * 100), 0)}</td><td class="t-hoger">${kr(c.kostnad)}</td><td class="t-hoger">${c.rawGap == null ? '–' : andelAvMan(c.rawGap)}</td><td><div class="rund-4 hojd-9 min-bredd-2 bg-info" data-stil-bredd="${(Math.abs(c.rawGap || 0) / maxGap * 100).toFixed(0)}%"></div></td></tr>`).join('')}
    </tbody></table><p class="text-dampad-xs marg-6-0-0">Avtagande avkastning: visar hur den råa skillnaden och kostnaden utvecklas när skillnaderna i likvärdigt arbete minskar allt mer.${_fcParNot ? ' ' + esc(_fcParNot) : ''}</p>`; tillampaDataStil(host);
}
// Kostnaden på individnivå (lika arbete, 3 kap. 9 § 1).
function _fcAtgard() {
    const host = document.getElementById('forecast-rem-result');
    const d = hamtaData();
    if (!host) return;
    _fcKnappresultat.add('forecast-rem-result');
    if (!d.length) { host.innerHTML = ''; return; }
    const gp = parseFloat(/** @type {HTMLInputElement} */ (document.getElementById('forecast-rem-pct'))?.value);
    // Minsta gruppstorlek: jämförelsen kräver tröskeln i antal män (mot en enda mans lön vore kostnaden
    // hans lön minus hennes), och en grupp får egen rad först när tröskeln i antal kvinnor berörs
    // (vymodellIndividlyft i src/lib/vymodell-loneoversyn.js).
    const K = kTroskel();
    const vm = vymodellIndividlyft(d, { gapPct: gp, k: K });
    const rem = vm.rem;
    state.forecast._remediation = rem;
    const kr = n => svKr(n);
    if (!rem.count) { host.innerHTML = `<span class="farg-ok">${ikon('bock')} Inga kvinnor ligger mer än gränsen under sitt jämförelsevärde.</span>`; return; }
    const { visade, dolda } = vm;
    const rowsHtml = visade.slice(0, 12).map(g => `<tr><td>${esc(g.bas)}</td><td>${esc(g.aid)}</td><td class="t-hoger">${g.count}</td><td class="t-hoger">${kr(g.cost)}/mån</td></tr>`).join('');
    // Summan är ett lönemått över de berörda: den visas först när de är minst K.
    const summa = vm.summaVisas
        ? `Kostnad att lyfta alla till jämförelsevärdet: <strong>${kr(rem.totalCost)}/mån</strong> (≈ ${kr(periodkostnad(rem.totalCost, state.costSettings))} inkl. PO/period).`
        : `Kostnaden visas inte, eftersom färre än ${K} ${personOrd(K)} berörs.`;
    const doldaNot = dolda
        ? `<p class="k-mask-note">${dolda} ${dolda === 1 ? 'grupp' : 'grupper'} där färre än ${K} kvinnor berörs ${vm.summaVisas ? 'ingår i summan men ' : ''}redovisas inte per grupp och blir inga riktade rader.</p>`
        : '';
    host.innerHTML = `<div class="fs-sm marg-b-8"><strong>${rem.count}</strong> ${rem.count === 1 ? 'kvinna' : 'kvinnor'} ligger mer än gränsen under sitt jämförelsevärde. ${summa}</div>
        ${rowsHtml ? `<table class="data-table st-085"><thead><tr><th>BAS</th><th>${stor(T.kod.en)}</th><th class="t-hoger">Antal</th><th class="t-hoger">Kostnad</th></tr></thead><tbody>${rowsHtml}</tbody></table>` : ''}${doldaNot}
        <p class="text-dampad-xs marg-6-0-0">Jämförelsevärdet är mäns median med samma ${T.enhet.en} i samma ${T.niva.en} när minst ${K} ${K === 1 ? 'man' : 'män'} finns där, annars mäns median i BAS (också minst ${K} ${K === 1 ? 'man' : 'män'}). Endast aggregat visas. Den slutliga bedömningen av sakliga skäl görs manuellt.</p>`;
}
function _fcAtgardTillRader() {
    const rem = state.forecast._remediation;
    if (!rem || !rem.perGroup.length) { alert('Klicka på Analysera först.'); return; }
    let added = 0;
    // Raderna är verktygets förslag och följer den inställda tröskeln i båda lägena (ADR-69): jämförelsen räknas om med
    // kInstalld() män, och bara grupper där minst så många kvinnor berörs blir riktade rader (beloppet står i raden).
    const K = kInstalld();
    const gp = parseFloat(/** @type {HTMLInputElement} */ (document.getElementById('forecast-rem-pct'))?.value);
    const { visade } = vymodellIndividlyft(hamtaData(), { gapPct: gp, k: K });
    if (!visade.length) { alert(`Ingen grupp har minst ${K} berörda — inga riktade rader läggs till.`); return; }
    visade.forEach(g => {
        if (!state.forecast.targets.some(t => t.bas === g.bas && t.aid === g.aid)) {
            state.forecast.targets.push({ bas: g.bas, aid: g.aid, mode: 'kr', value: Math.round(g.cost), dist: 'lowest', targetLevel: 'median', pool: 'equity' });
            added++;
        }
    });
    ritaRiktadeRader();
    ritaPrognos();
    if (!added) alert('Grupperna finns redan bland de riktade raderna.');
}
// Går alltid genom exportläget (ADR-51): djupräknaren håller skärmen i exportläget tills den sista pågående exporten är klar.
function exportPrognos(...a) { return medExportLage(() => _exportPrognosExport.apply(null, /** @type {any} */ (a))); }
function _exportPrognosExport() {
    if (!state.forecast.result || !hamtaData().length) { alert('Det finns ingen prognos att exportera. Ange en pott först.'); return; }
    const out = _fcBeraknaUtfall(hamtaData());   // ur raderna som de står, inte ett utfall som räknades före en rensning
    _fcKandidater();   // uppdaterar meningen om utelämnade par efter gällande tröskel
    const kr = n => Math.round(n);
    const K = kTroskel();
    const konOk = _konFarRedovisasFor(hamtaData());
    // Kostnaden för de maskerade raderna står samlad, och andelen till kvinnodominerade grupper bara när den inte ger
    // en del av den (ADR-70, utfallsvy i src/lib/vymodell-loneoversyn.js: samma som fliken).
    const vy = utfallsvy(out, K, kvDomAv(_fcKostnadsval()));
    const { utfall, varavKvDom } = vy;
    const meta = [
        ['Löneöversyn — prognosunderlag', ''],
        ['Genererad', new Date().toLocaleString('sv-SE')],
        ['Verktyg', verktygMedVersion()],
        ['', ''],
        ['Budgetläge', state.forecast.budget.mode === 'kr' ? 'Krontal/mån' : '% av lönesumman'],
        ['Budgetvärde', state.forecast.budget.value],
        ['Pott (kr/mån)', out.pottAngiven ? kr(out.pott) : 'ingen pott angiven'],
        ['Använt (kr/mån)', kr(out.använt)],
        ['Kvar att fördela (kr/mån)', out.kvar != null ? kr(out.kvar) : '–'],
        ['Generellt påslag', state.forecast.generell.mode === 'kr' ? `${svKr(state.forecast.generell.value || 0)}/mån` : svPoPct(state.forecast.generell.value || 0)],
        ['Minsta antal personer i gruppen för riktning', state.forecast.minGroupN || 0],
        ...state.forecast.targets.map((t, i) => [`Riktad pott ${i + 1}`, `BAS ${t.bas}, ${t.aid === '*' ? `alla ${T.enhet.fl}` : 'AID ' + t.aid}${t.kon === 'kvinna' ? ', bara kvinnor' : t.kon === 'man' ? ', bara män' : ''}${t.lonCap > 0 ? `, löner under ${svKr(t.lonCap)}` : ''}: ${t.value == null ? 'saknar belopp' : t.mode === 'till' ? `höj till ${svKr(t.value)}/mån` : t.mode === 'kr' ? `${svKr(t.value)}/mån` : `${svPoPct(t.value)} av grupplön`}${t.mode === 'till' || t.value == null ? '' : ` (${{ flat: 'lika %', lowest: 'lägst först', target: 'mot målnivå' }[t.dist] || t.dist})`}`]),
        ...(_fcParNot ? [['Utelämnade kandidatpar (likvärdigt arbete)', _fcParNot]] : []),
        ['Avrundning av nya löner (kr)', state.forecast.roundStep || 0],
        ['Stegvis plan (antal år)', state.forecast.years || 1],
        ['Generellt (kr/mån)', kr(out.generellCost || 0)],
        ['Riktat (kr/mån)', kr(out.riktadCost || 0)],
        ['Varav till kvinnodominerade grupper (kr/mån)', varavKvDom == null ? '–' : kr(varavKvDom || 0)],
        ['Omkörningar (grupper som går om en tidigare högre grupp)', vy.omkorningar.length],
        ['Total kostnad (inkl. PO + period)', kr(out.totalKostnad)],
        ['Lönesumma före (kr/mån)', kr(out.lonsummaFore)],
        ['Lönesumma efter (kr/mån)', kr(out.lonsummaEfter)],
        ['Kvinnors medianlön i % av mäns, före', !konOk || out.rawGapFore == null ? '–' : avrundaSymmetriskt(100 + out.rawGapFore, 1)],
        ['Kvinnors medianlön i % av mäns, efter', !konOk || out.rawGapEfter == null ? '–' : avrundaSymmetriskt(100 + out.rawGapEfter, 1)],
        ...(konOk ? [] : [['Könsuppdelade mått', _konUtelamnatNot()]]),
        ...(utfall.sma.length ? [['Grupper under tröskeln', _fcUtfallsNot(utfall, K) + (varavKvDom == null ? ' Andelen till kvinnodominerade grupper visas inte, eftersom den skulle ge en del av den samlade kostnaden.' : '')]] : []),
        ['', ''],
        ['OBS', 'Bara summor. Enskildas löner ingår inte (inbyggt dataskydd). Den slutliga löneöversynen dokumenteras i Word-utkastet och Handlingsplan.']
    ];
    const header = ['BAS', stor(T.kod.en), 'n', 'Andel kvinnor (%)', 'Gammal median', 'Ny median', 'Förändring (%)', 'Kostnad (kr/mån)'];
    const body = [...utfall.visade, ...utfall.maskerade].map(g => {
        const masked = utfall.maskerade.includes(g), dold = g.n < K ? 'n<' + K : 'se noten';
        return [g.bas, g.aid, g.n, avrundaSymmetriskt(g.andelKv, 0),
            masked ? dold : kr(g.gammalMedian),
            masked ? dold : kr(g.nyMedian),
            masked ? '' : avrundaSymmetriskt(100 * (g.nyMedian / g.gammalMedian - 1), 1),
            masked ? '' : kr(g.kostnad)];
    });
    const s = utfall.samlad;
    if (s && s.kostnad != null) body.push(['Kostnad för grupper under tröskeln', `${s.antalGrupper} ${s.antalGrupper === 1 ? 'grupp' : 'grupper'}, ${s.n} ${personOrd(s.n)}`, '', '', '', '', '', kr(s.kostnad)]);
    if (s) body.push([], [_fcUtfallsNot(utfall, K)]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(meta), 'Sammanfattning');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([header, ...body]), 'Fördelning');
    _laggTillMetodblad(wb);
    XLSX.writeFile(wb, demoFilnamn(`loneoversyn_prognos_${idagDatum()}.xlsx`));
    _visaExportvarning();
    meddelaSkarmlasare('Löneöversynens prognosunderlag exporterat.');
}

/** Det som körs vid laddning, i filens ordning; src/app/index.js anropar delarnas uppstart i sifferordning. */
export function uppstartLoneoversyn() {
    document.getElementById('forecast-lutning-niva')?.addEventListener('change', () => ritaPrognos());
    (function wireForecast() {
        ['forecast-budget-mode', 'forecast-budget-value', 'forecast-generell-mode', 'forecast-generell-value', 'forecast-min-n', 'forecast-round', 'forecast-years'].forEach(id => {
            const el = document.getElementById(id);
            if (el) { el.addEventListener('input', ritaPrognos); el.addEventListener('change', ritaPrognos); }
        });
        document.getElementById('forecast-closure')?.addEventListener('click', _fcStangGap);
        document.getElementById('forecast-market-btn')?.addEventListener('click', _fcMarknad);
        document.getElementById('forecast-threshold-btn')?.addEventListener('click', _fcLyftMotMal);
        document.getElementById('forecast-sensitivity-btn')?.addEventListener('click', _fcKanslighet);
        document.getElementById('forecast-rem-btn')?.addEventListener('click', _fcAtgard);
        document.getElementById('forecast-rem-seed')?.addEventListener('click', _fcAtgardTillRader);
        document.getElementById('forecast-save-a')?.addEventListener('click', () => _fcSparaScenario('A'));
        document.getElementById('forecast-save-b')?.addEventListener('click', () => _fcSparaScenario('B'));
        document.getElementById('forecast-add-target')?.addEventListener('click', () => {
            const basList = hamtaBasIntervall();
            const bas = basList[0] || '';
            const aid = (_fcAidForBas(bas)[0] || {}).aid || '';
            state.forecast.targets.push({ bas, aid, kon: 'alla', lonCap: null, mode: 'kr', value: null, dist: 'lowest', targetLevel: 'median', pool: 'övrigt' });
            ritaRiktadeRader();
            ritaPrognos();
        });
        document.getElementById('forecast-add-criteria')?.addEventListener('click', _fcLaggTillEfterVillkor);
        document.getElementById('forecast-optimize')?.addEventListener('click', _fcOptimera);
        document.getElementById('forecast-optimize-pott')?.addEventListener('click', _fcOptimeraFranPott);
        _fcUppdateraForslagPott();
        document.getElementById('forecast-export')?.addEventListener('click', exportPrognos);
        document.getElementById('forecast-reset')?.addEventListener('click', () => {
            state.forecast = nyPrognos();
            // Tomma fält (null) sätts inte av ritaLoneoversyn; de övriga fälten följer tillståndet.
            ['forecast-budget-value', 'forecast-generell-value'].forEach(id => { const el = document.getElementById(id); if (el) /** @type {HTMLInputElement} */ (el).value = ''; });
            _fcGlomKnappresultat();
            ritaLoneoversyn();
        });
    })();
}

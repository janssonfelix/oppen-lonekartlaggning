// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
import { kronorSkillnad, talformat } from '../lib/figur.js';
import { inbyggdaProfiler, matchaImportprofil } from '../lib/importprofiler.js';
import { vardeForRoll } from '../lib/inlasning.js';
import { tillDirektivtecken } from '../lib/struktur.js';
import { svPct, svTal } from '../lib/talformat.js';
import { esc } from './01-html-och-tillganglighet.js';
import { state } from './12-tillstand.js';
import { klickaFlik, tabMal } from './31-navigering.js';
import { _kolumnval } from './32-filinlasning.js';
import { sidindexGaTill } from './89-sidindex.js';

/** Ansvarsförbehållet (beslut 8c): samma lydelse i Om verktyget, Word/PDF, Excel och rapportunderlaget. tests/juridiksprak.test.js vaktar. */
export const ANSVARSFORBEHALL = 'Verktyget är ett stöd för arbetsgivarens egen lönekartläggning. Användaren ansvarar för hur verktyget används, för tolkningen av resultaten och för den juridiska bedömningen. Verktyget är inte juridiskt granskat.';

export function showLoading() { const el = document.getElementById("loading-overlay"); if (el) el.style.display = "flex"; }
export function hideLoading() { const el = document.getElementById("loading-overlay"); if (el) el.style.display = "none"; }

// Uträknade mått (stapelbredd i procent, läge) får inte stå som style="…" i markeringen: CSP:n har inget style-src-attr
// (ADR-30), så en sådan stil blockeras. Mallarna skriver måttet som data-stil-bredd="42%" (också -vanster, -mvanster),
// och den här funktionen sätter det via CSSOM, som CSP:n inte rör, när markeringen lagts in. Anropas på containern
// efter varje innerHTML som bär data-stil-*; tests/sakerhet.test.js kräver att filer med data-stil- också anropar den.
const DATA_STIL = [['data-stil-bredd', 'width'], ['data-stil-vanster', 'left'], ['data-stil-mvanster', 'marginLeft']];
export function tillampaDataStil(rot) {
    if (!rot) return;
    for (const [attr, egenskap] of DATA_STIL) {
        const satt = el => { el.style[egenskap] = el.getAttribute(attr); };
        if (rot.hasAttribute && rot.hasAttribute(attr)) satt(rot);
        rot.querySelectorAll('[' + attr + ']').forEach(satt);
    }
}

// ---- Kolumnerna: vilken rubrik som bär vilket fält ----
// Reglerna (TILLATNA_FALT, _rubrikForRoll, _hittaRubrik och gissaKolumnmappning) bor i src/lib/inlasning.js; appen
// importerar gissaKolumnmappning under samma namn. Adaptrarna här och i 06-uppgiftsminimering.js skickar med
// kolumnmappningen och importprofilen ur tillståndet.
/** Kolumnmappningen och importprofilen ur tillståndet, som lib-funktionerna för kolumnvalet tar emot. */
export function _kolumnvalIState() {
    return { columnMap: state.columnMap, importprofil: state.importprofil };
}
/** Radens värde i kolumnen som bär rollen (manuell mappning, importprofilen, namnet), eller tom sträng. */
export function getField(row, possibleNames, role) {
    return vardeForRoll(row, possibleNames, role, _kolumnvalIState());
}

// ---- Importprofiler: kända kolumnuppsättningar (src/lib/importprofiler.js) ----
// Ordningen när en fil läses in: organisationspaketets profiler, konfigurationsfilens, de inbyggda, och sist
// delsträngsmatchningen ovan för de roller ingen profil täcker. _ipMatcha sorterar efter källan.
/** Alla profiler som prövas: sessionens (paketets och konfigurationsfilens) och de inbyggda. */
export function _importprofilLista() {
    return [...(state.importprofiler || []), ...inbyggdaProfiler()];
}
/** Profilen som gäller för rubrikerna, som { id, namn, kalla, mappning }, eller null. */
export function _importprofilFor(headers) {
    const t = matchaImportprofil(headers || [], _importprofilLista());
    return t ? { id: t.profil.id, namn: t.profil.namn, kalla: t.profil.kalla, mappning: t.mappning } : null;
}
/** Källan i ord, för raden "Känd uppsättning: … (källa)". */
export function _importprofilKalla(kalla) {
    return kalla === 'organisationspaket' ? 'organisationspaketet' : kalla === 'konfiguration' ? 'konfigurationsfilen' : 'inbyggd';
}
/**
 * "Känd uppsättning: Namn (källa)" för profilen, eller tom sträng. "Känd uppsättning, ändrad: …" när det effektiva
 * valet för filens rubriker (`headers`) skiljer sig från det som känns igen utan val: profilen och, för roller den
 * inte täcker, rubrikernas namn (_kolumnval i 32-filinlasning.js). En vald rubrik som filen inte har gäller inte och
 * räknas inte; ett aktivt "— ingen —" för ansvarskoden räknas som en ändring.
 * @param {any} p
 * @param {string[]} [headers] rubrikerna i filen profilen gäller (standard: den inlästa lönefilens)
 */
export function importprofilText(p, headers = state._dataHeaders) {
    if (!p) return '';
    let andrad = false;
    if (typeof _kolumnval === 'function') {
        const { auto, eff } = _kolumnval(headers || []);
        andrad = Object.keys(auto).concat(Object.keys(eff)).some(r => (eff[r] || '') !== (auto[r] || ''));
    }
    return `Känd uppsättning${andrad ? ', ändrad' : ''}: ${p.namn} (${_importprofilKalla(p.kalla)})`;
}

/** Dagens datum som 'ÅÅÅÅ-MM-DD' i lokal tid, för filnamn och fältet skapat. Inte toISOString(): den ger UTC, och
 *  mellan midnatt och 01 (02 sommartid) blir det gårdagens datum. @param {Date} [datum] */
export function idagDatum(datum = new Date()) {
    const p = n => String(n).padStart(2, '0');
    return `${datum.getFullYear()}-${p(datum.getMonth() + 1)}-${p(datum.getDate())}`;
}

// ---- Tal som text, svenskt format ----
// svTal, svPct, svKr och svPoPct bor i src/lib/talformat.js; delarna importerar dem därifrån.
// Där står också varför ett hårt mellanslag står före enheten.

// ---- Underlagets storlek i en tabell ----
// En tabell med ett lönemått för en grupp visar gruppens antal (som egen kolumn); en modelltabell, där alla rader
// bygger på samma urval, bär antalet i sin rubrikrad (caption): "n = 260; 150 kvinnor, 110 män".
/** @param {number} nKv @param {number} nMa */
export function antalText(nKv, nMa) { return `n = ${svTal(nKv + nMa, 0)}; ${svTal(nKv, 0)} kvinnor, ${svTal(nMa, 0)} män`; }
/** Rubrikraden med antalet, som HTML; `fore` är en text före antalet (escapas). */
export function antalCaption(nKv, nMa, fore = '') {
    return `<caption class="text-dampad-sm ta-vanster">${fore ? `${esc(fore)} · ` : ''}${antalText(nKv, nMa)}</caption>`;
}

// ---- Lönegapets form ----
// Det råa lönegapet mellan könen visas som KVINNORS LÖN I PROCENT AV MÄNS: 100 % = ingen skillnad, under 100 %
// = kvinnor ligger lägre. Värdena räknas överallt som skillnad, (kvinnor / män − 1) · 100; andelAvMan gör om den
// till visningsformen. Två undantag behåller skillnaden: regressionens gap (oförklarat, åldersjusterat — det är
// statistikens vanliga form) och de mått EU-direktivet definierar som en skillnad (där står båda formerna).
/** Skillnaden i procent (negativ = kvinnor lägre) som "kvinnors lön i procent av mäns", t.ex. −8,3 → "91,7 %". */
/** Lönegapet med direktivets tecken: skillnaden i procent av mäns lön, positiv när kvinnor ligger lägre. `gapPct` är (kvinnor − män) / män. */
// Direktivets tecken (art. 9): tecknet vänds i _stTillDirektivtecken (src/lib/struktur.js), som EU-lönerapporten använder.
export function direktivGap(gapPct, dec = 1) { const v = tillDirektivtecken(gapPct); return v == null ? '–' : svPct(v, dec); }
export function andelAvMan(gapPct, dec = 1) { return typeof gapPct === 'number' && isFinite(gapPct) ? svPct(100 + gapPct, dec) : '–'; }

// ---- Interna fel (ADR-31) ----
// Analysdelar som ska tåla fel (Att göra, färdigchecken, handlingsplanen m.fl.) hoppar
// över sin del om något kastar, så att resten av verktyget fungerar. Felet sväljs inte tyst:
// platsen sparas, en varning skrivs i konsolen och en banner säger att resultatet kan
// vara ofullständigt.
// Konsolen får bara platsen och feltypen, med siffror maskerade: ett felmeddelande kan i
// sällsynta fall innehålla värden ur filen, och konsolen ska aldrig bära lönedata.
export function rapporteraFel(plats, e) {
    if (!Array.isArray(state._interntFel)) state._interntFel = [];
    const typ = (e && e.name) || 'Error';
    if (!state._interntFel.some(f => f.plats === plats)) state._interntFel.push({ plats, typ });
    const msg = String((e && e.message) || e || '').replace(/\d/g, '#').slice(0, 120);
    try { console.warn(`[Öppen lönekartläggning] Internt fel i ${plats} (${typ}): ${msg}`); } catch (_x) { /* ingen konsol */ }
    visaInterntFel();
}

export function visaInterntFel() {
    const el = document.getElementById('internt-fel-banner');
    if (!el) return;
    const fel = Array.isArray(state._interntFel) ? state._interntFel : [];
    el.hidden = fel.length === 0;
    el.textContent = fel.length
        ? `Ett internt fel gjorde att en del av analysen hoppades över (${fel.map(f => f.plats).join(', ')}). `
          + 'Resultatet kan vara ofullständigt. Ladda om sidan och läs in filen igen; kvarstår felet, rapportera det till projektet.'
        : '';
}

// Skillnaden i kronor per månad (kvinnors median − mäns, avrundad till hundratal) som fält på en datapunkt, så att
// verktygstipset och diagramdatan bär den. Tomt när någon median saknas. Anroparen skickar bara
// medianer som får redovisas — båda könen når tröskeln.
export function _kronorFalt(medKv, medMa) {
    const v = kronorSkillnad(medKv, medMa);
    return v == null ? {} : { skillnadKr: v };
}

// Verktygstipset för en prick i ett kvantilpunktdiagram (lada med form: 'kvantiler'): vilken
// andel av gruppen pricken står för och dess lön. `s.kvantil` sätts av diagramkärnan när pekaren står på en prick.
export function _kvantilTipsRader(s) {
    const q = s && s.kvantil;
    if (!q) return [];
    const del = q.antal === 20 ? 'en tjugondel' : q.antal === 50 ? 'en femtiondel' : `1/${q.antal}`;
    return [[`Prick ${q.nr} av ${q.antal}`, `${talformat(q.varde, 'kr')} — varje prick är ${del} av gruppen`]];
}

/** Det som körs vid laddning, i filens ordning; src/app/index.js anropar delarnas uppstart i sifferordning. */
export function uppstartHjalpfunktioner() {
    // HTTP-varning vid osäker anslutning. file:// och localhost är OK.
    (function checkHttpWarning() {
        const proto = window.location.protocol;
        const host  = window.location.hostname;
        if (proto === 'http:' && host !== 'localhost' && host !== '127.0.0.1' && host !== '') {
            const w = document.getElementById('http-warning');
            if (w) w.style.display = 'flex';
        }
    })();
    document.getElementById('http-warning-dismiss')?.addEventListener('click', () => {
        const w = document.getElementById('http-warning');
        if (w) w.style.display = 'none';
    });
    // Delegerade klick-hanterare i stället för inline `onclick=` i markup. Krävs av den
    // hash-baserade CSP:n (ADR-9): `script-src` saknar `'unsafe-inline'`, vilket
    // blockerar inline event-handler-attribut. Två mönster täcks:
    //   data-goto-tab="<tab>"   → klickar motsvarande nav-flik (tomt-läges-knappar); med data-goto-avsnitt="<id>"
    //                             går sidan sedan till avsnittet eller kortet med det id:t (som sidindexet)
    //   data-dismiss-parent     → tar bort knappens föräldernod (notis-/toast-OK)
    document.addEventListener('click', e => {
        const goto = /** @type {HTMLElement} */ (e.target).closest('[data-goto-tab]');
        if (goto) {
            const nav = document.querySelector('.nav-item[data-tab="' + tabMal(goto.getAttribute('data-goto-tab')) + '"]');
            const avsnitt = goto.getAttribute('data-goto-avsnitt');
            const tillAvsnitt = () => { if (nav && avsnitt && typeof sidindexGaTill === 'function') sidindexGaTill(avsnitt); };
            // Användarens klick visar fliken först och räknar den sedan (ADR-80); avsnittet visas när fliken är ritad.
            if (nav && !(/** @type {HTMLInputElement} */ (nav).disabled)) klickaFlik(nav, { uppskjut: e.isTrusted, efter: tillAvsnitt });
            else { if (nav) /** @type {HTMLElement} */ (nav).click(); tillAvsnitt(); }
            return;
        }
        const dismiss = /** @type {HTMLElement} */ (e.target).closest('[data-dismiss-parent]');
        if (dismiss && dismiss.parentNode) /** @type {HTMLElement} */ (dismiss.parentNode).remove();
    });
    // Det som är dolt från start bär klassen .dold i markeringen (stilmallen döljer det utan att vänta på skriptet). Skriptet
    // sätter dessutom display:none via CSSOM, så att el.style.display visar läget som förr (öppen 'flex', stängd 'none').
    document.querySelectorAll('.dold').forEach(el => { /** @type {HTMLElement} */ (el).style.display = 'none'; });
}

// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson

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
//   data-goto-tab="<tab>"   → klickar motsvarande nav-flik (tomt-läges-knappar)
//   data-dismiss-parent     → tar bort knappens föräldernod (notis-/toast-OK)
document.addEventListener('click', e => {
    const goto = /** @type {HTMLElement} */ (e.target).closest('[data-goto-tab]');
    if (goto) {
        const nav = document.querySelector('.nav-item[data-tab="' + tabMal(goto.getAttribute('data-goto-tab')) + '"]');
        if (nav) /** @type {HTMLElement} */ (nav).click();
        return;
    }
    const dismiss = /** @type {HTMLElement} */ (e.target).closest('[data-dismiss-parent]');
    if (dismiss && dismiss.parentNode) /** @type {HTMLElement} */ (dismiss.parentNode).remove();
});

function showLoading() { const el = document.getElementById("loading-overlay"); if (el) el.style.display = "flex"; }
function hideLoading() { const el = document.getElementById("loading-overlay"); if (el) el.style.display = "none"; }

// Det som är dolt från start bär klassen .dold i markeringen (stilmallen döljer det utan att vänta på skriptet). Skriptet
// sätter dessutom display:none via CSSOM, så att el.style.display visar läget som förr (öppen 'flex', stängd 'none').
document.querySelectorAll('.dold').forEach(el => { /** @type {HTMLElement} */ (el).style.display = 'none'; });

// Uträknade mått (stapelbredd i procent, läge) får inte stå som style="…" i markeringen: CSP:n har inget style-src-attr
// (ADR-30), så en sådan stil blockeras. Mallarna skriver måttet som data-stil-bredd="42%" (också -vanster, -mvanster),
// och den här funktionen sätter det via CSSOM, som CSP:n inte rör, när markeringen lagts in. Anropas på containern
// efter varje innerHTML som bär data-stil-*; tests/sakerhet.test.js kräver att filer med data-stil- också anropar den.
const DATA_STIL = [['data-stil-bredd', 'width'], ['data-stil-vanster', 'left'], ['data-stil-mvanster', 'marginLeft']];
function tillampaDataStil(rot) {
    if (!rot) return;
    for (const [attr, egenskap] of DATA_STIL) {
        const satt = el => { el.style[egenskap] = el.getAttribute(attr); };
        if (rot.hasAttribute && rot.hasAttribute(attr)) satt(rot);
        rot.querySelectorAll('[' + attr + ']').forEach(satt);
    }
}

function getField(row, possibleNames, role) {
    // #11: manuell kolumnmappning vinner över auto-matchning om satt för rollen.
    if (role && state.columnMap && state.columnMap[role]) {
        const mapped = state.columnMap[role];
        if (Object.prototype.hasOwnProperty.call(row, mapped)) return row[mapped];
    }
    // Yrkesmönstret "aid" matchar på delsträng — en kolumn för AID:s ansvarskod ("AID-ansvar")
    // får aldrig tas för yrke (ADR-33).
    const hoppa = k => role === 'yrke' && typeof _anArRubrik === 'function' && _anArRubrik(k);
    for (const name of possibleNames) {
        const searchStr = name.toLowerCase().replace(/[^a-z0-9]/g, "");
        const key = Object.keys(row).find(k => !hoppa(k) && k.toLowerCase().replace(/[^a-z0-9]/g, "").includes(searchStr));
        if (key !== undefined) return row[key];
    }
    return "";
}

// #11: vilken CSV-rubrik auto-matchar varje roll (samma logik som getField,
// utan columnMap-override). Returnerar { roll: rubrik|null }.
function autoDetectColumnMap(headers) {
    const map = {};
    for (const role of Object.keys(ALLOWED_FIELDS)) {
        let found = null;
        const hoppa = h => role === 'yrke' && typeof _anArRubrik === 'function' && _anArRubrik(h);
        for (const name of ALLOWED_FIELDS[role]) {
            const searchStr = name.toLowerCase().replace(/[^a-z0-9]/g, '');
            const key = (headers || []).find(h => !hoppa(h) && String(h).toLowerCase().replace(/[^a-z0-9]/g, '').includes(searchStr));
            if (key !== undefined && key !== null) { found = key; break; }
        }
        map[role] = found;
    }
    return map;
}

// ---- Tal som text, svenskt format ----
// All text som visas ska ha decimalkomma och mellanslag före procenttecknet ("85,2 %"). toFixed ger decimalpunkt
// och används bara där ett tal ska läsas av kod (CSS-mått, sorteringsvärden, tal till Excel).
const _svNf = new Map();
/** Talet med `dec` decimaler i svenskt format; "–" om det inte är ett ändligt tal. */
function svTal(v, dec = 0) {
    if (typeof v !== 'number' || !isFinite(v)) return '–';
    if (!_svNf.has(dec)) _svNf.set(dec, new Intl.NumberFormat('sv-SE', { minimumFractionDigits: dec, maximumFractionDigits: dec }));
    const f = 10 ** dec, r = Math.round(v * f) / f;
    return _svNf.get(dec).format(r === 0 ? 0 : r);   // ingen "−0,0"
}
/** Som svTal, med " %" efter. */
function svPct(v, dec = 1) { return typeof v === 'number' && isFinite(v) ? `${svTal(v, dec)} %` : '–'; }

// ---- Lönegapets form ----
// Det råa lönegapet mellan könen visas som KVINNORS LÖN I PROCENT AV MÄNS: 100 % = ingen skillnad, under 100 %
// = kvinnor ligger lägre. Värdena räknas överallt som skillnad, (kvinnor / män − 1) · 100; andelAvMan gör om den
// till visningsformen. Två undantag behåller skillnaden: regressionens gap (oförklarat, åldersjusterat — det är
// statistikens vanliga form) och de mått EU-direktivet definierar som en skillnad (där står båda formerna).
/** Skillnaden i procent (negativ = kvinnor lägre) som "kvinnors lön i procent av mäns", t.ex. −8,3 → "91,7 %". */
/** Lönegapet med direktivets tecken: skillnaden i procent av mäns lön, positiv när kvinnor ligger lägre. `gapPct` är (kvinnor − män) / män. */
// Direktivets tecken (art. 9): tecknet vänds i _stTillDirektivtecken (src/lib/struktur.js), som EU-lönerapporten använder.
function direktivGap(gapPct, dec = 1) { const v = _stTillDirektivtecken(gapPct); return v == null ? '–' : svPct(v, dec); }
function andelAvMan(gapPct, dec = 1) { return typeof gapPct === 'number' && isFinite(gapPct) ? svPct(100 + gapPct, dec) : '–'; }

// ---- Interna fel (ADR-31) ----
// Analysdelar som ska tåla fel (Att göra, färdigchecken, handlingsplanen m.fl.) hoppar
// över sin del om något kastar, så att resten av verktyget fungerar. Felet sväljs inte tyst:
// platsen sparas, en varning skrivs i konsolen och en banner säger att resultatet kan
// vara ofullständigt.
// Konsolen får bara platsen och feltypen, med siffror maskerade: ett felmeddelande kan i
// sällsynta fall innehålla värden ur filen, och konsolen ska aldrig bära lönedata.
function rapporteraFel(plats, e) {
    if (!Array.isArray(state._interntFel)) state._interntFel = [];
    const typ = (e && e.name) || 'Error';
    if (!state._interntFel.some(f => f.plats === plats)) state._interntFel.push({ plats, typ });
    const msg = String((e && e.message) || e || '').replace(/\d/g, '#').slice(0, 120);
    try { console.warn(`[Öppen lönekartläggning] Internt fel i ${plats} (${typ}): ${msg}`); } catch (_x) { /* ingen konsol */ }
    visaInterntFel();
}

function visaInterntFel() {
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
function _kronorFalt(medKv, medMa) {
    const v = _figKronorSkillnad(medKv, medMa);
    return v == null ? {} : { skillnadKr: v };
}

// Verktygstipset för en prick i ett kvantilpunktdiagram (lada med form: 'kvantiler'): vilken
// andel av gruppen pricken står för och dess lön. `s.kvantil` sätts av diagramkärnan när pekaren står på en prick.
function _kvantilTipsRader(s) {
    const q = s && s.kvantil;
    if (!q) return [];
    const del = q.antal === 20 ? 'en tjugondel' : q.antal === 50 ? 'en femtiondel' : `1/${q.antal}`;
    return [[`Prick ${q.nr} av ${q.antal}`, `${_figTalformat(q.varde, 'kr')} — varje prick är ${del} av gruppen`]];
}


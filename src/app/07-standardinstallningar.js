// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson

// ---- State ----
const PRIO_CONFIG_DEFAULTS = Object.freeze({
    atgardThreshold:    -5,   // %, gränsvärde för Åtgärd/AKUT
    akutMinN:           10,   // minst antal personer för att klassas som AKUT
    bevakaThreshold:    -2,   // %, gränsvärde för Bevaka
    analyseraThreshold:  5    // %, gränsvärde för Analysera
});
const PRIO_WEIGHTS_DEFAULTS = Object.freeze({
    avvikelse:    50,   // viktning av avvikelsens storlek
    volym:        30,   // viktning av gruppens volym
    jamstalldhet: 20    // viktning av jämställdhet (lönegap kön)
});
// Kostnadsberäknings-defaults — PO-påslaget 40 % är ett standardantagande; organisationen sätter sitt eget
const COST_DEFAULTS = Object.freeze({
    months: 12,         // beräkningsperiod (3/6/9/12 vanligt)
    poPct:  40          // PO-påslag i % (arbetsgivaravgifter och pension ovanpå lönen)
});

// Automatisk rensning vid inaktivitet: på som standard (GDPR art. 25.2). Organisationspaketet kan låsa värdet (ADR-47).
const INAKTIVITET_STANDARD_MIN = 90;

// ---- Profil: organisationens benämningar (ADR-28) ----
// Verktyget är organisationsneutralt: ingen organisation är inbyggd. Profilen styr externa
// benämningar och standard-PO utan att röra analyslogiken; den sätts av ett
// organisationspaket.
/** Standardnamnet när inget organisationspaket satt ett namn. */
const ORG_STANDARDNAMN = 'Organisationen';
const DEFAULT_PROFILE = Object.freeze({
    name:                    ORG_STANDARDNAMN,
    benchmarkLabel:          'jämförelsestatistiken',
    benchmarkLabelGenitive:  'jämförelsestatistikens',
    benchmarkShort:          'jämförelsen',
    // Benämningarna av kravnivån och koden: ett organisationspaket kan sätta egna, standarden kommer ur termerna
    // (ADR-74). T finns först efter 09-termer.js, så värdena läses när profilen kopieras (12-tillstand.js och framåt).
    get basSystem()          { return T.niva.en; },
    get aidSystem()          { return `${T.kod.en} (SKR)`; },
    poPctDefault:            40,
    poPctNote:               '',       // ingen not till standardantagandet; tom not följer inte med i ett paket
    orgTyp:                  'alla',   // 'kommun' | 'region' | 'alla' — SKR-referensens del (ADR-34)
    locale:                  'sv-SE',
    notes:                   'Neutral standard. Läs in ett organisationspaket för organisationens benämningar.'
});

/**
 * Tillämpar profilens etiketter på alla DOM-noder med data-profile-attribut, och termerna (ADR-74) på noderna med
 * data-term-template. Anropas vid uppstart och varje gång state.profile uppdateras.
 */
function applyProfileLabels() {
    // Mall som "Kvinnor och män med samma {enhet.en}" → fylls med de gällande termerna (termText, 09-termer.js).
    // Med data-term-attr fylls det attributet (till exempel data-tip) i stället för texten.
    document.querySelectorAll('[data-term-template]').forEach(el => {
        const text = termText(el.getAttribute('data-term-template') || '');
        const attr = el.getAttribute('data-term-attr');
        if (attr) el.setAttribute(attr, text); else el.textContent = text;
    });
    // En mall i data-k-tooltip behåller {k} och {golv}; tröskeln fylls i därefter (06-k-troskel.js).
    if (typeof _fyllKTexter === 'function') _fyllKTexter();
    const p = state.profile;
    document.querySelectorAll('[data-profile-label]').forEach(el => {
        const key = el.getAttribute('data-profile-label') || '';
        if (p[key] != null) el.textContent = p[key];
    });
    document.querySelectorAll('[data-profile-template]').forEach(el => {
        // Mall som "Jämförelse {benchmarkLabel}" → ersätts med profilens värden.
        const tmpl = el.getAttribute('data-profile-template') || '';
        el.textContent = tmpl.replace(/\{(\w+)\}/g, (m, k) => p[k] != null ? p[k] : m);
    });
    // Default PO-påslag uppdateras om användaren inte har överridat
    if (state.costSettings.poPct === COST_DEFAULTS.poPct && p.poPctDefault !== COST_DEFAULTS.poPct) {
        state.costSettings.poPct = p.poPctDefault;
        const inp = document.getElementById('prio-po-pct');
        if (inp) /** @type {HTMLInputElement} */ (inp).value = p.poPctDefault;
    }
}

// ---- Namn på organisationen och jämförelsestatistiken (ADR-36) ----
// Etiketterna läser namnen härifrån. Utan namn skickas dagens text som standard.
const _PERSONUPPGIFT_FEL = 'Namnet liknar ett personnummer eller en e-postadress och sparades inte.';
function orgNamn(standard = ORG_STANDARDNAMN) {
    const n = state.profile && state.profile.name;
    return n && n !== DEFAULT_PROFILE.name ? _namnNormalisera(n) : standard;   // även paketnamn högst 100 tecken
}
function jmfNamn(standard = 'Jämförelsestatistiken') {
    const n = state.profile && state.profile.benchmarkLabel;
    return n && n !== DEFAULT_PROFILE.benchmarkLabel ? _namnNormalisera(n) : standard;
}
/** Jämförelsens namn i genitiv i löptext ("jämförelsestatistikens", eller paketets eget namn). */
function jmfNamnGenitiv() {
    const n = state.profile && state.profile.benchmarkLabelGenitive;
    return n && n !== DEFAULT_PROFILE.benchmarkLabelGenitive ? _namnNormalisera(n) : DEFAULT_PROFILE.benchmarkLabelGenitive;
}
// Namn i diagrammens serier visas alltid som text: vinkelparenteser byts mot typografiska, så att ett namn aldrig ser ut som markering.
function plotNamn(text) {
    return String(text ?? '').replace(/</g, '‹').replace(/>/g, '›');
}
function synkaNamnFalt() {
    const satt = (id, v) => { const el = document.getElementById(id); if (el && document.activeElement !== el) /** @type {HTMLInputElement} */ (el).value = v; };
    satt('org-namn', orgNamn(''));
    satt('kl-org-name', orgNamn(''));
    satt('jmf-namn', jmfNamn(''));
}
function _namnAndrat() {
    synkaNamnFalt();
    applyProfileLabels();
    if (typeof ritaOmReferens === 'function') ritaOmReferens();
}
function sattOrgNamn(text) {
    const n = _namnNormalisera(text);
    if (n && _opLiknarPersonuppgift(n)) return { ok: false, fel: _PERSONUPPGIFT_FEL };
    state.profile = { ...state.profile, name: n || DEFAULT_PROFILE.name };
    _namnAndrat();
    return { ok: true };
}
function sattJmfNamn(text) {
    const n = _namnNormalisera(text);
    if (n && _opLiknarPersonuppgift(n)) return { ok: false, fel: _PERSONUPPGIFT_FEL };
    state.profile = { ...state.profile,
        benchmarkLabel: n || DEFAULT_PROFILE.benchmarkLabel,
        benchmarkLabelGenitive: n ? _namnGenitiv(n) : DEFAULT_PROFILE.benchmarkLabelGenitive,
        benchmarkShort: n || DEFAULT_PROFILE.benchmarkShort };
    _namnAndrat();
    return { ok: true };
}
// Namnfälten: sparas när fältet lämnas; ett avvisat namn visar felet under fältet.
function _kopplaNamnFalt(id, satt) {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('change', () => {
        const r = satt(/** @type {HTMLInputElement} */ (el).value);
        const fel = el.closest('.upload-cell, .ref-namn-rad, .namn-falt')?.querySelector('.upload-namn-fel');
        if (fel) { fel.textContent = r.ok ? '' : r.fel; /** @type {HTMLElement} */ (fel).hidden = r.ok; }
        if (!r.ok) { synkaNamnFalt(); if (typeof renderReferensKort === 'function') renderReferensKort(); }
    });
}
_kopplaNamnFalt('kl-org-name', sattOrgNamn);

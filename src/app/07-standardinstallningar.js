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
// Kostnadsberäknings-defaults — SKR 2025 PO-påslag som standard
const COST_DEFAULTS = Object.freeze({
    months: 12,         // beräkningsperiod (3/6/9/12 vanligt)
    poPct:  39.15       // PO-påslag i % (SKR:s cirkulär 2025 — sociala avgifter + pensioner)
});

// Automatisk rensning vid inaktivitet: på som standard (GDPR art. 25.2). Organisationspaketet kan låsa värdet (ADR-47).
const INAKTIVITET_STANDARD_MIN = 90;

// ---- Profil: organisationens benämningar (ADR-28) ----
// Verktyget är organisationsneutralt: ingen organisation är inbyggd. Profilen styr externa
// benämningar och standard-PO utan att röra analyslogiken; den sätts av ett
// organisationspaket.
const DEFAULT_PROFILE = Object.freeze({
    name:                    'Er organisation',
    benchmarkLabel:          'jämförelsestatistiken',
    benchmarkLabelGenitive:  'jämförelsestatistikens',
    benchmarkShort:          'jämförelsen',
    basSystem:               'BAS-intervall',
    aidSystem:               'AID-kod (SKR)',
    poPctDefault:            39.15,
    poPctNote:               'SKR Cirkulär 2025',
    orgTyp:                  'alla',   // 'kommun' | 'region' | 'alla' — SKR-referensens del (ADR-34)
    locale:                  'sv-SE',
    notes:                   'Neutral standard. Läs in ett organisationspaket för er organisations benämningar.'
});

/**
 * Tillämpar profilens etiketter på alla DOM-noder med data-profile-attribut.
 * Anropas vid uppstart och varje gång state.profile uppdateras.
 */
function applyProfileLabels() {
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
function orgNamn(standard = 'Organisationen') {
    const n = state.profile && state.profile.name;
    return n && n !== DEFAULT_PROFILE.name ? _namnNormalisera(n) : standard;   // även paketnamn högst 100 tecken
}
function jmfNamn(standard = 'Jämförelsestatistiken') {
    const n = state.profile && state.profile.benchmarkLabel;
    return n && n !== DEFAULT_PROFILE.benchmarkLabel ? _namnNormalisera(n) : standard;
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

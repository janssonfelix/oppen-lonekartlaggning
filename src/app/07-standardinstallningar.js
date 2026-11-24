// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
import { COST_DEFAULTS } from '../lib/kostnad.js';
import { namnGenitiv, normaliseraNamn } from '../lib/namn.js';
import { liknarPersonuppgift } from '../lib/organisationspaket.js';
import { PRIO_CONFIG_DEFAULTS, PRIO_WEIGHTS_DEFAULTS } from '../lib/prioritering.js';
import { _fyllKTexter } from './06-k-troskel.js';
import { T, termText } from './09-termer.js';
import { ritaOmReferens, state } from './12-tillstand.js';
import { ritaReferensKort } from './38-referensfiler.js';

// ---- State ----
// Standardvärdena för prioriteringen och kostnaden står i src/lib/prioritering.js och src/lib/kostnad.js.
export { COST_DEFAULTS, PRIO_CONFIG_DEFAULTS, PRIO_WEIGHTS_DEFAULTS };

// Automatisk rensning vid inaktivitet: på som standard (GDPR art. 25.2). Organisationspaketet kan låsa värdet (ADR-47).
export const INAKTIVITET_STANDARD_MIN = 90;

// ---- Profil: organisationens benämningar (ADR-28) ----
// Verktyget är organisationsneutralt: ingen organisation är inbyggd. Profilen styr externa
// benämningar och standard-PO utan att röra analyslogiken; den sätts av ett
// organisationspaket.
/** Standardnamnet när inget organisationspaket satt ett namn. */
const ORG_STANDARDNAMN = 'Organisationen';
export const STANDARDPROFIL = Object.freeze({
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
export function tillampaProfiletiketter() {
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
export function orgNamn(standard = ORG_STANDARDNAMN) {
    const n = state.profile && state.profile.name;
    return n && n !== STANDARDPROFIL.name ? normaliseraNamn(n) : standard;   // även paketnamn högst 100 tecken
}
export function jmfNamn(standard = 'Jämförelsestatistiken') {
    const n = state.profile && state.profile.benchmarkLabel;
    return n && n !== STANDARDPROFIL.benchmarkLabel ? normaliseraNamn(n) : standard;
}
/** Jämförelsens namn i genitiv i löptext ("jämförelsestatistikens", eller paketets eget namn). */
export function jmfNamnGenitiv() {
    const n = state.profile && state.profile.benchmarkLabelGenitive;
    return n && n !== STANDARDPROFIL.benchmarkLabelGenitive ? normaliseraNamn(n) : STANDARDPROFIL.benchmarkLabelGenitive;
}
// Namn i diagrammens serier visas alltid som text: vinkelparenteser byts mot typografiska, så att ett namn aldrig ser ut som markering.
export function diagramNamn(text) {
    return String(text ?? '').replace(/</g, '‹').replace(/>/g, '›');
}
export function synkaNamnFalt() {
    const satt = (id, v) => { const el = document.getElementById(id); if (el && document.activeElement !== el) /** @type {HTMLInputElement} */ (el).value = v; };
    satt('org-namn', orgNamn(''));
    satt('kl-org-name', orgNamn(''));
    satt('jmf-namn', jmfNamn(''));
}
function _namnAndrat() {
    synkaNamnFalt();
    tillampaProfiletiketter();
    if (typeof ritaOmReferens === 'function') ritaOmReferens();
}
export function sattOrgNamn(text) {
    const n = normaliseraNamn(text);
    if (n && liknarPersonuppgift(n)) return { ok: false, fel: _PERSONUPPGIFT_FEL };
    state.profile = { ...state.profile, name: n || STANDARDPROFIL.name };
    _namnAndrat();
    return { ok: true };
}
export function sattJmfNamn(text) {
    const n = normaliseraNamn(text);
    if (n && liknarPersonuppgift(n)) return { ok: false, fel: _PERSONUPPGIFT_FEL };
    state.profile = { ...state.profile,
        benchmarkLabel: n || STANDARDPROFIL.benchmarkLabel,
        benchmarkLabelGenitive: n ? namnGenitiv(n) : STANDARDPROFIL.benchmarkLabelGenitive,
        benchmarkShort: n || STANDARDPROFIL.benchmarkShort };
    _namnAndrat();
    return { ok: true };
}
// Namnfälten: sparas när fältet lämnas; ett avvisat namn visar felet under fältet.
export function _kopplaNamnFalt(id, satt) {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('change', () => {
        const r = satt(/** @type {HTMLInputElement} */ (el).value);
        const fel = el.closest('.upload-cell, .ref-namn-rad, .namn-falt')?.querySelector('.upload-namn-fel');
        if (fel) { fel.textContent = r.ok ? '' : r.fel; /** @type {HTMLElement} */ (fel).hidden = r.ok; }
        if (!r.ok) { synkaNamnFalt(); if (typeof ritaReferensKort === 'function') ritaReferensKort(); }
    });
}

/** Det som körs vid laddning, i filens ordning; src/app/index.js anropar delarnas uppstart i sifferordning. */
export function uppstartStandardinstallningar() {
    _kopplaNamnFalt('kl-org-name', sattOrgNamn);
}

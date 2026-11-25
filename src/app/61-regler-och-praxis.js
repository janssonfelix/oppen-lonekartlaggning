// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
import { kvartilfordelning } from '../lib/struktur.js';
import { svPct, svTal } from '../lib/talformat.js';
import { adjektiv, ordForAntal } from '../lib/termer.js';
import { lvParAntal } from '../lib/vymodell-likvardigt-arbete.js';
import { esc } from './01-html-och-tillganglighet.js';
import { rapporteraFel } from './03-hjalpfunktioner.js';
import { ikon } from './03-ikoner.js';
import { kTroskel } from './06-k-troskel.js';
import { T } from './09-termer.js';
import { hamtaData } from './12-tillstand.js';
import { likvardighetResultat } from './34-likvardigt-arbete.js';
import { _laSlutsats, laLikaGrupper } from './41-lika-arbete.js';

// ---- § 8-ställning: bedömning per granskningsområde (in-memory) ----
// § 8 del 1 (bestämmelser & praxis) är kvalitativ. Fliken ger vägledning per
// område; här renderas en bedömnings-kontroll (status + anteckning) i varje
// område. Värdena lever i DOM (som struktur-narrativet) — inget lagras på disk —
// och plockas in i Word-utkastet och utskriften. Fälten injiceras i de statiska
// `.bes8-assess`-platshållarna så HTML-källan hålls torr.
const BES8_STATUS = [
    ['', '— Ej bedömt ännu —'],
    ['Ingen risk identifierad', 'Ingen risk identifierad'],
    ['Möjlig risk – utreds vidare', 'Möjlig risk – utreds vidare'],
    ['Åtgärd krävs', 'Åtgärd krävs'],
    ['Ej tillämplig', 'Ej tillämplig']
];
/** Områdets rubrik: avsnittets titel, utan statusmärket som står bredvid den. */
function _bes8Titel(det, n) {
    const t = det && (det.querySelector('summary .avsnitt-titel') || det.querySelector('summary'));
    return t ? t.textContent.trim() : ('Område ' + n);
}
function _kopplaBes8Bedomning() {
    document.querySelectorAll('.bes8-assess').forEach((host, i) => {
        if (/** @type {HTMLElement} */ (host).dataset.ready) return;
        const n = i + 1;
        const det = host.closest('details');
        const label = _bes8Titel(det, n);
        host.innerHTML =
            `<h4 class="marg-t-12">Din bedömning</h4>`
            + `<p class="text-dampad-xs marg-0-0-4">Sparas i minnet och följer med i Word-utkastet och utskriften.</p>`
            + `<select id="bes8-status-${n}" class="form-select bes8-field" aria-label="Bedömning: ${esc(label)}">`
            + BES8_STATUS.map(([v, l]) => `<option value="${esc(v)}">${esc(l)}</option>`).join('')
            + `</select>`
            + `<textarea id="bes8-note-${n}" class="bes8-field ram-1-kant rund-4 ruta-border typsnitt-arv fs-sm marg-t-6 pad-6-8 bredd-100p" rows="2" autocomplete="off" placeholder="Iakttagelser och eventuell åtgärd — skriv på gruppnivå, inga namn eller personnummer …" aria-label="Anteckning: ${esc(label)}"></textarea>`;
        /** @type {HTMLElement} */ (host).dataset.ready = '1';
    });
}

/** Läser § 8-områdenas titel + bedömning + anteckning från DOM (sorterat). */
export function _bes8Omraden() {
    const out = [];
    document.querySelectorAll('[id^="bes8-status-"]').forEach(sel => {
        const n = sel.id.replace('bes8-status-', '');
        const note = document.getElementById('bes8-note-' + n);
        out.push({ n: Number(n), title: _bes8Titel(sel.closest('details'), n), status: /** @type {HTMLInputElement} */ (sel).value, note: note ? /** @type {HTMLInputElement} */ (note).value.trim() : '' });
    });
    return out.sort((a, b) => a.n - b.n);
}

// ---- Flikens topp: hur många områden som är bedömda, och statusen i varje områdes rubrik ----
// Utan den syns det först i Dokumentera att inget är ifyllt. Uppdateras när en bedömning ändras, när fliken visas,
// när en konfigurationsfil lästs in och när allt rensats.
const BES8_IKON = { 'Ingen risk identifierad': 'bock', 'Möjlig risk – utreds vidare': 'statusVarning', 'Åtgärd krävs': 'statusKritisk', 'Ej tillämplig': 'streck' };
export function bes8Uppdatera() {
    const omraden = _bes8Omraden();
    const antal = s => omraden.filter(a => a.status === s).length;
    const bedomda = omraden.filter(a => a.status).length, atgard = antal('Åtgärd krävs'), risk = antal('Möjlig risk – utreds vidare');
    const topp = document.getElementById('rp-slutsatser');
    if (topp) {
        topp.innerHTML = _laSlutsats('Bedömda områden', `${bedomda} av ${omraden.length}`, bedomda === omraden.length ? 'alla områden är bedömda' : `${omraden.length - bedomda} återstår`)
            + _laSlutsats('Åtgärd krävs', svTal(atgard, 0), atgard ? 'för in åtgärden i Handlingsplan' : 'inget område', atgard > 0)
            + _laSlutsats('Möjlig risk', svTal(risk, 0), risk ? 'utreds vidare' : 'inget område');
    }
    for (const a of omraden) {
        const marke = document.getElementById('nyckel-rp-' + a.n);
        if (!marke) continue;
        marke.innerHTML = a.status ? `${ikon(BES8_IKON[a.status] || 'streck')} ${esc(a.status)}` : 'Ej bedömt';
        marke.classList.toggle('ar-kritisk', a.status === 'Åtgärd krävs');
        marke.classList.toggle('ar-bedomd', !!a.status);
    }
}

// ---- Stöd i verktyget: talet från fliken och en länk dit ----
// Där en flik har ett tal som hör till området (Likvärdigt arbetes par, Lika arbetes yrkesgrupper att granska,
// Lönestrukturens lönekvartiler) står talet i områdets rad Stöd i verktyget, med länken Gå dit. Talen
// hämtas ur samma källor som flikarna själva visar: Likvärdigt arbetes resultat (likvardighetResultat(), som
// Översiktens Att göra också fyller) och de delade funktionerna för yrkesgrupperna och kvartilerna. Utan underlag,
// eller när fliken inte kan räkna, står radens fasta text kvar.
const BES8_STOD = {
    likvardighet(d) {
        const lv = likvardighetResultat();
        if (!lv || !Array.isArray(lv.pairs) || !d.length) return null;
        const { totalt, sakra } = lvParAntal(lv);
        return totalt ? `Likvärdigt arbete har ${svTal(totalt, 0)} par att titta närmare på, ${svTal(sakra, 0)} med säker skillnad.`
            : `Likvärdigt arbete har inget par att titta närmare på: ${adjektiv({ utrum: 'ingen', neutrum: 'inget', plural: 'inga' }, T.jamforelse)} ${T.jamforelse.en} ligger högre.`;
    },
    matrix(d) {
        const rader = laLikaGrupper(d).grupper.filter(g => !g.samladMedian);
        if (!rader.length) return null;
        const granska = rader.filter(g => g.flaggad).length;
        return `Lika arbete har ${svTal(granska, 0)} av ${svTal(rader.length, 0)} ${ordForAntal(rader.length, T.enhet)} i ${T.niva.en} att granska (statistiskt säkerställd skillnad, minst 3 %).`;
    },
    struktur(d) {
        const q = kvartilfordelning(d, { k: kTroskel() }) || [];
        if (!q.length || !q.every(x => x.nKv != null && x.nMa != null && x.n > 0)) return null;
        return `I Lönestruktur är ${svPct(q[q.length - 1].andelKv, 0)} kvinnor i den högsta lönekvartilen och ${svPct(q[0].andelKv, 0)} i den lägsta.`;
    }
};
const BES8_STOD_FLIK = { likvardighet: 'Likvärdigt arbete', matrix: 'Lika arbete', struktur: 'Lönestruktur' };
export function bes8Stod() {
    const d = (() => { try { return hamtaData(); } catch (_e) { return []; } })();
    document.querySelectorAll('.bes8-stod[data-stod]').forEach(el => {
        const li = /** @type {HTMLElement} */ (el), flik = li.dataset.stod || '';
        if (li.dataset.fast == null) li.dataset.fast = li.innerHTML;
        /** @type {string|null} */ let text = null;
        try { text = d.length && BES8_STOD[flik] ? BES8_STOD[flik](d) : null; } catch (e) { rapporteraFel('Regler & praxis: stöd i verktyget', e); }
        li.classList.toggle('bes8-stod-tal', !!text);
        li.innerHTML = text ? `${esc(text)} <a href="#" data-go-to-tab="${esc(flik)}" aria-label="Gå dit: ${esc(BES8_STOD_FLIK[flik] || flik)}">Gå dit</a>` : li.dataset.fast;
    });
}

/** Det som körs vid laddning, i filens ordning; src/app/index.js anropar delarnas uppstart i sifferordning. */
export function uppstartReglerOchPraxis() {
    _kopplaBes8Bedomning();
    document.addEventListener('change', e => { if (/** @type {HTMLElement} */ (e.target).closest && /** @type {HTMLElement} */ (e.target).closest('[id^="bes8-status-"]')) bes8Uppdatera(); });
    bes8Uppdatera();
    bes8Stod();
}

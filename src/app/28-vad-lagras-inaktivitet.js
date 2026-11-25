// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
import { FARG } from './01-farger.js';
import { esc, slappFokus, fangaFokus } from './01-html-och-tillganglighet.js';
import { ikon } from './03-ikoner.js';
import { INAKTIVITET_STANDARD_MIN } from './07-standardinstallningar.js';
import { T } from './09-termer.js';
import { referensKalla, referensNamn, state } from './12-tillstand.js';
import { _fkVantar } from './17-forhandskontroll.js';
import { _rensaAllData, rensaAllData } from './26-rensning.js';
import { stangInstallningar } from './86-installningar.js';

// ---- Vad lagras i minnet just nu? (inbyggt dataskydd, art. 25) ----
/**
 * Visar dialogen Vad lagras?: fälten i state.data, antal rader, ungefärlig minnesstorlek och den första posten som
 * exempel (fältet för AID-etikett kortat), så att användaren ser vad verktyget håller i minnet.
 */
export function oppnaVadLagras() {
    const modal = document.getElementById('data-residency-modal');
    const content = document.getElementById('data-residency-content');
    if (!modal || !content) return;

    const n = state.data.length;
    const policyN = state.policy.length;
    const statN = state.statistik.length;
    // Grov uppskattning av minnesfootprint (JSON-serialisering ger en överskattning av V8-storage)
    const approxBytes = n > 0 ? JSON.stringify(state.data).length : 0;
    const approxKB = Math.round(approxBytes / 1024);
    // Rullistans värden; ett låst värde ur organisationspaketet (ADR-47) finns alltid med, och listan är då låst.
    const last = state.paketLas.inaktivitetMin;
    const val = [...new Set([0, 30, 60, INAKTIVITET_STANDARD_MIN, 120, ...(last != null ? [last] : [])])].sort((a, b) => a - b);

    // Fältets namn i minnet (en nyckel, som bas och lon) visas som kod; det byts inte med termerna (ADR-74).
    const FALT_YRKE = 'yrke';
    let sampleRow = '';
    if (n > 0) {
        const r = state.data[0];
        const maskedYrke = r.yrke && r.yrke.length > 30 ? r.yrke.substring(0, 30) + '…' : (r.yrke || '—');
        sampleRow = `
            <h3 class="fs-md marg-t-18">Exempel — första posten (fältet för ${T.enhet.en} kortat)</h3>
            <table class="data-table st-085">
                <thead><tr><th>Fält</th><th>Värde</th><th>Källa</th></tr></thead>
                <tbody>
                    <tr><td><code>bas</code></td><td>${esc(r.bas) || '—'}</td><td>${T.niva.en} (1 bokstav)</td></tr>
                    <tr><td><code>${FALT_YRKE}</code></td><td>${esc(maskedYrke)}</td><td>${T.kod.en} + högst 40 tecken ${T.namn.en}; namn i fältet maskeras inte, inläsningen varnar för dem</td></tr>
                    <tr><td><code>lon</code></td><td>${r.lon ? Math.round(r.lon).toLocaleString('sv-SE') : '—'} kr</td><td>månadslön, heltal</td></tr>
                    <tr><td><code>alder</code></td><td>${r.alder || '—'}</td><td>år</td></tr>
                    <tr><td><code>kon</code></td><td>${esc(r.kon) || '—'}</td><td>"kvinna"/"man"</td></tr>
                    <tr><td><code>radnr</code></td><td>${r.radnr ?? '—'}</td><td>radnummer i lönefilen, för att slå upp en person i Personer att granska</td></tr>
                </tbody>
            </table>`;
    }

    content.innerHTML = `
        <div class="lh-1_6">
            <p><strong>Datafotavtryck just nu</strong></p>
            <ul class="marg-0-0-14-20">
                <li>Lönefilen: <strong>${n.toLocaleString('sv-SE')}</strong> rader (~${approxKB} KB i minnet)</li>
                <li>Referens: ${esc(referensNamn())}${esc(referensKalla())}: <strong>${policyN}</strong> rader</li>
                <li>Jämförelsestatistik: <strong>${statN}</strong> rader</li>
                ${_fkVantar ? '<li>En lönefil väntar på Läs in i förhandskontrollen: den hålls i minnet men är inte inläst, och Rensa all data eller rensningen vid inaktivitet släpper den.</li>' : ''}
                <li>Lagring på disk: <strong>0 byte</strong> (inget skrivs till localStorage, IndexedDB eller cookies)</li>
                <li>Nätverkstrafik: <strong>0 byte</strong> (CSP <code>connect-src 'none'</code> blockerar all utgående trafik)</li>
            </ul>
            <p><strong>Fälten som sparas per rad</strong></p>
            <p class="marg-0-0-6">Verktyget läser bara fem fält ur filen: ${T.niva.en}, ${T.enhet.en}, lön, ålder och kön, plus valfri arbetsvärderingspoäng och valfri ansvarskod enligt AID. Det noterar också radens nummer i filen. Allt annat (personnummer, namn, e-post, anställningsnummer, fri text utöver ${T.namn.bf}) tas bort vid inläsningen och sparas aldrig.</p>
            ${sampleRow}
            <p class="bak-ok-yta rund-4 fs-sm marg-t-18 pad-10-14">
                <strong>Inbyggt dataskydd enligt dataskyddsförordningen:</strong> uppgifterna minimeras innan de sparas i minnet, inte efter. Filen läses in i minnet, raderna minimeras en i taget, och filens övriga innehåll släpps när inläsningen är klar.
            </p>

            <!-- Inaktivitetstimer-inställning -->
            <h3 class="fs-md marg-t-18">Automatisk sessionsrensning vid inaktivitet</h3>
            <p class="text-dampad-sm marg-0-0-8">
                Skyddar om du lämnar datorn olåst. När tiden har gått får du en varning och kan förlänga. Svarar du inte inom 60 sekunder rensas allt, som med knappen Rensa all data.
            </p>
            <div class="rad-bryt-mitt gap-10">
                <label for="inactivity-timeout-select" class="fs-sm fw-600">Rensa efter:</label>
                <select id="inactivity-timeout-select" class="ram-1-kant rund-4 pad-4-10"${last != null ? ' disabled aria-describedby="inactivity-last"' : ''}>
                    ${val.map(m => `<option value="${m}"${state.inactivityTimeoutMin === m ? ' selected' : ''}>${m === 0 ? 'Av' : `${m} minuter`}${m === INAKTIVITET_STANDARD_MIN ? ' (standard)' : ''}</option>`).join('')}
                </select>
                <span id="inactivity-status" class="text-dampad-xs">
                    ${state.inactivityTimeoutMin > 0 ? 'Aktiv (' + state.inactivityTimeoutMin + ' min)' : 'Av'}
                </span>
            </div>
            <p id="inactivity-last" class="k-mask-note" role="status"${last == null ? ' hidden' : ''}>Låst till ${last} minuter av organisationspaketet${state.paket ? ` från ${esc(state.paket.organisation)}` : ''}: systemförvaltaren har bestämt tiden, så den kan inte ändras här.</p>
        </div>`;

    modal.style.display = 'flex';   // som övriga modaler: .glossary-modal centrerar sin panel
    if (typeof fangaFokus === 'function') fangaFokus(modal);
}

// ---- Inaktivitetstimer med tvåfas-varning ----
//
// Aktivitet (mus, tangentbord, rullning, pekskärm) flyttar fram tiden. En minut före den inställda tiden visas en
// varning; svarar ingen inom 60 sekunder rensas allt, som med Rensa all data men utan bekräftelsefrågan.
//
// På som standard (90 minuter: dataskydd som standard enligt GDPR art. 25.2, med en tid som inte avbryter ett normalt
// arbetspass). Tiden ändras eller stängs av i dialogen Vad lagras?.
// Tiden räknas på klockan (Date.now), inte med en lång setTimeout: webbläsarens timer står ofta still medan datorn
// sover, och en dator som öppnas efter timmar visade annars underlaget tills resten av tiden gått. Intervallet prövar
// klockan; det står också still under sömnen men prövar igen så snart datorn vaknar.
const _INAKTIVITET_PROV_MS = 15 * 1000;
/** @type {ReturnType<typeof setInterval>|null} */
let _inaktivitetstimer  = null;
/** Klockan vid senaste aktiviteten. */
let _sistaAktivitet = 0;
/** @type {ReturnType<typeof setInterval>|null} */
let _inaktivitetsvarningTimer = null;
/** @type {HTMLElement|null} */
let _inaktivitetsvarningElement     = null;

function _doljInaktivitetsvarning() {
    if (_inaktivitetsvarningElement) {
        _inaktivitetsvarningElement.remove();
        _inaktivitetsvarningElement = null;
    }
    if (_inaktivitetsvarningTimer) {
        clearInterval(_inaktivitetsvarningTimer);
        _inaktivitetsvarningTimer = null;
    }
}

function _visaInaktivitetsvarning() {
    if (_inaktivitetsvarningElement) return;  // redan visad
    const warn = document.createElement('div');
    warn.className = 'inactivity-warn-overlay';
    warn.setAttribute('role', 'alertdialog');
    warn.setAttribute('aria-modal', 'true');
    warn.innerHTML = `
        <div class="inactivity-warn-panel">
            <h2 class="fs-lg marg-0-0-10">Sessionen håller på att gå ut</h2>
            <p class="fs-md lh-1_55">
                Verktyget har varit inaktivt i ${state.inactivityTimeoutMin} minuter. För att skydda känsliga uppgifter rensas minnet om <strong id="inactivity-countdown">60</strong> sekunder. Det går inte att ångra.
            </p>
            <p class="text-dampad-sm marg-0-0-14">
                Är du fortfarande vid din arbetsstation?
            </p>
            <div class="rad gap-10 slutjusterad">
                <button type="button" id="inactivity-clear-now" class="btn btn-secondary btn-sm">Rensa nu</button>
                <button type="button" id="inactivity-extend"    class="btn btn-primary   btn-sm">Förläng sessionen</button>
            </div>
        </div>`;
    document.body.appendChild(warn);
    _inaktivitetsvarningElement = warn;

    // 60 s nedräkning mot en sluttid: en flik som inte syns får sina intervall strypta (upp till ett tick per minut),
    // så tick räknas inte, utan tiden som gått.
    const slut = Date.now() + 60 * 1000;
    const countdownEl = warn.querySelector('#inactivity-countdown');
    _inaktivitetsvarningTimer = setInterval(() => {
        const secondsLeft = Math.max(0, Math.ceil((slut - Date.now()) / 1000));
        if (countdownEl) countdownEl.textContent = String(secondsLeft);
        if (secondsLeft <= 0) {
            _rensaVidInaktivitet();
        }
    }, 1000);

    warn.querySelector('#inactivity-clear-now')?.addEventListener('click', () => {
        _rensaVidInaktivitet();
    });
    warn.querySelector('#inactivity-extend')?.addEventListener('click', () => {
        _doljInaktivitetsvarning();
        _aterstallInaktivitetstimer();
    });
}

function _rensaVidInaktivitet() {
    _doljInaktivitetsvarning();
    const hadData = _harNagotAttRensa();
    // Samma rensning som knappen, utan bekräftelsefrågan (ingen finns vid datorn).
    _rensaAllData();
    if (hadData) {
        // En notis som står kvar, så att användaren ser vad som hände vid återkomsten
        const notice = document.createElement('div');
        notice.style.cssText = `position:fixed; top:20px; right:20px; background:${FARG.text}; color:white; padding:14px 18px; border-radius:8px; box-shadow:0 4px 14px rgba(0,0,0,0.25); z-index:99999; max-width:340px; font-size:0.88rem; line-height:1.5;`;
        notice.innerHTML = `<strong>${ikon('klocka')} Sessionen rensades</strong><br>Av säkerhetsskäl har all data raderats efter inaktivitet. Läs in filerna på nytt för att fortsätta. <button data-dismiss-parent class="bak-transparent ram-1-white rund-4 farg-white pekare marg-v-8 pad-2-8">OK</button>`;
        document.body.appendChild(notice);
        setTimeout(() => { if (notice.parentNode) notice.remove(); }, 30000);
    }
}

const _harNagotAttRensa = () => state.data.length > 0 || !!_fkVantar || !!state.forhandskontroll;   // en väntande fil och en förhandskontroll på skärmen rensas också

/**
 * Prövar klockan mot senaste aktiviteten. Har hela tiden gått rensas allt direkt (datorn har sovit förbi varningen);
 * har allt utom den sista minuten gått visas varningen. Sant när något av det gjordes.
 */
function _provaInaktivitet() {
    if (!_inaktivitetstimer || _inaktivitetsvarningElement || state.inactivityTimeoutMin <= 0) return false;
    if (!_harNagotAttRensa()) { clearInterval(_inaktivitetstimer); _inaktivitetstimer = null; return false; }
    const gatt = Date.now() - _sistaAktivitet, tid = state.inactivityTimeoutMin * 60 * 1000;
    if (gatt >= tid) { _rensaVidInaktivitet(); return true; }
    if (gatt >= tid - 60 * 1000) { _visaInaktivitetsvarning(); return true; }
    return false;
}

export function _aterstallInaktivitetstimer() {
    if (_inaktivitetstimer) {
        clearInterval(_inaktivitetstimer);
        _inaktivitetstimer = null;
    }
    if (state.inactivityTimeoutMin <= 0) return;
    if (!_harNagotAttRensa()) return;
    _sistaAktivitet = Date.now();
    _inaktivitetstimer = setInterval(_provaInaktivitet, _INAKTIVITET_PROV_MS);
}

// Ett värde låst av organisationspaketet (ADR-47) gäller oavsett vad som begärs.
export function sattInaktivitetstid(minutes) {
    const last = state.paketLas.inaktivitetMin;
    state.inactivityTimeoutMin = last != null ? last : Math.max(0, parseInt(minutes, 10) || 0);
    _doljInaktivitetsvarning();
    _aterstallInaktivitetstimer();
}

/** Det som körs vid laddning, i filens ordning; src/app/index.js anropar delarnas uppstart i sifferordning. */
export function uppstartVadLagrasInaktivitet() {
    // Knappen står i panelen Inställningar. Har rensningen gjorts stängs panelen, och Översikt visas som uppladdningssida.
    document.getElementById('btn-clear-all-data')?.addEventListener('click', () => {
        rensaAllData();
        if (!state.data.length && typeof stangInstallningar === 'function') stangInstallningar();
    });
    document.getElementById('btn-data-residency')?.addEventListener('click', oppnaVadLagras);
    // Tidsväljaren ritas om vid varje öppning; lyssnaren sitter på innehållet en gång och gäller hur dialogen än öppnas (även från sökningen).
    document.getElementById('data-residency-content')?.addEventListener('change', e => {
        const sel = /** @type {HTMLSelectElement} */ (e.target);
        if (sel.id !== 'inactivity-timeout-select') return;
        const min = parseInt(sel.value, 10) || 0;
        sattInaktivitetstid(min);
        const status = document.getElementById('inactivity-status');
        if (status) status.textContent = min > 0 ? `Aktiv (${min} min)` : 'Av';
    });
    // Aktivitetslyssnarna registreras en gång (passiva)
    ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'click'].forEach(evt => {
        window.addEventListener(evt, () => {
            // Klockan prövas först: den som rör musen efter att datorn sovit förbi tiden förlänger inte sessionen.
            if (state.inactivityTimeoutMin <= 0 || _inaktivitetsvarningElement || _provaInaktivitet()) return;
            if (_inaktivitetstimer) _sistaAktivitet = Date.now(); else _aterstallInaktivitetstimer();
        }, { passive: true });
    });
    document.getElementById('data-residency-close')?.addEventListener('click', () => {
        const m = document.getElementById('data-residency-modal');
        if (m) { if (typeof slappFokus === 'function') slappFokus(m); m.style.display = 'none'; }
    });
    document.getElementById('data-residency-modal')?.addEventListener('click', e => {
        if (/** @type {HTMLElement} */ (e.target).classList.contains('glossary-backdrop')) {
            const m = document.getElementById('data-residency-modal');
            if (m) { if (typeof slappFokus === 'function') slappFokus(m); m.style.display = 'none'; }
        }
    });
}

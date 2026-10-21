// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson

// ---- Vad lagras i minnet just nu? (inbyggt dataskydd, art. 25) ----
/**
 * Visar Data Residency-modal: schemat för state.data, antal rader, ungefärlig
 * minnesstorlek, och en maskerad sample av första posten. Ger användaren
 * konkret insyn i exakt vad verktyget håller i RAM.
 */

function openDataResidency() {
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
    const val = [...new Set([0, 15, INAKTIVITET_STANDARD_MIN, 60, ...(last != null ? [last] : [])])].sort((a, b) => a - b);

    let sampleRow = '';
    if (n > 0) {
        const r = state.data[0];
        const maskedYrke = r.yrke && r.yrke.length > 30 ? r.yrke.substring(0, 30) + '…' : (r.yrke || '—');
        sampleRow = `
            <h3 class="fs-md marg-t-18">Exempel — första posten (maskerad)</h3>
            <table class="data-table st-085">
                <thead><tr><th>Fält</th><th>Värde</th><th>Källa</th></tr></thead>
                <tbody>
                    <tr><td><code>bas</code></td><td>${esc(r.bas) || '—'}</td><td>BAS-intervall (1 bokstav)</td></tr>
                    <tr><td><code>yrke</code></td><td>${esc(maskedYrke)}</td><td>AID-kod + 40 tecken etikett, namn-mönster maskeras</td></tr>
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
                <li>Strukturdata: <strong>${n.toLocaleString('sv-SE')}</strong> rader (~${approxKB} KB i minnet)</li>
                <li>Referens: ${esc(referensNamn())}${esc(referensKalla())}: <strong>${policyN}</strong> rader</li>
                <li>Jämförelsestatistik: <strong>${statN}</strong> rader</li>
                <li>Lagring på disk: <strong>0 byte</strong> (inget skrivs till localStorage, IndexedDB eller cookies)</li>
                <li>Nätverkstrafik: <strong>0 byte</strong> (CSP <code>connect-src 'none'</code> blockerar all utgående trafik)</li>
            </ul>
            <p><strong>Schema (vitlistade fält per rad)</strong></p>
            <p class="marg-0-0-6">Verktyget extraherar enbart fem fält ur din fil — BAS, yrke, lön, ålder och kön, plus valfri arbetsvärderingspoäng och valfri ansvarskod enligt AID — och noterar radens nummer i filen. Allt annat — personnummer, namn, e-post, anställningsnummer, fri text bortom yrkesetiketten — droppas vid inläsning och når aldrig den interna datastrukturen.</p>
            ${sampleRow}
            <p class="bak-ok-yta ram-v-3-ok rund-4 fs-sm marg-t-18 pad-10-14">
                <strong>Inbyggt dataskydd (art. 25):</strong> minimering sker innan datan landar i state — inte efter. Filen läses in i minnet, raderna minimeras en i taget, och filens övriga innehåll släpps när inläsningen är klar.
            </p>

            <!-- Inaktivitetstimer-inställning -->
            <h3 class="fs-md marg-t-18">Automatisk sessionsrensning vid inaktivitet</h3>
            <p class="text-dampad-sm marg-0-0-8">
                Skydd mot scenariot där du lämnar arbetsstationen olåst. Vid vald timeout visas en varning med möjlighet att förlänga sessionen — om du inte svarar inom 60 sekunder rensas all data automatiskt (motsvarande "Rensa all data"-knappen).
            </p>
            <div class="rad-bryt-mitt gap-10">
                <label for="inactivity-timeout-select" class="fs-sm fw-600">Timeout:</label>
                <select id="inactivity-timeout-select" class="ram-1-kant rund-4 pad-4-10"${last != null ? ' disabled aria-describedby="inactivity-last"' : ''}>
                    ${val.map(m => `<option value="${m}"${state.inactivityTimeoutMin === m ? ' selected' : ''}>${m === 0 ? 'Av' : `${m} minuter`}${m === INAKTIVITET_STANDARD_MIN ? ' (standard)' : ''}</option>`).join('')}
                </select>
                <span id="inactivity-status" class="text-dampad-xs">
                    ${state.inactivityTimeoutMin > 0 ? 'Aktiv (' + state.inactivityTimeoutMin + ' min)' : 'Av'}
                </span>
            </div>
            <p id="inactivity-last" class="k-mask-note" role="status"${last == null ? ' hidden' : ''}>Låst till ${last} minuter av organisationspaketet${state.paket ? ` från ${esc(state.paket.organisation)}` : ''}: systemägaren har bestämt tiden, så den kan inte ändras här.</p>
        </div>`;

    modal.style.display = 'flex';   // som övriga modaler: .glossary-modal centrerar sin panel
    if (typeof trapFocus === 'function') trapFocus(modal);
}

// Knappen står i panelen Inställningar. Har rensningen gjorts stängs panelen, och Översikt visas som uppladdningssida.
document.getElementById('btn-clear-all-data')?.addEventListener('click', () => {
    clearAllData();
    if (!state.data.length && typeof stangInstallningar === 'function') stangInstallningar();
});
document.getElementById('btn-data-residency')?.addEventListener('click', () => {
    openDataResidency();
    // Bind dropdown efter att modalen renderats
    setTimeout(() => {
        const sel = document.getElementById('inactivity-timeout-select');
        if (sel) sel.addEventListener('change', e => {
            const min = parseInt(/** @type {HTMLInputElement} */ (e.target).value, 10) || 0;
            setInactivityTimeout(min);
            const status = document.getElementById('inactivity-status');
            if (status) status.textContent = min > 0 ? `Aktiv (${min} min)` : 'Av';
        });
    }, 50);
});

// ---- Inaktivitetstimer med tvåfas-varning ----
//
// Lyssnar på användaraktivitet (mus/tangentbord/scroll/touch) och nollställer
// timern. När timern når X% av timeout visas en modal som ber användaren
// bekräfta att de fortfarande är där — om ingen reaktion inom 60 s rensas data
// (motsvarande clearAllData utan confirm-prompt).
//
// På som standard (30 minuter, dataskydd som standard enligt GDPR art. 25.2). HR kan
// ändra eller stänga av det i "Vad lagras?"-modalen.
/** @type {ReturnType<typeof setTimeout>|null} */
let _inactivityIdleTimer  = null;
/** @type {ReturnType<typeof setInterval>|null} */
let _inactivityWarningTimer = null;
/** @type {HTMLElement|null} */
let _inactivityWarnEl     = null;

function _hideInactivityWarning() {
    if (_inactivityWarnEl) {
        _inactivityWarnEl.remove();
        _inactivityWarnEl = null;
    }
    if (_inactivityWarningTimer) {
        clearTimeout(_inactivityWarningTimer);
        _inactivityWarningTimer = null;
    }
}

function _showInactivityWarning() {
    if (_inactivityWarnEl) return;  // redan visad
    const warn = document.createElement('div');
    warn.className = 'inactivity-warn-overlay';
    warn.setAttribute('role', 'alertdialog');
    warn.setAttribute('aria-modal', 'true');
    warn.innerHTML = `
        <div class="inactivity-warn-panel">
            <h2 class="fs-lg marg-0-0-10">Sessionen håller på att gå ut</h2>
            <p class="fs-md lh-1_55">
                Verktyget har varit inaktivt i ${state.inactivityTimeoutMin} minuter. För att skydda känsliga uppgifter rensar vi tillfälligt minnet om <strong id="inactivity-countdown">60</strong> sekunder.
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
    _inactivityWarnEl = warn;

    // 60 s nedräkning
    let secondsLeft = 60;
    const countdownEl = warn.querySelector('#inactivity-countdown');
    _inactivityWarningTimer = setInterval(() => {
        secondsLeft--;
        if (countdownEl) countdownEl.textContent = String(secondsLeft);
        if (secondsLeft <= 0) {
            _autoClearOnInactivity();
        }
    }, 1000);

    warn.querySelector('#inactivity-clear-now')?.addEventListener('click', () => {
        _autoClearOnInactivity();
    });
    warn.querySelector('#inactivity-extend')?.addEventListener('click', () => {
        _hideInactivityWarning();
        _resetInactivityTimer();
    });
}

function _autoClearOnInactivity() {
    _hideInactivityWarning();
    const hadData = state.data.length > 0;
    // Samma rensning som knappen, utan bekräftelsefrågan (ingen finns vid datorn).
    _rensaAllData();
    if (hadData) {
        // Liten persistent notis så användaren förstår vad som hände när de kommer tillbaka
        const notice = document.createElement('div');
        notice.style.cssText = `position:fixed; top:20px; right:20px; background:${FARG.text}; color:white; padding:14px 18px; border-radius:8px; box-shadow:0 4px 14px rgba(0,0,0,0.25); z-index:99999; max-width:340px; font-size:0.88rem; line-height:1.5;`;
        notice.innerHTML = `<strong>${ikon('klocka')} Sessionen rensades</strong><br>Av säkerhetsskäl har all data raderats efter inaktivitet. Ladda upp dina filer på nytt för att fortsätta. <button data-dismiss-parent class="bak-transparent ram-1-white rund-4 farg-white pekare marg-v-8 pad-2-8">OK</button>`;
        document.body.appendChild(notice);
        setTimeout(() => { if (notice.parentNode) notice.remove(); }, 30000);
    }
}

function _resetInactivityTimer() {
    if (_inactivityIdleTimer) {
        clearTimeout(_inactivityIdleTimer);
        _inactivityIdleTimer = null;
    }
    if (state.inactivityTimeoutMin <= 0) return;
    if (state.data.length === 0) return;
    // Visa varningen 60 s INNAN total timeout
    const warnAfterMs = Math.max(0, state.inactivityTimeoutMin * 60 * 1000 - 60 * 1000);
    _inactivityIdleTimer = setTimeout(_showInactivityWarning, warnAfterMs);
}

// Ett värde låst av organisationspaketet (ADR-47) gäller oavsett vad som begärs.
function setInactivityTimeout(minutes) {
    const last = state.paketLas.inaktivitetMin;
    state.inactivityTimeoutMin = last != null ? last : Math.max(0, parseInt(minutes, 10) || 0);
    _hideInactivityWarning();
    _resetInactivityTimer();
}

// Registrera aktivitets-lyssnare en gång — billiga (passive)
['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'click'].forEach(evt => {
    window.addEventListener(evt, () => {
        // Bara reset om timern är igång (annars onödig CPU)
        if (state.inactivityTimeoutMin > 0 && !_inactivityWarnEl) _resetInactivityTimer();
    }, { passive: true });
});
document.getElementById('data-residency-close')?.addEventListener('click', () => {
    const m = document.getElementById('data-residency-modal');
    if (m) { if (typeof releaseFocus === 'function') releaseFocus(m); m.style.display = 'none'; }
});
document.getElementById('data-residency-modal')?.addEventListener('click', e => {
    if (/** @type {HTMLElement} */ (e.target).classList.contains('glossary-backdrop')) {
        const m = document.getElementById('data-residency-modal');
        if (m) { if (typeof releaseFocus === 'function') releaseFocus(m); m.style.display = 'none'; }
    }
});

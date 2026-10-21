// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
// ---- Organisationspaket (ADR-28) ----
// En systemägare samlar organisationens benämningar, grundinställningar, lönepolitiska
// ställningstagande och jämförelsestatistik i en fil (skapaPaket); handläggarna läser in
// den i ett steg (lasInPaket). Tolkning och validering bor i src/lib/organisationspaket.js
// (_opTolkaPaket / _opByggPaket). Paketet lagras aldrig — det läses in varje session.

const PAKET_MAX_FILSTORLEK = 5 * 1024 * 1024;   // samma gräns som i src/lib/organisationspaket.js
// Rensning vid inaktivitet i paketet: 0 (av) eller 5–120 minuter (samma gränser som i src/lib/organisationspaket.js).
const PAKET_INAKTIVITET_MIN = 5;
const PAKET_INAKTIVITET_MAX = 120;

/** Låsningarna utan något satt (ADR-47). */
function _paketLasStandard() { return { kTroskelLagst: null, inaktivitetMin: null, smaGrupperIExport: true }; }

/** Låsningarna i ord, för faktarutan och paketformulärets sammanfattning. Tom sträng när inget är låst. */
function _paketLasText(las) {
    return [
        las.kTroskelLagst != null ? `minsta gruppstorlek lägst ${las.kTroskelLagst}` : null,
        las.inaktivitetMin != null ? `rensning vid inaktivitet låst till ${las.inaktivitetMin} minuter` : null,
        las.smaGrupperIExport === false ? 'små grupper tas aldrig med i Utforskas export' : null,
    ].filter(Boolean).join(', ');
}

// Prioriteringens fält för PO-påslag och period speglar state.costSettings; annars skriver
// nästa ändring i fälten tillbaka de gamla värdena.
function _synkaKostnadsfalt() {
    const po = document.getElementById('prio-po-pct');
    const man = document.getElementById('prio-cost-months');
    if (po) /** @type {HTMLInputElement} */ (po).value = state.costSettings.poPct;
    if (man) /** @type {HTMLInputElement} */ (man).value = String(state.costSettings.months);
    if (typeof _readCostSettings === 'function') _readCostSettings();
}

// Tar bort jämförelsestatistiken (när ett nytt paket saknar den eller vid rensning).
function _tomStatistik() {
    state.statistik = [];
    state.statistikNamn = null;
    state.statistikKalla = null;
    state.statistikHasP10 = false;
    state.statistikHasP90 = false;
    state.statistikHasKon = false;
    if (typeof resetUploadCell === 'function') resetUploadCell('upload-cell-stat', 'upload-cell optional', 'Valfritt');
    const ss = document.getElementById('stat-status');
    if (ss) { ss.textContent = ''; ss.className = 'status-msg'; }
    if (typeof _visaJamforelseFlik === 'function') _visaJamforelseFlik(false);
}

function _paketStatus(text, ok) {
    const el = document.getElementById('paket-status');
    if (!el) return;
    el.textContent = text;
    el.className = 'status-msg' + (ok ? ' success' : '');
}

// Faktarutan under knappen: vilket paket som är inläst och vad det innehöll.
function renderPaketInfo() {
    const el = document.getElementById('paket-info');
    if (!el) return;
    const p = state.paket;
    if (!p) { el.hidden = true; el.innerHTML = ''; return; }
    const innehall = [
        state.policyKalla === 'paket' ? `ställningstagande ${state.policy.length} rader` : null,
        state.statistikKalla === 'paket' ? `jämförelsestatistik ${state.statistik.length} rader` : null,
    ].filter(Boolean).join(', ') || 'bara benämningar och inställningar';
    const rad = (dt, dd) => (dd == null || dd === '' ? '' : `<dt>${esc(dt)}</dt><dd>${esc(String(dd))}</dd>`);
    // Organisationsfil: paketet är inbakat i den här filen, eller ersatt av en inläst fil (organisationsfil-design.md §3).
    const inb = state.paketInbakat;
    const kalla = p.kalla === 'inbakat' ? `Inbakat i den här filen (skapad ${inb?.skapad || '–'})`
        : inb ? 'Inläst fil — ersätter det inbakade paketet för den här sessionen' : null;
    el.innerHTML = `<dl>${rad('Organisation', p.organisation)}${rad('Utgivare', p.utgivare)}${rad('Skapat', p.skapat)}`
        + `${rad('Avser år', p.avserAr)}${rad('Innehåll', innehall)}${rad('Låsningar', _paketLasText(state.paketLas))}${rad('Källa', kalla)}</dl>`
        + (p.kalla === 'inbakat' ? `<p class="paket-knappar"><button type="button" id="btn-paket-visa" class="btn btn-secondary btn-sm">Visa paketet</button> `
            + `<button type="button" id="btn-paket-ladda-ner" class="btn btn-secondary btn-sm">Ladda ner paketet</button></p>` : '');
    el.hidden = false;
}

/**
 * Läser in ett organisationspaket (filens text). Ett felaktigt paket ändrar ingenting.
 * @returns {{ok:boolean, meddelande:string}}
 */
function lasInPaket(text, _filnamn, { inbakat = false } = {}) {
    const r = _opTolkaPaket(text);
    if (!r.ok) {
        _paketStatus('' + r.fel, false);
        return { ok: false, meddelande: r.fel };
    }
    // Ett riktigt paket blandas inte med påhittade demosiffror: demot avslutas först.
    if (state.isDemo) _rensaAllData({ inbakat: false });

    const { profil, installningar, referens, statistik } = r.delar;
    const varningar = [...r.varningar];
    // Golvet för tröskeln (ADR-47): ett nytt paket får sänka eller ta bort det förra paketets golv bara om
    // användaren bekräftar — samma fråga som vid en sänkt tröskel. Nekas den står det gamla golvet kvar.
    const gammaltGolv = state.paketLas.kTroskelLagst;
    let nyttGolv = installningar.kTroskelLagst ?? null;
    if (gammaltGolv != null && (nyttGolv == null || nyttGolv < gammaltGolv)
        && !confirm(`Sänka lägsta tillåtna minsta gruppstorlek från ${gammaltGolv} till ${nyttGolv ?? 'ingen gräns'}?\n\n`
            + `Det inlästa organisationspaketet hindrar att minsta gruppstorlek sätts under ${gammaltGolv}. Det nya paketet `
            + (nyttGolv == null ? 'anger ingen gräns' : `anger ${nyttGolv}`) + `. I så små grupper kan enskildas löner räknas fram.`)) {
        nyttGolv = gammaltGolv;
        varningar.push(`Det förra paketets lägsta tillåtna minsta gruppstorlek ${gammaltGolv} behålls.`);
    }
    // Ett nytt paket ersätter det förra helt: det förras delar och grundinställningar får inte
    // stå kvar och tillskrivas det nya. Delar ur egna filer står kvar.
    if (state.paket) {
        state.costSettings = { ...state.costSettings, poPct: COST_DEFAULTS.poPct, months: COST_DEFAULTS.months };
        state.paketLas = _paketLasStandard();
        setInactivityTimeout(INAKTIVITET_STANDARD_MIN);
        if (!referens && state.policyKalla === 'paket') {
            aterstallReferens();
            if (typeof resetUploadCell === 'function') resetUploadCell('upload-cell-policy', 'upload-cell optional', 'Valfritt');
            const ps = document.getElementById('policy-status');
            if (ps) { ps.textContent = ''; ps.className = 'status-msg'; }
        }
        if (!statistik && state.statistikKalla === 'paket') _tomStatistik();
    }
    state.profile = { ...DEFAULT_PROFILE, ...profil };
    if (installningar.poPct != null) state.costSettings.poPct = installningar.poPct;
    if (installningar.months != null) state.costSettings.months = installningar.months;
    // Låsningarna (ADR-47) sätts före tröskeln, så att sattKTroskel() prövar paketets eget värde mot golvet.
    state.paketLas = { kTroskelLagst: nyttGolv, inaktivitetMin: installningar.inaktivitetLast ? installningar.inaktivitetMin : null,
                       smaGrupperIExport: installningar.smaGrupperIExport !== false };
    if (installningar.inaktivitetMin != null) setInactivityTimeout(installningar.inaktivitetMin);
    if (typeof explorerSynkaSmaLas === 'function') explorerSynkaSmaLas();
    // ADR-38: frågar vid sänkning under standard; nekad bekräftelse behåller värdet.
    // Omritningen görs en gång, sist (se nedan), eftersom paketet ändrar mer än tröskeln.
    let kAndrad = false;
    if (installningar.kTroskel != null) {
        const kr = sattKTroskel(installningar.kTroskel, { rita: false });
        kAndrad = kr.andrad === true;
        if (!kr.ok && kr.fel) varningar.push(`Paketets minsta gruppstorlek ${installningar.kTroskel} används inte: ${kr.fel}`);
    }
    // Gällande tröskel får inte ligga under golvet: den höjs (en höjning kräver ingen bekräftelse).
    if (nyttGolv != null && kTroskel() < nyttGolv) {
        kAndrad = sattKTroskel(nyttGolv, { fraga: false, rita: false }).andrad === true || kAndrad;
        varningar.push(`Minsta gruppstorlek höjs till ${nyttGolv}, paketets lägsta tillåtna.`);
    }
    state.paket = { ...r.paket, kalla: inbakat ? 'inbakat' : 'fil' };

    if (referens) {
        state.policy = referens.rader.map(x => ({ ...x }));
        state.policyNamn = referens.namn || 'Lönepolitiskt ställningstagande';
        state.policyKortnamn = referens.kortnamn || state.policyNamn;
        state.policyKalla = 'paket';
        markUploadLoaded('upload-cell-policy', 'Från organisationspaketet');
        const ps = document.getElementById('policy-status');
        if (ps) { ps.textContent = `${state.policy.length} rader ur organisationspaketet`; ps.className = 'status-msg success'; }
    }
    if (statistik) {
        state.statistik = statistik.rader.map(x => ({ ...x }));
        state.statistikNamn = statistik.namn || 'Jämförelsestatistik';
        state.statistikKalla = 'paket';
        state.statistikHasP10 = state.statistik.some(x => x.p10 > 0);
        state.statistikHasP90 = state.statistik.some(x => x.p90 > 0);
        state.statistikHasKon = state.statistik.some(x => x.andelKv != null);
        markUploadLoaded('upload-cell-stat', 'Från organisationspaketet');
        const ss = document.getElementById('stat-status');
        if (ss) { ss.textContent = `${state.statistik.length} poster ur organisationspaketet`; ss.className = 'status-msg success'; }
        _visaJamforelseFlik(true);
    }

    applyProfileLabels();
    synkaNamnFalt();
    _synkaOrgTyp();
    _synkaKostnadsfalt();
    _fyllPaketFormular();
    invalidateStatCaches();
    renderReferensKort();
    renderPaketInfo();
    renderConsistencyBanner();
    // Ändrad tröskel: varje flik och hela Översikt ritas om (det täcker raderna i else-grenen).
    if (kAndrad && state.data.length) { populateSelects(); _renderaOmAllaFlikar(); }
    else { updateCompliance(); renderActionChecklist(); renderProcessTracker(); refreshCurrentTab(); }

    const meddelande = `Organisationspaket från ${r.paket.organisation} inläst.`
        + (varningar.length ? ' ' + varningar.join(' ') : '');
    _paketStatus(meddelande, true);
    announceToScreenReader(meddelande);
    return { ok: true, meddelande };
}

// ---- Skapa paket (systemägaren) ----

const _paketFalt = id => document.getElementById(id);
const _paketText = id => (/** @type {HTMLInputElement} */ (_paketFalt(id))?.value || '').trim();
const _paketTal = id => { const v = parseFloat(String(/** @type {HTMLInputElement} */ (_paketFalt(id))?.value ?? '').replace(',', '.')); return Number.isFinite(v) ? v : undefined; };

// Formuläret förifylls med det som gäller nu (ett inläst paket eller verktygets standard).
function _fyllPaketFormular() {
    const satt = (id, v) => { const el = _paketFalt(id); if (el && document.activeElement !== el) /** @type {HTMLInputElement} */ (el).value = v ?? ''; };
    const p = state.paket;
    satt('paket-org', p ? p.organisation : '');
    satt('paket-utgivare', p ? p.utgivare : '');
    satt('paket-ar', p ? p.avserAr : new Date().getFullYear());
    satt('paket-jamf-namn', state.profile.benchmarkLabel === DEFAULT_PROFILE.benchmarkLabel ? '' : state.profile.benchmarkLabel);
    satt('paket-jamf-genitiv', state.profile.benchmarkLabelGenitive === DEFAULT_PROFILE.benchmarkLabelGenitive ? '' : state.profile.benchmarkLabelGenitive);
    // Ställningstagandets namn: det som gäller nu (ur fil, paket eller namnfältet), så att paketet inte
    // tyst bär ett filnamn som "2026 lonepol.csv" vidare.
    satt('paket-ref-namn', harReferens() ? (state.policyNamn || '') : '');
    satt('paket-ref-kortnamn', harReferens() && state.policyKortnamn !== state.policyNamn ? (state.policyKortnamn || '') : '');
    satt('paket-po', state.costSettings.poPct);
    satt('paket-manader', state.costSettings.months);
    satt('paket-k', kTroskel());
    // Låsningarna (ADR-47): formuläret visar det som gäller nu; utan paket är inget låst.
    const las = state.paketLas;
    satt('paket-k-lagst', las.kTroskelLagst);
    satt('paket-inaktivitet', las.inaktivitetMin);
    const kryss = (id, v) => { const el = _paketFalt(id); if (el) /** @type {HTMLInputElement} */ (el).checked = v; };
    kryss('paket-inaktivitet-last', las.inaktivitetMin != null);
    kryss('paket-sma-export', las.smaGrupperIExport !== false);
    uppdateraPaketKnapp();
}

/** Formulärets låsningar (ADR-47): tomt fält = paketet anger inget. */
function _paketLasUrFormular() {
    const lagstText = _paketText('paket-k-lagst');
    const inaktText = _paketText('paket-inaktivitet');
    return {
        kTroskelLagst: lagstText === '' ? undefined : _kTolka(lagstText) ?? undefined,
        inaktivitetMin: /^\d+$/.test(inaktText) ? Number(inaktText) : undefined,
        inaktivitetLast: !!/** @type {HTMLInputElement} */ (_paketFalt('paket-inaktivitet-last'))?.checked,
        smaGrupperIExport: _paketFalt('paket-sma-export') ? !!/** @type {HTMLInputElement} */ (_paketFalt('paket-sma-export')).checked : true,
    };
}

/** Felet i formulärets låsningar, eller null. Ett ogiltigt värde får inte tyst falla bort ur paketet. */
function _paketLasFel() {
    const lagstText = _paketText('paket-k-lagst'), kText = _paketText('paket-k'), inaktText = _paketText('paket-inaktivitet');
    const lagst = _kTolka(lagstText), k = _kTolka(kText);
    if (lagstText !== '' && lagst == null) return `Lägsta tillåtna minsta gruppstorlek: ${_paketKFel()}`;
    if (lagstText !== '' && kText !== '' && k != null && lagst != null && k < lagst) {
        return `Minsta gruppstorlek ${k} är lägre än lägsta tillåtna ${lagst}.`;
    }
    const inakt = /^\d+$/.test(inaktText) ? Number(inaktText) : null;
    if (inaktText !== '' && (inakt == null || (inakt !== 0 && (inakt < PAKET_INAKTIVITET_MIN || inakt > PAKET_INAKTIVITET_MAX)))) {
        return `Rensning vid inaktivitet: ange 0 (av) eller ett heltal mellan ${PAKET_INAKTIVITET_MIN} och ${PAKET_INAKTIVITET_MAX} minuter.`;
    }
    if (/** @type {HTMLInputElement} */ (_paketFalt('paket-inaktivitet-last'))?.checked && !(inakt != null && inakt > 0)) {
        return `Rensning vid inaktivitet kan bara låsas till ett värde mellan ${PAKET_INAKTIVITET_MIN} och ${PAKET_INAKTIVITET_MAX} minuter.`;
    }
    return null;
}

/** Knappen kräver organisationens namn och minst ett ställningstagande eller statistik. */
function uppdateraPaketKnapp() {
    const knapp = _paketFalt('btn-paket-spara');
    const harData = harReferens() || state.statistik.length > 0;
    if (knapp) /** @type {HTMLInputElement} */ (knapp).disabled = !_paketText('paket-org') || !harData;
    const sam = _paketFalt('paket-sammanfattning');
    if (sam) {
        // Tröskeln paketet kommer att bära: fältets värde, inget alls om fältet är tomt, eller ett fel.
        const kText = _paketText('paket-k');
        const kDel = kText === '' ? ' Paketet anger ingen minsta gruppstorlek.'
            : _kTolka(kText) == null ? ` Minsta gruppstorlek: ${_paketKFel()}`
            : ` Minsta gruppstorlek för redovisning: ${_kTolka(kText)}.`;
        // Låsningarna (ADR-47): felet, annars vad paketet låser.
        const lasFel = _paketLasFel();
        const f = _paketLasUrFormular();
        const lasText = _paketLasText({ kTroskelLagst: f.kTroskelLagst ?? null, inaktivitetMin: f.inaktivitetLast ? f.inaktivitetMin : null,
                                        smaGrupperIExport: f.smaGrupperIExport });
        const lasDel = lasFel ? ` ${lasFel}` : lasText ? ` Låsningar: ${lasText}.` : ' Paketet låser inget.';
        sam.textContent = harData
            ? `Paketet får med: ${[harReferens() ? `ställningstagandet "${referensNamn()}" (${state.policy.length} rader)` : null,
                state.statistik.length ? `jämförelsestatistiken (${state.statistik.length} rader)` : null].filter(Boolean).join(' och ')}.${kDel}${lasDel}`
            : 'Läs först in ett ställningstagande eller jämförelsestatistik med rutorna ovan.';
    }
}

/** Samma felmeddelande som fältet på Översikt (sattKTroskel). */
function _paketKFel() { return `Ange ett heltal mellan ${K_MIN} och ${K_MAX}.`; }

/** Bygger paketet ur det inlästa och formuläret. */
function skapaPaket() {
    const jamfNamn = _paketText('paket-jamf-namn');
    return _opByggPaket({
        organisation: _paketText('paket-org'),
        utgivare: _paketText('paket-utgivare'),
        skapat: new Date().toISOString().slice(0, 10),
        avserAr: _paketTal('paket-ar'),
        profil: {
            benchmarkLabel: jamfNamn || undefined,
            benchmarkLabelGenitive: _paketText('paket-jamf-genitiv') || undefined,
            benchmarkShort: jamfNamn ? 'statistiken' : undefined,
            basSystem: state.profile.basSystem, aidSystem: state.profile.aidSystem,
            orgTyp: state.profile.orgTyp,
        },
        installningar: { poPct: _paketTal('paket-po'), poNot: state.profile.poPctNote, months: _paketTal('paket-manader'),
                         kTroskel: _kTolka(_paketText('paket-k')) ?? undefined, ..._paketLasUrFormular() },
        referens: harReferens() ? { namn: _paketText('paket-ref-namn') || state.policyNamn || undefined,
                                    kortnamn: _paketText('paket-ref-kortnamn') || _paketText('paket-ref-namn') || state.policyKortnamn || undefined,
                                    rader: state.policy } : null,
        statistik: state.statistik.length ? { namn: state.statistikNamn || undefined, rader: state.statistik } : null,
    });
}

function _paketFilnamn(org) {
    const slug = String(org).toLowerCase().replace(/[åä]/g, 'a').replace(/ö/g, 'o')
        .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    return `${slug || 'organisation'}.lonepaket.json`;
}

document.getElementById('paket-skapa')?.addEventListener('input', uppdateraPaketKnapp);
document.getElementById('paket-skapa')?.addEventListener('toggle', uppdateraPaketKnapp);
document.getElementById('btn-paket-spara')?.addEventListener('click', () => {
    // Ett ogiltigt värde för minsta gruppstorlek får inte tyst falla bort ur paketet (tomt fält = paketet anger inget).
    const kText = _paketText('paket-k');
    if (kText !== '' && _kTolka(kText) == null) { _paketStatus('Paketet sparades inte. Minsta gruppstorlek: ' + _paketKFel(), false); return; }
    const lasFel = _paketLasFel();
    if (lasFel) { _paketStatus('Paketet sparades inte. ' + lasFel, false); return; }
    const paket = skapaPaket();
    // Samma kontroll som vid inläsning — ett paket som inte går att läsa in sparas inte.
    const kontroll = _opTolkaPaket(JSON.stringify(paket));
    if (!kontroll.ok) { _paketStatus('Paketet kan inte sparas: ' + kontroll.fel, false); return; }
    const blob = new Blob([JSON.stringify(paket, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = _paketFilnamn(paket.organisation.namn);
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    announceToScreenReader(`Organisationspaket sparat: ${a.download}`);
});

// ---- Organisationsfil: verktyget med paketet inbakat (organisationsfil-design.md) ----
const INBAKAT_PAKET_ID = 'inbakat-organisationspaket';   // = MALL_ID i src/lib/organisationsfil.js
/** @type {File|null} */
let _verktygsfil = null;   // den fil systemägaren pekat ut

function uppdateraOrganisationsfilKnapp() {
    const knapp = _paketFalt('btn-organisationsfil-spara');
    const harPaket = !!state.paket || harReferens() || state.statistik.length > 0;
    if (knapp) /** @type {HTMLInputElement} */ (knapp).disabled = !_verktygsfil || !harPaket || !_paketText('paket-org');
    const namn = /** @type {HTMLInputElement|null} */ (_paketFalt('organisationsfil-namn'));
    if (namn && !namn.value && document.activeElement !== namn) namn.placeholder = _ofFilnamnForslag(_paketText('paket-org'));
}
function _organisationsfilStatus(text, ok) {
    const el = _paketFalt('organisationsfil-status');
    if (!el) return;
    el.textContent = text;
    el.className = 'status-msg' + (ok ? ' success' : '');
}
async function _sha256Hex(buf) {
    try {
        if (!globalThis.crypto?.subtle) return '';
        const h = await crypto.subtle.digest('SHA-256', buf);
        return [...new Uint8Array(h)].map(b => b.toString(16).padStart(2, '0')).join('');
    } catch (_e) { return ''; }
}
/**
 * Bakar in det gällande paketet (formuläret + inlästa delar) i den utpekade verktygsfilen och laddar ner
 * resultatet. Paketet valideras som vid sparande; filen som text rörs bara av _ofBakaIn (inget skript ändras).
 * @returns {Promise<{ok:boolean, meddelande:string}>}
 */
async function skapaOrganisationsfil() {
    if (!_verktygsfil) return { ok: false, meddelande: 'Peka ut verktygsfilen du öppnade.' };
    const kText = _paketText('paket-k');
    if (kText !== '' && _kTolka(kText) == null) { const m = 'Organisationsfilen skapades inte. Minsta gruppstorlek: ' + _paketKFel(); _organisationsfilStatus(m, false); return { ok: false, meddelande: m }; }
    const lasFel = _paketLasFel();
    if (lasFel) { const m = 'Organisationsfilen skapades inte. ' + lasFel; _organisationsfilStatus(m, false); return { ok: false, meddelande: m }; }
    const paket = skapaPaket();
    const kontroll = _opTolkaPaket(JSON.stringify(paket));
    if (!kontroll.ok) { const m = 'Paketet kan inte bakas in: ' + kontroll.fel; _organisationsfilStatus(m, false); return { ok: false, meddelande: m }; }
    const buf = await _verktygsfil.arrayBuffer();
    const html = new TextDecoder('utf-8').decode(buf);
    const skapad = new Date().toISOString().slice(0, 10);
    const r = _ofBakaIn(html, JSON.stringify(paket), { skapad, organisation: paket.organisation.namn, verktygssha: await _sha256Hex(buf) });
    if (!r.ok) { _organisationsfilStatus(r.fel, false); return { ok: false, meddelande: r.fel }; }
    const filnamn = _ofNormaliseraFilnamn(_paketText('organisationsfil-namn'), paket.organisation.namn);
    const blob = new Blob([r.html], { type: 'text/html' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filnamn;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    const annanVersion = r.version && r.version !== APP_VERSION;
    const meddelande = `Organisationsfilen ${filnamn} är nedladdad: paketet från ${paket.organisation.namn} (${skapad}) inbakat i verktyget version ${r.version || 'okänd'}.`
        + (annanVersion ? ` Observera: den utpekade filen är en annan version än den som körs (${APP_VERSION}).` : '')
        + ' Ingen lönedata ingår.';
    _organisationsfilStatus(meddelande, true);
    announceToScreenReader(meddelande);
    return { ok: true, meddelande };
}
document.getElementById('file-input-verktygsfil')?.addEventListener('change', e => {
    const inp = /** @type {HTMLInputElement} */ (e.target);
    _verktygsfil = inp.files && inp.files[0] ? inp.files[0] : null;
    uppdateraOrganisationsfilKnapp();
});
document.getElementById('paket-skapa')?.addEventListener('input', uppdateraOrganisationsfilKnapp);
document.getElementById('btn-organisationsfil-spara')?.addEventListener('click', () => { skapaOrganisationsfil(); });

/**
 * Läser det paket som ligger inbakat i den här filen (mallen med id inbakat-organisationspaket, lagd dit av
 * skapaOrganisationsfil i systemägarens verktyg). Körs vid start och efter Rensa all data. Demoläget går före.
 * @returns {{ok:boolean, meddelande:string}|null} null när inget paket är inbakat
 */
function lasInInbakatPaket() {
    const mall = document.getElementById(INBAKAT_PAKET_ID);
    if (!mall) return null;
    // Ett <template> håller sitt innehåll i ett eget fragment: textContent på elementet är tomt.
    const text = (/** @type {HTMLTemplateElement} */ (mall).content?.textContent ?? mall.textContent) || '';
    state.paketInbakat = { skapad: mall.getAttribute('data-skapad') || '', organisation: mall.getAttribute('data-organisation') || '',
        verktygsversion: mall.getAttribute('data-verktygsversion') || '', verktygssha: mall.getAttribute('data-verktygssha') || '', text };
    const r = lasInPaket(text, 'inbakat', { inbakat: true });
    if (!r.ok) _paketStatus('Det inbakade paketet kunde inte läsas: ' + r.meddelande, false);
    return r;
}
function visaInbakatPaket() {
    const modal = document.getElementById('paket-modal'), content = document.getElementById('paket-modal-content');
    const inb = state.paketInbakat;
    if (!modal || !content || !inb) return;
    /** @type {any} */
    let obj = null;
    try { obj = JSON.parse(inb.text); } catch (_e) { obj = null; }
    const rad = (dt, dd) => (dd == null || dd === '' ? '' : `<dt>${esc(dt)}</dt><dd>${esc(String(dd))}</dd>`);
    const tabell = (rubrik, rader, kolumner) => !rader?.length ? '' : `<h3>${esc(rubrik)} (${rader.length} rader)</h3><div class="rulla max-hojd-420"><table class="data-table st-088"><thead><tr>${kolumner.map(k => `<th>${esc(k)}</th>`).join('')}</tr></thead><tbody>${rader.map(r => `<tr>${kolumner.map(k => `<td>${esc(r[k] == null ? '' : String(r[k]))}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
    const inst = obj?.installningar || {};
    content.innerHTML = `<dl>${rad('Organisation', obj?.organisation?.namn)}${rad('Utgivare', obj?.utgivare)}${rad('Skapat', obj?.skapat)}${rad('Avser år', obj?.avserAr)}`
        + `${rad('Inbakat', inb.skapad)}${rad('Verktygets version', inb.verktygsversion)}${rad('Verktygsfilens kontrollsumma (SHA-256)', inb.verktygssha)}`
        + `${rad('Benämning på jämförelsestatistiken', obj?.profil?.jamforelseNamn)}${rad('Minsta gruppstorlek', inst.kTroskel)}${rad('Lägsta tillåtna minsta gruppstorlek', inst.kTroskelLagst)}`
        + `${rad('Rensning vid inaktivitet (min)', inst.inaktivitetMin)}${rad('Rensningstiden låst', inst.inaktivitetLast ? 'ja' : null)}${rad('Små grupper i Utforskas export', inst.smaGrupperIExport === false ? 'inte tillåtet' : null)}</dl>`
        + tabell(obj?.referens?.namn || 'Ställningstagandet', obj?.referens?.rader, ['aid', 'bas', 'p10', 'med', 'p90'])
        + tabell(obj?.statistik?.namn || 'Jämförelsestatistiken', obj?.statistik?.rader, ['aid', 'bas', 'median', 'p10', 'p90', 'andelKv'])
        + `<details class="bakgrund-panel marg-t-12"><summary>Råtext (JSON)</summary><pre class="fs-xs max-hojd-420 rulla">${esc(obj ? JSON.stringify(obj, null, 2) : inb.text)}</pre></details>`;
    modal.style.display = 'flex';
    if (typeof trapFocus === 'function') trapFocus(modal);
}
function laddaNerInbakatPaket() {
    const inb = state.paketInbakat;
    if (!inb) return;
    let text = inb.text;
    try { text = JSON.stringify(JSON.parse(inb.text), null, 2); } catch (_e) { /* råtexten som den är */ }
    const blob = new Blob([text], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = _paketFilnamn(inb.organisation);
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    announceToScreenReader(`Paketet sparat: ${a.download}`);
}
document.getElementById('paket-info')?.addEventListener('click', e => {
    const t = /** @type {HTMLElement} */ (e.target);
    if (t.closest('#btn-paket-visa')) visaInbakatPaket();
    else if (t.closest('#btn-paket-ladda-ner')) laddaNerInbakatPaket();
});
const _stangPaketModal = () => { const m = document.getElementById('paket-modal'); if (m) { if (typeof releaseFocus === 'function') releaseFocus(m); m.style.display = 'none'; } };
document.getElementById('paket-modal-close')?.addEventListener('click', _stangPaketModal);
document.getElementById('paket-modal')?.addEventListener('click', e => { if (/** @type {HTMLElement} */ (e.target).classList.contains('glossary-backdrop')) _stangPaketModal(); });

document.getElementById('file-input-paket')?.addEventListener('change', e => {
    const file = /** @type {HTMLInputElement} */ (e.target).files && /** @type {HTMLInputElement} */ (e.target).files?.[0];
    if (!file) return;
    /** @type {HTMLInputElement} */ (e.target).value = '';   // samma fil ska kunna läsas in igen
    if (file.size > PAKET_MAX_FILSTORLEK) {
        _paketStatus('Filen är för stor för att vara ett organisationspaket (högst 5 MB).', false);
        return;
    }
    const reader = new FileReader();
    reader.onload = ev => lasInPaket(String(/** @type {FileReader} */ (ev.target).result), file.name);
    reader.onerror = () => _paketStatus('Filen kunde inte läsas.', false);
    reader.readAsText(file);
});

// Organisationstypen (kommun, region eller båda) styr vilken del av SKR:s personalstatistik som
// är referens för kvinnoandel (ADR-34). Värdet bor i profilen och följer med paket och konfiguration.
function _synkaOrgTyp() {
    const sel = document.getElementById('org-typ');
    if (sel) /** @type {HTMLInputElement} */ (sel).value = _skrDel();
    // Paketraden är ihopfälld; sammanfattningen visar valet (ADR-36).
    const txt = document.getElementById('paket-orgtyp');
    if (txt) txt.textContent = `· Organisationen är: ${{ kommun: 'en kommun', region: 'en region' }[_skrDel()] || 'en kommun eller region'}`;
}
function sattOrgTyp(v) {
    if (v !== 'alla' && v !== 'kommun' && v !== 'region') return;
    state.profile = { ...state.profile, orgTyp: v };
    _synkaOrgTyp();
}
document.getElementById('org-typ')?.addEventListener('change', e => {
    sattOrgTyp(/** @type {HTMLInputElement} */ (e.target).value);
    if (!state.data.length) return;
    invalidateStatCaches();
    updateCompliance();
    renderActionChecklist();
    refreshCurrentTab();
});

_fyllPaketFormular();
_synkaOrgTyp();

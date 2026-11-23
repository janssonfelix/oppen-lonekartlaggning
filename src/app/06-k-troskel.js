// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson

// ---- k-anonymitet (uppgiftsminimering och inbyggt dataskydd, art. 5.1 c och 25) ----
// Grupper med färre än kTroskel() personer redovisas inte i det som lämnar verktyget, så att enskildas
// löner inte kan räknas fram via t.ex. känd åldersstruktur.
//
// Två lägen (ADR-51, beslut 2026-10-29 efter användartest): på SKÄRMEN maskeras inget — den som använder
// verktyget har redan lönefilen — och kTroskel() är då 1. Allt som LÄMNAR verktyget (Excel, Word, PDF, ZIP,
// CSV, urklipp, diagrambilder, rapportunderlaget, Rapporttext och Exportera) ritas och räknas i exportläget
// (23-exportgrind.js: medExportLage), där kTroskel() är den inställda tröskeln, kInstalld(). Inställningen,
// stämpeln och texterna om regeln talar alltid om den inställda tröskeln.
//
// Standardvärdet 10 är verktygets eget (docs/utveckling/k-troskeln.md). Användaren kan ändra värdet (ADR-38): ett värde under standard kräver bekräftelse och visas med stående varning. Värdet
// står i metodbilagan, i exporterad diagramdata och i tabell-CSV; under standard står meningen
// om sänkt tröskel dessutom på det som kan spridas för sig (se kStampel och _kSanktNot).
// K_STANDARD, K_MIN och K_MAX står i src/lib/ktroskel.js.

/** På skärmen maskeras inget: tröskeln är 1 (ADR-51). */
const K_SKARM = 1;
/** Tröskeln som gäller just nu: den inställda i exportläget, annars 1. Enda vägen att läsa det som ska tillämpas. */
function kTroskel() { return state.kLage === 'export' ? state.kTroskel : K_SKARM; }
/** Den inställda minsta gruppstorleken (gäller det som lämnar verktyget), oavsett läge. */
function kInstalld() { return state.kTroskel; }

/** Organisationspaketets golv för tröskeln (ADR-47), eller null när inget paket satt något. */
function kTroskelLagst() { return state.paketLas.kTroskelLagst; }

/** Värdet återställningsknappen går till: standard, eller paketets golv när det är högre. */
function _kAterstallVarde() { return Math.max(K_STANDARD, kTroskelLagst() ?? K_MIN); }

/**
 * Golv för skattningar (regression per BAS, bootstrap, förväntad lön): aldrig under
 * standardvärdet, eftersom gränsen där gäller skattningens tillförlitlighet och inte
 * redovisningen. Följer med uppåt, så att ett skärpt skydd också gäller skattade gruppvärden.
 * Räknas på den inställda tröskeln i båda lägena (ADR-51), så att skattningarna — och deras cacher — är desamma.
 */
function statGolv() { return _ktStatGolv(kInstalld()); }   // oberoende av läget: skattningarna är desamma på skärmen och i exporten

/**
 * Avgör om en gruppstorlek är under k-tröskeln.
 * @param {number} n - Antal personer i gruppen.
 * @returns {boolean}
 */
function isKMasked(n) { return n < kTroskel(); }

/**
 * Gränsen för "litet underlag" i ett diagram: en stapel eller ett segment som gäller färre personer än så ritas
 * med mönster och sägs vara osäkert. Det är inte en maskeringsgräns — gruppen som stapeln räknas i når redan
 * minsta gruppstorlek — utan en varning för att några få personer kan se ut som ett mönster. Fem är den gräns
 * som är vanlig för små tal i tabeller, och samma som könsskevhetstabellen använder.
 */
const LITET_UNDERLAG = 5;
function litetUnderlag() { return LITET_UNDERLAG; }

// Reglerna för vad som får redovisas vid k bor i src/lib/ktroskel.js med tröskeln som argument. Adaptrarna nedan
// behåller appens namn och lägger till tröskeln som gäller: kTroskel() för det som redovisas, kInstalld() för stämpeln
// och texterna om regeln. _kTolka, _konAntal, _parNarK och _kUndantagNot läser ingen tröskel och kommer direkt ur spegeln.
function _konFarRedovisas(nKv, nMa) { return _ktKonFarRedovisas(nKv, nMa, kTroskel()); }
/** Får könsuppdelade lönemått för hela radmängden redovisas? */
function _konFarRedovisasFor(rader) { return _ktKonFarRedovisasFor(rader, kTroskel()); }
/** Meningen där ett könsuppdelat mått för hela urvalet utelämnats (samma ordalydelse som Rapportunderlaget). */
function _konUtelamnatNot() { return _ktKonUtelamnatNot(kTroskel()); }

/** Regressionens råa mediangap som text (ktroskel.js: raGapText). */
function _raGapText(reg, fmt) { return _ktRaGapText(reg, fmt, kTroskel()); }

/** Regressionens stegvisa uppdelning så som den får redovisas (ktroskel.js: regStegForRedovisning). */
function _regStegForRedovisning(reg) { return _ktRegSteg(reg, kTroskel()); }

/** Regressionens BAS-effekter så som de får redovisas (ktroskel.js: basEffekterForRedovisning); noten med appens termer. */
function _basEffekterForRedovisning(reg) {
    const k = kTroskel();
    return _ktBasEffekter(reg, k, utelamnade => _kMaskNoteText(utelamnade, `${T.niva.en}|${T.niva.fl}`, k, 'deras effekt i modellen skulle visa deras genomsnittliga lönenivå', 'modellen'));
}

/**
 * Not under ett diagram där något utelämnats på grund av tröskeln (samma utseende som tabellernas
 * noter). Tom text tar bort noten. Noten läggs efter diagrammets behållare, så att den inte tränger
 * ihop ritytan.
 */
function _setDiagramKNot(chartId, text) {
    const chart = document.getElementById(chartId);
    if (!chart) return;
    const noteId = chartId + '-k-not';
    let note = document.getElementById(noteId);
    if (!text) { if (note) note.remove(); return; }
    if (!note) {
        note = document.createElement('p');
        note.id = noteId;
        note.className = 'k-mask-note';
        note.setAttribute('role', 'note');
        (chart.closest('.chart-container') || chart).insertAdjacentElement('afterend', note);
    }
    note.textContent = text;
}

/**
 * Metodförbehåll under ett diagram: en egen not, skild från k-noten, så att den ena aldrig
 * skriver över den andra. Tom text tar bort noten. Läggs efter k-noten om den finns, annars efter behållaren. Id:t
 * börjar med diagrammets (chart-…), så *Rensa all data* tömmer den med diagrammen.
 */
function _setDiagramMetodNot(chartId, text) {
    const chart = document.getElementById(chartId);
    if (!chart) return;
    const noteId = chartId + '-metod-not';
    let note = document.getElementById(noteId);
    if (!text) { if (note) note.remove(); return; }
    if (!note) {
        note = document.createElement('p');
        note.id = noteId;
        note.className = 'metod-not';
        note.setAttribute('role', 'note');
        (document.getElementById(chartId + '-k-not') || chart.closest('.chart-container') || chart).insertAdjacentElement('afterend', note);
    }
    note.textContent = text;
}

/**
 * Får ett § 3:10-par redovisas i underlaget? Båda yrkesgrupperna ska nå tröskeln. Endast fliken
 * Likvärdigt arbete och dess egen export (Excel, CSV) är undantagna (dokumenterat); alla andra utdata
 * — Rapportunderlaget, Word-utkastet, utskriften, protokollet, Att göra, handlingsplanen och
 * gruppdossiern — använder denna regel (via _parForRedovisning).
 */
function _parOverTroskel(p) { return _parNarK(p, kTroskel()); }

/** Mening om par som utelämnats ur underlaget (samma ordalydelse som Rapportunderlaget). */
function _parUtelamnadeNot(antal, k = kTroskel()) { return _ktParUtelamnadeNot(antal, k); }

/**
 * Delar en lista § 3:10-par i de som får redovisas utanför fliken Likvärdigt arbete och antalet som
 * utelämnas. `not` är meningen om de utelämnade (tom när inga utelämnats). Ordningen bevaras och
 * objekten är desamma som i indata. Gränsen är kTroskel(), det som gäller i läget; Löneöversyns
 * förslag anger den inställda tröskeln, kInstalld(), också på skärmen (ADR-69).
 * @param {any[]} [pairs]
 * @param {number} [k]
 */
function _parForRedovisning(pairs, k = kTroskel()) { return _ktParForRedovisning(pairs, k); }

/** Raden som anger den inställda tröskeln (stämpeln), på de utdata som bär den. */
function kStampel() { return _ktStampel(kInstalld()); }

/**
 * Raden i diagramdata från ett diagram med en punkt per person (figurens `individer`, ADR-39): filen bär en rad
 * per person — lön, kön, ålder eller grupp — och ska hanteras som personuppgifter (beslut av produktägaren
 * 2026-10-16). Text ur fältet för AID-etikett maskeras inte (ADR-85): som serienamn (färgläggning efter AID-etikett)
 * och i raden om urvalet följer den med som den står i lönefilen. Punkterna följer tröskeln som på skärmen
 * (individLitenFor).
 */
function kIndividRad() {
    return `Filen innehåller en rad per person (lön, kön, ålder eller grupp) och ska hanteras som personuppgifter. Text ur fältet för ${T.enhet.en} kan följa med som den står i lönefilen.`;
}

/** Stämpeln, med tillägget om undantag när exporten hör till ett. */
function kStampelFor(undantag) { return _ktStampelFor(undantag, kInstalld()); }

/**
 * Vilket dokumenterat undantag en tabell eller ett diagram hör till, om något: allt i fliken
 * Likvärdigt arbete, och Utforskas tabell och diagram när rutan "Ta med grupper under k i
 * exporten" är ikryssad.
 *
 * Fliken Likvärdigt arbete går först och gäller ALLT i den, vilket bibliotek som än har ritat: fliken
 * redovisar grupper under tröskeln utan att märka dem, så stämpeln kan inte bero på vad figuren säger om
 * sig själv. En stämpel som varnar i onödan är ofarlig; en som inte varnar när den borde är det inte.
 * @param {Element|null} el
 * @param {boolean} [medSma]  bara för diagram ritade med diagramkärnan (ADR-39): bär exporten små grupper?
 *   Exportmenyn skickar det svar den själv exporterar efter, så att stämpel och innehåll följer samma svar.
 *   Utelämnat frågas vyn här (en gång).
 * @returns {string} Undantagets namn, eller tom sträng.
 */
function _kUndantagFor(el, medSma) {
    if (!el || typeof el.closest !== 'function') return '';
    // En kopia i Alla diagram (74-alla-diagram.js) bär samma figur som källan, och stämpeln följer källans flik.
    const kalla = typeof diagramKopiaKalla === 'function' ? diagramKopiaKalla(el) : null;
    if (el.closest('#view-likvardighet') || (kalla && kalla.closest('#view-likvardighet'))) return 'Likvärdigt arbete';
    // Ett diagram ritat med diagramkärnan exporteras annars utan små grupper om inte vyn uttryckligen begär
    // dem (exportMedSma): undantaget gäller bara när exporten faktiskt bär dem.
    if (el._figur) {
        const bar = typeof medSma === 'boolean' ? medSma : _rfExportFigur(el)?.visaSma;
        return bar ? 'valt i Tabeller och egna vyer' : '';
    }
    if ((el.id === 'explore-table' || el.id === 'chart-explore') && typeof explorerSmaIExport === 'function' && explorerSmaIExport()) return 'valt i Tabeller och egna vyer';
    return '';
}

/** Stämpeln när tröskeln är sänkt under standard, annars tom sträng. */
function _kSanktNot() { return _ktSanktNot(kInstalld()); }

/** Stycket med stämpeln för utskrifter när tröskeln är sänkt (escapat), annars tom sträng. */
function _kSanktStycke() {
    const not = _kSanktNot();
    return not ? `<p class="farg-kritisk fw-600">${esc(not)}</p>` : '';
}

/** En punkt per person är liten när gruppen eller personens kön i gruppen är under tröskeln (ktroskel.js: individLitenFor). */
function individLitenFor(rader) { return _ktIndividLitenFor(rader, kTroskel()); }

/** Sidfot med tillägg när tröskeln är sänkt under standard. */
function _kSidfot(text) { return _ktSidfot(text, kInstalld()); }

/** Tabell-CSV: stämpeln som sista rad, om den inte redan står i raderna (diagramdata). */
function _csvMedStampel(rows, undantag) { return _ktCsvMedStampel(rows, undantag, kInstalld()); }
/** Tabell till urklipp: stämpeln bara när tröskeln är sänkt eller exporten hör till ett undantag. */
function _tsvMedStampel(rows, undantag) { return _ktTsvMedStampel(rows, undantag, kInstalld()); }

/** Byter {k} mot den inställda tröskeln och {golv} mot det statistiska golvet. */
function _kText(s) { return _ktText(s, kInstalld()); }

/** Fyller de fasta texterna i index.html som nämner talet. */
function _fyllKTexter() {
    document.querySelectorAll('[data-k-troskel]').forEach(el => { el.textContent = String(kInstalld()); });
    document.querySelectorAll('[data-k-golv]').forEach(el => { el.textContent = String(statGolv()); });
    document.querySelectorAll('[data-k-tooltip]').forEach(el => { el.setAttribute('data-tooltip', _kText(el.getAttribute('data-k-tooltip'))); });
    const lbl = document.getElementById('explore-inkludera-sma-label');
    if (lbl) lbl.textContent = `Ta med grupper under ${kInstalld()} i exporten`;
}

// Fält, varning och texter som visar värdet.
function _synkaKTroskel() {
    _fyllKTexter();
    const k = kInstalld();
    const falt = document.getElementById('k-troskel');
    if (falt) /** @type {HTMLInputElement} */ (falt).value = String(k);
    // Paketformuläret bär samma värde, men skrivs inte över medan användaren redigerar det.
    const paketFalt = document.getElementById('paket-k');
    if (paketFalt && document.activeElement !== paketFalt) /** @type {HTMLInputElement} */ (paketFalt).value = String(k);
    // Paketets golv (ADR-47): fältet säger gränsen, återställningen går aldrig under den.
    const lagst = kTroskelLagst();
    if (falt) /** @type {HTMLInputElement} */ (falt).min = String(lagst ?? K_MIN);
    const hjalp = document.getElementById('k-troskel-hjalp');
    if (hjalp) hjalp.textContent = lagst != null
        ? `Standard ${K_STANDARD}; lägst ${lagst} enligt organisationspaketet. Ändringen räknar om alla flikar.`
        : `Standard ${K_STANDARD}. Ändringen räknar om alla flikar.`;
    const aterstall = document.getElementById('btn-k-aterstall');
    if (aterstall) { aterstall.hidden = k === _kAterstallVarde(); aterstall.textContent = `Återställ till ${_kAterstallVarde()}`; }
    const sam = document.getElementById('k-troskel-sammanfattning');
    if (sam) sam.textContent = k === K_STANDARD ? '' : `· Minsta gruppstorlek: ${k}`;
    const varning = document.getElementById('k-troskel-varning');
    if (varning) {
        varning.hidden = k >= K_STANDARD;
        const text = document.getElementById('k-troskel-varning-text');
        if (text) text.textContent = `Minsta gruppstorlek är sänkt till ${k} (standard ${K_STANDARD}). Lönemått för små grupper kan peka ut enskilda.`;
    }
}

function _kVisaFel(meddelande) {
    const fel = document.getElementById('k-troskel-fel');
    if (!fel) return;
    fel.textContent = meddelande || '';
    fel.hidden = !meddelande;
}
document.getElementById('k-troskel')?.addEventListener('change', e => {
    const r = sattKTroskel(/** @type {HTMLInputElement} */ (e.target).value, { stegvis: true });
    _kVisaFel(r.ok || r.nekad ? '' : r.fel);
    const sag = () => { if (r.ok && typeof announceToScreenReader === 'function') announceToScreenReader(`Minsta gruppstorlek är nu ${r.varde}.`); };
    if (r.klar) r.klar.then(sag); else sag();
});
document.getElementById('btn-k-aterstall')?.addEventListener('click', () => {
    sattKTroskel(_kAterstallVarde(), { fraga: false, stegvis: true });
    _kVisaFel('');
});
// Länken i varningen: öppna inställningarna med fokus i fältet.
document.getElementById('k-troskel-varning-lank')?.addEventListener('click', e => {
    e.preventDefault();
    if (typeof oppnaInstallningar === 'function') oppnaInstallningar({ fokus: 'k-troskel' });
});

/**
 * Sätter tröskeln. Sänkning till ett värde under standard kräver bekräftelse (fraga: false
 * hoppar över den; används av tester och när anroparen redan har frågat).
 *
 * `rita: false` hoppar över omritningen — bara för anropare som själva anropar
 * _renderaOmAllaFlikar() innan de återvänder (inläsning av konfigurationsfil och
 * organisationspaket, som ändrar mer än tröskeln och annars skulle rita allt två gånger).
 * Ett värde under organisationspaketets golv (ADR-47) avvisas som ett ogiltigt värde, oavsett varifrån det kommer.
 * @param {any} v
 * @param {{fraga?: boolean, rita?: boolean, stegvis?: boolean}} [val]
 * @returns {{ok: boolean, varde?: number, andrad?: boolean, fel?: string, nekad?: boolean, klar?: Promise<void>}}
 *   ok: true → varde och andrad (och klar, omritningens löfte, när något ritades om); ok: false → fel (ogiltigt värde) eller nekad (användaren avböjde).
 */
function sattKTroskel(v, { fraga = true, rita = true, stegvis = false } = {}) {
    const n = _kTolka(v);
    if (n == null) { _synkaKTroskel(); return { ok: false, fel: `Ange ett heltal mellan ${K_MIN} och ${K_MAX}.` }; }
    const lagst = kTroskelLagst();
    if (lagst != null && n < lagst) { _synkaKTroskel(); return { ok: false, fel: `Lägst ${lagst} enligt organisationspaketet.` }; }
    if (n === state.kTroskel) { _kVisaFel(''); _synkaKTroskel(); return { ok: true, varde: n, andrad: false }; }
    if (fraga && n < K_STANDARD && n < state.kTroskel
        && !confirm(`Sänka minsta gruppstorlek till ${n}?\n\nLönemått kommer att redovisas för grupper med ned till ${n} ${personOrd(n)}. `
            + `I så små grupper kan enskildas löner räknas fram. Värdet står i metodbilagan och i exporterad data, och meningen om sänkt tröskel på det som kan spridas för sig.`)) {
        _synkaKTroskel();
        return { ok: false, nekad: true };
    }
    _kVisaFel('');   // ett gammalt felmeddelande hör till ett värde som inte längre gäller
    const golvFore = statGolv();
    state.kTroskel = n;
    state._lifecycleCache = null;
    // Skattningarna (bootstrap-KI och styrkan läser statGolv()) räknas om bara när golvet ändras — på 55 000 rader är
    // bootstrapen sekunder. § 3:10-paren läser ingen tröskel och står kvar (antalet små grupper i deras diagnostik
    // räknas när resultatet läses, likvardighetResultat). Det som är ritat bär den gamla tröskeln och ritas om.
    const golvAndrat = statGolv() !== golvFore;
    if (golvAndrat && typeof invalidateStatCaches === 'function') invalidateStatCaches({ recompute: false, likvardighet: false });   // räknas om i bakgrunden nedan
    else if (typeof ritGenerationNy === 'function') ritGenerationNy();   // allt som är ritat hittills bär den gamla tröskeln
    // Löneöversynens förslag ur § 3:10-par som inte längre når den inställda tröskeln tas bort, också på skärmen (egna
    // rader står kvar; ADR-69). En sänkt tröskel tar inte bort något men ändrar meningen om utelämnade par.
    if (typeof _fcRensaParMal === 'function') _fcRensaParMal();
    _synkaKTroskel();
    // Från gränssnittet ritas allt om stegvis, med förlopp (stegvis); program och tester får det direkt.
    /** @type {Promise<void>|null} */
    let klar = null;
    if (rita) { if (stegvis) klar = _renderaOmAllaFlikarStegvis(); else _renderaOmAllaFlikar(); }
    // Skattningarna som läser golvet räknas om i bakgrunden när omritningen är klar (rutan är borta), som vid inläsning.
    if (golvAndrat) { if (klar) klar.then(() => _skattningarIBakgrunden()); else _skattningarIBakgrunden(); }
    return { ok: true, varde: n, andrad: true, ...(klar ? { klar } : {}) };
}

/**
 * Räknar om skattningarna (bootstrap-KI och styrkan, som läser statGolv()) i bakgrunden efter ett tröskelbyte som
 * ändrade golvet — som vid inläsningen — och ritar sedan om det som visar dem: Översikts nyckeltal och underlagets
 * kvalitet, och Lika arbete eller Prioritering när den är öppen. Tills dess står nyckeltalen utan intervall.
 * @returns {Promise<void>}
 */
/** @type {Promise<void>|null} */
let _bakgrundsrakning = null;
function _skattningarIBakgrunden() {
    if (_bakgrundsrakning) return _bakgrundsrakning;
    const status = document.getElementById('data-status');
    const NOT = ' · förbereder analyser i bakgrunden…';
    if (status && !status.textContent.includes(NOT)) status.textContent += NOT;
    _bakgrundsrakning = new Promise(resolve => setTimeout(() => {
        try {
            if (state.data.length) {
                try { computeBootstrapCI(); } catch (_e) { state.bootstrapCI = null; }
                try { state.powerAnalysis = computePowerAnalysis(); } catch (_e) { state.powerAnalysis = null; }
                if (typeof updateDashboardStats === 'function') updateDashboardStats();
                if (typeof renderUnderlagetsKvalitet === 'function') renderUnderlagetsKvalitet();
                const oppen = document.querySelector('.nav-item.active[data-tab]');
                const flik = oppen ? oppen.getAttribute('data-tab') : null;
                if ((flik === 'matrix' || flik === 'prioritering') && typeof renderTabContent === 'function') renderTabContent(flik);
            }
        } catch (e) { rapporteraFel('skattningar i bakgrunden', e); }
        finally {
            if (status) status.textContent = status.textContent.replace(NOT, '');
            _bakgrundsrakning = null;
            visningNy();   // skattningarna är klara: det som ritades utan dem visas inte igen (ADR-81)
            resolve();
        }
    }, 0));
    return _bakgrundsrakning;
}

/**
 * Ritar om det som syns efter ändrad tröskel: Översikts delar (som inläsningen ritar men renderTabContent inte
 * gör, jämför 32-filinlasning.js) och den flik som är öppen. Övriga flikar ritas om när de öppnas — navigeringen
 * visar aldrig en flik som ritades före en ändring (ADR-81) — och exporterna går genom exportgrinden (23-exportgrind.js), som ritar om en flik som inte
 * är aktuell innan något läses ur den.
 */
function _renderaOmAllaFlikar() {
    for (const [namn, fn] of _omritningssteg()) _omritningForsok(namn, fn);
    visningNy();   // omritningen rör flera flikar: ingen visas igen som den var (ADR-81)
}
function _omritningForsok(namn, fn) { try { fn(); } catch (e) { rapporteraFel(`omritning efter ändrad k-tröskel (${namn})`, e); } }

// Stegen i omritningen efter ändrad tröskel, i ordning: [namn, funktion].
function _omritningssteg() {
    if (!state.data.length || typeof renderTabContent !== 'function') return [];
    const steg = [];
    // Först töms de flikar som inte syns: de bär tal från den gamla tröskeln tills de ritas om (exportgrinden).
    steg.push(['flikar som inte syns', () => {
        const oppen = document.querySelector('.nav-item.active[data-tab]');
        if (typeof tomFlikarUtom === 'function') tomFlikarUtom(new Set(['dashboard', ...(oppen ? [oppen.getAttribute('data-tab')] : [])]));
    }]);
    // Översikt och Filer och kvalitet: nyckeltal, kompliansöversikt, underlagets kvalitet, processöversikten, Att göra,
    // inläsningsrapporten, extremvärdeslistan och A/B-jämförelsen. Var uppstår löneskillnaden ritas med Lönestruktur.
    steg.push(['nyckeltal', () => { if (typeof updateDashboardStats === 'function') updateDashboardStats(); }]);
    steg.push(['kompliansöversikt', () => { if (typeof updateCompliance === 'function') updateCompliance(); }]);
    // Underlagets kvalitet, Att göra och processöversikten läser samma regression: den körs en gång i omritningen och
    // skickas vidare, som punkterna nedan (ADR-17: ett värde inom omritningen, ingen cache). Kastar den ritar varje del
    // med en egen körning. Mellan stegen kan en tidtagare byta underlaget (en fil som läses klart, rensningen vid
    // inaktivitet) utan att gå genom händelserna som rutan stoppar; därför skickas regressionen bara vidare så länge det
    // den läser (underlaget, k och förklaringsmodellen) är oförändrat, annars räknar steget en egen.
    // Detsamma gäller punkterna.
    const indata = () => ({ data: state.data, rest: `${kInstalld()}|${JSON.stringify(typeof forklaringsmodell === 'function' ? forklaringsmodell() : null)}` });
    const oforandrat = f => { const nu = indata(); return !!f && f.data === nu.data && f.rest === nu.rest; };
    /** @type {any} */ let reg;
    /** @type {any} */ let regFangst = null;
    steg.push(['underlagets kvalitet', () => {
        if (typeof renderUnderlagetsKvalitet !== 'function') return;
        regFangst = indata();
        reg = typeof runOLSRegression === 'function' ? runOLSRegression() : undefined;
        renderUnderlagetsKvalitet({ reg });
    }]);
    // Processöversikten läser samma punkter som Att göra: listan byggs en gång och skickas vidare (ingen cache).
    /** @type {any[]|undefined} */ let punkter;
    /** @type {any} */ let punktFangst = null;
    steg.push(['Att göra', () => {
        if (typeof renderActionChecklist !== 'function') return;
        punktFangst = indata();
        punkter = renderActionChecklist({ reg: oforandrat(regFangst) ? reg : undefined });
    }]);
    steg.push(['processöversikten', () => {
        if (typeof renderProcessTracker !== 'function') return;
        renderProcessTracker({ punkter: oforandrat(punktFangst) ? punkter : undefined, reg: oforandrat(regFangst) ? reg : undefined });
    }]);
    steg.push(['extremvärden', () => { if (typeof renderOutliers === 'function') renderOutliers(); }]);
    steg.push(['inläsningsrapporten', () => { if (typeof renderDataValidationReport === 'function') renderDataValidationReport(); }]);
    steg.push(['A/B-jämförelsen', () => {
        const ab = document.getElementById('snapshot-comparison');
        if (ab && ab.style.display !== 'none' && typeof renderSnapshotComparison === 'function') renderSnapshotComparison();
    }]);
    // Bara den öppna fliken. De övriga är inaktuella tills de öppnas eller en export behöver dem (exportgrinden).
    // Översikt är redan ritad av stegen ovan (renderTabContent('dashboard') gör inget annat).
    const oppen = document.querySelector('.nav-item.active[data-tab]');
    if (oppen && oppen.getAttribute('data-tab') !== 'dashboard') steg.push([oppen.getAttribute('data-tab'), () => renderTabContent(oppen.getAttribute('data-tab'))]);
    // En öppen gruppdossier byggdes med den gamla tröskeln.
    steg.push(['gruppdossiern', () => {
        const dossier = document.getElementById('dossier-body');
        if (dossier && dossier.innerHTML.trim() && typeof renderGruppdossier === 'function') renderGruppdossier();
    }]);
    return steg;
}

/**
 * Samma omritning, ett steg i taget med en paus mellan stegen, så att webbläsaren hinner rita och gränssnittet
 * inte ser fruset ut (flera sekunder vid stora underlag). Medan den pågår täcker en ruta med förlopp sidan och
 * tar emot alla klick och tangenttryck: det som redan ritats bär den GAMLA tröskeln tills dess flik har ritats om,
 * och får inte kunna exporteras eller läsas under tiden. Löftet uppfylls när allt är omritat.
 */
/** @type {Promise<void>|null} */
let _omritningPagar = null;
function _renderaOmAllaFlikarStegvis() {
    if (_omritningPagar) return _omritningPagar;
    const steg = _omritningssteg();
    if (!steg.length) return Promise.resolve();
    const ruta = document.createElement('div');
    ruta.id = 'omritning-ruta';
    ruta.className = 'omritning-ruta';
    ruta.setAttribute('role', 'status');
    ruta.setAttribute('aria-live', 'polite');
    const text = document.createElement('p');
    ruta.appendChild(text);
    document.body.appendChild(ruta);
    const stoppa = e => { e.stopPropagation(); e.preventDefault(); };
    // Också dragover och drop: filytorna läser in en släppt fil direkt (32-filinlasning.js), och en ny lönefil mitt i
    // omritningen skulle låta stegen efter rita med det gamla underlagets värden.
    const HANDELSER = ['keydown', 'keyup', 'keypress', 'click', 'pointerdown', 'mousedown', 'submit', 'change', 'input',
        'dragover', 'drop'];
    for (const h of HANDELSER) document.addEventListener(h, stoppa, true);
    const klar = () => {
        for (const h of HANDELSER) document.removeEventListener(h, stoppa, true);
        ruta.remove();
        _omritningPagar = null;
    };
    _omritningPagar = (async () => {
        try {
            for (let i = 0; i < steg.length; i++) {
                text.textContent = `Räknar om med minsta gruppstorlek ${kTroskel()} … ${i + 1} av ${steg.length}`;
                await new Promise(r => setTimeout(r, 0));   // låt webbläsaren rita förloppet
                _omritningForsok(steg[i][0], steg[i][1]);
                visningNy();   // varje steg rör det som visas (ADR-81)
            }
        } finally { klar(); }
    })();
    return _omritningPagar;
}


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
// Standardvärdet 10 matchar SCB:s rekommendation för publicerad lönestatistik på små
// grupper. Användaren kan ändra värdet (ADR-38): ett värde under standard kräver bekräftelse och visas med stående varning. Värdet
// står i metodbilagan, i exporterad diagramdata och i tabell-CSV; under standard står meningen
// om sänkt tröskel dessutom på det som kan spridas för sig (se kStampel och _kSanktNot).
const K_STANDARD = 10;
const K_MIN = 2;
const K_MAX = 1000;

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
function statGolv() { return Math.max(kInstalld(), K_STANDARD); }   // oberoende av läget: skattningarna är desamma på skärmen och i exporten

/**
 * Avgör om en gruppstorlek är under k-tröskeln.
 * @param {number} n - Antal personer i gruppen.
 * @returns {boolean}
 */
function isKMasked(n) { return n < kTroskel(); }

/**
 * Får ett KÖNSUPPDELAT lönemått redovisas (ett köns median eller percentil, ett könsgap, en
 * kostnad som räknats ur ett gap)? Varje kön ska nå tröskeln (ADR-12): annars pekar måttet ut
 * de få i det mindre könet, även när gruppen som helhet är stor nog.
 * @param {number} nKv - Antal kvinnor.
 * @param {number} nMa - Antal män.
 */
/**
 * Gränsen för "litet underlag" i ett diagram: en stapel eller ett segment som gäller färre personer än så ritas
 * med mönster och sägs vara osäkert. Det är inte en maskeringsgräns — gruppen som stapeln räknas i når redan
 * minsta gruppstorlek — utan en varning för att några få personer kan se ut som ett mönster. Fem är den gräns
 * som är vanlig för små tal i tabeller, och samma som könsskevhetstabellen använder.
 */
const LITET_UNDERLAG = 5;
function litetUnderlag() { return LITET_UNDERLAG; }

function _konFarRedovisas(nKv, nMa) {
    const k = kTroskel();
    return nKv >= k && nMa >= k;
}

/** Antal kvinnor och män i en radmängd (samma könsregler som i övriga verktyget). */
function _konAntal(rader) {
    let nKv = 0, nMa = 0;
    for (const r of rader || []) {
        if (r.kon && r.kon.includes('kvinna')) nKv++;
        else if (r.kon === 'man' || r.kon === 'män') nMa++;
    }
    return { nKv, nMa };
}

/** Får könsuppdelade lönemått för hela radmängden redovisas? */
function _konFarRedovisasFor(rader) {
    const { nKv, nMa } = _konAntal(rader);
    return _konFarRedovisas(nKv, nMa);
}

/** Meningen där ett könsuppdelat mått för hela urvalet utelämnats (samma ordalydelse som Rapportunderlaget). */
function _konUtelamnatNot() {
    return kTroskel() <= 1 ? 'Könsuppdelade lönemått redovisas inte eftersom ett av könen saknas i urvalet.'
        : `Könsuppdelade lönemått redovisas inte eftersom ett kön har färre än ${kTroskel()} ${personOrd(kTroskel())} i urvalet.`;
}

/**
 * Regressionens råa mediangap som text. Regressionen själv har ett fast golv (5 per kön, ADR-38),
 * men det råa gapet är ett beskrivande könsuppdelat mått och följer tröskeln: under den står ett
 * streck med förklaring.
 * @param {any} reg  regressionsresultatet (rawGapPct, nKvAnalysed, nMaAnalysed …)
 * @param {(v:number)=>string} fmt
 */
function _raGapText(reg, fmt) {
    if (!reg || reg.rawGapPct == null) return '–';
    return _konFarRedovisas(reg.nKvAnalysed, reg.nMaAnalysed) ? fmt(reg.rawGapPct) : (kTroskel() <= 1 ? '– (ett av könen saknas)' : `– (ett kön har färre än ${kTroskel()} ${personOrd(kTroskel())})`);
}

/**
 * Regressionens stegvisa uppdelning så som den får redovisas. Första steget ("Endast kön") är
 * skillnaden mellan könens geometriska medellöner utan någon kontroll — ett beskrivande
 * könsuppdelat mått som följer tröskeln, liksom allt som räknats ur det (förklarad andel,
 * förklaringsbudgeten). Det justerade gapet berörs inte: det visas från regressionens eget golv
 * (5 per kön, ADR-38). Beräkningen ändras inte; bara vad som visas.
 * @param {any} reg  regressionsresultatet (sequential, explainedShare, nKvAnalysed, nMaAnalysed …)
 * @returns {{steg:Array, explainedShare:number|null, utelamnat:boolean, not:string}}
 */
function _regStegForRedovisning(reg) {
    const alla = (reg && reg.sequential) || [];
    if (!reg || _konFarRedovisas(reg.nKvAnalysed, reg.nMaAnalysed)) {
        return { steg: alla, explainedShare: reg ? reg.explainedShare : null, utelamnat: false, not: '' };
    }
    return {
        steg: alla.filter(s => s.name !== 'Endast kön'),
        explainedShare: null,
        utelamnat: true,
        not: `Det ojusterade steget (endast kön) och den förklarade andelen visas inte eftersom ett kön har färre än ${kTroskel()} ${personOrd(kTroskel())} i modellen.`
    };
}

/**
 * Regressionens BAS-effekter så som de får redovisas (ADR-70, beslut 2026-11-14). Effekten för ett BAS-intervall med
 * färre personer än tröskeln ligger nära deras genomsnittliga lönenivå: den skrivs inte ut, och intervallet namnges i
 * noten (redovisningsformen i ADR-12). Är referensintervallet självt under tröskeln beskriver varje effekt dess nivå
 * baklänges; då skrivs ingen effekt ut. Modellen och dess referens (ADR-44) ändras inte; bara vad som visas. På
 * skärmen är tröskeln 1 och allt visas (ADR-51).
 * @param {any} reg  regressionsresultatet (basEffekter, basRef, basN)
 * @returns {{effekter: Array|null, utelamnade: string[], referensUtelamnad: boolean, not: string}}
 *   effekter är null när modellen inte har BAS-effekter; noten är text utan markup.
 */
function _basEffekterForRedovisning(reg) {
    const alla = reg && reg.basEffekter;
    if (!alla) return { effekter: null, utelamnade: [], referensUtelamnad: false, not: '' };
    const n = b => (reg.basN && reg.basN[b]) || 0;
    const k = kTroskel();
    if (reg.basRef != null && isKMasked(n(reg.basRef))) {
        return { effekter: [], utelamnade: alla.map(e => e.bas), referensUtelamnad: true,
            not: `BAS-effekterna visas inte här: referensintervallet, BAS ${reg.basRef}, har färre än ${k} ${personOrd(k)}, och varje effekt mot det skulle visa dess lönenivå. Personerna ingår fortfarande i modellen.` };
    }
    const utelamnade = alla.filter(e => isKMasked(n(e.bas))).map(e => e.bas);
    return { effekter: alla.filter(e => !isKMasked(n(e.bas))), utelamnade, referensUtelamnad: false,
        not: utelamnade.length ? _kMaskNoteText(utelamnade, 'BAS-intervall|BAS-intervall', k, 'deras effekt i modellen skulle visa deras genomsnittliga lönenivå', 'modellen') : '' };
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

/** Heltal K_MIN–K_MAX ur ett tal eller en sträng, annars null. Bara rena heltal godtas. */
function _kTolka(v) {
    const s = typeof v === 'number' ? String(v) : (typeof v === 'string' ? v.trim() : '');
    if (!/^\d+$/.test(s)) return null;
    const n = Number(s);
    return n >= K_MIN && n <= K_MAX ? n : null;
}

/**
 * Får ett § 3:10-par redovisas i underlaget? Båda yrkesgrupperna ska nå tröskeln. Endast fliken
 * Likvärdigt arbete och dess egen export (Excel, CSV) är undantagna (dokumenterat); alla andra utdata
 * — Rapportunderlaget, Word-utkastet, utskriften, protokollet, Att göra, handlingsplanen och
 * gruppdossiern — använder denna regel (via _parForRedovisning).
 */
function _parOverTroskel(p) { return _parNarK(p, kTroskel()); }

/** Når båda yrkesgrupperna i paret gränsen k? Ett jämförelseyrke ur statistiken (maN saknas) prövas inte. */
function _parNarK(p, k) {
    return p.kvN >= k && (p.maN == null || p.maN >= k);
}

/** Mening om par som utelämnats ur underlaget (samma ordalydelse som Rapportunderlaget). */
function _parUtelamnadeNot(antal, k = kTroskel()) {
    return antal ? `${antal} par med en grupp under ${k} ${personOrd(k)} redovisas inte här.` : '';
}

/**
 * Delar en lista § 3:10-par i de som får redovisas utanför fliken Likvärdigt arbete och antalet som
 * utelämnas. `not` är meningen om de utelämnade (tom när inga utelämnats). Ordningen bevaras och
 * objekten är desamma som i indata. Gränsen är kTroskel(), det som gäller i läget; Löneöversyns
 * förslag anger den inställda tröskeln, kInstalld(), också på skärmen (ADR-69).
 * @param {any[]} [pairs]
 * @param {number} [k]
 */
function _parForRedovisning(pairs, k = kTroskel()) {
    const alla = pairs || [];
    const par = alla.filter(p => _parNarK(p, k));
    const utelamnade = alla.length - par.length;
    return { par, utelamnade, not: _parUtelamnadeNot(utelamnade, k) };
}

/** Raden som anger den inställda tröskeln (stämpeln), på de utdata som bär den. */
function kStampel() {
    const k = kInstalld();
    return `Minsta gruppstorlek för redovisning: ${k}.`
        + (k < K_STANDARD ? ` Tröskeln är sänkt från standardvärdet ${K_STANDARD}.` : '');
}

/**
 * Tillägget för en export som medvetet kan innehålla grupper under tröskeln (dokumenterade
 * undantag: Likvärdigt arbete, och Utforska när användaren kryssat i det). Utan tillägget läses
 * stämpeln som ett löfte om att filen saknar sådana grupper.
 */
function _kUndantagNot(undantag) {
    return undantag ? `Den här filen kan även innehålla grupper under tröskeln (undantag: ${undantag}).` : '';
}

/**
 * Raden i diagramdata från ett diagram med en punkt per person (figurens `individer`, ADR-39): filen bär en rad
 * per person — lön, kön, ålder eller grupp, utan namn eller identifierare — och ska hanteras som personuppgifter
 * (beslut av produktägaren 2026-10-16). Punkterna följer tröskeln som på skärmen (individLitenFor).
 */
function kIndividRad() {
    return 'Filen innehåller en rad per person (lön, kön, ålder eller grupp; inga namn eller identifierare) och ska hanteras som personuppgifter.';
}

/** Stämpeln, med tillägget om undantag när exporten hör till ett. */
function kStampelFor(undantag) {
    return undantag ? `${kStampel()} ${_kUndantagNot(undantag)}` : kStampel();
}

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
function _kSanktNot() { return kInstalld() < K_STANDARD ? kStampel() : ''; }

/** Stycket med stämpeln för utskrifter när tröskeln är sänkt (escapat), annars tom sträng. */
function _kSanktStycke() {
    const not = _kSanktNot();
    return not ? `<p class="farg-kritisk fw-600">${esc(not)}</p>` : '';
}

/**
 * En punkt per person (spridningsdiagrammen lön mot ålder) röjer personens lön tillsammans med yrke och BAS.
 * Punkten är därför liten — den ritas inte och exporteras inte — när personens grupp (yrke inom BAS, samma
 * indelning som gruppdossiern) har färre än tröskeln, eller när personens kön har det i gruppen (ADR-12).
 * Antalen räknas på hela underlaget, inte på det urval diagrammet visar.
 * @returns {(rad:object) => boolean} sant om radens punkt är liten
 */
function individLitenFor(rader) {
    const k = kTroskel();
    const grupp = r => `${_gruppAid(r)}|${r.bas}`;
    const konAv = r => (typeof r.kon === 'string' && r.kon.includes('kvinna') ? 'kv' : (r.kon === 'man' || r.kon === 'män' ? 'ma' : 'ovr'));
    const n = new Map();
    for (const r of rader) {
        if (!(r.lon > 0) || !r.bas) continue;
        const g = grupp(r);
        n.set(g, (n.get(g) || 0) + 1);
        n.set(`${g}|${konAv(r)}`, (n.get(`${g}|${konAv(r)}`) || 0) + 1);
    }
    return r => (n.get(grupp(r)) || 0) < k || (n.get(`${grupp(r)}|${konAv(r)}`) || 0) < k;
}
function _gruppAid(r) { const m = String(r.yrke || '').match(/^(\d+)/); return m ? m[1] : String(r.yrke || ''); }

/** Sidfot med tillägg när tröskeln är sänkt under standard. */
function _kSidfot(text) {
    return kInstalld() < K_STANDARD ? `${text} · minsta gruppstorlek ${kInstalld()} (standard ${K_STANDARD})` : text;
}

const _kHarStampel = rows => rows.some(r => Array.isArray(r) && typeof r[0] === 'string' && r[0].includes('Minsta gruppstorlek för redovisning'));
/** Tabell-CSV: stämpeln som sista rad, om den inte redan står i raderna (diagramdata). */
function _csvMedStampel(rows, undantag) { return _kHarStampel(rows) ? rows : [...rows, [], [kStampelFor(undantag)]]; }
/** Tabell till urklipp: stämpeln bara när tröskeln är sänkt eller exporten hör till ett undantag. */
function _tsvMedStampel(rows, undantag) { return (_kSanktNot() || undantag) && !_kHarStampel(rows) ? [...rows, [], [kStampelFor(undantag)]] : rows; }

/** Byter {k} mot den inställda tröskeln och {golv} mot det statistiska golvet. */
function _kText(s) {
    return String(s ?? '').replace(/\{k\}/g, String(kInstalld())).replace(/\{golv\}/g, String(Math.max(kInstalld(), K_STANDARD)));
}

/** Fyller de fasta texterna i index.html som nämner talet. */
function _fyllKTexter() {
    document.querySelectorAll('[data-k-troskel]').forEach(el => { el.textContent = String(kInstalld()); });
    document.querySelectorAll('[data-k-golv]').forEach(el => { el.textContent = String(Math.max(kInstalld(), K_STANDARD)); });
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
    // Skattningarna (bootstrap-KI och styrkan läser statGolv(); § 3:10-paren läser ingen tröskel) räknas om bara när
    // golvet ändras — på 55 000 rader är bootstrapen sekunder. Det som är ritat bär den gamla tröskeln och ritas om.
    const golvAndrat = statGolv() !== golvFore;
    if (golvAndrat && typeof invalidateStatCaches === 'function') invalidateStatCaches({ recompute: false });   // räknas om i bakgrunden nedan
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
        finally { if (status) status.textContent = status.textContent.replace(NOT, ''); _bakgrundsrakning = null; resolve(); }
    }, 0));
    return _bakgrundsrakning;
}

/**
 * Ritar om det som syns efter ändrad tröskel: Översikts delar (som inläsningen ritar men renderTabContent inte
 * gör, jämför 32-filinlasning.js) och den flik som är öppen. Övriga flikar ritas om när de öppnas — navigeringen
 * ritar alltid fliken — och exporterna går genom exportgrinden (23-exportgrind.js), som ritar om en flik som inte
 * är aktuell innan något läses ur den.
 */
function _renderaOmAllaFlikar() {
    for (const [namn, fn] of _omritningssteg()) _omritningForsok(namn, fn);
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
    steg.push(['underlagets kvalitet', () => { if (typeof renderUnderlagetsKvalitet === 'function') renderUnderlagetsKvalitet(); }]);
    // Processöversikten läser samma punkter som Att göra: listan byggs en gång och skickas vidare (ingen cache).
    /** @type {any[]|undefined} */ let punkter;
    steg.push(['Att göra', () => { if (typeof renderActionChecklist === 'function') punkter = renderActionChecklist(); }]);
    steg.push(['processöversikten', () => { if (typeof renderProcessTracker === 'function') renderProcessTracker({ punkter }); }]);
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
    const HANDELSER = ['keydown', 'keyup', 'keypress', 'click', 'pointerdown', 'mousedown', 'submit', 'change', 'input'];
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
            }
        } finally { klar(); }
    })();
    return _omritningPagar;
}


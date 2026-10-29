// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson

// ---- k-anonymitet (uppgiftsminimering och inbyggt dataskydd, art. 5.1 c och 25) ----
// Grupper med färre än kTroskel() personer redovisas inte i det som lämnar verktyget, så att enskildas
// löner inte kan räknas fram via t.ex. känd åldersstruktur.
//
// Två lägen (ADR-51, beslut 2026-10-29 efter användartest): på SKÄRMEN maskeras inget — den som använder
// verktyget har redan lönefilen — och kTroskel() är då 1. Allt som LÄMNAR verktyget (Excel, Word, PDF, ZIP,
// CSV, urklipp, diagrambilder, rapportunderlaget, Dokumentera & exportera) ritas och räknas i exportläget
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
        : `Könsuppdelade lönemått redovisas inte eftersom ett kön har färre än ${kTroskel()} personer i urvalet.`;
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
    return _konFarRedovisas(reg.nKvAnalysed, reg.nMaAnalysed) ? fmt(reg.rawGapPct) : (kTroskel() <= 1 ? '– (ett av könen saknas)' : `– (ett kön har färre än ${kTroskel()} personer)`);
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
        not: `Det ojusterade steget (endast kön) och den förklarade andelen visas inte eftersom ett kön har färre än ${kTroskel()} personer i modellen.`
    };
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
function _parOverTroskel(p) {
    const k = kTroskel();
    return p.kvN >= k && (p.maN == null || p.maN >= k);
}

/** Mening om par som utelämnats ur underlaget (samma ordalydelse som Rapportunderlaget). */
function _parUtelamnadeNot(antal) {
    return antal ? `${antal} par med en grupp under ${kTroskel()} personer redovisas inte här.` : '';
}

/**
 * Delar en lista § 3:10-par i de som får redovisas utanför fliken Likvärdigt arbete och antalet som
 * utelämnas. `not` är meningen om de utelämnade (tom när inga utelämnats). Ordningen bevaras och
 * objekten är desamma som i indata.
 */
function _parForRedovisning(pairs) {
    const alla = pairs || [];
    const par = alla.filter(_parOverTroskel);
    const utelamnade = alla.length - par.length;
    return { par, utelamnade, not: _parUtelamnadeNot(utelamnade) };
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
    if (el.closest('#view-likvardighet')) return 'Likvärdigt arbete';
    // Ett diagram ritat med diagramkärnan exporteras annars utan små grupper om inte vyn uttryckligen begär
    // dem (exportMedSma): undantaget gäller bara när exporten faktiskt bär dem.
    if (el._figur) {
        const bar = typeof medSma === 'boolean' ? medSma : _rfExportFigur(el)?.visaSma;
        return bar ? 'valt i Utforska' : '';
    }
    if ((el.id === 'explore-table' || el.id === 'chart-explore') && typeof explorerSmaIExport === 'function' && explorerSmaIExport()) return 'valt i Utforska';
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
        && !confirm(`Sänka minsta gruppstorlek till ${n}?\n\nLönemått kommer att redovisas för grupper med ned till ${n} personer. `
            + `I så små grupper kan enskildas löner räknas fram. Värdet står i metodbilagan och i exporterad data, och meningen om sänkt tröskel på det som kan spridas för sig.`)) {
        _synkaKTroskel();
        return { ok: false, nekad: true };
    }
    _kVisaFel('');   // ett gammalt felmeddelande hör till ett värde som inte längre gäller
    const hojd = n > state.kTroskel;
    const golvFore = statGolv();
    state.kTroskel = n;
    state._lifecycleCache = null;
    // Skattningarna (bootstrap-KI och styrkan läser statGolv(); § 3:10-paren läser ingen tröskel) räknas om bara när
    // golvet ändras — på 55 000 rader är bootstrapen sekunder. Det som är ritat bär den gamla tröskeln och ritas om.
    const golvAndrat = statGolv() !== golvFore;
    if (golvAndrat && typeof invalidateStatCaches === 'function') invalidateStatCaches({ recompute: false });   // räknas om i bakgrunden nedan
    else if (typeof ritGenerationNy === 'function') ritGenerationNy();   // allt som är ritat hittills bär den gamla tröskeln
    // Löneöversynens förslag ur § 3:10-par som inte längre når tröskeln tas bort (egna rader står kvar).
    if (hojd && typeof _fcRensaParMal === 'function') _fcRensaParMal();
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
    // Översikt: nyckeltal, kompliansöversikt (med "Var uppstår löneskillnaden"), underlagets kvalitet,
    // processöversikten, Att göra, inläsningsrapporten, extremvärdeslistan och A/B-jämförelsen.
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

// ---------------------------------------------------------------------------
// Nationell kvinnoandel per AID (SKR:s personalstatistik, kommuner och regioner)
// ---------------------------------------------------------------------------
// Används av likvärdighetsanalysen som reserv när jämförelsestatistiken saknar
// könsfördelning per AID, för att avgöra om ett jämförelseyrke är "icke-kvinnodominerat".
// Värdena kommer ur src/lib/skr-personal.js (genererad ur SKR:s tabeller, se ADR-34):
// AID-etikettens egen andel, annars prefixets (tre första siffrorna).
//
// VIKTIGT: detta är en NATIONELL referens. Organisationens egen kvinnodominans räknas alltid
// ur den inlästa personalfilen, och organisationens egen statistik (organisationspaketet)
// har företräde framför referensen.

/**
 * Slår upp en AID-kod i SKR:s personalstatistik.
 * Klass: 'kvinnodominerat' (≥60%), 'icke-kvinnodominerat' (≤40%), 'blandat' (40–60%).
 *
 * @param {string} aid - AID-kod (sexsiffrig, eller minst tre siffror för prefixet)
 * @returns {null | {kvAndel:number, klass:string, kalla:string, prefix:string, niva:string}}
 */
/** Vilken del av SKR:s statistik som är referens: organisationstypen i profilen (ADR-34). */
function _skrDel() {
    const t = state.profile && state.profile.orgTyp;
    return t === 'kommun' || t === 'region' ? t : 'alla';
}

// Så nämns den nationella referensen i gränssnittet. "SKR" ensamt sade användarna inget; därför står
// alltid vad statistiken är (andel kvinnor per yrke), var den gäller (kommuner och regioner) och från när.
/** Perioden i ord: '2025-11' → 'november 2025'. */
function _skrPeriodText(period) {
    const [ar, man] = String(period || '').split('-');
    const namn = ['januari', 'februari', 'mars', 'april', 'maj', 'juni', 'juli', 'augusti', 'september', 'oktober', 'november', 'december'][Number(man) - 1];
    return namn && ar ? `${namn} ${ar}` : String(period || '');
}
/** Kort källtext: "SKR:s personalstatistik, november 2025". */
function skrKallaKort() { return `SKR:s personalstatistik, ${_skrPeriodText(_skrReferensInfo().period)}`; }
/** Hela förklaringen, för tooltips och metodbilagan. */
function skrForklaring() {
    return `Nationell andel kvinnor per yrke (AID-kod) i ${_skrDelText(_skrDel())}, ur ${skrKallaKort()} (SKR är Sveriges Kommuner och Regioner). `
        + 'Ett referensvärde bredvid organisationens egen könsfördelning, och reserv i Likvärdigt arbete när jämförelsestatistiken saknar könsfördelning. Valet kommun eller region görs under Inställningar.';
}

function nationellAidKlass(aid) {
    if (!aid) return null;
    const s = String(aid).trim();
    const del = _skrDel();
    const ref = /^\d{6}/.test(s) ? _skrKvinnoandel(s, { del }) : (/^\d{3}/.test(s) ? _skrKvinnoandelPrefix(s.slice(0, 3), { del }) : null);
    if (!ref) return null;
    const kvAndel = Math.round(ref.pct * 10) / 10;
    let klass;
    if (kvAndel >= 60) klass = 'kvinnodominerat';
    else if (kvAndel <= 40) klass = 'icke-kvinnodominerat';
    else klass = 'blandat';
    return { kvAndel, klass, prefix: ref.prefix || s.slice(0, 3), niva: ref.niva, del: ref.del, kalla: _skrReferensInfo().kalla };
}
// Högst så många gruppnamn räknas upp i noten innan resten summeras.
const K_NOTE_MAX_NAMN = 12;

// "grupp|grupper" -> rätt form efter antal. Anropare skickar båda formerna
// eftersom svensk pluralböjning inte går att härleda ur en ändelse.
function _kNoteForm(sammanhang, antal) {
    const delar = String(sammanhang || 'grupp|grupper').split('|');
    return antal === 1 ? delar[0] : (delar[1] || delar[0]);
}

// OBS: noterna innehåller AVSIKTLIGT ingen inline-markup. SheetJS
// (table_to_sheet) trimmar varje elements text var för sig och slår ihop dem
// utan avskiljare, så ett <strong> mitt i meningen gav "4 yrkesgruppervisas"
// i Excel-exporten. Noten är ändå visuellt avskild via .k-mask-note.
function _kNoteNamn(lista) {
    const visade = lista.slice(0, K_NOTE_MAX_NAMN).map(esc).join(', ');
    return visade + (lista.length > K_NOTE_MAX_NAMN ? ` och ${lista.length - K_NOTE_MAX_NAMN} till` : '');
}

/**
 * Not om grupper som UTELÄMNATS ur en tabell på grund av k-anonymiteten.
 *
 * En rad där varje mätvärde står som "< k" bär ingen information — den gör
 * bara tabellen längre och analysen svårare att läsa. I stället utelämnas
 * raden och gruppen redovisas här, med namn, så att handläggaren vet exakt
 * vad som saknas och varför. Uppgifterna finns i underlaget; det är
 * redovisningen per grupp som inte är tillåten.
 *
 * @param {string[]} namn        Gruppernas namn (BAS, yrke, AID …).
 * @param {string} [sammanhang]  Vad grupperna är, som "singular|plural".
 * @param {number} [trosk]       Tröskel att nämna (default kTroskel()).
 * @returns {string} HTML, eller tom sträng om inget utelämnats.
 */
function kMaskNote(namn, sammanhang, trosk) {
    const lista = (namn || []).filter(Boolean);
    if (!lista.length) return '';
    const n = lista.length;
    const t = trosk || kTroskel();
    const den = n === 1 ? 'Den har' : 'De har';
    const dess = n === 1 ? 'dess' : 'deras';
    return `<p class="k-mask-note">${n} ${esc(_kNoteForm(sammanhang, n))} visas inte här: `
        + `${_kNoteNamn(lista)}. ${den} färre än ${t} personer, och ${dess} lönemått skulle kunna `
        + `peka ut enskilda. Personerna ingår fortfarande i underlaget och i totalsummorna — det är `
        + `redovisningen per grupp som utgår.</p>`;
}

/**
 * Not om grupper där bara KÖNSUPPDELNINGEN är för liten. Gruppen som helhet
 * ligger över tröskeln, så dess samlade median får redovisas — men en
 * könsjämförelse skulle peka ut de få individerna i det mindre könet.
 *
 * @param {string[]} namn       Gruppernas namn.
 * @param {string} [sammanhang] "singular|plural".
 * @returns {string} HTML, eller tom sträng.
 */
function kSamladNote(namn, sammanhang) {
    const lista = (namn || []).filter(Boolean);
    if (!lista.length) return '';
    const n = lista.length;
    const stora = n === 1 ? 'Gruppen är stor nog' : 'Grupperna är stora nog';
    return `<p class="k-mask-note">${n} ${esc(_kNoteForm(sammanhang, n))} visas med `
        + `gruppens samlade median i stället för könsuppdelade medianer: ${_kNoteNamn(lista)}. `
        + `${stora} att redovisa, men ett av könen har färre än ${kTroskel()} personer, `
        + `så en könsjämförelse skulle peka ut enskilda.</p>`;
}

// ---- GDPR uppgiftsminimering (Art. 5(1)(c)) ----
// Vitlista över tillåtna datafält. Verktyget extraherar ENBART dessa roller
// från CSV. Alla övriga kolumner ignoreras helt även om de finns i filen.
const ALLOWED_FIELDS = {
    bas:     ["bas","basintervall"],
    // Yrke matchas via mönster på rensat kolumnnamn (lowercase, å→a, ö→o, alfanum).
    // Ordningen spelar roll — specifika mönster först, generella sist.
    //   - "aidetik"    → "AID-etikett" (export ur lönestatistiksystem)
    //   - "yrkesgrupp" → "Yrkesgrupp"
    //   - "yrke"       → "Yrke", "Yrkesnamn", "Yrkeskod"
    //   - "befattning" → "Befattning"
    //   - "aid"        → fallback för CSV som har enbart "AID"-kolumn (vanligt!)
    //                    Måste vara sist så mer-specifika mönster matchas först.
    yrke:    ["aidetik","yrkesgrupp","yrke","befattning","aid"],
    lon:     ["mnadsln","lon","ln"],
    alder:   ["lder","alder"],
    kon:     ["kon","kn"],
    // Valfri arbetsvärderingspoäng per befattning — del av strukturdatan (som BAS),
    // aktiverar poäng som krav-proxy i § 3:10. Normaliserade mönster:
    // "Poäng"→pong, "Poang"→poang, "Arbetsvärdering"→arbetsvrdering.
    poang:   ["pong","poang","arbetsvrdering","arbetsvardering"],
    // Valfri ansvarskod enligt AID (ADR-33): "Ansvarskod", "AID-ansvar",
    // "Ansvarsnivå". Kolumnen "Ansvar" (oftast ett kostnadsställe) läses aldrig — själva
    // kolumnen väljs med _hittaAnsvarKolumn, och den godkänns bara med ≥ 95 % giltiga värden.
    ansvar:  ["ansvarskod","aidansvar","ansvarsniv"]
};

/**
 * Kolumnen med AID:s ansvarskod: manuell mappning först, annars första rubrik som
 * _anArRubrik känner igen. Aldrig kolumnen "Ansvar".
 * @param {string[]} rubriker
 * @returns {string|null}
 */
function _hittaAnsvarKolumn(rubriker) {
    // "— ingen —" i kolumnmappningen sparas som tom sträng: då läses ingen ansvarskod alls.
    if (state.columnMap && state.columnMap.ansvar === '') return null;
    const manuell = state.columnMap && state.columnMap.ansvar;
    if (manuell && (rubriker || []).includes(manuell)) return manuell;
    return (rubriker || []).find(r => _anArRubrik(r)) ?? null;
}

/**
 * Godkänner ansvarskodskolumnen om minst 95 % av de ifyllda värdena är giltiga.
 * @returns {{namn:string, godkand:boolean, giltiga:number|null}}
 */
function _bedomAnsvarKolumn(namn, varden) {
    const giltiga = _anAndelGiltiga(varden);
    return { namn, godkand: giltiga != null && giltiga >= 0.95, giltiga };
}

/**
 * Strikt parser för yrke-fältet (GDPR Art. 25.1).
 *
 * Källsystem exporterar ofta yrke som "12345 — Sjuksköterska — Anna Andersson 75%"
 * eller liknande. Vi vill bara behålla AID-koden + en kort rollbeskrivning.
 * Allt annat trunkeras eller maskeras:
 *   - AID:                ledande siffergrupp (\d+)
 *   - Etikett:            första 40 tecken efter AID + separator
 *   - Namn-mönster:       "Förnamn Efternamn" maskeras till *** även inom etiketten
 *   - Resten:             droppas
 *
 * @param {*} raw - Rått värde från CSV-cellen.
 * @returns {string} "AID Etikett" eller bara AID/etikett om endera saknas.
 */
function _cleanYrkeField(raw) {
    if (!raw) return "";
    const s = raw.toString().trim();
    if (!s) return "";
    const aidMatch = s.match(/^(\d+)/);
    const aid = aidMatch ? aidMatch[1] : "";
    // Etikett = resten efter AID och vanliga separatorer (—, -, :, ., whitespace)
    let label = s.replace(/^\d+\s*[—\-:.\s]*/, '').trim();
    // Aggressiv trunkering — yrkesetiketter sällan över 40 tecken
    if (label.length > 40) label = label.substring(0, 40).trim() + '…';
    // Defensivt: maskera "Förnamn Efternamn" om något ändå smugit sig in
    // OBS: \b fungerar inte före icke-ASCII-bokstäver (Å/Ä/Ö), så namn som
    // "Örjan Östberg" skulle inte maskeras. Unicode-säker ordgräns via fångad
    // föregående icke-bokstav ($1) — undviker lookbehind (stöds ej i Safari < 16.4).
    label = label.replace(/(^|[^A-Za-zÅÄÖåäö])([A-ZÅÄÖ][a-zåäö]+\s+[A-ZÅÄÖ][a-zåäö]+)/g, '$1***');
    // Härd mot XSS-tecken vid inläsning.
    // Strippar HTML-meta-tecken < > " ' & så de aldrig kan smitas in i en
    // innerHTML-template ens om en framtida renderingsplats glömmer esc().
    // Detta är "defensive depth" — CSP + esc() + cleanYrkeField; tre lager.
    label = label.replace(/[<>"'&]/g, '');
    if (aid && label) return `${aid} ${label}`;
    return aid || label;
}

/**
 * Extraherar ENBART vitlistade fält ur en CSV-rad — GDPR Art. 5(1)(c) uppgiftsminimering.
 * Säkerställer att verktyget aldrig laddar identifierande fält (PNR, namn, e-post)
 * även om användarens CSV innehåller dem. Ansvar läses inte in (se §2 i teknisk-plan.md).
 * Yrke saneras via _cleanYrkeField (AID + 40 tecken etikett, namn-mönster maskeras).
 * @param {Object<string,*>} row - Rå CSV-rad (PapaParse-objekt).
 * @returns {{bas:string, yrke:string, lon:number, alder:number, kon:string}}
 */
/**
 * Normaliserar kön-värden från olika personalsystem till verktygets kanoniska
 * 'kvinna'/'man'. Hanterar förkortningar (K/Kv/M), engelska exportvärden
 * (F/Female/M/Male, W/Woman) och plural ("Kvinnor"/"Män").
 *
 * Åäö bevaras innan värdet slås upp, så att "Män" mappas till 'man' (en
 * normalisering som stryker alla icke-[a-z]-tecken skulle göra det till "mn").
 *
 * Siffervärden (t.ex. "1"/"2") mappas medvetet INTE — kodningen är system-
 * specifik och en gissning vore farligare än att visa raderna som "okänt kön"
 * i inläsningsrapporten (exempelvärdena visas där).
 *
 * @param {*} raw - Råvärde från kön-kolumnen.
 * @returns {string} 'kvinna' | 'man' | normaliserad reststräng (okänd).
 */
/**
 * Normaliserar BAS-värden: trimma, versalisera och strippa ev. "BAS"-prefix
 * ("BAS A" → "A", "bas-2" → "2") så samma intervall inte splittras i två
 * kategorier beroende på exportformat. Ett ensamt "BAS" lämnas orört.
 * @param {*} raw
 * @returns {string}
 */
/**
 * Median via iterativ quickselect — O(n) i snitt mot sorteringens O(n log n).
 * Ger EXAKT samma värde som sortera-och-ta-mitten (medianen är deterministisk
 * för en given multiset; bara sökvägen dit skiljer). Deterministisk pivot
 * (median-av-tre) — konsumerar inte Math.random, så seedade testkörningar
 * (golden-exporterna) påverkas inte.
 *
 * MUTERAR arrayen (partiell omordning) — använd på resample-buffertar i
 * bootstrap-loopar, inte på delade arrayer. Med den tar computeBootstrapCI på
 * 20 000 rader under 1 s (sortering per resample tar flera sekunder).
 *
 * @param {number[]} a - Talbuffert (muteras).
 * @returns {number} Medianen; 0 för tom array.
 */
function _quickMedian(a) {
    const n = a.length;
    if (!n) return 0;
    const select = k => {
        let lo = 0, hi = n - 1;
        while (hi > lo) {
            // Median-av-tre-pivot: robust mot redan (delvis) ordnade buffertar
            const mid = (lo + hi) >> 1;
            if (a[mid] < a[lo]) { const t = a[lo]; a[lo] = a[mid]; a[mid] = t; }
            if (a[hi]  < a[lo]) { const t = a[lo]; a[lo] = a[hi];  a[hi]  = t; }
            if (a[hi]  < a[mid]) { const t = a[mid]; a[mid] = a[hi]; a[hi] = t; }
            const pivot = a[mid];
            let i = lo, j = hi;
            while (i <= j) {
                while (a[i] < pivot) i++;
                while (a[j] > pivot) j--;
                if (i <= j) { const t = a[i]; a[i] = a[j]; a[j] = t; i++; j--; }
            }
            if (k <= j) hi = j;
            else if (k >= i) lo = i;
            else return a[k];
        }
        return a[k];
    };
    const k = n >> 1;
    const upper = select(k);
    if (n & 1) return upper;
    // Jämn längd: undre mittvärdet = max i vänsterhalvan (allt ≤ a[k] efter select)
    let m = a[0];
    for (let i = 1; i < k; i++) if (a[i] > m) m = a[i];
    return (m + upper) / 2;
}

/**
 * Tar bort HTML-metatecken (< > " ' &) ur ett textfält vid inläsning. esc() vid
 * rendering är det egentliga skyddet; detta är ett extra lager ("defensive depth")
 * för korta koder (BAS, AID) som renderas i attribut- och option-kontext och som
 * aldrig legitimt innehåller tecknen. Delas av lönefilen (_normalizeBas),
 * ställningstagandet (_normalizePolicyAid) och jämförelsestatistiken.
 */
function _stripHtmlMeta(s) {
    return s.toString().replace(/[<>"'&]/g, '');
}

function _normalizeBas(raw) {
    if (!raw) return "";
    // Strippar HTML-meta-tecken (< > " ' &) vid inläsning som extra XSS-lager:
    // BAS renderas i attributkontext (data-bas="…", <option value="…">). esc()
    // escapear också citattecken, men detta är samma "defensive depth" som
    // _cleanYrkeField — BAS är legitimt korta koder (A, B, 1…) så det är ofarligt.
    const v = _stripHtmlMeta(raw).trim().toUpperCase();
    return v.replace(/^BAS\b[\s\-_:]*/i, '').trim() || v;
}

/**
 * Normaliserar AID i det lönepolitiska ställningstagandet så att den matchar
 * den AID som härleds ur lönedatans yrkesfält (`r.yrke.match(/^(\d+)/)`).
 * Tar sifferprefixet när det finns ("207 Förskollärare" → "207"), annars den
 * rensade strängen. Tom sträng betyder "ingen AID" (= BAS-nivårad).
 */
function _normalizePolicyAid(raw) {
    if (!raw) return "";
    const v = _stripHtmlMeta(raw).trim();
    const m = v.match(/^(\d+)/);
    return m ? m[1] : v;
}

function _normalizeKon(raw) {
    if (!raw) return "";
    const s = raw.toString().toLowerCase().replace(/[^a-zåäö]/g, '');
    const MAP = {
        k: 'kvinna', kv: 'kvinna', kvinna: 'kvinna', kvinnor: 'kvinna',
        f: 'kvinna', female: 'kvinna', w: 'kvinna', woman: 'kvinna',
        m: 'man', ma: 'man', man: 'man', 'män': 'man', male: 'man'
    };
    return MAP[s] || s;
}

function extractMinimalRecord(row) {
    const basRaw    = getField(row, ALLOWED_FIELDS.bas, 'bas');
    const konRaw    = getField(row, ALLOWED_FIELDS.kon, 'kon');
    // Använd parseNumberStrict så vi kan särskilja
    // legit-tomma fält från icke-tomma men ogiltiga värden.
    const lonParsed   = parseNumberStrict(getField(row, ALLOWED_FIELDS.lon, 'lon'));
    const alderParsed = parseNumberStrict(getField(row, ALLOWED_FIELDS.alder, 'alder'));
    // Valfri arbetsvärderingspoäng (per befattning) — null när kolumn saknas/tom.
    const poangParsed = parseNumberStrict(getField(row, ALLOWED_FIELDS.poang, 'poang'));
    const yrkeFull    = _cleanYrkeField(getField(row, ALLOWED_FIELDS.yrke, 'yrke'));
    // AID och etikett hålls isär. `r.yrke` är "AID Etikett"-strängen (den som vyerna visar);
    // `r.aid` och `r.yrkeLabel` ger ren AID-kod respektive enbart etikett-delen
    // för analyser som behöver något entydigt nyckel (t.ex. § 3:10-paret).
    const aidMatch = yrkeFull.match(/^(\d+)/);
    const aid      = aidMatch ? aidMatch[1] : "";
    const yrkeLabel = aid ? yrkeFull.replace(/^\d+\s*/, '').trim() : yrkeFull;
    // Ålderskolumnen innehåller ibland FÖDELSEÅR (1900–<år−15>) i stället för
    // ålder — ett värde ≥ 1900 är omöjligt som ålder, så omtolkningen är säker.
    // Statusen 'birthyear' räknas i inläsningsrapporten (transparens).
    let alderVal = alderParsed.value;
    /** @type {string} */ let alderStatus = alderParsed.status;
    if (alderStatus === 'ok' && alderVal >= 1900 && alderVal <= new Date().getFullYear() - 15) {
        alderVal = new Date().getFullYear() - alderVal;
        alderStatus = 'birthyear';
    }
    return {
        bas:       _normalizeBas(basRaw),
        yrke:      yrkeFull,
        aid,
        yrkeLabel,
        lon:       lonParsed.value,
        alder:     alderVal,
        kon:       _normalizeKon(konRaw),
        poang:     poangParsed.status === 'ok' ? poangParsed.value : null,
        // AID:s ansvarskod (valfri): koderna för kodkontrollen, ansvarsgruppen för analyserna.
        // Ett ogiltigt enskilt värde i en godkänd kolumn räknas som "inget särskilt ansvar".
        ansvarskoder: state.ansvarKolumn ? (_anTolka(row[state.ansvarKolumn.namn]) ?? []) : null,
        ansvarsgrupp: state.ansvarKolumn ? _anGrupp(_anTolka(row[state.ansvarKolumn.namn]) ?? []) : null,
        // Spårning av parse-status — används av uppladdarens
        // räknare för att kunna visa "X icke-tomma fält var ogiltiga".
        // Tas bort från record innan det landar i state.data (steg nedan).
        _lonStatus:   lonParsed.status,
        _alderStatus: alderStatus
    };
}

/**
 * PNR-detektor: identifierar kolumner som innehåller personnummer, e-post eller namn.
 * Kombinerar headerbaserad upptäckt (rubrikens namn) med värdebaserad upptäckt
 * (samplar 50 rader och matchar mot regex). Trösklar är konservativa för att minimera
 * falska positiv på godtyckliga sifferserier (t.ex. anställningsnummer).
 * @param {Array<Object>} rows - Råa CSV-rader.
 * @returns {Array<{col:string, reason:string}>} Tom array om inga känsliga kolumner.
 */
function detectSensitiveColumns(rows) {
    if (!rows || !rows.length) return [];
    const sample = rows.slice(0, Math.min(50, rows.length));
    const cols = Object.keys(rows[0] || {});
    // Strikt PNR-mönster: kräver giltig månad (01-12) och dag (01-31) för att undvika
    // falska träffar på godtyckliga sifferserier som anställningsnummer.
    const PNR  = /^(?:19|20)?\d{2}[-/]?[01]\d[-/]?[0-3]\d[-+]?\d{4}$/;
    const NAME = /^[A-ZÅÄÖ][a-zåäö]+(?:[ -][A-ZÅÄÖ][a-zåäö]+){1,3}$/; // "Anna Andersson" / "Anna-Lisa Berg"

    const issues = [];
    cols.forEach(col => {
        // Rubriken normaliseras: gemener, å/ä→a och ö→o, övriga tecken bort — så att
        // "Förnamn", "Fornamn" och "FÖRNAMN" alla matchar mönstren nedan.
        const lcCol = col.toLowerCase().replace(/[åä]/g, 'a').replace(/ö/g, 'o').replace(/[^a-z0-9]/g, '');
        // Header-baserad upptäckt
        if (/personnummer|personnr|^pnr$|socialsecurity|ssn/.test(lcCol)) {
            issues.push({ col, reason: 'Kolumnrubriken antyder personnummer' });
            return;
        }
        if (/^epost$|^email$|^mail$|epostadress|emailaddress/.test(lcCol)) {
            issues.push({ col, reason: 'Kolumnrubriken antyder e-postadress' });
            return;
        }
        if (/^namn$|fornamn|efternamn|fullname|^name$/.test(lcCol)) {
            issues.push({ col, reason: 'Kolumnrubriken antyder personnamn' });
            return;
        }
        // Värdebaserad upptäckt (samplar 50 rader)
        let pnrCount = 0, emailCount = 0, nameCount = 0;
        sample.forEach(r => {
            const v = (r[col] ?? '').toString().trim();
            if (!v) return;
            if (PNR.test(v)) pnrCount++;
            else if (v.includes('@') && /\.[a-z]{2,}$/i.test(v)) emailCount++;
            else if (NAME.test(v)) nameCount++;
        });
        if (pnrCount >= 3)        issues.push({ col, reason: `Innehåller värden i personnummer-format (${pnrCount} av ${sample.length} sampelvärden matchar)` });
        else if (emailCount >= 3) issues.push({ col, reason: `Innehåller e-postadresser (${emailCount} av ${sample.length} sampelvärden)` });
        else if (nameCount >= 5)  issues.push({ col, reason: `Innehåller troligtvis personnamn (${nameCount} av ${sample.length} sampelvärden)` });
    });
    return issues;
}

// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
/**
 * Öppen lönekartläggning — tolkningen av indata: talen, könet, BAS-intervallet, AID-koden i ställningstagandet,
 * fältet för AID-etikett (yrket), kärnan i uppgiftsminimeringen (en lönerad → de vitlistade fälten) och detektorn
 * för känsliga kolumner.
 *
 * Funktionerna är rena: inget tillstånd och ingen klocka. Vilken kolumn som bär vilket fält avgör appen
 * (getField och ALLOWED_FIELDS i src/app/, med kolumnmappningen, importprofilen och ansvarskolumnen), och året som ett
 * födelseår i ålderskolumnen räknas mot skickas in. Funktionerna behåller namnen de hade i appen.
 *
 * Webbläsarbygget får en AUTO-GENERERAD spegel i src/app/09-lib-speglar.js.
 */
import { tolkaAnsvarskod as _anTolka, ansvarsgrupp as _anGrupp } from './ansvar.js';

// ---- Talen ----

/**
 * Normaliserar en talsträng med svensk/engelsk/tysk formatering till en
 * parseFloat-bar sträng. Hanterar tusentalsavgränsare korrekt:
 *   "32 500,50" → "32500.50"   (svensk: mellanslag-tusental, komma-decimal)
 *   "32.500,50" → "32500.50"   (tysk/Excel: punkt-tusental, komma-decimal)
 *   "1,234,567.89" → "1234567.89" (engelsk: komma-tusental, punkt-decimal)
 *   "32,500" → "32500"          (ensam separator + exakt 3 siffror = tusental;
 *                                 löner skrivs inte med tre decimaler)
 *   "32,5" / "32.5" → "32.5"    (decimal)
 *
 * Att bara byta FÖRSTA kommat mot punkt och stryka övriga tecken skulle tyst
 * göra "32.500,50" → 32.5 — tusenfalt fel som inte fångas eftersom 32,5 > 0. Regel: när både . och , förekommer är den SISTA
 * decimaltecken; ensam separator följd av exakt 3-siffergrupper (och
 * heltalsdel ≠ "0") tolkas som tusental.
 *
 * @param {*} raw - Råvärde från CSV-/Excel-cell.
 * @returns {string} parseFloat-bar sträng ("" om inget numeriskt innehåll).
 */
export function _normalizeNumberString(raw) {
    let s = raw.toString().trim()
        .replace(/[\s  ']/g, '')       // mellanslag, NBSP, smal NBSP, apostrof-tusental
        .replace(/(kr|sek|:-)\.?$/i, '')          // valutasuffix
        .replace(/\u2212/g, '-');                  // minustecknet som verktyget och Intl skriver (annars tappas tecknet)
    s = s.replace(/[^\d.,\-]/g, '');
    const lastDot = s.lastIndexOf('.'), lastComma = s.lastIndexOf(',');
    if (lastDot !== -1 && lastComma !== -1) {
        // Båda förekommer: den sista är decimaltecknet, den andra tusental.
        if (lastComma > lastDot) s = s.replace(/\./g, '').replace(/,/g, '.');
        else                     s = s.replace(/,/g, '');
    } else if (lastComma !== -1) {
        // Endast komma: flera kommatecken = tusental; ensamt komma med exakt
        // 3-siffergrupper (t.ex. "32,500" / "1,234,567") = tusental; annars decimal.
        if (/^-?[1-9]\d{0,2}(,\d{3})+$/.test(s)) s = s.replace(/,/g, '');
        else                                      s = s.replace(/,/g, '.');
    } else if (lastDot !== -1) {
        // Endast punkt: spegelvänd regel — "32.500" är tusental, "32.5" decimal.
        if (/^-?[1-9]\d{0,2}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
        // annars: punkt är redan decimaltecken
    }
    return s;
}

export function parseNumber(v) {
    if (v == null) return 0;
    const n = parseFloat(_normalizeNumberString(v));
    return isNaN(n) ? 0 : n;
}

/**
 * Graderad version av parseNumber som spårar varför
 * en parse misslyckas. Distinguerar tre fall:
 *   - 'empty'   — null/undefined/tom sträng (legitim avsaknad)
 *   - 'invalid' — icke-tomt värde som inte kan tolkas (t.ex. "saknas")
 *   - 'ok'      — giltigt nummer returneras som number
 *
 * Anroparen kan räkna varje kategori separat och visa "icke-tom men ogiltig"-
 * antalet i audit-panelen så användaren ser dataspecifika kvalitetsproblem
 * som annars maskerats av tysta 0-konverteringar.
 *
 * @param {*} v
 * @returns {{status:'ok'|'empty'|'invalid', value:number, raw:*}}
 */
export function parseNumberStrict(v) {
    if (v == null) return { status: 'empty', value: 0, raw: v };
    const raw = v.toString();
    if (raw.trim() === '') return { status: 'empty', value: 0, raw };
    const n = parseFloat(_normalizeNumberString(raw));
    if (isNaN(n)) return { status: 'invalid', value: 0, raw };
    return { status: 'ok', value: n, raw };
}

// ---- Textfälten: AID-etiketten, BAS, AID i ställningstagandet och kön ----

/**
 * Strikt parser för yrke-fältet (GDPR Art. 25.1).
 *
 * Källsystem exporterar ofta yrke som "12345 — Sjuksköterska — Anna Andersson 75%"
 * eller liknande. Vi vill bara behålla AID-koden + en kort rollbeskrivning.
 * Allt annat trunkeras eller maskeras:
 *   - AID:                ledande siffergrupp (\d+)
 *   - Etikett:            resten efter AID + separator, med HTML-tecknen < > " ' & borttagna
 *   - Namn-mönster:       en maximal följd av två eller fler versalinledda ord i rad (varje ord med gemener efter
 *                         första bokstaven; "Anna-Lisa" räknas som ett ord) maskeras till ETT *** även inom etiketten.
 *                         "Efternamn, Förnamn" (i versaler eller Versal-gemener) maskeras också, med de versalinledda
 *                         ord som följer direkt efter förnamnet ("Andersson, Anna Berg" → ***).
 *   - Längd:              etiketten kortas till 40 tecken sist, efter maskeringen, så att ett namn aldrig klipps
 *                         mitt itu och lämnar ett halvt namn kvar
 *   - Resten:             droppas
 *
 * Ordningen är avsiktlig: rensning av tecknen först (så att "<Anna> <Andersson>" blir ett namn som maskeras), maskering
 * sedan, trunkering sist. Känd gräns: en etikett med versal på varje ord ("Biträdande Rektor") maskeras helt, så att
 * inget halvt namn blir kvar. Priset är att sådan etikett försvinner, medan AID-koden står kvar och analysen bygger på
 * den. Namn i enbart gemener ("anna andersson") och enbart VERSALER utan komma ("ANNA ANDERSSON") maskeras inte, och
 * "ANDERSSON, Anna" (blandad form) maskeras inte heller. Ett enda versalinlett ord maskeras aldrig, så "Sjuksköterska"
 * och "IT-tekniker" står kvar. "Chef, enhet" (gemen efter kommat) maskeras inte.
 *
 * @param {*} raw - Rått värde från CSV-cellen.
 * @returns {string} "AID Etikett" eller bara AID/etikett om endera saknas.
 */
export function _cleanYrkeField(raw) {
    if (!raw) return "";
    const s = raw.toString().trim();
    if (!s) return "";
    const aidMatch = s.match(/^(\d+)/);
    const aid = aidMatch ? aidMatch[1] : "";
    // Etikett = resten efter AID och vanliga separatorer (—, -, :, ., whitespace)
    let label = s.replace(/^\d+\s*[—\-:.\s]*/, '').trim();
    // Härd mot XSS-tecken vid inläsning.
    // Strippar HTML-meta-tecken < > " ' & så de aldrig kan smitas in i en
    // innerHTML-template ens om en framtida renderingsplats glömmer esc().
    // Detta är "defensive depth" — CSP + esc() + cleanYrkeField; tre lager.
    // Körs FÖRST: annars gömmer tecknen ett namn ("<Anna> <Andersson>") för maskeringen.
    label = label.replace(/[<>"'&]/g, '');
    // Defensivt: maskera namn om något ändå smugit sig in
    // OBS: \b fungerar inte före icke-ASCII-bokstäver (Å/Ä/Ö), så namn som
    // "Örjan Östberg" skulle inte maskeras. Unicode-säker ordgräns via fångad
    // föregående icke-bokstav ($1) — undviker lookbehind (stöds ej i Safari < 16.4).
    // "Efternamn, Förnamn": två ord med komma emellan, båda i versaler eller båda i Versal-gemener. Följs förnamnet
    // direkt av fler versalinledda ord tas de med, så att inget halvt namn blir kvar ("Andersson, Anna Berg").
    // Körs FÖRE följdregeln, som då inte hinner dela upp namnet.
    label = label.replace(/(^|[^A-Za-zÅÄÖåäö])([A-ZÅÄÖ]{2,}(?:-[A-ZÅÄÖ]{2,})?, [A-ZÅÄÖ]{2,}(?:-[A-ZÅÄÖ]{2,})?(?:\s+[A-ZÅÄÖ][A-Za-zÅÄÖåäö]*)*|[A-ZÅÄÖ][a-zåäö]+(?:-[A-ZÅÄÖ][a-zåäö]+)?, [A-ZÅÄÖ][a-zåäö]+(?:-[A-ZÅÄÖ][a-zåäö]+)?(?:\s+[A-ZÅÄÖ][A-Za-zÅÄÖåäö]*)*)(?![A-Za-zÅÄÖåäö])/g, '$1***');
    // Hela följden av versalinledda ord i rad maskeras till ETT ***, så att inget halvt namn blir kvar efter en befattning.
    // Ett ord räcker inte ("Sjuksköterska"), och ett ord med gemen efter första bokstaven bryter följden ("Lärare grundskola").
    label = label.replace(/(^|[^A-Za-zÅÄÖåäö])([A-ZÅÄÖ][a-zåäö]+(?:-[A-ZÅÄÖ][a-zåäö]+)?(?:\s+[A-ZÅÄÖ][a-zåäö]+(?:-[A-ZÅÄÖ][a-zåäö]+)?)+)(?![A-Za-zÅÄÖåäö])/g, '$1***');
    // Aggressiv trunkering sist — yrkesetiketter sällan över 40 tecken
    if (label.length > 40) label = label.substring(0, 40).trim() + '…';
    if (aid && label) return `${aid} ${label}`;
    return aid || label;
}

/**
 * Tar bort HTML-metatecken (< > " ' &) ur ett textfält vid inläsning. esc() vid
 * rendering är det egentliga skyddet; detta är ett extra lager ("defensive depth")
 * för korta koder (BAS, AID) som renderas i attribut- och option-kontext och som
 * aldrig legitimt innehåller tecknen. Delas av lönefilen (_normalizeBas),
 * ställningstagandet (_normalizePolicyAid) och jämförelsestatistiken.
 */
export function _stripHtmlMeta(s) {
    return s.toString().replace(/[<>"'&]/g, '');
}

/**
 * Normaliserar BAS-värden: trimma, versalisera och strippa ev. "BAS"-prefix
 * ("BAS A" → "A", "bas-2" → "2") så samma intervall inte splittras i två
 * kategorier beroende på exportformat. Ett ensamt "BAS" lämnas orört.
 * @param {*} raw
 * @returns {string}
 */
export function _normalizeBas(raw) {
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
export function _normalizePolicyAid(raw) {
    if (!raw) return "";
    const v = _stripHtmlMeta(raw).trim();
    const m = v.match(/^(\d+)/);
    return m ? m[1] : v;
}

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
export function _normalizeKon(raw) {
    if (!raw) return "";
    const s = raw.toString().toLowerCase().replace(/[^a-zåäö]/g, '');
    const MAP = {
        k: 'kvinna', kv: 'kvinna', kvinna: 'kvinna', kvinnor: 'kvinna',
        f: 'kvinna', female: 'kvinna', w: 'kvinna', woman: 'kvinna',
        m: 'man', ma: 'man', man: 'man', 'män': 'man', male: 'man'
    };
    return MAP[s] || s;
}

// ---- En lönerad ----

/**
 * Kärnan i uppgiftsminimeringen (GDPR Art. 5(1)(c)): de vitlistade fälten ur en lönerad, tolkade och normaliserade.
 * Appen slår upp råvärdena i raden (extractMinimalRecord i src/app/06-uppgiftsminimering.js, med getField och
 * ALLOWED_FIELDS) och skickar in dem här; inga andra kolumner når hit.
 * Yrke saneras via _cleanYrkeField (AID + 40 tecken etikett, namn-mönster maskeras).
 * Ger { bas, yrke, aid, yrkeLabel, lon, alder, kon, poang, ansvarskoder, ansvarsgrupp, _lonStatus, _alderStatus }.
 * @param {{bas:*, kon:*, lon:*, alder:*, poang:*, yrke:*, ansvar?:*}} falt - Råvärdet per roll ur raden.
 * @param {number} referensar - Året som ett födelseår i ålderskolumnen räknas mot (appen skickar innevarande år).
 * @param {boolean} [medAnsvar] - Om en godkänd kolumn för AID:s ansvarskod finns; falt.ansvar är radens värde i den.
 */
export function tolkaLonerad(falt, referensar, medAnsvar = false) {
    const basRaw    = falt.bas;
    const konRaw    = falt.kon;
    // Använd parseNumberStrict så vi kan särskilja
    // legit-tomma fält från icke-tomma men ogiltiga värden.
    const lonParsed   = parseNumberStrict(falt.lon);
    const alderParsed = parseNumberStrict(falt.alder);
    // Valfri arbetsvärderingspoäng (per befattning) — null när kolumn saknas/tom.
    const poangParsed = parseNumberStrict(falt.poang);
    const yrkeFull    = _cleanYrkeField(falt.yrke);
    // AID och etikett hålls isär. `r.yrke` är "AID Etikett"-strängen (den som vyerna visar);
    // `r.aid` och `r.yrkeLabel` ger ren AID-kod respektive enbart etikett-delen
    // för analyser som behöver något entydigt nyckel (t.ex. § 3:10-paret).
    const aidMatch = yrkeFull.match(/^(\d+)/);
    const aid      = aidMatch ? aidMatch[1] : "";
    const yrkeLabel = aid ? yrkeFull.replace(/^\d+\s*/, '').trim() : yrkeFull;
    // Ålderskolumnen innehåller ibland FÖDELSEÅR (1900–<referensår−15>) i stället för
    // ålder — ett värde ≥ 1900 är omöjligt som ålder, så omtolkningen är säker.
    // Statusen 'birthyear' räknas i inläsningsrapporten (transparens).
    let alderVal = alderParsed.value;
    /** @type {string} */ let alderStatus = alderParsed.status;
    if (alderStatus === 'ok' && alderVal >= 1900 && alderVal <= referensar - 15) {
        alderVal = referensar - alderVal;
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
        ansvarskoder: medAnsvar ? (_anTolka(falt.ansvar) ?? []) : null,
        ansvarsgrupp: medAnsvar ? _anGrupp(_anTolka(falt.ansvar) ?? []) : null,
        // Spårning av parse-status — används av uppladdarens
        // räknare för att kunna visa "X icke-tomma fält var ogiltiga".
        // Tas bort från record innan det landar i appens state.data (32-filinlasning.js).
        _lonStatus:   lonParsed.status,
        _alderStatus: alderStatus
    };
}

/**
 * Steget mellan raderna som PII-kontrollen samplar i en fil med n rader: ⌈n/50⌉ (minst 1), så att högst 50 rader
 * sprids jämnt över filen (B4). Delas av detectSensitiveColumns och den strömmande CSV-inläsningen.
 * @param {number} n
 */
export function _pnrSampelSteg(n) {
    return Math.max(1, Math.ceil(n / 50));
}

/**
 * PNR-detektor: identifierar kolumner som innehåller personnummer, e-post eller namn.
 * Kombinerar headerbaserad upptäckt (rubrikens namn) med värdebaserad upptäckt
 * (samplar 50 rader jämnt över filen, var ⌈n/50⌉:e rad, och matchar mot regex). Trösklar är konservativa för att
 * minimera falska positiv på godtyckliga sifferserier (t.ex. anställningsnummer). Den strömmande CSV-inläsningen
 * samlar själv var ⌈n/50⌉:e rad (_pnrSampelSteg) och lämnar högst 50 rader hit.
 * @param {Array<Object>} rows - Råa CSV-rader.
 * @returns {Array<{col:string, reason:string}>} Tom array om inga känsliga kolumner.
 */
export function detectSensitiveColumns(rows) {
    if (!rows || !rows.length) return [];
    // Jämnt över filen (B4): personnummer eller namn som bara finns längre ned ska också hittas.
    const steg = _pnrSampelSteg(rows.length);
    const sample = rows.filter((_, i) => i % steg === 0);
    const cols = Object.keys(rows[0] || {});
    // Strikt PNR-mönster: kräver giltig månad (01-12) och dag (01-31) för att undvika
    // falska träffar på godtyckliga sifferserier som anställningsnummer.
    const PNR  = /^(?:19|20)?\d{2}[-/]?[01]\d[-/]?[0-3]\d[-+]?\d{4}$/;
    // Personnamn (B4): två till fyra ord, med eller utan efternamnet först följt av komma — "Anna Andersson",
    // "Anna-Lisa Berg", "ANDERSSON, ANNA", "anna andersson". Alla ord har samma form (Versal-gemener, VERSALER eller
    // gemener), så att befattningar som "Lärare grundskola" (stor bokstav bara först) inte räknas som namn.
    const ORD = /^\p{L}{2,}(?:-\p{L}{2,})?$/u;
    /** @param {string} w */
    const form = w => (/^\p{Lu}\p{Ll}+(?:-\p{Lu}\p{Ll}+)?$/u.test(w) ? 'T' : w === w.toUpperCase() ? 'U' : w === w.toLowerCase() ? 'L' : '');
    /** @param {string} v */
    const liknarNamn = v => {
        const delar = v.split(',');
        if (delar.length > 2 || delar.some(d => !d.trim())) return false;
        const ord = delar.flatMap(d => d.trim().split(/[ ]+/));
        if (ord.length < 2 || ord.length > 4 || !ord.every(w => ORD.test(w))) return false;
        const f = form(ord[0]);
        return f !== '' && ord.every(w => form(w) === f);
    };

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
        // Särskilda kategorier av personuppgifter (fackmedlemskap, hälsa, etnicitet, religion, politisk
        // åskådning, sexualliv, genetik, biometri): hör inte hemma i underlaget och ska inte ens passera
        // minnet. Bara rubriken prövas; värdena saknar igenkännbart format. Mönstren är valda så att
        // vanliga rubriker går fria: "sjuk" kräver frånvaro/skrivning/dom (inte Sjukhus), "politisk" inte
        // Lönepolitik, "religion" som eget ord (inte Religionskunskap), "fack" följt av medlem/lig/forbund/foren
        // (inte Fackområde).
        if (/fack(medlem|lig|forbund|foren)|^medlemskap|halsa|halsotillstand|sjuk(franvaro|skriv|dom)|diagnos|etni(sk|citet)|^religion$|trosuppfattning|politisk|sexuel|funktionsned|genetisk|biometri/.test(lcCol)) {
            issues.push({ col, reason: 'Kolumnrubriken antyder en särskild kategori av personuppgifter (fackmedlemskap, hälsa, etnicitet eller liknande)' });
            return;
        }
        // Värdebaserad upptäckt (samplar 50 rader)
        let pnrCount = 0, emailCount = 0, nameCount = 0;
        sample.forEach(r => {
            const v = (r[col] ?? '').toString().trim();
            if (!v) return;
            if (PNR.test(v)) pnrCount++;
            else if (v.includes('@') && /\.[a-z]{2,}$/i.test(v)) emailCount++;
            else if (liknarNamn(v)) nameCount++;
        });
        if (pnrCount >= 3)        issues.push({ col, reason: `Innehåller värden i personnummer-format (${pnrCount} av ${sample.length} sampelvärden matchar)` });
        else if (emailCount >= 3) issues.push({ col, reason: `Innehåller e-postadresser (${emailCount} av ${sample.length} sampelvärden)` });
        else if (nameCount >= 5)  issues.push({ col, reason: `Innehåller troligtvis personnamn (${nameCount} av ${sample.length} sampelvärden)` });
    });
    return issues;
}

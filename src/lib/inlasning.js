// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
/**
 * Öppen lönekartläggning — tolkningen av indata: talen, könet, BAS-intervallet, AID-koden i ställningstagandet,
 * fältet för AID-etikett (yrket), kärnan i uppgiftsminimeringen (en lönerad → de vitlistade fälten),
 * inläsningskontrollen (personnummer och namnkolumner) och upptäckten av personnamn i fältet för AID-etikett.
 *
 * Fältet för AID-etikett maskeras inte (ADR-85): verktyget behåller koden och högst 40 tecken av etiketten, utan
 * tecknen < > " ' &. Ser fältet ut att innehålla personnamn varnar inläsningen (yrkeNamnNyckel, sallsyntaNamnrader).
 *
 * Funktionerna är rena: inget tillstånd och ingen klocka. Vilken kolumn som bär vilket fält avgörs här (TILLATNA_FALT,
 * _rubrikForRoll), men kolumnmappningen, importprofilen och ansvarskolumnen kommer ur appens tillstånd och skickas in,
 * liksom året som ett födelseår i ålderskolumnen räknas mot. Appens tunna adaptrar (hamtaFalt, _lonefilensRubriker,
 * _hittaAnsvarKolumn och minimeraLonerad) läser tillståndet. Funktionerna utan adapter behåller namnen de hade i
 * appen.
 */
import { tolkaAnsvarskod as _anTolka, ansvarsgrupp as _anGrupp, andelGiltiga as _anAndelGiltiga } from './ansvar.js';
import { AID_SEPARATORER, sifferprefixAvYrke } from './aid.js';
import { matchaImportprofil } from './importprofiler.js';

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
 * Det som får stå runt talet: blanksteg (också hårt och smalt hårt mellanslag) och apostrof som tusentalsavgränsare,
 * ett tecken först (+, - eller minustecknet U+2212), valutan först eller sist (kr, SEK; sist också kronor, ":-" och
 * ",-", valfritt med punkt efter), % sist och "år" sist (ålder skriven med enheten, "45 år"; suffixet är hela resten,
 * så "45årig" avvisas). Allt annat gör värdet ogiltigt och funktionen ger "": en felskriven lön ska synas i
 * inläsningsrapporten, inte läsas som ett annat tal. Formen prövas därför när suffixet och tusentalsavgränsarna är borta:
 *   - bokstäver och andra tecken ("12abc", "abc12", "12 st", "3.25E+04") avvisas;
 *   - flera decimaltecken av samma slag som inte är tusentalsgrupper ("1.2.3", "1,2,3") avvisas;
 *   - när både punkt och komma förekommer måste delen före det sista vara siffror i tregrupper ("1.234.567,89");
 *     "12,34.56" och "1.2,3" avvisas;
 *   - ett ensamt tecken eller decimaltecken ("-", ".") är inget tal.
 * Ett värde som redan är ett tal (ur Excel) skrivs som det är, så att också 1e-7 läses rätt.
 *
 * @param {*} varde - Råvärde från CSV-/Excel-cell.
 * @returns {string} parseFloat-bar sträng ("" när värdet inte är ett tal i något av formaten).
 */
export function _normaliseraTaltext(varde) {
    if (typeof varde === 'number') return isFinite(varde) ? String(varde) : '';
    let s = varde.toString().trim()
        .replace(/[\s  ']/g, '')        // mellanslag, NBSP, smal NBSP, apostrof-tusental
        .replace(/(kronor|kr|sek|år|:-|,-|%)\.?$/i, '')   // valutasuffix, procenttecken och år
        .replace(/^(kr|sek)\.?/i, '')                  // valutan före talet
        .replace(/−/g, '-')                   // minustecknet som verktyget och Intl skriver (annars tappas tecknet)
        .replace(/^\+/, '');
    if (!/^-?[\d.,]*\d[\d.,]*$/.test(s)) return '';   // bara siffror, punkt och komma efter ett ev. minustecken
    const lastDot = s.lastIndexOf('.'), lastComma = s.lastIndexOf(',');
    if (lastDot !== -1 && lastComma !== -1) {
        // Båda förekommer: den sista är decimaltecknet, den andra tusental i tregrupper.
        const tusental = lastComma > lastDot ? /^-?\d{1,3}(\.\d{3})+$/ : /^-?\d{1,3}(,\d{3})+$/;
        const decimal = Math.max(lastDot, lastComma);
        if (!tusental.test(s.slice(0, decimal))) return '';
        s = s.slice(0, decimal).replace(/[.,]/g, '') + '.' + s.slice(decimal + 1);
    } else if (lastComma !== -1) {
        // Endast komma: kommatecken med exakt 3-siffergrupper (t.ex. "32,500" / "1,234,567") = tusental;
        // annars decimal (flera kommatecken utan tregrupper avvisas nedan).
        if (/^-?[1-9]\d{0,2}(,\d{3})+$/.test(s)) s = s.replace(/,/g, '');
        else                                      s = s.replace(/,/g, '.');
    } else if (lastDot !== -1) {
        // Endast punkt: spegelvänd regel — "32.500" är tusental, "32.5" decimal.
        if (/^-?[1-9]\d{0,2}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
        // annars: punkt är redan decimaltecken
    }
    // Ett tal: högst ett decimaltecken och minst en siffra.
    return /^-?(\d+(\.\d*)?|\.\d+)$/.test(s) ? s : '';
}

export function tolkaTal(v) {
    if (v == null) return 0;
    const n = parseFloat(_normaliseraTaltext(v));
    return isNaN(n) ? 0 : n;
}

/**
 * Graderad version av tolkaTal som spårar varför
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
export function tolkaTalStrikt(v) {
    if (v == null) return { status: 'empty', value: 0, raw: v };
    const raw = v.toString();
    if (raw.trim() === '') return { status: 'empty', value: 0, raw };
    const n = parseFloat(_normaliseraTaltext(v));
    if (isNaN(n)) return { status: 'invalid', value: 0, raw };
    return { status: 'ok', value: n, raw };
}

// ---- Textfälten: AID-etiketten, BAS, AID i ställningstagandet och kön ----

// Etiketten i fältet för AID-etikett: resten efter AID-koden (sifferprefixAvYrke) och separatorerna (AID_SEPARATORER),
// utan HTML-meta-tecknen < > " ' &. De strippas vid inläsningen så att de aldrig kan smitas in i en innerHTML-template
// ens om en framtida renderingsplats glömmer esc() — CSP + esc() + inläsningen; tre lager. `s` är redan trimmad.
function _yrkeEtikett(s) {
    const aid = sifferprefixAvYrke(s);
    const rest = aid ? s.slice(aid.length).replace(new RegExp(`^[${AID_SEPARATORER}]*`), '') : s;
    return rest.trim().replace(/[<>"'&]/g, '');
}

/**
 * Fältet för AID-etikett (yrket) vid inläsning (GDPR Art. 25.1: bara det analysen behöver).
 *
 * Källsystem exporterar ofta yrket som "12345 — Sjuksköterska" eller liknande. Verktyget behåller:
 *   - AID:      ledande siffergrupp (sifferprefixAvYrke: följd av blanksteg, en separator eller slutet)
 *   - Etikett:  resten efter AID och separatorerna, med tecknen < > " ' & borttagna
 *   - Längd:    etiketten kortas till 40 tecken (efter rensningen)
 *
 * Funktionen maskerar INTE namn (ADR-85): text som står i fältet behålls inom 40 tecken, och visas i tabeller och följer
 * med i exporter. Ser fältet ut att innehålla personnamn varnar inläsningen i stället (yrkeNamnNyckel,
 * sallsyntaNamnrader); den som tar ut filen ansvarar för att fältet bara bär kod och etikett.
 *
 * @param {*} varde - Rått värde från CSV-cellen.
 * @returns {string} "AID Etikett" eller bara AID/etikett om endera saknas.
 */
export function _stadaYrkesfalt(varde) {
    if (!varde) return "";
    const s = varde.toString().trim();
    if (!s) return "";
    const aid = sifferprefixAvYrke(s) ?? "";
    let label = _yrkeEtikett(s);
    // Kortningen sist — yrkesetiketter är sällan över 40 tecken
    if (label.length > 40) label = label.substring(0, 40).trim() + '…';
    if (aid && label) return `${aid} ${label}`;
    return aid || label;
}

/**
 * Namnmönstren som upptäckten av personnamn i fältet för AID-etikett prövar med (yrkeNamnNyckel): "Förnamn
 * Efternamn" (två ord i Versal-gemener i rad) och "Efternamn, Förnamn" (båda i versaler eller båda i Versal-gemener).
 * Bokstäverna är alla bokstäver (\p{Lu}, \p{Ll}), så att också "Zoë Müller" räknas. Ordgränsen är en fångad
 * föregående icke-bokstav, eftersom \b inte fungerar före Å/Ä/Ö ("Örjan Östberg") och lookbehind saknas i Safari före
 * 16.4. Utan /g, så att test() inte bär tillstånd mellan anropen.
 */
export const YRKE_NAMNMONSTER = Object.freeze([
    /(^|\P{L})(\p{Lu}\p{Ll}+\s+\p{Lu}\p{Ll}+)/u,
    /(^|\P{L})(\p{Lu}{2,}(?:-\p{Lu}{2,})?, \p{Lu}{2,}(?:-\p{Lu}{2,})?|\p{Lu}\p{Ll}+(?:-\p{Lu}\p{Ll}+)?, \p{Lu}\p{Ll}+(?:-\p{Lu}\p{Ll}+)?)(?!\p{L})/u,
]);

/**
 * Nyckeln som en text med namnmönster räknas under: etikettexten efter AID-koden i gemener, med blanksteg slagna
 * samman till ett, så att skiftläge och extra blanksteg räknas som samma text. Tom sträng när texten saknar
 * namnmönster (något av YRKE_NAMNMONSTER). Nyckeln finns bara i inläsningens tillfälliga räknare och släpps när
 * filen är läst.
 *
 * Mönstret prövas på råvärdet före kortningen (efter AID-koden och separatorerna, med tecknen < > " ' & borttagna),
 * så att ett namn som kortningen klipper också räknas. Det träffar också etiketter med versal på två ord
 * ("Sjuksköterska Natt"); därför avgör det bara vilka texter som räknas, och varningen gäller de som också är
 * sällsynta i filen (sallsyntaNamnrader).
 * @param {*} varde - Fältets råvärde.
 * @returns {string}
 */
export function yrkeNamnNyckel(varde) {
    if (varde == null) return '';
    const s = varde.toString().trim();
    if (!s) return '';
    const label = _yrkeEtikett(s);
    if (!YRKE_NAMNMONSTER.some(re => re.test(label))) return '';
    return label.toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Så många rader får en text med namnmönster stå på för att räknas som ett misstänkt namn. Ett namn står på en rad
 * (eller ett par, om personen har två anställningar); en etikett med versal på två ord ("Sjuksköterska Natt")
 * återkommer på många. Känd gräns: ett namn som står på tre eller fler rader upptäcks inte.
 */
export const YRKE_NAMN_HOGST_RADER = 2;

/**
 * De misstänkta namnraderna ur inläsningens räknare: raderna vars text har namnmönster och står på högst
 * YRKE_NAMN_HOGST_RADER rader i filen.
 * @param {Map<string, {antal: number, radnr: Array<number|null>}>} raknare - Per yrkeNamnNyckel: antal rader och
 *   de första radnumren (YRKE_NAMN_HOGST_RADER räcker).
 * @param {number} [hogstRadnr] - Högst så många radnummer i svaret.
 * @returns {{antal: number, radnr: number[]}} Antalet misstänkta rader och de första radnumren, i stigande ordning.
 */
export function sallsyntaNamnrader(raknare, hogstRadnr = 5) {
    let antal = 0;
    const radnr = [];
    for (const v of (raknare ? raknare.values() : [])) {
        if (!(v.antal > 0) || v.antal > YRKE_NAMN_HOGST_RADER) continue;
        antal += v.antal;
        for (const r of v.radnr || []) if (typeof r === 'number' && isFinite(r)) radnr.push(r);
    }
    radnr.sort((a, b) => a - b);
    return { antal, radnr: radnr.slice(0, Math.max(0, hogstRadnr)) };
}

/**
 * Tar bort HTML-metatecken (< > " ' &) ur ett textfält vid inläsning. esc() vid
 * rendering är det egentliga skyddet; detta är ett extra lager ("defensive depth")
 * för korta koder (BAS, AID) som renderas i attribut- och option-kontext och som
 * aldrig legitimt innehåller tecknen. Delas av lönefilen (_normaliseraBas),
 * ställningstagandet (_normaliseraPolicyAid) och jämförelsestatistiken.
 */
export function _utanHtmlTecken(s) {
    return s.toString().replace(/[<>"'&]/g, '');
}

/**
 * Normaliserar BAS-värden: trimma, versalisera och strippa ev. "BAS"-prefix
 * ("BAS A" → "A", "bas-2" → "2") så samma intervall inte splittras i två
 * kategorier beroende på exportformat. Ett ensamt "BAS" lämnas orört.
 * @param {*} varde
 * @returns {string}
 */
export function _normaliseraBas(varde) {
    if (!varde) return "";
    // Strippar HTML-meta-tecken (< > " ' &) vid inläsning som extra XSS-lager:
    // BAS renderas i attributkontext (data-bas="…", <option value="…">). esc()
    // escapear också citattecken, men detta är samma "defensive depth" som
    // _stadaYrkesfalt — BAS är legitimt korta koder (A, B, 1…) så det är ofarligt.
    const v = _utanHtmlTecken(varde).trim().toUpperCase();
    return v.replace(/^BAS\b[\s\-_:]*/i, '').trim() || v;
}

/**
 * Normaliserar AID i det lönepolitiska ställningstagandet så att den matchar
 * den AID som härleds ur lönedatans yrkesfält (sifferprefixAvYrke).
 * Tar sifferprefixet när det finns ("207 Förskollärare" → "207"), annars den
 * rensade strängen. Tom sträng betyder "ingen AID" (= BAS-nivårad).
 */
export function _normaliseraPolicyAid(varde) {
    if (!varde) return "";
    const v = _utanHtmlTecken(varde).trim();
    return sifferprefixAvYrke(v) ?? v;
}

/**
 * Normaliserar kön-värden från olika personalsystem till verktygets kanoniska
 * 'kvinna'/'man'. Hanterar förkortningar (K/Kv/M), engelska exportvärden
 * (F/Female/M/Male, W/Woman) och plural ("Kvinnor"/"Män").
 *
 * Åäö bevaras innan värdet slås upp, så att "Män" mappas till 'man' (en
 * normalisering som stryker alla icke-[a-z]-tecken skulle göra det till "mn").
 *
 * Ett värde med ett tillägg inom parentes ("Kvinna (F)", "Man (M)", "F (kvinna)") är det kön som båda delarna anger;
 * anger delarna olika kön är värdet okänt.
 *
 * Siffervärden (t.ex. "1"/"2") mappas medvetet INTE — kodningen är system-
 * specifik och en gissning vore farligare än att visa raderna som "okänt kön"
 * i inläsningsrapporten (exempelvärdena visas där).
 *
 * @param {*} varde - Råvärde från kön-kolumnen.
 * @returns {string} 'kvinna' | 'man' | normaliserad reststräng (okänd).
 */
export function _normaliseraKon(varde) {
    if (!varde) return "";
    const v = varde.toString();
    const delar = v.match(/^([^()]*)\(([^()]*)\)\s*$/);
    if (delar) {
        const [fore, inom] = [_konOrd(delar[1]), _konOrd(delar[2])];
        if (fore === inom) return fore;
    }
    return _konOrd(v);
}
const _KON = Object.freeze({
    k: 'kvinna', kv: 'kvinna', kvinna: 'kvinna', kvinnor: 'kvinna',
    f: 'kvinna', female: 'kvinna', w: 'kvinna', woman: 'kvinna',
    m: 'man', ma: 'man', man: 'man', 'män': 'man', male: 'man'
});
function _konOrd(t) {
    const s = t.toLowerCase().replace(/[^a-zåäö]/g, '');
    return Object.hasOwn(_KON, s) ? _KON[s] : s;
}

// ---- Kolumnerna: vilken rubrik som bär vilket fält ----

// GDPR uppgiftsminimering (Art. 5(1)(c)): vitlista över tillåtna datafält. Verktyget extraherar ENBART dessa roller
// från lönefilen. Alla övriga kolumner ignoreras helt även om de finns i filen.
export const TILLATNA_FALT = {
    bas:     ["bas","basintervall"],
    // Sökorden jämförs med rubrikens rensade namn och ord (gemener, bara a–z och 0–9, så att å, ä och ö faller bort:
    // "Lön" blir "ln"); hur nära de ska passa står vid _hittaRubrik. Yrkets ordning spelar roll — specifika först:
    //   - "aidetik"    → "AID-etikett" (export ur lönestatistiksystem)
    //   - "yrkesgrupp" → "Yrkesgrupp"
    //   - "yrke"       → "Yrke", "Yrkesnamn", "Yrkeskod"
    //   - "befattning" → "Befattning"
    //   - "aidkod"     → "AIDkod" (i ett ord, där det korta "aid" varken är ett helt ord eller ett ordslut)
    //   - "aid"        → fallback för CSV som har enbart "AID"-kolumn (vanligt!)
    //                    Måste vara sist så mer-specifika mönster matchas först.
    yrke:    ["aidetik","yrkesgrupp","yrke","befattning","aidkod","aid"],
    lon:     ["mnadsln","lon","ln"],
    alder:   ["lder","alder"],
    kon:     ["kon","kn"],
    // Valfri arbetsvärderingspoäng per befattning — del av strukturdatan (som BAS),
    // aktiverar poäng som krav-proxy i likvärdighetsanalysen. Normaliserade mönster:
    // "Poäng"→pong, "Poang"→poang, "Arbetsvärdering"→arbetsvrdering.
    poang:   ["pong","poang","arbetsvrdering","arbetsvardering"],
    // Valfri ansvarskod enligt AID (ADR-33): "Ansvarskod", "AID-ansvar",
    // "Ansvarsnivå". Kolumnen "Ansvar" (oftast ett kostnadsställe) läses aldrig — själva
    // kolumnen väljs med hittaAnsvarKolumn, och den godkänns bara med ≥ 95 % giltiga värden.
    ansvar:  ["ansvarskod","aidansvar","ansvarsniv"]
};

/** Sökorden per roll i TILLATNA_FALT, för rubrikradssökningen (_hittaCsvRubrik och Excelläsaren i appen). */
export function rubrikgrupper() {
    return Object.values(TILLATNA_FALT);
}

// Korta sökord ("ln", "kn", "kon", "bas", "aid") är delsträngar av vanliga rubriker som "Anställningsnr", "Tekniker",
// "Kontor", "Databas" och "Löneart". Därför får ett sökord bara inleda eller avsluta ett ord när det har minst
// SOKORD_BORJAR_ORD tecken ("Yrkesnamn", "Totalpoäng"), och bara stå var som helst i rubriken när det har minst
// SOKORD_DELSTRANG tecken ("AID-etikett"). Lönens sökord får alltid avsluta ett ord: svenska sammansättningar med lön
// slutar på lön ("Grundlön", "Heltidslön").
const SOKORD_BORJAR_ORD = 4;
const SOKORD_DELSTRANG = 5;
const SOKORD_ALLTID_ORDSLUT = new Set(TILLATNA_FALT.lon);

const _rensaRubrik = s => s.toLowerCase().replace(/[^a-z0-9]/g, '');

/**
 * Rubriken som bär rollen, efter rubrikens rensade namn (gemener, bara a–z och 0–9) och dess ord (rubriken delad på
 * allt som inte är bokstav eller siffra, varje ord rensat). Först den rubrik vars rensade namn är lika med något av
 * sökorden, prövade i tur och ordning, så att "Kön" går före "Kontor". Annars, sökord för sökord, den rubrik som passar
 * på bästa nivå: 1) hela namnet eller ett ord är lika med sökordet ("Överenskommen lön per månad"); 2) ett ord slutar
 * med sökordet, om det har minst SOKORD_BORJAR_ORD tecken eller är lönens ("Grundlön", "Totalpoäng"; inte "Databas");
 * 3) ett ord börjar med sökordet, om det har minst SOKORD_BORJAR_ORD tecken ("Yrkesnamn");
 * 4) namnet innehåller sökordet, om det har minst SOKORD_DELSTRANG tecken ("AID-etikett"). Inom en nivå gäller den
 * kortaste rubriken, och vid lika den första, så att "Ålder (år)" går före "Anställningsålder". Yrkets sökord är en
 * prioritetsordning och prövas bara sökord för sökord, så att "AID-etikett" går före "AID".
 */
export function _hittaRubrik(rubriker, sokord, roll) {
    // Yrkets sökord "aid" är ett ord i "AID-ansvar": en kolumn för AID:s ansvarskod får aldrig tas för yrke (ADR-33).
    const hoppa = h => roll === 'yrke' && _arAnsvarskodRubrik(h);
    const rensade = (rubriker || []).map(h => h == null || hoppa(h) ? null : _rensaRubrik(String(h)));
    const rubrikord = (rubriker || []).map(h => h == null ? [] : String(h).split(/[^\p{L}\p{N}]+/u).map(_rensaRubrik));
    const ord = sokord.map(_rensaRubrik);
    // Yrkets sökord är en prioritetsordning (TILLATNA_FALT), de andra rollernas olika stavningar av samma sak.
    if (roll !== 'yrke') for (const s of ord) { const i = rensade.indexOf(s); if (i >= 0) return rubriker[i]; }
    const niva = (r, o, s) => r === s || o.includes(s) ? 1
        : (s.length >= SOKORD_BORJAR_ORD || SOKORD_ALLTID_ORDSLUT.has(s)) && o.some(w => w.endsWith(s)) ? 2
        : s.length >= SOKORD_BORJAR_ORD && o.some(w => w.startsWith(s)) ? 3
        : s.length >= SOKORD_DELSTRANG && r.includes(s) ? 4 : 0;
    for (const s of ord) {
        let bast = -1, bastNiva = 0;
        rensade.forEach((r, i) => {
            const n = r === null ? 0 : niva(r, rubrikord[i], s);
            if (n && (bast < 0 || n < bastNiva || n === bastNiva && r.length < rensade[bast].length)) { bast = i; bastNiva = n; }
        });
        if (bast >= 0) return rubriker[bast];
    }
    return undefined;
}

/** Kolumnrubrik som anger AID:s ansvarskod (sökorden i TILLATNA_FALT.ansvar) — aldrig bara "Ansvar". */
function _arAnsvarskodRubrik(rubrik) { return _hittaRubrik([rubrik], TILLATNA_FALT.ansvar) !== undefined; }

/**
 * Rubriken som bär rollen bland `headers`: den manuella kolumnmappningen, därefter importprofilen som gäller för
 * filen (roll → filens rubrik), och för roller ingen av dem täcker namnet (_hittaRubrik). En vald rubrik gäller bara om
 * filen har den. undefined när ingen rubrik passar.
 * @param {{columnMap?: Object<string,string>|null, importprofil?: {mappning: Object<string,string>}|null}} [val] -
 *   Kolumnmappningen och importprofilen ur appens tillstånd.
 */
export function _rubrikForRoll(rubriker, sokord, roll, val = {}) {
    const mapped = roll && val.columnMap && val.columnMap[roll];
    if (mapped && rubriker.includes(mapped)) return mapped;
    const profil = roll && val.importprofil && val.importprofil.mappning[roll];
    if (profil && rubriker.includes(profil)) return profil;
    return _hittaRubrik(rubriker, sokord, roll);
}

/** Radens värde i kolumnen som bär rollen (_rubrikForRoll), eller tom sträng. Appens hamtaFalt skickar tillståndets val. */
export function vardeForRoll(rad, sokord, roll, val = {}) {
    const key = _rubrikForRoll(Object.keys(rad), sokord, roll, val);
    return key == null ? "" : rad[key];
}

// vilken rubrik auto-matchar varje roll (samma logik som hamtaFalt,
// utan columnMap-override). Returnerar { roll: rubrik|null }.
export function gissaKolumnmappning(rubriker) {
    const map = {};
    for (const role of Object.keys(TILLATNA_FALT)) map[role] = _hittaRubrik(rubriker, TILLATNA_FALT[role], role) ?? null;
    return map;
}

/**
 * Rubriken för varje fält i TILLATNA_FALT bland lönefilens rubriker (_rubrikForRoll: kolumnmappningen, importprofilen,
 * namnet). Slås upp en gång per fil; en ändrad mappning läser in filen på nytt.
 * @param {string[]} filrubriker
 * @param {{columnMap?: Object<string,string>|null, importprofil?: {mappning: Object<string,string>}|null}} [val]
 */
export function lonefilensRubriker(filrubriker, val = {}) {
    const rubriker = {};
    for (const role of Object.keys(TILLATNA_FALT)) rubriker[role] = _rubrikForRoll(filrubriker, TILLATNA_FALT[role], role, val);
    return rubriker;
}
/** Radens värde för rollen, som hamtaFalt: tom sträng när filen saknar kolumnen. */
export function _faltIRad(rad, rubriker, roll) {
    return rubriker[roll] == null ? '' : rad[rubriker[roll]] ?? '';
}

/**
 * Kolumnen med AID:s ansvarskod: manuell mappning först, annars första rubrik som
 * _arAnsvarskodRubrik känner igen. Aldrig kolumnen "Ansvar".
 * @param {string[]} rubriker
 * @param {{columnMap?: Object<string,string>|null, importprofil?: {mappning: Object<string,string>}|null}} [val]
 * @returns {string|null}
 */
export function hittaAnsvarKolumn(rubriker, val = {}) {
    // "— ingen —" i kolumnmappningen sparas som tom sträng: då läses ingen ansvarskod alls.
    if (val.columnMap && val.columnMap.ansvar === '') return null;
    const manuell = val.columnMap && val.columnMap.ansvar;
    if (manuell && (rubriker || []).includes(manuell)) return manuell;
    // En importprofil som pekar ut ansvarskoden (godkänns ändå bara med ≥ 95 % giltiga värden).
    const profil = val.importprofil && val.importprofil.mappning.ansvar;
    if (profil && (rubriker || []).includes(profil)) return profil;
    return (rubriker || []).find(_arAnsvarskodRubrik) ?? null;
}

/**
 * Godkänner ansvarskodskolumnen om minst 95 % av de ifyllda värdena är giltiga.
 * @returns {{namn:string, godkand:boolean, giltiga:number|null}}
 */
export function _bedomAnsvarKolumn(namn, varden) {
    const giltiga = _anAndelGiltiga(varden);
    return { namn, godkand: giltiga != null && giltiga >= 0.95, giltiga };
}

// ---- Jämförelsestatistikens fil ----

// Sökorden per kolumn i statistikfilen, med samma ordregel som lönefilen (_hittaRubrik). Könens antal och andel står
// som hela rubriken utan mellanrum ("Kvinnor, antal" → kvinnorantal); "%" läses som ordet procent.
const STATISTIK_SOKORD = {
    aid: ['aid', 'aidkod', 'yrkesgrupp'],
    bas: TILLATNA_FALT.bas,
    median: ['median'],
    p10: ['p10', '10e', '10'],
    p90: ['p90', '90e', '90'],
    nKv: ['kvinnorantal', 'antalkvinnor', 'kvantal'],
    nMa: ['mnantal', 'manantal', 'antalmn', 'antalman', 'maantal'],
    andelKv: ['andelkvinnor', 'kvinnoandel', 'kvinnorandel', 'procentkvinnor', 'kvinnorprocent']
};
// Medianen och percentilerna tas aldrig ur en kolumn för ett kön eller en skillnad ("Median kvinnor", "Diff LPS Median").
const _KON_ELLER_SKILLNAD = /^(kvinn|kv$|mn$|man$|diff|skillnad)/;

/** Antalet rader vars AID och BAS redan stått på en tidigare rad. */
export function dubbletterAidBas(rader) {
    const sett = new Set();
    let n = 0;
    for (const r of rader) {
        const k = `${r.aid ?? ''}|${r.bas ?? ''}`;
        if (sett.has(k)) n++; else sett.add(k);
    }
    return n;
}

/**
 * Jämförelsestatistikens fil: kolumnerna och raderna. AID och median krävs; BAS, P10, P90 och könsfördelningen är
 * valfria. En cell som inte är ett tal saknas (null; P10 och P90 0, som i organisationspaketet). Andelen kvinnor är en
 * decimal när alla värden i kolumnen är högst 1, annars procent; saknas den räknas den ur antalen i raden. En rad
 * utan AID eller med en median som inte är ett tal över noll läses inte (ogiltiga). P10, P90 och könsfördelningen
 * finns när någon rad har dem.
 * @param {string[]} rubriker - Filens rubriker.
 * @param {Array<Object<string,*>>} rader - Raderna, nycklade på rubrikerna.
 * @returns {{fel: string} | {fel?: undefined, rader: any[], harP10: boolean, harP90: boolean, harKon: boolean,
 *   ogiltiga: number, dubbletter: number}}
 */
export function tolkaStatistikfil(rubriker, rader) {
    const lasbara = rubriker.map(h => String(h ?? '').replace(/%/g, ' procent '));
    const utanKonOchSkillnad = lasbara.filter(h => !h.split(/[^\p{L}\p{N}]+/u).map(_rensaRubrik).some(w => _KON_ELLER_SKILLNAD.test(w)));
    const kolumn = (roll, bland = lasbara) => {
        const h = _hittaRubrik(bland, STATISTIK_SOKORD[roll], roll === 'aid' ? 'yrke' : roll);
        return h === undefined ? null : rubriker[lasbara.indexOf(h)];
    };
    const k = {
        aid: kolumn('aid'), bas: kolumn('bas'), nKv: kolumn('nKv'), nMa: kolumn('nMa'), andelKv: kolumn('andelKv'),
        median: kolumn('median', utanKonOchSkillnad), p10: kolumn('p10', utanKonOchSkillnad), p90: kolumn('p90', utanKonOchSkillnad)
    };
    const aidKol = k.aid;
    if (aidKol == null || k.median == null) return { fel: 'Filen saknar kolumnen AID eller Median. Kontrollera rubrikraden och läs in filen igen.' };
    const tal = (r, kol) => { if (kol == null) return null; const t = tolkaTalStrikt(r[kol]); return t.status === 'ok' ? t.value : null; };
    const andelar = rader.map(r => tal(r, k.andelKv));
    const decimal = andelar.some(a => a != null) && andelar.every(a => a == null || a <= 1);
    const ut = [];
    rader.forEach((r, i) => {
        const aidFull = _utanHtmlTecken(r[aidKol] ?? '').trim();
        const median = tal(r, k.median);
        if (!aidFull || median == null || !(median > 0)) return;
        const p10 = tal(r, k.p10), p90 = tal(r, k.p90);
        const nKv = tal(r, k.nKv), nMa = tal(r, k.nMa);
        let andelKv = andelar[i] != null && decimal ? andelar[i] * 100 : andelar[i];
        if (andelKv == null && nKv != null && nMa != null && nKv + nMa > 0) andelKv = nKv / (nKv + nMa) * 100;
        ut.push({
            aid: _normaliseraPolicyAid(aidFull), aidFull, bas: k.bas == null ? '' : _normaliseraBas(r[k.bas]),
            median, p10: p10 != null && p10 > 0 ? p10 : 0, p90: p90 != null && p90 > 0 ? p90 : 0,
            nKv: nKv != null && nKv >= 0 ? nKv : null,
            nMa: nMa != null && nMa >= 0 ? nMa : null,
            andelKv: andelKv != null && andelKv >= 0 && andelKv <= 100 ? andelKv : null
        });
    });
    return {
        rader: ut, ogiltiga: rader.length - ut.length, dubbletter: dubbletterAidBas(ut),
        harP10: ut.some(x => x.p10 > 0), harP90: ut.some(x => x.p90 > 0), harKon: ut.some(x => x.andelKv != null)
    };
}

// ---- En lönerad ----

/**
 * Kärnan i uppgiftsminimeringen (GDPR Art. 5(1)(c)): de vitlistade fälten ur en lönerad, tolkade och normaliserade.
 * minimeraRad slår upp råvärdena i raden (rubrikerna ur lonefilensRubriker, med TILLATNA_FALT) och skickar in dem
 * här; inga andra kolumner når hit.
 * Yrke saneras via _stadaYrkesfalt (AID + 40 tecken etikett, utan tecknen < > " ' &; ingen namnmaskering, ADR-85).
 * Ger { bas, yrke, aid, yrkeLabel, lon, alder, kon, poang, ansvarskoder, ansvarsgrupp, _lonStatus, _alderStatus }.
 * @param {{bas:*, kon:*, lon:*, alder:*, poang:*, yrke:*, ansvar?:*}} falt - Råvärdet per roll ur raden.
 * @param {number} referensar - Året som ett födelseår i ålderskolumnen räknas mot (appen skickar innevarande år).
 * @param {boolean} [medAnsvar] - Om en godkänd kolumn för AID:s ansvarskod finns; falt.ansvar är radens värde i den.
 */
export function tolkaLonerad(falt, referensar, medAnsvar = false) {
    const basRaw    = falt.bas;
    const konRaw    = falt.kon;
    // Använd tolkaTalStrikt så vi kan särskilja
    // legit-tomma fält från icke-tomma men ogiltiga värden.
    const lonParsed   = tolkaTalStrikt(falt.lon);
    const alderParsed = tolkaTalStrikt(falt.alder);
    // Valfri arbetsvärderingspoäng (per befattning) — null när kolumn saknas/tom.
    const poangParsed = tolkaTalStrikt(falt.poang);
    const yrkeFull    = _stadaYrkesfalt(falt.yrke);
    // AID och etikett hålls isär. `r.yrke` är "AID Etikett"-strängen (den som vyerna visar);
    // `r.aid` och `r.yrkeLabel` ger ren AID-kod respektive enbart etikett-delen
    // för analyser som behöver något entydigt nyckel (t.ex. paret i likvärdigt arbete).
    const aid      = sifferprefixAvYrke(yrkeFull) ?? "";
    const yrkeLabel = aid ? yrkeFull.slice(aid.length).trim() : yrkeFull;
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
        bas:       _normaliseraBas(basRaw),
        yrke:      yrkeFull,
        aid,
        yrkeLabel,
        lon:       lonParsed.value,
        alder:     alderVal,
        kon:       _normaliseraKon(konRaw),
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
 * Extraherar ENBART vitlistade fält ur en lönerad — GDPR Art. 5(1)(c) uppgiftsminimering. Säkerställer att verktyget
 * aldrig laddar identifierande fält (personnummer, namn, e-post) även om användarens fil innehåller dem. Råvärdena slås upp i
 * raden (rubrikerna ur lonefilensRubriker, och den godkända ansvarskolumnen) och tolkas av tolkaLonerad.
 * Appens minimeraLonerad (src/app/06-uppgiftsminimering.js) skickar tillståndets ansvarskolumn och innevarande år.
 * @param {Object<string,*>} rad - Rå rad (PapaParse-objekt).
 * @param {Object<string,string|undefined>} rubriker - Uppslaget för filen (lonefilensRubriker).
 * @param {{namn: string}|null} ansvarKolumn - Den godkända kolumnen för AID:s ansvarskod, eller null.
 * @param {number} referensar - Året som ett födelseår i ålderskolumnen räknas mot.
 */
export function minimeraRad(rad, rubriker, ansvarKolumn, referensar) {
    const falt = roll => _faltIRad(rad, rubriker, roll);
    return tolkaLonerad({
        bas:    falt('bas'),
        kon:    falt('kon'),
        lon:    falt('lon'),
        alder:  falt('alder'),
        poang:  falt('poang'),
        yrke:   falt('yrke'),
        ansvar: ansvarKolumn ? rad[ansvarKolumn.namn] : undefined
    }, referensar, !!ansvarKolumn);
}

/**
 * Steget mellan raderna som inläsningskontrollen samplar i en fil med n rader: ⌈n/50⌉ (minst 1), så att högst 50 rader
 * sprids jämnt över filen. Delas av hittaKansligaKolumner och den strömmande CSV-inläsningen.
 * @param {number} n
 */
export function _pnrSampelSteg(n) {
    return Math.max(1, Math.ceil(n / 50));
}

/**
 * Inläsningskontrollen: kolumnerna som stoppar lönefilen. Skyddet ligger i vad verktyget läser in (minimeraRad);
 * stoppet är en signal om att uttaget inte är gallrat enligt instruktionen, så att användaren rättar uttaget. Två saker
 * stoppar: personnummer (rubriken, eller minst tre av de samplade värdena i personnummerformat) och en namnkolumn
 * (bara rubriken). Värdena samplas jämnt över filen, var ⌈n/50⌉:e rad (_pnrSampelSteg); den strömmande
 * CSV-inläsningen samlar själv raderna och lämnar högst 50 hit.
 * @param {Array<Object>} rader - Råa CSV-rader.
 * @param {string[]} [rubriker] - Filens rubriker. Utan dem prövas alla nycklar i raderna; en rad kan sakna en kolumn
 *   (en kort rad i CSV), så kolumnerna tas aldrig ur en enda rad.
 * @returns {Array<{col:string, reason:string}>} Tom array om inga känsliga kolumner.
 */
export function hittaKansligaKolumner(rader, rubriker = [...new Set(rader.flatMap(r => Object.keys(r)))]) {
    // Jämnt över filen: personnummer som bara finns längre ned ska också hittas.
    const steg = _pnrSampelSteg(rader.length);
    const sample = rader.filter((_, i) => i % steg === 0);
    // Strikt PNR-mönster: kräver giltig månad (01-12) och dag (01-31) för att undvika
    // falska träffar på godtyckliga sifferserier som anställningsnummer.
    const PNR  = /^(?:19|20)?\d{2}[-/]?(?:0[1-9]|1[0-2])[-/]?(?:0[1-9]|[12]\d|3[01])[-+]?\d{4}$/;

    const issues = [];
    rubriker.forEach(col => {
        // Rubriken normaliseras: gemener, å/ä→a och ö→o, övriga tecken bort — så att "Förnamn", "Fornamn" och
        // "FÖRNAMN" alla matchar mönstren nedan. Mönstren prövas på hela rubriken utan mellanrum (lcCol: "Social
        // security") eller på vart och ett av dess ord: ^ och $ är då ordets början och slut.
        const ord = String(col).split(/[^\p{L}\p{N}]+/u)
            .map(w => w.toLowerCase().replace(/[åä]/g, 'a').replace(/ö/g, 'o').replace(/[^a-z0-9]/g, '')).filter(Boolean);
        const lcCol = ord.join('');
        // "pnr" och "ssn" bara som hela ord: som delsträng träffar de "Adressnr" och "Passnr".
        if (/personnummer|personnr|socialsecurity/.test(lcCol) || ord.some(w => /^(pnr|ssn)$/.test(w))) {
            issues.push({ col, reason: 'Kolumnrubriken antyder personnummer' });
            return;
        }
        if (/^namn$|fornamn|efternamn|fullname|^name$/.test(lcCol)) {
            issues.push({ col, reason: 'Kolumnrubriken antyder personnamn' });
            return;
        }
        let pnrCount = 0;
        sample.forEach(r => { if (PNR.test((r[col] ?? '').toString().trim())) pnrCount++; });
        if (pnrCount >= 3) issues.push({ col, reason: `Innehåller värden i personnummer-format (${pnrCount} av ${sample.length} sampelvärden matchar)` });
    });
    return issues;
}

// ---- Filtexten: teckenkodning, avgränsare och rubrikrad ----

/**
 * Den sista raden och kolumnen (räknade från 0) som har en cell med värde i ett Excelblad, eller null för ett tomt blad.
 * Bladets angivna område kan vara uppblåst: en enda cell i XFD1048576 gör det till 17 miljarder celler, och tabellen
 * som byggs över det låser fliken. Inläsningen bygger därför tabellen bara fram till de celler som finns.
 * @param {Object<string, *>} blad - Arbetsbladet: cellerna under sina adresser ("A1"), övriga nycklar börjar med "!".
 * @returns {{r: number, c: number}|null}
 */
export function bladetsSlut(blad) {
    let r = -1, c = -1;
    for (const adress of Object.keys(blad || {})) {
        const m = /^([A-Z]+)(\d+)$/.exec(adress);
        const cell = blad[adress];
        if (!m || !cell || cell.v == null || String(cell.v).trim() === '') continue;
        let kol = 0;
        for (const tecken of m[1]) kol = kol * 26 + tecken.charCodeAt(0) - 64;
        r = Math.max(r, Number(m[2]) - 1);
        c = Math.max(c, kol - 1);
    }
    return r < 0 ? null : { r, c };
}

/**
 * Identifierar filformat via magiska bytes (accept-attributet är bara rådgivande
 * — användare kan välja "Alla filer" och lägga en Excel-fil i en CSV-ruta).
 *   - "xlsx"       : ZIP-container (PK..) — .xlsx
 *   - "xls-legacy" : OLE2-container — gammalt .xls (läses inte: SheetJS-bygget xlsx.mini läser inte .xls)
 *   - "text"       : allt annat — behandlas som CSV/text
 * @param {Uint8Array} byte
 * @returns {'xlsx'|'xls-legacy'|'text'}
 */
export function _gissaTabellformat(byte) {
    if (byte.length >= 4 && byte[0] === 0x50 && byte[1] === 0x4B &&
        (byte[2] === 0x03 || byte[2] === 0x05 || byte[2] === 0x07)) return 'xlsx';
    if (byte.length >= 4 && byte[0] === 0xD0 && byte[1] === 0xCF &&
        byte[2] === 0x11 && byte[3] === 0xE0) return 'xls-legacy';
    return 'text';
}

// Robust CSV-inläsning. Excel-exporterad CSV är ofta Windows-1252 (inte
// UTF-8) och ibland kommaseparerad. Vi detekterar teckenkodning och avgränsare
// LOKALT (TextDecoder i webbläsaren, inga nätverksanrop) innan parsning så att
// å/ä/ö inte mojibakar och raderna inte hamnar i en enda kolumn.
export function _avkodaCsv(buffert) {
    const bytes = new Uint8Array(buffert);
    // UTF-16 (Excels "Unicode-text" sparar UTF-16LE med BOM, tab-avgränsat).
    // Utan denna kontroll faller UTF-16 igenom till Windows-1252 och blir
    // NUL-interfolierad rappakalja som parsern tuggar utan tydligt fel.
    if (bytes.length >= 2 && bytes[0] === 0xFF && bytes[1] === 0xFE) {
        return { text: new TextDecoder('utf-16le').decode(buffert).replace(/^﻿/, ''), encoding: 'UTF-16 LE' };
    }
    if (bytes.length >= 2 && bytes[0] === 0xFE && bytes[1] === 0xFF) {
        return { text: new TextDecoder('utf-16be').decode(buffert).replace(/^﻿/, ''), encoding: 'UTF-16 BE' };
    }
    if (bytes.length >= 3 && bytes[0] === 0xEF && bytes[1] === 0xBB && bytes[2] === 0xBF) {
        return { text: new TextDecoder('utf-8').decode(buffert), encoding: 'UTF-8 (BOM)' };
    }
    try {
        // Strikt UTF-8: kastar om byten inte är giltig UTF-8 (typiskt Windows-1252-åäö).
        return { text: new TextDecoder('utf-8', { fatal: true }).decode(buffert), encoding: 'UTF-8' };
    } catch (_e) {
        // Windows-1252 avkodar varje byte och kastar inte.
        return { text: new TextDecoder('windows-1252').decode(buffert), encoding: 'Windows-1252' };
    }
}

// Radslut: CRLF, LF eller bara CR (gamla Mac-filer) — samma regel i alla steg.
const _RADSLUT = /\r\n|\r|\n/;
/** Filtextens rader, med samma regel för radslut som avgränsaren och rubrikraden. */
export function delaRader(text) { return text.split(_RADSLUT); }

export function _gissaAvgransare(text) {
    const firstLine = (text.split(_RADSLUT).find(l => l.trim().length) || '');
    let best = ';', bestN = 0;
    for (const d of [';', ',', '\t', '|']) {
        const n = firstLine.split(d).length - 1;
        if (n > bestN) { bestN = n; best = d; }
    }
    return bestN > 0 ? best : ';';
}

/** Så många rader från filens början som rubrikraden söks bland, i CSV och Excel. */
export const RUBRIKRAD_SOKDJUP = 20;

/**
 * Hur väl en rad ser ut som rubrikraden: antalet celler som är rubrik för en roll, med samma ordregel som kolumnvalet
 * (_hittaRubrik). En cell räknas för högst en roll och en roll högst en gång, så att en titelcell som nämner
 * kolumnerna ("Månadslön per kön, ålder och BAS") räknas en gång.
 * @param {string[]} celler
 * @param {Array<Array<string>>} sokordsgrupper - En grupp synonymer per roll.
 */
export function rubrikradTraffar(celler, sokordsgrupper) {
    const tagna = new Set();
    for (const c of celler) {
        const roll = sokordsgrupper.findIndex((g, i) => !tagna.has(i) && _hittaRubrik([c], g) !== undefined);
        if (roll >= 0) tagna.add(roll);
    }
    return tagna.size;
}

/**
 * Rubrikraden bland de RUBRIKRAD_SOKDJUP första raderna: den första rad där en importprofils alla kännetecken finns,
 * annars raden med flest rubrikceller (rubrikradTraffar), och vid lika den senare, eftersom försättsraderna står
 * före rubrikerna. En rad kan delas i celler på flera sätt (CSV: en delning per avgränsare); vid lika gäller den
 * första delningen.
 * @param {Array<Array<string[]>>} rader - Per rad dess möjliga delningar i celler (Excel: en).
 * @param {Array<Array<string>>} sokordsgrupper - En grupp synonymer per roll.
 * @param {number} [minTraffar=2] - Så många roller som måste kännas igen; annars rad 0.
 * @param {any[]} [profiler] - Importprofiler (lönefilen).
 * @returns {{line: number, delning: number, hits: number}} hits 0 och line 0 när ingen rad räcker.
 */
export function hittaRubrikrad(rader, sokordsgrupper, minTraffar = 2, profiler = []) {
    let bast = { line: 0, delning: 0, hits: -1 };
    for (let i = 0; i < Math.min(RUBRIKRAD_SOKDJUP, rader.length); i++) {
        for (let d = 0; d < rader[i].length; d++) {
            const celler = rader[i][d].map(c => String(c ?? '').trim());
            if (profiler.length && matchaImportprofil(celler, profiler)) return { line: i, delning: d, hits: sokordsgrupper.length };
            const hits = rubrikradTraffar(celler, sokordsgrupper);
            if (hits > bast.hits || (hits === bast.hits && i > bast.line)) bast = { line: i, delning: d, hits };
        }
    }
    return bast.hits >= minTraffar ? bast : { line: 0, delning: 0, hits: 0 };
}

const _AVGRANSARE = [';', ',', '\t', '|'];

/**
 * Hittar rubrikraden i CSV-text och dess avgränsare. Exportverktyg lägger ofta försättsrader före rubrikerna
 * ("Rapport uttagen 2026-01-15;;;;"), och de får inte tas för rubriker. Varje rad delas med varje avgränsare som
 * förekommer i den, och raden väljs som i Excel (hittaRubrikrad).
 *
 * @param {string} text - Avkodad filtext.
 * @param {Array<Array<string>>} sokordsgrupper - En grupp synonymer per roll, t.ex. rubrikgrupper().
 * @param {number} [minTraffar=2] - Min antal roller som måste matcha.
 * @param {any[]} [profiler] - Importprofiler (lönefilen), som i hittaRubrikrad.
 * @returns {{line:number, delim:string|null, hits:number}} line = 0-baserat radindex;
 *          vid ingen träff: line 0 + avgränsaren från _gissaAvgransare.
 */
export function _hittaCsvRubrik(text, sokordsgrupper, minTraffar = 2, profiler = []) {
    const delningar = text.split(_RADSLUT).slice(0, RUBRIKRAD_SOKDJUP).map(rad => _AVGRANSARE
        .map(d => ({ d, celler: rad.split(d).map(c => c.replace(/^"+|"+$/g, '')) }))
        .filter(x => x.celler.length > 1));
    const r = hittaRubrikrad(delningar.map(rad => rad.map(x => x.celler)), sokordsgrupper, minTraffar, profiler);
    if (!r.hits) return { line: 0, delim: _gissaAvgransare(text), hits: 0 };
    return { line: r.line, delim: delningar[r.line][r.delning].d, hits: r.hits };
}

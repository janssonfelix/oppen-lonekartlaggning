// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
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
    // En importprofil som pekar ut ansvarskoden (godkänns ändå bara med ≥ 95 % giltiga värden).
    const profil = state.importprofil && state.importprofil.mappning.ansvar;
    if (profil && (rubriker || []).includes(profil)) return profil;
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
 * Steget mellan raderna som PII-kontrollen samplar i en fil med n rader: ⌈n/50⌉ (minst 1), så att högst 50 rader
 * sprids jämnt över filen (B4). Delas av detectSensitiveColumns och den strömmande CSV-inläsningen.
 * @param {number} n
 */
function _pnrSampelSteg(n) {
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
function detectSensitiveColumns(rows) {
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

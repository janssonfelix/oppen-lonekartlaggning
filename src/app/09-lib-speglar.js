// ====================================================================
// AUTO-GENERERAD FIL — RÖR INTE.
//
// Speglar de rena kärnmodulerna i src/lib/ (stat, forecast, structure, rng,
// likvardighet, lonepolitik, falt, urval, utforska, chartdata)
// för webbläsarbygget. Varje modul inlinas verbatim i en IIFE (endast
// `export` strippas) och de namn app.js anropar exponeras som const-alias.
// src/lib/ är enda källa — ändra där och kör `npm run build:app` (eller
// npm run bundle). Genererad av tools/gen-mirrors.mjs; vaktas av
// tests/drift.test.js.
// ====================================================================
/* eslint-disable */
// ---- speglar src/lib/kon.js ----
const __mirrorKon = (() => {
// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
/**
 * Öppen lönekartläggning — Könet på en lönerad.
 *
 * Två predikat som prövar radens normaliserade kön: arKvinna och arMan. Inläsningen (inlasning.js) har redan satt
 * fältet kon till 'kvinna' eller 'man', och rader med annat kön utesluts där; predikaten är det enda ställe i
 * verktyget där villkoren skrivs. Modulen importerar ingenting, så att alla lib-moduler kan använda den (också
 * falt.js, som står sent i speglingsordningen).
 *
 * Webbläsarbygget får en AUTO-GENERERAD spegel i src/app/09-lib-speglar.js.
 */

/** Sant när radens kön är 'kvinna' (ett kön som innehåller 'kvinna'). Saknas raden eller könet: falskt. */
function arKvinna(r) {
    return !!r && typeof r.kon === 'string' && r.kon.includes('kvinna');
}

/** Sant när radens kön är 'man' eller 'män'. Saknas raden eller könet: falskt. */
function arMan(r) {
    return !!r && (r.kon === 'man' || r.kon === 'män');
}

    return { arKvinna, arMan };
})();
const arKvinna = __mirrorKon.arKvinna;
const arMan = __mirrorKon.arMan;

// ---- speglar src/lib/termer.js ----
const __mirrorTermer = (() => {
// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
/**
 * Öppen lönekartläggning — termerna på ett ställe (ADR-74).
 *
 * Verktyget använder AID:s egna ord: AID-etikett, AID-kod, etikettnamn och huvudområde. Orden står bara här, som
 * variabler, så att en annan uppsättning (till exempel för en annan bransch) byts på ett ställe. Varje begrepp har
 * de ordformer svenskan kräver och sitt genus, så att artikel och adjektiv böjs rätt också för ett ett-ord:
 * "en kvinnodominerad AID-etikett" men "ett kvinnodominerat yrke". Ett begrepp kan ha en kort form för en
 * kolumnrubrik där hela termen inte ryms (ADR-75); utan den används obestämd form.
 *
 * I appen: `T` är den gällande uppsättningen (`src/app/09-termer.js`), `${T.enhet.fl}` i stället för ordet, och
 * fast text skrivs som mall: `{enhet.en}`, se `fyllTermer`. Vakten i `tests/termer.test.js` håller orden borta
 * från resten av gränssnittet.
 *
 * Webbläsarbygget får en AUTO-GENERERAD spegel i src/app/09-lib-speglar.js.
 */

/** @typedef {'utrum'|'neutrum'} Genus */
/** @typedef {'en'|'bf'|'fl'|'bfl'|'kort'} Form */
/**
 * Ett begrepp: obestämd form (en), bestämd form (bf), plural (fl), bestämd plural (bfl), genus och en valfri kort
 * form (kort) för kolumnrubriker där hela termen inte ryms. Exporternas etiketter behåller hela termen (ADR-75).
 * @typedef {{ en: string, bf: string, fl: string, bfl: string, kort?: string, genus: Genus }} Begrepp
 */
/**
 * En uppsättning termer. `enhet` är det verktyget grupperar på, `jamforelse` den enhet ett kvinnodominerat arbete
 * jämförs med, `kod` och `namn` enhetens två delar, `huvudomrade` grupperna av enheter, `niva` kravnivån och
 * `system` klassificeringens namn.
 * @typedef {{ enhet: Begrepp, jamforelse: Begrepp, kod: Begrepp, namn: Begrepp, huvudomrade: Begrepp, niva: Begrepp, system: string }} Termer
 */
/** @typedef {string | { utrum: string, neutrum: string, plural: string }} Adjektiv */

/** Begreppen, i den ordning de står i tabellen. */
const TERM_BEGREPP = /** @type {const} */ (['enhet', 'jamforelse', 'kod', 'namn', 'huvudomrade', 'niva']);
/** Ordformerna per begrepp. Den korta formen är valfri och står inte här; vakten prövar inte "AID" ensamt. */
const TERM_FORMER = /** @type {const} */ (['en', 'bf', 'fl', 'bfl']);
/** Högsta längd för en ordform. */
const TERM_MAX = 40;

/** Standarduppsättningen. @type {Termer} */
const STANDARDTERMER = Object.freeze({
    enhet:       Object.freeze({ en: 'AID-etikett', bf: 'AID-etiketten', fl: 'AID-etiketter', bfl: 'AID-etiketterna', kort: 'AID', genus: /** @type {Genus} */ ('utrum') }),
    jamforelse:  Object.freeze({ en: 'jämförelseetikett', bf: 'jämförelseetiketten', fl: 'jämförelseetiketter', bfl: 'jämförelseetiketterna', genus: /** @type {Genus} */ ('utrum') }),
    kod:         Object.freeze({ en: 'AID-kod', bf: 'AID-koden', fl: 'AID-koder', bfl: 'AID-koderna', genus: /** @type {Genus} */ ('utrum') }),
    namn:        Object.freeze({ en: 'etikettnamn', bf: 'etikettnamnet', fl: 'etikettnamn', bfl: 'etikettnamnen', genus: /** @type {Genus} */ ('neutrum') }),
    huvudomrade: Object.freeze({ en: 'huvudområde', bf: 'huvudområdet', fl: 'huvudområden', bfl: 'huvudområdena', genus: /** @type {Genus} */ ('neutrum') }),
    niva:        Object.freeze({ en: 'BAS-intervall', bf: 'BAS-intervallet', fl: 'BAS-intervall', bfl: 'BAS-intervallen', genus: /** @type {Genus} */ ('neutrum') }),
    system:      'AID'
});

// Tecken som inte får stå i en term: markering, mallens klamrar och styrtecken. Termerna sätts in i HTML-mallar.
const OTILLATET = /[<>&"'`{}\u0000-\u001f]/;

/** @param {unknown} v @param {string} vad */
function _ord(v, vad) {
    const t = typeof v === 'string' ? v.replace(/\s+/g, ' ').trim() : '';
    if (!t) throw new Error(`Termen saknar ${vad}.`);
    if (t.length > TERM_MAX) throw new Error(`${vad} är längre än ${TERM_MAX} tecken.`);
    if (OTILLATET.test(t)) throw new Error(`${vad} innehåller ett tecken som inte är tillåtet.`);
    return t;
}

/**
 * Lägger en egen uppsättning över standarden. Varje begrepp som anges måste ha alla fyra ordformerna och genus, och
 * kan ha en kort form; begrepp som inte anges behåller standarden. Tomma, för långa eller okända värden avvisas med ett fel.
 * @param {Partial<Record<typeof TERM_BEGREPP[number], Partial<Begrepp>>> & { system?: string } | null} [egna]
 * @returns {Termer}
 */
function skapaTermer(egna) {
    if (egna == null) return STANDARDTERMER;
    if (typeof egna !== 'object' || Array.isArray(egna)) throw new Error('Termerna ska vara ett objekt.');
    /** @type {Record<string, any>} */
    const ut = { ...STANDARDTERMER };
    for (const [nyckel, varde] of Object.entries(egna)) {
        if (nyckel === 'system') { ut.system = _ord(varde, 'system'); continue; }
        if (!(/** @type {readonly string[]} */ (TERM_BEGREPP)).includes(nyckel)) throw new Error(`Okänt begrepp: ${nyckel}.`);
        if (!varde || typeof varde !== 'object') throw new Error(`Begreppet ${nyckel} ska ha ordformer och genus.`);
        const b = /** @type {Record<string, unknown>} */ (varde);
        if (b.genus !== 'utrum' && b.genus !== 'neutrum') throw new Error(`Begreppet ${nyckel} ska ha genus utrum eller neutrum.`);
        ut[nyckel] = Object.freeze({
            en: _ord(b.en, `${nyckel}.en`), bf: _ord(b.bf, `${nyckel}.bf`),
            fl: _ord(b.fl, `${nyckel}.fl`), bfl: _ord(b.bfl, `${nyckel}.bfl`),
            ...(b.kort != null ? { kort: _ord(b.kort, `${nyckel}.kort`) } : {}),
            genus: b.genus
        });
    }
    return /** @type {Termer} */ (Object.freeze(ut));
}

/** Genitiv: ordet + "s", utom när det slutar på s, x eller z ("AID-etikettens", "huvudområdets", "BAS-intervalls"). */
function genitiv(ord) {
    const t = String(ord ?? '');
    if (!t.trim()) return '';
    return /[sxz]$/i.test(t) ? t : t + 's';
}

/** Stor begynnelsebokstav: "huvudområde" → "Huvudområde". Resten av texten rörs inte. */
function stor(text) {
    const t = String(text ?? '');
    return t.charAt(0).toLocaleUpperCase('sv') + t.slice(1);
}

/**
 * Artikeln efter genus och antal: en/ett, med `bestamd` den/det, i plural de (bestämd) eller ingen (obestämd).
 * @param {Begrepp} b
 * @param {{ bestamd?: boolean, plural?: boolean }} [val]
 */
function artikel(b, { bestamd = false, plural = false } = {}) {
    if (plural) return bestamd ? 'de' : '';
    if (b.genus === 'neutrum') return bestamd ? 'det' : 'ett';
    return bestamd ? 'den' : 'en';
}

const VOKAL = 'aeiouyåäöé';
/** Neutrum av ett regelbundet adjektiv: kvinnodominerad → kvinnodominerat, stor → stort, känd → känt, lägre → lägre. */
function _neutrum(s) {
    if (/[ea]$/.test(s)) return s;                                   // lägre, lika: oböjliga
    if (new RegExp(`[${VOKAL}]$`).test(s)) return s + 'tt';          // ny → nytt
    if (/ad$/.test(s)) return s.slice(0, -1) + 't';                  // kvinnodominerad → kvinnodominerat
    if (new RegExp(`[${VOKAL}]d$`).test(s)) return s.slice(0, -1) + 'tt';   // röd → rött
    if (/d$/.test(s)) return s.slice(0, -1) + 't';                   // känd → känt
    if (/t$/.test(s)) return s;                                      // lätt → lätt
    return s + 't';                                                  // stor → stort, sexsiffrig → sexsiffrigt
}
/** Bestämd form och plural av ett regelbundet adjektiv: kvinnodominerad → kvinnodominerade, stor → stora. */
function _plural(s) {
    if (/[ea]$/.test(s)) return s;                                   // lägre, lika
    if (/ad$/.test(s)) return s + 'e';                               // kvinnodominerad → kvinnodominerade
    return s + 'a';                                                  // stor → stora, ny → nya
}

/**
 * Adjektivet böjt efter begreppets genus och antal: "kvinnodominerad" blir kvinnodominerad (en-ord), kvinnodominerat
 * (ett-ord) och kvinnodominerade (bestämd form eller plural). Reglerna gäller regelbundna adjektiv och particip på
 * -ad; ett oregelbundet adjektiv anges med alla tre formerna: { utrum: 'egen', neutrum: 'eget', plural: 'egna' }.
 * @param {Adjektiv} stam
 * @param {Begrepp} b
 * @param {{ bestamd?: boolean, plural?: boolean }} [val]
 */
function adjektiv(stam, b, { bestamd = false, plural = false } = {}) {
    if (stam && typeof stam === 'object') return plural || bestamd ? stam.plural : b.genus === 'neutrum' ? stam.neutrum : stam.utrum;
    const s = String(stam ?? '').trim();
    if (plural || bestamd) return _plural(s);
    return b.genus === 'neutrum' ? _neutrum(s) : s;
}

/**
 * Begreppet i en form, med adjektiv och genitiv om de anges. Med adjektiv får bestämd form sin artikel
 * (den/det/de), som svenskan kräver: "den kvinnodominerade AID-etiketten", "det kvinnodominerade yrket".
 *   termFras(T.enhet, 'en', { adjektiv: 'kvinnodominerad' })  → "kvinnodominerad AID-etikett"
 *   termFras(T.enhet, 'fl', { adjektiv: 'kvinnodominerad' })  → "kvinnodominerade AID-etiketter"
 *   termFras(T.enhet, 'bf', { genitiv: true })                → "AID-etikettens"
 *   termFras(T.enhet, 'kort')                                 → "AID" (obestämd form när kort form saknas)
 * @param {Begrepp} b
 * @param {Form} [form]
 * @param {{ adjektiv?: Adjektiv, genitiv?: boolean }} [val]
 */
function termFras(b, form = 'en', { adjektiv: adj, genitiv: gen = false } = {}) {
    if (form !== 'kort' && !(/** @type {readonly string[]} */ (TERM_FORMER)).includes(form)) throw new Error(`Okänd ordform: ${form}.`);
    let t = form === 'kort' ? b.kort ?? b.en : b[form];
    if (adj) {
        const plural = form === 'fl' || form === 'bfl', bestamd = form === 'bf' || form === 'bfl';
        t = `${adjektiv(adj, b, { plural, bestamd })} ${t}`;
        if (bestamd) t = `${artikel(b, { bestamd, plural })} ${t}`;
    }
    return gen ? genitiv(t) : t;
}

/** Formen för ett antal: obestämd singular vid 1, annars plural. `${n} ${ordForAntal(n, T.enhet)}` ger "1 AID-etikett". */
function ordForAntal(n, b) {
    return Number(n) === 1 ? b.en : b.fl;
}

// {begrepp}, {begrepp.form}, {begrepp.form.s} (genitiv), {begrepp.art} (en/ett), {begrepp.form:adjektiv},
// {begrepp.adj:adjektiv} (adjektivet ensamt, böjt efter genus: "räknas som {enhet.adj:kvinnodominerad}") och
// {begrepp.kort} (kolumnrubrikens korta form, utan adjektiv).
const MALL = /\{([A-Za-z]+)(?:\.(en|bf|fl|bfl|kort|art|adj))?(\.s)?(?::([\p{Ll}-]+))?\}/gu;

/**
 * Fyller en mall med termerna. Versal först i begreppets namn ger stor begynnelsebokstav. Klamrar som inte är ett
 * begrepp ({k}, {golv}, profilens {benchmarkLabel}) står kvar, så att mallen kan fyllas i flera steg.
 *   "Kvinnor och män med samma {enhet.en}"           → "Kvinnor och män med samma AID-etikett"
 *   "{Enhet.bfl} i samma {niva.en}"                   → "AID-etiketterna i samma BAS-intervall"
 *   "{enhet.art} {enhet.en:kvinnodominerad}"          → "en kvinnodominerad AID-etikett" (ett-ord: "ett kvinnodominerat yrke")
 *   "{enhet.bf.s} median"                             → "AID-etikettens median"
 *   "räknas som {enhet.adj:kvinnodominerad}"          → "räknas som kvinnodominerad" (ett-ord: "kvinnodominerat")
 *   "{Enhet.kort} median högre (kr)"                  → "AID median högre (kr)"
 * @param {string} mall
 * @param {Termer} [termer]
 */
function fyllTermer(mall, termer = STANDARDTERMER) {
    return String(mall ?? '').replace(MALL, (hel, nyckel, form, gen, adj) => {
        const namn = nyckel.charAt(0).toLowerCase() + nyckel.slice(1);
        const versal = nyckel !== namn;
        let t;
        if (namn === 'system') {
            if (form || adj) return hel;
            t = gen ? genitiv(termer.system) : termer.system;
        } else if ((/** @type {readonly string[]} */ (TERM_BEGREPP)).includes(namn)) {
            const b = termer[/** @type {typeof TERM_BEGREPP[number]} */ (namn)];
            if (form === 'art') {
                if (gen || adj) return hel;
                t = artikel(b);
            } else if (form === 'adj') {
                if (gen || !adj) return hel;
                t = adjektiv(adj, b);
            } else if (form === 'kort') {
                if (adj) return hel;
                t = termFras(b, 'kort', { genitiv: !!gen });
            } else {
                t = termFras(b, form || 'en', { adjektiv: adj, genitiv: !!gen });
            }
        } else {
            return hel;
        }
        return versal ? stor(t) : t;
    });
}

/** Alla ordformer i en uppsättning, längsta först (för vakten och sökningen). */
function termformer(termer = STANDARDTERMER) {
    const ord = new Set();
    for (const b of TERM_BEGREPP) for (const f of TERM_FORMER) ord.add(termer[b][f]);
    return [...ord].sort((a, b) => b.length - a.length);
}

    return { skapaTermer, fyllTermer, termFras, artikel, adjektiv, genitiv, stor, ordForAntal };
})();
const _tmSkapa = __mirrorTermer.skapaTermer;
const _tmFyll = __mirrorTermer.fyllTermer;
const termFras = __mirrorTermer.termFras;
const termArtikel = __mirrorTermer.artikel;
const termAdjektiv = __mirrorTermer.adjektiv;
const termGenitiv = __mirrorTermer.genitiv;
const termStor = __mirrorTermer.stor;
const termForAntal = __mirrorTermer.ordForAntal;

// ---- speglar src/lib/namn.js ----
const __mirrorNamn = (() => {
    // importer ur tidigare speglade lib-moduler
    const genitiv = __mirrorTermer.genitiv;

// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
/**
 * Öppen lönekartläggning — namnformer för organisationen och jämförelsestatistiken
 * (ADR-36), och ordformen för ett antal personer.
 *
 * Webbläsarbygget får en AUTO-GENERERAD spegel i src/app/09-lib-speglar.js.
 */

const MAX = 100;

/** Genitiv: namnet + "s", utom när det slutar på s, x eller z (regeln i termer.js). */
function namnGenitiv(namn) {
    return genitiv(String(namn ?? '').trim());
}

/** Trimmar, slår ihop blanksteg och kortar till högst 100 tecken. */
function normaliseraNamn(text) {
    return String(text ?? '').replace(/\s+/g, ' ').trim().slice(0, MAX);
}

/** "person" när antalet är 1, annars "personer": `${k} ${personOrd(k)}` ger "minst 1 person". */
function personOrd(n) {
    return Number(n) === 1 ? 'person' : 'personer';
}

    return { namnGenitiv, normaliseraNamn, personOrd };
})();
const _namnGenitiv = __mirrorNamn.namnGenitiv;
const _namnNormalisera = __mirrorNamn.normaliseraNamn;
const personOrd = __mirrorNamn.personOrd;

// ---- speglar src/lib/aid-etiketter.js ----
const __mirrorAidEtiketter = (() => {
// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
// AUTO-GENERERAD av tools/gen-aid-etiketter.mjs ur SKR, Etikettlista AID 2018 (reviderad 2026-09-23). Ändra inte för hand.
// Innehåller bara kod, etikettnamn och möjliga ansvarskoder per etikett.
//
// Webbläsarbygget får en AUTO-GENERERAD spegel i src/app/09-lib-speglar.js.

const LISTA = Object.freeze({
    version: '2026-09-23',
    kalla: 'SKR, Etikettlista AID 2018 (reviderad 2026-09-23)',
    etiketter: Object.freeze([
        ["101010","Ledning, övergripande","A"],
        ["101011","Ledning, ekonomi","A,B,C,L"],
        ["101012","Ledning, personal/HR","A,B,C,L"],
        ["101013","Ledning, information/kommunikation","A,B,C,L"],
        ["101014","Ledning, IT","A,B,C,L"],
        ["101015","Ledning, administration","A,B,C,L"],
        ["102010","Ledning, hälso- och sjukvård","A,B,C,L"],
        ["102510","Ledning, tandvård","A,B,C,L"],
        ["103010","Ledning, rehabilitering och förebyggande arbete","A,B,C,L"],
        ["103510","Ledning, individ- och familjeomsorg","A,B,C,L"],
        ["103511","Ledning, äldreomsorg","A,B,C,L"],
        ["103512","Ledning, omsorg om personer med funktionsnedsättning samt socialpsykiatriområdet","A,B,C,L"],
        ["104010","Ledning, skola","A,B,C,L,1001,1002"],
        ["104011","Rektor (skola)","B,C,L,1001,1002"],
        ["104012","Ledning, förskola, pedagogisk omsorg och fritidsverksamhet","A,B,C,L,1001,1002"],
        ["104510","Ledning, kultur, turism, rekreation och friluftsfrågor","A,B,C,L"],
        ["105010","Ledning, teknik, hantverk, miljö och samhällsbyggnad","A,B,C,L"],
        ["105510","Ledning, räddningstjänst och säkerhet","A,B,C,L"],
        ["106010","Ledning, köks- och måltidsarbete","A,B,C,L"],
        ["106510","Ledning, städ, tvätt och renhållning","A,B,C,L"],
        ["109090","Ledning, annan","A,B,C,L"],
        ["151010","Handläggare, övergripande verksamhet","B,C,L,F"],
        ["151011","Handläggare, ekonomi","B,C,L,F"],
        ["151012","Handläggare, personal/HR","B,C,L,F"],
        ["151013","Handläggare, information/kommunikation","B,C,L,F"],
        ["151014","Handläggare, IT","B,C,L,F"],
        ["151015","Handläggare, upphandling/inköp","B,C,L,F"],
        ["151016","Handläggare, konsument-, medborgar- och samhällsservice","B,C,L,F"],
        ["151017","Handläggare, miljöfrågor","B,C,L,F"],
        ["151018","Jurist","B,C,L,F"],
        ["151019","Arkivarie","B,C,L,F"],
        ["151020","Handläggare, nämnder","B,C,L,F"],
        ["151021","Handläggare, samhällsutveckling och säkerhetsfrågor","B,C,L,F"],
        ["151022","Handläggare, hälso- och sjukvård, tandvård, rehabilitering samt psykiatri","B,C,L,F"],
        ["151023","Handläggare, individ- och familjeomsorg, äldreomsorg, funktionsnedsättning, socialpsykiatri och integrationsarbete","B,C,L,F"],
        ["151024","Handläggare, förskole-, skol-, fritids- och annan pedagogisk verksamhet","B,C,L,F"],
        ["151025","Handläggare, infrastruktur, trafik och kollektivtrafikfrågor","B,C,L,F"],
        ["151026","Handläggare, teknik och lokal/fastighetsfrågor","B,C,L,F"],
        ["151090","Handläggare, annan","B,C,L,F"],
        ["152010","Administratör, övergripande verksamhet","B,C,L,F"],
        ["152011","Administratör, ekonomi","B,C,L,F"],
        ["152012","Administratör, personal/HR/löner","B,C,L,F"],
        ["152013","Administratör, information/kommunikation, medborgar- och samhällsservice","B,C,L,F"],
        ["152014","Administratör, IT","B,C,L,F"],
        ["152015","Administratör, individ- och familjeomsorg, äldreomsorg, funktionsnedsättning, socialpsykiatri och integrationsarbete","B,C,L,F"],
        ["152016","Administratör, förskole-, skol-, fritids-, och annan pedagogisk verksamhet","B,C,L,F"],
        ["152017","Receptionist, telefonist","B,C,L,F"],
        ["152018","Administratör, vård","B,C,L,F"],
        ["152019","Administratör, kultur, turism och friluftsområdet","B,C,L,F"],
        ["152020","Administratör, teknik- och fastighetsfrågor samt samhällsbyggnad","B,C,L,F"],
        ["152021","Administratör, trafik- och kollektivtrafikfrågor","B,C,L,F"],
        ["152090","Administratör, annan","B,C,L,F"],
        ["201010","Överläkare","B,C,L,F,M"],
        ["201011","Distriktsläkare/Specialist allmänmedicin","B,C,L,F,M"],
        ["201012","Skolläkare","B,C,L,F"],
        ["201013","Företagsläkare","B,C,L,F"],
        ["202010","Specialistläkare","B,C,L,F,M"],
        ["203010","Läkare legitimerad, specialiseringstjänstgöring","B,C,L,F,M"],
        ["203020","Läkare legitimerad, bastjänstgöring","B,C,L,F"],
        ["203090","Läkare legitimerad, annan","B,C,L,F,M"],
        ["204010","Läkare ej legitimerad, allmäntjänstgöring","B,C,L,F"],
        ["204090","Läkare ej legitimerad, annan","B,C,L,F"],
        ["204510","Psykolog","B,C,L,F"],
        ["204511","PTP-psykolog","B,C,L,F"],
        ["204610","Psykoterapeut","B,C,L,F"],
        ["205010","Barnmorska, vårdavdelning","B,C,L,F"],
        ["205011","Barnmorska, mottagning/rådgivning","B,C,L,F"],
        ["206010","Anestesisjuksköterska","B,C,L,F"],
        ["206011","Distriktssköterska","B,C,L,F"],
        ["206012","Psykiatrisjuksköterska","B,C,L,F"],
        ["206013","Ambulanssjuksköterska","B,C,L,F"],
        ["206014","Sjuksköterska, funktionsnedsättning och äldreomsorg/geriatrik","B,C,L,F"],
        ["206015","Intensivvårdssjuksköterska","B,C,L,F"],
        ["206016","Operationssjuksköterska","B,C,L,F"],
        ["206017","Sjuksköterska, medicin/kirurgi","B,C,L,F"],
        ["206018","Sjuksköterska, barn och ungdom","B,C,L,F"],
        ["206019","Skolsköterska","B,C,L,F"],
        ["206020","Företagssköterska","B,C,L,F"],
        ["206021","Sjuksköterska, annan specialistinriktning","B,C,L,F"],
        ["206022","Medicinskt ansvarig sjuksköterska (MAS)","B,C,L,F"],
        ["206023","Sjuksköterska, specialfunktion","B,C,L,F"],
        ["206090","Sjuksköterska, allmän","B,C,L,F"],
        ["206510","Röntgensjuksköterska","B,C,L,F"],
        ["207008","Undersköterska med specialistinriktning","B,C,L,F"],
        ["207009","Undersköterska, hemtjänst","B,C,L,F"],
        ["207010","Undersköterska, hemvård/hemsjukvård","B,C,L,F"],
        ["207011","Undersköterska, särskilt boende","B,C,L,F"],
        ["207013","Undersköterska, vård-/specialavdelning hälso- och sjukvård","B,C,L,F"],
        ["207014","Undersköterska, mottagning hälso- och sjukvård","B,C,L,F"],
        ["207015","Barnsköterska, hälso- och sjukvård","B,C,L,F"],
        ["207016","Ambulanssjukvårdare","B,C,L,F"],
        ["207017","Medicinsk fotterapeut","B,C,L,F"],
        ["207018","Skötare, mottagning psykiatri","B,C,L,F"],
        ["207019","Skötare, vårdavdelning psykiatri","B,C,L,F"],
        ["207023","Vårdbiträde, hemvård/hemsjukvård","B,C,L,F"],
        ["207024","Vårdbiträde, särskilt boende","B,C,L,F"],
        ["207026","Röntgenbiträde","B,C,L,F"],
        ["207029","Vårdbiträde, hemtjänst","B,C,L,F"],
        ["207090","Biträdesarbete, annat","B,C,L,F"],
        ["208010","Sjukhusfysiker","B,C,L,F"],
        ["208011","Sjukhuskemist","B,C,L,F"],
        ["208012","Obduktionstekniker","B,C,L,F"],
        ["208013","Biomedicinsk analytiker","B,C,L,F"],
        ["208014","Cytodiagnostiker","B,C,L,F"],
        ["208015","Andra specialiteter inom hälso- och sjukvård","B,C,L,F"],
        ["208016","Laboratoriebiträde","B,C,L,F"],
        ["208017","Farmaceut","B,C,L,F"],
        ["208018","Sjukhusbiolog","B,C,L,F"],
        ["208090","Laboratoriearbete, annat","B,C,L,F"],
        ["251010","Tandläkare, allmäntandvård","B,C,L,F"],
        ["251011","Specialisttandläkare","B,C,L,F"],
        ["251013","Tandläkare under specialiseringstjänstgöring","B,C,L,F"],
        ["252009","Tandsköterska med specialistinriktning","B,C,L,F"],
        ["252010","Tandsköterska","B,C,L,F"],
        ["252011","Tandhygienist","B,C,L,F"],
        ["252012","Tandtekniker","B,C,L,F"],
        ["252090","Tandvårdsarbete, annat","B,C,L,F"],
        ["301009","Medicinskt ansvarig för rehabilitering (MAR)","B,C,L,F"],
        ["301010","Arbetsterapeut","B,C,L,F"],
        ["301011","Fysioterapeut","B,C,L,F"],
        ["301012","Arbetsterapibiträde","B,C,L,F"],
        ["301013","Fysioterapiassistent","B,C,L,F"],
        ["301014","Logoped","B,C,L,F"],
        ["301015","Audionom","B,C,L,F"],
        ["301016","Syn-, hörsel- och talpedagog","B,C,L,F"],
        ["301017","Dövtolk/Teckenspråkstolk","B,C,L,F"],
        ["301018","Dietist","B,C,L,F"],
        ["301020","Hjälpmedelskonsulent","B,C,L,F"],
        ["301021","Hälsovetare","B,C,L,F"],
        ["301090","Rehabiliterings- och förebyggande arbete, annat","B,C,L,F"],
        ["351008","Socialsekreterare, barn och unga, myndighetsutövning","B,C,L,F"],
        ["351009","Socialsekreterare, ekonomiskt bistånd","B,C,L,F"],
        ["351010","Socialsekreterare, utan myndighetsutövning","B,C,L,F"],
        ["351011","Fältsekreterare","B,C,L,F"],
        ["351012","Socialsekreterare, vuxna och LSS, myndighetsutövning","B,C,L,F"],
        ["351013","Familjerådgivare","B,C,L,F"],
        ["351014","Integrationshandläggare","B,C,L,F"],
        ["351015","Behandlingsassistent/Socialpedagog","B,C,L,F"],
        ["351016","Arbetsmarknadskonsulent","B,C,L,F"],
        ["351030","Stödpedagog, funktionsnedsättning","B,C,L,F"],
        ["351031","Stödassistent/Vårdare, gruppboende, funktionsnedsättning","B,C,L,F"],
        ["351032","Stödassistent/Vårdare, dagverksamhet, funktionsnedsättning","B,C,L,F"],
        ["351033","Vårdbiträde/Stödbiträde, funktionsnedsättning","B,C,L,F"],
        ["351034","Boendestödjare, i hemmiljö, inom funktionsnedsättning","B,C,L,F"],
        ["351035","Skötare/Boendestödjare, behandlingsarbete i hemmiljö, inom socialpsykiatri","B,C,L,F"],
        ["351040","Personlig assistent","B,C,L,F"],
        ["351041","Anhörigvårdare","B,C,L,F"],
        ["351090","Socialt arbete, annat","B,C,L,F"],
        ["352010","Kurator","B,C,L,F"],
        ["352090","Kurativt arbete, annat","B,C,L,F"],
        ["401009","Lärare grundskola, årskurs F-3","B,C,L,F,1001,1002"],
        ["401010","Lärare grundskola, årskurs 4-6","B,C,L,F,1001,1002"],
        ["401011","Lärare grundskola, årskurs 7-9","B,C,L,F,1001,1002"],
        ["401012","Lärare gymnasieskola, allmänna ämnen","B,C,L,F,1001,1002"],
        ["401013","Lärare gymnasieskola, yrkesämnen","B,C,L,F,1001,1002"],
        ["401015","Lärare, folkhögskola","B,C,L,F"],
        ["401016","Speciallärare","B,C,L,F,1001,1002"],
        ["401017","Specialpedagog","B,C,L,F,1001,1002"],
        ["401018","SFI-lärare","B,C,L,F,1001,1002"],
        ["401019","Lärare, modersmål","B,C,L,F,1001,1002"],
        ["401020","Lärare, praktiska/estetiska ämnen, grundskola","B,C,L,F,1001,1002"],
        ["401021","Lärare, praktiska/estetiska ämnen, gymnasieskola","B,C,L,F,1001,1002"],
        ["401022","Lärare, vuxenutbildning, allmänna ämnen","B,C,L,F,1001,1002"],
        ["401023","Lärare, vuxenutbildning, yrkesämnen","B,C,L,F,1001,1002"],
        ["402010","Förskollärare","B,C,L,F,1001,1002"],
        ["402011","Lärare i fritidshem","B,C,L,F,1001,1002"],
        ["402090","Lärar-, förskollärararbete, annat","B,C,L,F,1001,1002"],
        ["403010","Barnskötare","B,C,L,F"],
        ["403011","Dagbarnvårdare","B,C,L,F"],
        ["403012","Modersmålstränare, förskola","B,C,L,F,1001,1002"],
        ["403013","Instruktör/Handledare","B,C,L,F,1001,1002"],
        ["403014","Studie- och yrkesvägledare","B,C,L,F"],
        ["403015","Lärarassistent","B,C,L,F"],
        ["403016","Elevassistent","B,C,L,F"],
        ["403090","Skolarbete, annat","B,C,L,F"],
        ["451010","Kultursekreterare/kulturhandläggare","B,C,L,F"],
        ["451011","Lärare, kulturskola","B,C,L,F"],
        ["451012","Kulturarbete","B,C,L,F"],
        ["451013","Antikvarie","B,C,L,F"],
        ["451014","Museiarbete","B,C,L,F"],
        ["451015","Bibliotekarie","B,C,L,F"],
        ["451016","Biblioteksassistent","B,C,L,F"],
        ["451090","Kulturarbete, annat","B,C,L,F"],
        ["452010","Turism, rekreation och friluftskonsulent","B,C,L,F"],
        ["452011","Fritidsledare","B,C,L,F"],
        ["452012","Turismarbete","B,C,L,F"],
        ["452013","Badmästare","B,C,L,F"],
        ["452014","Friskvårdsarbete, badpersonal","B,C,L,F"],
        ["452090","Turism, rekreation och friluftsarbete, annat","B,C,L,F"],
        ["501010","Fysisk samhällsplanerare","B,C,L,F"],
        ["501011","Bygglovshandläggare","B,C,L,F"],
        ["501012","Byggnadsinspektör","B,C,L,F"],
        ["501013","Miljö- och hälsoskyddsinspektör","B,C,L,F"],
        ["502010","Systemutvecklare","B,C,L,F"],
        ["502011","Ingenjör, mätning, kartering, GIS","B,C,L,F"],
        ["502012","Ingenjör, park/gator, trafik","B,C,L,F"],
        ["502013","Ingenjör, mark, fastigheter","B,C,L,F"],
        ["502014","Ingenjör, drift, VA-ingenjör","B,C,L,F"],
        ["502016","Ingenjör, hälso- och sjukvård","B,C,L,F"],
        ["502090","Ingenjör, annan","B,C,L,F"],
        ["503010","Tekniker, IT","B,C,L,F"],
        ["503011","Tekniker, lantmäteri","B,C,L,F"],
        ["503012","Tekniker, drift","B,C,L,F"],
        ["503013","Tekniker, allmänteknisk","B,C,L,F"],
        ["503014","Tekniker, hälso- och sjukvård","B,C,L,F"],
        ["503015","Steriltekniker","B,C,L,F"],
        ["503090","Tekniker, annan","B,C,L,F"],
        ["509090","Teknikarbete, annat","B,C,L,F"],
        ["521010","Elektriker/elmontör","B,C,L,F"],
        ["521011","Fastighetsskötare","B,C,L,F"],
        ["521012","Anläggningsarbete","B,C,L,F"],
        ["521013","Hantverkare","B,C,L,F"],
        ["521014","Fordonsförare","B,C,L,F"],
        ["521015","Vaktmästare","B,C,L,F"],
        ["521016","Kontorsvaktmästare","B,C,L,F"],
        ["521017","Parkeringsvakt/trafikövervakare","B,C,L,F"],
        ["521018","Park-/trädgårdsarbete","B,C,L,F"],
        ["521019","Lantbruksarbete","B,C,L,F"],
        ["529090","Hantverkararbete, annat","B,C,L,F"],
        ["551010","Brandingenjör","B,C,L,F"],
        ["551011","Brandinspektör","B,C,L,F"],
        ["551012","Brandmästare","B,C,L,F"],
        ["551013","Brandman","B,C,L,F"],
        ["601010","Kock","B,C,L,F"],
        ["601011","Kostekonom","B,C,L,F"],
        ["601012","Måltidspersonal","B,C,L,F"],
        ["609090","Köks- och måltidsarbete, annat","B,C,L,F"],
        ["651010","Lokalvårdare/städare","B,C,L,F"],
        ["651011","Tvätteriarbete","B,C,L,F"],
        ["651012","Renhållningsarbete","B,C,L,F"],
        ["651013","Förrådsarbete","B,C,L,F"],
        ["659090","Städ-, tvätt- och renhållningsarbete, annat","B,C,L,F"]
    ])
});

/** Etikettlistan: { version, kalla, etiketter: [kod, namn, 'A,B,…'][] }. */
function aidEtikettlista() {
    return LISTA;
}

    return { aidEtikettlista };
})();

// ---- speglar src/lib/aid.js ----
const __mirrorAid = (() => {
    // importer ur tidigare speglade lib-moduler
    const aidEtikettlista = __mirrorAidEtiketter.aidEtikettlista;
    const skapaTermer = __mirrorTermer.skapaTermer;
    const stor = __mirrorTermer.stor;
    const adjektiv = __mirrorTermer.adjektiv;

// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
/**
 * Öppen lönekartläggning — AID-hierarkin (ADR-33).
 *
 * AID (SKR:s arbetsidentifikation) har en sexsiffrig etikett; de två första siffrorna anger ett
 * av 13 huvudområden ("sektorer"), de fyra första en mellannivå utan namn. Restkoder ("annan")
 * har 090 som de tre sista siffrorna. Etikettnamn och möjliga ansvarskoder kommer ur SKR:s
 * etikettlista (aid-etiketter.js, genererad).
 *
 * Webbläsarbygget får en AUTO-GENERERAD spegel i src/app/09-lib-speglar.js.
 */


/** Standardtermerna (ADR-74); skapaTermer() utan egna termer ger standarduppsättningen. */
const T = skapaTermer();


const HUVUDOMRADEN = Object.freeze([
    { prefix: '10', namn: 'Ledningsarbete' },
    { prefix: '15', namn: 'Handläggar- och administratörsarbete' },
    { prefix: '20', namn: 'Vård- och omsorgsarbete med mera' },
    { prefix: '25', namn: 'Tandvårdsarbete' },
    { prefix: '30', namn: 'Rehabilitering och förebyggande arbete' },
    { prefix: '35', namn: 'Individ- och familjeomsorg, äldreomsorg, funktionsnedsättning, socialpsykiatri och integration' },
    { prefix: '40', namn: 'Förskole-, skol-, fritids- och annan pedagogisk verksamhet' },
    { prefix: '45', namn: 'Kultur-, turism- och friluftsarbete' },
    { prefix: '50', namn: 'Teknikarbete' },
    { prefix: '52', namn: 'Vaktmästeri, trädgård, anläggning med mera' },
    { prefix: '55', namn: 'Räddningstjänstarbete' },
    { prefix: '60', namn: 'Köks- och måltidsarbete' },
    { prefix: '65', namn: 'Städ, tvätt och renhållningsarbete' },
]);
const OKANT_HUVUDOMRADE = `${stor(adjektiv('okänd', T.huvudomrade))} ${T.huvudomrade.en}`;

const _PER_PREFIX = new Map(HUVUDOMRADEN.map(h => [h.prefix, h]));
const _ORDNING = new Map(HUVUDOMRADEN.map((h, i) => [h.namn, i]));
/** @type {Map<string, {kod:string, namn:string, ansvarskoder:string[]}>|null} */
let _index = null;

function _etiketter() {
    if (!_index) {
        _index = new Map(aidEtikettlista().etiketter.map(([kod, namn, a]) =>
            [kod, { kod, namn, ansvarskoder: a ? a.split(',') : [] }]));
    }
    return _index;
}

/** Sex siffror först i fältet (som AID-koden läses i dag), annars null. */
function normaliseraAid(aid) {
    const m = String(aid ?? '').trim().match(/^(\d{6})(?!\d)/);
    return m ? m[1] : null;
}

/** Sifferprefixet ur ett yrkesfält (de inledande siffrorna), eller null när fältet saknar ett. */
function sifferprefixAvYrke(yrke) {
    const m = String(yrke ?? '').match(/^(\d+)/);
    return m ? m[1] : null;
}

/** AID-koden ur ett yrkesfält: de inledande siffrorna, annars hela yrkesfältet som text. */
function aidAvYrke(yrke) {
    return sifferprefixAvYrke(yrke) ?? String(yrke ?? '');
}

/**
 * AID-koden som en lönerad grupperas på: aidAvYrke(r.yrke), och för en rad utan text i fältet radens `aid` (inläsningen
 * tar `aid` ur samma sifferprefix, så för en inläst rad är de samma). En grupp är AID-koden i BAS-intervallet i hela
 * verktyget, aldrig texten i fältet: två stavningar av samma etikett är en grupp, och en rad utan kod grupperas på sin
 * text.
 * @param {{aid?:any, yrke?:any}|null|undefined} r
 */
function aidAvRad(r) {
    if (!r) return '';
    return r.yrke != null && r.yrke !== '' ? aidAvYrke(r.yrke) : String(r.aid ?? '');
}

/**
 * Gruppernas namn (ADR-89): för varje grupp texten i fältet för AID-etikett (`yrke`) som står på flest av gruppens
 * rader; står två texter på lika många rader gäller den som kommer först i lönefilen. En stavning som bara står på
 * enstaka rader, eller ett namn som skrivits i fältet på en rad, blir alltså inte gruppens namn när en annan text står
 * på fler rader. Ger för varje nyckel den första raden med den texten, så att den som skriver namnet tar etiketten
 * (`yrkeLabel`) eller hela fältet ur samma rad. Har gruppen en enda text är raden gruppens första, som förut.
 * @template K
 * @param {Iterable<any>} rader - i lönefilens ordning
 * @param {(r: any) => K} nyckelAv - gruppens nyckel för en rad
 * @returns {Map<K, any>}
 */
function namnrader(rader, nyckelAv) {
    /** @type {Map<K, Map<string, {rad: any, n: number}>>} */
    const perGrupp = new Map();
    for (const r of rader || []) {
        if (!r) continue;
        const nyckel = nyckelAv(r), text = r.yrke == null ? '' : String(r.yrke);
        let texter = perGrupp.get(nyckel);
        if (!texter) { texter = new Map(); perGrupp.set(nyckel, texter); }
        const t = texter.get(text);
        if (t) t.n++; else texter.set(text, { rad: r, n: 1 });
    }
    const ut = new Map();
    for (const [nyckel, texter] of perGrupp) {
        /** @type {{rad: any, n: number}|null} */ let bast = null;
        for (const t of texter.values()) if (!bast || t.n > bast.n) bast = t;
        if (bast) ut.set(nyckel, bast.rad);
    }
    return ut;
}

/** Huvudområdet för en AID-kod, eller null. */
function huvudomrade(aid) {
    const k = normaliseraAid(aid);
    return k ? (_PER_PREFIX.get(k.slice(0, 2)) || null) : null;
}

/** Sektorns namn — huvudområdet, eller "Okänt huvudområde". */
function sektorsnamn(aid) {
    const h = huvudomrade(aid);
    return h ? h.namn : OKANT_HUVUDOMRADE;
}

/** De fyra första siffrorna, eller null. */
function mellanniva(aid) {
    const k = normaliseraAid(aid);
    return k ? k.slice(0, 4) : null;
}

/** "AID 2070xx", eller null. */
function mellannivaEtikett(aid) {
    const m = mellanniva(aid);
    return m ? `AID ${m}xx` : null;
}

/** Etiketten ur SKR:s lista: { kod, namn, ansvarskoder }, eller null. */
function etikett(aid) {
    const k = normaliseraAid(aid);
    return k ? (_etiketter().get(k) || null) : null;
}

/** Restkod ("annan"/"annat"): de tre sista siffrorna är 090. */
function arRestkod(aid) {
    const k = normaliseraAid(aid);
    return !!k && k.endsWith('090');
}

/** Etikett under huvudområdet Ledningsarbete (10xxxx). */
function arLedningsetikett(aid) {
    const k = normaliseraAid(aid);
    return !!k && k.startsWith('10');
}

/** Sorterar sektorsnamn i prefixordning; okänt huvudområde sist. */
function jamforSektor(a, b) {
    const i = n => _ORDNING.get(n) ?? HUVUDOMRADEN.length;
    return i(a) - i(b);
}

/** Version, källa och antal etiketter i den inbyggda etikettlistan. */
function etikettlistaInfo() {
    const l = aidEtikettlista();
    return { version: l.version, kalla: l.kalla, antal: l.etiketter.length };
}

    return { normaliseraAid, aidAvYrke, aidAvRad, namnrader, sifferprefixAvYrke, huvudomrade, sektorsnamn, mellannivaEtikett, etikett, arRestkod, arLedningsetikett, jamforSektor, etikettlistaInfo };
})();
const aidAvYrke = __mirrorAid.aidAvYrke;
const aidAvRad = __mirrorAid.aidAvRad;
const namnrader = __mirrorAid.namnrader;
const sifferprefixAvYrke = __mirrorAid.sifferprefixAvYrke;
const _aidSektorsnamn = __mirrorAid.sektorsnamn;
const _aidJamforSektor = __mirrorAid.jamforSektor;
const _aidEtikettlistaInfo = __mirrorAid.etikettlistaInfo;

// ---- speglar src/lib/undertryckning.js ----
const __mirrorUndertryckning = (() => {
// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
/**
 * Öppen lönekartläggning — kompletterande undertryckning och sammanslagning (ADR-83, ADR-87,
 * `docs/utveckling/k-troskeln.md` avsnitt 2).
 *
 * Tre allmänna regler för delar av en total, där totalen skrivs ut och delarna har ett medelvärde var:
 *  - `kompletterandeUndertryckning`: vilka visade delar vars medelvärden också ska undertryckas, så att totalen minus
 *    de visade delarna aldrig ger medelvärdet för färre än k personer. Används av tabellerna per BAS-intervall.
 *  - `sammanslagning`: vilka delar som ska räknas samman till en, så att varje del har 0 eller minst k personer av
 *    varje kön. Används där delarnas medelvärden inte står var för sig men går att räkna fram ur ett ekvationssystem
 *    (uppdelningen av löneskillnaden och huvudområdenas andel av den): när varje del har 0 eller minst k av varje kön
 *    är allt som går att räkna fram ett medel för minst k personer av ett kön, eller en vägd summa av sådana.
 *  - `kompletterandeUndertryckningPerNyckel`: samma regel som den första mellan två tabeller, där totalerna står i den
 *    ena och delarna, med samma nyckel, i den andra (JPA-protokollets blad 2 och 3, ADR-91).
 *
 * Funktionerna vet inte vad delarna är (BAS-intervall, AID-etiketter, huvudområden, åldersgrupper). Antal och andelar
 * berörs inte (ADR-70).
 *
 * Webbläsarbygget får en AUTO-GENERERAD spegel i src/app/09-lib-speglar.js.
 */

/**
 * Kompletterande undertryckning (ADR-83): vilka visade delar vars medelvärden också ska undertryckas, så att en total
 * minus de visade delarna aldrig ger medelvärdet för färre än k personer.
 *
 * Delarna är en uppdelning av totalen; `dold` är en del som redan utelämnas eller undertrycks. Omfattar de dolda
 * tillsammans 0 eller minst k personer ändras ingenting. Annars väljs den minsta visade delen (färst personer, vid lika
 * antal först efter namn och sedan ordningen i listan), och så vidare tills de dolda tillsammans når k. Räcker inte
 * alla delar väljs alla, och bara totalen har ett medelvärde. Delar utan personer (n ≤ 0) väljs aldrig.
 *
 * Antal och andelar berörs inte (ADR-70), och medianer och percentiler inte heller (de går inte att dela upp).
 * @param {Array<{n:number, dold?:boolean, namn?:string}>} delar
 * @param {number} k
 * @returns {number[]} index i `delar` för de visade delar som ska undertryckas, i den ordning de valdes
 */
function kompletterandeUndertryckning(delar, k) {
    let dolda = 0;
    for (const d of delar) if (d.dold) dolda += d.n;
    if (dolda <= 0 || dolda >= k) return [];
    const kandidater = delar.map((d, i) => ({ n: d.n, namn: String(d.namn ?? ''), i }))
        .filter(d => !delar[d.i].dold && d.n > 0)
        .sort((a, b) => a.n - b.n || a.namn.localeCompare(b.namn, 'sv') || a.i - b.i);
    const ut = [];
    for (const d of kandidater) {
        if (dolda >= k) break;
        ut.push(d.i);
        dolda += d.n;
    }
    return ut;
}

/**
 * Sammanslagning (ADR-87): vilka delar som räknas samman till en, så att varje del, också den sammanslagna, har 0 eller
 * minst k kvinnor och 0 eller minst k män.
 *
 * En del där ett kön har 1 till k − 1 personer slås samman. Har de sammanslagna tillsammans 1 till k − 1 kvinnor
 * läggs den visade del till som har färst kvinnor (men minst en), och så vidare, med samma val som
 * `kompletterandeUndertryckning`; sedan samma sak för männen. En visad del har 0 eller minst k av varje kön, så att
 * lägga till den för det ena könet förstör aldrig det andra. Räcker inte alla delar slås alla samman, och de har då
 * tillsammans helhetens antal. Har helheten 0 eller minst k av varje kön, som den har där funktionen används, får den
 * sammanslagna delen alltid det, och den består då av minst två delar.
 * @param {Array<{nKv:number, nMa:number, namn?:string}>} delar
 * @param {number} k
 * @returns {number[]} index i `delar` för de delar som slås samman, stigande; tomt eller minst två
 */
function sammanslagning(delar, k) {
    const liten = n => n > 0 && n < k;
    const samman = delar.map(d => liten(d.nKv) || liten(d.nMa));
    for (;;) {
        let nya = 0;
        for (const kon of ['nKv', 'nMa']) {
            const val = kompletterandeUndertryckning(delar.map((d, i) => ({ namn: d.namn, n: d[kon], dold: samman[i] })), k);
            for (const i of val) samman[i] = true;
            nya += val.length;
        }
        if (!nya) break;
    }
    return samman.flatMap((s, i) => (s ? [i] : []));
}

/**
 * Kompletterande undertryckning mellan två tabeller (ADR-91): totaler per nyckel (till exempel BAS-intervall) i den ena
 * och delar med samma nyckel i den andra, med antal och medelvärde per kön i båda. Delarna behöver inte täcka totalen:
 * resten är totalens personer av ett kön som ingen del med synliga medelvärden har. För varje nyckel och kön får resten
 * inte vara 1 till k − 1 personer, eftersom totalen minus de visade delarna då ger restens medelvärde. Annars
 * undertrycks medelvärdena för den minsta visade delen, och så vidare (`kompletterandeUndertryckning`). En undertryckt
 * del förlorar båda könens medelvärden, eftersom en tabell som har det ena könets medelvärde och skillnaden ger det
 * andra; den räknas därför till resten för båda könen, och reglerna prövas om tills inget ändras. Totalerna berörs
 * inte: de betyder det de betydde.
 *
 * Antal och andelar berörs inte (ADR-70), och medianer och percentiler inte heller.
 * @param {Array<{nyckel:string, nKv:number, nMa:number}>} totaler  totalerna vars medelvärden står
 * @param {Array<{nyckel:string, nKv:number, nMa:number, namn?:string, dold?:boolean}>} delar  `dold`: delens
 *   medelvärden står redan inte
 * @param {number} k
 * @returns {number[]} index i `delar` för de delar vars medelvärden också ska undertryckas, stigande
 */
function kompletterandeUndertryckningPerNyckel(totaler, delar, k) {
    const dold = delar.map(d => !!d.dold), ut = new Set();
    for (let andrad = true; andrad;) {
        andrad = false;
        for (const t of totaler) {
            for (const kon of /** @type {const} */ (['nKv', 'nMa'])) {
                const visade = delar.flatMap((d, i) => (d.nyckel === t.nyckel && !dold[i] ? [i] : []));
                if (!visade.length) continue;
                const rest = t[kon] - visade.reduce((s, i) => s + delar[i][kon], 0);
                if (rest <= 0 || rest >= k) continue;
                const val = kompletterandeUndertryckning([...visade.map(i => ({ n: delar[i][kon], namn: delar[i].namn })), { n: rest, dold: true }], k);
                for (const j of val) { dold[visade[j]] = true; ut.add(visade[j]); andrad = true; }
            }
        }
    }
    return [...ut].sort((a, b) => a - b);
}

    return { kompletterandeUndertryckning, sammanslagning, kompletterandeUndertryckningPerNyckel };
})();
const _kompletterandeUndertryckningPerNyckel = __mirrorUndertryckning.kompletterandeUndertryckningPerNyckel;

// ---- speglar src/lib/stat.js ----
const __mirrorStat = (() => {
// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
/**
 * Öppen lönekartläggning — Pure statistical kernel
 *
 * Denna modul är ENDA KÄLLAN (single source of truth) för den matematiska
 * kärnan och kan testas via Vitest utan att ladda DOM/CSP. Webbläsarbygget
 * (app.js) får en AUTO-GENERERAD spegel av modulen i src/app/09-lib-speglar.js
 * (tools/gen-mirrors.mjs inlinar verbatim). Ändra därför ALDRIG spegeln — ändra
 * här och kör `npm run build:app`. tests/stat.test.js verifierar de numeriska
 * resultaten; artefaktgrinden vaktar att spegeln är i synk med src/lib/.
 *
 * Funktioner exporterade:
 *   - median, quantile, linearRegression  (Stat-objektet i appen pekar hit)
 *   - matMul, transpose, invert            (matrisalgebra)
 *   - fitOLS                                (OLS + HC3-robusta SE)
 *   - normalCdf                             (Φ för p-värden)
 *   - bhJustera                             (Benjamini–Hochberg-korrigering för många tester)
 *   - percentilintervall                    (95 %-percentilintervallet ur sorterade dragningar)
 *   - avrundaSymmetriskt                    (avrundningen i talformaten: halvorna bort från noll)
 */

/**
 * Avrundar ett tal för visning till `dec` decimaler med halvorna bort från noll, så att ett tal och dess motsatta
 * tal alltid visas med samma siffror (Math.round avrundar halvorna uppåt: −1 600,5 blev −1 600 men 1 600,5 blev
 * 1 601). Noll blir 0, aldrig −0. Talformaten i appen och i lib använder den; beräkningar avrundar på sitt eget sätt.
 * @param {number} x
 * @param {number} [dec]
 * @returns {number}
 */
function avrundaSymmetriskt(x, dec = 0) {
    const f = 10 ** dec, r = Math.sign(x) * Math.round(Math.abs(x) * f) / f;
    return r === 0 ? 0 : r;
}

/**
 * Beräknar median (P50) av en talsekvens.
 * @param {number[]} arr
 * @returns {number} 0 om tom, annars mittenelementet i sorterad lista.
 */
function median(arr) {
    if (!arr.length) return 0;
    const s = [...arr].sort((a, b) => a - b);
    const m = Math.floor(s.length / 2);
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/**
 * Kvantil via linjär interpolation (typ 7, samma som R's default).
 * @param {number[]} arr
 * @param {number} q ∈ [0,1]
 * @returns {number}
 */
function quantile(arr, q) {
    if (!arr.length) return 0;
    const s = [...arr].sort((a, b) => a - b);
    const pos = (s.length - 1) * q;
    const lo = Math.floor(pos);
    const hi = Math.ceil(pos);
    return lo === hi ? s[lo] : s[lo] + (s[hi] - s[lo]) * (pos - lo);
}

/**
 * Enkel linjär regression y = m·x + b via OLS minsta kvadrat.
 * @param {Array<[number, number]>} data
 * @returns {{m:number, b:number, r2:number} | null} null med färre än två punkter eller utan spridning i x
 *   (alla x lika): då finns ingen lutning att räkna
 */
function linearRegression(data) {
    const n = data.length;
    if (n < 2) return null;
    let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
    for (let i = 0; i < n; i++) {
        sumX += data[i][0]; sumY += data[i][1];
        sumXY += data[i][0] * data[i][1]; sumXX += data[i][0] * data[i][0];
    }
    const namnare = n * sumXX - sumX * sumX;
    if (!(namnare > 1e-12 * n * sumXX)) return null;   // avrundningsfel: lika x med decimaler ger inte exakt 0
    const m = (n * sumXY - sumX * sumY) / namnare;
    const b = (sumY - m * sumX) / n;
    const meanY = sumY / n;
    let ssTot = 0, ssRes = 0;
    for (let i = 0; i < n; i++) {
        ssTot += (data[i][1] - meanY) ** 2;
        ssRes += (data[i][1] - (m * data[i][0] + b)) ** 2;
    }
    return { m, b, r2: ssTot > 0 ? 1 - ssRes / ssTot : 0 };
}

/**
 * Standardnormal CDF Φ(x) — Abramowitz & Stegun 26.2.17 (abs.fel < 7.5e-8).
 * @param {number} x
 * @returns {number}
 */
function normalCdf(x) {
    const t = 1 / (1 + 0.2316419 * Math.abs(x));
    const d = 0.3989423 * Math.exp((-x * x) / 2);
    const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
    return x > 0 ? 1 - p : p;
}

/** ln Γ(x) (Lanczos, g = 7, 9 koefficienter; relativt fel < 1e-13 för x > 0). */
function _lnGamma(x) {
    const c = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313,
        -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
    if (x < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * x)) - _lnGamma(1 - x);
    x -= 1;
    let a = c[0];
    const t = x + 7.5;
    for (let i = 1; i < 9; i++) a += c[i] / (x + i);
    return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a);
}

/**
 * Regulariserad ofullständig betafunktion I_x(a, b) via Lentz kedjebråk
 * (Numerical Recipes, betacf). Konvergerar snabbt för x < (a+1)/(a+b+2);
 * annars används symmetrin I_x(a,b) = 1 − I_{1−x}(b,a).
 */
function _regIncBeta(x, a, b) {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    if (x > (a + 1) / (a + b + 2)) return 1 - _regIncBeta(1 - x, b, a);
    const lnFront = _lnGamma(a + b) - _lnGamma(a) - _lnGamma(b) + a * Math.log(x) + b * Math.log(1 - x);
    const tiny = 1e-300;
    let c = 1, d = 1 - (a + b) * x / (a + 1);
    if (Math.abs(d) < tiny) d = tiny;
    d = 1 / d;
    let h = d;
    for (let m = 1; m <= 300; m++) {
        const m2 = 2 * m;
        let aa = m * (b - m) * x / ((a + m2 - 1) * (a + m2));
        d = 1 + aa * d; if (Math.abs(d) < tiny) d = tiny;
        c = 1 + aa / c; if (Math.abs(c) < tiny) c = tiny;
        d = 1 / d; h *= d * c;
        aa = -(a + m) * (a + b + m) * x / ((a + m2) * (a + m2 + 1));
        d = 1 + aa * d; if (Math.abs(d) < tiny) d = tiny;
        c = 1 + aa / c; if (Math.abs(c) < tiny) c = tiny;
        d = 1 / d;
        const del = d * c;
        h *= del;
        if (Math.abs(del - 1) < 3e-14) break;
    }
    return Math.exp(lnFront) * h / a;
}

/**
 * t-fördelningens CDF P(T ≤ t | df), exakt via den regulariserade ofullständiga
 * betafunktionen: P(|T| > t) = I_x(df/2, 1/2) med x = df / (df + t²).
 * Konvergerar mot normalfördelningen när df → ∞. (Tidigare Hills approximation,
 * som vid df = 5 gav kvantilen 2,62 i stället för 2,57; ADR-45.)
 * @param {number} t  - teststatistika
 * @param {number} df - frihetsgrader (n − k)
 * @returns {number} P(T ≤ t)
 */
function tDistCdf(t, df) {
    if (!isFinite(t) || !(df > 0)) return NaN;
    if (df > 1e6) return normalCdf(t);
    const x = df / (df + t * t);
    const twoSided = _regIncBeta(x, df / 2, 0.5);   // P(|T| > |t|)
    return t >= 0 ? 1 - twoSided / 2 : twoSided / 2;
}

/**
 * t-fördelningens kvantil: det t för vilket P(T ≤ t | df) = p. Används för
 * konfidensintervall (p = 0,975 ger halvbredden för 95 %). Inverterar tDistCdf
 * med bisektion; vid df ≥ 100 används normalfördelningen (1,96 för 95 %), samma
 * gräns som pValue2Sided.
 * @param {number} p  - sannolikhet i (0, 1)
 * @param {number} df - frihetsgrader (n − k)
 * @returns {number} kvantilen, NaN vid ogiltiga argument
 */
function tQuantile(p, df) {
    if (!(p > 0 && p < 1) || !(df > 0)) return NaN;
    const cdf = df >= 100 ? normalCdf : t => tDistCdf(t, df);
    let lo = -1, hi = 1;
    while (cdf(lo) > p) lo *= 2;
    while (cdf(hi) < p) hi *= 2;
    for (let i = 0; i < 100 && hi - lo > 1e-9; i++) {
        const mid = (lo + hi) / 2;
        if (cdf(mid) < p) lo = mid; else hi = mid;
    }
    return (lo + hi) / 2;
}

/**
 * Tvåsidigt p-värde för en regressionskoefficient. Använder t-fördelning
 * vid små df (< 100), annars normalfördelning.
 * @param {number} stat - β / SE
 * @param {number} n    - antal observationer
 * @param {number} k    - antal regressorer
 * @returns {number} 2-sidigt p-värde
 */
function pValue2Sided(stat, n, k) {
    const df = n - k;
    if (!isFinite(stat) || !(df > 0)) return NaN;
    const absT = Math.abs(stat);
    if (df >= 100) return 2 * (1 - normalCdf(absT));
    return 2 * (1 - tDistCdf(absT, df));
}

/** Matrisprodukt C = A·B. */
function matMul(A, B) {
    const m = A.length, n = B[0].length, p = B.length;
    const C = Array.from({ length: m }, () => new Array(n).fill(0));
    for (let i = 0; i < m; i++) {
        for (let k = 0; k < p; k++) {
            const a = A[i][k];
            if (a === 0) continue;
            for (let j = 0; j < n; j++) C[i][j] += a * B[k][j];
        }
    }
    return C;
}

/** Transpose Aᵀ. */
function transpose(A) {
    return A[0].map((_, i) => A.map(r => r[i]));
}

/**
 * Matrisinvers via Gauss-Jordan med partial pivoting.
 * @param {number[][]} A
 * @returns {number[][]|null} null om singulär (pivotelement < 1e-10).
 */
function invert(A) {
    const n = A.length;
    const M = A.map((r, i) => [...r, ...Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))]);
    for (let i = 0; i < n; i++) {
        let max = Math.abs(M[i][i]), mr = i;
        for (let k = i + 1; k < n; k++) if (Math.abs(M[k][i]) > max) { max = Math.abs(M[k][i]); mr = k; }
        if (max < 1e-10) return null;
        if (mr !== i) [M[i], M[mr]] = [M[mr], M[i]];
        const piv = M[i][i];
        for (let j = 0; j < 2 * n; j++) M[i][j] /= piv;
        for (let k = 0; k < n; k++) {
            if (k === i) continue;
            const f = M[k][i];
            if (f === 0) continue;
            for (let j = 0; j < 2 * n; j++) M[k][j] -= f * M[i][j];
        }
    }
    return M.map(r => r.slice(n));
}

/**
 * OLS-estimat med klassisk + HC3-robusta vcov (Long & Ervin 2000).
 *
 * Returnerar identiskt fältnamn-gränssnitt som app.js _fitOLS:
 *   { beta, R2, n, k, vcovHC3, vcovClassic, rss, adjR2, sigma2, XtXinv, hHoga }
 * hHoga = antalet observationer med hävstång h_i > 0,99 (B4). De har (nästan) noll residual och bidrar inte till
 * HC3-köttet; antalet visas i regressionskortets tekniska specifikation (en ensam person i en indikator ger h = 1).
 * hTillagg (valfri) läggs till hävstången per rad innan HC3 och hHoga räknas: när X är inomtransformerad ger
 * 1/n_g per rad den fulla designens hävstång (ADR-77, inomYrkesgrupp i regression.js).
 * Detta är "single source of truth" — app.js mirrar denna implementation.
 *
 * @param {number[][]} X - n×k designmatris.
 * @param {number[]} y    - n-vektor.
 * @param {number[]|null} [hTillagg] - n-vektor som läggs till hävstången h_i (gruppdelen vid inomtransformation).
 * @returns {null | {beta:number[], R2:number, n:number, k:number, vcovHC3:number[][], vcovClassic:number[][], rss:number, adjR2:number, sigma2:number, XtXinv:number[][], hHoga:number}}
 */
function fitOLS(X, y, hTillagg = null) {
    const n = X.length, k = X[0].length;
    if (n < k + 2) return null;
    // Indikatorerna gör X glest: varje rad har få nollskilda kolumner. Summorna räknas bara över dem, i samma ordning
    // över raderna som en full matrisprodukt, så att resultatet är detsamma (en term som är 0 ändrar inte summan).
    const nz = X.map(row => { const ix = []; for (let a = 0; a < k; a++) if (row[a] !== 0) ix.push(a); return ix; });
    const XtX = Array.from({ length: k }, () => new Array(k).fill(0));
    const Xty = new Array(k).fill(0);
    for (let i = 0; i < n; i++) {
        const xi = X[i], ix = nz[i], yi = y[i];
        for (let p = 0; p < ix.length; p++) {
            const a = ix[p], va = xi[a], rad = XtX[a];
            for (let q = 0; q < ix.length; q++) { const b = ix[q]; rad[b] += va * xi[b]; }
            Xty[a] += va * yi;
        }
    }
    const XtXinv = invert(XtX);
    if (!XtXinv) return null;
    const beta = matMul(XtXinv, Xty.map(v => [v])).map(r => r[0]);

    const yhat = X.map((row, i) => { let s = 0; for (const a of nz[i]) s += row[a] * beta[a]; return s; });
    const resid = y.map((yi, i) => yi - yhat[i]);
    const ymean = y.reduce((s, v) => s + v, 0) / n;
    let rss = 0, tss = 0;
    for (let i = 0; i < n; i++) {
        rss += resid[i] * resid[i];
        tss += (y[i] - ymean) ** 2;
    }
    const R2 = tss > 0 ? 1 - rss / tss : 0;
    const sigma2 = n - k > 0 ? rss / (n - k) : 0;

    const vcovClassic = XtXinv.map(row => row.map(v => v * sigma2));

    // HC3: leverages h_i = x_i' (X'X)^-1 x_i (+ hTillagg_i)
    const h = X.map((xi, i) => {
        let s = hTillagg ? hTillagg[i] : 0;
        const ix = nz[i];
        for (let p = 0; p < ix.length; p++) {
            const a = ix[p], inv = XtXinv[a];
            let sa = 0;
            for (let q = 0; q < ix.length; q++) { const b = ix[q]; sa += inv[b] * xi[b]; }
            s += xi[a] * sa;
        }
        return s;
    });
    const hHoga = h.filter(hi => hi > 0.99).length;
    const meat = Array.from({ length: k }, () => new Array(k).fill(0));
    for (let i = 0; i < n; i++) {
        const denom = (1 - h[i]) ** 2;
        const w = denom > 1e-12 ? (resid[i] * resid[i]) / denom : 0;
        const xi = X[i], ix = nz[i];
        for (let p = 0; p < ix.length; p++) {
            const a = ix[p], wa = w * xi[a], rad = meat[a];
            for (let q = 0; q < ix.length; q++) { const b = ix[q]; rad[b] += wa * xi[b]; }
        }
    }
    const breadMeat = matMul(XtXinv, meat);
    const vcovHC3 = matMul(breadMeat, XtXinv);
    const adjR2 = (n - k) > 0 ? 1 - (1 - R2) * (n - 1) / (n - k) : 0;

    return { beta, R2, n, k, vcovHC3, vcovClassic, rss, adjR2, sigma2, XtXinv, hHoga };
}

/** Percentilintervallets svans: andelen av de sorterade dragningarna som ligger under den nedre gränsen, och lika
 * många över den övre. */
const KI_NEDRE = 0.025;

/**
 * Det 95-procentiga percentilintervallet ur en STIGANDE sorterad lista med dragningar (bootstrap, omkastning). Indexen
 * är symmetriska (ADR-86): den nedre gränsen är värdet med index golvet av n · 0,025 (räknat från 0), den övre värdet
 * med index n − 1 − golvet av n · 0,025, så att lika många dragningar ligger under den nedre som över den övre (med
 * B = 1000: 25 på var sida). Indexräkningen finns bara här, så att alla intervall i verktyget tas på samma sätt.
 * @param {ArrayLike<number>} sorterad
 * @returns {{lag:number, hog:number}}
 */
function percentilintervall(sorterad) {
    const n = sorterad.length, svans = Math.floor(n * KI_NEDRE);
    return { lag: sorterad[svans], hog: sorterad[n - 1 - svans] };
}

/**
 * Benjamini–Hochbergs korrigering för många samtidiga tester (FDR). Ger q-värdena i samma ordning som indata:
 * q = min(1, p·m/rang) med p-värdena sorterade stigande, gjorda monotona bakifrån så att q inte minskar med
 * stigande rang. Lika p-värden får lika q. Ett enda test ger p oförändrat; en tom lista ger en tom lista.
 * Indata ska vara ändliga p-värden; anroparen väljer vilka tester som ingår (ett per BAS-intervall med
 * status ok i regressionen per BAS-intervall, så att kortet, Att göra och protokollet räknar på samma m).
 * Samma tal som statsmodels multipletests(method='fdr_bh').
 * @param {number[]} pVarden
 * @returns {number[]}
 */
function bhJustera(pVarden) {
    const m = pVarden.length;
    const ordning = pVarden.map((_, i) => i).sort((a, b) => pVarden[a] - pVarden[b]);
    const q = new Array(m);
    let lagst = 1;
    for (let r = m; r >= 1; r--) {
        const i = ordning[r - 1];
        lagst = Math.min(lagst, pVarden[i] * m / r);
        q[i] = lagst;
    }
    return q;
}

    return { tQuantile, pValue2Sided, fitOLS, quantile, bhJustera, avrundaSymmetriskt, matMul, invert, median, linearRegression, percentilintervall };
})();
const _tQuantile = __mirrorStat.tQuantile;
const _pValue2Sided = __mirrorStat.pValue2Sided;
const _fitOLS = __mirrorStat.fitOLS;
const _libQuantile = __mirrorStat.quantile;
const _bhJustera = __mirrorStat.bhJustera;
const _avrundaSymmetriskt = __mirrorStat.avrundaSymmetriskt;

// ---- speglar src/lib/kostnad.js ----
const __mirrorKostnad = (() => {
// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
/**
 * Öppen lönekartläggning — Kostnad per år (ren modell)
 *
 * Kostnadsformeln på ett ställe: ett månadsbelopp × beräkningsperiodens månader × (1 + PO-påslaget). Prioriteringen,
 * löneöversynen, handlingsplanen och beräkningsbeviset räknar med den.
 *
 * Kostnadsinställningarna tolkas likadant överallt: månader som saknas eller är 0 blir 12, PO som saknas blir 0 %.
 * Fältet i Inställningar tillåter 1–60 månader, så 0 nås inte därifrån.
 *
 * Multiplikationen görs i samma ordning som innan formeln samlades här (belopp × månader × PO-faktor), så att inget
 * tal ändras i sista decimalen. Därför ges PO-faktorn och månaderna var för sig och inte som en färdig produkt.
 *
 * Bygger på: verktygets egen modell; PO-påslagets standardvärde i ADR-84. Beräkningarna står i docs/utveckling/berakningsregister.md.
 */

/**
 * Kostnadsinställningarna med standardvärdena ifyllda.
 * @param {{months?: number, poPct?: number}|null|undefined} costSettings
 * @returns {{months: number, poPct: number, poFaktor: number}}  poFaktor = 1 + poPct / 100
 */
function kostnadsfaktor(costSettings) {
    const months = (costSettings && costSettings.months) || 12;
    const poPct = (costSettings && costSettings.poPct) || 0;
    return { months, poPct, poFaktor: 1 + poPct / 100 };
}

/**
 * En redan summerad månadskostnad för hela perioden med PO-påslag: belopp × månader × (1 + PO). Beloppet behåller
 * sitt tecken.
 * @param {number} kronorPerManad
 * @param {{months?: number, poPct?: number}|null|undefined} costSettings
 */
function periodkostnad(kronorPerManad, costSettings) {
    const { months, poFaktor } = kostnadsfaktor(costSettings);
    return kronorPerManad * months * poFaktor;
}

/**
 * Ett månadsbelopp per person som belopp per år för `antal` personer, med beräkningsperiod och PO-påslag ur
 * kostnadsinställningarna: |belopp| × månader × (1 + PO) × antal. Prioriteringens åtgärdskostnad och
 * gruppdossierns räkneexempel räknar med samma formel.
 * @param {number} kronorPerManad
 * @param {number} antal
 * @param {{months?: number, poPct?: number}|null|undefined} costSettings
 */
function kostnadPerAr(kronorPerManad, antal, costSettings) {
    return periodkostnad(Math.abs(kronorPerManad), costSettings) * antal;
}

    return { kostnadsfaktor, periodkostnad, kostnadPerAr };
})();
const _kostFaktor = __mirrorKostnad.kostnadsfaktor;
const _kostPeriod = __mirrorKostnad.periodkostnad;

// ---- speglar src/lib/struktur.js ----
const __mirrorStructure = (() => {
    // importer ur tidigare speglade lib-moduler
    const _median = __mirrorStat.median;
    const _quantile = __mirrorStat.quantile;
    const arKvinna = __mirrorKon.arKvinna;
    const arMan = __mirrorKon.arMan;

// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
/**
 * Öppen lönekartläggning — Strukturanalys & EU-rapportmått
 *
 * Rena funktioner för representation/segregation, kvartilfördelning (EU
 * 2023/970 Art. 9), distributionellt gap (sticky floor vs glass ceiling),
 * mediangap och direktivets tecken på gapet (tillDirektivtecken). Separat från app.js för Vitest; app.js får en AUTO-GENERERAD
 * spegel (`_st*` i src/app/09-lib-speglar.js via tools/gen-mirrors.mjs) — ändra
 * här och kör `npm run build:app`, rör ej spegeln. Inga DOM-/state-beroenden.
 *
 * Bygger på: verktygets egen modell; tecknet i docs/utveckling/regressionsmodellen.md avsnitt 1. Beräkningarna står i docs/utveckling/berakningsregister.md.
 */



/**
 * Mediangapet kvinnor vs män (%), null om något kön saknas — eller har färre än `k` personer
 * (k-anonymitet: gapet pekar annars ut de få i det mindre könet). Anroparen i appen skickar
 * alltid gällande tröskel; standardvärdet 1 finns för enhetstesterna.
 */
function medianGapPct(rows, { k = 1 } = {}) {
    const kv = [], ma = [];
    (rows || []).forEach(r => { if (!(r.lon > 0)) return; if (arKvinna(r)) kv.push(r.lon); else if (arMan(r)) ma.push(r.lon); });
    if (kv.length < Math.max(1, k) || ma.length < Math.max(1, k)) return null;
    return (_median(kv) / _median(ma) - 1) * 100;
}

/**
 * Representation/segregation per BAS-nivå. Sorteras BAS A–Ö (lägst värderad nivå
 * först) — om andelen kvinnor sjunker mot högre BAS finns vertikal segregering.
 *
 * `k` är minsta antal per kön för att könsuppdelade mått ska lämnas ut (k-anonymitet): har
 * ett kön färre, blir medianKv, medianMa och gapPct null och `konLitet` sant. BAS:ets samlade
 * median och antalen står kvar — om BAS:et som helhet får redovisas avgör anroparen på `n`.
 * @returns {Array<{bas,n,nKv,nMa,andelKv,median,medianKv,medianMa,gapPct,konLitet}>}
 */
function representationByBas(rows, { k = 1 } = {}) {
    const minst = Math.max(1, k);
    const m = new Map();
    (rows || []).forEach(r => {
        if (!(r.lon > 0)) return;
        let g = m.get(r.bas);
        if (!g) { g = { bas: r.bas, lons: [], kvLons: [], maLons: [], nKv: 0, nMa: 0, n: 0 }; m.set(r.bas, g); }
        g.lons.push(r.lon); g.n++;
        if (arKvinna(r)) { g.kvLons.push(r.lon); g.nKv++; }
        else if (arMan(r)) { g.maLons.push(r.lon); g.nMa++; }
    });
    return [...m.values()].map(g => {
        // Båda könen finns, men minst ett är för litet för en könsjämförelse.
        const konLitet = g.kvLons.length > 0 && g.maLons.length > 0 && (g.kvLons.length < minst || g.maLons.length < minst);
        const visaKv = g.kvLons.length >= minst && !konLitet, visaMa = g.maLons.length >= minst && !konLitet;
        return {
            bas: g.bas, n: g.n, nKv: g.nKv, nMa: g.nMa,
            andelKv: g.n ? 100 * g.nKv / g.n : 0,
            median: _median(g.lons),
            medianKv: visaKv ? _median(g.kvLons) : null,
            medianMa: visaMa ? _median(g.maLons) : null,
            gapPct: (visaKv && visaMa) ? (_median(g.kvLons) / _median(g.maLons) - 1) * 100 : null,
            konLitet
        };
    }).sort((a, b) => String(a.bas).localeCompare(String(b.bas), 'sv'));   // BAS A–Ö, som i övriga verktyget
}

/**
 * Kvartilfördelning (EU 2023/970 Art. 9f): dela arbetsstyrkan i fyra lika stora
 * lönekvartiler (Q1 = lägst) och redovisa andel kvinnor/män i varje.
 *
 * Gränserna mellan kvartilerna är mittpunkten mellan högsta lönen i den lägre och
 * lägsta i den högre kvartilen. Kvartilernas yttre löner redovisas inte: Q1:s lägsta
 * och Q4:s högsta är organisationens lägsta och högsta enskilda lön. Q1 har ingen undre gräns, Q4 ingen övre.
 *
 * `k`: har ett kön färre än k personer i hela urvalet lämnas könsfördelningen per kvartil
 * inte ut (nKv, nMa och andelKv blir null, `konDolt` sant) — tre män i Q4 säger var just de
 * tjänar. Antal per kvartil och gränserna står kvar.
 * @returns {Array<{q:number, n:number, nKv:number|null, nMa:number|null, andelKv:number|null, undre:number|null, ovre:number|null, konDolt:boolean}>}
 */
function quartileDistribution(rows, { k = 1 } = {}) {
    const all = (rows || []).filter(r => r.lon > 0).slice().sort((a, b) => a.lon - b.lon);
    const n = all.length;
    if (n < 4) return [];
    /** @type {Array<{q:number, n:number, nKv:number, nMa:number, undre:number|null, ovre:number|null}>} */
    const out = [1, 2, 3, 4].map(q => ({ q, n: 0, nKv: 0, nMa: 0, undre: null, ovre: null }));
    /** @type {Array<number|null>} */ const lo = [null, null, null, null];
    /** @type {Array<number|null>} */ const hi = [null, null, null, null];
    all.forEach((r, i) => {
        const q = Math.min(3, Math.floor(i * 4 / n));
        const o = out[q];
        o.n++; if (arKvinna(r)) o.nKv++; else if (arMan(r)) o.nMa++;
        if (lo[q] == null) lo[q] = r.lon;
        hi[q] = r.lon;
    });
    for (let q = 0; q < 3; q++) {
        const grans = ((hi[q] ?? 0) + (lo[q + 1] ?? 0)) / 2;   // n ≥ 4: varje kvartil har minst en person
        out[q].ovre = grans; out[q + 1].undre = grans;
    }
    const totKv = out.reduce((s, o) => s + o.nKv, 0), totMa = out.reduce((s, o) => s + o.nMa, 0);
    const konDolt = k > 1 && (totKv < k || totMa < k);
    return out.map(o => ({
        q: o.q, n: o.n,
        nKv: konDolt ? null : o.nKv, nMa: konDolt ? null : o.nMa,
        andelKv: konDolt ? null : (o.n ? 100 * o.nKv / o.n : 0),
        undre: o.undre, ovre: o.ovre, konDolt
    }));
}

/**
 * Distributionellt gap: lönegapet vid olika percentiler. Större gap i toppen =
 * glastak; större i botten = sticky floor.
 *
 * `k` är minsta antal per kön (k-anonymitet); under det returneras en tom lista. Golvet är
 * aldrig lägre än 2, eftersom en percentil av en enda lön inte är ett mått.
 * @returns {Array<{p,kv,ma,gapPct}>}
 */
function distributionalGap(rows, percentiles, { k = 2 } = {}) {
    const ps = percentiles || [10, 25, 50, 75, 90];
    const kv = [], ma = [];
    (rows || []).forEach(r => { if (!(r.lon > 0)) return; if (arKvinna(r)) kv.push(r.lon); else if (arMan(r)) ma.push(r.lon); });
    const minst = Math.max(2, k);
    if (kv.length < minst || ma.length < minst) return [];
    return ps.map(p => {
        const kvP = _quantile(kv, p / 100), maP = _quantile(ma, p / 100);
        return { p, kv: kvP, ma: maP, gapPct: maP > 0 ? (kvP / maP - 1) * 100 : null };
    });
}

/**
 * Lönegapet med direktivets tecken (EU 2023/970 art. 9). Verktyget räknar skillnaden som (kvinnor − män) / män,
 * negativ när kvinnor ligger lägre; direktivet uttrycker gapet som skillnaden i procent av mäns lön,
 * (män − kvinnor) / män, positiv när kvinnor ligger lägre. Beloppet är detsamma — bara tecknet vänds. Används
 * enbart av EU-lönerapporten och rapportens avsnitt om lönetransparens; övriga flikar och blad behåller verktygets
 * konvention (kvinnors lön i procent av mäns). null och icke-tal lämnas som null; −0 blir 0.
 * @param {number|null|undefined} gapPct (kvinnor − män) / män i procent
 * @returns {number|null}
 */
function tillDirektivtecken(gapPct) {
    if (typeof gapPct !== 'number' || !isFinite(gapPct)) return null;
    return gapPct === 0 ? 0 : -gapPct;
}

/**
 * Reservationen om lönebegreppet vid EU-rapportmåtten (beslut 7a): verktyget räknar på fast heltidsmånadslön, direktivets
 * lönebegrepp omfattar mer. Står vid måtten i fliken Lönestruktur, i EU-lönerapportens Excel, i rapportens avsnitt om
 * lönetransparens och i rapportunderlaget. Inga artikelnummer (ADR-16).
 */
const LONEBEGREPP_RESERVATION = 'Måtten är räknade på fast heltidsmånadslön. Direktivets lönebegrepp är vidare (total ersättning, inklusive rörliga delar och förmåner); komplettera ur lönesystemet om ni rapporterar.';
/** @returns {string} reservationen om lönebegreppet vid EU-rapportmåtten */
function lonebegreppReservation() { return LONEBEGREPP_RESERVATION; }

// ---- Lönefördelningen i Ålder & karriär: klasserna för histogrammet (flyttade från src/app/40-alder-karriar.js) ----

// Minsta och största värdet i en lista: en slinga, eftersom Math.min(...v) slår i taket för antal argument vid stora filer.
function omfang(v) {
    let min = Infinity, max = -Infinity;
    for (const x of v) { if (x < min) min = x; if (x > max) max = x; }
    return [min, max];
}

// ---- Löneklasser: indelningen för histogrammet ----
// Klassbredden väljs bland jämna steg så att spannet ger ungefär `mal` klasser. Spannet mäts mellan 5:e och 95:e
// percentilen, så att enstaka löner långt ut inte gör klasserna för breda.
function lonesteg(loner, mal = 12) {
    const spann = _quantile(loner, 0.95) - _quantile(loner, 0.05);
    return [500, 1000, 2000, 2500, 5000, 10000, 20000].find(s => spann / s <= mal) || 50000;
}

// ---- Histogram: lönefördelningen för kvinnor och män, klass för klass ----
// Andel av respektive kön per löneklass. Visas bara när båda könen når tröskeln. Ingen stapel får gälla en klass
// med färre än tröskeln personer: klasserna i ändarna slås ihop inåt tills ändklassen når tröskeln ("under X",
// "X eller mer"), och finns en gles klass i mitten fördubblas klassbredden och indelningen görs om. Går det inte
// att få minst tre klasser ritas inget.
function histogramKlasser(kv, ma, k) {
    const alla = [...kv, ...ma];
    if (kv.length < k || ma.length < k) return null;
    let steg = lonesteg(alla);
    for (let varv = 0; varv < 6; varv++, steg *= 2) {
        const [lagst, hogst] = omfang(alla), golv = Math.floor(lagst / steg) * steg, antal = Math.floor((hogst - golv) / steg) + 1;
        /** @type {Array<{fran: number, till: number, nKv: number, nMa: number, oppenNed?: boolean, oppenUpp?: boolean}>} */
        let klasser = Array.from({ length: antal }, (_, i) => ({ fran: golv + i * steg, till: golv + (i + 1) * steg, nKv: 0, nMa: 0 }));
        const plats = v => Math.min(antal - 1, Math.floor((v - golv) / steg));
        for (const v of kv) klasser[plats(v)].nKv++;
        for (const v of ma) klasser[plats(v)].nMa++;
        const n = c => c.nKv + c.nMa;
        const slaIhop = (a, b) => ({ fran: a.fran, till: b.till, nKv: a.nKv + b.nKv, nMa: a.nMa + b.nMa, ...(a.oppenNed ? { oppenNed: true } : {}), ...(b.oppenUpp ? { oppenUpp: true } : {}) });
        while (klasser.length > 1 && n(klasser[0]) < k) klasser = [{ ...slaIhop(klasser[0], klasser[1]), oppenNed: true }, ...klasser.slice(2)];
        while (klasser.length > 1 && n(klasser[klasser.length - 1]) < k) klasser = [...klasser.slice(0, -2), { ...slaIhop(klasser[klasser.length - 2], klasser[klasser.length - 1]), oppenUpp: true }];
        if (klasser.length >= 3 && klasser.every(c => n(c) >= k)) return klasser;
    }
    return null;
}

    return { medianGapPct, representationByBas, quartileDistribution, distributionalGap, tillDirektivtecken, lonebegreppReservation, omfang, lonesteg, histogramKlasser };
})();
const _stMedianGapPct = __mirrorStructure.medianGapPct;
const _stRepresentationByBas = __mirrorStructure.representationByBas;
const _stQuartileDistribution = __mirrorStructure.quartileDistribution;
const _stDistributionalGap = __mirrorStructure.distributionalGap;
const _stTillDirektivtecken = __mirrorStructure.tillDirektivtecken;
const _stLonebegreppReservation = __mirrorStructure.lonebegreppReservation;
const _omfang = __mirrorStructure.omfang;
const _konLonesteg = __mirrorStructure.lonesteg;
const _konHistogramKlasser = __mirrorStructure.histogramKlasser;

// ---- speglar src/lib/rng.js ----
const __mirrorRng = (() => {
// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
/**
 * Öppen lönekartläggning — Deterministisk slumpgenerator för bootstrap
 *
 * Med `Math.random()` skulle SAMMA fil ge OLIKA bootstrap-intervall vid varje
 * körning. Intervallen hamnar i utskrifter som går till ledning och fack, så två
 * personer med samma underlag ska få samma siffror — och projektet i övrigt är
 * byggt på reproducerbarhet (golden-lås, determinismtester, mulberry32 i
 * testdatageneratorn).
 *
 * Därför seedas generatorn från datat självt. Samma indata → samma seed →
 * samma intervall, varje gång, i varje webbläsare. Statistiskt likvärdigt —
 * bootstrap kräver bara att draget är pseudoslumpmässigt, inte oförutsägbart.
 *
 * Löftet gäller också oavsett radordningen (ADR-86): seeden byggs ur antal och
 * summa per serie, och de som drar ur en lista (bootstrapen och omkastningen i
 * likvardighet.js och status.js, kvantilbootstrapen i osakerhet.js) sorterar
 * den först. Samma löner i en annan ordning ger samma intervall.
 *
 * Separat från app.js för Vitest; app.js får en AUTO-GENERERAD spegel (`_rng*`
 * i src/app/09-lib-speglar.js via tools/gen-mirrors.mjs) — ändra här och kör
 * `npm run build:app`, rör ej spegeln (vaktas av artefaktgrinden).
 */

/**
 * FNV-1a, 32 bitar. Snabb och stabil sträng→heltal-hash.
 * @param {string} str
 * @returns {number} osignerat 32-bitars heltal
 */
function hashSeed(str) {
    let h = 2166136261;
    const s = String(str);
    for (let i = 0; i < s.length; i++) {
        h ^= s.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    return h >>> 0;
}

/**
 * mulberry32 — samma generator som testdatageneratorn använder. Liten, snabb
 * och tillräckligt bra för bootstrap-återsampling.
 * @param {number} seed
 * @returns {() => number} funktion som ger tal i [0, 1)
 */
function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
        a = (a + 0x6D2B79F5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

/**
 * Härleder en stabil seed ur själva talserierna. Använder längd + summa per
 * serie, vilket är billigt och ändras så fort underlaget ändras (ny fil, annat
 * urval → nytt men reproducerbart intervall). Summan tas över talen sorterade
 * stigande: med decimaler (öre) kan en flyttalssumma annars skilja i sista
 * siffran mellan två ordningar och, när den slutar på ,50, avrundas olika.
 * @param {...Array<number>} arrays
 * @returns {number}
 */
function seedFromNumbers(...arrays) {
    let s = '';
    for (const arr of arrays) {
        if (!Array.isArray(arr)) { s += 'x|'; continue; }
        const tal = [];
        for (let i = 0; i < arr.length; i++) {
            const v = Number(arr[i]);
            if (isFinite(v)) tal.push(v);
        }
        tal.sort((x, y) => x - y);
        let sum = 0;
        for (let i = 0; i < tal.length; i++) sum += tal[i];
        s += arr.length + ':' + Math.round(sum) + '|';
    }
    return hashSeed(s);
}

/**
 * Bekvämlighet: seedad generator direkt ur talserierna.
 * @param {...Array<number>} arrays
 * @returns {() => number}
 */
function rngFor(...arrays) {
    return mulberry32(seedFromNumbers(...arrays));
}

    return { hashSeed, seedFromNumbers, rngFor };
})();
const _rngHashSeed = __mirrorRng.hashSeed;
const _rngSeedFrom = __mirrorRng.seedFromNumbers;
const _rngFor = __mirrorRng.rngFor;

// ---- speglar src/lib/status.js ----
const __mirrorStatus = (() => {
    // importer ur tidigare speglade lib-moduler
    const median = __mirrorStat.median;
    const percentilintervall = __mirrorStat.percentilintervall;
    const rngFor = __mirrorRng.rngFor;

// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
/**
 * Öppen lönekartläggning — uppmärksamhetstrappan och direktivmarkeringen (ADR-59).
 *
 * Statusen för en skillnad mellan kvinnors och mäns lön sätts på STATISTISK SIGNAL:
 *
 *   Värt att granska  — skillnaden är säkerställd (utanför slumpens gränser, eller ett KI som utesluter lika lön)
 *                       och minst STORLEKSGRANS (3 %, verktygets egen storleksgräns).
 *   Följ upp          — minst 3 % men inte säkerställd, eller säkerställd men under 3 %.
 *   Balanserat        — under 3 % och inte säkerställd.
 *   Går ej att bedöma — något kön är under golvet (statGolv i appen) eller skillnaden kunde inte prövas.
 *
 * Direktivmarkeringen (minst DIREKTIVNIVA, 5 %) är något annat: en märkt markering på den OJUSTERADE medianskillnaden,
 * som visar var den nivå som direktivets regler om gemensam lönebedömning utgår från nås. Den är ingen bedömning och
 * står aldrig på regressionens justerade tal.
 *
 * Slumpens gränser för en grupp är trattdiagrammets: omkastning av könen inom gruppen (1 000 gånger, seedad ur
 * datat), och för en grupp över 300 personer en normalapproximation med gruppens egen spridning.
 *
 * Webbläsarbygget får en AUTO-GENERERAD spegel i src/app/09-lib-speglar.js. Inga DOM-/state-beroenden.
 */


/** Verktygets egen storleksgräns för statusen, i procent av mäns lön. */
const STORLEKSGRANS = 3;
/** Nivån för direktivmarkeringen på den ojusterade löneskillnaden, i procent. */
const DIREKTIVNIVA = 5;
/** Antalet omkastningar per grupp, och gruppstorleken över vilken normalapproximationen används. */
const OMKASTNINGAR = 1000, STOR_GRUPP = 300;

/** Statusens ord och gräns i klartext (färg, ikon och symbol hör till appen, 10-diagramtema.js). */
const STATUS_ORD = Object.freeze({
    granska: Object.freeze({ serie: 'Värt att granska', grans: 'säkerställd skillnad på minst 3 %' }),
    folj: Object.freeze({ serie: 'Följ upp', grans: 'minst 3 % men inte säkerställd, eller säkerställd men under 3 %' }),
    balanserat: Object.freeze({ serie: 'Balanserat', grans: 'under 3 % och inte säkerställd' }),
    ejbedomd: Object.freeze({ serie: 'Går ej att bedöma', grans: 'för få av ett kön för att pröva skillnaden' })
});

/** Direktivmarkeringens etikett, kolumnrubrik och verktygstips. */
const DIREKTIV_ETIKETT = '≥ 5 %';
const DIREKTIV_KOLUMN = 'Ojusterad löneskillnad ≥ 5 %';
const DIREKTIV_TIPS = 'Direktivets regler om gemensam lönebedömning utgår från en skillnad på minst 5 %; markeringen visar var den nivån nås. Den är inte en bedömning.';

/**
 * Konstanterna i ett objekt, för appen och andra lib-moduler (speglingen exponerar bara funktioner).
 * @returns {{STORLEKSGRANS:number, DIREKTIVNIVA:number, STATUS_ORD:typeof STATUS_ORD, DIREKTIV_ETIKETT:string, DIREKTIV_KOLUMN:string, DIREKTIV_TIPS:string}}
 */
function statusKonstanter() {
    return { STORLEKSGRANS, DIREKTIVNIVA, STATUS_ORD, DIREKTIV_ETIKETT, DIREKTIV_KOLUMN, DIREKTIV_TIPS };
}

/**
 * Trappans nivå för ett avstånd från lika lön (|100 − kvinnors lön i % av mäns|) och en prövning.
 * @param {number} avstand
 * @param {boolean|null|undefined} sakerstalld  true/false från prövningen; null när den inte kunde göras
 * @returns {'granska'|'folj'|'balanserat'|'ejbedomd'}
 */
function statusNiva(avstand, sakerstalld) {
    if (typeof avstand !== 'number' || !isFinite(avstand) || typeof sakerstalld !== 'boolean') return 'ejbedomd';
    const stor = Math.abs(avstand) >= STORLEKSGRANS;
    if (sakerstalld && stor) return 'granska';
    if (stor || sakerstalld) return 'folj';
    return 'balanserat';
}

/**
 * Direktivmarkeringen: den ojusterade löneskillnaden (kvinnors median i % av mäns) ligger minst 5 % från lika lön.
 * @param {number|null|undefined} kvotPct
 */
function direktivMarkering(kvotPct) {
    return typeof kvotPct === 'number' && isFinite(kvotPct) && Math.abs(100 - kvotPct) >= DIREKTIVNIVA - 1e-9;
}

/** Ett konfidensintervall för kvoten (i %) utesluter lika lön (100). null när intervallet saknas. */
function kiUtesluterLika(ci) {
    if (!ci || !isFinite(ci.lo) || !isFinite(ci.hi)) return null;
    return ci.lo > 100 || ci.hi < 100;
}

/**
 * Omkastning av könen inom gruppen: de mittersta 95 % av de kvoter (kvinnors median i % av mäns) slumpen ger.
 * Lönerna sorteras en gång; omkastningen flyttar rangerna i stället för lönerna, med samma byten och samma slumptal,
 * och medianerna läses ur rangordningen. Det ger samma kvoter som att ta medianen av de omkastade lönerna (lika
 * löner får olika rang men samma värde), i O(n) per omkastning utan allokeringar.
 *
 * Utgångsläget är kvinnornas löner stigande följda av männens stigande (kopior), inte lönerna i filens ordning: då
 * beror omkastningen bara på lönerna och antalen, inte på radordningen (ADR-86). Kvinnorna är de första nKv platserna
 * också efter sorteringen. Lika löner hos en kvinna och en man gör inget ordningsberoende: varje plats bär ett värde,
 * och utgångsläget (värdet på varje plats) är detsamma i varje ordning; vilken av två lika löner som får den lägre
 * rangen ändrar inget värde som medianen läser.
 * @param {number[]} kv
 * @param {number[]} ma
 * @param {number} [B]
 * @returns {{lag:number, hog:number}}
 */
function omkastningsGranser(kv, ma, B = OMKASTNINGAR) {
    const alla = [...kv].sort((x, y) => x - y).concat([...ma].sort((x, y) => x - y)), n = alla.length, nKv = kv.length, nMa = n - nKv, rnd = rngFor(kv, ma), kvoter = new Array(B);
    // rang[i]: platsen i den sorterade listan för personen på plats i; sorterad[r]: lönen med rang r.
    const ordning = Array.from({ length: n }, (_, i) => i).sort((x, y) => alla[x] - alla[y]);
    const rang = new Int32Array(n), sorterad = new Float64Array(n), arKv = new Uint8Array(n);
    for (let r = 0; r < n; r++) { rang[ordning[r]] = r; sorterad[r] = alla[ordning[r]]; }
    // Medianens platser bland gruppens sorterade löner: udda antal ger samma plats två gånger.
    const kvHog = nKv >> 1, kvLag = nKv & 1 ? kvHog : kvHog - 1, maHog = nMa >> 1, maLag = nMa & 1 ? maHog : maHog - 1;
    for (let b = 0; b < B; b++) {
        // Ofullständig Fisher–Yates: de första nKv platserna blir ett slumpvis urval utan återläggning.
        for (let i = 0; i < nKv; i++) { const j = i + ((rnd() * (n - i)) | 0), t = rang[i]; rang[i] = rang[j]; rang[j] = t; }
        arKv.fill(0);
        for (let i = 0; i < nKv; i++) arKv[rang[i]] = 1;
        let cKv = 0, cMa = 0, kvL = 0, kvH = 0, maL = 0, maH = 0;
        for (let r = 0; r < n; r++) {
            const v = sorterad[r];
            if (arKv[r]) { if (cKv === kvLag) kvL = v; if (cKv === kvHog) kvH = v; cKv++; }
            else { if (cMa === maLag) maL = v; if (cMa === maHog) maH = v; cMa++; }
        }
        // Som en median ur sortering: udda antal ger det mittersta värdet, jämnt medel av de två mittersta; ingen
        // person ger 0.
        const mKv = nKv & 1 ? kvH : (kvL + kvH) / 2, mMa = nMa & 1 ? maH : (maL + maH) / 2;
        kvoter[b] = mMa > 0 ? mKv / mMa * 100 : 100;
    }
    kvoter.sort((x, y) => x - y);
    return percentilintervall(kvoter);
}

/**
 * Slumpens gränser för en grupp: omkastning, och för en grupp över STOR_GRUPP personer normalformeln med gruppens
 * egen spridning (där är formeln rätt, och omkastningens kostnad växer med gruppen).
 * @param {number[]} kv
 * @param {number[]} ma
 * @returns {{lag:number, hog:number}}
 */
function slumpensGranser(kv, ma) {
    if (kv.length + ma.length <= STOR_GRUPP) return omkastningsGranser(kv, ma);
    const medKv = median(kv), medMa = median(ma);
    const r = [...kv.map(v => Math.abs(Math.log(v) - Math.log(medKv))), ...ma.map(v => Math.abs(Math.log(v) - Math.log(medMa)))];
    const h = 100 * 1.96 * 1.2533 * 1.4826 * median(r) * Math.sqrt(1 / kv.length + 1 / ma.length);
    return { lag: 100 - h, hog: 100 + h };
}

/**
 * Hela bedömningen för en grupp: kvoten, avståndet, prövningen mot slumpens gränser, trappans nivå och
 * direktivmarkeringen. Ett kön under `golv` ger nivån 'ejbedomd' och ingen prövning.
 * @param {number[]} kv
 * @param {number[]} ma
 * @param {{golv?: number, granser?: {lag:number, hog:number}|null}} [val]  `granser` om de redan är räknade
 */
function bedomSkillnad(kv, ma, { golv = 10, granser } = {}) {
    const medKv = median(kv), medMa = median(ma);
    const kvot = medMa > 0 ? medKv / medMa * 100 : NaN, avstand = Math.abs(100 - kvot);
    const direktiv = direktivMarkering(kvot);
    if (kv.length < golv || ma.length < golv || kv.length < 2 || ma.length < 2 || !isFinite(kvot))
        return { kvot, avstand, sakerstalld: null, niva: /** @type {'ejbedomd'} */ ('ejbedomd'), direktiv, granser: null };
    const gr = granser || slumpensGranser(kv, ma);
    const sakerstalld = isFinite(gr.lag) && isFinite(gr.hog) ? (kvot < gr.lag || kvot > gr.hog) : null;
    return { kvot, avstand, sakerstalld, niva: statusNiva(avstand, sakerstalld), direktiv, granser: gr };
}

/**
 * Per-BAS-signalen i regressionskortet (justerad skillnad): Titta närmare = säkerställd efter korrigering och minst 3 %;
 * Dokumentera = säkerställd under 3 %; Osäkert utslag = bara det råa p-värdet; annars Inget utslag. Ingen
 * direktivmarkering: regressionens tal är justerade.
 * @param {number} skillnadPct
 * @param {boolean} sakerEfterKorrigering
 * @param {boolean} sakerRatt  rå p < 0,05
 * @returns {{niva: 'titta'|'dokumentera'|'osakert'|'inget'}}
 */
function perBasSignal(skillnadPct, sakerEfterKorrigering, sakerRatt) {
    if (sakerEfterKorrigering) return { niva: Math.abs(skillnadPct) >= STORLEKSGRANS ? 'titta' : 'dokumentera' };
    return { niva: sakerRatt ? 'osakert' : 'inget' };
}

    return { statusNiva, direktivMarkering, kiUtesluterLika, omkastningsGranser, slumpensGranser, bedomSkillnad, perBasSignal, statusKonstanter };
})();
const _stsNiva = __mirrorStatus.statusNiva;
const _stsDirektiv = __mirrorStatus.direktivMarkering;
const _stsKiUtesluter = __mirrorStatus.kiUtesluterLika;
const _stsOmkastning = __mirrorStatus.omkastningsGranser;
const _stsSlumpensGranser = __mirrorStatus.slumpensGranser;
const _stsBedom = __mirrorStatus.bedomSkillnad;
const _stsPerBasSignal = __mirrorStatus.perBasSignal;
const _stsKonstanter = __mirrorStatus.statusKonstanter;

// ---- speglar src/lib/likvardighet.js ----
const __mirrorLikvardighet = (() => {
    // importer ur tidigare speglade lib-moduler
    const _median = __mirrorStat.median;
    const percentilintervall = __mirrorStat.percentilintervall;
    const rngFor = __mirrorRng.rngFor;
    const direktivMarkering = __mirrorStatus.direktivMarkering;
    const arKvinna = __mirrorKon.arKvinna;
    const namnrader = __mirrorAid.namnrader;

// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
/**
 * Öppen lönekartläggning — Likvärdighetsanalys (DiskrL 3:10 §)
 *
 * Ren, testbar kärna för § 3:10-analysen. Appen får den genom lib-speglarna
 * (ADR-8); computeLikvardighetPairs() i 34-likvardigt-arbete.js är adaptern
 * runt den. Vitest verifierar *algoritmen* deterministiskt.
 *
 * Modellen (ADR-60: jämförelseyrkena är alla som inte är kvinnodominerade):
 *   Klassning — EN definition i hela verktyget: arKvinnodominerad()/konsklass() nedan.
 *            'do': mer än gränsen (standard 60 %); 'scb': gränsen eller mer. Mansdominerat
 *            speglas för män; övriga är blandade.
 *   Steg 1 — Organisationens AID×BAS-grupper delas i:
 *            • kvinnodominerade — analysens subjekt
 *            • alla övriga (mansdominerade och blandade) — interna jämförelsekandidater
 *              med klassen synlig (PRIMÄR jämförelsekälla; § 3:10 är en
 *              inom-arbetsgivare-analys). K-anonymitet tillämpas EJ.
 *   Steg 2 — jämförelsestatistikens AID×BAS som inte är kvinnodominerade blir
 *            kandidater med klass. Lokal könsdata primär, den nationella
 *            personalstatistiken som reserv (injicerad `nationellKlass`-funktion) annars.
 *            Används som EXTERN fallback per BAS.
 *            Filtret `jamforelse: 'mansdominerade'` begränsar båda mängderna till de
 *            mansdominerade (det tidigare urvalet).
 *   Steg 3 — Jämför INOM samma BAS-intervall (= likvärdiga krav). Per BAS
 *            väljs internt jämförelseyrke om sådant finns, annars jämförelsestatistiken.
 *            Flagga par där jämförelseyrkets median > organisationens median,
 *            gap ≥ minGapPct. Varje par får ett bootstrap-95 %-CI på
 *            medianskillnaden (intern: bägge urvalen; extern: org-löner mot
 *            jämförelsestatistikens median som konstant). Interna par får
 *            dessutom en ÅLDERSJUSTERAD skillnad (aldersjusteradSkillnad):
 *            jämförelseyrkets lön standardiserad till den kvinnodominerade
 *            gruppens åldersfördelning. Den råa skillnaden är huvudmåttet —
 *            lagen prövar lönenivån som sådan — den justerade visar hur
 *            mycket av skillnaden som kan bero på åldersstruktur.
 *
 * @see 34-likvardigt-arbete.js computeLikvardighetPairs
 */






const KVINNO_TROSKEL_DEFAULT = 60;   // > → kvinnodominerat ('do', *Mer än 60 %*)
const KV_DOM_STAT = 60;               // gränsen för jämförelsestatistiken — samma som KVINNO_TROSKEL_DEFAULT

/**
 * Den enda definitionen av kvinnodominerat arbete i verktyget (ADR-60, §9.22).
 * 'do' (*Mer än X %*): mer än gränsen. 'scb' (*X % eller mer*): gränsen eller mer. Nycklarna är historiska och
 * står kvar för sparade konfigurationsfiler; valen heter efter lydelsen (ADR-72).
 * @param {number|null|undefined} pct - procent kvinnor
 * @param {'do'|'scb'|string} [definition='do']
 * @param {number} [grans=60]
 * @returns {boolean}
 */
function arKvinnodominerad(pct, definition = 'do', grans = KVINNO_TROSKEL_DEFAULT) {
    if (typeof pct !== 'number' || !isFinite(pct)) return false;
    return definition === 'scb' ? pct >= grans : pct > grans;
}

/**
 * Könsklassen för en grupp efter andelen kvinnor, med samma definition för män (speglad).
 * @param {number|null|undefined} pct - procent kvinnor
 * @param {'do'|'scb'|string} [definition='do']
 * @param {number} [grans=60]
 * @returns {'kvinnodominerad'|'mansdominerad'|'blandad'|''} '' när andelen är okänd
 */
function konsklass(pct, definition = 'do', grans = KVINNO_TROSKEL_DEFAULT) {
    if (typeof pct !== 'number' || !isFinite(pct)) return '';
    if (arKvinnodominerad(pct, definition, grans)) return 'kvinnodominerad';
    if (arKvinnodominerad(100 - pct, definition, grans)) return 'mansdominerad';
    return 'blandad';
}

/**
 * Förbereder en grupps löner för bootstrapmedianen: lönerna sorteras stigande en gång (en kopia), och dragningarna görs
 * ur den sorterade listan. En dragning räknar sedan hur många gånger varje plats dras, och medianen läses ur den
 * kumulativa räkningen. Det ger samma median som att sortera varje dragning, men i O(n) i stället för O(n log n) och
 * utan allokeringar per dragning. Eftersom platserna är platser i den SORTERADE listan beror dragningarna bara på
 * lönerna, inte på i vilken ordning de stod i filen (ADR-86): lika löner har samma värde, så det spelar ingen roll
 * vilken av dem som står först.
 * @param {number[]} lons
 * @returns {{n:number, sorterad:Float64Array, antal:Int32Array}}
 */
function _sorteratUnderlag(lons) {
    const n = lons.length;
    const sorterad = Float64Array.from(lons).sort();
    return { n, sorterad, antal: new Int32Array(n) };
}

/**
 * Medianen av en dragning med återläggning ur underlaget. Anropar `rng()` n gånger, i samma ordning som en
 * dragning `sorterad[(rng() * n) | 0]` per position ur de stigande sorterade lönerna. Udda n: det mittersta
 * elementet; jämnt n: medel av de två mittersta.
 * @param {{n:number, sorterad:Float64Array, antal:Int32Array}} u
 * @param {() => number} rng
 * @returns {number}
 */
function _dragningsmedian(u, rng) {
    const { n, sorterad, antal } = u;
    antal.fill(0);
    for (let i = 0; i < n; i++) antal[(rng() * n) | 0]++;
    const m = n >> 1;
    let summa = 0, r = 0;
    if (n & 1) {
        for (; r < n; r++) { summa += antal[r]; if (summa > m) return sorterad[r]; }
    }
    // Jämnt n: det nedre mittelementet har index m − 1, det övre index m (räknat från 0).
    for (; r < n; r++) {
        summa += antal[r];
        if (summa >= m) break;
    }
    const nedre = sorterad[r];
    if (summa >= m + 1) return nedre;
    for (r++; r < n; r++) {
        summa += antal[r];
        if (summa >= m + 1) break;
    }
    return (nedre + sorterad[r]) / 2;
}

/**
 * Medianerna i B bootstrapdragningar ur två grupper: per dragning dras först kvN löner ur kv och sedan maN ur ma,
 * med återläggning, i samma ordning som `sorterad[(rng() * n) | 0]` per position ur gruppens stigande sorterade
 * löner, så att dragningarna inte beror på radordningen (ADR-86). Medianerna tas ur rangräkning
 * (`_dragningsmedian`) och är desamma som om varje dragning sorterades. Den gemensamma kärnan för
 * bootstrapintervallen på medianskillnaden (här) och på mediankvoten (Lika arbete, Ålder & karriär, gruppdossiern).
 * Lönerna ska vara ändliga tal; de ändras inte.
 * @param {number[]} kvLons
 * @param {number[]} maLons
 * @param {number} B
 * @param {() => number} rng
 * @returns {{kv: Float64Array, ma: Float64Array}} medianen per dragning för vardera gruppen
 */
function bootstrapMedianer(kvLons, maLons, B, rng) {
    const kv = _sorteratUnderlag(kvLons), ma = _sorteratUnderlag(maLons);
    const mKv = new Float64Array(B), mMa = new Float64Array(B);
    for (let b = 0; b < B; b++) {
        mKv[b] = _dragningsmedian(kv, rng);
        mMa[b] = _dragningsmedian(ma, rng);
    }
    return { kv: mKv, ma: mMa };
}

/**
 * Bootstrap-CI för MEDIAN-SKILLNAD i kronor (m_ma − m_kv), 95 % (percentilintervall i stat.js).
 * Används för INTERNA par (bägge sidor har individdata). Dragningarna och medianerna ur `bootstrapMedianer`.
 * @param {number[]} kvLons
 * @param {number[]} maLons
 * @param {number} [B=1000]
 * @param {() => number} [rng=Math.random] - injicerbar RNG för deterministiska tester
 * @returns {{lo:number, hi:number}|null}
 */
function bootstrapMedianDiffKr(kvLons, maLons, B = 1000, rng = Math.random) {
    if (!Array.isArray(kvLons) || !Array.isArray(maLons)) return null;
    if (kvLons.length < 3 || maLons.length < 3) return null;
    const m = bootstrapMedianer(kvLons, maLons, B, rng);
    const diffs = new Array(B);
    for (let b = 0; b < B; b++) diffs[b] = m.ma[b] - m.kv[b];
    diffs.sort((a, b) => a - b);
    const { lag, hog } = percentilintervall(diffs);
    return { lo: lag, hi: hog };
}

/**
 * Bootstrap-CI mot ett KONSTANT referensvärde (constMedian − m_sample).
 * Används för EXTERNA par (jämförelsestatistikens median är ett aggregat utan individdata).
 * @param {number[]} orgLons
 * @param {number} constMedian
 * @param {number} [B=1000]
 * @param {() => number} [rng=Math.random]
 * @returns {{lo:number, hi:number}|null}
 */
function bootstrapMedianVsConstantKr(orgLons, constMedian, B = 1000, rng = Math.random) {
    if (!Array.isArray(orgLons) || orgLons.length < 3) return null;
    if (!(constMedian > 0)) return null;
    const org = _sorteratUnderlag(orgLons);
    const diffs = new Array(B);
    for (let b = 0; b < B; b++) diffs[b] = constMedian - _dragningsmedian(org, rng);
    diffs.sort((a, b) => a - b);
    const { lag, hog } = percentilintervall(diffs);
    return { lo: lag, hi: hog };
}

const ALDERS_GOLV_DEFAULT = 10;      // minsta antal personer i jämförelseyrket för åldersjustering
const ALDERS_SPRIDNING_MIN = 5;      // minsta åldersspridning (år) i jämförelseyrket

function _medel(arr) {
    const v = (arr || []).filter(x => typeof x === 'number' && isFinite(x));
    return v.length ? v.reduce((s, x) => s + x, 0) / v.length : null;
}

/**
 * Åldersjusterad skillnad för ett internt par: jämförelseyrkets lön standardiseras
 * till den kvinnodominerade gruppens åldersfördelning.
 *
 * I jämförelseyrket skattas log(lön) = a + b·ålder (OLS). Kravet är minst `golv`
 * personer med ålder och minst 5 års åldersspridning — annars null. Lönen
 * prediceras sedan vid varje person i den kvinnodominerade gruppen med dennes
 * ålder; medianen av prediktionerna är den åldersjusterade jämförelsemedianen.
 * Skillnaden räknas i kronor och procent mot den kvinnodominerade gruppens
 * (råa) median, så att den är jämförbar med parets råa skillnad.
 *
 * @param {Array<{lon:number, alder?:number}>} kvRader - den kvinnodominerade gruppen
 * @param {Array<{lon:number, alder?:number}>} jmfRader - jämförelseyrket (individlöner)
 * @param {{golv?:number}} [opts]
 * @returns {{medianJusterad:number, gapKr:number, gapPct:number, metod:'alder'}|null}
 */
function aldersjusteradSkillnad(kvRader, jmfRader, { golv = ALDERS_GOLV_DEFAULT } = {}) {
    /** @returns {r is {lon:number, alder:number}} */
    const ok = r => !!r && r.lon > 0 && typeof r.alder === 'number' && isFinite(r.alder);
    const jmf = (jmfRader || []).filter(ok);
    if (jmf.length < Math.max(golv, 3)) return null;
    let lagst = Infinity, hogst = -Infinity;
    for (const r of jmf) { if (r.alder < lagst) lagst = r.alder; if (r.alder > hogst) hogst = r.alder; }
    if (hogst - lagst < ALDERS_SPRIDNING_MIN) return null;
    const n = jmf.length;
    const mx = jmf.reduce((s, r) => s + r.alder, 0) / n;
    let Sxx = 0, Sxy = 0, Sy = 0;
    for (const r of jmf) { const x = r.alder - mx, y = Math.log(r.lon); Sxx += x * x; Sxy += x * y; Sy += y; }
    if (!(Sxx > 1e-9)) return null;
    const b = Sxy / Sxx, a = Sy / n - b * mx;
    const kvAlla = (kvRader || []).filter(r => r && r.lon > 0);
    const kvMedAlder = kvAlla.filter(ok);
    if (!kvAlla.length || !kvMedAlder.length) return null;
    const pred = kvMedAlder.map(r => Math.exp(a + b * r.alder));
    const medianJusterad = _median(pred);
    const kvMedian = _median(kvAlla.map(r => r.lon));
    if (!(medianJusterad > 0) || !(kvMedian > 0)) return null;
    const gapKr = medianJusterad - kvMedian;
    return { medianJusterad, gapKr, gapPct: gapKr / kvMedian * 100, metod: 'alder' };
}

/** Individrader {lon, alder} ur en aggregerad grupp (lons och aldrar är parallella). */
function _gruppRader(g) {
    if (!g || !Array.isArray(g.lons)) return [];
    const aldrar = Array.isArray(g.aldrar) ? g.aldrar : [];
    return g.lons.map((lon, i) => ({ lon, alder: aldrar[i] }));
}

/** Åldersfälten för ett par: medelålder per sida och den justerade skillnaden (bara interna par). */
function _aldersFalt(f, g, ärIntern, golv) {
    /** @type {ReturnType<typeof aldersjusteradSkillnad>} */
    let aldersJusterad = null;
    if (ärIntern) {
        try { aldersJusterad = aldersjusteradSkillnad(_gruppRader(f), _gruppRader(g), { golv }); } catch (_) { aldersJusterad = null; }
    }
    return {
        kvMedelAlder: _medel(f.aldrar),
        maMedelAlder: ärIntern ? _medel(g.aldrar) : null,
        aldersJusterad
    };
}

/**
 * Steg 1 — aggregera organisationens individdata per AID×BAS och dela upp i
 * kvinnodominerade grupper (analysens subjekt) och alla övriga grupper
 * (interna jämförelsekandidater, med klassen mansdominerad eller blandad).
 *
 * @param {Array<{aid:string, bas:string, lon:number, kon:string, yrkeLabel?:string, yrke?:string, alder?:number}>} data
 * @param {number} kvinnoThr - kvinnotröskel i procent
 * @param {number} [K=10]
 * @param {'do'|'scb'} [definition='do'] - 'do': mer än tröskeln; 'scb': tröskeln eller mer
 * @returns {{orgKvDom:Array, orgIckeKv:Array, antalAidxBas:number, kvDomMedNLessThanK:number}}
 */
function aggregeraOrgKvDom(data, kvinnoThr = KVINNO_TROSKEL_DEFAULT, K = 10, definition = 'do') {
    const map = new Map();   // nyckel: aid|bas
    // Namnet ur texten på flest av gruppens rader (namnrader), som i resten av verktyget (ADR-89).
    const iGrupp = r => !!(String(r?.aid || '').trim() && r.lon > 0 && r.bas);
    const namn = namnrader((data || []).filter(iGrupp), r => String(r.aid).trim() + '|' + r.bas);
    for (const r of (data || [])) {
        if (!iGrupp(r)) continue;
        const aid = String(r.aid).trim();
        const key = aid + '|' + r.bas;
        if (!map.has(key)) {
            const nr = namn.get(key);
            map.set(key, { aid, bas: r.bas, label: nr.yrkeLabel || nr.yrke || aid, n: 0, nKv: 0, lons: [], aldrar: [] });
        }
        const g = map.get(key);
        g.n++;
        if (arKvinna(r)) g.nKv++;
        g.lons.push(r.lon);
        // Åldern bärs parallellt med lönen (null när den saknas) för åldersjusteringen i steg 3.
        g.aldrar.push(typeof r.alder === 'number' && isFinite(r.alder) ? r.alder : null);
    }
    const orgKvDom = [];
    const orgIckeKv = [];
    let kvDomMedNLessThanK = 0;
    for (const g of map.values()) {
        const kvinnoPct = (g.nKv / g.n) * 100;
        const klass = konsklass(kvinnoPct, definition, kvinnoThr);
        const obj = {
            aid: g.aid, bas: g.bas, label: g.label,
            n: g.n, nKv: g.nKv, kvinnoPct, klass,
            median: _median(g.lons), lons: g.lons.slice(), aldrar: g.aldrar.slice()
        };
        if (klass === 'kvinnodominerad') {
            orgKvDom.push(obj);
            if (g.n < K) kvDomMedNLessThanK++;
        } else {
            orgIckeKv.push(obj);
        }
    }
    orgKvDom.sort((a, b) => b.n - a.n);
    orgIckeKv.sort((a, b) => b.n - a.n);
    return { orgKvDom, orgIckeKv, antalAidxBas: map.size, kvDomMedNLessThanK };
}

/**
 * Steg 2 — klassificera jämförelsestatistiken per AID×BAS. Returnerar raderna
 * som inte är kvinnodominerade (mansdominerade och blandade, med klass) grupperade per BAS.
 * `klass.ickeKv` är alla kandidater; `klass.blandat` är hur många av dem som är blandade.
 *
 * @param {Array<{aid:string, bas:string, median:number, andelKv?:number, aidFull?:string, nKv?:number, nMa?:number}>} statistik
 * @param {((aid:string) => ({kvAndel:number}|null))|null} [nationellKlass] - reserven: den nationella kvinnoandelen per AID-kod
 * @param {{definition?:'do'|'scb', grans?:number}} [val]
 * @returns {{statIckeKv:Array, statByBas:Map, klass:Object, klassKalla:Object}}
 */
function klassificeraStatistik(statistik, nationellKlass, { definition = 'do', grans = KV_DOM_STAT } = {}) {
    const statByBas = new Map();
    const statIckeKv = [];
    const klass = { kvDom: 0, blandat: 0, ickeKv: 0, oklassificerad: 0 };
    const klassKalla = { lokal: 0, nationell: 0 };

    for (const s of (statistik || [])) {
        if (!s || !s.aid || !s.bas || !(s.median > 0)) continue;
        if (!/^\d+$/.test(String(s.aid))) continue;   // hoppa över yrkesfamiljerubriker

        /** @type {number|null} */ let kvAndel = null;
        /** @type {'lokal'|'nationell'|null} */ let källa = null;
        if (s.andelKv != null && s.andelKv >= 0 && s.andelKv <= 100) {
            kvAndel = s.andelKv; källa = 'lokal';
        } else if (typeof nationellKlass === 'function') {
            const nat = nationellKlass(s.aid);
            if (nat && nat.kvAndel != null) { kvAndel = nat.kvAndel; källa = 'nationell'; }
        }
        if (kvAndel == null) { klass.oklassificerad++; continue; }
        if (källa === 'lokal') klassKalla.lokal++; else klassKalla.nationell++;

        const ks = konsklass(kvAndel, definition, grans);
        if (ks === 'kvinnodominerad') { klass.kvDom++; continue; }
        if (ks === 'blandad') klass.blandat++;
        klass.ickeKv++;

        const rawLabel = s.aidFull || s.aid;
        const aidStr = String(s.aid);
        const cleanLabel = String(rawLabel).startsWith(aidStr)
            ? String(rawLabel).slice(aidStr.length).replace(/^\s*[—\-:.\s]*/, '').trim() || aidStr
            : rawLabel;
        const obj = {
            aid: s.aid, label: cleanLabel, bas: s.bas,
            median: s.median, kvAndel, klass: ks, källa, nKv: s.nKv, nMa: s.nMa
        };
        if (!statByBas.has(s.bas)) statByBas.set(s.bas, []);
        statByBas.get(s.bas).push(obj);
        statIckeKv.push(obj);
    }
    statIckeKv.sort((a, b) => a.kvAndel - b.kvAndel);
    return { statIckeKv, statByBas, klass, klassKalla };
}

/**
 * Bygg en Map per BAS av organisationens interna jämförelseyrken.
 * @param {Array} orgIckeKv
 * @returns {Map<string, Array>}
 */
function orgIckeKvByBas(orgIckeKv) {
    const m = new Map();
    for (const g of (orgIckeKv || [])) {
        if (!m.has(g.bas)) m.set(g.bas, []);
        m.get(g.bas).push(g);
    }
    return m;
}

/**
 * Antalet par som klarat minsta gapet, räknat FÖRE topN-urvalet (ADR-61): totalt, hur många som når direktivnivån 5 %
 * på det ojusterade gapet (det kvinnodominerade yrkets median i % av jämförelseyrkets, direktivMarkering) och hur
 * många som har en säker skillnad (hela KI:t över 0).
 * @param {Array} candidates
 * @returns {{totalt:number, overDirektiv:number, sakra:number}}
 */
function _parAntal(candidates) {
    let overDirektiv = 0, sakra = 0;
    for (const p of candidates) {
        if (p.maMedian > 0 && direktivMarkering(p.kvMedian / p.maMedian * 100)) overDirektiv++;
        if (p.gapCI && p.gapCI.lo != null && p.gapCI.lo > 0) sakra++;
    }
    return { totalt: candidates.length, overDirektiv, sakra };
}

/**
 * Steg 3 — bygg kandidatpar inom samma BAS. Per BAS väljs organisationens
 * egna icke-kv-dom yrken (intern, primärt); saknas sådant används jämförelsestatistiken
 * (extern fallback). Flagga par där jämförelseyrkets median > org-median.
 *
 * @param {Array} orgKvDom
 * @param {Map} internByBas - från orgIckeKvByBas()
 * @param {Map} externByBas - statByBas från klassificeraStatistik()
 * @param {Object} [opts] - { minGap, topN, B, rng, golv }
 * @returns {{pairs:Array, jämförelse:Object, antal:{totalt:number, overDirektiv:number, sakra:number}}}
 */
function byggPar(orgKvDom, internByBas, externByBas, opts = {}) {
    const minGap = opts.minGap ?? 0;
    const topN = opts.topN ?? 100;
    const B = opts.B ?? 1000;
    const golv = opts.golv ?? ALDERS_GOLV_DEFAULT;
    // Utan explicit rng seedas bootstrappen PER PAR ur parets egna löner
    // (rngFor). Då blir konfidensintervallen reproducerbara mellan körningar —
    // ett Math.random-default gav nya KI varje gång och gjorde ett exporterat
    // underlag omöjligt att återskapa. Tester injicerar sin egen rng.
    const rngOpt = opts.rng ?? null;
    const prngFor = (a, b) => rngOpt || rngFor(a, b);
    const jämförelse = {
        gemensammaBas: 0, möjligaPar: 0, statHögre: 0, statLägreEllerLika: 0,
        internaPar: 0, externaPar: 0, basMedExternFallback: 0,
        kravProxy: 'bas', kvUtanPoang: 0
    };
    const pairs = [];
    internByBas = internByBas || new Map();
    externByBas = externByBas || new Map();
    if (!orgKvDom?.length || (!internByBas.size && !externByBas.size)) return { pairs, jämförelse, antal: _parAntal(pairs) };

    const orgBasSet = new Set(orgKvDom.map(f => f.bas));
    const jämförBasSet = new Set([...internByBas.keys(), ...externByBas.keys()]);
    jämförelse.gemensammaBas = [...orgBasSet].filter(b => jämförBasSet.has(b)).length;

    const candidates = [];
    for (const f of orgKvDom) {
        const internaRows = internByBas.get(f.bas) || [];
        const externaRows = externByBas.get(f.bas) || [];
        let jämförRader, källa;
        if (internaRows.length) {
            jämförRader = internaRows; källa = 'intern';
        } else if (externaRows.length) {
            jämförRader = externaRows; källa = 'extern';
            jämförelse.basMedExternFallback++;
        } else {
            continue;
        }
        for (const g of jämförRader) {
            jämförelse.möjligaPar++;
            if (g.median <= f.median) { jämförelse.statLägreEllerLika++; continue; }
            jämförelse.statHögre++;
            const gapKr = g.median - f.median;
            const gapPct = (gapKr / f.median) * 100;
            if (gapPct < minGap) continue;

            const ärIntern = källa === 'intern';
            /** @type {{lo:number, hi:number}|null} */
            let gapCI = null;
            try {
                gapCI = (ärIntern && Array.isArray(g.lons))
                    ? bootstrapMedianDiffKr(f.lons, g.lons, B, prngFor(f.lons, g.lons))
                    : bootstrapMedianVsConstantKr(f.lons, g.median, B, prngFor(f.lons, [g.median]));
            } catch (_) { gapCI = null; }

            if (ärIntern) jämförelse.internaPar++; else jämförelse.externaPar++;

            candidates.push({
                kvAid: f.aid, kvLabel: f.label, kvBas: f.bas,
                kvN: f.n, kvNKv: f.nKv, kvMedian: f.median, kvKvinnoPct: f.kvinnoPct,
                maAid: g.aid, maLabel: g.label, maBas: f.bas,
                maMedian: g.median,
                maKvAndel: ärIntern ? g.kvinnoPct : g.kvAndel,
                maKvinnoPct: ärIntern ? g.kvinnoPct : g.kvAndel,
                maKlass: g.klass || '',
                maN: ärIntern ? g.n : null,
                maNKv: g.nKv, maNMa: g.nMa,
                jamforKalla: källa,                       // 'intern' | 'extern'
                maKlassKort: ärIntern ? 'intern' : (g.källa === 'lokal' ? 'lokal' : 'nationell'),   // var andelen kommer ifrån
                gapKr, gapPct, gapCI,
                ..._aldersFalt(f, g, ärIntern, golv),
                allvarsindex: Math.abs(gapKr) * f.n
            });
        }
    }
    candidates.sort((a, b) => b.gapPct - a.gapPct);
    return { pairs: candidates.slice(0, topN), jämförelse, antal: _parAntal(candidates) };
}

/**
 * Steg 3 (#5) — bygg kandidatpar med ARBETSVÄRDERINGSPOÄNG som krav-proxy
 * istället för BAS. Parar över BAS-gränser: ett jämförelseyrke kvalificerar om
 * dess poäng ≤ det kvinnodominerade yrkets poäng × (1 + band) — dvs likvärdiga
 * eller lägre krav (DiskrL 3:10). Bara organisationens egna jämförelseetiketter
 * jämförs: jämförelsestatistiken har inga poäng (ADR-76).
 *
 * @param {Array} orgKvDom
 * @param {Array} internAll - organisationens icke-kv-dom yrken (flat)
 * @param {Map<string,number>} poangByKey - 'AID|BAS' eller 'AID' → poäng
 * @param {Object} [opts] - { minGap, topN, B, rng, bandPct, golv }
 * @returns {{pairs:Array, jämförelse:Object, antal:{totalt:number, overDirektiv:number, sakra:number}}}
 */
function byggParPoäng(orgKvDom, internAll, poangByKey, opts = {}) {
    const minGap = opts.minGap ?? 0;
    const topN = opts.topN ?? 100;
    const B = opts.B ?? 1000;
    const golv = opts.golv ?? ALDERS_GOLV_DEFAULT;
    // Utan explicit rng seedas bootstrappen PER PAR ur parets egna löner
    // (rngFor). Då blir konfidensintervallen reproducerbara mellan körningar —
    // ett Math.random-default gav nya KI varje gång och gjorde ett exporterat
    // underlag omöjligt att återskapa. Tester injicerar sin egen rng.
    const rngOpt = opts.rng ?? null;
    const prngFor = (a, b) => rngOpt || rngFor(a, b);
    const bandPct = opts.bandPct ?? 5;
    // externaPar och basMedExternFallback står kvar (alltid 0) så att diagnostiken har samma form som i BAS-läget;
    // fliken och exporterna visar dem inte när kravProxy är 'poäng'.
    const jämförelse = {
        gemensammaBas: 0, möjligaPar: 0, statHögre: 0, statLägreEllerLika: 0,
        internaPar: 0, externaPar: 0, basMedExternFallback: 0,
        kravProxy: 'poäng', kvUtanPoang: 0
    };
    const pairs = [];
    orgKvDom = orgKvDom || [];
    internAll = internAll || [];
    poangByKey = poangByKey || new Map();
    if (!orgKvDom.length || !poangByKey.size) return { pairs, jämförelse, antal: _parAntal(pairs) };

    const poangFor = g => poangByKey.get(g.aid + '|' + g.bas) ?? poangByKey.get(String(g.aid)) ?? null;
    const candidates = [];
    for (const f of orgKvDom) {
        const fP = poangFor(f);
        if (fP == null) { jämförelse.kvUtanPoang++; continue; }
        const tak = fP * (1 + bandPct / 100);
        const jämförRader = internAll.filter(g => { const p = poangFor(g); return p != null && p <= tak; });
        for (const g of jämförRader) {
            jämförelse.möjligaPar++;
            if (g.median <= f.median) { jämförelse.statLägreEllerLika++; continue; }
            jämförelse.statHögre++;
            const gapKr = g.median - f.median;
            const gapPct = (gapKr / f.median) * 100;
            if (gapPct < minGap) continue;
            /** @type {{lo:number, hi:number}|null} */
            let gapCI = null;
            try {
                gapCI = bootstrapMedianDiffKr(f.lons, g.lons, B, prngFor(f.lons, g.lons));
            } catch (_) { gapCI = null; }
            jämförelse.internaPar++;
            candidates.push({
                kvAid: f.aid, kvLabel: f.label, kvBas: f.bas,
                kvN: f.n, kvNKv: f.nKv, kvMedian: f.median, kvKvinnoPct: f.kvinnoPct,
                maAid: g.aid, maLabel: g.label, maBas: g.bas,
                maMedian: g.median,
                maKvAndel: g.kvinnoPct,
                maKvinnoPct: g.kvinnoPct,
                maKlass: g.klass || '',
                maN: g.n,
                maNKv: g.nKv, maNMa: g.nMa,
                jamforKalla: 'intern',
                maKlassKort: 'intern',
                gapKr, gapPct, gapCI,
                ..._aldersFalt(f, g, true, golv),
                kvPoang: fP, maPoang: poangFor(g),
                allvarsindex: Math.abs(gapKr) * f.n
            });
        }
    }
    candidates.sort((a, b) => b.gapPct - a.gapPct);
    return { pairs: candidates.slice(0, topN), jämförelse, antal: _parAntal(candidates) };
}

/**
 * Lägre krav, högre lön (ADR-25): par där ett kvinnodominerat
 * yrke har lägre medianlön än ett av ORGANISATIONENS icke-kvinnodominerade yrken (samma mängd som kandidatparen, ADR-60) i
 * strikt LÄGRE BAS. BAS som krav-proxy — används bara när poäng saknas.
 *
 * @param {Array} orgKvDom
 * @param {Array} orgIckeKv
 * @param {Object} opts - { rang: bas → tal, minGap, topN, B, rng }
 * @returns {Array} par med samma fält som interna kandidatpar plus basSteg
 */
function byggParLagreKrav(orgKvDom, orgIckeKv, opts = {}) {
    const { rang } = opts;
    const minGap = opts.minGap ?? 0, topN = opts.topN ?? 100, B = opts.B ?? 1000;
    const rngOpt = opts.rng ?? null;
    const ut = [];
    for (const f of orgKvDom || []) {
        const rf = rang(f.bas);
        for (const g of orgIckeKv || []) {
            const rg = rang(g.bas);
            if (!(rg < rf) || !(g.median > f.median)) continue;
            const gapKr = g.median - f.median;
            const gapPct = gapKr / f.median * 100;
            if (gapPct < minGap) continue;
            ut.push({ _f: f, _g: g,
                kvAid: f.aid, kvLabel: f.label, kvBas: f.bas, kvN: f.n, kvNKv: f.nKv, kvMedian: f.median, kvKvinnoPct: f.kvinnoPct,
                maAid: g.aid, maLabel: g.label, maBas: g.bas, maMedian: g.median, maKvAndel: g.kvinnoPct,
                maKvinnoPct: g.kvinnoPct, maKlass: g.klass || '',
                maN: g.n, maNKv: g.nKv, maNMa: g.n - g.nKv,
                jamforKalla: 'intern', gapKr, gapPct, gapCI: null, basSteg: rf - rg,
            });
        }
    }
    ut.sort((a, b) => b.gapPct - a.gapPct || b.basSteg - a.basSteg);
    // Konfidensintervall bara för paren som behålls — sorteringen beror inte på dem, och
    // bootstrappen seedas per par, så resultatet blir detsamma som om alla räknats.
    return ut.slice(0, topN).map(({ _f, _g, ...p }) => {
        try { p.gapCI = bootstrapMedianDiffKr(_f.lons, _g.lons, B, rngOpt || rngFor(_f.lons, _g.lons)); } catch (_) { p.gapCI = null; }
        return p;
    });
}

/**
 * BAS-rang (BAS-ordningen är fast, se likvardighetsmodellen.md §6): bokstavens plats i alfabetet, A=1, B=2 … Varje bokstav är ett lika brett
 * poängintervall i BAS-systemet, så ett BAS-steg är alltid ett intervall — B → D är två steg
 * även när C saknas i underlaget. Samma rang används av regressionerna och Lägre krav.
 * Något som inte är en bokstav läggs alfabetiskt efter bokstäverna.
 * @param {string[]} allaBas - BAS-värdena i underlaget (behövs bara för det som inte är bokstäver)
 * @returns {(bas:string) => number}
 */
function basRangFn(allaBas) {
    const alfa = [...new Set(allaBas)].sort((a, b) => String(a).localeCompare(String(b), 'sv'));
    return b => { const i = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.indexOf(String(b).toUpperCase()); return String(b).length === 1 && i >= 0 ? i + 1 : 100 + alfa.indexOf(b); };
}

/**
 * Orkestrator — speglar app.js `computeLikvardighetPairs()` (utan state).
 *
 * @param {Object} [input]
 * @param {Array} [input.data] - organisationens individdata
 * @param {Array} [input.statistik] - jämförelsestatistiken
 * @param {((aid:string)=>({kvAndel:number}|null))|null} [input.nationellKlass]
 * @param {Object} [input.opts] - { kvinnoTrosholdPct, kvDomDefinition, jamforelse, minGapPct, topN, B, rng, k, aldersGolv }
 *   kvDomDefinition: 'do' (*Mer än X %*, standard) | 'scb' (*X % eller mer*; ADR-72).
 *   jamforelse: 'alla' (alla som inte är kvinnodominerade, standard) | 'mansdominerade' (ADR-60).
 * @returns {{orgKvDom:Array, orgIckeKv:Array, statIckeKv:Array, pairs:Array, parAntal:{totalt:number, overDirektiv:number, sakra:number}, lagreKrav:Array, diagnostik:Object, opts:Object}}
 */
function computeLikvardighetPairs({ data = [], statistik = [], nationellKlass = null, opts = {} } = {}) {
    const kvinnoThr = opts.kvinnoTrosholdPct ?? KVINNO_TROSKEL_DEFAULT;
    const definition = opts.kvDomDefinition === 'scb' ? 'scb' : 'do';
    const jamforelse = opts.jamforelse === 'mansdominerade' ? 'mansdominerade' : 'alla';
    const minGap = opts.minGapPct ?? 0;
    const topN = opts.topN ?? 100;
    const B = opts.B ?? 1000;
    // Skickas vidare ORÖRT: byggPar seedar per par ur parets egna löner när
    // ingen rng anges. Ett `?? Math.random` här hade satt opts.rng i varje
    // anrop och tyst slagit ut den seedningen — konfidensintervallen blev då
    // nya vid varje körning, vilket gör ett exporterat underlag omöjligt att
    // återskapa. Bara tester injicerar en egen rng.
    const rng = opts.rng;

    const poangByKey = opts.poangByKey || null;   // #5: arbetsvärdering som krav-proxy
    const bandPct = opts.poangBandPct ?? 5;
    const golv = opts.aldersGolv ?? ALDERS_GOLV_DEFAULT;   // minsta jämförelseyrke för åldersjusteringen

    // k-tröskeln används bara för att RÄKNA små kvinnodominerade grupper i diagnostiken (de ingår ändå).
    const s1 = aggregeraOrgKvDom(data, kvinnoThr, opts.k ?? 10, definition);
    const s2 = klassificeraStatistik(statistik, nationellKlass, { definition, grans: kvinnoThr });
    // Filtret 'mansdominerade' begränsar jämförelsemängden innan paren byggs, så att reserven
    // till jämförelsestatistiken per BAS fungerar som förut när bara blandade egna yrken finns.
    if (jamforelse === 'mansdominerade') {
        s1.orgIckeKv = s1.orgIckeKv.filter(g => g.klass === 'mansdominerad');
        s2.statIckeKv = s2.statIckeKv.filter(g => g.klass === 'mansdominerad');
        for (const [bas, rader] of s2.statByBas) {
            const kvar = rader.filter(g => g.klass === 'mansdominerad');
            if (kvar.length) s2.statByBas.set(bas, kvar); else s2.statByBas.delete(bas);
        }
    }
    const internByBas = orgIckeKvByBas(s1.orgIckeKv);
    const s3 = (poangByKey && poangByKey.size)
        ? byggParPoäng(s1.orgKvDom, s1.orgIckeKv, poangByKey, { minGap, topN, B, rng, bandPct, golv })
        : byggPar(s1.orgKvDom, internByBas, s2.statByBas, { minGap, topN, B, rng, golv });
    const lagreKrav = (poangByKey && poangByKey.size) ? [] : byggParLagreKrav(s1.orgKvDom, s1.orgIckeKv, {
        rang: basRangFn([...s1.orgKvDom, ...s1.orgIckeKv].map(g => g.bas)),
        minGap, topN, B, rng });

    return {
        orgKvDom: s1.orgKvDom,
        orgIckeKv: s1.orgIckeKv,
        statIckeKv: s2.statIckeKv,
        pairs: s3.pairs,
        parAntal: s3.antal,   // alla par före topN-urvalet (ADR-61)
        lagreKrav,
        diagnostik: {
            organisation: {
                totalRader: data.length,
                antalAidxBas: s1.antalAidxBas,
                kvDomFunna: s1.orgKvDom.length,
                kvDomMedNLessThanK: s1.kvDomMedNLessThanK,
                ickeKvFunna: s1.orgIckeKv.length
            },
            statistik: {
                totalRader: statistik.length,
                klass: s2.klass,
                klassKalla: s2.klassKalla
            },
            jämförelse: s3.jämförelse,
            fel: []
        },
        opts: { kvinnoTrosholdPct: kvinnoThr, kvDomDefinition: definition, jamforelse, minGapPct: minGap, topN }
    };
}

// ---- Krav mot lön: en punkt per yrkesgrupp ----------------------------------
// Kraven är arbetsvärderingspoäng när en poängtabell är inläst, annars BAS-intervallets rang — samma krav-proxy som
// parbildningen. En grupp som saknar poäng i en inläst tabell placeras efter sitt BAS-intervall: medianpoängen för
// intervallets värderade grupper; tipset och noten säger det. Finns ingen värderad grupp i
// intervallet går gruppen inte att placera och namnges i noten.
// Bara grupper som når tröskeln: diagrammet visar gruppens medianlön. Linjen räknas ur de grupper som visas.
/**
 * @param {any[]} rader
 * @param {{k?: number, poangByKey?: Map<string, number>|null, definition?: string, grans?: number}} [opts] definition och
 *   grans: appens val av definitionen av kvinnodominerat (konsklass)
 */
function kravGrupper(rader, { k = 10, poangByKey = null, definition = 'do', grans = KVINNO_TROSKEL_DEFAULT } = {}) {
    const map = new Map();
    // Namnet ur texten på flest av gruppens rader (namnrader), som i resten av verktyget (ADR-89).
    const iGrupp = r => !!(r && String(r.aid || '').trim() && r.lon > 0 && r.bas);
    const namnrad = namnrader((rader || []).filter(iGrupp), r => String(r.aid).trim() + '|' + r.bas);
    for (const r of rader || []) {
        if (!iGrupp(r)) continue;
        const aid = String(r.aid).trim();
        const key = aid + '|' + r.bas, nr = namnrad.get(key);
        if (!map.has(key)) map.set(key, { aid, bas: r.bas, namn: nr.yrkeLabel || nr.yrke || aid, n: 0, nKv: 0, loner: [] });
        const g = map.get(key);
        g.n++; if (arKvinna(r)) g.nKv++; g.loner.push(r.lon);
    }
    const medPoang = !!(poangByKey && poangByKey.size);
    const alla = [...map.values()].filter(g => g.n >= k).map(g => {
        const andelKv = 100 * g.nKv / g.n;
        const poang = medPoang ? (poangByKey.get(g.aid + '|' + g.bas) ?? poangByKey.get(g.aid) ?? null) : null;
        return { aid: g.aid, bas: g.bas, namn: g.namn, n: g.n, andelKv, median: _median(g.loner), poang,
                 dominans: konsklass(andelKv, definition, grans) };   // den enda definitionen av kvinnodominerat (ADR-60)
    });
    if (!medPoang) return { medPoang, grupper: alla, utanPlats: [] };
    // Medianpoängen per BAS-intervall, ur de värderade grupper som visas.
    const perBas = new Map();
    for (const g of alla) if (g.poang != null) { if (!perBas.has(g.bas)) perBas.set(g.bas, []); perBas.get(g.bas).push(g.poang); }
    const grupper = [], utanPlats = [];
    for (const g of alla) {
        if (g.poang != null) grupper.push({ ...g, krav: g.poang });
        else if (perBas.has(g.bas)) grupper.push({ ...g, krav: _median(perBas.get(g.bas)), uppskattad: true });
        else utanPlats.push(g);
    }
    return { medPoang, grupper, utanPlats };
}

    return { computeLikvardighetPairs, basRangFn, bootstrapMedianer, arKvinnodominerad, konsklass, kravGrupper };
})();
const _lvComputePairs = __mirrorLikvardighet.computeLikvardighetPairs;
const _lvBasRangFn = __mirrorLikvardighet.basRangFn;
const _lvBootstrapMedianer = __mirrorLikvardighet.bootstrapMedianer;
const _arKvinnodominerad = __mirrorLikvardighet.arKvinnodominerad;
const _konsklass = __mirrorLikvardighet.konsklass;
const _lvKravGrupper = __mirrorLikvardighet.kravGrupper;

// ---- speglar src/lib/loneoversyn.js ----
const __mirrorForecast = (() => {
    // importer ur tidigare speglade lib-moduler
    const arKvinnodominerad = __mirrorLikvardighet.arKvinnodominerad;
    const periodkostnad = __mirrorKostnad.periodkostnad;
    const _medianStat = __mirrorStat.median;
    const _quantileStat = __mirrorStat.quantile;
    const arKvinna = __mirrorKon.arKvinna;
    const arMan = __mirrorKon.arMan;

// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
/**
 * Öppen lönekartläggning — Pure löneöversyns-/prognosfunktioner
 *
 * Budget-först-modell: en pott (kr eller % av lönesumman) fördelas GENERELLT
 * (till alla) + RIKTAT (till valda BAS→AID-grupper), och utfallet (nya löner,
 * budgetutnyttjande, råa lönegapet före/efter) beräknas.
 *
 * Separat från app.js för att kunna testas via Vitest utan DOM/state.
 * app.js får en AUTO-GENERERAD spegel (`_fc*` i src/app/09-lib-speglar.js via
 * tools/gen-mirrors.mjs) — ändra här och kör `npm run build:app`, rör ej spegeln
 * (vaktas av artefaktgrinden). Det oförklarade gapet (OLS) beräknas INTE
 * här — det körs i app.js mot simulerad data via data-swap, eftersom det kräver
 * regressionsmotorn. Här beräknas bara det rena (median-baserade) gapet; tröskelmålets
 * sökning (likalonslyftForMal) får appens skattning som argument.
 *
 * All matematik sker på ursprungslönerna: generellt och riktat summeras additivt
 * per individ, så fördelningen är ordningsoberoende och transparent.
 *
 * Bygger på: verktygets egen modell, docs/utveckling/loneoversynsmodellen.md. Beräkningarna står i docs/utveckling/berakningsregister.md.
 */





// Omslag: tål null/undefined som indata (0 för tom), vilket stat.js inte gör. Algoritmen finns bara i stat.js.
function _median(arr) { return arr && arr.length ? _medianStat(arr) : 0; }
function _quantile(arr, q) { return arr && arr.length ? _quantileStat(arr, q) : 0; }

/**
 * "Water-filling": höj de lägst betalda först. Hittar en gemensam nivå L (≤ cap)
 * och lyfter alla under L upp till L så långt potten räcker. Pengar som inte
 * får plats under cap lämnas oanvända (returneras implicit via summan av deltan).
 * @returns {number[]} delta per individ (samma ordning som lons)
 */
function _waterLevelDeltas(lons, pott, cap) {
    const n = lons.length;
    if (!n || pott <= 0) return new Array(n).fill(0);
    const c = (cap == null) ? Infinity : cap;
    const sorted = lons.slice().sort((a, b) => a - b);
    let L = sorted[0], used = 0;
    if (c <= L) return new Array(n).fill(0);   // taket ligger under lägsta lönen
    for (let i = 1; i <= n; i++) {
        const nextBreak = i < n ? sorted[i] : Infinity;
        const ceiling = Math.min(nextBreak, c);
        const k = i;                            // antal individer på/under L
        const seg = k * (ceiling - L);
        if (used + seg >= pott) { L += (pott - used) / k; used = pott; break; }
        used += seg; L = ceiling;
        if (c !== Infinity && L >= c) { L = c; break; }
    }
    return lons.map(x => (x < L ? L - x : 0));
}

/** Total månadslönesumma. */
function totalLonSum(rows) {
    return (rows || []).reduce((s, r) => s + (r.lon > 0 ? r.lon : 0), 0);
}

/**
 * Potten i kr/månad utifrån budgeten.
 * @param {Array} rows
 * @param {{mode:string, value:number|null}} budget
 */
function computePott(rows, budget) {
    if (!budget || budget.value == null || !isFinite(budget.value)) return 0;   // samma villkor som pottArAngiven
    if (budget.mode === 'kr') return Math.max(0, budget.value);
    return Math.max(0, totalLonSum(rows) * budget.value / 100);  // % av lönesumman
}

/**
 * Det råa (median-baserade) lönegapet kvinnor vs män, i procent.
 * @param {Array} rows
 * @param {(r:Object)=>number} getLon - väljer lönefältet (lon eller nyLon)
 * @returns {number|null}
 */
function rawGenderGap(rows, getLon) {
    const kv = [], ma = [];
    (rows || []).forEach(r => {
        const L = getLon(r);
        if (!(L > 0)) return;
        if (arKvinna(r)) kv.push(L);
        else if (arMan(r)) ma.push(L);
    });
    if (!kv.length || !ma.length) return null;
    return (_median(kv) / _median(ma) - 1) * 100;
}

/**
 * Raderna en riktad pott gäller: gruppen (BAS, eller BAS och AID), begränsad till ett kön (`kon`:
 * 'kvinna' | 'man', annars alla) och till löner under en gräns (`lonCap`, kr/mån, annars alla).
 * Samma urval som allocate() räknar på, så att gränssnittet kan visa hur många raden berör.
 * @param {Array} rows - individrader {bas, aid, kon, lon}
 * @param {{bas:string, aid:string, kon?:string, lonCap?:number|null}} t
 * @returns {number[]} index i rows
 */
function targetRows(rows, t) {
    const kon = t.kon === 'kvinna' || t.kon === 'man' ? t.kon : 'alla';
    const cap = t.lonCap != null && isFinite(t.lonCap) && t.lonCap > 0 ? t.lonCap : null;
    const konOk = r => kon === 'alla' || (kon === 'kvinna' ? arKvinna(r) : arMan(r));
    const ut = [];
    (rows || []).forEach((r, i) => {
        if (r.bas !== t.bas) return;
        if (t.aid !== '*' && r.aid !== t.aid) return;
        if (!konOk(r) || (cap != null && !(r.lon < cap))) return;
        ut.push(i);
    });
    return ut;
}

/**
 * Fördelar generellt + riktat påslag och returnerar nya löner per individ,
 * sammanställning per grupp och totaler.
 * @param {Array} rows - individrader {bas, aid, kon, lon}
 * @param {{mode:string, value:number|null}} generell - generellt påslag till alla (value null = 0)
 * @param {Array<{bas,aid,mode:'pct'|'kr'|'till',value,dist:'flat'|'lowest'|'target',targetLevel?:'median'|'p25',kon?:string,lonCap?:number|null}>} targets
 *   mode 'till' lyfter var och en i urvalet som ligger under beloppet upp till det (ingen pott att fördela).
 * @param {number} [roundStep=0] - avrunda nya löner till närmaste steg (kr), 0 = ingen avrundning
 */
function allocate(rows, generell, targets, roundStep) {
    const n = (rows || []).length;
    const genDeltas = new Array(n).fill(0);
    const g = generell || { mode: 'pct', value: 0 };
    const gVal = g.value != null && isFinite(g.value) ? g.value : 0;
    for (let i = 0; i < n; i++) {
        if (rows[i].lon <= 0) continue;
        genDeltas[i] = g.mode === 'kr' ? gVal : rows[i].lon * gVal / 100;
    }

    const tgtDeltas = new Array(n).fill(0);
    (targets || []).forEach(t => {
        // aid === '*' → hela BAS-intervallet (alla yrken i BAS:et); kön och lönegräns snävar in raden.
        const idxs = targetRows(rows, t);
        if (!idxs.length) return;
        const lons = idxs.map(i => rows[i].lon);
        if (t.mode === 'till') {
            const mal = isFinite(t.value) ? t.value : 0;
            idxs.forEach((i, j) => { if (lons[j] > 0 && lons[j] < mal) tgtDeltas[i] += mal - lons[j]; });
            return;
        }
        const groupSum = lons.reduce((s, x) => s + (x > 0 ? x : 0), 0);
        const pott = t.mode === 'kr' ? (isFinite(t.value) ? t.value : 0)
                                     : groupSum * (isFinite(t.value) ? t.value : 0) / 100;
        if (pott <= 0 || groupSum <= 0) return;
        let gd;
        if (t.dist === 'flat') {
            const frac = pott / groupSum;
            gd = lons.map(x => (x > 0 ? x * frac : 0));
        } else {
            const cap = t.dist === 'target'
                ? (t.targetLevel === 'p25' ? _quantile(lons, 0.25) : _median(lons))
                : Infinity;
            gd = _waterLevelDeltas(lons, pott, cap);
        }
        idxs.forEach((i, j) => { tgtDeltas[i] += gd[j]; });
    });

    // Avrundning till lönetrappa: bara för individer som faktiskt får påslag
    // (delta > 0), och aldrig under ursprungslönen.
    const step = (roundStep && roundStep > 0) ? roundStep : 0;
    const perPerson = rows.map((r, i) => {
        let delta = genDeltas[i] + tgtDeltas[i];
        if (step > 0 && delta > 0) {
            const rounded = Math.round((r.lon + delta) / step) * step;
            delta = Math.max(0, rounded - r.lon);
        }
        return { bas: r.bas, aid: r.aid, kon: r.kon, lon: r.lon, nyLon: r.lon + delta, delta };
    });

    // Sammanställning per grupp
    const groups = new Map();
    perPerson.forEach(p => {
        const k = p.bas + '|' + p.aid;
        let gr = groups.get(k);
        if (!gr) { gr = { bas: p.bas, aid: p.aid, oldL: [], newL: [], kvN: 0, n: 0, cost: 0 }; groups.set(k, gr); }
        gr.oldL.push(p.lon); gr.newL.push(p.nyLon);
        gr.cost += p.delta; gr.n++;
        if (arKvinna(p)) gr.kvN++;
    });
    const perGroup = [...groups.values()].map(gr => ({
        bas: gr.bas, aid: gr.aid, n: gr.n, kvN: gr.kvN,
        andelKv: gr.n ? 100 * gr.kvN / gr.n : 0,
        gammalMedian: _median(gr.oldL), nyMedian: _median(gr.newL),
        kostnad: gr.cost
    }));

    // generell/riktad-split speglar avsikten (oavrundat); totalRaise speglar
    // det faktiska, ev. avrundade, utfallet (summan av perPerson-deltan).
    const generellCost = genDeltas.reduce((s, x) => s + x, 0);
    const riktadCost = tgtDeltas.reduce((s, x) => s + x, 0);
    const totalRaise = perPerson.reduce((s, p) => s + p.delta, 0);
    return { perPerson, perGroup, totals: { generellCost, riktadCost, totalRaise } };
}

/**
 * Ett kandidatpar per kvinnodominerat yrke (BAS-intervall och AID): det med störst skillnad i kronor (ADR-69).
 * Ett yrke med flera jämförelseyrken får då en rad och en pott i förslagen, inte en per jämförelseyrke. Anroparen
 * har redan tagit bort paren som inte får redovisas, så att valet görs bland dem som når tröskeln. Ordningen och
 * objekten är desamma som i indata.
 * @template {{bas: any, aid: any, gapKr: number}} T
 * @param {T[]} [candidates]
 * @returns {T[]}
 */
function ettParPerYrke(candidates) {
    /** @type {Map<string, T>} */
    const bast = new Map();
    for (const c of candidates || []) {
        const nyckel = c.bas + '|' + c.aid;
        const forra = bast.get(nyckel);
        if (!forra || c.gapKr > forra.gapKr) bast.set(nyckel, c);
    }
    const valda = new Set(bast.values());
    return (candidates || []).filter(c => valda.has(c));
}

/**
 * Föreslår en riktad fördelning som minskar de osakliga gapen först. Fördelar
 * riktadPott proportionellt mot påverkansindex (gapKr × n), kapat vid kostnaden
 * att helt stänga respektive grupps gap. Ett par per yrke (ettParPerYrke).
 * @param {Array<{bas,aid,gapKr:number,n:number}>} candidates - gapKr > 0 = under referens (kr/mån/person)
 * @param {number} riktadPott
 * @param {number} [minN=0] - rikta endast mot grupper med minst minN personer
 */
function suggestTargets(candidates, riktadPott, minN = 0) {
    const valid = ettParPerYrke(candidates).filter(c => c.gapKr > 0 && c.n > 0 && c.n >= (minN || 0));
    if (!valid.length || riktadPott <= 0) return [];
    const totalIndex = valid.reduce((s, c) => s + c.gapKr * c.n, 0);
    if (totalIndex <= 0) return [];
    return valid.map(c => {
        const share = (c.gapKr * c.n) / totalIndex;
        const want = c.gapKr * c.n;                  // kostnad att helt stänga (kr/mån)
        const alloc = Math.min(want, riktadPott * share);
        return { bas: c.bas, aid: c.aid, mode: 'kr', value: Math.round(alloc), dist: 'lowest' };
    }).filter(t => t.value > 0);
}

/**
 * Mål-läge: bygg riktade rader som stänger en andel (fraction) av de osakliga
 * gapen. Kostnaden för att helt stänga en grupps gap är gapKr × n; för andelen
 * f blir det f × gapKr × n. Fördelas lägst-först inom gruppen. Ett par per yrke (ettParPerYrke), också i
 * känslighetskurvan, som bygger på den här funktionen.
 * @param {Array<{bas,aid,gapKr:number,n:number}>} candidates
 * @param {number} fraction - 0..1
 * @param {number} [minN=0]
 */
function closureTargets(candidates, fraction, minN = 0) {
    const f = Math.max(0, Math.min(1, fraction));
    if (f <= 0) return [];
    return ettParPerYrke(candidates)
        .filter(c => c.gapKr > 0 && c.n > 0 && c.n >= (minN || 0))
        .map(c => ({ bas: c.bas, aid: c.aid, mode: /** @type {'kr'} */ ('kr'), value: Math.round(f * c.gapKr * c.n), dist: /** @type {'lowest'} */ ('lowest') }))
        .filter(t => t.value > 0);
}

/**
 * Stegvis plan: rampa fördelningen linjärt över N år (1/N per år) och beräkna
 * ackumulerad kostnad och råa lönegapet vid varje år. Stödjer DiskrL 3:11
 * ("senast inom tre år"). perPerson kommer från allocate (har delta + lon + kon).
 * @returns {Array<{year,andelPct,kumRaise,kumKostnad,rawGap}>}
 */
function stagedPlan(rows, perPerson, years, costOpts) {
    const N = Math.max(1, Math.min(5, Math.round(years) || 1));
    const out = [];
    for (let k = 1; k <= N; k++) {
        const frac = k / N;
        const simRows = perPerson.map((p, i) => ({ kon: rows[i].kon, lon: rows[i].lon + p.delta * frac }));
        const kumRaise = perPerson.reduce((s, p) => s + p.delta * frac, 0);
        out.push({
            year: k, andelPct: 100 * frac, kumRaise,
            kumKostnad: periodkostnad(kumRaise, costOpts),
            rawGap: rawGenderGap(simRows, r => r.lon)
        });
    }
    return out;
}

/**
 * Sammanställning per BAS→AID-grupp (för kriteriebaserad riktning).
 * @returns {Array<{bas,aid,n,kvN,andelKv,median}>}
 */
function summarizeGroups(rows) {
    const m = new Map();
    (rows || []).forEach(r => {
        const k = r.bas + '|' + r.aid;
        let g = m.get(k);
        if (!g) { g = { bas: r.bas, aid: r.aid, lons: [], kvN: 0, n: 0 }; m.set(k, g); }
        g.lons.push(r.lon); g.n++;
        if (arKvinna(r)) g.kvN++;
    });
    return [...m.values()].map(g => ({
        bas: g.bas, aid: g.aid, n: g.n, kvN: g.kvN,
        andelKv: g.n ? 100 * g.kvN / g.n : 0, median: _median(g.lons)
    }));
}

/**
 * Leapfrog-/spillover-detektering: hittar grupper som efter påslaget passerar
 * (går om) en grupp som tidigare hade högre median — vilket kan skapa ny
 * skevhet. Jämför på gruppmedianer (perGroup från allocate).
 * @returns {Array<{bas:string, aid:string, overBas:string, overAid:string, gammalA:number, nyA:number, gammalB:number, nyB:number}>}
 */
function detectLeapfrog(perGroup) {
    const g = (perGroup || []).filter(x => x.n > 0);
    const out = [];
    for (let i = 0; i < g.length; i++) {
        for (let j = 0; j < g.length; j++) {
            if (i === j) continue;
            if (g[i].gammalMedian < g[j].gammalMedian - 1e-6 && g[i].nyMedian > g[j].nyMedian + 1e-6) {
                out.push({
                    bas: g[i].bas, aid: g[i].aid, overBas: g[j].bas, overAid: g[j].aid,
                    gammalA: g[i].gammalMedian, nyA: g[i].nyMedian,
                    gammalB: g[j].gammalMedian, nyB: g[j].nyMedian
                });
            }
        }
    }
    return out;
}

/**
 * Sant när budgeten har ett belopp eller en procentsats; ett tomt fält (value null) är ingen angiven pott.
 * @param {{mode?:string, value:number|null}|null|undefined} budget
 */
function pottArAngiven(budget) {
    return !!budget && budget.value != null && isFinite(budget.value);
}

/**
 * Hela prognosutfallet: pott, budgetutnyttjande, total kostnad (inkl. PO + period)
 * och råa lönegapet före/efter. Det OFÖRKLARADE gapet (OLS) beräknas i app.js.
 * Utan angiven pott (pottAngiven false) är pott 0, kvar null och overBudget falskt: det finns ingen pott att
 * överskrida. En angiven pott på 0 kr flaggas som vanligt när något fördelas.
 * @param {Array} rows
 * @param {{mode:string, value:number|null}} budget
 * @param {{mode:string, value:number|null}} generell
 * @param {Array} targets
 * @param {{months?:number, poPct?:number, roundStep?:number, kvThreshold?:number, kvDefinition?:string}} [costOpts]
 *   kvThreshold och kvDefinition: samma definition av kvinnodominerat som likvärdighetsanalysen (ADR-60).
 */
function forecastOutcome(rows, budget, generell, targets, costOpts) {
    const pott = computePott(rows, budget);
    const alloc = allocate(rows, generell, targets, costOpts && costOpts.roundStep);
    const totalRaise = alloc.totals.totalRaise;
    // Gränsen för kvinnodominerat: saknas den gäller arKvinnodominerads standard, KVINNO_TROSKEL_DEFAULT i
    // likvardighet.js (spegeln exponerar bara funktioner, så konstanten importeras inte hit). 0 är en gräns, inte en som saknas.
    const kvThreshold = costOpts?.kvThreshold ?? undefined;
    const lonsummaFore = totalLonSum(rows);
    // Hur mycket av påslaget går till kvinnodominerade grupper (jämställdhetsandel)
    const kvDefinition = (costOpts && costOpts.kvDefinition) || 'do';
    const equityCost = alloc.perGroup.reduce((s, g) => s + (arKvinnodominerad(g.andelKv, kvDefinition, kvThreshold) ? g.kostnad : 0), 0);
    const pottAngiven = pottArAngiven(budget);
    return {
        pott,
        pottAngiven,
        använt: totalRaise,
        kvar: pottAngiven ? pott - totalRaise : null,
        overBudget: pottAngiven && totalRaise > pott + 1e-6,
        totalKostnad: periodkostnad(totalRaise, costOpts),
        lonsummaFore,
        lonsummaEfter: lonsummaFore + totalRaise,
        rawGapFore: rawGenderGap(rows, r => r.lon),
        rawGapEfter: rawGenderGap(alloc.perPerson, p => p.nyLon),
        generellCost: alloc.totals.generellCost,
        riktadCost: alloc.totals.riktadCost,
        equityCost,
        leapfrog: detectLeapfrog(alloc.perGroup),
        alloc
    };
}

// ===================================================================
// Lönespann/compa-ratio, individnivå-remediation,
// marknadspositionering, budgetkänslighet.
// ===================================================================

/**
 * (A) Lönespann per BAS: P25 / median / P75. compa-ratio och range-penetration
 * beräknas mot detta i UI.
 * @returns {Array<{bas,n,p25,median,p75}>}
 */
function bandStats(rows) {
    const m = new Map();
    (rows || []).forEach(r => {
        if (!(r.lon > 0)) return;
        if (!m.has(r.bas)) m.set(r.bas, []);
        m.get(r.bas).push(r.lon);
    });
    return [...m.entries()].map(([bas, lons]) => ({
        bas, n: lons.length,
        p25: _quantile(lons, 0.25), median: _median(lons), p75: _quantile(lons, 0.75)
    })).sort((a, b) => (a.bas < b.bas ? -1 : a.bas > b.bas ? 1 : 0));
}

/**
 * (B) Individnivå-remediation (DiskrL 3:9 — lika arbete): flaggar kvinnor som
 * är betalda mer än `gapPct` % under sitt likalöne-benchmark (mäns median i
 * samma BAS×AID, fallback mäns median i BAS) och beräknar kostnaden att lyfta
 * dem till benchmark. Endast aggregat returneras för visning; `flagged` används
 * internt för seeding och summeras per grupp.
 *
 * `minMen` är minsta antal män bakom ett benchmark. Appen skickar alltid gällande k-tröskel:
 * mot en enda mans lön vore "kostnaden att lyfta" en kvinna hans lön minus hennes.
 * Standardvärdet 1 finns för enhetstesterna.
 * @param {Array} rows
 * @param {{gapPct?:number, minMen?:number}} opts
 */
function individualRemediation(rows, opts) {
    const o = opts || {};
    const trigger = (o.gapPct != null ? o.gapPct : 5) / 100;
    const minMen = o.minMen || 1;
    const menByGroup = new Map(), menByBas = new Map();
    (rows || []).forEach(r => {
        if (!(r.lon > 0)) return;
        if (!arMan(r)) return;
        const gk = r.bas + '|' + r.aid;
        if (!menByGroup.has(gk)) menByGroup.set(gk, []);
        menByGroup.get(gk).push(r.lon);
        if (!menByBas.has(r.bas)) menByBas.set(r.bas, []);
        menByBas.get(r.bas).push(r.lon);
    });
    const benchFor = (bas, aid) => {
        const g = menByGroup.get(bas + '|' + aid);
        if (g && g.length >= minMen) return { v: _median(g), kalla: 'yrke' };
        const b = menByBas.get(bas);
        if (b && b.length >= minMen) return { v: _median(b), kalla: 'bas' };
        return null;
    };
    const flagged = [];
    (rows || []).forEach(r => {
        if (!(r.lon > 0)) return;
        if (!arKvinna(r)) return;
        const bench = benchFor(r.bas, r.aid);
        if (!bench) return;
        if (r.lon < bench.v * (1 - trigger)) {
            flagged.push({ bas: r.bas, aid: r.aid, lon: r.lon, benchmark: bench.v, kalla: bench.kalla, shortfall: bench.v - r.lon });
        }
    });
    const byGroup = new Map();
    flagged.forEach(f => {
        const k = f.bas + '|' + f.aid;
        let g = byGroup.get(k);
        if (!g) { g = { bas: f.bas, aid: f.aid, count: 0, cost: 0 }; byGroup.set(k, g); }
        g.count++; g.cost += f.shortfall;
    });
    return {
        flagged, count: flagged.length,
        totalCost: flagged.reduce((s, f) => s + f.shortfall, 0),
        perGroup: [...byGroup.values()].sort((a, b) => b.cost - a.cost)
    };
}

/**
 * (E) Marknadspositionering: bygg riktade rader som lyfter grupper vars median
 * ligger under marknad × factor, mot den nivån.
 * @param {Array<{bas,aid,n,median}>} groups - från summarizeGroups
 * @param {Map<string,number>} marketByKey - nyckel "aid|bas" eller "aid" → marknadsmedian
 * @param {number} factor - andel av marknadsmedian att nå (t.ex. 0.95)
 * @param {number} [minN=0]
 */
function marketTargets(groups, marketByKey, factor, minN) {
    const f = factor > 0 ? factor : 1;
    const out = [];
    (groups || []).forEach(g => {
        if (g.n < (minN || 0)) return;
        let mk = marketByKey.get(g.aid + '|' + g.bas);
        if (mk == null) mk = marketByKey.get(g.aid);
        if (mk == null || !(mk > 0)) return;
        const target = mk * f;
        if (g.median < target) {
            out.push({ bas: g.bas, aid: g.aid, mode: 'kr', value: Math.round((target - g.median) * g.n), dist: 'lowest', pool: 'marknad' });
        }
    });
    return out;
}

/**
 * (F) Budgetkänslighet: svep §3:10-stängning 0→100 % och returnera kostnad +
 * råa lönegapet för varje steg (avtagande avkastning).
 * @returns {Array<{fraction,kostnad,rawGap}>}
 */
function sensitivityCurve(rows, candidates, costOpts, steps) {
    const S = steps || 10;
    const out = [];
    for (let i = 0; i <= S; i++) {
        const frac = i / S;
        const targets = closureTargets(candidates, frac, 0);
        const alloc = allocate(rows, { mode: 'pct', value: 0 }, targets, costOpts && costOpts.roundStep);
        out.push({
            fraction: frac,
            kostnad: periodkostnad(alloc.totals.totalRaise, costOpts),
            rawGap: rawGenderGap(alloc.perPerson, p => p.nyLon)
        });
    }
    return out;
}

/** Tröskelmålets standardmål: en oförklarad skillnad på högst 5 %. */
const TROSKELMAL_STANDARD_PCT = 5;
/** Det största lyft i procent som tröskelmålet prövar; krävs mer redovisas det som utom räckhåll. */
const TROSKELMAL_MAX_LYFT_PCT = 40;
/** Antalet halveringar i sökningen: intervallet 0–40 % krymper till 40 / 2^22, under 0,00001 procentenheter. */
const TROSKELMAL_VARV = 22;
/** Signifikansgränsen i läget "inte signifikant": målet är nått när p-värdet är över den (eller saknas). */
const TROSKELMAL_SIGNIFIKANS_P = 0.05;

/** Tröskelmålets konstanter, för appen (spegeln exponerar bara funktioner). */
function troskelmalKonstanter() {
    return { STANDARD_PCT: TROSKELMAL_STANDARD_PCT, MAX_LYFT_PCT: TROSKELMAL_MAX_LYFT_PCT,
             VARV: TROSKELMAL_VARV, SIGNIFIKANS_P: TROSKELMAL_SIGNIFIKANS_P };
}

/**
 * (C) Tröskelmål: det minsta jämna lyftet i procent till alla kvinnor som behövs för att den oförklarade skillnaden
 * ska nå målet, antingen högst `malPct` procent (skillnaden räknas som kvinnor mot män, negativ när kvinnor ligger
 * lägre) eller inte signifikant (p över TROSKELMAL_SIGNIFIKANS_P). Söks med bisektion i 0–TROSKELMAL_MAX_LYFT_PCT %
 * i TROSKELMAL_VARV varv; svaret är intervallets övre gräns, där målet är nått.
 *
 * Regressionen körs inte här: `skatta(rader)` är appens skattning (huvudregressionen på de givna raderna) och
 * returnerar `{ konPct, pValue }`, med `konPct` null när den inte går att skatta. Kostnaden per månad är summan av
 * kvinnornas lön gånger lyftet, utan påslag; kostnaden över perioden räknar appen.
 * @param {any[]} rader lönefilens rader ({lon, kon, …})
 * @param {{malPct?: number, signifikans?: boolean,
 *   skatta: (rader: any[]) => {konPct: number|null, pValue: number|null}}} opts
 * @returns {{status: 'ingenSkattning'|'redan'|'utomRackhall'|'hittat',
 *   utgangslage: {konPct: number|null, pValue: number|null},
 *   lyftPct?: number, kostnadPerManad?: number, resultat?: {konPct: number|null, pValue: number|null}}}
 *   ingenSkattning: regressionen går inte att skatta på raderna; redan: målet är redan nått; utomRackhall: inte ens
 *   TROSKELMAL_MAX_LYFT_PCT % räcker; hittat: lyftPct, kostnadPerManad och skattningen efter lyftet (resultat)
 */
function likalonslyftForMal(rader, { malPct = TROSKELMAL_STANDARD_PCT, signifikans = false, skatta }) {
    const kvinnor = rader.filter(arKvinna);
    const utgangslage = skatta(rader);
    if (utgangslage.konPct == null) return { status: 'ingenSkattning', utgangslage };
    const okFor = g => signifikans ? (g.pValue == null || g.pValue > TROSKELMAL_SIGNIFIKANS_P) : (g.konPct != null && g.konPct >= -malPct);
    const medLyft = x => {
        const sim = rader.map(r => arKvinna(r) ? { ...r, lon: r.lon * (1 + x / 100) } : r);
        const g = skatta(sim);
        return { konPct: g.konPct, pValue: g.pValue, kostnad: kvinnor.reduce((s, r) => s + r.lon * x / 100, 0) };
    };
    if (okFor(utgangslage)) return { status: 'redan', utgangslage };
    let lo = 0, hi = TROSKELMAL_MAX_LYFT_PCT;
    if (!okFor(medLyft(hi))) return { status: 'utomRackhall', utgangslage };
    for (let varv = 0; varv < TROSKELMAL_VARV; varv++) { const mitt = (lo + hi) / 2; if (okFor(medLyft(mitt))) hi = mitt; else lo = mitt; }
    const { konPct, pValue, kostnad } = medLyft(hi);
    return { status: 'hittat', utgangslage, lyftPct: hi, kostnadPerManad: kostnad, resultat: { konPct, pValue } };
}

    return { computePott, allocate, targetRows, suggestTargets, closureTargets, ettParPerYrke, stagedPlan, summarizeGroups, detectLeapfrog, forecastOutcome, bandStats, individualRemediation, marketTargets, sensitivityCurve, likalonslyftForMal, troskelmalKonstanter, _median };
})();
const _fcComputePott = __mirrorForecast.computePott;
const _fcAllocate = __mirrorForecast.allocate;
const _fcTargetRows = __mirrorForecast.targetRows;
const _fcSuggestTargets = __mirrorForecast.suggestTargets;
const _fcClosureTargets = __mirrorForecast.closureTargets;
const _fcEttParPerYrke = __mirrorForecast.ettParPerYrke;
const _fcStagedPlan = __mirrorForecast.stagedPlan;
const _fcSummarizeGroups = __mirrorForecast.summarizeGroups;
const _fcDetectLeapfrog = __mirrorForecast.detectLeapfrog;
const _fcForecastOutcome = __mirrorForecast.forecastOutcome;
const _fcBandStats = __mirrorForecast.bandStats;
const _fcIndividualRemediation = __mirrorForecast.individualRemediation;
const _fcMarketTargets = __mirrorForecast.marketTargets;
const _fcSensitivityCurve = __mirrorForecast.sensitivityCurve;
const _fcLyftForMal = __mirrorForecast.likalonslyftForMal;
const _fcTroskelmalKonstanter = __mirrorForecast.troskelmalKonstanter;
const _fcMedian = __mirrorForecast._median;

// ---- speglar src/lib/aidbas.js ----
const __mirrorAidbas = (() => {
    // importer ur tidigare speglade lib-moduler
    const median = __mirrorStat.median;
    const quantile = __mirrorStat.quantile;
    const basRangFn = __mirrorLikvardighet.basRangFn;
    const konsklass = __mirrorLikvardighet.konsklass;
    const arKvinna = __mirrorKon.arKvinna;
    const arMan = __mirrorKon.arMan;
    const namnrader = __mirrorAid.namnrader;

// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
/**
 * Öppen lönekartläggning — Tabellerna per AID-kod och BAS-intervall
 *
 * Lika arbete är samma yrkesgrupp (AID-kod) på samma nivå (BAS-intervall). Här byggs de fyra tabeller som en
 * skriven lönekartläggning behöver på den nivån, ur varje persons egen rad:
 *
 *   1. Lika arbete AID x BAS — Lika arbetes grupper med status, i BAS-ordning (ADR-90)
 *   2. Likvärdigt arbete — grupperna per BAS-intervall med könsfördelning, klassning, median och lönespridning
 *   3. Hierarkisk jämförelse — ett arbete i lägre BAS som inte är kvinnodominerat men har högre median än ett
 *      kvinnodominerat arbete i högre BAS
 *   4. Analys på individnivå — grupperna där något kön är för litet för en könsuppdelad jämförelse
 *
 * I tabell 2–4 följer reglerna för små grupper med som parametrar: `k` är antalet per kön (och per grupp i tabell 2 och
 * 3) som krävs för ett lönemått, `golv` är antalet i gruppen som krävs för en egen rad; mindre grupper räknas upp i
 * `sma`. Tabell 1 har Lika arbetes grupper och regler (likaArbeteTabell).
 *
 * Klassningen av kvinnodominerat arbete har två definitioner, som heter efter lydelsen (ADR-72): *Mer än X %*
 * (nyckeln 'do') och *X % eller mer* (nyckeln 'scb'). Gränsen X är 60 % om inget annat anges. Mansdominerat
 * speglas; övriga är könsblandade.
 *
 * Ren modul utan DOM eller state. Webbläsarbygget får en AUTO-GENERERAD spegel i src/app/09-lib-speglar.js.
 */




/**
 * Definitionerna av kvinnodominerat arbete: nyckel → namn (valet i inställningarna) och text (tabellerna och
 * metodbladet). Namnen säger lydelsen, inte en avsändare (ADR-72). Nycklarna 'do' och 'scb' är historiska och står
 * kvar, så att sparade konfigurationsfiler (`likvardighet.kvDomDefinition`) fortsätter att läsas.
 */
const KV_DEFINITIONER = Object.freeze({
    do: Object.freeze({ namn: 'Mer än {grans} %', text: 'mer än {grans} % kvinnor' }),
    scb: Object.freeze({ namn: '{grans} % eller mer', text: '{grans} % kvinnor eller mer' })
});
const KV_GRANS_STANDARD = 60;

const KLASS_KV = 'Kvinnodominerad', KLASS_MA = 'Mansdominerad', KLASS_BLANDAD = 'Könsblandad';
const INGA_HIERARKISKA_PAR = 'Inga fall där ett arbete med lägre krav, som inte är kvinnodominerat, har högre lön än ett kvinnodominerat arbete med högre krav.';

/** Definitionens namn, med gränsen insatt: "Mer än 60 %" eller "60 % eller mer". */
function kvDefinitionNamn(definition, grans = KV_GRANS_STANDARD) {
    return (KV_DEFINITIONER[definition] || KV_DEFINITIONER.do).namn.replace('{grans}', String(grans));
}
/** Klassernas namn, för den som jämför klassningen. */
function klassNamn() { return { kv: KLASS_KV, ma: KLASS_MA, blandad: KLASS_BLANDAD }; }
/** Texten när den hierarkiska jämförelsen inte har några par. */
function ingaParText() { return INGA_HIERARKISKA_PAR; }
/**
 * Texten för definitionen, med gränsen insatt: "mer än 60 % kvinnor" eller "60 % kvinnor eller mer".
 * @param {string} definition - 'do' eller 'scb'
 * @param {number|string} [grans] - gränsen, eller gränsen redan formaterad som text (rapportunderlaget, appen)
 */
function kvDefinitionText(definition, grans = KV_GRANS_STANDARD) {
    return (KV_DEFINITIONER[definition] || KV_DEFINITIONER.do).text.replace('{grans}', String(grans));
}

/**
 * Klassningen av en grupp efter andelen kvinnor.
 * @param {number|null} andelKv - procent kvinnor, eller null när andelen är okänd
 * @param {'do'|'scb'} [definition]
 * @param {number} [grans]
 * @returns {string} Kvinnodominerad, Mansdominerad, Könsblandad eller '' för okänd andel
 */
function dominans(andelKv, definition = 'do', grans = KV_GRANS_STANDARD) {
    // Samma definition som likvärdighetsanalysen (ADR-60): konsklass i likvardighet.js.
    const k = konsklass(andelKv, definition, grans);
    return k === 'kvinnodominerad' ? KLASS_KV : k === 'mansdominerad' ? KLASS_MA : k === 'blandad' ? KLASS_BLANDAD : '';
}

/**
 * Om en grupp med klassen `klass` är ett jämförelseyrke (ADR-60): alla som inte är kvinnodominerade, eller bara de
 * mansdominerade när filtret `jamforelse` är 'mansdominerade'. Samma mängd som kandidatparen i Likvärdigt arbete.
 * @param {string} klass
 * @param {'alla'|'mansdominerade'|string} [jamforelse]
 */
function arJamforelseKlass(klass, jamforelse = 'alla') {
    if (!klass || klass === KLASS_KV) return false;
    return jamforelse === 'mansdominerade' ? klass === KLASS_MA : true;
}

const arKv = arKvinna;
const arMa = arMan;

/**
 * Grupperar raderna per AID-kod och BAS-intervall, hämtade ur varje persons egen rad. Rader utan lön, kön eller
 * BAS räknas inte. Rader utan AID-kod grupperas på yrkestexten.
 * @param {Array<{aid?:string, bas:string, kon:string, lon:number, yrke?:string, yrkeLabel?:string}>} rader
 * @returns {Array<{aid:string, bas:string, yrke:string, n:number, nKv:number, nMa:number, kvLoner:number[], maLoner:number[], loner:number[]}>}
 */
function grupperaAidBas(rader) {
    const map = new Map();
    // Gruppens namn ur texten på flest av dess rader (namnrader), som i resten av verktyget (ADR-89).
    const iGrupp = r => !!(r && r.bas && r.lon > 0 && (arKv(r) || arMa(r)) && String(r.aid || r.yrke || '').trim());
    const nyckelAv = r => `${String(r.aid || r.yrke || '').trim()}|${r.bas}`;
    const namn = namnrader((rader || []).filter(iGrupp), nyckelAv);
    for (const r of rader || []) {
        if (!iGrupp(r)) continue;
        const kv = arKv(r);
        const aid = String(r.aid || r.yrke || '').trim();
        const key = nyckelAv(r), nr = namn.get(key);
        if (!map.has(key)) map.set(key, { aid, bas: String(r.bas), yrke: String(nr.yrkeLabel || nr.yrke || aid), n: 0, nKv: 0, nMa: 0, kvLoner: [], maLoner: [], loner: [] });
        const g = map.get(key);
        g.n++;
        if (kv) { g.nKv++; g.kvLoner.push(r.lon); } else { g.nMa++; g.maLoner.push(r.lon); }
        g.loner.push(r.lon);
    }
    return [...map.values()];
}

/** Sorterar grupper: BAS-intervall stigande (bokstavsordningen), därefter antal fallande, därefter AID-kod. */
function sorteraGrupper(grupper) {
    const rang = basRangFn(grupper.map(g => g.bas));
    return [...grupper].sort((a, b) => rang(a.bas) - rang(b.bas) || b.n - a.n || String(a.aid).localeCompare(String(b.aid), 'sv'));
}

const litenRad = g => ({ bas: g.bas, aid: g.aid, yrke: g.yrke, n: g.n, nKv: g.nKv, nMa: g.nMa });
/** Delar grupperna i de som får en egen rad (minst `golv` personer) och de som räknas upp i noten. */
function _delaPaGolv(grupper, golv) {
    const sorterade = sorteraGrupper(grupper);
    return { rader: sorterade.filter(g => g.n >= golv), sma: sorterade.filter(g => g.n < golv).map(litenRad) };
}

/**
 * Tabell 1 — Lika arbete AID x BAS: Lika arbetes grupper och status i BAS-ordning. Tabellen räknar ingenting eget:
 * den får resultatet av likaArbeteGrupper (src/lib/rapportunderlag.js), som anroparen räknar med verktygets tröskel,
 * så att den har samma grupper, samma k-regel och samma status som tabellen per AID-etikett och inte kan säga något
 * annat om samma grupp. En grupp där ett kön är under tröskeln står utan könsuppdelade mått (`samladMedian`); en grupp
 * som helt ligger under tröskeln får ingen rad utan står med namn i `utelamnade`; `ejJamforbara` är antalet grupper
 * med färre än två av något kön, som inte jämförs.
 * @param {{grupper?: any[], utelamnade?: string[], ejJamforbara?: string[]}|null} lika
 * @returns {{rader: Array<{bas:string, aid:string, yrke:string, n:number, nKv:number, nMa:number, medKv:number|null,
 *   medMa:number|null, kvot:number|null, lag:number|null, hog:number|null, niva:string, samladMedian:boolean}>,
 *   utelamnade: string[], ejJamforbara: number}}
 */
function likaArbeteTabell(lika) {
    const rader = sorteraGrupper(((lika && lika.grupper) || []).map(g => {
        const samlad = !!g.samladMedian;
        return { bas: String(g.bas ?? ''), aid: String(g.aid ?? ''), yrke: String(g.etikett ?? g.yrke ?? ''), n: g.tot, nKv: g.nKv, nMa: g.nMa,
            medKv: samlad ? null : g.medKv, medMa: samlad ? null : g.medMa, kvot: samlad || !(g.kvot > 0) ? null : g.kvot * 100,
            lag: samlad ? null : (g.lag ?? null), hog: samlad ? null : (g.hog ?? null), niva: String(g.niva), samladMedian: samlad };
    }));
    return { rader, utelamnade: [...((lika && lika.utelamnade) || [])], ejJamforbara: ((lika && lika.ejJamforbara) || []).length };
}

/**
 * Tabell 2 — Likvärdigt arbete: grupperna per BAS-intervall med könsfördelning och klassning, och sammanfattningen
 * per intervall där det finns både kvinnodominerade grupper och andra grupper med median.
 * @param {Array} rader
 * @param {{k?:number, golv?:number, definition?:'do'|'scb', grans?:number, jamforelse?:'alla'|'mansdominerade', nationell?: ((aid:string) => (number|null))|null}} val
 *   `nationell` ger andelen kvinnor nationellt för en AID-kod (procent), eller null när den saknas.
 *   `jamforelse` avgör vilka grupper som räknas som övriga i sammanfattningen (ADR-60).
 */
function likvardigtTabell(rader, { k = 10, golv = 5, definition = 'do', grans = KV_GRANS_STANDARD, jamforelse = 'alla', nationell = null } = {}) {
    const { rader: grupper, sma } = _delaPaGolv(grupperaAidBas(rader), golv);
    const ut = grupper.map(g => {
        const andelKv = g.nKv / g.n * 100;
        const nat = typeof nationell === 'function' ? nationell(g.aid) : null;
        const andelKvNat = typeof nat === 'number' && isFinite(nat) ? nat : null;
        const stor = g.n >= k;
        const med = stor ? median(g.loner) : null, p10 = stor ? quantile(g.loner, 0.1) : null, p90 = stor ? quantile(g.loner, 0.9) : null;
        const spridning = med != null && p10 != null && p90 != null && med > 0 ? (p90 - p10) / med : null;
        return { bas: g.bas, aid: g.aid, yrke: g.yrke, n: g.n, nKv: g.nKv, nMa: g.nMa, andelKv, andelKvNat,
                 klass: dominans(andelKv, definition, grans),
                 brukar: andelKvNat == null ? '' : dominans(andelKvNat, definition, grans) === KLASS_KV ? 'Ja' : 'Nej',
                 median: med, p10, p90, spridning };
    });
    // Sammanfattningen: högsta och lägsta median bland de kvinnodominerade och bland övriga, per BAS-intervall.
    const sammanfattning = [];
    for (const bas of [...new Set(ut.map(r => r.bas))]) {
        const medMedian = ut.filter(r => r.bas === bas && r.median != null);
        const kvDom = medMedian.filter(r => r.klass === KLASS_KV).map(r => /** @type {number} */ (r.median)), ovriga = medMedian.filter(r => arJamforelseKlass(r.klass, jamforelse)).map(r => /** @type {number} */ (r.median));
        if (!kvDom.length || !ovriga.length) continue;
        const kvHogst = Math.max(...kvDom), ovHogst = Math.max(...ovriga);
        sammanfattning.push({ bas, antalKvDom: kvDom.length, antalOvriga: ovriga.length,
            kvDom: { hogst: kvHogst, lagst: Math.min(...kvDom) }, ovriga: { hogst: ovHogst, lagst: Math.min(...ovriga) },
            skillnadKr: ovHogst - kvHogst, skillnadPct: kvHogst > 0 ? (ovHogst / kvHogst - 1) * 100 : null });
    }
    return { rader: ut, sma, sammanfattning, definition, grans, jamforelse };
}

/**
 * Tabell 3 — Hierarkisk jämförelse: par (A, B) där A inte är kvinnodominerad, B är kvinnodominerad, A har lägre
 * BAS-intervall än B och A har högre median än B. Båda grupperna har minst k personer. Sorterat på skillnaden, störst först.
 * @param {Array} rader
 * A är ett jämförelseyrke enligt `jamforelse` (ADR-60): standard alla som inte är kvinnodominerade.
 * @param {{k?:number, definition?:'do'|'scb', grans?:number, jamforelse?:'alla'|'mansdominerade'}} val
 */
function hierarkiskaPar(rader, { k = 10, definition = 'do', grans = KV_GRANS_STANDARD, jamforelse = 'alla' } = {}) {
    const grupper = grupperaAidBas(rader).filter(g => g.n >= k)
        .map(g => ({ aid: g.aid, bas: g.bas, yrke: g.yrke, n: g.n, median: median(g.loner), klass: dominans(g.nKv / g.n * 100, definition, grans) }));
    const rang = basRangFn(grupper.map(g => g.bas));
    const par = [];
    for (const a of grupper.filter(g => arJamforelseKlass(g.klass, jamforelse))) {
        for (const b of grupper.filter(g => g.klass === KLASS_KV)) {
            if (rang(a.bas) < rang(b.bas) && a.median > b.median) {
                par.push({ a, b, skillnadKr: a.median - b.median, skillnadPct: b.median > 0 ? (a.median / b.median - 1) * 100 : null });
            }
        }
    }
    return par.sort((x, y) => y.skillnadKr - x.skillnadKr || rang(x.a.bas) - rang(y.a.bas) || String(x.a.aid).localeCompare(String(y.a.aid), 'sv'));
}

/**
 * Tabell 4 — Analys på individnivå: grupperna där något kön har färre än k personer. Inga löner.
 * @param {Array} rader
 * @param {{k?:number, golv?:number}} val
 */
function individnivaTabell(rader, { k = 10, golv = 5 } = {}) {
    const { rader: grupper, sma } = _delaPaGolv(grupperaAidBas(rader).filter(g => g.nKv < k || g.nMa < k), golv);
    return { rader: grupper.map(litenRad), sma };
}

    return { likaArbeteTabell, likvardigtTabell, hierarkiskaPar, individnivaTabell, kvDefinitionText, kvDefinitionNamn, dominans, ingaParText, klassNamn };
})();
const _aidbasLika = __mirrorAidbas.likaArbeteTabell;
const _aidbasLikvardigt = __mirrorAidbas.likvardigtTabell;
const _aidbasPar = __mirrorAidbas.hierarkiskaPar;
const _aidbasIndivid = __mirrorAidbas.individnivaTabell;
const _aidbasDefinitionText = __mirrorAidbas.kvDefinitionText;
const _aidbasDefinitionNamn = __mirrorAidbas.kvDefinitionNamn;
const _aidbasDominans = __mirrorAidbas.dominans;
const _aidbasIngaParText = __mirrorAidbas.ingaParText;
const _aidbasKlassNamn = __mirrorAidbas.klassNamn;

// ---- speglar src/lib/regression.js ----
const __mirrorRegression = (() => {
    // importer ur tidigare speglade lib-moduler
    const fitOLS = __mirrorStat.fitOLS;
    const invert = __mirrorStat.invert;
    const matMul = __mirrorStat.matMul;
    const median = __mirrorStat.median;
    const pValue2Sided = __mirrorStat.pValue2Sided;
    const tQuantile = __mirrorStat.tQuantile;
    const skapaTermer = __mirrorTermer.skapaTermer;
    const fyllTermer = __mirrorTermer.fyllTermer;
    const ordForAntal = __mirrorTermer.ordForAntal;
    const stor = __mirrorTermer.stor;
    const personOrd = __mirrorNamn.personOrd;
    const arKvinna = __mirrorKon.arKvinna;
    const arMan = __mirrorKon.arMan;

// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
/**
 * Öppen lönekartläggning — Regressionsmodeller för lika arbete
 *
 * Rena, testbara modeller: huvudregressionen (verktygets huvudtal, den justerade
 * löneskillnaden), OLS-baserad kollinearitetsdiagnos, gap per BAS
 * (betingade regressioner), sekventiell dekomponering med BAS-indikatorer och
 * yrkesgrupp inom BAS, kvantilregression (IRLS) samt Blinder-Oaxaca-
 * dekomposition. Modellerna tar allt de behöver som parametrar (rader, listor,
 * statGolv-värdet, den inställda tröskeln och förklaringsmodellen) och läser inget
 * globalt tillstånd.
 *
 * Appen får dem genom lib-speglarna (ADR-8); src/app/50-regressionsmodeller.js
 * och runOLSRegression i 51-lika-arbete-regressionskort.js är de tunna adaptrarna
 * som läser getData(), statGolv() och resten av tillståndet. OLS-kärnan
 * (fitOLS, invert, matMul, pValue2Sided, tQuantile) ligger i stat.js. Ingen modell här
 * räknar BAS som ett tal; BAS-rangen (basRangFn) finns kvar i likvardighet.js för Lägre krav.
 *
 * @see 50-regressionsmodeller.js (adaptern i appen)
 */





/** Standardtermerna (ADR-74); skapaTermer() utan egna termer ger standarduppsättningen. */
const T = skapaTermer();

// Stegens namn i den sekventiella dekomponeringen är nycklar: kortet, rapporten, exporten och testerna slår upp stegen
// på dem, så de står kvar oförändrade. Det som visas för ett steg kommer ur termerna (stegEtikett, ADR-74).
const STEG_BAS = '+ BAS-intervall';
const STEG_YRKE = '+ Yrkesgrupp';
/** Stegets namn som det visas: STEG_YRKE blir "+ AID-etikett inom BAS", STEG_BAS "+ BAS-intervall"; övriga som de är. */
function stegEtikett(namn) {
    if (namn === STEG_YRKE) return `+ ${T.enhet.en} inom BAS`;
    if (namn === STEG_BAS) return `+ ${T.niva.en}`;
    return namn;
}
/**
 * Nyckeln för stegets namn per variabel, för appen som slår upp stegen på den.
 * @param {'bas'|'yrkesgrupp'} variabel
 * @returns {string}
 */
function stegNamn(variabel) {
    return variabel === 'bas' ? STEG_BAS : STEG_YRKE;
}

// ---- Förklaringsmodellen som värde (ADR-56) ----
// Vilka variabler huvudregressionen, trappan och Blinder-Oaxaca räknar bort utöver kön. Standard är ADR-44/46/53-modellen:
// BAS-intervall och ålder, utan yrkesgrupp. Lagras i appen som null när den är standard (12-tillstand.js).
const FORKLARINGSMODELL_STANDARD = Object.freeze({ bas: true, alder: true, yrkesgrupp: false, skal: '' });
/** Under så många procentenheter i förklaringsgrad (R²) räknas en variabel som "tillför lite" (beslut 2026-11-05). */
const TILLFOR_GRANS_PP = 0.5;
/** Gränsen som funktion, för appens spegel (speglarna bär bara funktioner). */
function tillforGransPp() { return TILLFOR_GRANS_PP; }
const SKAL_MAX = 300;

/**
 * Har lönefilen ålder? Sant när minst en rad har en ålder över 0 (ADR-64). Ålderskolumnen är valfri: saknas den läser
 * inläsningen ålder 0 på varje rad, och då räknas modellerna utan ålder i stället för att alla rader faller bort.
 * @param {any[]} rows
 */
function harAlderIRader(rows) {
    return (rows || []).some(d => d && d.alder > 0);
}
/** Raden har det som modellerna kräver: positiv lön, känt kön och, när lönefilen har ålder, en ålder över 0. */
const _modellRad = (d, harAlder) => d && d.lon > 0 && (!harAlder || d.alder > 0) && typeof d.kon === 'string'
    && (arKvinna(d) || arMan(d));

/**
 * Normaliserar ett värde från konfigurationsfilen eller gränssnittet till en giltig modell.
 * @param {any} v
 * @param {{harYrke?: boolean, harAlder?: boolean}} [opts] harYrke = datat har AID eller yrke (annars kan yrkesgrupp
 *   inte väljas); harAlder = lönefilen har ålder (annars räknas ålder inte bort, ADR-64)
 * @returns {{modell: {bas:boolean, alder:boolean, yrkesgrupp:boolean, skal:string}, varningar: string[]}}
 */
function normaliseraForklaringsmodell(v, { harYrke = true, harAlder = true } = {}) {
    const varningar = [];
    const utanAlder = m => {
        if (m.alder && !harAlder) {
            m.alder = false;
            varningar.push('Ålder kan inte räknas bort: lönefilen saknar ålder.');
        }
        return m;
    };
    if (v == null) return { modell: utanAlder({ ...FORKLARINGSMODELL_STANDARD }), varningar };
    if (typeof v !== 'object' || Array.isArray(v)) {
        varningar.push('Förklaringsmodellen i filen gick inte att läsa; standardmodellen används.');
        return { modell: utanAlder({ ...FORKLARINGSMODELL_STANDARD }), varningar };
    }
    const modell = utanAlder({ bas: v.bas === true, alder: v.alder === true, yrkesgrupp: v.yrkesgrupp === true,
        skal: typeof v.skal === 'string' ? v.skal.slice(0, SKAL_MAX) : '' });
    if (modell.yrkesgrupp && !harYrke) {
        modell.yrkesgrupp = false;
        varningar.push(fyllTermer('{Enhet.en} inom BAS kan inte väljas: lönefilen saknar {kod.en} och {namn.en}.', T));
    }
    if (modell.yrkesgrupp && !modell.bas) {
        modell.bas = true;
        varningar.push(fyllTermer('{Enhet.en} inom BAS förutsätter {niva.en}; BAS är valt.', T));
    }
    return { modell, varningar };
}

/** @param {{bas:boolean, alder:boolean, yrkesgrupp:boolean, skal:string}} m */
function forklaringsmodellArStandard(m) {
    const n = normaliseraForklaringsmodell(m).modell;
    return n.bas === FORKLARINGSMODELL_STANDARD.bas && n.alder === FORKLARINGSMODELL_STANDARD.alder
        && n.yrkesgrupp === FORKLARINGSMODELL_STANDARD.yrkesgrupp && n.skal === FORKLARINGSMODELL_STANDARD.skal;
}

/** Variablerna i modellen i den fasta ordningen BAS, ålder, yrkesgrupp. @returns {Array<'bas'|'alder'|'yrkesgrupp'>} */
function modellVariabler(m) {
    return /** @type {Array<'bas'|'alder'|'yrkesgrupp'>} */ (['bas', 'alder', 'yrkesgrupp'].filter(k => m && m[k] === true));
}

/** Frasen i löptext: "när {fras} räknats bort". Tom sträng för endast kön. */
function modellFras(m) {
    const delar = [];
    if (m && m.alder) delar.push('ålder');
    if (m && m.bas) delar.push(T.niva.en);
    if (m && m.yrkesgrupp) delar.push(T.enhet.en);
    if (delar.length <= 1) return delar.join('');
    return `${delar.slice(0, -1).join(', ')} och ${delar[delar.length - 1]}`;
}

/** Modellen i ord för modelDesc och rapporten: "kön + ålder + BAS-intervall (indikatorer)" (orden ur termerna). */
function modellBeskrivning(m) {
    const delar = ['kön'];
    if (m && m.alder) delar.push('ålder');
    if (m && m.bas) delar.push(`${T.niva.en} (indikatorer)`);
    if (m && m.yrkesgrupp) delar.push(`${T.enhet.en} inom BAS (fasta effekter)`);
    return delar.join(' + ');
}

// Diagnostiserar varför modellen misslyckas
function diagnoseCollinearity(rows, basList) {
    const issues = [];
    // Helt enkönade BAS
    let singleSexBas = 0;
    basList.forEach(b => {
        const sub = rows.filter(d => d.bas === b);
        if (sub.length < 3) return;
        const hasKv = sub.some(d => arKvinna(d));
        const hasMa = sub.some(d => arMan(d));
        if (!hasKv || !hasMa) singleSexBas++;
    });
    if (singleSexBas > 0) issues.push(`<strong>${singleSexBas}</strong> ${T.niva.fl} är helt enkönade – könseffekten kan inte estimeras inom dessa.`);
    if (basList.length < 2) issues.push(`Endast <strong>${basList.length}</strong> ${ordForAntal(basList.length, T.niva)} i urvalet – ingen variation att estimera BAS-effekten med.`);
    if (rows.length < 50)  issues.push(`Litet urval (n=${rows.length}) – kan ge instabila estimat.`);
    return issues;
}

// Per-BAS conditional regressions: gap inom varje BAS efter ålderskontroll.
// golv = statGolv(): minsta antal per kön i en BAS för att en regression ska köras. Utan ålder i lönefilen (ADR-64)
// skattas kön ensamt inom varje BAS.
function computePerBasGap(rows, basList, { golv }) {
    // Modellen tar log(lön) och kodar kön binärt. Rader utan positiv lön ger
    // -Infinity, rader utan ålder skevar centreringen, och rader med okänt kön
    // skulle räknas som MÄN av `kon.includes('kvinna') ? 1 : 0`. Filtret hör
    // därför hemma här i stället för hos anroparen — av tre anropare skickade
    // två in ofiltrerad getData() (JPA-exporten och gruppdossiern).
    const harAlder = harAlderIRader(rows);
    const giltiga = (rows || []).filter(d => _modellRad(d, harAlder));
    const out = [];
    basList.forEach(b => {
        const sub = giltiga.filter(d => d.bas === b);
        const kv  = sub.filter(d => arKvinna(d));
        const ma  = sub.filter(d => arMan(d));
        if (kv.length < golv || ma.length < golv) {
            out.push({ bas: b, n: sub.length, kvN: kv.length, maN: ma.length, status: 'too_few' });
            return;
        }
        const aMean = harAlder ? sub.reduce((s,d)=>s+d.alder,0)/sub.length : 0;
        const X = sub.map(d => [1, arKvinna(d)?1:0, ...(harAlder ? [d.alder - aMean] : [])]);
        const y = sub.map(d => Math.log(d.lon));
        const fit = fitOLS(X, y);
        if (!fit) { out.push({ bas: b, n: sub.length, kvN: kv.length, maN: ma.length, status: 'singular' }); return; }
        const beta = fit.beta[1];
        const se   = Math.sqrt(fit.vcovHC3[1][1]); // HC3 robust SE
        const p    = pValue2Sided(beta/se, fit.n, fit.k);
        const tq   = tQuantile(0.975, fit.n - fit.k);   // t-kvantil för 95 % KI (1,96 vid df ≥ 100)
        const ciLo = (Math.exp(beta - tq*se) - 1) * 100;
        const ciHi = (Math.exp(beta + tq*se) - 1) * 100;
        // Lönenivåerna för samma personer som regressionen (protokollet redovisar median och medelvärde, ADR-79). De
        // räknas bara här, där båda könen når golvet.
        const lonKv = kv.map(d => d.lon), lonMa = ma.map(d => d.lon);
        const medel = l => l.reduce((s, x) => s + x, 0) / l.length;
        out.push({ bas: b, n: sub.length, kvN: kv.length, maN: ma.length, gapPct: (Math.exp(beta)-1)*100, ciLow: ciLo, ciHigh: ciHi, pValue: p, R2: fit.R2, status: 'ok',
            medKv: median(lonKv), medMa: median(lonMa), medelKv: medel(lonKv), medelMa: medel(lonMa) });
    });
    return out;
}

// Sekventiell dekomponering: visa hur gapet krymper när kontroller läggs till
// BAS kodas som indikatorvariabler (en kolumn per BAS-intervall utom det första, som är referens),
// så att varje intervall får sin egen nivå — ingen antagen lika stor löneskillnad per bokstav.
function basIndikatorer(basList) {
    return basList.slice(1);
}

// golv = statGolv(): minsta antal per kön för att ett ansvarssteg ska redovisas.
// modell = förklaringsmodellen (ADR-56): stegen är "Endast kön" följt av ett steg per vald variabel i ordningen
// BAS, ålder, yrkesgrupp, var och en ovanpå de föregående. Yrkesgruppssteget räknas alltid när BAS är med (det
// visas efter huvudtalet när det inte är valt, ADR-46); "+ Ansvar" läggs sist ovanpå den valda modellen.
function computeSequentialGap(rows0, ageMean, basList, { golv, modell = FORKLARINGSMODELL_STANDARD }) {
    const m = normaliseraForklaringsmodell(modell, { harAlder: harAlderIRader(rows0) }).modell;
    // rows = de rader modellen kan räkna (B4): filtret ligger i _sekvensRigg, så att anroparen inte behöver det.
    const { rader: rows, y, isKv, ageC, bygg, skatta, steg } = _sekvensRigg(rows0, ageMean, basList);
    const olsVar = modellVariabler(m).filter(v => v !== 'yrkesgrupp');
    const ut = steg(olsVar).map(skatta);
    const medAlder = m.alder;
    // Yrkesgrupp inom BAS (ADR-46): sist bland modellens steg; utan ålder vald räknas det utan ålderskolumnen.
    if (m.bas) ut.push(computeYrkesgruppGap(rows, y, isKv, ageC, { medAlder }));
    // Ansvar (ansvarskod) som eget sista steg: en indikator per ansvarsgrupp med minst k personer;
    // mindre grupper räknas med "inget". Redovisas separat, inte i huvudtalet (ADR-33).
    const grupper = ['ledning', 'uppdrag'].filter(g => rows.filter(r => r.ansvarsgrupp === g).length >= golv);
    if (rows.some(r => r.ansvarsgrupp) && grupper.length) {
        /** @type {any} */
        const ansvar = rows.map(d => grupper.map(g => (d.ansvarsgrupp === g ? 1 : 0)));
        ut.push(m.yrkesgrupp
            ? computeYrkesgruppGap(rows, y, isKv, ageC, { medAlder, extra: ansvar, name: '+ Ansvar' })
            : skatta({ name: '+ Ansvar', X: bygg(olsVar, i => ansvar[i]) }));
    }
    return ut;
}

/**
 * Könsskillnaden med huvudregressionens standardkodning, för ett urval (ADR-78; översikten per huvudområde i
 * sektor.js): log lön = kön + [ålder centrerad] + en indikator per BAS-intervall utom det alfabetiskt första, HC3 och
 * t-kvantil, med reservsteget utan BAS när modellen inte kan skattas (medBas = false; sektor.js ger då inget tal när
 * urvalet har minst två BAS-intervall, antalBas). Förklaringsmodellen läses inte: översikten
 * följer inte användarens val i Lika arbete. Raderna filtreras som i stegen (B4).
 * @param {any[]} rows0
 * @param {{medAlder?: boolean}} [opts] medAlder = lönefilen har ålder (ADR-64); anroparen ger den för hela filen
 * @returns {null | {pct:number, low:number, high:number, n:number, k:number, medBas:boolean, medAlder:boolean, antalBas:number}}
 */
function justeradSkillnad(rows0, { medAlder = harAlderIRader(rows0) } = {}) {
    const giltiga = (rows0 || []).filter(d => _modellRad(d, medAlder));
    if (!giltiga.length) return null;
    const basList = [...new Set(giltiga.map(d => d.bas))].sort();
    const ageMean = medAlder ? giltiga.reduce((s, d) => s + d.alder, 0) / giltiga.length : 0;
    const { y, bygg } = _sekvensRigg(giltiga, ageMean, basList, { medAlder });
    // Kolumnordningen som i huvudregressionen: [1, kön, (ålder), (BAS-indikatorer)].
    const alder = medAlder ? ['alder'] : [];
    for (const medBas of [true, false]) {
        const X = bygg(medBas ? [...alder, 'bas'] : alder);
        if (giltiga.length < X[0].length + 5) continue;
        const fit = fitOLS(X, y);
        if (!fit) continue;
        const b = fit.beta[1], se = Math.sqrt(fit.vcovHC3[1][1]);
        const tq = tQuantile(0.975, fit.n - fit.k);
        return { pct: (Math.exp(b) - 1) * 100, low: (Math.exp(b - tq * se) - 1) * 100, high: (Math.exp(b + tq * se) - 1) * 100,
            n: fit.n, k: fit.k, medBas, medAlder, antalBas: basList.length };
    }
    return null;
}

/**
 * Vad varje variabel tillför (ADR-56): förklaringsgraden och könsgapet med och utan variabeln, räknat mot
 * fullmodellen kön + BAS + ålder oberoende av vad som är valt, så att tabellen i panelen står still när man
 * kryssar. Yrkesgrupp mäts ovanpå fullmodellen (den är en tilläggsvariabel, aldrig i förslaget). Utan ålder i
 * lönefilen (ADR-64) är fullmodellen kön + BAS och ålder får ingen rad.
 * @param {any[]} rows0 råraderna; filtreras i _sekvensRigg (B4) @param {number} ageMean @param {string[]} basList
 * @param {{golv:number, harYrke?:boolean}} opts harYrke = datat har AID eller yrke
 * @returns {{full:{status:string, gapPct?:number, R2?:number, k?:number},
 *   rader:Array<{variabel:'bas'|'alder'|'yrkesgrupp', deltaR2pp:number, gapUtan:number, gapMed:number, tillforLite:boolean, status:string}>,
 *   forslag:{tabort:string[]}}}
 */
function computeVariabelTillfor(rows0, ageMean, basList, { golv: _golv, harYrke = false }) {
    // Samma filter som i stegen (B4): lön > 0, kvinna eller man, ålder > 0 när lönefilen har ålder.
    const harAlder = harAlderIRader(rows0);
    const { rader: rows, y, isKv, ageC, bygg, skatta } = _sekvensRigg(rows0, ageMean, basList, { medAlder: harAlder });
    const fit = vars => skatta({ name: vars.join('+'), X: bygg(vars) });
    const full = fit(harAlder ? ['bas', 'alder'] : ['bas']);
    const rad = (variabel, utan, med) => {
        const status = utan.status === 'ok' && med.status === 'ok' ? 'ok' : utan.status !== 'ok' ? utan.status : med.status;
        const ok = status === 'ok';
        const deltaR2pp = ok ? (med.R2 - utan.R2) * 100 : NaN;
        return { variabel, status, deltaR2pp, gapUtan: ok ? utan.gapPct : NaN, gapMed: ok ? med.gapPct : NaN,
            tillforLite: ok && deltaR2pp < TILLFOR_GRANS_PP };
    };
    const rader = harAlder ? [rad('bas', fit(['alder']), full), rad('alder', fit(['bas']), full)] : [rad('bas', fit([]), full)];
    if (harYrke) rader.push(rad('yrkesgrupp', full, computeYrkesgruppGap(rows, y, isKv, ageC, { medAlder: harAlder })));
    const tabort = rader.filter(r => r.variabel !== 'yrkesgrupp' && r.tillforLite).map(r => r.variabel);
    return { full, rader, forslag: { tabort } };
}

// Det gemensamma underlaget för stegen: logaritmerad lön, könsindikator, centrerad ålder, BAS-indikatorer och
// hjälparna som bygger en designmatris av valda variabler och skattar ett steg.
// Raderna filtreras här (B4), som i computePerBasGap: lön > 0 (annars log = -Infinity), kvinna eller man (annars
// kodas okänt kön som man) och ålder > 0 när ålder ingår (medAlder; standard = lönefilen har ålder, ADR-64).
// `rader` är de rader som matriserna byggs av; anroparen använder dem för steg som läser raderna direkt.
/** @param {any[]} rows0 @param {number} ageMean @param {string[]} basList @param {{medAlder?: boolean}} [opts] */
function _sekvensRigg(rows0, ageMean, basList, { medAlder = harAlderIRader(rows0) } = {}) {
    const rows = (rows0 || []).filter(d => _modellRad(d, medAlder));
    const N = rows.length;
    const y    = rows.map(d => Math.log(d.lon));
    const isKv = rows.map(d => arKvinna(d) ? 1 : 0);
    const ageC = rows.map(d => d.alder - ageMean);
    const basInd = basIndikatorer(basList);
    const basD = rows.map(d => basInd.map(b => (d.bas === b ? 1 : 0)));
    const kolumn = { bas: i => basD[i], alder: i => [ageC[i]] };
    /** @param {string[]} vars @param {(i:number) => number[]} [extra] */
    const bygg = (vars, extra = () => []) => rows.map((_, i) => [1, isKv[i], ...vars.flatMap(v => kolumn[v](i)), ...extra(i)]);
    const namn = { bas: STEG_BAS, alder: '+ Ålder' };
    /** @param {string[]} vars */
    const steg = vars => [{ name: 'Endast kön', X: bygg([]) }, ...vars.map((v, j) => ({ name: namn[v], X: bygg(vars.slice(0, j + 1)) }))];
    /** @param {{name:string, X:number[][]}} s @returns {{name:string, status:string, gapPct?:number, R2?:number, k?:number, nGrupper?:number, nGrupperBada?:number, nPersoner?:number, nEnkonade?:number}} */
    const skatta = s => {
        if (!N || N < s.X[0].length + 5) return { name: s.name, status: 'too_few' };
        const fit = fitOLS(s.X, y);
        if (!fit) return { name: s.name, status: 'singular' };
        return { name: s.name, status: 'ok', gapPct: (Math.exp(fit.beta[1]) - 1) * 100, R2: fit.R2, k: fit.k };
    };
    return { rader: rows, y, isKv, ageC, bygg, skatta, steg };
}

/**
 * Steget "+ Yrkesgrupp": könsgapet efter fasta effekter för yrkesgrupp inom BAS (AID×BAS),
 * utöver ålder — löneskillnaden mellan kvinnor och män med samma yrkesgrupp, BAS och ålder.
 *
 * Skattas med inomtransformation (within-estimator): gruppmedelvärdet dras av från log-lön,
 * kön och ålder inom varje AID×BAS-grupp, och OLS körs utan intercept på de transformerade
 * variablerna. Det ger exakt samma könskoefficient som en indikator per grupp skulle ge
 * (Frisch–Waugh–Lovell), men går på 55 000 rader utan en designmatris med hundratals
 * kolumner. R² räknas mot den otransformerade lönens totala variation, så att den är
 * jämförbar med stegen före.
 *
 * Grupper med färre än statGolv() av något kön ingår i skattningen — gruppmedelvärdet är
 * ett mellanled, inte ett redovisat värde — men bara grupper med båda könen bidrar till
 * könskoefficienten (i en enkönad grupp är det transformerade könet noll). Antalet grupper
 * och personer steget bygger på följer med i resultatet.
 * Gruppnyckeln är AID-koden (eller yrket när AID saknas) inom BAS, samma som § 3:10-motorn.
 * Modellen läser ingen golv-gräns, så den tar inte emot golv (statGolv används bara i ansvarssteget).
 * medAlder = false utelämnar ålderskolumnen (ålder inte vald, ADR-56); extra = ytterligare kolumner per rad som
 * inomtransformeras i samma grupper (ansvarssteget ovanpå yrkesgrupp); name = stegets namn.
 * @returns {{name:string, status:string, gapPct?:number, R2?:number, k?:number,
 *           nGrupper?:number, nGrupperBada?:number, nPersoner?:number, nEnkonade?:number}}
 */
function computeYrkesgruppGap(rows, y, isKv, ageC, { medAlder = true, extra = null, name = STEG_YRKE } = {}) {
    if (!rows.some(d => d.aid || d.yrke)) return { name, status: 'too_few', nGrupper: 0, nGrupperBada: 0, nPersoner: 0, nEnkonade: 0 };
    // Kolumnerna som inomtransformeras: kön, (ålder), (extra kolumner, t.ex. ansvarsindikatorer).
    const kol = rows.map((_, i) => [isKv[i], ...(medAlder ? [ageC[i]] : []), ...(extra ? extra[i] : [])]);
    const inom = inomYrkesgrupp(rows, y, kol);
    if (!inom.ok) return { name, status: 'too_few', ...inom.meta };
    const fit = fitOLS(inom.X, inom.yW);
    if (!fit) return { name, status: 'singular', ...inom.meta };
    return {
        name, status: 'ok',
        gapPct: (Math.exp(fit.beta[0]) - 1) * 100,
        R2: inom.R2Total(fit.rss),
        k: inom.k,
        ...inom.meta
    };
}

/**
 * Inomtransformationen för yrkesgrupp inom BAS (ADR-46): drar gruppmedelvärdet från log-lön och från varje kolumn i
 * `kol` inom AID×BAS-gruppen. Delas av steget + Yrkesgrupp och av huvudregressionen när yrkesgrupp är vald (ADR-56).
 * @param {any[]} rows @param {number[]} y @param {number[][]} kol kolumner per rad (utan intercept)
 * hGrupp är 1/n_g per rad, gruppdelen av den fulla designens hävstång (en indikator per grupp): den läggs till
 * hävstången på de transformerade kolumnerna när HC3 räknas (ADR-77).
 * @returns {{ok:boolean, X:number[][], yW:number[], hGrupp:number[], k:number, nGrupper:number, meta:{nGrupper:number, nGrupperBada:number, nPersoner:number, nEnkonade:number}, R2Total:(rss:number)=>number}}
 */
function inomYrkesgrupp(rows, y, kol) {
    const N = rows.length;
    const p = kol[0].length;
    const nyckel = d => `${(d.aid || d.yrke || '').toString().trim()}|${d.bas ?? ''}`;
    const grupper = new Map();   // nyckel → { n, sy, s[] (summa per kolumn), kv, ma }
    const key = new Array(N);
    for (let i = 0; i < N; i++) {
        const k = nyckel(rows[i]); key[i] = k;
        let g = grupper.get(k);
        if (!g) { g = { n: 0, sy: 0, s: new Array(p).fill(0), kv: 0, ma: 0 }; grupper.set(k, g); }
        g.n++; g.sy += y[i]; for (let j = 0; j < p; j++) g.s[j] += kol[i][j];
        if (kol[i][0]) g.kv++; else g.ma++;   // kolumn 0 är könsindikatorn
    }
    let nGrupperBada = 0, nPersoner = 0;
    grupper.forEach(g => { if (g.kv > 0 && g.ma > 0) { nGrupperBada++; nPersoner += g.n; } });
    const meta = { nGrupper: grupper.size, nGrupperBada, nPersoner, nEnkonade: grupper.size - nGrupperBada };
    const yMedel = y.reduce((s, v) => s + v, 0) / N;
    let tss = 0; for (let i = 0; i < N; i++) tss += (y[i] - yMedel) ** 2;
    const R2Total = rss => (tss > 0 ? 1 - rss / tss : 0);
    // Frihetsgrader: lutningarna plus en nivå per grupp
    if (N < grupper.size + p + 5 || nGrupperBada === 0) return { ok: false, X: [], yW: [], hGrupp: [], k: p + grupper.size, nGrupper: grupper.size, meta, R2Total };
    const X = new Array(N), yW = new Array(N), hGrupp = new Array(N);
    for (let i = 0; i < N; i++) {
        const g = grupper.get(key[i]);
        X[i] = kol[i].map((v, j) => v - g.s[j] / g.n);
        yW[i] = y[i] - g.sy / g.n;
        hGrupp[i] = 1 / g.n;
    }
    return { ok: true, X, yW, hGrupp, k: p + grupper.size, nGrupper: grupper.size, meta, R2Total };
}

/**
 * Kvantilregression via IRLS (Iteratively Reweighted Least Squares).
 * Estimerar τ:te kvantilen istället för medelvärdet. Ger insyn i hur lönegapet
 * beter sig i olika delar av lönefördelningen ("glasstaket" vs "klistergolvet").
 * Startvärde tas från OLS för snabb konvergens. eps = 1e-6 hindrar division-med-noll
 * när residual ≈ 0.
 * @param {number[][]} X - n×k designmatris.
 * @param {number[]} y - n-vektor (typiskt log(lön)).
 * @param {number} tau - Kvantil ∈ (0,1), t.ex. 0.5 för median, 0.9 för P90.
 * @param {number} [maxIter=60]
 * @param {number} [tol=1e-5]
 * @param {number[]|null} [start] - startvärde för β (annars OLS-lösningen); påverkar bara hur snabbt det konvergerar.
 * @returns {null | {beta:number[]}} null om n < k+5 eller XtWX singulär.
 */
function quantileRegression(X, y, tau, maxIter = 60, tol = 1e-5, start = null) {
    const n = X.length, k = X[0].length;
    if (n < k + 5) return null;
    // Starta från OLS för snabb konvergens, eller från ett givet startvärde (bootstrappen startar i punktskattningen)
    let beta;
    if (Array.isArray(start) && start.length === k && start.every(Number.isFinite)) beta = start.slice();
    else {
        const olsFit = fitOLS(X, y);
        if (!olsFit) return null;
        beta = olsFit.beta.slice();
    }
    const eps = 1e-6;
    // Bara radernas nollskilda kolumner räknas (BAS-indikatorerna är mest nollor, ADR-63), i platta typade fält; en
    // nolla bidrar inte till någon summa och ordningen är densamma, så resultatet är detsamma som med hela raden.
    const rs = new Int32Array(n + 1);
    for (let i = 0; i < n; i++) { let c = 0; for (let j = 0; j < k; j++) if (X[i][j] !== 0) c++; rs[i + 1] = rs[i] + c; }
    const kol = new Int32Array(rs[n]), val = new Float64Array(rs[n]);
    for (let i = 0, p = 0; i < n; i++) for (let j = 0; j < k; j++) if (X[i][j] !== 0) { kol[p] = j; val[p] = X[i][j]; p++; }
    const S = new Float64Array(k * k), w = new Float64Array(n);
    for (let iter = 0; iter < maxIter; iter++) {
        for (let i = 0; i < n; i++) {
            let yhat = 0;
            for (let p = rs[i]; p < rs[i + 1]; p++) yhat += val[p] * beta[kol[p]];
            const r = y[i] - yhat;
            const wTau = r >= 0 ? tau : (1 - tau);
            w[i] = wTau / Math.max(Math.abs(r), eps);
        }
        // Lös WLS: β = (X' W X)^-1 X' W y
        S.fill(0);
        const XtWy = new Array(k).fill(0);
        for (let i = 0; i < n; i++) {
            const wi = w[i], yi = y[i], p0 = rs[i], p1 = rs[i + 1];
            for (let p = p0; p < p1; p++) {
                const a = kol[p], xa = val[p];
                XtWy[a] += wi * xa * yi;
                const rad = a * k;
                for (let q = p0; q < p1; q++) S[rad + kol[q]] += wi * xa * val[q];
            }
        }
        const XtWX = Array.from({ length: k }, (_, a) => Array.from(S.subarray(a * k, a * k + k)));
        const inv = invert(XtWX);
        if (!inv) return null;
        const newBeta = matMul(inv, XtWy.map(v => [v])).map(r => r[0]);
        // Konvergens-check
        let delta = 0;
        for (let i = 0; i < k; i++) delta += Math.abs(newBeta[i] - beta[i]);
        beta = newBeta;
        if (delta < tol) break;
    }
    return { beta };
}

/**
 * Blinder-Oaxaca-dekomposition (Blinder 1973, Oaxaca 1973).
 *
 * Bryter ned rågapet i ln(lön) mellan män och kvinnor i tre komponenter:
 *
 *   ΔÄ = (X̄_M − X̄_F) · β_F   +   X̄_F · (β_M − β_F)   +   (X̄_M − X̄_F) · (β_M − β_F)
 *        ──────── Endowment ────   ──── Coefficient ────   ────── Interaction ──────
 *
 * "Endowment" = skillnaden förklaras av att män och kvinnor har olika
 *    karakteristika (ålder, BAS-fördelning) värderade till kvinnornas
 *    avkastning. Detta är den "förklarade" delen.
 * "Coefficient" = män får olika avkastning på samma karakteristika.
 * "Interaction" = samspel mellan skillnader i karakteristika och
 *    skillnader i avkastning. Räknas som "oförklarat" i en tredelad uppdelning.
 *
 * Klassisk presentation:
 *   Förklarat   = Endowment
 *   Oförklarat  = Coefficient + Interaction
 *
 * Modell: ln(lön) ~ ålder (centrerad) + en indikator per BAS-intervall — samma kodning som huvudregressionen
 * (ADR-44, ADR-53) — körd separat för kvinnor respektive män. Med förklaringsmodellen (ADR-56) kan ålder eller
 * BAS utelämnas, och yrkesgrupp inom BAS ersätter BAS-indikatorerna med en indikator per AID×BAS-grupp (samma
 * referensregel; komponenten heter då yrke). Endast kön ger null. Referensintervallet är det alfabetiskt första
 * som finns hos BÅDA könen; ett intervall som bara finns hos ett kön får en indikator bara i det könets modell
 * (det andra könets koefficient är 0), så dess bidrag hamnar i samspelet. Komponenterna redovisas per
 * variabel som intercept, ålder och BAS, där BAS är summan över indikatorerna.
 *
 * @param {any[]} rows - råradernas poster; filtreras här på lön, ålder och kön.
 * @param {{golv:number, modell?:any}} opts golv = statGolv(); modell = förklaringsmodellen.
 * @returns {null | {
 *   modell:{bas:boolean, alder:boolean, yrkesgrupp:boolean, skal:string},
 *   rawGapPct:number, explainedPct:number, unexplainedPct:number,
 *   endowmentPct:number, coefficientPct:number, interactionPct:number,
 *   components:{[k:string]:{q:number,u:number,i:number}},
 *   basRef:string|null, basIndikatorer:string[], gruppRef:string|null, gruppIndikatorer:string[],
 *   n:number, nKv:number, nMa:number,
 *   _raw:{rawGapLog:number, q:number, u:number, i:number}
 * }}
 */
function blinderOaxaca(rows, { golv, modell = FORKLARINGSMODELL_STANDARD }) {
    const harAlder = harAlderIRader(rows);
    const m = normaliseraForklaringsmodell(modell, { harYrke: rows.some(d => d.aid || d.yrke), harAlder }).modell;
    if (!m.bas && !m.alder) return null;   // endast kön: inget att dela upp
    const raw = rows.filter(d => _modellRad(d, harAlder));
    if (raw.length < 50) return null;
    const kv = raw.filter(d => arKvinna(d));
    const ma = raw.filter(d => arMan(d));
    if (kv.length < golv || ma.length < golv) return null;

    const ageMean = raw.reduce((s, d) => s + d.alder, 0) / raw.length;
    // Gruppindikatorerna: BAS, eller yrkesgrupp inom BAS (nyckel som computeYrkesgruppGap) när den är vald.
    const gruppAv = m.yrkesgrupp ? (d => `${(d.aid || d.yrke || '').toString().trim()}|${d.bas ?? ''}`) : (d => d.bas);
    const gruppNamn = m.yrkesgrupp ? 'yrke' : 'bas';
    let gruppRef = null, indikatorer = [];
    if (m.bas) {
        const alla = [...new Set(raw.map(gruppAv))].sort();
        const harKv = new Set(kv.map(gruppAv)), harMa = new Set(ma.map(gruppAv));
        gruppRef = alla.find(g => harKv.has(g) && harMa.has(g));
        if (gruppRef == null) return null;
        indikatorer = alla.filter(g => g !== gruppRef);
    }
    // Kolumnernas namn: konstant, (ålder), en per indikator. Komponenterna summeras per namn.
    const kolNamn = ['intercept', ...(m.alder ? ['age'] : []), ...indikatorer.map(() => gruppNamn)];
    const p = kolNamn.length;

    // Designmatris för en grupp: [1, (ålder − ageMean), indikator per grupp utom referensen]. En indikator som är noll
    // för alla i gruppen (gruppen saknas hos könet) lämnas utanför gruppens skattning och får β = 0.
    const kolumner = group => indikatorer.map(g => group.some(d => gruppAv(d) === g));
    const design = (group, med) => ({
        X: group.map(d => [1, ...(m.alder ? [d.alder - ageMean] : []), ...indikatorer.filter((_, j) => med[j]).map(g => (gruppAv(d) === g ? 1 : 0))]),
        y: group.map(d => Math.log(d.lon)) });
    const medKv = kolumner(kv), medMa = kolumner(ma);
    const dKv = design(kv, medKv), dMa = design(ma, medMa);
    const fitK = fitOLS(dKv.X, dKv.y);
    const fitM = fitOLS(dMa.X, dMa.y);
    if (!fitK || !fitM) return null;
    const fasta = m.alder ? 2 : 1;
    // Koefficienter i full längd, 0 där gruppen saknas hos könet.
    const fullBeta = (fit, med) => { const b = fit.beta.slice(0, fasta); let j = fasta; for (const x of med) b.push(x ? fit.beta[j++] : 0); return b; };
    const betaKv = fullBeta(fitK, medKv), betaMa = fullBeta(fitM, medMa);

    // Gruppmedelvärden för X̄ i full längd.
    const meanX = group => {
        const out = new Array(p).fill(0);
        for (const d of group) {
            out[0] += 1;
            if (m.alder) out[1] += d.alder - ageMean;
            const g = gruppAv(d);
            indikatorer.forEach((b, j) => { if (g === b) out[fasta + j] += 1; });
        }
        return out.map(v => v / group.length);
    };
    const xKv = meanX(kv), xMa = meanX(ma);

    const dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0);
    const rawGapLog = dot(xMa, betaMa) - dot(xKv, betaKv);

    // Dekomposition per kolumn; indikatorerna summeras till en komponent (bas eller yrke).
    /** @type {{[k:string]: {q:number,u:number,i:number}}} */
    const components = {};
    for (const k of kolNamn) if (!components[k]) components[k] = { q: 0, u: 0, i: 0 };
    let qSum = 0, uSum = 0, iSum = 0;
    for (let k = 0; k < p; k++) {
        const dx = xMa[k] - xKv[k];          // skillnad i karakteristika
        const db = betaMa[k] - betaKv[k];    // skillnad i koefficient
        const q = dx * betaKv[k];            // endowment
        const u = xKv[k] * db;               // coefficient
        const i = dx * db;                   // interaction
        const c = components[kolNamn[k]];
        c.q += q; c.u += u; c.i += i;
        qSum += q; uSum += u; iSum += i;
    }
    // Kontroll: qSum + uSum + iSum ≈ rawGapLog (avvikelse ~1e-10 förväntas pga floating point)

    // Konvertera log-komponenter till %-skillnad: (exp(c) − 1) × 100
    const pct = c => (Math.exp(c) - 1) * 100;

    return {
        modell: m,
        rawGapPct: pct(rawGapLog),
        endowmentPct: pct(qSum),
        coefficientPct: pct(uSum),
        interactionPct: pct(iSum),
        explainedPct: pct(qSum),
        unexplainedPct: pct(uSum + iSum),
        components,
        // BAS-fälten när BAS-indikatorer används, gruppfälten när yrkesgrupp inom BAS används (null annars).
        basRef: m.bas && !m.yrkesgrupp ? gruppRef : null, basIndikatorer: m.bas && !m.yrkesgrupp ? indikatorer : [],
        gruppRef: m.yrkesgrupp ? gruppRef : null, gruppIndikatorer: m.yrkesgrupp ? indikatorer : [],
        n: raw.length, nKv: kv.length, nMa: ma.length,
        // Råa log-värden för exakt summa-verifiering i tester
        _raw: { rawGapLog, q: qSum, u: uSum, i: iSum }
    };
}

/**
 * Kvantilregressionens design (ADR-63): samma variabler som huvudregressionen enligt förklaringsmodellen, utan
 * yrkesgrupp inom BAS — intercept, kön, [ålder centrerad på radmedel], [en indikator per BAS-intervall utom det
 * första, som är referens]. Matrisen byggs med samma hjälpare som stegen i den sekventiella dekomponeringen
 * (_sekvensRigg). Raderna filtreras här som i huvudregressionen (lön > 0, kvinna eller man, ålder > 0 när lönefilen
 * har ålder, också när ålder inte är med i modellen), så att punktskattningen och bootstrappen i appen räknar på
 * exakt samma matris.
 * @param {any[]} rows - råradernas poster.
 * @param {any} [modell] - förklaringsmodellen (normaliseras; yrkesgrupp ingår aldrig).
 * @param {{ageMean?:number, basList?:string[]}} [opts] ageMean/basList ges utifrån eller räknas ur raderna
 *   (basList sorterad, referens = första).
 * @returns {{rader:any[], X:number[][], y:number[], kolumner:string[], ageMean:number, basList:string[],
 *   modell:{bas:boolean, alder:boolean}}}
 */
function kvantilDesign(rows, modell = FORKLARINGSMODELL_STANDARD, { ageMean, basList } = {}) {
    // Utan ålder i lönefilen (ADR-64) räknas modellen utan ålder, som i huvudregressionen.
    // Raderna är huvudregressionens (_modellRad): ålder > 0 när lönefilen har ålder, också när ålder är bortvald.
    const harAlder = harAlderIRader(rows);
    const m = normaliseraForklaringsmodell(modell, { harAlder }).modell;
    const rader = rows.filter(d => _modellRad(d, harAlder));
    const bl = m.bas ? (basList || [...new Set(rader.map(d => d.bas))].sort()) : [];
    const am = m.alder ? (ageMean != null ? ageMean : rader.reduce((s, d) => s + d.alder, 0) / (rader.length || 1)) : NaN;
    const vars = ['alder', 'bas'].filter(v => m[v]);
    const X = rader.length ? _sekvensRigg(rader, am, bl, { medAlder: m.alder }).bygg(vars) : [];
    const kolumner = ['intercept', 'kvinna', ...vars.flatMap(v => (v === 'alder' ? ['alder'] : basIndikatorer(bl).map(b => `bas:${b}`)))];
    return { rader, X, y: rader.map(d => Math.log(d.lon)), kolumner, ageMean: am, basList: bl, modell: { bas: m.bas, alder: m.alder } };
}

/**
 * Kör kvantilregression vid τ ∈ {.10, .50, .90} på kvantilDesign (samma variabler som huvudregressionen, utan
 * yrkesgrupp; ADR-63) och returnerar löneskillnaden i procent vid varje kvantil och skillnaden P90 − P10 i
 * procentenheter (negativ: skillnaden till kvinnornas nackdel är större i toppen än i botten).
 * Används för analysen av glastak och klibbigt golv i UI:t.
 * @param {any[]} rows - råradernas poster; filtreras i kvantilDesign.
 * @param {{modell?:any, ageMean?:number, basList?:string[]}} [opts] modell = förklaringsmodellen.
 * @returns {null | {results:Array<{tau:number, konPct?:number, error?:true}>, diffP90P10:number|null,
 *   kolumner:string[], n:number, nKv:number, nMa:number}} null om N < 50.
 */
function quantileRegressionAtAllTau(rows, { modell = FORKLARINGSMODELL_STANDARD, ageMean, basList } = {}) {
    const d = kvantilDesign(rows, modell, { ageMean, basList });
    if (d.rader.length < 50) return null; // för litet urval för stabil kvantilregression
    const results = [];
    for (const tau of [0.1, 0.5, 0.9]) {
        const fit = quantileRegression(d.X, d.y, tau);
        if (!fit) { results.push({ tau, error: true }); continue; }
        results.push({ tau, konPct: (Math.exp(fit.beta[1]) - 1) * 100 });
    }
    const p10 = results[0], p90 = results[2];
    const diffP90P10 = p10.error || p90.error ? null : p90.konPct - p10.konPct;
    const nKv = d.rader.filter(r => arKvinna(r)).length;
    return { results, diffP90P10, kolumner: d.kolumner, n: d.rader.length, nKv, nMa: d.rader.length - nKv };
}

// ---- Huvudregressionen: den justerade löneskillnaden ----

/** Huvudregressionens fasta golv (ADR-38; regressionsmodellen.md §1 och §9): under så många rader skattas ingen modell. */
const HUVUDREGRESSION_MIN_N = 30;
/** Huvudregressionens fasta golv (ADR-38): under så många av något kön skattas ingen modell. */
const HUVUDREGRESSION_MIN_PER_KON = 5;

/**
 * Huvudregression för "oförklarad löneskillnad" (EU 2023/970), verktygets huvudtal.
 *
 * Modell: log(lön) ~ kön + ålder (centrerad) + BAS-intervall (indikatorvariabler), med de variabler som
 * förklaringsmodellen väljer (ADR-56). Returnerar koefficienter med HC3-robusta standardfel + p-värden, R², och
 * en steg-för-steg dekomposition (gap utan kontroll → +BAS → +ålder) som vattenfallsdiagrammet bygger på.
 * Konverterar log-koefficienten till approximativ kr-procentskillnad: gapPct = (exp(β) − 1) · 100.
 *
 * BAS kodas som en indikator per BAS-intervall utom det första (alfabetiskt lägsta) som är
 * referens: varje intervall får sin egen lönenivå, utan antagandet att varje bokstavssteg
 * är värt lika mycket. Ordningen A–Z är ändå fast (se likvardighetsmodellen.md §6) och styr
 * vilket intervall som blir referens.
 *
 * Allt kommer in som argument; funktionen läser inget tillstånd och sparar ingenting (ADR-17). Appens adapter är
 * runOLSRegression i 51-lika-arbete-regressionskort.js.
 * @param {any[]} rader lönefilens rader ({lon, kon, alder, bas, aid?, yrke?, ansvarsgrupp?}); filtreras här
 * @param {{modell?: {bas:boolean, alder:boolean, yrkesgrupp:boolean, skal:string}|null, medAlder?: boolean,
 *   kInstalld: number, golv: number}} opts
 *   modell = förklaringsmodellen (normaliseras mot raderna som i appen; standardmodellen när den saknas);
 *   medAlder = lönefilen har ålder (ADR-64; standard: någon rad har en ålder över 0); kInstalld = den inställda
 *   tröskeln, som spärren för "Endast kön" följer; golv = statGolv() i appen, golvet för regressionerna per
 *   BAS-intervall och ansvarssteget
 * @returns {{error?: string, errorCode?: string, [k: string]: any}} vid fel { error, errorCode } (ev. triedSteps, diagnostics);
 *   annars beta, se, p, R2, n, k, gapPct, decomposition m.fl. — se return-satsen.
 */
function huvudregression(rader, { modell: modellIn = null, medAlder = harAlderIRader(rader), kInstalld, golv }) {
    // Utan ålder i lönefilen (ADR-64) används alla rader och modellen räknas utan ålder.
    const raw = rader.filter(d => d.lon > 0 && (!medAlder || d.alder > 0) && (arKvinna(d) || arMan(d)));
    if (raw.length < HUVUDREGRESSION_MIN_N) return { error: `För få observationer (n < ${HUVUDREGRESSION_MIN_N}) för meningsfull regressionsanalys.`, errorCode: 'low_n' };

    const kvN = raw.filter(d => arKvinna(d)).length;
    const maN = raw.filter(d => arMan(d)).length;
    if (kvN < HUVUDREGRESSION_MIN_PER_KON || maN < HUVUDREGRESSION_MIN_PER_KON)
        return { error: `Otillräcklig könsbalans i urvalet: ${kvN} kvinnor, ${maN} män. Minst ${HUVUDREGRESSION_MIN_PER_KON} av varje kön krävs.`, errorCode: 'imbalance' };

    const basList = [...new Set(raw.map(d => d.bas))].sort();
    // Indikatorvariabler: en kolumn per BAS-intervall utom det första, som är referens.
    const basRef0 = basList[0];
    const basInd = basIndikatorer(basList);

    const ageMean = medAlder ? raw.reduce((s,d) => s + d.alder, 0) / raw.length : 0;

    const y    = raw.map(d => Math.log(d.lon));
    const isKv = raw.map(d => arKvinna(d) ? 1 : 0);
    const ageC = raw.map(d => d.alder - ageMean);
    const basD = raw.map(d => basInd.map(b => (d.bas === b ? 1 : 0)));

    // Förklaringsmodellen (ADR-56): vilka variabler som räknas bort. "Endast kön" är det ojusterade gapet, som inte får
    // lämna verktyget när ett kön ligger under den inställda tröskeln (ADR-12); huvudtalet ska vara detsamma på skärmen
    // och i exporten, så spärren följer den inställda tröskeln oavsett läge (som statGolv). Då gäller standardmodellen
    // och panelen säger varför. Modellen normaliseras som appens forklaringsmodell(): yrkesgrupp bara när raderna har
    // AID eller yrke, ålder bara när lönefilen har ålder.
    /** @type {any} */
    let modell = normaliseraForklaringsmodell(modellIn, { harYrke: rader.some(d => d.aid || d.yrke), harAlder: medAlder }).modell;
    /** @type {string|null} */ let modellVarning = null;
    if (!modell.bas && !modell.alder && !(kvN >= kInstalld && maN >= kInstalld)) {
        modell = { ...modell, bas: true, alder: medAlder };
        modellVarning = `Endast kön kan inte väljas: ett kön har färre än ${kInstalld} ${personOrd(kInstalld)} i modellen (minsta gruppstorlek), så den ojusterade skillnaden får inte vara huvudtalet. Modellen är kön + ${T.niva.en}${medAlder ? ' + ålder' : ''}.`;
    }

    // Kolumnordningen är fast: [1, kön, (ålder), (BAS-indikatorer)], så att index 2 är ålder när den är vald.
    const buildX = (incAge, incBas) => raw.map((d,i) => {
        const r = [1, isKv[i]];
        if (incAge) r.push(ageC[i]);
        if (incBas) r.push(...basD[i]);
        return r;
    });
    const beskriv = m => modellBeskrivning(m);
    // Reservstegen tar bort variabler i ordningen yrkesgrupp, BAS; inget bortvalt läggs tillbaka. 'full' = den valda modellen.
    /** @type {any[]} */
    const ladder = [];
    if (modell.yrkesgrupp) ladder.push({ name: 'full', desc: beskriv(modell), yrke: true });
    const utanYrke = { ...modell, yrkesgrupp: false };
    ladder.push({ name: modell.yrkesgrupp ? 'utanYrke' : 'full', desc: beskriv(utanYrke), X: buildX(utanYrke.alder, utanYrke.bas) });
    if (modell.bas) { const m2 = { ...utanYrke, bas: false }; ladder.push({ name: 'minimal', desc: beskriv(m2), X: buildX(m2.alder, false) }); }

    /** @type {any[]} */
    const triedSteps = [];
    /** @type {any} */
    let chosen = null;
    for (const step of ladder) {
        if (step.yrke) {
            const fit = _regInomYrkesgrupp(raw, y, isKv, ageC, modell.alder);
            if (!fit) { triedSteps.push({ name: step.name, desc: step.desc, status: 'singular', k: null }); continue; }
            triedSteps.push({ name: step.name, desc: step.desc, status: 'ok', k: fit.k });
            chosen = { ...fit, modelName: step.name, modelDesc: step.desc };
            break;
        }
        if (raw.length < step.X[0].length + 5) {
            triedSteps.push({ name: step.name, desc: step.desc, status: 'too_few', k: step.X[0].length });
            continue;
        }
        const fit = fitOLS(step.X, y);
        if (!fit) {
            triedSteps.push({ name: step.name, desc: step.desc, status: 'singular', k: step.X[0].length });
            continue;
        }
        triedSteps.push({ name: step.name, desc: step.desc, status: 'ok', k: step.X[0].length });
        chosen = { ...fit, modelName: step.name, modelDesc: step.desc };
        break;
    }

    if (!chosen)
        return {
            error: 'Modellen kunde inte estimeras.',
            errorCode: 'all_failed',
            triedSteps,
            diagnostics: diagnoseCollinearity(raw, basList)
        };
    // Den modell som faktiskt skattades (reservsteget kan ha tagit bort variabler).
    const skattad = chosen.modelName === 'full' ? modell : chosen.modelName === 'utanYrke' ? utanYrke : { ...utanYrke, bas: false };

    // Kön-koefficient (index 1) – HC3 robusta standardfel
    const betaKon  = chosen.beta[1];
    const seKonR   = Math.sqrt(chosen.vcovHC3[1][1]);
    const seKonC   = Math.sqrt(chosen.vcovClassic[1][1]);
    const tStat    = betaKon / seKonR;
    const pValue   = pValue2Sided(tStat, chosen.n, chosen.k);
    const pct      = (Math.exp(betaKon) - 1) * 100;
    // Halvbredden för 95 % KI: t-fördelningens kvantil vid df = n − k (1,96 först vid df ≥ 100)
    const tq       = tQuantile(0.975, chosen.n - chosen.k);
    const pctLow   = (Math.exp(betaKon - tq*seKonR) - 1) * 100;
    const pctHigh  = (Math.exp(betaKon + tq*seKonR) - 1) * 100;
    const pctLowC  = (Math.exp(betaKon - tq*seKonC) - 1) * 100;
    const pctHighC = (Math.exp(betaKon + tq*seKonC) - 1) * 100;

    // Ålders-koefficient (index 2): % per år. null när ålder inte är med i modellen.
    /** @type {number|null} */ let ageEffect = null;
    /** @type {number|null} */ let ageP = null;
    if (skattad.alder) {
        const betaAge   = chosen.beta[2];
        const seAge     = Math.sqrt(chosen.vcovHC3[2][2]);
        ageEffect = (Math.exp(betaAge) - 1) * 100;
        ageP      = pValue2Sided(betaAge/seAge, chosen.n, chosen.k);
    }

    // BAS-koefficienter: lönenivå per BAS-intervall i procent mot referensintervallet, när BAS-indikatorerna är med
    // (null i reservmodellen och när yrkesgrupp inom BAS är vald, där BAS ingår i gruppnivåerna).
    /** @type {Array<{bas:string, pct:number, low:number, high:number, p:number}>|null} */
    let basEffekter = null;
    if (skattad.bas && !skattad.yrkesgrupp) {
        const forsta = skattad.alder ? 3 : 2;
        basEffekter = basInd.map((b, j) => {
            const idx = forsta + j;
            const beta = chosen.beta[idx];
            const se   = Math.sqrt(chosen.vcovHC3[idx][idx]);
            return {
                bas: b,
                pct: (Math.exp(beta) - 1) * 100,
                low: (Math.exp(beta - tq*se) - 1) * 100,
                high: (Math.exp(beta + tq*se) - 1) * 100,
                p: pValue2Sided(beta/se, chosen.n, chosen.k)
            };
        });
    }
    const basRef = skattad.bas ? basRef0 : null;
    // Antal personer per BAS-intervall i modellen: redovisningen av effekterna följer tröskeln (_basEffekterForRedovisning).
    /** @type {Record<string, number>} */
    const basN = {};
    for (const d of raw) basN[d.bas] = (basN[d.bas] || 0) + 1;

    // Sekventiell dekomponering på den skattade modellen.
    // Ansvarssteget lyfts ut: det redovisas på en egen rad och påverkar inte huvudtalet.
    const allaSteg = computeSequentialGap(raw, ageMean, basList, { golv, modell: skattad });
    const ansvarSteg = allaSteg.find(s => s.name === '+ Ansvar') ?? null;
    // Yrkesgruppssteget (ADR-46) står sist i sequential. Är yrkesgrupp vald (ADR-56) är det huvudtalet; annars visas
    // det efter huvudtalet, och huvudtalet och den förklarade andelen räknas till och med modellens sista OLS-steg.
    const yrkesSteg = allaSteg.find(s => s.name === STEG_YRKE) ?? null;
    const sequential = allaSteg.filter(s => s.name !== '+ Ansvar');
    const seqOk = sequential.filter(s => s.status === 'ok' && (skattad.yrkesgrupp || s.name !== STEG_YRKE));
    /** @type {number|null} */ let explainedShare = null;
    if (seqOk.length >= 2) {
        const first = Number(seqOk[0].gapPct);
        const last  = Number(seqOk[seqOk.length - 1].gapPct);
        if (Math.abs(first) > 0.1) {
            explainedShare = ((Math.abs(first) - Math.abs(last)) / Math.abs(first)) * 100;
        }
    }

    // Vad varje variabel tillför (ADR-56), alltid mot fullmodellen, och det som valts bort med sina tal. Yrkesgrupp
    // mäts bara när raderna har AID eller yrke.
    const tillfor = computeVariabelTillfor(raw, ageMean, basList, { golv, harYrke: raw.some(d => d.aid || d.yrke) });
    const etikett = { bas: stor(T.niva.en), alder: 'Ålder' };
    const bortvalt = ['bas', 'alder'].filter(v => !modell[v]).map(v => {
        const rad = tillfor.rader.find(r => r.variabel === v);
        return { variabel: v, etikett: etikett[v], deltaR2pp: rad ? rad.deltaR2pp : null, gapUtan: rad ? rad.gapUtan : null, gapMed: rad ? rad.gapMed : null, skal: modell.skal };
    });

    // Per-BAS conditional gap (separata regressioner inom varje BAS)
    const perBas = computePerBasGap(raw, basList, { golv });

    const fellBackFromFull = chosen.modelName !== 'full';
    const diagnostics = fellBackFromFull ? diagnoseCollinearity(raw, basList) : [];

    // Rått gap (median)
    const kv = raw.filter(d => arKvinna(d));
    const ma = raw.filter(d => arMan(d));
    const medianKv = median(kv.map(d=>d.lon));
    const medianMa = median(ma.map(d=>d.lon));
    const rawGapPct = (medianKv / medianMa - 1) * 100;

    return {
        modelName: chosen.modelName,
        modelDesc: chosen.modelDesc,
        modell: skattad,                      // den skattade förklaringsmodellen (ADR-56)
        modellVald: modell,                   // den valda (skiljer sig från modell bara i reservsteget)
        modellVarning,
        fras: modellFras(skattad),            // "ålder och BAS-intervall" m.fl.; tom för endast kön
        tillfor,
        bortvalt,
        fellBackFromFull,
        triedSteps,
        diagnostics,
        n: chosen.n, k: chosen.k, ageMean,
        hHoga: chosen.hHoga ?? 0,             // observationer med hävstång > 0,99 (B4, teknisk specifikation)
        konPct: pct, konPctLow: pctLow, konPctHigh: pctHigh,
        // Samma skattning som kvinnors lön i % av mäns (log-modellen: exp(β) × 100 = 100 + konPct), måttet i
        // flikarnas nyckeltalsrader.
        konKvot: 100 + pct,
        konPctLowClassical: pctLowC, konPctHighClassical: pctHighC,
        seKonR, seKonC,
        tStat, pValue, tKvantil: tq,          // halvbredden för 95 % KI i enheter av SE
        ageEffect, ageP,
        basEffekter,                          // per BAS-intervall utom referensen: nivå mot referensen (null vid reservmodell)
        basRef,                               // referensintervallet (alfabetiskt första)
        basN,                                 // antal personer per BAS-intervall i modellen
        basList,                              // alfabetiskt sorterad lista, för referens i UI
        R2: chosen.R2, adjR2: chosen.adjR2,
        rawGapPct,
        medianKv, medianMa,                   // underlag för kronor-omräkningen i UI
        sequential,
        ansvarSteg,
        yrkesSteg,
        explainedShare,
        perBas,
        nBas: basList.length,
        nKvAnalysed: kvN, nMaAnalysed: maN
    };
}

/**
 * Huvudregressionen med yrkesgrupp inom BAS (ADR-56): fasta effekter för AID×BAS med inomtransformation (ADR-46),
 * som steget + Yrkesgrupp, men här behövs också standardfel. Skattningen görs på de transformerade variablerna
 * [kön, (ålder)]; koefficienterna är desamma som med en indikator per grupp (Frisch–Waugh–Lovell). Standardfelen är
 * den fulla designens (ADR-77): HC3 räknas med hävstången h_i + 1/n_g, den fulla designens, och skalas inte; den
 * klassiska kovariansen skalas med (n − p) / (n − p − G) för gruppnivåernas frihetsgrader. k räknas med gruppnivåerna,
 * så att t-kvantilen och p-värdet använder rätt df. Resultatet får samma form som fitOLS med intercept (index 0 är en
 * tom konstant), så att resten av huvudregression läser kön på index 1 och ålder på index 2.
 * hHoga räknas på samma fulla hävstång: en ensam person i en grupp har h = 1.
 * @param {any[]} raw @param {number[]} y @param {number[]} isKv @param {number[]} ageC @param {boolean} medAlder
 * @returns {null | {beta:number[], vcovHC3:number[][], vcovClassic:number[][], R2:number, adjR2:number, n:number, k:number, rss:number, hHoga:number}}
 */
function _regInomYrkesgrupp(raw, y, isKv, ageC, medAlder) {
    const kol = raw.map((_, i) => (medAlder ? [isKv[i], ageC[i]] : [isKv[i]]));
    const inom = inomYrkesgrupp(raw, y, kol);
    if (!inom.ok) return null;
    const fit = fitOLS(inom.X, inom.yW, inom.hGrupp);
    if (!fit) return null;
    const n = raw.length, p = kol[0].length, k = inom.k;
    if (n - k <= 0) return null;
    const skala = (n - p) / (n - k);
    const vidga = (V, s) => { const ut = [[0, ...V[0].map(() => 0)]]; for (const rad of V) ut.push([0, ...rad.map(v => v * s)]); return ut; };
    const R2 = inom.R2Total(fit.rss);
    return { beta: [0, ...fit.beta], vcovHC3: vidga(fit.vcovHC3, 1), vcovClassic: vidga(fit.vcovClassic, skala), R2,
        adjR2: 1 - (1 - R2) * (n - 1) / (n - k), n, k, rss: fit.rss, hHoga: fit.hHoga };
}

    return { huvudregression, computePerBasGap, computeSequentialGap, quantileRegression, blinderOaxaca, quantileRegressionAtAllTau, kvantilDesign, normaliseraForklaringsmodell, forklaringsmodellArStandard, modellVariabler, modellFras, modellBeskrivning, tillforGransPp, harAlderIRader, justeradSkillnad, stegNamn, stegEtikett };
})();
const _rgHuvudregression = __mirrorRegression.huvudregression;
const _rgComputePerBasGap = __mirrorRegression.computePerBasGap;
const _rgComputeSequentialGap = __mirrorRegression.computeSequentialGap;
const _rgQuantileRegression = __mirrorRegression.quantileRegression;
const _rgBlinderOaxaca = __mirrorRegression.blinderOaxaca;
const _rgQuantileRegressionAtAllTau = __mirrorRegression.quantileRegressionAtAllTau;
const _rgKvantilDesign = __mirrorRegression.kvantilDesign;
const _rgNormaliseraForklaringsmodell = __mirrorRegression.normaliseraForklaringsmodell;
const _rgForklaringsmodellArStandard = __mirrorRegression.forklaringsmodellArStandard;
const _rgModellVariabler = __mirrorRegression.modellVariabler;
const _rgModellFras = __mirrorRegression.modellFras;
const _rgModellBeskrivning = __mirrorRegression.modellBeskrivning;
const _rgTillforGransPp = __mirrorRegression.tillforGransPp;
const _rgHarAlderIRader = __mirrorRegression.harAlderIRader;
const _rgJusteradSkillnad = __mirrorRegression.justeradSkillnad;
const _rgStegNamn = __mirrorRegression.stegNamn;
const _rgStegEtikett = __mirrorRegression.stegEtikett;

// ---- speglar src/lib/osakerhet.js ----
const __mirrorOsakerhet = (() => {
    // importer ur tidigare speglade lib-moduler
    const median = __mirrorStat.median;
    const linearRegression = __mirrorStat.linearRegression;
    const percentilintervall = __mirrorStat.percentilintervall;
    const rngFor = __mirrorRng.rngFor;
    const slumpensGranser = __mirrorStatus.slumpensGranser;
    const bootstrapMedianer = __mirrorLikvardighet.bootstrapMedianer;
    const kvantilDesign = __mirrorRegression.kvantilDesign;
    const quantileRegression = __mirrorRegression.quantileRegression;
    const arKvinna = __mirrorKon.arKvinna;
    const arMan = __mirrorKon.arMan;
    const aidAvRad = __mirrorAid.aidAvRad;
    const namnrader = __mirrorAid.namnrader;

// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
/**
 * Öppen lönekartläggning — osäkerheten kring skattningarna.
 *
 *   - organisationensKvotKI, medianKvotKI, medianKvotKIGiltiga: percentil-bootstrapintervallen (95 %) på mediankvoten
 *     kvinnor/män, för hela organisationen (Översikt), per BAS-intervall och åldersgrupp (Lika arbete, Ålder &
 *     karriär) och per grupp (gruppdossiern, rapportunderlaget). Dragningarnas medianer tas ur rangräkning
 *     (bootstrapMedianer i likvardighet.js).
 *   - regressionslinjensBand: 95-procentigt konfidensband kring en enkel regressionslinje (Ålder & karriär).
 *   - styrkeanalys, sigmaInomGrupp, gruppMde: minsta upptäckbara skillnad vid 80 % styrka och α = 0,05.
 *   - extremvarden: löner långt från sitt BAS-intervalls medel på log-skala.
 *   - trattUnderlag: trattdiagrammets grupper, deras slumpens gränser och fältets halva bredd (Lika arbete).
 *   - kvantilBootstrap: intervallen kring kvantilregressionens skattningar (ADR-63).
 *
 * Rena funktioner: raderna, golvet och tröskeln kommer in som argument. Där slump används är generatorn ett val
 * (`rng`); utan den seedas den ur datat (rngFor), så att resultatet är detsamma varje gång, och dragningarna görs ur
 * sorterade listor, så att det inte beror på radordningen (ADR-86). Percentilintervallet tas
 * med percentilintervall i stat.js. Appens funktioner med de tidigare namnen (computeBootstrapCI,
 * computePowerAnalysis, computeGroupMDE, linearRegressionCI, detectOutliers, _laBootstrapGapCI, _gdBootstrapGapCI,
 * _laTrattUnderlagRakna, _regKvantilBootstrap) är tunna adaptrar som läser tillståndet och anropar funktionerna här.
 *
 * Webbläsarbygget får en AUTO-GENERERAD spegel i src/app/09-lib-speglar.js. Inga DOM-/state-beroenden.
 *
 * Bygger på: docs/utveckling/regressionsmodellen.md avsnitt 7 och ADR-86. Beräkningarna står i docs/utveckling/berakningsregister.md.
 */







/** Antalet dragningar i intervallet för hela organisationen (Översikt). */
const B_ORGANISATION = 2000;
/** Antalet dragningar i intervallet per BAS-intervall och per åldersgrupp. */
const B_PER_GRUPP = 1000;
/** Antalet dragningar i gruppdossierns och rapportunderlagets intervall. */
const B_DOSSIER = 2000;
/** Minsta antal av vardera könet för ett bootstrapintervall på mediankvoten per grupp. */
const KVOT_MIN_N = 3;
/** Minsta antal giltiga dragningar (männens median över noll) för att dossierns intervall ska ges. */
const DOSSIER_MIN_GILTIGA = 20;
/** z för 95 % tvåsidigt: konfidensbandet kring regressionslinjen och trattens fält. */
const Z_95 = 1.96;
/** Konfidensbandet: minsta antal punkter för en linje med spridning, och antalet punkter längs linjen. */
const BAND_MIN_N = 3, BAND_STEG = 30;
/** Faktorn i minsta upptäckbara skillnad: 1,96 (α = 0,05 tvåsidigt) + 0,842 (styrka 80 %). */
const Z_STYRKA = 2.802;
/** Jämn könsfördelning i styrkeanalysen: det mindre könet är minst 40 % av alla. */
const BALANSGRANS = 0.4;
/** Minsta antal personer för styrkeanalysen. */
const STYRKA_MIN_N = 10;
/** Minsta antal residualer för σ inom grupp; med färre används spridningen i hela urvalet. */
const MDE_SIGMA_MIN_RESIDUALER = 20;
/** Gruppens minsta upptäckbara skillnad: under 3 % god, under 7 % godtagbar, annars svag. */
const MDE_GOD = 3, MDE_GODTAGBAR = 7;
/** Under så många av något kön är gruppen för liten för styrkeuppskattningen. */
const MDE_FOR_LITEN = 5;
/** Extremvärdesgränsen: avståndet från BAS-intervallets medel på log-skala, i standardavvikelser. */
const EXTREMVARDE_Z = 3;
/** Trattens σ ur medianens absoluta avvikelse: 1,4826 × MAD är σ vid normalfördelning. */
const MAD_TILL_SIGMA = 1.4826;
/** Medianens standardfel i förhållande till medelvärdets vid normalfördelning (√(π/2)). */
const MEDIAN_SE_FAKTOR = 1.2533;
/** Rättningen av trattens normalformel för små grupper: 1 + 0,6 / (det mindre könets antal). */
const SMA_GRUPPER_RATTNING = 0.6;
/** Kvantilregressionens bootstrap: antalet omsamplingar och största antal personer som intervallet räknas för. */
const KVANTIL_KI_B = 200, KVANTIL_KI_MAX_N = 2000;

/** Konstanterna ovan i ett objekt, för appen (spegelns alias måste vara funktioner). */
function osakerhetKonstanter() {
    return Object.freeze({ B_ORGANISATION, B_PER_GRUPP, B_DOSSIER, KVOT_MIN_N, DOSSIER_MIN_GILTIGA, Z_95, BAND_MIN_N, BAND_STEG,
        Z_STYRKA, BALANSGRANS, STYRKA_MIN_N, MDE_SIGMA_MIN_RESIDUALER, MDE_GOD, MDE_GODTAGBAR, MDE_FOR_LITEN, EXTREMVARDE_Z,
        MAD_TILL_SIGMA, MEDIAN_SE_FAKTOR, SMA_GRUPPER_RATTNING, KVANTIL_KI_B, KVANTIL_KI_MAX_N });
}


// ---- Bootstrapintervallen på mediankvoten ----

/**
 * 95-procentigt percentil-bootstrapintervall för mediankvoten kvinnor/män i hela organisationen (Översikt).
 *
 * Metod: B dragningar med återläggning ur vardera könet, mediankvoten per dragning, percentilintervallet (95 %).
 * B = 2000: med B = 600 blev Monte Carlo-variabiliteten på gränserna ~±0,5 pp, vilket märks för gränsfall; variationen
 * minskar med 1/√B, så B = 2000 ger ungefär hälften, på ~50–200 ms vid alla typiska storlekar. Dragningarnas medianer
 * tas ur rangräkning (O(n) per dragning; sortering gav O(B·n log n), flera sekunder vid 20 000 rader), med identiskt
 * resultat. En dragning där männens median inte är positiv ger kvoten 1.
 *
 * Skillnaden i procent (`gapPct`) har verktygets tecken, (kvot − 1) · 100, negativ när kvinnor ligger lägre, som den råa
 * skillnaden den står bredvid (se regressionsmodellen.md avsnitt 1, Tecknet). Gränserna följer kvotens: lo ur kvotens lo.
 * @param {Array<{lon:number, kon:string}>} rader
 * @param {number} golv  minsta antal av vardera könet (statGolv() i appen)
 * @param {{B?: number, rng?: () => number}} [val]  rng: generatorn; utan den seedad ur lönerna
 * @returns {null | {ratio: {point:number, lo:number, hi:number}, gapPct: {point:number, lo:number, hi:number}, B:number}}
 */
function organisationensKvotKI(rader, golv, { B = B_ORGANISATION, rng } = {}) {
    const d = rader.filter(r => r.lon > 0);
    const kv = d.filter(r => arKvinna(r)).map(r => r.lon);
    const ma = d.filter(r => arMan(r)).map(r => r.lon);
    if (kv.length < golv || ma.length < golv) return null;
    const ratios = new Array(B);
    const m = bootstrapMedianer(kv, ma, B, rng || rngFor(kv, ma));   // seedad ur datat → reproducerbart KI
    for (let b = 0; b < B; b++) {
        const mKv = m.kv[b], mMa = m.ma[b];
        ratios[b] = mMa > 0 ? mKv / mMa : 1;
    }
    ratios.sort((a, b) => a - b);
    const { lag: lo, hog: hi } = percentilintervall(ratios);
    const point = median(kv) / median(ma);
    return {
        ratio:  { point, lo, hi },
        gapPct: { point: (point - 1) * 100, lo: (lo - 1) * 100, hi: (hi - 1) * 100 },
        B
    };
}

/**
 * 95-procentigt percentil-bootstrapintervall för kvinnors median i procent av mäns, för en grupp (BAS-intervall,
 * åldersgrupp). En dragning där männens median inte är positiv ger 100.
 * @param {number[]} kvLons
 * @param {number[]} maLons
 * @param {{B?: number, rng?: () => number}} [val]  rng: generatorn; utan den seedad ur lönerna
 * @returns {null | {lo:number, hi:number}} null med färre än KVOT_MIN_N av något kön
 */
function medianKvotKI(kvLons, maLons, { B = B_PER_GRUPP, rng } = {}) {
    if (kvLons.length < KVOT_MIN_N || maLons.length < KVOT_MIN_N) return null;
    const ratios = new Array(B);
    const m = bootstrapMedianer(kvLons, maLons, B, rng || rngFor(kvLons, maLons));   // seedad ur datat → reproducerbart KI
    for (let b = 0; b < B; b++) {
        const mKv = m.kv[b], mMa = m.ma[b];
        ratios[b] = mMa > 0 ? (mKv / mMa) * 100 : 100;
    }
    ratios.sort((a, b) => a - b);
    const { lag, hog } = percentilintervall(ratios);
    return { lo: lag, hi: hog };
}

/**
 * Kvinnors median i procent av mäns per grupp (BAS-intervall, åldersgrupp, yrkesgrupp), bara där både kvinnorna och
 * männen är minst k (k-tröskeln, S4). Den enda prövningen mot k för översikten per BAS-intervall, lönegapet per
 * åldersgrupp och löneöversynens grupper före och efter. En grupp utan löner hoppas över, en grupp där ett kön har
 * färre än k hamnar i `dolda`, och en grupp där männens median inte är positiv hoppas över (kvoten saknas).
 * @param {Iterable<[any, number[], number[]]>} grupper  [nyckel, kvinnornas löner, männens löner], i visningsordning
 * @param {{k: number, ki?: boolean}} val  ki: med medianKvotKI (B_PER_GRUPP) i `ci`
 * @returns {{visade: Array<{nyckel: any, nKv: number, nMa: number, medKv: number, medMa: number, gap: number, ci?: null | {lo: number, hi: number}}>, dolda: any[]}}
 */
function konskvotPerGrupp(grupper, { k, ki = false }) {
    const visade = [], dolda = [];
    for (const [nyckel, kv, ma] of grupper) {
        if (!kv.length && !ma.length) continue;
        if (kv.length < k || ma.length < k) { dolda.push(nyckel); continue; }
        const medKv = median(kv), medMa = median(ma);
        if (!(medMa > 0)) continue;
        visade.push({ nyckel, nKv: kv.length, nMa: ma.length, medKv, medMa, gap: medKv / medMa * 100, ...(ki ? { ci: medianKvotKI(kv, ma) } : {}) });
    }
    return { visade, dolda };
}

/**
 * Som medianKvotKI, men dragningar där männens median inte är positiv räknas inte, och intervallet ges bara när minst
 * DOSSIER_MIN_GILTIGA dragningar återstår (gruppdossiern och rapportunderlaget).
 * @param {number[]} kvLons
 * @param {number[]} maLons
 * @param {{B?: number, rng?: () => number}} [val]  rng: generatorn; utan den seedad ur lönerna
 * @returns {null | {lo:number, hi:number}}
 */
function medianKvotKIGiltiga(kvLons, maLons, { B = B_DOSSIER, rng } = {}) {
    if (kvLons.length < KVOT_MIN_N || maLons.length < KVOT_MIN_N) return null;
    const ratios = new Array(B);
    const m = bootstrapMedianer(kvLons, maLons, B, rng || rngFor(kvLons, maLons));   // seedad ur datat → reproducerbart KI
    for (let b = 0; b < B; b++) {
        const mMa = m.ma[b];
        ratios[b] = mMa > 0 ? (m.kv[b] / mMa) * 100 : NaN;
    }
    const ok = ratios.filter(v => isFinite(v)).sort((a, b) => a - b);
    if (ok.length < DOSSIER_MIN_GILTIGA) return null;
    const { lag, hog } = percentilintervall(ok);
    return { lo: lag, hi: hog };
}

// ---- Konfidensbandet kring en regressionslinje ----

/**
 * 95-procentigt konfidensband för en enkel linjär regressionslinje.
 * SE av MEDELPREDIKTIONEN vid x: σ × √(1/n + (x−x̄)²/Σ(xi−x̄)²), där σ² = RSS/(n−2). Ger punkter {x, y, lo, hi}
 * jämnt spridda över [minX, maxX].
 * @param {Array<[number, number]>} data  [x, y]-par
 * @param {number} minX
 * @param {number} maxX
 * @param {number} [steps]  antal punkter (BAND_STEG)
 * @returns {null | Array<{x:number, y:number, lo:number, hi:number}>} null med färre än BAND_MIN_N punkter eller
 *   utan spridning i x
 */
function regressionslinjensBand(data, minX, maxX, steps = BAND_STEG) {
    const n = data.length;
    if (n < BAND_MIN_N) return null;
    const reg = linearRegression(data);
    if (!reg) return null;
    const meanX = data.reduce((s, p) => s + p[0], 0) / n;
    let ssX = 0, rss = 0;
    for (let i = 0; i < n; i++) {
        ssX += (data[i][0] - meanX) ** 2;
        const yhat = reg.m * data[i][0] + reg.b;
        rss += (data[i][1] - yhat) ** 2;
    }
    if (ssX <= 0) return null;
    const sigma2 = rss / Math.max(1, n - 2);
    const out = [];
    for (let i = 0; i < steps; i++) {
        const x = minX + (maxX - minX) * (i / (steps - 1));
        const y = reg.m * x + reg.b;
        const se = Math.sqrt(Math.max(0, sigma2 * (1 / n + (x - meanX) ** 2 / ssX)));
        out.push({ x, y, lo: y - Z_95 * se, hi: y + Z_95 * se });
    }
    return out;
}

// ---- Styrkan: minsta upptäckbara skillnad ----

/**
 * Minsta upptäckbara skillnad i procent vid 80 % styrka och α = 0,05:
 * MDE_log ≈ 2,802 · σ_log · √(1/n_kv + 1/n_ma), i procent (e^MDE_log − 1) · 100.
 * @param {number} sigma  σ för log(lön)
 * @param {number} nKv
 * @param {number} nMa
 * @returns {number}
 */
function mdeProcent(sigma, nKv, nMa) {
    const mdeLog = Z_STYRKA * sigma * Math.sqrt(1 / nKv + 1 / nMa);
    return (Math.exp(mdeLog) - 1) * 100;
}

/**
 * Minsta upptäckbara lönegap (procent) för regressionens könskoefficient vid 80 % styrka och α = 0,05, för hela
 * organisationen (mdeProcent).
 *
 * σ_log är spridningen i log(lön) INOM grupp (sigmaInomGrupp): den poolade standardavvikelsen av residualerna
 * log(lön) − log(gruppens median per kön) över alla yrkesgrupper inom BAS med minst `golv` av varje kön (samma idé som
 * trattdiagrammets σ, trattUnderlag). Spridningen över hela urvalet duger inte: den rymmer skillnaderna mellan
 * BAS-intervallen och överskattar spridningen inom en grupp, så att MDE per grupp blev för stor. Är underlaget för
 * litet (inga grupper når golvet, eller färre än MDE_SIGMA_MIN_RESIDUALER residualer) används hela urvalets σ.
 * @param {Array<{lon:number, kon:string, yrke?:any, bas?:any}>} rader
 * @param {number} golv  minsta antal av vardera könet i en grupp (statGolv() i appen)
 * @returns {null | {n:number, nKv:number, nMa:number, mdePct:number, sigma:number, sigmaKalla:'inomGrupp'|'helaUrvalet',
 *                   sigmaHela:number, sigmaGrupper:number, balanced:boolean}}
 */
function styrkeanalys(rader, golv) {
    const d = rader.filter(r => r.lon > 0);
    if (d.length < STYRKA_MIN_N) return null;
    const arKv = arKvinna, arMa = arMan;
    const kv = d.filter(arKv).map(r => r.lon);
    const ma = d.filter(arMa).map(r => r.lon);
    if (kv.length < 2 || ma.length < 2) return null;
    // SD av log(lön) över hela urvalet — reserven när underlaget per grupp är för litet
    const allLog = d.map(r => Math.log(r.lon));
    const meanLog = allLog.reduce((s, v) => s + v, 0) / allLog.length;
    const varLog  = allLog.reduce((s, v) => s + (v - meanLog) ** 2, 0) / (allLog.length - 1);
    const sigmaHela = Math.sqrt(varLog);
    const inom = sigmaInomGrupp(d, arKv, arMa, golv);
    const sigma = inom ? inom.sigma : sigmaHela;
    const mdePct = mdeProcent(sigma, kv.length, ma.length);
    const minN = Math.min(kv.length, ma.length);
    const maxN = Math.max(kv.length, ma.length);
    // Jämn könsfördelning enligt verktygets definition: båda könen ≥ 40% av totalen.
    const balanced = minN / (minN + maxN) >= BALANSGRANS;
    return { n: d.length, nKv: kv.length, nMa: ma.length, mdePct, sigma, sigmaKalla: inom ? 'inomGrupp' : 'helaUrvalet',
             sigmaHela, sigmaGrupper: inom ? inom.grupper : 0, balanced };
}

/**
 * Poolad standardavvikelse av residualerna log(lön) − log(gruppens median per kön) över alla grupper (AID-kod i
 * BAS-intervallet, aidAvRad) med minst `golv` av varje kön. Frihetsgraderna är antalet residualer minus två medianer per grupp.
 * @param {Array<{lon:number, yrke?:any, bas?:any}>} d  rader med lön över noll
 * @param {(r: any) => boolean} arKv
 * @param {(r: any) => boolean} arMa
 * @param {number} golv
 * @returns {null | {sigma:number, grupper:number, residualer:number}} null när underlaget är för litet
 */
function sigmaInomGrupp(d, arKv, arMa, golv) {
    /** @type {Map<string, {kv: number[], ma: number[]}>} */
    const perGrupp = new Map();
    for (const r of d) {
        const kv = arKv(r), ma = arMa(r);
        if (!kv && !ma) continue;
        const nyckel = `${aidAvRad(r)}|${r.bas}`;   // AID-koden i BAS-intervallet, som trattUnderlag
        if (!perGrupp.has(nyckel)) perGrupp.set(nyckel, { kv: [], ma: [] });
        /** @type {{kv: number[], ma: number[]}} */ (perGrupp.get(nyckel))[kv ? 'kv' : 'ma'].push(r.lon);
    }
    const grupper = [...perGrupp.values()].filter(g => g.kv.length >= golv && g.ma.length >= golv);
    if (!grupper.length) return null;
    let summa = 0, antal = 0;
    for (const g of grupper) {
        for (const [loner] of [[g.kv], [g.ma]]) {
            const logMed = Math.log(median(loner));
            for (const v of loner) { summa += (Math.log(v) - logMed) ** 2; antal++; }
        }
    }
    const df = antal - 2 * grupper.length;
    if (antal < MDE_SIGMA_MIN_RESIDUALER || df < 1) return null;
    const sigma = Math.sqrt(summa / df);
    return sigma > 0 ? { sigma, grupper: grupper.length, residualer: antal } : null;
}

/**
 * Minsta upptäckbara skillnad för en undergrupp (yrkesgrupp, BAS-rad) med σ ur styrkeanalysen.
 * @param {number} nKv  antal kvinnor i gruppen
 * @param {number} nMa  antal män i gruppen
 * @param {number|null|undefined} sigma  σ för log(lön)
 * @returns {null | {mdePct:number, level:'good'|'fair'|'poor', tooSmall:boolean}}
 */
function gruppMde(nKv, nMa, sigma) {
    if (!sigma || nKv < 2 || nMa < 2) return null;
    const mdePct = mdeProcent(sigma, nKv, nMa);
    const level = mdePct < MDE_GOD ? 'good' : mdePct < MDE_GODTAGBAR ? 'fair' : 'poor';
    const tooSmall = nKv < MDE_FOR_LITEN || nMa < MDE_FOR_LITEN;
    return { mdePct, level, tooSmall };
}

// ---- Extremvärden ----

/**
 * Löner som ligger ovanligt långt från sitt BAS-intervalls medel på log-skala (robust mot positivt skev fördelning):
 * z = (log(lön) − μ)/σ inom BAS-intervallet, och |z| ≥ troskel flaggas för manuell granskning (kan vara felinmatning).
 * BAS-intervall med färre än `golv` personer bedöms inte (för få för en spridningsskattning).
 * Könet skrivs 'Kvinna' eller 'Man'; rader utan känt kön finns inte i underlaget (de utesluts vid inläsningen).
 * @param {Array<{lon:number, bas:any, yrke?:any, kon:string, alder?:any, radnr?:any}>} rader
 * @param {number} golv  minsta antal personer i BAS-intervallet (statGolv() i appen)
 * @param {number} [troskel]  z-gränsen (EXTREMVARDE_Z)
 * @returns {Array<{radnr:any, bas:any, yrke:any, kon:string, alder:any, lon:number, groupMedian:number, z:number, diffPct:number}>}
 *   sorterade på |z|, störst först
 */
function extremvarden(rader, golv, troskel = EXTREMVARDE_Z) {
    const d = rader;
    if (!d.length) return [];
    // Gruppera per BAS, beräkna log-mean + log-SD
    /** @type {Record<string, any[]>} */
    const byBas = {};
    d.forEach((r, idx) => {
        if (!byBas[r.bas]) byBas[r.bas] = [];
        byBas[r.bas].push({ ...r, _idx: idx + 1 });
    });
    /** @type {Array<{radnr:any, bas:any, yrke:any, kon:string, alder:any, lon:number, groupMedian:number, z:number, diffPct:number}>} */
    const results = [];
    Object.entries(byBas).forEach(([_bas, rows]) => {
        if (rows.length < golv) return; // för få för en spridningsskattning
        const logs = rows.map(r => Math.log(r.lon));
        const mean = logs.reduce((s, v) => s + v, 0) / logs.length;
        const variance = logs.reduce((s, v) => s + (v - mean) ** 2, 0) / Math.max(1, logs.length - 1);
        const sd = Math.sqrt(variance);
        if (sd === 0) return;
        const groupMedian = median(rows.map(r => r.lon));
        rows.forEach(r => {
            const z = (Math.log(r.lon) - mean) / sd;
            if (Math.abs(z) >= troskel) {
                results.push({
                    radnr: r.radnr ?? null,
                    bas: r.bas,
                    yrke: r.yrke,
                    kon: arKvinna(r) ? 'Kvinna' : 'Man',
                    alder: r.alder,
                    lon: r.lon,
                    groupMedian,
                    z,
                    diffPct: ((r.lon - groupMedian) / groupMedian) * 100
                });
            }
        });
    });
    results.sort((a, b) => Math.abs(b.z) - Math.abs(a.z));
    return results;
}

// ---- Trattdiagrammets underlag ----

/**
 * Trattdiagrammets grupper (Lika arbete): AID-kod + BAS-intervall ur varje persons egen rad, bara grupper där båda
 * könen når `k`. Varje grupp får kvoten (kvinnors median i % av mäns), slumpens gränser (slumpensGranser i status.js:
 * omkastning, för grupper över 300 personer normalformeln med gruppens egen spridning) och om kvoten ligger utanför.
 * Fältets halva bredd för en grupp med nKv och nMa är 1,96 × 1,2533 × σ × √(1/nKv + 1/nMa) × (1 + 0,6/min(nKv, nMa)),
 * i procent, där σ = 1,4826 × MAD av ln(lön) − ln(könets median i gruppen) över alla grupperna.
 * @param {Array<{lon:number, bas:any, kon:string, aid?:any, yrke?:any}>} rader
 * @param {number} k  minsta antal av vardera könet i en grupp (tröskeln)
 * @returns {null | {sigma:number, halv:(nKv:number, nMa:number) => number, punkter:Array<{nyckel:string, yrke:any, bas:any,
 *   aid:string, n:number, nKv:number, nMa:number, medKv:number, medMa:number, kvot:number, gransLag:number,
 *   gransHog:number, utanfor:boolean}>}} null utan grupper eller utan spridning
 */
function trattUnderlag(rader, k) {
    /** @type {Map<string, {nyckel:string, yrke:any, bas:any, aid:string, kv:number[], ma:number[], medKv?:number, medMa?:number}>} */
    const perGrupp = new Map();
    // Gruppens namn är texten på flest av dess rader (namnrader), som i resten av verktyget (ADR-89).
    const iGrupp = r => r.lon > 0 && r.bas && (arKvinna(r) || arMan(r));
    const nyckelAv = r => `${String(r.aid || r.yrke || '').trim()}|${r.bas}`;
    const namn = namnrader(rader.filter(iGrupp), nyckelAv);
    for (const r of rader) {
        if (!iGrupp(r)) continue;
        const kv = arKvinna(r);
        const aid = String(r.aid || r.yrke || '').trim(), nyckel = nyckelAv(r);
        if (!perGrupp.has(nyckel)) perGrupp.set(nyckel, { nyckel, yrke: namn.get(nyckel).yrke, bas: r.bas, aid, kv: [], ma: [] });
        /** @type {{kv: number[], ma: number[]}} */ (perGrupp.get(nyckel))[kv ? 'kv' : 'ma'].push(r.lon);
    }
    const grupper = [...perGrupp.values()].filter(g => g.kv.length >= k && g.ma.length >= k);
    if (!grupper.length) return null;
    /** @type {number[]} */
    const rest = [];
    for (const g of grupper) {
        const medKv = g.medKv = median(g.kv), medMa = g.medMa = median(g.ma);
        for (const v of g.kv) rest.push(Math.log(v) - Math.log(medKv));
        for (const v of g.ma) rest.push(Math.log(v) - Math.log(medMa));
    }
    const sigma = MAD_TILL_SIGMA * median(rest.map(Math.abs));
    if (!(sigma > 0)) return null;
    /** @param {number} nKv @param {number} nMa */
    const halv = (nKv, nMa) => 100 * Z_95 * MEDIAN_SE_FAKTOR * sigma * Math.sqrt(1 / nKv + 1 / nMa) * (1 + SMA_GRUPPER_RATTNING / Math.min(nKv, nMa));
    return { sigma, halv, punkter: grupper.map(g => {
        const medKv = /** @type {number} */ (g.medKv), medMa = /** @type {number} */ (g.medMa);
        const kvot = medKv / medMa * 100, grans = slumpensGranser(g.kv, g.ma);
        return { nyckel: g.nyckel, yrke: g.yrke, bas: g.bas, aid: g.aid, n: g.kv.length + g.ma.length, nKv: g.kv.length, nMa: g.ma.length, medKv, medMa, kvot, gransLag: grans.lag, gransHog: grans.hog,
                 utanfor: kvot < grans.lag || kvot > grans.hog }; }) };
}

// ---- Kvantilregressionens intervall ----

/** @param {any} v */
const _nyckeldel = v => (v == null ? '' : typeof v === 'number' ? v : String(v));
/**
 * Den fasta ordningen för kvantilbootstrapens rader: lön, kön, BAS-intervall, ålder och sedan AID, yrke och
 * ansvarsgrupp. Designmatrisen (kvantilDesign) bygger på lön, kön, BAS och ålder; övriga fält tas med så att
 * ordningen är fullständig också för rader som skiljer sig bara där. Tal jämförs som tal, övrigt som text.
 * @param {any} a
 * @param {any} b
 */
function _kvantilRadordning(a, b) {
    for (const f of ['lon', 'kon', 'bas', 'alder', 'aid', 'yrke', 'ansvarsgrupp']) {
        const x = _nyckeldel(a[f]), y = _nyckeldel(b[f]);
        if (x === y) continue;
        if (typeof x === 'number' && typeof y === 'number') return x - y;
        return String(x) < String(y) ? -1 : 1;
    }
    return 0;
}

/**
 * Percentil-bootstrapintervall (95 %) på kvantilregressionens könskoefficient per τ och på skillnaden P90 − P10
 * (ADR-63). Varje omsampling drar n rader med återläggning och bygger designen på nytt ur dem (kvantilDesign), så att
 * referensintervallet är det första som finns i omsamplingen och ett intervall som inte kom med inte ger en
 * nollkolumn; könskoefficienten beror inte på referensen eller centreringen. Ålder centreras på hela urvalets medel,
 * och varje omsampling startar IRLS i hela urvalets lösning (samma kolumn efter namn), vilket bara gör det snabbare.
 * Ett intervall ges när minst hälften av omsamplingarna gav en skattning. IRLS-skattningen är en approximation av
 * kvantillösningen; intervallet bootstrappar approximationen.
 * @param {any[]} raw0  kvantilDesign(...).rader: raderna som punktskattningen räknades på (i vilken ordning som helst)
 * @param {any} modell  förklaringsmodellen
 * @param {Array<{tau:number, error?:boolean, ki?:any}>} results  punktskattningarna; `ki` skrivs in i dem
 * @param {(d: any) => boolean} arKv
 * @param {{B?: number, rng?: () => number}} [val]  rng: generatorn; utan den seedad ur lönerna per kön
 * @returns {{results: Array<any>, diffKi: {lag:number, hog:number}|null, kiB:number, kiUtelamnad:string}}
 */
function kvantilBootstrap(raw0, modell, results, arKv, { B = KVANTIL_KI_B, rng } = {}) {
    const rnd = rng || rngFor(raw0.filter(arKv).map(d => d.lon), raw0.filter(d => !arKv(d)).map(d => d.lon));   // seedad ur datat → reproducerbart KI
    // Raderna sorteras på en fast, fullständig nyckel innan dragningen, så att omsamplingarna inte beror på
    // radordningen (ADR-86). Två rader som är lika i nyckeln är utbytbara i designen.
    const raw = [...raw0].sort(_kvantilRadordning);
    const n = raw.length;
    /** @type {number[][]} */
    const prov = results.map(() => []);
    /** @type {number[]} */
    const diffProv = [];
    const i10 = results.findIndex(r => r.tau === 0.1), i90 = results.findIndex(r => r.tau === 0.9);
    // Ålder centreras på hela urvalets medel (könskoefficienten beror inte på centreringen).
    const ageMean = modell.alder ? raw.reduce((s, d) => s + d.alder, 0) / n : undefined;
    // Varje omsampling startar IRLS i hela urvalets lösning (samma kolumn efter namn), vilket bara gör det snabbare.
    const hel = kvantilDesign(raw, modell, { ageMean });
    const helBeta = results.map(r => (r.error ? null : (quantileRegression(hel.X, hel.y, r.tau) || {}).beta || null));
    for (let b = 0; b < B; b++) {
        const urval = new Array(n);
        for (let i = 0; i < n; i++) urval[i] = raw[Math.floor(rnd() * n)];
        const { X, y, kolumner } = kvantilDesign(urval, modell, { ageMean });
        const konPct = results.map((r, k) => {
            if (r.error) return null;
            const b0 = helBeta[k];
            const start = b0 ? kolumner.map(c => { const j = hel.kolumner.indexOf(c); return j >= 0 ? b0[j] : 0; }) : null;
            const fit = quantileRegression(X, y, r.tau, undefined, undefined, start);
            return fit ? (Math.exp(fit.beta[1]) - 1) * 100 : null;
        });
        konPct.forEach((v, k) => { if (v != null) prov[k].push(v); });
        const p10 = i10 >= 0 ? konPct[i10] : null, p90 = i90 >= 0 ? konPct[i90] : null;
        if (p10 != null && p90 != null) diffProv.push(p90 - p10);
    }
    /** @param {number[]} v */
    const intervall = v => {
        v.sort((a, c) => a - c);
        return v.length < B / 2 ? null : percentilintervall(v);
    };
    results.forEach((r, k) => { if (!r.error) r.ki = intervall(prov[k]); });
    return { results, diffKi: intervall(diffProv), kiB: B, kiUtelamnad: '' };
}

    return { organisationensKvotKI, medianKvotKI, medianKvotKIGiltiga, konskvotPerGrupp, regressionslinjensBand, styrkeanalys, gruppMde, extremvarden, trattUnderlag, kvantilBootstrap, osakerhetKonstanter };
})();
const _osOrganisationensKvotKI = __mirrorOsakerhet.organisationensKvotKI;
const _osMedianKvotKI = __mirrorOsakerhet.medianKvotKI;
const _osMedianKvotKIGiltiga = __mirrorOsakerhet.medianKvotKIGiltiga;
const _osKonskvotPerGrupp = __mirrorOsakerhet.konskvotPerGrupp;
const _osRegressionslinjensBand = __mirrorOsakerhet.regressionslinjensBand;
const _osStyrkeanalys = __mirrorOsakerhet.styrkeanalys;
const _osGruppMde = __mirrorOsakerhet.gruppMde;
const _osExtremvarden = __mirrorOsakerhet.extremvarden;
const _osTrattUnderlag = __mirrorOsakerhet.trattUnderlag;
const _osKvantilBootstrap = __mirrorOsakerhet.kvantilBootstrap;
const _osKonstanter = __mirrorOsakerhet.osakerhetKonstanter;

// ---- speglar src/lib/lonepolitik.js ----
const __mirrorLonepolitik = (() => {
    // importer ur tidigare speglade lib-moduler
    const _median = __mirrorStat.median;
    const _quantile = __mirrorStat.quantile;
    const arKvinna = __mirrorKon.arKvinna;
    const arMan = __mirrorKon.arMan;
    const aidAvYrke = __mirrorAid.aidAvYrke;
    const namnrader = __mirrorAid.namnrader;

// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
/**
 * Öppen lönekartläggning — Lönepolitiskt ställningstagande (ren kärna)
 *
 * Rena funktioner för att analysera organisationens löneläge mot det EGNA
 * lönepolitiska ställningstagandet (P10/Median/P90 per BAS och/eller AID).
 * Separat från app.js för att kunna testas via Vitest utan DOM/state; app.js
 * får en AUTO-GENERERAD spegel (`_lp*` i src/app/09-lib-speglar.js via
 * tools/gen-mirrors.mjs) — ändra här och kör `npm run build:app`, rör ej
 * spegeln (vaktas av artefaktgrinden).
 *
 * Själva uppslaget (vilken policyrad som gäller för en grupp) görs av
 * policyFor() i app.js, eftersom det läser state; lonepolitikModell() tar emot
 * det som argument, liksom tröskeln k.
 *
 * Maskeringstrappan (tre steg, `maskeringsniva`) sätts på varje yrkesgrupp i
 * modellen; ritningen tillämpar den (`src/app/75-lonepolitik.js`). De andra
 * funktionerna räknar på det de får och rapporterar n så att anroparen kan
 * maskera.
 *
 * Bygger på: verktygets egen modell. Beräkningarna står i docs/utveckling/berakningsregister.md.
 */




/** Undre gräns för den antalsbaserade mellannivån i maskeringstrappan. */
const ANTAL_MIN = 5;

/** Konstanterna ovan i ett objekt, för appen (spegelns alias måste vara funktioner). */
function lonepolitikKonstanter() {
    return Object.freeze({ ANTAL_MIN });
}

/**
 * Organisationens faktiska lönespann i en grupp (P10, median, P90) — jämförs med
 * referensens band i bandkartan. Percentiler kräver minst k personer; annars null.
 * @returns {null|{n:number, p10:number, med:number, p90:number}}
 */
function organisationsBand(rows, k) {
    const lons = (rows || []).map(r => r.lon).filter(v => v > 0).sort((a, b) => a - b);
    if (lons.length < k) return null;
    return { n: lons.length, p10: _quantile(lons, 0.1), med: _median(lons), p90: _quantile(lons, 0.9) };
}


/**
 * Var i sitt eget lönespann ligger en lön?
 *
 * 0 = exakt på P10, 1 = exakt på P90. Värdet klämms INTE till [0,1] — ett
 * resultat < 0 betyder "under policyns golv" och > 1 "över policyns tak", och
 * det är just den informationen analysen finns till för. Anroparen klämmer vid
 * behov för ritning.
 *
 * Returnerar null när bandet inte är användbart (saknade eller icke-positiva
 * gränser, eller P90 ≤ P10 — då är positionsmåttet odefinierat/instabilt).
 *
 * @param {number} lon
 * @param {number} p10
 * @param {number} p90
 * @returns {number|null}
 */
function bandPosition(lon, p10, p90) {
    if (!(lon > 0) || !(p10 > 0) || !(p90 > 0)) return null;
    if (p90 <= p10) return null;
    return (lon - p10) / (p90 - p10);
}

/**
 * Sammanfattar en grupp mot sitt band.
 * @param {Array<{lon:number, kon?:string}>} rows
 * @param {{p10:number, med:number, p90:number}} pol
 * @returns {null|{n:number, median:number, position:number|null, medianVsPolicyPct:number|null, p10:number, med:number, p90:number}}
 */
function groupBandStats(rows, pol) {
    if (!Array.isArray(rows) || !rows.length || !pol) return null;
    const lons = rows.map(r => r.lon).filter(v => v > 0);
    if (!lons.length) return null;
    const median = _median(lons);
    return {
        n: lons.length,
        median,
        position: bandPosition(median, pol.p10, pol.p90),
        medianVsPolicyPct: pol.med > 0 ? ((median / pol.med) - 1) * 100 : null,
        p10: pol.p10, med: pol.med, p90: pol.p90
    };
}

/**
 * Hur många individer ligger under golvet, inom bandet respektive över taket?
 * Kräver positiva P10/P90; annars null.
 * @returns {null|{n:number, under:number, within:number, over:number, underPct:number, overPct:number}}
 */
function complianceCounts(rows, pol) {
    if (!Array.isArray(rows) || !rows.length || !pol) return null;
    if (!(pol.p10 > 0) || !(pol.p90 > 0)) return null;
    // Samma kontroll som bandPosition: ett inverterat band (P10 >= P90) är
    // malformerad policydata. Utan den skulle varje individ hamna i "under"
    // eller "över" och "inom spann" alltid bli 0 — ett tyst, trovärdigt fel.
    if (pol.p90 <= pol.p10) return null;
    let under = 0, over = 0, n = 0;
    for (const r of rows) {
        if (!(r.lon > 0)) continue;
        n++;
        if (r.lon < pol.p10) under++;
        else if (r.lon > pol.p90) over++;
    }
    if (!n) return null;
    return {
        n, under, over, within: n - under - over,
        underPct: (under / n) * 100,
        overPct: (over / n) * 100
    };
}

/**
 * Könsskillnad i bandposition — analysens kärnfråga: placeras kvinnor lägre i
 * SAMMA lönespann än män?
 *
 * Kräver minst `minPerKon` av varje kön (k-anonymitet + meningsfullhet).
 * diff > 0 betyder att kvinnor i snitt ligger HÖGRE i bandet än män;
 * diff < 0 att de ligger lägre.
 *
 * @param {Array<{lon:number, kon:string}>} rows
 * @param {{p10:number, p90:number}} pol
 * @param {number} [minPerKon=10]
 * @returns {null|{nKv:number, nMa:number, kvPos:number, maPos:number, diff:number}}
 */
function genderBandGap(rows, pol, minPerKon = 10) {
    if (!Array.isArray(rows) || !pol) return null;
    const posOf = r => bandPosition(r.lon, pol.p10, pol.p90);
    const kv = rows.filter(arKvinna).map(posOf).filter(v => v != null);
    const ma = rows.filter(arMan).map(posOf).filter(v => v != null);
    if (kv.length < minPerKon || ma.length < minPerKon) return null;
    const mean = a => a.reduce((s, v) => s + v, 0) / a.length;
    const kvPos = mean(kv), maPos = mean(ma);
    return { nKv: kv.length, nMa: ma.length, kvPos, maPos, diff: kvPos - maPos };
}

/**
 * Kostnad för att lyfta alla under golvet upp till policyns P10.
 * Returnerar månadsbelopp (exkl. PO) — anroparen lägger på PO-påslag och
 * beräkningsperiod från state.costSettings, som i Löneöversyn.
 * @returns {null|{nAffected:number, totalMonth:number}}
 */
function costToFloor(rows, pol) {
    if (!Array.isArray(rows) || !pol || !(pol.p10 > 0)) return null;
    // Golvet ensamt är meningsfullt även utan tak, men ett ANGIVET tak under
    // golvet betyder att bandet är felvänt — räkna då inte på det.
    if (pol.p90 > 0 && pol.p90 <= pol.p10) return null;
    let nAffected = 0, totalMonth = 0;
    for (const r of rows) {
        if (!(r.lon > 0)) continue;
        if (r.lon < pol.p10) { nAffected++; totalMonth += pol.p10 - r.lon; }
    }
    return { nAffected, totalMonth };
}

/**
 * Täckningsgrad: hur stor del av personalen omfattas över huvud taget av en
 * policyrad? En ofullständig policyfil får inte se ut som ett gott resultat —
 * "inga avvikelser" kan betyda "ingen referens".
 *
 * @param {Array<{n:number, hasPolicy:boolean}>} groups
 * @returns {{groupsTotal:number, groupsCovered:number, personsTotal:number, personsCovered:number, personsPct:number}}
 */
function policyCoverage(groups) {
    const g = Array.isArray(groups) ? groups : [];
    let personsTotal = 0, personsCovered = 0, groupsCovered = 0;
    for (const x of g) {
        const n = x && x.n > 0 ? x.n : 0;
        personsTotal += n;
        if (x && x.hasPolicy) { groupsCovered++; personsCovered += n; }
    }
    return {
        groupsTotal: g.length,
        groupsCovered,
        personsTotal,
        personsCovered,
        personsPct: personsTotal ? (personsCovered / personsTotal) * 100 : 0
    };
}

/**
 * Maskeringstrappan för en yrkesgrupp med n personer, vid tröskeln k:
 *   n >= k                    → 'full': full analys (median, band, kön)
 *   ANTAL_MIN <= n < k        → 'count': endast bandplacering i antal ("2 av 7 under P10")
 *   n < min(ANTAL_MIN, k)     → 'masked': maskerad rad, men inräknad i BAS-totalen
 * Är tröskeln ANTAL_MIN eller lägre finns ingen mellannivå.
 * @returns {'full'|'count'|'masked'}
 */
function maskeringsniva(n, k) {
    if (n >= k) return 'full';
    if (n >= ANTAL_MIN) return 'count';
    return 'masked';
}

/**
 * Lägesklassen för ett läge i spannet (0 = P10, 1 = P90): 0 under spannet, 1–3 nedre, mellersta och övre tredjedelen,
 * 4 över spannet.
 */
function lagesklass(pos) { return pos < 0 ? 0 : pos < 1 / 3 ? 1 : pos <= 2 / 3 ? 2 : pos <= 1 ? 3 : 4; }

/**
 * Antalet kvinnor och män i varje lägesklass mot bandet (personer utan användbart läge räknas inte).
 * @returns {{kv:number[], ma:number[]}}
 */
function konLagen(rows, pol) {
    const ut = { kv: [0, 0, 0, 0, 0], ma: [0, 0, 0, 0, 0] };
    for (const r of rows) {
        const kon = arKvinna(r) ? 'kv' : arMan(r) ? 'ma' : null;
        const pos = kon ? bandPosition(r.lon, pol.p10, pol.p90) : null;
        if (pos != null && isFinite(pos)) ut[kon][lagesklass(pos)]++;
    }
    return ut;
}

/**
 * Hela analysmodellen för Löneläget mot ställningstagandet: per BAS-intervall, med AID-grupperna under sig.
 * Grupperna är AID (ur yrkesfältet) × BAS; rader utan lön eller BAS räknas inte. BAS-intervallen sorteras i svensk
 * ordning, grupperna i fallande storlek.
 * @param {any[]} rader lönerader
 * @param {{policyFor:(aid:any, bas:any)=>any, nivaEtikett:(pol:any)=>any, k:number, harPolicy:boolean}} opt
 *   policyFor: policyraden som gäller (null om ingen); nivaEtikett: nivån som träffen kom ifrån, för visning;
 *   k: tröskeln som maskeringstrappan, könsgapet och organisationens band prövas mot; harPolicy: om ett
 *   ställningstagande är inläst (utan det byggs ingen modell).
 * @returns {{byBas: any[], coverage: any, hasPolicy: boolean}}
 */
function lonepolitikModell(rader, { policyFor, nivaEtikett, k, harPolicy }) {
    /** @type {{byBas: any[], coverage: any, hasPolicy: boolean}} */
    const out = { byBas: [], coverage: null, hasPolicy: !!harPolicy };
    if (!rader.length || !out.hasPolicy) return out;

    // Gruppera AID×BAS
    const groups = new Map();
    // Gruppens namn ur texten på flest av dess rader (namnrader), som i resten av verktyget (ADR-89).
    const namnrad = namnrader(rader.filter(r => r.lon > 0 && r.bas), r => aidAvYrke(r.yrke) + '|' + r.bas);
    rader.forEach(r => {
        if (!(r.lon > 0) || !r.bas) return;
        const aid = aidAvYrke(r.yrke);
        const key = aid + '|' + r.bas;
        if (!groups.has(key)) groups.set(key, { aid, bas: r.bas, yrke: namnrad.get(key).yrke, rows: [] });
        groups.get(key).rows.push(r);
    });

    const coverageInput = [];
    const basMap = new Map();
    for (const g of groups.values()) {
        const pol = policyFor(g.aid, g.bas);
        coverageInput.push({ n: g.rows.length, hasPolicy: !!pol });
        if (!basMap.has(g.bas)) basMap.set(g.bas, { bas: g.bas, rows: [], groups: [] });
        const b = basMap.get(g.bas);
        b.rows.push(...g.rows);
        b.groups.push({
            aid: g.aid, bas: g.bas, yrke: g.yrke, n: g.rows.length, rows: g.rows,
            pol, level: nivaEtikett(pol), tier: maskeringsniva(g.rows.length, k),
            stats: pol ? groupBandStats(g.rows, pol) : null,
            compliance: pol ? complianceCounts(g.rows, pol) : null
        });
    }
    out.coverage = policyCoverage(coverageInput);

    out.byBas = [...basMap.values()].map(b => {
        // BAS-nivåns eget band (AID-specifika rader gäller bara sina yrken)
        const pol = policyFor(null, b.bas);
        return {
            bas: b.bas,
            pol,
            level: nivaEtikett(pol),
            n: b.rows.length,
            stats: pol ? groupBandStats(b.rows, pol) : null,
            compliance: pol ? complianceCounts(b.rows, pol) : null,
            genderGap: pol ? genderBandGap(b.rows, pol, k) : null,
            konLagen: pol ? konLagen(b.rows, pol) : null,
            cost: pol ? costToFloor(b.rows, pol) : null,
            orgBand: organisationsBand(b.rows, k),   // organisationens eget P10–P90 (null under k)
            groups: b.groups.sort((x, y) => y.n - x.n)
        };
    }).sort((a, b) => String(a.bas).localeCompare(String(b.bas), 'sv'));

    return out;
}

    return { bandPosition, groupBandStats, complianceCounts, genderBandGap, costToFloor, policyCoverage, organisationsBand, lonepolitikModell, maskeringsniva, lagesklass, konLagen, lonepolitikKonstanter };
})();
const _lpBandPosition = __mirrorLonepolitik.bandPosition;
const _lpGroupBandStats = __mirrorLonepolitik.groupBandStats;
const _lpComplianceCounts = __mirrorLonepolitik.complianceCounts;
const _lpGenderBandGap = __mirrorLonepolitik.genderBandGap;
const _lpCostToFloor = __mirrorLonepolitik.costToFloor;
const _lpPolicyCoverage = __mirrorLonepolitik.policyCoverage;
const _lpOrganisationsBand = __mirrorLonepolitik.organisationsBand;
const _lpLonepolitikModell = __mirrorLonepolitik.lonepolitikModell;
const _lpMaskeringsniva = __mirrorLonepolitik.maskeringsniva;
const _lpLagesklass = __mirrorLonepolitik.lagesklass;
const _lpKonLagen = __mirrorLonepolitik.konLagen;
const _lpKonstanter = __mirrorLonepolitik.lonepolitikKonstanter;

// ---- speglar src/lib/prioritering.js ----
const __mirrorPrioritering = (() => {
    // importer ur tidigare speglade lib-moduler
    const median = __mirrorStat.median;
    const quantile = __mirrorStat.quantile;
    const avrundaSymmetriskt = __mirrorStat.avrundaSymmetriskt;
    const aidAvYrke = __mirrorAid.aidAvYrke;
    const namnrader = __mirrorAid.namnrader;
    const kostnadsfaktor = __mirrorKostnad.kostnadsfaktor;
    const kostnadPerAr = __mirrorKostnad.kostnadPerAr;
    const arKvinna = __mirrorKon.arKvinna;
    const arMan = __mirrorKon.arMan;

// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
/**
 * Öppen lönekartläggning — Prioriteringsanalys (ren modell)
 *
 * Grupperar raderna per AID-kod × BAS (samma grupper som jämförelsen och gruppdossiern), beräknar median, könsmedianer (med k-regeln, ADR-12),
 * avvikelse mot en referens, åtgärdskostnad (inkl. PO-påslag och beräkningsperiod, formeln i kostnad.js),
 * status mot trösklar, snabbvinst, bristyrke och det sammanvägda prioriteringsindexet.
 *
 * Modellen tar allt den behöver som parametrar och läser inget globalt tillstånd.
 * Referensen kommer utifrån som funktionen referensFor(aid, bas), så samma modell
 * används för både ställningstagandet och jämförelsestatistiken.
 *
 * Appen får modellen genom lib-speglarna (ADR-8); computePrioritization() i
 * src/app/55-prioritering.js är den tunna adaptern som läser state.
 *
 * Bygger på: verktygets egen modell, docs/utveckling/prioriteringsmodellen.md. Beräkningarna står i docs/utveckling/berakningsregister.md.
 */




// Prioriteringsmodellens tal. Alla är verktygets egna val, inte hämtade från någon extern källa.
// Bevisrutan i appen hämtar dem genom prioKonstanter(), så förklaringarna och poängen visar samma tal.
/** Avvikelsen i procent som ger full avvikelsepoäng (sev): över detta tas poängen upp till 100. */
const AVVIKELSE_TAK = 30;
/** Antalet personer i gruppen som ger full volympoäng (vol). */
const VOLYM_TAK = 50;
/** Löneskillnaden mellan kvinnor och män i procent som ger full poäng för skillnaden (gap). */
const GAP_TAK = 15;
/** Riktningsvikten för en grupp under referensen (full vikt). */
const RIKTNING_UNDER = 1.0;
/** Riktningsvikten för en grupp över referensen (halv vikt). */
const RIKTNING_OVER = 0.5;
/** Bonusmultiplikatorn för en grupp som markerats som bristyrke. */
const BRIST_MULTIPLIKATOR = 1.2;
/** Snabb vinst: kostnaden per person och månad ska vara under detta belopp i kronor. */
const SNABB_VINST_KR = 1500;
/** Snabb vinst: avvikelsen från referensen ska vara större än detta i procent. */
const SNABB_VINST_AVVIKELSE = 3;
/** Snabb vinst: gruppen ska ha minst detta antal personer (en nedre gräns, ingen övre). */
const SNABB_VINST_MIN_N = 5;

/** Konstanterna ovan i ett objekt, för appen (spegelns alias måste vara funktioner). */
function prioKonstanter() {
    return Object.freeze({ AVVIKELSE_TAK, VOLYM_TAK, GAP_TAK, RIKTNING_UNDER, RIKTNING_OVER, BRIST_MULTIPLIKATOR,
        SNABB_VINST_KR, SNABB_VINST_AVVIKELSE, SNABB_VINST_MIN_N });
}

// PO-påslaget med högst två decimaler och utan avslutande nollor (40 → "40", 39,15 → "39,15"), som svPoPct i appen
// (src/app/03-hjalpfunktioner.js).
const _PO_FORMAT = new Intl.NumberFormat('sv-SE', { maximumFractionDigits: 2 });

/**
 * Räkneexemplet om könsskillnaden i en grupp: vad skillnaden i medianlön motsvarar per år
 * för gruppens kvinnor, eller null när kvinnornas median inte ligger minst 100 kr lägre (skillnaden avrundas till
 * hundratal, som i diagrammens verktygstips) eller en median saknas. Anroparen skickar bara medianer som får
 * redovisas (båda könen når tröskeln).
 * @param {{medKv: number, medMa: number, nKv: number}} g
 * @param {{months?: number, poPct?: number}|null|undefined} costSettings
 * @param {(v: number) => string} kr  beloppsformat
 * @returns {string|null}
 */
function arsbeloppMening(g, costSettings, kr) {
    if (!g || !(g.medKv > 0) || !(g.medMa > 0) || !(g.nKv > 0)) return null;
    const diff = avrundaSymmetriskt((g.medMa - g.medKv) / 100) * 100;   // som kronorSkillnad i src/lib/figur.js
    if (diff < 100) return null;
    const { months, poPct: po } = kostnadsfaktor(costSettings);
    const belopp = Math.round(kostnadPerAr(diff, g.nKv, costSettings) / 1000) * 1000;
    return `Räkneexempel: kvinnornas medianlön ligger ${kr(diff)} per månad under männens. För gruppens ${g.nKv} kvinnor motsvarar `
        + `det omkring ${kr(belopp)} per år (${months} månader, PO-påslag ${_PO_FORMAT.format(po)} %). Det är ett räkneexempel, `
        + 'inte en kostnadsbedömning: om skillnaden har sakliga skäl bedömer HR.';
}

/**
 * Grunderna för motiveringsförslagen till en prioriteringspost: deterministiska regler över gruppens rader, i den
 * ordning förslagen visas. Texterna skriver appen (generateMotivationSuggestions i src/app/55-prioritering.js).
 *
 * Koderna: `underlag` (ett kön under minsta gruppstorlek), `styrka` (skillnaden under detektionströskeln), `alder`
 * (könens medelålder skiljer minst 3 år), `kvintil` (kvinnor överrepresenterade i lägsta lönekvintilen; kräver
 * kTroskel för båda könen, ADR-12), `brist`, `snabbVinst`, `over` (mer än 5 % över referensen) och `nara`
 * (inom ±naraGrans % av referensen, minst 10 personer).
 *
 * @param {{_rows?: Array<{kon:string, lon:number, alder?:number}>, kvN:number, maN:number, n:number, diffPct:number,
 *          isBrist?:boolean, isQuickWin?:boolean}} item
 * @param {{kInstalld:number, kTroskel:number, mdePct?:number|null, naraGrans:number}} opt
 *        kInstalld: den inställda minsta gruppstorleken; kTroskel: den gällande tröskeln; mdePct: detektionströskeln
 *        i procent (saknas den prövas inte regeln); naraGrans: uppföljningsgränsen i procent (tecknet spelar ingen roll)
 * @returns {Array<{kod:string, type:'warn'|'info'|'ok'|'flag'} & Object>}
 */
function motiveringsgrunder(item, { kInstalld, kTroskel, mdePct, naraGrans }) {
    const out = [];
    const rows = item._rows || [];
    if (!rows.length) return out;

    // Varningen gäller skattningens säkerhet, inte läget (beslut av produktägaren 2026-10-16; tidigare ett fast 5)
    if (item.kvN < kInstalld || item.maN < kInstalld) out.push({ kod: 'underlag', type: 'warn', kvN: item.kvN, maN: item.maN, k: kInstalld });

    if (mdePct != null && Math.abs(item.diffPct) < mdePct && item.n < 30) out.push({ kod: 'styrka', type: 'info', diffPct: item.diffPct, mdePct });

    const kvAges = rows.filter(r => arKvinna(r)).map(r => r.alder || 0).filter(a => a > 0);
    const maAges = rows.filter(r => arMan(r)).map(r => r.alder || 0).filter(a => a > 0);
    if (kvAges.length >= 3 && maAges.length >= 3) {
        const medelKv = kvAges.reduce((s, v) => s + v, 0) / kvAges.length;
        const medelMa = maAges.reduce((s, v) => s + v, 0) / maAges.length;
        if (Math.abs(medelMa - medelKv) >= 3) out.push({ kod: 'alder', type: 'info', medelKv, medelMa });
    }

    // Lönepositionsmått per kön: kräver tröskeln för båda könen (ADR-12)
    if (item.kvN >= kTroskel && item.maN >= kTroskel) {
        const q1 = quantile(rows.map(r => r.lon), 0.2);
        const andelKv = item.kvN > 0 ? rows.filter(r => arKvinna(r) && r.lon <= q1).length / item.kvN : 0;
        const andelMa = item.maN > 0 ? rows.filter(r => arMan(r) && r.lon <= q1).length / item.maN : 0;
        if (andelKv >= 0.4 && andelKv - andelMa >= 0.2) out.push({ kod: 'kvintil', type: 'flag', andelKv, andelMa });
    }

    if (item.isBrist) out.push({ kod: 'brist', type: 'info' });
    if (item.isQuickWin) out.push({ kod: 'snabbVinst', type: 'ok', n: item.n });
    if (item.diffPct > 5) out.push({ kod: 'over', type: 'info', diffPct: item.diffPct });

    // Ett läge mot referensen, ingen bedömning (A5)
    const nara = Math.abs(naraGrans);
    if (Math.abs(item.diffPct) < nara && item.n >= 10) out.push({ kod: 'nara', type: 'ok', nara });
    return out;
}

/**
 * Prioriteringsindexet för en grupp: riktningsvikt × (avvikelse·vikt + volym·vikt + jämställdhet·vikt),
 * multiplicerat med bristmultiplikatorn. Vikterna normaliseras till summan 100 %.
 * Skala 0–100 (före bristmultiplikatorn).
 *
 * Delpoängen (sev, vol, gap) och multiplikatorerna står på varje post som prioriteringen returnerar.
 *
 * @param {{sevScore:number, volScore:number, gapScore:number, riktningsvikt:number,
 *          bristMultiplier:number, vikter:{avvikelse:number, volym:number, jamstalldhet:number}}} delar
 * @returns {number}
 */
function prioIndex(delar) {
    const { sevScore, volScore, gapScore, riktningsvikt, bristMultiplier, vikter: w } = delar;
    const wTotal = Math.max(1, w.avvikelse + w.volym + w.jamstalldhet);
    return bristMultiplier * riktningsvikt * (
        sevScore * (w.avvikelse    / wTotal) +
        volScore * (w.volym        / wTotal) +
        gapScore * (w.jamstalldhet / wTotal)
    );
}

/**
 * Bygger prioriteringslistan (sorterad på priorityIndex, störst först).
 *
 * @param {Array<{yrke:string, bas:string, kon:string, lon:number}>} rader
 * @param {Object} opt
 * @param {(aid:string, bas:string) => ({median:number, kalla:string}|null)} opt.referensFor
 *        Referensmedian för gruppen, eller null om gruppen saknar referens.
 * @param {number} opt.kTroskel - minsta antal personer per grupp och per kön (ADR-12)
 * @param {{atgardThreshold:number, akutMinN:number, bevakaThreshold:number, analyseraThreshold:number}} opt.prioConfig
 * @param {{avvikelse:number, volym:number, jamstalldhet:number}} opt.prioWeights
 * @param {{months?:number, poPct?:number}} [opt.costSettings]
 * @param {Set<string>} [opt.bristAids] - AID-koder som markerats som bristyrke
 * @returns {Array<Object>} en post per AID-kod och BAS-intervall: `yrke` är gruppens namn (texten på flest av dess rader),
 *          `aid` AID-koden och `bas` BAS-intervallet
 */
function prioritera(rader, { referensFor, kTroskel, prioConfig, prioWeights, costSettings, bristAids }) {
    const d = rader || [];
    if (!d.length) return [];

    // En grupp är AID-koden och BAS-intervallet, som i jamforelseRader (jamforelse.js) och gruppdossiern: koden ur
    // aidAvYrke (rader utan kod grupperas på hela texten), och gruppens namn är texten på flest av dess rader
    // (namnrader). Två stavningar av samma etikett ("207011 Handläggare" och "207011 Handläggare, natt") är alltså en grupp.
    const groups = {};
    const namn = namnrader(d, r => `${aidAvYrke(r.yrke)}|${r.bas}`);
    d.forEach(r => {
        const aid  = aidAvYrke(r.yrke);
        const key  = `${aid}|${r.bas}`;
        if (!groups[key]) groups[key] = { yrke: namn.get(key).yrke, aid, bas: r.bas, rows: [] };
        groups[key].rows.push(r);
    });

    const items = [];
    Object.values(groups).forEach(g => {
        // GDPR k-anonymitet: kräver minst kTroskel personer per grupp
        if (g.rows.length < kTroskel) return;

        const lons     = g.rows.map(r => r.lon);
        const med      = median(lons);
        const kvLons   = g.rows.filter(r => arKvinna(r)).map(r => r.lon);
        const maLons   = g.rows.filter(r => arMan(r)).map(r => r.lon);
        // ADR-12: könsjämförelsen kräver kTroskel personer av vartdera könet; annars bara gruppens samlade median.
        const medKv    = kvLons.length >= kTroskel ? median(kvLons) : null;
        const medMa    = maLons.length >= kTroskel ? median(maLons) : null;
        // Skillnaden gånger 100 delat med jämförelsevärdet: en enda avrundning (se diffPct nedan).
        const gapPct   = (medKv && medMa) ? (medKv - medMa) * 100 / medMa : null;

        // Referensvärde (levereras av anroparen)
        const ref = referensFor(g.aid, g.bas);
        const refMedian = ref ? ref.median : null;
        const refSource = ref ? ref.kalla : null;
        if (!refMedian) return; // ingen referens för denna grupp – hoppa över

        const diffKr  = med - refMedian;
        // För löner i hela kronor (en median kan bli en halv krona) är kronskillnaden gånger 100 exakt, så divisionen
        // är den enda avrundningen och en avvikelse som är exakt en procentsats blir exakt den: 38 000 mot 40 000 ger
        // −5, inte −5,000000000000004 som (38 000 / 40 000 − 1) × 100. Då behövs ingen tolerans mot trösklarna
        // nedan: en grupp exakt på gränsen hamnar aldrig bortom den (prövas i tests/prioritering.test.js).
        const diffPct = diffKr * 100 / refMedian;
        // Beräkningsperiod + PO-påslag (sociala avgifter + pensioner)
        // Total kostnad för att lyfta gruppen TILL referensen (endast om under), inklusive PO
        const annualGapTotal = diffKr < 0 ? kostnadPerAr(diffKr, g.rows.length, costSettings) : 0;
        // Total överlönekostnad (för "över"-grupper)
        const annualOverTotal = diffKr > 0 ? kostnadPerAr(diffKr, g.rows.length, costSettings) : 0;

        // Prioriteringsindex med konfigurerbara viktningar
        const sevScore  = Math.min(AVVIKELSE_TAK, Math.abs(diffPct)) / AVVIKELSE_TAK * 100;
        const volScore  = Math.min(VOLYM_TAK, g.rows.length) / VOLYM_TAK * 100;
        const gapScore  = gapPct !== null ? Math.min(GAP_TAK, Math.abs(gapPct)) / GAP_TAK * 100 : 0;
        const riktningsvikt = diffPct < 0 ? RIKTNING_UNDER : RIKTNING_OVER;
        // E: Bristyrke ger en bonus-multiplikator i prioriteringen
        const isBrist = bristAids && bristAids.has(g.aid);
        const bristMultiplier = isBrist ? BRIST_MULTIPLIKATOR : 1.0;
        const priorityIndex = prioIndex({
            sevScore, volScore, gapScore, riktningsvikt,
            bristMultiplier, vikter: prioWeights
        });
        // C: Genomsnittlig revision per anställd (kr/månad) — för snabbavläsning
        const costPerPerson = diffKr < 0 ? Math.abs(diffKr) : 0;
        // B: "Snabb vinst"-flagga — liten kostnad/person men signifikant procentuellt lyft
        const isQuickWin = costPerPerson > 0 && costPerPerson < SNABB_VINST_KR && Math.abs(diffPct) > SNABB_VINST_AVVIKELSE
            && g.rows.length >= SNABB_VINST_MIN_N;

        // Status-kategori (med konfigurerbara tröskelvärden)
        const cfg = prioConfig;
        let status = 'ok';
        if (diffPct < cfg.atgardThreshold && g.rows.length >= cfg.akutMinN) status = 'akut';
        else if (diffPct < cfg.atgardThreshold)                              status = 'atgard';
        else if (diffPct < cfg.bevakaThreshold)                              status = 'bevaka';
        else if (diffPct > cfg.analyseraThreshold)                           status = 'analysera';

        items.push({
            yrke: g.yrke, aid: g.aid, bas: g.bas,
            n: g.rows.length, kvN: kvLons.length, maN: maLons.length,
            median: med, refMedian, refSource,
            diffPct, diffKr, annualGapTotal, annualOverTotal,
            costPerPerson, isQuickWin, isBrist,
            gapPct, medKv, medMa,
            sevScore, volScore, gapScore, riktningsvikt, bristMultiplier,
            priorityIndex,
            status,
            // #13 Behåll referens till rader för motivation-suggestion-engine.
            // Lättviktig kostnad — rader är samma minimerade objekt som finns i state.data.
            _rows: g.rows
        });
    });

    items.sort((a, b) => b.priorityIndex - a.priorityIndex);
    return items;
}

    return { prioritera, arsbeloppMening, prioKonstanter, motiveringsgrunder };
})();
const _prPrioritera = __mirrorPrioritering.prioritera;
const _prArsbeloppMening = __mirrorPrioritering.arsbeloppMening;
const _prKonstanter = __mirrorPrioritering.prioKonstanter;
const _prMotiveringsgrunder = __mirrorPrioritering.motiveringsgrunder;

// ---- speglar src/lib/livscykel.js ----
const __mirrorLivscykel = (() => {
    // importer ur tidigare speglade lib-moduler
    const fitOLS = __mirrorStat.fitOLS;
    const pValue2Sided = __mirrorStat.pValue2Sided;
    const tQuantile = __mirrorStat.tQuantile;
    const statusNiva = __mirrorStatus.statusNiva;
    const skapaTermer = __mirrorTermer.skapaTermer;
    const arKvinna = __mirrorKon.arKvinna;
    const arMan = __mirrorKon.arMan;

// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
/**
 * Öppen lönekartläggning — Livscykelanalys (sekundär regression, ren modell)
 *
 *   log(lön) ~ kön + ålder + ålder² + kön×ålder + kön×ålder² + C(BAS)
 *
 * Designmatrisen, OLS-skattningen med HC3-robusta standardfel, testen på kön-
 * relaterade koefficienter, prediktionerna 25–65 år med 95 % KI, gapet per ålder
 * och AIC. Modellen tar raderna och golvet som parametrar och läser inget globalt
 * tillstånd. Tolkningstexten och presentationen ligger kvar i appen.
 *
 * Appen får modellen genom lib-speglarna (ADR-8); runLifecycleRegression() i
 * src/app/52-livscykel.js är den tunna adaptern som läser getData() och statGolv().
 */





/** Standardtermerna (ADR-74). */
const T = skapaTermer();

/**
 * Trappans nivå för skillnaden vid en ålder (ADR-59, ADR-71): avståndet från lika lön är |gapPct|, och skillnaden är
 * säkerställd när modellens 95 %-intervall för den utesluter 0. Ett intervall som saknas eller inte är ändligt går
 * ej att bedöma.
 * @param {{gapPct:number, gapLoPct:number, gapHiPct:number}|null|undefined} g  en rad ur gapPerAge
 * @returns {'granska'|'folj'|'balanserat'|'ejbedomd'}
 */
function livscykelNiva(g) {
    if (!g || !isFinite(g.gapPct) || !isFinite(g.gapLoPct) || !isFinite(g.gapHiPct)) return 'ejbedomd';
    return statusNiva(Math.abs(g.gapPct), g.gapLoPct > 0 || g.gapHiPct < 0);
}

/** Gränsen för samspelet mellan kön och ålder (ADR-71): säkerställt när ett p-värde är under 0,10, inte vid exakt 0,10. */
const SAMSPEL_GRANS = 0.10;

/**
 * Är samspelet mellan kön och ålder säkerställt? Ja när något av p-värdena (kön×ålder, kön×ålder²) är under
 * SAMSPEL_GRANS. Den enda gränsen för nyckeltalet *Förändring 25–65 år*, rutan *Är förändringen säkerställd?*,
 * Att utforska och tolkningstexten. Ett p-värde som inte är ett tal säkerställer inget.
 * @param {...number} pVarden
 * @returns {boolean}
 */
function samspelSakerstallt(...pVarden) {
    return pVarden.some(p => typeof p === 'number' && p < SAMSPEL_GRANS);
}

/**
 * @param {Array<{lon:number, alder:number, kon:string, bas:string}>} rader
 * @param {{fixBas?:string|null, golv:number}} opt
 *        fixBas: BAS-intervall att fixera vid i prediktionerna (default = mest folkrika).
 *        golv: minsta antal personer per kön (statGolv() i appen).
 * @returns {Object} { error, errorCode } (errorCode no_age när ingen rad har ålder, ADR-64) eller resultat med koefficienter, prediktioner och gap per ålder.
 */
function livscykelRegression(rader, { fixBas, golv }) {
    // Ålderskolumnen är valfri (ADR-64): utan ålder finns ingen livscykel att skatta.
    if ((rader || []).length && !(rader || []).some(d => d && d.alder > 0))
        return { error: 'Lönefilen saknar ålder, så löneskillnaden över karriären kan inte skattas.', errorCode: 'no_age' };
    const raw = (rader || []).filter(d => d.lon > 0 && d.alder > 0 && (arKvinna(d) || arMan(d)));
    if (raw.length < 50) return { error: 'För få observationer (n < 50) för meningsfull livscykelanalys.', errorCode: 'low_n' };

    const kvN = raw.filter(d => arKvinna(d)).length;
    const maN = raw.filter(d => arMan(d)).length;
    if (kvN < golv || maN < golv) return { error: `Otillräcklig könsbalans (${kvN} kvinnor, ${maN} män). Minst ${golv} av varje krävs för interaktions-modell.`, errorCode: 'imbalance' };

    const basList = [...new Set(raw.map(d => d.bas))].sort();
    if (basList.length < 2) return { error: `Minst 2 ${T.niva.fl} krävs för kategorisk kodning.`, errorCode: 'single_bas' };

    // Välj default fixBas = mest folkrika BAS i organisationen om inte angivet
    if (!fixBas || !basList.includes(fixBas)) {
        const counts = {};
        raw.forEach(d => { counts[d.bas] = (counts[d.bas] || 0) + 1; });
        fixBas = basList.reduce((a, b) => (counts[b] || 0) > (counts[a] || 0) ? b : a, basList[0]);
    }

    // Centrera ålder för numerisk stabilitet (annars korrelerar ålder och ålder²)
    const ageMean = raw.reduce((s, d) => s + d.alder, 0) / raw.length;
    const ageVals = raw.map(d => d.alder - ageMean);

    // Designmatris kolumner:
    //   [0] intercept
    //   [1] isKvinna  (1 = kvinna, 0 = man)
    //   [2] age_c     (centrerad ålder)
    //   [3] age_c²
    //   [4] isKvinna × age_c   (interaktion)
    //   [5] isKvinna × age_c²  (interaktion)
    //   [6..k] BAS-dummies (k-1 st, första BAS = referens)
    const refBas = basList[0];
    const dummyBas = basList.slice(1);

    const X = [];
    const y = [];
    raw.forEach((d, i) => {
        const isKv = arKvinna(d) ? 1 : 0;
        const ac  = ageVals[i];
        const ac2 = ac * ac;
        const row = [1, isKv, ac, ac2, isKv * ac, isKv * ac2];
        dummyBas.forEach(b => row.push(d.bas === b ? 1 : 0));
        X.push(row);
        y.push(Math.log(d.lon));
    });

    const fit = fitOLS(X, y);
    if (!fit) return { error: 'Modellen kunde inte estimeras — möjlig multikollinearitet bland BAS-dummies.', errorCode: 'singular' };

    // Adj-R² och AIC för modelljämförelse
    const n = fit.n;
    const k = fit.k;
    const adjR2 = 1 - (1 - fit.R2) * (n - 1) / (n - k);
    // AIC ≈ n*ln(RSS/n) + 2k (additiv konstant utelämnad — vi använder bara för relativ jämförelse)
    // Medelvärdet räknas EN gång, utanför summeringen: inne i den blir det
    // O(n²) — på 55 000 rader tre miljarder additioner, och process-trackern
    // kör livscykelregressionen direkt efter uppladdning.
    const yMedel = y.reduce((a, b) => a + b, 0) / n;
    const rss = (1 - fit.R2) * y.reduce((s, v) => s + (v - yMedel) * (v - yMedel), 0);
    const aic = n * Math.log(rss / n) + 2 * k;

    // Tester på kön-relaterade koefficienter (huvudeffekt + interaktioner)
    const Z = tQuantile(0.975, fit.n - fit.k);   // t-kvantil för 95 % KI (1,96 vid df ≥ 100)
    const idxKv      = 1;
    const idxKvAge   = 4;
    const idxKvAge2  = 5;
    const kvCoef     = fit.beta[idxKv];
    const kvSE       = Math.sqrt(fit.vcovHC3[idxKv][idxKv]);
    const kvT        = kvSE > 0 ? kvCoef / kvSE : 0;
    const kvPValue   = pValue2Sided(kvT, fit.n, fit.k);
    const kvAgeSE    = Math.sqrt(fit.vcovHC3[idxKvAge][idxKvAge]);
    const kvAgeT     = kvAgeSE > 0 ? fit.beta[idxKvAge] / kvAgeSE : 0;
    const kvAgePVal  = pValue2Sided(kvAgeT, fit.n, fit.k);
    const kvAge2SE   = Math.sqrt(fit.vcovHC3[idxKvAge2][idxKvAge2]);
    const kvAge2T    = kvAge2SE > 0 ? fit.beta[idxKvAge2] / kvAge2SE : 0;
    const kvAge2PVal = pValue2Sided(kvAge2T, fit.n, fit.k);

    // Prediktioner för ålder 25..65 vid fixerad BAS, för båda könen
    // SE för prediktion: x' · vcovHC3 · x  → 95 % KI = exp(logLon ± Z · SE)
    const ages = [];
    for (let a = 25; a <= 65; a++) ages.push(a);

    const predict = (isKv) => ages.map(a => {
        const ac = a - ageMean;
        const ac2 = ac * ac;
        const xRow = [1, isKv, ac, ac2, isKv * ac, isKv * ac2];
        dummyBas.forEach(b => xRow.push(b === fixBas ? 1 : 0));

        // log-skala punktprediktion
        let logLon = 0;
        for (let i = 0; i < xRow.length; i++) logLon += xRow[i] * fit.beta[i];

        // Variance: x' · V · x
        let variance = 0;
        for (let i = 0; i < xRow.length; i++) {
            let inner = 0;
            for (let j = 0; j < xRow.length; j++) inner += fit.vcovHC3[i][j] * xRow[j];
            variance += xRow[i] * inner;
        }
        const se = Math.sqrt(Math.max(0, variance));

        return {
            age: a,
            lon: Math.exp(logLon),
            lo:  Math.exp(logLon - Z * se),
            hi:  Math.exp(logLon + Z * se)
        };
    });

    const predKvinna = predict(1);
    const predMan    = predict(0);

    // Nivåfaktor per BAS ur modellens egna koefficienter: exp(β_BAS − β_visat), med referensintervallets β = 0.
    // Multiplicerat med kurvan för det visade intervallet ger den modellens lönenivå i varje annat intervall.
    const idxBas = b => 6 + dummyBas.indexOf(b);
    const betaBas = b => (b === refBas ? 0 : fit.beta[idxBas(b)]);
    const basFaktor = Object.fromEntries(basList.map(b => [b, Math.exp(betaBas(b) - betaBas(fixBas))]));

    // Gap per ålder, kvinnor mot män som i huvudmodellen: log(kvinna) − log(man) = β_kv + β_kv×age·ac + β_kv×age²·ac²
    // (negativt när kvinnor ligger lägre).
    // Procentskillnad: (exp(logGap) - 1) × 100
    const gapPerAge = ages.map(a => {
        const ac = a - ageMean;
        const ac2 = ac * ac;
        const logGap = fit.beta[idxKv] + fit.beta[idxKvAge] * ac + fit.beta[idxKvAge2] * ac2;
        // SE av logGap-uttrycket (linjär kombination av tre koefficienter)
        // Var(c1·β1 + c2·β2 + c3·β3) = c'·V·c där c = [1, ac, ac²] över relevanta dimensioner
        const c = [1, ac, ac2];
        const idxs = [idxKv, idxKvAge, idxKvAge2];
        let v = 0;
        for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
            v += c[i] * c[j] * fit.vcovHC3[idxs[i]][idxs[j]];
        }
        const se = Math.sqrt(Math.max(0, v));
        const gapPct = (Math.exp(logGap) - 1) * 100;
        const gapLoPct = (Math.exp(logGap - Z * se) - 1) * 100;
        const gapHiPct = (Math.exp(logGap + Z * se) - 1) * 100;
        return { age: a, gapPct, gapLoPct, gapHiPct };
    });

    // Tolkning: nyckeltal för gapet vid 25 och 65 år och förändringen däremellan (kvinnor mot män:
    // en negativ förändring betyder att kvinnorna halkar efter med åldern)
    const gapAt25 = gapPerAge[0].gapPct;
    const gapAt65 = gapPerAge[gapPerAge.length - 1].gapPct;
    const gapDelta = gapAt65 - gapAt25;
    // Nyckeltalens status följer trappan, inte storleken ensam.
    const niva25 = livscykelNiva(gapPerAge[0]);
    const niva65 = livscykelNiva(gapPerAge[gapPerAge.length - 1]);

    return {
        ok: true,
        n, kvN, maN, k, R2: fit.R2, adjR2, aic,
        ageMean,
        basList, fixBas, refBas, basFaktor,
        predKvinna, predMan, gapPerAge,
        kvCoef, kvSE, kvPValue,
        kvAgeCoef: fit.beta[idxKvAge], kvAgePVal,
        kvAge2Coef: fit.beta[idxKvAge2], kvAge2PVal,
        gapAt25, gapAt65, gapDelta, niva25, niva65
    };
}

    return { livscykelRegression, samspelSakerstallt };
})();
const _lcLivscykelRegression = __mirrorLivscykel.livscykelRegression;
const _lcSamspelSakerstallt = __mirrorLivscykel.samspelSakerstallt;

// ---- speglar src/lib/organisationsfil.js ----
const __mirrorOrganisationsfil = (() => {
// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
/**
 * Öppen lönekartläggning — Organisationsfil: verktyget med organisationspaketet inbakat
 * (docs/utveckling/organisationsfil.md).
 *
 * Paketet läggs som en inaktiv datablock sist i HTML-filen, efter sista skriptet:
 *   <template id="(mallens id, MALL_ID)" data-skapad="…" data-organisation="…"
 *             data-verktygsversion="…" data-verktygssha="…">{ …JSON… }</template>
 * Ett <template> tolkas inte och exekveras inte; skriptens kontrollsummor i CSP:n är orörda eftersom
 * inget skript ändras. JSON-texten skrivs med `<` som \u003c och `&` som \u0026, så att den varken kan
 * avsluta elementet eller tolkas som en teckenreferens när appen läser den med textContent.
 *
 * Ren modul: bara strängar in och ut. Appen (29-organisationspaket.js) läser filen med FileReader,
 * laddar ner resultatet som Blob och läser vid start blocket ur DOM:en.
 *
 * Webbläsarbygget får en AUTO-GENERERAD spegel i src/app/09-lib-speglar.js.
 */

const MALL_ID = 'inbakat-organisationspaket';
// Mallens öppningstagg byggs ihop av delar, så att den exakta strängen inte står i källkoden (som
// följer med i den byggda filen): en sökning efter blocket får bara träffa det riktiga blocket.
const MALL_START = '<' + 'template id="' + MALL_ID + '"';
const MALL_RE = new RegExp(MALL_START.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '([^>]*)>([\\s\\S]*?)<\\/template>');
// Blocket ligger alltid efter sista skriptet; bara den delen av filen söks och ändras, så att ett skript som
// råkar innehålla liknande text aldrig rörs.
const _delad = html => { const s = String(html ?? ''); const i = s.lastIndexOf('</script>'); return i < 0 ? ['', s] : [s.slice(0, i + 9), s.slice(i + 9)]; };
const VERSION_RE = /const APP_VERSION = '([0-9]{4}\.[0-9]{2}\.[0-9]{2})'/;
const CSP_RE = /<meta http-equiv="Content-Security-Policy"/;

const _attr = v => String(v ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const _avattr = v => String(v ?? '').replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

/** Filnamnsförslag ur organisationens namn: oppen-lonekartlaggning-<slug>.html. */
function filnamnForslag(organisation) {
    const slug = String(organisation ?? '').toLowerCase().replace(/[åä]/g, 'a').replace(/ö/g, 'o')
        .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    return `oppen-lonekartlaggning-${slug || 'organisation'}.html`;
}

/** Ett filnamn som systemägaren skrivit: trimmat, utan sökvägstecken, med ändelsen .html. */
function normaliseraFilnamn(namn, organisation) {
    let n = String(namn ?? '').trim().replace(/[\\/:*?"<>|]/g, '-');
    if (!n) return filnamnForslag(organisation);
    if (!/\.html?$/i.test(n)) n += '.html';
    return n;
}

/**
 * Är texten verktyget? Kräver CSP-metataggen och verktygets eget skript. Versionen läses ur
 * skriptet när den finns (den byggda filen); källans index.html saknar den.
 * @returns {{ok:boolean, version:string|null, fel?:string}}
 */
function kannIgenVerktyget(html) {
    const s = String(html ?? '');
    if (!CSP_RE.test(s)) return { ok: false, version: null, fel: 'Filen är inte verktyget: innehållssäkerhetspolicyn saknas.' };
    if (s.lastIndexOf('</body>') < 0) return { ok: false, version: null, fel: 'Filen är inte verktyget: dokumentet är ofullständigt.' };
    const m = VERSION_RE.exec(s);
    return { ok: true, version: m ? m[1] : null };
}

/**
 * Läser det inbakade blocket ur en HTML-text.
 * @returns {null | {json:string, meta:{skapad:string, organisation:string, verktygsversion:string, verktygssha:string}}}
 */
function lasUt(html) {
    const m = MALL_RE.exec(_delad(html)[1]);
    if (!m) return null;
    const attrs = {};
    for (const a of m[1].matchAll(/data-([a-z]+)="([^"]*)"/g)) attrs[a[1]] = _avattr(a[2]);
    return { json: m[2], meta: { skapad: attrs.skapad || '', organisation: attrs.organisation || '', verktygsversion: attrs.verktygsversion || '', verktygssha: attrs.verktygssha || '' } };
}

/**
 * Bakar in paketet i verktygsfilen. Ett tidigare inbakat paket ersätts. Inget skript rörs: blocket
 * läggs före sista </body> (biblioteken innehåller strängen '</body>' i sin kod, därför det sista).
 * @param {string} html - verktygsfilen som text
 * @param {string} paketJson - paketet som JSON-text (redan validerat av anroparen)
 * @param {{skapad?:string, organisation?:string, verktygssha?:string}} [meta]
 * @returns {{ok:true, html:string, version:string|null} | {ok:false, fel:string}}
 */
function bakaIn(html, paketJson, meta = {}) {
    const k = kannIgenVerktyget(html);
    if (!k.ok) return { ok: false, fel: k.fel || 'Filen är inte verktyget.' };
    let obj;
    try { obj = JSON.parse(String(paketJson)); } catch (_e) { return { ok: false, fel: 'Paketet går inte att läsa som JSON. Spara paketet på nytt och försök igen.' }; }
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return { ok: false, fel: 'Paketet är inte ett objekt.' };
    const text = JSON.stringify(obj).replace(/</g, '\\u003c').replace(/&/g, '\\u0026');
    const [huvud, svans0] = _delad(html);
    let svans = svans0.replace(MALL_RE, '');
    const slut = svans.lastIndexOf('</body>');
    if (slut < 0) return { ok: false, fel: 'Filen är inte verktyget: dokumentet är ofullständigt.' };
    const block = `${MALL_START} data-skapad="${_attr(meta.skapad)}" data-organisation="${_attr(meta.organisation)}"`
        + ` data-verktygsversion="${_attr(k.version || '')}" data-verktygssha="${_attr(meta.verktygssha)}">${text}</template>`;
    svans = svans.slice(0, slut) + block + svans.slice(slut);
    return { ok: true, html: huvud + svans, version: k.version };
}

/** Skriptblocken i en HTML-text, för tester som hävdar att inbakningen inte rör något skript. */
function skriptBlock(html) {
    return [...String(html ?? '').matchAll(/<script\b[^>]*>[\s\S]*?<\/script[^>]*>/gi)].map(m => m[0]);
}

    return { bakaIn, filnamnForslag, normaliseraFilnamn };
})();
const _ofBakaIn = __mirrorOrganisationsfil.bakaIn;
const _ofFilnamnForslag = __mirrorOrganisationsfil.filnamnForslag;
const _ofNormaliseraFilnamn = __mirrorOrganisationsfil.normaliseraFilnamn;

// ---- speglar src/lib/htmltext.js ----
const __mirrorHtmlText = (() => {
// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
/**
 * Öppen lönekartläggning — HTML-text som vanlig text: taggarna bort och tecknen avkodade.
 *
 * Verktygets egna texter (metodbilagans regler, förslagen i gruppdossiern) är skrivna som HTML. I Excel, utskriftens
 * listor och textkopior ska de stå som vanlig text. Taggarna tas bort tills inga finns kvar (en ersättning i ett svep
 * lämnar `<scr<b>ipt>` som `<script>`), och ett ensamt `<` som blir kvar tas bort. Avkodningen tar &amp; sist, så att
 * `&amp;lt;` blir `&lt;` och inte `<`. Här står också regeln för en cell som är ett tal (`arTal`).
 *
 * Webbläsarbygget får en AUTO-GENERERAD spegel i src/app/09-lib-speglar.js.
 */

/** Texten utan HTML-taggar (entiteterna står kvar). */
function utanTaggar(text) {
    let s = String(text ?? ''), forra;
    do { forra = s; s = s.replace(/<[^<>]*>/g, ''); } while (s !== forra);
    return s.replace(/</g, '');
}

/** Texten utan HTML-taggar och med &lt; &gt; &quot; &#39; &amp; avkodade: vanlig text, ska escapas igen i HTML. */
function htmlTillText(text) {
    return utanTaggar(text).replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
}

/**
 * Cellens text är ett tal med ev. enhet ("33 932 kr", "93,6 %", "46 (28/18)", "1 427 679 kr/år", "20 / 45"), eller ett
 * intervall av två sådana ("0,9–3,8 %", och "−0,8 till 1,7 %" när ett av talen är negativt). Word-utkastet (docx.js),
 * utskriften (60-utskrift.js) och Rapporttext (67-rapportunderlag.js) håller en sådan cell på en rad.
 */
const _TAL = String.raw`[−+\-–]?[\d\s\u00a0,.%/()−–+]*\d[\d\s\u00a0,.%/()−–+]*`;
const _AR_TAL = new RegExp(String.raw`^${_TAL}(?:\still\s+${_TAL})?(kr\/år|kr\/mån|kr|mnkr|Mkr|%)?$`);
function arTal(text) {
    return _AR_TAL.test(String(text ?? '').trim());
}

    return { utanTaggar, htmlTillText, arTal };
})();
const _utanTaggar = __mirrorHtmlText.utanTaggar;
const _htmlTillText = __mirrorHtmlText.htmlTillText;
const _cellArTal = __mirrorHtmlText.arTal;

// ---- speglar src/lib/skr-personal.js ----
const __mirrorSkrPersonal = (() => {
// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
// AUTO-GENERERAD av tools/gen-skr-personal.mjs ur SKR, personalstatistik november 2025 (Tabell 4 KP, Tabell 5 RP). Ändra inte för hand.
// Per AID-etikett: antal anställningar och andel kvinnor (%) i kommuner respektive regioner.
// null = SKR redovisar inte andelen (små tal).
//
// Webbläsarbygget får en AUTO-GENERERAD spegel i src/app/09-lib-speglar.js.

const STATISTIK = Object.freeze({
    period: '2025-11',
    kalla: 'SKR, personalstatistik november 2025 (Tabell 4 KP, Tabell 5 RP)',
    etiketter: Object.freeze([
        ["101010",340,48.5,30,46.7],
        ["101011",851,61.7,281,58.4],
        ["101012",799,80.5,250,84.4],
        ["101013",417,78.2,109,85.3],
        ["101014",556,36.2,345,42.3],
        ["101015",1514,74.6,639,65.3],
        ["102010",626,87.9,9146,79.7],
        ["102510",0,null,496,84.7],
        ["103010",153,69.3,224,83],
        ["103510",3238,82.6,4,100],
        ["103511",6335,87,56,78.6],
        ["103512",3577,81.7,43,81.4],
        ["104010",1576,68,64,62.5],
        ["104011",8481,75.1,98,61.2],
        ["104012",2982,95.1,0,null],
        ["104510",1832,60.4,71,67.6],
        ["105010",3728,43.3,280,30.4],
        ["105510",637,17.1,13,30.8],
        ["106010",1241,65.8,66,60.6],
        ["106510",447,75.6,176,67],
        ["109090",2558,63.1,1148,59.1],
        ["151010",8299,73.3,2908,70],
        ["151011",4693,73.2,1682,69],
        ["151012",4145,87.4,1715,86.2],
        ["151013",2895,74.9,1117,77.7],
        ["151014",4058,46.5,3466,49.7],
        ["151015",1649,69.3,749,66.8],
        ["151016",1141,77.9,6,83.3],
        ["151017",1364,67.2,196,77],
        ["151018",731,71.3,168,73.2],
        ["151019",572,67.8,169,75.1],
        ["151020",1667,80.1,285,64.6],
        ["151021",2233,59.1,1004,60.9],
        ["151022",102,91.2,2322,82.9],
        ["151023",2730,85.4,79,87.3],
        ["151024",2556,78.8,8,75],
        ["151025",745,56.1,858,47.8],
        ["151026",1216,55.3,319,54.2],
        ["151090",5036,70.5,3105,75.2],
        ["152010",3244,85.7,502,92.6],
        ["152011",1915,91.2,755,87],
        ["152012",3445,92.3,904,92.9],
        ["152013",2050,80.6,503,73.2],
        ["152014",821,50.2,357,70.6],
        ["152015",5605,91.3,0,null],
        ["152016",4947,92.8,60,86.7],
        ["152017",1021,84.3,1357,89.9],
        ["152018",416,93,15339,97.6],
        ["152019",475,77.3,22,90.9],
        ["152020",1092,85.8,63,81],
        ["152021",56,62.5,520,69.2],
        ["152090",3372,83.1,5155,87],
        ["201010",0,null,13875,46.9],
        ["201011",0,null,3648,56.3],
        ["201012",208,85.6,7,71.4],
        ["201013",4,null,33,60.6],
        ["202010",0,null,7443,54.8],
        ["203010",0,null,9997,59.5],
        ["203020",0,null,313,60.7],
        ["203090",0,null,1624,55.9],
        ["204010",0,null,2947,62],
        ["204090",0,null,1309,58.2],
        ["204510",1366,73,5469,75.3],
        ["204511",14,85.7,535,71.8],
        ["204610",0,null,436,84.6],
        ["205010",0,null,4117,99.7],
        ["205011",0,null,1943,99.8],
        ["206010",0,null,3613,70.7],
        ["206011",1874,95.4,4532,97.8],
        ["206012",106,82.1,3221,80.7],
        ["206013",7,85.7,3234,52.5],
        ["206014",8434,89.6,148,91.9],
        ["206015",0,null,3767,85.6],
        ["206016",0,null,2846,93.3],
        ["206017",0,null,501,92.2],
        ["206018",0,null,3561,97.8],
        ["206019",3591,98.9,10,100],
        ["206020",25,92,79,96.2],
        ["206021",178,88.2,2763,88.6],
        ["206022",384,92.2,0,null],
        ["206023",137,92,4850,92.1],
        ["206090",5275,88.6,41577,87.8],
        ["206510",0,null,3120,77.1],
        ["207008",1550,95.1,779,94.1],
        ["207009",36648,81.1,83,84.3],
        ["207010",1972,84.8,37,86.5],
        ["207011",73316,89,264,92.4],
        ["207013",0,null,38022,88.7],
        ["207014",43,90.7,5919,95.5],
        ["207015",0,null,793,98.6],
        ["207016",4,null,1053,42.4],
        ["207017",26,100,309,98.1],
        ["207018",17,88.2,728,73.6],
        ["207019",52,69.2,6282,54.4],
        ["207023",714,68.5,0,null],
        ["207024",43044,73.2,428,68.2],
        ["207026",0,null,36,83.3],
        ["207029",25573,60.1,0,null],
        ["207090",8825,69.8,10028,70.8],
        ["208010",0,null,454,49.6],
        ["208011",0,null,381,63],
        ["208012",0,null,68,51.5],
        ["208013",0,null,6226,85.3],
        ["208014",0,null,112,80.4],
        ["208015",0,null,935,74.4],
        ["208016",0,null,373,70.2],
        ["208017",38,92.1,1230,88.9],
        ["208018",0,null,342,72.8],
        ["208090",6,66.7,675,73.5],
        ["251010",0,null,3075,71.5],
        ["251011",0,null,828,66.2],
        ["251013",0,null,256,64.8],
        ["252009",0,null,66,100],
        ["252010",0,null,6640,98.1],
        ["252011",0,null,1896,93.9],
        ["252012",0,null,75,70.7],
        ["252090",0,null,190,81.1],
        ["301010",3489,91.5,3717,93.6],
        ["301011",2640,76.1,5973,77.9],
        ["301012",678,88.3,34,85.3],
        ["301013",137,91.2,106,82.1],
        ["301014",370,93.8,1510,95.1],
        ["301015",7,100,767,81.6],
        ["301016",49,95.9,186,93.5],
        ["301017",34,79.4,251,90.8],
        ["301018",69,95.7,1196,94],
        ["301020",77,85.7,326,87.1],
        ["301021",367,84.5,207,90.3],
        ["301090",269,84.4,287,77],
        ["351008",8699,91.4,0,null],
        ["351009",4029,86.2,0,null],
        ["351010",11563,85.7,12,100],
        ["351011",1007,63.1,0,null],
        ["351012",6777,90.5,0,null],
        ["351013",809,81.1,6,83.3],
        ["351014",295,67.8,0,null],
        ["351015",7229,67.2,412,70.9],
        ["351016",3668,70.3,0,null],
        ["351030",4725,82,22,63.6],
        ["351031",42624,75.4,379,76.5],
        ["351032",9301,78.5,102,81.4],
        ["351033",13319,61.8,0,null],
        ["351034",2967,69.7,0,null],
        ["351035",5556,68.7,68,89.7],
        ["351040",13422,75.1,60,90],
        ["351041",14,71.4,0,null],
        ["351090",2366,72.9,11,72.7],
        ["352010",4517,86.9,4543,88.4],
        ["352090",351,67.2,226,77.4],
        ["401009",23117,92.7,0,null],
        ["401010",30452,78.3,0,null],
        ["401011",28219,65.2,0,null],
        ["401012",18827,60.3,164,64.6],
        ["401013",7940,43.9,247,55.1],
        ["401014",12168,55.8,0,null],
        ["401015",43,62.8,1064,63.6],
        ["401016",6233,91.3,28,92.9],
        ["401017",6028,93.6,461,94.6],
        ["401018",2559,85.8,0,null],
        ["401019",5534,73.9,0,null],
        ["402010",52842,96.5,48,91.7],
        ["402011",16513,69.2,21,61.9],
        ["402090",5026,72.8,123,81.3],
        ["403010",63190,91.3,0,null],
        ["403011",312,100,0,null],
        ["403012",77,84.4,0,null],
        ["403013",2388,52.3,116,51.7],
        ["403014",2915,85.1,16,93.8],
        ["403015",5228,64.5,11,72.7],
        ["403016",27697,66.4,168,70.8],
        ["403090",3949,71,33,81.8],
        ["451010",731,75.6,293,76.8],
        ["451011",5314,55.4,0,null],
        ["451012",420,67.9,85,62.4],
        ["451013",213,79.3,72,65.3],
        ["451014",664,70.5,114,65.8],
        ["451015",4763,83.1,134,83.6],
        ["451016",2006,80.5,10,100],
        ["451090",805,65.1,25,68],
        ["452010",487,61,9,55.6],
        ["452011",8643,53.8,37,67.6],
        ["452012",309,77.3,0,null],
        ["452013",836,54.4,0,null],
        ["452014",2902,59.5,8,100],
        ["452090",301,55.5,4,null],
        ["501010",3254,64.2,15,60],
        ["501011",1134,62.8,0,null],
        ["501012",726,37.1,0,null],
        ["501013",3213,72.1,0,null],
        ["502010",820,27.6,940,23],
        ["502011",1315,40.8,0,null],
        ["502012",1710,44.1,0,null],
        ["502013",2795,41.7,566,33],
        ["502014",1533,37.6,171,15.2],
        ["502016",0,null,1659,35.3],
        ["502090",467,41.1,76,31.6],
        ["503010",2893,13.7,1562,22.3],
        ["503011",97,40.2,0,null],
        ["503012",3302,8.7,1012,6.7],
        ["503013",258,10.9,95,6.3],
        ["503014",188,15.4,1651,41],
        ["503015",0,null,280,82.1],
        ["503090",880,18.3,180,14.4],
        ["509090",177,22,59,28.8],
        ["521010",292,null,15,null],
        ["521011",1569,9.2,18,null],
        ["521012",2267,8.4,0,null],
        ["521013",895,6.9,70,18.6],
        ["521014",1616,14.9,469,16.8],
        ["521015",5897,8.5,2539,23.4],
        ["521016",298,33.9,20,25],
        ["521017",210,48.6,0,null],
        ["521018",3587,31.3,88,53.4],
        ["521019",289,63,78,73.1],
        ["529090",590,27.5,139,21.6],
        ["551010",310,34.2,0,null],
        ["551011",458,15.9,0,null],
        ["551012",1066,2.9,0,null],
        ["551013",4435,8.8,0,null],
        ["601010",15919,74.7,701,61.2],
        ["601011",93,82.8,18,88.9],
        ["601012",11357,86.9,1822,78.2],
        ["609090",693,85.3,183,85.8],
        ["651010",13698,84.6,4457,77.4],
        ["651011",94,67,435,55.4],
        ["651012",1580,20.5,0,null],
        ["651013",204,29.4,655,39.4],
        ["659090",275,61.1,207,87]
    ])
});

/** SKR:s personalstatistik: { period, kalla, etiketter: [kod, nKommun, pctKommun|null, nRegion, pctRegion|null][] }. */
function skrPersonalstatistik() {
    return STATISTIK;
}

    return { skrPersonalstatistik };
})();

// ---- speglar src/lib/skrreferens.js ----
const __mirrorSkrReferens = (() => {
    // importer ur tidigare speglade lib-moduler
    const skrPersonalstatistik = __mirrorSkrPersonal.skrPersonalstatistik;
    const normaliseraAid = __mirrorAid.normaliseraAid;
    const sektorsnamn = __mirrorAid.sektorsnamn;

// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
/**
 * Öppen lönekartläggning — SKR:s personalstatistik som referens för kvinnoandel.
 *
 * Kvinnoandel per AID-etikett i kommuner, regioner eller båda tillsammans (organisationstypen),
 * vägd med antal anställningar.
 * Där SKR döljer andelen (små tal) räknas bara den del som redovisas; saknas etiketten helt
 * används prefixet (tre första siffrorna). Används som reserv i Likvärdigt arbete och som
 * referensvärde att jämföra organisationens egen könsfördelning mot.
 *
 * Webbläsarbygget får en AUTO-GENERERAD spegel i src/app/09-lib-speglar.js.
 */


const DELAR = ['alla', 'kommun', 'region'];
const _del = del => (DELAR.includes(del) ? del : 'alla');

function _vag(rader, del = 'alla') {
    let n = 0, kv = 0;
    for (const [, nK, pK, nR, pR] of rader) {
        if (pK != null && del !== 'region') { n += nK; kv += nK * pK / 100; }
        if (pR != null && del !== 'kommun') { n += nR; kv += nR * pR / 100; }
    }
    return n > 0 ? { pct: kv / n * 100, n, del } : null;
}

/** "kommuner", "regioner" eller "kommuner och regioner". */
function skrDelText(del) {
    return { kommun: 'kommuner', region: 'regioner' }[del] || 'kommuner och regioner';
}

/**
 * Kvinnoandel (%) för ett AID-prefix (tre siffror), eller null.
 * @param {string|number} prefix
 * @param {{del?: 'alla'|'kommun'|'region'}} [opt] - vilken del av statistiken (organisationstypen)
 */
function skrKvinnoandelPrefix(prefix, { del = 'alla' } = {}) {
    const rader = skrPersonalstatistik().etiketter.filter(e => String(e[0]).startsWith(String(prefix)));
    const v = _vag(rader, _del(del)) || (_del(del) !== 'alla' ? _vag(rader) : null);
    return v ? { ...v, niva: 'prefix', prefix: String(prefix) } : null;
}

/**
 * Kvinnoandel (%) för en AID-kod i den valda delen: etiketten, annars prefixet; finns yrket inte
 * alls i delen används kommuner och regioner tillsammans. null för okänd kod.
 */
function skrKvinnoandel(aid, { del = 'alla' } = {}) {
    const kod = normaliseraAid(aid);
    if (!kod) return null;
    const d = _del(del);
    const alla = skrPersonalstatistik().etiketter;
    const etikett = alla.filter(e => e[0] === kod), prefix = alla.filter(e => String(e[0]).startsWith(kod.slice(0, 3)));
    const forsok = [[etikett, d, 'etikett'], [prefix, d, 'prefix'], [etikett, 'alla', 'etikett'], [prefix, 'alla', 'prefix']];
    for (const [rader, del2, niva] of forsok) {
        const v = _vag(rader, del2);
        if (v) return { ...v, niva, prefix: kod.slice(0, 3) };
    }
    return null;
}

/** Kvinnoandel (%) för en sektor (AID-huvudområdets namn) i den valda delen, eller null. */
function skrKvinnoandelSektor(namn, { del = 'alla' } = {}) {
    const rader = skrPersonalstatistik().etiketter.filter(e => sektorsnamn(e[0]) === namn);
    const v = _vag(rader, _del(del)) || (_del(del) !== 'alla' ? _vag(rader) : null);
    return v ? { ...v, niva: 'sektor' } : null;
}

/** Källa och period för referensvärdena. */
function skrReferensInfo() {
    const s = skrPersonalstatistik();
    return { period: s.period, kalla: s.kalla };
}

    return { skrKvinnoandel, skrKvinnoandelPrefix, skrKvinnoandelSektor, skrReferensInfo, skrDelText };
})();
const _skrKvinnoandel = __mirrorSkrReferens.skrKvinnoandel;
const _skrKvinnoandelPrefix = __mirrorSkrReferens.skrKvinnoandelPrefix;
const _skrReferensInfo = __mirrorSkrReferens.skrReferensInfo;
const _skrDelText = __mirrorSkrReferens.skrDelText;

// ---- speglar src/lib/falt.js ----
const __mirrorFalt = (() => {
    // importer ur tidigare speglade lib-moduler
    const sektorsnamn = __mirrorAid.sektorsnamn;
    const mellannivaEtikett = __mirrorAid.mellannivaEtikett;
    const aidAvRad = __mirrorAid.aidAvRad;
    const namnrader = __mirrorAid.namnrader;
    const skapaTermer = __mirrorTermer.skapaTermer;
    const stor = __mirrorTermer.stor;
    const adjektiv = __mirrorTermer.adjektiv;
    const arKvinna = __mirrorKon.arKvinna;
    const arMan = __mirrorKon.arMan;

// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
/**
 * Öppen lönekartläggning — Fältåtkomst för lönerader
 *
 * Gemensamma nycklar för hur en rad grupperas och jämförs: åldersgrupp,
 * normaliserat kön och gruppnyckel per dimension. Används av src/lib/utforska.js
 * (gruppering) och src/lib/urval.js (villkor), som inte får importera varandra.
 *
 * Webbläsarbygget får en AUTO-GENERERAD spegel i src/app/09-lib-speglar.js.
 */



/** Standardtermerna (ADR-74); skapaTermer() utan egna termer ger standarduppsättningen. */
const T = skapaTermer();


const AGE_ORDER = ['<20', '20–24', '25–29', '30–34', '35–39', '40–44', '45–49',
                   '50–54', '55–59', '60–64', '65+'];

/** Ålder → 5-årsgrupp. Under 20 och från 65 får egna grupper. */
function ageBucket(alder) {
    const n = Number(alder);
    if (alder == null || !isFinite(n) || n <= 0) return null;
    if (n >= 65) return '65+';
    if (n < 20) return '<20';
    const lo = 20 + Math.floor((n - 20) / 5) * 5;
    return `${lo}–${lo + 4}`;
}

/** Sorteringsfunktion för åldersgrupper: yngst först. */
function jamforAldersgrupp(a, b) {
    return AGE_ORDER.indexOf(a) - AGE_ORDER.indexOf(b);
}

// Lönespann: 5 000 kr breda intervall, t.ex. "30 000–34 999 kr".
const LONESPANN_BREDD = 5000;
function _lonespann(lon) {
    const n = Number(lon);
    if (!(n > 0) || !isFinite(n)) return null;
    const lo = Math.floor(n / LONESPANN_BREDD) * LONESPANN_BREDD;
    return `${lo.toLocaleString('sv-SE')}–${(lo + LONESPANN_BREDD - 1).toLocaleString('sv-SE')} kr`;
}

/** Sorteringsfunktion för lönespann: lägst först. */
function jamforLonespann(a, b) {
    const lagsta = s => Number(String(s).split('–')[0].replace(/\D/g, ''));
    return lagsta(a) - lagsta(b);
}

/** Normaliserat kön för gruppering och uppdelning. */
function konOf(row) {
    if (arKvinna(row)) return 'Kvinna';
    if (arMan(row)) return 'Man';
    return 'Övrig/okänd';
}

/** Mellannivån för rader utan giltig sexsiffrig AID-kod (Utforska tappar dem annars). */
const OKAND_AID_KOD = `${stor(adjektiv('okänd', T.kod))} ${T.kod.en}`;

/** Gruppnyckel för en rad i en dimension. null = raden saknar värde där. */
function groupKey(row, dim) {
    if (dim === 'bas') return row.bas || '—';
    if (dim === 'aid') {
        if (!row.aid) return row.yrke || '—';
        return row.yrkeLabel && row.yrkeLabel !== row.aid ? `${row.aid} ${row.yrkeLabel}` : String(row.aid);
    }
    if (dim === 'alder') return ageBucket(row.alder);
    if (dim === 'kon') return konOf(row);
    if (dim === 'alla') return 'Hela urvalet';
    // Samma grupper som gruppdossiern och lönekartläggningen arbetar med.
    if (dim === 'aidbas') return `${groupKey(row, 'aid')} · BAS ${row.bas || '—'}`;
    if (dim === 'lonespann') return _lonespann(row.lon);
    // AID-hierarkin (ADR-33): sektor = huvudområde, aidniva = fyra första siffrorna.
    if (dim === 'sektor') return sektorsnamn(row.aid);
    if (dim === 'aidniva') return mellannivaEtikett(row.aid) ?? OKAND_AID_KOD;
    return null;
}

/**
 * Gruppnycklarna för ett underlag: som groupKey, men dimensionerna 'aid' och 'aidbas' grupperar på AID-koden
 * (aidAvRad), inte på texten i fältet för AID-etikett. Namnet är groupKey(rad, 'aid') för texten som står på flest
 * rader (namnrader i aid.js): för 'aid' bland kodens rader i underlaget, för 'aidbas' bland kodens rader i
 * BAS-intervallet, så att 'aidbas' bär samma namn som gruppen i resten av verktyget. Två stavningar av samma etikett
 * blir alltså en grupp med ett namn. För ett underlag där varje kod har en enda text är nycklarna desamma som groupKey ger.
 * @param {any[]} rader
 * @returns {(row: any, dim: string) => (string|null)}
 */
function gruppnycklar(rader) {
    const gruppAv = r => `${aidAvRad(r)}\u0000${r.bas || '—'}`;
    const perKod = namnrader(rader, aidAvRad), perGrupp = namnrader(rader, gruppAv);
    const namnAv = (karta, nyckel, row) => { const r = karta.get(nyckel); return groupKey(r ?? row, 'aid'); };
    return (row, dim) => {
        if (dim === 'aid') return namnAv(perKod, aidAvRad(row), row);
        if (dim === 'aidbas') return `${namnAv(perGrupp, gruppAv(row), row)} · BAS ${row.bas || '—'}`;
        return groupKey(row, dim);
    };
}

    return { groupKey, gruppnycklar, konOf, jamforAldersgrupp, jamforLonespann };
})();
const _utGroupKey = __mirrorFalt.groupKey;
const _utGruppnycklar = __mirrorFalt.gruppnycklar;
const _utKonOf = __mirrorFalt.konOf;
const _faltJamforAlder = __mirrorFalt.jamforAldersgrupp;

// ---- speglar src/lib/urval.js ----
const __mirrorUrval = (() => {
    // importer ur tidigare speglade lib-moduler
    const groupKey = __mirrorFalt.groupKey;
    const skapaTermer = __mirrorTermer.skapaTermer;
    const stor = __mirrorTermer.stor;

// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
/**
 * Öppen lönekartläggning — Urval: villkor i Utforska
 *
 * Personvillkor ({ lage: 'alla'|'nagot', villkor: [{ falt, op, varde, inte }] })
 * avgör vilka personer som ingår innan grupperna räknas. Gruppvillkor
 * ([{ matt, op, varde }], alla måste gälla) avgör vilka grupper som visas efter
 * att måtten räknats (src/lib/utforska.js gör själva uträkningen).
 *
 * Regler: ofullständiga villkor ignoreras; ett
 * saknat värde uppfyller aldrig ett villkor, inte heller när det är vänt med
 * `inte`; `mellan` är inklusive och tål omvända gränser.
 *
 * Webbläsarbygget får en AUTO-GENERERAD spegel i src/app/09-lib-speglar.js.
 */


/** Standardtermerna (ADR-74); skapaTermer() utan egna termer ger standarduppsättningen. */
const T = skapaTermer();


const FALT = {
    bas:         { typ: 'kategori', etikett: 'BAS', dim: 'bas' },
    aid:         { typ: 'kategori', etikett: stor(T.enhet.en), dim: 'aid' },
    sektor:      { typ: 'kategori', etikett: stor(T.huvudomrade.en), dim: 'sektor' },
    aldersgrupp: { typ: 'kategori', etikett: 'Åldersgrupp', dim: 'alder' },
    kon:         { typ: 'kategori', etikett: 'Kön', dim: 'kon' },
    lon:         { typ: 'tal', etikett: 'Lön', enhet: 'kr' },
    alder:       { typ: 'tal', etikett: 'Ålder', enhet: 'år' }
};
const GRUPP_MATT = {
    median:    { etikett: 'median', enhet: 'kr' },
    medel:     { etikett: 'medellön', enhet: 'kr' },
    n:         { etikett: 'n', enhet: 'st' },
    p10:       { etikett: 'P10', enhet: 'kr' },
    p25:       { etikett: 'P25', enhet: 'kr' },
    p75:       { etikett: 'P75', enhet: 'kr' },
    p90:       { etikett: 'P90', enhet: 'kr' },
    spridning: { etikett: 'spridning (P90/P10)', enhet: '' },
    andelKv:   { etikett: 'andel kvinnor', enhet: '%' },
    gap:       { etikett: 'kvinnors median i % av mäns', enhet: '%' }
};
const TAL_OP = ['storre', 'minst', 'mindre', 'hogst', 'mellan'];
const OP_TEXT = { storre: 'större än', minst: 'minst', mindre: 'mindre än', hogst: 'högst', mellan: 'mellan' };

function faltInfo() { return FALT; }
function gruppMattInfo() { return GRUPP_MATT; }

const _tal = x => typeof x === 'number' && isFinite(x);
// Gränsen för en taljämförelse, eller null om villkoret är ofullständigt.
function _grans(op, varde) {
    if (op === 'mellan') {
        if (!Array.isArray(varde) || varde.length !== 2 || !_tal(varde[0]) || !_tal(varde[1])) return null;
        return varde[0] <= varde[1] ? [varde[0], varde[1]] : [varde[1], varde[0]];
    }
    return _tal(varde) ? varde : null;
}
function _jamfor(x, op, g) {
    if (op === 'storre') return x > g;
    if (op === 'minst') return x >= g;
    if (op === 'mindre') return x < g;
    if (op === 'hogst') return x <= g;
    if (op === 'mellan') return x >= g[0] && x <= g[1];
    return false;
}

function villkorAktivt(v) {
    const f = v && FALT[v.falt];
    if (!f) return false;
    if (f.typ === 'kategori') return v.op === 'enAv' && Array.isArray(v.varde) && v.varde.length > 0;
    return TAL_OP.includes(v.op) && _grans(v.op, v.varde) !== null;
}

// Radens värde i fältet, eller null om det saknas. `nyckel` ger kategorins värde (groupKey, eller gruppnycklar(rader)
// i falt.js, som grupperar AID-etiketten på koden).
function _radVarde(rad, falt, nyckel) {
    const f = FALT[falt];
    if (f.typ === 'kategori') return nyckel(rad, f.dim);
    const x = Number(rad[falt]);
    return (rad[falt] == null || !isFinite(x) || x <= 0) ? null : x;
}
function _uppfyller(rad, v, nyckel) {
    const x = _radVarde(rad, v.falt, nyckel);
    if (x == null) return false;
    const traff = FALT[v.falt].typ === 'kategori' ? v.varde.includes(x) : _jamfor(x, v.op, _grans(v.op, v.varde));
    return v.inte ? !traff : traff;
}

/**
 * @param {any} urval
 * @param {(row: any, dim: string) => (string|null)} [nyckel] kategorins värde för en rad; gruppnycklar(rader) så att
 *        villkoren läser samma grupper som pivoten
 */
function personFilter(urval, nyckel = groupKey) {
    const aktiva = ((urval && urval.villkor) || []).filter(villkorAktivt);
    if (!aktiva.length) return () => true;
    if (urval.lage === 'nagot') return rad => aktiva.some(v => _uppfyller(rad, v, nyckel));
    return rad => aktiva.every(v => _uppfyller(rad, v, nyckel));
}

function gruppVillkorAktivt(g) {
    return !!g && Object.prototype.hasOwnProperty.call(GRUPP_MATT, g.matt)
        && TAL_OP.includes(g.op) && _grans(g.op, g.varde) !== null;
}

function uppfyllerGrupp(varden, gruppVillkor) {
    return (gruppVillkor || []).filter(gruppVillkorAktivt).every(g => {
        const x = varden ? varden[g.matt] : null;
        return _tal(x) && _jamfor(x, g.op, _grans(g.op, g.varde));
    });
}

const _fmt = (x, enhet) => {
    const s = x.toLocaleString('sv-SE', { maximumFractionDigits: 2 });
    return enhet ? `${s} ${enhet}` : s;
};
function _beskrivVillkor(v) {
    const f = FALT[v.falt];
    if (f.typ === 'kategori') return `${f.etikett} ${v.inte ? 'är inte en av' : 'är en av'} ${v.varde.join(', ')}`;
    const g = _grans(v.op, v.varde);
    const inte = v.inte ? 'inte ' : '';
    if (v.op === 'mellan') return `${f.etikett} ${inte}mellan ${_fmt(g[0], '')} och ${_fmt(g[1], f.enhet)}`;
    return `${f.etikett} ${inte}${OP_TEXT[v.op]} ${_fmt(g, f.enhet)}`;
}
function _beskrivGrupp(g) {
    const m = GRUPP_MATT[g.matt];
    const gr = _grans(g.op, g.varde);
    if (g.op === 'mellan') return `${m.etikett} mellan ${_fmt(gr[0], '')} och ${_fmt(gr[1], m.enhet)}`;
    return `${m.etikett} ${OP_TEXT[g.op]} ${_fmt(gr, m.enhet)}`;
}

/** Klartext för etiketter och export. Tom sträng när inget villkor är aktivt. */
function beskrivUrval(urval, gruppVillkor) {
    const aktiva = ((urval && urval.villkor) || []).filter(villkorAktivt);
    const grupp = (gruppVillkor || []).filter(gruppVillkorAktivt);
    const delar = [];
    if (aktiva.length) delar.push(`${urval.lage === 'nagot' ? 'Något av' : 'Alla av'}: ${aktiva.map(_beskrivVillkor).join(' · ')}`);
    if (grupp.length) delar.push(`Grupper: ${grupp.map(_beskrivGrupp).join(' · ')}`);
    return delar.join('. ');
}

    return { villkorAktivt, personFilter, gruppVillkorAktivt, uppfyllerGrupp, beskrivUrval, faltInfo, gruppMattInfo };
})();
const _urVillkorAktivt = __mirrorUrval.villkorAktivt;
const _urPersonFilter = __mirrorUrval.personFilter;
const _urGruppVillkorAktivt = __mirrorUrval.gruppVillkorAktivt;
const _urBeskrivUrval = __mirrorUrval.beskrivUrval;
const _urFaltInfo = __mirrorUrval.faltInfo;
const _urGruppMattInfo = __mirrorUrval.gruppMattInfo;

// ---- speglar src/lib/referens.js ----
const __mirrorReferens = (() => {
// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
/**
 * Öppen lönekartläggning — referensen (ställningstagandet).
 *
 * Det finns ingen inbyggd referens (ADR-28): ställningstagandet läses in som fil eller ur
 * ett organisationspaket. Modulen namnger en uppladdad fil.
 */

/** Förslag på namn för en uppladdad referensfil: filnamnet utan ändelse. */
function namnFranFil(filnamn) {
    const s = String(filnamn ?? '').trim().replace(/\.[^.]*$/, '').trim();
    return s || 'Egen referens';
}

    return { namnFranFil };
})();
const _refNamnFranFil = __mirrorReferens.namnFranFil;

// ---- speglar src/lib/forhandskontroll.js ----
const __mirrorForhandskontroll = (() => {
    // importer ur tidigare speglade lib-moduler
    const skapaTermer = __mirrorTermer.skapaTermer;

// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
/**
 * Öppen lönekartläggning — förhandskontrollen av lönefilen: hur filen tolkades, rad för rad och i sammandrag, med
 * varningar, direkt efter inläsningen.
 *
 * Ren logik utan DOM och state. Appen (32-filinlasning.js) samlar under inläsningen de tio första raderna med
 * filens råvärde och verktygets tolkning, räknar kön-värdena och skickar in de använda raderna och inläsningens
 * räknare (parseStats). Här byggs det som visas (17-forhandskontroll.js): tolkningen per cell, sammandraget,
 * värdefördelningen och varningarna. Ingen tolkning görs om här — modulen beskriver bara den som redan gjorts.
 *
 * Dataskydd: tolkningen bär högst tio rader med fem till sju fält, och yrkets råvärde följer aldrig med (yrket
 * visas som verktyget sparar det: kortat och utan tecknen < > " ' &). Varningen om namn i yrkesfältet bygger på inläsningens
 * räknare (antal rader och de första radnumren), inte på fältets text. Varningarnas texter bär inga löner eller åldrar
 * ur filen, eftersom de också står i Att göra, vars punkter kan exporteras.
 *
 * Webbläsarbygget får en AUTO-GENERERAD spegel i src/app/09-lib-speglar.js.
 */

/** Standardtermerna (ADR-74); skapaTermer() utan egna termer ger standarduppsättningen. */
const T = skapaTermer();

/** Antal rader i tolkningen. */
const FK_ANTAL_RADER = 10;
/** En medianlön över detta ser ut som en årslön. */
const FK_ARSLON_MEDIAN = 150000;
/** En medianlön under detta ser ut som en timlön. */
const FK_TIMLON_MEDIAN = 5000;
/** Den högsta lönen över så många gånger medianen är en orimlig spridning. */
const FK_SPRIDNING_GANGER = 10;
const FK_ALDER_MIN = 16;
const FK_ALDER_MAX = 75;
/** Rimlig månadslön (heltid) i tabellen Underlagets kvalitet. */
const FK_LON_MIN = 15000;
const FK_LON_MAX = 250000;
/** Ett rimligt BAS-värde är en enda bokstav (inläsningen versaliserar). */
const FK_BAS = /^[A-ZÅÄÖ]$/;
/** Gruppstorleken för andelen rader i små BAS-intervall, när ingen minsta gruppstorlek skickas in. */
const FK_SMA_GRUPP = 10;
/** Så många radnummer sparar inläsningen för varningen om namn i fältet för AID-etikett. */
const FK_NAMN_RADNR = 5;
/** Råvärden kortas till så många tecken (samma som inläsningsrapportens exempel). */
const MAX_RA = 24;
const ROLLER = ['bas', 'yrke', 'lon', 'alder', 'kon', 'poang', 'ansvar'];
// Ålder är valfri (ADR-64): kolumnen visas bara när den lästes.
const OBLIGATORISKA = ['bas', 'yrke', 'lon', 'kon'];
const ANSVAR_TEXT = { ledning: 'ledningsansvar', uppdrag: 'särskilt uppdrag', inget: 'inget särskilt ansvar' };

/** Gränsvärdena, för gränssnittets texter. */
function forhandskontrollGranser() {
    return { antalRader: FK_ANTAL_RADER, arslonMedian: FK_ARSLON_MEDIAN, timlonMedian: FK_TIMLON_MEDIAN,
        spridningGanger: FK_SPRIDNING_GANGER, alderMin: FK_ALDER_MIN, alderMax: FK_ALDER_MAX, smaGrupp: FK_SMA_GRUPP,
        namnRadnr: FK_NAMN_RADNR, lonMin: FK_LON_MIN, lonMax: FK_LON_MAX, bas: FK_BAS };
}

const _tal = new Intl.NumberFormat('sv-SE', { maximumFractionDigits: 2 });
function _fkTal(v) { return typeof v === 'number' && isFinite(v) ? _tal.format(v) : ''; }
function _fkKorta(v) {
    if (v == null) return '';
    const s = String(v).trim();
    return s.length > MAX_RA ? s.slice(0, MAX_RA) + '…' : s;
}
function _fkMedian(sorterade) {
    const n = sorterade.length;
    if (!n) return null;
    return n % 2 ? sorterade[(n - 1) / 2] : (sorterade[n / 2 - 1] + sorterade[n / 2]) / 2;
}
const _fkRader = n => `${n} ${n === 1 ? 'rad' : 'rader'}`;
const _fkPersoner = n => `${n} ${n === 1 ? 'person' : 'personer'}`;
/** "12", "12 och 40", "12, 40 och 51". */
const _fkOchLista = v => (v.length < 2 ? v.join('') : `${v.slice(0, -1).join(', ')} och ${v[v.length - 1]}`);

/**
 * Radnumren i en varning: "rad 12 och 40", eller "till exempel rad 1, 2, 3, 4 och 5" när fler rader träffats än som
 * visas. Den enda källan till formuleringen, som står i varningen om personnamn i fältet för AID-etikett
 * (namnIYrkesfaltetText och inläsningsrapportens rad) och i varningen om ålder utanför 16–75 år.
 * @param {number} antal - Rader som varningen gäller.
 * @param {Array<number|null>} [radnr] - Radnumren i filen för de första av dem, i stigande ordning.
 * @returns {string} Tom när antalet är 0 eller inga radnummer finns.
 */
function namnIYrkesfaltetRadnr(antal, radnr = []) {
    if (!(antal > 0)) return '';
    const nr = (radnr || []).filter(r => typeof r === 'number' && isFinite(r)).slice(0, FK_NAMN_RADNR);
    return nr.length ? `${nr.length < antal ? 'till exempel ' : ''}rad ${_fkOchLista(nr)}` : '';
}

/**
 * Varningen om personnamn i fältet för AID-etikett: den enda källan till texten, som står i förhandskontrollens
 * varningar och i Att göra (inläsningsrapporten har en kort rad med antalet och radnumren). Texten bär antalet
 * rader och radnumren, aldrig fältets innehåll.
 * @param {number} antal - Rader där fältet ser ut att innehålla ett namn (yrkeLiknarNamn i src/lib/inlasning.js).
 * @param {Array<number|null>} [radnr] - Radnumren i filen för de första av dem.
 * @returns {string} Tom när antalet är 0.
 */
function namnIYrkesfaltetText(antal, radnr = []) {
    if (!(antal > 0)) return '';
    const nr = namnIYrkesfaltetRadnr(antal, radnr);
    const vilka = nr ? ` (${nr})` : '';
    return `Fältet för ${T.enhet.en} ser ut att innehålla personnamn på ${_fkRader(antal)}${vilka}. Verktyget behöver inga namn. `
        + 'Ta bort namnen ur kolumnen i uttaget ur lönesystemet och läs in filen igen. Namn som står kvar kan följa med i tabeller och exporter.';
}

/**
 * En cell: råvärdet (kortat), tolkningen, skälet till att cellen markeras (eller null) och texten som visas —
 * "rå tolkat som …" när tolkningen skiljer sig från råvärdet (med ord: gränssnittet har inga pilar).
 */
function _fkCell(roll, rad) {
    const ra = _fkKorta(rad.ra?.[roll]);
    const tolkat = rad.tolkat?.[roll];
    const status = (rad.status && rad.status[roll]) || 'ok';
    const tom = ra === '';
    const visa = (tolkatText, lika) => (tom ? '(tom)' : lika ? ra : `${ra} tolkat som ${tolkatText}`);
    if (roll === 'yrke') {
        const t = String(tolkat ?? '');
        return { 'rå': null, tolkat: t, fel: t ? null : 'saknas', text: t || '(tom)' };
    }
    if (roll === 'bas') {
        const t = String(tolkat ?? '');
        const fel = !t ? 'saknas: raden faller bort' : FK_BAS.test(t) ? null : 'inte en bokstav';
        return { 'rå': ra, tolkat: t, fel, text: visa(t, ra === t) };
    }
    if (roll === 'kon') {
        const t = String(tolkat ?? '');
        const kand = t === 'kvinna' || t === 'man';
        const fel = tom ? 'saknas: raden faller bort' : kand ? null : 'okänd kod: raden faller bort';
        return { 'rå': ra, tolkat: kand ? t : null, fel, text: kand ? visa(t, ra.toLowerCase() === t) : (tom ? '(tom)' : ra) };
    }
    if (roll === 'ansvar') {
        const t = ANSVAR_TEXT[tolkat] || '';
        const fel = status === 'invalid' ? 'ogiltig kod: räknas som inget särskilt ansvar' : null;
        return { 'rå': ra, tolkat: tolkat ?? null, fel, text: tom ? '(tom)' : `${ra} tolkat som ${t || ANSVAR_TEXT.inget}` };
    }
    // Tal: lön, ålder och poäng.
    const n = typeof tolkat === 'number' && isFinite(tolkat) ? tolkat : null;
    const lika = n != null && ra === String(n);
    if (roll === 'lon') {
        const fel = status === 'invalid' ? 'kan inte läsas som tal: raden faller bort'
            : tom ? 'saknas: raden faller bort' : n == null || n <= 0 ? 'noll eller negativ: raden faller bort' : null;
        return { 'rå': ra, tolkat: n, fel, text: status === 'invalid' ? ra : visa(_fkTal(n), lika) };
    }
    if (roll === 'alder') {
        if (status === 'birthyear') return { 'rå': ra, tolkat: n, fel: null, text: `${ra} tolkat som ${_fkTal(n)} år` };
        const fel = status === 'invalid' ? 'kan inte läsas som tal' : tom ? 'saknas'
            : n != null && (n < FK_ALDER_MIN || n > FK_ALDER_MAX) ? `utanför ${FK_ALDER_MIN}–${FK_ALDER_MAX} år` : null;
        return { 'rå': ra, tolkat: n, fel, text: status === 'invalid' ? ra : visa(`${_fkTal(n)} år`, lika) };
    }
    const fel = status === 'invalid' ? 'kan inte läsas som tal' : null;
    return { 'rå': ra, tolkat: n, fel, text: status === 'invalid' ? ra : visa(_fkTal(n), lika) };
}

/**
 * Bygger förhandskontrollen.
 * @param {{
 *   rader?: Array<{radnr?: number|null, anvands: boolean, ra: Object<string, any>, tolkat: Object<string, any>, status?: Object<string, string>}>,
 *   data?: Array<{bas: string, lon: number, alder: number, kon: string, radnr?: number|null}>,
 *   konVarden?: Array<{'rå': string, tolkat: string|null, antal: number}>,
 *   parseStats?: Object<string, any>,
 *   headers?: string[],
 *   mappning?: Object<string, string|null>,
 *   k?: number,
 *   profil?: {namn: string, kalla: string}|null
 * }} indata - `rader`: filens första rader (råvärde, tolkning, status för lön/ålder/poäng/ansvar, om raden
 *   används); `data`: de använda raderna; `konVarden`: kön-kolumnens värden i hela filen; `mappning`: roll till rubrik
 *   som lästes; `k`: minsta gruppstorlek; `profil`: importprofilen som kände igen filen.
 */
function byggForhandskontroll({ rader = [], data = [], konVarden = [], parseStats = {}, headers = [], mappning = {}, k = FK_SMA_GRUPP, profil = null } = {}) {
    const ps = parseStats || {};
    const roller = ROLLER.filter(r => OBLIGATORISKA.includes(r) || (mappning && mappning[r]));
    const tolkning = rader.slice(0, FK_ANTAL_RADER).map(rad => ({
        radnr: rad.radnr ?? null, anvands: !!rad.anvands,
        celler: Object.fromEntries(roller.map(r => [r, _fkCell(r, rad)])),
    }));

    // Sammandrag ur inläsningens räknare.
    const bortfall = [];
    const lagg = (kod, antal, text, exempel = []) => { if (antal > 0) bortfall.push({ kod, antal, text, exempel: [...exempel] }); };
    lagg('bas', ps.excludedNoBas || 0, `utan ${T.niva.en}`);
    lagg('lon', ps.excludedZeroLon || 0, 'utan lön (tom, noll eller som inte går att läsa)', ps.invalidLonExamples || []);
    lagg('kon', ps.excludedMissingKon || 0, 'utan känt kön', ps.missingKonExamples || []);
    const sammandrag = {
        totalt: ps.totalRaw || 0, anvands: data.length, bortfall,
        ogiltigLon: { antal: ps.invalidLon || 0, exempel: [...(ps.invalidLonExamples || [])] },
        ogiltigAlder: { antal: ps.invalidAlder || 0, exempel: [...(ps.invalidAlderExamples || [])] },
        fodelsear: ps.alderFromBirthYear || 0,
    };

    // Värdefördelningen i de använda raderna.
    const perBas = new Map();
    for (const r of data) perBas.set(r.bas, (perBas.get(r.bas) || 0) + 1);
    const basVarden = [...perBas.entries()].map(([bas, antal]) => ({ bas, antal })).sort((a, b) => (a.bas < b.bas ? -1 : a.bas > b.bas ? 1 : 0));
    const ovanliga = basVarden.map(b => b.bas).filter(b => !FK_BAS.test(b));
    const loner = data.map(r => r.lon).filter(v => typeof v === 'number' && v > 0).sort((a, b) => a - b);
    const lon = loner.length ? { min: loner[0], median: _fkMedian(loner), max: loner[loner.length - 1] } : null;
    const aldrar = data.map(r => r.alder).filter(v => typeof v === 'number' && v > 0).sort((a, b) => a - b);
    const utanforAlder = a => typeof a === 'number' && a > 0 && (a < FK_ALDER_MIN || a > FK_ALDER_MAX);
    const utanfor = aldrar.filter(utanforAlder).length;
    const alder = aldrar.length ? { min: aldrar[0], max: aldrar[aldrar.length - 1], utanfor } : null;
    const grans = typeof k === 'number' && k > 0 ? k : FK_SMA_GRUPP;
    const sma = basVarden.filter(b => b.antal < grans);
    const smaRader = sma.reduce((s, b) => s + b.antal, 0);
    const fordelning = {
        bas: { varden: basVarden, ovanliga },
        kon: konVarden.map(v => ({ 'rå': _fkKorta(v['rå']), tolkat: v.tolkat ?? null, antal: v.antal })),
        lon, alder,
        smaBas: { k: grans, bas: sma.map(b => b.bas), rader: smaRader, andel: data.length ? smaRader / data.length : 0 },
    };

    // Varningarna. Texterna bär inga löner eller åldrar ur filen (de kan följa med Att göra ut ur verktyget).
    const varningar = [];
    const varna = (kod, niva, text) => varningar.push({ kod, niva, text });
    // Först: namn i uttaget är en fråga om dataskydd, inte om tolkningen. Bara antal och radnummer (parseStats).
    if ((ps.yrkeNamn || 0) > 0) varna('yrke-namn', 'varning', namnIYrkesfaltetText(ps.yrkeNamn, ps.yrkeNamnRadnr));
    if (lon && lon.median > FK_ARSLON_MEDIAN) {
        varna('lon-arslon', 'fel', `Medianlönen är över ${_fkTal(FK_ARSLON_MEDIAN)} kr och ser ut som en årslön. Verktyget räknar med månadslön: kontrollera lönekolumnen.`);
    } else if (lon && lon.median < FK_TIMLON_MEDIAN) {
        varna('lon-timlon', 'fel', `Medianlönen är under ${_fkTal(FK_TIMLON_MEDIAN)} kr och ser ut som en timlön. Verktyget räknar med månadslön: kontrollera lönekolumnen.`);
    } else if (lon && lon.max > FK_SPRIDNING_GANGER * lon.median) {
        varna('lon-spridning', 'varning', `Den högsta lönen är mer än ${FK_SPRIDNING_GANGER} gånger medianlönen: kontrollera om några löner är årslöner eller har fel enhet.`);
    }
    if (data.length && !data.some(r => typeof r.alder === 'number' && r.alder > 0)) {
        varna('alder-saknas', 'varning', 'Ålder saknas: analysen körs utan åldersjustering; Ålder & karriär visas inte.');
    }
    if (sammandrag.fodelsear > 0) {
        varna('alder-fodelsear', 'varning', `Åldern har räknats ut ur födelseår för ${_fkRader(sammandrag.fodelsear)}: kontrollera att ålderskolumnen verkligen är födelseår.`);
    }
    if (utanfor > 0) {
        // Bara antal och radnummer, så att raderna går att hitta i filen. Regressionen och Ålder & karriär räknar varje ålder över 0.
        const radnr = data.filter(r => utanforAlder(r.alder)).map(r => r.radnr ?? NaN).filter(Number.isFinite).sort((a, b) => a - b);
        const vilka = namnIYrkesfaltetRadnr(utanfor, radnr);
        varna('alder-utanfor', 'varning', `${_fkPersoner(utanfor)} har en ålder utanför ${FK_ALDER_MIN}–${FK_ALDER_MAX} år${vilka ? ` (${vilka})` : ''}. `
            + `${utanfor === 1 ? 'Raden räknas' : 'Raderna räknas'} med i åldersjusteringen tills filen är rättad: kontrollera ålderskolumnen och läs in filen igen.`);
    }
    if (sammandrag.ogiltigAlder.antal > 0) {
        varna('alder-ogiltig', 'varning', `${_fkRader(sammandrag.ogiltigAlder.antal)} har en ålder som inte går att läsa som tal.`);
    }
    if (ovanliga.length) {
        const visa = ovanliga.slice(0, 5).map(b => _fkKorta(b)).join(', ') + (ovanliga.length > 5 ? ' …' : '');
        varna('bas-ovanlig', 'varning', `${ovanliga.length} ${ovanliga.length === 1 ? 'BAS-värde är' : 'BAS-värden är'} inte en bokstav (${visa}): kontrollera BAS-kolumnen.`);
    }
    if ((ps.excludedMissingKon || 0) > 0) {
        varna('kon-okand', 'varning', `${_fkRader(ps.excludedMissingKon)} har ett kön som verktyget inte känner igen och faller bort.`);
    }
    if ((ps.excludedNoBas || 0) > 0) {
        varna('bortfall-bas', 'varning', `${_fkRader(ps.excludedNoBas)} saknar ${T.niva.en} och faller bort.`);
    }
    if ((ps.excludedZeroLon || 0) > 0) {
        const ogiltig = ps.invalidLon || 0;
        varna('bortfall-lon', 'varning', `${_fkRader(ps.excludedZeroLon)} saknar lön och faller bort${ogiltig ? `, varav ${ogiltig} med en lön som inte går att läsa som tal` : ''}.`);
    }

    const anvandaRubriker = new Set();
    const anvanda = [];
    for (const r of ROLLER) {
        const rubrik = mappning && mappning[r];
        if (!rubrik) continue;
        anvanda.push({ roll: r, rubrik });
        anvandaRubriker.add(rubrik);
    }
    const kolumner = {
        anvanda,
        oanvanda: (headers || []).filter(h => h && !anvandaRubriker.has(h)),
        profil: profil ? { namn: profil.namn, kalla: profil.kalla } : null,
    };
    return { tolkning, sammandrag, fordelning, varningar, kolumner };
}

    return { byggForhandskontroll, forhandskontrollGranser, namnIYrkesfaltetText, namnIYrkesfaltetRadnr };
})();
const _fkBygg = __mirrorForhandskontroll.byggForhandskontroll;
const _fkGranser = __mirrorForhandskontroll.forhandskontrollGranser;
const _fkNamnIYrkesfaltetText = __mirrorForhandskontroll.namnIYrkesfaltetText;
const _fkNamnIYrkesfaltetRadnr = __mirrorForhandskontroll.namnIYrkesfaltetRadnr;

// ---- speglar src/lib/datakvalitet.js ----
const __mirrorDatakvalitet = (() => {
    // importer ur tidigare speglade lib-moduler
    const konOf = __mirrorFalt.konOf;
    const avrundaSymmetriskt = __mirrorStat.avrundaSymmetriskt;
    const personOrd = __mirrorNamn.personOrd;
    const skapaTermer = __mirrorTermer.skapaTermer;
    const ordForAntal = __mirrorTermer.ordForAntal;
    const forhandskontrollGranser = __mirrorForhandskontroll.forhandskontrollGranser;

// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
/**
 * Öppen lönekartläggning — underlagets kvalitet (ADR-19).
 *
 * Inget viktat index: fem kriterier får status
 * OK / Varning / Kritisk; helheten är det sämsta kriteriet, så en allvarlig brist
 * kan inte spädas ut av andra delar. Könsfördelningen i organisationen är inget
 * kvalitetskriterium — den är ett fynd (könsskevhet).
 */





/** Standardtermerna (ADR-74); skapaTermer() utan egna termer ger standarduppsättningen. */
const T = skapaTermer();


const RANG = { ok: 0, varning: 1, kritisk: 2 };
/** Samma gränser för ålder, lön och BAS som förhandskontrollen: en uppgift på ett ställe. */
const { alderMin: ALDER_MIN, alderMax: ALDER_MAX, lonMin: LON_MIN, lonMax: LON_MAX, bas: BAS } = forhandskontrollGranser();

function _stat(v, okGrans, varnGrans, hogreArBattre) {
    if (v == null || !isFinite(v)) return 'kritisk';
    if (hogreArBattre) return v >= okGrans ? 'ok' : v >= varnGrans ? 'varning' : 'kritisk';
    return v <= okGrans ? 'ok' : v <= varnGrans ? 'varning' : 'kritisk';
}
const _pct = v => (v == null || !isFinite(v)) ? '–' : `${avrundaSymmetriskt(v, 1).toLocaleString('sv-SE')} %`;

/** BAS där båda könen har minst k personer (samma regel som maskeringen). */
function jamforbaraBas(rader, k) {
    const perBas = new Map();
    for (const r of rader || []) {
        const kon = konOf(r);
        if (kon === 'Övrig/okänd' || !r.bas) continue;
        const g = perBas.get(r.bas) || { kv: 0, ma: 0 };
        if (kon === 'Kvinna') g.kv++; else g.ma++;
        perBas.set(r.bas, g);
    }
    const jamforbara = [], maskerade = [];
    let iJamforbara = 0, totalt = 0;
    for (const bas of [...perBas.keys()].sort((a, b) => a.localeCompare(b, 'sv'))) {
        const g = perBas.get(bas);
        totalt += g.kv + g.ma;
        if (g.kv >= k && g.ma >= k) { jamforbara.push(bas); iJamforbara += g.kv + g.ma; }
        else maskerade.push(bas);
    }
    return { jamforbara, maskerade, andelPersoner: totalt ? iJamforbara / totalt : null };
}

/** Minsta upptäckbara skillnad i % (80 % styrka, α = 0,05) ur könskoefficientens SE (log-skala). */
function mdeFranSe(se) {
    if (typeof se !== 'number' || !isFinite(se) || se <= 0) return null;
    return (Math.exp(2.802 * se) - 1) * 100;
}

/**
 * @param {any[]} rader
 * @param {{k?:number, audit?:any, mde?:number|null, modell?:any, modellFras?:string}} [opts] modellFras = frasen för en vald
 *   förklaringsmodell som inte är standard (ADR-56); utelämnad ger standardtexten.
 */
function bedomUnderlag(rader, { k, audit, mde, modell, modellFras } = {}) {
    const d = rader || [];
    const kriterier = [];

    const j = jamforbaraBas(d, k);
    const jPct = j.andelPersoner == null ? null : j.andelPersoner * 100;
    kriterier.push({
        id: 'jamforbarhet', namn: 'Jämförbarhet', status: _stat(jPct, 80, 50, true), varde: jPct,
        text: jPct == null
            ? 'Inga personer med känt kön att jämföra.'
            : `${_pct(jPct)} av personalen finns i ${T.niva.fl} där båda könen har minst ${k} ${personOrd(k)}`
              + (j.maskerade.length ? ` (${j.maskerade.length} ${ordForAntal(j.maskerade.length, T.niva)} maskeras: ${j.maskerade.join(', ')}).` : '.'),
    });

    kriterier.push({
        id: 'styrka', namn: 'Statistisk styrka', status: _stat(mde, 2, 5, false), varde: mde,
        text: mde == null
            ? 'Styrkan kunde inte beräknas eftersom regressionen inte gick att skatta.'
            : `Den minsta könsskillnad analysen säkert kan upptäcka är ${_pct(mde)}.`
              + (mde > 5 ? ' Skillnader kring 5 % kan alltså passera oupptäckta.' : ''),
    });

    const bort = audit && audit.totalRaw > 0
        ? ((audit.excludedNoBas || 0) + (audit.excludedZeroLon || 0) + (audit.excludedMissingKon || 0)
           + Math.max(0, (audit.invalidAlder || 0) - (audit.invalidAlderUtesluten || 0))) / audit.totalRaw * 100
        : null;
    kriterier.push({
        id: 'fullstandighet', namn: 'Fullständighet', status: bort == null ? 'varning' : _stat(bort, 2, 10, false), varde: bort,
        text: bort == null
            ? 'Inläsningens räknare saknas; bortfallet är okänt.'
            : `${_pct(bort)} av filens rader föll bort eller saknar giltig ålder.`
    });

    // Ålderskolumnen är valfri (ADR-64): utan ålder i lönefilen prövas bara lön och BAS.
    const harAlder = d.some(r => r && r.alder > 0);
    const orimliga = d.filter(r => !(r.lon >= LON_MIN && r.lon <= LON_MAX)
        || (harAlder && !(r.alder >= ALDER_MIN && r.alder <= ALDER_MAX)) || !BAS.test(r.bas || '')).length;
    const orimPct = d.length ? orimliga / d.length * 100 : null;
    kriterier.push({
        id: 'rimlighet', namn: 'Rimlighet', status: _stat(orimPct, 1, 5, false), varde: orimPct,
        text: orimPct == null ? 'Inga rader att kontrollera.'
            : `${orimliga} rader (${_pct(orimPct)}) har lön under ${LON_MIN.toLocaleString('sv-SE')} eller över ${LON_MAX.toLocaleString('sv-SE')} kr, ${harAlder ? `ålder utanför ${ALDER_MIN}–${ALDER_MAX} ` : ''}eller BAS som inte är en bokstav.`,
    });

    const mStatus = modell === 'full' ? 'ok' : modell === 'minimal' ? 'varning' : 'kritisk';
    kriterier.push({
        id: 'modell', namn: 'Modell', status: mStatus, varde: modell ?? null,
        // modellFras (ADR-56): frasen för en vald modell som inte är standard; standardtexten ändras inte.
        text: modell === 'full' ? (modellFras != null ? `Regressionen tar hänsyn till ${modellFras || 'kön, utan att något räknats bort'}.` : harAlder ? `Regressionen tar hänsyn till både ålder och ${T.niva.en}.` : `Regressionen tar hänsyn till ${T.niva.en}.`)
            : modell === 'minimal' ? `Regressionen kunde bara ta hänsyn till ålder, inte ${T.niva.en}.`
            : 'Regressionen gick inte att skatta.',
    });

    const status = kriterier.reduce((s, c) => RANG[c.status] > RANG[s] ? c.status : s, 'ok');
    return { status, kriterier };
}

    return { jamforbaraBas, mdeFranSe, bedomUnderlag };
})();
const _dqJamforbaraBas = __mirrorDatakvalitet.jamforbaraBas;
const _dqMdeFranSe = __mirrorDatakvalitet.mdeFranSe;
const _dqBedomUnderlag = __mirrorDatakvalitet.bedomUnderlag;

// ---- speglar src/lib/gapuppdelning.js ----
const __mirrorGapuppdelning = (() => {
    // importer ur tidigare speglade lib-moduler
    const gruppnycklar = __mirrorFalt.gruppnycklar;
    const konOf = __mirrorFalt.konOf;
    const skapaTermer = __mirrorTermer.skapaTermer;
    const stor = __mirrorTermer.stor;
    const personOrd = __mirrorNamn.personOrd;
    const sammanslagning = __mirrorUndertryckning.sammanslagning;

// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
/**
 * Öppen lönekartläggning — Var uppstår löneskillnaden? (ADR-22, valbara variabler ADR-65)
 *
 * Delar gapet i medellön (kvinnor − män, kr/mån; negativt när kvinnor ligger lägre) i delar som summerar exakt.
 * Standardvalet är variablerna BAS och AID, i den ordningen, och ger tre delar:
 *   A  BAS-fördelning       Σ_b Δs_b · (W̄_b − W̄)
 *   B  AID inom BAS         Σ_b s̄_b · Σ_a Δs_a|b · (W̄_ab − W̄_b)
 *   C  inom AID och BAS     Σ_b s̄_b · Σ_a s̄_a|b · ΔW_ab
 * Allmänt, med variablerna v_1 … v_n (1 ≤ n ≤ 4) nästlade i den ordningen: varje cell c på nivå i−1 har vikten
 * ω_c = produkten av s̄ längs vägen från roten (roten: ω = 1, hela urvalet). Då är
 *   del i (1 ≤ i ≤ n)   Σ_c ω_c · Σ_{barn b av c} Δs_b|c · (W̄_b − W̄_c)
 *   del n+1 (inom)      Σ_{löv l} ω_l · ΔW_l,  där ω_l = ω_förälder · s̄_l
 * Summan är exakt ΔW för roten, eftersom ΔW_c = Σ_b Δs_b|c · W̄_b + Σ_b s̄_b|c · ΔW_b (symmetriskt, ΔX·Ȳ + X̄·ΔY).
 * Δx = x_kvinnor − x_män, x̄ = (x_män + x_kvinnor) / 2 (symmetriskt, inget referenskön).
 * Saknas ett kön i en cell sätts dess medellön lika med det andra könets; cellen bidrar då bara till sin
 * fördelningsdel, och inget under den räknas (ΔW = 0). Centreringen (− W̄_c) ändrar inga summor
 * eftersom Σ Δs = 0, men gör varje grupps post tolkbar.
 * Grupper där ett kön har 1 till k − 1 personer räknas samman med andra grupper under samma cell innan delarna räknas
 * (ADR-87, `sammanslagning` i undertryckning.js), och den sammanslagna gruppen namnges inte; se _beraknaPoster.
 * AID-nivåerna (sektor, aidniva, aid) ordnas alltid grovt till fint på sina platser: en finare nivå före en grövre
 * ger annars en tom del. Ålder (åldersgrupp, ageBucket) kan bara väljas när lönefilen har ålder (ADR-64).
 *
 * Webbläsarbygget får en AUTO-GENERERAD spegel i src/app/09-lib-speglar.js.
 */





/** Standardtermerna (ADR-74). */
const T = skapaTermer();

/** Variablerna i den ordning gränssnittet visar dem. */
const GAP_VARIABLER = ['bas', 'sektor', 'aidniva', 'aid', 'alder'];
const GAP_VARIABLER_STANDARD = ['bas', 'aid'];
/** Alla variabler, i gränssnittets ordning (en kopia). */
function gapAllaVariabler() { return [...GAP_VARIABLER]; }
/** Standardvalet BAS, AID (en kopia). */
function gapStandardVariabler() { return [...GAP_VARIABLER_STANDARD]; }
const GAP_MAX = 4;
// AID-hierarkin, grov till fin (ADR-33).
const AID_NIVAER = ['sektor', 'aidniva', 'aid'];

// Ord per variabel: etikett (kryssrutan), liten (i löptext: "inom samma …"), fordelning (del 1), over ("fördelade över …"
// i kortet), overKort (samma i rapportunderlaget), olika ("har olika … inom samma"), post (en grupps namn). Sektor är
// AID:s huvudområde; orden för det, BAS-intervallet och AID-koden kommer ur termerna (ADR-74).
const ORD = {
    bas: { etikett: 'BAS', liten: 'BAS', fordelning: 'BAS-fördelning', over: T.niva.bfl, overKort: 'BAS', olika: 'BAS', post: n => `BAS ${n}` },
    sektor: { etikett: stor(T.huvudomrade.en), liten: T.huvudomrade.en, fordelning: `Fördelning över ${T.huvudomrade.fl}`, over: T.huvudomrade.bfl, overKort: T.huvudomrade.fl, olika: T.huvudomrade.en, post: n => n },
    aidniva: { etikett: 'AID-mellannivå', liten: 'AID-mellannivå', fordelning: 'Fördelning över AID-mellannivåer', over: 'AID-mellannivåerna', overKort: 'AID-mellannivåer', olika: 'AID-mellannivå', post: n => n },
    aid: { etikett: 'AID', liten: 'AID', fordelning: 'AID-fördelning', over: T.kod.bfl, overKort: 'AID', olika: 'AID', post: n => n },
    alder: { etikett: 'Åldersgrupp', liten: 'åldersgrupp', fordelning: 'Åldersfördelning', over: 'åldersgrupperna', overKort: 'åldersgrupper', olika: 'ålder', post: n => n === '—' ? 'ålder saknas' : `${n} år` },
};

/** Etiketten för en variabel (kryssrutan, rapportunderlaget). @param {string} v */
function gapVariabelEtikett(v) { return ORD[v] ? ORD[v].etikett : String(v); }

const _versal = t => t.charAt(0).toUpperCase() + t.slice(1);
// Gemen i löptext, utom förkortningar (BAS, AID).
const _gemen = t => (t.length > 1 && t[1] === t[1].toUpperCase() && t[1] !== t[1].toLowerCase()) ? t : t.charAt(0).toLowerCase() + t.slice(1);
const _och = a => a.length <= 1 ? (a[0] || '') : `${a.slice(0, -1).join(', ')} och ${a[a.length - 1]}`;

/**
 * Normaliserar ett val från konfigurationsfilen eller gränssnittet: bara kända variabler, inga dubbletter, högst fyra,
 * AID-nivåerna grovt till fint och åldersgrupp bara när lönefilen har ålder. Ett tomt eller ogiltigt val ger
 * standard med en varning; null ger standard utan varning.
 * @param {any} v
 * @param {{harAlder?: boolean}} [opts]
 * @returns {{variabler: string[], varningar: string[]}}
 */
function normaliseraGapVariabler(v, { harAlder = true } = {}) {
    const varningar = [];
    if (v == null) return { variabler: [...GAP_VARIABLER_STANDARD], varningar };
    if (!Array.isArray(v)) {
        varningar.push('Uppdelningens variabler gick inte att läsa; standardvalet BAS och AID används.');
        return { variabler: [...GAP_VARIABLER_STANDARD], varningar };
    }
    let val = [...new Set(v.filter(x => typeof x === 'string' && GAP_VARIABLER.includes(x)))];
    if (val.length > GAP_MAX) {
        val = val.slice(0, GAP_MAX);
        varningar.push('Högst fyra variabler kan väljas; de första fyra används.');
    }
    if (!harAlder && val.includes('alder')) {
        val = val.filter(x => x !== 'alder');
        varningar.push('Åldersgrupp kan inte väljas: lönefilen saknar ålder.');
    }
    if (!val.length) {
        if (!varningar.length) varningar.push('Uppdelningen behöver minst en variabel; standardvalet BAS och AID används.');
        return { variabler: [...GAP_VARIABLER_STANDARD], varningar };
    }
    // AID-nivåerna på sina platser, grovt till fint.
    const platser = val.map((x, i) => AID_NIVAER.includes(x) ? i : -1).filter(i => i >= 0);
    const nivaer = platser.map(i => val[i]).sort((a, b) => AID_NIVAER.indexOf(a) - AID_NIVAER.indexOf(b));
    platser.forEach((p, j) => { val[p] = nivaer[j]; });
    return { variabler: val, varningar };
}

/** Sant när valet (efter normalisering) är standardvalet BAS, AID. @param {any} v */
function gapVariablerArStandard(v) {
    const n = normaliseraGapVariabler(v).variabler;
    return n.length === GAP_VARIABLER_STANDARD.length && n.every((x, i) => x === GAP_VARIABLER_STANDARD[i]);
}

/**
 * Delarna för ett val: id (A, B, …), namn, variabel (null för den sista, "inom"), texten i kortet (betyder) och
 * frasen i rapportunderlaget (orsak: "på …"). Standardvalet ger texterna från före ADR-65.
 * @param {string[]} variabler normaliserade
 * @returns {{id: string, namn: string, variabel: string|null, betyder: string, orsak: string}[]}
 */
function gapDelar(variabler) {
    const v = variabler && variabler.length ? variabler : GAP_VARIABLER_STANDARD;
    const inom = i => _och(v.slice(0, i).reverse().map(x => ORD[x].liten));   // finast först: "AID och BAS"
    /** @type {{id: string, namn: string, variabel: string|null, betyder: string, orsak: string}[]} */
    const delar = v.map((x, i) => i === 0
        ? { id: 'ABCDE'[i], namn: ORD[x].fordelning, variabel: x, betyder: `Kvinnor och män är olika fördelade över ${ORD[x].over}.`,
            orsak: `på att kvinnor och män är olika fördelade över ${ORD[x].overKort}` }
        : { id: 'ABCDE'[i], namn: `${_versal(ORD[x].liten)} inom ${inom(i)}`, variabel: x,
            betyder: `Kvinnor och män har olika ${ORD[x].olika} inom samma ${inom(i)}.`, orsak: `på olika ${ORD[x].olika} inom samma ${inom(i)}` });
    // Den sista delen är det fördelningen inte förklarar (motsvarar regressionens oförklarade skillnad).
    delar.push({ id: 'ABCDE'[v.length], namn: `Oförklarat: lön inom samma ${inom(v.length)}`, variabel: null,
        betyder: `Kvinnor och män har olika lön i samma ${inom(v.length)}. Det är den del av skillnaden som fördelningen inte förklarar; en grupp med bara kvinnor eller bara män går inte att jämföra och räknas i stället till delarna ovan.`, orsak: `på löneskillnader inom samma ${inom(v.length)}` });
    return delar;
}

/** Variablerna i löptext, i valets ordning: "BAS, åldersgrupp och AID". @param {string[]} variabler */
function gapVariablerIText(variabler) { return _och((variabler || []).map(x => ORD[x] ? ORD[x].liten : String(x))); }

/** Delarna i en mening: "BAS-fördelning, AID inom BAS och lön inom samma AID och BAS". @param {string[]} variabler */
function gapDelarIText(variabler) {
    const v = variabler && variabler.length ? variabler : GAP_VARIABLER_STANDARD;
    const d = gapDelar(v);
    return _och([...d.slice(0, -1).map(x => _gemen(x.namn)), `lön inom samma ${_och(v.slice().reverse().map(x => ORD[x].liten))}`]);
}

const _medel = rader => rader.reduce((s, r) => s + r.lon, 0) / rader.length;

function _grupper(kv, ma, nyckel) {
    const m = new Map();
    const lagg = (r, g) => {
        const key = nyckel(r);
        if (!m.has(key)) m.set(key, { kv: [], ma: [] });
        m.get(key)[g].push(r);
    };
    kv.forEach(r => lagg(r, 'kv'));
    ma.forEach(r => lagg(r, 'ma'));
    return m;
}

// Grupperna under en cell, med sammanslagningen (ADR-87): en grupp där ett kön har 1 till k − 1 personer räknas samman
// med andra grupper under samma cell (`sammanslagning` i undertryckning.js), så att varje grupp som delarna och posterna
// bygger på har 0 eller minst k kvinnor och 0 eller minst k män. Den sammanslagna gruppen står sist och namnges inte.
// Utan små grupper är ordningen densamma som i _grupper, så att talen blir bitlika med dem före regeln.
function _grupperMedSammanslagning(kv, ma, nyckel, k) {
    const grupper = [..._grupper(kv, ma, nyckel)];
    const samman = sammanslagning(grupper.map(([key, g]) => ({ namn: String(key), nKv: g.kv.length, nMa: g.ma.length })), k);
    const egna = (samman.length ? grupper.filter((_, i) => !samman.includes(i)) : grupper).map(([key, g]) => ({ key, g, namnges: true }));
    if (!samman.length) return egna;
    const ihop = { kv: samman.flatMap(i => grupper[i][1].kv), ma: samman.flatMap(i => grupper[i][1].ma) };
    return [...egna, { key: null, g: ihop, namnges: false }];
}

// Andelar och medellöner för en grupp; saknat kön får det andra könets medellön.
function _cell(g, totKv, totMa) {
    const wKv0 = g.kv.length ? _medel(g.kv) : null, wMa0 = g.ma.length ? _medel(g.ma) : null;
    // Grupperna har alltid minst en person, så båda blir tal; ?? 0 för typkontrollen.
    const wKv = wKv0 ?? wMa0 ?? 0, wMa = wMa0 ?? wKv0 ?? 0;
    return {
        sKv: g.kv.length / totKv, sMa: g.ma.length / totMa, wKv, wMa, w: (wKv + wMa) / 2,
        bada: g.kv.length > 0 && g.ma.length > 0,
    };
}

/** @typedef {{namn:string, kr:number, synlig:boolean, grupper:number, nKv:number, nMa:number}} Post */

// Alla poster per del (A, B, …). En post är en grupp efter sammanslagningen; synlig = gruppen och alla dess
// övergrupper är egna grupper, inte sammanslagna, och får namnges. grupper = hur många grupper på samma nivå före
// sammanslagningen posten står för (1 för en synlig post), nKv och nMa gruppens antal. null när ett kön har färre än k i hela urvalet. Posterna
// läggs i samma ordning och räknas med samma operationer som före ADR-65 (djupet först, vikten ω multipliceras från
// vänster), så att standardvalet utan små grupper ger bitlika tal.
//
// Skyddet (ADR-87, `docs/utveckling/k-troskeln.md` avsnitt 2): allt som skrivs ut — medellönerna, delarna och posterna —
// är en linjär funktion av medellönen per kön i grupperna efter sammanslagningen, med antalen som vikter. Varje sådan
// grupp har 0 eller minst k av varje kön, och alla i en grupp har samma vikt. Det som går att räkna fram ur det som
// skrivs ut, också med antalen, är därför ett medel för minst k personer av ett kön eller en vägd summa av sådana medel.
function _beraknaPoster(rader, k, variabler) {
    const kv = [], ma = [];
    for (const r of rader || []) {
        if (!(r.lon > 0)) continue;
        const g = konOf(r);
        if (g === 'Kvinna') kv.push(r);
        else if (g === 'Man') ma.push(r);
    }
    if (kv.length < k || ma.length < k) return null;

    const medel = { kv: _medel(kv), ma: _medel(ma) };
    const wTot = (medel.ma + medel.kv) / 2;
    const n = variabler.length;
    /** @type {Record<string, Post[]>} */
    const poster = {};
    for (let i = 0; i <= n; i++) poster['ABCDE'[i]] = [];
    // AID-etiketten grupperas på koden, med namnet från texten på flest av kodens rader (gruppnycklar i falt.js).
    const gruppnyckel = gruppnycklar(rader);
    const nyckel = v => r => gruppnyckel(r, v) ?? '—';   // åldersgrupp saknas (ålder 0) blir en egen grupp
    // Antalet grupper på nivån `djup` (1 = första variabeln) bland raderna, räknat före sammanslagningen.
    const antalGrupper = (g, djup) => new Set([...g.kv, ...g.ma].map(r => variabler.slice(0, djup).map(v => nyckel(v)(r)).join('\u0001'))).size;

    // Cellen på nivå `niva` (0 = roten) med vikten ω (null i roten), medellönen w, namnen uppåt och om alla
    // överceller får namnges.
    const ner = (gkv, gma, niva, omega, w, namn, synligUppat) => {
        const v = variabler[niva];
        for (const { key, g, namnges } of _grupperMedSammanslagning(gkv, gma, nyckel(v), k)) {
            const c = _cell(g, gkv.length, gma.length);
            const cNamn = [namnges ? ORD[v].post(key) : `sammanslagna ${ORD[v].overKort}`, ...namn];
            const synlig = namnges && synligUppat;
            const delta = c.sKv - c.sMa;
            poster['ABCDE'[niva]].push({ namn: cNamn.join(', '), kr: omega === null ? delta * (c.w - w) : omega * delta * (c.w - w),
                synlig, grupper: synlig ? 1 : antalGrupper(g, niva + 1), nKv: g.kv.length, nMa: g.ma.length });
            if (niva + 1 < n) {
                if (!c.bada) continue;   // ΔW_c = 0 — cellen bidrar inte längre ner
                const sc = (c.sKv + c.sMa) / 2;
                ner(g.kv, g.ma, niva + 1, omega === null ? sc : omega * sc, c.w, cNamn, synlig);
            } else {
                const sc = (c.sKv + c.sMa) / 2;
                poster['ABCDE'[n]].push({ namn: cNamn.join(', '), kr: omega === null ? sc * (c.wKv - c.wMa) : omega * sc * (c.wKv - c.wMa),
                    synlig, grupper: synlig ? 1 : antalGrupper(g, n), nKv: g.kv.length, nMa: g.ma.length });
            }
        }
    };
    ner(kv, ma, 0, null, wTot, [], true);
    return { kv, ma, medel, poster };
}

/** Samtliga poster, även de som inte namnges — bara för tester av skyddet; redovisas aldrig. */
/**
 * @param {any[]} rader
 * @param {{k?:number, variabler?:any}} [opts]
 */
function gapPoster(rader, { k, variabler } = {}) {
    const r = _beraknaPoster(rader, k, _variablerFor(rader, variabler));
    return r ? r.poster : null;
}

// Valet normaliserat mot underlaget: åldersgrupp bara när lönefilen har ålder (ålder 0 = saknas, ADR-64).
const _variablerFor = (rader, variabler) => normaliseraGapVariabler(variabler, { harAlder: (rader || []).some(r => r && r.alder > 0) }).variabler;

/**
 * Uppdelningen: delarna (summerar exakt till skillnaden), upp till tre namngivna poster per del, största belopp först,
 * och per del hur många grupper som inte namnges (`ovrigaAntal`, räknat före sammanslagningen; ADR-87). Poster som
 * avrundas till 0 kr namnges inte heller, men räknas inte in i `ovrigaAntal`.
 * @param {any[]} rader
 * @param {{k?:number, variabler?:any}} [opts] variabler: förklaringsvariablerna i ordning (null = standard, BAS och AID)
 */
function gapUppdelning(rader, { k, variabler } = {}) {
    const val = _variablerFor(rader, variabler);
    const r = _beraknaPoster(rader, k, val);
    if (!r) return null;
    const { kv, ma, medel, poster } = r;
    const gap = medel.kv - medel.ma;   // kvinnor mot män, som i resten av verktyget

    const delar = {}, topp = {}, ovrigaAntal = {};
    for (const d of Object.keys(poster)) {
        delar[d] = poster[d].reduce((s, p) => s + p.kr, 0);
        ovrigaAntal[d] = poster[d].reduce((s, p) => s + (p.synlig ? 0 : p.grupper), 0);
        // Poster som avrundas till 0 kr säger inget och visas inte (de ingår i delen).
        topp[d] = poster[d].filter(p => p.synlig && Math.abs(p.kr) >= 0.5)
            .sort((x, y) => Math.abs(y.kr) - Math.abs(x.kr) || x.namn.localeCompare(y.namn, 'sv'))
            .slice(0, 3)
            .map(({ namn, kr }) => ({ namn, kr }));
    }
    const gapPct = gap / medel.ma * 100;
    return { n: { kv: kv.length, ma: ma.length }, medel, gap, gapPct, litetGap: Math.abs(gapPct) < 1, delar, topp, ovrigaAntal, variabler: val };
}

/**
 * Meningen om grupperna som inte namnges i en del (kortet och rapportunderlaget, ADR-87), eller '' när alla namnges.
 * @param {number} antal ovrigaAntal för delen
 * @param {number} k
 */
function gapOvrigaText(antal, k) {
    if (!antal) return '';
    const en = antal === 1;
    return `${antal} ${en ? 'grupp namnges' : 'grupper namnges'} inte: ett kön har färre än ${k} ${personOrd(k)} i ${en ? 'den' : 'dem'} `
        + `eller i ${en ? 'gruppen den' : 'grupperna de'} räknas samman med. ${en ? 'Den' : 'De'} ingår i summan.`;
}

    return { gapUppdelning, normaliseraGapVariabler, gapVariablerArStandard, gapDelar, gapDelarIText, gapVariabelEtikett, gapVariablerIText, gapAllaVariabler, gapStandardVariabler, gapOvrigaText };
})();
const _guGapUppdelning = __mirrorGapuppdelning.gapUppdelning;
const _guNormaliseraVariabler = __mirrorGapuppdelning.normaliseraGapVariabler;
const _guVariablerArStandard = __mirrorGapuppdelning.gapVariablerArStandard;
const _guDelar = __mirrorGapuppdelning.gapDelar;
const _guDelarIText = __mirrorGapuppdelning.gapDelarIText;
const _guVariabelEtikett = __mirrorGapuppdelning.gapVariabelEtikett;
const _guVariablerIText = __mirrorGapuppdelning.gapVariablerIText;
const _guAllaVariabler = __mirrorGapuppdelning.gapAllaVariabler;
const _guStandardVariabler = __mirrorGapuppdelning.gapStandardVariabler;
const _guOvrigaText = __mirrorGapuppdelning.gapOvrigaText;

// ---- speglar src/lib/individflaggor.js ----
const __mirrorIndivid = (() => {
    // importer ur tidigare speglade lib-moduler
    const groupKey = __mirrorFalt.groupKey;
    const konOf = __mirrorFalt.konOf;
    const aidAvRad = __mirrorAid.aidAvRad;

// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
/**
 * Öppen lönekartläggning — Personer att granska (ADR-23)
 *
 * För varje person i en grupp med samma AID och BAS (minst minGrupp personer) räknas en
 * förväntad lön från KOLLEGORNA (utan personen själv): ln(lön) = a + b·ålder när
 * kollegornas åldersspridning är minst 5 år, annars kollegornas medianlön. Personen
 * flaggas när lönen ligger minst `grans` procent under den förväntade. Utan ålder i lönefilen
 * (ADR-64) prövas alla mot kollegornas medianlön. Allt i O(n log n)
 * per grupp: summorna för regressionen och den sorterade lönelistan räknas en gång och
 * personen dras bort.
 *
 * Webbläsarbygget får en AUTO-GENERERAD spegel i src/app/09-lib-speglar.js.
 *
 * Bygger på: ADR-23; i övrigt verktygets egen modell. Beräkningarna står i docs/utveckling/berakningsregister.md.
 */



// Median av en sorterad lista där ett exemplar av värdet v tas bort.
function _medianUtan(sorterad, v) {
    let lo = 0, hi = sorterad.length;
    while (lo < hi) { const m = (lo + hi) >> 1; if (sorterad[m] < v) lo = m + 1; else hi = m; }
    const bort = lo, n = sorterad.length - 1;
    const vid = p => sorterad[p < bort ? p : p + 1];
    return n % 2 ? vid((n - 1) / 2) : (vid(n / 2 - 1) + vid(n / 2)) / 2;
}

function _grupp(g, grans) {
    const n = g.length, m = n - 1;
    const medelAlder = g.reduce((s, r) => s + r.alder, 0) / n;
    const x = g.map(r => r.alder - medelAlder), y = g.map(r => Math.log(r.lon));
    let Sx = 0, Sy = 0, Sxx = 0, Sxy = 0;
    for (let i = 0; i < n; i++) { Sx += x[i]; Sy += y[i]; Sxx += x[i] * x[i]; Sxy += x[i] * y[i]; }
    const aldrar = g.map(r => r.alder).sort((a, b) => a - b);
    const loner = g.map(r => r.lon).sort((a, b) => a - b);
    const ut = [];
    for (let i = 0; i < n; i++) {
        const r = g[i];
        const lagst = r.alder === aldrar[0] ? aldrar[1] : aldrar[0];
        const hogst = r.alder === aldrar[n - 1] ? aldrar[n - 2] : aldrar[n - 1];
        const sx = Sx - x[i], sy = Sy - y[i], sxx = Sxx - x[i] * x[i], sxy = Sxy - x[i] * y[i];
        const vxx = sxx - sx * sx / m;
        let forvantad, metod;
        if (hogst - lagst >= 5 && vxx > 1e-9) {
            const b = (sxy - sx * sy / m) / vxx, a = (sy - b * sx) / m;
            forvantad = Math.exp(a + b * x[i]); metod = 'alder';
        } else {
            forvantad = _medianUtan(loner, r.lon); metod = 'median';
        }
        const avvikelsePct = (r.lon - forvantad) / forvantad * 100;
        if (avvikelsePct <= -grans) {
            ut.push({ radnr: r.radnr ?? null, kon: konOf(r), alder: r.alder, aid: groupKey(r, 'aid'), bas: r.bas,
                      lon: r.lon, forvantad, avvikelsePct, kollegor: m, metod, ansvarsgrupp: r.ansvarsgrupp ?? null });
        }
    }
    return ut;
}

function flaggaIndivider(rader, { minGrupp = 10, grans = 10 } = {}) {
    const grupper = new Map();
    // Utan ålder i lönefilen (ADR-64) prövas alla med kollegornas median: åldersspridningen är då noll.
    const harAlder = (rader || []).some(r => r && r.alder > 0);
    for (const r of rader || []) {
        if (!(r.lon > 0) || (harAlder && !(r.alder > 0))) continue;
        const kon = konOf(r);
        if (kon !== 'Kvinna' && kon !== 'Man') continue;
        // Gruppen är AID-koden i BAS-intervallet (aidAvRad), inte texten i fältet: två stavningar av samma etikett
        // är samma kollegor. Posten bär personens egen text i `aid`.
        const nyckel = `${aidAvRad(r)}\u0000${r.bas}`;
        if (!grupper.has(nyckel)) grupper.set(nyckel, []);
        grupper.get(nyckel).push(r);
    }
    const provade = { kv: 0, ma: 0 };
    let ejProvade = 0;
    const flaggade = [];
    for (const g of grupper.values()) {
        if (g.length < minGrupp) { ejProvade += g.length; continue; }
        for (const r of g) konOf(r) === 'Kvinna' ? provade.kv++ : provade.ma++;
        flaggade.push(..._grupp(g, grans));
    }
    flaggade.sort((a, b) => a.avvikelsePct - b.avvikelsePct || (a.radnr ?? Infinity) - (b.radnr ?? Infinity));
    const tot = provade.kv + provade.ma;
    const kvFlagg = flaggade.filter(f => f.kon === 'Kvinna').length;
    return { provade, ejProvade, flaggade, andelKv: {
        provade: tot ? provade.kv / tot * 100 : null,
        flaggade: flaggade.length ? kvFlagg / flaggade.length * 100 : null,
    } };
}

/**
 * Avvikelsen från förväntad lön per BAS-intervall och kön: andelen av de prövade kvinnorna respektive männen som ligger
 * minst `grans` procent under och minst `grans` procent över den förväntade lönen (hela procent). Bara BAS-intervall där
 * både de prövade kvinnorna och de prövade männen är minst k (k-tröskeln, S4). Sorterat efter BAS-intervallet.
 * @returns {Array<{bas: any, kon: string, n: number, under: number, over: number, nUnder: number, nOver: number}>}
 */
function avvikelsePerKonOchBas(rader, { k, minGrupp, grans }) {
    const perBas = new Map();
    // Gränsen −∞ ger avvikelsen för alla prövade, inte bara de flaggade.
    for (const f of flaggaIndivider(rader, { minGrupp, grans: -Infinity }).flaggade) {
        if (!perBas.has(f.bas)) perBas.set(f.bas, { Kvinna: [], Man: [] });
        perBas.get(f.bas)[f.kon].push(f.avvikelsePct);
    }
    const ut = [];
    for (const [bas, g] of [...perBas].sort((a, b) => String(a[0]).localeCompare(String(b[0]), 'sv', { numeric: true }))) {
        if (g.Kvinna.length < k || g.Man.length < k) continue;
        for (const [kon, namn] of [['Kvinna', 'Kvinnor'], ['Man', 'Män']]) {
            const a = g[kon], andel = n => Math.round(100 * n / a.length);
            const nUnder = a.filter(v => v <= -grans).length, nOver = a.filter(v => v >= grans).length;
            ut.push({ bas, kon: namn, n: a.length, under: andel(nUnder), over: andel(nOver), nUnder, nOver });
        }
    }
    return ut;
}

    return { flaggaIndivider, avvikelsePerKonOchBas };
})();
const _ifFlaggaIndivider = __mirrorIndivid.flaggaIndivider;
const _ifAvvikelsePerKonOchBas = __mirrorIndivid.avvikelsePerKonOchBas;

// ---- speglar src/lib/utforska.js ----
const __mirrorUtforska = (() => {
    // importer ur tidigare speglade lib-moduler
    const median = __mirrorStat.median;
    const quantile = __mirrorStat.quantile;
    const gruppnycklar = __mirrorFalt.gruppnycklar;
    const konOf = __mirrorFalt.konOf;
    const jamforAldersgrupp = __mirrorFalt.jamforAldersgrupp;
    const jamforLonespann = __mirrorFalt.jamforLonespann;
    const jamforSektor = __mirrorAid.jamforSektor;
    const mellannivaEtikett = __mirrorAid.mellannivaEtikett;
    const huvudomrade = __mirrorAid.huvudomrade;
    const personFilter = __mirrorUrval.personFilter;
    const uppfyllerGrupp = __mirrorUrval.uppfyllerGrupp;
    const gruppVillkorAktivt = __mirrorUrval.gruppVillkorAktivt;
    const skapaTermer = __mirrorTermer.skapaTermer;
    const ordForAntal = __mirrorTermer.ordForAntal;

// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
/**
 * Öppen lönekartläggning — Utforska: pivot över lönerader
 *
 * Ren kärna bakom Utforska-fliken: urval (src/lib/urval.js), gruppering på en eller två
 * dimensioner, mått och k-markering. Vet ingenting om DOM, ritaren eller state.
 *
 * DÖLJER INGENTING. Små grupper (n < k) räknas och markeras med `liten`, och
 * grupper där ena könet är under k med `konLiten`. Vyn tonar dem och exporten
 * utelämnar dem som standard (ADR-14). Regeln bor här, på ett ställe.
 *
 * Webbläsarbygget får en AUTO-GENERERAD spegel i src/app/09-lib-speglar.js
 * (tools/gen-mirrors.mjs). Ändra här och kör `npm run build:app`.
 */





/** Standardtermerna (ADR-74); skapaTermer() utan egna termer ger standarduppsättningen. */
const T = skapaTermer();


const DIMENSIONER = ['bas', 'aid', 'alder', 'kon', 'alla', 'aidbas', 'lonespann', 'sektor', 'aidniva'];
const MATT = ['median', 'medel', 'n', 'p10', 'p25', 'p75', 'p90', 'spridning', 'andelKv', 'gap'];
// Mått som inte går att dela upp per kön (de ÄR en jämförelse mellan könen).
const UTAN_KONSUPPDELNING = new Set(['andelKv', 'gap']);

function _hink() { return { lons: [], kv: [], ma: [] }; }
function _lagg(h, r) {
    h.lons.push(r.lon);
    const k = konOf(r);
    if (k === 'Kvinna') h.kv.push(r.lon);
    else if (k === 'Man') h.ma.push(r.lon);
}
// Mått på en lönelista. Används både för gruppen och för varje kön.
function _matt(lons, matt) {
    if (!lons.length) return null;
    switch (matt) {
        case 'n': return lons.length;
        case 'medel': return lons.reduce((s, v) => s + v, 0) / lons.length;
        case 'p10': return quantile(lons, 0.10);
        case 'p25': return quantile(lons, 0.25);
        case 'p75': return quantile(lons, 0.75);
        case 'p90': return quantile(lons, 0.90);
        case 'spridning': {
            const p10 = quantile(lons, 0.10);
            return p10 > 0 ? quantile(lons, 0.90) / p10 : null;
        }
        default: return median(lons);
    }
}
function _varde(h, matt) {
    if (matt === 'andelKv') {
        const t = h.kv.length + h.ma.length;
        return t ? (h.kv.length / t) * 100 : null;
    }
    if (matt === 'gap') {
        if (!h.kv.length || !h.ma.length) return null;
        const mm = median(h.ma);
        return mm > 0 ? (median(h.kv) / mm) * 100 : null;
    }
    return _matt(h.lons, matt);
}
function _sortera(dim, etiketter, varden, matt) {
    if (dim === 'bas') return etiketter.sort((a, b) => a.localeCompare(b, 'sv'));
    if (dim === 'alder') return etiketter.sort(jamforAldersgrupp);
    if (dim === 'lonespann') return etiketter.sort(jamforLonespann);
    if (dim === 'sektor') return etiketter.sort(jamforSektor);
    if (dim === 'aidniva') return etiketter.sort((a, b) => (a.startsWith('AID ') ? 0 : 1) - (b.startsWith('AID ') ? 0 : 1) || a.localeCompare(b, 'sv'));   // okänd kod sist
    const v = l => varden.get(l);
    if (matt === 'gap') return etiketter.sort((a, b) => (v(a) ?? Infinity) - (v(b) ?? Infinity));
    return etiketter.sort((a, b) => (v(b) ?? -Infinity) - (v(a) ?? -Infinity));
}

/**
 * Hopslagning av små AID-grupper (bara i Utforska, ADR-33): grupper under k slås
 * ihop per AID-mellannivå; räcker inte summan, per sektor. Grupper som fortfarande är under k
 * behåller sin nyckel (och visas som små). Nyckel = AID-etiketten, grupperad på koden (gruppnycklar i falt.js).
 * @param {any[]} rows
 * @param {number} k
 * @param {(row: any, dim: string) => (string|null)} [nyckel] gruppnycklarna för underlaget; standard gruppnycklar(rows)
 * @returns {Map<string, string>} aid-nyckel → ersättningsnyckel ("Övriga i AID 2070xx (2 yrken)")
 */
function slaIhopSmaAid(rows, k, nyckel = gruppnycklar(rows)) {
    const n = new Map(), aidAv = new Map();
    for (const r of rows || []) {
        const key = nyckel(r, 'aid');
        n.set(key, (n.get(key) || 0) + 1);
        aidAv.set(key, r.aid);
    }
    const sma = [...n.keys()].filter(key => n.get(key) < k);
    const ut = new Map();
    const slaIhop = nivaAv => {
        const grupper = new Map();
        for (const key of sma.filter(x => !ut.has(x))) {
            const niva = nivaAv(aidAv.get(key));
            if (!niva) continue;
            if (!grupper.has(niva)) grupper.set(niva, []);
            grupper.get(niva).push(key);
        }
        for (const [niva, keys] of grupper) {
            if (keys.length < 2) continue;
            if (keys.reduce((s, key) => s + n.get(key), 0) < k) continue;
            const namn = `Övriga i ${niva} (${keys.length} ${ordForAntal(keys.length, T.enhet)})`;
            keys.forEach(key => ut.set(key, namn));
        }
    };
    slaIhop(aid => mellannivaEtikett(aid));
    slaIhop(aid => huvudomrade(aid)?.namn ?? null);   // okänd sektor slås inte ihop
    return ut;
}

/**
 * Pivot över lönerader.
 * @param {any[]} rows - lönerader ({ bas, aid, yrke, yrkeLabel, lon, alder, kon })
 * @param {{rad:string, kolumn?:string|null, matt?:string, delaKon?:boolean, urval?:any, gruppVillkor?:any[], slaIhop?:boolean}} spec
 * @param {{k?:number}} [opts]
 */
function computePivot(rows, spec, { k = 10 } = {}) {
    const rad = spec.rad;
    const kol = spec.kolumn && spec.kolumn !== rad ? spec.kolumn : null;
    const matt = spec.matt && MATT.includes(spec.matt) ? spec.matt : 'median';
    const delaKon = !!spec.delaKon && rad !== 'kon' && kol !== 'kon' && !UTAN_KONSUPPDELNING.has(matt);
    const urvalSpec = spec.urval || { lage: 'alla', villkor: [] };
    const gruppVillkor = spec.gruppVillkor || [];
    const aktivaGrupp = gruppVillkor.filter(g => gruppVillkorAktivt(g) && MATT.includes(g.matt));
    // AID-etiketten grupperas på koden, med namnet från texten på flest av kodens rader i hela underlaget (inte bara urvalet), så
    // att pivoten, villkoren och värdelistorna i appen har samma namn på samma grupp.
    const gruppnyckel = gruppnycklar(rows);
    const person = personFilter(urvalSpec, gruppnyckel);

    const urvalRader = (rows || []).filter(r => r.lon > 0 && person(r));
    // Hopslagning av små AID-grupper, bara när raderna är AID (ADR-33).
    const ersatt = spec.slaIhop && rad === 'aid' ? slaIhopSmaAid(urvalRader, k, gruppnyckel) : null;
    const urval = { n: urvalRader.length, nKv: 0, nMa: 0 };
    const cellHinkar = new Map(), radHinkar = new Map(), kolHinkar = new Map();
    for (const r of urvalRader) {
        const ko = konOf(r);
        if (ko === 'Kvinna') urval.nKv++;
        else if (ko === 'Man') urval.nMa++;
        const rk0 = gruppnyckel(r, rad);
        const rk = rk0 != null && ersatt && ersatt.has(rk0) ? /** @type {string} */ (ersatt.get(rk0)) : rk0;
        if (rk == null) continue;
        /** @type {string|null} */ let kk = null;
        if (kol) {
            kk = gruppnyckel(r, kol);
            if (kk == null) continue;
        }
        const nyckel = kol ? rk + '\u0000' + kk : rk;
        if (!cellHinkar.has(nyckel)) cellHinkar.set(nyckel, { rad: rk, kol: kk, h: _hink() });
        _lagg(cellHinkar.get(nyckel).h, r);
        if (kol) {
            if (!radHinkar.has(rk)) radHinkar.set(rk, _hink());
            _lagg(radHinkar.get(rk), r);
            if (!kolHinkar.has(kk)) kolHinkar.set(kk, _hink());
            _lagg(kolHinkar.get(kk), r);
        }
    }

    // Gruppvillkor prövas per cell, på cellens egna löner.
    let dolda = 0;
    const kvar = [...cellHinkar.values()].filter(({ h }) => {
        if (!aktivaGrupp.length) return true;
        // Gap räknat på ett kön under k får inte avgöra om gruppen visas — då
        // skulle gruppens närvaro i exporten röja det (ADR-12/14).
        const varden = Object.fromEntries(aktivaGrupp.map(g => [g.matt,
            (g.matt === 'gap' && (h.kv.length < k || h.ma.length < k)) ? null : _varde(h, g.matt)]));
        if (uppfyllerGrupp(varden, aktivaGrupp)) return true;
        dolda++;
        return false;
    });
    const celler = kvar.map(({ rad: rk, kol: kk, h }) => ({
        rad: rk, kol: kk,
        n: h.lons.length, nKv: h.kv.length, nMa: h.ma.length,
        value: _varde(h, matt),
        valueKv: delaKon ? _matt(h.kv, matt) : null,
        valueMa: delaKon ? _matt(h.ma, matt) : null,
        liten: h.lons.length < k,
        konLiten: h.kv.length < k || h.ma.length < k
    }));

    /** @type {string[]} */ let radEtiketter;
    /** @type {string[]|null} */ let kolumnEtiketter = null;
    if (kol) {
        const totalvarden = hinkar => new Map([...hinkar].map(([l, h]) => [l, _varde(h, matt)]));
        const radMed = new Set(celler.map(c => c.rad)), kolMed = new Set(celler.map(c => c.kol));
        radEtiketter = _sortera(rad, [...radHinkar.keys()].filter(l => radMed.has(l)), totalvarden(radHinkar), matt);
        kolumnEtiketter = _sortera(kol, [...kolHinkar.keys()].filter(l => kolMed.has(l)), totalvarden(kolHinkar), matt);
    } else {
        radEtiketter = _sortera(rad, celler.map(c => c.rad), new Map(celler.map(c => [c.rad, c.value])), matt);
    }
    const ri = new Map(radEtiketter.map((l, i) => [l, i]));
    const ki = kol && kolumnEtiketter ? new Map(kolumnEtiketter.map((l, i) => [l, i])) : null;
    celler.sort((a, b) => ((ri.get(a.rad) ?? 0) - (ri.get(b.rad) ?? 0)) || (ki ? (ki.get(a.kol) ?? 0) - (ki.get(b.kol) ?? 0) : 0));

    return { spec: { rad, kolumn: kol, matt, delaKon, urval: urvalSpec, gruppVillkor, slaIhop: !!ersatt },
             radEtiketter, kolumnEtiketter, celler, urval, dolda };
}

    return { computePivot };
})();
const _utComputePivot = __mirrorUtforska.computePivot;

// ---- speglar src/lib/attgora.js ----
const __mirrorAttgora = (() => {
    // importer ur tidigare speglade lib-moduler
    const personOrd = __mirrorNamn.personOrd;
    const skapaTermer = __mirrorTermer.skapaTermer;
    const termFras = __mirrorTermer.termFras;

// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
/**
 * Öppen lönekartläggning — regler för Att göra och processöversikten (ADR-29).
 *
 * Ren logik utan DOM och state: vilka punkter som visas under Börja här och när ett
 * analyssteg i processöversikten räknas som klart. Appen (18-atgardslista.js,
 * 13-oversikt.js) bygger punkterna och skickar in dem.
 *
 * Webbläsarbygget får en AUTO-GENERERAD spegel i src/app/09-lib-speglar.js.
 */


/** Standardtermerna (ADR-74); skapaTermer() utan egna termer ger standarduppsättningen. */
const T = skapaTermer();


/** Kategorier för fynd som gäller skillnader mellan kvinnor och män (lagkravet). */
const KONSRELATERADE = ['Lika arbete', 'Lika arbete, fördjupning', 'Likvärdigt arbete'];

const PRIORITET = { 'hög': 0, medel: 1, 'låg': 2 };

/**
 * Rang inom samma prioritet: underlaget först (fel i data påverkar allt), sedan de
 * könsrelaterade fynden, sist avvikelser mot lönepolitiken och övriga iakttagelser.
 */
function attGoraRang(punkt) {
    if (/^(Underlag|Datakvalitet)/.test(punkt.kategori)) return 0;
    return KONSRELATERADE.includes(punkt.kategori) ? 1 : 2;
}

/**
 * Börja här: de första ej avbockade punkterna, i ordningen prioritet → rang → ursprunglig.
 * @param {Array<{id:string, kategori:string, prioritet:string, [k:string]:any}>} punkter
 * @param {Set<string>} klar  id för avbockade punkter
 */
function borjaHar(punkter, klar, antal = 3) {
    return punkter.map((punkt, i) => ({ punkt, i })).filter(x => !klar.has(x.punkt.id))
        .sort((a, b) => (PRIORITET[a.punkt.prioritet] ?? 3) - (PRIORITET[b.punkt.prioritet] ?? 3)
            || attGoraRang(a.punkt) - attGoraRang(b.punkt) || a.i - b.i)
        .slice(0, antal).map(x => x.punkt);
}

/** Antal punkter (t) och antal avbockade (d) inom kategorierna. */
function hanterade(punkter, klar, kategorier) {
    const egna = punkter.filter(punkt => kategorier.includes(punkt.kategori));
    return { t: egna.length, d: egna.filter(punkt => klar.has(punkt.id)).length };
}

/** Steg 3, Lika arbete: klart när regressionen gått att köra och alla punkter är hanterade. */
function stegLikaArbete({ regressionOk, t, d }) {
    if (!regressionOk) return { status: 'delvis', detail: 'Underlaget räcker ännu inte för en tillförlitlig regression.' };
    return {
        status: d >= t ? 'klar' : 'delvis',
        detail: t ? `Oförklarad löneskillnad beräknad · ${d} av ${t} punkter hanterade i Att göra.`
                  : 'Oförklarad löneskillnad beräknad — inga punkter att förklara eller åtgärda.',
    };
}

/**
 * Steg 4, Likvärdigt arbete: klart när analysen inte hittar par, eller när alla par är hanterade. Finns bara par
 * med en grupp under minsta gruppstorlek (`utelamnade`, de redovisas bara i fliken Likvärdigt arbete) finns inget
 * att hantera i Att göra — men steget är inte klart: tillståndet `inget` pekar till fliken (beslut av
 * produktägaren 2026-10-16).
 */
function stegLikvardigt({ analys, antalPar, utelamnade = 0, k, t, d }) {
    if (!analys) return { status: 'ej', detail: 'Gå igenom kandidatparen i Likvärdigt arbete.' };
    if (antalPar === 0 && utelamnade > 0) {
        return { status: 'inget', detail: `Inget att hantera i Att göra: ${utelamnade} par har en grupp under ${k != null ? `${k} ${personOrd(k)}` : 'minsta gruppstorlek'} och redovisas bara i fliken Likvärdigt arbete — gå till steget för att granska dem.` };
    }
    if (antalPar === 0) return { status: 'klar', detail: 'Analysen körd — inga kandidatpar utifrån nuvarande trösklar.' };
    return {
        status: t > 0 && d >= t ? 'klar' : 'delvis',
        detail: `${antalPar} kandidatpar (${termFras(T.enhet, 'fl', { adjektiv: 'kvinnodominerad' })} mot ${T.jamforelse.fl} med likvärdiga krav) · ${d} av ${t} kandidatpar hanterade i Att göra.`,
    };
}

    return { borjaHar, hanterade, stegLikaArbete, stegLikvardigt };
})();
const _agBorjaHar = __mirrorAttgora.borjaHar;
const _agHanterade = __mirrorAttgora.hanterade;
const _agStegLikaArbete = __mirrorAttgora.stegLikaArbete;
const _agStegLikvardigt = __mirrorAttgora.stegLikvardigt;

// ---- speglar src/lib/sektor.js ----
const __mirrorSektor = (() => {
    // importer ur tidigare speglade lib-moduler
    const median = __mirrorStat.median;
    const justeradSkillnad = __mirrorRegression.justeradSkillnad;
    const harAlderIRader = __mirrorRegression.harAlderIRader;
    const sektorsnamn = __mirrorAid.sektorsnamn;
    const jamforSektor = __mirrorAid.jamforSektor;
    const konOf = __mirrorFalt.konOf;
    const skrKvinnoandelSektor = __mirrorSkrReferens.skrKvinnoandelSektor;
    const skapaTermer = __mirrorTermer.skapaTermer;
    const stor = __mirrorTermer.stor;
    const personOrd = __mirrorNamn.personOrd;
    const sammanslagning = __mirrorUndertryckning.sammanslagning;

// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
/**
 * Öppen lönekartläggning — sektorsöversikten (ADR-33).
 *
 * En sektor är ett AID-huvudområde. Per sektor: antal, andel kvinnor, medianer och kvot med samma
 * k-regler som Lika arbete (ett kön under k → samlad median; gruppen under k → maskerad), justerad
 * skillnad med huvudregressionens kodning (kön + ålder när lönefilen har den + BAS som indikatorer, HC3 och
 * t-kvantil; justeradSkillnad i regression.js, ADR-78) när sektorn har ≥ 30 personer och ≥ k av varje
 * kön, och sektorernas andel av gapet i medellön (samma symmetriska formel och samma tecken som del A i
 * gapuppdelning.js, med sektor i stället för BAS). Går modellen med BAS inte att skatta i ett huvudområde med minst två
 * BAS-intervall (kön och BAS går inte att skilja åt) ges inget justerat tal: ett tal utan BAS vore inte justerat för BAS.
 *
 * Webbläsarbygget får en AUTO-GENERERAD spegel i src/app/09-lib-speglar.js.
 *
 * Bygger på: ADR-33, ADR-78 och ADR-87; docs/utveckling/regressionsmodellen.md avsnitt 10. Beräkningarna står i docs/utveckling/berakningsregister.md.
 */








const T = skapaTermer();

const MIN_REGRESSION = 30;

// Justerad skillnad med huvudregressionens kodning (ADR-78): k-villkoren här, modellen i regression.js.
function _justerat(rader, k, medAlder) {
    const giltiga = rader.filter(r => r.lon > 0 && (!medAlder || r.alder > 0) && konOf(r) !== 'Övrig/okänd');
    const nKv = giltiga.filter(r => konOf(r) === 'Kvinna').length;
    if (giltiga.length < MIN_REGRESSION || nKv < k || giltiga.length - nKv < k) return { just: null, skal: 'fa' };
    const just = justeradSkillnad(giltiga, { medAlder });
    // Räknat utan BAS fast huvudområdet har flera BAS-intervall: talet är inte justerat för BAS och visas inte.
    if (just && !just.medBas && just.antalBas >= 2) return { just: null, skal: 'ejBas' };
    return { just, skal: just ? 'ok' : 'fa' };
}

/**
 * Rubriken och bisatsen för den justerade skillnaden, för vyn och rapportunderlaget (ADR-78): med ålder bara när
 * lönefilen har ålder.
 * @param {{justeratMedAlder?:boolean}[]} tabell - sektorsTabell()
 */
function sektorJusteradText(tabell) {
    const medAlder = (tabell || []).every(r => r.justeratMedAlder !== false);
    return { medAlder, rubrik: medAlder ? 'Justerad (ålder, BAS)' : 'Justerad (BAS)', justeradFor: `${medAlder ? 'ålder och ' : ''}${T.niva.en}` };
}

/**
 * @param {any[]} rader - lönerader ({ aid, kon, lon, alder, bas, ansvarsgrupp? })
 * @param {{k:number, punkter?:Object<string, number>, skrDel?:string}} opts - punkter i Att göra per sektorsnamn;
 *        skrDel = organisationstypen ('alla' | 'kommun' | 'region') för SKR-referensen
 */
function sektorsTabell(rader, { k, punkter = {}, skrDel = 'alla' }) {
    const per = new Map();
    for (const r of rader || []) {
        if (!(r.lon > 0)) continue;
        const namn = sektorsnamn(r.aid);
        if (!per.has(namn)) per.set(namn, []);
        per.get(namn).push(r);
    }
    const harAnsvar = (rader || []).some(r => r.ansvarsgrupp);
    const medAlder = harAlderIRader(rader);   // lönefilen har ålder (ADR-64): gäller alla huvudområden
    return [...per.keys()].sort(jamforSektor).map(namn => {
        const g = per.get(namn);
        const kv = g.filter(r => konOf(r) === 'Kvinna'), ma = g.filter(r => konOf(r) === 'Man');
        const n = g.length, maskerad = n < k;
        const bada = kv.length >= k && ma.length >= k;
        const medKv = !maskerad && bada ? median(kv.map(r => r.lon)) : null;
        const medMa = !maskerad && bada ? median(ma.map(r => r.lon)) : null;
        const just = maskerad ? { just: null, skal: null } : _justerat(g, k, medAlder);
        const andelLedning = grupp => (grupp.length ? grupp.filter(r => r.ansvarsgrupp === 'ledning').length / grupp.length * 100 : null);
        return {
            namn, n, nKv: kv.length, nMa: ma.length,
            andelKv: n ? kv.length / n * 100 : null,
            skrAndelKv: skrKvinnoandelSektor(namn, { del: skrDel })?.pct ?? null,   // referens: SKR:s personalstatistik
            skrDel: skrKvinnoandelSektor(namn, { del: skrDel })?.del ?? null,
            maskerad, samladMedian: !maskerad && !bada,
            medTot: maskerad ? null : median(g.map(r => r.lon)),
            medKv, medMa, kvot: medKv != null && medMa != null && medMa > 0 ? medKv / medMa * 100 : null,
            justerat: just.just, justeratSkal: just.skal,   // 'ok' | 'fa' (för få) | 'ejBas' (kön och BAS går inte att skilja åt)
            justeratMedAlder: medAlder,   // rubriken och texterna säger vad som justeras för
            antalAid: new Set(g.map(r => r.aid)).size,
            punkter: punkter[namn] || 0,
            ledningKv: harAnsvar && !maskerad && kv.length >= k ? andelLedning(kv) : null,
            ledningMa: harAnsvar && !maskerad && ma.length >= k ? andelLedning(ma) : null,
        };
    });
}

/**
 * Sektorernas andel av gapet i medellön (kvinnor − män, negativt när kvinnor ligger lägre, som i gapuppdelning.js):
 * Σ_s Δs_s · (W̄_s − W̄) med Δs = andelen av kvinnorna − andelen av männen. sektorKr är del A i gapUppdelning med
 * huvudområde som enda variabel; andel = sektorKr / gapKr har inget tecken att byta.
 * Null när ett kön har färre än k personer: gapet i kronor tillsammans med gapet i procent
 * (Struktur) ger annars det lilla könets medellön — samma regel som gapuppdelning.js.
 *
 * Huvudområden där ett kön har 1 till k − 1 personer räknas samman med andra (ADR-87, `sammanslagning` i
 * undertryckning.js), samma regel som del A i gapuppdelning.js: annars ger beloppet sektorKr tillsammans med kvinnornas
 * och männens medellön och antalen ett litet områdes medellön (med två huvudområden är det en ekvation med en okänd).
 * `sammanslagna` är de sammanräknade områdenas namn i tabellens ordning och `sma` de av dem där ett kön har för få.
 * Räknas alla samman till ett är sektorKr och andel null: beloppet vore noll och säger ingenting om fördelningen.
 */
function sektorernasAndel(rader, { k = 10 } = {}) {
    const kv = (rader || []).filter(r => r.lon > 0 && konOf(r) === 'Kvinna');
    const ma = (rader || []).filter(r => r.lon > 0 && konOf(r) === 'Man');
    if (!kv.length || !ma.length || kv.length < k || ma.length < k) return null;
    const medel = a => a.reduce((s, r) => s + r.lon, 0) / a.length;
    const gapKr = medel(kv) - medel(ma);
    const namn = [...new Set([...kv, ...ma].map(r => sektorsnamn(r.aid)))];
    const grupper = namn.map(s => ({ s, k: kv.filter(r => sektorsnamn(r.aid) === s), m: ma.filter(r => sektorsnamn(r.aid) === s) }));
    const samman = sammanslagning(grupper.map(g => ({ namn: g.s, nKv: g.k.length, nMa: g.m.length })), k);
    const egna = grupper.filter((_, i) => !samman.includes(i));
    const delar = samman.length ? [...egna, { s: null, k: samman.flatMap(i => grupper[i].k), m: samman.flatMap(i => grupper[i].m) }] : egna;
    const cell = ({ k, m }) => {
        const wK = k.length ? medel(k) : medel(m), wM = m.length ? medel(m) : medel(k);
        return { dS: k.length / kv.length - m.length / ma.length, w: (wK + wM) / 2, sBar: (m.length / ma.length + k.length / kv.length) / 2 };
    };
    const ordnade = ix => ix.map(i => grupper[i].s).sort(jamforSektor);
    const liten = n => n > 0 && n < k;
    const sammanslagna = ordnade(samman), sma = ordnade(samman.filter(i => liten(grupper[i].k.length) || liten(grupper[i].m.length)));
    if (samman.length && delar.length < 2) return { gapKr, sektorKr: null, andel: null, sammanslagna, sma };
    const celler = delar.map(cell);
    const wBar = celler.reduce((s, c) => s + c.sBar * c.w, 0);
    const sektorKr = celler.reduce((s, c) => s + c.dS * (c.w - wBar), 0);
    return { gapKr, sektorKr, andel: Math.abs(gapKr) > 1e-9 ? sektorKr / gapKr : null, sammanslagna, sma };
}

/**
 * Meningen om sammanräknade huvudområden under beloppet (vyn och rapportunderlaget, ADR-87), eller '' när inget
 * räknats samman. Namnger områdena; antal och namn omfattas inte av skyddet (ADR-70).
 * @param {{sektorKr:number|null, sammanslagna?:string[], sma?:string[]}|null} a - sektorernasAndel()
 * @param {number} k
 */
function sektorAndelNot(a, k) {
    if (!a || !a.sammanslagna || !a.sammanslagna.length) return '';
    const lista = l => (l.length <= 1 ? (l[0] || '') : `${l.slice(0, -1).join(', ')} och ${l[l.length - 1]}`);
    const orsak = `ett kön har färre än ${k} ${personOrd(k)} i ${lista(a.sma || [])}`;
    const varfor = `Annars skulle medellönen för färre än ${k} kvinnor eller män gå att räkna fram ur beloppet.`;
    if (a.sektorKr == null) {
        return `Hur mycket av skillnaden som beror på att kvinnor och män arbetar i olika ${T.huvudomrade.fl} redovisas inte, eftersom ${orsak}. ${varfor}`;
    }
    return `${stor(T.huvudomrade.bfl)} ${lista(a.sammanslagna)} räknas här samman, eftersom ${orsak}. ${varfor}`;
}

    return { sektorsTabell, sektorernasAndel, sektorJusteradText, sektorAndelNot };
})();
const _skSektorsTabell = __mirrorSektor.sektorsTabell;
const _skSektorernasAndel = __mirrorSektor.sektorernasAndel;
const _skSektorJusteradText = __mirrorSektor.sektorJusteradText;
const _skSektorAndelNot = __mirrorSektor.sektorAndelNot;

// ---- speglar src/lib/ansvar.js ----
const __mirrorAnsvar = (() => {
    // importer ur tidigare speglade lib-moduler
    const median = __mirrorStat.median;
    const konOf = __mirrorFalt.konOf;

// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
/**
 * Öppen lönekartläggning — AID:s ansvarskod (ADR-33; AID-handboken s. 9–13).
 *
 * Koder: A, B, C (chef), L (annan ledningspersonal), F (funktionsansvar), M (läkare med bakjour
 * eller medicinskt ansvarsområde), 1001 (lektor), 1002 (förstelärare). En sista position kan
 * användas lokalt (C1, 10013) och ignoreras. Flera koder per person tillåts. Analyserna använder
 * bara tre ansvarsgrupper. Kolumnen "Ansvar" är oftast ett kostnadsställe och läses aldrig.
 *
 * Webbläsarbygget får en AUTO-GENERERAD spegel i src/app/09-lib-speglar.js.
 */


const ANSVARSGRUPP_NAMN = Object.freeze({ ledning: 'Ledningsansvar', uppdrag: 'Särskilt uppdrag', inget: 'Inget särskilt ansvar' });
const LEDNING = new Set(['A', 'B', 'C', 'L']);
const EN_KOD = /^(?:([ABCLFM])[0-9A-Z]?|(100[12])[0-9A-Z]?)$/;

/** Ett cellvärde → lista med koder; [] för tomt; null om något ingående värde är ogiltigt. */
function tolkaAnsvarskod(v) {
    const s = String(v ?? '').trim().toUpperCase();
    if (!s) return [];
    const delar = s.split(/[\s,;]+/).filter(Boolean);
    const ut = [];
    for (const d of delar) {
        const m = EN_KOD.exec(d);
        if (!m) return null;
        const kod = m[1] || m[2];
        if (!ut.includes(kod)) ut.push(kod);
    }
    return ut;
}

/** 'ledning' om någon kod är A, B, C eller L; annars 'uppdrag' om F, M, 1001 eller 1002; annars 'inget'. */
function ansvarsgrupp(koder) {
    const k = koder || [];
    if (k.some(x => LEDNING.has(x))) return 'ledning';
    return k.length ? 'uppdrag' : 'inget';
}

/** Andelen giltiga av de ifyllda värdena, eller null om inga är ifyllda. */
function andelGiltiga(varden) {
    const ifyllda = (varden || []).filter(v => String(v ?? '').trim());
    if (!ifyllda.length) return null;
    return ifyllda.filter(v => tolkaAnsvarskod(v) !== null).length / ifyllda.length;
}

/** Kolumnrubrik som anger AID:s ansvarskod — aldrig bara "Ansvar". */
function arAnsvarskodRubrik(rubrik) {
    const r = String(rubrik ?? '').toLowerCase().replace(/å/g, 'a').replace(/ä/g, 'a').replace(/ö/g, 'o').replace(/[^a-z0-9]/g, '');
    return /ansvarskod|aidansvar|ansvarsniva/.test(r);
}

const ORDNING = ['ledning', 'uppdrag', 'inget'];

/**
 * Underrader per ansvarsgrupp inom en grupp (Lika arbete), med samma k-regler som yrkesraden:
 * gruppen under k → inga lönemått; ett kön under k → samlad median utan könsjämförelse.
 * @param {any[]} rader
 * @param {{k:number}} opts
 * @returns {any[]}
 */
function ansvarsUnderrader(rader, { k }) {
    return ORDNING.map(grupp => {
        const g = (rader || []).filter(r => r.ansvarsgrupp === grupp && r.lon > 0);
        if (!g.length) return null;
        const kv = g.filter(r => konOf(r) === 'Kvinna'), ma = g.filter(r => konOf(r) === 'Man');
        const liten = g.length < k, bada = kv.length >= k && ma.length >= k;
        const medKv = !liten && bada ? median(kv.map(r => r.lon)) : null;
        const medMa = !liten && bada ? median(ma.map(r => r.lon)) : null;
        return { grupp, namn: ANSVARSGRUPP_NAMN[grupp], n: g.length, nKv: kv.length, nMa: ma.length, liten,
            samladMedian: !liten && !bada, medTot: liten ? null : median(g.map(r => r.lon)),
            medKv, medMa, kvot: medKv != null && medMa != null && medMa > 0 ? medKv / medMa * 100 : null };
    }).filter(Boolean);
}

    return { tolkaAnsvarskod, ansvarsgrupp, andelGiltiga, arAnsvarskodRubrik, ansvarsUnderrader };
})();
const _anTolka = __mirrorAnsvar.tolkaAnsvarskod;
const _anGrupp = __mirrorAnsvar.ansvarsgrupp;
const _anAndelGiltiga = __mirrorAnsvar.andelGiltiga;
const _anArRubrik = __mirrorAnsvar.arAnsvarskodRubrik;
const _anUnderrader = __mirrorAnsvar.ansvarsUnderrader;

// ---- speglar src/lib/importprofiler.js ----
const __mirrorImportprofiler = (() => {
// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
/**
 * Öppen lönekartläggning — importprofiler: kända kolumnuppsättningar som gör kolumnmappningen automatisk.
 *
 * En importprofil är en sparad kolumnmappning: vilka rubriker i lönefilen som svarar mot verktygets roller (BAS,
 * yrke, lön, ålder, kön och de valfria poäng och ansvarskod), och vilka rubriker som måste finnas för att profilen
 * ska gälla (kännetecken). En profil bär BARA rubriknamn — aldrig värden ur filen. Valideringen här ser till att det
 * gäller också för en fil som någon har skrivit för hand: bara vitlistade fält följer med, varje text är högst 80
 * tecken och får inte likna ett personnummer eller en e-postadress, högst 20 rubriker per roll och högst 50
 * profiler.
 *
 * Verktyget levererar inga påhittade profiler för namngivna lönesystem. De inbyggda profilerna gäller bara format
 * som projektet självt definierar (CSV-mallen, testdatans fil och demodatans fältnamn); övriga kommer från
 * organisationer som använt verktyget, via konfigurationsfilen eller organisationspaketet.
 *
 * Webbläsarbygget får en AUTO-GENERERAD spegel i src/app/09-lib-speglar.js.
 */

const IMPORTPROFIL_FORMAT = 'lonekartlaggning-importprofiler';
const IMPORTPROFIL_VERSION = 1;
/** Rollerna i kolumnmappningens ordning. BAS, yrke, lön och kön är obligatoriska; ålder är valfri men rekommenderad (ADR-64). */
const IMPORTPROFIL_ROLLER = ['bas', 'yrke', 'lon', 'alder', 'kon', 'poang', 'ansvar'];
const OBLIGATORISKA_ROLLER = ['bas', 'yrke', 'lon', 'kon'];
/** Rollerna vars rubriker blir kännetecken när profilen inte anger egna: de obligatoriska och ålder, när den finns. */
const KANNETECKEN_ROLLER = ['bas', 'yrke', 'lon', 'alder', 'kon'];
/** Källorna i prioritetsordning: organisationspaketets profiler prövas först, de inbyggda sist. */
const IMPORTPROFIL_KALLOR = ['organisationspaket', 'konfiguration', 'inbyggd'];
const MAX_PROFILER = 50;
const MAX_RUBRIKER_PER_ROLL = 20;
const MAX_TEXT = 80;

const PNR = /\b(19|20)?\d{6}[-+]?\d{4}\b/;
const EPOST = /\S+@\S+\.\S+/;
// Styrtecken och HTML-metatecken tas bort. Rubrikerna jämförs ändå utan andra tecken än a–z och 0–9 (se nedan),
// så det ändrar aldrig vilken kolumn en profil pekar på.
const BORT = /[\u0000-\u001f\u007f<>"'&]/g;

/** Rubriken som den jämförs: gemener, bara a–z och 0–9 (samma regel som autoDetectColumnMap i appen). */
function normaliseraRubrik(s) {
    return String(s ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

/** En text i en profil: sanerad och trimmad, eller null när den inte får förekomma (ingen text, för lång, personuppgift). */
function _text(v) {
    if (typeof v !== 'string') return null;
    const t = v.replace(BORT, '').trim();
    if (!t || t.length > MAX_TEXT) return null;
    if (PNR.test(t) || EPOST.test(t)) return null;
    return t;
}
/** En rubrik: en tillåten text som inte blir tom när den normaliseras. */
function _rubrik(v) {
    const t = _text(v);
    return t && normaliseraRubrik(t) ? t : null;
}
/** En lista med rubriker (högst `max`, utan dubbletter efter normalisering), eller null om något i den är ogiltigt. */
function _rubrikLista(v, max) {
    if (!Array.isArray(v) || !v.length || v.length > max) return null;
    const ut = [], sedda = new Set();
    for (const x of v) {
        const r = _rubrik(x);
        if (!r) return null;
        const n = normaliseraRubrik(r);
        if (!sedda.has(n)) { sedda.add(n); ut.push(r); }
    }
    return ut;
}

// Ett kort id ur namnet och kännetecknen, så att samma profil får samma id när den sparas igen.
function _hash(s) {
    let h = 5381;
    for (let i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0;
    return h.toString(36);
}
function _id(namn, kannetecken) {
    const slug = namn.toLowerCase().replace(/[åä]/g, 'a').replace(/ö/g, 'o').replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '').slice(0, 40);
    return `${slug || 'profil'}-${_hash(namn + '|' + kannetecken.map(normaliseraRubrik).join('|'))}`;
}
/**
 * Validerar en profil. Bara vitlistade fält följer med; en profil med en ogiltig text (för lång, personnummer- eller
 * e-postliknande) avvisas helt. Id:t härleds alltid ur namnet och kännetecknen: ett id i filen läses aldrig, så det
 * kan inte bli en okontrollerad textkanal (till exempel ett personnummer) i exporter och paket.
 * @param {any} o
 * @param {{kalla?: string}} [val] Källan sätts av den som läser in (en fil kan inte göra sin profil inbyggd).
 * @returns {{id:string, namn:string, kalla:string, rubriker:{[roll:string]:string[]}, kannetecken:string[]}|null}
 */
function valideraImportprofil(o, { kalla } = {}) {
    if (!o || typeof o !== 'object' || Array.isArray(o)) return null;
    const namn = _text(o.namn);
    if (!namn) return null;
    if (!o.rubriker || typeof o.rubriker !== 'object' || Array.isArray(o.rubriker)) return null;
    /** @type {{[roll:string]:string[]}} */
    const rubriker = {};
    for (const roll of IMPORTPROFIL_ROLLER) {
        if (o.rubriker[roll] == null) continue;
        const lista = _rubrikLista(o.rubriker[roll], MAX_RUBRIKER_PER_ROLL);
        if (!lista) return null;
        rubriker[roll] = lista;
    }
    if (!Object.keys(rubriker).length) return null;
    let kannetecken;
    if (o.kannetecken == null) {
        kannetecken = KANNETECKEN_ROLLER.filter(r => rubriker[r]).map(r => rubriker[r][0]);
        if (!kannetecken.length) return null;
    } else {
        kannetecken = _rubrikLista(o.kannetecken, MAX_RUBRIKER_PER_ROLL);
        if (!kannetecken) return null;
    }
    const k = IMPORTPROFIL_KALLOR.includes(/** @type {string} */ (kalla)) ? /** @type {string} */ (kalla)
        : (o.kalla === 'organisationspaket' ? 'organisationspaket' : 'konfiguration');
    return { id: _id(namn, kannetecken), namn, kalla: k, rubriker, kannetecken };
}

/**
 * Validerar en lista med profiler. Fler än 50 avvisar hela listan; ogiltiga profiler hoppas över och räknas, och
 * samma id tas bara en gång.
 * @param {any} lista
 * @param {{kalla?: string}} [val]
 * @returns {{profiler: Array<NonNullable<ReturnType<typeof valideraImportprofil>>>, bort: number, fel: string|null}}
 */
function valideraImportprofiler(lista, val = {}) {
    if (!Array.isArray(lista)) return { profiler: [], bort: 0, fel: 'Importprofilerna är inte en lista.' };
    if (lista.length > MAX_PROFILER) return { profiler: [], bort: lista.length, fel: `Fler än ${MAX_PROFILER} importprofiler; ingen av dem läses in.` };
    const profiler = [], ids = new Set();
    let bort = 0;
    for (const o of lista) {
        const p = valideraImportprofil(o, val);
        if (!p || ids.has(p.id)) { bort++; continue; }
        ids.add(p.id);
        profiler.push(p);
    }
    return { profiler, bort, fel: null };
}

/**
 * Den första profilen som gäller för filens rubriker, i prioritetsordning (organisationspaketet, konfigurationsfilen,
 * inbyggda; inom en källa listans ordning). En profil gäller när alla dess kännetecken finns bland rubrikerna.
 * @param {string[]} rubriker filens rubriker
 * @param {Array<{kalla:string, rubriker:{[roll:string]:string[]}, kannetecken:string[]}>} profiler
 * @returns {{profil: any, mappning: {[roll:string]: string}}|null} mappningen: roll → filens rubrik, bara för profilens roller
 */
function matchaImportprofil(rubriker, profiler) {
    /** @type {Map<string, string>} */
    const fil = new Map();
    for (const r of rubriker || []) {
        const n = normaliseraRubrik(r);
        if (n && !fil.has(n)) fil.set(n, String(r));
    }
    const ordning = p => { const i = IMPORTPROFIL_KALLOR.indexOf(p.kalla); return i < 0 ? IMPORTPROFIL_KALLOR.length : i; };
    const sorterade = (profiler || []).map((p, i) => ({ p, i })).sort((a, b) => ordning(a.p) - ordning(b.p) || a.i - b.i);
    for (const { p } of sorterade) {
        if (!p || !Array.isArray(p.kannetecken) || !p.kannetecken.length) continue;
        if (!p.kannetecken.every(k => fil.has(normaliseraRubrik(k)))) continue;
        /** @type {{[roll:string]: string}} */
        const mappning = {};
        for (const roll of IMPORTPROFIL_ROLLER) {
            const hit = (p.rubriker[roll] || []).map(normaliseraRubrik).find(n => fil.has(n));
            if (hit) mappning[roll] = /** @type {string} */ (fil.get(hit));
        }
        return { profil: p, mappning };
    }
    return null;
}

/**
 * Bygger en profil ur en gjord kolumnmappning. Bara rubriker som finns i filen följer med, och alla obligatoriska
 * roller måste vara mappade; kännetecknen är de obligatoriska rollernas rubriker och ålderns, när den är mappad.
 * @param {{namn:string, kalla:string, mappning:{[roll:string]: string|null|undefined}, rubriker:string[]}} u
 */
function profilFranMappning({ namn, kalla, mappning, rubriker }) {
    const iFilen = new Set((rubriker || []).map(String));
    /** @type {{[roll:string]:string[]}} */
    const r = {};
    for (const roll of IMPORTPROFIL_ROLLER) {
        const rubrik = mappning && mappning[roll];
        if (rubrik && iFilen.has(rubrik)) r[roll] = [rubrik];
    }
    if (!OBLIGATORISKA_ROLLER.every(roll => r[roll])) return null;
    return valideraImportprofil({ namn, rubriker: r }, { kalla });
}

/**
 * Profilerna som en fil att dela eller bidra med: formatet, versionen och profilerna utan källan (den sätts av den
 * som läser in).
 * @param {Array<{id:string, namn:string, rubriker:Object, kannetecken:string[]}>} profiler
 */
function importprofilerTillJson(profiler) {
    return JSON.stringify({
        format: IMPORTPROFIL_FORMAT,
        version: IMPORTPROFIL_VERSION,
        profiler: (profiler || []).map(p => ({ id: p.id, namn: p.namn, rubriker: p.rubriker, kannetecken: p.kannetecken })),
    }, null, 2);
}

// ---- Inbyggda profiler: bara format som projektet självt definierar ----
const _inbyggd = o => {
    // De inbyggda profilerna har fasta id:n i koden (inte ur en fil), så de sätts efter valideringen.
    const v = /** @type {NonNullable<ReturnType<typeof valideraImportprofil>>} */ (valideraImportprofil(o, { kalla: 'inbyggd' }));
    const p = { ...v, id: o.id };
    Object.values(p.rubriker).forEach(Object.freeze);
    Object.freeze(p.rubriker); Object.freeze(p.kannetecken);
    return Object.freeze(p);
};
const INBYGGDA_PROFILER = Object.freeze([
    // CSV-mallen som lönefilens ruta laddar ner (strukturdata_mall.csv).
    _inbyggd({ id: 'inbyggd-csv-mallen', namn: 'Verktygets CSV-mall',
        rubriker: { bas: ['BAS-intervall'], yrke: ['AID'], lon: ['Manadslon'], alder: ['Alder'], kon: ['Kon'], poang: ['Poang'] } }),
    // Testdatans personalfil (npm run gen:testdata, tools/lib/testdata.mjs). Kolumnen Ansvar är ett kännetecken men
    // ingen roll: en kolumn som bara heter Ansvar läses aldrig som ansvarskod.
    _inbyggd({ id: 'inbyggd-testdata', namn: 'Verktygets testdata',
        rubriker: { bas: ['BAS'], yrke: ['AID-etikett'], lon: ['Månadslön'], alder: ['Ålder'], kon: ['Kön'] },
        kannetecken: ['Ansvar', 'BAS', 'AID-etikett', 'Månadslön', 'Ålder', 'Kön'] }),
    // Verktygets egna fältnamn (fälten i dess rader, som demodatan har). Namnet säger inte demo: en verklig fil kan ha
    // just de rubrikerna. Id:t är det förra.
    _inbyggd({ id: 'inbyggd-demodata', namn: 'Verktygets grundfält',
        rubriker: { bas: ['bas'], yrke: ['yrke', 'aid'], lon: ['lon'], alder: ['alder'], kon: ['kon'] } }),
]);

/** De inbyggda profilerna (för appen, som bara når funktioner i spegeln). */
function inbyggdaProfiler() {
    return INBYGGDA_PROFILER;
}

    return { valideraImportprofil, valideraImportprofiler, matchaImportprofil, profilFranMappning, importprofilerTillJson, inbyggdaProfiler };
})();
const _ipValidera = __mirrorImportprofiler.valideraImportprofil;
const _ipValideraLista = __mirrorImportprofiler.valideraImportprofiler;
const _ipMatcha = __mirrorImportprofiler.matchaImportprofil;
const _ipFranMappning = __mirrorImportprofiler.profilFranMappning;
const _ipTillJson = __mirrorImportprofiler.importprofilerTillJson;
const _ipInbyggda = __mirrorImportprofiler.inbyggdaProfiler;

// ---- speglar src/lib/inlasning.js ----
const __mirrorInlasning = (() => {
    // importer ur tidigare speglade lib-moduler
    const _anTolka = __mirrorAnsvar.tolkaAnsvarskod;
    const _anGrupp = __mirrorAnsvar.ansvarsgrupp;
    const matchaImportprofil = __mirrorImportprofiler.matchaImportprofil;

// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
/**
 * Öppen lönekartläggning — tolkningen av indata: talen, könet, BAS-intervallet, AID-koden i ställningstagandet,
 * fältet för AID-etikett (yrket), kärnan i uppgiftsminimeringen (en lönerad → de vitlistade fälten), detektorn
 * för känsliga kolumner och upptäckten av personnamn i fältet för AID-etikett.
 *
 * Fältet för AID-etikett maskeras inte (ADR-85): verktyget behåller koden och högst 40 tecken av etiketten, utan
 * tecknen < > " ' &. Ser fältet ut att innehålla personnamn varnar inläsningen (yrkeNamnNyckel, sallsyntaNamnrader).
 *
 * Funktionerna är rena: inget tillstånd och ingen klocka. Vilken kolumn som bär vilket fält avgör appen
 * (getField och ALLOWED_FIELDS i src/app/, med kolumnmappningen, importprofilen och ansvarskolumnen), och året som ett
 * födelseår i ålderskolumnen räknas mot skickas in. Funktionerna behåller namnen de hade i appen.
 *
 * Webbläsarbygget får en AUTO-GENERERAD spegel i src/app/09-lib-speglar.js.
 */


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
 * @param {*} raw - Råvärde från CSV-/Excel-cell.
 * @returns {string} parseFloat-bar sträng ("" när värdet inte är ett tal i något av formaten).
 */
function _normalizeNumberString(raw) {
    if (typeof raw === 'number') return isFinite(raw) ? String(raw) : '';
    let s = raw.toString().trim()
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

function parseNumber(v) {
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
function parseNumberStrict(v) {
    if (v == null) return { status: 'empty', value: 0, raw: v };
    const raw = v.toString();
    if (raw.trim() === '') return { status: 'empty', value: 0, raw };
    const n = parseFloat(_normalizeNumberString(v));
    if (isNaN(n)) return { status: 'invalid', value: 0, raw };
    return { status: 'ok', value: n, raw };
}

// ---- Textfälten: AID-etiketten, BAS, AID i ställningstagandet och kön ----

// Etiketten i fältet för AID-etikett: resten efter AID-koden och vanliga separatorer (—, -, :, ., whitespace), utan
// HTML-meta-tecknen < > " ' &. De strippas vid inläsningen så att de aldrig kan smitas in i en innerHTML-template ens
// om en framtida renderingsplats glömmer esc() — CSP + esc() + inläsningen; tre lager. `s` är redan trimmad.
function _yrkeEtikett(s) {
    return s.replace(/^\d+\s*[—\-:.\s]*/, '').trim().replace(/[<>"'&]/g, '');
}

/**
 * Fältet för AID-etikett (yrket) vid inläsning (GDPR Art. 25.1: bara det analysen behöver).
 *
 * Källsystem exporterar ofta yrket som "12345 — Sjuksköterska" eller liknande. Verktyget behåller:
 *   - AID:      ledande siffergrupp (\d+)
 *   - Etikett:  resten efter AID och separatorerna, med tecknen < > " ' & borttagna
 *   - Längd:    etiketten kortas till 40 tecken (efter rensningen)
 *
 * Funktionen maskerar INTE namn (ADR-85): text som står i fältet behålls inom 40 tecken, och visas i tabeller och följer
 * med i exporter. Ser fältet ut att innehålla personnamn varnar inläsningen i stället (yrkeNamnNyckel,
 * sallsyntaNamnrader); den som tar ut filen ansvarar för att fältet bara bär kod och etikett.
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
    let label = _yrkeEtikett(s);
    // Kortningen sist — yrkesetiketter är sällan över 40 tecken
    if (label.length > 40) label = label.substring(0, 40).trim() + '…';
    if (aid && label) return `${aid} ${label}`;
    return aid || label;
}

/**
 * Namnmönstren som upptäckten av personnamn i fältet för AID-etikett prövar med (yrkeNamnNyckel): "Förnamn
 * Efternamn" (två ord i Versal-gemener i rad) och "Efternamn, Förnamn" (båda i versaler eller båda i Versal-gemener).
 * Ordgränsen är en fångad föregående icke-bokstav, eftersom \b inte fungerar före Å/Ä/Ö ("Örjan Östberg") och
 * lookbehind saknas i Safari före 16.4. Utan /g, så att test() inte bär tillstånd mellan anropen.
 */
const YRKE_NAMNMONSTER = Object.freeze([
    /(^|[^A-Za-zÅÄÖåäö])([A-ZÅÄÖ][a-zåäö]+\s+[A-ZÅÄÖ][a-zåäö]+)/,
    /(^|[^A-Za-zÅÄÖåäö])([A-ZÅÄÖ]{2,}(?:-[A-ZÅÄÖ]{2,})?, [A-ZÅÄÖ]{2,}(?:-[A-ZÅÄÖ]{2,})?|[A-ZÅÄÖ][a-zåäö]+(?:-[A-ZÅÄÖ][a-zåäö]+)?, [A-ZÅÄÖ][a-zåäö]+(?:-[A-ZÅÄÖ][a-zåäö]+)?)(?![A-Za-zÅÄÖåäö])/,
]);

/**
 * Om fältet för AID-etikett har ett namnmönster: texten efter AID-koden har något av mönstren i YRKE_NAMNMONSTER —
 * två eller fler ord i Versal-gemener i rad ("Anna Andersson", "Sjuksköterska Anna Andersson", "Anna-Lisa Berg")
 * eller "Efternamn, Förnamn" ("Andersson, Anna", "ANDERSSON, ANNA"). Prövas på råvärdet före kortningen (efter
 * AID-koden och separatorerna, med tecknen < > " ' & borttagna), så att ett namn som kortningen klipper också räknas.
 *
 * Mönstret ensamt träffar också etiketter med versal på två ord ("Sjuksköterska Natt"). Därför avgör mönstret bara
 * vilka texter som räknas; varningen gäller de som också är sällsynta i filen (sallsyntaNamnrader).
 * @param {*} raw - Fältets råvärde.
 * @returns {boolean}
 */
function yrkeLiknarNamn(raw) {
    return yrkeNamnNyckel(raw) !== '';
}

/**
 * Nyckeln som en text med namnmönster räknas under: etikettexten efter AID-koden i gemener, med blanksteg slagna
 * samman till ett, så att skiftläge och extra blanksteg räknas som samma text. Tom sträng när texten saknar
 * namnmönster (yrkeLiknarNamn). Nyckeln finns bara i inläsningens tillfälliga räknare och släpps när filen är läst.
 * @param {*} raw - Fältets råvärde.
 * @returns {string}
 */
function yrkeNamnNyckel(raw) {
    if (raw == null) return '';
    const s = raw.toString().trim();
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
const YRKE_NAMN_HOGST_RADER = 2;

/**
 * De misstänkta namnraderna ur inläsningens räknare: raderna vars text har namnmönster och står på högst
 * YRKE_NAMN_HOGST_RADER rader i filen.
 * @param {Map<string, {antal: number, radnr: Array<number|null>}>} raknare - Per yrkeNamnNyckel: antal rader och
 *   de första radnumren (YRKE_NAMN_HOGST_RADER räcker).
 * @param {number} [hogstRadnr] - Högst så många radnummer i svaret.
 * @returns {{antal: number, radnr: number[]}} Antalet misstänkta rader och de första radnumren, i stigande ordning.
 */
function sallsyntaNamnrader(raknare, hogstRadnr = 5) {
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
 * aldrig legitimt innehåller tecknen. Delas av lönefilen (_normalizeBas),
 * ställningstagandet (_normalizePolicyAid) och jämförelsestatistiken.
 */
function _stripHtmlMeta(s) {
    return s.toString().replace(/[<>"'&]/g, '');
}

/**
 * Normaliserar BAS-värden: trimma, versalisera och strippa ev. "BAS"-prefix
 * ("BAS A" → "A", "bas-2" → "2") så samma intervall inte splittras i två
 * kategorier beroende på exportformat. Ett ensamt "BAS" lämnas orört.
 * @param {*} raw
 * @returns {string}
 */
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

// ---- En lönerad ----

/**
 * Kärnan i uppgiftsminimeringen (GDPR Art. 5(1)(c)): de vitlistade fälten ur en lönerad, tolkade och normaliserade.
 * Appen slår upp råvärdena i raden (extractMinimalRecord i src/app/06-uppgiftsminimering.js, med getField och
 * ALLOWED_FIELDS) och skickar in dem här; inga andra kolumner når hit.
 * Yrke saneras via _cleanYrkeField (AID + 40 tecken etikett, utan tecknen < > " ' &; ingen namnmaskering, ADR-85).
 * Ger { bas, yrke, aid, yrkeLabel, lon, alder, kon, poang, ansvarskoder, ansvarsgrupp, _lonStatus, _alderStatus }.
 * @param {{bas:*, kon:*, lon:*, alder:*, poang:*, yrke:*, ansvar?:*}} falt - Råvärdet per roll ur raden.
 * @param {number} referensar - Året som ett födelseår i ålderskolumnen räknas mot (appen skickar innevarande år).
 * @param {boolean} [medAnsvar] - Om en godkänd kolumn för AID:s ansvarskod finns; falt.ansvar är radens värde i den.
 */
function tolkaLonerad(falt, referensar, medAnsvar = false) {
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

// ---- Filtexten: teckenkodning, avgränsare och rubrikrad (flyttade från src/app/32-filinlasning.js) ----

// #2: Robust CSV-inläsning. Excel-exporterad CSV är ofta Windows-1252 (inte
// UTF-8) och ibland kommaseparerad. Vi detekterar teckenkodning och avgränsare
// LOKALT (TextDecoder i webbläsaren, inga nätverksanrop) innan parsning så att
// å/ä/ö inte mojibakar och raderna inte hamnar i en enda kolumn.
function _decodeCsvBuffer(buf) {
    const bytes = new Uint8Array(buf);
    // UTF-16 (Excels "Unicode-text" sparar UTF-16LE med BOM, tab-avgränsat).
    // Utan denna kontroll faller UTF-16 igenom till Windows-1252 och blir
    // NUL-interfolierad rappakalja som parsern tuggar utan tydligt fel.
    if (bytes.length >= 2 && bytes[0] === 0xFF && bytes[1] === 0xFE) {
        return { text: new TextDecoder('utf-16le').decode(buf).replace(/^﻿/, ''), encoding: 'UTF-16 LE' };
    }
    if (bytes.length >= 2 && bytes[0] === 0xFE && bytes[1] === 0xFF) {
        return { text: new TextDecoder('utf-16be').decode(buf).replace(/^﻿/, ''), encoding: 'UTF-16 BE' };
    }
    if (bytes.length >= 3 && bytes[0] === 0xEF && bytes[1] === 0xBB && bytes[2] === 0xBF) {
        return { text: new TextDecoder('utf-8').decode(buf), encoding: 'UTF-8 (BOM)' };
    }
    try {
        // Strikt UTF-8: kastar om byten inte är giltig UTF-8 (typiskt Windows-1252-åäö).
        return { text: new TextDecoder('utf-8', { fatal: true }).decode(buf), encoding: 'UTF-8' };
    } catch (_e) {
        try {
            return { text: new TextDecoder('windows-1252').decode(buf), encoding: 'Windows-1252' };
        } catch (_e2) {
            return { text: new TextDecoder('utf-8').decode(buf), encoding: 'UTF-8 (osäker)' };
        }
    }
}

// Radslut: CRLF, LF eller bara CR (gamla Mac-filer) — samma regel i alla steg.
const _RADSLUT = /\r\n|\r|\n/;
/** Filtextens rader, med samma regel för radslut som avgränsaren och rubrikraden. */
function delaRader(text) { return text.split(_RADSLUT); }

function _detectDelimiter(text) {
    const firstLine = (text.split(_RADSLUT).find(l => l.trim().length) || '');
    let best = ';', bestN = 0;
    for (const d of [';', ',', '\t', '|']) {
        const n = firstLine.split(d).length - 1;
        if (n > bestN) { bestN = n; best = d; }
    }
    return bestN > 0 ? best : ';';
}

/**
 * Hittar rubrikraden i CSV-text och dess avgränsare. Exportverktyg lägger
 * ofta försättsrader före rubrikerna ("Rapport uttagen 2026-01-15;;;;"), och
 * de får inte tas för rubriker. Vi provar de
 * 15 första raderna × alla avgränsare och väljer den kombination som matchar
 * flest kända kolumnroller (synonymGroups = array av normaliserade substrängar
 * per roll, t.ex. Object.values(ALLOWED_FIELDS)).
 *
 * @param {string} text - Avkodad filtext.
 * @param {Array<Array<string>>} synonymGroups - En grupp synonymer per roll.
 * @param {number} [minHits=2] - Min antal roller som måste matcha.
 * @param {any[]} [profiler] - Importprofiler (lönefilen): den första raden där en profils alla kännetecken finns är
 *          rubrikraden, också när den har färre delsträngsträffar än en försättsrad.
 * @returns {{line:number, delim:string|null, hits:number}} line = 0-baserat radindex;
 *          vid ingen träff: line 0 + avgränsaren från _detectDelimiter.
 */
function _findCsvHeader(text, synonymGroups, minHits = 2, profiler = []) {
    const lines = text.split(_RADSLUT).slice(0, 15);
    /** @type {{line: number, delim: string|null, hits: number}} */
    let best = { line: 0, delim: null, hits: -1 };
    for (let i = 0; i < lines.length; i++) {
        if (!lines[i] || !lines[i].trim()) continue;
        for (const d of [';', ',', '\t', '|']) {
            const raa = lines[i].split(d).map(c => c.replace(/^"+|"+$/g, ''));
            if (raa.length < 2) continue;
            if (profiler.length && matchaImportprofil(raa, profiler)) return { line: i, delim: d, hits: synonymGroups.length };
            const cells = raa.map(c => c.toLowerCase().replace(/[^a-z0-9]/g, ''));
            let hits = 0;
            for (const group of synonymGroups) {
                if (group.some(syn => cells.some(c => c.includes(syn)))) hits++;
            }
            if (hits > best.hits) best = { line: i, delim: d, hits };
        }
    }
    if (best.hits >= minHits) return best;
    return { line: 0, delim: _detectDelimiter(text), hits: 0 };
}

    return { _normalizeNumberString, parseNumber, parseNumberStrict, _cleanYrkeField, _stripHtmlMeta, _normalizeBas, _normalizePolicyAid, _normalizeKon, tolkaLonerad, _pnrSampelSteg, detectSensitiveColumns, yrkeNamnNyckel, sallsyntaNamnrader, _decodeCsvBuffer, delaRader, _detectDelimiter, _findCsvHeader };
})();
const _normalizeNumberString = __mirrorInlasning._normalizeNumberString;
const parseNumber = __mirrorInlasning.parseNumber;
const parseNumberStrict = __mirrorInlasning.parseNumberStrict;
const _cleanYrkeField = __mirrorInlasning._cleanYrkeField;
const _stripHtmlMeta = __mirrorInlasning._stripHtmlMeta;
const _normalizeBas = __mirrorInlasning._normalizeBas;
const _normalizePolicyAid = __mirrorInlasning._normalizePolicyAid;
const _normalizeKon = __mirrorInlasning._normalizeKon;
const _ilTolkaLonerad = __mirrorInlasning.tolkaLonerad;
const _pnrSampelSteg = __mirrorInlasning._pnrSampelSteg;
const detectSensitiveColumns = __mirrorInlasning.detectSensitiveColumns;
const _ilYrkeNamnNyckel = __mirrorInlasning.yrkeNamnNyckel;
const _ilSallsyntaNamnrader = __mirrorInlasning.sallsyntaNamnrader;
const _decodeCsvBuffer = __mirrorInlasning._decodeCsvBuffer;
const _delaRader = __mirrorInlasning.delaRader;
const _detectDelimiter = __mirrorInlasning._detectDelimiter;
const _findCsvHeader = __mirrorInlasning._findCsvHeader;

// ---- speglar src/lib/aidkontroll.js ----
const __mirrorAidkontroll = (() => {
    // importer ur tidigare speglade lib-moduler
    const etikett = __mirrorAid.etikett;
    const huvudomrade = __mirrorAid.huvudomrade;
    const arRestkod = __mirrorAid.arRestkod;
    const arLedningsetikett = __mirrorAid.arLedningsetikett;
    const normaliseraAid = __mirrorAid.normaliseraAid;
    const quantile = __mirrorStat.quantile;
    const skapaTermer = __mirrorTermer.skapaTermer;
    const stor = __mirrorTermer.stor;
    const adjektiv = __mirrorTermer.adjektiv;
    const ordForAntal = __mirrorTermer.ordForAntal;

// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
/**
 * Öppen lönekartläggning — kontroll av AID-kodningen (ADR-33).
 * Kriterierna har samma form som i datakvalitet.js och läggs till i Underlagets kvalitet.
 * Texterna redovisar antal och koder, aldrig enskilda personer eller löner.
 *
 * Webbläsarbygget får en AUTO-GENERERAD spegel i src/app/09-lib-speglar.js.
 */



/** Standardtermerna (ADR-74); skapaTermer() utan egna termer ger standarduppsättningen. */
const T = skapaTermer();


const RESTKOD_GRANS = 10;      // % av personerna
const SPRIDNING_GRANS = 1.6;   // P90/P10

const pers = n => `${n} ${n === 1 ? 'person' : 'personer'}`;

/**
 * @param {any[]} rader
 * @param {{k:number, harAnsvar?:boolean}} opts
 */
function aidKriterier(rader, { k, harAnsvar = false }) {
    const alla = (rader || []).filter(Boolean);
    // En yrkeskolumn utan sexsiffriga koder (t.ex. befattningar i klartext) har ingen AID-kodning att pröva.
    const d = alla.filter(r => normaliseraAid(r.aid));
    if (!d.length) return [];
    const utanKod = alla.length - d.length;
    const ut = [];

    const okanda = d.filter(r => !etikett(r.aid) || !huvudomrade(r.aid));
    const okandaKoder = [...new Set(okanda.map(r => normaliseraAid(r.aid)))].slice(0, 5);
    const delar = [];
    if (okanda.length) delar.push(`${pers(okanda.length)} har en ${T.kod.en} som inte finns i SKR:s etikettlista (t.ex. ${okandaKoder.join(', ')}).`);
    if (utanKod) delar.push(`${pers(utanKod)} saknar en sexsiffrig ${T.kod.en}.`);
    ut.push({ id: 'aid-okanda', namn: stor(T.kod.fl), status: delar.length ? 'varning' : 'ok', varde: okanda.length + utanKod,
        text: delar.length
            ? `${delar.join(' ')} De ingår i analyserna men får ${adjektiv({ utrum: 'ingen', neutrum: 'inget', plural: 'inga' }, T.huvudomrade)} ${T.huvudomrade.en}.`
            : `Alla ${T.kod.fl} finns i SKR:s etikettlista.` });

    const rest = d.filter(r => arRestkod(r.aid)).length;
    const restPct = d.length ? rest / d.length * 100 : 0;
    ut.push({ id: 'aid-restkoder', namn: 'Restkoder (annan/annat)', status: restPct > RESTKOD_GRANS ? 'varning' : 'ok', varde: restPct,
        text: !rest ? 'Ingen har en restkod (…090).'
            : `${pers(rest)} (${restPct.toFixed(1).replace('.', ',')} %) har en restkod (…090).`
            + (restPct > RESTKOD_GRANS ? ' Jämförelserna inom dessa grupper blir grövre — granska om en annan etikett passar bättre.' : '') });

    const per = new Map();
    d.forEach(r => { const key = normaliseraAid(r.aid); if (!per.has(key)) per.set(key, []); per.get(key).push(r.lon); });
    const breda = [...per].filter(([, l]) => l.length >= k).map(([aid, l]) => {
        const p10 = quantile(l, 0.1), p90 = quantile(l, 0.9);
        return { aid, kvot: p10 > 0 ? p90 / p10 : null };
    }).filter(x => x.kvot != null && x.kvot > SPRIDNING_GRANS);
    ut.push({ id: 'aid-spridning', namn: 'Lönespridning inom AID', status: breda.length ? 'varning' : 'ok', varde: breda.length,
        text: breda.length
            ? `${breda.length} ${ordForAntal(breda.length, T.kod)} har ovanligt stor lönespridning (P90/P10 över ${String(SPRIDNING_GRANS).replace('.', ',')}): ${breda.slice(0, 5).map(x => x.aid).join(', ')}. Värt att granska — det kan tyda på att olika arbeten har samma kod.`
            : `${stor(adjektiv({ utrum: 'ingen', neutrum: 'inget', plural: 'inga' }, T.kod))} ${T.kod.en} har ovanligt stor lönespridning.` });

    if (harAnsvar) {
        const utanKod = d.filter(r => arLedningsetikett(r.aid) && !(r.ansvarskoder || []).some(x => 'ABCL'.includes(x) && x.length === 1)).length;
        ut.push({ id: 'aid-ledning-utan-ansvar', namn: 'Ledningsetikett utan ansvarskod', status: utanKod ? 'varning' : 'ok', varde: utanKod,
            text: utanKod ? `${pers(utanKod)} har en ledningsetikett (10xxxx) utan ansvarskod A, B, C eller L, som etikettlistan kräver.`
                : 'Alla med ledningsetikett har ansvarskod.' });
        const otillatna = d.filter(r => {
            const e = etikett(r.aid);
            return e && (r.ansvarskoder || []).some(x => !e.ansvarskoder.includes(x));
        }).length;
        ut.push({ id: 'aid-otillaten-ansvarskod', namn: 'Ansvarskod och etikett', status: otillatna ? 'varning' : 'ok', varde: otillatna,
            text: otillatna ? `${pers(otillatna)} har en ansvarskod som etikettlistan inte tillåter för etiketten (t.ex. A utanför ledningsarbete, F på en ledningsetikett, M för någon som inte är läkare).`
                : 'Alla ansvarskoder är tillåtna för sina etiketter.' });
    }
    return ut;
}

    return { aidKriterier };
})();
const _akAidKriterier = __mirrorAidkontroll.aidKriterier;

// ---- speglar src/lib/jamforelse.js ----
const __mirrorJamforelse = (() => {
    // importer ur tidigare speglade lib-moduler
    const median = __mirrorStat.median;
    const quantile = __mirrorStat.quantile;
    const sektorsnamn = __mirrorAid.sektorsnamn;
    const aidAvYrke = __mirrorAid.aidAvYrke;
    const namnrader = __mirrorAid.namnrader;
    const skapaTermer = __mirrorTermer.skapaTermer;
    const ordForAntal = __mirrorTermer.ordForAntal;
    const adjektiv = __mirrorTermer.adjektiv;
    const arKvinna = __mirrorKon.arKvinna;

// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
/**
 * Öppen lönekartläggning — Jämförelsestatistik (ADR-35).
 *
 * Per yrke (AID-kodens siffror i början av yrket) och BAS-intervall: organisationens P10, median och P90,
 * jämförelsestatistikens och ställningstagandets värden och skillnaderna. Grupper med färre än k personer
 * tas inte med. Tabellen, diagrammen och den samlade Excelexporten läser samma rader.
 *
 * Statistikens matchning (`statistikFor`) är det enda uppslaget i verktyget: samma AID och samma BAS, annars en rad
 * för samma AID som saknar BAS. En rad för ett annat BAS-intervall används aldrig.
 *
 * Webbläsarbygget får en AUTO-GENERERAD spegel i src/app/09-lib-speglar.js.
 */




/** Standardtermerna (ADR-74); skapaTermer() utan egna termer ger standarduppsättningen. */
const T = skapaTermer();

const _pos = v => (typeof v === 'number' && v > 0 ? v : null);
const _tre = (p10, med, p90) => ({ p10: _pos(p10), median: _pos(med), p90: _pos(p90) });
const _diff = (org, ref) => (org != null && ref != null ? { kr: org - ref, pct: (org / ref - 1) * 100 } : null);
const _diffar = (org, ref) => ({ p10: _diff(org.p10, ref.p10), median: _diff(org.median, ref.median), p90: _diff(org.p90, ref.p90) });

/** AID-koden ur yrkesfältet: definitionen ligger i aid.js; återexporteras här för de importörer som når den härifrån. */

/**
 * Statistikens rad för en organisationsgrupp AID×BAS: en rad med samma AID och samma BAS ('aid-bas'), annars en
 * rad med samma AID som saknar BAS ('aid'). En rad för ett annat BAS-intervall används aldrig. AID och BAS
 * jämförs som text.
 * @param {Array<{aid?:any, bas?:any}>|null|undefined} statistik
 * @param {any} aid
 * @param {any} bas
 * @returns {{rad: any, matchning: 'aid-bas'|'aid'}|null}
 */
function statistikFor(statistik, aid, bas) {
    const a = String(aid ?? ''), b = String(bas ?? '');
    if (!a || !Array.isArray(statistik)) return null;
    const sammaAid = x => x != null && String(x.aid ?? '') === a;
    const exakt = b ? statistik.find(x => sammaAid(x) && String(x.bas ?? '') === b) : null;
    if (exakt) return { rad: exakt, matchning: 'aid-bas' };
    const utanBas = statistik.find(x => sammaAid(x) && !x.bas);
    return utanBas ? { rad: utanBas, matchning: 'aid' } : null;
}

/** Matchningsnivån i ord, samma ord som ställningstagandets nivåer; "–" utan statistik. */
const MATCHNING_ETIKETT = { 'aid-bas': 'AID + BAS', aid: 'Endast AID' };
/** @param {string|null|undefined} matchning */
function matchningEtikett(matchning) {
    return (matchning && MATCHNING_ETIKETT[matchning]) || '–';
}

/** Antalet rader (yrkesgrupper) per matchningsnivå. @param {Array<{statistikMatchning?:string|null}>} rader */
function matchningAntal(rader) {
    const ut = { aidBas: 0, aid: 0, utan: 0 };
    for (const r of rader || []) {
        if (r.statistikMatchning === 'aid-bas') ut.aidBas++;
        else if (r.statistikMatchning === 'aid') ut.aid++;
        else ut.utan++;
    }
    return ut;
}

/** Sammanfattningen ovanför tabellen; tom sträng utan rader. @param {Array<{statistikMatchning?:string|null}>} rader */
function matchningSammanfattning(rader) {
    if (!rader || !rader.length) return '';
    const { aidBas, aid, utan } = matchningAntal(rader);
    return `Statistiken: ${aidBas} ${ordForAntal(aidBas, T.enhet)} i ${T.niva.en} ${adjektiv('matchad', T.enhet, { plural: aidBas !== 1 })} på AID och BAS, `
        + `${aid} på endast AID, ${utan} utan statistik.`;
}

/**
 * Statistikens median per organisationsgrupp, som Löneöversyns marknadspositionering läser den: nyckeln `aid|bas`,
 * bara för grupper med en matchad rad med positiv median.
 * @param {Array<any>} statistik
 * @param {Array<{aid:any, bas:any}>} grupper
 * @returns {Map<string, number>}
 */
function statistikMarknad(statistik, grupper) {
    const ut = new Map();
    for (const g of grupper || []) {
        const m = statistikFor(statistik, g.aid, g.bas);
        if (m && m.rad.median > 0) ut.set(String(g.aid) + '|' + String(g.bas), m.rad.median);
    }
    return ut;
}

/**
 * Medianen av statistikens matchade medianer för grupperna AID×BAS (varje grupp en gång); null utan någon träff.
 * @param {Array<any>} statistik
 * @param {Array<{aid:any, bas:any}>} grupper
 * @returns {number|null}
 */
function statistikensMedianFor(statistik, grupper) {
    const sedda = new Set(), medianer = [];
    for (const g of grupper || []) {
        const nyckel = String(g.aid) + '|' + String(g.bas);
        if (sedda.has(nyckel)) continue;
        sedda.add(nyckel);
        const m = statistikFor(statistik, g.aid, g.bas);
        if (m && m.rad.median > 0) medianer.push(m.rad.median);
    }
    return medianer.length ? median(medianer) : null;
}

/**
 * @param {Array<{yrke:string, bas:string, lon:number, kon?:string}>} rader
 * @param {{statistik:Array, policyFor:(aid:string, bas:string)=>({p10?:number, med?:number, p90?:number}|null), k:number}} opt
 */
function jamforelseRader(rader, { statistik = [], policyFor = () => null, k }) {
    const perAid = new Map();   // aid → Map(bas → { yrke, lons })
    // Gruppens namn är texten på flest av dess rader (namnrader), som i resten av verktyget (ADR-89).
    const namn = namnrader(rader, r => `${aidAvYrke(r.yrke)}|${r.bas}`);
    for (const r of rader || []) {
        const aid = aidAvYrke(r.yrke);
        if (!perAid.has(aid)) perAid.set(aid, new Map());
        const perBas = perAid.get(aid);
        if (!perBas.has(r.bas)) perBas.set(r.bas, { yrke: namn.get(`${aid}|${r.bas}`).yrke, lons: [], kvinnor: 0 });
        const g = perBas.get(r.bas);
        g.lons.push(r.lon);
        if (arKvinna(r)) g.kvinnor++;
    }
    const ut = [], utelamnade = [];
    for (const [aid, perBas] of perAid) {
        for (const bas of [...perBas.keys()].sort()) {
            const { yrke, lons, kvinnor } = perBas.get(bas);
            if (lons.length < k) { utelamnade.push(`${aid} (BAS ${bas})`); continue; }
            const org = _tre(quantile(lons, 0.1), median(lons), quantile(lons, 0.9));
            const traff = statistikFor(statistik, aid, bas), s = traff?.rad;
            const p = policyFor(aid, bas);
            const stat = _tre(s?.p10, s?.median, s?.p90), pol = _tre(p?.p10, p?.med, p?.p90);
            // kvAndel: andelen kvinnor i procent, för könsdominansen i Löneläget (samma räkning som bandkartan).
            ut.push({ aid, yrke, bas, sektor: sektorsnamn(aid), n: lons.length, kvAndel: kvinnor / lons.length * 100, org, statistik: stat, stallningstagande: pol,
                statistikMatchning: traff ? traff.matchning : null,
                diff: { statistik: _diffar(org, stat), stallningstagande: _diffar(org, pol) } });
        }
    }
    ut.sort((a, b) => (a.bas !== b.bas ? (a.bas < b.bas ? -1 : 1) : a.yrke < b.yrke ? -1 : a.yrke > b.yrke ? 1 : 0));
    return { rader: ut, utelamnade };
}

/** Underlaget till diagram 2: raderna med median i båda, mest negativ skillnad först. */
function avvikelseRangordning(rader, kalla) {
    return (rader || []).filter(r => r.diff[kalla] && r.diff[kalla].median)
        .sort((a, b) => a.diff[kalla].median.pct - b.diff[kalla].median.pct);
}

    return { jamforelseRader, avvikelseRangordning, statistikFor, matchningEtikett, matchningAntal, matchningSammanfattning, statistikMarknad, statistikensMedianFor };
})();
const _jfRader = __mirrorJamforelse.jamforelseRader;
const _jfRangordning = __mirrorJamforelse.avvikelseRangordning;
const _jfStatistikFor = __mirrorJamforelse.statistikFor;
const _jfMatchningEtikett = __mirrorJamforelse.matchningEtikett;
const _jfMatchningAntal = __mirrorJamforelse.matchningAntal;
const _jfMatchningSammanfattning = __mirrorJamforelse.matchningSammanfattning;
const _jfStatistikMarknad = __mirrorJamforelse.statistikMarknad;
const _jfStatistikensMedianFor = __mirrorJamforelse.statistikensMedianFor;

// ---- speglar src/lib/referenser.js ----
const __mirrorReferenser = (() => {
    // importer ur tidigare speglade lib-moduler
    const bandPosition = __mirrorLonepolitik.bandPosition;

// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
/**
 * Öppen lönekartläggning — organisationens löner mot båda referenserna (ADR-55).
 *
 * Ställningstagandet är referenspunkten: löneläget och jämförelsestatistiken mäts mot det, aldrig tvärtom.
 * Modulen bygger på raderna ur jamforelse.js (organisationens P10, median och P90 per yrke och BAS mot båda
 * referenserna) och räknar läget i spannet, mönstret, förslaget på referens, båda i ord (`lageOchForslag`), och
 * överblickens tal. Grupper under minsta gruppstorlek är redan borta ur raderna; modulen vet inget om tröskeln.
 * Förslaget är ett förslag, ingen regel som verktyget tillämpar någon annanstans.
 *
 * Webbläsarbygget får en AUTO-GENERERAD spegel i src/app/09-lib-speglar.js.
 */

const _NAMN = { stallningstagande: 'ställningstagandet', statistik: 'statistiken' };
const _inom = pos => pos >= 0 && pos <= 100;
const _riktning = (pos, under, over) => (pos == null ? null : pos < 0 ? under : pos > 100 ? over : 'inom');
const _pos = (median, ref) => {
    const p = bandPosition(median, ref?.p10, ref?.p90);
    return p == null ? null : p * 100;
};
const _skillnad = (varde, ref) => (varde != null && ref != null ? (varde / ref - 1) * 100 : null);

/**
 * Var en median ligger mot en referens P10–P90: 0 = P10, 100 = P90, utanför spannet under 0 och över 100.
 * @param {number|null} median
 * @param {{p10?:number|null, p90?:number|null}} ref
 */
function lageISpann(median, ref) {
    const pos = _pos(median, ref);
    if (pos == null) return { pos: null, ord: '' };
    const ord = pos < 0 ? 'nedanför' : pos < 33 ? 'i nedre delen' : pos < 67 ? 'mitt i' : pos <= 100 ? 'i övre delen' : 'ovanför';
    return { pos, ord };
}

/** Löneläget och statistiken mot ställningstagandet, i ord. Statistiken räknas på sin median, så bara median räcker. */
function monster(rad) {
    const p = rad.stallningstagande;
    const lonelage = _riktning(_pos(rad.org?.median, p), 'nedanför', 'ovanför');
    const statistik = _riktning(_pos(rad.statistik?.median, p), 'under', 'över');
    if (lonelage == null && statistik == null) {
        const motStatistik = _riktning(_pos(rad.org?.median, rad.statistik), 'nedanför', 'ovanför');
        return { lonelage, statistik, text: motStatistik ? `ställningstagande saknas; löneläget ${motStatistik} statistiken` : '' };
    }
    const delar = [];
    if (lonelage) delar.push(`löneläget ${lonelage} ställningstagandet`);
    if (statistik) {
        const samma = (lonelage === 'ovanför' && statistik === 'över') || (lonelage === 'nedanför' && statistik === 'under') || (lonelage === 'inom' && statistik === 'inom');
        delar.push(`statistiken ${samma ? 'också ' : ''}${statistik}`);
    }
    return { lonelage, statistik, text: delar.join(', ') };
}

// Avståndet i kronor från medianen till spannets närmaste kant.
const _avstand = (median, ref) => Math.max(ref.p10 - median, median - ref.p90, 0);
const _lageOrd = (median, nyckel, ref) => {
    const r = _riktning(_pos(median, ref), 'nedanför', 'ovanför');
    return r && (r === 'inom' ? `löneläget ligger inom ${_NAMN[nyckel]}` : `löneläget ligger ${r} ${_NAMN[nyckel]}`);
};

/**
 * Förslag på referens: den gruppen ligger inom, ställningstagandet om gruppen ligger inom båda, annars den vars
 * spann ligger närmast. Bara spann kan jämföras: en referens med bara median föreslås när ingen annan finns.
 */
function forslag(rad) {
    const median = rad.org?.median;
    const finns = ['stallningstagande', 'statistik'].filter(k => rad[k]?.median != null);
    if (!finns.length) return { referens: null, skal: '' };
    const medSpann = finns.filter(k => _pos(median, rad[k]) != null);
    const skal = k => _lageOrd(median, k, rad[k]) || `bara ${_NAMN[k]} finns`;
    if (medSpann.length < 2) {
        const k = medSpann[0] || finns[0];
        return { referens: k, skal: skal(k) };
    }
    const inom = medSpann.filter(k => _inom(_pos(median, rad[k])));
    if (inom.length === 1) return { referens: inom[0], skal: medSpann.map(skal).join('; ') };
    if (inom.length === 2) return { referens: 'stallningstagande', skal: 'löneläget ligger inom båda' };
    const [narmast] = [...medSpann].sort((a, b) => _avstand(median, rad[a]) - _avstand(median, rad[b]));
    return { referens: narmast, skal: skal(narmast) };
}

const _forsta = s => (s ? s[0].toUpperCase() + s.slice(1) : '');

/**
 * Läge och förslag i ord, för skärmens lista, Excel-bladet och rapporten: mönstret, och förslaget på referens bara
 * när det skiljer sig från ställningstagandet (förslaget är då statistiken, med skälet). Utan mönster står förslagets
 * skäl ensamt; utan något av dem en tom sträng.
 * @param {{org?:any, stallningstagande?:any, lage:{stallningstagande:{pos:number|null}, statistik:{pos:number|null}}, monster:{text:string}, forslag:{referens:string|null, skal:string}}} g
 * @param {{harStallningstagande?:boolean}} [opt]
 */
function lageOchForslag(g, { harStallningstagande = true } = {}) {
    const text = g.monster?.text || '';
    const f = g.forslag || { referens: null, skal: '' };
    if (!harStallningstagande || f.referens !== 'statistik') return _forsta(text || f.skal);
    const statPos = g.lage?.statistik?.pos;
    const skal = g.stallningstagande?.median == null ? 'ställningstagandet saknar värden för gruppen'
        : g.lage?.stallningstagande?.pos == null ? (statPos != null && _inom(statPos) ? 'bara statistiken har ett spann, och löneläget ligger inom det' : 'bara statistiken har ett spann')
        : statPos != null && _inom(statPos) ? 'löneläget ligger inom statistiken men inte inom ställningstagandet'
        : 'statistikens spann ligger närmast löneläget';
    return `${text ? `${_forsta(text)}. ` : ''}Förslag: statistiken som referens (${skal}).`;
}

function _vagd(grupper, nyckel) {
    let summa = 0, n = 0;
    for (const g of grupper) {
        const pct = _skillnad(g.org?.median, g[nyckel]?.median);
        if (pct == null) continue;
        summa += g.n * pct; n += g.n;
    }
    return n ? summa / n : null;
}

const _utanforMitten = g => {
    const pos = g.lage.stallningstagande.pos;
    return pos == null || _inom(pos) ? -1 : Math.abs(pos - 50);
};

/**
 * @param {Array<any>} rader raderna ur jamforelseRader
 * @param {{harStatistik?:boolean, harStallningstagande?:boolean, statistikHarSpann?:boolean}} opt
 */
function referensOverblick(rader, { harStatistik = true, harStallningstagande = true, statistikHarSpann = true } = {}) {
    const tom = { p10: null, median: null, p90: null };
    const grupper = (rader || []).map(r => {
        const rad = { ...r, statistik: harStatistik ? r.statistik : tom, statistikMatchning: harStatistik ? r.statistikMatchning ?? null : null,
            stallningstagande: harStallningstagande ? r.stallningstagande : tom };
        const spann = statistikHarSpann ? rad.statistik : { ...rad.statistik, p10: null, p90: null };
        const bedomd = { ...rad, statistik: spann };
        const g = { ...rad, lage: { stallningstagande: lageISpann(rad.org?.median, rad.stallningstagande), statistik: lageISpann(rad.org?.median, spann) },
            monster: monster(bedomd), forslag: forslag(bedomd) };
        return { ...g, lageOchForslag: lageOchForslag(g, { harStallningstagande }) };
    }).sort((a, b) => _utanforMitten(b) - _utanforMitten(a) || (a.yrke < b.yrke ? -1 : a.yrke > b.yrke ? 1 : 0));

    const motPolicy = grupper.filter(g => g.monster.lonelage != null);
    const personer = motPolicy.reduce((s, g) => s + g.n, 0);
    const tal = villkor => {
        const urval = motPolicy.filter(g => g.monster.statistik != null && villkor(g.monster));
        const antal = urval.reduce((s, g) => s + g.n, 0);
        return { grupper: urval.length, personer: antal, andel: personer ? 100 * antal / personer : 0 };
    };
    const statistikMotStallningstagande = grupper
        .filter(g => g.statistik.median != null && g.stallningstagande.median != null)
        .map(g => ({ yrke: g.yrke, bas: g.bas, aid: g.aid,
            p10: _skillnad(g.statistik.p10, g.stallningstagande.p10),
            median: _skillnad(g.statistik.median, g.stallningstagande.median),
            p90: _skillnad(g.statistik.p90, g.stallningstagande.p90) }))
        .sort((a, b) => /** @type {number} */ (b.median) - /** @type {number} */ (a.median));
    return { grupper,
        tal: { antalGrupper: grupper.length,
            perMonster: {
                badaOver: tal(m => m.lonelage === 'ovanför' && m.statistik === 'över'),
                baraLonelageOver: tal(m => m.lonelage === 'ovanför' && m.statistik !== 'över'),
                baraStatistikOver: tal(m => m.lonelage !== 'ovanför' && m.statistik === 'över'),
                badaInom: tal(m => m.lonelage === 'inom' && m.statistik === 'inom')
            },
            forslagStatistik: grupper.filter(g => g.forslag.referens === 'statistik').length,
            vagdMedianMotStallningstagandePct: _vagd(grupper, 'stallningstagande'),
            vagdMedianMotStatistikPct: _vagd(grupper, 'statistik') },
        statistikMotStallningstagande };
}

/** Bildens rader i listans ordning: de tre spannen per yrkesgrupp, null för en referens utan median, och gruppens yrke, AID, BAS-intervall och antal (bildens urval; antalet står i listans kolumn n). */
function hantelRader(grupper) {
    const ref = v => (v?.median != null ? { p10: v.p10, median: v.median, p90: v.p90 } : null);
    return (grupper || []).map(g => ({ namn: `${g.yrke} · BAS ${g.bas}`, yrke: g.yrke, aid: g.aid, bas: g.bas, n: g.n, stallningstagande: ref(g.stallningstagande), statistik: ref(g.statistik), org: g.org }));
}

    return { lageISpann, monster, forslag, referensOverblick, hantelRader, lageOchForslag };
})();
const _rrLage = __mirrorReferenser.lageISpann;
const _rrMonster = __mirrorReferenser.monster;
const _rrForslag = __mirrorReferenser.forslag;
const _rrOverblick = __mirrorReferenser.referensOverblick;
const _rrHantelRader = __mirrorReferenser.hantelRader;
const _rrLageOchForslag = __mirrorReferenser.lageOchForslag;

// ---- speglar src/lib/rapportunderlag.js ----
const __mirrorRapportunderlag = (() => {
    // importer ur tidigare speglade lib-moduler
    const median = __mirrorStat.median;
    const quantile = __mirrorStat.quantile;
    const fitOLS = __mirrorStat.fitOLS;
    const skrDelText = __mirrorSkrReferens.skrDelText;
    const matchningEtikett = __mirrorJamforelse.matchningEtikett;
    const bedomSkillnad = __mirrorStatus.bedomSkillnad;
    const statusKonstanter = __mirrorStatus.statusKonstanter;
    const lonebegreppReservation = __mirrorStructure.lonebegreppReservation;
    const personOrd = __mirrorNamn.personOrd;
    const sektorJusteradText = __mirrorSektor.sektorJusteradText;
    const sektorAndelNot = __mirrorSektor.sektorAndelNot;
    const kvDefinitionText = __mirrorAidbas.kvDefinitionText;
    const basRangFn = __mirrorLikvardighet.basRangFn;
    const gapDelar = __mirrorGapuppdelning.gapDelar;
    const gapVariablerIText = __mirrorGapuppdelning.gapVariablerIText;
    const gapVariablerArStandard = __mirrorGapuppdelning.gapVariablerArStandard;
    const gapStandardVariabler = __mirrorGapuppdelning.gapStandardVariabler;
    const skapaTermer = __mirrorTermer.skapaTermer;
    const genitiv = __mirrorTermer.genitiv;
    const stor = __mirrorTermer.stor;
    const artikel = __mirrorTermer.artikel;
    const adjektiv = __mirrorTermer.adjektiv;
    const termFras = __mirrorTermer.termFras;
    const arKvinna = __mirrorKon.arKvinna;
    const aidAvRad = __mirrorAid.aidAvRad;
    const namnrader = __mirrorAid.namnrader;

// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
/**
 * Öppen lönekartläggning — rapportunderlag (ADR-20).
 *
 * Ren logik bakom panelen Rapportunderlag: vilka yrkesgrupper Lika arbete flaggar
 * (samma regel som EU-tabellen, som använder den här funktionen), justerat gap inom
 * ett yrke, och block med faktastycke, tabell och frågor som kopieras in i en egen
 * Word-mall. Bedömningen (sakliga skäl) skrivs inte här — den kräver kunskap som
 * bara verksamheten har.
 *
 * Webbläsarbygget får en AUTO-GENERERAD spegel i src/app/09-lib-speglar.js.
 */













/** Standardtermerna (ADR-74); skapaTermer() utan egna termer ger standarduppsättningen. */
const T = skapaTermer();

const { STORLEKSGRANS, DIREKTIV_KOLUMN, DIREKTIV_ETIKETT, DIREKTIV_TIPS } = statusKonstanter();

const _arMan = r => typeof r.kon === 'string' && !r.kon.includes('kvinna') && (r.kon.includes('man') || r.kon.includes('män'));

/**
 * Noteringen om en variabel som valts bort ur förklaringsmodellen (ADR-56), som den står i rapporten och i panelen.
 * @param {{etikett:string, deltaR2pp?:number|null, skal?:string}} b
 */
function bortvaltNotering(b) {
    const tal = typeof b.deltaR2pp === 'number' && isFinite(b.deltaR2pp)
        ? `tillför ${Math.abs(b.deltaR2pp).toFixed(1).replace('.', ',')} procentenheter i förklaringsgrad` : 'gick inte att pröva';
    return `${b.etikett} har kontrollerats och ${tal}; den ingår inte i siffrorna.${b.skal ? ` Skäl: ${b.skal}` : ''}`;
}

/** Gruppens namn med BAS-intervallet, som noterna och listorna skriver det: "207011 Handläggare (BAS C)". */
function gruppMedBas(g) {
    return g.bas != null && g.bas !== '' ? `${g.yrke} (BAS ${g.bas})` : String(g.yrke);
}

/**
 * Grupperna i Lika arbete (samma jämförelseenhet och k-regler som EU-tabellen) med uppmärksamhetstrappans
 * status (ADR-59, src/lib/status.js): `niva` är 'granska', 'folj', 'balanserat' eller 'ejbedomd' (ett kön under
 * `golv`); `flaggad` är detsamma som Värt att granska. `direktiv` är direktivmarkeringen på den ojusterade
 * medianskillnaden (minst 5 %), oberoende av statusen. Stabiliteten prövas mot statusens storleksgräns (3 %).
 * En grupp är AID-koden (aidAvRad) i BAS-intervallet (ADR-89), inte texten i fältet för AID-etikett: två stavningar av
 * samma etikett i samma intervall är en grupp, och samma kod i två intervall är två grupper. `yrke` är gruppens namn,
 * texten som står på flest av gruppens rader (namnrader i aid.js), `aid` koden och `bas` intervallet; `etikett` är samma
 * rads etikett (yrkeLabel när den finns, annars texten), som tabellerna per AID-kod och BAS-intervall visar bredvid koden. `lag` och `hog`
 * är slumpens gränser som prövningen använde (null när gruppen inte prövades). Grupperna står med samma kod intill varandra: koderna
 * ordnade efter den största skillnaden bland kodens grupper, och inom koden intervallen i BAS-ordning.
 * `utelamnade` och `ejJamforbara` bär namnen med intervallet (gruppMedBas); `utelamnadeGrupper` och
 * `ejJamforbaraGrupper` samma grupper som { yrke, aid, bas }.
 * @param {any[]} rader
 * @param {{k:number, golv?:number}} opts
 * @returns {{grupper: any[], utelamnade: string[], ejJamforbara: string[], utelamnadeGrupper: any[], ejJamforbaraGrupper: any[]}}
 */
function likaArbeteGrupper(rader, { k, golv = 10 }) {
    const perGrupp = new Map();
    const nyckelAv = r => `${aidAvRad(r)}\u0000${r.bas == null ? '' : String(r.bas)}`;
    const namn = namnrader((rader || []).filter(r => arKvinna(r) || _arMan(r)), nyckelAv);
    for (const r of rader || []) {
        const aid = aidAvRad(r), bas = r.bas == null ? '' : String(r.bas), nyckel = nyckelAv(r);
        if (!perGrupp.has(nyckel)) { const nr = namn.get(nyckel) ?? r; perGrupp.set(nyckel, { yrke: nr.yrke, etikett: String(nr.yrkeLabel || nr.yrke || aid), aid, bas, kv: [], ma: [] }); }
        if (arKvinna(r)) perGrupp.get(nyckel).kv.push(r.lon);
        else if (_arMan(r)) perGrupp.get(nyckel).ma.push(r.lon);
    }
    const grupper = [], utelamnadeGrupper = [], ejJamforbaraGrupper = [];
    for (const { yrke, etikett, aid, bas, kv, ma } of perGrupp.values()) {
        if (kv.length < 2 || ma.length < 2) { ejJamforbaraGrupper.push({ yrke, aid, bas }); continue; }
        const tot = kv.length + ma.length;
        const nagotLitet = kv.length < k || ma.length < k;
        if (nagotLitet && tot < k) { utelamnadeGrupper.push({ yrke, aid, bas }); continue; }
        if (nagotLitet) {
            grupper.push({ yrke, etikett, aid, bas, nKv: kv.length, nMa: ma.length, tot, samladMedian: true, flaggad: false, niva: 'ejbedomd', direktiv: false,
                gapPct: 0, medTot: median(kv.concat(ma)), lag: null, hog: null });
            continue;
        }
        const medKv = median(kv), medMa = median(ma);
        // Medelvärdet på samma löner som medianen; protokollet redovisar båda (ADR-79), statusen följer medianen.
        const medelKv = kv.reduce((s, x) => s + x, 0) / kv.length, medelMa = ma.reduce((s, x) => s + x, 0) / ma.length;
        const kvot = medKv / medMa;
        const gapPct = Math.abs(kvot * 100 - 100);
        const b = bedomSkillnad(kv, ma, { golv });
        const g = { yrke, etikett, aid, bas, nKv: kv.length, nMa: ma.length, tot, samladMedian: false,
            medKv, medMa, medelKv, medelMa, kvot, gapPct, niva: b.niva, sakerstalld: b.sakerstalld, direktiv: b.direktiv, flaggad: b.niva === 'granska',
            lag: b.granser ? b.granser.lag : null, hog: b.granser ? b.granser.hog : null,
            p10Kv: quantile(kv, 0.1), p90Kv: quantile(kv, 0.9), p10Ma: quantile(ma, 0.1), p90Ma: quantile(ma, 0.9) };
        // Stabiliteten gäller storleken: kan skillnaden hamna under 3 % om en eller två personer tas bort? Den räknas för
        // varje grupp på minst 3 % och visas för grupperna Värt att granska.
        if (gapPct >= STORLEKSGRANS) g.stabilitet = _stabilitet(kv, ma, { k, troskel: STORLEKSGRANS });
        grupper.push(g);
    }
    // Koderna efter den största skillnaden bland kodens grupper (störst först), inom koden intervallen i BAS-ordning.
    // Med en grupp per kod är ordningen densamma som förut: skillnaden, störst först.
    const rang = basRangFn(grupper.map(g => g.bas));
    const storst = new Map();
    for (const g of grupper) storst.set(g.aid, Math.max(storst.get(g.aid) ?? -Infinity, g.gapPct));
    const forsta = new Map();
    grupper.forEach((g, i) => { if (!forsta.has(g.aid)) forsta.set(g.aid, i); });
    grupper.sort((a, b) => (storst.get(b.aid) - storst.get(a.aid)) || (forsta.get(a.aid) - forsta.get(b.aid)) || (rang(a.bas) - rang(b.bas)));
    return { grupper, utelamnade: utelamnadeGrupper.map(gruppMedBas), ejJamforbara: ejJamforbaraGrupper.map(gruppMedBas), utelamnadeGrupper, ejJamforbaraGrupper };
}

/**
 * Könsgap inom ett yrke efter hänsyn till ålder (och BAS när yrket finns i flera BAS):
 * OLS på log(lön). Kräver båda könen ≥ k och n ≥ antal parametrar + 5.
 * @param {any[]} rader
 * @param {{k:number}} opts
 * Utan ålder i lönefilen (ADR-64) justeras inget: { utanAlder: true }.
 * @returns {{gapPct: number, n: number} | {forFa: true} | {ejSkattbar: true} | {utanAlder: true}}
 */
function justeratGapInomYrke(rader, { k }) {
    if ((rader || []).length && !(rader || []).some(r => r && r.alder > 0)) return { utanAlder: true };
    const d = (rader || []).filter(r => r.lon > 0 && r.alder > 0 && (arKvinna(r) || _arMan(r)));
    const nKv = d.filter(arKvinna).length, nMa = d.length - nKv;
    if (nKv < k || nMa < k) return { forFa: true };
    const basLista = [...new Set(d.map(r => r.bas))].sort();
    const dummies = basLista.slice(1);
    const p = 3 + dummies.length;
    if (d.length < p + 5) return { forFa: true };
    const X = d.map(r => [1, arKvinna(r) ? 1 : 0, r.alder, ...dummies.map(b => (r.bas === b ? 1 : 0))]);
    const y = d.map(r => Math.log(r.lon));
    const fit = fitOLS(X, y);
    // Singulär modell: kön och BAS sammanfaller inom yrket (t.ex. alla kvinnor i ett BAS).
    if (!fit || !isFinite(fit.beta[1])) return { ejSkattbar: true };
    return { gapPct: (Math.exp(fit.beta[1]) - 1) * 100, n: d.length };
}

// ---- Block: faktastycke, tabell, redan prövat, frågor ----

const FRAGOR_YRKE = Object.freeze([
    'Har kvinnor och män i gruppen olika uppdrag, ansvar eller arbetsinnehåll?',
    'Finns individuella lönetillägg eller särskilda uppdrag (marknad, bristyrke, specialistroll)?',
    'Hur har lönen satts vid nyanställning under de senaste åren, och skiljer det sig mellan könen?',
    'Finns skillnader i erfarenhet, kompetens eller utbildning som påverkar lönesättningen?',
    'Hur har lönekriterierna tillämpats vid den senaste lönerevisionen?',
    'Finns tidsbegränsade eller personliga lösningar (t.ex. garantilön, lönetrappa) i gruppen?',
]);
const FRAGOR_PAR = Object.freeze([
    `Ställer ${T.enhet.bfl} likvärdiga krav på kunskap och färdigheter, ansvar, ansträngning och arbetsförhållanden?`,
    'Stämmer BAS-placeringen med befattningsbeskrivningarna?',
    `Finns marknadsfaktorer eller rekryteringsläge som påverkar ${T.jamforelse.bf}?`,
    'Finns skillnader i arbetstid, arbetsmiljö eller ansvar som inte syns i BAS?',
]);

/** Svenskt talformat (decimalkomma, hårt mellanslag som tusentalsavgränsare). */
function formatTal(v, dec = 0) {
    if (v == null || !isFinite(v)) return '–';
    const t = new Intl.NumberFormat('sv-SE', { minimumFractionDigits: dec, maximumFractionDigits: dec }).format(v);
    // Ett negativt tal som avrundas till noll ska inte bli "−0" (samma avrundning som övriga tabeller).
    return /^[-−]0(,0+)?$/.test(t) ? t.slice(1) : t;
}
const _st = (n, en, flera) => `${formatTal(n)} ${n === 1 ? en : flera}`;
const _kr = v => (v == null || !isFinite(v)) ? '–' : `${formatTal(v, 0)} kr`;
const _pct = (v, dec = 1) => (v == null || !isFinite(v)) ? '–' : `${formatTal(v, dec)} %`;
const _ki = (lo, hi) => (lo < 0 || hi < 0) ? `${formatTal(lo, 1)} till ${formatTal(hi, 1)}` : `${formatTal(lo, 1)}–${formatTal(hi, 1)}`;
// Beräkningen tar bara fram de topN största paren. Nåddes gränsen (räknat före k-filtret)
// kan fler finnas, och antalet i texten är då ett tak, inte hela antalet.
const _kapad = u => !!u.topN && (u.par || []).length + (u.exkluderade || 0) >= u.topN;
const _kapadText = u => `Fler kan finnas: beräkningen tar fram de ${u.topN} största paren, och maxantalet ändras i Likvärdigt arbete.`;
const _inled = ({ demo, urval, troskelNot }) => ({
    fore: demo ? ['DEMODATA — inte verkliga löner.'] : [],
    efter: [...(urval ? [`Urval: ${urval}.`] : []), ...(troskelNot ? [troskelNot] : [])],
});

// ---- Stabilitet för flaggor (ADR-24) ----
// Median av en sorterad lista utan positionerna i `bort` (stigande, unika).
function _medianUtanPos(s, bort) {
    const n = s.length - bort.length;
    const vid = p => { let q = p; for (const b of bort) { if (b <= q) q++; else break; } return s[q]; };
    return n % 2 ? vid((n - 1) / 2) : (vid(n / 2 - 1) + vid(n / 2)) / 2;
}
// Ytterlägen och positioner inom 2 från medianen — övriga borttagningar ger samma median
// som något av ytterlägena.
function _kandidater(n) {
    const set = new Set([0, n - 1]);
    for (let i = Math.floor((n - 1) / 2) - 2; i <= Math.ceil((n - 1) / 2) + 2; i++) if (i >= 0 && i < n) set.add(i);
    return [...set].sort((a, b) => a - b);
}
function _stabilitet(kv, ma, { k, troskel }) {
    const sKv = [...kv].sort((a, b) => a - b), sMa = [...ma].sort((a, b) => a - b);
    const cKv = _kandidater(sKv.length), cMa = _kandidater(sMa.length);
    const gap = (bKv, bMa) => Math.abs(_medianUtanPos(sKv, bKv) / _medianUtanPos(sMa, bMa) * 100 - 100);
    const par = c => c.flatMap((a, i) => c.slice(i + 1).map(b => [a, b]));
    const kanKv = m => sKv.length - m >= k, kanMa = m => sMa.length - m >= k;
    let min1 = Infinity, min2 = Infinity;
    if (kanKv(1)) for (const i of cKv) min1 = Math.min(min1, gap([i], []));
    if (kanMa(1)) for (const j of cMa) min1 = Math.min(min1, gap([], [j]));
    if (kanKv(2)) for (const p of par(cKv)) min2 = Math.min(min2, gap(p, []));
    if (kanMa(2)) for (const p of par(cMa)) min2 = Math.min(min2, gap([], p));
    if (kanKv(1) && kanMa(1)) for (const i of cKv) for (const j of cMa) min2 = Math.min(min2, gap([i], [j]));
    const begransad = !kanKv(1) && !kanMa(1) ? 'bada' : !kanKv(1) ? 'kvinnor' : !kanMa(1) ? 'man' : null;
    if (begransad === 'bada') return { niva: 'stabil', lagstaGapPct: null, begransad, provadeMax: 0 };
    const niva = min1 < troskel ? 'skor1' : min2 < troskel ? 'skor2' : 'stabil';   // skör: kan hamna under statusens storleksgräns
    const lagstaGapPct = niva === 'skor1' ? min1 : (Number.isFinite(min2) ? min2 : min1);
    // provadeMax: flest borttagna som faktiskt kunde prövas (k-gränsen kan stoppa två).
    return { niva, lagstaGapPct, begransad, provadeMax: Number.isFinite(min2) ? 2 : 1 };
}
const _tillagg = st => st.begransad === 'kvinnor' ? ' (prövat bara på män)' : st.begransad === 'man' ? ' (prövat bara på kvinnor)' : '';

/** Kort märkning för tabellen i Lika arbete. */
function stabilitetKort(st, k) {
    if (!st) return '';
    if (st.begransad === 'bada') return `Kan inte prövas: båda könen har exakt ${k} ${personOrd(k)}`;
    const t = _tillagg(st);
    if (st.niva === 'skor1') return `Skör: kan bli ${formatTal(st.lagstaGapPct, 1)} % om 1 person tas bort${t}`;
    if (st.niva === 'skor2') return `Skör: kan bli ${formatTal(st.lagstaGapPct, 1)} % om 2 personer tas bort${t}`;
    if (st.provadeMax === 1) return `Stabil: minst 3 % även utan 1 person, fler kunde inte prövas${t}`;
    return `Stabil: minst 3 % även utan 2 personer${t}`;
}
function _kanslighet(st, k) {
    if (st.begransad === 'bada') return `Känslighet: kunde inte prövas eftersom båda könen har exakt ${k} ${personOrd(k)}.`;
    const t = _tillagg(st);
    if (st.niva === 'skor1') return `Känslighet: skillnaden kan sjunka till ${_pct(st.lagstaGapPct)} om en person tas bort${t}.`;
    if (st.niva === 'skor2') return `Känslighet: skillnaden kan sjunka till ${_pct(st.lagstaGapPct)} om två personer tas bort${t}.`;
    if (st.provadeMax === 1) return `Känslighet: skillnaden ligger kvar på minst 3 % även om en person tas bort; fler kunde inte prövas${t}.`;
    return `Känslighet: skillnaden ligger kvar på minst 3 % även om två personer tas bort${t}.`;
}

/**
 * Block för en flaggad yrkesgrupp i Lika arbete.
 * @param {any} g
 * @param {{id?:string, justerat?:any, ki?:any, urval?:any, demo?:boolean, k?:number, troskelNot?:string|null, arsbelopp?:string|null}} [opts]
 */
function gruppBlock(g, { id, justerat, ki, urval, demo, k = 10, troskelNot, arsbelopp } = {}) {
    const { fore, efter } = _inled({ demo, urval, troskelNot });
    // Gruppen är AID-koden i BAS-intervallet (ADR-89): justeringen inom gruppen gäller då bara ålder. En grupp utan
    // intervall (koden över flera intervall) justeras för ålder och BAS.
    const vad = g.bas != null && g.bas !== '' ? 'ålder' : 'ålder och BAS', Vad = stor(vad);
    let fakta = `Inom ${gruppMedBas(g)} (n = ${g.tot}, varav ${g.nKv} kvinnor och ${g.nMa} män) är kvinnornas medianlön `
        + `${_pct(g.kvot * 100)} av männens` + (ki ? ` (95 % KI ${_ki(ki.lo, ki.hi)})` : '') + '.'
        + (g.niva === 'granska' ? ' Skillnaden är statistiskt säkerställd och minst 3 % (verktygets storleksgräns).' : '')
        + (g.direktiv ? ' Den ojusterade löneskillnaden når 5 % (direktivmarkeringen; den är inte en bedömning).' : '');
    let provat;
    if (justerat && justerat.utanAlder) {
        provat = [`Lönefilen saknar ålder, så skillnaden har inte justerats för ${vad}.`];
    } else if (justerat && justerat.ejSkattbar) {
        provat = [`${Vad} kunde inte prövas eftersom kön och BAS sammanfaller i ${T.enhet.bf} (kvinnor och män finns i olika BAS).`];
    } else if (justerat && !justerat.forFa) {
        fakta += ` Efter hänsyn till ${vad} inom ${T.enhet.bf} återstår en skillnad på ${_pct(justerat.gapPct)}.`;
        const ra = (g.kvot - 1) * 100, ju = justerat.gapPct;
        const siffror = `(${_pct(ra)} före justering, ${_pct(ju)} efter)`;
        if (ra !== 0 && ju !== 0 && Math.sign(ra) !== Math.sign(ju)) {
            provat = [`Efter hänsyn till ${vad} inom ${T.enhet.bf} byter skillnaden tecken ${siffror}. Råskillnaden och den justerade skillnaden mäter olika saker (median respektive genomsnitt i en modell) och bör läsas var för sig.`];
        } else if (Math.abs(ju) < Math.abs(ra)) {
            provat = [`${Vad} inom ${T.enhet.bf} förklarar ${formatTal(Math.abs(ra) - Math.abs(ju), 1)} procentenheter av skillnaden ${siffror}.`];
        } else {
            provat = [`${Vad} inom ${T.enhet.bf} förklarar inte skillnaden ${siffror}.`];
        }
    } else {
        provat = [`För få personer för att justera för ${vad}.`];
    }
    if (g.stabilitet) provat = [...provat, _kanslighet(g.stabilitet, k)];
    return {
        id, rubrik: gruppMedBas(g),
        // arsbelopp: räkneexemplet i kronor per år, byggt av anroparen.
        stycken: [...fore, fakta, ...(arsbelopp ? [arsbelopp] : []), ...efter],
        tabell: { rubriker: ['', 'Antal', 'P10', 'Median', 'P90'], rader: [
            ['Kvinnor', String(g.nKv), _kr(g.p10Kv), _kr(g.medKv), _kr(g.p90Kv)],
            ['Män', String(g.nMa), _kr(g.p10Ma), _kr(g.medMa), _kr(g.p90Ma)]] },
        provat, fragor: [...FRAGOR_YRKE],
    };
}

/**
 * Block för ett kandidatpar i Likvärdigt arbete.
 * @param {any} p
 * @param {{id?:string, kravProxy?:any, urval?:any, demo?:boolean, troskelNot?:string|null}} [opts]
 */
function parBlock(p, { id, kravProxy, urval, demo, troskelNot } = {}) {
    const { fore, efter } = _inled({ demo, urval, troskelNot });
    const kiPct = p.gapCI && p.kvMedian > 0 ? { lo: p.gapCI.lo / p.kvMedian * 100, hi: p.gapCI.hi / p.kvMedian * 100 } : null;
    const fakta = `${p.kvLabel} (BAS ${p.kvBas}, ${formatTal(p.kvKvinnoPct, 0)} % kvinnor, median ${_kr(p.kvMedian)}) har `
        + `${_kr(p.gapKr)} lägre medianlön än ${p.maLabel} (BAS ${p.maBas}, median ${_kr(p.maMedian)}). `
        + `${stor(genitiv(T.jamforelse.bf))} median ligger ${_pct(p.gapPct)} högre` + (kiPct ? ` (95 % KI ${_ki(kiPct.lo, kiPct.hi)} %)` : '') + '.'
        // Den råa skillnaden är det lagen prövar; den åldersjusterade (bara interna par) visar vad som kan bero på åldersstruktur.
        + (p.aldersJusterad && isFinite(p.aldersJusterad.gapPct) ? ` Justerat för ålder: ${_pct(p.aldersJusterad.gapPct)}.` : '');
    const proxy = kravProxy === 'poäng'
        ? 'Jämförelsen bygger på arbetsvärderingspoäng som mått på krav.'
        : `Jämförelsen bygger på ${T.niva.fl} som mått på krav.`;
    const kalla = p.jamforKalla === 'extern' ? ` ${stor(T.jamforelse.bf)} kommer från jämförelsestatistiken.` : '';
    return {
        id, rubrik: `${p.kvLabel} — ${p.maLabel}`,
        stycken: [...fore, fakta, proxy + kalla, ...efter],
        tabell: { rubriker: [stor(T.namn.en), 'BAS', 'Andel kvinnor', 'Antal', 'Median'], rader: [
            [p.kvLabel, p.kvBas, _pct(p.kvKvinnoPct, 0), String(p.kvN), _kr(p.kvMedian)],
            [p.maLabel, p.maBas, _pct(p.maKvAndel, 0), p.maN == null ? '–' : String(p.maN), _kr(p.maMedian)]] },
        provat: null, fragor: [...FRAGOR_PAR],
    };
}

/** Antalet i ett kandidatpar: det kvinnodominerade yrkets och jämförelseyrkets ("–" när statistiken inte anger antal). */
const _parAntal = p => `${p.kvN == null ? '–' : p.kvN} / ${p.maN == null ? '–' : p.maN}`;
/** Könsandelen i ett pars jämförelseyrke med klassen (ADR-60): "45 % (blandad)". */
function _konsandel(p) {
    const v = p.maKvinnoPct ?? p.maKvAndel;
    if (typeof v !== 'number' || !isFinite(v)) return '–';
    return _pct(v, 0) + (p.maKlass === 'mansdominerad' || p.maKlass === 'blandad' ? ` (${p.maKlass})` : '');
}

/** Avsnittsblock per lagsteg: 'sammanfattning' | 'uppdelning' | 'lika' | 'likvardigt' | 'lagreKrav' | 'struktur' | 'handlingsplan'. */
/**
 * @param {string} typ
 * @param {any} u
 * @param {{k:number, urval?:any, demo?:boolean, troskelNot?:string|null}} opts
 */
function avsnittBlock(typ, u, { k, urval, demo, troskelNot }) {
    const { fore, efter } = _inled({ demo, urval, troskelNot });
    const blk = (rubrik, stycken, tabell) => ({ id: typ, rubrik, stycken: [...fore, ...stycken, ...efter], tabell, provat: null, fragor: null });
    if (typ === 'sammanfattning') {
        // k-anonymitet: med ett kön under k i urvalet redovisas inga könsuppdelade lönemått.
        const litet = u.nKv < k || u.nMa < k;
        const kvot = !litet && u.medMa > 0 ? u.medKv / u.medMa * 100 : null;
        const st = [`Underlaget omfattar ${formatTal(u.n)} anställda, varav ${formatTal(u.nKv)} kvinnor och ${formatTal(u.nMa)} män.`
            + (litet ? ` Könsuppdelade lönemått redovisas inte eftersom ett kön har färre än ${k} ${personOrd(k)} i urvalet.`
                     : ` Kvinnornas medianlön är ${_kr(u.medKv)} och männens ${_kr(u.medMa)}, vilket motsvarar ${_pct(kvot)} av männens.`)];
        if (u.oforklarat && !litet) {
            // Frasen följer förklaringsmodellen (ADR-56); tom fras = endast kön. Det bortvalda får en mening var.
            const fras = typeof u.oforklarat.fras === 'string' ? u.oforklarat.fras : `ålder och ${T.niva.en}`;
            st.push(fras
                ? `Efter hänsyn till ${fras} är den oförklarade löneskillnaden ${_pct(u.oforklarat.pct)} (95 % KI ${_ki(u.oforklarat.lo, u.oforklarat.hi)} %).`
                : `Utan att något räknats bort är löneskillnaden ${_pct(u.oforklarat.pct)} (95 % KI ${_ki(u.oforklarat.lo, u.oforklarat.hi)} %).`);
            for (const b of (u.oforklarat.bortvalt || [])) st.push(bortvaltNotering(b));
        }
        if (u.kvalitet) {
            const etikett = { ok: 'OK', varning: 'Varning', kritisk: 'Kritisk' }[u.kvalitet.status];
            st.push(`Underlagets kvalitet: ${etikett}` + (u.kvalitet.brister.length ? ` (${u.kvalitet.brister.join(', ')}).` : '.'));
        }
        const rader = [['Antal anställda', formatTal(u.n)], ['Kvinnor', formatTal(u.nKv)], ['Män', formatTal(u.nMa)]];
        if (!litet) {
            rader.push(['Medianlön kvinnor', _kr(u.medKv)], ['Medianlön män', _kr(u.medMa)], ['Kvinnors lön i % av mäns', _pct(kvot)]);
            if (u.oforklarat) { const fras = typeof u.oforklarat.fras === 'string' ? u.oforklarat.fras : `ålder och ${T.niva.en}`; rader.push([fras ? `Oförklarad löneskillnad (${fras})` : 'Löneskillnad (inget räknat bort)', _pct(u.oforklarat.pct)]); }
        }
        return blk('Sammanfattning', st, { rubriker: ['Nyckeltal', 'Värde'], rader });
    }
    if (typ === 'uppdelning') {
        const R = 'Var uppstår löneskillnaden?';
        if (!u) return blk(R, [`För få personer för att dela upp skillnaden: ett kön har färre än ${k} ${personOrd(k)} i urvalet.`], null);
        const inledning = `Kvinnornas medellön är ${_kr(u.medel.kv)} och männens ${_kr(u.medel.ma)}, en skillnad på ${_kr(u.gap)} (${_pct(u.gapPct)} av männens).`;
        // Delarna och deras namn följer de valda variablerna (ADR-65); standardvalet BAS, AID ger texten från före.
        const variabler = u.variabler || gapStandardVariabler();
        const delar = gapDelar(variabler);
        const orsaker = delar.map(d => `${_kr(u.delar[d.id])} ${d.orsak}`);
        const st = [`${inledning} Beloppen är kvinnor mot män: negativa belopp betyder att kvinnornas medellön är lägre.`,
            `Av skillnaden beror ${orsaker.slice(0, -1).join(', ')} och ${orsaker[orsaker.length - 1]}.`];
        if (!gapVariablerArStandard(variabler)) {
            st.push(variabler.length === 1
                ? `Uppdelningen förklarar med variabeln ${gapVariablerIText(variabler)}; resten är skillnaden inom samma grupp.`
                : `Uppdelningen förklarar med variablerna ${gapVariablerIText(variabler)}, i den ordningen. Ordningen påverkar delarna: den första variabeln får det den förklarar ensam, nästa det den förklarar utöver den första, och så vidare.`);
        }
        if (u.litetGap) st.push('Skillnaden är mindre än 1 % av männens medellön. Delarna kan då peka åt olika håll och vara större än själva skillnaden.');
        // Grupper där ett kön är under tröskeln räknas samman innan delarna räknas och namnges inte (ADR-87).
        const ovriga = d => (u.ovrigaAntal && u.ovrigaAntal[d]) || 0;
        if (delar.some(d => ovriga(d.id))) st.push(`Grupper där ett kön har färre än ${k} ${personOrd(k)} räknas samman med andra grupper innan delarna räknas, och de namnges inte. `
            + `Annars skulle medellönen för färre än ${k} kvinnor eller män gå att räkna fram ur beloppen.`);
        const andel = v => u.litetGap ? '—' : _pct(v / u.gap * 100, 0);
        // Samma poster som kortet: gapuppdelning.js namnger bara grupper som inte räknats samman (ADR-87).
        const storst = d => [...u.topp[d].map(p => `${p.namn} (${_kr(p.kr)})`), ...(ovriga(d) ? [`${_st(ovriga(d), 'grupp', 'grupper')} namnges inte`] : [])].join('; ') || '—';
        return blk(R, st, { rubriker: ['Del', 'Bidrag (kr)', 'Andel av skillnaden', 'Störst bidrag'], rader: [
            ...delar.map(d => [d.namn, _kr(u.delar[d.id]), andel(u.delar[d.id]), storst(d.id)]),
            ['Totalt', _kr(u.gap), u.litetGap ? '—' : '100 %', ''],
        ] });
    }
    if (typ === 'lika') {
        const g = u.grupper || [];
        const flagg = g.filter(x => x.flaggad), samlade = g.filter(x => x.samladMedian);
        const jamforda = g.length + (u.utelamnade || []).length;
        const st = [`${_st(jamforda, T.enhet.en, T.enhet.fl)} jämfördes, var och en i sitt ${T.niva.en}. ${flagg.length} är värda att granska: skillnaden mellan kvinnors och mäns medianlön är statistiskt säkerställd och minst 3 % (verktygets storleksgräns). `
            + `${samlade.length} redovisas med samlad median eftersom ett kön har färre än ${k} ${personOrd(k)}, och ${(u.utelamnade || []).length} utelämnas helt.`];
        if (!flagg.length) return blk('Lika arbete', [...st, `${stor(adjektiv({ utrum: 'ingen', neutrum: 'inget', plural: 'inga' }, T.enhet))} ${T.enhet.en} är ${adjektiv({ utrum: 'värd', neutrum: 'värt', plural: 'värda' }, T.enhet)} att granska.`], null);
        return blk('Lika arbete', [...st, `Kolumnen ${DIREKTIV_KOLUMN} visar var den ojusterade skillnaden når 5 %. ${DIREKTIV_TIPS}`],
            { rubriker: [stor(T.enhet.en), stor(T.niva.en), 'Kvinnor', 'Män', 'Median kvinnor', 'Median män', 'Kvinnors lön i % av mäns', DIREKTIV_KOLUMN],
            rader: flagg.map(x => [x.yrke, x.bas == null ? '' : String(x.bas), String(x.nKv), String(x.nMa), _kr(x.medKv), _kr(x.medMa), _pct(x.kvot * 100), x.direktiv ? DIREKTIV_ETIKETT : '']) });
    }
    if (typ === 'likvardigt') {
        const par = u.par || [];
        const proxy = u.kravProxy === 'poäng' ? 'arbetsvärderingspoäng' : T.niva.fl;
        const st = [(_kapad(u) ? `De ${u.topN} största kandidatparen` : `${par.length} kandidatpar`)
            + ` där ${artikel(T.enhet)} ${termFras(T.enhet, 'en', { adjektiv: 'kvinnodominerad' })} har lägre medianlön än ${artikel(T.enhet)} ${T.enhet.en} med lika eller lägre krav. Kraven mäts med ${proxy}.`
            + (u.kvinnoTroskel != null ? ` ${stor(artikel(T.enhet))} ${T.enhet.en} räknas som ${adjektiv('kvinnodominerad', T.enhet)} vid ${kvDefinitionText(u.kvDomDefinition, formatTal(u.kvinnoTroskel))}.` : '')
            // ADR-60: jämförelsemängden är alla yrken som inte är kvinnodominerade, eller bara de mansdominerade.
            + (u.jamforelse === 'mansdominerade'
                ? ` ${stor(T.enhet.bfl)} jämförs bara med mansdominerade ${T.enhet.fl} på samma nivå; könsandelen i ${T.jamforelse.bf} står i tabellen.`
                : ` ${stor(T.enhet.bfl)} jämförs med ${T.enhet.fl} på samma nivå som inte är kvinnodominerade; könsandelen i ${T.jamforelse.bf} står i tabellen.`)];
        if (_kapad(u)) st.push(_kapadText(u));
        if (u.exkluderade) st.push(`${u.exkluderade} par med en grupp under ${k} ${personOrd(k)} redovisas inte här.`);
        if (!par.length) return blk('Likvärdigt arbete', [...st, 'Inga kandidatpar att redovisa.'], null);
        const kiText = p => (p.gapCI && p.kvMedian > 0) ? `${_ki(p.gapCI.lo / p.kvMedian * 100, p.gapCI.hi / p.kvMedian * 100)} %` : '–';
        return blk('Likvärdigt arbete', st, { rubriker: [stor(termFras(T.enhet, 'en', { adjektiv: 'kvinnodominerad' })), stor(T.jamforelse.en), 'Antal (kvinnodom. / jämf.)', `Könsandel i ${T.jamforelse.bf}`, 'Skillnad (kr)', 'Skillnad (%)', '95 % KI'],
            rader: par.map(p => [`${p.kvLabel} (BAS ${p.kvBas})`, `${p.maLabel} (BAS ${p.maBas})`, _parAntal(p), _konsandel(p), _kr(p.gapKr), _pct(p.gapPct), kiText(p)]) });
    }
    if (typ === 'lagreKrav') {
        const R = 'Lägre krav, högre lön';
        if (u.kravProxy === 'poäng') return blk(R, [`Med arbetsvärderingspoäng jämförs ${T.enhet.fl} över BAS-gränserna redan i Likvärdigt arbete.`], null);
        const par = u.par || [];
        const st = [(_kapad(u) ? `De ${u.topN} största paren` : `${par.length} par`)
            + ` där ${artikel(T.enhet)} ${termFras(T.enhet, 'en', { adjektiv: 'kvinnodominerad' })} har lägre medianlön än ${artikel(T.enhet)} av organisationens ${T.enhet.fl} i lägre BAS. Kraven mäts med ${T.niva.fl}, ett grovt mått som bör prövas mot befattningsbeskrivningarna.`];
        if (_kapad(u)) st.push(_kapadText(u));
        if (u.exkluderade) st.push(`${u.exkluderade} par med en grupp under ${k} ${personOrd(k)} redovisas inte här.`);
        if (!par.length) return blk(R, [...st, `${stor(adjektiv({ utrum: 'ingen', neutrum: 'inget', plural: 'inga' }, T.enhet))} ${termFras(T.enhet, 'en', { adjektiv: 'kvinnodominerad' })} har lägre medianlön än ${artikel(T.enhet)} ${T.enhet.en} i lägre BAS.`], null);
        const kiText = p => (p.gapCI && p.kvMedian > 0) ? `${_ki(p.gapCI.lo / p.kvMedian * 100, p.gapCI.hi / p.kvMedian * 100)} %` : '–';
        const b = blk(R, st, { rubriker: [stor(termFras(T.enhet, 'en', { adjektiv: 'kvinnodominerad' })), stor(T.jamforelse.en), 'Antal (kvinnodom. / jämf.)', `Könsandel i ${T.jamforelse.bf}`, 'BAS-steg', 'Skillnad (kr)', 'Skillnad (%)', '95 % KI'],
            rader: par.map(p => [`${p.kvLabel} (BAS ${p.kvBas})`, `${p.maLabel} (BAS ${p.maBas})`, _parAntal(p), _konsandel(p), String(p.basSteg), _kr(p.gapKr), _pct(p.gapPct), kiText(p)]) });
        return { ...b, fragor: [...FRAGOR_PAR] };
    }
    if (typ === 'struktur') {
        const kv = u.kvartiler || [];
        const st = [`Könsfördelning och medianlön per ${T.niva.en}.`, lonebegreppReservation()];
        const kvartilOk = !(u.nKv < k || u.nMa < k);   // k: kvartilandelar röjer annars ett litet kön
        if (kv.length && kvartilOk) st.push('Andel kvinnor per lönekvartil: ' + kv.map(q => `kvartil ${q.q} ${_pct(q.andelKv, 0)}`).join(', ') + '.');
        const rep = u.representation || [];
        const utelamnade = rep.filter(r => r.n < k).length;
        if (utelamnade) st.push(`${_st(utelamnade, T.niva.en, T.niva.fl)} med färre än ${k} ${personOrd(k)} redovisas inte.`);
        return blk('Struktur och lönetransparens', st, { rubriker: ['BAS', 'Antal', 'Andel kvinnor', 'Median', 'Kvinnors lön jämfört med mäns'],
            rader: rep.filter(r => r.n >= k).map(r => [r.bas, String(r.n), _pct(r.andelKv),
                _kr(r.median),
                (r.nKv >= k && r.nMa >= k && r.gapPct != null) ? _pct(r.gapPct) : '–']) });
    }
    if (typ === 'sektorer') {
        // Sektorsöversikten (ADR-33): samma k-regler som vyn.
        const alla = u.sektorer || [];
        const visas = alla.filter(r => !r.maskerad);
        // Justerat för ålder bara när lönefilen har ålder (ADR-64, ADR-78).
        const justText = sektorJusteradText(alla);
        const st = [`Kvinnors lön i procent av mäns per ${T.huvudomrade.en}, rå och justerad för ${justText.justeradFor}.`];
        const a = u.andel;
        const andelNot = sektorAndelNot(a, k);   // sammanräknade huvudområden (ADR-87)
        if (a && a.andel != null) st.push(Math.abs(a.andel) < 0.01
            ? `Skillnaden i medellön för hela organisationen, kvinnor mot män (${_kr(a.gapKr)} per månad), beror nästan inte alls på att kvinnor och män arbetar i olika ${T.huvudomrade.fl} (under 1 %).`
            : `Av skillnaden i medellön för hela organisationen, kvinnor mot män (${_kr(a.gapKr)} per månad), beror ${_kr(a.sektorKr)} (${_pct(a.andel * 100)}) på att kvinnor och män arbetar i olika ${T.huvudomrade.fl}.`);
        if (andelNot) st.push(andelNot);
        const dolda = alla.length - visas.length;
        if (dolda) st.push(`${_st(dolda, T.huvudomrade.en, T.huvudomrade.fl)} med färre än ${k} ${personOrd(k)} redovisas inte.`);
        const ejBas = visas.filter(r => r.justeratSkal === 'ejBas').length;
        // Samma två orsaker som ADR-78 och verktygstipset i vyn (_sektorEjBasTitel).
        if (ejBas) st.push(`I ${_st(ejBas, T.huvudomrade.en, T.huvudomrade.fl)} går modellen med ${T.niva.en} inte att skatta: kön och ${T.niva.en} går inte att skilja åt, `
            + `eller raderna är för få för så många ${T.niva.fl}. Där kan skillnaden inte justeras för ${T.niva.en}.`);
        const skr = visas.find(r => r.skrAndelKv != null);
        if (skr) st.push(`Andel kvinnor i samma ${T.huvudomrade.en} i ${skrDelText(skr.skrDel)} enligt SKR:s personalstatistik står som referens.`);
        return blk(`Per ${T.huvudomrade.en}`, st, { rubriker: [stor(T.huvudomrade.en), 'Antal', 'Andel kvinnor', 'Andel kvinnor, SKR', 'Kvinnors lön i % av mäns', justText.rubrik],
            rader: visas.map(r => [r.namn, String(r.n), _pct(r.andelKv), r.skrAndelKv != null ? _pct(r.skrAndelKv) : '–',
                !r.samladMedian && r.kvot != null ? _pct(r.kvot) : '–',
                !r.samladMedian && r.justerat ? _pct(100 + r.justerat.pct) : r.justeratSkal === 'ejBas' ? 'Kan inte justeras för BAS' : '–']) });
    }
    if (typ === 'handlingsplan') {
        const rader = u.rader || [];
        // Summan lägger ihop två slag av kostnad; den delas med samma ord som kolumnen Kostnaden avser. Prioriteringens del
        // är kostnad att nå referensen: löneläget mot referensen, inte könsskillnaderna (ADR-62).
        const delar = [
            u.summaReferens ? `${_kr(u.summaReferens)} kostnad att nå referensens median för grupperna under referensen (löneläget mot er referens, inte lönekartläggningens könsskillnader)` : '',
            u.summaJamforelse ? `${_kr(u.summaJamforelse)} kostnad att nå ${genitiv(T.jamforelse.bf)} median för kandidatparen i likvärdigt arbete` : '',
        ].filter(Boolean);
        const st = [`${_st(rader.length, 'förifylld åtgärd', 'förifyllda åtgärder')}` + (u.summa ? ` med en uppskattad kostnad på ${_kr(u.summa)} per år.` : '.')
            + (u.summa && delar.length ? ` Av den är ${delar.join(' och ')}.` : '')];
        if (!rader.length) return blk('Handlingsplan', st, null);
        // Antal berörda: gruppens antal (för ett kandidatpar det kvinnodominerade yrkets); tomt för en egen rad.
        // Kostnaden avser: vilken kostnad raden har (_hpKostnadAvser i appen); tomt för en egen rad.
        const b = blk('Handlingsplan', st, { rubriker: ['Åtgärd', 'Grupp', 'Antal berörda', 'Underlag', 'Uppskattad kostnad per år', 'Kostnaden avser'],
            rader: rader.map(r => [r.atgard, r.grupp, r.antal == null ? '' : formatTal(r.antal), r.underlag, _kr(r.kostnad), r.kostnadAvser || '']) });
        // Sakliga skäl (u.skal, ur handlingsplanen): en rad per skäl med gruppen på första raden, och summan per kategori.
        const sk = u.skal;
        if (sk && Array.isArray(sk.grupper) && sk.grupper.length && sk.perKategori) {
            const andel = v => (v == null ? '–' : _pct(v * 100, 0));
            const pk = sk.perKategori;
            b.stycken.push('Tabellerna visar de sakliga skäl som organisationen har angett per grupp. Beloppet är den del av gruppens medianskillnad, i kronor per månad, som skälet förklarar. Kategorierna och beloppen är organisationens bedömning. Verktyget räknar bara om beloppen till andelar av skillnaden.');
            // Skälen överstiger skillnaden: samma mening som rapportmodellen (58-rapportmodell.js).
            const over = sk.grupper.filter(g => g.overstiger);
            if (over.length) b.stycken.push(over.map(g => `${g.grupp}: skälen är tillsammans större än skillnaden (${_kr(g.summa)} mot ${_kr(g.skillnadKr)}).`).join(' ')
                + ' Ett belopp kan vara för högt, eller så räknar två skäl samma sak. Kontrollera beloppen.');
            const not = sk.notUtanBelopp || 'belopp och kommentar utelämnade: ett kön har färre personer än minsta gruppstorlek';
            b.tabeller = [
                { rubrik: 'Sakliga skäl per grupp', rubriker: ['Grupp', 'Antal berörda', 'Medianskillnad (kr/mån)', 'Kategori', 'Belopp (kr/mån)', 'Andel av skillnaden', 'Kommentar'],
                  // En grupp där ett kön är under minsta gruppstorlek: bara kategorin, med noten i kommentarens kolumn.
                  rader: sk.grupper.flatMap(g => g.skal.map((s, i) => [i ? '' : g.grupp, i || g.antal == null ? '' : formatTal(g.antal), i ? '' : _kr(g.skillnadKr),
                      s.namn, g.utanBelopp ? '' : _kr(s.belopp), g.utanBelopp ? '' : andel(s.andel), g.utanBelopp ? not : (s.kommentar || '')])) },
                { rubrik: 'Sammanställning per kategori', rubriker: ['Kategori', 'Belopp (kr/mån)', 'Andel av skillnaden i grupper med skäl', 'Antal grupper'],
                  rader: [...pk.kategorier.map(k => [k.namn, _kr(k.summa), andel(k.andel), formatTal(k.antalGrupper)]), ['Totalt', _kr(pk.summa), andel(pk.andel), formatTal(pk.antalGrupper)]],
                  not: skalSammanstallningNot(sk.k ?? k) },
            ];
        }
        return b;
    }
    throw new Error(`Okänd avsnittstyp: ${typ}`);
}

/**
 * Noten under Sammanställning per kategori: samma lydelse i Word och PDF (58-rapportmodell.js), Excel-bladet
 * Sakliga skäl (24-excelexport.js) och Rapporttext.
 * @param {number} k minsta gruppstorlek
 */
function skalSammanstallningNot(k) {
    return 'Totalt i kronor är summan av alla skäl i sammanställningen, också på egna rader, som saknar medianskillnad. '
        + 'Andelen räknas bara mot den samlade medianskillnaden i de grupper som har en sådan. '
        + `Grupper där ett kön har färre än ${k} ${personOrd(k)} ingår inte i sammanställningen; för dem står bara kategorierna i tabellen ovan.`;
}

const _esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Ren HTML för urklipp: inga typsnitt, färger eller klasser — mallen formaterar. */
function tillWordHtml(b) {
    let h = `<h3>${_esc(b.rubrik)}</h3>`;
    for (const s of b.stycken) h += `<p>${_esc(s)}</p>`;
    const tabell = t => '<table border="1" cellpadding="4"><thead><tr>' + t.rubriker.map(r => `<th>${_esc(r)}</th>`).join('') + '</tr></thead><tbody>'
        + t.rader.map(r => '<tr>' + r.map(c => `<td>${_esc(c)}</td>`).join('') + '</tr>').join('') + '</tbody></table>';
    if (b.tabell) h += tabell(b.tabell);
    // Fler tabeller med egen rubrik (blocket om förra året: Löneutveckling per BAS-intervall).
    for (const t of b.tabeller || []) h += `<p><strong>${_esc(t.rubrik)}</strong></p>` + tabell(t) + (t.not ? `<p>${_esc(t.not)}</p>` : '');
    if (b.provat) h += '<p><strong>Redan prövat</strong></p><ul>' + b.provat.map(p => `<li>${_esc(p)}</li>`).join('') + '</ul>';
    if (b.fragor) h += '<p><strong>Frågor till ansvarig chef</strong></p><ol>' + b.fragor.map(f => `<li>${_esc(f)}</li>`).join('') + '</ol>';
    return h;
}

/**
 * Ett block för en egen tabell ur Utforska (ADR-52): tabellen som receptet gav (receptTillTabeller), med talen
 * skrivna efter kolumnens typ, och tabellens not som stycke.
 * @param {{rubrik: string, kolumner: {rubrik: string, typ: string}[], rader: any[][], not?: string}} t
 * @param {{id: string, k?: number, urval?: string, demo?: boolean, troskelNot?: string}} val
 */
function egenTabellBlock(t, { id, urval, demo, troskelNot }) {
    const { fore, efter } = _inled({ demo, urval, troskelNot });
    const skriv = (v, typ) => {
        if (v == null || v === '') return '–';
        if (typeof v !== 'number') return String(v);
        if (!isFinite(v)) return '–';
        return typ === 'kr' ? _kr(v) : typ === 'pct1' ? _pct(v, 1) : typ === 'antal' ? formatTal(v, 0) : formatTal(v, 2);
    };
    return { id, rubrik: t.rubrik, stycken: [...fore, ...(t.not ? [t.not] : []), ...efter], provat: null, fragor: null,
        tabell: { rubriker: t.kolumner.map(c => c.rubrik), rader: t.rader.map(r => r.map((v, j) => skriv(v, (t.kolumner[j] || {}).typ))) } };
}

/**
 * Blocket Jämförelse med förra året (ADR-54): nyckeltalen sida vid sida ur jämförelsen (jamforArsbokslut) och
 * stycken om flaggade yrkesgrupper och Att göra. Talen skrivs efter radens typ.
 * @param {any} j jämförelsen
 * @param {{id?: string, forraAr: number, nuAr: number, urval?: string, demo?: boolean, troskelNot?: string}} val
 */
function arsjamforelseBlock(j, { id = 'arsjamforelse', forraAr, nuAr, urval, demo, troskelNot }) {
    const { fore, efter } = _inled({ demo, urval, troskelNot });
    const skriv = (v, typ) => (v == null ? '–' : typ === 'kr' ? _kr(v) : typ === 'pct' ? _pct(v, 1) : formatTal(v, 0));
    const diff = (v, typ) => (v == null ? '–' : `${v > 0 ? '+' : v < 0 ? '−' : '±'}${skriv(Math.abs(v), typ)}${typ === 'pct' ? '-enheter' : ''}`);
    const g = j.grupper, p = j.punkter;
    const namn = l => l.map(gruppMedBas).join(', ');
    const st = [`Jämfört med lönekartläggningen ${forraAr}. Lönemått bara för ${T.enhet.fl} där båda könen når minsta gruppstorlek; skillnaden är kvinnors medianlön mot mäns.`,
        g.ejJamforbara
            ? `Flaggade grupper i Lika arbete: förra årets bokslut har en rad per ${T.enhet.en} över alla ${T.niva.fl}, och i år är en grupp ${T.enhet.en} i ${T.niva.en}, så grupperna jämförs inte rad för rad.`
            : `Flaggade ${T.enhet.fl} i Lika arbete: ${g.kvar.length} båda åren${g.kvar.length ? ` (${namn(g.kvar)})` : ''}, ${g.nya.length} nya${g.nya.length ? ` (${namn(g.nya)})` : ''} och ${g.borta.length} inte längre flaggade${g.borta.length ? ` (${namn(g.borta)})` : ''}.`,
        `Att göra: ${forraAr} var ${p.klaraForra} av ${p.totaltForra} punkter avbockade, ${nuAr} ${p.klaraNu} av ${p.totaltNu}.`
            + (p.kvarFranForra.length ? ` Av ${forraAr} års ${p.kvarFranForra.length} öppna punkter är ${p.kvarFranForra.filter(q => q.klarNu).length} klara i år.` : '')];
    return { id, rubrik: 'Jämförelse med förra året', stycken: [...fore, ...st, ...efter], provat: null, fragor: null,
        tabell: { rubriker: ['Mått', String(forraAr), String(nuAr), 'Skillnad'], rader: j.nyckeltal.map(r => [r.etikett, skriv(r.forra, r.typ), skriv(r.nu, r.typ), diff(r.diff, r.typ)]) },
        ...(Array.isArray(j.basIntervall) && j.basIntervall.length ? { tabeller: [_basUtvecklingTabell(j.basIntervall, forraAr, nuAr)] } : {}) };
}

/**
 * Tabellen Löneutveckling per BAS-intervall i blocket om förra året: samma kolumner som panelen i Spara och jämför år
 * (antal, och P10, median och P90 förra året, i år och förändringen i kronor och procent). Raderna kommer ur
 * jämförelsen av två bokslut, där tröskeln redan är tillämpad (src/lib/arsbokslut.js).
 * @param {any[]} rader jamforArsbokslut(...).basIntervall
 * @param {number} forraAr
 * @param {number} nuAr
 */
function _basUtvecklingTabell(rader, forraAr, nuAr) {
    const tkn = v => (v > 0 ? '+' : v < 0 ? '−' : '±');
    const forandring = f => (!f || f.diff == null ? '–' : `${tkn(f.diff)}${_kr(Math.abs(f.diff))}${f.pct == null ? '' : ` (${tkn(f.pct)}${_pct(Math.abs(f.pct), 1)})`}`);
    const matt = [['p10', 'P10'], ['med', 'Median'], ['p90', 'P90']];
    return { rubrik: `Löneutveckling per ${T.niva.en}`,
        rubriker: [stor(T.niva.en), `Antal ${forraAr}`, `Antal ${nuAr}`, ...matt.flatMap(([, e]) => [`${e} ${forraAr}`, `${e} ${nuAr}`, `${e} förändring`])],
        rader: rader.map(r => [`BAS ${r.bas}`, formatTal(r.n.forra), formatTal(r.n.nu), ...matt.flatMap(([m]) => [_kr(r[m].forra), _kr(r[m].nu), forandring(r[m])])]) };
}

/**
 * Ett block per BAS-intervall (gruppen Per BAS-intervall): BAS-dossierns stycken i rapportens ordning, med punktens
 * rubrik som eget stycke, raden att fylla i för bedömningen och intervallets yrkesgruppstabell. Texten byggs av
 * dossiern i verktyget (basdossierStycken, i exportläget), så att blocket, dossierns kopia och rapporten har samma
 * text; här formateras bara tabellens tal.
 * @param {{bas: string, stycken: {rubrik: string, rader: string[]}[], yrken: {aid: string, yrke: string, nKv: number, nMa: number, medKv: number, medMa: number, kvotPct: number, status: string}[], bedomning: string}} b
 * @param {{id?: string, urval?: string, demo?: boolean, troskelNot?: string}} val
 */
function basintervallBlock(b, { id = `bas:${b.bas}`, urval, demo, troskelNot } = {}) {
    const { fore, efter } = _inled({ demo, urval, troskelNot });
    const st = b.stycken.flatMap(x => [x.rubrik, ...x.rader]);
    return { id, rubrik: `${stor(T.niva.en)} ${b.bas}`, stycken: [...fore, ...st, `[HR fyller i] ${b.bedomning}`, ...efter], provat: null, fragor: null,
        tabell: b.yrken.length ? { rubriker: ['AID', stor(T.namn.en), 'Kvinnor / män', 'Median kvinnor', 'Median män', 'Kvinnors median i % av mäns', 'Status'],
            rader: b.yrken.map(y => [String(y.aid), String(y.yrke), `${formatTal(y.nKv)} / ${formatTal(y.nMa)}`, _kr(y.medKv), _kr(y.medMa), _pct(y.kvotPct, 1), String(y.status)]) } : null };
}

/**
 * Lönerna mot referenserna (ADR-55): överblickens tal i ord och listan. Ställningstagandet är referenspunkten: orden
 * säger var löneläget och statistiken ligger mot det, aldrig tvärtom. Med statistik har listan kolumnen Matchning
 * (samma ord som tabellen mot jämförelsestatistiken och detaljlistan).
 * @param {any} overblick resultatet av referensOverblick (grupper under minsta gruppstorlek är redan borta)
 * @param {{id?:string, urval?:any, demo?:any, troskelNot?:any, harStatistik?:boolean}} opt
 */
function referenserBlock(overblick, { id = 'referenser', urval, demo, troskelNot, harStatistik = false }) {
    const { fore, efter } = _inled({ demo, urval, troskelNot });
    const { grupper, tal } = overblick, pm = tal.perMonster;
    const tecken = v => (v == null ? '–' : `${v >= 0 ? '+' : '−'}${_pct(Math.abs(v), 1)}`);
    const skillnad = (g, ref) => (g.org.median != null && ref?.median != null ? tecken((g.org.median / ref.median - 1) * 100) : '–');
    const mening = (m, text) => `${_st(m.grupper, T.enhet.en + ' i ' + T.niva.en, T.enhet.fl + ' i ' + T.niva.en)} (${_pct(m.andel, 0)} av personalen): ${text}.`;
    const motPolicy = tal.vagdMedianMotStallningstagandePct != null, motStatistik = tal.vagdMedianMotStatistikPct != null;
    const st = ['Ställningstagandet är referenspunkten: löneläget och statistiken mäts mot det.',
        ...(motPolicy && motStatistik ? [mening(pm.badaOver, 'löneläget och statistiken ligger över ställningstagandet'),
            mening(pm.baraLonelageOver, 'bara löneläget ligger över ställningstagandet'),
            mening(pm.baraStatistikOver, 'bara statistiken ligger över ställningstagandet'),
            mening(pm.badaInom, 'löneläget och statistiken ligger inom ställningstagandet')] : []),
        `Vägd medianskillnad, löneläget mot ${[motPolicy && `ställningstagandet: ${tecken(tal.vagdMedianMotStallningstagandePct)}`, motStatistik && `statistiken: ${tecken(tal.vagdMedianMotStatistikPct)}`].filter(Boolean).join(', mot ')}.`];
    return { id, rubrik: 'Lönerna mot referenserna', stycken: [...fore, ...st, ...efter], provat: null, fragor: null,
        tabell: { rubriker: [stor(T.enhet.en), ...(harStatistik ? ['Matchning'] : []), 'n', 'Median (kr)', 'Mot ställningstagandet (%)', 'Mot statistiken (%)', 'Läge och förslag'],
            // Samma text som skärmens kolumn och Excel-bladet (lageOchForslag i referenser.js)
            rader: grupper.map(g => [`${g.yrke} · BAS ${g.bas}`, ...(harStatistik ? [matchningEtikett(g.statistikMatchning)] : []), formatTal(g.n), formatTal(g.org.median, 0),
                skillnad(g, g.stallningstagande), skillnad(g, g.statistik), g.lageOchForslag ?? g.monster.text]) } };
}

/** Ren text för urklipp (reserv): tabbar mellan kolumner, numrerade frågor. */
function tillText(b) {
    const delar = [b.rubrik, ...b.stycken];
    if (b.tabell) delar.push([b.tabell.rubriker, ...b.tabell.rader].map(r => r.join('\t')).join('\n'));
    for (const t of b.tabeller || []) delar.push(`${t.rubrik}\n` + [t.rubriker, ...t.rader].map(r => r.join('\t')).join('\n') + (t.not ? `\n\n${t.not}` : ''));
    if (b.provat) delar.push('Redan prövat:\n' + b.provat.map(p => `- ${p}`).join('\n'));
    if (b.fragor) delar.push('Frågor till ansvarig chef:\n' + b.fragor.map((f, i) => `${i + 1}. ${f}`).join('\n'));
    return delar.join('\n\n');
}

    return { likaArbeteGrupper, gruppMedBas, justeratGapInomYrke, bortvaltNotering, gruppBlock, parBlock, avsnittBlock, tillWordHtml, tillText, stabilitetKort, egenTabellBlock, arsjamforelseBlock, referenserBlock, basintervallBlock, skalSammanstallningNot };
})();
const _ruLikaArbeteGrupper = __mirrorRapportunderlag.likaArbeteGrupper;
const _ruGruppMedBas = __mirrorRapportunderlag.gruppMedBas;
const _ruJusteratGap = __mirrorRapportunderlag.justeratGapInomYrke;
const _ruBortvaltNotering = __mirrorRapportunderlag.bortvaltNotering;
const _ruGruppBlock = __mirrorRapportunderlag.gruppBlock;
const _ruParBlock = __mirrorRapportunderlag.parBlock;
const _ruAvsnittBlock = __mirrorRapportunderlag.avsnittBlock;
const _ruTillWordHtml = __mirrorRapportunderlag.tillWordHtml;
const _ruTillText = __mirrorRapportunderlag.tillText;
const _ruStabilitetKort = __mirrorRapportunderlag.stabilitetKort;
const _ruEgenTabellBlock = __mirrorRapportunderlag.egenTabellBlock;
const _ruArsjamforelseBlock = __mirrorRapportunderlag.arsjamforelseBlock;
const _ruReferenserBlock = __mirrorRapportunderlag.referenserBlock;
const _ruBasintervallBlock = __mirrorRapportunderlag.basintervallBlock;
const _ruSkalNot = __mirrorRapportunderlag.skalSammanstallningNot;

// ---- speglar src/lib/docx.js ----
const __mirrorDocx = (() => {
    // importer ur tidigare speglade lib-moduler
    const arTal = __mirrorHtmlText.arTal;

// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
/**
 * Öppen lönekartläggning — Word-utkastet som .docx (ADR-37).
 *
 * Skriver en enkel blocklista (rubriker, stycken, tabeller, bilder) som Office Open XML-filer. Ingen DOM och
 * ingen zip här: appen packar filerna med JSZip. En bild är ett block `{ typ: 'bild', base64, bredd, hojd, alt,
 * text }` (PNG; mått i bildpunkter). Saknar blocket bilddata skrivs bara bildtexten, inom hakparentes.
 *
 * Webbläsarbygget får en AUTO-GENERERAD spegel i src/app/09-lib-speglar.js.
 */

const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
const TEXTBREDD = 9070;   // A4 11906 − 2 × 1418 twips
const WP = 'http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing';
const A = 'http://schemas.openxmlformats.org/drawingml/2006/main';
const PIC = 'http://schemas.openxmlformats.org/drawingml/2006/picture';
const EMU_PER_TWIP = 635, EMU_PER_PX = 9525;

/** Text för XML: escapad, utan tecken som är ogiltiga i XML 1.0. */
function xmlText(s) {
    return String(s ?? '')
        .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g, '')
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

/** En textkörning; `sz` (halva punkter) bara när texten ska ha en annan storlek än stilens. */
const _kor = (d, sz) => {
    const pr = (d.fet ? '<w:b/>' : '') + (d.kursiv ? '<w:i/>' : '') + (sz ? `<w:sz w:val="${sz}"/><w:szCs w:val="${sz}"/>` : '');
    return `<w:r>${pr ? `<w:rPr>${pr}</w:rPr>` : ''}<w:t xml:space="preserve">${xmlText(d.text)}</w:t></w:r>`;
};
/** Ett stycke; `hallIhop` håller det på samma sida som nästa stycke (keepNext). */
const _stycke = (delar, stil, sz, hallIhop = false) => {
    const pr = (stil ? `<w:pStyle w:val="${stil}"/>` : '') + (hallIhop ? '<w:keepNext/>' : '');
    return `<w:p>${pr ? `<w:pPr>${pr}</w:pPr>` : ''}${(delar || []).map(d => _kor(d, sz)).join('')}</w:p>`;
};
const STIL = { dampad: 'Dampad', fyllIn: 'FyllIn', utkastruta: 'Utkastruta' };

// Teckenbredder i Calibri 10 pt, fet, i twips, avrundade uppåt i grupper; övriga gemener 108, versaler 128.
/** @type {[string, number][]} */
const _TECKENBREDD = [['iljI.,:;!|\' ', 55], ['frt-()', 72], ['sczJ/', 86], ['agkvxyåäeEFLSTZ0123456789', 101], ['mw%&', 163],
    ['DGHNOQUÖ', 137], ['MW', 181]];
// Tabellstilens cellmarginal till vänster och höger, och ovanför och under (twips). En tabell som inte ryms i stilens
// 10 pt skrivs tätare: 9 pt och smalare cellmarginaler till vänster och höger (ADR-75).
const CELLMARGINAL = 85, CELLMARGINAL_LODRAT = 57;
const TAT = { skala: 0.9, cellmarginal: 57, sz: 18 };
/** Ett ords ungefärliga bredd i twips i Calibri 10 pt, fet eller normal (normala bokstäver är omkring 3 % smalare, siffror lika). */
function _ordbredd(ord, fet = true) {
    let s = 0;
    for (const ch of ord) {
        const g = _TECKENBREDD.find(([tecken]) => tecken.includes(ch));
        const b = g ? g[1] : ch !== ch.toLocaleLowerCase('sv') ? 128 : 108;
        s += fet || /[\d\s.,]/.test(ch) ? b : b * 0.97;
    }
    return s;
}
const _celltext = c => (c.delar || []).map(d => d.text).join('');
const _summa = v => v.reduce((s, x) => s + x, 0);
/**
 * Höjer varje kolumn mot sitt mål, upp till en gemensam nivå som väljs så att tabellen ryms i textytan. Ryms alla mål
 * får varje kolumn sitt; annars når de smala kolumnerna sitt mål och de bredaste delar lika på det som är kvar.
 */
function _tillNiva(bredd, mal) {
    const vidNiva = niva => bredd.map((x, k) => Math.max(x, Math.min(mal[k], niva)));
    let lag = 0, hog = Math.max(...mal);
    if (_summa(vidNiva(hog)) <= TEXTBREDD) return vidNiva(hog);
    for (let i = 0; i < 40; i++) { const mitt = (lag + hog) / 2; if (_summa(vidNiva(mitt)) > TEXTBREDD) hog = mitt; else lag = mitt; }
    return vidNiva(lag);
}
/**
 * Kolumnbredderna efter innehållet (F5 i punkt 26), ungefär som en webbläsare fördelar en tabell. Först ryms det
 * längsta ordet och det hela talet i varje datacell, så att ett namn inte bryts mitt i och ett belopp står på en rad;
 * sedan rubrikernas längsta ord; sist hela texten. Ryms ett steg inte, delar de bredaste kolumnerna på det som fattas.
 * Tabellen fyller textytan. `ryms` säger om datacellerna och rubrikernas ord rymdes.
 * @returns {{ bredder: number[], ryms: boolean }}
 */
function _kolumnbredder(b, kolumner, { skala = 1, cellmarginal = CELLMARGINAL } = {}) {
    const marginal = 2 * cellmarginal + 10;   // cellens marginaler och lite luft (uppskattningen ligger redan 2–6 % över)
    // Rubrikraden är fet, dataraderna normala.
    const matt = (rader, fet) => Array.from({ length: kolumner }, (_, k) => {
        let ord = 0, hel = 0;
        for (const r of rader) {
            const text = r[k] ? _celltext(r[k]) : '';
            for (const o of text.split(/\s+/)) ord = Math.max(ord, _ordbredd(o, fet));
            if (!fet && arTal(text)) ord = Math.max(ord, _ordbredd(text, false));
            hel = Math.max(hel, _ordbredd(text, fet));
        }
        return { ord: ord * skala + marginal, hel: hel * skala + marginal };
    });
    const data = matt(b.rader || [], false), rubrik = matt(b.rubrikrad ? [b.rubrikrad] : [], true);
    const ordMal = data.map((m, k) => Math.max(m.ord, rubrik[k].ord));
    let bredd = _tillNiva(Array(kolumner).fill(0), data.map(m => m.ord));
    bredd = _tillNiva(bredd, ordMal);
    // Hela texten: det som är kvar fördelas efter vad varje kolumn saknar, och det som är kvar sedan efter bredden.
    const brist = data.map((m, k) => Math.max(0, Math.max(m.hel, rubrik[k].hel) - bredd[k]));
    const kvar = TEXTBREDD - _summa(bredd);
    if (kvar > 0 && _summa(brist)) bredd = bredd.map((x, k) => x + brist[k] * Math.min(1, kvar / _summa(brist)));
    const rest = TEXTBREDD - _summa(bredd);
    if (rest > 0) bredd = bredd.map(x => x + rest * x / _summa(bredd));
    const hela = bredd.map(Math.floor);
    hela[hela.indexOf(Math.max(...hela))] += TEXTBREDD - _summa(hela);
    return { bredder: hela, ryms: _summa(ordMal) <= TEXTBREDD };
}

/** Cellmarginalerna i schemats ordning (top, left, bottom, right). */
const _cellmarginaler = (lodrat, sidled) => '<w:tblCellMar>'
    + [['top', lodrat], ['left', sidled], ['bottom', lodrat], ['right', sidled]].map(([s, w]) => `<w:${s} w:w="${w}" w:type="dxa"/>`).join('')
    + '</w:tblCellMar>';

/** `hallIhop`: den sista raden står på samma sida som stycket efter tabellen (keepNext i radens stycken). */
function _tabell(b, hallIhop = false) {
    const alla = [...(b.rubrikrad ? [b.rubrikrad] : []), ...(b.rader || [])];
    const kolumner = Math.max(1, ...alla.map(r => r.length));
    // Ryms inte cellernas ord och tal och rubrikernas ord i 10 pt, skrivs tabellen tätare.
    const vanlig = _kolumnbredder(b, kolumner);
    const tat = !vanlig.ryms;
    const { bredder } = tat ? _kolumnbredder(b, kolumner, TAT) : vanlig;
    const sz = tat ? TAT.sz : undefined;
    const rad = (celler, rubrik, sista = false) => {
        const fyllda = [...celler, ...Array(kolumner - celler.length).fill({ delar: [] })];
        return `<w:tr><w:trPr><w:cantSplit/>${rubrik ? '<w:tblHeader/>' : ''}</w:trPr>${fyllda.map((c, k) =>
            `<w:tc><w:tcPr><w:tcW w:w="${bredder[k]}" w:type="dxa"/>${rubrik ? '<w:shd w:val="clear" w:color="auto" w:fill="F0F0F0"/>' : ''}</w:tcPr>`
            + _stycke((c.delar || []).map(d => (rubrik ? { ...d, fet: true } : d)), undefined, sz, sista && hallIhop) + '</w:tc>').join('')}</w:tr>`;
    };
    // Bredden i samma enhet (dxa) som kolumnerna och cellerna, och tblLook som Word själv skriver (A9): Word räknar
    // annars om en procentbredd mot cellbredderna, och LibreOffice och Word kan rita tabellen olika.
    const look = b.rubrikrad ? 'w:val="04A0" w:firstRow="1"' : 'w:val="0480" w:firstRow="0"';
    // Det täta läget skriver alla fyra sidorna, topp och botten med stilens värden: Word nollar en sida som saknas.
    const mar = tat ? _cellmarginaler(CELLMARGINAL_LODRAT, TAT.cellmarginal) : '';
    return `<w:tbl><w:tblPr><w:tblStyle w:val="Tabell"/><w:tblW w:w="${TEXTBREDD}" w:type="dxa"/>${mar}`
        + `<w:tblLook ${look} w:lastRow="0" w:firstColumn="1" w:lastColumn="0" w:noHBand="0" w:noVBand="1"/></w:tblPr>`
        + `<w:tblGrid>${bredder.map(x => `<w:gridCol w:w="${x}"/>`).join('')}</w:tblGrid>`
        + (b.rubrikrad ? rad(b.rubrikrad, true) : '') + (b.rader || []).map((r, i, alla) => rad(r, false, i === alla.length - 1)).join('') + '</w:tbl>';
}

const _harBild = b => b && b.typ === 'bild' && typeof b.base64 === 'string' && b.base64.length > 0 && b.bredd > 0 && b.hojd > 0;

/** En bild som eget, centrerat stycke, högst så bred som textytan, följd av bildtexten. `nr` börjar på 1. */
function _bild(b, nr) {
    const text = b.text ? _stycke([{ text: b.text }], STIL.dampad) : '';
    if (!_harBild(b)) return _stycke([{ text: `[Diagram: ${b.text || b.alt || 'utan rubrik'} — bilden kunde inte skapas]` }], STIL.dampad);
    const maxCx = TEXTBREDD * EMU_PER_TWIP;
    const cx = Math.min(maxCx, Math.round(b.bredd * EMU_PER_PX)), cy = Math.round(cx * b.hojd / b.bredd);
    const besk = xmlText(b.alt || b.text || `Diagram ${nr}`);
    return '<w:p><w:pPr><w:keepNext/><w:jc w:val="center"/></w:pPr><w:r><w:drawing>'
        + `<wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${cx}" cy="${cy}"/><wp:effectExtent l="0" t="0" r="0" b="0"/>`
        + `<wp:docPr id="${nr}" name="Bild ${nr}" descr="${besk}"/><wp:cNvGraphicFramePr><a:graphicFrameLocks noChangeAspect="1"/></wp:cNvGraphicFramePr>`
        + `<a:graphic><a:graphicData uri="${PIC}"><pic:pic><pic:nvPicPr><pic:cNvPr id="${nr}" name="bild${nr}.png" descr="${besk}"/><pic:cNvPicPr/></pic:nvPicPr>`
        + `<pic:blipFill><a:blip r:embed="rIdBild${nr}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>`
        + `<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr>`
        + '</pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>' + text;
}

function _dokument(block) {
    let nr = 0;
    // En ruta att fylla i står på samma sida som stycket eller tabellraden före, det som den bedömer (S5 i punkt 26).
    // Rutan själv hålls inte ihop med nästa: då skulle den följa med nästa avsnitts rubrik.
    const foreRuta = i => i + 1 < block.length && block[i + 1].typ === 'stycke' && block[i + 1].stil === 'fyllIn';
    const delar = block.map((b, i) => (b.typ === 'rubrik' ? _stycke(b.delar, `Heading${b.niva}`)
        : b.typ === 'tabell' ? _tabell(b, foreRuta(i))
        : b.typ === 'bild' ? _bild(b, _harBild(b) ? ++nr : 0) : _stycke(b.delar, STIL[b.stil], undefined, foreRuta(i)))
        // Två tabeller i följd skiljs av ett tomt stycke; utan det slår Word ihop dem till en tabell (A9).
        + (b.typ === 'tabell' && i + 1 < block.length && block[i + 1].typ === 'tabell' ? '<w:p/>' : ''));
    if (!block.length || block[block.length - 1].typ === 'tabell') delar.push('<w:p/>');   // stycke före sectPr
    return `${XML}<w:document xmlns:w="${W}" xmlns:r="${R}" xmlns:wp="${WP}" xmlns:a="${A}" xmlns:pic="${PIC}"><w:body>${delar.join('')}`
        + `<w:sectPr><w:footerReference w:type="default" r:id="rIdSidfot"/><w:pgSz w:w="11906" w:h="16838"/>`
        + `<w:pgMar w:top="1418" w:right="1418" w:bottom="1418" w:left="1418" w:header="709" w:footer="709" w:gutter="0"/></w:sectPr>`
        + '</w:body></w:document>';
}

function _stilar() {
    const ram = (typ, sz, farg) => ['top', 'left', 'bottom', 'right'].map(s => `<w:${s} w:val="${typ}" w:sz="${sz}" w:space="4" w:color="${farg}"/>`).join('');
    const rubrik = (id, namn, niva, sz, extra = '') => `<w:style w:type="paragraph" w:styleId="${id}"><w:name w:val="${namn}"/>`
        + `<w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:uiPriority w:val="9"/><w:qFormat/>`
        + `<w:pPr><w:keepNext/><w:keepLines/>${extra}<w:outlineLvl w:val="${niva}"/></w:pPr><w:rPr><w:b/><w:sz w:val="${sz}"/><w:szCs w:val="${sz}"/></w:rPr></w:style>`;
    return `${XML}<w:styles xmlns:w="${W}">`
        + '<w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:eastAsia="Calibri" w:cs="Calibri"/>'
        + '<w:sz w:val="22"/><w:szCs w:val="22"/><w:lang w:val="sv-SE"/></w:rPr></w:rPrDefault>'
        + '<w:pPrDefault><w:pPr><w:spacing w:after="120" w:line="264" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>'
        + '<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style>'
        + rubrik('Heading1', 'heading 1', 0, 40, '<w:spacing w:before="0" w:after="60"/>')
        + rubrik('Heading2', 'heading 2', 1, 28, '<w:pBdr><w:bottom w:val="single" w:sz="4" w:space="1" w:color="999999"/></w:pBdr><w:spacing w:before="360" w:after="120"/>')
        + rubrik('Heading3', 'heading 3', 2, 24, '<w:spacing w:before="240" w:after="80"/>')
        + '<w:style w:type="paragraph" w:customStyle="1" w:styleId="Dampad"><w:name w:val="Dämpad"/><w:basedOn w:val="Normal"/><w:qFormat/>'
        + '<w:pPr><w:keepLines/></w:pPr><w:rPr><w:color w:val="555555"/><w:sz w:val="19"/><w:szCs w:val="19"/></w:rPr></w:style>'
        + `<w:style w:type="paragraph" w:customStyle="1" w:styleId="FyllIn"><w:name w:val="Fyll i"/><w:basedOn w:val="Normal"/><w:qFormat/>`
        + `<w:pPr><w:keepLines/><w:pBdr>${ram('dashed', 4, 'B45309')}</w:pBdr><w:shd w:val="clear" w:color="auto" w:fill="FFF7D6"/><w:spacing w:before="120" w:after="120"/></w:pPr>`
        + '<w:rPr><w:sz w:val="21"/><w:szCs w:val="21"/></w:rPr></w:style>'
        + `<w:style w:type="paragraph" w:customStyle="1" w:styleId="Utkastruta"><w:name w:val="Utkastruta"/><w:basedOn w:val="Normal"/><w:qFormat/>`
        + `<w:pPr><w:keepLines/><w:pBdr>${ram('single', 12, 'B45309')}</w:pBdr><w:shd w:val="clear" w:color="auto" w:fill="FFF7ED"/><w:spacing w:after="240"/></w:pPr></w:style>`
        + '<w:style w:type="table" w:customStyle="1" w:styleId="Tabell"><w:name w:val="Tabell"/>'
        + '<w:rPr><w:sz w:val="20"/><w:szCs w:val="20"/></w:rPr><w:tblPr><w:tblBorders>'
        + ['top', 'left', 'bottom', 'right', 'insideH', 'insideV'].map(s => `<w:${s} w:val="single" w:sz="4" w:space="0" w:color="999999"/>`).join('')
        + '</w:tblBorders>' + _cellmarginaler(CELLMARGINAL_LODRAT, CELLMARGINAL) + '</w:tblPr></w:style>'
        + '</w:styles>';
}

function _sidfot(text) {
    const falt = namn => `<w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText xml:space="preserve"> ${namn} </w:instrText></w:r>`
        + '<w:r><w:fldChar w:fldCharType="separate"/></w:r><w:r><w:t>1</w:t></w:r><w:r><w:fldChar w:fldCharType="end"/></w:r>';
    return `${XML}<w:ftr xmlns:w="${W}" xmlns:r="${R}"><w:p><w:pPr><w:tabs><w:tab w:val="right" w:pos="${TEXTBREDD}"/></w:tabs>`
        + '<w:rPr><w:sz w:val="16"/></w:rPr></w:pPr>'
        + `<w:r><w:t xml:space="preserve">${xmlText(text)}</w:t></w:r><w:r><w:tab/></w:r><w:r><w:t xml:space="preserve">Sida </w:t></w:r>`
        + `${falt('PAGE')}<w:r><w:t xml:space="preserve"> av </w:t></w:r>${falt('NUMPAGES')}</w:p></w:ftr>`;
}

/**
 * @param {Array} block
 * @param {{titel:string, sidfot:string, skapad:string}} opt - skapad i ISO 8601 (UTC)
 * @returns {Object<string,string|{base64:string}>} sökväg i zip:en → XML, eller `{ base64 }` för en bildfil
 */
function docxDelar(block, { titel, sidfot, skapad }) {
    const bilder = (block || []).filter(_harBild);
    const PKG = 'http://schemas.openxmlformats.org/package/2006';
    const OFF = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
    const typ = t => `application/vnd.openxmlformats-officedocument.${t}`;
    return {
        '[Content_Types].xml': `${XML}<Types xmlns="${PKG}/content-types">`
            + `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>`
            + '<Default Extension="xml" ContentType="application/xml"/>'
            + (bilder.length ? '<Default Extension="png" ContentType="image/png"/>' : '')
            + `<Override PartName="/word/document.xml" ContentType="${typ('wordprocessingml.document.main+xml')}"/>`
            + `<Override PartName="/word/styles.xml" ContentType="${typ('wordprocessingml.styles+xml')}"/>`
            + `<Override PartName="/word/settings.xml" ContentType="${typ('wordprocessingml.settings+xml')}"/>`
            + `<Override PartName="/word/footer1.xml" ContentType="${typ('wordprocessingml.footer+xml')}"/>`
            + '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>'
            + `<Override PartName="/docProps/app.xml" ContentType="${typ('extended-properties+xml')}"/></Types>`,
        '_rels/.rels': `${XML}<Relationships xmlns="${PKG}/relationships">`
            + `<Relationship Id="rId1" Type="${OFF}/officeDocument" Target="word/document.xml"/>`
            + `<Relationship Id="rId2" Type="${PKG}/relationships/metadata/core-properties" Target="docProps/core.xml"/>`
            + `<Relationship Id="rId3" Type="${OFF}/extended-properties" Target="docProps/app.xml"/></Relationships>`,
        'word/_rels/document.xml.rels': `${XML}<Relationships xmlns="${PKG}/relationships">`
            + `<Relationship Id="rId1" Type="${OFF}/styles" Target="styles.xml"/>`
            + `<Relationship Id="rId2" Type="${OFF}/settings" Target="settings.xml"/>`
            + `<Relationship Id="rIdSidfot" Type="${OFF}/footer" Target="footer1.xml"/>`
            + bilder.map((_b, i) => `<Relationship Id="rIdBild${i + 1}" Type="${OFF}/image" Target="media/bild${i + 1}.png"/>`).join('')
            + '</Relationships>',
        ...Object.fromEntries(bilder.map((b, i) => [`word/media/bild${i + 1}.png`, { base64: b.base64 }])),
        'word/document.xml': _dokument(block || []),
        'word/styles.xml': _stilar(),
        'word/settings.xml': `${XML}<w:settings xmlns:w="${W}"><w:defaultTabStop w:val="709"/>`
            + '<w:characterSpacingControl w:val="doNotCompress"/><w:compat>'
            + '<w:compatSetting w:name="compatibilityMode" w:uri="http://schemas.microsoft.com/office/word" w:val="15"/></w:compat></w:settings>',
        'word/footer1.xml': _sidfot(sidfot),
        'docProps/core.xml': `${XML}<cp:coreProperties xmlns:cp="${PKG}/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/"`
            + ' xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">'
            + `<dc:title>${xmlText(titel)}</dc:title><dc:creator>Öppen lönekartläggning</dc:creator>`
            + `<dcterms:created xsi:type="dcterms:W3CDTF">${xmlText(skapad)}</dcterms:created>`
            + `<dcterms:modified xsi:type="dcterms:W3CDTF">${xmlText(skapad)}</dcterms:modified></cp:coreProperties>`,
        'docProps/app.xml': `${XML}<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties">`
            + '<Application>Öppen lönekartläggning</Application></Properties>',
    };
}

    return { docxDelar };
})();
const _docxDelar = __mirrorDocx.docxDelar;

// ---- speglar src/lib/perbas.js ----
const __mirrorPerBas = (() => {
    // importer ur tidigare speglade lib-moduler
    const median = __mirrorStat.median;
    const quantile = __mirrorStat.quantile;
    const sektorsnamn = __mirrorAid.sektorsnamn;
    const aidAvRad = __mirrorAid.aidAvRad;
    const namnrader = __mirrorAid.namnrader;
    const statistikFor = __mirrorJamforelse.statistikFor;
    const skapaTermer = __mirrorTermer.skapaTermer;
    const stor = __mirrorTermer.stor;
    const adjektiv = __mirrorTermer.adjektiv;
    const kompletterandeUndertryckning = __mirrorUndertryckning.kompletterandeUndertryckning;
    const arKvinna = __mirrorKon.arKvinna;
    const arMan = __mirrorKon.arMan;

// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
/**
 * Öppen lönekartläggning — tabellerna per BAS-intervall, i den form en skriven lönekartläggning brukar ha.
 *
 * Tre tabeller, byggda efter arbetsgivarnas egna utkast:
 *  1. Per BAS-intervall: referensen (ställningstagandet), organisationen, varje yrkesgrupp med jämförelse-
 *     statistikens rad under, och sist kvinnor och män — P10, median, P90 och antal.
 *  2. Löneskillnader inom likvärdigt arbete: per BAS medellön för alla, män och kvinnor, kvinnors
 *     medellön i procent av mäns, andel kvinnor och medelålder.
 *  3. Löneskillnader i åldersgrupper: per BAS medellön i tre åldersgrupper.
 *
 * Minsta gruppstorlek (k) tillämpas här: en yrkesgrupp, ett BAS-intervall eller en åldersgrupp med färre än
 * k personer får ingen lönerad, och könsuppdelade mått visas bara när båda könen når k. De utelämnade
 * räknas upp så att rapporten säger vad den inte redovisar. Raden Alla och organisationens rad räknas på hela
 * underlaget, så att en utelämnad grupps medellön inte ska gå att räkna fram som en differens undertrycks vid behov
 * också medelvärdena för en visad grupp (kompletterande undertryckning, ADR-83, `kompletterandeUndertryckning` i undertryckning.js).
 *
 * Webbläsarbygget får en AUTO-GENERERAD spegel i src/app/09-lib-speglar.js.
 *
 * Bygger på: ADR-52 och ADR-83, docs/utveckling/k-troskeln.md avsnitt 2. Beräkningarna står i docs/utveckling/berakningsregister.md.
 */






/** Standardtermerna (ADR-74); skapaTermer() utan egna termer ger standarduppsättningen. */
const T = skapaTermer();


// ---- Receptet (ADR-52): vad avsnittet ska innehålla. Standardvärdet är tabellerna som de står i arbetsgivarnas utkast. ----
const PERBAS_DIMENSIONER = ['bas', 'sektor'];
const PERBAS_MATT = ['p10', 'p25', 'med', 'p75', 'p90', 'medel'];
const PERBAS_RADER = ['referens', 'organisation', 'yrken', 'statistik', 'kvinnor', 'man'];
function perBasStandard() {
    return { dim: 'bas', rader: [...PERBAS_RADER], matt: ['p10', 'med', 'p90'], konsgap: true, aldersgrupper: true, aldersgranser: [35, 50] };
}
/** Receptet i giltig form; okända värden faller tillbaka på standard. Null in ger standardreceptet. */
function valideraPerBasRecept(r) {
    const std = perBasStandard();
    if (!r || typeof r !== 'object') return std;
    const granser = Array.isArray(r.aldersgranser) ? [...new Set(r.aldersgranser.map(Number).filter(x => Number.isInteger(x) && x > 16 && x < 80))].sort((a, b) => a - b) : [];
    const matt = Array.isArray(r.matt) ? PERBAS_MATT.filter(m => r.matt.includes(m)) : [];
    return {
        dim: PERBAS_DIMENSIONER.includes(r.dim) ? r.dim : 'bas',
        rader: Array.isArray(r.rader) ? PERBAS_RADER.filter(x => r.rader.includes(x)) : std.rader,
        matt: matt.length ? matt : std.matt,
        konsgap: r.konsgap !== false, aldersgrupper: r.aldersgrupper !== false,
        aldersgranser: granser.length ? granser : std.aldersgranser
    };
}
function perBasReceptArStandard(r) { return JSON.stringify(valideraPerBasRecept(r)) === JSON.stringify(perBasStandard()); }

const _medel = arr => (arr.length ? arr.reduce((s, x) => s + x, 0) / arr.length : null);
const _loner = rader => rader.map(r => r.lon).filter(x => typeof x === 'number' && isFinite(x) && x > 0);
const _aldrar = rader => rader.map(r => r.alder).filter(x => typeof x === 'number' && isFinite(x) && x > 0);
const _matt = rader => { const l = _loner(rader); return l.length ? { n: rader.length, p10: quantile(l, 0.1), p25: quantile(l, 0.25), med: median(l), p75: quantile(l, 0.75), p90: quantile(l, 0.9), medel: _medel(l) } : null; };

/** Yrkesgruppens namn: AID-koden och etiketten. */
function yrkesnamn(r) {
    const aid = r.aid != null ? String(r.aid).trim() : '';
    const etikett = r.yrkeLabel ? String(r.yrkeLabel).trim() : '';
    if (aid && etikett && etikett !== aid) return `${aid} ${etikett}`;
    return aid || etikett || String(r.yrke || '').trim() || `(${adjektiv('okänd', T.enhet)} ${T.enhet.en})`;
}

/**
 * Åldersgrupperna ur gränserna: [35, 50] → ['–34', '35–49', '50–'].
 * @param {number[]} granser
 */
function aldersgruppNamn(granser) {
    const g = [...granser].sort((a, b) => a - b);
    const ut = [`–${g[0] - 1}`];
    for (let i = 0; i < g.length - 1; i++) ut.push(`${g[i]}–${g[i + 1] - 1}`);
    ut.push(`${g[g.length - 1]}–`);
    return ut;
}
const _aldersgrupp = (alder, granser) => { let i = 0; while (i < granser.length && alder >= granser[i]) i++; return i; };

/**
 * @param {Array<{bas:string, aid?:string, yrke?:string, yrkeLabel?:string, kon:string, lon:number, alder?:number}>} rader
 * @param {{k?: number, referens?: ((aid: string|null, bas: string) => ({p10?:number, med?:number, p90?:number}|null))|null,
 *          statistik?: Array<{aid:string, bas?:string, median:number, p10?:number, p90?:number}>|null,
 *          referensNamn?: string, statistikNamn?: string, aldersgranser?: number[], recept?: any}} [opt]
 *   `recept` (ADR-52): dimensionen som upprepas ('bas' eller 'sektor'), vilka rader och mått, och om summeringstabellerna
 *   ska med; utelämnat ger standardreceptet. Med sektor som dimension finns ingen referensrad (ställningstagandet
 *   gäller BAS-intervall).
 */
function perBasTabeller(rader, opt = {}) {
    const k = opt.k ?? 10;
    const recept = valideraPerBasRecept(opt.recept);
    const visa = new Set(recept.rader);
    const dimAv = recept.dim === 'sektor' ? (r => sektorsnamn(r.aid) || '') : (r => String(r.bas ?? ''));
    const referens = typeof opt.referens === 'function' ? opt.referens : () => null;
    const statistik = Array.isArray(opt.statistik) ? opt.statistik : [];
    const referensNamn = opt.referensNamn || 'Referens';
    const statistikNamn = opt.statistikNamn || 'Jämförelsestatistik';
    const granser = (opt.aldersgranser && opt.aldersgranser.length ? opt.aldersgranser : recept.aldersgranser).slice().sort((a, b) => a - b);
    const d = (rader || []).filter(r => r && r.bas && dimAv(r));
    // Ålderskolumnen är valfri (ADR-64): utan ålder utelämnas åldersgrupperna och medelåldern.
    const harAlder = d.some(r => typeof r.alder === 'number' && r.alder > 0);
    const basar = [...new Set(d.map(dimAv))].sort((a, b) => a.localeCompare(b, 'sv'));
    // Statistikens gemensamma uppslag (jamforelse.js): samma AID och BAS, annars samma AID utan BAS.
    const statFor = (aid, bas) => statistikFor(statistik, aid, bas)?.rad || null;

    const perDim = new Map(basar.map(b => [b, d.filter(r => dimAv(r) === b)]));
    const raderI = b => perDim.get(b) || [];
    const basUtelamnade = basar.filter(b => raderI(b).length < k);
    const visadeBas = basar.filter(b => raderI(b).length >= k);
    const nKvI = b => raderI(b).filter(arKvinna).length, nMaI = b => raderI(b).filter(arMan).length;
    const konVisasI = b => nKvI(b) >= k && nMaI(b) >= k;
    const harMedel = recept.matt.includes('medel');

    // Kompletterande undertryckning (ADR-83). Raden Alla i tabellerna inom likvärdigt arbete och i åldersgrupper räknas
    // på hela underlaget; omfattar de utelämnade intervallen färre än k personer undertrycks medelvärdena för de minsta
    // visade intervallen, i alla tabellerna (också organisationens rad, yrkesgrupperna och könsraderna i intervallets
    // tabell, som annars ger intervallets medellön tillbaka). Raden Alla bär bara medelvärden i de två tabellerna.
    const allaVisas = recept.konsgap || (recept.aldersgrupper && harAlder);
    const medelDolda = new Set(allaVisas
        ? kompletterandeUndertryckning(basar.map(b => ({ namn: b, n: raderI(b).length, dold: raderI(b).length < k })), k).map(i => basar[i])
        : []);
    // Samma regel per kön: medellön per kön på raden Alla minus de visade intervallens ger de dolda könscellernas
    // gemensamma medellön, och den ska omfatta minst k personer av det könet. Ett intervall vars könsmedel döljs ger
    // också via sin medellön för alla den andra könets dolda celler, så båda könens medel döljs tillsammans.
    const konDolda = new Set();
    if (recept.konsgap && d.filter(arKvinna).length >= k && d.filter(arMan).length >= k) {
        for (const antal of [nKvI, nMaI]) {
            const delar = basar.map(b => ({ namn: b, n: antal(b), dold: raderI(b).length < k || medelDolda.has(b) || !konVisasI(b) || konDolda.has(b) }));
            kompletterandeUndertryckning(delar, k).forEach(i => konDolda.add(basar[i]));
        }
    }
    const utanMedel = r => ({ ...r, medel: null });

    const intervall = [];
    for (const bas of visadeBas) {
        const df = raderI(bas);
        const medelDold = medelDolda.has(bas), konMedelDold = konDolda.has(bas);
        const rad = [];
        const utelamnade = [];
        const ref = recept.dim === 'bas' && visa.has('referens') ? referens(null, bas) : null;
        if (ref && (ref.p10 != null || ref.med != null || ref.p90 != null)) rad.push({ typ: 'referens', namn: referensNamn, n: null, p10: ref.p10 ?? null, med: ref.med ?? null, p90: ref.p90 ?? null });
        const org = visa.has('organisation') ? _matt(df) : null;
        if (org) rad.push({ typ: 'organisation', namn: 'Organisationen', ...(medelDold ? utanMedel(org) : org) });
        // Yrkesgrupperna, största först; under varje yrke dess rad i jämförelsestatistiken. Gruppen är AID-koden
        // (aidAvRad), och en rad utan kod grupperas på sin text.
        const perYrke = new Map();
        df.forEach(r => { const key = aidAvRad(r); if (!perYrke.has(key)) perYrke.set(key, []); perYrke.get(key).push(r); });
        // Yrkesgruppens namn ur texten på flest av dess rader (namnrader), som i resten av verktyget (ADR-89).
        const namnrad = namnrader(df, aidAvRad), namnAv = rows => yrkesnamn(namnrad.get(aidAvRad(rows[0])));
        const yrken = [...perYrke.entries()].sort((a, b) => b[1].length - a[1].length || namnAv(a[1]).localeCompare(namnAv(b[1]), 'sv'));
        // Organisationens rad minus yrkesgruppernas ger de utelämnade yrkesgruppernas medellön: samma regel inom intervallet.
        // En yrkesgrupp utan någon lön har inget medel och räknas varken som visad eller som dold.
        const yrkesMatt = visa.has('yrken') ? yrken.map(([, rows]) => (rows.length >= k ? _matt(rows) : null)) : [];
        const yrkenDolda = new Set(visa.has('yrken') && !medelDold
            ? kompletterandeUndertryckning(yrken.map(([, rows], i) => ({ namn: namnAv(rows), n: rows.length < k || yrkesMatt[i] ? rows.length : 0, dold: rows.length < k || !yrkesMatt[i] })), k)
            : []);
        const undertryckta = [];
        yrken.forEach(([key, rows], i) => {
            if (!visa.has('yrken')) return;
            const namn = namnAv(rows);
            if (rows.length < k) { utelamnade.push(namn); return; }
            const m = yrkesMatt[i];
            if (!m) return;
            const dold = medelDold || yrkenDolda.has(i);
            if (yrkenDolda.has(i)) undertryckta.push(namn);
            rad.push({ typ: 'yrke', namn, aid: key, ...(dold ? utanMedel(m) : m) });
            const s = visa.has('statistik') && rows[0].aid != null && recept.dim === 'bas' ? statFor(rows[0].aid, bas) : null;
            if (s && s.median > 0) rad.push({ typ: 'statistik', namn: `${statistikNamn}: ${namn}`, aid: key, n: null, p10: s.p10 ?? null, med: s.median, p90: s.p90 ?? null });
        });
        const kv = df.filter(arKvinna), ma = df.filter(arMan);
        const konVisas = kv.length >= k && ma.length >= k;
        if (konVisas) {
            const mk = visa.has('kvinnor') ? _matt(kv) : null, mm = visa.has('man') ? _matt(ma) : null;
            const konDold = medelDold || konMedelDold;
            if (mk) rad.push({ typ: 'kvinnor', namn: 'Kvinnor', ...(konDold ? utanMedel(mk) : mk) });
            if (mm) rad.push({ typ: 'man', namn: 'Män', ...(konDold ? utanMedel(mm) : mm) });
        }
        // Noterna gäller bara när tabellen visar måttet Medellön; medelvärdena är tomma oavsett.
        intervall.push({ bas, n: df.length, nKv: kv.length, nMa: ma.length, rader: rad, utelamnade, konVisas, antalYrken: perYrke.size,
            undertryckta: harMedel ? undertryckta : [], medelUndertryckt: harMedel && medelDold,
            konMedelUndertryckt: harMedel && konVisas && !medelDold && konMedelDold && (visa.has('kvinnor') || visa.has('man')) });
    }

    // Könsgap och ålder per BAS, med raden Alla först.
    const konsgapRad = (namn, rows, medelDold = false, konDold = false) => {
        const kv = rows.filter(arKvinna), ma = rows.filter(arMan);
        const konVisas = kv.length >= k && ma.length >= k;
        const konMedel = konVisas && !medelDold && !konDold;
        const medel = medelDold ? null : _medel(_loner(rows)), medelKv = konMedel ? _medel(_loner(kv)) : null, medelMa = konMedel ? _medel(_loner(ma)) : null;
        return {
            bas: namn, n: rows.length, medel, medelMa, medelKv,
            kvot: konMedel && medelMa != null && medelMa > 0 && medelKv != null ? medelKv / medelMa * 100 : null,
            andelKv: rows.length ? kv.length / rows.length * 100 : null,
            alder: harAlder && !medelDold ? _medel(_aldrar(rows)) : null, alderMa: harAlder && konMedel ? _medel(_aldrar(ma)) : null,
            alderKv: harAlder && konMedel ? _medel(_aldrar(kv)) : null,
            konVisas
        };
    };
    const konsgap = { rader: [konsgapRad('Alla', d), ...visadeBas.map(b => konsgapRad(b, raderI(b), medelDolda.has(b), konDolda.has(b)))],
        undertryckta: visadeBas.filter(b => medelDolda.has(b)), konUndertryckta: visadeBas.filter(b => konDolda.has(b) && !medelDolda.has(b) && konVisasI(b)) };

    const grupper = aldersgruppNamn(granser);
    const aldersRad = (namn, rows, medelDold = false) => {
        /** @type {any[][]} */
        const per = grupper.map(() => []);
        rows.forEach(r => { if (typeof r.alder === 'number' && isFinite(r.alder) && r.alder > 0) per[_aldersgrupp(r.alder, granser)].push(r); });
        return { bas: namn, n: rows.length, alder: medelDold ? null : _medel(_aldrar(rows)), medel: medelDold ? null : _medel(_loner(rows)),
            perGrupp: per.map(g => (g.length >= k && !medelDold ? _medel(_loner(g)) : null)), antalPerGrupp: per.map(g => g.length) };
    };
    const aldersgrupper = { grupper, rader: [aldersRad('Alla', d), ...visadeBas.map(b => aldersRad(b, raderI(b), medelDolda.has(b)))],
        undertryckta: visadeBas.filter(b => medelDolda.has(b)) };

    return { k, recept, dim: recept.dim, dimEtikett: stor(recept.dim === 'sektor' ? T.huvudomrade.en : T.niva.en), intervall, basUtelamnade, harAlder,
             konsgap: recept.konsgap ? konsgap : null, aldersgrupper: recept.aldersgrupper && harAlder ? aldersgrupper : null };
}

    return { perBasTabeller, aldersgruppNamn, yrkesnamn, perBasStandard, valideraPerBasRecept, perBasReceptArStandard };
})();
const _pbTabeller = __mirrorPerBas.perBasTabeller;
const _pbStandard = __mirrorPerBas.perBasStandard;
const _pbValideraRecept = __mirrorPerBas.valideraPerBasRecept;
const _pbReceptArStandard = __mirrorPerBas.perBasReceptArStandard;

// ---- speglar src/lib/tabellrecept.js ----
const __mirrorTabellrecept = (() => {
    // importer ur tidigare speglade lib-moduler
    const computePivot = __mirrorUtforska.computePivot;
    const personOrd = __mirrorNamn.personOrd;
    const skapaTermer = __mirrorTermer.skapaTermer;
    const stor = __mirrorTermer.stor;

// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
/**
 * Öppen lönekartläggning — egna tabeller i rapporten (ADR-52).
 *
 * En tabell som användaren byggt i Utforska sparas som ett RECEPT — rader, kolumner, mått, urval och om tabellen ska
 * upprepas per BAS-intervall — aldrig som tal. Recepten ritas om i exportläget när Word-utkastet, PDF-rapporten och
 * Excel-filen byggs, med samma pivot som fliken (computePivot) och samma regler för minsta gruppstorlek som Utforskas
 * export: en cell under tröskeln blir tom, och rader och kolumner som bara har tomma celler utelämnas och räknas.
 *
 * Webbläsarbygget får en AUTO-GENERERAD spegel i src/app/09-lib-speglar.js.
 */



/** Standardtermerna (ADR-74); skapaTermer() utan egna termer ger standarduppsättningen. */
const T = skapaTermer();


// Samma listor som i src/lib/utforska.js (DIMENSIONER, MATT); tests/tabellrecept.test.js vaktar att de är lika.
const DIMENSIONER = ['bas', 'aid', 'alder', 'kon', 'alla', 'aidbas', 'lonespann', 'sektor', 'aidniva'];
const MATT = ['median', 'medel', 'n', 'p10', 'p25', 'p75', 'p90', 'spridning', 'andelKv', 'gap'];
const RECEPT_DIMENSIONER = DIMENSIONER, RECEPT_MATT = MATT;

const DIM_ETIKETT = Object.freeze({
    bas: stor(T.niva.en), aid: stor(T.enhet.en), alder: 'Åldersgrupp', kon: 'Kön',
    aidbas: `${stor(T.enhet.en)} i ${T.niva.en}`, lonespann: 'Lönespann', alla: 'Hela urvalet',
    sektor: stor(T.huvudomrade.en), aidniva: 'AID-mellannivå'
});
const MATT_ETIKETT = Object.freeze({
    median: 'Median månadslön', medel: 'Medellön', n: 'Antal (n)',
    p10: 'P10', p25: 'P25', p75: 'P75', p90: 'P90',
    spridning: 'Spridning (P90/P10)', andelKv: 'Andel kvinnor (%)', gap: 'Kvinnors median i % av mäns'
});
/** Kolumntyp i rapportmodellen per mått (58-rapportmodell.js: rmCell). */
const MATT_TYP = Object.freeze({
    median: 'kr', medel: 'kr', n: 'antal', p10: 'kr', p25: 'kr', p75: 'kr', p90: 'kr', spridning: 'tal2', andelKv: 'pct1', gap: 'pct1'
});
const UPPREPNING = ['bas'];
const MAX_NAMN = 80;

let _nr = 0;
/** Ett nytt recept ur Utforskas spec. Namnet kortas till 80 tecken; utan namn får tabellen en beskrivning som namn.
 * @param {any} spec
 * @param {{namn?: string, upprepa?: string|null}} [val] */
function nyttRecept(spec, { namn = '', upprepa = null } = {}) {
    const r = valideraRecept({ id: `t${Date.now().toString(36)}${(++_nr).toString(36)}`, namn: String(namn || '').trim().slice(0, MAX_NAMN), spec, upprepa });
    if (r && !r.namn) r.namn = receptBeskrivning(r);
    return r;
}

/** Receptet i giltig form, eller null när det inte går att använda (okänd dimension eller okänt mått). */
function valideraRecept(r) {
    if (!r || typeof r !== 'object' || !r.spec || typeof r.spec !== 'object') return null;
    const s = r.spec;
    if (!DIMENSIONER.includes(s.rad)) return null;
    const kolumn = s.kolumn && s.kolumn !== s.rad && DIMENSIONER.includes(s.kolumn) ? s.kolumn : null;
    const matt = MATT.includes(s.matt) ? s.matt : 'median';
    const urval = s.urval && typeof s.urval === 'object' && Array.isArray(s.urval.villkor)
        ? { lage: s.urval.lage === 'nagot' ? 'nagot' : 'alla', villkor: s.urval.villkor.filter(v => v && typeof v === 'object').map(v => ({ ...v })) }
        : { lage: 'alla', villkor: [] };
    const gruppVillkor = Array.isArray(s.gruppVillkor) ? s.gruppVillkor.filter(g => g && typeof g === 'object').map(g => ({ ...g })) : [];
    return {
        id: typeof r.id === 'string' && r.id ? r.id.slice(0, 40) : `t${Date.now().toString(36)}`,
        namn: String(r.namn || '').trim().slice(0, MAX_NAMN),
        spec: { rad: s.rad, kolumn, matt, delaKon: !!s.delaKon, slaIhop: !!s.slaIhop, urval, gruppVillkor },
        upprepa: UPPREPNING.includes(r.upprepa) && r.upprepa !== s.rad && r.upprepa !== kolumn ? r.upprepa : null
    };
}

/** En rad som beskriver receptet: "Median månadslön per Yrkesgrupp (AID) och Kön, kvinnor och män var för sig, en tabell per BAS-intervall". */
function receptBeskrivning(r) {
    const s = r.spec;
    const delar = [`${MATT_ETIKETT[s.matt]} per ${DIM_ETIKETT[s.rad]}${s.kolumn ? ` och ${DIM_ETIKETT[s.kolumn]}` : ''}`];
    if (s.delaKon) delar.push('kvinnor och män var för sig');
    if (s.urval.villkor.length) delar.push(`${s.urval.villkor.length} ${s.urval.villkor.length === 1 ? 'villkor' : 'villkor'} i urvalet`);
    if (s.gruppVillkor.length) delar.push('gruppvillkor');
    if (r.upprepa) delar.push(`en tabell per ${DIM_ETIKETT[r.upprepa]}`);
    return delar.join(', ');
}

const _bas = rows => [...new Set(rows.map(r => String(r.bas ?? '')).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'sv'));
const _nText = c => `${c.n} (${c.nKv}/${c.nMa})`;

/**
 * Tabellerna ur ett recept, i rapportmodellens form: { rubrik, kolumner: [{rubrik, typ}], rader: [[...]], utelamnade, not }.
 * Flera tabeller när receptet upprepas per BAS-intervall. Tröskeln k tillämpas här.
 * @param {any[]} rows
 * @param {any} recept
 * @param {{k?: number}} [opt]
 * @returns {Array<{rubrik: string, kolumner: {rubrik: string, typ: string}[], rader: any[][], utelamnade: number, not: string}>}
 */
function receptTillTabeller(rows, recept, { k = 10 } = {}) {
    const r = valideraRecept(recept);
    if (!r) return [];
    const bygg = (rader, rubrik) => _tabell(computePivot(rader, r.spec, { k }), r.spec, k, rubrik);
    if (r.upprepa === 'bas') {
        return /** @type {any[]} */ (_bas(rows).map(b => bygg(rows.filter(x => String(x.bas) === b), `${r.namn} — BAS ${b}`)).filter(t => t && t.rader.length));
    }
    const t = bygg(rows, r.namn);
    return t && t.rader.length ? [t] : [];   // en tabell där ingen grupp når tröskeln utelämnas (anroparen anger det)
}

function _tabell(model, spec, k, rubrik) {
    if (!model || !model.celler.length) return null;
    const dim = DIM_ETIKETT[spec.rad], typ = MATT_TYP[spec.matt] || 'kr';
    let kolumner, rader, utelamnade = 0;
    if (spec.kolumn) {
        const byKey = new Map(model.celler.map(c => [c.rad + '\u0000' + c.kol, c]));
        const kol = (model.kolumnEtiketter || []).flatMap(kl => spec.delaKon
            ? [{ kl, rubrik: `${kl} · Kvinnor`, v: c => c.valueKv, n: c => c.nKv }, { kl, rubrik: `${kl} · Män`, v: c => c.valueMa, n: c => c.nMa }]
            : [{ kl, rubrik: kl, v: c => c.value, n: c => c.n }]);
        const liten = (c, d) => c.liten || d.n(c) < k;
        const varde = (c, d) => {
            if (!c) return null;
            if (spec.matt === 'n' && !c.liten) return d.n(c);                      // antal är inte ett lönemått
            if (liten(c, d) || (spec.matt === 'gap' && c.konLiten)) return null;
            return d.v(c);
        };
        const matris = model.radEtiketter.map(rk => kol.map(d => varde(byKey.get(rk + '\u0000' + d.kl), d)));
        const kolMed = kol.map((_, j) => matris.some(rad => rad[j] != null));
        const radMed = matris.map(rad => rad.some(v => v != null));
        utelamnade = radMed.filter(x => !x).length;
        kolumner = [{ rubrik: `${dim} \\ ${DIM_ETIKETT[spec.kolumn]}`, typ: 'text' }, ...kol.filter((_, j) => kolMed[j]).map(d => ({ rubrik: d.rubrik, typ }))];
        rader = model.radEtiketter.map((rk, i) => [rk, ...matris[i].filter((_, j) => kolMed[j])]).filter((_, i) => radMed[i]);
    } else if (spec.delaKon) {
        const synliga = model.celler.filter(c => !c.liten);
        utelamnade = model.celler.length - synliga.length;
        kolumner = [{ rubrik: dim, typ: 'text' }, { rubrik: 'Kvinnor', typ }, { rubrik: 'Män', typ }, { rubrik: 'n (K/M)', typ: 'text' }];
        const v = (c, n, x) => (spec.matt === 'n' || n >= k ? x : null);
        rader = synliga.map(c => [c.rad, v(c, c.nKv, c.valueKv), v(c, c.nMa, c.valueMa), _nText(c)]);
    } else {
        const synliga = model.celler.filter(c => !c.liten);
        utelamnade = model.celler.length - synliga.length;
        kolumner = [{ rubrik: dim, typ: 'text' }, { rubrik: MATT_ETIKETT[spec.matt], typ }, { rubrik: 'n (K/M)', typ: 'text' }];
        rader = synliga.map(c => [c.rad, spec.matt === 'gap' && c.konLiten ? null : c.value, _nText(c)]);
    }
    const noter = [];
    if (utelamnade) noter.push(`${utelamnade} ${utelamnade === 1 ? 'grupp' : 'grupper'} med färre än ${k} ${personOrd(k)} redovisas inte.`);
    if (model.dolda) noter.push(`${model.dolda} ${model.dolda === 1 ? 'grupp' : 'grupper'} döljs av gruppvillkoren.`);
    return { rubrik, kolumner, rader, utelamnade, not: noter.join(' ') };
}

    return { nyttRecept, valideraRecept, receptBeskrivning, receptTillTabeller };
})();
const _trNytt = __mirrorTabellrecept.nyttRecept;
const _trValidera = __mirrorTabellrecept.valideraRecept;
const _trBeskrivning = __mirrorTabellrecept.receptBeskrivning;
const _trTabeller = __mirrorTabellrecept.receptTillTabeller;

// ---- speglar src/lib/sakligaskal.js ----
const __mirrorSakligaskal = (() => {
// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
/**
 * Öppen lönekartläggning — sakliga skäl som strukturerad post.
 *
 * Handlingsplanen (56-handlingsplan.js) låter organisationen ange sakliga skäl per grupp: kategori, belopp i kronor
 * per månad av gruppens medianskillnad och en kort kommentar. Modulen är ren: kategorierna, valideringen av en lista
 * med skäl, sammanställningen för en rad (andel, summa, återstår) och summan per kategori över raderna. Andelarna är
 * organisationens bedömning; verktyget räknar bara ihop dem. Ingen DOM, inget state.
 *
 * Webbläsarbygget får en AUTO-GENERERAD spegel i src/app/09-lib-speglar.js.
 */

/** Kategorierna i fast ordning (rullistan, tabellerna och årsjämförelsen följer den). */
const SKAL_KATEGORIER = Object.freeze([
    Object.freeze({ id: 'marknad', namn: 'Marknad', forklaring: 'Svårrekryterade yrken eller konkurrens från andra arbetsgivare, som organisationen kan visa.' }),
    Object.freeze({ id: 'utbildning', namn: 'Utbildning', forklaring: 'Formell utbildning som har betydelse för arbetet, utöver den som krävs.' }),
    Object.freeze({ id: 'erfarenhet', namn: 'Erfarenhet', forklaring: 'Dokumenterad yrkeserfarenhet som har betydelse för arbetet, eller tid i arbetet.' }),
    Object.freeze({ id: 'prestation', namn: 'Prestation och resultat', forklaring: 'Bedömd prestation enligt organisationens lönekriterier.' }),
    Object.freeze({ id: 'overgang', namn: 'Övergång', forklaring: 'Lön som följt med vid byte av tjänst, omorganisation eller verksamhetsövergång.' }),
    Object.freeze({ id: 'annat', namn: 'Annat sakligt skäl', forklaring: 'Till exempel ansvar eller arbetsuppgifternas svårighet. Beskriv i kommentaren.' }),
]);

/** Gränserna för ett skäl: belopp i hela kronor per månad, kommentarens längd och antalet skäl per rad. */
const SKAL_GRANSER = Object.freeze({ maxBelopp: 200000, maxKommentar: 200, maxAntal: 8 });

/** @type {Map<string, string>} */
const _namn = new Map(SKAL_KATEGORIER.map(k => [k.id, k.namn]));

/** Kategorierna som en ny lista (appen bygger rullistan av den). */
function skalKategorier() {
    return SKAL_KATEGORIER.map(k => ({ ...k }));
}

/**
 * Prövar en lista med skäl. Ett skäl med okänd kategori, ett belopp som inte är ett heltal 0–200 000 eller en
 * kommentar som inte är text eller är längre än 200 tecken faller bort; av de giltiga står de åtta första kvar.
 * `bort` är antalet som föll bort (en lista som inte är en lista räknas som ett). Saknas fältet (null) är listan tom.
 * @param {any} lista
 * @returns {{skal: {kategori: string, belopp: number, kommentar: string}[], bort: number}}
 */
function valideraSkal(lista) {
    if (lista == null) return { skal: [], bort: 0 };
    if (!Array.isArray(lista)) return { skal: [], bort: 1 };
    const giltiga = [];
    let bort = 0;
    for (const s of lista) {
        const ok = s && typeof s === 'object' && _namn.has(s.kategori)
            && Number.isInteger(s.belopp) && s.belopp >= 0 && s.belopp <= SKAL_GRANSER.maxBelopp
            && (s.kommentar == null || (typeof s.kommentar === 'string' && s.kommentar.length <= SKAL_GRANSER.maxKommentar));
        if (ok) giltiga.push({ kategori: s.kategori, belopp: s.belopp, kommentar: s.kommentar || '' });
        else bort++;
    }
    bort += Math.max(0, giltiga.length - SKAL_GRANSER.maxAntal);
    return { skal: giltiga.slice(0, SKAL_GRANSER.maxAntal), bort };
}

/** En skillnad som andelar kan räknas mot: ett ändligt tal över 0, annars null. */
const _namnare = v => (typeof v === 'number' && isFinite(v) && v > 0 ? v : null);

/**
 * Sammanställningen för en rad: varje skäl med kategorins namn och andel av skillnaden, summan, den förklarade
 * andelen och det som återstår (aldrig under 0; `overstiger` när skälen är större än skillnaden). Utan en skillnad
 * över 0 (en egen rad, eller kvinnornas median högre) räknas inga andelar; skillnaden står kvar som den kom in.
 * @param {{kategori: string, belopp: number, kommentar?: string}[]|null|undefined} skal
 * @param {number|null} skillnadKr gruppens medianskillnad i kronor per månad
 */
function skalSammanstallning(skal, skillnadKr) {
    const lista = Array.isArray(skal) ? skal : [];
    const n = _namnare(skillnadKr);
    const rader = lista.map(s => ({ ...s, namn: _namn.get(s.kategori) || s.kategori, andel: n ? s.belopp / n : null }));
    const summa = lista.reduce((t, s) => t + s.belopp, 0);
    const aterstar = n ? Math.max(0, n - summa) : null;
    return {
        skal: rader, antal: rader.length, summa,
        skillnadKr: typeof skillnadKr === 'number' && isFinite(skillnadKr) ? skillnadKr : null,
        forklaradAndel: n ? summa / n : null,
        aterstar, aterstarAndel: n ? /** @type {number} */ (aterstar) / n : null,
        overstiger: n != null && summa > n,
    };
}

/**
 * Summan per kategori över raderna som har minst ett skäl. Andelen är kategorins belopp i rader med en skillnad över
 * 0 delat med den totala skillnaden i de raderna; en rad utan skillnad bidrar bara till summan. Kategorierna i
 * listans ordning, bara de som används. `antalGrupper` per kategori: rader med minst ett skäl i den.
 * @param {{skal: {kategori: string, belopp: number}[], skillnadKr: number|null}[]|null|undefined} rader
 */
function skalPerKategori(rader) {
    const med = (Array.isArray(rader) ? rader : []).filter(r => r && Array.isArray(r.skal) && r.skal.length);
    const per = new Map();
    let skillnad = 0, summa = 0, summaMedSkillnad = 0;
    for (const r of med) {
        const n = _namnare(r.skillnadKr);
        if (n) skillnad += n;
        const sett = new Set();
        for (const s of r.skal) {
            if (!per.has(s.kategori)) per.set(s.kategori, { summa: 0, medSkillnad: 0, iMed: 0, grupper: 0 });
            const k = per.get(s.kategori);
            k.summa += s.belopp; summa += s.belopp;
            if (n) { k.medSkillnad += s.belopp; k.iMed++; summaMedSkillnad += s.belopp; }
            if (!sett.has(s.kategori)) { sett.add(s.kategori); k.grupper++; }
        }
    }
    const kategorier = SKAL_KATEGORIER.filter(k => per.has(k.id)).map(k => {
        const p = per.get(k.id);
        // En kategori som bara finns i rader utan skillnad får ingen andel (inte 0 %).
        return { kategori: k.id, namn: k.namn, summa: p.summa, andel: skillnad > 0 && p.iMed ? p.medSkillnad / skillnad : null, antalGrupper: p.grupper };
    });
    return { kategorier, antalGrupper: med.length, skillnadKr: skillnad, summa, andel: skillnad > 0 ? summaMedSkillnad / skillnad : null };
}

    return { skalKategorier, valideraSkal, skalSammanstallning, skalPerKategori };
})();
const _sakKategorier = __mirrorSakligaskal.skalKategorier;
const _sakValidera = __mirrorSakligaskal.valideraSkal;
const _sakSammanstallning = __mirrorSakligaskal.skalSammanstallning;
const _sakPerKategori = __mirrorSakligaskal.skalPerKategori;

// ---- speglar src/lib/arsbokslut.js ----
const __mirrorArsbokslut = (() => {
    // importer ur tidigare speglade lib-moduler
    const median = __mirrorStat.median;
    const quantile = __mirrorStat.quantile;
    const skapaTermer = __mirrorTermer.skapaTermer;
    const valideraSkal = __mirrorSakligaskal.valideraSkal;
    const skalPerKategori = __mirrorSakligaskal.skalPerKategori;
    const skalSammanstallning = __mirrorSakligaskal.skalSammanstallning;
    const skalKategorier = __mirrorSakligaskal.skalKategorier;
    const aidAvYrke = __mirrorAid.aidAvYrke;

// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
// ---- Årsbokslut (ADR-54): jämförelse mellan år ----
// Ett k-skyddat sammandrag av årets kartläggning som konfigurationsfilen bär, så att nästa års kartläggning kan
// jämföras mot det. Bara aggregat: nyckeltal för hela organisationen, en rad per jämförbar grupp (AID-kod i
// BAS-intervall, ADR-89; båda könen minst k), en rad per BAS-intervall med minst k personer (basIntervall; könsmedianerna bara när båda könen når k)
// och Att göra-punkternas läge. Aldrig individer, aldrig lönedata. Modulen är ren: ingen DOM, inget state.
// Yrkesgruppernas och intervallens rader bär lönespridningen (P90 − P10) / median, räknad där n ≥ k (lonespridning).
// Version 2: handlingsplanens sakliga skäl per grupp (bedomningar: kategori och belopp, aldrig kommentarerna), så att
// jämförelsen kan visa fördelningen per kategori båda åren. Ett bokslut från version 1 läses som förut, utan skäl.





/** Standardtermerna (ADR-74); skapaTermer() utan egna termer ger standarduppsättningen. */
const T = skapaTermer();

const ARSBOKSLUT_VERSION = 2;
const MAX_TEXT = 200;
/** Den lägsta tröskel ett bokslut kan bära (samma som verktygets K_MIN): ett lägre k i filen höjs hit. */
const ARSBOKSLUT_K_MIN = 2;

const _tal = v => (typeof v === 'number' && isFinite(v) ? v : null);
const _heltal = (v, lo, hi) => (Number.isInteger(v) && v >= lo && v <= hi ? v : null);
const _text = v => (typeof v === 'string' ? v.trim().slice(0, MAX_TEXT) : '');
/** Lönespridningen i filen: ett ändligt tal ≥ 0, annars null (också när fältet saknas, som i en äldre fil). */
const _spridning = v => (typeof v === 'number' && isFinite(v) && v >= 0 ? v : null);

/**
 * Lönespridningen för en grupp: (P90 − P10) / median, avrundad till fyra decimaler. null när gruppen har färre än k
 * löner eller medianen inte är positiv. Kvantilerna som i resten av verktyget (linjär interpolation, typ 7).
 * @param {number[]} lon
 * @param {number} k
 */
function lonespridning(lon, k) {
    if (!Array.isArray(lon) || !lon.length || lon.length < k) return null;
    const med = median(lon);
    if (!(med > 0)) return null;
    return Math.round((quantile(lon, 0.9) - quantile(lon, 0.1)) / med * 1e4) / 1e4;
}

/**
 * Årsbokslutet i giltig form, eller null när det inte går att läsa. Yrkesgrupper där ett kön har färre än k
 * personer faller bort (de får inte bära könsuppdelade mått), och ett tal som inte är ändligt blir null.
 * @param {any} o
 */
function valideraArsbokslut(o) {
    if (!o || typeof o !== 'object' || Array.isArray(o)) return null;
    const ar = _heltal(o.ar, 2000, 2100);
    const kFil = _heltal(o.k, 1, 1000);
    const k = kFil == null ? null : Math.max(ARSBOKSLUT_K_MIN, kFil);
    const skapat = typeof o.skapat === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(o.skapat) ? o.skapat : null;
    if (ar == null || k == null || !skapat) return null;
    const n = o.nyckeltal && typeof o.nyckeltal === 'object' ? o.nyckeltal : {};
    const nKv = _heltal(n.nKv, 0, 10_000_000) ?? 0, nMa = _heltal(n.nMa, 0, 10_000_000) ?? 0;
    const konOk = nKv >= k && nMa >= k;
    const nyckeltal = {
        n: _heltal(n.n, 0, 10_000_000) ?? nKv + nMa, nKv, nMa,
        medKv: konOk ? _tal(n.medKv) : null, medMa: konOk ? _tal(n.medMa) : null,
        kvotPct: konOk ? _tal(n.kvotPct) : null,
        oforklaratPct: _tal(n.oforklaratPct),
        antalFlaggade: _heltal(n.antalFlaggade, 0, 1_000_000) ?? 0,
        antalKandidatpar: _heltal(n.antalKandidatpar, 0, 1_000_000) ?? 0,
        utelamnadePar: _heltal(n.utelamnadePar, 0, 1_000_000) ?? 0,
    };
    const grupper = (Array.isArray(o.grupper) ? o.grupper : []).map(g => {
        if (!g || typeof g !== 'object') return null;
        const yrke = _text(g.yrke); const gKv = _heltal(g.nKv, 0, 10_000_000), gMa = _heltal(g.nMa, 0, 10_000_000);
        if (!yrke || gKv == null || gMa == null || gKv < k || gMa < k) return null;
        // BAS-intervallet: en grupp är AID-koden i intervallet (ADR-89). Ett bokslut sparat innan dess saknar fältet och har
        // en rad per kod över alla intervall.
        const bas = _text(g.bas);
        return { yrke, ...(bas ? { bas } : {}), nKv: gKv, nMa: gMa, medKv: _tal(g.medKv), medMa: _tal(g.medMa), gapPct: _tal(g.gapPct), flaggad: g.flaggad === true,
            spridning: _spridning(g.spridning) };
    }).filter(Boolean);
    const punkter = (Array.isArray(o.punkter) ? o.punkter : []).map(p => {
        if (!p || typeof p !== 'object') return null;
        const id = _text(p.id); if (!id) return null;
        return { id, titel: _text(p.titel), kategori: _text(p.kategori), klar: p.klar === true };
    }).filter(Boolean);
    return { version: ARSBOKSLUT_VERSION, ar, skapat, k, verktyg: _text(o.verktyg), nyckeltal, grupper, punkter,
        basIntervall: _valideraBasIntervall(o.basIntervall, k), bedomningar: _valideraBedomningar(o.bedomningar, k) };
}

/**
 * Handlingsplanens sakliga skäl per grupp: nyckeln (samma som handlingsplanens rad), gruppen, antal berörda (n), den
 * minsta gruppen bakom skillnaden (nMin), gruppens medianskillnad i kr/mån och skälen med kategori och belopp
 * (kommentarerna sparas inte). En grupp med färre än k personer faller bort, skillnaden nollas när den minsta gruppen
 * bakom den är under k, och en post utan giltiga skäl faller bort. Fältet är valfritt: ett bokslut från version 1 får
 * null (inte en tom lista, som betyder att ingen grupp hade skäl).
 * @param {any} lista
 * @param {number} k
 */
function _valideraBedomningar(lista, k) {
    if (!Array.isArray(lista)) return null;
    const kategorier = new Set(skalKategorier().map(x => x.id));
    const sedda = new Set();
    return lista.map(b => {
        if (!b || typeof b !== 'object' || typeof b.nyckel !== 'string' || !b.nyckel || b.nyckel.length > 300) return null;
        if (sedda.has(b.nyckel)) return null;   // samma nyckel två gånger: den första gäller
        const n = _heltal(b.n, 0, 10_000_000), nMin = _heltal(b.nMin, 0, 10_000_000);
        if (n == null || n < k) return null;
        const overK = nMin != null && nMin >= k;
        // Under k i den minsta gruppen bakom skillnaden (ett kön under k) bär posten bara kategorierna: inga belopp.
        const skal = overK
            ? valideraSkal(Array.isArray(b.skal) ? b.skal.map(s => (s && typeof s === 'object' ? { kategori: s.kategori, belopp: s.belopp } : s)) : b.skal).skal
                .map(s => ({ kategori: s.kategori, belopp: s.belopp }))
            : [...new Set((Array.isArray(b.skal) ? b.skal : []).map(s => (s && typeof s === 'object' ? s.kategori : null)).filter(id => kategorier.has(id)))]
                .slice(0, 8).map(kategori => ({ kategori }));
        if (!skal.length) return null;
        sedda.add(b.nyckel);
        return { nyckel: b.nyckel, grupp: _text(b.grupp), n, nMin: nMin ?? 0, skillnadKr: overK ? _tal(b.skillnadKr) : null, skal };
    }).filter(Boolean);
}

/**
 * Löneläget per BAS-intervall: en rad per intervall med minst k personer. P10, median och P90 för hela intervallet;
 * kvinnors och mäns median bara när båda könen når k. Ett intervall under k faller bort helt. Fältet är valfritt:
 * ett bokslut från en äldre version saknar det och får null (inte en tom lista, som betyder att inget intervall
 * nådde k).
 * @param {any} lista
 * @param {number} k
 */
function _valideraBasIntervall(lista, k) {
    if (!Array.isArray(lista)) return null;
    return lista.map(r => {
        if (!r || typeof r !== 'object') return null;
        const bas = _text(r.bas).slice(0, 20);
        const nKv = _heltal(r.nKv, 0, 10_000_000) ?? 0, nMa = _heltal(r.nMa, 0, 10_000_000) ?? 0;
        const n = _heltal(r.n, 0, 10_000_000);
        if (!bas || n == null || n < k) return null;
        const konOk = nKv >= k && nMa >= k;
        return { bas, n, nKv, nMa, p10: _tal(r.p10), med: _tal(r.med), p90: _tal(r.p90),
            medKv: konOk ? _tal(r.medKv) : null, medMa: konOk ? _tal(r.medMa) : null, spridning: _spridning(r.spridning) };
    }).filter(Boolean);
}

/** Bygger ett årsbokslut ur delarna (samma form som valideraArsbokslut ger); null när delarna inte räcker. */
function byggArsbokslut({ ar, skapat, k, verktyg, nyckeltal, grupper, punkter, basIntervall, bedomningar }) {
    return valideraArsbokslut({ ar, skapat, k, verktyg, nyckeltal, grupper, punkter, basIntervall, bedomningar });
}

/** Måtten per BAS-intervall i jämförelsen: nyckel och etikett. Alla är kronor. */
const ARSBOKSLUT_BAS_MATT = Object.freeze([
    ['p10', 'P10'], ['med', 'Median'], ['p90', 'P90'], ['medKv', 'Median kvinnor'], ['medMa', 'Median män'],
]);

/** Ett mått båda åren: förra året, i år, skillnaden och skillnaden i procent av förra året (null när ett saknas). */
function _forandring(a, b) {
    const ok = typeof a === 'number' && typeof b === 'number';
    return { forra: a ?? null, nu: b ?? null, diff: ok ? b - a : null, pct: ok && a !== 0 ? (b - a) / a * 100 : null };
}

/**
 * Löneutvecklingen per BAS-intervall: en rad per intervall som finns något av åren (årets ordning först, sedan de
 * som bara fanns förra året), med antal och varje mått förra året, i år och förändringen i kronor och procent, och
 * lönespridningen förra året och i år med skillnaden (spridning; null ett år som saknar värdet, t.ex. en äldre fil).
 * null när ett av boksluten saknar fältet.
 */
function jamforBasIntervall(forra, nu) {
    if (!Array.isArray(forra) || !Array.isArray(nu)) return null;
    const fB = new Map(forra.map(r => [r.bas, r])), nB = new Map(nu.map(r => [r.bas, r]));
    const ordning = [...nB.keys(), ...[...fB.keys()].filter(b => !nB.has(b))];
    return ordning.map(bas => {
        const f = fB.get(bas) || null, n = nB.get(bas) || null;
        const rad = { bas, finnsForra: !!f, finnsNu: !!n, n: _forandring(f && f.n, n && n.n), nKv: _forandring(f && f.nKv, n && n.nKv), nMa: _forandring(f && f.nMa, n && n.nMa) };
        for (const [m] of ARSBOKSLUT_BAS_MATT) rad[m] = _forandring(f && f[m], n && n[m]);
        const { forra: sf, nu: sn, diff } = _forandring(f && f.spridning, n && n.spridning);
        rad.spridning = { forra: sf, nu: sn, diff };
        return rad;
    });
}

/** Nyckeltalens rader i jämförelsen: nyckel, etikett och typ (hur talet skrivs). */
const ARSBOKSLUT_NYCKELTAL = Object.freeze([
    ['n', 'Antal personer', 'antal'], ['nKv', 'Kvinnor', 'antal'], ['nMa', 'Män', 'antal'],
    ['medKv', 'Medianlön kvinnor', 'kr'], ['medMa', 'Medianlön män', 'kr'],
    ['kvotPct', 'Kvinnors medianlön i % av mäns', 'pct'], ['oforklaratPct', 'Oförklarad löneskillnad (regressionen, %)', 'pct'],
    ['antalFlaggade', `Flaggade ${T.enhet.fl} i Lika arbete`, 'antal'], ['antalKandidatpar', 'Kandidatpar i Likvärdigt arbete', 'antal'],
]);

/**
 * Förra årets bokslut med den gräns som gäller nu: filen kan ha sparats med en lägre tröskel än årets, och det som
 * jämförelsen visar lämnar verktyget med årets. Rader per BAS-intervall under gränsen faller bort, könsmedianer
 * nollas där ett kön är under den, yrkesgrupper där ett kön är under den faller bort, och nyckeltalens
 * könsuppdelade mått nollas på samma sätt.
 * @param {NonNullable<ReturnType<typeof valideraArsbokslut>>} b
 * @param {number} k
 */
function bokslutMedGrans(b, k) {
    if (!b || !(k > b.k)) return b;
    const n = b.nyckeltal, konOk = n.nKv >= k && n.nMa >= k;
    return { ...b, k,
        nyckeltal: { ...n, medKv: konOk ? n.medKv : null, medMa: konOk ? n.medMa : null, kvotPct: konOk ? n.kvotPct : null },
        grupper: b.grupper.filter(g => g.nKv >= k && g.nMa >= k),
        basIntervall: Array.isArray(b.basIntervall) ? _valideraBasIntervall(b.basIntervall, k) : b.basIntervall,
        bedomningar: Array.isArray(b.bedomningar) ? _valideraBedomningar(b.bedomningar, k) : (b.bedomningar ?? null) };
}

/**
 * Jämförelsen av de sakliga skälen: per kategori förra året och i år (belopp och andel av skillnaden i de grupper som
 * hade skäl, null ett år utan skäl i kategorin) med förändringen i kronor när kategorin finns båda åren; per grupp som
 * hade skäl båda åren skälen och skillnaden båda åren; och de grupper som hade skäl förra året men inte i år
 * (saknasIAr). null när ett av boksluten saknar fältet (version 1).
 * @param {any[]|null|undefined} forra
 * @param {any[]|null|undefined} nu
 */
function jamforBedomningar(forra, nu) {
    if (!Array.isArray(forra) || !Array.isArray(nu)) return null;
    // En post med bara kategorier (ett kön under k) ger inga belopp och räknas inte i summorna per kategori.
    const harBelopp = b => b.skal.every(s => typeof s.belopp === 'number');
    const pkF = skalPerKategori(forra.filter(harBelopp)), pkN = skalPerKategori(nu.filter(harBelopp));
    const namn = new Map(skalKategorier().map(x => [x.id, x.namn]));
    const fK = new Map(pkF.kategorier.map(k => [k.kategori, k])), nK = new Map(pkN.kategorier.map(k => [k.kategori, k]));
    const kategorier = skalKategorier().filter(k => fK.has(k.id) || nK.has(k.id)).map(k => {
        const f = fK.get(k.id), n = nK.get(k.id);
        return { kategori: k.id, namn: k.namn, forra: f ? { summa: f.summa, andel: f.andel } : null, nu: n ? { summa: n.summa, andel: n.andel } : null,
            diff: f && n ? n.summa - f.summa : null };
    });
    const ar = (b) => { if (!harBelopp(b)) return { skillnadKr: null, skal: b.skal.map(x => ({ kategori: x.kategori, namn: namn.get(x.kategori) || x.kategori, belopp: null, andel: null })) };
        const s = skalSammanstallning(b.skal, b.skillnadKr);
        return { skillnadKr: b.skillnadKr, skal: s.skal.map(x => ({ kategori: x.kategori, namn: x.namn, belopp: x.belopp, andel: x.andel })) }; };
    const nuMap = new Map(nu.map(b => [b.nyckel, b]));
    const grupper = forra.filter(b => nuMap.has(b.nyckel)).map(b => ({ nyckel: b.nyckel, grupp: nuMap.get(b.nyckel).grupp || b.grupp, forra: ar(b), nu: ar(nuMap.get(b.nyckel)) }));
    const saknasIAr = forra.filter(b => !nuMap.has(b.nyckel)).map(b => ({ nyckel: b.nyckel, grupp: b.grupp }));
    const tot = pk => ({ summa: pk.summa, andel: pk.andel, antalGrupper: pk.antalGrupper });
    return { kategorier, grupper, saknasIAr, totalt: { forra: tot(pkF), nu: tot(pkN) } };
}

/**
 * Jämför förra årets bokslut med årets: nyckeltal rad för rad, flaggade grupper (kvar, nya, borta; paras på
 * AID-koden och BAS-intervallet, och jämförs inte rad för rad mot ett bokslut från före ADR-89, ejJamforbara) och Att göra-punkter (vad som bockades av förra året, vilka av förra årets punkter som är klara nu). Båda
 * åren läses med den högre av årens trösklar (kGrans, bokslutMedGrans).
 * @param {ReturnType<typeof valideraArsbokslut>} forra
 * @param {ReturnType<typeof valideraArsbokslut>} nu
 */
function jamforArsbokslut(forra, nu) {
    if (!forra || !nu) return null;
    const kGrans = Math.max(forra.k, nu.k), sammaK = forra.k === nu.k;
    forra = bokslutMedGrans(forra, kGrans); nu = bokslutMedGrans(nu, kGrans);
    // Grupperna paras på AID-koden (aidAvYrke ur gruppens namn) och BAS-intervallet, inte på texten: en grupp är koden i
    // intervallet (ADR-89), och namnet är texten på flest av gruppens rader, som kan skilja sig mellan åren. Ett bokslut sparat
    // innan grupperna följde koden kan ha flera grupper med samma kod (en per text); då jämförs årets grupp med den som har
    // samma namn, annars med den största, och de andra står inte som egna rader.
    // Ett bokslut sparat innan grupperna delades per BAS-intervall har en rad per kod över alla intervall, utan fältet
    // bas. En sådan rad är inte samma grupp som årets rad för koden i ett intervall, och en median går inte att räkna om
    // från en nivå till en annan: grupperna jämförs då inte rad för rad (ejJamforbara), och resten av jämförelsen gäller.
    const ejJamforbara = forra.grupper.some(g => !g.bas) && nu.grupper.some(g => g.bas);
    // Antalet flaggade grupper räknades förut per kod över alla intervall: skillnaden mot ett sådant bokslut visas inte.
    const nyckeltal = ARSBOKSLUT_NYCKELTAL.map(([nyckel, etikett, typ]) => {
        const a = forra.nyckeltal[nyckel], b = nu.nyckeltal[nyckel];
        const jamforbar = !(ejJamforbara && nyckel === 'antalFlaggade');
        return { nyckel, etikett, typ, forra: a, nu: b, diff: jamforbar && typeof a === 'number' && typeof b === 'number' ? b - a : null };
    });
    const nyckelAv = g => (g.bas ? `${aidAvYrke(g.yrke)}|${g.bas}` : aidAvYrke(g.yrke));
    const nG = new Map(ejJamforbara ? [] : nu.grupper.map(g => [nyckelAv(g), g]));
    const fG = new Map();
    for (const g of ejJamforbara ? [] : forra.grupper) {
        const nyckel = nyckelAv(g), forr = fG.get(nyckel), namn = nG.has(nyckel) ? nG.get(nyckel).yrke : null;
        const foredras = forr && ((g.yrke === namn) !== (forr.yrke === namn) ? g.yrke === namn : g.nKv + g.nMa > forr.nKv + forr.nMa);
        if (!forr || foredras) fG.set(nyckel, g);
    }
    // Antalet är årets när gruppen finns i år, annars förra årets; antalAr säger vilket år antalet gäller. Namnet är årets
    // när gruppen finns i år.
    const rad = (f, n) => ({ yrke: n ? n.yrke : f.yrke, ...((n || f).bas ? { bas: (n || f).bas } : {}), gapForra: f ? f.gapPct : null, gapNu: n ? n.gapPct : null, nKv: n ? n.nKv : (f ? f.nKv : null), nMa: n ? n.nMa : (f ? f.nMa : null),
        antalAr: n ? nu.ar : forra.ar, spridningForra: f ? f.spridning ?? null : null, spridningNu: n ? n.spridning ?? null : null });
    const kvar = [], nya = [], borta = [];
    for (const [nyckel, n] of nG) { if (!n.flaggad) continue; const f = fG.get(nyckel); (f && f.flaggad ? kvar : nya).push(rad(f, n)); }
    for (const [nyckel, f] of fG) { if (!f.flaggad) continue; const n = nG.get(nyckel); if (!n || !n.flaggad) borta.push(rad(f, n)); }
    const sortera = l => l.sort((a, b) => Math.abs(b.gapNu ?? b.gapForra ?? 0) - Math.abs(a.gapNu ?? a.gapForra ?? 0));
    const nuKlar = new Map(nu.punkter.map(p => [p.id, p.klar]));
    const kvarFranForra = forra.punkter.filter(p => !p.klar).map(p => ({ ...p, finnsNu: nuKlar.has(p.id), klarNu: nuKlar.get(p.id) === true }));
    return {
        nyckeltal,
        grupper: { kvar: sortera(kvar), nya: sortera(nya), borta: sortera(borta), antalForra: ejJamforbara ? forra.grupper.length : fG.size,
            antalNu: ejJamforbara ? nu.grupper.length : nG.size, ejJamforbara },
        punkter: { totaltForra: forra.punkter.length, klaraForra: forra.punkter.filter(p => p.klar).length,
                   totaltNu: nu.punkter.length, klaraNu: nu.punkter.filter(p => p.klar).length, kvarFranForra },
        samma_k: sammaK,
        kGrans,
        basIntervall: jamforBasIntervall(forra.basIntervall, nu.basIntervall),
        bedomningar: jamforBedomningar(forra.bedomningar, nu.bedomningar),
    };
}

/**
 * Hantelns rader: en per yrkesgrupp som har ett gap båda åren, med kvinnors medianlön i procent av mäns förra året
 * (fore) och i år (efter), sorterade efter förändringens storlek. riktning: 'mot' när kvoten närmar sig 100,
 * 'fran' när den fjärmar sig, 'lika' när den inte ändrats. Grupper som saknar gap ett av åren (under tröskeln,
 * eller fanns inte) räknas i utelamnade.
 * @param {ReturnType<typeof jamforArsbokslut>} j
 */
function hantelRader(j) {
    if (!j) return { rader: [], utelamnade: 0 };
    const alla = [...j.grupper.kvar, ...j.grupper.nya, ...j.grupper.borta];
    const med = alla.filter(g => typeof g.gapForra === 'number' && typeof g.gapNu === 'number');
    const rader = med.map(g => {
        const fore = 100 + g.gapForra, efter = 100 + g.gapNu;
        const dFore = Math.abs(fore - 100), dEfter = Math.abs(efter - 100);
        const riktning = Math.abs(dEfter - dFore) < 0.05 ? 'lika' : dEfter < dFore ? 'mot' : 'fran';
        return { namn: g.bas ? `${g.yrke} (BAS ${g.bas})` : g.yrke, ...(g.bas ? { bas: g.bas } : {}), fore, efter, riktning, andring: efter - fore };
    }).sort((a, b) => Math.abs(b.andring) - Math.abs(a.andring));
    return { rader, utelamnade: alla.length - med.length };
}

/**
 * Hantelns rader för löneutvecklingen per BAS-intervall: medianlönen förra året (fore) och i år (efter), i
 * intervallens ordning. riktning: 'upp', 'ned' eller 'lika' (en förändring, ingen bedömning). Intervall som saknar
 * median ett av åren räknas i utelamnade.
 * @param {ReturnType<typeof jamforArsbokslut>} j
 */
function basHantelRader(j) {
    if (!j || !Array.isArray(j.basIntervall)) return { rader: [], utelamnade: 0 };
    const med = j.basIntervall.filter(r => typeof r.med.forra === 'number' && typeof r.med.nu === 'number');
    const rader = med.map(r => {
        const andring = r.med.nu - r.med.forra;
        return { namn: `BAS ${r.bas}`, bas: r.bas, fore: r.med.forra, efter: r.med.nu, andring, riktning: andring > 0 ? 'upp' : andring < 0 ? 'ned' : 'lika' };
    });
    return { rader, utelamnade: j.basIntervall.length - med.length };
}

    return { byggArsbokslut, valideraArsbokslut, jamforArsbokslut, hantelRader, basHantelRader, jamforBasIntervall, bokslutMedGrans, lonespridning, jamforBedomningar };
})();
const _abBygg = __mirrorArsbokslut.byggArsbokslut;
const _abValidera = __mirrorArsbokslut.valideraArsbokslut;
const _abJamfor = __mirrorArsbokslut.jamforArsbokslut;
const _abHantelRader = __mirrorArsbokslut.hantelRader;
const _abBasHantelRader = __mirrorArsbokslut.basHantelRader;
const _abJamforBas = __mirrorArsbokslut.jamforBasIntervall;
const _abMedGrans = __mirrorArsbokslut.bokslutMedGrans;
const _abSpridning = __mirrorArsbokslut.lonespridning;
const _abJamforBedomningar = __mirrorArsbokslut.jamforBedomningar;

// ---- speglar src/lib/installningsgranser.js ----
const __mirrorInstallningsgranser = (() => {
// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
/**
 * Öppen lönekartläggning — gränserna för inställningarna, på ett ställe.
 *
 * Samma gräns gäller på tre ställen: fältet i Inställningar (appen), konfigurationsfilen (appen, applyConfigSnapshot)
 * och organisationspaketet (src/lib/organisationspaket.js). Här står siffrorna, och de tre läser dem härifrån. Gränserna
 * är de som fälten redan använder (min/max i index.html och fältens tak i koden); en ny gräns hör inte hit utan till
 * fältet först.
 *
 * Appen når gränserna genom installningsGrans(nyckel): spegelns alias måste vara funktioner (tests/drift.test.js).
 *
 * Webbläsarbygget får en AUTO-GENERERAD spegel i src/app/09-lib-speglar.js.
 */

const MB = 1024 * 1024;

/** Högsta tillåtna filstorlek i byte, per filtyp. Organisationspaketet är samma gräns som förut (5 MB). */
const FIL_MAX = Object.freeze({
    lonefil: 50 * MB,
    stallningstagande: 20 * MB,
    jamforelsestatistik: 20 * MB,
    konfiguration: 5 * MB,
    paket: 5 * MB
});

/** Påslaget för PO (arbetsgivaravgifter och pension) i procent: fältet i Inställningar och konfigurationen. */
const PO_PCT_GRANS = Object.freeze({ min: 0, max: 100 });

/** Beräkningsperioden i månader (fältet i Inställningar tar värdena 3, 6, 9 och 12; gränsen gäller konfigurationen). */
const MANADER_GRANS = Object.freeze({ min: 1, max: 60 });

/** Prioriteringens trösklar, per fältnamn i prioConfig (fälten prio-cfg-* i Inställningar). */
const PRIO_TROSKEL_GRANS = Object.freeze({
    atgardThreshold:    Object.freeze({ min: -50, max: 0 }),
    akutMinN:           Object.freeze({ min: 1, max: 500 }),
    bevakaThreshold:    Object.freeze({ min: -50, max: 0 }),
    analyseraThreshold: Object.freeze({ min: 0, max: 50 })
});

/** Prioriteringens viktning, per fältnamn i prioWeights (fälten prio-w-* i Inställningar). */
const PRIO_VIKT_GRANS = Object.freeze({
    avvikelse:    Object.freeze({ min: 0, max: 100 }),
    volym:        Object.freeze({ min: 0, max: 100 }),
    jamstalldhet: Object.freeze({ min: 0, max: 100 })
});

/** @typedef {{min:number, max:number}} Grans */
/** @type {Readonly<{poPct: Grans, manader: Grans, prioTroskel: Readonly<Record<string, Grans>>, prioVikt: Readonly<Record<string, Grans>>, fil: Readonly<Record<string, number>>}>} */
const _GRANSER = Object.freeze({
    poPct: PO_PCT_GRANS,
    manader: MANADER_GRANS,
    prioTroskel: PRIO_TROSKEL_GRANS,
    prioVikt: PRIO_VIKT_GRANS,
    fil: FIL_MAX
});

/**
 * Gränsen (eller gränserna per fältnamn) för en inställning: 'poPct', 'manader', 'prioTroskel', 'prioVikt' eller
 * 'fil' (högsta filstorlek per filtyp, i byte).
 * @template {keyof typeof _GRANSER} K
 * @param {K} nyckel
 * @returns {(typeof _GRANSER)[K]}
 */
function installningsGrans(nyckel) {
    if (!Object.prototype.hasOwnProperty.call(_GRANSER, nyckel)) throw new Error(`Okänd inställning: ${nyckel}`);
    return _GRANSER[nyckel];
}

/**
 * Ligger ett värde inom sin gräns? Ett värde som inte är ett ändligt tal ligger utanför.
 * @param {unknown} varde
 * @param {{min:number, max:number}} grans
 * @returns {boolean}
 */
function arInomGrans(varde, grans) {
    return typeof varde === 'number' && Number.isFinite(varde) && varde >= grans.min && varde <= grans.max;
}

/** Hur filtypen heter i meddelandet om att den är för stor. */
const _FIL_NAMN = Object.freeze({
    lonefil: 'Lönefilen',
    stallningstagande: 'Filen med ställningstagandet',
    jamforelsestatistik: 'Filen med jämförelsestatistiken',
    konfiguration: 'Konfigurationsfilen'
});

/**
 * Felmeddelandet för en fil som är för stor, eller null när filen får läsas in. Prövas på filens storlek (byte) innan
 * filen läses; en okänd storlek (NaN, undefined) räknas inte som för stor.
 * @param {number} storlek - filens storlek i byte (File.size)
 * @param {keyof typeof _FIL_NAMN} typ
 * @returns {string | null}
 */
function filStorlekFel(storlek, typ) {
    const grans = FIL_MAX[typ];
    if (!(storlek > grans)) return null;
    return `${_FIL_NAMN[typ]} är för stor för att läsas in (högst ${grans / MB} MB).`;
}

    return { installningsGrans, arInomGrans, filStorlekFel };
})();
const _igGrans = __mirrorInstallningsgranser.installningsGrans;
const _igInomGrans = __mirrorInstallningsgranser.arInomGrans;
const _igFilFel = __mirrorInstallningsgranser.filStorlekFel;

// ---- speglar src/lib/organisationspaket.js ----
const __mirrorOrganisationspaket = (() => {
    // importer ur tidigare speglade lib-moduler
    const valideraRecept = __mirrorTabellrecept.valideraRecept;
    const valideraPerBasRecept = __mirrorPerBas.valideraPerBasRecept;
    const perBasReceptArStandard = __mirrorPerBas.perBasReceptArStandard;
    const valideraImportprofiler = __mirrorImportprofiler.valideraImportprofiler;
    const skapaTermer = __mirrorTermer.skapaTermer;
    const installningsGrans = __mirrorInstallningsgranser.installningsGrans;

// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
/**
 * Öppen lönekartläggning — organisationspaket (ADR-28).
 *
 * En systemägare samlar organisationens namn och benämningar, grundinställningar,
 * lönepolitiska ställningstagande och jämförelsestatistik i en JSON-fil som handläggarna
 * läser in i ett steg. Modulen bygger paketet ur appens delar och tolkar ett paket
 * tillbaka till dem. Bara vitlistade fält följer med; allt annat ignoreras, så att en
 * manipulerad fil inte kan föra in något annat än aggregat i verktyget.
 *
 * Webbläsarbygget får en AUTO-GENERERAD spegel i src/app/09-lib-speglar.js.
 */






/** Standardtermerna (ADR-74); skapaTermer() utan egna termer ger standarduppsättningen. */
const T = skapaTermer();


const PAKET_FORMAT = 'lonekartlaggning-organisationspaket';
const PAKET_VERSION = 1;
const PAKET_MAX_BYTE = installningsGrans('fil').paket;   // gränsen bor i installningsgranser.js

const MAX_TEXT = 200;
const PNR = /\b(19|20)?\d{6}[-+]?\d{4}\b/;
const EPOST = /\S+@\S+\.\S+/;

/** Liknar texten ett personnummer eller en e-postadress? (Samma mönster som paketkontrollen.) */
function liknarPersonuppgift(text) {
    const t = String(text ?? '');
    return PNR.test(t) || EPOST.test(t);
}

// Textfält saneras vid inläsning: HTML-metatecken (< > " ' &) tas bort, texten trimmas och kortas
// till 200 tecken. Fälten är benämningar och koder som aldrig legitimt innehåller tecknen; esc() vid
// rendering är det egentliga skyddet, detta är ett extra lager på samma sätt som för lönefilen.
const _text = v => {
    if (typeof v !== 'string') return undefined;
    const t = v.replace(/[<>"'&]/g, '').trim();
    return t ? t.substring(0, MAX_TEXT) : undefined;
};
const _tal = (v, min, max) => (typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max ? v : undefined);
const _talEllerNull = v => (v == null ? null : (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : NaN));
const _utanTomma = o => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined));
// Minsta gruppstorlek för redovisning (ADR-38): heltal 2–1000, annars utelämnat.
const _kTroskel = v => (Number.isInteger(v) && v >= 2 && v <= 1000 ? v : undefined);
// Beräkningsperioden väljs bland verktygets värden (Prioriteringens rullista).
const PERIODER = [3, 6, 9, 12];
const _period = v => (PERIODER.includes(v) ? v : undefined);
// Låsningar som systemägaren kan sätta (ADR-47). Rensning vid inaktivitet: 0 (av) eller 5–120 minuter.
const INAKTIVITET_MIN = 5;
const INAKTIVITET_MAX = 120;
const _inaktivitet = v => (v === 0 || (Number.isInteger(v) && v >= INAKTIVITET_MIN && v <= INAKTIVITET_MAX) ? v : undefined);

// ---- Rader ----

function _referensRad(r) {
    if (!r || typeof r !== 'object') return null;
    const bas = _text(r.bas)?.toUpperCase() ?? null;
    const aid = _text(r.aid) ?? null;
    if (!bas && !aid) return null;
    const p10 = _talEllerNull(r.p10), med = _talEllerNull(r.med), p90 = _talEllerNull(r.p90);
    if ([p10, med, p90].some(Number.isNaN)) return null;
    return { aid, bas, p10, med, p90 };
}

function _statistikRad(r) {
    if (!r || typeof r !== 'object') return null;
    const aid = _text(r.aid);
    const median = _tal(r.median, Number.MIN_VALUE, Infinity);
    if (!aid || median === undefined) return null;
    const p10 = r.p10 == null ? 0 : _tal(r.p10, 0, Infinity);
    const p90 = r.p90 == null ? 0 : _tal(r.p90, 0, Infinity);
    const nKv = _talEllerNull(r.nKv), nMa = _talEllerNull(r.nMa);
    const andelKv = r.andelKv == null ? null : _tal(r.andelKv, 0, 100);
    if (p10 === undefined || p90 === undefined || Number.isNaN(nKv) || Number.isNaN(nMa) || andelKv === undefined) return null;
    return { aid, aidFull: _text(r.aidFull) ?? aid, bas: typeof r.bas === 'string' ? r.bas.trim().toUpperCase().substring(0, 10) : '',
             median, p10, p90, nKv, nMa, andelKv };
}

// Organisationstypen styr vilken del av SKR:s personalstatistik som är referens (ADR-34).
function _orgTyp(v) {
    return v === 'kommun' || v === 'region' ? v : undefined;
}
/** Jämförelsemängden i likvärdigt arbete (ADR-60): 'alla' som inte är kvinnodominerade eller 'mansdominerade'. */
function _jamforelse(v) {
    return v === 'alla' || v === 'mansdominerade' ? v : undefined;
}

// ---- Bygga ----

/**
 * Bygger ett paket ur appens delar. Tomma delar utelämnas.
 * @param {{organisation:string, utgivare?:string, skapat:string, avserAr?:number,
 *          profil?:Object, installningar?:Object, referens?:Object|null, statistik?:Object|null, rapport?:Object|null,
 *          importprofiler?:Object[]}} u
 * @returns {Object} JSON-säkert paket
 */
function byggPaket(u) {
    const p = u.profil || {}, inst = u.installningar || {};
    /** @type {{[k:string]:any}} */
    const paket = {
        format: PAKET_FORMAT,
        version: PAKET_VERSION,
        organisation: { namn: _text(u.organisation) },
        ..._utanTomma({ utgivare: _text(u.utgivare), skapat: _text(u.skapat), avserAr: _tal(u.avserAr, 2000, 2100) }),
        profil: _utanTomma({
            jamforelseNamn: _text(p.benchmarkLabel), jamforelseGenitiv: _text(p.benchmarkLabelGenitive),
            jamforelseKort: _text(p.benchmarkShort), basSystem: _text(p.basSystem), aidSystem: _text(p.aidSystem),
            organisationstyp: _orgTyp(p.orgTyp),
        }),
        installningar: _utanTomma({
            poPct: _tal(inst.poPct, installningsGrans('poPct').min, installningsGrans('poPct').max), poNot: _text(inst.poNot), manader: _period(inst.months), kTroskel: _kTroskel(inst.kTroskel),
            // Låsningarna (ADR-47): bara giltiga värden följer med; en låsning av rensningstiden kräver ett värde över 0.
            kTroskelLagst: _kTroskel(inst.kTroskelLagst),
            inaktivitetMin: _inaktivitet(inst.inaktivitetMin),
            inaktivitetLast: inst.inaktivitetLast === true && _inaktivitet(inst.inaktivitetMin) > 0 ? true : undefined,
            smaGrupperIExport: inst.smaGrupperIExport === false ? false : undefined,
            jamforelse: _jamforelse(inst.jamforelse),
        }),
    };
    // Rapportens recept (ADR-52): egna tabeller ur Utforska och receptet för avsnittet per BAS-intervall. Bara
    // giltiga recept följer med, och standardreceptet per BAS utelämnas (det gäller ändå).
    const rapport = _rapport(u.rapport, null);
    if (rapport) paket.rapport = rapport;
    // Importprofilerna: bara rubriknamn (src/lib/importprofiler.js). Källan följer inte med; den sätts vid inläsningen.
    const profiler = valideraImportprofiler(u.importprofiler || []).profiler
        .map(p => ({ id: p.id, namn: p.namn, rubriker: p.rubriker, kannetecken: p.kannetecken }));
    if (profiler.length) paket.importprofiler = profiler;
    const refRader = (u.referens?.rader || []).map(_referensRad).filter(Boolean);
    if (refRader.length) paket.referens = { ..._utanTomma({ namn: _text(u.referens.namn), kortnamn: _text(u.referens.kortnamn) }), rader: refRader };
    const statRader = (u.statistik?.rader || []).map(_statistikRad).filter(Boolean);
    if (statRader.length) paket.statistik = { ..._utanTomma({ namn: _text(u.statistik.namn) }), rader: statRader };
    return paket;
}

/**
 * Rapportens recept i giltig form, eller null när inget finns. Ogiltiga tabellrecept faller bort (med en varning
 * när `varningar` ges); receptet per BAS normaliseras, och standardreceptet blir null.
 * @param {any} rp
 * @param {string[]|null} varningar
 */
function _rapport(rp, varningar) {
    if (!rp || typeof rp !== 'object') return null;
    const in_ = Array.isArray(rp.tabeller) ? rp.tabeller : [];
    const tabeller = in_.map(t => valideraRecept(t)).filter(Boolean);
    if (varningar && tabeller.length < in_.length) {
        const n = in_.length - tabeller.length;
        varningar.push(`${n} ${n === 1 ? 'egen tabell' : 'egna tabeller'} i paketet gick inte att läsa och hoppas över.`);
    }
    let perBasRecept = rp.perBasRecept && typeof rp.perBasRecept === 'object' ? valideraPerBasRecept(rp.perBasRecept) : null;
    if (perBasRecept && perBasReceptArStandard(perBasRecept)) perBasRecept = null;
    if (!tabeller.length && !perBasRecept) return null;
    return { tabeller, ...(perBasRecept ? { perBasRecept } : {}) };
}

/**
 * Paketets importprofiler, med källan organisationspaketet. Fältet är valfritt: ett äldre paket utan det ger en tom
 * lista. Ogiltiga profiler hoppas över med en varning; fler än 50 läses inte alls.
 * @param {any} lista
 * @param {string[]} varningar
 */
function _importprofiler(lista, varningar) {
    if (lista == null) return [];
    const r = valideraImportprofiler(lista, { kalla: 'organisationspaket' });
    if (r.fel) { varningar.push(`Paketets importprofiler läses inte in: ${r.fel}`); return []; }
    if (r.bort) varningar.push(`${r.bort} ${r.bort === 1 ? 'importprofil' : 'importprofiler'} i paketet gick inte att läsa och hoppas över.`);
    return r.profiler;
}

// ---- Tolka ----

// Alla textvärden i paketet, för kontrollen av personuppgifter.
function _allaTexter(v, ut = []) {
    if (typeof v === 'string') ut.push(v);
    else if (Array.isArray(v)) v.forEach(x => _allaTexter(x, ut));
    else if (v && typeof v === 'object') Object.keys(v).forEach(k => _allaTexter(v[k], ut));
    return ut;
}

/**
 * Låsningarna i installningar (ADR-47), normaliserade. Ett ogiltigt värde utelämnas med en varning, så att ett
 * paket aldrig tyst låser något annat än det systemägaren skrev. Rensningstiden kan inte låsas i läget Av (0).
 */
function _lasningar(inst, varningar) {
    const ut = {};
    if (inst.kTroskelLagst != null) {
        const n = _kTroskel(inst.kTroskelLagst);
        if (n === undefined) varningar.push('Paketets lägsta tillåtna minsta gruppstorlek är ogiltig och används inte.');
        else ut.kTroskelLagst = n;
    }
    if (inst.inaktivitetMin != null) {
        const n = _inaktivitet(inst.inaktivitetMin);
        if (n === undefined) varningar.push(`Paketets tid för rensning vid inaktivitet är ogiltig (0 eller ${INAKTIVITET_MIN}–${INAKTIVITET_MAX} minuter) och används inte.`);
        else ut.inaktivitetMin = n;
    }
    if (inst.inaktivitetLast != null) {
        if (typeof inst.inaktivitetLast !== 'boolean') varningar.push('Paketets låsning av rensning vid inaktivitet är ogiltig och används inte.');
        else if (inst.inaktivitetLast) {
            if (ut.inaktivitetMin === undefined) varningar.push('Paketet låser rensning vid inaktivitet utan ett giltigt värde; låsningen används inte.');
            else if (ut.inaktivitetMin === 0) varningar.push('Rensning vid inaktivitet kan inte låsas i läget Av; låsningen används inte.');
            else ut.inaktivitetLast = true;
        }
    }
    if (inst.smaGrupperIExport != null) {
        if (typeof inst.smaGrupperIExport !== 'boolean') varningar.push('Paketets fält om små grupper i exporten är ogiltigt och används inte.');
        else ut.smaGrupperIExport = inst.smaGrupperIExport;
    }
    return ut;
}

function _rader(del, radFn, benamning, varningar) {
    if (!del || typeof del !== 'object' || !Array.isArray(del.rader)) return null;
    const rader = del.rader.map(radFn).filter(Boolean);
    const bort = del.rader.length - rader.length;
    if (bort) varningar.push(`${bort} ${bort === 1 ? 'rad' : 'rader'} i ${benamning} hoppades över (saknade eller ogiltiga värden).`);
    return rader.length ? rader : null;
}

/**
 * Tolkar ett paket (filens text) till appens delar.
 * @param {string} text
 * @returns {{ok:true, paket:Object, delar:Object, varningar:string[]} | {ok:false, fel:string}}
 */
function tolkaPaket(text) {
    if (typeof text !== 'string') return { ok: false, fel: 'Filen kunde inte läsas.' };
    if (text.length > PAKET_MAX_BYTE) return { ok: false, fel: 'Filen är för stor för att vara ett organisationspaket (högst 5 MB).' };
    let o;
    try { o = JSON.parse(text); } catch (_e) { return { ok: false, fel: 'Filen är inte ett organisationspaket (den går inte att läsa som JSON). Be systemägaren om en ny fil.' }; }
    if (!o || typeof o !== 'object' || Array.isArray(o)) return { ok: false, fel: 'Filen är inte ett organisationspaket.' };

    if (o.format !== PAKET_FORMAT) return { ok: false, fel: 'Filen är inte ett organisationspaket för lönekartläggning.' };
    if (typeof o.version !== 'number' || o.version > PAKET_VERSION) {
        return { ok: false, fel: `Paketet har version ${o.version}; verktyget läser version ${PAKET_VERSION}. Uppdatera verktyget.` };
    }
    const organisation = _text(o.organisation?.namn);
    if (!organisation) return { ok: false, fel: 'Paketet saknar organisationens namn (organisation.namn).' };
    const skapat = _text(o.skapat);
    if (!skapat || !/^\d{4}-\d{2}-\d{2}$/.test(skapat)) return { ok: false, fel: 'Paketet saknar datum (fältet skapat, ÅÅÅÅ-MM-DD). Be systemägaren om en ny fil.' };
    if (_allaTexter(o).some(t => PNR.test(t) || EPOST.test(t))) {
        return { ok: false, fel: 'Paketet innehåller något som liknar personnummer eller e-post och läses inte in.' };
    }

    const varningar = [];
    const refRader = _rader(o.referens, _referensRad, 'ställningstagandet', varningar);
    const statRader = _rader(o.statistik, _statistikRad, 'jämförelsestatistiken', varningar);
    if (!refRader && !statRader) return { ok: false, fel: 'Paketet innehåller varken ett lönepolitiskt ställningstagande eller jämförelsestatistik.' };
    if (!refRader) varningar.push('Paketet innehåller inget lönepolitiskt ställningstagande.');
    if (!statRader) varningar.push('Paketet innehåller ingen jämförelsestatistik.');

    const p = o.profil && typeof o.profil === 'object' ? o.profil : {};
    const inst = o.installningar && typeof o.installningar === 'object' ? o.installningar : {};
    if (inst.kTroskel != null && _kTroskel(inst.kTroskel) === undefined) varningar.push('Paketets minsta gruppstorlek är ogiltig och används inte.');
    const las = _lasningar(inst, varningar);
    if (inst.jamforelse != null && _jamforelse(inst.jamforelse) === undefined)
        varningar.push(`Paketets val av ${T.jamforelse.fl} i likvärdigt arbete är ogiltigt ("alla" eller "mansdominerade") och används inte.`);
    // Paketets egen tröskel får inte ligga under paketets golv: den höjs till golvet, med en varning.
    let kTroskel = _kTroskel(inst.kTroskel);
    if (kTroskel !== undefined && las.kTroskelLagst !== undefined && kTroskel < las.kTroskelLagst) {
        varningar.push(`Paketets minsta gruppstorlek ${kTroskel} är lägre än dess lägsta tillåtna ${las.kTroskelLagst} och höjs till ${las.kTroskelLagst}.`);
        kTroskel = las.kTroskelLagst;
    }
    return {
        ok: true,
        paket: _utanTomma({ organisation, utgivare: _text(o.utgivare), skapat, avserAr: _tal(o.avserAr, 2000, 2100) }),
        delar: {
            profil: _utanTomma({ name: organisation, benchmarkLabel: _text(p.jamforelseNamn),
                benchmarkLabelGenitive: _text(p.jamforelseGenitiv), benchmarkShort: _text(p.jamforelseKort),
                basSystem: _text(p.basSystem), aidSystem: _text(p.aidSystem), orgTyp: _orgTyp(p.organisationstyp) }),
            installningar: _utanTomma({ poPct: _tal(inst.poPct, installningsGrans('poPct').min, installningsGrans('poPct').max), poNot: _text(inst.poNot), months: _period(inst.manader), kTroskel, ...las,
                jamforelse: _jamforelse(inst.jamforelse) }),
            referens: refRader ? { ..._utanTomma({ namn: _text(o.referens.namn), kortnamn: _text(o.referens.kortnamn) }), rader: refRader } : null,
            statistik: statRader ? { ..._utanTomma({ namn: _text(o.statistik.namn) }), rader: statRader } : null,
            rapport: _rapport(o.rapport, varningar),
            importprofiler: _importprofiler(o.importprofiler, varningar),
        },
        varningar,
    };
}

    return { byggPaket, tolkaPaket, liknarPersonuppgift };
})();
const _opByggPaket = __mirrorOrganisationspaket.byggPaket;
const _opTolkaPaket = __mirrorOrganisationspaket.tolkaPaket;
const _opLiknarPersonuppgift = __mirrorOrganisationspaket.liknarPersonuppgift;

// ---- speglar src/lib/figur.js ----
const __mirrorFigur = (() => {
    // importer ur tidigare speglade lib-moduler
    const quantile = __mirrorStat.quantile;
    const avrundaSymmetriskt = __mirrorStat.avrundaSymmetriskt;
    const arKvinna = __mirrorKon.arKvinna;
    const arMan = __mirrorKon.arMan;

// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
/**
 * Öppen lönekartläggning — Figurformatet (ADR-39; se docs/utveckling/diagramkarnan.md)
 *
 * En figur är ren data som beskriver ett diagram: axlar, lager av märken och referenser.
 * Vyerna bygger figurer; ritaren (src/app/10-diagramlayout.js, 10-diagrammarken.js, 10-diagramritare.js) gör SVG av dem. Här ligger
 * allt som går att avgöra utan DOM och utan D3: validering, små grupper, domäner,
 * lådstatistik och talformat. Modulen vet ingenting om state, flikar eller k-tröskelns värde.
 *
 * Läge anges alltid i skärmens axlar: x är vågrät, y lodrät. En liggande stapel har alltså
 * kategorin i y och värdet i x. Kategorier på en bandskala jämförs som strängar.
 *
 * Formatet som det är byggt — alla val, vad vyn själv måste göra för att små grupper ska vara skyddade, och
 * kända luckor — står i docs/utveckling/diagramkarnan.md.
 *
 * Webbläsarbygget får en AUTO-GENERERAD spegel i src/app/09-lib-speglar.js.
 */


const MARKEN = ['stapel', 'intervall', 'punkt', 'linje', 'band', 'lada', 'ruta', 'yta'];
const SKALOR = ['band', 'linjar', 'log'];

const _nf = new Map();
function _tal(dec) {
    if (!_nf.has(dec)) _nf.set(dec, new Intl.NumberFormat('sv-SE', { minimumFractionDigits: dec, maximumFractionDigits: dec }));
    return _nf.get(dec);
}

/**
 * Tal som text med svensk lokal. Namngivna format i stället för formatsträngar i vyerna.
 * @param {number|null|undefined} v  annat än ett ändligt tal ger '–'
 * @param {'kr'|'pct'|'pctAbs'|'antal'|'tal2'|'ar'|undefined} namn  pctAbs: procent utan tecken (axeln i en
 *   divergerande stapel, där vänster och höger båda är andelar)
 * @param {{enhet?: boolean}} [val] enhet: false utelämnar " kr" och " %" (axelmarkeringar)
 */
function talformat(v, namn, val) {
    const enhet = !val || val.enhet !== false;
    if (typeof v !== 'number' || !isFinite(v)) return '–';
    // Avrunda först (halvorna bort från noll, så att ett tal och dess motsatta tal får samma siffror) och normalisera
    // sedan: ett värde som blir noll i formatet får inget minustecken.
    const rund = avrundaSymmetriskt;
    if (namn === 'kr') return _tal(0).format(rund(v, 0)) + (enhet ? ' kr' : '');
    if (namn === 'pct') return _tal(1).format(rund(v, 1)) + (enhet ? ' %' : '');
    if (namn === 'pctAbs') { const a = Math.abs(rund(v, 1)); return _tal(Number.isInteger(a) ? 0 : 1).format(a) + (enhet ? ' %' : ''); }
    if (namn === 'tal2') return _tal(2).format(rund(v, 2));
    if (namn === 'antal' || namn === 'ar') return _tal(0).format(rund(v, 0));
    return _tal(Number.isInteger(v) ? 0 : 1).format(rund(v, Number.isInteger(v) ? 0 : 1));
}

/**
 * Kvantilpunkterna i ett kvantilpunktdiagram (lada med form: 'kvantiler'): `antal` lika
 * stora andelar av gruppen, var och en företrädd av kvantilen i sin mitt, (i + 0,5) / antal, med samma
 * interpolation som stat.quantile. Antalet är högst `antalMax` och högst halva gruppen, så att en prick aldrig
 * står för färre än två personer. null när gruppen har färre än två värden.
 * @param {number[]} varden
 * @param {number} [antalMax]
 * @returns {{antal: number, varden: number[]}|null}
 */
function kvantilpunkter(varden, antalMax = 20) {
    const v = (varden || []).filter(x => typeof x === 'number' && isFinite(x)).sort((a, b) => a - b);
    const antal = Math.min(antalMax, Math.floor(v.length / 2));
    if (antal < 1) return null;
    const q = p => { const pos = (v.length - 1) * p, lo = Math.floor(pos), hi = Math.ceil(pos); return lo === hi ? v[lo] : v[lo] + (v[hi] - v[lo]) * (pos - lo); };
    return { antal, varden: Array.from({ length: antal }, (_, i) => q((i + 0.5) / antal)) };
}

/**
 * Skillnaden mellan kvinnors och mäns medianlön i kronor per månad, avrundad till närmaste hundratal: negativ när
 * kvinnorna ligger lägre (verktygets tecken). Ett lönegap förstås bättre i pengar än bara i procent.
 * null när någon median saknas. Anroparen skickar bara medianer som får redovisas (båda könen når tröskeln).
 * @param {number|null|undefined} medKv
 * @param {number|null|undefined} medMa
 * @returns {number|null}
 */
function kronorSkillnad(medKv, medMa) {
    if (typeof medKv !== 'number' || typeof medMa !== 'number' || !isFinite(medKv) || !isFinite(medMa) || !(medMa > 0) || !(medKv > 0)) return null;
    const r = avrundaSymmetriskt((medKv - medMa) / 100) * 100;
    return r === 0 ? 0 : r;
}

/** Verktygstipsets rad för skillnaden i kronor, eller ingen rad när beloppet saknas. */
function kronorTipsRad(skillnadKr) {
    if (typeof skillnadKr !== 'number' || !isFinite(skillnadKr)) return [];
    const t = talformat(Math.abs(skillnadKr), 'kr', { enhet: false });
    return [['Skillnad', `${skillnadKr < 0 ? '−' : skillnadKr > 0 ? '+' : ''}${t} kr/mån`]];
}

// Vilka fält i en datapunkt som ligger på skärmaxeln a ('x' | 'y') för lagret l.
function _falt(l, a) {
    const liggande = l.riktning === 'liggande';
    if (l.marke === 'band') return a === 'x' ? ['x'] : ['lag', 'hog'];
    if (l.marke === 'yta') return a === 'x' ? ['x0', 'x1'] : ['y0', 'y1'];   // fria ytor (trädkarta): två hörn på talaxlar
    if (l.marke === 'intervall') return (a === 'x') === liggande ? ['lag', 'hog'] : [a];
    return [a];
}
// Skärmaxeln ett lager lägger sina VÄRDEN längs (den andra bär kategorin eller x-värdet).
function _vardeaxel(l) { return l.riktning === 'liggande' ? 'x' : 'y'; }
// Vilken skärmaxel figurens axel a ('x' | 'y' | 'y2') motsvarar för lagret, eller null.
function _skarmaxel(l, a) {
    if (a === 'x') return 'x';
    return (l.axel || 'y') === a ? 'y' : null;
}

/** Alla värden som lagren lägger på en axel ('x' | 'y' | 'y2'), i dataordning. */
function axelVarden(figur, axel) {
    const ut = [];
    for (const l of figur.lager) {
        const a = _skarmaxel(l, axel);
        if (!a) continue;
        const falt = _falt(l, a);
        const medFel = (l.marke === 'stapel' || l.marke === 'punkt') && _vardeaxel(l) === a;
        for (const d of l.data) {
            for (const f of falt) if (d[f] != null) ut.push(d[f]);
            if (medFel && d.fel) ut.push(d.fel.lag, d.fel.hog);
        }
    }
    return ut;
}

// Staplade staplar staplar positiva värden uppåt och negativa nedåt, var för sig, per kategori och panel.
// Ger { min, max } (största positiva summan, mest negativa summan; null om ingen) eller null.
function _staplatSpann(figur, axel) {
    const plus = new Map(), minus = new Map();
    for (const l of figur.lager) {
        if (l.marke !== 'stapel' || l.lage !== 'staplad') continue;
        const a = _skarmaxel(l, axel);
        if (!a || _vardeaxel(l) !== a) continue;
        const kat = a === 'x' ? 'y' : 'x';
        const panel = l.panel == null ? '' : String(l.panel);
        for (const d of l.data) {
            if (!d) continue;
            const v = d[a];
            if (typeof v !== 'number' || !isFinite(v) || v === 0) continue;
            const m = v > 0 ? plus : minus;
            const k = panel + '\u0000' + String(d[kat]);
            m.set(k, (m.get(k) || 0) + v);
        }
    }
    let min = null, max = null;
    for (const v of plus.values()) if (max == null || v > max) max = v;
    for (const v of minus.values()) if (min == null || v < min) min = v;
    return min == null && max == null ? null : { min, max };
}

/**
 * Domänen för en axel. Bandskala: kategorierna som FINNS i lagrens data (som strängar), med
 * axelns `ordning` först — en etikett utan datapunkt ritas aldrig, så små grupper som tagits
 * bort lämnar inget spår på axeln (ADR-14). Talskala: [min, max]; staplar tar med noll.
 */
function skalDoman(figur, axel) {
    const a = figur[axel];
    const varden = axelVarden(figur, axel);
    if (a.skala === 'band') {
        const finns = [];
        const sedda = new Set();
        for (const v of varden) { const k = String(v); if (!sedda.has(k)) { sedda.add(k); finns.push(k); } }
        const forst = (a.ordning || []).map(String).filter(k => sedda.has(k));
        const forstSet = new Set(forst);
        return [...forst, ...finns.filter(k => !forstSet.has(k))];
    }
    if (Array.isArray(a.doman) && a.doman.length === 2) return [a.doman[0], a.doman[1]];
    /** @type {number|null} */ let min = null;
    /** @type {number|null} */ let max = null;
    for (const v of varden) {
        if (typeof v !== 'number' || !isFinite(v)) continue;
        if (min == null || v < min) min = v;
        if (max == null || v > max) max = v;
    }
    if (min == null || max == null) return a.skala === 'log' ? [1, 10] : [0, 1];
    const spann = _staplatSpann(figur, axel);
    if (spann) {
        if (spann.max != null && spann.max > max) max = spann.max;
        if (spann.min != null && spann.min < min) min = spann.min;
    }
    if (a.skala !== 'log') {
        const harStapel = figur.lager.some(l => l.marke === 'stapel' && _skarmaxel(l, axel) === _vardeaxel(l));
        if (harStapel) { if (min > 0) min = 0; if (max < 0) max = 0; }
    }
    if (min === max) { min -= 1; max += 1; }
    return [min, max];
}

/**
 * De paneler som har minst ett av lagren, i panelernas ordning. Ett lager utan `panel` hör till varje
 * panel. Regeln finns bara här: utanSmaGrupper och ritaren (_rfSynligt) använder den båda, så figuren
 * och bilden namnger aldrig olika paneler.
 */
function panelerMedLager(paneler, lager) {
    return paneler.filter(p => lager.some(l => l.panel == null || l.panel === p));
}

/**
 * Figuren utan datapunkter märkta `liten`, utan lager som blev tomma och utan null-poster i data.
 * Originalet rörs inte. Bandaxlarna får originalets kategoriordning som `ordning`, begränsad till
 * kategorier som finns kvar, och `paneler` bara de paneler som har något lager kvar — figuren bär
 * alltså inga namn på borttagna grupper.
 */
function utanSmaGrupper(figur) {
    const rent = l => ({ ...l, data: l.data.filter(d => d && typeof d === 'object') });
    const lager = figur.lager.map(l => ({ ...rent(l), data: rent(l).data.filter(d => !d.liten) })).filter(l => l.data.length);
    const ut = { ...figur, lager };
    if (Array.isArray(figur.paneler)) ut.paneler = panelerMedLager(figur.paneler, lager);
    const original = { ...figur, lager: figur.lager.map(rent) };
    for (const a of ['x', 'y']) {
        if (!figur[a] || figur[a].skala !== 'band') continue;
        // Originalets ordning (uttrycklig `ordning` först, sedan första förekomst), därefter bara det som finns kvar.
        const full = skalDoman(original, a);
        ut[a] = { ...figur[a], ordning: skalDoman({ ...ut, [a]: { ...figur[a], ordning: full } }, a) };
    }
    return ut;
}

/** Antal datapunkter i figuren. */
function antalPunkter(figur) {
    let n = 0;
    for (const l of figur.lager) n += l.data.length;
    return n;
}

/**
 * Lådans mått: kvartiler med samma metod som verktygets tabeller (stat.js quantile), morrhår
 * till yttersta värdet inom 1,5 kvartilavstånd, övriga som avvikare.
 * @returns {{q1:number, median:number, q3:number, lag:number, hog:number, avvikare:number[]} | null}
 */
function ladstatistik(varden) {
    const v = (varden || []).filter(x => typeof x === 'number' && isFinite(x)).sort((a, b) => a - b);
    if (!v.length) return null;
    const q1 = quantile(v, 0.25), median = quantile(v, 0.5), q3 = quantile(v, 0.75);
    const kant = 1.5 * (q3 - q1);
    const inom = v.filter(x => x >= q1 - kant && x <= q3 + kant);
    return { q1, median, q3, lag: inom[0], hog: inom[inom.length - 1], avvikare: v.filter(x => x < q1 - kant || x > q3 + kant) };
}

// ---- Urval: dimensioner användaren kan filtrera diagrammet på (figur.urval) ----
// `figur.urval` är en lista med dimensioner, eller ett ensamt objekt (då en lista med ett element). En dimension är
//   { typ: 'kategori', falt, namn, etikett?, visning? } — en knapp per värde, eller en hopfälld lista med
//       kryssrutor (visning: 'lista', eller fler än URVAL_LISTA_MAX värden); utan typ är det en kategori (det äldre formatet)
//   { typ: 'intervall', falt, namn, format?, etikett? } — fälten Minst och Högst
// Ett filter döljer bara märken; inget tal räknas om — utom i ett härlett lager (harleddAv, se harleddaLager).

/** Talformaten som `talformat` känner (och som en intervalldimensions `format` får vara). */
const TALFORMAT = Object.freeze(['kr', 'pct', 'pctAbs', 'antal', 'tal2', 'ar']);
const URVAL_TYPER = ['kategori', 'intervall'];
/** En kategori med fler värden än så visas som en lista med kryssrutor i stället för en knapp per värde. */
const URVAL_LISTA_MAX = 12;

/**
 * Sant när kategoridimensionen `dim` med `antal` värden visas som en lista (kryssrutor, sökfält, Markera alla):
 * dimensionen har `visning: 'lista'`, eller fler än URVAL_LISTA_MAX värden.
 * @param {any} dim @param {number} antal
 */
function urvalSomLista(dim, antal) {
    return !!dim && (dim.visning === 'lista' || antal > URVAL_LISTA_MAX);
}

// Dimensionens typ: utan `typ` är den en kategori (det äldre formatet { falt, namn, etikett }).
function _urvalTyp(u) { return u && u.typ != null ? u.typ : 'kategori'; }
// Figurens urval som en lista, utan att skapa nya objekt (används per datapunkt av arBortvald).
function _urvalRa(figur) {
    const u = figur && figur.urval;
    if (u == null) return [];
    return Array.isArray(u) ? u : [u];
}

/**
 * Figurens urval som en lista med dimensioner, där varje dimension har sin `typ` utskriven. Ett ensamt objekt blir
 * en lista med ett element; ett objekt utan typ är en kategori. Utan urval: en tom lista.
 * @param {any} figur
 * @returns {Array<{typ: 'kategori'|'intervall', falt: string, namn: string, etikett?: string, format?: string}>}
 */
function urvalLista(figur) {
    return _urvalRa(figur).filter(u => u && typeof u === 'object').map(u => (u.typ != null ? u : { ...u, typ: 'kategori' }));
}

// Dimensionen `dim` (en dimension eller ett fältnamn) i figurens urval, eller den första av typen `typ` när dim saknas.
function _urvalDim(figur, dim, typ) {
    const lista = urvalLista(figur);
    if (dim == null) return lista.find(u => u.typ === typ) || null;
    const falt = typeof dim === 'string' ? dim : dim && dim.falt;
    const u = lista.find(x => x.falt === falt);
    return u && u.typ === typ ? u : null;
}

// Fältets värde i en datapunkt som sträng, eller null när punkten saknar fältet.
function _faltSomText(d, falt) {
    if (!d || typeof d !== 'object') return null;
    const v = d[falt];
    return v == null ? null : String(v);
}

/**
 * Knappens text för värdet v i en kategoridimension: mallen `etikett` med `{v}` utbytt (t.ex. 'BAS {v}' → 'BAS A'),
 * eller värdet självt utan mall. `dim` är dimensionen eller dess fält; utan dim: figurens första kategoridimension.
 * @param {any} figur @param {any} dim @param {string} v
 */
function urvalEtikett(figur, dim, v) {
    const u = _urvalDim(figur, dim, 'kategori');
    const mall = u ? u.etikett : null;
    return typeof mall === 'string' ? mall.split('{v}').join(String(v)) : String(v);
}

/**
 * De olika värdena i en kategoridimension bland alla lagers punkter som har fältet, som strängar.
 * En liten punkt räknas inte, om inte `visaSma` — en kategori som bara finns i små grupper blir aldrig en knapp.
 * Ordning: som figurens bandaxel (x, sedan y) när värdet med etiketten insatt är en kategori där; övriga värden
 * efter, i svensk sorteringsordning. Utan en sådan dimension: en tom lista.
 * @param {any} figur
 * @param {any} [dim]  dimensionen eller dess fält; utan dim: figurens första kategoridimension
 * @param {{visaSma?: boolean}} [val]
 * @returns {string[]}
 */
function urvalVarden(figur, dim, { visaSma = false } = {}) {
    const u = _urvalDim(figur, dim, 'kategori');
    if (!u) return [];
    const varden = new Set();
    for (const l of figur.lager || []) {
        for (const d of (l && Array.isArray(l.data) ? l.data : [])) {
            if (!visaSma && d && d.liten) continue;
            const v = _faltSomText(d, u.falt);
            if (v != null) varden.add(v);
        }
    }
    // Bandaxelns ordning räknas ur hela figuren (utan null-poster); den bestämmer bara rangen, inte vilka värden som finns.
    const rent = { ...figur, lager: (figur.lager || []).map(l => ({ ...l, data: (l.data || []).filter(d => d && typeof d === 'object') })) };
    const rang = new Map();
    for (const a of ['x', 'y']) {
        if (!figur[a] || figur[a].skala !== 'band') continue;
        for (const k of skalDoman(rent, a)) if (!rang.has(k)) rang.set(k, rang.size);
    }
    const et = v => urvalEtikett(figur, u, v);
    const ordnade = [], ovriga = [];
    for (const v of varden) (rang.has(et(v)) ? ordnade : ovriga).push(v);
    ordnade.sort((a, b) => rang.get(et(a)) - rang.get(et(b)));
    ovriga.sort((a, b) => a.localeCompare(b, 'sv'));
    return [...ordnade, ...ovriga];
}

/**
 * Det minsta och största talet i en intervalldimension bland alla lagers punkter som har fältet som ett ändligt tal.
 * En liten punkt räknas inte, om inte `visaSma`. null när det finns färre än två olika tal (då finns inget att välja).
 * @param {any} figur
 * @param {any} dim  dimensionen eller dess fält; utan dim: figurens första intervalldimension
 * @param {{visaSma?: boolean}} [val]
 * @returns {{min: number, max: number}|null}
 */
function urvalSpann(figur, dim, { visaSma = false } = {}) {
    const u = _urvalDim(figur, dim, 'intervall');
    if (!u) return null;
    let min = Infinity, max = -Infinity;
    for (const l of figur.lager || []) {
        for (const d of (l && Array.isArray(l.data) ? l.data : [])) {
            if (!d || typeof d !== 'object' || (!visaSma && d.liten)) continue;
            const v = d[u.falt];
            if (typeof v !== 'number' || !isFinite(v)) continue;
            if (v < min) min = v;
            if (v > max) max = v;
        }
    }
    return min < max ? { min, max } : null;
}

// Filtret som { kategori: Map, intervall: Map }. En mängd (det äldre formatet) är de bortvalda värdena i figurens
// första kategoridimension. Annat än ett objekt: inget filter.
function _filterNorm(figur, filter) {
    if (!filter || typeof filter !== 'object') return null;
    if (typeof filter.has === 'function') {
        const k = _urvalRa(figur).find(u => u && _urvalTyp(u) === 'kategori');
        return k ? { kategori: new Map([[k.falt, filter]]), intervall: null } : null;
    }
    const map = m => (m && typeof m.get === 'function' ? m : null);
    return { kategori: map(filter.kategori), intervall: map(filter.intervall) };
}

/**
 * Sant när punkten d döljs av filtret: den har fältet för en av figurens dimensioner och värdet är bortvalt
 * (kategori) eller ligger utanför intervallet (gränserna ingår, en gräns som saknas gäller inte). En punkt utan
 * fältet (t.ex. en referens) påverkas aldrig, och ett filter på ett fält som inte är en dimension i figuren gäller inte.
 * @param {any} figur
 * @param {{kategori?: Map<string, Set<string>>, intervall?: Map<string, {min?: number|null, max?: number|null}>}|Set<string>|null|undefined} filter
 *   en mängd (det äldre formatet) är de bortvalda värdena i figurens första kategoridimension
 * @param {any} d
 */
function arBortvald(figur, filter, d) {
    if (!d || typeof d !== 'object' || !filter || typeof filter !== 'object') return false;
    // Anropas per datapunkt och ritning: inga nya objekt här.
    const f = /** @type {any} */ (filter);
    const mangd = typeof f.has === 'function';
    const kat = mangd ? null : (f.kategori && typeof f.kategori.get === 'function' ? f.kategori : null);
    const int = mangd ? null : (f.intervall && typeof f.intervall.get === 'function' ? f.intervall : null);
    let forstaKategori = true;
    for (const u of _urvalRa(figur)) {
        if (!u || typeof u !== 'object') continue;
        const intervall = _urvalTyp(u) === 'intervall';
        const b = !intervall && mangd && forstaKategori ? f : null;
        if (!intervall) forstaKategori = false;
        const v = d[u.falt];
        if (v == null) continue;
        if (intervall) {
            const g = int && int.get(u.falt);
            if (!g || typeof v !== 'number' || !isFinite(v)) continue;
            if (typeof g.min === 'number' && v < g.min) return true;
            if (typeof g.max === 'number' && v > g.max) return true;
        } else {
            const m = b || (kat && kat.get(u.falt));
            if (m && typeof m.has === 'function' && m.has(String(v))) return true;
        }
    }
    return false;
}

// Ett tal i en gräns: dimensionens format, men ett antal med decimaler visas med en decimal.
function _gransText(v, format, enhet) {
    const f = format === 'antal' && !Number.isInteger(v) ? undefined : format;
    return talformat(v, f, { enhet });
}

/**
 * Intervallets text, t.ex. '10–50', 'minst 10', 'högst 50' (med dimensionens format), eller '' utan gränser.
 * @param {{format?: string}} dim @param {{min?: number|null, max?: number|null}|null|undefined} g
 */
function urvalIntervallText(dim, g) {
    const fmt = dim && dim.format;
    const min = g && typeof g.min === 'number' && isFinite(g.min) ? g.min : null;
    const max = g && typeof g.max === 'number' && isFinite(g.max) ? g.max : null;
    if (min != null && max != null) return `${_gransText(min, fmt, false)}–${_gransText(max, fmt, true)}`;
    if (min != null) return `minst ${_gransText(min, fmt, true)}`;
    if (max != null) return `högst ${_gransText(max, fmt, true)}`;
    return '';
}

/**
 * Det aktiva filtret som text, en del per dimension i figurens ordning: för en kategori 'utan BAS A, BAS N'
 * (etiketterna i värdenas ordning), för ett intervall mallen `etikett` med `{v}` utbytt mot intervallet
 * ('{v} personer i gruppen' → '10–50 personer i gruppen'), eller namnet och intervallet utan mall. Noten under
 * diagrammet och exportens fotrad visar samma text. Utan något aktivt: en tom lista.
 * En kategori som visas som lista (urvalSomLista) med fler än tre bortvalda säger i stället 'bara X, Y' (högst tre
 * valda) eller namnet och antalet ('Yrkesgrupp 12 av 40'); antalet räknas bland värdena som får visas (`visaSma`).
 * @param {any} figur @param {any} filter (se arBortvald) @param {{visaSma?: boolean}} [val]
 * @returns {string[]}
 */
function urvalBeskrivning(figur, filter, { visaSma = false } = {}) {
    const f = _filterNorm(figur, filter);
    if (!f) return [];
    const ut = [];
    for (const u of urvalLista(figur)) {
        if (u.typ === 'intervall') {
            const t = urvalIntervallText(u, f.intervall && f.intervall.get(u.falt));
            if (t) ut.push(typeof u.etikett === 'string' ? u.etikett.split('{v}').join(t) : `${u.namn} ${t}`);
        } else {
            const b = f.kategori && f.kategori.get(u.falt);
            if (!b || typeof b.has !== 'function' || !b.size) continue;
            const etiketter = urvalVarden(figur, u, { visaSma: true }).filter(v => b.has(v)).map(v => urvalEtikett(figur, u, v));
            if (!etiketter.length) continue;
            const varden = urvalVarden(figur, u, { visaSma });
            if (etiketter.length > 3 && urvalSomLista(u, varden.length)) {
                const valda = varden.filter(v => !b.has(v));
                ut.push(valda.length && valda.length <= 3 ? `bara ${valda.map(v => urvalEtikett(figur, u, v)).join(', ')}` : `${u.namn} ${valda.length} av ${varden.length}`);
            } else ut.push(`utan ${etiketter.join(', ')}`);
        }
    }
    return ut;
}

/**
 * Sant när filtret döljer något: ett bortvalt värde i en kategori eller en gräns i ett intervall (en mängd, det
 * äldre formatet: minst ett bortvalt värde). Annat än ett filter: falskt.
 * @param {any} filter
 */
function urvalAktivt(filter) {
    if (!filter || typeof filter !== 'object') return false;
    if (typeof filter.has === 'function') return filter.size > 0;
    const kat = filter.kategori && typeof filter.kategori.values === 'function' ? [...filter.kategori.values()] : [];
    if (kat.some(s => s && s.size > 0)) return true;
    const int = filter.intervall && typeof filter.intervall.values === 'function' ? [...filter.intervall.values()] : [];
    return int.some(g => g && ((typeof g.min === 'number' && isFinite(g.min)) || (typeof g.max === 'number' && isFinite(g.max))));
}

/**
 * Figuren med sina härledda lager räknade för filtret. Ett lager med `harleddAv: { lager, berakna, minN?, namn?,
 * villkor? }` (t.ex. en trendlinje) räknas ur punkterna i källagren — lagren vars `serie` står i `lager`. Utan ett
 * aktivt filter (urvalAktivt) är svaret figuren själv, samma objekt: talen är då vyns egna. Med ett aktivt filter får
 * lagret `berakna(punkter)` som data, där punkterna är källagrens SYNLIGA punkter (inte bortvalda, och inte små
 * om inte `visaSma`) — omräkningen bygger bara på det som redan syns — och, med `villkor`, bara de för vilka
 * `villkor(punkt)` är sant (t.ex. ett köns punkter ur lager per BAS-intervall). Källorna läses alltid ur källagrens
 * egna data, aldrig ur ett omräknat lager: ett lager får nämna sin egen serie (det läggs då om ur sina egna synliga
 * punkter, t.ex. trädkartans ytor) och ett sådant lager får vara källa till andra. Har källorna färre än `minN`
 * (minst 1) punkter blir lagret tomt (ritas inte) och står i `utelamnade`. `berakna` ger en lista, eller
 * `{ data, serie? }` när lagrets namn i förklaringen bär ett tal som också räknas om (R² i en trendlinje). Lagrets
 * index och övriga fält är oförändrade. Den nya figuren prövas med valideraFigur (kastar om `berakna` gav ogiltig data).
 * @param {any} figur  en giltig figur
 * @param {any} filter  se arBortvald
 * @param {{visaSma?: boolean}} [val]
 * @returns {{figur: any, omraknade: Array<{index: number, namn: string}>, utelamnade: Array<{index: number, namn: string, minN: number, antal: number}>}}
 */
function harleddaLager(figur, filter, { visaSma = false } = {}) {
    /** @type {{figur: any, omraknade: Array<{index: number, namn: string}>, utelamnade: Array<{index: number, namn: string, minN: number, antal: number}>}} */
    const ut = { figur, omraknade: [], utelamnade: [] };
    const lager = figur && Array.isArray(figur.lager) ? figur.lager : [];
    if (!lager.some(l => l && l.harleddAv) || !urvalAktivt(filter)) return ut;
    const synlig = d => !!d && typeof d === 'object' && (visaSma || !d.liten) && !arBortvald(figur, filter, d);
    const nya = lager.map((l, index) => {
        const h = l && l.harleddAv;
        if (!h) return l;
        const kallor = new Set(h.lager.map(String));
        const villkor = typeof h.villkor === 'function' ? h.villkor : () => true;
        const punkter = [];
        lager.forEach((k, ki) => {
            if (!k || k.serie == null || !kallor.has(String(k.serie)) || (ki !== index && !_kanVaraKalla(k))) return;
            for (const d of k.data) if (synlig(d) && villkor(d)) punkter.push(d);
        });
        const minN = Math.max(1, typeof h.minN === 'number' && isFinite(h.minN) ? h.minN : 1);
        const namn = harlettNamn(l);
        if (punkter.length < minN) {
            ut.utelamnade.push({ index, namn, minN, antal: punkter.length });
            return { ...l, data: [] };
        }
        const svar = h.berakna(punkter);
        const data = Array.isArray(svar) ? svar : svar && typeof svar === 'object' && Array.isArray(svar.data) ? svar.data : null;
        if (!data) throw new Error(`Ogiltig figur (härlett lager ${index}): berakna måste ge en lista`);
        ut.omraknade.push({ index, namn });
        const serie = !Array.isArray(svar) && typeof svar.serie === 'string' && svar.serie.trim() ? { serie: svar.serie } : {};
        return { ...l, ...serie, data };
    });
    ut.figur = { ...figur, lager: nya };
    valideraFigur(ut.figur, 'härlett lager');
    return ut;
}

// Ett lager som får vara källa till ett annat: ett vanligt lager, eller ett som bara läggs om ur sina egna punkter
// (harleddAv.lager är just dess egen serie). Källan läses ur lagrets egna data, så ingen kedja räknas.
function _kanVaraKalla(k) {
    const h = k && k.harleddAv;
    return !h || (Array.isArray(h.lager) && h.lager.length > 0 && h.lager.every(s => String(s) === String(k.serie)));
}

/** Det härledda lagrets namn i noterna: `harleddAv.namn`, annars 'Serien <serie>' eller 'Lagret'. @param {any} l */
function harlettNamn(l) {
    const h = l && l.harleddAv;
    if (h && typeof h.namn === 'string' && h.namn.trim()) return h.namn.trim();
    return l && l.serie != null ? `Serien ${l.serie}` : 'Lagret';
}

/**
 * Noterna om härledda lager efter harleddaLager: '<namn> gäller urvalet.' för ett omräknat lager och
 * '<namn> visas inte: färre än <minN> synliga punkter.' för ett som inte ritas.
 * @param {{omraknade?: Array<{namn: string}>, utelamnade?: Array<{namn: string, minN: number}>}|null|undefined} h
 * @returns {{omraknade: string[], utelamnade: string[]}}
 */
function harlettNot(h) {
    const stor = s => s.charAt(0).toUpperCase() + s.slice(1);
    // Två lager med samma namn (en trendlinje och dess konfidensband, trädkartans två lager) ger en mening.
    const unika = a => [...new Set(a)];
    return {
        omraknade: unika(((h && h.omraknade) || []).map(o => `${stor(o.namn)} gäller urvalet.`)),
        utelamnade: unika(((h && h.utelamnade) || []).map(o => `${stor(o.namn)} visas inte: färre än ${talformat(o.minN, 'antal')} synliga punkter.`)),
    };
}

// ---- Underlag: diagrammet räknat för en del av personerna (figur.underlag) ----
// `figur.underlag = { dimensioner, rader, rita, k, kon? }`. `rader` är personerna i hela det underlag vyn redan ritar,
// `dimensioner` kategorier att räkna för ({ falt, namn, varde?, etikett?, visning?, ordning? }; `varde(rad)` ger radens
// värde, annars `rad[falt]`), `rita(valda, { beskrivning })` vyns egen beräkning för de valda raderna (en figur, eller
// en text när den inte går att rita), `k` tröskeln och `kon(rad)` 'kv', 'ma' eller null (annars fältet `kon` som i
// resten av verktyget).
//
// Skyddsregeln mot differensröjande: ett val godtas bara när både urvalet och resten (underlaget utom urvalet) har noll
// eller minst k personer av vartdera könet. Två till: ett värde vars egen grupp inte klarar regeln går inte att välja
// (det ingår bara i hela underlaget), och underlaget räknas för en dimension i taget. Då är skillnaden mellan två val
// alltid en förening av valbara värden — själva skyddade — och "alla" minus ett val är resten, som regeln prövar.

// Radens kön som 'kv' eller 'ma' (samma regel som konOf i falt.js), eller null.
function _underlagKon(underlag, r) {
    if (underlag && typeof underlag.kon === 'function') { const k = underlag.kon(r); return k === 'kv' || k === 'ma' ? k : null; }
    if (arKvinna(r)) return 'kv';
    return arMan(r) ? 'ma' : null;
}

/**
 * Antalet kvinnor och män bland raderna.
 * @param {any} underlag @param {any[]} rader @returns {{kv: number, ma: number}}
 */
function underlagKonAntal(underlag, rader) {
    const ut = { kv: 0, ma: 0 };
    for (const r of rader || []) { const k = _underlagKon(underlag, r); if (k) ut[k]++; }
    return ut;
}

/** Sant när vartdera könet har noll eller minst k personer. @param {{kv: number, ma: number}} antal @param {number} k */
function underlagSkyddat(antal, k) {
    return [antal.kv, antal.ma].every(n => n === 0 || n >= k);
}

/**
 * Radens värde i dimensionen som sträng (`dim.varde(rad)`, annars `rad[dim.falt]`), eller null när det saknas.
 * @param {any} dim @param {any} rad @returns {string|null}
 */
function underlagVarde(dim, rad) {
    const v = dim && typeof dim.varde === 'function' ? dim.varde(rad) : rad && dim ? rad[dim.falt] : null;
    return v == null || v === '' ? null : String(v);
}

/**
 * Dimensionen `falt` i figurens underlag, eller null.
 * @param {any} underlag @param {string} falt
 */
function underlagDimension(underlag, falt) {
    const dims = underlag && Array.isArray(underlag.dimensioner) ? underlag.dimensioner : [];
    return dims.find(u => u && u.falt === falt) || null;
}

/**
 * Värdena som går att välja i dimensionen: de vars grupp (raderna med värdet) klarar skyddsregeln, i dimensionens
 * `ordning` (en jämförelsefunktion) eller svensk sorteringsordning. `utelamnade` är antalet värden som inte går att
 * välja; de ingår bara i hela underlaget.
 * @param {any} underlag @param {any} dim
 * @returns {{varden: string[], utelamnade: number}}
 */
function underlagVarden(underlag, dim) {
    const grupper = new Map();
    for (const r of (underlag && underlag.rader) || []) {
        const v = underlagVarde(dim, r);
        if (v == null) continue;
        if (!grupper.has(v)) grupper.set(v, { kv: 0, ma: 0 });
        const k = _underlagKon(underlag, r);
        if (k) grupper.get(v)[k]++;
    }
    const varden = [];
    let utelamnade = 0;
    for (const [v, antal] of grupper) {
        if (antal.kv + antal.ma > 0 && underlagSkyddat(antal, underlag.k)) varden.push(v); else utelamnade++;
    }
    varden.sort(typeof dim.ordning === 'function' ? dim.ordning : (a, b) => a.localeCompare(b, 'sv', { numeric: true }));
    return { varden, utelamnade };
}

/**
 * Valet som gäller i ett filter (Map<falt, Set<bortvalda värden>>): den första dimensionen med ett bortvalt värde
 * som går att välja, som { dim, varden, valda } (valda: de valbara värden som inte är bortvalda), eller null när
 * underlaget är helt.
 * @param {any} underlag @param {Map<string, Set<string>>|null|undefined} filter
 */
function underlagValet(underlag, filter) {
    if (!filter || typeof filter.get !== 'function') return null;
    for (const dim of (underlag && underlag.dimensioner) || []) {
        const bort = filter.get(dim.falt);
        if (!bort || !bort.size) continue;
        const { varden } = underlagVarden(underlag, dim);
        if (!varden.some(v => bort.has(v))) continue;
        return { dim, varden, valda: varden.filter(v => !bort.has(v)) };
    }
    return null;
}

/**
 * Prövar ett val mot skyddsregeln. `valda` är raderna i urvalet (de med ett valt värde i den valda dimensionen; hela
 * underlaget när inget är valt), `antal` könen i urvalet och resten, `ok` om båda klarar regeln.
 * @param {any} underlag @param {Map<string, Set<string>>|null|undefined} filter
 * @returns {{ok: boolean, valet: any, valda: any[], antal: {urval: {kv: number, ma: number}, rest: {kv: number, ma: number}}}}
 */
function underlagProva(underlag, filter) {
    const rader = (underlag && underlag.rader) || [];
    const valet = underlagValet(underlag, filter);
    const valbara = valet ? new Set(valet.valda) : null;
    const valda = valet && valbara ? rader.filter(r => { const v = underlagVarde(valet.dim, r); return v != null && valbara.has(v); }) : rader;
    const alla = underlagKonAntal(underlag, rader), urval = underlagKonAntal(underlag, valda);
    const rest = { kv: alla.kv - urval.kv, ma: alla.ma - urval.ma };
    return { ok: !valet || (underlagSkyddat(urval, underlag.k) && underlagSkyddat(rest, underlag.k)), valet, valda, antal: { urval, rest } };
}

/** Dimensionens namn mitt i en mening: liten första bokstav, utom när namnet börjar med en förkortning ('BAS-intervall'). @param {string} namn */
function namnIMening(namn) {
    const s = String(namn || '');
    return s.length > 1 && s[1] === s[1].toLocaleLowerCase('sv') ? s[0].toLocaleLowerCase('sv') + s.slice(1) : s;
}

/**
 * Valet som text, t.ex. 'sektor Vård och omsorg' eller 'yrkesgrupp 5 av 40' (fler än tre valda), eller '' när
 * underlaget är helt.
 * @param {any} underlag @param {Map<string, Set<string>>|null|undefined} filter
 */
function underlagBeskrivning(underlag, filter) {
    const valet = underlagValet(underlag, filter);
    if (!valet) return '';
    const namn = namnIMening(valet.dim.namn);
    if (!valet.valda.length) return `${namn}: inga`;
    return valet.valda.length <= 3 ? `${namn} ${valet.valda.join(', ')}` : `${namn} ${valet.valda.length} av ${valet.varden.length}`;
}

// Prövar figur.underlag (valideraFigur).
function _provaUnderlag(figur, fel) {
    const u = figur.underlag, vem = 'underlag';
    if (!u || typeof u !== 'object') fel(`${vem} måste vara { dimensioner, rader, rita, k, kon? }`);
    if (!Array.isArray(u.dimensioner) || !u.dimensioner.length) fel(`${vem}.dimensioner måste vara en lista med minst en dimension`);
    if (!Array.isArray(u.rader)) fel(`${vem}.rader måste vara en lista`);
    if (typeof u.rita !== 'function') fel(`${vem}.rita måste vara en funktion`);
    if (!(typeof u.k === 'number' && Number.isInteger(u.k) && u.k >= 1)) fel(`${vem}.k måste vara ett heltal ≥ 1`);
    if (u.kon != null && typeof u.kon !== 'function') fel(`${vem}.kon måste vara en funktion`);
    const text = v => typeof v === 'string' && v.trim() !== '';
    const sedda = new Set();
    u.dimensioner.forEach((d, i) => {
        const v = `${vem}.dimensioner ${i}`;
        if (!d || typeof d !== 'object') fel(`${v}: måste vara { falt, namn, varde?, etikett?, visning?, ordning? }`);
        if (d.typ != null && d.typ !== 'kategori') fel(`${v}: bara kategorier går att räkna för`);
        if (!text(d.falt) || !text(d.namn)) fel(`${v}: falt och namn måste vara icke-tomma strängar`);
        for (const f of ['varde', 'ordning']) if (d[f] != null && typeof d[f] !== 'function') fel(`${v}: ${f} måste vara en funktion`);
        if (d.etikett != null && typeof d.etikett !== 'string') fel(`${v}: etikett måste vara en sträng`);
        if (d.visning != null && d.visning !== 'lista') fel(`${v}: visning måste vara "lista"`);
        if (sedda.has(d.falt)) fel(`${v}: fältet "${d.falt}" förekommer två gånger`);
        sedda.add(d.falt);
    });
}

// Färgskalans domän: ett objekt med `doman` = två ändliga tal.
function _fargdomanOk(fs) {
    return !!fs && typeof fs === 'object' && Array.isArray(fs.doman) && fs.doman.length === 2
        && fs.doman.every(n => typeof n === 'number' && isFinite(n));
}

// Prövar lagrets datapunkter i ett enda varv: objekt, och på talaxlar ändliga tal (eller null/undefined).
function _provaData(l, i, figur, fel) {
    const talFalt = [];
    for (const a of ['x', 'y']) {
        const ax = a === 'y' && l.axel === 'y2' ? figur.y2 : figur[a];
        if (!ax || ax.skala === 'band') continue;
        for (const f of _falt(l, a)) talFalt.push(f);
        if ((l.marke === 'stapel' || l.marke === 'punkt') && _vardeaxel(l) === a) talFalt.push('fel.lag', 'fel.hog');
    }
    for (const f of ['varde', 'fargvarde', 'storlek', 'skillnadKr']) if (!talFalt.includes(f)) talFalt.push(f);
    const ok = v => v == null || (typeof v === 'number' && isFinite(v));
    for (let n = 0; n < l.data.length; n++) {
        const d = l.data[n];
        if (d === null || typeof d !== 'object') fel(`lager ${i}: datapunkt ${n} är inte ett objekt`);
        for (const f of talFalt) {
            const v = f.startsWith('fel.') ? (d.fel ? d.fel[f.slice(4)] : undefined) : d[f];
            if (!ok(v)) fel(`lager ${i}: datapunkt ${n}: fältet "${f}" måste vara ett ändligt tal (fick ${typeof v === 'string' ? `"${v}"` : String(v)})`);
        }
    }
}

// Ett härlett lager: { lager: [serie, …], berakna: punkter => data, minN?, namn?, villkor? }. Källorna är lagret
// självt (det läggs om ur sina egna punkter) eller andra lager som inte själva är härledda ur något annat; varje namn
// måste vara serien i minst ett sådant lager.
function _provaHarlett(figur, l, i, fel) {
    const h = l.harleddAv, vem = `lager ${i}: harleddAv`;
    if (!h || typeof h !== 'object') fel(`${vem} måste vara { lager, berakna, minN?, namn?, villkor? }`);
    if (!Array.isArray(h.lager) || !h.lager.length || !h.lager.every(s => typeof s === 'string' && s.trim() !== '')) fel(`${vem}.lager måste vara en lista med serienamn`);
    if (typeof h.berakna !== 'function') fel(`${vem}.berakna måste vara en funktion`);
    if (h.minN != null && !(typeof h.minN === 'number' && Number.isInteger(h.minN) && h.minN >= 0)) fel(`${vem}.minN måste vara ett heltal ≥ 0`);
    if (h.namn != null && typeof h.namn !== 'string') fel(`${vem}.namn måste vara en sträng`);
    if (h.villkor != null && typeof h.villkor !== 'function') fel(`${vem}.villkor måste vara en funktion`);
    const serier = new Set(figur.lager.filter((k, ki) => k && k.serie != null && (ki === i || _kanVaraKalla(k))).map(k => String(k.serie)));
    for (const s of h.lager) if (!serier.has(s)) fel(`${vem}: källagret "${s}" finns inte (eller är självt härlett)`);
}

/**
 * Kastar ett fel med diagrammets id och orsaken om figuren inte går att rita.
 * @returns figuren, oförändrad
 */
function valideraFigur(figur, id = 'diagram') {
    const fel = m => { throw new Error(`Ogiltig figur (${id}): ${m}`); };
    if (!figur || typeof figur !== 'object') fel('figuren saknas');
    if (typeof figur.beskrivning !== 'string' || !figur.beskrivning.trim()) fel('beskrivning saknas');
    for (const a of ['x', 'y']) {
        if (!figur[a] || !SKALOR.includes(figur[a].skala)) fel(`axeln ${a} saknar giltig skala`);
    }
    for (const a of ['x', 'y', 'y2']) {
        const ax = figur[a];
        if (!ax || ax.skala === 'band' || ax.doman == null) continue;
        const d = ax.doman;
        const ok = Array.isArray(d) && d.length === 2 && d.every(n => typeof n === 'number' && isFinite(n)) && d[0] !== d[1]
            && (ax.skala !== 'log' || (d[0] > 0 && d[1] > 0));
        if (!ok) fel(`axeln ${a}: doman måste vara två olika ändliga tal${ax.skala === 'log' ? ' större än noll' : ''}`);
    }
    if (figur.y2 && figur.y2.skala !== 'linjar') fel('y2 måste ha skalan linjar');
    if (!Array.isArray(figur.lager) || !figur.lager.length) fel('lager saknas');
    // paneler: 'auto' — radpaneler för många kategorier: bara för en liggande figur med
    // kategorier på y, och lagren får då ingen egen panel.
    if (figur.paneler != null && !Array.isArray(figur.paneler) && figur.paneler !== 'auto') fel('paneler måste vara en lista eller "auto"');
    if (figur.paneler === 'auto') {
        if (!figur.y || figur.y.skala !== 'band') fel('paneler "auto" kräver bandskala på y');
        if (figur.lager.some(l => !(l.riktning === 'liggande' || l.marke === 'punkt') || l.panel != null)) fel('paneler "auto" kräver liggande lager (eller punkter) utan egen panel');
    }
    // urval: dimensioner användaren kan filtrera på (BAS-intervall, antal …). Bara märken döljs; inget räknas om.
    if (figur.urval != null) {
        if (typeof figur.urval !== 'object') fel('urval måste vara en dimension eller en lista med dimensioner');
        const text = v => typeof v === 'string' && v.trim() !== '';
        const sedda = new Set();
        _urvalRa(figur).forEach((u, i) => {
            const vem = `urval ${i}`;
            if (!u || typeof u !== 'object') fel(`${vem}: måste vara { typ?, falt, namn, etikett?, format?, visning? }`);
            const typ = _urvalTyp(u);
            if (!URVAL_TYPER.includes(typ)) fel(`${vem}: typ måste vara "kategori" eller "intervall"`);
            if (!text(u.falt) || !text(u.namn)) fel(`${vem}: falt och namn måste vara icke-tomma strängar`);
            if (u.etikett != null && typeof u.etikett !== 'string') fel(`${vem}: etikett måste vara en sträng`);
            if (u.format != null && (typ !== 'intervall' || !TALFORMAT.includes(u.format))) fel(`${vem}: format gäller bara intervall och måste vara ett av ${TALFORMAT.join(', ')}`);
            if (u.visning != null && (typ !== 'kategori' || u.visning !== 'lista')) fel(`${vem}: visning gäller bara kategori och måste vara "lista"`);
            if (sedda.has(u.falt)) fel(`${vem}: fältet "${u.falt}" förekommer två gånger`);
            sedda.add(u.falt);
        });
    }
    // underlag: diagrammet kan räknas om för en del av personerna (underlagProva m.fl. ovan).
    if (figur.underlag != null) _provaUnderlag(figur, fel);
    const paneler = Array.isArray(figur.paneler) ? figur.paneler : [];
    figur.lager.forEach((l, i) => {
        if (!l || !MARKEN.includes(l.marke)) fel(`lager ${i}: okänt märke "${l && l.marke}"`);
        if (!Array.isArray(l.data)) fel(`lager ${i}: data saknas`);
        if (l.axel === 'y2' && !figur.y2) fel(`lager ${i}: axeln y2 finns inte i figuren`);
        if (l.panel != null && !paneler.includes(l.panel)) fel(`lager ${i}: panelen "${l.panel}" finns inte`);
        if (l.tips != null && typeof l.tips !== 'function') fel(`lager ${i}: tips måste vara en funktion`);
        if (l.harleddAv != null) _provaHarlett(figur, l, i, fel);
        const behoverFarg = l.marke === 'ruta' || (l.marke === 'punkt' && l.data.some(d => d && d.fargvarde != null));
        if (behoverFarg && !figur.fargskala) fel(`lager ${i}: ${l.marke} med färgvärde kräver fargskala`);
        // Utan användbar domän kan ritaren inte färga något, och diagrammet skulle bli tomt utan fel. Lika tal är
        // tillåtna (ritaren vidgar domänen, som skalDoman gör för min === max); omvänd domän ger omvänd skala.
        if (behoverFarg && !_fargdomanOk(figur.fargskala)) fel('fargskala: doman måste vara två ändliga tal');
        // Lådor ritas bara stående (kategorin på x, värdet på y): en liggande låda skulle annars godkännas men aldrig ritas.
        // Ofylld (en ring utan fyllning) finns bara för punktsymbolerna med en yta: cirkel, romb och kvadrat.
        if (l.ofylld != null && !(typeof l.ofylld === 'boolean' && l.marke === 'punkt' && (!l.symbol || ['cirkel', 'romb', 'kvadrat'].includes(l.symbol)))) fel(`lager ${i}: ofylld måste vara true eller false och gäller bara punkt med symbolen cirkel, romb eller kvadrat`);
        if (l.monster != null && !(l.marke === 'stapel' && (l.monster === 'linjer' || l.monster === 'prickar'))) fel(`lager ${i}: monster måste vara "linjer" eller "prickar" och gäller bara stapel`);
        if (l.marke === 'lada' && l.riktning === 'liggande') fel(`lager ${i}: lada stöder bara stående riktning`);
        if (l.marke === 'lada' && l.form != null && !['fiol', 'regnmoln', 'kvantiler'].includes(l.form)) fel(`lager ${i}: form måste vara "fiol", "regnmoln" eller "kvantiler"`);
        if (l.antal != null && !(l.marke === 'lada' && l.form === 'kvantiler' && (l.antal === 20 || l.antal === 50))) fel(`lager ${i}: antal måste vara 20 eller 50 och gäller bara lada med form "kvantiler"`);
        // Staplar och lådor ritas per kategori och ruta i ett rutnät: kategorierna måste ligga på en bandskala.
        const kategori = l.riktning === 'liggande' ? 'y' : 'x';
        if ((l.marke === 'stapel' || l.marke === 'lada') && figur[kategori].skala !== 'band') fel(`lager ${i}: ${l.marke} kräver bandskala på kategoriaxeln (${kategori})`);
        if (l.marke === 'ruta' && (figur.x.skala !== 'band' || figur.y.skala !== 'band')) fel(`lager ${i}: ruta kräver bandskala på både x och y`);
        if (l.marke === 'yta' && (figur.x.skala === 'band' || figur.y.skala === 'band')) fel(`lager ${i}: yta kräver talaxlar på både x och y`);
        _provaData(l, i, figur, fel);
    });
    for (const a of ['x', 'y']) {
        if (figur[a].skala !== 'log') continue;
        if (axelVarden(figur, a).some(v => typeof v === 'number' && v <= 0)) fel(`axeln ${a} är logaritmisk och kräver värden större än noll`);
    }
    return figur;
}

const _cell = v => (v == null || (typeof v === 'number' && !isFinite(v))) ? '' : v;
function _serienamn(figur, l, i) {
    let namn = l.serie ? String(l.serie) : `Serie ${i + 1}`;
    // Ett lager på högra axeln skulle annars läsas under vänsteraxelns rubrik.
    if (l.axel === 'y2') namn += figur.y2 && figur.y2.titel ? ` (höger axel: ${figur.y2.titel})` : ' (höger axel)';
    return l.panel != null ? `${namn} · ${l.panel}` : namn;
}

/**
 * Figuren som rad-matris för CSV och urklipp. `ruta` blir en korstabell per lager; övriga
 * märken långt format (Serie | x | y, och Undre | Övre när figuren har band, intervall,
 * felstaplar eller lådor). En `lada` skrivs ALDRIG som individer (dataminimering): en rad per
 * kategori med lådans statistik — median under y, första kvartilen under Undre och tredje
 * under Övre — i axelns ordning, för båda `punkter`-lägena. Anroparen ansvarar för små
 * grupper (utanSmaGrupper; statistiken räknas då bara ur det som finns kvar) och spårbarhetsraden.
 * @returns {Array<Array<string|number>>}
 */
function figurTillTabell(figur) {
    const block = [];
    // En null-post i data hoppas över (ovaliderad indata ska inte kasta).
    figur = { ...figur, lager: figur.lager.map(l => ({ ...l, data: (l.data || []).filter(d => d != null) })) };
    figur.lager.forEach((l, i) => {
        if (l.marke !== 'ruta' || !l.data.length) return;
        const en = { ...figur, lager: [l] };
        const xs = skalDoman({ ...en, x: { ...figur.x, skala: 'band' } }, 'x');
        const ys = skalDoman({ ...en, y: { ...figur.y, skala: 'band' } }, 'y');
        const cell = new Map(l.data.map(d => [String(d.x) + '\u0000' + String(d.y), d.varde]));
        const b = [[_serienamn(figur, l, i), ...xs]];
        for (const y of ys) b.push([y, ...xs.map(x => _cell(cell.get(x + '\u0000' + y)))]);
        block.push(b);
    });

    // Ett lager märkt `utanData` bär bara etiketter till värden som redan står i ett annat lager, och får inga rader.
    const ovriga = figur.lager.map((l, i) => [l, i]).filter(([l]) => l.marke !== 'ruta' && l.data.length && !l.utanData);
    if (ovriga.length) {
        const spann = ovriga.some(([l]) => l.marke === 'band' || l.marke === 'intervall' || l.marke === 'lada' || l.data.some(d => d.fel));
        const xOrdning = ovriga.some(([l]) => l.marke === 'lada') ? skalDoman({ ...figur, x: { ...figur.x, skala: 'band' } }, 'x') : [];
        const rubrik = ['Serie', (figur.x && figur.x.titel) || 'x', (figur.y && figur.y.titel) || 'y'];
        if (spann) rubrik.push('Undre', 'Övre');
        // Skillnaden i kronor (kronorSkillnad) får en egen kolumn när någon punkt bär den.
        const kronor = ovriga.some(([l]) => l.data.some(d => typeof d.skillnadKr === 'number'));
        if (kronor) rubrik.push('Skillnad (kr/mån)');
        const b = [rubrik];
        for (const [l, i] of ovriga) {
            const harSpann = l.marke === 'band' || l.marke === 'intervall';
            const liggande = l.riktning === 'liggande';
            if (l.marke === 'yta') {
                // En yta bär ett namn och ett värde, inte ett läge: raden är Serie | namn | värde.
                for (const d of l.data) { const rad = [_serienamn(figur, l, i), _cell(d.namn != null ? d.namn : d.etikett), _cell(d.varde)]; if (spann) rad.push('', ''); if (kronor) rad.push(''); b.push(rad); }
                continue;
            }
            if (l.marke === 'lada') {
                const grupper = new Map();
                for (const d of l.data) {
                    const k = String(d.x);
                    if (!grupper.has(k)) grupper.set(k, []);
                    grupper.get(k).push(d.y);
                }
                if (l.form === 'kvantiler') {
                    // Kvantilpunkter: en rad per prick med kvantilens värde — aldrig individer.
                    for (const k of xOrdning) {
                        const kp = grupper.has(k) ? kvantilpunkter(grupper.get(k), l.antal || 20) : null;
                        if (kp) kp.varden.forEach((v, j) => b.push([_serienamn(figur, l, i), `${k} · ${j + 1}/${kp.antal}`, v, '', '', ...(kronor ? [''] : [])]));
                    }
                    continue;
                }
                for (const k of xOrdning) {
                    const st = grupper.has(k) ? ladstatistik(grupper.get(k)) : null;
                    if (st) b.push([_serienamn(figur, l, i), k, st.median, st.q1, st.q3, ...(kronor ? [''] : [])]);
                }
                continue;
            }
            for (const d of l.data) {
                // Ett spann ligger längs värdeaxeln; den cellen lämnas tom och gränserna står i Undre/Övre.
                // Ett lager märkt `absolut` ritas åt det negativa hållet (divergerande stapel) men bär en storlek:
                // värdet skrivs utan tecken.
                const abs = (v, varde) => (l.absolut && varde && typeof v === 'number' ? Math.abs(v) : v);
                const x = harSpann && l.marke === 'intervall' && liggande ? '' : _cell(abs(d.x, liggande));
                const y = harSpann && !(l.marke === 'intervall' && liggande) ? '' : _cell(abs(d.y, !liggande));
                const rad = [_serienamn(figur, l, i), x, y];
                if (spann) {
                    const g = harSpann ? d : (d.fel || {});
                    rad.push(_cell(g.lag), _cell(g.hog));
                }
                if (kronor) rad.push(_cell(d.skillnadKr));
                b.push(rad);
            }
        }
        block.push(b);
    }

    const ut = [];
    block.forEach((b, i) => { if (i) ut.push([]); ut.push(...b); });
    return ut;
}

    return { talformat, valideraFigur, utanSmaGrupper, skalDoman, ladstatistik, antalPunkter, figurTillTabell, panelerMedLager, kronorSkillnad, kronorTipsRad, kvantilpunkter, urvalVarden, urvalEtikett, arBortvald, urvalLista, urvalSpann, urvalBeskrivning, urvalSomLista, urvalAktivt, harleddaLager, harlettNot, underlagKonAntal, underlagSkyddat, underlagVarde, underlagDimension, underlagVarden, underlagValet, underlagProva, underlagBeskrivning, namnIMening };
})();
const _figTalformat = __mirrorFigur.talformat;
const _figValidera = __mirrorFigur.valideraFigur;
const _figUtanSma = __mirrorFigur.utanSmaGrupper;
const _figSkalDoman = __mirrorFigur.skalDoman;
const _figLadstatistik = __mirrorFigur.ladstatistik;
const _figAntalPunkter = __mirrorFigur.antalPunkter;
const _figTillTabell = __mirrorFigur.figurTillTabell;
const _figPanelerMedLager = __mirrorFigur.panelerMedLager;
const _figKronorSkillnad = __mirrorFigur.kronorSkillnad;
const _figKronorTipsRad = __mirrorFigur.kronorTipsRad;
const _figKvantilpunkter = __mirrorFigur.kvantilpunkter;
const _figUrvalVarden = __mirrorFigur.urvalVarden;
const _figUrvalEtikett = __mirrorFigur.urvalEtikett;
const _figArBortvald = __mirrorFigur.arBortvald;
const _figUrvalLista = __mirrorFigur.urvalLista;
const _figUrvalSpann = __mirrorFigur.urvalSpann;
const _figUrvalBeskrivning = __mirrorFigur.urvalBeskrivning;
const _figUrvalSomLista = __mirrorFigur.urvalSomLista;
const _figUrvalAktivt = __mirrorFigur.urvalAktivt;
const _figHarleddaLager = __mirrorFigur.harleddaLager;
const _figHarlettNot = __mirrorFigur.harlettNot;
const _figUnderlagKonAntal = __mirrorFigur.underlagKonAntal;
const _figUnderlagSkyddat = __mirrorFigur.underlagSkyddat;
const _figUnderlagVarde = __mirrorFigur.underlagVarde;
const _figUnderlagDimension = __mirrorFigur.underlagDimension;
const _figUnderlagVarden = __mirrorFigur.underlagVarden;
const _figUnderlagValet = __mirrorFigur.underlagValet;
const _figUnderlagProva = __mirrorFigur.underlagProva;
const _figUnderlagBeskrivning = __mirrorFigur.underlagBeskrivning;
const _figNamnIMening = __mirrorFigur.namnIMening;
/* eslint-enable */

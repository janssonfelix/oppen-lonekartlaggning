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
export const TERM_BEGREPP = /** @type {const} */ (['enhet', 'jamforelse', 'kod', 'namn', 'huvudomrade', 'niva']);
/** Ordformerna per begrepp. Den korta formen är valfri och står inte här; vakten prövar inte "AID" ensamt. */
export const TERM_FORMER = /** @type {const} */ (['en', 'bf', 'fl', 'bfl']);
/** Högsta längd för en ordform. */
export const TERM_MAX = 40;

/** Standarduppsättningen. @type {Termer} */
export const STANDARDTERMER = Object.freeze({
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
export function skapaTermer(egna) {
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

/**
 * Genitiv: ordet + "s", utom när det slutar på s, x eller z ("AID-etikettens", "huvudområdets", "BAS-intervalls").
 * En förkortning med bara versaler får kolon: "ABC:s".
 */
export function genitiv(ord) {
    const t = String(ord ?? '');
    if (!t.trim()) return '';
    if (/^[A-ZÅÄÖ]{2,}$/.test(t)) return t + ':s';
    return /[sxz]$/i.test(t) ? t : t + 's';
}

/** Stor begynnelsebokstav: "huvudområde" → "Huvudområde". Resten av texten rörs inte. */
export function stor(text) {
    const t = String(text ?? '');
    return t.charAt(0).toLocaleUpperCase('sv') + t.slice(1);
}

/**
 * Artikeln efter genus och antal: en/ett, med `bestamd` den/det, i plural de (bestämd) eller ingen (obestämd).
 * @param {{ genus: Genus }} b  ett begrepp, eller bara genus för ett ord utanför termerna
 * @param {{ bestamd?: boolean, plural?: boolean }} [val]
 */
export function artikel(b, { bestamd = false, plural = false } = {}) {
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
export function adjektiv(stam, b, { bestamd = false, plural = false } = {}) {
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
export function termFras(b, form = 'en', { adjektiv: adj, genitiv: gen = false } = {}) {
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
export function ordForAntal(n, b) {
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
export function fyllTermer(mall, termer = STANDARDTERMER) {
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

/** Alla ordformer i en uppsättning, längsta först (termvakten i tests/termer.test.js). */
export function termformer(termer = STANDARDTERMER) {
    const ord = new Set();
    for (const b of TERM_BEGREPP) for (const f of TERM_FORMER) ord.add(termer[b][f]);
    return [...ord].sort((a, b) => b.length - a.length);
}

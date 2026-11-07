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

export const IMPORTPROFIL_FORMAT = 'lonekartlaggning-importprofiler';
export const IMPORTPROFIL_VERSION = 1;
/** Rollerna i kolumnmappningens ordning; de fem första är obligatoriska. */
export const IMPORTPROFIL_ROLLER = ['bas', 'yrke', 'lon', 'alder', 'kon', 'poang', 'ansvar'];
export const OBLIGATORISKA_ROLLER = ['bas', 'yrke', 'lon', 'alder', 'kon'];
/** Källorna i prioritetsordning: organisationspaketets profiler prövas först, de inbyggda sist. */
export const IMPORTPROFIL_KALLOR = ['organisationspaket', 'konfiguration', 'inbyggd'];
export const MAX_PROFILER = 50;
export const MAX_RUBRIKER_PER_ROLL = 20;
export const MAX_TEXT = 80;

const PNR = /\b(19|20)?\d{6}[-+]?\d{4}\b/;
const EPOST = /\S+@\S+\.\S+/;
// Styrtecken och HTML-metatecken tas bort. Rubrikerna jämförs ändå utan andra tecken än a–z och 0–9 (se nedan),
// så det ändrar aldrig vilken kolumn en profil pekar på.
const BORT = /[\u0000-\u001f\u007f<>"'&]/g;

/** Rubriken som den jämförs: gemener, bara a–z och 0–9 (samma regel som autoDetectColumnMap i appen). */
export function normaliseraRubrik(s) {
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
export function valideraImportprofil(o, { kalla } = {}) {
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
        kannetecken = OBLIGATORISKA_ROLLER.filter(r => rubriker[r]).map(r => rubriker[r][0]);
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
export function valideraImportprofiler(lista, val = {}) {
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
export function matchaImportprofil(rubriker, profiler) {
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
 * roller måste vara mappade; kännetecknen är de obligatoriska rollernas rubriker.
 * @param {{namn:string, kalla:string, mappning:{[roll:string]: string|null|undefined}, rubriker:string[]}} u
 */
export function profilFranMappning({ namn, kalla, mappning, rubriker }) {
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
export function importprofilerTillJson(profiler) {
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
export const INBYGGDA_PROFILER = Object.freeze([
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
export function inbyggdaProfiler() {
    return INBYGGDA_PROFILER;
}

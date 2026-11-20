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
 * Rubriken för varje fält i ALLOWED_FIELDS bland lönefilens rubriker (_rubrikForRoll: kolumnmappningen, importprofilen,
 * namnet). Slås upp en gång per fil; en ändrad mappning läser in filen på nytt.
 */
function _lonefilensRubriker(headers) {
    const rubriker = {};
    for (const role of Object.keys(ALLOWED_FIELDS)) rubriker[role] = _rubrikForRoll(headers, ALLOWED_FIELDS[role], role);
    return rubriker;
}
/** Radens värde för rollen, som getField: tom sträng när filen saknar kolumnen. */
function _faltIRad(row, rubriker, roll) {
    return rubriker[roll] == null ? '' : row[rubriker[roll]] ?? '';
}

/**
 * Extraherar ENBART vitlistade fält ur en CSV-rad — GDPR Art. 5(1)(c) uppgiftsminimering.
 * Säkerställer att verktyget aldrig laddar identifierande fält (PNR, namn, e-post)
 * även om användarens CSV innehåller dem. Ansvar läses inte in (se avgränsningen i docs/utveckling/mal.md).
 * Här slås råvärdena upp i raden (rubrikerna ur _lonefilensRubriker, och den godkända ansvarskolumnen); tolkningen
 * görs av tolkaLonerad i src/lib/inlasning.js, med innevarande år som referensår för
 * födelseår i ålderskolumnen. Talen, normaliseringarna, _cleanYrkeField och detectSensitiveColumns ligger också där
 * och nås under samma namn genom spegeln.
 * @param {Object<string,*>} row - Rå CSV-rad (PapaParse-objekt).
 * @param {Object<string,string|undefined>} [rubriker] - Uppslaget för filen; utan det slås det upp på radens nycklar.
 */
function extractMinimalRecord(row, rubriker = _lonefilensRubriker(Object.keys(row))) {
    const falt = roll => _faltIRad(row, rubriker, roll);
    return _ilTolkaLonerad({
        bas:    falt('bas'),
        kon:    falt('kon'),
        lon:    falt('lon'),
        alder:  falt('alder'),
        poang:  falt('poang'),
        yrke:   falt('yrke'),
        ansvar: state.ansvarKolumn ? row[state.ansvarKolumn.namn] : undefined
    }, new Date().getFullYear(), !!state.ansvarKolumn);
}

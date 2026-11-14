// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
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
 * Klass efter verktygets definition (konsklassNu, ADR-60): 'kvinnodominerat', 'icke-kvinnodominerat' (mansdominerat) eller 'blandat'.
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
    // Samma definition som resten av verktyget (ADR-60); likvärdighetsanalysen läser bara kvAndel.
    const kl = konsklassNu(kvAndel);
    const klass = kl === 'kvinnodominerad' ? 'kvinnodominerat' : kl === 'mansdominerad' ? 'icke-kvinnodominerat' : 'blandat';
    return { kvAndel, klass, prefix: ref.prefix || s.slice(0, 3), niva: ref.niva, del: ref.del, kalla: _skrReferensInfo().kalla };
}

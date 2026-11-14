// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson

// ---- Termerna (ADR-74) ----
// Orden för AID:s begrepp står i src/lib/termer.js, speglad i 09-lib-speglar.js. Den här delen kommer efter
// spegeln, så att T finns när flikarna ritas. Texter byggs med T och hjälparna, aldrig med orden själva:
//   `${T.enhet.fl} i samma ${T.niva.en}`                         → "AID-etiketter i samma BAS-intervall"
//   `${termArtikel(T.enhet)} ${termFras(T.enhet, 'en', { adjektiv: 'kvinnodominerad' })}`
//                                                                → "en kvinnodominerad AID-etikett"
//   `${termGenitiv(T.enhet.bf)} median`                           → "AID-etikettens median"
//   `${n} ${termForAntal(n, T.enhet)}`                            → "1 AID-etikett", "3 AID-etiketter"
// Fast text, som ordlistan och index.html, skrivs som mall och fylls med termText: "{Enhet.bfl} i samma {niva.en}".
// I index.html bär elementet mallen i data-term-template (och data-term-attr när mallen gäller ett attribut, till
// exempel data-tip); applyProfileLabels fyller dem, och standardtexten står kvar i elementet för sidan utan skript.

/** Den gällande uppsättningen termer. */
const T = _tmSkapa();

/** Fyller en mall med de gällande termerna; andra klamrar ({k}, {golv}) står kvar. */
function termText(mall) {
    return _tmFyll(mall, T);
}


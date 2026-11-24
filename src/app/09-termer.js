// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
import { fyllTermer, skapaTermer } from '../lib/termer.js';

// ---- Termerna (ADR-74) ----
// Orden för AID:s begrepp står i src/lib/termer.js. Texter byggs med T och hjälparna i src/lib/termer.js, aldrig med orden själva:
//   `${T.enhet.fl} i samma ${T.niva.en}`                         → "AID-etiketter i samma BAS-intervall"
//   `${artikel(T.enhet)} ${termFras(T.enhet, 'en', { adjektiv: 'kvinnodominerad' })}`
//                                                                → "en kvinnodominerad AID-etikett"
//   `${genitiv(T.enhet.bf)} median`                           → "AID-etikettens median"
//   `${n} ${ordForAntal(n, T.enhet)}`                            → "1 AID-etikett", "3 AID-etiketter"
// Fast text, som ordlistan och index.html, skrivs som mall och fylls med termText: "{Enhet.bfl} i samma {niva.en}".
// I index.html bär elementet mallen i data-term-template (och data-term-attr när mallen gäller ett attribut, till
// exempel data-tip); tillampaProfiletiketter fyller dem, och standardtexten står kvar i elementet för sidan utan skript.

/** Den gällande uppsättningen termer. */
export const T = skapaTermer();

/** Fyller en mall med de gällande termerna; andra klamrar ({k}, {golv}) står kvar. */
export function termText(mall) {
    return fyllTermer(mall, T);
}


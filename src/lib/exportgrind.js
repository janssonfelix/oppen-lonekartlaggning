// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
/**
 * Öppen lönekartläggning — exportgrindens regel (ADR-40, ADR-51).
 *
 * Flera exporter läser tabeller och diagram ur sidan, och en flik ritas om först när den öppnas. Varje gång något
 * som styr vad som får visas ändras (tröskeln, läget mellan skärm och export) ökar en räknare, generationen, och
 * appen minns vid vilken generation varje flik senast ritades klart. Regeln här avgör, med de talen som argument,
 * om en flik måste ritas innan något får läsas ur den och om den då får läsas. Själva omritningen och sidan sköts
 * av appen (src/app/23-exportgrind.js). Ingen DOM, inget state.
 */

/**
 * Ritades fliken före den senaste ändringen, utan att ha ritats om sedan dess? En flik som aldrig ritats
 * (`ritadVid` undefined) är inte inaktuell: den bär inget att läsa.
 * @param {number|undefined} ritadVid generationen då fliken senast ritades klart
 * @param {number} generation generationen som gäller nu
 */
export function flikInaktuellVid(ritadVid, generation) {
    return ritadVid !== undefined && ritadVid !== generation;
}

/**
 * Måste fliken ritas innan något läses ur den? Ja när den är inaktuell, och i exportläget också när den aldrig
 * ritats genom navigeringen (en vy kan ha ritat den direkt med skärmens tröskel). En flik som ritas just nu får
 * läsa sina egna tabeller och diagram.
 * @param {number|undefined} ritadVid
 * @param {number} generation
 * @param {{ritasNu?: boolean, exportLage?: boolean}} [lage]
 */
export function skaRitasForeExport(ritadVid, generation, { ritasNu = false, exportLage = false } = {}) {
    if (ritasNu) return false;
    return flikInaktuellVid(ritadVid, generation) || (exportLage && ritadVid === undefined);
}

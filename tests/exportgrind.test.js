// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
/**
 * Exportgrindens regel i src/lib/exportgrind.js, med generationerna som argument: när en flik måste ritas innan något
 * läses ur den. Att appen ritar om, och att ingen export läser en flik som ritats med en annan tröskel, prövas i
 * tests/ktroskel.test.js och av invarianten (tests/helpers/ktroskel-invariant.js).
 */
import { describe, it, expect } from 'vitest';
import { flikInaktuellVid, skaRitasForeExport } from '../src/lib/exportgrind.js';

describe('[I4] exportgrinden: ingen export läser en flik som ritats före den senaste ändringen', () => {
    it('flikInaktuellVid: ritad vid en äldre generation är inaktuell; aldrig ritad och ritad nu är det inte', () => {
        expect(flikInaktuellVid(3, 4)).toBe(true);
        expect(flikInaktuellVid(4, 4)).toBe(false);
        expect(flikInaktuellVid(undefined, 4)).toBe(false);
    });
    it('skaRitasForeExport: en inaktuell flik ritas först, i båda lägena', () => {
        expect(skaRitasForeExport(3, 4)).toBe(true);
        expect(skaRitasForeExport(3, 4, { exportLage: true })).toBe(true);
        expect(skaRitasForeExport(4, 4)).toBe(false);
        expect(skaRitasForeExport(4, 4, { exportLage: true })).toBe(false);
    });
    it('i exportläget ritas också en flik som aldrig ritats genom navigeringen; på skärmen inte', () => {
        expect(skaRitasForeExport(undefined, 4, { exportLage: true })).toBe(true);
        expect(skaRitasForeExport(undefined, 4)).toBe(false);
    });
    it('en flik som ritas just nu får läsa sina egna tabeller och diagram', () => {
        expect(skaRitasForeExport(3, 4, { ritasNu: true, exportLage: true })).toBe(false);
        expect(skaRitasForeExport(undefined, 4, { ritasNu: true, exportLage: true })).toBe(false);
    });
});

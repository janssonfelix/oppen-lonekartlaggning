// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
/**
 * Gränserna för inställningarna och för inlästa filer (src/lib/installningsgranser.js): siffrorna,
 * den rena prövningen, och att appen prövar filstorleken innan filen läses eller tolkas. Filerna är påhittade, och
 * en stor fil görs med en storlek som bara låtsas vara stor (inga 50 MB data).
 */
import { describe, it, expect, vi } from 'vitest';
import { createAppWindow } from './helpers/app-harness.js';
import { papa, vanta, csvFil } from './helpers/granssnitt-rigg.js';
import { PO_PCT_GRANS, MANADER_GRANS, PRIO_TROSKEL_GRANS, PRIO_VIKT_GRANS, FIL_MAX, installningsGrans, arInomGrans, filStorlekFel } from '../src/lib/installningsgranser.js';
import { PAKET_MAX_BYTE } from '../src/lib/organisationspaket.js';

const MB = 1024 * 1024;
const storlek = (fil, bytes) => { Object.defineProperty(fil, 'size', { value: bytes }); return fil; };

describe('gränsernas siffror: de som fälten i Inställningar redan använder', () => {
    it('PO-påslaget är 0–100 procent och månaderna 1–60', () => {
        expect(PO_PCT_GRANS).toEqual({ min: 0, max: 100 });
        expect(MANADER_GRANS).toEqual({ min: 1, max: 60 });
    });
    it('prioriteringens trösklar och viktning har samma intervall som fälten', () => {
        expect(PRIO_TROSKEL_GRANS.atgardThreshold).toEqual({ min: -50, max: 0 });
        expect(PRIO_TROSKEL_GRANS.akutMinN).toEqual({ min: 1, max: 500 });
        expect(PRIO_TROSKEL_GRANS.bevakaThreshold).toEqual({ min: -50, max: 0 });
        expect(PRIO_TROSKEL_GRANS.analyseraThreshold).toEqual({ min: 0, max: 50 });
        for (const k of ['avvikelse', 'volym', 'jamstalldhet']) expect(PRIO_VIKT_GRANS[k]).toEqual({ min: 0, max: 100 });
    });
    it('filgränserna: lönefil 50 MB, ställningstagande och jämförelsestatistik 20 MB, konfiguration och paket 5 MB', () => {
        expect(FIL_MAX).toEqual({ lonefil: 50 * MB, stallningstagande: 20 * MB, jamforelsestatistik: 20 * MB, konfiguration: 5 * MB, paket: 5 * MB });
    });
    it('organisationspaketets gräns är samma tal som FIL_MAX.paket, och det finns ingen andra källa', () => {
        expect(PAKET_MAX_BYTE).toBe(FIL_MAX.paket);
    });
});

describe('installningsGrans', () => {
    it('ger gränsen för varje inställning, och en okänd nyckel är ett fel', () => {
        expect(installningsGrans('poPct')).toBe(PO_PCT_GRANS);
        expect(installningsGrans('manader')).toBe(MANADER_GRANS);
        expect(installningsGrans('prioTroskel')).toBe(PRIO_TROSKEL_GRANS);
        expect(installningsGrans('prioVikt')).toBe(PRIO_VIKT_GRANS);
        expect(installningsGrans('fil')).toBe(FIL_MAX);
        expect(() => installningsGrans('toString')).toThrow(/Okänd inställning/);
    });
});

describe('arInomGrans', () => {
    it('gränsvärdena räknas med', () => {
        expect(arInomGrans(0, PO_PCT_GRANS)).toBe(true);
        expect(arInomGrans(100, PO_PCT_GRANS)).toBe(true);
        expect(arInomGrans(39.15, PO_PCT_GRANS)).toBe(true);
    });
    it('värden utanför, och värden som inte är ändliga tal, ligger utanför', () => {
        expect(arInomGrans(100.01, PO_PCT_GRANS)).toBe(false);
        expect(arInomGrans(-0.5, PO_PCT_GRANS)).toBe(false);
        expect(arInomGrans(NaN, PO_PCT_GRANS)).toBe(false);
        expect(arInomGrans(Infinity, PO_PCT_GRANS)).toBe(false);
        expect(arInomGrans('50', PO_PCT_GRANS)).toBe(false);
        expect(arInomGrans(undefined, PO_PCT_GRANS)).toBe(false);
    });
});

describe('filStorlekFel', () => {
    it('en fil på gränsen eller under får läsas in', () => {
        expect(filStorlekFel(FIL_MAX.lonefil, 'lonefil')).toBeNull();
        expect(filStorlekFel(1234, 'konfiguration')).toBeNull();
    });
    it('en fil över gränsen får ett meddelande som säger gränsen', () => {
        expect(filStorlekFel(FIL_MAX.lonefil + 1, 'lonefil')).toBe('Lönefilen är för stor för att läsas in (högst 50 MB).');
        expect(filStorlekFel(21 * MB, 'stallningstagande')).toBe('Filen med ställningstagandet är för stor för att läsas in (högst 20 MB).');
        expect(filStorlekFel(6 * MB, 'konfiguration')).toBe('Konfigurationsfilen är för stor för att läsas in (högst 5 MB).');
    });
    it('en okänd storlek räknas inte som för stor', () => {
        expect(filStorlekFel(NaN, 'lonefil')).toBeNull();
    });
});

describe('appen prövar filstorleken innan filen läses', () => {
    it('lönefilen över 50 MB: meddelandet, och ingen tolkning påbörjas', () => {
        const w = createAppWindow();
        const lasArrayBuffer = vi.spyOn(w.FileReader.prototype, 'readAsArrayBuffer');
        w.loadStructureFile(storlek(csvFil(w, ['BAS;Månadslön;Ålder;Kön;AID', 'C;30000;40;Kvinna;207011']), 51 * MB));
        expect(w.document.getElementById('data-status').textContent).toBe('Lönefilen är för stor för att läsas in (högst 50 MB).');
        expect(lasArrayBuffer).not.toHaveBeenCalled();
        expect(w.__state.data).toHaveLength(0);
    });

    it('ställningstagandet över 20 MB ger felet i stället för att läsa filen', () => {
        const w = createAppWindow();
        papa(w);
        const lasArrayBuffer = vi.spyOn(w.FileReader.prototype, 'readAsArrayBuffer');
        let utfall = null;
        w.readTabularFile(storlek(csvFil(w, ['BAS;Median', 'C;30000']), 21 * MB), [['bas'], ['median']], res => { utfall = res; }, 'stallningstagande');
        expect(utfall).toEqual({ ok: false, error: 'Filen med ställningstagandet är för stor för att läsas in (högst 20 MB).' });
        expect(lasArrayBuffer).not.toHaveBeenCalled();
    });

    it('jämförelsestatistiken över 20 MB ger felet i stället för att läsa filen', () => {
        const w = createAppWindow();
        papa(w);
        const lasArrayBuffer = vi.spyOn(w.FileReader.prototype, 'readAsArrayBuffer');
        let utfall = null;
        w.readTabularFile(storlek(csvFil(w, ['AID;Median', '5301;31000']), 21 * MB), [['aid'], ['median']], res => { utfall = res; }, 'jamforelsestatistik');
        expect(utfall.ok).toBe(false);
        expect(utfall.error).toMatch(/jämförelsestatistiken är för stor.*20 MB/);
        expect(lasArrayBuffer).not.toHaveBeenCalled();
    });

    it('ställningstagandet under 20 MB läses in som förut', async () => {
        const w = createAppWindow();
        papa(w);
        let utfall = null;
        w.readTabularFile(csvFil(w, ['BAS;Median', 'C;30000', 'D;31000']), [['bas'], ['median']], res => { utfall = res; }, 'stallningstagande');
        await vanta(() => utfall);
        expect(utfall.ok).toBe(true);
        expect(utfall.rows).toHaveLength(2);
    });

    it('konfigurationsfilen över 5 MB: meddelandet, och ingen fil läses', () => {
        const w = createAppWindow();
        const lasText = vi.spyOn(w.FileReader.prototype, 'readAsText');
        const knapp = w.document.getElementById('btn-config-load');
        const fil = storlek(new w.File(['{}'], 'konfiguration.json', { type: 'application/json' }), 6 * MB);
        Object.defineProperty(knapp, 'files', { value: [fil], configurable: true });
        knapp.dispatchEvent(new w.Event('change'));
        expect(w.document.getElementById('config-status').textContent).toBe('Konfigurationsfilen är för stor för att läsas in (högst 5 MB).');
        expect(lasText).not.toHaveBeenCalled();
    });
});

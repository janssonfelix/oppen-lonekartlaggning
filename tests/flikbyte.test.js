/**
 * Flikbytet: rita först, räkna sedan (ADR-80, 31-navigering.js). Användarens eget flikbyte visar fliken och låter
 * sidan målas innan fliken räknas, och tunga block ritas efter flikens övre del, vart och ett i en egen uppgift.
 * Vaktar det som inte får hända: att en flik som användaren redan lämnat ritas, att ett block ritar ett resultat ur
 * en tröskel som inte längre gäller, och att exportläget och direkta anrop av ritaFlik slutar rita synkront.
 *
 * Ett klick från koden (el.click()) är inte användarens eget och ritar synkront, så testerna byter flik
 * med klickaFlik(nav, { uppskjut: true }), samma väg som ett klick i menyn tar.
 */
import { describe, it, expect } from 'vitest';
import { createAppWindow } from './helpers/app-harness.js';

const nav = (w, flik) => w.document.querySelector(`.nav-item[data-tab="${flik}"]`);
const byt = (w, flik) => w.klickaFlik(nav(w, flik), { uppskjut: true });
const runda = (w, flik) => w.eval(`_flikRunda.get(${JSON.stringify(flik)}) || 0`);
/** Väntar tills ingenting i sidan räknas (ingen panel eller behållare med aria-busy) och kön är tom. */
async function vantaKlart(w) {
    for (let i = 0; i < 500; i++) {
        await new Promise(r => setTimeout(r, 10));
        if (!w.document.querySelector('[aria-busy="true"]') && w.eval('_blockKo.length') === 0) return;
    }
    throw new Error('fliken blev aldrig färdigritad');
}
/** Räknar anropen av en ritfunktion i appen och vilken tröskel som gällde vid varje. */
function spionera(w, namn) {
    const anrop = [];
    const orig = w[namn];
    w[namn] = function (...a) { anrop.push({ k: w.eval('kInstalld()'), lage: w.eval('state.kLage') }); return orig.apply(this, a); };
    return anrop;
}

describe('Flikbytet: rita först, räkna sedan', () => {
    it('fliken syns och markeras som räknas innan den ritas; sedan ritas den och markeringen går bort', async () => {
        const w = createAppWindow(); w.__lasInDemodata();
        const d = w.document, fore = runda(w, 'struktur');
        byt(w, 'struktur');
        const panel = d.getElementById('view-struktur');
        expect(panel.style.display).toBe('block');
        expect(nav(w, 'struktur').classList.contains('active')).toBe(true);
        expect(panel.getAttribute('aria-busy')).toBe('true');
        expect(panel.querySelector(':scope > .flik-raknas').getAttribute('role')).toBe('status');
        expect(d.getElementById('view-regression').getAttribute('aria-busy')).toBe('true');   // hela gruppens paneler
        expect(runda(w, 'struktur')).toBe(fore);                                               // inte räknad än
        await vantaKlart(w);
        expect(runda(w, 'struktur')).toBe(fore + 1);
        expect(panel.hasAttribute('aria-busy')).toBe(false);
        expect(panel.querySelector('.flik-raknas')).toBeNull();
        expect(d.querySelector('#view-regression .block-raknas')).toBeNull();
        expect(d.getElementById('regression-card').innerHTML).not.toBe('');
        expect(w.eval('_ritadVid.get("struktur") === ritGeneration()')).toBe(true);           // exportgrinden: färdigritad
    });

    it('ett andra flikbyte under väntan avbryter det första: bara den sist valda fliken ritas', async () => {
        const w = createAppWindow(); w.__lasInDemodata();
        const struktur = runda(w, 'struktur'), rapport = runda(w, 'rapporttext');
        byt(w, 'struktur');
        byt(w, 'rapporttext');
        expect(w.document.getElementById('view-struktur').hasAttribute('aria-busy')).toBe(false);
        await vantaKlart(w);
        expect(runda(w, 'struktur')).toBe(struktur);       // den första fliken ritades aldrig
        expect(runda(w, 'rapporttext')).toBe(rapport + 1);
        expect(w.document.querySelector('#rapportunderlag-innehall .ru-block')).not.toBeNull();
    });

    it('ett block som väntar ritar inget när användaren har gått vidare, och fliken räknas då som inte ritad', async () => {
        const w = createAppWindow(); w.__lasInDemodata();
        nav(w, 'rapporttext').click();
        const anrop = spionera(w, 'ritaRapportunderlag');
        // Fliken ritas som från ett flikbyte: rapportunderlaget får en platshållare och väntar.
        w.eval('_uppskjutNasta = "rapporttext"; ritaFlik("rapporttext")');
        const host = w.document.getElementById('rapportunderlag-innehall');
        expect(host.getAttribute('aria-busy')).toBe('true');
        expect(host.querySelector('.block-raknas')).not.toBeNull();
        expect(anrop).toHaveLength(0);
        expect(w.eval('_ritadVid.has("rapporttext")')).toBe(false);   // exportgrinden ritar om fliken innan något läses
        nav(w, 'dashboard').click();
        await vantaKlart(w);
        expect(anrop).toHaveLength(0);
        expect(w.eval('_ritadVid.has("rapporttext")')).toBe(false);
    });

    it('en ändrad tröskel under väntan ger inget resultat ur den gamla tröskeln', async () => {
        const w = createAppWindow(); w.__lasInDemodata();
        nav(w, 'dokumentera').click();
        const anrop = spionera(w, 'ritaExportBesked');
        w.eval('_uppskjutNasta = "dokumentera"; ritaFlik("dokumentera")');
        expect(w.document.querySelector('#besked-excel .block-raknas')).not.toBeNull();
        // Tröskeln ändras utan omritning (som en anropare som ritar själv senare): blocket ritar inget ur den gamla
        // tröskeln, utan fliken ritas om från början med den nya.
        expect(w.eval('sattKTroskel(12, { fraga: false, rita: false }).ok')).toBe(true);
        await vantaKlart(w);
        expect(anrop.length).toBeGreaterThan(0);
        expect(anrop.every(a => a.k === 12 && a.lage === 'export')).toBe(true);
        expect(w.document.getElementById('besked-excel').textContent).toMatch(/färre än 12 /);
        expect(w.eval('_ritadVid.get("dokumentera") === ritGeneration()')).toBe(true);
    });

    it('en ändrad tröskel med omritning tar över: det väntande blocket ritar inget', async () => {
        const w = createAppWindow(); w.__lasInDemodata();
        nav(w, 'dokumentera').click();
        w.eval('_uppskjutNasta = "dokumentera"; ritaFlik("dokumentera")');
        const anrop = spionera(w, 'ritaExportBesked');
        w.eval('sattKTroskel(13, { fraga: false })');   // ritar om den öppna fliken direkt
        expect(anrop.map(a => a.k)).toEqual([13]);
        await vantaKlart(w);
        expect(anrop.map(a => a.k)).toEqual([13]);       // det väntande blocket från tröskeln 10 ritade inget
        expect(w.document.getElementById('besked-excel').textContent).toMatch(/färre än 13 /);
    });

    it('exportläget, direkta anrop av ritaFlik och klick från koden ritar synkront', () => {
        const w = createAppWindow(); w.__lasInDemodata();
        const d = w.document;
        nav(w, 'rapporttext').click();
        expect(d.getElementById('view-rapporttext').hasAttribute('aria-busy')).toBe(false);
        expect(d.querySelector('#rapportunderlag-innehall .ru-block')).not.toBeNull();
        d.getElementById('rapportunderlag-innehall').innerHTML = '';
        w.eval('medExportLage(() => ritaFlik("rapporttext"))');
        expect(d.querySelector('#rapportunderlag-innehall .ru-block')).not.toBeNull();
        expect(d.querySelector('[aria-busy="true"]')).toBeNull();
        w.__ritaFlik('dokumentera');
        expect(d.getElementById('besked-excel').textContent).toMatch(/Innehåller/);
        nav(w, 'struktur').click();
        expect(d.getElementById('regression-card').innerHTML).not.toBe('');
        expect(w.eval('_blockKo.length')).toBe(0);
    });
});

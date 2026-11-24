// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
// Varningen om personnamn i fältet för AID-etikett: inläsningen räknar raderna vars text har ett namnmönster och står
// på högst två rader i filen (yrkeNamnNyckel och sallsyntaNamnrader i src/lib/inlasning.js) och sparar bara antalet och
// de första radnumren; varningen står i förhandskontrollen och i Att göra, med samma text (namnIYrkesfaltetText i
// src/lib/forhandskontroll.js), och inläsningsrapporten har en kort rad med antalet och radnumren
// (namnIYrkesfaltetRadnr, samma formulering som i varningen). Demona ska inte ge någon varning.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createAppWindow } from './helpers/app-harness.js';
import { papa, vanta, csvFil, rot } from './helpers/granssnitt-rigg.js';
import { yrkeLiknarNamn } from '../src/lib/inlasning.js';
import { namnIYrkesfaltetText, namnIYrkesfaltetRadnr } from '../src/lib/forhandskontroll.js';

const status = w => w.document.getElementById('data-status').textContent;
// Klart först när underlaget finns: statusraden kan bära en äldre text (till exempel efter Rensa all data) innan
// inläsningen har hunnit börja, och då var väntan förut över för tidigt när maskinen var belastad.
const vantaPaInlasning = w => vanta(() => status(w) && !/läser|Läser/.test(status(w)) && w.__state.dataAudit && w.__state.data.length > 0);
const lasIn = async (w, rader, namn = 'lonefil.csv') => {
    papa(w);
    w.document.getElementById('data-status').textContent = '';
    w.lasInStrukturfil(csvFil(w, rader, namn));
    await vantaPaInlasning(w);
};
// 30 påhittade rader; rad 5 och 19 i filen (i = 3 och 17) har ett namn i fältet för AID-etikett.
const NAMNRADER = { 3: '207011 Anna Andersson', 17: '207011 Berg, Lisa' };
const tabell = () => {
    const rader = [['BAS-intervall', 'AID', 'Manadslon', 'Alder', 'Kon']];
    for (let i = 0; i < 30; i++) rader.push(['C', NAMNRADER[i] || '207011 Handläggare', String(30000 + i * 10), String(30 + i), i % 2 ? 'Man' : 'Kvinna']);
    return rader;
};
const csv = () => tabell().map(r => r.join(';'));
const TEXT = namnIYrkesfaltetText(2, [5, 19]);
// Inläsningsrapportens rad: kort etikett, radnumren som dämpat exempel och antalet som värde.
const vantadRapportrad = rad => {
    expect(rad).toBeTruthy();
    expect(rad.textContent).not.toContain(TEXT);
    expect(rad.querySelector('.dvr-value').textContent).toBe('2');
    expect(rad.querySelector('.text-dampad-xs').textContent).toBe('rad 5 och 19');
    expect(rad.textContent.replace(/\s+/g, ' ')).toMatch(/Personnamn i fältet för AID-etikett: rad 5 och 19/);
};
const avsnitt = w => w.document.getElementById('avsnitt-fi-forhandskontroll');
const punkt = w => w.eval('byggAtgardslista()').find(p => p.id === 'fk-yrke-namn');
const rapport = w => w.document.getElementById('data-validation-report');
const UTAN_NAMN = /Anna|Andersson|Berg|Lisa/;

describe('namn i fältet för AID-etikett: demona', () => {
    it('ingen yrkestext i det lilla demot, demots testdata eller det stora demot ser ut att innehålla ett namn', () => {
        const w = createAppWindow();
        const yrken = new Set([
            ...w.eval('genereraDemodata()').map(r => r.yrke),
            ...w.eval('genereraTestdata()').map(r => r.yrke),
            ...w.eval('genereraStortDemo()').map(r => r.yrke),
        ]);
        expect(yrken.size).toBeGreaterThan(10);
        expect([...yrken].filter(y => yrkeLiknarNamn(y))).toEqual([]);
    });
    it('ett inläst demo ger ingen varning', () => {
        const w = createAppWindow();
        w.__lasInDemodata();
        expect(rapport(w).querySelector('[data-dvr="yrke-namn"]')).toBeNull();
        expect(punkt(w)).toBeUndefined();
    });
});

describe('[B9.5] namn i fältet för AID-etikett: inläsningen', () => {
    it('en CSV med två namnrader: varningen står på de tre ställena, och tillståndet bär bara antal och radnummer', async () => {
        const w = createAppWindow();
        await lasIn(w, csv());
        expect(w.__state.data).toHaveLength(30);   // varningen stoppar inte inläsningen
        expect(TEXT).toMatch(/på 2 rader \(rad 5 och 19\)/);
        expect(TEXT).toContain(`(${namnIYrkesfaltetRadnr(2, [5, 19])})`);
        // Förhandskontrollen.
        expect(w.__state.forhandskontroll.varningar.map(v => v.kod)).toContain('yrke-namn');
        expect(avsnitt(w).querySelector('.fk-varningar').textContent).toContain(TEXT);
        // Inläsningsrapporten.
        vantadRapportrad(rapport(w).querySelector('[data-dvr="yrke-namn"]'));
        // Att göra.
        expect(punkt(w)).toMatchObject({ kategori: 'Underlagets kvalitet', prioritet: 'hög', tab: 'filer', detalj: TEXT,
            titel: 'Förhandskontrollen: personnamn i uttaget' });
        // Tillståndet: antal och radnummer, och ingen namntext någonstans.
        expect(w.__state.dataAudit.yrkeNamn).toBe(2);
        expect(w.__state.dataAudit.yrkeNamnRadnr).toEqual([5, 19]);
        expect(JSON.stringify(w.__state.dataAudit)).not.toMatch(UTAN_NAMN);
        expect(JSON.stringify(w.__state.forhandskontroll.varningar)).not.toMatch(UTAN_NAMN);
        expect(JSON.stringify(punkt(w))).not.toMatch(UTAN_NAMN);
        // Fältet maskeras inte (ADR-85): texten står kvar i underlaget, och det är därför varningen finns.
        expect(w.__state.data[3].yrke).toBe('207011 Anna Andersson');
    });

    it('Rensa all data nollar räknaren och tar bort varningen, och en ren fil efteråt ger ingen', async () => {
        const w = createAppWindow();
        await lasIn(w, csv());
        expect(punkt(w)).toBeTruthy();
        w.eval('_rensaAllData()');
        expect(w.__state.dataAudit).toBeNull();
        expect(w.__state.forhandskontroll).toBeNull();
        expect(rapport(w).textContent).not.toContain('personnamn');
        await lasIn(w, csv().map((r, i) => (i ? r.replace(/207011 (Anna Andersson|Berg, Lisa)/, '207011 Handläggare') : r)), 'ren.csv');
        expect(w.__state.dataAudit.yrkeNamn).toBe(0);
        expect(w.__state.dataAudit.yrkeNamnRadnr).toEqual([]);
        expect(punkt(w)).toBeUndefined();
        expect(rapport(w).querySelector('[data-dvr="yrke-namn"]')).toBeNull();
    });

    it('en etikett med versal på två ord på många rader varnar inte; ett namn på tre rader är över gränsen', async () => {
        const w = createAppWindow();
        const rader = tabell().map((r, i) => (i === 0 ? r : [r[0], i <= 20 ? '207011 Sjuksköterska Natt' : i <= 23 ? '207011 Anna Andersson' : i === 24 ? '207011 Berg, Lisa' : '207011 Handläggare', ...r.slice(2)]));
        await lasIn(w, rader.map(r => r.join(';')));
        expect(w.__state.data).toHaveLength(30);
        expect(w.__state.dataAudit.yrkeNamn).toBe(1);   // bara "Berg, Lisa" på rad 25
        expect(w.__state.dataAudit.yrkeNamnRadnr).toEqual([25]);
        expect(punkt(w).detalj).toBe(namnIYrkesfaltetText(1, [25]));
    });

    it('en ny inläsning räknar om från noll', async () => {
        const w = createAppWindow();
        await lasIn(w, csv());
        await lasIn(w, csv(), 'igen.csv');
        expect(w.__state.dataAudit.yrkeNamn).toBe(2);
        expect(w.__state.dataAudit.yrkeNamnRadnr).toEqual([5, 19]);
    });

    it('Excel-vägen räknar likadant, med samma radnumrering', async () => {
        const w = createAppWindow();
        w.eval(readFileSync(join(rot, 'vendor', 'xlsx.mini.min.js'), 'utf8'));
        const X = w.XLSX;
        const wb = X.utils.book_new();
        X.utils.book_append_sheet(wb, X.utils.aoa_to_sheet(tabell()), 'Blad1');
        const buf = X.write(wb, { type: 'array', bookType: 'xlsx' });
        w.document.getElementById('data-status').textContent = '';
        w.lasInStrukturfil(new w.File([buf], 'lonefil.xlsx'));
        await vantaPaInlasning(w);
        expect(w.__state.data).toHaveLength(30);
        expect(w.__state.dataAudit.yrkeNamn).toBe(2);
        expect(w.__state.dataAudit.yrkeNamnRadnr).toEqual([5, 19]);
        expect(punkt(w).detalj).toBe(TEXT);
    });

    it('med Stoppa och visa förhandskontrollen innan inläsning står varningen bland de andra innan Läs in', async () => {
        const w = createAppWindow();
        w.eval('oppnaInstallningar()');
        const ruta = w.document.getElementById('inst-fk-stopp');
        ruta.checked = true;
        ruta.dispatchEvent(new w.Event('change', { bubbles: true }));
        w.eval('stangInstallningar()');
        await lasIn(w, csv());
        expect(w.__state.data).toHaveLength(0);
        expect(avsnitt(w).querySelector('.fk-varningar').textContent).toContain(TEXT);
        expect(punkt(w)).toBeUndefined();   // ingen data inläst ännu
        w.document.getElementById('fk-las-in').click();
        expect(w.__state.data).toHaveLength(30);
        expect(punkt(w).detalj).toBe(TEXT);
        vantadRapportrad(rapport(w).querySelector('[data-dvr="yrke-namn"]'));
    });
});

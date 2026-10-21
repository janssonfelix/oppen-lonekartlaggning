// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
// Prestandamätning av den BYGGDA artefakten på ett stort dataset.
//
// Varför: verktyget är byggt för en hel organisation, och det behövs en siffra
// på var det börjar kännas trögt. ADR-1 avvisar Web Workers och pekar ut
// main-tråds-chunking som vägen "vid faktiskt prestandabehov" — utan en siffra
// är det beslutet omöjligt att ta. Det här ger siffran, och gör den om körbar.
//
// Mäter genom den RIKTIGA vägen: en CSV genereras i minnet, laddas upp via
// file-inputen (så parsern körs på riktigt) och varje flik renderas i tur och
// ordning i Chromium. jsdom duger inte för det här.
//
//   npm run bundle && npm run perf            (55 000 rader)
//   node tools/perf-smoke.mjs --rader=120000  (annat n)
//
// VAKT: tiden tills gränssnittet är klart, med en snäv budget (5 s).
//
// Budgeten är snäv för att en O(n²)-loop ska synas: en sådan loop kan stå för
// ~8 s av inläsningen på 55 000 rader och ändå rymmas i en total budget på 60 s.
// En budget generös nog att tåla långsamma maskiner är för generös för att se
// en sådan loop.
//
// En skalningskontroll (inläsning på n/5 mot n) räcker inte: på de här
// storlekarna skalar en kvadratisk loop i praktiken bara ~7× per 5× data (cache
// och JIT), och blandad med den linjära basen ger den omkring 5× — som linjär kod.
//
// Budgeten är maskinberoende. Därför körs skriptet inte i CI utan inför en
// release, på en utvecklarmaskin. Normalt tar det ~2 s.

import { chromium } from 'playwright';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { byggTestCsv as byggCsv } from './lib/testdata.mjs';

const ROOT = process.cwd();
const arg = n => (process.argv.find(a => a.startsWith(`--${n}=`)) || '').split('=')[1];
// --fil=<sökväg> mäter ett annat bygge (t.ex. ett äldre, för jämförelse).
const FIL = arg('fil') || join(ROOT, 'dist', 'oppen-lonekartlaggning.html');
const RADER = Number(arg('rader') || 55000);
const BUDGET_MS = Number(arg('budget') || 60000);        // backstopp för hela svepet
const UI_BUDGET_MS = Number(arg('ui-budget') || 5000);   // uppladdning → gränssnitt klart

if (!existsSync(FIL)) {
    console.error('✗ oppen-lonekartlaggning.html saknas — kör `npm run bundle` först.');
    process.exit(1);
}

// Menyns flikar. kon = Ålder & karriär (inkl. demografi), utforska inkl.
// Löneöversikten, dokumentera = färdigcheck + rapportunderlag.
const FLIKAR = ['matrix', 'likvardighet', 'struktur', 'prioritering', 'loneoversyn',
                'handlingsplan', 'dokumentera', 'kon', 'benchmark', 'utforska', 'lonepolitik'];

const browser = await chromium.launch();
const sidfel = [];

// Mäter tiden från uppladdning tills verktyget är FÄRDIGT — inte bara tills
// statusraden visar antalet rader. Efter parsningen skjuts de tunga analyserna
// (bootstrap-KI, åtgärdslista, skevhet) upp till bakgrunden och statusraden får
// notisen "förbereder analyser i bakgrunden…" medan de körs. Klart = notisen
// har dykt upp och försvunnit igen.
async function mätInläsning(n) {
    const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
    page.on('pageerror', e => sidfel.push(String(e && e.message || e)));
    await page.goto('file://' + FIL);
    const csv = byggCsv(n);
    const t0 = Date.now();
    await page.setInputFiles('#file-input-data', {
        name: 'perf.csv', mimeType: 'text/csv', buffer: Buffer.from(csv, 'utf8')
    });
    await page.waitForFunction(() => /\d/.test(document.getElementById('data-status')?.textContent || ''),
        null, { timeout: 300000 });
    const tSynlig = Date.now() - t0;
    try {
        await page.waitForFunction(() => /förbereder analyser/.test(document.getElementById('data-status')?.textContent || ''),
            null, { timeout: 5000 });
    } catch { /* hann bli klar innan vi tittade — små dataset */ }
    await page.waitForFunction(() => !/förbereder analyser/.test(document.getElementById('data-status')?.textContent || ''),
        null, { timeout: 300000 });
    return { page, tSynlig, tKlar: Date.now() - t0, mb: csv.length / 1048576 };
}

console.log(`\nPrestandasvep — ${RADER.toLocaleString('sv-SE')} rader\n`);

const stor = await mätInläsning(RADER);
const page = stor.page;

const kolumn = (t, v) => `  ${t.padEnd(26)} ${String(v).padStart(7)} ms`;
const uiOk = stor.tSynlig <= UI_BUDGET_MS;
console.log(`  CSV: ${stor.mb.toFixed(1)} MB`);
console.log(kolumn('gränssnittet klart', stor.tSynlig)
    + (uiOk ? `   ✓ (budget ${UI_BUDGET_MS} ms)` : `   ✗ över budget ${UI_BUDGET_MS} ms`));
console.log(kolumn('bakgrundsanalyser klara', stor.tKlar));
console.log('');
const tParse = stor.tKlar;
// Fliken Jämförelse ritar bara med jämförelsestatistik: lägg in en syntetisk per AID och BAS.
/* global state -- funktionen nedan körs i sidan, där state finns */
await page.evaluate(() => {
    const par = [...new Set(state.data.map(r => `${r.aid}|${r.bas}`))];
    state.statistik = par.map(k => { const [aid, bas] = k.split('|'); return { aid, bas, median: 34000, p10: 30000, p90: 39000 }; });
    state.statistikHasP10 = true;
    state.statistikHasP90 = true;
});
let summa = tParse;
const långsamma = [];
for (const flik of FLIKAR) {
    const t = await page.evaluate(async namn => {
        const start = performance.now();
        try { renderTabContent(namn); } catch (e) { return { fel: String(e && e.message || e) }; }
        await new Promise(r => requestAnimationFrame(() => r()));
        return { ms: Math.round(performance.now() - start) };
    }, flik);
    if (t.fel) { console.log(`  ${flik.padEnd(26)}   KASTADE: ${t.fel}`); långsamma.push(flik); continue; }
    summa += t.ms;
    const flagga = t.ms > 5000 ? '  ← långsam' : '';
    console.log(`  ${flik.padEnd(26)} ${String(t.ms).padStart(7)} ms${flagga}`);
    if (t.ms > 5000) långsamma.push(flik);
}

// Utforska med två dimensioner — den tyngsta kombinationen (yrke inom BAS × lönespann).
const tUtforska2d = await page.evaluate(() => {
    document.getElementById('explore-rad').value = 'aidbas';
    document.getElementById('explore-kolumn').value = 'lonespann';
    const t0 = performance.now();
    renderExplorer();
    return Math.round(performance.now() - t0);
});
console.log(kolumn('Utforska, yrke inom BAS × lönespann', tUtforska2d));

// Omritningen av alla flikar efter ändrad minsta gruppstorlek (den stegvisa vägen från gränssnittet), och de
// tyngsta delarna i Ålder & karriär var för sig — där ligger flest diagram.
/* global sattKTroskel, getData, renderKonTathet, renderKonMultiplar, individLitenFor, renderDemografi -- funktionerna nedan körs i sidan, där de finns */
const tTroskel = await page.evaluate(async () => {
    if (typeof sattKTroskel !== 'function') return null;
    const t0 = performance.now();
    const r = sattKTroskel(11, { fraga: false, stegvis: true });
    if (r && r.klar) await r.klar;
    const ms = Math.round(performance.now() - t0);
    const r2 = sattKTroskel(10, { fraga: false, stegvis: true });
    if (r2 && r2.klar) await r2.klar;
    return ms;
});
if (tTroskel != null) console.log(kolumn('Ändrad tröskel: det som syns ritas om', tTroskel));
const tKonDelar = await page.evaluate(() => {
    const ut = {}, d = typeof getData === 'function' ? getData() : [];
    const mat = (namn, fn) => { if (typeof fn !== 'function') return; const t0 = performance.now(); try { fn(); } catch (_e) { /* mäts ändå */ } ut[namn] = Math.round(performance.now() - t0); };
    mat('  täthetskurvor', typeof renderKonTathet === 'function' ? () => renderKonTathet() : null);
    mat('  små multiplar', typeof renderKonMultiplar === 'function' ? () => renderKonMultiplar() : null);
    mat('  individLitenFor', typeof individLitenFor === 'function' ? () => { const f = individLitenFor(d); d.filter(f); } : null);
    mat('  demografi', typeof renderDemografi === 'function' ? () => renderDemografi('__ALLA__') : null);
    return ut;
});
for (const [namn, ms] of Object.entries(tKonDelar)) console.log(kolumn(namn, ms));
console.log(`\n  ${'TOTALT'.padEnd(26)} ${String(summa).padStart(7)} ms`);
if (sidfel.length) console.log(`\n  ✗ ${sidfel.length} sidfel: ${sidfel[0]}`);

await browser.close();

const brutenBudget = summa > BUDGET_MS;
if (sidfel.length || brutenBudget || !uiOk) {
    if (brutenBudget) console.log(`\n✗ Över budget: ${summa} ms > ${BUDGET_MS} ms.`);
    if (!uiOk) console.log(`\n✗ Gränssnittet blev klart först efter ${stor.tSynlig} ms (budget ${UI_BUDGET_MS} ms).`);
    process.exit(1);
}
console.log(`\n✓ Inom budget (${BUDGET_MS} ms)${långsamma.length ? ` — men se: ${långsamma.join(', ')}` : ''}`);

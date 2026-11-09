// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
// Webbläsar-röktestet, del: Importprofiler — en fil med okända rubriker mappas för hand, mappningen sparas som
// importprofil, och samma fil läses därefter in utan mappning. Att ladda ner konfigurationsfilen prövas inte här
// (tests/importprofiler-app.test.js gör rundresan); i stället prövas att profilen finns i state.
// Körs av tools/browser-smoke.mjs.
import { FIL, ok, browser } from './rigg.mjs';
/* global state, oppnaInstallningar -- används i page.evaluate, där de finns i sidan */

export async function importprofiler() {
    console.log('\n── Importprofiler: mappa, spara, känn igen samma fil ──');
    const sida = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await sida.goto('file://' + FIL);
    const rader = ['Avd;Befattning;Grundlon;Fodd;Sex'];
    for (let i = 0; i < 30; i++) rader.push(`X;Handläggare;${30000 + i};${1970 + i};${i % 2 ? 'M' : 'K'}`);
    const fil = namn => ({ name: namn, mimeType: 'text/csv', buffer: Buffer.from(rader.join('\n'), 'utf8') });
    await sida.setInputFiles('#file-input-data', fil('personallista.csv'));
    await sida.waitForFunction(() => /Kolumnmappning behövs/.test(document.getElementById('column-map-panel')?.textContent || ''), null, { timeout: 15000 });
    ok(await sida.evaluate(() => !document.getElementById('colmap-spara-profil')), 'ingen sparknapp innan filen lästs in med mappningen');
    for (const [roll, rubrik] of [['bas', 'Avd'], ['alder', 'Fodd'], ['kon', 'Sex']]) {
        await sida.selectOption(`#column-map-panel select[data-colmap-role="${roll}"]`, rubrik);
    }
    await sida.click('#colmap-apply');
    await sida.waitForFunction(() => state.data.length === 30 && !!document.getElementById('colmap-spara-profil'), null, { timeout: 15000 });
    ok(await sida.inputValue('#colmap-profil-namn') === 'Vår personallista', 'kolumnmappningen erbjuder "Spara som importprofil" med namnet Vår personallista');
    await sida.click('#colmap-spara-profil');
    const profiler = await sida.evaluate(() => state.importprofiler.map(p => ({ namn: p.namn, kalla: p.kalla, rubriker: p.rubriker, falt: Object.keys(p).sort().join(',') })));
    ok(profiler.length === 1 && profiler[0].namn === 'Vår personallista' && profiler[0].kalla === 'konfiguration',
        `profilen finns i state (${profiler.length} st, källa ${profiler[0]?.kalla})`);
    ok(profiler[0]?.falt === 'id,kalla,kannetecken,namn,rubriker' && JSON.stringify(profiler[0].rubriker) === JSON.stringify({ bas: ['Avd'], yrke: ['Befattning'], lon: ['Grundlon'], alder: ['Fodd'], kon: ['Sex'] }),
        'profilen bär bara rubriknamn');
    ok(await sida.evaluate(() => /Sparad som importprofil/.test(document.getElementById('column-map-panel').textContent)), 'kolumnmappningen säger att mappningen är sparad');

    // Den handgjorda mappningen tas bort: filen läses om och känns igen på profilen.
    await sida.click('#colmap-reset');
    await sida.waitForFunction(() => state.columnMap === null && state.importprofil?.namn === 'Vår personallista' && state.data.length === 30, null, { timeout: 15000 });
    ok(true, 'med mappningen återställd känns filen igen på profilen');
    // En andra uppladdning av samma fil: ingen mappning behövs.
    await sida.setInputFiles('#file-input-data', fil('personallista-igen.csv'));
    await sida.waitForFunction(() => state.filnamn.data === 'personallista-igen.csv' && state.data.length === 30, null, { timeout: 15000 });
    const l = await sida.evaluate(() => ({
        behovs: /Kolumnmappning behövs/.test(document.getElementById('column-map-panel')?.textContent || ''),
        kort: document.querySelector('#upload-cell-data .upload-importprofil')?.textContent || '',
        synligt: getComputedStyle(document.querySelector('#upload-cell-data .upload-importprofil')).display !== 'none',
        last: document.getElementById('tab-matrix').disabled, map: state.columnMap,
    }));
    ok(!l.behovs && !l.last && l.map === null, 'en andra uppladdning av samma fil går utan mappning');
    ok(l.synligt && l.kort === 'Känd uppsättning: Vår personallista (konfigurationsfilen)', `filkortet säger «${l.kort}»`);
    // Inställningar listar profilen.
    await sida.evaluate(() => oppnaInstallningar());
    ok(/Vår personallista/.test(await sida.textContent('#inst-importprofiler')), 'Inställningar › Importprofiler listar profilen');
    await sida.close();
}

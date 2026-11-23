// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
// Webbläsar-röktestet, del: Förhandskontroll av lönefilen — en fil med värden som verktyget inte känner igen (BAS med
// skräp, en okänd kön-kod, födelseår i ålderskolumnen) läses in genom filväljaren, och en markerad cell i
// tolkningstabellen syns med egen bakgrund. Körs av tools/browser-smoke.mjs.
import { FIL, ok, browser, oppnaFlik } from './rigg.mjs';
/* global state -- används i page.evaluate, där de finns i sidan */

export async function forhandskontroll() {
    console.log('\n── Förhandskontroll av lönefilen: tolkningen med markerade celler ──');
    const sida = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await sida.goto('file://' + FIL);
    await oppnaFlik(sida, '.nav-item[data-tab="filer"]');   // lönefilen läses in i Filer och kvalitet, där avsnittet står
    const rader = ['BAS;AID;Månadslön;Ålder;Kön'];
    for (let i = 0; i < 30; i++) rader.push(`${i === 0 ? 'C (chef)' : 'C'};207011 Handläggare;${30000 + i * 10};${1970 + (i % 20)};${i === 1 ? '9' : i % 2 ? 'M' : 'K'}`);
    await sida.setInputFiles('#file-input-data', { name: 'okanda-varden.csv', mimeType: 'text/csv', buffer: Buffer.from(rader.join('\n'), 'utf8') });
    await sida.waitForFunction(() => state.data.length === 29 && !!document.querySelector('#fk-tolkning'), null, { timeout: 15000 });
    // Tolkningen, cellerna och varningarna prövas i jsdom (tests/forhandskontroll-app.test.js); här att stilmallen
    // ger en markerad cell en egen bakgrund.
    const l = await sida.evaluate(() => {
        const cell = document.querySelector('#fk-tolkning td.fk-fel');
        return {
            cellSyns: !!cell && cell.getBoundingClientRect().width > 0,
            markerad: cell ? getComputedStyle(cell).backgroundColor !== getComputedStyle(cell.parentElement).backgroundColor : false,
            cellText: cell?.textContent || '',
        };
    });
    ok(l.cellSyns && l.markerad, `en markerad cell syns med egen bakgrund («${l.cellText.trim().slice(0, 60)}»)`);
    await sida.close();
}

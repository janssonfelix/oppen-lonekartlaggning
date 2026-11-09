// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
// Webbläsar-röktestet, del: Förhandskontroll av lönefilen — en fil med värden som verktyget inte känner igen (BAS med
// skräp, en okänd kön-kod, födelseår i ålderskolumnen) läses in, och avsnittet i Filer och kvalitet visar
// tolkningstabellen utfälld, med markerade celler, och varningarna. Därefter det blockerande läget: Läs in.
// Körs av tools/browser-smoke.mjs.
import { FIL, ok, browser } from './rigg.mjs';
/* global state, oppnaInstallningar, stangInstallningar -- används i page.evaluate, där de finns i sidan */

export async function forhandskontroll() {
    console.log('\n── Förhandskontroll av lönefilen: tolkningen med markerade celler ──');
    const sida = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await sida.goto('file://' + FIL);
    await sida.click('.nav-item[data-tab="filer"]');   // lönefilen läses in i Filer och kvalitet, där avsnittet står
    const rader = ['BAS;AID;Månadslön;Ålder;Kön'];
    for (let i = 0; i < 30; i++) rader.push(`${i === 0 ? 'C (chef)' : 'C'};207011 Handläggare;${30000 + i * 10};${1970 + (i % 20)};${i === 1 ? '9' : i % 2 ? 'M' : 'K'}`);
    const fil = namn => ({ name: namn, mimeType: 'text/csv', buffer: Buffer.from(rader.join('\n'), 'utf8') });
    await sida.setInputFiles('#file-input-data', fil('okanda-varden.csv'));
    await sida.waitForFunction(() => state.data.length === 29 && !!document.querySelector('#fk-tolkning'), null, { timeout: 15000 });
    const l = await sida.evaluate(() => {
        const av = document.getElementById('avsnitt-fi-forhandskontroll');
        const cell = document.querySelector('#fk-tolkning td.fk-fel');
        return {
            synligt: !!av && !av.hidden && av.open && av.getBoundingClientRect().height > 0,
            rader: document.querySelectorAll('#fk-tolkning tbody tr').length,
            markerade: document.querySelectorAll('#fk-tolkning td.fk-fel').length,
            cellSyns: !!cell && cell.getBoundingClientRect().width > 0,
            markerad: cell ? getComputedStyle(cell).backgroundColor !== getComputedStyle(cell.parentElement).backgroundColor : false,
            cellText: cell?.textContent || '',
            fodd: document.querySelector('#fk-tolkning tbody tr:nth-child(3)')?.textContent || '',
            nyckel: document.getElementById('nyckel-fi-forhandskontroll').textContent,
            varningar: [...document.querySelectorAll('#forhandskontroll .fk-varningar li')].map(li => li.textContent.trim()),
        };
    });
    ok(l.synligt && l.rader === 10, `avsnittet är utfällt med tolkningen av de tio första raderna (${l.rader} rader)`);
    ok(l.markerade === 2 && l.cellSyns && l.markerad, `${l.markerade} markerade celler syns med egen bakgrund («${l.cellText.trim().slice(0, 60)}»)`);
    ok(/1972 tolkat som \d+ år/.test(l.fodd), `födelseåret visas med tolkningen («${l.fodd.trim().slice(0, 80)}»)`);
    ok(/^\d varningar$/.test(l.nyckel) && l.varningar.some(t => /A–N/.test(t)) && l.varningar.some(t => /födelseår/.test(t)), `nyckeltalet säger «${l.nyckel}», varningarna nämner BAS och födelseår`);

    // Blockerande läge: inställningen på, samma fil väntar på Läs in.
    await sida.evaluate(() => { oppnaInstallningar(); });
    await sida.check('#inst-fk-stopp');
    await sida.evaluate(() => { stangInstallningar(); });
    await sida.setInputFiles('#file-input-data', fil('okanda-varden-igen.csv'));
    await sida.waitForSelector('#fk-las-in', { state: 'visible', timeout: 15000 });
    ok(await sida.evaluate(() => state.filnamn.data === 'okanda-varden.csv' && state.forhandskontroll.vantar === true), 'med inställningen på väntar filen på Läs in, och det tidigare underlaget står kvar');
    await sida.click('#fk-las-in');
    await sida.waitForFunction(() => state.filnamn.data === 'okanda-varden-igen.csv' && !document.getElementById('fk-las-in'), null, { timeout: 15000 });
    ok(true, 'Läs in läser in filen');
    await sida.close();
}

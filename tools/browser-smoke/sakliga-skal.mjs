// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
// Webbläsar-röktestet, del: Sakliga skäl — på demodata öppnas dialogen från en rad i Handlingsplan, ett skäl läggs
// till, sammanfattningen räknas om och radens knapp visar antalet, och tabellerna står i Rapporttext. Körs i en egen
// sida, så att skälet inte följer med i de övriga kontrollerna. Körs av tools/browser-smoke.mjs.
import { FIL, ok, browser } from './rigg.mjs';
/* global state -- används i page.evaluate, där det finns i sidan */

export async function sakligaSkal() {
    console.log('\n── Sakliga skäl: dialogen i Handlingsplan och tabellerna i Rapporttext ──');
    const sida = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await sida.goto('file://' + FIL + '?demo=1');
    await sida.waitForFunction(() => document.getElementById('demo-mode-banner')?.style.display === 'flex', null, { timeout: 15000 });
    await sida.click('.nav-item[data-tab="handlingsplan"]');
    await sida.waitForSelector('#handlingsplan-tbody [data-hp-skal]', { timeout: 15000 });
    // En rad med en medianskillnad där båda könen når minsta gruppstorlek, så att kommentaren följer med i rapporten.
    // För en rad där ett kön är under gränsen står bara kategorin i exporterna. Knappens data-hp-skillnad säger inte
    // det (den har skillnaden också då), så valet görs på förifyllningens minsta könsantal. Finns ingen tas den första.
    const nyckel = await sida.evaluate(() => {
        const knappar = [...document.querySelectorAll('#handlingsplan-tbody [data-hp-skal]')];
        /* global _handlingsplanSeedRows, _hpUtanBelopp -- globala i sidan */
        const s = _handlingsplanSeedRows();
        const fulla = new Set(s.nycklar.filter((n, i) => s.skillnader[i] > 0 && !_hpUtanBelopp(n, s.minsta[i])));
        const med = knappar.find(k => fulla.has(k.getAttribute('data-hp-skal'))) || knappar[0];
        return med.getAttribute('data-hp-skal');
    });
    const knapp = `#handlingsplan-tbody [data-hp-skal="${nyckel}"]`;
    const forut = await sida.evaluate(n => (state.handlingsplan[n]?.skal || []).length, nyckel);
    await sida.click(knapp);
    await sida.waitForFunction(() => document.getElementById('skal-modal').style.display === 'flex', null, { timeout: 5000 });
    ok(true, 'knappen Sakliga skäl öppnar dialogen');
    // Fokusfällan sätter fokus efter en kort stund (trapFocus), som i de övriga dialogerna.
    ok(await sida.waitForFunction(() => document.getElementById('skal-modal').contains(document.activeElement), null, { timeout: 2000 }).then(() => true, () => false), 'fokus står i dialogen');
    await sida.click('#skal-lagg-till');
    const sista = '#skal-body .skal-rad:last-of-type';
    await sida.selectOption(`${sista} select.skal-kategori`, 'marknad');
    await sida.fill(`${sista} input.skal-belopp`, '700');
    await sida.fill(`${sista} input.skal-kommentar`, 'Svårrekryterat i regionen');
    const summa = ((await sida.textContent('#skal-summa')) || '').replace(/\s+/g, ' ').trim();
    ok(/^Förklarat av skälen: /.test(summa), `sammanfattningen räknas om («${summa}»)`);
    const sparat = await sida.evaluate(n => state.handlingsplan[n]?.skal || [], nyckel);
    ok(sparat.length === forut + 1 && sparat.some(s => s.kategori === 'marknad' && s.belopp === 700), 'skälet sparas på raden');
    await sida.keyboard.press('Escape');
    await sida.waitForFunction(() => document.getElementById('skal-modal').style.display === 'none', null, { timeout: 5000 });
    const text = ((await sida.textContent(`${knapp} .hp-skal-sammanfattning`)) || '').trim();
    ok(text.startsWith(`Sakliga skäl (${forut + 1})`), `radens knapp visar antalet («${text}»)`);
    ok(/: \d+ skäl/.test(await sida.getAttribute(knapp, 'aria-label') || ''), 'knappens tillgängliga namn har sammanfattningen');
    ok(await sida.evaluate(k => document.activeElement === document.querySelector(k), knapp), 'Escape stänger dialogen och fokus går tillbaka till knappen');
    await sida.click('.nav-item[data-tab="rapporttext"]');
    // Demot har redan skäl på tre rader, så rubriken kan stå kvar från en tidigare ritning innan Rapporttext har ritats
    // om med det nya skälet: vänta på kommentaren, inte bara på rubriken (Firefox hann ibland läsa den gamla texten).
    await sida.waitForFunction(() => /Svårrekryterat i regionen/.test(document.getElementById('view-rapporttext')?.textContent || ''), null, { timeout: 15000 }).catch(() => {});
    const rt = await sida.evaluate(() => document.getElementById('view-rapporttext').textContent || '');
    ok(/Sakliga skäl per grupp/.test(rt) && /Sammanställning per kategori/.test(rt), 'Rapporttext har tabellerna Sakliga skäl per grupp och Sammanställning per kategori');
    const harKommentar = /Svårrekryterat i regionen/.test(rt);
    // Felsökning när kommentaren saknas: radens skäl i tillståndet och gruppen i exportlägets förifyllning.
    const diag = harKommentar ? '' : await sida.evaluate(n => {
        /* global medExportLage, _handlingsplanSeedRows, _hpSkalUnderlag, kInstalld, kTroskel */
        const skal = state.handlingsplan[n]?.skal || [];
        const ex = medExportLage(() => { const s = _handlingsplanSeedRows(); const u = _hpSkalUnderlag(s); const g = u.grupper.find(x => x.nyckel === n);
            return { iSeed: s.nycklar.includes(n), kExport: kTroskel(), grupp: g ? { utanBelopp: g.utanBelopp, nMin: g.nMin, antal: g.skal.length } : null }; });
        return JSON.stringify({ n, skal, kInstalld: kInstalld(), kSkarm: kTroskel(), ex });
    }, nyckel);
    ok(harKommentar, `kommentaren står i tabellen${diag ? ` (${diag})` : ''}`);
    await sida.close();
}

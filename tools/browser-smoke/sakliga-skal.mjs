// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
// Webbläsar-röktestet, del: Sakliga skäl — på demodata öppnas dialogen från en rad i Handlingsplan med äkta klick och
// tangentbord, ett skäl läggs till, och kommentaren står i Rapporttext när fliken byts. Körs i en egen
// sida, så att skälet inte följer med i de övriga kontrollerna. Körs av tools/browser-smoke.mjs.
import { FIL, ok, browser, oppnaFlik } from './rigg.mjs';
/* global state -- används i page.evaluate, där det finns i sidan */

export async function sakligaSkal() {
    console.log('\n── Sakliga skäl: dialogen i Handlingsplan och tabellerna i Rapporttext ──');
    const sida = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await sida.goto('file://' + FIL + '?demo=1');
    await sida.waitForFunction(() => document.getElementById('demo-mode-banner')?.style.display === 'flex', null, { timeout: 15000 });
    await oppnaFlik(sida, '.nav-item[data-tab="handlingsplan"]');
    await sida.waitForSelector('#handlingsplan-tbody [data-hp-skal]', { timeout: 15000 });
    // En rad med en medianskillnad där båda könen når minsta gruppstorlek, så att kommentaren följer med i rapporten.
    // För en rad där ett kön är under gränsen står bara kategorin i exporterna. Knappens data-hp-skillnad säger inte
    // det (den har skillnaden också då), så valet görs på förifyllningens minsta könsantal. Finns ingen tas den första.
    const nyckel = await sida.evaluate(() => {
        const knappar = [...document.querySelectorAll('#handlingsplan-tbody [data-hp-skal]')];
        /* global _handlingsplanForifyllning, _hpUtanBelopp -- globala i sidan */
        const s = _handlingsplanForifyllning();
        const fulla = new Set(s.nycklar.filter((n, i) => s.skillnader[i] > 0 && !_hpUtanBelopp(n, s.minsta[i])));
        const med = knappar.find(k => fulla.has(k.getAttribute('data-hp-skal'))) || knappar[0];
        return med.getAttribute('data-hp-skal');
    });
    const knapp = `#handlingsplan-tbody [data-hp-skal="${nyckel}"]`;
    await sida.click(knapp);
    await sida.waitForFunction(() => document.getElementById('skal-modal').style.display === 'flex', null, { timeout: 5000 });
    ok(true, 'knappen Sakliga skäl öppnar dialogen');
    // Fokusfällan sätter fokus efter en kort stund (fangaFokus), som i de övriga dialogerna.
    ok(await sida.waitForFunction(() => document.getElementById('skal-modal').contains(document.activeElement), null, { timeout: 2000 }).then(() => true, () => false), 'fokus står i dialogen');
    await sida.click('#skal-lagg-till');
    const sista = '#skal-body .skal-rad:last-of-type';
    await sida.selectOption(`${sista} select.skal-kategori`, 'marknad');
    await sida.fill(`${sista} input.skal-belopp`, '700');
    await sida.fill(`${sista} input.skal-kommentar`, 'Svårrekryterat i regionen');
    // Sammanfattningen, det sparade skälet och knappens text och namn prövas i jsdom (tests/handlingsplan-skal.test.js).
    await sida.keyboard.press('Escape');
    await sida.waitForFunction(() => document.getElementById('skal-modal').style.display === 'none', null, { timeout: 5000 });
    ok(await sida.evaluate(k => document.activeElement === document.querySelector(k), knapp), 'Escape stänger dialogen och fokus går tillbaka till knappen');
    await oppnaFlik(sida, '.nav-item[data-tab="rapporttext"]');
    // Demot har redan skäl på tre rader, så rubriken kan stå kvar från en tidigare ritning innan Rapporttext har ritats
    // om med det nya skälet: vänta på kommentaren, inte bara på rubriken (Firefox hann ibland läsa den gamla texten).
    await sida.waitForFunction(() => /Svårrekryterat i regionen/.test(document.getElementById('view-rapporttext')?.textContent || ''), null, { timeout: 15000 }).catch(() => {});
    const rt = await sida.evaluate(() => document.getElementById('view-rapporttext').textContent || '');
    // Tabellerna i Rapporttext prövas i jsdom (tests/handlingsplan-skal-export.test.js); här att flikbytet ritar om
    // med skälet som just skrevs i dialogen.
    const harKommentar = /Svårrekryterat i regionen/.test(rt);
    // Felsökning när kommentaren saknas: radens skäl i tillståndet och gruppen i exportlägets förifyllning.
    const diag = harKommentar ? '' : await sida.evaluate(n => {
        /* global medExportLage, _handlingsplanForifyllning, _hpSkalUnderlag, kInstalld, kTroskel */
        const skal = state.handlingsplan[n]?.skal || [];
        const ex = medExportLage(() => { const s = _handlingsplanForifyllning(); const u = _hpSkalUnderlag(s); const g = u.grupper.find(x => x.nyckel === n);
            return { iSeed: s.nycklar.includes(n), kExport: kTroskel(), grupp: g ? { utanBelopp: g.utanBelopp, nMin: g.nMin, skal: g.sammanstallning?.skal } : null }; });
        return JSON.stringify({ n, skal, kInstalld: kInstalld(), kSkarm: kTroskel(), ex });
    }, nyckel);
    ok(harKommentar, `kommentaren står i tabellen${diag ? ` (${diag})` : ''}`);
    await sida.close();
}

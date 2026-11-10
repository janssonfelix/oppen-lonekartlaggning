// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
// Webbläsar-röktestet, del: Var uppstår löneskillnaden med valbara förklaringsvariabler (ADR-65), vid 375 punkter.
// Körs av tools/browser-smoke.mjs. Egen sida, så att valet inte följer med in i de andra kontrollerna.
/* global _guGapUppdelning, getData, kTroskel, gapVariabler -- används i page.evaluate, där de finns i sidan */
import { FIL, ok, browser } from './rigg.mjs';

export async function uppdelningensVariabler() {
    console.log('\n── Var uppstår löneskillnaden: förklaringsvariablerna (375 punkter) ──');
    const s = await browser.newPage({ viewport: { width: 375, height: 800 } });
    const fel = [];
    s.on('console', m => { if (m.type() === 'error' && !/frame-ancestors/i.test(m.text())) fel.push(m.text()); if (m.type() === 'warning' && /Internt fel i/.test(m.text())) fel.push(m.text()); });
    s.on('pageerror', e => fel.push(String(e && e.message || e)));
    await s.goto('file://' + FIL + '?demo=1');
    await s.waitForFunction(() => document.getElementById('demo-mode-banner')?.style.display === 'flex', null, { timeout: 30000 });
    await s.evaluate(() => document.querySelector('.nav-item[data-tab="struktur"]').click());
    await s.waitForTimeout(600);
    await s.evaluate(() => { document.getElementById('avsnitt-ov-gap').open = true; });
    await s.waitForTimeout(300);
    const delar = () => s.evaluate(() => [...document.querySelectorAll('#gap-uppdelning [data-gu-del] .gu-rubrik strong')].map(e => e.textContent));
    ok((await delar()).join(' | ') === 'A. BAS-fördelning | B. AID inom BAS | C. Inom AID och BAS', 'standardvalet ger dagens tre delar');

    // Välj bort AID och lägg till åldersgrupp, med riktiga klick.
    await s.click('#gap-uppdelning input[data-gu-var="aid"]');
    await s.click('#gap-uppdelning input[data-gu-var="alder"]');
    await s.waitForTimeout(300);
    const r = await s.evaluate(() => { const u = _guGapUppdelning(getData(), { k: kTroskel(), variabler: gapVariabler() });
        return { variabler: u.variabler, skyddad: u.skyddad, rest: u.delar ? Object.values(u.delar).reduce((a, v) => a + v, 0) - u.gap : null,
            staplar: document.getElementById('chart-gap-uppdelning')?.querySelectorAll('svg').length || 0 }; });
    ok(r.variabler.join() === 'bas,alder', `valet blir BAS, åldersgrupp (${r.variabler.join(', ')})`);
    ok(r.skyddad && r.rest !== null && Math.abs(r.rest) < 1e-6, `delarna summerar till hela skillnaden (rest ${r.rest})`);
    ok((await delar()).join(' | ') === 'A. BAS-fördelning | B. Åldersgrupp inom BAS | C. Inom åldersgrupp och BAS', 'delarnas namn byggs ur variablerna');
    ok(r.staplar > 0, 'trappan ritas om');

    // Tangentbordet: fokus på Flytta upp för åldersgrupp, Enter flyttar.
    await s.focus('#gap-uppdelning [data-gu-rad="alder"] [data-gu-flytta="-1"]');
    await s.keyboard.press('Enter');
    await s.waitForTimeout(300);
    const t = await s.evaluate(() => ({ val: gapVariabler().join(), fokus: document.activeElement && document.activeElement.closest('#gap-uppdelning .gu-val') !== null }));
    ok(t.val === 'alder,bas' && t.fokus, `Enter på Flytta upp flyttar åldersgrupp först, och fokus stannar i listan (${t.val})`);

    const over = await s.evaluate(() => { const mc = document.getElementById('main-content'), k = document.querySelector('#gap-uppdelning .gu-val');
        return { sida: Math.max(document.documentElement.scrollWidth - document.documentElement.clientWidth, mc.scrollWidth - mc.clientWidth), lista: k.scrollWidth - k.clientWidth }; });
    ok(over.sida <= 1 && over.lista <= 1, `375 punkter: ingen vågrät rullning (sidan +${over.sida}, listan +${over.lista})`);
    ok(fel.length === 0, `inga konsolfel eller sidfel${fel.length ? ': ' + fel.slice(0, 3).join(' | ') : ''}`);
    await s.close();
}

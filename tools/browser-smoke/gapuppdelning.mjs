// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
// Webbläsar-röktestet, del: Var uppstår löneskillnaden med valbara förklaringsvariabler (ADR-65), vid 375 punkter.
// Körs av tools/browser-smoke.mjs. Egen sida, så att valet inte följer med in i de andra kontrollerna.
/* global gapVariabler -- används i page.evaluate, där de finns i sidan */
import { FIL, NAMN, ok, browser, WEBKIT_SELECT_STILMALL } from './rigg.mjs';

export async function uppdelningensVariabler() {
    console.log('\n── Var uppstår löneskillnaden: förklaringsvariablerna (375 punkter) ──');
    const s = await browser.newPage({ viewport: { width: 375, height: 800 } });
    const fel = [];
    // Samma undantag som sidan i rigg.mjs: WebKits egna stilar för <select> ger ett konsolfel om stilmallen.
    s.on('console', m => { if (m.type() === 'error' && !/frame-ancestors/i.test(m.text()) && !(NAMN === 'webkit' && WEBKIT_SELECT_STILMALL.test(m.text()))) fel.push(m.text()); if (m.type() === 'warning' && /Internt fel i/.test(m.text())) fel.push(m.text()); });
    s.on('pageerror', e => fel.push(String(e && e.message || e)));
    await s.goto('file://' + FIL + '?demo=1');
    await s.waitForFunction(() => document.getElementById('demo-mode-banner')?.style.display === 'flex', null, { timeout: 30000 });
    await s.evaluate(() => document.querySelector('.nav-item[data-tab="struktur"]').click());
    await s.waitForTimeout(600);
    // Valet, delarnas namn och omritningen prövas i jsdom (tests/lika-arbete-app.test.js); här det äkta klicket och tangentbordet.
    await s.click('#gap-uppdelning .gu-andra > summary');
    await s.click('#gap-uppdelning input[data-gu-var="alder"]');
    await s.waitForTimeout(300);
    // Fokus på Flytta upp för åldersgrupp, Enter flyttar.
    await s.focus('#gap-uppdelning [data-gu-rad="alder"] [data-gu-flytta="-1"]');
    await s.keyboard.press('Enter');
    await s.waitForTimeout(300);
    const t = await s.evaluate(() => ({ val: gapVariabler().join(), fokus: document.activeElement && document.activeElement.closest('#gap-uppdelning .gu-val') !== null }));
    ok(t.val === 'bas,alder,aid' && t.fokus, `Enter på Flytta upp flyttar åldersgrupp ett steg, och fokus stannar i listan (${t.val})`);

    const over = await s.evaluate(() => { const mc = document.getElementById('main-content'), k = document.querySelector('#gap-uppdelning .gu-val');
        return { sida: Math.max(document.documentElement.scrollWidth - document.documentElement.clientWidth, mc.scrollWidth - mc.clientWidth), lista: k.scrollWidth - k.clientWidth }; });
    ok(over.sida <= 1 && over.lista <= 1, `375 punkter: ingen vågrät rullning (sidan +${over.sida}, listan +${over.lista})`);
    ok(fel.length === 0, `inga konsolfel eller sidfel${fel.length ? ': ' + fel.slice(0, 3).join(' | ') : ''}`);
    await s.close();
}

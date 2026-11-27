// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
// Webbläsar-röktestet, del: Säkerheten: ingen lagring, ingen utgående trafik och inga fel under körningen.
// Körs av tools/browser-smoke.mjs i samma ordning som kontrollerna alltid har körts.
import { FIL, ok, browser, page, natverk, cspBrott, konsolfel, sidfel, internaFel, lagring, lasLagring, vantadeBrott, flikar, oppnaFlik, vantaFardigritad } from './rigg.mjs';
/* global ritaExtremvarden -- funktionen nedan körs i sidan, där den finns */

// GDPR: ingen lagring på någon sida, och lagringsspärren. Körs sist, efter alla exporter: sidorna som redan har
// stängts lästes när de stängdes (rigg.mjs), de som är öppna läses här.
export async function ingenLagring() {
    console.log('\n── GDPR: ingen lagring ──');
    for (const ctx of browser.contexts()) for (const s of ctx.pages()) lagring.push(await lasLagring(s));
    const med = nyckel => lagring.filter(l => nyckel(l)).map(l => l.url);
    const ls = med(l => l.ls > 0), ss = med(l => l.ss > 0), kakor = med(l => l.cookies > 0);
    ok(!ls.length, `localStorage tomt på alla ${lagring.length} sidor${ls.length ? ': ' + ls.slice(0, 3).join(' | ') : ''}`);
    ok(!ss.length, `sessionStorage tomt på alla ${lagring.length} sidor${ss.length ? ': ' + ss.slice(0, 3).join(' | ') : ''}`);
    ok(!kakor.length, `inga cookies satta på någon av ${lagring.length} sidor${kakor.length ? ': ' + kakor.slice(0, 3).join(' | ') : ''}`);
    // Lagringsspärren i en riktig webbläsare: både setItem och direkt tilldelning kastar, och ingenting blir kvar.
    {
        const sparr = await page.evaluate(() => {
            const kastar = fn => { try { fn(); return false; } catch (e) { return /Persistent storage forbidden/.test(String(e && e.message)); } };
            const ut = {};
            for (const namn of ['localStorage', 'sessionStorage']) {
                ut[namn] = [kastar(() => window[namn].setItem('prov', '1')), kastar(() => { window[namn].prov = '1'; }), kastar(() => { window[namn]['prov2'] = '1'; })];
                ut[`${namn}Tomt`] = window[namn].length === 0;
            }
            ut.cookie = kastar(() => { document.cookie = 'prov=1'; }) && document.cookie.length === 0;
            return ut;
        });
        ok(sparr.localStorage.every(Boolean) && sparr.localStorageTomt, `localStorage: setItem och direkt tilldelning kastar, inget lagras (${sparr.localStorage})`);
        ok(sparr.sessionStorage.every(Boolean) && sparr.sessionStorageTomt, `sessionStorage: setItem och direkt tilldelning kastar, inget lagras (${sparr.sessionStorage})`);
        ok(sparr.cookie, 'document.cookie: tilldelning kastar, ingen cookie sätts');
    }
}

// Ingen utgående trafik och inga arbetstrådar.
export async function ingenTrafik() {
    console.log('\n── Ingen utgående trafik och inga arbetstrådar ──');
    {
        // En arbetstråd ur en blob:-adress ska stoppas av CSP:n (script-src utan blob:, ingen worker-src). Prövas i en
        // egen sida, vars överträdelser inte räknas mot körningens krav på noll överträdelser (vantadeBrott i rigg.mjs).
        const s = await browser.newPage();
        vantadeBrott.add(s);
        await s.goto('file://' + FIL);
        const worker = await s.evaluate(() => new Promise(res => {
            try {
                const w = new Worker(URL.createObjectURL(new Blob(['postMessage("kord")'], { type: 'text/javascript' })));
                w.onmessage = () => res('körde');
                w.onerror = () => res('stoppad');
                setTimeout(() => res('stoppad (inget svar)'), 3000);
            } catch (_e) { res('stoppad (kastade)'); }
        }));
        ok(/^stoppad/.test(worker), `en arbetstråd ur en blob:-adress stoppas av CSP:n (${worker})`);
        // Hash-baserad script-src (ADR-9): ett injicerat skriptelement, en händelseattribut och en <img onerror> körs inte.
        const injektion = await s.evaluate(() => new Promise(res => {
            const sk = document.createElement('script'); sk.textContent = 'window.__inj1 = 1'; document.body.appendChild(sk);
            const knapp = document.createElement('button'); knapp.setAttribute('onclick', 'window.__inj2 = 1'); document.body.appendChild(knapp); knapp.click();
            const yta = document.createElement('div'); yta.innerHTML = '<img src="x" onerror="window.__inj3 = 1">'; document.body.appendChild(yta);
            setTimeout(() => res([window.__inj1, window.__inj2, window.__inj3].map(v => v === 1)), 500);
        }));
        ok(injektion.every(v => !v), `injicerat skript, onclick och <img onerror> körs inte under CSP:n (körde: ${injektion})`);
        await s.close();
        // Enskilda löner med radnummer stannar i verktyget (ADR-23): varken Personer att granska eller extremvärdeslistan
        // skrivs ut när användaren skriver ut Översikt.
        {
            const e = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
            await e.goto('file://' + FIL + '?demo=1');
            await e.waitForTimeout(1500);
            await oppnaFlik(e, '.nav-item[data-tab="dashboard"]');
            await e.evaluate(() => { const t = document.getElementById('outliers-threshold'); if (t) t.value = '2'; ritaExtremvarden(); });
            const rader = await e.evaluate(() => document.querySelectorAll('#outliers-table-wrap tbody tr').length);
            await e.evaluate(() => window.dispatchEvent(new Event('beforeprint')));
            await e.emulateMedia({ media: 'print' });
            const syns = await e.evaluate(() => { const el = document.querySelector('#outliers-table-wrap table'); return !!el && el.getBoundingClientRect().height > 0; });
            ok(rader > 0 && !syns, `extremvärdeslistan (${rader} enskilda löner) skrivs inte ut med Översikt`);
            await e.close();
        }
    }

    // Stilmallen hämtar ingen bild, inte heller en inbäddad data:-adress: en sådan syns som en rad i webbläsarens
    // nätverkspanel fast inget lämnar datorn, och ikonerna ritas i stället som inline-SVG eller med kanter i CSS.
    {
        const bilder = await page.evaluate(() => [...document.styleSheets]
            .flatMap(s => { try { return [...s.cssRules]; } catch { return []; } })
            .filter(r => /url\(/.test(r.cssText)).map(r => r.cssText.slice(0, 90)));
        ok(bilder.length === 0, `stilmallen hämtar ingen bild och har ingen data:-adress${bilder.length ? ': ' + bilder.slice(0, 3).join(' | ') : ''}`);
    }
}

// Rensa all data: efter demodatan och ett varv genom flikarna står sidan som en nyöppnad sida (inga flikar upplåsta,
// inga tal i statusraden, lönefilskortet tomt), och verktyget går att använda igen. Vad rensningen släpper prövas i
// jsdom (tests/dataskydd-app.test.js); här knappen i en riktig webbläsare.
export async function rensaAllData() {
    console.log('\n── Rensa all data ──');
    const lage = sida => sida.evaluate(() => ({
        upplasta: [...document.querySelectorAll('.nav-item[data-lonefil]')].filter(k => k.getAttribute('aria-disabled') !== 'true').map(k => /** @type {HTMLElement} */ (k).dataset.tab),
        tal: ['stat-n', 'stat-kon', 'stat-age', 'stat-paygap'].map(id => document.getElementById(id).textContent.trim()),
        lonefil: document.querySelector('#upload-cell-data .upload-filnamn').textContent.trim(),
    }));
    const ny = await browser.newPage();
    await ny.goto('file://' + FIL);
    const start = await lage(ny);
    await ny.close();
    for (const f of await flikar(page)) await oppnaFlik(page, `.nav-item[data-tab="${f}"]`);
    const fore = await lage(page);
    await page.click('#btn-open-installningar');
    page.once('dialog', d => d.accept());
    await page.click('#btn-clear-all-data');
    await vantaFardigritad(page);
    const efter = await lage(page);
    ok(fore.upplasta.length > 0 && fore.lonefil !== '' && JSON.stringify(efter) === JSON.stringify(start),
        `efter Rensa all data är sidan i startläget (före: ${fore.upplasta.length} flikar upplåsta, «${fore.lonefil}»; efter: ${JSON.stringify(efter)})`);
    await page.click('#first-run-demo-link');
    await page.waitForFunction(() => document.getElementById('demo-mode-banner')?.style.display === 'flex', null, { timeout: 15000 });
    await oppnaFlik(page, '.nav-item[data-tab="matrix"]');
    ok(await page.evaluate(() => !!document.querySelector('#chart-la-tratt svg')), 'demodatan går att läsa in igen, och Lika arbete ritar sitt diagram');
}

// Fel under hela körningen.
export async function felUnderKorningen() {
    console.log('\n── Fel under hela körningen ──');
    {
        ok(natverk.length === 0, `inga nätverksförfrågningar under hela körningen${natverk.length ? ': ' + natverk.slice(0, 3).join(' | ') : ''}`);
        ok(cspBrott.length === 0, `inga CSP-överträdelser på någon sida${cspBrott.length ? ': ' + [...new Set(cspBrott)].slice(0, 6).join(' | ') : ''}`);
        ok(internaFel.length === 0, `inga interna fel i analysdelarna${internaFel.length ? ': ' + internaFel.slice(0, 3).join(' | ') : ''}`);
    }
    ok(konsolfel.length === 0, `inga oväntade konsolfel${konsolfel.length ? ': ' + konsolfel.slice(0, 3).join(' | ') : ''}`);
    ok(sidfel.length === 0, `inga okastade sidfel${sidfel.length ? ': ' + sidfel.slice(0, 3).join(' | ') : ''}`);
}

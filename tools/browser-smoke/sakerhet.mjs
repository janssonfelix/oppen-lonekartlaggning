// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
// Webbläsar-röktestet, del: Säkerheten: ingen lagring, ingen utgående trafik och inga fel under körningen.
// Körs av tools/browser-smoke.mjs i samma ordning som kontrollerna alltid har körts.
import { FIL, ok, browser, page, natverk, konsolfel, sidfel, internaFel } from './rigg.mjs';

// GDPR: ingen lagring, och lagringsspärren.
export async function ingenLagring() {
    console.log('\n── GDPR: ingen lagring ──');
    const lagring = await page.evaluate(() => {
        let ls = -1, ss = -1;
        try { ls = localStorage.length; } catch (_e) { ls = -1; }
        try { ss = sessionStorage.length; } catch (_e) { ss = -1; }
        return { ls, ss, cookies: document.cookie.length };
    });
    ok(lagring.ls <= 0, `localStorage tomt (${lagring.ls})`);
    ok(lagring.ss <= 0, `sessionStorage tomt (${lagring.ss})`);
    ok(lagring.cookies === 0, 'inga cookies satta');
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
        // egen sida, så att överträdelsen inte räknas mot huvudsidans krav på noll överträdelser.
        const s = await browser.newPage();
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
        /* global renderOutliers -- funktionen nedan körs i sidan, där den finns */
        // Enskilda löner med radnummer stannar i verktyget (ADR-23): varken Personer att granska eller extremvärdeslistan
        // skrivs ut när användaren skriver ut Översikt.
        {
            const e = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
            await e.goto('file://' + FIL + '?demo=1');
            await e.waitForTimeout(1500);
            await e.click('.nav-item[data-tab="dashboard"]');
            await e.evaluate(() => { const t = document.getElementById('outliers-threshold'); if (t) t.value = '2'; renderOutliers(); });
            const rader = await e.evaluate(() => document.querySelectorAll('#outliers-table-wrap tbody tr').length);
            await e.evaluate(() => window.dispatchEvent(new Event('beforeprint')));
            await e.emulateMedia({ media: 'print' });
            const syns = await e.evaluate(() => { const el = document.querySelector('#outliers-table-wrap table'); return !!el && el.getBoundingClientRect().height > 0; });
            ok(rader > 0 && !syns, `extremvärdeslistan (${rader} enskilda löner) skrivs inte ut med Översikt`);
            await e.close();
        }
        ok(natverk.length === 0, `inga nätverksförfrågningar under hela körningen${natverk.length ? ': ' + natverk.slice(0, 3).join(' | ') : ''}`);
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

// Fel under hela körningen.
export async function felUnderKorningen() {
    console.log('\n── Fel under hela körningen ──');
    {
        const brott = await page.evaluate(() => window.__cspBrott || []);
        ok(brott.length === 0, `inga CSP-överträdelser${brott.length ? ': ' + [...new Set(brott)].slice(0, 6).join(' | ') : ''}`);
        ok(internaFel.length === 0, `inga interna fel i analysdelarna${internaFel.length ? ': ' + internaFel.slice(0, 3).join(' | ') : ''}`);
    }
    ok(konsolfel.length === 0, `inga oväntade konsolfel${konsolfel.length ? ': ' + konsolfel.slice(0, 3).join(' | ') : ''}`);
    ok(sidfel.length === 0, `inga okastade sidfel${sidfel.length ? ': ' + sidfel.slice(0, 3).join(' | ') : ''}`);
}

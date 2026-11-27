// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
// Webbläsar-röktestets gemensamma rigg: webbläsaren, sidan, ok(), felinsamlingen och hjälparna som flera delar
// använder. Importen startar webbläsaren och öppnar sidan; spärren mot ett inaktuellt bygge körs först.
import { chromium, firefox, webkit } from 'playwright';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { nyareAnBygget } from '../release.mjs';
export const ROOT = process.cwd();
export const FIL = join(ROOT, 'dist', 'oppen-lonekartlaggning.html');

// WebKit 27 (Playwright 1.64) prövar sina egna inbyggda stilar för <select> mot sidans CSP: varje rullgardinsmeny
// ger en style-src-attr-händelse och ett konsolfel om en stilmall, fast menyn ritas exakt likadant (prövat med en
// tom sida med bara en <select>). I WebKit räknas därför inte style-src-attr-händelser på SELECT, eller på
// dokumentet när menyn hunnit tas bort (innerHTML, kloning till utskriften), och konsolfelet godtas. Chromium och
// Firefox har inte felet och prövar allt; tests/sakerhet.test.js förbjuder stilattribut i markeringen.
// Ett eget <style> utan kontrollsumma fångas ändå: tests/sakerhet.test.js kräver hash för varje stilblock, och
// Chromium och Firefox rapporterar det som en style-src-elem-händelse.
export const WEBKIT_SELECT_STILMALL = /^Refused to apply a stylesheet because its hash, its nonce, or 'unsafe-inline' does not appear in the style-src directive/;

const WEBBLASARE = { chromium, firefox, webkit };
export const NAMN = (process.argv.find(a => a.startsWith('--browser=')) || '--browser=chromium').split('=')[1];
if (!WEBBLASARE[NAMN]) { console.error(`✗ Okänd webbläsare "${NAMN}" (chromium, firefox eller webkit).`); process.exit(1); }
export const BILDER = (process.argv.find(a => a.startsWith('--bilder=')) || '').split('=')[1] || '';
// Urklippsbehörighet kan bara ges i Chromium; i övriga webbläsare klickas knapparna, men
// urklippets innehåll läses inte tillbaka.
export const KAN_LASA_URKLIPP = NAMN === 'chromium';

let fel = 0;
export const ok = (v, txt) => { console.log(`  ${v ? '✓' : '✗'} ${txt}`); if (!v) fel++; };

if (!existsSync(FIL)) {
    console.error('✗ oppen-lonekartlaggning.html saknas — kör `npm run bundle` först.');
    process.exit(1);
}

// Spärr mot att testa en INAKTUELL artefakt: testet säger ingenting om koden om bygget är äldre än det bygget läser
// (KODVAGAR i tools/release.mjs och VERSION). Lätt att gå på annars — allt blir grönt och man tror att den senaste
// ändringen är verifierad.
{
    const nyare = nyareAnBygget(FIL);
    if (nyare.length) {
        console.error(`✗ Bygget är äldre än källan (${nyare.length} fil(er), t.ex. ${nyare[0]}).`);
        console.error('  Kör `npm run bundle` först — annars testas en gammal artefakt.');
        process.exit(1);
    }
}

export const browser = await WEBBLASARE[NAMN].launch();
console.log(`Webbläsare: ${NAMN} ${browser.version()}`);

// Vakterna för hela körningen sitter på varje sammanhang röktestet skapar (browser.newPage skapar också ett), så att
// varje sida och varje fönster den öppnar (popup) bär dem, och samlas här, utanför sidorna: en omladdning nollar dem inte.
// - natverk: varje förfrågan till annat än den lokala filen och data:/blob:-adresser, alltså trafik som CSP:n släpper
//   igenom. Ett anrop som CSP:n stoppar blir ingen förfrågan; det syns som en CSP-överträdelse (cspBrott) och ett konsolfel.
// - cspBrott: varje securitypolicyviolation-händelse (skript, stilelement, bilder, anslutningar …), oavsett hur
//   webbläsaren loggar den. Sidan har också sin egen lista, window.__cspBrott, för kontroller inom en sida.
// - konsolfel, sidfel och internaFel (rapporteraFel() skriver en varning när en analysdel hoppades över).
// - lagring: localStorage, sessionStorage och cookies på varje sida när dess sammanhang stängs (ingenLagring läser dem).
export const natverk = [], cspBrott = [], konsolfel = [], sidfel = [], internaFel = [], lagring = [];
// Sidor vars överträdelser och konsolfel är det kontrollen framkallar (CSP-provet i sakerhet.mjs) räknas inte.
export const vantadeBrott = new WeakSet();
export const lasLagring = sida => sida.evaluate(() => {
    let ls = -1, ss = -1, cookies = -1;
    try { ls = localStorage.length; } catch (_e) { ls = -1; }
    try { ss = sessionStorage.length; } catch (_e) { ss = -1; }
    try { cookies = document.cookie.length; } catch (_e) { cookies = -1; }
    return { url: location.href.split('/').pop(), ls, ss, cookies };
});
async function vakta(ctx) {
    ctx.on('request', r => { const u = r.url(); if (!/^(file|data|blob|about):/.test(u)) natverk.push(u); });
    ctx.on('console', m => {
        if (vantadeBrott.has(m.page())) return;
        if (m.type() === 'warning' && /Internt fel i/.test(m.text())) internaFel.push(m.text());
        if (m.type() !== 'error' || (NAMN === 'webkit' && WEBKIT_SELECT_STILMALL.test(m.text()))) return;
        konsolfel.push(m.text());
    });
    ctx.on('weberror', e => { if (!vantadeBrott.has(e.page())) sidfel.push(String(e.error() && e.error().message || e.error())); });
    await ctx.exposeBinding('__cspRapport', ({ page: sida }, brott) => { if (!vantadeBrott.has(sida)) cspBrott.push(brott); });
    await ctx.addInitScript(webkitSelect => {
        window.__cspBrott = [];
        document.addEventListener('securitypolicyviolation', e => { if (webkitSelect && e.violatedDirective === 'style-src-attr' && e.target && (e.target.tagName === 'SELECT' || e.target.nodeName === '#document')) return; const m = e.target && e.target.nodeType === 1 ? e.target : null; const brott = `${e.violatedDirective}: ${e.blockedURI || e.sample || ''}${m ? ' på ' + m.tagName.toLowerCase() + (m.id ? '#' + m.id : '') + (typeof m.className === 'string' && m.className ? '.' + m.className.trim().split(/\s+/).join('.') : '') : ' på ' + (e.target ? e.target.nodeName : 'okänt mål')} (rad ${e.lineNumber}${e.sourceFile ? ', ' + e.sourceFile.split('/').pop().slice(0, 30) : ''})`; window.__cspBrott.push(brott); window.__cspRapport(brott); });
    }, NAMN === 'webkit');
    const stang = ctx.close.bind(ctx);
    ctx.close = async (...arg) => { for (const s of ctx.pages()) lagring.push(await lasLagring(s)); return stang(...arg); };
}
const _nyttSammanhang = browser.newContext.bind(browser);
browser.newContext = async (...arg) => { const ctx = await _nyttSammanhang(...arg); await vakta(ctx); return ctx; };
// Urklippsbehörighet: rapportunderlaget kopierar text och diagram till urklipp.
export const page = await browser.newPage({ viewport: { width: 1400, height: 1000 },
    ...(KAN_LASA_URKLIPP ? { permissions: ['clipboard-read', 'clipboard-write'] } : {}) });

/** Menyns flikar som sidan har dem (data-tab), i menyns ordning. */
export const flikar = sida => sida.$$eval('.nav-item[data-tab]', k => k.map(e => /** @type {HTMLElement} */ (e).dataset.tab));

// hidden-attributet måste faktiskt dölja elementet — författar-CSS (display:flex) vinner
// annars över webbläsarens [hidden]-regel, vilket jsdom-testerna inte kan se.
export const osynlig = sel => page.evaluate(s => { const el = document.querySelector(s); return !!el && getComputedStyle(el).display === 'none'; }, sel);
// Användarens flikbyte visar fliken först och räknar den sedan (ADR-80): efter ett klick i menyn väntar testet tills
// ingenting i sidan räknas (aria-busy) och inget block väntar.
/* global _blockKo -- finns i sidan */
export const vantaFardigritad = sida => sida.waitForFunction(() => !document.querySelector('[aria-busy="true"]')
    && _blockKo.length === 0, null, { timeout: 60000 });
/** Klickar på en flik i menyn som användaren gör och väntar tills fliken är färdigritad. */
export async function oppnaFlik(sida, sel) {
    await sida.click(sel);
    await vantaFardigritad(sida);
}
// Diagram som MÅSTE ha ritats på demodata, per flik: en <svg> i containern.
export const DIAGRAM_PA_DEMO = {
    matrix: ['#chart-la-tratt'],
    struktur: ['#chart-sektorer', '#chart-skevhet-lador'],
    prioritering: ['#chart-prio-pareto', '#chart-prio-matrix'],
    benchmark: ['#chart-lp-bandmap', '#chart-lp-compliance', '#chart-jamforelse-spann', '#chart-jamforelse-avvikelse', '#chart-jmf-statlage'],
    kon: ['#chart-kon-scatter', '#chart-kon-boxplot', '#chart-demo-hist'],
    utforska: ['#chart-explore'],
};
// Antalet misslyckade kontroller hittills; sammanfattningen i tools/browser-smoke.mjs läser det.
export const antalFel = () => fel;

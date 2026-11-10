// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
// Webbläsar-röktestets gemensamma rigg: webbläsaren, sidan, ok(), felinsamlingen och hjälparna som flera delar
// använder. Importen startar webbläsaren och öppnar sidan; spärren mot ett inaktuellt bygge körs först.
import { chromium, firefox, webkit } from 'playwright';
import { existsSync, statSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
export const ROOT = process.cwd();
export const FIL = join(ROOT, 'dist', 'oppen-lonekartlaggning.html');

// CSP levererad via <meta> kan inte bära frame-ancestors — webbläsaren
// informerar om det vid varje sidladdning. Ofarligt och förväntat.
// Lydelsen skiljer sig mellan webbläsarna.
const TILLATNA_KONSOLFEL = [/frame-ancestors/i];
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

// Spärr mot att testa en INAKTUELL artefakt: testet säger ingenting om koden om
// bundlen är äldre än källan. Lätt att gå på annars — allt blir grönt och man
// tror att den senaste ändringen är verifierad.
{
    const bundleTid = statSync(FIL).mtimeMs;
    const kallor = ['src/index.html', 'src/style.css', 'dist/app.js',
        ...readdirSync(join(ROOT, 'src', 'app')).map(f => join('src', 'app', f))];
    const nyare = kallor.filter(f => existsSync(join(ROOT, f)) && statSync(join(ROOT, f)).mtimeMs > bundleTid);
    if (nyare.length) {
        console.error(`✗ Bygget är äldre än källan (${nyare.length} fil(er), t.ex. ${nyare[0]}).`);
        console.error('  Kör `npm run bundle` först — annars testas en gammal artefakt.');
        process.exit(1);
    }
}

export const browser = await WEBBLASARE[NAMN].launch();
console.log(`Webbläsare: ${NAMN} ${browser.version()}`);
// Varje förfrågan från varje sida röktestet öppnar samlas här; allt utom den lokala filen och data:/blob:-adresser
// är utgående trafik och får inte förekomma (riskanalysen §6.1).
export const natverk = [];
const _nySida = browser.newPage.bind(browser);
browser.newPage = async (...arg) => {
    const s = await _nySida(...arg);
    s.on('request', r => { const u = r.url(); if (!/^(file|data|blob|about):/.test(u)) natverk.push(u); });
    return s;
};
// Urklippsbehörighet: rapportunderlaget kopierar text och diagram till urklipp.
export const page = await browser.newPage({ viewport: { width: 1400, height: 1000 },
    ...(KAN_LASA_URKLIPP ? { permissions: ['clipboard-read', 'clipboard-write'] } : {}) });
// Varje CSP-överträdelse (skript, stilelement, bilder …) samlas här, oavsett hur webbläsaren
// loggar den. Stilelement kräver kontrollsumma.
await page.addInitScript(webkitSelect => {
    window.__cspBrott = [];
    document.addEventListener('securitypolicyviolation', e => { if (webkitSelect && e.violatedDirective === 'style-src-attr' && e.target && (e.target.tagName === 'SELECT' || e.target.nodeName === '#document')) return; const m = e.target && e.target.nodeType === 1 ? e.target : null; window.__cspBrott.push(`${e.violatedDirective}: ${e.blockedURI || e.sample || ''}${m ? ' på ' + m.tagName.toLowerCase() + (m.id ? '#' + m.id : '') + (typeof m.className === 'string' && m.className ? '.' + m.className.trim().split(/\s+/).join('.') : '') : ' på ' + (e.target ? e.target.nodeName : 'okänt mål')} (rad ${e.lineNumber}${e.sourceFile ? ', ' + e.sourceFile.split('/').pop().slice(0, 30) : ''})`); });
}, NAMN === 'webkit');

export const konsolfel = [], sidfel = [];
page.on('console', m => {
    if (m.type() !== 'error') return;
    const t = m.text();
    if (TILLATNA_KONSOLFEL.some(re => re.test(t)) || (NAMN === 'webkit' && WEBKIT_SELECT_STILMALL.test(t))) return;
    konsolfel.push(t);
});
page.on('pageerror', e => sidfel.push(String(e && e.message || e)));
// rapporteraFel() skriver en varning när en analysdel hoppades över.
export const internaFel = [];
page.on('console', m => { if (m.type() === 'warning' && /Internt fel i/.test(m.text())) internaFel.push(m.text()); });

// hidden-attributet måste faktiskt dölja elementet — författar-CSS (display:flex) vinner
// annars över webbläsarens [hidden]-regel, vilket jsdom-testerna inte kan se.
export const osynlig = sel => page.evaluate(s => { const el = document.querySelector(s); return !!el && getComputedStyle(el).display === 'none'; }, sel);
// Diagram som MÅSTE ha ritats på demodata: en <svg> i containern.
export const FLIKAR = [
    ['matrix', ['#chart-la-tratt']],
    ['likvardighet', []],
    ['struktur', ['#chart-sektorer', '#chart-skevhet-lador']],
    ['prioritering', ['#chart-prio-pareto', '#chart-prio-matrix']],
    ['benchmark', ['#chart-lp-bandmap', '#chart-lp-compliance']],
    ['loneoversyn', []],
    ['kon', ['#chart-kon-scatter', '#chart-kon-boxplot', '#chart-demo-hist']],
    ['utforska', ['#chart-explore']],
    ['benchmark', ['#chart-jamforelse-spann', '#chart-jamforelse-avvikelse', '#chart-jmf-statlage']],
    ['dokumentera', []],
    ['rapporttext', []],
    ['arbetet', []],
];
// Antalet misslyckade kontroller hittills; sammanfattningen i tools/browser-smoke.mjs läser det.
export const antalFel = () => fel;

// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
// Webbläsar-röktest av den BYGGDA single-file-artefakten.
//
// Varför detta behövs: Vitest-testerna kör i jsdom, som saknar canvas och inte tillämpar
// CSP:n. De ritar diagrammen med äkta D3, men bevisar inte att bygget fungerar i en riktig
// webbläsare från file://, eller att PNG-exporten gör det. Det här testet öppnar
// oppen-lonekartlaggning.html i riktig Chromium via file:// — samma väg som
// användaren — och kontrollerar att biblioteken laddas under den hårdade CSP:n,
// att diagrammen får en <svg>, att modalen fungerar och att inget skrivs till
// localStorage.
//
//   npm run bundle && npm run test:browser                 (Chromium)
//   npm run test:browser:firefox / npm run test:browser:webkit
// eller: node tools/browser-smoke.mjs --browser=firefox
// Med --bilder=<katalog> sparas diagramkärnans exporterade PNG och SVG där, för granskning med ögat.
import { chromium, firefox, webkit } from 'playwright';
import { existsSync, statSync, readdirSync, readFileSync, writeFileSync, mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const ROOT = process.cwd();
const FIL = join(ROOT, 'dist', 'oppen-lonekartlaggning.html');

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
const WEBKIT_SELECT_STILMALL = /^Refused to apply a stylesheet because its hash, its nonce, or 'unsafe-inline' does not appear in the style-src directive/;

const WEBBLASARE = { chromium, firefox, webkit };
const NAMN = (process.argv.find(a => a.startsWith('--browser=')) || '--browser=chromium').split('=')[1];
if (!WEBBLASARE[NAMN]) { console.error(`✗ Okänd webbläsare "${NAMN}" (chromium, firefox eller webkit).`); process.exit(1); }
const BILDER = (process.argv.find(a => a.startsWith('--bilder=')) || '').split('=')[1] || '';
// Urklippsbehörighet kan bara ges i Chromium; i övriga webbläsare klickas knapparna, men
// urklippets innehåll läses inte tillbaka.
const KAN_LASA_URKLIPP = NAMN === 'chromium';

let fel = 0;
const ok = (v, txt) => { console.log(`  ${v ? '✓' : '✗'} ${txt}`); if (!v) fel++; };

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

const browser = await WEBBLASARE[NAMN].launch();
console.log(`Webbläsare: ${NAMN} ${browser.version()}`);
// Varje förfrågan från varje sida röktestet öppnar samlas här; allt utom den lokala filen och data:/blob:-adresser
// är utgående trafik och får inte förekomma (riskanalysen §6.1).
const natverk = [];
const _nySida = browser.newPage.bind(browser);
browser.newPage = async (...arg) => {
    const s = await _nySida(...arg);
    s.on('request', r => { const u = r.url(); if (!/^(file|data|blob|about):/.test(u)) natverk.push(u); });
    return s;
};
// Urklippsbehörighet: rapportunderlaget kopierar text och diagram till urklipp.
const page = await browser.newPage({ viewport: { width: 1400, height: 1000 },
    ...(KAN_LASA_URKLIPP ? { permissions: ['clipboard-read', 'clipboard-write'] } : {}) });
// Varje CSP-överträdelse (skript, stilelement, bilder …) samlas här, oavsett hur webbläsaren
// loggar den. Stilelement kräver kontrollsumma.
await page.addInitScript(webkitSelect => {
    window.__cspBrott = [];
    document.addEventListener('securitypolicyviolation', e => { if (webkitSelect && e.violatedDirective === 'style-src-attr' && e.target && (e.target.tagName === 'SELECT' || e.target.nodeName === '#document')) return; const m = e.target && e.target.nodeType === 1 ? e.target : null; window.__cspBrott.push(`${e.violatedDirective}: ${e.blockedURI || e.sample || ''}${m ? ' på ' + m.tagName.toLowerCase() + (m.id ? '#' + m.id : '') + (typeof m.className === 'string' && m.className ? '.' + m.className.trim().split(/\s+/).join('.') : '') : ' på ' + (e.target ? e.target.nodeName : 'okänt mål')} (rad ${e.lineNumber}${e.sourceFile ? ', ' + e.sourceFile.split('/').pop().slice(0, 30) : ''})`); });
}, NAMN === 'webkit');

const konsolfel = [], sidfel = [];
page.on('console', m => {
    if (m.type() !== 'error') return;
    const t = m.text();
    if (TILLATNA_KONSOLFEL.some(re => re.test(t)) || (NAMN === 'webkit' && WEBKIT_SELECT_STILMALL.test(t))) return;
    konsolfel.push(t);
});
page.on('pageerror', e => sidfel.push(String(e && e.message || e)));
// rapporteraFel() skriver en varning när en analysdel hoppades över.
const internaFel = [];
page.on('console', m => { if (m.type() === 'warning' && /Internt fel i/.test(m.text())) internaFel.push(m.text()); });

console.log('\n── Laddning och CSP ──');
await page.goto('file://' + FIL);
ok((await page.title())=== 'Öppen lönekartläggning', 'sidan laddar med rätt titel');

// Att biblioteken finns bevisar att CSP:ns per-script-hashar stämmer. Vid minsta
// avvikelse i bundlingen blockeras skripten och allt nedan faller.
for (const [namn, uttryck] of [
    ['D3', 'typeof window.d3'],
    ['XLSX', 'typeof window.XLSX'],
    ['PapaParse', 'typeof window.Papa'],
    ['JSZip', 'typeof window.JSZip'],
]) ok(await page.evaluate(uttryck) !== 'undefined', `${namn} laddat under hårdad CSP`);

console.log('\n── Demolänken (?demo=1) ──');
{
    const demoSida = await browser.newPage();
    await demoSida.goto('file://' + FIL + '?demo=1');
    await demoSida.waitForFunction(() => document.getElementById('demo-mode-banner')?.style.display === 'flex', { timeout: 15000 });
    ok(await demoSida.evaluate(() => document.getElementById('dashboard-summary').style.display === 'grid'),
        'adressen ?demo=1 startar demoläget direkt');
    await demoSida.close();
}

console.log('\n── Lönefil vars kolumner inte känns igen ──');
{
    const sida = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await sida.goto('file://' + FIL);
    const rader = ['Avd;Befattning;Grundlon;Fodd;Sex'];
    for (let i = 0; i < 30; i++) rader.push(`X;Handläggare;${30000 + i};${1970 + i};${i % 2 ? 'M' : 'K'}`);
    await sida.setInputFiles('#file-input-data', { name: 'okand.csv', mimeType: 'text/csv', buffer: Buffer.from(rader.join('\n'), 'utf8') });
    await sida.waitForFunction(() => /Kolumnmappning behövs/.test(document.getElementById('column-map-panel')?.textContent || ''), { timeout: 15000 });
    await sida.waitForTimeout(300);
    const l = await sida.evaluate(() => {
        const r = document.getElementById('column-map-panel').getBoundingClientRect();
        return { topp: r.top, botten: r.bottom, hojd: innerHeight, last: document.getElementById('tab-matrix').disabled,
            marke: document.querySelector('#upload-cell-data .upload-badge').textContent,
            fokus: document.activeElement?.getAttribute('data-colmap-role') };
    });
    ok(l.last && /Kolumnmappning/.test(l.marke) && !/Inläst/.test(l.marke), `filen märks «${l.marke}» och flikarna är låsta`);
    ok(l.topp >= 0 && l.topp < l.hojd && l.botten <= l.hojd + 1, `kolumnmappningen är i bild efter inläsning (${Math.round(l.topp)}–${Math.round(l.botten)} av ${l.hojd})`);
    ok(l.fokus === 'bas', 'fokus står i första fältet som saknar kolumn');
    await sida.close();
}

console.log('\n── Demodata ──');
await page.click('#first-run-demo-link');
ok(await page.evaluate(() => document.getElementById('upload-row').style.display !== 'none' && !document.getElementById('upload-collapsed-bar')), 'filrutorna syns efter inläsning');
await page.waitForFunction(() => {
    const b = document.getElementById('demo-mode-banner');
    return b && b.style.display === 'flex';
}, { timeout: 15000 });
ok(true, 'demodata inläst, banner synlig');
// hidden-attributet måste faktiskt dölja elementet — författar-CSS (display:flex) vinner
// annars över webbläsarens [hidden]-regel, vilket jsdom-testerna inte kan se.
const osynlig = sel => page.evaluate(s => { const el = document.querySelector(s); return !!el && getComputedStyle(el).display === 'none'; }, sel);
ok(!(await osynlig('.nav-item[data-tab="benchmark"]')), 'Jämförelse syns med ställningstagandet, utan jämförelsestatistik');
ok(await osynlig('#referens-namn-rad'), 'namnfältet för egen referens är dolt i demoläget');
ok(await osynlig('#btn-referens-aterga'), '"Ta bort referensen" är dold i demoläget');

console.log('\n── Demolägets referens (Exempelkommunen, ADR-28) ──');
await page.click('.nav-item[data-tab="prioritering"]');
await page.evaluate(() => document.querySelectorAll('details.avsnitt').forEach(d => { d.open = true; }));
await page.waitForTimeout(400);
ok(await page.evaluate(() => document.querySelectorAll('#prio-table tbody tr').length > 0),
    'Prioritering fungerar med demolägets referens');
ok(await page.evaluate(() => (document.getElementById('prio-ref-policy-namn') || {}).textContent === 'Exempelkommunens lönepolitik'),
    'Prioritering namnger demolägets referens');
await page.click('.nav-item[data-tab="dashboard"]');
await page.evaluate(() => document.querySelectorAll('details.avsnitt').forEach(d => { d.open = true; }));

console.log('\n── Policyuppladdning (riktig file-input) ──');
// Ett eget ställningstagande laddas upp genom den RIKTIGA uppladdningsytan — det är
// enda stället där CSV-parsern körs i en verklig webbläsare — och namnges efter filen.
const basLista = await page.evaluate(() => {
    const sel = document.getElementById('bas-select-kon');
    return sel ? [...sel.options].map(o => o.value).filter(v => v && v !== 'alla') : [];
});
ok(basLista.length > 0, `hittade ${basLista.length} BAS-intervall i demodatan`);
const policyCsv = 'BAS;P10;Median;P90\n'
    + basLista.map(b => `${b};24000;32000;45000`).join('\n') + '\n';
await page.setInputFiles('#file-input-policy', {
    name: 'stallningstagande.csv', mimeType: 'text/csv', buffer: Buffer.from(policyCsv, 'utf8')
});
await page.waitForFunction(() => {
    const el = document.getElementById('policy-status');
    return el && /inlästa|inläst/i.test(el.textContent || '');
}, { timeout: 15000 });
ok(true, 'policyfilen lästes in via uppladdningsytan');
ok(await page.evaluate(() => document.getElementById('referens-namn').value === 'stallningstagande'),
    'den egna referensen namngavs efter filen');
ok(!(await osynlig('#referens-namn-rad')) && !(await osynlig('#btn-referens-aterga')),
    'namnfältet och "Återgå" visas med egen referens');

console.log('\n── Flikar och diagram ──');
// Fliken Jämförelse syns bara med inläst jämförelsestatistik. Lägg in en syntetisk statistik
// per AID och BAS i underlaget, som uppladdningen gör (state + _visaJamforelseFlik).
/* global state, _visaJamforelseFlik -- funktionen nedan körs i sidan, där de finns */
await page.evaluate(() => {
    const par = [...new Set(state.data.map(r => `${r.aid}|${r.bas}`))];
    state.statistik = par.map(k => { const [aid, bas] = k.split('|'); return { aid, bas, median: 34000, p10: 30000, p90: 39000 }; });
    state.statistikHasP10 = true;
    state.statistikHasP90 = true;
    _visaJamforelseFlik(true);
});
// Diagram som MÅSTE ha ritats på demodata: en <svg> i containern.
const FLIKAR = [
    ['matrix', ['#chart-skevhet-overview']],
    ['likvardighet', []],
    ['struktur', ['#chart-sektorer']],
    ['prioritering', ['#chart-prio-pareto', '#chart-prio-matrix']],
    ['benchmark', ['#chart-lp-bandmap', '#chart-lp-compliance']],
    ['loneoversyn', []],
    ['kon', ['#chart-kon-scatter', '#chart-kon-boxplot', '#chart-demo-hist']],
    ['utforska', ['#chart-explore']],
    ['benchmark', ['#chart-jamforelse-spann', '#chart-jamforelse-avvikelse']],
    ['dokumentera', []],
];
for (const [flik, diagram] of FLIKAR) {
    await page.click(`.nav-item[data-tab="${flik}"]`);
    await page.evaluate(() => document.querySelectorAll('details.avsnitt').forEach(d => { d.open = true; }));
    await page.waitForTimeout(400);           // låt fliken rita klart
    for (const sel of diagram) {
        const harSvg = await page.evaluate(s => {
            const el = document.querySelector(s);
            return !!(el && el.querySelector('svg') && el.getBoundingClientRect().height > 50);
        }, sel);
        ok(harSvg, `${flik}: ${sel} renderade ett diagram`);
    }
    if (flik === 'kon') {
        // Spridningsdiagrammet ritas av diagramkärnan: axeltitlarna står som text i SVG:n.
        const titlar = await page.evaluate(() => [...document.querySelectorAll('#chart-kon-scatter svg text')].map(t => t.textContent.trim()));
        ok(titlar.includes('Ålder') && titlar.includes('Månadslön'), 'axeltitlarna ritas (Ålder, Månadslön)');
    }
    if (!diagram.length) ok(true, `${flik}: renderade utan fel`);
}

console.log('\n── Diagrammen (diagramkärnan, ADR-39) ──');
// Varje diagram ritas av diagramkärnan: en SVG med märken, och exportmenyn ger en PNG och en SVG som inte
// är tomma. Ett diagram som vyn ersätter med en förklarande text
// (för få grupper i demodatan) räknas som riktigt — då finns ingen figur och ingen bild.
const DIAGRAMMEN = [['matrix', 'chart-skevhet-overview'], ['matrix', 'chart-perbas-gap'], ['struktur', 'chart-sektorer'],
                  ['benchmark', 'chart-lp-gender'], ['benchmark', 'chart-lp-compliance'], ['kon', 'chart-demo-hist'],
                  // linjer, band och lådor
                  ['kon', 'chart-kon-scatter'], ['kon', 'chart-kon-boxplot'],
                  ['kon', 'chart-demo-agecurve'], ['kon', 'chart-demo-spread'], ['matrix', 'lifecycle-chart'],
                  // de sammansatta diagrammen
                  ['benchmark', 'chart-jamforelse-spann'], ['benchmark', 'chart-jamforelse-avvikelse'], ['benchmark', 'chart-lp-bandmap'], ['benchmark', 'chart-ref-hantel'],
                  ['prioritering', 'chart-prio-pareto'], ['prioritering', 'chart-prio-matrix'], ['likvardighet', 'chart-likvardighet-heatmap'],
                  // Utforska
                  ['utforska', 'chart-explore']];
for (const [flik, id] of DIAGRAMMEN) {
    await page.click(`.nav-item[data-tab="${flik}"]`);
    await page.evaluate(() => document.querySelectorAll('details.avsnitt').forEach(d => { d.open = true; }));
    await page.waitForTimeout(400);
    const lage = await page.evaluate(i => {
        const el = document.getElementById(i);
        if (!el) return { finns: false };
        return { finns: true, figur: !!el._figur, marken: el.querySelectorAll(':scope > svg [data-marke]').length,
                 beskrivning: (el.querySelector(':scope > svg[role="group"]') || { getAttribute: () => '' }).getAttribute('aria-label') || '',
                 text: el.textContent.trim().slice(0, 60), knapp: !!el.parentElement.querySelector('.chart-export-btn') };
    }, id);
    if (!lage.finns) { ok(false, `${id}: behållaren finns`); continue; }
    if (!lage.figur) { ok(lage.marken === 0 && lage.text.length > 0, `${id}: inget diagram för demodatan — vyns text visas ("${lage.text}")`); continue; }
    ok(lage.marken > 0 && lage.beskrivning.length > 10, `${id}: diagramkärnan ritade ${lage.marken} märken, med beskrivning`);
    // Skärmbild bara av ett synligt diagram (livscykeldiagrammet ligger i ett hopfällt avsnitt).
    if (BILDER && await page.locator(`#${id}`).isVisible()) { mkdirSync(BILDER, { recursive: true }); await page.locator(`#${id}`).screenshot({ path: join(BILDER, `${NAMN}-${id}.png`) }); }
    for (const [val, ext] of [['png-dokument', 'png'], ['svg', 'svg']]) {
        await page.evaluate(i => document.getElementById(i).parentElement.querySelector('.chart-export-btn').click(), id);
        const [nedladdning] = await Promise.all([
            page.waitForEvent('download', { timeout: 10000 }),
            page.evaluate(([i, v]) => document.getElementById(i).parentElement.querySelector(`[data-chart-export="${v}"]`).click(), [id, val])
        ]);
        const tmpFil = join(mkdtempSync(join(tmpdir(), 'olk-flyttad-')), nedladdning.suggestedFilename());
        await nedladdning.saveAs(tmpFil);
        const bytes = readFileSync(tmpFil);
        const riktig = ext === 'png' ? bytes.subarray(0, 8).toString('hex') === '89504e470d0a1a0a' && bytes.length > 5000
                                     : bytes.toString('utf8').startsWith('<svg xmlns="http://www.w3.org/2000/svg"') && /data-marke=/.test(bytes.toString('utf8'));
        ok(riktig, `${id}: ${ext.toUpperCase()}-export gav ${nedladdning.suggestedFilename()} (${bytes.length} byte)`);
        if (BILDER && ext === 'png') writeFileSync(join(BILDER, `${NAMN}-${id}-export.png`), bytes);
    }
}

console.log('\n── Länkade vyer: en markerad grupp framhävs i alla diagram ──');
/* global diagramMarkering, sattDiagramMarkering, getData, explorerUrval, _chartExportRubrikFot -- funktionerna nedan körs i sidan, där de finns */
{
    await page.click('.nav-item[data-tab="benchmark"]');
    await page.evaluate(() => document.querySelectorAll('details.avsnitt').forEach(d => { d.open = true; }));
    await page.waitForTimeout(400);
    await page.click('.nav-item[data-tab="matrix"]');
    await page.evaluate(() => document.querySelectorAll('details.avsnitt').forEach(d => { d.open = true; }));
    await page.waitForTimeout(400);
    await page.locator('#chart-skevhet-overview [data-marke="punkt"]').first().click();
    await page.waitForTimeout(200);
    const efterKlick = await page.evaluate(() => ({ nyckel: diagramMarkering(), rad: (document.getElementById('markering-rad') || {}).textContent || '',
        har: document.querySelectorAll('#chart-skevhet-overview [data-markerad]').length, andra: document.querySelectorAll('#chart-lp-compliance [data-markerad]').length }));
    ok(Array.isArray(efterKlick.nyckel) && /^bas:/.test(efterKlick.nyckel[0] || '') && efterKlick.rad.includes('Markerat i alla diagram: BAS'), `ett klick på en stapel markerar dess BAS (${efterKlick.nyckel})`);
    ok(efterKlick.har > 0 && efterKlick.andra > 0, `samma BAS framhävs i ett diagram i en annan flik (${efterKlick.andra} märken i Lönepolitik)`);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(150);
    const efterEsc = await page.evaluate(() => ({ nyckel: diagramMarkering(), rad: !!document.getElementById('markering-rad'), kvar: document.querySelectorAll('[data-markerad], svg [opacity="0.22"]').length }));
    ok(efterEsc.nyckel === null && !efterEsc.rad && efterEsc.kvar === 0, 'Escape tar bort markeringen och återställer diagrammen');
    // Tabellen följer markeringen, och pensling i spridningsdiagrammet framhäver punkterna i området.
    // En rad som hör till ett BAS (rader för BAS där ett kön är under tröskeln byggs för sig och går inte att markera).
    const radNr = await page.evaluate(() => [...document.querySelectorAll('#paygap-table tbody tr')].findIndex(r => Array.isArray(r._markering)));
    await page.locator('#paygap-table tbody tr').nth(Math.max(0, radNr)).locator('td').first().click();
    await page.waitForTimeout(150);
    ok(await page.evaluate(() => document.querySelectorAll('#paygap-table tbody tr.rad-markerad').length === 1 && document.querySelectorAll('#chart-skevhet-overview [data-markerad]').length > 0),
        'ett klick på en tabellrad markerar gruppen, i tabellen och i diagrammet');
    await page.keyboard.press('Escape');
    await page.click('.nav-item[data-tab="kon"]');
    await page.evaluate(() => document.querySelectorAll('details.avsnitt').forEach(d => { d.open = true; }));
    await page.waitForTimeout(500);
    // Menyn följer med sidan, så ett klick i den rullar inte sidan: diagrammet rullas fram här.
    await page.locator('#chart-kon-scatter svg[data-del="panel"]').first().scrollIntoViewIfNeeded();
    const yta = await page.locator('#chart-kon-scatter svg[data-del="panel"]').first().boundingBox();
    await page.mouse.move(yta.x + yta.width * 0.25, yta.y + yta.height * 0.2);
    await page.mouse.down();
    await page.mouse.move(yta.x + yta.width * 0.6, yta.y + yta.height * 0.8, { steps: 6 });
    await page.mouse.up();
    await page.waitForTimeout(200);
    const pensel = await page.evaluate(() => ({ not: (document.querySelector('[data-rf="pensel"]') || {}).textContent || '', inne: document.querySelectorAll('#chart-kon-scatter [data-penslad]').length,
        ute: document.querySelectorAll('#chart-kon-scatter circle[opacity="0.22"]').length }));
    ok(/^Penslat område: \d+ punkter — /.test(pensel.not) && pensel.inne > 0 && pensel.ute > 0, `pensling framhäver punkterna i området (${pensel.inne} av ${pensel.inne + pensel.ute}) och noten sammanfattar dem`);
    // Rutan ska ligga där pekaren drog, och just punkterna innanför den ska vara de framhävda.
    const rutLage = await page.evaluate(([x0, y0, x1, y1]) => { const r = document.querySelector('#chart-kon-scatter rect[data-del="pensel"]').getBoundingClientRect();
        const inne = c => { const b = c.getBoundingClientRect(), cx = b.left + b.width / 2, cy = b.top + b.height / 2; return cx >= x0 && cx <= x1 && cy >= y0 && cy <= y1; };
        const fel = [...document.querySelectorAll('#chart-kon-scatter circle[data-marke="punkt"]')].filter(c => inne(c) !== c.hasAttribute('data-penslad')).length;
        return { avvik: Math.max(Math.abs(r.left - x0), Math.abs(r.top - y0), Math.abs(r.right - x1), Math.abs(r.bottom - y1)), fel }; },
        [yta.x + yta.width * 0.25, yta.y + yta.height * 0.2, yta.x + yta.width * 0.6, yta.y + yta.height * 0.8]);
    ok(rutLage.avvik < 3 && rutLage.fel <= 2, `den penslade rutan ligger där pekaren drog (avvikelse ${rutLage.avvik.toFixed(1)} px, ${rutLage.fel} punkter på fel sida)`);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(100);
    ok(await page.evaluate(() => !document.querySelector('[data-rf="pensel"]') && !document.querySelector('#chart-kon-scatter [data-penslad]')), 'Escape tar bort det penslade området');

    // Zoom: pensla igen, "Zooma hit", och tillbaka med "Visa hela diagrammet".
    const taktFore = await page.evaluate(() => [...document.querySelectorAll('#chart-kon-scatter [data-axel="y"]')].map(t => t.textContent).join('|'));
    const yta2 = await page.locator('#chart-kon-scatter svg[data-del="panel"]').first().boundingBox();
    await page.mouse.move(yta2.x + yta2.width * 0.25, yta2.y + yta2.height * 0.2);
    await page.mouse.down();
    await page.mouse.move(yta2.x + yta2.width * 0.6, yta2.y + yta2.height * 0.8, { steps: 6 });
    await page.mouse.up();
    await page.waitForTimeout(200);
    await page.click('[data-rf="pensel"] button');
    await page.waitForTimeout(300);
    const zoom = await page.evaluate(() => ({ not: (document.querySelector('[data-rf="zoom"]') || {}).textContent || '', pensel: !!document.querySelector('[data-rf="pensel"]'),
        takt: [...document.querySelectorAll('#chart-kon-scatter [data-axel="y"]')].map(t => t.textContent).join('|'), fot: _chartExportRubrikFot(document.getElementById('chart-kon-scatter'), new Date()).fot }));
    ok(/utsnitt/.test(zoom.not) && !zoom.pensel && zoom.takt !== taktFore && /Utsnitt av diagrammet$/.test(zoom.fot), '"Zooma hit" ritar om diagrammet som ett utsnitt, och exportens fotrad säger det');
    if (BILDER) await page.locator('#chart-kon-scatter').screenshot({ path: `${BILDER}/zoom-${NAMN}.png` });
    await page.click('[data-rf="zoom"] button');
    await page.waitForTimeout(300);
    ok(await page.evaluate(f => !document.querySelector('[data-rf="zoom"]') && [...document.querySelectorAll('#chart-kon-scatter [data-axel="y"]')].map(t => t.textContent).join('|') === f, taktFore),
        '"Visa hela diagrammet" tar bort utsnittet');

    // Nedborrning: ett markerat BAS-intervall leder till yrkesgrupperna i Utforska, och raden där leder tillbaka.
    await page.click('.nav-item[data-tab="matrix"]');
    await page.evaluate(() => document.querySelectorAll('details.avsnitt').forEach(d => { d.open = true; }));
    await page.waitForTimeout(400);
    const borrBas = await page.evaluate(() => { const b = getData()[0].bas; sattDiagramMarkering(`bas:${b}`); return b; });
    await page.click('#markering-rad button[data-markering="borra"]');
    await page.waitForTimeout(600);
    const borr = await page.evaluate(() => ({ flik: (document.querySelector('.nav-item.active') || {}).getAttribute('data-tab'), rad: document.getElementById('explore-rad').value,
        not: document.getElementById('explore-nedborrning').textContent, synlig: !document.getElementById('explore-nedborrning').hidden, ritat: !!document.querySelector('#chart-explore > svg') }));
    ok(borr.flik === 'utforska' && borr.rad === 'aidbas' && borr.synlig && borr.not.includes(`BAS ${borrBas}`) && borr.ritat, `"Visa yrkesgrupperna" öppnar Utforska med yrkesgrupperna i BAS ${borrBas}`);
    if (BILDER) await page.locator('#view-utforska').screenshot({ path: `${BILDER}/borr-${NAMN}.png` }).catch(() => {});
    await page.click('#explore-nedborrning button');
    await page.waitForTimeout(500);
    ok(await page.evaluate(() => (document.querySelector('.nav-item.active') || {}).getAttribute('data-tab') === 'matrix' && document.getElementById('explore-nedborrning').hidden && explorerUrval().urval.villkor.length === 0),
        '"Tillbaka till föregående urval" återställer urvalet och går tillbaka till fliken');
    await page.keyboard.press('Escape');
}

console.log('\n── Lika arbete i formen resultat först ──');
{
    await page.reload();
    await page.goto('file://' + FIL + '?demo=1');
    await page.waitForFunction(() => document.getElementById('demo-mode-banner')?.style.display === 'flex', { timeout: 15000 });
    await page.waitForTimeout(1500);
    await page.evaluate(() => document.querySelector('.nav-item[data-tab="matrix"]').click());
    await page.waitForTimeout(1200);
    const form = await page.evaluate(() => { const a = [...document.querySelectorAll('details.avsnitt[id^="avsnitt-la-"]')]; const m = document.getElementById('main-content');
        return { slutsatser: document.querySelectorAll('#la-slutsatser .slutsats').length, oppna: a.filter(x => x.open).map(x => x.id), antal: a.length,
            huvud: Math.round(document.getElementById('la-oversikt').getBoundingClientRect().width), rader: document.querySelectorAll('#la-oversikt tbody tr').length, grafik: document.querySelectorAll('#la-oversikt tbody svg.la-oversikt-grafik').length,
            ryms: document.querySelector('#la-huvuddiagram .table-container').scrollWidth <= document.querySelector('#la-huvuddiagram .table-container').clientWidth + 1,
            nyckel: [...document.querySelectorAll('[id^="nyckel-la-"]')].filter(e => e.textContent.trim()).length, skarmar: +(Math.max(document.documentElement.scrollHeight, m.scrollHeight) / innerHeight).toFixed(1), lankrad: document.querySelectorAll('.sidans-innehall').length }; });
    const huvudet = await page.evaluate(() => { const r = s => document.querySelector(s).getBoundingClientRect(); const delar = ['#sok-grupp', '#btn-open-symbols', '#btn-open-installningar', '#btn-open-glossary'].map(r);
        return { overlapp: delar.some((d, i) => i > 0 && delar[i - 1].right > d.left + 0.5), utanfor: delar[delar.length - 1].right > r('.top-header').right + 0.5 }; });
    ok(!huvudet.overlapp && !huvudet.utanfor, 'sidhuvudet: sökfältet och knapparna står bredvid varandra utan att gå in över varandra');
    ok(form.slutsatser === 4 && form.huvud > 300 && form.rader > 0 && form.grafik === form.rader && form.ryms, `toppen visar fyra slutsatser och översiktstabellen med grafik i varje rad, utan sidrullning (${form.rader} rader, ${form.huvud} px bred)`);
    ok(form.antal >= 5 && form.oppna.length === 1 && form.oppna[0] === 'avsnitt-la-yrkesgrupper' && form.nyckel >= 4 && form.lankrad === 0, `${form.antal} avsnitt, bara det första öppet, ${form.nyckel} med nyckeltal, ingen länkrad`);
    console.log(`    (fliken är ${form.skarmar} skärmhöjder med bara första avsnittet öppet)`);
    await page.click('#avsnitt-la-bas > summary');
    await page.waitForTimeout(700);
    ok(await page.evaluate(() => { const s = document.querySelector('#chart-skevhet-hantel svg'); return !!s && s.getBoundingClientRect().width > 300 && document.querySelector('#paygap-table tbody tr').getBoundingClientRect().height > 0; }),
        'ett avsnitt som fälls ut ritar sitt diagram i full bredd och visar sin tabell');
    await page.keyboard.press('Tab');
    ok(await page.evaluate(() => { const s = document.querySelector('#avsnitt-la-kon > summary'); s.focus(); return document.activeElement === s; }), 'avsnittens rubriker går att nå med tangentbordet');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(300);
    ok(await page.evaluate(() => document.getElementById('avsnitt-la-kon').open), 'Enter fäller ut avsnittet');
}

console.log('\n── Ålder & karriär: ett urval för hela fliken ──');
{
    await page.evaluate(() => document.querySelector('.nav-item[data-tab="kon"]').click());
    await page.waitForTimeout(1200);
    const fore = await page.evaluate(() => ({ n: document.getElementById('kon-kpi-n').textContent, oppna: [...document.querySelectorAll('details.avsnitt[id^="avsnitt-ak-"]')].filter(a => a.open).map(a => a.id),
        skarmar: +(Math.max(document.documentElement.scrollHeight, document.getElementById('main-content').scrollHeight) / innerHeight).toFixed(1) }));
    ok(fore.oppna.length === 1 && fore.oppna[0] === 'avsnitt-ak-karriar', 'bara avsnittet om gapet över karriären är öppet');
    console.log(`    (fliken är ${fore.skarmar} skärmhöjder med bara första avsnittet öppet)`);
    const bas = await page.evaluate(() => [...document.getElementById('bas-select-kon').options].map(o => o.value).find(v => v !== '__ALLA__'));
    await page.selectOption('#bas-select-kon', bas);
    await page.waitForTimeout(900);
    const efter = await page.evaluate(() => ({ n: document.getElementById('kon-kpi-n').textContent, demo: document.getElementById('bas-select-demo').value, text: document.getElementById('ak-urval-text').textContent }));
    ok(efter.n !== fore.n && efter.demo === bas && /personer/.test(efter.text), `väljaren i urvalsraden gäller hela fliken (${efter.text.trim()})`);
    await page.click('#avsnitt-ak-struktur > summary');
    await page.waitForTimeout(700);
    ok(await page.evaluate(() => { const s = document.querySelector('#chart-demo-pyramid svg'); return !!s && s.getBoundingClientRect().width > 300; }), 'åldersstrukturen ritas i full bredd när avsnittet fälls ut');
    await page.selectOption('#bas-select-kon', '__ALLA__');
    await page.waitForTimeout(600);
}

console.log('\n── Prioritering: resultatet först ──');
{
    await page.evaluate(() => document.querySelector('.nav-item[data-tab="prioritering"]').click());
    await page.waitForTimeout(1200);
    const pr = await page.evaluate(() => { const g = id => document.getElementById(id); const top = el => el.getBoundingClientRect().top;
        return { matrisForst: top(g('chart-prio-matrix')) < top(g('avsnitt-pr-lista')), sist: top(g('avsnitt-pr-installningar')) > top(g('avsnitt-pr-lista')),
            oppna: [...document.querySelectorAll('details.avsnitt[id^="avsnitt-pr-"]')].filter(a => a.open).map(a => a.id).join(','), nyckel: g('nyckel-pr-installningar').textContent }; });
    ok(pr.matrisForst && pr.sist && pr.oppna === 'avsnitt-pr-lista' && pr.nyckel === 'Standardvärden', 'matrisen står före listan, inställningarna sist och hopfällda med nyckeltalet Standardvärden');
    await page.click('#avsnitt-pr-installningar > summary');
    await page.fill('#prio-cfg-atgard', '-8');
    await page.waitForTimeout(500);
    ok(await page.evaluate(() => document.getElementById('nyckel-pr-installningar').textContent === 'Anpassade värden'), 'en ändrad tröskel syns i avsnittets rubrik');
    await page.click('#prio-cfg-reset');
    await page.waitForTimeout(400);
}

console.log('\n── Dokumentera: checklistan först, exporterna som lista ──');
{
    await page.evaluate(() => document.querySelector('.nav-item[data-tab="prioritering"]').click());
    await page.waitForTimeout(600);
    const jfr = await page.evaluate(() => { const r = document.getElementById('view-prioritering').getBoundingClientRect(); return { x: r.left, y: r.top - document.querySelector('.content-body').getBoundingClientRect().top }; });
    await page.evaluate(() => document.querySelector('.nav-item[data-tab="dokumentera"]').click());
    await page.waitForTimeout(1200);
    const dk = await page.evaluate(() => { const g = id => document.getElementById(id); const r = g('view-kvalitet').getBoundingClientRect(); const top = id => g(id).getBoundingClientRect().top;
        return { x: r.left, y: r.top - document.querySelector('.content-body').getBoundingClientRect().top, ordning: top('dk-slutsatser') < top('dk-checklista') && top('dk-checklista') < top('export-hub') && top('export-hub') < top('avsnitt-dk-robusthet'),
            rutor: document.querySelectorAll('#dk-slutsatser .slutsats').length, rader: [...document.querySelectorAll('.export-lista > .export-hub-row')].filter(e => e.offsetParent).length,
            oppna: [...document.querySelectorAll('details.avsnitt[id^="avsnitt-dk-"]')].filter(a => a.open).map(a => a.id).join(','), lank: document.querySelectorAll('.sidans-innehall').length,
            skarmar: document.documentElement.scrollHeight / innerHeight }; });
    ok(Math.abs(dk.x - jfr.x) < 1 && Math.abs(dk.y - jfr.y) < 1, `fliken börjar lika långt från innehållsytans kant som andra flikar — inget tomt band (${Math.round(dk.x)},${Math.round(dk.y)} mot ${Math.round(jfr.x)},${Math.round(jfr.y)})`);
    ok(dk.ordning && dk.rutor === 3 && dk.rader === 10 && dk.lank === 0, 'slutsatser, checklista, tio exportrader och sedan avsnitten');
    ok(dk.oppna === 'avsnitt-dk-robusthet' && dk.skarmar < 4, `bara robustheten är utfälld och sidan är ${dk.skarmar.toFixed(1)} skärmar`);
    await page.click('#btn-run-robusthet');
    await page.waitForFunction(() => document.querySelector('#robusthet-body .gd-grid'), { timeout: 60000 });
    ok(await page.evaluate(() => !/Inte körd/.test(document.querySelectorAll('#dk-slutsatser .slutsats')[1].textContent) && document.getElementById('nyckel-dk-robusthet').textContent.length > 3), 'robusthetens utfall står i slutsatserna och i avsnittets rubrik');
    await page.click('#avsnitt-dk-rapportunderlag > summary');
    await page.waitForTimeout(300);
    ok(await page.evaluate(() => { const k = document.querySelector('#rapportunderlag-innehall [data-rapport-kopiera]'); return !!k && k.offsetParent !== null; }), 'rapportunderlagets block går att nå när avsnittet fälls ut');
    for (const f of ['benchmark', 'utforska']) {
        await page.evaluate(t => document.querySelector(`.nav-item[data-tab="${t}"]`).click(), f);
        await page.waitForTimeout(700);
        const x = await page.evaluate(() => [...document.querySelectorAll('.view-panel')].find(v => v.offsetParent).getBoundingClientRect().left);
        ok(Math.abs(x - jfr.x) < 1, `${f}: panelen ligger i innehållsytan`);
    }
}

console.log('\n── Struktur, Likvärdigt arbete, Löneöversyn och Lönepolitik ──');
{
    const ga = async f => { await page.evaluate(t => document.querySelector(`.nav-item[data-tab="${t}"]`).click(), f); await page.waitForTimeout(1000); };
    const lage = prefix => page.evaluate(p => ({ oppna: [...document.querySelectorAll(`details.avsnitt[id^="${p}"]`)].filter(a => a.open).map(a => a.id).join(','),
        rutor: [...document.querySelectorAll('.view-panel')].filter(v => v.offsetParent).reduce((n, v) => n + v.querySelectorAll('.slutsatser .slutsats').length, 0),
        lank: document.querySelectorAll('.sidans-innehall').length, skarmar: document.documentElement.scrollHeight / innerHeight }), prefix);
    // Ett diagram i ett hopfällt avsnitt har ingen bredd när det ritas: det ska fylla kortet när avsnittet fälls ut.
    const fyller = async (avsnitt, diagram) => { await page.click(`#${avsnitt} > summary`); await page.waitForTimeout(700);
        return page.evaluate(id => { const el = document.getElementById(id), svg = el && el.querySelector('svg'); if (!svg) return 'inget diagram';
            const a = svg.getBoundingClientRect().width, b = el.getBoundingClientRect().width; return a > 300 && a <= b + 1 && a > b * 0.6 ? 'ok' : `${Math.round(a)} av ${Math.round(b)}`; }, diagram); };

    await ga('struktur');
    let l = await lage('avsnitt-st-');
    ok(l.oppna === 'avsnitt-st-representation' && l.rutor === 5 && l.lank === 0 && l.skarmar < 4, `Struktur: fem slutsatser, kartan och representationen utfälld (${l.skarmar.toFixed(1)} skärmar)`);
    ok(await page.evaluate(() => !!document.querySelector('#chart-struktur-tradkarta svg')), 'Struktur: kartan är ritad överst');
    let b = await fyller('avsnitt-st-eu', 'chart-struktur-kvartiler');
    ok(b === 'ok', `Struktur: kvartildiagrammet fyller kortet när avsnittet fälls ut (${b})`);
    b = await fyller('avsnitt-st-sektorer', 'chart-sektorer');
    ok(b === 'ok', `Struktur: sektorsdiagrammet fyller kortet när avsnittet fälls ut (${b})`);

    await ga('likvardighet');
    l = await lage('avsnitt-lv-');
    ok(l.oppna === 'avsnitt-lv-par' && l.rutor === 4 && l.skarmar < 4.5, `Likvärdigt arbete: fyra slutsatser, krav mot lön och paren utfällda (${l.skarmar.toFixed(1)} skärmar)`);
    await page.click('#avsnitt-lv-installningar > summary');
    await page.fill('#lv-min-gap', '2');
    await page.dispatchEvent('#lv-min-gap', 'change');
    await page.waitForTimeout(700);
    ok(await page.evaluate(() => document.getElementById('avsnitt-lv-installningar').open && document.getElementById('nyckel-lv-installningar').textContent === 'Anpassade värden'), 'Likvärdigt arbete: inställningarna står kvar utfällda efter en ändring');
    await page.fill('#lv-min-gap', '5');
    await page.dispatchEvent('#lv-min-gap', 'change');
    await page.waitForTimeout(500);

    await ga('loneoversyn');
    l = await lage('avsnitt-lo-');
    // Utan pott: en rad säger vad som behövs, och mätaren, diagrammet före/efter och exporten visas inte.
    const tomt = await page.evaluate(() => ({ text: document.getElementById('forecast-outcome').textContent.trim(),
        dolt: ['forecast-meter', 'forecast-export', 'chart-forecast-lutning'].every(id => document.getElementById(id).getBoundingClientRect().height === 0) }));
    ok(tomt.text === 'Ange en pott ovan så visas utfallet här.' && tomt.dolt, 'Löneöversyn utan pott: en rad om vad som behövs, ingen tom mätare');
    await page.fill('#forecast-budget-value', '2');
    await page.dispatchEvent('#forecast-budget-value', 'input');
    await page.dispatchEvent('#forecast-budget-value', 'change');
    await page.waitForTimeout(300);
    const lo = await page.evaluate(() => { const top = id => document.getElementById(id).getBoundingClientRect().top; return top('forecast-budget-value') < top('forecast-meter') && top('forecast-meter') < top('forecast-outcome') && top('forecast-outcome') < top('avsnitt-lo-riktade'); });
    ok(lo && l.oppna === 'avsnitt-lo-riktade', 'Löneöversyn: budget, budgetutnyttjande och utfall före avsnitten; riktade potter utfällt');
    await page.click('#forecast-optimize');
    await page.waitForTimeout(900);
    ok(await page.evaluate(() => /^\d+ riktad/.test(document.getElementById('nyckel-lo-riktade').textContent)), 'Löneöversyn: förslaget syns som antal riktade potter i avsnittets rubrik');
    await page.click('#forecast-reset');
    await page.waitForTimeout(500);

    await ga('benchmark');
    await page.evaluate(() => { for (const [id, oppen] of [['avsnitt-jmf-overblick', false], ['avsnitt-jmf-stallningstagande', true], ['avsnitt-jmf-statistik', false]]) document.getElementById(id).open = oppen; });
    await page.waitForTimeout(300);
    l = await lage('avsnitt-lp-');
    ok(l.oppna === 'avsnitt-lp-tabell' && l.rutor === 6 && l.skarmar < 4, `Jämförelse, avsnittet mot ställningstagandet (utan statistik): flikens två och avsnittets fyra slutsatser, bandkartan och tabellen utfälld (${l.rutor} rutor, ${l.oppna}, ${l.skarmar.toFixed(1)} skärmar)`);
    await page.evaluate(() => { document.getElementById('avsnitt-jmf-overblick').open = true; });
    b = await fyller('avsnitt-lp-kon', 'chart-lp-gender');
    ok(b === 'ok' || b === 'inget diagram', `Lönepolitik: könspositionen fyller kortet när avsnittet fälls ut (${b})`);
    b = await fyller('avsnitt-lp-efterlevnad', 'chart-lp-compliance');
    ok(b === 'ok', `Lönepolitik: efterlevnaden fyller kortet när avsnittet fälls ut (${b})`);
}

console.log('\n── Exportmeny ──');
await page.click('.nav-item[data-tab="utforska"]');
await page.evaluate(() => document.querySelectorAll('details.avsnitt').forEach(d => { d.open = true; }));
await page.waitForTimeout(400);
const exportHost = '#chart-explore';
ok(await page.evaluate(s => !!document.querySelector(s).parentElement.querySelector('.chart-export-btn'), exportHost),
    'Utforska-diagrammet har en exportknapp');
for (const [val, ext] of [['png-dokument', 'png'], ['svg', 'svg']]) {
    await page.evaluate(s => document.querySelector(s).parentElement.querySelector('.chart-export-btn').click(), exportHost);
    const [nedladdning] = await Promise.all([
        page.waitForEvent('download', { timeout: 10000 }),
        page.evaluate(([s, v]) => document.querySelector(s).parentElement
            .querySelector(`[data-chart-export="${v}"]`).click(), [exportHost, val])
    ]);
    const namn = nedladdning.suggestedFilename();
    ok(new RegExp(`^DEMO_Utforska_.+_\\d{4}-\\d{2}-\\d{2}\\.${ext}$`).test(namn), `${ext.toUpperCase()}-export gav filen ${namn}`);
}
await page.evaluate(() => document.getElementById('explore-typ').value = 'hantel');
await page.evaluate(() => document.getElementById('explore-typ').dispatchEvent(new Event('change', { bubbles: true })));
await page.waitForTimeout(300);
ok(await page.evaluate(() => !!document.querySelector('#chart-explore svg')), 'Utforska ritar hanteldiagram');

console.log('\n── Punktsvärm, före och efter, övergångar ──');
/* global _rfOvergangPa -- funktionerna nedan körs i sidan, där de finns */
{
    await page.evaluate(() => { const t = document.getElementById('explore-typ'); t.value = 'svarm'; t.dispatchEvent(new Event('change', { bubbles: true })); });
    await page.waitForTimeout(500);
    const svarm = await page.evaluate(() => {
        const p = [...document.querySelectorAll('#chart-explore circle[data-marke="individ"]')].map(c => [Number(c.getAttribute('cx')) + c.closest('svg[data-del="panel"]').getBoundingClientRect().left, Number(c.getAttribute('cy')), Number(c.getAttribute('r'))]);
        let krockar = 0;
        for (let i = 0; i < p.length; i++) for (let j = i + 1; j < p.length; j++) if (Math.hypot(p[i][0] - p[j][0], p[i][1] - p[j][1]) < 2 * p[i][2] - 0.01) krockar++;
        return { antal: p.length, krockar };
    });
    ok(svarm.antal > 20 && svarm.krockar < svarm.antal * 0.1, `Utforska ritar punktsvärm (${svarm.antal} punkter, ${svarm.krockar} som ligger ovanpå en annan)`);
    if (BILDER) await page.locator('#chart-explore').screenshot({ path: `${BILDER}/svarm-${NAMN}.png` });
    await page.evaluate(() => { const t = document.getElementById('explore-typ'); t.value = 'regnmoln'; t.dispatchEvent(new Event('change', { bubbles: true })); });
    await page.waitForTimeout(500);
    const regn = await page.evaluate(() => ({ moln: document.querySelectorAll('#chart-explore path[data-form="regnmoln"]').length, punkter: document.querySelectorAll('#chart-explore circle[data-marke="individ"]').length }));
    ok(regn.moln >= 2 && regn.punkter > 20, `Utforska ritar regnmoln (${regn.moln} kurvor, ${regn.punkter} punkter)`);
    if (BILDER) await page.locator('#chart-explore').screenshot({ path: `${BILDER}/regnmoln-${NAMN}.png` });

    // Övergången: en omritning med rörelse flyttar märkena och slutar på ritarens egna lägen.
    if (!(await page.evaluate(() => _rfOvergangPa()))) await page.emulateMedia({ reducedMotion: 'no-preference' });
    const overgang = await page.evaluate(async () => {
        const el = document.createElement('div');
        el.id = 'chart-rok-overgang';
        el.style.width = '500px';
        document.querySelector('#view-utforska').appendChild(el);
        const f = (a, b) => ({ beskrivning: 'Ö', x: { skala: 'band', ordning: ['A', 'B'] }, y: { skala: 'linjar', doman: [0, 10] }, lager: [{ marke: 'stapel', serie: 'S', data: [{ x: 'A', y: a }, { x: 'B', y: b }] }] });
        const h = () => [...el.querySelectorAll('rect[data-marke="stapel"]')].map(r => Math.round(Number(r.getAttribute('height'))));
        ritaFigur(el, f(2, 8));
        const fore = h();
        ritaFigur(el, f(8, 2));
        const start = h(), pagar = !!el._rfOvergang;
        await new Promise(r => setTimeout(r, 600));
        const slut = h(), klar = !el._rfOvergang;
        rensaFigur(el);
        el.remove();
        return { pa: _rfOvergangPa(), fore, start, slut, pagar, klar };
    });
    ok(overgang.pa && overgang.pagar && overgang.klar && String(overgang.start) === String(overgang.fore) && String(overgang.slut) === String([...overgang.fore].reverse()),
        `en omritning flyttar märkena från de gamla lägena till de nya (${overgang.fore} → ${overgang.slut})`);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    ok(await page.evaluate(() => !_rfOvergangPa()), 'med "minska rörelse" i webbläsaren är övergångarna avslagna');
    await page.emulateMedia({ reducedMotion: null });

    // Före och efter i Löneöversyn.
    await page.click('.nav-item[data-tab="loneoversyn"]');
    await page.evaluate(() => document.querySelectorAll('details.avsnitt').forEach(d => { d.open = true; }));
    await page.waitForTimeout(600);
    await page.evaluate(() => { const v = document.getElementById('forecast-generell-value'); v.value = '2'; v.dispatchEvent(new Event('input', { bubbles: true })); v.dispatchEvent(new Event('change', { bubbles: true })); });
    await page.waitForTimeout(600);
    const lut = await page.evaluate(() => { const el = document.getElementById('chart-forecast-lutning'); return { linjer: el._figur ? el._figur.y.ordning.length : 0, streck: el.querySelectorAll('[data-marke="intervall"]').length, etiketter: el.querySelectorAll('text[data-marke="punktetikett"]').length, lika: el._figur ? el._figur.x.doman[1] > 100 : false, not: document.getElementById('forecast-lutning-not').textContent }; });
    ok(lut.linjer > 0 && lut.streck === lut.linjer && lut.etiketter === lut.linjer && lut.lika && /minst \d+ kvinnor/.test(lut.not), `Löneöversyn ritar lönegapet före och efter på en axel som når 100 % (${lut.linjer} BAS-intervall)`);
    if (BILDER) await page.locator('#chart-forecast-lutning').screenshot({ path: `${BILDER}/lutning-${NAMN}.png` });

    // Andelsstaplar: staplade staplar i Utforska och efterlevnaden kring en mittlinje i Lönepolitik.
    await page.click('.nav-item[data-tab="utforska"]');
    await page.evaluate(() => document.querySelectorAll('details.avsnitt').forEach(d => { d.open = true; }));
    await page.waitForTimeout(400);
    await page.evaluate(() => {
        const satt = (id, v) => { const e = document.getElementById(id); e.value = v; e.dispatchEvent(new Event('change', { bubbles: true })); };
        satt('explore-rad', 'bas'); satt('explore-kolumn', 'kon'); satt('explore-typ', 'staplade'); satt('explore-stapel-visa', 'andel');
    });
    await page.waitForTimeout(500);
    const stapl = await page.evaluate(() => { const f = document.getElementById('chart-explore')._figur; const sum = new Map(); for (const l of f.lager) for (const d of l.data) sum.set(d.x, (sum.get(d.x) || 0) + d.y);
        return { segment: document.querySelectorAll('#chart-explore rect[data-marke="stapel"]').length, summor: [...sum.values()].map(v => Math.round(v)) }; });
    ok(stapl.segment > 2 && stapl.summor.every(v => v === 100), `Utforska ritar staplade staplar som andel (${stapl.segment} segment, varje rad 100 %)`);
    if (BILDER) await page.locator('#chart-explore').screenshot({ path: `${BILDER}/staplade-${NAMN}.png` });
    await page.evaluate(() => { for (const [id, v] of [['explore-typ', 'auto'], ['explore-kolumn', 'ingen']]) { const e = document.getElementById(id); e.value = v; e.dispatchEvent(new Event('change', { bubbles: true })); } });
    await page.click('.nav-item[data-tab="benchmark"]');
    await page.evaluate(() => document.querySelectorAll('details.avsnitt').forEach(d => { d.open = true; }));
    await page.waitForTimeout(500);
    if (await page.evaluate(() => !!document.getElementById('lp-komplians-vy'))) {
        await page.selectOption('#lp-komplians-vy', 'mitt');
        await page.waitForTimeout(500);
        const mitt = await page.evaluate(() => { const el = document.getElementById('chart-lp-compliance'); return { serier: el._figur ? el._figur.lager.map(l => l.serie).join('|') : '', axel: [...el.querySelectorAll('[data-axel="x"]')].map(t => t.textContent).join(' '), noll: !!el.querySelector('[data-marke="nollinje"]') }; });
        ok(mitt.serier === 'Under P10|Över P90' && mitt.noll && !/[-−]/.test(mitt.axel), `Lönepolitik ställer efterlevnaden kring en mittlinje (axeln: ${mitt.axel})`);
        if (BILDER) await page.locator('#chart-lp-compliance').screenshot({ path: `${BILDER}/mitt-${NAMN}.png` });
        await page.selectOption('#lp-komplians-vy', 'staplad');
    } else console.log('  – Lönepolitik har ingen policy i demodatan: mittlinjen prövas inte här');

    // Könsfördelning per BAS, avvikelse från förväntad lön per kön (Lika arbete) och ålderspyramiden (Ålder & karriär).
    await page.click('.nav-item[data-tab="matrix"]');
    await page.evaluate(() => document.querySelectorAll('details.avsnitt').forEach(d => { d.open = true; }));
    await page.waitForTimeout(700);
    const andel = await page.evaluate(() => { const el = document.getElementById('chart-skevhet-andel'), f = el._figur;
        return { rader: f ? f.lager[0].data.length : 0, tabell: document.querySelectorAll('#skevhet-table tbody tr').length, linjer: el.querySelectorAll('[data-marke="referenslinje"]').length }; });
    ok(andel.rader > 0 && andel.rader === andel.tabell && andel.linjer === 2, `Lika arbete ritar könsfördelningen per BAS-intervall (${andel.rader} intervall, linjer vid 40 och 60 %)`);
    if (BILDER) await page.locator('#chart-skevhet-andel').screenshot({ path: `${BILDER}/konsandel-${NAMN}.png` });
    const avv = await page.evaluate(() => { const t = document.getElementById('pag-avvikelse-tabell'); return { synlig: !document.getElementById('pag-diagram-ruta').hidden, rader: t.querySelectorAll('tbody tr').length,
        grafik: t.querySelectorAll('tbody svg').length, sma: t.querySelectorAll('.pag-litet').length, not: document.getElementById('pag-diagram-not').textContent }; });
    ok(avv.synlig && avv.rader >= 2 && avv.rader % 2 === 0 && avv.grafik === avv.rader, `Personer att granska visar avvikelsen från förväntad lön per kön som tabell med grafik i varje rad (${avv.rader / 2} BAS-intervall)`);
    ok(avv.sma === 0 || /färre än 5 personer/.test(avv.not), `andelar med litet underlag är märkta och förklaras (${avv.sma} andelar)`);
    if (BILDER) await page.locator('#pag-diagram-ruta').screenshot({ path: `${BILDER}/avvikelse-${NAMN}.png` });
    await page.click('.nav-item[data-tab="kon"]');
    await page.evaluate(() => document.querySelectorAll('details.avsnitt').forEach(d => { d.open = true; }));
    await page.waitForTimeout(700);
    const pyr = await page.evaluate(() => { const el = document.getElementById('chart-demo-pyramid'); return { staplar: el.querySelectorAll('rect[data-marke="stapel"]').length, axel: [...el.querySelectorAll('[data-axel="x"]')].map(t => t.textContent).join(' ') }; });
    ok(pyr.staplar > 4 && !/[-−]/.test(pyr.axel), `Ålder & karriär ritar ålderspyramiden (${pyr.staplar} staplar, axeln: ${pyr.axel})`);
    if (BILDER) await page.locator('#chart-demo-pyramid').screenshot({ path: `${BILDER}/pyramid-${NAMN}.png` });

    // Närmaste punkt, lönekvartilerna och krav mot lön.
    await page.locator('#chart-kon-scatter').scrollIntoViewIfNeeded();
    await page.waitForTimeout(400);
    // En punkt utan grannar inom 30 px, så att "närmaste" är entydigt; pekaren ställs några bildpunkter snett intill den.
    const hittaEnsam = () => page.evaluate(() => {
        const p = [...document.querySelectorAll('#chart-kon-scatter circle[data-marke="punkt"]')].map(c => { const r = c.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, i: c.getAttribute('data-l') + '/' + c.getAttribute('data-i'), bredd: document.getElementById('chart-kon-scatter').clientWidth }; })
            .filter(o => o.y > 60 && o.y < innerHeight - 60);
        return p.find(a => p.every(b => b === a || Math.hypot(a.x - b.x, a.y - b.y) > 30)) || null;
    });
    let ensam = await hittaEnsam();
    if (ensam) {
        // Första rörelsen kan ändra sidans bredd (tipset läggs i sidan) och därmed rita om diagrammet: mät om efteråt.
        await page.mouse.move(ensam.x + 30, ensam.y + 30);
        await page.waitForTimeout(400);
        ensam = await hittaEnsam();
        await page.mouse.move(ensam.x + 20, ensam.y + 20);
        await page.mouse.move(ensam.x + 7, ensam.y + 6, { steps: 4 });
        await page.waitForTimeout(150);
        const nara = await page.evaluate(() => { const m = document.querySelectorAll('#chart-kon-scatter [data-nara]'); const t = document.querySelector('.chart-tip-portal');
            return { antal: m.length, i: m[0] ? m[0].getAttribute('data-l') + '/' + m[0].getAttribute('data-i') : null, tips: !!t && getComputedStyle(t).display !== 'none' && t.textContent.trim().length > 0, bredd: document.getElementById('chart-kon-scatter').clientWidth }; });
        if (!(nara.antal === 1 && nara.i === ensam.i && nara.tips)) console.log('    (närmaste:', JSON.stringify({ nara, ensam }), ')');
        ok(nara.antal === 1 && nara.i === ensam.i && nara.tips, 'pekaren intill en punkt: den närmaste punkten får ringen och verktygstipset');
        await page.mouse.move(5, 5);
        await page.waitForTimeout(100);
        ok(await page.evaluate(() => !document.querySelector('#chart-kon-scatter [data-nara]')), 'ringen försvinner när pekaren lämnar diagrammet');
    } else ok(false, 'hittade ingen ensam punkt att pröva närmaste-punkt på');
    // I samma flik: histogram, percentilband och små multiplar.
    const e2 = await page.evaluate(() => ({ hist: document.querySelectorAll('#chart-kon-histogram rect[data-marke="stapel"]').length,
        band: document.querySelectorAll('#chart-demo-spread [data-marke="band"]').length, paneler: document.querySelectorAll('#chart-kon-multiplar svg[data-del="panel"]').length,
        minst: Math.min(...((document.getElementById('chart-demo-spread')._figur || { lager: [0, 0, { data: [{ r: { n: 0 } }] }] }).lager[2].data.map(d => d.r.n))) }));
    ok(e2.hist >= 6, `Ålder & karriär ritar histogrammet med kön mot kön (${e2.hist} staplar)`);
    ok(e2.band >= 2 && e2.minst >= 1, `Ålder & karriär ritar lönespridningen över ålder som percentilband (skärmen maskerar inget, ADR-51; minst ${e2.minst} personer i varje åldersgrupp)`);
    ok(e2.paneler >= 2, `Ålder & karriär ritar lön mot ålder i små multiplar (${e2.paneler} paneler)`);
    if (BILDER) for (const id of ['chart-kon-histogram', 'chart-demo-spread', 'chart-kon-multiplar']) { await page.locator('#' + id).scrollIntoViewIfNeeded(); await page.locator('#' + id).screenshot({ path: `${BILDER}/${id}-${NAMN}.png` }); }
    await page.click('.nav-item[data-tab="struktur"]');
    await page.evaluate(() => document.querySelectorAll('details.avsnitt').forEach(d => { d.open = true; }));
    await page.waitForTimeout(600);
    const kvart = await page.evaluate(() => { const el = document.getElementById('chart-struktur-kvartiler'); return { staplar: el ? el.querySelectorAll('rect[data-marke="stapel"]').length : 0, linje: el ? el.querySelectorAll('[data-marke="referenslinje"]').length : 0 }; });
    ok(kvart.staplar === 8 && kvart.linje === 1, `Struktur ritar lönekvartilerna (${kvart.staplar} segment, linje vid organisationens andel kvinnor)`);
    if (BILDER) await page.locator('#chart-struktur-kvartiler').screenshot({ path: `${BILDER}/kvartiler-${NAMN}.png` });
    const trad = await page.evaluate(() => { const el = document.getElementById('chart-struktur-tradkarta'); const r = [...el.querySelectorAll('rect[data-marke="yta"][data-l="1"]')].map(e => e.getBoundingClientRect());
        let overlapp = 0; for (let i = 0; i < r.length; i++) for (let j = i + 1; j < r.length; j++) if (r[i].left < r[j].right - 1 && r[j].left < r[i].right - 1 && r[i].top < r[j].bottom - 1 && r[j].top < r[i].bottom - 1) overlapp++;
        return { ytor: r.length, overlapp, etiketter: el.querySelectorAll('text[data-marke="ytetikett"]').length, axel: el.querySelectorAll('[data-axel]').length }; });
    ok(trad.ytor >= 4 && trad.overlapp === 0 && trad.etiketter > 0 && trad.axel === 0, `Struktur ritar organisationen som trädkarta (${trad.ytor} ytor, inga överlapp)`);
    if (BILDER) { await page.locator('#chart-struktur-tradkarta').scrollIntoViewIfNeeded(); await page.locator('#chart-struktur-tradkarta').screenshot({ path: `${BILDER}/tradkarta-${NAMN}.png` }); }
    await page.click('.nav-item[data-tab="likvardighet"]');
    await page.evaluate(() => document.querySelectorAll('details.avsnitt').forEach(d => { d.open = true; }));
    await page.waitForTimeout(900);
    const krav = await page.evaluate(() => { const el = document.getElementById('chart-likvardighet-krav'); return { punkter: el ? el.querySelectorAll('[data-marke="punkt"]').length : 0, linje: el ? el.querySelectorAll('path[data-marke="linje"]').length : 0, not: (document.getElementById('lv-krav-not') || {}).textContent || '' }; });
    ok(krav.punkter >= 3 && krav.linje === 1 && /minst \d+ personer/.test(krav.not), `Likvärdigt arbete ritar krav mot lön (${krav.punkter} yrkesgrupper)`);
    if (BILDER) await page.locator('#chart-likvardighet-krav').screenshot({ path: `${BILDER}/krav-${NAMN}.png` });
}

console.log('\n── Diagramkärnan: ritning och export (ADR-39) ──');
// Diagramkärnan ritar och exporterar i en riktig webbläsare, från file:// med CSP:n påslagen. Figuren har en
// liten grupp (`liten`) med iögonfallande namn och värde: den får inte finnas i någon export. Exporten går den
// riktiga vägen — exportmenyns knappar och nedladdade filer — och PNG-vägen (SVG → bild → canvas) prövas dessutom
// bildpunkt för bildpunkt i sidan.
/* global ritaFigur, rensaFigur, figurTillBild, figurTillSvg -- funktionerna nedan körs i sidan, där de finns */
{
    // Inget bibliotek skapar en <style>: sidan har bara sin egen stilmall.
    const stilmallar = await page.evaluate(() => document.querySelectorAll('style').length);
    ok(stilmallar === 1, `sidan har bara sin egen stilmall (${stilmallar})`);
    const tmp = mkdtempSync(join(tmpdir(), 'lonekartlaggning-rok-'));
    const karna = await page.evaluate(async () => {
        const figur = {
            beskrivning: 'Röktest av diagramkärnan',
            x: { skala: 'band', titel: 'BAS' }, y: { skala: 'linjar', titel: 'Kronor/månad', format: 'kr' },
            lager: [
                { marke: 'stapel', serie: 'Kvinna', tips: d => [['Medianlön', `${d.y} kr`]], data: [{ x: 'A', y: 30000 }, { x: 'LITENGRUPP', y: 77777, liten: true, etikett: '77 777 kr' }, { x: 'B', y: 41000 }] },
                { marke: 'linje', serie: 'Referens', data: [{ x: 'A', y: 32000 }, { x: 'B', y: 39000 }] },
                { marke: 'stapel', serie: 'BARASMÅ', data: [{ x: 'A', y: 66666, liten: true }] },
            ],
        };
        window.__rokFigur = figur;
        const kort = document.createElement('div');
        kort.className = 'card';
        kort.id = 'roktest-kort';
        kort.style.width = '640px';
        const h = document.createElement('h3');
        h.textContent = 'Röktest av diagramkärnan';
        const el = document.createElement('div');
        el.id = 'chart-roktest';
        kort.append(h, el);
        document.body.appendChild(kort);
        ritaFigur(el, figur);
        const marken = el.querySelectorAll('[data-marke]').length;
        const skarmtext = el.textContent;
        // PNG i begärd storlek, läst tillbaka som bild och granskad bildpunkt för bildpunkt.
        const png = await figurTillBild(figur, 'png', 800, 450);
        const bild = new Image();
        await new Promise((ok, fel) => { bild.onload = ok; bild.onerror = () => fel(new Error('png gick inte att läsa')); bild.src = png; });
        const duk = document.createElement('canvas');
        duk.width = 800; duk.height = 450;
        const yta = duk.getContext('2d');
        yta.drawImage(bild, 0, 0);
        const px = yta.getImageData(0, 0, 800, 450).data;
        let fargade = 0, bla = 0;
        for (let i = 0; i < px.length; i += 4) {
            if (px[i] < 250 || px[i + 1] < 250 || px[i + 2] < 250) fargade++;
            if (px[i] < 80 && px[i + 2] > 180) bla++;                    // staplarnas färg (seriens blå)
        }
        const stor = await figurTillBild(figur, 'png', 1920, 1080);
        const storBild = new Image();
        await new Promise((ok, fel) => { storBild.onload = ok; storBild.onerror = () => fel(new Error('stor png gick inte att läsa')); storBild.src = stor; });
        const svg = await figurTillBild(figur, 'svg', 800, 450);
        return { marken, skarmtext, start: png.slice(0, 22), bredd: bild.naturalWidth, hojd: bild.naturalHeight, fargade, bla,
            storBredd: storBild.naturalWidth, storHojd: storBild.naturalHeight, svg: svg.slice(0, 19),
            svgText: figurTillSvg(figur, 1600, 900), medSma: figurTillSvg(figur, 1600, 900, { visaSma: true }) };
    });
    ok(karna.marken >= 3, `ritaFigur ritade märken i sidan (${karna.marken})`);
    ok(!/LITENGRUPP|BARASMÅ|77.?777|66.?666/.test(karna.skarmtext), 'den lilla gruppen ritas inte på skärmen');
    ok(karna.start === 'data:image/png;base64,', `PNG-exporten ger en PNG (${karna.start})`);
    ok(karna.bredd === 800 && karna.hojd === 450, `PNG har begärd storlek (${karna.bredd} × ${karna.hojd})`);
    ok(karna.storBredd === 1920 && karna.storHojd === 1080, `PNG i presentationsstorlek (${karna.storBredd} × ${karna.storHojd})`);
    ok(karna.fargade > 500 && karna.bla > 500, `PNG-bilden är inte tom (${karna.fargade} färgade bildpunkter, ${karna.bla} i stapelfärgen)`);
    ok(karna.svg === 'data:image/svg+xml;', 'SVG-exporten ger en SVG');
    // Namnen söks i hela SVG-texten (också attribut); värdena i den text som visas — koordinater som 86.666… är inga löner.
    const svgBarSma = t => /LITENGRUPP|BARASMÅ/.test(t) || /77.?777|66.?666/.test(t.replace(/<[^>]*>/g, '\n'));
    ok(svgBarSma(karna.medSma) && !svgBarSma(karna.svgText), 'den exporterade SVG:n bär inget av den lilla gruppen (namn, serie, värde)');

    // Verktygstipset med riktiga pekarhändelser; Escape döljer och TÖMMER portalen.
    await page.evaluate(() => document.getElementById('roktest-kort').scrollIntoView());
    await page.hover('#chart-roktest [data-marke="stapel"]');
    await page.waitForTimeout(150);
    ok(await page.evaluate(() => { const t = document.querySelector('.chart-tip-portal'); return !!t && t.classList.contains('visible') && /Medianlön/.test(t.textContent); }),
        'verktygstipset visas vid pekaren');
    await page.keyboard.press('Escape');
    ok(await page.evaluate(() => { const t = document.querySelector('.chart-tip-portal'); return !t.classList.contains('visible') && t.textContent === ''; }),
        'Escape döljer och tömmer verktygstipset');

    // Exportmenyn: de riktiga knapparna och de nedladdade filerna.
    const ladda = async val => {
        await page.evaluate(() => document.getElementById('roktest-kort').querySelector('.chart-export-btn').click());
        const [nedladdning] = await Promise.all([
            page.waitForEvent('download', { timeout: 10000 }),
            page.evaluate(v => document.getElementById('roktest-kort').querySelector(`[data-chart-export="${v}"]`).click(), val)
        ]);
        const fil = join(tmp, nedladdning.suggestedFilename());
        await nedladdning.saveAs(fil);
        return { namn: nedladdning.suggestedFilename(), fil, bytes: readFileSync(fil) };
    };
    const hemligt = /LITENGRUPP|BARASMÅ|77.?777|66.?666/;
    for (const [val, b, h] of [['png-dokument', 1600, 900], ['png-presentation', 1920, 1080]]) {
        const png = await ladda(val);
        const arPng = png.bytes.subarray(0, 8).toString('hex') === '89504e470d0a1a0a';
        const [pb, ph] = arPng ? [png.bytes.readUInt32BE(16), png.bytes.readUInt32BE(20)] : [0, 0];
        ok(arPng && pb === b && ph === h && png.bytes.length > 5000, `menyn: ${val} gav ${png.namn} (${pb} × ${ph}, ${png.bytes.length} byte)`);
        ok(!hemligt.test(png.namn), `filnamnet bär inget av den lilla gruppen (${val})`);
        if (BILDER) { mkdirSync(BILDER, { recursive: true }); writeFileSync(join(BILDER, `${NAMN}-${val}.png`), png.bytes); }
    }
    const svgFil = await ladda('svg');
    const svgText = svgFil.bytes.toString('utf8');
    ok(svgText.startsWith('<svg xmlns="http://www.w3.org/2000/svg"') && /width="1600"/.test(svgText) && /viewBox="0 0 800 450"/.test(svgText),
        `menyn: SVG gav ${svgFil.namn} (1600 × 900, viewBox 800 × 450)`);
    ok(!svgBarSma(svgText) && !/ data-[li]=|<script|href|url\(|\son[a-z]+=/.test(svgText), 'den nedladdade SVG:n bär inget av den lilla gruppen, inga index, inga skript eller yttre referenser');
    if (BILDER) writeFileSync(join(BILDER, `${NAMN}-export.svg`), svgFil.bytes);
    // Den nedladdade SVG:n öppnas för sig själv, som ett eget dokument (utan sidans stilmall och CSP).
    {
        const egen = await browser.newPage({ viewport: { width: 1600, height: 900 } });
        const egnaFel = [];
        egen.on('pageerror', e => egnaFel.push(String(e)));
        egen.on('console', m => { if (m.type() === 'error') egnaFel.push(m.text()); });
        await egen.goto('file://' + svgFil.fil);
        const d = await egen.evaluate(() => {
            const rot = document.documentElement;
            const rut = e => { const r = e.getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height)]; };
            const staplar = [...document.querySelectorAll('[data-marke="stapel"]')];
            return { tagg: rot.tagName, ns: rot.namespaceURI, fel: document.getElementsByTagName('parsererror').length,
                storlek: rut(rot), staplar: staplar.map(rut), fyllning: staplar.map(s => getComputedStyle(s).fill),
                texter: [...document.querySelectorAll('text')].map(t => t.textContent) };
        });
        ok(d.tagg === 'svg' && d.ns === 'http://www.w3.org/2000/svg' && d.fel === 0 && egnaFel.length === 0, `SVG:n öppnas som eget dokument utan fel${egnaFel.length ? ': ' + egnaFel[0] : ''}`);
        ok(d.storlek[0] === 1600 && d.storlek[1] === 900, `fristående SVG ritas i 1600 × 900 (${d.storlek.join(' × ')})`);
        ok(d.staplar.length === 2 && d.staplar.every(([b, h]) => b > 50 && h > 50) && d.fyllning.every(f => /rgb\(42, 120, 214\)/.test(f)),
            `staplarna ritas i den fristående SVG:n, dubbelt så stora som i den logiska bilden (${d.staplar.map(r => r.join('×')).join(', ')})`);
        ok(d.texter.includes('BAS') && d.texter.includes('Kronor/månad') && d.texter.includes('Kvinna') && !d.texter.some(t => hemligt.test(t)), 'axeltitlar och förklaring står i den fristående SVG:n, utan den lilla gruppen');
        if (BILDER) await egen.screenshot({ path: join(BILDER, `${NAMN}-svg-fristaende.png`) });
        await egen.close();
    }
    const csv = (await ladda('data-csv')).bytes.toString('utf8');
    ok(/Röktest av diagramkärnan — Lönekartläggning .*Minsta gruppstorlek för redovisning: 10\./.test(csv) && /Serie;BAS;Kronor\/månad/.test(csv)
        && /Kvinna;A;30000/.test(csv) && /Kvinna;B;41000/.test(csv) && /Referens;B;39000/.test(csv), 'menyn: diagramdata (CSV) har spårbarhetsrad, rubrik och rader');
    ok(!hemligt.test(csv), 'diagramdatan bär inget av den lilla gruppen');
    if (KAN_LASA_URKLIPP) {
        await page.evaluate(() => document.getElementById('roktest-kort').querySelector('.chart-export-btn').click());
        await page.evaluate(() => document.getElementById('roktest-kort').querySelector('[data-chart-export="data-kopiera"]').click());
        await page.waitForTimeout(300);
        const urklipp = await page.evaluate(() => navigator.clipboard.readText().catch(e => 'fel: ' + e.message));
        ok(/Kvinna\tA\t30000/.test(urklipp) && !hemligt.test(urklipp), 'menyn: Kopiera diagramdata lägger tabellen på urklipp, utan den lilla gruppen');
    } else console.log(`  – urklippets innehåll läses bara i Chromium (${NAMN})`);

    // Tomt läge (bara små grupper) och rensad behållare: menyn säger att inget finns att exportera, ingen fil laddas ner.
    const ingenFil = async vad => {
        let nedladdat = false;
        const lyssna = () => { nedladdat = true; };
        page.on('download', lyssna);
        await page.evaluate(() => document.getElementById('roktest-kort').querySelector('.chart-export-btn').click());
        await page.evaluate(() => document.getElementById('roktest-kort').querySelector('[data-chart-export="svg"]').click());
        await page.waitForTimeout(400);
        page.off('download', lyssna);
        const fel = await page.evaluate(() => { const p = document.getElementById('roktest-kort').querySelector('.chart-export-fel'); return p.hidden ? '' : p.textContent; });
        ok(!nedladdat && /inget att exportera/.test(fel), `${vad}: ingen fil laddas ner, menyn säger varför`);
        await page.keyboard.press('Escape');
    };
    await page.evaluate(() => ritaFigur('chart-roktest', { ...window.__rokFigur, lager: [window.__rokFigur.lager[2]] }));
    ok(await page.evaluate(() => !!document.querySelector('#chart-roktest [data-rf="tom"]') && !document.querySelector('#chart-roktest svg')), 'bara små grupper: tomt läge, inget ritas');
    await ingenFil('tomt läge');
    await page.evaluate(() => rensaFigur('chart-roktest'));
    await ingenFil('rensad behållare');
    await page.evaluate(() => { document.getElementById('roktest-kort').remove(); delete window.__rokFigur; });
    rmSync(tmp, { recursive: true, force: true });
}

console.log('\n── Word-utkast (.docx) ──');
/* global JSZip -- används i page.evaluate, där JSZip finns i sidan */
await page.click('.nav-item[data-tab="dokumentera"]');
await page.evaluate(() => document.querySelectorAll('details.avsnitt').forEach(d => { d.open = true; }));
await page.waitForTimeout(300);
const [wordFil] = await Promise.all([
    page.waitForEvent('download', { timeout: 15000 }),
    page.evaluate(() => document.getElementById('btn-export-docdraft').click()),
]);
ok(/^Lonekartlaggning_\d{4}_dokumentation_UTKAST_DEMODATA_\d{4}-\d{2}-\d{2}\.docx$/.test(wordFil.suggestedFilename()), `Word-utkastet heter ${wordFil.suggestedFilename()}`);
const wordBytes = await new Promise((res, rej) => { const bitar = []; wordFil.createReadStream().then(s => { s.on('data', b => bitar.push(b)); s.on('end', () => res(Buffer.concat(bitar))); s.on('error', rej); }, rej); });
ok(await page.evaluate(async b64 => {
    const z = await JSZip.loadAsync(b64, { base64: true });
    const xml = await z.file('word/document.xml').async('string');
    return new DOMParser().parseFromString(xml, 'application/xml').getElementsByTagName('parsererror').length === 0 && xml.includes('Heading1');
}, wordBytes.toString('base64')), 'Word-utkastets document.xml är välformad och har rubrikstilar');
// Word-utkastet ritas ur rapportmodellen, med diagrammen som bilder och lönegapet som kvinnors lön i procent av mäns.
{
    const w = await page.evaluate(async b64 => {
        const z = await JSZip.loadAsync(b64, { base64: true });
        const xml = await z.file('word/document.xml').async('string'), rel = await z.file('word/_rels/document.xml.rels').async('string'), typer = await z.file('[Content_Types].xml').async('string');
        const bilder = Object.keys(z.files).filter(n => /^word\/media\/bild\d+\.png$/.test(n)).sort();
        const png = [];
        for (const n of bilder) { const u = await z.file(n).async('uint8array'); png.push({ n, byte: u.length, signatur: u[0] === 0x89 && u[1] === 0x50 && u[2] === 0x4e && u[3] === 0x47 }); }
        const text = new DOMParser().parseFromString(xml, 'application/xml').documentElement.textContent;
        return { png, ritningar: (xml.match(/<w:drawing>/g) || []).length, relationer: (rel.match(/relationships\/image"/g) || []).length, pngTyp: typer.includes('Extension="png"'),
            form: /Kvinnors medianlön i procent av mäns\d{2,3},\d %/.test(text), misslyckad: /bilden kunde inte skapas/.test(text),
            bildtexter: ['Könsfördelning per BAS-intervall', 'Kvinnor och män per lönekvartil', 'Oförklarat lönegap per BAS-intervall'].every(t => text.includes(t)) };
    }, wordBytes.toString('base64'));
    ok(w.png.length >= 4 && w.png.every(b => b.signatur && b.byte > 4000) && w.ritningar === w.png.length && w.relationer === w.png.length && w.pngTyp && !w.misslyckad,
        `Word-utkastet har diagrammen som bilder (${w.png.length} PNG, ${w.png.map(b => Math.round(b.byte / 1024) + ' kB').join(', ')}), var och en med relation och ritning`);
    ok(w.bildtexter, 'varje bild har sin bildtext');
    ok(w.form, 'lönegapet står som kvinnors lön i procent av mäns');
    if (BILDER) writeFileSync(join(BILDER, 'word-utkast.docx'), wordBytes);
}

console.log('\n── Tal står på en rad ──');
{
    // Ett tal med sin enhet får inte brytas («−4,4» på en rad och «%» på nästa). Raderna räknas ur textens rutor.
    const rader = sel => page.evaluate(sel => [...document.querySelectorAll(sel)].filter(el => el.getBoundingClientRect().height > 0).map(el => {
        const r = document.createRange(); r.selectNodeContents(el);
        return { text: el.textContent.trim(), rader: new Set([...r.getClientRects()].filter(q => q.width > 0).map(q => Math.round(q.top))).size };
    }), sel);
    for (const bredd of [1440, 1100]) {
        await page.setViewportSize({ width: bredd, height: 900 });
        await page.click('.nav-item[data-tab="matrix"]');
        await page.evaluate(() => document.querySelectorAll('.view-panel details.avsnitt').forEach(d => { d.open = true; }));
        await page.waitForTimeout(300);
        const hero = await rader('.reg-hero .hero-number');
        ok(hero.length > 0 && hero.every(h => h.rader === 1), `${bredd} punkter: regressionskortets tal står på en rad (${hero.map(h => h.text).join(', ')})`);
        await page.click('.nav-item[data-tab="prioritering"]');
        await page.evaluate(() => document.querySelectorAll('.view-panel details.avsnitt').forEach(d => { d.open = true; }));
        await page.waitForTimeout(300);
        const celler = await rader('#prio-table .cell-bar-value');
        const brutna = celler.filter(c => c.rader !== 1);
        ok(celler.length > 0 && !brutna.length, `${bredd} punkter: Prioriteringens ${celler.length} procenttal står på en rad${brutna.length ? ' — brutna: ' + brutna.slice(0, 3).map(c => c.text).join(', ') : ''}`);
    }
    await page.setViewportSize({ width: 1400, height: 1000 });
}

console.log('\n── Noten om små grupper klipps inte i en bred tabell ──');
{
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.click('.nav-item[data-tab="utforska"]');
    await page.waitForTimeout(400);
    const n = await page.evaluate(() => {
        const noter = [...document.querySelectorAll('#rapport-table td > .k-mask-note')].filter(p => p.getBoundingClientRect().height > 0);
        const kort = document.getElementById('rapport-table').closest('.table-container').getBoundingClientRect();
        return { antal: noter.length, utanfor: noter.filter(p => { const r = p.getBoundingClientRect(); return r.right > kort.right + 1 || r.left < kort.left - 1; }).length,
            bredare: document.getElementById('rapport-table').scrollWidth > Math.ceil(kort.width),
            ikon: noter[0] ? getComputedStyle(noter[0], '::before').content : '' };
    });
    ok(n.antal === 0, `Löneöversikten på skärmen har inga noter om små grupper (skärmen maskerar inget, ADR-51; ${n.antal} noter)`);
    await page.setViewportSize({ width: 1400, height: 1000 });
}

console.log('\n── Handlingsplanen: inga tomma rader på skärmen ──');
{
    await page.click('.nav-item[data-tab="handlingsplan"]');
    await page.waitForTimeout(200);
    const hojd = () => page.evaluate(() => [...document.querySelectorAll('#handlingsplan-tbody tr.handlingsplan-empty')].map(tr => tr.getBoundingClientRect().height));
    const skarm = await hojd();
    ok(skarm.length >= 5 && skarm.every(h => h === 0), `de ${skarm.length} tomma raderna ritas inte på skärmen`);
    await page.emulateMedia({ media: 'print' });
    ok((await hojd()).every(h => h > 0), 'på utskriften finns raderna att fylla i');
    await page.emulateMedia({ media: 'screen' });
}

console.log('\n── Sidhuvudet är lika högt på alla flikar ──');
{
    for (const bredd of [1440, 1100, 1024]) {
        await page.setViewportSize({ width: bredd, height: 900 });
        const hojder = {};
        for (const flik of ['dashboard', 'bestammelser', 'matrix', 'likvardighet', 'struktur', 'prioritering', 'loneoversyn', 'handlingsplan', 'dokumentera', 'kon', 'benchmark', 'utforska', 'info']) {
            await page.click(`.nav-item[data-tab="${flik}"]`);
            hojder[flik] = await page.evaluate(() => Math.round(document.querySelector('.top-header').getBoundingClientRect().height));
        }
        const olika = [...new Set(Object.values(hojder))];
        const bricka = await page.evaluate(() => { const b = document.getElementById('gdpr-banner'), r = document.createRange(); r.selectNodeContents(b);
            return { hojd: Math.round(b.getBoundingClientRect().height), under: b.getBoundingClientRect().top >= document.getElementById('page-title').getBoundingClientRect().bottom - 1 }; });
        ok(olika.length === 1, `${bredd} punkter: sidhuvudet är ${olika.join(' / ')} punkter högt på alla ${Object.keys(hojder).length} flikar`);
        ok(bricka.under && bricka.hojd < 34, `${bredd} punkter: statusbrickan står under rubriken på en rad (${bricka.hojd} punkter hög)`);
    }
    await page.setViewportSize({ width: 1400, height: 1000 });
}

console.log('\n── Nyckeltalens förklaring klipps inte ──');
{
    await page.setViewportSize({ width: 1440, height: 900 });
    const klippta = [];
    let antal = 0;
    for (const flik of ['dashboard', 'matrix', 'likvardighet', 'struktur', 'prioritering', 'loneoversyn', 'dokumentera', 'kon', 'benchmark']) {
        await page.click(`.nav-item[data-tab="${flik}"]`);
        await page.waitForTimeout(250);
        const r = await page.evaluate(() => [...document.querySelectorAll('.slutsats-under, .stat-under, .stat-tip')].filter(e => e.getBoundingClientRect().height > 0)
            .map(e => ({ text: e.textContent.trim(), klippt: e.scrollWidth > e.clientWidth + 1 || e.scrollHeight > e.clientHeight + 1, langd: e.textContent.trim().length })));
        antal += r.length;
        klippta.push(...r.filter(o => o.klippt).map(o => `${flik}: ${o.text.slice(0, 50)} (${o.langd} tecken)`));
    }
    ok(antal > 20 && !klippta.length, `1440 punkter: ingen av ${antal} förklaringar under nyckeltalen klipps${klippta.length ? ' — ' + klippta.slice(0, 4).join(' | ') : ''}`);
    await page.setViewportSize({ width: 1400, height: 1000 });
}

console.log('\n── Kontrast, modalens läge och nyckeltalsraden på surfplatta ──');
{
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.click('.nav-item[data-tab="dashboard"]');
    await page.waitForTimeout(300);
    // Kontrasten räknas ur de färger webbläsaren faktiskt ritar: textens färg mot närmaste ifyllda botten, med genomskinlighet inräknad.
    const kontrast = sel => page.evaluate(sel => {
        const tal = c => c.match(/[\d.]+/g).map(Number);
        const lum = ([r, g, b]) => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
        return [...document.querySelectorAll(sel)].filter(el => el.getBoundingClientRect().height > 0).map(el => {
            let bak = [255, 255, 255], genomskinlighet = 1;
            for (let e = el; e; e = e.parentElement) { genomskinlighet *= Number(getComputedStyle(e).opacity); }
            for (let e = el; e; e = e.parentElement) { const c = getComputedStyle(e).backgroundColor; if (c && !/rgba\(0, 0, 0, 0\)|transparent/.test(c)) { bak = tal(c); break; } }
            const text = tal(getComputedStyle(el).color).slice(0, 3).map((v, i) => v * genomskinlighet + bak[i] * (1 - genomskinlighet));
            const [x, y] = [lum(text), lum(bak)].sort((p, q) => q - p);
            return { text: el.textContent.trim().slice(0, 30), k: Math.round((x + 0.05) / (y + 0.05) * 100) / 100 };
        });
    }, sel);
    const lagst = async (sel, namn) => { const k = await kontrast(sel); const m = k.sort((a, b) => a.k - b.k)[0]; ok(k.length > 0 && m.k >= 4.5, `${namn}: lägsta kontrast ${m ? m.k : '–'}:1 (${k.length} element)`); };
    await lagst('.comp-label, .comp-value', 'statusraden på Översikt');
    await lagst('#btn-exit-demo', 'knappen Avsluta demo');
    await page.click('.nav-item[data-tab="utforska"]');
    await page.waitForTimeout(300);
    await lagst('#rapport-table thead th', 'Löneöversiktens tabellhuvud');
    await page.click('.nav-item[data-tab="likvardighet"]');
    await page.evaluate(() => document.querySelectorAll('.view-panel details.avsnitt').forEach(d => { d.open = true; }));
    await page.waitForTimeout(300);
    await lagst('.lv-hjalp, .lv-hjalp p, .lv-hjalp li, .lv-hjalp span, .lv-hjalp strong', 'hjälprutan i Likvärdigt arbete');
    // «Vad lagras?» öppnas mitt i fönstret, som Inställningar.
    await page.click('#btn-data-residency');
    await page.waitForTimeout(250);
    const m = await page.evaluate(() => { const r = document.querySelector('#data-residency-modal .glossary-panel').getBoundingClientRect(); return { mitt: Math.round(r.left + r.width / 2), topp: Math.round(r.top), bredd: innerWidth }; });
    ok(Math.abs(m.mitt - m.bredd / 2) <= 2 && m.topp > 20, `«Vad lagras?» är centrerad (mitt ${m.mitt} av ${m.bredd}, topp ${m.topp})`);
    await page.click('#data-residency-close');
    // 768 punkter: fyra nyckeltal bryts 2 + 2.
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.click('.nav-item[data-tab="matrix"]');
    await page.waitForTimeout(300);
    const rader = await page.evaluate(() => { const t = [...document.querySelectorAll('#la-slutsatser .slutsats')].map(k => Math.round(k.getBoundingClientRect().top)); return [...new Set(t)].map(y => t.filter(v => v === y).length); });
    ok(rader.join('+') === '2+2', `768 punkter: Lika arbetes fyra nyckeltal står ${rader.join(' + ')}`);
    await page.setViewportSize({ width: 1400, height: 1000 });
}

console.log('\n── Löneöversikten ryms i sitt kort ──');
{
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.click('.nav-item[data-tab="utforska"]');
    await page.waitForTimeout(400);
    const u = await page.evaluate(() => { const t = document.getElementById('rapport-table'), k = t.closest('.table-container');
        return { tabell: t.scrollWidth, kort: k.clientWidth, kolumner: [...t.querySelectorAll('thead th')].filter(th => th.getBoundingClientRect().width > 0).length,
            hopfallda: t.querySelectorAll('tr.group-header.collapsed').length, grupper: t.querySelectorAll('tr.group-header').length }; });
    ok(u.kolumner === 6 && u.tabell <= u.kort + 1, `1440 punkter utan jämförelsestatistik: ${u.kolumner} kolumner, tabellen ${u.tabell} punkter i ett kort på ${u.kort}`);
    ok(u.hopfallda === u.grupper - 1, `${u.hopfallda} av ${u.grupper} BAS-grupper är hopfällda från början`);
    await page.setViewportSize({ width: 1400, height: 1000 });
}

console.log('\n── Kandidatparens tabell bryter inga tal ──');
{
    for (const bredd of [1440, 1100]) {
        await page.setViewportSize({ width: bredd, height: 900 });
        await page.click('.nav-item[data-tab="likvardighet"]');
        await page.evaluate(() => document.querySelectorAll('.view-panel details.avsnitt').forEach(d => { d.open = true; }));
        await page.waitForTimeout(300);
        const brutna = await page.evaluate(() => [...document.querySelectorAll('#likvardighet-table td.t-hoger, #likvardighet-table .lv-ki, #likvardighet-table .lv-ki-marke')].map(el => {
            const r = document.createRange(); r.selectNodeContents(el);
            return { text: el.textContent.trim(), rader: new Set([...r.getClientRects()].filter(q => q.width > 0).map(q => Math.round(q.top))).size };
        }).filter(o => o.rader > 1).map(o => o.text)
            // Raden under yrkets namn bär ett märke med egen baslinje: den mäts på höjden.
            .concat([...document.querySelectorAll('#likvardighet-table .lv-under')].filter(el => el.getBoundingClientRect().height > 30).map(el => el.textContent.trim())));
        ok(!brutna.length, `${bredd} punkter: inget tal eller intervall i kandidatparens tabell bryts${brutna.length ? ' — ' + brutna.slice(0, 3).join(' | ') : ''}`);
    }
    await page.setViewportSize({ width: 1400, height: 1000 });
}

console.log('\n── Yrkesgruppstabellen i Lika arbete är låg ──');
{
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.click('.nav-item[data-tab="matrix"]');
    await page.evaluate(() => document.querySelectorAll('.view-panel details.avsnitt').forEach(d => { d.open = true; }));
    await page.waitForTimeout(300);
    const t = await page.evaluate(() => {
        const rader = [...document.querySelectorAll('#matrix-table tbody tr')].filter(tr => !tr.classList.contains('la-underrad') && tr.querySelector('.la-status'));
        return { antal: rader.length, hogst: Math.max(...rader.map(tr => Math.round(tr.getBoundingClientRect().height))),
            dolda: [...document.querySelectorAll('#matrix-table tr.la-underrad-ansvar')].every(tr => tr.getBoundingClientRect().height === 0),
            export: getComputedStyle(document.querySelector('#matrix-table .bara-export')).display };
    });
    ok(t.antal > 3 && t.hogst <= 64, `1440 punkter: de ${t.antal} yrkesraderna är högst ${t.hogst} punkter höga`);
    ok(t.dolda && t.export === 'none', 'ansvarsraderna är hopfällda, och exportens extra text visas inte på skärmen');
    await page.setViewportSize({ width: 1400, height: 1000 });
}

console.log('\n── Utskrift av den aktiva fliken (Ctrl+P) ──');
{
    await page.click('.nav-item[data-tab="matrix"]');
    await page.waitForTimeout(300);
    const stangda = await page.evaluate(() => [...document.querySelectorAll('#view-lika-yrken details.avsnitt, #view-skevhet details.avsnitt, #view-matrix details.avsnitt')].map(d => d.open));
    await page.evaluate(() => { document.querySelectorAll('.view-panel details.avsnitt').forEach(d => { d.open = false; }); window.dispatchEvent(new Event('beforeprint')); });
    await page.emulateMedia({ media: 'print' });
    const u = await page.evaluate(() => {
        const syns = el => { const r = el.getBoundingClientRect(); return r.height > 0 && getComputedStyle(el).visibility !== 'hidden'; };
        return {
            vy: syns(document.getElementById('view-lika-yrken')),
            tabeller: [...document.querySelectorAll('.view-panel table')].filter(syns).length,
            meny: getComputedStyle(document.querySelector('.sidebar')).display,
            rapport: getComputedStyle(document.getElementById('print-report')).display,
            utfallda: [...document.querySelectorAll('#view-lika-yrken details.avsnitt')].every(d => d.open),
        };
    });
    ok(u.vy && u.tabeller > 0, `fliken skrivs ut: vyn syns och ${u.tabeller} tabeller har höjd`);
    ok(u.meny === 'none' && u.rapport === 'none', 'menyn och PDF-rapportens behållare skrivs inte ut');
    ok(u.utfallda, 'avsnitten är utfällda i utskriften');
    await page.emulateMedia({ media: 'screen' });
    await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));
    ok(await page.evaluate(() => [...document.querySelectorAll('#view-lika-yrken details.avsnitt')].every(d => !d.open)), 'efter utskriften är avsnitten hopfällda igen');
    // PDF-rapporten: med body.print-mode syns bara rapporten.
    await page.evaluate(() => { document.body.classList.add('print-mode'); });
    await page.emulateMedia({ media: 'print' });
    // Vänta in stilarna: WebKit på en långsam maskin räknar om dem först en stund efter bytet till utskrift.
    ok(await page.waitForFunction(() => getComputedStyle(document.getElementById('print-report')).display === 'block'
        && getComputedStyle(document.getElementById('view-lika-yrken')).visibility === 'hidden', null, { timeout: 3000 }).then(() => true, () => false),
        'med PDF-knappen skrivs bara rapporten ut');
    await page.emulateMedia({ media: 'screen' });
    await page.evaluate(stangda => { document.body.classList.remove('print-mode');
        [...document.querySelectorAll('#view-lika-yrken details.avsnitt, #view-skevhet details.avsnitt, #view-matrix details.avsnitt')].forEach((d, i) => { d.open = stangda[i]; }); }, stangda);
}

console.log('\n── Gruppdossier (modal) ──');
await page.click('.nav-item[data-tab="prioritering"]');
await page.evaluate(() => document.querySelectorAll('details.avsnitt').forEach(d => { d.open = true; }));
await page.waitForTimeout(300);
const harDossierKnapp = await page.evaluate(() => !!document.querySelector('[data-open-dossier]'));
ok(harDossierKnapp, 'prioriteringsraderna har en dossier-knapp');
if (harDossierKnapp) {
    await page.evaluate(() => document.querySelector('[data-open-dossier]').click());
    await page.waitForTimeout(400);
    ok(await page.evaluate(() => document.getElementById('dossier-modal').style.display === 'flex'), 'modalen öppnas från tabellraden');
    ok(await page.evaluate(() => (document.getElementById('dossier-body').textContent || '').length > 100), 'modalen fylls med innehåll');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);
    ok(await page.evaluate(() => document.getElementById('dossier-modal').style.display === 'none'), 'Escape stänger modalen');
}

console.log('\n── Rapportunderlag (urklipp) ──');
await page.click('.nav-item[data-tab="dokumentera"]');
await page.evaluate(() => document.querySelectorAll('details.avsnitt').forEach(d => { d.open = true; }));
await page.waitForTimeout(300);
ok(await page.evaluate(() => (document.getElementById('rapportunderlag-innehall')?.textContent || '').includes('Sammanfattning')),
    'rapportunderlaget visar avsnittet Sammanfattning');
await page.click('[data-rapport-kopiera="sammanfattning"]');
await page.waitForTimeout(300);
if (KAN_LASA_URKLIPP) {
    const textTyper = await page.evaluate(async () => { try { const it = await navigator.clipboard.read(); return it.flatMap(i => i.types); } catch (e) { return ['fel: ' + e.message]; } });
    ok(textTyper.includes('text/html') && textTyper.includes('text/plain'), `Kopiera lägger HTML och text på urklipp (${textTyper.join(', ')})`);
} else console.log(`  – urklippets innehåll läses bara i Chromium (${NAMN}: knappen klickades)`);
await page.click('[data-rapport-diagram="chart-skevhet-overview"]');
await page.waitForFunction(() => /Kopierat som bild|laddades ner/.test(document.querySelector('[data-rapport-diagram="chart-skevhet-overview"]')?.parentElement?.textContent || ''), { timeout: 15000 });
if (KAN_LASA_URKLIPP) {
    const bildTyper = await page.evaluate(async () => { try { const it = await navigator.clipboard.read(); return it.flatMap(i => i.types); } catch (e) { return ['fel: ' + e.message]; } });
    ok(bildTyper.includes('image/png'), `Kopiera diagram lägger en PNG på urklipp (${bildTyper.join(', ')})`);
} else ok(true, 'Kopiera diagram: kopierat som bild eller nedladdat (reserven)');

console.log('\n── Minsta gruppstorlek för redovisning (ADR-38) ──');
// Sänkning under 10 kräver bekräftelse; varningen ligger utanför flikarna och ska synas överallt;
// att återställa tar bort den. Körs före lagringskontrollen: inget av detta får skrivas till lagring.
await page.click('.nav-item[data-tab="dashboard"]');
await page.evaluate(() => document.querySelectorAll('details.avsnitt').forEach(d => { d.open = true; }));
await page.waitForTimeout(300);
// Fältet ligger i inställningspanelen: värdet i Översikts filrad öppnar den med fokus i fältet.
await page.click('#ov-filrad [data-oppna-installningar]');
await page.waitForTimeout(300);
ok(await page.evaluate(() => document.activeElement.id === 'k-troskel' && document.getElementById('installningar-modal').style.display === 'flex'), 'värdet för minsta gruppstorlek i filraden öppnar inställningarna med fokus i fältet');
ok(await page.evaluate(() => { const p = document.querySelector('#installningar-modal .glossary-panel').getBoundingClientRect(); return p.width > 300 && p.right <= innerWidth && document.querySelectorAll('#inst-flikar .inst-flik').length === 5; }), 'panelen ryms i fönstret och listar flikarnas egna inställningar');
let bekraftelse = '';
page.once('dialog', d => { bekraftelse = d.message(); d.accept(); });
await page.fill('#k-troskel', '6');
await page.dispatchEvent('#k-troskel', 'change');
await page.waitForTimeout(500);
ok(/Sänka minsta gruppstorlek till 6/.test(bekraftelse), 'sänkning under 10 frågar först');
ok(/sänkt till 6 \(standard 10\)/.test(await page.textContent('#k-troskel-varning-text') || ''), 'varningen anger det sänkta värdet');
ok(!(await osynlig('#k-troskel-varning')), 'varningen syns efter sänkning');
// Medan flikarna räknas om efter en ändrad tröskel är inmatning spärrad (med avsikt): vänta in omräkningen.
await page.waitForFunction(() => !document.getElementById('omritning-ruta'), { timeout: 60000 });
await page.keyboard.press('Escape');
const stangd = await page.waitForFunction(() => document.getElementById('installningar-modal').style.display === 'none', { timeout: 5000 }).then(() => true, () => false);
ok(stangd, 'Escape stänger inställningarna');
await page.click('.nav-item[data-tab="prioritering"]');
await page.evaluate(() => document.querySelectorAll('details.avsnitt').forEach(d => { d.open = true; }));
await page.waitForTimeout(300);
ok(!(await osynlig('#k-troskel-varning')), 'varningen syns också på en annan flik');
await page.click('.nav-item[data-tab="dashboard"]');
await page.evaluate(() => document.querySelectorAll('details.avsnitt').forEach(d => { d.open = true; }));
await page.click('#k-troskel-varning-lank');
await page.waitForTimeout(300);
ok(await page.evaluate(() => document.activeElement.id === 'k-troskel'), 'länken i varningen öppnar inställningarna med fokus i fältet');
await page.click('#btn-k-aterstall');
await page.waitForTimeout(500);
ok(await osynlig('#k-troskel-varning'), 'varningen försvinner efter återställning');
ok(await page.inputValue('#k-troskel') === '10', 'fältet visar 10 efter återställning');
await page.click('#inst-flikar [data-inst-flik="prioritering"]');
await page.waitForTimeout(700);
ok(await page.evaluate(() => document.getElementById('installningar-modal').style.display === 'none' && document.getElementById('view-prioritering').style.display === 'block' && document.getElementById('avsnitt-pr-installningar').open
    && !!document.getElementById('prio-cfg-atgard').offsetParent), 'Öppna i panelen går till Prioritering, där trösklar och viktning står');

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

console.log('\n── Översikt efter inläsning ──');
{
    await page.evaluate(() => { document.querySelector('.nav-item[data-tab="dashboard"]').click(); scrollTo(0, 0); });
    await page.waitForTimeout(900);
    // Tidigare steg har visat filerna och fällt ut avsnitten: läget ställs tillbaka till det som gäller efter en inläsning.
    if (await page.evaluate(() => document.getElementById('btn-ov-filer').getAttribute('aria-expanded') === 'true')) await page.click('#btn-ov-filer');
    await page.evaluate(() => document.querySelectorAll('#view-dashboard details.avsnitt').forEach(a => { a.open = false; }));
    await page.waitForTimeout(300);
    const ov = await page.evaluate(() => { const g = id => document.getElementById(id); const syn = id => g(id).offsetParent !== null; const top = id => g(id).getBoundingClientRect().top;
        return { rad: syn('ov-filrad') && /Lönefil: \d+ personer/.test(g('ov-filrad').textContent), filer: syn('upload-row'),
            ordning: top('ov-filrad') < top('dashboard-summary') && top('dashboard-summary') < top('chart-ov-tradkarta') && top('chart-ov-tradkarta') < top('att-gora') && top('att-gora') < top('avsnitt-ov-process'),
            karta: !!document.querySelector('#chart-ov-tradkarta svg'), kvartiler: !!document.querySelector('#chart-ov-kvartiler svg'),
            oppna: [...document.querySelectorAll('#view-dashboard details.avsnitt')].filter(a => a.open).length, skarmar: document.documentElement.scrollHeight / innerHeight }; });
    ok(ov.rad && !ov.filer, 'filerna är en rad, och uppladdningskorten är undanfällda');
    ok(ov.ordning && ov.karta && ov.kvartiler, 'nyckeltalen, kartan och kvartilerna står före Att göra och avsnitten');
    ok(ov.oppna === 0 && ov.skarmar < 3.5, `avsnitten är hopfällda och sidan är ${ov.skarmar.toFixed(1)} skärmar`);
    await page.click('#btn-ov-filer');
    await page.waitForTimeout(300);
    ok(await page.evaluate(() => document.getElementById('upload-row').offsetParent !== null && document.getElementById('btn-ov-filer').getAttribute('aria-expanded') === 'true'), 'knappen i filraden visar uppladdningskorten igen');
    await page.click('#btn-ov-filer');
    await page.evaluate(() => { document.getElementById('avsnitt-ov-punkter').open = true; });
    await page.waitForTimeout(300);
    await page.click('#avsnitt-ov-punkter .act-cb');
    await page.waitForTimeout(400);
    ok(await page.evaluate(() => document.getElementById('avsnitt-ov-punkter').open && /^1 av \d+ hanterade$/.test(document.getElementById('nyckel-ov-punkter').textContent)), 'en avbockad punkt syns i avsnittets rubrik, och listan står kvar utfälld');
    await page.click('#avsnitt-ov-punkter .act-cb');
    await page.waitForTimeout(300);
}

console.log('\n── Förhandsbesked och urval ──');
{
    await page.evaluate(() => { document.querySelector('.nav-item[data-tab="dokumentera"]').click(); });
    await page.waitForTimeout(1200);
    await page.evaluate(() => { sattRapportUrval('hela'); renderExportBesked(); document.getElementById('avsnitt-ex-urval').open = true; });
    const fore = await page.evaluate(() => ({ word: document.getElementById('besked-word').textContent, excel: document.getElementById('besked-excel').textContent, zip: document.getElementById('besked-zip').textContent,
        rader: document.querySelectorAll('#rapport-urval .urval-rad').length, syns: document.getElementById('besked-word').offsetParent !== null }));
    ok(fore.syns && /Hela dokumentationen · 12 avsnitt · \d+ tabeller · 9 diagram/.test(fore.word) && /Utelämnar:/.test(fore.word), `Word-raden säger vad filen innehåller och utelämnar (${fore.word.slice(0, 90)}…)`);
    ok(/\d+ blad — Löneöversikt/.test(fore.excel) && /Word-utkastet, Excel-filen \(\d+ blad\) och diagrammen i alla flikar/.test(fore.zip) && fore.rader === 12, 'Excel-raden listar bladen, ZIP-raden säger vad filen bär, och urvalet har tolv avsnitt');
    await page.click('[data-urval-fast="ledning"]');
    await page.waitForTimeout(300);
    ok(await page.evaluate(() => /Ledningsbrief · 4 avsnitt/.test(document.getElementById('besked-word').textContent) && document.getElementById('nyckel-ex-urval').textContent === 'Ledningsbrief'), 'ett färdigt urval ändrar beskedet och avsnittets rubrik');
    const [fil] = await Promise.all([page.waitForEvent('download', { timeout: 20000 }), page.evaluate(() => document.getElementById('btn-export-docdraft').click())]);
    const byte = await new Promise((res, rej) => { const bitar = []; fil.createReadStream().then(s => { s.on('data', b => bitar.push(b)); s.on('end', () => res(Buffer.concat(bitar))); s.on('error', rej); }, rej); });
    const inne = await page.evaluate(async b64 => { const z = await JSZip.loadAsync(b64, { base64: true }); const t = new DOMParser().parseFromString(await z.file('word/document.xml').async('string'), 'application/xml').documentElement.textContent;
        return { atgarder: t.includes('4. Åtgärder och tidsplan'), samverkan: t.includes('Samverkan med arbetstagarna'), bilder: Object.keys(z.files).filter(n => n.startsWith('word/media/')).length }; }, byte.toString('base64'));
    ok(inne.atgarder && !inne.samverkan && inne.bilder >= 1, `Word-filen följer urvalet: fyra avsnitt, numrerade om, med avsnittens diagram (${inne.bilder} bilder)`);
    await page.evaluate(() => { sattRapportUrval('hela'); renderExportBesked(); });
}

console.log('\n── PDF-rapporten ur rapportmodellen ──');
{
    // Utskriftsdialogen öppnas inte i testet: window.print ersätts, och det som skulle skrivas ut läses ur sidan.
    const skriv = async urval => page.evaluate(async u => { window.print = () => {}; sattRapportUrval(u); await buildPrintReport(); await new Promise(r => setTimeout(r, 1300));
        const el = document.getElementById('print-report'), modell = rapportModell().avsnitt;
        return { avsnitt: [...el.querySelectorAll('section.rm-avsnitt')].map(s => s.dataset.rmAvsnitt).join(','), modell: modell.map(a => a.id).join(','),
            bilder: [...el.querySelectorAll('figure.rm-bild img')].filter(i => /^data:image\/png/.test(i.src) && i.alt.length > 10).length, diagram: modell.flatMap(a => a.delar.filter(p => p.typ === 'diagram')).length,
            bilagor: /Bilagor: tabeller och diagram ur flikarna/.test(el.textContent), last: /Låst kopia/.test(el.textContent), dekomponering: /Sekventiell dekomponering/.test(el.textContent),
            stampel: !!el.querySelector('.k-stampel'), valjare: !!document.getElementById('pdf-template'), utskriftslage: document.body.classList.contains('print-mode') }; }, urval);
    const hela = await skriv('hela');
    ok(hela.avsnitt === hela.modell && hela.last && !hela.valjare, 'utskriften har samma avsnitt i samma ordning som Word-utkastet, och väljaren för mallar är borta');
    ok(hela.bilder === hela.diagram && hela.bilder >= 4, `avsnittens diagram är bilder i utskriften (${hela.bilder} av ${hela.diagram})`);
    ok(hela.bilagor && hela.dekomponering && !hela.stampel, 'hela dokumentationen har bilagorna, det justerade lönegapet i detalj och tröskeln i metodbilagan');
    const ledning = await skriv('ledning');
    ok(ledning.avsnitt === 'sammanfattning,lika,likvardigt,atgarder' && !ledning.bilagor && ledning.stampel, 'ledningsbriefen är fyra avsnitt utan bilagor, med tröskeln som egen rad sist');
    await page.evaluate(() => { sattRapportUrval('hela'); document.getElementById('print-report').innerHTML = ''; document.body.classList.remove('print-mode'); });
}

console.log('\n── ZIP-filen och de små exporterna ──');
{
    await page.evaluate(() => { document.querySelector('.nav-item[data-tab="dokumentera"]').click(); sattRapportUrval('hela'); });
    await page.waitForTimeout(800);
    const [fil] = await Promise.all([page.waitForEvent('download', { timeout: 90000 }), page.evaluate(() => document.getElementById('btn-export-zip').click())]);
    const byte = await new Promise((res, rej) => { const bitar = []; fil.createReadStream().then(s => { s.on('data', b => bitar.push(b)); s.on('end', () => res(Buffer.concat(bitar))); s.on('error', rej); }, rej); });
    const z = await page.evaluate(async b64 => { const zip = await JSZip.loadAsync(b64, { base64: true }); const namn = Object.keys(zip.files).filter(n => !zip.files[n].dir);
        const word = namn.find(n => /\.docx$/.test(n)), excel = namn.find(n => /\.xlsx$/.test(n)), bilder = namn.filter(n => /^diagram\/.+\.png$/.test(n));
        const wz = word ? await JSZip.loadAsync(await zip.file(word).async('uint8array')) : null;
        const wb = excel ? XLSX.read(await zip.file(excel).async('uint8array'), { type: 'array' }) : null;
        const flikar = new Set(bilder.map(n => { const el = document.getElementById(n.slice(8, -4)); const p = el && el.closest('.view-panel'); return p ? p.id : '?'; }));
        return { word, excel, bilder: bilder.length, wordBilder: wz ? Object.keys(wz.files).filter(n => n.startsWith('word/media/')).length : 0, blad: wb ? wb.SheetNames : [], besked: excelAlltBlad(), flikar: [...flikar],
            granska: bilder.some(n => /pag|granska/.test(n)), overlapp: document.getElementById('loading-overlay').style.display }; }, byte.toString('base64'));
    ok(fil.suggestedFilename() === 'lonekartlaggning_export.zip' && !!z.word && z.wordBilder >= 4, `ZIP-filen bär Word-utkastet med sina bilder (${z.word}, ${z.wordBilder} bilder)`);
    ok(z.excel === 'lonekartlaggning_komplett.xlsx' && JSON.stringify(z.blad) === JSON.stringify(z.besked), `ZIP-filen bär Excel-filen med alla flikar (${z.blad.length} blad, samma som förhandsbeskedet: ${z.blad.join(",")} | ${z.besked.join(",")})`);
    ok(z.bilder >= 15 && z.flikar.length >= 5 && !z.granska, `ZIP-filen bär diagrammen i alla flikar, också de som inte öppnats (${z.bilder} bilder ur ${z.flikar.length} paneler), utom Personer att granska`);
    ok(z.overlapp === 'none', 'väntrutan är borta när filen är klar');
    await page.evaluate(() => document.querySelector('.nav-item[data-tab="struktur"]').click());
    await page.waitForTimeout(900);
    await page.evaluate(() => { document.getElementById('avsnitt-st-eu').open = true; });
    const eu = await page.evaluate(() => document.getElementById('struktur-eu').textContent.replace(/\s+/g, ' '));
    ok(/Kvinnors medianlön i procent av mäns\s*\d+,\d %\s*Lönegap enligt direktivet: \d+,\d %/.test(eu) && !/\(skillnad\)/.test(eu), 'direktivets mått står som kvinnors lön i procent av mäns, med direktivets lönegap som positivt tal under');
}

console.log('\n── Sök och hoppa ──');
{
    await page.evaluate(() => { document.querySelector('.nav-item[data-tab="matrix"]').click(); scrollTo(0, 0); if (typeof sattDiagramMarkering === 'function') sattDiagramMarkering(null); });
    await page.waitForTimeout(800);
    await page.evaluate(() => document.activeElement && document.activeElement.blur());
    await page.keyboard.press('/');
    ok(await page.evaluate(() => document.activeElement.id === 'sok-grupp'), 'snedstreck sätter fokus i sökfältet');
    await page.keyboard.type('under');
    await page.waitForTimeout(250);
    const lista = await page.evaluate(() => { const l = document.getElementById('sok-grupp-lista'), r = l.getBoundingClientRect();
        return { synlig: !l.hidden && r.height > 20, ryms: r.left >= 0 && r.right <= innerWidth, forsta: (l.querySelector('[role="option"] .sok-namn') || {}).textContent || '', ovanpa: document.elementFromPoint(r.left + 20, r.top + 14)?.closest('#sok-grupp-lista') != null }; });
    ok(lista.synlig && lista.ryms && lista.ovanpa && /Undersköterska/.test(lista.forsta), `listan med träffar visas över sidan (${lista.forsta})`);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(600);
    const m = await page.evaluate(() => ({ nyckel: diagramMarkering(), rad: (document.getElementById('markering-rad') || {}).textContent || '', framhavda: document.querySelectorAll('[data-markerad]').length, falt: document.getElementById('sok-grupp').value }));
    ok(m.nyckel && m.nyckel.length === 1 && /^grupp:/.test(m.nyckel[0]) && /Undersköterska/.test(m.rad) && /Öppna gruppdossier/.test(m.rad) && m.falt === '', `en vald träff markeras i alla diagram, med länk till gruppdossiern (${m.framhavda} märken framhävda i fliken)`);
    await page.click('#markering-rad button[data-markering="dossier"]');
    await page.waitForTimeout(500);
    ok(await page.evaluate(() => document.getElementById('dossier-modal').style.display === 'flex' && /Undersköterska/.test(document.getElementById('dossier-modal').textContent)), 'länken öppnar gruppdossiern för den sökta gruppen');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
    await page.evaluate(() => sattDiagramMarkering(null));
}

console.log('\n── Startsidan före inläsning, och de två lägena ──');
{
    // En egen sida utan data: Översikt ska vara en uppladdningssida, utan lägesdelarna.
    const tom = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await tom.goto('file://' + FIL);
    await tom.waitForTimeout(1200);
    const start = await tom.evaluate(() => { const syn = id => { const e = document.getElementById(id); return !!e && e.offsetParent !== null; };
        return { dolda: ['ov-filrad', 'ov-lage', 'ov-fordjupning', 'avsnitt-ov-kvalitet', 'avsnitt-ov-gap', 'sok-ruta'].filter(syn), uppladdning: syn('upload-row'), process: syn('avsnitt-ov-process') }; });
    ok(start.dolda.length === 0 && start.uppladdning && start.process, `före inläsning visas uppladdningen och processöversikten, inte lägesdelarna${start.dolda.length ? ' — syns: ' + start.dolda.join(', ') : ''}`);
    await tom.close();

    await page.evaluate(() => { document.querySelector('.nav-item[data-tab="matrix"]').click(); scrollTo(0, 0); });
    await page.waitForTimeout(800);
    const hojd = () => page.evaluate(() => ({ sida: document.documentElement.scrollHeight, intro: document.querySelector('#view-lika-yrken .flik-intro, #view-matrix .flik-intro, .view-panel[style*="block"] .flik-intro').getBoundingClientRect().height,
        lasMer: [...document.querySelectorAll('.flik-intro-mer')].filter(e => e.offsetParent).length,
        under: [...document.querySelectorAll('.avsnitt-under')].filter(e => e.offsetParent).length, noter: [...document.querySelectorAll('.k-mask-note, .reg-caveat-inline, .diagramkort-forklaring')].filter(e => e.offsetParent).length,
        oppna: [...document.querySelectorAll('details.avsnitt')].filter(a => a.open).map(a => a.id).join(',') }));
    const vagledande = await hojd();
    await page.click('#btn-open-installningar');
    await page.waitForTimeout(300);
    await page.click('#lage-kompakt');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);
    const kompakt = await hojd();
    ok(await page.evaluate(() => document.body.classList.contains('lage-kompakt') && document.getElementById('lage-kompakt').getAttribute('aria-pressed') === 'true'), 'kompakt läge väljs i panelen Inställningar');
    // Introraden är en rad i båda lägena (2–3 px skillnad som beror på typsnittet), så höjden prövas inte;
    // det kompakt läge gör med introt är att dölja förklaringen och knappen Läs mer.
    ok(vagledande.lasMer > 0 && kompakt.lasMer === 0 && kompakt.under === 0 && vagledande.under > 0 && kompakt.sida < vagledande.sida, `kompakt läge fäller undan förklaringarna och gör sidan kortare (${vagledande.sida} → ${kompakt.sida} punkter; Läs mer ${vagledande.lasMer} → ${kompakt.lasMer}, underrubriker ${vagledande.under} → ${kompakt.under})`);
    ok(kompakt.noter === vagledande.noter && kompakt.noter > 0 && kompakt.oppna === vagledande.oppna, 'noter om små grupper, förbehåll och diagrammens förklaringar står kvar, och samma avsnitt är utfällda');
    await page.evaluate(() => sattLage('vagledande'));
    ok(await page.evaluate(() => !document.body.classList.contains('lage-kompakt') && [...document.querySelectorAll('.avsnitt-under')].some(e => e.offsetParent)), 'vägledande läge visar förklaringarna igen');
}

console.log('\n── Byggets förminskning av stilmallen ──');
{
    // En förminskning som tar bort blankstegen i calc(a + b) gör deklarationen ogiltig, och webbläsaren hoppar över den.
    const stil = await page.evaluate(() => { const css = document.querySelector('style').textContent;
        const prov = (klass, egenskap) => { const e = document.createElement('div'); e.className = klass; document.body.appendChild(e); const v = getComputedStyle(e)[egenskap]; e.remove(); return v; };
        return { calc: (css.match(/calc\([^;{}]*?\)/g) || []).filter(c => /[\d%)][+*/][\d(]/.test(c)), meny: prov('chart-export-meny', 'top'), sok: prov('sok-lista', 'top'), mitt: prov('gu-stapel', 'backgroundImage'),
            is: (css.match(/[^\s,{}>+~(]:is\(#ov-/g) || []).length }; });
    ok(stil.calc.length === 0, `inget calc-uttryck i bygget har förlorat sina blanksteg${stil.calc.length ? ': ' + stil.calc.slice(0, 2).join(' ') : ''}`);
    ok(stil.meny !== 'auto' && stil.sok !== 'auto' && /gradient/.test(stil.mitt), `exportmenyn, sökträffarna och mittlinjen i gapstaplarna får sina regler (top ${stil.meny} / ${stil.sok})`);
}

console.log('\n── Smala skärmar: 1440×800, 768 och 390 punkter ──');
{
    const FLIKAR = ['dashboard', 'bestammelser', 'matrix', 'likvardighet', 'struktur', 'prioritering', 'loneoversyn', 'handlingsplan', 'dokumentera', 'kon', 'benchmark', 'utforska', 'info'];
    const oppna = async (bredd, hojd) => { const s = await browser.newPage({ viewport: { width: bredd, height: hojd } });
        await s.goto('file://' + FIL + '?demo=1');
        await s.waitForFunction(() => document.getElementById('demo-mode-banner')?.style.display === 'flex', { timeout: 30000 });
        await s.waitForTimeout(1500); return s; };
    // Ingen flik får bli bredare än fönstret, med alla avsnitt utfällda: det som inte ryms rullar inom sitt eget kort.
    const forBred = async s => { const ut = [];
        for (const f of FLIKAR) {
            await s.evaluate(t => document.querySelector(`.nav-item[data-tab="${t}"]`).click(), f);
            await s.waitForTimeout(500);
            await s.evaluate(() => document.querySelectorAll('details.avsnitt').forEach(a => { a.open = true; }));
            await s.waitForTimeout(300);
            const over = await s.evaluate(() => { const mc = document.getElementById('main-content'); return Math.max(document.documentElement.scrollWidth - document.documentElement.clientWidth, mc.scrollWidth - mc.clientWidth); });
            if (over > 1) ut.push(`${f} +${over}`);
        }
        return ut; };

    let s = await oppna(1440, 800);
    const meny = await s.evaluate(() => { const m = document.querySelector('.sidebar'); return { rullar: m.scrollHeight > m.clientHeight + 1, fast: getComputedStyle(m).position, knapp: getComputedStyle(document.getElementById('btn-meny')).display }; });
    ok(!meny.rullar && meny.fast === 'sticky' && meny.knapp === 'none', 'vanlig skärm 800 punkter hög: hela menyn ryms utan att rulla, och den följer med sidan');
    let bred = await forBred(s);
    ok(bred.length === 0, `1440 punkter: ingen flik är bredare än fönstret${bred.length ? ' — ' + bred.join(', ') : ''}`);
    await s.close();

    s = await oppna(768, 1024);
    const rad = await s.evaluate(() => { const m = document.querySelector('.sidebar'), e = document.querySelector('.nav-item.active .nav-etikett');
        return { bredd: Math.round(m.getBoundingClientRect().width), etikett: getComputedStyle(e).visibility, knapp: getComputedStyle(document.getElementById('btn-meny')).display,
            namn: [...document.querySelectorAll('.nav-item:not([hidden])')].every(k => k.textContent.trim().length > 2) }; });
    ok(rad.bredd === 60 && rad.etikett === 'hidden' && rad.knapp === 'none' && rad.namn, '768 punkter: menyn är en rad med ikoner, och varje knapp har kvar sitt namn');
    await s.hover('.nav-item[data-tab="prioritering"]');
    await s.waitForTimeout(200);
    ok(await s.evaluate(() => { const e = document.querySelector('.nav-item[data-tab="prioritering"] .nav-etikett'), r = e.getBoundingClientRect(); return getComputedStyle(e).visibility === 'visible' && r.left >= 60 && r.width > 40; }), '768 punkter: etiketten visas bredvid ikonen vid pekaren');
    bred = await forBred(s);
    ok(bred.length === 0, `768 punkter: ingen flik är bredare än fönstret${bred.length ? ' — ' + bred.join(', ') : ''}`);
    await s.evaluate(() => document.querySelector('.nav-item[data-tab="struktur"]').click());
    await s.waitForTimeout(600);
    await s.evaluate(() => { document.getElementById('avsnitt-st-sektorer').open = true; });
    await s.waitForTimeout(300);
    const tabell = await s.evaluate(() => { const t = document.getElementById('sektor-table'), yta = t.parentElement; yta.scrollLeft = 200;
        const c = t.querySelector('tbody td'), r = c.getBoundingClientRect(), y = yta.getBoundingClientRect();
        return { rullar: yta.scrollWidth > yta.clientWidth + 1, flyttad: yta.scrollLeft > 0, fast: Math.abs(r.left - y.left) < 2 }; });
    ok(tabell.rullar && tabell.flyttad && tabell.fast, '768 punkter: en bred tabell rullar inom sitt kort och första kolumnen står kvar');
    await s.evaluate(() => document.querySelector('.nav-item[data-tab="matrix"]').click());
    await s.waitForTimeout(800);
    await s.close();

    s = await oppna(390, 800);
    const tel = await s.evaluate(() => { const m = document.querySelector('.sidebar'); return { synlig: getComputedStyle(m).visibility, knapp: getComputedStyle(document.getElementById('btn-meny')).display, expanderad: document.getElementById('btn-meny').getAttribute('aria-expanded') }; });
    ok(tel.synlig === 'hidden' && tel.knapp !== 'none' && tel.expanderad === 'false', '390 punkter: menyn är undanfälld och knappen Meny visas');
    await s.click('#btn-meny');
    await s.waitForTimeout(400);
    const oppen = await s.evaluate(() => { const m = document.querySelector('.sidebar'), r = m.getBoundingClientRect();
        return { synlig: getComputedStyle(m).visibility === 'visible' && r.left >= 0 && r.width > 200, expanderad: document.getElementById('btn-meny').getAttribute('aria-expanded'), fokus: document.activeElement.classList.contains('nav-item'), skugga: !document.getElementById('meny-skugga').hidden }; });
    ok(oppen.synlig && oppen.expanderad === 'true' && oppen.fokus && oppen.skugga, '390 punkter: Meny öppnar menyn över innehållet och flyttar fokus dit');
    await s.keyboard.press('Escape');
    await s.waitForTimeout(400);
    ok(await s.evaluate(() => getComputedStyle(document.querySelector('.sidebar')).visibility === 'hidden' && document.activeElement.id === 'btn-meny'), '390 punkter: Escape stänger menyn och fokus går tillbaka till knappen');
    await s.click('#btn-meny');
    await s.waitForTimeout(300);
    await s.click('.nav-item[data-tab="matrix"]');
    await s.waitForTimeout(900);
    ok(await s.evaluate(() => getComputedStyle(document.querySelector('.sidebar')).visibility === 'hidden' && document.getElementById('view-matrix').style.display === 'block'), '390 punkter: ett val i menyn byter flik och stänger menyn');
    // Diagrammen ritar för den bredd de får: huvuddiagrammet ska fylla kortet och ha läsbar text.
    const dia = await s.evaluate(() => { const svg = document.querySelector('#view-matrix svg[role="group"], #view-matrix svg[role="img"]');
        if (!svg) return null; const r = svg.getBoundingClientRect(); const txt = [...svg.querySelectorAll('text')].map(t => t.getBoundingClientRect().height).filter(h => h > 0);
        return { bredd: Math.round(r.width), ryms: r.right <= innerWidth + 1, minst: txt.length ? Math.min(...txt) : 0 }; });
    ok(dia && dia.bredd >= 280 && dia.ryms && dia.minst >= 9, `390 punkter: huvuddiagrammet ryms och texten går att läsa (${dia ? `${dia.bredd} punkter brett, minsta text ${dia.minst.toFixed(1)}` : 'inget diagram'})`);
    bred = await forBred(s);
    ok(bred.length === 0, `390 punkter: ingen flik är bredare än fönstret${bred.length ? ' — ' + bred.join(', ') : ''}`);
    await s.close();
}

// Utskriftsfönstret för checklistorna (printScaffoldView, 60-utskrift.js) ärver verktygets CSP: ett <style> som
// skriptet skapar får inget ark, så fönstrets stilar kommer som ett byggt stilark (adoptedStyleSheets).
console.log('\n── Checklistornas utskriftsfönster ──');
for (const [vy, namn] of [['view-bestammelser', 'Bestämmelser & praxis'], ['view-handlingsplan', 'Handlingsplanens mall']]) {
    const [fonster] = await Promise.all([
        page.waitForEvent('popup', { timeout: 10000 }),
        page.evaluate(v => document.querySelector(`[data-print-view="${v}"]`).click(), vy),
    ]);
    await fonster.waitForLoadState();
    const u = await fonster.evaluate(() => ({
        ark: (document.adoptedStyleSheets || []).reduce((s, a) => s + a.cssRules.length, 0) + [...document.styleSheets].reduce((s, a) => s + a.cssRules.length, 0),
        skript: document.scripts.length,
        text: document.body.innerText.length,
        typsnitt: getComputedStyle(document.body).fontFamily,
    }));
    ok(u.ark > 0 && u.skript === 0 && u.text > 200, `${namn}: fönstret har stilar (${u.ark} regler), inga skript och innehållet (${u.text} tecken)`);
    ok(!/^(serif|"?Times)/i.test(u.typsnitt), `${namn}: stilarna tillämpas (typsnitt ${u.typsnitt.split(',')[0]})`);
    await fonster.close();
}

// Organisationsfilen (docs/utveckling/organisationsfil-design.md): ett paket inbakat i bygget som en inaktiv
// datablock. Filen ska starta under CSP:n från file:// med paketet inläst och utan överträdelser.
console.log('\n── Organisationsfilen ──');
{
    const { bakaIn } = await import('../src/lib/organisationsfil.js');
    const paket = { format: 'lonekartlaggning-organisationspaket', version: 1, organisation: { namn: 'Röktestkommunen' }, utgivare: 'HR', skapat: '2026-10-19', avserAr: 2026,
        profil: { jamforelseNamn: 'Röktestkommunens lönestatistik', jamforelseGenitiv: 'Röktestkommunens lönestatistiks', jamforelseKort: 'statistiken' },
        installningar: { poPct: 40, manader: 12, kTroskel: 10 },
        referens: { namn: 'Röktestkommunens ställningstagande', kortnamn: 'ställningstagandet', rader: ['A', 'B', 'C', 'D'].map((bas, i) => ({ bas, aid: null, p10: 24000 + i * 3000, med: 28000 + i * 3000, p90: 33000 + i * 3000 })) } };
    const r = bakaIn(readFileSync(FIL, 'utf8'), JSON.stringify(paket), { skapad: '2026-10-19', organisation: paket.organisation.namn, verktygssha: 'röktest' });
    ok(r.ok, 'paketet bakas in i bygget utan att något skript rörs');
    const katalog = mkdtempSync(join(tmpdir(), 'organisationsfil-'));
    const orgFil = join(katalog, 'oppen-lonekartlaggning-roktestkommunen.html');
    writeFileSync(orgFil, r.ok ? r.html : '');
    const o = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
    await o.addInitScript(webkitSelect => { window.__cspBrott = []; document.addEventListener('securitypolicyviolation', e => { if (webkitSelect && e.violatedDirective === 'style-src-attr' && e.target && (e.target.tagName === 'SELECT' || e.target.nodeName === '#document')) return; const m = e.target && e.target.nodeType === 1 ? e.target : null; window.__cspBrott.push(`${e.violatedDirective}: ${e.blockedURI || e.sample || ''}${m ? ' på ' + m.tagName.toLowerCase() + (m.id ? '#' + m.id : '') + (typeof m.className === 'string' && m.className ? '.' + m.className.trim().split(/\s+/).join('.') : '') : ' på ' + (e.target ? e.target.nodeName : 'okänt mål')} (rad ${e.lineNumber}${e.sourceFile ? ', ' + e.sourceFile.split('/').pop().slice(0, 30) : ''})`); }); }, NAMN === 'webkit');
    const oFel = []; o.on('pageerror', e => oFel.push(String(e && e.message || e)));
    await o.goto('file://' + orgFil);
    const u = await o.evaluate(() => ({ titel: document.title, paket: state.paket && state.paket.kalla, org: state.paket && state.paket.organisation, ref: window.referensNamn(),
        info: document.getElementById('paket-info').textContent, brott: window.__cspBrott.length, knapp: !!document.getElementById('btn-paket-visa') }));
    ok(u.titel === 'Öppen lönekartläggning' && u.paket === 'inbakat' && u.org === 'Röktestkommunen', `organisationsfilen startar med paketet inläst (${u.org}, ${u.paket})`);
    ok(u.ref === 'Röktestkommunens ställningstagande' && /Inbakat i den här filen/.test(u.info) && u.knapp, 'referensen kommer ur det inbakade paketet och filrutan visar källan med knappen Visa paketet');
    ok(u.brott === 0 && oFel.length === 0, `inga CSP-överträdelser eller sidfel i organisationsfilen${u.brott || oFel.length ? ': ' + oFel.slice(0, 2).join(' | ') : ''}`);
    await o.evaluate(() => document.getElementById('btn-paket-visa').click());
    const modal = await o.evaluate(() => ({ synlig: document.getElementById('paket-modal').style.display === 'flex', text: document.getElementById('paket-modal-content').textContent }));
    ok(modal.synlig && /Röktestkommunen/.test(modal.text) && /"format"/.test(modal.text), 'Visa paketet öppnar modalen med innehållet och råtexten');
    await o.close();
    rmSync(katalog, { recursive: true, force: true });
}

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

console.log('\n── Fel under hela körningen ──');
{
    const brott = await page.evaluate(() => window.__cspBrott || []);
    ok(brott.length === 0, `inga CSP-överträdelser${brott.length ? ': ' + [...new Set(brott)].slice(0, 6).join(' | ') : ''}`);
    ok(internaFel.length === 0, `inga interna fel i analysdelarna${internaFel.length ? ': ' + internaFel.slice(0, 3).join(' | ') : ''}`);
}
ok(konsolfel.length === 0, `inga oväntade konsolfel${konsolfel.length ? ': ' + konsolfel.slice(0, 3).join(' | ') : ''}`);
ok(sidfel.length === 0, `inga okastade sidfel${sidfel.length ? ': ' + sidfel.slice(0, 3).join(' | ') : ''}`);

await browser.close();
console.log(fel ? `\n✗ ${fel} kontroll(er) misslyckades (${NAMN})\n` : `\n✓ Alla kontroller gröna (${NAMN})\n`);
process.exit(fel ? 1 : 0);

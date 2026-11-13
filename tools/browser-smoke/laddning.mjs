// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
// Webbläsar-röktestet, del: Inläsningen: laddning under CSP:n, demodata, policyfil, startsidan och organisationsfilen.
// Körs av tools/browser-smoke.mjs i samma ordning som kontrollerna alltid har körts.
// Vaktar: S3 (docs/utveckling/regler.md)
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { FIL, NAMN, ok, browser, page, osynlig } from './rigg.mjs';
/* global state -- används i page.evaluate, där de finns i sidan */

// Laddning och CSP, demolänken, en okänd lönefil, demodatan och policyuppladdningen.
export async function laddningOchDemo() {
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
        await demoSida.waitForFunction(() => document.getElementById('demo-mode-banner')?.style.display === 'flex', null, { timeout: 15000 });
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
        await sida.waitForFunction(() => /Kolumnmappning behövs/.test(document.getElementById('column-map-panel')?.textContent || ''), null, { timeout: 15000 });
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
    }, null, { timeout: 15000 });
    ok(true, 'demodata inläst, banner synlig');
    ok(!(await osynlig('.nav-item[data-tab="benchmark"]')), 'Löneläget syns med ställningstagandet, utan jämförelsestatistik');
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
    }, null, { timeout: 15000 });
    ok(true, 'policyfilen lästes in via uppladdningsytan');
    ok(await page.evaluate(() => document.getElementById('referens-namn').value === 'stallningstagande'),
        'den egna referensen namngavs efter filen');
    ok(!(await osynlig('#referens-namn-rad')) && !(await osynlig('#btn-referens-aterga')),
        'namnfältet och "Återgå" visas med egen referens');
}

// Startsidan före inläsning, och de två lägena.
export async function startsidan() {
    console.log('\n── Startsidan före inläsning, och de två lägena ──');
    {
        // En egen sida utan data: Översikt ska vara en uppladdningssida, utan lägesdelarna.
        const tom = await browser.newPage({ viewport: { width: 1440, height: 900 } });
        await tom.goto('file://' + FIL);
        await tom.waitForTimeout(1200);
        const start = await tom.evaluate(() => { const syn = id => { const e = document.getElementById(id); return !!e && e.offsetParent !== null; };
            return { dolda: ['ov-filrad', 'ov-fordjupning'].filter(syn), komigang: syn('first-run-hint') && !!document.querySelector('#first-run-hint [data-go-to-tab="filer"]'), process: syn('avsnitt-ov-process'), sok: syn('sok-ruta') }; });
        ok(start.dolda.length === 0 && start.komigang && start.process, `före inläsning visas Kom igång och processöversikten, inte lägesdelarna${start.dolda.length ? ' — syns: ' + start.dolda.join(', ') : ''}`);
        // Funktionssöket syns före inläsning: ett avsnitt i en öppen flik går att nå, en låst flik säger kräver lönefil.
        ok(start.sok, 'sökfältet syns före inläsning');
        await tom.click('#sok-grupp');
        await tom.keyboard.type('ögonblicksbild');
        await tom.waitForTimeout(250);
        const funk = await tom.evaluate(() => { const l = document.getElementById('sok-grupp-lista'), r = l.getBoundingClientRect();
            return { synlig: !l.hidden && r.height > 20, rubrik: (l.querySelector('.sok-grupprubrik') || {}).textContent || '', forsta: (l.querySelector('[data-sok-funktion] .sok-namn') || {}).textContent || '' }; });
        ok(funk.synlig && funk.rubrik === 'Funktioner' && /ögonblicksbild/.test(funk.forsta), `funktionssöket visar avsnittet under Funktioner (${funk.forsta})`);
        await tom.keyboard.press('Enter');
        await tom.waitForTimeout(600);
        const gick = await tom.evaluate(() => { const a = document.getElementById('avsnitt-ar-ogonblick'), r = a.getBoundingClientRect();
            return { flik: document.querySelector('.nav-item.active')?.getAttribute('data-tab'), oppen: a.open, iBild: r.top >= -2 && r.top < innerHeight, fokus: document.activeElement === a.querySelector(':scope > summary') }; });
        ok(gick.flik === 'arbetet' && gick.oppen && gick.iBild && gick.fokus, `valet leder till avsnittet: utfällt, i bild och med fokus (${JSON.stringify(gick)})`);
        await tom.click('#sok-grupp');
        await tom.keyboard.type('regression');
        await tom.waitForTimeout(250);
        ok(await tom.evaluate(() => /kräver lönefil/.test(document.querySelector('#sok-grupp-lista [data-sok-funktion]')?.textContent || '')), 'en funktion i en låst flik säger kräver lönefil');
        await tom.keyboard.press('Enter');
        await tom.waitForTimeout(400);
        ok(await tom.evaluate(() => document.querySelector('.nav-item.active')?.getAttribute('data-tab') === 'filer'), 'och leder till Filer och kvalitet');
        await tom.close();

        await page.evaluate(() => { document.querySelector('.nav-item[data-tab="matrix"]').click(); scrollTo(0, 0); });
        await page.waitForTimeout(800);
        const hojd = () => page.evaluate(() => ({ sida: document.documentElement.scrollHeight, intro: document.querySelector('#view-lika-yrken .flik-intro, #view-regression .flik-intro, .view-panel[style*="block"] .flik-intro').getBoundingClientRect().height,
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
}

// Organisationsfilen.
export async function organisationsfilen() {
    // Organisationsfilen (docs/utveckling/organisationsfil.md): ett paket inbakat i bygget som en inaktiv
    // datablock. Filen ska starta under CSP:n från file:// med paketet inläst och utan överträdelser.
    console.log('\n── Organisationsfilen ──');
    {
        const { bakaIn } = await import('../../src/lib/organisationsfil.js');
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
}

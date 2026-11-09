// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
// Webbläsar-röktestet, del: Flikarna och diagrammen i dem.
// Körs av tools/browser-smoke.mjs i samma ordning som kontrollerna alltid har körts.
import { readFileSync, writeFileSync, mkdtempSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { FIL, NAMN, BILDER, ok, page, FLIKAR, konsolfel, sidfel } from './rigg.mjs';

// Flikarna och deras diagram, länkade vyer och flikarnas form.
export async function flikarOchDiagram() {
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
    // Flikarna klickas vid 1440 punkter: där är sidindexet en rad överst (spalten bredvid innehållet börjar vid 1920).
    await page.setViewportSize({ width: 1440, height: 900 });
    for (const [flik, diagram] of FLIKAR) {
        await page.click(`.nav-item[data-tab="${flik}"]`);
        await page.evaluate(() => document.querySelectorAll('details.avsnitt').forEach(d => { d.open = true; }));
        await page.waitForTimeout(400);           // låt fliken rita klart
        // Sidindexet (89-sidindex.js) har en post per synlig avsnittsrubrik i fliken, och inget alls under tre.
        const index = await page.evaluate(() => {
            const rubriker = [...document.querySelectorAll('.view-panel')].filter(p => p.offsetParent !== null)
                .flatMap(p => [...p.querySelectorAll('details.avsnitt > summary h2, details.avsnitt > summary h3, .card-header > h2')])
                .filter(h => h.offsetParent !== null).length;
            const nav = document.getElementById('sidindex');
            return { rubriker, poster: nav.querySelectorAll('a').length, dolt: nav.hidden };
        });
        ok(index.rubriker >= 3 ? index.poster === index.rubriker && !index.dolt : index.poster === 0 && index.dolt,
            `${flik}: sidindexet har en post per synligt avsnitt (${index.poster} poster, ${index.rubriker} rubriker)`);
        // Indexet ger ingen tabell en vågrät rullist som den inte har utan indexet: vid 1440 punkter (en rad ovanför
        // innehållet) och vid 1920, där spalten börjar i marginalen bredvid innehållet.
        for (const bredd of [1440, 1920]) {
            if (bredd !== 1440) { await page.setViewportSize({ width: bredd, height: 900 }); await page.waitForTimeout(100); }
            const rullar = await page.evaluate(() => {
                const kropp = document.querySelector('.content-body');
                const tabeller = [...document.querySelectorAll('.view-panel .table-container')].filter(t => t.offsetParent !== null);
                const matt = () => tabeller.map(t => t.scrollWidth > t.clientWidth + 1);
                if (!kropp.classList.contains('har-sidindex')) return [];
                const med = matt();
                kropp.classList.remove('har-sidindex');
                const utan = matt();
                kropp.classList.add('har-sidindex');
                return tabeller.map((t, i) => med[i] && !utan[i] ? (t.querySelector('table')?.id || t.closest('[id]')?.id || '?') : null).filter(Boolean);
            });
            ok(rullar.length === 0, `${flik}: ingen tabell får vågrät rullist av sidindexet vid ${bredd} punkter${rullar.length ? ` (${rullar.join(', ')})` : ''}`);
        }
        await page.setViewportSize({ width: 1440, height: 900 });
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
    {
        // Smalare än 1920 punkter (här 1440) är sidindexet en rad överst som följer med och säger vilket avsnitt som står i
        // fönstret; raden med det markerade lägger sig under den, och båda syns.
        await page.click('.nav-item[data-tab="struktur"]');
        await page.evaluate(() => document.querySelectorAll('details.avsnitt').forEach(d => { d.open = true; }));
        await page.waitForTimeout(400);
        await page.locator('#chart-skevhet-andel [data-marke="stapel"]').first().click();
        await page.waitForTimeout(200);
        await page.evaluate(() => document.getElementById('avsnitt-st-eu').scrollIntoView({ block: 'start' }));
        // Avsnitten ovanför kan växa en stund efter att de öppnats (diagram ritas), så att avsnittet glider ner ur
        // fönstret (WebKit i CI). Rulla fram det igen tills det står kvar överst och sidindexet har hunnit följa med.
        await page.waitForFunction(() => {
            const el = document.getElementById('avsnitt-st-eu'), topp = el.getBoundingClientRect().top;
            if (topp < -4 || topp > 0.4 * innerHeight) { el.scrollIntoView({ block: 'start' }); return false; }
            const aktiv = document.querySelector('#sidindex a.ar-aktiv')?.dataset.sidindex;
            const t = aktiv ? document.querySelector(`#${aktiv} > summary`)?.getBoundingClientRect().top : null;
            return t != null && t <= 0.4 * innerHeight;
        }, null, { timeout: 8000, polling: 300 }).catch(() => {});
        await page.waitForTimeout(300);
        const rad = await page.evaluate(() => {
            const nav = document.getElementById('sidindex').getBoundingClientRect(), mk = document.getElementById('markering-rad')?.getBoundingClientRect();
            return { topp: Math.round(nav.top), botten: Math.round(nav.bottom), rullat: Math.round(scrollY),
                summary: document.querySelector('#sidindex summary').textContent.replace(/\s+/g, ' ').trim(),
                aktiv: document.querySelector('#sidindex a.ar-aktiv')?.textContent || '',
                // Den aktiva postens rubrik står i fönstrets övre del, under raden.
                aktivTopp: Math.round(document.querySelector(`#${document.querySelector('#sidindex a.ar-aktiv')?.dataset.sidindex} > summary`)?.getBoundingClientRect().top ?? -1),
                mk: mk ? { topp: Math.round(mk.top), hojd: Math.round(mk.height) } : null };
        });
        ok(rad.rullat > 300 && rad.topp >= 0 && rad.topp <= 4 && rad.aktiv !== '' && rad.summary.includes(rad.aktiv) && rad.aktivTopp >= rad.botten - 4 && rad.aktivTopp <= 0.4 * 900,
            `sidindexet vid 1440 punkter följer med överst och säger var läsaren är (rullat ${rad.rullat} px, raden ${rad.topp} px från överkanten: "${rad.summary}", rubriken ${rad.aktivTopp} px)`);
        ok(!!rad.mk && rad.mk.hojd > 0 && rad.mk.topp >= rad.botten - 1 && rad.mk.topp < rad.botten + 20,
            `raden med det markerade står synlig under sidindexet (sidindexet slutar ${rad.botten} px, markeringen börjar ${rad.mk && rad.mk.topp} px)`);
        // Ett långt rullsteg som hoppar förbi rubriker: posten är fortfarande avsnittet som läslinjen (40 %) står i.
        await page.mouse.move(800, 500);
        await page.mouse.wheel(0, -2200);
        await page.waitForTimeout(600);
        const hopp = await page.evaluate(() => {
            const linje = innerHeight * 0.4, a = document.querySelector('#sidindex a.ar-aktiv');
            const topp = id => document.querySelector(`#${id} > summary, #${id} .card-header > h2`)?.getBoundingClientRect().top ?? NaN;
            const alla = [...document.querySelectorAll('#sidindex a')].map(x => x.dataset.sidindex), i = alla.indexOf(a?.dataset.sidindex);
            return { aktiv: a?.textContent || '', ovan: topp(alla[i]) <= linje || i === 0, nasta: i === alla.length - 1 || topp(alla[i + 1]) > linje,
                summary: document.querySelector('#sidindex summary').textContent };
        });
        ok(hopp.ovan && hopp.nasta && hopp.summary.includes(hopp.aktiv), `efter ett långt rullsteg visar sidindexet avsnittet som står i fönstret (${hopp.aktiv})`);
        await page.keyboard.press('Escape');
        await page.waitForTimeout(150);
        // Ett klick på en post i den utfällda raden: raden fälls ihop först, rubriken hamnar under den och raden säger avsnittet.
        await page.evaluate(() => { window.scrollTo(0, 0); document.querySelector('#sidindex .sidindex-ram').open = true; });
        await page.waitForTimeout(200);
        // Den andra posten: långt från sidans slut, så att rubriken kan rullas upp till raden.
        const postId = await page.evaluate(() => document.querySelectorAll('#sidindex a[data-sidindex]')[1]?.dataset.sidindex || '');
        await page.click(`#sidindex a[data-sidindex="${postId}"]`);
        await page.waitForTimeout(900);
        const klick = await page.evaluate(id => {
            const nav = document.getElementById('sidindex').getBoundingClientRect(), mal = document.getElementById(id);
            const rubrik = (mal.querySelector(':scope > summary') || mal.querySelector('.card-header > h2') || mal).getBoundingClientRect();
            return { hopfalld: !document.querySelector('#sidindex .sidindex-ram').open, botten: Math.round(nav.bottom), rubrikTopp: Math.round(rubrik.top),
                summary: document.querySelector('#sidindex summary').textContent.replace(/\s+/g, ' ').trim(),
                post: document.querySelector(`#sidindex a[data-sidindex="${id}"]`).textContent.trim(),
                rullat: Math.round(scrollY), max: Math.round(document.scrollingElement.scrollHeight - innerHeight) };
        }, postId);
        ok(klick.hopfalld && klick.rubrikTopp >= klick.botten - 4 && klick.rubrikTopp <= klick.botten + 60 && klick.summary.includes(klick.post),
            `ett klick i sidindexet vid 1440 punkter fäller ihop raden och lägger rubriken under den (raden slutar ${klick.botten} px, rubriken ${klick.rubrikTopp} px, rullat ${klick.rullat} av ${klick.max} px, raden: "${klick.summary}")`);
    }
    {
        // Från 1920 punkter är sidindexet en spalt bredvid innehållet som följer med när sidan rullas; ett klick fäller
        // ut avsnittet och ger summaryn fokus.
        await page.setViewportSize({ width: 1920, height: 900 });
        await page.click('.nav-item[data-tab="struktur"]');
        await page.evaluate(() => { document.getElementById('avsnitt-st-eu').open = false; });
        await page.waitForTimeout(200);
        await page.click('#sidindex a[data-sidindex="avsnitt-st-eu"]');
        await page.waitForTimeout(900);
        const spalt = await page.evaluate(() => {
            const nav = document.getElementById('sidindex').getBoundingClientRect(), panel = document.getElementById('view-struktur').getBoundingClientRect();
            return { bredvid: nav.left >= panel.right && nav.right <= innerWidth, topp: Math.round(document.querySelector('#sidindex .sidindex-lista').getBoundingClientRect().top),
                rullat: Math.round(scrollY), oppen: document.getElementById('avsnitt-st-eu').open,
                fokus: document.activeElement === document.querySelector('#avsnitt-st-eu > summary'),
                aktiv: document.querySelector('#sidindex a.ar-aktiv')?.textContent || '' };
        });
        ok(spalt.bredvid && spalt.rullat > 300 && spalt.topp >= 0 && spalt.topp < 80 && spalt.oppen && spalt.fokus,
            `sidindexet står bredvid innehållet och följer med (rullat ${spalt.rullat} px, listan ${spalt.topp} px från överkanten); klicket fällde ut avsnittet och gav fokus (aktiv: ${spalt.aktiv})`);
    }
    await page.setViewportSize({ width: 1400, height: 1000 });

    console.log('\n── Diagrammen (diagramkärnan, ADR-39) ──');
    // Varje diagram ritas av diagramkärnan: en SVG med märken, och exportmenyn ger en PNG och en SVG som inte
    // är tomma. Ett diagram som vyn ersätter med en förklarande text
    // (för få grupper i demodatan) räknas som riktigt — då finns ingen figur och ingen bild.
    const DIAGRAMMEN = [['matrix', 'chart-la-tratt'], ['struktur', 'chart-skevhet-andel'], ['struktur', 'chart-perbas-gap'], ['struktur', 'chart-sektorer'],
                      ['benchmark', 'chart-lp-gender'], ['benchmark', 'chart-lp-compliance'], ['kon', 'chart-demo-hist'],
                      // linjer, band och lådor
                      ['kon', 'chart-kon-scatter'], ['kon', 'chart-kon-boxplot'],
                      ['kon', 'chart-demo-agecurve'], ['kon', 'chart-demo-spread'], ['matrix', 'lifecycle-chart'],
                      // de sammansatta diagrammen
                      ['benchmark', 'chart-jamforelse-spann'], ['benchmark', 'chart-jamforelse-avvikelse'], ['benchmark', 'chart-lp-bandmap'], ['benchmark', 'chart-jmf-statlage'], ['benchmark', 'chart-ref-hantel'],
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

    console.log('\n── Diagrammens BAS-urval: knapparna ovanför bandkartan ──');
    {
        await page.click('.nav-item[data-tab="benchmark"]');
        await page.evaluate(() => document.querySelectorAll('details.avsnitt').forEach(d => { d.open = true; }));
        await page.waitForTimeout(400);
        const felFore = konsolfel.length + sidfel.length;
        const etiketter = () => page.evaluate(() => [...document.querySelectorAll('#chart-lp-bandmap > svg [data-axel="x"]')].map(t => t.textContent));
        const fore = await etiketter();
        const forsta = page.locator('#chart-lp-bandmap').locator('xpath=preceding-sibling::div[@data-urval-falt="bas"][1]').locator('button[aria-pressed]').first();
        const namn = await forsta.textContent();
        await forsta.click();
        await page.waitForTimeout(300);
        const efter = await etiketter();
        ok(efter.length === fore.length - 1 && !efter.includes(namn), `bandkartan: ett klick på ${namn} döljer intervallet (${fore.length} → ${efter.length} x-etiketter)`);
        ok(await forsta.getAttribute('aria-pressed') === 'false', 'knappen är inte längre intryckt (aria-pressed="false")');
        ok(konsolfel.length + sidfel.length === felFore, `inga konsolfel efter klicket${konsolfel.length + sidfel.length > felFore ? ': ' + [...konsolfel, ...sidfel].slice(felFore).join(' | ') : ''}`);
        // Tillbaka till alla, så att kontrollerna efter den här ser hela bandkartan.
        await page.locator('#chart-lp-bandmap').locator('xpath=preceding-sibling::div[contains(@class,"diagram-urval")][1]').locator('[data-urval-alla]').click();
        await page.waitForTimeout(300);
        ok((await etiketter()).length === fore.length, 'Visa alla ritar alla intervall igen');
    }

    console.log('\n── Länkade vyer: en markerad grupp framhävs i alla diagram ──');
    /* global diagramMarkering, sattDiagramMarkering, getData, explorerUrval, _chartExportRubrikFot -- funktionerna nedan körs i sidan, där de finns */
    {
        await page.click('.nav-item[data-tab="benchmark"]');
        await page.evaluate(() => document.querySelectorAll('details.avsnitt').forEach(d => { d.open = true; }));
        await page.waitForTimeout(400);
        await page.click('.nav-item[data-tab="struktur"]');
        await page.evaluate(() => document.querySelectorAll('details.avsnitt').forEach(d => { d.open = true; }));
        await page.waitForTimeout(400);
        await page.locator('#chart-skevhet-andel [data-marke="stapel"]').first().click();
        await page.waitForTimeout(200);
        const efterKlick = await page.evaluate(() => ({ nyckel: diagramMarkering(), rad: (document.getElementById('markering-rad') || {}).textContent || '',
            har: document.querySelectorAll('#chart-skevhet-andel [data-markerad]').length, andra: document.querySelectorAll('#chart-lp-compliance [data-markerad]').length }));
        ok(Array.isArray(efterKlick.nyckel) && /^bas:/.test(efterKlick.nyckel[0] || '') && efterKlick.rad.includes('Markerat i alla diagram: BAS'), `ett klick på en stapel markerar dess BAS (${efterKlick.nyckel})`);
        ok(efterKlick.har > 0 && efterKlick.andra > 0, `samma BAS framhävs i ett diagram i en annan flik (${efterKlick.andra} märken i Lönepolitik)`);
        await page.keyboard.press('Escape');
        await page.waitForTimeout(150);
        const efterEsc = await page.evaluate(() => ({ nyckel: diagramMarkering(), rad: !!document.getElementById('markering-rad'), kvar: document.querySelectorAll('[data-markerad], svg [opacity="0.22"]').length }));
        ok(efterEsc.nyckel === null && !efterEsc.rad && efterEsc.kvar === 0, 'Escape tar bort markeringen och återställer diagrammen');
        // Tabellen följer markeringen, och pensling i spridningsdiagrammet framhäver punkterna i området.
        // En rad som hör till ett BAS (rader för BAS där ett kön är under tröskeln byggs för sig och går inte att markera).
        const radNr = await page.evaluate(() => [...document.querySelectorAll('#la-oversikt tbody tr')].findIndex(r => Array.isArray(r._markering)));
        await page.locator('#la-oversikt tbody tr').nth(Math.max(0, radNr)).locator('td').first().click();
        await page.waitForTimeout(150);
        ok(await page.evaluate(() => document.querySelectorAll('#la-oversikt tbody tr.rad-markerad').length === 1 && document.querySelectorAll('#chart-skevhet-andel [data-markerad]').length > 0),
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
        await page.waitForFunction(() => document.getElementById('demo-mode-banner')?.style.display === 'flex', null, { timeout: 15000 });
        await page.waitForTimeout(1500);
        await page.evaluate(() => document.querySelector('.nav-item[data-tab="matrix"]').click());
        await page.waitForTimeout(1200);
        const form = await page.evaluate(() => { const a = [...document.querySelectorAll('#view-lika-yrken details.avsnitt[id^="avsnitt-la-"]')]; const m = document.getElementById('main-content');
            return { slutsatser: document.querySelectorAll('#la-slutsatser .slutsats').length, oppna: a.filter(x => x.open).map(x => x.id), antal: a.length,
                nyckel: [...document.querySelectorAll('[id^="nyckel-la-"]')].filter(e => e.textContent.trim()).length, skarmar: +(Math.max(document.documentElement.scrollHeight, m.scrollHeight) / innerHeight).toFixed(1), lankrad: document.querySelectorAll('.sidans-innehall').length }; });
        const huvudet = await page.evaluate(() => { const r = s => document.querySelector(s).getBoundingClientRect(); const delar = ['#sok-grupp', '#btn-open-symbols', '#btn-open-installningar', '#btn-open-glossary'].map(r);
            return { overlapp: delar.some((d, i) => i > 0 && delar[i - 1].right > d.left + 0.5), utanfor: delar[delar.length - 1].right > r('.top-header').right + 0.5 }; });
        ok(!huvudet.overlapp && !huvudet.utanfor, 'sidhuvudet: sökfältet och knapparna står bredvid varandra utan att gå in över varandra');
        ok(form.slutsatser === 4, 'toppen visar fyra slutsatser');
        ok(form.antal >= 4 && form.oppna.length === 1 && form.oppna[0] === 'avsnitt-la-yrkesgrupper' && form.nyckel >= 4 && form.lankrad === 0, `${form.antal} avsnitt, bara det första öppet, ${form.nyckel} med nyckeltal, ingen länkrad`);
        console.log(`    (fliken är ${form.skarmar} skärmhöjder med bara första avsnittet öppet)`);
        await page.evaluate(() => document.querySelector('.nav-item[data-tab="struktur"]').click());
        await page.waitForTimeout(1200);
        const bas = await page.evaluate(() => ({ huvud: Math.round(document.getElementById('la-oversikt').getBoundingClientRect().width), rader: document.querySelectorAll('#la-oversikt tbody tr').length,
            grafik: document.querySelectorAll('#la-oversikt tbody svg.la-oversikt-grafik').length,
            ryms: document.querySelector('#la-huvuddiagram .table-container').scrollWidth <= document.querySelector('#la-huvuddiagram .table-container').clientWidth + 1 }));
        await page.click('#avsnitt-ls-bas > summary');
        await page.waitForTimeout(700);
        const basUt = await page.evaluate(() => ({ huvud: Math.round(document.getElementById('la-oversikt').getBoundingClientRect().width), rader: document.querySelectorAll('#la-oversikt tbody tr').length,
            grafik: document.querySelectorAll('#la-oversikt tbody svg.la-oversikt-grafik').length,
            ryms: document.querySelector('#la-huvuddiagram .table-container').scrollWidth <= document.querySelector('#la-huvuddiagram .table-container').clientWidth + 1 }));
        ok(basUt.huvud > 300 && basUt.rader > 0 && basUt.grafik === basUt.rader && basUt.ryms, `Lönestruktur: BAS-tabellen med grafik i varje rad, utan sidrullning (${basUt.rader} rader, ${basUt.huvud} px bred; ${bas.huvud} px innan avsnittet fälldes ut)`);
        ok(await page.evaluate(() => { const s = document.querySelector('#chart-skevhet-lador svg'); return !!s && s.getBoundingClientRect().width > 300 && document.querySelector('#la-oversikt tbody tr').getBoundingClientRect().height > 0; }),
            'ett avsnitt som fälls ut ritar sitt diagram i full bredd och visar sin tabell');
        await page.keyboard.press('Tab');
        ok(await page.evaluate(() => { const s = document.querySelector('#avsnitt-ls-kon > summary'); s.focus(); return document.activeElement === s; }), 'avsnittens rubriker går att nå med tangentbordet');
        await page.keyboard.press('Enter');
        await page.waitForTimeout(300);
        ok(await page.evaluate(() => document.getElementById('avsnitt-ls-kon').open), 'Enter fäller ut avsnittet');
        // Avsnitten hör till Lönestruktur: fäll in dem igen, annars mäter kontrollen av Lönestruktur nedan dem utfällda.
        await page.evaluate(() => ['avsnitt-ls-bas', 'avsnitt-ls-kon'].forEach(id => { document.getElementById(id).open = false; }));
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
            return { matrisForst: top(g('chart-prio-matrix')) < top(g('avsnitt-pr-lista')), sist: top(g('pr-installningar-rad')) > top(g('avsnitt-pr-lista')),
                oppna: [...document.querySelectorAll('details.avsnitt[id^="avsnitt-pr-"]')].filter(a => a.open).map(a => a.id).join(','), rad: g('pr-installningar-rad').textContent }; });
        ok(pr.matrisForst && pr.sist && pr.oppna === 'avsnitt-pr-lista' && pr.rad.startsWith('Trösklar och viktning: standardvärden'), 'matrisen står före listan, och raden om trösklarna efter den säger standardvärden');
        await page.click('#pr-installningar-rad [data-oppna-installningar="prio-cfg-atgard"]');
        await page.waitForTimeout(300);
        ok(await page.evaluate(() => document.getElementById('installningar-modal').style.display === 'flex' && document.activeElement.id === 'prio-cfg-atgard'), 'Ändra öppnar Inställningar med fokus i granskningsgränsen');
        await page.fill('#prio-cfg-atgard', '-8');
        await page.waitForTimeout(500);
        ok(await page.evaluate(() => document.getElementById('pr-installningar-rad').textContent.startsWith('Trösklar och viktning: anpassade värden')), 'en ändrad tröskel i dialogen syns i flikens rad');
        await page.click('#prio-cfg-reset');
        await page.waitForTimeout(400);
        await page.keyboard.press('Escape');
        await page.waitForFunction(() => document.getElementById('installningar-modal').style.display === 'none', null, { timeout: 5000 });
    }

    console.log('\n── Diagramfilter: Minst på prioriteringsmatrisens antal ──');
    /* global _figUrvalSpann -- körs i sidan, där den finns */
    {
        const punkter = () => page.evaluate(() => document.querySelectorAll('#chart-prio-matrix > svg [data-marke="punkt"]').length);
        const fore = await punkter();
        const felFore = konsolfel.length + sidfel.length;
        const rader = await page.evaluate(() => { const ut = []; let r = document.getElementById('chart-prio-matrix').previousElementSibling;
            while (r && r.classList.contains('diagram-urval')) { ut.unshift(r.getAttribute('data-urval-falt')); r = r.previousElementSibling; }
            return ut; });
        ok(['bas', 'n', 'x'].every(f => rader.includes(f)), `matrisen har filterraderna BAS, antal och avvikelse (${rader.join(', ')})`);
        // Ett Minst mitt i spannet: grupperna under döljs.
        const minst = await page.evaluate(() => { const sp = _figUrvalSpann(document.getElementById('chart-prio-matrix')._figur, 'n'); return Math.ceil((sp.min + sp.max) / 2); });
        const falt = page.locator('#chart-prio-matrix').locator('xpath=preceding-sibling::div[@data-urval-falt="n"][1]').locator('input[data-urval-grans="min"]');
        await falt.fill(String(minst));
        await falt.press('Enter');
        await page.waitForTimeout(400);
        const efter = await punkter();
        const not = await page.evaluate(() => { const n = document.getElementById('chart-prio-matrix').nextElementSibling; return n && n.getAttribute('data-rf') === 'urval' ? n.textContent : ''; });
        ok(efter > 0 && efter < fore, `Minst ${minst} ritar färre punkter (${fore} → ${efter})`);
        ok(not.includes(`minst ${minst} personer i gruppen`) && not.includes('Talen i texten och tabellerna gäller hela underlaget'), `noten nämner intervallet (${not})`);
        ok(konsolfel.length + sidfel.length === felFore, 'inga konsolfel efter filtret');
        await page.locator('#chart-prio-matrix').locator('xpath=preceding-sibling::div[contains(@class,"diagram-urval")][1]').locator('[data-urval-alla]').click();
        await page.waitForTimeout(400);
        ok(await punkter() === fore && await falt.inputValue() === '', 'Visa alla ritar alla punkter igen och tömmer fältet');
    }

    console.log('\n── Regler & praxis: pilen och Stöd i verktyget ──');
    {
        await page.evaluate(() => document.querySelector('.nav-item[data-tab="bestammelser"]').click());
        await page.waitForTimeout(500);
        const vinkel = () => page.evaluate(() => { const m = getComputedStyle(document.querySelector('#avsnitt-rp-1 > summary'), '::before').transform.match(/matrix\(([^,]+), ([^,]+)/);
            return m ? Math.round(Math.atan2(Number(m[2]), Number(m[1])) * 180 / Math.PI) : null; });
        await page.evaluate(() => { document.getElementById('avsnitt-rp-1').open = false; });
        await page.waitForTimeout(250);
        const stangd = await vinkel();
        await page.click('#avsnitt-rp-1 > summary');
        await page.waitForTimeout(250);
        const oppen = await vinkel();
        ok(stangd === -45 && oppen === 45, `pilen framför ett område pekar åt höger när det är hopfällt och nedåt när det är utfällt (${stangd}° / ${oppen}°)`);
        const stod = await page.evaluate(() => [...document.querySelectorAll('.bes8-stod')].map(l => ({ flik: l.dataset.stod, text: l.textContent.trim(), lank: l.querySelector('a[data-go-to-tab]')?.dataset.goToTab })));
        ok(stod.length === 3 && stod.every(x => /\d/.test(x.text) && /Gå dit$/.test(x.text) && x.lank === x.flik), `Stöd i verktyget har talet och en länk till fliken (${stod.map(x => x.flik).join(', ')})`);
        await page.click('#avsnitt-rp-1 a[data-go-to-tab]');
        await page.waitForTimeout(600);
        ok(await page.evaluate(() => document.querySelector('.nav-item.active').dataset.tab === 'likvardighet'), 'länken Gå dit öppnar Likvärdigt arbete');
    }

    console.log('\n── Exportera: checklistan först, robustheten, exporterna som lista; Rapporttext ──');
    {
        await page.evaluate(() => document.querySelector('.nav-item[data-tab="prioritering"]').click());
        await page.waitForTimeout(600);
        const jfr = await page.evaluate(() => { const r = document.getElementById('view-prioritering').getBoundingClientRect(); return { x: r.left, y: r.top - document.querySelector('.content-body').getBoundingClientRect().top }; });
        await page.evaluate(() => document.querySelector('.nav-item[data-tab="dokumentera"]').click());
        await page.waitForTimeout(1200);
        const dk = await page.evaluate(() => { const g = id => document.getElementById(id); const r = g('view-kvalitet').getBoundingClientRect(); const top = id => g(id).getBoundingClientRect().top;
            return { x: r.left, y: r.top - document.querySelector('.content-body').getBoundingClientRect().top, ordning: top('dk-slutsatser') < top('dk-checklista') && top('dk-checklista') < top('avsnitt-dk-robusthet') && top('avsnitt-dk-robusthet') < top('export-hub'),
                rutor: document.querySelectorAll('#dk-slutsatser .slutsats').length, rader: [...document.querySelectorAll('.export-lista > .export-hub-row')].filter(e => e.offsetParent).length,
                fler: [...document.querySelectorAll('.export-fler a[data-go-to-tab]')].map(a => a.dataset.goToTab).join(','),
                oppna: [...document.querySelectorAll('details.avsnitt[id^="avsnitt-dk-"]')].filter(a => a.open).map(a => a.id).join(','), lank: document.querySelectorAll('.sidans-innehall').length,
                skarmar: document.documentElement.scrollHeight / innerHeight }; });
        ok(Math.abs(dk.x - jfr.x) < 1 && Math.abs(dk.y - jfr.y) < 1, `fliken börjar lika långt från innehållsytans kant som andra flikar — inget tomt band (${Math.round(dk.x)},${Math.round(dk.y)} mot ${Math.round(jfr.x)},${Math.round(jfr.y)})`);
        ok(dk.ordning && dk.rutor === 2 && dk.rader === 6 && dk.fler === 'likvardighet,struktur,prioritering,loneoversyn' && dk.lank === 0, `slutsatser, checklista, robustheten, sex exportrader och en rad med länkar till flikarna (${dk.rader} rader; ${dk.fler})`);
        ok(dk.oppna === 'avsnitt-dk-robusthet' && dk.skarmar < 4, `bara robustheten är utfälld och sidan är ${dk.skarmar.toFixed(1)} skärmar`);
        await page.click('#btn-run-robusthet');
        await page.waitForFunction(() => document.querySelector('#robusthet-body .gd-grid'), null, { timeout: 60000 });
        ok(await page.evaluate(() => !/Inte körd/.test(document.querySelectorAll('#dk-slutsatser .slutsats')[1].textContent) && document.getElementById('nyckel-dk-robusthet').textContent.length > 3), 'robusthetens utfall står i slutsatserna och i avsnittets rubrik');
        await page.evaluate(() => document.querySelector('.nav-item[data-tab="rapporttext"]').click());
        await page.waitForTimeout(1200);
        ok(await page.evaluate(() => document.getElementById('avsnitt-rt-utkast').open && /LÖNEKARTLÄGGNING/.test(document.getElementById('struktur-narrative').value)), 'Rapporttext: auto-utkastet är utfällt och ifyllt');
        // Väljaren Omfång: Hela organisationen tar bort delen per BAS-intervall, och Återskapa följer valet.
        const perBas = () => page.evaluate(() => /\nPER BAS-INTERVALL\n/.test(document.getElementById('struktur-narrative').value));
        const medDel = await perBas();
        await page.selectOption('#struktur-narrative-omfang', 'hela');
        const utanDel = await perBas();
        await page.click('#struktur-narrative-regen');
        const utanEfterAterskapa = await perBas();
        await page.selectOption('#struktur-narrative-omfang', 'perBas');
        const tillbaka = await perBas();
        await page.click('#struktur-narrative-regen');
        ok(medDel && !utanDel && !utanEfterAterskapa && tillbaka && await perBas(), `Rapporttext: Omfång tar bort och lägger tillbaka PER BAS-INTERVALL, och Återskapa följer valet (${[medDel, utanDel, utanEfterAterskapa, tillbaka].join(', ')})`);
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
        ok(l.oppna === 'avsnitt-st-representation' && l.rutor === 5 && l.lank === 0 && l.skarmar < 2.5, `Struktur: fem slutsatser och representationen utfälld, kartan hopfälld (${l.skarmar.toFixed(1)} skärmar)`);
        console.log(`  Lönestruktur: ${l.skarmar.toFixed(2)} skärmhöjder`);
        ok(await page.evaluate(() => !!document.querySelector('#chart-struktur-tradkarta svg') && !document.getElementById('avsnitt-st-karta').open), 'Struktur: kartan är ritad i sitt hopfällda avsnitt');
        let b = await fyller('avsnitt-st-karta', 'chart-struktur-tradkarta');
        ok(b === 'ok', `Struktur: kartan fyller kortet när avsnittet fälls ut (${b})`);
        b = await fyller('avsnitt-st-eu', 'chart-struktur-kvartiler');
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
        await page.evaluate(() => { for (const [id, oppen] of [['avsnitt-jmf-bandkartor', false], ['avsnitt-jmf-stallningstagande', true], ['avsnitt-jmf-statistik', false], ['avsnitt-jmf-overblick', false]]) document.getElementById(id).open = oppen; });
        await page.waitForTimeout(300);
        l = await lage('avsnitt-lp-');
        ok(l.oppna === 'avsnitt-lp-tabell' && l.rutor === 6 && l.skarmar < 4, `Jämförelse, avsnittet mot ställningstagandet (utan statistik): flikens två och avsnittets fyra slutsatser och tabellen utfälld (bandkartan står i Överblick) (${l.rutor} rutor, ${l.oppna}, ${l.skarmar.toFixed(1)} skärmar)`);
        await page.evaluate(() => { document.getElementById('avsnitt-jmf-overblick').open = true; });
        b = await fyller('avsnitt-lp-kon', 'chart-lp-gender');
        ok(b === 'ok' || b === 'inget diagram', `Lönepolitik: könspositionen fyller kortet när avsnittet fälls ut (${b})`);
        b = await fyller('avsnitt-lp-efterlevnad', 'chart-lp-compliance');
        ok(b === 'ok', `Lönepolitik: efterlevnaden fyller kortet när avsnittet fälls ut (${b})`);
    }
}

// Översikt efter inläsning.
export async function oversiktEfterInlasning() {
    console.log('\n── Översikt efter inläsning ──');
    {
        await page.evaluate(() => { document.querySelector('.nav-item[data-tab="dashboard"]').click(); scrollTo(0, 0); });
        await page.waitForTimeout(900);
        // Tidigare steg har fällt ut avsnitten: läget ställs tillbaka till det som gäller efter en inläsning.
        await page.evaluate(() => document.querySelectorAll('#view-dashboard details.avsnitt').forEach(a => { a.open = false; }));
        await page.waitForTimeout(300);
        const ov = await page.evaluate(() => { const g = id => document.getElementById(id); const syn = id => g(id).offsetParent !== null; const top = id => g(id).getBoundingClientRect().top;
            return { rad: syn('ov-filrad') && /Lönefil: \d+ personer/.test(g('ov-filrad').textContent), filer: !!g('upload-row') && !g('view-dashboard').contains(g('upload-row')),
                ordning: top('ov-filrad') < top('dashboard-summary') && top('dashboard-summary') < top('att-gora') && top('att-gora') < top('avsnitt-ov-process'),
                karta: !g('chart-ov-tradkarta'), kvartiler: !g('chart-ov-kvartiler'),
                oppna: [...document.querySelectorAll('#view-dashboard details.avsnitt')].filter(a => a.open).length, skarmar: document.documentElement.scrollHeight / innerHeight }; });
        ok(ov.rad && ov.filer, 'filerna är en rad på Översikt, och uppladdningskorten står i Filer och kvalitet');
        ok(ov.ordning && ov.karta && ov.kvartiler, 'nyckeltalen och Att göra står i den ordningen före avsnitten; kartan och kvartilerna finns bara i Struktur');
        ok(ov.oppna === 0 && ov.skarmar < 3.5, `avsnitten är hopfällda och sidan är ${ov.skarmar.toFixed(1)} skärmar`);
        await page.click('#ov-filrad [data-go-to-tab="filer"]');
        await page.waitForTimeout(300);
        ok(await page.evaluate(() => document.getElementById('upload-row').offsetParent !== null && document.querySelector('.nav-item.active').dataset.tab === 'filer'), 'länken i filraden öppnar Filer och kvalitet med uppladdningskorten');
        await page.evaluate(() => { document.querySelector('.nav-item[data-tab="dashboard"]').click(); scrollTo(0, 0); });
        await page.waitForTimeout(300);
        await page.evaluate(() => { document.getElementById('avsnitt-ov-punkter').open = true; });
        await page.waitForTimeout(300);
        await page.click('#avsnitt-ov-punkter .act-cb');
        await page.waitForTimeout(400);
        ok(await page.evaluate(() => document.getElementById('avsnitt-ov-punkter').open && /^1 av \d+ hanterade$/.test(document.getElementById('nyckel-ov-punkter').textContent)), 'en avbockad punkt syns i avsnittets rubrik, och listan står kvar utfälld');
        await page.click('#avsnitt-ov-punkter .act-cb');
        await page.waitForTimeout(300);
    }
}

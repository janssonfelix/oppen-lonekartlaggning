// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
// Webbläsar-röktestet, del: Diagramkärnan (ADR-39): exportmenyn, övergångar, ritning och export.
// Körs av tools/browser-smoke.mjs i samma ordning som kontrollerna alltid har körts.
import { readFileSync, writeFileSync, mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { NAMN, BILDER, KAN_LASA_URKLIPP, ok, browser, page } from './rigg.mjs';

// Exportmenyn, punktsvärm och övergångar, diagramkärnans ritning och export.
export async function diagramkarnan() {
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
        const krav = await page.evaluate(() => { const el = document.getElementById('chart-likvardighet-krav'); return { punkter: el ? el.querySelectorAll('[data-marke="punkt"]').length : 0, linje: el ? el.querySelectorAll('path[data-marke="linje"]').length : 0, not: (document.getElementById('lv-krav-not') || {}).textContent || '', k: window.kTroskel() }; });
        // Noten nämner gruppstorleken bara när den är större än en person (steg A: aldrig "minst 1 personer").
        const kravNot = krav.k > 1 ? new RegExp(`minst ${krav.k} personer`).test(krav.not) : !/minst \d+ person/.test(krav.not);
        ok(krav.punkter >= 3 && krav.linje === 1 && kravNot && /Punktens storlek/.test(krav.not), `Likvärdigt arbete ritar krav mot lön (${krav.punkter} yrkesgrupper, minsta gruppstorlek ${krav.k})`);
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
}

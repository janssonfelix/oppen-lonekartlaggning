// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
// Webbläsar-röktestet, del: Utseendet: radbrytning, klippning, kontrast och smala skärmar.
// Körs av tools/browser-smoke.mjs i samma ordning som kontrollerna alltid har körts.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { FIL, ROOT, ok, browser, page, oppnaFlik, flikar } from './rigg.mjs';

// Tal på en rad, noter som inte klipps, sidhuvud, kontrast, tabellernas höjd och utskrift av fliken.
export async function utseende() {
    console.log('\n── Tal står på en rad ──');
    {
        // Ett tal med sin enhet får inte brytas («−4,4» på en rad och «%» på nästa). Raderna räknas ur textens rutor.
        const rader = sel => page.evaluate(sel => [...document.querySelectorAll(sel)].filter(el => el.getBoundingClientRect().height > 0).map(el => {
            const r = document.createRange(); r.selectNodeContents(el);
            return { text: el.textContent.trim(), rader: new Set([...r.getClientRects()].filter(q => q.width > 0).map(q => Math.round(q.top))).size };
        }), sel);
        for (const bredd of [1440, 1100]) {
            await page.setViewportSize({ width: bredd, height: 900 });
            await oppnaFlik(page, '.nav-item[data-tab="struktur"]');
            await page.evaluate(() => document.querySelectorAll('.view-panel details.avsnitt').forEach(d => { d.open = true; }));
            await page.waitForTimeout(300);
            const hero = await rader('.reg-hero .hero-number');
            ok(hero.length > 0 && hero.every(h => h.rader === 1), `${bredd} punkter: regressionskortets tal står på en rad (${hero.map(h => h.text).join(', ')})`);
            await oppnaFlik(page, '.nav-item[data-tab="prioritering"]');
            await page.evaluate(() => document.querySelectorAll('.view-panel details.avsnitt').forEach(d => { d.open = true; }));
            await page.waitForTimeout(300);
            const celler = await rader('#prio-table .cell-bar-value');
            const brutna = celler.filter(c => c.rader !== 1);
            ok(celler.length > 0 && !brutna.length, `${bredd} punkter: Prioriteringens ${celler.length} procenttal står på en rad${brutna.length ? ' — brutna: ' + brutna.slice(0, 3).map(c => c.text).join(', ') : ''}`);
        }
        await page.setViewportSize({ width: 1400, height: 1000 });
    }

    console.log('\n── Kolumnrubriker bryts inte mitt i ett ord ──');
    {
        // Vid 1 100 punkter (minsta stödda bredden) får en kolumnrubrik bara brytas mellan ord, inte inne i ett:
        // ingen rubrik har fler textrader än ord. Ett ord med bindestreck som bryts vid strecket («AID- / etikett»)
        // räknas som två ord. Raderna räknas ur textnodernas rutor, så en infoikon räknas inte. Stort demo, som har
        // par i Lägre krav, högre lön; ett belopp med «kr» i huvudområdena och Prioriteringen står på en rad.
        const s = await browser.newPage({ viewport: { width: 1100, height: 900 } });
        await s.goto('file://' + FIL);
        await s.click('#first-run-stort-demo');
        await s.waitForFunction(() => /stort demo/.test(document.getElementById('data-status')?.textContent || '') && !!document.querySelector('#view-dashboard svg'), null, { timeout: 30000 });
        const oppnaStortFlik = async flik => {
            await oppnaFlik(s, `.nav-item[data-tab="${flik}"]`);
            await s.waitForTimeout(400);
            await s.evaluate(() => document.querySelectorAll('.view-panel details.avsnitt').forEach(d => { d.open = true; }));
            await s.waitForTimeout(300);
        };
        const rubriker = sel => s.evaluate(sel => [...document.querySelectorAll(sel)].filter(th => th.getBoundingClientRect().height > 0).map(th => {
            const text = th.textContent.replace(/\s+/g, ' ').trim();
            const toppar = new Set(), w = document.createTreeWalker(th, NodeFilter.SHOW_TEXT);
            for (let n = w.nextNode(); n; n = w.nextNode()) {
                if (!n.textContent.trim()) continue;
                const r = document.createRange(); r.selectNodeContents(n);
                for (const q of r.getClientRects()) if (q.width > 0) toppar.add(Math.round(q.top));
            }
            return { text, ord: text.split(/[\s-]+/).filter(Boolean).length, rader: toppar.size };
        }).filter(r => r.text), sel);
        const rader = sel => s.evaluate(sel => [...document.querySelectorAll(sel)].filter(el => el.getBoundingClientRect().height > 0).map(el => {
            const r = document.createRange(); r.selectNodeContents(el);
            return { text: el.textContent.trim(), rader: new Set([...r.getClientRects()].filter(q => q.width > 0).map(q => Math.round(q.top))).size };
        }), sel);
        for (const [flik, namn, sel] of [['handlingsplan', 'Handlingsplanen', '#view-handlingsplan table thead th'],
            ['benchmark', 'Löneläget mot statistiken', '#benchmark-table thead th'],
            ['likvardighet', 'Lägre krav, högre lön', '#likvardighet-lagre-krav-table thead th'],
            ['struktur', 'Per huvudområde', '#sektor-table thead th']]) {
            await oppnaStortFlik(flik);
            const r = await rubriker(sel), brutna = r.filter(x => x.rader > x.ord);
            ok(r.length > 0 && !brutna.length, `1100 punkter: ${namn}, ${r.length} kolumnrubriker bryts bara mellan ord${brutna.length ? ' — brutna: ' + brutna.slice(0, 3).map(x => `«${x.text}» (${x.ord} ord, ${x.rader} rader)`).join(', ') : ''}`);
            if (flik === 'struktur') {
                const kr = (await rader('#sektor-table tbody td')).filter(c => /\d\s*kr$/.test(c.text)), isar = kr.filter(c => c.rader !== 1);
                ok(kr.length > 0 && !isar.length, `1100 punkter: huvudområdenas ${kr.length} belopp står på en rad med «kr»${isar.length ? ' — brutna: ' + isar.slice(0, 3).map(c => c.text).join(', ') : ''}`);
            }
        }
        await oppnaStortFlik('prioritering');
        const kr = (await rader('#prio-table tbody td')).filter(c => /\d\s*kr$/.test(c.text)), isar = kr.filter(c => c.rader !== 1);
        ok(kr.length > 0 && !isar.length, `1100 punkter: Prioriteringens ${kr.length} belopp står på en rad med «kr»${isar.length ? ' — brutna: ' + isar.slice(0, 3).map(c => c.text).join(', ') : ''}`);
        // Prioriteringens tabellhuvud står över sina kolumner: de fasta kolumnerna (Prio, AID-etikett) förskjuts inte.
        const fel = await s.evaluate(() => { const t = document.getElementById('prio-table'), syns = e => e.getBoundingClientRect().width > 0;
            const th = [...t.querySelectorAll('thead th')].filter(syns), td = [...t.querySelector('tbody tr').children].filter(syns);
            return th.map((h, i) => ({ kol: h.textContent.trim(), dv: Math.abs(h.getBoundingClientRect().left - td[i].getBoundingClientRect().left), dh: Math.abs(h.getBoundingClientRect().right - td[i].getBoundingClientRect().right) }))
                .filter(x => x.dv > 1 || x.dh > 1); });
        ok(!fel.length, `1100 punkter: Prioriteringens kolumnrubriker står över sina kolumner${fel.length ? ' — förskjutna: ' + fel.map(x => x.kol).join(', ') : ''}`);
        // Infoikonen i en kolumnrubrik står på samma rad som rubrikens sista ord.
        const ensam = [];
        for (const [flik, tabell] of [['prioritering', 'prio-table'], ['utforska', 'rapport-table']]) {
            await oppnaStortFlik(flik);
            ensam.push(...await s.evaluate(id => [...document.querySelectorAll(`#${id} thead th`)].filter(th => th.getBoundingClientRect().width > 0 && th.querySelector('.info-tip')).filter(th => {
                const ikon = th.querySelector('.info-tip').getBoundingClientRect(), r = document.createRange();
                r.selectNodeContents(th);
                const text = [...r.getClientRects()].filter(q => q.width > 0 && q.height > 0 && q.right <= ikon.left + 1);
                const sista = text.reduce((a, q) => (q.top > a.top ? q : a), text[0]);
                return !sista || ikon.top >= sista.bottom - 1 || ikon.bottom <= sista.top + 1;
            }).map(th => `#${id} «${th.textContent.replace(/\s+/g, ' ').trim()}»`), tabell));
        }
        ok(!ensam.length, `1100 punkter: infoikonerna i Prioriteringens och Löneöversiktens rubriker står på samma rad som sista ordet${ensam.length ? ' — ensamma: ' + ensam.join(', ') : ''}`);
        // Under 1 100 punkter: det stora demots långa namn gjorde Löneläget bredare än fönstret (listrutan för
        // huvudområde), och punktetiketter vid diagrammets kant klipptes (avvikelsen mot statistiken, Krav mot lön).
        for (const bredd of [1100, 900]) {
            await s.setViewportSize({ width: bredd, height: 900 });
            const bred = [], klippta = [];
            for (const flik of ['likvardighet', 'struktur', 'benchmark', 'loneoversyn']) {
                await oppnaStortFlik(flik);
                const m = await s.evaluate(() => {
                    const mc = document.getElementById('main-content');
                    const klippt = [...document.querySelectorAll('.view-panel text[data-marke="punktetikett"]')].filter(t => {
                        const q = t.getBoundingClientRect(), sv = t.ownerSVGElement.getBoundingClientRect();
                        return q.width > 0 && (q.left < sv.left - 1 || q.right > sv.right + 1);
                    }).map(t => `${t.closest('[id]')?.id} «${t.textContent.slice(0, 20)}»`);
                    return { over: Math.max(document.documentElement.scrollWidth - document.documentElement.clientWidth, mc.scrollWidth - mc.clientWidth), klippt };
                });
                if (m.over > 1) bred.push(`${flik} +${m.over}`);
                klippta.push(...m.klippt);
            }
            ok(!bred.length, `${bredd} punkter, stort demo: ingen flik är bredare än fönstret${bred.length ? ' — ' + bred.join(', ') : ''}`);
            ok(!klippta.length, `${bredd} punkter, stort demo: ingen punktetikett går utanför sitt diagram${klippta.length ? ' — ' + klippta.slice(0, 4).join(', ') : ''}`);
        }
        await s.close();
        // Sökfältets platshållare ryms i fältet på de bredder verktyget är gjort för. Mellan 1 101 och 1 365 punkter, med
        // den utfällda sidomenyn, går rubriken och raden om lokal bearbetning före: där är sökfältet
        // minst 80 punkter brett, och att det inte ligger över rubriken prövas i avsnittet om sidhuvudet nedan.
        for (const bredd of [1100, 1280, 1440]) {
            await page.setViewportSize({ width: bredd, height: 900 });
            const sok = await page.evaluate(() => { const i = document.getElementById('sok-grupp'), cs = getComputedStyle(i), c = document.createElement('canvas').getContext('2d');
                c.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
                return { text: i.placeholder, bredd: Math.ceil(c.measureText(i.placeholder).width), plats: Math.floor(i.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight)),
                    falt: Math.round(document.getElementById('sok-ruta').getBoundingClientRect().width) }; });
            if (bredd > 1100 && bredd <= 1365) ok(sok.falt >= 80, `${bredd} punkter: sökfältet är minst 80 punkter brett (${sok.falt})`);
            else ok(sok.bredd <= sok.plats, `${bredd} punkter: sökfältets platshållare «${sok.text}» ryms (${sok.bredd} av ${sok.plats} punkter)`);
        }
        await page.setViewportSize({ width: 1400, height: 1000 });
    }

    console.log('\n── Inget klipps i cellerna vid 1 280 punkter ──');
    {
        // Tabellerna får rulla i sidled (underhållarens beslut 2026-11-15), men inget tal, märke eller etikett klipps
        // inne i sin cell. Hur bred en tabell blir beror på systemets typsnitt, som skiljer mellan maskinerna, så
        // bredden prövas inte. Både demo och stort demo: Lägre krav, högre lön ritas bara med det stora demot, och de
        // långa etikettnamnen finns bara där.
        const TABELLER = [['matrix', ['#aidbas-lika-tabell']],
            ['likvardighet', ['#likvardighet-table', '#likvardighet-lagre-krav-table', '#aidbas-likvardigt-tabell']],
            ['struktur', ['#sektor-table', '#la-oversikt']], ['prioritering', ['#prio-table']]];
        const s = await browser.newPage({ viewport: { width: 1280, height: 900 } });
        await s.goto('file://' + FIL);
        await s.click('#first-run-stort-demo');
        await s.waitForFunction(() => /stort demo/.test(document.getElementById('data-status')?.textContent || '') && !!document.querySelector('#view-dashboard svg'), null, { timeout: 30000 });
        await page.setViewportSize({ width: 1280, height: 900 });
        const ritade = new Set();
        for (const [underlag, sida] of [['demo', page], ['stort demo', s]]) {
            for (const [flik, valjare] of TABELLER) {
                await oppnaFlik(sida, `.nav-item[data-tab="${flik}"]`);
                await sida.waitForTimeout(400);
                await sida.evaluate(() => {
                    document.querySelectorAll('.view-panel details.avsnitt').forEach(d => { d.open = true; });
                    document.querySelectorAll('[data-fler-kolumner][aria-pressed="true"]').forEach(b => /** @type {HTMLElement} */ (b).click());
                });
                await sida.waitForTimeout(300);
                for (const id of valjare) {
                    const k = await sida.evaluate(id => {
                        const t = document.querySelector(id);
                        if (!t || !t.getBoundingClientRect().width) return null;
                        const celler = [...t.querySelectorAll('tbody td')].filter(td => td.getBoundingClientRect().width > 0);
                        const klippta = celler.flatMap(td => [td, ...td.querySelectorAll('*')]).filter(el => el.clientWidth > 0 && el.scrollWidth > el.clientWidth + 1 && /\S/.test(el.textContent))
                            .map(el => el.textContent.replace(/\s+/g, ' ').trim());
                        return { antal: celler.length, klippta: [...new Set(klippta)] };
                    }, id);
                    if (k?.antal) ritade.add(id);
                    if (k) ok(k.antal > 0 && !k.klippta.length, `1280 punkter, ${underlag}: inget klipps i cellerna i ${id} (${k.antal} celler)${k.klippta.length ? ' — klippta: ' + k.klippta.slice(0, 3).map(t => `«${t}»`).join(', ') : ''}`);
                }
            }
        }
        const alla = TABELLER.flatMap(([, v]) => v);
        const saknas = alla.filter(v => !ritade.has(v));
        ok(!saknas.length, `1280 punkter: alla ${alla.length} tabeller ritas med demo eller stort demo${saknas.length ? ' — saknas: ' + saknas.join(', ') : ''}`);
        await s.close();
        await page.setViewportSize({ width: 1400, height: 1000 });
    }

    console.log('\n── Noten om små grupper klipps inte i en bred tabell ──');
    {
        await page.setViewportSize({ width: 1440, height: 900 });
        await oppnaFlik(page, '.nav-item[data-tab="utforska"]');
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
        await oppnaFlik(page, '.nav-item[data-tab="handlingsplan"]');
        await page.waitForTimeout(200);
        const hojd = () => page.evaluate(() => [...document.querySelectorAll('#handlingsplan-tbody tr.handlingsplan-empty')].map(tr => tr.getBoundingClientRect().height));
        const skarm = await hojd();
        ok(skarm.length >= 5 && skarm.every(h => h === 0), `de ${skarm.length} tomma raderna ritas inte på skärmen`);
        await page.emulateMedia({ media: 'print' });
        ok((await hojd()).every(h => h > 0), 'på utskriften finns raderna att fylla i');
        await page.emulateMedia({ media: 'screen' });
    }

    console.log('\n── Handlingsplanen ryms utan sidledsrullning ──');
    {
        // Mallen var 1 577 punkter bred i en ruta på 1 030 vid 1440, och fälten man fyller i låg utanför bild. På
        // skärmen står grupp, antal berörda och underlag under åtgärden; utskriften (Ctrl+P) har dem som egna kolumner.
        // Lilla demot i en egen sida, så att tidigare delar av röktestet inte påverkar raderna.
        const s = await browser.newPage({ viewport: { width: 1440, height: 900 } });
        await s.goto('file://' + FIL);
        await s.waitForFunction(() => typeof window.lasInDemodata === 'function', null, { timeout: 15000 });
        await s.evaluate(() => lasInDemodata());   /* global lasInDemodata -- global i sidan */
        await s.waitForFunction(() => !!document.querySelector('#view-dashboard svg'), null, { timeout: 30000 });
        await oppnaFlik(s, '.nav-item[data-tab="handlingsplan"]');
        await s.waitForSelector('#handlingsplan-tbody tr.handlingsplan-seeded', { timeout: 15000 });
        const matt = () => s.evaluate(() => { const c = document.getElementById('handlingsplan-tbody').closest('.table-container');
            return { scrollWidth: c.scrollWidth, clientWidth: c.clientWidth }; });
        for (const bredd of [1280, 1440]) {
            await s.setViewportSize({ width: bredd, height: 900 });
            await s.waitForTimeout(200);
            const m = await matt();
            ok(m.scrollWidth <= m.clientWidth, `${bredd} punkter: handlingsplanens tabell ryms i sin ruta (scrollWidth ${m.scrollWidth}, clientWidth ${m.clientWidth})`);
        }
        // innerText, inte textContent: det som är dolt (skärmens «och grupp» på utskriften) räknas inte. Rubrikerna
        // har versaler i stilmallen, och innerText följer den; jämförelsen görs med gemener.
        const kolumner = () => s.evaluate(() => [...document.getElementById('handlingsplan-tbody').closest('table').querySelectorAll('thead th')]
            .filter(th => th.getBoundingClientRect().width > 0).map(th => th.innerText.replace(/\s+/g, ' ').trim().toLowerCase()));
        const skarm = await kolumner();
        ok(skarm.length === 7 && skarm[0] === 'åtgärd och grupp', `på skärmen sju kolumner, den första «Åtgärd och grupp» (${skarm.join(' | ')})`);
        await s.emulateMedia({ media: 'print' });
        const utskrift = await kolumner();
        ok(utskrift.length === 10 && utskrift[0] === 'åtgärd' && utskrift.slice(1, 4).join('|') === 'grupp (aid-etikett och bas-intervall)|antal berörda|underlag',
            `på utskriften tio kolumner som förut (${utskrift.join(' | ')})`);
        ok(await s.evaluate(() => [...document.querySelectorAll('#handlingsplan-tbody .hp-under')].every(el => el.getBoundingClientRect().height === 0)),
            'på utskriften står inte skärmens undertext under åtgärden');
        await s.close();
    }

    console.log('\n── Sidhuvudet är lika högt på alla flikar ──');
    {
        for (const bredd of [1440, 1100, 1024]) {
            await page.setViewportSize({ width: bredd, height: 900 });
            const hojder = {};
            for (const flik of await flikar(page)) {
                await oppnaFlik(page, `.nav-item[data-tab="${flik}"]`);
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

    console.log('\n── Sidhuvudet med den utfällda sidomenyn: inget överlapp, raden om lokal bearbetning hel ──');
    {
        // Med den utfällda sidomenyn låg sökfältet över slutet av rubriken och över «Vad lagras?». Ordningen
        // när kraven krockar: inget överlapp, «bearbetas lokalt» syns, sökfältets platshållare ryms.
        for (const bredd of [1101, 1280, 1365]) {
            await page.setViewportSize({ width: bredd, height: 900 });
            const over = [], utanfor = [];
            let antal = 0, sidomeny = 0;
            for (const flik of await flikar(page)) {
                await oppnaFlik(page, `.nav-item[data-tab="${flik}"]`);
                const m = await page.evaluate(() => {
                    const h1 = document.getElementById('page-title'), rng = document.createRange(); rng.selectNodeContents(h1);
                    const sok = document.getElementById('sok-ruta').getBoundingClientRect();
                    const kolliderar = r => r.width > 0 && sok.width > 0 && r.left < sok.right - 1 && r.right > sok.left + 1 && r.top < sok.bottom - 1 && r.bottom > sok.top + 1;
                    const hdr = document.querySelector('.top-header'), kant = hdr.getBoundingClientRect().right - parseFloat(getComputedStyle(hdr).paddingRight);
                    return { titel: h1.textContent.trim(), rubrik: kolliderar(rng.getBoundingClientRect()), vadLagras: kolliderar(document.getElementById('btn-data-residency').getBoundingClientRect()),
                        utanfor: document.querySelector('.header-knappar').getBoundingClientRect().right > kant + 1,
                        sidomeny: Math.round(document.querySelector('.sidebar').getBoundingClientRect().width) };
                });
                antal++; sidomeny = Math.max(sidomeny, m.sidomeny);
                if (m.rubrik || m.vadLagras) over.push(`${m.titel}${m.rubrik ? ' (rubriken)' : ''}${m.vadLagras ? ' (Vad lagras?)' : ''}`);
                if (m.utanfor) utanfor.push(m.titel);
            }
            ok(sidomeny > 200, `${bredd} punkter: sidomenyn är utfälld (${sidomeny} punkter)`);
            ok(!over.length, `${bredd} punkter: sökfältet ligger inte över rubriken eller «Vad lagras?» på någon av ${antal} flikar${over.length ? ' — ' + over.join(', ') : ''}`);
            ok(!utanfor.length, `${bredd} punkter: knapparna står inom sidhuvudet på alla ${antal} flikar${utanfor.length ? ' — ' + utanfor.join(', ') : ''}`);
        }
        await page.setViewportSize({ width: 1280, height: 900 });
        const lokalt = await page.evaluate(() => {
            const el = document.querySelector('#gdpr-banner .gdpr-banner-lokalt'), r = el.getBoundingClientRect(), b = document.getElementById('gdpr-banner').getBoundingClientRect(), cs = getComputedStyle(el);
            return { bredd: Math.round(r.width), inom: r.left >= b.left - 1 && r.right <= b.right + 1, klippt: cs.clipPath !== 'none' || cs.clip !== 'auto' || cs.position === 'absolute', text: el.textContent.trim() };
        });
        ok(lokalt.bredd > 0 && lokalt.inom && !lokalt.klippt, `1280 punkter: «${lokalt.text}» syns i raden om lokal bearbetning (${lokalt.bredd} punkter)`);
        await page.setViewportSize({ width: 1400, height: 1000 });
    }

    console.log('\n── Att göra: märket står på en egen rad ──');
    {
        // Märket stod ibland på rubrikens rad och ibland ovanför, efter rubrikens längd.
        await page.setViewportSize({ width: 1280, height: 900 });
        await oppnaFlik(page, '.nav-item[data-tab="dashboard"]');
        await page.waitForTimeout(200);
        const m = await page.evaluate(() => [...document.querySelectorAll('#action-checklist-container .ag-prio')].filter(p => p.getBoundingClientRect().height > 0)
            .map(p => { const t = p.parentElement.querySelector('strong'); return p.getBoundingClientRect().bottom <= t.getBoundingClientRect().top + 1; }));
        ok(m.length > 0 && m.every(Boolean), `märket står ovanför rubriken i alla ${m.length} synliga punkter i Att göra`);
        await page.setViewportSize({ width: 1400, height: 1000 });
    }

    console.log('\n── Klickmålen i Översikten är minst 24 punkter ──');
    {
        // WCAG 2.2, 2.5.8: en knapp eller fristående länk är minst 24 × 24 punkter. En länk i löptext (p, li, td) är
        // undantagen. Lilla demot i Översikten vid 1 024 punkter: sidhuvud, demoraden, urvalsraden, Att göra och
        // processkartan. Större mål får inte bryta sidhuvudet: knapparna står på en rad och raden om lokal bearbetning
        // på en rad under rubriken.
        const s = await browser.newPage({ viewport: { width: 1024, height: 768 } });
        await s.goto('file://' + FIL + '?demo=1');
        await s.waitForFunction(() => document.getElementById('demo-mode-banner')?.style.display === 'flex' && !!document.querySelector('#view-dashboard svg'), null, { timeout: 15000 });
        await s.waitForTimeout(300);
        const m = await s.evaluate(() => {
            const syns = el => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden'; };
            const mal = [...document.querySelectorAll('button, a[href]')].filter(el => syns(el) && !el.closest('p, li, td'));
            const sma = mal.map(el => ({ el, r: el.getBoundingClientRect() })).filter(x => x.r.width < 24 || x.r.height < 24)
                .map(x => `«${x.el.textContent.replace(/\s+/g, ' ').trim()}» ${Math.round(x.r.width)}×${Math.round(x.r.height)}`);
            const knappar = [...document.querySelectorAll('.header-knappar > *')].filter(syns).map(el => el.getBoundingClientRect());
            const b = document.getElementById('gdpr-banner');
            return { antal: mal.length, sma: [...new Set(sma)], bricka: Math.round(b.getBoundingClientRect().height),
                enRad: knappar.length > 0 && Math.max(...knappar.map(r => r.top)) < Math.min(...knappar.map(r => r.bottom)),
                under: b.getBoundingClientRect().top >= document.getElementById('page-title').getBoundingClientRect().bottom - 1 };
        });
        ok(m.antal > 0 && !m.sma.length, `1024 punkter: Översiktens ${m.antal} knappar och länkar är minst 24 × 24 punkter${m.sma.length ? ' — för små: ' + m.sma.join(', ') : ''}`);
        ok(m.enRad && m.under && m.bricka < 34, `1024 punkter: sidhuvudets knappar står på en rad och statusbrickan på en rad under rubriken (${m.bricka} punkter hög)`);
        await s.close();
    }

    console.log('\n── Nyckeltalens förklaring klipps inte ──');
    {
        await page.setViewportSize({ width: 1440, height: 900 });
        const klippta = [];
        let antal = 0;
        for (const flik of ['dashboard', 'matrix', 'likvardighet', 'struktur', 'prioritering', 'loneoversyn', 'dokumentera', 'kon', 'benchmark']) {
            await oppnaFlik(page, `.nav-item[data-tab="${flik}"]`);
            await page.waitForTimeout(250);
            const r = await page.evaluate(() => [...document.querySelectorAll('.slutsats-under, .stat-under, .stat-tip')].filter(e => e.getBoundingClientRect().height > 0)
                .map(e => ({ text: e.textContent.trim(), klippt: e.scrollWidth > e.clientWidth + 1 || e.scrollHeight > e.clientHeight + 1, langd: e.textContent.trim().length })));
            antal += r.length;
            klippta.push(...r.filter(o => o.klippt).map(o => `${flik}: ${o.text.slice(0, 50)} (${o.langd} tecken)`));
        }
        ok(antal > 20 && !klippta.length, `1440 punkter: ingen av ${antal} förklaringar under nyckeltalen klipps${klippta.length ? ' — ' + klippta.slice(0, 4).join(' | ') : ''}`);
        await page.setViewportSize({ width: 1400, height: 1000 });
    }

    console.log('\n── Samma mått med ett bredare teckensnitt ──');
    {
        // CI:s Ubuntu ritar med DejaVu Sans, som är bredare än Fedoras standardteckensnitt: BAS-tabellen och en förklaring
        // under nyckeltalen klipptes bara där. Här mäts de med DejaVu Sans påtvingat (egen kontext utan CSP för stilen).
        const ctx = await browser.newContext({ bypassCSP: true, viewport: { width: 1400, height: 1000 } });
        const s = await ctx.newPage();
        await s.goto('file://' + FIL + '?demo=1');
        await s.waitForFunction(() => document.getElementById('demo-mode-banner')?.style.display === 'flex', null, { timeout: 15000 });
        const finns = await s.evaluate(() => { const c = document.createElement('canvas').getContext('2d'), t = 'Kvinnors lön i % av mäns';
            return ['monospace', 'serif'].some(f => { c.font = `16px ${f}`; const a = c.measureText(t).width; c.font = `16px 'DejaVu Sans', ${f}`; return c.measureText(t).width !== a; }); });
        if (!finns) console.log('  – DejaVu Sans finns inte på maskinen; kontrollen hoppas över');
        else {
            await s.addStyleTag({ content: "* { font-family: 'DejaVu Sans', sans-serif !important; }" });
            await s.waitForTimeout(1000);
            await oppnaFlik(s, '.nav-item[data-tab="struktur"]');
            await s.evaluate(() => { document.getElementById('avsnitt-ls-bas').open = true; });
            await s.waitForTimeout(700);
            const bas = await s.evaluate(() => { const c = document.querySelector('#la-huvuddiagram .table-container'); return { sw: c.scrollWidth, cw: c.clientWidth }; });
            ok(bas.sw <= bas.cw + 1, `DejaVu Sans, 1400 punkter: BAS-tabellen ryms i sitt kort (${bas.sw} av ${bas.cw} punkter)`);
            await s.setViewportSize({ width: 1440, height: 900 });
            const klippta = [];
            for (const flik of ['dashboard', 'matrix', 'likvardighet', 'struktur', 'prioritering', 'loneoversyn', 'dokumentera', 'kon', 'benchmark']) {
                await oppnaFlik(s, `.nav-item[data-tab="${flik}"]`);
                await s.waitForTimeout(250);
                klippta.push(...await s.evaluate(f => [...document.querySelectorAll('.slutsats-under, .stat-under, .stat-tip')].filter(e => e.getBoundingClientRect().height > 0)
                    .filter(e => e.scrollWidth > e.clientWidth + 1 || e.scrollHeight > e.clientHeight + 1).map(e => `${f}: ${e.textContent.trim().slice(0, 50)}`), flik));
            }
            ok(!klippta.length, `DejaVu Sans, 1440 punkter: ingen förklaring under nyckeltalen klipps${klippta.length ? ' — ' + klippta.slice(0, 4).join(' | ') : ''}`);
        }
        await ctx.close();
    }

    console.log('\n── Kontrast och modalens läge ──');
    {
        await page.setViewportSize({ width: 1440, height: 900 });
        await oppnaFlik(page, '.nav-item[data-tab="dashboard"]');
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
        await oppnaFlik(page, '.nav-item[data-tab="utforska"]');
        await page.waitForTimeout(300);
        await lagst('#rapport-table thead th', 'Löneöversiktens tabellhuvud');
        await oppnaFlik(page, '.nav-item[data-tab="likvardighet"]');
        await page.evaluate(() => document.querySelectorAll('.view-panel details.avsnitt').forEach(d => { d.open = true; }));
        await page.waitForTimeout(300);
        await lagst('.lv-hjalp, .lv-hjalp p, .lv-hjalp li, .lv-hjalp span, .lv-hjalp strong', 'hjälprutan i Likvärdigt arbete');
        // «Vad lagras?» öppnas mitt i fönstret, som Inställningar.
        await page.click('#btn-data-residency');
        await page.waitForTimeout(250);
        const m = await page.evaluate(() => { const r = document.querySelector('#data-residency-modal .glossary-panel').getBoundingClientRect(); return { mitt: Math.round(r.left + r.width / 2), topp: Math.round(r.top), bredd: innerWidth }; });
        ok(Math.abs(m.mitt - m.bredd / 2) <= 2 && m.topp > 20, `«Vad lagras?» är centrerad (mitt ${m.mitt} av ${m.bredd}, topp ${m.topp})`);
        await page.click('#data-residency-close');
        await page.setViewportSize({ width: 1400, height: 1000 });
    }

    console.log('\n── Löneöversikten ryms i sitt kort ──');
    {
        await page.setViewportSize({ width: 1440, height: 900 });
        await oppnaFlik(page, '.nav-item[data-tab="utforska"]');
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
            await oppnaFlik(page, '.nav-item[data-tab="likvardighet"]');
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
        await oppnaFlik(page, '.nav-item[data-tab="matrix"]');
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
        await oppnaFlik(page, '.nav-item[data-tab="matrix"]');
        await page.waitForTimeout(300);
        const stangda = await page.evaluate(() => [...document.querySelectorAll('#view-lika-yrken details.avsnitt, #view-skevhet details.avsnitt, #view-regression details.avsnitt')].map(d => d.open));
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
            [...document.querySelectorAll('#view-lika-yrken details.avsnitt, #view-skevhet details.avsnitt, #view-regression details.avsnitt')].forEach((d, i) => { d.open = stangda[i]; }); }, stangda);
    }
}

// Byggets förminskning av stilmallen och smala skärmar.
export async function smalaSkarmar() {
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

    console.log('\n── Smalt fönster: 1440×800, 900 punkter och menyn bakom knappen ──');
    {
        // Verktyget är gjort för datorskärm (ADR-82): ett smalt fönster på datorn ska fungera, med menyn ihopfälld och
        // utan att sidan går utanför fönstret.
        const oppna = async (bredd, hojd) => { const s = await browser.newPage({ viewport: { width: bredd, height: hojd } });
            await s.goto('file://' + FIL + '?demo=1');
            await s.waitForFunction(() => document.getElementById('demo-mode-banner')?.style.display === 'flex', null, { timeout: 30000 });
            await s.waitForTimeout(1500); return s; };
        // Ingen flik får bli bredare än fönstret, med alla avsnitt utfällda: det som inte ryms rullar inom sitt eget kort.
        const forBred = async s => { const ut = [];
            for (const f of await flikar(s)) {
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

        s = await oppna(900, 1000);
        const rad = await s.evaluate(() => { const m = document.querySelector('.sidebar'), e = document.querySelector('.nav-item.active .nav-etikett');
            return { bredd: Math.round(m.getBoundingClientRect().width), etikett: getComputedStyle(e).opacity, synlighet: getComputedStyle(e).visibility, knapp: getComputedStyle(document.getElementById('btn-meny')).display,
                namn: [...document.querySelectorAll('.nav-item:not([hidden])')].every(k => k.textContent.trim().length > 2) }; });
        ok(rad.bredd === 60 && rad.etikett === '0' && rad.synlighet === 'visible' && rad.knapp === 'none' && rad.namn, '900 punkter: menyn är fälld till en smal list med ikoner, och varje knapp har kvar sitt namn');
        await s.hover('.nav-item[data-tab="prioritering"]');
        await s.waitForTimeout(200);
        ok(await s.evaluate(() => { const e = document.querySelector('.nav-item[data-tab="prioritering"] .nav-etikett'), r = e.getBoundingClientRect(); return getComputedStyle(e).opacity === '1' && r.left >= 60 && r.width > 40; }), '900 punkter: etiketten visas bredvid ikonen vid pekaren');
        bred = await forBred(s);
        ok(bred.length === 0, `900 punkter: ingen flik är bredare än fönstret${bred.length ? ' — ' + bred.join(', ') : ''}`);
        await s.evaluate(() => document.querySelector('.nav-item[data-tab="struktur"]').click());
        await s.waitForTimeout(600);
        await s.evaluate(() => { document.getElementById('avsnitt-st-sektorer').open = true; });
        await s.waitForTimeout(300);
        const tabell = await s.evaluate(() => { const t = document.getElementById('sektor-table'), yta = t.parentElement; yta.scrollLeft = 200;
            const c = t.querySelector('tbody td'), r = c.getBoundingClientRect(), y = yta.getBoundingClientRect();
            return { rullar: yta.scrollWidth > yta.clientWidth + 1, flyttad: yta.scrollLeft > 0, fast: Math.abs(r.left - y.left) < 2 }; });
        ok(tabell.rullar && tabell.flyttad && tabell.fast, '900 punkter: en bred tabell rullar inom sitt kort och första kolumnen står kvar');
        await s.close();

        // Under brytpunkten i stilmallen (den @media-regel som visar knappen Meny) ligger menyn bakom knappen.
        const brytpunkt = Number(/@media \(max-width: (\d+)px\) \{\s*\.btn\.meny-knapp \{ display: inline-flex/.exec(readFileSync(join(ROOT, 'src', 'style.css'), 'utf8'))[1]);
        s = await oppna(brytpunkt, 900);
        const menyLage = () => s.evaluate(() => { const m = document.querySelector('.sidebar'), r = m.getBoundingClientRect();
            return { synlig: getComputedStyle(m).visibility === 'visible' && r.right > 0 && r.left >= 0, utfalld: document.getElementById('btn-meny').getAttribute('aria-expanded') }; });
        const knapp = await s.evaluate(() => { const r = document.getElementById('btn-meny').getBoundingClientRect(); return r.width > 0 && r.right <= innerWidth; });
        const fore = await menyLage();
        ok(knapp && !fore.synlig && fore.utfalld === 'false', `${brytpunkt} punkter: knappen Meny syns och menyn är dold`);
        await s.click('#btn-meny');
        await s.waitForTimeout(400);
        const oppen = await menyLage();
        ok(oppen.synlig && oppen.utfalld === 'true', `${brytpunkt} punkter: ett tryck på Meny visar menyn`);
        await oppnaFlik(s, '.nav-item[data-tab="struktur"]');
        await s.waitForTimeout(400);
        const vald = await s.evaluate(() => ({ flik: document.querySelector('.nav-item.active')?.getAttribute('data-tab'), panel: document.getElementById('view-struktur').getBoundingClientRect().height > 0 }));
        const efter = await menyLage();
        ok(vald.flik === 'struktur' && vald.panel && !efter.synlig, `${brytpunkt} punkter: ett val i menyn öppnar fliken och fäller ihop menyn`);
        bred = await forBred(s);
        ok(bred.length === 0, `${brytpunkt} punkter: ingen flik är bredare än fönstret${bred.length ? ' — ' + bred.join(', ') : ''}`);
        await s.close();

        // Sidhuvudet vid 1 024 punkter: Förklaring, Som i exporten, Inställningar och Ordlista går att klicka och har sina namn.
        const KNAPPAR = ['btn-open-symbols', 'btn-forhandsvisa', 'btn-open-installningar', 'btn-open-glossary'];
        s = await oppna(1024, 812);
        const h = await s.evaluate(ids => ({ hojd: Math.round(document.querySelector('.top-header').getBoundingClientRect().height),
            sok: (() => { const r = document.getElementById('sok-grupp').getBoundingClientRect(); return r.width > 100 && r.right <= innerWidth; })(),
            namn: ids.map(id => { const b = document.getElementById(id); return (b.getAttribute('aria-label') || b.textContent).trim(); }) }), KNAPPAR);
        let klickbara = 0;
        for (const id of KNAPPAR) { try { await s.click('#' + id, { trial: true, timeout: 2000 }); klickbara++; } catch { /* räknas inte */ } }
        ok(h.hojd <= 110 && h.sok && klickbara === 4 && h.namn.every(n => n.length > 3),
            `1024 punkter: sidhuvudet är ${h.hojd} punkter högt (högst 110), sökfältet ryms och alla fyra knappar går att klicka`);
        await s.close();
    }
}

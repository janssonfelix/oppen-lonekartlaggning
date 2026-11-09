// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
// Webbläsar-röktestet, del: Utseendet: radbrytning, klippning, kontrast och smala skärmar.
// Körs av tools/browser-smoke.mjs i samma ordning som kontrollerna alltid har körts.
import { FIL, ok, browser, page } from './rigg.mjs';

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
            await page.click('.nav-item[data-tab="struktur"]');
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
            for (const flik of ['dashboard', 'bestammelser', 'matrix', 'likvardighet', 'struktur', 'prioritering', 'loneoversyn', 'handlingsplan', 'dokumentera', 'rapporttext', 'arbetet', 'kon', 'benchmark', 'utforska', 'info']) {
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

    console.log('\n── Samma mått med ett bredare teckensnitt ──');
    {
        // CI:s Ubuntu ritar med DejaVu Sans, som är bredare än Fedoras standardteckensnitt: BAS-tabellen och en förklaring
        // under nyckeltalen klipptes bara där. Här mäts de med DejaVu Sans påtvingat (egen kontext utan CSP för stilen).
        const ctx = await browser.newContext({ bypassCSP: true, viewport: { width: 1400, height: 1000 } });
        const s = await ctx.newPage();
        await s.goto('file://' + FIL + '?demo=1');
        await s.waitForFunction(() => document.getElementById('demo-mode-banner')?.style.display === 'flex', { timeout: 15000 });
        const finns = await s.evaluate(() => { const c = document.createElement('canvas').getContext('2d'), t = 'Kvinnors lön i % av mäns';
            return ['monospace', 'serif'].some(f => { c.font = `16px ${f}`; const a = c.measureText(t).width; c.font = `16px 'DejaVu Sans', ${f}`; return c.measureText(t).width !== a; }); });
        if (!finns) console.log('  – DejaVu Sans finns inte på maskinen; kontrollen hoppas över');
        else {
            await s.addStyleTag({ content: "* { font-family: 'DejaVu Sans', sans-serif !important; }" });
            await s.waitForTimeout(1000);
            await s.click('.nav-item[data-tab="struktur"]');
            await s.evaluate(() => { document.getElementById('avsnitt-ls-bas').open = true; });
            await s.waitForTimeout(700);
            const bas = await s.evaluate(() => { const c = document.querySelector('#la-huvuddiagram .table-container'); return { sw: c.scrollWidth, cw: c.clientWidth }; });
            ok(bas.sw <= bas.cw + 1, `DejaVu Sans, 1400 punkter: BAS-tabellen ryms i sitt kort (${bas.sw} av ${bas.cw} punkter)`);
            await s.setViewportSize({ width: 1440, height: 900 });
            const klippta = [];
            for (const flik of ['dashboard', 'matrix', 'likvardighet', 'struktur', 'prioritering', 'loneoversyn', 'dokumentera', 'kon', 'benchmark']) {
                await s.click(`.nav-item[data-tab="${flik}"]`);
                await s.waitForTimeout(250);
                klippta.push(...await s.evaluate(f => [...document.querySelectorAll('.slutsats-under, .stat-under, .stat-tip')].filter(e => e.getBoundingClientRect().height > 0)
                    .filter(e => e.scrollWidth > e.clientWidth + 1 || e.scrollHeight > e.clientHeight + 1).map(e => `${f}: ${e.textContent.trim().slice(0, 50)}`), flik));
            }
            ok(!klippta.length, `DejaVu Sans, 1440 punkter: ingen förklaring under nyckeltalen klipps${klippta.length ? ' — ' + klippta.slice(0, 4).join(' | ') : ''}`);
        }
        await ctx.close();
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

    console.log('\n── Smala skärmar: 1440×800, 768 och 390 punkter ──');
    {
        const FLIKAR = ['dashboard', 'bestammelser', 'matrix', 'likvardighet', 'struktur', 'prioritering', 'loneoversyn', 'handlingsplan', 'dokumentera', 'rapporttext', 'arbetet', 'kon', 'benchmark', 'utforska', 'info'];
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
            return { bredd: Math.round(m.getBoundingClientRect().width), etikett: getComputedStyle(e).opacity, synlighet: getComputedStyle(e).visibility, knapp: getComputedStyle(document.getElementById('btn-meny')).display,
                namn: [...document.querySelectorAll('.nav-item:not([hidden])')].every(k => k.textContent.trim().length > 2) }; });
        ok(rad.bredd === 60 && rad.etikett === '0' && rad.synlighet === 'visible' && rad.knapp === 'none' && rad.namn, '768 punkter: menyn är en rad med ikoner, och varje knapp har kvar sitt namn');
        await s.hover('.nav-item[data-tab="prioritering"]');
        await s.waitForTimeout(200);
        ok(await s.evaluate(() => { const e = document.querySelector('.nav-item[data-tab="prioritering"] .nav-etikett'), r = e.getBoundingClientRect(); return getComputedStyle(e).opacity === '1' && r.left >= 60 && r.width > 40; }), '768 punkter: etiketten visas bredvid ikonen vid pekaren');
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
        await s.click('.nav-item[data-tab="struktur"]');
        await s.waitForTimeout(900);
        ok(await s.evaluate(() => getComputedStyle(document.querySelector('.sidebar')).visibility === 'hidden' && document.getElementById('view-regression').style.display === 'block'), '390 punkter: ett val i menyn byter flik och stänger menyn');
        // Diagrammen ritar för den bredd de får: huvuddiagrammet ska fylla kortet och ha läsbar text.
        const dia = await s.evaluate(() => { const svg = document.querySelector('#view-regression svg[role="group"], #view-regression svg[role="img"]');
            if (!svg) return null; const r = svg.getBoundingClientRect(); const txt = [...svg.querySelectorAll('text')].map(t => t.getBoundingClientRect().height).filter(h => h > 0);
            return { bredd: Math.round(r.width), ryms: r.right <= innerWidth + 1, minst: txt.length ? Math.min(...txt) : 0 }; });
        ok(dia && dia.bredd >= 280 && dia.ryms && dia.minst >= 9, `390 punkter: huvuddiagrammet ryms och texten går att läsa (${dia ? `${dia.bredd} punkter brett, minsta text ${dia.minst.toFixed(1)}` : 'inget diagram'})`);
        bred = await forBred(s);
        ok(bred.length === 0, `390 punkter: ingen flik är bredare än fönstret${bred.length ? ' — ' + bred.join(', ') : ''}`);
        await s.close();

        // Sidhuvudet: under 641 punkter är Förklaring, Som i exporten, Inställningar och Ordlista ikonknappar på samma rad
        // som sökfältet, och knappen behåller sitt namn (texten är visuellt dold, inte borttagen).
        const KNAPPAR = ['btn-open-symbols', 'btn-forhandsvisa', 'btn-open-installningar', 'btn-open-glossary'];
        for (const [bredd, maxHojd] of [[375, 140], [640, 140], [641, 210], [1024, 110]]) {
            s = await oppna(bredd, 812);
            const h = await s.evaluate(ids => ({ hojd: Math.round(document.querySelector('.top-header').getBoundingClientRect().height),
                sok: (() => { const r = document.getElementById('sok-grupp').getBoundingClientRect(); return r.width > 100 && r.right <= innerWidth; })(),
                namn: ids.map(id => { const b = document.getElementById(id); return (b.getAttribute('aria-label') || b.textContent).trim(); }),
                rader: new Set(ids.map(id => Math.round(document.getElementById(id).getBoundingClientRect().top))).size }), KNAPPAR);
            let klickbara = 0;
            for (const id of KNAPPAR) { try { await s.click('#' + id, { trial: true, timeout: 2000 }); klickbara++; } catch { /* räknas inte */ } }
            const smal = bredd <= 640;
            ok(h.hojd <= maxHojd && h.sok && klickbara === 4 && h.namn.every(n => n.length > 3) && (!smal || h.rader === 1),
                `${bredd} punkter: sidhuvudet är ${h.hojd} punkter högt (högst ${maxHojd}), sökfältet ryms och alla fyra knappar går att klicka${smal ? ' på en rad' : ''}`);
            await s.close();
        }
        // Byter fönstret från brett till smalt medan sidan är öppen börjar den smala vyn med menyn stängd, utan att
        // spalten glider ut över innehållet; öppnar man menyn själv står den kvar.
        s = await oppna(1440, 812);
        await s.setViewportSize({ width: 375, height: 812 });
        // Spalten läggs om vid brytpunkten utan glidning, men layouten kan ligga en bildruta efter: vänta in den
        // (högst två sekunder) innan läget läses, i stället för att läsa mitt i ombrytningen.
        await s.waitForFunction(() => document.querySelector('.sidebar').getBoundingClientRect().right <= 0, null, { timeout: 2000 }).catch(() => {});
        const efterByte = await s.evaluate(() => { const m = document.querySelector('.sidebar'), r = m.getBoundingClientRect();
            return { oppen: document.body.classList.contains('meny-oppen'), utanfor: r.right <= 0, expanderad: document.getElementById('btn-meny').getAttribute('aria-expanded') }; });
        ok(!efterByte.oppen && efterByte.utanfor && efterByte.expanderad === 'false', '1440 → 375 punkter: menyn är stängd och ligger utanför bild direkt efter bytet');
        await s.click('#btn-meny');
        await s.setViewportSize({ width: 390, height: 700 });
        await s.waitForTimeout(300);
        ok(await s.evaluate(() => document.body.classList.contains('meny-oppen')), '375 → 390 punkter: en meny som användaren öppnat står kvar när bredden ändras inom den smala vyn');
        await s.close();
    }
}

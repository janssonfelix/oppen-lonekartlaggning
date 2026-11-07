// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
// Webbläsar-röktestet, del: Dialogerna: gruppdossiern, inställningarna, sök och BAS-dossiern.
// Körs av tools/browser-smoke.mjs i samma ordning som kontrollerna alltid har körts.
import { ok, page, osynlig } from './rigg.mjs';
/* global diagramMarkering, sattDiagramMarkering -- används i page.evaluate, där de finns i sidan */

// Gruppdossiern (modal).
export async function gruppdossier() {
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
}

// Minsta gruppstorlek för redovisning (ADR-38) i inställningarna.
export async function kTroskel() {
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
    ok(await page.evaluate(() => { const p = document.querySelector('#installningar-modal .glossary-panel').getBoundingClientRect(); return p.width > 300 && p.right <= innerWidth && document.querySelectorAll('#inst-flikar .inst-flik').length === 4; }), 'panelen ryms i fönstret och listar flikarnas egna inställningar');
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
    ok(await page.evaluate(() => !!document.getElementById('prio-cfg-atgard').offsetParent && !!document.getElementById('prio-w-avvikelse').offsetParent), 'Prioriteringens trösklar och viktning står synliga i panelen');
    await page.click('#inst-flikar [data-inst-flik="likvardighet"]');
    await page.waitForTimeout(700);
    ok(await page.evaluate(() => document.getElementById('installningar-modal').style.display === 'none' && document.getElementById('view-likvardighet').style.display === 'block' && document.getElementById('avsnitt-lv-installningar').open),
        'Öppna i panelen går till Likvärdigt arbete och fäller ut avsnittet där inställningen står');
}

// Sök och hoppa, BAS-dossiern (modal).
export async function sokOchBasdossier() {
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

    console.log('\n── BAS-dossier (modal) ──');
    {
        // Från Löneöversikten: knappen i BAS C:s rubrikrad öppnar dialogen utan att fälla raden; Escape stänger och
        // fokus går tillbaka till knappen.
        await page.evaluate(() => { document.querySelector('.nav-item[data-tab="utforska"]').click(); scrollTo(0, 0); });
        await page.waitForTimeout(800);
        const knapp = '#rapport-table tr.group-header [data-open-basdossier="C"]';
        const fore = await page.evaluate(k => document.querySelector(k)?.closest('tr').classList.contains('collapsed'), knapp);
        await page.click(knapp);
        await page.waitForTimeout(400);
        const bd = await page.evaluate(k => ({ oppen: document.getElementById('basdossier-modal').style.display === 'flex',
            text: (document.getElementById('basdossier-body').textContent || '').replace(/\s+/g, ' '),
            val: document.getElementById('basdossier-select').value, hopfalld: document.querySelector(k).closest('tr').classList.contains('collapsed'),
            synlig: (() => { const r = document.querySelector('#basdossier-modal .glossary-panel').getBoundingClientRect(); return r.width > 300 && r.height > 200 && r.left >= 0 && r.right <= innerWidth; })() }), knapp);
        ok(bd.oppen && bd.synlig && bd.val === 'C' && /BAS-intervall C/.test(bd.text) && /Yrkesgrupperna i intervallet/.test(bd.text) && /Förra året/.test(bd.text) && bd.hopfalld === fore,
            'knappen i Löneöversiktens BAS-rad öppnar BAS-dossiern för intervallet, utan att fälla raden');
        await page.keyboard.press('Escape');
        await page.waitForTimeout(300);
        ok(await page.evaluate(k => document.getElementById('basdossier-modal').style.display === 'none' && document.activeElement === document.querySelector(k), knapp),
            'Escape stänger BAS-dossiern och fokus går tillbaka till knappen');
        // Från sökrutan, med tangentbordet: raden under BAS-träffen öppnar dossiern.
        await page.evaluate(() => document.activeElement && document.activeElement.blur());
        await page.keyboard.press('/');
        await page.keyboard.type('bas c');
        await page.waitForTimeout(250);
        const steg = await page.evaluate(() => [...document.querySelectorAll('#sok-grupp-lista [role="option"]')].findIndex(li => li.getAttribute('data-sok-basdossier') === 'C'));
        ok(steg > 0, `en BAS-träff har raden Öppna BAS-dossiern under sig (alternativ ${steg + 1})`);
        for (let i = 0; i < steg; i++) await page.keyboard.press('ArrowDown');
        await page.keyboard.press('Enter');
        await page.waitForTimeout(400);
        ok(await page.evaluate(() => document.getElementById('basdossier-modal').style.display === 'flex' && document.getElementById('basdossier-select').value === 'C'
            && document.getElementById('sok-grupp-lista').hidden), 'pil ned och Retur på raden öppnar BAS-dossiern från sökrutan');
        await page.keyboard.press('Escape');
        await page.waitForTimeout(300);
        ok(await page.evaluate(() => document.getElementById('basdossier-modal').style.display === 'none' && document.activeElement.id === 'sok-grupp'), 'Escape stänger, och fokus står kvar i sökfältet');
        await page.evaluate(() => document.activeElement && document.activeElement.blur());
    }
}

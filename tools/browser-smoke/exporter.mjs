// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
// Webbläsar-röktestet, del: Exporterna: Word-utkastet, rapportunderlaget, förhandsbeskedet, PDF, ZIP och checklistorna.
// Körs av tools/browser-smoke.mjs i samma ordning som kontrollerna alltid har körts.
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { NAMN, BILDER, KAN_LASA_URKLIPP, ok, page } from './rigg.mjs';

// Word-utkastet (.docx).
export async function wordUtkast() {
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
}

// Rapportunderlaget (urklipp).
export async function rapportunderlag() {
    console.log('\n── Rapportunderlag (urklipp) ──');
    await page.click('.nav-item[data-tab="rapporttext"]');
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
}

// Förhandsbesked och urval, PDF-rapporten och ZIP-filen.
export async function beskedPdfZip() {
    console.log('\n── Förhandsbesked och urval ──');
    {
        await page.evaluate(() => { document.querySelector('.nav-item[data-tab="dokumentera"]').click(); });
        await page.waitForTimeout(1200);
        await page.evaluate(() => { sattRapportUrval('hela'); renderExportBesked(); document.getElementById('avsnitt-ex-urval').open = true; });
        const fore = await page.evaluate(() => ({ word: document.getElementById('besked-word').textContent, excel: document.getElementById('besked-excel').textContent, zip: document.getElementById('besked-zip').textContent,
            rader: document.querySelectorAll('#rapport-urval .urval-rad').length, syns: document.getElementById('besked-word').offsetParent !== null }));
        ok(fore.syns && /Hela dokumentationen · 13 avsnitt · \d+ tabeller · 10 diagram/.test(fore.word) && /Utelämnar:/.test(fore.word), `Word-raden säger vad filen innehåller och utelämnar (${fore.word.slice(0, 90)}…)`);
        ok(/\d+ blad — Löneöversikt/.test(fore.excel) && /Word-utkastet, Excel-filen \(\d+ blad\) och diagrammen i alla flikar/.test(fore.zip) && fore.rader === 14, 'Excel-raden listar bladen, ZIP-raden säger vad filen bär, och urvalet har fjorton avsnitt (bilagan med gruppdossierer förvald av)');
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
}

// Checklistornas utskriftsfönster.
export async function checklistor() {
    // Utskriftsfönstret för checklistorna (printScaffoldView, 60-utskrift.js) ärver verktygets CSP: ett <style> som
    // skriptet skapar får inget ark, så fönstrets stilar kommer som ett byggt stilark (adoptedStyleSheets).
    console.log('\n── Checklistornas utskriftsfönster ──');
    for (const [vy, namn] of [['view-bestammelser', 'Regler & praxis'], ['view-handlingsplan', 'Handlingsplanens mall']]) {
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
}

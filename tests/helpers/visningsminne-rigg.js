// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
// Rigg för vakten över visningsminnet (ADR-81, tests/visningsminne*.test.js): flikbytet som användaren gör det,
// flikens innehåll i sidan och jämförelsen med samma flik ritad från början.
//
// För varje sorts ändring ritas alla flikar, användaren står i en annan flik, ändringen görs, och sedan öppnas varje
// flik igen (prova). En flik som visas igen utan omritning jämförs med samma flik ritad från början
// (renderTabContent direkt); en flik som ritades om när den öppnades är redan ritad från början. Flikbytet går genom
// klickaFlik(nav, { uppskjut: true }), samma väg som användarens klick i menyn (ADR-80); ett klick från koden ritar
// alltid.
import { createAppWindow } from './app-harness.js';
import { papa, csvFil } from './granssnitt-rigg.js';

export const nav = (w, flik) => w.document.querySelector(`.nav-item[data-tab="${flik}"]`);
export const runda = (w, flik) => w.eval(`_flikRunda.get(${JSON.stringify(flik)}) || 0`);
export const vanta = (ms = 5) => new Promise(r => setTimeout(r, ms));
/** Flikarna som går att öppna nu, i menyns ordning. */
export const flikar = w => [...w.document.querySelectorAll('.nav-item')]
    .filter(n => !n.hidden && n.getAttribute('aria-disabled') !== 'true').map(n => n.getAttribute('data-tab'));
/** Väntar tills ingenting räknas: inga block i kön, ingen panel med aria-busy och inga bakgrundsberäkningar. */
export async function vila(w) {
    for (let i = 0; i < 2000; i++) {
        await vanta();
        const klart = !w.document.querySelector('[aria-busy="true"]')
            && w.eval('_blockKo.length === 0 && !_bakgrundsrakning && !_regKvantilBakgrund && !_omritningPagar');
        if (klart) { await vanta(); return; }
    }
    throw new Error('sidan blev aldrig klar');
}
/** Användarens flikbyte (ADR-80), tills fliken är färdig. */
export async function byt(w, flik) { w.klickaFlik(nav(w, flik), { uppskjut: true }); await vila(w); }
/** Flikens innehåll i sidan. Diagrammens exportmenyer numreras i den ordning de skapas; numret normaliseras. */
export function innehall(w, flik) {
    const paneler = w.eval(`PANEL_GROUPS[${JSON.stringify(flik)}] || [${JSON.stringify(flik)}]`);
    return paneler.map(p => w.document.getElementById('view-' + p)?.innerHTML ?? '').join('\n')
        .replace(/chart-export-\d+/g, 'chart-export-#').replace(/tip-host-[a-z0-9]+/g, 'tip-host-#');
}
/** Var två texter skiljer sig först, med lite sammanhang, eller null. */
export function skillnad(a, b) {
    if (a === b) return null;
    let i = 0;
    while (i < a.length && a[i] === b[i]) i++;
    return `visad: …${a.slice(Math.max(0, i - 80), i + 120)}…\nny:    …${b.slice(Math.max(0, i - 80), i + 120)}…`;
}
/**
 * Öppnar varje flik som användaren och jämför den som visas igen med samma flik ritad från början. En flik som
 * ritades om när den öppnades är ritad från början och jämförs inte en gång till. Svarar med flikarna som skilde sig.
 *
 * En flik som flikbytet inte kan visa igen (_visasSomRitad är falsk, villkoret i flikbyte) skulle bara ritas om och
 * aldrig jämföras, och den omritningen var nästan hela vakternas tid. Bara den första sådana fliken i varje runda
 * öppnas, så att det prövas att flikbytet följer villkoret; de andra hoppas över. Villkoret blir sant igen bara när
 * fliken själv ritas klart, så det som jämförs är detsamma.
 */
export async function jamforAlla(w) {
    const fel = [];
    let provadOmritning = false;
    for (const flik of flikar(w)) {
        if (!w.eval(`_visasSomRitad(${JSON.stringify(flik)})`)) {
            if (provadOmritning) continue;
            provadOmritning = true;
        }
        const r = runda(w, flik);
        await byt(w, flik);
        if (runda(w, flik) !== r) continue;
        const visad = innehall(w, flik);
        w.__renderTabContent(flik);
        await vila(w);
        const s = skillnad(visad, innehall(w, flik));
        if (s) fel.push(`${flik}\n${s}`);
    }
    return fel;
}
/** Ritar alla flikar (som användaren) och väntar tills inget räknas i bakgrunden. */
export async function ritaAlla(w) { for (const flik of flikar(w)) await byt(w, flik); await vila(w); }
/** Ritar alla flikar direkt och synkront, innan något i bakgrunden hinner bli klart. */
export function ritaAllaDirekt(w) { for (const flik of flikar(w)) w.__renderTabContent(flik); }
/** Ritar alla flikar, står i `fran`, gör ändringen och prövar sedan varje flik. */
export async function prova(w, fran, gor) {
    await ritaAlla(w);
    await byt(w, fran);
    await gor(w);
    await vila(w);
    return jamforAlla(w);
}
export const demo = () => { const w = createAppWindow(); w.__loadDemoData(); return w; };
/** En lönefil med flera BAS-intervall, AID-etiketter och åldrar (påhittad). */
export function lonefil(n = 240, bas = ['A', 'B', 'C', 'D']) {
    const rader = ['BAS;AID;Månadslön;Ålder;Kön'];
    for (let i = 0; i < n; i++) {
        const b = bas[i % bas.length], aid = ['207011', '207012', '315011'][i % 3];
        rader.push(`${b};${aid};${28000 + (i % 37) * 410 + bas.indexOf(b) * 3000 + (i % 2 ? 900 : 0)};${24 + (i % 40)};${i % 2 ? 'Man' : 'Kvinna'}`);
    }
    return rader;
}
export async function lasInLonefil(w, rader) {
    papa(w);
    w.document.getElementById('data-status').textContent = '';
    w.loadStructureFile(csvFil(w, rader, 'lonefil.csv'));
    for (let i = 0; i < 500 && !/rader/.test(w.document.getElementById('data-status').textContent); i++) await vanta(10);
}

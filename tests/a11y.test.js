/**
 * Tillgänglighets-röktest (axe-core i jsdom).
 *
 * Bootar verktyget i den delade riggen (helpers/app-harness.js, med d3 så att diagramkärnan ritar), laddar demodata,
 * renderar varje flik, visar alla paneler, öppnar varje dialog och kör axe-core mot DOM:en (axe prövar bara det som
 * syns). Detta automatiserar den strukturella WCAG-granskningen (etiketter,
 * roller, ARIA-giltighet, namn på knappar/länkar, dubbletter av id, tabellrelationer, diagrammens svg) i CI.
 *
 * BEGRÄNSNING: jsdom saknar layout-motor, så geometriberoende regler — främst `color-contrast` — kan inte utvärderas
 * här och är avstängda. Palettens kontrast mot ytorna räknas i stället i tests/farger.test.js.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { createAppWindow } from './helpers/app-harness.js';

const require = createRequire(import.meta.url);
const axeSrc = readFileSync(require.resolve('axe-core'), 'utf8');

let win, axeResults;

// Regler som kräver layout/geometri och därför inte är meningsfulla i jsdom.
const DISABLED_RULES = {
    'color-contrast': { enabled: false },
    'color-contrast-enhanced': { enabled: false }
};

beforeAll(async () => {
    win = createAppWindow();
    win.eval(axeSrc);   // exponerar window.axe
    // Boot-splashen tas bort av appen efter init; dess setTimeout hinner inte alltid köra i jsdom.
    win.document.getElementById('boot-splash')?.remove();

    // Demodata + rendera alla flikar så panelernas innehåll och diagrammen finns i DOM:en.
    win.__lasInDemodata();
    for (const t of [...win.document.querySelectorAll('.nav-item')].map(b => b.getAttribute('data-tab')).filter(Boolean)) win.__ritaFlik(t);

    // Utforskas urvalspanel med villkor av alla slag och en öppen värdelista.
    const d = win.document;
    const change = (sel, v) => { const el = d.querySelector(sel); el.value = v; el.dispatchEvent(new win.Event('change', { bubbles: true })); };
    d.querySelector('[data-urval-lagg-till="person"]').click();
    d.querySelector('[data-urval-lagg-till="person"]').click();
    change('[data-urval-falt="1"]', 'lon');
    change('[data-urval-op="1"]', 'inteMellan');
    d.querySelector('[data-urval-lagg-till="grupp"]').click();
    d.querySelector('#explore-urval-villkor .explore-urval-val').open = true;
    const radAntal = d.querySelectorAll('#explore-urval .explore-urval-rad').length;
    if (radAntal !== 3) throw new Error(`urvalspanelen fick ${radAntal} rader, väntade 3`);

    // axe prövar bara det som syns: varje dialog öppnas, med sitt innehåll, och varningen vid inaktivitet visas.
    win.__state.paketInbakat = { text: '{}', organisation: 'Organisationen' };
    win.__state.inactivityTimeoutMin = 30;
    const grupp = win.__gruppdossierKandidater()[0].key;
    const hp = d.querySelector('[data-hp-skal]');
    for (const oppna of ['oppnaOrdlista()', 'oppnaVadLagras()', 'visaInbakatPaket()', `oppnaGruppdossier(${JSON.stringify(grupp)})`,
        'oppnaBasdossier()', 'oppnaInstallningar()', '_visaInaktivitetsvarning()']) win.eval(oppna);
    hp.click();
    for (const id of ['btn-open-symbols', 'gdpr-info-readmore']) d.getElementById(id).click();
    d.querySelector('[data-la-bevis]').click();
    // Flikarnas paneler visas alla, så att axe prövar varje ritad flik och dialogerna som står i en panel.
    d.querySelectorAll('.view-panel').forEach(p => { p.style.display = 'block'; });
    const dold = el => { for (let n = el; n; n = n.parentElement) if (win.getComputedStyle(n).display === 'none') return true; return false; };
    const stangda = [...d.querySelectorAll('[role="dialog"]')].filter(dold).map(m => m.id);
    if (stangda.length) throw new Error(`dialoger som inte öppnades: ${stangda.join(', ')}`);

    axeResults = await win.axe.run(win.document, {
        rules: DISABLED_RULES,
        resultTypes: ['violations']
    });
}, 60000);

describe('a11y: axe-core strukturell granskning (jsdom)', () => {
    it('appen bootade, diagrammen ritades och axe kördes', () => {
        expect([...win.document.querySelectorAll('div')].filter(e => e._figur).length).toBeGreaterThan(30);
        expect(axeResults).toBeTruthy();
        expect(Array.isArray(axeResults.violations)).toBe(true);
    });

    it('inga allvarliga (serious/critical) WCAG-överträdelser i markup', () => {
        const serious = axeResults.violations.filter(v => v.impact === 'serious' || v.impact === 'critical');
        if (serious.length) {
            const report = serious.map(v =>
                `  [${v.impact}] ${v.id}: ${v.help} (${v.nodes.length} st)\n` +
                v.nodes.slice(0, 4).map(n => `      ${n.target.join(' ')} — ${n.html.slice(0, 120)}`).join('\n')
            ).join('\n');
            throw new Error(`axe hittade ${serious.length} allvarliga regelöverträdelser:\n${report}`);
        }
        expect(serious.length).toBe(0);
    });

    it('inga moderate WCAG-överträdelser i markup', () => {
        const moderate = axeResults.violations.filter(v => v.impact === 'moderate');
        if (moderate.length) {
            const report = moderate.map(v => `  [moderate] ${v.id}: ${v.help} (${v.nodes.length} st)\n` + v.nodes.slice(0, 4).map(n => `      ${n.target.join(' ')} — ${n.html.slice(0, 120)}`).join('\n')).join('\n');
            throw new Error(`axe hittade ${moderate.length} moderata regelöverträdelser:\n${report}`);
        }
        expect(moderate.length).toBe(0);
    });
});

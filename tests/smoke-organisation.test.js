/**
 * Röktest (jsdom): Sortering, organisationsneutralt läge, organisationspaket, licens och demosidan.
 *
 * Utbrutet ur smoke.test.js så att Vitest fördelar röktesterna över flera arbetare; varje describe-block
 * skapar sina egna fönster via createAppWindow (tests/helpers/app-harness.js).
 */
import { describe, it, expect } from 'vitest';
import { createAppWindow } from './helpers/app-harness.js';

describe('sortering, Att göra, kopiering och Likvärdigt arbete — kopiering', () => {
    it('att rita en annan flik (t.ex. för att kopiera ett diagram) flyttar inte sidans navigering', () => {
        const w = createAppWindow();
        w.__loadDemoData();
        const d = w.document;
        d.querySelector('.nav-item[data-tab="dashboard"]').click();
        w.__renderTabContent('matrix');
        expect(d.querySelectorAll('#view-regression .flow-next-bar, #view-lika-yrken .flow-next-bar, #view-skevhet .flow-next-bar').length).toBe(0);
        expect(d.getElementById('view-dashboard').classList.contains('active') || d.getElementById('view-dashboard').style.display === 'block').toBe(true);
    });
    it('kopiera diagram: urklippet begärs direkt i klicket (Safari), bilden levereras som ett löfte', async () => {
        const w = createAppWindow();
        w.__loadDemoData();
        const fångat = [];
        w.ClipboardItem = class { constructor(o) { this.o = o; } };
        Object.defineProperty(w.navigator, 'clipboard', { configurable: true, value: { write: async items => { fångat.push(...items); } } });
        w.figurTillBild = () => Promise.resolve('data:image/png;base64,AAAA');   // diagramkärnans bild: jsdom har ingen canvas
        const p = w.__kopieraRapportDiagram('chart-perbas-gap');
        expect(fångat).toHaveLength(1);                      // före första await
        expect(typeof fångat[0].o['image/png'].then).toBe('function');
        expect(await p).toBe('urklipp');
        expect((await fångat[0].o['image/png']).type).toBe('image/png');
    });
});

/**
 * Att göra: livscykelpunkten räknas på det BAS-intervall användaren valt i livscykelkortet.
 *
 * Regressionstest för en bugg som typkontrollen (npm run typecheck) hittade: 18-atgardslista.js läste
 * `state._lifecycleFixBas`, ett fält som aldrig sätts — valet bor i modulvariabeln `_lifecycleFixBas`
 * (52-livscykel.js). Punkten räknades därför alltid på standardintervallet, oavsett vad kortet visade.
 */
import { describe, it, expect, vi } from 'vitest';
import { createAppWindow } from './helpers/app-harness.js';

vi.setConfig({ testTimeout: 30000 });

describe('Att göra: livscykelanalysen följer kortets BAS-val', () => {
    it('buildActionChecklist anropar runLifecycleRegression med det valda BAS-intervallet', () => {
        const win = createAppWindow();
        win.__loadDemoData();
        // Fixera kortets val (samma tilldelning som select-lyssnaren i 52-livscykel.js gör).
        win.eval('_lifecycleFixBas = "B"');
        const anrop = [];
        const original = win.runLifecycleRegression;
        win.runLifecycleRegression = fixBas => { anrop.push(fixBas); return original(fixBas); };
        win.buildActionChecklist();
        expect(anrop).toEqual(['B']);
    });
});

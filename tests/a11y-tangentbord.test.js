// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
/**
 * Tangentbord och skärmläsare på datorn (princip 6, WCAG 2.1 AA): det axe-core i tests/a11y.test.js inte ser, eftersom
 * det är beteende. Fokus står kvar när en yta ritas om (2.4.3), fokusfällan håller i dialogerna, tabellernas sortering
 * och hopfällning och informationsikonerna nås med tangentbord (2.1.1, 4.1.2), och ett besked som bara syns når
 * skärmläsaren (4.1.3).
 */
import { describe, it, expect, vi } from 'vitest';
import { createAppWindow, delatFonster, MENYFLIKAR } from './helpers/app-harness.js';
import { las } from './helpers/granssnitt-rigg.js';

vi.setConfig({ testTimeout: 60000 });

const demo = () => { const w = createAppWindow(); w.__lasInDemodata(); return w; };
const klickaFlik = (w, flik) => w.document.querySelector(`.nav-item[data-tab="${flik}"]`).click();
const tangent = (w, el, key, extra = {}) => { const e = new w.KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...extra }); el.dispatchEvent(e); return e; };
const paus = (ms = 0) => new Promise(r => setTimeout(r, ms));
const uppläst = async w => { await paus(70); return w.document.getElementById('aria-live-announcer')?.textContent || ''; };
/** Fokus står på ett element i sidan, inte på sidans början. */
const harFokus = w => w.document.activeElement && w.document.activeElement !== w.document.body;

describe('fokus står kvar när en yta ritas om', () => {
    it('«Nästa steg» flyttar fokus till den nya fliken', () => {
        const w = demo(), d = w.document;
        klickaFlik(w, 'matrix');
        const knapp = d.querySelector('#view-regression .flow-next-btn, .view-panel[style*="block"] .flow-next-btn');
        knapp.focus();
        knapp.click();
        expect(d.querySelector('.nav-item.active').getAttribute('data-tab')).toBe(knapp.getAttribute('data-flow-tab'));
        expect(harFokus(w)).toBe(true);
        expect(d.activeElement.closest('.view-panel').style.display).toBe('block');
    });

    it('en avbockning i Att göra lämnar fokus på samma ruta', () => {
        const w = demo(), d = w.document;
        const ruta = d.querySelector('.act-cb'), id = ruta.dataset.id;
        ruta.focus();
        ruta.click();
        expect(ruta.isConnected).toBe(false);   // listan är omritad
        expect(d.activeElement.dataset.id).toBe(id);
        expect(d.activeElement.checked).toBe(true);
    });

    it('ett val i Förklaringsmodell och livscykelns BAS-väljare lämnar fokus på kontrollen', () => {
        const w = demo(), d = w.document;
        klickaFlik(w, 'struktur');
        const kryss = d.querySelector('#forklaringsmodell-panel input[data-fm="alder"]');
        kryss.focus();
        kryss.click();
        expect(d.activeElement.getAttribute('data-fm')).toBe('alder');
        klickaFlik(w, 'kon');
        const sel = d.getElementById('lifecycle-bas-select');
        sel.focus();
        sel.value = sel.options[1].value;
        sel.dispatchEvent(new w.Event('change', { bubbles: true }));
        expect(d.activeElement.id).toBe('lifecycle-bas-select');
    });

    it('Ta bort på en riktad rad i Löneöversyn ger fokus till nästa rads knapp, och den sista till kontrollen före', () => {
        const w = demo(), d = w.document;
        const rad = { bas: 'A', aid: '*', mode: 'kr', value: 500, dist: 'lowest', targetLevel: 'median', pool: 'övrigt' };
        w.__state.forecast.targets = [{ ...rad }, { ...rad, value: 700 }];
        klickaFlik(w, 'loneoversyn');
        const bort = () => [...d.querySelectorAll('#forecast-targets [data-f="remove"]')];
        bort()[0].focus();
        bort()[0].click();
        expect(bort()).toHaveLength(1);
        expect(d.activeElement).toBe(bort()[0]);
        bort()[0].click();
        expect(bort()).toHaveLength(0);
        expect(harFokus(w)).toBe(true);
    });

    it('Utforska: Ta bort villkor, Rensa allt och Rensa urvalet', () => {
        const w = demo(), d = w.document;
        klickaFlik(w, 'utforska');
        const q = s => d.querySelector(s);
        q('[data-urval-lagg-till="person"]').click();
        q('[data-urval-lagg-till="person"]').click();
        q('[data-urval-bort="person:0"]').focus();
        q('[data-urval-bort="person:0"]').click();
        expect(d.activeElement.getAttribute('data-urval-bort')).toBe('person:0');   // raden som flyttade upp
        // Rensa allt i raden med urvalet.
        w.__utforskaSattUrval({ lage: 'alla', villkor: [{ falt: 'bas', op: 'enAv', varde: ['A'], inte: false }] });
        w.__ritaUtforska();
        q('#explore-filter-chips [data-explore-clear]').focus();
        q('#explore-filter-chips [data-explore-clear]').click();
        expect(q('#explore-filter-chips [data-explore-clear]')).toBeNull();
        expect(harFokus(w)).toBe(true);
        // Rensa urvalet när ingen matchar.
        w.__utforskaSattUrval({ lage: 'alla', villkor: [{ falt: 'bas', op: 'enAv', varde: ['A'], inte: false }, { falt: 'bas', op: 'enAv', varde: ['B'], inte: false }] });
        w.__ritaUtforska();
        q('#chart-explore [data-explore-clear]').focus();
        q('#chart-explore [data-explore-clear]').click();
        expect(harFokus(w)).toBe(true);
    });

    it('gruppdossiern: väljaren behåller fokus vid ett byte, och Kopiera behåller fokus', async () => {
        const w = demo(), d = w.document;
        const [a, b] = w.__gruppdossierKandidater();
        w.eval(`oppnaGruppdossier(${JSON.stringify(a.key)})`);
        const sel = d.getElementById('dossier-select');
        await paus(60);
        sel.focus();
        sel.value = b.key;
        sel.dispatchEvent(new w.Event('change', { bubbles: true }));
        await paus(120);
        expect(d.activeElement).toBe(sel);
        w.navigator.clipboard = { writeText: () => Promise.resolve() };
        d.getElementById('btn-dossier-copy').focus();
        d.getElementById('btn-dossier-copy').click();
        await paus(0);
        expect(d.activeElement.id).toBe('btn-dossier-copy');
        w.eval('stangGruppdossier()');
    });

    it('robusthetsanalysen: fokus lämnar inte sidan, start och resultat läses upp, och ett fel lämnar inte «Beräknar» kvar', async () => {
        const w = demo(), d = w.document;
        klickaFlik(w, 'dokumentera');
        d.getElementById('btn-run-robusthet').focus();
        d.getElementById('btn-run-robusthet').click();
        expect(harFokus(w)).toBe(true);
        await paus(100);
        expect(d.getElementById('robusthet-body').textContent).toMatch(/Så läser du panelen/);
        expect(await uppläst(w)).toMatch(/Robusthetsanalysen är klar/);
        klickaFlik(w, 'dokumentera');
        w.eval('robusthetPrioritering = () => { throw new Error("prov"); }');
        d.getElementById('btn-run-robusthet').click();
        await paus(100);
        expect(d.getElementById('robusthet-body').textContent).not.toMatch(/Beräknar/);
        expect(d.getElementById('internt-fel-banner').hidden).toBe(false);
    });
});

describe('besked som bara syns når skärmläsaren', () => {
    it('statusraderna och resultatrutorna som uppdateras på plats har aria-live i sidan', () => {
        const sida = las('src/index.html');
        for (const id of ['data-status', 'policy-status', 'stat-status', 'config-status', 'snapshot-status', 'snapshot-comparison',
            'prio-consequence-panel', 'besked-word', 'besked-pdf', 'besked-excel', 'besked-zip',
            'forecast-threshold-result', 'forecast-sensitivity', 'forecast-rem-result', 'forecast-scenarios']) {
            const tagg = sida.match(new RegExp(`<[a-z]+ [^>]*id="${id}"[^>]*>`))[0];
            expect(tagg, id).toMatch(/aria-live="polite"/);
        }
    });
    it('det lilla demot och laddningsrutan läses upp', async () => {
        const w = demo();
        expect(await uppläst(w)).toMatch(/Demodata inläst.*Diagnostiken/);
        w.eval('visaLaddning()');
        expect(await uppläst(w)).toMatch(/Läser in/);
        w.eval('doljLaddning()');
    });
});

describe('fokusfällan räknar dialogens element när Tab trycks', () => {
    it('ordlistan: Tab från det sista elementet stannar i dialogen också när sökningen har dolt innehåll', async () => {
        const w = createAppWindow(), d = w.document;
        d.getElementById('btn-open-glossary').click();
        await paus(60);
        const m = d.getElementById('glossary-modal');
        const sok = d.getElementById('glossary-search');
        sok.value = 'median';
        sok.dispatchEvent(new w.Event('input', { bubbles: true }));
        const f = [...m.querySelectorAll('a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"]), summary')];
        f.at(-1).focus();
        expect(tangent(w, f.at(-1), 'Tab').defaultPrevented).toBe(true);
        expect(d.activeElement).toBe(f[0]);
        expect(tangent(w, f[0], 'Tab', { shiftKey: true }).defaultPrevented).toBe(true);
        expect(d.activeElement).toBe(f.at(-1));
    });
    it('varje dialog stängs med Escape och lämnar fokus där den öppnades', async () => {
        const w = createAppWindow(), d = w.document;
        klickaFlik(w, 'filer');   // Så skyddas uppgifterna står i Filer och kvalitet
        const oppnare = d.body.appendChild(d.createElement('button'));
        w.__state.paketInbakat = { text: '{}', organisation: 'Organisationen' };   // Visa paketet öppnas bara med ett inbakat paket
        for (const [oppna, modal] of [[() => d.getElementById('btn-open-symbols').click(), 'symbols-modal'],
            [() => d.getElementById('btn-data-residency').click(), 'data-residency-modal'],
            [() => d.getElementById('gdpr-info-readmore').click(), 'gdpr-info-modal'],
            [() => w.eval('visaInbakatPaket()'), 'paket-modal']]) {
            oppnare.focus();
            oppna();
            await paus(60);
            expect(d.getElementById(modal).style.display, modal).toBe('flex');
            expect(d.getElementById(modal).contains(d.activeElement), modal).toBe(true);
            tangent(w, d.activeElement, 'Escape');
            expect(d.getElementById(modal).style.display, modal).toBe('none');
            expect(d.activeElement, modal).toBe(oppnare);
            expect(w.eval('_fokusfallor').has(d.getElementById(modal)), modal).toBe(false);
        }
    });
});

describe('tabellerna nås med tangentbord', () => {
    it('en sorterbar rubrik nås med Tab, sorterar med Enter och mellanslag och säger riktningen', () => {
        const w = demo(), d = w.document;
        klickaFlik(w, 'struktur');
        const th = d.querySelector('th.sortable');
        expect(th.tabIndex).toBe(0);
        tangent(w, th, 'Enter');
        expect(th.getAttribute('aria-sort')).toBe('ascending');
        tangent(w, th, ' ');
        expect(th.getAttribute('aria-sort')).toBe('descending');
        const annan = [...th.parentElement.querySelectorAll('th.sortable')].find(t => t !== th);
        tangent(w, annan, 'Enter');
        expect(annan.getAttribute('aria-sort')).toBe('ascending');
        expect(th.hasAttribute('aria-sort')).toBe(false);
    });
    it('en hopfällbar grupprad nås med Tab, fälls med Enter och säger om den är utfälld', async () => {
        const w = demo(), d = w.document;
        klickaFlik(w, 'struktur');
        await paus(0);
        const rad = d.querySelector('#rapport-table tr.group-header');
        expect(rad.tabIndex).toBe(0);
        const fore = rad.getAttribute('aria-expanded');
        expect(fore).toBe(String(!rad.classList.contains('collapsed')));
        tangent(w, rad, 'Enter');
        await paus(0);
        expect(rad.getAttribute('aria-expanded')).toBe(String(fore !== 'true'));
    });
});

describe('informationsikonerna och filvalen nås med tangentbord', () => {
    const allaFlikar = delatFonster(async w => { w.__lasInDemodata(); for (const f of [...MENYFLIKAR, 'info']) w.__ritaFlik(f); await paus(0); });
    it('varje .info-tip nås med Tab och har förklaringen som namn', () => {
        const tips = [...allaFlikar().document.querySelectorAll('.info-tip')];
        expect(tips.length).toBeGreaterThan(40);
        const fel = tips.filter(t => t.tabIndex !== 0 || t.getAttribute('role') !== 'img' || t.getAttribute('aria-label') !== t.getAttribute('data-tooltip'));
        expect(fel.map(t => t.outerHTML.slice(0, 80))).toEqual([]);
    });
    it('tipset visas när ikonen får fokus', () => {
        const w = demo(), t = w.document.querySelector('#view-dashboard .info-tip');
        t.focus();
        expect(w.document.activeElement).toBe(t);
        const portal = w.document.querySelector('.tip-portal');
        expect(portal.classList.contains('visible')).toBe(true);
        expect(portal.textContent).toBe(t.getAttribute('data-tooltip'));
    });
    it('Ladda konfiguration och Läs in organisationspaket är knappar som öppnar filvalet', () => {
        const w = createAppWindow(), d = w.document;
        for (const [id, text] of [['btn-config-load', 'Ladda konfiguration'], ['file-input-paket', 'Läs in organisationspaket']]) {
            const knapp = [...d.querySelectorAll(`button[data-byt-fil="${id}"]`)].find(b => b.textContent.trim() === text);
            expect(knapp, text).toBeTruthy();
            let oppnat = false;
            d.getElementById(id).click = () => { oppnat = true; };
            knapp.click();
            expect(oppnat, text).toBe(true);
        }
        expect(d.querySelector('label[for="btn-config-load"], label > #file-input-paket')).toBeNull();
    });
    it('piltangenterna i diagrammen stannar bara på märken som har ett tips', () => {
        const w = allaFlikar();
        const utan = [];
        for (const el of [...w.document.querySelectorAll('div')].filter(e => e._figur)) {
            for (const m of w.eval('_rfTangentMarken')(el)) {
                const l = w.eval('_rfVisad')(el).lager[Number(m.getAttribute('data-l'))];
                if (typeof l?.tips !== 'function') utan.push(`${el.id} lager ${m.getAttribute('data-l')}`);
            }
        }
        expect([...new Set(utan)]).toEqual([]);
    });
});

describe('namn och roller', () => {
    it('dialogen Så skyddas uppgifterna har namn, och dess stängknapp också', () => {
        const d = createAppWindow().document, m = d.getElementById('gdpr-info-modal');
        expect(d.getElementById(m.getAttribute('aria-labelledby')).textContent).toBe('Så skyddas uppgifterna');
        expect(d.getElementById('gdpr-info-close').getAttribute('aria-label')).toBe('Stäng');
    });
    it('en knapp med aria-label har sin synliga text i namnet (WCAG 2.5.3)', () => {
        const d = createAppWindow().document;
        const ord = s => s.toLowerCase().replace(/[^\p{L}\p{N} ]/gu, '').replace(/\s+/g, ' ').trim();
        const fel = [...d.querySelectorAll('button[aria-label]')].filter(b => ord(b.textContent) && !ord(b.getAttribute('aria-label')).includes(ord(b.textContent)));
        expect(fel.map(b => b.id || b.textContent.trim())).toEqual([]);
    });
    it('reservkopieringen säger inte att den kopierade när webbläsaren nekade', () => {
        const w = createAppWindow(), larm = [];
        w.alert = t => larm.push(t);
        w.navigator.clipboard = undefined;
        w.document.execCommand = () => false;
        let klart = false;
        w.__f = () => { klart = true; };
        w.eval('kopieraTextTillUrklipp("text", window.__f, "nekad")');
        expect(klart).toBe(false);
        expect(larm).toEqual(['nekad']);
        expect(w.document.querySelector('textarea[readonly]')).toBeNull();
    });
});

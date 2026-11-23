// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
// Dataskyddet i appen: säkerheten, Rensa all data, k-anonymiteten i det som ritas, formler i exporterade celler och
// vad verktyget lagrar.
import { describe, it, expect, beforeAll } from 'vitest';
import { createAppWindow } from './helpers/app-harness.js';
import { attributtext } from './helpers/attributtext.js';
import { las } from './helpers/granssnitt-rigg.js';

let win;

beforeAll(() => {
    win = createAppWindow();
});

describe('säkerhet, dataskydd och HR-logik', () => {
    // Skadlig text i varje fält som kommer ur personalfilen eller ett organisationspaket.
    const X = n => `Y${n}<img src=x onerror="window.__xss='${n}'"><b class="inj">b</b>`;
    const skadligtUnderlag = w => {
        const data = [];
        for (let i = 0; i < 300; i++) {
            const g = i % 6;
            data.push({ bas: 'ABC'[g % 3], kon: i % 3 ? 'kvinna' : 'man', lon: 28000 + g * 2500 + (i % 17) * 150 + (i % 3 ? 0 : 2500),
                alder: 25 + (i % 35), aid: g < 3 ? `10${g}` : `20${g}`, yrke: `${g}${X('yrke' + g)}`, yrkeLabel: X('label' + g), radnr: i + 2 });
        }
        w.__state.data = data;
        const paket = { format: 'lonekartlaggning-organisationspaket', version: 1, organisation: { namn: X('org') }, utgivare: X('utg'), skapat: '2026-10-01',
            profil: { jamforelseNamn: X('jnamn'), jamforelseGenitiv: X('jgen'), jamforelseKort: X('jkort') },
            referens: { namn: X('ref'), kortnamn: X('refk'), rader: ['A', 'B', 'C'].map((bas, i) => ({ bas, aid: null, p10: 28000 + i * 2500, med: 31000 + i * 2500, p90: 34000 + i * 2500 })) },
            statistik: { namn: X('stat'), rader: [0, 1, 2, 3, 4, 5].map(g => ({ aid: g < 3 ? `10${g}` : `20${g}`, aidFull: X('aidfull' + g), bas: 'ABC'[g % 3],
                median: 33000 + g * 1000, p10: 30000, p90: 36000, nKv: 20, nMa: 20, andelKv: g < 3 ? 80 : 20 })) } };
        w.eval(`lasInPaket(${JSON.stringify(JSON.stringify(paket))}, 'x')`);
        w.eval('populateSelects(); unlockTabs(); ritaNyckeltal(); ritaLoneoversikt(); ritaLoneskillnadPerBas(lsBasVymodell());');
    };

    it('skadlig text i fil och organisationspaket skapar inga element i någon flik', async () => {
        const w = createAppWindow();
        skadligtUnderlag(w);
        for (const t of ['dashboard', 'bestammelser', 'matrix', 'likvardighet', 'struktur', 'prioritering', 'loneoversyn',
            'handlingsplan', 'dokumentera', 'kon', 'utforska', 'benchmark', 'info']) w.__renderTabContent(t);
        await new Promise(r => setTimeout(r, 300));
        const injicerat = [...w.document.querySelectorAll('img[onerror], [onerror], b.inj')]
            .map(e => `${e.closest('[id]')?.id}: ${e.outerHTML.slice(0, 60)}`);
        expect(injicerat).toEqual([]);
        expect(w.__xss).toBeUndefined();
    });

    it('automatisk rensning vid inaktivitet är på som standard (90 minuter)', () => {
        const w = createAppWindow();
        expect(w.__state.inactivityTimeoutMin).toBe(90);
    });

    const inaktivitetsPaket = inst => ({ format: 'lonekartlaggning-organisationspaket', version: 1, organisation: { namn: 'Exempelorganisationen' },
        skapat: '2026-10-08', installningar: inst, referens: { rader: [{ bas: 'A', p10: 20000, med: 25000, p90: 30000 }] } });
    const lasPaket = (w, p) => w.eval(`lasInPaket(${JSON.stringify(JSON.stringify(p))}, 'x.lonepaket.json')`);

    it('organisationspaketet kan låsa rensningen vid inaktivitet: rullistan i Vad lagras? är låst och säger varför (ADR-47)', () => {
        const w = createAppWindow();
        expect(lasPaket(w, inaktivitetsPaket({ inaktivitetMin: 45, inaktivitetLast: true })).ok).toBe(true);
        expect(w.__state.inactivityTimeoutMin).toBe(45);
        w.eval('setInactivityTimeout(0)');   // ingen väg runt låsningen
        expect(w.__state.inactivityTimeoutMin).toBe(45);
        w.eval('openDataResidency()');
        const sel = w.document.getElementById('inactivity-timeout-select');
        expect(sel.disabled).toBe(true);
        expect(sel.value).toBe('45');
        const not = w.document.getElementById('inactivity-last');
        expect(not.hidden).toBe(false);
        expect(not.textContent).toMatch(/Låst till 45 minuter av organisationspaketet från Exempelorganisationen/);
        expect(w.document.getElementById('paket-info').textContent).toMatch(/rensning vid inaktivitet låst till 45 minuter/);
        // Rensa all data tar bort låsningen tillsammans med paketet, och tiden går tillbaka till standard.
        w.eval('_rensaAllData()');
        expect(w.__state.paketLas.inaktivitetMin).toBeNull();
        expect(w.__state.inactivityTimeoutMin).toBe(90);
        w.eval('openDataResidency()');
        expect(w.document.getElementById('inactivity-timeout-select').disabled).toBe(false);
        expect(w.document.getElementById('inactivity-last').hidden).toBe(true);
    });
    it('ett paket som sätter rensningstiden utan att låsa den: värdet gäller men går att ändra; Av kan inte låsas', () => {
        const w = createAppWindow();
        expect(lasPaket(w, inaktivitetsPaket({ inaktivitetMin: 60 })).ok).toBe(true);
        expect(w.__state.inactivityTimeoutMin).toBe(60);
        w.eval('setInactivityTimeout(15)');
        expect(w.__state.inactivityTimeoutMin).toBe(15);
        const r = lasPaket(w, inaktivitetsPaket({ inaktivitetMin: 0, inaktivitetLast: true }));
        expect(r.ok).toBe(true);
        expect(r.meddelande).toMatch(/kan inte låsas i läget Av/);
        expect(w.__state.inactivityTimeoutMin).toBe(0);
        expect(w.__state.paketLas.inaktivitetMin).toBeNull();
        w.eval('setInactivityTimeout(30)');
        expect(w.__state.inactivityTimeoutMin).toBe(30);
    });

    it('nedräkningen rensar när 60 sekunder gått, även om en dold flik bara hunnit köra ett tick', () => {
        const w = createAppWindow();
        w.__state.data = [{ bas: 'A', kon: 'kvinna', lon: 30000 }];
        let tick = null;
        w.setInterval = fn => { tick = fn; return 1; };   // intervallet körs för hand, som när webbläsaren stryper det
        const start = w.Date.now();
        w.Date.now = () => start;
        w.eval('_showInactivityWarning()');
        expect(w.document.querySelector('.inactivity-warn-overlay')).not.toBeNull();
        w.Date.now = () => start + 30 * 1000;
        tick();
        expect(w.document.getElementById('inactivity-countdown').textContent).toBe('30');
        w.Date.now = () => start + 61 * 1000;
        tick();
        expect(w.document.querySelector('.inactivity-warn-overlay')).toBeNull();
        expect(w.__state.data).toEqual([]);
        expect(w.document.body.textContent).toMatch(/Sessionen rensades/);
    });

    it('tidsväljaren i Vad lagras? gäller direkt när dialogen öppnats, både från knappen och från sökningen', () => {
        const w = createAppWindow();
        const valj = min => {
            const sel = w.document.getElementById('inactivity-timeout-select');
            sel.value = String(min);
            sel.dispatchEvent(new w.Event('change', { bubbles: true }));
        };
        w.document.getElementById('btn-data-residency').click();
        valj(30);
        expect(w.__state.inactivityTimeoutMin).toBe(30);
        expect(w.document.getElementById('inactivity-status').textContent).toBe('Aktiv (30 min)');
        w.eval('openDataResidency()');
        valj(0);
        expect(w.__state.inactivityTimeoutMin).toBe(0);
        expect(w.document.getElementById('inactivity-status').textContent).toBe('Av');
    });

    const steg = (w, re) => [...w.document.querySelectorAll('#process-tracker .ptrack-row')].find(r => re.test(r.textContent));
    const status = (w, re) => steg(w, re).querySelector('.ptrack-status').dataset.status;   // klar | delvis | ej | manuell

    it('processöversikten: lika och likvärdigt arbete är inte klara medan punkter återstår i Att göra', () => {
        const w = createAppWindow();
        w.__loadDemoData();
        w.__renderProcessTracker();
        expect(status(w, /3\. Lika arbete/)).toBe('delvis');
        expect(status(w, /4\. Likvärdigt arbete/)).toBe('delvis');
        expect(steg(w, /4\. Likvärdigt arbete/).textContent).toMatch(/0 av \d+ kandidatpar hanterade/);
        // När alla punkter för lika respektive likvärdigt arbete är hanterade blir stegen klara.
        const punkter = w.eval('buildActionChecklist()');
        const done = w.__state._actionChecklistDone || (w.__state._actionChecklistDone = new w.Set());
        punkter.filter(p => ['Lika arbete', 'Lika arbete, fördjupning', 'Likvärdigt arbete'].includes(p.kategori)).forEach(p => done.add(p.id));
        w.__renderProcessTracker();
        expect(status(w, /3\. Lika arbete/)).toBe('klar');
        expect(status(w, /4\. Likvärdigt arbete/)).toBe('klar');
    });

    it('processöversikten: inga kandidatpar betyder att likvärdigt arbete är klart', () => {
        const w = createAppWindow();
        w.__loadDemoData();
        w.__state.likvardighet.result = { pairs: [] };
        w.__renderProcessTracker();
        expect(status(w, /4\. Likvärdigt arbete/)).toBe('klar');
    });

    it('Att göra: kandidatparen i likvärdigt arbete kommer med även utan jämförelsestatistik', () => {
        const w = createAppWindow();
        w.__loadDemoData();
        expect(w.__state.statistik.length).toBe(0);
        expect(w.eval('buildActionChecklist()').filter(p => p.kategori === 'Likvärdigt arbete').length).toBeGreaterThan(0);
    });

    it('Börja här: könsrelaterade fynd går före avvikelser mot lönepolitiken, utan dubblerad rubrik', () => {
        const w = createAppWindow();
        w.__loadDemoData();
        w.eval('renderActionChecklist()');
        const forsta = w.document.querySelector('#att-gora-borja li .att-gora-kat').textContent;
        expect(['Lika arbete', 'Lika arbete, fördjupning', 'Likvärdigt arbete']).toContain(forsta.trim());
        expect(w.eval('buildActionChecklist()').filter(p => /^(Börja här|Värt att granska):/.test(p.titel))).toEqual([]);
    });
});

// Invariant för "Rensa all data" (Art. 17-affordansen, riskanalys.md §6.3):
// efter rensning får ingen lönedata finnas kvar någonstans i dokumentet — inte
// heller i dolda flikar eller attribut. Alla löner ligger i 87 600–87 699, så
// varje gruppmått (median, percentil, kvartilgräns) hamnar i samma intervall och
// syns som "876xx" när mellanslag mellan siffror tas bort.
describe('Rensa all data: ingen lönedata kvar i dokumentet (invariant)', () => {
    for (const [namn, rensa] of [['knappen Rensa all data', w => w.__clearAllData()],
                                 ['automatisk rensning vid inaktivitet', w => w.__autoClearOnInactivity()]]) {
    it(`${namn}: inget lönevärde kvar i någon flik`, async () => {
        const w = createAppWindow();
        const rader = [];
        for (let i = 0; i < 60; i++) {
            rader.push({ bas: ['A', 'B', 'C'][i % 3], kon: i % 2 ? 'man' : 'kvinna', lon: 87600 + i, alder: 25 + (i % 40),
                yrke: `${100 + (i % 2)} Yrke`, aid: String(100 + (i % 2)), yrkeLabel: 'Yrke', enhet: '1000' });
        }
        // En tydlig extremlön (187 6xx innehåller "876xx"), så att extremvärdesdetektorn
        // har något att visa.
        rader.push({ bas: 'A', kon: 'man', lon: 187650, alder: 50, yrke: '100 Yrke', aid: '100', yrkeLabel: 'Yrke', enhet: '1000' });
        w.__state.data = rader;
        w.eval('populateSelects(); unlockTabs();');
        for (const flik of ['dashboard', 'bestammelser', 'matrix', 'likvardighet', 'struktur', 'prioritering', 'loneoversyn',
                            'kon', 'demografi', 'benchmark', 'utforska', 'kvalitet', 'rapport', 'handlingsplan']) {
            try { w.__renderTabContent(flik); } catch (_e) { /* en flik utan data får kasta — det som ritats räknas */ }
        }
        w.eval('renderOutliers()');
        // Utskriftsrapporten byggs i dokumentet (window.print stubbas) — även den ska rensas.
        w.print = () => {};
        await w.eval('buildPrintReport()');
        await new Promise(r => setTimeout(r, 0));
        const kvar = () => {
            const ut = [];
            for (const el of w.document.body.querySelectorAll('*')) {
                if (el.children.length) continue;
                const t = `${el.textContent} ${attributtext(el)}`.replace(/(\d)[\s  ](?=\d)/g, '$1');
                if (/876\d\d/.test(t)) ut.push((el.closest('[id]') || el).id || el.tagName);
            }
            return [...new Set(ut)];
        };
        // Diagram ritade med diagramkärnan (ritaFigur, ADR-39) bär sin figur som egenskap på behållaren och visar
        // lönevärden i SVG-text och i verktygstipsets portal. Rensningen måste nå dem alla: ett vars id inte börjar
        // med "chart-", ett utan id, ett i tomt läge (figuren finns kvar fast inget ritas) och ett som har lämnat
        // dokumentet medan dess tips visas.
        const figur = (over = {}) => ({ beskrivning: 'Medianlön per BAS', x: { skala: 'band', titel: 'BAS' }, y: { skala: 'linjar', titel: 'Kronor/månad', format: 'kr' },
            lager: [{ marke: 'stapel', serie: 'Alla', tips: d => [['Lön', `${d.y} kr`]], data: [{ x: 'A', y: 87611, etikett: '87 611 kr' }, { x: 'B', y: 87622, etikett: '87 622 kr', ...over }] }] });
        const ny = id => { const el = w.document.createElement('div'); if (id) el.id = id; w.document.getElementById('view-dashboard').appendChild(el); return el; };
        const karnan = {
            'id utan chart-': ny('figur-utan-chart-id'), 'utan id': ny(''), 'vanligt id': ny('chart-karnan-test'),
            'tomt läge': ny('figur-tomt-lage'), 'bortkopplad med tips': ny('figur-bortkopplad'),
        };
        for (const [vad, el] of Object.entries(karnan)) {
            if (vad === 'tomt läge') w.__ritaFigur(el, { ...figur(), lager: [{ marke: 'stapel', serie: 'Alla', data: [{ x: 'A', y: 87633, liten: true }] }] });
            else w.__ritaFigur(el, figur());
            expect(el._figur, vad).toBeDefined();
        }
        expect(karnan['tomt läge'].querySelector('[data-rf="tom"]')).not.toBeNull();
        expect(karnan['utan id'].textContent.replace(/\s/g, '')).toContain('87611kr');
        karnan['bortkopplad med tips'].querySelector('[data-marke="stapel"]').dispatchEvent(new w.MouseEvent('pointermove', { bubbles: true, clientX: 5, clientY: 5 }));
        const portal = w.document.querySelector('.chart-tip-portal');
        expect(portal.textContent).toContain('87611 kr');
        karnan['bortkopplad med tips'].remove();
        expect(w.__rfTipsAgare()).toBe(karnan['bortkopplad med tips']);
        expect(kvar().length, 'testet måste först se lönedata i dokumentet').toBeGreaterThan(0);
        expect(kvar()).toContain('figur-utan-chart-id');
        rensa(w);
        expect(kvar()).toEqual([]);
        expect(w.__explorerMinne().rows).toBe(0);
        // Inget av diagramkärnans minne finns kvar: ingen figur på någon behållare (inte heller den bortkopplade),
        // inga lyssnare eller storleksbevakning, tomt register, tom portal, ingen ägare.
        for (const [vad, el] of Object.entries(karnan)) {
            expect(Object.keys(el).filter(k => k.startsWith('_') && k !== '_chartExportAttached'), vad).toEqual([]);
            expect(el.textContent, vad).toBe('');
        }
        expect(w.__rfBehallare()).toEqual([]);
        expect(portal.textContent).toBe('');
        expect(portal.classList.contains('visible')).toBe(false);
        expect(w.__rfTipsAgare()).toBeNull();
    });
    }
});

describe('Rensa all data tömmer Dokumentera', () => {
    it('färdigcheck och robusthet är tomma efter rensning', () => {
        const w = createAppWindow();
        w.__loadDemoData();
        w.document.querySelector('.nav-item[data-tab="dokumentera"]').click();
        w.__runRobusthet?.();
        expect(w.document.getElementById('fardigcheck-body').textContent.trim().length, 'färdigchecken ska ha ritats').toBeGreaterThan(0);
        w.__clearAllData();
        expect(w.document.getElementById('fardigcheck-body').textContent.trim()).toBe('');
        expect(w.document.getElementById('robusthet-body').textContent.trim()).toBe('');
    });
});

describe('k-anonymitet, sortering, efterlevnad och dossiern — k-anonymitet', () => {
    const rad = (bas, kon, lon) => ({ bas, kon, lon, alder: 40, yrke: '5301 Test', aid: '5301', yrkeLabel: 'Test', enhet: '' });

    it('k-anonymitet: efterlevnadsdiagrammet redovisar inte BAS under tröskeln', () => {
        const sparad = win.__state.data, sparadPolicy = win.__state.policy;
        try {
            // 6 personer i BAS A — under K_STANDARD (10)
            win.__state.data = Array.from({ length: 6 }, (_, i) => rad('A', i % 2 ? 'kvinna' : 'man', 26000 + i * 500));
            win.__state.policy = [{ bas: 'A', p10: 25000, med: 30000, p90: 40000 }];
            win.__state.kLage = 'export';   // så som diagrammet lämnar verktyget (ADR-51)
            win.__renderLonepolitik();
            const el = win.document.getElementById('chart-lp-compliance');
            expect(el).not.toBeNull();
            // Inget aggregat får ritas — i stället en förklaring om tröskeln
            expect(el.textContent).toMatch(/färre än 10 personer/);
        } finally {
            win.__state.data = sparad; win.__state.policy = sparadPolicy; win.__state.kLage = 'skarm';
        }
    });

    it('k-anonymitet: BAS över tröskeln redovisas fortfarande', () => {
        const sparad = win.__state.data, sparadPolicy = win.__state.policy;
        try {
            win.__state.data = Array.from({ length: 14 }, (_, i) => rad('A', i % 2 ? 'kvinna' : 'man', 26000 + i * 500));
            win.__state.policy = [{ bas: 'A', p10: 25000, med: 30000, p90: 40000 }];
            win.__renderLonepolitik();
            const el = win.document.getElementById('chart-lp-compliance');
            expect(el.textContent).not.toMatch(/färre än 10 personer/);
        } finally {
            win.__state.data = sparad; win.__state.policy = sparadPolicy;
        }
    });
});

describe('Rensa all data står i Inställningar', () => {
    it('sidhuvudet har bara «Vad lagras?»; knappen ligger under rubriken Rensa i panelen', () => {
        const w = createAppWindow();
        const d = w.document;
        expect([...d.querySelectorAll('.top-header .gdpr-banner button')].map(b => b.textContent.trim())).toEqual(['Vad lagras?']);
        const knapp = d.getElementById('btn-clear-all-data');
        expect(knapp.closest('#installningar-modal')).toBeTruthy();
        expect(knapp.closest('section').querySelector('h3').textContent).toBe('Rensa');
        expect(knapp.classList.contains('btn-fara')).toBe(true);
    });
    it('knappen frågar först, rensar och stänger panelen; ett nej lämnar allt orört', () => {
        const w = createAppWindow();
        w.__loadDemoData();
        w.eval('oppnaInstallningar()');
        w.confirm = () => false;
        w.document.getElementById('btn-clear-all-data').click();
        expect(w.__state.data.length).toBeGreaterThan(0);
        expect(w.eval('installningarOppna()')).toBe(true);
        let fragor = 0;
        w.confirm = () => { fragor++; return true; };
        w.document.getElementById('btn-clear-all-data').click();
        expect(fragor).toBe(1);
        expect(w.__state.data.length).toBe(0);
        expect(w.eval('installningarOppna()')).toBe(false);
    });
    it('demoknappen har vit text på den mörka varningsfärgen', () => {
        const regel = /\.demo-mode-exit \{[^}]*\}/.exec(las('src/style.css'))[0];
        expect(regel).toContain('background: var(--status-varning);');
        expect(regel).toContain('color: var(--vit);');
    });
});

describe('«Vad lagras?»', () => {
    it('öppnas som övriga modaler (centrerad) och säger minne, inte RAM', () => {
        const w = createAppWindow();
        w.__loadDemoData();
        w.eval('openDataResidency()');
        expect(w.document.getElementById('data-residency-modal').style.display).toBe('flex');
        expect(w.document.getElementById('data-residency-modal').textContent).not.toMatch(/\bRAM\b/);
    });
});

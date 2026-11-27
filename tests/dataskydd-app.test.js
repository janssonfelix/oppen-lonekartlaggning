// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
// Dataskyddet i appen: säkerheten, Rensa all data, k-anonymiteten i det som ritas, formler i exporterade celler och
// vad verktyget lagrar.
import { describe, it, expect, beforeAll } from 'vitest';
import { createAppWindow, fonsteravtryck } from './helpers/app-harness.js';
import { fonster } from './helpers/ktroskel-rigg.js';
import { las } from './helpers/granssnitt-rigg.js';

let win;
// Varje flik i menyn: listan följer sidan, så att en ny flik kommer med.
const menyflikar = w => [...w.document.querySelectorAll('.nav-item[data-tab]')].map(e => e.dataset.tab);

beforeAll(() => {
    win = createAppWindow();
});

describe('säkerhet och dataskydd', () => {
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
        w.eval('fyllValjare(); lasUppFlikar(); ritaNyckeltal(); ritaLoneoversikt(); ritaLoneskillnadPerBas(lsBasVymodell());');
    };

    it('skadlig text i fil och organisationspaket skapar inga element i någon flik', async () => {
        const w = createAppWindow();
        skadligtUnderlag(w);
        for (const t of menyflikar(w)) w.__ritaFlik(t);
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
        w.eval('sattInaktivitetstid(0)');   // ingen väg runt låsningen
        expect(w.__state.inactivityTimeoutMin).toBe(45);
        w.eval('oppnaVadLagras()');
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
        w.eval('oppnaVadLagras()');
        expect(w.document.getElementById('inactivity-timeout-select').disabled).toBe(false);
        expect(w.document.getElementById('inactivity-last').hidden).toBe(true);
    });
    it('ett paket som sätter rensningstiden utan att låsa den: värdet gäller men går att ändra; Av kan inte låsas', () => {
        const w = createAppWindow();
        expect(lasPaket(w, inaktivitetsPaket({ inaktivitetMin: 60 })).ok).toBe(true);
        expect(w.__state.inactivityTimeoutMin).toBe(60);
        w.eval('sattInaktivitetstid(15)');
        expect(w.__state.inactivityTimeoutMin).toBe(15);
        const r = lasPaket(w, inaktivitetsPaket({ inaktivitetMin: 0, inaktivitetLast: true }));
        expect(r.ok).toBe(true);
        expect(r.meddelande).toMatch(/kan inte låsas i läget Av/);
        expect(w.__state.inactivityTimeoutMin).toBe(0);
        expect(w.__state.paketLas.inaktivitetMin).toBeNull();
        w.eval('sattInaktivitetstid(30)');
        expect(w.__state.inactivityTimeoutMin).toBe(30);
    });

    it('nedräkningen rensar när 60 sekunder gått, även om en dold flik bara hunnit köra ett tick', () => {
        const w = createAppWindow();
        w.__state.data = [{ bas: 'A', kon: 'kvinna', lon: 30000 }];
        let tick = null;
        w.setInterval = fn => { tick = fn; return 1; };   // intervallet körs för hand, som när webbläsaren stryper det
        const start = w.Date.now();
        w.Date.now = () => start;
        w.eval('_visaInaktivitetsvarning()');
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

    it('varningen är en dialog för tangentbordet: fokus på Förläng sessionen, fällan håller, Escape förlänger och fokus går tillbaka', async () => {
        const w = createAppWindow(), d = w.document;
        w.__state.data = [{ bas: 'A', kon: 'kvinna', lon: 30000 }];
        const fore = d.getElementById('btn-open-glossary');
        fore.focus();
        w.eval('_visaInaktivitetsvarning()');
        await new Promise(r => setTimeout(r, 60));
        const varning = d.querySelector('.inactivity-warn-overlay');
        expect(d.getElementById(varning.getAttribute('aria-labelledby')).textContent).toMatch(/Sessionen håller på att gå ut/);
        expect(d.activeElement.id).toBe('inactivity-extend');
        const tab = new w.KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
        d.activeElement.dispatchEvent(tab);
        expect(tab.defaultPrevented).toBe(true);
        expect(varning.contains(d.activeElement)).toBe(true);
        d.activeElement.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
        expect(d.querySelector('.inactivity-warn-overlay')).toBeNull();
        expect(w.__state.data).toHaveLength(1);
        expect(d.activeElement).toBe(fore);
    });

    it('tiden räknas på klockan: en dator som sovit förbi hela tiden rensas vid första provet, och musen förlänger inte', () => {
        const w = createAppWindow();
        w.__state.data = [{ bas: 'A', kon: 'kvinna', lon: 30000 }];
        let prov = null;
        w.setInterval = fn => { prov = fn; return 1; };   // intervallet körs för hand; under sömnen körs det inte alls
        const start = w.Date.now();
        w.Date.now = () => start;
        w.eval('sattInaktivitetstid(30)');
        w.Date.now = () => start + 10 * 60 * 1000;
        prov();
        expect(w.document.querySelector('.inactivity-warn-overlay')).toBeNull();
        // Locket fälls ned; tre timmar senare rör någon musen innan intervallet hunnit köra.
        w.Date.now = () => start + 3 * 60 * 60 * 1000;
        w.dispatchEvent(new w.Event('mousemove'));
        expect(w.__state.data).toEqual([]);
        expect(w.document.body.textContent).toMatch(/Sessionen rensades/);
    });

    it('tiden räknas på klockan: i den sista minuten visar provet varningen, och aktivitet före den förlänger', () => {
        const w = createAppWindow();
        w.__state.data = [{ bas: 'A', kon: 'kvinna', lon: 30000 }];
        let prov = null;
        w.setInterval = fn => { prov = prov || fn; return 1; };   // det första intervallet är timerns, nästa varningens
        const start = w.Date.now();
        w.Date.now = () => start;
        w.eval('sattInaktivitetstid(30)');
        w.Date.now = () => start + 20 * 60 * 1000;
        w.dispatchEvent(new w.Event('keydown'));   // aktivitet efter 20 minuter: tiden räknas därifrån
        w.Date.now = () => start + 48 * 60 * 1000;
        prov();
        expect(w.document.querySelector('.inactivity-warn-overlay')).toBeNull();
        w.Date.now = () => start + 49 * 60 * 1000 + 1000;
        prov();
        expect(w.document.querySelector('.inactivity-warn-overlay')).not.toBeNull();
        expect(w.__state.data).toHaveLength(1);
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
        w.eval('oppnaVadLagras()');
        valj(0);
        expect(w.__state.inactivityTimeoutMin).toBe(0);
        expect(w.document.getElementById('inactivity-status').textContent).toBe('Av');
    });
});

// Invariant för "Rensa all data" (Art. 17-affordansen, riskanalys.md §6.3): efter rensningen är fönstret som ett
// färskt fönster. Det jämförs post för post (fonsteravtryck i app-harness.js): dokumentet med dolda flikar och
// attribut, formulärfälten, state och modulernas toppnivåminnen. Provet har ingen lista över behållare eller minnen:
// det som skiljer mot det färska fönstret är det som rensningen missar, också i en ny vy eller ett nytt minne.
// Det enda som får skilja är toppnivåminnen som inte bär något ur underlaget:
const FAR_SKILJA = new Set([
    // Räknare och tider: de säger bara att något har hänt (ADR-81 räknar varje ändring, också rensningen).
    'toppnivå _visningsversion', 'toppnivå _ritGeneration', 'toppnivå _ritadVid', 'toppnivå _flikRunda', 'toppnivå _visadSom',
    'toppnivå _flikVal', 'toppnivå _valRaknare', 'toppnivå _rmHandelser', 'toppnivå _diagramexportNr', 'toppnivå _sistaAktivitet',
    // Uppslag ur verktygets egna tabeller och talformat, byggda första gången de behövs: AID-katalogen, talformaten per
    // antal decimaler och tabellernas valbara kolumner.
    'toppnivå _index', 'toppnivå _svNf', 'toppnivå _rfNf', 'toppnivå _flerKolumnerTabeller',
    // Startläget som rensningen ställer tillbaka (26-rensning.js): sidan före all data. Det skiljer bara i vilka av
    // dess textnoder som ligger i dokumentet, när en text skrivits om med samma innehåll.
    'toppnivå _startnoder', 'toppnivå _startegenskaper',
]);
describe('Rensa all data: fönstret är som ett färskt fönster (invariant)', () => {
    /** Det som skiljer ett fönster från det färska, utom det som får skilja. */
    const skiljerMot = farskt => { const fore = fonsteravtryck(farskt);
        return w => { const nu = fonsteravtryck(w); return [...new Set([...Object.keys(nu), ...Object.keys(fore)])].filter(k => nu[k] !== fore[k] && !FAR_SKILJA.has(k)); }; };
    for (const [namn, rensa] of [['knappen Rensa all data', w => w.__rensaAllData()],
                                 ['automatisk rensning vid inaktivitet', w => {
                                     w.__rensaVidInaktivitet();
                                     // Rutan som säger att sessionen rensades står kvar en stund; den bär inget ur underlaget.
                                     const ruta = [...w.document.body.children].find(e => e.textContent.includes('Sessionen rensades'));
                                     expect(ruta.textContent).not.toMatch(/\d/);
                                     ruta.remove();
                                 }]]) {
    it(`${namn}: ingenting kvar av underlaget eller av det användaren gjort med det`, async () => {
        const farskt = createAppWindow();
        const w = createAppWindow();
        const d = w.document, klicka = sel => /** @type {any} */ (d.querySelector(sel)).click();
        w.__lasInDemodata();
        for (const flik of menyflikar(w)) klicka(`.nav-item[data-tab="${flik}"]`);
        w.eval('ritaExtremvarden()');
        w.print = () => {};
        await w.eval('byggUtskriftsrapport()');
        // Det användaren gör med underlaget: ett sökord, ett urval, en markerad grupp, en riktad rad och ett sparat
        // scenario i Löneöversyn, en avbockad punkt i Att göra.
        const { aid, bas } = w.__state.data[0];
        const sok = /** @type {any} */ (d.getElementById('search-rapport'));
        sok.value = bas;
        sok.dispatchEvent(new w.Event('input', { bubbles: true }));
        w.__utforskaSattFilter({ bas: [bas] });
        w.eval(`sattDiagramMarkering(${JSON.stringify(`grupp:${aid}|${bas}`)})`);
        klicka('#forecast-add-target');
        klicka('#forecast-save-a');
        klicka('#action-checklist-container input[type="checkbox"]');
        klicka('.nav-item[data-tab="rapporttext"]');
        // En utpekad verktygsfil i Organisationspaket.
        const verktyg = d.getElementById('file-input-verktygsfil');
        Object.defineProperty(verktyg, 'files', { value: [new w.File(['<html>'], 'verktyg.html')], configurable: true });
        verktyg.dispatchEvent(new w.Event('change'));
        // Dialogerna med en grupps tal: öppna när rensningen kommer, också när den kommer efter en tid utan aktivitet.
        w.eval(`oppnaGruppdossier(); oppnaBasdossier(${JSON.stringify(bas)})`);
        klicka('.btn-evidence[data-rapport-row]');
        klicka('[data-hp-skal]');
        w.eval('oppnaVadLagras()');
        klicka('#btn-open-symbols');
        // Diagram ritade med diagramkärnan (ritaFigur, ADR-39) bär sin figur som egenskap på behållaren och visar
        // lönevärden i SVG-text och i verktygstipsets portal. Rensningen måste nå dem alla: ett vars id inte börjar
        // med "chart-", ett utan id, ett i tomt läge (figuren finns kvar fast inget ritas) och ett som har lämnat
        // dokumentet medan dess tips visas.
        const figur = (over = {}) => ({ beskrivning: 'Medianlön per BAS', x: { skala: 'band', titel: 'BAS' }, y: { skala: 'linjar', titel: 'Kronor/månad', format: 'kr' },
            lager: [{ marke: 'stapel', serie: 'Alla', tips: d => [['Lön', `${d.y} kr`]], data: [{ x: 'A', y: 87611, etikett: '87 611 kr' }, { x: 'B', y: 87622, etikett: '87 622 kr', ...over }] }] });
        const ny = id => { const el = d.createElement('div'); if (id) el.id = id; d.getElementById('view-dashboard').appendChild(el); return el; };
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
        const portal = d.querySelector('.chart-tip-portal');
        expect(portal.textContent).toContain('87611 kr');
        karnan['bortkopplad med tips'].remove();
        expect(w.__rfTipsAgare()).toBe(karnan['bortkopplad med tips']);

        // Rensningen säger till skärmläsaren att allt är raderat: det färska fönstret får samma meddelande.
        farskt.eval("meddelaSkarmlasare('All data har raderats ur minnet.')");
        const vantaUt = () => new Promise(r => setTimeout(r, 100));   // meddelandet och det som räknas i bakgrunden hinner bli klart
        await vantaUt();
        const skiljerFran = skiljerMot(farskt), skiljer = () => skiljerFran(w);
        for (const vad of ['state data', 'state forecast', 'fält search-rapport', 'dokument #dossier-modal', 'dokument #data-residency-modal', 'dokument #symbols-modal']) {
            expect(skiljer(), `testet måste först se ${vad} ändrat`).toContain(vad);
        }
        rensa(w);
        await vantaUt();
        // Inget av diagramkärnans minne finns kvar på de tillagda behållarna: ingen figur (inte heller på den
        // bortkopplade), inga lyssnare eller storleksbevakning, ingen text. Sedan tas de bort, som inte finns i ett
        // färskt fönster.
        for (const [vad, el] of Object.entries(karnan)) {
            expect(Object.keys(el).filter(k => k.startsWith('_') && k !== '_chartExportAttached'), vad).toEqual([]);
            expect(el.textContent, vad).toBe('');
            el.remove();
        }
        expect(skiljer()).toEqual([]);
    });
    }
    it('efter ett organisationspaket: grundinställningarna, låsningarna och jämförelseurvalet går med paketet', async () => {
        const farskt = createAppWindow();
        const w = createAppWindow();
        const paket = { format: 'lonekartlaggning-organisationspaket', version: 1, organisation: { namn: 'Exempelorganisationen' }, skapat: '2026-10-08',
            installningar: { poPct: 45, manader: 13, kTroskel: 12, kTroskelLagst: 12, jamforelse: 'mansdominerade', inaktivitetMin: 30, inaktivitetLast: true, smaGrupperIExport: false },
            referens: { rader: [{ bas: 'A', p10: 20000, med: 25000, p90: 30000 }] } };
        expect(w.eval(`lasInPaket(${JSON.stringify(JSON.stringify(paket))}, 'x.lonepaket.json')`).ok).toBe(true);
        expect([w.__state.likvardighet.jamforelse, w.__state.costSettings.poPct, w.eval('kInstalld()')]).toEqual(['mansdominerade', 45, 12]);
        farskt.eval("meddelaSkarmlasare('All data har raderats ur minnet.')");
        w.__rensaAllData();
        await new Promise(r => setTimeout(r, 500));   // också startskärmen i det färska fönstret hinner tas bort
        expect(skiljerMot(farskt)(w)).toEqual([]);
    });
    it('det som får skilja finns i appen', () => {
        const avtryck = fonsteravtryck(win);
        expect([...FAR_SKILJA].filter(k => !(k in avtryck))).toEqual([]);
    });
});

describe('Rensa all data: något att rensa', () => {
    // Samma regel för knappen och för rensningen vid inaktivitet: det som rensningen ställer tillbaka.
    it('en konfigurationsfil utan lönefil går att rensa, och rensningen vid inaktivitet gäller den', () => {
        const a = createAppWindow();
        a.__lasInDemodata();
        a.__state._actionChecklistDone = new Set(['gap-bas-C']);
        const konfiguration = a.__byggKonfiguration();
        const w = createAppWindow();
        w.__tillampaKonfiguration(konfiguration);
        expect(w.__state.data.length).toBe(0);
        w.dispatchEvent(new w.MouseEvent('mousemove'));
        expect(w.eval('_inaktivitetstimer')).toBeTruthy();
        let fragor = 0;
        w.confirm = () => { fragor++; return true; };
        w.document.getElementById('btn-clear-all-data').click();
        expect(fragor).toBe(1);
        expect([...w.__state._actionChecklistDone || []]).toEqual([]);
        expect(w.__state.handlingsplan).toEqual({});
    });
    it('utan något inläst säger knappen att inget finns att rensa, och ingen tid räknas', () => {
        const w = createAppWindow();
        w.dispatchEvent(new w.MouseEvent('mousemove'));
        expect(w.eval('_inaktivitetstimer')).toBeNull();
        let fragor = 0;
        w.confirm = () => { fragor++; return true; };
        w.document.getElementById('btn-clear-all-data').click();
        expect(fragor).toBe(0);
    });
});

describe('Rensa all data tömmer Dokumentera', () => {
    it('färdigcheck och robusthet är tomma efter rensning', () => {
        const w = createAppWindow();
        w.__lasInDemodata();
        w.document.querySelector('.nav-item[data-tab="dokumentera"]').click();
        w.__korRobusthet();
        expect(w.document.getElementById('fardigcheck-body').textContent.trim().length, 'färdigchecken ska ha ritats').toBeGreaterThan(0);
        w.__rensaAllData();
        expect(w.document.getElementById('fardigcheck-body').textContent.trim()).toBe('');
        expect(w.document.getElementById('robusthet-body').textContent.trim()).toBe('');
    });
});

describe('efterlevnadsdiagrammet och minsta gruppstorlek', () => {
    const rad = (bas, kon, lon) => ({ bas, kon, lon, alder: 40, yrke: '5301 Test', aid: '5301', yrkeLabel: 'Test', enhet: '' });

    it('k-anonymitet: efterlevnadsdiagrammet redovisar inte BAS under tröskeln', () => {
        const sparad = win.__state.data, sparadPolicy = win.__state.policy;
        try {
            // 6 personer i BAS A — under K_STANDARD (10)
            win.__state.data = Array.from({ length: 6 }, (_, i) => rad('A', i % 2 ? 'kvinna' : 'man', 26000 + i * 500));
            win.__state.policy = [{ bas: 'A', p10: 25000, med: 30000, p90: 40000 }];
            win.__state.kLage = 'export';   // så som diagrammet lämnar verktyget (ADR-51)
            win.__ritaLonepolitik();
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
            win.__state.kLage = 'export';   // samma läge som testet ovan: annars är tröskeln 1 och provet tomt
            win.__ritaLonepolitik();
            const el = win.document.getElementById('chart-lp-compliance');
            expect(el.textContent).not.toMatch(/färre än 10 personer/);
            expect(el._figur).toBeDefined();
        } finally {
            win.__state.data = sparad; win.__state.policy = sparadPolicy; win.__state.kLage = 'skarm';
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
        w.__lasInDemodata();
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
        w.__lasInDemodata();
        w.eval('oppnaVadLagras()');
        expect(w.document.getElementById('data-residency-modal').style.display).toBe('flex');
        expect(w.document.getElementById('data-residency-modal').textContent).not.toMatch(/\bRAM\b/);
    });
});

describe('autocomplete="off" på alla fält, också de som skapas efter start', () => {
    const utan = d => [...d.querySelectorAll('input, textarea, select')]
        .filter(el => el.type !== 'file' && el.getAttribute('autocomplete') !== 'off')
        .map(el => `${el.tagName.toLowerCase()}#${el.id || '?'}[name=${el.name || ''}][type=${el.type || ''}]`);
    it('efter att alla flikar ritats och riktade rader lagts till saknar inget fält attributet', async () => {
        const w = fonster(null);
        for (const f of menyflikar(w)) w.__ritaFlik(f);
        w.__state.forecast.targets.push({ bas: 'A', aid: '5300', mode: 'kr', value: 500, dist: 'lowest', targetLevel: 'median', pool: 'övrigt' });
        w.eval('ritaRiktadeRader()');
        // Fält som en knapp skapar (de riktade raderna) får attributet av observatören, strax efter.
        expect(w.document.querySelectorAll('#forecast-targets select, #forecast-targets input').length).toBeGreaterThan(3);
        await new Promise(r => setTimeout(r, 0));
        // Anteckningsfälten i Regler & praxis skapas vid start och ska ha attributet i mallen.
        const not = w.document.getElementById('bes8-note-1');
        expect(not).not.toBeNull();
        expect(not.getAttribute('autocomplete')).toBe('off');
        expect(w.document.querySelectorAll('input[type="text"], textarea').length).toBeGreaterThan(10);
        expect(utan(w.document)).toEqual([]);
    });
    it('ett fält som läggs till senare får attributet av observatören', async () => {
        const w = fonster(null);
        w.eval("const d = document.createElement('div'); d.innerHTML = '<input type=\"text\" id=\"sent-falt\"><textarea id=\"sent-text\"></textarea>'; document.body.appendChild(d);");
        await new Promise(r => setTimeout(r, 0));
        expect(w.document.getElementById('sent-falt').getAttribute('autocomplete')).toBe('off');
        expect(w.document.getElementById('sent-text').getAttribute('autocomplete')).toBe('off');
    });
});

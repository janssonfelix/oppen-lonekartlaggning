/**
 * K-tröskeln som inställning: ett litet kön i regressionen, Löneöversyn, egna riktade rader och Ålder & karriär (R1–R4), omritningen från gränssnittet och ADR-47.
 *
 * Riggen (fixturer, fönster och sökfunktioner) ligger i tests/helpers/ktroskel-rigg.js; sviten är delad i
 * åtta filer så att Vitest fördelar den över flera arbetare.
 */
import { describe, it, expect, vi } from 'vitest';
import { createAppWindow } from './helpers/app-harness.js';
import { FLIKAR, normalisera, synliga, fonster, ritaAlla, oppnaFlik, KON_MA, ENSAM, KON_GAP, fonsterKon, harNagon, laddaXlsx, fangaBocker, utskriftAv, samlaUtdata, sammanhang, SJU_MAN, fonsterMan, tvaDec, somTal, andelText, SENT_MELLAN, SENT_SMA, iExport } from './helpers/ktroskel-rigg.js';

// Sviten ritar om hela verktyget i varje test. Under full last tar ett test 4–6 s, så standardgränsen 5 s
// fäller olika tester från körning till körning.
vi.setConfig({ testTimeout: 30000 });

describe('R1: regressionens ojusterade steg ("Endast kön") kräver tröskeln för varje kön', () => {
    const NOT = /ojusterade steget[^.]*visas inte[^.]*färre än 10 personer/;
    const tal = w => {
        const r = w.eval('runOLSRegression()');
        const steg = Object.fromEntries(r.sequential.map(s => [s.name, s.gapPct]));
        return { r, forsta: steg['Endast kön'], bas: steg['+ BAS-intervall'], justerat: r.konPct };
    };
    it('fixturen: regressionen körs med 7 män, och stegen skiljer sig åt (annars prövar testet inget)', () => {
        const { r, forsta, bas, justerat } = tal(fonsterMan(null, SJU_MAN));
        expect(r.error).toBeUndefined();
        expect(r.nMaAnalysed).toBe(7);
        expect(r.explainedShare).not.toBeNull();
        expect(new Set([forsta, bas, justerat].map(v => Math.abs(v).toFixed(2))).size).toBe(3);
    });
    it('på skärmen visar kortet första steget också med 7 män (ADR-51)', () => {
        const w = fonsterMan(null, SJU_MAN);
        w.__renderTabContent('matrix');
        expect(w.document.getElementById('regression-card').textContent).toMatch(/Endast kön/);
    });
    it('i exportläget vid 10: kortet i Lika arbete visar det justerade gapet men varken första steget, budgeten eller förklarad andel', () => {
        const w = iExport(fonsterMan(null, SJU_MAN));
        const { forsta, justerat } = tal(w);
        w.__renderTabContent('matrix');
        const kort = w.document.getElementById('regression-card');
        const t = normalisera(kort.innerHTML);
        expect(harNagon(t, tvaDec(forsta))).toEqual([]);
        expect(kort.textContent).not.toMatch(/Endast kön/);
        expect(kort.querySelector('.reg-budget')).toBeNull();   // budgeten visar skillnaderna mellan stegen
        expect(kort.textContent).not.toMatch(/av det råa lönegapet förklaras/);
        expect(kort.textContent).toMatch(NOT);
        expect(t).toMatch(somTal(justerat.toFixed(2)));
        // De kvarvarande staplarnas bredd räknas inte mot det dolda stegets värde.
        const bredder = [...kort.querySelectorAll('.step-bar-fill')].map(e => parseFloat(e.style.width));
        expect(bredder.length).toBeGreaterThan(0);
        expect(Math.max(...bredder)).toBe(100);
    });
    it('vid 10: Word-utkastet (med bilagan om det justerade lönegapet) och rapportunderlaget', () => {
        const w = fonsterMan(null, SJU_MAN);
        const { forsta, justerat } = tal(w);
        const ord = normalisera(w.__docDraftHtml());
        expect(ord).not.toMatch(/Endast kön\s+[+-−]?\s*\d/);
        expect(ord).not.toMatch(/Strukturellt förklarad andel/);
        expect(ord).toMatch(/Sekventiell dekomponering/);
        expect(ord).toMatch(NOT);
        expect(harNagon(ord, tvaDec(forsta))).toEqual([]);
        expect(ord).toMatch(somTal(justerat.toFixed(2)));
        const ru = normalisera(w.__rapportunderlagBlock().map(b => w.__ruTillWordHtml(b) + '\n' + w.__ruTillText(b)).join('\n'));
        expect(harNagon(ru, tvaDec(forsta))).toEqual([]);
    });
    it.each(['komplett', 'ledning', 'facklig'])('vid 10: utskriften (%s)', async mall => {
        const w = fonsterMan(null, SJU_MAN);
        const { forsta, justerat } = tal(w);
        const el = await utskriftAv(w, mall);
        const t = normalisera(el.innerHTML.replace(/src="data:[^"]*"/g, ''));
        expect(harNagon(t, tvaDec(forsta))).toEqual([]);
        expect(t).not.toMatch(/Strukturellt förklarad andel/);
        if (/Sekventiell dekomponering/.test(t)) {
            expect(el.textContent).toMatch(NOT);
            expect(t).toMatch(somTal(justerat.toFixed(2)));
        }
    });
    it('vid 10: utskriftens mallar komplett och facklig har avsnittet (annars prövar testet ovan inget)', async () => {
        for (const mall of ['komplett', 'facklig']) expect((await utskriftAv(fonsterMan(null, SJU_MAN), mall)).innerHTML, mall).toMatch(/Sekventiell dekomponering/);
    });
    it('vid 10: Excel-exporterna', async () => {
        const w = fonsterMan(null, SJU_MAN);
        const { forsta } = tal(w);
        for (const f of FLIKAR) w.__renderTabContent(f);
        await laddaXlsx(w);
        let antal = 0;
        for (const kor of [() => w.eval('exportAllToExcel()'), () => w.eval('exportEuReport()'), () => w.eval('exportJPAProtocol()'), () => w.eval('exportForecast()')]) {
            for (const [fil, text] of Object.entries(fangaBocker(w, kor))) { antal++; expect(harNagon(text, tvaDec(forsta)), fil).toEqual([]); }
        }
        expect(antal).toBeGreaterThanOrEqual(4);
    });
    it('vid 10: samma utdatavägar som invarianten (I4), utom skärmen — varken första steget eller männens median i någon av dem', async () => {
        const w = fonsterMan(null, SJU_MAN);
        // Referens och jämförelsestatistik, så att varje export har något att skriva (som fonsterKon).
        w.__state.policy = ['S1', 'S2'].map(bas => ({ bas, p10: 22000, med: 30000, p90: 52000 }));
        w.__state.statistik = ['S1', 'S2'].map(bas => ({ aid: '6000', bas, median: 60000, p10: 55000, p90: 71000 }));
        w.eval('populateSelects(); unlockTabs();');
        const { forsta } = tal(w);
        const utdata = await samlaUtdata(w);
        expect(utdata.length).toBeGreaterThan(20);
        const dolda = [...tvaDec(forsta), SJU_MAN[3]];   // männens median är den fjärde av sju löner
        const lackor = [];
        for (const [namn, text] of utdata.filter(([n]) => n !== 'skärm: alla flikar')) for (const v of harNagon(text, dolda)) lackor.push(`${namn}: ${v} — "${sammanhang(text, v)}"`);
        expect(lackor).toEqual([]);
    }, 120000);
    it('Blinder-Oaxaca (som delar upp det råa medelgapet) körs aldrig med ett kön under tröskeln: golvet är max(tröskeln, 10)', () => {
        for (const k of [null, 5, 7]) expect(fonsterMan(k, SJU_MAN).eval('runBlinderOaxaca()'), String(k)).toBeNull();
        const w = fonsterMan(null, SJU_MAN);
        w.__renderTabContent('matrix');
        expect(w.document.getElementById('blinder-oaxaca-card').textContent).toMatch(/För få observationer/);
    });
    it('vid 5: första steget och förklarad andel visas i kortet och utskriften', async () => {
        const w = fonsterMan(5, SJU_MAN);
        const { forsta } = tal(w);
        w.__renderTabContent('matrix');
        const kort = w.document.getElementById('regression-card');
        expect(kort.textContent).toMatch(/Endast kön/);
        expect(normalisera(kort.innerHTML)).toMatch(somTal(Math.abs(forsta).toFixed(2)));
        expect(kort.querySelector('.reg-budget')).not.toBeNull();
        expect(kort.textContent).not.toMatch(/ojusterade steget[^.]*visas inte/);
        for (const mall of ['komplett', 'facklig']) {
            const t = normalisera((await utskriftAv(w, mall)).innerHTML);
            expect(t, mall).toMatch(somTal(Math.abs(forsta).toFixed(2)));
            expect(t, mall).toMatch(/Strukturellt förklarad andel/);
        }
    });
});

describe('R2: Löneöversynens scenariojämförelse maskerar ett rågap som sparats vid en lägre tröskel', () => {
    it('i exportläget: sparat vid 5 med 7 män, rågapet visas vid 5 och döljs när tröskeln höjs till 10', () => {
        const w = iExport(fonsterMan(5, SJU_MAN));
        Object.assign(w.__state.forecast, { generell: { mode: 'pct', value: 2 } });
        oppnaFlik(w, 'loneoversyn');
        w.eval("_forecastSaveScenario('A')");
        const sparat = w.__state.forecast.scenarios.A.summary.rawGapEfter;
        expect(typeof sparat).toBe('number');
        const el = w.document.getElementById('forecast-scenarios');
        expect(normalisera(el.textContent)).toContain(andelText(sparat));   // visas som kvinnors median i % av mäns
        w.eval('sattKTroskel(10, { fraga: false })');
        expect(harNagon(normalisera(el.innerHTML), tvaDec(sparat))).toEqual([]);
        const celler = [...el.querySelectorAll('tbody tr')][0].children;
        expect(celler[3].textContent.trim()).toBe('–');
        expect(celler[4].textContent.trim()).not.toBe('–');   // det justerade gapet står kvar
        expect(el.textContent).toMatch(/färre än 10 personer/);
    });
    it('sparat scenario räknar spillover på grupperna över tröskeln, som utfallet i exportläget', () => {
        const w = iExport(fonsterKon(null));
        Object.assign(w.__state.forecast, { generell: { mode: 'pct', value: 2 },
            targets: [{ bas: 'S1', aid: '7001', mode: 'kr', value: 40000, dist: 'flat', targetLevel: 'median', pool: 'övrigt' }] });
        w.__renderTabContent('loneoversyn');
        const o = w.__state.forecast.result;
        // Antalet som utfallet på skärmen anger (grupper över tröskeln); kortet saknas när inget går om.
        const m = w.document.getElementById('forecast-outcome').textContent.match(/Spillover: (\d+) grupp/);
        const filtrerat = m ? Number(m[1]) : 0;
        expect((o.leapfrog || []).length).toBeGreaterThan(filtrerat);   // den ensamma personen går om andra grupper
        w.eval("_forecastSaveScenario('A')");
        expect(w.__state.forecast.scenarios.A.summary.leapfrog).toBe(filtrerat);
    });
});

describe('R3: en egen riktad rad på en grupp under tröskeln är tillåten och får en upplysning', () => {
    it('raden på en grupp om en person får noten; raden på en stor grupp får den inte', () => {
        const w = fonsterKon(null);
        w.__state.forecast.targets = [
            { bas: 'S1', aid: '7001', mode: 'pct', value: 10, dist: 'flat', targetLevel: 'median', pool: 'övrigt' },
            { bas: 'S1', aid: '6000', mode: 'pct', value: 10, dist: 'flat', targetLevel: 'median', pool: 'övrigt' }];
        w.__renderTabContent('loneoversyn');
        const host = w.document.getElementById('forecast-targets');
        const rader = [...host.querySelectorAll('.forecast-target-row')];
        expect(rader).toHaveLength(2);
        const noter = [...host.querySelectorAll('.k-mask-note')];
        expect(noter).toHaveLength(1);
        expect(noter[0].previousElementSibling).toBe(rader[0]);
        expect(noter[0].textContent).toMatch(/Raden berör 1 person, färre än 10 personer — beloppet bygger på enskildas löner/);
        // Beloppet räknas utan filtrering av användarens egen rad.
        expect(normalisera(rader[0].textContent)).toContain(String(Math.round(ENSAM * 0.1)));
    });
    it('beloppet för en egen rad på en ensam person ingår i Excel-exportens summor (dokumenterat, inte filtrerat)', async () => {
        const w = fonsterKon(null);
        w.__state.forecast.targets = [{ bas: 'S1', aid: '7001', mode: 'pct', value: 10, dist: 'flat', targetLevel: 'median', pool: 'övrigt' }];
        w.__renderTabContent('loneoversyn');
        await laddaXlsx(w);
        const blad = Object.values(fangaBocker(w, () => w.eval('exportForecast()')))[0].split('[Sammanfattning]')[1].split('[')[0].split('\n');
        const belopp = String(Math.round(ENSAM * 0.1));   // en persons lön gånger procentsatsen
        for (const rad of ['Använt (kr/mån)', 'Riktat (kr/mån)', 'Varav till kvinnodominerade grupper (kr/mån)'])
            expect(blad.find(r => r.startsWith(rad + ' |')), rad).toBe(`${rad} | ${belopp}`);
    });
    it('noten följer tröskeln: vid 25 får också en grupp om 20 den', () => {
        const w = fonsterKon(25);
        w.__state.forecast.targets = [{ bas: 'A', aid: '5300', mode: 'pct', value: 10, dist: 'flat', targetLevel: 'median', pool: 'övrigt' }];
        w.__renderTabContent('loneoversyn');
        expect(w.document.querySelector('#forecast-targets .k-mask-note').textContent).toMatch(/färre än 25 personer/);
    });
});

describe('R4: Ålder & karriär följer regeln för könsuppdelade mått', () => {
    const TRE_MAN = [41417, 43719, 47827];
    // Serierna i ett diagram ritat av diagramkärnan (ADR-39); för lådagrammet de kön som har en låda.
    const namn = (w, id) => {
        const f = w.document.getElementById(id)._figur;
        if (!f) return [];
        return id === 'chart-kon-boxplot' ? [...new Set(f.lager.flatMap(l => l.data.map(d => d.x)))] : f.lager.map(l => l.serie);
    };
    it('på skärmen med 3 män: gap, låda och trendlinje för män visas (ADR-51)', () => {
        const w = fonsterMan(null, TRE_MAN);
        w.__renderTabContent('kon');
        expect(namn(w, 'chart-kon-boxplot')).toEqual(['Kvinna', 'Man']);
        expect(w.document.getElementById('kon-kpi-gap').textContent).toMatch(/^\d+,\d\s%$/);
    });
    it('i exportläget vid 10 med 3 män: inget gap, inga mått för män, ingen låda och ingen trendlinje för män; punkterna står kvar', () => {
        const w = iExport(fonsterMan(null, TRE_MAN));
        w.__renderTabContent('kon');
        const d = w.document;
        const kvLoner = w.__state.data.filter(r => r.kon === 'kvinna').map(r => r.lon).sort((x, y) => x - y);
        const kvMed = (kvLoner[29] + kvLoner[30]) / 2;
        const gap = (kvMed / TRE_MAN[1] * 100).toFixed(1);
        expect(d.getElementById('kon-kpi-gap').textContent.trim()).toBe('–');
        expect(d.getElementById('kon-kpi-agegap').textContent.trim()).toBe('–');
        expect(d.getElementById('kon-kpi-slope').textContent).toMatch(/ \/ – kr$/);                 // kvinnor / män: männens lutning visas inte
        const vy = normalisera(d.getElementById('view-kon').textContent);
        expect(harNagon(vy, [gap, gap.replace('.', ','), ...TRE_MAN])).toEqual([]);
        expect(d.getElementById('p-value-insight').textContent).not.toMatch(/R² Man/);
        expect(vy).toMatch(/färre än 10 personer/);
        expect(namn(w, 'chart-kon-boxplot')).toEqual(['Kvinna']);
        const spridning = namn(w, 'chart-kon-scatter');
        expect(spridning).toContain('Kvinna (trend)');
        expect(spridning).toContain('Kvinna 95 % KI');
        expect(spridning).not.toContain('Man (trend)');
        expect(spridning).not.toContain('Man 95 % KI');
        expect(spridning).toContain('Man');   // de enskilda punkterna visas (öppen fråga, ADR-14)
        for (const id of ['chart-kon-boxplot', 'chart-kon-scatter']) {
            expect(d.getElementById(id + '-k-not').textContent, id).toMatch(/färre än 10 personer/);
            expect(d.getElementById(id).querySelector(':scope > svg').getAttribute('aria-label'), id).not.toContain(gap);
        }
        // Exporterad diagramdata är det som ritats.
        const rader = w.__chartExportRows(d.getElementById('chart-kon-boxplot')).map(r => r.join(' | ')).join('\n');
        expect(harNagon(normalisera(rader), TRE_MAN)).toEqual([]);
    });
    it('ett valt BAS med 30 kvinnor och en man: samma regel som för hela urvalet (exportläget)', () => {
        const w = iExport(fonsterKon(null));
        w.__renderTabContent('kon');
        w.eval("renderKon('Y1')");
        const d = w.document;
        expect(d.getElementById('kon-kpi-gap').textContent.trim()).toBe('–');
        expect(d.getElementById('kon-kpi-slope').textContent.replace(/[\u00a0\u202f]/g, ' ')).toMatch(/^[+−][\d ]+ \/ – kr$/);
        expect(namn(w, 'chart-kon-boxplot')).toEqual(['Kvinna']);
        expect(namn(w, 'chart-kon-scatter')).not.toContain('Man (trend)');
        expect(harNagon(normalisera(d.getElementById('view-kon').textContent), [KON_MA[0], ...KON_GAP.slice(0, 4)])).toEqual([]);
        // Tillbaka till hela urvalet, där båda könen är många: noterna försvinner.
        w.eval("renderKon('__ALLA__')");
        expect(d.getElementById('chart-kon-boxplot-k-not')).toBeNull();
        expect(namn(w, 'chart-kon-boxplot')).toEqual(['Kvinna', 'Man']);
    });
    it('färgläggning efter BAS: könens trendlinjer följer samma regel (exportläget)', () => {
        const w = iExport(fonsterMan(null, TRE_MAN));
        w.__renderTabContent('kon');
        w.document.getElementById('kon-color-by').value = 'bas';
        w.eval("renderKon('__ALLA__')");
        const spridning = namn(w, 'chart-kon-scatter');
        expect(spridning).toContain('Kvinna (trend)');
        expect(spridning).not.toContain('Man (trend)');
    });
    it('vid 3 (männens antal): gap, låda och trendlinje finns, och ingen not (exportläget)', () => {
        const w = iExport(fonsterMan(3, TRE_MAN));
        w.__renderTabContent('kon');
        const d = w.document;
        expect(d.getElementById('kon-kpi-gap').textContent).toMatch(/^\d+,\d\s%$/);   // svenskt format: decimalkomma, mellanslag före %
        expect(d.getElementById('kon-kpi-agegap').textContent).toMatch(/^\d+,\d\s%$/);
        expect(namn(w, 'chart-kon-boxplot')).toEqual(['Kvinna', 'Man']);
        expect(namn(w, 'chart-kon-scatter')).toEqual(expect.arrayContaining(['Man (trend)', 'Man 95 % KI', 'Kvinna (trend)']));
        expect(d.getElementById('chart-kon-boxplot-k-not')).toBeNull();
        // Noten säger inget om en utelämnad trendlinje (den kan finnas ändå, om personer i grupper under tröskeln inte visas som punkt).
        expect(d.getElementById('chart-kon-scatter-k-not')?.textContent || '').not.toMatch(/Trendlinje och konfidensband visas inte/);
    });
    it('noten tas bort när tröskeln sänks så att könet når den (exportläget)', () => {
        const w = iExport(fonsterMan(null, TRE_MAN));
        oppnaFlik(w, 'kon');
        expect(w.document.getElementById('chart-kon-boxplot-k-not')).not.toBeNull();
        w.eval('sattKTroskel(3, { fraga: false })');
        expect(w.document.getElementById('chart-kon-boxplot-k-not')).toBeNull();
        expect(namn(w, 'chart-kon-boxplot')).toEqual(['Kvinna', 'Man']);
    });
});

describe('omritning efter ändrad tröskel från gränssnittet: stegvis, med förlopp, och spärrad tills den är klar', () => {
    // Stegen är få (Översikts delar och den öppna fliken), men spärren och förloppet gäller ändå.
    it('fältet ritar om stegvis: en ruta visar förloppet och tar emot klick och tangenter tills inget bär den gamla tröskeln', async () => {
        const w = fonster(null);
        ritaAlla(w);
        const d = w.document;
        const ritade = [];
        const org = w.renderTabContent;
        w.renderTabContent = t => { ritade.push(t); return org(t); };
        let klick = 0;
        d.body.addEventListener('click', () => { klick++; });
        const f = d.getElementById('k-troskel');
        f.value = '25';
        f.dispatchEvent(new w.Event('change', { bubbles: true }));
        // Direkt efter ändringen: tröskeln gäller, rutan visas, inget är omritat än och sidan tar inte emot klick.
        expect(w.eval('kInstalld()')).toBe(25);
        const ruta = d.getElementById('omritning-ruta');
        expect(ruta).not.toBeNull();
        expect(ruta.getAttribute('role')).toBe('status');
        expect(ritade).toEqual([]);
        d.getElementById('btn-export-zip').dispatchEvent(new w.Event('click', { bubbles: true, cancelable: true }));
        expect(klick).toBe(0);
        // En ändring till medan omritningen pågår når inte fältets hanterare (spärrad), och startar ingen ny omritning.
        f.value = '30';
        f.dispatchEvent(new w.Event('change', { bubbles: true }));
        expect(w.eval('kInstalld()')).toBe(25);
        await w.eval('_renderaOmAllaFlikarStegvis()');
        expect(d.getElementById('omritning-ruta')).toBeNull();
        const oppen = d.querySelector('.nav-item.active[data-tab]').getAttribute('data-tab');
        expect(ritade).toEqual([oppen]);                                   // bara den öppna fliken, en gång; övriga töms
        expect(synliga(w, [...SENT_MELLAN, ...SENT_SMA])).toEqual([]);         // ingen mellangrupp eller liten grupp syns längre någonstans
        d.body.dispatchEvent(new w.Event('click', { bubbles: true }));
        expect(klick).toBe(1);                                             // spärren är släppt
    });
    it('programanrop utan stegvis ritar om direkt; stegvis ger ett löfte', async () => {
        const w = fonster(null);
        ritaAlla(w);
        const r = w.eval('sattKTroskel(25, { fraga: false })');
        expect(r).toEqual({ ok: true, varde: 25, andrad: true });
        expect(w.document.getElementById('omritning-ruta')).toBeNull();
        const r2 = w.eval('sattKTroskel(10, { fraga: false, stegvis: true })');
        expect(typeof r2.klar.then).toBe('function');
        expect(w.eval('_renderaOmAllaFlikarStegvis()')).toBe(r2.klar);     // samma omritning, inte en till
        await r2.klar;
        expect(w.document.getElementById('omritning-ruta')).toBeNull();
    }, 20000);   // ritar om alla flikar tre gånger: under full last räcker inte standardgränsen
});

describe('k-tröskeln: lägsta tillåtna värde ur organisationspaketet (ADR-47)', () => {
    const paket = (inst, namn = 'Exempelorganisationen') => ({ format: 'lonekartlaggning-organisationspaket', version: 1,
        organisation: { namn }, skapat: '2026-10-08', installningar: inst,
        referens: { rader: [{ bas: 'A', p10: 20000, med: 25000, p90: 30000 }] } });
    const las = (w, p) => w.eval(`lasInPaket(${JSON.stringify(JSON.stringify(p))}, 'x.lonepaket.json')`);
    // Ett fönster med ett paket som sätter golvet (och tröskeln, när den anges).
    const medGolv = (golv, k) => {
        const w = createAppWindow();
        expect(las(w, paket({ kTroskelLagst: golv, ...(k !== undefined ? { kTroskel: k } : {}) })).ok).toBe(true);
        return w;
    };
    const andra = (w, v) => { const f = w.document.getElementById('k-troskel'); f.value = v; f.dispatchEvent(new w.Event('change', { bubbles: true })); return f; };

    it('paketets golv höjer gällande tröskel när den ligger under, utan fråga', () => {
        const w = createAppWindow();
        let fragor = 0;
        w.confirm = () => { fragor++; return false; };
        const r = las(w, paket({ kTroskelLagst: 15 }));
        expect(r.ok).toBe(true);
        expect(r.meddelande).toMatch(/höjs till 15/);
        expect(w.eval('kInstalld()')).toBe(15);
        expect(w.eval('kTroskelLagst()')).toBe(15);
        expect(fragor).toBe(0);
        expect(w.document.getElementById('paket-info').textContent).toMatch(/minsta gruppstorlek lägst 15/);
    });
    it('fältet: ett värde under golvet avvisas med felet vid fältet, och fältet återfår gällande värde', () => {
        const w = medGolv(8, 12);
        const f = andra(w, '5');
        expect(w.eval('kInstalld()')).toBe(12);
        expect(f.value).toBe('12');
        expect(f.min).toBe('8');
        const fel = w.document.getElementById('k-troskel-fel');
        expect(fel.hidden).toBe(false);
        expect(fel.textContent).toBe('Lägst 8 enligt organisationspaketet.');
        expect(w.document.getElementById('k-troskel-hjalp').textContent).toMatch(/lägst 8 enligt organisationspaketet/);
        // Ett värde på golvet, under 10, godtas efter bekräftelse; felet försvinner.
        w.confirm = () => true;
        andra(w, '8');
        expect(w.eval('kInstalld()')).toBe(8);
        expect(fel.hidden).toBe(true);
    });
    it('sattKTroskel avvisar värdet under golvet också utan fråga', () => {
        const w = medGolv(8, 12);
        expect(w.eval('sattKTroskel(7, { fraga: false })')).toEqual({ ok: false, fel: 'Lägst 8 enligt organisationspaketet.' });
        expect(w.eval('kInstalld()')).toBe(12);
    });
    it('konfigurationsfilen: ett värde under golvet används inte, resten läses in, och felet står vid fältet', () => {
        const a = createAppWindow();
        a.eval('sattKTroskel(5, { fraga: false })');
        const cfg = JSON.parse(JSON.stringify(a.__buildConfigSnapshot()));
        cfg.orgName = 'Ur filen';
        expect('kTroskelLagst' in cfg).toBe(false);   // konfigurationsfilen bär inte låsningarna
        const b = medGolv(8, 12);
        let fragor = 0;
        b.confirm = () => { fragor++; return true; };
        b.__cfg = cfg;
        const r = b.eval('applyConfigSnapshot(window.__cfg)');
        expect(r.varningar).toEqual(['Filens minsta gruppstorlek 5 används inte: Lägst 8 enligt organisationspaketet.']);
        expect(fragor).toBe(0);
        expect(b.eval('kInstalld()')).toBe(12);
        expect(b.eval('orgNamn("")')).toBe('Ur filen');
        expect(b.document.getElementById('k-troskel-fel').hidden).toBe(false);
    });
    it('ett nytt paket med lägre golv: nekad bekräftelse behåller golvet, och paketets tröskel under golvet används inte', () => {
        const w = medGolv(8, 12);
        let fragor = 0;
        w.confirm = () => { fragor++; return false; };
        const r = las(w, paket({ kTroskelLagst: 3, kTroskel: 5 }, 'Andra organisationen'));
        expect(r.ok).toBe(true);
        expect(fragor).toBe(1);
        expect(w.eval('kTroskelLagst()')).toBe(8);
        expect(w.eval('kInstalld()')).toBe(12);
        expect(r.meddelande).toMatch(/Det förra paketets lägsta tillåtna minsta gruppstorlek 8 behålls/);
        expect(r.meddelande).toMatch(/5 används inte: Lägst 8 enligt organisationspaketet/);
        expect(w.eval('orgNamn("")')).toBe('Andra organisationen');   // resten av paketet läses in
    });
    it('ett nytt paket utan golv: nekad bekräftelse behåller golvet; godkänd tar bort det', () => {
        const w = medGolv(8);
        w.confirm = () => false;
        las(w, paket({}, 'Andra organisationen'));
        expect(w.eval('kTroskelLagst()')).toBe(8);
        w.confirm = () => true;
        las(w, paket({}, 'Tredje organisationen'));
        expect(w.eval('kTroskelLagst()')).toBeNull();
        expect(w.eval('sattKTroskel(5, { fraga: false })').ok).toBe(true);
    });
    it('ett nytt paket med lägre golv: godkänd bekräftelse sänker golvet, och tröskeln under 10 frågar för sig', () => {
        const w = medGolv(8, 12);
        const fragor = [];
        w.confirm = t => { fragor.push(t); return true; };
        las(w, paket({ kTroskelLagst: 3, kTroskel: 5 }, 'Andra organisationen'));
        expect(fragor).toHaveLength(2);
        expect(fragor[0]).toMatch(/från 8 till 3/);
        expect(w.eval('kTroskelLagst()')).toBe(3);
        expect(w.eval('kInstalld()')).toBe(5);
    });
    it('ett högre golv i ett nytt paket kräver ingen bekräftelse och höjer tröskeln', () => {
        const w = medGolv(8);
        let fragor = 0;
        w.confirm = () => { fragor++; return false; };
        las(w, paket({ kTroskelLagst: 20 }, 'Andra organisationen'));
        expect(fragor).toBe(0);
        expect(w.eval('kTroskelLagst()')).toBe(20);
        expect(w.eval('kInstalld()')).toBe(20);
    });
    it('återställningsknappen går till golvet när det är över 10', () => {
        const w = medGolv(15, 20);
        const knapp = w.document.getElementById('btn-k-aterstall');
        expect(knapp.hidden).toBe(false);
        expect(knapp.textContent).toBe('Återställ till 15');
        knapp.click();
        expect(w.eval('kInstalld()')).toBe(15);
        expect(knapp.hidden).toBe(true);
    });
    it('Rensa all data tar bort golvet: hjälptext och gräns återgår, och 5 går att sätta igen', () => {
        const w = medGolv(8, 12);
        w.eval('_rensaAllData()');
        expect(w.eval('kTroskelLagst()')).toBeNull();
        expect(w.eval('kInstalld()')).toBe(10);
        expect(w.document.getElementById('k-troskel-hjalp').textContent).toBe('Standard 10. Ändringen räknar om alla flikar.');
        expect(w.document.getElementById('k-troskel').min).toBe('2');
        expect(w.document.getElementById('btn-k-aterstall').textContent).toBe('Återställ till 10');
        expect(w.eval('sattKTroskel(5, { fraga: false })').ok).toBe(true);
    });
    it('paketformuläret: golvet fylls i, följer med i paketet, och en tröskel under golvet stoppar sparandet', () => {
        const w = medGolv(8, 12);
        expect(w.document.getElementById('paket-k-lagst').value).toBe('8');
        expect(w.eval('skapaPaket()').installningar).toMatchObject({ kTroskel: 12, kTroskelLagst: 8 });
        w.document.getElementById('paket-k').value = '5';
        w.eval('uppdateraPaketKnapp()');
        expect(w.document.getElementById('paket-sammanfattning').textContent).toMatch(/Minsta gruppstorlek 5 är lägre än lägsta tillåtna 8/);
        w.document.getElementById('btn-paket-spara').click();
        expect(w.document.getElementById('paket-status').textContent).toMatch(/sparades inte.*5 är lägre än lägsta tillåtna 8/);
        w.document.getElementById('paket-k-lagst').value = '1';
        w.document.getElementById('btn-paket-spara').click();
        expect(w.document.getElementById('paket-status').textContent).toMatch(/sparades inte.*Lägsta tillåtna minsta gruppstorlek: Ange ett heltal mellan 2 och 1000/);
    });
});

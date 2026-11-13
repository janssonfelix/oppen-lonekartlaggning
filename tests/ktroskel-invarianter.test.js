/**
 * K-tröskeln som inställning: Löneöversyn (I1) och invarianten över flikar och exporter vid 10 (I4).
 *
 * Riggen (fixturer, fönster och sökfunktioner) ligger i tests/helpers/ktroskel-rigg.js; sviten är delad i
 * flera filer så att Vitest fördelar den över flera arbetare. Invarianten (tests/helpers/ktroskel-invariant.js)
 * körs vid 25 i tests/ktroskel-invarianter-25.test.js, med sakliga skäl (I5): förberedelsen tar omkring en minut,
 * så de två förberedelserna ligger i var sin fil.
 *
 * Vaktar: S4 (docs/utveckling/regler.md)
 */
import { describe, it, expect, vi } from 'vitest';
import { createAppWindow } from './helpers/app-harness.js';
import { normalisera, oppnaFlik, iExport, byggKonDataset, KON_KOSTNAD, MELLAN, SMA, KON_BAS, KON_KV, KON_MA, ENSAM, KON_GAP, KON_GAP_1, KON_DOLDA, fonsterKon, harNagon, laddaXlsx, fangaBocker, sammanhang, SENT_MELLAN, SENT_SMA, X_KV, X_MA, PAR_KV, PAR_MA } from './helpers/ktroskel-rigg.js';
import { invariantSvit } from './helpers/ktroskel-invariant.js';

// Sviten ritar om hela verktyget i varje test. Under full last tar ett test 4–6 s, så standardgränsen 5 s
// fäller olika tester från körning till körning.
vi.setConfig({ testTimeout: 30000 });

describe('I1: Löneöversyn visar ingen kostnad för grupper under tröskeln', () => {
    it('individnivån: på skärmen visas jämförelsen också mot få män (skärmen maskerar inget, ADR-51)', () => {
        const w = fonsterKon(null);
        w.__renderTabContent('loneoversyn');
        w.eval('_forecastRemediation()');
        expect(w.document.querySelectorAll('#forecast-rem-result tbody tr').length).toBeGreaterThan(0);
    });
    it('individnivån i exportläget: jämförelsen kräver tröskeln i antal män, och kostnaden visas inte där antalet maskeras', () => {
        const w = iExport(fonsterKon(null));
        w.__renderTabContent('loneoversyn');
        w.eval('_forecastRemediation()');
        const t = normalisera(w.document.getElementById('forecast-rem-result').textContent);
        expect(t).not.toContain(String(PAR_MA - PAR_KV));                       // en man minus en kvinna
        for (const [i] of KON_BAS.entries()) expect(t).not.toContain(String(30 * (KON_MA[i] - KON_KV[i])));   // mot 1–3 mäns median
        expect(w.document.querySelectorAll('#forecast-rem-result tbody tr').length).toBe(0);
        const rem = w.__state.forecast._remediation;
        expect(rem.perGroup.some(g => KON_BAS.includes(g.bas) || g.aid === '7300')).toBe(false);
    });
    it('individnivån: en grupp med färre flaggade än tröskeln räknas men får ingen egen kostnad, och blir inget förslag', () => {
        const w = createAppWindow();
        const rad = (kon, lon, i) => ({ bas: 'A', kon, lon, alder: 30 + i % 20, yrke: '6000 Yrke', aid: '6000', yrkeLabel: 'Yrke', enhet: '' });
        const r = [];
        for (let i = 0; i < 12; i++) r.push(rad('man', 40000 + i, i));
        for (let i = 0; i < 12; i++) r.push(rad('kvinna', i < 3 ? 31117 : 40000 + i, i));   // tre kvinnor långt under männens median
        w.__state.data = r;
        w.eval('populateSelects(); unlockTabs();');
        iExport(w);
        w.__renderTabContent('loneoversyn');
        w.eval('_forecastRemediation()');
        const el = w.document.getElementById('forecast-rem-result');
        const kostnad = String(Math.round(3 * (40005.5 - 31117)));
        expect(normalisera(el.textContent)).not.toContain(kostnad);
        expect(el.textContent).toMatch(/färre än 10/);
        w.alert = () => {};
        w.eval('_forecastRemediationSeed()');
        expect(w.__state.forecast.targets).toEqual([]);
    });
    it('utfallstabellen (i exportläget) och Excel: kostnaden maskeras där medianerna maskeras, och antalet grupper anges', async () => {
        const w = iExport(fonsterKon(null));
        Object.assign(w.__state.forecast, { generell: { mode: 'pct', value: 2 } });
        w.__renderTabContent('loneoversyn');
        const kostnad = v => String(Math.round(v * 0.02));
        // Kostnaden per grupp vid 2 % påslag: en persons lön, ett pars löner och fyra personers löner gånger 0,02.
        const dolda = { 7001: kostnad(ENSAM), 7300: kostnad(PAR_KV + PAR_MA), 7002: kostnad(2 * X_KV + 2 * X_MA) };
        expect(dolda).toEqual({ 7001: '639', 7300: '1368', 7002: '2972' });
        const tabell = w.document.querySelector('#forecast-outcome .table-wrap');
        const rad = namn => [...tabell.querySelectorAll('tbody tr')].find(tr => tr.children[1].textContent === namn);
        expect(rad('7001')).toBeTruthy();
        for (const aid of ['7001', '7300', '7002']) {
            expect(normalisera(rad(aid).textContent), aid).not.toMatch(/\d kr\/mån/);
            expect(normalisera(rad(aid).textContent), aid).not.toContain(dolda[aid]);
        }
        expect(normalisera(rad('6000').textContent)).toMatch(/\d kr\/mån/);
        expect(w.document.getElementById('forecast-outcome').textContent).toMatch(/\d+ grupper med färre än 10 personer ingår i summorna/);
        await laddaXlsx(w);
        const bok = Object.values(fangaBocker(w, () => w.eval('exportForecast()')))[0];
        const blad = bok.split('[Fördelning]')[1].split('[')[0].split('\n');
        for (const aid of ['7001', '7300', '7002']) {
            expect(blad.find(r => r.includes(`| ${aid} |`)), aid).toMatch(/\|\s*$/);
            expect(blad.find(r => r.includes(`| ${aid} |`)), aid).not.toContain(dolda[aid]);
        }
        expect(blad.find(r => r.includes('| 6000 |'))).toMatch(/\| \d+$/);
        expect(bok).toMatch(/\d+ grupper med färre än 10 personer ingår i summorna/);
    });
    it('höjd tröskel rör inte förslagen på skärmen (skärmen maskerar inget, ADR-51); egna rader står kvar', () => {
        const w = createAppWindow();
        const rader = [];
        const lagg = (n, kon, lon, bas, aid) => { for (let i = 0; i < n; i++) rader.push({ bas, kon, lon: lon + (i % 3) * 10,
            alder: 30 + (i * 7) % 30, yrke: `${aid} Yrke ${aid}`, aid, yrkeLabel: `Yrke ${aid}`, enhet: '' }); };
        lagg(30, 'kvinna', 25000, 'A', '6000'); lagg(30, 'man', 25500, 'A', '6000');
        lagg(20, 'man', 50000, 'C', '6100'); lagg(4, 'kvinna', 50000, 'C', '6100');
        lagg(6, 'kvinna', 36421, 'C', '5300');
        w.__state.data = rader;
        w.eval('populateSelects(); unlockTabs(); sattKTroskel(5, { fraga: false });');
        w.alert = () => {};
        Object.assign(w.__state.forecast, { minGroupN: 0, budget: { mode: 'kr', value: 5000000 }, generell: { mode: 'pct', value: 0 } });
        oppnaFlik(w, 'loneoversyn');
        w.eval('_forecastOptimize()');
        expect(w.__state.forecast.targets.map(t => t.aid)).toContain('5300');
        w.__state.forecast.targets.push({ bas: 'A', aid: '6000', mode: 'kr', value: 1000, dist: 'lowest', targetLevel: 'median', pool: 'övrigt' });
        w.eval('sattKTroskel(10, { fraga: false })');
        expect(w.__state.forecast.targets.map(t => t.aid)).toContain('5300');
        expect(w.__state.forecast.targets.map(t => t.aid)).toContain('6000');
        expect(w.document.getElementById('forecast-par-not').textContent).toBe('');
        // Raden på den lilla gruppen säger att beloppet bygger på enskildas löner (R2).
        expect(w.document.getElementById('forecast-targets').textContent).toMatch(/Raden berör 6 personer, färre än 10 personer/);
    });
});


// Resultaten som räknas på knapptryck i Löneöversyn (kostnaden på individnivå, känslighetskurvan, målet för skillnaden)
// ritades förr bara när knappen trycktes: skärmens omaskade tal stod kvar i förhandsvisningen "Som i exporten" och
// efter en ändrad tröskel. Ett resultat som visas räknas nu om när fliken ritas om; en tom ruta förblir tom (ADR-51).
describe('I1b: Löneöversyns knappresultat följer läget och tröskeln', () => {
    const text = (w, id) => normalisera(w.document.getElementById(id).textContent);
    const kostnader = w => KON_KOSTNAD.filter(v => text(w, 'forecast-rem-result').includes(String(v)));
    const KNAPPRUTOR = ['forecast-rem-result', 'forecast-sensitivity', 'forecast-threshold-result'];
    const fyllt = () => {
        const w = fonsterKon(null);
        Object.assign(w.__state.forecast, { generell: { mode: 'pct', value: 100 }, years: 3 });
        oppnaFlik(w, 'loneoversyn');
        w.eval('_forecastRemediation(); _forecastSensitivity();');
        expect(kostnader(w).length).toBeGreaterThan(0);                 // skärmen jämför också mot 1–3 män
        return w;
    };
    it('förhandsvisningen räknar om det som visas, en höjd tröskel också, och av igen visar skärmens resultat', () => {
        const w = fyllt();
        w.eval('sattForhandsvisning(true)');
        expect(kostnader(w)).toEqual([]);
        expect(text(w, 'forecast-rem-result')).toMatch(/Inga kvinnor ligger mer än tröskeln/);   // räknad i exportläget, inte tömd
        expect(text(w, 'forecast-sensitivity')).not.toBe('');
        // Vid 25 blir texten densamma: en markering visar att rutorna räknas om och inte bara står kvar.
        for (const id of ['forecast-rem-result', 'forecast-sensitivity']) w.document.getElementById(id).textContent = 'gammalt';
        w.eval('sattKTroskel(25, { fraga: false })');
        expect(kostnader(w)).toEqual([]);
        expect(text(w, 'forecast-rem-result')).toMatch(/Inga kvinnor ligger mer än tröskeln/);
        expect(text(w, 'forecast-sensitivity')).not.toMatch(/^gammalt$|^$/);
        w.eval('sattForhandsvisning(false)');
        expect(text(w, 'forecast-rem-result')).toMatch(/minst 1 män/);
        expect(kostnader(w).length).toBeGreaterThan(0);
        expect(text(w, 'forecast-sensitivity')).not.toBe('');
    });
    it('en flik som inte syns töms, och resultatet räknas i det läge som gäller när fliken öppnas', () => {
        const w = fyllt();
        oppnaFlik(w, 'matrix');
        w.eval('sattForhandsvisning(true)');
        expect(text(w, 'forecast-rem-result')).toBe('');
        expect(text(w, 'forecast-sensitivity')).toBe('');
        oppnaFlik(w, 'loneoversyn');
        expect(kostnader(w)).toEqual([]);
        expect(text(w, 'forecast-rem-result')).toMatch(/Inga kvinnor ligger mer än tröskeln/);
        expect(text(w, 'forecast-sensitivity')).not.toBe('');
    });
    it('en tom ruta förblir tom när fliken ritas om: ingen beräkning utan knapptryck', () => {
        const w = fonsterKon(null);
        oppnaFlik(w, 'loneoversyn');
        w.eval('sattForhandsvisning(true)');
        w.eval('sattKTroskel(25, { fraga: false })');
        w.eval('sattForhandsvisning(false)');
        for (const id of KNAPPRUTOR) expect(text(w, id), id).toBe('');
        expect(w.__state.forecast._remediation).toBeUndefined();
    });
    it('Rensa all data och en ny lönefil glömmer resultaten: de räknas inte om på nästa underlag', () => {
        const w = fyllt();
        w.eval('_rensaAllData()');
        for (const id of KNAPPRUTOR) expect(text(w, id), id).toBe('');
        w.__state.data = byggKonDataset();
        w.eval('populateSelects(); unlockTabs();');
        oppnaFlik(w, 'loneoversyn');
        for (const id of KNAPPRUTOR) expect(text(w, id), id).toBe('');
        const v = fyllt();
        v.eval('_afterDataLoaded()');
        oppnaFlik(v, 'loneoversyn');
        for (const id of KNAPPRUTOR) expect(text(v, id), id).toBe('');
        expect(v.__state.forecast._remediation).toBeUndefined();
    });
});

invariantSvit(10, []);


// ===================================================================================
// I6: underlaget (figur.underlag, "Räkna för") i exportläget, precis under och precis över skyddsregeln.
//
// Varje diagram som kan räknas för en del av personerna prövas med samma val: bara sektorn Vård (30 kvinnor och 30
// män). Resten är Handläggare (12 kvinnor, inga män) och Ledning, som har 3 kvinnor och därför inte går att välja för
// sig. Ledningens män avgör: med 9 (en under tröskeln 10) har resten 9 män och valet görs inte; med 10 görs det.
// Utan regeln kunde hela underlaget minus urvalet röja de få männen i Ledning.
// ===================================================================================
describe('I6: underlaget i exportläget, precis under och precis över skyddsregeln', () => {
    const DIAGRAM = ['chart-kon-boxplot', 'chart-kon-histogram', 'chart-kon-aldergap', 'chart-struktur-percentiler', 'chart-struktur-kvartiler'];
    const VARD = 'Vård- och omsorgsarbete med mera', HANDL = 'Handläggar- och administratörsarbete';
    const LEDNING_MAN = 41913;   // Ledningens män har en lön som inte finns någon annanstans (i Vård högst 41 700)
    const fonsterUnderlag = (man, export_ = true) => {
        const w = createAppWindow();
        w.eval('sattKTroskel(10, { fraga: false })');
        const rad = (aid, kon, lon, alder, bas = 'S1') => ({ bas, kon, lon, alder, yrke: `${aid} Yrke ${aid}`, aid, yrkeLabel: `Yrke ${aid}`, enhet: '' });
        const r = [];
        for (let i = 0; i < 30; i++) r.push(rad('201010', 'kvinna', 24000 + i * 600, 40 + (i % 10)), rad('201010', 'man', 24300 + i * 600, 40 + (i % 10)));
        for (let i = 0; i < 12; i++) r.push(rad('151010', 'kvinna', 30000 + i * 400, 30 + i, 'S2'));
        for (let i = 0; i < 3; i++) r.push(rad('101010', 'kvinna', 41000 + i * 100, 55, 'S3'));
        for (let i = 0; i < man; i++) r.push(rad('101010', 'man', LEDNING_MAN, 56, 'S3'));
        w.__state.data = r;
        w.eval('populateSelects(); unlockTabs();');
        if (export_) iExport(w);
        w.__renderTabContent('kon');
        w.__renderTabContent('struktur');
        return w;
    };
    // Kryssar ur alla sektorer utom Vård. I exportläget går Ledning inte att välja (3 kvinnor); på skärmen (tröskeln 1) gör den det.
    const valjBaraVard = (w, id, valbara = [HANDL, VARD]) => {
        const el = w.document.getElementById(id);
        const rad = el.parentElement.querySelector('.diagram-urval[data-underlag="sektor"]');
        expect(rad, id).not.toBeNull();
        expect([...rad.querySelectorAll('input[data-urval]')].map(x => x.getAttribute('data-urval')), id).toEqual(valbara);
        let ruta = null;
        for (const v of valbara.filter(x => x !== VARD)) {
            ruta = w.document.getElementById(id).parentElement.querySelector(`.diagram-urval[data-underlag="sektor"] input[data-urval="${v}"]`);
            ruta.checked = false;
            ruta.dispatchEvent(new w.Event('change', { bubbles: true }));
        }
        return { el, ruta };
    };
    it.each(DIAGRAM)('%s: precis under regeln (resten har 9 män) görs valet inte, och exporten är hela underlagets', id => {
        const w = fonsterUnderlag(9);
        const el = w.document.getElementById(id);
        expect(el._figur.underlag.k, id).toBe(10);
        const fore = w.__chartExportRows(el);
        const { ruta } = valjBaraVard(w, id);
        expect(el._rfUnderlagText, id).toBeUndefined();
        expect(el._rfUnderlagFigur, id).toBeUndefined();
        expect(ruta.checked, id).toBe(true);
        expect(ruta.getAttribute('aria-invalid'), id).toBe('true');
        expect(el.parentElement.querySelector('[data-rf="urval"]').textContent, id).toContain('Urvalet eller resten har färre än 10 kvinnor eller män.');
        const efter = w.__chartExportRows(el);
        expect(efter.slice(1), id).toEqual(fore.slice(1));
        expect(efter.map(r => r.join(' | ')).join('\n'), id).not.toMatch(/Räknat för/);
    });
    it.each(DIAGRAM)('%s: precis över regeln (resten har 10 män) räknas diagrammet för Vård, och exporten säger det', id => {
        const w = fonsterUnderlag(10);
        const { el, ruta } = valjBaraVard(w, id);
        expect(ruta.hasAttribute('aria-invalid'), id).toBe(false);
        expect(el._rfUnderlagText, id).toBe(`sektor ${VARD} (60 personer)`);
        expect(el._rfUnderlagFigur, id).toBeTruthy();
        expect(el._rfUnderlagFigur.beskrivning, id).toContain(VARD);
        const rader = w.__chartExportRows(el);
        expect(rader.some(r => r[0] === `Räknat för: sektor ${VARD} (60 personer)`), id).toBe(true);
        expect(normalisera(rader.join('\n')), id).not.toContain(String(LEDNING_MAN));
    });
    // Skärmen maskerar inget (ADR-51, tröskeln 1): där görs valet. Exporten ritar diagrammet i exportläget med den
    // inställda tröskeln och prövar valet ur minnet igen: under regeln exporteras hela underlaget, över den valet.
    it.each(DIAGRAM)('%s: valt på skärmen; exporten prövar valet med den inställda tröskeln', id => {
        for (const [man, raknat] of [[9, false], [10, true]]) {
            const w = fonsterUnderlag(man, false);
            oppnaFlik(w, id.startsWith('chart-kon') ? 'kon' : 'struktur');   // den öppna fliken ritas om på skärmen efter en export
            const el0 = w.document.getElementById(id);
            expect(el0._figur.underlag.k, id).toBe(1);
            const hel = w.eval('medExportLage')(() => w.__chartExportRows(w.document.getElementById(id)));
            valjBaraVard(w, id, [HANDL, 'Ledningsarbete', VARD]);
            expect(w.document.getElementById(id)._rfUnderlagText, id).toBe(`sektor ${VARD} (60 personer)`);
            const rader = w.eval('medExportLage')(() => w.__chartExportRows(w.document.getElementById(id)));
            const text = rader.map(r => r.join(' | ')).join('\n');
            if (raknat) {
                expect(text, `${id}, ${man} män`).toContain(`Räknat för: sektor ${VARD} (60 personer)`);
                expect(normalisera(text), id).not.toContain(String(LEDNING_MAN));
            } else {
                expect(text, `${id}, ${man} män`).not.toContain('Räknat för');
                expect(rader.slice(1), id).toEqual(hel.slice(1));
            }
            // Tillbaka på skärmen gäller valet igen.
            expect(w.document.getElementById(id)._rfUnderlagText, id).toBe(`sektor ${VARD} (60 personer)`);
        }
    });
});

// ===================================================================================
// I7: Var uppstår löneskillnaden med andra val av förklaringsvariabler (ADR-65), vid 10 och 25.
//
// Skyddsregeln gäller per del: en grupp namnges bara när den själv och alla dess överceller har 0 eller minst k av
// varje kön, och kan en del inte redovisas visas ingen del. Y1–Y3 och X har ett kön under tröskeln i BAS:en, så
// inget under dem får namnges; vid 25 gäller det också MELLAN (10 kvinnor och 10 män).
//  - BAS, åldersgrupp, AID (tre nivåer): den ensamma personen i Ensamyrke (BAS S1) står för nästan hela delen
//    "AID inom åldersgrupp och BAS", så reserven slår till: ingen del och inget gruppnamn redovisas, bara hela skillnaden.
//  - Åldersgrupp, BAS: delarna redovisas, och inga grupper under en övercell som inte klarar tröskeln namnges.
// Rapportunderlagets block, kortet i exportläget och metodbilagan (Excel, Word) prövas mot de dolda värdena som i I4.
// ===================================================================================
describe.each([[10, []], [25, SENT_MELLAN]])('I7: uppdelningen med andra val av variabler vid %i', (k, extra) => {
    const dolda = [...KON_DOLDA, ...SENT_SMA, ...extra];
    const smaBas = k === 10 ? [...KON_BAS, 'X', ...SMA] : [...KON_BAS, 'X', ...SMA, ...MELLAN];
    const utdataFor = val => {
        const w = iExport(fonsterKon(k === 10 ? null : k));
        w.eval(`sattGapVariabler(${JSON.stringify(val)}, { rita: false })`);
        w.__renderTabContent('struktur');
        const u = w.eval('_guGapUppdelning(getData(), { k: kTroskel(), variabler: gapVariabler() })');
        const block = w.__rapportunderlagBlock().find(b => b.id === 'uppdelning');
        return { u, utdata: [
            ['rapportunderlag: uppdelning', normalisera(w.__ruTillWordHtml(block) + '\n' + w.__ruTillText(block))],
            ['kortet (exportläget)', normalisera(w.document.getElementById('gap-uppdelning').textContent)],
            ['metodbilagan', normalisera(w.__methodAppendixData().map(r => r.join(' | ')).join('\n'))],
        ] };
    };
    const ingaLackor = utdata => {
        const lackor = [];
        for (const [namn, text] of utdata) {
            for (const v of harNagon(text, dolda)) lackor.push(`${namn}: ${v} — "${sammanhang(text, v)}"`);
            for (const v of harNagon(text, KON_GAP)) lackor.push(`${namn}: ${v}`);
            for (const re of KON_GAP_1) { const m = text.match(re); if (m) lackor.push(`${namn}: ${m[0]}`); }
            for (const b of smaBas) if (new RegExp(`BAS ${b}(?![\\p{L}\\d])`, 'u').test(text)) lackor.push(`${namn}: BAS ${b}`);
        }
        expect(lackor).toEqual([]);
    };
    it('BAS, åldersgrupp, AID: reserven — ingen del och inget gruppnamn, och variablerna nämns', () => {
        const { u, utdata } = utdataFor(['bas', 'alder', 'aid']);
        expect(u.variabler).toEqual(['bas', 'alder', 'aid']);
        expect(u.skyddad).toBe(false);
        expect(u.delar).toBeNull();
        expect(u.topp).toBeNull();
        expect(utdata[0][1]).toMatch(/delas inte upp/);
        expect(utdata[1][1]).toMatch(/delas inte upp/);
        expect(utdata[1][1]).not.toMatch(/A\. BAS-fördelning/);
        expect(utdata[2][1]).toContain('delas med BAS, åldersgrupp och AID');
        ingaLackor(utdata);
    });
    it('åldersgrupp, BAS: delarna summerar till hela skillnaden, och inget under en för liten övercell namnges', () => {
        const { u, utdata } = utdataFor(['alder', 'bas']);
        expect(u.variabler).toEqual(['alder', 'bas']);
        expect(u.skyddad).toBe(true);
        expect(Math.abs(Object.values(u.delar).reduce((s, v) => s + v, 0) - u.gap)).toBeLessThan(1e-6);
        const namn = Object.values(u.topp).flat().map(p => p.namn);
        expect(namn.length).toBeGreaterThan(0);
        for (const n of namn) expect(smaBas.some(b => n.endsWith(`BAS ${b}`)), n).toBe(false);
        expect(utdata[0][1]).toContain('Uppdelningen förklarar med variablerna åldersgrupp och BAS, i den ordningen.');
        expect(utdata[1][1]).toContain('B. BAS inom åldersgrupp');
        ingaLackor(utdata);
    });
});

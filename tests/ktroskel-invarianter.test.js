/**
 * K-tröskeln som inställning: Löneöversyn (I1) och invarianten över flikar och exporter vid 10 och 25 (I4).
 *
 * Riggen (fixturer, fönster och sökfunktioner) ligger i tests/helpers/ktroskel-rigg.js; sviten är delad i
 * åtta filer så att Vitest fördelar den över flera arbetare.
 */
import { describe, it, expect, beforeAll, vi } from 'vitest';
import { createAppWindow } from './helpers/app-harness.js';
import { normalisera, oppnaFlik, iExport, KON_BAS, KON_KV, KON_MA, ENSAM, KON_GAP, KON_GAP_1, KON_DOLDA, fonsterKon, harNagon, laddaXlsx, fangaBocker, samlaUtdata, sammanhang, SENT_MELLAN, SENT_SMA, X_KV, X_MA, PAR_KV, PAR_MA } from './helpers/ktroskel-rigg.js';

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

// ===================================================================================
// I4: invarianten över flikar OCH exporter, vid 10 och 25.
//
// Vad som prövas: varje flik i menyn, Översiktens delar (Att göra, processöversikten,
// inläsningsrapporten), Word-utkastet, utskriften i de tre urvalen,
// rapportunderlagets block (HTML och text), Excel (alla flikar, protokollet, EU-lönerapporten,
// handlingsplanen, jämförelseexporten, Löneöversyn, Löneöversikten, prioriteringslistan, ZIP-filens
// rapport.xlsx), Att göra-CSV, varje tabell med CSV-knapp, diagramdata för varje ritat diagram,
// gruppdossiern för varje valbar grupp och Att göra-punkterna.
//
// Vad som INTE prövas, och varför:
//  - #view-likvardighet och dess egen export: dokumenterat undantag (dataskydd.md § 3, undantag 1).
//  - #view-utforska på skärmen: ADR-14. Dess tabell och diagram prövas med rutan urkryssad.
//  - #personer-att-granska: ADR-23 (individlista, bara i verktyget).
//  - #outliers-container: extremvärdeslistan visar enskilda rader på skärmen, som Personer att
//    granska (ADR-23); att den inte följer med i någon export prövas här genom att exporterna prövas.
//  - Låddiagrammet per kön (INDIVIDDIAGRAM nedan): avvikarna är enskilda löner, utan yrke (dataskydd.md § 4).
//    Spridningsdiagrammen är INTE undantagna: en persons punkt ritas och exporteras bara när
//    personens grupp och kön i gruppen når tröskeln, så deras export prövas som alla andras.
//  - Riktade potter i Löneöversyn på färre personer än tröskeln är användarens egen simulering (ADR-38 R2) och
//    visar beloppet på raden; rigg­en lägger inga sådana rader. Det råa gapet före och efter prövas av C3.
//  - Robusthetspanelen körs här direkt (den räknas annars först på knapptryck) och läses som en egen väg;
//    att den utelämnar par med en grupp under tröskeln och anger antalet prövas med parfixturen ovan.
//  - Ålder & karriär ritas här med "Alla BAS". Att fliken följer regeln för ett litet kön, i hela
//    urvalet och i ett valt BAS, prövas av R4 längre ned; regressionens
//    ojusterade steg prövas av R1, som också kör samlaUtdata mot ett underlag med 7 män.
// ===================================================================================
describe.each([[10, []], [25, SENT_MELLAN]])('I4: invarianten över flikar och exporter vid %i', (k, extra) => {
    let utdata;
    const dolda = [...KON_DOLDA, ...SENT_SMA, ...extra];
    beforeAll(async () => { utdata = await samlaUtdata(fonsterKon(k === 10 ? null : k)); }, 120000);
    it('utdata finns för varje väg (annars prövar testet inget)', () => {
        const namn = utdata.map(([n]) => n);
        for (const krav of ['skärm: alla flikar', 'Word-utkastet', 'Att göra-CSV', 'ZIP Excel-filen', 'utskrift: komplett', 'utskrift: ledning', 'utskrift: facklig',
            'tabell-CSV: explore-table', 'diagramdata: chart-explore', 'rapportunderlag: sammanfattning',
            'robusthetspanelen'])
            expect(namn, krav).toContain(krav);
        expect(utdata.find(([n]) => n === 'robusthetspanelen')[1]).toMatch(/Kvinnodominerat yrke|Inga kandidatpar/);
        expect(namn.filter(n => n.startsWith('gruppdossier')).length).toBeGreaterThan(5);
        // Varje fångad utdata ska ha innehåll, utan undantag: fixturen ger rader i varje tabell med CSV-knapp,
        // spår i varje ritat diagram, minst en iakttagelse och minst en Att göra-punkt. En export som inte
        // skriver något (t.ex. en CSV-knapp utan verkan) ska fälla testet, inte passera som "inget läckte".
        for (const [n, t] of utdata) expect(t.length, n).toBeGreaterThan(50);
        for (const prefix of ['tabell-CSV: ', 'diagramdata: ']) expect(namn.filter(n => n.startsWith(prefix)).length, prefix).toBeGreaterThanOrEqual(5);
        expect(utdata.find(([n]) => n === 'Att göra-CSV')[1].split('\n').length).toBeGreaterThan(3);
        // Excelfilen med alla flikar bär bladet Lönepolitik (fixturen har ett ställningstagande), så det prövas här.
        expect(utdata.find(([n]) => n.startsWith('Excel alla flikar'))[1]).toContain('[Lönepolitik]');
        expect(utdata.find(([n]) => n === 'ZIP Excel-filen')[1]).toContain('[Lönepolitik]');
        // Stora grupper syns, så att tystnad inte beror på tomma utdata.
        expect(utdata.find(([n]) => n === 'Word-utkastet')[1]).toContain('S1');
        expect(utdata.find(([n]) => n === 'skärm: alla flikar')[1]).toContain('Säkeryrke 0');
    });
    // Skärmen maskerar inget (ADR-51): den vägen prövas positivt nedan och undantas i läckkontrollerna.
    const exporter = () => utdata.filter(([n]) => n !== 'skärm: alla flikar');
    it('skärmen visar grupperna och könen under tröskeln (ADR-51)', () => {
        const skarm = utdata.find(([n]) => n === 'skärm: alla flikar')[1];
        expect(harNagon(skarm, [...SENT_SMA, ...KON_MA]).length).toBeGreaterThan(0);
    });
    it('ingen enskild lön, ingen lön för en grupp under tröskeln och ingen lön för ett kön under tröskeln i det som lämnar verktyget', () => {
        const lackor = [];
        for (const [namn, text] of exporter()) for (const v of harNagon(text, dolda)) lackor.push(`${namn}: ${v} — "${sammanhang(text, v)}"`);
        expect(lackor).toEqual([]);
    });
    it('inget könsgap för en grupp där ett kön är under tröskeln i det som lämnar verktyget', () => {
        const lackor = [];
        for (const [namn, text] of exporter()) {
            for (const v of harNagon(text, KON_GAP)) lackor.push(`${namn}: ${v} — "${sammanhang(text, v)}"`);
            for (const re of KON_GAP_1) { const m = text.match(re); if (m) lackor.push(`${namn}: ${m[0]} — "${sammanhang(text, m[0])}"`); }
        }
        expect(lackor).toEqual([]);
    });
});

/**
 * Löneöversyns förslag ur kandidatparen i likvärdigt arbete följer den inställda tröskeln, också på skärmen (ADR-69).
 *
 * Ett förslag (Föreslå riktade potter, mål-läget, känslighetskurvan) bär ett belopp räknat ur skillnaden mot
 * jämförelseyrkets median. Verktyget föreslår därför ingen rad ur ett par där det kvinnodominerade yrket eller
 * jämförelseyrket har färre personer än den inställda tröskeln (kInstalld()), oavsett läge. En föreslagen rad tas bort
 * när tröskeln höjs över någon av parets grupper, och en föreslagen rad i en konfigurationsfil prövas mot tröskeln när
 * den läses in. Användarens egna rader står kvar som förut (regel R2 i docs/utveckling/k-troskeln.md §8).
 *
 * Underlaget som parFonster i tests/troskelbeslut.test.js: ett kvinnodominerat yrke (5300) och ett jämförelseyrke (6100)
 * i BAS C, och ett stort yrke (6000) i BAS A för egna rader. Varje grupp i paret har en enda lön, ett sentinelvärde, så
 * att ett tal i utdata bara kan komma ur den gruppen: jämförelseyrkets median, skillnaden och förslagets belopp.
 *
 * Vaktar: S4 (docs/utveckling/regler.md)
 */
import { describe, it, expect, vi } from 'vitest';
import { createAppWindow } from './helpers/app-harness.js';
import { normalisera, laddaXlsx, fangaBocker, oppnaFlik } from './helpers/ktroskel-rigg.js';

vi.setConfig({ testTimeout: 30000 });

const KV_LON = 36421, JMF_LON = 51373, GAP = JMF_LON - KV_LON;   // 14 952 kr
const NOT_10 = '1 par med en grupp under 10 personer redovisas inte här.';

const JMF2_LON = 58111, GAP2 = JMF2_LON - KV_LON;   // ett andra jämförelseyrke (6200): 21 690 kr

// kvN kvinnor i det kvinnodominerade yrket och jmfN personer i jämförelseyrket (var femte en kvinna); med jmf2N
// dessutom ett andra jämförelseyrke (6200) med jmf2N män på jmf2Lon.
function fonsterPar({ kvN, jmfN, k = null, minGroupN = 0, jmf2N = 0, jmf2Lon = JMF2_LON }) {
    const w = createAppWindow();
    const rader = [];
    const rad = (bas, kon, lon, aid, i) => ({ bas, kon, lon, alder: 30 + (i * 7) % 30, yrke: `${aid} Yrke ${aid}`, aid, yrkeLabel: `Yrke ${aid}`, enhet: '' });
    for (let i = 0; i < 30; i++) rader.push(rad('A', 'kvinna', 25000 + (i % 3) * 10, '6000', i), rad('A', 'man', 25500 + (i % 3) * 10, '6000', i));
    for (let i = 0; i < jmfN; i++) rader.push(rad('C', i % 5 === 4 ? 'kvinna' : 'man', JMF_LON, '6100', i));
    for (let i = 0; i < jmf2N; i++) rader.push(rad('C', 'man', jmf2Lon, '6200', i));
    for (let i = 0; i < kvN; i++) rader.push(rad('C', 'kvinna', KV_LON, '5300', i));
    w.__state.data = rader;
    w.eval('populateSelects(); unlockTabs();');
    if (k !== null) w.eval(`sattKTroskel(${k}, { fraga: false })`);
    w.alert = () => {};
    Object.assign(w.__state.forecast, { minGroupN, budget: { mode: 'kr', value: 5000000 }, generell: { mode: 'pct', value: 0 } });
    oppnaFlik(w, 'loneoversyn');   // som användaren: den öppna fliken ritas om när tröskeln ändras
    // Paret finns i analysen (fliken prövar också små grupper); annars prövar testet inget.
    expect(w.eval("likvardighetResultat().pairs.some(p => p.kvAid === '5300' && p.maAid === '6100')")).toBe(true);
    return w;
}
const parRader = w => w.__state.forecast.targets.filter(t => t.aid === '5300' && t.kalla === 'par');
const aids = w => w.__state.forecast.targets.map(t => t.aid).sort();
const text = (w, id) => normalisera(w.document.getElementById(id).textContent.replace(/\s+/g, ' ').trim());
// Talen som bara kan komma ur paret: jämförelseyrkets median, skillnaden och förslagets belopp (hela skillnaden
// gånger antalet kvinnor, eftersom potten räcker till allt).
const parTal = kvN => [JMF_LON, GAP, GAP * kvN].map(String);

async function excel(w) {
    await laddaXlsx(w);
    w.eval('updateForecast()');   // en prognos finns också när inget föreslogs, så att exporten skrivs
    const bocker = Object.values(fangaBocker(w, () => w.eval('exportForecast()')));
    expect(bocker.length).toBe(1);
    return bocker[0];
}
function forvantaInget(w, kvN, utdata) {
    for (const [namn, t] of Object.entries(utdata)) {
        for (const v of parTal(kvN)) expect(t, `${namn}: ${v}`).not.toContain(v);
    }
}

describe('Löneöversyn: förslagen följer den inställda tröskeln, också på skärmen (ADR-69)', () => {
    it('jämförelseyrket under tröskeln (5 mot 12): inget förslag, och varken beloppet eller medianen i Excel eller konfigurationsfilen', async () => {
        const w = fonsterPar({ kvN: 12, jmfN: 5 });
        w.eval('_forecastOptimize()');
        expect(parRader(w)).toEqual([]);
        expect(text(w, 'forecast-par-not')).toBe(NOT_10);
        const bok = await excel(w);
        expect(bok).toContain('[Sammanfattning]');
        expect(bok).toContain('[Fördelning]');
        expect(bok).toContain(NOT_10);
        const cfg = w.eval('buildConfigSnapshot()');
        expect(cfg.forecast.targets.filter(t => t.kalla === 'par')).toEqual([]);
        // Löneöversyns del av filen: resten bär BAS-intervallets percentiler, och med 17 personer i BAS C kan dess övre
        // kvartil vara jämförelseyrkets lön utan att något läcker.
        forvantaInget(w, 12, { Excel: bok, konfigurationsfilen: normalisera(JSON.stringify(cfg.forecast)) });
    });
    it('det kvinnodominerade yrket under tröskeln (6) med minsta antal i gruppen 0: inget förslag, inget belopp i Excel eller konfigurationsfilen', async () => {
        const w = fonsterPar({ kvN: 6, jmfN: 24 });
        w.eval('_forecastOptimize()');
        expect(parRader(w)).toEqual([]);
        expect(text(w, 'forecast-par-not')).toBe(NOT_10);
        const bok = await excel(w);
        const cfg = normalisera(JSON.stringify(w.eval('buildConfigSnapshot()').forecast));
        forvantaInget(w, 6, { Excel: bok, konfigurationsfilen: cfg });
        expect(bok).not.toContain(String(KV_LON));
    });
    it('mål-läget och känslighetskurvan: inget förslag och ingen kurva ur paret, med noten om det utelämnade paret', () => {
        for (const [kvN, jmfN] of [[12, 5], [6, 24]]) {
            const w = fonsterPar({ kvN, jmfN });
            w.document.getElementById('forecast-closure-pct').value = '100';
            w.eval('_forecastClosure()');
            expect(parRader(w), `${kvN}/${jmfN}`).toEqual([]);
            w.eval('_forecastSensitivity()');
            expect(text(w, 'forecast-sensitivity')).toBe('Verktyget hittade inga skillnader i likvärdigt arbete att räkna på.');
            expect(text(w, 'forecast-par-not')).toBe(NOT_10);
            // Raderna och kurvan; utfallets lönespann per BAS visar BAS-intervallets percentiler, som får vara samma tal.
            forvantaInget(w, kvN, { 'riktade rader': text(w, 'forecast-targets'), kurvan: text(w, 'forecast-sensitivity') });
        }
    });
    it('båda grupperna över tröskeln (12 mot 24): förslaget, mål-läget och kurvan finns som förut', () => {
        const w = fonsterPar({ kvN: 12, jmfN: 24 });
        w.eval('_forecastOptimize()');
        expect(parRader(w).map(t => t.value)).toEqual([GAP * 12]);
        expect(text(w, 'forecast-par-not')).toBe('');
        w.document.getElementById('forecast-closure-pct').value = '50';
        w.eval('_forecastClosure()');
        expect(parRader(w).map(t => t.value)).toEqual([GAP * 6]);
        w.eval('_forecastSensitivity()');
        expect(w.document.querySelectorAll('#forecast-sensitivity tbody tr').length).toBe(11);
    });
    it('vid tröskeln 5 föreslås raden på den lilla gruppen (6), och den följer med i exporten', async () => {
        const w = fonsterPar({ kvN: 6, jmfN: 24, k: 5 });
        w.eval('_forecastOptimize()');
        expect(parRader(w).map(t => t.value)).toEqual([GAP * 6]);
        expect(await excel(w)).toContain(`BAS C, AID 5300: ${GAP * 6} kr/mån`);
    });
    it('en föreslagen rad tas bort när tröskeln höjs över en av grupperna på skärmen; en egen rad står kvar med sin not', () => {
        const w = fonsterPar({ kvN: 6, jmfN: 24, k: 5 });
        w.eval('_forecastOptimize()');
        expect(parRader(w)).toHaveLength(1);
        w.__state.forecast.targets.push({ bas: 'A', aid: '6000', mode: 'kr', value: 1000, dist: 'lowest', targetLevel: 'median', pool: 'övrigt' });
        expect(w.__state.kLage).not.toBe('export');   // på skärmen, utan förhandsvisning
        w.eval('sattKTroskel(10, { fraga: false })');
        expect(parRader(w)).toEqual([]);
        expect(aids(w)).toEqual(['6000']);
        expect(text(w, 'forecast-par-not')).toBe(`${NOT_10} 1 föreslagen rad togs bort eftersom paret den räknades ur har en grupp under 10 personer. `
            + 'Klicka på Föreslå fördelning mot skillnaderna i likvärdigt arbete för ett nytt förslag.');
        // Sänks tröskeln igen följer meningen om utelämnade par med; raden kommer inte tillbaka av sig själv, och
        // meningen om den borttagna raden står kvar tills ett nytt förslag görs.
        w.eval('sattKTroskel(5, { fraga: false })');
        expect(text(w, 'forecast-par-not')).toMatch(/^1 föreslagen rad togs bort/);
        w.eval('_forecastOptimize()');
        expect(text(w, 'forecast-par-not')).toBe('');
    });
    it('också jämförelseyrket: en rad föreslagen vid 5 tas bort när tröskeln höjs över jämförelseyrket (5 personer)', () => {
        const w = fonsterPar({ kvN: 12, jmfN: 5, k: 5 });
        w.eval('_forecastOptimize()');
        expect(parRader(w)).toHaveLength(1);
        w.eval('sattKTroskel(6, { fraga: false })');
        expect(parRader(w)).toEqual([]);
        expect(text(w, 'forecast-par-not')).toMatch(/^1 par med en grupp under 6 personer redovisas inte här\. 1 föreslagen rad togs bort/);
    });
    it('en konfigurationsfil med en föreslagen rad på ett par under tröskeln: raden läses inte in som förslag, den egna står kvar', () => {
        const fran = fonsterPar({ kvN: 6, jmfN: 24, k: 5 });
        fran.eval('_forecastOptimize()');
        fran.__state.forecast.targets.push({ bas: 'A', aid: '6000', mode: 'kr', value: 1000, dist: 'lowest', targetLevel: 'median', pool: 'övrigt' });
        const cfg = JSON.parse(JSON.stringify(fran.eval('buildConfigSnapshot()')));
        expect(cfg.forecast.targets.filter(t => t.kalla === 'par')).toHaveLength(1);
        // Filen läses in vid tröskeln 10: med fältet kTroskel i filen satt till 10, och utan fältet.
        for (const kTroskel of [10, undefined]) {
            const w = fonsterPar({ kvN: 6, jmfN: 24 });
            w.__cfg = { ...cfg, kTroskel };
            if (kTroskel === undefined) delete w.__cfg.kTroskel;
            w.eval('applyConfigSnapshot(window.__cfg)');
            expect(w.eval('kInstalld()')).toBe(10);
            expect(parRader(w)).toEqual([]);
            expect(aids(w)).toEqual(['6000']);
        }
    });
    it('en konfigurationsfil som läses in före lönefilen: den föreslagna raden prövas när lönefilen läses in', () => {
        const fran = fonsterPar({ kvN: 6, jmfN: 24, k: 5 });
        fran.eval('_forecastOptimize()');
        const cfg = JSON.parse(JSON.stringify(fran.eval('buildConfigSnapshot()')));
        const rader = JSON.parse(JSON.stringify(fran.__state.data));
        delete cfg.kTroskel;
        const w = createAppWindow();
        w.alert = () => {};
        w.__cfg = cfg;
        w.eval('applyConfigSnapshot(window.__cfg)');
        expect(parRader(w)).toHaveLength(1);   // utan lönefil finns inga par att pröva mot
        w.__state.data = rader;
        w.eval('_afterDataLoaded()');
        expect(parRader(w)).toEqual([]);
    });
    it('en egen rad på en grupp under tröskeln står kvar med sin not och följer med i exporten (regel R2)', async () => {
        const w = fonsterPar({ kvN: 6, jmfN: 24 });
        w.__state.forecast.targets = [{ bas: 'C', aid: '5300', mode: 'kr', value: 777, dist: 'lowest', targetLevel: 'median', pool: 'övrigt' }];
        w.eval('renderForecastTargets(); updateForecast();');
        expect(text(w, 'forecast-targets')).toMatch(/Raden berör 6 personer, färre än 10 personer/);
        w.eval('sattKTroskel(12, { fraga: false })');
        expect(aids(w)).toEqual(['5300']);
        expect(text(w, 'forecast-targets')).toMatch(/Raden berör 6 personer, färre än 12 personer/);
        const bok = await excel(w);
        expect(bok).toContain('BAS C, AID 5300: 777 kr/mån');
    });
});

// ADR-69, tillägget: ett par per kvinnodominerat yrke (det med störst skillnad bland dem som når den inställda
// tröskeln), och en föreslagen rad som inte säkert går att föra till ett par som når tröskeln tas bort.
describe('Löneöversyn: ett par per yrke i förslagen, och försiktig rensning (ADR-69)', () => {
    // 5300 (12 kvinnor) har två jämförelseyrken: 6100 (24 personer, skillnad 14 952) och 6200 (jmf2N män).
    const tvaJmf = (jmf2N, k = null, jmf2Lon = JMF2_LON) => fonsterPar({ kvN: 12, jmfN: 24, jmf2N, k, jmf2Lon });
    const BORTTAGEN = /föreslag(?:en rad|na rader) togs bort/;
    const sokInte = (t, tal, namn) => { for (const v of tal) expect(t, `${namn}: ${v}`).not.toContain(String(v)); };
    const litetTal = [GAP2, GAP2 * 12, JMF2_LON];
    const cfgFran = (w, { utanK = false } = {}) => {
        const cfg = JSON.parse(JSON.stringify(w.eval('buildConfigSnapshot()')));
        if (utanK) delete cfg.kTroskel;
        return cfg;
    };
    const lasIn = (w, cfg) => { w.__cfg = cfg; w.eval('applyConfigSnapshot(window.__cfg)'); };
    const parRad = value => ({ bas: 'C', aid: '5300', mode: 'kr', value, dist: 'lowest', targetLevel: 'median', pool: 'equity', kalla: 'par' });

    it('dubbelräkningen: två godkända jämförelseyrken ger en rad, och exporten stämmer med ett par', async () => {
        const w = tvaJmf(12);
        w.eval('_forecastOptimize()');
        expect(parRader(w).map(t => t.value)).toEqual([GAP2 * 12]);
        const bok = await excel(w);
        expect(bok.match(/Riktad pott \d+/g)).toEqual(['Riktad pott 1']);
        expect(bok).toContain(`Riktat (kr/mån) | ${GAP2 * 12}`);
        // Den nya medianen för 5300 är jämförelseyrkets (6200) median, inte lyft av två potter.
        const rad = bok.split('[Fördelning]')[1].split('\n').find(r => r.startsWith('C | 5300 |'));
        expect(rad).toBe(`C | 5300 | 12 | 100 | ${KV_LON} | ${JMF2_LON} | ${+(100 * (JMF2_LON / KV_LON - 1)).toFixed(1)} | ${GAP2 * 12}`);
    });
    it('mål-läget och känslighetskurvan räknar också ett par per yrke', () => {
        const w = tvaJmf(12);
        w.document.getElementById('forecast-closure-pct').value = '100';
        w.eval('_forecastClosure()');
        expect(parRader(w).map(t => t.value)).toEqual([GAP2 * 12]);
        w.eval('_forecastSensitivity()');
        const sista = [...w.document.querySelectorAll('#forecast-sensitivity tbody tr')].pop();
        const months = w.__state.costSettings.months, po = 1 + w.__state.costSettings.poPct / 100;
        expect(normalisera(sista.children[1].textContent)).toBe(`${Math.round(GAP2 * 12 * months * po)} kr`);
    });
    it('väg 1: förslaget vid 5 ur det lilla jämförelseyrket (6 män, störst skillnad) tas bort när tröskeln höjs till 10', async () => {
        const w = tvaJmf(6, 5);
        w.eval('_forecastOptimize()');
        expect(parRader(w).map(t => t.value)).toEqual([GAP2 * 12]);
        w.eval('sattKTroskel(10, { fraga: false })');
        expect(parRader(w)).toEqual([]);
        expect(text(w, 'forecast-par-not')).toMatch(BORTTAGEN);
        const bok = await excel(w);
        sokInte(bok, litetTal, 'Excel');
        sokInte(normalisera(JSON.stringify(w.eval('buildConfigSnapshot()').forecast)), litetTal, 'konfigurationsfilen');
    });
    it('väg 1, säkert: förslaget vid 5 ur det stora jämförelseyrket står kvar när tröskeln höjs till 10', () => {
        const w = tvaJmf(6, 5, 40000);   // 6200 har lägre lön än 6100: paret med 6100 har störst skillnad
        w.eval('_forecastOptimize()');
        expect(parRader(w).map(t => t.value)).toEqual([GAP * 12]);
        w.eval('sattKTroskel(10, { fraga: false })');
        expect(parRader(w).map(t => t.value)).toEqual([GAP * 12]);
        expect(text(w, 'forecast-par-not')).not.toMatch(BORTTAGEN);
    });
    it('väg 2: en konfigurationsfil med ett förslag räknat vid 5 läses in vid 10, med och utan kTroskel, före och efter lönefilen', () => {
        const fran = tvaJmf(6, 5);
        fran.eval('_forecastOptimize()');
        const rader = JSON.parse(JSON.stringify(fran.__state.data));
        for (const utanK of [false, true]) {
            const cfg = cfgFran(fran, { utanK });
            if (!utanK) cfg.kTroskel = 10;
            const efter = tvaJmf(6);
            lasIn(efter, cfg);
            expect(parRader(efter), `efter lönefilen, utanK=${utanK}`).toEqual([]);
            expect(text(efter, 'forecast-par-not')).toMatch(BORTTAGEN);
            const fore = createAppWindow();
            fore.alert = () => {};
            lasIn(fore, cfg);
            fore.__state.data = JSON.parse(JSON.stringify(rader));
            fore.eval('_afterDataLoaded()');
            expect(fore.eval('kInstalld()')).toBe(10);
            expect(parRader(fore), `före lönefilen, utanK=${utanK}`).toEqual([]);
        }
    });
    it('väg 2, försiktigt: en fil med en rad ur det stora paret tas också bort när yrket har ett par under tröskeln', () => {
        const w = tvaJmf(6);
        lasIn(w, { ...cfgFran(w), forecast: { ...cfgFran(w).forecast, targets: [parRad(GAP * 12)] } });
        expect(parRader(w)).toEqual([]);
    });
    it('väg 2: en fil med en föreslagen rad står kvar när alla yrkets par når tröskeln', () => {
        const w = tvaJmf(12);
        lasIn(w, { ...cfgFran(w), forecast: { ...cfgFran(w).forecast, targets: [parRad(GAP2 * 12)] } });
        expect(parRader(w).map(t => t.value)).toEqual([GAP2 * 12]);
        expect(text(w, 'forecast-par-not')).not.toMatch(BORTTAGEN);
    });
    it('väg 3: en äldre fil med två föreslagna rader för samma yrke, en per jämförelseyrke: båda tas bort vid 10', async () => {
        const w = tvaJmf(6);
        lasIn(w, { ...cfgFran(w), forecast: { ...cfgFran(w).forecast, targets: [parRad(GAP2 * 12), parRad(GAP * 12)] } });
        expect(parRader(w)).toEqual([]);
        sokInte(await excel(w), litetTal, 'Excel');
    });
    it('väg 3 och 4: inläst vid 5 står båda kvar; en tas bort för hand och tröskeln höjs: den andra tas bort', () => {
        const w = tvaJmf(6, 5);
        const cfg = cfgFran(w);
        lasIn(w, { ...cfg, forecast: { ...cfg.forecast, targets: [parRad(GAP * 12), parRad(GAP2 * 12)] } });
        expect(parRader(w).map(t => t.value)).toEqual([GAP * 12, GAP2 * 12]);
        w.__state.forecast.targets.splice(0, 1);   // som knappen Ta bort på raden
        w.eval('sattKTroskel(10, { fraga: false })');
        expect(parRader(w)).toEqual([]);
    });
    it('väg 4: en ensam föreslagen rad ur det lilla paret i en fil tas bort vid 10', () => {
        const w = tvaJmf(6);
        lasIn(w, { ...cfgFran(w), forecast: { ...cfgFran(w).forecast, targets: [parRad(GAP2 * 12)] } });
        expect(parRader(w)).toEqual([]);
    });
    it('egna rader berörs aldrig, också på ett yrke vars förslag tas bort', () => {
        const w = tvaJmf(6, 5);
        w.eval('_forecastOptimize()');
        w.__state.forecast.targets.push({ bas: 'C', aid: '5300', mode: 'kr', value: 777, dist: 'lowest', targetLevel: 'median', pool: 'övrigt' });
        w.eval('sattKTroskel(10, { fraga: false })');
        expect(w.__state.forecast.targets.map(t => [t.aid, t.value, t.kalla])).toEqual([['5300', 777, undefined]]);
    });
});

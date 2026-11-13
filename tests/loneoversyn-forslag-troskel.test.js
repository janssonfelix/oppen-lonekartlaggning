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

// kvN kvinnor i det kvinnodominerade yrket och jmfN personer i jämförelseyrket (var femte en kvinna).
function fonsterPar({ kvN, jmfN, k = null, minGroupN = 0 }) {
    const w = createAppWindow();
    const rader = [];
    const rad = (bas, kon, lon, aid, i) => ({ bas, kon, lon, alder: 30 + (i * 7) % 30, yrke: `${aid} Yrke ${aid}`, aid, yrkeLabel: `Yrke ${aid}`, enhet: '' });
    for (let i = 0; i < 30; i++) rader.push(rad('A', 'kvinna', 25000 + (i % 3) * 10, '6000', i), rad('A', 'man', 25500 + (i % 3) * 10, '6000', i));
    for (let i = 0; i < jmfN; i++) rader.push(rad('C', i % 5 === 4 ? 'kvinna' : 'man', JMF_LON, '6100', i));
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
        expect(text(w, 'forecast-par-not')).toBe(NOT_10);
        // Sänks tröskeln igen följer noten med; raden kommer inte tillbaka av sig själv.
        w.eval('sattKTroskel(5, { fraga: false })');
        expect(text(w, 'forecast-par-not')).toBe('');
        expect(aids(w)).toEqual(['6000']);
    });
    it('också jämförelseyrket: en rad föreslagen vid 5 tas bort när tröskeln höjs över jämförelseyrket (5 personer)', () => {
        const w = fonsterPar({ kvN: 12, jmfN: 5, k: 5 });
        w.eval('_forecastOptimize()');
        expect(parRader(w)).toHaveLength(1);
        w.eval('sattKTroskel(6, { fraga: false })');
        expect(parRader(w)).toEqual([]);
        expect(text(w, 'forecast-par-not')).toBe('1 par med en grupp under 6 personer redovisas inte här.');
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

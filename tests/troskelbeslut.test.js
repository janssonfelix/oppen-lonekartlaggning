/**
 * Produktägarens beslut om k-tröskeln 2026-10-16 (teknisk-plan § 9, tidigare punkterna 11–17):
 * demografidelens trendlinje, Löneöversyns tröskelmål, riktade rader ur konfigurationsfilen,
 * varningen "underlaget är litet", processöversiktens steg 4, diagramdata med en rad per person
 * och autocomplete="off" på fält som skapas efter start.
 *
 * Samma rigg som ktroskel.test.js: grupper där alla har samma lön, i tre storlekar (150, 20 och 6).
 */
import { describe, it, expect, vi } from 'vitest';
import { createAppWindow } from './helpers/app-harness.js';

vi.setConfig({ testTimeout: 30000 });

const STORA = ['S1', 'S2', 'S3', 'S4', 'S5', 'S6'], TOPP = 'S7';
const MELLAN = ['A', 'B', 'C', 'D'], SENT_MELLAN = [31417, 32719, 33827, 34513];
const SMA = ['E', 'F'], SENT_SMA = [35291, 36107];

function byggDataset() {
    const rader = [];
    const rad = (bas, i, lon, aid, namn) => ({ bas, kon: i % 2 === 0 ? 'kvinna' : 'man', lon,
        alder: 25 + ((i * 7) % 40), yrke: `${aid} ${namn}`, aid: String(aid), yrkeLabel: namn, enhet: '' });
    STORA.forEach((bas, b) => { for (let i = 0; i < 150; i++) rader.push(rad(bas, i, 24000 + b * 800 + ((i * 37) % 900), 6000 + b, `Säkeryrke ${b}`)); });
    for (let i = 0; i < 150; i++) rader.push(rad(TOPP, i, 50000 + ((i * 37) % 900), 6900, 'Toppyrke'));
    MELLAN.forEach((bas, g) => { for (let i = 0; i < 20; i++) rader.push(rad(bas, i, SENT_MELLAN[g], 5300 + g, `Mellanyrke ${g}`)); });
    SMA.forEach((bas, g) => { for (let i = 0; i < 6; i++) rader.push(rad(bas, i, SENT_SMA[g], 5400 + g, `Småyrke ${g}`)); });
    return rader;
}
function fonster(k = null, rader = byggDataset()) {
    const win = createAppWindow();
    if (k !== null) win.eval(`sattKTroskel(${k}, { fraga: false })`);
    win.__state.data = rader;
    win.__state.policy = [...STORA, TOPP, ...MELLAN, ...SMA].map(b => ({ bas: b, p10: 22000, med: 30000, p90: 52000 }));
    win.eval('populateSelects(); unlockTabs();');
    return win;
}
const text = el => (el ? el.textContent.replace(/\s+/g, ' ').trim() : '');

describe('Ålder & karriär: demografidelens trendlinje och lutning kräver att urvalet når tröskeln', () => {
    const rita = (w, bas) => { w.eval(`renderDemografi('${bas}')`); return w.document; };
    const harTrend = fig => fig.lager.some(l => l.marke === 'linje' && /^Trend/.test(l.serie));
    it('ett valt BAS med 6 personer: ingen trendlinje, streck i nyckeltalet och en not under diagrammet (vid 10)', () => {
        const d = rita(fonster(), 'E');
        const fig = d.getElementById('chart-demografi')._figur;
        expect(harTrend(fig)).toBe(false);
        expect(fig.lager.filter(l => l.marke === 'punkt')).toHaveLength(1);   // punkterna per person ritas som förut (ADR-14)
        expect(fig.beskrivning).not.toMatch(/med trendlinje/);
        expect(text(d.getElementById('nyckel-ak-lon'))).toBe('–');
        expect(text(d.getElementById('chart-demografi-k-not'))).toMatch(/^Trendlinje och lutning visas inte: urvalet har 6 personer, färre än 10\./);
        expect(text(d.getElementById('demo-insight'))).not.toMatch(/Löneutveckling/);
        expect(text(d.getElementById('demo-insight'))).toMatch(/färre än 10/);
    });
    it('samma BAS vid tröskeln 5: trendlinje, lutning och ingen not', () => {
        const d = rita(fonster(5), 'E');
        expect(harTrend(d.getElementById('chart-demografi')._figur)).toBe(true);
        expect(text(d.getElementById('nyckel-ak-lon'))).toMatch(/kr per år$/);
        // Noten om punkter per person (3 av varje kön i gruppen) finns kvar, men inte den om trendlinjen.
        expect(text(d.getElementById('chart-demografi-k-not'))).not.toMatch(/Trendlinje och lutning visas inte/);
        expect(text(d.getElementById('chart-demografi-k-not'))).toMatch(/Trendlinjen bygger på alla/);
        expect(text(d.getElementById('demo-insight'))).toMatch(/Löneutveckling/);
    });
    it('vid 25 behåller hela urvalet trendlinjen, ett BAS med 20 personer förlorar den', () => {
        const w = fonster(25);
        expect(harTrend(rita(w, '__ALLA__').getElementById('chart-demografi')._figur)).toBe(true);
        expect(harTrend(rita(w, 'A').getElementById('chart-demografi')._figur)).toBe(false);
        expect(text(w.document.getElementById('chart-demografi-k-not'))).toMatch(/urvalet har 20 personer, färre än 25/);
    });
});

describe('Löneöversyn: tröskelmålet (lyft i procent och kostnad) kräver tröskeln för varje kön', () => {
    const resultat = w => { w.eval("renderTabContent('loneoversyn'); _forecastThreshold()"); return text(w.document.getElementById('forecast-threshold-result')); };
    it('med 6 kvinnor i urvalet: streck och meningen om utelämnat könsuppdelat mått', () => {
        const alla = byggDataset();
        const kvinnor = alla.filter(r => r.kon === 'kvinna').slice(0, 6);
        const w = fonster(null, [...alla.filter(r => r.kon === 'man'), ...kvinnor]);
        const t = resultat(w);
        expect(t).toMatch(/^– Könsuppdelade lönemått redovisas inte eftersom ett kön har färre än 10 personer i urvalet\.$/);
        expect(t).not.toMatch(/likalönslyft|Kostnad/);
    });
    it('med hela urvalet visas lyftet som förut', () => {
        expect(resultat(fonster())).toMatch(/likalönslyft|Målet är redan uppfyllt/);
    });
    it('vid en tröskel över antalet kvinnor försvinner det igen', () => {
        const w = fonster(600);   // 600 kvinnor finns inte i underlaget
        expect(resultat(w)).toMatch(/färre än 600 personer/);
    });
});

// Samma underlag som ktroskel.test.js: ett kvinnodominerat yrke (5300) med 6 personer som bara blir ett
// kandidatpar vid tröskeln 5, och ett stort yrke (6000) för en egen rad.
function parFonster(k = 5) {
    const w = createAppWindow();
    const rader = [];
    const lagg = (n, kon, lon, bas, aid) => { for (let i = 0; i < n; i++) rader.push({ bas, kon, lon: lon + (i % 3) * 10,
        alder: 30 + (i * 7) % 30, yrke: `${aid} Yrke ${aid}`, aid, yrkeLabel: `Yrke ${aid}`, enhet: '' }); };
    lagg(30, 'kvinna', 25000, 'A', '6000'); lagg(30, 'man', 25500, 'A', '6000');
    lagg(20, 'man', 50000, 'C', '6100'); lagg(4, 'kvinna', 50000, 'C', '6100');
    lagg(6, 'kvinna', 36421, 'C', '5300');
    w.__state.data = rader;
    w.eval(`populateSelects(); unlockTabs(); sattKTroskel(${k}, { fraga: false });`);
    w.alert = () => {};
    return w;
}
// … med ett förslag ur paret och en egen rad i Löneöversyn.
function parFonsterMedRader() {
    const w = parFonster(5);
    Object.assign(w.__state.forecast, { minGroupN: 0, budget: { mode: 'kr', value: 5000000 }, generell: { mode: 'pct', value: 0 } });
    w.eval("renderTabContent('loneoversyn'); _forecastOptimize()");
    expect(w.__state.forecast.targets.map(t => t.aid)).toContain('5300');
    w.__state.forecast.targets.push({ bas: 'A', aid: '6000', mode: 'kr', value: 1000, dist: 'lowest', targetLevel: 'median', pool: 'övrigt' });
    return w;
}

describe('Konfigurationsfilen: riktade rader bär fältet kalla, så att förslag ur par rensas när tröskeln höjs', () => {
    const aids = w => w.__state.forecast.targets.map(t => t.aid).sort();
    it('filen bär kalla på förslaget men inte på den egna raden, och versionen är oförändrad', () => {
        const cfg = parFonsterMedRader().eval('buildConfigSnapshot()');
        expect(cfg.version).toBe(2);
        expect(cfg.forecast.targets.find(t => t.aid === '5300').kalla).toBe('par');
        expect(cfg.forecast.targets.find(t => t.aid === '6000').kalla).toBeUndefined();
    });
    it('spara vid 5, höj till 10, läs in: förslaget ur paret rensas, den egna raden står kvar med sin not', () => {
        const w = parFonsterMedRader();
        const cfg = w.eval('buildConfigSnapshot()');
        delete cfg.kTroskel;   // filen ska inte sänka tröskeln igen
        w.eval('sattKTroskel(10, { fraga: false })');
        expect(aids(w)).toEqual(['6000']);
        w.__cfg = JSON.parse(JSON.stringify(cfg));
        w.eval('applyConfigSnapshot(window.__cfg)');
        expect(aids(w)).toEqual(['6000']);
        expect(w.document.getElementById('forecast-targets').textContent).not.toMatch(/5300/);
        // En egen rad på en grupp under tröskeln läses in som egen och får noten.
        w.__cfg.forecast.targets = [{ bas: 'C', aid: '5300', mode: 'kr', value: 500, dist: 'lowest', targetLevel: 'median', pool: 'övrigt' }];
        w.eval('applyConfigSnapshot(window.__cfg)');
        expect(aids(w)).toEqual(['5300']);
        expect(w.__state.forecast.targets[0].kalla).toBeUndefined();
        expect(w.document.getElementById('forecast-targets').textContent).toMatch(/Gruppen har färre än 10 personer/);
    });
    it('läs in vid 5 och höj sedan: raden ur filen behandlas som förslag och rensas', () => {
        const w = parFonsterMedRader();
        const cfg = w.eval('buildConfigSnapshot()');
        w.__state.forecast.targets = [];
        w.__cfg = JSON.parse(JSON.stringify(cfg));
        w.eval('applyConfigSnapshot(window.__cfg)');
        expect(aids(w)).toEqual(['5300', '6000']);
        expect(w.__state.forecast.targets.find(t => t.aid === '5300').kalla).toBe('par');
        w.eval('sattKTroskel(10, { fraga: false })');
        expect(aids(w)).toEqual(['6000']);
    });
});

describe('Prioritering: varningen "underlaget är litet" går vid minsta gruppstorlek, inte vid 5', () => {
    const forslag = (k, kvN, maN) => {
        const w = createAppWindow();
        if (k !== null) w.eval(`sattKTroskel(${k}, { fraga: false })`);
        const rows = [];
        for (let i = 0; i < kvN; i++) rows.push({ kon: 'kvinna', lon: 20000 + i, alder: 40 });
        for (let i = 0; i < maN; i++) rows.push({ kon: 'man', lon: 40000 + i, alder: 40 });
        w.__item = { _rows: rows, kvN, maN, n: kvN + maN, diffPct: -8, costPerPerson: 0 };
        return w.eval('generateMotivationSuggestions(window.__item)').filter(f => f.type === 'warn').map(f => f.text).join(' ');
    };
    it('vid 10 varnar den för 7 män och nämner tröskeln', () => {
        expect(forslag(null, 12, 7)).toMatch(/Underlaget är litet \(12 kvinnor \/ 7 män; minsta gruppstorlek 10\)/);
    });
    it('vid 5 varnar den inte för 7 män, men för 4', () => {
        expect(forslag(5, 12, 7)).not.toMatch(/Underlaget är litet/);
        expect(forslag(5, 12, 4)).toMatch(/minsta gruppstorlek 5/);
    });
    it('vid 25 varnar den också för 20 av varje kön', () => {
        expect(forslag(25, 20, 20)).toMatch(/minsta gruppstorlek 25/);
    });
});

describe('Processöversiktens steg 4: inget att hantera när alla kandidatpar har en grupp under tröskeln', () => {
    const steg4 = w => { w.eval('renderProcessTracker()'); return [...w.document.querySelectorAll('#process-tracker .ptrack-row')].find(r => /Likvärdigt arbete/.test(r.textContent)); };
    it('regeln: tillståndet inget, inte klar, med antalet par och hänvisning till fliken', async () => {
        const { stegLikvardigt } = await import('../src/lib/attgora.js');
        expect(stegLikvardigt({ analys: true, antalPar: 0, utelamnade: 2, k: 10, t: 0, d: 0 })).toEqual({ status: 'inget',
            detail: 'Inget att hantera i Att göra: 2 par har en grupp under 10 personer och redovisas bara i fliken Likvärdigt arbete — gå till steget för att granska dem.' });
        expect(stegLikvardigt({ analys: true, antalPar: 0, utelamnade: 0, t: 0, d: 0 }).status).toBe('klar');
        expect(stegLikvardigt({ analys: true, antalPar: 1, utelamnade: 2, t: 1, d: 1 }).status).toBe('klar');
        expect(stegLikvardigt({ analys: true, antalPar: 1, utelamnade: 2, t: 1, d: 0 }).status).toBe('delvis');
    });
    it('vid 10 är steget "inget att hantera" med knappen till fliken; vid 5 är paret en punkt att hantera', () => {
        const w10 = parFonster(10);
        const rad10 = steg4(w10);
        expect(rad10.querySelector('.ptrack-status').dataset.status).toBe('inget');
        expect(text(rad10)).toMatch(/Inget att hantera i Att göra: 1 par har en grupp under 10 personer och redovisas bara i fliken Likvärdigt arbete/);
        expect(text(rad10)).not.toMatch(/redovisas inte här/);
        expect(rad10.querySelector('.ptrack-goto').dataset.gotoTab).toBe('likvardighet');
        const rad5 = steg4(parFonster(5));
        expect(rad5.querySelector('.ptrack-status').dataset.status).toBe('delvis');
        expect(text(rad5)).toMatch(/1 kandidatpar/);
    });
});

describe('Diagramdata från diagram med en punkt per person säger att filen innehåller en rad per person', () => {
    const RAD = 'Filen innehåller en rad per person (lön, kön, ålder eller grupp; inga namn eller identifierare) och ska hanteras som personuppgifter.';
    const rader = (w, id) => { w.__id = id; return w.eval('chartExportRows(document.getElementById(window.__id))'); };
    it('spridningsdiagrammen i Ålder & karriär bär raden på rad 2, efter stämpeln; aggregerade diagram bär den inte', () => {
        const w = fonster();
        w.eval("renderTabContent('kon')");
        for (const id of ['chart-kon-scatter', 'chart-demografi', 'chart-kon-multiplar']) {
            const r = rader(w, id);
            expect(r.length, id).toBeGreaterThan(3);
            expect(r[0][0], id).toMatch(/^.* — Lönekartläggning .*Minsta gruppstorlek för redovisning: 10\.$/);
            expect(r[1], id).toEqual([RAD]);
            expect(w.document.getElementById(id)._figur.individer, id).toBe(true);
        }
        for (const id of ['chart-kon-boxplot', 'chart-demo-hist', 'chart-kon-tathet', 'chart-demo-spread']) {
            const r = rader(w, id);
            expect(r.length, id).toBeGreaterThan(1);
            expect(JSON.stringify(r), id).not.toContain('rad per person');
        }
    });
    it('raden följer med till urklipp och CSV', async () => {
        const w = fonster();
        w.eval("renderTabContent('kon')");
        const texter = [];
        w.navigator.clipboard = { writeText: t => { texter.push(t); return Promise.resolve(); } };
        w.__id = 'chart-kon-scatter';
        await w.eval('chartExportRun(document.getElementById(window.__id), "data-kopiera")');
        expect(texter.join('\n')).toContain(RAD);
        const blobbar = [];
        w.URL.createObjectURL = b => { blobbar.push(b); return 'blob:x'; };
        w.URL.revokeObjectURL = () => {};
        await w.eval('chartExportRun(document.getElementById(window.__id), "data-csv")');
        expect(blobbar.length).toBeGreaterThan(0);
        expect(await blobbar[0].text()).toContain(RAD);
    });
});

describe('autocomplete="off" på alla fält, också de som skapas efter start', () => {
    const FLIKAR = ['dashboard', 'bestammelser', 'matrix', 'likvardighet', 'struktur', 'prioritering', 'loneoversyn',
                    'kon', 'demografi', 'benchmark', 'lonepolitik', 'kvalitet', 'rapport', 'handlingsplan', 'info', 'utforska', 'dokumentera', 'livscykel'];
    const utan = d => [...d.querySelectorAll('input, textarea, select')]
        .filter(el => el.type !== 'file' && el.getAttribute('autocomplete') !== 'off')
        .map(el => `${el.tagName.toLowerCase()}#${el.id || '?'}[name=${el.name || ''}][type=${el.type || ''}]`);
    it('efter att alla flikar ritats och riktade rader lagts till saknar inget fält attributet', async () => {
        const w = fonster();
        for (const f of FLIKAR) { try { w.eval(`renderTabContent('${f}')`); } catch (_e) { /* fliken finns inte */ } }
        w.__state.forecast.targets.push({ bas: 'A', aid: '5300', mode: 'kr', value: 500, dist: 'lowest', targetLevel: 'median', pool: 'övrigt' });
        w.eval('renderForecastTargets()');
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
        const w = fonster();
        w.eval("const d = document.createElement('div'); d.innerHTML = '<input type=\"text\" id=\"sent-falt\"><textarea id=\"sent-text\"></textarea>'; document.body.appendChild(d);");
        await new Promise(r => setTimeout(r, 0));
        expect(w.document.getElementById('sent-falt').getAttribute('autocomplete')).toBe('off');
        expect(w.document.getElementById('sent-text').getAttribute('autocomplete')).toBe('off');
    });
});

/**
 * Löneöversyns summor röjer ingen liten grupps kostnad (ADR-70): bladet Fördelning i exporten och utfallstabellen i
 * exportläget.
 *
 * En grupp under tröskeln har sin rad med BAS-intervall, yrke, antal och andel kvinnor; medianerna och kostnaden är
 * maskerade på raden. Kostnaden för de maskerade raderna står samlad på en rad, så att bladets kostnader summerar till
 * Använt i Sammanfattning. Den samlade kostnaden står bara när den omfattar minst tröskelns antal personer; annars viks
 * den minsta visade gruppens kostnad in, och den gruppens medianer maskeras också (antalet gånger skillnaden mellan
 * medianerna ligger nära kostnaden). Har alla grupper tillsammans färre än tröskeln står ingen kostnad per grupp.
 * Andelen till kvinnodominerade grupper står bara när den inte ger en del av den samlade kostnaden som differens.
 * Skärmen (tröskeln 1) visar varje grupp som förut.
 */
import { describe, it, expect, vi } from 'vitest';
import { createAppWindow } from './helpers/app-harness.js';
import { normalisera, iExport, fonsterKon, laddaXlsx, fangaBocker, ENSAM, X_KV, X_MA, PAR_KV, PAR_MA } from './helpers/ktroskel-rigg.js';

vi.setConfig({ testTimeout: 30000 });

const SAMLAD = 'Kostnad för grupper under tröskeln';
// Bladet som rader: celler åtskilda med " | " (fangaBocker); en not är en rad utan avskiljare.
const bladRader = (bok, namn) => bok.split(`[${namn}]`)[1].split(/\n\[/)[0].split('\n').filter(r => r.trim() !== '');
const celler = r => r.split(' | ');
const kostnadI = r => { const c = celler(r)[7]; return c === undefined || c.trim() === '' ? null : Number(c); };
const SMA_GRUPPER = [['E', '5400'], ['F', '5401'], ['X', '7002'], ['S1', '7001'], ['S3', '7300']];

const forbered = (w, pct = 2) => {
    Object.assign(w.__state.forecast, { generell: { mode: 'pct', value: pct } });
    w.__renderTabContent('loneoversyn');
    return w;
};
// Exporten i exportläget vid 10, med skärmens utfallstabell som den står före exporten (som ritar tillbaka skärmen).
async function exporteraFonster(w) {
    const tabell = [...w.document.querySelectorAll('#forecast-outcome .table-wrap tbody tr')].map(tr => [...tr.children].map(c => normalisera(c.textContent).trim()));
    const skarmText = normalisera(w.document.getElementById('forecast-outcome').textContent);
    await laddaXlsx(w);
    const bok = Object.values(fangaBocker(w, () => w.eval('exportForecast()')))[0];
    const blad = bladRader(bok, 'Fördelning'), rader = blad.filter(r => r.includes(' | ')).slice(1);
    const meta = bladRader(bok, 'Sammanfattning');
    const varde = namn => meta.find(r => r.startsWith(`${namn} |`)).split(' | ')[1];
    const samlad = rader.find(r => r.startsWith(`${SAMLAD} |`));
    const grupprader = rader.filter(r => r !== samlad);
    return { w, bok, tabell, skarmText, rader, grupprader, samlad, varde, meta,
        rad: (bas, aid) => rader.find(r => r.startsWith(`${bas} | ${aid} |`)),
        not: blad.find(r => !r.includes(' | ') && /ingår i summorna/.test(r)),
        anvant: Number(varde('Använt (kr/mån)')),
        visadKostnad: grupprader.reduce((s, r) => s + (kostnadI(r) || 0), 0) };
}
// Egna underlag: en grupp med `n` personer, varannan kvinna, lönerna från `lon0` i steg om 10.
const rad = (bas, aid, kon, lon) => ({ bas, kon, lon, alder: 40, yrke: `${aid} Yrke ${aid}`, aid, yrkeLabel: `Yrke ${aid}`, enhet: '' });
const grupp = (bas, aid, n, lon0, kon) => Array.from({ length: n }, (_, i) => rad(bas, aid, kon || (i % 2 ? 'man' : 'kvinna'), lon0 + i * 10));
const exportera = async (data, pct = 2) => {
    const w = createAppWindow();
    w.__state.data = data;
    w.eval('populateSelects(); unlockTabs();');
    return exporteraFonster(forbered(iExport(w), pct));
};
const STOR = grupp('A', '6000', 30, 30000), MELLAN12 = grupp('B', '6100', 12, 35000);

// Differensen Använt minus bladets kostnader per grupp får inte vara en liten grupps kostnad eller ge dess lönesumma
// (kostnaden delad med procentsatsen), och inget av talen står i bladet eller i Sammanfattning.
function ingenDifferens(r, dolda, pct = 2) {
    const diff = r.anvant - r.visadKostnad, tol = r.rader.length + 1;
    for (const kostnad of dolda) {
        expect(Math.abs(diff - kostnad), `differensen ${diff} mot ${kostnad}`).toBeGreaterThan(tol);
        expect(Math.abs(diff / (pct / 100) - kostnad / (pct / 100)), 'lönesumman').toBeGreaterThan(tol / (pct / 100));
        const re = new RegExp(`(?<![\\d.,])${Math.round(kostnad)}(?![\\d.,])`);
        expect([...r.rader, ...r.meta].filter(x => re.test(x)), String(kostnad)).toEqual([]);
    }
}
// En grupps rad med antal och andel, utan medianer och kostnad: "n<10" för en grupp under tröskeln, "se noten" för en
// grupp vars kostnad står på den samlade raden.
const maskeradRad = (bas, aid, n, andel, median = 'n<10') => `${bas} | ${aid} | ${n} | ${andel} | ${median} | ${median} |  | `;

describe('Löneöversyns blad Fördelning: de små grupperna har sina rader, och summorna röjer ingen liten grupps kostnad (ADR-70)', () => {
    it('exportläget vid 10: varje liten grupp har sin rad med antal och andel; kostnaden står samlad; bladet summerar till Använt', async () => {
        const r = await exporteraFonster(forbered(iExport(fonsterKon(null))));
        const alla = r.w.eval('_fcBeraknaUtfall(getData())').alloc.perGroup.filter(g => Math.abs(g.kostnad) > 0.5);
        const sma = alla.filter(g => g.n < 10);
        expect(sma.map(g => [g.bas, g.aid]).sort()).toEqual([...SMA_GRUPPER].sort());
        for (const g of sma) expect(r.rad(g.bas, g.aid), `${g.bas} ${g.aid}`).toBe(maskeradRad(g.bas, g.aid, g.n, Math.round(g.andelKv)));
        // En grupp över tröskeln har sin rad som förut, med medianer och kostnad.
        expect(r.rad('S2', '6001')).toMatch(/^S2 \| 6001 \| 150 \| 50 \| \d+ \| \d+ \| [\d.]+ \| \d+$/);
        // De små gruppernas 19 personer når tröskeln: ingen visad grupp viks in.
        expect(r.samlad).toBe(`${SAMLAD} | 5 grupper, 19 personer |  |  |  |  |  | ${Math.round(sma.reduce((s, g) => s + g.kostnad, 0))}`);
        expect(r.not).not.toMatch(/inte heller/);
        // Antalet i bladet är alla gruppers, och kostnaderna summerar till Använt.
        expect(r.grupprader.reduce((s, x) => s + Number(celler(x)[2]), 0)).toBe(alla.reduce((s, g) => s + g.n, 0));
        expect(Math.abs(r.anvant - r.visadKostnad - kostnadI(r.samlad))).toBeLessThanOrEqual(r.rader.length);
        // De maskerade raderna står efter de visade, i BAS-ordning: deras plats säger ingenting om deras kostnad.
        const forsta = r.grupprader.findIndex(x => / \| n<10 \| /.test(x));
        expect(r.grupprader.slice(forsta).every(x => / \| n<10 \| /.test(x))).toBe(true);
        expect(r.grupprader.slice(forsta).map(x => celler(x)[0])).toEqual(['E', 'F', 'S1', 'S3', 'X']);
        ingenDifferens(r, sma.map(g => g.kostnad));
    });

    it('(a) en ensam person under tröskeln: den minsta visade gruppens kostnad och medianer viks in', async () => {
        const r = await exportera([...STOR, ...MELLAN12, rad('C', '6200', 'kvinna', ENSAM)]);
        expect(r.rad('C', '6200')).toBe(maskeradRad('C', '6200', 1, 100));
        expect(r.rad('B', '6100')).toBe(maskeradRad('B', '6100', 12, 50, 'se noten'));
        expect(r.rad('A', '6000')).toMatch(/^A \| 6000 \| 30 \| 50 \| \d+ \| \d+ \| [\d.]+ \| \d+$/);
        expect(r.samlad).toMatch(new RegExp(`^${SAMLAD} \\| 2 grupper, 13 personer \\|  \\|  \\|  \\|  \\|  \\| \\d+$`));
        expect(r.not).toMatch(/^1 grupp med färre än 10 personer ingår i summorna/);
        expect(r.not).toMatch(/Medianerna och kostnaden för BAS B · 6100 redovisas inte heller per grupp/);
        ingenDifferens(r, [0.02 * ENSAM]);
    });

    it('(b) två små grupper som tillsammans är under tröskeln: den minsta visade gruppen viks in', async () => {
        const r = await exportera([...STOR, ...MELLAN12,
            rad('B', '6200', 'kvinna', X_KV), rad('B', '6200', 'man', X_MA), rad('A', '6300', 'kvinna', PAR_KV)]);
        expect(r.rad('B', '6200')).toBe(maskeradRad('B', '6200', 2, 50));
        expect(r.rad('A', '6300')).toBe(maskeradRad('A', '6300', 1, 100));
        expect(r.rad('B', '6100')).toBe(maskeradRad('B', '6100', 12, 50, 'se noten'));
        expect(r.samlad).toMatch(new RegExp(`^${SAMLAD} \\| 3 grupper, 15 personer \\|`));
        ingenDifferens(r, [X_KV + X_MA + PAR_KV, X_KV + X_MA, PAR_KV].map(l => 0.02 * l));
    });

    it('(c) små grupper som tillsammans når tröskeln: ingen visad grupp viks in', async () => {
        const r = await exportera([...STOR, ...MELLAN12, ...grupp('C', '6200', 6, 31000), ...grupp('C', '6201', 5, 32000)]);
        expect(r.rad('B', '6100')).toMatch(/^B \| 6100 \| 12 \| 50 \| \d+ \| \d+ \| [\d.]+ \| \d+$/);
        expect(r.rad('C', '6200')).toBe(maskeradRad('C', '6200', 6, 50));
        expect(r.rad('C', '6201')).toBe(maskeradRad('C', '6201', 5, 60));
        expect(r.samlad).toMatch(new RegExp(`^${SAMLAD} \\| 2 grupper, 11 personer \\|`));
        expect(r.not).not.toMatch(/inte heller/);
    });

    it('(d) alla grupper under tröskeln och färre än tröskeln tillsammans: ingen kostnad per grupp, bara summan', async () => {
        const r = await exportera([rad('A', '6000', 'kvinna', ENSAM), rad('A', '6000', 'man', X_MA),
            rad('B', '6100', 'kvinna', X_KV), rad('B', '6100', 'kvinna', PAR_KV), rad('C', '6200', 'man', PAR_MA)]);
        expect(r.samlad).toBeUndefined();
        expect(r.rader).toEqual([maskeradRad('A', '6000', 2, 50), maskeradRad('B', '6100', 2, 100), maskeradRad('C', '6200', 1, 0)]);
        expect(r.anvant).toBe(Math.round(0.02 * (ENSAM + X_MA + X_KV + PAR_KV + PAR_MA)));
        expect(r.not).toMatch(/så ingen kostnad redovisas per grupp/);
        // Andelen till kvinnodominerade grupper vore B 6100:s kostnad: den visas inte.
        expect(r.varde('Varav till kvinnodominerade grupper (kr/mån)')).toBe('–');
        ingenDifferens(r, [0.02 * (X_KV + PAR_KV), 0.02 * PAR_MA, 0.02 * (ENSAM + X_MA)]);
    });

    it('(e) lika antal bland de minsta visade grupperna: valet beror inte på ordningen i underlaget', async () => {
        const liten = [rad('C', '6200', 'kvinna', ENSAM)];
        const lika = [grupp('B', '6100', 12, 35000), grupp('A', '6400', 12, 36000)];
        const ett = await exportera([...STOR, ...lika[0], ...lika[1], ...liten]);
        const tva = await exportera([...liten, ...lika[1], ...lika[0], ...STOR]);
        for (const r of [ett, tva]) {
            expect(r.rad('A', '6400')).toBe(maskeradRad('A', '6400', 12, 50, 'se noten'));
            expect(r.rad('B', '6100')).toMatch(/^B \| 6100 \| 12 \| 50 \| \d+ \| \d+ \| [\d.]+ \| \d+$/);
            ingenDifferens(r, [0.02 * ENSAM]);
        }
        expect(ett.samlad).toBe(tva.samlad);
        expect(ett.rader).toEqual(tva.rader);
    });

    it('(f) utfallstabellen i exportläget följer bladet', async () => {
        const r = await exportera([...STOR, ...MELLAN12, rad('C', '6200', 'kvinna', ENSAM)]);
        const c = (bas, aid) => r.tabell.find(x => x[0] === bas && x[1] === aid);
        expect(c('C', '6200').slice(2, 5)).toEqual(['1', '100 %', 'n < 10 (maskerad)']);
        expect(c('B', '6100').slice(2, 5)).toEqual(['12', '50 %', 'visas inte (se noten)']);
        for (const x of [c('C', '6200'), c('B', '6100')]) expect(x.slice(5)).toEqual(['–', '–']);
        const s = r.tabell.find(x => x[0] === SAMLAD);
        expect(s[1]).toBe('2 grupper, 13 personer');
        expect(Number(s[3].replace(/\D/g, ''))).toBe(kostnadI(r.samlad));
        expect(r.skarmText).toMatch(/Medianerna och kostnaden för BAS B · 6100 redovisas inte heller per grupp/);
        expect(r.tabell.map(x => x.join(' ')).join('\n')).not.toContain(String(Math.round(0.02 * ENSAM)));
    });
});

describe('Varav till kvinnodominerade grupper: ger ingen del av den samlade kostnaden som differens (ADR-70)', () => {
    it('riggens underlag: 7001 (en kvinna) är den enda kvinnodominerade bland de maskerade grupperna, så andelen visas inte', async () => {
        const r = await exporteraFonster(forbered(iExport(fonsterKon(null))));
        expect(r.varde('Varav till kvinnodominerade grupper (kr/mån)')).toBe('–');
        expect(r.skarmText).toMatch(/Varav till kvinnodominerade grupper \([^)]*\): –/);
    });

    it('de maskerade grupperna är alla av samma slag: andelen står, och differensen är hela den samlade kostnaden eller noll', async () => {
        const r = await exportera([...STOR, ...grupp('B', '6100', 12, 35000, 'kvinna'), rad('C', '6200', 'kvinna', ENSAM)]);
        const varav = Number(r.varde('Varav till kvinnodominerade grupper (kr/mån)'));
        expect(varav).toBe(kostnadI(r.samlad));
    });

    it('båda slagen har minst tröskelns antal personer bland de maskerade: andelen står', async () => {
        const r = await exportera([...STOR, ...grupp('C', '6200', 6, 31000, 'kvinna'), ...grupp('C', '6201', 5, 32000, 'kvinna'),
            ...grupp('D', '6300', 6, 33000), ...grupp('D', '6301', 5, 34000)]);
        const varav = Number(r.varde('Varav till kvinnodominerade grupper (kr/mån)'));
        const alla = r.w.eval('_fcBeraknaUtfall(getData())');
        expect(Math.abs(varav - alla.equityCost)).toBeLessThanOrEqual(1);
        expect(varav).toBeGreaterThan(0);
    });

    it('ett slag med färre än tröskelns antal personer bland de maskerade: andelen visas inte', async () => {
        const r = await exportera([...STOR, ...MELLAN12, rad('C', '6200', 'kvinna', ENSAM)]);
        expect(r.varde('Varav till kvinnodominerade grupper (kr/mån)')).toBe('–');
    });
});

describe('Löneöversyn på skärmen och med egna riktade rader', () => {
    it('en egen riktad rad på en liten grupp: beloppet står i Sammanfattning (regel R2), gruppen har sin rad utan kostnad', async () => {
        const w = fonsterKon(null);
        w.__state.forecast.targets.push({ bas: 'X', aid: '7002', mode: 'kr', value: 1234, dist: 'flat', targetLevel: 'median', pool: 'övrigt' });
        const r = await exporteraFonster(forbered(iExport(w)));
        expect(r.meta.find(x => x.startsWith('Riktad pott 1 |'))).toMatch(/BAS X, AID 7002: 1234 kr\/mån/);
        expect(r.rad('X', '7002')).toBe(maskeradRad('X', '7002', 4, 50));
    });

    it('skärmen visar varje grupp med medianer och kostnad som förut, utan samlad rad', () => {
        const w = forbered(fonsterKon(null));
        const tabell = [...w.document.querySelectorAll('#forecast-outcome .table-wrap tbody tr')].map(tr => [...tr.children].map(c => normalisera(c.textContent)));
        for (const [bas, aid] of SMA_GRUPPER) {
            const c = tabell.find(x => x[0] === bas && x[1] === aid);
            expect(c, `${bas} ${aid}`).toBeTruthy();
            expect(c[7], `${bas} ${aid}`).toMatch(/\d kr\/mån/);
        }
        expect(tabell.some(c => c[0] === SAMLAD)).toBe(false);
    });
});

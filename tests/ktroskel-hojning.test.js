/**
 * K-tröskeln som inställning: tröskeln styr varje flik — höjning 10 → 25 utan omritning, läsning vid 5, tur och retur 10 → 25 → 10 och Rensa all data.
 *
 * Riggen (fixturer, fönster och sökfunktioner) ligger i tests/helpers/ktroskel-rigg.js; sviten är delad i
 * åtta filer så att Vitest fördelar den över flera arbetare.
 */
import { describe, it, expect, vi } from 'vitest';
import { FLIKAR, normalisera, synliga, fonster, ritaAlla, SENT_MELLAN, SENT_SMA, iExport } from './helpers/ktroskel-rigg.js';

// Sviten ritar om hela verktyget i varje test. Under full last tar ett test 4–6 s, så standardgränsen 5 s
// fäller olika tester från körning till körning.
vi.setConfig({ testTimeout: 30000 });

describe('k-tröskeln styr varje flik', () => {
    it('höjning 10 → 25 ritar om redan ritade flikar, utan egen rendering (exportläget)', async () => {
        const w = iExport(fonster(null));
        ritaAlla(w);
        w.__renderTabContent('utforska');
        expect(synliga(w, SENT_MELLAN).length).toBeGreaterThan(0);
        w.eval('sattKTroskel(25, { fraga: false })');
        expect(synliga(w, [...SENT_MELLAN, ...SENT_SMA])).toEqual([]);
    });
    it('höjning 10 → 25: Excel-exporten av alla flikar saknar mellangrupperna utan omritning', async () => {
        const { readFileSync } = await import('node:fs');
        const w = fonster(null);
        w.eval(readFileSync(new URL('../vendor/xlsx.mini.min.js', import.meta.url), 'utf8'));
        ritaAlla(w);
        w.__renderTabContent('utforska');
        w.eval('sattKTroskel(25, { fraga: false })');
        w.alert = () => {};
        const fangat = {};
        w.XLSX.writeFile = (wb, namn) => { fangat[namn] = wb; };
        w.eval('exportAllToExcel()');
        expect(Object.keys(fangat).length).toBeGreaterThan(0);
        const lackor = [];
        for (const [namn, wb] of Object.entries(fangat)) for (const blad of wb.SheetNames) {
            for (const rad of w.XLSX.utils.sheet_to_json(wb.Sheets[blad], { header: 1, raw: true })) for (const c of rad) {
                const t = normalisera(String(c ?? ''));
                for (const v of SENT_MELLAN) if (t.includes(String(v))) lackor.push(`${namn} / ${blad}: ${t.slice(0, 60)}`);
            }
        }
        expect(lackor).toEqual([]);
    });
    it('höjning 10 → 25: Utforskas export behandlar 20-personersgrupperna som små', async () => {
        const w = fonster(null);
        w.__renderTabContent('utforska');
        await new Promise(r => setTimeout(r, 0));
        w.eval('sattKTroskel(25, { fraga: false })');
        await new Promise(r => setTimeout(r, 0));
        w.document.getElementById('explore-inkludera-sma').checked = false;
        const har = rader => rader.flat().some(c => SENT_MELLAN.some(v => normalisera(String(c)).includes(String(v))));
        expect(har(w.__tableToMatrix('explore-table'))).toBe(false);
        expect(har(w.__chartExportRows(w.document.getElementById('chart-explore')))).toBe(false);
    });
    it('vid 5 syns även de små grupperna', () => {
        const w = fonster(5);
        ritaAlla(w);
        expect(synliga(w, SENT_SMA).length).toBeGreaterThan(0);
    });
    it('vid 5 körs ingen regression per BAS med färre än 10 av något kön', () => {
        const w = fonster(5);
        const r = w.eval(`_computePerBasGap(getData(), ['E', 'S1'])`);
        expect(r.find(x => x.bas === 'E').status).toBe('too_few');
        expect(r.find(x => x.bas === 'S1').status).not.toBe('too_few');
    });
    it('10 → 25 → 10 ger samma flikar som före ändringen (inga kvarlevande cacher)', async () => {
        const w = fonster(null);
        const bild = () => FLIKAR.map(f => { w.__renderTabContent(f); return normalisera(w.document.getElementById('view-' + f)?.textContent || ''); });
        // Grundtillstånd som efter en vanlig inläsning (32-filinlasning.js): också Översiktens delar är ritade.
        w.eval('invalidateStatCaches(); renderActionChecklist(); renderProcessTracker(); renderOutliers(); renderDataValidationReport(); refreshCurrentTab();');
        const fore = bild();
        // Golvet ändras (10 → 25 → 10): bootstrap-KI och styrkan räknas om i bakgrunden efter omritningen; vänta in den.
        w.eval('sattKTroskel(25, { fraga: false })'); await w.eval('_skattningarIBakgrunden()'); bild();
        w.eval('sattKTroskel(10, { fraga: false })'); await w.eval('_skattningarIBakgrunden()');
        const efter = bild();
        // Vid en skillnad: säg vilken flik och visa stället, i stället för två hela sidtexter.
        const skillnader = FLIKAR.map((f, i) => {
            if (efter[i] === fore[i]) return null;
            let n = 0; while (n < fore[i].length && fore[i][n] === efter[i][n]) n++;
            return `${f} @${n}: före "…${fore[i].slice(Math.max(0, n - 60), n + 60)}…" efter "…${efter[i].slice(Math.max(0, n - 60), n + 60)}…"`;
        }).filter(Boolean);
        expect(skillnader).toEqual([]);
    }, 60000);   // sexton flikar ritas fem gånger: nära 4 s ensamt, 20–30 s när hela sviten körs med en arbetare per tråd
    it('Rensa all data återställer till 10', () => {
        const w = fonster(25);
        w.eval('_rensaAllData()');
        expect(w.eval('kInstalld()')).toBe(10);
    });
});

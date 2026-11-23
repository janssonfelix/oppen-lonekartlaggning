/**
 * K-tröskeln som inställning: tröskeln styr varje flik — höjning 10 → 25 utan omritning, läsning vid 5, tur och retur 10 → 25 → 10 och Rensa all data.
 *
 * Riggen (fixturer, fönster och sökfunktioner) ligger i tests/helpers/ktroskel-rigg.js; sviten är delad i
 * flera filer så att Vitest fördelar den över flera arbetare.
 */
import { describe, it, expect, vi } from 'vitest';
import { FLIKAR, normalisera, synliga, fonster, ritaAlla, SENT_MELLAN, SENT_SMA, iExport } from './helpers/ktroskel-rigg.js';
import { createAppWindow } from './helpers/app-harness.js';
import { styrkeanalys } from '../src/lib/osakerhet.js';

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
        w.eval('exportAlltTillExcel()');
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
        expect(har(w.__tabellTillMatris('explore-table'))).toBe(false);
        expect(har(w.__diagramexportRader(w.document.getElementById('chart-explore')))).toBe(false);
    });
    it('vid 5 syns även de små grupperna', () => {
        const w = fonster(5);
        ritaAlla(w);
        expect(synliga(w, SENT_SMA).length).toBeGreaterThan(0);
    });
    it('vid 5 körs ingen regression per BAS med färre än 10 av något kön', () => {
        const w = fonster(5);
        const r = w.eval(`_computePerBasGap(hamtaData(), ['E', 'S1'])`);
        expect(r.find(x => x.bas === 'E').status).toBe('too_few');
        expect(r.find(x => x.bas === 'S1').status).not.toBe('too_few');
    });
    it('10 → 25 → 10 ger samma flikar som före ändringen (inga kvarlevande cacher)', async () => {
        const w = fonster(null);
        const bild = () => FLIKAR.map(f => { w.__renderTabContent(f); return normalisera(w.document.getElementById('view-' + f)?.textContent || ''); });
        // Grundtillstånd som efter en vanlig inläsning (32-filinlasning.js): också Översiktens delar är ritade.
        w.eval('invalidateStatCaches(); renderActionChecklist(); renderProcessTracker(); renderOutliers(); renderDataValidationReport(); refreshCurrentTab();');
        w.__renderTabContent('matrix'); await w.eval('_regKvantilKlar()');   // kvantilregressionens intervall räknas i bakgrunden efter första ritningen
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

// ADR-103: golvet för skattningar är 10 på skärmen och följer en högre tröskel bara i exportläget. Vid 25 ska en skattning
// för en grupp med 10–24 av ett kön synas på skärmen men inte i det som lämnar verktyget, också när skattningen räknats
// och sparats i det andra läget först.
describe('golvet för skattningar följer tröskeln bara i exportläget (ADR-103)', () => {
    // 15 kvinnor och 30 män i en grupp, 30 män i en annan: kvinnorna når golvet 10 men inte 25.
    function fonsterObalans() {
        const w = createAppWindow();
        w.eval('sattKTroskel(25, { fraga: false })');
        const rader = [];
        for (let i = 0; i < 45; i++) rader.push({ bas: 'S1', kon: i < 15 ? 'kvinna' : 'man', lon: 28000 + ((i * 37) % 900) + (i < 15 ? 0 : 600),
            alder: 25 + ((i * 7) % 40), yrke: '6000 Säkeryrke 0', aid: '6000', yrkeLabel: 'Säkeryrke 0', enhet: '' });
        for (let i = 0; i < 30; i++) rader.push({ bas: 'S2', kon: 'man', lon: 32000 + ((i * 41) % 1100),
            alder: 25 + ((i * 11) % 40), yrke: '6001 Säkeryrke 1', aid: '6001', yrkeLabel: 'Säkeryrke 1', enhet: '' });
        w.__state.data = rader;
        w.__state.policy = ['S1', 'S2'].map(b => ({ bas: b, p10: 22000, med: 30000, p90: 52000 }));
        w.eval('populateSelects(); unlockTabs();');
        return w;
    }
    const json = v => JSON.parse(JSON.stringify(v));

    it('vid 25 är golvet 10 på skärmen och 25 i exportläget; vid 5 är det 10 i båda', () => {
        const w = fonster(25);
        expect(w.eval('statGolv()')).toBe(10);
        expect(w.eval('medExportLage(() => statGolv())')).toBe(25);
        w.eval('sattKTroskel(5, { fraga: false })');
        expect(w.eval('statGolv()')).toBe(10);
        expect(w.eval('medExportLage(() => statGolv())')).toBe(10);
    });
    it('vid 25 prövas grupperna om 20 (10 av varje kön) på skärmen men inte i exporten', () => {
        const w = fonster(25);
        const status = uttryck => w.eval(uttryck).find(p => p.bas === 'A').status;
        expect(status(`_computePerBasGap(hamtaData(), ['A'])`)).not.toBe('too_few');
        expect(status(`medExportLage(() => _computePerBasGap(hamtaData(), ['A']))`)).toBe('too_few');
        expect(status(`_computePerBasGap(hamtaData(), ['A'])`)).not.toBe('too_few');
        // Personer att granska (bara på skärmen): grupperna om 20 prövas; de två om 6 inte, och noten säger vad man kan göra.
        w.eval('renderPersonerAttGranska()');
        expect(normalisera(w.document.getElementById('pag-innehall').textContent))
            .toMatch(/12 personer i grupper med färre än 10 personer prövades inte\. Se lönerna under Tabeller och egna vyer och dokumentera bedömningen under Sakliga skäl i Handlingsplan\./);
    });
    it('bootstrap-KI och styrkan som räknats på skärmen följer inte med ut', () => {
        const w = fonsterObalans();
        w.eval('invalidateStatCaches()');                                       // skärmen först (golvet 10)
        expect(w.__state.bootstrapCI).not.toBeNull();
        expect(w.eval('bootstrapCIGallande()')).toBe(w.__state.bootstrapCI);
        expect(w.eval('medExportLage(() => bootstrapCIGallande())')).toBeNull();  // 15 kvinnor når inte 25
        const skarm = json(w.eval('styrkaGallande()')), ut = json(w.eval('medExportLage(() => styrkaGallande())'));
        expect(skarm).toEqual(json(styrkeanalys(w.__state.data, 10)));
        expect(ut).toEqual(json(styrkeanalys(w.__state.data, 25)));
        expect(ut).not.toEqual(skarm);
        expect(w.eval('bootstrapCIGallande()')).toBe(w.__state.bootstrapCI);   // och skärmen har kvar sitt
    });
    it('räknade i exportläget först ger de skärmen dess egna, och exporten sina', () => {
        const w = fonsterObalans();
        w.eval('medExportLage(() => invalidateStatCaches())');                  // exporten först (golvet 25)
        expect(w.__state.bootstrapCI).toBeNull();
        expect(w.eval('bootstrapCIGallande()')).not.toBeNull();                 // skärmen räknar sitt
        expect(w.eval('medExportLage(() => bootstrapCIGallande())')).toBeNull();
        expect(json(w.eval('styrkaGallande()'))).toEqual(json(styrkeanalys(w.__state.data, 10)));
        expect(json(w.eval('medExportLage(() => styrkaGallande())'))).toEqual(json(styrkeanalys(w.__state.data, 25)));
    });
});

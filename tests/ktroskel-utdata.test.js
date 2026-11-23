/**
 * K-tröskeln som inställning: Lönepolitik, Prioritering, paren i likvärdigt arbete, texterna, gränssnittet, utdata, utskriften, konfigurationsfilen och organisationspaketet.
 *
 * Riggen (fixturer, fönster och sökfunktioner) ligger i tests/helpers/ktroskel-rigg.js; sviten är delad i
 * flera filer så att Vitest fördelar den över flera arbetare.
 */
import { describe, it, expect, vi } from 'vitest';
import { createAppWindow } from './helpers/app-harness.js';
import { normalisera, fonster, fonsterLitet, tvaDec, iExport } from './helpers/ktroskel-rigg.js';

// Sviten ritar om hela verktyget i varje test. Under full last tar ett test 4–6 s, så standardgränsen 5 s
// fäller olika tester från körning till körning.
vi.setConfig({ testTimeout: 30000 });

describe('k-tröskeln under 5 i Lönepolitik', () => {
    it('mellannivån med bara antal finns inte när tröskeln är 3 (exportläget)', () => {
        const w = iExport(fonster(3));
        expect(w.eval('_lpTier(4)')).toBe('full');
        expect(w.eval('_lpTier(2)')).toBe('masked');
        w.__ritaFlik('lonepolitik');
        expect(w.document.getElementById('view-benchmark').textContent).not.toMatch(/under 5 maskeras/);
    });
});

describe('k-tröskeln: Prioritering visar ingen könsjämförelse för ett kön under tröskeln', () => {
    const KV = 30000, MA = 41893;          // 10 kvinnor, 2 män (unikt sentinelvärde)
    it('gruppen med 2 män visas med samlad median men utan könsgap', () => {
        const w = createAppWindow();
        const rader = [];
        const rad = (bas, i, lon, aid, namn, kon) => ({ bas, kon, lon, alder: 25 + ((i * 7) % 40), yrke: `${aid} ${namn}`, aid: String(aid), yrkeLabel: namn, enhet: '' });
        for (let b = 0; b < 3; b++) for (let i = 0; i < 40; i++) rader.push(rad('F' + b, i, 25000 + b * 700 + ((i * 37) % 900), 6000 + b, 'Fyllnad' + b, i % 2 ? 'man' : 'kvinna'));
        for (let i = 0; i < 10; i++) rader.push(rad('P', i, KV, 7000, 'Skevyrke', 'kvinna'));
        for (let i = 0; i < 2; i++) rader.push(rad('P', i, MA, 7000, 'Skevyrke', 'man'));
        w.__state.data = rader;
        w.__state.policy = ['F0', 'F1', 'F2', 'P'].map(b => ({ bas: b, p10: 22000, med: 30000, p90: 52000 }));
        w.eval('fyllValjare(); lasUppFlikar();');
        iExport(w);   // så som tabellen lämnar verktyget; skärmen maskerar inget (ADR-51)
        w.__ritaFlik('prioritering');
        const vy = w.document.getElementById('view-prioritering');
        const text = normalisera(vy.textContent + ' ' + [...vy.querySelectorAll('*')].map(e => Array.from(e.attributes, a => a.value).join(' ')).join(' '));
        const gapPct = (KV / MA - 1) * 100;   // tabellen visar två decimaler, hovertexten en
        expect(text).toContain('Skevyrke');                 // raden finns kvar
        expect(text).toContain(String(KV));                 // med samlad median (30 000)
        expect(text).not.toContain(String(MA));
        // Varken som skillnad eller som procent av mäns, med punkt eller komma.
        const en = gapPct.toFixed(1);   // med tecken: utan tecken träffar en decimal för lätt något annat
        for (const f of [...tvaDec(gapPct), en, en.replace('.', ','), en.replace('-', '\u2212'), en.replace('-', '\u2212').replace('.', ',')]) expect(text, f).not.toContain(f);
    });
});

describe('k-tröskeln: par i likvärdigt arbete i Word-utkastet och utskriften', () => {
    const SENT = 36421;
    const fonsterPar = k => {
        const w = createAppWindow();
        const rader = [];
        const lagg = (n, kon, lon, bas, aid) => { for (let i = 0; i < n; i++) rader.push({ bas, kon, lon: lon + (i % 3) * 10,
            alder: 30 + (i * 7) % 30, yrke: `${aid} Yrke ${aid}`, aid, yrkeLabel: `Yrke ${aid}`, enhet: '' }); };
        lagg(30, 'kvinna', 25000, 'A', '6000'); lagg(30, 'man', 25500, 'A', '6000');
        lagg(20, 'man', 50000, 'C', '6100'); lagg(4, 'kvinna', 50000, 'C', '6100');   // jämförelseyrke
        lagg(6, 'kvinna', SENT, 'C', '5300');                                         // litet, kvinnodominerat
        w.__state.data = rader;
        w.eval('fyllValjare(); lasUppFlikar();');
        if (k !== null) w.eval(`sattKTroskel(${k}, { fraga: false })`);
        return w;
    };
    const utskrift = async w => {
        w.eval("sattRapportUrval('hela')");   // hela dokumentationen, med bilagorna
        await w.eval('buildPrintReport()');
        return normalisera(w.document.getElementById('print-report').innerHTML);
    };
    it('paret finns i beräkningen (annars prövar testet inget)', () => {
        const par = fonsterPar(null).eval('likvardighetResultat().pairs');
        expect(par.some(p => p.kvAid === '5300' && p.kvN === 6)).toBe(true);
    });
    it('vid 10 utelämnas paret ur Word-utkastet och utskriften, och antalet anges', async () => {
        const w = fonsterPar(null);
        const ord = normalisera(w.__docDraftHtml());
        const tryck = await utskrift(w);
        // Sentinelmedianen kan förekomma som P10 för hela BAS C (en annan, tillåten grupp); par-tabellen prövas via etiketten.
        for (const t of [ord, tryck]) {
            // Gruppen får nämnas i k-notan (ADR-12), men inte stå som cell i en par-tabell.
            expect(t).not.toMatch(/<td[^>]*>[^<]*5300 Yrke 5300|<td[^>]*>[^<]*Yrke 5300/);
            expect(t).toMatch(/\d+ par med en grupp under 10 personer redovisas inte här/);
        }
    });
    it('vid 5 finns paret i båda', async () => {
        const w = fonsterPar(5);
        expect(normalisera(w.__docDraftHtml())).toContain('Yrke 5300');
        expect(await utskrift(w)).toContain('Yrke 5300');
    });
});

describe('k-tröskeln: par i likvärdigt arbete utanför fliken (protokoll, Att göra, handlingsplan, gruppdossier)', () => {
    // Undantaget gäller bara fliken Likvärdigt arbete och dess egen export. Överallt annars utelämnas
    // ett par där en grupp är under tröskeln, och utdata anger hur många som lämnats ut.
    const SENT = 36431;   // medianen i den lilla gruppen (36421, 36431, 36441 i tur och ordning)
    const ETIKETT = 'Yrke 5300';
    const NOT = /\d+ par med en grupp under 10 personer redovisas inte här/;
    const fonsterPar = k => {
        const w = createAppWindow();
        const rader = [];
        const lagg = (n, kon, lon, bas, aid) => { for (let i = 0; i < n; i++) rader.push({ bas, kon, lon: lon + (i % 3) * 10,
            alder: 30 + (i * 7) % 30, yrke: `${aid} Yrke ${aid}`, aid, yrkeLabel: `Yrke ${aid}`, enhet: '' }); };
        lagg(30, 'kvinna', 25000, 'A', '6000'); lagg(30, 'man', 25500, 'A', '6000');
        lagg(20, 'man', 50000, 'C', '6100'); lagg(4, 'kvinna', 50000, 'C', '6100');   // jämförelseyrke
        lagg(6, 'kvinna', 36421, 'C', '5300');                                        // litet, kvinnodominerat
        w.__state.data = rader;
        w.eval('fyllValjare(); lasUppFlikar();');
        if (k !== null) w.eval(`sattKTroskel(${k}, { fraga: false })`);
        return w;
    };
    // Allt som exporterna skriver, som en enda text per export
    const fangaExcel = async (w, fn) => {
        const { readFileSync } = await import('node:fs');
        const { join, dirname } = await import('node:path');
        const { fileURLToPath } = await import('node:url');
        w.eval(readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'vendor', 'xlsx.mini.min.js'), 'utf8'));
        w.alert = () => {};
        let wb = null;
        w.XLSX.writeFile = b => { wb = b; };
        w.eval(`${fn}()`);
        return normalisera(wb.SheetNames.map(n => w.XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, raw: true })
            .map(r => r.map(c => String(c ?? '')).join(' | ')).join('\n')).join('\n'));
    };
    const fangaCsv = w => {
        w.eval('window.__csv = null; _laddaNedCSV = rows => { window.__csv = rows; }');
        w.document.getElementById('btn-export-checklist').click();
        return normalisera((w.__csv || []).map(r => r.join(' | ')).join('\n'));
    };
    const attGora = w => {
        w.eval('ritaAtgardslista()');
        return {
            punkter: normalisera(w.eval('JSON.stringify(medExportLage(() => byggAtgardslista()))')),
            kort: normalisera(w.document.getElementById('action-checklist-container').textContent
                + w.document.getElementById('att-gora-borja').textContent),
            csv: fangaCsv(w),
        };
    };
    const dossier = (w, nyckel) => {
        w.eval(`ritaGruppdossier('${nyckel}')`);
        return { skarm: normalisera(w.document.getElementById('dossier-body').textContent),
                 text: normalisera(w.eval(`medExportLage(() => gruppdossierAsText(buildGruppdossier('${nyckel}')))`)) };
    };

    it('paret finns i beräkningen (annars prövar testet inget)', () => {
        const par = fonsterPar(null).eval('likvardighetResultat().pairs');
        expect(par.some(p => p.kvAid === '5300' && p.kvN === 6 && p.maAid === '6100')).toBe(true);
    });

    it('vid 10: protokollet för gemensam lönebedömning saknar paret och anger antalet', async () => {
        const w = fonsterPar(null);
        const text = await fangaExcel(w, 'exportJPAProtokoll');
        expect(text).not.toContain(ETIKETT);
        expect(text).not.toContain(String(SENT));
        expect(text).toMatch(NOT);
        expect(text).toMatch(/Antal redovisade kandidatpar i likvärdigt arbete[^|]*\| 0/);
    });
    it('vid 10: Att göra på skärmen visar paret; punkterna i exportläget och CSV-filen saknar det och anger antalet', () => {
        const a = attGora(fonsterPar(null));
        expect(a.kort).toContain(ETIKETT);   // skärmen maskerar inget (ADR-51)
        for (const t of [a.punkter, a.csv]) {
            expect(t).not.toContain(ETIKETT);
            expect(t).not.toContain(String(SENT));
        }
        expect(a.csv).toMatch(NOT);
    });
    it('vid 10: handlingsplanens förifyllda rader visar paret på skärmen; i exportläget och i Excel saknas det, och antalet anges', async () => {
        const w = fonsterPar(null);
        expect(w.eval('_handlingsplanSeedRows()').lvCount).toBe(1);   // skärmen maskerar inget (ADR-51)
        const seed = w.eval('medExportLage(() => _handlingsplanSeedRows())');
        expect(seed.lvCount).toBe(0);
        expect(JSON.stringify(seed.rows)).not.toContain('5300');
        w.eval('renderHandlingsplanSeed()');
        expect(normalisera(w.document.getElementById('handlingsplan-tbody').textContent)).toContain('5300');
        const excel = await fangaExcel(w, 'exportHandlingsplan');
        expect(excel).not.toContain('5300');
        expect(excel).toMatch(NOT);
    });
    it('vid 10: robusthetspanelen namnger inte den lilla gruppen och anger antalet; vid 5 står den med', () => {
        const panel = w => { w.eval("_renderRobusthetResult(document.getElementById('robusthet-body'))"); return normalisera(w.document.getElementById('robusthet-body').textContent); };
        const vid10 = panel(fonsterPar(null));
        expect(vid10).not.toContain(ETIKETT);
        expect(vid10).not.toContain('5300');
        expect(vid10).toMatch(/1 par med en grupp under 10 personer redovisas inte här/);
        expect(vid10).toContain('Inga kandidatpar att namnge');
        const vid5 = panel(fonsterPar(5));
        expect(vid5).toContain('5300');
        expect(vid5).not.toMatch(/redovisas inte här/);
    });
    it('vid 10: gruppdossiern på skärmen visar den lilla gruppen; textkopian (lämnar verktyget) gör det inte och anger antalet', () => {
        const d = dossier(fonsterPar(null), '6100|C');
        expect(d.skarm).toContain(ETIKETT);
        expect(d.text).not.toContain(ETIKETT);
        expect(d.text).not.toContain(String(SENT));
        expect(d.text).toMatch(NOT);
    });

    it('vid 5 (den lilla gruppens storlek är 6): paret finns i alla fyra', async () => {
        const w = fonsterPar(5);
        const protokoll = await fangaExcel(w, 'exportJPAProtokoll');
        expect(protokoll).toContain(ETIKETT);
        expect(protokoll).toContain(String(SENT));
        expect(protokoll).not.toMatch(NOT);
        const a = attGora(w);
        for (const t of [a.punkter, a.kort, a.csv]) expect(t).toContain(ETIKETT);
        expect(a.kort).not.toMatch(NOT);
        const seed = w.eval('_handlingsplanSeedRows()');
        expect(seed.lvCount).toBe(1);
        expect(JSON.stringify(seed.rows)).toContain('5300');
        const d = dossier(w, '6100|C');
        expect(d.skarm).toContain(ETIKETT);
        expect(d.skarm).not.toMatch(NOT);
        expect(d.text).not.toMatch(NOT);
    });
    it('vid 10: parets åldersjusterade skillnad syns inte i rapportunderlaget; vid 5 står den i parets block', () => {
        // Den justerade skillnaden lyder samma regel som den råa (_parForRedovisning): ett par under
        // tröskeln lämnas ut helt, med sin justerade skillnad.
        const justerad = w => w.eval("(p => p && p.aldersJusterad && p.aldersJusterad.gapPct)(likvardighetResultat().pairs.find(p => p.kvAid === '5300'))");
        const text = w => normalisera(w.__rapportunderlagBlock().map(b => w.__ruTillText(b)).join('\n'));
        const w10 = fonsterPar(null);
        const j10 = justerad(w10);
        expect(typeof j10).toBe('number');   // annars prövar testet inget (jämförelseyrket har 24 personer, 30–59 år)
        const t10 = text(w10);
        expect(t10).not.toContain('Justerat för ålder');
        expect(t10).not.toContain(normalisera(w10.eval(`svTal(${j10}, 1)`)) + ' %');
        const w5 = fonsterPar(5);
        const t5 = text(w5);
        expect(t5).toContain(`Justerat för ålder: ${normalisera(w5.eval(`svTal(${justerad(w5)}, 1)`))} %.`);
    });
    it('vid 10: rapportunderlagets handlingsplansblock saknar paret och dess belopp; vid 5 finns det', () => {
        const block = w => {
            const b = w.__rapportunderlagBlock().find(x => x.id === 'handlingsplan');
            expect(b).toBeTruthy();
            return normalisera(w.__ruTillText(b));
        };
        const arskostnad = w => String(w.eval("Math.round(Math.abs(likvardighetResultat().pairs.find(p => p.kvAid === '5300').gapKr) * 6 * ((__state.costSettings && __state.costSettings.months) || 12) * (1 + ((__state.costSettings && __state.costSettings.poPct) || 0) / 100))"));
        const w10 = fonsterPar(null);
        const t10 = block(w10);
        expect(t10).not.toContain('5300');
        expect(t10).not.toContain(arskostnad(w10));
        const w5 = fonsterPar(5);
        const t5 = block(w5);
        expect(t5).toContain('5300');
        expect(t5).toContain(arskostnad(w5));
    });
    // Ändrat med ADR-69 (2026-11-13): förslagen följer den inställda tröskeln också på skärmen. Förr riktade förslaget på
    // skärmen också mot den lilla gruppen (ADR-51), och raden följde med i Excel-exporten och konfigurationsfilen.
    it('Löneöversynens förslag riktar inte mot den lilla gruppen vid 10, också på skärmen (ADR-69); vid 5 gör det', () => {
        const forslag = k => {
            const w = fonsterPar(k);
            w.alert = () => {};
            Object.assign(w.__state.forecast, { minGroupN: 0, budget: { mode: 'kr', value: 5000000 }, generell: { mode: 'pct', value: 0 } });
            w.__ritaFlik('loneoversyn');
            w.eval('_fcOptimera()');
            return { w, aid: w.__state.forecast.targets.map(t => t.aid) };
        };
        const a10 = forslag(null);
        expect(a10.aid).not.toContain('5300');
        expect(a10.w.document.getElementById('forecast-par-not').textContent).toMatch(NOT);
        const a5 = forslag(5);
        expect(a5.aid).toContain('5300');
        expect(a5.w.document.getElementById('forecast-par-not').textContent).not.toMatch(NOT);
    });
    it('Att göra tar 20 par över tröskeln även när de första paren är under den', () => {
        const w = createAppWindow();
        const rader = [];
        const lagg = (n, kon, lon, bas, aid) => { for (let i = 0; i < n; i++) rader.push({ bas, kon, lon: lon + (i % 3) * 10,
            alder: 30 + (i * 7) % 30, yrke: `${aid} Yrke ${aid}`, aid, yrkeLabel: `Yrke ${aid}`, enhet: '' }); };
        lagg(30, 'kvinna', 25000, 'A', '6000'); lagg(30, 'man', 25500, 'A', '6000');
        lagg(40, 'man', 60000, 'C', '6100');
        for (let g = 0; g < 26; g++) lagg(g < 6 ? 6 : 12, 'kvinna', g < 6 ? 30000 : 45000 + g * 100, 'C', String(5300 + g));
        w.__state.data = rader;
        w.eval('fyllValjare(); lasUppFlikar();');
        w.__state.likvardighet.topN = 100; w.__state.likvardighet.result = null;
        const par = w.eval('likvardighetResultat().pairs');
        expect(par.length).toBe(26);
        expect(par.slice(0, 20).some(p => p.kvN < 10)).toBe(true);   // annars prövar testet inget
        const lv = w.eval("medExportLage(() => byggAtgardslista()).filter(i => i.kategori === 'Likvärdigt arbete').map(i => i.id)");
        expect(lv.length).toBe(20);
        const smaAid = par.filter(p => p.kvN < 10).map(p => p.kvAid);
        expect(lv.some(id => smaAid.some(a => id.includes(`lv-${a}-`)))).toBe(false);
    });
    it('vid 6 (precis på den lilla gruppens storlek): paret finns', () => {
        const w = fonsterPar(6);
        expect(w.eval('_handlingsplanSeedRows().lvCount')).toBe(1);
        expect(w.eval('byggAtgardslista().some(i => i.titel.includes("Yrke 5300"))')).toBe(true);
    });
});

describe('k-tröskeln i texterna', () => {
    it('fasta texter, verktygstips och ordlistan följer värdet', () => {
        const w = createAppWindow();
        const d = w.document;
        const fasta = () => [...d.querySelectorAll('[data-k-troskel]')].map(e => e.textContent);
        expect(fasta().length).toBeGreaterThanOrEqual(3);
        expect(new Set(fasta())).toEqual(new Set(['10']));
        expect(d.querySelector('[data-k-tooltip]').getAttribute('data-tooltip')).toMatch(/\b10\b/);
        expect(d.getElementById('explore-inkludera-sma-label').textContent).toBe('Ta med grupper under 10 i exporten');

        w.eval('sattKTroskel(7, { fraga: false })');
        expect(new Set(fasta())).toEqual(new Set(['7']));
        for (const el of d.querySelectorAll('[data-k-tooltip]')) {
            expect(el.getAttribute('data-tooltip')).not.toMatch(/\{k\}|\{golv\}/);
        }
        expect(d.getElementById('explore-inkludera-sma-label').textContent).toBe('Ta med grupper under 7 i exporten');
        expect(w.eval('_kText("färre än {k}, minst {golv}")')).toBe('färre än 7, minst 10');
        w.eval('ritaOrdlista("")');
        const ordlista = d.body.textContent;
        expect(ordlista).not.toMatch(/\{k\}|\{golv\}/);
        expect(ordlista).toContain('färre än 7 personer');
        const prio = d.querySelector('#prio-table [data-k-tooltip]');
        expect(prio.getAttribute('data-k-tooltip')).toContain('{k}');
        const lonegap = [...d.querySelectorAll('#prio-table [data-k-tooltip]')].map(e => e.getAttribute('data-tooltip')).find(t => t.startsWith('Kvinnors median'));
        expect(lonegap).toContain(' 7 ');
    });
    it('källfilerna har inte talet hårdkodat i fraser om gruppstorlek', async () => {
        const { readFileSync } = await import('node:fs');
        for (const fil of ['src/index.html', 'src/app/04-ordlista.js']) {
            const traffar = [...readFileSync(fil, 'utf8').matchAll(/(?:färre än|minst|under) \d+ (?:personer|i exporten)/g)].map(m => m[0]);
            expect(traffar, fil).toEqual([]);
        }
    });
    it('beviset för en överhoppad per-BAS-regression citerar statistiska golvet (7 kvinnor vid k=5)', () => {
        const w = createAppWindow();
        w.eval('sattKTroskel(5, { fraga: false })');
        const rad = w.eval('_bevisForPerBasRad({ bas: "X", n: 17, kvN: 7, maN: 10, status: "too_few" })').rows;
        const kv = rad.find(r => r.label === 'Antal kvinnor');
        expect(kv.note).toBe('Färre än 10 (golvet för skattningar)');
        expect(rad.find(r => r.label === 'Antal män').note).toBe('');
    });
    it('Excel-protokollets rad om BAS-regressionen citerar statistiska golvet, raden om yrken tröskeln', () => {
        const w = createAppWindow();
        w.eval('sattKTroskel(5, { fraga: false })');
        w.__state.kLage = 'export';
        const rader = w.eval('_jpaExkluderadeTexter()');
        expect(rader.yrken).toContain('färre än 5 ');
        expect(rader.bas).toContain('färre än 10 ');
    });
});

describe('k-tröskeln i gränssnittet', () => {
    const skriv = (w, v) => {
        const f = w.document.getElementById('k-troskel');
        f.value = v;
        f.dispatchEvent(new w.Event('change', { bubbles: true }));
        return f;
    };
    it('fältet visar 10, varningen är dold och återställ-knappen dold', () => {
        const d = createAppWindow().document;
        expect(d.getElementById('k-troskel').value).toBe('10');
        expect(d.getElementById('k-troskel-varning').hidden).toBe(true);
        expect(d.getElementById('btn-k-aterstall').hidden).toBe(true);
    });
    it('sänkning frågar först och visar varningen på alla flikar; återställ tar bort den', () => {
        const w = createAppWindow();
        const d = w.document;
        let fraga = '';
        w.confirm = m => { fraga = m; return true; };
        skriv(w, '6');
        expect(fraga).toContain('Sänka minsta gruppstorlek till 6?');
        expect(w.eval('kInstalld()')).toBe(6);
        const varning = d.getElementById('k-troskel-varning');
        expect(varning.hidden).toBe(false);
        expect(varning.textContent).toContain('Minsta gruppstorlek är sänkt till 6 (standard 10). Lönemått för små grupper kan peka ut enskilda.');
        expect(varning.closest('.view-panel')).toBeNull();   // ligger utanför flikpanelerna
        expect(varning.querySelector('button')).toBeNull();  // går inte att stänga
        d.getElementById('btn-k-aterstall').click();
        expect(w.eval('kInstalld()')).toBe(10);
        expect(varning.hidden).toBe(true);
        expect(d.getElementById('k-troskel').value).toBe('10');
    });
    it('höjt värde ger ingen varning men en återställ-knapp', () => {
        const w = createAppWindow();
        skriv(w, '20');
        expect(w.document.getElementById('k-troskel-varning').hidden).toBe(true);
        expect(w.document.getElementById('btn-k-aterstall').hidden).toBe(false);
    });
    it.each(['', '10,0', '1e2', '1', '2', '1001', 'tio'])('ogiltigt värde %p: felet syns vid fältet och fältet återfår gällande värde', v => {
        const w = createAppWindow();
        const f = skriv(w, v);
        expect(w.eval('kInstalld()')).toBe(10);
        expect(f.value).toBe('10');
        const fel = w.document.getElementById('k-troskel-fel');
        expect(fel.hidden).toBe(false);
        expect(fel.textContent).toMatch(/heltal mellan 3 och 1000/);
    });
    it('nekad bekräftelse: fältet återfår gällande värde, inget felmeddelande', () => {
        const w = createAppWindow();
        w.confirm = () => false;
        const f = skriv(w, '4');
        expect(f.value).toBe('10');
        expect(w.document.getElementById('k-troskel-fel').hidden).toBe(true);
    });
    it('länken i varningen öppnar inställningarna och ger fältet fokus', () => {
        const w = createAppWindow();
        skriv(w, '6');
        w.document.getElementById('k-troskel-varning-lank').click();
        expect(w.document.getElementById('installningar-modal').style.display).toBe('flex');   // fältet ligger i panelen
        expect(w.document.activeElement.id).toBe('k-troskel');
        expect(w.document.getElementById('k-troskel-sammanfattning').textContent).toContain('6');
    });
    it('ogiltigt värde följt av giltigt i fältet döljer felet', () => {
        const w = createAppWindow();
        skriv(w, '1');
        expect(w.document.getElementById('k-troskel-fel').hidden).toBe(false);
        skriv(w, '15');
        expect(w.document.getElementById('k-troskel-fel').hidden).toBe(true);
    });
    it('felet döljs när värdet sätts från annat håll än fältet', () => {
        const w = createAppWindow();
        skriv(w, '1');
        expect(w.document.getElementById('k-troskel-fel').hidden).toBe(false);
        w.eval('sattKTroskel(15, { fraga: false })');
        expect(w.document.getElementById('k-troskel-fel').hidden).toBe(true);
    });
    it.each(['tio', '10,0', '1e2'])('sattKTroskel avvisar %p direkt', v => {
        const w = createAppWindow();
        expect(w.eval(`sattKTroskel(${JSON.stringify(v)}, { fraga: false }).ok`)).toBe(false);
        expect(w.eval('kInstalld()')).toBe(10);
    });
});

// Stämplarna och meningen om sänkt tröskel, här och i "de verkliga vägarna" nedan, prövas på den lilla fixturen
// (fonsterLitet): de beror på tröskeln, inte på vilka grupper som finns, och rapportunderlaget har samma slags block.
describe('k-tröskeln i utdata', () => {
    const STAMPEL_10 = 'Minsta gruppstorlek för redovisning: 10.';
    const STAMPEL_6 = 'Minsta gruppstorlek för redovisning: 6. Tröskeln är sänkt från standardvärdet 10.';
    const metodrad = w => w.__metodbilaga().find(r => r[0] === 'Minsta gruppstorlek för redovisning');

    it('vid standard: metodbilagan, Word-utkastet och sammanfattningen anger 10', () => {
        const w = fonsterLitet(null);
        expect(w.eval('kStampel()')).toBe(STAMPEL_10);
        expect(w.eval('_kSanktNot()')).toBe('');
        expect(metodrad(w)[1]).toBe('10 personer. Grupper med färre redovisas inte i det som lämnar verktyget (gäller inte likvärdighetsanalysen); på skärmen visas alla grupper.');
        expect(w.__docDraftHtml()).toContain('Minsta gruppstorlek för redovisning');
        const block = w.__rapportunderlagBlock();
        expect(w.__ruTillText(block.find(b => b.id === 'sammanfattning'))).toContain(STAMPEL_10);
        expect(w.__ruTillText(block.find(b => b.id === 'struktur'))).not.toContain('Minsta gruppstorlek');
    });
    it('sänkt värde, utan att någon flik öppnats: varje utdata bär värdet och meningen om sänkning', () => {
        const w = fonsterLitet(6);
        expect(w.eval('_kSanktNot()')).toBe(STAMPEL_6);
        expect(metodrad(w)[1]).toContain('6 personer.');
        expect(metodrad(w)[1]).toContain('Tröskeln är sänkt från standardvärdet 10.');
        expect(w.__docDraftHtml()).toContain('Tröskeln är sänkt från standardvärdet 10.');
        for (const b of w.__rapportunderlagBlock()) expect(w.__ruTillText(b), b.id).toContain(STAMPEL_6);
        expect(w.eval('_csvMedStampel([["a","b"],[1,2]])')).toEqual([['a', 'b'], [1, 2], [], [STAMPEL_6]]);
        expect(w.eval('_tsvMedStampel([["a","b"],[1,2]])')).toEqual([['a', 'b'], [1, 2], [], [STAMPEL_6]]);
        expect(w.eval('_kSidfot("Lönekartläggning 2026 — UTKAST")')).toBe('Lönekartläggning 2026 — UTKAST · minsta gruppstorlek 6 (standard 10)');
    });
    it('vid standard: CSV får stämpeln, urklipp och sidfot lämnas orörda', () => {
        const w = fonsterLitet(null);
        expect(w.eval('_csvMedStampel([["a"],[1]])')).toEqual([['a'], [1], [], [STAMPEL_10]]);
        expect(w.eval('_tsvMedStampel([["a"],[1]])')).toEqual([['a'], [1]]);
        expect(w.eval('_kSidfot("x")')).toBe('x');
    });
    it('diagramdata: stämpeln står i spårbarhetsraden, inte dubbelt i CSV', () => {
        const w = fonsterLitet(6);
        const gd = w.document.createElement('div');
        gd.id = 'chart-test';
        w.document.body.appendChild(gd);
        w.__el = gd; w.__f = { beskrivning: 'T', x: { skala: 'band' }, y: { skala: 'linjar' }, lager: [{ marke: 'stapel', serie: 'A', farg: '#2563eb', data: [{ x: 'a', y: 1 }] }] };
        w.eval('ritaFigur(window.__el, window.__f, {})');
        const rader = w.__diagramexportRader(gd);
        expect(rader[0][0]).toContain(STAMPEL_6);
        expect(w.eval('_csvMedStampel')(rader).filter(r => String(r[0] || '').includes('Minsta gruppstorlek'))).toHaveLength(1);
    });
});

// Stämpeltesterna i utskriften och Word-utkastets sidfot kör på den lilla fixturen (fonsterLitet): de prövar meningen, inte vilka grupper som syns.
describe('k-tröskeln i utskriften', () => {
    const MENING = 'Tröskeln är sänkt från standardvärdet 10.';
    const utskrift = async k => {
        const w = fonsterLitet(k);
        w.eval("sattRapportUrval('hela')");   // hela dokumentationen, med bilagorna
        await w.eval('buildPrintReport()');
        return w.document.getElementById('print-report').innerHTML;
    };
    it('vid 6 står meningen högt upp, före första tabellen', async () => {
        const html = await utskrift(6);
        expect(html).toContain(MENING);
        expect(html.indexOf(MENING)).toBeLessThan(html.indexOf('<table'));
    });
    it('vid 10 saknas meningen', async () => {
        expect(await utskrift(null)).not.toContain('Tröskeln är sänkt');
    });
    it('handlingsplanens mallutskrift bär meningen vid 6, checklistan och standardvärdet inte', () => {
        const skriv = (k, vy) => {
            const w = fonsterLitet(k);
            let html = '';
            w.open = () => ({ document: { write: h => { html += h; }, close() {}, createElement: t => w.document.createElement(t), head: w.document.head }, focus() {}, print() {} });
            w.eval(`printScaffoldView('${vy}', 'X')`);
            return html;
        };
        expect(skriv(6, 'view-handlingsplan')).toContain(MENING);
        expect(skriv(null, 'view-handlingsplan')).not.toContain('Tröskeln är sänkt');
        expect(skriv(6, 'view-bestammelser')).not.toContain('Tröskeln är sänkt');
    });
});

describe('k-tröskeln: motiveringsförslagen visar ingen lönepositionsslutsats för ett kön under tröskeln', () => {
    const forslag = k => {
        const w = createAppWindow();
        if (k !== null) w.eval(`sattKTroskel(${k}, { fraga: false })`);
        const rows = [];
        for (let i = 0; i < 6; i++) rows.push({ kon: 'kvinna', lon: 20000 + i, alder: 40 });
        for (let i = 0; i < 6; i++) rows.push({ kon: 'man', lon: 40000 + i, alder: 40 });
        w.__item = { _rows: rows, kvN: 6, maN: 6, n: 12, diffPct: -8, costPerPerson: 0 };
        return w.eval('medExportLage(() => generateMotivationSuggestions(window.__item)).map(f => f.text).join(" ")');
    };
    it('vid 10 saknas glasstaksmönstret för en grupp med 6 av varje kön', () => {
        expect(forslag(null)).not.toContain('Mönster med glastak eller klibbigt golv');
    });
    it('vid 5 finns det', () => {
        expect(forslag(5)).toContain('Mönster med glastak eller klibbigt golv');
    });
});

describe('k-tröskeln i utdata: de verkliga vägarna', () => {
    const STAMPEL_6 = 'Minsta gruppstorlek för redovisning: 6. Tröskeln är sänkt från standardvärdet 10.';
    const STAMPEL_10 = 'Minsta gruppstorlek för redovisning: 10.';
    const rader = [['a', 'b'], [1, 2]];
    const sistaRaden = t => t.split('\n').filter(Boolean).at(-1);

    it('gruppdossierns text slutar med stämpeln vid 6 och saknar den vid 10', () => {
        for (const [k, stampel] of [[6, STAMPEL_6], [10, null]]) {
            const w = fonsterLitet(k);
            const d = w.__buildGruppdossier(w.__gruppdossierCandidates()[0].key);
            const txt = w.__gruppdossierAsText(d);
            if (stampel) expect(txt.endsWith('\n\n' + stampel)).toBe(true);
            else expect(txt).not.toContain('Minsta gruppstorlek');
        }
    });
    it('_laddaNedCSV: sista raden är stämpeln', async () => {
        const w = fonsterLitet(null);
        let blob = null;
        w.URL.createObjectURL = b => { blob = b; return 'blob:x'; };
        w.alert = () => {};
        w.__rader = rader;
        w.eval("_laddaNedCSV(window.__rader, 'x')");
        expect(blob).not.toBeNull();
        const text = await new Promise(res => { const fr = new w.FileReader(); fr.onload = () => res(String(fr.result)); fr.readAsText(blob); });
        expect(sistaRaden(text)).toBe(STAMPEL_10);
    });
    it.each([[6, true], [10, false]])('_kopieraMatrisTillUrklipp vid %i: stämpel=%s', (k, med) => {
        const w = fonsterLitet(k);
        let kopierat = null;
        Object.defineProperty(w.navigator, 'clipboard', { configurable: true, value: { writeText: t => { kopierat = t; return Promise.resolve(); } } });
        w.__rader = rader;
        w.eval('_kopieraMatrisTillUrklipp(window.__rader)');
        expect(kopierat).not.toBeNull();
        if (med) expect(sistaRaden(kopierat)).toBe(STAMPEL_6);
        else expect(kopierat).not.toContain('Minsta gruppstorlek');
    });
    it.each([[6, 'UTKAST · minsta gruppstorlek 6 (standard 10)'], [10, null]])('Word-utkastets sidfot vid %i', async (k, suffix) => {
        const w = fonsterLitet(k);
        const delar = {};
        // JSZip byts mot en uppsamlare: sidfotens XML-del läses utan att .docx-filen byggs
        w.JSZip = class { file(sokvag, xml) { delar[sokvag] = xml; } generateAsync() { return Promise.resolve(new w.Blob(['x'])); } };
        w.URL.createObjectURL = () => 'blob:x';
        w.alert = () => {};
        await w.eval('exportDocumentationDraft()');
        const foot = Object.entries(delar).filter(([namn]) => /footer/i.test(namn)).map(([, xml]) => xml).join('');
        expect(foot).toContain('UTKAST');
        if (suffix) expect(foot).toContain(suffix);
        else expect(foot).not.toContain('minsta gruppstorlek');
    });
});

describe('k-tröskeln i konfigurationsfilen', () => {
    it('tur och retur bär värdet', () => {
        const a = createAppWindow();
        a.eval('sattKTroskel(15, { fraga: false })');
        const cfg = JSON.parse(JSON.stringify(a.__byggKonfiguration()));
        expect(cfg.kTroskel).toBe(15);
        const b = createAppWindow();
        b.__cfg = cfg;
        b.eval('tillampaKonfiguration(window.__cfg)');
        expect(b.eval('kInstalld()')).toBe(15);
        expect(b.document.getElementById('k-troskel').value).toBe('15');
    });
    it('en fil utan fältet lämnar gällande värde orört (som ett organisationspaket utan fältet)', () => {
        const a = createAppWindow();
        const cfg = JSON.parse(JSON.stringify(a.__byggKonfiguration()));
        delete cfg.kTroskel;
        cfg.orgNamn = 'Exempelorganisationen';
        const b = createAppWindow();
        b.eval('sattKTroskel(15, { fraga: false })');
        b.__cfg = cfg;
        b.eval('tillampaKonfiguration(window.__cfg)');
        expect(b.eval('kInstalld()')).toBe(15);
        expect(b.eval('orgNamn("")')).toBe('Exempelorganisationen');   // resten av filen läses in
    });
    it.each([1, 2, 2.5, '12', 1001, null])('ogiltigt värde %p avvisas och lämnar allt orört', v => {
        const a = createAppWindow();
        a.eval('sattKTroskel(15, { fraga: false })');
        const cfg = JSON.parse(JSON.stringify(a.__byggKonfiguration()));
        cfg.kTroskel = v;
        cfg.orgNamn = 'Ska inte läsas in';
        a.__cfg = cfg;
        // null räknas som att fältet saknas: värdet står kvar och resten läses in.
        if (v === null) { a.eval('tillampaKonfiguration(window.__cfg)'); expect(a.eval('kInstalld()')).toBe(15); return; }
        a.eval('sattKTroskel(15, { fraga: false })');
        expect(() => a.eval('tillampaKonfiguration(window.__cfg)')).toThrow(/kTroskel måste vara ett heltal mellan 3 och 1000/);
        expect(a.eval('kInstalld()')).toBe(15);
        expect(a.eval('orgNamn("")')).not.toBe('Ska inte läsas in');
    });
    it('värde under 10: nekad bekräftelse behåller värdet men läser in resten', () => {
        const a = createAppWindow();
        a.eval('sattKTroskel(6, { fraga: false })');
        const cfg = JSON.parse(JSON.stringify(a.__byggKonfiguration()));
        cfg.orgNamn = 'Exempelorganisationen';
        const b = createAppWindow();
        let fragor = 0;
        b.confirm = () => { fragor++; return false; };
        b.__cfg = cfg;
        b.eval('tillampaKonfiguration(window.__cfg)');
        expect(fragor).toBe(1);
        expect(b.eval('kInstalld()')).toBe(10);
        expect(b.eval('orgNamn("")')).toBe('Exempelorganisationen');
    });
    it('värde under 10: godkänd bekräftelse tillämpar värdet', () => {
        const a = createAppWindow();
        a.eval('sattKTroskel(6, { fraga: false })');
        const cfg = JSON.parse(JSON.stringify(a.__byggKonfiguration()));
        const b = createAppWindow();
        let fragor = 0;
        b.confirm = () => { fragor++; return true; };
        b.__cfg = cfg;
        b.eval('tillampaKonfiguration(window.__cfg)');
        expect(fragor).toBe(1);
        expect(b.eval('kInstalld()')).toBe(6);
    });
    it('en fil utan fältet: ett sänkt värde står också kvar, utan fråga', () => {
        const a = createAppWindow();
        const cfg = JSON.parse(JSON.stringify(a.__byggKonfiguration()));
        delete cfg.kTroskel;
        const b = createAppWindow();
        let fragor = 0;
        b.confirm = () => { fragor++; return true; };
        b.eval('sattKTroskel(6, { fraga: false })');
        b.__cfg = cfg;
        b.eval('tillampaKonfiguration(window.__cfg)');
        expect(b.eval('kInstalld()')).toBe(6);
        expect(fragor).toBe(0);
        expect(b.document.getElementById('k-troskel-varning').hidden).toBe(false);
    });
});

describe('k-tröskeln i organisationspaketet', () => {
    const paket = k => ({ format: 'lonekartlaggning-organisationspaket', version: 1, organisation: { namn: 'Exempelorganisationen' }, skapat: '2026-10-08',
        installningar: k === undefined ? {} : { kTroskel: k },
        referens: { rader: [{ bas: 'A', p10: 20000, med: 25000, p90: 30000 }] } });
    const las = (w, p) => w.eval(`lasInPaket(${JSON.stringify(JSON.stringify(p))}, 'x.lonepaket.json')`);
    it('paketets värde blir gällande', () => {
        const w = createAppWindow();
        expect(las(w, paket(20)).ok).toBe(true);
        expect(w.eval('kInstalld()')).toBe(20);
    });
    it('ett paket utan fältet ändrar inte gällande värde', () => {
        const w = createAppWindow();
        w.eval('sattKTroskel(15, { fraga: false })');
        expect(las(w, paket(undefined)).ok).toBe(true);
        expect(w.eval('kInstalld()')).toBe(15);
    });
    it('värde under 10 kräver bekräftelse; nekad läser in resten av paketet', () => {
        const w = createAppWindow();
        let fragor = 0;
        w.confirm = () => { fragor++; return false; };
        const r = las(w, paket(5));
        expect(r.ok).toBe(true);
        expect(fragor).toBe(1);
        expect(w.eval('kInstalld()')).toBe(10);
        expect(w.eval('harReferens()')).toBe(true);
    });
    it('värde under 10: godkänd bekräftelse tillämpar värdet och läser in paketet', () => {
        const w = createAppWindow();
        let fragor = 0;
        w.confirm = () => { fragor++; return true; };
        expect(las(w, paket(5)).ok).toBe(true);
        expect(fragor).toBe(1);
        expect(w.eval('kInstalld()')).toBe(5);
        expect(w.eval('harReferens()')).toBe(true);
    });
    it('fältet i paketformuläret följer tröskeln utan att testet skriver det', () => {
        const w = createAppWindow();
        las(w, paket(undefined));
        const f = w.document.getElementById('k-troskel');
        f.value = '15';
        f.dispatchEvent(new w.Event('change', { bubbles: true }));
        w.document.getElementById('paket-org').value = 'Exempelorganisationen';
        expect(w.eval('kInstalld()')).toBe(15);
        expect(w.eval('skapaPaket()').installningar.kTroskel).toBe(15);
    });
    it('ogiltigt värde i paketet används inte och ger en varning', () => {
        const w = createAppWindow();
        const r = las(w, paket(1));
        expect(r.ok).toBe(true);
        expect(r.meddelande).toMatch(/minsta gruppstorlek .* används inte/i);
        expect(w.eval('kInstalld()')).toBe(10);
    });
    it('skapade paket bär formulärets värde', () => {
        const w = createAppWindow();
        las(w, paket(undefined));
        w.document.getElementById('paket-org').value = 'Exempelorganisationen';
        w.document.getElementById('paket-k').value = '12';
        expect(w.eval('skapaPaket()').installningar.kTroskel).toBe(12);
    });
});

describe('protokollet för gemensam lönebedömning: BAS-intervallen väljs efter korrigering för många tester (ADR-71)', () => {
    // Sex BAS-intervall med 20 kvinnor och 20 män var. Brusets storlek per intervall styr p-värdet: i C är kvinnornas
    // lön 5 % lägre och bruset stort, så att rått p hamnar strax under 0,05 men q efter Benjamini–Hochberg över 0,05.
    // I E (bara i det andra underlaget) är skillnaden 8 % och bruset litet: säkerställd också efter korrigering.
    const BAS = ['A', 'B', 'C', 'D', 'E', 'F'];
    const fonsterBas = medE => {
        const w = createAppWindow();
        const rader = [];
        BAS.forEach((bas, b) => {
            const eff = bas === 'C' ? -0.05 : (bas === 'E' && medE ? -0.08 : 0);
            const amp = bas === 'E' && medE ? 300 : 3500;
            for (let i = 0; i < 40; i++) {
                const kv = i % 2 === 0, j = i >> 1;
                const brus = (((j * 7) % 11) - 5) / 5 * amp * (kv ? 1 : -1);
                rader.push({ bas, kon: kv ? 'kvinna' : 'man', lon: Math.round((26000 + b * 1500 + brus) * (kv ? 1 + eff : 1)),
                    alder: 25 + ((j * 13) % 40), yrke: `${7000 + b} Yrke ${b}`, aid: String(7000 + b), yrkeLabel: `Yrke ${b}`, enhet: '' });
            }
        });
        w.__state.data = rader;
        w.eval('fyllValjare(); lasUppFlikar();');
        return w;
    };
    const perBas = w => {
        const pb = w.eval(`_computePerBasGap(hamtaData(), ${JSON.stringify(BAS)})`);
        const q = w.eval(`bhJustera(${JSON.stringify(pb.map(b => b.pValue))})`);
        return Object.fromEntries(pb.map((b, i) => [b.bas, { ...b, q: q[i] }]));
    };
    const protokollet = async w => {
        const { readFileSync } = await import('node:fs');
        const { join, dirname } = await import('node:path');
        const { fileURLToPath } = await import('node:url');
        w.eval(readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'vendor', 'xlsx.mini.min.js'), 'utf8'));
        w.alert = () => {};
        let wb = null;
        w.XLSX.writeFile = b => { wb = b; };
        w.eval('exportJPAProtokoll()');
        const blad = n => w.XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, raw: true }).map(r => r.map(c => String(c ?? '')));
        return { forsatt: blad('1. Försättssida'), bas: blad('3. Likvärdigt arbete (BAS)') };
    };
    const antalBas = forsatt => forsatt.find(r => r[0].startsWith('Antal BAS-intervall med en säkerställd'))?.[1];

    it('säkerställt på rått p men inte efter korrigering: bladet säger att inget intervall finns, och antalet är 0', async () => {
        const w = fonsterBas(false);
        const pb = perBas(w);
        // Förutsättningen: alla sex är prövade, C har rått p under 0,05 och minst 3 % men q över 0,05; ingen annan har utslag.
        expect(BAS.every(b => pb[b].status === 'ok')).toBe(true);
        expect(pb.C.pValue).toBeLessThan(0.05);
        expect(Math.abs(pb.C.gapPct)).toBeGreaterThanOrEqual(3);
        expect(pb.C.q).toBeGreaterThan(0.05);
        expect(BAS.filter(b => b !== 'C').every(b => pb[b].pValue > 0.05)).toBe(true);
        const { forsatt, bas } = await protokollet(w);
        expect(bas[0][8]).toBe('p-värde');
        expect(bas[0][9]).toBe('q-värde (BH-justerat)');
        expect(bas).toHaveLength(2);
        expect(bas[1][1]).toMatch(/^Inga BAS-intervall med en säkerställd oförklarad skillnad på minst 3 %/);
        expect(antalBas(forsatt)).toBe('0');
    });

    it('säkerställt också efter korrigering: intervallet står kvar med sitt q-värde, det andra utelämnas', async () => {
        const w = fonsterBas(true);
        const pb = perBas(w);
        expect(pb.E.q).toBeLessThan(0.05);
        expect(Math.abs(pb.E.gapPct)).toBeGreaterThanOrEqual(3);
        expect(pb.C.pValue).toBeLessThan(0.05);
        expect(pb.C.q).toBeGreaterThan(0.05);
        const { forsatt, bas } = await protokollet(w);
        const rader = bas.slice(1).filter(r => r[0] !== '' && r[0] !== '—');
        expect(rader.map(r => r[1])).toEqual(['E']);
        const q = pb.E.q;
        expect(rader[0][9]).toBe(q < 0.001 ? '< 0.001' : String(+q.toFixed(4)));
        expect(rader[0][11]).toBe('Ja');
        expect(antalBas(forsatt)).toBe('1');
    });

    it('ett enda prövat BAS-intervall: q = p, och kortet och protokollet visar samma q', async () => {
        const w = createAppWindow();
        const rader = [];
        for (let i = 0; i < 40; i++) {
            const kv = i % 2 === 0, j = i >> 1;
            const brus = (((j * 7) % 11) - 5) / 5 * 300 * (kv ? 1 : -1);
            rader.push({ bas: 'E', kon: kv ? 'kvinna' : 'man', lon: Math.round((30000 + brus) * (kv ? 0.92 : 1)),
                alder: 25 + ((j * 13) % 40), yrke: '7004 Yrke 4', aid: '7004', yrkeLabel: 'Yrke 4', enhet: '' });
        }
        w.__state.data = rader;
        w.eval('fyllValjare(); lasUppFlikar();');
        const pb = w.eval(`_computePerBasGap(hamtaData(), ['E'])`);
        expect(pb).toHaveLength(1);
        expect(pb[0].status).toBe('ok');
        const p = pb[0].pValue;
        expect(p).toBeLessThan(0.05);
        expect(w.eval(`bhJustera([${p}])`)).toEqual([p]);
        // Kortet: q-cellen visar talet, inte —.
        w.eval('ritaRegressionskort()');
        const rad = [...w.document.querySelectorAll('#perbas-table tbody tr')].find(tr => tr.cells[0].textContent.trim() === 'E');
        expect(rad.cells[6].textContent.trim()).toBe(w.eval(`_formatPValue(${p})`));
        // Protokollet: samma q, lika med p.
        const { bas } = await protokollet(w);
        const prot = bas.slice(1).filter(r => r[1] === 'E');
        expect(prot).toHaveLength(1);
        expect(prot[0][9]).toBe(p < 0.001 ? '< 0.001' : String(+p.toFixed(4)));
        expect(prot[0][9]).toBe(prot[0][8]);
    });
});

describe('protokollet för gemensam lönebedömning: median och medelvärde, och fälten för parterna (ADR-79)', () => {
    // Tre stora BAS-intervall utan skillnad, och två AID-etiketter med en tydlig skillnad i var sitt BAS-intervall:
    // Q med 12 kvinnor (syns vid tröskeln 10, inte vid 25) och R med 6 kvinnor (syns aldrig). Männen är 30 i båda.
    // En kvinna i Q har en hög lön, så att kvinnornas medelvärde och median skiljer sig åt.
    const loner = (n, start, steg, sista) => Array.from({ length: n }, (_, i) => (sista !== undefined && i === n - 1 ? sista : start + i * steg));
    const Q_KV = loner(12, 30000, 14, 33300), Q_MA = loner(30, 40000, 17, 45000);
    const R_KV = loner(6, 31500, 11), R_MA = loner(30, 42000, 19);
    const medel = l => l.reduce((s, x) => s + x, 0) / l.length;
    const median = l => { const s = [...l].sort((a, b) => a - b), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
    const fonsterNiva = k => {
        const w = createAppWindow();
        if (k !== null) w.eval(`sattKTroskel(${k}, { fraga: false })`);
        const rader = [];
        const rad = (bas, aid, namn, kon, lon, i) => rader.push({ bas, kon, lon, alder: 25 + ((i * 13) % 40), yrke: `${aid} ${namn}`, aid, yrkeLabel: namn, enhet: '' });
        for (let b = 0; b < 3; b++) for (let i = 0; i < 60; i++) rad('F' + b, String(6000 + b), 'Fyllnad' + b, i % 2 ? 'man' : 'kvinna', 25000 + b * 900 + ((i * 37) % 700), i);
        Q_KV.forEach((l, i) => rad('Q', '7100', 'Mellangrupp', 'kvinna', l, i));
        Q_MA.forEach((l, i) => rad('Q', '7100', 'Mellangrupp', 'man', l, i));
        R_KV.forEach((l, i) => rad('R', '7200', 'Smågrupp', 'kvinna', l, i));
        R_MA.forEach((l, i) => rad('R', '7200', 'Smågrupp', 'man', l, i));
        w.__state.data = rader;
        w.eval('fyllValjare(); lasUppFlikar();');
        return w;
    };
    const protokollet = async (w, fn = 'exportJPAProtokoll') => {
        const { readFileSync } = await import('node:fs');
        const { join, dirname } = await import('node:path');
        const { fileURLToPath } = await import('node:url');
        w.eval(readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'vendor', 'xlsx.mini.min.js'), 'utf8'));
        w.alert = () => {};
        let wb = null;
        w.XLSX.writeFile = b => { wb = b; };
        w.eval(`${fn}()`);
        return Object.fromEntries(wb.SheetNames.map(n => [n, w.XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, raw: true, defval: '' })]));
    };
    const MEDIAN = ['Median kvinnor (kr)', 'Median män (kr)', 'Differens (kr)', 'Kvinnors median i % av mäns'];
    const MEDEL = ['Medelvärde kvinnor (kr)', 'Medelvärde män (kr)', 'Differens medelvärde (kr)', 'Kvinnors medelvärde i % av mäns'];
    // Kvinnornas tal i en grupp (median och medelvärde, avrundade som i protokollet): de får inte stå i någon cell.
    const kvTal = kv => [Math.round(median(kv)), Math.round(medel(kv))];
    const celler = bok => new Set(Object.values(bok).flat(2).map(c => String(c)));

    it('försättssidan har de tre fälten för parterna, som frågor utan lagrum', async () => {
        const bok = await protokollet(fonsterNiva(null));
        const forsatt = bok['1. Försättssida'];
        const efter = forsatt.slice(forsatt.findIndex(r => r[0] === '— GEMENSAM SAMMANFATTNING —'));
        for (const re of [/löneökning efter föräldraledighet eller ledighet för vård av anhörig/, /åtgärderna från föregående gemensamma lönebedömning/,
            /systemen för könsneutral arbetsvärdering och arbetsindelning/]) {
            const rad = efter.find(r => re.test(r[0]));
            expect(rad, String(re)).toBeTruthy();
            expect(rad[0]).toMatch(/\?$/);
            expect(rad[0]).not.toMatch(/§|[Aa]rt(?:ikel|\.)\s*\d/);
            expect(rad[1]).toBe('');
        }
    });

    it('vid 10: blad 2 och 3 har median och medelvärde för Q, som stämmer mot underlaget; R saknas', async () => {
        const bok = await protokollet(fonsterNiva(null));
        const blad2 = bok['2. Lika arbete (AID)'], blad3 = bok['3. Likvärdigt arbete (BAS)'];
        const i2 = blad2[0].indexOf(MEDEL[0]), m2 = blad2[0].indexOf(MEDIAN[0]);
        expect(blad2[0].slice(m2, m2 + 4)).toEqual(MEDIAN);
        expect(blad2[0].slice(i2, i2 + 4)).toEqual(MEDEL);
        const q2 = blad2.find(r => String(r[1]).includes('Mellangrupp'));
        expect(q2, 'Q har statusen Värt att granska').toBeTruthy();
        expect(q2.slice(i2, i2 + 4)).toEqual([Math.round(medel(Q_KV)), Math.round(medel(Q_MA)), Math.round(medel(Q_KV) - medel(Q_MA)),
            +(medel(Q_KV) / medel(Q_MA) * 100).toFixed(1)]);
        expect(q2.slice(m2, m2 + 2)).toEqual([Math.round(median(Q_KV)), Math.round(median(Q_MA))]);
        expect(Math.round(medel(Q_KV))).not.toBe(Math.round(median(Q_KV)));   // annars skiljer testet inte måtten åt
        const b3 = blad3[0].indexOf(MEDIAN[0]);
        expect(blad3[0].slice(b3, b3 + 8)).toEqual([...MEDIAN, ...MEDEL]);
        const q3 = blad3.find(r => r[1] === 'Q');
        expect(q3, 'BAS-intervallet Q är säkerställt').toBeTruthy();
        expect(q3.slice(b3, b3 + 8)).toEqual([Math.round(median(Q_KV)), Math.round(median(Q_MA)), Math.round(median(Q_KV) - median(Q_MA)),
            +(median(Q_KV) / median(Q_MA) * 100).toFixed(1), Math.round(medel(Q_KV)), Math.round(medel(Q_MA)),
            Math.round(medel(Q_KV) - medel(Q_MA)), +(medel(Q_KV) / medel(Q_MA) * 100).toFixed(1)]);
        // R har 6 kvinnor: varken median eller medelvärde i något blad.
        const alla = celler(bok);
        for (const v of kvTal(R_KV)) expect(alla.has(String(v)), String(v)).toBe(false);
        expect(blad3.some(r => r[1] === 'R')).toBe(false);
    });

    it('vid 25: varken median eller medelvärde för Q eller R i protokollet', async () => {
        const bok = await protokollet(fonsterNiva(25));
        const alla = celler(bok);
        for (const v of [...kvTal(Q_KV), ...kvTal(R_KV)]) expect(alla.has(String(v)), String(v)).toBe(false);
        expect(bok['2. Lika arbete (AID)'].some(r => String(r[1]).includes('Mellangrupp'))).toBe(false);
        expect(bok['3. Likvärdigt arbete (BAS)'].some(r => r[1] === 'Q' || r[1] === 'R')).toBe(false);
    });
    // Blad 2a är bladet Lika arbete AID x BAS ur Excel (alla flikar), så att protokollet har antal och medianer för alla
    // grupper (ADR-93). En grupp där ett kön är under tröskeln står med antal men utan median: R vid 10, Q och R vid 25.
    for (const [k, utan] of [[null, ['7200']], [25, ['7100', '7200']]]) {
        it(`vid ${k ?? 10}: blad 2a har samma rader som bladet Lika arbete AID x BAS, och ${utan.join(' och ')} utan median`, async () => {
            const w = fonsterNiva(k);
            const bok = await protokollet(w), alla = await protokollet(w, 'exportAlltTillExcel');
            const blad = bok['2a. Lika arbete, alla grupper'];
            expect(blad).toEqual(alla['Lika arbete AID x BAS']);
            const rubrik = blad.findIndex(r => r.includes('Medianlön kvinnor'));
            const [mk, mm] = ['Medianlön kvinnor', 'Medianlön män'].map(n => blad[rubrik].indexOf(n));
            const kod = blad[rubrik].indexOf('AID-kod');
            for (const aid of utan) {
                const rad = blad.find(r => String(r[kod]) === aid);
                expect(rad, aid).toBeTruthy();
                expect([rad[mk], rad[mm]], aid).toEqual(['', '']);
            }
            if (k === null) expect(blad.find(r => String(r[kod]) === '7100')[mk]).toBe(median(Q_KV));
        });
    }
});

describe('[B5.5] k-tröskeln: Lika arbete AID x BAS har samma grupper som tabellen per AID-etikett (ADR-90)', () => {
    // Förut hade tabellen ett eget golv (fem personer) och visade grupper under tröskeln med antal per kön, som tabellen
    // per AID-etikett utelämnar. Nu är raderna Lika arbetes grupper: ingen grupp under tröskeln står i den ena men inte
    // i den andra, i exportläget vid 10 och 25.
    const rader = (w, id, cell) => [...w.document.querySelectorAll(`#${id} tbody tr`)].filter(tr => tr.cells.length > 4).map(cell).sort();
    for (const k of [10, 25]) {
        it(`tröskeln ${k}`, () => {
            const w = iExport(fonster(k));
            w.__ritaFlik('matrix');
            const aidbas = rader(w, 'aidbas-lika-tabell', tr => `${tr.cells[1].textContent.trim()}|${tr.cells[0].textContent.trim()}`);
            const huvud = rader(w, 'matrix-table', tr => `${tr.cells[0].textContent.trim().split(' ')[0]}|${tr.cells[1].textContent.trim()}`);
            expect(aidbas.length).toBeGreaterThan(0);
            expect(aidbas).toEqual(huvud);
            // Grupperna under tröskeln (SMA vid 10, också MELLAN vid 25) har ingen rad och inga antal, bara namnet i noten.
            const under = k === 25 ? ['5300', '5301', '5302', '5303', '5400', '5401'] : ['5400', '5401'];
            for (const aid of under) expect(aidbas.some(r => r.startsWith(`${aid}|`)), aid).toBe(false);
            const not = w.document.getElementById('aidbas-lika').textContent;
            expect(not).toContain(`${under.length} grupper visas inte`);
            expect(not).not.toMatch(/\(\d+ kvinnor, \d+ män\)/);
        });
    }
});

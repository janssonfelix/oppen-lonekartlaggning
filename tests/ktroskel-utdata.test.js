/**
 * K-tröskeln som inställning: Lönepolitik, Prioritering, § 3:10-paren, texterna, gränssnittet, utdata, utskriften, konfigurationsfilen och organisationspaketet.
 *
 * Riggen (fixturer, fönster och sökfunktioner) ligger i tests/helpers/ktroskel-rigg.js; sviten är delad i
 * åtta filer så att Vitest fördelar den över flera arbetare.
 */
import { describe, it, expect, vi } from 'vitest';
import { createAppWindow } from './helpers/app-harness.js';
import { normalisera, fonster, tvaDec } from './helpers/ktroskel-rigg.js';

// Sviten ritar om hela verktyget i varje test. Under full last tar ett test 4–6 s, så standardgränsen 5 s
// fäller olika tester från körning till körning.
vi.setConfig({ testTimeout: 30000 });

describe('k-tröskeln under 5 i Lönepolitik', () => {
    it('mellannivån med bara antal finns inte när tröskeln är 3', () => {
        const w = fonster(3);
        expect(w.eval('_lpTier(4)')).toBe('full');
        expect(w.eval('_lpTier(2)')).toBe('masked');
        w.__renderTabContent('lonepolitik');
        expect(w.document.getElementById('view-lonepolitik').textContent).not.toMatch(/under 5 maskeras/);
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
        w.eval('populateSelects(); unlockTabs();');
        w.__renderTabContent('prioritering');
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

describe('k-tröskeln: § 3:10-par i Word-utkastet och utskriften', () => {
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
        w.eval('populateSelects(); unlockTabs();');
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
        // Sentinelmedianen kan i utskriften förekomma i Löneöversiktens BAS-rad (en annan, tillåten grupp); par-tabellen prövas via etiketten.
        expect(ord).not.toContain(String(SENT));
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

describe('k-tröskeln: § 3:10-par utanför fliken (protokoll, Att göra, handlingsplan, gruppdossier)', () => {
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
        w.eval('populateSelects(); unlockTabs();');
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
        w.eval('window.__csv = null; _downloadCSV = rows => { window.__csv = rows; }');
        w.document.getElementById('btn-export-checklist').click();
        return normalisera((w.__csv || []).map(r => r.join(' | ')).join('\n'));
    };
    const attGora = w => {
        w.eval('renderActionChecklist()');
        return {
            punkter: normalisera(JSON.stringify(w.eval('buildActionChecklist()'))),
            kort: normalisera(w.document.getElementById('action-checklist-container').textContent
                + w.document.getElementById('att-gora-borja').textContent),
            csv: fangaCsv(w),
        };
    };
    const dossier = (w, nyckel) => {
        w.eval(`renderGruppdossier('${nyckel}')`);
        return { skarm: normalisera(w.document.getElementById('dossier-body').textContent),
                 text: normalisera(w.eval(`gruppdossierAsText(buildGruppdossier('${nyckel}'))`)) };
    };

    it('paret finns i beräkningen (annars prövar testet inget)', () => {
        const par = fonsterPar(null).eval('likvardighetResultat().pairs');
        expect(par.some(p => p.kvAid === '5300' && p.kvN === 6 && p.maAid === '6100')).toBe(true);
    });

    it('vid 10: protokollet för gemensam lönebedömning saknar paret och anger antalet', async () => {
        const w = fonsterPar(null);
        const text = await fangaExcel(w, 'exportJPAProtocol');
        expect(text).not.toContain(ETIKETT);
        expect(text).not.toContain(String(SENT));
        expect(text).toMatch(NOT);
        expect(text).toMatch(/Antal redovisade kandidatpar i likvärdigt arbete[^|]*\| 0/);
    });
    it('vid 10: Att göra (punkter, kort och CSV) saknar paret och anger antalet', () => {
        const a = attGora(fonsterPar(null));
        for (const t of [a.punkter, a.kort, a.csv]) {
            expect(t).not.toContain(ETIKETT);
            expect(t).not.toContain(String(SENT));
        }
        expect(a.kort).toMatch(NOT);
        expect(a.csv).toMatch(NOT);
    });
    it('vid 10: handlingsplanens förifyllda rader (skärm och Excel) saknar paret, och fliken anger antalet', async () => {
        const w = fonsterPar(null);
        const seed = w.eval('_handlingsplanSeedRows()');
        expect(seed.lvCount).toBe(0);
        expect(JSON.stringify(seed.rows)).not.toContain('5300');
        w.eval('renderHandlingsplanSeed()');
        const flik = normalisera(w.document.getElementById('handlingsplan-tbody').textContent
            + w.document.getElementById('handlingsplan-seed-note').textContent);
        expect(flik).not.toContain('5300');
        expect(flik).toMatch(NOT);
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
    it('vid 10: gruppdossiern för den stora gruppen i paret visar inte den lilla och anger antalet', () => {
        const d = dossier(fonsterPar(null), '6100|C');
        for (const t of [d.skarm, d.text]) {
            expect(t).not.toContain(ETIKETT);
            expect(t).not.toContain(String(SENT));
            expect(t).toMatch(NOT);
        }
    });

    it('vid 5 (den lilla gruppens storlek är 6): paret finns i alla fyra', async () => {
        const w = fonsterPar(5);
        const protokoll = await fangaExcel(w, 'exportJPAProtocol');
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
    it('vid 10: Löneöversynens förslag riktar inte mot den lilla gruppen och anger antalet; vid 5 gör de det', () => {
        const forslag = k => {
            const w = fonsterPar(k);
            w.alert = () => {};
            Object.assign(w.__state.forecast, { minGroupN: 0, budget: { mode: 'kr', value: 5000000 }, generell: { mode: 'pct', value: 0 } });
            w.__renderTabContent('loneoversyn');
            w.eval('_forecastOptimize()');
            return { w, aid: w.__state.forecast.targets.map(t => t.aid) };
        };
        const a10 = forslag(null);
        expect(a10.aid).not.toContain('5300');
        expect(a10.w.document.getElementById('forecast-par-not').textContent).toMatch(NOT);
        expect(normalisera(a10.w.document.getElementById('forecast-targets').textContent)).not.toContain('5300');
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
        w.eval('populateSelects(); unlockTabs();');
        w.__state.likvardighet.topN = 100; w.__state.likvardighet.result = null;
        const par = w.eval('likvardighetResultat().pairs');
        expect(par.length).toBe(26);
        expect(par.slice(0, 20).some(p => p.kvN < 10)).toBe(true);   // annars prövar testet inget
        const lv = w.eval("buildActionChecklist().filter(i => i.kategori === 'Likvärdigt arbete').map(i => i.id)");
        expect(lv.length).toBe(20);
        const smaAid = par.filter(p => p.kvN < 10).map(p => p.kvAid);
        expect(lv.some(id => smaAid.some(a => id.includes(`lv-${a}-`)))).toBe(false);
    });
    it('vid 6 (precis på den lilla gruppens storlek): paret finns', () => {
        const w = fonsterPar(6);
        expect(w.eval('_handlingsplanSeedRows().lvCount')).toBe(1);
        expect(w.eval('buildActionChecklist().some(i => i.titel.includes("Yrke 5300"))')).toBe(true);
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
        w.eval('renderGlossary("")');
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
        const rad = w.eval('_evidenceForPerBasRow({ bas: "X", n: 17, kvN: 7, maN: 10, status: "too_few" })').rows;
        const kv = rad.find(r => r.label === 'Antal kvinnor');
        expect(kv.note).toBe('Under k=10');
        expect(rad.find(r => r.label === 'Antal män').note).toBe('');
    });
    it('Excel-protokollets rad om BAS-regressionen citerar statistiska golvet, raden om yrken tröskeln', () => {
        const w = createAppWindow();
        w.eval('sattKTroskel(5, { fraga: false })');
        const rader = w.eval('_jpaExkluderadeTexter()');
        expect(rader.yrken).toContain('n<5');
        expect(rader.bas).toContain('n<10');
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
    it('sänkning visar varningen på alla flikar; återställ tar bort den', () => {
        const w = createAppWindow();
        const d = w.document;
        skriv(w, '6');
        expect(w.eval('kTroskel()')).toBe(6);
        const varning = d.getElementById('k-troskel-varning');
        expect(varning.hidden).toBe(false);
        expect(varning.textContent).toContain('Minsta gruppstorlek är sänkt till 6 (standard 10). Lönemått för små grupper kan peka ut enskilda.');
        expect(varning.closest('.view-panel')).toBeNull();   // ligger utanför flikpanelerna
        expect(varning.querySelector('button')).toBeNull();  // går inte att stänga
        d.getElementById('btn-k-aterstall').click();
        expect(w.eval('kTroskel()')).toBe(10);
        expect(varning.hidden).toBe(true);
    });
    it('höjt värde ger ingen varning men en återställ-knapp', () => {
        const w = createAppWindow();
        skriv(w, '20');
        expect(w.document.getElementById('k-troskel-varning').hidden).toBe(true);
        expect(w.document.getElementById('btn-k-aterstall').hidden).toBe(false);
    });
    it.each(['', '10,0', '1e2', '1', '1001', 'tio'])('ogiltigt värde %p: felet syns vid fältet och fältet återfår gällande värde', v => {
        const w = createAppWindow();
        const f = skriv(w, v);
        expect(w.eval('kTroskel()')).toBe(10);
        expect(f.value).toBe('10');
        const fel = w.document.getElementById('k-troskel-fel');
        expect(fel.hidden).toBe(false);
        expect(fel.textContent).toMatch(/heltal mellan 2 och 1000/);
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
        expect(w.eval('kTroskel()')).toBe(10);
    });
});

describe('k-tröskeln i utdata', () => {
    const STAMPEL_10 = 'Minsta gruppstorlek för redovisning: 10.';
    const STAMPEL_6 = 'Minsta gruppstorlek för redovisning: 6. Tröskeln är sänkt från standardvärdet 10.';
    const metodrad = w => w.__methodAppendixData().find(r => r[0] === 'Minsta gruppstorlek för redovisning');

    it('vid standard: metodbilagan, Word-utkastet och sammanfattningen anger 10', () => {
        const w = fonster(null);
        expect(w.eval('kStampel()')).toBe(STAMPEL_10);
        expect(w.eval('_kSanktNot()')).toBe('');
        expect(metodrad(w)[1]).toBe('10 personer. Grupper med färre redovisas inte i beskrivande vyer (gäller inte likvärdighetsanalysen).');
        expect(w.__docDraftHtml()).toContain('Minsta gruppstorlek för redovisning');
        const block = w.__rapportunderlagBlock();
        expect(w.__ruTillText(block.find(b => b.id === 'sammanfattning'))).toContain(STAMPEL_10);
        expect(w.__ruTillText(block.find(b => b.id === 'struktur'))).not.toContain('Minsta gruppstorlek');
    });
    it('sänkt värde, utan att någon flik öppnats: varje utdata bär värdet och meningen om sänkning', () => {
        const w = fonster(6);
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
        const w = fonster(null);
        expect(w.eval('_csvMedStampel([["a"],[1]])')).toEqual([['a'], [1], [], [STAMPEL_10]]);
        expect(w.eval('_tsvMedStampel([["a"],[1]])')).toEqual([['a'], [1]]);
        expect(w.eval('_kSidfot("x")')).toBe('x');
    });
    it('diagramdata: stämpeln står i spårbarhetsraden, inte dubbelt i CSV', () => {
        const w = fonster(6);
        const gd = w.document.createElement('div');
        gd.id = 'chart-test';
        w.document.body.appendChild(gd);
        w.__el = gd; w.__f = { beskrivning: 'T', x: { skala: 'band' }, y: { skala: 'linjar' }, lager: [{ marke: 'stapel', serie: 'A', farg: '#2563eb', data: [{ x: 'a', y: 1 }] }] };
        w.eval('ritaFigur(window.__el, window.__f, {})');
        const rader = w.__chartExportRows(gd);
        expect(rader[0][0]).toContain(STAMPEL_6);
        expect(w.eval('_csvMedStampel')(rader).filter(r => String(r[0] || '').includes('Minsta gruppstorlek'))).toHaveLength(1);
    });
});

describe('k-tröskeln i utskriften', () => {
    const MENING = 'Tröskeln är sänkt från standardvärdet 10.';
    const utskrift = async k => {
        const w = fonster(k);
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
            const w = fonster(k);
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
        return w.eval('generateMotivationSuggestions(window.__item)').map(f => f.text).join(' ');
    };
    it('vid 10 saknas glasstaksmönstret för en grupp med 6 av varje kön', () => {
        expect(forslag(null)).not.toContain('Glasstaks-/klistergolvsmönster');
    });
    it('vid 5 finns det', () => {
        expect(forslag(5)).toContain('Glasstaks-/klistergolvsmönster');
    });
});

describe('k-tröskeln i utdata: de verkliga vägarna', () => {
    const STAMPEL_6 = 'Minsta gruppstorlek för redovisning: 6. Tröskeln är sänkt från standardvärdet 10.';
    const STAMPEL_10 = 'Minsta gruppstorlek för redovisning: 10.';
    const rader = [['a', 'b'], [1, 2]];
    const sistaRaden = t => t.split('\n').filter(Boolean).at(-1);

    it('gruppdossierns text slutar med stämpeln vid 6 och saknar den vid 10', () => {
        for (const [k, stampel] of [[6, STAMPEL_6], [10, null]]) {
            const w = fonster(k);
            const d = w.__buildGruppdossier(w.__gruppdossierCandidates()[0].key);
            const txt = w.__gruppdossierAsText(d);
            if (stampel) expect(txt.endsWith('\n\n' + stampel)).toBe(true);
            else expect(txt).not.toContain('Minsta gruppstorlek');
        }
    });
    it('_downloadCSV: sista raden är stämpeln', async () => {
        const w = fonster(null);
        let blob = null;
        w.URL.createObjectURL = b => { blob = b; return 'blob:x'; };
        w.alert = () => {};
        w.__rader = rader;
        w.eval("_downloadCSV(window.__rader, 'x')");
        expect(blob).not.toBeNull();
        const text = await new Promise(res => { const fr = new w.FileReader(); fr.onload = () => res(String(fr.result)); fr.readAsText(blob); });
        expect(sistaRaden(text)).toBe(STAMPEL_10);
    });
    it.each([[6, true], [10, false]])('_copyMatrixToClipboard vid %i: stämpel=%s', (k, med) => {
        const w = fonster(k);
        let kopierat = null;
        Object.defineProperty(w.navigator, 'clipboard', { configurable: true, value: { writeText: t => { kopierat = t; return Promise.resolve(); } } });
        w.__rader = rader;
        w.eval('_copyMatrixToClipboard(window.__rader)');
        expect(kopierat).not.toBeNull();
        if (med) expect(sistaRaden(kopierat)).toBe(STAMPEL_6);
        else expect(kopierat).not.toContain('Minsta gruppstorlek');
    });
    it.each([[6, 'UTKAST · minsta gruppstorlek 6 (standard 10)'], [10, null]])('Word-utkastets sidfot vid %i', async (k, suffix) => {
        const w = fonster(k);
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
        const cfg = JSON.parse(JSON.stringify(a.__buildConfigSnapshot()));
        expect(cfg.kTroskel).toBe(15);
        const b = createAppWindow();
        b.__cfg = cfg;
        b.eval('applyConfigSnapshot(window.__cfg)');
        expect(b.eval('kTroskel()')).toBe(15);
        expect(b.document.getElementById('k-troskel').value).toBe('15');
    });
    it('en fil utan fältet lämnar gällande värde orört (som ett organisationspaket utan fältet)', () => {
        const a = createAppWindow();
        const cfg = JSON.parse(JSON.stringify(a.__buildConfigSnapshot()));
        delete cfg.kTroskel;
        cfg.orgName = 'Exempelorganisationen';
        const b = createAppWindow();
        b.eval('sattKTroskel(15, { fraga: false })');
        b.__cfg = cfg;
        b.eval('applyConfigSnapshot(window.__cfg)');
        expect(b.eval('kTroskel()')).toBe(15);
        expect(b.eval('orgNamn("")')).toBe('Exempelorganisationen');   // resten av filen läses in
    });
    it.each([1, 2.5, '12', 1001, null])('ogiltigt värde %p avvisas och lämnar allt orört', v => {
        const a = createAppWindow();
        a.eval('sattKTroskel(15, { fraga: false })');
        const cfg = JSON.parse(JSON.stringify(a.__buildConfigSnapshot()));
        cfg.kTroskel = v;
        cfg.orgName = 'Ska inte läsas in';
        a.__cfg = cfg;
        // null räknas som att fältet saknas: värdet står kvar och resten läses in.
        if (v === null) { a.eval('applyConfigSnapshot(window.__cfg)'); expect(a.eval('kTroskel()')).toBe(15); return; }
        a.eval('sattKTroskel(15, { fraga: false })');
        expect(() => a.eval('applyConfigSnapshot(window.__cfg)')).toThrow(/kTroskel måste vara ett heltal mellan 2 och 1000/);
        expect(a.eval('kTroskel()')).toBe(15);
        expect(a.eval('orgNamn("")')).not.toBe('Ska inte läsas in');
    });
    it('värde under 10: nekad bekräftelse behåller värdet men läser in resten', () => {
        const a = createAppWindow();
        a.eval('sattKTroskel(6, { fraga: false })');
        const cfg = JSON.parse(JSON.stringify(a.__buildConfigSnapshot()));
        cfg.orgName = 'Exempelorganisationen';
        const b = createAppWindow();
        let fragor = 0;
        b.confirm = () => { fragor++; return false; };
        b.__cfg = cfg;
        b.eval('applyConfigSnapshot(window.__cfg)');
        expect(fragor).toBe(1);
        expect(b.eval('kTroskel()')).toBe(10);
        expect(b.eval('orgNamn("")')).toBe('Exempelorganisationen');
    });
    it('värde under 10: godkänd bekräftelse tillämpar värdet', () => {
        const a = createAppWindow();
        a.eval('sattKTroskel(6, { fraga: false })');
        const cfg = JSON.parse(JSON.stringify(a.__buildConfigSnapshot()));
        const b = createAppWindow();
        let fragor = 0;
        b.confirm = () => { fragor++; return true; };
        b.__cfg = cfg;
        b.eval('applyConfigSnapshot(window.__cfg)');
        expect(fragor).toBe(1);
        expect(b.eval('kTroskel()')).toBe(6);
    });
    it('en fil utan fältet: ett sänkt värde står också kvar, utan fråga', () => {
        const a = createAppWindow();
        const cfg = JSON.parse(JSON.stringify(a.__buildConfigSnapshot()));
        delete cfg.kTroskel;
        const b = createAppWindow();
        let fragor = 0;
        b.confirm = () => { fragor++; return true; };
        b.eval('sattKTroskel(6, { fraga: false })');
        b.__cfg = cfg;
        b.eval('applyConfigSnapshot(window.__cfg)');
        expect(b.eval('kTroskel()')).toBe(6);
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
        expect(w.eval('kTroskel()')).toBe(20);
    });
    it('ett paket utan fältet ändrar inte gällande värde', () => {
        const w = createAppWindow();
        w.eval('sattKTroskel(15, { fraga: false })');
        expect(las(w, paket(undefined)).ok).toBe(true);
        expect(w.eval('kTroskel()')).toBe(15);
    });
    it('värde under 10 kräver bekräftelse; nekad läser in resten av paketet', () => {
        const w = createAppWindow();
        let fragor = 0;
        w.confirm = () => { fragor++; return false; };
        const r = las(w, paket(5));
        expect(r.ok).toBe(true);
        expect(fragor).toBe(1);
        expect(w.eval('kTroskel()')).toBe(10);
        expect(w.eval('harReferens()')).toBe(true);
    });
    it('värde under 10: godkänd bekräftelse tillämpar värdet och läser in paketet', () => {
        const w = createAppWindow();
        let fragor = 0;
        w.confirm = () => { fragor++; return true; };
        expect(las(w, paket(5)).ok).toBe(true);
        expect(fragor).toBe(1);
        expect(w.eval('kTroskel()')).toBe(5);
        expect(w.eval('harReferens()')).toBe(true);
    });
    it('fältet i paketformuläret följer tröskeln utan att testet skriver det', () => {
        const w = createAppWindow();
        las(w, paket(undefined));
        const f = w.document.getElementById('k-troskel');
        f.value = '15';
        f.dispatchEvent(new w.Event('change', { bubbles: true }));
        w.document.getElementById('paket-org').value = 'Exempelorganisationen';
        expect(w.eval('kTroskel()')).toBe(15);
        expect(w.eval('skapaPaket()').installningar.kTroskel).toBe(15);
    });
    it('ogiltigt värde i paketet används inte och ger en varning', () => {
        const w = createAppWindow();
        const r = las(w, paket(1));
        expect(r.ok).toBe(true);
        expect(r.meddelande).toMatch(/minsta gruppstorlek .* används inte/i);
        expect(w.eval('kTroskel()')).toBe(10);
    });
    it('skapade paket bär formulärets värde', () => {
        const w = createAppWindow();
        las(w, paket(undefined));
        w.document.getElementById('paket-org').value = 'Exempelorganisationen';
        w.document.getElementById('paket-k').value = '12';
        expect(w.eval('skapaPaket()').installningar.kTroskel).toBe(12);
    });
});

/**
 * Röktest (jsdom): Organisatorisk enhet, filrutor, språk, Att göra, BAS-ordning och regressionens steg.
 *
 * Utbrutet ur smoke.test.js så att Vitest fördelar röktesterna över flera arbetare; varje describe-block
 * skapar sina egna fönster via createAppWindow (tests/helpers/app-harness.js).
 */
import { describe, it, expect } from 'vitest';
import { createAppWindow } from './helpers/app-harness.js';
import { borjaHar } from '../src/lib/attgora.js';

describe('ingen organisatorisk enhet i data eller utdata (se §2 i teknisk-plan.md)', () => {
    it('ordlistan, Vad lagras? och riskanalysen beskriver fem fält, utan enhet', async () => {
        const w = createAppWindow();
        w.__loadDemoData();
        w.eval('openDataResidency()');
        expect(w.document.getElementById('data-residency-content').textContent).not.toMatch(/\bsex fält\b/);
        expect(w.document.body.innerHTML).not.toMatch(/hur en enhet skiljer sig/);
        const { readFileSync } = await import('node:fs');
        const { join, dirname } = await import('node:path');
        const { fileURLToPath } = await import('node:url');
        const rot = join(dirname(fileURLToPath(import.meta.url)), '..');
        const risk = readFileSync(join(rot, 'docs', 'dataskydd', 'riskanalys.md'), 'utf8');
        // GLOSSARY är en const och nås inte i testfönstret — läs ordlistans källa.
        const ord = readFileSync(join(rot, 'src', 'app', '04-ordlista.js'), 'utf8').split('\n').find(l => l.includes("term:'Uppgiftsminimering'"));
        expect(ord).not.toMatch(/ansvar/i);
        expect(risk).not.toMatch(/sex minimerade|sex obligatoriska/);
    });
    it('rapportunderlaget visar ingen lön från ett kön under k i hela organisationen', () => {
        const w = createAppWindow();
        const rad = (kon, lon, i) => ({ bas: ['A', 'B', 'C'][i % 3], kon, lon, alder: 25 + (i % 30), yrke: `${100 + (i % 2)} Yrke`, aid: String(100 + (i % 2)), yrkeLabel: 'Yrke' });
        const rader = [];
        for (let i = 0; i < 12; i++) rader.push(rad('kvinna', 31000 + i * 50, i));
        for (let i = 0; i < 3; i++) rader.push(rad('man', 77777, i));
        w.__state.data = rader;
        w.eval('populateSelects(); unlockTabs();');
        const text = w.__rapportunderlagBlock().map(b => w.__ruTillText(b)).join('\n').replace(/(\d)[\s\u00a0\u202f](?=\d)/g, '$1');
        expect(text).not.toContain('77777');
        expect(text).toContain('Urval: Hela organisationen');
    });
    it('CSV-mallen har ingen Ansvar-kolumn', async () => {
        const w = createAppWindow();
        let blob = null;
        w.URL.createObjectURL = b => { blob = b; return 'blob:x'; };
        w.document.getElementById('btn-download-csv-template').click();
        const text = await blob.text();
        expect(text.split(/\r?\n/)[0]).not.toMatch(/Ansvar/);
        expect(text).not.toMatch(/12345678|12349999/);
    });
    it('exporterna och hjälptexterna nämner ingen enhet', () => {
        const w = createAppWindow();
        w.__loadDemoData();
        const html = w.__docDraftHtml();
        expect(html).not.toMatch(/Enhet \d|enhetsfilter/i);
        w.eval('openDataResidency()');
        expect(w.document.getElementById('data-residency-content').textContent).not.toMatch(/\benhet\b/);
    });
    it('ingen vy erbjuder enhet som val, och rapportunderlaget har inga enhetsblock', () => {
        const w = createAppWindow();
        w.__loadDemoData();
        expect(w.document.querySelectorAll('option[value="enhet"]')).toHaveLength(0);
        expect(w.document.getElementById('prio-per-enhet-card')).toBeNull();
        const ids = w.__rapportunderlagBlock();
        expect(ids.every(b => !b.stycken.join(' ').includes('Enhet '))).toBe(true);
    });
    const vendor = async w => {
        const { readFileSync } = await import('node:fs');
        const { join, dirname } = await import('node:path');
        const { fileURLToPath } = await import('node:url');
        w.eval(readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'vendor', 'papaparse.min.js'), 'utf8'));
    };
    it('en lönefil med kolumnen Ansvar läses in utan enhetsfält', async () => {
        const w = createAppWindow();
        await vendor(w);
        const rader = ['BAS;Månadslön;Ålder;Kön;AID;Ansvar'];
        for (let i = 0; i < 12; i++) rader.push(`A;${30000 + i};40;${i % 2 ? 'Man' : 'Kvinna'};5301;110045`);
        w.loadStructureFile(new w.File([rader.join('\n')], 'p.csv', { type: 'text/csv' }));
        for (let i = 0; i < 100 && !w.__state.data.length; i++) await new Promise(r => setTimeout(r, 20));
        expect(w.__state.data).toHaveLength(12);
        expect(w.__state.data.every(r => !('enhet' in r))).toBe(true);
        const rec = w.eval(`extractMinimalRecord({ BAS: 'A', 'Månadslön': '30000', 'Ålder': '40', 'Kön': 'Kvinna', AID: '5301', Ansvar: '110045' })`);
        expect('enhet' in rec).toBe(false);
    });
    it('getData är hela datan, och tillståndet har inget enhetsfilter', () => {
        const w = createAppWindow();
        w.__loadDemoData();
        expect(w.document.getElementById('enhet-select')).toBeNull();
        expect(w.__getData()).toBe(w.__state.data);
        expect('activeEnhet' in w.__state).toBe(false);
        expect(w.__state.data.every(r => !('enhet' in r))).toBe(true);
    });
});

describe('Lika arbete och filrutorna: ordning och kompakta rutor', () => {
    const efter = (a, b) => !!(a.compareDocumentPosition(b) & 4);   // b ligger efter a
    it('Lika arbete visar slutsatser och huvuddiagram först, sedan yrkesgrupperna, personer att granska, per BAS och sist regressionen', () => {
        const w = createAppWindow();
        w.__loadDemoData();
        w.document.querySelector('.nav-item[data-tab="matrix"]').click();
        const d = w.document;
        // Slutsatserna och översikten per BAS-intervall (en tabell med inbyggd grafik) står överst.
        const [slut, huvud, yrken, pag, perBas, reg] = ['la-slutsatser', 'la-oversikt', 'matrix-table', 'personer-att-granska', 'paygap-table', 'regression-card'].map(id => d.getElementById(id));
        expect(efter(slut, huvud)).toBe(true);
        expect(efter(huvud, yrken)).toBe(true);
        expect(efter(yrken, pag)).toBe(true);
        expect(efter(pag, perBas)).toBe(true);
        expect(efter(perBas, reg)).toBe(true);
        for (const el of [yrken, perBas, reg]) expect(el.closest('.view-panel').style.display).toBe('block');
        expect(pag.hidden).toBe(false);
        expect(d.querySelector('.view-panel[style*="block"] .flik-intro').textContent).toContain('Samma jobb, olika lön');
    });
    it('efter inläsning syns alla tre filrutorna, lönefilens kompakt, och bara ett dataskyddsbesked', () => {
        const w = createAppWindow();
        const d = w.document;
        expect(d.querySelector('.gdpr-info-compact').hidden).toBe(false);
        w.__loadDemoData();
        expect(d.getElementById('upload-row').style.display).toBe('');
        expect(d.getElementById('upload-collapsed-bar')).toBeNull();
        expect(d.getElementById('btn-toggle-upload')).toBeNull();
        const data = d.getElementById('upload-cell-data');
        expect(data.classList.contains('loaded')).toBe(true);
        const inlast = data.querySelector('.upload-inlast');
        expect(inlast.hidden).toBe(false);
        expect(inlast.textContent).toMatch(/Demodata/);
        expect(d.getElementById('org-namn').value).toBe('Exempelkommunen');
        expect([...inlast.querySelectorAll('button')].map(b => b.textContent.trim())).toEqual(['Byt fil', 'Kolumnmappning']);
        for (const id of ['upload-cell-policy', 'upload-cell-stat']) {
            const c = d.getElementById(id);
            expect(c.hidden).toBe(false);
            expect(c.closest('#upload-row')).not.toBeNull();
        }
        expect(d.querySelector('.gdpr-info-compact').hidden).toBe(true);
        expect(d.getElementById('gdpr-banner').style.display).toBe('inline-flex');
        w.__clearAllData();
        expect(data.classList.contains('loaded')).toBe(false);
        expect(data.querySelector('.upload-inlast').hidden).toBe(true);
        expect(d.querySelector('.gdpr-info-compact').hidden).toBe(false);
    });
    it('en inläst lönefil visar filnamnet; Byt fil öppnar filväljaren; misslyckat byte behåller statusen', async () => {
        const { readFileSync } = await import('node:fs');
        const { join, dirname } = await import('node:path');
        const { fileURLToPath } = await import('node:url');
        const w = createAppWindow();
        w.eval(readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'vendor', 'papaparse.min.js'), 'utf8'));
        const rader = ['BAS;Månadslön;Ålder;Kön;AID'];
        for (let i = 0; i < 20; i++) rader.push(`A;${30000 + i};40;${i % 2 ? 'Man' : 'Kvinna'};5301`);
        w.loadStructureFile(new w.File([rader.join('\n')], 'lonefil_2026.csv', { type: 'text/csv' }));
        for (let i = 0; i < 100 && !w.__state.data.length; i++) await new Promise(r => setTimeout(r, 20));
        await new Promise(r => setTimeout(r, 50));
        const cell = w.document.getElementById('upload-cell-data');
        expect(cell.querySelector('.upload-filnamn').textContent).toMatch(/lonefil_2026\.csv/);
        let klickad = false;
        w.document.getElementById('file-input-data').click = () => { klickad = true; };
        cell.querySelector('[data-byt-fil]').click();
        expect(klickad).toBe(true);
        w.loadStructureFile(new w.File([new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])], 'arbetsbok.xls'));
        await new Promise(r => setTimeout(r, 100));
        expect(cell.classList.contains('loaded')).toBe(true);
        expect(cell.querySelector('.upload-filnamn').textContent).toMatch(/lonefil_2026\.csv/);
    });
    it('ställningstagande och statistik: kompakta med namnfält; Ta bort referensen återställer rutan', () => {
        const w = createAppWindow();
        w.__loadDemoData();
        w.eval("_lasInReferens([{ bas: 'C', p10: 30000, med: 34000, p90: 39000 }], 'lonepolitik_2026.csv'); markUploadLoaded('upload-cell-policy', 'Inläst');");
        w.__state.filnamn.policy = 'lonepolitik_2026.csv';
        w.eval('renderFilrutor()');
        const pol = w.document.getElementById('upload-cell-policy');
        expect(pol.classList.contains('loaded')).toBe(true);
        expect(pol.querySelector('.upload-filnamn').textContent).toMatch(/lonepolitik_2026\.csv/);
        expect(w.document.getElementById('referens-namn-rad').hidden).toBe(false);
        w.document.getElementById('btn-referens-aterga').click();
        expect(pol.classList.contains('loaded')).toBe(false);
        expect(pol.querySelector('.upload-inlast').hidden).toBe(true);
        const stat = w.document.getElementById('upload-cell-stat');
        const jmf = w.document.getElementById('jmf-namn');
        expect(jmf).not.toBeNull();
        jmf.value = 'Regionstatistiken'; jmf.dispatchEvent(new w.Event('change'));
        expect(w.eval('jmfNamn()')).toBe('Regionstatistiken');
        expect(stat.querySelector('.upload-namn-fel').hidden).toBe(true);
    });
    it('demots ställningstagande visas kompakt; paketraden är ihopfälld och visar organisationstypen', () => {
        const w = createAppWindow();
        const d = w.document;
        expect(d.getElementById('organisationspaket').open).toBe(false);
        w.__loadDemoData();
        const pol = d.getElementById('upload-cell-policy');
        expect(pol.classList.contains('loaded')).toBe(true);
        expect(pol.querySelector('.upload-filnamn').textContent).toMatch(/Demots ställningstagande/);
        expect(d.querySelector('#organisationspaket > summary').textContent).toMatch(/Organisationen är: en kommun/);
        w.__clearAllData();
        expect(pol.classList.contains('loaded')).toBe(false);
    });
    it('välkomstrutan är en rad och demoknappen finns bara där', () => {
        const w = createAppWindow();
        const d = w.document;
        expect(d.getElementById('btn-try-demo')).toBeNull();
        expect(d.getElementById('btn-minimize-upload')).toBeNull();
        expect(d.getElementById('first-run-hint').textContent.replace(/\s+/g, ' ')).toMatch(/Kom igång: läs in lönefilen nedan — eller .*prova med demodata/i);
        d.getElementById('first-run-demo-link').click();
        expect(w.__state.data.length).toBeGreaterThan(0);
    });
});

// Klarspråk, samma namn överallt, rubriker utan emoji och ett hjälpblock av varje slag
// per flik. Fackuttrycken får stå i hjälptexten.
describe('gränssnittets språk, rubriker och hjälpblock', () => {
    const FLIKAR = ['dashboard', 'bestammelser', 'matrix', 'likvardighet', 'struktur', 'prioritering', 'loneoversyn',
                    'handlingsplan', 'dokumentera', 'kon', 'lonepolitik', 'utforska'];
    const HJALP = '#view-info, .flik-usage, .bakgrund-panel, .lv-hjalp, .audit-panel, #gdpr-info-modal, #glossary-modal, '
        + '#symbols-modal, #data-residency-modal, #evidence-modal, script, style, noscript, [data-hjalptext]';
    const oppna = () => { const w = createAppWindow(); w.__loadDemoData(); return w; };
    const synligText = (w, rot) => {
        const ut = [];
        const walker = w.document.createTreeWalker(rot, 4);
        for (let n = walker.nextNode(); n; n = walker.nextNode()) {
            if (n.parentElement && n.parentElement.closest(HJALP)) continue;
            if (n.textContent.trim()) ut.push({ id: (n.parentElement.closest('[id]') || {}).id, text: n.textContent.trim().slice(0, 80) });
        }
        return ut;
    };
    it('inga fackuttryck, engelska eller motsägelser i gränssnittet utanför hjälptexten', () => {
        const w = oppna();
        const traffar = [];
        const FORBJUDET = /Outlier|Pareto|[Qq]uantile|Boxplot|[Ss]napshot|Kompliansöversikt|Blinder-Oaxaca|[Mm]ultivariat|\bMetric\b|Z-score|Struktur-data|Datauppladdning|A–K\b/;
        for (const flik of FLIKAR) {
            w.document.querySelector(`.nav-item[data-tab="${flik}"]`).click();
            const paneler = [...w.document.querySelectorAll('.view-panel')].filter(v => v.style.display === 'block');
            for (const rad of paneler.flatMap(v => synligText(w, v))) {
                if (FORBJUDET.test(rad.text)) traffar.push(`${flik} › ${rad.id}: ${rad.text}`);
            }
            traffar.push(...(FORBJUDET.test(w.document.getElementById('page-title').textContent) ? [`${flik} › rubrik`] : []));
        }
        expect([...new Set(traffar)]).toEqual([]);
    });
    it('inga rubriker börjar med emoji', () => {
        const w = oppna();
        const traffar = [];
        for (const flik of FLIKAR) {
            w.document.querySelector(`.nav-item[data-tab="${flik}"]`).click();
            for (const h of w.document.querySelectorAll('.view-panel h1, .view-panel h2, .view-panel h3, .view-panel h4, .view-panel summary')) {
                if (h.closest('.view-panel').style.display !== 'block') continue;
                const t = h.textContent.trim();
                if (/^\p{Extended_Pictographic}/u.test(t)) traffar.push(`${flik} › ${t.slice(0, 50)}`);
            }
        }
        expect([...new Set(traffar)]).toEqual([]);
    });
    it('högst ett hjälpblock av varje slag per flik', () => {
        const w = oppna();
        const traffar = [];
        for (const flik of FLIKAR) {
            w.document.querySelector(`.nav-item[data-tab="${flik}"]`).click();
            const synliga = sel => [...w.document.querySelectorAll(sel)].filter(el => el.closest('.view-panel')?.style.display === 'block');
            // "Beräkning & urval" hör till varje enskild analys och får finnas en per analys.
            for (const [namn, sel] of [['Hur används', '.flik-usage'], ['Bakgrund', '.bakgrund-panel']]) {
                const n = synliga(sel).filter(el => namn !== 'Hur används' || /Hur används/.test(el.querySelector('summary')?.textContent || '')).length;
                if (n > 1) traffar.push(`${flik} › ${namn}: ${n}`);
            }
        }
        expect(traffar).toEqual([]);
    });
});

describe('Att göra', () => {
    it('Om verktyget beskriver Översikt med Att göra', async () => {
        const { readFileSync } = await import('node:fs');
        const { join, dirname } = await import('node:path');
        const { fileURLToPath } = await import('node:url');
        const src = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'app', '65-om-verktyget.js'), 'utf8');
        expect(src).toMatch(/Att göra/);
    });
    const rader = (kvLon, maLon) => {
        const r = [];
        for (let i = 0; i < 60; i++) r.push({ bas: 'ABC'[i % 3], kon: i % 2 ? 'man' : 'kvinna', alder: 25 + (i % 30),
            lon: (i % 2 ? maLon : kvLon) + (i % 7) * 50 + 'ABC'.indexOf('ABC'[i % 3]) * 2000, yrke: '100 Y', aid: '100', yrkeLabel: 'Y' });
        return r;
    };
    const med = (data) => { const w = createAppWindow(); w.__state.data = data; w.eval('populateSelects(); unlockTabs();'); return w; };
    it('punkten om oförklarat gap: hög vid signifikant gap över 5 %, ingen när gapet inte är signifikant', () => {
        const hog = med(rader(30000, 33000)).eval('buildActionChecklist()').find(i => i.id === 'reg-oforklarat');
        expect(hog).toMatchObject({ kategori: 'Lika arbete', prioritet: 'hög', tab: 'matrix' });
        expect(hog.titel).toMatch(/Oförklarat lönegap för hela organisationen/);
        expect(med(rader(30000, 30000)).eval('buildActionChecklist()').some(i => i.id === 'reg-oforklarat')).toBe(false);
    });
    it('ett kort: statusrad, Börja här och hela listan; inget iakttagelseblock', () => {
        const w = createAppWindow();
        w.__loadDemoData();
        const d = w.document;
        const kort = d.getElementById('att-gora');
        expect(kort.hidden).toBe(false);
        for (const id of ['compliance-overview', 'att-gora-borja', 'action-checklist-container']) expect(kort.querySelector('#' + id)).not.toBeNull();
        expect(d.getElementById('insight-feed-container')).toBeNull();
        expect(d.getElementById('comp-gap-val').textContent).toMatch(/av \d+ jämförbara BAS-intervall|Inga jämförbara/);
        expect(kort.querySelector('#compliance-overview h2')).toBeNull();
        expect(kort.querySelector('#comp-gap a[data-go-to-tab="matrix"]')).not.toBeNull();
    });
    it('Börja här: högst tre ej avbockade punkter, hög prioritet först, därefter underlag och könsrelaterade fynd; avbockning byter punkt', () => {
        const w = createAppWindow();
        w.__loadDemoData();
        const d = w.document;
        const titlar = () => [...d.querySelectorAll('#att-gora-borja [data-borja-id]')].map(li => li.dataset.borjaId);
        const items = w.eval('buildActionChecklist()');
        const vantat = borjaHar(items, new Set()).map(it => it.id);   // regeln: src/lib/attgora.js
        expect(titlar()).toEqual(vantat);
        const cb = d.querySelector(`.act-cb[data-id="${vantat[0]}"]`);
        cb.checked = true; cb.dispatchEvent(new w.Event('change'));
        expect(titlar()).not.toContain(vantat[0]);
        expect(titlar().length).toBe(Math.min(3, items.length - 1));
    });
    it('allt avbockat: "Alla punkter är hanterade."; Rensa döljer kortet', () => {
        const w = createAppWindow();
        w.__loadDemoData();
        w.__state._actionChecklistDone = new Set(w.eval('buildActionChecklist()').map(i => i.id));
        w.eval('renderActionChecklist()');
        expect(w.document.getElementById('att-gora-borja').textContent).toContain('Alla punkter är hanterade.');
        w.__clearAllData();
        expect(w.document.getElementById('att-gora').hidden).toBe(true);
        expect(w.document.getElementById('att-gora-borja').textContent.trim()).toBe('');
    });

});

describe('innehåll på sidan och i rapportunderlaget', () => {
    const oppna = (w, flik) => w.document.querySelector(`.nav-item[data-tab="${flik}"]`).click();
    it('de långa flikarna har avsnitt, och deras rubriker är innehållsförteckningen', () => {
        const w = createAppWindow();
        w.__loadDemoData();
        for (const [flik, minst] of [['dashboard', 4], ['matrix', 5], ['likvardighet', 4], ['struktur', 5], ['prioritering', 4], ['loneoversyn', 4], ['dokumentera', 4], ['kon', 5], ['lonepolitik', 4]]) {
            oppna(w, flik);
            const synliga = [...w.document.querySelectorAll('.view-panel')].filter(p => p.style.display === 'block' || p.classList.contains('active'));
            const rubriker = synliga.flatMap(p => [...p.querySelectorAll('details.avsnitt > summary h2')]);
            expect(rubriker.length, flik).toBeGreaterThanOrEqual(minst);
            for (const h of rubriker) expect(h.textContent.trim().length, flik).toBeGreaterThan(3);
        }
        expect(w.eval('typeof renderSidansInnehall')).toBe('undefined');
    });
    it('rapportunderlaget: förteckning med en länk per block', () => {
        const w = createAppWindow();
        w.__loadDemoData();
        oppna(w, 'dokumentera');
        const block = w.document.querySelectorAll('#rapportunderlag-innehall .ru-block[data-block-id]');
        const lankar = w.document.querySelectorAll('#rapportunderlag-innehall .ru-toc [data-hoppa-till]');
        expect(lankar.length).toBe(block.length);
        for (const a of lankar) expect(w.document.getElementById(a.dataset.hoppaTill)?.classList.contains('ru-block')).toBe(true);
    });
    it('Kopiera alla avsnitt lägger avsnittens rubriker i ordning på urklipp; reserv utan urklipp', async () => {
        const w = createAppWindow();
        w.__loadDemoData();
        oppna(w, 'dokumentera');
        const fångat = [];
        w.ClipboardItem = class { constructor(o) { this.o = o; } };
        Object.defineProperty(w.navigator, 'clipboard', { configurable: true, value: { write: async items => { fångat.push(...items); } } });
        expect(await w.kopieraRapportAvsnitt()).toBe('urklipp');
        const html = await fångat[0].o['text/html'].text();
        const rubriker = [...html.matchAll(/<h3>([^<]+)<\/h3>/g)].map(m => m[1]);
        const avsnitt = w.__rapportunderlagBlock().filter(b => !b.id.includes(':')).map(b => b.rubrik);
        expect(rubriker).toEqual(avsnitt);
        expect(await fångat[0].o['text/plain'].text()).toContain(avsnitt[1]);
        Object.defineProperty(w.navigator, 'clipboard', { configurable: true, value: undefined });
        w.document.execCommand = () => false;
        expect(await w.kopieraRapportAvsnitt()).toBe('markerat');
        expect(w.getSelection().toString()).toContain(avsnitt[0]);
    });
});

describe('BAS-ordningen är fast (se §5 i teknisk-plan.md)', () => {
    it('BAS-ordningen har ingen panel, inget tillstånd och inget fält i konfigurationsfilen', () => {
        const w = createAppWindow();
        w.__loadDemoData();
        expect(w.document.getElementById('bas-rank-config-container')).toBeNull();
        expect('basRankOverride' in w.__state).toBe(false);
        const cfg = w.__buildConfigSnapshot();
        expect('basRankOverride' in cfg).toBe(false);
    });
    it('robusthetspanelen prövar Likvärdigt arbete och Prioritering, inte BAS-ordningen', async () => {
        const w = createAppWindow();
        w.__loadDemoData();
        w.__renderKvalitetssakring();
        w.__runRobusthet();
        await new Promise(r => setTimeout(r, 120));
        const txt = w.document.getElementById('robusthet-body').textContent;
        expect(txt).toMatch(/Likvärdigt arbete|Prioritering/);
        expect(txt).not.toMatch(/Nivåordningen|rangordning/i);
    });
    it('extremvärden i Underlagets kvalitet, organisationspaketet i uppladdningsytan, Dokumentera heter Spara och läsa in arbetet', () => {
        const w = createAppWindow();
        w.__loadDemoData();
        const d = w.document;
        expect(d.getElementById('outliers-container').closest('#underlagets-kvalitet')).not.toBeNull();
        expect(d.getElementById('file-input-paket').closest('#upload-row')).not.toBeNull();
        for (const id of ['outliers-container', 'file-input-paket']) expect(d.getElementById(id).closest('#view-dokumentera')).toBeNull();
        expect(d.getElementById('dok-installningar-rubrik').textContent).toBe('Spara och läsa in arbetet');
        expect(d.getElementById('outliers-container').style.display).toBe('block');
        expect(d.getElementById('outliers-table-wrap').textContent).toMatch(/extremvärden|Rad/i);
    });
    it('Dokumentera lovar inte inställningar som påverkar analysen; metodtexten beskriver BAS-stegen', () => {
        const w = createAppWindow();
        w.__loadDemoData();
        expect(w.document.getElementById('view-dokumentera').textContent).not.toMatch(/inställningarna som påverkar analysen/);
        const src = require('fs').readFileSync(require('path').join(__dirname, '../src/app/41-lika-arbete.js'), 'utf8');
        const rad = src.split('\n').find(l => l.includes("['BAS-rangordning'"));
        expect(rad).toMatch(/bokstavens plats/);
        expect(rad).toMatch(/även när en bokstav saknas/);
    });
});

describe('steget + Yrkesgrupp: fasta effekter för AID×BAS med inomtransformation (ADR-46)', () => {
    // Två yrken i samma BAS med olika lönenivå: kvinnorna finns mest i det lägre betalda yrket.
    // Inom varje yrke är lönen identisk för kvinnor och män (bara ålder skiljer), så gapet efter
    // yrkesgrupp är noll — medan gapet efter BAS och ålder är klart negativt.
    const underlag = () => {
        const rader = [];
        const lägg = (aid, bas, niva, kon, n) => { for (let i = 0; i < n; i++) { const alder = 28 + ((i * 5) % 30); rader.push({ aid, yrke: 'Yrke ' + aid, bas, kon, alder, lon: Math.round(niva * Math.exp(0.004 * (alder - 40))) }); } };
        lägg('101', 'C', 28000, 'kvinna', 24); lägg('101', 'C', 28000, 'man', 6);
        lägg('102', 'C', 34000, 'kvinna', 6);  lägg('102', 'C', 34000, 'man', 24);
        lägg('201', 'E', 38000, 'kvinna', 15); lägg('201', 'E', 38000, 'man', 15);
        lägg('202', 'E', 44000, 'kvinna', 12); lägg('202', 'E', 44000, 'man', 12);
        lägg('301', 'F', 50000, 'man', 8);   // enkönad grupp: bidrar inte
        return rader;
    };
    const kör = () => { const w = createAppWindow(); w.__state.data = underlag(); return { w, r: w.eval('runOLSRegression()') }; };
    it('gapet efter yrkesgrupp är noll medan huvudtalet och steget + Ålder är kvar', () => {
        const { r } = kör();
        expect(r.error).toBeUndefined();
        const alder = r.sequential.find(s => s.name === '+ Ålder');
        expect(r.sequential.at(-1).name).toBe('+ Yrkesgrupp');
        expect(r.yrkesSteg.status).toBe('ok');
        expect(Math.abs(r.yrkesSteg.gapPct)).toBeLessThan(0.05);
        expect(alder.gapPct).toBeLessThan(-3);
        expect(r.konPct).toBeCloseTo(alder.gapPct, 6);   // huvudtalet är oförändrat: steget + Ålder
        expect(r.yrkesSteg.R2).toBeGreaterThan(alder.R2);
    });
    it('inomtransformationen ger samma könskoefficient som en indikator per grupp', () => {
        const { w, r } = kör();
        const ref = w.eval(`(() => {
            const d = getData(); const am = d.reduce((s, x) => s + x.alder, 0) / d.length;
            const g = [...new Set(d.map(x => x.aid + '|' + x.bas))].sort();
            const X = d.map(x => [x.kon === 'kvinna' ? 1 : 0, x.alder - am, ...g.map(k => (x.aid + '|' + x.bas === k ? 1 : 0))]);
            const fit = _fitOLS(X, d.map(x => Math.log(x.lon)));
            return (Math.exp(fit.beta[0]) - 1) * 100;
        })()`);
        expect(r.yrkesSteg.gapPct).toBeCloseTo(ref, 8);
    });
    it('redovisar grupper och personer: enkönade grupper räknas men bidrar inte', () => {
        const { r } = kör();
        expect(r.yrkesSteg).toMatchObject({ nGrupper: 5, nGrupperBada: 4, nEnkonade: 1, nPersoner: 114 });
    });
    it('kortet visar steget med sin mening och budgeten en del för yrkesgrupp; huvudtalet är steget + Ålder', () => {
        const { w, r } = kör();
        w.eval('renderRegressionCard()');
        const kort = w.document.getElementById('regression-card');
        const t = kort.textContent.replace(/\s+/g, ' ');
        expect(t).toMatch(/löneskillnaden mellan kvinnor och män med samma yrkesgrupp, BAS-intervall och ålder/);
        expect(t).toMatch(/Bygger på 114 personer i 4 yrkesgrupper där båda könen finns; 1 enkönade grupper bidrar inte/);
        expect(t).toMatch(/Huvudtalet ovan räknar inte bort yrkesgruppen/);
        expect(kort.querySelector('.reg-budget-legend').textContent).toMatch(/Förklaras av yrkesgrupp inom BAS/);
        expect(kort.querySelector('.step-final .step-name').textContent).toMatch(/BAS-intervall och ålder \(full modell\)/);
        expect(kort.querySelector('.step-yrke')).not.toBeNull();
        expect(kort.querySelector('.reg-number, .reg-headline, .step-final .step-value').textContent).toContain(Math.abs(r.konPct).toFixed(2).replace('.', ','));
    });
    it('utan AID och yrke faller steget bort som för få', () => {
        const w = createAppWindow(); w.__state.data = underlag().map(x => ({ ...x, aid: undefined, yrke: undefined }));
        const r = w.eval('runOLSRegression()');
        expect(r.yrkesSteg.status).toBe('too_few');
        expect(w.eval('renderRegressionCard(); document.getElementById("regression-card").textContent')).not.toMatch(/yrkesgrupp, BAS-intervall och ålder/);
    });
});

describe('BAS-steg räknas i bokstäver överallt (se §5 i teknisk-plan.md)', () => {
    // Lönen beror bara på bokstaven: +5 % per BAS-intervall. C saknas, så B → D är två intervall.
    // Kvinnorna finns mest i B, männen mest i D. Med rätt numrering förklarar BAS hela skillnaden.
    const PLATS = { A: 1, B: 2, D: 4, E: 5 };
    // brus: ±1 % i ett mönster med medelvärde noll per grupp (alla gruppstorlekar är delbara med 3)
    const underlag = (brus = 0) => {
        const rader = [];
        const lägg = (bas, kon, n) => { for (let i = 0; i < n; i++) rader.push({ bas, kon, alder: 30 + ((i * 7) % 25), lon: Math.round(30000 * Math.exp(0.05 * PLATS[bas] + brus * ((i % 3) - 1))), aid: '100', yrke: '100 Yrke', yrkeLabel: 'Yrke' }); };
        lägg('A', 'kvinna', 12); lägg('A', 'man', 12);
        lägg('B', 'kvinna', 30); lägg('B', 'man', 3);
        lägg('D', 'kvinna', 3);  lägg('D', 'man', 30);
        lägg('E', 'kvinna', 12); lägg('E', 'man', 12);
        return rader;
    };
    const med = (brus = 0) => { const w = createAppWindow(); w.__state.data = underlag(brus); return w; };
    it('regressionen: inget oförklarat gap och varje BAS-indikator ger 5 % per bokstavssteg mot referensen A', () => {
        const r = med().__runOLS();
        expect(r.error).toBeUndefined();
        expect(Math.abs(r.konPct)).toBeLessThan(0.05);
        expect(r.basRef).toBe('A');
        expect(r.basEffekter.map(e => e.bas)).toEqual(['B', 'D', 'E']);
        for (const e of r.basEffekter) expect(e.pct).toBeCloseTo((Math.exp(0.05 * (PLATS[e.bas] - 1)) - 1) * 100, 1);
    });
    it('Blinder-Oaxaca: den oförklarade delen är noll', () => {
        const r = med().eval('runBlinderOaxaca()');
        expect(Math.abs(r.coefficientPct)).toBeLessThan(0.05);
    });
    it('kvantilregressionen: inget gap i någon kvantil', () => {
        const r = med(0.01).eval('runQuantileRegressionAtAllTau()');
        expect(r.results).toHaveLength(3);
        for (const q of r.results) { expect(q.error).toBeUndefined(); expect(Math.abs(q.konPct)).toBeLessThan(0.5); }
    });
    it('kvantilregressionen: bootstrap-KI omsluter punktskattningen, är reproducerbart och visas i tabell och diagram', () => {
        const a = med(0.01).eval('_regKvantilBerakna()');
        expect(a.kiB).toBe(200);
        expect(a.kiUtelamnad).toBe('');
        for (const q of a.results) {
            expect(q.ki).toEqual({ lag: expect.any(Number), hog: expect.any(Number) });
            expect(q.ki.lag).toBeLessThanOrEqual(q.konPct);
            expect(q.ki.hog).toBeGreaterThanOrEqual(q.konPct);
            expect(q.ki.hog - q.ki.lag).toBeGreaterThan(0);
        }
        const b = med(0.01).eval('_regKvantilBerakna()');   // nytt fönster: samma data → samma intervall
        expect(b.results).toEqual(a.results);
        const w = med(0.01);
        w.eval('renderRegressionCard()');
        const tabell = [...w.document.querySelectorAll('#regression-card table')].find(t => t.textContent.includes('Klistergolvet'));
        expect(tabell.querySelector('thead').textContent).toContain('95 % KI (bootstrap)');
        expect(tabell.querySelectorAll('tbody tr')[0].children[2].textContent).toMatch(/^[+−]\d+,\d % till [+−]\d+,\d %$/);
        expect(w.document.getElementById('regression-card').textContent).toMatch(/approximation av kvantillösningen/);
        expect(w.document.getElementById('regression-card').textContent).toMatch(/percentil-bootstrap med 200 omsamplingar/);
        const f = w.document.getElementById('chart-reg-kvantil')._figur;
        expect(f.lager[1].data.map(d => d.fel)).toEqual(a.results.map(q => ({ lag: +q.ki.lag.toFixed(2), hog: +q.ki.hog.toFixed(2) })));
        expect(f.x.doman[0]).toBeLessThanOrEqual(Math.min(...a.results.map(q => q.ki.lag)));
        expect(f.x.doman[1]).toBeGreaterThanOrEqual(Math.max(...a.results.map(q => q.ki.hog)));
    });
    it('kvantilregressionen: över 2 000 personer räknas inget KI, och noten säger det', () => {
        const w = createAppWindow();
        w.__state.data = Array.from({ length: 2001 }, (_, i) => ({ bas: 'ABDE'[i % 4], kon: i % 2 ? 'man' : 'kvinna', alder: 25 + (i % 40),
            lon: Math.round(30000 * Math.exp(0.05 * (i % 4) + 0.002 * ((i * 7) % 11) - (i % 2 ? 0 : 0.03))), aid: '100', yrke: '100 Y', yrkeLabel: 'Y' }));
        const r = w.eval('_regKvantilBerakna()');
        expect(r.n).toBe(2001);
        expect(r.kiB).toBe(0);
        expect(r.kiUtelamnad).toMatch(/räknas inte vid fler än 2\u00a0000 personer/);
        expect(r.results.every(q => q.ki === null)).toBe(true);
    });
    it('regressionskortet visar referensintervallet och en rad per BAS-indikator', () => {
        const w = med();
        w.eval('renderRegressionCard()');
        const html = w.document.body.innerHTML;
        expect(html).toContain('<code>A</code>, är referens');
        expect(html).toMatch(/<td>D<\/td><td>\+16,2 %/);
    });
});

describe('MDE per grupp: spridningen inom grupp, inte över hela urvalet', () => {
    // Tre BAS-intervall med stora nivåskillnader (25 000, 40 000, 64 000 kr) men liten spridning inom varje
    // yrkesgrupp: den gamla formeln (σ över hela urvalet) rymde BAS-skillnaderna och gav en MDE per grupp
    // som var många gånger för stor.
    const rader = () => {
        const r = [];
        const nivaer = { A: 25000, B: 40000, C: 64000 };
        for (const bas of 'ABC') for (let i = 0; i < 40; i++)
            r.push({ bas, kon: i % 2 ? 'man' : 'kvinna', alder: 30 + (i % 20), lon: Math.round(nivaer[bas] * (1 + ((i % 9) - 4) * 0.005)),
                     yrke: `10${bas} Y${bas}`, aid: `10${bas}`, yrkeLabel: `Y${bas}` });
        return r;
    };
    const sdLog = loner => { const l = loner.map(Math.log), m = l.reduce((a, b) => a + b, 0) / l.length; return Math.sqrt(l.reduce((a, v) => a + (v - m) ** 2, 0) / (l.length - 1)); };
    it('σ är poolad inom grupp och MDE för en grupp med 20 + 20 blir klart mindre än med hela urvalets σ', () => {
        const w = createAppWindow(); const data = rader(); w.__state.data = data;
        const p = w.eval('computePowerAnalysis()');
        expect(p.sigmaKalla).toBe('inomGrupp');
        expect(p.sigmaGrupper).toBe(3);
        expect(p.sigmaHela).toBeCloseTo(sdLog(data.map(d => d.lon)), 6);
        expect(p.sigma).toBeLessThan(p.sigmaHela / 5);
        expect(p.sigma).toBeGreaterThan(0);
        w.eval('state.powerAnalysis = computePowerAnalysis()');
        const ny = w.eval('computeGroupMDE(20, 20)');
        const gammal = w.eval(`computeGroupMDE(20, 20, ${p.sigmaHela})`);
        expect(gammal.mdePct).toBeGreaterThan(25);
        expect(ny.mdePct).toBeLessThan(gammal.mdePct / 5);
        expect(ny.level).toBe('good');
        expect(gammal.level).toBe('poor');
    });
    it('reserv: når ingen grupp golvet för båda könen används hela urvalets σ', () => {
        const w = createAppWindow(); w.__state.data = rader().map(d => ({ ...d, yrke: `${d.yrke}${d.kon === 'man' ? 'm' : 'k'}` }));
        const p = w.eval('computePowerAnalysis()');
        expect(p.sigmaKalla).toBe('helaUrvalet');
        expect(p.sigma).toBe(p.sigmaHela);
        expect(p.sigmaGrupper).toBe(0);
    });
    it('metodtexten i Om verktyget beskriver σ inom grupp och reserven', () => {
        const w = createAppWindow(); w.__state.data = rader();
        w.eval("renderInfoTab('metodik')");
        const t = w.document.getElementById('view-info').textContent;
        expect(t).toMatch(/poolade standardavvikelsen av residualerna log\(lön\) − log\(gruppens median per kön\)/);
        expect(t).toMatch(/används bara som reserv/);
    });
});

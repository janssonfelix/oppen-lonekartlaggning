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
    it('Lika arbete visar slutsatser och yrkesgrupperna först, sedan personer att granska, per BAS, könsfördelningen och sist regressionen', () => {
        const w = createAppWindow();
        w.__loadDemoData();
        w.document.querySelector('.nav-item[data-tab="matrix"]').click();
        const d = w.document;
        // Slutsatserna och yrkesgrupperna (tabellen och sedan trattdiagrammet) står överst; personer att granska och metoden sist.
        const [slut, yrken, tratt, pag, metod] = ['la-slutsatser', 'matrix-table', 'chart-la-tratt', 'personer-att-granska', 'avsnitt-la-metod'].map(id => d.getElementById(id));
        expect(efter(slut, yrken)).toBe(true);
        expect(efter(yrken, tratt)).toBe(true);
        expect(efter(tratt, pag)).toBe(true);
        expect(efter(pag, metod)).toBe(true);
        expect(d.getElementById('la-topp').nextElementSibling.id).toBe('avsnitt-la-yrkesgrupper');   // huvudbilden direkt under nyckeltalen
        for (const el of [yrken, metod]) expect(el.closest('.view-panel').style.display).toBe('block');
        expect(pag.hidden).toBe(false);
        // BAS-skevheten, könsfördelningen och regressionen står i Lönestruktur, i den ordningen efter strukturavsnitten.
        w.document.querySelector('.nav-item[data-tab="struktur"]').click();
        const [perBas, kon, reg] = ['la-oversikt', 'avsnitt-ls-kon', 'regression-card'].map(id => d.getElementById(id));
        expect(efter(perBas, kon) && efter(kon, reg)).toBe(true);
        expect(d.getElementById('avsnitt-ls-bas').contains(perBas)).toBe(true);
        for (const el of [perBas, reg]) expect(el.closest('.view-panel').style.display).toBe('block');
        // Skillnaden per BAS-intervall visas en gång: tabellen och bilden i exporten är dolda på skärmen.
        expect(d.getElementById('la-bas-exportkopia').hidden).toBe(true);
        expect(d.getElementById('la-bas-exportkopia').contains(d.getElementById('paygap-table'))).toBe(true);
        w.document.querySelector('.nav-item[data-tab="matrix"]').click();
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
    it('demots ställningstagande visas kompakt; paketrutan står först, utfälld, och visar organisationstypen', () => {
        const w = createAppWindow();
        const d = w.document;
        expect(d.getElementById('organisationspaket').open).toBe(true);
        expect(d.querySelector('#organisationspaket > summary').textContent).toMatch(/Steg 1/);
        expect(d.getElementById('organisationspaket').compareDocumentPosition(d.getElementById('upload-row')) & 4).toBeTruthy();
        w.__loadDemoData();
        const pol = d.getElementById('upload-cell-policy');
        expect(pol.classList.contains('loaded')).toBe(true);
        expect(pol.querySelector('.upload-filnamn').textContent).toMatch(/Demots ställningstagande/);
        expect(d.querySelector('#organisationspaket > summary').textContent).toMatch(/Organisationen är: en kommun/);
        w.__clearAllData();
        expect(pol.classList.contains('loaded')).toBe(false);
    });
    it('välkomstrutan är en rad med de två demovalen (litet och stort demo)', () => {
        const w = createAppWindow();
        const d = w.document;
        expect(d.getElementById('btn-try-demo')).toBeNull();
        expect(d.getElementById('btn-minimize-upload')).toBeNull();
        const text = d.getElementById('first-run-hint').textContent.replace(/\s+/g, ' ').trim();
        expect(text).toMatch(/^Kom igång: läs in filerna, först organisationspaketet om organisationen har ett och sedan lönefilen\. Ingen fil till hands\? Prova med demodata, litet demo eller stort demo \(7 000 personer\)\.$/i);
        expect(text.match(/\beller\b/g)).toHaveLength(1);   // inte "eller … eller": samma mening som lönefilskortet
        expect(d.getElementById('first-run-demo-link').textContent).toBe('litet demo');
        // Lönefilskortet i Filer och kvalitet har samma ord för samma val.
        const kort = d.getElementById('upload-demo-val').textContent.replace(/\s+/g, ' ').trim();
        expect(kort).toBe('Ingen fil till hands? Prova med demodata, litet demo eller stort demo (7 000 personer).');
        expect(d.getElementById('upload-demo-litet').textContent).toBe(d.getElementById('first-run-demo-link').textContent);
        expect(d.getElementById('upload-demo-stort').textContent).toBe(d.getElementById('first-run-stort-demo').textContent);
        d.getElementById('first-run-demo-link').click();
        expect(w.__state.data.length).toBeGreaterThan(0);
    });
});

// Klarspråk, samma namn överallt, rubriker utan emoji och ett hjälpblock av varje slag
// per flik. Fackuttrycken får stå i hjälptexten.
describe('gränssnittets språk, rubriker och hjälpblock', () => {
    const FLIKAR = ['dashboard', 'bestammelser', 'matrix', 'likvardighet', 'struktur', 'prioritering', 'loneoversyn',
                    'handlingsplan', 'dokumentera', 'rapporttext', 'arbetet', 'kon', 'benchmark', 'utforska'];
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
    it('punkten om oförklarat gap: hög vid signifikant gap på minst 3 %, ingen när gapet inte är signifikant', () => {
        const hog = med(rader(30000, 33000)).eval('buildActionChecklist()').find(i => i.id === 'reg-oforklarat');
        expect(hog).toMatchObject({ kategori: 'Lika arbete', prioritet: 'hög', tab: 'struktur' });
        expect(hog.titel).toMatch(/Oförklarad löneskillnad i hela organisationen/);
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
        expect(kort.querySelector('#comp-gap a[data-go-to-tab="struktur"]')).not.toBeNull();
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
        for (const [flik, minst] of [['dashboard', 2], ['matrix', 4], ['likvardighet', 4], ['struktur', 5], ['prioritering', 4], ['loneoversyn', 4], ['dokumentera', 2], ['rapporttext', 2], ['arbetet', 4], ['kon', 5], ['benchmark', 4]]) {
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
        oppna(w, 'rapporttext');
        const block = w.document.querySelectorAll('#rapportunderlag-innehall .ru-block[data-block-id]');
        expect(block.length).toBeGreaterThan(0);
        const lankar = w.document.querySelectorAll('#rapportunderlag-innehall .ru-toc [data-hoppa-till]');
        expect(lankar.length).toBe(block.length);
        for (const a of lankar) expect(w.document.getElementById(a.dataset.hoppaTill)?.classList.contains('ru-block')).toBe(true);
    });
    it('Kopiera alla avsnitt lägger avsnittens rubriker i ordning på urklipp; reserv utan urklipp', async () => {
        const w = createAppWindow();
        w.__loadDemoData();
        oppna(w, 'rapporttext');
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
    it('extremvärden i Underlagets kvalitet, organisationspaketet i uppladdningsytan, Spara och jämför år har fyra avsnitt', () => {
        const w = createAppWindow();
        w.__loadDemoData();
        const d = w.document;
        expect(d.getElementById('outliers-container').closest('#underlagets-kvalitet')).not.toBeNull();
        expect(d.getElementById('file-input-paket').closest('#upload-sektion')).not.toBeNull();
        for (const id of ['outliers-container', 'file-input-paket']) expect(d.getElementById(id).closest('#view-dokumentera')).toBeNull();
        expect([...d.querySelectorAll('#view-arbetet details.avsnitt > summary h2')].map(h => h.textContent))
            .toEqual(['Spara/ladda konfiguration', 'Jämför med en ögonblicksbild', 'Jämförelse med förra året', 'Kontrollera verktyget med testdata']);
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
    it('kvantilregressionen: bootstrap-KI omsluter punktskattningen, är reproducerbart och visas i tabell och diagram', async () => {
        const a = med(0.01).eval('_regKvantilBerakna({ direkt: true })');
        expect(a.kiB).toBe(200);
        expect(a.kiUtelamnad).toBe('');
        for (const q of a.results) {
            expect(q.ki).toEqual({ lag: expect.any(Number), hog: expect.any(Number) });
            expect(q.ki.lag).toBeLessThanOrEqual(q.konPct);
            expect(q.ki.hog).toBeGreaterThanOrEqual(q.konPct);
            expect(q.ki.hog - q.ki.lag).toBeGreaterThan(0);
        }
        const b = med(0.01).eval('_regKvantilBerakna({ direkt: true })');   // nytt fönster: samma data → samma intervall
        expect(b.results).toEqual(a.results);
        const w = med(0.01);
        w.eval('renderRegressionCard()');
        // På skärmen räknas intervallet i bakgrunden efter att kortet ritats: först står raden om det, sedan ritas kortet om.
        const tabellFore = [...w.document.querySelectorAll('#regression-card table')].find(t => t.textContent.includes('Klibbigt golv'));
        expect(tabellFore.querySelectorAll('tbody tr')[0].children[2].textContent).toBe('räknas i bakgrunden…');
        expect(w.document.getElementById('regression-card').textContent).toMatch(/räknas i bakgrunden och visas strax/);
        await w.eval('_regKvantilKlar()');
        const tabell = [...w.document.querySelectorAll('#regression-card table')].find(t => t.textContent.includes('Klibbigt golv'));
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

describe('förklaringsmodellen i tillstånd och konfigurationsfil (ADR-56)', () => {
    const fonster = () => { const w = createAppWindow(); w.__loadDemoData(); return w; };
    it('sattForklaringsmodell sätter tillståndet, standard lagras som null, och snapshoten bär valet', () => {
        const w = fonster();
        expect(w.__state.forklaringsmodell).toBeNull();
        expect(w.eval('forklaringsmodell()')).toEqual({ bas: true, alder: true, yrkesgrupp: false, skal: '' });
        const r = w.eval('sattForklaringsmodell({ bas: true, alder: false, yrkesgrupp: false, skal: "ingen lön efter ålder" }, { rita: false })');
        expect(r.ok).toBe(true);
        expect(w.__state.forklaringsmodell.alder).toBe(false);
        expect(w.eval('JSON.parse(JSON.stringify(buildConfigSnapshot()))').forklaringsmodell).toEqual({ bas: true, alder: false, yrkesgrupp: false, skal: 'ingen lön efter ålder' });
        w.eval('sattForklaringsmodell({ bas: true, alder: true, yrkesgrupp: false, skal: "" }, { rita: false })');
        expect(w.__state.forklaringsmodell).toBeNull();
        expect(w.eval('JSON.parse(JSON.stringify(buildConfigSnapshot()))').forklaringsmodell).toBeNull();
    });
    it('konfigurationsfilen: ett trasigt värde ger standard med varning, en fil utan fältet ger standard utan varning', () => {
        const w = fonster();
        w.__cfg = { ...w.eval('JSON.parse(JSON.stringify(buildConfigSnapshot()))'), forklaringsmodell: { alder: 'ja', bas: true } };
        const r = w.eval('applyConfigSnapshot(window.__cfg)');
        expect(w.__state.forklaringsmodell).toEqual({ bas: true, alder: false, yrkesgrupp: false, skal: '' });
        expect(r.varningar.length).toBe(0);   // "ja" tvingas till falskt utan varning: fältet är giltigt men avslaget
        w.__cfg = { ...w.eval('JSON.parse(JSON.stringify(buildConfigSnapshot()))'), forklaringsmodell: 'full' };
        const r2 = w.eval('applyConfigSnapshot(window.__cfg)');
        expect(w.__state.forklaringsmodell).toBeNull();
        expect(r2.varningar.join(' ')).toMatch(/[Ff]örklaringsmodellen/);
        const utan = w.eval('JSON.parse(JSON.stringify(buildConfigSnapshot()))'); delete utan.forklaringsmodell;
        w.__state.forklaringsmodell = { bas: false, alder: true, yrkesgrupp: false, skal: '' };
        w.__cfg = utan;
        expect(w.eval('applyConfigSnapshot(window.__cfg)').varningar.length).toBe(0);
        expect(w.__state.forklaringsmodell).toBeNull();
    });
    it('en konfigurationsfil som läses in före lönefilen behåller yrkesgrupp (valet prövas mot datat när det finns)', () => {
        const w = createAppWindow();
        w.__cfg = { version: 2, forklaringsmodell: { bas: true, alder: true, yrkesgrupp: true, skal: '' } };
        const r = w.eval('applyConfigSnapshot(window.__cfg)');
        expect(r.varningar.length).toBe(0);
        expect(w.__state.forklaringsmodell).toEqual({ bas: true, alder: true, yrkesgrupp: true, skal: '' });
        w.__loadDemoData();
        expect(w.eval('forklaringsmodell()').yrkesgrupp).toBe(true);
    });
    it('Rensa all data nollställer valet; yrkesgrupp utan yrke i datat stängs av med varning', () => {
        const w = fonster();
        w.eval('sattForklaringsmodell({ bas: true, alder: false, yrkesgrupp: false, skal: "" }, { rita: false })');
        w.eval('_rensaAllData()');
        expect(w.__state.forklaringsmodell).toBeNull();
        const w2 = createAppWindow();
        const rad = (kon, lon, i) => ({ bas: ['A', 'B', 'C'][i % 3], kon, lon, alder: 25 + (i % 30) });
        w2.__state.data = Array.from({ length: 120 }, (_, i) => rad(i % 2 ? 'kvinna' : 'man', 30000 + (i % 3) * 2000 + (i % 7) * 100, i));
        const r = w2.eval('sattForklaringsmodell({ bas: true, alder: true, yrkesgrupp: true, skal: "" }, { rita: false })');
        expect(r.modell.yrkesgrupp).toBe(false);
        expect(r.varningar.join(' ')).toMatch(/AID och yrke/);
    });
});

describe('runOLSRegression på vald modell (ADR-56)', () => {
    const kor = modell => { const w = createAppWindow(); w.__loadDemoData(); w.__state.forklaringsmodell = modell; return { w, r: w.eval('runOLSRegression()') }; };
    it('standard: modelDesc som i dag, frasen "ålder och BAS-intervall", inget bortvalt, tillför-tabellen med tre rader', () => {
        const { r } = kor(null);
        expect(r.error).toBeUndefined();
        expect(r.modelDesc).toBe('kön + ålder + BAS-intervall (indikatorer)');
        expect(r.fras).toBe('ålder och BAS-intervall');
        expect(r.bortvalt).toEqual([]);
        expect(r.modell).toEqual({ bas: true, alder: true, yrkesgrupp: false, skal: '' });
        expect(r.tillfor.rader.map(x => x.variabel)).toEqual(['bas', 'alder', 'yrkesgrupp']);
        expect(r.modellVarning).toBeNull();
    });
    it('utan ålder: en kolumn färre, ingen ålderseffekt, ålder bortvald, inget steg + Ålder', () => {
        const std = kor(null).r;
        const { r } = kor({ bas: true, alder: false, yrkesgrupp: false, skal: 'ingen lön efter ålder' });
        expect(r.k).toBe(std.k - 1);
        expect(r.ageEffect).toBeNull();
        expect(r.ageP).toBeNull();
        expect(r.bortvalt).toHaveLength(1);
        expect(r.bortvalt[0]).toMatchObject({ variabel: 'alder', etikett: 'Ålder', skal: 'ingen lön efter ålder' });
        expect(typeof r.bortvalt[0].deltaR2pp).toBe('number');
        expect(r.sequential.map(x => x.name)).not.toContain('+ Ålder');
        expect(r.fras).toBe('BAS-intervall');
        expect(r.konPct).toBeCloseTo(r.sequential.find(x => x.name === '+ BAS-intervall').gapPct, 8);
    });
    it('utan BAS: inga BAS-effekter, frasen "ålder"', () => {
        const { r } = kor({ bas: false, alder: true, yrkesgrupp: false, skal: '' });
        expect(r.basEffekter).toBeNull();
        expect(r.basRef).toBeNull();
        expect(r.fras).toBe('ålder');
        expect(r.modelDesc).toBe('kön + ålder');
        expect(r.bortvalt.map(b => b.variabel)).toEqual(['bas']);
    });
    it('endast kön: huvudtalet är steget Endast kön, frasen är tom', () => {
        const { r } = kor({ bas: false, alder: false, yrkesgrupp: false, skal: '' });
        expect(r.fras).toBe('');
        expect(r.konPct).toBeCloseTo(r.sequential[0].gapPct, 8);
        expect(r.sequential.map(x => x.name)).toEqual(['Endast kön']);
    });
    it('yrkesgrupp vald: huvudtalet är yrkesgruppssteget och ingår i stegen', () => {
        const std = kor(null).r;
        const { r } = kor({ bas: true, alder: true, yrkesgrupp: true, skal: '' });
        expect(r.konPct).toBeCloseTo(std.yrkesSteg.gapPct, 6);
        expect(r.fras).toBe('ålder, BAS-intervall och yrkesgrupp');
        expect(r.modelDesc).toBe('kön + ålder + BAS-intervall (indikatorer) + yrkesgrupp inom BAS (fasta effekter)');
        expect(r.sequential.at(-1).name).toBe('+ Yrkesgrupp');
        expect(r.yrkesSteg.status).toBe('ok');
        expect(r.bortvalt).toEqual([]);
    });
    it('singulär vald modell (ett enda BAS) faller tillbaka och säger det', () => {
        const w = createAppWindow();
        // Kvinnorna i BAS A, männen i BAS B: könsindikatorn och BAS-indikatorn är identiska, så kön + BAS är singulär.
        w.__state.data = Array.from({ length: 80 }, (_, i) => ({ bas: i % 2 ? 'A' : 'B', kon: i % 2 ? 'kvinna' : 'man', alder: 25 + (i % 30), lon: 30000 + (i % 9) * 500 }));
        w.__state.forklaringsmodell = { bas: true, alder: false, yrkesgrupp: false, skal: '' };
        const r = w.eval('runOLSRegression()');
        expect(r.error).toBeUndefined();
        expect(r.fellBackFromFull).toBe(true);
        expect(r.modelDesc).toBe('kön');
    });
    it('ett kön under tröskeln: endast kön spärras, modellen blir BAS + ålder med en varning', () => {
        const w = createAppWindow();
        w.__state.data = Array.from({ length: 80 }, (_, i) => ({ bas: ['A', 'B', 'C'][i % 3], kon: i < 7 ? 'man' : 'kvinna', alder: 25 + (i % 30), lon: 30000 + (i % 3) * 2000 + (i % 9) * 100 }));
        w.__state.forklaringsmodell = { bas: false, alder: false, yrkesgrupp: false, skal: '' };
        const r = w.eval('runOLSRegression()');
        expect(r.error).toBeUndefined();
        expect(r.modell).toMatchObject({ bas: true, alder: true });
        expect(r.modellVarning).toMatch(/under tröskeln|färre än/);
    });
    it('_explanationBudget bygger delarna ur stegen som de kommer', () => {
        const w = createAppWindow();
        const b = w.eval(`_explanationBudget([{ name: 'Endast kön', status: 'ok', gapPct: -6 }, { name: '+ Ålder', status: 'ok', gapPct: -4 }])`);
        expect(b.parts.map(p => p.key)).toEqual(['alder']);
        expect(b.parts[0].val).toBeCloseTo(2, 10);
        expect(b.remaining).toBe(4);
    });
});

describe('modellpanelen (ADR-56)', () => {
    const oppna = w => { w.document.querySelector('.nav-item[data-tab="struktur"]').click(); w.eval('renderTabContent("struktur")'); return w.document.getElementById('forklaringsmodell-panel'); };
    const demo = () => { const w = createAppWindow(); w.__loadDemoData(); return w; };
    const andra = (w, el, varde) => { if (typeof varde === 'boolean') el.checked = varde; else el.value = varde; el.dispatchEvent(new w.Event('change', { bubbles: true })); };
    it('panelen ligger före huvudtalet med BAS och ålder ikryssade och en rad per variabel i tabellen', () => {
        const w = demo();
        const p = oppna(w);
        expect(p).not.toBeNull();
        expect(p.compareDocumentPosition(w.document.getElementById('regression-card')) & w.Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
        expect(p.querySelector('input[data-fm="bas"]').checked).toBe(true);
        expect(p.querySelector('input[data-fm="alder"]').checked).toBe(true);
        expect(p.querySelector('input[data-fm="yrkesgrupp"]').checked).toBe(false);
        expect(p.querySelectorAll('table tbody tr').length).toBe(3);
        expect(p.textContent).toMatch(/BAS-intervall/);
        expect(p.textContent).toMatch(/procentenheter/);
        expect(p.querySelector('[data-fm-notering]')).toBeNull();
    });
    it('utan AID och yrke finns ingen kryssruta för yrkesgrupp och tabellen har två rader', () => {
        const w = createAppWindow();
        w.__state.data = Array.from({ length: 120 }, (_, i) => ({ bas: ['A', 'B', 'C'][i % 3], kon: i % 2 ? 'kvinna' : 'man', alder: 25 + (i % 30), lon: 30000 + (i % 3) * 2000 + (i % 7) * 100 }));
        w.eval('populateSelects(); unlockTabs();');
        const p = oppna(w);
        expect(p.querySelector('input[data-fm="yrkesgrupp"]')).toBeNull();
        expect(p.querySelectorAll('table tbody tr').length).toBe(2);
    });
    it('att kryssa ur ålder räknar om kortet och visar noteringen; skälet sparas', () => {
        const w = demo();
        const p = oppna(w);
        andra(w, p.querySelector('input[data-fm="alder"]'), false);
        expect(w.__state.forklaringsmodell.alder).toBe(false);
        const p2 = w.document.getElementById('forklaringsmodell-panel');
        expect(p2.querySelector('[data-fm-notering]').textContent).toMatch(/Ålder har kontrollerats och tillför/);
        expect(w.document.getElementById('regression-card').textContent).toMatch(/nivå/);
        andra(w, p2.querySelector('#fm-skal'), 'organisationen sätter inte lön efter ålder');
        expect(w.__state.forklaringsmodell.skal).toBe('organisationen sätter inte lön efter ålder');
        expect(w.document.getElementById('forklaringsmodell-panel').querySelector('[data-fm-notering]').textContent).toMatch(/Skäl: organisationen sätter inte lön efter ålder/);
    });
    it('ett skäl som ser ut som en personuppgift sparas inte och får en not', () => {
        const w = demo();
        const p = oppna(w);
        andra(w, p.querySelector('input[data-fm="alder"]'), false);
        const p2 = w.document.getElementById('forklaringsmodell-panel');
        andra(w, p2.querySelector('#fm-skal'), 'lönen sätts av 19800101-1234');
        expect(w.__state.forklaringsmodell.skal).toBe('');
        expect(w.document.getElementById('forklaringsmodell-panel').querySelector('.k-mask-note').textContent).toMatch(/personuppgift/);
    });
    it('förslaget: knappen följer förslaget och kryssrutan för yrkesgrupp kräver BAS', () => {
        const w = demo();
        const p = oppna(w);
        const forslag = p.querySelector('[data-fm-forslag]');
        if (forslag) { forslag.click(); expect(w.__state.forklaringsmodell).not.toBeNull(); }
        else expect(p.textContent).toMatch(/Alla variabler tillför/);
        const w2 = demo();
        const q = oppna(w2);
        andra(w2, q.querySelector('input[data-fm="yrkesgrupp"]'), true);
        const q2 = w2.document.getElementById('forklaringsmodell-panel');
        expect(w2.__state.forklaringsmodell.yrkesgrupp).toBe(true);
        expect(q2.querySelector('input[data-fm="bas"]').checked).toBe(true);
        expect(q2.querySelector('input[data-fm="bas"]').disabled).toBe(true);
    });
    it('med ett kön under tröskeln kan inte båda kryssas ur: BAS och ålder är åter ikryssade och varningen visas', () => {
        const w = createAppWindow();
        w.__state.data = Array.from({ length: 80 }, (_, i) => ({ bas: ['A', 'B', 'C'][i % 3], kon: i < 7 ? 'man' : 'kvinna', alder: 25 + (i % 30), lon: 30000 + (i % 3) * 2000 + (i % 9) * 100 }));
        w.eval('populateSelects(); unlockTabs();');
        const p = oppna(w);
        andra(w, p.querySelector('input[data-fm="alder"]'), false);
        andra(w, w.document.getElementById('forklaringsmodell-panel').querySelector('input[data-fm="bas"]'), false);
        const p2 = w.document.getElementById('forklaringsmodell-panel');
        expect(p2.querySelector('input[data-fm="bas"]').checked).toBe(true);
        expect(p2.querySelector('input[data-fm="alder"]').checked).toBe(true);
        expect(p2.querySelector('.k-mask-note').textContent).toMatch(/Endast kön kan inte väljas/);
    });
    it('Rensa all data tömmer panelen', () => {
        const w = demo();
        oppna(w);
        w.eval('_rensaAllData()');
        expect(w.document.getElementById('forklaringsmodell-panel').innerHTML).toBe('');
    });
});

describe('avsnittet följer modellen (ADR-56)', () => {
    const rita = modell => {
        const w = createAppWindow(); w.__loadDemoData(); w.__state.forklaringsmodell = modell;
        w.document.querySelector('.nav-item[data-tab="struktur"]').click(); w.eval('renderTabContent("struktur")');
        const kort = w.document.getElementById('regression-card'), oax = w.document.getElementById('blinder-oaxaca-card');
        const trappa = w.document.getElementById('chart-reg-trappa');
        return { w, kort, oax, kortText: kort.textContent.replace(/\s+/g, ' '), oaxText: oax.textContent.replace(/\s+/g, ' '), figur: trappa ? trappa._figur : null };
    };
    it('utan ålder: inga "ålder och BAS-intervall", inget steg + Ålder, trappan slutar efter BAS, Oaxaca utan ålderraden', () => {
        const { kortText, oaxText, figur, oax } = rita({ bas: true, alder: false, yrkesgrupp: false, skal: '' });
        expect(kortText).not.toMatch(/ålder och BAS-intervall/);
        expect(kortText).not.toMatch(/ålder och BAS/);
        expect(kortText).not.toMatch(/BAS-intervall och ålder \(full modell\)/);
        expect(kortText).toMatch(/Efter kontroll för BAS-intervall/);
        expect(kortText).toMatch(/när BAS-intervall räknats bort/);
        expect(figur).not.toBeNull();
        expect(figur.x.ordning).toEqual(['Ojusterad skillnad', 'BAS-intervall', 'Oförklarad skillnad', 'Yrkesgrupp inom BAS']);
        expect(oaxText).toMatch(/Förklarat av BAS-intervall/);
        expect([...oax.querySelectorAll('tbody td:first-child')].map(td => td.textContent)).not.toContain('Ålder');
        expect(oaxText).toMatch(/Ålder har kontrollerats/);
    });
    it('endast kön: Oaxaca-kortet visas inte och kortet säger att inget räknats bort', () => {
        const { kortText, oax, figur } = rita({ bas: false, alder: false, yrkesgrupp: false, skal: '' });
        expect(oax.innerHTML).toBe('');
        expect(kortText).toMatch(/utan att något räknats bort/);
        expect(figur).toBeNull();
    });
    it('yrkesgrupp vald: ordinarie steg i trappan, och Oaxaca har raden Yrkesgrupp inom BAS i stället för BAS-intervall', () => {
        const { kortText, oax, figur } = rita({ bas: true, alder: true, yrkesgrupp: true, skal: '' });
        expect(figur.x.ordning).toEqual(['Ojusterad skillnad', 'BAS-intervall', 'Ålder', 'Yrkesgrupp inom BAS', 'Oförklarad skillnad']);
        expect(figur.lager.some(l => /ingår inte i huvudtalet/.test(l.serie))).toBe(false);
        expect(kortText).not.toMatch(/ingår inte i huvudtalet/);
        expect(kortText).toMatch(/ålder, BAS-intervall och yrkesgrupp räknats bort/);
        const rader = [...oax.querySelectorAll('tbody td:first-child')].map(td => td.textContent);
        expect(rader.some(t => /Yrkesgrupp inom BAS/.test(t))).toBe(true);
        expect(rader.some(t => /^BAS-intervall/.test(t))).toBe(false);
    });
    it('standardläget är som förut', () => {
        const { kortText, figur, oaxText } = rita(null);
        expect(kortText).toMatch(/när ålder och BAS-intervall räknats bort/);
        expect(figur.x.ordning).toEqual(['Ojusterad skillnad', 'BAS-intervall', 'Ålder', 'Oförklarad skillnad', 'Yrkesgrupp inom BAS']);
        expect(oaxText).toMatch(/Förklarat av ålder och BAS-intervall/);
    });
});

describe('huvudtalet följer modellen i nyckeltal, Att göra, Struktur och rapporten (ADR-56)', () => {
    const rita = modell => { const w = createAppWindow(); w.__loadDemoData(); w.__state.forklaringsmodell = modell; return w; };
    it('Lika arbetes nyckeltal och Att göra säger "efter BAS-intervall" utan ålder', () => {
        const w = rita({ bas: true, alder: false, yrkesgrupp: false, skal: '' });
        w.document.querySelector('.nav-item[data-tab="matrix"]').click(); w.eval('renderTabContent("matrix"); renderTabContent("struktur")');
        expect(w.document.getElementById('nyckel-ls-regression').textContent).toMatch(/efter BAS-intervall$/);
        expect(w.document.getElementById('la-slutsatser').textContent).toMatch(/Efter BAS-intervall/);
        expect(w.document.getElementById('la-slutsatser').textContent).not.toMatch(/ålder och BAS-intervall/);
        w.eval('renderActionChecklist()');
        expect(w.document.getElementById('action-checklist-container').textContent).toMatch(/\(efter BAS-intervall\)/);
    });
    it('rapportmodellen: raden heter efter BAS-intervall, bilagan saknar ålderseffekten och bär noteringen med skälet', () => {
        const w = rita({ bas: true, alder: false, yrkesgrupp: false, skal: 'ingen lön efter ålder' });
        const m = w.eval('rapportModell()');
        const lika = m.avsnitt.find(a => a.id === 'lika');
        const tab = lika.delar.find(d => d.typ === 'tabell');
        expect(tab.rader.map(r => r[0])).toContain('Löneskillnad som står kvar efter BAS-intervall');
        const text = JSON.stringify(lika.delar);
        expect(text).toMatch(/när BAS-intervall räknats bort/);
        expect(text).not.toMatch(/ålder och BAS-intervall/);
        const reg = m.avsnitt.find(a => a.id === 'regression');
        const regText = JSON.stringify(reg.delar);
        expect(regText).not.toMatch(/Ålderseffekt/);
        expect(regText).toMatch(/Ålder har kontrollerats och tillför [0-9,]+ procentenheter i förklaringsgrad; den ingår inte i siffrorna\. Skäl: ingen lön efter ålder/);
        expect(regText).toMatch(/strukturella variabler \(BAS-intervall\)/);
        expect(regText).not.toMatch(/\+ Ålder/);
    });
    it('rapportunderlaget bär frasen och det bortvalda', () => {
        const w = rita({ bas: false, alder: true, yrkesgrupp: false, skal: '' });
        const text = w.__rapportunderlagBlock().map(b => w.__ruTillText(b)).join('\n');
        expect(text).toMatch(/Efter hänsyn till ålder är den oförklarade löneskillnaden/);
        expect(text).toMatch(/BAS-intervall har kontrollerats/);
    });
    it('standardläget: rapportmodellens rad och texter som förut', () => {
        const w = rita(null);
        const m = w.eval('rapportModell()');
        const lika = m.avsnitt.find(a => a.id === 'lika');
        expect(lika.delar.find(d => d.typ === 'tabell').rader.map(r => r[0])).toContain('Löneskillnad som står kvar efter ålder och BAS-intervall');
        expect(JSON.stringify(m.avsnitt.find(a => a.id === 'regression').delar)).toMatch(/Ålderseffekt/);
    });
});

// A5: Prioriteringens förslag avfärdar inte en skillnad ("normal variation") och talar inte om utredning.
describe('förbjudna fraser i det byggda verktyget', () => {
    it('"normal variation" och "kräver ytterligare utredning" står inte i appen eller sidan', async () => {
        const { readFileSync } = await import('node:fs');
        const { join, dirname } = await import('node:path');
        const { fileURLToPath } = await import('node:url');
        const rot = join(dirname(fileURLToPath(import.meta.url)), '..');
        for (const fil of ['dist/app.js', 'src/index.html']) {
            const text = readFileSync(join(rot, fil), 'utf8');
            expect(text, fil).not.toMatch(/normal variation/i);
            expect(text, fil).not.toMatch(/kräver ytterligare utredning/i);
        }
    });
});

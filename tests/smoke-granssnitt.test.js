/**
 * Röktest (jsdom): Flikarnas form, inläsning, Personer att granska och Lika arbete.
 *
 * Utbrutet ur smoke.test.js så att Vitest fördelar röktesterna över flera arbetare; varje describe-block
 * skapar sina egna fönster via createAppWindow (tests/helpers/app-harness.js).
 */
import { describe, it, expect } from 'vitest';
import { createAppWindow } from './helpers/app-harness.js';

describe('gränssnittet: flikarnas form, inställningar, sök och tomlägen', () => {
    const lasIn = async (w, rader) => {
        const { readFileSync } = await import('node:fs');
        const { join, dirname } = await import('node:path');
        const { fileURLToPath } = await import('node:url');
        w.eval(readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'vendor', 'papaparse.min.js'), 'utf8'));
        w.loadStructureFile(new w.File([rader.join('\n')], 'p.csv', { type: 'text/csv' }));
        for (let i = 0; i < 100 && !w.__state.data.length; i++) await new Promise(r => setTimeout(r, 20));
    };
    it('användbarhetsgraden räknar inte avsiktligt uteslutna BAS; singular för en person', async () => {
        const w = createAppWindow();
        const rader = ['BAS;Månadslön;Ålder;Kön;AID'];
        for (let i = 0; i < 20; i++) rader.push(`A;${30000 + i};40;${i % 2 ? 'Man' : 'Kvinna'};5301`);
        rader.push('K;90000;50;Man;7101');
        await lasIn(w, rader);
        expect(w.document.getElementById('data-validation-report').textContent).toContain('Användbarhetsgrad: 100,0 %');
        expect(w.document.getElementById('data-status').textContent).toContain('21 rader');
    });
    it('kompliansrutan för referensens P10 räknar bara BAS med minst k personer', () => {
        const w = createAppWindow();
        const rader = [];
        for (let i = 0; i < 30; i++) rader.push({ bas: 'D', kon: i % 2 ? 'man' : 'kvinna', lon: 40000, alder: 40, yrke: '1 Y', aid: '1', enhet: '1000' });
        for (let i = 0; i < 3; i++) rader.push({ bas: 'C', kon: 'kvinna', lon: 20000, alder: 40, yrke: '2 Y', aid: '2', enhet: '1000' });
        w.__state.data = rader;
        w.eval('populateSelects(); unlockTabs();');
        w.__lasInReferens([{ bas: 'C', p10: 28300, med: 31700, p90: 35400 }, { bas: 'D', p10: 30000, med: 33900, p90: 37800 }], 'ref.csv');
        w.__updateCompliance();
        expect(w.document.getElementById('comp-pol-val').textContent).toMatch(/^0 av 1 BAS-intervall/);
    });
    it('Dokumentera har checklistan överst, exporterna som lista och resten som avsnitt', () => {
        const w = createAppWindow();
        w.__loadDemoData();
        const d = w.document;
        d.querySelector('.nav-item[data-tab="dokumentera"]').click();
        // Alla flikens paneler ligger i innehållsytan (det tomma bandet överst kom av att de låg utanför).
        for (const id of ['view-kvalitet', 'view-dokumentera', 'view-lonepolitik', 'view-utforska']) {
            expect(d.getElementById(id).parentElement.className, id).toBe('content-body');
        }
        const fore = (a, b) => !!(d.getElementById(a).compareDocumentPosition(d.getElementById(b)) & 4);
        expect(fore('dk-slutsatser', 'fardigcheck-body') && fore('fardigcheck-body', 'export-hub') && fore('export-hub', 'avsnitt-dk-robusthet')).toBe(true);
        expect([...d.querySelectorAll('details.avsnitt[id^="avsnitt-dk-"]')].map(a => a.id))
            .toEqual(['avsnitt-dk-robusthet', 'avsnitt-dk-rapportunderlag', 'avsnitt-dk-samverkan', 'avsnitt-dk-spara']);
        // Slutsatserna: färdigcheckens punkter, robustheten (inte körd) och antalet avsnitt i rapportunderlaget.
        const rutor = [...d.querySelectorAll('#dk-slutsatser .slutsats')].map(r => r.textContent);
        expect(rutor).toHaveLength(3);
        const punkter = d.querySelectorAll('#fardigcheck-body .fc-item').length;
        expect(rutor[0]).toContain(punkter ? `${punkter} punkt` : 'Inga lösa trådar');
        expect(rutor[1]).toContain('Inte körd');
        const block = d.querySelectorAll('#rapportunderlag-innehall .ru-block:not(.ru-diagram)').length;
        expect(block).toBeGreaterThan(0);
        expect(rutor[2]).toContain(`${block} avsnitt`);
        expect(d.getElementById('nyckel-dk-rapportunderlag').textContent).toBe(`${block} avsnitt`);
        expect(d.getElementById('nyckel-dk-robusthet').textContent).toBe('Inte körd');
        // Inget i raden märks som fel: punkterna är observationer.
        expect(d.querySelectorAll('#dk-slutsatser .ar-kritisk')).toHaveLength(0);
        // Exporterna: en rad per underlag med en beskrivning och en knapp eller ett val.
        const rader = [...d.querySelectorAll('#export-hub .export-lista > .export-hub-row')];
        expect(rader).toHaveLength(10);
        for (const r of rader) {
            expect(r.querySelector('strong').textContent.trim().length).toBeGreaterThan(2);
            expect(r.querySelector('span').textContent.trim().length).toBeGreaterThan(20);
            expect(r.querySelectorAll(':scope > button')).toHaveLength(1);
        }
        for (const id of ['btn-export-docdraft', 'btn-export-pdf', 'btn-export-all-excel', 'btn-export-zip', 'kl-org-name']) {
            expect(d.getElementById(id).closest('.export-lista'), id).not.toBeNull();
        }
    });
    it('robusthetsanalysen skriver sitt utfall i slutsatserna och i avsnittets nyckeltal; rensning tömmer raden', () => {
        const w = createAppWindow();
        w.__loadDemoData();
        const d = w.document;
        d.querySelector('.nav-item[data-tab="dokumentera"]').click();
        w.eval("_renderRobusthetResult(document.getElementById('robusthet-body'))");
        const rader = [...d.querySelectorAll('#robusthet-body tbody tr')];
        const flippar = d.querySelectorAll('#robusthet-body .rb-flip').length;
        const ruta = d.querySelectorAll('#dk-slutsatser .slutsats')[1].textContent;
        expect(ruta).toContain(flippar ? `${flippar} nära en gräns` : 'Står sig');
        expect(ruta).toContain(`${rader.length} slutsatser prövade`);
        expect(d.getElementById('nyckel-dk-robusthet').textContent).toBe(flippar ? `${flippar} nära en gräns` : 'Står sig');
        // Ny ritning av fliken nollställer robustheten: utfallet gäller de inställningar som rådde då.
        d.querySelector('.nav-item[data-tab="dokumentera"]').click();
        expect(d.querySelectorAll('#dk-slutsatser .slutsats')[1].textContent).toContain('Inte körd');
    });
    it('Struktur har slutsatserna och kartan först; talen i toppen är tabellernas', () => {
        const w = createAppWindow();
        w.__loadDemoData();
        const d = w.document;
        d.querySelector('.nav-item[data-tab="struktur"]').click();
        const fore = (a, b) => !!(d.getElementById(a).compareDocumentPosition(d.getElementById(b)) & 4);
        expect(fore('st-urval', 'st-slutsatser') && fore('st-slutsatser', 'chart-struktur-tradkarta') && fore('chart-struktur-tradkarta', 'avsnitt-st-representation')).toBe(true);
        expect([...d.querySelectorAll('details.avsnitt[id^="avsnitt-st-"]')].map(a => a.id.replace('avsnitt-st-', '')))
            .toEqual(['representation', 'fordelning', 'sektorer', 'eu', 'utkast', 'metod']);
        expect(d.querySelectorAll('.sidans-innehall')).toHaveLength(0);
        expect(d.getElementById('st-urval').textContent).toMatch(/260 personer.*Minsta gruppstorlek 10/);
        const rutor = [...d.querySelectorAll('#st-slutsatser .slutsats')].map(r => r.textContent);
        expect(rutor).toHaveLength(5);
        // Andelen kvinnor i kvartilerna står också i kvartiltabellen (sista kolumnen), och i samma form.
        const kvartiler = [...d.querySelectorAll('#struktur-eu table tbody tr')].map(tr => tr.textContent);
        const andel = t => t.match(/(\d+) %/)[0];
        expect(kvartiler[0]).toContain(andel(rutor[2]));
        expect(kvartiler[3]).toContain(andel(rutor[3]));
        expect(d.getElementById('nyckel-st-representation').textContent).toBe(`${d.querySelectorAll('#struktur-representation tbody tr').length} BAS-intervall`);
        expect(['Jämnt', 'Glastak', 'Klibbigt golv']).toContain(d.getElementById('nyckel-st-fordelning').textContent);
        expect(rutor[4]).toContain(d.getElementById('nyckel-st-fordelning').textContent);
        expect(d.getElementById('nyckel-st-eu').textContent).toMatch(/^Kvinnors medianlön \d+,\d % av mäns$/);
        expect(d.getElementById('view-struktur').textContent).not.toMatch(/Sticky floor/);
    });
    it('Struktur utan könsuppdelning visar inga könstal i toppen', () => {
        const w = createAppWindow();
        w.__loadDemoData();
        const d = w.document;
        w.eval('sattKTroskel(150, { fraga: false })');           // männen är färre än 150
        d.querySelector('.nav-item[data-tab="struktur"]').click();
        const rutor = [...d.querySelectorAll('#st-slutsatser .slutsats')];
        expect(rutor).toHaveLength(1);
        expect(rutor[0].textContent).toContain('Visas inte');
        expect(d.getElementById('st-slutsatser').textContent).not.toMatch(/\d+ %/);
        expect(d.getElementById('nyckel-st-eu').textContent).toBe('');
        expect(d.getElementById('nyckel-st-fordelning').textContent).toBe('');
    });
    it('Likvärdigt arbete — paren öppna, exporten hos paren, och inställningarna står kvar utfällda när ett värde ändras', () => {
        const w = createAppWindow();
        w.__loadDemoData();
        const d = w.document;
        d.querySelector('.nav-item[data-tab="likvardighet"]').click();
        const avsnitt = () => [...d.querySelectorAll('details.avsnitt[id^="avsnitt-lv-"]')];
        expect(avsnitt().map(a => a.id.replace('avsnitt-lv-', ''))).toEqual(['par', 'underlag', 'installningar', 'analys', 'poang', 'metod']);
        expect(avsnitt().filter(a => a.open).map(a => a.id)).toEqual(['avsnitt-lv-par']);
        const fore = (a, b) => !!(d.getElementById(a).compareDocumentPosition(d.getElementById(b)) & 4);
        expect(fore('lv-slutsatser', 'chart-likvardighet-krav') && fore('chart-likvardighet-krav', 'avsnitt-lv-par')).toBe(true);
        const par = d.querySelectorAll('#likvardighet-table tbody tr').length;
        expect(par).toBeGreaterThan(0);
        expect(d.getElementById('nyckel-lv-par').textContent).toBe(`${par} par`);
        const rutor = [...d.querySelectorAll('#lv-slutsatser .slutsats')].map(r => r.textContent);
        expect(rutor).toHaveLength(4);
        expect(rutor[2]).toContain(String(par));
        expect(d.getElementById('btn-export-likvardighet-csv').closest('details').id).toBe('avsnitt-lv-par');
        expect(d.getElementById('lv-min-gap').closest('details').id).toBe('avsnitt-lv-installningar');
        expect(d.getElementById('arbvard-band').closest('details').id).toBe('avsnitt-lv-poang');
        expect(d.getElementById('nyckel-lv-installningar').textContent).toBe('Standardvärden');
        // Användaren fäller ut inställningarna och ändrar ett värde: fliken ritas om, avsnittet står kvar öppet.
        d.getElementById('avsnitt-lv-installningar').open = true;
        d.getElementById('avsnitt-lv-par').open = false;
        const falt = d.getElementById('lv-min-gap');
        falt.value = '1';
        falt.dispatchEvent(new w.Event('change', { bubbles: true }));
        expect(avsnitt().filter(a => a.open).map(a => a.id)).toEqual(['avsnitt-lv-installningar']);
        expect(d.getElementById('nyckel-lv-installningar').textContent).toBe('Anpassade värden');
        expect(d.getElementById('lv-min-gap').value).toBe('1');
    });
    it('Löneöversyn — budget och utfall före avsnitten, och antalet riktade potter i rubriken', () => {
        const w = createAppWindow();
        w.__loadDemoData();
        const d = w.document;
        d.querySelector('.nav-item[data-tab="loneoversyn"]').click();
        const fore = (a, b) => !!(d.getElementById(a).compareDocumentPosition(d.getElementById(b)) & 4);
        expect(fore('forecast-budget-value', 'forecast-meter') && fore('forecast-meter', 'forecast-outcome') && fore('forecast-outcome', 'avsnitt-lo-riktade')).toBe(true);
        expect([...d.querySelectorAll('details.avsnitt[id^="avsnitt-lo-"]')].map(a => a.id.replace('avsnitt-lo-', '')))
            .toEqual(['riktade', 'planering', 'individ', 'scenarier', 'metod']);
        for (const [id, avsnitt] of [['forecast-optimize', 'riktade'], ['forecast-round', 'planering'], ['forecast-rem-btn', 'individ'], ['forecast-save-a', 'scenarier']]) {
            expect(d.getElementById(id).closest('details').id, id).toBe(`avsnitt-lo-${avsnitt}`);
        }
        expect(d.getElementById('forecast-budget-value').closest('details')).toBeNull();
        expect(d.getElementById('nyckel-lo-riktade').textContent).toBe('Inga riktade potter');
        expect(d.getElementById('nyckel-lo-planering').textContent).toBe('Standardvärden');
        d.getElementById('forecast-add-target').click();
        expect(d.getElementById('nyckel-lo-riktade').textContent).toBe('1 riktad pott');
        expect(d.querySelector('#view-loneoversyn .first-run-hint').textContent).not.toMatch(/steg \d/);
    });
    it('Lönepolitik — slutsatserna räknar de yrkesgrupper tabellen visar med position', () => {
        const w = createAppWindow();
        w.__loadDemoData();
        const d = w.document;
        d.querySelector('.nav-item[data-tab="lonepolitik"]').click();
        const avsnitt = () => [...d.querySelectorAll('details.avsnitt[id^="avsnitt-lp-"]')];
        expect(avsnitt().map(a => a.id.replace('avsnitt-lp-', ''))).toEqual(['tabell', 'kon', 'efterlevnad', 'tackning']);
        expect(avsnitt().filter(a => a.open).map(a => a.id)).toEqual(['avsnitt-lp-tabell']);
        const fore = (a, b) => !!(d.getElementById(a).compareDocumentPosition(d.getElementById(b)) & 4);
        expect(fore('lp-slutsatser', 'chart-lp-bandmap') && fore('chart-lp-bandmap', 'avsnitt-lp-tabell')).toBe(true);
        // Positionen står i tabellens femte kolumn; bara rader med en position räknas.
        const pos = [...d.querySelectorAll('#lonepolitik-table tbody tr')].map(tr => tr.children[4]).filter(td => td && /^-?\d/.test(td.dataset.sortValue || '')).map(td => +td.dataset.sortValue);
        expect(pos.length).toBeGreaterThan(0);
        const tal = [...d.querySelectorAll('#lp-slutsatser .slutsats-varde')].map(e => e.textContent);
        expect(tal).toHaveLength(4);
        expect(tal.slice(1).map(Number)).toEqual([pos.filter(p => p < 0).length, pos.filter(p => p >= 0 && p <= 100).length, pos.filter(p => p > 100).length]);
        expect(d.getElementById('nyckel-lp-tabell').textContent).toBe(`${pos.length} yrkesgrupper`);
        expect(d.getElementById('nyckel-lp-tackning').textContent).toBe(tal[0]);
        expect(d.querySelectorAll('#lp-slutsatser .ar-kritisk')).toHaveLength(0);      // utanför spannet är ett fynd, inte ett fel
        expect(d.getElementById('lonepolitik-rubrik').closest('.flik-intro')).not.toBeNull();
        // Ny ritning bevarar vilka avsnitt som är utfällda.
        d.getElementById('avsnitt-lp-efterlevnad').open = true;
        w.__renderTabContent('lonepolitik');
        expect(avsnitt().filter(a => a.open).map(a => a.id)).toEqual(['avsnitt-lp-tabell', 'avsnitt-lp-efterlevnad']);
    });
    it('menyn på smala skärmar — knappen Meny öppnar och stänger, och varje menyval har sin etikett i ett eget element', () => {
        const w = createAppWindow();
        const d = w.document;
        const knapp = d.getElementById('btn-meny'), skugga = d.getElementById('meny-skugga');
        expect(knapp.getAttribute('aria-controls')).toBe('sidomeny');
        expect(d.getElementById('sidomeny').classList.contains('sidebar')).toBe(true);
        expect(knapp.getAttribute('aria-expanded')).toBe('false');
        expect(skugga.hidden).toBe(true);
        // Etiketten ligger i ett eget element, så att ikonraden kan visa den vid pekaren; knappens namn är oförändrat.
        const val = [...d.querySelectorAll('.nav-item')];
        expect(val.length).toBeGreaterThanOrEqual(13);
        for (const k of val) {
            expect(k.querySelectorAll('.nav-etikett'), k.id).toHaveLength(1);
            expect(k.querySelector('.nav-etikett').textContent.trim()).toBe(k.textContent.trim());
        }
        knapp.click();
        expect(d.body.classList.contains('meny-oppen')).toBe(true);
        expect(knapp.getAttribute('aria-expanded')).toBe('true');
        expect(skugga.hidden).toBe(false);
        expect(d.activeElement.classList.contains('nav-item')).toBe(true);
        d.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        expect(d.body.classList.contains('meny-oppen')).toBe(false);
        expect(knapp.getAttribute('aria-expanded')).toBe('false');
        expect(d.activeElement).toBe(knapp);
        // Ett klick utanför (på skuggan) och ett val i menyn stänger också.
        knapp.click(); skugga.click();
        expect(d.body.classList.contains('meny-oppen')).toBe(false);
        knapp.click();
        d.querySelector('.nav-item[data-tab="info"]').click();
        expect(d.body.classList.contains('meny-oppen')).toBe(false);
        expect(skugga.hidden).toBe(true);
        expect(d.getElementById('view-info').style.display).toBe('block');
        // Escape utan öppen meny rör inte fokus.
        d.querySelector('.nav-item[data-tab="info"]').focus();
        d.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        expect(d.activeElement).toBe(d.querySelector('.nav-item[data-tab="info"]'));
    });
    it('Översikt är en uppladdningssida före inläsning och visar läget efter', () => {
        const w = createAppWindow();
        const d = w.document, vy = d.getElementById('view-dashboard');
        // Före inläsning: ingen filrad, uppladdningen är sidan, och processöversikten är utfälld.
        expect(vy.classList.contains('har-data')).toBe(false);
        expect(d.getElementById('ov-filrad').textContent).toBe('');
        expect(d.getElementById('avsnitt-ov-process').open).toBe(true);
        expect(d.getElementById('upload-sektion').contains(d.getElementById('file-input-data'))).toBe(true);
        expect(d.getElementById('upload-sektion').contains(d.getElementById('organisationspaket'))).toBe(true);
        w.__loadDemoData();
        expect(vy.classList.contains('har-data')).toBe(true);
        expect(vy.classList.contains('visa-filer')).toBe(false);
        const rad = d.getElementById('ov-filrad');
        expect(rad.textContent).toMatch(/Lönefil: 260 personer.*Referens: .+Jämförelsestatistik: ingen inläst.*Minsta gruppstorlek 10/);
        // Ordningen: filraden, nyckeltalen, läget (karta och kvartiler), Att göra, och sedan avsnitten.
        const fore = (a, b) => !!(d.getElementById(a).compareDocumentPosition(d.getElementById(b)) & 4);
        expect(fore('ov-filrad', 'dashboard-summary') && fore('dashboard-summary', 'chart-ov-tradkarta') && fore('chart-ov-kvartiler', 'att-gora')
            && fore('att-gora', 'avsnitt-ov-process') && fore('avsnitt-ov-process', 'avsnitt-ov-kvalitet') && fore('avsnitt-ov-kvalitet', 'avsnitt-ov-gap')).toBe(true);
        expect(d.getElementById('chart-ov-tradkarta')._figur.lager.some(l => l.marke === 'yta')).toBe(true);
        expect(d.getElementById('chart-ov-kvartiler')._figur).toBeTruthy();
        // Kartan och kvartilerna är kopior av Strukturs diagram: de exporteras därifrån, inte två gånger.
        expect(d.getElementById('chart-ov-tradkarta').closest('[data-no-export]')).not.toBeNull();
        expect(d.querySelectorAll('#ov-lage .chart-export-btn, #ov-lage [data-chart-export]')).toHaveLength(0);
        // Avsnitten är hopfällda efter inläsning och bär sitt nyckeltal.
        expect([...d.querySelectorAll('#view-dashboard details.avsnitt')].filter(a => a.open)).toHaveLength(0);
        expect(d.getElementById('nyckel-ov-process').textContent).toMatch(/^\d av \d steg klara$/);
        expect(['OK', 'Varning', 'Kritisk']).toContain(d.getElementById('nyckel-ov-kvalitet').textContent);
        expect(d.getElementById('nyckel-ov-kvalitet').textContent).toBe(d.querySelector('#underlagets-kvalitet-status .uk-marke').textContent);
        expect(d.getElementById('stat-age').textContent).toMatch(/^\d+,\d$/);
        // Knappen i filraden visar uppladdningen igen, och döljer den.
        d.getElementById('btn-ov-filer').click();
        expect(vy.classList.contains('visa-filer')).toBe(true);
        expect(d.getElementById('btn-ov-filer').getAttribute('aria-expanded')).toBe('true');
        expect(d.getElementById('btn-ov-filer').textContent).toBe('Dölj filer och inställningar');
        d.getElementById('btn-ov-filer').click();
        expect(vy.classList.contains('visa-filer')).toBe(false);
        // Värdet för minsta gruppstorlek är en länk till inställningarna, med fokus i fältet.
        d.querySelector('#ov-filrad [data-oppna-installningar]').click();
        expect(d.getElementById('installningar-modal').style.display).toBe('flex');
        expect(d.activeElement.id).toBe('k-troskel');
        w.eval('stangInstallningar()');
        // Rensning: sidan är åter en uppladdningssida.
        w.eval('_rensaAllData()');
        expect(vy.classList.contains('har-data')).toBe(false);
        expect(d.getElementById('ov-filrad').textContent).toBe('');
        expect(d.getElementById('chart-ov-tradkarta').innerHTML).toBe('');
        expect(d.getElementById('avsnitt-ov-process').open).toBe(true);
    });
    it('Att göra — hela listan är ett avsnitt som står kvar utfällt när en punkt bockas av', () => {
        const w = createAppWindow();
        w.__loadDemoData();
        const d = w.document;
        const avsnitt = () => d.getElementById('avsnitt-ov-punkter');
        expect(avsnitt().closest('#att-gora')).not.toBeNull();
        expect(avsnitt().open).toBe(false);
        const antal = d.querySelectorAll('#avsnitt-ov-punkter .act-cb').length;
        expect(antal).toBeGreaterThan(0);
        expect(d.getElementById('nyckel-ov-punkter').textContent).toBe(`0 av ${antal} hanterade`);
        expect(d.querySelector('#att-gora-borja .att-gora-borja-lista')).not.toBeNull();        // "Börja här" står utanför avsnittet
        expect(d.getElementById('att-gora-borja').closest('details')).toBeNull();
        avsnitt().open = true;
        const cb = d.querySelector('#avsnitt-ov-punkter .act-cb');
        cb.checked = true;
        cb.dispatchEvent(new w.Event('change', { bubbles: true }));
        expect(avsnitt().open).toBe(true);
        expect(d.getElementById('nyckel-ov-punkter').textContent).toBe(`1 av ${antal} hanterade`);
    });
    it('utan könsuppdelning ritas inga kvartiler på Översikt, och noten säger varför', () => {
        const w = createAppWindow();
        w.__loadDemoData();
        const d = w.document;
        w.eval('sattKTroskel(150, { fraga: false })');
        expect(d.getElementById('chart-ov-kvartiler').querySelector('svg')).toBeNull();
        expect(d.getElementById('ov-kvartiler-not').textContent.length).toBeGreaterThan(20);
        expect(d.getElementById('ov-filrad').textContent).toContain('Minsta gruppstorlek 150');
    });
    it('Inställningar — panelen bär det som gäller alla flikar, och flikarnas egna inställningar står kvar i flikarna', () => {
        const w = createAppWindow();
        const d = w.document, panel = d.getElementById('installningar-modal');
        expect(panel.getAttribute('role')).toBe('dialog');
        expect(panel.style.display).toBe('none');
        // Fälten har flyttat hit ur organisationspaketet; paketet (en fil) står kvar bland filerna.
        for (const id of ['k-troskel', 'btn-k-aterstall', 'k-troskel-hjalp', 'k-troskel-fel', 'org-typ', 'prio-po-pct', 'prio-cost-months', 'prio-cost-reset', 'prio-cost-summary']) expect(d.getElementById(id).closest('#installningar-modal'), id).not.toBeNull();
        expect(d.getElementById('file-input-paket').closest('#organisationspaket')).not.toBeNull();
        expect(d.getElementById('organisationspaket').querySelector('[data-oppna-installningar]')).not.toBeNull();
        // PO-påslag och beräkningsperiod gäller alla flikar och står i panelen; flikarnas egna inställningar står kvar i flikarna.
        for (const [id, avsnitt] of [['prio-cfg-atgard', 'avsnitt-pr-installningar'],
            ['arbvard-band', 'avsnitt-lv-poang'], ['pag-grans', 'avsnitt-la-personer'], ['outliers-threshold', 'avsnitt-ov-kvalitet']]) {
            expect(d.getElementById(id).closest('#installningar-modal'), id).toBeNull();
            expect(d.getElementById(id).closest('details.avsnitt').id, id).toBe(avsnitt);
        }
        // Utan data: knappen i sidhuvudet öppnar panelen, och länkarna till låsta flikar är inaktiva.
        const knapp = d.getElementById('btn-open-installningar');
        knapp.focus(); knapp.click();
        expect(panel.style.display).toBe('flex');
        const rader = () => [...d.querySelectorAll('#inst-flikar .inst-flik')];
        expect(rader()).toHaveLength(5);
        expect(rader().filter(r => r.querySelector('button').disabled).length).toBeGreaterThanOrEqual(4);
        d.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        expect(panel.style.display).toBe('none');
        expect(d.activeElement).toBe(knapp);
        w.__loadDemoData();
        knapp.click();
        expect(d.getElementById('inst-namn').textContent).toMatch(/Organisation.+Referens.+Jämförelsestatistik/);
        expect(rader().every(r => !r.querySelector('button').disabled)).toBe(true);
        expect(rader().map(r => r.querySelector('.inst-flik-lage').textContent)).toEqual(['Standardvärden', 'Standardvärden', '± 5 %', '10 % under förväntad lön', '3,0 standardavvikelser']);
        expect(d.querySelectorAll('#inst-flikar .ar-andrad')).toHaveLength(0);
        // "Öppna" stänger panelen, byter flik och fäller ut avsnittet där inställningen står.
        rader()[0].querySelector('button').click();
        expect(panel.style.display).toBe('none');
        expect(d.getElementById('view-prioritering').style.display).toBe('block');
        expect(d.getElementById('avsnitt-pr-installningar').open).toBe(true);
        // PO-påslag och beräkningsperiod står i panelen (gäller alla flikar); en ändring slår igenom direkt och syns i sammanfattningen.
        knapp.click();
        const po = d.getElementById('prio-po-pct');
        expect(po.closest('#installningar-modal')).not.toBeNull();
        po.value = '42'; po.dispatchEvent(new w.Event('input', { bubbles: true })); po.dispatchEvent(new w.Event('change', { bubbles: true }));
        expect(w.__state.costSettings.poPct).toBe(42);
        expect(d.getElementById('prio-cost-summary').textContent).toMatch(/Anpassad.*42,00 %/);
        d.getElementById('prio-cost-reset').click();
        expect(w.__state.costSettings.poPct).toBe(39.15);
        w.eval('stangInstallningar()');
    });
    it('minsta gruppstorlek i flikarnas urvalsrad är en länk till inställningarna, och en ändring där slår igenom', () => {
        const w = createAppWindow();
        w.__loadDemoData();
        const d = w.document;
        for (const [flik, rad] of [['matrix', 'la-urval'], ['struktur', 'st-urval'], ['likvardighet', 'lv-urval'], ['lonepolitik', 'lp-urval']]) {
            d.querySelector(`.nav-item[data-tab="${flik}"]`).click();
            const lank = d.querySelector(`#${rad} [data-oppna-installningar="k-troskel"]`);
            expect(lank, flik).not.toBeNull();
            expect(lank.textContent, flik).toBe('Minsta gruppstorlek 10');
        }
        d.querySelector('#lp-urval [data-oppna-installningar]').click();
        expect(d.getElementById('installningar-modal').style.display).toBe('flex');
        expect(d.activeElement.id).toBe('k-troskel');
        // Fältets egen lyssnare ritar om flikarna stegvis; här sätts värdet direkt, så att omritningen är klar på raden under.
        w.eval('sattKTroskel(25, { fraga: false })');
        expect(d.getElementById('k-troskel').value).toBe('25');
        expect(d.querySelector('#lp-urval [data-oppna-installningar]').textContent).toBe('Minsta gruppstorlek 25');
        expect(d.getElementById('installningar-modal').style.display).toBe('flex');    // panelen står kvar öppen efter ändringen
        w.eval('stangInstallningar()');
    });
    it('sök och hoppa — bara grupper som får visas går att söka fram, och en vald träff markeras i alla diagram', () => {
        const w = createAppWindow();
        const d = w.document, falt = d.getElementById('sok-grupp'), lista = d.getElementById('sok-grupp-lista');
        const skriv = t => { falt.value = t; falt.dispatchEvent(new w.Event('input', { bubbles: true })); };
        const tangent = (el, key, extra = {}) => el.dispatchEvent(new w.KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...extra }));
        // Utan data finns inget att söka i: fältet visas inte.
        expect(d.getElementById('sok-ruta').hidden).toBe(true);
        expect(w.eval('sokKandidater()')).toEqual([]);
        w.__loadDemoData();
        expect(d.getElementById('sok-ruta').hidden).toBe(false);
        expect(falt.getAttribute('role')).toBe('combobox');
        // Kandidaterna är BAS-intervall och yrkesgrupper med minst tröskeln personer — samma urval som gruppdossiern.
        const kand = w.eval('sokKandidater()');
        expect(kand.every(k => k.n >= 10)).toBe(true);
        expect(kand.filter(k => k.nyckel.startsWith('grupp:')).map(k => k.nyckel.slice(6)).sort()).toEqual(w.eval('gruppdossierCandidates().map(c => c.key)').sort());
        expect(kand.filter(k => k.nyckel.startsWith('bas:')).length).toBeGreaterThanOrEqual(3);
        // Sökningen: varje ord ska finnas, accenter och versaler spelar ingen roll, ord som börjar med söktexten först.
        skriv('UND');
        expect(lista.hidden).toBe(false);
        expect(falt.getAttribute('aria-expanded')).toBe('true');
        const namn = () => [...lista.querySelectorAll('[role="option"] .sok-namn')].map(e => e.textContent);
        expect(namn()[0]).toMatch(/Undersköterska/);
        skriv('skoterska c');
        expect(namn().length).toBeGreaterThan(0);
        expect(namn().every(n => /sköterska/i.test(n))).toBe(true);
        expect([...lista.querySelectorAll('.sok-under')].every(e => / · BAS C · /.test(e.textContent))).toBe(true);
        skriv('bas b');
        expect(namn()).toContain('BAS B');
        // Pil ned flyttar valet; Retur markerar gruppen, tömmer fältet och stänger listan.
        skriv('und');
        const forsta = lista.querySelector('[role="option"]');
        expect(forsta.getAttribute('aria-selected')).toBe('true');
        expect(falt.getAttribute('aria-activedescendant')).toBe(forsta.id);
        tangent(falt, 'Enter');
        const markerat = w.eval('diagramMarkering()');
        expect(markerat).toHaveLength(1);
        expect(markerat[0]).toMatch(/^grupp:\d+\|[A-Z]$/);
        expect(falt.value).toBe('');
        expect(lista.hidden).toBe(true);
        expect(d.getElementById('markering-rad').textContent).toMatch(/Markerat i alla diagram: .*Undersköterska.*Öppna gruppdossier/);
        // Samma grupp en gång till: den står kvar markerad (ett klick i ett diagram hade tagit bort den).
        skriv('und'); tangent(falt, 'Enter');
        expect(w.eval('diagramMarkering()')).toEqual(markerat);
        // Escape i fältet stänger listan men rör inte markeringen; Escape utanför tar bort den.
        skriv('bas');
        tangent(falt, 'Escape');
        expect(lista.hidden).toBe(true);
        expect(w.eval('diagramMarkering()')).toEqual(markerat);
        tangent(d.body, 'Escape');
        expect(w.eval('diagramMarkering()')).toBeNull();
        // Kortkommandon: "/" utanför textfält och Ctrl+K sätter fokus i fältet; "/" i ett textfält gör det inte.
        d.querySelector('.nav-item').focus();
        tangent(d.querySelector('.nav-item'), '/');
        expect(d.activeElement).toBe(falt);
        const annat = d.getElementById('kl-org-name');
        annat.focus(); tangent(annat, '/');
        expect(d.activeElement).toBe(annat);
        tangent(annat, 'k', { ctrlKey: true });
        expect(d.activeElement).toBe(falt);
    });
    it('en grupp under tröskeln går inte att söka fram, och svaret säger inte om den finns', () => {
        const w = createAppWindow();
        w.__loadDemoData();
        const d = w.document, falt = d.getElementById('sok-grupp'), lista = d.getElementById('sok-grupp-lista');
        const skriv = t => { falt.value = t; falt.dispatchEvent(new w.Event('input', { bubbles: true })); };
        const fore = w.eval('sokKandidater()').map(k => k.nyckel);
        w.eval('sattKTroskel(25, { fraga: false })');
        const efter = w.eval('sokKandidater()');
        expect(efter.every(k => k.n >= 25)).toBe(true);
        const borta = fore.filter(n => !efter.some(k => k.nyckel === n));
        expect(borta.length).toBeGreaterThan(0);                     // demodatan har grupper med 20–24 personer
        // En av de grupper som föll bort: sökningen på dess kod ger samma svar som en sökning på något som inte finns.
        const kod = borta.find(n => n.startsWith('grupp:')).slice(6).split('|')[0];
        skriv(kod);
        expect(lista.querySelectorAll('[role="option"]')).toHaveLength(0);
        const svar = lista.textContent;
        skriv('finnsintealls');
        expect(lista.textContent).toBe(svar);
        expect(svar).toContain('färre än 25 personer');
        // Rensning tar bort fältet och träffarna.
        w.eval('_rensaAllData()');
        expect(d.getElementById('sok-ruta').hidden).toBe(true);
        expect(lista.hidden).toBe(true);
    });
    it('exportgrinden — en flik som ritades före en ändrad tröskel ritas om innan något läses ur den', () => {
        const w = createAppWindow();
        w.__loadDemoData();
        const d = w.document;
        const oppna = f => d.querySelector(`.nav-item[data-tab="${f}"]`).click();
        oppna('struktur'); oppna('matrix'); oppna('prioritering');
        expect(w.eval("flikInaktuell('struktur') || flikInaktuell('matrix')")).toBe(false);
        const kvartiler = d.getElementById('chart-struktur-kvartiler');
        expect(w.eval('diagramRitat(document.getElementById("chart-struktur-kvartiler"))')).toBe(true);
        w.eval('sattKTroskel(25, { fraga: false })');
        // Den öppna fliken är omritad; de andra är inaktuella och deras diagram tömda.
        expect(w.eval("flikInaktuell('prioritering')")).toBe(false);
        expect(w.eval("flikInaktuell('struktur') && flikInaktuell('matrix')")).toBe(true);
        expect(d.querySelectorAll('#view-struktur svg:not(.ikon)').length).toBe(0);
        // Diagram: det tömda elementet sitter inte kvar i sidan och har inget att exportera.
        w.__tomt = kvartiler;
        expect(kvartiler.isConnected).toBe(false);
        expect(w.eval('_chartExportUnderlag(window.__tomt)')).toBeNull();
        expect(w.eval('exportSakra(window.__tomt)')).toBe(false);
        // ZIP-exporten tar "allt som är ritat": den ritar först om varje flik som ritats förut men inte är aktuell.
        const zip = w.eval('zipDiagram().map(el => el.id)');
        expect(w.eval("flikInaktuell('struktur') || flikInaktuell('matrix')")).toBe(false);
        expect(zip).toContain('chart-struktur-kvartiler');
        expect(w.eval('diagramRitat(document.getElementById("chart-struktur-kvartiler"))')).toBe(true);
        w.eval('sattKTroskel(26, { fraga: false })');                    // en ändring till: Lika arbete är inaktuell igen
        expect(w.eval("flikInaktuell('matrix')")).toBe(true);
        // Tabell: en läsning genom grinden ritar om Lika arbete först, och raderna bär den nya tröskeln.
        const klon = w.eval("_cloneAndCleanTableForExport('paygap-table')");
        expect(w.eval("flikInaktuell('matrix')")).toBe(false);
        expect(klon).not.toBeNull();
        expect(klon.querySelectorAll('tbody tr').length).toBeGreaterThan(0);
    });
    it('grinden stänger vid fel — går fliken inte att rita om exporteras ingenting ur den', () => {
        const w = createAppWindow();
        w.__loadDemoData();
        const d = w.document;
        d.querySelector('.nav-item[data-tab="matrix"]').click();
        d.querySelector('.nav-item[data-tab="dashboard"]').click();
        w.eval('sattKTroskel(25, { fraga: false })');
        w.eval("const __r = _renderTabContent; _renderTabContent = function (f) { if (f === 'matrix') throw new Error('prov'); return __r(f); };");
        expect(w.eval("_cloneAndCleanTableForExport('paygap-table')")).toBeNull();
        expect(w.eval('exportSakra(document.getElementById("chart-skevhet-overview"))')).toBe(false);
        expect(w.eval("flikInaktuell('matrix')")).toBe(true);
    });
    it('"Rensa all data" lämnar exportmenyerna och BAS-väljaren i Ålder & karriär orörda', () => {
        const w = createAppWindow();
        w.__loadDemoData();
        const d = w.document;
        d.querySelector('.nav-item[data-tab="struktur"]').click();
        d.querySelector('.nav-item[data-tab="kon"]').click();
        const menyer = () => [...d.querySelectorAll('.chart-export-meny')];
        expect(menyer().length).toBeGreaterThan(2);
        const val = () => menyer().map(m => m.querySelectorAll('button[data-chart-export]').length);
        expect(val().every(n => n >= 3)).toBe(true);
        w.eval('_rensaAllData()');
        // Menyer som låg i en behållare som fylls av koden försvinner med den; de som står kvar har sina val kvar.
        expect(menyer().length).toBeGreaterThan(2);
        expect(val().every(n => n >= 3)).toBe(true);
        expect(d.getElementById('bas-select-kon')).not.toBeNull();          // väljaren hör till sidan, inte till det ritade
        expect(d.getElementById('ak-urval-text').textContent).toBe('');
        w.__loadDemoData();
        d.querySelector('.nav-item[data-tab="kon"]').click();
        expect(d.getElementById('bas-select-kon').options.length).toBeGreaterThan(1);
    });
    it('två lägen — väljaren står i Inställningar, läget ändrar bara vad som visas och lagras inte', () => {
        const w = createAppWindow();
        w.__loadDemoData();
        const d = w.document;
        expect(w.eval('lage()')).toBe('vagledande');
        expect(d.body.classList.contains('lage-kompakt')).toBe(false);
        for (const id of ['lage-vagledande', 'lage-kompakt']) expect(d.getElementById(id).closest('#installningar-modal'), id).not.toBeNull();
        expect(d.getElementById('lage-vagledande').getAttribute('aria-pressed')).toBe('true');
        d.querySelector('.nav-item[data-tab="matrix"]').click();
        const oppna = () => [...d.querySelectorAll('details.avsnitt')].filter(a => a.open).map(a => a.id);
        const fore = { oppna: oppna(), text: d.getElementById('view-matrix').textContent, tal: d.getElementById('la-slutsatser').textContent };
        d.getElementById('lage-kompakt').click();
        expect(w.eval('lage()')).toBe('kompakt');
        expect(d.body.classList.contains('lage-kompakt')).toBe(true);
        expect(d.getElementById('lage-kompakt').getAttribute('aria-pressed')).toBe('true');
        expect(d.getElementById('lage-vagledande').getAttribute('aria-pressed')).toBe('false');
        // Läget rör inte sidans innehåll: samma text, samma tal och samma avsnitt utfällda (det som döljs döljs av stilmallen).
        expect(oppna()).toEqual(fore.oppna);
        expect(d.getElementById('view-matrix').textContent).toBe(fore.text);
        expect(d.getElementById('la-slutsatser').textContent).toBe(fore.tal);
        // Inget lagras och inget följer med i konfigurationsfilen.
        expect(w.localStorage.length).toBe(0);
        expect(w.sessionStorage.length).toBe(0);
        expect(JSON.stringify(w.eval('buildConfigSnapshot()'))).not.toMatch(/kompakt|"lage"/);
        // Rensning av data rör inte läget (det är en inställning för visningen), och ett okänt värde ger vägledande.
        w.eval('_rensaAllData()');
        expect(w.eval('lage()')).toBe('kompakt');
        w.eval("sattLage('nagot-annat')");
        expect(w.eval('lage()')).toBe('vagledande');
        expect(d.body.classList.contains('lage-kompakt')).toBe(false);
    });
    it('stilmallen döljer rätt saker före inläsning och i kompakt läge', async () => {
        const { readFileSync } = await import('node:fs');
        const css = readFileSync(new URL('../src/style.css', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
        // Före inläsning är Översikts lägesdelar dolda, var och en med egen väljare.
        for (const id of ['ov-filrad', 'ov-lage', 'ov-fordjupning', 'avsnitt-ov-kvalitet', 'avsnitt-ov-gap']) expect(css).toContain(`#view-dashboard:not(.har-data) #${id}`);
        // Kompakt läge döljer förklaringar, men aldrig noter om små grupper eller förbehåll.
        const kompakt = [...css.matchAll(/([^{}]*lage-kompakt[^{}]*)\{([^}]*)\}/g)].filter(m => /display:\s*none/.test(m[2])).map(m => m[1]).join(' ');
        expect(kompakt).toMatch(/\.avsnitt-under/);
        expect(kompakt).not.toMatch(/k-mask-note|reg-caveat|export-besked|diagramkort-forklaring|slutsats/);
    });
    it('Dokumentera utan data — knapparna för samverkan är inaktiva och panelen heter "Innan du exporterar"', () => {
        const w = createAppWindow();
        w.document.querySelector('.nav-item[data-tab="dokumentera"]').click();
        const knappar = [...w.document.querySelectorAll('[data-dok-klick]')];
        expect(knappar.length).toBe(2);
        expect(knappar.every(b => b.disabled)).toBe(true);
        expect(w.document.getElementById('view-kvalitet').textContent).toMatch(/innan du exporterar/i);
        w.__loadDemoData();
        w.document.querySelector('.nav-item[data-tab="dokumentera"]').click();
        expect([...w.document.querySelectorAll('[data-dok-klick]')].every(b => !b.disabled)).toBe(true);
    });
    it('Prioriteringens tomläge talar inte om att ladda upp ett ställningstagande', () => {
        const w = createAppWindow();
        expect(w.document.getElementById('prio-empty').textContent).not.toMatch(/ställningstagande laddas upp/);
    });
});

describe('Var uppstår löneskillnaden?', () => {
    it('ritas med demodata: tre delar, demomärkning, noten om rangordning', () => {
        const w = createAppWindow();
        w.__loadDemoData();
        const host = w.document.getElementById('gap-uppdelning');
        expect(host.hidden).toBe(false);
        expect(host.querySelectorAll('[data-gu-del]').length).toBe(3);
        expect(host.textContent).toContain('DEMODATA');
        expect(host.textContent).toContain('kan därför skilja sig från de flaggade yrkena i Lika arbete');
        expect(host.querySelector('[data-go-to-tab="struktur"]')).not.toBeNull();
        expect(host.textContent).not.toMatch(/§|3 kap\./);
    });
    it('Rensa all data döljer och tömmer kortet', () => {
        const w = createAppWindow();
        w.__loadDemoData();
        w.__clearAllData();
        const host = w.document.getElementById('gap-uppdelning');
        expect(host.hidden).toBe(true);
        expect(w.document.getElementById('gap-uppdelning-innehall').textContent.trim()).toBe('');
    });
    it('ett kön under k i urvalet: "För få personer", inga belopp', () => {
        const w = createAppWindow();
        w.__loadDemoData();
        w.__state.data = w.__state.data.filter((r, i) => r.kon.includes('kvinna') || i % 50 === 0).slice(0, 200);
        w.eval('renderGapUppdelning()');
        const t = w.document.getElementById('gap-uppdelning-innehall').textContent;
        expect(t).toContain('För få personer för att dela upp skillnaden');
        expect(w.document.querySelectorAll('#gap-uppdelning [data-gu-del]').length).toBe(0);
    });
    it('AID-namn kodas', () => {
        const w = createAppWindow();
        w.__loadDemoData();
        w.__state.data = w.__state.data.map(r => ({ ...r, aid: '<b>&"x' }));
        w.eval('renderGapUppdelning()');
        expect(w.document.querySelector('#gap-uppdelning b')).toBeNull();
    });
});

describe('radnummer vid inläsning', () => {
    const vendor = async (w, fil) => {
        const { readFileSync } = await import('node:fs');
        const { join, dirname } = await import('node:path');
        const { fileURLToPath } = await import('node:url');
        w.eval(readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'vendor', fil), 'utf8'));
    };
    const vanta = async w => { for (let i = 0; i < 100 && !w.__state.data.length; i++) await new Promise(r => setTimeout(r, 20)); };
    it('CSV: radnr följer filens rader trots försättsrad, tom rad och utesluten rad', async () => {
        const w = createAppWindow();
        await vendor(w, 'papaparse.min.js');
        const rader = ['Lönerapport 2026', 'BAS;Månadslön;Ålder;Kön;AID',
            'A;30000;40;Kvinna;5301',   // rad 3
            '',                         // rad 4 (tom)
            'K;90000;50;Man;7101',      // rad 5 (BAS K ingår sedan 2026.10)
            'A;31000;41;Man;5301'];     // rad 6
        w.loadStructureFile(new w.File([rader.join('\n')], 'p.csv', { type: 'text/csv' }));
        await vanta(w);
        expect(w.__state.data.map(r => r.radnr)).toEqual([3, 5, 6]);
    });
    it('Excel: radnr följer bladets rader trots försättsrad och tom rad', async () => {
        const w = createAppWindow();
        await vendor(w, 'xlsx.mini.min.js');
        const X = w.XLSX;
        const ws = X.utils.aoa_to_sheet([['Lönerapport'], [], ['BAS', 'Månadslön', 'Ålder', 'Kön', 'AID'],
            ['A', 30000, 40, 'Kvinna', '5301'], [], ['A', 31000, 41, 'Man', '5301']]);
        const wb = X.utils.book_new(); X.utils.book_append_sheet(wb, ws, 'Blad1');
        const buf = X.write(wb, { type: 'array', bookType: 'xlsx' });
        w.loadStructureFile(new w.File([buf], 'p.xlsx'));
        await vanta(w);
        expect(w.__state.data.map(r => r.radnr)).toEqual([4, 6]);
    });
    it('demodatan har radnr = index + 2', () => {
        const w = createAppWindow();
        w.__loadDemoData();
        expect(w.__state.data.slice(0, 3).map(r => r.radnr)).toEqual([2, 3, 4]);
    });
    it('extremvärdesdetektorn visar filens radnummer', () => {
        const w = createAppWindow();
        w.__loadDemoData();
        const i = 40;
        w.__state.data[i].lon = 400000;   // tydlig avvikelse
        const ut = w.eval('detectOutliers(3)');
        const o = ut.find(x => x.lon === 400000);
        expect(o.radnr).toBe(w.__state.data[i].radnr);
        expect(o.seq).toBeUndefined();
    });
});

describe('Personer att granska', () => {
    const oppna = w => { w.__loadDemoData(); w.document.querySelector('.nav-item[data-tab="matrix"]').click(); };
    const sankEn = w => {
        // Sänk en person i största AID/BAS-gruppen till 60 % av gruppens median → flaggas.
        const d = w.__state.data, grupper = {};
        d.forEach((r, i) => { const k = `${r.aid}|${r.bas}`; (grupper[k] = grupper[k] || []).push(i); });
        const idx = Object.values(grupper).sort((a, b) => b.length - a.length)[0];
        const loner = idx.map(i => d[i].lon).sort((a, b) => a - b);
        const i = idx[0];
        d[i].lon = Math.floor(loner[loner.length >> 1] * 0.6 / 1000) * 1000 + 437;
        return d[i];
    };
    it('panelen ritas i Lika arbete med demodata, utan §, utan exportknappar', () => {
        const w = createAppWindow();
        oppna(w);
        const host = w.document.getElementById('personer-att-granska');
        expect(host.closest('#view-lika-yrken')).not.toBeNull();
        expect(host.hidden).toBe(false);
        expect(host.textContent).toContain('DEMODATA');
        expect(host.textContent).toContain('En avvikelse är inte i sig osaklig');
        expect(host.textContent).not.toMatch(/§|3 kap\./);
        expect(host.querySelector('[data-csv-table], .table-export-tools, button')).toBeNull();
    });
    it('en sänkt person flaggas med filens radnummer; gränsen ritar om', () => {
        const w = createAppWindow();
        w.__loadDemoData();
        const p = sankEn(w);
        w.document.querySelector('.nav-item[data-tab="matrix"]').click();
        const celler = [...w.document.querySelectorAll('#pag-tabell tbody tr')].map(tr => tr.cells[0].textContent.trim());
        expect(celler).toContain(String(p.radnr));
        const grans = w.document.getElementById('pag-grans');
        grans.value = '30';
        grans.dispatchEvent(new w.Event('input'));
        expect(w.document.getElementById('pag-innehall').textContent).toContain('30 %');
    });
    it('gränsfältet kläms: tomt → 10, 100 → 30, "abc" → 10', () => {
        const w = createAppWindow();
        oppna(w);
        const grans = w.document.getElementById('pag-grans');
        for (const [in_, ut] of [['', '10'], ['100', '30'], ['abc', '10']]) {
            grans.value = in_;
            grans.dispatchEvent(new w.Event('input'));
            expect(w.document.getElementById('pag-innehall').textContent).toContain(`${ut} %`);
        }
    });
    it('Rensa all data tömmer och döljer panelen', () => {
        const w = createAppWindow();
        oppna(w);
        w.__clearAllData();
        expect(w.document.getElementById('personer-att-granska').hidden).toBe(true);
        expect(w.document.getElementById('pag-innehall').textContent.trim()).toBe('');
    });
    it('del C i "Var uppstår löneskillnaden?" länkar till panelen och skrollar fram den', () => {
        const w = createAppWindow();
        w.__loadDemoData();
        const lank = w.document.querySelector('#gap-uppdelning [data-gu-del="C"] [data-go-to-anchor="personer-att-granska"]');
        expect(lank).not.toBeNull();
        let skrollad = false;
        w.document.getElementById('personer-att-granska').scrollIntoView = () => { skrollad = true; };
        lank.click();
        expect(w.document.querySelector('.nav-item.active').dataset.tab).toBe('matrix');
        expect(skrollad).toBe(true);
    });
    it('listan lämnar inte verktyget: den sänkta lönen finns inte i rapportunderlag eller Word-utkast', () => {
        const w = createAppWindow();
        w.__loadDemoData();
        const p = sankEn(w);
        w.document.querySelector('.nav-item[data-tab="matrix"]').click();
        expect(w.__ifFlaggaIndivider(w.__getData(), { minGrupp: w.__K }).flaggade.some(f => f.radnr === p.radnr)).toBe(true);
        const norm = s => String(s).replace(/[\s  ]/g, '');
        const kanaler = {
            rapportunderlag: w.__rapportunderlagBlock().map(b => w.__ruTillText(b)).join('\n'),
            word: w.__docDraftHtml(),   // utskriften ritas ur samma modell
        };
        for (const [namn, text] of Object.entries(kanaler)) expect(norm(text), namn).not.toContain(String(p.lon));
    });
    it('över 200 flaggade: de 200 största visas, "Visa alla" ritar resten', () => {
        const w = createAppWindow();
        const rader = [];
        for (let i = 0; i < 400; i++) rader.push({ bas: 'B', kon: i % 2 ? 'man' : 'kvinna', lon: 30000, alder: 40, aid: '5301', yrke: '5301 Undersköterska', enhet: '', radnr: i + 2 });
        for (let i = 0; i < 250; i++) rader.push({ bas: 'B', kon: i % 2 ? 'man' : 'kvinna', lon: 20000 + i, alder: 40, aid: '5301', yrke: '5301 Undersköterska', enhet: '', radnr: 500 + i });
        w.__state.data = rader;
        w.eval('populateSelects(); unlockTabs();');
        w.__renderTabContent('matrix');
        expect(w.document.querySelectorAll('#pag-tabell tbody tr')).toHaveLength(200);
        const knapp = w.document.getElementById('pag-visa-alla');
        expect(knapp.textContent).toContain('250');
        knapp.click();
        expect(w.document.querySelectorAll('#pag-tabell tbody tr')).toHaveLength(250);
    });
    it('"Vad lagras?" redovisar fältet radnr', () => {
        const w = createAppWindow();
        w.__loadDemoData();
        w.eval('openDataResidency()');
        const t = w.document.getElementById('data-residency-content').textContent;
        expect(t).toContain('radnr');
        expect(t).toContain('radnummer i lönefilen');
    });
    it('#pag-tabell nämns bara av panelens modul, index.html och stilmallen', async () => {
        const { readFileSync, readdirSync } = await import('node:fs');
        const { join, dirname } = await import('node:path');
        const { fileURLToPath } = await import('node:url');
        const app = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'app');
        const traffar = readdirSync(app).filter(f => f.endsWith('.js') && readFileSync(join(app, f), 'utf8').includes('pag-tabell'));
        expect(traffar).toEqual(['43-personer-att-granska.js']);
    });
});

describe('dolda grupper, belopp, radslut och gränsfältet', () => {
    const rad = (bas, kon, lon, aid) => ({ bas, kon, lon, alder: 40, aid, yrke: aid, enhet: '' });
    const flera = (n, ...a) => Array.from({ length: n }, () => rad(...a));
    it('dolda grupper redovisas med antal, aldrig med belopp; reserven visar bara hela skillnaden', () => {
        const w = createAppWindow();
        const bakgrund = [...flera(30, 'E', 'kvinna', 28000, 'E1'), ...flera(12, 'E', 'man', 29500, 'E1'),
            ...flera(12, 'F', 'kvinna', 33000, 'F1'), ...flera(30, 'F', 'man', 35500, 'F1'),
            ...flera(25, 'G', 'kvinna', 38000, 'G1'), ...flera(15, 'G', 'man', 41000, 'G1')];
        w.__state.data = [...flera(20, 'A', 'kvinna', 30000, 'A1'), ...flera(20, 'A', 'man', 31000, 'A1'),
            ...flera(5, 'C', 'kvinna', 50000, 'C1'), ...flera(3, 'C', 'man', 60000, 'C1'), ...bakgrund];
        w.eval('populateSelects(); unlockTabs(); renderGapUppdelning();');
        const ovriga = [...w.document.querySelectorAll('#gap-uppdelning .gu-ovriga')].map(li => li.textContent);
        expect(ovriga.length).toBeGreaterThan(0);
        for (const t of ovriga) { expect(t).not.toMatch(/kr/); expect(t).toMatch(/färre än 10 personer ingår i summan/); }
        w.__state.data = [...flera(20, 'A', 'kvinna', 30000, 'A1'), ...flera(20, 'A', 'man', 31000, 'A1'),
            ...flera(5, 'C', 'kvinna', 50000, 'C1'), ...flera(3, 'C', 'man', 60000, 'C1')];
        w.eval('renderGapUppdelning();');
        const kort = w.document.getElementById('gap-uppdelning-innehall');
        expect(kort.querySelectorAll('.gu-rad')).toHaveLength(0);
        expect(kort.textContent).toMatch(/delas inte upp/);
    });
    it('belopp som avrundas till noll visas utan tecken', () => {
        const w = createAppWindow();
        expect(w.eval('_guKr(-0.3)')).toBe('0 kr');
        expect(w.eval('_guKr(0.4)')).toBe('0 kr');
        expect(w.eval('_guKr(-12)')).toBe('−12 kr');
    });
    it('kortet förklarar beloppens tecken', () => {
        const w = createAppWindow();
        w.__loadDemoData();
        expect(w.document.getElementById('gap-uppdelning').textContent).toContain('Positiva belopp betyder att männens medellön är högre');
    });
    it('CSV med bara CR som radslut får radnummer', async () => {
        const { readFileSync } = await import('node:fs');
        const { join, dirname } = await import('node:path');
        const { fileURLToPath } = await import('node:url');
        const w = createAppWindow();
        w.eval(readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'vendor', 'papaparse.min.js'), 'utf8'));
        const rader = ['BAS;Månadslön;Ålder;Kön;AID', 'A;30000;40;Kvinna;5301', 'A;31000;41;Man;5301'];
        w.loadStructureFile(new w.File([rader.join('\r')], 'p.csv', { type: 'text/csv' }));
        for (let i = 0; i < 100 && !w.__state.data.length; i++) await new Promise(r => setTimeout(r, 20));
        expect(w.__state.data.map(r => r.radnr)).toEqual([2, 3]);
    });
    it('gränsfältet visar det värde som används när man lämnar det', () => {
        const w = createAppWindow();
        w.__loadDemoData();
        w.document.querySelector('.nav-item[data-tab="matrix"]').click();
        const g = w.document.getElementById('pag-grans');
        for (const [in_, ut] of [['100', '30'], ['2', '5'], ['', '10'], ['abc', '10']]) {
            g.value = in_;
            g.dispatchEvent(new w.Event('change'));
            expect(g.value).toBe(ut);
        }
    });
});

describe('stabilitet i Lika arbete', () => {
    it('varje flaggad rad har märkningen, noten förklarar, ingen §', () => {
        const w = createAppWindow();
        w.__loadDemoData();
        w.document.querySelector('.nav-item[data-tab="matrix"]').click();
        const tabell = w.document.getElementById('matrix-table');
        const flaggade = [...tabell.querySelectorAll('tbody tr')].filter(tr => tr.textContent.includes('Värt att granska'));
        expect(flaggade.length).toBeGreaterThan(0);
        for (const tr of flaggade) expect(tr.querySelector('.la-stabilitet')?.textContent).toMatch(/^(Skör|Stabil|Kan inte prövas)/);
        expect(tabell.textContent).toContain('Skör betyder att skillnaden kan hamna på 5 % eller under');
        // Exporten läser cellens text: status och märkning ska inte flyta ihop.
        for (const tr of flaggade) expect(w._tableCellText ? w._tableCellText(tr.cells[tr.cells.length - 1]) : tr.textContent).not.toMatch(/\)(Skör|Stabil|Kan)/);
        expect(JSON.stringify(w.__tableToMatrix('matrix-table'))).not.toMatch(/5%\)(Skör|Stabil|Kan)/);
        expect(tabell.textContent).not.toMatch(/§|3 kap\./);
    });
});

describe('Lägre krav, högre lön', () => {
    const grupp = (aid, bas, kv, ma, lon) => [
        ...Array.from({ length: kv }, (_, i) => ({ aid, bas, lon: lon + i * 10, alder: 40, kon: 'kvinna', yrke: `${aid} Yrke`, yrkeLabel: `Yrke ${aid}`, enhet: '' })),
        ...Array.from({ length: ma }, (_, i) => ({ aid, bas, lon: lon + i * 10, alder: 40, kon: 'man', yrke: `${aid} Yrke`, yrkeLabel: `Yrke ${aid}`, enhet: '' })),
    ];
    const oppna = (w, data) => {
        w.__state.data = data;
        if (w.__state.likvardighet) w.__state.likvardighet.result = null;
        w.eval('populateSelects(); unlockTabs();');
        w.__renderTabContent('likvardighet');
    };
    it('avsnittet ritas med paret, utan §; blocket kommer efter Likvärdigt arbete', () => {
        const w = createAppWindow();
        oppna(w, [...grupp('100', 'E', 18, 2, 30000), ...grupp('200', 'C', 2, 18, 34000), ...grupp('300', 'C', 10, 10, 31000)]);
        const sek = w.document.getElementById('likvardighet-lagre-krav');
        expect(sek).not.toBeNull();
        expect(sek.textContent).toContain('Lägre krav, högre lön');
        expect(w.document.querySelectorAll('#likvardighet-lagre-krav-table tbody tr')).toHaveLength(1);
        expect(sek.textContent).not.toMatch(/§|3 kap\./);
        const ids = w.__rapportunderlagBlock().map(b => b.id);
        expect(ids.indexOf('lagreKrav')).toBe(ids.indexOf('likvardigt') + 1);
    });
    it('utan par: förklarande rad', () => {
        const w = createAppWindow();
        oppna(w, [...grupp('100', 'C', 18, 2, 30000), ...grupp('200', 'E', 2, 18, 34000)]);
        expect(w.document.getElementById('likvardighet-lagre-krav').textContent).toContain('Inget kvinnodominerat yrke har lägre medianlön än ett yrke i lägre BAS.');
    });
    it('demodatan: kandidatparen finns kvar och lagreKrav är en lista', () => {
        // Att dagens par är oförändrade vaktas av lib-testet och golden-facit.
        const w = createAppWindow();
        w.__loadDemoData();
        const r = w.__computeLikvardighetPairs();
        expect(r.pairs.length).toBeGreaterThan(0);
        expect(Array.isArray(r.lagreKrav)).toBe(true);
    });
});

describe('kvartiler utan enskilda löner', () => {
    it('Struktur visar inte organisationens lägsta eller högsta lön', () => {
        const w = createAppWindow();
        const rader = [];
        for (let i = 0; i < 40; i++) rader.push({ bas: 'ABCD'[i % 4], kon: i % 2 ? 'man' : 'kvinna', lon: 30000 + i * 100, alder: 40, yrke: '100 Yrke', aid: '100', yrkeLabel: 'Yrke', enhet: '' });
        rader.push({ bas: 'A', kon: 'kvinna', lon: 11111, alder: 30, yrke: '100 Yrke', aid: '100', yrkeLabel: 'Yrke', enhet: '' });
        rader.push({ bas: 'D', kon: 'man', lon: 99999, alder: 60, yrke: '100 Yrke', aid: '100', yrkeLabel: 'Yrke', enhet: '' });
        w.__state.data = rader;
        w.eval('populateSelects(); unlockTabs();');
        w.__renderTabContent('struktur');
        const t = w.document.getElementById('struktur-eu').textContent.replace(/(\d)[\s\u00a0\u202f](?=\d)/g, '$1');
        expect(t).toContain('upp till');
        expect(t).not.toContain('11111');
        expect(t).not.toContain('99999');
    });
});

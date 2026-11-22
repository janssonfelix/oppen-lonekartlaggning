/**
 * Röktest (jsdom): Flikarnas form, inläsning, Personer att granska och Lika arbete.
 *
 * Utbrutet ur smoke.test.js så att Vitest fördelar röktesterna över flera arbetare; varje describe-block
 * skapar sina egna fönster via createAppWindow (tests/helpers/app-harness.js).
 */
import { describe, it, expect } from 'vitest';
import { createAppWindow } from './helpers/app-harness.js';

describe('Var uppstår löneskillnaden?', () => {
    it('ritas med demodata: tre delar, demomärkning, noten om rangordning', () => {
        const w = createAppWindow();
        w.__loadDemoData(); w.__renderTabContent('struktur');
        const host = w.document.getElementById('gap-uppdelning');
        expect(host.hidden).toBe(false);
        expect(host.querySelectorAll('[data-gu-del]').length).toBe(3);
        expect(host.textContent).toContain('DEMODATA');
        expect(host.textContent).toContain('kan därför skilja sig från de flaggade AID-etiketterna i Lika arbete');
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
    it('ett kön under k i urvalet (i exportläget): "För få personer", inga belopp', () => {
        const w = createAppWindow();
        w.__loadDemoData();
        w.__state.data = w.__state.data.filter((r, i) => r.kon.includes('kvinna') || i % 50 === 0).slice(0, 200);
        w.__state.kLage = 'export';
        w.eval('renderGapUppdelning()');
        const t = w.document.getElementById('gap-uppdelning-innehall').textContent;
        expect(t).toContain('För få personer för att dela upp skillnaden');
        expect(w.document.querySelectorAll('#gap-uppdelning [data-gu-del]').length).toBe(0);
    });
    it('noten om små grupper står bara när tröskeln är större än 1 (skärmen har tröskeln 1, ADR-51)', () => {
        const w = createAppWindow();
        w.__loadDemoData();
        const not = () => w.document.getElementById('gap-uppdelning-innehall').textContent.replace(/\s+/g, ' ');
        w.__state.kLage = 'skarm';
        w.eval('renderGapUppdelning()');
        expect(w.eval('kTroskel()')).toBe(1);
        expect(not()).not.toMatch(/färre än 1 person/);
        expect(not()).not.toMatch(/namnges inte/);
        w.__state.kLage = 'export';
        w.eval('renderGapUppdelning()');
        expect(not()).toMatch(new RegExp(`Grupper där ett kön har färre än ${w.eval('kTroskel()')} personer räknas samman med andra grupper och namnges inte\\.`));
    });
    it('AID-namn kodas', () => {
        const w = createAppWindow();
        w.__loadDemoData();
        w.__state.data = w.__state.data.map(r => ({ ...r, aid: '<b>&"x' }));
        w.eval('renderGapUppdelning()');
        expect(w.document.querySelector('#gap-uppdelning b')).toBeNull();
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
        expect(tabell.textContent).toContain('Skör betyder att skillnaden kan hamna under 3 % (statusens storleksgräns)');
        expect(tabell.textContent).toContain('Den är inte en bedömning.');
        // Exporten läser cellens text: status och märkning ska inte flyta ihop.
        for (const tr of flaggade) expect(w._tableCellText ? w._tableCellText(tr.cells[tr.cells.length - 1]) : tr.textContent).not.toMatch(/\)(Skör|Stabil|Kan)/);
        expect(JSON.stringify(w.__tableToMatrix('matrix-table'))).not.toMatch(/%\)(Skör|Stabil|Kan)/);
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
        // Med minsta gap 0 % som standard (ADR-61) står också det blandade yrket 300 (ca 3 % högre) med.
        expect(w.document.querySelectorAll('#likvardighet-lagre-krav-table tbody tr')).toHaveLength(2);
        expect(sek.textContent).not.toMatch(/§|3 kap\./);
        const ids = w.__rapportunderlagBlock().map(b => b.id);
        expect(ids.indexOf('lagreKrav')).toBe(ids.indexOf('likvardigt') + 1);
    });
    it('grundvyn: BAS står under etiketterna och BAS-steg bakom Fler kolumner; exporten har alla tio kolumner (F14)', () => {
        const w = createAppWindow();
        oppna(w, [...grupp('100', 'E', 18, 2, 30000), ...grupp('200', 'C', 2, 18, 34000), ...grupp('300', 'C', 10, 10, 31000)]);
        const id = 'likvardighet-lagre-krav-table';
        const synliga = () => [...w.document.querySelectorAll(`#${id} thead th`)].filter(th => !th.hidden && !th.classList.contains('bara-export')).map(th => th.textContent.trim());
        expect(synliga()).toEqual(['Kvinnodominerad AID-etikett', 'Median', 'Jämförelseetikett', 'Median', 'Skillnad (kr)', 'Skillnad (%)', '95 % KI']);
        const rad = w.document.querySelector(`#${id} tbody tr`);
        const celler = [...rad.children].filter(td => !td.hidden && !td.classList.contains('bara-export'));
        expect(celler[0].querySelector('small.lv-under').textContent).toBe('BAS E');
        expect(celler[2].querySelector('small.lv-under').textContent).toBe('BAS C');
        // Växeln visar BAS-steg; BAS står kvar under etiketterna och aldrig som egen kolumn på skärmen.
        w.document.querySelector(`[data-fler-kolumner="${id}"]`).click();
        expect(synliga()).toEqual(['Kvinnodominerad AID-etikett', 'Median', 'Jämförelseetikett', 'Median', 'BAS-steg', 'Skillnad (kr)', 'Skillnad (%)', '95 % KI']);
        // Exporten: samma tio kolumner som före, och etikettcellen utan BAS-texten.
        const m = w.__tableToMatrix(id);
        expect(m[0]).toEqual(['Kvinnodominerad AID-etikett', 'BAS', 'Median', 'Jämförelseetikett', 'BAS', 'Median', 'BAS-steg', 'Skillnad (kr)', 'Skillnad (%)', '95 % KI']);
        expect(m[1].slice(0, 2)).toEqual(['Yrke 100', 'E']);
        expect(m[1][4]).toBe('C');
        // Sorteringen på jämförelsens median läser cellens data-sort-value, som förut.
        const kol = [...w.document.querySelectorAll(`#${id} thead th`)].map(th => th.textContent.trim()).lastIndexOf('Median');
        w.document.querySelectorAll(`#${id} thead th`)[kol].click();
        const medianer = [...w.document.querySelectorAll(`#${id} tbody tr`)].map(tr => +tr.children[kol].getAttribute('data-sort-value'));
        expect(medianer).toEqual([...medianer].sort((a, b) => a - b));
    });
    it('utan par: förklarande rad', () => {
        const w = createAppWindow();
        oppna(w, [...grupp('100', 'C', 18, 2, 30000), ...grupp('200', 'E', 2, 18, 34000)]);
        expect(w.document.getElementById('likvardighet-lagre-krav').textContent).toContain('Ingen av de kvinnodominerade AID-etiketterna har lägre medianlön än en AID-etikett i lägre BAS.');
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

describe('Poängläget: texterna i Likvärdigt arbete säger inte BAS-intervall', () => {
    const grupp = (aid, bas, kv, ma, lon) => [
        ...Array.from({ length: kv }, (_, i) => ({ aid, bas, lon: lon + i * 10, alder: 40, kon: 'kvinna', yrke: `${aid} Yrke`, yrkeLabel: `Yrke ${aid}`, enhet: '' })),
        ...Array.from({ length: ma }, (_, i) => ({ aid, bas, lon: lon + i * 10, alder: 40, kon: 'man', yrke: `${aid} Yrke`, yrkeLabel: `Yrke ${aid}`, enhet: '' })),
    ];
    // Den kvinnodominerade 100 i BAS E och den mansdominerade 200 i BAS C: ett par över BAS-gränsen bara med poäng.
    const oppna = (poang) => {
        const w = createAppWindow();
        w.__state.data = [...grupp('100', 'E', 18, 2, 30000), ...grupp('200', 'C', 2, 18, 34000)];
        w.__state.arbetsvardering = poang ? { byKey: new Map([['100', 500], ['200', 480]]), count: 2, hasBas: false } : null;
        if (w.__state.likvardighet) w.__state.likvardighet.result = null;
        w.eval('populateSelects(); unlockTabs();');
        w.__renderTabContent('likvardighet');
        return w;
    };
    const text = el => el.textContent.replace(/\s+/g, ' ');
    const flikIntro = w => [...w.document.querySelectorAll('.flik-intro')].find(e => e.textContent.includes('Lika lön för jobb som är lika mycket värda'));

    it('inledningen gäller båda måtten på kraven', () => {
        const w = oppna(false);
        expect(text(flikIntro(w))).toContain('Här jämför verktyget kvinnodominerade AID-etiketter med AID-etiketter som inte är kvinnodominerade och har likvärdiga krav. Kraven mäts med BAS-intervallet, eller med poängen om organisationen har en arbetsvärdering.');
    });
    it('med poäng: bakgrunden, Lägre krav, märket och beräkningsbeviset nämner inte BAS som mått', () => {
        const w = oppna(true);
        const r = w.eval('likvardighetResultat()');
        expect(r.pairs).toHaveLength(1);
        const innehall = text(w.document.getElementById('likvardighet-content'));
        expect(innehall).toContain('därför jämförs organisationens egna AID-etiketter med varandra; jämförelsestatistiken har inga poäng och används inte.');
        expect(innehall).not.toContain('i första hand organisationens egna');
        const lagre = text(w.document.getElementById('likvardighet-lagre-krav'));
        expect(lagre).not.toContain('BAS används som mått på krav');
        expect(lagre).toContain('Med arbetsvärderingspoäng jämförs AID-etiketter redan över BAS-gränserna');
        const under = [...w.document.querySelectorAll('#likvardighet-table .lv-under')].map(e => e.textContent);
        expect(under.length).toBeGreaterThan(0);
        expect(under.some(t => /intern/.test(t))).toBe(false);
        const intro = w.eval('_evidenceForLikvardighetPair')(r.pairs[0]).intro;
        expect(intro).toContain('som enligt arbetsvärderingen har <em>lika eller lägre krav</em> (480 poäng mot 500)');
        expect(intro).not.toContain('samma BAS-intervall');
    });
    it('utan poäng: BAS-texterna står kvar', () => {
        const w = oppna(false);
        const innehall = text(w.document.getElementById('likvardighet-content'));
        expect(innehall).toContain('därför jämförs i första hand organisationens egna AID-etiketter med varandra.');
        expect(text(w.document.getElementById('likvardighet-lagre-krav'))).toContain('BAS används som mått på krav');
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

// ===================================================================================
// ADR-65: Var uppstår löneskillnaden med valbara förklaringsvariabler. Valet, tangentbordet och ARIA, texterna,
// konfigurationsfilen, Rensa all data, rapportunderlaget och metodbilagan.
// ===================================================================================
describe('Var uppstår löneskillnaden: valbara förklaringsvariabler (ADR-65)', () => {
    const demo = () => { const w = createAppWindow(); w.__loadDemoData(); w.document.querySelector('.nav-item[data-tab="struktur"]').click(); return w; };
    const kort = w => w.document.getElementById('gap-uppdelning');
    const rutor = w => [...kort(w).querySelectorAll('.gu-val input[data-gu-var]')];
    const valda = w => rutor(w).filter(r => r.checked).map(r => r.getAttribute('data-gu-var'));
    const kryssa = (w, v) => { const r = kort(w).querySelector(`input[data-gu-var="${v}"]`); r.checked = !r.checked; r.dispatchEvent(new w.Event('change', { bubbles: true })); };
    const delnamn = w => [...kort(w).querySelectorAll('[data-gu-del] .gu-rubrik strong')].map(e => e.textContent);
    const u = w => w.eval('_guGapUppdelning(getData(), { k: kTroskel(), variabler: gapVariabler() })');
    const bevaka = w => { w.eval(`window.__fel = []; { const rf = rapporteraFel; rapporteraFel = function (plats, e) { window.__fel.push(plats + ': ' + (e && e.message)); return rf(plats, e); }; }
        { const ce = console.error; console.error = function (...a) { window.__fel.push(a.join(' ')); return ce.apply(console, a); }; }`); return w; };

    it('standardvalet: BAS och AID i den ordningen, dagens delar och texter, ingen återställning', () => {
        const w = demo();
        expect(kort(w).querySelector('.gu-val legend').textContent).toBe('Förklara med:');
        expect(valda(w)).toEqual(['bas', 'aid']);
        expect(rutor(w).map(r => r.getAttribute('data-gu-var'))).toEqual(['bas', 'aid', 'sektor', 'aidniva', 'alder']);
        expect(delnamn(w)).toEqual(['A. BAS-fördelning', 'B. AID inom BAS', 'C. Oförklarat: lön inom samma AID och BAS']);
        const text = [...kort(w).querySelectorAll('.gu-text')].map(p => p.textContent);
        expect(text[0]).toContain('Kvinnor och män är olika fördelade över BAS-intervallen. Hör till karriärvägar och rekrytering');
        expect(text[1]).toContain('Kvinnor och män har olika AID inom samma BAS. Kan kräva en lönesatsning på AID-etiketten');
        expect(text[2]).toContain('räknas i stället till delarna ovan. Pröva lika arbete');
        expect(kort(w).querySelector('[data-gu-standard]')).toBeNull();
        expect(kort(w).textContent).toContain('Ordningen påverkar delarna: den första variabeln får det den förklarar ensam');
        expect(w.__state.gapUppdelning).toBeNull();
    });
    it('röktest: AID bort och åldersgrupp till; delarna summerar till hela skillnaden, inga fel', () => {
        const w = bevaka(demo());
        kryssa(w, 'aid');
        expect(valda(w)).toEqual(['bas']);
        expect(delnamn(w)).toEqual(['A. BAS-fördelning', 'B. Oförklarat: lön inom samma BAS']);
        kryssa(w, 'alder');
        expect(valda(w)).toEqual(['bas', 'alder']);
        expect(JSON.parse(JSON.stringify(w.__state.gapUppdelning))).toEqual({ variabler: ['bas', 'alder'] });
        expect(delnamn(w)).toEqual(['A. BAS-fördelning', 'B. Åldersgrupp inom BAS', 'C. Oförklarat: lön inom samma åldersgrupp och BAS']);
        const r = u(w);
        expect(Math.abs(r.delar.A + r.delar.B + r.delar.C - r.gap)).toBeLessThan(1e-6);
        // Trappan har lika många staplar som delar, och fokus står kvar på rutan.
        const f = w.document.getElementById('chart-gap-uppdelning')._figur;
        expect(f.x.ordning).toEqual(['Hela skillnaden', 'A. BAS-fördelning', 'B. Åldersgrupp inom BAS', 'C. Oförklarat: lön inom samma åldersgrupp och BAS']);
        expect(f.beskrivning).toContain('sedan tre delar som tillsammans blir hela skillnaden, en i taget från hela skillnaden mot noll: BAS-fördelning, åldersgrupp inom BAS och lön inom samma åldersgrupp och BAS.');
        expect(w.document.activeElement.getAttribute('data-gu-var')).toBe('alder');
        // Länken för åldersgruppens del går till Ålder & karriär.
        expect(kort(w).querySelector('[data-gu-del="B"] [data-go-to-tab="kon"]')).not.toBeNull();
        expect(w.eval('window.__fel')).toEqual([]);
    });
    it('upp och ner: knapparna har namn, är avstängda i ändarna och behåller fokus', () => {
        const w = demo();
        kryssa(w, 'alder');
        expect(valda(w)).toEqual(['bas', 'aid', 'alder']);
        const knapp = (v, s) => kort(w).querySelector(`[data-gu-rad="${v}"] [data-gu-flytta="${s}"]`);
        expect(knapp('bas', -1).disabled).toBe(true);
        expect(knapp('alder', 1).disabled).toBe(true);
        expect(knapp('alder', -1).getAttribute('aria-label')).toBe('Flytta upp: Åldersgrupp');
        expect(knapp('aid', 1).getAttribute('aria-label')).toBe('Flytta ned: AID');
        knapp('alder', -1).click();
        expect(valda(w)).toEqual(['bas', 'alder', 'aid']);
        expect(w.document.activeElement).toBe(knapp('alder', -1));
        knapp('alder', -1).click();
        expect(valda(w)).toEqual(['alder', 'bas', 'aid']);
        // Knappen är nu avstängd: fokus går till rutan för samma variabel.
        expect(w.document.activeElement.getAttribute('data-gu-var')).toBe('alder');
        expect(delnamn(w)).toEqual(['A. Åldersfördelning', 'B. BAS inom åldersgrupp', 'C. AID inom BAS och åldersgrupp', 'D. Oförklarat: lön inom samma AID, BAS och åldersgrupp']);
        expect(kort(w).querySelector('.gu-val-lista').getAttribute('aria-describedby')).toBe('gu-val-hjalp');
        // Återställ standard.
        kort(w).querySelector('[data-gu-standard]').click();
        expect(valda(w)).toEqual(['bas', 'aid']);
        expect(w.__state.gapUppdelning).toBeNull();
    });
    it('1–4 variabler: den sista valda kan inte kryssas ur, och vid fyra kan ingen fler kryssas i', () => {
        const w = demo();
        kryssa(w, 'aid');
        expect(kort(w).querySelector('input[data-gu-var="bas"]').disabled).toBe(true);
        kryssa(w, 'sektor'); kryssa(w, 'aidniva'); kryssa(w, 'alder');
        expect(valda(w)).toEqual(['bas', 'sektor', 'aidniva', 'alder']);
        expect(kort(w).querySelector('input[data-gu-var="aid"]').disabled).toBe(true);
        expect(kort(w).querySelectorAll('[data-gu-del]')).toHaveLength(5);
    });
    it('AID-nivåerna: en flytt som skulle ställa en finare nivå före en grövre är avstängd', () => {
        const w = demo();
        kryssa(w, 'sektor');
        expect(valda(w)).toEqual(['bas', 'sektor', 'aid']);
        expect(kort(w).querySelector('[data-gu-rad="aid"] [data-gu-flytta="-1"]').disabled).toBe(true);
        expect(kort(w).querySelector('[data-gu-rad="sektor"] [data-gu-flytta="1"]').disabled).toBe(true);
        expect(kort(w).querySelector('[data-gu-rad="sektor"] [data-gu-flytta="-1"]').disabled).toBe(false);
    });
    it('utan ålder i lönefilen erbjuds inte åldersgrupp, och ett sparat val med åldersgrupp räknas utan den', () => {
        const w = createAppWindow();
        w.__loadDemoData();
        w.__state.data = w.__state.data.map(r => ({ ...r, alder: 0 }));
        w.__state.gapUppdelning = { variabler: ['bas', 'alder', 'aid'] };
        w.eval('invalidateStatCaches(); renderGapUppdelning()');
        expect(rutor(w).map(r => r.getAttribute('data-gu-var'))).not.toContain('alder');
        expect(valda(w)).toEqual(['bas', 'aid']);
        expect(delnamn(w)).toEqual(['A. BAS-fördelning', 'B. AID inom BAS', 'C. Oförklarat: lön inom samma AID och BAS']);
    });
    it('konfigurationsfilen fram och tillbaka; en äldre fil utan fältet ger standard; ogiltigt ger varning', () => {
        const w = demo();
        kryssa(w, 'alder');
        const cfg = JSON.parse(JSON.stringify(w.__buildConfigSnapshot()));
        expect(cfg.gapUppdelning).toEqual({ variabler: ['bas', 'aid', 'alder'] });
        const w2 = createAppWindow(); w2.__loadDemoData();
        w2.__cfg = cfg; w2.eval('window.__svar = applyConfigSnapshot(window.__cfg)');
        expect(JSON.parse(JSON.stringify(w2.__state.gapUppdelning))).toEqual({ variabler: ['bas', 'aid', 'alder'] });
        // Standardvalet sparas som null.
        expect(JSON.parse(JSON.stringify(demo().__buildConfigSnapshot())).gapUppdelning).toBeNull();
        // En fil från v2 (utan fältet) ger standard, också när ett val var gjort.
        const aldre = { ...cfg }; delete aldre.gapUppdelning;
        w2.__cfg = aldre; w2.eval('window.__svar = applyConfigSnapshot(window.__cfg)');
        expect(w2.__state.gapUppdelning).toBeNull();
        expect(w2.eval('window.__svar.varningar').join(' ')).not.toMatch(/Uppdelningen/);
        w2.__cfg = { ...cfg, gapUppdelning: { variabler: 'fel' } }; w2.eval('window.__svar = applyConfigSnapshot(window.__cfg)');
        expect(w2.__state.gapUppdelning).toBeNull();
        expect(w2.eval('window.__svar.varningar').join(' ')).toContain('Uppdelningens variabler gick inte att läsa');
    });
    it('Rensa all data nollställer valet', () => {
        const w = demo();
        kryssa(w, 'alder');
        expect(w.__state.gapUppdelning).not.toBeNull();
        w.__clearAllData();
        expect(w.__state.gapUppdelning).toBeNull();
    });
    it('rapportunderlaget och metodbilagan följer valet och nämner variablerna; standardvalet ger dagens text', () => {
        const w = demo();
        const block = () => w.__rapportunderlagBlock().find(b => b.id === 'uppdelning');
        const metod = () => w.__methodAppendixData().map(r => r.join(': ')).join('\n');
        const std = block();
        expect(std.stycken.join(' ')).toMatch(/på att kvinnor och män är olika fördelade över BAS, .* på olika AID inom samma BAS och .* på löneskillnader inom samma AID och BAS\./);
        expect(std.stycken.join(' ')).not.toContain('Uppdelningen förklarar med');
        expect(metod()).not.toContain('Var uppstår löneskillnaden');
        kryssa(w, 'aid'); kryssa(w, 'alder');
        const b = block();
        expect(b.stycken.join(' ')).toContain('Uppdelningen förklarar med variablerna BAS och åldersgrupp, i den ordningen.');
        expect(b.stycken.join(' ')).toMatch(/på att kvinnor och män är olika fördelade över BAS, .* på olika ålder inom samma BAS och .* på löneskillnader inom samma åldersgrupp och BAS\./);
        expect(b.tabell.rader.map(r => r[0])).toEqual(['BAS-fördelning', 'Åldersgrupp inom BAS', 'Oförklarat: lön inom samma åldersgrupp och BAS', 'Totalt']);
        expect(metod()).toContain('Var uppstår löneskillnaden (variabler): Skillnaden i medellön delas med BAS och åldersgrupp, i den ordningen');
        // Word-utkastet (rapportmodellen) bär metodbilagan.
        expect(w.__docDraftHtml()).toContain('Skillnaden i medellön delas med BAS och åldersgrupp');
    });
    it('fungerar vid 375 punkter: listan bryter rader och har inga fasta bredder', async () => {
        // jsdom ritar ingen layout; här prövas att reglerna finns (det riktiga måttet tas i webbläsarröktestet).
        const { readFileSync } = await import('node:fs');
        const css = readFileSync(new URL('../src/style.css', import.meta.url), 'utf8');
        expect(css).toMatch(/\.gu-val-lista \.urval-rad\s*\{[^}]*flex-wrap:\s*wrap/);
        expect(css).toMatch(/\.gu-val\s*\{[^}]*min-width:\s*0/);
    });
});

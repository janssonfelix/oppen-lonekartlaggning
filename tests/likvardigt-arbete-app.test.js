// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
// Likvärdigt arbete i appen: Lägre krav, högre lön, poängläget, BAS-ordningen, kandidatparen och deras tabell och bild,
// att paren räknas en gång per underlag, den nationella reserven och Krav mot lön.
import { describe, it, expect, beforeAll } from 'vitest';
import { createAppWindow } from './helpers/app-harness.js';
import { laddaXlsx } from './helpers/ktroskel-rigg.js';
import { las } from './helpers/granssnitt-rigg.js';

let win;

beforeAll(() => {
    win = createAppWindow();
});

describe('Lägre krav, högre lön', () => {
    const grupp = (aid, bas, kv, ma, lon) => [
        ...Array.from({ length: kv }, (_, i) => ({ aid, bas, lon: lon + i * 10, alder: 40, kon: 'kvinna', yrke: `${aid} Yrke`, yrkeLabel: `Yrke ${aid}`, enhet: '' })),
        ...Array.from({ length: ma }, (_, i) => ({ aid, bas, lon: lon + i * 10, alder: 40, kon: 'man', yrke: `${aid} Yrke`, yrkeLabel: `Yrke ${aid}`, enhet: '' })),
    ];
    const oppna = (w, data) => {
        w.__state.data = data;
        if (w.__state.likvardighet) w.__state.likvardighet.result = null;
        w.eval('fyllValjare(); lasUppFlikar();');
        w.__ritaFlik('likvardighet');
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
        const m = w.__tabellTillMatris(id);
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
        w.eval('fyllValjare(); lasUppFlikar();');
        w.__ritaFlik('likvardighet');
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
        const intro = w.eval('_bevisForLikvardighetspar')(r.pairs[0]).intro;
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

describe('BAS-ordningen är fast (se §6 i likvardighetsmodellen.md)', () => {
    it('BAS-ordningen har ingen panel, inget tillstånd och inget fält i konfigurationsfilen', () => {
        const w = createAppWindow();
        w.__lasInDemodata();
        expect(w.document.getElementById('bas-rank-config-container')).toBeNull();
        expect('basRankOverride' in w.__state).toBe(false);
        const cfg = w.__byggKonfiguration();
        expect('basRankOverride' in cfg).toBe(false);
    });
    it('robusthetspanelen prövar Likvärdigt arbete och Prioritering, inte BAS-ordningen', async () => {
        const w = createAppWindow();
        w.__lasInDemodata();
        w.__ritaKvalitetssakring();
        w.__korRobusthet();
        await new Promise(r => setTimeout(r, 120));
        const txt = w.document.getElementById('robusthet-body').textContent;
        expect(txt).toMatch(/Likvärdigt arbete|Prioritering/);
        expect(txt).not.toMatch(/Nivåordningen|rangordning/i);
    });
    it('extremvärden i Underlagets kvalitet, organisationspaketet i uppladdningsytan, Spara och jämför år har fyra avsnitt', () => {
        const w = createAppWindow();
        w.__lasInDemodata();
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
        w.__lasInDemodata();
        expect(w.document.getElementById('view-dokumentera').textContent).not.toMatch(/inställningarna som påverkar analysen/);
        const src = require('fs').readFileSync(require('path').join(__dirname, '../src/app/41-lika-arbete.js'), 'utf8');
        const rad = src.split('\n').find(l => l.includes("['BAS-rangordning'"));
        expect(rad).toMatch(/bokstavens plats/);
        expect(rad).toMatch(/även när en bokstav saknas/);
    });
});

describe('demodata med kandidatpar', () => {
    it('demodatan ger minst ett kandidatpar där båda grupperna har minst k personer', () => {
        const w = createAppWindow();
        w.__lasInDemodata();
        const par = w.__likvardighetspar().pairs || [];
        const godkanda = par.filter(p => p.kvN >= w.__K && (p.maN === null || p.maN === undefined || p.maN >= w.__K));
        expect(godkanda.length).toBeGreaterThan(0);
    });
    it('jämförelseyrken är alla som inte är kvinnodominerade: Systemutvecklare (blandad) jämförs i BAS C (ADR-60)', () => {
        const w = createAppWindow();
        w.__lasInDemodata();
        // Systemutvecklare i BAS C (23 kvinnor av 45) är blandad och därmed jämförelseyrke.
        const sysC = w.__likvardighetspar().orgIckeKv.find(g => g.bas === 'C' && /Systemutvecklare/.test(g.label));
        expect(sysC).toMatchObject({ n: 45, nKv: 23, klass: 'blandad' });
        // Standardvärdet är 0 % (ADR-61): utan att användaren ändrat något står fyra par i BAS C, de två kvinnodominerade
        // yrkena mot Drifttekniker och Systemutvecklare — också Undersköterska–Systemutvecklare med under 5 % skillnad.
        expect(w.__state.likvardighet.minGapPct).toBe(0);
        const lv = w.__likvardighetspar();
        const iC = lv.pairs.filter(p => p.kvBas === 'C').map(p => `${p.kvLabel}–${p.maLabel}`).sort();
        expect(iC).toEqual(['Barnskötare–Drifttekniker', 'Barnskötare–Systemutvecklare', 'Undersköterska–Drifttekniker', 'Undersköterska–Systemutvecklare']);
        expect(lv.pairs.find(p => /Systemutvecklare/.test(p.maLabel)).maKlass).toBe('blandad');
        const liten = lv.pairs.find(p => p.kvLabel === 'Undersköterska' && p.maLabel === 'Systemutvecklare');
        expect(liten.gapPct).toBeLessThan(5);
        // Med 5 % som valt filter faller Undersköterska–Systemutvecklare bort.
        w.__state.likvardighet.minGapPct = 5;
        expect(w.__likvardighetspar().pairs.filter(p => p.kvBas === 'C')).toHaveLength(3);
        // Filtret återskapar det tidigare urvalet: bara mansdominerade jämförelseyrken.
        w.__state.likvardighet.jamforelse = 'mansdominerade';
        const ma = w.__likvardighetspar();
        expect(ma.pairs.every(p => p.maKlass === 'mansdominerad')).toBe(true);
        expect(ma.pairs.some(p => /Systemutvecklare/.test(p.maLabel))).toBe(false);
    });
    it('nyckeltalet räknar alla par, varav dem över 5 %, och Visa alla visar paren som Visa max döljer (ADR-61)', () => {
        const w = createAppWindow();
        w.__lasInDemodata();
        const d = w.document;
        d.querySelector('.nav-item[data-tab="likvardighet"]').click();
        const lv = w.__state.likvardighet.result;
        const over = lv.pairs.filter(p => p.kvMedian / p.maMedian <= 0.95 + 1e-12).length;
        expect(lv.parAntal).toMatchObject({ totalt: lv.pairs.length, overDirektiv: over });
        expect(over).toBeLessThan(lv.pairs.length);   // demot har par under 5 %, och de visas
        const ruta = [...d.querySelectorAll('#lv-slutsatser .slutsats')].find(r => r.textContent.includes('Par att titta närmare på'));
        expect(ruta.querySelector('.slutsats-varde').textContent).toBe(String(lv.pairs.length));
        expect(ruta.querySelector('.slutsats-under').textContent).toMatch(new RegExp(`^varav ${over} med ojusterad löneskillnad ≥ 5 %, \\d+ med säker skillnad$`));
        expect(d.getElementById('lv-min-gap').closest('div').textContent).toContain('Visa bara par med minst');
        expect(d.getElementById('lv-min-gap').closest('div').textContent).toContain('% skillnad (0 = alla)');
        expect(d.getElementById('lv-visa-alla')).toBeNull();
        // Visa max under antalet par: tabellen visar de största, knappen visar alla.
        const totalt = lv.pairs.length;
        w.__state.likvardighet.topN = 2;
        w.__state.likvardighet.result = null;
        w.__ritaFlik('likvardighet');
        expect(d.querySelectorAll('#likvardighet-table tbody tr')).toHaveLength(2);
        expect(d.getElementById('nyckel-lv-par').textContent).toBe(`2 av ${totalt} par`);
        expect([...d.querySelectorAll('#lv-slutsatser .slutsats-varde')][2].textContent).toBe(String(totalt));
        d.getElementById('lv-visa-alla').click();
        expect(d.querySelectorAll('#likvardighet-table tbody tr')).toHaveLength(totalt);
        expect(d.getElementById('lv-visa-alla')).toBeNull();
    });
    it('rapportunderlaget får parblock och diagrammet över kandidatpar', () => {
        const w = createAppWindow();
        w.__lasInDemodata();
        w.document.querySelector('.nav-item[data-tab="rapporttext"]').click();
        expect(w.__rapportunderlagBlock().some(b => b.id.startsWith('par:'))).toBe(true);
        expect(w.document.querySelector('[data-rapport-diagram="chart-likvardighet-heatmap"]')).not.toBeNull();
    });
    it('självdiagnostikens testdata är oförändrad (200 personer, BAS A–E)', () => {
        const w = createAppWindow();
        const d = w.eval('genereraTestdata()');
        expect(d.length).toBe(200);
        expect([...new Set(d.map(r => r.bas))].sort()).toEqual(['A', 'B', 'C', 'D', 'E']);
    });
});

// Paren räknas en gång per underlag och val (likvardighetResultat): fliken, Översikt, regler och praxis och protokollet
// läser samma resultat, och varje ändring av något som beräkningen läser nollställer det. På 55 000 rader är en
// beräkning sekunder.
describe('Likvärdigt arbete räknas en gång per underlag', () => {
    // Adaptern likvardighetspar() är den enda som anropar lib (likvardighetsparUr); den räknas.
    const raknaBerakningar = w => w.eval('window.__lvBerakningar = 0; const __lvOrig = likvardighetspar; '
        + 'likvardighetspar = function (o) { window.__lvBerakningar++; return __lvOrig(o); };');
    const flik = (w, f) => w.document.querySelector(`.nav-item[data-tab="${f}"]`).click();
    const demo = () => { const w = createAppWindow(); raknaBerakningar(w); w.__lasInDemodata(); return w; };

    it('inläsningen, varje flik och protokollet för gemensam lönebedömning räknar paren en gång', async () => {
        const w = demo();
        expect(w.__lvBerakningar).toBe(1);
        [...w.document.querySelectorAll('.nav-item[data-tab]')].forEach(b => { if (!b.disabled && !b.hidden) b.click(); });
        flik(w, 'likvardighet');
        expect(w.__lvBerakningar).toBe(1);
        const { readFileSync } = await import('node:fs');
        w.eval(readFileSync(new URL('../vendor/xlsx.mini.min.js', import.meta.url), 'utf8'));
        w.alert = () => {};
        w.XLSX.writeFile = () => {};
        w.eval('exportJPAProtokoll()');
        expect(w.__lvBerakningar).toBe(1);
    });
    // Fältens ändringar i fliken: resultatet nollställs, och det nya räknas med det nya värdet (en gång).
    for (const [id, nyckel, varde] of [['lv-kvinno-thr', 'kvinnoTrosholdPct', 65], ['lv-min-gap', 'minGapPct', 5], ['lv-top-n', 'topN', 10]]) {
        it(`ändrat fält ${id} räknar om paren med det nya värdet`, () => {
            const w = demo();
            flik(w, 'likvardighet');
            const fore = w.__state.likvardighet.result;
            const falt = w.document.getElementById(id);
            falt.value = String(varde);
            falt.dispatchEvent(new w.Event('change'));
            const efter = w.eval('likvardighetResultat()');
            expect(efter).not.toBe(fore);
            expect(efter.opts[nyckel]).toBe(varde);
            expect(w.__lvBerakningar).toBe(2);
        });
    }
    it('Visa alla räknar om paren med alla par', () => {
        const w = demo();
        w.__state.likvardighet.topN = 2;
        w.__state.likvardighet.result = null;
        flik(w, 'likvardighet');
        const fore = w.__state.likvardighet.result;
        const totalt = fore.parAntal.totalt;
        expect(fore.pairs).toHaveLength(2);
        w.document.getElementById('lv-visa-alla').click();
        expect(w.__state.likvardighet.result).not.toBe(fore);
        expect(w.__state.likvardighet.result.pairs).toHaveLength(totalt);
    });
    it('robusthetsprövningen räknar bara de andra kvinnotrösklarna och lämnar flikens resultat orört', () => {
        const w = demo();
        const fore = w.__state.likvardighet.result;
        let skrivningar = 0, troskel = w.__state.likvardighet.kvinnoTrosholdPct;
        Object.defineProperty(w.__state.likvardighet, 'kvinnoTrosholdPct', { configurable: true, get: () => troskel, set: v => { skrivningar++; troskel = v; } });
        w.__robusthetLikvardighet([55, 60, 65]);
        expect(skrivningar).toBe(0);
        expect(w.__lvBerakningar).toBe(3);
        expect(w.__state.likvardighet.result).toBe(fore);
        expect(w.__state.likvardighet.kvinnoTrosholdPct).toBe(60);
    });
    it('definitionen, jämförelsemängden och poängbandet nollställer resultatet', () => {
        const w = demo();
        flik(w, 'likvardighet');
        const andra = (sel, satt) => {
            const fore = w.eval('likvardighetResultat()');
            const el = w.document.getElementById(sel);
            satt(el);
            el.dispatchEvent(new w.Event('change'));
            expect(w.eval('likvardighetResultat()'), sel).not.toBe(fore);
        };
        andra('lv-kv-definition', el => { el.value = 'scb'; });
        andra('lv-bara-mansdominerade', el => { el.checked = true; });
        andra('arbvard-band', el => { el.value = '7'; });
    });
});

describe('visualisering: § 3:10 — kandidatparen som bild + tabellexport', () => {
    it('kandidatparen ritas som ett par per rad med båda medianerna', () => {
        win.__lasInDemodata();
        const pairs = (win.__likvardighetspar() || {}).pairs || [];
        expect(pairs.length).toBeGreaterThan(0);
        win.__pairs = pairs;
        const f = win.eval('_lvParFigur(window.__pairs)');
        expect(f.lager.map(l => l.marke)).toEqual(['intervall', 'punkt', 'punkt']);
        expect(f.y.ordning.length).toBeGreaterThan(0);
        expect(f.y.ordning.length).toBeLessThanOrEqual(Math.min(14, pairs.length));
        for (const d of f.lager[0].data) { expect(Number.isFinite(d.lag) && Number.isFinite(d.hog) && d.hog >= d.lag).toBe(true); }
        expect(f.lager[2].data.every(d => /%$/.test(d.etikett))).toBe(true);      // gapet står vid jämförelseyrket
    });


    it('tabellTillMatris läser rubrik + rader och rensar knappar/ikoner', () => {
        win.__ritaFlik('matrix');   // fyller matrix-table
        const m = win.__tabellTillMatris('matrix-table');
        expect(Array.isArray(m)).toBe(true);
        if (m.length) {
            const cols = m[0].length;
            m.forEach(row => expect(row.length).toBe(cols));   // rektangulär
            // ingen cell innehåller kvarvarande knapptext/emoji-lupp
            expect(m.flat().some(c => c.includes('🔍'))).toBe(false);
        }
    });
});

describe('SKR:s personalstatistik som nationell reserv i Likvärdigt arbete', () => {
    it('klassar per AID-etikett med SKR som källa', () => {
        const w = createAppWindow();
        const k = kod => w.eval(`nationellAidKlass(${JSON.stringify(kod)})`);
        expect(k('521020')).toMatchObject({ klass: 'icke-kvinnodominerat', kalla: expect.stringMatching(/^SKR, personalstatistik november 2025/) });
        expect(k('205010')).toMatchObject({ klass: 'kvinnodominerat' });
        expect(k('101010').kvAndel).toBeCloseTo(48.3, 0);   // etikettens egen andel, inte prefixets
        expect(k('751010')).toBeNull();
    });
});

describe('kandidatparens tabell', () => {
    it('intervallet står som ett spann på en rad med omdömet som märke, och exporten bär formen med klamrar', () => {
        const w = createAppWindow();
        w.__lasInDemodata();
        w.__ritaFlik('likvardighet');
        const d = w.document;
        const ki = [...d.querySelectorAll('#likvardighet-table .lv-ki')];
        expect(ki.length).toBeGreaterThan(0);
        for (const k of ki) {
            expect(k.textContent).toMatch(/^[\d\s\u00a0\u2212-]+–[\d\s\u00a0\u2212-]+ kr$/);
            expect(k.closest('td').querySelector('.lv-ki-marke').textContent).toMatch(/^(säker skillnad|inom slumpfel)$/);
            expect(w.eval('_tabellcellText')(k.closest('td'))).toMatch(/^\[[^\]]+ kr, [^\]]+ kr\]\s?(säker skillnad|inom slumpfel)$/);
        }
        const rubriker = [...d.querySelectorAll('#likvardighet-table thead th')].map(th => th.textContent);
        expect(rubriker).toContain('Summa för gruppen (kr/mån)');
        // Den nationella andelen står i verktygstipset, med källa och period, inte i raden (men följer med i cellens text för exporten).
        const under = d.querySelector('#likvardighet-table .lv-under');
        const synlig = under.cloneNode(true); synlig.querySelectorAll('.bara-export').forEach(e => e.remove());
        expect(synlig.textContent).not.toContain('nationellt');
        expect(under.title).toMatch(/nationellt \(SKR:s personalstatistik, [a-z]+ \d{4}\)/);
        expect(las('src/style.css')).toMatch(/#likvardighet-table td\.t-hoger[^{]*\{ white-space: nowrap; \}/);
    });
    it('ett par under 5 % syns utan att något ändrats, och fältet säger att 0 betyder alla (ADR-61)', () => {
        const w = createAppWindow();
        w.__lasInDemodata();
        w.__ritaFlik('likvardighet');
        const d = w.document;
        expect(w.__state.likvardighet.minGapPct).toBe(0);
        const lv = w.__state.likvardighet.result;
        const smatt = lv.pairs.filter(p => p.gapPct > 0 && p.gapPct < 5);
        expect(smatt.length).toBeGreaterThan(0);
        expect(d.querySelectorAll('#likvardighet-table tbody tr')).toHaveLength(lv.pairs.length);
        expect(d.getElementById('lv-min-gap').closest('div').textContent.replace(/\s+/g, ' ').trim()).toBe('Visa bara par med minst % skillnad (0 = alla)');
    });
});

describe('Krav mot lön med många yrkesgrupper', () => {
    it('grupper i samma BAS-intervall med nästan samma median flyttas isär i sidled; ensamma grupper står i mitten', () => {
        const w = createAppWindow();
        const rader = [];
        const grupp = (aid, bas, median, kvAndel) => { for (let i = 0; i < 30; i++) rader.push({ bas, yrke: `${aid} Yrke ${aid}`, aid: String(aid), kon: i < 30 * kvAndel ? 'kvinna' : 'man', lon: median + (i % 5 - 2) * 100, alder: 30 + i }); };
        grupp(100001, 'B', 30000, 0.8); grupp(100002, 'B', 30050, 0.5); grupp(100003, 'B', 30100, 0.2); grupp(100004, 'B', 36000, 0.5);
        grupp(100005, 'C', 34000, 0.5); grupp(100006, 'D', 42000, 0.5);
        w.__d = rader;
        const f = w.eval('_lvKravFigur(vymodellKravMotLon(window.__d, { k: 10 }))');
        const punkter = f.lager.filter(l => l.marke === 'punkt').flatMap(l => l.data);
        const iB = punkter.filter(p => p.bas === 'B' && p.y < 31000).map(p => p.forskjutning || 0).sort((a, b) => a - b);
        expect(new Set(iB).size).toBe(3);                                   // tre nära varandra: tre filer
        expect(iB.every(v => Math.abs(v) <= 0.36)).toBe(true);              // inom intervallets bredd
        for (const p of punkter.filter(q => q.bas !== 'B' || q.y > 31000)) expect(p.forskjutning).toBeUndefined();
    });
});

describe('Likvärdigt arbete: det sparade resultatet och poängläget', () => {
    it('Rapporttext räknar likvärdighetsparen en gång och sparar resultatet', () => {
        const w = createAppWindow();
        w.__lasInDemodata();
        w.__state.likvardighet.result = null;
        const orig = w.likvardighetspar;
        let n = 0;
        w.likvardighetspar = (...a) => { n++; return orig(...a); };
        w.document.querySelector('.nav-item[data-tab="rapporttext"]').click();
        w.__rapportunderlagBlock();
        w.eval('_handlingsplanForifyllning()');
        expect(n).toBe(1);
        expect(w.__state.likvardighet.result).toBeTruthy();
    });
    it('ny jämförelsestatistik nollställer det sparade likvärdighetsresultatet', async () => {
        const w = createAppWindow();
        w.__lasInDemodata();
        const { readFileSync } = await import('node:fs');
        const { join, dirname } = await import('node:path');
        const { fileURLToPath } = await import('node:url');
        w.eval(readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'vendor', 'papaparse.min.js'), 'utf8'));
        const sentinel = { pairs: [], sentinel: true };
        w.__state.likvardighet.result = sentinel;
        const input = w.document.getElementById('file-input-stat');
        const fil = new w.File(['AID;BAS;Median\n5301;C;30000\n'], 'statistik.csv', { type: 'text/csv' });
        Object.defineProperty(input, 'files', { configurable: true, value: [fil] });
        input.dispatchEvent(new w.Event('change'));
        for (let i = 0; i < 50 && !/inlästa|Fel/.test(w.document.getElementById('stat-status').textContent); i++) await new Promise(r => setTimeout(r, 20));
        expect(w.document.getElementById('stat-status').textContent).toMatch(/inlästa/);
        expect(w.__state.likvardighet.result).not.toBe(sentinel);
    });
    it('Likvärdigt arbete i poängläget: fliken säger att kraven mäts med poäng och Lägre krav förklarar varför den är tom', () => {
        const w = createAppWindow();
        w.__lasInDemodata();
        w.__state.arbetsvardering = { byKey: new Map(w.__hamtaData().map(r => [`${r.aid}|${r.bas}`, 100 + 'ABCDEFGHIJ'.indexOf(r.bas) * 50])) };
        w.__state.likvardighet.result = null;
        w.document.querySelector('.nav-item[data-tab="likvardighet"]').click();
        const t = w.document.getElementById('view-likvardighet').textContent;
        expect(t).toMatch(/Mått på kraven: arbetsvärdering \(poäng\)/);
        expect(t).toMatch(/Med arbetsvärderingspoäng jämförs AID-etiketter redan över BAS-gränserna/);
    });
    // ADR-76: i poängläget används jämförelsestatistiken inte, och varken fliken eller exporterna beskriver en reserv
    // eller visar rader som alltid är 0 (externa par, reserven per BAS, gemensamma BAS-intervall).
    const poangFonster = () => {
        const w = createAppWindow();
        w.__lasInDemodata();
        w.__state.arbetsvardering = { byKey: new Map(w.__hamtaData().map(r => [`${r.aid}|${r.bas}`, 100 + 'ABCDEFGHIJ'.indexOf(r.bas) * 50])) };
        w.__state.likvardighet.result = null;
        return w;
    };
    it('Likvärdigt arbete i poängläget: introduktionen beskriver ingen reserv och inga gemensamma BAS-intervall', () => {
        const w = poangFonster();
        w.document.querySelector('.nav-item[data-tab="likvardighet"]').click();
        const t = w.document.getElementById('view-likvardighet').textContent.replace(/\s+/g, ' ');
        expect(t).not.toMatch(/används jämförelsestatistiken i stället/);
        expect(t).toMatch(/Steg 2: Välj jämförelseetiketter med lika eller lägre poäng/);
        expect(t).not.toMatch(/gemensamma BAS-intervall/);
        expect(t).not.toMatch(/primär jämförelsekälla/);   // de egna är den enda källan med poäng
        expect(t).toMatch(/Steg 2a — Organisationens interna jämförelseetiketter \(\d+ st\) — den enda jämförelsekällan med poäng/);
    });
    it('Likvärdigt arbete i poängläget: rutan Inga kandidatpar räknar inga interna och externa jämförelseetiketter', () => {
        const w = createAppWindow();
        w.__lasInDemodata();
        // De kvinnodominerade AID-etiketterna får lägst poäng: ingen jämförelseetikett har lika eller lägre poäng.
        const andel = new Map();
        for (const r of w.__hamtaData()) {
            const n = `${r.aid}|${r.bas}`, a = andel.get(n) || [0, 0];
            andel.set(n, [a[0] + (r.kon.includes('kvinna') ? 1 : 0), a[1] + 1]);
        }
        w.__state.arbetsvardering = { byKey: new Map([...andel].map(([n, [kv, alla]]) => [n, kv / alla > 0.6 ? 1 : 1000])) };
        w.__state.likvardighet.result = null;
        w.document.querySelector('.nav-item[data-tab="likvardighet"]').click();
        const t = w.document.getElementById('view-likvardighet').textContent.replace(/\s+/g, ' ');
        expect(t).toMatch(/Inga kandidatpar hittades/);
        expect(t).not.toMatch(/externa jämförelseetiketter/);
        expect(t).toMatch(/Organisationen har \d+ kvinnodominerade grupper och \d+ jämförelseetiketter\./);
    });
    it('Likvärdigt arbete i poängläget: CSV- och Excel-exportens metadata beskriver ingen reserv', async () => {
        const w = poangFonster();
        expect(w.eval('likvardighetResultat()').pairs.length).toBeGreaterThan(0);
        let csv = null;
        w.eval('_laddaNedCSV = rows => { window.__lvCsv = rows; }');
        w.eval('exportLikvardighetCSV()');
        csv = w.__lvCsv;
        const csvMeta = csv.slice(csv.findIndex(r => r[0] === '# METADATA'));
        const csvText = csvMeta.map(r => r.join(' | ')).join('\n');
        expect(csvText).not.toMatch(/externa/);
        expect(csvText).not.toMatch(/jämförda med jämförelsestatistiken/);
        expect(csvText).not.toMatch(/extern =/);

        await laddaXlsx(w);
        let bok = null;
        w.XLSX.writeFile = wb => { bok = wb; };
        w.eval('exportLikvardighet()');
        const meta = w.XLSX.utils.sheet_to_json(bok.Sheets.Metadata, { header: 1, raw: true });
        const rad = namn => meta.find(r => r[0] === namn);
        const metaText = meta.map(r => r.join(' | ')).join('\n');
        expect(metaText).not.toMatch(/externa par|jämförda med jämförelsestatistiken|Gemensamma BAS/);
        expect(rad('Modell')[1]).not.toMatch(/extern/);
        expect(rad('Modell')[1]).toMatch(/poäng/);
        expect(rad('Jämförelsekälla')[1]).not.toMatch(/i stället/);
        expect(rad('95 % KI')[1]).not.toMatch(/Extern/);
        expect(rad('Mått på kraven')[1]).toMatch(/poäng/);
    });
});

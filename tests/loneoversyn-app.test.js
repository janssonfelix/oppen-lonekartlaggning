// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
// Löneöversyn i appen: potten och förslaget, de riktade potterna, utfallets riktning, formulären, läget utan pott och
// tröskelmålet.
import { describe, it, expect } from 'vitest';
import { createAppWindow } from './helpers/app-harness.js';

// Demot förifyller sakliga skäl på tre rader (56-handlingsplan.js, _hpDemoSkal); testerna här börjar från en tom plan.
const fonster = () => { const w = createAppWindow(); w.__lasInDemodata(); w.__state.handlingsplan = {}; return w; };

describe('Löneöversyn: förslaget nås från potten', () => {
    it('knappen vid potten är inaktiv utan pott, aktiv med pott, och fäller ut Riktade potter', () => {
        const w = fonster(); const d = w.document;
        w.__ritaFlik('loneoversyn');
        const knapp = d.getElementById('forecast-optimize-pott');
        expect(knapp.textContent).toBe(d.getElementById('forecast-optimize').textContent);
        expect(knapp.disabled).toBe(true);
        const pott = d.getElementById('forecast-budget-value');
        pott.value = '2.5'; pott.dispatchEvent(new w.Event('input', { bubbles: true }));
        expect(knapp.disabled).toBe(false);
        const avsnitt = d.getElementById('avsnitt-lo-riktade');
        avsnitt.open = false;
        w.alert = () => {};
        knapp.click();
        expect(avsnitt.open).toBe(true);
        expect(w.__state.forecast.targets.length).toBeGreaterThan(0);
        pott.value = ''; pott.dispatchEvent(new w.Event('input', { bubbles: true }));
        expect(knapp.disabled).toBe(true);
    });
    it('Lönesumma per månad säger "från …" bara när summan har ändrats', () => {
        const w = fonster(); const d = w.document;
        w.__ritaFlik('loneoversyn');
        const lonesumma = () => [...d.querySelectorAll('#lo-slutsatser > *')].find(el => /Lönesumma per månad/.test(el.textContent)).textContent;
        expect(lonesumma()).toMatch(/utgångsläget/);
        expect(lonesumma()).not.toMatch(/från/);
        const gen = d.getElementById('forecast-generell-value');
        gen.value = '2'; gen.dispatchEvent(new w.Event('input', { bubbles: true }));
        expect(lonesumma()).toMatch(/från \d/);
    });
});

describe('löneöversyn: riktade potter med kön, lönegräns och höj till', () => {
    const fonster = () => {
        const w = createAppWindow();
        const rader = [];
        const lagg = (n, kon, lon, bas, aid) => { for (let i = 0; i < n; i++) rader.push({ bas, kon, lon: lon + i * 100,
            alder: 30 + (i * 7) % 30, yrke: `${aid} Yrke ${aid}`, aid, yrkeLabel: `Yrke ${aid}`, enhet: '' }); };
        lagg(30, 'kvinna', 25000, 'A', '6000'); lagg(30, 'man', 25500, 'A', '6000'); lagg(6, 'kvinna', 36000, 'C', '5300');
        w.__state.data = rader;
        w.eval('fyllValjare(); lasUppFlikar();');
        return w;
    };
    const rad = (w, over) => {
        w.__state.forecast.targets = [{ bas: 'A', aid: '6000', kon: 'alla', lonCap: null, mode: 'kr', value: 1000, dist: 'flat', targetLevel: 'median', pool: 'övrigt', ...over }];
        w.__ritaFlik('loneoversyn');
        return w.__state.forecast.result?.alloc.perPerson;
    };
    const iA = p => p.bas === 'A';
    it('bara kvinnor: männen i gruppen får inget', () => {
        const w = fonster();
        const pp = rad(w, { kon: 'kvinna' });
        expect(pp.filter(p => iA(p) && p.kon === 'man').every(p => p.delta === 0)).toBe(true);
        expect(pp.filter(p => iA(p) && p.kon === 'kvinna' && p.delta > 0).length).toBe(30);
        expect(w.document.getElementById('forecast-targets').querySelector('[data-f="kon"]').value).toBe('kvinna');
    });
    it('en rad som berör färre än tröskeln får noten om enskildas löner; en som berör ingen får besked', () => {
        const w = fonster();
        rad(w, { bas: 'C', aid: '5300' });
        expect(w.document.getElementById('forecast-targets').textContent).toMatch(/Raden berör 6 personer, färre än 10/);
        rad(w, { bas: 'C', aid: '5300', kon: 'man' });
        expect(w.document.getElementById('forecast-targets').textContent).toMatch(/Ingen i gruppen matchar/);
        expect(w.document.getElementById('forecast-meter').textContent).toMatch(/matchar ingen person/);
    });
    it('etiketten «≈ kr» följer beloppet när det ändras', () => {
        const w = fonster();
        rad(w, { value: null });
        const host = w.document.getElementById('forecast-targets');
        const etikett = () => host.querySelector('[title="Vad raden förbrukar av potten"]').textContent.replace(/\s/g, ' ');
        expect(etikett()).toBe('≈ 0 kr');
        const falt = host.querySelector('[data-f="value"]');
        falt.value = '5000';
        falt.dispatchEvent(new w.Event('change'));
        expect(etikett()).toBe('≈ 5 000 kr');
    });
    it('Excel-exporten beskriver raden med kön, lönegräns och belopp', async () => {
        const { readFileSync } = await import('node:fs');
        const w = fonster();
        w.eval(readFileSync(new URL('../vendor/xlsx.mini.min.js', import.meta.url), 'utf8'));
        rad(w, { kon: 'kvinna', lonCap: 26000, mode: 'till', value: 26000 });
        let rader = null;
        w.XLSX.writeFile = wb => { rader = w.XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1 }); };
        w.eval('exportPrognos()');
        const r = rader.find(x => String(x[0]).startsWith('Riktad pott 1'));
        expect(r[1]).toBe('BAS A, AID 6000, bara kvinnor, löner under 26\u00a0000\u00a0kr: höj till 26\u00a0000\u00a0kr/mån');
    });
    it('Excel-exporten skriver tal med decimalkomma och inget «null»', async () => {
        const { readFileSync } = await import('node:fs');
        const w = fonster();
        w.eval(readFileSync(new URL('../vendor/xlsx.mini.min.js', import.meta.url), 'utf8'));
        w.__state.forecast.generell = { mode: 'pct', value: 5.85 };
        w.__state.forecast.targets = [
            { bas: 'C', aid: '5300', kon: 'alla', lonCap: null, mode: 'pct', value: 2.5, dist: 'flat', targetLevel: 'median', pool: 'övrigt' },
            { bas: 'A', aid: '6000', kon: 'alla', lonCap: null, mode: 'kr', value: null, dist: 'flat', targetLevel: 'median', pool: 'övrigt' }];
        w.__ritaFlik('loneoversyn');
        let blad = null;
        w.XLSX.writeFile = wb => { blad = wb.SheetNames.map(n => w.XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1 })); };
        w.eval('exportPrognos()');
        const [sammanfattning] = blad;
        const cell = namn => sammanfattning.find(x => String(x[0]).startsWith(namn))[1];
        expect(cell('Generellt påslag')).toBe('5,85\u00a0%');
        expect(cell('Riktad pott 1')).toMatch(/: 2,5\u00a0% av grupplön/);
        expect(cell('Riktad pott 2')).toMatch(/: saknar belopp$/);
    });
    it('konfigurationsfilen bär en riktad rad av varje slag oförändrad', () => {
        const a = fonster();
        const rader = [
            { bas: 'A', aid: '6000', kon: 'kvinna', lonCap: 39000, mode: 'till', value: 41000, dist: 'lowest', targetLevel: 'median', pool: 'equity' },
            { bas: 'A', aid: '6000', kon: 'man', lonCap: null, mode: 'kr', value: 1000, dist: 'flat', targetLevel: 'p25', pool: 'marknad' },
            { bas: 'C', aid: '5300', kon: 'alla', lonCap: 40000, mode: 'pct', value: 2.5, dist: 'target', targetLevel: 'median', pool: 'befordran' },
        ];
        a.__state.forecast.targets = JSON.parse(JSON.stringify(rader));
        const b = fonster();
        b.__cfg = JSON.parse(JSON.stringify(a.__byggKonfiguration()));
        b.eval('tillampaKonfiguration(window.__cfg)');
        expect(JSON.parse(JSON.stringify(b.__state.forecast.targets))).toEqual(rader);
    });
});

describe('Löneöversyn utan påslag', () => {
    it('ett tal som inte ändras sägs vara oförändrat, inte med en ensam pil', () => {
        const w = createAppWindow();
        w.__lasInDemodata();
        // En pott men inget påslag: utfallet visas, och inget tal har ändrats.
        w.__state.forecast.budget = { mode: 'pct', value: 2 };
        w.__ritaFlik('loneoversyn');
        const text = w.document.getElementById('forecast-outcome').textContent.replace(/\s+/g, ' ');
        expect(text).toMatch(/Kvinnors medianlön i % av mäns: [\d,]+ % till [\d,]+ % oförändrat/);
        expect(text).toMatch(/Oförklarad skillnad \(regressionen\): \S+ % till \S+ % oförändrat/);
        expect(text).not.toMatch(/[\u2190-\u21FF]/);
    });
});

// Ordet och färgen på utfallets rader följer talen som de visas med en decimal (riktning i src/lib/vymodell-loneoversyn.js), inte
// de oavrundade talen: efter ett generellt påslag stod "\u22124,3 % till \u22124,3 % ökar" i rött. Regeln prövas i
// tests/vymodeller.test.js under [B7.13]; här prövas ordet och färgen i kortet.
describe('Löneöversyn: riktningen följer de visade talen', () => {
    const utfall = w => {
        w.__ritaFlik('loneoversyn');
        const el = w.document.getElementById('forecast-outcome');
        return { el, text: el.textContent.replace(/\s+/g, ' ') };
    };
    const rad = (text, etikett) => text.match(new RegExp(`${etikett}: (\\S+ %) till (\\S+ %)(?: (minskar|ökar|oförändrat|närmar sig 100 %|längre från 100 %))?`));
    const OFORKL = 'Oförklarad skillnad \\(regressionen\\)', ANDEL = 'Kvinnors medianlön i % av mäns';
    it('generellt påslag 2 % på demodatan: lika tal före och efter är oförändrat, utan röd markering', () => {
        const w = createAppWindow();
        w.__lasInDemodata();
        w.__state.forecast.generell = { mode: 'pct', value: 2 };
        const { el, text } = utfall(w);
        for (const etikett of [OFORKL, ANDEL]) {
            const m = rad(text, etikett);
            expect(m, etikett).toBeTruthy();
            expect(m[1], etikett).toBe(m[2]);
            expect(m[3], etikett).toBe('oförändrat');
        }
        const card = el.querySelector('.card');
        expect(card.querySelectorAll('.f-kritisk')).toHaveLength(0);
        expect(card.querySelectorAll('.f-dampad')).toHaveLength(2);
        expect(card.querySelector('.bg-kritisk')).toBeNull();
    });
    it('riktade påslag till kvinnorna ändrar den oförklarade skillnaden, och ordet stämmer med de visade talen', () => {
        const w = createAppWindow();
        w.__lasInDemodata();
        const bas = [...new Set(w.__state.data.map(r => r.bas))];
        w.__state.forecast.targets = bas.map(b => ({ bas: b, aid: '*', mode: 'pct', value: 6, dist: 'flat', kon: 'kvinna', pool: 'equity' }));
        const { el, text } = utfall(w);
        const tal = s => Number(s.replace(/\s%$/, '').replace('\u2212', '-').replace('+', '').replace(',', '.'));
        const m = rad(text, OFORKL);
        expect(m).toBeTruthy();
        const [fore, efter] = [tal(m[1]), tal(m[2])];
        expect(fore).toBeLessThan(0);
        expect(efter).not.toBe(fore);
        expect(m[3]).toBe(Math.abs(efter) < Math.abs(fore) ? 'minskar' : 'ökar');
        expect(m[3]).toBe('minskar');
        const a = rad(text, ANDEL);
        expect(a[3]).toBe(Math.abs(tal(a[2]) - 100) < Math.abs(tal(a[1]) - 100) ? 'närmar sig 100 %' : Math.abs(tal(a[2]) - 100) > Math.abs(tal(a[1]) - 100) ? 'längre från 100 %' : 'oförändrat');
        const ord = [...el.querySelector('.card').querySelectorAll('span')].find(s => s.textContent === 'minskar');
        expect(ord.className).toBe('farg-ok');
    });
});

describe('formulären i Löneöversyn', () => {
    const FALT = ['forecast-budget-value', 'forecast-generell-value', 'forecast-min-n', 'forecast-rule-value', 'forecast-closure-pct', 'forecast-market-factor', 'forecast-threshold-pct', 'forecast-rem-pct'];
    it('varje talfält har en etikett ovanför och sin enhet som suffix i samma ruta', () => {
        const w = createAppWindow();
        const d = w.document;
        for (const id of FALT) {
            const falt = d.getElementById(id), rad = falt.closest('.falt-rad'), yttre = falt.closest('.falt');
            expect(rad, id).toBeTruthy();
            expect(yttre.querySelector(`label.falt-etikett[for="${id}"]`), id).toBeTruthy();
            const enhet = rad.querySelector('.falt-enhet, select');
            expect(enhet, id).toBeTruthy();
            expect(falt.getAttribute('style') || '', id).not.toContain('width');   // en bredd för alla, ur stilmallen
        }
    });
    it('också väljarna har sin etikett ovanför, i samma fältkomponent', () => {
        const w = createAppWindow();
        for (const id of ['forecast-round', 'forecast-years', 'forecast-rule-match', 'forecast-rule-dist']) {
            const falt = w.document.getElementById(id).parentElement;
            expect(falt.classList.contains('falt'), id).toBe(true);
            expect(falt.firstElementChild.matches(`label.falt-etikett[for="${id}"]`), id).toBe(true);
            expect(falt.children.length, id).toBe(2);
        }
    });
    it('massregeln går i ordningen vilka, hur mycket, lägg till', () => {
        const w = createAppWindow();
        const grupp = w.document.getElementById('forecast-rule-match').closest('fieldset.falt-grupp');
        const ordning = [...grupp.querySelectorAll('select, input, button')].map(e => e.id);
        expect(ordning).toEqual(['forecast-rule-match', 'forecast-min-n', 'forecast-rule-value', 'forecast-rule-mode', 'forecast-rule-dist', 'forecast-add-criteria']);
    });
    it('målen står i klartext, utan matematiska tecken eller jargong', () => {
        const w = createAppWindow();
        const text = w.document.getElementById('view-loneoversyn').textContent;
        expect(text).toContain('Mål: oförklarad skillnad högst');
        expect(text).not.toContain('≥ −');
        expect(text).not.toContain('grön-cirklade');
        expect(text).not.toContain('benchmark');
    });
    it('fälten styr prognosens värden', () => {
        const w = createAppWindow();
        w.__lasInDemodata();
        w.__ritaFlik('loneoversyn');
        const d = w.document;
        const satt = (id, v) => { const el = d.getElementById(id); el.value = v; el.dispatchEvent(new w.Event('input', { bubbles: true })); el.dispatchEvent(new w.Event('change', { bubbles: true })); };
        satt('forecast-budget-mode', 'kr'); satt('forecast-budget-value', '50000'); satt('forecast-generell-value', '1'); satt('forecast-min-n', '12');
        expect(w.__state.forecast.budget).toEqual({ mode: 'kr', value: 50000 });
        expect(w.__state.forecast.generell).toEqual({ mode: 'pct', value: 1 });
        expect(w.__state.forecast.minGroupN).toBe(12);
    });
});

// Ingen budget angiven är ett eget läge (pottAngiven ur prognosutfall): ett påslag utan pott överskrider ingen pott.
// En angiven pott på 0 kr flaggas.
describe('Löneöversyn: utan pott och med en pott på 0 kr', () => {
    const rita = budget => {
        const w = createAppWindow();
        w.__lasInDemodata();
        w.__state.forecast.budget = budget;
        w.__state.forecast.generell = { mode: 'pct', value: 1 };
        w.__ritaFlik('loneoversyn');
        const d = w.document, ruta = namn => [...d.querySelectorAll('#lo-slutsatser .slutsats')].find(e => e.querySelector('.slutsats-etikett').textContent === namn);
        return { w, d, ruta, meter: d.getElementById('forecast-meter').textContent };
    };
    it('utan pott: påslaget visas, men ingen varning om överskriden pott och inget negativt Kvar', () => {
        const { d, ruta, meter } = rita({ mode: 'kr', value: null });
        expect(d.getElementById('view-loneoversyn').classList.contains('lo-tomt')).toBe(false);
        expect(meter).not.toMatch(/överskrider potten/);
        const kvar = ruta('Kvar att fördela');
        expect(kvar.querySelector('.slutsats-varde').textContent).toBe('–');
        expect(kvar.querySelector('.slutsats-under').textContent).toBe('ingen pott angiven');
        expect(kvar.querySelector('.slutsats-under').classList.contains('ar-kritisk')).toBe(false);
        expect(ruta('Pott').querySelector('.slutsats-under').textContent).toBe('ingen pott angiven');
        expect(ruta('Använt').querySelector('.slutsats-varde').textContent).not.toBe('0\u00a0kr');
    });
    it('en angiven pott på 0 kr: varningen och ett negativt Kvar står kvar', () => {
        const { ruta, meter } = rita({ mode: 'kr', value: 0 });
        expect(meter).toMatch(/Fördelningen överskrider potten\./);
        const kvar = ruta('Kvar att fördela');
        expect(kvar.querySelector('.slutsats-varde').textContent).toMatch(/^−/);
        expect(kvar.querySelector('.slutsats-under').textContent).toBe('fördelningen överskrider potten');
        expect(ruta('Pott').querySelector('.slutsats-varde').textContent).toBe('0\u00a0kr');
    });
    it('ett påslag som överskrider potten med några ören: Kvar och varningen säger samma sak', () => {
        const { w } = rita({ mode: 'kr', value: null });
        const anvant = w.__state.forecast.result.använt;
        for (const [over, sager] of [[0.03, false], [2, true]]) {
            const { ruta, meter } = rita({ mode: 'kr', value: anvant - over });
            expect(/överskrider potten/.test(meter), String(over)).toBe(sager);
            expect(ruta('Kvar att fördela').querySelector('.slutsats-under').textContent, String(over)).toBe(sager ? 'fördelningen överskrider potten' : 'av potten');
        }
    });
    it('utan pott och utan påslag går inget scenario att spara', () => {
        const { w } = rita({ mode: 'kr', value: null });
        w.__state.forecast.generell = { mode: 'pct', value: 0 };
        w.__ritaFlik('loneoversyn');
        let sagt = '';
        w.alert = t => { sagt = t; };
        w.eval("_fcSparaScenario('A')");
        expect(w.__state.forecast.scenarios.A).toBeNull();
        expect(sagt).toMatch(/Ange en pott först/);
    });
    it('scenariot utan pott säger att ingen pott är angiven, inte 0 kr', () => {
        const { w, d } = rita({ mode: 'kr', value: null });
        w.eval("_fcSparaScenario('A')");
        expect(d.getElementById('forecast-scenarios').textContent).toContain('(ingen pott angiven, inga riktade)');
    });
});

// Tröskelmålet: 0 % är ett mål (ingen oförklarad skillnad), ett tomt fält ger standardmålet 5 %, och ett tal utanför
// fältets min och max avvisas med en mening i stället för att tyst bli något annat.
describe('Löneöversyn: målet i tröskelmålet', () => {
    const w = createAppWindow();
    w.__lasInDemodata();
    w.__ritaFlik('loneoversyn');
    const falt = w.document.getElementById('forecast-threshold-pct'), sig = w.document.getElementById('forecast-threshold-sig');
    const resultat = (varde, signifikans = false) => {
        falt.value = varde; sig.checked = signifikans;
        w.eval('_fcLyftMotMal()');
        return w.document.getElementById('forecast-threshold-result').textContent.replace(/\s+/g, ' ').trim();
    };
    it('målet 0 % räknas som 0 %, inte som standardmålet', () => {
        const noll = resultat('0'), fem = resultat('5');
        expect(noll).not.toBe(fem);
        expect(noll).toMatch(/högst 0 %|redan uppfyllt/);   // blanktecknen är samlade till ett mellanslag
    });
    it('ett tomt fält ger standardmålet 5 %', () => {
        expect(resultat('')).toBe(resultat('5'));
    });
    it('ett mål under 0 eller över 20 % avvisas med en mening', () => {
        expect(resultat('-1')).toBe('Ange ett mål mellan 0 och 20 %.');
        expect(resultat('25')).toBe('Ange ett mål mellan 0 och 20 %.');
    });
    it('i läget inte signifikant spelar målet ingen roll', () => {
        expect(resultat('-1', true)).toBe(resultat('5', true));
    });
});

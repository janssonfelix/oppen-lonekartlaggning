// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
// Utforska i appen: punktmolnen, tabellen och diagrammet, klick till gruppdossiern, urvalet med villkor, helhet eller
// per kön, Visa, noter och export, tomläget, små yrkesgrupper som slås ihop, Löneöversikten, sorteringen och att Rensa
// all data tömmer Utforskas minne.
import { describe, it, expect, beforeAll } from 'vitest';
import { createAppWindow } from './helpers/app-harness.js';
import { las } from './helpers/granssnitt-rigg.js';

let win;

beforeAll(() => {
    win = createAppWindow();
    win.__lasInDemodata();   // blocken nedan läser demodatan
});

describe('punkt-sampling: stora punktmoln ritas som ett jämnt urval (perf vid stora underlag)', () => {
    // Nedsamplingen gör diagramkärnan (ADR-39): bara det som ritas påverkas — figuren, och alla mått, har full data.
    const moln = n => ({ beskrivning: 'M', x: { skala: 'linjar' }, y: { skala: 'linjar' },
        lager: [{ marke: 'punkt', serie: 'P', farg: '#2563eb', data: Array.from({ length: n }, (_, i) => ({ x: i, y: i * 2 })) },
                { marke: 'linje', serie: 'L', farg: '#111111', data: [{ x: 0, y: 0 }, { x: n, y: n * 2 }] }] });
    const rita = n => { win.__f = moln(n); return win.eval('_rfByggSvg(window.__f, 800, {})'); };

    it('lämnar små punktmoln och linjer orörda', () => {
        const svg = rita(5000);
        expect(svg.getAttribute('data-nedsamplat')).toBeNull();
        expect(svg.querySelectorAll('[data-marke="punkt"]').length).toBe(5000);
        expect(svg.querySelectorAll('path[data-marke="linje"]').length).toBe(1);
    });

    it('nedsamplar stora punktmoln till högst 8 000 punkter, jämnt fördelade, och säger hur många som ritas', () => {
        const svg = rita(40000);
        const punkter = [...svg.querySelectorAll('[data-marke="punkt"]')];
        expect(punkter.length).toBeLessThanOrEqual(8000);
        expect(punkter.length).toBeGreaterThan(0);
        expect(svg.getAttribute('data-nedsamplat')).toBe(`${punkter.length}/40000`);
        // Var k:te punkt: indexen i figuren ligger med jämna steg.
        const idx = punkter.map(p => Number(p.getAttribute('data-i')));
        const steg = idx[1] - idx[0];
        expect(idx.every((v, i) => i === 0 || v - idx[i - 1] === steg)).toBe(true);
        expect(win.__f.lager[0].data).toHaveLength(40000);   // figuren är orörd
    });

    it('är deterministisk (samma indata → samma bild)', () => {
        expect(rita(40000).outerHTML).toBe(rita(40000).outerHTML);
    });
});

describe('Utforska 2.0', () => {
    const $ = id => win.document.getElementById(id);
    const satt = (id, v) => { const el = $(id); if (el.type === 'checkbox') el.checked = v; else el.value = v; };
    const aterstall = () => {
        satt('explore-rad', 'bas'); satt('explore-kolumn', 'ingen'); satt('explore-measure', 'median');
        satt('explore-visa', 'helhet'); satt('explore-typ', 'auto'); satt('explore-inkludera-sma', false);
        win.__utforskaSattFilter({});
    };
    const rita = () => { win.__ritaUtforska(); return $('chart-explore'); };
    // Tomlägets rad ("Inga grupper att visa") är ingen grupp.
    const kolumn0 = () => [...$('explore-table').querySelectorAll('tbody tr')].filter(tr => !tr.querySelector('.explore-tom')).map(tr => tr.cells[0].textContent.trim());

    beforeAll(() => { win.__lasInDemodata(); });

    it('standardvyn ritar staplar per BAS i ordningen A → Z', () => {
        aterstall();
        const gd = rita();
        expect(gd._figur.lager[0].marke).toBe('stapel');   // ritat av diagramkärnan (ADR-39)
        const bas = kolumn0();
        expect(bas.length).toBeGreaterThan(1);
        expect(bas).toEqual([...bas].sort((a, b) => a.localeCompare(b, 'sv')));
    });

    it('alla kategoriaxlar är kategoriska (enhetskoder tolkas inte som tal)', () => {
        aterstall(); satt('explore-rad', 'enhet');
        expect(rita()._figur.x.skala).toBe('band');
    });

    it('åldersgrupper visas från yngst till äldst', () => {
        aterstall(); satt('explore-rad', 'alder'); rita();
        const ord = ['<20', '20–24', '25–29', '30–34', '35–39', '40–44', '45–49', '50–54', '55–59', '60–64', '65+'];
        const idx = kolumn0().map(l => ord.indexOf(l));
        expect(idx.every((v, i) => i === 0 || v > idx[i - 1])).toBe(true);
    });

    it('liggande staplar', () => {
        aterstall(); satt('explore-typ', 'liggande');
        const f = rita()._figur;
        expect(f.lager[0].riktning).toBe('liggande');
        expect(f.y.skala).toBe('band');
    });

    it('diagramtyperna står i två grupper, Vanliga och Fler diagramtyper, och ingen typ har försvunnit', () => {
        const sel = $('explore-typ');
        const grupper = [...sel.querySelectorAll(':scope > optgroup')];
        expect(grupper.map(g => g.label)).toEqual(['Vanliga', 'Fler diagramtyper']);
        expect(sel.querySelectorAll(':scope > option')).toHaveLength(0);
        expect([...grupper[0].querySelectorAll('option')].map(o => o.textContent)).toEqual(['Automatisk', 'Staplar', 'Liggande staplar', 'Låddiagram', 'Grupperade staplar']);
        expect([...grupper[1].querySelectorAll('option')].map(o => o.textContent)).toEqual(['Hanteldiagram', 'Bubbeldiagram', 'Individpunkter', 'Punktsvärm', 'Regnmoln', 'Kvantilpunkter', 'Värmekarta', 'Staplade staplar']);
        // Varje typ i registret går att välja, och etiketten är densamma som i registret.
        const typer = win.eval('UTFORSKA_TYPER');
        expect([...sel.options].map(o => o.value).filter(v => v !== 'auto').sort()).toEqual(Object.keys(typer).sort());
        for (const o of sel.options) if (o.value !== 'auto') expect(o.textContent).toBe(typer[o.value].label);
        expect(win.document.getElementById('view-utforska').textContent).not.toMatch(/Heatmap/);
    });

    it('Utforskas två verktyg har var sin avsnittsrubrik och är öppna', () => {
        const d = win.document;
        const ov = d.getElementById('avsnitt-ut-oversikt'), egna = d.getElementById('avsnitt-ut-egna');
        expect(ov.querySelector(':scope > summary h2').textContent).toBe('Löneöversikt — alla BAS-intervall');
        expect(egna.querySelector(':scope > summary h2').textContent).toBe('Egna vyer');
        expect(ov.open && egna.open).toBe(true);
        expect(ov.contains(d.getElementById('rapport-table')) && egna.contains(d.getElementById('chart-explore'))).toBe(true);
    });

    it('två dimensioner ger heatmap och korstabell', () => {
        aterstall(); satt('explore-rad', 'aid'); satt('explore-kolumn', 'alder');
        const gd = rita();
        expect(gd._figur.lager[0].marke).toBe('ruta');
        const ths = $('explore-table').querySelectorAll('thead th');
        expect(ths.length).toBe(gd._figur.x.ordning.length + 1);
    });

    it('grupperade staplar ger en serie per kolumnvärde', () => {
        aterstall(); satt('explore-rad', 'bas'); satt('explore-kolumn', 'kon'); satt('explore-typ', 'grupperade');
        const gd = rita();
        expect(gd._figur.lager.every(l => l.marke === 'stapel')).toBe(true);
        expect(gd._figur.lager.map(l => l.serie).sort()).toEqual(['Kvinna', 'Man']);
    });

    it('en diagramtyp som inte passar är inaktiverad och vyn faller tillbaka', () => {
        aterstall(); satt('explore-typ', 'heatmap'); rita();
        const opt = [...$('explore-typ').options].find(o => o.value === 'heatmap');
        expect(opt.disabled).toBe(true);
        expect(opt.title).toMatch(/Kolumner/);
        expect($('explore-typ').value).toBe('auto');
        expect($('chart-explore')._figur.lager[0].marke).toBe('stapel');
    });

    const konOpt = () => [...$('explore-visa').options].find(o => o.value === 'kon');
    it('per kön går inte för gap, men för två dimensioner', () => {
        aterstall(); satt('explore-measure', 'gap'); rita();
        expect(konOpt().disabled).toBe(true);
        expect(konOpt().title).toMatch(/jämför redan könen/);
        aterstall(); satt('explore-kolumn', 'alder'); rita();
        expect(konOpt().disabled).toBe(false);
        aterstall(); rita();
        expect(konOpt().disabled).toBe(false);
    });

    it('per kön ger en serie per kön — som hantel när diagramtypen väljs automatiskt, som staplar när man ber om det', () => {
        aterstall(); satt('explore-visa', 'kon');
        // Automatiskt val för ett lönemått per kön: hantel (avståndet mellan könen syns, axeln börjar inte på noll).
        expect(rita()._figur.lager.map(l => [l.marke, l.serie])).toEqual([['intervall', 'Skillnad kvinnor–män'], ['punkt', 'Kvinna'], ['punkt', 'Man']]);
        // Det automatiska valet låser inte "Visa": helhet går att välja, och ger då staplar.
        expect([...$('explore-visa').options].find(o => o.value === 'helhet').disabled).toBe(false);
        satt('explore-visa', 'helhet');
        expect(rita()._figur.lager.map(l => l.marke)).toEqual(['stapel']);
        satt('explore-visa', 'kon'); satt('explore-typ', 'staplar');
        expect(rita()._figur.lager.map(l => [l.marke, l.serie])).toEqual([['stapel', 'Kvinna'], ['stapel', 'Man']]);
        // Antal är inget lönemått: staplar också automatiskt.
        satt('explore-typ', 'auto'); satt('explore-measure', 'n');
        expect(rita()._figur.lager.every(l => l.marke === 'stapel')).toBe(true);
    });

    it('filtret begränsar urvalet och visas som etikett', () => {
        aterstall();
        const forsta = win.__hamtaData()[0].bas;
        win.__utforskaSattFilter({ bas: [forsta] });
        rita();
        expect(kolumn0()).toEqual([forsta]);
        expect($('explore-filter-chips').textContent).toContain(forsta);
    });

    it('ett filtervärde som inte finns i datan tas bort tyst', () => {
        aterstall();
        win.__utforskaSattFilter({ bas: ['FINNS-INTE'] });
        rita();
        expect(kolumn0().length).toBeGreaterThan(1);
        expect($('explore-filter-chips').textContent).toBe('');
    });

    it('filter som tillsammans ger noll personer visar tomläget, och Rensa filter fungerar', () => {
        aterstall();
        const rows = win.__hamtaData();
        const aidAv = r => win.__utGruppnyckel(r, 'aid');
        let par = null;
        for (const b of new Set(rows.map(r => r.bas))) {
            const iB = new Set(rows.filter(r => r.bas === b).map(aidAv));
            const annan = rows.map(aidAv).find(a => !iB.has(a));
            if (annan) { par = [b, annan]; break; }
        }
        expect(par).not.toBeNull();
        win.__utforskaSattFilter({ bas: [par[0]], aid: [par[1]] });
        rita();
        expect($('chart-explore').textContent).toContain('Inga personer matchar urvalet');
        $('chart-explore').querySelector('[data-explore-clear]').click();
        expect(kolumn0().length).toBeGreaterThan(1);
    });

    it('tabellTillMatris hoppar över rader och tömmer celler som är märkta för export', () => {
        const t = win.document.createElement('table');
        t.id = 'tmp-export-tabell';
        t.innerHTML = '<thead><tr><th>G</th><th>V</th></tr></thead><tbody>'
            + '<tr><td>A</td><td>1</td></tr><tr data-export-utelamna><td>B</td><td>2</td></tr>'
            + '<tr><td>C</td><td data-export-tom>3</td></tr></tbody>';
        win.document.body.appendChild(t);
        expect(win.__tabellTillMatris('tmp-export-tabell')).toEqual([['G', 'V'], ['A', '1'], ['C', '']]);
        t.remove();
    });

    it('rutan för små grupper visar tröskeln', () => {
        aterstall(); rita();
        expect($('explore-inkludera-sma-label').textContent).toBe('Ta med grupper under 10 i exporten');
    });

    it('hanteldiagram: en linje per grupp och en punktserie per kön', () => {
        aterstall(); satt('explore-typ', 'hantel');
        const gd = rita();
        expect(gd._figur.lager.map(l => [l.marke, l.serie])).toEqual([['intervall', 'Skillnad kvinnor–män'], ['punkt', 'Kvinna'], ['punkt', 'Man']]);
        expect(gd._figur.lager[0].tips).toBeUndefined();   // strecket har inget eget verktygstips
        expect(gd._figur.lager[0].legend).toBe(false);
    });

    it('hanteldiagram går inte att välja för gap, eller när urvalet bara har ett kön', () => {
        aterstall(); satt('explore-measure', 'gap'); rita();
        expect([...$('explore-typ').options].find(o => o.value === 'hantel').disabled).toBe(true);
        aterstall(); win.__utforskaSattFilter({ kon: ['Kvinna'] }); rita();
        const opt = [...$('explore-typ').options].find(o => o.value === 'hantel');
        expect(opt.disabled).toBe(true);
        expect(opt.title).toBe('Urvalet innehåller bara ett kön.');
        expect([...$('explore-visa').options].find(o => o.value === 'kon').disabled).toBe(true);
    });

    it('bubbeldiagram: andel kvinnor 0–100 på x, median på y, och måttvalet är låst', () => {
        aterstall(); satt('explore-typ', 'bubbla');
        const gd = rita();
        expect(gd._figur.lager[0].marke).toBe('punkt');
        expect(gd._figur.lager[0].data.every(d => d.x >= 0 && d.x <= 100)).toBe(true);
        expect(gd._figur.x.doman).toEqual([0, 100]);
        expect($('explore-measure').disabled).toBe(true);
        expect(gd._figur.referens.map(r => r.x)).toEqual([40, 60]);
    });

    it('låddiagram och individpunkter ritar lönerna per kön', () => {
        aterstall(); satt('explore-typ', 'lada');
        let gd = rita();
        expect(gd._figur.lager.every(l => l.marke === 'lada')).toBe(true);
        expect(gd._figur.lager[0].punkter).toBeUndefined();        // låda med morrhår och avvikare
        satt('explore-typ', 'punkter');
        gd = rita();
        expect(gd._figur.lager[0].punkter).toBe('alla');
        const antal = gd._figur.lager.reduce((s, l) => s + l.data.length, 0);
        expect(antal).toBe(win.__hamtaData().filter(r => r.lon > 0).length);
    });

    it('individpunkter respekterar filtret', () => {
        aterstall(); satt('explore-typ', 'punkter');
        const forsta = win.__hamtaData()[0].bas;
        win.__utforskaSattFilter({ bas: [forsta] });
        const gd = rita();
        expect(gd._figur.lager.every(l => l.marke === 'lada' && l.punkter === 'alla')).toBe(true);
        expect(new Set(gd._figur.lager.flatMap(l => l.data.map(d => d.x)))).toEqual(new Set([forsta]));
    });
});

describe('Utforska: klick till gruppdossiern', () => {
    const spec = over => ({ rad: 'bas', kolumn: null, matt: 'median', delaKon: false, urval: { lage: 'alla', villkor: [] }, gruppVillkor: [], ...over });
    let kand;
    beforeAll(() => {
        win.__lasInDemodata();
        // Nollställ Utforska så att klicket tolkas mot en känd vy (rader = BAS).
        const doc = win.document;
        doc.getElementById('explore-rad').value = 'bas';
        doc.getElementById('explore-kolumn').value = 'ingen';
        doc.getElementById('explore-typ').value = 'auto';
        win.__utforskaSattFilter({});
        win.__ritaUtforska();
        kand = win.__gruppdossierKandidater();
        expect(kand.length).toBeGreaterThan(0);
    });

    it('BAS som rad öppnar den största gruppen i det BAS:et', () => {
        const bas = kand[0].bas;
        const storst = kand.find(c => c.bas === bas);
        expect(win.__utforskaDossiermal(spec(), bas, null)).toEqual({ key: storst.key });
    });

    it('AID × BAS pekar ut exakt grupp', () => {
        const c = kand[0];
        const aidEtikett = win.__hamtaData().map(r => win.__utGruppnyckel(r, 'aid')).find(l => l === c.aid || l.startsWith(c.aid + ' '));
        expect(win.__utforskaDossiermal(spec({ rad: 'aid', kolumn: 'bas' }), aidEtikett, c.bas)).toEqual({ key: c.key });
    });

    it('ett filter med ett enda BAS räcker tillsammans med AID som rad', () => {
        const c = kand[0];
        const aidEtikett = win.__hamtaData().map(r => win.__utGruppnyckel(r, 'aid')).find(l => l === c.aid || l.startsWith(c.aid + ' '));
        expect(win.__utforskaDossiermal(spec({ rad: 'aid', urval: { lage: 'alla', villkor: [{ falt: 'bas', op: 'enAv', varde: [c.bas] }] } }), aidEtikett, null))
            .toEqual({ key: c.key });
    });

    it('varken AID eller BAS ger inget mål', () => {
        expect(win.__utforskaDossiermal(spec({ rad: 'alder', kolumn: 'kon' }), '30–34', 'Kvinna')).toBeNull();
    });

    it('klick öppnar modalen', () => {
        win.__utforskaVidKlick({ rad: kand[0].bas, kol: null });
        expect(win.document.getElementById('dossier-modal').style.display).toBe('flex');
        win.__stangGruppdossier();
    });

    it('klick på en liten grupp öppnar dossiern: skärmen maskerar inget (ADR-51)', () => {
        const w = createAppWindow();
        const rader = [];
        for (let i = 0; i < 20; i++) rader.push({ bas: 'A', kon: i % 2 ? 'man' : 'kvinna', lon: 30000 + i, alder: 40,
            yrke: '100 Stor', aid: '100', yrkeLabel: 'Stor', enhet: '' });
        for (let i = 0; i < 4; i++) rader.push({ bas: 'B', kon: i % 2 ? 'man' : 'kvinna', lon: 30000 + i, alder: 40,
            yrke: '200 Liten', aid: '200', yrkeLabel: 'Liten', enhet: '' });
        w.__state.data = rader;
        w.eval('fyllValjare(); lasUppFlikar();');
        w.__ritaFlik('utforska');
        expect(w.__utforskaDossiermal(spec(), 'B', null)).toEqual({ key: '200|B' });
        w.__state.kLage = 'export';
        expect(w.__utforskaDossiermal(spec(), 'B', null)).toEqual({ saknas: true });
        w.__state.kLage = 'skarm';
    });
});

describe('Utforska: tröskel, klick och diagramdata', () => {
    const $ = id => win.document.getElementById(id);
    const vanta = () => new Promise(r => setTimeout(r, 0));
    const grund = () => {
        $('explore-rad').value = 'bas'; $('explore-kolumn').value = 'ingen'; $('explore-measure').value = 'median';
        $('explore-typ').value = 'auto'; $('explore-visa').value = 'helhet'; $('explore-inkludera-sma').checked = false;
        win.__utforskaSattFilter({});
    };
    beforeAll(() => { win.__lasInDemodata(); grund(); win.__ritaUtforska(); });

    it('korstabellens export utelämnar gap där ena könet är under tröskeln', () => {
        const w = createAppWindow();
        // Kolumndimension AID.
        const r = (kon, lon, aid) => ({ bas: 'A', kon, lon, alder: 40, yrke: `${aid} X`, aid, yrkeLabel: 'X' });
        const rader = [];
        for (let i = 0; i < 12; i++) rader.push(r('man', 30000 + i, '100'));
        for (let i = 0; i < 2; i++) rader.push(r('kvinna', 25000, '100'));
        for (let i = 0; i < 20; i++) rader.push(r(i % 2 ? 'man' : 'kvinna', 30000, '200'));   // 10 + 10
        w.__state.data = rader;
        w.eval('fyllValjare(); lasUppFlikar();');
        const d = w.document;
        d.getElementById('explore-rad').value = 'bas';
        d.getElementById('explore-kolumn').value = 'aid';
        d.getElementById('explore-measure').value = 'gap';
        w.__ritaUtforska();
        const m = w.__tabellTillMatris('explore-table');
        const kol = e => m[0].findIndex(c => String(c).startsWith(e));
        expect(kol('100')).toBeGreaterThan(0);
        expect(m[1][kol('100')]).toBe('');
        expect(m[1][kol('200')]).not.toBe('');
    });

    it('klickhanteraren kopplas på nytt efter varje omritning', async () => {
        grund();
        // Diagramkärnan (ADR-39): klicket hör till behållaren och överlever omritningar — ett klick, ett anrop.
        const el = $('chart-explore');
        const kand = win.__gruppdossierKandidater()[0];
        win.__ritaUtforska();
        await vanta();
        $('explore-measure').value = 'medel';
        win.__ritaUtforska();
        await vanta();
        const i = el._figur.lager[0].data.findIndex(d => d.rad === kand.bas);
        el.querySelector(`rect[data-marke="stapel"][data-i="${i}"]`).dispatchEvent(new win.Event('click', { bubbles: true }));
        expect($('dossier-modal').style.display).toBe('flex');
        win.__stangGruppdossier();
    });

    it('tomläget försvinner när diagrammet ritas igen', () => {
        grund();
        const rows = win.__hamtaData();
        const aidAv = r => win.__utGruppnyckel(r, 'aid');
        let par = null;
        for (const b of new Set(rows.map(r => r.bas))) {
            const iB = new Set(rows.filter(r => r.bas === b).map(aidAv));
            const annan = rows.map(aidAv).find(a => !iB.has(a));
            if (annan) { par = [b, annan]; break; }
        }
        win.__utforskaSattFilter({ bas: [par[0]], aid: [par[1]] });
        win.__ritaUtforska();
        expect($('chart-explore').querySelector('.explore-tom')).not.toBeNull();
        win.__utforskaSattFilter({});
        win.__ritaUtforska();
        expect($('chart-explore').querySelector('.explore-tom')).toBeNull();
    });

    it('diagramdatan har decimalkomma och högst två decimaler', () => {
        grund();
        $('explore-measure').value = 'medel';
        win.__ritaUtforska();
        const celler = win.__diagramexportRader($('chart-explore')).flat();
        expect(celler.filter(v => typeof v === 'number' && !Number.isInteger(v))).toEqual([]);
        expect(celler.some(v => typeof v === 'string' && /^\d+,\d{1,2}$/.test(v))).toBe(true);
    });
});

describe('Utforska: urval med villkor', () => {
    const $ = id => win.document.getElementById(id);
    const q = s => win.document.querySelector(s);
    const change = (el, v) => { if (v !== undefined) el.value = v; el.dispatchEvent(new win.Event('change', { bubbles: true })); };
    // Tomlägets rad ("Inga grupper att visa") är ingen grupp.
    const kolumn0 = () => [...$('explore-table').querySelectorAll('tbody tr')].filter(tr => !tr.querySelector('.explore-tom')).map(tr => tr.cells[0].textContent.trim());
    const grund = () => {
        $('explore-rad').value = 'bas'; $('explore-kolumn').value = 'ingen'; $('explore-measure').value = 'median';
        $('explore-typ').value = 'auto'; $('explore-visa').value = 'helhet'; $('explore-inkludera-sma').checked = false;
        win.__utforskaSattFilter({});
        win.__ritaUtforska();
    };
    beforeAll(() => { win.__lasInDemodata(); grund(); });

    it('panelen har knappar för att lägga till person- och gruppvillkor', () => {
        expect(q('[data-urval-lagg-till="person"]')).not.toBeNull();
        expect(q('[data-urval-lagg-till="grupp"]')).not.toBeNull();
    });

    it('lägga till ett villkor ger en rad; ofullständigt markeras och ignoreras', () => {
        grund();
        const fore = kolumn0().length;
        q('[data-urval-lagg-till="person"]').click();
        expect($('explore-urval-villkor').querySelectorAll('.explore-urval-rad')).toHaveLength(1);
        expect(q('#explore-urval-villkor .explore-urval-ofullst').hidden).toBe(false);
        expect(kolumn0().length).toBe(fore);
    });

    it('välja ett värde begränsar urvalet och visas i etiketten', () => {
        const box = q('#explore-urval-villkor [data-urval-varde="0"]');
        box.checked = true;
        change(box);
        expect(kolumn0()).toEqual([box.value]);
        expect($('explore-filter-chips').textContent).toContain(`BAS är en av ${box.value}`);
        expect(q('#explore-urval-villkor .explore-urval-ofullst').hidden).toBe(true);
    });

    it('är inte en av vänder villkoret', () => {
        const valt = kolumn0()[0];
        change(q('[data-urval-op="0"]'), 'inteEnAv');
        expect(kolumn0()).not.toContain(valt);
        expect(kolumn0().length).toBeGreaterThan(0);
    });

    it('byte från kategori till tal tömmer värdet och ger en taljämförelse', () => {
        change(q('[data-urval-falt="0"]'), 'lon');
        const v = win.__utforskaUrval().urval.villkor[0];
        expect(v).toEqual({ falt: 'lon', op: 'minst', varde: null, inte: false });
        expect(q('[data-urval-tal="0"]')).not.toBeNull();
    });

    it('sifferfält ritar inte om på input, men på change', () => {
        const falt = q('[data-urval-tal="0"]');
        falt.value = '35000';
        falt.dispatchEvent(new win.Event('input', { bubbles: true }));
        expect(win.__utforskaUrval().urval.villkor[0].varde).toBeNull();
        change(falt);
        expect(win.__utforskaUrval().urval.villkor[0].varde).toBe(35000);
        expect(q('[data-urval-tal="0"]')).toBe(falt);
    });

    it('mellan ger två sifferfält', () => {
        change(q('[data-urval-op="0"]'), 'mellan');
        expect(win.document.querySelectorAll('[data-urval-tal="0"]')).toHaveLength(2);
        expect(win.__utforskaUrval().urval.villkor[0]).toEqual({ falt: 'lon', op: 'mellan', varde: [null, null], inte: false });
    });

    it('alla/något styr hur villkoren kombineras', () => {
        const rows = win.__hamtaData();
        const [b1, b2] = [...new Set(rows.map(r => r.bas))].sort((a, b) => a.localeCompare(b, 'sv'));
        win.__utforskaSattUrval({ lage: 'alla', villkor: [
            { falt: 'bas', op: 'enAv', varde: [b1], inte: false },
            { falt: 'bas', op: 'enAv', varde: [b2], inte: false }] });
        win.__ritaUtforska();
        expect(kolumn0()).toEqual([]);
        change($('explore-urval-lage'), 'nagot');
        expect(kolumn0()).toEqual([b1, b2]);
    });

    it('ta bort ett villkor', () => {
        q('[data-urval-bort="person:1"]').click();
        expect(win.__utforskaUrval().urval.villkor).toHaveLength(1);
    });

    it('gruppvillkor döljer grupper och noten säger hur många', () => {
        grund();
        const alla = kolumn0().length;
        q('[data-urval-lagg-till="grupp"]').click();
        change(q('[data-gv-matt="0"]'), 'n');
        change(q('[data-gv-op="0"]'), 'minst');
        change(q('[data-gv-tal="0"]'), '100000');
        expect(kolumn0()).toEqual([]);
        expect($('chart-explore').textContent).toContain('Inga grupper att visa');
        expect($('explore-note').textContent).toContain(`${alla} grupper döljs av gruppvillkoren`);
    });

    it('diagramdatan får urvalet som rad 2', () => {
        grund();
        win.__utforskaSattUrval({ lage: 'alla', villkor: [{ falt: 'lon', op: 'minst', varde: 30000, inte: false }] });
        win.__ritaUtforska();
        const rader = win.__diagramexportRader($('chart-explore'));
        expect(rader[1][0].replace(/ /g, ' ')).toBe('Urval: Alla av: Lön minst 30 000 kr');
    });

    it('utan villkor har diagramdatan ingen urvalsrad', () => {
        grund();
        expect(win.__diagramexportRader($('chart-explore'))[1][0]).toBe('Serie');
    });

    it('Rensa allt tar bort alla villkor', () => {
        win.__utforskaSattUrval({ lage: 'alla', villkor: [{ falt: 'lon', op: 'minst', varde: 30000, inte: false }] },
                               [{ matt: 'n', op: 'minst', varde: 5 }]);
        win.__ritaUtforska();
        $('explore-filter-chips').querySelector('[data-explore-clear]').click();
        expect(win.__utforskaUrval()).toEqual({ urval: { lage: 'alla', villkor: [] }, gruppVillkor: [] });
    });

    it('sökfältet i värdelistan döljer värden som inte matchar', () => {
        grund();
        q('[data-urval-lagg-till="person"]').click();
        change(q('[data-urval-falt="0"]'), 'aid');
        const sok = q('[data-urval-sok="0"]');
        sok.value = 'zzzz-finns-inte';
        sok.dispatchEvent(new win.Event('input', { bubbles: true }));
        const synliga = [...win.document.querySelectorAll('#explore-urval-villkor .explore-filter-val')].filter(l => !l.hidden);
        expect(synliga).toHaveLength(0);
    });
});

describe('Utforska: urval', () => {
    it('värdelistan byggs om när ny data med samma antal rader läses in', () => {
        const w = createAppWindow();
        const rad = bas => ({ bas, kon: 'kvinna', lon: 30000, alder: 40, yrke: '100 X', aid: '100', yrkeLabel: 'X', enhet: '' });
        w.__state.data = Array.from({ length: 12 }, () => rad('E'));
        w.eval('fyllValjare(); lasUppFlikar();');
        w.__utforskaSattUrval({ lage: 'alla', villkor: [{ falt: 'bas', op: 'enAv', varde: [], inte: false }] });
        w.__ritaUtforska();
        w.__state.data = Array.from({ length: 12 }, () => rad('X'));
        w.__ritaUtforska();
        const varden = [...w.document.querySelectorAll('[data-urval-varde="0"]')].map(b => b.value);
        expect(varden).toEqual(['X']);
    });

    it('fokus stannar på jämförelselistan när man byter jämförelse', () => {
        const w = createAppWindow();
        w.__lasInDemodata();
        w.document.querySelector('.nav-item[data-tab="utforska"]').click();
        w.__utforskaSattUrval({ lage: 'alla', villkor: [{ falt: 'lon', op: 'minst', varde: null, inte: false }] },
                             [{ matt: 'gap', op: 'mindre', varde: null }]);
        w.__ritaUtforska();
        for (const sel of ['[data-urval-op="0"]', '[data-urval-falt="0"]', '[data-gv-op="0"]', '[data-gv-matt="0"]']) {
            const el = w.document.querySelector(sel);
            el.focus();
            el.value = el.options[1].value;
            el.dispatchEvent(new w.Event('change', { bubbles: true }));
            expect(w.document.activeElement && w.document.activeElement.matches(sel), sel).toBe(true);
        }
    });
});

describe('Utforska: helhet eller per kön, fler rader, urval alltid synligt', () => {
    const $ = id => win.document.getElementById(id);
    const satt = (id, v) => { $(id).value = v; };
    // Tomlägets rad ("Inga grupper att visa") är ingen grupp.
    const kolumn0 = () => [...$('explore-table').querySelectorAll('tbody tr')].filter(tr => !tr.querySelector('.explore-tom')).map(tr => tr.cells[0].textContent.trim());
    const rita = () => { win.__ritaUtforska(); return $('chart-explore'); };
    const grund = () => {
        satt('explore-rad', 'bas'); satt('explore-kolumn', 'ingen'); satt('explore-measure', 'median');
        satt('explore-typ', 'auto'); satt('explore-visa', 'helhet'); $('explore-inkludera-sma').checked = false;
        win.__utforskaSattFilter({});
    };
    const opt = (id, v) => [...$(id).options].find(o => o.value === v);
    beforeAll(() => { win.__lasInDemodata(); grund(); rita(); });

    it('Visa har Helhet som förval', () => {
        expect($('explore-visa').value).toBe('helhet');
        expect(rita()._figur.lager).toHaveLength(1);
    });

    it('antal kan visas per kön', () => {
        grund(); satt('explore-measure', 'n'); satt('explore-visa', 'kon');
        expect(rita()._figur.lager.map(l => l.serie)).toEqual(['Kvinna', 'Man']);
    });

    it('låddiagram och individpunkter: helhet i en serie, per kön i två', () => {
        for (const typ of ['lada', 'punkter', 'svarm', 'regnmoln']) {
            grund(); satt('explore-typ', typ);
            expect(rita()._figur.lager.map(l => l.serie).filter((n, i, a) => a.indexOf(n) === i)).toEqual(['Alla']);
            satt('explore-visa', 'kon');
            expect(rita()._figur.lager.map(l => l.serie).filter((n, i, a) => a.indexOf(n) === i)).toEqual(['Kvinna', 'Man']);
        }
    });

    it('heatmap per kön visar kvinnor och män sida vid sida, och tabellen har kolumner per kön', () => {
        grund(); satt('explore-kolumn', 'alder'); satt('explore-visa', 'kon');
        const gd = rita();
        // Två paneler sida vid sida, en per kön, med var sitt rutlager.
        expect(gd._figur.paneler).toEqual(['Kvinnor', 'Män']);
        expect(gd._figur.lager.map(l => [l.marke, l.panel])).toEqual([['ruta', 'Kvinnor'], ['ruta', 'Män']]);
        expect(gd.querySelectorAll('svg[data-del="panel"]')).toHaveLength(2);
        const rubriker = [...$('explore-table').querySelectorAll('thead th')].map(th => th.textContent);
        expect(rubriker.some(t => t.endsWith('· Kvinnor'))).toBe(true);
        expect(rubriker.some(t => t.endsWith('· Män'))).toBe(true);
    });

    it('grupperade staplar per kön ger en serie per kolumn och kön', () => {
        grund(); satt('explore-kolumn', 'alder'); satt('explore-typ', 'grupperade');
        // Många kolumnvärden (åldersgrupper): små multiplar — en panel per rad, kolumnvärdena på x-axeln.
        const helhet = rita()._figur;
        expect(helhet.paneler.length).toBeGreaterThan(1);
        expect(new Set(helhet.lager.map(l => l.serie)).size).toBe(1);
        satt('explore-visa', 'kon');
        const gd = rita();
        expect(gd._figur.paneler).toEqual(helhet.paneler);
        expect([...new Set(gd._figur.lager.map(l => l.serie))].sort()).toEqual(['Kvinna', 'Man']);
        expect(gd._figur.lager.every(l => gd._figur.paneler.includes(l.panel))).toBe(true);
        expect(gd.querySelectorAll('svg[data-del="panel"]').length).toBe(gd._figur.paneler.length);
    });

    it('hanteldiagrammet visar alltid per kön och bubbeldiagrammet alltid helhet', () => {
        grund(); satt('explore-typ', 'hantel'); rita();
        expect(opt('explore-visa', 'helhet').disabled).toBe(true);
        expect($('explore-visa-not').textContent).toMatch(/per kön/);
        grund(); satt('explore-typ', 'bubbla'); satt('explore-visa', 'kon'); rita();
        expect(opt('explore-visa', 'kon').disabled).toBe(true);
        expect(rita()._figur.lager).toHaveLength(1);
    });

    it('valet per kön kommer tillbaka när det åter går', () => {
        grund(); satt('explore-visa', 'kon'); satt('explore-measure', 'gap');
        // Gapet jämför redan könen: helhet, med en serie per status (inte per kön).
        expect(rita()._figur.lager.some(l => l.serie === 'Kvinna' || l.serie === 'Man')).toBe(false);
        satt('explore-measure', 'median');
        expect(rita()._figur.lager.filter(l => l.marke !== 'intervall').map(l => l.serie)).toEqual(['Kvinna', 'Man']);
    });

    it('Rader har hela urvalet, yrkesgrupp inom BAS och lönespann; Kolumner inte hela urvalet', () => {
        for (const v of ['alla', 'aidbas', 'lonespann']) expect(opt('explore-rad', v)).toBeTruthy();
        expect(opt('explore-kolumn', 'alla')).toBeUndefined();
        expect(opt('explore-kolumn', 'lonespann')).toBeTruthy();
    });

    it('hela urvalet ger en rad och en rubrik utan "per"', () => {
        grund(); satt('explore-rad', 'alla'); rita();
        expect(kolumn0()).toEqual(['Hela urvalet']);
        expect($('explore-chart-title').textContent).toBe('Median månadslön för hela urvalet');
    });

    it('lönespann sorteras från lägst till högst', () => {
        grund(); satt('explore-rad', 'lonespann'); rita();
        const lagsta = kolumn0().map(l => Number(l.split('–')[0].replace(/\D/g, '')));
        expect(lagsta.length).toBeGreaterThan(2);
        expect(lagsta).toEqual([...lagsta].sort((a, b) => a - b));
    });

    it('klick på en yrkesgrupp inom BAS pekar ut exakt den gruppens dossier', () => {
        const c = win.__gruppdossierKandidater()[0];
        const etikett = win.__hamtaData().map(r => win.__utGruppnyckel(r, 'aidbas')).find(l => l.startsWith(c.aid + ' ') && l.endsWith(` · BAS ${c.bas}`));
        const spec = { rad: 'aidbas', kolumn: null, matt: 'median', delaKon: false, urval: { lage: 'alla', villkor: [] }, gruppVillkor: [] };
        expect(win.__utforskaDossiermal(spec, etikett, null)).toEqual({ key: c.key });
    });

    it('Urval är alltid utfällt, inte en hopfällbar panel', () => {
        const panel = $('explore-urval');
        expect(panel.tagName).not.toBe('DETAILS');
        expect(panel.querySelector('[data-urval-lagg-till="person"]')).not.toBeNull();
    });

    it('heatmapen har en gemensam färgskala även när ena könet saknar celler över tröskeln', () => {
        grund(); satt('explore-rad', 'aid'); satt('explore-kolumn', 'alder'); satt('explore-visa', 'kon');
        const gd = rita();
        // En färgskala per figur, gemensam för båda könens paneler, och en färgstapel i bilden.
        expect(gd._figur.fargskala.doman).toHaveLength(2);
        expect(gd._figur.lager.every(l => l.marke === 'ruta')).toBe(true);
        expect(gd.querySelectorAll('[data-marke="fargstapel"]').length).toBeGreaterThan(0);
    });

    it('heatmapens celltext är aldrig null, och bara ett lager skriver text i varje cell', () => {
        grund(); satt('explore-rad', 'aid'); satt('explore-kolumn', 'alder');
        for (const visa of ['helhet', 'kon']) {
            satt('explore-visa', visa);
            // Varje ruta har ett värde och en text; en cell utan värde ger ingen ruta alls (och därmed ingen text).
            const rutor = rita()._figur.lager.flatMap(l => l.data);
            expect(rutor.length, visa).toBeGreaterThan(0);
            expect(rutor.every(d => typeof d.text === 'string' && d.text !== '' && !/null|undefined|NaN/.test(d.text) && Number.isFinite(d.varde)), visa).toBe(true);
            expect($('chart-explore').textContent, visa).not.toMatch(/null|undefined|NaN/);
        }
    });
});

describe('Utforska: Visa, noter, export och diagram', () => {
    const $ = id => win.document.getElementById(id);
    const satt = (id, v) => { $(id).value = v; };
    const rita = () => { win.__ritaUtforska(); return $('chart-explore'); };
    const grund = () => {
        satt('explore-rad', 'bas'); satt('explore-kolumn', 'ingen'); satt('explore-measure', 'median');
        satt('explore-typ', 'auto'); satt('explore-visa', 'helhet'); $('explore-inkludera-sma').checked = false;
        win.__utforskaSattFilter({});
    };
    beforeAll(() => { win.__lasInDemodata(); grund(); rita(); });

    it('Visa visar det som gäller när det är låst, och ditt val kommer tillbaka', () => {
        grund(); satt('explore-visa', 'kon'); satt('explore-typ', 'bubbla'); rita();
        expect($('explore-visa').value).toBe('helhet');
        satt('explore-typ', 'staplar'); rita();
        expect($('explore-visa').value).toBe('kon');
    });

    it('noten om låst Visa är kopplad till valet och läses upp', () => {
        expect($('explore-visa').getAttribute('aria-describedby')).toBe('explore-visa-not');
        expect($('explore-visa-not').getAttribute('aria-live')).toBe('polite');
    });

    it('rubriken för hela urvalet med kolumn och för bubbeldiagrammet', () => {
        grund(); satt('explore-rad', 'alla'); satt('explore-kolumn', 'alder'); rita();
        expect($('explore-chart-title').textContent).toBe('Median månadslön per åldersgrupp för hela urvalet');
        grund(); satt('explore-rad', 'alla'); satt('explore-typ', 'bubbla'); rita();
        expect($('explore-chart-title').textContent).toBe('Median mot andel kvinnor för hela urvalet');
    });

    it('bubbeldiagrammets streck för könsdominans följer kvinnotröskeln i Likvärdigt arbete', () => {
        grund(); satt('explore-typ', 'bubbla'); rita();
        expect($('chart-explore')._figur.referens.map(r => r.x)).toEqual([40, 60]);
        win.__state.likvardighet.kvinnoTrosholdPct = 70; rita();
        expect($('chart-explore')._figur.referens.map(r => r.x)).toEqual([30, 70]);
        win.__state.likvardighet.kvinnoTrosholdPct = 60;
    });
    it('antal per kön följer med i exporten som kolumnen n (K/M) redan gör', () => {
        const w = createAppWindow();
        const r = (kon, i) => ({ bas: 'A', kon, lon: 30000 + i, alder: 40, yrke: '100 X', aid: '100', yrkeLabel: 'X', enhet: '' });
        w.__state.data = [...Array.from({ length: 12 }, (_, i) => r('man', i)), ...Array.from({ length: 3 }, (_, i) => r('kvinna', i))];
        w.eval('fyllValjare(); lasUppFlikar();');
        const d = w.document;
        d.getElementById('explore-measure').value = 'n';
        d.getElementById('explore-visa').value = 'kon';
        w.__ritaUtforska();
        const m = w.__tabellTillMatris('explore-table');
        expect(m[1][m[0].indexOf('Kvinnor')]).toBe('3');
    });

    it('heatmapens celltext har läsbar storlek och döljs när cellerna blir för många', () => {
        grund(); satt('explore-rad', 'bas'); satt('explore-kolumn', 'kon'); rita();
        const liten = $('chart-explore')._figur.lager.find(l => l.marke === 'ruta');
        expect(liten.visaText).toBe(true);
        const celltext = $('chart-explore').querySelector('text[data-marke="rutatext"]');
        if (celltext) expect(Number(celltext.getAttribute('font-size'))).toBeGreaterThanOrEqual(10);
        grund(); satt('explore-rad', 'bas'); satt('explore-kolumn', 'lonespann'); satt('explore-visa', 'kon'); rita();
        const heat = $('chart-explore')._figur;
        expect(heat.x.ordning.length * 2).toBeGreaterThan(12);
        expect(heat.lager.every(l => l.visaText === false)).toBe(true);
        expect($('chart-explore').querySelector('text[data-marke="rutatext"]')).toBeNull();
    });

    it('noten nämner könsvärden under tröskeln när man visar per kön (i exportläget)', () => {
        grund(); win.__state.kLage = 'export'; satt('explore-rad', 'aid'); satt('explore-visa', 'kon'); rita(); win.__state.kLage = 'skarm';
        expect($('explore-note').textContent).toMatch(/könsvärden bygger på färre än 10 personer/);
    });

    it('grupperade staplar per kön: en förklaringsrad per kolumnvärde, männen ljusare; ränder bara för små grupper', () => {
        // Få kolumnvärden: staplarna grupperas bredvid varandra (många ger små multiplar, se testet ovan).
        const cell = (rad, kol, nKv, nMa) => ({ rad, kol, n: nKv + nMa, nKv, nMa, value: 30000, valueKv: 29000, valueMa: 31000, liten: nKv + nMa < 10, konLiten: nKv < 10 || nMa < 10 });
        win.__m = { spec: { matt: 'median', delaKon: true }, radEtiketter: ['A', 'B'], kolumnEtiketter: ['X', 'Y'],
            celler: [cell('A', 'X', 12, 12), cell('A', 'Y', 3, 14), cell('B', 'X', 2, 3), cell('B', 'Y', 11, 10)] };
        win.__state.kLage = 'export';   // ränderna följer den inställda tröskeln, som i exporten (ADR-51)
        const f = win.eval('_figGrupperade(window.__m)'), lager = f.lager;
        win.__state.kLage = 'skarm';
        expect(f.paneler).toBeUndefined();
        const man = lager.filter(l => l.serie.endsWith('· Man'));
        expect(man.length).toBe(2);
        expect(man.every(l => l.legend === false && l.opacitet < 1)).toBe(true);
        expect(lager.filter(l => l.legend !== false).every(l => l.serie.endsWith('· Kvinna'))).toBe(true);
        expect(f.x.titel).toMatch(/kvinnor.*män/i);
        // Ränder betyder "under tröskeln" (WCAG 1.4.1), aldrig kön: streckad kant på exakt de små datapunkternas staplar.
        win.__f = f;
        const svg = win.eval('_rfByggSvg(window.__f, 700, { visaSma: true })');
        const sma = lager.reduce((n, l) => n + l.data.filter(d => d.liten).length, 0);
        expect(sma).toBe(3);   // tre kvinnor i A·Y, och hela B·X för båda könen   // tre kvinnor i A·Y, och hela B·X för båda könen
        expect(svg.querySelectorAll('rect[data-marke="stapel"][stroke-dasharray]').length).toBe(sma);
    });
});

describe('Utforska: tomläge, exportmeny och talfält', () => {
    const $ = id => win.document.getElementById(id);
    const q = sel => win.document.querySelector(sel);
    const satt = (id, v) => { $(id).value = v; };
    const vanta = () => new Promise(r => setTimeout(r, 0));
    const rita = () => { win.__ritaUtforska(); return $('chart-explore'); };
    const grund = () => {
        satt('explore-rad', 'bas'); satt('explore-kolumn', 'ingen'); satt('explore-measure', 'median');
        satt('explore-typ', 'auto'); satt('explore-visa', 'helhet'); $('explore-inkludera-sma').checked = false;
        win.__utforskaSattFilter({});
    };
    const tomtUrval = () => win.__utforskaSattUrval({ lage: 'alla', villkor: [{ falt: 'lon', op: 'mindre', varde: 1, inte: false }] });
    const meny = () => $('chart-explore').parentElement.querySelector('.chart-export');
    const verktyg = () => $('explore-table').closest('.table-container').previousElementSibling;
    beforeAll(async () => { win.__lasInDemodata(); win.document.querySelector('.nav-item[data-tab="utforska"]').click(); grund(); rita(); await vanta(); });

    it('tomläget döljer exportmenyn och tabellverktygen, och de kommer tillbaka', () => {
        grund(); tomtUrval(); rita();
        expect(meny().hidden).toBe(true);
        expect(verktyg().classList.contains('table-tools')).toBe(true);
        expect(verktyg().hidden).toBe(true);
        expect($('explore-table').textContent).toContain('Inga grupper att visa');
        grund(); rita();
        expect(meny().hidden).toBe(false);
        expect(verktyg().hidden).toBe(false);
    });

    it('efter ett val i exportmenyn går fokus tillbaka till knappen', async () => {
        grund(); rita();
        const knapp = meny().querySelector('.chart-export-btn');
        knapp.click();
        meny().querySelector('[data-chart-export="data-csv"]').click();
        await vanta(); await vanta();
        expect(win.document.activeElement).toBe(knapp);
    });

    it('menyn stängs när fokus lämnar den', () => {
        const knapp = meny().querySelector('.chart-export-btn');
        knapp.click();
        const lista = meny().querySelector('.chart-export-meny');
        expect(lista.hidden).toBe(false);
        meny().dispatchEvent(new win.FocusEvent('focusout', { bubbles: true, relatedTarget: win.document.body }));
        expect(lista.hidden).toBe(true);
    });

    it('klick på en tom heatmap-cell gör ingenting', () => {
        grund(); rita();
        const fore = $('explore-note').textContent;
        // En tom cell ritas inte och kan inte klickas; ett anrop utan datapunkt eller utan etikett gör ingenting.
        win.__utforskaVidKlick(null);
        win.__utforskaVidKlick({});
        expect($('explore-note').textContent).toBe(fore);
        expect($('dossier-modal').style.display).not.toBe('flex');
    });

    it('ett diagram utan några värden visar tomläget', () => {
        grund(); satt('explore-rad', 'kon'); satt('explore-measure', 'gap'); rita();
        expect($('chart-explore').textContent).toContain('Inga grupper att visa');
    });

    it('byte av talfält tömmer värdet (lön och ålder har olika enheter)', () => {
        grund();
        win.__utforskaSattUrval({ lage: 'alla', villkor: [{ falt: 'lon', op: 'minst', varde: 30000, inte: false }] });
        rita();
        const f = q('[data-urval-falt="0"]'); f.value = 'alder'; f.dispatchEvent(new win.Event('change', { bubbles: true }));
        expect(win.__utforskaUrval().urval.villkor[0]).toEqual({ falt: 'alder', op: 'minst', varde: null, inte: false });
    });

    it('tabellens export börjar med urvalet när ett villkor är aktivt', () => {
        grund();
        win.__utforskaSattUrval({ lage: 'alla', villkor: [{ falt: 'lon', op: 'minst', varde: 30000, inte: false }] });
        rita();
        const m = win.__tabellTillMatris('explore-table');
        expect(m[0][0].replace(/\u00a0/g, ' ')).toBe('Urval: Alla av: Lön minst 30 000 kr');
        grund(); rita();
        expect(win.__tabellTillMatris('explore-table')[0][0]).toBe('BAS-intervall');
    });
});

describe('Utforska: slå ihop små yrkesgrupper', () => {
    const w = createAppWindow();
    const p = (aid, label, n) => Array.from({ length: n }, (_, i) => ({ aid, yrke: `${aid} ${label}`, yrkeLabel: label, bas: 'C',
        kon: i % 2 ? 'man' : 'kvinna', lon: 30000 + i * 37, alder: 30 + i, radnr: i + 2 }));
    w.__state.data = [...p('207011', 'Usk', 24), ...p('207024', 'Vb', 5), ...p('207009', 'Usk hemtj', 7), ...p('502010', 'Sysutv', 22)];
    w.eval('fyllValjare(); lasUppFlikar();');
    const d = w.document;
    const satt = (id, v) => { d.getElementById(id).value = v; };
    it('rutan syns bara när raderna är yrkesgrupper', () => {
        w.__ritaFlik('utforska');
        satt('explore-rad', 'bas'); w.__ritaUtforska();
        expect(d.getElementById('explore-sla-ihop-rad').hidden).toBe(true);
        satt('explore-rad', 'aid'); w.__ritaUtforska();
        expect(d.getElementById('explore-sla-ihop-rad').hidden).toBe(false);
    });
    it('ikryssad: små yrken i samma AID-mellannivå visas som en grupp (i exportläget; på skärmen är inga grupper små, ADR-51)', () => {
        satt('explore-rad', 'aid'); satt('explore-kolumn', 'ingen');
        d.getElementById('explore-sla-ihop').checked = true;
        w.__state.kLage = 'export';
        w.__ritaUtforska();
        expect(d.getElementById('explore-table').textContent).toMatch(/Övriga i AID 2070xx \(2 AID-etiketter\)/);
        d.getElementById('explore-sla-ihop').checked = false;
        w.__ritaUtforska();
        expect(d.getElementById('explore-table').textContent).not.toMatch(/Övriga i/);
        w.__state.kLage = 'skarm';
    });
    it('klick på en hopslagen grupp förklarar sammanslagningen, inte "under 10"', () => {
        satt('explore-rad', 'aid'); satt('explore-kolumn', 'ingen');
        d.getElementById('explore-sla-ihop').checked = true;
        w.__ritaUtforska();
        w.eval(`utforskaVidKlick({ rad: 'Övriga i AID 2070xx (2 AID-etiketter)', kol: null })`);
        const not = d.getElementById('explore-note').textContent;
        expect(not).toMatch(/slagits ihop av flera små AID-etiketter/);
        expect(not).not.toMatch(/minst 10 personer/);
        d.getElementById('explore-sla-ihop').checked = false;
    });
    it('Lika arbete påverkas aldrig av hopslagningen', () => {
        d.getElementById('explore-sla-ihop').checked = true;
        w.__ritaUtforska();
        w.__ritaFlik('matrix');
        expect(d.getElementById('matrix-table').textContent).not.toMatch(/Övriga i/);
    });
});

// "Rensa all data" (Art. 17-affordansen) ska tömma ALLT minne med individrader —
// även Utforskas egna referenser (senaste modellen, urvalets värdelistor och
// diagrammets exportfunktion), som annars höll kvar hela underlaget.
describe('Rensa all data tömmer även Utforska', () => {
    it('inga individrader finns kvar i Utforskas minne efter rensning', () => {
        const w = createAppWindow();
        w.__lasInDemodata();
        w.__ritaFlik('utforska');
        expect(w.__utforskaMinne().rows).toBeGreaterThan(0);
        w.__rensaAllData();
        expect(w.__state.data).toHaveLength(0);
        expect(w.__utforskaMinne()).toEqual({ rows: 0, urval: 0, exportFigur: 'undefined' });
    });
});

describe('Löneöversikten i Utforska', () => {
    const rita = () => { const w = createAppWindow(); w.__lasInDemodata(); w.__ritaFlik('utforska'); return w; };
    it('heter Löneöversikt, och sökfältet säger vad man söker på', () => {
        const html = las('src/index.html');
        expect(html).not.toMatch(/Hierarkisk Rapport/i);
        expect(html).toContain('>Löneöversikt — alla BAS-intervall</h2>');
        const w = createAppWindow();
        expect(w.document.getElementById('search-rapport').placeholder).toBe('Sök AID eller BAS');
    });
    it('jämförelsestatistikens kolumner visas bara när en statistik är inläst', () => {
        const w = rita();
        const t = w.document.getElementById('rapport-table');
        expect(w.__state.statistik.length).toBe(0);
        expect(t.classList.contains('utan-jamforelse')).toBe(true);
        expect(t.querySelectorAll('thead th').length).toBe(8);   // kolumnerna står kvar för exporten
        expect(las('src/style.css')).toContain('#rapport-table.utan-jamforelse :is(th, td):nth-child(n+7) { display: none; }');
        w.__state.statistik = [{ aid: '207011', bas: 'C', median: 30000 }];
        w.__ritaFlik('utforska');
        expect(t.classList.contains('utan-jamforelse')).toBe(false);
    });
    it('lönespridningen skrivs med decimalkomma och bär talet för sortering och export', () => {
        const w = rita();
        const celler = [...w.document.querySelectorAll('#rapport-table tbody tr:not(.group-header)')].map(tr => tr.cells[5]).filter(Boolean);
        const tal = celler.filter(td => /\d/.test(td.textContent));
        expect(tal.length).toBeGreaterThan(5);
        for (const td of tal) {
            expect(td.textContent).toMatch(/^\d,\d\d$/);
            expect(td.getAttribute('data-sort-value')).toBe(td.textContent.replace(',', '.'));
        }
    });
    it('BAS-grupperna är hopfällda utom den första; valet står kvar när tabellen ritas om, och en sökning visar träffar i alla', async () => {
        const w = rita();
        const d = w.document;
        const rubriker = () => [...d.querySelectorAll('#rapport-table tbody tr.group-header')];
        const synliga = tr => { const ut = []; for (let n = tr.nextElementSibling; n && !n.classList.contains('group-header'); n = n.nextElementSibling) ut.push(n.style.display !== 'none'); return ut; };
        expect(rubriker().length).toBeGreaterThan(2);
        expect(rubriker().map(tr => tr.classList.contains('collapsed'))).toEqual(rubriker().map((_, i) => i > 0));
        expect(synliga(rubriker()[0]).every(Boolean)).toBe(true);
        expect(synliga(rubriker()[1]).some(Boolean)).toBe(false);
        rubriker()[1].firstElementChild.click();
        await new Promise(r => setTimeout(r, 10));
        w.__ritaFlik('utforska');
        expect(rubriker()[1].classList.contains('collapsed')).toBe(false);
        expect(synliga(rubriker()[1]).every(Boolean)).toBe(true);
        const sok = d.getElementById('search-rapport');
        sok.value = 'kvinna'; sok.dispatchEvent(new w.Event('input', { bubbles: true }));
        expect(rubriker().some(tr => tr.classList.contains('collapsed'))).toBe(false);
        expect(rubriker().every(tr => synliga(tr).some(Boolean))).toBe(true);
        sok.value = ''; sok.dispatchEvent(new w.Event('input', { bubbles: true }));
        expect(rubriker()[2].classList.contains('collapsed')).toBe(true);
    });
    it('PDF-rapportens kopia av en tabell har alla rader synliga, också hopfällda grupper och ansvarsrader', () => {
        const w = rita();
        w.__ritaFlik('matrix');
        for (const id of ['rapport-table', 'matrix-table']) {
            const klon = w.eval(`_exportVisaAllaRader(document.getElementById('${id}').cloneNode(true))`);
            expect([...klon.querySelectorAll('tbody tr')].filter(tr => tr.hidden || tr.style.display === 'none' || tr.classList.contains('collapsed')).length, id).toBe(0);
        }
        expect(w.document.querySelectorAll('#matrix-table tr.la-underrad-ansvar[hidden]').length).toBeGreaterThan(0);   // skärmens tabell är orörd
        expect(las('src/app/60-utskrift.js')).toContain('_exportUtanSkarmkolumner(_exportVisaAllaRader(t.cloneNode(true)))');   // utskriften: alla rader, utan skärmens egna kolumner
    });
    it('i arbetsboken är också de hopfällda raderna synliga', () => {
        const w = rita();
        const klon = w.eval("_tabellkopiaForExport('rapport-table')");
        expect([...klon.querySelectorAll('tbody tr')].filter(tr => tr.style.display === 'none').length).toBe(0);
        expect(w.document.querySelectorAll('#rapport-table tbody tr[style*="display: none"]').length).toBeGreaterThan(0);
    });
});

describe('utforskartabellens sortering efter omritning', () => {
    it('utforskartabellen går att sortera även efter omritning', () => {
        win.__lasInDemodata();
        win.__ritaUtforska();
        win.__ritaUtforska();            // andra renderingen: tabellhuvudet behåller sina lyssnare
        const th = win.document.querySelectorAll('#explore-table thead th');
        expect(th.length).toBeGreaterThan(0);
        // aktiveraSortering märker sorterbara kolumner med .sortable — saknas den
        // har lyssnarna inte registrerats om.
        expect(th[0].classList.contains('sortable')).toBe(true);
    });
});

describe('sortering med en notrad', () => {
    it('sortering: en notrad (colspan, utan värde) stannar sist i sin grupp åt båda håll', () => {
        const w = createAppWindow();
        const d = w.document;
        const t = d.createElement('table'); t.id = 'sorttest';
        t.innerHTML = '<thead><tr><th>Namn</th><th>Värde</th></tr></thead><tbody>'
            + '<tr class="group-header"><td colspan="2">BAS A</td></tr>'
            + '<tr><td>x</td><td data-sort-value="1">1</td></tr><tr><td>y</td><td data-sort-value="2">2</td></tr>'
            + '<tr><td colspan="2">not</td></tr></tbody>';
        d.body.appendChild(t);
        w.aktiveraSortering('sorttest');
        const th = t.querySelectorAll('th')[1];
        for (let i = 0; i < 2; i++) {
            th.click();
            const rader = [...t.querySelectorAll('tbody tr')].map(r => r.textContent);
            expect(rader[rader.length - 1]).toBe('not');
        }
    });
});

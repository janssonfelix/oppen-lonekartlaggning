import { describe, it, expect, vi } from 'vitest';
import { createAppWindow } from './helpers/app-harness.js';
import { laddaXlsx, fangaBocker } from './helpers/ktroskel-rigg.js';
vi.setConfig({ testTimeout: 30000 });
// Demot förifyller sakliga skäl på tre rader (56-handlingsplan.js, _hpDemoSkal); testerna här börjar från en tom plan.
const fonster = () => { const w = createAppWindow(); w.__loadDemoData(); w.__state.handlingsplan = {}; return w; };
const UNDERLAG = ['Prioritering (under referensen)', 'Likvärdigt arbete (kandidatpar)'];
const rader = w => [...w.document.querySelectorAll('#handlingsplan-tbody tr.handlingsplan-seeded')];
const fyll = (w, el, varde) => { el.value = varde; el.dispatchEvent(new w.Event(el.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true })); };

describe('Handlingsplan: fälten fylls i på skärmen', () => {
    it('raderna har yrkesnamn i samma form och säger var de kommer ifrån; ingressen stämmer med etiketterna', () => {
        const w = fonster();
        w.__renderTabContent('handlingsplan');
        const r = rader(w);
        expect(r.length).toBeGreaterThan(0);
        for (const tr of r) {
            expect(tr.cells[1].textContent).toMatch(/^\d+ \S.* · BAS \S+$/);
            expect(UNDERLAG).toContain(tr.cells[3].textContent);   // efter Åtgärd, grupp och Antal berörda
        }
        const antal = etikett => r.filter(tr => tr.cells[3].textContent === etikett).length;
        const not = w.document.getElementById('handlingsplan-seed-note').textContent;
        expect(not).toContain(`${antal(UNDERLAG[0])} från Prioritering, under referensen, och ${antal(UNDERLAG[1])} kandidatpar från Likvärdigt arbete`);
        expect(w.document.querySelector('.handlingsplan-not').textContent).toMatch(/följer med i Excel-filen, utskriften och Word-utkastet, men sparas inte/);
    });
    it('fälten har etiketter med yrke och kolumn, lagras i state och står kvar efter flikbyte', () => {
        const w = fonster();
        w.__renderTabContent('handlingsplan');
        const tr = rader(w)[0], grupp = tr.cells[1].textContent;
        const [sakligt, ansvarig, tidsplan, status] = [4, 7, 8, 9].map(i => tr.cells[i].querySelector('.hp-falt'));
        expect(sakligt.tagName).toBe('SELECT');
        expect([...sakligt.options].map(o => o.textContent)).toEqual(['—', 'Ja, sakligt skäl finns', 'Nej, åtgärd behövs', 'Pågår']);
        expect([...status.options].map(o => o.value)).toEqual(['', 'Planerad', 'Pågår', 'Genomförd', 'Skjuts upp']);
        expect(ansvarig.getAttribute('aria-label')).toBe(`Ansvarig: ${grupp}`);
        expect(sakligt.getAttribute('aria-label')).toBe(`Sakliga skäl prövade?: ${grupp}`);
        fyll(w, sakligt, 'Nej, åtgärd behövs'); fyll(w, ansvarig, 'HR-chef'); fyll(w, tidsplan, 'Lönerevisionen 2027'); fyll(w, status, 'Planerad');
        const nyckel = ansvarig.dataset.hpNyckel;
        expect(w.__state.handlingsplan[nyckel]).toEqual({ sakligt: 'Nej, åtgärd behövs', ansvarig: 'HR-chef', tidsplan: 'Lönerevisionen 2027', status: 'Planerad' });
        w.__renderTabContent('dashboard'); w.__renderTabContent('handlingsplan');
        const igen = rader(w)[0];
        expect(igen.cells[7].querySelector('input').value).toBe('HR-chef');
        expect(igen.cells[9].querySelector('select').value).toBe('Planerad');
    });
    it('ett fält som liknar ett personnummer varnar men texten står kvar', () => {
        const w = fonster();
        w.__renderTabContent('handlingsplan');
        const varning = w.document.getElementById('handlingsplan-varning');
        expect(varning.hidden).toBe(true);
        const falt = rader(w)[0].cells[7].querySelector('input');
        fyll(w, falt, '19800101-1234');
        expect(varning.hidden).toBe(false);
        expect(falt.getAttribute('aria-describedby')).toBe('handlingsplan-varning');
        expect(w.__state.handlingsplan[falt.dataset.hpNyckel].ansvarig).toBe('19800101-1234');
        fyll(w, falt, 'HR-chef');
        expect(varning.hidden).toBe(true);
    });
    it('följer med i konfigurationsfilen och läses in igen; felaktiga val läses som tomma', () => {
        const a = fonster();
        a.__renderTabContent('handlingsplan');
        const falt = rader(a)[0].cells[7].querySelector('input');
        fyll(a, falt, 'Avdelningschef');
        const cfg = JSON.parse(a.eval('JSON.stringify(buildConfigSnapshot())'));
        expect(cfg.handlingsplan).toEqual([{ nyckel: falt.dataset.hpNyckel, sakligt: '', ansvarig: 'Avdelningschef', tidsplan: '', status: '' }]);
        const b = fonster();
        b.__cfg = { ...cfg, handlingsplan: [...cfg.handlingsplan, { nyckel: 'prio|9|Z', status: 'Okänd', tidsplan: 'Hösten' }] };
        b.eval('applyConfigSnapshot(window.__cfg)');
        expect(b.__state.handlingsplan[falt.dataset.hpNyckel].ansvarig).toBe('Avdelningschef');
        expect(b.__state.handlingsplan['prio|9|Z']).toEqual({ sakligt: '', ansvarig: '', tidsplan: 'Hösten', status: '' });
        b.__renderTabContent('handlingsplan');   // en rad som inte finns i underlaget ritas inte och kraschar inget
        expect(rader(b).length).toBe(rader(a).length);
        expect(() => b.eval("applyConfigSnapshot({ version: 2, handlingsplan: [{ nyckel: 5 }] })")).toThrow();
    });
    it('följer med i Excel-filen, Word-utkastets åtgärdstabell och utskriften', async () => {
        const w = fonster();
        await laddaXlsx(w);
        w.__renderTabContent('handlingsplan');
        const tr = rader(w)[0];
        fyll(w, tr.cells[4].querySelector('select'), 'Ja, sakligt skäl finns'); fyll(w, tr.cells[7].querySelector('input'), 'HR-chef');
        const bok = Object.values(fangaBocker(w, () => w.eval('exportHandlingsplan()')))[0];
        const rad = bok.split('\n').find(l => l.includes('HR-chef'));
        expect(rad).toContain('Ja, sakligt skäl finns');
        expect(rad).toContain(tr.cells[1].textContent);
        expect(bok).toContain('Åtgärd | Grupp (yrke och BAS-intervall) | Antal berörda | Underlag | Sakliga skäl prövade?');
        const atgarder = w.eval('rapportModell({ alla: true })').avsnitt.find(a => a.id === 'atgarder');
        const tabell = atgarder.delar.find(p => p.typ === 'tabell');
        expect(tabell.kolumner.map(k => k.rubrik)).toEqual(['Grupp', 'Antal berörda', 'Underlag', 'Uppskattad kostnad', 'Kostnaden avser', 'Sakliga skäl prövade?', 'Ansvarig', 'Tidsplan (senast inom tre år)', 'Status']);
        expect(tabell.rader.find(r => r[0] === tr.cells[1].textContent).slice(5, 7)).toEqual(['Ja, sakligt skäl finns', 'HR-chef']);
        const oppnat = [];
        w.open = () => { const doc = { html: '', write(s) { this.html += s; }, close() {}, adoptedStyleSheets: [], createElement: () => ({ sheet: { insertRule() {}, cssRules: [] } }), head: { appendChild() {} } };
            oppnat.push(doc); return { document: doc, focus() {}, print() {} }; };
        w.eval("printScaffoldView('view-handlingsplan', 'Handlingsplan')");
        expect(oppnat[0].html).toContain('HR-chef');
        expect(oppnat[0].html).not.toContain('hp-falt');
    });
    it('en egen rad läggs till, fylls i, följer med i underlaget och konfigurationsfilen, och tas bort', () => {
        const w = fonster();
        w.__renderTabContent('handlingsplan');
        const fore = rader(w).length;
        w.document.getElementById('btn-hp-lagg-till').click();
        const egen = w.document.querySelector('#handlingsplan-tbody tr.handlingsplan-egen');
        expect(rader(w).length).toBe(fore + 1);
        expect(rader(w)[fore]).toBe(egen);   // sist
        expect(egen.cells[3].textContent).toContain('Egen rad');
        expect(w.document.activeElement).toBe(egen.cells[0].querySelector('input'));
        fyll(w, egen.cells[0].querySelector('input'), 'Se över lönekriterierna');
        fyll(w, egen.cells[1].querySelector('input'), 'Alla chefer');
        fyll(w, egen.cells[9].querySelector('select'), 'Planerad');
        const nyckel = egen.cells[0].querySelector('input').dataset.hpNyckel;
        expect(nyckel).toMatch(/^egen\|/);
        expect(w.__state.handlingsplan[nyckel]).toMatchObject({ egen: true, atgard: 'Se över lönekriterierna', grupp: 'Alla chefer', status: 'Planerad' });
        const seed = w.eval('_handlingsplanSeedRows()');
        expect(seed.egenCount).toBe(1);
        expect(seed.rows[seed.rows.length - 1]).toEqual(['Se över lönekriterierna', 'Alla chefer', 'Egen rad', '', null, '', '', 'Planerad', null]);
        expect(w.document.getElementById('handlingsplan-seed-note').textContent).toContain('En egen rad står sist.');
        // Konfigurationsfilen bär raden med åtgärd och grupp; en annan session läser in den igen.
        const cfg = JSON.parse(w.eval('JSON.stringify(buildConfigSnapshot())'));
        expect(cfg.handlingsplan.find(r => r.nyckel === nyckel)).toMatchObject({ egen: true, atgard: 'Se över lönekriterierna', grupp: 'Alla chefer' });
        const b = fonster();
        b.__cfg = cfg; b.eval('applyConfigSnapshot(window.__cfg)'); b.__renderTabContent('handlingsplan');
        expect(b.document.querySelectorAll('#handlingsplan-tbody tr.handlingsplan-egen')).toHaveLength(1);
        expect(b.document.querySelector('#handlingsplan-tbody tr.handlingsplan-egen').cells[1].querySelector('input').value).toBe('Alla chefer');
        // Översikt-kortet räknar raderna efter status, inte åtgärdslistans bockar.
        b.eval('renderProcessTracker()');
        const kort = [...b.document.querySelectorAll('.ptrack-detail')].map(el => el.textContent).find(t => /rader genomförda/.test(t));
        expect(kort).toMatch(/^0 av \d+ rader genomförda, 1 planerade eller pågår; \d+ utan något ifyllt\.$/);
        egen.querySelector('[data-hp-ta-bort]').click();
        expect(w.__state.handlingsplan[nyckel]).toBeUndefined();
        expect(rader(w).length).toBe(fore);
    });
    it('Rensa all data nollar fälten', () => {
        const w = fonster();
        w.__renderTabContent('handlingsplan');
        fyll(w, rader(w)[0].cells[8].querySelector('input'), 'Våren');
        expect(Object.keys(w.__state.handlingsplan)).toHaveLength(1);
        w.eval('_rensaAllData()');
        expect(w.__state.handlingsplan).toEqual({});
        expect(w.document.querySelectorAll('#handlingsplan-tbody .hp-falt')).toHaveLength(0);
    });
});

describe('Handlingsplan: Kostnaden avser', () => {
    // Kolumnen säger vilken kostnad raden har (_hpKostnadAvser): rader ur Prioritering lyfts till referensens median,
    // kandidatpar till jämförelseyrkets median; en egen rad har ingen beräknad kostnad.
    const AVSER = { 'Prioritering (under referensen)': 'Nå referensens median', 'Likvärdigt arbete (kandidatpar)': 'Nå jämförelseyrkets median', 'Egen rad': '' };
    const ren = t => String(t ?? '').replace(/\s+/g, ' ').trim();
    const rubrikerAv = tabell => [...tabell.querySelectorAll('thead th')].map(th => ren(th.textContent));
    const excelBlad = w => { let bok = null; w.XLSX.writeFile = wb => { bok = wb; }; w.eval('exportHandlingsplan()'); return w.XLSX.utils.sheet_to_json(bok.Sheets.Handlingsplan, { header: 1, raw: true, defval: '' }); };
    const utskrift = w => {
        let html = '';
        w.open = () => ({ document: { write(s) { html += s; }, close() {}, adoptedStyleSheets: [], createElement: () => ({ sheet: { insertRule() {}, cssRules: [] } }), head: { appendChild() {} } }, focus() {}, print() {} });
        w.eval("printScaffoldView('view-handlingsplan', 'Handlingsplan')");
        const div = w.document.createElement('div');
        div.innerHTML = html.replace(/^[\s\S]*<body>/, '').replace(/<\/body>[\s\S]*$/, '');
        return { html, tabell: div.querySelector('table') };
    };
    const atgardsTabell = w => w.eval('rapportModell({ alla: true })').avsnitt.find(a => a.id === 'atgarder').delar.find(p => p.typ === 'tabell');

    it('fliken, Excel-bladet, utskriften, Word-utkastets åtgärdstabell och rapportunderlaget har kolumnen direkt efter kostnaden', async () => {
        const w = fonster();
        await laddaXlsx(w);
        w.__renderTabContent('handlingsplan');
        w.eval('_hpLaggTillEgen()');
        const skarm = w.eval('_handlingsplanSeedRows()').rows.map(r => r[2]);
        const ut = w.eval('medExportLage(() => _handlingsplanSeedRows())').rows.map(r => r[2]);
        for (const u of [skarm, ut]) { expect(u).toContain(UNDERLAG[0]); expect(u).toContain(UNDERLAG[1]); expect(u.at(-1)).toBe('Egen rad'); }
        const vantat = skarm.map(u => AVSER[u]), vantatUt = ut.map(u => AVSER[u]);
        expect(w.eval('_hpKostnadAvser')(UNDERLAG[0])).toBe('Nå referensens median');
        expect(w.eval('_hpKostnadAvser')(UNDERLAG[1])).toBe('Nå jämförelseyrkets median');
        expect(w.eval('_hpKostnadAvser')('Egen rad')).toBe('');
        // Fliken: rubriken efter kostnaden, ett värde per rad; tomraderna har lika många celler som rubriken.
        const tabell = w.document.querySelector('#handlingsplan-tbody').closest('table');
        const rubr = rubrikerAv(tabell), k = rubr.indexOf('Kostnaden avser');
        expect(rubr[k - 1]).toBe('Beräknad kostnad (kr/år)');
        expect(rader(w).map(tr => ren(tr.cells[k].textContent))).toEqual(vantat);
        for (const tr of tabell.querySelectorAll('tbody tr')) expect(tr.cells.length).toBe(rubr.length);
        // Excel-bladet.
        const blad = excelBlad(w), x = blad[0].indexOf('Kostnaden avser');
        expect(blad[0][x - 1]).toBe('Beräknad kostnad (kr/år, inkl. PO)');
        expect(blad.slice(1, 1 + ut.length).map(r => r[x])).toEqual(vantatUt);
        for (const r of blad) expect(r.length).toBe(blad[0].length);
        // Utskriften av mallen.
        const pr = utskrift(w), prRubr = rubrikerAv(pr.tabell), p = prRubr.indexOf('Kostnaden avser');
        expect(prRubr[p - 1]).toBe('Beräknad kostnad (kr/år)');
        expect([...pr.tabell.querySelectorAll('tbody tr.handlingsplan-seeded')].map(tr => ren(tr.cells[p].textContent))).toEqual(vantat);
        // Word-utkastets (och PDF-rapportens) åtgärdstabell.
        const t = atgardsTabell(w), j = t.kolumner.findIndex(c => c.rubrik === 'Kostnaden avser');
        expect(t.kolumner[j - 1].rubrik).toBe('Uppskattad kostnad');
        expect(t.rader.map(r => w.eval('rmCell')(r[j], t.kolumner[j].typ))).toEqual(vantatUt);
        // Rapportunderlaget.
        const ru = w.__rapportunderlagBlock().find(b => b.id === 'handlingsplan').tabell;
        const q = ru.rubriker.indexOf('Kostnaden avser');
        expect(ru.rubriker[q - 1]).toBe('Uppskattad kostnad per år');
        expect(ru.rader.map(r => r[q])).toEqual(vantatUt);
    });
    it('rapportunderlaget delar summan på de två slagen av kostnad', () => {
        const w = fonster();
        const rader = w.eval('medExportLage(() => _rapportHpRader(_handlingsplanSeedRows().rows))');
        const kr = v => w.eval(`svTal(${v}, 0)`).replace(/\s/g, ' ');
        const summa = u => rader.filter(r => r.underlag === u).reduce((s, r) => s + (r.kostnad || 0), 0);
        const text = ren(w.__ruTillText(w.__rapportunderlagBlock().find(b => b.id === 'handlingsplan')));
        expect(summa(UNDERLAG[0])).toBeGreaterThan(0);
        expect(summa(UNDERLAG[1])).toBeGreaterThan(0);
        expect(text).toContain(`Av den är ${kr(summa(UNDERLAG[0]))} kr kostnad att nå referensens median`);
        expect(text).toContain(`och ${kr(summa(UNDERLAG[1]))} kr kostnad att nå jämförelseyrkets median för kandidatparen i likvärdigt arbete.`);
    });
    it('en plan med bara egna rader ger tomma celler, aldrig undefined eller null', async () => {
        const w = createAppWindow();
        await laddaXlsx(w);
        w.__renderTabContent('handlingsplan');
        w.eval('_hpLaggTillEgen()');
        expect(w.eval('_handlingsplanSeedRows()').rows.map(r => r[2])).toEqual(['Egen rad']);
        const tabell = w.document.querySelector('#handlingsplan-tbody').closest('table');
        const k = rubrikerAv(tabell).indexOf('Kostnaden avser');
        expect(ren(rader(w)[0].cells[k].textContent)).toBe('');
        expect(tabell.textContent).not.toMatch(/undefined|null/);
        const blad = excelBlad(w), x = blad[0].indexOf('Kostnaden avser');
        expect(blad[1][x]).toBe('');
        expect(JSON.stringify(blad)).not.toMatch(/undefined|null/);
        const pr = utskrift(w), p = rubrikerAv(pr.tabell).indexOf('Kostnaden avser');
        expect(ren(pr.tabell.querySelector('tbody tr.handlingsplan-seeded').cells[p].textContent)).toBe('');
        expect(pr.tabell.textContent).not.toMatch(/undefined|null/);
        const t = atgardsTabell(w), j = t.kolumner.findIndex(c => c.rubrik === 'Kostnaden avser');
        expect(w.eval('rmCell')(t.rader[0][j], t.kolumner[j].typ)).toBe('');
        const ru = w.eval('_ruAvsnittBlock')('handlingsplan', { rader: w.eval('_rapportHpRader(_handlingsplanSeedRows().rows)') }, { k: 10 });
        expect(ru.tabell.rader[0][ru.tabell.rubriker.indexOf('Kostnaden avser')]).toBe('');
        expect(JSON.stringify(ru.tabell)).not.toMatch(/undefined|null/);
    });
    it('konfigurationsfilen får inget nytt fält: kolumnen är härledd, och en sparad fil läses in och sparas likadant', () => {
        const a = fonster();
        a.__renderTabContent('handlingsplan');
        fyll(a, rader(a)[0].cells[4].querySelector('select'), 'Pågår');
        a.eval('_hpLaggTillEgen()');
        const cfg = JSON.parse(a.eval('JSON.stringify(buildConfigSnapshot())'));
        const text = JSON.stringify(cfg.handlingsplan);
        expect(text).not.toMatch(/kostnad|Nå referensens median|Nå jämförelseyrkets median/i);
        for (const r of cfg.handlingsplan) expect(Object.keys(r).every(f => ['nyckel', 'sakligt', 'ansvarig', 'tidsplan', 'status', 'egen', 'atgard', 'grupp', 'skal'].includes(f))).toBe(true);
        const b = fonster();
        b.__cfg = cfg; b.eval('applyConfigSnapshot(window.__cfg)');
        expect(JSON.parse(b.eval('JSON.stringify(buildConfigSnapshot())')).handlingsplan).toEqual(cfg.handlingsplan);
    });
});

describe('Löneöversyn: förslaget nås från potten', () => {
    it('knappen vid potten är inaktiv utan pott, aktiv med pott, och fäller ut Riktade potter', () => {
        const w = fonster(); const d = w.document;
        w.__renderTabContent('loneoversyn');
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
        w.__renderTabContent('loneoversyn');
        const lonesumma = () => [...d.querySelectorAll('#lo-slutsatser > *')].find(el => /Lönesumma per månad/.test(el.textContent)).textContent;
        expect(lonesumma()).toMatch(/utgångsläget/);
        expect(lonesumma()).not.toMatch(/från/);
        const gen = d.getElementById('forecast-generell-value');
        gen.value = '2'; gen.dispatchEvent(new w.Event('input', { bubbles: true }));
        expect(lonesumma()).toMatch(/från \d/);
    });
});

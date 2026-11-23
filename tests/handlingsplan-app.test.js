// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
// Handlingsplanen i appen: fälten, det som bara visas i första kolumnen, Kostnaden avser, en AID-kod med två texter
// som en grupp, och tabellens tomma rader på utskriften.
import { describe, it, expect, vi } from 'vitest';
import { createAppWindow, delatFonster } from './helpers/app-harness.js';
import { laddaXlsx, fangaBocker } from './helpers/ktroskel-rigg.js';
import { las } from './helpers/granssnitt-rigg.js';
vi.setConfig({ testTimeout: 30000 });

const demo = delatFonster(w => w.__lasInDemodata());
// Demot förifyller sakliga skäl på tre rader (56-handlingsplan.js, _hpDemoSkal); testerna här börjar från en tom plan.
const fonster = () => { const w = createAppWindow(); w.__lasInDemodata(); w.__state.handlingsplan = {}; return w; };
const UNDERLAG = ['Prioritering (under referensen)', 'Likvärdigt arbete (kandidatpar)'];
const rader = w => [...w.document.querySelectorAll('#handlingsplan-tbody tr.handlingsplan-seeded')];
// Gruppen som i exporterna: på skärmen står BAS och bokstaven ihop med ett hårt mellanslag.
const grupp = tr => tr.cells[1].textContent.replace(/\u00a0/g, ' ');
const fyll = (w, el, varde) => { el.value = varde; el.dispatchEvent(new w.Event(el.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true })); };

describe('Handlingsplan: fälten fylls i på skärmen', () => {
    it('raderna har yrkesnamn i samma form och säger var de kommer ifrån; ingressen stämmer med etiketterna', () => {
        const w = fonster();
        w.__ritaFlik('handlingsplan');
        const r = rader(w);
        expect(r.length).toBeGreaterThan(0);
        for (const tr of r) {
            expect(tr.cells[1].textContent).toMatch(/^\d+ \S.* · BAS\u00a0\S+$/);
            expect(UNDERLAG).toContain(tr.cells[3].textContent);   // efter Åtgärd, grupp och Antal berörda
        }
        const antal = etikett => r.filter(tr => tr.cells[3].textContent === etikett).length;
        const not = w.document.getElementById('handlingsplan-seed-note').textContent;
        expect(not).toContain(`${antal(UNDERLAG[0])} från Prioritering, under referensen, och ${antal(UNDERLAG[1])} kandidatpar från Likvärdigt arbete`);
        expect(w.document.querySelector('.handlingsplan-not').textContent).toMatch(/följer med i Excel-filen, utskriften och Word-utkastet, men sparas inte/);
    });
    it('fälten har etiketter med yrke och kolumn, lagras i state och står kvar efter flikbyte', () => {
        const w = fonster();
        w.__ritaFlik('handlingsplan');
        const tr = rader(w)[0], g = grupp(tr);
        const [sakligt, ansvarig, tidsplan, status] = [4, 7, 8, 9].map(i => tr.cells[i].querySelector('.hp-falt'));
        expect(sakligt.tagName).toBe('SELECT');
        expect([...sakligt.options].map(o => o.textContent)).toEqual(['—', 'Ja, sakligt skäl finns', 'Nej, åtgärd behövs', 'Pågår']);
        expect([...status.options].map(o => o.value)).toEqual(['', 'Planerad', 'Pågår', 'Genomförd', 'Skjuts upp']);
        expect(ansvarig.getAttribute('aria-label')).toBe(`Ansvarig: ${g}`);
        expect(sakligt.getAttribute('aria-label')).toBe(`Sakliga skäl prövade?: ${g}`);
        fyll(w, sakligt, 'Nej, åtgärd behövs'); fyll(w, ansvarig, 'HR-chef'); fyll(w, tidsplan, 'Lönerevisionen 2027'); fyll(w, status, 'Planerad');
        const nyckel = ansvarig.dataset.hpNyckel;
        expect(w.__state.handlingsplan[nyckel]).toEqual({ sakligt: 'Nej, åtgärd behövs', ansvarig: 'HR-chef', tidsplan: 'Lönerevisionen 2027', status: 'Planerad' });
        w.__ritaFlik('dashboard'); w.__ritaFlik('handlingsplan');
        const igen = rader(w)[0];
        expect(igen.cells[7].querySelector('input').value).toBe('HR-chef');
        expect(igen.cells[9].querySelector('select').value).toBe('Planerad');
    });
    it('ett fält som liknar ett personnummer varnar men texten står kvar', () => {
        const w = fonster();
        w.__ritaFlik('handlingsplan');
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
        a.__ritaFlik('handlingsplan');
        const falt = rader(a)[0].cells[7].querySelector('input');
        fyll(a, falt, 'Avdelningschef');
        const cfg = JSON.parse(a.eval('JSON.stringify(byggKonfiguration())'));
        expect(cfg.handlingsplan).toEqual([{ nyckel: falt.dataset.hpNyckel, sakligt: '', ansvarig: 'Avdelningschef', tidsplan: '', status: '' }]);
        const b = fonster();
        b.__cfg = { ...cfg, handlingsplan: [...cfg.handlingsplan, { nyckel: 'prio|9|Z', status: 'Okänd', tidsplan: 'Hösten' }] };
        b.eval('tillampaKonfiguration(window.__cfg)');
        expect(b.__state.handlingsplan[falt.dataset.hpNyckel].ansvarig).toBe('Avdelningschef');
        expect(b.__state.handlingsplan['prio|9|Z']).toEqual({ sakligt: '', ansvarig: '', tidsplan: 'Hösten', status: '' });
        b.__ritaFlik('handlingsplan');   // en rad som inte finns i underlaget ritas inte och kraschar inget
        expect(rader(b).length).toBe(rader(a).length);
        expect(() => b.eval("tillampaKonfiguration({ version: 2, handlingsplan: [{ nyckel: 5 }] })")).toThrow();
    });
    it('följer med i Excel-filen, Word-utkastets åtgärdstabell och utskriften', async () => {
        const w = fonster();
        await laddaXlsx(w);
        w.__ritaFlik('handlingsplan');
        const tr = rader(w)[0];
        fyll(w, tr.cells[4].querySelector('select'), 'Ja, sakligt skäl finns'); fyll(w, tr.cells[7].querySelector('input'), 'HR-chef');
        const bok = Object.values(fangaBocker(w, () => w.eval('exportHandlingsplan()')))[0];
        const rad = bok.split('\n').find(l => l.includes('HR-chef'));
        expect(rad).toContain('Ja, sakligt skäl finns');
        expect(rad).toContain(grupp(tr));
        expect(bok).toContain('Åtgärd | Grupp (AID-etikett och BAS-intervall) | Antal berörda | Underlag | Sakliga skäl prövade?');
        const atgarder = w.eval('rapportModell({ alla: true })').avsnitt.find(a => a.id === 'atgarder');
        const tabell = atgarder.delar.find(p => p.typ === 'tabell');
        expect(tabell.kolumner.map(k => k.rubrik)).toEqual(['Grupp', 'Antal berörda', 'Underlag', 'Uppskattad kostnad', 'Kostnaden avser', 'Sakliga skäl prövade?', 'Ansvarig', 'Tidsplan (senast inom tre år)', 'Status']);
        expect(tabell.rader.find(r => r[0] === grupp(tr)).slice(5, 7)).toEqual(['Ja, sakligt skäl finns', 'HR-chef']);
        const oppnat = [];
        w.open = () => { const doc = { html: '', write(s) { this.html += s; }, close() {}, adoptedStyleSheets: [], createElement: () => ({ sheet: { insertRule() {}, cssRules: [] } }), head: { appendChild() {} } };
            oppnat.push(doc); return { document: doc, focus() {}, print() {} }; };
        w.eval("skrivUtMallflik('view-handlingsplan', 'Handlingsplan')");
        expect(oppnat[0].html).toContain('HR-chef');
        expect(oppnat[0].html).not.toContain('hp-falt');
    });
    it('en egen rad läggs till, fylls i, följer med i underlaget och konfigurationsfilen, och tas bort', () => {
        const w = fonster();
        w.document.querySelector('.nav-item[data-tab="handlingsplan"]').click();
        const fore = rader(w).length;
        w.document.getElementById('btn-hp-lagg-till').click();
        const egen = w.document.querySelector('#handlingsplan-tbody tr.handlingsplan-egen');
        expect(rader(w).length).toBe(fore + 1);
        expect(rader(w)[fore]).toBe(egen);   // sist
        expect(egen.cells[3].textContent).toContain('Egen rad');
        expect(w.document.activeElement).toBe(egen.cells[0].querySelector('input'));
        fyll(w, egen.cells[0].querySelector('input'), 'Se över lönekriterierna');
        fyll(w, egen.cells[0].querySelector('[data-hp-falt="grupp"]'), 'Alla chefer');   // gruppfältet står under åtgärden på skärmen
        expect(egen.cells[1].textContent).toBe('Alla chefer');   // och speglas i utskriftens gruppkolumn
        fyll(w, egen.cells[9].querySelector('select'), 'Planerad');
        const nyckel = egen.cells[0].querySelector('input').dataset.hpNyckel;
        expect(nyckel).toMatch(/^egen\|/);
        expect(w.__state.handlingsplan[nyckel]).toMatchObject({ egen: true, atgard: 'Se över lönekriterierna', grupp: 'Alla chefer', status: 'Planerad' });
        const seed = w.eval('_handlingsplanForifyllning()');
        expect(seed.egenCount).toBe(1);
        expect(seed.rows[seed.rows.length - 1]).toEqual(['Se över lönekriterierna', 'Alla chefer', 'Egen rad', '', null, '', '', 'Planerad', null]);
        expect(w.document.getElementById('handlingsplan-seed-note').textContent).toContain('En egen rad står sist.');
        // Konfigurationsfilen bär raden med åtgärd och grupp; en annan session läser in den igen.
        const cfg = JSON.parse(w.eval('JSON.stringify(byggKonfiguration())'));
        expect(cfg.handlingsplan.find(r => r.nyckel === nyckel)).toMatchObject({ egen: true, atgard: 'Se över lönekriterierna', grupp: 'Alla chefer' });
        const b = fonster();
        b.__cfg = cfg; b.eval('tillampaKonfiguration(window.__cfg)'); b.__ritaFlik('handlingsplan');
        expect(b.document.querySelectorAll('#handlingsplan-tbody tr.handlingsplan-egen')).toHaveLength(1);
        expect(b.document.querySelector('#handlingsplan-tbody tr.handlingsplan-egen').cells[0].querySelector('[data-hp-falt="grupp"]').value).toBe('Alla chefer');
        // Översikt-kortet räknar raderna efter status, inte åtgärdslistans bockar.
        b.eval('ritaKartlaggningensSteg()');
        const kort = [...b.document.querySelectorAll('.ptrack-detail')].map(el => el.textContent).find(t => /rader genomförda/.test(t));
        expect(kort).toMatch(/^0 av \d+ rader genomförda, 1 planerade eller pågår; \d+ utan något ifyllt\.$/);
        egen.querySelector('[data-hp-ta-bort]').click();
        expect(w.__state.handlingsplan[nyckel]).toBeUndefined();
        expect(rader(w).length).toBe(fore);
    });
    it('Rensa all data nollar fälten', () => {
        const w = fonster();
        w.__ritaFlik('handlingsplan');
        fyll(w, rader(w)[0].cells[8].querySelector('input'), 'Våren');
        expect(Object.keys(w.__state.handlingsplan)).toHaveLength(1);
        w.eval('_rensaAllData()');
        expect(w.__state.handlingsplan).toEqual({});
        expect(w.document.querySelectorAll('#handlingsplan-tbody .hp-falt')).toHaveLength(0);
    });
    // S2 i punkt 26: åtgärden tog fyra rader i varje rad, och BAS-bokstaven hamnade ensam på en rad.
    it('åtgärden för ett kandidatpar är kort, och BAS och bokstaven står ihop i gruppkolumnen', () => {
        const w = fonster();
        w.__ritaFlik('handlingsplan');
        const par = rader(w).filter(tr => tr.cells[3].textContent === UNDERLAG[1]);
        expect(par.length).toBeGreaterThan(0);
        for (const tr of par) expect(tr.querySelector('.hp-atgard').textContent.length, tr.cells[0].textContent).toBeLessThanOrEqual(45);
        for (const tr of rader(w)) expect(tr.cells[1].textContent).toMatch(/ · BAS\u00a0\S+$/);
        // Exporterna och fältens etiketter har ett vanligt mellanslag.
        expect(w.eval('_handlingsplanForifyllning({})').rows.map(r => r[1]).join('')).not.toContain('\u00a0');
    });
});

// UX-inventeringen 2026-11-19: mallen var 1 577 punkter bred i en ruta på 1 030, och fälten man fyller i låg utanför
// bild. På skärmen står grupp, antal berörda och underlag under åtgärden; utskriften har kolumnerna som förut. Att
// tabellen ryms i 1280 och 1440 punkter prövar webbläsarröktestet (tools/browser-smoke/layout.mjs).
describe('Handlingsplan: skärmen samlar det som bara visas i första kolumnen', () => {
    const ren = t => String(t ?? '').replace(/\s+/g, ' ').trim();
    const RUBRIKER = ['Åtgärd', 'Grupp (AID-etikett och BAS-intervall)', 'Antal berörda', 'Underlag', 'Sakliga skäl prövade?',
        'Beräknad kostnad (kr/år)', 'Kostnaden avser', 'Ansvarig', 'Tidsplan (senast inom tre år)', 'Status'];
    const utskrift = w => {
        let html = '';
        w.open = () => ({ document: { write(s) { html += s; }, close() {}, adoptedStyleSheets: [], createElement: () => ({ sheet: { insertRule() {}, cssRules: [] } }), head: { appendChild() {} } }, focus() {}, print() {} });
        w.eval("skrivUtMallflik('view-handlingsplan', 'Handlingsplan')");
        const div = w.document.createElement('div');
        div.innerHTML = html.replace(/^[\s\S]*<body>/, '').replace(/<\/body>[\s\S]*$/, '');
        return { html, tabell: div.querySelector('table') };
    };
    it('grupp, antal och underlag står under åtgärden på skärmen och som egna kolumner bara på utskriften', () => {
        const w = fonster();
        w.__ritaFlik('handlingsplan');
        const tabell = w.document.querySelector('#handlingsplan-tbody').closest('table');
        const th = [...tabell.querySelectorAll('thead th')];
        expect(th.filter(t => t.classList.contains('hp-bara-utskrift')).map(t => ren(t.textContent))).toEqual(RUBRIKER.slice(1, 4));
        for (const tr of rader(w)) {
            expect([1, 2, 3].every(i => tr.cells[i].classList.contains('hp-bara-utskrift'))).toBe(true);
            const under = tr.cells[0].querySelector('.hp-under');
            expect(under.classList.contains('hp-bara-skarm') && under.hasAttribute('data-noprint')).toBe(true);
            expect([...under.querySelectorAll('.hp-under-rad')].map(r => ren(r.textContent))).toEqual([ren(`${tr.cells[1].textContent} · ${tr.cells[2].textContent} berörda`), `Underlag: ${tr.cells[3].textContent}`]);
        }
    });
    it('utskriften av mallen har samma kolumner som förut, utan skärmens undertext', () => {
        const w = fonster();
        w.__ritaFlik('handlingsplan');
        w.eval('_hpLaggTillEgen()');
        const egen = w.document.querySelector('#handlingsplan-tbody tr.handlingsplan-egen');
        const fyll = (el, v) => { el.value = v; el.dispatchEvent(new w.Event('input', { bubbles: true })); };
        fyll(egen.cells[0].querySelector('[data-hp-falt="atgard"]'), 'Se över lönekriterierna');
        fyll(egen.cells[0].querySelector('[data-hp-falt="grupp"]'), 'Alla chefer');
        const pr = utskrift(w);
        expect([...pr.tabell.querySelectorAll('thead th')].map(t => ren(t.textContent))).toEqual(RUBRIKER);
        expect(pr.html).not.toContain('hp-under');
        const seed = w.eval('_handlingsplanForifyllning()').rows;
        const prRader = [...pr.tabell.querySelectorAll('tbody tr.handlingsplan-seeded')];
        expect(prRader.map(tr => ren(tr.cells[0].textContent))).toEqual(seed.map(r => r[0]));
        expect(prRader.map(tr => ren(tr.cells[1].textContent))).toEqual(seed.map(r => r[1]));
        expect(prRader.map(tr => ren(tr.cells[3].textContent))).toEqual(seed.map(r => r[2]));
        for (const tr of pr.tabell.querySelectorAll('tbody tr')) expect(tr.cells.length).toBe(RUBRIKER.length);
    });
    it('samverkan säger att kolumnen Genomfört fylls i på den utskrivna mallen', () => {
        const w = fonster();
        const kort = w.document.getElementById('hp-samverkan');
        expect(ren(kort.querySelector('p').textContent)).toContain('Kolumnen Genomfört fylls i för hand på den utskrivna mallen');
        expect(kort.textContent).not.toMatch(/Bocka av/);
        expect(kort.querySelectorAll('input, select, textarea')).toHaveLength(0);
    });
});

describe('Handlingsplan: Kostnaden avser', () => {
    // Kolumnen säger vilken kostnad raden har (_hpKostnadAvser): rader ur Prioritering lyfts till referensens median,
    // kandidatpar till jämförelseyrkets median; en egen rad har ingen beräknad kostnad.
    const AVSER = { 'Prioritering (under referensen)': 'Nå referensens median', 'Likvärdigt arbete (kandidatpar)': 'Nå jämförelseetikettens median', 'Egen rad': '' };
    const ren = t => String(t ?? '').replace(/\s+/g, ' ').trim();
    const rubrikerAv = tabell => [...tabell.querySelectorAll('thead th')].map(th => ren(th.textContent));
    const excelBlad = w => { let bok = null; w.XLSX.writeFile = wb => { bok = wb; }; w.eval('exportHandlingsplan()'); return w.XLSX.utils.sheet_to_json(bok.Sheets.Handlingsplan, { header: 1, raw: true, defval: '' }); };
    const utskrift = w => {
        let html = '';
        w.open = () => ({ document: { write(s) { html += s; }, close() {}, adoptedStyleSheets: [], createElement: () => ({ sheet: { insertRule() {}, cssRules: [] } }), head: { appendChild() {} } }, focus() {}, print() {} });
        w.eval("skrivUtMallflik('view-handlingsplan', 'Handlingsplan')");
        const div = w.document.createElement('div');
        div.innerHTML = html.replace(/^[\s\S]*<body>/, '').replace(/<\/body>[\s\S]*$/, '');
        return { html, tabell: div.querySelector('table') };
    };
    const atgardsTabell = w => w.eval('rapportModell({ alla: true })').avsnitt.find(a => a.id === 'atgarder').delar.find(p => p.typ === 'tabell');

    it('fliken, Excel-bladet, utskriften, Word-utkastets åtgärdstabell och rapportunderlaget har kolumnen direkt efter kostnaden', async () => {
        const w = fonster();
        await laddaXlsx(w);
        w.__ritaFlik('handlingsplan');
        w.eval('_hpLaggTillEgen()');
        const skarm = w.eval('_handlingsplanForifyllning()').rows.map(r => r[2]);
        const ut = w.eval('medExportLage(() => _handlingsplanForifyllning())').rows.map(r => r[2]);
        for (const u of [skarm, ut]) { expect(u).toContain(UNDERLAG[0]); expect(u).toContain(UNDERLAG[1]); expect(u.at(-1)).toBe('Egen rad'); }
        const vantat = skarm.map(u => AVSER[u]), vantatUt = ut.map(u => AVSER[u]);
        expect(w.eval('_hpKostnadAvser')(UNDERLAG[0])).toBe('Nå referensens median');
        expect(w.eval('_hpKostnadAvser')(UNDERLAG[1])).toBe('Nå jämförelseetikettens median');
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
        const rader = w.eval('medExportLage(() => _rapportHpRader(_handlingsplanForifyllning().rows))');
        const kr = v => w.eval(`svTal(${v}, 0)`).replace(/\s/g, ' ');
        const summa = u => rader.filter(r => r.underlag === u).reduce((s, r) => s + (r.kostnad || 0), 0);
        const text = ren(w.__ruTillText(w.__rapportunderlagBlock().find(b => b.id === 'handlingsplan')));
        expect(summa(UNDERLAG[0])).toBeGreaterThan(0);
        expect(summa(UNDERLAG[1])).toBeGreaterThan(0);
        expect(text).toContain(`Av den är ${kr(summa(UNDERLAG[0]))} kr kostnad att nå referensens median`);
        expect(text).toContain(`och ${kr(summa(UNDERLAG[1]))} kr kostnad att nå jämförelseetikettens median för kandidatparen i likvärdigt arbete.`);
    });
    it('en plan med bara egna rader ger tomma celler, aldrig undefined eller null', async () => {
        const w = createAppWindow();
        await laddaXlsx(w);
        w.__ritaFlik('handlingsplan');
        w.eval('_hpLaggTillEgen()');
        expect(w.eval('_handlingsplanForifyllning()').rows.map(r => r[2])).toEqual(['Egen rad']);
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
        const ru = w.eval('avsnittBlock')('handlingsplan', { rader: w.eval('_rapportHpRader(_handlingsplanForifyllning().rows)') }, { k: 10 });
        expect(ru.tabell.rader[0][ru.tabell.rubriker.indexOf('Kostnaden avser')]).toBe('');
        expect(JSON.stringify(ru.tabell)).not.toMatch(/undefined|null/);
    });
    it('konfigurationsfilen får inget nytt fält: kolumnen är härledd, och en sparad fil läses in och sparas likadant', () => {
        const a = fonster();
        a.__ritaFlik('handlingsplan');
        fyll(a, rader(a)[0].cells[4].querySelector('select'), 'Pågår');
        a.eval('_hpLaggTillEgen()');
        const cfg = JSON.parse(a.eval('JSON.stringify(byggKonfiguration())'));
        const text = JSON.stringify(cfg.handlingsplan);
        expect(text).not.toMatch(/kostnad|Nå referensens median|Nå jämförelseetikettens median/i);
        for (const r of cfg.handlingsplan) expect(Object.keys(r).every(f => ['nyckel', 'sakligt', 'ansvarig', 'tidsplan', 'status', 'egen', 'atgard', 'grupp', 'skal'].includes(f))).toBe(true);
        const b = fonster();
        b.__cfg = cfg; b.eval('tillampaKonfiguration(window.__cfg)');
        expect(JSON.parse(b.eval('JSON.stringify(byggKonfiguration())')).handlingsplan).toEqual(cfg.handlingsplan);
    });
});

// Prioriteringen grupperar på AID-koden och BAS-intervallet (src/lib/prioritering.js): en kod med två texter i samma
// BAS-intervall är en grupp, och handlingsplanens förifyllda rad och gruppdossiern hittar den.
describe('Handlingsplan och gruppdossier: en AID-kod med två texter är en grupp', () => {
    const fonsterTvaTexter = () => {
        const w = createAppWindow();
        const data = [];
        const lagg = (n, kon, lon, etikett) => { for (let i = 0; i < n; i++) data.push({ bas: 'C', kon, lon, alder: 30 + i,
            yrke: `207011 ${etikett}`, aid: '207011', yrkeLabel: etikett, enhet: '' }); };
        lagg(4, 'kvinna', 30000, 'Handläggare'); lagg(4, 'man', 32000, 'Handläggare');
        lagg(4, 'kvinna', 31000, 'Handläggare, natt'); lagg(3, 'man', 33000, 'Handläggare, natt');
        w.__state.data = data;
        w.__state.policy = [{ bas: 'C', p10: 30000, med: 35000, p90: 40000 }];
        w.__state.handlingsplan = {};
        w.eval('fyllValjare(); lasUppFlikar(); sattKTroskel(10, { fraga: false });');
        return w;
    };
    it('[B7.10] prioriteringen har en post på 15 personer, och handlingsplanen en förifylld rad för den', () => {
        const w = fonsterTvaTexter();
        const prio = w.eval("raknaPrioritering('stallningstagande')");
        expect(prio.map(i => [i.aid, i.bas, i.n, i.median])).toEqual([['207011', 'C', 15, 31000]]);
        const seed = w.eval('_handlingsplanForifyllning()');
        expect(seed.nycklar.filter(n => n.startsWith('prio|'))).toEqual(['prio|207011|C']);
        expect(seed.rows[0][1]).toBe('207011 Handläggare · BAS C');
        expect(seed.rows[0][8]).toBe(15);
    });
    it('gruppdossiern för 207011 i BAS C hittar prioriteringens post', () => {
        const w = fonsterTvaTexter();
        const d = w.eval("buildGruppdossier('207011|C')");
        expect(d.n).toBe(15);
        expect(d.prio).toMatchObject({ aid: '207011', bas: 'C', n: 15, median: 31000 });
    });
});

describe('Handlingsplanens tabell', () => {
    it('de tomma raderna visas bara på utskriften, och en rad säger vart det ifyllda tar vägen', () => {
        const css = las('src/style.css');
        expect(css).toMatch(/#handlingsplan-tbody \.handlingsplan-empty \{ display: none; \}/);
        expect(css).toMatch(/@media print \{ #handlingsplan-tbody \.handlingsplan-empty \{ display: table-row; \} \}/);
        const w = demo();
        w.__ritaFlik('handlingsplan');
        expect(w.document.querySelectorAll('#handlingsplan-tbody tr.handlingsplan-empty').length).toBeGreaterThanOrEqual(5);   // finns kvar för utskriften
        expect(w.document.querySelector('#view-handlingsplan .handlingsplan-not').textContent).toContain('följer med i Excel-filen, utskriften och Word-utkastet, men sparas inte');
    });
});

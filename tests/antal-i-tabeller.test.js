/**
 * Antal i grupptabellerna: varje tabell som visar ett lönemått för en grupp visar också gruppens antal, uppdelat på
 * kön där måttet är könsuppdelat. En modelltabell bär n i sin rubrikrad (caption). Exporten bär samma antal som
 * skärmen. Antalen räknas här direkt ur underlaget, oberoende av verktygets egna räkningar.
 */
import { describe, it, expect, vi } from 'vitest';
import { createAppWindow, delatFonster } from './helpers/app-harness.js';
import { laddaXlsx } from './helpers/ktroskel-rigg.js';
vi.setConfig({ testTimeout: 30000 });

const arKv = r => r.kon.includes('kvinna'), arMa = r => r.kon === 'man' || r.kon === 'män';
const ren = s => String(s ?? '').replace(/[\s  ]+/g, ' ').trim();
const rubriker = tabell => [...tabell.querySelectorAll('thead th')].map(th => ren(th.textContent));
const tal = n => n.toLocaleString('sv-SE').replace(/[  ]/g, ' ');
/** "n = 260; 150 kvinnor, 110 män", räknat ur raderna. */
const nText = rader => `n = ${tal(rader.length)}; ${tal(rader.filter(arKv).length)} kvinnor, ${tal(rader.filter(arMa).length)} män`;

const demo = delatFonster(w => { w.__loadDemoData(); });

describe('Lönestruktur: antal i tabellerna', () => {
    it('Var i lönefördelningen sitter gapet? bär antalet kvinnor och män i tabellens rubrikrad', () => {
        const w = demo();
        w.__renderTabContent('struktur');
        const d = w.__state.data.filter(r => arKv(r) || arMa(r));
        const tabell = w.document.querySelector('#struktur-distribution table');
        expect(rubriker(tabell)[0]).toBe('Percentil');
        expect(ren(tabell.querySelector('caption').textContent)).toBe(nText(d));
    });

    it('EU-rapportens blad Distributionellt gap har kolumnerna Antal kvinnor och Antal män', async () => {
        const w = createAppWindow(); w.__loadDemoData();
        await laddaXlsx(w);
        let bok = null;
        w.XLSX.writeFile = wb => { bok = wb; };
        w.eval('exportEuReport()');
        const rader = w.XLSX.utils.sheet_to_json(bok.Sheets['Distributionellt gap'], { header: 1, raw: true });
        const kv = rader[0].indexOf('Antal kvinnor'), ma = rader[0].indexOf('Antal män');
        expect(kv).toBeGreaterThan(0);
        expect(ma).toBeGreaterThan(0);
        expect(rader[1][0]).toBe('P10');
        expect(rader[1][kv]).toBe(w.__state.data.filter(arKv).length);
        expect(rader[1][ma]).toBe(w.__state.data.filter(arMa).length);
    });

    it('Könsfördelning per BAS-intervall har Antal kvinnor och Antal män, i skärmen och i Excel-bladet', () => {
        const w = demo();
        w.__renderTabContent('struktur');
        const tabell = w.document.getElementById('skevhet-table');
        const r = rubriker(tabell);
        const kv = r.indexOf('Antal kvinnor'), ma = r.indexOf('Antal män');
        expect(kv).toBeGreaterThan(0);
        expect(ma).toBe(kv + 1);
        const rad = tabell.querySelector('tbody tr'), bas = ren(rad.cells[0].textContent);
        const iBas = w.__state.data.filter(x => x.bas === bas);
        expect(ren(rad.cells[kv].textContent)).toBe(String(iBas.filter(arKv).length));
        expect(ren(rad.cells[ma].textContent)).toBe(String(iBas.filter(arMa).length));
        // Nyckeltalet i avsnittets rubrik läser fortfarande kolumnen Underrep. Kön.
        expect(w.document.getElementById('nyckel-ls-kon').textContent).toMatch(/^\d+ av \d+ ojämna$/);
        const ojamna = [...tabell.querySelectorAll('tbody tr')].filter(tr => ren(tr.cells[tr.cells.length - 1].textContent) !== '-').length;
        expect(w.document.getElementById('nyckel-ls-kon').textContent).toBe(`${ojamna} av ${tabell.querySelectorAll('tbody tr').length} ojämna`);
    });

    it('regressionskortet: kvantiltabellen, tabellen Vad varje variabel tillför och Oaxaca-tabellen bär n i rubrikraden', () => {
        const w = demo();
        w.__renderTabContent('struktur');
        const d = w.__state.data.filter(r => r.lon > 0 && r.alder > 0 && (arKv(r) || arMa(r)));
        const kort = w.document.getElementById('regression-card');
        const kvantil = [...kort.querySelectorAll('table')].find(t => rubriker(t)[0] === 'Position i lönefördelningen');
        expect(ren(kvantil.querySelector('caption').textContent)).toBe(nText(d));
        const tillfor = [...w.document.querySelectorAll('#forklaringsmodell-panel table')].find(t => rubriker(t)[0] === 'Variabel');
        expect(ren(tillfor.querySelector('caption').textContent)).toContain(nText(d));
        const oaxaca = [...w.document.querySelectorAll('#blinder-oaxaca-card table')].find(t => rubriker(t)[1] === 'Förklarat (Q)');
        expect(ren(oaxaca.querySelector('caption').textContent)).toBe(nText(d));
    });
});

describe('Ålder & karriär: modelljämförelsen', () => {
    it('bär n med kvinnor och män i rubrikraden', () => {
        const w = demo();
        w.__renderTabContent('kon');
        const d = w.__state.data.filter(r => r.lon > 0 && r.alder > 0 && (arKv(r) || arMa(r)));
        const tabell = [...w.document.querySelectorAll('table')].find(t => rubriker(t)[0] === 'Mått' && /Livscykelmodell/.test(rubriker(t)[2] || ''));
        expect(ren(tabell.querySelector('caption').textContent)).toBe(nText(d));
    });
});

describe('Likvärdigt arbete: kandidatparen', () => {
    it('kolumnen Antal (kvinnodom. / jämf.) visar båda yrkenas antal, på skärmen, i Word-utkastet och i rapportunderlaget', () => {
        const w = demo();
        w.__renderTabContent('likvardighet');
        const par = w.eval('likvardighetResultat()').pairs;
        expect(par.length).toBeGreaterThan(0);
        const tabell = w.document.getElementById('likvardighet-table');
        const i = rubriker(tabell).indexOf('Antal (kvinnodom. / jämf.)');
        expect(i).toBeGreaterThan(0);
        const p = par[0], n = (aid, bas) => w.__state.data.filter(r => r.aid === aid && r.bas === bas).length;
        expect(p.kvN).toBe(n(p.kvAid, p.kvBas));
        expect(ren(tabell.querySelector('tbody tr').cells[i].textContent)).toBe(`${p.kvN} / ${p.maN ?? '–'}`);
        // Rapportmodellen (Word, PDF): samma kolumn i kandidattabellen.
        const avsnitt = w.eval('rapportModell({ alla: true })').avsnitt.find(a => a.id === 'likvardigt');
        const t = avsnitt.delar.find(x => x.typ === 'tabell');
        const j = t.kolumner.findIndex(k => k.rubrik === 'Antal (kvinnodom. / jämf.)');
        expect(j).toBeGreaterThan(0);
        expect(w.eval('rmCell')(t.rader[0][j], t.kolumner[j].typ)).toBe(`${p.kvN} / ${p.maN ?? '–'}`);
    });

    it('rapportunderlagets block Likvärdigt arbete har samma kolumn', () => {
        const w = demo();
        const block = w.eval('_ruAvsnittBlock')('likvardigt', { par: w.eval('_parForRedovisning(likvardighetResultat().pairs)').par, kravProxy: 'bas' }, { k: 10 });
        const i = block.tabell.rubriker.indexOf('Antal (kvinnodom. / jämf.)');
        expect(i).toBeGreaterThan(0);
        const p = w.eval('_parForRedovisning(likvardighetResultat().pairs)').par[0];
        expect(block.tabell.rader[0][i]).toBe(`${p.kvN} / ${p.maN ?? '–'}`);
    });
});

describe('Löneöversyn: lönegap per BAS-intervall före och efter', () => {
    it('kolumnen Antal (Kv/Mä) per intervall', () => {
        const w = createAppWindow();
        const rad = (aid, bas, kon, lon) => ({ bas, kon, lon, alder: 40, yrke: `${aid} Yrke${aid}`, aid, yrkeLabel: `Yrke${aid}`, enhet: '' });
        w.__state.data = [...Array.from({ length: 14 }, (_, i) => rad('6000', 'A', 'kvinna', 30000 + i * 10)), ...Array.from({ length: 10 }, (_, i) => rad('6000', 'A', 'man', 30000 + i * 10)),
                          ...Array.from({ length: 10 }, (_, i) => rad('6100', 'A', 'kvinna', 36000 + i * 10)), ...Array.from({ length: 14 }, (_, i) => rad('6100', 'A', 'man', 36000 + i * 10))];
        w.eval('populateSelects(); unlockTabs();');
        w.__state.forecast.targets = [{ bas: 'A', aid: '6000', mode: 'pct', value: 10, dist: 'flat', targetLevel: 'median', pool: 'övrigt' }];
        w.__renderTabContent('loneoversyn');
        const tabell = w.document.getElementById('forecast-lutning-table');
        const i = rubriker(tabell).indexOf('Antal (Kv/Mä)');
        expect(i).toBe(1);
        expect(ren(tabell.querySelector('tbody tr').cells[i].textContent)).toBe('24/24');
    });
});

describe('Handlingsplan: Antal berörda', () => {
    it('skärmen, Excel-underlaget, Word-utkastets tabell och rapportunderlaget har kolumnen; egna rader är tomma', async () => {
        const w = createAppWindow(); w.__loadDemoData();
        w.__renderTabContent('handlingsplan');
        const tabell = w.document.querySelector('#handlingsplan-tbody').closest('table');
        const i = rubriker(tabell).indexOf('Antal berörda');
        expect(i).toBe(2);
        const seed = w.eval('_handlingsplanSeedRows()');
        const prio = w.eval('computePrioritization(_selectedPrioReference())');
        const forstaPrio = seed.rows.findIndex(r => r[2] === 'Prioritering (under referensen)');
        const forstaPar = seed.rows.findIndex(r => r[2] === 'Likvärdigt arbete (kandidatpar)');
        expect(forstaPrio).toBeGreaterThanOrEqual(0);
        expect(forstaPar).toBeGreaterThanOrEqual(0);
        const prioRad = prio.find(p => seed.rows[forstaPrio][1].startsWith(String(p.aid)) && seed.rows[forstaPrio][1].endsWith(`BAS ${p.bas}`));
        const tr = w.document.querySelectorAll('#handlingsplan-tbody tr.handlingsplan-seeded');
        expect(ren(tr[forstaPrio].cells[i].textContent)).toBe(String(prioRad.n));
        const par = w.eval('_parForRedovisning(likvardighetResultat().pairs)').par[0];
        expect(ren(tr[forstaPar].cells[i].textContent)).toBe(String(par.kvN));
        // En egen rad har inget antal.
        w.eval('_hpLaggTillEgen()');
        const egen = w.document.querySelector('#handlingsplan-tbody tr.handlingsplan-egen');
        expect(ren(egen.cells[i].textContent)).toBe('');
        // Excel-underlaget.
        await laddaXlsx(w);
        let bok = null;
        w.XLSX.writeFile = wb => { bok = wb; };
        w.eval('exportHandlingsplan()');
        const blad = w.XLSX.utils.sheet_to_json(bok.Sheets.Handlingsplan, { header: 1, raw: true });
        const x = blad[0].indexOf('Antal berörda');
        expect(x).toBe(2);
        expect(blad[1 + forstaPrio][x]).toBe(prioRad.n);
        expect(blad[1 + forstaPar][x]).toBe(par.kvN);
        // Word-utkastets tabell Åtgärder och tidsplan.
        const t = w.eval('rapportModell({ alla: true })').avsnitt.find(a => a.id === 'atgarder').delar.find(p => p.typ === 'tabell');
        const j = t.kolumner.findIndex(k => k.rubrik === 'Antal berörda');
        expect(j).toBe(1);
        expect(t.rader[forstaPrio][j]).toBe(prioRad.n);
        expect(t.rader[forstaPar][j]).toBe(par.kvN);
        expect(t.rader.at(-1)[j]).toEqual({ text: '' });
        // Rapportunderlaget.
        const ru = w.eval('_ruAvsnittBlock')('handlingsplan', { rader: w.eval('_rapportHpRader(_handlingsplanSeedRows().rows)') }, { k: 10 });
        const r = ru.tabell.rubriker.indexOf('Antal berörda');
        expect(r).toBe(2);
        expect(ru.tabell.rader[forstaPrio][r]).toBe(String(prioRad.n));
        expect(ru.tabell.rader.at(-1)[r]).toBe('');
    });
});

describe('Jämförelse med förra året: de flaggade yrkesgrupperna', () => {
    it('panelens och rapportmodellens grupptabeller har kolumnen Kvinnor / män', () => {
        const w = createAppWindow(); w.__loadDemoData();
        // Förra årets bokslut: samma som i år, så att de flaggade grupperna står som kvar.
        w.__state.forraArsbokslut = JSON.parse(JSON.stringify(w.eval('byggArsbokslutNu()')));
        w.eval('renderArsjamforelse()');
        const panel = [...w.document.querySelectorAll('#arsjamforelse table')].filter(t => rubriker(t)[0] === 'Yrkesgrupp');
        expect(panel.length).toBeGreaterThan(0);
        for (const t of panel) {
            expect(rubriker(t)[1]).toBe('Kvinnor / män');
            for (const tr of t.querySelectorAll('tbody tr')) expect(ren(tr.cells[1].textContent)).toMatch(/^\d+ \/ \d+$/);
        }
        const avsnitt = w.eval('rapportModell({ alla: true })').avsnitt.find(a => a.id === 'arsjamforelse');
        const grupptabeller = avsnitt.delar.filter(p => p.typ === 'tabell' && p.kolumner[0].rubrik === 'Yrkesgrupp');
        expect(grupptabeller.length).toBeGreaterThan(0);
        for (const t of grupptabeller) {
            const i = t.kolumner.findIndex(k => k.rubrik === 'Kvinnor / män');
            expect(i).toBe(1);
            for (const rad of t.rader) expect(String(rad[i])).toMatch(/^\d+ \/ \d+$/);
        }
    });
});

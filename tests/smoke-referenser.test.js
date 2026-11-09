import { describe, it, expect, vi } from 'vitest';
import { createAppWindow } from './helpers/app-harness.js';
import { fonster as fonsterK, fangaBocker, laddaXlsx, SENT_SMA, SMA } from './helpers/ktroskel-rigg.js';
vi.setConfig({ testTimeout: 30000 });
const fonster = () => { const w = createAppWindow(); w.__loadDemoData(); return w; };
const medStatistik = (w, { spann = true } = {}) => {
    w.__state.statistik = [...new Set(w.__getData().map(r => `${r.aid}|${r.bas}`))].map(k => { const [aid, bas] = k.split('|'); return spann ? { aid, bas, median: 34000, p10: 30000, p90: 39000 } : { aid, bas, median: 34000 }; });
    w.__state.statistikHasP10 = spann; w.__state.statistikHasP90 = spann;
};
describe('överblicken: löneläget och statistiken mot ställningstagandet', () => {
    it('ritas i Jämförelse med tal, tabell, hantel och statistiken mot ställningstagandet när båda referenserna finns', () => {
        const w = fonster(); medStatistik(w);
        w.__renderTabContent('benchmark');
        const d = w.document, host = d.getElementById('ref-overblick');
        expect(host.textContent).toMatch(/löneläget (ovanför|nedanför|inom) ställningstagandet/i);
        expect(host.textContent).not.toMatch(/ställningstagandet ligger/);
        expect(d.querySelectorAll('#ref-tabell tbody tr').length).toBeGreaterThan(0);
        expect(d.querySelectorAll('#ref-tabell thead th').length).toBe(14);   // med kolumnen Matchning
        // En kolumn för mönstret och förslaget; läget i spannet förklarar talet i rubriken och verktygstipset
        const rubriker = [...d.querySelectorAll('#ref-tabell thead th')];
        expect(rubriker.map(th => th.textContent)).toContain('Läge och förslag');
        expect(rubriker.map(th => th.textContent)).not.toContain('Mönster');
        expect(rubriker.map(th => th.textContent)).not.toContain('Förslag på referens');
        const lage = rubriker.find(th => /^Läge i spannet/.test(th.textContent));
        expect(lage.textContent).toMatch(/0 = P10, 100 = P90/);
        expect(lage.getAttribute('title')).toMatch(/0 är referensens P10 och 100 dess P90/);
        // Hanteln: en rad per yrkesgrupp, serierna skiljs med färg och förklaring i stället för i etiketten
        const f = d.getElementById('chart-ref-hantel')._figur;
        expect(f.lager.map(l => l.serie)).toEqual(['Ställningstagandet', 'Ställningstagandet', 'Statistiken', 'Statistiken', 'Organisationen', 'Organisationen']);
        expect(f.lager.map(l => l.marke)).toEqual(['intervall', 'punkt', 'intervall', 'punkt', 'intervall', 'punkt']);
        expect(f.legend).not.toBe(false);
        expect(new Set(f.lager.map(l => l.farg)).size).toBe(3);
        expect(f.y.ordning.every(s => !/ställningstagandet|statistiken|organisationen/.test(s))).toBe(true);
        expect(f.y.ordning).toEqual(w.eval('referensOverblick()').grupper.slice(0, 25).map(g => `${g.yrke} · BAS ${g.bas}`));
        expect(d.querySelectorAll('#ref-stat-mot-stallning tbody tr').length).toBeGreaterThan(0);
    });
    it('talet för förslaget böjs efter antalet', () => {
        const w = fonster();
        const m = { grupper: 0, andel: 0 };
        const html = n => w._rrTalHtml({ antalGrupper: 8, perMonster: { badaOver: m, baraLonelageOver: m, baraStatistikOver: m, badaInom: m }, forslagStatistik: n }, { harStatistik: true, harStallningstagande: true });
        expect(html(1)).toContain('1 grupp<');
        expect(html(2)).toContain('2 grupper<');
    });
    it('utan statistik visas överblicken mot ställningstagandet ensamt och säger att statistik saknas', () => {
        const w = fonster();
        w.__renderTabContent('benchmark');
        const d = w.document, host = d.getElementById('ref-overblick');
        expect(host.textContent).toMatch(/Jämförelsestatistik saknas/);
        expect(d.getElementById('ref-stat-mot-stallning')).toBeNull();
        expect(d.querySelectorAll('#ref-tabell thead th').length).toBe(10);
        expect(d.getElementById('chart-ref-hantel')._figur.lager.some(l => l.serie === 'Statistiken')).toBe(false);
    });
    it('statistik med bara median: inget läge mot statistiken, hanteln ritar bara strecket för den', () => {
        const w = fonster(); medStatistik(w, { spann: false });
        w.__renderTabContent('benchmark');
        const f = w.document.getElementById('chart-ref-hantel')._figur;
        const stat = f.lager.filter(l => l.serie === 'Statistiken');
        expect(stat.find(l => l.marke === 'intervall').data).toHaveLength(0);
        expect(stat.find(l => l.marke === 'punkt').data.length).toBeGreaterThan(0);
        expect(w.document.getElementById('ref-overblick').textContent).toMatch(/P10 och P90 saknas i jämförelsestatistiken/);
    });
    it('ställningstagande per BAS: alla yrken i intervallet mäts mot samma spann', () => {
        const w = fonster();
        w.__state.policy = [...new Set(w.__getData().map(r => r.bas))].map(bas => ({ bas, p10: 25000, med: 30000, p90: 35000 }));
        const grupper = w.eval('referensOverblick()').grupper;
        expect(grupper.length).toBeGreaterThan(0);
        expect(grupper.every(g => g.stallningstagande.p10 === 25000 && g.stallningstagande.p90 === 35000)).toBe(true);
    });
    it('grupper utanför listans bild nämns: tabellen har alla', () => {
        const w = fonster(); medStatistik(w);
        w.__renderTabContent('benchmark');
        const rader = w.document.querySelectorAll('#ref-tabell tbody tr').length;
        const antal = new Set(w.document.getElementById('chart-ref-hantel')._figur.y.ordning).size;
        expect(antal).toBeLessThanOrEqual(25);
        if (rader > 25) expect(w.document.getElementById('ref-overblick').textContent).toMatch(/tabellen har alla/);
    });
});
describe('Lönepolitik är avsnitt två i Löneläget', () => {
    it('fliken syns med demodata utan statistik, Lönepolitik-knappen finns inte, aliaset leder rätt, källväxeln är borta', () => {
        const w = fonster(); const d = w.document;
        expect(d.getElementById('tab-lonepolitik')).toBeNull();
        expect(d.getElementById('view-lonepolitik')).toBeNull();
        expect(d.getElementById('tab-benchmark').hidden).toBe(false);
        expect(d.getElementById('tab-benchmark').textContent.trim()).toBe('Löneläget');
        expect(w.eval("tabMal('lonepolitik')")).toBe('benchmark');
        w.__renderTabContent('lonepolitik');
        expect([...d.querySelectorAll('#view-benchmark > details.avsnitt')].map(a => a.id)).toEqual(['avsnitt-jmf-bandkartor', 'avsnitt-jmf-stallningstagande', 'avsnitt-jmf-statistik', 'avsnitt-jmf-overblick']);
        expect(d.querySelector('#avsnitt-jmf-stallningstagande #lonepolitik-content').textContent).toMatch(/Yrkesgrupper mot sitt spann/);
        expect(d.querySelector('.benchmark-metric-btn')).toBeNull();
        expect(d.querySelector('#avsnitt-jmf-statistik').textContent).toMatch(/Jämförelsestatistik saknas/);
    });
    it('utan underlag är fliken låst; med underlag men utan referens dold; med referens synlig', () => {
        const w = createAppWindow();
        expect(w.document.getElementById('tab-benchmark').getAttribute('aria-disabled')).toBe('true');
        w.__state.data = [{ bas: 'A', kon: 'kvinna', lon: 30000, alder: 40, aid: '1', yrke: '1 Y', yrkeLabel: 'Y' }];
        w.eval('_visaJamforelseFlik(state.data.length > 0 && (state.policy.length > 0 || state.statistik.length > 0))');
        expect(w.document.getElementById('tab-benchmark').hidden).toBe(true);
        w.__state.policy = [{ bas: 'A', p10: 25000, med: 30000, p90: 35000 }];
        w.eval('_visaJamforelseFlik(state.data.length > 0 && (state.policy.length > 0 || state.statistik.length > 0))');
        expect(w.document.getElementById('tab-benchmark').hidden).toBe(false);
    });
    it('länkar till lonepolitik når Löneläget', () => {
        const w = fonster(); const d = w.document;
        w.eval("navigateTo('lonepolitik')");
        expect(d.getElementById('tab-benchmark').classList.contains('active')).toBe(true);
        expect(d.getElementById('page-title').textContent).toBe('Löneläget');
        const a = d.createElement('button'); a.setAttribute('data-goto-tab', 'lonepolitik'); d.body.appendChild(a);
        d.querySelector('.nav-item[data-tab="dashboard"]').click(); a.click();
        expect(d.getElementById('tab-benchmark').classList.contains('active')).toBe(true);
    });
    it('Nästa steg hoppar över Löneläget när ingen referens finns', () => {
        const w = fonster();
        w.__state.policy = []; w.eval('synkaJamforelseFlik()');
        w.document.querySelector('.nav-item[data-tab="bestammelser"]').click();
        expect(w.document.querySelector('.flow-next-btn').dataset.flowTab).toBe('matrix');
    });
});
describe('överblicken i exporterna', () => {
    it('Excel-bladet Referenser finns efter Lönepolitik och bär inga grupper under tröskeln', async () => {
        const w = fonsterK(null);
        await laddaXlsx(w);
        const data = [...new Set(w.__state.data.map(r => `${r.aid}|${r.bas}`))];
        w.__state.statistik = data.map(k => { const [aid, bas] = k.split('|'); return { aid, bas, median: 34000, p10: 30000, p90: 39000 }; });
        w.__state.statistikHasP10 = true; w.__state.statistikHasP90 = true;
        const blad = w.eval('excelAlltBlad()');
        expect(blad.indexOf('Referenser')).toBe(blad.indexOf('Lönepolitik') + 1);
        const bok = Object.values(fangaBocker(w, () => w.eval('exportAllToExcel()')))[0];
        const ref = bok.split('[Referenser]')[1].split('\n[')[0];
        expect(ref).toContain('Statistiken mot ställningstagandet (%)');
        // Samma kolumner som skärmen: en kolumn för läge och förslag, läget i spannet med sin skala i rubriken
        expect(ref).toContain('Läge i spannet, ställn. · stat. (0 = P10, 100 = P90) | Läge och förslag');
        expect(ref).not.toMatch(/Mönster|Förslag på referens/);
        for (const s of SENT_SMA) expect(ref).not.toContain(String(s));
    });
    it('rapportavsnittet och rapportunderlagets block bär inga grupper under tröskeln; skärmen visar dem', () => {
        const w = fonsterK(null);
        const namn = w.__state.data.find(r => SMA.includes(r.bas)).yrke;
        const iRapport = JSON.stringify(w.eval('rapportModell({ alla: true })').avsnitt.find(a => a.id === 'referenser'));
        const iBlock = JSON.stringify(w.eval('rapportunderlagBlock()').find(x => x.id === 'referenser'));
        for (const bas of SMA) { expect(iRapport).not.toContain(`BAS ${bas}"`); expect(iBlock).not.toContain(`BAS ${bas}"`); }
        for (const s of SENT_SMA) { expect(iRapport).not.toContain(String(s)); expect(iBlock).not.toContain(String(s)); }
        w.__renderTabContent('benchmark');
        expect(w.document.getElementById('ref-tabell').textContent).toContain(namn);
        expect(w.document.getElementById('ref-tabell').textContent).toContain(`BAS ${SMA[0]}`);
    });
    it('rapporten har avsnittet Lönerna mot referenserna efter Lönestruktur och rapportmått, i hela dokumentationen och facklig dialog men inte i ledningsbriefen', () => {
        const w = fonster();
        const ids = w.eval('rapportModell({ alla: true })').avsnitt.map(a => a.id);
        expect(ids).toHaveLength(14);   // med bilagan med gruppdossierer (förvald av)
        expect(ids[ids.indexOf('struktur') + 1]).toBe('referenser');
        w.eval("sattRapportUrval('ledning')");
        expect(w.eval('rapportModell()').avsnitt.map(a => a.id)).not.toContain('referenser');
        w.eval("sattRapportUrval('facklig')");
        expect(w.eval('rapportModell()').avsnitt.map(a => a.id)).toContain('referenser');
        w.eval("sattRapportUrval('hela')");
        expect(w.eval('_buildDocumentationDraftHtml()')).toContain('Lönerna mot referenserna');
        const avsnitt = w.eval('rapportModell()').avsnitt.find(a => a.id === 'referenser');
        expect(avsnitt.delar.some(p => p.typ === 'diagram' && p.id === 'chart-ref-hantel')).toBe(true);
    });
    it('utan någon referens finns avsnittet inte, och räkningen är tretton (med bilagan med gruppdossierer)', () => {
        const w = createAppWindow();
        w.__state.data = Array.from({ length: 40 }, (_, i) => ({ bas: 'AB'[i % 2], kon: i % 2 ? 'man' : 'kvinna', lon: 30000 + i * 100, alder: 40, aid: '1', yrke: '1 Y', yrkeLabel: 'Y', radnr: i + 2 }));
        expect(w.eval('rapportModell({ alla: true })').avsnitt).toHaveLength(13);
    });
    it('rapportunderlaget har blocket med talen och listan', () => {
        const w = fonster();
        const b = w.eval('rapportunderlagBlock()').find(x => x.id === 'referenser');
        expect(b.rubrik).toBe('Lönerna mot referenserna');
        expect(b.tabell.rubriker[0]).toBe('Yrkesgrupp');
        expect(b.stycken.join(' ')).toMatch(/löneläget/);
    });
    it('rapportunderlagets lista har kolumnen Matchning bara när statistik finns, med detaljlistans ord', () => {
        const w = fonster();
        w.__state.statistik = []; w.__state.statistikHasP10 = false; w.__state.statistikHasP90 = false;
        expect(w.eval('rapportunderlagBlock()').find(x => x.id === 'referenser').tabell.rubriker).not.toContain('Matchning');
        medStatistik(w);
        // En AID får bara en rad utan BAS: dess grupper matchas på endast AID.
        const aid = w.__state.statistik[0].aid;
        w.__state.statistik = [...w.__state.statistik.filter(r => r.aid !== aid), { aid, bas: '', median: 34000, p10: 30000, p90: 39000 }];
        const b = w.eval('rapportunderlagBlock()').find(x => x.id === 'referenser');
        expect(b.tabell.rubriker.slice(0, 3)).toEqual(['Yrkesgrupp', 'Matchning', 'n']);
        const grupper = w.eval('medExportLage(() => referensOverblick())').grupper;
        expect(b.tabell.rader.map(r => r[1])).toEqual(grupper.map(g => w.eval('_jfMatchningEtikett')(g.statistikMatchning)));
        expect(new Set(b.tabell.rader.map(r => r[1]))).toEqual(new Set(['AID + BAS', 'Endast AID']));
        for (const r of b.tabell.rader) expect(r).toHaveLength(b.tabell.rubriker.length);
        expect(w.eval('_ruTillWordHtml')(b)).toContain('<th>Matchning</th>');
    });
    it('utskriften tar med listan ur överblicken före avsnittet mot statistiken', () => {
        const w = fonster(); medStatistik(w);
        w.__renderTabContent('benchmark');
        w.eval("sattRapportUrval('hela')");
        expect(w.eval('_utskriftReferenserHtml(id => { const t = document.getElementById(id); return t ? t.outerHTML : ""; })')).toMatch(/ref-tabell[^]*ref-stat-mot-stallning/);
    });
});
describe('fliken följer referenserna', () => {
    it('inga texter pekar på den borttagna fliken Lönepolitik', () => {
        const html = createAppWindow().document.documentElement.outerHTML;
        expect(html).not.toMatch(/<strong>Lönepolitik|och Lönepolitik jämför|referensen i Lönepolitik/);
    });
    it('Ta bort referensen döljer Jämförelse när ingen annan referens finns', () => {
        const w = fonster();
        w.document.getElementById('btn-referens-aterga').click();
        expect(w.__state.policy).toHaveLength(0);
        expect(w.document.getElementById('tab-benchmark').hidden).toBe(true);
    });
});

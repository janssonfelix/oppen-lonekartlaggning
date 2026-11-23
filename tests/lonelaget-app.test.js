// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
// Löneläget och Lönepolitik i appen: överblicken med bandkartan och statistikens spann, avsnitten mot ställningstagandet
// och statistiken, överblicken i exporterna, att fliken följer referenserna och policyFor-kaskaden.
import { describe, it, expect, beforeAll, vi } from 'vitest';
import { createAppWindow } from './helpers/app-harness.js';
import { fonster as fonsterK, fangaBocker, laddaXlsx, SENT_SMA, SMA } from './helpers/ktroskel-rigg.js';
vi.setConfig({ testTimeout: 30000 });
const fonster = () => { const w = createAppWindow(); w.__lasInDemodata(); return w; };
const medStatistik = (w, { spann = true } = {}) => {
    w.__state.statistik = [...new Set(w.__hamtaData().map(r => `${r.aid}|${r.bas}`))].map(k => { const [aid, bas] = k.split('|'); return spann ? { aid, bas, median: 34000, p10: 30000, p90: 39000 } : { aid, bas, median: 34000 }; });
    w.__state.statistikHasP10 = spann; w.__state.statistikHasP90 = spann;
};

let win;

beforeAll(() => {
    win = createAppWindow();
    win.__lasInDemodata();   // blocken nedan läser demodatan
});

describe('överblicken: löneläget och statistiken mot ställningstagandet', () => {
    it('ritas i Jämförelse med tal, tabell, hantel och statistiken mot ställningstagandet när båda referenserna finns', () => {
        const w = fonster(); medStatistik(w);
        w.__ritaFlik('benchmark');
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
        w.__ritaFlik('benchmark');
        const d = w.document, host = d.getElementById('ref-overblick');
        expect(host.textContent).toMatch(/Jämförelsestatistik saknas/);
        expect(d.getElementById('ref-stat-mot-stallning')).toBeNull();
        expect(d.querySelectorAll('#ref-tabell thead th').length).toBe(10);
        expect(d.getElementById('chart-ref-hantel')._figur.lager.some(l => l.serie === 'Statistiken')).toBe(false);
    });
    it('statistik med bara median: inget läge mot statistiken, hanteln ritar bara strecket för den', () => {
        const w = fonster(); medStatistik(w, { spann: false });
        w.__ritaFlik('benchmark');
        const f = w.document.getElementById('chart-ref-hantel')._figur;
        const stat = f.lager.filter(l => l.serie === 'Statistiken');
        expect(stat.find(l => l.marke === 'intervall').data).toHaveLength(0);
        expect(stat.find(l => l.marke === 'punkt').data.length).toBeGreaterThan(0);
        expect(w.document.getElementById('ref-overblick').textContent).toMatch(/P10 och P90 saknas i jämförelsestatistiken/);
    });
    it('ställningstagande per BAS: alla yrken i intervallet mäts mot samma spann', () => {
        const w = fonster();
        w.__state.policy = [...new Set(w.__hamtaData().map(r => r.bas))].map(bas => ({ bas, p10: 25000, med: 30000, p90: 35000 }));
        const grupper = w.eval('referensOverblick()').grupper;
        expect(grupper.length).toBeGreaterThan(0);
        expect(grupper.every(g => g.stallningstagande.p10 === 25000 && g.stallningstagande.p90 === 35000)).toBe(true);
    });
    it('grupper utanför listans bild nämns: tabellen har alla', () => {
        const w = fonster(); medStatistik(w);
        w.__ritaFlik('benchmark');
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
        expect(w.eval("flikMal('lonepolitik')")).toBe('benchmark');
        w.__ritaFlik('lonepolitik');
        expect([...d.querySelectorAll('#view-benchmark > details.avsnitt')].map(a => a.id)).toEqual(['avsnitt-jmf-bandkartor', 'avsnitt-jmf-stallningstagande', 'avsnitt-jmf-statistik', 'avsnitt-jmf-overblick']);
        expect(d.querySelector('#avsnitt-jmf-stallningstagande #lonepolitik-content').textContent).toMatch(/AID-etiketter mot sitt spann/);
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
        w.eval("navigeraTill('lonepolitik')");
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
        const bok = Object.values(fangaBocker(w, () => w.eval('exportAlltTillExcel()')))[0];
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
        w.__ritaFlik('benchmark');
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
        expect(b.tabell.rubriker[0]).toBe('AID-etikett');
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
        expect(b.tabell.rubriker.slice(0, 3)).toEqual(['AID-etikett', 'Matchning', 'n']);
        const grupper = w.eval('medExportLage(() => referensOverblick())').grupper;
        expect(b.tabell.rader.map(r => r[1])).toEqual(grupper.map(g => w.eval('matchningEtikett')(g.statistikMatchning)));
        expect(new Set(b.tabell.rader.map(r => r[1]))).toEqual(new Set(['AID + BAS', 'Endast AID']));
        for (const r of b.tabell.rader) expect(r).toHaveLength(b.tabell.rubriker.length);
        expect(w.eval('tillWordHtml')(b)).toContain('<th>Matchning</th>');
    });
    it('utskriften tar med listan ur överblicken före avsnittet mot statistiken', () => {
        const w = fonster(); medStatistik(w);
        w.__ritaFlik('benchmark');
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

// ---- Löneläget: överblicken överst (bandkartan och statistikens spann) ----
// Ordningen: Överblick (avsnitt-jmf-bandkartor, öppen) → Mot ställningstagandet → Mot jämförelsestatistiken →
// Yrkesgrupp för yrkesgrupp (avsnitt-jmf-overblick, stängd). Statistikens spann läser samma rader som tabellen mot
// statistiken (jamforelseUnderlag: inga grupper under tröskeln), utan tabellens filter.
describe('Löneläget: överblicken med bandkartan och statistikens spann', () => {
    const avsnitt = w => [...w.document.querySelectorAll('#view-benchmark > details.avsnitt')];
    const el = (w, id) => w.document.getElementById(id);
    const punkter = f => f.lager.filter(l => l.marke === 'punkt').flatMap(l => l.data.map(p => ({ ...p, lager: l })));
    // Demots åtta grupper: var tredje utan P10 och P90 (ingen punkt), annars AID + BAS eller en rad utan BAS (Endast AID),
    // och spann som lägger medianen över respektive under statistikens spann.
    const medBlandad = () => {
        const w = createAppWindow(); w.__lasInDemodata();
        const rader = w.eval('jamforelseUnderlag()').rader;
        w.__state.statistik = rader.map((r, i) => {
            const m = r.org.median;
            if (i % 3 === 2) return { aid: r.aid, bas: r.bas, median: m };
            const [p10, p90] = i % 2 ? [m * 1.05, m * 1.3] : [m * 0.7, m * 0.95];
            return { aid: r.aid, bas: i % 3 === 1 ? '' : r.bas, p10, median: (p10 + p90) / 2, p90 };
        });
        w.__state.statistikHasP10 = true; w.__state.statistikHasP90 = true;
        w.__ritaFlik('benchmark');
        return w;
    };
    it('ordningen: Överblick, Mot ställningstagandet, Mot jämförelsestatistiken, Yrkesgrupp för yrkesgrupp; bara överblicken öppen', () => {
        const w = medBlandad();
        expect(avsnitt(w).map(a => a.id)).toEqual(['avsnitt-jmf-bandkartor', 'avsnitt-jmf-stallningstagande', 'avsnitt-jmf-statistik', 'avsnitt-jmf-overblick']);
        expect(avsnitt(w).filter(a => a.open).map(a => a.id)).toEqual(['avsnitt-jmf-bandkartor']);
        expect(el(w, 'avsnitt-jmf-overblick').querySelector('h2').textContent).toMatch(/^AID-etikett för AID-etikett/);
        expect(el(w, 'avsnitt-jmf-bandkartor').querySelector('h2').textContent).toMatch(/^Överblick/);
        // Bandkartan står i överblicken, före statistikens spann, och inte längre i avsnittet mot ställningstagandet.
        const fore = (a, b) => !!(el(w, a).compareDocumentPosition(el(w, b)) & 4);
        expect(el(w, 'avsnitt-jmf-bandkartor').contains(el(w, 'chart-lp-bandmap'))).toBe(true);
        expect(el(w, 'avsnitt-jmf-bandkartor').contains(el(w, 'chart-jmf-statlage'))).toBe(true);
        expect(fore('chart-lp-bandmap', 'chart-jmf-statlage')).toBe(true);
        expect(el(w, 'avsnitt-jmf-stallningstagande').querySelector('#chart-lp-bandmap')).toBeNull();
        expect(el(w, 'lp-bandkarta-kort').hidden).toBe(false);
        expect(el(w, 'jmf-statlage-kort').hidden).toBe(false);
        expect(el(w, 'chart-lp-bandmap')._figur).toBeTruthy();
        // Sökregistret pekar på båda avsnitten.
        const sok = w.eval('SOK_FUNKTIONER').filter(s => s.flik === 'benchmark').map(s => s.avsnitt);
        expect(sok).toEqual(expect.arrayContaining(['avsnitt-jmf-bandkartor', 'avsnitt-jmf-overblick']));
    });
    it('[B6.6] en punkt per yrkesgrupp med P10 och P90: läget 0 = P10, 100 = P90; fylld = AID + BAS, ofylld = Endast AID', () => {
        const w = medBlandad();
        const rader = w.eval('jamforelseUnderlag()').rader, f = el(w, 'chart-jmf-statlage')._figur;
        expect(() => w.eval('valideraFigur')(f, 't')).not.toThrow();
        const pts = punkter(f);
        const medSpann = rader.filter(r => r.statistik.p10 !== null && r.statistik.p90 !== null);
        expect(pts).toHaveLength(medSpann.length);
        expect(pts.length).toBe(6);
        for (const r of medSpann) {
            const p = pts.find(q => q.aid === r.aid && q.bas === r.bas);
            expect(p.y).toBeCloseTo((r.org.median - r.statistik.p10) / (r.statistik.p90 - r.statistik.p10) * 100, 9);
            expect(p.x).toBe('BAS ' + r.bas);
            expect(p.matchning).toBe(r.statistikMatchning === 'aid' ? 'Endast AID' : 'AID + BAS');   // filtrets värde, tabellens ord
            expect(p.lager.serie.startsWith(p.konsdom + ' · ')).toBe(true);
            expect(!!p.lager.ofylld).toBe(r.statistikMatchning === 'aid');
            expect(p.lager.serie).toMatch(r.statistikMatchning === 'aid' ? / · Endast AID$/ : / · AID \+ BAS$/);
            expect(p.n).toBe(r.n);
        }
        expect(pts.some(p => p.y < 0) && pts.some(p => p.y > 100)).toBe(true);   // axeln rymmer lägen utanför spannet
        expect(pts.some(p => p.lager.ofylld) && pts.some(p => !p.lager.ofylld)).toBe(true);
        // Statistikens spann som ett grått band 0–100 per BAS, och linjer vid 0 och 100.
        const band = f.lager.find(l => l.marke === 'intervall');
        expect(band.data.every(d => d.lag === 0 && d.hog === 100)).toBe(true);
        expect(new Set(band.data.map(d => d.x))).toEqual(new Set(pts.map(p => p.x)));
        expect(f.referens.map(r => r.y)).toEqual([0, 100]);
        // I bilden: de ofyllda är ringar utan fyllning, de fyllda har lagrets färg.
        const svgPunkter = [...el(w, 'chart-jmf-statlage').querySelectorAll('svg[data-del="panel"] [data-marke="punkt"]')];
        expect(svgPunkter.filter(m => m.getAttribute('fill') === 'none')).toHaveLength(pts.filter(p => p.lager.ofylld).length);
        // Beskrivningen säger vad fylld och ofylld betyder och att filtren inte gäller.
        expect(f.beskrivning).toMatch(/[Ff]ylld/);
        expect(f.beskrivning).toMatch(/[Oo]fylld/);
        expect(el(w, 'jmf-statlage-kort').textContent).toMatch(/Fylld punkt[^]*AID \+ BAS[^]*Ofylld punkt[^]*Endast AID/);
        // Tipset: yrke, BAS, läget, organisationens median, statistikens spann, matchning och antal.
        const p = pts[0], tips = p.lager.tips(p).map(r => r.join(' ')).join('\n');
        for (const ord of [p.yrke, `BAS ${p.bas}`, 'Läget i spannet', 'Organisationens median', 'P10', 'P90', 'Matchning', 'Antal']) expect(tips).toContain(ord);
    });
    it('samma färger för könsdominans och samma förskjutning som bandkartan', () => {
        const w = medBlandad();
        const band = el(w, 'chart-lp-bandmap')._figur, stat = el(w, 'chart-jmf-statlage')._figur;
        for (const l of stat.lager.filter(x => x.marke === 'punkt')) {
            const klass = l.serie.split(' · ')[0];
            const motsv = band.lager.find(b => b.serie === `${klass} yrkesgrupp`);
            if (motsv) expect(l.farg).toBe(motsv.farg);
            for (const p of l.data) expect(/^Kvinno/.test(klass) ? p.kvAndel >= 60 : /^Mans/.test(klass) ? p.kvAndel <= 40 : p.kvAndel > 40 && p.kvAndel < 60).toBe(true);
        }
        const bandPts = band.lager.filter(l => /yrkesgrupp$/.test(l.serie)).flatMap(l => l.data);
        for (const p of punkter(stat)) {
            const b = bandPts.find(q => q.yrke === p.yrke && q.bas === p.bas);
            if (b) expect(p.forskjutning).toBe(b.forskjutning);
            expect(Math.abs(p.forskjutning)).toBeLessThanOrEqual(0.18);
        }
    });
    it('filtren i Mot jämförelsestatistiken påverkar inte överblicken', () => {
        const w = medBlandad();
        const fore = punkter(el(w, 'chart-jmf-statlage')._figur).length;
        const bas = el(w, 'jmf-bas');
        bas.value = [...bas.options].map(o => o.value).find(v => v);
        bas.dispatchEvent(new w.Event('change'));
        expect(w.document.querySelectorAll('#benchmark-table tbody tr[data-rad]').length).toBeLessThan(8);
        expect(punkter(el(w, 'chart-jmf-statlage')._figur)).toHaveLength(fore);
    });
    it('bara grupper som når tröskeln: i exportläget med tröskeln 25 finns bara de större grupperna', () => {
        const w = medBlandad();
        w.eval('sattKTroskel(25, { fraga: false })');
        const { pts, rader } = w.eval("medExportLage(() => { renderStatistikLage(); return { pts: document.getElementById('chart-jmf-statlage')._figur, rader: jamforelseUnderlag() }; })");
        const alla = w.eval('jamforelseUnderlag()').rader;
        expect(rader.utelamnade.length).toBeGreaterThan(0);
        const visade = punkter(pts);
        expect(visade.every(p => p.n >= 25)).toBe(true);
        expect(visade.length).toBeLessThan(punkter(el(w, 'chart-jmf-statlage')._figur).length + 1);
        expect(visade.length).toBe(rader.rader.filter(r => r.statistik.p10 !== null && r.statistik.p90 !== null).length);
        expect(alla.some(r => r.n < 25)).toBe(true);
    });
    it('utan P10 och P90 i statistiken: ett meddelande i kortet i stället för diagrammet', () => {
        const w = createAppWindow(); w.__lasInDemodata();
        w.__state.statistik = w.eval('jamforelseUnderlag()').rader.map(r => ({ aid: r.aid, bas: r.bas, median: 34000 }));
        w.__state.statistikHasP10 = false; w.__state.statistikHasP90 = false;
        w.__ritaFlik('benchmark');
        expect(el(w, 'jmf-statlage-kort').hidden).toBe(false);
        expect(el(w, 'chart-jmf-statlage')._figur).toBeUndefined();
        expect(el(w, 'chart-jmf-statlage').textContent).toMatch(/P10 och P90/);
    });
    it('utan statistik bara bandkartan; utan ställningstagande bara statistikens spann', () => {
        const w = createAppWindow(); w.__lasInDemodata();
        w.__ritaFlik('benchmark');
        expect(el(w, 'lp-bandkarta-kort').hidden).toBe(false);
        expect(el(w, 'jmf-statlage-kort').hidden).toBe(true);
        expect(el(w, 'chart-jmf-statlage')._figur).toBeUndefined();
        const w2 = medBlandad();
        w2.__state.policy = [];
        w2.__ritaFlik('benchmark');
        expect(el(w2, 'lp-bandkarta-kort').hidden).toBe(true);
        expect(el(w2, 'chart-lp-bandmap')._figur).toBeUndefined();
        expect(el(w2, 'jmf-statlage-kort').hidden).toBe(false);
        expect(el(w2, 'chart-jmf-statlage')._figur).toBeTruthy();
    });
});

describe('Lönepolitik: organisationens band i bandkartan', () => {
    it('ett band per BAS med minst k personer, bredvid LPS-bandet', () => {
        const w = createAppWindow();
        w.__lasInDemodata();
        w.document.querySelector('.nav-item[data-tab="benchmark"]').click();
        const lager = w.document.getElementById('chart-lp-bandmap')._figur.lager;   // ritat av diagramkärnan (ADR-39)
        const orgLager = lager.find(l => l.serie === `${w.eval('orgNamn()')} (P10–P90)`);   // demot heter Exempelkommunen (ADR-36)
        expect(orgLager).toBeTruthy();
        expect(orgLager.marke).toBe('intervall');
        const d = w.__hamtaData();
        const basMedK = [...new Set(d.map(r => r.bas))].filter(b => d.filter(r => r.bas === b && r.lon > 0).length >= w.__K);
        expect(orgLager.data.length).toBe(basMedK.length);
        expect(orgLager.data.every(p => p.hog >= p.med && p.med >= p.lag)).toBe(true);
    });
});

describe('lönepolitik: policyFor-kaskad + flik', () => {
    const setPolicy = rows => { win.__state.policy = rows; };
    const P = (o) => Object.assign({ p10: 1, med: 2, p90: 3 }, o);

    it('mest specifik vinner: aid+bas före aid-only före bas-only', () => {
        setPolicy([
            P({ bas: 'D', tag: 'bas-only' }),
            P({ aid: '207', tag: 'aid-only' }),
            P({ aid: '207', bas: 'D', tag: 'aid+bas' })
        ]);
        expect(win.__policyFor('207', 'D').tag).toBe('aid+bas');
        expect(win.__policyFor('207', 'E').tag).toBe('aid-only');   // aid matchar, bas saknas i den raden
        expect(win.__policyFor('999', 'D').tag).toBe('bas-only');   // okänd aid → faller till BAS-nivå
        expect(win.__policyFor('999', 'Z')).toBeNull();
    });

    it('BAS-only-fil beter sig exakt som före ändringen', () => {
        setPolicy([P({ bas: 'A', tag: 'a' }), P({ bas: 'B', tag: 'b' })]);
        expect(win.__policyFor(null, 'A').tag).toBe('a');
        expect(win.__policyFor('207', 'B').tag).toBe('b');   // aid ignoreras när ingen aid-rad finns
        expect(win.__policyFor('207', null)).toBeNull();
    });

    it('AID-only-fil fungerar utan BAS', () => {
        setPolicy([P({ aid: '207', tag: 'x' })]);
        expect(win.__policyFor('207', null).tag).toBe('x');
        expect(win.__policyFor('207', 'D').tag).toBe('x');
        expect(win.__policyFor(null, 'D')).toBeNull();
    });

    it('policyNivaEtikett beskriver referensens nivå', () => {
        expect(win.__policyNivaEtikett({ aid: '1', bas: 'D' })).toBe('AID + BAS');
        expect(win.__policyNivaEtikett({ aid: '1' })).toBe('AID-specifik');
        expect(win.__policyNivaEtikett({ bas: 'D' })).toBe('BAS-intervall');
        expect(win.__policyNivaEtikett(null)).toBeNull();
    });

    it('tom policy → modellen flaggar hasPolicy=false och fliken visar tomstatus', () => {
        setPolicy([]);
        const m = win.__lonepolitikVymodell().modell;
        expect(m.hasPolicy).toBe(false);
        expect(() => win.__ritaLonepolitik()).not.toThrow();
        expect(win.document.getElementById('lonepolitik-empty').style.display).toBe('block');
    });

    it('med policy byggs modellen med täckningsgrad och maskeringstrappa', () => {
        win.__lasInDemodata();
        const bas = [...new Set(win.__hamtaData().map(r => r.bas))];
        setPolicy(bas.map(b => ({ bas: b, p10: 25000, med: 32000, p90: 45000 })));
        const m = win.__lonepolitikVymodell().modell;
        expect(m.hasPolicy).toBe(true);
        expect(m.byBas.length).toBeGreaterThan(0);
        expect(m.coverage.personsPct).toBeGreaterThan(0);
        // varje AID-grupp har en giltig maskeringsnivå
        const tiers = m.byBas.flatMap(b => b.groups.map(g => g.tier));
        tiers.forEach(t => expect(['full', 'count', 'masked']).toContain(t));
        // full analys kräver n >= kTroskel()
        m.byBas.forEach(b => b.groups.forEach(g => {
            if (g.tier === 'full') expect(g.n).toBeGreaterThanOrEqual(10);
            if (g.tier === 'masked') expect(g.n).toBeLessThan(5);
        }));
        expect(() => win.__ritaLonepolitik()).not.toThrow();
        expect(win.document.getElementById('lonepolitik-table')).not.toBeNull();
        setPolicy([]);   // städa så senare test inte påverkas
    });
});

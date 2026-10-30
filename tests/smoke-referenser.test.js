import { describe, it, expect, vi } from 'vitest';
import { createAppWindow } from './helpers/app-harness.js';
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
        expect(host.textContent).toMatch(/löneläget (ovanför|nedanför|inom) ställningstagandet/);
        expect(host.textContent).not.toMatch(/ställningstagandet ligger/);
        expect(d.querySelectorAll('#ref-tabell tbody tr').length).toBeGreaterThan(0);
        expect(d.querySelectorAll('#ref-tabell thead th').length).toBe(14);
        const f = d.getElementById('chart-ref-hantel')._figur;
        expect(f.lager.map(l => l.marke)).toEqual(['intervall', 'punkt']);
        expect(f.y.ordning.slice(0, 3).map(s => s.split(' · ').pop())).toEqual(['ställningstagandet', 'statistiken', 'organisationen']);
        expect(d.querySelectorAll('#ref-stat-mot-stallning tbody tr').length).toBeGreaterThan(0);
    });
    it('utan statistik visas överblicken mot ställningstagandet ensamt och säger att statistik saknas', () => {
        const w = fonster();
        w.__renderTabContent('benchmark');
        const d = w.document, host = d.getElementById('ref-overblick');
        expect(host.textContent).toMatch(/Jämförelsestatistik saknas/);
        expect(d.getElementById('ref-stat-mot-stallning')).toBeNull();
        expect(d.querySelectorAll('#ref-tabell thead th').length).toBe(11);
        expect(d.getElementById('chart-ref-hantel')._figur.y.ordning.some(s => /statistiken$/.test(s))).toBe(false);
    });
    it('statistik med bara median: inget läge mot statistiken, hanteln ritar bara strecket för den', () => {
        const w = fonster(); medStatistik(w, { spann: false });
        w.__renderTabContent('benchmark');
        const f = w.document.getElementById('chart-ref-hantel')._figur;
        expect(f.lager[0].data.some(p => /statistiken$/.test(p.y))).toBe(false);
        expect(f.lager[1].data.some(p => /statistiken$/.test(p.y))).toBe(true);
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
        const antal = new Set(w.document.getElementById('chart-ref-hantel')._figur.y.ordning.map(s => s.split(' · ').slice(0, 2).join(' · '))).size;
        expect(antal).toBeLessThanOrEqual(25);
        if (rader > 25) expect(w.document.getElementById('ref-overblick').textContent).toMatch(/tabellen har alla/);
    });
});
describe('Lönepolitik är avsnitt två i Jämförelse', () => {
    it('fliken syns med demodata utan statistik, Lönepolitik-knappen finns inte, aliaset leder rätt, källväxeln är borta', () => {
        const w = fonster(); const d = w.document;
        expect(d.getElementById('tab-lonepolitik')).toBeNull();
        expect(d.getElementById('view-lonepolitik')).toBeNull();
        expect(d.getElementById('tab-benchmark').hidden).toBe(false);
        expect(d.getElementById('tab-benchmark').textContent.trim()).toBe('Jämförelse');
        expect(w.eval("tabMal('lonepolitik')")).toBe('benchmark');
        w.__renderTabContent('lonepolitik');
        expect([...d.querySelectorAll('#view-benchmark > details.avsnitt')].map(a => a.id)).toEqual(['avsnitt-jmf-overblick', 'avsnitt-jmf-stallningstagande', 'avsnitt-jmf-statistik']);
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
    it('länkar till lonepolitik når Jämförelse', () => {
        const w = fonster(); const d = w.document;
        w.eval("navigateTo('lonepolitik')");
        expect(d.getElementById('tab-benchmark').classList.contains('active')).toBe(true);
        expect(d.getElementById('page-title').textContent).toBe('Jämförelse');
        const a = d.createElement('button'); a.setAttribute('data-goto-tab', 'lonepolitik'); d.body.appendChild(a);
        d.querySelector('.nav-item[data-tab="dashboard"]').click(); a.click();
        expect(d.getElementById('tab-benchmark').classList.contains('active')).toBe(true);
    });
    it('Nästa steg hoppar över Jämförelse när ingen referens finns', () => {
        const w = fonster();
        w.__state.policy = []; w.eval('synkaJamforelseFlik()');
        w.__renderTabContent('kon');
        w.document.querySelector('.nav-item[data-tab="kon"]').click();
        expect(w.document.querySelector('.flow-next-btn').dataset.flowTab).toBe('utforska');
    });
});

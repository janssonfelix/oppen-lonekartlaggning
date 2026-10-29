/**
 * Röktest (jsdom): Säkerhet, interna fel, AID, ansvarskod, sektorsöversikt och SKR-referensen.
 *
 * Utbrutet ur smoke.test.js så att Vitest fördelar röktesterna över flera arbetare; varje describe-block
 * skapar sina egna fönster via createAppWindow (tests/helpers/app-harness.js).
 */
import { describe, it, expect } from 'vitest';
import { createAppWindow } from './helpers/app-harness.js';

describe('säkerhet, dataskydd och HR-logik', () => {
    // Skadlig text i varje fält som kommer ur personalfilen eller ett organisationspaket.
    const X = n => `Y${n}<img src=x onerror="window.__xss='${n}'"><b class="inj">b</b>`;
    const skadligtUnderlag = w => {
        const data = [];
        for (let i = 0; i < 300; i++) {
            const g = i % 6;
            data.push({ bas: 'ABC'[g % 3], kon: i % 3 ? 'kvinna' : 'man', lon: 28000 + g * 2500 + (i % 17) * 150 + (i % 3 ? 0 : 2500),
                alder: 25 + (i % 35), aid: g < 3 ? `10${g}` : `20${g}`, yrke: `${g}${X('yrke' + g)}`, yrkeLabel: X('label' + g), radnr: i + 2 });
        }
        w.__state.data = data;
        const paket = { format: 'lonekartlaggning-organisationspaket', version: 1, organisation: { namn: X('org') }, utgivare: X('utg'), skapat: '2026-10-01',
            profil: { jamforelseNamn: X('jnamn'), jamforelseGenitiv: X('jgen'), jamforelseKort: X('jkort') },
            referens: { namn: X('ref'), kortnamn: X('refk'), rader: ['A', 'B', 'C'].map((bas, i) => ({ bas, aid: null, p10: 28000 + i * 2500, med: 31000 + i * 2500, p90: 34000 + i * 2500 })) },
            statistik: { namn: X('stat'), rader: [0, 1, 2, 3, 4, 5].map(g => ({ aid: g < 3 ? `10${g}` : `20${g}`, aidFull: X('aidfull' + g), bas: 'ABC'[g % 3],
                median: 33000 + g * 1000, p10: 30000, p90: 36000, nKv: 20, nMa: 20, andelKv: g < 3 ? 80 : 20 })) } };
        w.eval(`lasInPaket(${JSON.stringify(JSON.stringify(paket))}, 'x')`);
        w.eval('populateSelects(); unlockTabs(); updateDashboardStats(); generateRapport(); generateSkevhet();');
    };

    it('skadlig text i fil och organisationspaket skapar inga element i någon flik', async () => {
        const w = createAppWindow();
        skadligtUnderlag(w);
        for (const t of ['dashboard', 'bestammelser', 'matrix', 'likvardighet', 'struktur', 'prioritering', 'loneoversyn',
            'handlingsplan', 'dokumentera', 'kon', 'lonepolitik', 'utforska', 'benchmark', 'info']) w.__renderTabContent(t);
        await new Promise(r => setTimeout(r, 300));
        const injicerat = [...w.document.querySelectorAll('img[onerror], [onerror], b.inj')]
            .map(e => `${e.closest('[id]')?.id}: ${e.outerHTML.slice(0, 60)}`);
        expect(injicerat).toEqual([]);
        expect(w.__xss).toBeUndefined();
    });

    it('automatisk rensning vid inaktivitet är på som standard (90 minuter)', () => {
        const w = createAppWindow();
        expect(w.__state.inactivityTimeoutMin).toBe(90);
    });

    const inaktivitetsPaket = inst => ({ format: 'lonekartlaggning-organisationspaket', version: 1, organisation: { namn: 'Exempelorganisationen' },
        skapat: '2026-10-08', installningar: inst, referens: { rader: [{ bas: 'A', p10: 20000, med: 25000, p90: 30000 }] } });
    const lasPaket = (w, p) => w.eval(`lasInPaket(${JSON.stringify(JSON.stringify(p))}, 'x.lonepaket.json')`);

    it('organisationspaketet kan låsa rensningen vid inaktivitet: rullistan i Vad lagras? är låst och säger varför (ADR-47)', () => {
        const w = createAppWindow();
        expect(lasPaket(w, inaktivitetsPaket({ inaktivitetMin: 45, inaktivitetLast: true })).ok).toBe(true);
        expect(w.__state.inactivityTimeoutMin).toBe(45);
        w.eval('setInactivityTimeout(0)');   // ingen väg runt låsningen
        expect(w.__state.inactivityTimeoutMin).toBe(45);
        w.eval('openDataResidency()');
        const sel = w.document.getElementById('inactivity-timeout-select');
        expect(sel.disabled).toBe(true);
        expect(sel.value).toBe('45');
        const not = w.document.getElementById('inactivity-last');
        expect(not.hidden).toBe(false);
        expect(not.textContent).toMatch(/Låst till 45 minuter av organisationspaketet från Exempelorganisationen/);
        expect(w.document.getElementById('paket-info').textContent).toMatch(/rensning vid inaktivitet låst till 45 minuter/);
        // Rensa all data tar bort låsningen tillsammans med paketet, och tiden går tillbaka till standard.
        w.eval('_rensaAllData()');
        expect(w.__state.paketLas.inaktivitetMin).toBeNull();
        expect(w.__state.inactivityTimeoutMin).toBe(90);
        w.eval('openDataResidency()');
        expect(w.document.getElementById('inactivity-timeout-select').disabled).toBe(false);
        expect(w.document.getElementById('inactivity-last').hidden).toBe(true);
    });
    it('ett paket som sätter rensningstiden utan att låsa den: värdet gäller men går att ändra; Av kan inte låsas', () => {
        const w = createAppWindow();
        expect(lasPaket(w, inaktivitetsPaket({ inaktivitetMin: 60 })).ok).toBe(true);
        expect(w.__state.inactivityTimeoutMin).toBe(60);
        w.eval('setInactivityTimeout(15)');
        expect(w.__state.inactivityTimeoutMin).toBe(15);
        const r = lasPaket(w, inaktivitetsPaket({ inaktivitetMin: 0, inaktivitetLast: true }));
        expect(r.ok).toBe(true);
        expect(r.meddelande).toMatch(/kan inte låsas i läget Av/);
        expect(w.__state.inactivityTimeoutMin).toBe(0);
        expect(w.__state.paketLas.inaktivitetMin).toBeNull();
        w.eval('setInactivityTimeout(30)');
        expect(w.__state.inactivityTimeoutMin).toBe(30);
    });

    const steg = (w, re) => [...w.document.querySelectorAll('#process-tracker .ptrack-row')].find(r => re.test(r.textContent));
    const status = (w, re) => steg(w, re).querySelector('.ptrack-status').dataset.status;   // klar | delvis | ej | manuell

    it('processöversikten: lika och likvärdigt arbete är inte klara medan punkter återstår i Att göra', () => {
        const w = createAppWindow();
        w.__loadDemoData();
        w.__renderProcessTracker();
        expect(status(w, /3\. Lika arbete/)).toBe('delvis');
        expect(status(w, /4\. Likvärdigt arbete/)).toBe('delvis');
        expect(steg(w, /4\. Likvärdigt arbete/).textContent).toMatch(/0 av \d+ kandidatpar hanterade/);
        // När alla punkter för lika respektive likvärdigt arbete är hanterade blir stegen klara.
        const punkter = w.eval('buildActionChecklist()');
        const done = w.__state._actionChecklistDone || (w.__state._actionChecklistDone = new w.Set());
        punkter.filter(p => ['Lika arbete', 'EU 2023/970', 'Likvärdigt arbete'].includes(p.kategori)).forEach(p => done.add(p.id));
        w.__renderProcessTracker();
        expect(status(w, /3\. Lika arbete/)).toBe('klar');
        expect(status(w, /4\. Likvärdigt arbete/)).toBe('klar');
    });

    it('processöversikten: inga kandidatpar betyder att likvärdigt arbete är klart', () => {
        const w = createAppWindow();
        w.__loadDemoData();
        w.__state.likvardighet.result = { pairs: [] };
        w.__renderProcessTracker();
        expect(status(w, /4\. Likvärdigt arbete/)).toBe('klar');
    });

    it('Att göra: kandidatparen i likvärdigt arbete kommer med även utan jämförelsestatistik', () => {
        const w = createAppWindow();
        w.__loadDemoData();
        expect(w.__state.statistik.length).toBe(0);
        expect(w.eval('buildActionChecklist()').filter(p => p.kategori === 'Likvärdigt arbete').length).toBeGreaterThan(0);
    });

    it('Börja här: könsrelaterade fynd går före avvikelser mot lönepolitiken, utan dubblerad rubrik', () => {
        const w = createAppWindow();
        w.__loadDemoData();
        w.eval('renderActionChecklist()');
        const forsta = w.document.querySelector('#att-gora-borja li .att-gora-kat').textContent;
        expect(['Lika arbete', 'EU 2023/970', 'Likvärdigt arbete']).toContain(forsta.trim());
        expect(w.eval('buildActionChecklist()').filter(p => /^(Börja här|Värt att granska):/.test(p.titel))).toEqual([]);
    });
});

describe('interna fel syns i stället för att sväljas', () => {
    it('ett fel i en del av Att göra hoppar över delen, men rapporteras och visas', () => {
        const w = createAppWindow();
        w.__loadDemoData();
        const varningar = [];
        w.console.warn = (...a) => varningar.push(a.join(' '));
        w.eval("likvardighetResultat = () => { throw new Error('trasigt 203020 och 36725'); }");
        const punkter = w.eval('buildActionChecklist()');
        expect(punkter.length).toBeGreaterThan(0);                              // resten av listan finns kvar
        expect(w.__state._interntFel.map(f => f.plats)).toContain('Att göra: likvärdigt arbete');
        const banner = w.document.getElementById('internt-fel-banner');
        expect(banner.hidden).toBe(false);
        expect(banner.textContent).toMatch(/Att göra: likvärdigt arbete/);
        expect(banner.textContent).toMatch(/ofullständigt/);
        expect(varningar.join('\n')).toMatch(/Att göra: likvärdigt arbete/);
        expect(varningar.join('\n')).not.toMatch(/\d/);                          // inga siffror (kan vara data) i konsolen
        w.__clearAllData();
        expect(banner.hidden).toBe(true);
        expect(w.__state._interntFel).toEqual([]);
    });
    it('vid normal körning av demot med alla flikar uppstår inga interna fel', async () => {
        const w = createAppWindow();
        w.__loadDemoData();
        for (const t of ['dashboard', 'bestammelser', 'matrix', 'likvardighet', 'struktur', 'prioritering', 'loneoversyn',
            'handlingsplan', 'dokumentera', 'kon', 'lonepolitik', 'utforska', 'benchmark', 'info']) w.__renderTabContent(t);
        await new Promise(r => setTimeout(r, 300));
        expect(w.__state._interntFel || []).toEqual([]);
        expect(w.document.getElementById('internt-fel-banner').hidden).toBe(true);
    });
});

describe('demot och testdatan har riktiga AID-koder', () => {
    it('varje AID i demot finns i etikettlistan', async () => {
        const { etikett } = await import('../src/lib/aid.js');
        const w = createAppWindow();
        w.__loadDemoData();
        const okanda = [...new Set(w.__state.data.map(r => r.aid))].filter(a => !etikett(a));
        expect(okanda).toEqual([]);
    });
    it('varje AID i den syntetiska testdatan finns i etikettlistan', async () => {
        const { etikett } = await import('../src/lib/aid.js');
        const { byggTestCsv } = await import('../tools/lib/testdata.mjs');
        const koder = [...new Set(byggTestCsv(400).trim().split('\n').slice(1).map(r => r.split(';')[2].split(' ')[0]))];
        expect(koder.filter(a => !etikett(a))).toEqual([]);
    });
});

describe('sektorsöversikten', () => {
    it('kortet visar en rad per sektor med demot, i prefixordning', () => {
        const w = createAppWindow();
        w.__loadDemoData();
        w.__renderTabContent('struktur');
        const rader = [...w.document.querySelectorAll('#sektor-table tbody tr')].map(tr => tr.querySelector('.sektor-namn').textContent.trim());
        expect(rader).toEqual(['Vård- och omsorgsarbete med mera', 'Förskole-, skol-, fritids- och annan pedagogisk verksamhet', 'Teknikarbete']);
        expect(w.document.getElementById('struktur-sektorer').textContent).toMatch(/på att kvinnor och män arbetar i olika sektorer/);
        expect(w.document.getElementById('chart-sektorer')._figur.lager.map(l => l.serie)).toEqual(['Förklaras av ålder och BAS', 'Rå', 'Justerad (ålder, BAS)']);
    });
    it('klick på en sektor öppnar Utforska med sektorn som villkor', () => {
        const w = createAppWindow();
        w.__loadDemoData();
        w.__renderTabContent('struktur');
        w.document.querySelector('#sektor-table [data-sektor="Teknikarbete"]').click();
        const u = w.eval('explorerUrval()').urval;
        expect(u.villkor).toEqual([expect.objectContaining({ falt: 'sektor', op: 'enAv', varde: ['Teknikarbete'] })]);
        expect(w.document.getElementById('explore-rad').value).toBe('aid');
    });
});

describe('Utforska: slå ihop små yrkesgrupper', () => {
    const w = createAppWindow();
    const p = (aid, label, n) => Array.from({ length: n }, (_, i) => ({ aid, yrke: `${aid} ${label}`, yrkeLabel: label, bas: 'C',
        kon: i % 2 ? 'man' : 'kvinna', lon: 30000 + i * 37, alder: 30 + i, radnr: i + 2 }));
    w.__state.data = [...p('207011', 'Usk', 24), ...p('207024', 'Vb', 5), ...p('207009', 'Usk hemtj', 7), ...p('502010', 'Sysutv', 22)];
    w.eval('populateSelects(); unlockTabs();');
    const d = w.document;
    const satt = (id, v) => { d.getElementById(id).value = v; };
    it('rutan syns bara när raderna är yrkesgrupper', () => {
        w.__renderTabContent('utforska');
        satt('explore-rad', 'bas'); w.__renderExplorer();
        expect(d.getElementById('explore-sla-ihop-rad').hidden).toBe(true);
        satt('explore-rad', 'aid'); w.__renderExplorer();
        expect(d.getElementById('explore-sla-ihop-rad').hidden).toBe(false);
    });
    it('ikryssad: små yrken i samma AID-mellannivå visas som en grupp (i exportläget; på skärmen är inga grupper små, ADR-51)', () => {
        satt('explore-rad', 'aid'); satt('explore-kolumn', 'ingen');
        d.getElementById('explore-sla-ihop').checked = true;
        w.__state.kLage = 'export';
        w.__renderExplorer();
        expect(d.getElementById('explore-table').textContent).toMatch(/Övriga i AID 2070xx \(2 yrken\)/);
        d.getElementById('explore-sla-ihop').checked = false;
        w.__renderExplorer();
        expect(d.getElementById('explore-table').textContent).not.toMatch(/Övriga i/);
        w.__state.kLage = 'skarm';
    });
    it('klick på en hopslagen grupp förklarar sammanslagningen, inte "under 10"', () => {
        satt('explore-rad', 'aid'); satt('explore-kolumn', 'ingen');
        d.getElementById('explore-sla-ihop').checked = true;
        w.__renderExplorer();
        w.eval(`explorerHandleClick({ rad: 'Övriga i AID 2070xx (2 yrken)', kol: null })`);
        const not = d.getElementById('explore-note').textContent;
        expect(not).toMatch(/slagits ihop av flera små yrken/);
        expect(not).not.toMatch(/minst 10 personer/);
        d.getElementById('explore-sla-ihop').checked = false;
    });
    it('Lika arbete påverkas aldrig av hopslagningen', () => {
        d.getElementById('explore-sla-ihop').checked = true;
        w.__renderExplorer();
        w.__renderTabContent('matrix');
        expect(d.getElementById('matrix-table').textContent).not.toMatch(/Övriga i/);
    });
});

describe('ansvarskod i Lika arbete', () => {
    // Ett yrke där männen oftare har ledningsansvar och högre lön, och ett yrke utan ansvarskoder.
    const bygg = (medAnsvar = true) => {
        const rader = [];
        const rad = (aid, kon, lon, alder, grupp, koder) => ({ aid, yrke: aid + ' Förskollärare', yrkeLabel: 'Förskollärare', bas: alder % 2 ? 'B' : 'C',
            kon, lon, alder, ...(medAnsvar ? { ansvarskoder: koder, ansvarsgrupp: grupp } : {}) });
        for (let i = 0; i < 14; i++) rader.push(rad('402010', 'kvinna', 30000 + i * 40, 30 + i, 'inget', []));
        for (let i = 0; i < 12; i++) rader.push(rad('402010', 'man', 30400 + i * 40, 31 + i, 'inget', []));
        for (let i = 0; i < 11; i++) rader.push(rad('402010', 'man', 36000 + i * 40, 35 + i, 'ledning', ['C']));
        for (let i = 0; i < 20; i++) rader.push(rad('207011', i % 2 ? 'man' : 'kvinna', 28000 + i * 30, 25 + i, 'inget', []));
        return rader;
    };
    const oppna = (medAnsvar = true) => {
        const w = createAppWindow();
        w.__state.data = bygg(medAnsvar);
        w.eval('populateSelects(); unlockTabs();');
        w.__renderTabContent('matrix');
        return w;
    };
    it('yrket får en underrad per ansvarsgrupp och raden Utan ledningsansvar', () => {
        const w = oppna();
        const rader = [...w.document.querySelectorAll('#matrix-table tbody tr')];
        const i = rader.findIndex(tr => /402010/.test(tr.textContent) && !tr.classList.contains('la-underrad'));
        const under = rader.slice(i + 1).filter((tr, j, a) => a.slice(0, j + 1).every(t => t.classList.contains('la-underrad')));
        expect(under.map(tr => tr.textContent)).toEqual([expect.stringMatching(/Ledningsansvar/), expect.stringMatching(/Inget särskilt ansvar|Utan ansvar/),
            expect.stringMatching(/Utan ledningsansvar/)]);
        expect(under[0].textContent).toMatch(/Gruppens median/);
        expect(under[2].textContent).toMatch(/9[89],\d %/);
        // yrket utan ledningsansvar hos någon får inga underrader
        const j = rader.findIndex(tr => /207011/.test(tr.textContent));
        expect(rader[j + 1]?.classList.contains('la-underrad') ?? false).toBe(false);
    });
    it('underraderna följer sitt yrke när tabellen sorteras', () => {
        const w = oppna();
        const th = w.document.querySelectorAll('#matrix-table thead th');
        for (const klick of [0, 0, 1]) {
            th[klick].click();
            const rader = [...w.document.querySelectorAll('#matrix-table tbody tr')];
            rader.forEach((tr, i) => {
                if (tr.classList.contains('la-underrad')) expect(rader[i - 1].classList.contains('la-underrad') || /402010/.test(rader[i - 1].textContent)).toBe(true);
            });
        }
    });
    it('utan ansvarskolumn syns inga underrader', () => {
        const w = oppna(false);
        expect(w.document.querySelectorAll('#matrix-table .la-underrad').length).toBe(0);
    });
    it('regressionen: ansvarssteget redovisas separat och huvudtalet är oförändrat', () => {
        const med = oppna(true).eval('runOLSRegression()');
        const utan = oppna(false).eval('runOLSRegression()');
        expect(med.konPct).toBeCloseTo(utan.konPct, 10);
        expect(med.explainedShare).toBeCloseTo(utan.explainedShare, 10);
        expect(med.sequential.map(s => s.name)).toEqual(utan.sequential.map(s => s.name));
        expect(utan.ansvarSteg).toBeNull();
        expect(med.ansvarSteg).toMatchObject({ status: 'ok', name: '+ Ansvar' });
        expect(Math.abs(med.ansvarSteg.gapPct)).toBeLessThan(Math.abs(med.sequential.at(-1).gapPct));
    });
    it('_computeSequentialGap får steget + Ansvar sist när raderna har ansvarsgrupp', () => {
        const w = oppna(true);
        const steg = w.eval(`(() => { const d = getData(); return _computeSequentialGap(d, 40, ['B', 'C']).map(s => s.name); })()`);
        expect(steg).toEqual(['Endast kön', '+ BAS-intervall', '+ Ålder', '+ Yrkesgrupp', '+ Ansvar']);
    });
    it('kortet visar ansvaret på en egen rad under budgeten, inte i den', () => {
        const w = oppna(true);
        const kort = w.document.getElementById('regression-card').textContent.replace(/\s+/g, ' ');
        expect(kort).toMatch(/Ansvar \(ledningsansvar, särskilt uppdrag\) förklarar ytterligare [\d,]+ procentenheter/);
        expect(kort).toMatch(/Huvudtalet ovan räknar inte bort ansvaret/);
        expect(w.document.querySelector('#regression-card .reg-budget-legend').textContent).not.toMatch(/ansvar/i);
        const utan = oppna(false).document.getElementById('regression-card').textContent;
        expect(utan).not.toMatch(/förklarar ytterligare/);
    });
});

describe('ansvarskod i dossiern, Personer att granska och demot', () => {
    it('demot har ansvarskoder och en ansvarskolumn', () => {
        const w = createAppWindow();
        w.__loadDemoData();
        expect(w.__state.ansvarKolumn).toMatchObject({ namn: 'Ansvarskod (demo)' });
        const grupper = new Set(w.__state.data.map(r => r.ansvarsgrupp));
        expect([...grupper].sort()).toEqual(['inget', 'ledning', 'uppdrag']);
        expect(w.__state.data.filter(r => r.ansvarsgrupp === 'ledning').length).toBeGreaterThanOrEqual(10);
    });
    it('demots huvudtal i regressionen är detsamma med och utan ansvaret', () => {
        const w = createAppWindow();
        w.__loadDemoData();
        const med = w.eval('runOLSRegression()');
        w.__state.data.forEach(r => { r.ansvarsgrupp = null; r.ansvarskoder = null; });
        const utan = w.eval('runOLSRegression()');
        expect(med.konPct).toBeCloseTo(utan.konPct, 10);
        expect(med.ansvarSteg).toMatchObject({ status: 'ok' });
        expect(utan.ansvarSteg).toBeNull();
    });
    it('dossiern visar antal per ansvarsgrupp och kön, aldrig lön per ansvarsgrupp', () => {
        const w = createAppWindow();
        w.__loadDemoData();
        const kand = w.__gruppdossierCandidates().find(c => c.rows.some(r => r.ansvarsgrupp === 'ledning'));
        const d = w.__buildGruppdossier(kand.key);
        const nLed = kand.rows.filter(r => r.ansvarsgrupp === 'ledning');
        expect(d.ansvar).toMatchObject({ ledning: { kv: nLed.filter(r => r.kon === 'kvinna').length, ma: nLed.filter(r => r.kon === 'man').length } });
        const html = w.eval(`_gdRenderBody(__buildGruppdossier(${JSON.stringify(kand.key)}))`);
        expect(html).toMatch(/Ledningsansvar \d+ kv \/ \d+ män/);
        expect(w.__gruppdossierAsText(d)).toMatch(/Ansvar: Ledningsansvar \d+ kv \/ \d+ man/);
    });
    it('dossiern utan ansvarskolumn har ingen ansvarsrad', () => {
        const w = createAppWindow();
        w.__loadDemoData();
        w.__state.data.forEach(r => { r.ansvarsgrupp = null; r.ansvarskoder = null; });
        w.__state.ansvarKolumn = null;
        const key = w.__gruppdossierCandidates()[0].key;
        expect(w.__buildGruppdossier(key).ansvar).toBeNull();
        expect(w.eval(`_gdRenderBody(__buildGruppdossier(${JSON.stringify(key)}))`)).not.toMatch(/Ledningsansvar/);
    });
    it('Personer att granska har kolumnen Ansvar bara när ansvarskolumnen finns', () => {
        const w = createAppWindow();
        w.__loadDemoData();
        w.eval('renderPersonerAttGranska(true)');
        const rubriker = () => [...w.document.querySelectorAll('#pag-tabell thead th')].map(th => th.textContent);
        expect(rubriker()).toContain('Ansvar');
        expect([...w.document.querySelectorAll('#pag-tabell tbody tr')].every(tr => tr.children.length === rubriker().length)).toBe(true);
        w.__state.ansvarKolumn = null;
        w.eval('renderPersonerAttGranska(true)');
        expect(rubriker()).not.toContain('Ansvar');
    });
});

describe('Underlagets kvalitet: AID-kodningen', () => {
    it('demot ger OK på alla AID-kriterier och de finns med i bedömningen', () => {
        const w = createAppWindow();
        w.__loadDemoData();
        const b = w.eval('bedomningUnderlag()');
        const aid = b.kriterier.filter(c => c.id.startsWith('aid-'));
        expect(aid.map(c => c.id)).toEqual(['aid-okanda', 'aid-restkoder', 'aid-spridning', 'aid-ledning-utan-ansvar', 'aid-otillaten-ansvarskod']);
        expect(aid.filter(c => c.status !== 'ok').map(c => c.text)).toEqual([]);
    });
    it('okända koder ger varning i bedömningen', () => {
        const w = createAppWindow();
        w.__state.data = Array.from({ length: 30 }, (_, i) => ({ aid: i < 3 ? '751010' : '207011', yrke: 'x', bas: 'C', kon: i % 2 ? 'man' : 'kvinna', lon: 30000 + i * 10, alder: 30 + i }));
        const b = w.eval('bedomningUnderlag()');
        expect(b.kriterier.find(c => c.id === 'aid-okanda').status).toBe('varning');
        expect(b.status).not.toBe('ok');
    });
});

describe('AID: metodtext enligt handboken', () => {
    it('Om verktyget förklarar AID, sektorerna och etikettlistans version och källa, utan §', () => {
        const w = createAppWindow();
        w.document.querySelector('.nav-item[data-tab="info"]').click();
        w.eval("renderInfoTab('metodik')");
        const avsnitt = w.document.getElementById('om-aid');
        expect(avsnitt).not.toBeNull();
        const t = avsnitt.textContent.replace(/\s+/g, ' ');
        expect(t).toMatch(/inte ett arbetsvärderingssystem/);
        expect(t).toMatch(/2026-09-23/);
        expect(t).toMatch(/SKR/);
        expect(t).toMatch(/232 etiketter/);
        expect(t).toMatch(/Ledningsansvar.*Särskilt uppdrag/);
        expect(t).not.toMatch(/§/);
    });
    it('Lika arbete har en not om AID-grupperna som utgångspunkt', () => {
        const w = createAppWindow();
        const p = w.document.getElementById('la-aid-bakgrund');
        expect(p?.textContent).toMatch(/utgångspunkt/);
        expect(p.textContent).toMatch(/inte ett arbetsvärderingssystem/);
    });
    it('Word-utkastets avsnitt Lika arbete innehåller metodtexten', () => {
        const w = createAppWindow();
        w.__loadDemoData();
        const html = w.__docDraftHtml();
        const lika = html.slice(html.indexOf('Lika arbete — kvinnor och män i samma yrke'), html.indexOf('Likvärdigt arbete — kvinnodominerade yrken'));
        expect(lika).toMatch(/AID är inte ett arbetsvärderingssystem/);
    });
});

describe('ansvarskoden och konfigurationsfilen', () => {
    it('konfigurationsfilen innehåller varken ansvarskoder eller ansvarskolumnen', () => {
        const w = createAppWindow();
        w.__loadDemoData();
        expect(JSON.stringify(w.__buildConfigSnapshot())).not.toMatch(/ansvar/i);
    });
});

describe('sektorsöversiktens punkter i Att göra', () => {
    it('räknas ur samma punkter som hela listan, också likvärdighetsparen, utan att bygga hela listan', async () => {
        const { sektorsnamn } = await import('../src/lib/aid.js');
        const w = createAppWindow();
        w.__loadDemoData();
        const alla = w.eval('buildActionChecklist()');
        const grupp = w.eval('buildActionChecklist({ endastGrupper: true })');
        const medAid = alla.filter(it => it.aid);
        expect(medAid.some(it => it.id.startsWith('lv-'))).toBe(true);
        expect(grupp.map(it => it.id).sort()).toEqual(medAid.map(it => it.id).sort());
        const vantat = {};
        for (const it of medAid) { const s = sektorsnamn(it.aid); vantat[s] = (vantat[s] || 0) + 1; }
        expect(w.eval('_sektorPunkter()')).toEqual(vantat);
    });
});

describe('ansvarskodskolumnen vid inläsning', () => {
    const vendorPapa = async w => {
        const { readFileSync } = await import('node:fs');
        const { join, dirname } = await import('node:path');
        const { fileURLToPath } = await import('node:url');
        w.eval(readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'vendor', 'papaparse.min.js'), 'utf8'));
    };
    const csv = (extraRubrik = '', extra = () => '') => {
        const rader = [`BAS;Månadslön;Ålder;Kön;AID;Ansvarskod${extraRubrik}`];
        for (let i = 0; i < 30; i++) rader.push(`C;${30000 + i * 10};${30 + i};${i % 2 ? 'Man' : 'Kvinna'};207011;${i % 5 ? '' : 'C'}${extra(i)}`);
        return rader.join('\n');
    };
    it('"— ingen —" för Ansvarskod i kolumnmappningen gör att kolumnen inte läses', async () => {
        const w = createAppWindow();
        await vendorPapa(w);
        w.__state.columnMap = { ansvar: '' };
        w.loadStructureFile(new w.File([csv()], 'p.csv', { type: 'text/csv' }));
        for (let i = 0; i < 100 && !w.__state.data.length; i++) await new Promise(r => setTimeout(r, 20));
        expect(w.__state.data.length).toBe(30);
        expect(w.__state.ansvarKolumn).toBeNull();
        expect(w.__state.data.every(r => r.ansvarsgrupp === null || r.ansvarsgrupp === undefined)).toBe(true);
    });
    it('kolumnmappningens "— ingen —" för Ansvarskod sparas och visas som vald', async () => {
        const w = createAppWindow();
        await vendorPapa(w);
        w.loadStructureFile(new w.File([csv()], 'p.csv', { type: 'text/csv' }));
        for (let i = 0; i < 100 && !w.__state.data.length; i++) await new Promise(r => setTimeout(r, 20));
        expect(w.__state.ansvarKolumn).toMatchObject({ namn: 'Ansvarskod' });
        const sel = () => w.document.querySelector('#column-map-panel [data-colmap-role="ansvar"]');
        expect(sel().value).toBe('Ansvarskod');
        sel().value = '';
        w.document.getElementById('colmap-apply').click();
        expect(w.__state.columnMap.ansvar).toBe('');
        w.__state.data = [];
        for (let i = 0; i < 100 && !w.__state.data.length; i++) await new Promise(r => setTimeout(r, 20));
        expect(w.__state.ansvarKolumn).toBeNull();
        expect(sel().value).toBe('');
    });
    it('en fil med kolumnen Förnamn (utan andra namnkolumner) avvisas och inget läses in', async () => {
        const w = createAppWindow();
        await vendorPapa(w);
        // Ett förnamn per rad: värdekontrollen kräver för- OCH efternamn, så bara rubriken kan fälla filen.
        const namn = ['Anna', 'Bo', 'Cecilia', 'David', 'Eva'];
        w.loadStructureFile(new w.File([csv(';Förnamn', i => `;${namn[i % namn.length]}`)], 'f.csv', { type: 'text/csv' }));
        await new Promise(r => setTimeout(r, 400));
        expect(w.__state.data).toEqual([]);
        const status = w.document.getElementById('data-status').textContent;
        expect(status).toMatch(/Filen avvisad/);
        expect(status).toMatch(/Förnamn/);
    });
    it('bara vitlistade fält hålls i minnet; övriga kolumner läses aldrig in, och alla BAS ingår (riskanalysen §6.4)', async () => {
        const w = createAppWindow();
        await vendorPapa(w);
        const rader = [csv(';Poäng;Anställningsnr;Ansvar;Kostnadsställe', i => `;${300 + i};ANSTNR${9000 + i};ANSVAR${i};KST${i}`)];
        for (let i = 0; i < 3; i++) rader.push(`K;${99000 + i};${40 + i};Kvinna;207011;;${300 + i};ANSTNR${9900 + i};ANSVAR9${i};KST9${i}`);
        w.loadStructureFile(new w.File([rader.join('\n')], 'p.csv', { type: 'text/csv' }));
        for (let i = 0; i < 100 && !w.__state.data.length; i++) await new Promise(r => setTimeout(r, 20));
        expect(w.__state.data.length).toBe(33);
        const nycklar = [...new Set(w.__state.data.flatMap(r => Object.keys(r)))].sort();
        expect(nycklar).toEqual(['aid', 'alder', 'ansvarsgrupp', 'ansvarskoder', 'bas', 'kon', 'lon', 'poang', 'radnr', 'yrke', 'yrkeLabel']);
        const allt = JSON.stringify(w.__state.data);
        expect(allt).not.toMatch(/ANSTNR|ANSVAR\d|KST\d/);
        expect(w.__state.data.filter(r => r.bas === 'K').length).toBe(3);
    });
    it('en avvisad fil ändrar inte ansvarskolumnen för den data som redan finns', async () => {
        const w = createAppWindow();
        await vendorPapa(w);
        w.__loadDemoData();
        const fore = JSON.stringify(w.__state.ansvarKolumn);
        w.loadStructureFile(new w.File([csv(';Personnummer', i => `;19800101-${String(1000 + i)}`)], 'p.csv', { type: 'text/csv' }));
        await new Promise(r => setTimeout(r, 400));
        expect(JSON.stringify(w.__state.ansvarKolumn)).toBe(fore);
    });
});

describe('ansvarsraden och ansvarskolumnen vid fel', () => {
    const vendorPapa = async w => {
        const { readFileSync } = await import('node:fs');
        const { join, dirname } = await import('node:path');
        const { fileURLToPath } = await import('node:url');
        w.eval(readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'vendor', 'papaparse.min.js'), 'utf8'));
    };
    it('ansvarsraden visar skillnaden med tecken och säger till när den byter riktning', () => {
        const w = createAppWindow();
        const t = (a, b) => w.eval(`_ansvarRadText(${a}, ${b})`).replace(/<[^>]+>/g, '');
        expect(t(-6.82, -5.1)).toMatch(/förklarar ytterligare 1,72 procentenheter.*−5,10 %.*före −6,82 %/);
        expect(t(-1, 0.8)).toMatch(/byter skillnaden riktning, från −1,00 % till \+0,80 %/);
        expect(t(-1, 0.8)).not.toMatch(/förklarar ytterligare/);
        expect(t(-5, -6)).toMatch(/förklarar inget.*större, −6,00 % \(före −5,00 %\)/);
    });
    it('ett CSV-fel mitt i läsningen återställer ansvarskolumnen för den data som redan finns', async () => {
        const w = createAppWindow();
        await vendorPapa(w);
        w.__loadDemoData();
        const fore = JSON.stringify(w.__state.ansvarKolumn);
        const antal = w.__state.data.length;
        w.Papa.parse = (text, cfg) => {
            const falt = ['BAS', 'Månadslön', 'Ålder', 'Kön', 'AID', 'Annan ansvarskod'];
            for (let i = 0; i < 60; i++) {
                cfg.step({ data: { BAS: 'C', 'Månadslön': String(30000 + i), 'Ålder': '40', 'Kön': 'Kvinna', AID: '207011', 'Annan ansvarskod': 'C' }, meta: { fields: falt } }, { abort() {} });
            }
            cfg.error();
        };
        w.loadStructureFile(new w.File(['BAS;Månadslön;Ålder;Kön;AID;Annan ansvarskod\nC;30000;40;Kvinna;207011;C'], 'p.csv', { type: 'text/csv' }));
        await new Promise(r => setTimeout(r, 300));
        expect(w.document.getElementById('data-status').textContent).toMatch(/Fel vid CSV-parsning/);
        expect(w.__state.data.length).toBe(antal);
        expect(JSON.stringify(w.__state.ansvarKolumn)).toBe(fore);
    });
    it('enstaka ogiltiga ansvarskoder redovisas i inläsningsraden', async () => {
        const w = createAppWindow();
        await vendorPapa(w);
        const rader = ['BAS;Månadslön;Ålder;Kön;AID;Ansvarskod'];
        for (let i = 0; i < 40; i++) rader.push(`C;${30000 + i * 10};${30 + (i % 20)};${i % 2 ? 'Man' : 'Kvinna'};207011;${i === 7 ? 'X9' : (i % 2 ? 'C' : 'F')}`);
        w.loadStructureFile(new w.File([rader.join('\n')], 'p.csv', { type: 'text/csv' }));
        for (let i = 0; i < 100 && !w.__state.data.length; i++) await new Promise(r => setTimeout(r, 20));
        expect(w.__state.ansvarKolumn).toMatchObject({ namn: 'Ansvarskod' });
        expect(w.document.getElementById('data-status').textContent).toMatch(/1 ogiltigt värde räknades som inget särskilt ansvar/);
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

describe('SKR:s kvinnoandel som referensvärde bredvid organisationens egen fördelning', () => {
    const w = createAppWindow();
    w.__loadDemoData();
    const rubriker = id => [...w.document.querySelectorAll(`#${id} thead th`)].map(th => th.textContent.trim());
    const kol = (id, namn) => rubriker(id).indexOf(namn);
    it('Lika arbete: kolumnen "Kvinnor nationellt" per yrke, och underraderna följer kolumnantalet', async () => {
        const { skrKvinnoandel } = await import('../src/lib/skrreferens.js');
        w.__renderTabContent('matrix');
        const i = kol('matrix-table', 'Kvinnor nationellt');
        expect(i).toBeGreaterThan(-1);
        const tr = [...w.document.querySelectorAll('#matrix-table tbody tr')].find(t => /^207011/.test(t.children[0].textContent.trim()));
        expect(tr.children[i].textContent.trim()).toBe(`${skrKvinnoandel('207011', { del: 'kommun' }).pct.toFixed(0)} %`);   // demot är en kommun
        const antal = rubriker('matrix-table').length;
        for (const u of w.document.querySelectorAll('#matrix-table tr.la-underrad')) {
            const bredd = [...u.children].reduce((s, td) => s + (+td.getAttribute('colspan') || 1), 0);
            expect(bredd).toBe(antal);
        }
    });
    it('sektorsöversikten: kolumnen "Kvinnor nationellt" per sektor', async () => {
        const { skrKvinnoandelSektor } = await import('../src/lib/skrreferens.js');
        w.__renderTabContent('struktur');
        const i = kol('sektor-table', 'Kvinnor nationellt');
        expect(i).toBeGreaterThan(-1);
        const tr = [...w.document.querySelectorAll('#sektor-table tbody tr')].find(t => /Teknikarbete/.test(t.textContent));
        expect(tr.children[i].textContent.trim()).toBe(`${skrKvinnoandelSektor('Teknikarbete', { del: 'kommun' }).pct.toFixed(1).replace('.', ',')} %`);
    });
    it('Likvärdigt arbete: organisationens yrkeslistor har "% kvinnor, SKR"', () => {
        w.__renderTabContent('likvardighet');
        const th = [...w.document.querySelectorAll('#likvardighet-content thead th')].map(t => t.textContent.trim());
        expect(th.filter(t => t === '% kvinnor, SKR').length).toBeGreaterThanOrEqual(1);
    });
    it('gruppdossiern visar SKR:s kvinnoandel för AID-etiketten', () => {
        const key = w.__gruppdossierCandidates().find(c => c.aid === '207011').key;
        const d = w.__buildGruppdossier(key);
        expect(d.skr).toMatchObject({ niva: 'etikett' });
        expect(w.eval(`_gdRenderBody(__buildGruppdossier(${JSON.stringify(key)}))`)).toMatch(/nationellt: \d+ % kvinnor i kommuner</);
        expect(w.__gruppdossierAsText(d)).toMatch(/Nationell referens: \d+ % kvinnor/);
    });
    it('Om verktyget anger SKR:s personalstatistik som källa', () => {
        w.document.querySelector('.nav-item[data-tab="info"]').click();
        w.eval("renderInfoTab('references')");
        expect(w.document.getElementById('view-info').textContent).toMatch(/SKR, personalstatistik november 2025/);
    });
});

describe('organisationstyp: kommun eller region styr SKR-referensen (ADR-34)', () => {
    const skr = async () => (await import('../src/lib/skrreferens.js'));
    const matrisCell = w => {
        w.__renderTabContent('matrix');
        const i = [...w.document.querySelectorAll('#matrix-table thead th')].map(t => t.textContent.trim()).indexOf('Kvinnor nationellt');
        const tr = [...w.document.querySelectorAll('#matrix-table tbody tr')].find(t => /^207011/.test(t.children[0].textContent.trim()));
        return tr.children[i].textContent.trim();
    };
    it('valet finns i organisationspaketets panel; demot är en kommun', async () => {
        const { skrKvinnoandel } = await skr();
        const w = createAppWindow();
        const sel = w.document.getElementById('org-typ');
        expect([...sel.options].map(o => o.value)).toEqual(['alla', 'kommun', 'region']);
        expect(sel.value).toBe('alla');
        w.__loadDemoData();
        expect(sel.value).toBe('kommun');
        expect(matrisCell(w)).toBe(`${skrKvinnoandel('207011', { del: 'kommun' }).pct.toFixed(0)} %`);
    });
    it('byte till region ritar om med regionernas andel och rätt text', async () => {
        const { skrKvinnoandel } = await skr();
        const w = createAppWindow();
        w.__loadDemoData();
        const sel = w.document.getElementById('org-typ');
        sel.value = 'region';
        sel.dispatchEvent(new w.Event('change'));
        expect(w.__state.profile.orgTyp).toBe('region');
        expect(matrisCell(w)).toBe(`${skrKvinnoandel('207011', { del: 'region' }).pct.toFixed(0)} %`);
        const key = w.__gruppdossierCandidates().find(c => c.aid === '207011').key;
        expect(w.__gruppdossierAsText(w.__buildGruppdossier(key))).toMatch(/Nationell referens: \d+ % kvinnor i regioner/);
    });
    it('konfigurationsfilen bär organisationstypen', () => {
        const w = createAppWindow();
        w.__loadDemoData();
        const cfg = w.__buildConfigSnapshot();
        expect(cfg.ui.orgTyp).toBe('kommun');
        const w2 = createAppWindow();
        w2.__applyConfigSnapshot({ ...cfg, ui: { ...cfg.ui, orgTyp: 'region' } });
        expect(w2.__state.profile.orgTyp).toBe('region');
        expect(w2.document.getElementById('org-typ').value).toBe('region');
        w2.__applyConfigSnapshot({ ...cfg, ui: { ...cfg.ui, orgTyp: 'stat' } });
        expect(w2.__state.profile.orgTyp).toBe('region');   // okänt värde ignoreras
    });
    it('Rensa all data återställer till båda', () => {
        const w = createAppWindow();
        w.__loadDemoData();
        w.eval('_rensaAllData()');
        expect(w.document.getElementById('org-typ').value).toBe('alla');
    });
});

describe('samlad jämförelseexport: ställningstagandet per AID och BAS som i tabellen', () => {
    it('en AID-specifik rad i ställningstagandet används i exporten', async () => {
        const { readFileSync } = await import('node:fs');
        const { join, dirname } = await import('node:path');
        const { fileURLToPath } = await import('node:url');
        const w = createAppWindow();
        w.eval(readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'vendor', 'xlsx.mini.min.js'), 'utf8'));
        w.__state.data = Array.from({ length: 12 }, (_, i) => ({ aid: '207011', yrke: '207011 Usk', yrkeLabel: 'Usk', bas: 'C', kon: i % 2 ? 'man' : 'kvinna', lon: 30000 + i * 100, alder: 40 }));
        w.__state.policy = [{ aid: null, bas: 'C', p10: 28000, med: 31000, p90: 35000 }, { aid: '207011', bas: 'C', p10: 29000, med: 32222, p90: 36000 }];
        w.eval('populateSelects(); unlockTabs();');
        const fangat = {};
        w.XLSX.writeFile = (wb, namn) => { fangat[namn] = wb; };
        w.eval('exportBenchmarkExcel()');
        const wb = Object.values(fangat)[0];
        const rad = w.XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: true })[2];
        expect(rad[19]).toBe(32222);   // ställningstagandets median
    });
});

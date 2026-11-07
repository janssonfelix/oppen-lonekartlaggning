// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
/**
 * BAS-dossiern (81-basdossier.js): ett BAS-intervall på en sida, i rapportens ordning — nyckeltal och läget mot
 * ställningstagandet, yrkesgrupperna, likvärdigt arbete, ålder, förra året och en textversion. Vaktar kandidaterna
 * (intervall med minst k personer), modellen för BAS C i demodatan, ingångarna (Löneöversikten, Lönestrukturs tabell
 * per BAS-intervall, gruppdossiern och sökrutan), tillgängligheten (dialog, Escape, fokus tillbaka) och att texten,
 * som lämnar verktyget, byggs i exportläget utan lönemått för grupper under k.
 */
import { describe, it, expect, vi } from 'vitest';
import { createAppWindow } from './helpers/app-harness.js';
import { fonster, normalisera } from './helpers/ktroskel-rigg.js';

vi.setConfig({ testTimeout: 60000 });

const demo = () => { const w = createAppWindow(); w.__loadDemoData(); return w; };
const modal = w => w.document.getElementById('basdossier-modal');
const oppen = w => modal(w).style.display === 'flex';
const skriv = (w, t) => { const f = w.document.getElementById('sok-grupp'); f.value = t; f.dispatchEvent(new w.Event('input', { bubbles: true })); };
const tangent = (w, el, key) => el.dispatchEvent(new w.KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));

describe('BAS-dossiern: kandidater och modell', () => {
    it('kandidaterna är BAS-intervallen med minst k personer, i intervallens ordning; i exportläget med k = 25 faller BAS E (23 personer)', () => {
        const w = demo();
        const k = w.eval('basdossierKandidater()');
        expect(k.map(x => x.bas)).toEqual(['A', 'B', 'C', 'D', 'E']);
        expect(k.find(x => x.bas === 'C').n).toBe(105);
        w.eval('sattKTroskel(25, { fraga: false })');
        expect(w.eval('medExportLage(() => basdossierKandidater())').map(x => x.bas)).toEqual(['A', 'B', 'C', 'D']);
        expect(w.eval("medExportLage(() => buildBasdossier('E'))")).toBeNull();
    });

    it('modellen för BAS C: antal, läget mot ställningstagandet, yrkesgrupperna, kandidatparen och åldersgrupperna', () => {
        const w = demo();
        const d = w.eval("buildBasdossier('C')");
        const data = w.eval("getData().filter(r => r.bas === 'C')");
        expect(d).toMatchObject({ bas: 'C', n: 105 });
        expect(d.nKv + d.nMa).toBe(105);
        expect(d.nKv).toBe(data.filter(r => r.kon.includes('kvinna')).length);
        expect(d.median).toBeGreaterThan(0);
        expect(d.p10).toBeLessThan(d.median); expect(d.p90).toBeGreaterThan(d.median);
        // 1. Läget mot ställningstagandet: referensens rad för BAS C.
        expect(d.referens).toMatchObject({ p10: 36900, med: 41000, p90: 45900 });
        expect(d.referens.diffPct.med).toBeCloseTo((d.median / 41000 - 1) * 100, 6);
        // 2. Yrkesgrupperna: samma fyra som i datan, med Lika arbetes status och nyckeln till gruppdossiern.
        expect(d.yrken.map(y => y.yrke).sort()).toEqual(['207011 Undersköterska', '403010 Barnskötare', '502010 Systemutvecklare', '503012 Drifttekniker']);
        expect(d.yrken.reduce((s, y) => s + y.tot, 0)).toBe(105);
        for (const y of d.yrken) {
            expect(['granska', 'folj', 'balanserat', 'liten']).toContain(y.status);
            expect(y.dossierKey).toBe(`${y.aid}|C`);
            if (y.status !== 'liten') expect(y.kvotPct).toBeCloseTo(y.medKv / y.medMa * 100, 6);
        }
        // Samma status som Lika arbetes yrkesgruppstabell för yrken som bara finns i BAS C.
        w.__renderTabContent('matrix');
        const euRader = [...w.document.querySelectorAll('#matrix-table tbody tr')].map(tr => tr._euRow).filter(Boolean);
        for (const y of d.yrken.filter(x => x.status !== 'liten')) {
            const r = euRader.find(x => x.yrke === y.yrke);
            expect({ granska: 'granska', folj: 'folj', balanserat: 'balanserat' }[y.status]).toBe(r.niva);
        }
        // 3. Kandidatparen där det kvinnodominerade yrket ligger i BAS C (demodatan har två, inga hierarkiska).
        const lv = w.eval('likvardighetResultat()');
        expect(d.par.kandidat.length).toBe(lv.pairs.filter(p => p.kvBas === 'C').length);
        expect(d.par.kandidat.length).toBe(2);
        expect(d.par.hierarkiska).toEqual([]);
        // 4. Åldersgrupperna –34, 35–49 och 50–, med alla i intervallet som har en ålder.
        expect(d.alder.map(a => a.namn)).toEqual(['–34', '35–49', '50–']);
        expect(d.alder.reduce((s, a) => s + a.n, 0)).toBe(data.filter(r => r.alder > 0).length);
        for (const a of d.alder) expect(a.nKv + a.nMa).toBe(a.n);
        // 5. Förra året: inget bokslut inläst.
        expect(d.forra).toMatchObject({ lage: 'ingetBokslut' });
    });

    it('könsuppdelade mått bara där båda könen når k: i exportläget med k = 25 får ett yrke med 18 kvinnor och 2 män ingen könsmedian', () => {
        const w = demo();
        w.eval('sattKTroskel(25, { fraga: false })');
        const d = w.eval("medExportLage(() => buildBasdossier('C'))");
        for (const y of d.yrken) {
            if (y.nKv < 25 || y.nMa < 25) { expect(y.medKv).toBeNull(); expect(y.medMa).toBeNull(); expect(y.kvotPct).toBeNull(); }
        }
        for (const a of d.alder) if (a.nKv < 25 || a.nMa < 25) { expect(a.medKv).toBeNull(); expect(a.medMa).toBeNull(); }
        // Ett yrke under k står inte bland yrkesgrupperna i exportläget; det räknas upp bland de utelämnade.
        expect(d.yrken.every(y => y.tot >= 25)).toBe(true);
        expect(d.yrken.length + d.yrkenUtelamnade.length).toBeGreaterThanOrEqual(4);
    });
});

describe('BAS-dossiern: dialogen och ingångarna', () => {
    it('öppnas från Löneöversiktens BAS-rad: dialog med rubrik och väljare, raden fälls inte, Escape stänger och fokus går tillbaka', () => {
        const w = demo(), doc = w.document;
        w.__renderTabContent('utforska');
        const rubrikrad = [...doc.querySelectorAll('#rapport-table tbody tr.group-header')].find(tr => tr.dataset.bas === 'C');
        const knapp = rubrikrad.querySelector('[data-open-basdossier="C"]');
        expect(knapp).not.toBeNull();
        expect(knapp.getAttribute('aria-label')).toMatch(/BAS-dossier.*BAS C/);
        const hopfalld = rubrikrad.classList.contains('collapsed');
        knapp.focus();
        knapp.click();
        expect(oppen(w)).toBe(true);
        expect(rubrikrad.classList.contains('collapsed')).toBe(hopfalld);   // knappen fäller inte raden
        const m = modal(w);
        expect(m.getAttribute('role')).toBe('dialog');
        expect(m.getAttribute('aria-modal')).toBe('true');
        expect(doc.getElementById(m.getAttribute('aria-labelledby')).textContent).toMatch(/BAS-dossier/);
        expect(doc.getElementById('basdossier-select').value).toBe('C');
        expect([...doc.querySelectorAll('#basdossier-select option')].map(o => o.value)).toEqual(['A', 'B', 'C', 'D', 'E']);
        const body = doc.getElementById('basdossier-body');
        expect(body.textContent).toContain('BAS-intervall C');
        for (const rubrik of ['Nyckeltal', 'Yrkesgrupperna i intervallet', 'Likvärdigt arbete i intervallet', 'Ålder', 'Förra året']) expect(body.textContent).toContain(rubrik);
        expect(body.querySelectorAll('[data-bd-gruppdossier]').length).toBe(4);
        // Byte i väljaren ritar om.
        const sel = doc.getElementById('basdossier-select'); sel.value = 'D'; sel.dispatchEvent(new w.Event('change', { bubbles: true }));
        expect(body.textContent).toContain('BAS-intervall D');
        tangent(w, doc.body, 'Escape');
        expect(oppen(w)).toBe(false);
        expect(doc.activeElement).toBe(knapp);
    });

    it('öppnas från Lönestrukturs tabell per BAS-intervall och från gruppdossiern (Hela BAS), och leder vidare till gruppdossiern', () => {
        const w = demo(), doc = w.document;
        w.__renderTabContent('struktur');
        const knapp = doc.querySelector('#la-oversikt [data-open-basdossier="C"]');
        expect(knapp).not.toBeNull();
        knapp.click();
        expect(oppen(w)).toBe(true);
        // Vidare till en yrkesgrupps dossier: BAS-dossiern stängs, gruppdossiern öppnas.
        const till = doc.querySelector('#basdossier-body [data-bd-gruppdossier]');
        const nyckel = till.getAttribute('data-bd-gruppdossier');
        till.click();
        expect(oppen(w)).toBe(false);
        expect(doc.getElementById('dossier-modal').style.display).toBe('flex');
        expect(doc.getElementById('dossier-select').value).toBe(nyckel);
        // Och tillbaka: gruppdossierns nyckeltal har knappen Hela BAS C.
        const hela = doc.querySelector('#dossier-body [data-open-basdossier]');
        expect(hela.textContent).toMatch(/Hela BAS C/);
        hela.click();
        expect(doc.getElementById('dossier-modal').style.display).toBe('none');
        expect(oppen(w)).toBe(true);
        expect(doc.getElementById('basdossier-select').value).toBe('C');
        w.eval('closeBasdossier()');
    });

    it('öppnas från sökrutan: en BAS-träff har raden Öppna BAS-dossiern under sig, och tangentbordet når den', () => {
        const w = demo(), doc = w.document, falt = doc.getElementById('sok-grupp'), lista = doc.getElementById('sok-grupp-lista');
        falt.focus();
        skriv(w, 'bas c');
        const alternativ = [...lista.querySelectorAll('[role="option"]')];
        const i = alternativ.findIndex(li => li.querySelector('.sok-namn').textContent === 'BAS C');
        expect(i).toBeGreaterThan(-1);
        expect(alternativ[i + 1].querySelector('.sok-namn').textContent).toBe('Öppna BAS-dossiern för BAS C');
        expect(alternativ[i + 1].getAttribute('data-sok-basdossier')).toBe('C');
        // Pil ned till raden och Retur.
        for (let j = 0; j < i + 1; j++) tangent(w, falt, 'ArrowDown');
        expect(falt.getAttribute('aria-activedescendant')).toBe(alternativ[i + 1].id);
        tangent(w, falt, 'Enter');
        expect(oppen(w)).toBe(true);
        expect(doc.getElementById('basdossier-select').value).toBe('C');
        expect(lista.hidden).toBe(true);
        expect(w.eval('diagramMarkering()')).toBeNull();   // raden öppnar dossiern, den markerar inte
        tangent(w, doc.body, 'Escape');
        expect(oppen(w)).toBe(false);
        expect(doc.activeElement).toBe(falt);
        // Ett klick på BAS-träffen markerar som förut.
        skriv(w, 'bas c');
        lista.querySelector('[role="option"]').click();
        expect(w.eval('diagramMarkering()')).toEqual(['bas:C']);
        // Raden om markeringen har också vägen dit.
        doc.querySelector('#markering-rad [data-markering="basdossier"]').click();
        expect(oppen(w)).toBe(true);
        expect(doc.getElementById('basdossier-select').value).toBe('C');
    });

    it('sökregistret har posten BAS-dossier med synonymer; den öppnar dialogen för första intervallet, och kräver lönefil utan data', () => {
        const w = createAppWindow(), doc = w.document;
        const post = w.eval('SOK_FUNKTIONER').find(p => p.namn === 'BAS-dossier');
        expect(post).toMatchObject({ dialog: 'basdossier' });
        for (const s of ['intervall', 'bas-intervall', 'dossier', 'per intervall']) expect(post.synonymer).toContain(s);
        skriv(w, 'per intervall');
        const li = [...doc.querySelectorAll('#sok-grupp-lista [data-sok-funktion]')].find(x => x.querySelector('.sok-namn').textContent === 'BAS-dossier');
        expect(li.querySelector('.sok-under').textContent).toMatch(/kräver lönefil/);
        w.__loadDemoData();
        skriv(w, 'bas-intervall dossier');
        const li2 = [...doc.querySelectorAll('#sok-grupp-lista [data-sok-funktion]')].find(x => x.querySelector('.sok-namn').textContent === 'BAS-dossier');
        expect(li2.querySelector('.sok-under').textContent).toBe('Öppnar BAS-dossiern');
        li2.click();
        expect(oppen(w)).toBe(true);
        expect(doc.getElementById('basdossier-select').value).toBe('A');
    });

    it('länken under Ålder öppnar Ålder & karriär med intervallet valt', () => {
        const w = demo(), doc = w.document;
        w.eval("openBasdossier('D')");
        doc.querySelector('#basdossier-body [data-bd-alder]').click();
        expect(oppen(w)).toBe(false);
        expect(doc.querySelector('.nav-item.active').dataset.tab).toBe('kon');
        expect(doc.getElementById('bas-select-kon').value).toBe('D');
    });
});

describe('BAS-dossiern: förra året och textversionen', () => {
    const medBokslut = (andra) => {
        const a = demo();
        const cfg = JSON.parse(JSON.stringify(a.__buildConfigSnapshot()));
        cfg.arsbokslut.ar -= 1; cfg.arsbokslut.skapat = `${cfg.arsbokslut.ar}-11-01`;
        andra(cfg.arsbokslut);
        const w = demo(); w.__cfg = cfg; w.eval('applyConfigSnapshot(window.__cfg)');
        return { w, cfg };
    };

    it('förra året visas när ett bokslut med raden finns; utan fältet eller utan bokslut säger dossiern det', () => {
        const { w, cfg } = medBokslut(ab => ab.basIntervall.forEach(r => { r.med -= 800; }));
        const d = w.eval("buildBasdossier('C')");
        expect(d.forra).toMatchObject({ lage: 'ok', ar: cfg.arsbokslut.ar });
        expect(d.forra.rad.med.diff).toBeCloseTo(800, 6);
        w.eval("openBasdossier('C')");
        const text = w.document.getElementById('basdossier-body').textContent;
        expect(text).toMatch(new RegExp(`Förra året.*${cfg.arsbokslut.ar}`, 's'));
        expect(text).toContain('+800 kr');
        w.eval('closeBasdossier()');
        const { w: w2 } = medBokslut(ab => { delete ab.basIntervall; });
        expect(w2.eval("buildBasdossier('C')").forra.lage).toBe('saknasFalt');
        w2.eval("openBasdossier('C')");
        expect(w2.document.getElementById('basdossier-body').textContent).toMatch(/äldre version/);
        const w3 = demo();
        w3.eval("openBasdossier('C')");
        expect(w3.document.getElementById('basdossier-body').textContent).toMatch(/konfigurationsfil/i);
    });

    it('textversionen har rapportens form, byggs i exportläget och följer med Kopiera', async () => {
        const w = demo();
        const text = w.eval("basdossierText('C')");
        expect(text.split('\n')[0]).toBe('BAS-intervall C');
        for (const rubrik of ['Nyckeltal', 'Yrkesgrupperna i intervallet', 'Likvärdigt arbete i intervallet', 'Ålder', 'Förra året']) expect(text).toContain(`\n${rubrik}\n`);
        expect(text).toMatch(/105 personer/);
        expect(text).toContain('Barnskötare');
        expect(w.__state.kLage).toBe('skarm');
        const texter = [];
        w.navigator.clipboard = { writeText: t => { texter.push(t); return Promise.resolve(); } };
        w.eval("openBasdossier('C')");
        w.document.getElementById('btn-basdossier-copy').click();
        await new Promise(r => setTimeout(r, 0));
        expect(texter).toEqual([text]);
    });

    it('texten innehåller inga lönemått för en grupp under k; skärmen visar gruppen, som övriga flikar', () => {
        // Ett yrke med sex personer och en unik lön i ett stort BAS-intervall: på skärmen syns det, i texten inte.
        const w = fonster(null);
        const SENT = 41573;
        for (let i = 0; i < 6; i++) w.__state.data.push({ bas: 'S1', kon: i % 2 ? 'man' : 'kvinna', lon: SENT, alder: 30 + i * 5, yrke: '5999 Litet yrke', aid: '5999', yrkeLabel: 'Litet yrke', enhet: '' });
        w.eval('invalidateStatCaches(); populateSelects();');
        const skarm = w.eval("buildBasdossier('S1')");
        expect(skarm.yrken.some(y => y.aid === '5999')).toBe(true);
        const text = normalisera(w.eval("basdossierText('S1')"));
        expect(text).not.toContain(String(SENT));
        expect(text).not.toMatch(/Litet yrke:/);
        expect(text).toMatch(/Litet yrke/);   // namnet står bland de utelämnade, utan lönemått
        expect(w.__state.kLage).toBe('skarm');
        // Ett intervall under k ger ingen text alls.
        expect(w.eval("basdossierText('E')")).toBeNull();
    });
});

describe('BAS-dossiern: status som i Lika arbete, och sökrutans rad', () => {
    it('ett yrke som finns i två BAS-intervall får Lika arbetes status för hela yrket, med en not om det', () => {
        const w = demo();
        // Flytta undersköterskorna med lön under 37 000 kr från BAS C till BAS D: yrket finns då i två
        // intervall, och räknat på C:s rader blir statusen Balanserat medan Lika arbete säger Följ upp för hela yrket.
        w.eval(`(() => { for (const r of state.data) if (r.aid === '207011' && r.bas === 'C' && r.lon < 37000) r.bas = 'D'; invalidateStatCaches(); populateSelects(); })()`);
        const hela = w.eval("_ruLikaArbeteGrupper(getData(), { k: kTroskel(), troskel: 5 }).grupper.find(g => g.yrke === '207011 Undersköterska')");
        const helaStatus = hela.samladMedian ? 'liten' : hela.flaggad ? 'granska' : hela.gapPct > 3 ? 'folj' : 'balanserat';
        const lokal = w.eval("_ruLikaArbeteGrupper(getData().filter(r => r.bas === 'C'), { k: kTroskel(), troskel: 5 }).grupper.find(g => g.yrke === '207011 Undersköterska')");
        const d = w.eval("buildBasdossier('C')");
        const y = d.yrken.find(x => x.yrke === '207011 Undersköterska');
        expect(y.status).toBe(helaStatus);
        expect(w.eval('_bdStatus')(lokal)).not.toBe(helaStatus);   // räknat på intervallets rader hade statusen blivit en annan
        expect(y.tot).toBe(lokal.tot);                       // antal och medianer är intervallets
        expect(y.medKv).toBe(lokal.medKv);
        expect(y.helaTot).toBe(hela.tot);
        expect(y.ocksaI).toEqual(['D']);
        // Samma status som yrkesgruppstabellen i Lika arbete.
        w.__renderTabContent('matrix');
        const eu = [...w.document.querySelectorAll('#matrix-table tbody tr')].map(tr => tr._euRow).find(r => r && r.yrke === '207011 Undersköterska');
        expect({ granska: 'granska', folj: 'folj', balanserat: 'balanserat' }[y.status]).toBe(eu.niva);
        w.eval("openBasdossier('C')");
        expect(w.document.getElementById('basdossier-body').textContent).toContain(`Status gäller hela yrket (${hela.tot} personer), som i Lika arbete; yrket finns också i BAS D`);
        w.eval('closeBasdossier()');
        // Texten (exportläget, k = 10): gruppens samlade median och noten (Lika arbetes status i exportläget är
        // "för liten", eftersom yrket har tre män).
        expect(w.eval("basdossierText('C')")).toMatch(/Undersköterska.*Status gäller hela yrket \(20 personer\), som i Lika arbete; yrket finns också i BAS D/);
    });
    it('sökrutans rad finns bara för intervall som går att öppna, och ett intervall som fallit bort sägs', () => {
        const w = demo();
        w.eval('sattKTroskel(25, { fraga: false })');
        // På skärmen är alla intervall valbara; i exportläget (förhandsvisningen) bara de som når 25.
        w.__state.kLage = 'export';
        skriv(w, 'bas e');
        expect(w.document.querySelector('#sok-grupp-lista [data-sok-basdossier="E"]')).toBeNull();
        const meddelanden = [];
        w.eval('window.announceToScreenReader = undefined');
        w.__ann = m => meddelanden.push(m);
        w.eval('const _org = announceToScreenReader; announceToScreenReader = m => { window.__ann(m); }');
        w.eval("openBasdossier('E')");
        expect(w.document.getElementById('basdossier-select').value).toBe('A');
        expect(meddelanden.join(' ')).toMatch(/BAS E.*visas inte.*BAS A/);
        w.eval('closeBasdossier()');
        w.__state.kLage = 'skarm';
    });
});

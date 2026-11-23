// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
/**
 * BAS-dossiern (81-basdossier.js): ett BAS-intervall på en sida, i rapportens ordning — nyckeltal och läget mot
 * ställningstagandet, yrkesgrupperna, likvärdigt arbete, ålder, förra året och en textversion. Kandidaterna och
 * modellen (tal och maskering vid k) prövas i Node mot vymodellen ([B5.10] och [I9] i tests/vymodeller.test.js);
 * här vaktas ingångarna (Löneöversikten, Lönestrukturs tabell
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

describe('BAS-dossiern: dialogen och ingångarna', () => {
    it('öppnas från Löneöversiktens BAS-rad: dialog med rubrik och väljare, raden fälls inte, Escape stänger och fokus går tillbaka', () => {
        const w = demo(), doc = w.document;
        doc.querySelector('.nav-item[data-tab="utforska"]').click();
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
        for (const rubrik of ['Nyckeltal', 'AID-etiketterna i intervallet', 'Likvärdigt arbete i intervallet', 'Ålder', 'Förra året']) expect(body.textContent).toContain(rubrik);
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
        const cfg = JSON.parse(JSON.stringify(a.__byggKonfiguration()));
        cfg.arsbokslut.ar -= 1; cfg.arsbokslut.skapat = `${cfg.arsbokslut.ar}-11-01`;
        andra(cfg.arsbokslut);
        const w = demo(); w.__cfg = cfg; w.eval('tillampaKonfiguration(window.__cfg)');
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
        expect(text).toContain('+800\u00a0kr');
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
        for (const rubrik of ['Nyckeltal', 'AID-etiketterna i intervallet', 'Likvärdigt arbete i intervallet', 'Ålder', 'Förra året']) expect(text).toContain(`\n${rubrik}\n`);
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

    it('textbyggaren är delad: dossierns text, utkastets stycke och rapportens avsnitt byggs ur samma stycken', () => {
        const { w } = medBokslut(ab => ab.basIntervall.forEach(r => { r.med -= 800; }));
        const stycken = w.eval("medExportLage(() => basdossierStycken(buildBasdossier('C')))");
        expect(stycken.map(s => s.rubrik)).toEqual(['Nyckeltal', 'AID-etiketterna i intervallet', 'Likvärdigt arbete i intervallet', 'Ålder', 'Förra året']);
        expect(stycken.every(s => s.rader.length > 0 && s.rader.every(r => typeof r === 'string' && r.length > 0))).toBe(true);
        // Dossierns text är rubriken och styckena, åtskilda av en tom rad.
        const text = w.eval("basdossierText('C')");
        expect(text).toBe(['BAS-intervall C', '', ...stycken.flatMap((s, i) => [...(i ? [''] : []), s.rubrik, ...s.rader])].join('\n'));
        // Utkastets stycke för intervallet: samma rader, och raden att fylla i sist.
        const utkast = w.eval("medExportLage(() => basintervallUtkastText(buildBasdossier('C')))");
        expect(utkast.startsWith(text)).toBe(true);
        expect(utkast.split('\n').pop()).toMatch(/^\[HR fyller i\] Bedömning: /);
        // Utan bokslut har dossiern raden om hur man får ett; utkastet och rapporten hoppar över punkten.
        const u = demo();
        expect(u.eval("medExportLage(() => basdossierStycken(buildBasdossier('C')))").map(s => s.rubrik)).toContain('Förra året');
        expect(u.eval("medExportLage(() => basdossierStycken(buildBasdossier('C'), { forraBaraMedBokslut: true }))").map(s => s.rubrik)).not.toContain('Förra året');
        // Ett äldre bokslut utan fältet: raden om det står kvar också i utkastet.
        const { w: w2 } = medBokslut(ab => { delete ab.basIntervall; });
        expect(w2.eval("medExportLage(() => basdossierStycken(buildBasdossier('C'), { forraBaraMedBokslut: true }))").map(s => s.rubrik)).toContain('Förra året');
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
    it('ett yrke som finns i två BAS-intervall är två grupper: dossiern läser Lika arbetes grupp i intervallet, med en not om det andra', () => {
        const w = demo();
        // Flytta systemutvecklarna med lön under 37 000 kr från BAS C till BAS D: AID-etiketten finns då i två intervall
        // och är två grupper i Lika arbete (ADR-89). Dossiern för C läser gruppen i C direkt: antal, medianer och status.
        w.eval(`(() => { for (const r of state.data) if (r.aid === '502010' && r.bas === 'C' && r.lon < 37000) r.bas = 'D'; invalidateStatCaches(); populateSelects(); })()`);
        const grupper = w.eval("laLikaGrupper(getData(), kTroskel()).grupper.filter(g => g.aid === '502010')");
        expect(grupper.map(g => g.bas)).toEqual(['C', 'D']);
        const iC = grupper[0];
        const d = w.eval("buildBasdossier('C')");
        const y = d.yrken.find(x => x.yrke === '502010 Systemutvecklare');
        expect(y.status).toBe(iC.samladMedian ? 'liten' : iC.niva);
        expect(y.tot).toBe(iC.tot);
        expect(y.medKv).toBe(iC.medKv);
        expect(y.ocksaI).toEqual(['D']);
        expect(y.helaTot).toBeUndefined();
        // Samma status som raden för intervallet i Lika arbetes tabell.
        w.__renderTabContent('matrix');
        const eu = [...w.document.querySelectorAll('#matrix-table tbody tr')].map(tr => tr._euRow).find(r => r && r.aid === '502010' && r.bas === 'C');
        expect({ granska: 'granska', folj: 'folj', balanserat: 'balanserat', ejbedomd: 'ejbedomd' }[y.status]).toBe(eu.niva);
        w.eval("openBasdossier('C')");
        expect(w.document.getElementById('basdossier-body').textContent).toContain('AID-etiketten finns också i BAS D, som en egen grupp i Lika arbete');
        w.eval('closeBasdossier()');
        expect(w.eval("basdossierText('C')")).toMatch(/Systemutvecklare: \d+ personer.*AID-etiketten finns också i BAS D, som en egen grupp i Lika arbete/);
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

describe('Escape med en öppen dossier', () => {
    it('stänger bara dialogen: diagrammarkeringen står kvar, i gruppdossiern och i BAS-dossiern; nästa Escape tar bort den', () => {
        const w = demo(), doc = w.document;
        w.eval("sattDiagramMarkering('bas:C')");
        w.eval("openGruppdossier(null)");
        expect(doc.getElementById('dossier-modal').style.display).toBe('flex');
        tangent(w, doc.body, 'Escape');
        expect(doc.getElementById('dossier-modal').style.display).not.toBe('flex');
        expect(w.eval('diagramMarkering()')).toEqual(['bas:C']);
        w.eval("openBasdossier('C', null)");
        expect(oppen(w)).toBe(true);
        tangent(w, doc.body, 'Escape');
        expect(oppen(w)).toBe(false);
        expect(w.eval('diagramMarkering()')).toEqual(['bas:C']);
        // Utan öppen dialog tar Escape bort markeringen, som förut.
        tangent(w, doc.body, 'Escape');
        expect(w.eval('diagramMarkering()')).toBeNull();
    });
});

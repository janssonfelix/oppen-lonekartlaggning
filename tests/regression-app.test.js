// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
// Förklaringsmodellen och regressionen i appen: stegen, BAS i bokstäver, MDE per grupp, modellpanelen, att huvudtalet
// och metodbilagan följer modellen, regressionskortet och att regressionen körs en gång per varv.
import { describe, it, expect, beforeAll } from 'vitest';
import { createAppWindow } from './helpers/app-harness.js';
import { laddaXlsx } from './helpers/ktroskel-rigg.js';

let win;

beforeAll(() => {
    win = createAppWindow();
});

describe('steget + Yrkesgrupp: fasta effekter för AID×BAS med inomtransformation (ADR-46)', () => {
    // Två yrken i samma BAS med olika lönenivå: kvinnorna finns mest i det lägre betalda yrket.
    // Inom varje yrke är lönen identisk för kvinnor och män (bara ålder skiljer), så gapet efter
    // yrkesgrupp är noll — medan gapet efter BAS och ålder är klart negativt.
    const underlag = () => {
        const rader = [];
        const lägg = (aid, bas, niva, kon, n) => { for (let i = 0; i < n; i++) { const alder = 28 + ((i * 5) % 30); rader.push({ aid, yrke: 'Yrke ' + aid, bas, kon, alder, lon: Math.round(niva * Math.exp(0.004 * (alder - 40))) }); } };
        lägg('101', 'C', 28000, 'kvinna', 24); lägg('101', 'C', 28000, 'man', 6);
        lägg('102', 'C', 34000, 'kvinna', 6);  lägg('102', 'C', 34000, 'man', 24);
        lägg('201', 'E', 38000, 'kvinna', 15); lägg('201', 'E', 38000, 'man', 15);
        lägg('202', 'E', 44000, 'kvinna', 12); lägg('202', 'E', 44000, 'man', 12);
        lägg('301', 'F', 50000, 'man', 8);   // enkönad grupp: bidrar inte
        return rader;
    };
    const kör = () => { const w = createAppWindow(); w.__state.data = underlag(); return { w, r: w.eval('runOLSRegression()') }; };
    it('kortet visar steget med sin mening och budgeten en del för yrkesgrupp; huvudtalet är steget + Ålder', () => {
        const { w, r } = kör();
        w.eval('ritaRegressionskort()');
        const kort = w.document.getElementById('regression-card');
        const t = kort.textContent.replace(/\s+/g, ' ');
        expect(t).toMatch(/löneskillnaden mellan kvinnor och män med samma AID-etikett, BAS-intervall och ålder/);
        expect(t).toMatch(/Bygger på 114 personer i 4 grupper \(samma AID-etikett i samma BAS-intervall\) där båda könen finns; 1 enkönade grupper bidrar inte/);
        expect(t).toMatch(/Huvudtalet ovan räknar inte bort AID-etiketten/);
        expect(kort.querySelector('.reg-budget-legend').textContent).toMatch(/Förklaras av AID-etikett inom BAS/);
        expect(kort.querySelector('.step-final .step-name').textContent).toMatch(/BAS-intervall och ålder \(full modell\)/);
        expect(kort.querySelector('.step-yrke')).not.toBeNull();
        expect(kort.querySelector('.reg-number, .reg-headline, .step-final .step-value').textContent).toContain(Math.abs(r.konPct).toFixed(2).replace('.', ','));
    });
    it('utan AID och yrke faller steget bort som för få', () => {
        const w = createAppWindow(); w.__state.data = underlag().map(x => ({ ...x, aid: undefined, yrke: undefined }));
        const r = w.eval('runOLSRegression()');
        expect(r.yrkesSteg.status).toBe('too_few');
        expect(w.eval('ritaRegressionskort(); document.getElementById("regression-card").textContent')).not.toMatch(/yrkesgrupp, BAS-intervall och ålder/);
    });
});

describe('BAS-steg räknas i bokstäver överallt (se §3 i regressionsmodellen.md)', () => {
    // Lönen beror bara på bokstaven: +5 % per BAS-intervall. C saknas, så B → D är två intervall.
    // Kvinnorna finns mest i B, männen mest i D. Med rätt numrering förklarar BAS hela skillnaden.
    const PLATS = { A: 1, B: 2, D: 4, E: 5 };
    // brus: ±1 % i ett mönster med medelvärde noll per grupp (alla gruppstorlekar är delbara med 3)
    const underlag = (brus = 0) => {
        const rader = [];
        const lägg = (bas, kon, n) => { for (let i = 0; i < n; i++) rader.push({ bas, kon, alder: 30 + ((i * 7) % 25), lon: Math.round(30000 * Math.exp(0.05 * PLATS[bas] + brus * ((i % 3) - 1))), aid: '100', yrke: '100 Yrke', yrkeLabel: 'Yrke' }); };
        lägg('A', 'kvinna', 12); lägg('A', 'man', 12);
        lägg('B', 'kvinna', 30); lägg('B', 'man', 3);
        lägg('D', 'kvinna', 3);  lägg('D', 'man', 30);
        lägg('E', 'kvinna', 12); lägg('E', 'man', 12);
        return rader;
    };
    const med = (brus = 0) => { const w = createAppWindow(); w.__state.data = underlag(brus); return w; };
    it('kvantilregressionen: bootstrap-KI omsluter punktskattningen, är reproducerbart och visas i tabell och diagram', async () => {
        const a = med(0.01).eval('_regKvantilBerakna({ direkt: true })');
        expect(a.kiB).toBe(200);
        expect(a.kiUtelamnad).toBe('');
        for (const q of a.results) {
            expect(q.ki).toEqual({ lag: expect.any(Number), hog: expect.any(Number) });
            expect(q.ki.lag).toBeLessThanOrEqual(q.konPct);
            expect(q.ki.hog).toBeGreaterThanOrEqual(q.konPct);
            expect(q.ki.hog - q.ki.lag).toBeGreaterThan(0);
        }
        const b = med(0.01).eval('_regKvantilBerakna({ direkt: true })');   // nytt fönster: samma data → samma intervall
        expect(b.results).toEqual(a.results);
        const w = med(0.01);
        w.eval('ritaRegressionskort()');
        // På skärmen räknas intervallet i bakgrunden efter att kortet ritats: först står raden om det, sedan ritas kortet om.
        const tabellFore = [...w.document.querySelectorAll('#regression-card table')].find(t => t.textContent.includes('Klibbigt golv'));
        expect(tabellFore.querySelectorAll('tbody tr')[0].children[2].textContent).toBe('räknas i bakgrunden…');
        expect(w.document.getElementById('regression-card').textContent).toMatch(/räknas i bakgrunden och visas strax/);
        await w.eval('_regKvantilKlar()');
        const tabell = [...w.document.querySelectorAll('#regression-card table')].find(t => t.textContent.includes('Klibbigt golv'));
        expect(tabell.querySelector('thead').textContent).toContain('95 % KI (bootstrap)');
        expect(tabell.querySelectorAll('tbody tr')[0].children[2].textContent).toMatch(/^[+−]\d+,\d\s% till [+−]\d+,\d\s%$/);
        expect(w.document.getElementById('regression-card').textContent).toMatch(/approximation av kvantillösningen/);
        expect(w.document.getElementById('regression-card').textContent).toMatch(/percentil-bootstrap med 200 omsamplingar/);
        const f = w.document.getElementById('chart-reg-kvantil')._figur;
        expect(f.lager[1].data.map(d => d.fel)).toEqual(a.results.map(q => ({ lag: +q.ki.lag.toFixed(2), hog: +q.ki.hog.toFixed(2) })));
        expect(f.x.doman[0]).toBeLessThanOrEqual(Math.min(...a.results.map(q => q.ki.lag)));
        expect(f.x.doman[1]).toBeGreaterThanOrEqual(Math.max(...a.results.map(q => q.ki.hog)));
    });
    it('kvantilregressionen: över 2 000 personer räknas inget KI, och noten säger det', () => {
        const w = createAppWindow();
        w.__state.data = Array.from({ length: 2001 }, (_, i) => ({ bas: 'ABDE'[i % 4], kon: i % 2 ? 'man' : 'kvinna', alder: 25 + (i % 40),
            lon: Math.round(30000 * Math.exp(0.05 * (i % 4) + 0.002 * ((i * 7) % 11) - (i % 2 ? 0 : 0.03))), aid: '100', yrke: '100 Y', yrkeLabel: 'Y' }));
        const r = w.eval('_regKvantilBerakna()');
        expect(r.n).toBe(2001);
        expect(r.kiB).toBe(0);
        expect(r.kiUtelamnad).toMatch(/räknas inte vid fler än 2\u00a0000 personer/);
        expect(r.results.every(q => q.ki === null)).toBe(true);
    });
    // Tolkningen (ADR-63): "väger tyngre än" bara när bootstrap-KI:t för skillnaden P90 − P10 utesluter noll.
    const kvantilKort = lonFn => {
        const w = createAppWindow();
        const rader = [];
        for (let i = 0; i < 240; i++) {
            const kv = i % 2 === 0, u = ((i * 37) % 120) / 119;   // läget i lönefördelningen, samma spridning för båda könen
            rader.push({ bas: 'AB'[i % 3 === 0 ? 1 : 0], kon: kv ? 'kvinna' : 'man', alder: 25 + ((i * 7) % 40),
                lon: Math.round(lonFn(kv, u, i)), aid: '100', yrke: '100 Y', yrkeLabel: 'Y' });
        }
        w.__state.data = rader;
        const r = w.eval('_regKvantilBerakna({ direkt: true })');
        w.eval('ritaRegressionskort()');
        return { r, text: w.document.getElementById('regression-card').textContent };
    };
    it('kvantilregressionen: skillnaden P90 − P10 med KI, och "väger tyngre än" när KI:t utesluter noll', () => {
        // Skillnaden växer från ingen i botten till omkring 15 % i toppen: glastak.
        const { r, text } = kvantilKort((kv, u) => 30000 * Math.exp(0.5 * u - (kv ? 0.16 * u : 0)));
        expect(r.diff.varde).toBeLessThan(-8);
        expect(r.diff.ki.hog).toBeLessThan(0);
        expect(r.diff.varde).toBeCloseTo(r.results[2].konPct - r.results[0].konPct, 10);
        expect(text).toContain('Glastaket väger tyngre än det klibbiga golvet');
        expect(text).not.toContain('Ingen säkerställd skillnad mellan delarna av lönefördelningen');
        expect(text).toMatch(/P90 − P10/);
    });
    it('kvantilregressionen: när KI:t för skillnaden omsluter noll sägs ingen tolkning om golv eller tak', () => {
        // Samma relativa skillnad (5 %) i hela fördelningen, med brus: skillnaden mellan delarna är inte säkerställd.
        const brus = i => (((i * 7919) % 101) / 100 - 0.5) * 0.12;
        const { r, text } = kvantilKort((kv, u, i) => 30000 * Math.exp(0.5 * u - (kv ? 0.05 : 0) + brus(i)));
        expect(r.diff.ki.lag).toBeLessThan(0);
        expect(r.diff.ki.hog).toBeGreaterThan(0);
        expect(text).toContain('Ingen säkerställd skillnad mellan delarna av lönefördelningen.');
        expect(text).not.toMatch(/väger tyngre än/);
    });
    it('regressionskortet visar referensintervallet och en rad per BAS-indikator', () => {
        const w = med();
        w.eval('ritaRegressionskort()');
        const html = w.document.body.innerHTML;
        expect(html).toContain('<code>A</code>, är referens');
        expect(html).toMatch(/<td>D<\/td><td>\+16,2(?:\s|&nbsp;)%/);
    });
});

describe('MDE per grupp: spridningen inom grupp, inte över hela urvalet', () => {
    // Tre BAS-intervall med stora nivåskillnader (25 000, 40 000, 64 000 kr) men liten spridning inom varje
    // yrkesgrupp: den gamla formeln (σ över hela urvalet) rymde BAS-skillnaderna och gav en MDE per grupp
    // som var många gånger för stor.
    const rader = () => {
        const r = [];
        const nivaer = { A: 25000, B: 40000, C: 64000 };
        for (const bas of 'ABC') for (let i = 0; i < 40; i++)
            r.push({ bas, kon: i % 2 ? 'man' : 'kvinna', alder: 30 + (i % 20), lon: Math.round(nivaer[bas] * (1 + ((i % 9) - 4) * 0.005)),
                     yrke: `10${bas} Y${bas}`, aid: `10${bas}`, yrkeLabel: `Y${bas}` });
        return r;
    };
    const sdLog = loner => { const l = loner.map(Math.log), m = l.reduce((a, b) => a + b, 0) / l.length; return Math.sqrt(l.reduce((a, v) => a + (v - m) ** 2, 0) / (l.length - 1)); };
    it('σ är poolad inom grupp och MDE för en grupp med 20 + 20 blir klart mindre än med hela urvalets σ', () => {
        const w = createAppWindow(); const data = rader(); w.__state.data = data;
        const p = w.eval('computePowerAnalysis()');
        expect(p.sigmaKalla).toBe('inomGrupp');
        expect(p.sigmaGrupper).toBe(3);
        expect(p.sigmaHela).toBeCloseTo(sdLog(data.map(d => d.lon)), 6);
        expect(p.sigma).toBeLessThan(p.sigmaHela / 5);
        expect(p.sigma).toBeGreaterThan(0);
        w.eval('state.powerAnalysis = computePowerAnalysis()');
        const ny = w.eval('computeGroupMDE(20, 20)');
        const gammal = w.eval(`computeGroupMDE(20, 20, ${p.sigmaHela})`);
        expect(gammal.mdePct).toBeGreaterThan(25);
        expect(ny.mdePct).toBeLessThan(gammal.mdePct / 5);
        expect(ny.level).toBe('good');
        expect(gammal.level).toBe('poor');
    });
    it('metodtexten i Om verktyget beskriver σ inom grupp och reserven', () => {
        const w = createAppWindow(); w.__state.data = rader();
        w.eval("renderInfoTab('metodik')");
        const t = w.document.getElementById('view-info').textContent;
        expect(t).toMatch(/poolade standardavvikelsen av residualerna log\(lön\) − log\(gruppens median per kön\)/);
        expect(t).toMatch(/används bara som reserv/);
    });
});

describe('förklaringsmodellen i tillstånd och konfigurationsfil (ADR-56)', () => {
    const fonster = () => { const w = createAppWindow(); w.__loadDemoData(); return w; };
    it('sattForklaringsmodell sätter tillståndet, standard lagras som null, och snapshoten bär valet', () => {
        const w = fonster();
        expect(w.__state.forklaringsmodell).toBeNull();
        expect(w.eval('forklaringsmodell()')).toEqual({ bas: true, alder: true, yrkesgrupp: false, skal: '' });
        const r = w.eval('sattForklaringsmodell({ bas: true, alder: false, yrkesgrupp: false, skal: "ingen lön efter ålder" }, { rita: false })');
        expect(r.ok).toBe(true);
        expect(w.__state.forklaringsmodell.alder).toBe(false);
        expect(w.eval('JSON.parse(JSON.stringify(buildConfigSnapshot()))').forklaringsmodell).toEqual({ bas: true, alder: false, yrkesgrupp: false, skal: 'ingen lön efter ålder' });
        w.eval('sattForklaringsmodell({ bas: true, alder: true, yrkesgrupp: false, skal: "" }, { rita: false })');
        expect(w.__state.forklaringsmodell).toBeNull();
        expect(w.eval('JSON.parse(JSON.stringify(buildConfigSnapshot()))').forklaringsmodell).toBeNull();
    });
    it('konfigurationsfilen: ett trasigt värde ger standard med varning, en fil utan fältet ger standard utan varning', () => {
        const w = fonster();
        w.__cfg = { ...w.eval('JSON.parse(JSON.stringify(buildConfigSnapshot()))'), forklaringsmodell: { alder: 'ja', bas: true } };
        const r = w.eval('applyConfigSnapshot(window.__cfg)');
        expect(w.__state.forklaringsmodell).toEqual({ bas: true, alder: false, yrkesgrupp: false, skal: '' });
        expect(r.varningar.length).toBe(0);   // "ja" tvingas till falskt utan varning: fältet är giltigt men avslaget
        w.__cfg = { ...w.eval('JSON.parse(JSON.stringify(buildConfigSnapshot()))'), forklaringsmodell: 'full' };
        const r2 = w.eval('applyConfigSnapshot(window.__cfg)');
        expect(w.__state.forklaringsmodell).toBeNull();
        expect(r2.varningar.join(' ')).toMatch(/[Ff]örklaringsmodellen/);
        const utan = w.eval('JSON.parse(JSON.stringify(buildConfigSnapshot()))'); delete utan.forklaringsmodell;
        w.__state.forklaringsmodell = { bas: false, alder: true, yrkesgrupp: false, skal: '' };
        w.__cfg = utan;
        expect(w.eval('applyConfigSnapshot(window.__cfg)').varningar.length).toBe(0);
        expect(w.__state.forklaringsmodell).toBeNull();
    });
    it('konfigurationsfilen: PO-påslaget, månaderna och prioriteringens värden prövas mot fältens gränser', () => {
        const w = fonster();
        const cfg = w.eval('JSON.parse(JSON.stringify(buildConfigSnapshot()))');
        const las = ändring => () => w.eval('applyConfigSnapshot(' + JSON.stringify({ ...cfg, ...ändring }) + ')');
        expect(las({ kostnad: { poPct: 100, manader: 12 } })).not.toThrow();
        expect(las({ kostnad: { poPct: 150, manader: 12 } })).toThrow('kostnad.poPct måste vara ett tal mellan 0 och 100.');
        expect(las({ kostnad: { poPct: 39.15, manader: 61 } })).toThrow('kostnad.manader måste vara ett tal mellan 1 och 60.');
        expect(las({ prioTrosklar: { ...cfg.prioTrosklar, atgardTroskel: 5 } })).toThrow('prioTrosklar.atgardTroskel måste vara ett tal mellan -50 och 0.');
        expect(las({ prioTrosklar: { ...cfg.prioTrosklar, akutMinstN: 0 } })).toThrow('prioTrosklar.akutMinstN måste vara ett tal mellan 1 och 500.');
        expect(las({ prioVikter: { ...cfg.prioVikter, volym: 101 } })).toThrow('prioVikter.volym måste vara ett tal mellan 0 och 100.');
    });
    it('en konfigurationsfil som läses in före lönefilen behåller yrkesgrupp (valet prövas mot datat när det finns)', () => {
        const w = createAppWindow();
        w.__cfg = { version: 2, forklaringsmodell: { bas: true, alder: true, yrkesgrupp: true, skal: '' } };
        const r = w.eval('applyConfigSnapshot(window.__cfg)');
        expect(r.varningar.length).toBe(0);
        expect(w.__state.forklaringsmodell).toEqual({ bas: true, alder: true, yrkesgrupp: true, skal: '' });
        w.__loadDemoData();
        expect(w.eval('forklaringsmodell()').yrkesgrupp).toBe(true);
    });
    it('Rensa all data nollställer valet; yrkesgrupp utan yrke i datat stängs av med varning', () => {
        const w = fonster();
        w.eval('sattForklaringsmodell({ bas: true, alder: false, yrkesgrupp: false, skal: "" }, { rita: false })');
        w.eval('_rensaAllData()');
        expect(w.__state.forklaringsmodell).toBeNull();
        const w2 = createAppWindow();
        const rad = (kon, lon, i) => ({ bas: ['A', 'B', 'C'][i % 3], kon, lon, alder: 25 + (i % 30) });
        w2.__state.data = Array.from({ length: 120 }, (_, i) => rad(i % 2 ? 'kvinna' : 'man', 30000 + (i % 3) * 2000 + (i % 7) * 100, i));
        const r = w2.eval('sattForklaringsmodell({ bas: true, alder: true, yrkesgrupp: true, skal: "" }, { rita: false })');
        expect(r.modell.yrkesgrupp).toBe(false);
        expect(r.varningar.join(' ')).toMatch(/AID-kod och etikettnamn/);
    });
});

describe('runOLSRegression på vald modell (ADR-56)', () => {
    const kor = modell => { const w = createAppWindow(); w.__loadDemoData(); w.__state.forklaringsmodell = modell; return { w, r: w.eval('runOLSRegression()') }; };
    it('standard: modelDesc som i dag, frasen "ålder och BAS-intervall", inget bortvalt, tillför-tabellen med tre rader', () => {
        const { r } = kor(null);
        expect(r.error).toBeUndefined();
        expect(r.modelDesc).toBe('kön + ålder + BAS-intervall (indikatorer)');
        expect(r.fras).toBe('ålder och BAS-intervall');
        expect(r.bortvalt).toEqual([]);
        expect(r.modell).toEqual({ bas: true, alder: true, yrkesgrupp: false, skal: '' });
        expect(r.tillfor.rader.map(x => x.variabel)).toEqual(['bas', 'alder', 'yrkesgrupp']);
        expect(r.modellVarning).toBeNull();
    });
    it('utan ålder: en kolumn färre, ingen ålderseffekt, ålder bortvald, inget steg + Ålder', () => {
        const std = kor(null).r;
        const { r } = kor({ bas: true, alder: false, yrkesgrupp: false, skal: 'ingen lön efter ålder' });
        expect(r.k).toBe(std.k - 1);
        expect(r.ageEffect).toBeNull();
        expect(r.ageP).toBeNull();
        expect(r.bortvalt).toHaveLength(1);
        expect(r.bortvalt[0]).toMatchObject({ variabel: 'alder', etikett: 'Ålder', skal: 'ingen lön efter ålder' });
        expect(typeof r.bortvalt[0].deltaR2pp).toBe('number');
        expect(r.sequential.map(x => x.name)).not.toContain('+ Ålder');
        expect(r.fras).toBe('BAS-intervall');
        expect(r.konPct).toBeCloseTo(r.sequential.find(x => x.name === '+ BAS-intervall').gapPct, 8);
    });
    it('utan BAS: inga BAS-effekter, frasen "ålder"', () => {
        const { r } = kor({ bas: false, alder: true, yrkesgrupp: false, skal: '' });
        expect(r.basEffekter).toBeNull();
        expect(r.basRef).toBeNull();
        expect(r.fras).toBe('ålder');
        expect(r.modelDesc).toBe('kön + ålder');
        expect(r.bortvalt.map(b => b.variabel)).toEqual(['bas']);
    });
    it('endast kön: huvudtalet är steget Endast kön, frasen är tom', () => {
        const { r } = kor({ bas: false, alder: false, yrkesgrupp: false, skal: '' });
        expect(r.fras).toBe('');
        expect(r.konPct).toBeCloseTo(r.sequential[0].gapPct, 8);
        expect(r.sequential.map(x => x.name)).toEqual(['Endast kön']);
    });
    it('yrkesgrupp vald: huvudtalet är yrkesgruppssteget och ingår i stegen', () => {
        const std = kor(null).r;
        const { r } = kor({ bas: true, alder: true, yrkesgrupp: true, skal: '' });
        expect(r.konPct).toBeCloseTo(std.yrkesSteg.gapPct, 6);
        expect(r.fras).toBe('ålder, BAS-intervall och AID-etikett');
        expect(r.modelDesc).toBe('kön + ålder + BAS-intervall (indikatorer) + AID-etikett inom BAS (fasta effekter)');
        expect(r.sequential.at(-1).name).toBe('+ Yrkesgrupp');
        expect(r.yrkesSteg.status).toBe('ok');
        expect(r.bortvalt).toEqual([]);
    });
    it('singulär vald modell (ett enda BAS) faller tillbaka och säger det', () => {
        const w = createAppWindow();
        // Kvinnorna i BAS A, männen i BAS B: könsindikatorn och BAS-indikatorn är identiska, så kön + BAS är singulär.
        w.__state.data = Array.from({ length: 80 }, (_, i) => ({ bas: i % 2 ? 'A' : 'B', kon: i % 2 ? 'kvinna' : 'man', alder: 25 + (i % 30), lon: 30000 + (i % 9) * 500 }));
        w.__state.forklaringsmodell = { bas: true, alder: false, yrkesgrupp: false, skal: '' };
        const r = w.eval('runOLSRegression()');
        expect(r.error).toBeUndefined();
        expect(r.fellBackFromFull).toBe(true);
        expect(r.modelDesc).toBe('kön');
    });
    it('ett kön under tröskeln: endast kön spärras, modellen blir BAS + ålder med en varning', () => {
        const w = createAppWindow();
        w.__state.data = Array.from({ length: 80 }, (_, i) => ({ bas: ['A', 'B', 'C'][i % 3], kon: i < 7 ? 'man' : 'kvinna', alder: 25 + (i % 30), lon: 30000 + (i % 3) * 2000 + (i % 9) * 100 }));
        w.__state.forklaringsmodell = { bas: false, alder: false, yrkesgrupp: false, skal: '' };
        const r = w.eval('runOLSRegression()');
        expect(r.error).toBeUndefined();
        expect(r.modell).toMatchObject({ bas: true, alder: true });
        expect(r.modellVarning).toMatch(/under tröskeln|färre än/);
    });
});

describe('modellpanelen (ADR-56)', () => {
    const oppna = w => { w.document.querySelector('.nav-item[data-tab="struktur"]').click(); w.eval('renderTabContent("struktur")'); return w.document.getElementById('forklaringsmodell-panel'); };
    const demo = () => { const w = createAppWindow(); w.__loadDemoData(); return w; };
    const andra = (w, el, varde) => { if (typeof varde === 'boolean') el.checked = varde; else el.value = varde; el.dispatchEvent(new w.Event('change', { bubbles: true })); };
    it('panelen ligger före huvudtalet med BAS och ålder ikryssade och en rad per variabel i tabellen', () => {
        const w = demo();
        const p = oppna(w);
        expect(p).not.toBeNull();
        expect(p.compareDocumentPosition(w.document.getElementById('regression-card')) & w.Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
        expect(p.querySelector('input[data-fm="bas"]').checked).toBe(true);
        expect(p.querySelector('input[data-fm="alder"]').checked).toBe(true);
        expect(p.querySelector('input[data-fm="yrkesgrupp"]').checked).toBe(false);
        expect(p.querySelectorAll('table tbody tr').length).toBe(3);
        expect(p.textContent).toMatch(/BAS-intervall/);
        expect(p.textContent).toMatch(/procentenheter/);
        expect(p.querySelector('[data-fm-notering]')).toBeNull();
    });
    it('utan AID och yrke finns ingen kryssruta för yrkesgrupp och tabellen har två rader', () => {
        const w = createAppWindow();
        w.__state.data = Array.from({ length: 120 }, (_, i) => ({ bas: ['A', 'B', 'C'][i % 3], kon: i % 2 ? 'kvinna' : 'man', alder: 25 + (i % 30), lon: 30000 + (i % 3) * 2000 + (i % 7) * 100 }));
        w.eval('populateSelects(); unlockTabs();');
        const p = oppna(w);
        expect(p.querySelector('input[data-fm="yrkesgrupp"]')).toBeNull();
        expect(p.querySelectorAll('table tbody tr').length).toBe(2);
    });
    it('att kryssa ur ålder räknar om kortet och visar noteringen; skälet sparas', () => {
        const w = demo();
        const p = oppna(w);
        andra(w, p.querySelector('input[data-fm="alder"]'), false);
        expect(w.__state.forklaringsmodell.alder).toBe(false);
        const p2 = w.document.getElementById('forklaringsmodell-panel');
        expect(p2.querySelector('[data-fm-notering]').textContent).toMatch(/Ålder har kontrollerats och tillför/);
        expect(w.document.getElementById('regression-card').textContent).toMatch(/nivå/);
        andra(w, p2.querySelector('#fm-skal'), 'organisationen sätter inte lön efter ålder');
        expect(w.__state.forklaringsmodell.skal).toBe('organisationen sätter inte lön efter ålder');
        expect(w.document.getElementById('forklaringsmodell-panel').querySelector('[data-fm-notering]').textContent).toMatch(/Skäl: organisationen sätter inte lön efter ålder/);
    });
    it('ett skäl som ser ut som en personuppgift sparas inte och får en not', () => {
        const w = demo();
        const p = oppna(w);
        andra(w, p.querySelector('input[data-fm="alder"]'), false);
        const p2 = w.document.getElementById('forklaringsmodell-panel');
        andra(w, p2.querySelector('#fm-skal'), 'lönen sätts av 19800101-1234');
        expect(w.__state.forklaringsmodell.skal).toBe('');
        expect(w.document.getElementById('forklaringsmodell-panel').querySelector('.k-mask-note').textContent).toMatch(/personuppgift/);
    });
    it('förslaget: knappen följer förslaget och kryssrutan för yrkesgrupp kräver BAS', () => {
        const w = demo();
        const p = oppna(w);
        const forslag = p.querySelector('[data-fm-forslag]');
        if (forslag) { forslag.click(); expect(w.__state.forklaringsmodell).not.toBeNull(); }
        else expect(p.textContent).toMatch(/Alla variabler tillför/);
        const w2 = demo();
        const q = oppna(w2);
        andra(w2, q.querySelector('input[data-fm="yrkesgrupp"]'), true);
        const q2 = w2.document.getElementById('forklaringsmodell-panel');
        expect(w2.__state.forklaringsmodell.yrkesgrupp).toBe(true);
        expect(q2.querySelector('input[data-fm="bas"]').checked).toBe(true);
        expect(q2.querySelector('input[data-fm="bas"]').disabled).toBe(true);
    });
    it('med ett kön under tröskeln kan inte båda kryssas ur: BAS och ålder är åter ikryssade och varningen visas', () => {
        const w = createAppWindow();
        w.__state.data = Array.from({ length: 80 }, (_, i) => ({ bas: ['A', 'B', 'C'][i % 3], kon: i < 7 ? 'man' : 'kvinna', alder: 25 + (i % 30), lon: 30000 + (i % 3) * 2000 + (i % 9) * 100 }));
        w.eval('populateSelects(); unlockTabs();');
        const p = oppna(w);
        andra(w, p.querySelector('input[data-fm="alder"]'), false);
        andra(w, w.document.getElementById('forklaringsmodell-panel').querySelector('input[data-fm="bas"]'), false);
        const p2 = w.document.getElementById('forklaringsmodell-panel');
        expect(p2.querySelector('input[data-fm="bas"]').checked).toBe(true);
        expect(p2.querySelector('input[data-fm="alder"]').checked).toBe(true);
        expect(p2.querySelector('.k-mask-note').textContent).toMatch(/Endast kön kan inte väljas/);
    });
    it('Rensa all data tömmer panelen', () => {
        const w = demo();
        oppna(w);
        w.eval('_rensaAllData()');
        expect(w.document.getElementById('forklaringsmodell-panel').innerHTML).toBe('');
    });
});

describe('avsnittet följer modellen (ADR-56)', () => {
    const rita = modell => {
        const w = createAppWindow(); w.__loadDemoData(); w.__state.forklaringsmodell = modell;
        w.document.querySelector('.nav-item[data-tab="struktur"]').click(); w.eval('renderTabContent("struktur")');
        const kort = w.document.getElementById('regression-card'), oax = w.document.getElementById('blinder-oaxaca-card');
        const trappa = w.document.getElementById('chart-reg-trappa');
        return { w, kort, oax, kortText: kort.textContent.replace(/\s+/g, ' '), oaxText: oax.textContent.replace(/\s+/g, ' '), figur: trappa ? trappa._figur : null };
    };
    it('utan ålder: inga "ålder och BAS-intervall", inget steg + Ålder, trappan slutar efter BAS, Oaxaca utan ålderraden', () => {
        const { kortText, oaxText, figur, oax } = rita({ bas: true, alder: false, yrkesgrupp: false, skal: '' });
        expect(kortText).not.toMatch(/ålder och BAS-intervall/);
        expect(kortText).not.toMatch(/ålder och BAS/);
        expect(kortText).not.toMatch(/BAS-intervall och ålder \(full modell\)/);
        expect(kortText).toMatch(/Efter kontroll för BAS-intervall/);
        expect(kortText).toMatch(/när BAS-intervall räknats bort/);
        expect(figur).not.toBeNull();
        expect(figur.x.ordning).toEqual(['Ojusterad skillnad', 'BAS-intervall', 'Oförklarad skillnad', 'AID-etikett inom BAS']);
        expect(oaxText).toMatch(/Förklarat av BAS-intervall/);
        expect([...oax.querySelectorAll('tbody td:first-child')].map(td => td.textContent)).not.toContain('Ålder');
        expect(oaxText).toMatch(/Ålder har kontrollerats/);
    });
    it('endast kön: Oaxaca-kortet visas inte och kortet säger att inget räknats bort', () => {
        const { kortText, oax, figur } = rita({ bas: false, alder: false, yrkesgrupp: false, skal: '' });
        expect(oax.innerHTML).toBe('');
        expect(kortText).toMatch(/utan att något räknats bort/);
        expect(figur).toBeNull();
    });
    it('yrkesgrupp vald: ordinarie steg i trappan, och Oaxaca har raden Yrkesgrupp inom BAS i stället för BAS-intervall', () => {
        const { kortText, oax, figur } = rita({ bas: true, alder: true, yrkesgrupp: true, skal: '' });
        expect(figur.x.ordning).toEqual(['Ojusterad skillnad', 'BAS-intervall', 'Ålder', 'AID-etikett inom BAS', 'Oförklarad skillnad']);
        expect(figur.lager.some(l => /ingår inte i huvudtalet/.test(l.serie))).toBe(false);
        expect(kortText).not.toMatch(/ingår inte i huvudtalet/);
        expect(kortText).toMatch(/ålder, BAS-intervall och AID-etikett räknats bort/);
        const rader = [...oax.querySelectorAll('tbody td:first-child')].map(td => td.textContent);
        expect(rader.some(t => /AID-etikett inom BAS/.test(t))).toBe(true);
        expect(rader.some(t => /^BAS-intervall/.test(t))).toBe(false);
    });
    it('standardläget är som förut', () => {
        const { kortText, figur, oaxText } = rita(null);
        expect(kortText).toMatch(/när ålder och BAS-intervall räknats bort/);
        expect(figur.x.ordning).toEqual(['Ojusterad skillnad', 'BAS-intervall', 'Ålder', 'Oförklarad skillnad', 'AID-etikett inom BAS']);
        expect(oaxText).toMatch(/Förklarat av ålder och BAS-intervall/);
    });
});

describe('huvudtalet följer modellen i nyckeltal, Att göra, Struktur och rapporten (ADR-56)', () => {
    const rita = modell => { const w = createAppWindow(); w.__loadDemoData(); w.__state.forklaringsmodell = modell; return w; };
    it('Lika arbetes nyckeltal och Att göra säger "efter BAS-intervall" utan ålder', () => {
        const w = rita({ bas: true, alder: false, yrkesgrupp: false, skal: '' });
        w.document.querySelector('.nav-item[data-tab="matrix"]').click(); w.eval('renderTabContent("matrix"); renderTabContent("struktur")');
        expect(w.document.getElementById('nyckel-ls-regression').textContent).toMatch(/efter BAS-intervall$/);
        expect(w.document.getElementById('la-slutsatser').textContent).toMatch(/Efter BAS-intervall/);
        expect(w.document.getElementById('la-slutsatser').textContent).not.toMatch(/ålder och BAS-intervall/);
        w.eval('renderActionChecklist()');
        expect(w.document.getElementById('action-checklist-container').textContent).toMatch(/\(efter BAS-intervall\)/);
    });
    it('rapportmodellen: raden heter efter BAS-intervall, bilagan saknar ålderseffekten och bär noteringen med skälet', () => {
        const w = rita({ bas: true, alder: false, yrkesgrupp: false, skal: 'ingen lön efter ålder' });
        const m = w.eval('rapportModell()');
        const lika = m.avsnitt.find(a => a.id === 'lika');
        const tab = lika.delar.find(d => d.typ === 'tabell');
        expect(tab.rader.map(r => r[0])).toContain('Löneskillnad som står kvar efter BAS-intervall');
        const text = JSON.stringify(lika.delar);
        expect(text).toMatch(/när BAS-intervall räknats bort/);
        expect(text).not.toMatch(/ålder och BAS-intervall/);
        const reg = m.avsnitt.find(a => a.id === 'regression');
        const regText = JSON.stringify(reg.delar);
        expect(regText).not.toMatch(/Ålderseffekt/);
        expect(regText).toMatch(/Ålder har kontrollerats och tillför [0-9,]+ procentenheter i förklaringsgrad; den ingår inte i siffrorna\. Skäl: ingen lön efter ålder/);
        expect(regText).toMatch(/strukturella variabler \(BAS-intervall\)/);
        expect(regText).not.toMatch(/\+ Ålder/);
    });
    it('rapportunderlaget bär frasen och det bortvalda', () => {
        const w = rita({ bas: false, alder: true, yrkesgrupp: false, skal: '' });
        const text = w.__rapportunderlagBlock().map(b => w.__ruTillText(b)).join('\n');
        expect(text).toMatch(/Efter hänsyn till ålder är den oförklarade löneskillnaden/);
        expect(text).toMatch(/BAS-intervall har kontrollerats/);
    });
    it('standardläget: rapportmodellens rad och texter som förut', () => {
        const w = rita(null);
        const m = w.eval('rapportModell()');
        const lika = m.avsnitt.find(a => a.id === 'lika');
        expect(lika.delar.find(d => d.typ === 'tabell').rader.map(r => r[0])).toContain('Löneskillnad som står kvar efter ålder och BAS-intervall');
        expect(JSON.stringify(m.avsnitt.find(a => a.id === 'regression').delar)).toMatch(/Ålderseffekt/);
    });
});

// Metodbilagan (bladet Metod & parametrar i Excel-exporten) säger den modell huvudtalet räknades med (ADR-56), och om
// steget + Yrkesgrupp ingår i huvudtalet. Raderna läses ur arbetsboken som exporten bygger.
describe('metodbilagan följer förklaringsmodellen (ADR-56)', () => {
    const metodrader = async (modell, { utanAlder = false } = {}) => {
        const w = createAppWindow(); await laddaXlsx(w); w.__loadDemoData();
        if (utanAlder) {
            w.__state.data = w.__state.data.map(r => ({ ...r, alder: 0 }));
            w.eval('invalidateStatCaches(); populateSelects(); unlockTabs();');
        }
        w.__state.forklaringsmodell = modell;
        const blad = w.eval('_excelAlltBok()').Sheets['Metod & parametrar'];
        const rader = w.XLSX.utils.sheet_to_json(blad, { header: 1, raw: true });
        const rad = namn => (rader.find(r => r[0] === namn) || [])[1];
        return { w, modellRad: rad('Modell — oförklarad skillnad'), stegRad: rad('Steg + AID-etikett inom BAS (dekomponeringen)') };
    };
    it('ålder bortvald: modellen saknar ålder, och steget + Yrkesgrupp räknas utan ålder', async () => {
        const { w, modellRad, stegRad } = await metodrader({ bas: true, alder: false, yrkesgrupp: false, skal: '' });
        expect(w.eval('runOLSRegression().modell')).toMatchObject({ bas: true, alder: false, yrkesgrupp: false });
        expect(modellRad).toMatch(/~ kön \+ BAS-intervall/);
        expect(modellRad).not.toMatch(/ålder/);
        expect(stegRad).not.toMatch(/utöver ålder/);
        expect(stegRad).toMatch(/utan ålder/);
        expect(stegRad).toMatch(/ingår inte i huvudtalet/);
    });
    it('BAS bortvalt: modellen saknar BAS, och steget + Yrkesgrupp räknas inte', async () => {
        const { w, modellRad, stegRad } = await metodrader({ bas: false, alder: true, yrkesgrupp: false, skal: '' });
        expect(w.eval('runOLSRegression().yrkesSteg')).toBeNull();
        expect(modellRad).toMatch(/~ kön \+ ålder;/);
        expect(modellRad).not.toMatch(/BAS/);
        expect(stegRad).not.toMatch(/visas som sista steg/);
        expect(stegRad).toMatch(/BAS-intervall.*bortvalt/);
    });
    it('yrkesgrupp vald: modellen har yrkesgrupp inom BAS och inomtransformation, och steget är huvudtalet', async () => {
        const { w, modellRad, stegRad } = await metodrader({ bas: true, alder: true, yrkesgrupp: true, skal: '' });
        expect(w.eval('runOLSRegression().modell.yrkesgrupp')).toBe(true);
        expect(modellRad).toMatch(/AID-etikett inom BAS/);
        expect(modellRad).toMatch(/inomtransformation/);
        expect(stegRad).not.toMatch(/ingår inte i huvudtalet/);
        expect(stegRad).toMatch(/huvudtalet/);
    });
    it('standardmodellen: raderna är som förut', async () => {
        const { modellRad, stegRad } = await metodrader(null);
        expect(modellRad).toBe('OLS på log(månadslön) ~ kön + ålder + BAS-intervall (indikatorvariabler, första BAS som referens); HC3-robusta standardfel (Long & Ervin 2000)');
        expect(stegRad).toBe('Löneskillnad mellan könen med fasta effekter för AID-etikett inom BAS (AID×BAS) utöver ålder, skattat med inomtransformation; visas som sista steg, ingår inte i huvudtalet');
    });
    it('lönefil utan ålder: raderna är som förut (ADR-64)', async () => {
        const { modellRad, stegRad } = await metodrader(null, { utanAlder: true });
        expect(modellRad).toBe('OLS på log(månadslön) ~ kön + BAS-intervall (indikatorer); lönefilen saknar ålder, så analysen körs utan åldersjustering; HC3-robusta standardfel (Long & Ervin 2000)');
        expect(stegRad).toBe('Löneskillnad mellan könen med fasta effekter för AID-etikett inom BAS (AID×BAS), utan ålder (lönefilen saknar ålder), skattat med inomtransformation; visas som sista steg, ingår inte i huvudtalet');
    });
});

// Meningen under steget + Yrkesgrupp (_yrkesStegText) i regressionskortet och rapportens bilaga följer den skattade
// modellen: ålder när modellen har ålder, och huvudtalet räknar bort yrkesgruppen när den är vald (ADR-56).
describe('meningen under steget + Yrkesgrupp följer förklaringsmodellen (ADR-56)', () => {
    const rita = modell => {
        const w = createAppWindow(); w.__loadDemoData(); w.__state.forklaringsmodell = modell;
        w.document.querySelector('.nav-item[data-tab="struktur"]').click(); w.eval('renderTabContent("struktur")');
        const not = w.document.querySelector('#regression-card .step-yrke .step-note, #regression-card .step-note');
        const bilaga = JSON.stringify(w.eval('rapportModell()').avsnitt.find(a => a.id === 'regression').delar);
        return { kortNot: not ? not.textContent.replace(/\s+/g, ' ') : '', bilaga };
    };
    it('ålder bortvald: meningen säger "samma AID-etikett och BAS-intervall", inte "och ålder"', () => {
        const { kortNot, bilaga } = rita({ bas: true, alder: false, yrkesgrupp: false, skal: '' });
        expect(kortNot).toMatch(/samma AID-etikett och BAS-intervall \(fasta effekter/);
        expect(kortNot).not.toMatch(/samma AID-etikett, BAS-intervall/);
        expect(kortNot).not.toMatch(/och ålder/);
        expect(bilaga).toMatch(/Steget \+ AID-etikett inom BAS: [^"]*samma AID-etikett och BAS-intervall \(/);
        expect(bilaga).toMatch(/Huvudtalet ovan räknar inte bort AID-etiketten/);
    });
    it('yrkesgrupp vald: meningen säger inte att huvudtalet låter bli att räkna bort yrkesgruppen', () => {
        const { kortNot, bilaga } = rita({ bas: true, alder: true, yrkesgrupp: true, skal: '' });
        expect(kortNot).toMatch(/samma AID-etikett, BAS-intervall och ålder/);
        expect(kortNot).not.toMatch(/räknar inte bort AID-etiketten/);
        expect(bilaga).toMatch(/Steget \+ AID-etikett inom BAS: /);
        expect(bilaga).not.toMatch(/räknar inte bort AID-etiketten/);
    });
    it('standardmodellen: meningen är som förut', () => {
        const { kortNot, bilaga } = rita(null);
        expect(kortNot).toMatch(/samma AID-etikett, BAS-intervall och ålder \(fasta effekter för AID-etikett inom BAS\)/);
        expect(kortNot).toMatch(/Huvudtalet ovan räknar inte bort AID-etiketten\.$/);
        expect(bilaga).toMatch(/Huvudtalet ovan räknar inte bort AID-etiketten/);
    });
});

describe('regressionskortets tekniska specifikation', () => {
    it('visar antalet observationer med hävstång > 0,99, som anpassaOLS räknar', () => {
        const w = createAppWindow();
        w.__loadDemoData();
        const r = w.eval('runOLSRegression()');
        expect(Number.isInteger(r.hHoga)).toBe(true);
        w.__renderTabContent('struktur');
        const t = w.document.getElementById('regression-card').textContent.replace(/\s+/g, ' ');
        expect(t).toMatch(new RegExp(`Observationer med hävstång > 0,99 \\(bidrar inte till HC3\\) ?${r.hHoga} Antal observationer`));
    });
});

describe('[B3.12] multivariat analys: pedagogik (kronor, budget, per-BAS-diagram)', () => {
    it('regressionskortet renderar kronor, signalkolumn och per-BAS-container', () => {
        win.__loadDemoData();
        expect(() => win.__ritaRegressionskort()).not.toThrow();
        const card = win.document.getElementById('regression-card');
        const r = win.__runOLS();
        if (r.error) return;                       // demodata gav ingen modell — hoppa
        expect(card.querySelector('#chart-perbas-gap')).not.toBeNull();
        expect(card.querySelector('#perbas-table')).not.toBeNull();
        // p/q är dolda som standard (klarspråk först)
        expect(card.querySelector('#perbas-table').classList.contains('hide-stats')).toBe(true);
        expect(card.querySelectorAll('#perbas-table th.col-stat').length).toBe(2);
        // stående reservation mot övertolkning finns intill siffrorna
        expect(card.querySelectorAll('.reg-caveat-inline').length).toBeGreaterThanOrEqual(2);
        expect(card.textContent).toContain('inte att den beror på kön eller är osaklig');
    });
});

// Regressionen cachas aldrig (ADR-17), men inom ett varv körs den en gång och skickas vidare som argument: underlagets
// kvalitet, Att göra och processöversikten läser samma underlag och samma val. På 55 000 rader är en körning ~0,4 s.
describe('regressionen körs en gång per varv vid inläsning och tröskelbyte', () => {
    const raknaRegressioner = w => w.eval('window.__regKorningar = 0; const __regOrig = runOLSRegression; '
        + 'runOLSRegression = function () { window.__regKorningar++; return __regOrig(); };');
    const html = (w, id) => w.document.getElementById(id).innerHTML;
    const DELAR = ['underlagets-kvalitet', 'process-tracker'];
    it('inläsningen (lönefil och demo) kör regressionen en gång och ritar samma sak som en egen körning per del', () => {
        const w = createAppWindow();
        raknaRegressioner(w);
        w.eval('_lasInDemounderlag(genereraDemodata)');   // demots inläsning; diagnostiken efteråt kör en egen
        expect(w.__regKorningar).toBe(1);
        w.__regKorningar = 0;
        w.eval('_afterDataLoaded()');
        expect(w.__regKorningar).toBe(1);
        const delad = DELAR.map(id => html(w, id));
        w.eval('renderUnderlagetsKvalitet(); renderProcessTracker();');
        expect(DELAR.map(id => html(w, id))).toEqual(delad);
    });
    it('omritningen efter ett tröskelbyte kör regressionen en gång och ritar samma sak', () => {
        const w = createAppWindow();
        w.__loadDemoData();
        raknaRegressioner(w);
        w.eval('sattKTroskel(11, { fraga: false })');
        expect(w.__regKorningar).toBe(1);
        const delad = [...DELAR, 'action-checklist-container'].map(id => html(w, id));
        w.eval('renderUnderlagetsKvalitet(); renderProcessTracker({ punkter: renderActionChecklist() });');
        expect([...DELAR, 'action-checklist-container'].map(id => html(w, id))).toEqual(delad);
    });
    // Omritningen i steg släpper fram tidtagare mellan stegen: en fil som läses klart (FileReader) eller en rensning vid
    // inaktivitet kan byta underlaget där, och då får stegen efter inte rita med regressionen från det gamla.
    it('byts underlaget mitt i omritningen räknar stegen efter en egen regression', () => {
        const w = createAppWindow();
        w.__loadDemoData();
        w.eval('sattKTroskel(11, { fraga: false, rita: false })');
        raknaRegressioner(w);
        w.eval('const __ukOrig = renderUnderlagetsKvalitet; renderUnderlagetsKvalitet = function (v) { __ukOrig(v); '
            + 'state.data = state.data.slice(0, 150); };');
        w.eval('_renderaOmAllaFlikar()');
        expect(w.__regKorningar).toBe(3);   // underlagets kvalitet, Att göra och processöversikten var för sig
        const delad = ['action-checklist-container', 'process-tracker'].map(id => html(w, id));
        w.eval('renderProcessTracker({ punkter: renderActionChecklist() });');
        expect(['action-checklist-container', 'process-tracker'].map(id => html(w, id))).toEqual(delad);
    });
    it('en fil som släpps under en pågående omritning i steg når inte filinläsningen', async () => {
        const w = createAppWindow();
        w.__loadDemoData();
        const r = w.eval('sattKTroskel(11, { fraga: false, stegvis: true })');
        const omrade = w.document.getElementById('drop-area-data');
        let last = false;
        for (const typ of ['dragover', 'drop']) {
            const ev = new w.Event(typ, { bubbles: true, cancelable: true });
            Object.defineProperty(ev, 'dataTransfer', { get: () => { last = true; return { files: { length: 0 } }; } });
            omrade.dispatchEvent(ev);
        }
        expect(omrade.classList.contains('drag-over')).toBe(false);
        expect(last).toBe(false);
        await r.klar;
        const ev = new w.Event('dragover', { bubbles: true, cancelable: true });
        omrade.dispatchEvent(ev);
        expect(omrade.classList.contains('drag-over')).toBe(true);   // efter omritningen tar ytan emot filer igen
    });
    it('Översikts delar (exportgrinden) kör regressionen en gång', () => {
        const w = createAppWindow();
        w.__loadDemoData();
        raknaRegressioner(w);
        w.eval('renderOversiktDelar()');
        expect(w.__regKorningar).toBe(1);
    });
});

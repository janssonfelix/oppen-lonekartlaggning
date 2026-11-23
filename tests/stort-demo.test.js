/**
 * Stort demo (src/lib/demodata.js och 21-stort-demo.js): 5 000 påhittade personer med 100 AID-etiketter bredvid det lilla demot, för att visa verktyget i verklig
 * storlek utan riktig data.
 *
 * Generatorn (storlek, determinism, fälten, BAS A–K, yrkesgrupperna och de små grupperna) prövas utan webbläsare i
 * tests/demodata.test.js. Här vaktas inläsningen (demoläget, flikarna, Översikt utan internt fel och utan självdiagnostik, den påhittade jämförelsestatistiken och
 * ställningstagandet ur demots löner), att en riktig lönefil eller statistikfil ersätter demots statistik, ingångarna
 * (Kom igång, lönefilskortet, ?demo=stor), nyckeltalen (rått gap, könskoefficienten, antalet små grupper), att det lilla demot är oförändrat, att Excel (alla flikar) inte röjer ett
 * könsuppdelat lönemått för en grupp under tröskeln och att Rensa all data lämnar samma tillstånd som efter det lilla
 * demot.
 */
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createAppWindow, tillstandsavtryck } from './helpers/app-harness.js';
import { arKvinna, arMan } from '../src/lib/kon.js';

// Inläsningen ritar Översikt och räknar alla analyser för 5 000 personer synkront; under full last tar det några sekunder.
vi.setConfig({ testTimeout: 60000 });

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const BAS_AK = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K'];
const utanMellanrum = t => String(t || '').replace(/[\s  ]+/g, ' ');
const median = l => { const s = [...l].sort((a, b) => a - b); return (s[(s.length - 1) >> 1] + s[s.length >> 1]) / 2; };

// Räknar interna fel (rapporteraFel) och självdiagnostikens körningar i fönstret.
function bevaka(w) {
    w.eval(`window.__fel = []; window.__diagnostik = 0;
        { const rf = rapporteraFel; rapporteraFel = function (plats, e) { window.__fel.push(plats + ': ' + (e && e.message)); return rf(plats, e); }; }
        { const rd = runDiagnostics; runDiagnostics = function () { window.__diagnostik++; return rd(); }; }`);
    return w;
}

describe('stort demo: inläsningen', () => {
    let w;
    beforeAll(() => { w = bevaka(createAppWindow()); w.eval('loadStortDemo()'); });

    it('sätter demoläget, låser upp flikarna och kör inte självdiagnostiken', () => {
        const d = w.document;
        expect(w.__state.data).toHaveLength(5000);
        expect(w.__state.isDemo).toBe(true);
        expect(d.getElementById('tab-matrix').disabled).toBe(false);
        expect(d.getElementById('tab-struktur').disabled).toBe(false);
        expect(w.__diagnostik).toBe(0);
        expect(d.getElementById('diagnostic-results').style.display).not.toBe('block');
        expect(w.__state.dataAudit).toEqual({ totalRaw: 5000, excludedNoBas: 0, excludedZeroLon: 0 });
    });

    it('statusraden och demobannern säger att det är det stora demot', () => {
        const d = w.document;
        expect(utanMellanrum(d.getElementById('data-status').textContent)).toContain('Syntetisk testdata, stort demo: 5 000 personer');
        expect(d.getElementById('demo-mode-banner').style.display).toBe('flex');
        expect(utanMellanrum(d.getElementById('demo-mode-banner').textContent)).toMatch(/stort demo/i);
        expect(d.getElementById('first-run-hint').style.display).toBe('none');
    });

    it('demoreferensen täcker varje BAS-intervall i underlaget', () => {
        const bas = new Set(w.__state.policy.map(r => r.bas));
        expect(BAS_AK.filter(b => !bas.has(b))).toEqual([]);
        expect(w.__state.policyKalla).toBe('demo');
    });

    it('Översikt och flikarna ritas utan internt fel', () => {
        for (const flik of ['dashboard', 'filer', 'matrix', 'likvardighet', 'struktur', 'prioritering', 'utforska']) w.__renderTabContent(flik);
        expect(w.__fel).toEqual([]);
        expect(w.__state._interntFel || []).toEqual([]);
        expect(w.document.getElementById('internt-fel-banner').hidden).toBe(true);
        expect(w.document.querySelectorAll('#view-dashboard svg').length).toBeGreaterThan(0);
    });

    it('jämförelsestatistiken har en rad per yrke och intervall, märkt som påhittad', () => {
        const s = w.__state;
        const grupper = [...new Set(s.data.map(r => `${r.aid}|${r.bas}`))];
        const utan = grupper.filter(g => { const [aid, bas] = g.split('|'); return w.eval(`statistikFor(__state.statistik, ${JSON.stringify(aid)}, ${JSON.stringify(bas)})?.matchning`) !== 'aid-bas'; });
        expect(utan).toEqual([]);
        expect(s.statistik.filter(x => !grupper.includes(`${x.aid}|${x.bas}`))).toEqual([]);
        expect(s.statistik).toHaveLength(grupper.length);
        expect(s.statistikKalla).toBe('demo');
        expect(s.statistikNamn).toBe('Påhittad jämförelsestatistik (demo)');
        const beskrivning = w.eval('statistikBeskrivning()');
        expect(beskrivning).toContain('påhittad');
        expect(beskrivning).not.toContain('egen fil');
        expect(utanMellanrum(w.document.querySelector('#upload-cell-stat .upload-filnamn').textContent)).toContain('Demots jämförelsestatistik');
    });

    it('statistiken ligger i snitt ca 10 % över demots löner, och ungefär en fjärdedel av grupperna ligger över den', () => {
        const s = w.__state;
        const kvoter = s.statistik.map(x => x.median / median(s.data.filter(r => r.aid === x.aid && r.bas === x.bas).map(r => r.lon)));
        const snitt = kvoter.reduce((a, b) => a + b, 0) / kvoter.length;
        expect(snitt).toBeGreaterThanOrEqual(1.05);
        expect(snitt).toBeLessThanOrEqual(1.15);
        const over = kvoter.filter(k => k < 1).length / kvoter.length;   // gruppens median över statistikens
        expect(over).toBeGreaterThanOrEqual(0.15);
        expect(over).toBeLessThanOrEqual(0.35);
    });

    it('ställningstagandet följer demots löner och några intervall ligger över', () => {
        const s = w.__state;
        expect(s.policy.map(r => r.bas).sort()).toEqual(BAS_AK);
        let over = 0;
        const k = w.eval('kInstalld()'), avrunda = (x, steg) => Math.round(x / steg) * steg;
        for (const r of s.policy) {
            const loner = s.data.filter(d => d.bas === r.bas).map(d => d.lon);
            if (loner.length < k) {
                // Under tröskeln: närmaste lägre intervall gånger 1,10, inte gruppens egna löner.
                const lagre = s.policy[s.policy.indexOf(r) - 1];
                expect(r.med, r.bas).toBe(avrunda(lagre.med * 1.1, 500));
                continue;
            }
            const m = median(loner);
            expect(Math.abs(r.med / m - 1), r.bas).toBeLessThanOrEqual(0.10);
            expect(r.p10, r.bas).toBeLessThan(r.med);
            expect(r.p90, r.bas).toBeGreaterThan(r.med);
            if (r.med > 1.025 * m) over++;
        }
        expect(s.data.filter(d => d.bas === 'K').length).toBeLessThan(k);   // K är i dag det enda intervallet under tröskeln
        expect(over).toBeGreaterThanOrEqual(2);
        expect(over).toBeLessThanOrEqual(3);
    });
});

describe('stort demo: demots statistik byts ut', () => {
    it('en riktig lönefil efter det stora demot tar bort demots statistik', () => {
        const w = createAppWindow();
        w.eval('loadStortDemo()');
        w.eval('__state.data = genereraTestdata(); _afterDataLoaded();');
        expect(w.__state.statistik).toHaveLength(0);
        expect(w.__state.statistikKalla).toBe(null);
        expect(w.document.getElementById('upload-cell-stat').classList.contains('loaded')).toBe(false);
        expect(utanMellanrum(w.document.querySelector('#upload-cell-stat .upload-filnamn').textContent)).not.toContain('Demots');
    });

    it('en statistikfil efter det stora demot ersätter demots statistik', async () => {
        const w = createAppWindow();
        w.eval('loadStortDemo()');
        w.eval(readFileSync(join(root, 'vendor', 'papaparse.min.js'), 'utf8'));
        const input = w.document.getElementById('file-input-stat');
        const fil = new w.File(['AID;BAS;Median\n401011;F;41000\n'], 'statistik.csv', { type: 'text/csv' });
        Object.defineProperty(input, 'files', { configurable: true, value: [fil] });
        input.dispatchEvent(new w.Event('change'));
        for (let i = 0; i < 50 && !/inlästa|Fel/.test(w.document.getElementById('stat-status').textContent); i++) await new Promise(r => setTimeout(r, 20));
        expect(w.__state.statistikKalla).toBe('fil');
        expect(w.__state.statistik).toHaveLength(1);
        expect(w.eval('statistikBeskrivning()')).toContain('egen fil');
    });
});

describe('stort demo: ingångarna', () => {
    it('Kom igång har knappen före det lilla demot ("prova med demodata, stort demo eller litet demo")', () => {
        const w = bevaka(createAppWindow()), d = w.document;
        const knapp = d.getElementById('first-run-stort-demo');
        expect(knapp.closest('#first-run-hint')).not.toBeNull();
        expect(utanMellanrum(knapp.textContent)).toBe('stort demo (5 000 personer)');
        expect(knapp.title).toBe('Läs in det stora demot: 5 000 påhittade personer');
        expect(knapp.compareDocumentPosition(d.getElementById('first-run-demo-link')) & w.Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
        knapp.click();
        expect(w.__state.data).toHaveLength(5000);
        expect(w.__diagnostik).toBe(0);
    });

    it('lönefilskortet i Filer och kvalitet har båda valen', () => {
        const w = createAppWindow(), d = w.document;
        const litet = d.getElementById('upload-demo-litet'), stort = d.getElementById('upload-demo-stort');
        expect(litet.closest('#upload-cell-data')).not.toBeNull();
        expect(stort.closest('#upload-cell-data')).not.toBeNull();
        expect(stort.compareDocumentPosition(litet) & w.Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
        litet.click();
        expect(w.__state.data).toHaveLength(260);
        stort.click();
        expect(w.__state.data).toHaveLength(5000);
        expect(w.__state.isDemo).toBe(true);
    });

    it('adressen ?demo=stor startar det stora demot, ?demo=1 det lilla', () => {
        const stor = bevaka(createAppWindow({ url: 'http://localhost/?demo=stor' }));
        expect(stor.__state.data).toHaveLength(5000);
        expect(stor.__state.isDemo).toBe(true);
        const liten = createAppWindow({ url: 'http://localhost/?demo=1' });
        expect(liten.__state.data).toHaveLength(260);
        const annat = createAppWindow({ url: 'http://localhost/?demo=5000' });
        expect(annat.__state.data).toHaveLength(0);
    });

    it('sökningen hittar demovalen', () => {
        const w = createAppWindow(), d = w.document;
        const f = d.getElementById('sok-grupp');
        f.value = 'stort demo';
        f.dispatchEvent(new w.Event('input', { bubbles: true }));
        expect(utanMellanrum(d.getElementById('sok-grupp-lista').textContent)).toMatch(/demo/i);
    });
});

// Nyckeltalen lästa ur demot efter ombyggnaden till 5 000 personer. Talen ändras med avsikt när demot ändras: läs av
// de nya värdena och skriv in dem här.
const SD_RATT_GAP = -0.99;      // median kvinnor / median män − 1, i %
const SD_KONPCT = -2.35;        // runOLSRegression().konPct, i %
const SD_SMA_GRUPPER = 101;     // grupper (AID-kod i BAS-intervallet, ADR-89) med n < 10 eller ett kön < 10

describe('stort demo: nyckeltalen', () => {
    let w;
    beforeAll(() => { w = createAppWindow(); w.eval('loadStortDemo()'); });

    it('rått gap', () => {
        const d = w.__state.data;
        const gap = (median(d.filter(arKvinna).map(r => r.lon)) / median(d.filter(arMan).map(r => r.lon)) - 1) * 100;
        expect(Math.abs(gap - SD_RATT_GAP)).toBeLessThanOrEqual(0.3);
    });

    it('könskoefficienten i regressionen', () => {
        expect(Math.abs(w.eval('runOLSRegression()').konPct - SD_KONPCT)).toBeLessThanOrEqual(0.3);
    });

    it('antalet små grupper', () => {
        const per = new Map();
        for (const r of w.__state.data) {
            const nyckel = `${r.aid}|${r.bas}`;
            const g = per.get(nyckel) || { n: 0, kv: 0, ma: 0 };
            g.n++; if (arKvinna(r)) g.kv++; if (arMan(r)) g.ma++;
            per.set(nyckel, g);
        }
        expect([...per.values()].filter(g => g.n < 10 || g.kv < 10 || g.ma < 10)).toHaveLength(SD_SMA_GRUPPER);
    });
});

describe('det lilla demot är oförändrat', () => {
    it('260 rader, självdiagnostiken körs och bannern nämner inget stort demo', () => {
        const w = bevaka(createAppWindow()), d = w.document;
        w.__loadDemoData();
        expect(w.__state.data).toHaveLength(260);
        expect(w.__diagnostik).toBe(1);
        expect(d.getElementById('diagnostic-results').style.display).toBe('block');
        expect(w.__state.policy).toHaveLength(10);
        expect(utanMellanrum(d.getElementById('data-status').textContent)).toContain('Syntetisk testdata: 260 personer');
        expect(utanMellanrum(d.getElementById('demo-mode-banner').textContent)).not.toMatch(/stort demo/i);
    });
    it('det lilla demot efter det stora: 260 rader och referensen A–J', () => {
        const w = createAppWindow();
        w.eval('loadStortDemo()');
        w.__loadDemoData();
        expect(w.__state.data).toHaveLength(260);
        expect(w.__state.policy).toHaveLength(10);
        expect(utanMellanrum(w.document.getElementById('demo-mode-banner').textContent)).not.toMatch(/stort demo/i);
    });
    it('det lilla demot efter det stora: ingen statistik kvar', () => {
        const w = createAppWindow();
        w.eval('loadStortDemo()');
        w.__loadDemoData();
        expect(w.__state.statistik).toHaveLength(0);
        expect(w.__state.statistikKalla).toBe(null);
        expect(w.document.getElementById('upload-cell-stat').classList.contains('loaded')).toBe(false);
    });
});

// Samma form som kanonymitet.test.js: varje grupp under tröskeln (ett yrke under tio, eller ett kön under tio i ett yrke
// inom ett BAS-intervall, också när det andra könet är under tio) får en egen lön c, så att gruppens median och medel är c:
// hälften får c − D, hälften c + D och, vid udda antal, en c. En lön lika för alla räcker inte när båda könen är små: då
// består den större gruppen (yrket i BAS-intervallet, som får redovisas) bara av de två lönerna, och dess kvantiler landar
// på dem. Med två löner per grupp hamnar den större gruppens kvantiler på c ± D, inte på c.
// Lönen väljs så att ingen annan person har den och så att inget mått som får redovisas landar på den: P10, kvartilerna,
// medianen, P90 och medel för varje grupp med minst tio personer, i indelningarna yrke inom BAS, yrke, BAS,
// organisationen, sektor, åldersgrupp och ansvarsgrupp inom yrket (och inom yrket i BAS-intervallet), var och en
// också per kön. En träff i en cell kan då bara komma från ett mått
// för en grupp under tröskeln.
function sattSentinel(data, sektor) {
    const P = [0.1, 0.25, 0.5, 0.75, 0.9];
    const kvantil = (s, p) => { const h = (s.length - 1) * p, l = Math.floor(h), u = Math.ceil(h); return s[l] + (h - l) * (s[u] - s[l]); };
    const nycklar = r => [`yb|${r.aid}|${r.bas}`, `y|${r.aid}`, `b|${r.bas}`, 'org', `s|${sektor[r.aid]}`, `a|${Math.min(6, Math.floor(r.alder / 10))}`,
        `yba|${r.aid}|${r.bas}|${r.ansvarsgrupp}`, `ya|${r.aid}|${r.ansvarsgrupp}`]
        .flatMap(g => [g, `${g}|${r.kon}`]);
    const medlemmar = new Map();
    for (const r of data) for (const g of nycklar(r)) { if (!medlemmar.has(g)) medlemmar.set(g, []); medlemmar.get(g).push(r); }
    const matt = rader => {
        if (rader.length < 10) return [];   // redovisas inte
        const l = rader.map(r => r.lon).sort((a, b) => a - b);
        return [...P.map(p => kvantil(l, p)), l.reduce((s, x) => s + x, 0) / l.length].flatMap(m => [m, Math.round(m)]);
    };
    const yrkeN = new Map();
    for (const r of data) yrkeN.set(r.aid, (yrkeN.get(r.aid) || 0) + 1);
    const block = [];
    for (const [g, rader] of medlemmar) {
        if (!/^yb\|[^|]+\|[^|]+$/.test(g)) continue;
        if (yrkeN.get(rader[0].aid) < 10) { block.push(rader); continue; }
        for (const kon of ['kvinna', 'man']) {
            const del = rader.filter(r => r.kon === kon);
            if (del.length && del.length < 10) block.push(del);
        }
    }
    const original = new Map(block.map(del => [del, del.map(r => r.lon)]));
    const D = 1234;
    // Gruppens löner kring c: median och medel blir c.
    const satt = (del, c) => { const h = del.length >> 1; del.forEach((r, i) => { r.lon = i < h ? c - D : (del.length % 2 && i === h) ? c : c + D; }); };
    const tilldelat = new Map();   // block → lön
    // Måtten per grupp sparas tills en grupps löner ändras; egnaAv ger grupperna som en del ingår i.
    const sparat = new Map();
    const mattAv = rader => { if (!sparat.has(rader)) sparat.set(rader, matt(rader)); return sparat.get(rader); };
    const egnaAv = del => [...new Set(del.flatMap(nycklar))].map(g => medlemmar.get(g));
    const andrade = del => { for (const rader of egnaAv(del)) sparat.delete(rader); };
    const aterstall = del => { del.forEach((r, i) => { r.lon = original.get(del)[i]; }); andrade(del); };
    const allaMatt = () => { const s = new Set(); for (const rader of medlemmar.values()) for (const m of mattAv(rader)) s.add(m); return s; };
    // Varje placering flyttar rangerna i de större grupperna, så tilldelningen görs om tills alla är lediga på det slutliga
    // underlaget. Finns ingen ledig lön (gruppen är en stor del av en grupp som får redovisas, t.ex. sju av arton män i ett
    // BAS-intervall) prövas gruppen inte: där är det större måttet lagligt och går inte att skilja från en läcka.
    const utanLedig = new Set();   // grupper utan ledig lön söks inte om i nästa varv
    for (let varv = 0; varv < 8; varv++) {
        let andrat = false;
        const upptagna = allaMatt();   // en gång per varv; det som en senare placering i varvet flyttar fångas nästa varv
        for (const del of block) {
            const nu = tilldelat.get(del);
            if (utanLedig.has(del) || (nu !== undefined && !upptagna.has(nu))) continue;
            const egna = egnaAv(del);
            aterstall(del);
            const ovriga = new Set();
            for (const rader of medlemmar.values()) if (!egna.includes(rader)) for (const m of mattAv(rader)) ovriga.add(m);
            const loner = new Set(data.filter(r => !del.includes(r)).map(r => r.lon));
            const med = [...original.get(del)].sort((a, b) => a - b)[del.length >> 1];
            let v = null;
            for (let j = 0; j < 1500 && v === null; j++) for (const c of [med + 7 * j + 3, med - 7 * j - 4]) {
                // Inte på jämnt hundratal: demots jämförelsestatistik och ställningstagande är avrundade till 100 kr och
                // står i Excel, så en sådan lön skulle träffa dem utan att något läckt.
                if (v !== null || c % 100 === 0 || loner.has(c) || ovriga.has(c)) continue;
                satt(del, c);
                if (!egna.some(rader => matt(rader).includes(c))) v = c;
            }
            if (v === null) { aterstall(del); utanLedig.add(del); if (nu !== undefined) { tilldelat.delete(del); andrat = true; } continue; }
            andrade(del);
            tilldelat.set(del, v);
            andrat = true;
        }
        if (!andrat) break;
    }
    // Grupper som fortfarande krockar efter varven (två små grupper som tillsammans är nästan hela en grupp som får
    // redovisas, t.ex. sex kvinnor och sju män i en ansvarsgrupp om tretton) prövas inte heller: där landar det
    // större måttet på en av lönerna hur de än väljs.
    for (;;) {
        const upptagna = allaMatt(), krock = [...tilldelat.keys()].find(del => upptagna.has(tilldelat.get(del)));
        if (!krock) break;
        aterstall(krock);
        tilldelat.delete(krock);
    }
    const slut = allaMatt(), varden = [...tilldelat.values()];
    expect(varden.filter(v => slut.has(v))).toEqual([]);
    // Vilka grupper som prövas: yrke, BAS och kön för varje grupp som fick en lön.
    const provade = [...tilldelat.keys()].map(del => {
        const yb = medlemmar.get(`yb|${del[0].aid}|${del[0].bas}`), kv = yb.filter(r => r.kon === 'kvinna').length;
        return { bas: del[0].bas, kon: new Set(del.map(r => r.kon)).size === 1 ? del[0].kon : null, n: del.length, bada: kv < 10 && yb.length - kv < 10 && yb.length >= 10 };
    });
    return { varden, block: block.length, provade };
}

describe('stort demo: Excel (alla flikar) röjer ingen grupp under tröskeln', () => {
    let w, bok, sentinel, block, provade;
    beforeAll(() => {
        w = createAppWindow();
        w.eval(readFileSync(join(root, 'vendor', 'xlsx.mini.min.js'), 'utf8'));
        const data = w.eval('genereraStortDemo()');
        const sektor = w.eval(`Object.fromEntries(${JSON.stringify([...new Set(data.map(r => r.aid))])}.map(a => [a, sektorsnamn(a)]))`);
        ({ varden: sentinel, block, provade } = sattSentinel(data, sektor));
        w.__sdJson = JSON.stringify(data);
        w.eval('_lasInDemounderlag(() => JSON.parse(window.__sdJson), { stort: true })');   // som loadStortDemo, med sentinellönerna
        w.alert = () => {};
        const fangat = {};
        w.XLSX.writeFile = (wb, namn) => { fangat[namn] = wb; };
        w.eval('exportAlltTillExcel()');
        expect(Object.keys(fangat)).toHaveLength(1);
        const wb = Object.values(fangat)[0];
        bok = wb.SheetNames.map(namn => ({ namn, rader: w.XLSX.utils.sheet_to_json(wb.Sheets[namn], { header: 1, raw: true }) }));
    });

    it('ingen sentinellön för ett litet yrke eller ett kön under tio i någon cell', () => {
        expect(sentinel.length, `${sentinel.length} av ${block} små grupper prövas`).toBeGreaterThanOrEqual(0.85 * block);
        // Också en grupp där båda könen är under tio men yrket i BAS-intervallet når tröskeln (som Trafikhandläggare i G, 7 + 8).
        expect(provade.filter(p => p.bada && p.kon).length, 'kön där båda är under tio').toBeGreaterThanOrEqual(1);
        // BAS-intervallen I, J och K är små (I och J har några få yrken, K bara Rektor): varje intervall har minst en
        // prövad könsgrupp. I K är könet i yrket också könet i intervallet.
        for (const bas of ['I', 'J', 'K']) expect(provade.filter(p => p.bas === bas && p.kon).length, `BAS ${bas}`).toBeGreaterThanOrEqual(1);
        const lackor = [];
        for (const { namn, rader } of bok) for (const rad of rader) for (const c of rad) {
            const tal = (String(c ?? '').replace(/(\d)[\s  ](?=\d)/g, '$1').match(/\d+(?:[.,]\d+)?/g) || []).map(t => Number(t.replace(',', '.')));
            for (const s of sentinel) if (tal.includes(s)) lackor.push(`${namn}: ${JSON.stringify(rad).slice(0, 160)}`);
        }
        expect(lackor).toEqual([]);
    });

    it('blad med antal kvinnor och män: ingen medianlön, kvot eller gräns där ett kön är färre än tio', () => {
        // Varje tabell med kolumnerna "Antal kvinnor" och "Antal män": raderna under rubriken prövas kolumn för kolumn.
        let provade = 0;
        const fel = [];
        // Ett tal i cellen, också som text ("68 415 kr", "12", "91,7 %"); annars null.
        const somTal = v => {
            if (typeof v === 'number') return v;
            const t = String(v ?? '').replace(/[\s  ]/g, '');
            return /^-?\d+(?:[.,]\d+)?(?:kr|%)?$/.test(t) ? Number(t.replace(/kr|%/g, '').replace(',', '.')) : null;
        };
        expect([somTal('68 415 kr'), somTal('12'), somTal('91,7 %'), somTal('–'), somTal('< 10')]).toEqual([68415, 12, 91.7, null, null]);
        for (const { namn, rader } of bok) {
            const i = rader.findIndex(r => r.includes('Antal kvinnor') && r.includes('Antal män'));
            if (i < 0) continue;
            const rubrik = rader[i], kv = rubrik.indexOf('Antal kvinnor'), ma = rubrik.indexOf('Antal män');
            // Andelar av antalet (andel kvinnor, underrepresenterat kön) är inga lönemått.
            const lonekolumner = rubrik.map((t, j) => [t, j]).filter(([t]) => /median|medel|lön|%|gräns|kvot/i.test(String(t)) && !/^(Antal|Andel|Underrepresenterat)/.test(String(t))).map(([, j]) => j);
            for (const rad of rader.slice(i + 1)) {
                if (!rad.length) break;   // tabellen slutar vid första tomma raden; nästa tabell har egna kolumner
                const nKv = somTal(rad[kv]), nMa = somTal(rad[ma]);
                if (nKv === null || nMa === null || (nKv >= 10 && nMa >= 10)) continue;
                provade++;
                const tal = lonekolumner.filter(j => somTal(rad[j]) !== null);
                if (tal.length) fel.push(`${namn}: ${JSON.stringify(rubrik)} ${JSON.stringify(rad).slice(0, 160)}`);
            }
        }
        expect(provade, 'rader med ett kön under tio').toBeGreaterThanOrEqual(5);
        expect(fel).toEqual([]);
    });
});

describe('stort demo: Rensa all data', () => {
    it('tömmer allt, och lämnar samma tillstånd som efter det lilla demot', () => {
        const stort = createAppWindow(), litet = createAppWindow();
        stort.eval('loadStortDemo()');
        litet.__loadDemoData();
        stort.eval('_rensaAllData()');
        litet.eval('_rensaAllData()');
        expect(stort.__state.data).toHaveLength(0);
        expect(stort.__state.isDemo).toBe(false);
        expect(stort.__state.policy).toHaveLength(0);
        expect(stort.__state.statistik).toHaveLength(0);
        expect(stort.document.getElementById('demo-mode-banner').style.display).toBe('none');
        expect(stort.document.getElementById('first-run-hint').style.display).toBe('');
        expect(tillstandsavtryck(stort)).toEqual(tillstandsavtryck(litet));
    });
});

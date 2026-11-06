/**
 * Stort demo (21-stort-demo.js): 7 000 påhittade personer bredvid det lilla demot, för att visa verktyget i verklig
 * storlek utan riktig data.
 *
 * Vaktar generatorn (storlek, determinism, fälten, BAS A–K, yrkesgrupperna och de små grupperna), inläsningen
 * (demoläget, flikarna, Översikt utan internt fel och utan självdiagnostik), ingångarna (Kom igång, lönefilskortet,
 * ?demo=stor), att det lilla demot är oförändrat, att Excel (alla flikar) inte röjer ett könsuppdelat lönemått för en
 * grupp under tröskeln och att Rensa all data lämnar samma tillstånd som efter det lilla demot.
 */
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createAppWindow, tillstandsavtryck } from './helpers/app-harness.js';

// Inläsningen ritar Översikt och räknar alla analyser för 7 000 personer synkront; under full last tar det några sekunder.
vi.setConfig({ testTimeout: 60000 });

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const BAS_AK = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K'];
const utanMellanrum = t => String(t || '').replace(/[\s  ]+/g, ' ');

// Räknar interna fel (rapporteraFel) och självdiagnostikens körningar i fönstret.
function bevaka(w) {
    w.eval(`window.__fel = []; window.__diagnostik = 0;
        { const rf = rapporteraFel; rapporteraFel = function (plats, e) { window.__fel.push(plats + ': ' + (e && e.message)); return rf(plats, e); }; }
        { const rd = runDiagnostics; runDiagnostics = function () { window.__diagnostik++; return rd(); }; }`);
    return w;
}

describe('stort demo: generatorn', () => {
    let w, data;
    beforeAll(() => { w = createAppWindow(); data = w.eval('generateStortDemo()'); });

    it('7 000 rader, och samma rader vid ett andra anrop', () => {
        expect(data).toHaveLength(7000);
        const igen = w.eval('generateStortDemo()');
        expect(igen[0]).toEqual(data[0]);
        expect(JSON.stringify(igen)).toBe(JSON.stringify(data));
    });

    it('varje rad har samma fält som det lilla demot, alla satta', () => {
        const fel = [];
        data.forEach((r, i) => {
            const ok = BAS_AK.includes(r.bas) && /^\d{6} \S/.test(r.yrke) && r.aid === r.yrke.slice(0, 6)
                && r.yrkeLabel === r.yrke.slice(7) && Number.isInteger(r.lon) && r.lon > 15000 && r.lon < 150000
                && Number.isInteger(r.alder) && r.alder >= 18 && r.alder <= 67 && (r.kon === 'kvinna' || r.kon === 'man')
                && Array.isArray(r.ansvarskoder) && ['inget', 'uppdrag', 'ledning'].includes(r.ansvarsgrupp) && r.radnr === i + 2;
            if (!ok) fel.push(i);
        });
        expect(fel.slice(0, 5)).toEqual([]);
        const falt = Object.keys(w.eval('generateDemoData()')[0]).concat('radnr').sort();
        expect(Object.keys(data[0]).sort()).toEqual(falt);
    });

    it('BAS A–K finns alla, flest i B–E och få i J–K', () => {
        const per = Object.fromEntries(BAS_AK.map(b => [b, data.filter(r => r.bas === b).length]));
        for (const b of BAS_AK) expect(per[b], b).toBeGreaterThan(0);
        expect(per.B + per.C + per.D + per.E).toBeGreaterThan(0.6 * data.length);
        expect(per.J + per.K).toBeLessThan(0.01 * data.length);
    });

    it('minst 25 yrkesgrupper, några under tio personer och några där ett kön är färre än tio', () => {
        const per = new Map();
        for (const r of data) { const g = per.get(r.aid) || { n: 0, kv: 0 }; g.n++; if (r.kon === 'kvinna') g.kv++; per.set(r.aid, g); }
        expect(per.size).toBeGreaterThanOrEqual(25);
        expect(per.size).toBeLessThanOrEqual(30);
        const sma = [...per.values()].filter(g => g.n < 10);
        expect(sma.length).toBeGreaterThanOrEqual(2);
        const ettKonFa = [...per.values()].filter(g => g.n >= 10 && (g.kv < 10 || g.n - g.kv < 10));
        expect(ettKonFa.length).toBeGreaterThanOrEqual(2);
        expect(Math.max(...[...per.values()].map(g => g.n))).toBeLessThanOrEqual(900);
    });

    it('kontrollen av AID-kodningen är grön: koderna finns i etikettlistan och ansvarskoderna är tillåtna', () => {
        const kriterier = w.eval('_akAidKriterier(generateStortDemo(), { k: 10, harAnsvar: true })');
        expect(kriterier.filter(k => k.status !== 'ok').map(k => `${k.id}: ${k.text}`)).toEqual([]);
    });

    it('likvärdigt arbete: ett mansdominerat tekniskt yrke i BAS C har högre lön än ett kvinnodominerat vårdyrke där', () => {
        const median = l => { const s = [...l].sort((a, b) => a - b); return (s[(s.length - 1) >> 1] + s[s.length >> 1]) / 2; };
        const grupp = aid => data.filter(r => r.bas === 'C' && r.aid === aid);
        const tekniker = grupp('503012'), underskoterska = grupp('207011');
        expect(tekniker.filter(r => r.kon === 'kvinna').length / tekniker.length).toBeLessThan(0.25);
        expect(underskoterska.filter(r => r.kon === 'kvinna').length / underskoterska.length).toBeGreaterThan(0.8);
        expect(median(tekniker.map(r => r.lon))).toBeGreaterThan(median(underskoterska.map(r => r.lon)) * 1.05);
    });
});

describe('stort demo: inläsningen', () => {
    let w;
    beforeAll(() => { w = bevaka(createAppWindow()); w.eval('loadStortDemo()'); });

    it('sätter demoläget, låser upp flikarna och kör inte självdiagnostiken', () => {
        const d = w.document;
        expect(w.__state.data).toHaveLength(7000);
        expect(w.__state.isDemo).toBe(true);
        expect(d.getElementById('tab-matrix').disabled).toBe(false);
        expect(d.getElementById('tab-struktur').disabled).toBe(false);
        expect(w.__diagnostik).toBe(0);
        expect(d.getElementById('diagnostic-results').style.display).not.toBe('block');
        expect(w.__state.dataAudit).toEqual({ totalRaw: 7000, excludedNoBas: 0, excludedZeroLon: 0 });
    });

    it('statusraden och demobannern säger att det är det stora demot', () => {
        const d = w.document;
        expect(utanMellanrum(d.getElementById('data-status').textContent)).toContain('Syntetisk testdata, stort demo: 7 000 personer');
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
});

describe('stort demo: ingångarna', () => {
    it('Kom igång har knappen bredvid det lilla demot ("prova med demodata, litet eller stort")', () => {
        const w = bevaka(createAppWindow()), d = w.document;
        const knapp = d.getElementById('first-run-stort-demo');
        expect(knapp.closest('#first-run-hint')).not.toBeNull();
        expect(utanMellanrum(knapp.textContent)).toBe('stort (7 000 personer)');
        expect(knapp.title).toBe('Läs in det stora demot: 7 000 påhittade personer');
        knapp.click();
        expect(w.__state.data).toHaveLength(7000);
        expect(w.__diagnostik).toBe(0);
    });

    it('lönefilskortet i Filer och kvalitet har båda valen', () => {
        const w = createAppWindow(), d = w.document;
        const litet = d.getElementById('upload-demo-litet'), stort = d.getElementById('upload-demo-stort');
        expect(litet.closest('#upload-cell-data')).not.toBeNull();
        expect(stort.closest('#upload-cell-data')).not.toBeNull();
        litet.click();
        expect(w.__state.data).toHaveLength(260);
        stort.click();
        expect(w.__state.data).toHaveLength(7000);
        expect(w.__state.isDemo).toBe(true);
    });

    it('adressen ?demo=stor startar det stora demot, ?demo=1 det lilla', () => {
        const stor = bevaka(createAppWindow({ url: 'http://localhost/?demo=stor' }));
        expect(stor.__state.data).toHaveLength(7000);
        expect(stor.__state.isDemo).toBe(true);
        const liten = createAppWindow({ url: 'http://localhost/?demo=1' });
        expect(liten.__state.data).toHaveLength(260);
        const annat = createAppWindow({ url: 'http://localhost/?demo=7000' });
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
});

// Samma form som kanonymitet.test.js: varje grupp under tröskeln (ett yrke under tio, eller ett kön under tio i ett yrke
// inom ett BAS-intervall) får en egen lön, lika för alla i gruppen, så att varje mått för gruppen är lika med det värdet.
// Lönen väljs så att ingen annan person har den och så att inget mått som får redovisas landar på den: P10, kvartilerna,
// medianen, P90 och medel för varje grupp med minst tio personer, i indelningarna yrke inom BAS, yrke, BAS,
// organisationen, sektor och åldersgrupp, var och en också per kön. En träff i en cell kan då bara komma från ett mått
// för en grupp under tröskeln.
function sattSentinel(data, sektor) {
    const P = [0.1, 0.25, 0.5, 0.75, 0.9];
    const kvantil = (s, p) => { const h = (s.length - 1) * p, l = Math.floor(h), u = Math.ceil(h); return s[l] + (h - l) * (s[u] - s[l]); };
    const nycklar = r => [`yb|${r.aid}|${r.bas}`, `y|${r.aid}`, `b|${r.bas}`, 'org', `s|${sektor[r.aid]}`, `a|${Math.min(6, Math.floor(r.alder / 10))}`]
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
            if (del.length && del.length < 10 && rader.length - del.length >= 10) block.push(del);
        }
    }
    const original = new Map(block.map(del => [del, del.map(r => r.lon)]));
    const tilldelat = new Map();   // block → lön
    const allaMatt = () => { const s = new Set(); for (const rader of medlemmar.values()) for (const m of matt(rader)) s.add(m); return s; };
    // Varje placering flyttar rangerna i de större grupperna, så tilldelningen görs om tills alla är lediga på det slutliga
    // underlaget. Finns ingen ledig lön (gruppen är en stor del av en grupp som får redovisas, t.ex. sju av arton män i ett
    // BAS-intervall) prövas gruppen inte: där är det större måttet lagligt och går inte att skilja från en läcka.
    for (let varv = 0; varv < 8; varv++) {
        let andrat = false;
        for (const del of block) {
            const nu = tilldelat.get(del);
            if (nu !== undefined && !allaMatt().has(nu)) continue;
            const egna = [...new Set(del.flatMap(nycklar))].map(g => medlemmar.get(g));
            del.forEach((r, i) => { r.lon = original.get(del)[i]; });
            const ovriga = new Set();
            for (const rader of medlemmar.values()) if (!egna.includes(rader)) for (const m of matt(rader)) ovriga.add(m);
            const loner = new Set(data.filter(r => !del.includes(r)).map(r => r.lon));
            const med = [...original.get(del)].sort((a, b) => a - b)[del.length >> 1];
            let v = null;
            for (let j = 0; j < 1500 && v === null; j++) for (const c of [med + 7 * j + 3, med - 7 * j - 4]) {
                if (v !== null || loner.has(c) || ovriga.has(c)) continue;
                del.forEach(r => { r.lon = c; });
                if (!egna.some(rader => matt(rader).includes(c))) v = c;
            }
            if (v === null) { del.forEach((r, i) => { r.lon = original.get(del)[i]; }); if (nu !== undefined) { tilldelat.delete(del); andrat = true; } continue; }
            tilldelat.set(del, v);
            andrat = true;
        }
        if (!andrat) break;
    }
    const slut = allaMatt(), varden = [...tilldelat.values()];
    expect(varden.filter(v => slut.has(v))).toEqual([]);
    return { varden, block: block.length };
}

describe('stort demo: Excel (alla flikar) röjer ingen grupp under tröskeln', () => {
    let w, bok, sentinel, block;
    beforeAll(() => {
        w = createAppWindow();
        w.eval(readFileSync(join(root, 'vendor', 'xlsx.mini.min.js'), 'utf8'));
        const data = w.eval('generateStortDemo()');
        const sektor = w.eval(`Object.fromEntries(${JSON.stringify([...new Set(data.map(r => r.aid))])}.map(a => [a, _aidSektorsnamn(a)]))`);
        ({ varden: sentinel, block } = sattSentinel(data, sektor));
        w.__sdJson = JSON.stringify(data);
        w.eval('{ const original = generateStortDemo; generateStortDemo = () => JSON.parse(window.__sdJson); loadStortDemo(); generateStortDemo = original; }');
        w.alert = () => {};
        const fangat = {};
        w.XLSX.writeFile = (wb, namn) => { fangat[namn] = wb; };
        w.eval('exportAllToExcel()');
        expect(Object.keys(fangat)).toHaveLength(1);
        const wb = Object.values(fangat)[0];
        bok = wb.SheetNames.map(namn => ({ namn, rader: w.XLSX.utils.sheet_to_json(wb.Sheets[namn], { header: 1, raw: true }) }));
    });

    it('ingen sentinellön för ett litet yrke eller ett kön under tio i någon cell', () => {
        expect(sentinel.length, `${sentinel.length} av ${block} små grupper prövas`).toBeGreaterThanOrEqual(3);
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
        for (const { namn, rader } of bok) {
            const i = rader.findIndex(r => r.includes('Antal kvinnor') && r.includes('Antal män'));
            if (i < 0) continue;
            const rubrik = rader[i], kv = rubrik.indexOf('Antal kvinnor'), ma = rubrik.indexOf('Antal män');
            // Andelar av antalet (andel kvinnor, underrepresenterat kön) är inga lönemått.
            const lonekolumner = rubrik.map((t, j) => [t, j]).filter(([t]) => /median|medel|lön|%|gräns|kvot/i.test(String(t)) && !/^(Antal|Andel|Underrepresenterat)/.test(String(t))).map(([, j]) => j);
            for (const rad of rader.slice(i + 1)) {
                if (!rad.length) break;   // tabellen slutar vid första tomma raden; nästa tabell har egna kolumner
                if (typeof rad[kv] !== 'number' || typeof rad[ma] !== 'number' || (rad[kv] >= 10 && rad[ma] >= 10)) continue;
                provade++;
                const tal = lonekolumner.filter(j => typeof rad[j] === 'number');
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
        expect(stort.document.getElementById('demo-mode-banner').style.display).toBe('none');
        expect(stort.document.getElementById('first-run-hint').style.display).toBe('');
        expect(tillstandsavtryck(stort)).toEqual(tillstandsavtryck(litet));
    });
});

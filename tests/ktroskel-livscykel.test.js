/**
 * Livscykelns lönekurva följer tröskeln (ADR-70): kurvan för ett BAS-intervall är modellens lönenivå i intervallet,
 * ett lönemått.
 *
 * Underlaget: tre BAS-intervall med 30 personer (15 kvinnor, 15 män) och ett, D, med 4 personer, vars lönenivå är
 * ungefär tre gånger de andras, så att kurvans tal är lätta att känna igen. Användaren väljer D i rullistan över
 * intervall (det enda sättet att välja ett intervall som översiktstabellen utelämnar). I exportläget vid tröskeln 10
 * ritas ingen kurva för D: figuren saknas, och därmed bilden, diagramdatan och kopian i Alla diagram; en not säger
 * vilket intervall som är valt och varför kurvan inte visas, utan värden. Beräkningsbeviset för ett annat intervall
 * skriver inte nivåfaktorn mot D. Kurvans tal söks i varje utdataväg som invarianten söker igenom. Ett intervall
 * över tröskeln har sin kurva som förut, och skärmen visar kurvan för D (ADR-51). Modellen skattas som förut.
 *
 * Vaktar: S4 (docs/utveckling/regler.md)
 */
import { describe, it, expect, vi } from 'vitest';
import { createAppWindow } from './helpers/app-harness.js';
import { normalisera, iExport, samlaUtdata, sammanhang, oppnaFlik } from './helpers/ktroskel-rigg.js';

vi.setConfig({ testTimeout: 60000 });

// En rad per person: lönen är intervallets nivå, med en liten spridning och en liten skillnad mellan könen.
const rad = (bas, kon, lon, alder) => ({ bas, kon, lon, alder, yrke: `6100 Yrke ${bas}`, aid: '6100', yrkeLabel: `Yrke ${bas}`, enhet: '' });
const NIVAER = [['A', 30000, 30], ['B', 33000, 30], ['C', 36500, 30], ['D', 91000, 4]];
function fonster() {
    const w = createAppWindow();
    const r = [];
    for (const [bas, niva, n] of NIVAER) {
        for (let i = 0; i < n; i++) {
            const kv = i % 2 === 0;
            r.push(rad(bas, kv ? 'kvinna' : 'man', Math.round(niva * (kv ? 0.97 : 1) * (1 + ((i * 7) % 11) / 400) * (1 + (i % 9) / 60)), 26 + (i * 5) % 36));
        }
    }
    w.__state.data = r;
    w.__state.policy = NIVAER.map(([bas]) => ({ bas, p10: 22000, med: 30000, p90: 52000 }));
    w.__state.statistik = NIVAER.map(([bas]) => ({ aid: '6100', bas, median: 61700, p10: 55000, p90: 71000 }));
    w.eval('populateSelects(); unlockTabs();');
    return w;
}
const vanta = () => new Promise(r => setTimeout(r, 30));
// Väljer intervallet i rullistan, som användaren gör, på skärmen.
async function valj(w, bas) {
    w.__renderTabContent('kon');
    await vanta();
    const sel = w.document.getElementById('lifecycle-bas-select');
    sel.value = bas;
    sel.dispatchEvent(new w.Event('change'));
    await vanta();
}
// Kurvans tal för ett intervall: predikterad lön och bandets gränser vid varje ålder, i formerna de skrivs (heltal,
// avrundat och avkortat, och diagramdatans två decimaler med komma).
function kurvansTal(w, bas) {
    const r = w.eval(`runLifecycleRegression(${JSON.stringify(bas)})`);
    const v = [...r.predKvinna, ...r.predMan].flatMap(p => [p.lon, p.lo, p.hi]);
    return [...new Set(v.flatMap(x => [String(Math.round(x)), String(Math.trunc(x)), String(Math.round(x * 100) / 100).replace('.', ',')]))];
}
const lackorI = (utdata, dolda) => {
    const ut = [];
    for (const [namn, text] of utdata.filter(([n]) => n !== 'skärm: alla flikar')) {
        for (const v of dolda.filter(v => new RegExp(`(?<![\\d.,])${v}(?![\\d])`).test(text))) ut.push(`${namn}: ${v} — "${sammanhang(text, v)}"`);
    }
    return ut;
};
const NOT = /BAS D är valt\. Lönekurvan visas inte här: intervallet har färre än 10 personer/;

// Kurvans egna vägar ut, från skärmen som användaren tar dem: diagramdatan ur exportmenyn, bilden (SVG-texten före
// rastreringen, fångad där diagramTillBild lämnar figuren till figurTillBild), ZIP-filens urval och kopian i Alla
// diagram. Riggens samlaUtdata hittar inte livscykelns figur (den ritas på skärmen i nästa bildruta), så vägarna
// prövas här för sig.
async function livscykelVagar(w) {
    const d = w.document, ut = [];
    const el = () => d.getElementById('lifecycle-chart');
    const rader = r => r.map(x => x.join(' | ')).join('\n');
    ut.push(['diagramdata', rader(w.__chartExportRows(el()))]);
    await vanta();
    const svg = [];
    const orig = w.figurTillBild;
    w.figurTillBild = async (f, _format, bredd, hojd, val) => { svg.push(w.figurTillSvg(f, bredd, hojd, val)); return 'data:image/png;base64,eA=='; };
    try { await w.diagramTillBild(el(), { bredd: 1600, hojd: 900 }); } catch (_e) { /* inget att exportera */ }
    w.figurTillBild = orig;
    ut.push(['bilden (SVG före rastrering)', svg.join('\n')]);
    await vanta();
    ut.push(['ZIP-filens diagram', w.eval('zipDiagram()').map(e => e.id).join(',')]);
    await vanta();
    oppnaFlik(w, 'utforska');
    d.getElementById('ut-flik-alla').click();
    // Gruppen öppnas två gånger: första gången ritas fliken, och kurvan ritas i nästa bildruta; andra gången får den
    // sin kopia.
    for (let i = 0; i < 2; i++) {
        for (const g of d.querySelectorAll('#ut-alla-grupper > details')) { g.open = false; g.dispatchEvent(new w.Event('toggle')); g.open = true; g.dispatchEvent(new w.Event('toggle')); }
        await vanta();
    }
    const kopia = d.getElementById('ut-diagram-lifecycle-chart');
    ut.push(['kopian i Alla diagram', kopia ? rader(w.medExportLage(() => w.__chartExportRows(kopia))) : '']);
    d.getElementById('ut-flik-egna').click();
    oppnaFlik(w, 'kon');
    await vanta();
    return ut;
}

describe('Livscykelns lönekurva: ett valt BAS-intervall under tröskeln ritas inte i det som lämnar verktyget (ADR-70)', () => {
    it('fixturen: modellen skattas med alla intervall, D kan väljas i rullistan och dess kurva ligger långt över de andras', async () => {
        const w = fonster();
        const r = w.eval('runLifecycleRegression(null)');
        expect(r.ok).toBe(true);
        expect(r.basList).toEqual(['A', 'B', 'C', 'D']);
        expect(r.fixBas).not.toBe('D');
        await valj(w, 'D');
        expect(w.eval('_lifecycleFixBas')).toBe('D');
        const d = w.eval('runLifecycleRegression("D")');
        expect(d.predKvinna[0].lon).toBeGreaterThan(2 * r.predKvinna[0].lon);
    });

    it('på skärmen ritas kurvan för D som förut (ADR-51)', async () => {
        const w = fonster();
        await valj(w, 'D');
        const el = w.document.getElementById('lifecycle-chart');
        expect(el._figur).toBeTruthy();
        expect(el.querySelector('svg')).toBeTruthy();
        const d = w.eval('runLifecycleRegression("D")');
        const linje = el._figur.lager.find(l => l.marke === 'linje');
        expect(linje.data[0].y).toBeCloseTo(d.predKvinna[0].lon, 6);
        expect(normalisera(w.document.getElementById('livscykel-content').textContent)).not.toMatch(NOT);
    });

    it('exportläget vid 10: ingen figur för D, en not namnger intervallet, och inget diagram följer med i ZIP-filen', async () => {
        const w = fonster();
        await valj(w, 'D');
        iExport(w);
        w.__renderTabContent('kon');
        await vanta();
        const el = w.document.getElementById('lifecycle-chart');
        expect(el._figur).toBeFalsy();
        expect(el.querySelector('svg')).toBeNull();
        expect(w.eval("diagramRitat(document.getElementById('lifecycle-chart'))")).toBe(false);
        expect(w.eval('zipDiagram()').map(e => e.id)).not.toContain('lifecycle-chart');
        const t = normalisera(w.document.getElementById('livscykel-content').textContent);
        expect(t).toMatch(NOT);
        // Noten bär inga värden: inga tal utom tröskeln.
        const not = [...w.document.querySelectorAll('#livscykel-content .k-mask-note')].map(n => n.textContent).find(x => /Lönekurvan/.test(x));
        expect(not.replace(/\b10\b/g, '')).not.toMatch(/\d/);
    });

    it('exportläget vid 10: beräkningsbeviset för ett annat intervall skriver inte nivåfaktorn mot D', async () => {
        const w = fonster();
        await valj(w, 'D');
        const faktor = w.eval('svTal(runLifecycleRegression("D").basFaktor.B, 3)');
        iExport(w);
        w.__renderTabContent('kon');
        await vanta();
        w.document.querySelector('.btn-evidence[data-livscykel-bas="B"]').click();
        const modal = normalisera(w.document.getElementById('evidence-modal-content').textContent);
        expect(modal).toMatch(/Nivåfaktor mot visat intervall/);
        expect(modal).not.toContain(faktor);
        for (const v of kurvansTal(w, 'D')) expect(modal).not.toMatch(new RegExp(`(?<![\\d.,])${v}(?![\\d])`));
    });

    it('vid 10: kurvans egna vägar ut och samma utdatavägar som invarianten; D:s kurva står ingenstans', async () => {
        const w = fonster();
        await valj(w, 'D');
        const dolda = kurvansTal(w, 'D');
        const vagar = await livscykelVagar(w);
        expect(lackorI(vagar, dolda)).toEqual([]);
        expect(vagar.find(([n]) => n === 'ZIP-filens diagram')[1]).not.toMatch(/lifecycle-chart/);
        for (const namn of ['diagramdata', 'bilden (SVG före rastrering)', 'kopian i Alla diagram']) expect(vagar.find(([n]) => n === namn)[1], namn).toBe('');
        const utdata = await samlaUtdata(w);
        expect(lackorI(utdata, dolda)).toEqual([]);
        expect(utdata.find(([n]) => n === 'skärm i exportläget: alla flikar')[1]).toMatch(NOT);
    }, 180000);

    it('ett valt intervall över tröskeln har sin kurva i exporten som förut: diagramdatan, bilden, ZIP-filen och Alla diagram', async () => {
        const w = fonster();
        await valj(w, 'B');
        const tal = String(Math.round(w.eval('runLifecycleRegression("B")').predKvinna[0].lon * 100) / 100).replace('.', ',');
        const vagar = Object.fromEntries(await livscykelVagar(w));
        expect(vagar.diagramdata).toContain(tal);
        expect(vagar['kopian i Alla diagram']).toBe(vagar.diagramdata);
        expect(vagar['bilden (SVG före rastrering)']).toMatch(/<svg/);
        expect(vagar['ZIP-filens diagram']).toMatch(/lifecycle-chart/);
        iExport(w);
        w.__renderTabContent('kon');
        await vanta();
        expect(w.document.getElementById('lifecycle-chart')._figur).toBeTruthy();
        expect(normalisera(w.document.getElementById('livscykel-content').textContent)).not.toMatch(/Lönekurvan visas inte/);
    });
});

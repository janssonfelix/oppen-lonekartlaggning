import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { namnFranFil } from '../src/lib/referens.js';
import { createAppWindow } from './helpers/app-harness.js';

// Ingen inbyggd referens (ADR-28): modulen namnger bara en uppladdad fil.
describe('src/lib/referens.js', () => {
    it('namnFranFil tar bort ändelse och blanksteg; tomt ger "Egen referens"', () => {
        expect(namnFranFil('LPS 2027 Förskola.csv')).toBe('LPS 2027 Förskola');
        expect(namnFranFil('  malbild.v2.xlsx ')).toBe('malbild.v2');
        expect(namnFranFil('.csv')).toBe('Egen referens');
        expect(namnFranFil('')).toBe('Egen referens');
        expect(namnFranFil(undefined)).toBe('Egen referens');
    });
});

// Jämförelsestatistikens AID och BAS saneras vid inläsning på samma sätt som lönefilens
// fält: HTML-metatecken tas bort innan värdena når state (esc() vid rendering är det
// egentliga skyddet; detta är ett extra lager).
describe('jämförelsestatistik: AID och BAS saneras vid inläsning', () => {
    it('ett AID-värde med "<b>" läses in utan HTML-metatecken, i både aid, aidFull och bas', async () => {
        const w = createAppWindow();
        w.__loadDemoData();
        w.eval(readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'vendor', 'papaparse.min.js'), 'utf8'));
        const input = w.document.getElementById('file-input-stat');
        const csv = 'AID;BAS;Median\n5301 <b>Undersköterska</b>;"C&";30000\n';
        const fil = new w.File([csv], 'statistik.csv', { type: 'text/csv' });
        Object.defineProperty(input, 'files', { configurable: true, value: [fil] });
        input.dispatchEvent(new w.Event('change'));
        for (let i = 0; i < 50 && !/inlästa|Fel/.test(w.document.getElementById('stat-status').textContent); i++) await new Promise(r => setTimeout(r, 20));
        expect(w.document.getElementById('stat-status').textContent).toMatch(/1 poster inlästa/);
        const rad = w.__state.statistik.find(r => r.aid === '5301');
        expect(rad).toBeTruthy();
        expect(rad.aidFull).toBe('5301 bUndersköterska/b');
        expect(rad.bas).toBe('C');
        for (const r of w.__state.statistik) expect(`${r.aid}${r.aidFull}${r.bas}`).not.toMatch(/[<>"'&]/);
    });
});

describe('referensen: demoläget, egen fil och rensning (ADR-28)', () => {
    let w;
    beforeAll(() => { w = createAppWindow(); w.__loadDemoData(); });
    const klicka = tab => w.document.querySelector(`.nav-item[data-tab="${tab}"]`).click();

    it('demoläget använder Exempelkommunens påhittade ställningstagande, märkt som påhittat', () => {
        expect(w.__state.policy.length).toBe(10);
        expect(w.__referensNamn()).toBe('Exempelkommunens lönepolitik');
        expect(w.document.getElementById('referens-status').textContent).toContain('påhittad, demoläge');
    });
    it('Prioritering och Lönepolitik fungerar med referensen och visar namnet', () => {
        klicka('prioritering');
        expect(w.document.querySelectorAll('#prio-table tbody tr').length).toBeGreaterThan(0);
        expect(w.document.getElementById('view-prioritering').textContent).toContain('Exempelkommunens lönepolitik');
        klicka('benchmark');
        expect(w.document.getElementById('view-benchmark').textContent).toContain('Exempelkommunens lönepolitik');
    });
    it('egen fil med namn ersätter referensen i gränssnitt och export', () => {
        w.__lasInReferens([{ bas: 'A', p10: 20000, med: 25000, p90: 30000 }, { bas: 'B', p10: 21000, med: 26000, p90: 31000 }], 'Min referens.csv');
        expect(w.__referensNamn()).toBe('Min referens');
        expect(w.document.getElementById('referens-namn').value).toBe('Min referens');
        w.__sattReferensNamn('Förskolans LPS');
        expect(w.__referensKortnamn()).toBe('Förskolans LPS');
        klicka('prioritering'); klicka('benchmark'); klicka('dashboard');
        const ytor = ['view-prioritering', 'view-benchmark', 'compliance-overview', 'referens-status']
            .map(id => w.document.getElementById(id).textContent).join(' ');
        expect(ytor).toContain('Förskolans LPS');
        expect(ytor).not.toContain('Exempelkommunens lönepolitik');
        expect(w.__docDraftHtml()).toContain('Förskolans LPS');
        expect(w.__docDraftHtml()).toContain('(egen fil)');
    });
    it('"Ta bort referensen" och "Rensa all data" lämnar ingen referens', () => {
        w.document.getElementById('btn-referens-aterga').click();
        expect(w.__referensNamn()).toBe('Ingen referens inläst');
        w.__lasInReferens([{ bas: 'A', p10: 1, med: 2, p90: 3 }], 'x.csv');
        w.__clearAllData();
        expect(w.__state.policy).toEqual([]);
        w.__loadDemoData();
        w.__lasInReferens([{ bas: 'A', p10: 1, med: 2, p90: 3 }], 'y.csv');
        w.__autoClearOnInactivity();
        expect(w.__state.policy).toEqual([]);
    });
    it('en ren AID-policy med eget namn ger "saknar rader per BAS-intervall" i kompliansrutan', () => {
        w.__loadDemoData();
        w.__lasInReferens([{ aid: '123456', p10: 1, med: 2, p90: 3 }], 'AID-policy.csv');
        w.__updateCompliance();
        expect(w.document.getElementById('comp-pol-val').textContent).toContain('saknar rader per BAS-intervall');
        expect(w.document.getElementById('compliance-overview').textContent).toContain('AID-policy');
        w.__aterstallReferens();
    });
});

describe('referensbyte ritar om allt som namnger referensen', () => {
    let w;
    const hog = [...'ABCDEFGHIJK'].map(b => ({ bas: b, p10: 90000, med: 95000, p90: 99000 }));
    const lista = () => w.document.getElementById('action-checklist-container').textContent;
    beforeAll(() => { w = createAppWindow(); w.__loadDemoData(); });

    it('namnbyte syns direkt i åtgärdslistan', () => {
        w.__lasInReferens(hog, 'Egen A.csv');
        w.eval('renderActionChecklist()');
        expect(lista()).toContain('Egen A');
        w.__sattReferensNamn('Egen B');
        expect(lista()).toContain('Egen B');
        expect(lista()).not.toContain('Egen A');
    });
    it('"Återgå" rensar åtgärdslistan, uppladdningsmärket och filfältet', () => {
        w.eval("markUploadLoaded('upload-cell-policy', 'Inläst')");
        w.document.getElementById('btn-referens-aterga').click();
        expect(lista()).not.toContain('Egen B');
        expect(w.document.getElementById('upload-cell-policy').textContent).not.toContain('Inläst');
        expect(w.document.getElementById('file-input-policy').value).toBe('');
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
        expect(tr.children[i].textContent.trim()).toBe(`${skrKvinnoandel('207011', { del: 'kommun' }).pct.toFixed(0)}\u00a0%`);   // demot är en kommun
        const antal = rubriker('matrix-table').length;
        // Hela bredden räknas med data-hel-colspan; i grundvyn (Fler kolumner av) täcker de synliga cellerna de synliga kolumnerna.
        const synligaRubriker = [...w.document.querySelectorAll('#matrix-table thead th')].filter(th => !th.hidden).length;
        expect(synligaRubriker).toBeLessThan(antal);
        for (const u of w.document.querySelectorAll('#matrix-table tr.la-underrad')) {
            const bredd = [...u.children].reduce((s, td) => s + (+(td.getAttribute('data-hel-colspan') || td.getAttribute('colspan')) || 1), 0);
            expect(bredd).toBe(antal);
            const synlig = [...u.children].filter(td => !td.hidden).reduce((s, td) => s + (+td.getAttribute('colspan') || 1), 0);
            expect(synlig).toBe(synligaRubriker);
        }
    });
    it('sektorsöversikten: kolumnen "Kvinnor nationellt" per sektor', async () => {
        const { skrKvinnoandelSektor } = await import('../src/lib/skrreferens.js');
        w.__renderTabContent('struktur');
        const i = kol('sektor-table', 'Kvinnor nationellt');
        expect(i).toBeGreaterThan(-1);
        const tr = [...w.document.querySelectorAll('#sektor-table tbody tr')].find(t => /Teknikarbete/.test(t.textContent));
        expect(tr.children[i].textContent.trim()).toBe(`${skrKvinnoandelSektor('Teknikarbete', { del: 'kommun' }).pct.toFixed(1).replace('.', ',')}\u00a0%`);
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
        expect(w.eval(`_gdRenderBody(__buildGruppdossier(${JSON.stringify(key)}))`)).toMatch(/nationellt: \d+\s% kvinnor i kommuner</);
        expect(w.__gruppdossierAsText(d)).toMatch(/Nationell referens: \d+\s% kvinnor/);
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
        expect(matrisCell(w)).toBe(`${skrKvinnoandel('207011', { del: 'kommun' }).pct.toFixed(0)}\u00a0%`);
    });
    it('byte till region ritar om med regionernas andel och rätt text', async () => {
        const { skrKvinnoandel } = await skr();
        const w = createAppWindow();
        w.__loadDemoData();
        const sel = w.document.getElementById('org-typ');
        sel.value = 'region';
        sel.dispatchEvent(new w.Event('change'));
        expect(w.__state.profile.orgTyp).toBe('region');
        expect(matrisCell(w)).toBe(`${skrKvinnoandel('207011', { del: 'region' }).pct.toFixed(0)}\u00a0%`);
        const key = w.__gruppdossierCandidates().find(c => c.aid === '207011').key;
        expect(w.__gruppdossierAsText(w.__buildGruppdossier(key))).toMatch(/Nationell referens: \d+\s% kvinnor i regioner/);
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

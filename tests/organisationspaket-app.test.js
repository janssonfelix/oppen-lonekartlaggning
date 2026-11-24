// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
// Organisationspaketet och organisationens namn i appen: läsa in och skapa paketet, escapning, byten mellan paket och
// demot, namnen på organisationen och jämförelsestatistiken och namnen i etiketterna.
import { describe, it, expect } from 'vitest';
import { createAppWindow } from './helpers/app-harness.js';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { bakaIn, lasUt } from '../src/lib/organisationsfil.js';

describe('organisationspaket: läs in och skapa', () => {
    const paket = (over = {}) => ({
        format: 'lonekartlaggning-organisationspaket', version: 1,
        organisation: { namn: 'Exempelregionen' }, utgivare: 'HR', skapat: '2026-10-01', avserAr: 2026,
        profil: { jamforelseNamn: 'Regionens lönestatistik', jamforelseGenitiv: 'Regionens lönestatistiks', jamforelseKort: 'statistiken' },
        installningar: { poPct: 41.5, poNot: 'Egen', manader: 6 },
        referens: { namn: 'Regionens lönepolicy 2026', kortnamn: 'Lönepolicy 2026',
                    rader: ['A', 'B', 'C'].map((bas, i) => ({ bas, aid: null, p10: 25000 + i * 2000, med: 28000 + i * 2000, p90: 31000 + i * 2000 })) },
        statistik: { namn: 'Lönestatistik 2025',
                     rader: [{ aid: '100', aidFull: '100 Yrke', bas: 'A', median: 30000, p10: 27000, p90: 33000, nKv: 20, nMa: 20, andelKv: 50 }] },
        ...over,
    });
    const rader = () => Array.from({ length: 40 }, (_, i) => ({ bas: 'ABC'[i % 3], kon: i % 2 ? 'man' : 'kvinna', lon: 30000 + i * 100, alder: 40,
        yrke: '100 Yrke', aid: '100', yrkeLabel: 'Yrke', radnr: i + 2 }));
    const las = (w, obj) => w.eval(`lasInPaket(${JSON.stringify(JSON.stringify(obj))}, 'x.lonepaket.json')`);

    it('ett fullständigt paket sätter profil, inställningar, referens och statistik', () => {
        const w = createAppWindow();
        const r = las(w, paket());
        expect(r.ok).toBe(true);
        const s = w.__state;
        expect(s.profile.name).toBe('Exempelregionen');
        expect(s.profile.benchmarkLabel).toBe('Regionens lönestatistik');
        expect(s.costSettings.poPct).toBe(41.5);
        expect(s.costSettings.months).toBe(6);
        expect(s.policy).toHaveLength(3);
        expect(w.eval('referensNamn()')).toBe('Regionens lönepolicy 2026');
        expect(s.statistik).toHaveLength(1);
        expect(s.statistikNamn).toBe('Lönestatistik 2025');
        // Paketets validerade delar följer med (ett nytt paket med en importprofil byggs ur dem).
        const { delar, ...meta } = s.paket;
        expect(meta).toEqual({ organisation: 'Exempelregionen', utgivare: 'HR', skapat: '2026-10-01', avserAr: 2026, kalla: 'fil' });
        expect(delar.statistik.namn).toBe('Lönestatistik 2025');
        const d = w.document;
        expect(d.getElementById('upload-cell-policy').textContent).toContain('Från organisationspaketet');
        expect(d.getElementById('upload-cell-stat').textContent).toContain('Från organisationspaketet');
        expect(d.getElementById('referens-status').textContent).toContain('organisationspaket från Exempelregionen, 2026-10-01');
        expect(d.getElementById('paket-info').hidden).toBe(false);
        expect(d.getElementById('paket-info').textContent).toContain('Exempelregionen');
        expect(w.__docDraftHtml()).toContain('Lönestatistik 2025 (organisationspaket från Exempelregionen, 2026-10-01)');
        expect(w.__docDraftHtml()).toContain('Regionens lönepolicy 2026 (organisationspaket från Exempelregionen, 2026-10-01)');
    });
    it('paketets val av jämförelseyrken i likvärdigt arbete sätts i fliken (ADR-60)', () => {
        const w = createAppWindow();
        expect(w.__state.likvardighet.jamforelse).toBe('alla');
        const r = las(w, paket({ installningar: { poPct: 41.5, manader: 6, jamforelse: 'mansdominerade' } }));
        expect(r.ok).toBe(true);
        expect(w.__state.likvardighet.jamforelse).toBe('mansdominerade');
        expect(w.eval('lvJamforelse()')).toBe('mansdominerade');
        const ogiltigt = las(createAppWindow(), paket({ installningar: { jamforelse: 'blandade' } }));
        expect(ogiltigt.ok).toBe(true);
    });
    it('ett paket utan statistik skriver inte över en egen statistikfil', () => {
        const w = createAppWindow();
        w.__state.statistik = [{ aid: '999', aidFull: '999 Eget', bas: 'A', median: 1, p10: 0, p90: 0, nKv: null, nMa: null, andelKv: null }];
        const p = paket(); delete p.statistik;
        expect(las(w, p).ok).toBe(true);
        expect(w.__state.statistik[0].aid).toBe('999');
    });
    it('ett felaktigt paket ändrar ingenting', () => {
        const w = createAppWindow();
        const fore = JSON.stringify({ p: w.__state.profile, c: w.__state.costSettings, pol: w.__state.policy });
        const r = las(w, paket({ format: 'annat' }));
        expect(r.ok).toBe(false);
        expect(JSON.stringify({ p: w.__state.profile, c: w.__state.costSettings, pol: w.__state.policy })).toBe(fore);
        expect(w.document.getElementById('paket-status').textContent).toMatch(/inte ett organisationspaket/);
    });
    it('skapa → läs in i ett nytt fönster ger samma delar', () => {
        const w = createAppWindow();
        las(w, paket());
        const d = w.document;
        const satt = (id, v) => { const el = d.getElementById(id); el.value = v; el.dispatchEvent(new w.Event('input', { bubbles: true })); };
        satt('paket-org', 'Nya regionen'); satt('paket-utgivare', 'Lön'); satt('paket-ar', '2027');
        satt('paket-jamf-namn', 'Nya statistiken'); satt('paket-jamf-genitiv', 'Nya statistikens'); satt('paket-po', '40'); satt('paket-manader', '12');
        expect(d.getElementById('btn-paket-spara').disabled).toBe(false);
        const skapat = w.eval('skapaPaket()');
        const w2 = createAppWindow();
        expect(las(w2, skapat).ok).toBe(true);
        expect(w2.__state.profile.name).toBe('Nya regionen');
        expect(w2.__state.profile.benchmarkLabel).toBe('Nya statistiken');
        expect(w2.__state.costSettings.poPct).toBe(40);
        expect(w2.__state.policy).toEqual(w.__state.policy);
        expect(w2.__state.statistik).toEqual(w.__state.statistik);
        expect(w2.__state.paket.avserAr).toBe(2027);
    });
    it('ställningstagandets namn följer formuläret, inte filnamnet, och går att byta efter inläst paket', () => {
        const w = createAppWindow();
        const d = w.document;
        const satt = (id, v) => { const el = d.getElementById(id); el.value = v; el.dispatchEvent(new w.Event('input', { bubbles: true })); };
        w.__lasInReferens([{ bas: 'A', p10: 25000, med: 30000, p90: 35000 }], '2026 lonepol.csv');
        expect(w.eval('referensNamn()')).toBe('2026 lonepol');
        w.eval('_fyllPaketFormular()');
        expect(d.getElementById('paket-ref-namn').value).toBe('2026 lonepol');   // förifyllt, synligt att byta
        satt('paket-org', 'Nya regionen'); satt('paket-ref-namn', 'Lönepolitiskt ställningstagande 2026'); satt('paket-ref-kortnamn', 'ställningstagandet');
        const skapat = w.eval('skapaPaket()');
        expect(skapat.referens.namn).toBe('Lönepolitiskt ställningstagande 2026');
        expect(skapat.referens.kortnamn).toBe('ställningstagandet');
        const w2 = createAppWindow();
        // Lönedata så att fliken ritas (demoläget lämnas när ett riktigt paket läses in, så inte demodata).
        w2.__state.data = Array.from({ length: 40 }, (_, i) => ({ bas: 'AB'[i % 2], kon: i % 2 ? 'man' : 'kvinna', alder: 25 + (i % 30),
            lon: 28000 + 500 * (i % 7) + (i % 2 ? 1500 : 0), aid: '100', yrke: '100 Y', yrkeLabel: 'Y' }));
        expect(las(w2, skapat).ok).toBe(true);
        expect(w2.eval('referensNamn()')).toBe('Lönepolitiskt ställningstagande 2026');
        expect(w2.eval('referensKortnamn()')).toBe('ställningstagandet');
        expect(w2.eval('hamtaData().length')).toBeGreaterThan(0);
        w2.__ritaLonepolitik();
        expect(w2.document.getElementById('lonepolitik-rubrik').textContent).toBe('Lönerna mot Lönepolitiskt ställningstagande 2026');
        // Namnfältet på Översikt är synligt för ett paket och byter namnet
        expect(w2.document.getElementById('referens-namn-rad').hidden).toBe(false);
        expect(w2.eval("sattReferensNamn('Vårt ställningstagande').ok")).toBe(true);
        w2.__ritaLonepolitik();
        expect(w2.document.getElementById('lonepolitik-rubrik').textContent).toBe('Lönerna mot Vårt ställningstagande');
        expect(w2.document.getElementById('btn-referens-aterga').hidden).toBe(true);   // borttagning bara för egen fil
    });
    // ---- Organisationsfil: verktyget med paketet inbakat (docs/utveckling/organisationsfil.md) ----
    const INDEX = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'index.html'), 'utf8');
    const organisationsfil = (p = paket(), meta = { skapad: '2026-10-19', organisation: 'Exempelregionen', verktygssha: 'f00' }) => {
        const r = bakaIn(INDEX, JSON.stringify(p), meta);
        if (!r.ok) throw new Error(r.fel);
        return r.html;
    };
    it('en organisationsfil läser in sitt paket vid start, visar källan och går att granska och ladda ner', () => {
        const w = createAppWindow({ html: organisationsfil() });
        const s = w.__state;
        expect(s.paket).toMatchObject({ organisation: 'Exempelregionen', kalla: 'inbakat' });
        expect(s.paketInbakat).toMatchObject({ skapad: '2026-10-19', organisation: 'Exempelregionen', verktygssha: 'f00' });
        expect(s.policy).toHaveLength(3);
        expect(w.eval('referensNamn()')).toBe('Regionens lönepolicy 2026');
        expect(w.eval('referensKalla()')).toMatch(/inbakat i den här filen/);
        expect(w.eval('statistikBeskrivning()')).toMatch(/inbakat i den här filen/);
        expect(s.profile.name).toBe('Exempelregionen');
        expect(s.costSettings.poPct).toBe(41.5);
        const d = w.document;
        expect(d.getElementById('paket-info').textContent).toMatch(/Inbakat i den här filen \(skapad 2026-10-19\)/);
        expect(d.getElementById('upload-cell-policy').textContent).toContain('Från organisationspaketet');
        // Visa paketet: modalen ritar tabellerna och råtexten
        d.getElementById('btn-paket-visa').click();
        const m = d.getElementById('paket-modal');
        expect(m.style.display).toBe('flex');
        const txt = d.getElementById('paket-modal-content').textContent;
        expect(txt).toContain('Exempelregionen');
        expect(txt).toContain('Regionens lönepolicy 2026');
        expect(txt).toContain('Lönestatistik 2025');
        expect(txt).toContain('"format"');
        d.getElementById('paket-modal-close').click();
        expect(m.style.display).toBe('none');
        // Ladda ner paketet: en Blob med samma paket
        let fangad = null;
        w.URL.createObjectURL = b => { fangad = b; return 'blob:x'; };
        d.getElementById('btn-paket-ladda-ner').click();
        expect(fangad).not.toBeNull();
        // Om verktyget nämner organisationsfilen (avsnittet med versionen)
        w.eval("ritaOmVerktyget('releases')");
        expect(d.getElementById('view-info').textContent).toMatch(/Den här filen är en organisationsfil/);
    });
    it('en inläst paketfil ersätter det inbakade för sessionen, och Rensa all data tar det inbakade tillbaka', () => {
        const w = createAppWindow({ html: organisationsfil() });
        expect(las(w, paket({ organisation: { namn: 'Annan organisation' } })).ok).toBe(true);
        expect(w.__state.paket).toMatchObject({ organisation: 'Annan organisation', kalla: 'fil' });
        expect(w.document.getElementById('paket-info').textContent).toMatch(/ersätter det inbakade paketet/);
        w.__rensaAllData();
        expect(w.__state.paket).toMatchObject({ organisation: 'Exempelregionen', kalla: 'inbakat' });
        expect(w.__state.policy).toHaveLength(3);
    });
    it('ett paket för ett tidigare år får en upplysning i filrutan, inbakat eller inläst, men ingen punkt i Att göra', () => {
        const ARSRAD = 'Paketet avser 2000. Kontrollera med systemförvaltaren att det är det som gäller.';
        const arsrad = w => w.document.querySelector('#paket-info [role="note"]');
        const w = createAppWindow({ html: organisationsfil(paket({ avserAr: 2000 })) });
        expect(arsrad(w)?.textContent).toBe(ARSRAD);
        w.__state.data = rader();
        w.eval('ritaAtgardslista()');
        expect(w.document.getElementById('att-gora').textContent).not.toContain('systemförvaltaren');
        const w2 = createAppWindow();
        expect(las(w2, paket({ avserAr: 2000 })).ok).toBe(true);
        expect(arsrad(w2)?.textContent).toBe(ARSRAD);
        const nasta = new Date().getFullYear() + 1;
        expect(las(w2, paket({ avserAr: nasta })).ok).toBe(true);
        expect(arsrad(w2)).toBeNull();
        expect(arsrad(createAppWindow({ html: organisationsfil(paket({ avserAr: nasta })) }))).toBeNull();
    });
    it('demoläget går före det inbakade paketet', () => {
        const w = createAppWindow({ html: organisationsfil(), url: 'http://localhost/?demo=1' });
        expect(w.__state.isDemo).toBe(true);
        expect(w.__state.paket).toBeNull();
        expect(w.document.getElementById('paket-status').textContent).toMatch(/används inte i demoläget/);
    });
    it('ett trasigt inbakat paket stoppar inte starten och ger ett fel i filrutan', () => {
        const html = INDEX.replace('</body>', '<template id="inbakat-organisationspaket" data-skapad="2026-10-19">{inte json</template></body>');
        const w = createAppWindow({ html });
        expect(w.__state.paket).toBeNull();
        expect(w.document.getElementById('paket-status').textContent).toMatch(/inbakade paketet kunde inte läsas/);
        expect(w.document.getElementById('tab-bestammelser')).not.toBeNull();   // appen startade
    });
    it('systemägaren bakar in paketet i den utpekade verktygsfilen och får en organisationsfil', async () => {
        const w = createAppWindow();
        las(w, paket());
        // Inläst lönedata med igenkännbara värden: inget av dem får följa med in i organisationsfilen.
        w.__state.data = Array.from({ length: 12 }, (_, i) => ({ bas: 'AB'[i % 2], kon: i % 2 ? 'man' : 'kvinna', alder: 30 + i,
            lon: 87654 + i, aid: '100', yrke: '100 Lönefältsyrke', yrkeLabel: 'Lönefältsyrke' }));
        const d = w.document;
        const satt = (id, v) => { const el = d.getElementById(id); el.value = v; el.dispatchEvent(new w.Event('input', { bubbles: true })); };
        satt('paket-org', 'Exempelregionen'); satt('organisationsfil-namn', 'lonekartlaggning 2026');
        const knapp = d.getElementById('btn-organisationsfil-spara');
        expect(knapp.disabled).toBe(true);                     // ingen verktygsfil utpekad än
        w.eval(`_verktygsfil = new File([${JSON.stringify(INDEX)}], 'oppen-lonekartlaggning.html', { type: 'text/html' }); uppdateraOrganisationsfilKnapp();`);
        expect(knapp.disabled).toBe(false);
        let fangad = null, namn = null;
        w.URL.createObjectURL = b => { fangad = b; return 'blob:x'; };
        const origClick = w.HTMLAnchorElement.prototype.click;
        w.HTMLAnchorElement.prototype.click = function () { namn = this.download; };
        const r = await w.eval('skapaOrganisationsfil()');
        w.HTMLAnchorElement.prototype.click = origClick;
        expect(r.ok).toBe(true);
        expect(namn).toBe('lonekartlaggning 2026.html');
        expect(r.meddelande).toMatch(/Ingen lönedata ingår/);
        const ut = await fangad.text();
        const block = lasUt(ut);
        expect(block).not.toBeNull();
        expect(block.meta.organisation).toBe('Exempelregionen');
        expect(JSON.parse(block.json).referens.rader).toHaveLength(3);
        expect(ut).not.toContain('"lon"');                     // ingen lönedata
        expect(ut).not.toMatch(/8765\d/);                      // inga löner ur den inlästa filen
        expect(ut).not.toContain('Lönefältsyrke');
        // Resultatet startar som organisationsfil
        const w2 = createAppWindow({ html: ut });
        expect(w2.__state.paket).toMatchObject({ organisation: 'Exempelregionen', kalla: 'inbakat' });
    });
    // ---- Fliken För systemförvaltaren: formuläret och organisationsfilen, flyttade från Filer och kvalitet ----
    it('fliken för systemförvaltaren står sist i menyn, är aldrig låst och bär formuläret', () => {
        const w = createAppWindow(), d = w.document;
        const knapp = d.getElementById('tab-forvaltare');
        expect([...d.querySelectorAll('.nav-menu .nav-item')].pop()).toBe(knapp);
        expect(knapp.getAttribute('aria-disabled')).toBeNull();
        knapp.click();
        expect(d.getElementById('view-forvaltare').style.display).toBe('block');
        expect(d.getElementById('page-title').textContent).toBe('För systemförvaltaren');
        const vy = d.getElementById('view-forvaltare'), filer = d.getElementById('organisationspaket');
        for (const id of ['paket-org', 'paket-rapport', 'paket-sammanfattning', 'btn-paket-spara', 'file-input-verktygsfil', 'organisationsfil-namn',
            'btn-organisationsfil-spara', 'organisationsfil-status']) {
            expect(vy.contains(d.getElementById(id)), id).toBe(true);
            expect(filer.contains(d.getElementById(id)), id).toBe(false);
        }
        expect(d.getElementById('paket-skapa')).toBeNull();
        expect(vy.textContent).toMatch(/Webbläsaren låter inte en sida läsa sig själv, så filen måste väljas\./);
        expect(vy.textContent).toMatch(/ingen lönedata/i);
    });
    it('raden i Filer och kvalitet och länken i Om verktyget öppnar fliken', () => {
        const w = createAppWindow(), d = w.document;
        d.querySelector('#organisationspaket [data-go-to-tab="forvaltare"]').click();
        expect(d.querySelector('.nav-item.active').dataset.tab).toBe('forvaltare');
        d.getElementById('tab-info').click();
        d.querySelector('#view-info [data-go-to-tab="forvaltare"]').click();
        expect(d.querySelector('.nav-item.active').dataset.tab).toBe('forvaltare');
    });
    it('knapparna i steg 1 öppnar samma filval som Filer och kvalitet', () => {
        const w = createAppWindow(), d = w.document, vy = d.getElementById('view-forvaltare');
        for (const id of ['file-input-paket', 'file-input-policy', 'file-input-stat']) {
            let klick = 0;
            d.getElementById(id).click = () => { klick++; };
            vy.querySelector(`button[data-byt-fil="${id}"]`).click();
            expect(klick, id).toBe(1);
        }
    });
    it('i en organisationsfil är formuläret förifyllt, och steg 3 fungerar när bara verktygsfilen är vald', () => {
        const w = createAppWindow({ html: organisationsfil() }), d = w.document;
        d.getElementById('tab-forvaltare').click();
        expect(d.getElementById('paket-org').value).toBe('Exempelregionen');
        const knapp = d.getElementById('btn-organisationsfil-spara');
        expect(knapp.disabled).toBe(true);
        const inp = d.getElementById('file-input-verktygsfil');
        Object.defineProperty(inp, 'files', { configurable: true, value: [new w.File([INDEX], 'oppen-lonekartlaggning.html', { type: 'text/html' })] });
        inp.dispatchEvent(new w.Event('change', { bubbles: true }));
        expect(knapp.disabled).toBe(false);
    });
    // ---- Flytta till en ny version: paketet ur den gamla organisationsfilen in i en ny verktygsfil ----
    const medVersion = (html, v) => html.replace('</head>', `<script>var APP_VERSION = "${v}";</script></head>`);
    const valj = (w, id, html, namn) => {
        const inp = w.document.getElementById(id);
        Object.defineProperty(inp, 'files', { configurable: true, value: [new w.File([html], namn, { type: 'text/html' })] });
        inp.dispatchEvent(new w.Event('change', { bubbles: true }));
    };
    const flytta = async (w, gammal, ny) => {
        valj(w, 'file-input-gammal-organisationsfil', gammal, 'gammal.html');
        valj(w, 'file-input-ny-verktygsfil', ny, 'ny.html');
        let fangad = null;
        w.URL.createObjectURL = b => { fangad = b; return 'blob:x'; };
        const origClick = w.HTMLAnchorElement.prototype.click;
        w.HTMLAnchorElement.prototype.click = function () {};
        const r = await w.eval('flyttaTillNyVersion()');
        w.HTMLAnchorElement.prototype.click = origClick;
        return { r, ut: fangad ? await fangad.text() : null, status: w.document.getElementById('flytt-status').textContent };
    };
    const gammalFil = (p = paket()) => organisationsfil(p, { skapad: '2026-10-19', organisation: p.organisation.namn }).replace('</head>', '<script>var APP_VERSION = "2026.01.15";</script></head>');
    it('flytten bär det gamla paketet in i den nya filen och anger organisation, datum och versioner', async () => {
        const w = createAppWindow();
        const { r, ut, status } = await flytta(w, gammalFil(), medVersion(INDEX, '2026.11.01'));
        expect(r.ok).toBe(true);
        expect(status).toBe(r.meddelande);
        for (const del of ['Exempelregionen', '2026-10-01', '2026.01.15', '2026.11.01', 'Ingen lönedata ingår.']) expect(r.meddelande).toContain(del);
        expect(r.meddelande).not.toContain('Observera');
        const block = lasUt(ut);
        expect(block.meta).toMatchObject({ organisation: 'Exempelregionen', verktygsversion: '2026.11.01' });
        expect(JSON.parse(block.json)).toEqual(paket());
    });
    it('knappen för flytten är inaktiv tills båda filerna är valda', () => {
        const w = createAppWindow(), knapp = w.document.getElementById('btn-flytt-ladda-ner');
        expect(knapp.disabled).toBe(true);
        valj(w, 'file-input-gammal-organisationsfil', gammalFil(), 'gammal.html');
        expect(knapp.disabled).toBe(true);
        valj(w, 'file-input-ny-verktygsfil', INDEX, 'ny.html');
        expect(knapp.disabled).toBe(false);
    });
    it('en gammal fil utan paket ger ett fel och ingen nedladdning', async () => {
        const { r, ut, status } = await flytta(createAppWindow(), medVersion(INDEX, '2026.01.15'), INDEX);
        expect(r.ok).toBe(false);
        expect(status).toMatch(/Den gamla filen har inget inbakat paket/);
        expect(ut).toBeNull();
    });
    it('en nedgradering varnar men laddar ner', async () => {
        const { r, ut } = await flytta(createAppWindow(), gammalFil(), medVersion(INDEX, '2025.06.01'));
        expect(r.ok).toBe(true);
        expect(r.meddelande).toContain('Observera: den nya filen är en äldre version än den gamla');
        expect(lasUt(ut)).not.toBeNull();
    });
    it('flytten ändrar inte sessionens paket', async () => {
        const w = createAppWindow({ html: organisationsfil() });
        const fore = JSON.stringify(w.__state.paket);
        const { r } = await flytta(w, gammalFil(paket({ organisation: { namn: 'Annan organisation' } })), INDEX);
        expect(r.ok).toBe(true);
        expect(r.meddelande).toContain('Annan organisation');
        expect(JSON.stringify(w.__state.paket)).toBe(fore);
    });
    it('sökningen på organisationsfil leder till fliken', () => {
        const w = createAppWindow(), d = w.document, f = d.getElementById('sok-grupp');
        f.value = 'organisationsfil';
        f.dispatchEvent(new w.Event('input', { bubbles: true }));
        const li = [...d.querySelectorAll('#sok-grupp-lista [data-sok-funktion]')].find(x => x.querySelector('.sok-namn').textContent === 'Skapa organisationsfil');
        li.click();
        expect(d.querySelector('.nav-item.active').dataset.tab).toBe('forvaltare');
    });
    it('spara-knappen är avstängd utan namn eller utan data', () => {
        const w = createAppWindow();
        const d = w.document;
        const knapp = d.getElementById('btn-paket-spara');
        d.getElementById('paket-org').value = 'X';
        d.getElementById('paket-org').dispatchEvent(new w.Event('input', { bubbles: true }));
        expect(knapp.disabled).toBe(true);           // ingen referens och ingen statistik
        w.__lasInReferens([{ bas: 'A', p10: 1, med: 2, p90: 3 }], 'r.csv');
        d.getElementById('paket-org').dispatchEvent(new w.Event('input', { bubbles: true }));
        expect(knapp.disabled).toBe(false);
        d.getElementById('paket-org').value = '';
        d.getElementById('paket-org').dispatchEvent(new w.Event('input', { bubbles: true }));
        expect(knapp.disabled).toBe(true);
    });
    it('Rensa all data tar bort paketet och återställer neutralt läge', () => {
        const w = createAppWindow();
        las(w, paket());
        w.__rensaAllData();
        const s = w.__state;
        expect(s.paket).toBeNull();
        expect(s.profile.name).toBe('Organisationen');
        expect(s.costSettings.poPct).toBe(40);
        expect(s.policy).toEqual([]);
        expect(s.statistik).toEqual([]);
        expect(s.statistikNamn).toBeNull();
        expect(w.document.getElementById('paket-info').hidden).toBe(true);
    });
    it('konfigurationsfilen noterar paketet men bär inga paketrader', () => {
        const w = createAppWindow();
        w.__state.data = rader();
        las(w, paket());
        const cfg = w.__byggKonfiguration();
        expect(cfg.organisationspaket).toEqual({ organisation: 'Exempelregionen', skapat: '2026-10-01' });
        expect(JSON.stringify(cfg)).not.toContain('Regionens lönepolicy');
        // Yrkets namn finns i lönefilen och får stå i årsbokslutet (ADR-54); paketets egna tal får inte.
        expect(JSON.stringify(cfg)).not.toMatch(/27000|33000|"andelKv"/);
    });
    it('paket inläst efter lönefilen nollställer sparade likvärdighetspar', () => {
        const w = createAppWindow();
        w.__state.data = rader();
        w.__state.likvardighet.result = { pairs: [], sentinel: true };
        las(w, paket());
        expect(w.__state.likvardighet.result?.sentinel).toBeUndefined();   // det gamla resultatet är borta
    });
    it('paket i demoläget avslutar demot först', () => {
        const w = createAppWindow();
        w.__lasInDemodata();
        las(w, paket());
        expect(w.__state.isDemo).toBe(false);
        expect(w.__state.data).toEqual([]);
        expect(w.eval('referensNamn()')).toBe('Regionens lönepolicy 2026');
    });
    it('filknappen: för stor fil avvisas innan den läses', async () => {
        const w = createAppWindow();
        const input = w.document.getElementById('file-input-paket');
        const skicka = async (innehall, namn) => {
            const fil = new w.File([innehall], namn, { type: 'application/json' });
            Object.defineProperty(input, 'files', { configurable: true, value: [fil] });
            input.dispatchEvent(new w.Event('change'));
            for (let i = 0; i < 50 && !w.document.getElementById('paket-status').textContent; i++) await new Promise(r => setTimeout(r, 20));
        };
        await skicka('x'.repeat(5 * 1024 * 1024 + 1), 'stor.json');
        expect(w.document.getElementById('paket-status').textContent).toMatch(/för stor/);
    });
});

describe('organisationspaket: escapning, byten mellan paket och demot', () => {
    const XSS = 'K<img src=x onerror="window.__xss=1">';
    const paket = (over = {}) => ({
        format: 'lonekartlaggning-organisationspaket', version: 1,
        organisation: { namn: 'Org A' }, skapat: '2026-10-01',
        installningar: { poPct: 30, manader: 6 },
        referens: { namn: 'Ref A', kortnamn: 'Ref A', rader: ['A', 'B', 'C'].map((bas, i) => ({ bas, aid: null, p10: 25000 + i * 2000, med: 28000 + i * 2000, p90: 31000 + i * 2000 })) },
        statistik: { namn: 'Stat A', rader: [{ aid: '100', aidFull: '100 Yrke', bas: 'A', median: 30000, p10: 27000, p90: 33000, nKv: 20, nMa: 20, andelKv: 50 }] },
        ...over,
    });
    const rader = () => Array.from({ length: 60 }, (_, i) => ({ bas: 'ABC'[i % 3], kon: i % 2 ? 'man' : 'kvinna', lon: 26000 + (i % 3) * 3000 + i * 10, alder: 40,
        yrke: '100 Yrke', aid: '100', yrkeLabel: 'Yrke', radnr: i + 2 }));
    const las = (w, obj) => w.eval(`lasInPaket(${JSON.stringify(JSON.stringify(obj))}, 'x')`);

    it('referensens namn ur ett paket escapas i beräkningsbeviset och utskriften', async () => {
        const w = createAppWindow();
        w.__state.data = rader();
        w.eval('fyllValjare(); lasUppFlikar();');
        las(w, paket({ referens: { ...paket().referens, namn: XSS, kortnamn: XSS } }));
        const it0 = w.eval("raknaPrioritering('stallningstagande')")[0];
        const bevis = w.eval('_bevisForPrioPost')(it0, 'stallningstagande');
        expect(bevis.intro).not.toContain('<img');
        w.print = () => {};
        await w.eval('byggUtskriftsrapport()');
        await new Promise(r => setTimeout(r, 0));
        // Inget element skapas ur namnet (inuti ett citerat attributvärde är "<" ofarligt).
        expect(w.document.querySelectorAll('#print-report img[onerror], #print-report [onerror]')).toHaveLength(0);
        expect(w.__xss).toBeUndefined();
    });
    it('paketets PO-påslag och period syns i Prioritering och skrivs inte tillbaka', () => {
        const w = createAppWindow();
        las(w, paket());
        expect(w.document.getElementById('prio-po-pct').value).toBe('30');
        expect(w.document.getElementById('prio-cost-months').value).toBe('6');
        w.eval('_lasKostnadsinstallningar()');
        expect(w.__state.costSettings.poPct).toBe(30);
        expect(w.__state.costSettings.months).toBe(6);
    });
    it('paket B efter paket A: A:s delar tillskrivs inte B', () => {
        const w = createAppWindow();
        las(w, paket());
        const b = paket({ organisation: { namn: 'Org B' }, installningar: {}, referens: { ...paket().referens, namn: 'Ref B', kortnamn: 'Ref B' } });
        delete b.statistik;
        las(w, b);
        expect(w.__state.statistik).toEqual([]);
        expect(w.eval('statistikBeskrivning()')).toBe('Ingen jämförelsestatistik inläst');
        expect(w.__state.costSettings.poPct).toBe(40);
        expect(w.document.getElementById('paket-info').textContent).not.toMatch(/jämförelsestatistik/);
    });
    it('en egen statistikfil står kvar när ett nytt paket saknar statistik', () => {
        const w = createAppWindow();
        w.__state.statistik = [{ aid: '999', aidFull: '999 Eget', bas: 'A', median: 1, p10: 0, p90: 0, nKv: null, nMa: null, andelKv: null }];
        w.__state.statistikKalla = 'fil';
        const b = paket(); delete b.statistik;
        las(w, b);
        expect(w.__state.statistik[0].aid).toBe('999');
    });
    it('demot efter ett paket blandar inte in paketets verkliga delar', () => {
        const w = createAppWindow();
        las(w, paket());
        w.__lasInDemodata();
        expect(w.__state.paket).toBeNull();
        expect(w.__state.statistik).toEqual([]);
        expect(w.eval('referensNamn()')).toBe('Exempelkommunens lönepolitik');
        expect(w.__state.costSettings.poPct).toBe(40);
    });
    it('faktarutan följer med när en egen fil ersätter paketets ställningstagande', () => {
        const w = createAppWindow();
        las(w, paket());
        w.__lasInReferens([{ bas: 'A', p10: 1, med: 2, p90: 3 }], 'egen.csv');
        expect(w.document.getElementById('paket-info').textContent).not.toMatch(/ställningstagande 3 rader/);
    });
    it('ett paket som inte skulle gå att läsa in sparas inte', () => {
        const w = createAppWindow();
        w.__state.statistik = [{ aid: '5321012345', aidFull: '5321012345 X', bas: 'A', median: 30000, p10: 0, p90: 0, nKv: null, nMa: null, andelKv: null }];
        const d = w.document;
        d.getElementById('paket-org').value = 'Org';
        d.getElementById('paket-org').dispatchEvent(new w.Event('input', { bubbles: true }));
        let nedladdad = false;
        w.URL.createObjectURL = () => { nedladdad = true; return 'blob:x'; };
        d.getElementById('btn-paket-spara').click();
        expect(nedladdad).toBe(false);
        expect(d.getElementById('paket-status').textContent).toMatch(/personnummer/);
    });
});

describe('namn på organisationen och jämförelsestatistiken', () => {
    it('standard utan namn; namn sätts, genitiv räknas fram, tomt återställer', () => {
        const w = createAppWindow();
        expect(w.eval("orgNamn()")).toBe('Organisationen');
        expect(w.eval("orgNamn('org.')")).toBe('org.');
        expect(w.eval("jmfNamn('jämförelsestatistiken')")).toBe('jämförelsestatistiken');
        expect(w.eval("sattOrgNamn('  Hallsbergs kommun ')").ok).toBe(true);
        expect(w.eval("orgNamn('org.')")).toBe('Hallsbergs kommun');
        expect(w.eval("sattJmfNamn('SKR:s statistik')").ok).toBe(true);
        expect(w.__state.profile).toMatchObject({ benchmarkLabel: 'SKR:s statistik', benchmarkLabelGenitive: 'SKR:s statistiks', benchmarkShort: 'SKR:s statistik' });
        w.eval("sattOrgNamn(''); sattJmfNamn('')");
        expect(w.eval("orgNamn()")).toBe('Organisationen');
        expect(w.__state.profile.benchmarkLabel).toBe('jämförelsestatistiken');
    });
    it('personnummer eller e-post avvisas i alla tre namnen', () => {
        const w = createAppWindow();
        w.eval("sattOrgNamn('Kommunen')");
        const r = w.eval("sattOrgNamn('Anna 19800101-1234')");
        expect(r.ok).toBe(false);
        expect(r.fel).toMatch(/personnummer/);
        expect(w.eval("orgNamn()")).toBe('Kommunen');
        expect(w.eval("sattJmfNamn('a@b.se')").ok).toBe(false);
        w.__state.policy = [{ bas: 'C', p10: 1, med: 2, p90: 3 }];
        w.__state.policyNamn = 'Min referens';
        expect(w.eval("sattReferensNamn('19800101-1234')").ok).toBe(false);
        expect(w.__state.policyNamn).toBe('Min referens');
    });
    it('Dokumentera-fältet och profilen följer varandra; konfigurationsfilen bär namnen', () => {
        const w = createAppWindow();
        w.eval("sattOrgNamn('Exempelregionen'); sattJmfNamn('Regionstatistiken')");
        expect(w.document.getElementById('kl-org-name').value).toBe('Exempelregionen');
        const kl = w.document.getElementById('kl-org-name');
        kl.value = 'Ny region'; kl.dispatchEvent(new w.Event('change'));
        expect(w.eval("orgNamn()")).toBe('Ny region');
        const cfg = w.__byggKonfiguration();
        expect(cfg.orgNamn).toBe('Ny region');
        expect(cfg.jmfNamn).toBe('Regionstatistiken');
        const w2 = createAppWindow();
        w2.__tillampaKonfiguration(cfg);
        expect(w2.eval("orgNamn()")).toBe('Ny region');
        expect(w2.eval("jmfNamn()")).toBe('Regionstatistiken');
    });
    it('demot sätter Exempelkommunen; Rensa och ett paket ersätter', () => {
        const w = createAppWindow();
        w.__lasInDemodata();
        expect(w.eval("orgNamn()")).toBe('Exempelkommunen');
        w.eval('_rensaAllData()');
        expect(w.eval("orgNamn()")).toBe('Organisationen');
        expect(w.eval("jmfNamn()")).toBe('Jämförelsestatistiken');
        w.eval("sattOrgNamn('Mitt namn')");
        const paket = JSON.stringify({ format: 'lonekartlaggning-organisationspaket', version: 1, organisation: { namn: 'Paketkommunen' }, skapat: '2026-09-28',
            profil: { jamforelseNamn: 'Paketstatistiken' }, referens: { rader: [{ bas: 'C', p10: 1, med: 2, p90: 3 }] } });
        w.eval(`lasInPaket(${JSON.stringify(paket)}, 'p.json')`);
        expect(w.eval("orgNamn()")).toBe('Paketkommunen');
        expect(w.eval("jmfNamn()")).toBe('Paketstatistiken');
    });
});

describe('namnen i etiketterna', () => {
    const oppna = () => {
        const w = createAppWindow();
        w.__lasInDemodata();
        w.__state.statistik = w.__state.data.slice(0, 40).map(r => ({ aid: r.aid, bas: r.bas, median: 35000, p10: 31000, p90: 40000 }));
        w.__state.statistikHasP10 = w.__state.statistikHasP90 = true;
        w.eval("sattOrgNamn('Testkommunen'); sattJmfNamn('Teststatistiken')");
        return w;
    };
    const serier = (w, id) => ((w.document.getElementById(id)._figur || {}).lager || []).map(l => l.serie);
    it('diagramserier: Jämförelsestatistik, Lönepolitik, Ålder & karriär', () => {
        const w = oppna();
        w.__ritaFlik('benchmark');
        expect(serier(w, 'chart-jamforelse-spann')).toEqual(expect.arrayContaining(['Testkommunen P10–P90', 'Testkommunen median', 'Teststatistiken P10–P90']));
        w.__ritaFlik('lonepolitik');
        expect(serier(w, 'chart-lp-bandmap')).toContain('Testkommunen (P10–P90)');
    });
    it('tabellrubriker: Likvärdigt arbete och Jämförelsestatistik', () => {
        const w = oppna();
        w.__ritaFlik('likvardighet');
        const lv = w.document.getElementById('likvardighet-content').textContent;
        expect(lv).toMatch(/Median Testkommunen/);
        expect(lv).toMatch(/Kvinnodom\. AID-etikett \(Testkommunen\)/);
        w.__ritaFlik('benchmark');
        const th = [...w.document.querySelectorAll('#benchmark-table thead th')].map(t => t.textContent.trim());
        expect(th).toContain('P10 Testkommunen');
        expect(th).toContain('Median Testkommunen');
    });
    it('utan namn: etiketterna som i dag', () => {
        const w = createAppWindow();
        w.__lasInDemodata();
        w.eval("sattOrgNamn('')");   // demot heter Exempelkommunen
        w.__ritaFlik('likvardighet');
        expect(w.document.getElementById('likvardighet-content').textContent).toMatch(/Median org\./);
        w.__ritaFlik('lonepolitik');
        expect(serier(w, 'chart-lp-bandmap')).toContain('Organisationen (P10–P90)');
    });
    it('namn med <, & och %{x} visas som text', () => {
        const w = oppna();
        w.eval("sattOrgNamn('A<b>&%{x}')");
        w.__ritaFlik('likvardighet');
        expect(w.document.getElementById('likvardighet-content').innerHTML).not.toMatch(/<b>&/);
        expect(w.document.getElementById('likvardighet-content').textContent).toMatch(/Median A<b>&%\{x\}/);
    });
});

describe('Jämförelsestatistik, Översikt och namn: detaljer — namn', () => {
    const medStatistik = () => {
        const w = createAppWindow();
        w.__lasInDemodata();
        w.__state.statistik = w.__state.data.map(r => ({ aid: r.aid, bas: r.bas, median: 35000, p10: 31000, p90: 40000 }))
            .filter((s, i, a) => a.findIndex(x => x.aid === s.aid && x.bas === s.bas) === i);
        w.__state.statistikHasP10 = w.__state.statistikHasP90 = true;
        return w;
    };
    it('namn med < och > tolkas inte i diagrammens förklaringar', () => {
        const w = medStatistik();
        w.eval("sattOrgNamn('A<b>B</b>'); sattJmfNamn('<br>X')");
        w.__ritaFlik('benchmark');
        const namn = w.document.getElementById('chart-jamforelse-spann')._figur.lager.map(l => l.serie).join('|');
        expect(namn).not.toMatch(/[<>]/);
        expect(namn).toMatch(/A‹b›B‹\/b› P10–P90/);
        expect(w.document.getElementById('chart-jamforelse-spann').querySelector('b, br')).toBeNull();
        w.__ritaFlik('lonepolitik');
        expect(w.document.getElementById('chart-lp-bandmap')._figur.lager.map(l => l.serie).join('|')).not.toMatch(/[<>]/);
    });
    it('namn ur ett paket kortas till 100 tecken', () => {
        const w = createAppWindow();
        const lang = 'K'.repeat(150);
        const paket = JSON.stringify({ format: 'lonekartlaggning-organisationspaket', version: 1, organisation: { namn: lang }, skapat: '2026-09-28',
            profil: { jamforelseNamn: 'S'.repeat(150) }, referens: { rader: [{ bas: 'C', p10: 30000, med: 34000, p90: 39000 }] } });
        w.eval(`lasInPaket(${JSON.stringify(paket)}, 'p.json')`);
        expect(w.eval('orgNamn()')).toHaveLength(100);
        expect(w.eval('jmfNamn()')).toHaveLength(100);
    });
    it('ställningstagandets namn normaliseras; ett avvisat namn står inte kvar i fältet', () => {
        const w = createAppWindow();
        w.__lasInDemodata();
        w.eval("_lasInReferens([{ bas: 'C', p10: 30000, med: 34000, p90: 39000 }], 'min.csv')");
        w.eval("sattReferensNamn('  Min   referens ')");
        expect(w.__state.policyNamn).toBe('Min referens');
        const f = w.document.getElementById('referens-namn');
        expect(f.maxLength).toBe(100);
        f.value = '19800101-1234'; f.dispatchEvent(new w.Event('change'));
        expect(f.value).toBe('Min referens');
    });
    it('namnfälten har var sitt tillgängligt namn', () => {
        const w = createAppWindow();
        expect(w.document.getElementById('org-namn').getAttribute('aria-label')).toBe('Organisationens namn');
        expect(w.document.getElementById('jmf-namn').getAttribute('aria-label')).toBe('Jämförelsestatistikens namn');
    });
});
